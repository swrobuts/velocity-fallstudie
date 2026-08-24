#!/usr/bin/env python3
"""Nachrechnen, dass die Freisteller die Vorlage nicht verfaelschen.

Kein Pruefpunkt hat je die Bilder angesehen. Deshalb blieb zweimal
unbemerkt, was der Nutzer am grossen Bildschirm sofort sah:

  24.08.2026, vormittags  Die Speichen zerfielen in gestrichelte Linien.
                          Die Freistellung vor der Betonwand hatte eine
                          zu hohe Schwelle.
  24.08.2026, abends      Zwischen den Speichen stand weisser Grund
                          statt des Seitenhintergrunds - ein weisser
                          Faecher im Laufrad. Der Lochfueller hatte nach
                          FLAECHE entschieden, und am Lastenrad sind die
                          Zwickel kleiner als ein Buchstabe.

Beide Fehler haben dieselbe Gestalt: die Deckkraft weicht von dem ab,
was in der Vorlage steht. Genau das wird hier gemessen, und zwar gegen
die Vorlage selbst.

WIE
Die Vorlage wird genauso beschnitten und verkleinert wie im Werkzeug -
der Ausschnitt steht in src/assets/buehne-ausschnitt.txt, damit die
Pruefung die Rechnung nicht nachbauen (und denselben Fehler wiederholen)
muss. Aus dem Abstand zum weissen Grund folgt, wie deckend jeder Punkt
sein SOLLTE. Verglichen wird in beide Richtungen:

  zu viel   Deckkraft, wo die Vorlage weiss ist  -> der weisse Faecher
  zu wenig  Deckkraft, wo die Vorlage Rad zeigt  -> zerfallene Speichen

Der Schatten ist gezeichnet und steht in der Vorlage nicht; die unteren
14 Prozent bleiben deshalb aussen vor.

Dazu eine dritte Messung, die den Faecher direkt benennt: deckende
Punkte, die praktisch weiss sind. Erlaubt ist davon nur der Schriftzug
am Rahmen - rund viertausend Punkte.

Aufruf:  python3 tools/freisteller_pruefen.py
"""
import os
import sys

import numpy as np
from PIL import Image

WURZEL = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(WURZEL, 'src', 'assets')
QUELLEN = os.path.join(ASSETS, 'neu')

GRUEN, ROT, GRAU, AUS = '\033[0;32m', '\033[0;31m', '\033[0;90m', '\033[0m'

PAARE = [('rad-ebike-frei.webp', 'e-bike'),
         ('rad-city-frei.webp', 'city-bike'),
         ('rad-cargo-frei.webp', 'cargo')]

MAX_ZUVIEL = 0.010      # gemessen 0,37 bis 0,48 Prozent
MAX_ZUWENIG = 0.010     # gemessen 0,17 bis 0,28 Prozent
MAX_WEISS = 12000       # gemessen 3400 bis 4400 Punkte (der Schriftzug)
OHNE_SCHATTEN = 0.86    # die unteren Zeilen tragen den gezeichneten Schatten

fehler = 0


def melde(gut: bool, text: str) -> None:
    global fehler
    print(f'  {GRUEN}✓{AUS} {text}' if gut else f'  {ROT}✗{AUS} {text}')
    if not gut:
        fehler += 1


def ausschnitt() -> tuple:
    """Senkrecht gemeinsam, waagrecht je Rad - so wie das Werkzeug schneidet."""
    pfad = os.path.join(ASSETS, 'buehne-ausschnitt.txt')
    senkrecht, waagrecht = None, {}
    for zeile in open(pfad, encoding='utf-8'):
        zeile = zeile.strip()
        if not zeile or zeile.startswith('#'):
            continue
        teile = zeile.split()
        if senkrecht is None:
            senkrecht = tuple(int(t) for t in teile)          # y0 y1 zielhoehe
        else:
            waagrecht[teile[0]] = (int(teile[1]), int(teile[2]))
    if senkrecht is None:
        raise SystemExit(f'{pfad} enthaelt keinen Ausschnitt')
    return senkrecht, waagrecht


def main() -> int:
    (y0, y1, _hoehe), waagrecht = ausschnitt()
    dateien = os.listdir(QUELLEN)

    for ziel, stichwort in PAARE:
        treffer = [f for f in dateien if stichwort in f]
        if not treffer:
            melde(False, f'Keine Vorlage fuer {stichwort}')
            continue
        print(f'\n{ziel}  {GRAU}gegen {treffer[0]}{AUS}')

        A = np.asarray(Image.open(os.path.join(ASSETS, ziel)).convert('RGBA'))
        ist = A[..., 3].astype(np.float32) / 255.0
        hoehe, breite = ist.shape

        x0, x1 = waagrecht[ziel]
        Q = (Image.open(os.path.join(QUELLEN, treffer[0])).convert('RGB')
             .crop((x0, y0, x1, y1)).resize((breite, hoehe), Image.LANCZOS))
        abstand = np.abs(np.asarray(Q).astype(np.float32) - 255).max(axis=2)
        soll = np.clip((abstand - 4) / 12, 0, 1)

        oben = slice(0, int(OHNE_SCHATTEN * hoehe))
        zuviel = float(np.maximum(ist[oben] - soll[oben], 0).mean())
        zuwenig = float(np.maximum(soll[oben] - ist[oben], 0).mean())

        melde(zuviel <= MAX_ZUVIEL,
              f'Kein Grund mitgenommen  {GRAU}{100*zuviel:.2f} % zu viel Deckkraft, '
              f'erlaubt {100*MAX_ZUVIEL:.1f} %{AUS}')
        melde(zuwenig <= MAX_ZUWENIG,
              f'Nichts vom Rad verloren  {GRAU}{100*zuwenig:.2f} % zu wenig Deckkraft, '
              f'erlaubt {100*MAX_ZUWENIG:.1f} %{AUS}')

        weiss = int(((A[..., 3] > 200) & (A[..., :3].min(axis=2) > 238)).sum())
        melde(weiss <= MAX_WEISS,
              f'Kein weisser Faecher im Laufrad  {GRAU}{weiss} deckende weisse Punkte, '
              f'erlaubt {MAX_WEISS}{AUS}')

    print()
    if fehler:
        print(f'{ROT}{fehler} Befund(e).{AUS}')
        return 1
    print(f'{GRUEN}Die Freisteller sind sauber.{AUS}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
