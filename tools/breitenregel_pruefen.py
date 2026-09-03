#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Haelt die Nuetzlichkeitsregel der Preisschaetzung an ihren drei Orten gleich.

WARUM ES DIESE PRUEFUNG BRAUCHT

Dieselbe Regel steht an drei Stellen: im Notebook, das die Zeilen
erzeugt, im CHECK der Tabelle, die sie annimmt, und im Lader dazwischen.
Am 01.09.2026 wurde sie im Notebook geaendert - von einer absoluten
Grenze von 1,00 Euro auf hoechstens 12 Minuten und hoechstens 60 Prozent
der Preismitte. Die beiden anderen Stellen blieben stehen.

Die Folge war nicht sichtbar, sondern still: Der Lader wies 150 von 212
freigegebenen Zeilen ab, die Tabelle behielt ihren Stand vom 01.09., und
in der App zeigte die Preisschaetzung fuer E-Bike und Cargo nie etwas an.
Zwei Tage lang, bei gruener Abnahme - denn keine Pruefung verglich die
drei Orte.

Dass eine absolute Eurogrenze hier falsch ist, macht es schlimmer: Das
Modell schaetzt in MINUTEN, der Preis entsteht durch den Minutenpreis.
Ein Euro Spanne sind bei City zehn Minuten Unsicherheit, bei Cargo zwei.
Die Grenze schloss also genau die teuren Radtypen aus - lautlos.

WAS GEPRUEFT WIRD

  1  Notebook und Lader nennen dieselben beiden Konstanten.
  2  Der CHECK der Tabelle nennt dieselben Zahlen.
  3  Die erzeugte CSV erfuellt die Regel Zeile fuer Zeile.
  4  Jeder Radtyp mit Fahrten kommt in der CSV auch vor. Ein Typ ohne
     eine einzige Zeile heisst: In der App bleibt sein Knopf grau.

Punkt 4 ist der eigentliche Ertrag. Die ersten drei fangen den Bruch der
Kette; der vierte faengt das Ergebnis, auch wenn die Kette heil ist und
schlicht die Daten nicht reichen.

Aufruf: python3 tools/breitenregel_pruefen.py
"""
from __future__ import annotations

import csv
import pathlib
import re
import sys

WURZEL = pathlib.Path(__file__).resolve().parent.parent
NOTEBOOK = WURZEL / "analytics" / "bau" / "nb01_regression.py"
LADER = WURZEL / "db" / "betrieb" / "preisschaetzung_laden.py"
SQL = WURZEL / "db" / "aufbau" / "0004_bereich_c_tarif_und_preis.sql"
CSV_DATEI = WURZEL / "analytics" / "preisschaetzung.csv"

RADTYPEN = {"CITY", "EBIKE", "CARGO"}


def zahl(pfad: pathlib.Path, muster: str) -> float | None:
    # re.M, weil die Konstanten mitten in der Datei stehen - ohne das
    # trifft ^ nur den Dateianfang.
    m = re.search(muster, pfad.read_text(encoding="utf-8"), re.M)
    return float(m.group(1)) if m else None


def main() -> int:
    funde: list[str] = []

    # 1 Notebook und Lader
    quellen = {
        "Notebook": (zahl(NOTEBOOK, r"^SPANNE_MAX_MIN\s*=\s*(\d+)"),
                     zahl(NOTEBOOK, r"^SPANNE_MAX_ANTEIL\s*=\s*([\d.]+)")),
        "Lader": (zahl(LADER, r"^SPANNE_MAX_MIN\s*=\s*(\d+)"),
                  zahl(LADER, r"^SPANNE_MAX_ANTEIL\s*=\s*([\d.]+)")),
    }
    for name, (mi, an) in quellen.items():
        if mi is None or an is None:
            funde.append(f"{name}: SPANNE_MAX_MIN oder SPANNE_MAX_ANTEIL nicht gefunden")
    if not funde and quellen["Notebook"] != quellen["Lader"]:
        funde.append(f"Notebook {quellen['Notebook']} gegen Lader {quellen['Lader']}")
    if funde:
        print("breitenregel: " + funde[0])
        return 1
    minuten, anteil = quellen["Notebook"]

    # 2 Der CHECK der Tabelle
    sql = SQL.read_text(encoding="utf-8")
    m = re.search(r"constraint preisschaetzung_breite_chk\s*\n?\s*check \((.*?)\)\s*\n?\s*(?:not valid)?;",
                  sql, re.S)
    if m is None:
        funde.append("preisschaetzung_breite_chk im SQL nicht gefunden")
    else:
        block = " ".join(m.group(1).split())
        if f"<= {minuten:.0f}" not in block:
            funde.append(f"CHECK nennt nicht {minuten:.0f} Minuten: {block[:90]}")
        if f"{anteil:.2f}" not in block:
            funde.append(f"CHECK nennt nicht den Anteil {anteil:.2f}: {block[:90]}")

    # 3 und 4 Die erzeugte CSV
    if not CSV_DATEI.exists():
        funde.append(f"{CSV_DATEI.name} fehlt - zuerst NB01 bauen")
    else:
        zeilen = list(csv.DictReader(CSV_DATEI.open(encoding="utf-8")))
        verstoss = 0
        for z in zeilen:
            von, bis = float(z["preis_von_basis"]), float(z["preis_bis_basis"])
            mv, mb = int(z["minuten_von"]), int(z["minuten_bis"])
            if (mb - mv > minuten
                    or bis - von > anteil * max((von + bis) / 2, 0.01) + 1e-4):
                verstoss += 1
        if verstoss:
            funde.append(f"{verstoss} von {len(zeilen)} CSV-Zeilen reissen die Regel")
        fehlt = RADTYPEN - {z["typ_code"] for z in zeilen}
        if fehlt:
            funde.append(
                f"kein einziger Eintrag fuer {sorted(fehlt)} - "
                f"fuer diese Radtypen zeigt die App nie eine Schaetzung")

    print(f"Breitenregel: hoechstens {minuten:.0f} Minuten und "
          f"{anteil:.0%} der Preismitte")
    if not funde:
        anz = len(list(csv.DictReader(CSV_DATEI.open(encoding='utf-8'))))
        print(f"  Notebook, SQL-CHECK und Lader nennen dieselbe Regel; "
              f"alle {anz} CSV-Zeilen\n  erfüllen sie, alle drei Radtypen sind "
              f"vertreten.")
        return 0
    print(f"  {len(funde)} Befund(e):\n")
    for f in funde:
        print(f"  FEHLER  {f}")
    print("\n  Die Regel steht an drei Orten: SPANNE_MAX_* in\n"
          "  analytics/bau/nb01_regression.py und in\n"
          "  db/betrieb/preisschaetzung_laden.py sowie im CHECK\n"
          "  preisschaetzung_breite_chk. Alle drei müssen dasselbe sagen.")
    return 1


if __name__ == "__main__":
    sys.exit(main())
