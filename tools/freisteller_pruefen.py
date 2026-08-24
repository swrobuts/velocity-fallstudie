#!/usr/bin/env python3
"""Nachrechnen, dass die Freisteller die Vorlage nicht verfaelschen.

Am 24.08.2026 fiel dem Nutzer auf, dass die Speichen zerrissen waren.
Die Ursache lag in der Freistellung, nicht in der Vorlage - und mit
blossem Auge war sie erst bei starker Vergroesserung zu sehen. Kein
bestehender Pruefpunkt hat sie bemerkt, weil keiner die Bilder ansah.

Drei Messungen, jede auf einen Fehler gemuenzt, den es wirklich gab:

  1. DECKENDE PUNKTE gleichen der Vorlage.
     Wo das Alpha voll ist, darf sich nichts geaendert haben. Bei
     Qualitaet 86 wich das Ergebnis dort im Mittel um vier Stufen ab,
     in der Spitze um zweiundvierzig; seit die Raeder verlustfrei
     gespeichert werden, ist die Abweichung null.

  2. DIE DUNKLEN STELLEN DER VORLAGE SIND DA.
     Unabhaengige Gegenrechnung: welche Punkte der Aufnahme sind
     deutlich dunkler als ihre Umgebung (mehr als 60 Stufen unter dem
     oertlichen Median)? Das sind Speichen, Kette, Ritzel. Sie muessen
     im Freisteller deckend sein. Der zerrissene Stand vom 24.08. kam
     hier auf 78 Prozent, der heutige auf 98.

  3. KEIN QUERBALKEN.
     Die Kante zwischen Wand und Boden laeuft durch das ganze Bild.
     Bleibt sie in der Maske haengen, spannt eine Zeile ueber fast die
     volle Breite - das kann kein Fahrrad sein.

Aufruf:  python3 tools/freisteller_pruefen.py
"""
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

WURZEL = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(WURZEL, 'src', 'assets')

GRUEN, ROT, GRAU, AUS = '\033[0;32m', '\033[0;31m', '\033[0;90m', '\033[0m'

MINDESTDECKUNG = 0.95
MAXSPANNE = 1500

# Das Lastenrad hat keine unmittelbare Vorlage: es wird verkleinert und
# verschoben eingepasst, dabei wird zwangslaeufig neu gerechnet. Fuer es
# gilt nur die dritte Messung.
PAARE = [('rad-ebike-frei.webp', 'velocity-bike-hero.png'),
         ('rad-city-frei.webp', 'velocity-bike-city-hero.png'),
         ('rad-cargo-frei.webp', None)]

fehler = 0


def melde(gut: bool, text: str) -> None:
    global fehler
    print(f'  {GRUEN}✓{AUS} {text}' if gut else f'  {ROT}✗{AUS} {text}')
    if not gut:
        fehler += 1


def dunkle_stellen(pfad: str) -> np.ndarray:
    """Punkte, die deutlich dunkler sind als ihre naehere Umgebung."""
    F = np.asarray(Image.open(pfad).convert('RGB')).astype(np.float32)
    nah = np.stack([ndimage.median_filter(F[..., k], size=41, mode='nearest')
                    for k in range(3)], axis=2)
    return (nah - F).max(axis=2) > 60


for datei, vorlage in PAARE:
    A = np.asarray(Image.open(os.path.join(ASSETS, datei)).convert('RGBA'))
    alpha = A[..., 3]
    print(f'\n{datei}')

    if vorlage:
        Q = np.asarray(Image.open(os.path.join(ASSETS, vorlage)).convert('RGB')).astype(int)
        deckend = alpha == 255
        abw = np.abs(A[..., :3].astype(int) - Q).max(axis=2)[deckend]
        melde(abw.max() == 0,
              f'Deckende Flaeche gleicht der Vorlage  {GRAU}{deckend.sum():,} Punkte, '
              f'groesste Abweichung {abw.max()}{AUS}')

        soll = dunkle_stellen(os.path.join(ASSETS, vorlage))
        deckung = float((alpha[soll] > 100).mean())
        melde(deckung >= MINDESTDECKUNG,
              f'Speichen, Kette und Ritzel stehen  {GRAU}{100*deckung:.1f} % von '
              f'{soll.sum():,} dunklen Vorlagenpunkten, gefordert '
              f'{100*MINDESTDECKUNG:.0f} %{AUS}')

    m = alpha > 24
    breit = 0
    for y in range(m.shape[0]):
        if m[y].any():
            xs = np.where(m[y])[0]
            if xs.max() - xs.min() > MAXSPANNE:
                breit += 1
    melde(breit == 0,
          f'Keine Zeile spannt ueber {MAXSPANNE} Punkte  {GRAU}{breit} gefunden{AUS}')


print()
if fehler:
    print(f'{ROT}{fehler} Befund(e).{AUS}')
    sys.exit(1)
print(f'{GRUEN}Die Freisteller sind sauber.{AUS}')
