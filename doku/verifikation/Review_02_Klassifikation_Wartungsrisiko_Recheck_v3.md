# Erneuter Recheck: `02_Klassifikation_Wartungsrisiko.ipynb`

**Prüfdatum:** 2. September 2026  
**Geprüfte lokale Datei:** `/Users/robert/Downloads/02_Klassifikation_Wartungsrisiko.ipynb`  
**SHA-256:** `83d04b77708c77f9527721126fc8fc93c35d710be72e908c896dad97a89288a3`  
**Aufbau:** 48 Zellen, davon 18 Codezellen und 30 Markdownzellen  
**Frische Ausführung:** mit explizit gesetztem Datenpfad vollständig; 18 von 18 Codezellen ausgeführt, keine Zellfehler  
**Für die Prüfung verwendeter Datenstand:** Git-Commit `316b3db6532966693909430503b3ba597077754f`

## Kurzurteil

**Das analytische Grundkonzept ist stark, die aktuelle Datei ist aber noch nicht freigabefähig.**

Die neue Fassung enthält viele der zuvor geforderten methodischen Verbesserungen: korrekter Reparaturzeitpunkt, Ausschluss offener Schäden, differenzierte Distanzquellen, Routenmatrix, Höhenmeter, zeitliche Validierung, getrennte Lehr- und Produktivgates, konsistenter Regelexport, regelbezogenes Monitoring und eine ehrliche Diskussion der Rückkopplung.

Die Datei hat jedoch zwei schwerwiegende Probleme:

1. **Sie läuft in ihrer Standardkonfiguration nicht.** Der Default-Datenpfad enthält wörtlich einen nicht aufgelösten Vorlagenplatzhalter. Ohne `VELO_BASIS` endet die Ausführung beim ersten CSV-Ladevorgang mit `FileNotFoundError`.
2. **Codeergebnisse und Erzähltext gehören teilweise zu unterschiedlichen Datenständen.** Zahlreiche zentrale Zahlen und Urteile sind veraltet. Besonders gravierend: Das Notebook behauptet, die 70-%-Hürde sei statistisch nicht belegt. Die aktuelle Rechnung zeigt für die Fachregel eine Wilson-Untergrenze von **75,8 %** und für den Forest **73,9 %**. Das Gate ist numerisch bei beiden erfüllt.

### Freigabeampel

| Verwendungszweck | Urteil | Begründung |
|---|---|---|
| lokale technische Ausführung ohne Sonderkonfiguration | **Rot** | beschädigter Default-Datenpfad |
| lokale Ausführung mit gesetztem `VELO_BASIS` | **Grün** | alle 18 Codezellen laufen fehlerfrei |
| Lehrveranstaltung | **Rot-Gelb** | methodisch gut, aber zentrale Texte und Zahlen widersprechen der Ausführung |
| GitHub/Colab | **Rot** | verlinkte Fassung ist nicht mit der geprüften lokalen Fassung identisch |
| reale Werkstattentscheidung | **Rot** | künstliche Lehrdaten, kein prospektiver Test, unvollständige Kosten- und Wirkungslogik |

**Methodische Grundqualität: etwa 8/10.**  
**Konsistenz der aktuellen Endfassung: etwa 5,5/10.**  
**Sprachliche Qualität unabhängig von den falschen Zahlen: gut.**  
**Gesamturteil der vorliegenden Datei: noch nicht freigeben.**

## Frisch verifizierte Kernergebnisse

Die folgenden Werte stammen aus einer vollständigen Neuausführung mit dem nachgewiesenen Datenstand:

### Daten und Panel

| Kennzahl | aktueller Wert |
|---|---:|
| Räder | 350 |
| Schadensmeldungen | 1.425 |
| Wartungsaufträge | 1.425 |
| Fahrten | 107.297 |
| abgeschlossene Fahrten | 104.401 |
| ausgeschlossene Fahrten über acht Stunden | 67 |
| verbleibende Fahrten | 104.334 |
| Distanz gemessen | 59,8 % |
| Distanz aus Routenmatrix | 29,3 % |
| Distanz über Dauer × typisches Tempo geschätzt | 10,9 % |
| mittlere Abweichung Routenmatrix zum Messwert | 0,47 km |
| mittlere Abweichung Dauer × Tempo zum Messwert | 0,92 km |
| Panelzeilen | 2.024 |
| Stichtage | 8 |

Die Routenmatrix ist als Ersatz für fehlende Sensordistanzen im vorliegenden Datensatz erkennbar besser als die grobe Tempoannahme. Die neue Quellenhierarchie ist daher sachlich sinnvoll.

### Grundraten je Stichtag

| Stichtag | Räder | Anteil mit Meldung im Folgequartal |
|---|---:|---:|
| 03.09.2024 | 259 | 29,7 % |
| 02.12.2024 | 263 | 11,8 % |
| 02.03.2025 | 266 | 38,7 % |
| 31.05.2025 | 261 | 49,0 % |
| 29.08.2025 | 266 | 27,8 % |
| 27.11.2025 | 249 | 16,1 % |
| 25.02.2026 | 235 | 30,2 % |
| 26.05.2026 | 225 | 56,4 % |

Die starke Saisonalität ist bestätigt. Über alle acht Stichtage reicht die Grundrate aktuell von 11,8 % bis 56,4 %.

### Testquartal

| Verfahren | Treffer in Top 60 | Precision@60 | Recall@60 | Szenariokosten |
|---|---:|---:|---:|---:|
| ältestes Rad zuerst | 28 | 46,7 % | 22,0 % | 18.620 € |
| meiste Kilometer insgesamt | 35 | 58,3 % | 27,6 % | 17.185 € |
| Kilometer seit erledigter Reparatur | **52** | **86,7 %** | **40,9 %** | **13.700 €** |
| Entscheidungsbaum | 43 | 71,7 % | 33,9 % | 15.545 € |
| Random Forest | 51 | 85,0 % | 40,2 % | 13.905 € |

Im aktuellen Test liegt die Fachregel nicht gleichauf, sondern knapp vor dem Forest: ein zusätzlicher Treffer und 205 € geringere Szenariokosten.

Die beiden Top-60-Listen überschneiden sich bei 47 Rädern. Jeweils 13 Räder stehen nur auf einer Liste; unter diesen abweichenden Fällen trifft die Regel 8 und der Forest 7.

### Rollierende Validierung

| Stichtag | Grundrate | Treffer Forest | Treffer Regel | wirtschaftlicher Forest-Vorteil |
|---|---:|---:|---:|---:|
| 02.03.2025 | 38,7 % | 39 | 45 | −1.230 € |
| 31.05.2025 | 49,0 % | 45 | 47 | −410 € |
| 29.08.2025 | 27,8 % | 31 | 31 | 0 € |
| 27.11.2025 | 16,1 % | 18 | 25 | −1.435 € |
| 25.02.2026 | 30,2 % | 26 | 32 | −1.230 € |
| **Summe** |  | **159** | **180** | **−4.305 €** |

Der Forest ist in keinem Validierungsquartal besser, einmal gleichauf und viermal schlechter. Die Entscheidung zugunsten der Fachregel ist damit sachlich plausibel und nicht nur eine Folge des letzten Testquartals.

### Unsicherheit des 70-%-Kriteriums

| Verfahren | Treffer | Quote | 95-%-Wilson-Intervall | untere Grenze ≥ 70 % |
|---|---:|---:|---:|---|
| Fachregel | 52 von 60 | 86,7 % | 75,8–93,1 % | **ja** |
| Random Forest | 51 von 60 | 85,0 % | 73,9–91,9 % | **ja** |

Das Ergebnis darf wegen der bekannten Überarbeitungsgeschichte nicht als unabhängiger Produktivnachweis interpretiert werden. Rechnerisch ist die im Notebook programmierte K1b-Bedingung aber bei beiden Verfahren erfüllt.

## Erfolgreich behobene frühere Kritikpunkte

| früherer Kritikpunkt | aktueller Stand |
|---|---|
| künstliche Lehrdaten nicht ausreichend kenntlich | **behoben** |
| Export widerspricht dem textlich gewählten Verfahren | **behoben; Assertion vorhanden** |
| Regel verwendet Meldung statt erledigte Reparatur als Reset | **behoben** |
| offene Schäden verbrauchen Vorsorgeplätze | **behoben** |
| vorhandene Sensordistanzen werden verworfen | **behoben** |
| fehlende Distanzen nur grob über Tempo geschätzt | **deutlich verbessert durch Routenmatrix** |
| Langfahrten verschmutzen Verschleißmerkmale | **behoben** |
| Precision und Recall werden verwechselt | **behoben** |
| nur ein Quartal trägt die Entscheidung | **verbessert durch fünf rollierende Validierungsquartale** |
| Klassenwicht wird als exakte Kostenübersetzung verkauft | **im späteren Text relativiert** |
| Modellscore wird als Risiko ausgegeben | **behoben; Score fehlt in der Werkstattliste** |
| Monitoring ist auf ein nicht ausgeliefertes Modell ausgerichtet | **behoben; Monitoring bezieht sich auf die Regel** |
| „eine SQL-Zeile ohne Wartungsaufwand“ | **wesentlich differenzierter erklärt** |
| Rückkopplung durch präventive Maßnahmen | **fachlich richtig als Gegenfaktenproblem beschrieben** |
| unvollständige Kostenformel optimiert fälschlich die Kapazität | **behoben; Grenze der Formel wird deutlich erklärt** |

Diese Fortschritte sind substanziell. Der aktuelle Freigabestopp entsteht nicht durch ein schwaches Analysekonzept, sondern vor allem durch fehlende Synchronisation zwischen Daten, Code, Text und Veröffentlichungsartefakt.

## P0 – Vor Lehr- oder Veröffentlichungsfreigabe zwingend zu beheben

### P0.1 – Der Standard-Datenpfad ist syntaktisch gültig, inhaltlich aber beschädigt

Die Datei enthält:

```python
BASIS = os.environ.get("VELO_BASIS",
    """ + '"' + ROHBASIS + '"' + """)
```

Python behandelt dies als gewöhnlichen String. Ohne Umgebungsvariable entsteht daher ein Pfad der Form:

```text
""" + '"' + ROHBASIS + '"' + """fahrrad.csv
```

Der erste Leseversuch endet reproduzierbar mit `FileNotFoundError`.

**Abhilfe:** Den Vorlagenplatzhalter im Erzeugungsschritt korrekt auflösen. Anschließend das fertige Notebook in einer sauberen Umgebung ohne `VELO_BASIS` vollständig ausführen. Ein Test sollte zusätzlich verhindern, dass Zeichenketten wie `ROHBASIS`, `""" +` oder andere Templatefragmente im fertigen Notebook verbleiben.

### P0.2 – Lokale Datei und verlinkte GitHub-/Colab-Fassung sind nicht identisch

Der Colab-Knopf verweist auf die [GitHub-Fassung des Notebooks](https://github.com/swrobuts/velocity-fallstudie/blob/main/analytics/notebooks/02_Klassifikation_Wartungsrisiko.ipynb).

Zum Prüfzeitpunkt gilt:

| Artefakt | Zellen | Codezellen | SHA-256 |
|---|---:|---:|---|
| lokale geprüfte Datei | 48 | 18 | `83d04b77708c…` |
| GitHub `main` | 46 | 17 | `f14bd72f6e78…` |

Die GitHub-Fassung enthält unter anderem noch nicht die lokale Erweiterung um Routenmatrix und Höhenmeter. Wer den Colab-Knopf verwendet, prüft somit nicht die vorliegende Datei.

Auch die [Analytics-Dokumentation](https://github.com/swrobuts/velocity-fallstudie/blob/main/analytics/README.md) ist nicht zum aktuellen Datenstand synchron: Sie nennt weiterhin 640 Meldungen, während die eingelesene Datei 1.425 Meldungen enthält.

**Abhilfe:** Notebook, Bauquelle, Daten, Colab-Ziel und READMEs gemeinsam veröffentlichen. Danach Hash, Zellzahl und zentrale Ergebniswerte automatisiert gegeneinander prüfen.

### P0.3 – Zentrale Fließtexte widersprechen der aktuellen Ausführung

Die wichtigsten Abweichungen:

| Aussage im Notebook | aktuelle Rechnung | erforderliche Korrektur |
|---|---:|---|
| 60 Prüfungen je Quartal seien rund fünf pro Werktag | **0,94 pro Werktag**, etwa 4,7 pro Woche | „rund eine pro Werktag“ oder „rund fünf pro Woche“ |
| Nutzung und Meldungen korrelieren mit ungefähr 0,7 | **0,914** | aktuelle Zahl einsetzen und hohe künstliche Signalstärke einordnen |
| rund 44 % melden sich im Quartal | **53,4 %** in der Phase-2-Momentaufnahme | aktualisieren |
| Saisonalität etwa 8–46 % | **11,8–56,4 %** über alle acht Stichtage | aktualisieren |
| Regel und Forest seien im Test gleichauf | **52 gegen 51 Treffer** | knappen Vorsprung der Regel nennen |
| Regel steige auf 71,7 % | **86,7 %** | aktualisieren |
| 43 von 60; Wilson 59,2–81,5 % | **52 von 60; 75,8–93,1 %** | gesamte Passage neu schreiben |
| 70 % lägen innerhalb beider Intervalle | **70 % liegen unter beiden Intervallen** | Urteil umkehren |
| K1b sei von keinem Verfahren erfüllt | **von beiden erfüllt** | numerisch korrekt, aber als retrospektiven Befund kennzeichnen |
| von 102 positiven Rädern sei etwa ein Drittel fahruntauglich | **127 positiv; 61 beziehungsweise 48,0 % fahruntauglich** | aktualisieren |
| „sieben von zehn“ ausgewählten Rädern melden sich | **8,7 von zehn** bei der Regel | aktualisieren |
| Schlussübersicht: Gleichstand und statistisch nicht trennbar | Regel im Test knapp und rollierend deutlich vorn; Wilson vergleicht die Verfahren ohnehin nicht direkt | Schlussübersicht neu formulieren |

Diese Widersprüche betreffen nicht nur Nebensätze. Sie verändern die Interpretation der Güte, des Erfolgsgates und des Modellvergleichs.

**Abhilfe:** Sämtliche Ergebniszahlen aus einer zentralen Ergebnisstruktur in Markdownzellen einsetzen oder beim Build automatisch prüfen. Harte Zahlen und Urteile dürfen nicht doppelt manuell gepflegt werden.

### P0.4 – Die Wilson-Passage enthält einen programmatischen Falschausdruck

Der Code berechnet die Intervalle korrekt, druckt danach aber bedingungslos:

```text
Die Hürde von 70 % liegt INNERHALB beider Intervalle.
```

Diese Ausgabe ist beim aktuellen Ergebnis falsch. Es handelt sich nicht nur um veralteten Fließtext, sondern um eine hart codierte Schlussfolgerung in einer Codezelle.

**Abhilfe:** Das Urteil aus den berechneten Untergrenzen ableiten und mit einer Assertion gegen die spätere K1b-Tabelle absichern.

## P1 – Methodische und betriebliche Restpunkte

### P1.1 – Der historische Test ist kein unabhängiger Produktivnachweis

Das Notebook sagt inzwischen korrekt, dass Ergebnisse des letzten Stichtags in früheren Fassungen bereits angesehen wurden. Danach wurden Merkmalslogik und Datenaufbereitung verändert. Der aktuelle Test ist daher ein retrospektiver Re-Test.

**Folge:** Dass K1b nun rechnerisch erfüllt ist, erlaubt keine reale Freigabe. Pipeline, Regel, Ziel und Gates müssen vor einem neuen 90-Tage-Zeitraum eingefroren und im Schattenbetrieb geprüft werden.

### P1.2 – Wilson-Intervalle vergleichen Regel und Forest nicht direkt

Zwei getrennte Wilson-Intervalle beantworten jeweils die Frage, welche Precision mit 52 beziehungsweise 51 Treffern vereinbar ist. Sie testen nicht die Differenz zweier Rankings auf denselben Rädern. Überlappende oder nicht überlappende Einzelintervalle sind kein sauberer Verfahrensvergleich.

**Abhilfe:** Für den Testvergleich eine gepaarte Resampling- oder Randomisierungsanalyse verwenden. Für die eigentliche Auswahl sind die fünf zeitlichen Validierungsquartale wichtiger; dort sollte die Differenz der Top-k-Güte mit Quartalsstreuung berichtet werden.

### P1.3 – Die Stabilitätsregel K3 ist noch zu grob definiert

Für den Forest gilt K3 derzeit, sobald die Summe seines Kostenvorteils über die Validierungsquartale positiv ist. Ein einzelnes sehr gutes Quartal könnte damit mehrere schlechte Quartale überdecken, obwohl der Text „stabil über mehrere Quartale“ verspricht.

**Abhilfe:** Vorab eine eindeutige Regel festlegen, etwa Mindestzahl gewonnener Quartale, zulässiger schlechtester Rückstand und mittlerer Vorteil mit Unsicherheitsband.

### P1.4 – Das Ziel bleibt breiter als die wirtschaftliche Maßnahme

Vorhergesagt wird irgendeine Schadensmeldung. Im Test haben 127 Räder eine Meldung; nur 61 davon haben mindestens eine Meldung der Stufe `fahruntauglich`. Leichte, mittlere und fahruntaugliche Schäden erhalten in der Szenariorechnung denselben Nutzen.

**Abhilfe:** Ziel auf durch die Vorsorgeprüfung erkennbare und vermeidbare Defekte ausrichten oder Schwere und Kategorie in die Nutzenfunktion aufnehmen. Erkennungs- und Verhinderungswahrscheinlichkeit müssen empirisch erhoben werden.

### P1.5 – Unterschiedliche Expositionsdauer durch Ausmusterung

Im Testbestand werden 27 der 225 Räder innerhalb des 90-Tage-Horizonts ausgemustert. Für sie ist die Beobachtungszeit verkürzt; ein fehlendes Ereignis ist nicht ohne Weiteres mit einem vollständig beobachteten Negativfall gleichzusetzen.

**Abhilfe:** Ausmusterung als konkurrierendes Ereignis beziehungsweise Zensierung behandeln oder die Zielpopulation und erforderliche Mindestexposition ausdrücklich definieren.

### P1.6 – Die Begründung des Zeitsplits übertreibt die Trennung der Fahrräder

Der zeitliche Split verhindert, dass spätere Informationen in frühere Stichtage gelangen, und bildet die Anwendung auf die bestehende Flotte ab. Er verhindert aber nicht, dass dasselbe Rad in früheren Trainingszeilen und später im Test vorkommt.

**Abhilfe:** Formulieren, dass zeitlich getrennt wird, nicht nach Entitäten. Falls auch neue Räder abgedeckt werden sollen, zusätzlich eine gruppierte Prüfung auf bisher ungesehenen Fahrrädern durchführen.

### P1.7 – Regelartefakt, Forschungsmodell und Featurelogik sollten getrennt werden

Die Werkstattliste enthält erfreulicherweise keinen Forest-Score mehr. Das Paket `wartungsmodell.joblib` enthält jedoch weiterhin den nicht freigegebenen Forest zusammen mit Regelmetadaten, obwohl die Vorverarbeitung nicht vollständig gekapselt ist.

**Abhilfe:**

- transparentes Regelmanifest mit Featuredefinition, Datenstand, Stichtag und Regelversion;
- separate Werkstattliste;
- separates Forschungsartefakt für Forest und Auswertungen;
- Forest nur zusammen mit trainierter Vorverarbeitung speichern.

### P1.8 – Die CSV besitzt zu wenig Betriebsmetadaten

Die exportierte Liste enthält Rang, Rahmennummer, Typ und erklärende Merkmale, aber keinen Stichtag, Gültigkeitszeitraum, Regelstatus, Datenstand oder Versionshash.

**Abhilfe:** Diese Metadaten als Spalten oder Begleitmanifest ergänzen. Der Dateiname allein darf nicht die einzige Quelle für die Gültigkeit sein.

### P1.9 – Daten und Standardpfad sind nicht unveränderlich versioniert

Selbst nach Reparatur des Platzhalters würde der bisherige GitHub-Standardpfad auf `main` zeigen. Eine erneute Ausführung kann dadurch ohne Notebookänderung andere Daten und Ergebnisse liefern – genau dieses Risiko zeigt die aktuelle Diskrepanz.

**Abhilfe:** Rohdaten über einen unveränderlichen Commit oder Release laden und SHA-256-Werte aller Eingabedateien dokumentieren.

## P2 – Weitere Verbesserungsmöglichkeiten

- `pd.get_dummies` durch eine trainierte `Pipeline` mit `OneHotEncoder(handle_unknown="ignore")` ersetzen, falls der Forest weiter untersucht wird.
- `tage_seit_reparatur = 9999` durch ein Merkmal `hat_reparaturhistorie` plus sachliche Imputation ersetzen.
- Klassenwichte auf den rollierenden Validierungsquartalen gegen die tatsächliche Top-60-Metrik vergleichen.
- Die Ersatzdistanzprüfung als mögliche Missing-not-at-random-Problematik einordnen: Fahrten mit vorhandener Sensormessung müssen nicht repräsentativ für Fahrten ohne Messwert sein.
- Die Höhenmeterheuristik fachlich validieren; absolute Durchschnittssteigung ist noch kein gemessener Bauteilverschleiß.
- Acht-Stunden-Grenze, 180-Tage-Rückblick und 30-Tage-Mindestalter als fachliche Setzungen begründen oder in Sensitivitätsanalysen prüfen.
- Datenvollständigkeit vor jeder Berechnung mit Assertions absichern: eindeutige Schlüssel, bekannte Radtypen, vorhandene Routen, plausible Zeitreihenfolge und keine Fahrten über Stichtage. Im aktuellen Datensatz kreuzt keine berücksichtigte Fahrt einen Stichtag; die Prüfung sollte trotzdem im Notebook stehen.

## Sprachliche und didaktische Qualität

### Stärken

- Der Text erklärt Zeit-Leakage, Baselines, Precision, Recall und Rückkopplung sehr anschaulich.
- Die Entscheidung gegen ein komplexeres Modell wird fachlich motiviert und nicht als Scheitern dargestellt.
- Grenzen der künstlichen Daten und der Szenariokosten werden prominent benannt.
- Die Erklärung, warum die Regel trotz einfacher Sortierung eine anspruchsvolle Featurelogik benötigt, ist gelungen.
- Der Abschnitt zur unbekannten Maßnahmenwirksamkeit und Kontrollgruppe ist inhaltlich stark.

### Schwächen der aktuellen Fassung

- Die Lesbarkeit wird durch zahlreiche falsche Zahlen und daraus abgeleitete Fehlurteile stark beeinträchtigt.
- Mehrere prägnante Lehrsätze – „Gleichstand“, „sieben von zehn“, „70 % nicht belegt“ – sind gerade deshalb problematisch, weil sie gut merkbar, aber aktuell falsch sind.
- Die Passage zum Zeitsplit vermittelt fälschlich, dass das Modell Testfahrräder noch nie gesehen habe.
- „Der Wald hat die Regel gefunden – mehr aber auch nicht“ bleibt zu absolut. Korrekt ist: Mit dieser Merkmalsmenge, Konfiguration und den verfügbaren Zeitperioden ist kein stabiler Zusatznutzen nachgewiesen.

Nach einer konsequenten Aktualisierung der Ergebnisbezüge ist das Notebook didaktisch sehr gut geeignet.

## Vollständiger Status der Prüffragen

| Prüffrage | aktueller Stand |
|---|---|
| sinnvolle Geschäftsfrage | **ja; operative Top-60-Priorisierung klar** |
| Zieldefinition | **verständlich, aber für reale Wirtschaftlichkeit zu breit** |
| zeitliche Merkmals-/Labeltrennung | **weitgehend sauber** |
| wiederholte Fahrräder | **zulässig für Bestandsbetrieb, im Text missverständlich** |
| Ausreißerbehandlung | **vorhanden; Schwelle noch zu begründen** |
| Distanzimputation | **deutlich verbessert und gegengeprüft** |
| Reparaturzeitpunkt | **korrekt erledigte Reparatur** |
| offene Schäden | **korrekt ausgeschlossen** |
| Baselines | **stark und fachlich sinnvoll** |
| Klassenungleichgewicht und Saison | **erkannt; aktuelle Zahlen im Text veraltet** |
| Kostenasymmetrie | **als Szenario transparent; kein vollständiges Kostenmodell** |
| Schwellen-/Top-k-Logik | **Top 60 korrekt; Klassengewicht als Setzung erkannt** |
| rollierende Validierung | **vorhanden und entscheidungsrelevant** |
| unabhängiger Endtest | **nicht vorhanden** |
| statistisches K1b-Gate | **rechnerisch erfüllt, textlich falsch dargestellt, nicht unabhängig bestätigt** |
| Modellvergleich | **Regelentscheidung plausibel; Wilson kein direkter Vergleich** |
| Exportkonsistenz | **durch Assertion erfüllt** |
| produktive Liste ohne Forest-Score | **erfüllt** |
| Deployment-Metadaten | **unvollständig** |
| regelbezogenes Monitoring | **inhaltlich gut** |
| Rückkopplung/Kontrollgruppe | **korrekt diskutiert, noch nicht praktisch gelöst** |
| Reproduzierbarkeit | **aktuell nicht erfüllt** |
| Colab-/GitHub-Synchronität | **nicht erfüllt** |
| Text-Zahlen-Konsistenz | **nicht erfüllt** |

## Priorisierte To-do-Liste

### P0 – vor der nächsten Abgabe

- [ ] Default-Datenpfad reparieren und Notebook ohne `VELO_BASIS` frisch ausführen.
- [ ] Buildtest ergänzen, der nicht aufgelöste Vorlagenplatzhalter erkennt.
- [ ] Lokale Datei, GitHub-Notebook, Colab-Link und READMEs synchronisieren.
- [ ] Alle Ergebniszahlen und Schlussfolgerungen auf den aktuellen Datenstand bringen.
- [ ] Wilson-Urteil im Code aus den berechneten Grenzen ableiten.
- [ ] Quartalskapazität von „fünf pro Werktag“ auf „etwa eine pro Werktag/fünf pro Woche“ korrigieren.
- [ ] Schlussübersicht und die drei Merksätze neu formulieren.

### P1 – vor einem echten Pilotbetrieb

- [ ] Daten, Regel, Kostenannahmen und Gates unveränderlich einfrieren.
- [ ] Ziel auf erkennbare und vermeidbare Schäden zuschneiden.
- [ ] Ausmusterung beziehungsweise verkürzte Exposition behandeln.
- [ ] Vollständigen prospektiven 90-Tage-Schattenbetrieb durchführen.
- [ ] Regelgüte, Forest-Vergleich und Saisonalität auf neuen Daten prüfen.
- [ ] Maßnahmenwirksamkeit anschließend mit sauber protokollierter Kontrollgruppe untersuchen.
- [ ] Regelmanifest, Werkstattliste und Forschungsmodell trennen und versionieren.

### P2 – Robustheit

- [ ] Forest-Vorverarbeitung vollständig in einer Pipeline kapseln.
- [ ] Klassengewichte und Rückblickfenster zeitlich validieren.
- [ ] Distanzersatz und Höhenmeterheuristik weiter absichern.
- [ ] Sentinelwert `9999` durch explizite Reparaturhistorie ersetzen.
- [ ] Grenzwerte für Langfahrten und neue Räder fachlich bestätigen.

## Abschließende Einschätzung

Die fachliche Geschichte ist grundsätzlich überzeugend: Eine sorgfältig konstruierte Wartungsregel schlägt den Random Forest in vier von fünf Validierungsquartalen und ist einmal gleichauf. Deshalb wird zurecht die einfachere, besser erklärbare Regel gewählt. Die neue Routenmatrix verbessert außerdem die Distanzaufbereitung nachvollziehbar.

**Die vorliegende Datei ist trotzdem noch nicht freigabefähig.** Der Standardlauf ist durch einen Vorlagenfehler blockiert, der Colab-Link führt zu einer anderen Fassung, und zahlreiche zentrale Aussagen stammen aus älteren Ergebnissen. Dadurch behauptet das Notebook unter anderem das Gegenteil seiner eigenen aktuellen K1b-Berechnung.

Nach Reparatur des Datenpfads, Synchronisierung der Veröffentlichungsartefakte und vollständiger Aktualisierung aller dynamischen Aussagen ist die Fassung für die Lehre gut freigabefähig. Für eine reale Werkstattentscheidung bleibt sie ausdrücklich ungeeignet, bis reale Daten, ein engeres Ziel, vollständige Kosten, ein prospektiver Schattenlauf und der Nachweis der Maßnahmenwirkung vorliegen.
