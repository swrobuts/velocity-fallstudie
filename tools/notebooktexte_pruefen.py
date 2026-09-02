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
Jede Zahl im Markdown muss in einer Ausgabe IN IHRER NAEHE vorkommen -
in den Zellen, auf die der Satz sich bezieht, nicht irgendwo im Notebook.

Diese Naehe ist der ganze Punkt. Die erste Fassung dieses Werkzeugs suchte
jede Textzahl im gesamten Ausgaberaum des Notebooks. Der enthaelt rund 250
verschiedene Zahlen; nachgemessen kamen damit 50 von 99 frei erfundenen
Prozentwerten unbemerkt durch. Ein Pruefer, der jede zweite falsche Zahl
durchlaesst, ist keine Pruefung, sondern eine Muenze - er hat in Notebook 2
dreizehn widersprechende Zahlen bestaetigt, die ein Gutachten dann fand.

Das Fenster (FENSTER_VOR Codezellen davor, FENSTER_NACH danach) bildet ab,
worauf ein Fliesstext sich tatsaechlich beruft: auf die Ausgabe direkt
darueber, gelegentlich auf die gleich folgende.

Der Quelltext bleibt bewusst draussen: Dort stehen Bildgroessen,
Zufallsstartwerte und Farbcodes, und die decken falsche Textzahlen zu.

Grenzen - bewusst benannt
-------------------------
Das Werkzeug findet Zahlen ohne Beleg in der Naehe. Es findet keine Zahl,
die zufaellig auch in der Nachbarausgabe steht, und keine falsche
Behauptung ohne Zahl ("das Modell gewinnt"; dafuer gibt es
pruefe_hartes_urteil in notebook_pruefungen.py). Ersatz fuers Lesen ist es
nicht - aber es verkleinert das, was gelesen werden muss, erheblich.
"""
from __future__ import annotations

import json
import pathlib
import re
import sys

WURZEL = pathlib.Path(__file__).resolve().parent.parent
NB = WURZEL / "analytics" / "notebooks"
WERTE = WURZEL / "analytics" / "bau" / "werte"
_PLATZHALTER_TEXT = re.compile(r"\{\{[a-z0-9_]+(?::[^}]*)?\}\}")

# Zahlen, die zur Sprache gehoeren: Phasennummern, Abschnitte, Jahre,
# Schwellen aus Erfolgskriterien, Kostenkonstanten aus Phase 1.
HARMLOS = {
    "0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12",
    "20", "24", "30", "60", "90", "95", "99", "100", "180", "1999", "2026",
}

MIT_EINHEIT = re.compile(r"(\d{1,3}(?:[.\s]\d{3})*(?:,\d{1,2})?)\s?(%|€|Cent)")
# Blanke ganze Zahlen. Sie waren die groesste Luecke dieses Werkzeugs: Bis
# hierher sah es nur Zahlen mit Einheit oder Dezimalkomma - "102 auffaellige
# Raeder", "63 fahruntauglich", "seit 592 km", "17 von 60", "228 Zeilen"
# liefen alle daran vorbei. Ein Gutachten fand genau diese fuenf.
GANZZAHL = re.compile(r"(?<![\d,.%-])(\d{2,6})(?![\d,.%])")
# Nicht jede ganze Zahl ist eine Messung. Jahreszahlen, Uhrzeiten und
# Seitenangaben sind Sprache, keine Ergebnisse - sie zu melden erzeugt
# Rauschen, und ein Pruefer mit Rauschen wird ueberlesen.
KEIN_MESSWERT = (
    re.compile(r"\bS\.\s?\d"),          # Seitenangabe in einer Quelle
    re.compile(r"\d:\d"),                # Uhrzeit
)


def sprachzahl(zahl: str, zeile: str) -> bool:
    """Jahreszahl, Uhrzeit oder Seitenangabe statt Messwert?"""
    if zahl.isdigit() and len(zahl) == 4 and 1900 <= int(zahl) <= 2100:
        return True
    stelle = zeile.find(zahl)
    if stelle < 0:
        return False
    umfeld = zeile[max(0, stelle - 4):stelle + len(zahl) + 3]
    return any(m.search(umfeld) for m in KEIN_MESSWERT)
OHNE_EINHEIT = re.compile(r"\b\d{1,3}(?:[.\s]\d{3})+(?:,\d{1,2})?\b|\b\d+,\d{1,2}\b")


def formen(zahl: str) -> set[str]:
    """Alle Schreibweisen, unter denen dieselbe Zahl gedruckt sein kann."""
    roh = zahl.replace(" ", "")
    v = {roh, roh.replace(",", "."), roh.replace(".", ""),
         roh.replace(".", "").replace(",", "."),
         # Der Fliesstext trennt Tausender mit Punkt, pandas mit Komma.
         # Beides meint dieselbe Zahl.
         roh.replace(".", ","), roh.replace(",", "")}
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


FENSTER_VOR = 3   # Codezellen vor dem Text
FENSTER_NACH = 1  # Codezellen danach


def umgebung(zellen: list, i: int) -> str:
    """Die Ausgaben, auf die sich ein Text an Stelle i berufen kann."""
    vor, nach, teile = 0, 0, []
    for j in range(i - 1, -1, -1):
        if zellen[j]["cell_type"] != "code":
            continue
        teile += ["".join(o.get("text", [])) for o in zellen[j].get("outputs", [])]
        vor += 1
        if vor >= FENSTER_VOR:
            break
    for j in range(i + 1, len(zellen)):
        if zellen[j]["cell_type"] != "code":
            continue
        teile += ["".join(o.get("text", [])) for o in zellen[j].get("outputs", [])]
        nach += 1
        if nach >= FENSTER_NACH:
            break
    return " ".join(teile)


KONSTANTE = re.compile(r"^\s*([A-Z][A-Z0-9_]{2,})\s*=\s*([-\d.]+)", re.M)
AUSNAHME = re.compile(r"<!--\s*zahl-ohne-ausgabe:\s*([^\s]+)\s+(.+?)-->")


def eingesetzte_werte(stamm: str) -> set[str]:
    """Zahlen, die der Bau selbst aus dem Merkzettel in den Text gesetzt hat.

    Ein Platzhalter {{schluessel:format}} wird beim Bauen durch den gerechneten
    Wert ersetzt. So ein Wert KANN der Rechnung nicht widersprechen - er ist
    die Rechnung. Ihn zu melden waere Rauschen; schlimmer noch, es bestrafte
    genau den Weg, der Textfehler ausschliesst.

    Was uebrig bleibt, ist die Menge, um die es geht: von Hand getippte Zahlen.
    """
    datei = WERTE / f"{stamm}.json"
    if not datei.exists():
        return set()
    werte = set()
    for roh in json.loads(datei.read_text(encoding="utf-8")).values():
        try:
            zahl = float(roh)
        except (TypeError, ValueError):
            continue
        for muster in ("{:g}", "{:.0f}", "{:.1f}", "{:.2f}", "{:.3f}"):
            for wert in (zahl, zahl * 100):   # auch die Prozentschreibweise
                s = muster.format(wert)
                werte |= {s, s.replace(".", ","),
                          f"{wert:,.0f}".replace(",", ".")}   # Tausenderpunkt
    return werte


def gesetzte_werte(zellen: list) -> set[str]:
    """Zahlen, die das Notebook als Konstante SETZT statt sie zu messen.

    Kostensaetze und Erfolgskriterien stehen vor der ersten Messung fest -
    sie koennen per Definition in keiner Ausgabe belegt sein. Wer sie als
    Fehler meldet, erzeugt Rauschen, und ein Pruefer mit Rauschen wird
    ueberlesen. Erkannt werden nur GROSSGESCHRIEBENE Namen: das ist die
    Schreibweise, die dieses Projekt fuer feste Groessen verwendet.
    """
    werte = set()
    for c in zellen:
        if c["cell_type"] != "code":
            continue
        for _, roh in KONSTANTE.findall("".join(c["source"])):
            werte |= formen(roh.replace(".", ","))
            try:  # 0.70 im Code, "70 %" im Text
                werte |= formen(f"{float(roh) * 100:g}".replace(".", ","))
            except ValueError:
                pass
    return werte


def getippt_statt_gesetzt(stamm: str) -> list[tuple[str, str]]:
    """Zahlen, die als Messwert vorliegen, aber im BAUSKRIPT getippt sind.

    Geprueft wird das Bauskript, nicht das gebaute Notebook: Dort sind
    Platzhalter schon ersetzt, und eine eingesetzte Zahl saehe aus wie eine
    getippte. Der Unterschied ist aber genau der Punkt.

    Eine getippte Zahl, die es auch als Messwert gibt, ist heute richtig und
    morgen falsch: Beim naechsten Datenstand wandert der Messwert, die
    Kopie nicht. Das ist der Rohstoff, aus dem alle Textfehler dieses
    Projekts entstanden sind - die Abhilfe ist mechanisch,
    {{schluessel:format}} statt der Ziffern.
    """
    werte_datei = WERTE / f"{stamm}.json"
    skript = next((s for s in sorted((WURZEL / "analytics" / "bau").glob("nb0*.py"))
                   if stamm.split("_")[0].lstrip("0") in s.name.split("_")[0]), None)
    if not werte_datei.exists() or skript is None:
        return []
    werte = json.loads(werte_datei.read_text(encoding="utf-8"))
    je_form: dict[str, str] = {}
    for schluessel, roh in werte.items():
        try:
            zahl = float(roh)
        except (TypeError, ValueError):
            continue
        if abs(zahl) < 10:
            continue
        for muster in ("{:g}", "{:.0f}", "{:.1f}", "{:.2f}"):
            for wert in (zahl, zahl * 100):
                s = muster.format(wert)
                for form in (s, s.replace(".", ","),
                             f"{wert:,.0f}".replace(",", ".")):
                    je_form.setdefault(form, schluessel)

    # Nur MD("""...""")-Bloecke - im Code sind Konstanten erlaubt.
    md = re.findall(r'MD\("""(.*?)"""\)', skript.read_text(encoding="utf-8"), re.S)
    befunde, gesehen = [], set()
    for text in md:
        ohne = _PLATZHALTER_TEXT.sub("", text)
        for zeile in ohne.split("\n"):
            if "zahl-ohne-ausgabe" in zeile or "|---" in zeile:
                continue
            for zahl in re.findall(r"(?<![\d,.])\d[\d.]*(?:,\d+)?(?![\d,.])", zeile):
                if zahl in HARMLOS or zahl not in je_form or zahl in gesehen:
                    continue
                if sprachzahl(zahl, zeile):
                    continue
                gesehen.add(zahl)
                befunde.append((f"{zahl} steht als {{{{{je_form[zahl]}}}}} bereit",
                                zeile.strip()[:88]))
    return befunde


def pruefe(datei: pathlib.Path) -> list[tuple[str, str]]:
    nb = json.loads(datei.read_text(encoding="utf-8"))
    zellen = nb["cells"]
    gesetzt = gesetzte_werte(zellen) | eingesetzte_werte(datei.stem)
    # HTML-Auszeichnung ist keine Prosa. Seit die Tabellen als HTML
    # gerendert werden, stehen in den Zellen Stilangaben wie "14px" oder
    # "0.95em" - fuer diese Pruefung Zahlen ohne Ausgabe, fuer den Leser
    # unsichtbar. Geprueft wird deshalb der Text OHNE Tags; der Inhalt
    # der Tabellenzellen bleibt dabei vollstaendig erhalten.
    def ohne_tags(quelle: str) -> str:
        # Kommentare bleiben: Die Ausnahmen stehen selbst als HTML-Kommentar
        # im Text und wuerden sonst mit den Tags verschwinden.
        return re.sub(r"<(?!!--)[^>]+>", " ", quelle)

    roh = [("".join(c["source"]), umgebung(zellen, i))
           for i, c in enumerate(zellen) if c["cell_type"] == "markdown"]
    texte = [(ohne_tags(text), raum) for text, raum in roh]
    # Ausdruecklich begruendete Ausnahmen: <!-- zahl-ohne-ausgabe: 0,99 Grund -->
    erlaubt = {}
    for text, _ in roh:
        for zahl, grund in AUSNAHME.findall(text):
            erlaubt[zahl] = grund
    befunde = []
    for text, raum in texte:
        for zahl, einheit in MIT_EINHEIT.findall(text):
            if zahl in HARMLOS and einheit != "€":
                continue
            if belegt(zahl, raum, gesetzt, erlaubt):
                continue
            befunde.append((f"{zahl} {einheit}", zeile_um(text, zahl)))
        for zahl in OHNE_EINHEIT.findall(text):
            if belegt(zahl, raum, gesetzt, erlaubt):
                continue
            befunde.append((zahl, zeile_um(text, zahl)))
        for zahl in GANZZAHL.findall(text):
            if zahl in HARMLOS or belegt(zahl, raum, gesetzt, erlaubt):
                continue
            kontext = zeile_um(text, zahl)
            if sprachzahl(zahl, kontext):
                continue
            befunde.append((zahl, kontext))
    # Dubletten zusammenfassen
    gesehen, eindeutig = set(), []
    for z, kontext in befunde:
        if z in gesehen:
            continue
        gesehen.add(z)
        eindeutig.append((z, kontext))
    return eindeutig


def belegt(zahl: str, raum: str, gesetzt: set[str], erlaubt: dict) -> bool:
    """Eine Textzahl gilt als gedeckt, wenn sie gemessen, gesetzt oder
    ausdruecklich begruendet ist - in dieser Reihenfolge der Verlaesslichkeit."""
    f = formen(zahl)
    return bool(f & gesetzt) or zahl in erlaubt or any(s in raum for s in f)


def zeile_um(text: str, zahl: str) -> str:
    for z in text.split("\n"):
        if zahl in z:
            return z.strip()[:96]
    return ""


def bericht_getippte() -> None:
    """Zusatzbericht, KEIN Gate: zweistellige Zahlen kollidieren zu leicht.

    Die Liste ist als Arbeitshilfe gedacht - jede Zeile ist zu pruefen, nicht
    blind zu ersetzen. Als Abbruchbedingung waere sie Rauschen, und ein
    Pruefer mit Rauschen wird ueberlesen.
    """
    print("\nZusatzbericht - im Text getippt, obwohl als Messwert vorhanden:")
    gesamt = 0
    for datei in sorted(NB.glob("*.ipynb")):
        for zahl, kontext in getippt_statt_gesetzt(datei.stem):
            print(f"   {datei.stem[:2]}  {zahl:<44s} {kontext[:64]}")
            gesamt += 1
    print(f"   {gesamt} Stelle(n) - jede einzeln pruefen, viele sind Zufallstreffer.")


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
    if not gewuenscht:
        bericht_getippte()
    return 1 if gesamt else 0


if __name__ == "__main__":
    raise SystemExit(main())
