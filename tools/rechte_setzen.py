#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Setzt die im Repo versprochenen GRANTs in der Datenbank wieder.

Aufruf:
    python3 tools/rechte_setzen.py            # zeigt nur, was fehlt
    python3 tools/rechte_setzen.py --setzen   # spielt die fehlenden ein

Wozu
----
Gegenstueck zu tools/grants_pruefen.py: jenes sagt, WELCHES versprochene
Recht in der Datenbank fehlt, dieses stellt es wieder her.

Anlass war der 06.09.2026. db/betrieb/demofahrten_rollieren.sql trug die
Zeile

    revoke all on all functions in schema velocity
      from public, anon, authenticated;

mit dem Zusatz, fuer bereits gesperrte Funktionen sei das ein
"wirkungsloses, sicheres Wiederholen". Das stimmt nicht: die Anweisung
nimmt der Rolle authenticated auch jedes AUSDRUECKLICH vergebene Recht.
In 0011_sicherheit.sql steht dieselbe Zeile deshalb vor einem Block, der
die Rechte wieder vergibt. Ohne diesen Block waren nach einem einzigen
Lauf neun Rechte weg, und das persoenliche Dashboard der Kundenwebsite
meldete "permission denied for function fn_luftlinie_km".

KEINE EIGENE LISTE
------------------
Die Rechte werden NICHT hier gefuehrt, sondern aus grants_pruefen.py
importiert, das sie seinerseits aus db/aufbau/*.sql liest. Eine zweite,
von Hand gepflegte Liste waere genau der Fehler, an dem dieses Projekt
schon neunmal haengengeblieben ist: sie faengt an zu veralten, waehrend
die Pruefung gruen bleibt. Kommt ein Recht in einer Aufbaudatei hinzu,
kennen es beide Werkzeuge sofort.

Grenzen
-------
Setzt nur GRANTs. Fehlt die Funktion oder die Sicht selbst, sagt das
Werkzeug das und ruehrt nichts an - dann ist die Aufbaukette dran, nicht
dieses Skript.
"""
from __future__ import annotations

import os
import sys

import grants_pruefen as pruefung

ROT, GRUEN, GELB, AUS = "\033[0;31m", "\033[0;32m", "\033[0;33m", "\033[0m"


def main() -> int:
    setzen = "--setzen" in sys.argv
    pruefung.umgebung_laden()
    try:
        import psycopg2
    except ImportError:
        print(f"{GELB}abgebrochen{AUS} psycopg2 fehlt")
        return 1
    if not os.environ.get("PGHOST"):
        print(f"{GELB}abgebrochen{AUS} kein Datenbankzugang in .env")
        return 1

    funktionen, sichten = pruefung.rechte_aus_dem_repo()
    try:
        verbindung = psycopg2.connect(
            host=os.environ["PGHOST"], port=os.environ.get("PGPORT", "5432"),
            dbname=os.environ["PGDATABASE"], user=os.environ["PGUSER"],
            password=os.environ["PGPASSWORD"], connect_timeout=15)
    except Exception as fehler:
        print(f"{GELB}abgebrochen{AUS} keine Verbindung: {str(fehler)[:80]}")
        return 1

    zeiger = verbindung.cursor()
    fehlend, unmoeglich = [], []

    for signatur, rolle, datei in funktionen:
        try:
            zeiger.execute("select has_function_privilege(%s, %s, 'execute')",
                           (rolle, signatur))
            if not zeiger.fetchone()[0]:
                fehlend.append(("execute on function", signatur, rolle, datei))
        except Exception as fehler:
            verbindung.rollback()
            unmoeglich.append((signatur, str(fehler).splitlines()[0]))

    for sicht, rolle, datei in sichten:
        try:
            zeiger.execute("select has_table_privilege(%s, %s, 'select')",
                           (rolle, sicht))
            if not zeiger.fetchone()[0]:
                fehlend.append(("select on", sicht, rolle, datei))
        except Exception as fehler:
            verbindung.rollback()
            unmoeglich.append((sicht, str(fehler).splitlines()[0]))

    for ziel, grund in unmoeglich:
        print(f"{ROT}fehlt{AUS}    {ziel} - {grund}")

    if not fehlend:
        print(f"{GRUEN}ok{AUS}       alle {len(funktionen) + len(sichten)} "
              f"versprochenen Rechte sind gesetzt, nichts zu tun")
        verbindung.close()
        return 1 if unmoeglich else 0

    print(f"{GELB}{len(fehlend)} Recht(e) fehlen:{AUS}")
    anweisungen = []
    for art, ziel, rolle, datei in fehlend:
        anweisung = f"grant {art} {ziel} to {rolle};"
        anweisungen.append(anweisung)
        print(f"         {anweisung}")
        print(f"         {'':<8s} aus {datei}")

    if not setzen:
        print(f"\n         Nichts geaendert. Zum Einspielen: "
              f"python3 tools/rechte_setzen.py --setzen")
        verbindung.close()
        return 1

    # Alles in EINER Transaktion: entweder stehen danach alle Rechte oder
    # keines neu. Ein halb hergestellter Rechtestand waere schwerer zu
    # durchschauen als der kaputte davor.
    try:
        for anweisung in anweisungen:
            zeiger.execute(anweisung)
        verbindung.commit()
    except Exception as fehler:
        verbindung.rollback()
        print(f"\n{ROT}abgebrochen{AUS} {str(fehler).splitlines()[0]}")
        print("         Nichts geaendert (Transaktion zurueckgerollt).")
        verbindung.close()
        return 1

    # Gegenprobe aus der Datenbank, nicht aus dem eigenen Erfolgsgefuehl.
    offen = []
    for art, ziel, rolle, _ in fehlend:
        if art.startswith("execute"):
            zeiger.execute("select has_function_privilege(%s, %s, 'execute')",
                           (rolle, ziel))
        else:
            zeiger.execute("select has_table_privilege(%s, %s, 'select')",
                           (rolle, ziel))
        if not zeiger.fetchone()[0]:
            offen.append(f"{rolle} -> {ziel}")
    verbindung.close()

    if offen:
        print(f"\n{ROT}FEHLER{AUS}   trotz grant weiterhin ohne Recht:")
        for zeile in offen:
            print(f"         {zeile}")
        return 1

    print(f"\n{GRUEN}gesetzt{AUS}  {len(anweisungen)} Recht(e), "
          f"jedes einzeln gegengeprueft")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
