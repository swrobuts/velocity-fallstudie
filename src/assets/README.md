# Bilder

| Datei | Zweck |
|---|---|
| `velocity-bike-hero.png`, `velocity-bike-city-hero.png` | Die beiden grossen Motive der Buehne im Kopfbereich. Der WebGL-Morph blendet genau zwischen diesen beiden ueber — **nicht ersetzen**, ohne `velocity-bike-morph.js` mitzudenken. |
| `rad-city.jpg`, `rad-ebike.jpg`, `rad-cargo.jpg` | Die Vorschaubilder im Kartenpopover, 480 px breit, rund 30 KB. |
| `*-quelle.*` | Die gelieferten Originale, aus denen die Vorschaubilder entstehen. |

## Vorschaubild neu erzeugen

Die Freisteller kamen mit eingebranntem Transparenz-Schachbrett: zwei
Grautoene (246 und 254), die auf weissem Grund sichtbar waeren. Beim
Erzeugen wird jedes neutrale Pixel ab Helligkeit 238 auf reines Weiss
gesetzt, dann auf das Motiv zugeschnitten und auf 480 px verkleinert.

Das Popover zeigt die Bilder mit `object-fit: contain` auf weissem
Grund — also das ganze Rad, nicht einen Ausschnitt.

## Buehne des Kopfbereichs (Stand 25.08.2026)

| Datei | Zweck |
|---|---|
| `velocity-bike-hero.png` | Ausgangsaufnahme E-Bike (vom Nutzer) — wird nicht ausgeliefert |
| `velocity-bike-city-hero.png` | Ausgangsaufnahme City-Bike (vom Nutzer) — wird nicht ausgeliefert |
| `rad-cargo-quelle.jpg` | Ausgangsaufnahme Lastenrad, freigestellt auf Schachbrett |
| `velocity-wand.jpg` | Die Buehne ohne Rad |
| `rad-ebike-frei.webp` | E-Bike freigestellt, mit Alphakanal |
| `rad-city-frei.webp` | City-Bike freigestellt, mit Alphakanal |
| `rad-cargo-frei.webp` | Lastenrad freigestellt, massstabsgleich eingepasst |

Zusammen rund 810 KB statt 6,8 MB in PNG.

**Warum freigestellt?** Der Kopfbereich zeigt nacheinander drei Raeder.
Bis zum 25.08.2026 blendete ein WebGL-Morph zwei Fotos ineinander; auf
halber Strecke standen zwei Rahmen und vier Laufraeder versetzt
uebereinander. Zwei Fotos verschiedener Raeder lassen sich nicht
ineinander blenden. Jetzt liegt die Wand als eigene Ebene darunter, und
die Raeder wechseln den Platz statt der Deckkraft.

**Neu erzeugen:** `python3 tools/raeder_freistellen.py` (aus dem
Projektverzeichnis). Das Skript

1. baut die Wand aus einem radfreien Streifen der E-Bike-Aufnahme
   (x 62–239), gespiegelt gekachelt, mit ueberdecktem Poller,
2. stellt E-Bike und City-Bike ueber den zeilenweisen Median frei — die
   Wand ist in jeder Bildzeile nahezu gleichmaessig, das Rad weicht ab,
3. misst den Hinterraddurchmesser jedes Rades und passt das Lastenrad
   massstabsgleich auf dieselbe Standlinie ein.

Die Schwelle liegt bei `diff > 28`. Niedriger holt einen blassen
Schatten des jeweils anderen Rades mit, der in beiden Aufnahmen steckt —
ein Rest der urspruenglichen Ueberblendung. Solange beide ineinander
geblendet wurden, fiel er nicht auf; jetzt waere er ein Geist. Hoeher
frisst die Speichen.
