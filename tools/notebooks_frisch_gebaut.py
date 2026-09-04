#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Prueft, ob die abgelegten Notebooks aus einem sauberen Lauf stammen.

WARUM ES DIESE PRUEFUNG BRAUCHT

Die Notebooks in analytics/notebooks/ sind Bauprodukte: Sie entstehen aus
analytics/bau/ und werden dabei von oben nach unten durchgerechnet. Auf
GitHub soll jedes Ergebnis lesbar sein, ohne dass jemand etwas startet -
deshalb sind die Ausgaben mit versioniert.

Genau das macht sie empfindlich. Wer ein Notebook in PyCharm oder Jupyter
oeffnet und ein paar Zellen ausfuehrt, schreibt in die Datei: Die
Ausfuehrungszaehler springen dorthin, wo der Kernel gerade steht, und die
Ausgaben der uebersprungenen Zellen fehlen.

Am 04.09.2026 lag genau so ein Stand im Arbeitsbaum: Notebook 1 mit
Zaehlern ab 7 statt ab 1 und 862 verlorenen Ausgabezeilen. Committet
waere daraus ein Notebook geworden, das auf GitHub halb leer aussieht -
obwohl der Pruefer es freigegeben hatte. Aufgefallen ist es nur zufaellig.

WAS GEPRUEFT WIRD

Ein frisch gebautes Notebook hat in seinen Codezellen die
Ausfuehrungszaehler 1, 2, 3 ... ohne Luecke und ohne Sprung. Jede andere
Folge heisst: Hier ist von Hand gerechnet worden, und der Stand ist nicht
der gebaute.

Geprueft wird ausserdem, dass keine Codezelle ohne Zaehler dasteht - das
waere eine nie ausgefuehrte Zelle, also eine Luecke in den Ausgaben.

WAS DIESE PRUEFUNG NICHT LEISTET

Sie vergleicht nicht mit einem frischen Bau. Zwei Laeufe unterscheiden
sich auch bei identischem Ergebnis: Jupyter verteilt dieselbe Ausgabe
unterschiedlich auf Bloecke, und eine pandas-Styler-Tabelle traegt je
Lauf eine andere Zufallskennung. Ein Vergleich Zeichen fuer Zeichen wuerde
staendig falsch anschlagen; die Zaehlerfolge dagegen ist eindeutig.

Aufruf: python3 tools/notebooks_frisch_gebaut.py
"""
from __future__ import annotations

import json
import pathlib
import sys

WURZEL = pathlib.Path(__file__).resolve().parent.parent
NOTEBOOKS = WURZEL / "analytics" / "notebooks"


def main() -> int:
    dateien = sorted(NOTEBOOKS.glob("*.ipynb"))
    if not dateien:
        print(f"Keine Notebooks in {NOTEBOOKS.relative_to(WURZEL)}")
        return 2

    funde: list[tuple[str, str]] = []
    for pfad in dateien:
        nb = json.loads(pfad.read_text(encoding="utf-8"))
        code = [c for c in nb["cells"] if c["cell_type"] == "code"]
        zaehler = [c.get("execution_count") for c in code]

        ohne = [i + 1 for i, z in enumerate(zaehler) if z is None]
        if ohne:
            funde.append((pfad.name,
                          f"{len(ohne)} Codezelle(n) ohne Ausführungszähler "
                          f"(die {ohne[0]}. ist die erste) — nie ausgeführt, "
                          f"also ohne Ausgabe"))
            continue

        soll = list(range(1, len(zaehler) + 1))
        if zaehler != soll:
            erste = next(i for i, (a, b) in enumerate(zip(zaehler, soll)) if a != b)
            funde.append((pfad.name,
                          f"Zähler {zaehler[:6]}… statt 1, 2, 3 … — "
                          f"erste Abweichung an Codezelle {erste + 1}"))

    print(f"{len(dateien)} Notebooks auf einen sauberen Lauf geprüft")
    if not funde:
        print("  Alle Ausführungszähler laufen lückenlos ab 1.")
        return 0
    print(f"  {len(funde)} Befund(e):\n")
    for name, warum in funde:
        print(f"  FEHLER  {name}")
        print(f"          {warum}")
    print("\n  Diese Notebooks sind von Hand gerechnet worden und nicht der\n"
          "  gebaute Stand. Verwerfen mit\n"
          "      git restore analytics/notebooks/\n"
          "  oder neu bauen mit\n"
          "      cd analytics/bau && python3 bauen.py")
    return 1


if __name__ == "__main__":
    sys.exit(main())
