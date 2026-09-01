# Erneuter analytischer, methodischer und sprachlicher Review

## Notebook 02 – Klassifikation des Wartungsrisikos

**Geprüfte Datei:** `02_Klassifikation_Wartungsrisiko.ipynb`  
**Prüfdatum:** 02.09.2026  
**SHA-256:** `e24c6e811cdad6438c5a8bc2795b5effc19aebf11ee913f37ed5e5cc6ac4aa01`  
**Aufbau:** 48 Zellen, davon 18 Code- und 30 Markdownzellen  
**Versionierter Datenstand:** Git-Commit `316b3db6532966693909430503b3ba597077754f`

## Kurzurteil

Die neue Fassung ist technisch und redaktionell deutlich weiter als der zuletzt geprüfte Stand:

- Der Standard-Datenpfad ist repariert und verweist auf einen unveränderlichen Commit.
- Das Notebook läuft ohne gesetzte Sondervariable vollständig durch.
- Lokale Datei, GitHub-Notebook und Colab-Ziel sind jetzt synchron.
- Wilson-Intervalle und das daraus abgeleitete Codeurteil werden korrekt berechnet.
- Die zentralen aktuellen Resultate – 52 gegen 51 Treffer im Test sowie 180 gegen 159 in der rollierenden Validierung – stehen inzwischen in großen Teilen des Textes richtig.

**Trotzdem ist die konkrete Fassung noch nicht endgültig freigabefähig.** Zwei Punkte sind dafür entscheidend:

1. Der im selben Datenstand enthaltene Generator widerspricht der zentralen Lehrgeschichte: Er setzt seinen internen Verschleißzustand unmittelbar nach der Schadensmeldung zurück, nicht zum späteren Abschluss der Reparatur. Das Notebook und die README behaupten dagegen einen Reset bei erledigter Reparatur.
2. Mehrere prominente Texte sind weiterhin veraltet oder widersprechen der aktuellen Rechnung – darunter ausgerechnet das Urteil zur 70-%-Hürde und die abschließenden Merksätze.

Für eine reale Werkstattfreigabe fehlen außerdem weiterhin ein prospektiver Schattenlauf, eine maßnahmennahe Zieldefinition, die Behandlung von Ausmusterung als Zensierung sowie eine belastbare Kosten- und Wirksamkeitsmessung.

## Freigabeampel

| Verwendungszweck | Urteil | Begründung |
|---|---|---|
| technische Standardausführung | **Grün** | 18 von 18 Codezellen liefen ohne `VELO_BASIS` und ohne Fehler |
| GitHub-/Colab-Synchronität | **Grün** | lokale und veröffentlichte Notebookdatei besitzen denselben SHA-256-Wert |
| analytischer Lehrprototyp | **Gelb-Grün** | sehr gute Grundstruktur, aber noch widersprüchliche Kernaussagen |
| endgültige Lehr-/Abgabefassung | **Noch nicht freigeben** | Generatorwahrheit, K1b-Logik und Schlusskapitel müssen korrigiert werden |
| prospektiver Schattenbetrieb | **Noch nicht freigabefähig** | exportiert wird eine historische Testliste statt einer aktuellen Schattenliste |
| reale Werkstattsteuerung | **Rot** | künstliche Daten, breites Label, unvollständige Kosten-/Wirkungslogik und keine prospektive Bestätigung |

## 1. Technische und reproduktive Prüfung

### 1.1 Frische Gesamtausführung

Die hochgeladene Datei wurde ohne gesetzte Umgebungsvariable frisch ausgeführt. Der im Notebook eingebaute GitHub-Pfad funktionierte.

| Prüfung | Ergebnis |
|---|---:|
| Codezellen | 18 |
| frisch ausgeführt | 18 von 18 |
| Zellfehler | 0 |
| Räder | 350 |
| Schadensmeldungen | 1.425 |
| Wartungsaufträge | 1.425 |
| Fahrten | 107.297 |
| abgeschlossene Fahrten nach Acht-Stunden-Filter | 104.334 |
| Panelzeilen | 2.024 |
| Stichtage | 8 |

Der frühere P0-Fehler des beschädigten Standardpfads ist damit behoben.

### 1.2 Veröffentlichte Fassung

Die lokale Datei und das [Notebook im GitHub-Hauptzweig](https://github.com/swrobuts/velocity-fallstudie/blob/main/analytics/notebooks/02_Klassifikation_Wartungsrisiko.ipynb) waren am Prüfdatum bytegenau identisch: 48 Zellen, 18 Codezellen und derselbe SHA-256-Wert. Auch die [Analytics-README](https://github.com/swrobuts/velocity-fallstudie/blob/main/analytics/README.md) nennt inzwischen den aktuellen Umfang von 350 Rädern, 107.297 Fahrten und 1.425 Schadensmeldungen.

Damit sind die früheren Synchronisationsmängel von GitHub, Colab, Notebook und README weitgehend behoben.

## 2. Frisch reproduzierte Kernergebnisse

### 2.1 Testquartal

Der letzte vollständig beobachtbare historische Stichtag ist der 26.05.2026. Sein Zielzeitraum reicht bis zum 24.08.2026.

| Verfahren | Treffer in Top 60 | Precision@60 | Recall@60 | Szenariokosten |
|---|---:|---:|---:|---:|
| ältestes Rad zuerst | 28 | 46,7 % | 22,0 % | 18.620 EUR |
| meiste Kilometer insgesamt | 35 | 58,3 % | 27,6 % | 17.185 EUR |
| Kilometer seit erledigter Reparatur | **52** | **86,7 %** | **40,9 %** | **13.700 EUR** |
| Entscheidungsbaum | 43 | 71,7 % | 33,9 % | 15.545 EUR |
| Random Forest | 51 | 85,0 % | 40,2 % | 13.905 EUR |

Die Fachregel liegt im Test um genau einen Treffer beziehungsweise 205 EUR Szenariokosten vor dem Forest. Das ist kein statistisch überzeugender Einzelperiodenvorsprung, wohl aber ein klarer Befund, dass der Forest die starke Regel nicht schlägt.

Die Top-60-Listen überschneiden sich bei 47 Rädern. Je 13 Räder stehen nur auf einer der beiden Listen; die symmetrische Differenz umfasst damit 26 Räder. An der Top-60-Grenze besteht bei der Fachregel kein Wertgleichstand.

### 2.2 Rollierende Validierung

| Stichtag | Grundrate | Treffer Forest | Treffer Regel | Forest-Vorteil laut Szenario |
|---|---:|---:|---:|---:|
| 02.03.2025 | 38,7 % | 39 | 45 | −1.230 EUR |
| 31.05.2025 | 49,0 % | 45 | 47 | −410 EUR |
| 29.08.2025 | 27,8 % | 31 | 31 | 0 EUR |
| 27.11.2025 | 16,1 % | 18 | 25 | −1.435 EUR |
| 25.02.2026 | 30,2 % | 26 | 32 | −1.230 EUR |
| **Summe** |  | **159** | **180** | **−4.305 EUR** |

Der Forest ist in keinem der fünf Validierungsquartale besser, einmal gleichauf und viermal schlechter. **Für das derzeit definierte breite Ziel „irgendeine Schadensmeldung“ ist die Entscheidung zugunsten der Fachregel daher plausibel.**

### 2.3 Unsicherheit der 70-%-Hürde

| Verfahren | Treffer | Punktschätzer | 95-%-Wilson-Intervall | Untergrenze ≥ 70 % |
|---|---:|---:|---:|---|
| Fachregel | 52 von 60 | 86,7 % | 75,8–93,1 % | **ja** |
| Random Forest | 51 von 60 | 85,0 % | 73,9–91,9 % | **ja** |

Der Code leitet das Urteil jetzt korrekt aus den Intervallen ab. Beide Untergrenzen liegen oberhalb von 70 %. Dieser rechnerische Befund ist wegen der bereits mehrfach angesehenen historischen Testperiode **kein unabhängiger Produktivnachweis**.

## 3. Erfolgreich behobene frühere Kritikpunkte

| früherer Punkt | aktueller Stand |
|---|---|
| beschädigter Standardpfad | **behoben** |
| veränderlicher Datenpfad auf `main` | **behoben; fester Commit** |
| lokale und veröffentlichte Fassung unterschiedlich | **behoben** |
| README mit altem Datenumfang | **behoben** |
| Wilson-Code druckt unabhängig vom Ergebnis ein falsches Urteil | **im Code behoben** |
| 60 Prüfungen fälschlich als fünf pro Werktag bezeichnet | **behoben; etwa 4,6 pro Woche** |
| veraltete Korrelation und Grundraten | **in den Hauptabschnitten aktualisiert** |
| Testresultat fälschlich als Gleichstand dargestellt | **in großen Teilen auf 52 gegen 51 aktualisiert** |
| Modell und Exportverfahren widersprechen einander | **weiterhin durch Assertion abgesichert** |
| offene Schäden in Vorsorgeliste | **ausgeschlossen** |
| Reset bei erledigter Reparatur in der Featurelogik | **im Notebookcode korrekt umgesetzt** |
| Ausreißer und Distanzquellen | **transparent behandelt und gegengeprüft** |
| rollierende Validierung | **vorhanden und für die Entscheidung maßgeblich** |
| Modellscore als Wahrscheinlichkeit im Werkstattexport | **nicht enthalten** |
| Rückkopplung der Intervention | **fachlich gut erklärt** |

Diese Fortschritte sind substanziell. Der verbleibende Freigabestopp entsteht nicht mehr durch technische Nichtausführbarkeit, sondern durch fachliche Konsistenz und Betriebslogik.

## 4. P0-Mängel – vor einer endgültigen Lehr-/Abgabefreigabe beheben

### P0.1 Der Datengenerator widerspricht dem behaupteten Reparaturzeitpunkt

Der im versionierten Datenstand enthaltene [Generator](https://github.com/swrobuts/velocity-fallstudie/blob/316b3db6532966693909430503b3ba597077754f/analytics/generieren.py#L1315-L1359) berechnet zunächst den späteren Zeitpunkt `erledigt`, setzt die interne Variable `km_seit_wartung` aber unmittelbar nach dem Anlegen der Meldung und des Auftrags zurück:

```python
km_seit_wartung *= random.uniform(0.05, 0.25)
```

Der Reset wird nicht bis `erledigt` verzögert. Die nächsten Fahrten nach der Meldung laufen deshalb generatorintern bereits mit reduziertem Verschleißzustand, obwohl die Reparatur laut CSV noch nicht abgeschlossen ist. Das ist besonders relevant, weil das Notebook selbst 2.489 Fahrten zwischen Meldung und erledigter Reparatur nachweist.

Demgegenüber behaupten Notebook und README, der Verschleiß wachse seit der **letzten erledigten Reparatur** und falle danach zurück. Diese drei Ebenen passen somit nicht zusammen:

1. behauptete fachliche Welt: Reset bei erledigter Reparatur,
2. Notebookfeature: Reset bei erledigter Reparatur,
3. synthetische Generatorwahrheit: Reset unmittelbar nach Meldung.

Das trifft die zentrale Lehrgeschichte des Notebooks. Gerade der Wechsel von Meldungs- zu Reparaturreset wird als Erklärung dafür verwendet, warum der frühere Modellvorteil verschwunden sei.

Eine unabhängige Ablation auf dem aktuellen Datenstand zeigt jedoch nur einen kleinen Unterschied:

| Regelvariante | fünf Validierungsquartale | Testquartal |
|---|---:|---:|
| Kilometer seit letzter Meldung | 178 Treffer | 52 Treffer |
| Kilometer seit erledigter Reparatur | 180 Treffer | 52 Treffer |

Damit lässt sich der starke historische Sprung nicht allein dem Resetzeitpunkt zuschreiben. Zwischen den Fassungen wurden auch Daten, Distanzlogik und Ausreißerbehandlung verändert.

**Abhilfe:** Den Generator so ändern, dass der Verschleißzustand erst am tatsächlichen Reparaturabschluss zurückgesetzt wird. Danach Daten neu erzeugen und alle Notebooks/READMEs neu rechnen. Zusätzlich beide Resetvarianten auf demselben Datenstand als explizite Ablation vergleichen. Falls der Generator unverändert bleiben soll, muss die Lehrgeschichte an die tatsächliche synthetische Logik angepasst werden.

### P0.2 Der Text zur Wilson-Hürde behauptet weiterhin das Gegenteil der Rechnung

Unmittelbar nach der korrekt gerechneten Tabelle steht weiterhin:

> „Die 70-Prozent-Hürde ist damit nicht belegt, sondern nur nicht widerlegt.“

Das ist beim aktuellen Ergebnis falsch. Die Untergrenzen betragen 75,8 % und 73,9 %; nach der im Notebook selbst definierten K1b-Regel ist die Hürde für beide Verfahren statistisch gestützt.

Spätere Abschnitte und die Schlussübersicht sagen wiederum korrekt, dass beide Verfahren die Hürde belegen. Die Datei enthält damit zwei entgegengesetzte Urteile.

**Abhilfe:** Den gesamten Markdownabschnitt nach der Wilson-Ausgabe neu formulieren. Ergebnisabhängige Urteile sollten aus derselben Ergebnisstruktur erzeugt oder beim Notebookbau automatisch geprüft werden.

### P0.3 K1b wird angezeigt, aber nicht in der Auswahlentscheidung verwendet

Der Text erklärt, dass K1b für einen realen Einsatz das richtige Kriterium sei. Die Programmlogik speichert in `urteile` jedoch nur:

```python
(Ergebnis, K1a, K2, K3)
```

K1b wird gedruckt, fehlt aber in `alle_drei` und beeinflusst somit `ausgeliefertes_verfahren` nicht. Im aktuellen Lauf ändert das die Entscheidung nicht, weil K1b für beide Kandidaten erfüllt ist. Als wiederverwendbares Freigabegate ist es dennoch falsch verdrahtet: Bei einem späteren Datenstand könnte ein Verfahren trotz gerissenem K1b ausgeliefert werden.

Zudem führt `min(alle_drei, ...)` bei vollständig gerissenen Gates zu einem Laufzeitfehler, statt einen expliziten Zustand „keine Freigabe“ zu erzeugen.

**Abhilfe:** Lehr- und Produktivgate ausdrücklich trennen. Für Produktivfreigabe K1b tatsächlich in die boolesche Entscheidung aufnehmen. Falls kein Kandidat alle Pflichtgates erfüllt, kontrolliert `KEINE_FREIGABE` setzen und keinen Aktionsbestand schreiben.

### P0.4 Prominente Schlussaussagen enthalten noch alte Werte

Im Schlusskapitel und in Deploymenttexten stehen unter anderem:

| Aussage | aktueller Befund |
|---|---|
| „Sieben von zehn geprüften Rädern“ | **8,7 von zehn** |
| 102 auffällige Räder, davon ein Drittel fahruntauglich | **127** auffällige Testräder; **61** davon in derselben Testpopulation fahruntauglich, also 48,0 % |
| 63 fahruntaugliche Räder von 127 | 63 zählt auch Räder außerhalb der Testpopulation; populationskonsistent sind **61** |
| Trefferquote auf dem Test „gleich“ | 52 gegen 51; besser „praktisch gleich, Regel +1“ |
| Validierung „leicht“ zugunsten der Regel | 180 gegen 159 und vier von fünf Quartalen; das ist im Szenario deutlich |
| Listen unterscheiden sich bei 17 von 60 Rädern | aktuell 47 gemeinsam, je 13 exklusiv; symmetrische Differenz 26 |
| Beispiel „seit 592 km“ | höchster aktueller Listenwert **484 km** |
| einzelner Stichtag ergebe 228 Zeilen | letzter Stichtag aktuell **225** Zeilen |

Diese Werte stehen auch noch in der aktuellen [Notebook-Bauquelle](https://github.com/swrobuts/velocity-fallstudie/blob/main/analytics/bau/nb02_klassifikation.py). Eine manuelle Korrektur nur im `.ipynb` würde daher beim nächsten Build wieder verloren gehen.

**Abhilfe:** Zuerst die Bauquelle korrigieren, dann das Notebook neu erzeugen und mit einem automatischen Konsistenztest auf verbotene Altwerte prüfen.

### P0.5 Die „Deploymentliste“ ist in Wahrheit eine historische Testliste

Der Datenstand endet am 24.08.2026. Exportiert werden aber die Top 60 des Stichtags 26.05.2026, deren 90-Tage-Ausgang bereits bekannt ist und gerade zur Evaluation verwendet wurde. Die Datei ist daher keine aktuelle Werkstatt- oder Schattenliste, sondern ein retrospektives Testartefakt.

Das Notebook benennt zwar offen, dass kein echter Schattenbetrieb vorliegt. Trotzdem heißen Ausgabe und Datei `WARTUNGSLISTE` beziehungsweise `wartungsliste.csv` und werden im Deploymentkapitel wie ein Betriebsprodukt behandelt.

**Abhilfe:** Zwei Artefakte sauber trennen:

1. `testliste_historisch_2026-05-26.csv` – nur zur Evaluation, mit bekanntem Ausgang;
2. `schattenliste_2026-08-24.csv` – aktueller Snapshot ohne verfügbare Zukunftslabels, ausdrücklich nicht handlungsleitend.

Der Schattenbestand darf erst nach Ablauf des Folgequartals bewertet werden. Ein realer Aktionsbestand entsteht erst nach den definierten Betriebs-, Daten- und Rechtsfreigaben.

## 5. P1-Mängel – methodisch vor einem belastbaren Praxiseinsatz verbessern

### P1.1 Die breite Zielvariable entscheidet den Modellvergleich

Vorhergesagt wird irgendeine Schadensmeldung. Im Test haben 127 Testräder mindestens eine Meldung; 61 davon haben innerhalb derselben Prognosepopulation mindestens eine Meldung der Stufe `fahruntauglich`.

Eine unabhängige Gegenrechnung für genau diese schwere Teilzielgröße ergibt:

| Top-60-Rangfolge | fahruntaugliche Treffer | Precision@60 | Recall der 61 schweren Fälle |
|---|---:|---:|---:|
| Fachregel | 33 | 55,0 % | 54,1 % |
| Random Forest | **35** | **58,3 %** | **57,4 %** |

Das ist kein Beleg für eine Forestfreigabe – es ist nur ein Testquartal und der Forest wurde nicht speziell auf schwere Fälle trainiert. Es zeigt aber, dass sich die Verfahrensrangfolge mit der fachlichen Zieldefinition umkehrt. Die pauschale Aussage „das Modell bringt keinen Mehrwert“ gilt somit nur für das breite Any-Report-Label und die derzeitige Einheitskostenmatrix.

**Abhilfe:** Gemeinsam mit der Werkstatt definieren, welche Schäden durch eine Vorsorgeprüfung erkennbar und vermeidbar sind. Danach Label und Nutzenfunktion auf Schwere, Kategorie und Vermeidbarkeit ausrichten und alle Modelle neu validieren.

### P1.2 Die Schweregrad-Gegenrechnung verwendet einen zu breiten Zähler

Der Code zählt 63 einzigartige fahruntaugliche Räder im gesamten Zukunftsfenster und teilt durch 127 positive Räder der gefilterten Testpopulation. Zwei der 63 Räder gehören jedoch nicht zu dieser Testpopulation. Populationskonsistent sind 61 von 127 beziehungsweise 48,0 %.

**Abhilfe:** Jede deskriptive Teilzielgröße explizit auf `test_zeilen.fahrrad_id` beziehungsweise den zugehörigen positiven Testbestand einschränken.

### P1.3 Ausmusterung verkürzt die Beobachtungszeit

27 der 225 Testräder werden innerhalb des 90-Tage-Horizonts ausgemustert. Neun davon erhalten vorher ein positives Label, 18 werden als negativ behandelt, obwohl sie nicht das volle Quartal unter Risiko stehen.

**Abhilfe:** Ausmusterung als konkurrierendes Ereignis beziehungsweise Zensierung behandeln, eine Mindestbeobachtungsdauer definieren oder ein zeitabhängiges Ereignismodell verwenden. Mindestens muss eine Sensitivitätsanalyse ohne unvollständig beobachtete Negativfälle gezeigt werden.

### P1.4 Zeitlicher Split bedeutet nicht „ungesehene Fahrräder“

197 der 225 Testräder kommen bereits in früheren Trainingssnapshots vor. Das ist für die Frage „Wie priorisieren wir die bestehende Flotte?“ grundsätzlich legitim. Der zeitliche Split verhindert Zukunftsleckage, aber nicht die Wiederholung derselben Entitäten.

Der Text behauptet dagegen sinngemäß, der Zeitsplit verhindere, dass das Modell das Rad bereits gesehen habe. Das ist zu weitgehend. Da keine Fahrrad-ID als Merkmal verwendet wird, liegt kein direktes ID-Memorisieren vor; die Zeilen sind dennoch abhängig.

**Abhilfe:** Formulieren: „Der Split trennt nach Informationszeitpunkt, nicht nach Fahrrädern.“ Für Aussagen zu neuen Fahrrädern zusätzlich eine gruppierte Holdoutprüfung auf bisher ungesehenen Rädern durchführen.

### P1.5 Mehrere Meldungen pro Rad werden in der Kostenlogik zusammengezogen

Im Testfenster entstehen 137 Meldungen auf 127 positive Testräder. Zehn Räder melden sich zweimal. Das binäre Label und die Kostenformel zählen jedes Rad höchstens einmal.

Das kann zur Werkstattentscheidung passen, wenn eine einzige Prüfung alle Folgemeldungen verhindert. Genau diese Wirkung ist aber nicht belegt.

**Abhilfe:** Festlegen, ob die Entscheidung den ersten Schaden, die Anzahl der Schäden, Ausfalltage oder vermiedene Kosten optimieren soll. Bei wiederholten Ereignissen gegebenenfalls Count-/Survivalansatz oder ereignisbezogene Nutzenfunktion verwenden.

### P1.6 Die Kapazitätsaussagen gehen weiter als die eigene Kostenanalyse erlaubt

Das Notebook sagt, 60 Prüfungen seien im November Verschwendung und im Mai zu wenig. Später erklärt es korrekt, dass die vorhandene Kostenformel die optimale Kapazität gerade nicht bestimmen kann, weil Kosten erfolgreicher Prüfungen und Maßnahmenwirksamkeit fehlen.

**Abhilfe:** Früher vorsichtiger formulieren: Die feste Kapazität erzeugt je Saison andere Precision-/Recall-Verhältnisse; ob sie zu hoch oder zu niedrig ist, muss mit vollständigen Kosten und Vermeidungseffekten entschieden werden.

### P1.7 Nur eine Forestkonfiguration wird geprüft

Das Notebook formuliert inzwischen erfreulich präzise, dass kein Vorteil für **diese** Merkmalsmenge, Waldkonfiguration und fünf Perioden gezeigt ist. Die Parameter und das Klassengewicht 7,2 wurden aber nicht auf den Validierungsquartalen gegen Precision@60 ausgewählt.

**Abhilfe:** Einen kleinen, vorab definierten Suchraum ausschließlich auf den rollierenden Validierungsquartalen untersuchen. Der historische Test bleibt danach unberührt. Falls dies wegen früherer Iterationen nicht mehr möglich ist, die Modellwahl einfrieren und prospektiv testen.

### P1.8 Vorverarbeitung und unbekannte Kategorien sind nicht gekapselt

`pd.get_dummies` wird einmal auf dem gesamten Panel ausgeführt. Bei den drei bekannten Typcodes ist das aktuell stabil und erzeugt keine Zielinformation; eine produktive Pipeline kann mit neuen Typen oder fehlenden Spalten jedoch nicht zuverlässig umgehen.

Auch `tage_seit_reparatur = 9999` ist ein wirksamer, aber semantisch grober Sentinel. Im Test betrifft er 43 Räder, drei davon stehen in der Top-60-Regelliste.

**Abhilfe:** Für das Forschungsmodell eine trainierte `Pipeline` mit expliziter Kategorienbehandlung verwenden. Reparaturhistorie als eigenes boolesches Merkmal modellieren und Zeitwerte sachlich imputieren.

### P1.9 Export und Modellpaket enthalten zu wenig Betriebsmetadaten

Die CSV enthält Rang, Rahmennummer, Typ und erklärende Merkmale. Es fehlen jedoch unter anderem:

- Datenstand und Input-Hashes,
- Stichtag und Gültigkeitsende als strukturierte Felder,
- Regelversion,
- Freigabestatus,
- Kennzeichnung `HISTORISCHER_TEST` oder `SCHATTENBETRIEB`,
- verantwortliche Prüfinstanz.

Das Joblib-Paket enthält den nicht ausgelieferten Forest, aber nicht die vollständige Featureerzeugung als ausführbare Pipeline. Ein binäres Modellobjekt ist außerdem kein guter Revisionsnachweis für die fachliche Entscheidung.

**Abhilfe:** Regelmanifest, historische Evaluation, Schattenliste und Forschungsmodell als getrennte Artefakte speichern. Das Regelmanifest muss Berechnungslogik, Versionen, Eingabeprüfungen und Freigabestatus enthalten.

### P1.10 Monitoring braucht messbare Schwellen

Der Monitoringabschnitt ist fachlich stark, verwendet aber teilweise Formulierungen wie „steigt deutlich“ oder „steigt stark“. Für einen Betrieb sind solche Grenzen nicht entscheidbar.

**Abhilfe:** Referenzfenster, Warn-/Stoppschwellen, Mindestfallzahl, Verantwortliche und konkrete Reaktion je Kennzahl definieren. Precision/Lift nur mit Unsicherheit und – nach Aktivierung der Maßnahme – zusammen mit Kontrollgruppe oder geeignetem Wirkungsdesign interpretieren.

## 6. Weitere methodische Beobachtungen

- An keinem der acht Stichtage kreuzt im aktuellen gefilterten Datensatz eine Fahrt den Cutoff. Die Featurelogik verwendet dennoch `startzeit <= stichtag`; eine Assertion oder `endzeit <= stichtag` würde die zeitliche Sauberkeit für spätere Datenstände absichern.
- Die Distanzprüfung zeigt eine mittlere absolute Abweichung von 0,47 km für die Routenmatrix und 0,92 km für Dauer × Tempo. Das ist ein guter Befund, beweist aber nicht, dass Fahrten mit Messwert repräsentativ für Fahrten ohne Messwert sind.
- Der Generator baut den Hauptprädiktor absichtlich in die Schadensentstehung ein. Die sehr hohe Korrelation und Regelgüte sind daher Demonstrationsresultate, keine Evidenz für reale Flotten.
- Der Forest-Score liegt im Mittel bei 58,5 %, die Testgrundrate bei 56,4 %. Die Aussage, das Modell sei am Mai-Stichtag „systematisch zu zurückhaltend“, wird dadurch nicht getragen; wegen des starken Klassengewichts ist der Score ohnehin nicht kalibriert.
- Die aktuell verwendeten Zeitfenster überlappen sich in ihren Rückblicken, und dieselben Räder kommen wiederholt vor. Quartalssummen sind deshalb nicht als unabhängige 300 Einzelbeobachtungen zu behandeln.

## 7. Sprachliche, didaktische und inhaltliche Qualität

### Stärken

- Die Geschäftsfrage ist konkret und leicht verständlich.
- Leakage, Baselines, Precision, Recall, Kostenasymmetrie und Rückkopplung werden anschaulich erklärt.
- Die Entscheidung gegen ein komplexeres Modell wird als legitimes Analyseergebnis dargestellt.
- Die Grenzen künstlicher Daten und der Szenariokosten werden prominent benannt.
- Die Erklärung, warum eine scheinbar einfache Regel eine anspruchsvolle Featurelogik benötigt, ist sehr gelungen.
- Der Abschnitt zu Schattenbetrieb und Kontrollgruppe gehört zu den stärksten Teilen des Notebooks.

### Schwächen

Die Sprache ist engagiert und gut lesbar, wird aber an mehreren Stellen zu absolut:

- „Der Wald hat die Regel gefunden – mehr aber auch nicht“ ist stärker als die Evidenz. Die Listen unterscheiden sich bei 26 Rädern, und für schwere Schäden liegt der Forest im Test sogar knapp vorn.
- „Kein einziger Rechenschritt Unterschied“ unterschätzt die erheblich komplexere Datenintegration für Kilometer seit Reparatur.
- „Gleichstand“ ist bei 52 gegen 51 nur als „praktisch gleich“ vertretbar.
- „60 Prüfungen sind im November Verschwendung“ ist ohne vollständiges Kostenmodell nicht belegt.
- Die Aussage zur systematischen Zurückhaltung im Mai wird von den ausgegebenen Scores nicht bestätigt.

Die wichtigste redaktionelle Regel lautet daher: **prägnante Lehrsätze erst dann formulieren, wenn Bezugsgröße, Population und Gegenrechnung exakt stimmen.** Gerade gut merkbare Sätze sind problematisch, wenn sie den aktuellen Zahlen widersprechen.

## 8. Beurteilung der Forschungs- und Geschäftsfrage

Die Frage „Welche 60 Räder soll die Werkstatt im nächsten Quartal vorsorglich prüfen?“ ist **sinnvoll, konkret und entscheidungsnah**. Methodisch handelt es sich zwar um eine binäre Klassifikation, betrieblich aber vor allem um ein **Top-k-Ranking unter Kapazitätsgrenze**. Precision@60, Recall@60, Lift gegenüber Baselines und maßnahmenbezogene Kosten sind deshalb passender als eine allgemeine Accuracy.

Für die Lehre ist die Frage sehr gut geeignet. Für die Praxis muss sie enger werden:

> Welche 60 aktuell einsatzfähigen Räder besitzen in den nächsten 90 Tagen das höchste Risiko für einen durch die geplante Vorsorgeprüfung erkennbaren und vermeidbaren Schaden, gewichtet nach Schadensschwere, Ausfallkosten und vollständiger Beobachtungszeit?

Diese Formulierung verbindet Vorhersage, Maßnahme und wirtschaftlichen Nutzen wesentlich sauberer.

## 9. Priorisierte To-do-Liste

### P0 – vor endgültiger Lehr-/Abgabefreigabe

- [ ] Generatorreset auf den tatsächlichen Reparaturabschluss umstellen oder Lehrgeschichte an die reale Generatorlogik anpassen.
- [ ] Daten danach neu erzeugen und sämtliche abhängigen Notebooks/READMEs neu ausführen.
- [ ] Resetzeitpunkt als explizite Ablation auf demselben Datenstand zeigen.
- [ ] Falschen Wilson-Markdowntext korrigieren.
- [ ] K1b in das Produktivgate aufnehmen und einen kontrollierten `KEINE_FREIGABE`-Pfad implementieren.
- [ ] Alle Altwerte im Schlusskapitel und in der Bauquelle ersetzen: sieben von zehn, 102, ein Drittel, 63, 592, 17 von 60, 228 und „Gleichstand“.
- [ ] Schweregradzähler auf exakt dieselbe Testpopulation beschränken.
- [ ] Historische Testliste und aktuelle Schattenliste als getrennte Artefakte erzeugen.
- [ ] Notebook neu bauen, vollständig ausführen und sämtliche sichtbaren Texte gegen die Ausgaben lesen.

### P1 – vor methodisch belastbarem Schatten- oder Praxiseinsatz

- [ ] Ziel auf erkennbare und vermeidbare Schäden sowie Schweregrade ausrichten.
- [ ] Modellvergleich für das fachlich neue Ziel vollständig wiederholen.
- [ ] Ausmusterung/Zensierung und wiederholte Meldungen methodisch behandeln.
- [ ] Temporal- und Entity-Generalisation sprachlich und analytisch trennen.
- [ ] Forestparameter ausschließlich auf rollierenden Validierungsperioden untersuchen.
- [ ] Vorverarbeitung und Kategorienbehandlung in einer Pipeline kapseln.
- [ ] Vollständige Kosten und Maßnahmenwirksamkeit empirisch erheben.
- [ ] Exportmanifest mit Datenstand, Gültigkeit, Regelversion und Freigabestatus ergänzen.
- [ ] Monitoringgrenzen quantitativ und revisionsfähig definieren.
- [ ] Prospektiven Schattenzeitraum mit eingefrorener Pipeline abwarten.

### P2 – Qualität und Wartbarkeit

- [ ] Datenqualitätsassertions für Schlüssel, Zeitfolgen, unbekannte Typen, Routenabdeckung und Cutoff-Überschreitungen ergänzen.
- [ ] Manuell gepflegte Ergebniszahlen durch eine zentrale Ergebnisstruktur ersetzen.
- [ ] Automatischen Buildtest gegen bekannte Altphrasen und widersprüchliche Gates einführen.
- [ ] Forschungsmodell, Regelmanifest, Evaluationsbericht und Werkstattliste getrennt versionieren.
- [ ] Fehlende Distanzen als mögliche nicht-zufällige Missingness diskutieren.
- [ ] 30-Tage-Mindestalter, 180-Tage-Rückblick und Acht-Stunden-Grenze in Sensitivitätsanalysen prüfen.

## 10. Güteeinschätzung

| Dimension | Bewertung |
|---|---:|
| Geschäftsfrage und didaktischer Aufbau | **9/10** |
| technische Reproduzierbarkeit | **9/10** |
| zeitliche Grundkonzeption | **8/10** |
| Baselines und entscheidungsnahe Evaluation | **9/10** |
| Konsistenz von Generator, Code und Text | **5,5/10** |
| statistische und kausale Absicherung | **6,5/10** |
| Deployment- und Freigabelogik | **6/10** |
| sprachliche Verständlichkeit | **8/10** |
| Gesamtstand der konkreten Fassung | **7,5/10** |

## Schlussentscheidung

**Die neue Fassung ist technisch reproduzierbar und analytisch deutlich verbessert, aber noch nicht endgültig freigabefähig.**

Für eine Lehr-/Abgabeversion müssen vor allem die Generatorlogik, das widersprüchliche K1b-Urteil, die nicht verdrahtete Produktivbedingung und die verbliebenen Altwerte korrigiert werden. Danach besitzt das Notebook das Potenzial für eine sehr starke, didaktisch überzeugende Fallstudie.

Für eine reale Werkstattentscheidung bleibt die Freigabe klar verweigert. Die nächste sachgerechte Stufe ist kein weiterer historischer Feinschliff, sondern eine eingefrorene Ziel-/Feature-/Regeldefinition, eine aktuelle Schattenliste und deren prospektive Auswertung nach vollständigem 90-Tage-Horizont.
