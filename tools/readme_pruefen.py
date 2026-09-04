#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Haelt handgetippte Angaben in den Anleitungen gegen ihre Quelle.

WARUM ES DIESE PRUEFUNG BRAUCHT

analytics/notebooks/README.md ist fuer viele der erste Text, den sie vom
Projekt sehen - und der einzige, der alle sechs Notebooks nebeneinander
stellt. Seine Zahlen und Statusangaben standen dort von Hand.

Am 04.09.2026 fielen vier Falschaussagen auf einmal auf:

  Notebook 1  "Teilfreigabe (nur CITY)"   - der Status ist "sichtbar", und
              die Preisschaetzung deckt seit dem 03.09. alle drei Radtypen
              ab (212 Zeilen: CARGO 55, CITY 55, EBIKE 102)
  Notebook 4  "Freigabe"                  - es ist ein Probebetrieb
  Notebook 5  "Freigabe"                  - Produkt A ist nicht
              freigegeben, Produkt B hat nur ein analytisches Lehr-Gate
  Notebook 5  "1,8 Raeder je Werktag bei Stationen fuer 20 bis 40"
              - gemessen sind 4,0 bei Stationen fuer 35 bis 65

Keine davon war je falsch GEWORDEN durch einen Fehler; sie waren alle
einmal richtig und sind stehengeblieben, waehrend die Notebooks
weitergerechnet wurden. Genau dagegen hilft nur eine Pruefung.

WAS GEPRUEFT WIRD

  1  Die Statusspalte nennt fuer jedes Notebook den Status, den das
     Notebook selbst gestempelt hat.
  2  Die Zahlen im Abschnitt "Was bewusst schiefgeht" stimmen mit den
     gemessenen Werten ueberein.

Geprueft wird gegen analytics/bau/werte/*.json - dieselbe Quelle, aus der
die Notebooks ihre {{platzhalter}} fuellen und aus der das Handout
entsteht. Eine Abweichung hier ist immer ein Fehler der README.

ZUSAETZLICH: DIE PRUEFTABELLE IN TESTEN.md

TESTEN.md nennt im Kopf die Zahl der Abnahmepruefungen und listet sie
darunter einzeln auf. Beides stand dort schon falsch. Die Datei
dokumentiert die erste Runde selbst in ihrem Abschnitt "Diese Datei war
stale": Sie behauptete "Neun Pruefungen", waehrend es 31 waren.
Daraufhin wurde die ZAHL gezaehlt statt getippt.

Am 04.09.2026 fiel die zweite Runde auf, und sie zeigte, dass das nicht
genuegt: Die Zahl stimmte - 37 hier, 37 dort -, aber die Tabelle darunter
hatte 36 Zeilen. Der Schritt "MCP-Server gegen die Datenbank" war an
Position 18 in das Skript eingefuegt und in die Anleitung nicht; ab da
zeigte jede Nummer auf die falsche Pruefung. Die Pruefung war gruen und
mass das Falsche.

Seither wird die Tabelle selbst geprueft: so viele Zeilen wie Schritte,
von 1 an lueckenlos durchnummeriert, und jede Zeile teilt mindestens ein
langes Wort mit ihrem Schritt. Siehe abnahmetabelle() weiter unten,
einschliesslich dessen, was der Wortabgleich NICHT faengt.

Aufruf: python3 tools/readme_pruefen.py
"""
from __future__ import annotations

import json
import pathlib
import re
import sys

WURZEL = pathlib.Path(__file__).resolve().parent.parent
README = WURZEL / "analytics" / "notebooks" / "README.md"
TESTEN = WURZEL / "TESTEN.md"
ABNAHME = WURZEL / "tools" / "abnahme.sh"
WERTE = WURZEL / "analytics" / "bau" / "werte"
TESTS = WURZEL / "db" / "tests"


def merkzettel() -> dict[str, dict]:
    return {f.stem[:2]: json.loads(f.read_text(encoding="utf-8"))
            for f in WERTE.glob("*.json")}


# (Notebook, Beschreibung, Wortlaut in der README, Funktion -> erwarteter Wert)
#
# Der Wortlaut wird woertlich in der Datei gesucht. Fehlt er, ist die
# Aussage umformuliert worden und muss neu belegt werden - das meldet die
# Pruefung ebenfalls, statt stillschweigend durchzugehen.
AUSSAGEN = [
    ("01", "Status Notebook 1",
     "**sichtbar** — die Anzeige ist freigeschaltet, für alle drei Radtypen",
     lambda w: w["01"]["produktstatus"] == "sichtbar"),
    ("02", "Status Notebook 2",
     "Freigabe — **für die Faustregel, nicht für das Modell**",
     lambda w: w["02"]["k3_unten_regel"] >= w["02"]["k3_schwelle"]
               > w["02"]["k3_unten_wald"]),
    ("03", "Status Notebook 3",
     "für den Einsatz freigegeben, **analytisch nicht belegt**",
     lambda w: w["03"]["status_einsatz"] == "freigegeben"
               and w["03"]["status_analytisch"] == "nicht belegt"),
    ("04", "Status Notebook 4",
     "**Probebetrieb** — rechnet mit, entscheidet nicht",
     lambda w: w["04"]["nb04_status"] == "probebetrieb"),
    ("05", "Status Notebook 5",
     "Produkt A **nicht freigegeben**, Produkt B nur analytisch",
     lambda w: w["05"]["status_a"].startswith("nicht freigegeben")),
    ("03", "Anteil ohne Segment (Notebook 3)",
     "Knapp ein Drittel der Kundschaft fällt aus der Segmentierung heraus",
     lambda w: 0.28 <= w["03"]["kurze_historie_anteil"] <= 0.36),
    ("05", "Saldo und Kapazität (Notebook 5)",
     "bewegt 4,0 Räder je Werktag bei Stationen für\n  35 bis 65",
     lambda w: (f"{w['05']['saldo_max']:.1f}".replace(".", ",") == "4,0"
                and int(w["05"]["kap_min"]) == 35
                and int(w["05"]["kap_max"]) == 65)),
]


def _worte(s: str) -> set[str]:
    """Wortmenge fuer den Abgleich: klein, ohne Umlaute, ohne Kurzwoerter.

    Sechs Zeichen als Untergrenze ist kein runder Wert, sondern der
    kleinste, bei dem kein Fuellwort mehr durchkommt: 'gegen', 'jede',
    'nicht', 'ohne' haben fuenf oder weniger.
    """
    s = s.lower()
    for a, b in (("ä", "ae"), ("ö", "oe"), ("ü", "ue"), ("ß", "ss")):
        s = s.replace(a, b)
    return {w for w in re.split(r"[^a-z0-9]+", s) if len(w) >= 6}


def abnahmetabelle(testen: str, schritte: list[str]) -> list[tuple[str, str]]:
    """Haelt die Tabelle in TESTEN.md gegen die Schritte in abnahme.sh.

    WARUM DAS NICHT DIE ZAHL IM KOPF ERLEDIGT

    Die Zahl allein stand am 04.09.2026 richtig - 37 hier, 37 dort -,
    waehrend die Tabelle darunter 36 Zeilen hatte: der Schritt
    "MCP-Server gegen die Datenbank" war in das Skript eingefuegt und in
    die Anleitung nicht, und ab Zeile 18 zeigte jede Nummer auf die
    falsche Pruefung. Die Pruefung war gruen und mass das Falsche.

    Geprueft wird deshalb dreierlei: so viele Zeilen wie Schritte, von 1
    an lueckenlos durchnummeriert, und jede Zeile mit mindestens einem
    langen Wort aus ihrem Schritt. Das dritte ist ein Anker, kein Beweis
    - die Tabelle nennt absichtlich kurze Merknamen ("Durchstich" fuer
    "Durchstich: Ausleihe bis Abrechnung"), verbatim waere also falsch.
    Ein Anker faengt Verschiebung und grobe Umbenennung; eine Vertauschung
    zweier Warenwirtschaftszeilen faengt er nicht. Dafuer kostet er keine
    Freiheit beim Formulieren.
    """
    zeilen = []
    gefunden = False
    for z in testen.splitlines():
        if z.startswith("| # | Prüfung |"):
            gefunden = True
            continue
        if gefunden:
            if z.startswith("|---") or not z.strip():
                if z.startswith("|---"):
                    continue
                break
            if not z.startswith("| "):
                break
            zeilen.append(z)
    if not gefunden:
        return [("Tabelle in TESTEN.md",
                 "die Kopfzeile | # | Prüfung | Was sie belegt | fehlt")]

    funde = []
    if len(zeilen) != len(schritte):
        funde.append(("Zeilen der Prüftabelle in TESTEN.md",
                      f"die Tabelle hat {len(zeilen)} Zeilen, "
                      f"tools/abnahme.sh {len(schritte)} Schritte"))

    for i, (zeile, schritt) in enumerate(zip(zeilen, schritte), start=1):
        spalten = [s.strip() for s in zeile.strip().strip("|").split("|")]
        if not spalten[0].isdigit() or int(spalten[0]) != i:
            funde.append((f"Prüftabelle, {i}. Zeile",
                          f"trägt die Nummer {spalten[0]!r}, erwartet {i}"))
            continue
        anker = _worte(schritt)
        if not anker:
            # Ein Schritt, dessen Name nur aus kurzen Woertern besteht,
            # kann nicht verankert werden. Das ist keine Abweichung -
            # Zeilenzahl und Nummer haben ihn schon geprueft.
            continue
        if not _worte(" ".join(spalten[1:])) & anker:
            funde.append((f"Prüftabelle, Zeile {i}",
                          f"{spalten[1]!r} teilt kein Wort mit dem "
                          f"{i}. Schritt {schritt!r}"))
    return funde


def main() -> int:
    if not README.exists():
        print(f"README fehlt: {README}")
        return 2
    text = README.read_text(encoding="utf-8")
    w = merkzettel()
    fehlend = [nb for nb, _, _, _ in AUSSAGEN if nb not in w]
    if fehlend:
        print(f"Merkzettel fehlen für {sorted(set(fehlend))} — zuerst die "
              f"Notebooks bauen")
        return 2

    funde = []

    # Die Zahl der Abnahmepruefungen: gezaehlt, nicht geglaubt.
    abnahme = ABNAHME.read_text(encoding="utf-8")
    testen = TESTEN.read_text(encoding="utf-8")
    schrittnamen = re.findall(r'^schritt "([^"]*)"', abnahme, re.M)
    schritte = len(schrittnamen)
    funde.extend(abnahmetabelle(testen, schrittnamen))
    # Die Zahl der pgTAP-Testfunktionen: gezaehlt aus den Dateien, ohne
    # Datenbankverbindung. Sie stand in TESTEN.md dreimal falsch - 51,
    # dann 164, dann 178 -, immer weil Tests dazukamen und die Anleitung
    # nicht. Eine Zahl, die dreimal veraltet ist, gehoert nicht getippt.
    testfunktionen = len({m.group(1) for f in sorted(TESTS.glob("t*.sql"))
                          for m in re.finditer(
                              r"function velocity_test\.(test_[a-z0-9_]+)",
                              f.read_text(encoding="utf-8"))})
    m = re.search(r"\| (\d+) pgTAP-Testfunktionen \|", testen)
    if m is None:
        funde.append(("Zahl der pgTAP-Tests in TESTEN.md",
                      'die Angabe „N pgTAP-Testfunktionen" steht nicht '
                      'mehr in der Prüftabelle'))
    elif int(m.group(1)) != testfunktionen:
        funde.append(("Zahl der pgTAP-Tests in TESTEN.md",
                      f"dort stehen {m.group(1)}, db/tests/ enthält "
                      f"{testfunktionen} Testfunktionen"))

    m = re.search(r"\*\*(\d+) Prüfungen\*\*", testen)
    if m is None:
        funde.append(("Zahl der Prüfungen in TESTEN.md",
                      "die Angabe **N Prüfungen** steht nicht mehr im Kopf"))
    elif int(m.group(1)) != schritte:
        funde.append(("Zahl der Prüfungen in TESTEN.md",
                      f"dort stehen {m.group(1)}, tools/abnahme.sh hat {schritte}"))

    for nb, was, wortlaut, stimmt in AUSSAGEN:
        if wortlaut not in text:
            funde.append((was, "Wortlaut steht nicht mehr in der README"))
        elif not stimmt(w):
            funde.append((was, "steht in der README, wird vom Merkzettel "
                               "aber nicht getragen"))

    print(f"{len(AUSSAGEN)} Aussagen der Notebook-README gegen "
          f"analytics/bau/werte/,\n  dazu die Prüftabelle in TESTEN.md gegen "
          f"tools/abnahme.sh — Zahl im Kopf,\n  Zeilenzahl, Nummerierung und "
          f"je ein Ankerwort ({schritte} Schritte),\n  und die Zahl der pgTAP-Tests gegen db/tests/ ({testfunktionen})")
    if not funde:
        print("  Alle Aussagen werden von den Merkzetteln getragen.")
        return 0
    print(f"  {len(funde)} Befund(e):\n")
    for was, warum in funde:
        print(f"  FEHLER  {was}")
        print(f"          {warum}")
    print("\n  Die Anleitungen nennen Status und Zahlen von Hand. Nach einem\n"
          "  neuen Notebooklauf oder einer neuen Abnahmeprüfung gehören sie\n"
          "  nachgezogen — die Werte stehen in analytics/bau/werte/*.json\n"
          "  und in tools/abnahme.sh.")
    return 1


if __name__ == "__main__":
    sys.exit(main())
