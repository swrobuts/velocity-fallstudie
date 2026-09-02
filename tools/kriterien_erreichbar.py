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
    """Notebook 2: 70 Prozent auf einer Liste von 60 Raedern, je Quartal."""
    KAPAZITAET, HORIZONT, ZUSAGE = 60, 90, 0.70
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
        schranke = orakel(positiv, KAPAZITAET)
        zeilen.append((str(t.date()), schranke >= ZUSAGE,
                       f"{positiv} positive von {len(bestand)} -> Orakel "
                       f"{schranke:.1%} gegen Zusage {ZUSAGE:.0%}"))
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
        print(f"{ROT}{offen} Zeitraum/Zeitraeume, in denen die Zusage von keinem")
        print(f"Verfahren gehalten werden kann.{AUS} Das ist kein Modellproblem -")
        print("die Zusage gehoert in Phase 1 repariert, nicht das Verfahren.")
    else:
        print(f"{GRUEN}Jede Zusage ist auf diesen Daten erreichbar.{AUS}")
        print("Ob sie erreicht wird, sagt diese Pruefung nicht.")
    return 1 if offen else 0


if __name__ == "__main__":
    raise SystemExit(main())
