#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Haelt die Objektzahlen in velocity-datenbankentwurf.pptx gegen db/aufbau.

WARUM ES DIESE PRUEFUNG BRAUCHT

Die Zahlen dieses Decks sind in slides/build_deck.py von Hand getippt.
Am 01.09.2026 kam die Preisschaetzung dazu - eine Tabelle, eine Sicht,
eine api_-Funktion - und vier Angaben im Deck wurden still falsch:
"27 Tabellen" (28), "Vier weitere api_" (fuenf), "16 Sichten" (17) und
die Spaltenzahl. Aufgefallen ist das erst zwei Tage spaeter bei einer
Pruefung von Hand.

Diese Pruefung liest die Zahlen AUS DEM DECK und zaehlt die Objekte im
Quelltext des Aufbaus nach. Sie prueft damit das ausgelieferte Ergebnis,
nicht die Absicht des Bauers.

Verwandt: tools/erd_vollstaendig.py prueft dieselbe Sorte Luecke an den
Diagrammen. Beide lesen das Schema ueber tools/schema_lesen.py.

ZUM BEZUGSRAHMEN

Gezaehlt wird, was db/aufbau/*.sql anlegt - nichts sonst. Die laufende
Datenbank enthaelt zusaetzlich, was die Skripte in db/betrieb/ erzeugen,
derzeit die Tabelle uebernahme_protokoll mit zehn Spalten. Eine Abfrage
gegen den Systemkatalog liefert deshalb hoehere Werte als diese Pruefung.
Der Bezug auf den Aufbau ist Absicht: er ist versioniert und damit
ueberhaupt pruefbar.

Aufruf: python3 slides/check_deck_schema.py [pfad.pptx]
"""
from __future__ import annotations

import pathlib
import re
import sys

from pptx import Presentation

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent / "tools"))
from schema_lesen import (  # noqa: E402
    FUNKTION, SICHT, TABELLE, WURZEL, namen, spalten_je_tabelle,
)

STANDARD = WURZEL / "slides" / "velocity-datenbankentwurf.pptx"

ZAHLWORT = {"eine": 1, "zwei": 2, "drei": 3, "vier": 4, "fünf": 5, "sechs": 6,
            "sieben": 7, "acht": 8, "neun": 9, "zehn": 10, "elf": 11, "zwölf": 12}


def gezaehlt() -> dict[str, int]:
    sp = spalten_je_tabelle()
    spalten = sum(len(v) for v in sp.values())
    audit = sum(1 for v in sp.values() for c in v if c in ("erstellt_am", "geaendert_am"))
    return {
        "tabellen_a_f": len(namen(TABELLE, 2, 7)),
        "tabellen_f": len(namen(TABELLE, 7, 7)),
        "tabellen": len(namen(TABELLE)),
        "wawi_sichten": len([x for x in namen(SICHT) if x.startswith("v_wawi_")]),
        "wawi_api": len([x for x in namen(FUNKTION, 17, 20) if x.startswith("api_")]),
        "website_api": len([x for x in namen(FUNKTION, 1, 16) if x.startswith("api_")]),
        "spalten": spalten,
        "audit": audit,
        "beschrieben": spalten - audit,
    }


# ------------------------------------------------------- Behauptungen im Deck
#
# (Beschreibung, Muster mit einer Gruppe je Zahl, Schluessel je Gruppe)
# Das Muster wird ueber alle Folien gesucht; findet es sich nirgends, gilt
# die Behauptung als geaendert und wird gemeldet - eine stillschweigend
# verschwundene Aussage soll auffallen.

BEHAUPTUNGEN = [
    ("Tabellen der Bereiche A bis F",
     r"Fachbereiche A bis F, (\d+) Tabellen", ["tabellen_a_f"]),
    ("Tabellen des Bereichs F",
     r"Redaktionsinhalte: warum (\w+) Tabellen", ["tabellen_f"]),
    ("Basistabellen des Aufbaus",
     r"(\d+) Basistabellen legt der Aufbau an", ["tabellen"]),
    ("Spalten und Audit-Spalten",
     r"(\d+) Spalten im Aufbau, (\d+) beschrieben", ["spalten", "beschrieben"]),
    ("technische Audit-Spalten",
     r"(\d+) technische Audit-Spalten", ["audit"]),
    ("Sichten und Funktionen der Warenwirtschaft",
     r"(\d+) Sichten, (\d+) Funktionen", ["wawi_sichten", "wawi_api"]),
    ("api_-Funktionen der Website",
     r"(\w+) weitere api_ dienen der Website", ["website_api"]),
]


def main(argv):
    pfad = pathlib.Path(argv[0]) if argv else STANDARD
    if not pfad.exists():
        print(f"Deck fehlt: {pfad}")
        return 2
    ist = gezaehlt()
    text = "\n".join(f.text_frame.text for folie in Presentation(str(pfad)).slides
                     for f in folie.shapes if f.has_text_frame)

    funde = []
    for was, muster, schluessel in BEHAUPTUNGEN:
        m = re.search(muster, text)
        if m is None:
            funde.append((was, "nicht gefunden", "-"))
            continue
        for wert, s in zip(m.groups(), schluessel):
            zahl = int(wert) if wert.isdigit() else ZAHLWORT.get(wert.lower())
            if zahl != ist[s]:
                funde.append((was, wert, ist[s]))

    print(f"{pfad.name}: {len(BEHAUPTUNGEN)} Aussagen gegen db/aufbau/*.sql")
    if not funde:
        print("  Alle Objektzahlen im Deck stimmen mit dem Aufbau überein.")
        return 0
    print(f"  {len(funde)} Abweichung(en):\n")
    print(f"  {'Gegenstand':<44} {'im Deck':<14} gezählt")
    for was, deck, zahl in funde:
        print(f"  {was:<44} {str(deck):<14} {zahl}")
    print("\n  Die Zahlen stehen von Hand in slides/build_deck.py. Nach jeder\n"
          "  Schemaänderung dort nachziehen und das Deck neu bauen.")
    return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
