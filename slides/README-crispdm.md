> ## Stand 3. September 2026 — neu gebaut
>
> Die Fallkapitel (Teil B und C) sind vollständig neu und lesen ihre Zahlen aus
> `analytics/bau/werte/*.json` — derselben Quelle wie Handout und Use-Case-Decks.
> Ein unbekannter Schlüssel bricht den Bau ab, statt eine Lücke zu drucken.
> Die Teile A (Der Kreislauf) und D (Synthese) sind erhalten und in zwei Aussagen
> korrigiert.
>
> Aus 124 Folien wurden 56. Geprüft mit `slides/check_deck.py` (Raster, Überlauf)
> und `slides/check_deck_zahlen.py` (Zahlen gegen die Merkzettel).


# Foliendeck — CRISP-DM an sechs Fallbeispielen

120 Folien im THWS-Design, gebaut aus demselben Master wie das Datenbankdeck
(`assets/template.pptx`, Layouts Frontpage_Digital, Chapter, Slide).

## Die didaktische Entscheidung, die diesem Deck zugrunde liegt

Die Ausgangsfrage lautete: **sechsmal der volle Kreislauf, oder einmal generisch und
dann die Fälle einsortiert?**

Beides wäre falsch gewesen.

- *Sechsmal der volle Kreislauf* begräbt die sechs **unterschiedlichen** Lehren unter
  der immer gleichen Gliederung. Bei Fall drei schaltet der Saal ab — und ausgerechnet
  dann kommt der Fall, in dem die Analyse die Geschäftsfrage umwirft.
- *Einmal generisch, dann kurz einsortiert* lässt die Studierenden **nie ein Projekt
  von Anfang bis Ende** erleben. Genau das war aber das Ziel.

Ausschlaggebend war ein Befund aus den Notebooks selbst: **Jedes betont eine andere
Phase.** Das ist der Grund, warum sich die Fälle nicht gleich behandeln lassen.

| Fall | Verfahren | Zeigt | Der Satz, der bleibt |
|---|---|---|---|
| 1 | Regression | **alle sechs** | Ob ein Merkmal erlaubt ist, entscheidet der Prozess — nicht der Spaltenname |
| 2 | Klassifikation | **Phase 6** | Ein Modell kann gegen eine Baseline gewinnen, weil die Baseline schlecht gebaut ist |
| 3 | Clustering | **Phase 1** | Erfolgskriterien ohne Zielgröße — und eine bessere Frage als die, mit der wir anfingen |
| 4 | Zeitreihe | **Phase 3** | Der Schnitt folgt der Zeit. Und die genaueste Prognose ist nicht die günstigste |
| 5 | Assoziation | **Phase 5** | Keine Regel nimmt beide Hürden — und der Umverteilungsplan trägt 1,8 Räder je Werktag |
| 6 | Anomalie | **der Rücksprung** | Ein Verfahren, das schlechter ist als eine Zeile Fachwissen, ist an der Aufgabenstellung gescheitert |

Die Fälle 1, 2 und 5 sind bewusst als **Gegenstücke** aufgebaut: In Fall 1 hält eine
schlichte Nachschlagetabelle mit einer Quantilregression mit und wird ausgeliefert. In
Fall 2 holt der Random Forest gegen eine einzeilige Faustregel nichts heraus. In Fall 5
nimmt am Ende keiner der Kandidaten die Hürde. Dreimal dieselbe Frage — *lohnt sich das
Verfahren?* — und dreimal fällt sie gegen das aufwendigere Verfahren aus, weil dreimal
vorher ein Maßstab gebaut wurde.

## Aufbau

| Teil | Kapitel | Folien | Inhalt |
|---|---|---|---|
| Rahmen | — | 3 | Titel · sechs Projekte, ein Vorgehen · Wegweiser |
| **A Die Karte** | 1 | 12 | Der Kreislauf kompakt: je eine Folie pro Phase, die Rücksprünge, die zwei häufigen Fehler |
| **B Referenzfall** | 2 | 40 | Notebook 1 Phase für Phase, mit dem Einwand am Anfang und den offenen Punkten am Ende |
| **C Fälle 2–6** | 3–7 | 51 | Gleiches Gerüst, Tiefe nur an der jeweiligen Kernstelle |
| **D Synthese** | 8 | 6 | Die sechs Fälle zurück auf der Karte, fünf Gemeinsamkeiten, Ausblick |

Der Referenzfall ist mit einem Drittel des Decks der längste Teil. Das ist Absicht: Er
ist der einzige Ort, an dem ein Projekt vollständig durchlaufen wird, und alle folgenden
Kapitel setzen ihn voraus.

## Das Deck ist eine Lesehilfe, kein Text daneben

Vier Dinge stellen den Bezug zum Notebook her:

**1. Vierundzwanzig echte Zellausschnitte.** Code und Ausgabe, im Notebook-Look, erzeugt
von `tools/notebook_ausschnitte.py`. Jeder trägt darunter ein Band, das sagt, worauf zu
achten ist — ohne diese eine Zeile wäre ein Screenshot nur Dekoration.

**2. Eine Quellenzeile auf jeder Fallfolie, die auf Datei UND Abschnitt zeigt.**
`analytics/notebooks/01_Regression_Fahrtdauer.ipynb · Abschnitt 5.2` — damit endet das
Suchen.

Diese Zeile entsteht **von selbst**: `folie()` liest die Phase aus dem Kicker und das
Notebook aus dem laufenden Kapitel. Von Hand gepflegt blieb sie unvollständig — beim
ersten Durchlauf trugen 24 von 120 Folien eine Quelle, jetzt sind es 91 (alle außer
Kapitel- und Kartenfolien, die sich auf kein einzelnes Notebook beziehen).

**3. Fünf Mermaid-Diagramme** unter `doku/analytics/diagramme/`, gerendert mit
`tools/render_diagrams.sh` im THWS-Farbschema:

| Datei | Zeigt |
|---|---|
| `crispdm-kreis` | Der Kreislauf mit den Rücksprüngen, die in den sechs Notebooks tatsächlich vorkommen |
| `crispdm-faelle` | Welcher Fall beleuchtet welche Phase — die Begründung des Deckaufbaus |
| `nb1-leakage` | Was weiß man wann? Der Leakage-Test als Zeitachse — mit der Zielstation auf der erlaubten Seite und dem Vorbehalt daneben |
| `nb1-artefakt` | Wie aus 60.425 Rohzeilen 136 Tabellenzeilen werden: drei Filter, drei Wege ins Schweigen |
| `nb2-rueckkopplung` | Die Falle jeder vorausschauenden Wartung, samt Ausweg |

Achtung beim Bearbeiten der `.mmd`-Dateien: **eine Kommentarzeile, die nur `%%` enthält,
verschluckt den Zeilenumbruch** und der Parser bricht mit einer irreführenden Meldung ab.
Jede Kommentarzeile braucht Inhalt.

**4. Die Phasenleiste** am Fuß jeder Inhaltsfolie — dieselbe Rolle, die im Datenbankdeck
der rote Faden zu Annas Fahrt spielt. Ein sandfarbenes Feld mit rotem Rand markiert eine
Phase, auf die dieser Fall **zurückgesprungen** ist.

## Zwei Prüfläufe, und beide müssen `0 Befund(e)` melden

```bash
python3 slides/build_crispdm_deck.py
python3 slides/check_deck.py slides/velocity-crispdm.pptx
python3 tools/folienzahlen_pruefen.py
```

**`check_deck.py` prüft die Form:** Inhaltszone (y = 176 bis 494), Mindestschriftgröße
13 pt, überlappende Formen, geschätzte Textüberläufe, fehlende Vortragsnotizen. Alle 120
Folien tragen eine Vortragsnotiz.

**`folienzahlen_pruefen.py` prüft den Inhalt:** Jede Zahl einer Folie muss in dem
Notebook stehen, das die Folie in der Fußzeile nennt — in dessen Ausgaben oder
Fließtext, nicht im Quelltext.

Dieses zweite Werkzeug ist aus Schaden entstanden. Nachdem der Lehrdatensatz neu erzeugt
worden war (die Stationen wurden an die Datenbank angeglichen), änderten sich Zahlen in
vier Notebooks; die Folien behielten die alten. Gefunden wurden unter anderem: ein
Prognosefehler von 12,65 statt 12,50, ein Störgrößenfaktor 0,74 statt 0,75, ein Aufschlag
von 14 statt 16 Prozent und ein Anteil frei abgestellter Fahrten von 23 statt 19,8
Prozent. Von Hand fällt so etwas bei 120 Folien und sechs Notebooks nicht auf.

Zwei Feinheiten, die das Werkzeug erst brauchbar machten:

- Es sucht **nicht im Quelltext**. Dort stehen Zahlen ohne inhaltliche Bedeutung —
  `figsize=(9.5, 5.5)` deckte eine falsche Trefferquote von 9,5 % zu.
- Angaben **mit Einheit** werden samt Einheit geprüft. „14" steht in jedem Notebook
  irgendwo; „14 %" als Trefferquote nur, wenn es stimmt. Prozentwerte gelten auch als
  Bruchteil geschrieben als gefunden, weil die Notebooks teils `36.0%`, teils `0.360`
  drucken.

Was es **nicht** findet: eine Zahl aus dem falschen Zusammenhang und jede falsche
Behauptung ohne Zahl. Dafür gibt es keinen Ersatz fürs Lesen.

## Ausschnitte neu erzeugen

```bash
python3 tools/notebook_ausschnitte.py
```

Die Zellen werden über einen **Suchtext** ausgewählt, nicht über ihre Nummer: Nummern
verschieben sich, sobald jemand eine Zelle einfügt, und dann zeigt die Folie klaglos die
falsche Stelle. Trifft ein Suchtext mehrere Zellen, bricht das Werkzeug ab.

**Der Suchtext muss auf eine Beschriftung zeigen, nicht auf einen Datenwert.** Drei
Anker lauteten früher `"56.9       0.659"` oder `"50573       85.0    CARGO"` — sie
zerbrachen beim ersten neuen Lehrdatensatz. Jetzt zeigen sie auf gedruckte Literale wie
`"Basisrate  = Anteil aller Fahrten"`, die eine Datenänderung überleben.

Der HTML-Zwischenspeicher hängt am **Änderungsdatum des Notebooks**. Ohne das hat er nach
einem Umbau klaglos die alte Fassung weiterverwendet.

Für Zellen mit langem Code steht im Katalog `"ausgabe"` als fünftes Feld: Dann zeigt die
Folie nur das Ergebnis. Sonst wird das Bild auf der Folie zu schmal, um lesbar zu sein —
gemessen, nicht geschätzt: unter etwa 470 pt Breite ist Quelltext im Hörsaal verloren.

## Neu erzeugen

Das Deck wird **nicht von Hand bearbeitet**, sondern erzeugt. Wer eine Folie ändern
will, ändert `build_crispdm_deck.py` und baut neu.

## Zwei Motive in `thws.py`

- `phasenleiste(slide, aktuell, rueckspruenge=())` — sechs Felder, das laufende
  ausgefüllt. Belegt y = 454 bis 494; **Inhalt muss deshalb bei 454 enden.**
- `steckbrief(slide, zeilen)` — der Fall auf einen Blick, zweispaltig. Steht am Anfang
  jedes Fallkapitels, damit vor dem Durchlaufen klar ist, wohin die Reise geht.

Beide sind additiv; das Datenbankdeck baut unverändert mit 0 Befunden.

## Woher die Zahlen stammen

**Alle Zahlen im Deck sind den ausgeführten Notebooks entnommen, keine aus dem
Gedächtnis.** Drei Werkzeuge halten das nach:

| Werkzeug | prüft |
|---|---|
| `tools/folienzahlen_pruefen.py` | jede Zahl auf einer Folie gegen das Notebook, das die Folie zitiert |
| `slides/check_deck_zahlen.py` | elf handgeprüfte Aussagen des Decks gegen die Merkzettel |
| `tools/readme_pruefen.py` | die Statusangaben in `analytics/notebooks/README.md` |

Alle drei laufen in `tools/abnahme.sh` mit.

**Hier stehen bewusst keine Zahlen mehr.** Bis zum 04.09.2026 führte dieser
Abschnitt fünfzehn Kennzahlen auf — und praktisch jede war überholt, weil die
Notebooks seither mehrfach neu gerechnet wurden: der Preisfehler für City stand
mit 0,41 € statt 0,24 €, die Ablation mit neun statt 12,9 Prozent, und für Fall 5
stand hier noch, **keine** Regel nehme die Support-Hürde, während die stärkste
sie inzwischen deutlich überspringt. Eine zweite Liste neben den geprüften
Quellen kann nur auseinanderlaufen; die Zahlen stehen dort, wo sie gemessen
werden:

- **im Notebook selbst** — `analytics/notebooks/<Fall>.ipynb`, mit der Ausgabe
  daneben, aus der sie stammt
- **im Merkzettel** — `analytics/bau/werte/<Fall>.json`, maschinenlesbar
- **im Handout** — `doku/analytics/Handout_Die_sechs_Modelle.md`, aus genau
  diesen Merkzetteln erzeugt

## Eine Regel für spätere Änderungen

**Ein großes Motiv je Folie, plus Phasenleiste.** Die Inhaltszone ist 176 bis 454 hoch,
also 278 pt. Wer zwei Motive stapelt, muss die Höhe des ersten **ausrechnen**, nicht
schätzen. Dafür stehen im Bauskript drei Helfer bereit:

```python
sandband(s, "…", y=darunter(y, h_tabelle(4, 40)))
sandkarte(s, "…", [...], y=darunter(y, h_gestapelt(3, 48, 8)))
```

`h_tabelle(zeilen, zeilen_h)` rechnet Kopfzeile plus Datenzeilen, `h_gestapelt(n, hoehe,
luecke)` gilt für `streifen`, `schichtenstapel` und `ampel_matrix`, `darunter(y, hoehe)`
setzt den Abstand. Beim Umbau von Fall 1 standen dort geschätzte Zahlen — der Deckprüfer
meldete elf Überlappungen, denn eine Tabelle mit fünf Zeilen ist 40 pt höher als eine mit
vier.
