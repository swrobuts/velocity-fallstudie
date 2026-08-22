#!/usr/bin/env python3
"""Sichert ein Schema als DDL-Uebersicht und CSV-Dateien je Tabelle.

Aufruf:
    python3 tools/schema_dump.py cityBikesRental doku/verifikation/sicherung

Kein Ersatz fuer pg_dump: gesichert werden Tabellenstruktur, Constraints,
Indizes, Funktionsdefinitionen und der Tabelleninhalt als CSV. Nicht
gesichert werden Rechte, Eigentumsverhaeltnisse und Sequenzstaende.
"""
from __future__ import annotations

import csv
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent / "db"))

from run import verbinde  # noqa: E402


def main(argv: list[str]) -> int:
    if len(argv) != 2:
        print(__doc__)
        return 2
    schema, ziel_name = argv
    ziel = pathlib.Path(ziel_name)
    ziel.mkdir(parents=True, exist_ok=True)

    conn = verbinde()
    cur = conn.cursor()

    cur.execute(
        """
        select c.relname
          from pg_class c join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = %s and c.relkind = 'r'
         order by c.relname
        """,
        (schema,),
    )
    tabellen = [r[0] for r in cur.fetchall()]

    struktur = ziel / "struktur.sql"
    with struktur.open("w", encoding="utf-8") as f:
        f.write(f"-- Strukturuebersicht des Schemas {schema}\n")
        f.write("-- Erzeugt von tools/schema_dump.py. Kein vollwertiger pg_dump:\n")
        f.write("-- Rechte, Eigentuemer und Sequenzstaende sind NICHT enthalten.\n\n")

        cur.execute(
            """
            select table_name, ordinal_position, column_name, data_type,
                   is_nullable, column_default
              from information_schema.columns
             where table_schema = %s
             order by table_name, ordinal_position
            """,
            (schema,),
        )
        f.write("-- ===== Spalten =====\n")
        for zeile in cur.fetchall():
            f.write("-- " + " | ".join("" if x is None else str(x) for x in zeile) + "\n")

        cur.execute(
            """
            select conrelid::regclass::text, conname, pg_get_constraintdef(oid)
              from pg_constraint
             where connamespace = (select oid from pg_namespace where nspname = %s)
             order by 1, 2
            """,
            (schema,),
        )
        f.write("\n-- ===== Constraints =====\n")
        for tabelle, name, definition in cur.fetchall():
            f.write(f"alter table {tabelle} add constraint {name} {definition};\n")

        cur.execute("select indexdef from pg_indexes where schemaname = %s order by indexname", (schema,))
        f.write("\n-- ===== Indizes =====\n")
        for (definition,) in cur.fetchall():
            f.write(definition + ";\n")

        cur.execute(
            """
            select pg_get_functiondef(p.oid)
              from pg_proc p
             where p.pronamespace = (select oid from pg_namespace where nspname = %s)
             order by p.proname
            """,
            (schema,),
        )
        f.write("\n-- ===== Funktionen =====\n")
        for (definition,) in cur.fetchall():
            f.write(definition + "\n\n")

    for tabelle in tabellen:
        pfad = ziel / f"{tabelle}.csv"
        cur.execute(f'select * from "{schema}"."{tabelle}"')
        spalten = [d[0] for d in cur.description]
        zeilen = cur.fetchall()
        with pfad.open("w", encoding="utf-8", newline="") as f:
            schreiber = csv.writer(f)
            schreiber.writerow(spalten)
            schreiber.writerows(zeilen)
        print(f"gesichert  {pfad} ({len(zeilen)} Zeilen)")

    conn.close()
    print(f"\nStruktur: {struktur}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
