"""Die drei Raeder freistellen und massstabsgleich auf dieselbe Buehne setzen."""
from PIL import Image, ImageFilter
import numpy as np
from scipy import ndimage

BREITE, HOEHE = 1618, 972
BODEN = 862          # gemeinsame Standlinie, gemittelt aus E-Bike und City

def groesste_flaeche(maske):
    marken, n = ndimage.label(maske)
    if n == 0: return maske
    gr = ndimage.sum(maske, marken, range(1, n + 1))
    return marken == (int(np.argmax(gr)) + 1)

def alpha_aus_foto(foto):
    """Die Wand ist je Bildzeile fast gleichmaessig - das Rad weicht ab."""
    F = np.asarray(foto.convert('RGB')).astype(np.float32)
    diff = np.abs(F - np.median(F, axis=1, keepdims=True)).max(axis=2)
    kern = groessste = groesste_flaeche(diff > 30)
    weit = diff > 10
    marken, _ = ndimage.label(weit)
    gute = np.unique(marken[kern]); gute = gute[gute > 0]
    maske = ndimage.binary_fill_holes(np.isin(marken, gute))
    maske = groesste_flaeche(maske)
    # Die Aufnahme traegt einen blassen Schatten des jeweils anderen
    # Rades - ein Rest der urspruenglichen Ueberblendung. Solange beide
    # Raeder ineinander geblendet wurden, fiel er nicht auf; jetzt, wo
    # das andere Rad wirklich hereinfaehrt, waere er ein Geist. Die
    # Schwelle liegt deshalb hoeher als noetig waere, um nur Wand zu
    # entfernen.
    alpha = np.clip((diff - 28) * 13, 0, 255) * maske

    # Die Kante zwischen Wand und Boden laeuft quer durchs ganze Bild und
    # haengt an den Reifen - sie kaeme beim Wandern als Streifen mit. Der
    # Ausschnitt richtet sich deshalb nach dem SICHEREN Kern (diff > 60),
    # in dem nur das Rad selbst liegt.
    # Der aeussere Rand traegt Vignette und Wandschatten; er wird vorher
    # ausgeblendet, damit er den Kern nicht bis an die Bildkante zieht.
    hart = diff > 60
    hart[:40, :] = False; hart[-40:, :] = False
    hart[:, :40] = False; hart[:, -40:] = False
    kern_hart = groesste_flaeche(hart)
    ys, xs = np.where(kern_hart)
    x0, x1 = max(0, int(xs.min()) - 10), min(alpha.shape[1], int(xs.max()) + 11)
    y0, y1 = max(0, int(ys.min()) - 10), min(alpha.shape[0], int(ys.max()) + 11)
    a = np.zeros_like(alpha)
    a[y0:y1, x0:x1] = alpha[y0:y1, x0:x1]
    return a, (x0, y0, x1, y1)

def alpha_aus_schachbrett(foto):
    A = np.asarray(foto.convert('RGB')).astype(np.int16)
    m = (A.min(axis=2) > 233) & ((A.max(axis=2) - A.min(axis=2)) < 12)
    maske = groesste_flaeche(ndimage.binary_fill_holes(~m))
    diff = 255 - m.astype(np.float32) * 255
    return diff * maske, None

def raddurchmesser(alpha):
    fest = groesste_flaeche(alpha > 150)
    ys, xs = np.where(fest)
    x0, x1 = xs.min(), xs.max()
    drittel = fest[:, x0:x0 + (x1 - x0)//3]
    hoehen = [(np.where(drittel[:, i])[0].max() - np.where(drittel[:, i])[0].min())
              if drittel[:, i].any() else 0 for i in range(drittel.shape[1])]
    return int(max(hoehen)), (int(x0), int(xs.max()), int(ys.min()), int(ys.max()))

def weich(alpha):
    return Image.fromarray(alpha.astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.6))

if __name__ == '__main__':
    # 1 E-Bike und City direkt aus den Aufnahmen
    masse = {}
    for quelle, ziel, name in [('velocity-bike-hero.png', 'rad-ebike-frei.webp', 'ebike'),
                               ('velocity-bike-city-hero.png', 'rad-city-frei.webp', 'city')]:
        foto = Image.open('src/assets/' + quelle)
        alpha, _ = alpha_aus_foto(foto)
        Image.merge('RGBA', (*foto.convert('RGB').split(), weich(alpha))) \
             .save('src/assets/' + ziel, format='WEBP', quality=86, method=6)
        d, kasten = raddurchmesser(alpha)
        masse[name] = (d, kasten)
        print(f'{name:6s} Rad {d} px, Kasten {kasten}')

    # 2 Lastenrad massstabsgleich einpassen
    roh = Image.open('src/assets/rad-cargo-quelle.jpg')
    alpha, _ = alpha_aus_schachbrett(roh)
    d_cargo, kasten = raddurchmesser(alpha)
    f = masse['ebike'][0] / d_cargo
    print(f'cargo  Rad {d_cargo} px -> Massstab {f:.4f}')

    rad = Image.merge('RGBA', (*roh.convert('RGB').split(), weich(alpha)))
    neu = (int(round(roh.size[0] * f)), int(round(roh.size[1] * f)))
    rad = rad.resize(neu, Image.LANCZOS)

    a2 = np.asarray(rad)[..., 3]
    ys, xs = np.where(groesste_flaeche(a2 > 150))
    buehne = Image.new('RGBA', (BREITE, HOEHE), (0, 0, 0, 0))
    dx = (BREITE - (xs.max() - xs.min())) // 2 - xs.min()      # waagrecht mittig
    dy = BODEN - int(ys.max())                                  # auf die Standlinie
    buehne.alpha_composite(rad, (dx, dy))
    buehne.save('src/assets/rad-cargo-frei.webp', format='WEBP', quality=86, method=6)
    d2, k2 = raddurchmesser(np.asarray(buehne)[..., 3])
    print(f'cargo eingepasst: Rad {d2} px, Kasten {k2}, Versatz ({dx}, {dy})')
