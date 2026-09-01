# Erneuter Recheck: `01_Regression_Fahrtdauer.ipynb`

**Prüfdatum:** 2. September 2026  
**Geprüfte Datei:** `/Users/robert/Downloads/01_Regression_Fahrtdauer.ipynb`  
**SHA-256:** `1e3cb49177bb22326b8daf62a000043ee1d9a3acb8dd46350807ecc185a5e8c4`  
**Ausführung:** 25 von 25 Codezellen vollständig ausgeführt; keine Zellfehler  
**Festgeschriebener Datenstand:** Git-Commit `316b3db6532966693909430503b3ba597077754f`

## Kurzurteil

**Die neue Fassung ist erheblich konsistenter und zieht aus dem knapp verfehlten Primärgate erstmals die richtige technische Konsequenz: Die Preisauskunft bleibt vollständig gesperrt.** Das ist ein wichtiger Fortschritt.

Noch ist das Notebook aber nicht ganz fachlich endabgenommen. Der entscheidende Restwiderspruch liegt nun in der **Kandidatenwahl**:

- Die gewählte Perzentiltabelle verfehlt das selbst definierte Primärgate: Wilson-Untergrenze **79,3 %** statt mindestens 80 %.
- Eine unabhängige Gegenrechnung mit denselben sichtbaren Preisgrenzen zeigt für die bereits berechnete Quantilregression eine Wilson-Untergrenze von **82,4 %**. Sie würde das derzeit formal definierte aggregierte Primärgate bestehen und erreicht zudem mehr Anfragen.
- Trotzdem erklärt das Notebook bereits vor dieser Prüfung beide Kandidaten für gleichwertig und entscheidet sich aus Betriebsgründen für die Tabelle.

Damit lautet das Gesamturteil:

| Ebene | Urteil |
|---|---|
| technische Ausführbarkeit | **bestanden** |
| methodische Qualität der Fallstudie | **sehr gut, aber Kandidatenvergleich noch korrigieren** |
| sprachliche und strukturelle Endfassung | **weitgehend gut; einige widersprüchliche Auslieferungsformulierungen bleiben** |
| interne Produktlogik | **korrekt gesperrt** |
| sichtbare reale App-Freigabe | **nein** |

**Analytische Güte: etwa 8,8/10.**  
**Sprachliche Qualität: etwa 8,5/10.**  
**Abgabefähig:** nach den drei P0-Korrekturen dieses Berichts.  
**Produktfreigabefähig:** nein; zuerst Kandidatenwahl neu entscheiden und anschließend unabhängigen Schattenbetrieb bestehen.

## Was gegenüber der letzten Fassung erfolgreich verbessert wurde

### 1. Das Primärgate wirkt jetzt tatsächlich als Produktsperre

Die vorab preisabhängige Gruppe wird korrekt über die zum Anfragezeitpunkt bekannten Restfreiminuten und die angezeigte Spanne gebildet. Das Ergebnis lautet:

| vorab erkennbare Guthabenlage | Fälle | beobachtete Abdeckung | Wilson-Untergrenze |
|---|---:|---:|---:|
| Guthaben deckt obere Intervallgrenze | 3.287 | 99,8 % | 99,6 % |
| Grenzfall | 43 | 90,7 % | 78,4 % |
| vorab preisabhängig | 1.823 | 81,2 % | **79,3 %** |

Das Notebook bewertet 79,3 % gegen die verlangten 80 % nun ausdrücklich als **nicht bestanden**. Daraus werden mehrere konsistente technische Folgen gezogen:

- `PRODUKT_FREIGEGEBEN` ist `False`.
- Alle 348 Artefaktzeilen tragen `produktfreigabe = gesperrt_primaergate`.
- Ein normaler Aufruf von `preis_schaetzen()` liefert keine Preisspanne, sondern `produkt_nicht_freigegeben`.
- Eine Vollprüfung über alle 9.517 Test-2-Fahrten bestätigt: **0 reale App-Anzeigen** bei aktiver Produktsperre.

Damit ist der wichtigste Mangel des vorigen Rechecks technisch behoben. Die sehr gute Gesamtdeckung von 93,1 % wird nicht mehr benutzt, um das knapp verfehlte aussagekräftigere Gate zu überstimmen.

### 2. Die Mindestfallzahl-Sensitivität verwendet jetzt die reale Kundenlogik

Die frühere Überschätzung der bedienten Fälle ist korrigiert. Die Berechnung berücksichtigt nun auch die kundenspezifische Breitenregel:

| Mindestfallzahl | Kombinationen | potenziell angezeigte Testfälle | potenzielle Reichweite |
|---|---:|---:|---:|
| 30 | 351 | 5.153 | 54 % |
| 50 | 229 | 4.333 | 46 % |
| 100 | 108 | 2.892 | 30 % |

Die Entscheidung für 30 Beobachtungen wird zutreffend als Reichweitenkompromiss und nicht als statistische Wahrheit bezeichnet.

### 3. Die Bootstrap-Aussage ist fachlich korrigiert

Das Notebook bezeichnet die fünf Minuten jetzt korrekt als Breite des medianen 95-%-Bootstrap-Bereichs der oberen Grenze. Es setzt diese Unsicherheit außerdem richtig zur maximal zulässigen zwölfminütigen Gesamtspanne ins Verhältnis.

### 4. Die drei Radtypen werden konsistent benannt

Die veraltete Aussage, die Tabelle liefere am Ende nur CITY aus, ist entfernt. Kandidatenvergleich und Schlussabschnitt nennen nun CARGO, CITY und EBIKE.

### 5. Die streng belegte Alternative ist quantifiziert

Eine Ausgabe ausschließlich der 47 verbindungsbezogen `gestuetzt`en Zeilen hätte nur **18,3 %** Reichweite. Der Bericht macht den Zielkonflikt zwischen individueller Belegbarkeit und aggregierter Zusage dadurch deutlich nachvollziehbar.

## Zentrale neue Feststellung: Der Kandidatenvergleich ist nicht mehr ausreichend

### Was das Notebook bisher entscheidet

In Phase 5 steht sinngemäß:

> Beide Kandidaten erfüllen das vollständige Kriterium; deshalb entscheidet die Betriebsfähigkeit. Ausgeliefert wird die Perzentiltabelle, weil die statische App kein Python-Modell laden kann.

Diese Aussage betrachtet Gesamtdeckung, Radtypdeckung, Reichweite und Spannenbreite. Das später eingeführte, für die Produktentscheidung maßgebliche **Primärgate der preisabhängigen Gruppe** wird im Kandidatenvergleich jedoch nicht auf beide Verfahren angewendet.

### Ergebnis der unabhängigen Gegenrechnung

Das Gate wurde für beide Kandidaten mit derselben Definition erneut berechnet:

| Kandidat | preisabhängige angezeigte Fälle | Abdeckung | 95-%-Wilson-Untergrenze | Primärgate |
|---|---:|---:|---:|---|
| Perzentiltabelle | 1.823 | 81,2 % | **79,3 %** | nicht bestanden |
| Quantilregression | 2.096 | 84,0 % | **82,4 %** | bestanden |

Zusätzlich erreicht die Quantilregression insgesamt 64,5 % der Anfragen, die Tabelle 54,1 %. Nach der eigenen aktuellen Gatelogik sind die Kandidaten daher **nicht gleichwertig**.

Eine ergänzende Aufteilung der preisabhängigen Gruppe zeigt:

| Radtyp | Tabelle: Untergrenze | Quantil: Untergrenze |
|---|---:|---:|
| CARGO | 73,0 % | 77,1 % |
| CITY | 79,1 % | 80,4 % |
| EBIKE | 77,5 % | 83,2 % |

Das derzeit programmierte Primärgate gilt aggregiert; danach würde das Quantilverfahren intern bestehen. Falls das Gate künftig **zusätzlich je Radtyp** gelten soll, muss dies vorab formal festgelegt werden. Dann wäre auch die Quantilvariante wegen CARGO noch nicht freigabefähig. Diese Unterscheidung sollte nicht nach Betrachtung der Ergebnisse nachträglich getroffen werden.

### Erforderliche Korrektur

Der Kandidatenvergleich muss das vollständige spätere Freigabeschema enthalten:

1. kundenbezogene Nützlichkeitsregel anwenden;
2. Gesamt- und Radtypabdeckung prüfen;
3. Reichweite prüfen;
4. das preisabhängige Primärgate mit Wilson-Untergrenze prüfen;
5. erst danach Betriebsfähigkeit und Nachvollziehbarkeit abwägen.

Die statische App ist kein zwingender Grund gegen die Quantilvariante. Das Notebook nennt selbst den sinnvollen dritten Weg: **Quantilvorhersagen vorab berechnen und als statische Tabelle ausliefern.** Genau diese Variante sollte nun als Hauptkandidat untersucht werden.

Wichtig: Auch ein intern bestandenes Gate auf Test 2 wäre noch keine reale Produktfreigabe. Test 2 wurde zur Entwicklung und Kalibrierung verwendet; die unabhängige Bestätigung muss aus dem Schattenbetrieb kommen.

## Prüfung der früheren methodischen Kritikpunkte

### Geschäftsfrage und Zielauswahl

Die Geschäftsfrage ist weiterhin sinnvoll formuliert: Der Nutzer wählt vor dem Entsperren ein Ziel; erst danach wird die Dauer- und Preisspanne bestimmt. Dadurch besitzt das System die für eine konkrete Verbindung entscheidende Information.

Die App-Reihenfolge ist fachlich richtig:

```text
Startstation bekannt
        ↓
Nutzer wählt Zielstation
        ↓
Radtyp, Zeitpunkt und Kontokontext liegen vor
        ↓
Dauer- bzw. Preisspanne wird bestimmt
        ↓
Anzeige nur bei erfüllter Produkt- und Anfragelogik
```

### Zielstation und Leakage

`end_station_id` ist in diesem Prozess keine unzulässige Zukunftsinformation, weil das Ziel vor der Schätzung gewählt wird. Das Notebook nennt aber korrekt den verbleibenden Proxy-Vorbehalt: Historisch liegt das **tatsächliche**, nicht das **geplante** Ziel vor.

Die Zielablation belegt den Informationswert überzeugend:

| Modell | Validierungs-MAE |
|---|---:|
| Random Forest ohne Zielmerkmale | 8,06 min |
| Random Forest mit Zielmerkmalen | 3,38 min |

Die Verbesserung um 58 % stützt den neuen Geschäftsprozess. Sie beweist jedoch noch nicht, dass Nutzer ihr geplantes Ziel immer korrekt angeben oder einhalten.

### Zeitliche Trennung und Holdout

Die zeitliche Aufteilung bleibt sauber und nachvollziehbar:

| Teil | Fälle | Zeitraum | Rolle |
|---|---:|---|---|
| Training | 45.678 | 24.08.2021–17.12.2024 | Modelllernen |
| Validierung | 11.420 | 17.12.2024–06.08.2025 | Modellwahl |
| Test 1 | 9.516 | 06.08.2025–24.04.2026 | Prüfung der Punktschätzung |
| Test 2 | 9.517 | 24.04.2026–24.08.2026 | Entwicklung und Kalibrierung des Intervallprodukts |

Das Notebook weist transparent darauf hin, dass Test 2 kein unabhängiger Endtest mehr ist. Diese Ehrlichkeit ist methodisch positiv. Ein neuer, zeitlich späterer Schattenzeitraum bleibt zwingend.

### Baselines und Modellwahl

Die Baseline-Hierarchie ist gut gewählt:

| Ansatz | Validierungs-MAE |
|---|---:|
| globaler Median | 8,82 min |
| Median je Radtyp | 8,66 min |
| Median je Startstation | 7,69 min |
| Median je Verbindung | 4,07 min |
| Random Forest | **3,38 min** |

Der Random Forest schlägt die starke Routenbaseline um rund 17 %. Das ist ein sachlich relevanter, aber nicht übertriebener Zusatznutzen.

### Preprocessing, unbekannte Kategorien und lineare Regression

Die kategorischen Variablen laufen über `OneHotEncoder(handle_unknown="ignore")`; neue Kategorien verursachen daher keinen technischen Absturz. Für die lineare Regression wird mit `drop="first"` eine Referenzkategorie verwendet. Die Dummy-Kodierung ist damit korrekt umgesetzt und verständlich erklärt.

Die Einschränkung der linearen Koeffizienten wird ebenfalls richtig beschrieben: Ziel, Strecke und Steigung sind stark miteinander verbunden, sodass einzelne Koeffizienten nicht sauber kausal interpretierbar sind.

Ein methodischer Vorbehalt bleibt: `handle_unknown="ignore"` macht eine unbekannte Station nicht automatisch fachlich vorhersagbar. Die Tabellen-App verweigert unbekannte Verbindungen zu Recht.

### Zeitmerkmale

Stunde, Wochentag und Monat werden im Modell zyklisch mit Sinus und Kosinus kodiert. Dadurch sind 23 Uhr und 0 Uhr sowie Dezember und Januar korrekt benachbart. Wochenende und Feiertag werden zusätzlich berücksichtigt.

Die finale Perzentiltabelle verdichtet jedoch auf vier Tageszeitfenster und verliert Wochentag und Saison. Dieser Informationsverlust ist ein weiterer Grund, die vorab tabellierte Quantilvariante ernsthaft zu prüfen.

### Ausreißer- und Geltungsbereichsbehandlung

Abbrüche und Stornierungen werden ausgeschlossen. Fahrten unter einer Minute, über acht Stunden und ohne Stationsziel werden ebenfalls aus dem Geltungsbereich entfernt. Rundfahrten werden getrennt beschrieben und vor Training, Validierung und Tests aus dem Produktdatensatz ausgeschlossen.

Das Vorgehen ist konsistent. Die Acht-Stunden-Grenze bleibt allerdings eine fachliche Setzung ohne externen betrieblichen Nachweis. Sie sollte als Produktdefinition bestätigt werden.

### Preisfehler, Tariflogik und Deckel

Die Preisfunktion berücksichtigt:

- Aufrundung auf volle Minuten;
- Startgebühr;
- verbleibende Freiminuten;
- Minutenpreis;
- Rabatt;
- Tageshöchstpreis.

Die Rekonstruktion stimmt auf Test 1 in **100,00 %** der Fälle exakt mit dem gespeicherten Entgelt überein; die größte Abweichung beträgt 0,00 €. Der Preisfehler wird nicht fälschlich aus einem linearen Minutenpreis allein abgeleitet.

### App-Logik und Deployment

Die App-Funktion behandelt Rundfahrten, unbekannte Verbindungen, zu breite kundenspezifische Spannen und die globale Produktsperre getrennt. Für die reine Filterprüfung existiert ein ausdrücklich nur diagnostischer Schalter, der die Produktsperre umgeht.

Auf allen 9.517 Test-2-Fahrten stimmen Offlinefilter und App-Filter ohne globale Sperre exakt überein:

| Abweichung | Fälle |
|---|---:|
| nur App zeigt | 0 |
| nur Offlinebewertung zählt | 0 |

Eine getrennte Assertion bestätigt, dass die normale App bei nicht bestandenem Primärgate tatsächlich jede Anzeige verweigert.

## Verbleibende Mängel und konkrete Abhilfe

### P0.1 – Primärgate auf alle Kandidaten anwenden

**Mangel:** Die Kandidaten werden für gleichwertig erklärt, bevor das später entscheidende Primärgate berücksichtigt wird. Die unabhängige Prüfung zeigt, dass die Quantilregression dieses Gate besteht, die Tabelle nicht.

**Abhilfe:** Kandidatentabelle um Fallzahl, Abdeckung und Wilson-Untergrenze der preisabhängigen Gruppe ergänzen. Kandidat erst nach sämtlichen Gates auswählen. Eine statisch vorab berechnete Quantiltabelle als konkrete Betriebsvariante evaluieren.

### P0.2 – Tatsächliche und potenzielle Reichweite sprachlich trennen

**Mangel:** Abschnitt 6.2 sagt weiterhin sinngemäß, die App könne für 54 % der Fahrten einen Preis nennen und bezeichnet Spannen als „freigegeben“. Bei aktiver Produktsperre zeigt die normale App tatsächlich **0 von 9.517** Preisen.

**Abhilfe:** Durchgehend unterscheiden:

- **aktuelle reale Reichweite:** 0 %;
- **potenzielle Reichweite der gesperrten Tabelle nach erfolgreicher Freigabe:** 54,1 %;
- **potenzielle Reichweite der Quantilvariante:** 64,5 %.

Auch „ausgeliefert“, „freigegebene Spanne“ und „Wir liefern die Tabelle aus“ sollten bis zur Freigabe durch „erzeugt“, „potenziell anzeigbar“ und „als Kandidat vorgesehen“ ersetzt werden.

### P0.3 – Abschnittsstruktur und Zusage konsistent machen

**Mangel:** Die Reihenfolge lautet 6.4a, 6.4c, 6.4b. In 6.4b steht zudem noch „348 ausgelieferte Kombinationen“ und „Wir liefern alle drei Klassen aus“, obwohl das Produkt unmittelbar zuvor gesperrt wurde.

**Abhilfe:** 6.4b und 6.4c in eine logische Reihenfolge bringen. Inhaltlich formulieren:

> Das erzeugte, aber gesperrte Tabellenartefakt enthält 348 Kombinationen für alle drei Radtypen. Sollte es nach bestandenem Gate freigegeben werden, wäre die Zusage aggregiert je Radtyp und nicht je Verbindung.

### P1.1 – Unabhängigen Schattenbetrieb durchführen

**Mangel:** Das fertige Verfahren besitzt keinen unberührten Endtest. Die geplante Zielstation wurde historisch nicht gespeichert.

**Abhilfe:** Verfahren, Tarif und Gates einfrieren; geplantes Ziel vor Fahrtbeginn protokollieren; Auskünfte zunächst nicht anzeigen; anschließend Zieltreue, Abdeckung, Breite, Reichweite und Ablehnungsgründe auf einem neuen Zeitraum messen.

### P1.2 – Gate-Hierarchie vorab vollständig spezifizieren

**Mangel:** Das Primärgate gilt aktuell aggregiert. Die Formulierung „für alle drei Klassen“ kann aber den Eindruck erwecken, die preisabhängige Gruppe müsse auch je Radtyp eine Wilson-Untergrenze von 80 % erreichen.

**Abhilfe:** Vor der nächsten Messung ausdrücklich festlegen, ob folgende Gates gelten:

1. aggregiertes preisabhängiges Primärgate;
2. zusätzlich preisabhängiges Gate je Radtyp;
3. allgemeines Radtypgate über alle angezeigten Fälle;
4. Mindestreichweite je Radtyp.

Die Entscheidung darf nicht nach Sichtung des Schattenbetriebs geändert werden.

### P1.3 – Daten-, Code- und Artefaktversionierung vervollständigen

**Mangel:** `DATENVERSION` hasht nur Fahrtenzahl, späteste Startzeit und Entgeltsumme. Änderungen einzelner Datensätze oder anderer Eingabedateien können unbemerkt bleiben.

**Abhilfe:** SHA-256 jeder Eingabedatei, Git-Commit, Notebookhash, Modell-/Tabellenhash und Tarifhash im Artefakt oder einem Manifest speichern.

### P1.4 – App-Eingaben und Schlüssel absichern

**Mangel:** Es fehlen explizite Prüfungen für Stunden außerhalb 0–23, negative Restfreiminuten, unzulässige Rabatte, falsche Datentypen und doppelte Nachschlageschlüssel.

**Abhilfe:** Validierungsfehler mit eindeutigen Gründen zurückgeben und vor `set_index()` die Eindeutigkeit der vier Schlüsselspalten per Assertion prüfen.

### P1.5 – Bootstrap-Stichprobe reproduzierbarer und weniger auswahlabhängig machen

**Mangel:** Für die Bootstrap-Zusammenfassung werden je Größenklasse die ersten 40 Gruppen verwendet. Das kann von der vorhandenen Sortierung abhängen.

**Abhilfe:** Alle Gruppen auswerten oder 40 Gruppen mit festem Zufallsstart geschichtet ziehen und Auswahlregel sowie Streuung dokumentieren.

### P2 – Weiterführende Robustheit

- Zeitlich kalibrierte Conformal Prediction als Intervallverfahren vergleichen.
- Vorab tabellierte Quantilvorhersagen als statisch betreibbaren Kandidaten bauen.
- Wochentag und Saison im ausgelieferten Artefakt erhalten.
- Nur zum Anfragezeitpunkt real verfügbare Wetterprognosen verwenden und archivieren.
- Acht-Stunden-Grenze fachlich und betrieblich bestätigen.

## Sprachliche Qualität

### Stärken

- Die Texte erklären die Geschäftslogik anschaulich und ohne unnötige Fachsprache.
- Einschränkungen wie Proxy-Ziel, Kalibrierungszeitraum und fehlender Schattenbetrieb werden offen benannt.
- Zahlen werden meist unmittelbar interpretiert, statt nur ausgegeben.
- Die Begründung für Preisintervalle statt einer einzelnen Zahl ist verständlich.
- Die neue Erklärung des Bootstrap-Ergebnisses ist fachlich korrekt und gut lesbar.

### Restprobleme

- „ausliefern“, „freigegeben“ und „App kann“ widersprechen an mehreren Stellen der nun korrekt aktiven Produktsperre.
- Die Überschriftenfolge 6.4a/6.4c/6.4b stört die Leselogik.
- „Beide Kandidaten erfüllen das vollständige Kriterium“ ist seit Einführung des Primärgates zu stark und sachlich nicht mehr korrekt.
- Der Satz, die App könne kein Modell laden, klingt endgültiger als nötig; vorab berechnete Modellwerte sind bereits als realistische Alternative erkannt.

Nach Korrektur dieser Stellen ist die sprachliche Qualität für eine analytische Fallstudie sehr gut.

## Vollständiger Status der ursprünglichen Prüfpunkte

| Prüffrage | aktueller Stand |
|---|---|
| neue Geschäftsfrage mit Zielauswahl | **erfüllt** |
| Nutzung der Zielstation ohne Leakage | **erfüllt; Proxy-Risiko korrekt offengelegt** |
| zeitlicher Holdout | **für das Punktmodell erfüllt** |
| unabhängiger Schattenbetrieb | **korrekt geplant, noch nicht durchgeführt** |
| Training/Validation/Test | **sauber getrennt; Test 2 korrekt als Kalibrierung bezeichnet** |
| Preisfehler einschließlich Tarifdeckel | **erfüllt und exakt verifiziert** |
| geeignete Baselines einschließlich Routenbaseline | **erfüllt** |
| Preprocessing und unbekannte Kategorien | **technisch erfüllt; fachliche Grenzen benannt** |
| lineare Regression und Dummy-Kodierung | **korrekt** |
| zyklische Zeitmerkmale | **im Modell erfüllt** |
| Ausreißer- und Rundfahrtenbehandlung | **konsistent** |
| kundenbezogene Breitenregel | **Offline und App deckungsgleich** |
| Primärgate technisch erzwungen | **erfüllt** |
| Primärgate auf beide Kandidaten angewandt | **nicht erfüllt** |
| Deployment-Freigabe | **korrekt gesperrt** |
| reale versus potenzielle Reichweite | **rechnerisch bekannt, sprachlich noch vermischt** |
| Versionsmetadaten | **vorhanden, aber unvollständig** |
| App-Eingabevalidierung | **teilweise offen** |
| Konsistenz der Aussagen | **weitgehend gut; drei P0-Widersprüche verbleiben** |

## Priorisierte To-do-Liste

### P0 – vor Abgabe der finalen Notebookfassung

- [ ] Das preisabhängige Primärgate für **beide** Kandidaten in den offiziellen Vergleich aufnehmen.
- [ ] Kandidatenentscheidung neu treffen; vorab tabellierte Quantilvorhersagen konkret prüfen.
- [ ] 54,1 % überall als **potenzielle** Tabellenreichweite bezeichnen; aktuelle reale Reichweite bei Produktsperre mit 0 % ausweisen.
- [ ] „ausgeliefert/freigegeben“ in den betroffenen Abschnitten durch „erzeugt/gesperrt/potenziell anzeigbar“ ersetzen.
- [ ] Abschnittsfolge 6.4a/6.4b/6.4c ordnen und Zusage im Konditional formulieren.

### P1 – vor sichtbarer Produktfreigabe

- [ ] Gate-Hierarchie einschließlich möglichem Primärgate je Radtyp vorab festschreiben.
- [ ] Kandidat, Tarif, Code und Schwellen einfrieren.
- [ ] Schattenbetrieb mit tatsächlich gespeichertem geplantem Ziel durchführen.
- [ ] Sämtliche Gates auf neuen Daten ohne Nachjustierung bestehen.
- [ ] vollständige Datei-, Notebook-, Code-, Tarif- und Artefakthashes exportieren.
- [ ] Eingabevalidierung und Schlüssel-Eindeutigkeit ergänzen.

### P2 – Robustheit und Reichweite

- [ ] Quantilmodellwerte vorab tabellieren und gegen die historische Perzentiltabelle testen.
- [ ] Conformal Prediction als kalibrierte Alternative untersuchen.
- [ ] Wochentag und Saison im statischen Artefakt erhalten.
- [ ] Bootstrap-Sensitivität über alle Gruppen oder eine dokumentierte Zufallsstichprobe rechnen.
- [ ] Acht-Stunden-Grenze betrieblich bestätigen.

## Schlussfolgerung

Die neue Version hat den zuvor größten Freigabewiderspruch sauber beseitigt: Ein nicht bestandenes Primärgate sperrt nun wirklich das gesamte Produkt, und die App zeigt folgerichtig keinen Preis an. Technisch und methodisch ist das ein deutlicher Qualitätssprung.

**Noch nicht abschließend freigabefähig ist die Kandidatenentscheidung.** Das Notebook wählt die Perzentiltabelle, obwohl diese das entscheidende Gate verfehlt, während die vorhandene Quantilregression dasselbe aggregierte Gate in der unabhängigen Gegenrechnung besteht und eine höhere Reichweite erreicht. Dieser Befund muss in die offizielle Auswahl eingehen.

Für die analytische Abgabe fehlen damit nur wenige, klar lokalisierte Korrekturen an Kandidatenvergleich, Reichweitenbegriffen und Abschnittslogik. Für die reale App bleibt das richtige Urteil **keine Freigabe**, bis ein vorab festgelegter Kandidat im unabhängigen Schattenbetrieb mit geplantem Ziel sämtliche Gates bestanden hat.
