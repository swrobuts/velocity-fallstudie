# Gemeinsamer Recheck der Notebooks 01 und 02

**Prüfdatum:** 2. September 2026  
**Geprüfte Dateien:**

- `01_Regression_Fahrtdauer.ipynb`
- `02_Klassifikation_Wartungsrisiko.ipynb`

## Kurzurteil

Beide neuen Fassungen sind technisch reproduzierbar und wesentlich besser als die zuvor geprüften Versionen. Eine uneingeschränkte Endfreigabe kann ich dennoch noch nicht für beide aussprechen.

| Ebene | Notebook 01 – Fahrtdauer und Preis | Notebook 02 – Wartungsrisiko |
|---|---|---|
| technische Ausführung | **freigabefähig** | **freigabefähig** |
| analytischer Lehrprototyp | **sehr gut** | **gut bis sehr gut** |
| endgültige Lehr-/Abgabefassung | **mit kleinen, aber relevanten Auflagen** | **noch nicht freigeben** |
| reale App-/Betriebsfreigabe | **nein; im Notebook korrekt gesperrt** | **nein; nur historischer Lehrtest und noch offener Schattenlauf** |

Das wichtigste Ergebnis ist die saubere Trennung zwischen der Qualität des Notebooks und der Freigabe des darin untersuchten Produkts:

- Notebook 01 kann methodisch zu dem richtigen Ergebnis kommen, dass **kein unter der Architekturvorgabe zulässiger Produktkandidat freigegeben werden darf**.
- Notebook 02 kann zeigen, dass eine einfache Fachregel historisch besser als der Random Forest war, ohne damit bereits eine reale Werkstattfreigabe zu begründen.

## 1. Prüfgrundlage und Reproduzierbarkeit

Beide Dateien wurden ohne gesetzte Sondervariable `VELO_BASIS` vollständig von oben nach unten neu ausgeführt.

| Prüfung | Notebook 01 | Notebook 02 |
|---|---:|---:|
| SHA-256 | `97e1d39612269698d2dffba29b4a4cf28d38b0d9732be98c9ceabfe17b1f6533` | `934ba18aca0a90957b444df886512599d290a9065044792c533f517b2a90561e` |
| Zellen | 64 | 50 |
| Codezellen | 25 | 19 |
| frisch ausgeführt | **25 von 25** | **19 von 19** |
| Ausführungsfehler | 0 | 0 |
| versionierter Datenstand | Git-Commit `07d1b5df58c690044b19ec9776903c944972928f` | derselbe Commit |
| gespeicherte und frische Resultate | inhaltlich identisch; nur andere Aufteilung zweier Textausgabeblöcke | exakt identisch |

Die Wiederholungsläufe erzeugten auch die vorgesehenen Artefakte konsistent:

- Notebook 01: 348 eindeutige Tabellenschlüssel, keine Dubletten; alle Zeilen korrekt mit `gesperrt_primaergate` markiert.
- Notebook 02: historische Testliste und Schattenliste mit jeweils 60 eindeutigen Rädern und lückenlosen Rängen 1 bis 60.
- Der in Notebook 02 früher defekte Nichtfreigabepfad läuft jetzt kontrolliert: Wird `KEINE_FREIGABE=True` gesetzt, werden weder Kapazitätsrechnung noch CSV- oder Modellartefakte erzeugt.

---

# 2. Notebook 01 – Regression der Fahrtdauer und Preisspanne

## 2.1 Was überzeugend gelöst ist

### Geschäftsfrage, Zielauswahl und Leakage

Der neue Geschäftsprozess ist fachlich plausibel:

```text
Startstation ist bekannt
        ↓
Nutzer wählt das geplante Ziel
        ↓
Radtyp, Zeitpunkt und Kontokontext liegen vor
        ↓
Dauer- beziehungsweise Preisspanne wird berechnet
        ↓
Anzeige nur bei bestandenen Produkt- und Anfragegates
```

Damit ist die Zielstation grundsätzlich eine zulässige Eingabe und kein Leakage, weil sie vor der Vorhersage durch die Zielauswahl des Nutzers entsteht.

Das Notebook benennt auch die verbleibende Einschränkung korrekt: In den historischen Daten steht das **tatsächliche** Fahrtziel, im späteren Prozess würde das **geplante** Ziel eingegeben. Das tatsächliche Ziel ist daher nur ein unvalidierter Stellvertreter. Diese Einschränkung wird nicht versteckt oder kleingeredet.

### Geltungsbereich und Ausreißer

Die fachliche Population wird konsistent gebildet:

- nur abgeschlossene Fahrten;
- keine Fahrten unter einer Minute;
- keine Fahrten über acht Stunden;
- nur Fahrten mit Zielstation;
- keine Rundtouren mit identischem Start und Ziel.

Die Acht-Stunden-Grenze wird zu Recht als fachliche Setzung bezeichnet. Rundtouren werden zunächst analysiert und danach aus genau dem Produkt ausgeschlossen, für das die Güte bewertet wird.

### Zeitliche Trennung

| Abschnitt | Fälle | Zeitraum | Funktion |
|---|---:|---|---|
| Training | 45.678 | 24.08.2021–17.12.2024 | Modelllernen |
| Validierung | 11.420 | 17.12.2024–06.08.2025 | Modellwahl |
| Test 1 | 9.516 | 06.08.2025–24.04.2026 | einmalige Prüfung der Punktschätzung |
| Test 2 | 9.517 | 24.04.2026–24.08.2026 | Kalibrierung und Auswahl des Intervallprodukts |

Besonders positiv ist, dass Test 2 nicht mehr als unabhängiger Endtest ausgegeben wird. Das Notebook erklärt ausdrücklich, dass Test 2 durch Kandidatenwahl, Filterung und Gatekalibrierung verbraucht ist. Ein unabhängiger Endnachweis kann erst ein zukünftiger Schattenbetrieb liefern.

### Baselines, Preprocessing und Modellwahl

Die Baselines sind sinnvoll gestaffelt:

| Ansatz | Validierungs-MAE |
|---|---:|
| globaler Median | 8,82 min |
| Median je Radtyp | 8,66 min |
| Median je Startstation | 7,69 min |
| Median je Verbindung | **4,07 min** |
| Random Forest | **3,38 min** |

Der Random Forest schlägt damit die starke Routenbaseline um rund 17 %. Auf Test 1 erreicht er 3,27 Minuten MAE gegenüber 3,95 Minuten der Routenbaseline.

Die Ablation ist ebenfalls überzeugend:

- Random Forest ohne Zielmerkmale: 8,06 Minuten MAE;
- Random Forest mit Zielmerkmalen: 3,38 Minuten MAE.

Das belegt den Nutzen der Zielauswahl innerhalb dieses Datensatzes.

Weitere methodisch gute Punkte:

- `OneHotEncoder(handle_unknown="ignore")` verhindert technische Abstürze im Modellpfad.
- Die produktive Tabellenlogik lehnt unbekannte Verbindungen ausdrücklich ab, statt ihnen stillschweigend einen Nullvektor zu geben.
- Die lineare Regression verwendet `drop="first"`; die Dummy-Falle innerhalb eines Merkmals ist damit vermieden.
- Das Notebook warnt korrekt, dass die Koeffizienten wegen redundanter Start-, Ziel-, Routen-, Strecken- und Steigungsmerkmale nicht eindeutig interpretierbar sind.
- Stunde, Wochentag und Monat werden zyklisch kodiert.
- Tageswetter wird nicht verwendet, weil nur nachträglich bekannte Tageswerte vorliegen. Diese Leakage-Vermeidung ist fachlich richtig.

### Tarif- und Preisfehlerberechnung

Die Preisfunktion berücksichtigt korrekt:

- Aufrundung angefangener Minuten;
- Startgebühr;
- verbleibende Freiminuten zum Fahrtbeginn;
- radtypabhängigen Minutenpreis;
- Rabatt;
- Tageshöchstpreis.

Die rekonstruierte Tarifformel stimmt auf Test 1 zu **100,00 %** exakt mit dem gespeicherten Entgelt überein; die größte Abweichung beträgt 0,00 Euro. Der Preisfehler wird deshalb korrekt aus Ist- und Schätzpreis berechnet und nicht fälschlich als Minutendifferenz mal Minutenpreis.

### Kandidatenvergleich und Produktsperre

Die drei Intervallkandidaten werden nun mit derselben gerundeten Minuten- und Preislogik verglichen:

| Kandidat | potenzielle Auskunft | Abdeckung der angezeigten Fälle | preisabhängige Fälle | Wilson-Untergrenze Primärgate | Urteil nach Notebookdefinition |
|---|---:|---:|---:|---:|---|
| Quantilregression | 66,6 % | 94,4 % | 2.161 | **82,2 %** | erfüllt |
| historische Perzentiltabelle | 54,1 % | 93,1 % | 1.823 | **79,3 %** | nicht erfüllt |
| vorab berechnete Quantiltabelle | 58,7 % | 91,7 % | 2.001 | **75,7 %** | nicht erfüllt |

Die Architekturentscheidung wird jetzt korrekt vor die Produktwahl gestellt:

- Die einzige rechnerisch bestehende Quantilregression benötigt einen Laufzeitdienst.
- Die Vorgabe erlaubt nur eine statische Seite beziehungsweise CSV.
- Beide statisch betreibbaren Kandidaten fallen am Primärgate durch.

Das daraus gezogene Urteil ist richtig: **Unter der geltenden Architekturvorgabe gibt es derzeit keinen zulässigen freigabefähigen Kandidaten.**

Die App setzt dieses Urteil konsistent um:

- Die Perzentiltabelle bleibt ein Diagnoseartefakt.
- Alle 348 Artefaktzeilen tragen den globalen Sperrstatus.
- Potenzielle Artefaktreichweite: 54,1 %.
- Tatsächliche App-Reichweite bei aktiver Sperre: **0 %**.
- Offlinebewertung und diagnostisch entsperrte App-Logik stimmen auf allen 9.517 Test-2-Fahrten überein.
- Sieben geprüfte ungültige Eingaben werden jeweils mit einem eigenen Fehlergrund abgewiesen.

## 2.2 Verbleibende Punkte vor einer uneingeschränkten Endfreigabe

### P0.1 Primärgate je Radtyp: Die Produktentscheidung muss noch klarer begründet werden

Das Notebook legt inzwischen offen fest, dass das Primärgate in der **vorab preisabhängigen Gruppe nur aggregiert**, nicht zusätzlich je Radtyp bindet. Je Radtyp wird dagegen die Abdeckung über alle angezeigten Fälle geprüft.

Diese Entscheidung ist transparent, aber fachlich folgenreich. Eine unabhängige Gegenrechnung für die Quantilregression ergibt innerhalb der tatsächlich preisabhängigen Gruppe:

| Radtyp | Fälle | beobachtete Abdeckung | Wilson-Untergrenze |
|---|---:|---:|---:|
| CARGO | 214 | 81,8 % | **76,1 %** |
| CITY | 1.035 | 82,8 % | **80,4 %** |
| EBIKE | 911 | 85,5 % | **83,1 %** |

Damit würde die Quantilregression ein zusätzliches Primärgate je Radtyp für CARGO nicht nehmen. Die Begründung, die Teilgruppen seien zu klein, überzeugt für 214, 1.035 und 911 Fälle nur eingeschränkt.

**Abhilfe:** Vor der finalen Fassung eindeutig entscheiden und in Phase 5.5 festhalten:

1. Entweder gilt die Zusage in der preisabhängigen Gruppe nur aggregiert. Dann muss deutlich erklärt werden, dass keine entsprechende Zusage je Radtyp gemacht wird.
2. Oder die geschäftliche Zusage soll je Radtyp gelten. Dann muss das Primärgate je Radtyp bindend werden; die Quantilregression wäre in dieser Fassung ebenfalls noch nicht freigabefähig.

Die aktuelle Formulierung „insgesamt und je Radtyp“ kann sonst so gelesen werden, als gelte sie auch für genau die Gruppe, in der die Dauerschätzung den Preis beeinflusst.

### P0.2 Primärgruppenbildung verwendet an einer Stelle noch den ungerundeten Rand

Die Anzeige, der Preis und die Breitenregel arbeiten inzwischen korrekt mit gerundeten Anzeigeminuten. Die Einteilung „preisabhängig“ verwendet für die Quantilregression im Kandidatenvergleich jedoch noch den ungerundeten unteren Modellwert:

```python
preisabhaengig = zeigbar & (zukunft.freiminuten_rest < zukunft[u])
```

Mit dem gerundeten angezeigten Rand entstehen 2.160 statt 2.161 preisabhängige Fälle. Die Wilson-Untergrenze bleibt praktisch gleich: 82,23 % statt 82,24 %. Das aktuelle Urteil ändert sich nicht, aber der Anspruch „exakt dieselbe Anzeigelogik“ ist noch nicht vollständig erfüllt.

**Abhilfe:** Auch die Gruppenbildung ausschließlich aus `anzeigeminuten(u)` und `anzeigeminuten(o)` ableiten.

### P1.1 Die vorab berechnete Quantiltabelle ist nur eine grobe Variante

Für die Quantiltabelle wird pro Verbindung, Radtyp und Zeitfenster der Median jedes numerischen Merkmals gebildet und dieser eine repräsentative Merkmalsvektor durch die Quantilmodelle geschickt.

Das ist bei zyklischen Paaren problematisch: Die getrennten Mediane von Sinus und Kosinus müssen keinen realen Zeitpunkt ergeben. Außerdem ist die Vorhersage am Medianvektor nicht dasselbe wie der Median der Vorhersagen über reale historische Kontexte.

Damit ist sauber gezeigt, dass **diese konkrete Quantiltabelle** nicht genügt. Noch nicht gezeigt ist, dass jede statische Materialisierung der Modellvorhersagen scheitert.

**Abhilfe:** Mindestens eine robustere statische Variante prüfen, beispielsweise:

- Vorhersagen für alle real beobachteten Kontexte einer Gruppe berechnen und anschließend aggregieren;
- feinere Schlüssel für Wochentag und Saison;
- oder zeitlich kalibrierte Conformal-Intervalle mit statischer Materialisierung.

Die Schlussfolgerung sollte bis dahin auf den tatsächlich geprüften Tabellenaufbau begrenzt bleiben.

### P1.2 Reale Produktfreigabe bleibt unabhängig davon ausgeschlossen

Auch nach den obigen Korrekturen fehlen für einen sichtbaren Appbetrieb:

- Erfassung des geplanten Ziels;
- prospektiver Schattenbetrieb;
- Vergleich von geplantem und tatsächlichem Ziel;
- unabhängige Prüfung des eingefrorenen Artefakts;
- Entscheidung, ob ein Laufzeitdienst zugelassen wird.

Das Notebook benennt diese Punkte bereits erfreulich klar.

## 2.3 Sprachliche Qualität

Die Sprache ist inzwischen sehr gut: verständlich, kritisch, anschaulich und weitgehend konsistent. Besonders gelungen sind die Unterscheidungen zwischen geplantem und tatsächlichem Ziel, potenzieller und realer Reichweite sowie Diagnoseartefakt und freigegebenem Produkt.

Kleine Restpunkte:

- Die Überschrift „Tabelle bauen und ausliefern“ klingt trotz aktiver Produktsperre stärker als der Inhalt. „Diagnoseartefakt bauen“ wäre eindeutiger.
- Ein Codekommentar zur Quantiltabelle behauptet noch, das Modell kenne die Wetterlage; Wetter ist bewusst nicht in `NUMERISCH` enthalten.
- Die Entscheidung, das Primärgate je Radtyp nicht anzuwenden, sollte bereits bei der Definition des Intervallkriteriums stehen und nicht erst später im Deploymentteil erklärt werden.

## 2.4 Güteeinschätzung Notebook 01

| Dimension | Bewertung |
|---|---:|
| Geschäftsfrage und Zielprozess | 9,5/10 |
| Leakage- und Geltungsbereichslogik | 9/10 |
| zeitliche Trennung und Ehrlichkeit des Holdouts | 9/10 |
| Baselines, Preprocessing und Modellvergleich | 9/10 |
| Tarif-, Preis- und App-Logik | 9,5/10 |
| Freigabe- und Sperrlogik | 9/10 |
| sprachliche Qualität | 9/10 |
| **Gesamtstand** | **9/10** |

**Urteil Notebook 01:** Als analytischer Lehrprototyp sehr stark. Für eine endgültige Abgabe ist es nahezu freigabefähig; vor der uneingeschränkten Freigabe sollten die Primärgate-Ebene eindeutig festgelegt, die letzte Rundungsabweichung beseitigt und die Aussage zur statischen Quantiltabelle enger formuliert werden. Die sichtbare Preisauskunft bleibt zu Recht gesperrt.

---

# 3. Notebook 02 – Klassifikation des Wartungsrisikos

## 3.1 Was überzeugend gelöst ist

### Geschäftsfrage und Entscheidungsnähe

Die Frage ist sinnvoll und handlungsnah: Welche 60 Räder soll die Werkstatt im nächsten Quartal vorsorglich prüfen? Die feste Kapazität führt folgerichtig zu einer Rangliste und zu `Precision@60` statt zu einer beliebigen Klassifikationsschwelle.

Das Notebook erklärt außerdem vorbildlich, dass alle Daten synthetisch sind und reale Trefferquoten oder Einsparungen daraus nicht abgeleitet werden dürfen.

### Stichtags- und Featurelogik

- Merkmale werden nur aus der Zeit vor dem Stichtag gebildet.
- Das Label liegt in den folgenden 90 Tagen.
- Der Split erfolgt entlang der Zeit.
- Offene Schäden werden aus der Vorsorgepopulation ausgeschlossen.
- Kilometer werden in sinnvoller Qualitätsreihenfolge aus Sensor, Routenmatrix und Dauer-mal-Tempo gewonnen.
- 67 Fahrten über acht Stunden werden vor der Verschleißberechnung ausgeschlossen.
- `km_seit_reparatur` wird bei der erledigten Reparatur zurückgesetzt.
- Die Ablation Meldungszeitpunkt gegen Reparaturzeitpunkt wird auf demselben Datenstand gerechnet und ehrlich interpretiert: 53 gegen 53 Treffer, 59 von 60 Rädern gemeinsam.

### Baselines und Ergebnis

| Verfahren | Treffer in Top 60 | Precision@60 | Szenariokosten |
|---|---:|---:|---:|
| ältestes Rad zuerst | 25 | 41,7 % | 16.895 € |
| meiste Kilometer gesamt | 29 | 48,3 % | 16.075 € |
| km seit letzter Reparatur | **53** | **88,3 %** | **11.155 €** |
| Entscheidungsbaum | 45 | 75,0 % | 12.795 € |
| Random Forest | 44 | 73,3 % | 13.000 € |

Die starke Fachregel schlägt den Random Forest sowohl im letzten historischen Zeitraum als auch knapp über die fünf davorliegenden Validierungsquartale:

- Regel: 169 Treffer;
- Random Forest: 165 Treffer;
- Forest besser in zwei, schlechter in drei Quartalen.

Damit ist die Entscheidung **gegen einen produktiven Random Forest** plausibel. Das Notebook zeigt überzeugend, dass ein Modell seinen zusätzlichen Betriebsaufwand verdienen muss.

### Unsicherheit und Nichtfreigabepfad

Die Wilson-Intervalle sind korrekt:

| Kandidat | Treffer | Punktschätzer | 95-%-Wilson-Intervall |
|---|---:|---:|---:|
| Regel | 53 von 60 | 88,3 % | 77,8–94,2 % |
| Random Forest | 44 von 60 | 73,3 % | 61,0–82,9 % |

Nur die Regel stützt damit im historischen letzten Zeitraum die 70-%-Hürde statistisch; beim Forest ist das Ergebnis unentschieden.

Der früher defekte Pfad „kein Kandidat besteht“ ist technisch behoben. Beide nachfolgenden Zellen wurden unabhängig mit `KEINE_FREIGABE=True` ausgeführt und beenden sich kontrolliert, ohne Listen oder Artefakte zu schreiben.

### Historische Liste und Schattenliste

Die Artefakte sind nun sauber getrennt:

- `testliste_historisch_2026-05-26.csv`: Ausgang bekannt, nur Rückschau;
- `schattenliste_2026-08-24.csv`: Ausgang noch offen, nicht handlungsleitend;
- Bewertbarkeit der Schattenliste ab 22.11.2026.

Diese Unterscheidung ist fachlich richtig und gegenüber früheren Fassungen ein deutlicher Fortschritt.

## 3.2 Verbleibende Freigabeblocker

### P0.1 K3 misst nicht das, was Text und Erfolgskriterium behaupten

In Phase 1 steht als fachliche Hürde:

> Mindestens 70 % der 60 ausgewählten Räder müssen im Folgequartal auffällig werden.

Die fünf Validierungsquartale der Regel erreichen jedoch:

| Stichtag | Treffer | Precision@60 |
|---|---:|---:|
| 02.03.2025 | 38 | 63,3 % |
| 31.05.2025 | 41 | 68,3 % |
| 29.08.2025 | 39 | 65,0 % |
| 27.11.2025 | 24 | 40,0 % |
| 25.02.2026 | 27 | 45,0 % |
| **Summe** | **169 von 300** | **56,3 %** |

Keines dieser fünf Quartale erreicht 70 %. Eine einfache zusammengefasste Wilson-Gegenrechnung für 169 von 300 ergibt ungefähr **50,7–61,8 %**. Wegen wiederholt beobachteter Räder ist dies kein perfektes inferenzstatistisches Intervall, aber der Abstand zur 70-%-Hürde ist eindeutig.

Der neue Code ersetzt die absolute Stabilitätsfrage durch ein relatives Lift-Gate:

```text
Lift gegenüber der jeweiligen Quartalsgrundrate ≥ 1,5
in mindestens 4 von 5 Quartalen
```

Das ist als Maß für Ranglistenqualität sinnvoll und wird nun symmetrisch auf Regel und Wald angewandt. Es beweist aber **nicht**, dass das Geschäftsversprechen von 70 % saisonübergreifend gehalten wird.

Zusätzlich widersprechen sich Text und Code:

- Der Markdowntext sagt, K3 verlange, dass ein Modell die Faustregel über mehrere Quartale schlägt.
- Ein Codekommentar sagt, K3 prüfe in mehreren Quartalen die K1a-Hürde.
- Der tatsächlich ausgeführte Code prüft weder das eine noch das andere, sondern den Lift zur Grundrate.

**Abhilfe:** Vor der Messung eine eindeutige Entscheidung treffen:

1. Ist 70 % ein unverhandelbares Betriebsversprechen, darf der Lift es nicht ersetzen. Dann ist derzeit nur ein historischer Kandidat für den Schattenbetrieb vorhanden, keine Freigabe.
2. Soll die Anforderung saisonabhängig werden, muss Phase 1 entsprechend geändert werden, beispielsweise in ein relatives Lift- oder eine saisonabhängige Kapazitätszielgröße.
3. Definition, Code, Tabellenspalte und Schlussfolgerung müssen anschließend dieselbe K3-Frage verwenden.

### P0.2 Die zentrale Schlussprosa widerspricht weiterhin dem Rechenkern

Mehrere prominente Aussagen sind aktuell falsch oder irreführend:

| Aussage im Notebook | aktueller Rechenkern |
|---|---|
| „Die Entscheidung unten folgt K1a“ | Pflichtgates sind **K1a, K1b, K2 und K3** |
| „Der Wald reißt das dritte Kriterium“ | Der Wald **besteht K3** und reißt **K1b** |
| „Ausgeliefert wird deshalb die Faustregel. Sie kostet eine Zeile SQL“ | Die Regel braucht komplexe, versionierte Merkmalslogik; das wird später selbst korrekt erklärt |
| „sie trifft genauso gut“ | 53 gegen 44 im historischen Zeitraum; 169 gegen 165 in der Validierung |
| „knapp vorn (53 gegen 44)“ | neun Treffer beziehungsweise 15 Prozentpunkte sind nicht knapp |
| „über fünf Quartale deutlich (169 gegen 165)“ | vier Treffer auf 300 Listenplätze sind ein kleiner Unterschied |
| „Beide Verfahren belegen die 70-%-Hürde“ | Nur die Regel belegt sie im historischen Zeitraum; Forest-Untergrenze 61,0 % |
| Grundrate schwanke „mehr als das Fünffache“ | 14,4 % bis 49,6 % entsprechen rund dem **3,4-Fachen** |
| „Sieben von zehn geprüften Rädern“ | Regel: **8,8 von zehn** |

Diese Stellen stehen in den Kapiteln 5.6, 6.1 und im abschließenden Kreislauf. Sie betreffen die zentrale Entscheidung und sind daher Freigabeblocker, keine bloßen Tippfehler.

**Abhilfe:** Alle Entscheidungssätze aus einer einzigen Ergebnisstruktur erzeugen oder mit Assertions gegen die berechneten Gates absichern. Die manuell eingetragenen Alttexte vollständig entfernen.

### P0.3 Ausmusterung innerhalb des Prognosefensters wird als vollständig beobachtet behandelt

Ein Rad wird in die Population aufgenommen, wenn es am Stichtag aktiv ist. Wird es innerhalb der folgenden 90 Tage ausgemustert, endet seine Beobachtungszeit vorzeitig. Ohne Schadensmeldung wird es trotzdem als negativer Fall gezählt.

Unabhängige Gegenrechnung:

| Bereich | im 90-Tage-Fenster ausgemustert | davon als negativ gezählt |
|---|---:|---:|
| gesamtes Panel | 107 | 85 |
| historischer letzter Zeitraum | 27 | 17 |
| davon auf der ausgewählten Top-60-Regelliste | 10 | nicht separat als zensiert behandelt |

Das ist informative Zensierung: Ein ausgemustertes Rad kann nach dem Ausmusterungsdatum keine Meldung mehr erzeugen. Ob es ohne Ausmusterung auffällig geworden wäre, ist unbekannt.

**Abhilfe:** Eine der folgenden Lösungen explizit umsetzen:

- nur Stichtagszeilen verwenden, deren Rad während des gesamten Labelhorizonts beobachtbar bleibt;
- Ausmusterung als konkurrierendes Ereignis modellieren;
- Survival-/Time-to-event-Ansatz mit Zensierung;
- oder mindestens eine Sensitivitätsanalyse mit und ohne betroffene Zeilen rechnen.

### P1.1 Unbekannte Radtypen führen weiterhin zu stillen `NaN`-Rangwerten

Die Distanzschätzung verwendet eine Geschwindigkeitstabelle je Radtyp. Ein neuer Radtyp erhält `NaN`; das Rad kann dadurch still ans Ende der Liste rutschen. Das Notebook erwähnt dies im Monitoring, verhindert den Fehler aber nicht technisch.

**Abhilfe:** Bei unbekanntem Radtyp hart abbrechen oder eine fachlich freigegebene, explizite Fallbackgeschwindigkeit verwenden. Ein Monitoringhinweis allein reicht nicht.

### P1.2 Der historische Holdout ist kein unabhängiger Freigabetest

Das Notebook sagt an einer Stelle korrekt, dass die Ergebnisse des letzten historischen Zeitraums in früheren Fassungen bereits angesehen wurden. Danach wurden Daten- und Merkmalslogik verändert. Der Zeitraum ist deshalb eine historische Bestätigungsperiode, kein unangetasteter Endtest.

Die Schattenliste vom 24.08.2026 ist der richtige nächste Schritt, aber am Prüfdatum noch nicht auswertbar. Bis zum 22.11.2026 gibt es folglich keinen unabhängigen Freigabenachweis.

### P1.3 Ziel und Kosten bleiben für einen realen Einsatz zu grob

- Ziel ist jede Schadensmeldung, unabhängig von Schwere und Vermeidbarkeit.
- Beim engeren Ziel „fahruntauglich“ erreicht die Regel 29 von 60, der Forest 24 von 60.
- Die Kostenmatrix behandelt leichte und schwere Schäden gleich.
- Ein Treffer wird implizit wie ein vollständig verhinderter Ausfall behandelt.
- Prüf- und Reparaturkosten wahrer Treffer fehlen.
- Deshalb empfiehlt die Kapazitätsrechnung beinahe die ganze Flotte; das Notebook erkennt diesen Fehler selbst korrekt.

Für einen echten Betrieb braucht es ein Ziel wie „durch Vorsorgeprüfung vermeidbarer sicherheits- oder kostenrelevanter Schaden“ sowie empirische Prüf-, Reparatur-, Ausfall- und Verhinderungswahrscheinlichkeiten.

## 3.3 Sprachliche Qualität

Die Sprache ist über weite Strecken sehr stark: anschaulich, selbstkritisch und gut lesbar. Die Abschnitte zur Baseline, zur Rückkopplung durch vorsorgliche Wartung und zur Trennung von Rangscore und Wahrscheinlichkeit sind besonders gelungen.

Die falschen Kernaussagen in 5.6, 6.1 und im Schlusskapitel senken die Freigabefähigkeit jedoch deutlich. Ein Leser darf nicht gezwungen sein, zwischen korrekter Tabelle und widersprechendem Fließtext selbst zu entscheiden.

## 3.4 Güteeinschätzung Notebook 02

| Dimension | Bewertung |
|---|---:|
| Geschäftsfrage und Entscheidungsnähe | 9/10 |
| technische Reproduzierbarkeit | 10/10 |
| Stichtags- und Leakage-Logik | 8,5/10 |
| Baselines und kapazitätsnahe Evaluation | 9/10 |
| zeitliche Validierung und Zensierung | 7/10 |
| Freigabe- und Deploymentlogik | 7/10 |
| sprachliche Konsistenz | 7/10 |
| **Gesamtstand** | **8/10** |

**Urteil Notebook 02:** Als Lehrprototyp stark und technisch sauber ausgeführt. Als endgültige Abgabe noch nicht freigeben. Zuerst müssen K3 und das Geschäftsversprechen vereinheitlicht, die zentrale Schlussprosa korrigiert und Ausmusterungen im Prognosefenster methodisch behandelt werden. Für reale Werkstattsteuerung ist die Fassung nicht freigabefähig; die aktuelle Schattenliste darf ausschließlich nicht handlungsleitend mitlaufen.

---

# 4. Priorisierte gemeinsame To-do-Liste

## P0 – vor der endgültigen Abgabefreigabe

1. **Notebook 02: K3 eindeutig neu definieren.** Absolute 70-%-Hürde oder saisonrelativer Lift – nicht beides unter demselben Namen.
2. **Notebook 02: alle widersprüchlichen Entscheidungstexte korrigieren.** Insbesondere K1a/K1b/K3, „knapp/deutlich“, 70-%-Beleg, Grundratenfaktor und Schlussmerksätze.
3. **Notebook 02: Ausmusterung als Zensierung behandeln** und alle Gütezahlen danach neu berechnen.
4. **Notebook 01: Primärgate-Ebene verbindlich festlegen.** Aggregiert oder zusätzlich je Radtyp; die Produktaussage muss exakt dazu passen.
5. **Notebook 01: Primärgruppenbildung vollständig auf gerundete Anzeigeminuten umstellen.**

## P1 – vor einem belastbaren Schatten- oder Pilotbetrieb

6. **Notebook 01:** geplantes Ziel protokollieren und gegen tatsächliches Ziel prüfen.
7. **Notebook 01:** robustere statische Modellmaterialisierung testen oder Laufzeitdienst ausdrücklich zulassen.
8. **Notebook 02:** unbekannte Radtypen technisch sperren oder freigegebenes Fallback definieren.
9. **Notebook 02:** engeres, vermeidbares Schadensziel und vollständige Kosten-/Wirksamkeitslogik entwickeln.
10. **Beide Notebooks:** Gates, Datenversionen, Artefakte und Monitoringdefinitionen vor einem prospektiven Lauf einfrieren.

## P2 – redaktionell und didaktisch

11. Entscheidungssätze möglichst aus berechneten Werten erzeugen, damit alte Zahlen nicht stehen bleiben.
12. In Notebook 01 „ausliefern“ bei gesperrtem Diagnoseartefakt vermeiden und den falschen Wetterkommentar entfernen.
13. In Notebook 02 historische Bestätigungsperiode, Schattenperiode und echten Freigabetest terminologisch durchgehend trennen.

# 5. Abschließende Freigabeentscheidung

| Notebook | Endurteil |
|---|---|
| **01 – Regression Fahrtdauer** | **Nahezu freigabefähig als Lehr-/Analysefassung, aber noch mit Auflagen.** Die fachliche Produktsperre ist korrekt. Für eine uneingeschränkte Endfreigabe Primärgate-Ebene, letzte Rundungsinkonsistenz und Aussage zur Quantiltabelle korrigieren. **Keine sichtbare Appfreigabe.** |
| **02 – Klassifikation Wartungsrisiko** | **Noch nicht freigabefähig als Endfassung.** K3 widerspricht Geschäftsfrage und Text, Ausmusterungszensierung fehlt, zentrale Schlussaussagen sind falsch. **Keine reale Werkstattfreigabe; nur nicht handlungsleitender Schattenlauf.** |

