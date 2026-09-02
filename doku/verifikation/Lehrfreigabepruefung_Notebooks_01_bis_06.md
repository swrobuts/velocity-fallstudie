# Lehrfreigabeprüfung der Notebooks 01 bis 06

**Prüfdatum:** 2. September 2026  
**Prüfziel:** ausschließlich Lehrfreigabe, keine Produktions- oder Rechtsfreigabe

## 1. Gesamturteil

**Die Notebook-Reihe ist im aktuellen Stand noch nicht lehrfreigabefähig.** Alle sechs
Notebooks laufen technisch vollständig und fehlerfrei durch. Die Freigabe wird jedoch
durch methodische und redaktionelle Widersprüche verhindert, die zentrale Lehrsätze,
Erfolgskriterien oder Freigabeentscheidungen betreffen.

Die wichtigsten Probleme sind:

1. Vorab formulierte Erfolgskriterien werden später teilweise durch andere bindende
   Gates ersetzt.
2. Nach methodischen Überarbeitungen blieben alte Kennzahlen und Urteile im Fließtext
   stehen.
3. Freigabestatus in Text, Codeausgabe und gespeichertem Artefakt widersprechen sich.
4. In einzelnen Fällen wurde ein Verfahren auf demselben Zeitraum verbessert und
   anschließend als erfolgreich beziehungsweise pilotfähig bewertet.
5. Einige Auslieferungen beruhen auf Annahmen, die im Notebook nicht als solche
   eingeführt oder nicht durch Daten belegt werden.

| Notebook | Lehrfreigabe | Hauptgrund |
|---|---|---|
| 01 Regression Fahrtdauer | **Nein** | widersprüchlicher Produktstatus, nicht unabhängiger „Test 2“, inkonsistente App-Schnittstelle und falsches Auslieferungsartefakt |
| 02 Klassifikation Wartungsrisiko | **Nein** | Erfolgskriterien aus Phase 1 und tatsächlich bindende Gates sind nicht dieselben |
| 03 Clustering Stationen/Kunden | **Nein** | Stabilitätsgate und Hysterese werden nachträglich eingeführt; organisatorische Voraussetzungen werden unbelegt auf `True` gesetzt |
| 04 Zeitreihe Nachfrageprognose | **Nein, aber nahe an der Freigabe** | falsche Methodenreferenz auf Notebook 1 und nicht vollständig vorab definierte Robustheits-/Pilotlogik |
| 05 Assoziation Wege im Netz | **Nein** | widersprüchlicher Freigabestatus und methodisch zu stark interpretierte Kostenrechnung |
| 06 Anomalieerkennung | **Nein** | nachgebesserte Regel ohne unabhängige Prüfung sowie vollständig widersprüchlicher Status von Produkt B |

## 2. Prüfgrundlage und technische Reproduzierbarkeit

Die Zellnummern in diesem Bericht sind **0-basiert entsprechend der Reihenfolge im
Notebook-JSON** angegeben. Zusätzlich ist jeweils die sichtbare Abschnittsüberschrift
genannt, damit die Stelle im Notebook schnell auffindbar ist.

Jedes Notebook wurde in einem frischen Prozess von oben nach unten ausgeführt. Ergebnis:

| Notebook | SHA-256 des geprüften Uploads | Codezellen | frischer Lauf |
|---|---|---:|---|
| 01 | `d8046b45b52de4b76ad90b8fd6bcfa593b2e4390f351db9f33617aea90d91fa8` | 25 | vollständig, keine Fehler |
| 02 | `a361d5354e46034cc1eb7166b336f71227c03eec7247503ee59ad071021be003` | 20 | vollständig, keine Fehler |
| 03 | `f3bcebcd46c49dfcae0b76ec032a1f998a307353ddafab635e550e152d88284a` | 23 | vollständig, keine Fehler |
| 04 | `316c06a915c76c9136b7734fdcfc0e9ae1a6f962abfe30fd78ba61416213a9ab` | 14 | vollständig, keine Fehler |
| 05 | `74e725b567ba7605909e66f4b656162033df21b84959bf6105ff6d4528b5c60f` | 12 | vollständig, keine Fehler |
| 06 | `523035c362e73441fa4b9f213a5f85b531992e4ab831ad8180f8cd18a2e567e1` | 17 | vollständig, keine Fehler |

Die gespeicherten numerischen und textlichen Ergebnisse stimmen mit den frisch
berechneten Ergebnissen überein. Unterschiede beschränken sich auf technische
Darstellungsrepräsentationen von Abbildungen. **Es liegt somit kein technischer
Ausführungsblocker vor.** Die folgenden Punkte betreffen ausschließlich die fachliche,
methodische und didaktische Konsistenz.

Bewusst offengelegte Grenzen – insbesondere synthetische Daten, fehlende reale
Kostenmessungen, fehlende Produktionsschnittstellen oder noch ausstehende prospektive
Erhebungen – wurden nicht allein deshalb als Lehrfreigabeblocker bewertet. Sie werden nur
dann beanstandet, wenn das Notebook daraus trotzdem einen nicht gedeckten Status oder
eine widersprüchliche Aussage ableitet.

## 3. Freigabeblocker nach Notebook

## 3.1 Notebook 01 – Regression Fahrtdauer

### 01-A: Produktstatus, Testrolle und Schattenbetrieb widersprechen sich

**Problematische Stellen**

- Zelle 62, Abschnitt 6.4c: „Test 2 war unberührt“ und die Auskunft gehe in Betrieb,
  während der Schattenbetrieb parallel laufe.
- Zelle 62, Abschnitt 6.6: Erst nach dem Schattenbetrieb solle sichtbar geschaltet
  werden.
- Zelle 63, Schlusszusammenfassung: Das Primärgate halte mit **82,2 %** gegenüber
  **80 %**; wenige Absätze später heißt es dennoch: „Das Primärgate hält nicht“, das
  Produkt bleibe gesperrt und die Lücke betrage 0,0 Punkte.
- Dieselbe Zelle behauptet zudem, bei „gesperrtem Produkt“ würden 67 % der Fahrten
  angezeigt. Bei wirksamer Produktsperre wäre die sichtbare Reichweite definitionsgemäß
  null.
- Dieselbe Schlusszelle sagt zutreffend, dass Test 2 die Kalibrierung trägt und damit
  keine unabhängige Endprüfung mehr ist.

**Warum dies die Lehrfreigabe verhindert**

Die zentrale Lehre des Notebooks lautet, dass Datenrollen und Gates vor der Messung
feststehen müssen. Die Schlussfolgerung verletzt genau diesen Grundsatz: Derselbe
Zeitraum wird zugleich als unberührter Test und als Kalibrierungsgrundlage bezeichnet;
das Produkt ist zugleich freigegeben, gesperrt und erst nach einem künftigen
Schattenbetrieb freizuschalten. Zudem ist die Aussage „82,2 % statt 80 %“ rechnerisch
kein gerissenes Gate.

**Präziser Lösungsansatz**

1. Test 2 eindeutig als **Kalibrierungs-/Auswahlzeitraum** benennen. Er darf danach
   nicht mehr als unabhängiger finaler Holdout bezeichnet werden.
2. Aus den vorliegenden Daten nur den Status
   **„historisch qualifizierter Kandidat; prospektive Bestätigung offen“** ableiten.
3. Einen einzigen Freigabeablauf wählen:
   `Modell einfrieren → Wunschziel im Schatten protokollieren → prospektiv prüfen → bei
   bestandenem Gate sichtbar schalten`.
4. Alle Statussätze in 6.4c, 6.6 und der Schlusszelle aus derselben Statusvariable
   erzeugen. Die handgeschriebenen Gegenbehauptungen sind zu entfernen.
5. Für eine echte unabhängige Bestätigung einen neuen, zeitlich späteren Zeitraum
   reservieren, der weder Modellauswahl noch Intervallkalibrierung beeinflusst.

**Abnahmekriterium:** Im gesamten Notebook existiert genau eine konsistente Aussage zu
Test 2 und genau ein daraus abgeleiteter Status. Bei 82,2 % und einer Schwelle von 80 %
darf nicht mehr „Gate gerissen“ ausgegeben werden.

### 01-B: Begründung für das nicht bindende Radtyp-Gate ist sachlich falsch

**Problematische Stelle**

- Zelle 62, Abschnitt 6.4c: Das preisabhängige Primärgate je Radtyp werde nicht bindend,
  weil die Gruppen nur „wenige Dutzend Fälle“ enthielten.

**Befund aus dem frischen Lauf**

| Radtyp | Fälle in der preisabhängigen Gruppe | Abdeckung | Wilson-Untergrenze |
|---|---:|---:|---:|
| CARGO | 214 | 81,8 % | 76,1 % |
| CITY | 1.035 | 82,8 % | 80,4 % |
| EBIKE | 911 | 85,5 % | 83,1 % |

Die Fallzahlen sind nicht „wenige Dutzend“. Vor allem ist die Granularität des Gates
eine Frage der Produktzusage, nicht eine nach Sichtung des Ergebnisses wählbare
Auswertungsebene. Bei bindender Prüfung je Radtyp würde CARGO die 80-%-Untergrenze nicht
nehmen.

**Präziser Lösungsansatz**

- Vor der Auswertung festlegen, ob die Zusage für alle Anfragen gemeinsam oder je
  Radtyp gilt, und diese Entscheidung fachlich aus dem angezeigten Produktversprechen
  begründen.
- Falls die App eine Zusage je Radtyp kommuniziert, muss auch die preisabhängige
  Teilpopulation je Radtyp geprüft werden; CARGO wäre dann vorerst nicht freizugeben.
- Falls nur eine aggregierte Zusage gewollt ist, dürfen Text und Oberfläche keine
  radtypspezifische Verlässlichkeit suggerieren. Die tatsächlichen Teilgruppenergebnisse
  bleiben als Diagnose sichtbar.

**Abnahmekriterium:** Produktzusage, Gate-Ebene und Freigabeentscheidung verwenden
denselben Nenner und dieselbe Gruppierung; die Begründung enthält keine den Ausgaben
widersprechende Fallzahl.

### 01-C: Die App-Funktion besitzt zwei widersprüchliche Zeitangaben

**Problematische Stelle**

- Zelle 59, Funktion `preis_schaetzen(start_id, ziel_id, typ_code, stunde, ..., zeitpunkt=None)`.

`stunde` wird validiert und im Tabellenzweig verwendet. Die ausgewählte
Quantilregression berechnet ihre Zeitmerkmale dagegen ausschließlich aus `zeitpunkt`.
Widersprechen sich beide Angaben, wird der Konflikt nicht erkannt. Die Demonstrationsfälle
übergeben nur `stunde`, aber keinen `zeitpunkt`. Daher verweigert sogar das als
„freigegebene Verbindung“ bezeichnete Positivbeispiel die Anzeige; weitere Beispiele
scheitern ebenfalls am fehlenden Zeitpunkt statt am jeweils beschrifteten Grund.

**Präziser Lösungsansatz**

1. Nur **eine** Zeitquelle in der öffentlichen Schnittstelle verwenden, vorzugsweise
   `zeitpunkt`.
2. Stunde, Wochentag, Monat, Ferien- und Feiertagsmerkmale ausschließlich daraus
   ableiten.
3. Falls aus Kompatibilitätsgründen beide Parameter bleiben müssen, ihre Konsistenz
   zwingend prüfen und bei Abweichung einen eindeutigen Fehler zurückgeben.
4. Die Beispiele vollständig mit Zeitstempel aufrufen.
5. Nicht nur `anzeige is None`, sondern den erwarteten Ablehnungsgrund testen:
   Rundfahrt → `rundfahrt`, unbekannte Station → `keine_zeile`, nicht freigegebene
   Verbindung → entsprechender Freigabegrund, zu breite Spanne → `spanne_zu_breit`.
6. Ein Positivtest muss nachweislich eine Preisspanne liefern.

**Abnahmekriterium:** Zwei Aufrufe mit identischem `zeitpunkt` können nicht durch eine
abweichende separate Stunde verschiedene oder stillschweigend gleiche Ergebnisse
erzeugen; jedes Beispiel erreicht den behaupteten Codezweig.

### 01-D: Ausgewähltes Verfahren, CSV-Artefakt und behauptete Rückfallebene passen nicht zusammen

**Problematische Stellen**

- Zelle 50: Auswahl der Quantilregression und Behauptung, die Perzentiltabelle bleibe
  als Rückfallebene erhalten.
- Zelle 57: `preisschaetzung.csv` wird aus der historischen Perzentiltabelle erzeugt
  und als „ausgeliefertes Artefakt“ bezeichnet.
- Zelle 59: Der produktive Pfad verwendet bei ausgewählter Quantilregression weder die
  Schlüssel noch die zeilenbezogenen Freigabestatus der CSV. Ein technischer
  Fallbackpfad bei Dienstausfall existiert nicht.

Damit repräsentiert die ausgelieferte Datei nicht das ausgewählte Verfahren. Zusätzlich
werden ihre Zeilen über `produktfreigabe` global als frei markiert, obwohl einzelne
Zeilen nur unzureichend beziehungsweise unbestimmt belegt sind. Die App ignoriert diese
Information im Modellzweig ohnehin.

**Präziser Lösungsansatz**

- Das ausgewählte Quantilmodell als vollständiges Modellpaket speichern: beide
  Quantilmodelle, Preprocessing, Merkmalsreihenfolge, Versionskennungen, Gate-Status,
  Gültigkeitsbereich und Zeitgrenzen.
- `preisschaetzung.csv` eindeutig als **separaten, schlechteren Tabellenkandidaten**
  oder als diagnostisches Artefakt benennen; nicht als Repräsentation des gewählten
  Modells.
- Falls ein Rückfall wirklich Bestandteil des Lehrbeispiels sein soll, diesen im Code
  implementieren und klar kennzeichnen. Da die Tabelle das Primärgate nicht nimmt, darf
  der Fallback keine identische Zusage anzeigen. Er muss einen eigenen Status und eine
  eingeschränkte Nutzerkommunikation haben.
- Status und Filter des tatsächlich verwendeten Pfades testen. Kein Artefakt darf
  pauschal `frei` tragen, wenn sein eigener Gate-Status etwas anderes sagt.

**Abnahmekriterium:** Der Laufzeitpfad lädt genau das Artefakt des ausgewählten
Kandidaten; ein optionaler Fallback ist ausführbar, getestet und trägt eine zutreffende,
schwächere Zusage.

## 3.2 Notebook 02 – Klassifikation Wartungsrisiko

### 02-A: Die bindenden Gates entsprechen nicht den Erfolgskriterien aus Phase 1

**Problematische Stellen**

- Zelle 4, „Die Erfolgskriterien“:
  - K1 = Lift mindestens 1,5 in mindestens 4 von 5 Quartalen,
  - K2 = geringere Kosten als die heutige Faustregel,
  - K3 = untere 95-%-Intervallgrenze trägt die Nutzenschwelle,
  - 70 % Trefferquote nur Zusatzfrage, soweit überhaupt erreichbar.
- Zelle 41, Abschnitt 5.6: K1a und K1b werden wieder an die feste 70-%-Hürde gebunden.
- Zelle 42: `PFLICHTGATES = ("K1a", "K1b", "K2", "K3")`; K3 bezeichnet nun den
  Lift in vier von fünf Quartalen. Damit wechseln Namen und Bedeutungen.
- Zelle 49 und die Überwachung übernehmen die 70-%-Untergrenze erneut als
  freigaberelevant.

**Warum dies die Lehrfreigabe verhindert**

Das Notebook erklärt überzeugend, warum die feste 70-%-Zusage bei saisonal schwankender
Grundrate unbrauchbar ist, macht dieselbe Hürde anschließend aber wieder verbindlich.
Gleichzeitig wird das in Phase 1 verlangte statistische Gate zur Nutzenschwelle nicht
implementiert. Das ausgewählte Verfahren kann deshalb nicht nachvollziehbar auf die
vorab erklärten Kriterien zurückgeführt werden.

**Präziser Lösungsansatz**

Eine einzige Gate-Definition am Ende von Phase 1 festschreiben und im gesamten Notebook
wiederverwenden. Eine konsistente Variante wäre:

- **K1:** beobachteter Lift der 60er-Liste mindestens 1,5 in mindestens 4 von 5
  Validierungsquartalen;
- **K2:** erwartete Kosten im unabhängigen Testquartal geringer als bei „ältestes Rad
  zuerst“;
- **K3:** statistische Absicherung der Nutzenschwelle, beispielsweise untere
  Wilson-Grenze der Listenpräzision größer als `1,5 × Grundrate` im Testquartal oder
  eine Bootstrap-Untergrenze des Lifts von mindestens 1,5;
- **70 %:** rein deskriptive Zusatzfrage, nicht Bestandteil von `PFLICHTGATES`.

Tabellenüberschriften, Kommentare, Monitoring und Schlussurteil müssen aus denselben
Schlüsseln erzeugt werden. Nach der Umstellung ist der Auswahlentscheid neu zu rechnen;
er darf nicht als unverändert vorausgesetzt werden.

**Abnahmekriterium:** Jede Gate-Bezeichnung hat in Phase 1, Code, Ergebnistabelle,
Überwachung und Schlusszelle dieselbe Definition. Die 70-%-Hürde beeinflusst die
Freigabe nur dann, wenn sie wieder ausdrücklich und vorab als bindendes Kriterium
begründet wird.

### 02-B: Falsche Methodenreferenz auf Notebook 1

**Problematische Stelle**

- Zelle 19: „Warum nicht `train_test_split` wie in Notebook 1?“

Notebook 1 verwendet im geprüften Stand selbst eine chronologische Aufteilung. Die
Referenz lehrt daher einen nicht mehr existierenden und für die aktuelle Reihe falschen
Gegensatz.

**Präziser Lösungsansatz**

Den Vergleich ersetzen durch: Auch Notebook 1 trennt zeitlich; in Notebook 2 kommt als
zusätzlicher Grund hinzu, dass dasselbe Rad mehrfach vorkommt und zeilenweise zufällige
Splits Zukunftsinformation desselben Objekts verteilen könnten.

**Abnahmekriterium:** Keine Stelle in Notebook 02 behauptet mehr, Notebook 01 habe
zufällig geteilt.

## 3.3 Notebook 03 – Clustering Stationen und Kunden

### 03-A: Zeitliches Stabilitätsgate und Hysterese sind nicht in Phase 1 vorab definiert

**Problematische Stellen**

- Zelle 5: Stabilität bedeutet nur, dass ein zweiter Lauf mit anderem Zufallsstart
  dieselben Gruppen liefert.
- Zelle 35: Später werden ein zeitliches Gate von höchstens 25 % Segmentwechsel und eine
  Hysterese von 20 % eingeführt. Der Kommentar behauptet ausdrücklich, die Hysterese sei
  in Phase 1 festgelegt worden; dort steht sie nicht.
- Die Hysterese beeinflusst die bindende Wechselquote und damit die Freigabe der
  Kampagnenliste.

**Warum dies die Lehrfreigabe verhindert**

Startwertstabilität und zeitliche Stabilität sind verschiedene Eigenschaften. Eine nach
Sichtung der Cluster eingeführte Hysterese kann fachlich sinnvoll sein, ist auf demselben
Zeitraum aber Teil der Verfahrensentwicklung. Sie darf nicht zugleich als vorab
festgelegte Bedingung und unabhängiger Freigabenachweis dargestellt werden.

**Präziser Lösungsansatz**

Es gibt zwei saubere Wege:

1. **Lehrfreigabe ohne Kampagnenfreigabe:** Aktuelle Hysterese und 25-%-Schwelle als
   explorativ entwickelte Kandidaten kennzeichnen; personenbezogenen Export sperren;
   Regeln einfrieren und an einem späteren Stichtag erstmals verbindlich prüfen.
2. **Neu aufbauen:** In Phase 1 Zielpopulation, Nenner, Wechseldefinition, Schwelle von
   25 % und Hysterese von 20 % fachlich vorab begründen. Entwicklungs- und Prüfzeitraum
   danach trennen und die Entscheidung nur auf dem Prüfzeitraum treffen.

Zusätzlich sollte die Wechselquote ohne Hysterese als Sensitivitätswert sichtbar bleiben,
damit die Wirkung der Stabilisierung nicht verborgen wird.

**Abnahmekriterium:** Der Kommentar „in Phase 1 festgelegt“ ist tatsächlich belegt;
Parameterentwicklung und Freigabeprüfung nutzen getrennte Zeiträume – andernfalls lautet
der Status nur „explorativ“.

### 03-B: Die Interpretation der gemessenen Stabilität ist rechnerisch falsch

**Problematische Stelle**

- Zelle 36: „Jeder vierte Kunde“ wechsle das Segment und beide Werte lägen „über der
  Alarmschwelle“.

Der bindende Wert beträgt **20,70 %**, also ungefähr jeder fünfte Kunde. Das Gate lautet
`Wechselquote <= 25 %`; 20,70 % und 20,90 % liegen folglich **unter** der Schwelle und
erfüllen das Gate. Der Text beschreibt das Gegenteil.

**Präziser Lösungsansatz**

Die Sätze aus den berechneten Variablen erzeugen oder neutral formulieren:
„20,70 % der Arbeitsliste wechseln; das liegt 4,30 Prozentpunkte unter der Schwelle von
25 %.“ Begriffe wie „über/unter“, „gehalten/gerissen“ dürfen nicht handgeschrieben neben
veränderlichen Werten stehen.

**Abnahmekriterium:** Zahl, verbale Interpretation und boolesche Gate-Variable zeigen
denselben Ausgang.

### 03-C: Organisatorische Voraussetzungen werden ohne Quelle als erfüllt gesetzt

**Problematische Stelle**

- Zelle 54 setzt
  `RECHTSGRUNDLAGE_DOKUMENTIERT = True` und
  `KONTAKTKANAL_ANGEBUNDEN = True`.
- Der Kommentar behauptet, die Fachabteilung habe dies beantwortet und die Prämissen
  stünden im Text darüber. Eine solche dokumentierte Prämisse oder Quelle ist im
  Notebook nicht vorhanden. Die Daten enthalten hierfür gerade keinen belastbaren
  Nachweis.
- Diese Konstanten öffnen gemeinsam mit den analytischen Gates den personenbezogenen
  Export `kampagnenliste.csv`.
- Der Kopf dieser erzeugten Datei enthält gleichzeitig und unabhängig vom Gate-Ausgang
  die Anweisung „NICHT AN EIN KAMPAGNENSYSTEM UEBERGEBEN“. Die Datei ist damit laut
  Code freigegeben und laut eigenem Kopf gesperrt.

**Warum dies die Lehrfreigabe verhindert**

Es geht hier nicht um eine rechtliche Detailprüfung, sondern um saubere Beweisführung:
Das Notebook macht unbelegte externe Tatsachen zu booleschen Freigabegates und erzeugt
daraufhin eine personenbezogene Handlungsliste. Damit lehrt es, dass eine Behauptung im
Code einen organisatorischen Nachweis ersetzen könne.

**Präziser Lösungsansatz**

- Entweder die Voraussetzungen in Phase 1 ausdrücklich als **hypothetische, vom
  Auftraggeber gelieferte Szenarioprämissen** dokumentieren – mit Datum und
  Nachweisreferenz – und im Lehrtext klar von analytischen Ergebnissen trennen;
- oder beide Werte auf `False`/`None` lassen. Dann darf nur der aggregierte Bericht
  entstehen, nicht die personenbezogene Kampagnenliste.
- Analytische Lehrfreigabe und organisatorische Einsatzfreigabe als zwei getrennte
  Statusfelder führen.

**Abnahmekriterium:** Jeder organisatorische `True`-Wert verweist auf eine sichtbar
eingeführte Prämisse; ohne solche Prämisse kann kein personenbezogener Export entstehen.

## 3.4 Notebook 04 – Zeitreihe Nachfrageprognose

### 04-A: Der Methodenvergleich mit Notebook 1 ist falsch

**Problematische Stelle**

- Zelle 2: Notebook 1 habe Fahrten zufällig in Training und Test geteilt; dies sei
  richtig gewesen, weil Fahrten austauschbar seien.

Notebook 1 trennt im aktuellen Stand chronologisch. Außerdem sind Fahrten mit Saison,
Tarif- und Verhaltensänderungen nicht ohne Weiteres austauschbar. Die Aussage vermittelt
damit genau die methodische Vereinfachung, die die Reihe an anderer Stelle korrigiert.

**Präziser Lösungsansatz**

Den Absatz ersetzen durch: Notebook 1 verwendet ebenfalls einen zeitlichen Holdout. In
Notebook 4 ist die Reihenfolge zusätzlich Teil der Zielstruktur selbst, weil tägliche
Aggregatwerte, Autokorrelation und ein expliziter Prognosehorizont vorliegen. Der
Unterschied liegt in der Struktur der Aufgabe, nicht in „zufällig richtig“ gegenüber
„zeitlich richtig“.

**Abnahmekriterium:** Die Beschreibung entspricht der tatsächlich verwendeten
Aufteilung in Notebook 1 und behauptet keine generelle Austauschbarkeit der Fahrten.

### 04-B: Das Robustheitsgate für K2 und der Begriff „Pilotfreigabe“ sind nicht vorab eindeutig definiert

**Problematische Stellen**

- Zelle 5: Mindestens 95 % der Wetterpfade werden nur beim fachlichen Kriterium K1
  genannt. K2 verlangt lediglich geringere erwartete Kosten.
- Zelle 30: `PFAD_ANTEIL = 0.95` wird dennoch auf K1 **und** K2 angewandt; das
  Gesamturteil hängt von beiden ab.
- Zelle 30 nennt das Ergebnis „FREIGABE ALS PILOT“, während dieselbe Ausgabe simuliertes
  Wetter, nur ein Validierungs-/Testfenster und die fehlende Übersetzung in Räder und
  Schichten betont. Zelle 37 sagt anschließend, für eine Freigabe seien mehrere
  saisonale Fenster nötig.

**Warum dies die Lehrfreigabe verhindert**

Das Ergebnis ist numerisch robust – K1 hält in 290 von 300 Pfaden, K2 in 300 von 300.
Der aktuelle Ausgang wird daher nicht angezweifelt. Didaktisch bleibt aber ein nachträglich
ergänztes bindendes Gate und ein nicht definierter Freigabebegriff. Lernende können nicht
erkennen, ob „Pilot“ einen Schattenlauf, eine operative Dispositionshilfe oder lediglich
einen Machbarkeitsnachweis bezeichnet.

**Präziser Lösungsansatz**

1. In Phase 1 ausdrücklich festlegen, ob die 95-%-Robustheit für beide Kriterien gilt.
   Falls ja: K2 dort ergänzen. Falls nein: `K2_ROBUST` nur als Diagnose zeigen und nicht
   an das Urteil binden.
2. Den Status eindeutig benennen. Zum vorliegenden Nachweis passt etwa:
   **„Lehr-Machbarkeitsnachweis; Kandidat für einen Schattenpilot, keine operative
   Dispositionsfreigabe.“**
3. Alternativ „Pilot“ präzise definieren: Wer sieht die Prognose, wird danach gehandelt,
   welche Laufzeit und welches Abbruchkriterium gelten?
4. Status in Zelle 30, Modellpaket und Schlusszelle aus einer Variable ableiten.

**Abnahmekriterium:** Alle bindenden Kriterien stehen vollständig in Phase 1; „Pilot“
hat im gesamten Notebook genau eine definierte Bedeutung.

## 3.5 Notebook 05 – Assoziation Wege im Netz

### 05-A: Kosten sind zugleich vorhanden und angeblich nicht vorhanden

**Problematische Stellen**

- Zelle 17 setzt 35 € je Umsetzrunde und 2,20 € je verhinderter Fahrt und berechnet,
  dass keine Regel eine eigene Transportfahrt trägt.
- Zelle 19 sagt unmittelbar danach, die Wirtschaftlichkeit werde durch Kosten
  entschieden, „die wir nicht haben“.
- Zellen 25, 27, 30 und 31 behaupten erneut teils fehlende Kosten, verwenden aber die
  35 € gleichzeitig als Begründung gegen eine Automatik.

**Präziser Lösungsansatz**

Einheitlich formulieren: Die beiden Zahlen sind **gesetzte Szenarioannahmen**, keine
gemessenen Kosten. Sie sind für eine Lehr-Sensitivität verfügbar, aber nicht empirisch
belegt. „Kosten fehlen“ ist zu ersetzen durch „reale Kosten- und Wirkungsparameter
fehlen“.

**Abnahmekriterium:** Jede Erwähnung der Kosten unterscheidet klar zwischen vorhandener
Szenarioannahme und fehlender Realmessung.

### 05-B: Die Kostenrechnung setzt beobachtete Fahrten mit verhinderbaren Verlusten gleich

**Problematische Stelle**

- Zelle 17: `Fahrten je Werktag × 2,20 €` wird als wirtschaftlicher Wert der Regel
  behandelt.

Eine Assoziationsregel zeigt beobachtete, bereits zustande gekommene Fahrten. Sie enthält
keine Information darüber, wie viele zusätzliche Fahrten ohne Umverteilung verloren
gehen, wie viele durch eine Fahrt des Transporters tatsächlich gerettet würden oder ob
am Ziel Kapazität und am Start Bestand vorhanden sind. Aus ihr folgt daher keine kausale
Wirkung der Maßnahme.

**Präziser Lösungsansatz**

- Die aktuelle Rechnung ausdrücklich als **extreme Obergrenzenrechnung** kennzeichnen:
  Selbst wenn jede beobachtete Regelfahrt zusätzlich rettbar wäre, läge der Wert unter
  den gesetzten 35 €. Nur in dieser konservativen Bedeutung ist die Absage ableitbar.
- Für eine echte Wirtschaftlichkeitsprüfung werden mindestens benötigt: Leerstands-/
  Vollstandsereignisse, nicht erfüllte Nachfrage, Anfangsbestand, Stationskapazität,
  Transportkapazität, Eingriffszeitpunkt und geschätzter kausaler Effekt einer
  Umverteilung.
- Keine Formulierung darf aus Support oder Lift direkt einen Transportbedarf ableiten.

**Abnahmekriterium:** Der Text nennt die Rechnung Obergrenze/Szenario und behauptet
keine gemessene Zahl verhinderter Fahrten.

### 05-C: „Keine Regel freigegeben“ und „freigegeben als Entscheidungshilfe“ stehen nebeneinander

**Problematische Stellen**

- Zelle 25: „Die Kriterien sind erfüllt, freigegeben ist trotzdem nichts.“
- Zelle 27, Einstieg Phase 6: Es sei keine Regel freigegeben worden; die Folgeanalyse
  sei nur explorativer Planungsinput.
- Zellen 30 und 31: Dieselben zwei Regeln gingen als „freigegebene Entscheidungshilfe“
  in Betrieb.
- Zelle 31 behauptet zudem, der einmalige Split habe bei **8 von 9** Regeln gehalten.
  Der aktuelle Lauf ergibt **9 von 11** beim ursprünglichen Spätfenster und je nach
  rollierendem Fenster **8 bis 9 von 11**.

**Warum dies die Lehrfreigabe verhindert**

Das Notebook unterscheidet zu Recht statistische Auffälligkeit, wirtschaftliche
Handlungsfähigkeit und explorativen Planungsinput. Die Schlusszellen vermischen diese
Ebenen wieder. Zusätzlich ist die Stabilitätsaussage nach der Erweiterung auf elf Regeln
veraltet.

**Präziser Lösungsansatz**

1. Einen Status wählen und durchgängig verwenden. Fachlich sauber ist derzeit:
   **„Zwei statistisch auffällige Regelhypothesen; keine automatische oder wirtschaftlich
   belegte Umverteilungsregel. Stationssalden und Hotspots sind explorativer
   Planungsinput.“**
2. Soll eine menschliche Entscheidungshilfe als eigene Auslieferungsform gelten, muss
   sie bereits in Phase 1 als Produkt mit eigenen Kriterien definiert werden. Die drei
   aktuellen Kriterien sind nur ein Screening für Muster.
3. Alle Zähler im Schlussabschnitt aus den berechneten Variablen erzeugen. Korrekt ist
   aktuell: 9/11 im ursprünglichen späteren Drittel und 8–9/11 über die geprüften
   rollierenden Fenster.

**Abnahmekriterium:** Phase 5, Phase 6, CSV-Kopf und Schlusszelle verwenden denselben
Status; keine Stelle enthält mehr den veralteten Nenner 9.

### 05-D: Mehrere zentrale Zahlen in Phase 6 stammen nicht mehr aus dem aktuellen Lauf

**Problematische Stellen**

- Zelle 30 nennt in der aktuellen Tabelle ein mittleres theoretisches
  Netto-Ungleichgewicht von **25,7** Rädern je Werktag, erläutert danach aber mehrfach
  weiterhin **19,8**.
- Dieselbe Zelle nennt **10,7** frei endende Fahrten und **10,3** verschiedene Räder je
  Werktag; der aktuelle Lauf ergibt jeweils **8,87**.
- Der Text nennt für den Abstand zur nächsten Station 0,30 km Median und 0,58 km P90;
  aktuell sind es 0,33 km und 0,50 km. Für den Abstand zur Startstation stehen im Text
  1,27 km und 3,03 km; aktuell sind es 1,12 km und 2,30 km.
- Als aktuelle Hotspots nennt der Text Residenz, Universität Sanderring und
  Hauptbahnhof. Der Lauf weist Dom, Hauptbahnhof und Grombühl Klinikum aus.
- Der Anteil, bei dem die nächste Station nicht die Startstation ist, wird im Text mit
  87,1 % und später gerundet mit 91 % angegeben; die aktuelle Ausgabe beträgt 90,6 %.

**Warum dies die Lehrfreigabe verhindert**

Diese Zahlen tragen die didaktische Kernaussage der gesamten Deployment-Phase. Die
Rechnung ist aktuell, der erläuternde Text beschreibt jedoch teilweise einen älteren
Daten- oder Berechnungsstand. Lernende können nicht erkennen, welche Zahl und welche
räumliche Schlussfolgerung gilt.

**Präziser Lösungsansatz**

- Sämtliche veränderlichen Werte und Stationsnamen in Zelle 30 aus den bereits
  berechneten Variablen beziehungsweise aus `_MERKZETTEL` einsetzen.
- Wo eine dynamische Einsetzung im Markdown nicht zuverlässig möglich ist, die
  Interpretation direkt in der vorherigen Codezelle ausgeben und im Markdown nur die
  zeitstabile methodische Lehre stehen lassen.
- Für jede im Fließtext genannte Kennzahl einen automatischen Vergleich mit der
  zugrunde liegenden Tabelle ergänzen oder die Zahl nicht duplizieren.

**Abnahmekriterium:** Tabelle, Konsolenausgabe, Fließtext und Schlusszelle nennen
identische Werte und dieselben drei Hotspot-Stationen.

## 3.6 Notebook 06 – Anomalieerkennung auffälliger Vorgänge

### 06-A: Die nachgebesserte Stationsregel wird auf demselben Prüfzeitraum entwickelt und freigegeben

**Problematische Stellen**

- Zelle 39: Nach dem Scheitern der ursprünglichen Nulltagsregel werden „zwei Nulltage in
  Folge“ und `MINDESTBETRIEB = 5` eingeführt.
- Dieselbe Zelle bewertet diese neue Regel auf demselben Prüfzeitraum, auf dem das
  Problem der alten Regel sichtbar wurde.
- Zellen 43 und 44 leiten daraus einen Pilotstatus für Produkt B ab.

**Warum dies die Lehrfreigabe verhindert**

Die Ergänzungen sind fachlich plausibel, aber nach Sichtung des Prüfergebnisses Teil der
Modellentwicklung. Der Zeitraum ist damit verbraucht. Die Behauptung, die Parameter seien
nicht „angepasst, bis die Zahl stimmt“, ersetzt keine unabhängige Prüfung. Das Notebook
würde sonst genau die Testset-Nachnutzung legitimieren, vor der die Reihe mehrfach warnt.

**Präziser Lösungsansatz**

- Referenzdaten zum Aufbau der Normalität, einen **Entwicklungs-/Validierungszeitraum**
  für die Nulltagslogik und einen danach liegenden **unangetasteten Testzeitraum**
  anlegen.
- Zwei-Tage-Regel, Mindestbetrieb, Deduplizierung und Listenlänge vor Öffnen des finalen
  Tests einfrieren.
- Reicht die vorhandene Zeitachse nicht für drei belastbare Abschnitte, bleibt Produkt B
  im Status **„explorativ entwickelte Regel; prospektiver Schattenpilot nötig“**. Eine
  Pilotfreigabe darf dann nicht aus dem bisherigen Prüfzeitraum abgeleitet werden.

**Abnahmekriterium:** Der Status von B beruht auf Daten, die keine Regel- oder
Schwellenentscheidung beeinflusst haben, oder lautet ausdrücklich „nicht freigegeben“.

### 06-B: Für Produkt B fehlt ein vollständiges, vorab bindendes Gütekriterium

**Problematische Stelle**

- Zelle 4 definiert nur: Mindestens jede fünfte gemeldete Störungsepisode ist echt.
- Zelle 39 zeigt selbst, dass Präzision allein nicht genügt, und berechnet 9 von 11
  erkannten Episoden bei maximal einem Tag Verzögerung. Diese Größen sind aber nicht als
  bindende Phase-1-Gates festgelegt.

Eine Regel, die extrem selten meldet, kann die Präzision leicht erfüllen und fast alle
Störungen übersehen. Zudem wechselt die Auswertung zwischen gemeldetem Stationstag,
neuem Alarm und Störungsepisode. Ein Gate muss auf einer eindeutig definierten Einheit
liegen.

**Präziser Lösungsansatz**

Phase 1 vor der nächsten Prüfung mindestens um folgende Kriterien ergänzen:

- Präzision je **neuem Alarm** mindestens 20 % oder eine fachlich neu begründete
  Schwelle für Technikereinsätze;
- Mindest-Recall je **Störungsepisode**, fachlich vorab festgelegt;
- maximal zulässige Erkennungsverzögerung;
- tägliche Alarmkapazität und Deduplizierungs-/Ticketlogik;
- wirtschaftliche Schwelle für B mit eigenen, als Annahme oder Messung gekennzeichneten
  Kosten – nicht mit den Kosten von A2.

**Abnahmekriterium:** Der Pilotstatus hängt an allen vorab definierten Kriterien, nicht
nur an der Präzision; jede Kennzahl nennt ihren Nenner.

### 06-C: Zahlen, Schlussurteil und Modellpaket widersprechen einander

**Problematische Stellen**

- Zelle 39 berechnet 22,5 % je neuem Alarm und meldet beide Schwellen – 7,7 % und 20 % –
  als erfüllt. Direkt danach wird trotzdem fest ausgegeben: „Die Regel reisst BEIDE
  Huerden“.
- Zelle 40 spricht weiterhin von **3,9 %** und erklärt beide Hürden für gerissen.
- Kommentare in Zelle 39 sprechen noch von **259 neuen Alarmen** und **381 täglichen
  Rohmeldungen**; aktuell sind es 40 beziehungsweise 73.
- Zelle 40 spricht von rund **250 unnötigen Technikeinsätzen** und anschließend von
  „der fehlenden Episode“, obwohl aktuell nur 40 neue Alarme vorliegen und 2 von 11
  Episoden fehlen.
- Zelle 40: Aufgabe B sei nicht gelöst und nicht freigegeben.
- Zelle 42, Modellpaket: `freigegeben_fuer` ist leer und der B-Status lautet fest
  „NICHT FREIGEGEBEN“; die unmittelbar folgende Ausgabe nennt B dynamisch
  „freigegeben (Pilot)“.
- Zellen 43 und 44 nennen B wiederum einen freigegebenen Pilot; später in Zelle 44 heißt
  es: „Bis dahin läuft nichts – die Nulltage-Regel ist nicht freigegeben.“

**Präziser Lösungsansatz**

1. Zunächst aufgrund von 06-A einen fachlich korrekten Status festlegen. Ohne neuen
   unabhängigen Test sollte B „nicht freigegeben; Schattenprüfung offen“ bleiben.
2. Eine einzige Variable beziehungsweise strukturierte Statusfunktion für A1, A2 und B
   verwenden.
3. Modellpaket, Konsolenausgabe, Deployment-Tabelle und Schlusszelle ausschließlich aus
   dieser Quelle erzeugen.
4. Kennzahlen ebenfalls dynamisch einsetzen; die veralteten 3,9 % und der feste Satz
   „beide Hürden gerissen“ sind zu entfernen.
5. Automatische Konsistenztests ergänzen, etwa:
   - Wenn `alarmquote >= 0.20`, darf der Text nicht „20-%-Gate gerissen“ enthalten.
   - Wenn B nicht in `freigegeben_fuer` steht, darf kein anderer Abschnitt B als
     freigegeben bezeichnen.

**Abnahmekriterium:** Für jede Kombination der Gate-Ergebnisse kann genau ein Status
entstehen; Artefakt und sichtbare Ausgaben stimmen exakt überein.

### 06-D: Die projektweite Schlussübersicht widerspricht ihrem eigenen Zweck

**Problematische Stelle**

- Zelle 44 erklärt zunächst, die Übersicht nenne bewusst keine Ergebnisse oder
  Freigabestatus, weil solche Duplikate veralten.
- Unmittelbar danach folgt dennoch eine Tabelle „geht in Betrieb als“ mit Statusangaben
  für alle sechs Notebooks und der Satz: „Jedes Verfahren ist im Betrieb“.

Diese Angaben sind bereits mit mehreren Einzelnotebooks und mit Notebook 06 selbst
unvereinbar. Die Tabelle reproduziert genau die zweite, veraltende Statusquelle, vor der
der vorherige Absatz warnt.

**Präziser Lösungsansatz**

- Die zweite, statusbezogene Tabelle und „Jedes Verfahren ist im Betrieb“ entfernen.
- Die erste methodische Übersicht ohne Ergebnisse beibehalten.
- Falls eine projektweite Statusübersicht gewünscht ist, sie außerhalb der Notebooks aus
  den jeweiligen Artefakt-Metadaten automatisiert erzeugen; nicht in Notebook 06
  handpflegen.

**Abnahmekriterium:** Notebook 06 enthält keine manuell duplizierten Freigabestatus der
anderen Notebooks und widerspricht seinem eigenen Hinweis zur Single Source of Truth
nicht mehr.

## 4. Priorisierte Restarbeiten

### Priorität 0 – vor jeder Lehrfreigabe zwingend

1. **Notebook 06:** Produkt B auf „nicht unabhängig geprüft“ zurücksetzen,
   Entwicklungs-/Testtrennung herstellen und alle Statusquellen synchronisieren.
2. **Notebook 02:** Einen kanonischen Gate-Katalog herstellen; die 70-%-Hürde entweder
   eindeutig diagnostisch lassen oder vorab neu als bindend begründen.
3. **Notebook 03:** Hysterese und zeitliches Stabilitätsgate korrekt vorab definieren
   beziehungsweise die Kampagnenfreigabe zurücknehmen; unbelegte organisatorische
   `True`-Werte beseitigen.
4. **Notebook 01:** Test 2 korrekt als Kalibrierungszeitraum behandeln, Schattenablauf
   und Produktstatus vereinheitlichen sowie das tatsächliche Quantilmodell ausliefern.
5. **Notebook 05:** Freigabestatus vereinheitlichen und die Kostenrechnung als
   Obergrenzen-Szenario statt als gemessene Wirkung erklären.

### Priorität 1 – danach, weiterhin vor Veröffentlichung

6. **Notebook 01:** App-Schnittstelle auf eine einzige Zeitquelle umbauen und positive
   wie negative Zweige gezielt testen.
7. **Notebook 04:** Falsche Referenz auf Notebook 1 korrigieren; Robustheitsgate und
   Pilotbegriff vollständig in Phase 1 definieren.
8. **Notebook 03:** Falsche sprachliche Interpretation von 20,70 % und 25 % dynamisch
   aus den Ergebnissen erzeugen.
9. **Notebook 05:** Veraltete Stabilitätszahlen 8/9 durch die aktuellen, automatisch
   erzeugten Werte 9/11 beziehungsweise 8–9/11 ersetzen.
10. **Notebook 02:** Veraltete Querverweise auf einen Zufallssplit in Notebook 1
    korrigieren.

## 5. Verbindlicher Abnahmelauf nach der Überarbeitung

Für die endgültige Lehrfreigabe sollten alle sechs Notebooks anschließend erneut in
einer leeren Laufzeitumgebung ausgeführt und anhand derselben Checkliste abgenommen
werden:

- jede Codezelle läuft in Reihenfolge ohne Fehler;
- alle Tabellen und Schlusszellen beziehen Zahlen aus berechneten Variablen;
- Erfolgskriterien aus Phase 1 stimmen namens- und bedeutungsgleich mit den bindenden
  Code-Gates überein;
- Validierung, Test und gegebenenfalls Schattenbetrieb haben eindeutige, nicht
  überlappende Rollen;
- eine nach Öffnung des Tests entwickelte Regel erhält ohne neuen Holdout keine
  Freigabe;
- Text, Konsolenausgabe, Exportdatei und Modellpaket tragen denselben Status;
- Positiv- und Negativbeispiele prüfen den jeweils behaupteten Codepfad;
- Querverweise zwischen den sechs Notebooks entsprechen deren aktuellem Stand;
- „Lehrfreigabe“, „Schattenbetrieb“, „Pilot“ und „operativer Einsatz“ werden nicht als
  Synonyme verwendet.

## 6. Abschließende Güteeinschätzung

Die Reihe ist **inhaltlich deutlich gereift**. Besonders positiv sind die konsequente
Diskussion des Entscheidungszeitpunkts, die Verwendung echter Baselines, zeitlicher
Splits, Unsicherheitsmaße, Sensitivitätsanalysen und die wiederholte Trennung zwischen
Kennzahl und betrieblicher Handlung. Die Notebooks zeigen viele wertvolle typische
Fehlwege und Korrekturen.

Gerade deshalb sind die verbliebenen Widersprüche freigabekritisch: Sie betreffen nicht
Randdetails, sondern die Kernbotschaft der Reihe – Kriterien vorab festlegen, Testdaten
nicht wiederverwenden und nur das ausliefern, was tatsächlich geprüft wurde. Nach
Beseitigung der oben genannten Punkte ist eine Lehrfreigabe realistisch. Notebook 04
benötigt voraussichtlich nur eine kurze Konsistenzkorrektur; bei 01, 02, 03, 05 und 06
müssen die Freigabelogiken beziehungsweise Statuspfade nochmals geschlossen werden.
