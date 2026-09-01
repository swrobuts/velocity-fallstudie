# Erneuter Recheck: `01_Regression_Fahrtdauer.ipynb`

**Prüfdatum:** 1. September 2026  
**Geprüfte Datei:** `/Users/robert/Downloads/01_Regression_Fahrtdauer.ipynb`  
**SHA-256:** `0c8dc3be627d8ae8d283e48d9d53b8454bc9e9f64c5194f7eb098f15a2df42c2`  
**Ausführung:** 25 von 25 Codezellen vollständig ausgeführt, keine Zellfehler  
**Festgeschriebener Datenstand:** Git-Commit `316b3db6532966693909430503b3ba597077754f`

## Kurzurteil

**Das Notebook ist inzwischen analytisch stark und nahezu abgabereif. Für eine reale Produktfreigabe reicht es weiterhin nicht.**

Die wesentlichen technischen und methodischen Fehler der früheren Fassungen sind behoben:

- Rundfahrten werden vor Training, Validierung und Test ausgeschlossen.
- Preisbewertung und Geltungsbereich stimmen jetzt überein.
- Die App-Logik wird auf allen 9.517 Test-2-Fahrten gegen die Offlinebewertung geprüft: **null Abweichungen**.
- Kundenspezifisch zu breite Spannen werden in Bewertung und App identisch verworfen.
- Ungeprüfte und widerlegte Kombinationen werden nicht exportiert.
- Status und Zahl der Prüffahrten werden mit der App-Antwort zurückgegeben.
- Reichweite wird korrekt innerhalb des Geltungsbereichs berechnet.
- Das Ende der tatsächlichen Lernbasis wird nun korrekt exportiert.
- Die Unsicherheit kleiner Perzentilgruppen wird erstmals quantitativ untersucht.

Der wichtigste verbleibende Widerspruch ist kein Programmierfehler, sondern eine Freigabeentscheidung: Das Notebook erklärt die **vorab preisabhängige Kundengruppe** zum entscheidenden Gütegate. Deren Wilson-Untergrenze beträgt jedoch nur **79,3 %** und liegt damit unter der verlangten 80-%-Schwelle. Trotzdem wird das Intervallprodukt als freigegeben dargestellt.

## Freigabeurteil

| Ebene | Urteil |
|---|---|
| technische Ausführung | **bestanden** |
| analytische Fallstudie | **nach wenigen klaren Korrekturen abgabefähig** |
| reale App-Freigabe | **noch nicht freigeben** |

**Analytische Güte: etwa 8,5/10.**  
**Sprachliche Konsistenz: etwa 8/10.**  
**Betriebliche Freigabe: nein – Schattenbetrieb und bestandenes Primärgate fehlen.**

## Erfolgreich behobene Punkte

### 1. Geltungsbereich und Modellbewertung stimmen jetzt überein

Nach der deskriptiven Gegenüberstellung werden 11.029 Rundfahrten separat abgelegt und aus dem produktbezogenen Datensatz entfernt. Alle folgenden Splits, Modelle und Testkennzahlen verwenden nur noch 76.131 echte Wege.

Die neue Test-1-Auswertung lautet:

| Radtyp | Testfälle | mittlerer Preisfehler | Anteil unter 0,50 € | Urteil |
|---|---:|---:|---:|---|
| CARGO | 1.181 | 1,03 € | 63 % | gerissen |
| CITY | 5.321 | 0,16 € | 89 % | erfüllt |
| EBIKE | 3.014 | 0,25 € | 80 % | erfüllt |

Damit wird nun das Produkt bewertet, das tatsächlich angeboten werden soll. CARGO verfehlt das Punktkriterium weiterhin, aber nicht mehr aufgrund ausgeschlossener Rundfahrten.

### 2. Zeitliche Trennung bleibt sauber

Nach der Geltungsbereichsfilterung entstehen:

| Teil | Fälle | Zeitraum | Rolle |
|---|---:|---|---|
| Training | 45.678 | 24.08.2021–17.12.2024 | Modelllernen |
| Validierung | 11.420 | 17.12.2024–06.08.2025 | Modellwahl |
| Test 1 | 9.516 | 06.08.2025–24.04.2026 | Punktschätzung |
| Test 2 | 9.517 | 24.04.2026–24.08.2026 | Kalibrierung des Intervallprodukts |

Test 2 wird zutreffend nicht als unabhängiger finaler Test bezeichnet. Der notwendige Schattenbetrieb bleibt ausdrücklich offen.

### 3. Baselines und Zielablation sind überzeugend

| Ansatz | Validierungs-MAE |
|---|---:|
| globaler Median | 8,82 min |
| Median je Radtyp | 8,66 min |
| Median je Startstation | 7,69 min |
| Median je Verbindung | 4,07 min |
| Random Forest | **3,38 min** |

Der Random Forest verbessert die starke Routenbaseline um 17 %. Ohne Zielmerkmale liegt sein MAE bei 8,06 Minuten, mit Zielmerkmalen bei 3,38 Minuten. Die Zielangabe reduziert den Fehler damit um 58 %.

### 4. Tarif- und Preislogik sind korrekt

Aufrundung, Startgebühr, Restfreiminuten, Minutenpreis, Tagesdeckel und Rabatt werden weiterhin vollständig angewendet. Die nachgerechneten Preise stimmen in 100,00 % der Test-1-Fälle exakt mit `entgelt_eur` überein.

### 5. Offlinebewertung und App-Funktion sind nachweislich deckungsgleich

Das Notebook führt nun jede der 9.517 Test-2-Fahrten durch beide Wege:

| Abweichung | Fälle |
|---|---:|
| App zeigt, Offlinebewertung zählt nicht | 0 |
| Offlinebewertung zählt, App zeigt nicht | 0 |

Die Prüfung ist durch eine Assertion abgesichert. Das ist deutlich belastbarer als die frühere bloße Behauptung, beide Logiken seien gleich.

### 6. Finale Reichweite und Artefaktstatus sind konsistent

Die finale Tabelle zeigt für 5.153 von 9.517 Anfragen eine Spanne:

```text
Reichweite = 54,1 % des definierten Geltungsbereichs
```

Das Artefakt enthält 348 Zeilen:

| Status | Zeilen |
|---|---:|
| `gestuetzt` | 47 |
| `unbestimmt` | 46 |
| `unzureichend` | 255 |
| `widerlegt` oder `ungeprueft` | 0 |

Die Entscheidung, auch unbestimmte und unzureichend geprüfte Zeilen auszuliefern, wird nun ausdrücklich als **aggregierte Zusage je Radtyp** beschrieben. Die App gibt Status und Belegzahl für Monitoring und Support zurück.

### 7. Versionsmetadaten wurden korrigiert

`trainingsende` wurde durch `lernbasis_bis` ersetzt. Das Feld weist jetzt korrekt den 24.04.2026 als Ende der für die Perzentiltabelle verwendeten Basis aus. Der Datenpfad bleibt auf einen unveränderlichen Commit festgeschrieben.

### 8. Unsicherheit der empirischen Perzentile wird sichtbar

Die neue Bootstrap-Auswertung zeigt, dass das 90-%-Perzentil bei kleinen Gruppen merklich schwankt:

| historische Fallzahl | medianer 95-%-Bereich | Breite |
|---|---:|---:|
| 30–49 | 16–21 min | 5 min |
| 50–99 | 14–18 min | 4 min |
| ab 100 | 16–19 min | 3 min |

Damit wird die Mindestfallzahl 30 nicht mehr als statistisch abgesicherte Wahrheit verkauft, sondern als Reichweitenkompromiss.

## Verbleibende Freigabeblocker

### P0.1 – Das als entscheidend bezeichnete Primärgate wird nicht bestanden

Das Notebook bildet die preisabhängige Gruppe nun korrekt **vor der Fahrt** anhand von Restfreiminuten und angezeigter Dauerspanne:

| vorab erkennbare Guthabenlage | Fälle | Abdeckung | Wilson-Untergrenze |
|---|---:|---:|---:|
| Rest deckt obere Intervallgrenze | 3.287 | 99,8 % | 99,6 % |
| Grenzfall | 43 | 90,7 % | 78,4 % |
| Rest deckt untere Grenze nicht | 1.823 | 81,2 % | **79,3 %** |

Der Text sagt ausdrücklich:

> Diese Gruppe ist die vorab festgelegte Evaluationsgruppe; an ihr entscheidet sich, ob das Produkt trägt.

Nach dieser Definition ist das Ergebnis eindeutig: **Das Gate ist nicht bestanden**, weil 79,3 % unter 80 % liegen.

Die spätere Freigabelogik berücksichtigt dieses Gate jedoch nicht. Sie prüft nur Gesamt- und Radtypabdeckung; deshalb werden CARGO, CITY und EBIKE trotzdem als freigegeben ausgegeben.

**Erforderliche Entscheidung:**

- Wenn die preisabhängige Gruppe tatsächlich das Primärgate ist, muss das Notebook das Intervallprodukt als **noch nicht freigegeben** kennzeichnen und das Gate im Code erzwingen.
- Wenn Gesamt- und Radtypabdeckung das formale Gate bleiben sollen, darf die preisabhängige Gruppe nicht als entscheidende vorab festgelegte Freigabebedingung bezeichnet werden. Dann ist sie eine wichtige Subgruppenanalyse, die im Schattenbetrieb erneut geprüft wird.

Für eine fachlich starke Lösung ist die erste Variante vorzuziehen: Gerade bei vollständig gedeckten Freiminuten ist die hohe Gesamtdeckung weitgehend trivial und misst kaum die Dauerprognose.

### P0.2 – Der unabhängige Schattenbetrieb fehlt

Test 2 wird zur Kandidatenbewertung, Radtypfreigabe und Statusbildung verwendet. Die 93,1 % Gesamtdeckung sind daher keine unabhängige Endtestgüte des fertig ausgewählten Produkts.

Außerdem bleibt die zentrale Proxy-Annahme ungetestet: Historisch ist nur das tatsächliche Ziel gespeichert; im Betrieb soll das geplante Ziel verwendet werden.

Vor einer sichtbaren Freigabe sind weiterhin erforderlich:

1. Tabelle, Tarif, Code und Gates einfrieren.
2. Geplantes Ziel vor dem Entsperren speichern.
3. Schätzung im Hintergrund berechnen, aber zunächst nicht anzeigen.
4. Zieltreue, Abdeckung, Breite, Reichweite und Ablehnungsgründe auf neuen Daten messen.
5. Das vorab definierte Gate ohne Nachjustierung bewerten.
6. Erst danach das Produkt sichtbar schalten.

### P0.3 – Eine zentrale Schlussaussage ist noch veraltet

Im Kandidatenvergleich steht weiterhin:

> Die Tabelle antwortet seltener als das Modell und am Ende nur für CITY.

Das ist falsch. Das finale Artefakt enthält `CARGO`, `CITY` und `EBIKE`. Der Schlussabschnitt selbst ist bereits korrekt aktualisiert.

**Korrektur:** „… und antwortet für alle drei Radtypen, aber mit geringerer Reichweite als die Quantilregression.“

## Weitere methodische und sprachliche Restpunkte

### P1.1 – Die Mindestfallzahl-Sensitivität zählt vor dem Kundenfilter

Die Tabelle „Was eine strengere Mindestfallzahl kostet“ bezeichnet ihre Werte als bediente Test-2-Fahrten. Sie zählt aber vor der kundenindividuellen 60-%-Breitenprüfung.

Die unabhängige Gegenrechnung zeigt:

| Mindestfallzahl | Notebooktabelle vor Kundenfilter | tatsächlich nach Kundenfilter | tatsächliche Reichweite |
|---|---:|---:|---:|
| 30 | 5.403 | **5.153** | 54,1 % |
| 50 | 4.558 | **4.333** | 45,5 % |
| 100 | 3.057 | **2.892** | 30,4 % |

Die Richtung der Aussage bleibt richtig, die Tabelle überschätzt die tatsächlich bedienten Fälle aber um 165 bis 250 Fahrten.

**Korrektur:** Für jede Mindestfallzahl die vollständige Laufzeitlogik einschließlich Kundentarif und Restfreiminuten anwenden.

### P1.2 – Die sprachliche Interpretation des Bootstrap-Ergebnisses ist falsch

Der Text sagt:

> Bei 30 bis 49 Fahrten schwankt die obere Grenze um 5 Minuten. Das ist mehr, als unsere Nützlichkeitsregel der ganzen Spanne zugesteht.

Die Tabelle zeigt jedoch einen **gesamten 95-%-Bereich von 16 bis 21 Minuten**, also eine Breite von fünf Minuten. Die obere Grenze verschiebt sich gegenüber dem Punktschätzer 18 Minuten nicht um fünf, sondern ungefähr um drei Minuten. Außerdem erlaubt die Nützlichkeitsregel eine gesamte Dauerspanne von bis zu **zwölf Minuten**; fünf Minuten sind nicht mehr als zwölf.

**Korrekturvorschlag:**

> Bei Gruppen mit 30 bis 49 Fahrten umfasst der mediane 95-%-Bootstrap-Bereich des oberen Randes fünf Minuten. Das ist im Verhältnis zur maximal zulässigen zwölfminütigen Gesamtspanne erheblich und zeigt, dass der Rand selbst noch merklich unsicher ist.

### P1.3 – Die streng belegte Alternative sollte beziffert werden

Der Text sagt zutreffend, eine Auslieferung nur der 47 `gestuetzt`-Zeilen würde die Reichweite stark senken. Die unabhängige Zuordnung zeigt:

```text
Reichweite nur mit gestützten Zeilen: 18,3 %
```

Diese Zahl sollte statt „auf einen Bruchteil“ genannt werden. Dadurch wird die Produktentscheidung zwischen aggregierter Absicherung und verbindungsbezogener Absicherung nachvollziehbar.

### P1.4 – Die „vorab gedeckte“ Gruppe ist nicht vollkommen dauerunabhängig

Der Text suggeriert, in dieser Gruppe treffe jedes Modell zwingend. Tatsächlich beträgt die Abdeckung 99,8 % statt 100 %. Die Einteilung garantiert nur, dass die **angezeigte obere Intervallgrenze** vom Guthaben gedeckt ist. Eine tatsächliche Fahrt kann diese Grenze überschreiten und dann doch minutenabhängige Kosten verursachen.

Die Erklärung sollte daher lauten: Innerhalb der prognostizierten Spanne ist der Preis konstant; bei Fahrten außerhalb der oberen Grenze kann er dennoch steigen.

### P1.5 – Daten- und Artefaktversionierung ist noch nicht vollständig

Die feste Git-URL macht den Standardlauf reproduzierbar. `DATENVERSION` hasht aber weiterhin nur:

- Zahl der Ausleihen;
- späteste Startzeit;
- Summe der Entgelte.

Andere Änderungen an Ausleihen, Stationen, Fahrrädern, Kunden, Routenmatrix, Feiertagen oder Ferien können dieselbe Kennung ergeben. Bei Nutzung von `VELO_BASIS` wäre dies relevant.

**Korrektur:** vollständige SHA-256-Werte aller Eingabedateien sowie Git-/Notebook-/Artefaktversion exportieren.

### P1.6 – App-Eingaben sind nur teilweise validiert

Rundfahrten, unbekannte Kombinationen und kundenspezifisch zu breite Spannen werden sauber behandelt. Noch fehlen explizite Prüfungen für:

- Stunden außerhalb 0–23;
- negative Restfreiminuten;
- Rabatte außerhalb des zulässigen Bereichs;
- falsche Datentypen;
- doppelte Nachschlageschlüssel als Assertion.

### P2 – Weitere Verbesserungsmöglichkeiten

- Für Produktintervalle eine zeitlich kalibrierte Conformal-Prediction-Lösung prüfen.
- Quantilmodellwerte vorab tabellieren, statt das nachweislich schwächere Tabellenverfahren nur wegen des statischen Frontends zu wählen.
- Wochentag und Saison gehen im finalen Tabellenprodukt weiterhin verloren.
- Archivierte Wetterprognosen könnten ein zulässiges Zusatzmerkmal sein.
- Die Acht-Stunden-Grenze bleibt eine fachlich noch zu bestätigende Setzung.

## Vollständiger Abgleich mit den früheren Prüfpunkten

| Prüffrage | aktueller Stand |
|---|---|
| neue Geschäftsfrage mit Zielauswahl | **erfüllt** |
| Zielstation ohne naive Leakage-Behauptung | **erfüllt; Proxy-Risiko transparent** |
| zeitlicher Holdout | **erfüllt für das Punktmodell** |
| Schattenbetrieb | **korrekt beschrieben, noch nicht durchgeführt** |
| Training/Validation/Test sauber getrennt | **erfüllt** |
| Geltungsbereich ohne Rundfahrten | **erfüllt** |
| Preisfehler einschließlich Freiminuten, Rabatt und Deckel | **erfüllt und verifiziert** |
| Routenbaseline | **erfüllt** |
| Preprocessing und unbekannte Kategorien | **erfüllt** |
| lineare Regression und Dummy-Kodierung | **sauber erläutert** |
| zyklische Zeitmerkmale | **im Modell erfüllt** |
| kundenbezogene Breitenregel | **Offline und App deckungsgleich** |
| Deployment-Statusfilter | **technisch erfüllt** |
| aggregierte versus verbindungsbezogene Zusage | **transparent entschieden** |
| Reichweitenberechnung | **erfüllt** |
| Versionsmetadaten | **verbessert, aber noch unvollständig** |
| sprachliche Konsistenz | **weitgehend erfüllt; drei konkrete Restfehler** |
| operative Freigabe | **nicht erfüllt** |

## Priorisierte To-do-Liste

### P0 – vor fachlicher Endabnahme

- [ ] Entscheiden, ob die vorab preisabhängige Gruppe ein verbindliches Primärgate ist; Text, Code und Urteil danach ausrichten.
- [ ] Die falsche Aussage „am Ende nur für CITY“ korrigieren.
- [ ] Bootstrap-Interpretation von „fünf Minuten“ und „mehr als zwölf Minuten“ fachlich richtig formulieren.
- [ ] Mindestfallzahl-Sensitivität mit der vollständigen kundenbezogenen Laufzeitlogik berechnen.

### P1 – vor sichtbarer Produktfreigabe

- [ ] Schattenbetrieb mit geplantem Ziel und eingefrorenem Artefakt durchführen.
- [ ] Primärgate auf dem unabhängigen Zeitraum bestehen.
- [ ] vollständige Datei-, Code- und Artefakthashes exportieren.
- [ ] App-Eingaben validieren und Schlüssel-Eindeutigkeit absichern.
- [ ] 18,3-%-Reichweite der streng gestützten Alternative offen ausweisen.

### P2 – Robustheit

- [ ] empirische Perzentile gegen conformale Intervalle vergleichen.
- [ ] vorab tabellierte Quantilmodellwerte prüfen.
- [ ] Wochentag, Saison und zulässiges Prognosewetter berücksichtigen.
- [ ] Acht-Stunden-Grenze fachlich absichern.

## Schlussfolgerung

Die neue Fassung hat einen großen Qualitätssprung gemacht. Der gesamte produktbezogene Rechenweg – vom Geltungsbereich über Training und Preislogik bis zur App-Ausgabe – ist jetzt technisch konsistent und durch konkrete Assertions abgesichert. Auch die sprachliche Qualität ist deutlich besser; fast alle früheren Widersprüche wurden entfernt.

**Als analytische Fallstudie ist das Notebook nach vier klar umrissenen P0-Korrekturen abgabefähig.**

**Für eine reale App-Freigabe lautet das Urteil weiterhin nein.** Das Notebook definiert selbst ein sinnvolles preisabhängiges Primärgate, verfehlt es derzeit knapp und besitzt noch keinen unabhängigen Schattenbetrieb. Genau diese beiden Punkte sollten nicht durch die sehr gute Gesamtquote von 93,1 % überdeckt werden.
