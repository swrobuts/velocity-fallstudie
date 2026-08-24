# Umsetzung der Regressionsprüfung vom 24.08.2026

Grundlage: `velocity-ux-regression-audit-2026-08-24.md`, zweiter Durchgang
derselben externen Prüfung. Jeder Punkt wurde vor der Umsetzung
nachgemessen und danach erneut gemessen.

Automatische Gegenprobe: `python3 tools/ux_check.py` (60 Punkte),
`python3 db/durchstich.py` (33 Schritte), beides in `tools/abnahme.sh`.

## Verifikation der Behauptungen

| Punkt | Messung | Urteil |
|---|---|---|
| P0-01 Ausleihe scheitert an `fahrrad_position` | exakt reproduziert | **bestätigt** |
| P1-01 Registrierung scheitert am Mailversand | vier Versuche liefen durch | **nicht reproduzierbar** — vorübergehend |
| P1-02 `passwortZuruecksetzen is not defined` | `typeof` = `function` | **nicht reproduzierbar** — alter Cache |
| P1-03 Login nach Logout wirkungslos | Zustandswechsel nachgestellt, Dialog öffnet | **nicht reproduzierbar** — Zusatzproblem gilt |
| P1-04 falsche Station per Zeigegerät | Marktplatz → Dom, Juliuspromenade → Dom | **bestätigt** |
| P1-04 Popover verdeckt | Filterkarte und Ortsumschalter lagen darüber | **bestätigt** |
| P2-01 Ortsumschalter ohne Wirkung | Würzburg und Netz zeigten dasselbe | **bestätigt** |
| P2-02 Rechner zeigt anderen Wert als er rechnet | 0/−5/1441 blieben stehen, Preis von 30 Min | **bestätigt** |
| P2-03 unsichtbare Bedienelemente fokussierbar | `opacity:0`, `pointer-events:auto`, 3 Ziele | **bestätigt** |
| P2-04 keine `aria-pressed` an der Produktwahl | `aria-pressed` vorhanden und aktuell | **nicht reproduzierbar** — alter Cache |
| P2-05 Sprung 900/901 px | 1890 → 3240 px | **bestätigt** |
| P2-06 Stationsmarker zu dicht | Scheiben 33 px, Abstand 13 px | **bestätigt** |
| P2-07 leerer Filter ohne Ausweg | „gefiltert nach kein Fahrradtyp" | **bestätigt** |
| P3-01 Cargo-CTA zweizeilig | bei 1024 px alle drei gleich hoch | **teilweise** — Aufschrift war zu lang |
| P3-03 „293 Bikes live" | Text lautet „293 Räder frei · gerade eben" | **nicht reproduzierbar** — alter Cache |

**Drei von fünfzehn Befunden stammten aus veralteten Dateien im Cache.**
Das ist kein Fehler des Prüfers, sondern einer der Auslieferung.

## Ergebnis

### P0 — Stopper

- ☑ **P0-01** Beide aufgeschobenen Constraint-Trigger laufen jetzt als
  `security definer`, Eigner `postgres`, mit festem `search_path`.
  Ursache: sie feuern beim `COMMIT`, also **nach** dem Ende des
  `security definer` der API-Funktion — und damit unter der Rolle
  `authenticated`, die `fahrrad_position` nicht lesen darf.
  Nachgewiesen durch `db/durchstich.py`: 33 Schritte für alle drei
  Fahrradtypen, mit echtem COMMIT, inklusive Abrechnung und Aufräumen.

### P1 — kritisch

- ✎ **P1-01** Nicht reproduzierbar; vier Registrierungen liefen durch. Der
  Mailversand kann aber jederzeit wieder ausfallen. Behoben wurde, was in
  unserer Hand liegt: deutsche Meldung mit Ursache und nächstem Schritt,
  ein Knopf „Erneut versuchen", und unbekannte Meldungen werden gerahmt
  statt roh durchgereicht.
- ✎ **P1-02** Nicht reproduzierbar — `resetPasswordForEmail` ist verdrahtet.
  Ursache war eine alte `auth.js` im Cache; siehe „Cache" unten.
- ✎ **P1-03** Der tote Knopf war ebenfalls Cache. Das **Zusatzproblem war
  berechtigt**: der Knopf trug nur den Vornamen und meldete bei einem Klick
  sofort ab. Jetzt öffnet er ein Kontomenü mit „Angemeldet als …",
  „Rad finden", „Meine Daten" und einem eigenen Eintrag „Abmelden".
- ☑ **P1-04** Drei Maßnahmen: runde Trefferfläche statt quadratischer
  (`clip-path`), Auffächern überdeckter Scheiben durch Entspannungsrechnung
  mit Führungslinie zum wahren Ort, und Stationen haben Vorrang vor frei
  abgestellten Rädern. Gemessen bei 390, 900 und 1280 px: **jede sichtbare
  Scheibe fängt ihren eigenen Tipper**, vorher zwei von zehn nicht.
  Filterkarte und Ortsumschalter treten zurück, solange ein Infofenster
  offen ist.

### P2 — wichtig

- ☑ **P2-01** Zwei Fehler in einem: `getBounds()` liefert das **interne**
  Objekt des Vielecks, und `extend` hat es dauerhaft aufgebläht — Würzburg
  umfasste danach auch Schweinfurt. Zusätzlich hing der Wechsel an einer
  Animation. Jetzt frische Grenzen und `animate: false`.
  Gemessen: Würzburg zeigt genau die zehn Würzburger Stationen, Ganzes
  Netz alle dreizehn, beliebig oft hin und her.
- ☑ **P2-02** Begrenzung schon beim Tippen. 0 → 1, −5 → 1, 1441 → 1440;
  Feld, Regler und Preis zeigen in allen Proben denselben Wert.
- ☑ **P2-03** `hero.js` setzt `inert`, sobald die Deckkraft unter 5 % fällt.
- ✎ **P2-04** Nicht reproduzierbar; `aria-pressed` war vorhanden.
- ☑ **P2-05** Statt Stufen eine stetige Funktion:
  `clamp(180vh, 40vh + 250vw, 360vh)`. Gemessen: 900 px → 2570 px,
  901 px → 2573 px. Vorher 1350 px Unterschied.
- ☑ **P2-06** Stationsliste unter der Karte, aus denselben Daten. Gemessen:
  vier von vier angesteuerten Stationen öffnen ihre eigene.
- ☑ **P2-07** Overlay „Kein Fahrradtyp ausgewählt" mit einem Knopf, der
  alle Typen zurückholt.

### P3 — Feinschliff

- ☑ **P3-01** Alle drei Knöpfe tragen dieselbe kurze Aufschrift „Auf der
  Karte zeigen"; der vollständige Name steht im `aria-label`.
- ✗ **P3-02** Produkt-Silhouetten. **Weiterhin nicht umgesetzt** — die
  Ansage lautet „keine blöden Icons, es muss hochwertig sein".
- ✎ **P3-03** Nicht reproduzierbar.
- ☑ **P3-04** Die Sprungmarke setzt den Fokus auf ihr Ziel.

### Cache — der Befund hinter drei Befunden

`tools/versionieren.py` hängt an jede eigene Datei den Fingerabdruck ihres
Inhalts (`script.js?v=be7959ba`). Ändert sich die Datei, ändert sich die
Adresse; ändert sie sich nicht, greift der Cache weiter. Geprüft wird das
in `tools/abnahme.sh`.

## Offen und außerhalb meiner Hand

- **SMTP.** Der Versand lief bei der Prüfung nicht und läuft jetzt.
  `mailer_autoconfirm` steht auf `false`, also hängt jede Kontoanlage am
  Mailserver. Für den Hörsaal wäre `GOTRUE_MAILER_AUTOCONFIRM=true` die
  robustere Einstellung — das ist eine Entscheidung über den Server.
- **Registrierung von Hand** mit echtem Postfach.
- **Bildschirmleser** auf Karte, Kontomenü und Dialog.
