# VeloCity-Notebooks für den CRISP-DM-Block

Sechs Verfahren, jedes vollständig entlang der sechs CRISP-DM-Phasen — von der
Geschäftsfrage bis zur Auslieferung und zurück.

| | Notebook | Verfahren | Geschäftsfrage | Ausgang |
|---|---|---|---|---|
| 1 | `01_Regression_Fahrtdauer` | Regression | Was kostet mich diese Fahrt voraussichtlich? | **sichtbar** — die Anzeige ist freigeschaltet, für alle drei Radtypen |
| 2 | `02_Klassifikation_Wartungsrisiko` | Klassifikation | Welche 60 Räder prüfen wir nächstes Quartal? | Freigabe — **für die Faustregel, nicht für das Modell** |
| 3 | `03_Clustering_Stationen_und_Kunden` | Clustering + RFM | Welche Stationstypen und Kundensegmente gibt es? | für den Einsatz freigegeben, **analytisch nicht belegt** |
| 4 | `04_Zeitreihe_Nachfrageprognose` | Zeitreihe | Wie viele Räder braucht der Frühdienst morgen? | **Probebetrieb** — rechnet mit, entscheidet nicht |
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

### Lokal öffnen und ausführen

Das geht, und es soll gehen. Nur eines muss man wissen: **Ein Notebook trägt seine
Ausgaben in sich.** Genau deshalb ist auf GitHub jedes Ergebnis lesbar, ohne dass
jemand etwas startet — und genau deshalb schreibt jede ausgeführte Zelle in die
Datei. Git meldet sie danach als geändert.

Das ist kein Schaden, solange es nicht committet wird:

```bash
git restore analytics/notebooks/            # alle zurück auf den gebauten Stand
git restore analytics/notebooks/01_*.ipynb  # nur eines
```

Die Notebooks sind wiederherstellbar, weil sie **Bauprodukte** sind: Sie entstehen
aus `analytics/bau/` und lassen sich jederzeit neu erzeugen. Deshalb gilt

> **Zum Ausprobieren:** ausführen, ansehen, danach `git restore`.
> **Zum Ändern:** die Quelle unter `analytics/bau/` ändern und neu bauen —
> ein einzelnes Notebook braucht je nach Fall 7 bis 140 Sekunden.

`.ipynb_checkpoints/` — die Zwischenstände von PyCharm und Jupyter — sind
ignoriert und stören nicht.

**Warum nicht automatisch?** Ein Git-Filter könnte die flüchtigen Teile beim
Committen wegrechnen. Er müsste dafür aber mehr tun, als es zunächst aussieht:
Zwei Läufe verteilen dieselbe Ausgabe unterschiedlich auf Blöcke, und eine
pandas-Styler-Tabelle trägt je Lauf eine andere Zufallskennung. Ein Filter, der
bei jedem Commit in freigegebenes Lehrmaterial schreibt, ist das Risiko nicht
wert — `git restore` ist ein Befehl.

Damit ein versehentlich ausgeführtes Notebook nicht doch auf GitHub landet, prüft
`tools/notebooks_frisch_gebaut.py` die Ausführungszähler: Ein gebautes Notebook
zählt lückenlos von 1 hoch, ein von Hand gerechnetes nicht. Die Prüfung läuft in
`tools/abnahme.sh` mit.

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
