# Gemeinsamer analytischer und methodischer Recheck

## Notebooks 04, 05 und 06

**Prüfdatum:** 02.09.2026

| Notebook | SHA-256 | Zellen | Codezellen |
|---|---|---:|---:|
| `04_Zeitreihe_Nachfrageprognose.ipynb` | `496adbc2579d0ef23fee585ed71e74d6cef9d3c344e8c95a6c5a1de609ac6cd7` | 38 | 14 |
| `05_Assoziation_Wege_im_Netz.ipynb` | `bae9bd934b2ab2f281a6c049103efb0299799fd22ff84e0a09b1aa2ac06410e2` | 32 | 12 |
| `06_Anomalieerkennung_Auffaellige_Vorgaenge.ipynb` | `c15e2ee08461a549d483326c47448af6f6183ae35aa55aeee12a1d43117a0d38` | 45 | 17 |

## Kurzurteil

Alle drei Notebooks sind technisch ausführbar und stimmen am Prüfdatum exakt mit den jeweils verlinkten GitHub-Fassungen überein. Inhaltlich ist das Bild unterschiedlich:

| Notebook | Lehr-/Abgabefreigabe | Betriebsfreigabe | Kurzurteil |
|---|---|---|---|
| **04 Zeitreihe** | **Bedingt freigabefähig** | **Nein** | Sehr guter Aufbau und saubere Informationslogik. Vor der finalen Freigabe muss die am Suchrand liegende Aufschlagswahl korrigiert und die Zeitreihenvalidierung verbreitert werden. |
| **05 Assoziation** | **Noch nicht freigabefähig** | **Nein** | Methodisch grundsätzlich stark, aber der neue Datenstand erzeugt zwei regelkonforme Treffer, während große Teile des Textes weiterhin „keine Regel“ und alte Zahlen behaupten. |
| **06 Anomalie** | **Noch nicht freigabefähig** | **Nein** | Die produktnahe A2-Logik und die aktuelle B-Rechnung sind verbessert. Ein kompletter alter Ergebnisabschnitt widerspricht jedoch weiterhin den neuen Ausgaben. |

**Gesamturteil:** Die drei Dateien dürfen nicht gemeinsam als finale, inhaltlich konsistente Abgabefassung bezeichnet werden. Notebook 04 ist nahe an einer Lehrfreigabe; bei 05 und 06 ist zunächst eine vollständige Synchronisation der Ergebnisprosa mit dem aktuellen Datenstand erforderlich.

## 1. Technische Verifikation

Alle drei Dateien wurden in frischen Arbeitskopien vollständig in ihrer Standardkonfiguration ausgeführt.

| Prüfung | Notebook 04 | Notebook 05 | Notebook 06 |
|---|---:|---:|---:|
| Codezellen | 14 | 12 | 17 |
| frisch ausgeführt | 14 | 12 | 17 |
| fehlende Ausführungszähler | 0 | 0 | 0 |
| Laufzeitfehler | **0** | **0** | **0** |

Die lokalen Dateien sind jeweils bytegenau identisch mit den veröffentlichten Fassungen:

- [Notebook 04 auf GitHub](https://github.com/swrobuts/velocity-fallstudie/blob/main/analytics/notebooks/04_Zeitreihe_Nachfrageprognose.ipynb)
- [Notebook 05 auf GitHub](https://github.com/swrobuts/velocity-fallstudie/blob/main/analytics/notebooks/05_Assoziation_Wege_im_Netz.ipynb)
- [Notebook 06 auf GitHub](https://github.com/swrobuts/velocity-fallstudie/blob/main/analytics/notebooks/06_Anomalieerkennung_Auffaellige_Vorgaenge.ipynb)

Das ist technisch positiv. Es bedeutet aber auch, dass die unten beschriebenen textlichen Widersprüche derzeit unmittelbar in GitHub und Colab sichtbar sind.

---

# Teil A – Notebook 04: Zeitreihe und Nachfrageprognose

## 2. Forschungs- und Geschäftsfrage

Die Frage ist sinnvoll und praxisnah begrenzt:

> Wie viele Fahrten sind für den nächsten Tag zu erwarten, wenn die Prognose am Vorabend um 18 Uhr erstellt werden muss?

Positiv ist die klare Abgrenzung: Fahrten sind weder benötigte Fahrräder noch Personalbedarf. Diese Übersetzung wird ausdrücklich einer nachgelagerten Planung überlassen. Auch der Informationszeitpunkt ist richtig operationalisiert: Für die Entscheidung zählt Prognosewetter, nicht später bekanntes Ist-Wetter.

## 3. Reproduzierte Kernergebnisse

### 3.1 Zeitliche Aufteilung

| Abschnitt | Beobachtungen | Zeitraum | mittlere Fahrten |
|---|---:|---|---:|
| Training | 1.647 Tage | 24.08.2021–25.02.2026 | 53,7 |
| Validierung | 90 Tage | 26.02.2026–26.05.2026 | 65,8 |
| Test | 90 Tage | 27.05.2026–24.08.2026 | 111,8 |

Die Aufteilung ist chronologisch. Modell und Sicherheitsaufschlag werden auf der Validierung gewählt; der Test wird danach ausgewertet.

### 3.2 Validierung unter simuliertem Prognosewetter

| Verfahren | MAE | RMSE | R² |
|---|---:|---:|---:|
| Trainingsmittel | 25,80 | 34,58 | −0,140 |
| Vorwochenregel | 29,73 | 38,41 | −0,406 |
| **Lineare Regression** | **13,90** | **17,21** | **0,718** |
| Gradient Boosting | 14,34 | 20,21 | 0,611 |

Die lineare Regression wird nach dem simulierten Betriebsinformationsstand gewählt. Mit Ist-Wetter läge das Boosting knapp vorn. Diese Trennung ist fachlich richtig.

### 3.3 Test

| Kennzahl | Ergebnis |
|---|---:|
| MAE mit simuliertem Prognosewetter | 22,93 Fahrten |
| Fehlerreduktion gegenüber Vorwoche | 35 % |
| Kostenproxy Modell | 3.140 EUR beziehungsweise 34,89 EUR je Tag |
| Kostenproxy Vorwoche | 6.818 EUR beziehungsweise 75,75 EUR je Tag |
| Kriterium ≥ 30 % Fehlerreduktion | 290 von 300 simulierten Wetterpfaden |
| geringerer Kostenproxy | 300 von 300 Wetterpfaden |

Die Formulierung „Machbarkeitsindiz – kein Nachweis“ ist angemessen.

## 4. Stärken

- Zeitliche Train-/Validation-/Testtrennung ist nachvollziehbar.
- Vorwochenregel und Trainingsmittel sind echte Baselines.
- Alle vier Wetterfelder werden im simulierten Informationsstand verändert.
- Mittel- und Maximaltemperatur werden physikalisch konsistent simuliert.
- Modellwahl und Aufschlag erfolgen vor dem Test.
- Ist-Wetter wird nur diagnostisch gezeigt.
- Kalendergültigkeit, Merkmalsreihenfolge, fehlende Wetterfelder und unplausible Werte werden geprüft.
- Unsicherheit wird nicht auf einen Einzelpfad reduziert.
- Sprache, Aufbau und Erklärungen sind überwiegend sehr gut.

## 5. Verbleibende Mängel

### P0.1 Der gewählte Aufschlag liegt am Rand des Suchraums

Getestet werden Aufschläge von 0 bis 30 %. Der ausgegebene Optimumwert ist **30 %**, also genau der größte geprüfte Wert.

Damit ist nicht nachgewiesen, dass 30 % optimal sind. Es ist lediglich nachgewiesen, dass innerhalb des begrenzten Suchbereichs der größte Wert am besten war. Dieses Problem entspricht methodisch dem früheren Kapazitätsproblem in Notebook 02: Ein Randminimum darf nicht als gefundenes Optimum bezeichnet werden.

**Abhilfe:** Suchraum erweitern und prüfen, ob ein inneres Minimum entsteht. Fachlich besser ist die bereits selbst genannte Quantilsregression für das 83,3-%-Quantil. Modell und Quantil müssen ausschließlich auf der Validierung gewählt werden.

### P1.1 Nur ein Validierungs- und ein Testfenster trotz fünf Jahren Daten

Die neue Datenbasis umfasst 1.827 Tage, aber die Verfahrensentscheidung beruht weiterhin auf einem einzigen 90-Tage-Validierungsfenster und einem 90-Tage-Testfenster. Der Testmittelwert von 111,8 liegt mehr als doppelt so hoch wie der Trainingsmittelwert von 53,7. Das zeigt einen erheblichen Struktur-/Niveaueffekt.

**Abhilfe:** Rollierende Ursprungsauswertung über mehrere Jahreszeiten und Jahre. Je Fold müssen Modell, Prognosewetter und Aufschlag ausschließlich aus der jeweiligen Vergangenheit entstehen.

### P1.2 Modellwahl hängt an einer einzelnen Wetterfehlerziehung

Die lineare Regression wird anhand eines einzigen simulierten Validierungswetterpfads gewählt. Die 300 Pfade werden erst auf dem Test zur Robustheitsbeschreibung eingesetzt.

**Abhilfe:** Modellwahlstabilität bereits auf der Validierung über viele plausible Wetterpfade prüfen. Vor dem Test eine feste Entscheidungsregel definieren, etwa mittlerer Kostenproxy oder konservatives Perzentil.

### P1.3 Wetterunsicherheit ist nur synthetisches additives Rauschen

Die simulierte Vorhersage wird um das beobachtete Ist-Wetter zentriert. Sie bildet damit weder Bias, zeitlich korrelierte Fehler, saisonal wechselnde Güte noch gemeinsame Fehler von Temperatur, Regen und Wind empirisch ab.

**Abhilfe:** Historisches Prognosearchiv verwenden oder die Simulation anhand realer 24-Stunden-Prognosefehler kalibrieren. Bis dahin deutlich als Sensitivitätsanalyse statt Forecast-Backtest bezeichnen.

### P1.4 Kalendermerkmale werden numerisch statt zyklisch/kategorial behandelt

`wochentag` und `monat` gehen als Ganzzahlen in die lineare Regression ein. Damit wird eine lineare Ordnung unterstellt, obwohl Sonntag neben Montag und Dezember neben Januar liegt.

**Abhilfe:** One-Hot- oder Sinus-/Kosinus-Kodierung verwenden und ausschließlich in der Validierung vergleichen.

### P1.5 Die 300 Wetterpfade sind keine 300 unabhängigen Testzeiträume

Sie variieren nur die Wetterfehler auf denselben 90 Tagen, mit denselben Nachfragewerten und demselben Modell. Modell-, Nachfrage-, Kalender- und Regimeunsicherheit bleiben unverändert.

**Abhilfe:** Im Text konsequent „300 bedingte Wettersimulationen auf demselben Testfenster“ schreiben und Prognoseintervalle beziehungsweise rollierende Zeitfenster ergänzen.

## 6. Freigabe Notebook 04

| Einsatz | Urteil |
|---|---|
| technische Ausführung | **freigabefähig** |
| Lehrfassung | **bedingt freigabefähig** – nach Korrektur des Randoptimums |
| synthetische Machbarkeitsstudie | **ja, mit dokumentierten Grenzen** |
| operative Nachfrageplanung | **nein** |
| Fahrrad-/Personaldisposition | **nein; Übersetzungsmodell fehlt** |

**Bewertung:** 8,0/10.

---

# Teil B – Notebook 05: Assoziation und Wege im Netz

## 7. Forschungsfrage

Die Forschungsfrage ist als **explorative Analyse gerichteter Start-Ziel-Muster** sinnvoll. Methodisch handelt es sich weniger um klassische Warenkörbe oder mehrgliedrige Wegesequenzen als um kontextbedingte OD-Beziehungen:

> Ist ein bestimmtes Ziel bei Fahrten von einer Startstation innerhalb desselben Zeitkontexts häufiger, als anhand der allgemeinen Zielbeliebtheit in diesem Kontext zu erwarten wäre?

Diese Frage kann stabile Verkehrsbeziehungen beschreiben. Sie kann allein weder Bestandsknappheit noch einen Umverteilungsauftrag beweisen. Das Notebook grenzt dies in der späteren Saldenanalyse grundsätzlich gut ab.

## 8. Reproduzierte Kernergebnisse

| Kennzahl | Ergebnis |
|---|---:|
| abgeschlossene Fahrten | 104.401 |
| Warenkörbe der Regelsuche | 93.370 |
| Regeln ab 0,5 % Suchsupport | 43 |
| Regeln mit Support ≥ 1 % | 6 |
| Regeln mit Kontextlift ≥ 1,3 | 13 |
| Regeln mit konkreter Zielstation | 33 |
| Regeln, die alle drei Kriterien erfüllen | **2** |

Die beiden aktuell regelkonformen Verbindungen sind:

| Kontext | Start | Ziel | Fahrten | Support | Konfidenz | Kontextlift |
|---|---|---|---:|---:|---:|---:|
| Werktag, früh | Juliuspromenade | Grombühl Klinikum | 1.236 | 1,32 % | 30,0 % | 1,77 |
| Werktag, früh | Grombühl Klinikum | Hauptbahnhof | 1.098 | 1,18 % | 29,5 % | 1,55 |

In der zeitlichen Entdeckung werden 11 Regeln ausgewählt; 9 behalten im späteren Zeitraum einen Kontextlift von mindestens 1,3 und alle 11 bleiben über Lift 1.

## 9. Stärken

- Kontextbedingter und klassischer Lift werden sauber unterschieden.
- Die Testfamilie wird mit 800 Kombinationen statt nur den vorgefilterten Regeln angesetzt.
- Die fehlende Unabhängigkeit wiederholter Personen und Tage wird offen benannt.
- Entdeckung und zeitliche Bestätigung sind getrennt.
- Richtungs- und Rückrichtungsregeln werden nicht automatisch als Pendelfahrt interpretiert.
- Stationssalden und frei abgestellte Räder werden getrennt analysiert.
- Langfristmittel und tagesbezogene Ungleichgewichte werden unterschieden.
- Exportdateien heißen ausdrücklich nicht „Plan“ und enthalten Warnmetadaten.

## 10. P0-Widersprüche des aktuellen Datenstands

### P0.1 Code findet zwei Regeln, der Text behauptet weiterhin null

Der aktuelle Lauf druckt zwei Regeln, die Support-, Lift- und Zielkriterium erfüllen. Unmittelbar danach stehen jedoch:

- „Die brauchbaren Regeln – es gibt keine“;
- „Die Tabelle ist leer“;
- „Keine einzige Regel erfüllt beide Schwellen“;
- „Es wurde keine einzige Regel freigegeben“;
- die Schlussübersicht mit null Regeln.

Dies ist der zentrale Freigabeblocker. Forschungsbefund, Codeausgabe, Schlussfolgerung und Deploymentstatus gehören zu verschiedenen Datenständen.

**Abhilfe:** Zuerst fachlich entscheiden, was die drei Kriterien bedeuten. Danach entweder die zwei Regeln als statistisch kriteriumskonform, aber nicht betrieblich freigegeben ausweisen, oder ein neues betriebliches Gate ergänzen. Keinesfalls die vorhandenen Treffer sprachlich zu null erklären.

### P0.2 Zahlreiche alte Kennzahlen sind verblieben

Der Text nennt weiterhin unter anderem:

- 32 Regeln statt aktuell 43;
- größten korrigierten p-Wert 0,00230 statt aktuell gerundet 0,00000;
- eine supportstärkste Hauptbahnhof-Hubland-Regel mit 505 Fahrten und 0,99 %;
- einen Abstand von fünf Fahrten zur Ein-Prozent-Hürde;
- 0,68 gegenüber 0,69 Fahrten je Werktag;
- null Hin- und Rückfahrten am selben Tag.

Aktuell ist die supportstärkste Regel Juliuspromenade → Grombühl mit 1.236 Fahrten und 1,32 % Support. Die Gegenprobe findet eine gleich­tägige Hin-/Rückkombination, nicht null.

### P0.3 Die Ausgabe formuliert negative Abstände als „fehlend“

Für die supportstärkste Regel druckt der Code:

> „Zur Hürde fehlen −0,32 Prozentpunkte“ und „Abstand −302 Fahrten“.

Die Regel liegt oberhalb der Hürde. Negative „fehlende“ Werte sind sprachlich und logisch falsch.

**Abhilfe:** Ergebnisabhängig „überschreitet um“ oder „verfehlt um“ ausgeben.

### P0.4 Zeitangaben „in drei Jahren“ sind veraltet

Die Daten reichen nun über rund fünf Jahre und enthalten 1.261 Werktage. Mehrere Texte sprechen weiterhin von drei Jahren. Dadurch werden betriebliche Raten und Abstände falsch eingeordnet.

## 11. Weitere methodische Restpunkte

### P1.1 Kriterienerfüllung ist keine Einsatzfreigabe

Die zwei Regeln sind statistisch und technisch kriteriumskonform. Für eine Transporterentscheidung fehlen weiterhin aktuelle Bestände, Stationskapazitäten, freie Abstellorte, Eingriffszeitpunkt, Tourkosten und ein Mindestnutzen.

**Abhilfe:** Ein separates Betriebsfreigabegate definieren. Die Regeln können als explorative OD-Muster bestehen bleiben, ohne einen Einsatzplan zu erzeugen.

### P1.2 Fisher-Test unterschätzt Abhängigkeit

Fahrten derselben Person und desselben Tages sind nicht unabhängig. Bonferroni korrigiert Mehrfachsuche, aber nicht Clusterabhängigkeit.

**Abhilfe:** Blockbootstrap über Tage und – soweit verfügbar – Personen; Konfidenzintervalle für Lift und Support im Bestätigungszeitraum.

### P1.3 Ein einziger zeitlicher Schnitt

Die zeitliche Bestätigung ist sinnvoll, aber ein einzelner Zwei-Drittel-Schnitt kann saisonale oder strukturelle Veränderungen verbergen.

**Abhilfe:** Rollierende Zeitfenster und Mindeststabilität über mehrere Perioden.

### P1.4 „Warenkorb“ und „Weg“ nicht überdehnen

Jede Fahrt enthält genau einen Start, ein Ziel und einen Kontext. Es werden keine mehrgliedrigen Wegeketten gefunden. Die Regeln beschreiben bedingte OD-Häufigkeiten, keine tatsächlichen Reiseketten oder kausalen Beweggründe.

### P1.5 Salden sind weiterhin keine Umverteilungsbedarfe

Der theoretische Wert von durchschnittlich 25,7 Rädern bei Ausgleich nach jedem Fenster beziehungsweise 17,3 am Tagesende hängt vollständig von der Aggregations- und Eingriffsannahme ab. Anfangsbestand, Zielbestand und verlorene Nachfrage fehlen.

## 12. Freigabe Notebook 05

| Einsatz | Urteil |
|---|---|
| technische Ausführung | **freigabefähig** |
| Lehr-/Abgabeversion | **nicht freigabefähig, bis P0-Texte korrigiert sind** |
| explorative OD-Analyse nach Textkorrektur | **freigabefähig** |
| operative Umverteilung | **nicht freigabefähig** |
| Transporter-/Einsammelplan | **nicht freigabefähig** |

**Bewertung:** Methodisches Konzept 8,5/10; aktuelle Konsistenz 4,5/10; Gesamt 6,5/10.

---

# Teil C – Notebook 06: Anomalieerkennung

## 13. Forschungsfragen

Die Trennung in drei Produkte ist fachlich richtig:

1. **A1 – offene Rückgaben:** deterministische Echtzeitregel ab acht Stunden;
2. **A2 – auffällige abgeschlossene Fahrten:** unüberwachte Tagesliste im Schattenbetrieb;
3. **B – auffällige Stationstage:** Nulltage-/Episodenregel, aktuell nicht freigegeben.

Die drei Aufgaben besitzen unterschiedliche Beobachtungseinheiten, Entscheidungszeitpunkte, Labels und Kosten. Sie dürfen nicht über eine gemeinsame Trefferquote bewertet werden.

## 14. Reproduzierte Kernergebnisse

### A1 und A2

| Kennzahl | Ergebnis |
|---|---:|
| abgeschlossene Fahrten | 104.401 |
| Referenzfahrten | 62.964 |
| Prüffahrten | 41.437 |
| bekannte Langfahrten über acht Stunden | 67 |
| tägliche A2-Läufe | 609 |
| vollständig verarbeitete Prüfvorgänge | 41.437 |
| ausgegebene Listeneinträge | 194 |
| durchschnittliche Listenlänge | 0,32 |
| bekannte Langfahrten in der Liste | 24 |
| Precision gegen diese Teilwahrheit | 12,37 % |
| leere Tageslisten | 77 % der Tage |

Die frühere Auswahl nach Starttag wird nun mit 180 statt 194 Meldungen und 10 statt 24 Langfahrten ausgewiesen. Die produktive Kohorte nach Abschlusszeitpunkt ist damit nachvollziehbar besser definiert.

### B – Stationsepisoden

| Kennzahl | Ergebnis |
|---|---:|
| Störungsereignisse insgesamt | 26 |
| gestörte Stationstage | 101 |
| Episoden im Prüfzeitraum | 11 |
| tägliche Rohmeldungen | 497 |
| neue Alarme | 363 |
| Precision je Rohmeldung | 9,7 % |
| Precision je neuem Alarm | **3,0 %** |
| Episoden erkannt – Rohmeldungen | 11 von 11 |
| Episoden erkannt – neue Alarme | 11 von 11 |

Die eigene wirtschaftliche Mindestprecision beträgt 7,7 %. Mit 3,0 % ist Aufgabe B zu Recht nicht freigegeben.

## 15. Stärken

- A1, A2 und B sind als getrennte Produkte definiert.
- Referenz- und Prüfpopulation von A2 werden nach Abschlusszeitpunkt getrennt.
- Jeder Prüfvorgang wird genau einmal verarbeitet.
- Globale Rangliste und tatsächlich erzeugbare Tagesliste werden unterschieden.
- Der erste Isolation Forest wird nach Sichtprüfung der Extremfälle verworfen.
- Normierung erfolgt radtypspezifisch und nur aus dem Referenzzeitraum.
- Schwelle stammt aus dem Referenzzeitraum und darf leere Listen erzeugen.
- Freie Abstellungen, fehlende Schlüssel, unbekannte Radtypen und falsche Statuswerte werden im Rohdatenvertrag geprüft.
- A2 bleibt ausdrücklich im Schattenbetrieb; A1 und B werden nicht als produktiv bezeichnet.
- Das Modellpaket enthält Pipeline, Referenzwerte, Cutoff mit Uhrzeit und Freigabestatus.

## 16. P0-Widersprüche

### P0.1 Der gesamte erklärende B-Abschnitt verwendet noch alte Resultate

Die aktuelle Codeausgabe nennt 497 Rohmeldungen, 363 neue Alarme, 3,0 % Precision und 11 von 11 erkannte Episoden auf beiden Ebenen.

Der unmittelbar folgende Markdownabschnitt nennt dagegen:

- 381 Rohmeldungen;
- 259 neue Alarme;
- 13,4 % und 3,9 % Precision;
- 10 von 11 Episoden bei neuen Alarmen;
- 122 Wiederholungen;
- eine innerhalb einer Nullserie verpasste Episode.

Auch Kommentare im aktuellen Code beziehen sich weiterhin auf 381 und 259. Damit stehen zwei unterschiedliche Auswertungen nebeneinander. Der Schlussabschnitt verwendet teilweise die neuen Werte, wodurch der Widerspruch innerhalb derselben Datei noch deutlicher wird.

**Abhilfe:** Den gesamten Abschnitt 5.8 einschließlich Tabellen, Interpretation, Kommentaren und Schlussfolgerung aus den aktuellen Ergebnisvariablen neu erzeugen. Die Behauptung der verpassten Episode darf nur stehen bleiben, wenn sie mit der aktuellen Ticketlogik tatsächlich reproduziert wird.

### P0.2 A1 nennt weiterhin 45 von 45 statt 67 von 67

Im Deploymenttext steht, A1 finde „45 von 45“. Der aktuelle Datenstand enthält 67 bekannte Langfahrten. Die Logik bleibt tautologisch vollständig, die Zahl ist aber veraltet.

### P0.3 Beschreibung der Nulltage ist veraltet

Der Text spricht von rund tausend Null-Stationstagen und ungefähr jedem zehnten als Störung. Aktuell gibt es 1.845 Null-Stationstage und 101 dokumentierte Störungstage – grob jeder achtzehnte.

### P0.4 Projektweite Schlussübersicht ist nicht zuverlässig aktuell

Notebook 06 fasst alle sechs Notebooks zusammen. Mehrere Aussagen zu den Notebooks 01 bis 05 stammen erkennbar aus früheren Fassungen. Eine projektweite Freigabeübersicht darf nicht manuell im letzten Notebook dupliziert werden.

**Abhilfe:** Diese Übersicht aus einer zentralen, versionierten Statusdatei erzeugen oder auf eine rein qualitative Zusammenfassung ohne flüchtige Einzelergebnisse reduzieren.

## 17. Weitere methodische Restpunkte

### P1.1 A1 validiert sich gegen seine eigene Definition

Die bekannte Teilwahrheit lautet `dauer_min > 480`; die Regel prüft denselben Ausdruck. Der Recall von 100 % ist logisch zwingend und kein empirischer Gütenachweis. Das Notebook erklärt dies grundsätzlich korrekt.

Vor Betrieb fehlen Echtzeitquelle, Ausnahmeliste erlaubter Langzeitmieten, Alarmkanal, Reaktionszeit und reale Fehlalarmquote.

### P1.2 A2 besitzt keine vollständige Wahrheit

Die 67 Langfahrten sind nur eine bekannte Teilklasse. 12,37 % ist daher weder wahre Precision noch Recall der Anomalieerkennung. Ein Schattenbetrieb braucht Urteile zu Alarmen und eine Zufallsstichprobe nicht gemeldeter Vorgänge.

### P1.3 Mittelwert und Standardabweichung sind für Anomalien empfindlich

Die typbezogene Normierung wird von den Extremwerten beeinflusst, die gefunden werden sollen. CARGO bleibt in den Top 50 deutlich überrepräsentiert.

**Abhilfe:** Robuste Skalierung über Median/MAD sowie getrennte Modelle je Radtyp vergleichen – ausschließlich aus der Referenzpopulation.

### P1.4 `ist_rundtour` ist kein klarer Prüfgrund

Rundtouren sind ein normales Nutzungsmuster. Ein Merkmal sollte nur dann einen Alarm treiben, wenn daraus eine konkrete Prüfhandlung folgt oder seine Interaktion mit anderen Merkmalen empirisch problemrelevant ist.

### P1.5 B benötigt Zustands- und bessere Sensordaten

Auch wenn aktuell beide Ebenen 11 von 11 Episoden berühren, fehlt eine belastbare Ticketzustandsmaschine. Vor allem wäre der Terminalstatus die sachgerechtere Datenquelle; dann wäre die Aufgabe eher Zustandsabfrage als Anomalieschätzung.

### P1.6 Monitoringgrenzen bleiben teilweise unbestimmt

Formulierungen wie „weicht deutlich ab“ müssen für einen realen Betrieb durch Referenzfenster, Warn-/Stoppschwellen, Mindestfallzahlen und Verantwortlichkeiten ersetzt werden.

## 18. Freigabe Notebook 06

| Produkt/Einsatz | Urteil |
|---|---|
| technische Notebookausführung | **freigabefähig** |
| Lehr-/Abgabefassung | **nicht freigabefähig, bis P0-Texte korrigiert sind** |
| A1 Spezifikation | **fachlich plausibel, nicht implementiert/freigegeben** |
| A2 Schattenbetrieb | **als Konzept plausibel; keine Betriebsfreigabe** |
| B Stationsregel | **nicht freigegeben** |
| reale Gesamtanwendung | **nicht freigegeben** |

**Bewertung:** Methodisches Konzept 8,5/10; aktuelle Konsistenz 5/10; Gesamt 7,0/10.

---

# 19. Gemeinsame priorisierte To-do-Liste

## P0 – vor einer gemeinsamen Lehr-/Abgabefreigabe

### Notebook 04

- [ ] Aufschlagsuche über 30 % hinaus erweitern oder durch Quantilsregression ersetzen.
- [ ] Sicherstellen, dass das gewählte Optimum nicht am Rand des Suchraums liegt.

### Notebook 05

- [ ] Sämtliche Aussagen „keine Regel“ auf den aktuellen Befund von zwei kriteriumskonformen Regeln umstellen.
- [ ] Aktuelle Regelzahlen, p-Werte, Supportwerte, Fahrtenzahlen und Pendel-Gegenprobe einsetzen.
- [ ] Negative „fehlende“ Abstände in „überschreitet um“ umformulieren.
- [ ] Alle Drei-Jahres-Angaben auf den aktuellen Zeitraum korrigieren.
- [ ] Statistische Kriterienerfüllung und betriebliche Nichtfreigabe als zwei getrennte Gates ausweisen.

### Notebook 06

- [ ] Abschnitt 5.8 vollständig mit den aktuellen B-Ergebnissen neu schreiben.
- [ ] Alte Codekommentare zu 381/259 ebenfalls aktualisieren.
- [ ] A1 von 45 auf 67 Langfahrten aktualisieren.
- [ ] Nulltagebeschreibung auf 1.845 beziehungsweise 101 anpassen.
- [ ] Projektweite Schlussübersicht zentralisieren oder vollständig aktualisieren.

## P1 – für methodisch belastbare nächste Fassungen

- [ ] Notebook 04: rollierende Backtests über mehrere Jahre und Jahreszeiten.
- [ ] Notebook 04: Modellwahl über mehrere Validierungs-Wetterpfade; empirische Forecastfehler verwenden.
- [ ] Notebook 04: Kalendermerkmale sachgerecht kodieren und Prognoseintervalle ergänzen.
- [ ] Notebook 05: Blockbootstrap und rollierende Regelstabilität.
- [ ] Notebook 05: Bestands-, Kapazitäts- und Kostendaten vor jedem operativen Umverteilungsprodukt.
- [ ] Notebook 06: robuste Normierung/getrennte Typmodelle und echte Schattenlabels.
- [ ] Notebook 06: Terminalstatus und Ticketzustandslogik für Stationsstörungen.
- [ ] Alle drei: Ergebnisprosa möglichst aus zentralen Ergebnisobjekten erzeugen.

## P2 – Wartbarkeit und Governance

- [ ] Automatischen Test auf bekannte Altwerte und widersprüchliche Freigabestatus einführen.
- [ ] Notebookbau, Datencommit, GitHubdatei und README gemeinsam versionieren.
- [ ] Freigabestatus nicht mehrfach manuell in verschiedenen Notebooks pflegen.
- [ ] Deploymentartefakte mit Datenhash, Stichtag, Gültigkeit und Status versehen.

# 20. Abschließende Güteeinschätzung

| Notebook | Methodisches Konzept | aktuelle Konsistenz | Gesamt |
|---|---:|---:|---:|
| 04 Zeitreihe | 8,5/10 | 8/10 | **8,0/10** |
| 05 Assoziation | 8,5/10 | 4,5/10 | **6,5/10** |
| 06 Anomalie | 8,5/10 | 5/10 | **7,0/10** |

## Schlussentscheidung

**Die drei aktuellen Fassungen sind technisch stabil, aber noch nicht gemeinsam freigabefähig.**

Notebook 04 benötigt eine klar begrenzte methodische Korrektur der Aufschlagswahl und sollte danach als synthetische Machbarkeitsstudie weitergegeben werden können. Notebook 05 und Notebook 06 benötigen keine vollständige Neukonzeption; sie müssen jedoch konsequent auf den neuen Datenstand umgeschrieben werden. Solange Codeausgaben und Schlussfolgerungen einander widersprechen, ist auch eine reine Lehrfreigabe nicht vertretbar.

Für einen realen Betrieb bleibt die Freigabe bei allen drei Notebooks verweigert: 04 liefert noch keine Räder-/Personalplanung, 05 keinen bestandsbasierten Umverteilungsplan und 06 nur eine Spezifikation, einen Schattenbetrieb und eine ausdrücklich gesperrte Stationsregel.
