# Verifikationsprotokoll — öffentliche Ansicht und Zugriffsschutz

**Datum:** 03.09.2026 · **Stand:** `main`, Commit `0fe5cd1`
**Umgebung:** `python3 -m http.server 8767 --directory src`, Supabase auf
`supabase.butscher.cloud`

Belege sind DOM-Auswertungen und Konsolenausgaben aus dem laufenden
Browser, jede Zahl zusätzlich gegen die Datenbank gehalten. Kein
Bildschirmfoto — die Schrittfolge stammt aus
[2026-08-23-e2e-protokoll.md](2026-08-23-e2e-protokoll.md), die Sollwerte
aus [TESTEN.md](../../TESTEN.md).

> **Dies ist eine Aufzeichnung, kein Sollwert.** Die Zahlen unten sind der
> Zustand vom 03.09.2026. Wer die aktuellen Erwartungen sucht, findet sie
> in `TESTEN.md`; wer die Schrittfolge sucht, im Protokoll vom 23.08.2026.

## 1 Öffentliche Ansicht, abgemeldet

| Prüfpunkt | Erwartung | Ergebnis |
|---|---|---|
| Kennzahlenleiste aus `v_kennzahl` | vier Kacheln, 10 Stationen | `10 Stationen`, `24/7 Verfügbarkeit`, `100% Ökostrom`, `0 Euro Anmeldegebühr` · Datenbank: 10 Stationen — **bestanden** |
| Nutzungsschritte aus `v_nutzungsschritt` | drei Karten | drei, in hinterlegter Reihenfolge — **bestanden** |
| Tarifkarten aus `v_tarifkarte` | drei Karten, 3,10 / 8,50 / 17,00 Euro, je drei Merkmale | genau diese Beträge, je drei Merkmale — **bestanden** |
| FAQ aus `v_faq` | vier Einträge | vier — **bestanden** |
| Karte | Stations- und Fahrradmarker | 27 Marker = 10 Stationen + 17 frei abgestellte Räder · Datenbank: 10 + 17 — **bestanden** |
| Verfügbarkeitszähler | Zahl aus `v_verfuegbares_fahrrad` | 105 + 28 + 15 = 148 · Datenbank: 148 — **bestanden** |
| Geschäftsgebiet | Polygon auf der Karte | vorhanden · Datenbank: ein Gebiet — **bestanden** |
| Browserkonsole | keine Fehler | nur `Auth State Changed: INITIAL_SESSION undefined` und `Geladen: 10 Stationen, 148 Fahrräder` — **bestanden** |

Die Preise sind nicht hinterlegt, sondern gerechnet
(`startgebuehr + 30 × preis_pro_minute`):

| Typ | Startgebühr | je Minute | 30 Minuten |
|---|---|---|---|
| City-Bike | 0,10 | 0,10 | 0,10 + 3,00 = **3,10** |
| E-Bike Sport | 1,00 | 0,25 | 1,00 + 7,50 = **8,50** |
| E-Cargo Loader | 2,00 | 0,50 | 2,00 + 15,00 = **17,00** |

Zur Konsole: Sie ist nur in einem frisch geöffneten Tab aussagekräftig.
Der Puffer überlebt das Neuladen, und die Zugriffstests aus Abschnitt 2
hinterlassen dort Fehler mit HTTP 401 — das sind die erwarteten
Abweisungen, keine Mängel der Seite. Gemessen wurde deshalb in einem
zweiten Tab, vor jedem Zugriffstest.

## 2 Preisrechner auf der Tarifkarte

Neu seit dem 01.09.2026. Geprüft am E-Cargo Loader gegen das Tarifblatt
(Startgebühr 2,00, je Minute 0,50, Tageshöchstpreis 110,00):

| Fahrzeit | ungedeckelt | erwartet | angezeigt |
|---|---|---|---|
| 30 Min | 17,00 | 17,00 | **17,00** |
| 60 Min | 32,00 | 32,00 | **32,00** |
| 120 Min | 62,00 | 62,00 | **62,00** |
| 1440 Min | 722,00 | 110,00 | **110,00** |

Der letzte Fall ist der eigentliche Prüfpunkt: Der Tageshöchstpreis
greift, statt die Rechnung ungebremst weiterlaufen zu lassen.

## 3 Zugriffsschutz, aus dem Browser heraus geprüft

Ausgeführt in der Konsole der abgemeldeten Seite über den ausgelieferten
anon-Key.

| Aufruf | Ergebnis |
|---|---|
| `from('kunde')` · `from('ausleihe')` · `from('adresse')` | `permission denied for table …` |
| `from('zahlungsmittel')` · `from('rechnung')` · `from('entgeltposition')` | `permission denied for table …` |
| `from('v_station')` · `from('v_tarifkarte')` · `from('v_faq')` | ok, je 1 Zeile |
| `from('v_geschaeftsgebiet')` · `from('v_hoehenmarke')` · `from('v_preisschaetzung')` | ok, je 1 Zeile |
| `rpc('fn_ausleihe_starten')` · `rpc('fn_ausleihe_beenden')` | `permission denied for function …` |
| `rpc('api_ausleihe_starten')` · `rpc('api_ausleihe_beenden')` | `permission denied for function …` |
| `rpc('api_kunde_sicherstellen')` · `rpc('api_preisschaetzer_umschalten')` | `permission denied for function …` |

Der Aufruf der `fn_`-Schicht ist der wichtigste Punkt: Die interne
Fachlogik prüft selbst nicht auf `auth.uid()` — das tut die
`api_`-Schicht darüber. Wäre sie von außen aufrufbar, ließen sich fremde
Ausleihen abrechnen.

**Eine Anmerkung zur Methode, die das Protokoll vom 23.08. noch nicht
enthält.** Ein Aufruf *ohne* Parameter, wie er dort notiert ist, liefert
heute `Could not find the function velocity.fn_ausleihe_beenden without
parameters in the schema cache`. Das ist ein Signaturfehler und **kein**
Rechtenachweis — PostgREST kommt gar nicht bis zur Rechteprüfung. Erst
der Aufruf mit der richtigen Signatur liefert `permission denied`.
Gerufen wurde mit unmöglichen Kennungen (`-1`), damit selbst bei einem
versehentlich gesetzten Recht nichts hätte entstehen können.

Zusätzlich extern über PostgREST, `tools/rest_security_check.py`:
13 gesperrte Ressourcen liefern HTTP 401, **10** öffentliche Sichten
HTTP 200, `0 Abweichung(en)`. Die zehnte ist `v_preisschaetzung`; sie
fehlte bis zum 03.09.2026 in der Erlaubnisliste und war damit von dieser
Prüfung nicht abgedeckt.

## 4 Nicht geprüft: der angemeldete Ablauf

Registrierung, Anmeldung, Ausleihe starten und beenden sowie die
Abrechnungsanzeige sind **offen** — unverändert gegenüber dem 23.08.2026
und aus demselben Grund: Dafür müsste ein Benutzerkonto angelegt und ein
Passwort in ein Formular eingegeben werden.

Die dahinterliegende Fachlogik ist ohne Klicken belegt, und zwar
gründlicher, als ein Durchlauf es könnte:

- `db/durchstich.py` geht den ganzen Weg für alle drei Fahrradtypen gegen
  die echte Datenbank, unter der Rolle `authenticated`, mit echtem
  COMMIT, und räumt danach auf. Als Prüfung 13 der Abnahme: *33 Schritte
  für drei Fahrradtypen*.
- `db/tests/t0009_preisfindung.sql` prüft neun Fälle, darunter alle fünf
  Preiskonstellationen, die Obergrenze von vier gleichzeitigen
  Ausleihen, die Abweisung fremder Ausleihen und die Ablehnung anonymer
  `api_`-Aufrufe.

## 5 Umgebung

Gearbeitet wurde auf Port 8767 statt 8765: Auf 8765 lief ein
`python3 -m http.server` aus einer früheren Sitzung, der auf `/` mit
HTTP 404 antwortete. Er wurde nicht angetastet. Der Testserver auf 8767
ist nach der Prüfung gestoppt.

Der zugehörige vollständige Abnahmelauf vom selben Tag: **alle 32
Prüfungen bestanden**.
