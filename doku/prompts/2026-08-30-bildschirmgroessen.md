# Prompt: Oberfläche an Desktop, Foldable und Smartphone anpassen

Entstanden aus der Arbeit an `bikes.butscher.cloud` und `wawi.butscher.cloud`
im August 2026. Jede Regel unten steht dort, weil sie in diesem Projekt
gebraucht wurde — nicht, weil sie in einem Ratgeber steht.

Zum Weitergeben: alles ab „--- PROMPT ---" kopieren.

---

## --- PROMPT ---

Du passt die Oberfläche dieses Projekts an verschiedene Bildschirmgrößen an.
Halte dich an die folgende Arbeitsweise und die Grundsätze darunter.

### Arbeitsweise — zuerst, weil hier die meiste Zeit verlorengeht

1. **Miss, statt zu schließen.** Zu jeder Layout-Aussage nenne die Zahl, mit
   der du sie belegst. „Sieht gedrängt aus" ist keine Diagnose; „die Tabelle
   braucht 839 px, der Bereich hat 612" ist eine.

2. **Prüfe vor jeder Messung, ob die Vorschaufläche überhaupt sichtbar ist.**
   Eine versteckte oder eingeklappte Fläche meldet `window.innerWidth === 0`,
   und dann sind *sämtliche* Maße Unsinn — `getBoundingClientRect` liefert
   plausible, aber falsche Zahlen. Diese Falle kostet sonst mehrere Runden.

3. **Miss nicht während einer Überblendung.** Werte, die mitten in einem
   `transition` abgelesen werden, sind Zwischenstände. Warte länger als die
   Übergangsdauer, oder lies die CSS-Variable statt der Geometrie.

4. **`element.click()` reproduziert keine Druckfehler.** Es überspringt
   Treffertest und Zeigerphasen. Fehler beim Drücken, Halten oder Ziehen
   brauchen echte `pointerdown`/`pointermove`/`pointerup` — mit einer
   gültigen `pointerId`, sonst wirft `setPointerCapture` und der Handler
   bricht still ab.

5. **Prüfe an mehreren Breiten, nicht an einer.** Bestimme die Breite, ab der
   es bricht, und nenne sie. Eine Lösung, die bei 1440 px funktioniert, sagt
   nichts über 900 px.

6. **Screenshots vom echten Gerät schlagen jede eigene Messung.** Wenn dir
   jemand ein Bild zeigt, das deiner Messung widerspricht, hat das Bild
   recht. Suche den Grund, nicht die Bestätigung.

7. **Was du nicht messen kannst, erklärst du nicht für in Ordnung.** Sage
   stattdessen, was ungeprüft blieb.

### Grundsätze für alle Größen

- **Eine Quelle für jede Aufteilung.** Eine CSS-Variable, aus der beide
  Seiten ihren Anteil rechnen (`--anteil` → die eine bekommt `var(--anteil)`,
  die andere `calc(100% - var(--anteil))`). Zwei Zahlen, die sich zu 100 %
  ergänzen müssen, ergänzen sich irgendwann nicht mehr.

- **Sichtbar klein, greifbar groß.** Vergrößere die Trefferfläche über
  `::after { position: absolute; inset: -8px }`, nicht das Element. So bleibt
  das Bild ruhig und die Bedienung erreicht die 44 px aus WCAG 2.5.5
  (Mindestmaß 24 px nach 2.5.8).

- **`@media (hover: none)` für Touch-Anpassungen**, nicht die Breite als
  Stellvertreter. Ein Tablet am Schreibtisch ist breit *und* berührt.

- **Nichts, das man gedrückt hält, darf sich beim Drücken verschieben.**
  Ein `:active`-Versatz an einem Ziehgriff macht ihn unbedienbar: Der Zeiger
  verliert das Element unter sich, `mouseup` landet woanders, der Klick
  entsteht nie.

- **Rechne mit Spezifität.** `button:active:not(:disabled)` ist (0,2,1) und
  schlägt `.meine-klasse` (0,1,0). Wenn eine Regel „nicht wirkt", ist meist
  eine andere spezifischer — nicht die Eigenschaft falsch.

- **`transform` ist EINE Eigenschaft und nicht additiv.** `translate`,
  `rotate`, `scale` sind eigenständige Eigenschaften und überschreiben
  einander nicht. Für kleine Versätze `translate` nehmen.

- **Gemerkte Größen in Prozent, nicht in Pixeln.** 320 px sind am Notebook
  die halbe Fläche und am großen Monitor ein Streifen.

- **Tabellen fließen mit.** `width: 100%` mit automatischem Layout passt sich
  dem Behälter an und bricht Zellen um; die Untergrenze bestimmt der Inhalt.
  Wer bündige Kanten will, muss wissen, welche Spalte die Breite treibt.

- **Enge in dieser Reihenfolge auflösen:** erst Polster und Versalien
  zurücknehmen, dann Elemente stapeln (Knopf über Titel statt daneben),
  dann Spalten aufgeben — und erst zuletzt scrollen lassen.

- **SVG mit `preserveAspectRatio="none"` streckt alles, auch Text.**
  Beschriftungen als HTML-Schicht darüberlegen und in Prozent positionieren.
  Ohne diese Angabe passt der Browser den Inhalt mittig ein — die Grafik
  steht dann als schmaler Block in der Mitte, während die Achsen darunter
  schon die volle Breite nutzen.

### Desktop

- Zwei Spalten nebeneinander. Der Detailbereich **verschiebt** den Hauptteil,
  statt ihn zu verdecken: Eine Tabelle mit `width: 100%` fließt in ihre
  Spalte hinein; als Overlay lägen die rechten Spalten nicht enger, sondern
  unerreichbar dahinter. Ein verschobener Bereich ist unangenehm, ein
  verdeckter unbenutzbar.
- Ist die Rangfolge trotzdem unklar, erzähle sie über `z-index` und einen
  seitlich geworfenen Schatten — nicht über eine zweite Grundfarbe, wenn die
  Gestaltungsregel Datenflächen eine feste Farbe zuweist.
- Ziehgriff zwischen den Spalten: `role="separator"`, Pfeiltasten und `Home`,
  Doppelklick stellt die Vorgabe her, Grenzen bei 25 % und 75 %, damit sich
  kein Bereich wegziehen lässt. `touch-action: none` gegen Bildlauf.
- **Friere das Layout während des Ziehens ein.** Was stört, ist nicht die
  wandernde Kante, sondern dass die Tabelle daneben bei jedem Pixel ihre
  Spalten neu umbricht. Breiten beim `pointerdown` festnageln, beim
  Loslassen lösen — dann setzt sie sich genau einmal neu.
- Hier ist Platz für die volle Werkzeugleiste im Spaltenkopf (rechne mit
  rund 137 px je Spalte für Titel plus drei Knöpfe).

### Foldable (aufgeklappt: breit UND flach)

- **Die kritische Größe ist das Seitenverhältnis, nicht die Breite.** Ein
  aufgeklapptes Foldable ist breit genug für jede `max-width`-Abfrage und
  trotzdem zu flach für ein Layout, das Höhe braucht.
- Komma bedeutet ODER: `@media (max-width: 900px), (max-aspect-ratio: 1/1)`.
- Für „breit und flach" die Dreifachbedingung:
  `@media (max-width: 900px) and (max-height: 430px)`.
- **Auf- und Zuklappen ändert Breite und Höhe schlagartig, ohne Neuladen.**
  Alles, was du beim Laden einmal ausrechnest und merkst, ist danach falsch.
  Layout über CSS lösen, nicht über gespeicherte Maße.
- `aspect-ratio` überschreibt die Höhe einer Grid-Spur. Bei Bildern in
  Rastern ist das die häufigste Ursache dafür, dass eine Zeile nicht die
  Höhe annimmt, die man ihr zugewiesen hat.
- Höhe ist die knappe Größe: waagerechte Anordnungen bevorzugen, Kopfbereiche
  flach halten, Abstände nach oben eher kürzen als nach den Seiten.
- Prüfe **beide Zustände desselben Geräts**. Ein Foldable ist zwei Geräte.

### Smartphone

- `100svh` statt `100vh` — sonst schiebt die ein- und ausfahrende
  Browserleiste den Inhalt. Achtung: ein `min-height` an derselben Stelle
  hebelt `100svh` wieder aus.
- **Alles pro Zeile, ohne Einrückungen.** Kennzahlenreihen bekommen
  `padding-inline: 0` und `padding-block`; Trennung über
  `:nth-child(n+3)`-Linien statt Rahmen und Einzüge.
- Bilder mit `srcset`/`sizes` und einer **echten** kleinen Variante, nicht
  nur einer herunterskalierten großen. Beim Wechsel Zwischenspeicher über
  Inhalts-Fingerabdrücke im Dateinamen umgehen.
- Overlays auf Karten und Popovers sind der häufigste Mangel: Sie sind auf
  dem Desktop entworfen und auf dem Telefon unbedienbar. Mindestens 44 px,
  geprüft an einem kleinen Gerät (iPhone mini als Untergrenze).
- **Kein `title`-Attribut als Erklärung** — auf Touch nie erreichbar. Eigenes
  Hinweisfenster, das auch auf Tastaturfokus reagiert.
- Symbolknöpfe brauchen feste Maße, sonst wachsen sie mit der Schriftgröße
  ins Groteske.
- Den Blickfang nicht opfern, sondern umbauen: Raster statt Nebeneinander,
  Bild kleiner, Handlungsaufforderung höher — meist lässt sich beides retten.

### Abnahme

Prüfe am Ende mindestens diese Breiten und nenne für jede das Ergebnis:
**1920 · 1440 · 1180 (Foldable aufgeklappt) · 900 · 768 · 430 · 375**.
Dazu je einmal `(hover: none)`, ein flaches Seitenverhältnis und, wo es
Zustände gibt, beide (eingeklappt/ausgeklappt, Detail offen/zu).

Nenne zu jedem Punkt die gemessene Zahl. Sage ausdrücklich, was du nicht
prüfen konntest.

## --- ENDE PROMPT ---
