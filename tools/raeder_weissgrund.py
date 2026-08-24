#!/usr/bin/env python3
"""Die drei Raeder von weissem Grund loesen und auf eine Buehne stellen.

WARUM ES DIESES ZWEITE WERKZEUG GIBT
tools/raeder_freistellen.py loest die Raeder aus Aufnahmen vor einer
Betonwand. Das ist die schwere Aufgabe: die Wand ist ungleichmaessig
ausgeleuchtet, der Boden gekoernt, und eine Speiche hebt sich davon nur
um wenige Stufen ab. Zwei Hintergrundmodelle und drei Zonen waren noetig,
und es hat drei Anlaeufe gebraucht, bis die Speichen standen.

Am 24.08.2026 hat der Nutzer die Aufgabe abgeschafft statt sie zu loesen:
neue Aufnahmen, alle vor weissem Grund. Damit ist der Hintergrund keine
Schaetzung mehr, sondern eine Zahl. Was bleibt, ist Handwerk:

  1. WEISS IST NICHT NUR HELL. Die Reifenflanken tragen helle Glanzlichter
     und die Aufkleber am Rahmen sind weiss. Ueber die Helligkeit allein
     wuerden sie mit dem Grund verschwinden. Sie liegen aber INNERHALB
     des Umrisses - deshalb entscheidet nicht die Farbe allein, sondern
     die Lage: was der Umriss einschliesst, gehoert zum Rad.

  2. DER SAUM TRAEGT DEN GRUND MIT. Ein halbdurchsichtiger Randpunkt
     zeigt eine Mischung aus Rad und Weiss. Wer nur die Deckkraft setzt,
     behaelt einen hellen Rand um jede Kante. Er wird herausgerechnet.

  3. DIE DREI MUESSEN ZUSAMMENPASSEN. Sie kommen aus einer Reihe, aber
     nicht zwangslaeufig im selben Massstab und nicht auf derselben
     Standlinie. Beides wird gemessen und angeglichen.

Aufruf:  python3 tools/raeder_weissgrund.py [--nur-messen]
Vorlagen: src/assets/neu/ (beliebige Namen, erkannt wird am Motiv)
"""
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

WURZEL = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
QUELLEN = os.path.join(WURZEL, 'src', 'assets', 'neu')
ZIELE = os.path.join(WURZEL, 'src', 'assets')

ZIELHOEHE = 800                # gemeinsame Bildhoehe der drei Raeder

GRAU, AUS = '\033[0;90m', '\033[0m'

ZUORDNUNG = {'e-bike': 'rad-ebike-frei.webp',
             'city-bike': 'rad-city-frei.webp',
             'cargo': 'rad-cargo-frei.webp'}


def verkleinern(bild: Image.Image, breite: int) -> Image.Image:
    """Verkleinern MIT vorgewichtetem Alpha.

    Ohne diesen Umweg mischt der Filter die Farbe durchsichtiger Punkte in
    ihre Nachbarn. Die durchsichtigen Punkte tragen nach dem Entsaeumen
    keine sinnvolle Farbe mehr - das Ergebnis waeren farbige Schlieren
    entlang jeder Kante.
    """
    A = np.asarray(bild).astype(np.float32)
    a = A[..., 3:4] / 255.0
    vor = np.dstack([A[..., :3] * a, A[..., 3]])
    hoehe = round(breite * bild.size[1] / bild.size[0])
    klein = np.asarray(Image.fromarray(vor.round().astype(np.uint8), 'RGBA')
                       .resize((breite, hoehe), Image.LANCZOS)).astype(np.float32)
    ak = np.maximum(klein[..., 3:4] / 255.0, 1e-6)
    rgb = np.clip(klein[..., :3] / ak, 0, 255)
    return Image.fromarray(np.dstack([rgb, klein[..., 3]]).round().astype(np.uint8), 'RGBA')


def scheibe(r: int) -> np.ndarray:
    y, x = np.ogrid[-r:r + 1, -r:r + 1]
    return (y * y + x * x) <= r * r


def groesste_flaeche(maske: np.ndarray) -> np.ndarray:
    marken, n = ndimage.label(maske)
    if n == 0:
        return maske
    return marken == int(np.argmax(ndimage.sum(maske, marken, range(1, n + 1)))) + 1


def sanft(x: np.ndarray, a: float, b: float) -> np.ndarray:
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def alpha_aus_weiss(foto: Image.Image):
    """Deckkraft aus dem Abstand zum weissen Grund.

    Der Grund wird nicht angenommen, sondern gemessen: der Median der
    vier Bildraender. Manche Ausgabeprogramme legen statt reinem Weiss
    ein sehr helles Grau unter, und ein um drei Stufen falscher Grund
    zieht einen sichtbaren Saum nach sich.
    """
    F = np.asarray(foto.convert('RGB')).astype(np.float32)
    rand = np.concatenate([F[:8].reshape(-1, 3), F[-8:].reshape(-1, 3),
                           F[:, :8].reshape(-1, 3), F[:, -8:].reshape(-1, 3)])
    grund = np.median(rand, axis=0)
    abstand = np.abs(F - grund).max(axis=2)

    # Weicher Uebergang statt harter Schnitt: bei 4 Stufen faengt das Rad
    # an, bei 16 ist es voll da. Darunter liegt nur das Rauschen des
    # Grundes - an den Bildraendern gemessen, damit die Zahl nicht
    # geraten ist.
    rauschen = float(np.percentile(np.abs(rand - grund).max(axis=1), 99.5))
    unten = max(4.0, rauschen + 1.0)
    a = sanft(abstand, unten, unten + 12.0)

    # WELCHE EINGESCHLOSSENE WEISSE FLAECHE GEHOERT ZUM RAD?
    # Genau eine Art: der Schriftzug. Er ist weiss und steht auf dem
    # roten Rahmen. Alles andere Weiss im Umriss ist Hintergrund - die
    # Zwickel zwischen den Speichen, der Spalt zwischen Gepaecktraeger
    # und Schutzblech, die Luecke unter dem Steuerrohr.
    #
    # Zwei Anlaeufe waren falsch:
    #   nach FLAECHE   - am Lastenrad sind die Speichenzwickel kleiner
    #                    als ein Buchstabe; im Laufrad stand ein weisser
    #                    Faecher. Der Nutzer hat ihn sofort gesehen.
    #   nach MASSIVITAET - das Schliessen ueberbrueckte auch die Spalten
    #                    zwischen zwei schwarzen Bauteilen.
    #
    # Es entscheidet, WORAUF das Weiss liegt: der Schriftzug ist rundum
    # von Rot umgeben, ein Hintergrundspalt nie. Dazu kommt eine
    # Obergrenze, denn Rot allein genuegt auch nicht - beim E-Bike ist
    # das ganze RAHMENDREIECK von Rot umgeben, und ohne die Grenze stand
    # dort eine weisse Flaeche von der Groesse eines Handtuchs.
    # Ein Buchstabe misst wenige tausend Punkte, das Dreieck
    # einige hunderttausend; die Grenze liegt weit dazwischen.
    umriss = groesste_flaeche(a > 0.5)
    loecher = ndimage.binary_fill_holes(umriss) & ~umriss
    rot = (F[..., 0] - np.maximum(F[..., 1], F[..., 2]) > 40) & (F[..., 0] > 80)
    grenze = 0.0068 * F.shape[0] * F.shape[1]     # rund 60 000 Punkte bei 4K
    marken, n = ndimage.label(loecher)
    if n:
        gefuellt = np.zeros(n + 1, bool)
        for i, feld in enumerate(ndimage.find_objects(marken), start=1):
            rand_feld = tuple(slice(max(0, f.start - 10), f.stop + 10) for f in feld)
            loch = marken[rand_feld] == i
            ring = ndimage.binary_dilation(loch, structure=scheibe(8)) & ~loch
            if (loch.sum() < grenze and ring.sum()
                    and rot[rand_feld][ring].mean() >= 0.6):
                gefuellt[i] = True
        a = np.where(gefuellt[marken], 1.0, a)

    # Alles, was nicht am Rad haengt, ist Staub im Scan.
    zusammen = ndimage.binary_dilation(
        ndimage.binary_fill_holes(umriss), iterations=3)
    a = a * zusammen
    return a, grund, unten


def entsaeumen(rgb: np.ndarray, a: np.ndarray, grund: np.ndarray) -> np.ndarray:
    """C = a*F + (1-a)*B nach F aufloesen, damit kein heller Saum bleibt."""
    A = a[..., None]
    sicher = np.maximum(A, 0.25)
    frei = (rgb.astype(np.float32) - (1 - A) * grund) / sicher
    saum = (A > 0.02) & (A < 0.97)
    misch = np.clip((A - 0.02) / 0.35, 0, 1)
    gemischt = rgb.astype(np.float32) * (1 - misch) + np.clip(frei, 0, 255) * misch
    return np.where(saum, gemischt, rgb).astype(np.uint8)


def schatten_legen(rgb: np.ndarray, a: np.ndarray) -> tuple:
    """Einen weichen Schatten UNTER das Rad zeichnen.

    Die neuen Aufnahmen bringen keinen Boden mit. Ohne Schatten schwebt
    das Rad ueber dem hellen Grund der Seite - es sieht ausgeschnitten
    aus, und genau diesen Eindruck wollten wir loswerden.

    Der Schatten gehoert INS BILD und nicht ins Stylesheet. In CSS waere
    er eine zweite Hintergrundebene, die unter "contain" anders
    ausgemessen wird als das Foto; beim Verschieben liefe er dem Rad
    davon. Im Bild sitzt er ein fuer alle Mal an seiner Stelle.

    Groesse und Lage kommen aus dem Rad selbst: die Ellipse spannt vom
    hinteren zum vorderen Aufstandspunkt und liegt auf der Standlinie.
    """
    m = a > 0.6
    sp = np.where(m.any(axis=0))[0]
    linie = standlinie(a)
    x0, x1 = int(sp.min()), int(sp.max())
    spanne = x1 - x0

    # WIE WEIT IST DAS RAD AN DIESER STELLE VOM BODEN WEG?
    # Aus dieser einen Zahl folgt alles: wo der Reifen aufsetzt, ist der
    # Schatten dunkel und schmal; wo der Rahmen einen halben Meter
    # darueber steht, ist er blass und breit. Drei gezeichnete Ovale
    # sahen aus wie drei gezeichnete Ovale - dieser Weg gibt einen
    # zusammenhaengenden Schatten, der zum Rad gehoert.
    hoehe = np.full(a.shape[1], np.inf, np.float32)
    for x in sp:
        hoehe[x] = max(0.0, linie - int(np.where(m[:, x])[0].max()))

    endlich = np.isfinite(hoehe)
    kraft = np.zeros_like(hoehe)
    kraft[endlich] = np.exp(-hoehe[endlich] / (0.05 * spanne))
    kraft = ndimage.gaussian_filter1d(kraft, 0.012 * spanne)

    breite = np.full_like(hoehe, 0.02 * spanne)
    breite[endlich] += 0.09 * np.minimum(hoehe[endlich], 0.35 * spanne)
    breite = ndimage.gaussian_filter1d(breite, 0.03 * spanne)

    Y = np.arange(a.shape[0], dtype=np.float32)[:, None]
    schatten = 0.52 * kraft[None, :] * np.exp(-((Y - linie) / breite[None, :]) ** 2)

    # Kuehles Grau, nicht Marineblau: bei kleiner Deckkraft ueber hellem
    # Grund liest sich Blau als Farbstich, nicht als Schatten.
    farbe = np.array([26, 32, 46], np.float32)
    A = np.maximum(a, schatten)
    with np.errstate(invalid='ignore', divide='ignore'):
        neu = (rgb.astype(np.float32) * a[..., None]
               + farbe * (schatten * (1 - a))[..., None]) / np.maximum(A[..., None], 1e-6)
    return np.where(A[..., None] > 0, np.clip(neu, 0, 255), 255).astype(np.uint8), A


def kasten(a: np.ndarray):
    ys, xs = np.where(a > 0.6)
    return int(xs.min()), int(xs.max()), int(ys.min()), int(ys.max())


def standlinie(a: np.ndarray) -> int:
    """Die Zeile, in der die REIFEN aufsetzen - nicht der Staender.

    Der Staender ist bei allen drei Aufnahmen die tiefste Stelle des
    Umrisses. Die Reifen stehen aussen, der Staender in der Mitte;
    gemessen wird deshalb nur im linken und rechten Drittel.
    """
    m = a > 0.6
    sp = np.where(m.any(axis=0))[0]
    x0, x1 = int(sp.min()), int(sp.max())
    rand = (x1 - x0) * 0.3
    aussen = [x for x in sp if x <= x0 + rand or x >= x1 - rand]
    return max(int(np.where(m[:, x])[0].max()) for x in aussen)


def raddurchmesser(a: np.ndarray) -> float:
    """Durchmesser des HINTEREN Laufrades ueber einen Kreisschnitt.

    Der Umriss folgt am Aufstandspunkt einem Kreis. Aus der Hoehe, um die
    er in 160 Punkten Abstand ansteigt, ergibt sich der Radius:
    r = (d^2 + h^2) / (2h). Das ist verlaesslicher als jede Messung an
    der Silhouette, die immer wieder den Staender erwischt hat.
    """
    m = a > 0.6
    sp = np.where(m.any(axis=0))[0]
    boden = {int(x): int(np.where(m[:, x])[0].max()) for x in sp}
    linie = standlinie(a)
    beruehrt = [x for x in sp if boden[int(x)] >= linie - 4]
    # Die Reifen liegen aussen; das rechte Buendel ist ein Laufrad.
    gruppen, akt = [], [int(beruehrt[0])]
    for x in map(int, beruehrt[1:]):
        (akt.append(x) if x - akt[-1] <= 20 else (gruppen.append(akt), akt.clear(), akt.append(x)))
    gruppen.append(akt)
    xc = int(np.mean(gruppen[-1]))
    werte = []
    for d in (120, 160, 200):
        hs = [boden[xc] - boden[xc + s] for s in (-d, d) if (xc + s) in boden]
        if len(hs) == 2 and min(hs) > 0:
            h = float(np.mean(hs))
            werte.append((d * d + h * h) / h)
    return float(np.median(werte)) if werte else float('nan')


def main() -> int:
    if not os.path.isdir(QUELLEN) or not os.listdir(QUELLEN):
        print(f'Keine Vorlagen in {QUELLEN}')
        return 2

    dateien = sorted(f for f in os.listdir(QUELLEN)
                     if f.lower().endswith(('.png', '.jpg', '.jpeg', '.webp', '.tif', '.tiff')))
    print(f'{len(dateien)} Vorlage(n) in src/assets/neu\n')

    befund = {}
    for name in dateien:
        foto = Image.open(os.path.join(QUELLEN, name))
        a, grund, schwelle = alpha_aus_weiss(foto)
        k = kasten(a)
        befund[name] = dict(foto=foto, a=a, grund=grund, kasten=k,
                            boden=standlinie(a), rad=raddurchmesser(a))
        b = befund[name]
        print(f'{name}')
        print(f'   Bild {foto.size[0]}x{foto.size[1]}   Grund {grund.round(1)}   '
              f'Schwelle ab {schwelle:.1f}')
        print(f'   Rad im Bild  x {k[0]}..{k[1]} ({k[1]-k[0]} breit), '
              f'y {k[2]}..{k[3]} ({k[3]-k[2]} hoch)')
        print(f'   Reifen setzen auf bei y {b["boden"]}   '
              f'Hinterrad {b["rad"]:.0f} px{AUS}\n')

    if '--nur-messen' in sys.argv:
        print('Nur gemessen, nichts geschrieben.')
        return 0

    # ------------------------------------------------------------------
    # Schreiben
    #
    # NICHTS WIRD VERSCHOBEN UND NICHTS SKALIERT. Die drei Aufnahmen sind
    # bereits aufeinander normiert - gleiche Bildgroesse, gleiche Hoehe
    # des Rades (1449/1449/1450), gleiche Standlinie (1865/1866/1873).
    # Wer daran noch dreht, macht es nur schlechter. Es bleibt das
    # Verkleinern auf das Buehnenmass.
    # ------------------------------------------------------------------
    # Erst alle drei fertig rechnen, dann gemeinsam beschneiden.
    fertig, rohalpha = {}, {}
    for name, ziel in ZUORDNUNG.items():
        treffer = [f for f in dateien if name in f]
        if not treffer:
            print(f'Keine Vorlage fuer {name} gefunden')
            return 1
        b = befund[treffer[0]]
        rgb = entsaeumen(np.asarray(b['foto'].convert('RGB')), b['a'], b['grund'])
        rohalpha[ziel] = b['a']
        rgb, a = schatten_legen(rgb, b['a'])
        fertig[ziel] = np.dstack([rgb, (a * 255).round().astype(np.uint8)])

    # GEMEINSAM BESCHNEIDEN.
    # Die Vorlagen haben rundum viel Weiss. Auf dem Telefon, wo die ganze
    # Buehne in 390 Punkte muss, ging davon ein Drittel der Breite an
    # leeren Rand - das Rad war 283 Punkte breit, obwohl 320 gepasst
    # haetten. Der Ausschnitt gilt fuer ALLE DREI gleich; nur so bleiben
    # sie deckungsgleich, und nur so bleibt sichtbar, dass das Lastenrad
    # das laengste ist.
    kanten, eigen = [], {}
    for ziel, A in fertig.items():
        # Schwelle 6, nicht 2: der Schatten laeuft nach unten so weit
        # aus, dass die letzten Zeilen nichts mehr zeigen. Sie kosteten
        # aber Bildhoehe - und damit Groesse des Rades im Rahmen.
        ys, _ = np.where(A[..., 3] > 6)
        kanten.append((int(ys.min()), int(ys.max())))
        _, xs = np.where(rohalpha[ziel] > 0.02)          # das Rad ohne Schatten
        eigen[ziel] = (int(xs.min()), int(xs.max()) + 1)

    # SENKRECHT GEMEINSAM, WAAGRECHT EINZELN.
    #
    # Gemeinsam senkrecht und im gemeinsamen Massstab: alle drei stehen
    # auf derselben Standlinie und sind gleich gross abgebildet. Daran
    # darf nichts geruettelt werden - daraus lebt der Wechsel.
    #
    # Einzeln waagrecht: jedes Bild endet rechts an SEINEM Vorderrad.
    # Nur so kann das Stylesheet jedes Rad auf die Flucht der Spur
    # setzen. Bei einem gemeinsamen Ausschnitt beruehrt sie nur das
    # breiteste - das Lastenrad -, die beiden anderen schwimmen hundert
    # Punkte davor. Dass die drei dadurch nicht mehr denselben
    # Weltausschnitt zeigen, sieht niemand: sie fahren beim Wechsel
    # ohnehin eine ganze Bildschirmbreite weit.
    y0 = max(0, min(k[0] for k in kanten) - 8)
    y1 = min(list(fertig.values())[0].shape[0], max(k[1] for k in kanten) + 7)
    massstab = ZIELHOEHE / (y1 - y0)
    print(f'\nSenkrecht gemeinsam: y {y0}..{y1}  ->  {ZIELHOEHE} Punkte hoch\n')

    with open(os.path.join(ZIELE, 'buehne-ausschnitt.txt'), 'w', encoding='utf-8') as f:
        f.write('# Ausschnitt der Vorlagen aus src/assets/neu\n')
        f.write('# senkrecht gemeinsam, waagrecht je Rad sein eigenes Vorderrad\n')
        f.write(f'# oben unten zielhoehe\n{y0} {y1} {ZIELHOEHE}\n')
        for ziel, (x0, x1) in eigen.items():
            f.write(f'{ziel} {x0} {x1}\n')

    for ziel, A in fertig.items():
        x0, x1 = eigen[ziel]
        aus = Image.fromarray(A[y0:y1, x0:x1], 'RGBA')
        bild = verkleinern(aus, max(1, round((x1 - x0) * massstab)))
        bild.save(os.path.join(ZIELE, ziel), format='WEBP', lossless=True, method=6)
        kb = os.path.getsize(os.path.join(ZIELE, ziel)) / 1024
        print(f'{ziel:24s} {bild.size[0]}x{bild.size[1]}  {kb:6.0f} KB')
    return 0


if __name__ == '__main__':
    sys.exit(main())
