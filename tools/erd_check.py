#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Prueft die Kardinalitaeten der ER-Diagramme gegen den Systemkatalog.

mermaid_check.mjs prueft, ob ein Diagramm SYNTAKTISCH gueltig ist. Das sagt
nichts darueber, ob es die Wahrheit sagt. Genau da lag der Fehler: drei
Diagramme behaupteten "jede Ausleihe hat genau eine Station und genau eine
Mitgliedschaft", waehrend beide Fremdschluessel NULL zulassen - die
Fallstudie kennt freies Abstellen und Fahren ohne Vertrag.

Geprueft wird:

  FEHLER   Die Elternseite behauptet Pflicht (||), obwohl der Fremdschluessel
           NULL zulaesst - oder umgekehrt. Das folgt zwingend aus dem
           Katalog und ist nie Geschmackssache.

  HINWEIS  Die Kindseite fordert mindestens eins (|{ oder ||), obwohl es im
           Bestand Elternzeilen ohne Kind gibt. Das ist eine Aussage ueber
           Daten, nicht ueber das Schema, deshalb nur ein Hinweis.

Ein Diagramm, das bewusst vereinfacht oder einen Altzustand zeigt, traegt
in der ersten Zeile den Vermerk:  %% erd-check: aus  (mit Begruendung)

Aufruf:  python3 tools/erd_check.py
Rueckgabe: 0 ohne Fehler, 1 mit Fehlern.
"""
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "db"))
from run import verbinde  # noqa: E402

ERD = Path(__file__).resolve().parent.parent / "doku" / "datenmodell" / "erd"

# PARENT <links>--<rechts> CHILD : "Bezeichnung"
BEZIEHUNG = re.compile(
    r'^\s*([A-Z_][A-Z0-9_]*)\s+'
    r'(\|\||\|o|\}o|\}\|)--(o\{|\|\{|o\||\|\|)\s+'
    r'([A-Z_][A-Z0-9_]*)\s*:\s*"?([^"]*)"?\s*$'
)


def katalog():
    """Fremdschluessel und Elternzeilen ohne Kind aus der Datenbank."""
    cur = verbinde().cursor()
    cur.execute("""
        select eltern.relname, kind.relname, kspalte.attname, kspalte.attnotnull,
               espalte.attname, en.nspname
          from pg_constraint c
          join pg_class kind   on kind.oid = c.conrelid
          join pg_class eltern on eltern.oid = c.confrelid
          join pg_namespace n  on n.oid = kind.relnamespace
          join pg_namespace en on en.oid = eltern.relnamespace
          join unnest(c.conkey)  with ordinality as kk(attnum, i) on true
          join unnest(c.confkey) with ordinality as ee(attnum, i) on ee.i = kk.i
          join pg_attribute kspalte on kspalte.attrelid = kind.oid
                                   and kspalte.attnum = kk.attnum
          join pg_attribute espalte on espalte.attrelid = eltern.oid
                                   and espalte.attnum = ee.attnum
         where c.contype = 'f' and n.nspname = 'velocity'""")
    fks, wege = {}, {}
    for eltern, kind, kspalte, pflicht, espalte, eschema in cur.fetchall():
        fks.setdefault((eltern, kind), []).append((kspalte, pflicht))
        wege.setdefault((eltern, kind), []).append((kspalte, espalte, eschema))

    # Gibt es Elternzeilen ganz ohne Kind? Nur dann ist "mindestens eins"
    # haltbar. Bei mehreren Wegen zwischen zwei Tabellen (etwa Start- und
    # Zielstation) ist die Frage nicht eindeutig, also uebersprungen.
    verwaist = {}
    for paar, spalten in wege.items():
        if len(spalten) != 1:
            continue
        kspalte, espalte, eschema = spalten[0]
        eltern, kind = paar
        if eschema != 'velocity':
            continue                      # Fremdes Schema, etwa auth.users
        cur.execute(f"""select count(*) from velocity.{eltern} e
                         where not exists (select 1 from velocity.{kind} k
                                            where k.{kspalte} = e.{espalte})""")
        verwaist[paar] = cur.fetchone()[0]
    return fks, verwaist


def main():
    fks, verwaist = katalog()
    fehler, hinweise, geprueft, uebersprungen = [], [], 0, []

    for pfad in sorted(ERD.glob("*.mmd")):
        text = pfad.read_text(encoding="utf-8")
        if not text.lstrip().startswith("erDiagram"):
            continue                                   # Flussdiagramm, kein ERM
        if re.search(r'%%\s*erd-check:\s*aus', text):
            uebersprungen.append(pfad.name)
            continue

        for nr, zeile in enumerate(text.split("\n"), 1):
            m = BEZIEHUNG.match(zeile)
            if not m:
                continue
            eltern_d, links, rechts, kind_d, bez = m.groups()
            eltern, kind = eltern_d.lower(), kind_d.lower()
            spalten = fks.get((eltern, kind))
            if spalten is None:
                continue          # konzeptionelle Entitaet ohne eigene Tabelle
            geprueft += 1

            optional = any(not pflicht for _, pflicht in spalten)
            soll = "|o" if optional else "||"
            if links != soll:
                fehler.append(
                    f"{pfad.name}:{nr}  {eltern_d} {links}--{rechts} {kind_d}\n"
                    f"    Elternseite sagt "
                    f"{'Pflicht' if links == '||' else 'optional'}, "
                    f"der Katalog sagt "
                    f"{'optional' if optional else 'Pflicht'}: "
                    + ", ".join(f"{kind}.{s} {'NOT NULL' if p else 'NULL erlaubt'}"
                                for s, p in spalten)
                    + f"\n    richtig waere: {eltern_d} {soll}--{rechts} {kind_d} : \"{bez}\"")

            ohne_kind = verwaist.get((eltern, kind))
            if rechts in ("|{", "||") and ohne_kind:
                hinweise.append(
                    f"{pfad.name}:{nr}  {eltern_d} {links}--{rechts} {kind_d}\n"
                    f"    Kindseite fordert mindestens eins, es gibt aber "
                    f"{ohne_kind} {eltern_d}-Zeile(n) ohne {kind_d}.")

    for f in fehler:
        print("FEHLER   " + f + "\n")
    for h in hinweise:
        print("HINWEIS  " + h + "\n")
    if uebersprungen:
        print("Uebersprungen (Vermerk erd-check: aus): " + ", ".join(uebersprungen))
    print(f"{geprueft} Beziehungen gegen den Katalog geprueft, "
          f"{len(fehler)} Fehler, {len(hinweise)} Hinweis(e).")
    return 1 if fehler else 0


if __name__ == "__main__":
    sys.exit(main())
