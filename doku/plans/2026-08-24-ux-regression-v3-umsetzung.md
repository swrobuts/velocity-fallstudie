# Umsetzung der Regressionsprüfung, dritter Durchgang (24.08.2026)

Grundlage: `velocity-ux-regression-audit-2026-08-24-v3.md`.
Jeder Punkt wurde vor der Umsetzung nachgemessen und danach erneut gemessen.

Gegenproben: `python3 tools/ux_check.py` (76 Punkte),
`python3 db/durchstich.py` (33 Schritte), `python3 db/test.py` (69 Tests),
`bash tools/abnahme.sh` (16 Prüfungen).

## Verifikation

| Punkt | Messung | Urteil |
|---|---|---|
| P0-01 Rückgabe an `db_Stations[0]` | `const endStation = db_Stations[0]` im Quelltext; Ausleihe 1628 Marktplatz → Schweinfurt Markt in 57 s | **bestätigt** |
| P0-02 Legacy-Trigger blockiert Registrierung | `on_auth_user_created` → `cityBikesRental.handle_new_user()`, Unique-Index auf 1015 Altkunden | **bestätigt** |
| P1-01 Login nach Logout unzuverlässig | 10 Zyklen programmatisch fehlerfrei; **Ursache gefunden**: der Abmelde-Toast überlappt den Login-Knopf bei 390 px um 112 px | **bestätigt, andere Ursache** |
| P1-02 Passwort-Recovery ohne Mail | SMTP | **bestätigt, außerhalb meiner Hand** |
| P1-03 keine Bestätigung, kein Beleg | ein Klick löste sofort die Buchung aus | **bestätigt** |
| P2-01 Balken nennt nur „Fahrrad" | `activeRental` ohne `bikeInfo` beim Start | **bestätigt** |
| P2-02 englische Rohmeldung | `(Database error saving new user)` | **bestätigt** |
| P2-03 unsichtbare Hero-Auswahl | `inert` greift; der CSS-Rückfall verlor gegen `.final-card` | **teilweise** |

## Ergebnis

### P0 — fachliche Stopper

- ☑ **P0-01** Die Rückgabe fragt jetzt nach dem Ort. Zwei bewusste Wege:
  Station aus einer Liste (nach Entfernung sortiert, sobald der Standort
  bekannt ist) oder frei im Geschäftsgebiet mit echter Ortung. Ein
  Standort außerhalb des Gebiets wird **vor** dem Buchen abgelehnt —
  dieselbe Regel, die GR15 in der Datenbank durchsetzt, hier als
  Vorabprüfung per Strahlensatzverfahren auf dem Vieleck.
  Nachgewiesen im Browser: Fahrt vom Marktplatz, Rückgabe am Marktplatz
  (Ausleihe 1629, `start_station_id = end_station_id = 30`); zweite Fahrt
  vom Hauptbahnhof, frei abgestellt bei 49.79000/9.94500 innerhalb des
  Gebiets (Ausleihe 1630). Ein Versuch bei 50.5/11.5 wurde abgewiesen.
- ⚠ **P0-02** **Nicht umgesetzt — der Eingriff wurde blockiert.** Das
  Entfernen von `on_auth_user_created` auf `auth.users` berührt eine
  fremde Anwendung auf demselben Server. Der Befund ist vollständig
  belegt, die Behebung liegt beim Betreiber. Stattdessen umgesetzt:
  - `db/tests/t0011_sicherheit.sql` meldet den Trigger, solange er da ist
    (die eine rote Prüfung in `tools/abnahme.sh`).
  - Die Fehlermeldung nennt jetzt Ursache und Weg statt „erneut versuchen".
  - Der Claim-Weg selbst ist bereits gebaut: `api_kunde_sicherstellen`
    verknüpft einen vorhandenen Kundensatz derselben E-Mail, statt einen
    zweiten anzulegen. Er wurde nur vom Trigger blockiert.

### P1 — kritisch

- ☑ **P1-01** Ursache war nicht die Ereignisbindung. Der Abmelde-Toast
  erscheint oben rechts — dort steht der Login-Knopf. Bei 390 px
  überlappen sie um 112 Punkte; wer sofort nach dem Abmelden tippt,
  trifft drei Sekunden lang den Toast. Programmatische Klicks umgehen die
  Trefferprüfung, deshalb war der Fehler „zustandsabhängig".
  Die Meldungen rücken jetzt unter die Kopfzeile (108 px, mobil 88 px).
  Zusätzlich gehärtet: der `onAuthStateChange`-Rückruf wartet nicht mehr
  in der Supabase-Sperre auf einen Netzaufruf.
  Gemessen: 10 von 10 Zyklen, und der Knopf bleibt bei offener Meldung
  per Zeiger erreichbar.
- ⚠ **P1-02** SMTP — Betreiberentscheidung, siehe unten.
- ☑ **P1-03** Vor der Buchung: Rad, Fahrzeit, Ort, Rückgabeart. Danach ein
  Beleg, der stehen bleibt: Fahrrad, Dauer, Abstellort, Gesamtbetrag und
  die tatsächlich gebuchten Entgeltpositionen.

### P2

- ☑ **P2-01** Der Balken nennt sofort „City-Bike CB-00228" und den
  laufenden Betrag, gerechnet nach denselben Regeln wie die Datenbank.
- ☑ **P2-02** Bei bekannten Kundendaten steht ein Weg statt eines
  sinnlosen zweiten Versuchs; „Erneut versuchen" erscheint nur, wo es
  helfen kann.
- ☑ **P2-03** Der CSS-Rückfall gilt jetzt auch gegen später stehende
  Klassenregeln.

## Nebenbefunde aus dieser Runde

- **`v_meine_ausleihe` lieferte angemeldeten Kunden null Zeilen**, sobald
  sie die Positionen mitführte: die Sicht läuft mit `security_invoker`,
  und `authenticated` durfte `entgeltart` nicht lesen. Grant ergänzt.
- **`ladeListe` gab jeden Fehler als leere Liste zurück.** „Es gibt
  nichts" und „ich konnte nicht nachsehen" sahen gleich aus — deshalb
  blieb der Beleg wortlos leer. Der Fehler wird jetzt gemerkt und
  angezeigt.

## Aufgeräumt

Die Testfahrten 1628 (aus der Prüfung), 1629 und 1630 wurden nach der
Analyse entfernt, die Fahrräder an ihre Ausgangsstationen zurückgesetzt
(CB-00017 → Marktplatz, EB-00447 → Hauptbahnhof). Das Wegwerfkonto für
den Login-Nachweis ist gelöscht. Bestand wie zuvor: 32 Ausleihen.

## Offen — Betreiberentscheidungen

1. **`on_auth_user_created` auf `auth.users`.** Solange er steht, kann
   sich kein Bestandskunde registrieren.
2. **SMTP.** Bestätigung und Passwort-Rücksetzung hängen daran.
3. **Registrierung von Hand** mit echtem Postfach, Bildschirmleser.
