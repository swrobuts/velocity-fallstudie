# VeloCity-Analytics-Datensatz für den CRISP-DM-Block

Datengrundlage für die sechs Notebooks in `notebooks/`. Angelehnt an das echte
VeloCity-Datenmodell (`db/aufbau/`), aber **vollständig außerhalb der produktiven
Datenbank erzeugt** — reine CSV-Dateien aus `generieren.py`, kein Zugriff auf
`bikes.butscher.cloud`.

## Woher die Daten wirklich kommen

| Datei | Herkunft | Anmerkung |
|---|---|---|
| `wetter.csv` | **echt** | Tageswerte Würzburg (49,79° N, 9,95° O), Open-Meteo/ERA5-Archiv, 1.827 Tageswerte vom 24.08.2021 bis 24.08.2026 |
| `feiertage.csv` | **echt** | Bayerische gesetzliche Feiertage, bewegliche über das Osterdatum |
| `schulferien.csv` | **echt, Termine typisiert** | Bayerische Schulferien; die Tagesgrenzen schwanken jährlich, hier stehen die typischen Zeiträume (Spalte `genauigkeit`) |
| `semesterzeiten.csv` | **echt, Termine typisiert** | Vorlesungszeiten der JMU Würzburg, ebenso typisiert |
| `veranstaltungen.csv` | **echt, Termine typisiert** | Neun real wiederkehrende Würzburger Veranstaltungsreihen (Kiliani, Africa Festival, Weindorf, Stramu, Hafensommer, Weinparade, Weihnachtsmarkt, Frühlingsfest, Herbstfest) |
| `nutzungspreis.csv` | **echt** | Startgebühr, Minutenpreis und Tagesdeckel je Radtyp aus dem VeloCity-Preismodell (`db/aufbau/0008_referenzdaten.sql`) — deckt sich mit den Tarifkarten der Website: 30 Minuten kosten 3,10 € (City) bzw. 8,50 € (E-Bike) |
| `tarif.csv` | **echt** | Vier Tarife mit Freiminuten, Rabatt und Voraussetzung — Bezeichnungen wörtlich aus der Datenbank. Ein Monatsentgelt gibt es nicht, in keinem Tarif und auch nicht als Feld |
| `geschaeftsgebiet.csv` | **echt** | Das Polygon aus `db/aufbau/0008_referenzdaten.sql` — die Fläche, in der frei abgestellt werden darf |
| `fahrradtyp.csv` | **echt** | Bezeichnungen und Merkmale der drei Radtypen, dieselben wie in den Tarifkarten der Website |
| `station.csv` | erfunden | 10 Stationen an realen Würzburger Orten, Anzahl/Lage/Kapazität nicht erhoben |
| `fahrrad.csv` | erfunden | 350 Räder, Typen CITY/EBIKE/CARGO wie im echten Schema, mit Ausmusterungen |
| `kunde.csv` | erfunden | 3.200 Kundinnen und Kunden mit Anmeldedatum, Geburtsjahr, Stadtteil, Tarif |
| `ausleihe.csv` | erfunden | 107.297 Fahrten über fünf Jahre, mit Entgelt nach echtem Preismodell. Rund ein Fünftel endet **frei im Geschäftsgebiet** statt an einer Station |
| `schadensmeldung.csv`, `wartungsauftrag.csv` | erfunden | 1.425 Meldungen mit zugehörigen Aufträgen; der Verschleiß wächst mit den Kilometern **seit der letzten erledigten Reparatur** und fällt danach zurück. Zwischen Meldung und Reparatur liegen im Mittel knapp drei Tage — in denen weitergefahren wird |
| `stationsstoerung.csv` | erfunden | 26 Ausfälle an 107 Tagen |

**Die erfundenen Daten sind für die Lehre bewusst verstärkt.** Die Muster, die die
sechs Verfahren finden sollen, sind absichtlich eingebaut. Das gehört in der
Veranstaltung offen gesagt — es ist ein Lehrdatensatz, keine Wirklichkeitsbeschreibung.

## Abgleich mit dem, was die Kundenwebsite verspricht

Der Datensatz wurde Aussage für Aussage gegen `bikes.butscher.cloud` geprüft. Ein
Lehrdatensatz, der der eigenen Fallstudie widerspricht, macht die Gesamtgeschichte
unstimmig.

| Aussage der Website | im Datensatz |
|---|---|
| „Startgebühr plus Minutenpreis, gedeckelt auf einen Tageshöchstpreis" | `nutzungspreis.csv`; 30 Minuten kosten 3,10 € (City) und 8,50 € (E-Bike) — genau wie in den Tarifkarten. Der Deckel gilt **je angefangenem Tag** |
| „0 Euro Anmeldegebühr" | kein Monatspreis, keine Anmeldegebühr — siehe unten |
| „Frei im Geschäftsgebiet: überall in der roten Umrandung, ohne Zuschlag" | 23 % der Fahrten enden ohne Station, mit Koordinaten. **Alle** liegen nachweislich im Polygon |
| „Außerhalb endet keine Fahrt" | geprüft: null Endpunkte außerhalb des Geschäftsgebiets |
| City-Bike / E-Bike Sport / E-Cargo Loader | `fahrradtyp.csv` mit denselben Bezeichnungen und Merkmalen |
| „Unterstützung bis 25 km/h" | die angesetzten Durchschnittsgeschwindigkeiten liegen bei 11 bis 18 km/h |
| 10 Stationen | 10 Stationen |
| „24/7 Verfügbarkeit" | zwischen 23 und 5 Uhr gibt es keine Fahrten — eine Aussage über die **Nachfrage**, nicht über die Verfügbarkeit; im Notebook ausdrücklich so benannt |

**Nicht modelliert und offen benannt:** Der Standort eines Rades zwischen zwei Fahrten
wird nicht verfolgt. Ein Rad kann in diesem Datensatz um 8:00 am Hauptbahnhof und um 8:30
am Käppele starten. Für alle sechs Verfahren ist das ohne Belang; wer Umlaufwege
untersuchen wollte, bräuchte eine andere Erzeugung.

## Keine Grundgebühr — und warum das hier ausdrücklich steht

VeloCity erhebt **keinen monatlichen Beitrag**. Die Startseite führt „0 Euro
Anmeldegebühr" als eine ihrer vier Kennzahlen, und die Preisauskunft nennt ausschließlich
*Startgebühr plus Minutenpreis, gedeckelt auf einen Tageshöchstpreis*.

Die Referenzdaten der Datenbank sahen für den Tarif `PREMIUM` lange **9,90 € im Monat**
vor, mit der Voraussetzung „Kostenpflichtiges Abo". Das widersprach dem Kundenversprechen
— und zwar in derselben Datei, die auch die Kennzahl „0 Euro Anmeldegebühr" setzt.

**Beides ist am 31.08.2026 nachgezogen worden, in der Datenbank wie hier:**

- `PREMIUM` hat kein Monatsentgelt mehr; die Voraussetzung lautet „Rahmenvertrag über den
  Arbeitgeber". Alle drei Vorteilstarife bekommt man damit einheitlich über einen
  **Nachweis**, nicht über Zahlung.
- Die Spalte `monatspreis` ist ganz entfallen. Sie stand überall auf null, aber ihre bloße
  Existenz hatte gereicht: Die 9,90 € kamen hinein, weil das Feld sie aufnehmen konnte.
- Ein **pgTAP-Test** prüft jetzt die Struktur statt der Werte — dass es die Spalte nicht
  gibt. Ein Wert lässt sich wieder setzen, eine fehlende Spalte nicht.
- Die Bezeichnungen in `tarif.csv` stehen wörtlich so in der Datenbank. „OEPNV-Abo" meint
  das Nahverkehrsabo des **Kunden** als Nachweis, nicht ein Abo bei VeloCity; die neue
  Spalte `voraussetzung` macht das sichtbar.

Notebook 3 greift das Thema auf — aber als *Befund*, nicht als erfundene Zahl: Es rechnet
aus, welchen **Listenwert** die Freiminuten haben (38.813 € im letzten Jahr, 54 % des
Listenwerts der gefahrenen Minuten). Ausdrücklich benannt ist dort auch, dass dieser
Listenwert eine **Obergrenze** ist und kein entgangener Umsatz: Ohne Freiminuten griffen
Premiumrabatt und Tageshöchstpreis, und die Kundschaft führe vermutlich weniger. Ein
ausgleichender Monatsbeitrag steht daneben als **Hypothese**, nicht als Datenlage.

## Was NICHT in den Daten steht, obwohl es sie erzeugt hat

Zwei Größen steuern die Erzeugung und stehen in **keiner** CSV:

- der **Stationstyp** (pendler / uni / freizeit / misch)
- das **Kundenprofil** (pendler / studium / freizeit / gelegenheit / vielfahrer)

Genau deshalb kann das Clustering sie wiederfinden. Stünden sie als Spalte da, wäre
die Übung sinnlos.

## Eingebaute Muster — gemessen, nicht behauptet

`generieren.py` misst am Ende jedes Laufs selbst nach und gibt die folgenden Zahlen
aus. Wer den Generator ändert, sieht sofort, ob die Zusage noch hält.

**Nachfrage**

- Temperatur ↔ Tagesfahrten **r = +0,76**, Niederschlag ↔ Tagesfahrten **r = −0,37**
- Werktag ⌀ 57,7 gegen freier Tag ⌀ 50,0 Fahrten
- Veranstaltungstage ⌀ 78,1 gegen sonst ⌀ 51,0 — **Faktor 1,53**
- Schulferien: roh ⌀ 53,7 gegen 58,3 — **bei vergleichbarer Temperatur (15–22 °C) aber
  71,4 gegen 93,7, also Faktor 0,76.** Der rohe Vergleich täuscht, weil Ferien
  überwiegend im Sommer liegen. Eine Scheinkorrelation zum Anfassen — sie soll in der
  Data-Understanding-Phase auffliegen.

**Stationen (für das Clustering)**

- Pendlerstationen (Hauptbahnhof, Zellerau, Grombühl) haben ihre Spitze werktags um
  7–8 Uhr, Wochenendanteil 11–13 %
- **Die Zielwahl hängt an Tageszeit und Stationstyp**, nicht nur am Start: morgens fließt
  es vom Bahnhof zu Campus und Klinik, abends zurück. Daraus entstehen die Regeln für
  Notebook 5 (Hauptbahnhof → Hubland, Konfidenz 36 %, Lift 1,66)
- Uni-Stationen (Sanderring, Hubland) zeigen eine Doppelspitze um 10 und 14 Uhr mit
  Mittagsdelle, nur in der Vorlesungszeit, Wochenendanteil 11 %
- Freizeitstationen (Residenz, Alte Mainbrücke, Ringpark, Käppele) liegen nachmittags,
  Wochenendanteil **47–49 %**
- Der Marktplatz liegt als Mischtyp dazwischen (28 %)
- Nachgeprüft: k-Means mit k = 4 findet diese vier Gruppen **exakt** wieder

**Kundschaft (für Segmentierung und Abwanderung)**

| Profil | Anzahl | ⌀ Fahrten | ⌀ Umsatz |
|---|---:|---:|---:|
| Vielfahrer | 240 | 68,8 | 54,57 € |
| Pendler | 469 | 35,4 | 34,59 € |
| Studium | 690 | 17,3 | 18,41 € |
| Freizeit | 870 | 15,4 | 87,25 € |
| Gelegenheit | 931 | 1,8 | 11,43 € |

Freizeitnutzer fahren seltener als Pendler, geben aber **mehr** aus: lange Touren,
seltener ein Tarif mit Freiminuten. Genau solche Umkehrungen machen eine
RFM-Segmentierung interessant.

- Ohne Fahrt in den letzten 90 Tagen: **40,7 %** — das Label für die
  Abwanderungsklassifikation, aus den Fahrten abgeleitet, nicht vorgegeben

**Instandhaltung (für die Klassifikation)**

- Kilometer je Rad ↔ Anzahl Meldungen **r = +0,914** (für echte Flottendaten
  auffällig stark — der Generator leitet Schäden im Wesentlichen aus der Fahrleistung ab)
- Entscheidend ist aber nicht die Lebenszeit-Nutzung, sondern die **Nutzung seit der
  letzten erledigten Reparatur**: In einem 90-Tage-Fenster im Mai melden sich rund 53 %
  der Räder, und die Faustregel „meiste Kilometer seit der letzten Reparatur“ trifft
  davon **86,7 %** — einen Treffer mehr als ein Random Forest auf denselben Daten
  (52 gegen 51 von 60). Über fünf Validierungsquartale liegt die Regel deutlich vorn
  (180 gegen 159 Treffer)

**Datenqualität (für die Data-Preparation-Phase)**

- **40,1 % der Fahrten haben keine gemessene Distanz** — kein Fehler, sondern ein
  Sensorthema, das zu behandeln ist
- 2,7 % der Fahrten sind abgebrochen oder storniert
- 52 Ausleihen dauern über acht Stunden — der Anker für die Anomalieerkennung
- **1.088 Stationstage ohne jede Fahrt, aber nur 107 davon sind dokumentierte
  Störungen.** Notebook 6 zeigt daran, warum sich Stationsausfälle mit diesen Daten
  *nicht* erkennen lassen — ein bewusst stehengelassenes negatives Ergebnis
- Die Startgebühr fällt auch dann an, wenn Freiminuten die ganze Fahrt decken; ein
  Entgelt über null bei null berechneten Minuten ist die Regel, nicht der Fehler

## Generator

`generieren.py`, fester Seed (`20260901`) — jeder Lauf erzeugt identische Daten.

```bash
cd analytics && python3 generieren.py
```

Schreibt neben das Skript; `VELO_OUT=/pfad python3 generieren.py` schreibt woandershin.
`wetter.csv` muss im Zielordner liegen — es sind echte Messdaten und wird nur gelesen.
