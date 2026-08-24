# Bilder

## STAND 24.08.2026: NEUE VORLAGEN, WEISSER GRUND

Die drei Raeder stehen jetzt vor **weissem Grund** (`neu/`, 3840x2307,
PNG). Damit ist die Freistellung keine Schaetzung mehr, sondern eine
Rechnung: `python3 tools/raeder_weissgrund.py`.

Was weiter unten steht — die Betonwand, die zwei Hintergrundmodelle,
`tools/raeder_freistellen.py` — betrifft die frueheren Aufnahmen. Es
bleibt vorerst liegen, bis die neue Buehne steht.

**Der Weg heute**

1. Deckkraft aus dem Abstand zum weissen Grund. Der Grund wird am
   Bildrand gemessen, nicht angenommen.
2. Weisse Flaechen INNERHALB des Umrisses: nur der Schriftzug am Rahmen
   gehoert zum Rad. Erkannt daran, dass er rundum von Rot umgeben UND
   klein ist. Beide Bedingungen sind noetig - die Speichenzwickel sind
   klein, aber nicht rot; das Rahmendreieck ist rot, aber nicht klein.
   Jede Bedingung fuer sich hat einen sichtbaren Fehler erzeugt.
3. Saum entsaeumen, damit kein heller Rand bleibt.
4. Schatten zeichnen. Die Vorlagen bringen keinen Boden mit; der
   Schatten folgt dem Abstand des Rades zum Boden, Spalte fuer Spalte.
   Er steht IM BILD, nicht im Stylesheet - sonst liefe er beim
   Verschieben davon.
5. Alle drei gemeinsam beschneiden und auf 1618 Punkte verkleinern, mit
   vorgewichtetem Alpha. Der Ausschnitt steht in
   `buehne-ausschnitt.txt`, damit die Nachpruefung ihn nicht raten muss.

Die Vorlagen sind bereits aufeinander normiert - gleiche Bildgroesse,
gleiche Hoehe des Rades, gleiche Standlinie. Es wird deshalb NICHTS
verschoben und NICHTS skaliert.

Gespeichert wird verlustfrei; die drei Raeder wiegen zusammen rund
1,4 MB. Die Buehne selbst ist gezeichnet (siehe `.buehne-grund` im
Stylesheet), es gibt kein Hintergrundfoto mehr.

**Nachgerechnet** von `tools/freisteller_pruefen.py`: die Deckkraft wird
gegen die genauso beschnittene Vorlage gehalten, in beide Richtungen -
zu viel faengt weissen Grund im Laufrad, zu wenig faengt zerfallene
Speichen.

---

# Frueherer Stand: Aufnahmen vor einer Betonwand

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

1. stellt E-Bike und City-Bike mit ZWEI Hintergrundmodellen frei
   (siehe unten),
2. nimmt aus beiden Freistellern den Strich heraus, an dem Wand und
   Boden sich treffen: er ist Hintergrund, beruehrt aber beide Reifen
   und kaeme sonst als Flaeche mit,
3. passt das Lastenrad auf dieselbe Standlinie und dieselbe optische
   Mitte ein, auf 1360 Punkte Breite gebracht,
4. baut zuletzt die Wand — aus einem Streifen, den die Maske als
   radfrei ausweist, und zwar nur aus dessen KORN; die grossflaechige
   Helligkeit kommt aus dem Zeilenmittel der ganzen Aufnahme.

Die Reihenfolge ist Absicht: die Wand braucht die fertigen Masken, um
den radfreien Streifen zu finden.

**Warum kein Massstab ueber die Raeder.** Bis zum 24.08.2026 skalierte
das Skript das Lastenrad ueber den gemessenen Hinterraddurchmesser. Die
Messung griff sich in Wahrheit den STAENDER — er ist die tiefste Stelle
des Umrisses —, und die Raeder sind ohnehin nicht vergleichbar: das
Lastenrad faehrt vorn 20 Zoll, hinten 26, die anderen beiden 28.
Massstabsgetreu waere das Lastenrad ueber 2000 Punkte breit und liefe
aus dem Bild. Es steht deshalb auf 1360 Punkten, das 1,09-fache des
E-Bikes: sichtbar das laengste der drei, ohne angeschnitten zu sein.

**Warum nur das Korn gekachelt wird.** Ein gekachelter Streifen
wiederholt auch seine grossen Helligkeitsunterschiede, und die liest das
Auge als Muster — dieselbe helle Stelle alle paar hundert Punkte. Das
Korn wiederholt sich zwar ebenfalls, ist aber zu fein dafuer.

## Warum zwei Hintergrundmodelle

Bis zum 24.08.2026 stand hier ein einziges: der Median jeder Bildzeile,
mit der Schwelle `diff > 28`. Das Ergebnis sah aus der Entfernung
richtig aus und war es nicht — bei voller Groesse zerfielen die Speichen
in gestrichelte Linien, die Ritzel waren zerfressen, die Kette
zerstueckelt. Der Nutzer hat es an einem grossen Bildschirm gesehen.

Der Grund: die Wand ist auch INNERHALB einer Bildzeile nicht gleich
hell — die Ausleuchtung faellt zu den Raendern ab. Der Rest lag deshalb
im Mittel bei sieben Stufen und in der Spitze bei fuenfundzwanzig, und
darum musste die Schwelle so hoch liegen. Eine Speiche ist ein bis zwei
Punkte breit; unter dieser Schwelle blieb von ihr ein Strichmuster.

Jetzt rechnet das Skript mit zwei Modellen, weil das Rad vor zwei
verschiedenen Hintergruenden steht:

| Modell | wie | wofuer | Rest auf reinem Hintergrund |
|---|---|---|---|
| **weit** | je Zeile zwischen radfreien Punkten interpoliert | die glatte Wand aussen | 3 Stufen |
| **nah** | oertlicher Median ueber 41 Punkte | das gekoernte Pflaster im Radinneren | 2 Stufen auf der Wand, 10 auf dem Pflaster |

Daraus drei Zonen:

* **Kern** — `weit` ueber 34: sicher Rad, volle Deckkraft.
* **Rand** — drei Punkte darum: gemessen am KLEINEREN der beiden Reste.
  Ein echter Hintergrundpunkt ist in wenigstens einem Modell
  unauffaellig, ein Radpunkt in keinem. Ohne diese Regel blieben helle
  Wolken am Rahmen stehen — in radreichen Zeilen zieht das Rad das weite
  Modell zu sich.
* **Innen** — die eingeschlossenen Flaechen, also die Radinneren. Dort
  liegen dunkle Kiesel, die es auf hundert Stufen bringen; Helligkeit
  allein entscheidet hier nicht. Es entscheidet die FORM: eine Speiche
  ist lang, ein Kiesel ist rund. Was kuerzer als zwanzig Punkte ist,
  faellt weg.

Die Schwelle darf dadurch von 28 auf 10 sinken. Gemessen an den Punkten
der Aufnahme, die deutlich dunkler sind als ihre Umgebung — Speichen,
Kette, Ritzel —, deckt der Freisteller jetzt 98 Prozent statt 78.

**Verlustfrei gespeichert.** Bei WebP-Qualitaet 86 wich das Ergebnis in
deckenden Flaechen im Mittel um knapp vier Stufen von der Vorlage ab, in
der Spitze um zweiundvierzig. Das ist kaum zu sehen, aber es ist nicht
die Vorlage. Verlustfrei kosten die drei Raeder zusammen rund 1,3 MB
statt 470 KB. Die Wand bleibt JPEG — sie ist synthetisch, an ihr gibt es
kein Motiv, an dem man Kompression sehen koennte.

**Nachgerechnet** von `tools/freisteller_pruefen.py`, eingehaengt in
`tools/abnahme.sh`: deckende Punkte gleichen der Vorlage exakt, die
dunklen Stellen der Vorlage stehen zu mindestens 95 Prozent, und keine
Bildzeile spannt ueber 1500 Punkte.
