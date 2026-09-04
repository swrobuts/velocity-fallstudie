#!/usr/bin/env bash
# Fuehrt alle automatischen Pruefungen der Phase 1 und Phase 2 aus.
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

# Prueft, dass eine Menge von Dateien nur erlaubte Sichten liest und nur
# erlaubte Funktionen aufruft.
#
# Die fruehere Fassung (bis 26.08.2026) suchte woertlich nach
# .from('name') und rpc('name') mit genau einem einfachen
# Anfuehrungszeichen und keinem Leerzeichen. Vier Schreibweisen liefen
# unbemerkt durch: .from("name") mit doppelten Anfuehrungszeichen,
# .from( 'name' ) mit Leerraum, .from(variable) ganz ohne
# Anfuehrungszeichen und rpc("name") ebenso mit doppelten. Der Code, der
# das aufdeckte, stand woertlich in einer Pruefanweisung - niemand hatte
# im echten Code etwas geschwaecht.
#
# Ausserdem sah die alte Fassung ueberhaupt nur nach woertlichem
# .from()/.rpc() im Quelltext, waehrend Website und Warenwirtschaft
# tatsaechlich ausschliesslich ueber die Hilfsfunktionen ladeListe() und
# rufeAuf() zugreifen (src/supabase.js, wawi/daten.js) - der Name der
# Sicht bzw. Funktion steht also fast nirgends als woertliches
# .from()/.rpc(), sondern als woertliches Argument von ladeListe()/
# rufeAuf(). Diese Fassung prueft deshalb beide Ebenen: den direkten
# Aufruf auf supabaseClient (faengt einen Umgehungsversuch der
# Hilfsfunktionen ab) und den Aufruf der Hilfsfunktionen selbst (das ist
# der Weg, den der echte Code tatsaechlich nimmt).
#
# Ein Aufruf ohne Anfuehrungszeichen (eine Variable) ist damit noch
# erkennbar, aber fuer sich kein Verstoss - das gilt genau fuer die
# Definition von ladeListe()/rufeAuf() selbst, die den Sichten-/
# Funktionsnamen als Parameter entgegennehmen. Die Pruefung kann den
# tatsaechlichen Namen an dieser Stelle nicht beurteilen und sagt das
# als HINWEIS, statt es stillschweigend zu uebergehen.
#
# Aufruf: pruefe_direktzugriff <Dateien, eine je Zeile> <erlaubte
#         .from()/ladeListe()-Praefixe, kommagetrennt> <erlaubte
#         .rpc()/rufeAuf()-Praefixe, kommagetrennt> <zusaetzlich
#         erlaubte woertliche Funktionsnamen, kommagetrennt, darf leer
#         sein>
pruefe_direktzugriff() {
  DZ_DATEIEN="$1" DZ_FROM_PRAEFIXE="$2" DZ_RPC_PRAEFIXE="$3" DZ_RPC_NAMEN="$4" \
  python3 - <<'PYEOF'
import os, re, sys

dateien = [p for p in os.environ.get('DZ_DATEIEN', '').split('\n') if p]
from_praefixe = tuple(p for p in os.environ.get('DZ_FROM_PRAEFIXE', '').split(',') if p)
rpc_praefixe  = tuple(p for p in os.environ.get('DZ_RPC_PRAEFIXE', '').split(',') if p)
rpc_namen     = set(n for n in os.environ.get('DZ_RPC_NAMEN', '').split(',') if n)

# Ein Argument ist entweder einfach oder doppelt zitiert, oder es ist
# gar kein Literal (eine Variable/ein Ausdruck) - dann greift die letzte
# Alternative und die Pruefung merkt sich das als "nicht beurteilbar".
ARG = r"\s*(?:'([^']*)'|\"([^\"]*)\"|([^,)\s][^,)]*))"
kopf_from = re.compile(r"(?:supabaseClient\s*\.\s*from|(?<!function )\bladeListe)\s*\(" + ARG)
kopf_rpc  = re.compile(r"(?:supabaseClient\s*\.\s*rpc|(?<!function )\brufeAuf)\s*\(" + ARG)

verstoss = []
unklar = []

def pruefe(regex, pfad, text, art, praefixe, namen):
    for m in regex.finditer(text):
        zeile_nr = text.count('\n', 0, m.start()) + 1
        einq, doppelq, frei = m.groups()
        ort = f"{pfad}:{zeile_nr}"
        if einq is not None:
            wert = einq
        elif doppelq is not None:
            wert = doppelq
        else:
            unklar.append(
                f"{ort}  {art}(...) kein Literal, nicht automatisch "
                f"beurteilbar: {(frei or '').strip()[:50]}")
            continue
        if not (wert.startswith(praefixe) or wert in namen):
            verstoss.append(f"{ort}  {art}('{wert}')")

for pfad in dateien:
    try:
        text = open(pfad, encoding='utf-8').read()
    except FileNotFoundError:
        continue
    pruefe(kopf_from, pfad, text, 'from', from_praefixe, set())
    pruefe(kopf_rpc, pfad, text, 'rpc', rpc_praefixe, rpc_namen)

for u in unklar:
    print(f"HINWEIS {u}")
for v in verstoss:
    print(f"FEHLER  {v}")
if not verstoss and not unklar:
    print("ok      keine Basistabelle, keine verbotene Funktion, alle Aufrufe Literale")
sys.exit(1 if verstoss else 0)
PYEOF
}

printf '%sAbnahme Phase 1 und 2 — VeloCity%s\n' "$blau" "$aus"
printf '%s%s%s\n' "$grau" "$(date '+%d.%m.%Y %H:%M')" "$aus"

# ---------------------------------------------------------------- .env
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

# ------------------------------------------------- Aufbaukette zweimal
schritt "Aufbaukette, zweimal (Idempotenz)"
# Dateizahl GEZAEHLT statt eingetragen: eine feste Zahl hier ("12
# Dateien") stand bis zur Gesamtpruefung vom 26.08.2026 unveraendert im
# Text, waehrend db/aufbau/ laengst auf 18 Dateien gewachsen war - die
# Pruefung blieb gruen, meldete aber eine falsche Zahl. Genau diese Sorte
# Fehler hat einmal dazu gefuehrt, dass eine externe Pruefung einen
# richtigen Betrag fuer einen Datenfehler hielt (siehe TESTEN.md).
dateizahl=$(ls db/aufbau/*.sql | wc -l | tr -d ' ')
if python3 db/run.py db/aufbau/*.sql >/tmp/abnahme1.log 2>&1 &&
   python3 db/run.py db/aufbau/*.sql >/tmp/abnahme2.log 2>&1; then
  ergebnis 0 "$dateizahl Dateien, zweimal fehlerfrei"
else
  ergebnis 1 "Aufbau fehlgeschlagen — siehe /tmp/abnahme2.log"
  tail -5 /tmp/abnahme2.log | sed 's/^/     /'
fi

# ------------------------------------------------------- pgTAP-Tests
schritt "Datenbanktests (pgTAP)"
if python3 db/test.py >/tmp/abnahme-test.log 2>&1; then
  ok=$(grep -c '^ok ' /tmp/abnahme-test.log)
  ergebnis 0 "$ok Testfunktionen bestanden"
else
  ergebnis 1 "Tests fehlgeschlagen"
  grep -A3 '^not ok' /tmp/abnahme-test.log | head -20 | sed 's/^/     /'
fi

# --------------------------------------------------- Zugriffsschutz
schritt "Zugriffsschutz ueber die REST-Schnittstelle"
# Zahlen GEZAEHLT statt eingetragen, aus derselben Ueberlegung wie bei
# Pruefung 2: hier stand bis zur Gesamtpruefung vom 26.08.2026 "7 Sichten
# oeffentlich" fest im Text - waehrend die ERLAUBT-Liste in
# rest_security_check.py laengst auf neun Sichten gewachsen war. Die
# Pruefung blieb gruen, meldete aber eine falsche Zahl; siehe TESTEN.md.
# Gezaehlt wird aus dem tatsaechlichen Pruefprotokoll, nicht aus der
# Quelle nachgezaehlt - nur das belegt, dass jede einzelne Ressource
# auch wirklich geprueft und nicht bloss aufgelistet wurde.
python3 tools/rest_security_check.py >/tmp/abnahme-sec.log 2>&1
rc=$?
case $rc in
  0) gesperrt=$(grep -c ': kein Zugriff' /tmp/abnahme-sec.log)
     oeffentlich=$(grep -c ': oeffentlich erreichbar' /tmp/abnahme-sec.log)
     ergebnis 0 "$gesperrt Ressourcen gesperrt, $oeffentlich Sichten oeffentlich" ;;
  2) ergebnis 1 "Schema velocity ist bei PostgREST nicht freigegeben — die Pruefung belegt nichts"
     sed 's/^/     /' /tmp/abnahme-sec.log ;;
  *) ergebnis 1 "Abweichungen gefunden"
     grep '^FEHLER' /tmp/abnahme-sec.log | sed 's/^/     /' ;;
esac

# ------------------------------------------------ Altschema dicht
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

# ------------------------------------------------ Abgleichsbericht
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

# ------------------------------------------------------- Diagramme
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

# --------------------------- 7bb Breitenregel der Preisschaetzung
# Dieselbe Regel steht im Notebook, im CHECK der Tabelle und im Lader.
# Als sie am 01.09.2026 nur im Notebook geaendert wurde, wies der Lader
# 150 von 212 Zeilen ab - still, bei gruener Abnahme. In der App zeigte
# die Preisschaetzung danach zwei Tage lang fuer E-Bike und Cargo nichts.
schritt "Breitenregel der Preisschaetzung"
if python3 tools/breitenregel_pruefen.py >/tmp/abnahme-breite.log 2>&1; then
  ergebnis 0 "$(sed -n '2p' /tmp/abnahme-breite.log | sed 's/^ *//')"
else
  ergebnis 1 "Notebook, CHECK und Lader sagen nicht dasselbe"
  grep -A1 'FEHLER' /tmp/abnahme-breite.log | head -12 | sed 's/^/     /'
fi

# ------------------------------ 7c Vollstaendigkeit der Diagramme
# erd_check.py hat einen blinden Fleck: Es vergleicht Beziehungen, und
# eine Tabelle ohne Fremdschluessel hat keine. velocity.preisschaetzung
# fehlte deshalb zwei Tage in jedem Diagramm, ohne dass eine Pruefung
# etwas gemeldet haette - und drei weitere standen nie darin.
schritt "Jede Tabelle in einem Diagramm"
if python3 tools/erd_vollstaendig.py >/tmp/abnahme-erdvoll.log 2>&1; then
  ergebnis 0 "$(tail -1 /tmp/abnahme-erdvoll.log)"
else
  ergebnis 1 "Diagramme bilden das Modell nicht vollstaendig ab"
  grep -A1 '^  FEHLER' /tmp/abnahme-erdvoll.log | head -20 | sed 's/^/     /'
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

# Kein Pruefpunkt sah je die Bilder an. Deshalb blieb wochenlang
# unbemerkt, dass die Freistellung die Speichen zerriss - aufgefallen ist
# es erst dem Nutzer, an einem grossen Bildschirm.
# Zahlen wandern: sie stehen in der Datenbank, im Test, auf der Seite, in
# der Anleitung und im Vortrag - und wenn sich eine aendert, aendern sich
# selten alle fuenf. Die Datenbank ist die Quelle, der Text folgt ihr.
schritt "Zahlen in Anleitung und Vortrag gegen die Datenbank"
if python3 tools/zahlen_gegen_db.py >/tmp/abnahme-zahlen-db.log 2>&1; then
  ergebnis 0 "$(grep -c '✓' /tmp/abnahme-zahlen-db.log) Abgleiche stimmen"
else
  ergebnis 1 "Zahlen weichen von der Datenbank ab"
  grep '✗' /tmp/abnahme-zahlen-db.log | sed 's/^/     /'
fi

# ------------------------- Statusangaben der Anleitungen gegen die Quelle
# Die Statusspalte der Notebook-README nannte am 04.09.2026 fuer vier von
# sechs Notebooks etwas anderes als das Notebook selbst - unter anderem
# "Teilfreigabe (nur CITY)", waehrend die Preisschaetzung laengst alle drei
# Radtypen abdeckt. Keine Zahl war je falsch gerechnet; sie waren alle
# einmal richtig und sind stehengeblieben.
# ------------------- Sind die abgelegten Notebooks frisch gebaut?
# Sie tragen ihre Ausgaben mit sich, damit auf GitHub jedes Ergebnis ohne
# Rechnen lesbar ist. Wer eines lokal oeffnet und Zellen ausfuehrt,
# schreibt hinein. Am 04.09.2026 lag genau so ein Stand im Arbeitsbaum:
# Notebook 1 mit Zaehlern ab 7 und 862 verlorenen Ausgabezeilen.
schritt "Notebooks stammen aus einem sauberen Lauf"
if python3 tools/notebooks_frisch_gebaut.py >/tmp/abnahme-nbfrisch.log 2>&1; then
  ergebnis 0 "$(tail -1 /tmp/abnahme-nbfrisch.log | sed 's/^ *//')"
else
  ergebnis 1 "ein Notebook ist von Hand gerechnet worden"
  grep -A1 'FEHLER' /tmp/abnahme-nbfrisch.log | head -12 | sed 's/^/     /'
fi

schritt "Anleitungen gegen ihre Quelle"
if python3 tools/readme_pruefen.py >/tmp/abnahme-readme.log 2>&1; then
  ergebnis 0 "$(tail -1 /tmp/abnahme-readme.log | sed 's/^ *//')"
else
  ergebnis 1 "Anleitung nennt etwas anderes als die Quelle"
  grep -A1 'FEHLER' /tmp/abnahme-readme.log | head -12 | sed 's/^/     /'
fi

# Der MCP-Server nennt 18 Sichten und 15 api_-Funktionen von Hand. Ein
# Werkzeug, dessen Funktion es nicht mehr gibt, faellt nicht beim Bauen
# auf, sondern erst, wenn ein Agent es mitten in einer Vorfuehrung ruft.
schritt "MCP-Server gegen die Datenbank"
if python3 tools/mcp_check.py >/tmp/abnahme-mcp.log 2>&1; then
  ergebnis 0 "$(tail -1 /tmp/abnahme-mcp.log | sed 's/^ *//')"
else
  ergebnis 1 "Ein Werkzeug zeigt auf ein Objekt, das es nicht gibt"
  grep -A1 'FEHLER' /tmp/abnahme-mcp.log | head -12 | sed 's/^/     /'
fi

schritt "Freisteller gegen die Vorlage"
if python3 tools/freisteller_pruefen.py >/tmp/abnahme-frei.log 2>&1; then
  ergebnis 0 "$(grep -c '✓' /tmp/abnahme-frei.log) Messungen an drei Raedern"
else
  ergebnis 1 "Freisteller weichen von der Vorlage ab"
  grep '✗' /tmp/abnahme-frei.log | sed 's/^/     /'
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

# ------------------------- Ist der geprueft Stand auch der ausgelieferte
# Die Pruefung darueber sagt, dass die Stempel HIER stimmen. Sie sagt
# nichts darueber, ob Besucher diesen Stand bekommen. Am 03.09.2026 wurde
# der Preisschaetzer dreimal repariert und dreimal "laeuft" gemeldet -
# gemessen gegen localhost, waehrend auf bikes.butscher.cloud die alten
# Dateien lagen. Jede Pruefung war gruen, drei Runden lang.
schritt "Ausgelieferter Stand ist der geprüfte"
if python3 tools/ausgeliefert_pruefen.py >/tmp/abnahme-ausg.log 2>&1; then
  ergebnis 0 "$(tail -1 /tmp/abnahme-ausg.log | sed 's/^ *//')"
else
  ergebnis 1 "Live liegt etwas anderes — bash tools/veroeffentlichen.sh"
  grep 'FEHLER' /tmp/abnahme-ausg.log | head -8 | sed 's/^/     /'
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

# --------------------------------------------------------- Website
schritt "Website spricht nur Sichten und api-Funktionen"
dz_log=$(pruefe_direktzugriff "src/supabase.js" "v_" "api_" "")
dz_rc=$?
echo "$dz_log" | grep '^HINWEIS' | sed 's/^/     /'
if [ "$dz_rc" -eq 0 ]; then
  ergebnis 0 "keine Basistabelle, keine fn_-Funktion im Frontend"
else
  ergebnis 1 "Direktzugriff gefunden"
  echo "$dz_log" | grep '^FEHLER' | sed 's/^/     /'
fi
if node --check src/supabase.js 2>/dev/null && node --check src/script.js 2>/dev/null \
   && node --check src/auth.js 2>/dev/null && node --check src/config.js 2>/dev/null; then
  ergebnis 0 "JavaScript syntaktisch in Ordnung"
else
  ergebnis 1 "Syntaxfehler im Frontend"
fi

# ------------------------------------------------------- Foliendeck
schritt "Foliendeck"
if [ -f slides/velocity-datenbankentwurf.pptx ]; then
  if python3 slides/check_deck.py slides/velocity-datenbankentwurf.pptx >/tmp/abnahme-deck.log 2>&1; then
    ergebnis 0 "$(tail -1 /tmp/abnahme-deck.log)"
  else
    ergebnis 1 "Layoutbefunde"
    head -12 /tmp/abnahme-deck.log | sed 's/^/     /'
  fi
  # check_deck.py prueft die Geometrie. Diese zweite Pruefung haelt die
  # Objektzahlen im Deck gegen db/aufbau/*.sql - sie stehen dort von Hand
  # in slides/build_deck.py und veralten still, wenn das Schema waechst.
  if python3 slides/check_deck_schema.py >/tmp/abnahme-deck-schema.log 2>&1; then
    ergebnis 0 "$(tail -1 /tmp/abnahme-deck-schema.log)"
  else
    ergebnis 1 "Objektzahlen im Deck weichen vom Aufbau ab"
    sed -n '2,12p' /tmp/abnahme-deck-schema.log | sed 's/^/     /'
  fi
else
  ergebnis 1 "slides/velocity-datenbankentwurf.pptx fehlt — python3 slides/build_deck.py"
fi

# --------------------------------------------- Passwoerter
schritt "Passwoerter sind von aussen unerreichbar"
KEY=$(grep '^SUPABASE_ANON_KEY=' .env 2>/dev/null | cut -d= -f2-)
URL=$(grep '^SUPABASE_URL=' .env 2>/dev/null | cut -d= -f2-)
# Das Schema auth ist fuer PostgREST nicht freigegeben. Diese Pruefung
# haelt fest, dass das so bleibt - sie ist der Nachweis zu GR17.
# Accept-Profile: auth ist Absicht, nicht Beiwerk: ohne den Header
# fragt PostgREST das Default-Schema "public" ab, in dem "users" gar
# nicht existiert - der Aufruf schluege dann unabhaengig vom
# tatsaechlichen Schutz von auth.users mit 404 fehl und bewiese nichts.
code=$(curl -s -o /dev/null -w '%{http_code}' \
        "$URL/rest/v1/users?select=id" -H "apikey: $KEY" -H "Accept-Profile: auth")
[ "$code" = "200" ] && ergebnis 1 "auth.users antwortet mit 200" \
                    || ergebnis 0 "auth.users nicht erreichbar (HTTP $code)"

# --------------------------------------------- Zahlungsmittel
schritt "Zahlungsmittel bleiben gesperrt"
# Diese Pruefung laeuft mit dem anon-Schluessel, ohne jede Anmeldung -
# und fuer anon fehlt das Recht tatsaechlich, das ist hier korrekt.
# GR17 (Mitarbeitende duerfen Bezahldaten nicht sehen) ist NICHT dieser
# Fall: 0011 gewaehrt authenticated ausdruecklich GRANT SELECT auf
# zahlungsmittel (0011:171, ein Kunde muss sein eigenes lesen koennen),
# das Recht ist also da. Die Trennung zwischen Kunde und Mitarbeitendem
# leistet allein die Zeilenregel zahlungsmittel_eigene - 0017 begruendet
# das auf zwoelf Zeilen. Diese REST-Pruefung sieht davon nichts, weil
# sie ueberhaupt nicht mit einer Mitarbeiter-Anmeldung laeuft; der
# eigentliche GR17-Nachweis steht in
# db/tests/t0019_wawi_logik.sql::test_l_kundenservice_kennt_keine_zahlungsmittel.
# Accept-Profile: velocity aus demselben Grund wie bei Pruefung 19: ohne
# den Header landet die Anfrage im falschen (leeren) Default-Schema und
# der 404 bewiese nichts ueber velocity.zahlungsmittel.
code=$(curl -s -o /dev/null -w '%{http_code}' \
        "$URL/rest/v1/zahlungsmittel?select=zahlungsmittel_id" \
        -H "apikey: $KEY" -H "Accept-Profile: velocity")
[ "$code" = "200" ] && ergebnis 1 "zahlungsmittel antwortet mit 200" \
                    || ergebnis 0 "zahlungsmittel gesperrt (HTTP $code)"

# --------------------------------------------- Basistabellen der WaWi
schritt "Warenwirtschaft spricht keine Basistabelle an"
# Accept-Profile: velocity - siehe Begruendung bei Pruefung 19/20.
# "nicht 200" reicht hier nicht als Beweis: ein PostgREST-Cache-Miss
# (404, "table not found in the schema cache") sieht von aussen genauso
# aus wie ein sauberer Rechteentzug, beweist aber gar nichts - er zeigt
# nur, dass PostgREST die Tabelle noch nicht kennt, nicht dass sie
# gesperrt ist. Bei fehlenden Rechten antwortet PostgREST nachweislich
# mit 401 (siehe zahlungsmittel-Probe in Pruefung 20). Nur ein
# expliziter 401 zaehlt deshalb als Beweis; jeder andere Code als 200
# oder 401 macht die Pruefung selbst rot, statt stillschweigend gruen
# zu werden.
offen=""
unklar=""
for t in mitarbeiter rolle mitarbeiter_rolle schadensmeldung wartungsauftrag \
         fahrrad_ereignis aenderungsprotokoll; do
  code=$(curl -s -o /dev/null -w '%{http_code}' \
          "$URL/rest/v1/$t?select=*&limit=1" -H "apikey: $KEY" -H "Accept-Profile: velocity")
  case "$code" in
    401) ;;
    200) offen="$offen $t" ;;
    *)   unklar="$unklar $t(HTTP $code)" ;;
  esac
done
if [ -n "$offen" ]; then
  ergebnis 1 "erreichbar:$offen"
elif [ -n "$unklar" ]; then
  ergebnis 1 "kein Beweis, HTTP weder 200 noch 401:$unklar"
else
  ergebnis 0 "alle sieben Tabellen antworten mit HTTP 401"
fi

# --------------------------------------------- Sichten ohne Anmeldung
schritt "WaWi-Sichten sind ohne Anmeldung unerreichbar"
# War hier als "liefert []" formuliert: die Annahme, PostgREST melde
# Kunden und Mitarbeitende als dieselbe Rolle an und jede Sicht filtere
# deshalb selbst ueber velocity.hat_rolle auf eine leere Liste herunter.
# Nachgemessen (Gesamtpruefung 25.08.2026): anon hat auf keiner
# v_wawi_-Sicht ueberhaupt ein GRANT SELECT - PostgREST antwortet mit
# HTTP 401 "permission denied for view v_wawi_flotte", bevor die
# Zeilenschranke der Sicht ueberhaupt zum Zug kommt. Das ist die
# staerkere Lage, nicht die schwaechere: eine Sicht, die anon gar nicht
# erreicht, ist besser geschuetzt als eine, die eine leere Liste
# zurueckgibt - eine leere Liste laesst offen, ob das Recht fehlt oder
# die Zeilenschranke nur zufaellig nichts traf. Wie Pruefung 21 zaehlt
# deshalb nur ein expliziter 401 als Beweis.
#
# Bis zur Gesamtpruefung vom 26.08.2026 fragte diese Pruefung nur
# v_wawi_flotte ab - eine von zehn Sichten. Haette sie alle geprueft,
# waere der eigentliche Befund von selbst aufgefallen: v_wawi_modell
# antwortet mit HTTP 404 (PGRST205, "not in schema cache"), nicht mit
# 401, weil sie neu ist und PostgREST seinen Schema-Cache seit ihrer
# Anlage nicht neu geladen hat. Die Liste unten wird deshalb wie bei
# Pruefung 2 und 4 ABGELEITET, nicht aufgezaehlt: sie liest denselben
# "grant select on ... to authenticated"-Block am Ende von
# db/aufbau/0019_wawi_logik.sql, der auch tatsaechlich bestimmt, welche
# Sicht authenticated erreichen darf. v_wawi_fahrt_km steht dort
# ABSICHTLICH nicht (siehe Kommentar dort: Bewegungsprofil, ihr wurde
# das Recht mit einem revoke wieder entzogen) und taucht deshalb hier
# zu Recht nicht auf - sie soll fuer niemanden ohne eigene Rolle
# erreichbar sein, ihre Abwesenheit in dieser Liste ist kein Fehler.
sichten=$(python3 - <<'PY'
import re
text = open('db/aufbau/0019_wawi_logik.sql', encoding='utf-8').read()
text = re.sub(r'--[^\n]*', '', text)   # Zeilenkommentare raus, sonst zaehlen Beispielnamen darin mit
treffer = re.search(r'grant\s+select\s+on\s+([^;]*?)\s+to\s+authenticated\s*;', text, re.S)
if treffer:
    for name in re.findall(r'velocity\.(v_wawi_\w+)', treffer.group(1)):
        print(name)
PY
)
if [ -z "$sichten" ]; then
  ergebnis 1 "kein grant-Block mit v_wawi_-Sichten gefunden - Pruefung haette nichts geprueft"
else
  offen=""
  unklar=""
  for s in $sichten; do
    code=$(curl -s -o /dev/null -w '%{http_code}' \
            "$URL/rest/v1/$s?select=*&limit=1" \
            -H "apikey: $KEY" -H "Accept-Profile: velocity")
    case "$code" in
      401) ;;
      200) offen="$offen $s" ;;
      *)   unklar="$unklar $s(HTTP $code)" ;;
    esac
  done
  anzahl=$(echo "$sichten" | wc -w | tr -d ' ')
  if [ -n "$offen" ]; then
    ergebnis 1 "ohne Anmeldung erreichbar:$offen"
  elif [ -n "$unklar" ]; then
    ergebnis 1 "kein Beweis, HTTP weder 200 noch 401:$unklar"
  else
    ergebnis 0 "alle $anzahl Sichten antworten mit HTTP 401"
  fi
fi

# --------------------------------------------- Rechenannahmen
schritt "Jede Rechenannahme nennt ihre Quelle"
# Eine Zahl ohne Herkunft ist eine Behauptung. Der CHECK-Constraint
# rechenannahme_quelle_chk weist eine leere Quelle bereits ab; diese
# Pruefung ist die zweite Sperre und faellt auf, wenn der Constraint
# je verschwindet. Nachgemessen: ein INSERT mit leerer Quelle scheitert
# schon am Constraint, bevor diese Abfrage je eine Zeile sieht - erst
# nach probeweisem DROP CONSTRAINT liess sich der Zaehler auf 1 heben.
# Genau das macht diese Pruefung zur zweiten, nicht zur einzigen Sperre.
n=$(python3 - <<'PYEOF'
import os, psycopg
for z in open('.env', encoding='utf-8'):
    z = z.strip()
    if z and not z.startswith('#') and '=' in z:
        k, v = z.split('=', 1); os.environ.setdefault(k, v)
c = psycopg.connect(host=os.environ['PGHOST'], port=os.environ['PGPORT'],
                    dbname=os.environ['PGDATABASE'], user=os.environ['PGUSER'],
                    password=os.environ['PGPASSWORD']).cursor()
c.execute("select count(*) from velocity.rechenannahme "
          "where quelle is null or btrim(quelle) = ''")
print(c.fetchone()[0])
PYEOF
)
[ "$n" = "0" ] && ergebnis 0 "alle Annahmen mit Quelle" \
               || ergebnis 1 "$n Annahmen ohne Quelle"

# --------------------------------------------- Kundensicht
schritt "Ein angemeldeter Kunde sieht seine eigenen Fahrten"
# Diese Pruefung gibt es, weil genau hier eine Luecke klaffte: der
# Rechteentzug in 0017 riss die Grants mit, die 0011 fuer die
# "eigene Zeilen"-Regeln vergeben hatte. v_meine_ausleihe laeuft mit
# security_invoker = true und braucht die Rechte des Aufrufers.
# Bemerkt hat es weder die Testkette noch der REST-Test mit anon-Key,
# sondern erst ein SET ROLE authenticated in einer Pruefung.
n=$(python3 - <<'PYEOF'
import os, psycopg
for z in open('.env', encoding='utf-8'):
    z = z.strip()
    if z and not z.startswith('#') and '=' in z:
        k, v = z.split('=', 1); os.environ.setdefault(k, v)
con = psycopg.connect(host=os.environ['PGHOST'], port=os.environ['PGPORT'],
                      dbname=os.environ['PGDATABASE'], user=os.environ['PGUSER'],
                      password=os.environ['PGPASSWORD'])
c = con.cursor()
try:
    c.execute('set local role authenticated')
    for sicht in ('v_meine_ausleihe', 'v_meine_rechnung', 'v_mein_profil'):
        c.execute(f'select count(*) from velocity.{sicht}')
    print('0')
except Exception as e:
    print(str(e).split(chr(10))[0])
finally:
    con.rollback()
PYEOF
)
[ "$n" = "0" ] && ergebnis 0 "v_meine_ausleihe, v_meine_rechnung und v_mein_profil sind lesbar" \
               || ergebnis 1 "$n"

# --------------------------------------------- Funktionsrechte
schritt "Keine Funktion ist versehentlich fuer jeden ausfuehrbar"
# PostgreSQL gibt jeder neu angelegten Funktion implizit EXECUTE an
# PUBLIC. Die Zeile "alter default privileges" in 0011 faengt das
# NICHT ab - in Aufgabe 5 nachgemessen. Es bleibt der explizite
# revoke, und er wirkt nur, wenn er nach der letzten Funktion laeuft.
n=$(python3 - <<'PYEOF'
import os, psycopg
for z in open('.env', encoding='utf-8'):
    z = z.strip()
    if z and not z.startswith('#') and '=' in z:
        k, v = z.split('=', 1); os.environ.setdefault(k, v)
c = psycopg.connect(host=os.environ['PGHOST'], port=os.environ['PGPORT'],
                    dbname=os.environ['PGDATABASE'], user=os.environ['PGUSER'],
                    password=os.environ['PGPASSWORD']).cursor()
c.execute("""select count(*) from pg_proc p
               join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'velocity'
                and p.proname not like 'api\\_%'
                -- ist_mitarbeiter/hat_rolle/fn_luftlinie_km: dieselbe
                -- dokumentierte Ausnahme wie in
                -- test_s_keine_oeffentliche_funktion
                -- (db/tests/t0011_sicherheit.sql) - eine Sicht traegt
                -- nicht die Rechte ihres Eigentuemers, deshalb muessen
                -- alle drei fuer authenticated ausfuehrbar sein, damit
                -- die v_wawi_*-Sichten ueberhaupt laufen. Alle drei sind
                -- security definer; die ersten beiden geben
                -- ausschliesslich ueber den Aufrufer selbst Auskunft,
                -- fn_luftlinie_km berechnet eine Formel aus vier
                -- numeric-Parametern und liest keine Tabelle.
                and p.proname not in ('ist_mitarbeiter', 'hat_rolle', 'fn_luftlinie_km')
                and (p.proacl is null
                     or exists (select 1 from aclexplode(p.proacl) a
                                 join pg_roles r on r.oid = a.grantee
                                where r.rolname in ('anon','authenticated')))""")
print(c.fetchone()[0])
PYEOF
)
[ "$n" = "0" ] && ergebnis 0 "nur api_-Funktionen sind freigegeben" \
               || ergebnis 1 "$n Nicht-api-Funktion(en) fuer anon oder authenticated ausfuehrbar"

# Gesamtpruefung Punkt 7: die Abfrage oben schliesst api_* VOLLSTAENDIG
# aus - sie haette also nie bemerkt, wenn eine api_-Funktion fuer anon
# ausfuehrbar wuerde. api_-Funktionen sind die einzigen, die vom Browser
# erreichbar sind (anon ist der oeffentliche Schluessel ohne Anmeldung);
# authenticated soll sie ausfuehren, anon nicht.
n2=$(python3 - <<'PYEOF'
import os, psycopg
for z in open('.env', encoding='utf-8'):
    z = z.strip()
    if z and not z.startswith('#') and '=' in z:
        k, v = z.split('=', 1); os.environ.setdefault(k, v)
c = psycopg.connect(host=os.environ['PGHOST'], port=os.environ['PGPORT'],
                    dbname=os.environ['PGDATABASE'], user=os.environ['PGUSER'],
                    password=os.environ['PGPASSWORD']).cursor()
c.execute("""select count(*) from pg_proc p
               join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'velocity'
                and p.proname like 'api\\_%'
                and exists (select 1 from aclexplode(p.proacl) a
                             join pg_roles r on r.oid = a.grantee
                            where r.rolname = 'anon')""")
print(c.fetchone()[0])
PYEOF
)
[ "$n2" = "0" ] && ergebnis 0 "keine api_-Funktion fuer anon ausfuehrbar" \
                || ergebnis 1 "$n2 api_-Funktion(en) fuer anon ausfuehrbar"

# --------------------------------------------- Radstatus
schritt "Radstatus und offene Ausleihen stimmen ueberein"
# Genau dieser Widerspruch lag 37-fach in den uebernommenen Daten und
# fiel nie auf, weil keine Oberflaeche beides nebeneinander zeigte.
n=$(python3 - <<'PYEOF'
import os, psycopg
for z in open('.env', encoding='utf-8'):
    z = z.strip()
    if z and not z.startswith('#') and '=' in z:
        k, v = z.split('=', 1); os.environ.setdefault(k, v)
c = psycopg.connect(host=os.environ['PGHOST'], port=os.environ['PGPORT'],
                    dbname=os.environ['PGDATABASE'], user=os.environ['PGUSER'],
                    password=os.environ['PGPASSWORD']).cursor()
c.execute("""select count(*) from velocity.fahrrad f
              where (f.status = 'ausgeliehen') <> exists (
                select 1 from velocity.ausleihe a
                 where a.fahrrad_id = f.fahrrad_id and a.status = 'aktiv')""")
print(c.fetchone()[0])
PYEOF
)
[ "$n" = "0" ] && ergebnis 0 "kein Rad mit widerspruechlichem Status" \
               || ergebnis 1 "$n Raeder mit widerspruechlichem Status"

# --------------------------------------------- Fahruntauglich nicht verfuegbar
schritt "Kein Rad mit offener fahruntauglicher Meldung ist verfuegbar"
# Gegenstueck zu 26: api_rad_status_setzen liess ein Rad ungeprueft auf
# 'verfuegbar', selbst mit einer offenen fahruntauglichen Meldung. Diese
# sechs Zeilen haetten den Befund gefunden.
n=$(python3 - <<'PYEOF'
import os, psycopg
for z in open('.env', encoding='utf-8'):
    z = z.strip()
    if z and not z.startswith('#') and '=' in z:
        k, v = z.split('=', 1); os.environ.setdefault(k, v)
c = psycopg.connect(host=os.environ['PGHOST'], port=os.environ['PGPORT'],
                    dbname=os.environ['PGDATABASE'], user=os.environ['PGUSER'],
                    password=os.environ['PGPASSWORD']).cursor()
c.execute("""select count(*) from velocity.fahrrad f
              where f.status = 'verfuegbar' and exists (
                select 1 from velocity.schadensmeldung sm
                 where sm.fahrrad_id = f.fahrrad_id and sm.schwere = 'fahruntauglich'
                   and sm.status in ('offen', 'in_arbeit'))""")
print(c.fetchone()[0])
PYEOF
)
[ "$n" = "0" ] && ergebnis 0 "kein fahruntaugliches Rad auf verfuegbar" \
               || ergebnis 1 "$n Rad/Raeder fahruntauglich, aber verfuegbar"

# --------------------------------------------- WaWi-Vertrag
schritt "Warenwirtschaft: Vertrag zwischen HTML und JavaScript"
if python3 tools/wawi_check.py >/tmp/abnahme-wawi.log 2>&1; then
  ergebnis 0 "$(grep -c '^  ok' /tmp/abnahme-wawi.log) Punkte nachgeprueft"
else
  ergebnis 1 "$(grep -c '^  FEHL' /tmp/abnahme-wawi.log) Punkt(e) offen"
  grep '^  FEHL' /tmp/abnahme-wawi.log | head -10 | sed 's/^/     /'
fi

# --------------------------------------------- WaWi spricht nur Sichten
schritt "Warenwirtschaft spricht nur Sichten und api-Funktionen"
# Dieselbe Regel wie fuer die Website, und derselbe Test (siehe
# pruefe_direktzugriff oben) - nur gegen wawi/*.js. Ein Zugriff auf eine
# Basistabelle waere hier gefaehrlicher als dort: die Warenwirtschaft
# sieht Personendaten.
dz_log=$(pruefe_direktzugriff "$(printf '%s\n' wawi/*.js)" "v_wawi" "api_" "ist_mitarbeiter,hat_rolle")
dz_rc=$?
echo "$dz_log" | grep '^HINWEIS' | sed 's/^/     /'
if [ "$dz_rc" -eq 0 ]; then
  ergebnis 0 "keine Basistabelle, keine fn_-Funktion in der Warenwirtschaft"
else
  ergebnis 1 "Direktzugriff gefunden"
  echo "$dz_log" | grep '^FEHLER' | sed 's/^/     /'
fi

# --------------------------------------------- WaWi erreichbar
schritt "wawi.butscher.cloud antwortet"
code=$(curl -s -o /tmp/wawi.html -w '%{http_code}' https://wawi.butscher.cloud)
if [ "$code" = "200" ] && grep -q "VeloCity Warenwirtschaft" /tmp/wawi.html; then
  ergebnis 0 "erreichbar und liefert die Anmeldeseite"
else
  ergebnis 1 "HTTP $code, Inhalt unerwartet"
fi

# --------------------------------------------- kein Kundenzugang
schritt "Warenwirtschaft weist Nicht-Mitarbeitende ab"
# Der haeufigste Fall und der, den man vergisst: JEDER Kunde kann sich
# anmelden, weil es dieselbe auth.users ist. Die Oberflaeche muss das
# vor dem Aufbau erkennen, nicht danach.
if grep -q "zustand-kein-mitarbeiter" wawi/index.html && \
   grep -q "zustand-kein-mitarbeiter" wawi/rahmen.js; then
  ergebnis 0 "Der Zustand 'kein Mitarbeiter' ist gebaut und wird geschaltet"
else
  ergebnis 1 "Der Zustand 'kein Mitarbeiter' fehlt"
fi

# ------------------------------------------- Lehrmaterial: Text gegen Zahl
#
# Diese beiden Pruefungen sind aus Schaden entstanden. Dreimal ist in
# diesem Projekt eine Aussage stehengeblieben, nachdem sich die Zahl
# darunter geaendert hatte: ein gedrehtes Urteil, dessen Export nicht
# mitzog; ein neu erzeugter Lehrdatensatz, dessen Fliesstext blieb; ein
# Foliensatz, der vier veraltete Zahlen weitertrug. Keiner dieser Fehler
# war ohne maschinellen Abgleich zu sehen.
#
# Eine Aenderung gilt erst als fertig, wenn diese Abnahme gruen ist -
# nicht, wenn die geaenderte Stelle stimmt.

if python3 tools/notebooktexte_pruefen.py >/tmp/abnahme-nbtext.log 2>&1; then
  ergebnis 0 "Jede Zahl im Notebooktext steht auch in einer Ausgabe"
else
  ergebnis 1 "Notebooktexte nennen Zahlen, die nirgends ausgegeben werden"
  sed -n '1,20p' /tmp/abnahme-nbtext.log | sed 's/^/     /'
fi

if python3 tools/daten_abnahme.py >/tmp/abnahme-daten.log 2>&1; then
  ergebnis 0 "Die Musterdaten halten alle Invarianten aus Physik, Bestand und Struktur"
else
  ergebnis 1 "Eine Dateninvariante ist verletzt"
  grep FEHL /tmp/abnahme-daten.log | sed -n '1,12p' | sed 's/^/     /'
fi

if python3 tools/notebook_pruefungen.py >/tmp/abnahme-nbpruef.log 2>&1; then
  ergebnis 0 "Kein Notebook rechnet an einer gespeicherten Groesse vorbei"
else
  ergebnis 1 "Ein Notebook baut eine Logik nach, ohne sie gegen die Daten zu halten"
  grep -A1 FEHLER /tmp/abnahme-nbpruef.log | sed -n '1,12p' | sed 's/^/     /'
fi

if python3 tools/grants_pruefen.py >/tmp/abnahme-grants.log 2>&1; then
  ergebnis 0 "Jedes Recht aus 0011_sicherheit.sql ist in der Datenbank gesetzt"
else
  ergebnis 1 "Ein GRANT steht im Repo, aber nicht in der Datenbank"
  sed -n '1,20p' /tmp/abnahme-grants.log | sed 's/^/     /'
fi

if python3 tools/tote_schwellen_pruefen.py >/tmp/abnahme-gates.log 2>&1; then
  ergebnis 0 "Jedes ausgegebene Urteil haengt an einer Entscheidung im Code"
else
  ergebnis 1 "Ein Erfolgskriterium wird gedruckt, beeinflusst aber nichts"
  sed -n '1,20p' /tmp/abnahme-gates.log | sed 's/^/     /'
fi

if [ -f slides/velocity-crispdm.pptx ]; then
  if python3 tools/folienzahlen_pruefen.py >/tmp/abnahme-folien.log 2>&1; then
    ergebnis 0 "Jede Folienzahl steht im Notebook, das die Folie zitiert"
  else
    ergebnis 1 "Folien nennen Zahlen, die ihr Notebook nicht hergibt"
    sed -n '1,20p' /tmp/abnahme-folien.log | sed 's/^/     /'
  fi
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
# Der abgemeldete Teil ist inzwischen aufgezeichnet, nicht nur beschrieben.
# Was wirklich eine Person braucht, ist der angemeldete Ablauf: Dafuer
# muss ein Konto angelegt und ein Passwort eingegeben werden.
printf '%s  Offen ist davon nur der ANGEMELDETE Ablauf (Registrierung, Anmeldung,%s\n' "$grau" "$aus"
printf '%s  Ausleihe starten und beenden). Oeffentliche Ansicht und Zugriffsschutz%s\n' "$grau" "$aus"
printf '%s  sind aufgezeichnet in doku/verifikation/2026-09-03-e2e-protokoll.md.%s\n' "$grau" "$aus"
printf '%s  Die Fachlogik dahinter ohne Klicken: python3 db/durchstich.py%s\n' "$grau" "$aus"
exit $([ "$fehler" -gt 0 ] && echo 1 || echo 0)
