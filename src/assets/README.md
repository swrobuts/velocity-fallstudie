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
| `velocity-bike-hero.png` | Ausgangsaufnahme E-Bike (vom Nutzer) — wird nicht mehr ausgeliefert |
| `velocity-bike-city-hero.png` | Ausgangsaufnahme City-Bike (vom Nutzer) — wird nicht mehr ausgeliefert |
| `velocity-wand.jpg` | Die Buehne ohne Rad. Aus einem radfreien Streifen der E-Bike-Aufnahme (x 62–239) gespiegelt gekachelt, der Poller vor der Wand ueberdeckt. |
| `rad-ebike-frei.webp` | E-Bike freigestellt, mit Alphakanal |
| `rad-city-frei.webp` | City-Bike freigestellt, mit Alphakanal |
| `velocity-bike-cargo-hero.jpg` | Lastenrad auf derselben Wand, nach rechts gesetzt |

**Warum freigestellt?** Der Wechsel im Kopfbereich blendete bis zum
25.08.2026 zwei vollstaendige Fotos ineinander. Zwei verschiedene
Raeder ergeben dabei immer eine Doppelbelichtung. Jetzt liegt die Wand
als eigene Ebene darunter und die Raeder wechseln den Platz statt der
Deckkraft — sie beruehren einander nie.

**Wie freigestellt?** Ueber den zeilenweisen Median der Aufnahme: die
Wand ist in jeder Bildzeile nahezu gleichmaessig, das Rad weicht davon
ab. Speichen, Reifen und Schatten bleiben erhalten. Der Weg ist in der
Sitzung vom 25.08.2026 dokumentiert und laesst sich aus den
Ausgangsaufnahmen jederzeit wiederholen.
