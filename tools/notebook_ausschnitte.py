#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Schneidet einzelne Zellen aus den Notebooks als PNG fuer das Foliendeck.

Aufruf:
    python3 tools/notebook_ausschnitte.py            # alle
    python3 tools/notebook_ausschnitte.py nb1-kriterium

Warum ueberhaupt Ausschnitte?
----------------------------
Das CRISP-DM-Deck ist als LESEHILFE zu den Notebooks gedacht. Eine Folie,
die eine Zahl nennt, ohne zu zeigen, wo sie herkommt, laesst die
Studierenden im Notebook suchen. Ein Ausschnitt der Zelle - Code UND
Ausgabe, so wie es im Browser aussieht - schliesst diese Luecke.

Wie es arbeitet
---------------
1. jupyter nbconvert wandelt das Notebook nach HTML (Vorlage 'lab').
2. Aus dem HTML werden die gesuchten jp-Cell-Container geschnitten und
   mit den originalen <style>-Bloecken in eine eigenstaendige Seite
   gestellt - dieselbe Darstellung wie im Notebook, ohne Drumherum.
3. Google Chrome im Kopflosbetrieb macht davon eine Aufnahme.
4. Pillow schneidet den weissen Rand weg.

Ausgewaehlt werden die Zellen ueber einen SUCHTEXT, nicht ueber ihre
Nummer: Nummern verschieben sich, sobald jemand eine Zelle einfuegt, und
dann zeigt die Folie klaglos die falsche Stelle.
"""
from __future__ import annotations

import pathlib
import subprocess
import sys
import tempfile

from bs4 import BeautifulSoup
from PIL import Image

WURZEL = pathlib.Path(__file__).resolve().parent.parent
NB     = WURZEL / "analytics" / "notebooks"
ZIEL   = WURZEL / "slides" / "assets"
CHROME = pathlib.Path("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")

# name -> (notebook, suchtext, folgende Zellen, Breite in px, Teil)
#
# Teil: ""        ganze Zelle, Code und Ausgabe
#       "ausgabe" nur die Ausgabe - fuer Zellen, deren Code so lang ist,
#                 dass das Bild auf der Folie zu schmal geraet. Der Code
#                 steht im Notebook; die Folie zeigt, was herauskam.
#
# Der Suchtext muss die Zelle eindeutig treffen. Geprueft wird das: Wer
# mehrdeutig sucht, bekommt einen Abbruch statt eines falschen Bildes.
AUSSCHNITTE = {
    # ── Notebook 1: der Referenzfall
    "nb1-kriterium": ("01_Regression_Fahrtdauer",
                      "Erlaubter Schätzfehler bei 50 Cent", 0, 1180),
    "nb1-leakage": ("01_Regression_Fahrtdauer", "gesperrt", 0, 1180),
    "nb1-modelle": ("01_Regression_Fahrtdauer", "Bestes Modell: Random Forest", 0, 1180),
    "nb1-preisfehler": ("01_Regression_Fahrtdauer",
                        "Anteil der Fahrten mit unter 50 Cent Abweichung", 0, 1180),
    "nb1-schatten": ("01_Regression_Fahrtdauer", "Schattenbetrieb, nur", 0, 1180),

    # ── Notebook 2: die Regel gewinnt
    "nb2-kosten": ("02_Klassifikation_Wartungsrisiko", "Kostenmatrix", 0, 1180),
    "nb2-schnitt": ("02_Klassifikation_Wartungsrisiko",
                    "Training: 1458 Zeilen aus 7 Stichtagen", 0, 1180),
    "nb2-gleichstand": ("02_Klassifikation_Wartungsrisiko",
                        "Erfolgskriterien aus Phase 1, für beide Kandidaten", 0, 1180, "ausgabe"),

    # ── Notebook 3: ohne Zielgroesse
    "nb3-k": ("03_Clustering_Stationen_und_Kunden", "56.9       0.659", 0, 1180, "ausgabe"),
    "nb3-hypothese": ("03_Clustering_Stationen_und_Kunden",
                      "HYPOTHESE, kein Befund", 0, 1180),

    # ── Notebook 4: Zeit, Stoergroesse und Kosten
    "nb4-stoergroesse": ("04_Zeitreihe_Nachfrageprognose", "BEI 15-22 GRAD", 0, 1180),
    "nb4-aufschlag": ("04_Zeitreihe_Nachfrageprognose",
                      "Kosten der reinen Prognose über 90 Tage", 0, 1180, "ausgabe"),
    "nb4-ehrlich": ("04_Zeitreihe_Nachfrageprognose",
                    "mit simulierter Wettervorhersage", 0, 1180),

    # ── Notebook 5: die Huerden sieben
    "nb5-regel": ("05_Assoziation_Wege_im_Netz", "WENN Start = Hubland", 0, 1180),
    "nb5-huerden": ("05_Assoziation_Wege_im_Netz", "Regeln insgesamt:", 0, 1180, "ausgabe"),

    # ── Notebook 6: der Ruecksprung
    "nb6-fehlschlag": ("06_Anomalieerkennung_Auffaellige_Vorgaenge",
                       "50573       85.0    CARGO", 0, 1180),
    "nb6-korrektur": ("06_Anomalieerkennung_Auffaellige_Vorgaenge",
                      "Radtyp-Verteilung der 50 auffälligsten Vorgänge, jetzt", 0, 1180),
    "nb6-aufgabeB": ("06_Anomalieerkennung_Auffaellige_Vorgaenge",
                     "gefundene Störungen", 0, 1180),
}


def html_erzeugen(name: str, cache: pathlib.Path) -> pathlib.Path:
    """Wandelt ein Notebook nach HTML, einmal je Lauf."""
    ziel = cache / f"{name}.html"
    if ziel.exists():
        return ziel
    subprocess.run(
        ["jupyter", "nbconvert", "--to", "html", "--template", "lab",
         "--output-dir", str(cache), "--output", name, str(NB / f"{name}.ipynb")],
        check=True, capture_output=True)
    return ziel


def zellen_schneiden(html: pathlib.Path, suchtext: str, folgende: int,
                    teil: str = "") -> str:
    """Baut eine eigenstaendige Seite aus den getroffenen Zellen."""
    suppe = BeautifulSoup(html.read_text(encoding="utf-8"), "html.parser")
    zellen = suppe.select("div.jp-Cell")
    treffer = [i for i, z in enumerate(zellen) if suchtext in z.get_text()]
    if not treffer:
        raise SystemExit(f"ABBRUCH: „{suchtext}“ in {html.name} nicht gefunden")
    if len(treffer) > 1:
        raise SystemExit(
            f"ABBRUCH: „{suchtext}“ trifft {len(treffer)} Zellen in {html.name}. "
            "Suchtext praezisieren - ein mehrdeutiger Treffer waere ein falsches "
            "Bild ohne Fehlermeldung.")
    i = treffer[0]
    gewaehlt = zellen[i:i + 1 + folgende]
    if teil == "ausgabe":
        nur = []
        for z in gewaehlt:
            nur.extend(z.select("div.jp-Cell-outputWrapper") or
                       z.select("div.jp-OutputArea"))
        if not nur:
            raise SystemExit(f"ABBRUCH: keine Ausgabe in der Zelle zu „{suchtext}“")
        gewaehlt = nur
    stile = "".join(str(s) for s in suppe.find_all("style"))
    inhalt = "".join(str(z) for z in gewaehlt)
    return (f"<!doctype html><html><head><meta charset='utf-8'>{stile}"
            "<style>body{margin:0;padding:16px;background:#fff}"
            ".jp-Cell{margin:0 !important}</style></head>"
            f"<body><div class='jp-Notebook'>{inhalt}</div></body></html>")


def aufnehmen(seite: str, ziel: pathlib.Path, breite: int) -> None:
    with tempfile.TemporaryDirectory() as tmp:
        quelle = pathlib.Path(tmp) / "ausschnitt.html"
        quelle.write_text(seite, encoding="utf-8")
        roh = pathlib.Path(tmp) / "roh.png"
        subprocess.run(
            [str(CHROME), "--headless=new", "--disable-gpu", "--hide-scrollbars",
             f"--screenshot={roh}", f"--window-size={breite},2400",
             "--force-device-scale-factor=2", f"file://{quelle}"],
            check=True, capture_output=True)
        bild = Image.open(roh).convert("RGB")
        # Weissen Rand wegschneiden: sonst steht der Ausschnitt als
        # Briefmarke in einer riesigen leeren Flaeche.
        grau = bild.convert("L")
        maske = grau.point(lambda p: 255 if p < 250 else 0)
        kasten = maske.getbbox()
        if kasten:
            x0, y0, x1, y1 = kasten
            rand = 12
            bild = bild.crop((max(0, x0 - rand), max(0, y0 - rand),
                              min(bild.width, x1 + rand), min(bild.height, y1 + rand)))
        ziel.parent.mkdir(parents=True, exist_ok=True)
        bild.save(ziel)


def main() -> int:
    if not CHROME.exists():
        raise SystemExit(f"Chrome nicht gefunden: {CHROME}")
    gewuenscht = sys.argv[1:] or list(AUSSCHNITTE)
    cache = pathlib.Path(tempfile.gettempdir()) / "velocity-nb-html"
    cache.mkdir(exist_ok=True)
    fehler = 0
    for name in gewuenscht:
        if name not in AUSSCHNITTE:
            print(f"FEHLER unbekannter Ausschnitt: {name}")
            fehler += 1
            continue
        eintrag = AUSSCHNITTE[name]
        nb_name, suchtext, folgende, breite = eintrag[:4]
        teil = eintrag[4] if len(eintrag) > 4 else ""
        try:
            html = html_erzeugen(nb_name, cache)
            seite = zellen_schneiden(html, suchtext, folgende, teil)
            ziel = ZIEL / f"{name}.png"
            aufnehmen(seite, ziel, breite)
            b = Image.open(ziel).size
            print(f"OK     {name:20} {b[0]:5} x {b[1]:5} px  aus {nb_name}")
        except SystemExit as e:
            print(f"FEHLER {name:20} {e}")
            fehler += 1
    print(f"\n{len(gewuenscht) - fehler} von {len(gewuenscht)} Ausschnitten erzeugt.")
    return 1 if fehler else 0


if __name__ == "__main__":
    raise SystemExit(main())
