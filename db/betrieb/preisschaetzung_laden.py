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
  * Spanne hoechstens 12 Minuten breit
  * Preisspanne hoechstens 60 Prozent ihrer Mitte

Die letzten beiden sind die Nuetzlichkeitsregel aus Phase 5.5 des
Notebooks (spanne_nuetzt). Bis zum 03.09.2026 stand hier und im CHECK der
Tabelle stattdessen eine absolute Grenze von 1,00 Euro. Sie stammte aus
einer aelteren Fassung und schloss die teuren Radtypen aus - bei Cargo
entspricht ein Euro Spanne zwei Minuten Unsicherheit. Folge: 150 von 212
freigegebenen Zeilen liessen sich nicht laden, die Tabelle enthielt nur
City-Bikes, und die Preisschaetzung zeigte fuer zwei von drei Radtypen
nie etwas an.

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

import collections
import csv
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))
import run  # noqa: E402  - liefert verbinde() und liest .env

WURZEL = pathlib.Path(__file__).resolve().parent.parent.parent
QUELLE = WURZEL / "analytics" / "preisschaetzung.csv"

# Zielspalte in der Tabelle -> Spalte in der CSV. Die beiden Preisspalten
# heissen dort preis_*_basis: Das Notebook rechnet sie im Basistarif, also
# ohne Freiminuten und Rabatt - dem teuersten Fall. Wessen Spanne dort
# schmal genug ist, ist es in jedem anderen Tarif erst recht.
SPALTEN = {
    "start_station_id": "start_station_id",
    "ziel_station_id": "ziel_station_id",
    "startstation": "startstation",
    "zielstation": "zielstation",
    "typ_code": "typ_code",
    "zeitfenster": "zeitfenster",
    "minuten_von": "minuten_von",
    "minuten_bis": "minuten_bis",
    "preis_von": "preis_von_basis",
    "preis_bis": "preis_bis_basis",
    "fahrten_grundlage": "fahrten_grundlage",
}

# Dieselben Werte wie SPANNE_MAX_MIN und SPANNE_MAX_ANTEIL in
# analytics/bau/nb01_regression.py. tools/breitenregel_pruefen.py haelt
# Notebook, SQL-CHECK und diesen Lader gegeneinander.
SPANNE_MAX_MIN = 12
SPANNE_MAX_ANTEIL = 0.60


def lesen() -> list[tuple]:
    if not QUELLE.exists():
        raise SystemExit(
            f"Datei fehlt: {QUELLE}\n"
            "Zuerst das Notebook bauen: python3 analytics/bau/bauen.py nb01")
    with QUELLE.open(encoding="utf-8") as f:
        zeilen = list(csv.DictReader(f))
    fehlt = [q for q in SPALTEN.values() if q not in zeilen[0]]
    if fehlt:
        raise SystemExit(
            f"Spalten fehlen in {QUELLE.name}: {fehlt}\n"
            "Die Datei stammt aus Phase 6 von NB01. Aendert sich dort eine\n"
            "Spalte, muss die Abbildung SPALTEN oben nachgezogen werden -\n"
            "genau das ist am 01.09.2026 unterblieben.")
    daten = []
    for z in zeilen:
        # Die Pruefungen der Tabelle noch einmal hier, damit ein
        # fehlerhafter Lauf nicht erst an einem CHECK scheitert, sondern
        # mit einer lesbaren Meldung.
        if z["startstation"] == z["zielstation"]:
            raise SystemExit(f"Rundfahrt in der Datei: {z['startstation']}")
        von, bis = float(z["preis_von_basis"]), float(z["preis_bis_basis"])
        mv, mb = int(z["minuten_von"]), int(z["minuten_bis"])
        if mb - mv > SPANNE_MAX_MIN:
            raise SystemExit(
                f"Spanne breiter als {SPANNE_MAX_MIN} Minuten: "
                f"{z['startstation']} -> {z['zielstation']} ({mv} bis {mb})")
        if bis - von > SPANNE_MAX_ANTEIL * max((von + bis) / 2, 0.01) + 1e-4:
            raise SystemExit(
                f"Preisspanne breiter als {SPANNE_MAX_ANTEIL:.0%} ihrer Mitte: "
                f"{z['startstation']} -> {z['zielstation']} ({von} bis {bis})")
        daten.append(tuple(z[quelle] for quelle in SPALTEN.values()))
    return daten


def main() -> int:
    trocken = "--trocken" in sys.argv
    daten = lesen()
    print(f"{len(daten)} Zeilen aus {QUELLE.name} gelesen und geprueft.")
    # Ueber den Spaltennamen, nicht ueber die Position: Als die IDs
    # dazukamen, verschob sich alles um zwei, und die Zusammenfassung
    # meldete Stationsnamen als Radtypen.
    i = {name: k for k, name in enumerate(SPALTEN)}
    verbindungen = len({(d[i["start_station_id"]], d[i["ziel_station_id"]])
                        for d in daten})
    je_typ = collections.Counter(d[i["typ_code"]] for d in daten)
    print(f"   {verbindungen} Verbindungen, Radtypen {dict(sorted(je_typ.items()))}")
    # Ein Radtyp ohne eine einzige Zeile heisst: Fuer ihn zeigt die App
    # nie eine Schaetzung. Genau so ist es zwei Tage lang unbemerkt
    # geblieben, deshalb steht es jetzt als Warnung im Lauf.
    if len(je_typ) < 3:
        print(f"   WARNUNG: nur {len(je_typ)} von 3 Radtypen vertreten - "
              f"fuer die uebrigen zeigt die App nichts an.")
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

    # Die IDs aus der CSV zeigen ins Leere. Das Notebook nummeriert seine
    # Stationen selbst durch (1, 2, 3 ...), die Datenbank vergibt eigene
    # Schluessel (30, 31, 32 ...). Alle 212 Zeilen trugen deshalb eine
    # start_station_id, zu der es keine Station gibt. Aufgefallen ist es
    # nicht, weil die Website ueber die NAMEN sucht - aber ein Verweis,
    # der ins Leere zeigt, ist ein Fehler, auch wenn ihn gerade niemand
    # verfolgt. Hier wird er ueber den Namen aufgeloest, der Fachschluessel
    # der Tabelle ist ohnehin der Name.
    c.execute("""
        update velocity.preisschaetzung p
           set start_station_id = s1.station_id,
               ziel_station_id  = s2.station_id
          from velocity.station s1, velocity.station s2
         where s1.name = p.startstation and s2.name = p.zielstation""")
    c.execute("""
        select count(*) from velocity.preisschaetzung p
          left join velocity.station s on s.station_id = p.start_station_id
         where s.station_id is null""")
    offen = c.fetchone()[0]
    if offen:
        v.rollback(); v.close()
        raise SystemExit(
            f"{offen} Zeilen mit einem Stationsnamen, den es nicht gibt - "
            "nichts geschrieben.")

    # Die Breitenregel steht im Aufbau als NOT VALID, damit er keinen
    # Altbestand loeschen muss (siehe 0004_bereich_c_tarif_und_preis.sql).
    # Jetzt, wo nur noch frisch geladene Zeilen darin stehen, wird sie
    # geprueft und gueltig geschaltet. Schlaegt das fehl, ist die CSV
    # nicht die, fuer die der Lader sie haelt.
    c.execute("alter table velocity.preisschaetzung "
              "validate constraint preisschaetzung_breite_chk")
    v.commit()
    c.execute("select count(*) from velocity.preisschaetzung")
    nachher = c.fetchone()[0]
    v.close()
    print(f"\nvorher {vorher} Zeilen, jetzt {nachher}.")
    print("Stations-IDs ueber die Namen aufgeloest, Breitenregel gueltig.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
