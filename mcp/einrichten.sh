#!/usr/bin/env bash
# =====================================================================
# Die virtuelle Umgebung des MCP-Servers anlegen
#
# WARUM EIGEN UND NICHT GLOBAL
#
# Der erste Versuch installierte 'mcp' in die allgemeine Python-Umgebung
# und hob dabei pydantic an - danach passte pydantic nicht mehr zu
# pydantic-core, und jedes Programm, das pydantic benutzte, brach ab.
# Repariert war das in einer Minute, aber der Fehler gehoert nicht
# wiederholt: Ein Lehrprojekt darf die Arbeitsumgebung nicht anfassen,
# in der noch anderes laeuft.
#
# Aufruf: bash mcp/einrichten.sh
# =====================================================================
set -euo pipefail
HIER="$(cd "$(dirname "$0")" && pwd)"

python3 -m venv "$HIER/.venv"
"$HIER/.venv/bin/pip" install --quiet --upgrade pip
"$HIER/.venv/bin/pip" install --quiet -r "$HIER/requirements.txt"

echo "Umgebung steht: $HIER/.venv"
"$HIER/.venv/bin/pip" list 2>/dev/null | grep -iE '^(mcp|httpx) ' | sed 's/^/  /'
echo
echo "Selbsttest:  $HIER/.venv/bin/python $HIER/server.py --pruefen"
echo
echo "In claude_desktop_config.json gehoert genau dieser Python:"
echo "  \"command\": \"$HIER/.venv/bin/python\","
echo "  \"args\": [\"$HIER/server.py\"]"
