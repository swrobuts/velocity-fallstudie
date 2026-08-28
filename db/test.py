#!/usr/bin/env python3
"""Fuehrt die pgTAP-Tests der VeloCity-Datenbank aus.

Aufruf:
    python3 db/test.py                              # alle Testdateien
    python3 db/test.py db/tests/t0002_bereich_a.sql # einzelne Datei

Die Testdateien legen Funktionen im Schema velocity_test an. Anschliessend
ruft dieses Programm runtests() auf, das jede Testfunktion in einer eigenen
Transaktion ausfuehrt und danach zuruecksetzt. Testdaten bleiben also nicht
in der Datenbank zurueck.

Gezaehlt werden die fehlgeschlagenen Testfunktionen: runtests() meldet je
Funktion eine Zeile 'not ok'; die eingerueckten Zeilen darunter sind die
einzelnen Zusicherungen.

Rueckgabewert 0, wenn alle Tests bestehen, sonst 1.
"""
from __future__ import annotations

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))

from run import verbinde, wende_an  # noqa: E402


def main(argv: list[str]) -> int:
    wurzel = pathlib.Path(__file__).resolve().parent
    dateien = [pathlib.Path(a) for a in argv] or sorted((wurzel / "tests").glob("t*.sql"))
    if not dateien:
        sys.exit("Keine Testdateien gefunden.")

    conn = verbinde()
    try:
        for pfad in dateien:
            wende_an(conn, pfad)
            print(f"eingespielt  {pfad}")
        with conn.cursor() as cur:
            cur.execute("set search_path = velocity_test, velocity, extensions, public")
            cur.execute("select * from runtests('velocity_test'::name, '^test_')")
            zeilen = [r[0] for r in cur.fetchall()]
        conn.commit()
    finally:
        conn.close()

    fehlschlaege = 0
    bestanden = 0
    for zeile in zeilen:
        print(zeile)
        if zeile.startswith("not ok"):
            fehlschlaege += 1
        elif zeile.startswith("ok "):
            bestanden += 1
    print(f"\n{bestanden} bestandene, {fehlschlaege} fehlgeschlagene Testfunktion(en).")
    # Kein einziger Test gelaufen ist ein FEHLER, kein Erfolg: passt das
    # Namensmuster '^test_' eines Tages auf nichts mehr (umbenannte
    # Funktionen, ein leeres Schema velocity_test, eine Aufbaudatei, die
    # ihre Funktionen nicht anlegt), meldete dieses Programm bisher
    # "0 fehlgeschlagene" und gab 0 zurueck - eine gruene Pruefung, die
    # nichts geprueft hat. Vierte Pruefrunde, dieselbe Ueberlegung wie
    # bei tools/zahlen_gegen_db.py.
    if not fehlschlaege and not bestanden:
        print("FEHLER: keine einzige Testfunktion ausgefuehrt "
              "(runtests() lieferte kein 'ok'). Nichts geprueft ist nicht bestanden.")
        return 1
    return 1 if fehlschlaege else 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
