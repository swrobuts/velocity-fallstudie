# VeloCity-Analytics-Datensatz für den CRISP-DM-Block

Datengrundlage für die sechs Notebooks in `notebooks/`. Angelehnt an das echte
VeloCity-Datenmodell (`db/aufbau/`), aber **vollständig außerhalb der produktiven
Datenbank erzeugt** — reine CSV-Dateien aus `generieren.py`, kein Zugriff auf
`bikes.butscher.cloud`.

## Woher die Daten wirklich kommen

| Datei | Herkunft | Anmerkung |
|---|---|---|
| `wetter.csv` | **echt** | Tageswerte Würzburg (49,79° N, 9,95° O), Open-Meteo/ERA5-Archiv, 01.09.2023 – 24.08.2026 |
| `feiertage.csv` | **echt** | Bayerische gesetzliche Feiertage, bewegliche über das Osterdatum |
| `schulferien.csv` | **echt, Termine typisiert** | Bayerische Schulferien; die Tagesgrenzen schwanken jährlich, hier stehen die typischen Zeiträume (Spalte `genauigkeit`) |
| `semesterzeiten.csv` | **echt, Termine typisiert** | Vorlesungszeiten der JMU Würzburg, ebenso typisiert |
| `veranstaltungen.csv` | **echt, Termine typisiert** | Neun real wiederkehrende Würzburger Veranstaltungsreihen (Kiliani, Africa Festival, Weindorf, Stramu, Hafensommer, Weinparade, Weihnachtsmarkt, Frühlingsfest, Herbstfest) |
| `tarif.csv`, `nutzungspreis.csv` | **echt** | Struktur *und* Werte aus dem VeloCity-Preismodell übernommen (`db/aufbau/0008_referenzdaten.sql`) |
| `station.csv` | erfunden | 10 Stationen an realen Würzburger Orten, Anzahl/Lage/Kapazität nicht erhoben |
| `fahrrad.csv` | erfunden | 240 Räder, Typen CITY/EBIKE/CARGO wie im echten Schema, mit Ausmusterungen |
| `kunde.csv` | erfunden | 3.200 Kundinnen und Kunden mit Anmeldedatum, Geburtsjahr, Stadtteil, Tarif |
| `ausleihe.csv` | erfunden | knapp 60.000 Fahrten über drei Jahre, mit Entgelt nach echtem Preismodell |
| `schadensmeldung.csv`, `wartungsauftrag.csv` | erfunden | an die kumulierte Nutzung gekoppelt |
| `stationsstoerung.csv` | erfunden | 26 Ausfälle an 107 Tagen |

**Die erfundenen Daten sind für die Lehre bewusst verstärkt.** Die Muster, die die
sechs Verfahren finden sollen, sind absichtlich eingebaut. Das gehört in der
Veranstaltung offen gesagt — es ist ein Lehrdatensatz, keine Wirklichkeitsbeschreibung.

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

- Temperatur ↔ Tagesfahrten **r = +0,75**, Niederschlag ↔ Tagesfahrten **r = −0,37**
- Werktag ⌀ 57,4 gegen freier Tag ⌀ 49,8 Fahrten
- Veranstaltungstage ⌀ 78,2 gegen sonst ⌀ 50,6 — **Faktor 1,55**
- Schulferien: roh ⌀ 53,6 gegen 58,0 — **bei vergleichbarer Temperatur (15–22 °C) aber
  70,6 gegen 93,3, also Faktor 0,76.** Der rohe Vergleich täuscht, weil Ferien
  überwiegend im Sommer liegen. Eine Scheinkorrelation zum Anfassen — sie soll in der
  Data-Understanding-Phase auffliegen.

**Stationen (für das Clustering)**

- Pendlerstationen (Hauptbahnhof, Zellerau, Grombühl) haben ihre Spitze werktags um
  7–8 Uhr, Wochenendanteil 11–13 %
- Uni-Stationen (Sanderring, Hubland) zeigen eine Doppelspitze um 10 und 14 Uhr mit
  Mittagsdelle, nur in der Vorlesungszeit, Wochenendanteil 11 %
- Freizeitstationen (Residenz, Alte Mainbrücke, Ringpark, Käppele) liegen nachmittags,
  Wochenendanteil **47–49 %**
- Der Marktplatz liegt als Mischtyp dazwischen (28 %)
- Nachgeprüft: k-Means mit k = 4 findet diese vier Gruppen **exakt** wieder

**Kundschaft (für Segmentierung und Abwanderung)**

| Profil | Anzahl | ⌀ Fahrten | ⌀ Umsatz |
|---|---:|---:|---:|
| Vielfahrer | 240 | 68,0 | 53,75 € |
| Pendler | 469 | 34,6 | 39,92 € |
| Studium | 690 | 17,6 | 19,70 € |
| Freizeit | 870 | 15,4 | 56,06 € |
| Gelegenheit | 931 | 1,9 | 8,13 € |

Freizeitnutzer fahren seltener als Pendler, geben aber **mehr** aus: lange Touren,
seltener ein Tarif mit Freiminuten. Genau solche Umkehrungen machen eine
RFM-Segmentierung interessant.

- Ohne Fahrt in den letzten 90 Tagen: **40,0 %** — das Label für die
  Abwanderungsklassifikation, aus den Fahrten abgeleitet, nicht vorgegeben

**Instandhaltung (für die Klassifikation)**

- Kilometer je Rad ↔ Anzahl Meldungen **r = +0,61** — spürbar, aber bewusst nicht
  perfekt, sonst hätte ein Entscheidungsbaum nichts zu lernen
- 42,5 % der Räder haben mindestens eine Meldung — unausgeglichen, aber beide Klassen
  gut besetzt

**Datenqualität (für die Data-Preparation-Phase)**

- **41,6 % der Fahrten haben keine gemessene Distanz** — kein Fehler, sondern ein
  Sensorthema, das zu behandeln ist
- 2,7 % der Fahrten sind abgebrochen oder storniert
- 38 Ausleihen dauern über acht Stunden — der Anker für die Anomalieerkennung
- Die Startgebühr fällt auch dann an, wenn Freiminuten die ganze Fahrt decken; ein
  Entgelt über null bei null berechneten Minuten ist die Regel, nicht der Fehler

## Generator

`generieren.py`, fester Seed (`20260901`) — jeder Lauf erzeugt identische Daten.

```bash
cd analytics && python3 generieren.py
```

Schreibt neben das Skript; `VELO_OUT=/pfad python3 generieren.py` schreibt woandershin.
`wetter.csv` muss im Zielordner liegen — es sind echte Messdaten und wird nur gelesen.
