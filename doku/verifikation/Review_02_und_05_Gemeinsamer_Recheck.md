# Akribischer Recheck der Notebooks 02 und 05

**Prüfdatum:** 02.09.2026  
**Geprüfte Dateien:**

- `02_Klassifikation_Wartungsrisiko.ipynb`
- `05_Assoziation_Wege_im_Netz.ipynb`

## Kurzurteil

Beide Notebooks sind technisch reproduzierbar, vollständig ausgeführt und auf GitHub bytegleich veröffentlicht. Methodisch wurden gegenüber den früher geprüften Fassungen wichtige Probleme behoben. **In der vorliegenden Fassung ist jedoch keines der beiden Notebooks endgültig freigabefähig.**

| Notebook | Technischer Stand | Analytischer Kern | Aktuelle Freigabe |
|---|---:|---:|---|
| 02 – Wartungsrisiko | sehr gut | gut bis sehr gut | **noch nicht freigeben** |
| 05 – Wege im Netz | sehr gut | gut, wenn als explorative Flussanalyse gelesen | **noch nicht freigeben** |

Die entscheidenden Gründe sind unterschiedlich:

1. **Notebook 02:** Die Freigabelogik bewertet die Regel im historischen Test mit 88,3 %, ignoriert aber, dass sie über die fünf davorliegenden Validierungsquartale nur **169 von 300 Treffern = 56,3 %** erreicht. Damit trägt die eigene 70-%-Hürde nicht stabil. Zusätzlich werden Ausmusterungen im Vorhersagefenster weiterhin wie vollständig beobachtete Negativfälle behandelt.
2. **Notebook 05:** Der Rechenkern liefert inzwischen plausible aktuelle Ergebnisse, aber große Teile der Interpretation und des Schlusskapitels enthalten Zahlen aus einem älteren Datenstand. Außerdem wird die zeitliche Bestätigung nicht mit allen drei vorab formulierten Erfolgskriterien durchgeführt.

Für eine **reale betriebliche Freigabe** sind beide Notebooks ohnehin nicht geeignet: Die Daten sind synthetisch, und zentrale Kosten-, Wirkungs- und Live-Bestandsgrößen fehlen. Das wird in beiden Notebooks erfreulich offen benannt.

## 1. Prüfverfahren und Reproduzierbarkeit

Die Prüfung umfasste:

- vollständige Neuausführung beider Notebooks ohne gesetzte Sondervariable `VELO_BASIS`;
- Vergleich der neu berechneten mit den im Notebook gespeicherten Ausgaben;
- Prüfung der Daten- und Zeitlogik, der Zielgrößen, der Baselines, der Freigabegates und der erzeugten Artefakte;
- unabhängige Gegenrechnungen zu zeitlicher Validierung, Wilson-Intervallen, Ausmusterung, Support-Nennern und zeitlicher Regelbestätigung;
- Vergleich der lokalen Dateien mit den veröffentlichten GitHub-Fassungen.

| Prüfung | Notebook 02 | Notebook 05 |
|---|---:|---:|
| Codezellen | 19 | 12 |
| frisch fehlerfrei ausgeführt | 19 von 19 | 12 von 12 |
| gespeicherte Fehlerausgaben | 0 | 0 |
| frische Ausgaben identisch zu den gespeicherten | ja | ja |
| lokales Notebook bytegleich mit GitHub `main` | ja | ja |
| versionierter Standard-Datenstand | Commit `07d1b5d…` | Commit `07d1b5d…` |

SHA-256 der geprüften Dateien:

- Notebook 02: `296ccd0abebbf521231a148a50871d4a3407198dc72116026f9a8040ec5dfb55`
- Notebook 05: `a9e487895a84c4a194fdb27e56846e5d2638f5cb8a42e194b2ff3ba61fa632d5`

Veröffentlichte Fassungen:

- [Notebook 02 auf GitHub](https://github.com/swrobuts/velocity-fallstudie/blob/main/analytics/notebooks/02_Klassifikation_Wartungsrisiko.ipynb)
- [Notebook 05 auf GitHub](https://github.com/swrobuts/velocity-fallstudie/blob/main/analytics/notebooks/05_Assoziation_Wege_im_Netz.ipynb)

## 2. Notebook 02 – Klassifikation des Wartungsrisikos

### 2.1 Was inzwischen überzeugend gelöst ist

Die neue Fassung hat mehrere frühere Kernmängel tatsächlich behoben:

- Der Datenpfad zeigt auf einen unveränderlichen Commit und funktioniert ohne lokale Hilfsvariable.
- Die Generatorlogik wurde korrigiert: Der synthetische Verschleißzustand wird nun erst beim Abschluss der Reparatur reduziert und nicht bereits bei der Schadensmeldung.
- Das Feature `km_seit_reparatur` verwendet erledigte Wartungsaufträge; offene Schäden werden aus der Vorsorgepopulation entfernt.
- Der Unterschied zwischen Reset bei Meldung und Reset bei Reparatur wird als echte Ablation auf demselben Datenstand geprüft. Das Ergebnis wird ehrlich berichtet: **53 gegen 53 Treffer**, also kein messbarer Gütegewinn in diesem Testquartal.
- Der zeitliche Schnitt ist grundsätzlich sauber. Merkmale liegen links vom Stichtag, das 90-Tage-Label rechts davon. An keinem der acht Stichtage kreuzt eine abgeschlossene Fahrt den Cutoff.
- Es gibt mehrere sachkundige Baselines. Besonders wichtig ist die starke fachliche Regel „Kilometer seit letzter erledigter Reparatur“.
- Die Evaluation ist auf die feste Werkstattkapazität ausgerichtet und vergleicht `Precision@60`, Abdeckung und Szenariokosten.
- Das Wilson-Intervall wird korrekt gerechnet und `K1b` ist nun tatsächlich in die Pflichtgates aufgenommen.
- Historische Testliste und aktuelle Schattenliste sind sauber getrennt und eindeutig beschriftet.
- Die Schattenliste steht auf dem letzten Datentag, enthält einen Gültigkeitszeitraum und ist ausdrücklich als nicht handlungsleitend gekennzeichnet.
- Das Notebook unterscheidet überzeugend zwischen Rangscore und kalibrierter Wahrscheinlichkeit und exportiert den nicht freigegebenen Forest-Score nicht in die Werkstattliste.

Das ist ein großer Fortschritt. Besonders positiv ist, dass das Notebook mehrere frühere eigene Erklärungen nicht nur ersetzt, sondern durch Gegenproben widerlegt. Diese wissenschaftliche Selbstkorrektur ist didaktisch stark.

### 2.2 P0 – Die Freigaberegel widerspricht der eigenen zeitlichen Evidenz

Die vorab formulierte fachliche Hürde lautet: Mindestens 70 % der 60 ausgewählten Räder sollen im Folgequartal auffällig werden. Im letzten historischen Test erreicht die Regel:

- 53 Treffer von 60,
- 88,3 % beobachtete Treffsicherheit,
- Wilson-Intervall 77,8 % bis 94,2 %.

Isoliert betrachtet ist die Hürde dort gestützt. Die fünf vorhergehenden Validierungsquartale zeigen jedoch:

| Stichtag | Treffer der Regel | Precision@60 |
|---|---:|---:|
| 02.03.2025 | 38 | 63,3 % |
| 31.05.2025 | 41 | 68,3 % |
| 29.08.2025 | 39 | 65,0 % |
| 27.11.2025 | 24 | 40,0 % |
| 25.02.2026 | 27 | 45,0 % |
| **Summe** | **169 von 300** | **56,3 %** |

Eine unabhängige Wilson-Rechnung für 169 von 300 ergibt ungefähr **50,7 % bis 61,8 %**. Selbst wenn man die Abhängigkeit wiederholt beobachteter Räder dabei zunächst ignoriert, liegt das gesamte Intervall klar unter 70 %. Kein einziges der fünf Validierungsquartale erreicht die geforderten 42 Treffer.

Der Code umgeht diesen Widerspruch, indem `K3` für die Regel hart auf `True` gesetzt wird:

```python
k3 = True if "Faustregel" in name else vorteil_roll > 0
```

Damit bedeutet „stabil“ für den Forest „über mehrere Quartale besser als die Regel“, für die Regel selbst aber lediglich „sie ist der Maßstab“. Das ist kein symmetrisches Freigabekriterium und prüft nicht, ob die Regel ihre absolute 70-%-Hürde stabil erreicht.

**Folge:** Die Ausgabe „AUSGELIEFERT WIRD“ ist auf Basis der eigenen Evidenz zu stark. Methodisch korrekt wäre derzeit:

> Die Regel ist der beste historische Kandidat, aber ihre absolute Güte ist nicht stabil genug für eine Freigabe. Sie geht ausschließlich in den prospektiven Schattenbetrieb.

**Abhilfe:**

1. Vor der nächsten Auswertung ein kandidatenunabhängiges Stabilitätsgate definieren, zum Beispiel einen Mindestanteil bestandener Quartale oder eine blockweise Unsicherheitsgrenze über Quartale.
2. Dieses Gate identisch auf Regel und Modell anwenden.
3. Den historischen letzten Stichtag nur als Entwicklungs-/Bestätigungsperiode bezeichnen, da seine Ergebnisse bereits in früheren Überarbeitungen betrachtet wurden.
4. Die Freigabe erst nach Ablauf und Auswertung des prospektiven Schattenfensters erwägen.

### 2.3 P0 – Der `KEINE_FREIGABE`-Pfad ist noch nicht ausführbar

Die Gate-Zelle behandelt jetzt korrekt den Fall, dass kein Kandidat alle Hürden erfüllt:

```python
ausgeliefertes_verfahren = None
ausgelieferter_score = None
```

Die nachfolgenden Zellen verwenden `ausgelieferter_score` trotzdem bedingungslos für Kapazitätskurve, Liste und Export. Eine unabhängige Ausführung des relevanten Pfads endet mit:

```text
TypeError: bad operand type for unary -: 'NoneType'
```

Damit ist der behauptete kontrollierte Nichtfreigabefall noch nicht umgesetzt. Das Notebook läuft nur deshalb durch, weil die aktuelle Regel alle im Code verdrahteten Gates besteht.

**Abhilfe:** Deployment und Kapazitätsanalyse in eine Funktion kapseln und nur bei `not KEINE_FREIGABE` aufrufen. Für beide Zweige ist ein Test erforderlich:

- Kandidat besteht: Artefakte werden erzeugt und stimmen mit dem gewählten Verfahren überein.
- Kein Kandidat besteht: keine Liste, kein Modellpaket, klarer Statusbericht, kein Fehler.

### 2.4 P1 – Ausmusterung im Prognosefenster erzeugt Zensierung

Die Population enthält Räder, die am Stichtag aktiv sind. Ein Rad kann jedoch während der folgenden 90 Tage ausgemustert werden. Danach hat es keine vollständige Gelegenheit mehr, eine Schadensmeldung zu erzeugen. Solche Fälle werden derzeit trotzdem als normale Negativfälle behandelt.

Unabhängig nachgerechnet:

| Größe | Anzahl |
|---|---:|
| Panelzeilen mit Ausmusterung innerhalb des 90-Tage-Horizonts | 107 |
| davon derzeit als negativ gelabelt | 85 |
| im historischen Test betroffen | 27 von 230 |
| davon im Test als negativ gelabelt | 17 |
| betroffene Räder unter den Top 60 der Regel | 10 |

Das ist keine Randerscheinung. Die vermeintlich hohe Testtreffsicherheit kann dadurch beeinflusst werden, dass ein Teil der Vergleichspopulation vor Ende des Beobachtungsfensters verschwindet.

**Abhilfe:** Mindestens eine Sensitivitätsanalyse rechnen, die alle während des Horizonts ausgemusterten Räder entfernt. Methodisch sauberer wären ein fest definiertes Vollbeobachtungskriterium oder ein Survival-/Competing-Risk-Ansatz, in dem Schadensmeldung und Ausmusterung getrennte Ereignisse sind.

### 2.5 P1 – Training, Validation, Test und Schattenbetrieb klarer benennen

Die technische Aufteilung ist grundsätzlich vernünftig:

- sieben historische Stichtage für das finale Training,
- fünf davon zusätzlich in einer rollierenden Entwicklungsauswertung,
- letzter historischer Stichtag als Holdout,
- letzter Datentag als prospektive Schattenliste.

Die Begriffe sind aber noch zu stark. Der letzte historische Holdout ist **kein unangetasteter Test mehr**, weil seine Resultate bereits in früheren Versionen gesehen wurden und danach Daten- und Featurelogik verändert wurden. Das Notebook sagt dies an einer Stelle korrekt, verwendet an anderen Stellen aber weiterhin „Test“ und leitet daraus eine Auslieferung ab.

Empfohlene Terminologie:

- `Entwicklung/rollierende Validierung` für die fünf Quartale,
- `historische Bestätigungsperiode` statt unangetasteter Test,
- `prospektive Schattenperiode` für die Liste vom 24.08.2026 bis 22.11.2026,
- `Freigabetest` erst für eine vorher eingefrorene Definition und vollständig zukünftige Daten.

### 2.6 Weitere methodische Restpunkte

- **Zielgröße:** Vorhergesagt wird irgendeine Schadensmeldung. Leicht, mittel und fahruntauglich werden in der Kostenmatrix gleich behandelt. Das Notebook legt diese Einschränkung offen; für eine reale Anwendung sollte das Ziel auf vermeidbare, sicherheits- oder kostenrelevante Schäden fokussiert werden.
- **Wirkung der Maßnahme:** Ein Treffer wird implizit wie ein vollständig verhinderter Ausfall behandelt. Die tatsächliche Erkennungs- und Verhinderungsquote einer Vorsorgeprüfung fehlt.
- **Kosten:** Die Kostenrechnung ist bei gleicher Listenlänge als Szenariovergleich brauchbar. Zur Optimierung der Kapazität ist sie ungeeignet, weil Prüf- und Reparaturkosten wahrer Treffer fehlen. Das Notebook erkennt diesen Punkt korrekt.
- **Klassengewicht:** Das Verhältnis 7,2 wird gesetzt, aber nicht gegen `Precision@60` validiert. Bei einer festen Top-60-Liste ist das Gewicht keine direkte Umsetzung der Kostenmatrix. Auch dies wird inzwischen offen erklärt.
- **Preprocessing:** Für den Random Forest wird kein vollständiger, ausführbarer Feature-/Preprocessing-Pipelinebaustein exportiert. Das ist vertretbar, weil der Forest nicht freigegeben wird. Für einen späteren Modelleinsatz wäre ein einziges versioniertes Pipelineartefakt erforderlich.
- **Unbekannte Kategorien:** Ein neuer Radtyp kann bei der Distanzschätzung `NaN` erzeugen und dadurch ein Rad unbemerkt nach unten sortieren. Monitoring allein genügt nicht; die Produktivlogik sollte bei unbekannten Typen hart abbrechen oder eine explizite Fallbackregel verwenden.
- **Generatorzeitpunkt:** Der Generator setzt den Verschleiß auf Tagesebene am Datum des Reparaturabschlusses zurück, während das Notebook mit dem exakten Zeitstempel arbeitet. Für die Lehrgeschichte ist der frühere Hauptwiderspruch behoben; für vollständige Exaktheit sollte auch der Generator denselben Zeitbegriff verwenden.

### 2.7 Sprachliche und inhaltliche Konsistenz

Die Sprache ist überwiegend sehr gut: verständlich, kritisch, anschaulich und didaktisch klar. Mehrere aktuelle Texte widersprechen jedoch weiterhin dem Rechenkern:

- „Die Entscheidung unten folgt K1a“ – der Code verwendet jetzt ausdrücklich **K1a und K1b** als Pflichtgates.
- „Der Wald reißt das dritte Kriterium“ – er reißt aktuell **K1b und K3**.
- „Die Regel kostet eine Zeile SQL“ – wenige Absätze später wird zu Recht erklärt, dass die Merkmalslogik aus mehreren Datenquellen, Ausschlüssen und Stichtagsregeln besteht.
- „Sie trifft genauso gut“ passt weder zum historischen Test (53 gegen 44) noch exakt zur Validierung (169 gegen 165); korrekt ist: Sie ist im betrachteten Vergleich mindestens nicht schlechter und wesentlich einfacher zu betreiben.
- Im Schlusskapitel steht „mehr als das Fünffache“, die aktuelle Panelspanne beträgt 14,4 % bis 49,6 %, also etwa das **3,4-Fache**.
- „knapp vorn (53 gegen 44)“ ist sprachlich nicht passend; neun Treffer bei 60 Plätzen sind 15 Prozentpunkte.
- „über fünf Validierungsquartale deutlich (169 gegen 165)“ ist ebenfalls zu stark; vier Treffer auf 300 Entscheidungen sind ein kleiner Unterschied.
- „Beide Verfahren belegen die 70-%-Hürde“ widerspricht direkt der korrekten Wilson-Ausgabe: Nur die Regel belegt sie im historischen Test; beim Forest ist das Ergebnis unentschieden.
- Die Histogrammüberschrift spricht weiterhin von „drei Jahren“, obwohl die Daten ungefähr fünf Jahre umfassen.

Diese Stellen sollten nicht nur redaktionell korrigiert, sondern aus berechneten Variablen erzeugt oder mit Assertions abgesichert werden.

### 2.8 Güteeinschätzung Notebook 02

| Dimension | Bewertung |
|---|---:|
| Geschäftsfrage und Entscheidungsnähe | 9/10 |
| technische Reproduzierbarkeit | 10/10 |
| Leakage- und Stichtagslogik | 8,5/10 |
| Baselines und kapazitätsnahe Evaluation | 9/10 |
| zeitliche Validierung | 7/10 |
| Freigabe- und Deploymentlogik | 6/10 |
| sprachliche Qualität | 8/10 |
| **Gesamtstand der konkreten Fassung** | **8/10** |

**Urteil:** Als analytischer Lehrprototyp stark. Als endgültige Lehr-/Abgabeversion erst nach Korrektur des Stabilitätsgates, des Nichtfreigabepfads und der Schlussaussagen. Für reale Werkstattsteuerung nicht freigeben; sachgerechter nächster Schritt ist der bereits angelegte, aber noch nicht ausgewertete prospektive Schattenbetrieb.

## 3. Notebook 05 – Assoziation und Wege im Netz

### 3.1 Ist die Forschungsfrage sinnvoll?

**Ja, mit einer wichtigen Präzisierung.** Die Frage

> Zwischen welchen Stationen gibt es systematische gerichtete Ströme, und wann?

ist als **deskriptive Forschungsfrage** sinnvoll. Sie eignet sich, um auffällige Start-Ziel-Beziehungen unter vergleichbaren Zeitkontexten zu finden. Sie beantwortet dagegen nicht unmittelbar:

- wohin ein Transporter heute fahren soll,
- wie viele Räder bewegt werden müssen,
- ob eine Station voll oder leer ist,
- ob eine Fahrt wirtschaftlich sinnvoll ist.

Das Notebook erkennt diese Grenze inzwischen ausdrücklich und verweigert eine Betriebsfreigabe. Das ist fachlich richtig.

Methodisch handelt es sich weniger um klassische Warenkorbanalyse als um eine **gerichtete, kontextbedingte Kontingenzanalyse von Start und Ziel**. Jede Fahrt enthält genau einen Start und genau ein Ziel. Eine normalisierte Start-Ziel-Tabelle könnte deshalb dieselben Konfidenzen und Liftwerte liefern. Die Assoziationssprache ist für eine Lehrreihe zulässig, sollte aber nicht den Eindruck erwecken, hier würden komplexe Mehrfach-Itemsets entdeckt.

### 3.2 Was inzwischen überzeugend gelöst ist

- Das Notebook läuft mit dem versionierten Standarddatenstand vollständig durch.
- Freie Abstellung wird korrekt als reales Ziel und nicht als fehlender Wert behandelt.
- Rundtouren werden ausdrücklich ausgeschlossen, weil sie kein Rad zwischen Stationen verschieben.
- Der Lift verwendet die Basisrate des Ziels im selben Tagesart-/Zeitfensterkontext. Damit wird der allgemeine Kontexteffekt nicht fälschlich als Verbindungsstärke ausgegeben.
- Klassischer und kontextbedingter Lift stehen transparent nebeneinander.
- Die Kriterien werden auf ungerundeten Werten geprüft.
- Die Bonferroni-Familie umfasst alle 800 durchsuchten Kombinationen und nicht nur die 43 Regeln, die den Supportfilter überlebt haben.
- Die Abhängigkeit wiederholter Fahrten derselben Personen und Tage wird ausdrücklich als Einschränkung des Fisher-Tests benannt.
- Entdeckung und zeitlich spätere Bestätigung sind getrennt.
- Die Pendlergeschichte wird mit Kundennummer und Tagesbindung gegengeprüft, statt aus einer Regel kausal abgeleitet zu werden.
- Stationsumverteilung und Einsammeln frei abgestellter Räder werden getrennt gerechnet.
- Hotspots werden über die Endkoordinaten und nicht über die Startstation verortet.
- Exportdateien tragen Zeitraum, Einheit, Herkunft und den expliziten Status „explorativ – nicht freigegeben“.
- Datenschutz und Zweckbindung der personenbezogenen Gegenprobe werden angemessen problematisiert.

Der analytische Kern ist damit wesentlich reifer als in den früheren Fassungen.

### 3.3 P0 – Große Teile des Deployment- und Schlusskapitels sind zahlenmäßig veraltet

Die frisch ausgeführten Codezellen liefern folgende aktuelle Werte:

| Größe | aktuelle Rechnung | noch im Text |
|---|---:|---:|
| größter mittlerer Stationsüberschuss | **+4,02** | +1,75 |
| größter mittlerer Stationsfehlbestand | **−2,55** | −1,15 |
| theoretisches Ungleichgewicht, Ausgleich nach jedem Fenster | **25,70** | 19,8 |
| Ungleichgewicht am Tagesende | **17,28** | 11,1 |
| Hubland früh, Mittel | **+4,02** | +1,63 |
| Hubland früh, Spanne | **−1 bis +24** | −3 bis +14 |
| frei endende Fahrtereignisse je Werktag | **8,87** | 10,7 |
| verschiedene Räder je Werktag | **8,87** | 10,3 |
| Tage mit Mehrfachzählung desselben Rades | **0** | Text behauptet, manche Räder kämen mehrfach vor |
| Distanz zur nächsten Station, Median/P90 | **0,33 / 0,50 km** | 0,30 / 0,58 km |
| Distanz zur Startstation, Median/P90 | **1,12 / 2,30 km** | 1,27 / 3,03 km |
| nächste Station ungleich Startstation | **90,6 %** | 87,1 % beziehungsweise 91 % |
| aktuelle Hotspot-Spitzen | **Dom, Hauptbahnhof, Grombühl** | Residenz, Universität, Hauptbahnhof |
| Personen mit beiden Richtungen irgendwann | **68** | Schlusskapitel: 49 |
| Hin- und Rückfahrt am selben Tag | **1** | Schlusskapitel: keine |
| zeitlich bestätigte Regeln mit Lift ≥ 1,3 | **9 von 11** | Schlusskapitel: 8 von 9 |
| Regeln mit Lift ≥ 1,3 in der Vollstichprobe | **13** | Deutungstext: neun |

Diese Abweichungen betreffen nicht Nebenbemerkungen, sondern den gesamten Deutungsteil der Phase 6 und die abschließenden Merksätze. Dadurch liest der Betrachter andere Resultate, als der Code tatsächlich berechnet.

**Abhilfe:** Sämtliche Zahlen in Zelle 30 und im Schlusskapitel aus den aktuellen Ergebnissen neu erzeugen. Wo viele Werte wiederholt werden, sollten Tabellen oder programmgenerierte Textbausteine statt manuell eingetragener Zahlen verwendet werden. Eine Abschlussprüfung sollte jede hervorgehobene Zahl gegen `_MERKZETTEL` oder die jeweilige Ergebnistabelle prüfen.

### 3.4 P1 – Die zeitliche Bestätigung prüft nicht die vollständigen Erfolgskriterien

Auf der vollständigen Stichprobe bestehen zwei Regeln alle drei Kriterien:

1. Werktag früh: Juliuspromenade → Grombühl Klinikum, Support 1,3238 %, Lift 1,7746.
2. Werktag früh: Grombühl Klinikum → Hauptbahnhof, Support 1,1760 %, Lift 1,5459.

Die spätere Bestätigungszelle wählt jedoch im Entdeckungszeitraum Regeln mit:

```text
Support ≥ 0,5 % und Lift ≥ 1,3
```

Sie prüft anschließend im Bestätigungszeitraum im Wesentlichen nur, ob der Lift weiterhin mindestens 1,3 beziehungsweise größer als 1 ist. Das eigentliche K1 aus Phase 1, **Support ≥ 1 %**, wird nicht als Bestätigungsgate angewandt; K3 wird ebenfalls nicht explizit in die Bestätigungsentscheidung aufgenommen.

Für die zwei Vollstichproben-Kandidaten ergibt die unabhängige Gegenrechnung im späteren Zeitraum:

| Regel | Support bestätigt | Lift bestätigt | Ergebnis gegen K1/K2 |
|---|---:|---:|---|
| Grombühl Klinikum → Hauptbahnhof | 1,1307 % | 1,4830 | besteht |
| Juliuspromenade → Grombühl Klinikum | **0,9934 %** | 1,5084 | verfehlt K1 knapp |

Damit sind nicht beide Vollstichproben-Regeln in der späteren Periode nach denselben Regeln bestätigt.

**Abhilfe:** Die Auswahl ausschließlich im Entdeckungszeitraum mit den vorab festgelegten Kriterien K1, K2 und K3 durchführen. Genau diese eingefrorenen Regeln danach im Bestätigungszeitraum erneut gegen K1, K2 und K3 prüfen. Ergebnisse der Gesamtstichprobe dürfen anschließend deskriptiv gezeigt, aber nicht mehr zur Kandidatenauswahl verwendet werden.

### 3.5 P1 – Der Support-Nenner ist falsch beschriftet

Das Notebook spricht von „mindestens 1 % aller Fahrten“ und beschriftet die Grafik mit „Support (% aller Fahrten)“. Tatsächlich verwendet `regeln_finden` als Nenner:

```python
n = len(koerbe)
```

`koerbe` enthält 93.370 abgeschlossene Fahrten **nach Ausschluss der Rundtouren**. Der Ausgangsdatensatz umfasst 104.401 abgeschlossene Fahrten. Der Support ist somit ein Anteil an allen für die Regelsuche zugelassenen Nicht-Rundtouren, nicht an allen Fahrten.

Bei den zwei aktuellen Kandidaten ändert der korrekte Gesamtnenner das Bestehen zwar nicht, die Definition muss aber eindeutig sein. Entweder:

- K1 und Achsenbeschriftung in „Anteil aller für die Regelsuche zugelassenen Fahrten“ ändern, oder
- Support konsequent durch alle 104.401 abgeschlossenen Fahrten teilen.

Die Wahl muss vor der nächsten Messung feststehen.

### 3.6 P1 – Die Erklärung der Support-Lift-Punktwolke ist methodisch zu pauschal

Der Text erklärt die fallende Punktwolke mit:

> Je spezieller eine Regel, desto kleiner ihr Support – das gilt immer.

Die Monotonie stimmt bei einer echten Erweiterung desselben Itemsets: Fügt man einer bestehenden Bedingung ein weiteres Merkmal hinzu, kann der Support nicht steigen. Die dargestellten Regeln sind aber strukturell gleich spezifisch: Tagesart, Zeitfenster und Start sagen jeweils genau ein Ziel voraus. Ihre verschiedenen Supportwerte entstehen primär aus unterschiedlichen Start-Ziel-Häufigkeiten, nicht aus unterschiedlicher Regelkomplexität.

**Abhilfe:** Den allgemeinen Apriori-Satz beibehalten, aber nicht als Erklärung dieser konkreten Punktwolke verwenden. Für die Grafik genügt: Seltene Start-Ziel-Kombinationen liegen links; bei kleinen Zählwerten streuen Liftwerte stärker.

### 3.7 P1 – Die personenbezogene Gegenprobe wird zu weit verallgemeinert

Die Gegenprobe untersucht die konkrete Relation Hauptbahnhof → Hubland am Morgen und Hubland → Hauptbahnhof am Abend. Die zwei Regeln, die alle drei Kriterien erfüllen, betreffen jedoch Juliuspromenade, Grombühl und Hauptbahnhof. Aus einem einzelnen anderen Verbindungspaar kann die allgemeine Pendlerinterpretation nicht abschließend widerlegt werden.

Außerdem folgt aus „1 von 410 am selben Tag“ ohne definiertes Nullmodell nicht, dass dieser eine Fall „Zufall“ ist. Zulässig ist die engere Aussage:

> Für das geprüfte Paar gibt es keinen Beleg dafür, dass ein nennenswerter Teil der Abendfahrten Rückfahrten derselben morgendlichen Personen ist.

Wenn die Personenbindung wirklich Forschungsgegenstand sein soll, braucht jede ausgewählte Relation dieselbe vorab definierte Gegenprobe oder ein eigenes Modell für wiederholte Wege je Person und Tag.

### 3.8 Weitere methodische Restpunkte

- **Abhängige Beobachtungen:** Fisher behandelt Fahrten als unabhängig. Wiederholte Personen und gemeinsame Tage verletzen diese Annahme. Ein Blockbootstrap über Tage oder Personen beziehungsweise ein gemischtes Modell wäre geeigneter.
- **Nur ein Zeitschnitt:** Die Zwei-Drittel-/Ein-Drittel-Trennung ist ein guter Anfang, aber nur eine Realisierung. Rollierende, saisonal vergleichbare Fenster wären belastbarer.
- **Zeitfenster:** Die vier Fenster sind fachlich plausibel, aber gesetzt. Eine Sensitivitätsanalyse sollte zeigen, ob die Kernregeln bei leicht verschobenen Grenzen bestehen.
- **K1-Skala:** Das Notebook erkennt korrekt, dass 1 % Gesamt-Support nicht aus den Kosten einer Transporterfahrt hergeleitet ist. Die nächste Runde muss K1 vorab in Fahrten je Betriebstag und auf Basis realer Kosten formulieren.
- **Operative Relevanz:** Bestände, Stationskapazitäten, Eingriffszeitpunkt, Fahrzeugkapazität und Kosten fehlen. Deshalb ist die Entscheidung „keine Betriebsfreigabe“ richtig.
- **Hotspots:** Die Zuordnung zur nächsten Station ist als räumliche Verdichtung brauchbar. Sie ist keine Abholroute; dafür müssen die tatsächlichen Endkoordinaten und Live-Positionen verwendet werden.

### 3.9 Sprachliche und inhaltliche Qualität

Die Grundsprache ist lebendig, kritisch und überwiegend sehr verständlich. Die vielen Hinweise auf frühere Fehler sind lehrreich, stellenweise aber so dominant, dass die aktuelle Analyse in den Hintergrund tritt. Nach der inhaltlichen Stabilisierung kann der Text gekürzt werden.

Konkrete Korrekturen:

- „1 Fälle“ muss „1 Fall“ heißen.
- „über drei Jahre“ muss zum aktuellen Zeitraum von ungefähr fünf Jahren passen.
- „8 von 9 Regeln“ muss anhand der aktuellen Definition auf 9 von 11 beziehungsweise 11 von 11 geändert und präzise benannt werden.
- „49 Personen … an keinem einzigen gemeinsamen Tag“ muss auf 68 Personen und einen Fall am selben Tag korrigiert werden.
- Im letzten Abschnitt steht die Wortfolge „die Die“.
- „Vier Zeitfenster statt 24 Stunden, sonst wäre jede Regel unbelegt“ ist zu absolut; die Belege würden dünner, aber nicht zwingend für jede Regel unbrauchbar.

### 3.10 Güteeinschätzung Notebook 05

| Dimension | Bewertung |
|---|---:|
| Sinn der deskriptiven Forschungsfrage | 8,5/10 |
| technische Reproduzierbarkeit | 10/10 |
| Kennzahlen und Kontext-Lift | 8,5/10 |
| zeitliche und statistische Absicherung | 7/10 |
| operative Abgrenzung | 9/10 |
| Konsistenz von Code, Ausgaben und Text | 4/10 |
| sprachliche Qualität | 6,5/10 |
| **Gesamtstand der konkreten Fassung** | **6,5/10** |

**Urteil:** Der analytische Rechenkern ist gut und die Forschungsfrage als explorative, gerichtete Flussanalyse sinnvoll. Die konkrete Datei ist wegen der zahlreichen veralteten Kernaussagen noch nicht als Lehr-/Abgabefassung freigabefähig. Eine operative Freigabe wird zu Recht verweigert.

## 4. Priorisierte gemeinsame To-do-Liste

### P0 – vor jeder endgültigen Lehr-/Abgabefreigabe

- [ ] **Notebook 02:** Regel und Modell mit einem identischen, kandidatenunabhängigen Stabilitätsgate prüfen; die 70-%-Hürde darf nicht nur am günstigen letzten historischen Quartal hängen.
- [ ] **Notebook 02:** Bei nicht bestandenen Gates den vollständigen `KEINE_FREIGABE`-Pfad ohne Kapazitätskurve, Liste und Modellpaket ausführbar machen und testen.
- [ ] **Notebook 02:** Schlusskapitel und Gate-Erklärung an K1b, aktuelle Faktoren und tatsächliche Größenordnungen anpassen.
- [ ] **Notebook 05:** Sämtliche Zahlen in Phase 6 und im Schlusskapitel mit den frisch berechneten Ergebnissen synchronisieren.
- [ ] **Notebook 05:** Entdeckungs- und Bestätigungspipeline so umbauen, dass K1, K2 und K3 in beiden Perioden identisch geprüft werden.

### P1 – methodische Belastbarkeit

- [ ] **Notebook 02:** Ausmusterung im 90-Tage-Fenster als Zensierung/konkurrierendes Ereignis behandeln und Sensitivitätsanalyse berichten.
- [ ] **Notebook 02:** Ziel auf vermeidbare beziehungsweise schwere Schäden zuschneiden oder schweregradabhängige Kosten modellieren.
- [ ] **Notebook 02:** Unbekannte Radtypen nicht still zu `NaN` werden lassen, sondern validieren und kontrolliert abbrechen.
- [ ] **Notebook 02:** Prospektive Schattenperiode nach vollständigem Horizont mit eingefrorener Logik auswerten.
- [ ] **Notebook 05:** Support-Nenner eindeutig definieren und überall gleich beschriften.
- [ ] **Notebook 05:** Abhängigkeit nach Tagen/Personen durch Blockbootstrap oder geeignetes hierarchisches Modell berücksichtigen.
- [ ] **Notebook 05:** Mehrere rollierende, saisonal vergleichbare Bestätigungsfenster verwenden.
- [ ] **Notebook 05:** Operative K1-Schwelle aus realen Transport- und Fehlbestandskosten ableiten.

### P2 – Lesbarkeit und Wartbarkeit

- [ ] Hervorgehobene Zahlen programmatisch aus Ergebnissen erzeugen oder mit Assertions gegen die Rechenzellen prüfen.
- [ ] Historische Fehlerberichte kürzen, sobald die aktuelle Fassung stabil ist.
- [ ] Singular, Zeiträume, Prozentangaben und Begriffe wie „knapp“, „deutlich“, „Test“ und „Freigabe“ redaktionell präzisieren.
- [ ] Für jedes Notebook einen kleinen automatischen Abnahmetest ergänzen: vollständige Ausführung, erwartete Artefakte, keine Artefakte bei Nichtfreigabe, Text-/Kennzahlenkonsistenz.

## 5. Abschließende Freigabeentscheidung

### Notebook 02

**Noch nicht endgültig freigeben.** Der frühere Generatorwiderspruch, K1b und die Trennung von historischer Test- und Schattenliste sind überzeugend verbessert. Die aktuelle Auslieferungsentscheidung ist aber nicht mit der rollierenden Evidenz vereinbar: 56,3 % über die Validierungsquartale tragen die vorab geforderte 70-%-Treffsicherheit nicht. Nach einem symmetrischen Stabilitätsgate, einem funktionierenden Nichtfreigabepfad und einer Zensierungsanalyse kann das Notebook eine sehr starke Lehrfallstudie werden.

### Notebook 05

**Noch nicht freigeben.** Die Forschungsfrage ist als explorative Analyse systematischer, gerichteter Wege sinnvoll, und der methodische Kern ist deutlich verbessert. Die Datei erzählt im Deployment- und Schlusskapitel jedoch noch überwiegend Zahlen aus einer früheren Rechnung. Erst nach vollständiger Textsynchronisierung und einer kriterientreuen zeitlichen Bestätigung ist sie als Lehr-/Abgabeversion belastbar. Die verweigerte Betriebsfreigabe ist sachlich richtig.
