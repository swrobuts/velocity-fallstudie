# Erneuter Recheck: `01_Regression_Fahrtdauer.ipynb`

**Prüfdatum:** 1. September 2026  
**Geprüfte Datei:** `/Users/robert/Downloads/01_Regression_Fahrtdauer.ipynb`  
**SHA-256:** `54cd1b225da4dd05a075aae1b0c6bffb7f0f37396c2f51206a36195d6a7c1796`  
**Ausführung:** 24 von 24 Codezellen vollständig ausgeführt, keine Zellfehler  
**Festgeschriebener Datenstand:** Git-Commit `316b3db6532966693909430503b3ba597077754f`

## Kurzurteil

**Die beiden wichtigsten technischen Blocker des letzten Reviews sind behoben. Das Notebook ist als analytisches Projekt fast abgabereif, als reales Produkt aber weiterhin nicht freigabefähig.**

Die Offlinebewertung und die App-Funktion behandeln kundenspezifisch zu breite Spannen jetzt identisch. Nicht freigegebene beziehungsweise ungeprüfte Tabellenzeilen werden tatsächlich aus dem Export entfernt. Die Datenquelle ist nicht mehr der veränderliche Zweig `main`, sondern ein fester Git-Commit.

Vor einer fachlichen Endabnahme bleiben jedoch drei wesentliche Punkte:

1. Der deklarierte Geltungsbereich schließt Rundfahrten aus; die zentrale Test-1-Bewertung der Punktschätzung enthält sie trotzdem.
2. Der Schlussabschnitt enthält weiterhin zahlreiche Aussagen aus einer älteren Version und widerspricht den aktuellen Ergebnissen.
3. Test 2 ist Kalibrierungsmaterial. Die unabhängige Prüfung mit einem tatsächlich vorab gespeicherten Ziel im Schattenbetrieb fehlt weiterhin.

## Freigabeentscheidung

| Freigabeart | Urteil |
|---|---|
| Technische Ausführbarkeit des Notebooks | **bestanden** |
| Methodische Abgabe als Fallstudie | **nach Korrektur der P0-Punkte vertretbar** |
| Sichtbare Freigabe in einer realen App | **noch nicht freigeben** |

**Analytische Gesamtgüte: etwa 8/10.**  
**Sprachliche und inhaltliche Konsistenz: etwa 6/10.**  
**Betriebliche Freigabereife: noch nicht gegeben.**

## Gegenüber dem letzten Review erfolgreich behoben

### 1. Kundenspezifische Nützlichkeitsregel und App sind jetzt konsistent

Die Tabelle wird weiterhin zunächst mit dem Basistarif vorgefiltert. Zusätzlich wird nun je Kunde geprüft, ob die konkrete Preisspanne bei dessen Restfreiminuten und Rabatt die 60-%-Regel erfüllt.

Die unabhängige Gegenrechnung bestätigt:

| Prüfung | Ergebnis |
|---|---:|
| Fälle mit grundsätzlich vorhandener Tabellenspanne | 5.420 |
| kundenspezifisch zu breit und deshalb abgelehnt | 252 |
| final angezeigte Test-2-Fälle | **5.168** |
| Offlinebewertung und Laufzeitfunktion identisch | **ja** |

Die App-Funktion enthält nun dieselbe Prüfung wie die Evaluation. Der frühere Fehler, bei dem 252 in der Bewertung verworfene Fälle später trotzdem angezeigt worden wären, ist behoben.

### 2. Widerlegte und ungeprüfte Kombinationen werden nicht mehr ausgeliefert

Der Status wird jetzt über eine zentrale Funktion vergeben. Kombinationen ohne Test-2-Beleg werden als `ungeprueft` markiert und vor dem Export gesperrt. In der geprüften Ausführung wurden drei solche Zeilen entfernt.

Das finale Artefakt enthält:

| Status | Zeilen |
|---|---:|
| `gestuetzt` | 48 |
| `unbestimmt` | 45 |
| `unzureichend` | 255 |
| `widerlegt` | 0 |
| `ungeprueft` | 0 |
| **gesamt** | **348** |

Es gibt keine doppelten fachlichen Schlüssel. Alle exportierten Statuswerte gehören zur ausdrücklich definierten Menge `AUSLIEFERBAR`.

### 3. Wilson-Logik wird auf Radtypebene verwendet

Die Radtypfreigabe verwendet nicht mehr nur den Punktschätzer, sondern die Wilson-Untergrenze. Alle drei Radtypen bestehen auf Test 2:

| Radtyp | angezeigte Fälle | Abdeckung | 95-%-Wilson-Intervall |
|---|---:|---:|---:|
| CARGO | 394 | 92,9 % | 89,9–95,0 % |
| CITY | 2.824 | 93,3 % | 92,3–94,2 % |
| EBIKE | 1.950 | 93,0 % | 91,8–94,0 % |

### 4. Preisberechnung bleibt korrekt

Die vollständige Tariflogik berücksichtigt weiterhin Aufrundung, Startgebühr, Restfreiminuten, Minutenpreis, Tagesdeckel und Rabatt. Die Nachrechnung stimmt auf Test 1 in 100,00 % der Fälle exakt mit `entgelt_eur` überein.

### 5. Reproduzierbarkeit wurde deutlich verbessert

Die Standarddatenquelle verweist nun auf den festen Commit:

```text
316b3db6532966693909430503b3ba597077754f
```

Damit ändern sich die Eingangsdaten nicht mehr unbemerkt, wenn sich der GitHub-Zweig `main` weiterentwickelt. Auch die alte, ungeeignete Tarifversion aus der bloßen Summe der Minutenpreise wurde durch eine inhaltsabhängige Kennung ersetzt.

### 6. Frühere Textfehler wurden teilweise korrigiert

Korrigiert sind unter anderem:

- CITY **und** EBIKE erfüllen das mittlere 50-Cent-Kriterium; nur CARGO reißt es.
- Ein behaupteter saisonaler Fehleranstieg wurde zurückgenommen.
- Die Ablation wird nicht mehr als Beweis dargestellt, dass der Random Forest alle Information ausgeschöpft habe.
- Die finale Erläuterung nennt nun grundsätzlich alle drei Radtypen und 47 % Reichweite.

## Verbleibende Freigabeblocker

### P0.1 – Die Test-1-Bewertung verletzt den eigenen Geltungsbereich

Phase 1 definiert ausdrücklich:

> Nur Fahrten mit verschiedenem Start und Ziel; für Rundfahrten zeigt die App nichts an.

Trotzdem werden Rundfahrten im Training, in der Validierung und vor allem in der zentralen Test-1-Preistabelle mitbewertet. Von den 10.895 Test-1-Fahrten sind 1.337 Rundfahrten. Diese haben einen Dauer-MAE von 13,68 Minuten und einen Preisfehler von 1,68 €, während echte Wege insgesamt nur 3,27 Minuten beziehungsweise 0,29 € erreichen.

Dadurch beurteilt die zentrale Tabelle ein anderes Produkt als das in Phase 1 definierte.

Die unabhängige Auswertung nur für echte Wege ergibt:

| Radtyp | Fälle | Dauer-MAE | mittlerer Preisfehler | Anteil unter 0,50 € |
|---|---:|---:|---:|---:|
| CARGO | 1.190 | 4,18 min | 1,02 € | 63,4 % |
| CITY | 5.341 | 3,48 min | 0,16 € | 88,7 % |
| EBIKE | 3.027 | 2,54 min | 0,25 € | 80,3 % |

CARGO verfehlt das Kriterium also auch im korrekten Geltungsbereich; die inhaltliche Hauptrichtung bleibt bestehen. Die berichteten Werte und die Begründung des Rücksprungs ändern sich aber deutlich.

**Korrektur:** Für Modellwahl, Ablation und Test-1-Geschäftsbewertung konsequent eine in-scope-Menge `ist_rundtour == 0` verwenden. Rundfahrten dürfen separat als Negativbeispiel analysiert werden, aber nicht die Freigabekennzahl des ausgeschriebenen Produkts beeinflussen. Idealerweise wird auch das Punktmodell nur auf echten Wegen trainiert und erneut gegen die Routenbaseline geprüft.

### P0.2 – Der Schlussabschnitt widerspricht weiterhin der aktuellen Ausführung

Im abschließenden CRISP-DM-Überblick stehen noch alte Aussagen:

| Stelle | aktuelle Aussage | tatsächliches Ergebnis |
|---|---|---|
| Phase 4 | Ablation zeige, „wie wenig“ das Ziel beiträgt | Ziel reduziert den MAE um 56 % |
| Phase 5 | zwei Radtypen hätten kein Produkt | beim Punktkriterium scheitert nur CARGO |
| Phase 6 | ausgeliefert werde nur CITY | Artefakt enthält CARGO, CITY und EBIKE |
| offener Punkt 6 | kein Produkt für E-Bike und Lastenrad | Intervallprodukt enthält beide |
| Kandidatenentscheidung | Tabelle ende „nur für CITY“ | finale Tabelle enthält alle drei Radtypen |

Weitere zu korrigierende Textstellen:

- In Abschnitt 3.3 steht, auf Test 2 werde „ein Radtyp ausgeschlossen“. Tatsächlich werden alle drei freigegeben.
- Test 1 wird als „Winter und Frühjahr“ bezeichnet, reicht aber von August 2025 bis April 2026 und umfasst damit auch Sommer und Herbst.
- In 5.5 steht weiterhin „für ein Viertel der Fahrten“, obwohl bei CITY auf der dort verwendeten Menge 16 % außerhalb von 50 Cent liegen; im korrekten Geltungsbereich sind es nur 11,3 %.
- Der Satz „Das Modell ist genau, wo gefahren wird, um anzukommen“ stellt eine nicht gemessene Erklärung als Tatsache dar. Der Fahrtzweck ist nicht im Datensatz enthalten.
- Test 2 wird an einzelnen Stellen weiterhin „unberührt“ genannt, obwohl die Exploration den gesamten Datensatz gesehen hat und Test 2 später zur Kalibrierung dient.

Diese Widersprüche sind für eine Fallstudie besonders problematisch, weil der Text ausdrücklich behauptet: „Ausgeliefert wird, was gemessen wurde. Nicht das, was im Text steht.“ Der eigene Schluss erfüllt diesen Anspruch derzeit noch nicht.

### P0.3 – Der unabhängige Schattenbetrieb fehlt weiterhin

Test 2 wird für Intervallbewertung, Radtypfreigabe und Statusbildung verwendet. Er ist daher kein unabhängiger Endtest. Das Notebook erklärt dies korrekt.

Außerdem enthält der historische Datensatz weiterhin nur das tatsächliche Ziel. Ob Nutzer in der App das geplante Ziel wählen und anschließend tatsächlich dort ankommen, ist unbekannt.

Vor einer sichtbaren App-Freigabe müssen deshalb mindestens folgende Schritte erfolgen:

1. Artefakt, Tarif, Code und Datenstand einfrieren.
2. Geplantes Ziel vor dem Entsperren speichern.
3. Schätzung berechnen, aber zunächst nicht anzeigen.
4. Tatsächliches Ziel, Dauer, Entgelt und Ablehnungsgrund ergänzen.
5. Zieltreue, Abdeckung, Breite und Reichweite auf dem neuen Zeitraum auswerten.
6. Erst danach das Produkt sichtbar schalten.

## Weitere methodische Restpunkte

### P1.1 – Reichweite verwendet zwei verschiedene Nenner

Der deklarierte Geltungsbereich schließt Rundfahrten aus. Innerhalb dieses Geltungsbereichs gibt die Tabelle für

```text
5.168 / 9.549 = 54,1 %
```

der Anfragen eine Auskunft.

Die später berichteten 47,4 % verwenden dagegen alle 10.895 Test-2-Fahrten einschließlich der 1.346 Rundfahrten:

```text
5.168 / 10.895 = 47,4 %
```

Beide Kennzahlen können sinnvoll sein, bedeuten aber etwas anderes:

- **54,1 %:** Reichweite innerhalb des fachlich definierten Produkts;
- **47,4 %:** Reichweite unter allen abgeschlossenen, stationär beendeten Fahrten einschließlich bewusst ausgeschlossener Rundfahrten.

Die Ausgabe „47,4 % der Fahrten im Geltungsbereich“ ist deshalb falsch beschriftet. Beide Werte sollten mit eindeutigem Nenner berichtet werden.

### P1.2 – Nur 48 von 348 Zeilen sind verbindungsbezogen gestützt

Das Produktversprechen ist ausdrücklich nur insgesamt und je Radtyp formuliert. Das ist zulässig, aber für die Benutzerwahrnehmung heikel:

- 48 Zeilen sind `gestuetzt`;
- 45 Zeilen sind `unbestimmt`;
- 255 Zeilen sind `unzureichend`.

Damit besitzen 300 von 348 ausgelieferten Kombinationen keine eigene statistische Stützung. Die App zeigt alle drei Statusklassen gleich an und gibt den Status nicht zurück.

**Korrektur:** Produktentscheidung explizit treffen:

- entweder nur `gestuetzt` sichtbar ausliefern und die geringere Reichweite akzeptieren;
- oder die aggregierte Zusage beibehalten, den Status aber mindestens an Monitoring und Support zurückgeben und sprachlich nicht den Eindruck einer verbindungsbezogenen Garantie erzeugen.

Die Monitoringregel „bei weniger als 20 Fällen Vorwoche weiterverwenden“ passt außerdem nicht zur initialen Auslieferung von 255 `unzureichend`-Zeilen, für die noch keine Vorwoche existiert.

### P1.3 – Preisabhängige Fahrten bestehen das 80-%-Gate noch nicht sicher

Nach dem korrekten Laufzeitfilter ergeben sich:

| Guthabenlage | Fälle | Abdeckung | Wilson-Intervall |
|---|---:|---:|---:|
| Restguthaben deckt die tatsächliche Fahrt | 3.326 | 100,0 % | 99,9–100,0 % |
| Restguthaben reicht nicht | 1.842 | 80,8 % | **78,9–82,5 %** |

Für die preisabhängige Gruppe liegt die Untergrenze weiterhin unter den zugesagten 80 %. Das Notebook benennt diesen Punkt bereits ehrlich. Er muss im Schattenbetrieb als vorab definiertes Gate geprüft werden.

Die Gruppenbildung verwendet derzeit die tatsächliche Dauer und ist damit nur nachträglich möglich. Für eine operative Entscheidung sollte vorab anhand von Restguthaben und prognostizierten Intervallgrenzen zwischen sicher gedeckt, sicher preisabhängig und Grenzfall unterschieden werden.

### P1.4 – Versionsfelder sind verbessert, aber noch nicht vollständig korrekt

Die feste Daten-URL ist ein großer Fortschritt. Im CSV bleiben jedoch zwei Punkte:

1. `trainingsende` wird als `2024-12-16` exportiert. Die Perzentiltabelle wird aber aus `training + validierung + test1` bis zum **23.04.2026** gebaut. Das Feld ist daher irreführend und sollte beispielsweise `lernbasis_bis` heißen und den tatsächlichen Endzeitpunkt der Basis enthalten.
2. `DATENVERSION` hasht nur Anzahl der Ausleihen, späteste Startzeit und Entgeltsumme. Änderungen an Stationen, Fahrrädern, Routenmatrix, Feiertagen, Ferien oder einzelnen Ausleihwerten können damit unentdeckt bleiben. Der feste Git-Commit schützt zwar den Standardlauf, die erlaubte Umgebungsvariable `VELO_BASIS` kann aber andere Daten laden.

**Korrektur:** Git-Commit beziehungsweise vollständige SHA-256-Werte aller Eingabedateien, Notebook-/Codeversion, tatsächliches Ende der Lernbasis und Kalibrierungszeitraum exportieren.

### P1.5 – Testabdeckung der App-Funktion ist noch schmal

Die vorhandenen Proben testen:

- eine freigegebene Verbindung;
- Rundfahrt;
- fehlende Freigabe;
- unbekannte Station.

Der neu hinzugefügte Zweig „kundenspezifische Spanne zu breit“ wird nicht automatisch getestet. Ebenso fehlen Tests für ungültige Stunden, negative Restminuten, Rabatte außerhalb des zulässigen Bereichs und sämtliche Statusklassen.

**Korrektur:** Mindestens je einen positiven und negativen Test für jeden Ablehnungsgrund sowie eine Zusicherung ergänzen, dass Offlinebewertung und Laufzeitfunktion dieselbe Zahl von Fällen anzeigen.

### P1.6 – Die Tabellenlösung verliert Zeitinformation

Das Random-Forest- und Quantilmodell verwendet zyklische Stunde, Wochentag und Monat. Die finale Tabelle unterscheidet nur Tageszeitfenster. Wochentag und Saison gehen verloren. Das Notebook weist darauf hin, untersucht die Auswirkung auf die finale Tabelle aber nicht.

Vor einer Produktfreigabe sollte die statische Tabelle gegen vorab berechnete Quantilmodellwerte oder gegen stabil gegliederte Wochen-/Saisonsegmente verglichen werden.

### P2 – Weitere Qualitätsverbesserungen

- Die Mindestfallzahl 30 bleibt für 10-%- und 90-%-Ränder dünn; Bootstrap-, hierarchische oder conformale Intervalle prüfen.
- Die Acht-Stunden-Grenze bleibt eine unbelegte Geschäftsannahme.
- Archivierte Wetterprognosen könnten ein zulässiges zusätzliches Merkmal sein.
- App-Eingaben sollten validiert und Ablehnungsgründe strukturiert statt nur als Text geliefert werden.
- Das statische Frontend ist kein zwingender Grund gegen ein Modell: Modellwerte können vorab für alle zulässigen Kombinationen tabelliert werden. Das Notebook nennt diese Option bereits korrekt.

## Vollständiger Abgleich mit den früheren Prüfpunkten

| Prüffrage | aktueller Stand |
|---|---|
| neue Geschäftsfrage mit Zielauswahl | **erfüllt** |
| Zielstation ohne naive Leakage-Behauptung | **erfüllt, Proxy-Risiko bleibt offen** |
| zeitlicher Holdout | **für Punktmodell vorhanden** |
| Schattenbetrieb | **korrekt beschrieben, noch nicht durchgeführt** |
| Training/Validation/Test sauber getrennt | **grundsätzlich ja; Rundfahrten verletzen den Geltungsbereich der Test-1-Güte** |
| Preisfehler einschließlich Tarifdeckel | **erfüllt und gegen Daten verifiziert** |
| geeignete Baselines einschließlich Route | **erfüllt** |
| Preprocessing und unbekannte Kategorien | **erfüllt; App verweigert unbekannte Kombinationen** |
| Deployment-Freigaben | **technisch deutlich verbessert; 300/348 Zeilen nur aggregiert abgesichert** |
| App-Logik | **Offline-/Laufzeitfilter jetzt identisch** |
| Ausreißerbehandlung | **transparent, fachliche Begründung der Acht-Stunden-Grenze fehlt** |
| lineare Regression und Dummy-Kodierung | **fachlich sauber erläutert** |
| zyklische Zeitmerkmale | **im Modell erfüllt, in der finalen Tabelle teilweise verloren** |
| Versionierung | **deutlich verbessert, Exportmetadaten noch unvollständig** |
| Konsistenz der Aussagen | **noch nicht erfüllt** |

## Priorisierte To-do-Liste

### P0 – vor fachlicher Endabnahme

- [ ] Rundfahrten aus allen produktbezogenen Trainings-, Validierungs- und Test-1-Kennzahlen entfernen; separat analysieren.
- [ ] Test-1-Preisfehler und Rücksprungbegründung mit den In-Scope-Werten aktualisieren.
- [ ] Schlussübersicht, Kandidatenentscheidung und offene Punkte vollständig an das Drei-Radtypen-Artefakt anpassen.
- [ ] „Viertel“, „ein Radtyp ausgeschlossen“, „Winter und Frühjahr“, „wie wenig“ sowie die kausale Fahrtzweckaussage korrigieren.
- [ ] Reichweite als 54,1 % im Geltungsbereich und 47,4 % in der erweiterten Gesamtpopulation eindeutig beschriften.

### P1 – vor sichtbarer App-Freigabe

- [ ] Schattenbetrieb mit gespeichertem geplantem Ziel und unverändertem Artefakt durchführen.
- [ ] Preisabhängige Gruppe als vorab definiertes Gate aufnehmen.
- [ ] Policy für `gestuetzt`, `unbestimmt` und `unzureichend` mit Produktmanagement verbindlich festlegen.
- [ ] Status und strukturierte Ablehnungsgründe an Monitoring beziehungsweise App zurückgeben.
- [ ] `trainingsende` durch das tatsächliche Ende der Lernbasis ersetzen.
- [ ] vollständige Eingabedatei-, Code- und Artefaktversionen exportieren.
- [ ] neue Laufzeit- und Statuszweige automatisiert testen.

### P2 – Robustheit

- [ ] Mindestfallzahl und Quantilunsicherheit untersuchen.
- [ ] statische Tabelle gegen vorab berechnete Quantilmodellwerte vergleichen.
- [ ] Wochentag, Saison und zulässiges Prognosewetter prüfen.
- [ ] Acht-Stunden-Grenze fachlich absichern.

## Schlussfolgerung

Die neue Fassung ist ein deutlicher Fortschritt. Die früher kritisierte Differenz zwischen bewerteter und tatsächlich ausgegebener Preisspanne ist behoben, Statusfilter greifen nun wirklich, die Daten sind fest versioniert und alle drei Radtypen werden konsistent durch die Berechnung geführt.

**Für die analytische Fallstudie fehlt vor allem noch redaktionelle und methodische Konsistenz:** Die Güte muss auf demselben Geltungsbereich bewertet werden, für den die App angeboten wird, und der Schluss muss die aktuellen Resultate widerspiegeln.

**Für den realen Betrieb bleibt der Schattenbetrieb unverzichtbar.** Erst er kann die zentrale Annahme über geplantes und tatsächliches Ziel sowie die 80-%-Abdeckung des final ausgewählten Artefakts unabhängig bestätigen.
