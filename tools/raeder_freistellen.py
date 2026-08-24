"""Die drei Raeder freistellen und massstabsgleich auf dieselbe Buehne setzen.

VERLUSTFREI GESPEICHERT (24.08.2026)
Bei Qualitaet 86 wich das Ergebnis in deckenden Flaechen im Mittel um
knapp vier Stufen von der Vorlage ab, in der Spitze um zweiundvierzig.
Sichtbar ist das kaum - aber es ist eben doch nicht die Vorlage, und der
Nutzer hat ausdruecklich Bilder ohne Artefakte verlangt. Verlustfrei
kosten die drei Raeder zusammen rund 1,4 MB statt 470 KB. Die Wand bleibt
JPEG: sie ist ohnehin synthetisch, und ihre Kompression hat kein Motiv,
an dem man sie sehen koennte.
"""
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

def sanft(x, a, b):
    """Weicher Uebergang von 0 auf 1 zwischen a und b."""
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def grund_weit(F):
    """Wand und Boden OHNE das Rad, zeilenweise aus radfreien Punkten.

    Die erste Fassung nahm einfach den Median jeder Bildzeile. Das ist zu
    grob: die Wand ist auch INNERHALB einer Zeile nicht gleich hell - die
    Ausleuchtung faellt zu den Raendern ab. Der Rest lag dadurch im Mittel
    bei sieben Stufen und in der Spitze bei fuenfundzwanzig, und deshalb
    musste die Schwelle bei achtundzwanzig liegen. Eine Speiche ist ein
    bis zwei Punkte breit; unter dieser Schwelle blieb von ihr eine
    gestrichelte Linie. Genau das hat der Nutzer am 24.08.2026 gesehen.

    Jetzt wird je Zeile zwischen den radfreien Punkten interpoliert. Der
    Median der Zeile dient nur noch dazu, ueberhaupt erst zu erkennen, wo
    das Rad ungefaehr steht (grosszuegig verbreitert). Das Ergebnis folgt
    der Ausleuchtung waagrecht wie senkrecht; der Rest sinkt auf drei
    Stufen, und die Schwelle darf auf zehn.
    """
    # Die Grobmaske darf die BODENKANTE nicht mitmarkieren. Mit dem
    # Zeilenmedian tat sie genau das: an der schraeg verlaufenden Kante
    # liegt eine Zeile halb auf der Wand und halb auf dem Boden, der
    # Median liegt dazwischen, und beide Haelften weichen um mehr als
    # vierzig Stufen ab - die ganze Zeile galt als Rad, es blieb kein
    # Stuetzpunkt uebrig, und der Notbehelf schrieb den Median hinein.
    # Der waagrechte Median ueber 401 Punkte rechnet NUR innerhalb der
    # Zeile und folgt der Kante deshalb genau.
    roh = np.stack([ndimage.median_filter(F[..., k], size=(1, 401), mode='nearest')
                    for k in range(3)], axis=2)
    grob = np.abs(F - roh).max(axis=2) > 40
    grob = ndimage.binary_dilation(grob, iterations=8)
    B = np.empty_like(F)
    x = np.arange(F.shape[1])
    for y in range(F.shape[0]):
        frei = ~grob[y]
        if frei.sum() < 20:                       # Zeile ganz vom Rad verdeckt
            B[y] = np.median(F[y], axis=0)
            continue
        for k in range(3):
            B[y, :, k] = np.interp(x, x[frei], F[y, frei, k])
    return ndimage.gaussian_filter1d(B, 15, axis=1)


def alpha_aus_foto(foto):
    """Das Rad aus der Aufnahme loesen - mit ZWEI Hintergrundmodellen.

    Ein einziges Modell kann beides nicht: aussen steht das Rad vor einer
    glatten Wand, innen - zwischen Nabe und Felge - steht es vor
    gekoerntem Pflaster. Was fuer das eine die richtige Schwelle ist, ist
    fuer das andere die falsche.

      weit  zeilenweise interpoliert (grund_weit). Glatt, folgt der
            Ausleuchtung. Rest auf der Wand: drei Stufen.
      nah   oertlicher Median ueber 41 Punkte. Er nimmt das Korn des
            Pflasters mit auf und laesst duenne Dinge stehen - eine
            Speiche ist zu schmal, um den Median zu bewegen.

    DREI ZONEN

      Kern    weit ueber 34: hier ist sicher Rad. Deckkraft eins.
      Rand    drei Punkte um den Kern: hier wird gemischt. Gemessen wird
              am KLEINEREN der beiden Reste - ein echter Hintergrundpunkt
              ist in wenigstens einem Modell unauffaellig, ein Radpunkt in
              keinem. Ohne das blieben helle Wolken am Rahmen stehen: das
              weite Modell wird in radreichen Zeilen vom Rad selbst
              verzogen.
      Innen   die eingeschlossenen Flaechen, also die Radinneren. Dort
              liegt Pflaster, dessen dunkle Kiesel bis auf hundert Stufen
              kommen. Die Helligkeit allein entscheidet hier nicht - die
              FORM entscheidet: eine Speiche ist lang, ein Kiesel ist
              rund. Was kuerzer als zwanzig Punkte ist, faellt weg.
    """
    F = np.asarray(foto.convert('RGB')).astype(np.float32)
    weit = grund_weit(F)
    nah = np.stack([ndimage.median_filter(F[..., k], size=41, mode='nearest')
                    for k in range(3)], axis=2)
    d_weit = np.abs(F - weit).max(axis=2)
    d_nah = np.abs(F - nah).max(axis=2)

    kern = groesste_flaeche(d_weit > 34)
    voll = ndimage.binary_fill_holes(kern)
    breit = ndimage.binary_dilation(kern, iterations=3)

    a = kern.astype(np.float32)
    rand = breit & ~kern
    a[rand] = sanft(np.minimum(d_weit, d_nah), 10, 26)[rand]

    innen = voll & ~breit
    a_innen = sanft(d_nah, 50, 80) * innen
    marken, n = ndimage.label(a_innen > 0.15)
    if n:
        for i, feld in enumerate(ndimage.find_objects(marken), start=1):
            laenge = max(feld[0].stop - feld[0].start, feld[1].stop - feld[1].start)
            if laenge < 20:
                a_innen[marken == i] = 0
    a = np.maximum(a, a_innen)

    return bodenkante_entfernen(a * 255.0), weit


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
    def zuglaenge(maske, achse):
        """Laenge des Zuges, in dem jeder gesetzte Punkt steht."""
        richtung = (np.array([[0, 1, 0], [0, 1, 0], [0, 1, 0]], bool) if achse == 0
                    else np.array([[0, 0, 0], [1, 1, 1], [0, 0, 0]], bool))
        marken, n = ndimage.label(maske, structure=richtung)
        laenge = np.zeros(n + 1, np.int32)
        if n:
            laenge[1:] = ndimage.sum(maske, marken, range(1, n + 1)).astype(np.int32)
        return laenge[marken]

    m = alpha > 24
    # Frueher hing die Regel an der Zahl gesetzter Punkte je Zeile. Das
    # war richtig, solange die Speichen ohnehin zerrissen waren - mit
    # heilen Speichen sind dieselben Zeilen dicht besetzt, und die Regel
    # frass genau das, was sie schuetzen sollte. Jetzt zaehlt die Form des
    # einzelnen Zuges: sehr lang waagrecht UND sehr kurz senkrecht. Eine
    # fast waagrechte Speiche kommt bei ihrer Dicke auf keine hundert
    # Punkte Lauflaenge.
    weg = m & (zuglaenge(m, 1) > 150) & (zuglaenge(m, 0) < 8)
    alpha = np.where(weg, 0, alpha)
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
    sicher = np.maximum(a, 0.25)
    frei = (rgb.astype(np.float32) - (1 - a) * grund) / sicher
    # Nur im Saum ersetzen; im Kern ist das Bild ohnehin unveraendert.
    # Die Untergrenze liegt bei einem Viertel und nicht bei acht Prozent:
    # darunter wird durch eine sehr kleine Zahl geteilt, und aus Rauschen
    # werden weisse und rote Spritzer. Auf den Speichen war das gut zu
    # sehen. Zusaetzlich wird die Rechnung mit der Deckkraft eingeblendet,
    # damit sie dort, wo sie unsicher ist, auch wenig aendert.
    saum = (a > 0.02) & (a < 0.97)
    misch = np.clip((a - 0.02) / 0.35, 0, 1)
    weich_frei = rgb.astype(np.float32) * (1 - misch) + np.clip(frei, 0, 255) * misch
    return np.where(saum, weich_frei, rgb).astype(np.uint8)

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
        # Nicht mehr weichzeichnen: die Kante kommt schon weich aus dem
        # Uebergang zwischen den Schwellen. Ein Weichzeichner darueber
        # duennt genau die Speichen aus, um die es hier geht.
        weiche = alpha.astype(np.uint8)
        rgb = entsaeumen(np.asarray(foto.convert('RGB')), weiche, grund)
        Image.merge('RGBA', (*Image.fromarray(rgb).split(),
                             Image.fromarray(weiche))) \
             .save('src/assets/' + ziel, format='WEBP', lossless=True, method=6)
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
    buehne.save('src/assets/rad-cargo-frei.webp', format='WEBP', lossless=True, method=6)
    k2 = kasten(np.asarray(buehne)[..., 3])
    print(f'cargo eingepasst: Kasten {k2}  Breite {k2[1] - k2[0]}, Versatz ({dx}, {dy})')

    # 3 Die Buehne zuletzt - jetzt liegen die Masken vor.
    wand_bauen()
    print('Wand gebaut')
