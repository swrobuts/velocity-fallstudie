#!/usr/bin/env python3
"""Wendet SQL-Dateien auf die VeloCity-Datenbank an.

Aufruf:
    python3 db/run.py db/aufbau/0001_schema_und_konventionen.sql
    python3 db/run.py db/aufbau/*.sql

Jede Datei laeuft in genau einer Transaktion. Schlaegt eine Datei fehl,
wird sie zurueckgerollt und das Programm bricht mit Rueckgabewert 1 ab.
Bereits erfolgreich angewandte Dateien bleiben bestehen.
"""
from __future__ import annotations

import os
import pathlib
import sys

import psycopg2

SCHLUESSEL = ("PGHOST", "PGPORT", "PGDATABASE", "PGUSER", "PGPASSWORD")


def lade_env(pfad: pathlib.Path) -> None:
    """Liest eine einfache KEY=VALUE-Datei nach os.environ, ohne zu ueberschreiben."""
    if not pfad.exists():
        return
    for zeile in pfad.read_text(encoding="utf-8").splitlines():
        zeile = zeile.strip()
        if not zeile or zeile.startswith("#") or "=" not in zeile:
            continue
        schluessel, wert = zeile.split("=", 1)
        os.environ.setdefault(schluessel.strip(), wert.strip())


def verbinde():
    """Baut die Verbindung aus .env auf und meldet fehlende Parameter klar."""
    wurzel = pathlib.Path(__file__).resolve().parent.parent
    lade_env(wurzel / ".env")
    fehlend = [k for k in SCHLUESSEL if not os.environ.get(k)]
    if fehlend:
        sys.exit("Fehlende Verbindungsparameter in .env: " + ", ".join(fehlend))
    return psycopg2.connect(
        host=os.environ["PGHOST"],
        port=os.environ["PGPORT"],
        dbname=os.environ["PGDATABASE"],
        user=os.environ["PGUSER"],
        password=os.environ["PGPASSWORD"],
        connect_timeout=15,
    )


def wende_an(conn, pfad: pathlib.Path) -> None:
    """Fuehrt eine SQL-Datei als eine Transaktion aus."""
    with conn.cursor() as cur:
        cur.execute(pfad.read_text(encoding="utf-8"))
    conn.commit()


def main(argv: list[str]) -> int:
    if not argv:
        print(__doc__)
        return 2
    conn = verbinde()
    try:
        for name in argv:
            pfad = pathlib.Path(name)
            if not pfad.exists():
                print(f"FEHLER  {pfad} existiert nicht", file=sys.stderr)
                return 1
            try:
                wende_an(conn, pfad)
            except Exception as fehler:  # noqa: BLE001 - Fehlertext soll durchgereicht werden
                conn.rollback()
                print(f"FEHLER  {pfad}\n        {fehler}", file=sys.stderr)
                return 1
            print(f"OK      {pfad}")
    finally:
        conn.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
