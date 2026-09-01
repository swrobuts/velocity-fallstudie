#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Findet Erfolgskriterien, die berechnet, aber nie wirksam werden.

Aufruf:
    python3 tools/tote_schwellen_pruefen.py
    python3 tools/tote_schwellen_pruefen.py 03_Clustering_Stationen_und_Kunden

Wozu
----
Der teuerste wiederkehrende Fehler dieses Projekts hat immer dieselbe Form:
Eine Schwelle wird geprueft, das Ergebnis wird gedruckt - und dann
passiert trotzdem, was ohnehin geplant war.

  * Notebook 3: "Segmentwechsel 25,4 % -> Schwelle GERISSEN" stand da,
    drei Zellen spaeter wurde die Kampagnenliste exportiert, als waere
    nichts gewesen.
  * Notebook 5: "handlungsfaehig" wurde berechnet und im Urteil nicht
    verwendet.
  * Notebook 6: Die Contamination-Schwelle steuerte die Tagesliste nicht.

Ein Kriterium, das keine Verzweigung im Code beeinflusst, ist Dekoration.
Von Hand faellt das nicht auf, weil der Satz ja dasteht.

Wie geprueft wird
-----------------
Im Quelltext jedes Notebooks werden Namen gesucht, die nach einem
Kriterium aussehen (GATE_, KRITERIUM_, SCHWELLE, _STABIL, erfuellt,
freigabe, gerissen ...). Fuer jeden gefundenen Namen wird geprueft, ob er
nach seiner Zuweisung noch einmal GELESEN wird - in einer Bedingung, einem
Vergleich, einem Funktionsaufruf oder einer weiteren Zuweisung.

Namen, die nur zugewiesen und hoechstens ausgedruckt werden, sind
verdaechtig: Sie beschreiben ein Kriterium, das nichts entscheidet.

Grenzen - bewusst benannt
-------------------------
Das Werkzeug findet tote Namen. Es findet keine Schwelle, die zwar
gelesen, aber falsch angewandt wird, und keine, die gar nicht erst
berechnet wurde. Ein reiner Anzeigewert (z. B. eine Vergleichszahl) kann
zu Recht ungenutzt bleiben - solche Namen gehoeren in AUSNAHMEN.
"""
from __future__ import annotations

import json
import pathlib
import re
import sys

WURZEL = pathlib.Path(__file__).resolve().parent.parent
NOTEBOOKS = WURZEL / "analytics" / "notebooks"

# Woerter, an denen ein Urteil erkennbar ist.
URTEIL = re.compile(
    r"GERISSEN|ERF[ÜU]LLT|FREIGEGEBEN|GESPERRT|BESTANDEN|NICHT FREIGEGEBEN|"
    r"MACHBARKEIT|R[ÜU]CKSPRUNG|gehalten",
)
BEZEICHNER = re.compile(r"\b([A-Za-z_][A-Za-z0-9_]*)\b")
SCHLUESSELWOERTER = {
    "if", "else", "elif", "for", "in", "and", "or", "not", "is", "None", "True",
    "False", "print", "f", "len", "int", "float", "str", "round", "sum", "min",
    "max", "abs", "set", "list", "dict", "sorted", "range", "pd", "np", "format",
}

# Bewusste Anzeigewerte: berechnet, um sie danebenzustellen, nicht um zu
# entscheiden. Jede Zeile hier ist eine begruendete Ausnahme.
AUSNAHMEN: set[str] = set()

ROT, GRUEN, GELB, AUS = "\033[0;31m", "\033[0;32m", "\033[0;33m", "\033[0m"


def quelltext(nb: dict) -> str:
    return "\n".join("".join(z["source"]) for z in nb["cells"]
                      if z["cell_type"] == "code")


def zugewiesene(zeilen: list[str]) -> set[str]:
    """Alle Namen, denen im Notebook irgendwo etwas zugewiesen wird."""
    muster = re.compile(r"^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=(?!=)")
    return {m.group(1) for z in zeilen if (m := muster.match(z))}


def pruefe(pfad: pathlib.Path) -> list[tuple[str, str]]:
    """Urteilszeilen, an denen keine einzige Entscheidung haengt."""
    nb = json.loads(pfad.read_text(encoding="utf-8"))
    zeilen = quelltext(nb).split("\n")
    namen = zugewiesene(zeilen) - AUSNAHMEN
    befunde = []
    for nr, zeile in enumerate(zeilen):
        if not URTEIL.search(zeile) or "print" not in zeile:
            continue
        # Woran haengt dieses Urteil?
        traeger = {n for n in BEZEICHNER.findall(zeile)
                   if n in namen and n not in SCHLUESSELWOERTER}
        if not traeger:
            continue
        # Wird mindestens einer davon IRGENDWO ausserhalb eines print
        # gelesen - also so, dass er eine Entscheidung beeinflussen kann?
        wirksam = False
        for n in traeger:
            wort = re.compile(rf"\b{re.escape(n)}\b")
            for andere_nr, andere in enumerate(zeilen):
                if andere_nr == nr or not wort.search(andere):
                    continue
                ohne_druck = re.sub(r"print\s*\(.*", "", andere)
                if re.match(rf"^\s*{re.escape(n)}\s*=(?!=)", andere):
                    continue          # die Zuweisung selbst zaehlt nicht
                if wort.search(ohne_druck):
                    wirksam = True
                    break
            if wirksam:
                break
        if not wirksam:
            befunde.append((", ".join(sorted(traeger)), zeile.strip()[:72]))
    return befunde


def main() -> int:
    gewuenscht = sys.argv[1:]
    dateien = sorted(NOTEBOOKS.glob("*.ipynb"))
    if gewuenscht:
        dateien = [d for d in dateien if any(g in d.stem for g in gewuenscht)]
    if not dateien:
        print(f"Kein Notebook gefunden zu: {gewuenscht}")
        return 1

    gesamt = 0
    for datei in dateien:
        befunde = pruefe(datei)
        gesamt += len(befunde)
        if befunde:
            print(f"{GELB}PRUEFEN {AUS} {datei.stem}")
            for name, zeile in befunde:
                print(f"         {ROT}{name}{AUS} wird zugewiesen, aber nie "
                      f"gelesen:  {zeile}")
        else:
            print(f"{GRUEN}ok      {AUS} {datei.stem}")

    print(f"\n{len(dateien)} Notebook(s) geprueft, {gesamt} Kriterium/Kriterien "
          f"ohne Wirkung im Code.")
    return 1 if gesamt else 0


if __name__ == "__main__":
    raise SystemExit(main())
