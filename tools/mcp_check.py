#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Haelt die Werkzeuge des MCP-Servers gegen die Datenbank.

WARUM ES DIESE PRUEFUNG BRAUCHT

mcp/server.py nennt 18 Sichten und ruft 15 api_-Funktionen - beides von
Hand aufgeschrieben. Handgeschriebene Listen ueber fremdem Code rosten;
dieses Projekt hat das schon dreimal erlebt (siehe readme_pruefen.py,
check_deck_schema.py, erd_vollstaendig.py). Der Unterschied hier: Ein
Werkzeug, dessen Funktion es nicht mehr gibt, faellt nicht beim Bauen
auf, sondern erst, wenn ein Agent es mitten in einer Vorfuehrung ruft.

WAS GEPRUEFT WIRD

  1  Jede in SICHTEN genannte Sicht existiert in der Datenbank.
  2  Jede v_wawi_-Sicht der Datenbank steht in SICHTEN - sonst entsteht
     eine Sicht, die die Oberflaeche kennt und der Agent nicht.
  3  Jede api_-Funktion, die 'authenticated' ausfuehren darf, ist
     entweder ein Werkzeug oder steht in NICHT_ANGEBOTEN. Eine dritte
     Moeglichkeit gibt es nicht: Auslassen ist erlaubt, Vergessen nicht.
  4  Jeder _rpc-Aufruf im Server nennt eine Funktion, die es gibt, und
     uebergibt nur Parameter, die sie hat. Das faengt den Fall, der am
     teuersten waere - eine umbenannte Spalte in einer Signatur.

Gelesen wird der Server ueber den Syntaxbaum, nicht ueber Textsuche: Ein
Aufruf, der ueber drei Zeilen umbrochen ist, soll genauso gefunden
werden wie einer in einer Zeile.

Aufruf: python3 tools/mcp_check.py
"""
from __future__ import annotations

import ast
import os
import pathlib
import re
import sys

WURZEL = pathlib.Path(__file__).resolve().parent.parent
SERVER = WURZEL / "mcp" / "server.py"
ANLEITUNG = WURZEL / "mcp" / "README.md"


def env_laden() -> None:
    pfad = WURZEL / ".env"
    if not pfad.exists():
        return
    for zeile in pfad.read_text(encoding="utf-8").splitlines():
        zeile = zeile.strip()
        if zeile and not zeile.startswith("#") and "=" in zeile:
            k, v = zeile.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip())


def aus_dem_server() -> tuple[dict, dict, dict[str, set[str]]]:
    """Liest SICHTEN, NICHT_ANGEBOTEN und alle _rpc-Aufrufe aus dem Server.

    Ohne den Server zu IMPORTIEREN: Er baut beim Import einen MCPServer
    auf und braucht die MCP-Bibliothek. Diese Pruefung soll auch dort
    laufen, wo sie nicht installiert ist - in der Abnahme etwa.
    """
    baum = ast.parse(SERVER.read_text(encoding="utf-8"))
    konstanten: dict[str, dict] = {}
    for knoten in baum.body:
        if isinstance(knoten, ast.Assign) and len(knoten.targets) == 1:
            ziel = knoten.targets[0]
            if isinstance(ziel, ast.Name) and ziel.id in ("SICHTEN", "NICHT_ANGEBOTEN"):
                konstanten[ziel.id] = ast.literal_eval(knoten.value)

    aufrufe: dict[str, set[str]] = {}
    for knoten in ast.walk(baum):
        if (isinstance(knoten, ast.Call) and isinstance(knoten.func, ast.Name)
                and knoten.func.id == "_rpc" and knoten.args):
            if not isinstance(knoten.args[0], ast.Constant):
                continue
            name = knoten.args[0].value
            aufrufe.setdefault(name, set()).update(
                kw.arg for kw in knoten.keywords if kw.arg)
    return konstanten.get("SICHTEN", {}), konstanten.get("NICHT_ANGEBOTEN", {}), aufrufe


def main() -> int:
    if not SERVER.exists():
        print(f"Server fehlt: {SERVER.relative_to(WURZEL)}")
        return 2
    sichten, ausgelassen, aufrufe = aus_dem_server()

    env_laden()
    try:
        import psycopg
    except ImportError:
        print("psycopg fehlt — ohne Datenbank ist nichts zu prüfen.")
        return 2
    try:
        con = psycopg.connect(host=os.environ["PGHOST"], port=os.environ["PGPORT"],
                              dbname=os.environ["PGDATABASE"],
                              user=os.environ["PGUSER"],
                              password=os.environ["PGPASSWORD"])
    except Exception as fehler:                        # noqa: BLE001
        print(f"Keine Verbindung zur Datenbank: {fehler}")
        return 2

    db_sichten = {r[0] for r in con.execute(
        "select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace "
        "where n.nspname='velocity' and c.relkind='v' and c.relname like 'v\\_wawi\\_%'"
    ).fetchall()}
    db_funktionen = {
        r[0]: set(r[1] or [])
        for r in con.execute(
            "select p.proname, p.proargnames from pg_proc p "
            "join pg_namespace n on n.oid=p.pronamespace "
            "where n.nspname='velocity' and p.proname like 'api\\_%' "
            "and has_function_privilege('authenticated', p.oid, 'execute')"
        ).fetchall()}
    con.close()

    funde: list[tuple[str, str]] = []

    for name in sichten:
        if name not in db_sichten:
            funde.append((name, "steht im Server, gibt es in der Datenbank nicht"))
    for name in sorted(db_sichten - set(sichten)):
        funde.append((name, "gibt es in der Datenbank, der Server kennt sie nicht"))

    abgedeckt = set(aufrufe) | set(ausgelassen)
    for name in sorted(set(db_funktionen) - abgedeckt):
        funde.append((name, "weder Werkzeug noch in NICHT_ANGEBOTEN — "
                            "Auslassen ist erlaubt, Vergessen nicht"))
    for name in sorted(set(ausgelassen) - set(db_funktionen)):
        funde.append((name, "als ausgelassen geführt, gibt es aber nicht mehr"))

    for name, parameter in sorted(aufrufe.items()):
        if name not in db_funktionen:
            funde.append((name, "wird vom Server gerufen, gibt es nicht "
                                "(oder authenticated darf sie nicht)"))
            continue
        fremd = parameter - db_funktionen[name]
        if fremd:
            funde.append((name, f"übergibt {', '.join(sorted(fremd))} — "
                                f"die Funktion kennt nur "
                                f"{', '.join(sorted(db_funktionen[name]))}"))

    # Die Anleitung nennt beide Zahlen von Hand. Sie stand am 05.09.2026
    # falsch - "15 api_-Funktionen", waehrend es 16 waren, seit
    # api_kunde_loeschen dazukam. Dieselbe Sorte Fehler wie die
    # Pruefungszahl in TESTEN.md, und derselbe Weg dagegen: zaehlen.
    anleitung = ANLEITUNG.read_text(encoding="utf-8") if ANLEITUNG.exists() else ""
    for zahl, muster, was in (
            (len(sichten),  r"(\d+) Sichten zum Lesen",       "Sichten"),
            (len(aufrufe),  r"(\d+) `api_`-Funktionen zum",   "api_-Funktionen")):
        m = re.search(muster, anleitung)
        if m is None:
            funde.append(("mcp/README.md",
                          f"die Angabe zur Zahl der {was} steht nicht mehr da"))
        elif int(m.group(1)) != zahl:
            funde.append(("mcp/README.md",
                          f"nennt {m.group(1)} {was}, der Server bietet {zahl}"))

    print(f"{len(sichten)} Sichten und {len(aufrufe)} api_-Aufrufe des "
          f"MCP-Servers gegen die Datenbank\n  ({len(db_sichten)} v_wawi_-Sichten, "
          f"{len(db_funktionen)} api_-Funktionen für authenticated, "
          f"{len(ausgelassen)} bewusst ausgelassen)")
    if not funde:
        print("  Jedes Werkzeug zeigt auf ein Objekt, das es gibt.")
        return 0
    print(f"  {len(funde)} Befund(e):\n")
    for name, warum in funde:
        print(f"  FEHLER  {name}")
        print(f"          {warum}")
    return 1


if __name__ == "__main__":
    sys.exit(main())
