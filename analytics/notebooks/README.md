# VeloCity-Notebooks für den CRISP-DM-Block

Sechs Verfahren, jedes vollständig entlang der sechs CRISP-DM-Phasen — von der
Geschäftsfrage bis zur Auslieferung und zurück.

| | Notebook | Verfahren | Geschäftsfrage | Ausgang |
|---|---|---|---|---|
| 1 | `01_Regression_Fahrtdauer` | Regression | Was kostet mich diese Fahrt voraussichtlich? | Teilfreigabe (nur CITY) |
| 2 | `02_Klassifikation_Wartungsrisiko` | Klassifikation | Welche 60 Räder prüfen wir nächstes Quartal? | Freigabe — **für die Regel, nicht das Modell** |
| 3 | `03_Clustering_Stationen_und_Kunden` | Clustering + RFM | Welche Stationstypen und Kundensegmente gibt es? | Freigabe, mit zwei unbequemen Befunden |
| 4 | `04_Zeitreihe_Nachfrageprognose` | Zeitreihe | Wie viele Räder braucht der Frühdienst morgen? | Freigabe |
| 5 | `05_Assoziation_Wege_im_Netz` | Assoziationsanalyse | Zwischen welchen Stationen fließt es wann? | Freigabe |
| 6 | `06_Anomalieerkennung_Auffaellige_Vorgaenge` | Anomalieerkennung | Was soll sich der Betrieb heute früh ansehen? | Teilfreigabe — **eine Aufgabe scheitert begründet** |

## Zwei Fassungen je Notebook

| Ordner | Fassung | wofür |
|---|---|---|
| `notebooks/` | **Vorführfassung** | vollständig gerechnet, mit Ausgaben und Diagrammen. Läuft in Colab von oben nach unten durch |
| `notebooks/uebung/` | **Übungsfassung** | dieselben Texte, aber die zentralen Codestellen sind Lücken mit Aufgabenstellung |

Beide entstehen aus **einer** Quelle (`analytics/bau/`) — die Übungsfassung ist ein
Ableitungsprodukt, keine Kopie. Sie können nicht auseinanderlaufen.

Die Vorführfassung wird beim Bauen **ausgeführt**. Fällt eine Zelle um, bricht der Bau ab.
Was im Ordner liegt, ist damit nachweislich lauffähig.

## In Google Colab öffnen

Die Notebooks laden ihre Daten selbst von `raw.githubusercontent.com` — kein Upload, kein
Drive-Mount. Linkmuster:

```
https://colab.research.google.com/github/swrobuts/velocity-fallstudie/blob/main/analytics/notebooks/<Datei>.ipynb
```

In jedem Notebook steht oben ein Colab-Knopf mit genau diesem Link.

> **Voraussetzung:** Der Zweig muss nach `main` gemergt sein, sonst zeigen die
> `raw.githubusercontent.com/.../main/...`-Adressen ins Leere.

## Der rote Faden

Die sechs Notebooks bauen aufeinander auf, ohne voneinander abzuhängen — jedes lädt seine
Daten selbst. Was sich von Notebook zu Notebook ändert, ist die **Art der Frage**:

| | Zielgröße | Was das Verfahren liefert |
|---|---|---|
| 1 | eine Zahl | eine Vorhersage je Fahrt |
| 2 | eine Kategorie | eine Vorhersage je Rad |
| 3 | **keine** | eine Gruppe je Station bzw. je Kunde |
| 4 | eine Zahl in der Zeit | eine Vorhersage je Tag — und die Reihenfolge zählt |
| 5 | **keine** | Regeln über Zusammenhänge |
| 6 | **keine** | eine Rangfolge nach Ungewöhnlichkeit |

## Was in den Notebooks bewusst schiefgeht

Lehrbeispiele, in denen alles auf Anhieb funktioniert, erziehen zu falschen Erwartungen.
Diese hier enthalten ausdrücklich:

- **Notebook 1:** Das Modell besteht nur für einen von drei Radtypen — und der
  Schattenbetrieb ist schlechter als die Testmenge
- **Notebook 2:** Der Random Forest **verliert** gegen eine einzeilige Faustregel
- **Notebook 3:** Die Umsatzgröße war falsch definiert, und 29 % der Kundschaft fallen
  aus der Segmentierung heraus
- **Notebook 4:** Ein roher Mittelwertvergleich behauptet das Gegenteil des Richtigen
- **Notebook 5:** Die Regel mit dem höchsten Lift ist wertlos
- **Notebook 6:** Der erste Modellversuch findet die Preisklasse statt der Anomalien —
  und eine der beiden Aufgaben ist mit diesen Daten grundsätzlich nicht lösbar

## Notebooks neu bauen

```bash
cd analytics/bau && python3 bauen.py          # alle sechs
cd analytics/bau && python3 bauen.py nb03     # nur eines
```

Voraussetzung: `pandas`, `numpy`, `matplotlib`, `scikit-learn`, `scipy`, `nbformat`,
`nbclient`. Die Datenbasis muss in `analytics/` liegen (`python3 generieren.py`).
