# Akribischer Recheck: `01_Regression_Fahrtdauer.ipynb`

**Prüfstand:** 1. September 2026  
**Geprüfte Datei:** `/Users/robert/Downloads/01_Regression_Fahrtdauer.ipynb`  
**SHA-256:** `eb73b63f3baa428160d106f956c26a258b776472be7da53cfb0e8582d7c9be91`  
**Ausführung:** alle 24 Codezellen vollständig und ohne Zellfehler ausgeführt  
**Datenstand bei der Prüfung:** 107.297 Vorgänge, Git-Stand `591e374495d85b65da5f7a8538a24ae10141bbd9`

## Kurzurteil

**Für eine fachliche Demonstration ist das Notebook inzwischen stark. Für eine sichtbare Produktfreigabe ist es noch nicht freigabefähig.**

Die Überarbeitung beseitigt viele der früheren Kernmängel: Die neue Geschäftsfrage beginnt mit der Zielauswahl, die historische Zielstation wird nicht mehr naiv als unproblematische Eingabe verkauft, die Kundentarife einschließlich Restfreiminuten und Rabatt werden korrekt nachgebildet, die Preisformel wird gegen das gespeicherte Entgelt verifiziert, es gibt einen zeitlichen Testaufbau, eine Routenbaseline, saubere Pipelines, unbekannte Kategorien werden abgefangen und ein echter Schattenbetrieb wird korrekt beschrieben.

Die Freigabe scheitert derzeit nicht mehr am Grundansatz, sondern an drei konkreten Punkten:

1. Die App liefert Fälle aus, die ihre eigene Nützlichkeitsregel nicht erfüllen.
2. Die Tabellenfreigabe setzt die dokumentierte Wilson-Logik nicht konsistent um und enthält sogar eine als `widerlegt` markierte Zeile.
3. Die zentrale Annahme „geplantes Ziel entspricht tatsächlichem Ziel“ und das fertige Artefakt wurden noch nicht unabhängig im Schattenbetrieb geprüft.

Daneben widerspricht der Schlussabschnitt mehrfach den tatsächlich berechneten Ergebnissen. Vor einer Weitergabe müssen diese Aussagen korrigiert werden.

## Gesamtbewertung

| Bereich | Bewertung | Kurzbegründung |
|---|---:|---|
| Geschäftsfrage und App-Prozess | **sehr gut** | Ziel wird vor der Schätzung gewählt; Produktgrenzen sind offen benannt |
| Leakage und Verfügbarkeit | **gut** | tatsächliches Ziel wird korrekt nur als unvalidierter Stellvertreter behandelt |
| Training, Validierung und Test | **gut mit Vorbehalt** | zeitlich getrennt; Test 2 ist ehrlich als Kalibrierung bezeichnet, aber kein Endtest |
| Baselines und Modellvergleich | **gut** | globale, Radtyp-, Start- und Routenbaseline; Routenbaseline ist der richtige Gegner |
| Preisfehler und Tariflogik | **sehr gut im Test-1-Teil** | 100,00 % Übereinstimmung der nachgerechneten mit den gespeicherten Entgelten |
| Intervall- und Freigabelogik | **mangelhaft** | Kandidatenfilter und ausgelieferte App-Logik sind nicht identisch |
| Deployment und Monitoring | **noch nicht ausreichend** | Statusfelder existieren, werden von der App aber nicht als Sperre verwendet |
| Reproduzierbarkeit | **nicht ausreichend** | Daten kommen weiterhin vom veränderlichen GitHub-Zweig `main` |
| Sprache und Nachvollziehbarkeit | **gut geschrieben, inhaltlich inkonsistent** | klare Dramaturgie, aber mehrere zentrale Zahlen und Aussagen widersprechen den Ausgaben |

**Gesamtgüte des analytischen Notebooks: etwa 7/10.**  
**Betriebliche Freigabe: nein.**  
**Freigabe als Lehr-/Projektartefakt: nach Korrektur der P0- und Textfehler gut vertretbar.**

## Was gegenüber den früheren Fassungen überzeugend gelöst ist

### 1. Neue Geschäftsfrage und Zielauswahl

Der Prozess ist jetzt fachlich plausibel:

```text
Startstation bekannt
→ Kunde wählt Zielstation
→ Dauer beziehungsweise Spanne wird ermittelt
→ Kundentarif wird angewendet
→ App zeigt Preis oder verweigert die Anzeige
```

Das Notebook erklärt außerdem korrekt, dass die historische `end_station_id` das tatsächliche und nicht das geplante Ziel enthält. Diese Abweichung wird nicht mehr verschwiegen, sondern als zentrale ungetestete Annahme markiert. Das ist analytisch sauber.

### 2. Keine naive Leakage-Behauptung mehr

`end_station_id` ist im vorgesehenen künftigen Prozess grundsätzlich vor der Schätzung verfügbar. Gleichzeitig bleibt die historische Proxy-Abweichung bestehen. Die Formulierung „ja, mit Vorbehalt“ trifft den Sachverhalt gut.

Tagesmittelwetter wird nun ausgeschlossen, weil es zum Anfragezeitpunkt nicht feststeht. Archiviertes Prognosewetter wird zutreffend als künftig geeignete Alternative genannt.

### 3. Zeitliche Trennung und ehrliche Rolle von Test 2

Die vier Zeitbereiche werden technisch korrekt entlang der Zeit gebildet:

| Teil | Zeitraum | Rolle |
|---|---|---|
| Training | 24.08.2021–16.12.2024 | Lernen |
| Validierung | 16.12.2024–05.08.2025 | Modellwahl |
| Test 1 | 05.08.2025–23.04.2026 | einmalige Bewertung der Punktschätzung |
| Test 2 | 23.04.2026–24.08.2026 | Kalibrierung und Auswahl des Intervallprodukts |

Besonders positiv: Das Notebook bezeichnet Test 2 nicht mehr als unabhängigen finalen Test, nachdem darauf Radtypen und Kombinationen ausgewählt werden. Der notwendige Schattenbetrieb wird klar vom rückblickenden Test getrennt.

### 4. Geeignete Baselines

Die Baselines sind nun passend aufgebaut und ausschließlich auf dem Training geschätzt:

| Ansatz | Validierungs-MAE |
|---|---:|
| Median aller Fahrten | 10,89 min |
| Median je Radtyp | 10,74 min |
| Median je Startstation | 10,13 min |
| Median je Verbindung | **5,38 min** |
| Random Forest | **4,74 min** |

Der Random Forest verbessert die starke Routenbaseline um rund 12 %. Das ist ein sinnvoller, ehrlicher Vergleich: Das Modell ist besser, aber nicht dramatisch besser als eine einfache Routentabelle.

Die Ablation bestätigt den Nutzen der Zielinformation deutlich:

- ohne Zielmerkmale: 10,79 Minuten MAE;
- mit Zielmerkmalen: 4,74 Minuten MAE;
- Reduktion: 6,05 Minuten beziehungsweise 56 %.

### 5. Preprocessing und lineare Regression

Die Verarbeitung ist sauber in einer Pipeline gekapselt. `OneHotEncoder(handle_unknown="ignore")` verhindert technische Abstürze; zugleich weist der Text korrekt darauf hin, dass daraus noch keine fachlich gültige Prognose für unbekannte Stationen entsteht. Die App verweigert unbekannte Kombinationen.

Die lineare Regression verwendet `drop="first"`. Der Text erläutert zutreffend, dass wegen der zusätzlichen Abhängigkeiten zwischen Route, Start, Ziel, Strecke und Rundtour trotzdem keine eindeutige Koeffizienteninterpretation möglich ist. Das ist wesentlich besser als eine unkritische Interpretation instabiler Dummy-Koeffizienten.

### 6. Zeitmerkmale

Stunde, Monat und nun auch Wochentag werden zyklisch kodiert. Sonntag und Montag liegen dadurch tatsächlich benachbart. Dieser frühere Kritikpunkt ist behoben.

### 7. Ausreißerbehandlung

Die Acht-Stunden-Grenze wird nicht mehr als statistische Wahrheit dargestellt, sondern als gesetzte Geschäftsgrenze. Außerdem bleibt ausdrücklich offen, ob lange Ausleihen immer vergessene Rückgaben sind. Das ist transparent.

### 8. Korrekte Preisberechnung einschließlich Tarifregeln

Die neue Preisfunktion berücksichtigt:

- Aufrundung auf angefangene Minuten;
- verbleibende Freiminuten des konkreten Kunden;
- Startgebühr;
- Minutenpreis;
- Tagesdeckel;
- Tarifrabatt.

Die Funktion wird nicht nur behauptet, sondern gegen `entgelt_eur` geprüft: **100,00 % der Test-1-Entgelte stimmen exakt, maximale Abweichung 0,00 €**. Dieser frühere Hauptmangel ist im Punktmodell behoben.

## Freigabeblocker

### P0.1 – Kandidatenbewertung und App wenden nicht dieselbe Nützlichkeitsregel an

In Phase 5.6 wird eine Spanne nur dann als „zeigbar“ gewertet, wenn sie für den konkreten Kunden beide Regeln erfüllt:

- höchstens 12 Minuten breit;
- Preisbreite höchstens 60 % des Intervallmittelpunkts.

Diese Prüfung erfolgt dort mit dem tatsächlichen Restguthaben und Rabatt der jeweiligen Fahrt. Die ausgewählte Tabelle wird zunächst nur anhand des Basistarifs vorgefiltert. Das ist nicht konservativ für die **relative** Preisregel: Bei teilweise verbleibenden Freiminuten kann die untere Grenze nur die Startgebühr sein, während die obere bereits Minuten kostet. Dadurch kann die relative Breite größer sein als im Basistarif.

Die spätere Funktion `preis_schaetzen()` berechnet zwar die kundenindividuelle Spanne, ruft `spanne_nuetzt()` aber nicht erneut auf. Sie zeigt daher auch kundenspezifisch zu breite Spannen an.

Die unabhängige Gegenrechnung ergibt:

| Kennzahl | Ergebnis |
|---|---:|
| von der finalen Tabelle bediente Test-2-Fälle | 5.420 |
| davon nach eigener kundenbezogener Regel zu breit | **252** |
| Anteil der fälschlich angezeigten Fälle | **4,65 %** |
| korrekte Reichweite nach diesem Filter | **47,43 %** von Test 2 |
| im Notebook ausgewiesene Reichweite | 49,7 % von Test 2 |

Betroffen sind alle Radtypen:

| Radtyp | bediente Fälle | davon zu breit |
|---|---:|---:|
| CARGO | 405 | 11 |
| CITY | 3.006 | 182 |
| EBIKE | 2.009 | 59 |

**Folge:** Das ausgelieferte Produkt entspricht nicht dem Produkt, das in Phase 5.6 bewertet wurde. Die Aussage „Ausgeliefert wird, was gemessen wurde“ ist damit gerade noch nicht erfüllt.

**Korrektur:** In `preis_schaetzen()` nach der kundenindividuellen Preisberechnung erneut `spanne_nuetzt()` anwenden. Ist die Spanne zu breit, muss die Funktion ohne Preis und mit einem eindeutigen Ablehnungsgrund antworten. Danach Abdeckung und Reichweite ausschließlich für genau diese finale Funktion neu ausweisen.

### P0.2 – Wilson-Freigabe, Mindestfallzahl und tatsächlicher Tabellenfilter widersprechen einander

Das Notebook beschreibt als Freigabelogik das 95-%-Wilson-Intervall:

- untere Grenze mindestens 80 %: gestützt;
- Intervall überlappt 80 %: unbestimmt;
- obere Grenze unter 80 %: widerlegt und abschalten.

Im Code werden Radtypen jedoch über den **Punktschätzer** freigegeben:

```python
freigegebene_typen = sorted(je_typ[je_typ >= 0.80].index)
```

Kombinationen werden ebenfalls nicht anhand des dokumentierten Status ausgeschlossen, sondern nur, wenn sie mindestens 20 Fälle haben und ihr Punktschätzer unter 80 % liegt. Damit wird die zuvor berechnete Spalte `freigabestatus` nicht zur tatsächlichen Sperre.

Die ausgelieferte CSV enthält:

| Status | Tabellenzeilen |
|---|---:|
| `gestuetzt` | 53 |
| `unbestimmt` | 295 |
| `ungeprueft` | 2 |
| `widerlegt` | **1** |

Die widerlegte Zeile lautet:

```text
Start 1 → Ziel 9, CARGO, nachmittag
Test-2-Fahrten: 1
Abdeckung: 0 %
Wilson-Obergrenze: 79,35 %
Status: widerlegt
```

Sie wird trotzdem in `NACHSCHLAGE` aufgenommen und von `preis_schaetzen()` bedient. Zugleich sagt die Monitoringtabelle, bei weniger als 20 Fällen sei keine Aussage möglich. Das ist ein dreifacher Widerspruch zwischen Mindestfallzahl, Wilson-Status und Auslieferung.

**Korrektur:** Eine einzige verbindliche Freigabefunktion definieren und überall verwenden. Beispielsweise:

1. `n < 20` → `unzureichend`, nicht individuell freigeben;
2. `n >= 20` und Wilson-Untergrenze ≥ 80 % → `gestuetzt`;
3. `n >= 20` und Wilson-Obergrenze < 80 % → `widerlegt`, sperren;
4. übrige Fälle → `unbestimmt`, nur dann anzeigen, wenn das Produkt ausdrücklich eine aggregierte statt einer verbindungsbezogenen Zusage macht;
5. App-Funktion muss den finalen Status prüfen;
6. Reichweite und Abdeckung nach genau diesem Statusfilter neu berechnen.

Falls unbestimmte Kombinationen bewusst angezeigt werden sollen, darf die Oberfläche nicht „belastbare Schätzung“ suggerieren. Dann müssen Freigabeebene und Garantie klar als **nur aggregiert nach Radtyp** bezeichnet werden.

### P0.3 – Kein unabhängiger Endtest und kein Schattenbetrieb

Test 2 wird für Kandidatenvergleich, Radtypfreigabe und Kombinationsfilterung verwendet. Er ist deshalb Kalibrierungs- und Selektionsmaterial. Das Notebook erkennt dies korrekt an, aber daraus folgt zwingend:

**Die berechneten 92,9 % sind keine unabhängige Güte des fertig ausgewählten Produkts.**

Außerdem wurde historisch das tatsächliche statt des geplanten Ziels verwendet. Erst ein Schattenbetrieb kann messen:

- wie oft geplantes und tatsächliches Ziel übereinstimmen;
- ob die App-Anfrage alle benötigten Werte zuverlässig liefert;
- wie häufig die finale Funktion tatsächlich antwortet;
- ob Abdeckung, Breite und Reichweite auf neuen Daten halten;
- welche Ablehnungsgründe auftreten.

**Korrektur:** Artefakt, Tarifstand und Code einfrieren; geplantes Ziel speichern; mindestens einen vorab definierten Zeitraum ohne Nachjustierung beobachten; danach dieselben Kennzahlen mit Konfidenzintervallen auswerten. Erst dann sichtbare Produktfreigabe.

## Weitere methodische Restpunkte

### P1.1 – Die relevante preisabhängige Kundengruppe hält die Zusage noch nicht sicher

Die Gesamtdeckung von 92,9 % wird stark durch Fahrten mit genügend Freiminuten erhöht. Dort ist die Preisspanne 0,00 € breit und der Preis unabhängig von der Dauerschätzung konstant.

Für die 2.007 preisabhängigen Fälle ohne ausreichendes Guthaben beträgt die Abdeckung 81,0 %, das 95-%-Intervall jedoch 79,2–82,6 %. Die zugesagten 80 % sind für diese sachlich wichtigste Gruppe noch nicht statistisch abgesichert.

Die derzeitige Unterteilung verwendet zudem die **tatsächliche** Dauer, um nachträglich festzustellen, ob das Guthaben gereicht hat. Für eine betriebliche Entscheidung sollte vorab anhand der bekannten Restminuten und der prognostizierten Intervallgrenzen zwischen „sicher vollständig gedeckt“, „sicher preisabhängig“ und „Grenzfall“ unterschieden werden.

### P1.2 – Test 2 ist sprachlich noch vereinzelt als unberührt bezeichnet

An mehreren Stellen steht sinngemäß, Test 2 sei „bis hierher unberührt“ oder „der unberührte Zeitraum der zweiten Runde“. Gleichzeitig wurde der gesamte Datensatz bereits explorativ betrachtet. Das Notebook räumt dies an anderer Stelle ein.

**Korrektur:** Durchgehend „nicht zum Training verwendet, aber explorativ bekannt und anschließend zur Kalibrierung benutzt“ schreiben. Das ist präziser als „unberührt“.

### P1.3 – Reproduzierbarkeit und Versionierung sind noch nicht freigabefest

Die Datenquelle zeigt weiterhin auf:

```text
https://raw.githubusercontent.com/.../main/analytics/
```

`main` ist veränderlich. Bei der Prüfung lag der Zweig auf Commit `591e374…`; ein nur rund zwei Stunden älterer lokaler Stand enthielt bereits eine andere Anzahl von Fahrten. Damit können Codeausgaben und erklärender Text ohne Änderung des Notebooks auseinanderlaufen.

Auch `tarifversion = str(preise.preis_pro_minute_eur.sum())` ist keine belastbare Version: Die Summe `0.85` ignoriert Startgebühren und Tagesdeckel und kann trotz veränderter Einzelpreise gleich bleiben.

**Korrektur:**

- Git-Commit oder versioniertes Datenpaket statt `main` verwenden;
- SHA-256 der Eingabedateien speichern;
- Tarifversion aus allen tarifrelevanten Feldern oder einer echten Tarif-ID bilden;
- Code-/Artefaktversion, Erstellungszeit, Trainingsende und Kalibrierungszeitraum in die CSV schreiben;
- Zahlen im Fließtext entweder programmatisch erzeugen oder vor Veröffentlichung gegen die aktuellen Ausgaben testen.

### P1.4 – Mindestfallzahl 30 ist für 10-%-/90-%-Ränder sehr dünn

Bei 30 historischen Fahrten liegen an jedem Rand rechnerisch nur ungefähr drei Beobachtungen. Das Notebook benennt diese Schwäche selbst. Für eine Produktfreigabe reichen bloße empirische Perzentile auf dieser Basis nicht aus.

**Korrektur:** Mindestfallzahl fachlich festlegen und Sensitivität für 30/50/100 Fälle zeigen; alternativ Bootstrap-Unsicherheit, geglättete/hierarchische Routenquantile oder eine zeitlich kalibrierte Conformal-Prediction-Lösung verwenden.

### P1.5 – Saisonalität und Wochentag gehen beim ausgelieferten Tabellenprodukt verloren

Das Random-Forest-/Quantilmodell nutzt zyklische Zeitmerkmale. Die finale Tabelle unterscheidet dagegen nur fünf Tageszeitfenster und ignoriert Wochentag sowie Saison. Das wird zwar offengelegt, ist aber gerade wegen der beschriebenen saisonalen Verschiebungen ein relevantes Produktrisiko.

**Korrektur:** entweder robuste zusätzliche Segmente mit ausreichender Fallzahl bilden oder Modellwerte je Kombination und Zeitkontext vorab tabellieren. Das Notebook nennt diesen dritten Weg bereits; er sollte vor einer Produktfreigabe geprüft werden.

### P1.6 – Die App-Funktion braucht Eingabevalidierung und konkrete Ablehnungsgründe

Unbekannte Stationen und Rundfahrten werden bereits abgefangen. Noch fehlen unter anderem Prüfungen für ungültige Stunden, negative Restminuten, unzulässige Rabatte und nicht unterstützte Radtypen. Außerdem sollte die Funktion unterschiedliche Gründe ausgeben: unbekannte Verbindung, zu breite Kundenspanne, zu geringe Fallzahl, unbestimmter Status oder statistisch widerlegte Kombination.

## Sprachliche und inhaltliche Konsistenz

Die Texte sind grundsätzlich gut lesbar: klare Leitfragen, verständliche Beispiele, sinnvolle Tabellen und eine starke Trennung zwischen Schätzung und Tariflogik. Die offenen Annahmen werden ungewöhnlich ehrlich benannt. Trotzdem enthält der Schluss noch mehrere sachlich falsche oder überzogene Aussagen.

### Zwingend zu korrigierende Widersprüche

1. **EBIKE besteht das ursprüngliche mittlere 50-Cent-Kriterium.**  
   Ausgabe: CITY 0,25 €, EBIKE 0,39 €, CARGO 1,61 €.  
   Text: „Für CITY ist die Grenze eingehalten, für EBIKE und CARGO nicht.“  
   Richtig: CITY und EBIKE erfüllen das als mittleren absoluten Preisfehler definierte Kriterium; CARGO nicht.

2. **Nicht „zwei von drei Radtypen“ haben beim Punktmodell kein Produkt.**  
   Nach dem formalen Phase-1-Kriterium betrifft das nur CARGO. Wenn zusätzlich eine Einzelfallquote verlangt wird, muss dieses Kriterium vorab explizit definiert werden.

3. **84 % innerhalb von 50 Cent bedeuten 16 % außerhalb.**  
   Das ist ungefähr jede sechste, nicht „rund jede vierte“ CITY-Fahrt.

4. **Das Intervallprodukt enthält alle drei Radtypen.**  
   Die Ausgabe nennt `['CARGO', 'CITY', 'EBIKE']`. Dennoch behaupten Phase-6-Zusammenfassung, Entscheidungsbegründung und offene Punkte mehrfach, nur CITY werde ausgeliefert beziehungsweise EBIKE und CARGO hätten kein Produkt.

5. **Die Ablation zeigt nicht, „wie wenig“ das Ziel beiträgt.**  
   Sie zeigt eine MAE-Reduktion von 56 % und damit einen sehr großen Beitrag.

6. **Der behauptete Sommeranstieg ist in den gezeigten vier Fenstern nicht sichtbar.**  
   Die CITY-Preisfehler lauten 0,30 €, 0,29 €, 0,29 € und 0,28 €. Der Text behauptet dagegen, der Fehler steige im Sommer deutlich.

7. **„Das Verfahren schöpft die vorhandene Information aus“ ist nicht belegt.**  
   Die Ablation belegt die Bedeutung der Zielmerkmale, nicht die Optimalität des Random Forest. Es wurden nur wenige Modellvarianten und Einstellungen verglichen.

8. **„Das Muster ist menschlich“ und der abschließende Satz über Ankommen versus Fahren sind zu kausal.**  
   Der Fahrtzweck ist nicht erfasst. Richtig wäre: Die Streuung ist mit unterschiedlichen Fahrtzwecken vereinbar, diese Erklärung wurde aber nicht getestet.

9. **„351 Kombinationen erfüllen die beiden Regeln aus Phase 1“ verweist auf die falsche Phase.**  
   Die neuen Spannenregeln werden erst in Phase 5.5 definiert.

10. **„Ausgeliefert wird, was gemessen wurde“ ist aktuell falsch.**  
    Die Kandidatenbewertung verwirft 252 kundenspezifisch zu breite Fälle, die App würde sie trotzdem anzeigen; außerdem enthält das Artefakt eine widerlegte und zwei ungeprüfte Zeilen.

### Lesbarkeit

Die Lesbarkeit ist insgesamt gut, könnte aber durch Straffung gewinnen. Die Botschaften „Test 2 ist kein Endtest“, „Tabelle statt Modell“ und „geplantes versus tatsächliches Ziel“ werden mehrfach wiederholt. Besser wäre eine zentrale Entscheidungstabelle, auf die spätere Abschnitte verweisen. Dadurch würden die tatsächlich wichtigen Einschränkungen weniger zwischen Wiederholungen verschwinden.

## Priorisierte To-do-Liste

### P0 – vor jeder sichtbaren Produktfreigabe

- [ ] `preis_schaetzen()` muss die kundenindividuelle 12-Minuten-/60-%-Regel anwenden und bei Überschreitung schweigen.
- [ ] Kandidatenbewertung, Tabellenfilter, CSV-Status, App-Funktion und Monitoring müssen dieselbe zentrale Freigabefunktion verwenden.
- [ ] Die aktuell als `widerlegt` markierte Tabellenzeile darf nicht ausgeliefert werden.
- [ ] Regel für `n < 20`, `unbestimmt` und `ungeprueft` eindeutig festlegen; App-Verhalten daran koppeln.
- [ ] Finale Kennzahlen nach allen Laufzeit- und Statusfiltern neu berechnen.
- [ ] Artefakt einfrieren und unabhängigen Schattenbetrieb mit gespeichertem geplantem Ziel durchführen.

### P1 – vor fachlicher Abnahme des Notebooks

- [ ] Alle zehn oben genannten Text-/Zahlenwidersprüche korrigieren.
- [ ] Datenquelle auf einen unveränderlichen Commit oder ein versioniertes Datenpaket pinnen.
- [ ] belastbare Daten-, Tarif-, Code- und Artefaktversionen exportieren.
- [ ] Preisabhängige Kundengruppe als vorab definierte Evaluationsgruppe aufnehmen.
- [ ] Mindestfallzahl und Unsicherheit der empirischen Quantile fachlich absichern.
- [ ] Tabelle gegen vorab berechnete Quantilmodellwerte vergleichen.

### P2 – Qualitätssteigerung

- [ ] Acht-Stunden-Grenze mit Produkt-/Betriebswissen begründen.
- [ ] archivierte Wetterprognosen statt Tagesendwetter prüfen.
- [ ] geplante Stopps, Fahrtzweck oder gewünschte Ankunftszeit als optionale Nutzerangaben untersuchen.
- [ ] App-Eingaben validieren und differenzierte Ablehnungsgründe zurückgeben.
- [ ] Text kürzen und wiederkehrende Aussagen zentralisieren.

## Empfohlenes Freigabegate

Eine belastbare Freigabe sollte erst erfolgen, wenn alle folgenden Punkte gleichzeitig erfüllt sind:

1. Der tatsächlich ausgelieferte App-Code und die offline bewertete Funktion sind identisch.
2. Keine widerlegte oder regelwidrig breite Kombination wird angezeigt.
3. Daten, Tarif, Code und Artefakt sind unveränderlich versioniert.
4. Der Schattenbetrieb verwendet das vorab gespeicherte geplante Ziel.
5. Abdeckung mindestens 80 % insgesamt, je Radtyp und in der vorab festgelegten preisabhängigen Kundengruppe; jeweils mit passender Konfidenzuntergrenze.
6. Reichweite, Breite und Ablehnungsgründe werden auf dem unabhängigen Zeitraum berichtet.
7. Der Notebooktext stimmt vollständig mit den neu ausgeführten Ergebnissen überein.

## Schlussfolgerung

Der neue Ansatz ist fachlich wesentlich überzeugender als die früheren Fassungen. Die zentrale Produktidee – erst Ziel wählen, dann Dauerunsicherheit schätzen und anschließend den konkreten Kundentarif anwenden – ist tragfähig. Auch die methodische Selbstkritik ist inzwischen stark.

**Noch verhindert jedoch die Differenz zwischen bewerteter und tatsächlich ausgelieferter Logik eine Freigabe.** Das ist kein kosmetischer Punkt: Die App würde nachweislich Fälle anzeigen, die der eigene Test verworfen hat, und sogar eine als widerlegt markierte Tabellenzeile bedienen. Nach Zentralisierung der Freigaberegeln, Korrektur der Texte, fester Versionierung und einem echten Schattenbetrieb kann daraus ein freigabefähiges Produktartefakt werden.
