#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Prueft, ob die Erfolgskriterien auf diesen Daten ueberhaupt erreichbar sind.

Aufruf:
    python3 tools/kriterien_erreichbar.py

Wozu
----
Der teuerste Fehler dieses Projekts war nicht eine falsche Zahl im Text,
sondern eine Zusage, die niemand haette halten koennen. Notebook 2 verlangt
70 Prozent Trefferquote auf einer Liste von 60 Raedern. Im November stehen
unter 250 Raedern nur 41 auffaellige - ein allwissendes Orakel kommt auf
68,3 Prozent. Das Kriterium war in diesem Quartal nicht anspruchsvoll,
sondern unmoeglich, und mehrere Runden Modellvergleich haben dagegen
gemessen.

Kriterien und Daten wurden getrennt entworfen und nie gegeneinander
gehalten. Dieses Werkzeug tut genau das - vor der ersten Modellrechnung.

Wie geprueft wird
-----------------
Fuer jedes Top-k-Kriterium wird die ORAKELSCHRANKE gebildet: die
Trefferquote, die ein Verfahren mit vollstaendiger Kenntnis der Zukunft
erreichte. Sie ist min(Anzahl positiver Faelle, k) / k. Liegt die Zusage
darueber, ist sie unerfuellbar - unabhaengig von jedem Verfahren.

Was das Werkzeug NICHT sagt
---------------------------
Dass ein erreichbares Kriterium auch erreicht wird. Die Schranke ist eine
Obergrenze, kein Versprechen. Sie trennt nur "schwer" von "unmoeglich" -
und diese Trennung fehlte.
"""
from __future__ import annotations

import os
import pathlib
import sys

import pandas as pd

BASIS = pathlib.Path(__file__).resolve().parent.parent
DATEN = pathlib.Path(os.environ.get("VELO_OUT") or BASIS / "analytics")

GRUEN, ROT, GELB, AUS = "\033[0;32m", "\033[0;31m", "\033[0;33m", "\033[0m"


def orakel(positive: int, k: int) -> float:
    """Beste erreichbare Trefferquote bei k Plaetzen und so vielen positiven."""
    return min(positive, k) / k if k else 0.0


def wartungsliste() -> list[tuple[str, bool, str]]:
    """Notebook 2: Nutzenschwelle auf einer Liste von 60 Raedern, je Quartal.

    Phase 1 verlangte urspruenglich 70 Prozent Trefferquote. Genau dieses
    Werkzeug hat gezeigt, dass die Zusage im Winter unerfuellbar ist - dort
    gibt es nicht genug auffaellige Raeder, um die Liste zu fuellen. Nach dem
    dokumentierten Ruecksprung lautet sie: mindestens LIFT-mal so viele
    Treffer wie eine Zufallsauswahl gleicher Laenge.

    Geprueft wird beides. Die alte Zusage steht als historischer Befund
    daneben - sie ist der Grund fuer den Ruecksprung und gehoert nicht
    stillschweigend geloescht.
    """
    KAPAZITAET, HORIZONT = 60, 90
    ZUSAGE_ALT, LIFT = 0.70, 1.5
    s = pd.read_csv(DATEN / "schadensmeldung.csv", parse_dates=["gemeldet_am"])
    a = pd.read_csv(DATEN / "ausleihe.csv", parse_dates=["startzeit"])
    r = pd.read_csv(DATEN / "fahrrad.csv",
                    parse_dates=["angeschafft_am", "ausgemustert_am"])
    ende = a.startzeit.max().normalize()
    stichtage = pd.date_range(end=ende - pd.Timedelta(days=HORIZONT),
                              periods=8, freq="90D")
    zeilen = []
    for t in stichtage[2:]:
        bestand = r[(r.angeschafft_am <= t)
                    & (r.ausgemustert_am.isna() | (r.ausgemustert_am > t))]
        kuenftig = set(s[(s.gemeldet_am > t)
                         & (s.gemeldet_am <= t + pd.Timedelta(days=HORIZONT))].fahrrad_id)
        positiv = int(bestand.fahrrad_id.isin(kuenftig).sum())
        grundrate = positiv / max(len(bestand), 1)
        schranke = orakel(positiv, KAPAZITAET)
        # Die geltende Zusage: Lift ueber der Grundrate des Quartals.
        # Erreichbar, solange das Orakel den geforderten Faktor hergibt.
        erreichbar = schranke >= LIFT * grundrate
        alt = "erfuellbar" if schranke >= ZUSAGE_ALT else "UNERFUELLBAR"
        zeilen.append((str(t.date()), erreichbar,
                       f"{positiv} positive von {len(bestand)}, Grundrate "
                       f"{grundrate:.1%} -> Orakel {schranke:.1%}, gefordert "
                       f"{LIFT * grundrate:.1%}   (alte 70-%-Zusage: {alt})"))
    return zeilen


PRUEFUNGEN = [("Notebook 2: Trefferquote der Wartungsliste", wartungsliste)]


def main() -> int:
    offen = 0
    for titel, fn in PRUEFUNGEN:
        print(f"\n{titel}")
        for name, erreichbar, befund in fn():
            marke = f"{GRUEN}erreichbar {AUS}" if erreichbar else f"{ROT}UNMOEGLICH{AUS}"
            print(f"  {marke}  {name:12s}  {befund}")
            offen += not erreichbar
    print()
    if offen:
        print(f"{ROT}{offen} Zeitraum/Zeitraeume, in denen die geltende Zusage von")
        print(f"keinem Verfahren gehalten werden kann.{AUS} Das ist kein")
        print("Modellproblem - die Zusage gehoert in Phase 1 repariert.")
    else:
        print(f"{GRUEN}Jede geltende Zusage ist auf diesen Daten erreichbar.{AUS}")
        print("Ob sie erreicht wird, sagt diese Pruefung nicht - sie trennt")
        print("nur 'schwer' von 'unmoeglich'.")
        print()
        print(f"{GELB}Die urspruengliche 70-%-Zusage war es nicht: Wo oben")
        print(f"'UNERFUELLBAR' steht, haette auch ein allwissendes Verfahren sie")
        print(f"verfehlt. Das war der Grund fuer den Ruecksprung nach Phase 1.{AUS}")
    return 1 if offen else 0


if __name__ == "__main__":
    raise SystemExit(main())
