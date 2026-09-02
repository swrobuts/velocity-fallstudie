# Erneuter Recheck: `01_Regression_Fahrtdauer.ipynb`

**Prüfdatum:** 2. September 2026  
**Geprüfte Datei:** `/Users/robert/Downloads/01_Regression_Fahrtdauer.ipynb`  
**SHA-256:** `2c41044def44d10af993feb4f63068e196b5a6a72fbde5773feb3f9f82977a3a`  
**Aufbau:** 64 Zellen, davon 25 Code- und 39 Markdownzellen  
**Versionierter Datenstand:** Git-Commit `07d1b5df58c690044b19ec9776903c944972928f`

## Kurzurteil

**Nein, die vorliegende Fassung ist noch nicht endgültig freigabefähig.** Dabei müssen zwei Freigaben unterschieden werden:

| Ebene | Urteil |
|---|---|
| technische Reproduzierbarkeit | **bestanden** |
| analytischer Lehrprototyp | **sehr gut** |
| endgültige Lehr-/Abgabefassung | **noch nicht freigeben** |
| sichtbare Preisauskunft in der App | **klar nicht freigeben** |

Das Notebook hat den wichtigsten Punkt des letzten Reviews verbessert: Das vollständige Freigabeschema wird nun offiziell auf drei Kandidaten angewendet.

| Kandidat | potenzielle Reichweite | Abdeckung | preisabhängige Fälle | Wilson-Untergrenze des Primärgates | vollständiges Kriterium |
|---|---:|---:|---:|---:|---|
| Quantilregression | 64,5 % | 94,4 % | 2.097 | **82,4 %** | **erfüllt** |
| historische Perzentiltabelle | 54,1 % | 93,1 % | 1.823 | **79,3 %** | nicht erfüllt |
| vorab berechnete Quantiltabelle | 58,7 % | 91,7 % | 2.001 | **75,7 %** | nicht erfüllt |

Damit ist die fachliche Kandidatenlage eindeutig: **Nur die laufzeitfähige Quantilregression nimmt die derzeit definierten Gates.** Trotzdem erklärt der folgende Text die Kandidaten erneut für gleichwertig, wählt aus Betriebsgründen die durchgefallene Perzentiltabelle und baut ausschließlich für diese den Deploymentpfad.

Die App bleibt zwar technisch korrekt gesperrt. Für eine endgültige Notebookfreigabe muss aber entweder die Quantilregression als Produktkandidat umgesetzt werden oder offen festgestellt werden, dass unter der harten Anforderung „nur statische CSV“ derzeit **kein freigabefähiger Kandidat** existiert.

Unabhängig davon bleibt die reale Produktfreigabe ausgeschlossen, weil:

- das historisch tatsächliche Ziel nur ein unvalidierter Stellvertreter für das künftig geplante Ziel ist;
- kein prospektiver Schattenbetrieb durchgeführt wurde;
- Test 2 Kandidatenwahl, Kalibrierung und Filterung trägt und daher kein unabhängiger Endtest ist;
- die einzige statisch implementierte Variante ihr Primärgate verfehlt.

## 1. Technische und reproduktive Prüfung

Das Notebook wurde in einer isolierten Arbeitsumgebung ohne gesetzte Variable `VELO_BASIS` vollständig neu ausgeführt.

| Prüfung | Ergebnis |
|---|---|
| Codezellen frisch ausgeführt | **25 von 25** |
| Zellfehler | **0** |
| Ausführung mit Standard-Datenpfad | **bestanden** |
| gespeicherte und neu berechnete Zahlen | **inhaltlich identisch** |
| Abweichungen der gespeicherten Ausgaben | nur zwei zusätzliche Leerzeilen, keine Zahlenabweichung |
| lokales Notebook bytegleich mit GitHub `main` | **ja** |
| erzeugte CSV-Zeilen | 348 |
| doppelte App-Schlüssel | **0** |
| Produktstatus aller CSV-Zeilen | `gesperrt_primaergate` |

Die veröffentlichte Fassung ist unter [GitHub – Notebook 01](https://github.com/swrobuts/velocity-fallstudie/blob/main/analytics/notebooks/01_Regression_Fahrtdauer.ipynb) synchron verfügbar.

## 2. Was überzeugend gelöst ist

### 2.1 Geschäftsfrage und Zielauswahl

Der neue Geschäftsprozess ist fachlich plausibel:

```text
Startstation ist bekannt
        ↓
Nutzer wählt das geplante Ziel
        ↓
Radtyp, Zeitpunkt und Kontokontext liegen vor
        ↓
Dauer- und Preisspanne werden bestimmt
        ↓
Anzeige nur bei bestandener Produkt- und Anfragelogik
```

Dadurch wird die Zielstation nicht automatisch zu Leakage. Entscheidend ist, dass sie vor der Vorhersage als Nutzereingabe entsteht. Das Notebook erläutert diesen Grundsatz sehr verständlich.

Ebenso richtig wird die verbleibende Einschränkung benannt: Trainiert wird auf dem **tatsächlichen** historischen Ziel, verwendet werden soll künftig das **geplante** Ziel. Diese beiden Größen können auseinanderfallen. Ohne Protokollierung des geplanten Ziels ist die Güte deshalb nur eine optimistische Näherung.

### 2.2 Geltungsbereich und Ausreißer

Die Filterlogik ist konsistent und nachvollziehbar:

- Abbrüche und Stornierungen werden ausgeschlossen.
- Fahrten unter einer Minute werden ausgeschlossen.
- Fahrten über acht Stunden werden als eigener Geschäftsfall behandelt.
- freie Abstellungen werden ausgeschlossen, weil keine Zielstation vorliegt.
- Rundfahrten werden getrennt beschrieben und aus dem Produktdatensatz genommen.

Die Acht-Stunden-Grenze wird korrekt als fachliche Setzung und nicht als empirisch bewiesene Wahrheit bezeichnet.

### 2.3 Zeitliche Trennung

Die zeitliche Aufteilung ist transparent:

| Teil | Fälle | Zeitraum | Rolle |
|---|---:|---|---|
| Training | 45.678 | 24.08.2021–17.12.2024 | Modelllernen |
| Validierung | 11.420 | 17.12.2024–06.08.2025 | Modellwahl |
| Test 1 | 9.516 | 06.08.2025–24.04.2026 | einmalige Prüfung der Punktschätzung |
| Test 2 | 9.517 | 24.04.2026–24.08.2026 | Entwicklung und Kalibrierung des Intervallprodukts |

Besonders positiv ist, dass das Notebook Test 2 nicht mehr als unabhängigen Endtest ausgibt. Es benennt ausdrücklich, dass Erkundung, Kandidatenwahl und Filterung diesen Zeitraum verbrauchen. Die endgültige Prüfung müsste auf zukünftigen Daten erfolgen.

### 2.4 Baselines und Modellwahl

Die Baseline-Hierarchie ist sehr gut gewählt:

| Ansatz | Validierungs-MAE |
|---|---:|
| globaler Median | 8,82 min |
| Median je Radtyp | 8,66 min |
| Median je Startstation | 7,69 min |
| Median je Verbindung | 4,07 min |
| Random Forest | **3,38 min** |

Der Random Forest schlägt die starke Routenbaseline um rund 17 %. Die Zielablation ist ebenfalls überzeugend:

| Modell | Validierungs-MAE |
|---|---:|
| Random Forest ohne Zielmerkmale | 8,06 min |
| Random Forest mit Zielmerkmalen | **3,38 min** |

Damit ist der Informationsgewinn der Zielauswahl sauber belegt, ohne daraus eine kausale Aussage abzuleiten.

### 2.5 Preprocessing, lineare Regression und Zeitmerkmale

- Kategorische Merkmale werden über `OneHotEncoder(handle_unknown="ignore")` verarbeitet.
- Die lineare Regression verwendet `drop="first"`; die Dummy-Kodierung ist damit formal korrekt.
- Die eingeschränkte Interpretierbarkeit der Koeffizienten wegen redundanter Routen-, Start-, Ziel-, Strecken- und Steigungsmerkmale wird angemessen erklärt.
- Stunde, Wochentag und Monat werden zyklisch kodiert.
- Feiertage und Schulferien werden berücksichtigt.
- Unbekannte Verbindungen werden im statischen Apppfad nicht einfach über einen Nullvektor geschätzt, sondern abgelehnt.

### 2.6 Tarif- und Preislogik

Die Preisfunktion berücksichtigt:

- Aufrundung auf angefangene Minuten;
- Startgebühr;
- verbleibende Freiminuten zum Fahrtbeginn;
- radtypabhängigen Minutenpreis;
- Rabatt;
- Tageshöchstpreis.

Die Rekonstruktion stimmt auf Test 1 bei **100,00 %** der Fälle exakt mit dem gespeicherten Entgelt überein; die größte Abweichung beträgt 0,00 €. Der Preisfehler wird somit nicht fälschlich als bloße Minutendifferenz mal Minutenpreis behandelt.

### 2.7 Produktsperre und App-Konsistenz

Die aktuell implementierte Perzentiltabelle verfehlt das Primärgate:

- 1.823 vorab preisabhängige Fälle,
- beobachtete Abdeckung 81,2 %,
- Wilson-Untergrenze 79,3 %,
- gefordert mindestens 80 %.

Die technische Konsequenz ist korrekt:

- `PRODUKT_FREIGEGEBEN` ist `False`;
- alle 348 Artefaktzeilen tragen `gesperrt_primaergate`;
- der normale Aufruf von `preis_schaetzen()` liefert keine Preisspanne;
- tatsächliche App-Reichweite ist 0 %, nicht die potenzielle Artefaktreichweite von 54,1 %;
- auf allen 9.517 Test-2-Fahrten stimmen Offlinefilter und diagnostisch entsperrte App-Filter exakt überein.

Dieser Teil ist methodisch und technisch überzeugend.

## 3. P0-Mängel vor einer endgültigen Notebookfreigabe

### P0.1 Kandidatenurteil und Deploymentpfad widersprechen einander

Unmittelbar nach der korrekten Vergleichstabelle steht zunächst:

> Drei Kandidaten, und nur einer nimmt alle Hürden.

Das ist richtig. Wenige Absätze später steht jedoch:

> Beide erfüllen das Kriterium, also entscheidet die Betriebsfähigkeit.

Das ist nach der aktuellen Rechnung falsch. Die Perzentiltabelle und die Quantiltabelle verfehlen das Primärgate. Nur die Quantilregression erfüllt das vollständige aktuelle Kriterium.

Trotzdem wird die Perzentiltabelle als vorgesehener Kandidat bezeichnet und allein für sie werden CSV, Lookup, App-Funktion und Freigabestatus gebaut. Dadurch entstehen drei verschiedene Aussagen:

1. analytisch bester und einziger bestehender Kandidat: **Quantilregression**;
2. technisch implementierter Kandidat: **Perzentiltabelle**;
3. sichtbares Produkt: **keines**, weil die Perzentiltabelle gesperrt bleibt.

Die dritte Aussage ist sicher und korrekt; die zweite folgt aber nicht aus der ersten.

**Abhilfe:** Die Architekturentscheidung muss vor der Kandidatenwahl festgelegt werden.

- Ist ein Laufzeitdienst zulässig, muss die Quantilregression als Hauptkandidat mit einem eigenen App-/API-Pfad implementiert werden.
- Ist ausschließlich eine statische CSV zulässig, lautet das ehrliche Ergebnis: **Kein technisch zulässiger Kandidat besteht derzeit das Primärgate.** Dann darf die Perzentiltabelle nur als gesperrtes Diagnoseartefakt, nicht als „vorgesehener Kandidat“, bezeichnet werden.

Ein durchgefallenes Verfahren wird nicht dadurch freigabefähig, dass es leichter zu betreiben ist.

### P0.2 Die Quantilregression wird nicht mit exakt ihrer späteren Anzeigelogik bewertet

Für den laufzeitfähigen Quantilkandidaten werden die Preisgrenzen aus gerundeten Minuten berechnet, die Nützlichkeitsprüfung der Minutenspanne arbeitet aber mit den ungerundeten Modellwerten. Eine echte App würde ganze Minuten anzeigen und müsste Breite und Preis aus genau diesen angezeigten Grenzen ableiten.

Die unabhängige Gegenrechnung mit vollständig gerundeten Anzeigeminuten ergibt:

| Bewertung | angezeigte Fälle | preisabhängige Fälle | Abdeckung | Wilson-Untergrenze |
|---|---:|---:|---:|---:|
| Notebooklogik | 6.139 | 2.097 | 84,0 % | 82,4 % |
| vollständig gerundete Anzeigelogik | **6.337** | **2.160** | 83,8 % | **82,2 %** |

Das Urteil ändert sich nicht: Die Quantilregression besteht weiterhin. Reichweite und Gatewert ändern sich aber messbar. Ein Kandidatenvergleich muss exakt das bewerten, was später angezeigt wird.

**Abhilfe:** Eine gemeinsame Funktion für Rundung, Minutenanzeige, Preistransformation und Breitenregel definieren. Offlinebewertung und Produktivfunktion müssen dieselbe Funktion verwenden. Anschließend alle drei Kandidaten neu vergleichen.

### P0.3 Abschnitt und Schlussfolgerung enthalten weiterhin alte Kandidatentexte

Mehrere Formulierungen stammen logisch aus der vorherigen Zwei-Kandidaten-Fassung:

- Überschrift: „Welches Artefakt? Zwei Kandidaten“ – tatsächlich werden drei verglichen.
- „Beide erfüllen das Kriterium“ – tatsächlich erfüllt nur einer alle Gates.
- Die vorab berechnete Quantiltabelle wird zuerst umgesetzt und verworfen, später aber erneut als „dritter Weg“ beziehungsweise „nächste Runde“ angekündigt.
- Im Schlusskapitel steht erneut, das Vorabtabellieren der Modellwerte sei der nächste Schritt, obwohl genau dieser Versuch bereits gerechnet wurde und mit 75,7 % am Primärgate scheitert.
- „Wir liefern den schwächeren Kandidaten aus“ widerspricht der aktiven Produktsperre; tatsächlich wird nur ein gesperrtes Artefakt erzeugt.

Diese Widersprüche betreffen die zentrale Modell- und Produktentscheidung und sind daher keine bloßen Stilfragen.

**Abhilfe:** Phase 5.6 und das Schlusskapitel vollständig aus der aktuellen Drei-Kandidaten-Entscheidung neu formulieren. Die präzise Schlussfolgerung lautet derzeit:

> Die laufzeitfähige Quantilregression besteht intern als einzige Variante. Beide untersuchten statischen Tabellen bestehen nicht. Da ein Laufzeitdienst noch nicht beschlossen und kein unabhängiger Schattenbetrieb durchgeführt wurde, wird kein Produkt freigegeben.

### P0.4 Kapitelreihenfolge bleibt logisch falsch

Die Reihenfolge lautet weiterhin:

```text
6.4a → 6.4b → 6.5 → 6.6 → 6.4c
```

Das Primärgate 6.4c, das die gesamte Produktfreigabe entscheidet, steht erst nach Überwachung und Schattenbetrieb. Dadurch wird die Entscheidung erklärt, nachdem ihre Folgen bereits beschrieben wurden.

**Abhilfe:**

```text
6.4  App-Funktion
6.4a Offline-/App-Konsistenz
6.4b Reichweite der Zusage
6.4c Primärgate und Freigabeentscheidung
6.5  Überwachung
6.6  Schattenbetrieb
```

## 4. P1-Mängel vor einer realen Produktfreigabe

### P1.1 Geplantes Ziel und Schattenbetrieb fehlen

Das fundamentale Informationsproblem ist transparent beschrieben, aber nicht gelöst. Historisch ist nur das tatsächliche Ziel bekannt. Im Produkt soll das geplante Ziel eingegeben werden.

Ein echter Schattenbetrieb muss deshalb mindestens protokollieren:

1. geplantes Ziel vor dem Entsperren;
2. erzeugte, aber nicht sichtbare Prognose;
3. tatsächlich erreichtes Ziel;
4. tatsächliche Dauer und tatsächlichen Preis;
5. Ablehnungsgrund, falls keine Spanne erzeugt würde;
6. Zieltreue und Güte getrennt nach Radtyp, Verbindung und Guthabenlage.

Ohne diese Daten ist keine sichtbare Freigabe vertretbar.

### P1.2 Gate-Hierarchie je Radtyp ist nicht vollständig festgelegt

Das Primärgate gilt derzeit aggregiert über alle preisabhängigen Fahrten. Eine unabhängige Aufteilung der Quantilregression ergibt:

| Radtyp | preisabhängige Fälle | Abdeckung | Wilson-Untergrenze |
|---|---:|---:|---:|
| CARGO | 204 | 82,8 % | **77,1 %** |
| CITY | 1.012 | 82,8 % | **80,4 %** |
| EBIKE | 881 | 85,7 % | **83,2 %** |

Nach dem derzeit ausdrücklich aggregierten Primärgate besteht die Quantilregression. Falls die preisabhängige Gruppe zusätzlich je Radtyp eine Wilson-Untergrenze von 80 % erreichen soll, besteht auch sie wegen CARGO noch nicht.

Diese Regel darf nicht nach Betrachtung der Ergebnisse geändert werden. Vor dem Schattenbetrieb muss festgeschrieben werden, ob verlangt wird:

- Primärgate nur aggregiert;
- zusätzlich Primärgate je Radtyp;
- Mindestreichweite je Radtyp;
- Mindestfallzahl je Radtyp und Guthabenlage.

### P1.3 „Preisabhängig“ wird an einer Stelle falsch beschrieben

Der Code definiert die vollständig preisabhängige Gruppe korrekt als:

```python
freiminuten_rest < untere_intervallgrenze
```

Damit ist selbst die kürzeste angezeigte Fahrt nicht vollständig durch Freiminuten gedeckt. In Abschnitt 6.4c steht dagegen, die obere Intervallgrenze werde nicht gedeckt. Das würde auch Grenzfälle einschließen, bei denen die kurze Fahrt frei und die lange kostenpflichtig wäre.

**Abhilfe:** Durchgehend dieselben drei Gruppen verwenden:

- Rest ≥ obere Grenze: vorab gedeckt;
- Rest < untere Grenze: vollständig preisabhängig;
- dazwischen: Grenzfall.

### P1.4 Die vorab berechnete Quantiltabelle ist nur eine grobe Variante

Die Quantiltabelle wird aus einem einzelnen Vertreter je Verbindung, Radtyp und grobem Zeitfenster erzeugt. Für numerische Zeitmerkmale werden Mediane eingesetzt. Bei Sinus-/Kosinusmerkmalen kann die getrennte Medianbildung sogar einen Punkt erzeugen, der keinem realen Zeitpunkt entspricht.

Aus dem Scheitern dieser groben Tabelle folgt daher nicht allgemein, dass Modellvorhersagen nicht statisch materialisiert werden können. Denkbare Varianten wären:

- zusätzliche Schlüssel für Monat, Wochentag, Feiertag und Ferien;
- Materialisierung auf einem vollständigen zulässigen Eingaberaster;
- getrennte Tabellen nach Saison;
- ein kleines, im Browser ausführbares Modellformat;
- ein serverseitiger Prognosedienst.

Die aktuelle Rechnung beweist nur: **Die konkret gebaute, stark verdichtete Quantiltabelle besteht nicht.**

### P1.5 App-Eingaben werden nicht ausreichend validiert

Die Produktfunktion prüft Stunden, Freiminuten und Rabatt nicht explizit. Unabhängige Tests zeigen:

- Stunde 99 wird lediglich wie eine unbekannte Kombination behandelt;
- negative Restfreiminuten werden akzeptiert;
- ein Rabatt von 150 % erzeugt eine negative und sogar fallende Preisspanne: `−0,45 bis −0,65 €`.

Die globale Produktsperre verhindert derzeit eine reale Anzeige. Vor jedem Einsatz müssen jedoch harte Eingabegrenzen gelten:

```text
0 ≤ Stunde ≤ 23
Freiminuten_rest ≥ 0
0 ≤ Rabatt_prozent ≤ 100
Start und Ziel sind gültige ganzzahlige IDs
Radtyp ist bekannt
Preis_von ≤ Preis_bis und beide Preise ≥ 0
```

### P1.6 Freigabestatus und Filterlogik besitzen zwei unterschiedliche Regeln

`freigabestatus()` sperrt eine Kombination erst, wenn die **obere** Wilson-Grenze unter 80 % liegt. Zusätzlich wird `durchgefallen` aber anhand des bloßen Punktschätzers `< 80 %` gebildet. Bei einem künftigen Datenstand könnte eine statistisch `unbestimmt`e Kombination dadurch in einem Pfad zugelassen und in einem anderen entfernt werden.

Aktuell tritt die Abweichung nicht auf, weil alle 93 Kombinationen mit mindestens 20 Testfahrten einen Punktschätzer von mindestens 80 % erreichen. Die Logik sollte dennoch nur eine Quelle besitzen.

### P1.7 Versionsmetadaten sind weiterhin unvollständig

`DATENVERSION` hasht nur:

- Zahl der Fahrten,
- späteste Startzeit,
- Summe der Entgelte.

Viele Datenänderungen können diese drei Aggregate unverändert lassen. Es fehlen insbesondere:

- SHA-256 der einzelnen Eingabedateien;
- Notebook- beziehungsweise Codehash;
- Hash des Modellartefakts;
- Hash der erzeugten Tabelle;
- vollständige Gate- und Tarifkonfiguration;
- Bibliotheksversionen.

Vor einem Schattenbetrieb sollte ein reproduzierbares Manifest erzeugt werden.

### P1.8 Schlüssel-Eindeutigkeit wird nicht abgesichert

Die aktuelle CSV besitzt **keine** doppelten Schlüssel. Vor `set_index()` fehlt aber eine Assertion. Ein künftiges Duplikat würde statt einer Zeile einen DataFrame zurückgeben und die App-Funktion unvorhersehbar machen.

Empfehlung:

```python
schluessel = ["start_station_id", "ziel_station_id", "typ_code", "zeitfenster"]
assert not freigabe_tabelle.duplicated(schluessel).any()
```

## 5. Sprachliche und didaktische Qualität

### Stärken

- Die neue Geschäftsfrage wird sehr anschaulich aus dem Informationsproblem hergeleitet.
- Leakage wird prozessbezogen statt nur anhand von Spaltennamen erklärt.
- Der Proxy-Vorbehalt zwischen geplantem und tatsächlichem Ziel ist außergewöhnlich klar beschrieben.
- Baselines, Zielablation und Tariflogik sind gut nachvollziehbar.
- Die Trennung von realer und potenzieller Reichweite ist fachlich und sprachlich stark.
- Die Produktsperre wird nicht durch eine komfortable Gesamtquote relativiert.
- Einschränkungen werden sichtbar und nicht in Fußnoten versteckt.

### Zu korrigierende Stellen

- „Zwei Kandidaten“ muss „drei Kandidaten“ heißen.
- „Beide erfüllen das Kriterium“ ist sachlich falsch.
- „Als Kandidat vorgesehen ist die Perzentiltabelle“ widerspricht ihrem nicht bestandenen Gate.
- „Wir liefern den schwächeren Kandidaten aus“ widerspricht der Produktsperre.
- „Die Tabelle bauen und ausliefern“ sollte „gesperrtes Diagnoseartefakt bauen“ heißen.
- Das Diagnosebeispiel „freigegebene Verbindung“ sollte „lokal zugelassene Artefaktzeile – Produkt global gesperrt“ heißen.
- „Zwischen Bewertung und ausgelieferter Funktion“ sollte „implementierter Funktion“ heißen.
- Der „dritte Weg“ darf im Schlusskapitel nicht erneut als offen erscheinen, nachdem er bereits geprüft wurde.
- „Die Spanne löst beide Punkte“ ist für die implementierte Tabelle zu stark, weil deren Primärgate nicht hält.
- Die Abschnittsnummerierung 6.4a/6.4b/6.5/6.6/6.4c muss geordnet werden.

Die Sprache ist insgesamt sehr gut. Die verbleibenden Probleme konzentrieren sich auf die zentrale Kandidaten- und Auslieferungsentscheidung; gerade deshalb verhindern sie noch die Endfreigabe.

## 6. Status der früheren Prüfpunkte

| Prüffrage | aktueller Stand |
|---|---|
| neue Geschäftsfrage mit Zielauswahl | **erfüllt** |
| Zielstation ohne Leakage | **erfüllt, Proxy-Risiko korrekt offengelegt** |
| zeitlicher Holdout | **für Punktschätzung erfüllt** |
| Training/Validation/Test sauber getrennt | **ja; Test 2 korrekt als Kalibrierung bezeichnet** |
| unabhängiger Schattenbetrieb | **noch nicht durchgeführt** |
| Preislogik inklusive Freiminuten, Rabatt und Deckel | **erfüllt und exakt verifiziert** |
| geeignete Baselines einschließlich Route | **erfüllt** |
| Preprocessing und unbekannte Kategorien | **technisch gut; Produktgrenzen benannt** |
| lineare Regression und Dummy-Kodierung | **korrekt** |
| zyklische Zeitmerkmale | **im Modell korrekt** |
| Ausreißer und Rundfahrten | **konsistent behandelt** |
| Primärgate auf alle Kandidaten angewandt | **jetzt erfüllt** |
| statische Quantilvariante geprüft | **jetzt erfüllt; konkrete Variante scheitert** |
| Kandidatenauswahl folgt den Gates | **nicht erfüllt** |
| reale versus potenzielle Reichweite | **korrekt getrennt** |
| globale Produktsperre | **korrekt und wirksam** |
| Offline-/App-Filter deckungsgleich | **erfüllt** |
| App-Eingabevalidierung | **nicht ausreichend** |
| vollständige Versionierung | **nicht erfüllt** |
| Konsistenz der Texte | **noch nicht erfüllt** |

## 7. Priorisierte To-do-Liste

### P0 – vor der endgültigen Lehr-/Abgabefreigabe

- [ ] Architekturvorgabe festschreiben: Laufzeitmodell zulässig oder ausschließlich statische Tabelle.
- [ ] Bei zulässigem Laufzeitmodell die Quantilregression als Kandidat implementieren und exakt mit ihrer App-Anzeigelogik bewerten.
- [ ] Bei zwingend statischer Architektur offen urteilen: Derzeit besteht kein technisch zulässiger Kandidat.
- [ ] Phase 5.6 vollständig aus der aktuellen Drei-Kandidaten-Rechnung neu schreiben.
- [ ] Alle Aussagen entfernen, nach denen die durchgefallene Perzentiltabelle das Kriterium erfülle oder ausgeliefert werde.
- [ ] Quantiltabelle nicht erneut als ungeprüften nächsten Schritt ankündigen; stattdessen die konkrete grobe Variante und ihre Grenzen benennen.
- [ ] Abschnittsfolge 6.4a/6.4b/6.4c/6.5/6.6 ordnen.
- [ ] Rundungs-, Breiten- und Preislogik für den Quantilkandidaten in einer gemeinsamen Produktfunktion zusammenführen.

### P1 – vor sichtbarer Produktfreigabe

- [ ] geplantes Ziel vor Fahrtbeginn speichern;
- [ ] Kandidat, Merkmale, Tarif und Gates vorab einfrieren;
- [ ] prospektiven Schattenbetrieb durchführen;
- [ ] Gate-Hierarchie einschließlich möglichem Primärgate je Radtyp festschreiben;
- [ ] sämtliche Gates ohne Nachjustierung auf neuen Daten bestehen;
- [ ] Eingaben und Ausgabeinvarianten hart validieren;
- [ ] Freigabestatus und Ausschlusslogik auf eine einzige Regel zurückführen;
- [ ] Schlüssel-Eindeutigkeit per Assertion sichern;
- [ ] vollständiges Daten-, Code-, Modell-, Tarif- und Artefaktmanifest erzeugen.

### P2 – Robustheit und Reichweite

- [ ] zeitlich kalibrierte Conformal Prediction als Intervallverfahren vergleichen;
- [ ] feinere statische Materialisierung mit Saison-/Wochentagsmerkmalen prüfen;
- [ ] Bootstrap nicht über die ersten 40 Gruppen, sondern über alle Gruppen oder eine dokumentierte Zufallsstichprobe rechnen;
- [ ] Acht-Stunden-Grenze betrieblich bestätigen;
- [ ] archivierte Wetterprognosen statt tatsächlich beobachteter Tageswerte als zukünftiges Merkmal evaluieren.

## 8. Güteeinschätzung

| Dimension | Bewertung |
|---|---:|
| Geschäftsfrage und Prozesslogik | 9,5/10 |
| technische Reproduzierbarkeit | 9,5/10 |
| Leakage- und Stichtagslogik | 9/10 |
| Baselines und Modellvergleich | 9/10 |
| Tarif- und Preisfehlerberechnung | 10/10 |
| Intervall- und Kandidatenevaluation | 8/10 |
| Deployment- und Freigabelogik | 6,5/10 |
| sprachliche Verständlichkeit | 8,5/10 |
| interne Konsistenz | 6,5/10 |
| **Gesamtstand der konkreten Fassung** | **8,5/10** |

## 9. Abschließende Freigabeentscheidung

### Analytische Lehr-/Abgabeversion

**Noch nicht freigeben.** Die analytische Basis ist sehr stark, und der frühere Mangel des unvollständigen Kandidatenvergleichs ist rechnerisch behoben. Die aktuelle Interpretation und der Deploymentpfad folgen diesem Ergebnis aber noch nicht. Nach Bereinigung der Kandidatenentscheidung, der Rundungslogik und der zentralen Widersprüche ist das Notebook sehr gut abgabefähig.

### Sichtbare App-/Produktfreigabe

**Keine Freigabe.** Das ist nicht nur das externe Reviewurteil, sondern inzwischen auch die technisch korrekt erzwungene Notebookentscheidung:

- Die implementierte Perzentiltabelle verfehlt das Primärgate.
- Die App zeigt bei aktiver Sperre 0 von 9.517 Preisspannen.
- Der einzige intern bestehende Kandidat besitzt noch keinen Produktivpfad.
- Das geplante Ziel wurde historisch nicht erfasst.
- Ein unabhängiger prospektiver Schattenbetrieb fehlt.

Der sachgerechte nächste Schritt ist daher keine weitere kosmetische Überarbeitung der 79,3 %, sondern eine klare Architekturentscheidung. Danach muss der gewählte Kandidat mit eingefrorener Logik im Schattenbetrieb auf tatsächlich geplanten Zielen geprüft werden.
