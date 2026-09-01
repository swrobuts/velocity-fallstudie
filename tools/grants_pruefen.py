#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Vergleicht die GRANTs aus db/aufbau/0011_sicherheit.sql mit der Datenbank.

Aufruf:
    python3 tools/grants_pruefen.py

Wozu
----
Die Abnahme prueft bisher nur die eine Richtung: dass keine Funktion
VERSEHENTLICH fuer jeden ausfuehrbar ist. Die andere Richtung fehlte -
dass ein Recht, das im Repo steht, in der Datenbank auch wirklich gesetzt
ist.

Genau daran ist der Preisschaetzer gescheitert: Funktion vorhanden,
Spalte vorhanden, Website ausgeliefert, GRANT im Repo - aber nie
eingespielt. Der Schalter meldete "Einstellung konnte nicht gespeichert
werden", und nichts im Projekt konnte sagen warum.

Ein Recht, das nur in einer SQL-Datei steht, wirkt nicht. Genauso wenig
wie ein Erfolgskriterium, das nur im Text steht.

Wie geprueft wird
-----------------
Aus 0011_sicherheit.sql werden alle 'grant execute on function ... to
<rolle>' und 'grant select on velocity.v_... to <rolle>' gelesen und
einzeln gegen has_function_privilege beziehungsweise
has_table_privilege geprueft.

Grenzen - bewusst benannt
-------------------------
Geprueft wird, was in dieser einen Datei steht. Rechte, die anderswo
vergeben werden, und Row-Level-Security-Regeln sieht das Werkzeug nicht.
Ohne .env-Zugang meldet es sich ab, statt gruen zu behaupten.
"""
from __future__ import annotations

import os
import pathlib
import re
import sys

WURZEL = pathlib.Path(__file__).resolve().parent.parent
QUELLE = WURZEL / "db" / "aufbau" / "0011_sicherheit.sql"

ROT, GRUEN, GELB, AUS = "\033[0;31m", "\033[0;32m", "\033[0;33m", "\033[0m"

FUNKTION = re.compile(
    r"grant\s+execute\s+on\s+function\s+(velocity\.\w+\([^)]*\))\s+to\s+(\w+)",
    re.IGNORECASE)
SICHT = re.compile(
    r"grant\s+select\s+on\s+(velocity\.v_\w+)\s+to\s+(\w+)", re.IGNORECASE)


def umgebung_laden() -> None:
    pfad = WURZEL / ".env"
    if not pfad.exists():
        return
    for zeile in pfad.read_text(encoding="utf-8").splitlines():
        if "=" in zeile and not zeile.strip().startswith("#"):
            k, w = zeile.split("=", 1)
            os.environ.setdefault(k.strip(), w.strip())


def main() -> int:
    umgebung_laden()
    try:
        import psycopg2
    except ImportError:
        print(f"{GELB}uebersprungen{AUS} psycopg2 fehlt")
        return 0
    if not os.environ.get("PGHOST"):
        print(f"{GELB}uebersprungen{AUS} kein Datenbankzugang in .env")
        return 0

    text = QUELLE.read_text(encoding="utf-8")
    funktionen = FUNKTION.findall(text)
    sichten = SICHT.findall(text)

    try:
        verbindung = psycopg2.connect(
            host=os.environ["PGHOST"], port=os.environ.get("PGPORT", "5432"),
            dbname=os.environ["PGDATABASE"], user=os.environ["PGUSER"],
            password=os.environ["PGPASSWORD"], connect_timeout=15)
    except Exception as fehler:
        print(f"{GELB}uebersprungen{AUS} keine Verbindung: {str(fehler)[:80]}")
        return 0

    zeiger = verbindung.cursor()
    fehlend = []

    for signatur, rolle in funktionen:
        try:
            zeiger.execute("select has_function_privilege(%s, %s, 'execute')",
                           (rolle, signatur))
            if not zeiger.fetchone()[0]:
                fehlend.append(("execute", rolle, signatur))
        except Exception:
            verbindung.rollback()
            fehlend.append(("execute", rolle, signatur + "  [Funktion fehlt]"))

    for sicht, rolle in sichten:
        try:
            zeiger.execute("select has_table_privilege(%s, %s, 'select')",
                           (rolle, sicht))
            if not zeiger.fetchone()[0]:
                fehlend.append(("select", rolle, sicht))
        except Exception:
            verbindung.rollback()
            fehlend.append(("select", rolle, sicht + "  [Sicht fehlt]"))

    gesamt = len(funktionen) + len(sichten)
    if fehlend:
        print(f"{ROT}FEHLEND{AUS}  {len(fehlend)} von {gesamt} Rechten stehen im "
              f"Repo, aber nicht in der Datenbank:")
        for art, rolle, ziel in fehlend:
            print(f"         {art:<8s} {rolle:<16s} {ziel}")
        print("\n         Ein Recht, das nur in der SQL-Datei steht, wirkt nicht.")
        return 1

    print(f"{GRUEN}ok{AUS}       alle {gesamt} Rechte aus 0011_sicherheit.sql sind gesetzt")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
