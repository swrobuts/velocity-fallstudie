# Notebook 2 sanieren — Plan

**Anlass:** Review vom 1. September 2026 (`Review_02_Klassifikation_Wartungsrisiko.md`).
**Stand der Prüfung:** Jede geprüfte Behauptung des Reviews wurde an den Daten
nachgerechnet und bestätigt. Nichts davon wurde ungeprüft übernommen.

## 1. Was nachgerechnet wurde

| Vorwurf | Nachgerechnet | Urteil |
|---|---|---|
| P0.1 Export nutzt die Regel, obwohl das Modell zum Sieger erklärt wird | Zelle 28, 32 und 35 sortieren nach `p_regel`; Überschneidung der beiden Top-60-Listen 43 von 60, 13 gegen 8 Positive in den je 17 abweichenden Rädern | **bestätigt** |
| P0.4 „günstigste Kapazität 120" ist ein Artefakt | Kostenminimum über alle Listenlängen liegt bei k = 228 von 228 (3.125 €); k = 120 kostet 6.985 € | **bestätigt** |
| P1.1 Modellsieg zeitlich instabil | Eigene rollierende Rücktests: Wald 177, Regel 175 Treffer über sechs Quartale. Vorteil 410 € gesamt = **68 € je Quartal**. Besser in 2, gleichauf in 3, schlechter in 1 Quartal | **bestätigt, schärfer** |
| P1.2 70-%-Hürde nicht belegt | Wilson-Intervall für 43/60: **59,2 % bis 81,5 %** — die Hürde liegt darin | **bestätigt** |
| P1.3 „seit letzter Reparatur" wird nicht berechnet | 639 von 640 Meldungen haben einen Auftrag; Mittel 2,81 Tage bis erledigt, max 6,71. Bei 508 Meldungen wurde dazwischen gefahren, 1.031 Fahrten | **bestätigt** |
| P1.4 Ausreißer und ungenutzte Messwerte | 59,9 % der Fahrten haben eine gemessene Distanz und werden trotzdem geschätzt. 45 Fahrten über 8 Stunden, längste 1.777 Minuten | **bestätigt** |
| P0.5 Ziel zu weit gefasst | 103 positive Räder im Testfenster, davon nur **34** mit einer Meldung „fahruntauglich". 4 Räder mit am Stichtag bereits offenem Schaden stehen in der Prognosepopulation | **bestätigt** |
| P1.7 Precision wird als Erkennungsleistung gelesen | Precision@60 = 71,7 %, **Recall@60 = 41,7 %** — 60 von 103 Ausfällen bleiben unerkannt | **bestätigt** |
| P2.4 Widersprüche in Text und README | `notebooks/README.md` sagt „Regel gewinnt", das Notebook „Modell gewinnt". `analytics/README.md` nennt 735 Meldungen (echt: 640) und 73 %/68 % (echt: 63,3 %/71,7 %). Überschrift 5.2 „Das Modell hat nichts hinzugefügt" widerspricht dem Text darunter. „9 % im November und 44 % im Mai" statt 7,6 % und 45,2 %. „je 51,7 % exakt gleich gut" statt 45,0 % und 50,0 % | **bestätigt** |

## 2. Was daraus folgt — das Urteil des Notebooks kippt zurück

Die entscheidende Zahl ist nicht die aus dem letzten Quartal, sondern die über sechs:

> Der Random Forest gewinnt **2 zusätzliche Treffer über sechs Quartale**, also rund
> 68 € je Quartal vor jedem Betriebsaufwand. Er verliert ein Quartal deutlich und
> erreicht die 70-%-Hürde in zwei von sechs Quartalen. Das 95-%-Intervall seines besten
> Quartals enthält die Hürde.

Damit ist die Freigabe des Modells nicht haltbar. **Ausgeliefert wird die Faustregel** —
diesmal aber aus einem gemessenen Grund, nicht aus einem Gleichstand.

**Das ist mein Fehler, und er ist ein lehrreicher:** Ich habe das Urteil des Notebooks
auf einem einzigen günstigen Testquartal gedreht — genau der Fehler, vor dem dieses
Notebook warnen soll. Die Korrektur gehört deshalb nicht versteckt, sondern in den
Lehrstoff.

## 3. Was gemacht wird — und was ausdrücklich nicht

Das Review misst gegen eine **Produktivfreigabe**. Dieses Notebook ist eine Lehrdemo auf
**erfundenen Daten**. Beides gleichzeitig zu behaupten war der Fehler. Der Plan trennt
deshalb sauber:

- **Repariert wird alles, was falsch ist** — Widersprüche, unbelegte Zahlen, kaputte
  Merkmalslogik.
- **Nicht gebaut wird eine Produktions-Infrastruktur** — Kalibrierungspipeline,
  Kontrollgruppendesign, Schattenbetrieb, Modellkarte. Diese Punkte werden **benannt**,
  wie in Notebook 1 die offenen Punkte am Ende. Ein Lehrnotebook, das so tut, als hätte
  es einen Pilotbetrieb, wäre wieder dieselbe Sorte Behauptung.

### Stufe A — Falsches beseitigen (blockierend)

| # | Was | Wo |
|---|---|---|
| A1 | **Eine Quelle für das ausgelieferte Verfahren.** `ausgeliefertes_verfahren` und `ausgelieferter_score` einmal setzen; Confusion-Matrix, Precision@k-Kurve, Kapazitätskurve, Liste, CSV und Paket ausschließlich daraus | Zellen 28, 32, 35, Paket |
| A2 | **Selbstprüfung im Notebook:** `assert` vergleicht die IDs der exportierten Liste mit den Top-k des in den Metadaten genannten Verfahrens. Bricht ab, wenn beides auseinanderläuft | neue Zelle vor dem Export |
| A3 | **Datenherkunft ganz oben:** sichtbarer Kasten „erfundene Lehrdaten, Muster absichtlich verstärkt, keine Wirklichkeitsbeschreibung" | Kopf |
| A4 | **Euro-Aussagen als Szenariorechnung kennzeichnen**, „geht in Betrieb" durch „Freigabe für den Lehrbetrieb" ersetzen | Phase 5 und 6 |
| A5 | **Kapazitätsaussage korrigieren:** Die Kurve über *alle* Listenlängen rechnen und zeigen, dass das Minimum bei der gesamten Flotte liegt. Daraus die richtige Lehre: Diese Kostenformel trägt keine Kapazitätsentscheidung, weil sie die Prüfkosten der Treffer nicht enthält | Zelle 32 |
| A6 | **Alle Zahlwidersprüche** in Text und beiden READMEs beheben (735→640, 73/68→63,3/71,7, 9/44→7,6/45,2, 51,7→45,0/50,0, Überschrift 5.2, „achtzehn Punkte", „montags") | nb02, `analytics/README.md`, `analytics/notebooks/README.md` |

### Stufe B — Das Urteil auf eine tragfähige Grundlage stellen

| # | Was |
|---|---|
| B1 | **Rollierende Rücktests als Hauptnachweis**: je Quartal Grundrate, Treffer, Precision@60, Recall@60, Kosten und Abstand zur Regel. Diese Tabelle ersetzt das Einzelquartal als Entscheidungsgrundlage |
| B2 | **Eigener Validierungsstichtag**: Modellwahl und Einstellungen auf 2026-02-25, letzter Stichtag genau einmal als Test |
| B3 | **Wilson-Intervall** neben jeder Trefferquote; Freigabekriterium an die untere Grenze knüpfen, nicht an den Punktschätzer |
| B4 | **Saisonal ehrliches Kriterium**: Eine feste 70-%-Hürde ist bei 7,6 % Grundrate unerfüllbar. Stattdessen Lift gegenüber der Grundrate oder Abstand zur Faustregel |
| B5 | **Precision und Recall gemeinsam** ausweisen — „43 von 60 Ausgewählten treffen zu" gegen „43 von 103 Auffälligen werden erreicht" |

### Stufe C — Merkmale und Vorverarbeitung reparieren

| # | Was |
|---|---|
| C1 | **`km_seit_reparatur`** statt `km_seit_meldung`: Reset auf `wartungsauftrag.erledigt_am`. Die 1.031 Fahrten zwischen Meldung und Reparatur zählen zum alten Bauteilzustand |
| C2 | **Gemessene Distanz verwenden**, nur die fehlenden 40 % schätzen |
| C3 | **Ausreißer behandeln**: Fahrten über 8 Stunden sind vergessene Rückgaben, kein Verschleiß — mit Zeilenzahl davor und danach |
| C4 | **`Pipeline` + `ColumnTransformer` + `OneHotEncoder(handle_unknown="ignore")`**, nur auf Trainingsdaten gefittet — wie in Notebook 1 |
| C5 | **Räder mit offenem Schaden** aus der Prognosepopulation nehmen (4 am Teststichtag); sie gehören in eine Pflichtwartungsliste |
| C6 | **Spalte „Risiko" in „Modellscore" umbenennen** — unkalibrierte Waldwerte sind keine Wahrscheinlichkeiten (mittlere Prognose 55,2 % gegen Grundrate 45,2 %) |

### Stufe D — Offene Punkte benennen statt lösen

Am Ende des Notebooks, nach dem Muster von Notebook 1:

1. **Das Ziel ist zu weit.** „Irgendeine Meldung" ist nicht „vermeidbarer Ausfall" — nur
   34 der 103 Fälle sind fahruntauglich. Eine Kostenmatrix je Schweregrad wäre die
   nächste Runde.
2. **Die Wirksamkeit der Prüfung ist unbekannt.** Wir wissen nicht, welcher Anteil der
   Schäden durch eine Inspektion überhaupt gefunden würde.
3. **Die Rückkopplung ist nicht gelöst.** Ein Merkmal „wurde geprüft" stellt den
   Gegenfakt nicht her; dafür bräuchte es eine Kontrollgruppe.
4. **Kein Schattenbetrieb.** Der Teststichtag liegt in der Vergangenheit, sein Ausgang
   ist bekannt.
5. **Acht Stichtage sind wenig** für eine saisonale Aussage.
6. **Erfundene Daten.** Alle Euro-Beträge sind Szenariorechnungen.

### Stufe E — Folgeänderungen

| Wo | Was |
|---|---|
| `slides/build_crispdm_deck.py` | Fall 2 kippt zurück: ausgeliefert wird die Regel, begründet mit den rollierenden Rücktests statt mit einem Gleichstand. Karte, Synthese und Modulkopf mit |
| `tools/notebook_ausschnitte.py` | nb2-Anker prüfen und neu erzeugen |
| `analytics/README.md`, `analytics/notebooks/README.md` | Zahlen und Urteil angleichen |

## 4. Was sich an meiner Arbeitsweise ändert

Die Ursache ist in allen bisherigen Schleifen dieselbe: **Ich ändere eine Stelle und
prüfe nicht, was dadurch falsch wird.** Drei Belege aus diesem Projekt:

- Notebook 2: Urteil gedreht, Export/Confusion/Kapazität blieben auf der Regel.
- Notebook 2: Text geändert, die Überschrift „Das Modell hat nichts hinzugefügt" blieb.
- Lehrdatensatz erneuert, der Fließtext in Notebook 5 und 6 und beide READMEs blieben.

„Sorgfältiger sein" hat das nicht verhindert und wird es nicht. Was hilft, sind
Prüfungen, die das Notebook selbst durchfallen lassen:

| Prüfung | Fängt |
|---|---|
| **`assert` im Notebook**: exportierte Liste = Top-k des deklarierten Verfahrens | genau P0.1, dauerhaft |
| **`tools/notebooktexte_pruefen.py`** (neu): jede Zahl im Fließtext eines Notebooks muss in einer Ausgabe desselben Notebooks stehen | die stehengebliebenen Zahlen in nb02, nb05, nb06 |
| **README gegen Notebook** prüfen: dieselbe Prüfung über die beiden `README.md` | 735 statt 640, 73 % statt 63,3 % |
| **`tools/folienzahlen_pruefen.py`** (vorhanden) | Folienzahlen gegen Notebooks |

Alle vier laufen künftig in `tools/abnahme.sh` mit. Eine Änderung gilt erst als fertig,
wenn die Abnahme grün ist — nicht, wenn die geänderte Stelle stimmt.
