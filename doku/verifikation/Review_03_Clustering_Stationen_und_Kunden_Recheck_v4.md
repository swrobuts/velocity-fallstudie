# Erneuter analytischer, methodischer und sprachlicher Review

## Notebook 03 – Clustering von Stationen und Kundschaft

**Geprüfte Datei:** `03_Clustering_Stationen_und_Kunden.ipynb`  
**Prüfdatum:** 02.09.2026  
**SHA-256 der geprüften lokalen Fassung:** `4fb1181ed88c269c2c4463c7f2e5de42a2b53db3e5474ce9376c637882cd5421`

## Kurzurteil

Die neue Fassung enthält wichtige echte Verbesserungen: Das Stabilitätsgate bezieht sich nun auf die Kampagnen-Arbeitsliste und wird bei Überschreitung der Grenze korrekt geschlossen. Alle sechs betrieblichen Freigabegates sind offen, die Kampagnenfreigabe bleibt folgerichtig aus. Die Segmentnamen wurden neutralisiert, eine zeitliche Stationsprüfung wurde ergänzt und die monatliche Freiminutenkennzahl berücksichtigt nun die tatsächlich beobachteten Kundenmonate.

**Trotzdem ist diese konkrete Datei noch nicht freigabefähig.** Der Grund ist nicht primär das Clusteringverfahren, sondern die Konsistenz der Gesamtdarstellung: Nach der erneuten Datengenerierung haben sich Ergebnisse deutlich verändert, während zahlreiche Texte, Zahlen und Schlussfolgerungen den früheren Datenstand beschreiben. Dadurch sind mehrere Kernaussagen nachweislich falsch. Zusätzlich ist der Standard-Datenpfad syntaktisch beschädigt; ohne manuell gesetzte Umgebungsvariable kann das Notebook nicht ausgeführt werden.

### Gesamtampel

| Prüffeld | Urteil | Kurzbegründung |
|---|---|---|
| Ausführung mit explizit gesetztem Datenpfad | **Grün** | 23 von 23 Codezellen liefen in einer frischen Gesamtausführung ohne Fehler |
| Ausführung über den eingebauten Standardpfad | **Rot** | Der Pfad enthält versehentlich Python-/String-Fragmente und führt zu `FileNotFoundError` |
| Methodischer Aufbau | **Gelb bis grün** | Gute Trennung von Exploration, Regeln und Gates; einzelne Prüfungen validieren aber nicht exakt dieselbe Pipeline |
| Ergebnisinterpretation | **Rot** | Stations- und Kundenkernaussagen widersprechen den frisch berechneten Ergebnissen |
| Sprachliche und redaktionelle Konsistenz | **Rot** | Alte und neue Zahlen sowie sich widersprechende Aussagen stehen nebeneinander |
| Lehr-/Abgabeversion | **Noch nicht freigabefähig** | Erst nach Korrektur der P0-Punkte |
| Reale Stationsdisposition | **Nicht freigabefähig** | Ankünfte, Bestände, Kapazitäten und verlorene Nachfrage fehlen weiterhin |
| Reale Marketingkampagne | **Nicht freigabefähig** | Im Notebook selbst korrekt durch sechs offene Gates blockiert |

## 1. Umfang der erneuten Prüfung

Die Datei wurde nicht nur statisch gelesen, sondern mit dem zum Projekt gehörenden Datenstand frisch und vollständig ausgeführt. Zusätzlich wurden zentrale Ergebnisse unabhängig nachgerechnet und Sensitivitätsprüfungen vorgenommen.

| Prüfung | Ergebnis |
|---|---:|
| Zellen insgesamt | 57 |
| Markdownzellen | 34 |
| Codezellen | 23 |
| frisch ausgeführte Codezellen | 23 von 23 |
| Laufzeitfehler bei gesetztem `VELO_BASIS` | 0 |
| abgeschlossene Fahrten | 104.401 |
| Stationen | 10 |
| Kundinnen und Kunden | 3.200 |
| aktueller Cutoff | 25.08.2026, 00:00 Uhr |
| letzte Fahrt vor dem Cutoff | 24.08.2026 |
| aktive RFM-Population | 2.271 |
| ohne Fahrt im aktuellen Fenster | 929 |

Die Ausführbarkeit ist somit zweigeteilt zu beurteilen: **Der Analysecode funktioniert mit korrekt übergebenem Projektpfad; die Datei funktioniert in ihrer derzeitigen Standardkonfiguration nicht eigenständig.**

## 2. Was seit dem vorherigen Review überzeugend verbessert wurde

### 2.1 Das Kampagnen-Stabilitätsgate verwendet jetzt die relevante Population

Der wichtigste frühere Kritikpunkt wurde aufgegriffen. Das bindende Gate wird nicht mehr mit einer breiten Gesamtpopulation verwässert, sondern aus Personen bestimmt, die an beiden Cutoffs zur Kampagnen-Arbeitsliste gehören.

Die frisch berechneten Werte lauten:

| Sicht | gemeinsame Population | Wechselquote |
|---|---:|---:|
| aktive RFM-Regeln an beiden Cutoffs | 2.097 | 27,13 % |
| vollständige Lebenszykluslogik | 3.072 | 26,89 % |
| Kampagnen-Arbeitsliste an beiden Cutoffs | 2.937 | **26,97 %** |

Bei einer Grenze von 25 % ist das Gate damit korrekt **nicht bestanden**. Das Notebook setzt `KAMPAGNENFREIGABE=False` und weist keine Kampagnenfreigabe aus.

### 2.2 Sechs Freigabegates werden getrennt und transparent behandelt

Die aktuelle Fassung trennt fachliche Stabilität, Beobachtungsdauer, Rechtsgrundlage beziehungsweise Kontaktierbarkeit, Datenrealität und weitere betriebliche Voraussetzungen. Alle sechs Gates sind offen. Das ist wesentlich glaubwürdiger als eine Freigabe allein aufgrund eines technisch erzeugten Segments.

### 2.3 Segmentnamen sind neutraler

Bezeichnungen wie `Vielfahrer` und `Umsatzträger` behaupten nicht mehr automatisch einen bestimmten Tarif oder Freiminutenstatus. Tarif, Berechtigung und Segment können dadurch als getrennte Merkmale behandelt werden.

### 2.4 Zeitliche Stationsprüfung wurde ergänzt

Neben der Stabilität gegenüber verschiedenen k-Means-Initialisierungen wird nun auch ein zeitlich verschobener Vergleich berechnet. Das ist konzeptionell richtig und deutlich aussagekräftiger als reine Rechenstabilität.

### 2.5 Monatskennzahl der Freiminuten wurde sachgerechter gemacht

Der hypothetische Wert wird nicht mehr pauschal durch zwölf geteilt, sondern auf tatsächlich beobachtete Kundenmonate bezogen. Damit wurde ein konkreter methodischer Fehler aus der Vorversion beseitigt.

### 2.6 Betriebliche Aussagen zu Stationen sind vorsichtiger formuliert

Die Stationsprofile werden als Hypothesen und nicht als fertiger Umverteilungsplan bezeichnet. Das passt zu den verfügbaren Daten, die Abfahrten, aber keine vollständige Bestands- und Nachfragebilanz enthalten.

## 3. P0-Mängel – vor jeder Freigabe zu korrigieren

### 3.1 Der eingebaute Standard-Datenpfad ist defekt

Im Notebook steht sinngemäß:

```python
BASIS = os.environ.get("VELO_BASIS", """ + '"' + ROHBASIS + '"' + """)
```

Die String-Fragmente wurden offenbar versehentlich als Text in die Zelle übernommen. Ohne gesetzte Umgebungsvariable sucht das Notebook deshalb nach einem nicht existierenden Pfad, der mit diesen Fragmenten beginnt. Der Fehler wurde in einer separaten Ausführung reproduziert.

**Korrektur:** Einen realen, einfachen Fallbackpfad verwenden oder die erforderliche Umgebungsvariable mit klarer Fehlermeldung verpflichtend machen. Danach die Datei in genau der vorgesehenen Colab-/lokalen Startumgebung einmal vollständig neu ausführen.

### 3.2 Die verlinkte GitHub-/Colab-Fassung ist nicht dieselbe Datei

Der Colab-Link verweist auf die Fassung im GitHub-Hauptzweig. Am Prüfdatum hatte diese Fassung 56 Zellen und den SHA-256-Wert `5b4e40d...`; die hier geprüfte Datei hat 57 Zellen und den oben genannten abweichenden Fingerabdruck. Wer den Link öffnet, prüft oder präsentiert somit nicht zwingend den aktuellen Stand. Auch die Analytics-README enthält noch Kennzahlen eines älteren Datenstands.

**Korrektur:** Die geprüfte Datei in den Hauptzweig übernehmen, anschließend den Link öffnen, frisch ausführen und die README aktualisieren. Maßgebliche Quellen: [Notebook im GitHub-Hauptzweig](https://github.com/swrobuts/velocity-fallstudie/blob/main/analytics/notebooks/03_Clustering_Stationen_und_Kunden.ipynb) und [Analytics-README](https://github.com/swrobuts/velocity-fallstudie/blob/main/analytics/README.md).

### 3.3 Die Stationsinterpretation beschreibt einen alten Datenstand

Die aktuelle k=4-Lösung enthält:

| Cluster | Stationen |
|---|---|
| 0 | Sanderau, Grombühl Klinikum, Zellerau |
| 1 | Universität Sanderring, Residenz, Dom, Hubland Campus |
| 2 | Hauptbahnhof |
| 3 | Marktplatz, Juliuspromenade |

Die Texte beschreiben dagegen weiterhin vier Pendlerstationen, zwei Universitätsstationen, zwei Freizeitstationen und zwei Innenstadtstationen mit alten Spitzenstunden. Auch die spätere Behauptung einer **100-prozentigen Übereinstimmung mit den Generatorrollen** ist falsch: Die Notebookausgabe nennt 80 %. Ein labelinvariantes Maß ergibt für k=4 nur einen Adjusted Rand Index von rund **0,533** gegenüber den Generatorrollen.

Zusätzlich ist die Begründung für k=4 veraltet. Die frische Silhouettenanalyse ergibt:

| k | Silhouette |
|---:|---:|
| 2 | 0,476 |
| 3 | 0,458 |
| 4 | 0,546 |
| 5 | **0,598** |
| 6 | 0,527 |
| 7 | 0,406 |

k=4 kann aus Gründen der Interpretierbarkeit oder Produktlogik weiterhin gewählt werden. Es darf aber nicht mehr mit dem höchsten Silhouettenwert begründet werden.

**Korrektur:** Sämtliche Stationsprofile und Schlussfolgerungen automatisch aus den frisch erzeugten Profiltafeln ableiten; die k-Wahl als dokumentierten Zielkonflikt zwischen Trennschärfe, Stabilität, Mindestgröße und Interpretierbarkeit neu entscheiden.

### 3.4 Die zentrale Kunden- und Preisgeschichte ist für die Cluster falsch

Die frisch berechneten Kundencluster haben folgende Profile:

| Cluster | n | mittlere Fahrten | mittlerer Umsatz | Umsatz je Fahrt |
|---:|---:|---:|---:|---:|
| 0 | 629 | 22,7 | 50,3 EUR | **2,22 EUR** |
| 1 | 935 | 8,6 | 16,3 EUR | 1,90 EUR |
| 2 | 210 | 2,0 | 6,8 EUR | **3,40 EUR** |
| 3 | 497 | 2,8 | 3,8 EUR | **1,36 EUR** |

Das häufigste beziehungsweise fahrtenstärkste Cluster 0 hat **nicht** den niedrigsten Umsatz je Fahrt. Der Text vergleicht an einer Stelle sogar 2,22 EUR mit 2,22 EUR und spricht dennoch von einem niedrigsten Wert. Diese Aussage wird anschließend als zentrale Erkenntnis wiederholt.

Interessanterweise ist eine ähnliche Geschäftsaussage bei den später definierten **Regelsegmenten** tatsächlich sichtbar: Das Segment `Vielfahrer` kommt auf rund 1,65 EUR je Fahrt, `Umsatzträger` auf rund 6,24 EUR. Das ist aber eine Analyse der Regeln, nicht eine Entdeckung des k-Means-Modells.

**Korrektur:** Die Preis- und Freiminutenanalyse nach der Regelbildung durchführen und explizit nach dem tatsächlich exportierten Feld `segment` gruppieren. Alternativ die Geschäftsgeschichte aus dem Clusterkapitel entfernen. Cluster und ausgelieferte Regelprodukte dürfen nicht sprachlich vermischt werden.

### 3.5 Alte und neue Gatewerte widersprechen einander

Im Notebook stehen noch ältere Werte von 25,68 %, 24,75 % und 24,89 %, während die aktuelle Rechnung 27,13 %, 26,89 % und 26,97 % ergibt. Außerdem wird fest behauptet, der weite Nenner bestehe das Gate und nur der enge Nenner reiße es. Nach dem aktuellen Lauf ist das falsch: **Beide Perspektiven liegen über 25 %.** Spätere Texte sagen wiederum korrekt, dass beide scheitern.

Auch die abschließende Diagnose verwendet teilweise die RFM-Wechselquote von 27,1 %, obwohl für die Freigabe die Arbeitslistenquote von 26,97 % bindend ist.

**Korrektur:** Alle hart kodierten Ergebniszahlen und verbalen Urteile entfernen. Werte ausschließlich aus Variablen und Ergebnistabellen formatieren. In der Schlusszelle explizit dieselbe Gatevariable ausgeben, die tatsächlich über die Freigabe entscheidet.

### 3.6 Weitere veraltete Zahlen müssen vollständig bereinigt werden

Unter anderem sind noch folgende Altwerte vorhanden:

- 406 Personen mit kurzer Historie; aktuell sind es **510**,
- Kundensilhouette 0,409; aktuell sind es rund **0,339**,
- nur „ungefähr“ stabile Kundencluster; die geprüften Zufallsstarts ergaben aktuell ARI **1,000**,
- 100 % Generatorübereinstimmung; aktuell zeigt das Notebook **80 %**,
- alte Clustergrößen und Rollenbeschreibungen.

Einzelne Korrekturen reichen hier nicht. Nötig ist eine systematische Suche nach allen Zahlen und Schlussfolgerungen, die manuell in Markdown oder Ausgaben formuliert wurden.

## 4. P1-Mängel – methodisch vor einer belastbaren Abgabe verbessern

### 4.1 Die zeitliche Stationsprüfung validiert nicht exakt die Hauptpipeline

Das Hauptmodell verwendet 24 normierte **Werktagsstunden**, Wochenendanteil und Mediandauer. Die zeitliche Prüffunktion verwendet dagegen nur 24 Stundenmerkmale über alle Tage und lässt Wochenendanteil sowie Dauer weg. Damit prüft sie eine verwandte, aber nicht identische Merkmalsrepräsentation.

Eine unabhängige Gegenrechnung mit der vollständigen Hauptpipeline ergab zwar ebenfalls einen zeitlichen ARI von **1,000**. Das Ergebnis ist in diesem Datenstand also günstig; die Evidenz im Notebook sollte dennoch dieselbe Transformation, Gewichtung und Clusterlogik wie das Produktionsmodell verwenden.

**Korrektur:** Eine gemeinsame Feature-Pipeline als Funktion definieren und sowohl im Hauptlauf als auch in allen Stabilitätsfenstern unverändert aufrufen.

### 4.2 Die Stationslösung ist empfindlich gegenüber Merkmalsblock-Gewichten

Jedes der 26 Merkmale wird einzeln standardisiert. Damit erhält der Block aus 24 Stundenmerkmalen zusammen wesentlich mehr Einfluss als Wochenendanteil und Mediandauer. Eine alternative, blockweise Gleichgewichtung erzeugte eine deutlich andere k=4-Aufteilung; der ARI gegenüber der Notebooklösung lag nur bei **0,28**.

Das beweist nicht, dass die alternative Gewichtung besser ist. Es zeigt aber, dass die fachliche Lösung stark von einer bisher kaum begründeten Designentscheidung abhängt.

**Korrektur:** Die gewünschte Bedeutung der Merkmalsblöcke fachlich festlegen, mindestens drei plausible Gewichtungen vergleichen und Stabilität, Interpretierbarkeit sowie Mindestclustergrößen gemeinsam bewerten.

### 4.3 Nur zehn Stationen begrenzen die Aussagekraft

Bei zehn Beobachtungen führen k=4 beziehungsweise k=5 zwangsläufig zu sehr kleinen Gruppen; in der k=4-Lösung besteht ein Cluster nur aus dem Hauptbahnhof. Silhouettenwerte und Zufallsstartstabilität dürfen deshalb nicht als starke externe Evidenz missverstanden werden.

**Korrektur:** Stationscluster als explorative Typologie kennzeichnen. Für einen betrieblichen Einsatz zusätzliche Zeiträume, Nachfrage-/Bestandsmerkmale und möglichst mehr Stationen verwenden; Einzelstationen gegebenenfalls bewusst als Sonderfälle behandeln.

### 4.4 Das Kampagnengate ignoriert Ein- und Austritte aus der Arbeitsliste

Die bindende Rechnung betrachtet nur Personen, die an beiden Stichtagen in der Arbeitsliste sind. Damit misst sie Maßnahmenwechsel innerhalb der gemeinsamen Population, aber nicht vollständig, wer neu aufgenommen oder ausgeschlossen wird.

Eine unabhängige Union-Auswertung mit einem expliziten Zustand „außerhalb der Arbeitsliste“ ergibt **27,80 %** Wechsel. Die Freigabeentscheidung bleibt zwar gleich, die Kennzahl ist aber näher an der betrieblichen Frage.

**Korrektur:** Für die Auslieferungsstabilität die Vereinigungsmenge beider Arbeitslisten verwenden und Ein-/Austritt als Statuswechsel zählen. Die Schnittmenge kann zusätzlich als reine Maßnahmenstabilität berichtet werden.

### 4.5 Cluster und Regelsegmente unterscheiden sich materiell

Die regelbasierten Segmente weichen bei rund **19,0 %** der aktiven RFM-Population von der clusterbasierten Mehrheitszuordnung ab. Das ist für ein interpretierbares Betriebsprodukt nicht automatisch zu hoch, aber es ist eine eigenständige Modelländerung.

**Korrektur:** Vorab ein Akzeptanzkriterium definieren, Abweichungen je Segment ausweisen und alle nachgelagerten Maßnahmen mit den tatsächlich ausgelieferten Regeln validieren. Alternativ die Regeln offen als eigenständige fachliche Heuristik statt als bloße Übersetzung des Clustering bezeichnen.

### 4.6 Die Freiminutenrechnung ist ein Verhaltens-Counterfactual, kein sicherer Mehrumsatz

Die aktuelle Preisfunktion berücksichtigt Startgebühr, Minutenpreis, Premiumrabatt und Tagesdeckel korrekt. Bei null Freiminuten und ansonsten unverändertem beobachtetem Fahrverhalten ergibt sich eine Differenz von rund **46.077 EUR** beziehungsweise 48 %. Die frühere Formulierung, Rabatt und Deckel seien nicht berücksichtigt, ist deshalb falsch.

Die verbleibende wesentliche Einschränkung ist eine andere: Kundinnen und Kunden würden bei einer Tarifänderung möglicherweise weniger, kürzer oder gar nicht fahren. Die Differenz ist daher kein realisierbarer Mehrumsatz, sondern ein statisches Szenario unter unverändertem Verhalten.

Die Frage, wo Freiminuten „am wenigsten binden“, lässt sich mit den vorhandenen Beobachtungsdaten ebenfalls nicht kausal beantworten.

**Korrektur:** Kennzahl als „statischer tariflicher Gegenwert bei unverändertem Fahrverhalten“ bezeichnen. Wirkung auf Nutzung, Bindung und Abwanderung anschließend kontrolliert oder quasi-experimentell prüfen.

### 4.7 Am früheren Cutoff liegt eine zeitliche Informationsüberschneidung vor

Die Fenster werden über `startzeit < cutoff` gebildet, verwenden aber anschließend Informationen, die erst mit Fahrtende feststehen. Am früheren Cutoff beginnt eine sehr lange Fahrt vor dem Stichtag und endet erst danach. Damit fließt in den früheren Snapshot Information aus der Zukunft ein.

**Korrektur:** Nur abgeschlossene Fahrten mit `endzeit < cutoff` berücksichtigen oder laufende Fahrten explizit ausschließen. Dieselbe Regel muss für alle Cutoffs gelten.

### 4.8 Ausreißerbehandlung ist nicht projektweit konsistent

Im aktuellen Fenster liegen 15 Fahrten über acht Stunden. Sie dominieren die Freiminutendifferenz aufgrund des Tagesdeckels zwar nicht; dennoch werden sie hier einbezogen, während andere Projektanalysen eine Acht-Stunden-Grenze verwenden.

**Korrektur:** Eine projektweite fachliche Definition für gültige Fahrten festlegen und eine Sensitivität mit und ohne Langfahrten berichten. Ausschlüsse nicht allein statistisch, sondern anhand des Nutzungsszenarios begründen.

### 4.9 Kurze Kundenhistorien bleiben ein echtes Problem

510 aktive RFM-Personen besitzen weniger als 365 Tage mögliche Beobachtung. Bei einer einfachen Expositionsanpassung würden 165 dieser Personen, also 32,4 % dieser Teilgruppe, die Regelklasse wechseln. Eine Hochrechnung ist nicht automatisch die richtige Lösung; sie zeigt aber die Empfindlichkeit.

**Korrektur:** Mindestbeobachtungsdauer als Gate beibehalten, neue Kundschaft separat behandeln und die Regeln prospektiv über mehrere Cutoffs validieren. Keine Jahresinterpretation für unvollständig exponierte Personen verwenden.

### 4.10 Personenbezogene Exportdatei trotz fehlender Freigabe vermeiden

Der Exportkopf sagt korrekt „nicht versenden“, die Datei enthält aber dennoch rund 3.012 aktive Konten mit zugeordneten Maßnahmen. Solange Rechtsgrundlage, Einwilligung und technische Freigabe fehlen, ist ein vollständig handlungsfähiger Personenexport unnötig riskant.

**Korrektur:** Bei geschlossenem Gesamtgate nur einen aggregierten Prüfbericht oder ein leeres Freigabemanifest erzeugen. Die pseudonymisierte Analyse kann getrennt gespeichert werden; der personenbezogene Aktionsbestand sollte erst nach grünen Gates entstehen.

## 5. Sprachliche Qualität, Verständlichkeit und Lesbarkeit

### Positiv

- Der Aufbau von Forschungsfrage über Exploration und Modellierung bis zu Produktregeln und Gates ist grundsätzlich nachvollziehbar.
- Einschränkungen werden häufiger offen genannt als in den früheren Fassungen.
- Tabellen und Zwischenüberschriften erleichtern die Orientierung.
- Die Trennung von analytischem Ergebnis und Betriebsfreigabe ist sprachlich deutlich verbessert.

### Kritisch

Die derzeit größte sprachliche Schwäche ist nicht Stil, sondern **Wahrheitskonsistenz**. Alte Ergebnisprosa steht neben neuen Ausgaben. Dadurch liest sich das Notebook flüssig, vermittelt aber an mehreren Stellen sachlich falsche Sicherheit.

Besonders problematisch sind:

- definitive Formulierungen wie „bestätigt“, „stabil“ oder „höchster Wert“, obwohl die aktuelle Ausgabe etwas anderes zeigt;
- Ergebniszahlen, die manuell in Markdown wiederholt werden;
- wechselnde Bezugsobjekte: Cluster, Regelgruppen und Kampagnensegmente werden teilweise gleich behandelt;
- unterschiedliche Werte für dasselbe Gate;
- Begriffe wie „Listenwert“, obwohl die Funktion tatsächlich weitere Tarifregeln berücksichtigt;
- eine Geschäftsempfehlung, die von einer nicht mehr vorhandenen Clusterstruktur ausgeht.

**Redaktionelle Leitlinie:** Jede Ergebnisbehauptung muss unmittelbar auf eine aktuell erzeugte Tabelle oder Variable zurückgehen. Markdown sollte Methode, Bedeutung und Grenzen erklären, aber keine leicht veraltenden Zahlen duplizieren. Vor Abgabe ist ein vollständiger „Restart & Run all“-Lauf mit anschließendem Lesen ausschließlich der sichtbaren Endfassung erforderlich.

## 6. Beurteilung der Forschungsfragen

### Stationsclustering

Die Frage ist als explorative Typisierung sinnvoll: Welche Stationen besitzen ähnliche zeitliche Nutzungsmuster? Für eine operative Umverteilungsentscheidung ist sie allein nicht ausreichend. Außerdem muss zunächst geklärt werden, ob k=4 trotz besserer k=5-Silhouette fachlich gewünscht ist und wie die Merkmalsblöcke gewichtet werden sollen.

### Kundenclustering

Auch diese Frage ist explorativ sinnvoll: Welche Nutzungs- und Wertmuster treten im RFM-Raum auf? Das Notebook sollte jedoch klarer zwischen drei Ebenen trennen:

1. datengetriebene Cluster als Exploration,
2. feste Regeln als interpretierbares Produkt,
3. Kampagnenwirkung als später kausal zu prüfende Maßnahme.

Die Freiminutengeschichte ist in der aktuellen Datenlage bei den Regelgruppen plausibel, nicht bei den ursprünglichen Clustern. Diese Verschiebung muss transparent dargestellt werden.

## 7. Priorisierte To-do-Liste

### P0 – zwingend vor Lehr-/Abgabefreigabe

- [ ] Standard-Datenpfad reparieren und in der vorgesehenen Startumgebung testen.
- [ ] Lokale, GitHub- und Colab-Fassung synchronisieren; README-Kennzahlen aktualisieren.
- [ ] Sämtliche Stationsprofile aus dem aktuellen Lauf neu schreiben.
- [ ] k-Auswahl korrekt begründen; nicht mehr behaupten, k=4 habe die höchste Silhouette.
- [ ] Falsche 100-%-Generatorübereinstimmung entfernen und geeignetes labelinvariantes Maß berichten.
- [ ] Kunden-Preisgeschichte entweder auf Regelsegmente umstellen oder aus dem Clusterkapitel entfernen.
- [ ] Alle alten Gatewerte, Silhouetten, Fallzahlen, Clustergrößen und Stabilitätsaussagen bereinigen.
- [ ] Schlusszellen ausschließlich aus den tatsächlich bindenden Variablen erzeugen.
- [ ] Notebook vollständig neu starten, ausführen und danach alle Texte gegen die sichtbaren Ausgaben lesen.

### P1 – für eine methodisch starke Endfassung

- [ ] Gemeinsame Feature-Pipeline für Stationshauptmodell und zeitliche Stabilitätsprüfung verwenden.
- [ ] Sensitivität gegenüber k und Merkmalsblock-Gewichtung dokumentieren.
- [ ] Stationscluster wegen n=10 ausdrücklich als explorativ einordnen.
- [ ] Kampagnenstabilität zusätzlich über die Vereinigungsmenge inklusive Ein-/Austritten messen.
- [ ] Abweichung zwischen Clustern und Regeln mit Akzeptanzkriterium versehen.
- [ ] Frühere Cutoffs nur mit bis dahin beendeten Fahrten bilden.
- [ ] Freiminutendifferenz korrekt als statisches Gegenfaktum beschreiben; kausale Wirkung separat testen.
- [ ] Ausreißerdefinition projektweit vereinheitlichen.
- [ ] Beobachtungsdauer prospektiv absichern und neue Kundschaft separat behandeln.
- [ ] Bei geschlossenen Gates keinen personenweisen Aktionsbestand erzeugen.

### P2 – Qualität und Wartbarkeit

- [ ] Daten- und Notebookversion im Ergebnisartefakt unveränderlich dokumentieren.
- [ ] Ergebniszahlen möglichst programmatisch in Tabellen statt manuell in Markdown ausgeben.
- [ ] Automatische Plausibilitätsprüfungen ergänzen, etwa für Gatevariable, Segmentnamen, Summen und Cutofflogik.
- [ ] Eine kompakte Freigabetabelle am Ende aus genau einer zentralen Ergebnisstruktur rendern.

## 8. Abschließende Güteeinschätzung

| Dimension | Einschätzung |
|---|---:|
| Methodische Grundkonzeption | **8/10** |
| Technische Reproduzierbarkeit der aktuellen Datei | **5/10** |
| Konsistenz von Ergebnissen und Aussagen | **5/10** |
| Sprachliche Verständlichkeit | **6/10** |
| Betriebliche Governance | **8/10** |
| Gesamtstand dieser konkreten Fassung | **6,5/10** |

## Schlussentscheidung

**Nein, die vorliegende Fassung ist noch nicht freigabefähig.**

Das Notebook besitzt inzwischen eine gute methodische Architektur und eine erfreulich vorsichtige Freigabelogik. Die aktuellen Defizite sind jedoch wesentlich: Die Datei startet ohne manuellen Datenpfad nicht, die verlinkte veröffentlichte Fassung ist nicht synchron, und mehrere tragende Interpretationen widersprechen den neu berechneten Ergebnissen.

Nach Abarbeitung der P0-Liste kann daraus eine **starke, nachvollziehbare Lehr- und Analysefassung** werden. Eine reale Stationssteuerung oder Marketingkampagne bleibt auch dann erst nach zusätzlichen Daten, prospektiver Validierung sowie rechtlicher und technischer Freigabe vertretbar.
