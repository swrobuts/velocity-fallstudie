# VeloCity Warenwirtschaft — Entwurf

**Stand:** 25.08.2026 · **Phase 2** · Anschluss an
`doku/specs/2026-08-22-velocity-datenmodell-design.md`

Die Warenwirtschaft ist die **Innensicht** auf dasselbe System, das die
Website von außen zeigt. Sie wird ausschließlich von Mitarbeitenden
bedient und liegt unter einer eigenen Adresse.

---

## 1 Was gebaut wird — und was nicht

Der Entwurf aus Phase 1 sah vier Bereiche vor (G bis J). Gebaut werden
zwei davon und ein dritter, der dort fehlte:

| Bereich | Inhalt | Status |
|---|---|---|
| **J · Personal** | `rolle`, `mitarbeiter`, `mitarbeiter_rolle` | wird gebaut |
| **I · Instandhaltung** | `schadensmeldung`, `wartungsauftrag`, `fahrrad_ereignis` | wird gebaut |
| **K · Protokoll und Kennzahlen** | `aenderungsprotokoll`, `rechenannahme` | **neu**, wird gebaut |
| G · Beschaffung | `lieferant`, `artikel`, `bestellung`, `wareneingang` | bleibt entworfen |
| H · Lager | `lager`, `lagerbewegung` | bleibt entworfen |

**`wartungsposition` entfällt** gegenüber dem alten ERD. Sie verbindet
einen Wartungsauftrag mit verbauten Artikeln — ohne Bereich G/H gibt es
keine Artikel, auf die sie zeigen könnte. Sie kommt zurück, sobald das
Lager gebaut wird. Das Diagramm hält das fest, damit später niemand
rätselt, warum eine Tabelle im Entwurf steht und nicht in der Datenbank.

**Abweichung vom alten ERD: Rollen sind m:n.** Dort hatte ein
Mitarbeiter genau eine Rolle. Wer aber Werkstatt *und* Disposition
macht, bekäme dann die Sammelrolle „Verwaltung" — und damit Zugriff auf
Kundenstammdaten, die er für keine seiner beiden Aufgaben braucht. Das
widerspricht der Datensparsamkeit (Art. 5 Abs. 1 lit. c DSGVO). Eine
Zuordnungstabelle kostet wenig und löst es sauber.

---

## 2 Entscheidungen

| Frage | Entscheidung | Begründung |
|---|---|---|
| Umfang | Räder, Kunden, Stationen, Auswertungen **plus Instandhaltung** | Ohne sie ist „Status ändern" ein Auswahlfeld ohne Anlass |
| Kilometer | Feld `distanz_km` **plus** gekennzeichnete Schätzung | Sofort auswertbar, ohne zu behaupten, gemessen zu haben |
| Anmeldung | Dieselbe `auth.users`, Zuordnung über `mitarbeiter.auth_uid` | Ein Anmeldeweg, getrennte Rechte |
| Adresse | `wawi.butscher.cloud` | Trennt Kundensicht und Innensicht schon in der Adresse |
| Löschung von Kunden | **Anonymisieren, nicht löschen** | Rechnungen unterliegen zehn Jahren Aufbewahrungspflicht (§ 147 AO) |
| Datenlage | **Referenzfahrten erzeugen**, als solche gekennzeichnet | 24 Bestandsfahrten tragen keine Auswertung |
| Erster Mitarbeiter | Robert Butscher, alle vier Rollen, aus den Referenzdaten | Ohne ihn kann niemand den zweiten anlegen |

---

## 3 Datenmodell

### 3.1 Bereich J — Personal

```
rolle(rolle_id PK, code UK, bezeichnung, beschreibung)
mitarbeiter(mitarbeiter_id PK, personalnummer UK, auth_uid UK,
            vorname, nachname, email UK, eingetreten_am,
            ausgetreten_am, status)
mitarbeiter_rolle(mitarbeiter_id FK, rolle_id FK, PK beide)
```

Vier Rollen, abgeleitet aus den Aufgaben, nicht aus der Hierarchie:

| Code | Darf |
|---|---|
| `disposition` | Flotte, Stationen, Radstatus |
| `werkstatt` | Schadensmeldungen, Wartungsaufträge |
| `kundenservice` | Kundenstammdaten, Sperren, Auskunft |
| `leitung` | zusätzlich Auswertungen und Mitarbeiterverwaltung |

Neuer ENUM `mitarbeiter_status`: `aktiv`, `beurlaubt`, `ausgeschieden`.

`auth_uid` ist **nullable**: ein Mitarbeiter kann angelegt sein, bevor
er sich das erste Mal anmeldet — genau wie bei `kunde`.

### 3.2 Bereich I — Instandhaltung

```
schadensmeldung(schadensmeldung_id PK, fahrrad_id FK, gemeldet_am,
                melder_kunde_id FK NULL, melder_mitarbeiter_id FK NULL,
                kategorie, beschreibung, schwere, status)
wartungsauftrag(wartungsauftrag_id PK, auftragsnummer UK, fahrrad_id FK,
                schadensmeldung_id FK NULL, mitarbeiter_id FK NULL,
                eroeffnet_am, erledigt_am, status,
                arbeitszeit_minuten, bemerkung)
fahrrad_ereignis(ereignis_id PK, fahrrad_id FK, zeitpunkt, ereignisart,
                 mitarbeiter_id FK NULL, bemerkung,
                 beleg_tabelle, beleg_id)
```

Neue ENUMs: `schaden_schwere` (`gering`, `mittel`, `fahruntauglich`),
`schaden_status` (`offen`, `in_arbeit`, `behoben`, `verworfen`),
`auftrag_status` (`offen`, `in_arbeit`, `erledigt`, `abgebrochen`),
`ereignisart` (`angeschafft`, `status_geaendert`, `gewartet`,
`umgesetzt`, `ausgemustert`).

**`fahrrad_ereignis` ist die Lebenslaufakte.** Jede Statusänderung, jede
Wartung, jede Ausmusterung schreibt einen Satz. `beleg_tabelle` und
`beleg_id` zeigen auf den auslösenden Vorgang, ohne einen
Fremdschlüssel je möglicher Quelle zu brauchen.

**Genau eine Meldequelle.** `melder_kunde_id` und
`melder_mitarbeiter_id` sind beide nullable, aber ein CHECK verlangt,
dass genau einer gesetzt ist. Eine Meldung ohne Melder gibt es nicht,
eine mit zweien auch nicht.

### 3.3 Bereich K — Protokoll und Kennzahlen

```
aenderungsprotokoll(protokoll_id PK, zeitpunkt, mitarbeiter_id FK NULL,
                    tabelle, datensatz_id, aktion, feld,
                    wert_alt, wert_neu)
rechenannahme(annahme_id PK, code UK, wert numeric, einheit,
              gueltigkeit daterange, quelle, erlaeuterung)
```

Eine Zeile je geändertem Feld, geschrieben von einem generischen
Trigger. Feldweise statt als JSON-Klumpen, weil sich so ohne Werkzeug
beantworten lässt: *wer hat je die E-Mail dieses Kunden geändert?*

`rechenannahme` hält jede Zahl, die eine Auswertung *annimmt* statt sie
zu messen — mit Quelle und Gültigkeitszeitraum:

| Code | Bedeutung |
|---|---|
| `co2_pkw` | Gramm CO₂e je Personenkilometer im Pkw |
| `co2_ebike` | dasselbe fürs Pedelec (Strom für den Antrieb) |
| `co2_rad` | dasselbe fürs Rad ohne Motor |
| `umwegfaktor` | Verhältnis gefahrener Strecke zur Luftlinie |

**Diese Zahlen gehören in die Datenbank, nicht in den Code.** In genau
dieser Fallstudie sind Zahlen schon dreimal auseinandergelaufen, weil
sie an zwei Stellen standen. Der Umwegfaktor stand im ersten Entwurf
dieser Spezifikation noch fest in einer Sicht — derselbe Fehler, zwei
Absätze nach seiner eigenen Begründung.

### 3.4 Änderung am Bestand

`ausleihe` bekommt **eine** neue Spalte:

```sql
distanz_km numeric(8,2) null
  constraint ausleihe_distanz_chk check (distanz_km is null or distanz_km >= 0)
```

`null` heißt „nicht gemessen", nicht „null Kilometer".

---

## 4 Sicherheit und DSGVO

### 4.1 Wie unterschieden wird

Mitarbeitende melden sich wie Kunden an und sind für PostgreSQL
zunächst dieselbe Rolle `authenticated`. Unterschieden wird in den
RLS-Regeln über zwei Funktionen:

```sql
velocity.ist_mitarbeiter()          -- steht in mitarbeiter, Status aktiv
velocity.hat_rolle(text)            -- hat die genannte Rolle
```

Beide `security definer`, beide `stable`, beide lesen ausschließlich
über `auth.uid()`. Sie sind der einzige Ort, an dem entschieden wird,
wer Mitarbeiter ist.

### 4.2 Was Mitarbeitende nicht sehen

| Was | Wie verhindert | Nachweis |
|---|---|---|
| Passwort | Liegt in `auth.users`; auf Schema `auth` hat weder `anon` noch `authenticated` Rechte | Abnahme fragt es von außen ab |
| Zahlungsmittel | Kein `SELECT` auf `velocity.zahlungsmittel`, keine Sicht reicht es durch | Abnahme prüft Rechte und Sichten |
| Einzelne Fahrten eines Kunden | Kundenmaske zeigt Stammdaten und Rechnungsstatus; Fahrten nur als Summe | Sicht liefert keine `ausleihe_id` |

Der dritte Punkt ist der unauffälligste und der wichtigste: eine Liste
von Fahrten mit Start, Ziel und Uhrzeit ist ein **Bewegungsprofil**.
Der Kundenservice braucht es nicht, die Auswertung braucht nur Summen.
Was niemand braucht, wird nicht ausgeliefert.

### 4.3 Betroffenenrechte

**Auskunft (Art. 15).** `api_kunde_auskunft(kunde_id)` liefert alles,
was zu einer Person gespeichert ist, als ein JSON-Dokument — Stammdaten,
Mitgliedschaften, Fahrten, Rechnungen. Nur für Rolle `kundenservice`,
und der Aufruf selbst wird protokolliert.

**Löschung (Art. 17) = Anonymisieren.** `api_kunde_anonymisieren(kunde_id, grund)`:

- `vorname`, `nachname` → `'Gelöscht'`
- `email` → `'anonym-' || kunde_id || '@velocity.invalid'`
- `telefon`, `geburtsdatum`, `anrede` → `null`
- `rechnungsadresse_id` → `null`. Der Adresssatz selbst wird gelöscht,
  sofern keine gestellte Rechnung ihn noch braucht; sonst bleibt er
  stehen und trägt nur noch die Rechnung, nicht mehr den Kunden
- `status` → `geschlossen`
- Zahlungsmittel werden **gelöscht**, nicht anonymisiert
- Ausleihen und Rechnungen bleiben vollständig erhalten

Der Grund: § 147 AO verlangt zehn Jahre Aufbewahrung für
Rechnungsbelege. Art. 17 Abs. 3 lit. b DSGVO nimmt genau solche
rechtlichen Pflichten von der Löschpflicht aus. Wer den Kunden löschte,
verstieße gegen das Steuerrecht; wer gar nichts täte, gegen die DSGVO.
Anonymisieren erfüllt beides: die Person ist nicht mehr identifizierbar,
die Buchhaltung bleibt vollständig.

**Das ist der zentrale Lehrpunkt dieses Bereichs.** Er zeigt, dass
„Recht auf Löschung" im Datenmodell keine `DELETE`-Anweisung ist.

### 4.4 Neue Geschäftsregeln

| Nr. | Regel | Umsetzung |
|---|---|---|
| GR11 | Nur aktive Mitarbeitende haben Zugriff | `ist_mitarbeiter()` prüft den Status |
| GR12 | Mitarbeitende sehen keine Zahlungsmittel | Kein Recht, keine Sicht |
| GR13 | Ein Kunde mit Rechnungen wird anonymisiert, nie gelöscht | `api_kunde_anonymisieren`; `ON DELETE RESTRICT` |
| GR14 | Jede Änderung an Kundenstammdaten wird protokolliert | Trigger auf `kunde` |
| GR15 | Ein Rad mit laufender Ausleihe darf nicht ausgemustert werden | CHECK im `api_`-Aufruf |
| GR16 | Jede Statusänderung eines Rades erzeugt ein `fahrrad_ereignis` | Trigger auf `fahrrad` |
| GR17 | Eine Station mit Rädern oder Fahrten wird stillgelegt, nicht gelöscht | `betriebszeitraum` schließen |

GR17 spiegelt GR13 auf der Netzseite: auch eine Station verschwindet
nicht, sie hört auf zu existieren *ab einem Datum*.

---

## 5 Sichten und Funktionen

### 5.1 Arbeitssichten

| Sicht | Zeigt | Für |
|---|---|---|
| `v_wawi_flotte` | Rad, Typ, Status, Standort, letzte Wartung, offene Schäden | disposition, werkstatt |
| `v_wawi_kunde` | Stammdaten, Tarif, Kontostatus, Rechnungsstand — **ohne** Fahrten und Zahlungsmittel | kundenservice |
| `v_wawi_station` | Station, Kapazität, belegt, frei, Betriebszeitraum | disposition |
| `v_wawi_schaden` | Offene Meldungen mit Rad, Schwere, Alter | werkstatt |
| `v_wawi_auftrag` | Wartungsaufträge mit Bearbeiter und Stand | werkstatt |

### 5.2 Auswertungen

| Sicht | Inhalt |
|---|---|
| `v_wawi_umsatz_radtyp` | Monat, Radtyp, Fahrten, Minuten, Umsatz |
| `v_wawi_umsatz_kundengruppe` | Monat, Tarif, Kunden, Fahrten, Umsatz |
| `v_wawi_km_co2` | Monat, Radtyp, Kilometer, Anteil geschätzt, CO₂-Ersparnis |
| `v_wawi_stationsauslastung` | Station, Abgänge, Zugänge, Saldo, Füllstand |

Auswertungen sieht die Rolle `leitung`; die Stationsauslastung
zusätzlich `disposition`, weil sie dort zur täglichen Arbeit gehört.

Die Kilometersicht rechnet:

```
distanz_km, wenn gesetzt
sonst  Luftlinie(Start, Ziel) × Umwegfaktor aus rechenannahme
```

Die Luftlinie kommt aus den Stationskoordinaten (Haversine, ohne
PostGIS — dieselbe Entscheidung wie beim Geschäftsgebiet). Jede Zeile
trägt `ist_geschaetzt`; jede Auswertung weist den geschätzten Anteil
aus. **Eine Kennzahl, die ihre eigene Unsicherheit nicht mitliefert,
ist für Marketing brauchbar und für alles andere gefährlich.**

CO₂-Ersparnis = Kilometer × (Faktor Pkw − Faktor des Radtyps), beide
aus `rechenannahme` und zum Zeitpunkt der Fahrt gültig — dieselbe
Zeitscheiben-Logik wie bei den Preisen (GR5).

### 5.3 api-Funktionen

Alle `security definer`, alle prüfen Rolle und protokollieren.

```
api_rad_anlegen, api_rad_status_setzen, api_rad_ausmustern
api_station_anlegen, api_station_stilllegen
api_kunde_anlegen, api_kunde_aktualisieren, api_kunde_sperren
api_kunde_auskunft, api_kunde_anonymisieren
api_schaden_melden, api_auftrag_eroeffnen, api_auftrag_erledigen
```

Die Oberfläche spricht **nur** Sichten und `api_`-Funktionen an — wie
die Website. `tools/abnahme.sh` prüft das bereits und wird die WaWi
mit einschließen.

---

## 6 Oberfläche

`wawi.butscher.cloud`, neues Verzeichnis `wawi/`, dieselbe
Bereitstellung wie die Website (nginx hinter Traefik,
`tools/veroeffentlichen.sh` erweitert).

**Aufbau in der Tradition der ERP-Systeme:**

```
┌────────────────────────────────────────────────────────┐
│ VeloCity WaWi        Suche            Anna M. · Werkstatt│
├──────────┬─────────────────────────────────────────────┤
│ Flotte   │  Arbeitsliste        │  Detailmaske          │
│ Stationen│  ───────────────     │  ─────────────        │
│ Kunden   │  Rad 0042  defekt    │  Rahmennummer  …      │
│ Schäden  │  Rad 0117  Wartung   │  Status        [    ] │
│ Aufträge │  …                   │  Standort      …      │
│ Auswert. │                      │                       │
├──────────┴─────────────────────────────────────────────┤
│ 3 Sätze geladen · Rad 0042 gespeichert um 14:22        │
└────────────────────────────────────────────────────────┘
```

Was diesen Aufbau ausmacht und was ihn von einer Website unterscheidet:

- **Liste und Maske gleichzeitig.** Der Bearbeitungsfluss ist: auswählen,
  ändern, speichern, nächster Satz — ohne Seitenwechsel.
- **Die Statuszeile bestätigt jede Buchung.** Wer zwanzig Räder
  nacheinander umbucht, braucht die Rückmeldung dort, wo er hinsieht,
  nicht als Blase in der Ecke.
- **Tastatur vor Maus.** Tab durch die Felder, Strg+S speichert,
  Strg+Enter bucht, Escape verwirft. Eine Arbeitsmaske, die
  Maushandbetrieb erzwingt, kostet bei Wiederholung Minuten.
- **Die Navigation zeigt nur, wofür die Rolle Rechte hat.** Nicht
  ausgegraut — gar nicht. Was man nicht darf, soll man nicht suchen.
- **Farbe trägt Bedeutung, nicht Dekoration.** Rot ist ein defektes Rad,
  nicht ein Knopf.

Gestalterisch bleibt es bei den Mitteln der Website — dieselben
Farbmarken, dieselbe Schrift —, aber in dichterer Packung: kleinere
Grade, engere Zeilen, mehr Information je Bildschirm. Eine
Arbeitsoberfläche darf voll sein; sie wird acht Stunden am Tag benutzt,
nicht acht Sekunden.

---

## 7 Umsetzung in zwei Schritten

Der Entwurf ist zu groß für einen Umsetzungsplan: acht neue Tabellen,
neun Sichten, vierzehn Funktionen, ein Referenzjahr an Daten — und
daneben eine ganze Oberfläche.
Beides in einem Plan hieße, die Hälfte der Aufgaben zu schreiben, bevor
die andere Hälfte geprüft ist. Deshalb zwei Pläne nacheinander:

1. **Datenbank** — Bereiche J, I, K, `distanz_km`, RLS, Sichten,
   `api_`-Funktionen, die Referenzdaten aus Abschnitt 8, pgTAP-Tests und
   die Erweiterung von `tools/abnahme.sh`. Am Ende steht ein prüfbares
   Ergebnis, auch ohne Oberfläche: die Auswertungen liefern dann Zahlen,
   die man gegenrechnen kann.
2. **Oberfläche** — `wawi/`, Anmeldung, die fünf Arbeitsbereiche,
   Bereitstellung unter `wawi.butscher.cloud`.

Der zweite Plan entsteht erst, wenn der erste umgesetzt ist — er baut
auf Sichten und Funktionen auf, die dann tatsächlich existieren und
nicht nur beschrieben sind.

---

## 8 Referenzdaten

Die Auswertungen brauchen etwas zum Auswerten. Was heute in der
Datenbank liegt, taugt dafür nicht — und zwar aus einem Grund, der beim
Nachsehen erst sichtbar wurde:

| Befund | Zahl |
|---|---|
| Abgeschlossene Fahrten insgesamt | 23 |
| davon mit einer Position, die aus der Preislogik stammt | **0** |
| Fahrten ohne gültigen Preis an ihrem Starttag | 23 von 24 |
| Rechnungen | 0 |
| Kunden mit Mitgliedschaft | 10 von 1014 |
| Räder mit Status `ausgeliehen` | 37 — bei **einer** offenen Ausleihe |

Die übernommenen Fahrten tragen ausschließlich die Position
`BESTANDSUEBERNAHME`: einen Pauschalbetrag aus dem Altsystem. Sie sind
damit für eine Umsatzauswertung nach Radtyp brauchbar, für alles
Weitere nicht — sie kennen weder Startgebühr noch Zeitentgelt noch
Rabatt. Und die Preishistorie beginnt am 22.08.2026, also nach fast
allen Fahrten. Das war bisher folgenlos, weil niemand sie nachrechnete.

### 8.1 Was erzeugt wird

Ein Referenzjahr vom **01.09.2025 bis 24.08.2026**:

| Gegenstand | Umfang |
|---|---|
| Preisperioden ab 01.09.2025 | drei Typen, mit **einem** Preiswechsel im Referenzjahr |
| Mitgliedschaften | rund 400 Kunden auf die vier Tarife verteilt |
| Fahrten | rund 12 000, mit Tages-, Wochen- und Jahresgang |
| Entgeltpositionen | aus der **echten Preislogik**, nicht gesetzt |
| Rechnungen | monatlich je Kunde, aus den Positionen gerechnet |
| `distanz_km` | bei etwa 60 % der Fahrten gesetzt, sonst `null` |

Drei Entscheidungen dahinter sind wichtiger als die Zahlen:

**Der Preiswechsel ist Absicht.** Bisher zeigt die Historisierung nur
das Schema — eine Tabelle mit Gültigkeitszeitraum und einem
`EXCLUDE`-Constraint. Mit einem Wechsel mitten im Referenzjahr wird sie
in den Daten sichtbar: Fahrten vor dem Stichtag rechnen weiter mit dem
alten Satz, und in der Monatsauswertung ist der Sprung zu sehen. GR5
lässt sich damit nicht nur behaupten, sondern nachrechnen.

**`distanz_km` bleibt bei 40 % leer.** Sonst wäre die Unterscheidung
zwischen gemessenem und geschätztem Kilometer eine Spalte, die immer
dasselbe sagt. Die Auswertung soll zeigen, wie sich der geschätzte
Anteil auf die CO₂-Zahl auswirkt.

**Die Beträge werden nicht gesetzt, sondern gerechnet.** Dafür wird die
Preislogik aus `fn_ausleihe_beenden` in eine eigene Funktion
`fn_ausleihe_abrechnen(ausleihe_id)` gezogen; `fn_ausleihe_beenden` ruft
sie danach auf. Der Grund ist nicht Ordnungsliebe: `fn_ausleihe_beenden`
setzt `endzeit = now()` und kann deshalb keine vergangene Fahrt
abschließen. Ein Parameter „so tun, als sei es damals" wäre ein Loch im
Zugriffsschutz — ein Kunde könnte sich billiger rechnen. Die
Trennung löst beides: die neue Funktion **bepreist** nur, sie entscheidet
nicht, wann die Fahrt endete.

### 8.2 Wie sie gekennzeichnet werden

In `uebernahme_protokoll` — der Tabelle, die schon jede Zeile der
Altdatenübernahme mit Quelle, Menge und Hinweis festhält. Der Generator
schreibt seinen Lauf dort ebenso hinein, mit `quelle = 'Referenzdaten
(erzeugt)'` und dem `ausleihe_id`-Bereich.

**Diese Zahlen sind erfunden.** Sie sind plausibel gebaut, aber sie
messen nichts. Das steht so in der Dokumentation und im Kopf jeder
erzeugenden Datei. Ein Lehrbeispiel darf mit erfundenen Daten arbeiten;
es darf nur nicht so tun, als seien sie erhoben.

Der Generator arbeitet mit festem Startwert (`setseed`), läuft also bei
jedem Aufbau mit demselben Ergebnis durch — wie alles andere in `db/`
auch.

### 8.3 Nebenbei behoben

Die 37 Räder im Status `ausgeliehen` bei einer offenen Ausleihe sind ein
Widerspruch aus der Altdatenübernahme. Er fiel bisher nicht auf, weil
keine Oberfläche Radstatus und Ausleihen nebeneinander zeigte — die
Warenwirtschaft tut genau das auf ihrer ersten Maske. Der Generator
gleicht den Status an die tatsächlich offenen Ausleihen an.

### 8.4 Der erste Mitarbeiter

Robert Butscher, verknüpft mit der bestehenden Kennung
`swrobuts@googlemail.com`, mit allen vier Rollen. Diese Kennung gehört
bereits Kunde 2334 — dieselbe Person ist also Kunde *und* Mitarbeiter.
Das ist kein Versehen und wird auch nicht aufgelöst: `kunde` und
`mitarbeiter` sind getrennte Sätze, die zufällig auf dieselbe Anmeldung
zeigen. Wer sich auf der Website anmeldet, ist Kunde; wer sich in der
Warenwirtschaft anmeldet, ist Mitarbeiter. Dass beides geht, ohne dass
die Rechte durcheinandergeraten, ist eher ein Beleg für die Trennung als
ein Einwand gegen sie.

---

## 9 Was ausdrücklich nicht gebaut wird

- Beschaffung und Lager (Bereiche G, H) — entworfen, nicht umgesetzt
- `wartungsposition` — braucht Artikel aus Bereich G
- Umsetzungsaufträge (Rebalancing) — sinnvoll, aber ohne Lager und
  Tourenplanung ein Fragment
- Eine Löschfunktion für Kunden — siehe 4.3
- Direktzugriff der Oberfläche auf Tabellen — nur Sichten und `api_`
