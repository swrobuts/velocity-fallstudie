#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Haelt jede Zahl im Fliesstext eines Notebooks gegen dessen eigene Ausgaben.

Aufruf:
    python3 tools/notebooktexte_pruefen.py
    python3 tools/notebooktexte_pruefen.py 02_Klassifikation_Wartungsrisiko

Wozu
----
Der teuerste Fehler dieses Projekts war nicht ein falsches Modell, sondern
ein stehengebliebener Satz. Dreimal dieselbe Ursache:

  * Notebook 2: Das Urteil wurde gedreht, der Export blieb auf der Regel.
  * Notebook 5: Der Lehrdatensatz wurde neu erzeugt, "von 42 Regeln
    ueberlebt eine" blieb - es waren 32 Regeln und keine ueberlebte.
  * Notebook 6: "von 6 % auf 40 %" blieb, gerechnet wurden 2 % und 36 %.

Keiner dieser Fehler war zu sehen, ohne Text und Ausgabe nebeneinander zu
legen. Von Hand geht das bei sechs Notebooks mit zusammen ueber 240 Zellen
nicht zuverlaessig - dieses Werkzeug tut es bei jedem Lauf.

Wie geprueft wird
-----------------
Jede Zahl im Markdown eines Notebooks muss in einer AUSGABE desselben
Notebooks vorkommen. Deutsche und englische Schreibweise gelten als
dieselbe Zahl, Prozentwerte auch als Bruchteil geschrieben.

Der Quelltext bleibt bewusst draussen: Dort stehen Bildgroessen,
Zufallsstartwerte und Farbcodes, und die decken falsche Textzahlen zu.

Grenzen - bewusst benannt
-------------------------
Das Werkzeug findet Zahlen, die nirgends ausgegeben werden. Es findet
keine Zahl aus dem falschen Zusammenhang und keine falsche Behauptung
ohne Zahl ("das Modell gewinnt"). Dafuer gibt es keinen Ersatz fuers
Lesen - aber es verkleinert das, was gelesen werden muss.
"""
from __future__ import annotations

import json
import pathlib
import re
import sys

WURZEL = pathlib.Path(__file__).resolve().parent.parent
NB = WURZEL / "analytics" / "notebooks"

# Zahlen, die zur Sprache gehoeren: Phasennummern, Abschnitte, Jahre,
# Schwellen aus Erfolgskriterien, Kostenkonstanten aus Phase 1.
HARMLOS = {
    "0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12",
    "20", "24", "30", "60", "90", "95", "99", "100", "180", "1999", "2026",
}

MIT_EINHEIT = re.compile(r"(\d{1,3}(?:[.\s]\d{3})*(?:,\d{1,2})?)\s?(%|€|Cent)")
OHNE_EINHEIT = re.compile(r"\b\d{1,3}(?:[.\s]\d{3})+(?:,\d{1,2})?\b|\b\d+,\d{1,2}\b")


def formen(zahl: str) -> set[str]:
    """Alle Schreibweisen, unter denen dieselbe Zahl gedruckt sein kann."""
    roh = zahl.replace(" ", "")
    v = {roh, roh.replace(",", "."), roh.replace(".", ""),
         roh.replace(".", "").replace(",", ".")}
    try:
        wert = float(roh.replace(".", "").replace(",", "."))
    except ValueError:
        return v
    for muster in ("{:g}", "{:.1f}", "{:.2f}", "{:.3f}"):
        s = muster.format(wert)
        v |= {s, s.replace(".", ",")}
    # Anteil statt Prozent
    for muster in ("{:.2f}", "{:.3f}", "{:g}"):
        s = muster.format(wert / 100)
        v |= {s, s.replace(".", ",")}
    return {s for s in v if s}


def pruefe(datei: pathlib.Path) -> list[tuple[str, str]]:
    nb = json.loads(datei.read_text(encoding="utf-8"))
    ausgaben, texte = [], []
    for c in nb["cells"]:
        if c["cell_type"] == "markdown":
            texte.append("".join(c["source"]))
        for o in c.get("outputs", []):
            ausgaben.append("".join(o.get("text", [])))
    raum = " ".join(ausgaben)
    befunde = []
    for text in texte:
        for zahl, einheit in MIT_EINHEIT.findall(text):
            if zahl in HARMLOS and einheit != "€":
                continue
            if not (formen(zahl) & set(re.findall(r"[\d.,]+", raum))):
                if not any(f in raum for f in formen(zahl)):
                    befunde.append((f"{zahl} {einheit}", zeile_um(text, zahl)))
        for zahl in OHNE_EINHEIT.findall(text):
            if not any(f in raum for f in formen(zahl)):
                befunde.append((zahl, zeile_um(text, zahl)))
    # Dubletten zusammenfassen
    gesehen, eindeutig = set(), []
    for z, kontext in befunde:
        if z in gesehen:
            continue
        gesehen.add(z)
        eindeutig.append((z, kontext))
    return eindeutig


def zeile_um(text: str, zahl: str) -> str:
    for z in text.split("\n"):
        if zahl in z:
            return z.strip()[:96]
    return ""


def main() -> int:
    gewuenscht = sys.argv[1:]
    dateien = [p for p in sorted(NB.glob("*.ipynb"))
               if not gewuenscht or p.stem in gewuenscht]
    if not dateien:
        raise SystemExit(f"Kein Notebook gefunden zu: {gewuenscht}")
    gesamt = 0
    for datei in dateien:
        befunde = pruefe(datei)
        gesamt += len(befunde)
        marke = "PRUEFEN" if befunde else "ok     "
        print(f"{marke}  {datei.stem}")
        for zahl, kontext in befunde:
            print(f"           {zahl:>12}   {kontext}")
    print(f"\n{len(dateien)} Notebook(s) geprueft, {gesamt} Zahl(en) ohne Entsprechung "
          f"in einer Ausgabe.")
    return 1 if gesamt else 0


if __name__ == "__main__":
    raise SystemExit(main())
