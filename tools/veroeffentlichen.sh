#!/usr/bin/env bash
# =====================================================================
# Die Startseite auf bikes.butscher.cloud stellen
#
# WAS AUSGELIEFERT WIRD, WIRD ABGELEITET - NICHT AUFGEZAEHLT
# In src/ liegen 17 MB, ausgeliefert werden 1,6. Der Unterschied sind
# die Vorlagen der Raeder (4K-Aufnahmen), die alten Aufnahmen vor der
# Betonwand und totes JavaScript. Eine Liste im Skript waere nach dem
# naechsten Umbau falsch, ohne dass es jemand merkt. Deshalb liest das
# Werkzeug die Seiten und nimmt genau das mit, was sie einbinden.
#
# VORHER WIRD GEPRUEFT, NACHHER GEGENGEPRUEFT
# Vorher: stimmen die Fingerabdruecke? Ein veralteter Stempel heisst,
# dass Besucher alte Dateien aus ihrem Zwischenspeicher bekommen.
# Nachher: antwortet die Adresse mit 200, und steht im ausgelieferten
# HTML derselbe Fingerabdruck wie hier?
#
# Aufruf:  bash tools/veroeffentlichen.sh [--trocken]
# =====================================================================
set -euo pipefail

HOST=bot.butscher.cloud
FERN=/opt/bikes-deploy
ADRESSE=https://bikes.butscher.cloud
WURZEL="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TROCKEN=""
[[ "${1:-}" == "--trocken" ]] && TROCKEN="--dry-run"

GRUEN=$'\033[0;32m'; ROT=$'\033[0;31m'; GRAU=$'\033[0;90m'; AUS=$'\033[0m'
schritt() { printf '\n\033[1;34m─── %s \033[0m\n' "$1"; }
gut()     { printf '   %s✓%s %s\n' "$GRUEN" "$AUS" "$1"; }
schlecht(){ printf '   %s✗%s %s\n' "$ROT" "$AUS" "$1"; exit 1; }

cd "$WURZEL"

# ---------------------------------------------------------------------
schritt "1 Fingerabdruecke"
if python3 tools/versionieren.py --pruefen >/dev/null 2>&1; then
  gut "alle Stempel aktuell"
else
  schlecht "Stempel veraltet — erst 'python3 tools/versionieren.py' laufen lassen"
fi

# ---------------------------------------------------------------------
schritt "2 Auszuliefernde Dateien ermitteln"
BAU="$(mktemp -d)"
trap 'rm -rf "$BAU"' EXIT

# Die Seiten selbst.
SEITEN=(index.html rechtliches.html)
for s in "${SEITEN[@]}"; do cp "src/$s" "$BAU/"; done

# Alles, was die Seiten einbinden (Fingerabdruck abschneiden), und
# alles, was Seiten, Stil und Skripte an Bildern nennen. Was von einem
# fremden Server kommt (Leaflet und Toastify liegen auf jsdelivr und
# unpkg), faellt heraus - es liegt hier gar nicht.
# Einfache UND doppelte Anfuehrungszeichen: ein <script src='...'> mit
# einfachen fiel durch das alte, nur-doppelte Muster lautlos durch -
# nicht ausgeliefert, kein Abbruch, keine Meldung.
# Kein mapfile: macOS liefert Bash 3.2 aus, und das Werkzeug soll auf
# dem Rechner laufen, auf dem es gebraucht wird.
ANZ_CODE=0
while IFS= read -r d; do
  [[ -z "$d" ]] && continue
  [[ -f "src/$d" ]] || schlecht "$d wird eingebunden, fehlt aber in src/"
  cp "src/$d" "$BAU/"
  ANZ_CODE=$((ANZ_CODE + 1))
done < <(grep -ohE "(src|href)=[\"'][^\"']+\.(js|css)(\?v=[0-9a-f]+)?[\"']" src/*.html \
         | sed -E "s/.*[\"']([^\"'?]+).*/\1/" \
         | grep -vE '^(https?:)?//' \
         | sort -u)

mkdir -p "$BAU/assets"
ANZ_BILD=0
while IFS= read -r b; do
  [[ -z "$b" ]] && continue
  [[ -f "src/$b" ]] || schlecht "$b wird verwendet, fehlt aber in src/"
  cp "src/$b" "$BAU/assets/"
  ANZ_BILD=$((ANZ_BILD + 1))
done < <(grep -ohE 'assets/[A-Za-z0-9_./-]+\.[A-Za-z0-9]+' \
         src/*.html src/*.css src/*.js | sed 's/?.*//' | sort -u)

GROESSE=$(du -sh "$BAU" | cut -f1)
gut "$(( ${#SEITEN[@]} + ANZ_CODE )) Dateien Code, $ANZ_BILD Bilder ${GRAU}(zusammen $GROESSE, src/ hat 17M)${AUS}"

# ---------------------------------------------------------------------
schritt "3 Auf den Server"
# mkdir und beide scp aendern den Server sofort - sie muessen daher
# HINTER der Trockenlauf-Weiche stehen, nicht nur der rsync-Aufruf.
# Gemessen am Schwesterskript (tools/wawi_veroeffentlichen.sh): dort
# lagen nach reinen --trocken-Laeufen bereits docker-compose.yml,
# nginx.conf und ein leeres site/ auf dem Server, obwohl es nie ohne
# --trocken lief - --trocken hatte nur den rsync stumm geschaltet.
# Hier ist die Folge schwerer, weil $FERN eine laufende Website ist:
# wer eine geaenderte deploy/nginx.conf zur sicheren Vorschau trocken
# laufen liesse, haette sie damit veroeffentlicht - ohne je entschieden
# zu haben, live zu gehen.
if [[ -z "$TROCKEN" ]]; then
  ssh "$HOST" "mkdir -p $FERN/site"
  scp -q deploy/nginx.conf "$HOST:$FERN/nginx.conf"
  scp -q deploy/docker-compose.yml "$HOST:$FERN/docker-compose.yml"
fi
# --delete: was hier nicht mehr gebraucht wird, liegt dort auch nicht
# mehr herum. Sonst sammeln sich ueber die Jahre Dateien an, von denen
# niemand weiss, ob sie noch jemand aufruft.
rsync -rltz --delete $TROCKEN "$BAU/" "$HOST:$FERN/site/"
if [[ -n "$TROCKEN" ]]; then
  gut "Probelauf: mkdir, scp, rsync (simuliert) und Behaelter-Start haben nichts geschrieben"
  # Nicht nur "nichts geschrieben" behaupten, sondern auch sagen, was
  # dieser Trockenlauf NICHT geprueft hat: er bricht per exit 0 ab,
  # bevor Schritt 5 je laeuft. Die Gegenprobe von aussen (HTTP-Status,
  # Fingerabdruck-Vergleich, HTTP->HTTPS-Redirect) findet also nie statt.
  printf '   %s!%s ungeprueft: die Gegenprobe von aussen (Schritt 5) laeuft im Trockenlauf nie\n' "$ROT" "$AUS"
  exit 0
fi

# Rechte gehoeren zum Ziel, nicht zur Quelle. Ohne diese Zeile erbt das
# Verzeichnis die 700 des Arbeitsverzeichnisses; der nginx laeuft im
# Behaelter als eigener Benutzer und kommt dann nicht einmal hinein -
# die Seite antwortet mit 403. (rsync --chmod waere der kuerzere Weg,
# aber macOS liefert openrsync aus, und das kennt die Option nicht.)
ssh "$HOST" "chmod -R a+rX $FERN/site"
gut "abgelegt in $FERN/site"

# ---------------------------------------------------------------------
schritt "4 Behaelter"
ssh "$HOST" "cd $FERN && docker compose up -d" >/dev/null 2>&1
ZUSTAND=$(ssh "$HOST" "docker inspect bikes --format '{{.State.Status}}'")
[[ "$ZUSTAND" == "running" ]] || schlecht "Behaelter ist $ZUSTAND"
gut "bikes laeuft"

# ---------------------------------------------------------------------
schritt "5 Gegenprobe von aussen"
for versuch in 1 2 3 4 5 6 7 8; do
  CODEHTTP=$(curl -s -o /dev/null -w '%{http_code}' "$ADRESSE/" || true)
  [[ "$CODEHTTP" == "200" ]] && break
  sleep 5   # Traefik holt beim ersten Mal ein Zertifikat
done
[[ "$CODEHTTP" == "200" ]] || schlecht "$ADRESSE antwortet mit $CODEHTTP"
gut "$ADRESSE antwortet mit 200"

HIER=$(grep -oE 'style\.css\?v=[0-9a-f]+' src/index.html | head -1)
DORT=$(curl -s "$ADRESSE/" | grep -oE 'style\.css\?v=[0-9a-f]+' | head -1)
[[ "$HIER" == "$DORT" ]] || schlecht "ausgeliefert wird $DORT, hier liegt $HIER"
gut "ausgelieferter Stand stimmt ${GRAU}($HIER)${AUS}"

WEITER=$(curl -s -o /dev/null -w '%{http_code}' "http://bikes.butscher.cloud/" || true)
# Traefiks redirectscheme antwortet mit 302, nicht mit 301.
[[ "$WEITER" == "301" || "$WEITER" == "302" || "$WEITER" == "308" ]] \
  && gut "HTTP verweist auf HTTPS ${GRAU}($WEITER)${AUS}" \
  || printf '   %s!%s HTTP antwortet mit %s\n' "$ROT" "$AUS" "$WEITER"

printf '\n%sSteht: %s%s\n\n' "$GRUEN" "$ADRESSE" "$AUS"
