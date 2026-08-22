#!/usr/bin/env bash
# Rendert alle Mermaid-Quellen nach slides/assets/ als PNG.
#
# Aufruf:  bash tools/render_diagrams.sh
#
# Genutzt wird mermaid-cli mit dem lokal vorhandenen Google Chrome; ein
# eigener Chromium-Download ist damit nicht noetig.
set -euo pipefail
cd "$(dirname "$0")/.."

CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
[ -x "$CHROME" ] || { echo "Chrome nicht gefunden: $CHROME" >&2; exit 1; }

PUP=$(mktemp -t puppeteer-thws-XXXX.json)
printf '{ "executablePath": "%s", "args": ["--no-sandbox","--disable-dev-shm-usage"] }\n' "$CHROME" > "$PUP"
trap 'rm -f "$PUP"' EXIT

mkdir -p slides/assets
fehler=0
for quelle in doku/datenmodell/erd/*.mmd; do
  name=$(basename "$quelle" .mmd)
  ziel="slides/assets/${name}.png"
  if npx --no-install mmdc -i "$quelle" -o "$ziel" -w 2000 -b white \
       -c tools/mermaid-thws.json -p "$PUP" >/dev/null 2>&1; then
    printf 'OK     %-34s -> %s\n' "$name" "$(du -h "$ziel" | cut -f1)"
  else
    printf 'FEHLER %s\n' "$name"; fehler=$((fehler+1))
  fi
done
echo
echo "$fehler Fehler."
exit $([ "$fehler" -gt 0 ] && echo 1 || echo 0)
