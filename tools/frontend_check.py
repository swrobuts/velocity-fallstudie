#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Prueft den Vertrag zwischen HTML und JavaScript.

Das JavaScript sucht Elemente ueber getElementById und querySelector.
Verschwindet eines beim Umbau, bricht die Seite still: keine
Fehlermeldung, nur eine Kachel, die leer bleibt. Genau das ist beim
Austausch des Kopfbereichs die grosse Gefahr.

Geprueft wird:
  ANKER     jedes getElementById(...) hat ein Ziel im HTML
  KLASSE    jeder querySelector auf eine Klasse hat ein Ziel
  DOPPELT   kein id kommt zweimal vor (der Browser nimmt die erste)
  QUELLE    jede eingebundene Datei existiert
  SCHICHT   das Frontend spricht nur v_-Sichten und api_-Funktionen

Aufruf:  python3 tools/frontend_check.py
"""
import re
import sys
from pathlib import Path

SRC = Path(__file__).resolve().parent.parent / "src"
SKRIPTE = ["script.js", "auth.js", "supabase.js", "config.js"]

# Was das Skript selbst in den Baum haengt, kann im HTML nicht stehen.
# Die Liste bleibt kurz und wird hier gepflegt - sonst waere jede
# dynamische Einblendung ein Dauerbefund.
VOM_SKRIPT_ERZEUGT = {"auth-status-aktion"}

# Klassen, die eine Fremdbibliothek vergibt. Sie stehen nie im HTML,
# und ihr Fehlen waere kein Befund, sondern ein falscher Alarm.
FREMDE_KLASSEN = {"leaflet-popup-close-button", "leaflet-marker-icon",
                  "leaflet-tile", "leaflet-popup"}


def main():
    roh = (SRC / "index.html").read_text(encoding="utf-8")
    # Kommentare zaehlen nicht: ein id, das nur im Kommentar erwaehnt
    # wird, ist kein doppeltes id.
    html = re.sub(r"<!--.*?-->", "", roh, flags=re.S)
    js_roh = "\n".join((SRC / n).read_text(encoding="utf-8") for n in SKRIPTE
                       if (SRC / n).exists())
    # Zwei getrennte Durchgaenge: mit re.S wuerde ".*$" der Zeilenregel
    # den gesamten Rest der Datei verschlucken - der Pruefer wuerde dann
    # alles durchwinken, ohne etwas geprueft zu haben.
    js = re.sub(r"/\*.*?\*/", "", js_roh, flags=re.S)
    js = re.sub(r"^\s*//[^\n]*$", "", js, flags=re.M)
    befunde = []

    # --- Anker -------------------------------------------------------
    vorhanden = re.findall(r'\sid="([^"]+)"', html)
    menge = set(vorhanden)
    for i in sorted(set(re.findall(r"getElementById\(\s*['\"]([^'\"]+)", js))):
        if i not in menge and i not in VOM_SKRIPT_ERZEUGT:
            befunde.append(f'ANKER    #{i} wird gesucht, steht aber nicht im HTML')

    # --- doppelte ids ------------------------------------------------
    for i in sorted(menge):
        if vorhanden.count(i) > 1:
            befunde.append(f'DOPPELT  id="{i}" kommt {vorhanden.count(i)}-mal vor')

    # --- Klassen aus querySelector -----------------------------------
    for s in sorted(set(re.findall(r"querySelector(?:All)?\(\s*['\"]([^'\"]+)", js))):
        m = re.match(r'^\.([A-Za-z0-9_-]+)', s)
        if m and f'class="' not in html:
            continue
        if m and m.group(1) in FREMDE_KLASSEN:
            continue
        if m and not re.search(r'class="[^"]*\b' + re.escape(m.group(1)) + r'\b', html):
            befunde.append(f'KLASSE   {s} wird gesucht, keine Entsprechung im HTML')

    # --- eingebundene Dateien ----------------------------------------
    for pfad in re.findall(r'(?:src|href)="(?!https?:|#|mailto:)([^"]+)"', html):
        # Erst den Sprungpunkt abschneiden, dann die Abfrage: sonst sucht
        # der Pruefer eine Datei namens "rechtliches.html#agb".
        rein = pfad.split("#")[0].split("?")[0]
        if not rein:
            continue
        if not (SRC / rein).exists():
            befunde.append(f'QUELLE   {pfad} eingebunden, Datei fehlt')

    # --- Schichtentrennung -------------------------------------------
    for treffer in re.findall(r"ladeListe\(\s*['\"]([a-z_]+)", js):
        if not treffer.startswith("v_"):
            befunde.append(f'SCHICHT  liest {treffer} statt einer v_-Sicht')
    for treffer in re.findall(r"\.rpc\(\s*['\"]([a-z_]+)", js):
        if not treffer.startswith("api_"):
            befunde.append(f'SCHICHT  ruft {treffer} statt einer api_-Funktion')

    # --- CSS-Merkmale, die das Skript benutzt ------------------------
    # Beim Wechsel der Designsprache blieb ein var(--signal) im
    # SVG-Verlauf des Laengsschnitts stehen. Das faellt optisch kaum
    # auf und ist doch falsch.
    css = (SRC / "style.css").read_text(encoding="utf-8")
    definiert = set(re.findall(r"^\s*(--[a-z0-9-]+)\s*:", css, re.M))
    for m in sorted(set(re.findall(r"var\((--[a-z0-9-]+)\)", js + html))):
        if m not in definiert:
            befunde.append(f'MERKMAL  {m} wird benutzt, ist aber in style.css nicht definiert')

    for b in befunde:
        print(b)
    gesucht = set(re.findall(r"getElementById\(\s*['\"]([^'\"]+)", js))
    if not gesucht:
        print('WARNUNG: kein einziges getElementById gefunden - '
              'der Pruefer haette nichts geprueft.')
        return 1
    print(f'\n{len(menge)} ids im HTML, {len(gesucht)} davon vom Skript gesucht. '
          f'{len(befunde)} Befund(e).')
    return 1 if befunde else 0


if __name__ == "__main__":
    sys.exit(main())
