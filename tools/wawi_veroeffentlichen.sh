#!/usr/bin/env bash
# =====================================================================
# Die Warenwirtschaft auf wawi.butscher.cloud stellen
#
# GETRENNTER BEHAELTER, EIGENES WERKZEUG
# Dieselbe Machart wie tools/veroeffentlichen.sh (bikes), aber ein
# eigenes Skript statt eines Schalters darin: die Warenwirtschaft ist
# eine andere Anwendung fuer andere Leute und soll sich unabhaengig
# von der Website abschalten und ausliefern lassen.
#
# WAS AUSGELIEFERT WIRD, WIRD ABGELEITET - NICHT AUFGEZAEHLT
# Wie beim Vorbild liest das Werkzeug wawi/index.html und nimmt genau
# das mit, was die Seite einbindet. Eine gepflegte Liste waere nach dem
# naechsten neuen Arbeitsbereich veraltet, ohne dass es auffiele.
#
# KEIN FINGERABDRUCK-SCHRITT WIE BEI BIKES
# wawi/ hat kein tools/versionieren.py - style.css und die Skripte
# tragen kein "?v=" im Namen. Deshalb faellt an dieser Stelle im Vorbild
# der Fingerabdruck-Pruefschritt weg, und deploy/wawi-nginx.conf liefert
# aus demselben Grund kein langes Cache-Alter fuer css/js aus (siehe
# dort). Was hier stattdessen als Schritt 1 steht, ist die Pruefung, die
# fuer die Warenwirtschaft tatsaechlich zaehlt: dass kein Geheimnis im
# Ausgangsmaterial liegt. wawi/config.js traegt bewusst einen oeffent-
# lichen Schluessel; der Auftrag verlangt, dass es GENAU der ist und
# nicht versehentlich der service_role-Schluessel oder ein anderes
# Zugangsdatum mitgeliefert wird.
#
# ZWEI FALLEN, DIE BEI BIKES SCHON EINMAL ZUGESCHLAGEN HABEN
# - rsync -a traegt den Modus des Quellverzeichnisses mit; mktemp -d
#   legt sein Verzeichnis mit Modus 700 an, und nginx laeuft im
#   Behaelter als eigener Benutzer. Ohne den chmod-Lauf danach antwortet
#   die Seite mit 403, obwohl die Dateien angekommen sind.
# - macOS liefert openrsync aus, das --chmod nicht kennt, und Bash 3.2,
#   das kein mapfile kennt. Deshalb der chmod-Lauf per ssh danach statt
#   per rsync-Option, und "while read" statt mapfile beim Einlesen der
#   Dateilisten.
#
# Aufruf:  bash tools/wawi_veroeffentlichen.sh [--trocken]
# =====================================================================
set -euo pipefail

HOST=bot.butscher.cloud
FERN=/opt/wawi-deploy
ADRESSE=https://wawi.butscher.cloud
WURZEL="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TROCKEN=""
[[ "${1:-}" == "--trocken" ]] && TROCKEN="--dry-run"

GRUEN=$'\033[0;32m'; ROT=$'\033[0;31m'; GRAU=$'\033[0;90m'; AUS=$'\033[0m'
schritt() { printf '\n\033[1;34m─── %s \033[0m\n' "$1"; }
gut()     { printf '   %s✓%s %s\n' "$GRUEN" "$AUS" "$1"; }
schlecht(){ printf '   %s✗%s %s\n' "$ROT" "$AUS" "$1"; exit 1; }

cd "$WURZEL"

# ---------------------------------------------------------------------
schritt "1 Kein Geheimnis im Ausgangsmaterial"

# Der anon-Key ist absichtlich oeffentlich, der service_role-Key darf
# niemals in einen Browser gelangen - er umgeht RLS vollstaendig. Beide
# sind JWTs mit einem "role"-Feld im Nutzlast-Teil; das laesst sich
# automatisch pruefen, statt sich auf ein aufmerksames Auge beim naechs-
# ten Schluesseltausch zu verlassen.
JWT=$(grep -oE 'eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+' wawi/config.js | head -1)
[[ -n "$JWT" ]] || schlecht "kein Schluessel in wawi/config.js gefunden"
NUTZLAST=$(printf '%s' "$JWT" | cut -d. -f2 | tr '_-' '/+')
case $(( ${#NUTZLAST} % 4 )) in
  2) NUTZLAST="${NUTZLAST}==" ;;
  3) NUTZLAST="${NUTZLAST}=" ;;
esac
ROLLE=$(printf '%s' "$NUTZLAST" | base64 -d 2>/dev/null | grep -oE '"role":"[a-z_]+"' || true)
[[ "$ROLLE" == '"role":"anon"' ]] \
  || schlecht "wawi/config.js traegt keinen anon-Key (gefunden: ${ROLLE:-nichts lesbares})"
gut "config.js traegt den oeffentlichen anon-Key, keinen service_role-Key"

# Nichts aus db/ oder doku/ und keine .env darf mitgehen. Die Schleife
# unten (Schritt 2) kann das ohnehin nicht, weil sie nur kopiert, was
# wawi/index.html einbindet - diese Pruefung faengt den Fall ab, dass
# jemand von Hand eine fremde Datei nach wawi/ gelegt hat.
[[ -f wawi/.env ]] && schlecht "wawi/.env liegt im Quellverzeichnis - darf nicht ausgeliefert werden"
if grep -rIlE 'service_role|SERVICE_ROLE|PGPASSWORD|postgres(ql)?://[^"'"'"' ]*:[^"'"'"' ]*@' wawi/ >/dev/null 2>&1; then
  schlecht "verdaechtiger Zugangsdaten-Fund unter wawi/ - vor dem Ausliefern pruefen"
fi
gut "keine Zugangsdaten im Quellverzeichnis gefunden"

# ---------------------------------------------------------------------
schritt "2 Auszuliefernde Dateien ermitteln"
BAU="$(mktemp -d)"
trap 'rm -rf "$BAU"' EXIT

# Die Seite selbst. Ein Array wie beim Vorbild, auch wenn es bislang nur
# ein Element hat - die Warenwirtschaft ist eine Sitzung mit fuenf
# Zustaenden, keine Mehrseitenanwendung, aber das kann sich aendern.
SEITEN=(index.html)
for s in "${SEITEN[@]}"; do cp "wawi/$s" "$BAU/"; done

# Alles, was die Seite an eigenem CSS/JS einbindet (Fingerabdruck ab-
# schneiden, falls es ihn eines Tages doch gibt). Was von einem fremden
# Server kommt (supabase-js liegt auf jsdelivr), faellt heraus - es
# liegt hier gar nicht und muss nicht mitgeliefert werden.
# Einfache UND doppelte Anfuehrungszeichen: ein <script src='...'> mit
# einfachen fiel durch das alte, nur-doppelte Muster lautlos durch -
# nicht ausgeliefert, in Schritt 5 nicht geprueft, kein Abbruch, keine
# Meldung, die Seite im Browser kaputt trotz gemeldetem Erfolg.
# Kein mapfile: macOS liefert Bash 3.2 aus.
CODE_DATEIEN="$(grep -ohE "(src|href)=[\"'][^\"']+\.(js|css)(\?v=[0-9a-f]+)?[\"']" wawi/index.html \
         | sed -E "s/.*[\"']([^\"'?]+).*/\1/" \
         | grep -vE '^(https?:)?//' \
         | sort -u)"
ANZ_CODE=0
while IFS= read -r d; do
  [[ -z "$d" ]] && continue
  [[ -f "wawi/$d" ]] || schlecht "$d wird eingebunden, fehlt aber in wawi/"
  cp "wawi/$d" "$BAU/"
  ANZ_CODE=$((ANZ_CODE + 1))
done <<< "$CODE_DATEIEN"

# Gegenprobe zur Ableitung: eine Liste, die etwas NICHT findet, sieht
# genauso leer aus wie eine, bei der es nicht da ist. Deshalb zusaetz-
# lich pruefen, dass jede lokale .js-Datei in wawi/ (config.js einge-
# schlossen) auch tatsaechlich von der Seite eingebunden wird - sonst
# faellt ein vergessenes <script>-Tag erst im Browser auf, nicht hier.
while IFS= read -r js; do
  [[ -z "$js" ]] && continue
  grep -qxF "$js" <<< "$CODE_DATEIEN" \
    || schlecht "wawi/$js liegt vor, wird aber von keiner Seite eingebunden"
done < <(cd wawi && ls -1 *.js 2>/dev/null | sort -u)

mkdir -p "$BAU/assets"
ANZ_BILD=0
while IFS= read -r b; do
  [[ -z "$b" ]] && continue
  [[ -f "wawi/$b" ]] || schlecht "$b wird verwendet, fehlt aber in wawi/"
  cp "wawi/$b" "$BAU/assets/"
  ANZ_BILD=$((ANZ_BILD + 1))
done < <(grep -ohE 'assets/[A-Za-z0-9_./-]+\.[A-Za-z0-9]+' \
         wawi/*.html wawi/*.css wawi/*.js | sed 's/?.*//' | sort -u)

GROESSE=$(du -sh "$BAU" | cut -f1)
gut "$(( ${#SEITEN[@]} + ANZ_CODE )) Dateien Code, $ANZ_BILD Bilder ${GRAU}(zusammen $GROESSE)${AUS}"

# ---------------------------------------------------------------------
schritt "3 Auf den Server"
# mkdir und beide scp aendern den Server sofort - sie muessen daher
# HINTER der Trockenlauf-Weiche stehen, nicht nur der rsync-Aufruf.
# Gemessen, nicht vermutet: vor dieser Korrektur lagen unter
# /opt/wawi-deploy/ bereits docker-compose.yml, nginx.conf und ein
# leeres site/ - obwohl dieses Skript nie ohne --trocken lief. --trocken
# hatte nur den rsync stumm geschaltet, mkdir/scp liefen immer.
if [[ -z "$TROCKEN" ]]; then
  ssh "$HOST" "mkdir -p $FERN/site"
  scp -q deploy/wawi-nginx.conf "$HOST:$FERN/nginx.conf"
  scp -q deploy/wawi-compose.yml "$HOST:$FERN/docker-compose.yml"
fi
# --delete: was hier nicht mehr gebraucht wird, liegt dort auch nicht
# mehr herum.
rsync -rltz --delete $TROCKEN "$BAU/" "$HOST:$FERN/site/"
if [[ -n "$TROCKEN" ]]; then
  gut "Probelauf: mkdir, scp, rsync (simuliert) und Behaelter-Start haben nichts geschrieben"
  # Nicht nur "nichts geschrieben" behaupten, sondern auch sagen, was
  # dieser Trockenlauf NICHT geprueft hat: er bricht per exit 0 ab,
  # bevor Schritt 5 je laeuft. Die Gegenprobe von aussen (HTTP-Status,
  # Titel im HTML, jedes Skript einzeln) findet also nie statt.
  printf '   %s!%s ungeprueft: die Gegenprobe von aussen (Schritt 5) laeuft im Trockenlauf nie\n' "$ROT" "$AUS"
  exit 0
fi

# Rechte gehoeren zum Ziel, nicht zur Quelle - siehe Kopf dieser Datei.
ssh "$HOST" "chmod -R a+rX $FERN/site"
gut "abgelegt in $FERN/site"

# ---------------------------------------------------------------------
schritt "4 Behaelter"
ssh "$HOST" "cd $FERN && docker compose up -d" >/dev/null 2>&1
ZUSTAND=$(ssh "$HOST" "docker inspect wawi --format '{{.State.Status}}'")
[[ "$ZUSTAND" == "running" ]] || schlecht "Behaelter ist $ZUSTAND"
gut "wawi laeuft"

# ---------------------------------------------------------------------
schritt "5 Gegenprobe von aussen"
for versuch in 1 2 3 4 5 6 7 8; do
  CODEHTTP=$(curl -s -o /dev/null -w '%{http_code}' "$ADRESSE/" || true)
  [[ "$CODEHTTP" == "200" ]] && break
  sleep 5   # Traefik holt beim ersten Mal ein Zertifikat
done
[[ "$CODEHTTP" == "200" ]] || schlecht "$ADRESSE antwortet mit $CODEHTTP"
gut "$ADRESSE antwortet mit 200"

# Eine Anmeldeseite antwortet auch dann mit 200, wenn dahinter nichts
# funktioniert - der Titel im ausgelieferten HTML ist der billigste
# Beleg, dass tatsaechlich die WaWi-Seite ankommt und nicht etwa eine
# falsch gemountete site/ oder eine Traefik-Fehlerseite.
HTML=$(curl -s "$ADRESSE/")
echo "$HTML" | grep -q "VeloCity Warenwirtschaft" \
  || schlecht "ausgeliefertes HTML enthaelt nicht 'VeloCity Warenwirtschaft'"
gut "HTML enthaelt den erwarteten Titel"

WEITER=$(curl -s -o /dev/null -w '%{http_code}' "http://wawi.butscher.cloud/" || true)
# Traefiks redirectscheme antwortet mit 302, nicht mit 301.
[[ "$WEITER" == "301" || "$WEITER" == "302" || "$WEITER" == "308" ]] \
  || schlecht "http://wawi.butscher.cloud verweist nicht auf https (antwortet mit $WEITER)"
gut "HTTP verweist auf HTTPS ${GRAU}($WEITER)${AUS}"

# Die Skriptliste kommt aus $CODE_DATEIEN (Schritt 2), nicht aus einer
# zweiten eigenen Ableitung hier - zwei Stellen, die dieselbe Liste aus
# index.html herleiten, laufen sonst irgendwann auseinander (z.B. wenn
# nur eine von beiden auf einfache Anfuehrungszeichen erweitert wird).
while IFS= read -r skript; do
  [[ -z "$skript" ]] && continue
  CODE=$(curl -s -o /dev/null -w '%{http_code}' "$ADRESSE/$skript" || true)
  [[ "$CODE" == "200" ]] \
    && gut "$skript antwortet mit 200" \
    || schlecht "$skript antwortet mit $CODE"
done <<< "$CODE_DATEIEN"

printf '\n%sSteht: %s%s\n\n' "$GRUEN" "$ADRESSE" "$AUS"
