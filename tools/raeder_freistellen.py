"""Die drei Raeder freistellen und massstabsgleich auf dieselbe Buehne setzen."""
from PIL import Image, ImageFilter
import numpy as np
from scipy import ndimage

BREITE, HOEHE = 1618, 972
BODEN = 862          # gemeinsame Standlinie, gemittelt aus E-Bike und City
ZIELBREITE_CARGO = 1360   # 1,09-mal das E-Bike: laenger, aber mit Rand
RAND = 60            # Bildrand: Vignette, taugt nicht als Wandmuster

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
    a = bodenkante_entfernen(a)
    # Der Grund ist hier die Wand selbst - zeilenweise geschaetzt.
    return a, np.median(F, axis=1, keepdims=True)

def alpha_aus_schachbrett(foto):
    rgb = np.asarray(foto.convert('RGB'))
    A = rgb.astype(np.int16)
    m = (A.min(axis=2) > 233) & ((A.max(axis=2) - A.min(axis=2)) < 12)
    maske = groesste_flaeche(ndimage.binary_fill_holes(~m))
    alpha = (255 - m.astype(np.float32) * 255) * maske
    # Das Schachbrett ist nahezu weiss; sein mittlerer Wert dient als
    # Grund fuer die Entsaeumung.
    grund = float(rgb[m].mean()) if m.any() else 250.0
    return alpha, np.float32(grund)

def bodenkante_entfernen(alpha):
    """Den Strich wegnehmen, an dem Wand und Boden sich treffen.

    Er ist HINTERGRUND, nicht Rad - aber er beruehrt beide Reifen und
    kommt deshalb als zusammenhaengende Flaeche mit durch. Im Bild ist er
    vier Pixel hoch und ueber neunhundert Pixel breit; auf dem Telefon,
    wo das Rad klein steht, sah man ihn als hellen Strich links und
    rechts neben dem Rad in der Luft haengen. Genau das hat der Nutzer am
    24.08.2026 als "Artefakte zwischen dem Rad und dem Hintergrund"
    gemeldet.

    Das Kennzeichen ist die Form: ein Pixel des Strichs steht in einem
    sehr kurzen senkrechten Zug (vier Pixel), und seine Bildzeile ist
    ueber die ganze Breite gefuellt. Am Rad trifft beides nie zusammen -
    Speichen stehen zwar duenn, aber in Zeilen mit wenigen hundert
    gesetzten Pixeln; der Kasten des Lastenrads fuellt zwar ganze Zeilen,
    steht aber in langen senkrechten Zuegen.
    """
    m = alpha > 24
    senkrecht = np.array([[0, 1, 0], [0, 1, 0], [0, 1, 0]], bool)
    marken, n = ndimage.label(m, structure=senkrecht)
    if n == 0:
        return alpha
    laenge = np.zeros(n + 1, np.int32)
    laenge[1:] = ndimage.sum(m, marken, range(1, n + 1)).astype(np.int32)
    duenn = laenge[marken] < 8
    volle_zeile = (m.sum(axis=1) > 500)[:, None]
    alpha = np.where(m & duenn & volle_zeile, 0, alpha)
    # Was jetzt noch lose herumliegt, gehoert nicht zum Rad.
    return alpha * groesste_flaeche(alpha > 24)


def standlinie(alpha):
    """Die Zeile, in der die REIFEN aufsetzen.

    Nicht der tiefste Punkt des Umrisses - das ist bei allen drei
    Aufnahmen der Staender, und beim Lastenrad steht er deutlich tiefer
    als die Reifen. Auf den tiefsten Punkt ausgerichtet, schwebte das
    Lastenrad ueber dem Boden der Wand: neunzehn aufsetzende Spalten
    gegen hundertfuenfundsiebzig beim E-Bike.

    Die Reifen stehen aussen, der Staender in der Mitte. Gemessen wird
    deshalb nur im linken und rechten Drittel.
    """
    m = alpha > 40
    sp = np.where(m.any(axis=0))[0]
    x0, x1 = int(sp.min()), int(sp.max())
    rand = (x1 - x0) * 0.3
    aussen = [x for x in sp if x <= x0 + rand or x >= x1 - rand]
    return max(int(np.where(m[:, x])[0].max()) for x in aussen)


def kasten(alpha):
    """Der Inhaltskasten des Rades: links, rechts, oben, unten.

    Hier stand bis zum 24.08.2026 eine Messung des Hinterrades. Sie war
    nicht zu retten: das Verfahren griff sich die tiefste Stelle des
    Umrisses, und die ist bei allen drei Aufnahmen der STAENDER, nicht
    der Reifen. Ausserdem sind die Raeder gar nicht vergleichbar - das
    Lastenrad faehrt vorn 20 Zoll und hinten 26, die beiden anderen 28.
    Der Kasten ist das, was fuer die Buehne wirklich zaehlt.
    """
    fest = groesste_flaeche(alpha > 150)
    ys, xs = np.where(fest)
    return int(xs.min()), int(xs.max()), int(ys.min()), int(ys.max())


def weich(alpha):
    return Image.fromarray(alpha.astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.6))


def wand_bauen(quelle='src/assets/velocity-bike-city-hero.png',
               freisteller='src/assets/rad-city-frei.webp',
               ziel='src/assets/velocity-wand.jpg'):
    """Die Buehne ohne Rad: Beton und Asphalt ueber die volle Breite.

    DEN STREIFEN NICHT SCHAETZEN.
    Die erste Fassung nahm x 62..239 der E-Bike-Aufnahme - gefunden ueber
    ein Mass fuer "ruhige" Bildspalten. Das war daneben: dort steht das
    Hinterrad. Beim Kacheln wanderten seine Umrisse als blasse Reifen
    ueber die ganze Wand, auf dem Telefon durch die starke Vergroesserung
    deutlich sichtbar.

    Jetzt liefert die Freistellungsmaske die Antwort exakt: radfrei ist
    eine Spalte genau dann, wenn ihr Alphakanal ueberall null ist. Beim
    City-Bike sind das die aeussersten 166 Punkte rechts.

    Gekachelt wird abwechselnd gespiegelt und MIT UEBERBLENDUNG. Stumpf
    gestossen bliebe an jeder Naht eine senkrechte Kante stehen; auf
    einer Betonwand faellt so etwas sofort auf.
    """
    hero = Image.open(quelle).convert('RGB')
    F = np.asarray(hero).astype(np.float32)
    alpha = np.asarray(Image.open(freisteller).convert('RGBA'))[..., 3]
    frei = (alpha < 6).all(axis=0)
    frei[:RAND] = False; frei[-RAND:] = False   # Vignette und Bildkante
    best, lauf = (0, 0), 0
    for i, v in enumerate(frei):
        lauf = lauf + 1 if v else 0
        if lauf > best[1] - best[0]:
            best = (i - lauf + 1, i + 1)
    if best[1] - best[0] < 60:
        raise SystemExit('Kein ausreichend breiter radfreier Streifen gefunden')
    print(f'Wandstreifen x {best[0]}..{best[1]} ({best[1]-best[0]} px, nachweislich radfrei)')

    # GROB UND FEIN TRENNEN.
    # Ein gekachelter Streifen wiederholt alles, was in ihm steht - auch
    # die grossflaechigen Helligkeitsunterschiede der Wand. Genau die
    # sieht man dann als Muster: dieselbe helle Stelle alle paar hundert
    # Pixel. Das Korn des Betons wiederholt sich zwar auch, ist aber zu
    # klein, um als Muster gelesen zu werden.
    #
    # Also wandert nur das Korn in die Kachelung. Die grosse Helligkeit
    # kommt aus dem Zeilenmittel der ganzen Aufnahme - eine Zahl je
    # Bildzeile, ueber die Breite gleich. Sie kann sich nicht
    # wiederholen, weil sie waagrecht gar nicht variiert, und sie traegt
    # den Uebergang von der Wand zum Boden an der richtigen Stelle.
    streifen = Image.open(quelle).convert('RGB').crop((best[0], 0, best[1], HOEHE))
    grob = streifen.filter(ImageFilter.GaussianBlur(40))
    korn = np.asarray(streifen).astype(np.float32) - np.asarray(grob).astype(np.float32)

    sb = korn.shape[1]
    ueber = 44                       # Breite der Ueberblendung
    rampe = np.ones(sb, np.float32)
    rampe[:ueber] = np.linspace(0, 1, ueber)
    rampe[-ueber:] = np.linspace(1, 0, ueber)

    summe = np.zeros((HOEHE, BREITE, 3), np.float32)
    gewicht = np.zeros((HOEHE, BREITE, 1), np.float32)
    x, gespiegelt = -ueber, False
    while x < BREITE:
        k = korn[:, ::-1] if gespiegelt else korn
        von, bis = max(0, x), min(BREITE, x + sb)
        kv, kb = von - x, bis - x
        g = rampe[kv:kb][None, :, None]
        summe[:, von:bis] += k[:, kv:kb] * g
        gewicht[:, von:bis] += g
        x += sb - ueber
        gespiegelt = not gespiegelt

    feld = np.median(F, axis=1, keepdims=True)          # je Zeile eine Farbe
    wand = np.clip(feld + summe / np.maximum(gewicht, 1e-6), 0, 255)
    wand = Image.fromarray(wand.astype(np.uint8))
    wand.save(ziel, quality=86, optimize=True, progressive=True)
    return wand


def entsaeumen(rgb, alpha, grund):
    """Den Hintergrund aus den halbdurchsichtigen Randpixeln herausrechnen.

    Ein Randpixel zeigt eine Mischung: C = a*F + (1-a)*B. Wer nur die
    Deckkraft setzt und C stehen laesst, behaelt den Hintergrund im Saum -
    beim Lastenrad war das ein weisser Rand um jede Kante, weil dort ein
    helles Schachbrett lag. Nach F aufgeloest verschwindet er.

    Unterhalb von etwa 8 Prozent Deckkraft wird nicht mehr gerechnet:
    dort steht F fast nur noch aus Rauschen.
    """
    a = (alpha.astype(np.float32) / 255.0)[..., None]
    sicher = np.maximum(a, 0.08)
    frei = (rgb.astype(np.float32) - (1 - a) * grund) / sicher
    # Nur im Saum ersetzen; im Kern ist das Bild ohnehin unveraendert.
    saum = (a > 0.02) & (a < 0.97)
    return np.where(saum, np.clip(frei, 0, 255), rgb).astype(np.uint8)

if __name__ == '__main__':
    # 1 E-Bike und City direkt aus den Aufnahmen. Sie kommen ZUERST -
    # die Wand braucht ihre Maske, um den radfreien Streifen zu finden.
    # (Umgekehrt braucht die Freistellung die Wand nicht: sie schaetzt
    # den Hintergrund zeilenweise aus der Aufnahme selbst.)
    masse = {}
    for quelle, ziel, name in [('velocity-bike-hero.png', 'rad-ebike-frei.webp', 'ebike'),
                               ('velocity-bike-city-hero.png', 'rad-city-frei.webp', 'city')]:
        foto = Image.open('src/assets/' + quelle)
        alpha, grund = alpha_aus_foto(foto)
        # ERST weichzeichnen, DANN entsaeumen: der Saum entsteht beim
        # Weichzeichnen. Andersherum rechnet man an einer harten Kante
        # herum, an der es nichts zu rechnen gibt - der Rand blieb hell.
        weiche = np.asarray(weich(alpha))
        rgb = entsaeumen(np.asarray(foto.convert('RGB')), weiche, grund)
        Image.merge('RGBA', (*Image.fromarray(rgb).split(),
                             Image.fromarray(weiche))) \
             .save('src/assets/' + ziel, format='WEBP', quality=86, method=6)
        k = kasten(alpha)
        masse[name] = k
        print(f'{name:6s} Kasten {k}  Breite {k[1] - k[0]}')

    # 2 Lastenrad massstabsgleich einpassen
    roh = Image.open('src/assets/rad-cargo-quelle.jpg')
    alpha, grund = alpha_aus_schachbrett(roh)
    k_cargo = kasten(alpha)
    # Ein Lastenrad ist wirklich laenger - rund zweieinhalb Meter gegen
    # knapp zwei. Massstabsgetreu neben das E-Bike gestellt waere es
    # ueber zweitausend Pixel breit und liefe rechts und links aus dem
    # Bild. Es wird deshalb auf die volle Buehnenbreite gesetzt: es
    # bleibt sichtbar das groesste der drei Raeder, ohne angeschnitten zu
    # sein. Die Raeder wirken dabei etwas kleiner als in Wirklichkeit -
    # das ist der Preis, und er faellt weniger auf als ein Rad, dem der
    # Kasten fehlt.
    f = ZIELBREITE_CARGO / (k_cargo[1] - k_cargo[0])
    print(f'cargo  Kasten {k_cargo}  Breite {k_cargo[1] - k_cargo[0]}'
          f' -> Massstab {f:.4f}')

    weiche = np.asarray(weich(alpha))
    rgb = entsaeumen(np.asarray(roh.convert('RGB')), weiche, grund)
    rad = Image.merge('RGBA', (*Image.fromarray(rgb).split(), Image.fromarray(weiche)))
    neu = (int(round(roh.size[0] * f)), int(round(roh.size[1] * f)))
    rad = rad.resize(neu, Image.LANCZOS)

    a2 = np.asarray(rad)[..., 3]
    ys, xs = np.where(groesste_flaeche(a2 > 150))
    buehne = Image.new('RGBA', (BREITE, HOEHE), (0, 0, 0, 0))

    # Waagrecht NICHT in die Bildmitte, sondern auf dieselbe optische
    # Mitte wie die beiden Aufnahmen. Der Fotograf hat sie leicht links
    # gesetzt; ein mittig gestelltes Lastenrad stand daneben sichtbar
    # versetzt - beim Wechsel sprang das Bild.
    mitte_soll = sum((k[0] + k[1]) / 2 for k in masse.values()) / len(masse)
    mitte_ist = (int(xs.min()) + int(xs.max())) / 2
    dx = int(round(mitte_soll - mitte_ist))
    dy = BODEN - standlinie(np.asarray(rad)[..., 3])            # auf die Standlinie
    buehne.alpha_composite(rad, (dx, dy))
    print(f'optische Mitte: Vorlagen {mitte_soll:.0f}, Lastenrad {mitte_ist:.0f} -> {dx:+d}')
    buehne.save('src/assets/rad-cargo-frei.webp', format='WEBP', quality=86, method=6)
    k2 = kasten(np.asarray(buehne)[..., 3])
    print(f'cargo eingepasst: Kasten {k2}  Breite {k2[1] - k2[0]}, Versatz ({dx}, {dy})')

    # 3 Die Buehne zuletzt - jetzt liegen die Masken vor.
    wand_bauen()
    print('Wand gebaut')
