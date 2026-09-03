#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Liest Tabellen, Sichten, Funktionen und Spalten aus db/aufbau/*.sql.

WARUM ES DIESES MODUL GIBT

Zwei Pruefungen brauchen dieselbe Zaehlung: slides/check_deck_schema.py
haelt die Objektzahlen im Foliendeck gegen den Aufbau, und
tools/erd_vollstaendig.py prueft, dass jede Tabelle in einem Diagramm
vorkommt. Zwei Kopien eines SQL-Lesers wuerden auseinanderlaufen - genau
die Krankheit, gegen die beide Pruefungen gebaut sind.

BEZUGSRAHMEN

Gelesen wird ausschliesslich db/aufbau/*.sql. Die laufende Datenbank
enthaelt zusaetzlich, was db/betrieb/ anlegt (derzeit
uebernahme_protokoll). Der Bezug auf den Aufbau ist Absicht: er ist
versioniert und damit ueberhaupt pruefbar.

KALIBRIERUNG

spalten_je_tabelle() ist gegen doku/datenmodell/06-data-dictionary.md
geprueft, das aus dem Systemkatalog erzeugt wird: fuer jede dort
erfasste Tabelle stimmen beide Zaehlungen spaltengenau ueberein.

Dafuer braucht es einen echten Zustandsleser fuer SQL, keine Kette von
Ersetzungen. Drei Fallen liegen hier:

  1  Eine Klammer in einem Literal - daterange(current_date, null, '[)')
     - kippt die Klammerzaehlung, wenn Literale nicht neutralisiert sind.
  2  Ein "--" INNERHALB eines Literals schneidet dieses ab, wenn man
     Kommentare vor den Literalen entfernt. Danach ist jede weitere
     Paarbildung von Anfuehrungszeichen verschoben, und Namen fallen
     stumm aus der Zaehlung. Genau so verschwand api_kunde_sicherstellen.
  3  Funktionsrumpfe stehen in $$-Notation und enthalten dynamisches SQL
     ("execute format('grant select on velocity.%I ...')"). Sie werden
     mitgelesen als waeren sie Anweisungen, wenn man sie nicht ausblendet.

lies_sql() geht den Text deshalb einmal von links nach rechts durch und
kennt vier Zustaende: Text, Zeilenkommentar, Blockkommentar, Literal und
Dollarzitat. Kommentare und Rumpfe werden durch Leerzeichen ersetzt,
Literale durch Unterstriche gleicher Laenge - die Zeichenpositionen
bleiben damit erhalten.
"""
from __future__ import annotations

import pathlib
import re

WURZEL = pathlib.Path(__file__).resolve().parent.parent
AUFBAU = WURZEL / "db" / "aufbau"

TABELLE = r"create\s+table\s+(?:if\s+not\s+exists\s+)?velocity\.(\w+)"
SICHT = r"create\s+(?:or\s+replace\s+)?view\s+velocity\.(\w+)"
FUNKTION = r"create\s+(?:or\s+replace\s+)?function\s+velocity\.(\w+)"

# Woerter, die am Anfang eines create-table-Gliedes keine Spalte
# einleiten, sondern eine Tabellenbedingung.
KEINE_SPALTE = {"constraint", "primary", "foreign", "unique", "check",
                "exclude", "like", "references", "deferrable", "initially"}


def lies_sql(q: str) -> str:
    """Blendet Kommentare, Literale und Funktionsrumpfe aus, positionstreu.

    Ein Durchgang von links nach rechts. Kommentare und $$-Rumpfe werden
    zu Leerzeichen, Literalinhalte zu Unterstrichen; jedes Zeichen behaelt
    seine Stelle, damit Zeilennummern und Klammerzaehlung stimmen. Warum
    das kein Ersetzungsstapel sein kann, steht im Kopf dieser Datei.
    """
    aus, i, n = [], 0, len(q)
    while i < n:
        z, zwei = q[i], q[i:i + 2]
        if zwei == "--":
            while i < n and q[i] != "\n":
                aus.append(" "); i += 1
        elif zwei == "/*":
            tiefe = 1
            aus.append("  "); i += 2
            while i < n and tiefe:                      # in SQL schachtelbar
                if q[i:i + 2] == "/*": tiefe += 1; aus.append("  "); i += 2
                elif q[i:i + 2] == "*/": tiefe -= 1; aus.append("  "); i += 2
                else: aus.append(" " if q[i] != "\n" else "\n"); i += 1
        elif z == "'":
            aus.append("'"); i += 1
            while i < n:
                if q[i:i + 2] == "''": aus.append("__"); i += 2
                elif q[i] == "'": aus.append("'"); i += 1; break
                else: aus.append("_" if q[i] != "\n" else "\n"); i += 1
        elif z == "$" and (m := re.match(r"\$\w*\$", q[i:])):
            marke = m.group(0)
            aus.append(" " * len(marke)); i += len(marke)
            ende = q.find(marke, i)
            ende = n if ende < 0 else ende + len(marke)
            aus.append("".join(" " if c != "\n" else "\n" for c in q[i:ende]))
            i = ende
        else:
            aus.append(z); i += 1
    return "".join(aus)


def quelltext(von: int = 0, bis: int = 9999) -> str:
    """Die Aufbaudateien im Nummernbereich, durch lies_sql() gereinigt."""
    q = "\n".join(p.read_text(encoding="utf-8") for p in sorted(AUFBAU.glob("*.sql"))
                  if von <= int(p.name[:4]) <= bis)
    return lies_sql(q)


def namen(muster: str, von: int = 0, bis: int = 9999) -> set[str]:
    return {m.group(1) for m in re.finditer(muster, quelltext(von, bis), re.I)}


def spalten_je_tabelle() -> dict[str, list[str]]:
    """{tabelle: [spalten]} aus create table und alter table ... add column."""
    q = quelltext()
    aus: dict[str, list[str]] = {}
    for m in re.finditer(TABELLE + r"\s*\(", q, re.I):
        i, tiefe = m.end(), 1
        while i < len(q) and tiefe:
            tiefe += (q[i] == "(") - (q[i] == ")")
            i += 1
        rumpf, tiefe, letzter, glieder = q[m.end():i - 1], 0, 0, []
        for j, z in enumerate(rumpf):
            tiefe += (z == "(") - (z == ")")
            if z == "," and tiefe == 0:
                glieder.append(rumpf[letzter:j])
                letzter = j + 1
        glieder.append(rumpf[letzter:])
        aus[m.group(1)] = [w[0] for w in (g.split() for g in glieder)
                           if len(w) >= 2 and re.fullmatch(r"[a-z_]\w*", w[0])
                           and w[0].lower() not in KEINE_SPALTE]
    for m in re.finditer(r"alter\s+table\s+velocity\.(\w+)(.*?);", q, re.I | re.S):
        for c in re.findall(r"add\s+column\s+(?:if\s+not\s+exists\s+)?(\w+)",
                            m.group(2), re.I):
            if c not in aus.setdefault(m.group(1), []):
                aus[m.group(1)].append(c)
    return aus
