# Neuausrichtung Notebook 1 — von der Startstation zur geplanten Verbindung

Grundlage: Review „Review_Neuausrichtung_Regression_Fahrtdauer.md" (01.09.2026)
und der Einwand des Auftraggebers:

> Warum soll ein Modell etwas vorhersagen, was der User besser weiß? Sinnvoll
> ist es erst, wenn der User in der App das Ziel anwählt und die Regression
> eine Abschätzung aufgrund historischer Verbindungen abgibt.

Beides trifft zu. Dieser Plan hält fest, was daraus folgt — und was vor dem
Umbau **gemessen** wurde, damit wir nicht eine Annahme durch die nächste
ersetzen.

---

## 0. Was vor dem Umbau gemessen wurde

Der Review sagt in 5.2, die Start-Ziel-Beziehung *dürfte* einen großen Teil
der Varianz erklären. Nachgerechnet auf `ausleihe.csv`, 60.122 Fahrten im
Modellbereich (1 Minute bis 8 Stunden):

| Messung | Wert |
|---|---|
| Fahrten **ohne** Zielstation (frei abgestellt) | 13.489 = **22,4 %** |
| Fahrten mit Zielstation | 46.633 |
| davon **Rundtouren** (Start = Ziel) | 10.432 = **22,4 %** |
| verschiedene Verbindungen | 100, im Median 388 Fahrten je Verbindung |
| Nullmodell (Median gesamt) | MAE 10,50 Min |
| Baseline C — Median je **Startstation** | MAE 6,84 Min |
| Baseline D — Median je **Verbindung** | MAE 6,62 Min · R² 0,482 |
| **Zugewinn allein durch das Ziel** | **0,22 Min ≈ 3 %** |
| Rundtouren: Median / Streuung (IQR) | 20,0 Min / **28,0 Min** |
| echte Wege: Median / Streuung (IQR) | 11,0 Min / 14,0 Min |

**Drei Folgerungen:**

1. **Der Geltungsbereich schrumpft.** Für 22,4 % aller Fahrten gibt es kein
   Ziel — sie enden frei im Geschäftsgebiet. Das ist keine Datenlücke,
   sondern ein Produktmerkmal (die Website wirbt damit). Die neue
   Geschäftsfrage gilt also ausdrücklich nur für Fahrten von Station zu
   Station.

2. **Das Ziel bringt weniger, als der Review vermutet** — 3 % gegenüber der
   Startstation allein. Das ist ein Ergebnis, kein Mangel: Es zwingt zu der
   Frage, ob ein Merkmal seine Komplexität verdient. Genau die Frage, die
   Notebook 2 an anderer Stelle stellt.

3. **Der Grund steht in derselben Tabelle.** Rundtouren sind 22,4 % der
   angedockten Fahrten und streuen doppelt so stark wie echte Wege. Bei
   ihnen trägt das Ziel per Definition null Information — A nach A sagt
   nichts über die Dauer.

**Wichtig für die Formulierung:** Gemessen wurde der Beitrag des Ziels in
einer reinen Nachschlagetabelle. In einem vollen Modell kann das Ziel mit
Uhrzeit und Wetter zusammenwirken. Die Zahl ist ein starkes Signal, kein
Beweis — die endgültige Antwort liefert erst Schritt 10 unten.

---

## 1. Warum die Umstellung trotzdem richtig ist

Nicht wegen der Modellgüte, sondern wegen der **Nützlichkeit**:

- Heute sagt das Modell eine Dauer voraus, die der Nutzer besser kennt. Es
  konkurriert mit dem Nutzer statt ihm zu helfen.
- Nach der Umstellung sagt es etwas, das der Nutzer *nicht* weiß: wie lange
  **diese Verbindung** unter **diesen Umständen** erfahrungsgemäß dauert.
- Die Zielstation wird damit zu einem zulässigen Merkmal. Und das ist die
  stärkste didaktische Botschaft des ganzen Umbaus:

  > Ob ein Merkmal Leakage ist, entscheidet nicht sein Name, sondern der
  > Zeitpunkt, zu dem es im **Prozess** verfügbar ist. Ändert man den
  > Prozess, ändert sich die Antwort.

  Das ist besser als die bisherige Lektion, weil es zeigt, dass Phase 1 und
  Phase 3 zusammenhängen.

---

## 2. Reihenfolge der Umsetzung

Nummern in Klammern verweisen auf die Abschnitte des Reviews.

### Stufe A — Die Frage neu stellen (vor jeder Modellierung)

- [ ] **A1** Geschäftsfrage umstellen auf die geplante Start-Ziel-Fahrt (14.1)
- [ ] **A2** Zielauswahl als Schritt des App-Prozesses beschreiben (14.2)
- [ ] **A3** Geltungsbereich festschreiben: nur Fahrten mit Zielstation
      (77,6 %), frei abgestellte Fahrten sind ein eigener Geschäftsfall
      — **Ergänzung zum Review, folgt aus der Messung oben**
- [ ] **A4** Die 8-Stunden-Grenze fachlich als Business-Scope begründen (6.8)
- [ ] **A5** Rundtouren ausdrücklich behandeln: eigener Fall oder eigenes
      Merkmal `ist_rundtour` — **Ergänzung, folgt aus IQR 28 gegen 14**

### Stufe B — Sauberes Evaluationsdesign (bevor Zahlen entstehen)

- [ ] **B1** Zeitlichen finalen Holdout einführen, vollständig unangetastet (14.4)
- [ ] **B2** Testmenge nicht mehr zur Modellauswahl verwenden — Validierung
      innerhalb der Vergangenheit (14.5, 6.3)
- [ ] **B3** Den bisherigen „Schattenbetrieb" ersetzen: er war kein echter
      Out-of-Sample-Test, weil der zufällige Schnitt Teile der letzten 30
      Tage ins Training gelegt hat (6.1)
- [ ] **B4** Preisfehler über die **vollständige** Tariffunktion rechnen,
      einschließlich Startgebühr und Tageshöchstpreis (14.6, 6.4)
- [ ] **B5** Nullmodell auf den **Median** umstellen — für MAE ist der Median
      die optimale konstante Vorhersage, nicht der Mittelwert (6.5)

### Stufe C — Merkmale und Modelle

- [ ] **C1** Zielstation als Merkmal aufnehmen (14.3)
- [ ] **C2** Route als Kombination Start→Ziel (8)
- [ ] **C3** Streckenmerkmale, die verallgemeinern: Luftlinie, Höhendifferenz
      — nötig, damit eine neue Station nicht ins Leere läuft (8)
- [ ] **C4** Baselines A bis D, besonders **D: Median je Verbindung** (10)
- [ ] **C5** `OneHotEncoder(drop="first")` gegen die perfekte Kollinearität
      im linearen Modell (6.6)
- [ ] **C6** Zyklische Zeitmerkmale prüfen (sin/cos für Stunde) (6.7, 14.11)

### Stufe D — Auslieferung, die ihre Regeln erzwingt

- [ ] **D1** Freigabe technisch erzwingen: nicht freigegebener Radtyp →
      Ausnahme statt stiller Vorhersage (14.7, 6.11)
- [ ] **D2** Vollständige sklearn-Pipeline mit
      `OneHotEncoder(handle_unknown="ignore")` (14.8, 6.12)
- [ ] **D3** Unbekannte Station: ausdrücklich verweigern und auf eine
      Baseline zurückfallen (6.12)
- [ ] **D4** Monitoring auf Route, Radtyp und Preisfehler ausrichten (14.14)

### Stufe E — Textkorrekturen im bisherigen Notebook

- [ ] **E1** Filteranteil: aus 60.170 werden 58.517, das sind **2,75 %**,
      nicht rund 5 % (6.9)
- [ ] **E2** Freigabe-Widerspruch auflösen: Evaluation und Paket geben nur
      CITY frei, an anderer Stelle steht CITY und EBIKE (6.10)
- [ ] **E3** Aussage zu EBIKE/CARGO vorsichtiger fassen: Das Scheitern liegt
      überwiegend an der strengeren wirtschaftlichen Fehlertoleranz, nicht
      an schlechterer Modellgüte (6.13)
- [ ] **E4** Quantile sind weiterhin Regression — Formulierung korrigieren (6.14)

### Stufe F — Folgearbeiten außerhalb des Notebooks

- [ ] **F1** Foliendeck: Fall 1 neu schreiben. Betroffen sind Steckbrief,
      Phase 1 (vier Folien), Phase 3 (Leakage!), Phase 5 und Phase 6 sowie
      die Zellausschnitte `nb1-*`
- [ ] **F2** `nb1-leakage.mmd` umbauen: Die Zielstation wandert von „verboten"
      nach „erlaubt", sobald der Prozess die Auswahl vorsieht. Das Diagramm
      wird damit erst richtig lehrreich
- [ ] **F3** Website: „Preis berechnen" um eine Zielauswahl erweitern —
      **offen, ob gewünscht.** Der Knopf existiert bereits in
      `src/script.js`
- [ ] **F4** Notebooks 2 bis 6 auf dieselben methodischen Punkte prüfen:
      B1, B2, B5 und D1 betreffen sie ebenso

---

## 3. Was ich zuerst machen würde

**Stufe A und B vor Stufe C.** Der Review sagt es selbst: Die wichtigste
Verbesserung ist nicht ein anderer Algorithmus, sondern eine andere Frage.
Wer zuerst die Zielstation einbaut und dann das Evaluationsdesign repariert,
misst den neuen Effekt mit dem alten, zu optimistischen Maßstab.

Konkret: A1 bis A5, dann B1 bis B5 — erst danach entsteht die erste neue
Zahl. Sie wird niedriger sein als die heutigen 0,464 €, weil der Holdout
ehrlicher misst. Das ist gewollt.

---

## 4. Ergebnisse des Prototyps (01.09.2026)

Der neue Aufbau wurde vollständig durchgerechnet, bevor das Notebook
geschrieben wird. Datenstand `analytics/*.csv`, zeitlicher Schnitt
70 / 15 / 15.

| Menge | Fahrten | Zeitraum |
|---|---|---|
| Training | 32.643 | 01.09.2023 – 26.09.2025 |
| Validierung | 6.995 | 26.09.2025 – 22.05.2026 |
| **Holdout, unberührt** | 6.995 | 22.05.2026 – 24.08.2026 |

### Baselines (Validierung)

| | MAE |
|---|---|
| A Median aller Fahrten | 9,18 Min |
| B Median je Radtyp | 9,17 Min — **bringt nichts** |
| C Median je Startstation | 6,06 Min |
| D Median je Verbindung | 5,83 Min |

Das Ziel bringt gegenüber der Startstation **0,23 Minuten**. Der Review
hatte hier den großen Sprung erwartet.

### Modelle (Validierung) — die Wahl fällt hier, nicht auf dem Holdout

| | MAE | MedAE |
|---|---|---|
| Nullmodell (Median) | 9,18 | 6,00 |
| Lineare Regression | 5,59 | 3,59 |
| Entscheidungsbaum (T = 10) | 5,24 | 2,85 |
| **Random Forest (200)** | **4,67** | **2,44** |

### Finaler Holdout — einmal, nach der Wahl

| | |
|---|---|
| Random Forest | **MAE 5,93 Min** |
| dieselbe Menge, Baseline D | MAE 7,36 Min |

Der Holdout ist **27 % schlechter** als die Validierung. Genau das ist der
Unterschied, den der alte zufällige Schnitt verdeckt hat. Das Modell
schlägt die Verbindungs-Baseline aber deutlich (−19 %) — es verdient
seinen Unterhalt.

### Preisfehler mit der VOLLEN Tariflogik

Startgebühr + Minutenpreis, gedeckelt auf den Tageshöchstpreis, je Fahrt
für Ist und Prognose getrennt gerechnet.

| Radtyp | n | Preisfehler | unter 0,50 € | Urteil |
|---|---|---|---|---|
| CITY | 3.776 | 0,614 € | 62,9 % | fällt durch |
| EBIKE | 2.562 | 1,285 € | 42,3 % | fällt durch |
| CARGO | 657 | 3,907 € | 18,7 % | fällt durch |

**Alle drei fallen durch.** Das alte Notebook meldete für CITY 0,464 € —
diese Zahl war ein Artefakt des zufälligen Schnitts und der vereinfachten
Preisformel.

### Fehleranalyse: woran es liegt

| | n | MAE | Preisfehler |
|---|---|---|---|
| Rundtour (Start = Ziel) | 1.613 | 10,93 Min | 2,159 € |
| echter Weg | 5.382 | 4,43 Min | 0,872 € |

### Rücksprung nach Phase 1: Rundtouren als eigener Geschäftsfall

| Radtyp | n | Preisfehler | unter 0,50 € | Urteil |
|---|---|---|---|---|
| **CITY** | 2.930 | **0,454 €** | 70,3 % | **besteht** |
| EBIKE | 1.946 | 0,978 € | 48,2 % | fällt durch |
| CARGO | 506 | 2,884 € | 21,5 % | fällt durch |

Nebenprobe: Das Modell **nur** auf echten Wegen zu trainieren ändert
nichts (MAE 4,43 gegen 4,43). Die Rundtouren vergiften das Training also
nicht — sie sind schlicht nicht vorhersagbar.

### Zweite Rücksprungoption: Spanne statt Punkt

80-%-Intervall über Quantilregression: Abdeckung **81,6 %**, mittlere
Breite **14,6 Minuten**. Ehrlich, aber breit — als zweite Ausbaustufe
vermerkt, nicht als erste Lösung.

### Was das Notebook am Ende sagen wird

1. Die neue Frage macht die Zielstation zulässig — Leakage hängt am
   Prozess, nicht am Spaltennamen.
2. Ehrlich gemessen besteht **zunächst kein einziger Radtyp**.
3. Die Fehleranalyse zeigt den Grund: Rundtouren.
4. Nach einem begründeten Rücksprung besteht **CITY knapp** (0,454 €
   gegen 0,50 €) — für echte Wege, ohne Rundtouren.
5. Ausgeliefert wird genau das, und nur das: CITY, echte Wege, technisch
   erzwungen.
