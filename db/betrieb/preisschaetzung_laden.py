#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Laedt analytics/preisschaetzung.csv nach velocity.preisschaetzung.

Aufruf:
    python3 db/betrieb/preisschaetzung_laden.py
    python3 db/betrieb/preisschaetzung_laden.py --trocken

Woher die Datei kommt
---------------------
Aus Phase 6 von analytics/notebooks/01_Regression_Fahrtdauer.ipynb. Sie
enthaelt je Verbindung, Radtyp und Tageszeit eine Preisspanne - aber nur
fuer die Kombinationen, die zwei Bedingungen erfuellen:

  * mindestens 30 vergleichbare Fahrten als Grundlage
  * Spanne hoechstens 1,00 Euro breit

Was diese Bedingungen nicht erfuellt, steht nicht in der Datei und
deshalb auch nicht in der Tabelle. Die Website zeigt dann nichts an.
Das ist die Absicht: Die fachliche Freigabe steckt in den Daten, nicht in
einer Fussnote.

Warum ein eigener Lader und kein INSERT in den Aufbaudateien
------------------------------------------------------------
Die Aufbaudateien beschreiben das MODELL, nicht seinen Inhalt. Eine
Tabelle mit 131 Zeilen Analytics-Ergebnis dort einzubetten hiesse, das
Schema jedes Mal anzufassen, wenn das Notebook neu gerechnet wurde.

Die Tabelle wird vollstaendig ersetzt, nicht ergaenzt: Eine Verbindung,
die ihre Freigabe verliert, muss verschwinden. Ein reines Nachladen
wuerde sie stehenlassen.
"""
from __future__ import annotations

import csv
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))
import run  # noqa: E402  - liefert verbinde() und liest .env

WURZEL = pathlib.Path(__file__).resolve().parent.parent.parent
QUELLE = WURZEL / "analytics" / "preisschaetzung.csv"

SPALTEN = ["startstation", "zielstation", "typ_code", "zeitfenster",
           "minuten_von", "minuten_bis", "preis_von", "preis_bis",
           "fahrten_grundlage"]


def lesen() -> list[tuple]:
    if not QUELLE.exists():
        raise SystemExit(
            f"Datei fehlt: {QUELLE}\n"
            "Zuerst das Notebook bauen: python3 analytics/bau/bauen.py nb01")
    with QUELLE.open(encoding="utf-8") as f:
        zeilen = list(csv.DictReader(f))
    fehlt = [s for s in SPALTEN if s not in zeilen[0]]
    if fehlt:
        raise SystemExit(f"Spalten fehlen in {QUELLE.name}: {fehlt}")
    daten = []
    for z in zeilen:
        # Die Pruefungen der Tabelle noch einmal hier, damit ein
        # fehlerhafter Lauf nicht erst an einem CHECK scheitert, sondern
        # mit einer lesbaren Meldung.
        if z["startstation"] == z["zielstation"]:
            raise SystemExit(f"Rundfahrt in der Datei: {z['startstation']}")
        if float(z["preis_bis"]) - float(z["preis_von"]) > 1.0001:
            raise SystemExit(
                f"Spanne breiter als 1,00 EUR: {z['startstation']} -> "
                f"{z['zielstation']} ({z['preis_von']} bis {z['preis_bis']})")
        daten.append(tuple(z[s] for s in SPALTEN))
    return daten


def main() -> int:
    trocken = "--trocken" in sys.argv
    daten = lesen()
    print(f"{len(daten)} Zeilen aus {QUELLE.name} gelesen und geprueft.")
    verbindungen = len({(d[0], d[1]) for d in daten})
    print(f"   {verbindungen} Verbindungen, "
          f"Radtypen {sorted({d[2] for d in daten})}")
    if trocken:
        print("\nTrockenlauf - nichts geschrieben.")
        return 0

    v = run.verbinde()
    c = v.cursor()
    c.execute("select count(*) from velocity.preisschaetzung")
    vorher = c.fetchone()[0]
    # Vollstaendig ersetzen: Was seine Freigabe verliert, muss weg.
    c.execute("truncate velocity.preisschaetzung restart identity")
    c.executemany(
        f"insert into velocity.preisschaetzung ({', '.join(SPALTEN)}) "
        f"values ({', '.join(['%s'] * len(SPALTEN))})", daten)
    v.commit()
    c.execute("select count(*) from velocity.preisschaetzung")
    nachher = c.fetchone()[0]
    v.close()
    print(f"\nvorher {vorher} Zeilen, jetzt {nachher}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
