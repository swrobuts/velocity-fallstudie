# VeloCity-Notebooks für den CRISP-DM-Block

Sechs Verfahren, jedes vollständig entlang der sechs CRISP-DM-Phasen — von der
Geschäftsfrage bis zur Auslieferung und zurück.

| | Notebook | Verfahren | Geschäftsfrage | Ausgang |
|---|---|---|---|---|
| 1 | `01_Regression_Fahrtdauer` | Regression | Was kostet mich diese Fahrt voraussichtlich? | **sichtbar** — die Anzeige ist freigeschaltet, für alle drei Radtypen |
| 2 | `02_Klassifikation_Wartungsrisiko` | Klassifikation | Welche 60 Räder prüfen wir nächstes Quartal? | Freigabe — **für die Faustregel, nicht für das Modell** |
| 3 | `03_Clustering_Stationen_und_Kunden` | Clustering + RFM | Welche Stationstypen und Kundensegmente gibt es? | für den Einsatz freigegeben, **analytisch nicht belegt** |
| 4 | `04_Zeitreihe_Nachfrageprognose` | Zeitreihe | Wie viele Räder braucht der Frühdienst morgen? | **Schattenpilot** — rechnet mit, entscheidet nicht |
| 5 | `05_Assoziation_Wege_im_Netz` | Assoziationsanalyse | Zwischen welchen Stationen fließt es wann? | Produkt A **nicht freigegeben**, Produkt B nur analytisch |
| 6 | `06_Anomalieerkennung_Auffaellige_Vorgaenge` | Anomalieerkennung | Was soll sich der Betrieb heute früh ansehen? | Teilfreigabe — **eine Aufgabe scheitert begründet** |

> Die Spalte *Ausgang* nennt den Status, den das Notebook selbst stempelt. Sie wird
> von `tools/readme_pruefen.py` gegen die Merkzettel in `analytics/bau/werte/`
> gehalten — dieselbe Quelle, aus der die Notebooks ihre Zahlen beziehen. Eine
> Aussage hier kann also nicht vom Notebook abweichen, ohne dass die Abnahme rot
> wird.

## Was hier liegt

Sechs Notebooks, je eines pro Verfahren, **vollständig gerechnet**. Zahlen, Tabellen
und Diagramme stehen eingebettet darin: Auf GitHub ist jedes Ergebnis lesbar, ohne
eine einzige Zelle auszuführen.

Sie entstehen aus **einer** Quelle unter `analytics/bau/` und werden beim Bauen
ausgeführt. Fällt eine Zelle um, bricht der Bau ab — was hier liegt, ist damit
nachweislich lauffähig.

> **Die Notebooks sind Bauprodukte.** Wer eines in PyCharm oder Jupyter öffnet und
> ausführt, ändert Ausführungszähler und Ausgaben; Git meldet die Datei dann als
> geändert. Das ist normal und darf verworfen werden (`git checkout -- <Datei>`).
> Geändert wird die Quelle in `analytics/bau/`, nie das Notebook selbst.

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

- **Notebook 1:** Ob ein Merkmal erlaubt ist, entscheidet der Prozess und nicht der
  Spaltenname — ausgeliefert wird am Ende eine Tabelle, nicht das bessere Modell
- **Notebook 2:** Der Random Forest holt gegen eine einzeilige Faustregel **nichts
  heraus** — und sein scheinbarer Vorsprung in einer früheren Fassung war ein Fehler im
  Merkmal, gegen das er antrat
- **Notebook 3:** Knapp ein Drittel der Kundschaft fällt aus der Segmentierung heraus —
  RFM sieht nur, wer kauft
- **Notebook 4:** Ein roher Mittelwertvergleich behauptet das Gegenteil des Richtigen
- **Notebook 5:** Der Umverteilungsplan bewegt 4,0 Räder je Werktag bei Stationen für
  35 bis 65 — die Regeln taugen zur Deutung, nicht zur Steuerung
- **Notebook 6:** Der erste Modellversuch findet die Preisklasse statt der Anomalien —
  und bei beiden Aufgaben schlägt am Ende eine Zeile Fachwissen das Verfahren

## Notebooks neu bauen

```bash
cd analytics/bau && python3 bauen.py          # alle sechs
cd analytics/bau && python3 bauen.py nb03     # nur eines
```

Voraussetzung: `pandas`, `numpy`, `matplotlib`, `scikit-learn`, `scipy`, `nbformat`,
`nbclient`. Die Datenbasis muss in `analytics/` liegen (`python3 generieren.py`).
