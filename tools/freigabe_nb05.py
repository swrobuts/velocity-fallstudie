#!/usr/bin/env python3
"""Prueft, ob Notebook 05 alle Aussagen traegt, auf denen seine Lehrfreigabe beruht.

Der Bau-Pruefer sichert Zahlen und Code. Er sichert NICHT, dass eine
sprachliche Ueberarbeitung eine freigaberelevante Aussage entfernt. Diese
Liste stammt aus dem Freigabeurteil des Pruefers und wird nach jeder
Textaenderung gegen das gebaute Notebook gehalten.

Aufruf: python3 tools/freigabe_nb05.py
"""
import json
import pathlib
import re
import sys

NB = (pathlib.Path(__file__).resolve().parent.parent
      / "analytics" / "notebooks" / "05_Assoziation_Wege_im_Netz.ipynb")

# (Bezeichnung, Muster, wo) - "md" nur Fliesstext, "aus" nur Ausgaben, "alle" beides
PFLICHT = [
    ("Zwei Produkte mit eigenen Kriterien",
     r"Produkt A.{0,80}Produkt B|Produkt B.{0,80}Produkt A", "md"),
    ("A4 als vierte, wirtschaftliche Huerde", r"\bA4\b", "md"),
    ("B1 bis B4 benannt", r"B1.{0,400}B4", "md"),
    ("Kontextbedingter Lift als gewaehlter Nenner",
     r"kontextbedingter? Lift", "md"),
    ("Beide Lift-Werte nebeneinander", r"klassische[rn]? Lift", "md"),
    ("Versiegelung vor der Regelsuche",
     r"versiegel|Bestätigungszeitraum, den die Suche nicht gesehen", "alle"),
    ("Bootstrap-Untergrenze als B1-Bedingung",
     r"[Uu]ntere .{0,30}Grenze eines Tagesblock-Bootstraps|"
     r"Bootstrap-Untergrenze", "alle"),
    ("Ausschluss zweigeteilt (Punktschaetzer / Intervall)",
     r"schon am\s*\n?\s*Punktschaetzer", "aus"),
    ("A4-Zustand nicht pruefbar", r"nicht prüfbar", "md"),
    ("Produkt B als analytisches Lehr-Gate",
     r"analytisches Lehr-Gate", "alle"),
    ("Keine reale Betriebsfreigabe", r"keine reale\s*\n?\s*Betriebsfreigabe", "alle"),
    ("Huerde nicht nachtraeglich verschoben",
     r"nicht (nachträglich )?verschoben|wird \*\*nicht\*\* ersetzt|"
     r"wird \*\*nicht\*\* ersetzt|Hürde wird \*\*nicht\*\*", "md"),
    ("Szenarioannahmen statt gemessener Kosten",
     r"[Ss]zenarioannahmen", "md"),
    ("Explorativ-Kennzeichnung der Begleitanalysen", r"explorativ", "alle"),
    ("Datenschutzhinweis zum Bewegungsprofil", r"Bewegungsprofil", "md"),
    ("Synthetische Lehrdaten benannt", r"synthetisch", "alle"),
    ("Tagesgenaue Pendler-Gegenprobe", r"Tagesbindung|am selben Tag", "alle"),
]


def main():
    d = json.loads(NB.read_text(encoding="utf-8"))
    md, aus = [], []
    for c in d["cells"]:
        if c["cell_type"] == "markdown":
            md.append("".join(c["source"]))
        else:
            for o in c.get("outputs", []):
                aus.append("".join(o.get("text", [])))
    texte = {"md": "\n".join(md), "aus": "\n".join(aus)}
    texte["alle"] = texte["md"] + "\n" + texte["aus"]

    # Abschnittsfolge muss aufsteigen - das war ein eigener Freigabepunkt.
    nummern = [tuple(int(x) for x in m.group(1).split("."))
               for m in re.finditer(r"^#{1,4} (\d\.\d)\b", texte["md"], re.M)]
    fehler = []
    if nummern != sorted(nummern):
        fehler.append(f"Abschnittsfolge nicht aufsteigend: {nummern}")

    for name, muster, wo in PFLICHT:
        if not re.search(muster, texte[wo], re.I):
            fehler.append(f"FEHLT: {name}")

    print(f"Freigabepruefliste Notebook 05 - {len(PFLICHT) + 1} Punkte")
    for f in fehler:
        print(f"  ! {f}")
    if fehler:
        print(f"\n{len(fehler)} Punkt(e) nicht belegt. Die Freigabe waere gefaehrdet.")
        return 1
    print("  alle Punkte belegt.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
