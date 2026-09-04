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

ZUSAETZLICH: DIE ZAHL DER ABNAHMEPRUEFUNGEN

TESTEN.md nennt sie im Kopf. Sie stand dort schon einmal falsch - die
Datei dokumentiert das sogar selbst in ihrem Abschnitt "Diese Datei war
stale": Sie behauptete "Neun Pruefungen", waehrend es 31 waren. Am
04.09.2026 stand dort wieder 31, waehrend es 34 sind. Eine Zahl, die
zweimal veraltet ist, gehoert gezaehlt statt getippt.

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
    schritte = len(re.findall(r'^schritt "', ABNAHME.read_text(encoding="utf-8"), re.M))
    m = re.search(r"\*\*(\d+) Prüfungen\*\*", TESTEN.read_text(encoding="utf-8"))
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
          f"analytics/bau/werte/,\n  dazu die Prüfungszahl in TESTEN.md gegen "
          f"tools/abnahme.sh ({schritte})")
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
