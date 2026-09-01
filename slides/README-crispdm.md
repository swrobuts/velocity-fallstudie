# Foliendeck — CRISP-DM an sechs Fallbeispielen

110 Folien im THWS-Design, gebaut aus demselben Master wie das Datenbankdeck
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
| 1 | Regression | alle sechs | Die gemittelte Kennzahl verdeckte ein bestehendes Drittel — 0,91 € gegen 0,464 € |
| 2 | Klassifikation | **Phase 6** | Bei Gleichstand gewinnt die einfachere Lösung: ausgeliefert wird die Regel |
| 3 | Clustering | **Phase 1** | Erfolgskriterien ohne Zielgröße — und eine bessere Frage als die, mit der wir anfingen |
| 4 | Zeitreihe | **Phase 3** | Der Schnitt folgt der Zeit. Und die genaueste Prognose ist nicht die günstigste |
| 5 | Assoziation | **Phase 5** | Von 42 Regeln überlebt eine — dank Hürden, die vorher standen |
| 6 | Anomalie | **der Rücksprung** | Kein Verfahren erzeugt Information, die in den Daten nicht steckt |

## Aufbau

| Teil | Kapitel | Folien | Inhalt |
|---|---|---|---|
| Rahmen | — | 3 | Titel · sechs Projekte, ein Vorgehen · Wegweiser |
| **A Die Karte** | 1 | 12 | Der Kreislauf kompakt: je eine Folie pro Phase, die Rücksprünge, die zwei häufigen Fehler |
| **B Referenzfall** | 2 | 27 | Notebook 1 Phase für Phase — 4 + 4 + 4 + 3 + 5 + 4, dazu Steckbrief und Kreisschluss |
| **C Fälle 2–6** | 3–7 | 51 | Gleiches Gerüst, Tiefe nur an der jeweiligen Kernstelle |
| **D Synthese** | 8 | 7 | Die sechs Fälle zurück auf der Karte, acht Sätze, Ausblick |

## Das Deck ist eine Lesehilfe, kein Text daneben

Drei Dinge stellen den Bezug zum Notebook her:

**1. Achtzehn echte Zellausschnitte.** Code und Ausgabe, im Notebook-Look, erzeugt von
`tools/notebook_ausschnitte.py`. Jeder trägt darunter ein Band, das sagt, worauf zu
achten ist — ohne diese eine Zeile wäre ein Screenshot nur Dekoration.

**2. Eine Quellenzeile auf jeder Folie, die auf Datei UND Abschnitt zeigt.**
`analytics/notebooks/01_Regression_Fahrtdauer.ipynb · Abschnitt 5.2` — damit endet das
Suchen. Eine Folie, die eine Zahl nennt, ohne zu sagen wo sie steht, schickt die
Studierenden auf die Suche.

**3. Vier Mermaid-Diagramme** unter `doku/analytics/diagramme/`, gerendert mit
`tools/render_diagrams.sh` im THWS-Farbschema:

| Datei | Zeigt |
|---|---|
| `crispdm-kreis` | Der Kreislauf mit den Rücksprüngen, die in den sechs Notebooks tatsächlich vorkommen |
| `crispdm-faelle` | Welcher Fall beleuchtet welche Phase — die Begründung des Deckaufbaus |
| `nb1-leakage` | Was weiß man wann? Der Leakage-Test als Zeitachse |
| `nb2-rueckkopplung` | Die Falle jeder vorausschauenden Wartung, samt Ausweg |

## Ausschnitte neu erzeugen

```bash
python3 tools/notebook_ausschnitte.py           # alle achtzehn
python3 tools/notebook_ausschnitte.py nb1-modelle
```

Die Zellen werden über einen **Suchtext** ausgewählt, nicht über ihre Nummer: Nummern
verschieben sich, sobald jemand eine Zelle einfügt, und dann zeigt die Folie klaglos die
falsche Stelle. Trifft ein Suchtext mehrere Zellen, bricht das Werkzeug ab — beim ersten
Lauf hat das zehn falsche Bilder verhindert.

Für Zellen mit langem Code steht im Katalog `"ausgabe"` als fünftes Feld: Dann zeigt die
Folie nur das Ergebnis. Sonst wird das Bild auf der Folie zu schmal, um lesbar zu sein —
gemessen, nicht geschätzt: unter etwa 470 pt Breite ist Quelltext im Hörsaal verloren.

**Der wiederkehrende Anker ist die Phasenleiste** am Fuß jeder Inhaltsfolie — dieselbe
Rolle, die im Datenbankdeck der rote Faden zu Annas Fahrt spielt. Sie macht die
Struktur sichtbar, ohne sie zu wiederholen. Ein sandfarbenes Feld mit rotem Rand
markiert eine Phase, auf die dieser Fall **zurückgesprungen** ist.

## Neu erzeugen

Das Deck wird **nicht von Hand bearbeitet**, sondern erzeugt. Wer eine Folie ändern
will, ändert `build_crispdm_deck.py` und baut neu.

```bash
python3 slides/build_crispdm_deck.py
python3 slides/check_deck.py slides/velocity-crispdm.pptx
```

Der Lauf muss `0 Befund(e)` melden. Geprüft werden Inhaltszone (y = 176 bis 494),
Mindestschriftgröße 13 pt, überlappende Formen, geschätzte Textüberläufe und fehlende
Vortragsnotizen. Alle 90 Folien tragen eine Vortragsnotiz.

## Zwei neue Motive in `thws.py`

- `phasenleiste(slide, aktuell, rueckspruenge=())` — sechs Felder, das laufende
  ausgefüllt. Belegt y = 454 bis 494; **Inhalt muss deshalb bei 454 enden.**
- `steckbrief(slide, zeilen)` — der Fall auf einen Blick, zweispaltig. Steht am Anfang
  jedes Fallkapitels, damit vor dem Durchlaufen klar ist, wohin die Reise geht.

Beide sind additiv; das Datenbankdeck baut unverändert mit 0 Befunden.

## Woher die Zahlen stammen

**Alle Zahlen sind den ausgeführten Notebooks entnommen, keine aus dem Gedächtnis.**
Die wichtigsten:

- Erlaubte Abweichung je Radtyp bei 50 Cent Preistoleranz: CITY 5,0 · EBIKE 2,0 ·
  CARGO 1,0 Minuten — der Grund, warum ein Modell zwei von drei Radtypen verfehlt
- Modellvergleich Fall 1: Nullmodell 11,58 · linear 5,93 · Baum 4,88 · Wald 4,58
  Minuten (60,4 % besser als das Nullmodell)
- Preisfehler: gemittelt 0,91 € · CITY 0,464 € · EBIKE 1,01 € · CARGO 3,09 €
- Schattenbetrieb: 0,493 € über die letzten 30 Tage, 1.229 Fahrten — Ampel GELB
- Fall 2: Regel und Random Forest je 70,0 % und je 10.890 €
- Fall 5: 42 Regeln, 10 mit Lift ≥ 1,3, 2 mit Support ≥ 1 %, 1 mit beidem
- Fall 6: Trefferquote 6 % → 40 % nach der Normierung; Aufgabe B scheitert bei 9,5 %

## Eine Regel für spätere Änderungen

**Ein großes Motiv je Folie, plus Phasenleiste.** Die Inhaltszone ist 176 bis 454 hoch,
also 278 pt. Wer zwei Motive stapelt, muss die Höhe des ersten ausrechnen — `tabelle`
ist `zeilen_h × (Zeilen + 1)`, `sandband` und `sandkarte` leiten ihre Höhe aus der
Textlänge ab. Beim Bau dieses Decks entstanden auf diesem Weg elf Überlappungen; alle
lagen in den Kapiteln, die vor dieser Regel geschrieben wurden.
