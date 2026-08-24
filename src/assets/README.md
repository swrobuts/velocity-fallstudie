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
