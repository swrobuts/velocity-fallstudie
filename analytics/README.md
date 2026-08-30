# VeloCity-Analytics-Datensatz für PITM (CRISP-DM-Block)

Datengrundlage für den CRISP-DM × VeloCity-Block in Projekt- und IT-Management.
Angelehnt an das echte VeloCity-Datenmodell (velocity-fallstudie), aber **komplett
außerhalb der produktiven Datenbank erzeugt** — reine CSV-Exporte, kein Zugriff auf
`bikes.butscher.cloud`.

## Woher die Daten wirklich kommen

| Datei | Herkunft | Anmerkung |
|---|---|---|
| `wetter.csv` | **ECHT** | Historische Tageswerte Würzburg (49,79° N, 9,95° O), Open-Meteo/ERA5-Archiv, 2023-09-01 bis 2026-08-24 |
| `feiertage.csv` | **ECHT** | Bayerische gesetzliche Feiertage 2023–2026, inkl. bewegliche Feiertage über das Osterdatum |
| `veranstaltungen.csv` | **ECHT, Termine typisiert** | Real wiederkehrende Würzburger Großveranstaltungen (Kiliani-Volksfest, Africa Festival, Weindorf, Stramu). Exakte Tagesdaten wurden nicht recherchiert — die Spalte `genauigkeit` weist das aus, es sind typische Kalenderwochen/-wochenenden je Jahr |
| `station.csv` | **ERFUNDEN** | 10 Stationen an realen Würzburger Orten (Hauptbahnhof, Residenz, Hubland, …), aber Anzahl/Lage/Kapazität nicht erhoben |
| `fahrrad.csv` | **ERFUNDEN** | 220 Räder, Typen CITY/EBIKE/CARGO wie im echten Schema |
| `ausleihe.csv` | **ERFUNDEN** | 57.529 Fahrten über den vollen Zeitraum |
| `schadensmeldung.csv`, `wartungsauftrag.csv` | **ERFUNDEN** | 90 Meldungen/Aufträge, an kumulierte Nutzung gekoppelt |

**Alle "ERFUNDEN"-Dateien sind bewusst didaktisch verstärkt** ("gepimpt"), damit
die vier Grundverfahren an ihnen etwas zu finden haben — das ist in der
Lehrveranstaltung offen zu kommunizieren, nicht als "so sieht die Realität aus"
zu verkaufen.

## Eingebaute Muster (verifiziert, nicht nur behauptet)

Direkt nach der Generierung geprüft, nicht nur angenommen:

- **Wetterkorrelation:** Tagesfahrten ↔ Temperatur r ≈ **0,79**, ↔ Niederschlag r ≈ **−0,38**
- **Wochentagsmuster:** Werktags ⌀ 56,0 Fahrten/Tag, Wochenende ⌀ 44,9
- **Stationstypen (für Clustering):** Pendlerstationen (Hauptbahnhof, Zellerau,
  Grombühl/Klinikum) haben ihre Spitzenstunde werktags um 8 Uhr; Uni-Stationen
  (Sanderring, Hubland) um 9–13 Uhr, gekoppelt an Vorlesungszeiten; Freizeitstationen
  (Residenz, Alte Mainbrücke, Ringpark, Käppele) zwischen 16–18 Uhr, deutlich auch am
  Wochenende
- **Eventspitzen:** Fahrten an Veranstaltungstagen ×1,55 gegenüber einem
  vergleichbaren Normaltag, mit zusätzlichem Bonus für Freizeitstationen
- **Verschleisssignal (für Klassifikation):** Korrelation kumulierte Kilometer je
  Rad ↔ Anzahl Schadensmeldungen r ≈ **0,52** — spürbar, aber bewusst nicht
  perfekt, damit ein Klassifikationsmodell auch wirklich etwas zu lernen hat.
  Klassenverteilung: 59 % der Räder ohne Meldung, 41 % mit mindestens einer —
  realistisch unausgeglichen, aber beide Klassen mit genug Beispielen für eine
  aussagekräftige Confusion-Matrix

## Generator

`generieren.py`, fester Seed (`20260901`) — jeder Lauf erzeugt identische Daten.
Ausleihe-Erzeugung zieht Station, Uhrzeit und Dauer gewichtet nach Stationstyp,
Wochentag, Wetter und Semesterzeiten; das Wartungssignal koppelt Meldehäufigkeit
und Schwere an die kumulierte Nutzung je Rad.
