#!/usr/bin/env bash
# Fuehrt alle automatischen Pruefungen der Phase 1 aus.
#
# Aufruf:  bash tools/abnahme.sh
#
# Rueckgabewert 0, wenn alles besteht. Jeder Schritt meldet OK oder FEHLER;
# das Skript laeuft immer bis zum Ende durch, damit man das vollstaendige
# Bild bekommt und nicht nur den ersten Fehler.
set -uo pipefail
cd "$(dirname "$0")/.."

blau=$'\033[1;34m'; gruen=$'\033[0;32m'; rot=$'\033[0;31m'; grau=$'\033[0;90m'; aus=$'\033[0m'
fehler=0
nr=0

schritt() {
  nr=$((nr+1))
  printf '\n%s─── %d %s %s\n' "$blau" "$nr" "$1" "$aus"
}
ergebnis() {
  if [ "$1" -eq 0 ]; then printf '%s   ✓ %s%s\n' "$gruen" "$2" "$aus"
  else printf '%s   ✗ %s%s\n' "$rot" "$2" "$aus"; fehler=$((fehler+1)); fi
}

printf '%sAbnahme Phase 1 — VeloCity%s\n' "$blau" "$aus"
printf '%s%s%s\n' "$grau" "$(date '+%d.%m.%Y %H:%M')" "$aus"

# ---------------------------------------------------------------- 1 .env
schritt "Zugangsdaten"
if [ -f .env ]; then
  fehlend=""
  for k in PGHOST PGPORT PGDATABASE PGUSER PGPASSWORD SUPABASE_URL SUPABASE_ANON_KEY; do
    grep -q "^${k}=." .env || fehlend="$fehlend $k"
  done
  [ -z "$fehlend" ] && ergebnis 0 ".env vollstaendig" || ergebnis 1 "in .env fehlt:$fehlend"
else
  ergebnis 1 ".env fehlt — Vorlage: .env.example"
fi

# ------------------------------------------------- 2 Aufbaukette zweimal
schritt "Aufbaukette, zweimal (Idempotenz)"
if python3 db/run.py db/aufbau/*.sql >/tmp/abnahme1.log 2>&1 &&
   python3 db/run.py db/aufbau/*.sql >/tmp/abnahme2.log 2>&1; then
  ergebnis 0 "12 Dateien, zweimal fehlerfrei"
else
  ergebnis 1 "Aufbau fehlgeschlagen — siehe /tmp/abnahme2.log"
  tail -5 /tmp/abnahme2.log | sed 's/^/     /'
fi

# ------------------------------------------------------- 3 pgTAP-Tests
schritt "Datenbanktests (pgTAP)"
if python3 db/test.py >/tmp/abnahme-test.log 2>&1; then
  ok=$(grep -c '^ok ' /tmp/abnahme-test.log)
  ergebnis 0 "$ok Testfunktionen bestanden"
else
  ergebnis 1 "Tests fehlgeschlagen"
  grep -A3 '^not ok' /tmp/abnahme-test.log | head -20 | sed 's/^/     /'
fi

# --------------------------------------------------- 4 Zugriffsschutz
schritt "Zugriffsschutz ueber die REST-Schnittstelle"
python3 tools/rest_security_check.py >/tmp/abnahme-sec.log 2>&1
rc=$?
case $rc in
  0) ergebnis 0 "13 Ressourcen gesperrt, 7 Sichten oeffentlich" ;;
  2) ergebnis 1 "Schema velocity ist bei PostgREST nicht freigegeben — die Pruefung belegt nichts"
     sed 's/^/     /' /tmp/abnahme-sec.log ;;
  *) ergebnis 1 "Abweichungen gefunden"
     grep '^FEHLER' /tmp/abnahme-sec.log | sed 's/^/     /' ;;
esac

# ------------------------------------------------ 5 Altschema dicht
schritt "Altschema cityBikesRental abgesichert"
KEY=$(grep '^SUPABASE_ANON_KEY=' .env 2>/dev/null | cut -d= -f2-)
URL=$(grep '^SUPABASE_URL=' .env 2>/dev/null | cut -d= -f2-)
if [ -n "$KEY" ] && [ -n "$URL" ]; then
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 \
    "${URL%/}/rest/v1/kunde?select=email&limit=1" \
    -H "apikey: $KEY" -H 'Accept-Profile: cityBikesRental')
  if [ "$code" = "401" ] || [ "$code" = "403" ]; then
    ergebnis 0 "anon erhaelt HTTP $code auf die Altdaten"
  else
    ergebnis 1 "anon erhaelt HTTP $code — das Leck ist offen"
  fi
else
  ergebnis 1 "SUPABASE_URL oder SUPABASE_ANON_KEY fehlt in .env"
fi

# ------------------------------------------------ 6 Abgleichsbericht
schritt "Abgleichsbericht der Datenuebernahme"
python3 - <<'PY' 2>/tmp/abnahme-abgleich.err
import sys, pathlib; sys.path.insert(0, 'db')
from run import verbinde
c = verbinde(); cur = c.cursor()
cur.execute(pathlib.Path('db/betrieb/abgleichsbericht.sql').read_text(encoding='utf-8'))
schlecht = 0
for bereich, alt, neu, abw, bem in cur.fetchall():
    zeichen = 'ok ' if abw == 0 or bem else 'ABW'
    if abw != 0 and not bem: schlecht += 1
    print(f'     {zeichen} {bereich:<30} alt {alt:>6}  neu {neu:>6}  Abweichung {abw:>4}')
sys.exit(1 if schlecht else 0)
PY
ergebnis $? "keine unerklaerte Abweichung"

# ------------------------------------------------------- 7 Diagramme
schritt "Mermaid-Diagramme"
if node tools/mermaid_check.mjs doku/datenmodell/erd/*.mmd >/tmp/abnahme-mmd.log 2>&1; then
  ergebnis 0 "$(grep -c '^OK' /tmp/abnahme-mmd.log) Quellen validieren"
else
  ergebnis 1 "Diagrammfehler"
  grep -A2 '^FEHLER' /tmp/abnahme-mmd.log | sed 's/^/     /'
fi

# ------------------------------ 7b Kardinalitaeten gegen den Katalog
# mermaid_check prueft die Syntax. Das sagt nichts darueber, ob ein
# Diagramm die Wahrheit sagt: achtzehn Beziehungen behaupteten einmal
# Pflicht, wo der Fremdschluessel NULL zulaesst.
schritt "Kardinalitaeten der Diagramme"
if python3 tools/erd_check.py >/tmp/abnahme-erd.log 2>&1; then
  ergebnis 0 "$(tail -1 /tmp/abnahme-erd.log)"
else
  ergebnis 1 "Diagramm widerspricht dem Systemkatalog"
  grep -A3 '^FEHLER' /tmp/abnahme-erd.log | head -20 | sed 's/^/     /'
fi

# ------------------------------- 7d Kein veraltetes PDF danebenlegen
# Ein PDF, das aelter ist als das Deck, ist schlimmer als keines: es
# sieht fertig aus und zeigt einen ueberholten Stand. Genau daran ist
# einmal der Eindruck entstanden, die ER-Diagramme seien noch falsch -
# die Quellen stimmten laengst, das PDF war fuenfzehn Stunden alt.
schritt "PDF nicht aelter als das Deck"
pdf="slides/velocity-datenbankentwurf.pdf"
pptx="slides/velocity-datenbankentwurf.pptx"
if [ ! -f "$pdf" ]; then
  ergebnis 0 "kein PDF vorhanden, also keines das luegen kann"
elif [ "$pdf" -nt "$pptx" ] || [ ! "$pptx" -nt "$pdf" ]; then
  ergebnis 0 "PDF ist so aktuell wie das Deck"
else
  ergebnis 1 "PDF ist aelter als das Deck - neu exportieren oder loeschen"
fi

# ------------------------------------- 7c Inhaltspruefung des Decks
# check_deck.py prueft Geometrie. Dieser Pruefer sucht inhaltliche
# Fehler: transliterierte Umlaute, Zeichen ausserhalb der Hausschrift,
# Absolutheiten, doppelte Titel, Zahlen die vom Repository abweichen.
schritt "Folieninhalte"
if python3 tools/deck_audit.py >/tmp/abnahme-deck.log 2>&1; then
  ergebnis 0 "$(grep -E '^[0-9]+ Folien geprueft' /tmp/abnahme-deck.log)"
else
  ergebnis 1 "Inhaltliche Befunde im Deck"
  grep -vE '^$|geprueft|Repository' /tmp/abnahme-deck.log | head -12 | sed 's/^/     /'
fi

# --------------------------- 7e Vertrag zwischen HTML und JavaScript
# Das Skript sucht Elemente ueber getElementById. Verschwindet eines
# beim Umbau, bricht die Seite still: keine Fehlermeldung, nur eine
# Kachel, die leer bleibt. Beim Austausch des Kopfbereichs war das die
# groesste Gefahr.
schritt "HTML und JavaScript passen zusammen"
if python3 tools/frontend_check.py >/tmp/abnahme-front.log 2>&1; then
  ergebnis 0 "$(grep -E 'ids im HTML' /tmp/abnahme-front.log)"
else
  ergebnis 1 "Der Vertrag ist verletzt"
  grep -vE '^$|ids im HTML' /tmp/abnahme-front.log | head -10 | sed 's/^/     /'
fi

# Der vollstaendige Weg: ausleihen, zurueckgeben, abrechnen - und zwar
# unter der Rolle authenticated und mit echtem COMMIT. Ein pgTAP-Test
# haette den Stopper vom 24.08.2026 nicht gefunden: die aufgeschobenen
# Constraint-Trigger feuern erst beim COMMIT, und pgTAP rollt zurueck.
schritt "Durchstich: Ausleihe bis Abrechnung"
if python3 db/durchstich.py >/tmp/abnahme-durchstich.log 2>&1; then
  ergebnis 0 "$(grep -c '✓' /tmp/abnahme-durchstich.log) Schritte fuer drei Fahrradtypen"
else
  ergebnis 1 "Der Weg bricht ab"
  grep '✗' /tmp/abnahme-durchstich.log | head -8 | sed 's/^/     /'
fi

# Veraltete Dateien im Browsercache haben eine Pruefung von aussen zwei
# kritische Befunde melden lassen, die es nicht mehr gab.
schritt "Fingerabdruecke an den eingebundenen Dateien"
if python3 tools/versionieren.py --pruefen >/tmp/abnahme-vers.log 2>&1; then
  ergebnis 0 "alle Stempel aktuell"
else
  ergebnis 1 "Stempel veraltet — python3 tools/versionieren.py"
  head -6 /tmp/abnahme-vers.log | sed 's/^/     /'
fi

# Der Vertragspruefer oben sieht nur, ob die Elemente da sind. Ob die
# Seite bedienbar ist, sieht er nicht - eine Aussenpruefung fand 45
# unbenannte Marker, tote Rechtsverweise und einen Dialog ohne Rolle,
# waehrend er null Befunde meldete. Dieser Pruefer haelt genau diese
# Punkte fest, damit sie nicht unbemerkt zurueckkommen.
schritt "Bedienbarkeit — Punkte aus dem UX-Audit vom 24.08.2026"
if python3 tools/ux_check.py >/tmp/abnahme-ux.log 2>&1; then
  ergebnis 0 "$(grep -c '^  ok' /tmp/abnahme-ux.log) Punkte nachgeprueft, alle erledigt"
else
  ergebnis 1 "$(grep -c '^  FEHL' /tmp/abnahme-ux.log) Punkt(e) offen"
  grep '^  FEHL' /tmp/abnahme-ux.log | head -10 | sed 's/^/     /'
fi

# --------------------------------------------------------- 8 Website
schritt "Website spricht nur Sichten und api-Funktionen"
verstoss=$(grep -oE "\.from\('[a-z_]+'\)" src/supabase.js | grep -v "'v_" || true)
verstoss="$verstoss$(grep -oE "rpc\('[a-z_]+'" src/supabase.js | grep -v "'api_" || true)"
if [ -z "$(echo "$verstoss" | tr -d '[:space:]')" ]; then
  ergebnis 0 "keine Basistabelle, keine fn_-Funktion im Frontend"
else
  ergebnis 1 "Direktzugriff gefunden: $verstoss"
fi
if node --check src/supabase.js 2>/dev/null && node --check src/script.js 2>/dev/null \
   && node --check src/auth.js 2>/dev/null && node --check src/config.js 2>/dev/null; then
  ergebnis 0 "JavaScript syntaktisch in Ordnung"
else
  ergebnis 1 "Syntaxfehler im Frontend"
fi

# ------------------------------------------------------- 9 Foliendeck
schritt "Foliendeck"
if [ -f slides/velocity-datenbankentwurf.pptx ]; then
  if python3 slides/check_deck.py slides/velocity-datenbankentwurf.pptx >/tmp/abnahme-deck.log 2>&1; then
    ergebnis 0 "$(tail -1 /tmp/abnahme-deck.log)"
  else
    ergebnis 1 "Layoutbefunde"
    head -12 /tmp/abnahme-deck.log | sed 's/^/     /'
  fi
else
  ergebnis 1 "slides/velocity-datenbankentwurf.pptx fehlt — python3 slides/build_deck.py"
fi

# ----------------------------------------------------------- Ergebnis
printf '\n%s────────────────────────────────────────%s\n' "$blau" "$aus"
if [ "$fehler" -eq 0 ]; then
  printf '%sAlle %d Pruefungen bestanden.%s\n' "$gruen" "$nr" "$aus"
else
  printf '%s%d von %d Pruefungen fehlgeschlagen.%s\n' "$rot" "$fehler" "$nr" "$aus"
fi
printf '\n%sNicht automatisierbar — bitte selbst durchklicken:%s\n' "$grau" "$aus"
printf '%s  python3 -m http.server 8765 --directory src   und dann http://localhost:8765%s\n' "$grau" "$aus"
printf '%s  Schrittfolge in doku/verifikation/2026-08-23-e2e-protokoll.md%s\n' "$grau" "$aus"
exit $([ "$fehler" -gt 0 ] && echo 1 || echo 0)
