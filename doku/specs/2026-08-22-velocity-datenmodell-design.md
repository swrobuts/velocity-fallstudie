# VeloCity — Datenmodell und Datenhaltung

**Entwurfsdokument · Stand 22.08.2026 · Phase 1 (Website)**

---

## 1 Auftrag und Ausgangslage

Die Webanwendung „VeloCity" (Bike-Sharing Würzburg) soll eine saubere,
lehrbuchartig entworfene Datenhaltung auf einer selbst betriebenen
Supabase-Instanz (`supabase.butscher.cloud`, PostgreSQL 17.6) erhalten.
Das Ergebnis dient als durchgängiges Fallbeispiel einer Vorlesung.

Bestehend ist ein gewachsenes Schema `cityBikesRental` mit 9 Tabellen,
4 Sichten und 7 Funktionen. Es bleibt bestehen und wird nicht
weiterentwickelt. Der Entwurf entsteht daneben im neuen Schema
`velocity`.

### 1.1 Befunde am Bestand

Sie begründen einzelne Entwurfsentscheidungen und werden im Deck als
allgemeine Muster behandelt, nicht als Projekthistorie.

| # | Befund | Verifiziert durch |
|---|---|---|
| B1 | `CREATE POLICY … FOR ALL TO anon USING (true)` auf `kunde`, `fahrrad`, `station`, `fahrradtyp`, `tarif`. Mit dem in `src/config.js` ausgelieferten anon-Key sind 1015 Kundensätze inkl. Name, E-Mail, Geburtsdatum und Anschrift les- **und** schreibbar. | REST-Aufruf gegen `/rest/v1/kunde` mit anon-Key, HTTP 200 |
| B2 | `kunde.passwort_hash` enthält gemischt bcrypt-Hashes, Klartextpasswörter und den Marker `SUPABASE_AUTH`. | `SELECT passwort_hash, count(*) … GROUP BY 1` |
| B3 | `fn_ausleihe_beenden` berechnet die Kosten ohne `tarif.rabatt_prozent` und ohne `mitgliedschaft.freiminuten_aktuell`; der Trigger `trg_ausleihe_freiminuten` zieht die Freiminuten anschließend trotzdem ab. Kunden zahlen voll **und** verlieren Guthaben. | `pg_get_functiondef` beider Objekte |
| B4 | Preise liegen auf `fahrradtyp` ohne Historisierung; eine Preisänderung verändert rückwirkend die Bewertung aller Altausleihen. | Spalten `startgebuehr`, `preis_pro_minute`, `tageshoechstpreis` auf `fahrradtyp` |
| B5 | `fahrrad.latitude/longitude` wurden per `random()` befüllt und duplizieren die Stationskoordinaten. | `database-fix-bikes-v3.sql`, Schritt 4 |
| B6 | Auth-Kopplung über Zusatztabelle `auth_kunde_mapping` und einen Trigger auf dem Fremdschema `auth.users`. | `pg_trigger`, `auth_kunde_mapping` |
| B7 | Alle Zeitstempel `timestamp without time zone`. | `information_schema.columns` |
| B8 | Tarifkarten, FAQ, How-to-Schritte und Kennzahlen sind fest in `src/index.html` kodiert. | Quelltext |

### 1.2 Mengengerüst des Bestands

`kunde` 1015 · `fahrrad` 352 · `ausleihe` 32 · `station_fahrradtyp` 24 ·
`station` 13 · `mitgliedschaft` 10 · `tarif` 4 · `fahrradtyp` 3 ·
`auth_kunde_mapping` 3.

---

## 2 Zielbild und Abgrenzung

**Phase 1 — Website.** Bereiche A bis F, 25 Tabellen. Umsetzung jetzt.

**Phase 2 — Warenwirtschaft.** Bereiche G bis J, 15 Tabellen und eine
materialisierte Sicht. Jetzt
mitentworfen, damit die Anschlussstellen stimmen; umgesetzt nach
Freigabe von Phase 1.

**Nicht im Umfang.** Frontend-Rewrite (die Website bleibt Vanilla JS),
native App, Zahlungsdienstleister-Anbindung (nur die Datenstruktur
dafür), Reporting/BI.

### 2.1 Didaktischer Rahmen

Aus Studierendensicht ist dies **kein** Migrationsprojekt, sondern ein
Datenbankentwurf auf der grünen Wiese entlang des klassischen
Entwurfszyklus:

```
Anforderungsanalyse → Konzeptioneller Entwurf (ERM)
  → Normalisierung → Logischer Entwurf (Relationenmodell)
  → Physischer Entwurf (DDL) → Implementierung → Sicherheit → Anbindung
```

Die Übernahme der Altdaten ist Betriebsarbeit und steht im Anhang
(Abschnitt 11), nicht im Lehrpfad.

---

## 3 Konventionen

| Thema | Festlegung | Begründung |
|---|---|---|
| Schema | `velocity` | Trennung vom Bestand, ein Namensraum je Anwendung |
| Sprache | Deutsch, `snake_case` | Fachsprache der Vorlesung; Konsistenz mit der Fallstudie |
| Tabellennamen | Singular (`kunde`, nicht `kunden`) | Eine Zeile ist eine Entität |
| Primärschlüssel | `<tabelle>_id bigint GENERATED ALWAYS AS IDENTITY` | Surrogatschlüssel, stabil gegen fachliche Änderungen |
| Fachschlüssel | zusätzlich immer `UNIQUE` (Kundennummer, Rahmennummer, …) | Macht „Surrogat- vs. natürlicher Schlüssel" am Objekt zeigbar |
| Fremdschlüssel | gleicher Spaltenname wie das Ziel-PK | Joins lesbar, Verwechslung ausgeschlossen |
| Zeitstempel | ausnahmslos `timestamptz` | behebt B7; Sommerzeit-Fehler ausgeschlossen |
| Geld | `numeric(10,2)` | niemals `float` für Beträge |
| Gültigkeitszeiträume | `daterange` mit `EXCLUDE USING gist` | Überlappungen werden von der DB verhindert, nicht von der Anwendung gehofft. Setzt `btree_gist` voraus (siehe 3.1) |
| Statuswerte | geschlossene technische Mengen als `ENUM`, fachliche Klassifikationen als Referenztabelle | Regel wird im Deck begründet |
| Abgeleitete Werte | `GENERATED ALWAYS AS … STORED` oder Sicht | keine handgepflegte Redundanz |
| Audit | `erstellt_am`, `geaendert_am` auf jeder Tabelle, per Trigger | Nachvollziehbarkeit ohne Anwendungscode |
| Dokumentation | `COMMENT ON` für jede Tabelle und jede Spalte | Data Dictionary wird aus `pg_catalog` erzeugt, nicht getippt |
| Löschregeln | `ON DELETE RESTRICT` als Standard; `CASCADE` nur bei echter Existenzabhängigkeit | Belegdaten dürfen nicht stillschweigend verschwinden |

### 3.1 Voraussetzung: Erweiterung `btree_gist`

Die `EXCLUDE`-Constraints kombinieren `bigint WITH =` und
`daterange WITH &&`. Ohne `btree_gist` scheitert das mit
*„data type bigint has no default operator class for access method
gist"* — gegen die Zielinstanz verifiziert. Schritt 0001 legt daher
`CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA extensions` an.
Die Erweiterung ist auf der Instanz in Version 1.7 verfügbar, aber noch
nicht installiert.

### 3.2 ENUM-Typen

`kunde_status` (aktiv, gesperrt, geschlossen) ·
`fahrrad_status` (verfuegbar, ausgeliehen, wartung, defekt, ausgemustert) ·
`ausleihe_status` (aktiv, abgeschlossen, storniert) ·
`tarifart` (standard, vorteil) ·
`rechnung_status` (entwurf, gestellt, bezahlt, storniert) ·
`zahlung_status` (offen, gebucht, fehlgeschlagen, erstattet)

Phase 2 ergänzt: `bewegungsart`, `bestellung_status`, `auftrag_status`,
`wartungsart`, `schaden_schwere`, `ereignisart`.

---

## 4 Datenmodell Phase 1

Diagramme: `doku/datenmodell/erd/erd-kern.mmd`,
`erd-abrechnung.mmd`, `erd-inhalte.mmd` (alle gegen den
Mermaid-Parser validiert).

### Bereich A — Geschäftspartner

**`adresse`** — `adresse_id` PK · `strasse` · `hausnummer` · `plz` ·
`ort` · `land_code char(2)` default `DE`.
Eigenständige Entität, weil sie von Kunde, Station, Lieferant und Lager
gebraucht wird. `UNIQUE (strasse, hausnummer, plz, ort, land_code)`
verhindert Dubletten.

**`kunde`** — `kunde_id` PK · `kundennummer` UK · `auth_uid uuid` UK
`REFERENCES auth.users(id) ON DELETE SET NULL` · `email` UK ·
`anrede` · `vorname` · `nachname` · `geburtsdatum` · `telefon` ·
`rechnungsadresse_id` FK → `adresse` · `status kunde_status` ·
`registriert_am timestamptz`.
Kein `passwort_hash` (behebt B2), keine Mapping-Tabelle (behebt B6).
Auf Tabellenebene nur eine **immutable** Plausibilitätsprüfung
`CHECK (geburtsdatum BETWEEN date '1900-01-01' AND date '2100-01-01')`.
Das Mindestalter von 16 Jahren (GR8) wird in
`api_profil_aktualisieren` geprüft, **nicht** per `CHECK` mit
`current_date`: PostgreSQL akzeptiert eine solche Bedingung zwar, aber
sie ist nicht immutable und kann beim Wiedereinspielen eines Dumps
Zeilen abweisen, die beim Einfügen gültig waren. Warum
`CHECK`-Bedingungen immutable sein müssen, wird im Deck an genau diesem
Beispiel behandelt.

### Bereich B — Netz und Flotte

**`station`** — `station_id` PK · `stationsnummer` UK · `name` ·
`adresse_id` FK · `latitude numeric(9,6)` · `longitude numeric(9,6)` ·
`kapazitaet int CHECK (> 0)` · `betriebszeitraum daterange`.

**`fahrradtyp`** — `typ_id` PK · `typ_code` UK · `bezeichnung` UK ·
`beschreibung` · `hat_elektro bool` · `zuladung_kg int`.
**Ohne Preisspalten** — behebt B4.

**`fahrradtyp_merkmal`** — `merkmal_id` PK · `typ_id` FK ·
`sortierung int` · `merkmal text` · `UNIQUE (typ_id, sortierung)`.
Liefert die Bulletpoints der Tarifkarten aus der DB statt aus dem HTML
(behebt B8).

**`hersteller`** — `hersteller_id` PK · `name` UK.

**`fahrradmodell`** — `modell_id` PK · `hersteller_id` FK · `typ_id` FK ·
`modellbezeichnung` · `baujahr` · `UNIQUE (hersteller_id, modellbezeichnung)`.
Brücke zu Phase 2: Ersatzteile hängen am Modell, nicht am Einzelrad.

**`fahrrad`** — `fahrrad_id` PK · `rahmennummer` UK · `modell_id` FK ·
`status fahrrad_status` · `angeschafft_am date` · `ausgemustert_am date` ·
`CHECK (ausgemustert_am IS NULL OR ausgemustert_am >= angeschafft_am)`.

**`fahrrad_position`** — `fahrrad_id` PK **und** FK (1:1) ·
`station_id` FK NULL · `latitude` · `longitude` ·
`akkustand_prozent smallint CHECK (BETWEEN 0 AND 100)` ·
`aktualisiert_am timestamptz`.
Vertikale Trennung: selten änderliche Stammdaten gegen ständig
änderliche Bewegungsdaten. `station_id IS NULL` bedeutet eindeutig
„frei abgestellt". Behebt B5 — die `random()`-Koordinaten werden nicht
übernommen.

### Bereich C — Tarif und Preis

**`tarif`** — `tarif_id` PK · `tarif_code` UK · `bezeichnung` UK ·
`art tarifart` · `voraussetzung text`.

**`tarif_kondition`** — `kondition_id` PK · `tarif_id` FK ·
`gueltigkeit daterange` · `monatspreis numeric(10,2)` ·
`freiminuten_pro_monat int` · `rabatt_prozent numeric(5,2) CHECK (0..100)` ·
`EXCLUDE USING gist (tarif_id WITH =, gueltigkeit WITH &&)`.

**`mitgliedschaft`** — `mitgliedschaft_id` PK · `kunde_id` FK ·
`tarif_id` FK · `gueltigkeit daterange` ·
`EXCLUDE USING gist (kunde_id WITH =, gueltigkeit WITH &&)`.
Ein Kunde kann nie zwei Tarife gleichzeitig haben — durch die Datenbank
erzwungen.

**`freiminuten_periode`** — `periode_id` PK · `mitgliedschaft_id` FK ·
`jahr int` · `monat int CHECK (1..12)` · `kontingent_minuten int` ·
`verbraucht_minuten int CHECK (>= 0)` ·
`CHECK (verbraucht_minuten <= kontingent_minuten)` ·
`UNIQUE (mitgliedschaft_id, jahr, monat)`.
Ersetzt den mutierenden Zähler `mitgliedschaft.freiminuten_aktuell`:
Bestand und Verbrauch je Periode bleiben rekonstruierbar.

**`nutzungspreis`** — `preis_id` PK · `typ_id` FK ·
`gueltigkeit daterange` · `startgebuehr` · `preis_pro_minute` ·
`tageshoechstpreis` (alle `numeric(10,2) CHECK (>= 0)`) ·
`EXCLUDE USING gist (typ_id WITH =, gueltigkeit WITH &&)`.
Behebt B4: Altrechnungen bleiben nachvollziehbar bewertet.

### Bereich D — Nutzung

**`entgeltart`** — `entgeltart_id` PK · `code` UK · `bezeichnung` ·
`vorzeichen smallint CHECK (IN (-1, 1))`.
Werte: `STARTGEBUEHR` (+1), `ZEITENTGELT` (+1), `FREIMINUTEN` (−1),
`TARIFRABATT` (−1), `HOECHSTPREIS_KAPPUNG` (−1),
`ZUSCHLAG_FREIES_ABSTELLEN` (+1), `BESTANDSUEBERNAHME` (+1).

**`ausleihe`** — `ausleihe_id` PK · `kunde_id` FK · `fahrrad_id` FK ·
`mitgliedschaft_id` FK NULL · `start_station_id` FK NULL ·
`start_latitude` · `start_longitude` · `startzeit timestamptz` ·
`end_station_id` FK NULL · `end_latitude` · `end_longitude` ·
`endzeit timestamptz` · `status ausleihe_status` ·
`dauer_minuten int GENERATED ALWAYS AS (ceil(extract(epoch from endzeit - startzeit)/60)::int) STORED` ·
`CHECK (endzeit IS NULL OR endzeit >= startzeit)` ·
`CHECK ((status = 'aktiv') = (endzeit IS NULL))`.
Partieller Unique-Index `UNIQUE (fahrrad_id) WHERE status = 'aktiv'` —
ein Rad kann nicht zweimal gleichzeitig ausgeliehen sein.
`mitgliedschaft_id` wird beim Start fixiert, damit die Bepreisung auch
nach einem Tarifwechsel nachvollziehbar bleibt.

**`entgeltposition`** — `position_id` PK · `ausleihe_id` FK
`ON DELETE CASCADE` · `entgeltart_id` FK · `nutzungspreis_id` FK NULL ·
`menge numeric(10,2)` · `einzelbetrag numeric(10,2)` ·
`betrag numeric(10,2)` · `sortierung int`.
Jede Rechnungszeile trägt die Herkunft ihrer Bepreisung. Damit ist B3
strukturell ausgeschlossen: Freiminuten und Rabatt sind eigene,
sichtbare Positionen.

### Bereich E — Abrechnung

**`zahlungsart`** — `zahlungsart_id` PK · `code` UK (`SEPA`,
`KREDITKARTE`, `PAYPAL`) · `bezeichnung`.

**`zahlungsmittel`** — `zahlungsmittel_id` PK · `kunde_id` FK ·
`zahlungsart_id` FK · `referenz_token text` · `inhaber` ·
`gueltig_bis date` · `ist_standard bool`.
`referenz_token` ist ausschließlich das Token des Zahlungsdienstleisters.
Es werden **keine** IBAN und keine Kartendaten gespeichert.
Partieller Unique-Index `UNIQUE (kunde_id) WHERE ist_standard`.

**`rechnung`** — `rechnung_id` PK · `rechnungsnummer` UK · `kunde_id` FK ·
`periode_jahr` · `periode_monat` · `erstellt_am timestamptz` ·
`betrag_netto` · `ust_satz numeric(5,2)` · `ust_betrag` ·
`betrag_brutto` · `status rechnung_status` ·
`UNIQUE (kunde_id, periode_jahr, periode_monat)`.

**`rechnungsposition`** — `rechnungsposition_id` PK · `rechnung_id` FK
`ON DELETE CASCADE` · `position_nr int` · `ausleihe_id` FK NULL ·
`beschreibung` · `betrag` · `UNIQUE (rechnung_id, position_nr)`.

**`zahlung`** — `zahlung_id` PK · `rechnung_id` FK ·
`zahlungsmittel_id` FK · `betrag` · `gebucht_am timestamptz` ·
`status zahlung_status`.

### Bereich F — Redaktionsinhalte

**`faq_eintrag`** — `faq_id` PK · `frage` · `antwort` · `sortierung` ·
`aktiv bool`.

**`nutzungsschritt`** — `schritt_id` PK · `nummer int` UK · `titel` ·
`beschreibung` · `icon_code`.

**`kennzahl`** — `kennzahl_id` PK · `schluessel` UK · `anzeigewert text`
NULL · `label` · `sortierung` · `ist_berechnet bool`.
`ist_berechnet = true` bedeutet: der Wert kommt aus einer Sicht
(z. B. Stationsanzahl), nicht aus `anzeigewert`.

Bewusst **drei konkrete Tabellen** statt einer generischen
Entity-Attribute-Value-Tabelle. Das Gegenbeispiel wird im Deck als
Antipattern behandelt.

---

## 5 Datenmodell Phase 2 (Entwurf, Umsetzung später)

Diagramm: `doku/datenmodell/erd/erd-wawi.mmd`.

**G · Beschaffung** — `lieferant`, `artikelgruppe` (hierarchisch über
`uebergeordnet_id`), `artikel`, `bestellung`, `bestellposition`,
`wareneingang`.

**H · Lager** — `lager`, `lagerbewegung` (vorzeichenbehaftete Menge,
Bewegungsart, Belegreferenz), `lagerbestand` als materialisierte Sicht
über `lagerbewegung`. Bestand wird nie direkt fortgeschrieben —
Lehrpunkt „Bestand ist ein Aggregat von Bewegungen".

**I · Instandhaltung** — `schadensmeldung`, `wartungsauftrag`,
`wartungsposition` (jede verbaute Position erzeugt genau eine
`lagerbewegung`), `fahrrad_ereignis` als Lebenslaufakte je Rad.

**J · Personal und Logistik** — `mitarbeiter` (mit eigenem `auth_uid`),
`rolle`, `umsetzungsauftrag` (Rebalancing zwischen Stationen).

**Anschlussstellen zu Phase 1:** `fahrrad` ↔ `schadensmeldung`,
`wartungsauftrag`, `fahrrad_ereignis` · `station` ↔ `umsetzungsauftrag` ·
`adresse` ↔ `lieferant`, `lager` · `kunde` ↔ `schadensmeldung`.

---

## 6 Geschäftsregeln

| GR | Regel | Durchgesetzt durch |
|---|---|---|
| GR1 | Ein Fahrrad ist zu einem Zeitpunkt höchstens einmal aktiv ausgeliehen | partieller Unique-Index auf `ausleihe` |
| GR2 | Ein Kunde hat höchstens 4 gleichzeitig aktive Ausleihen | Prüfung in `api_ausleihe_starten` |
| GR3 | Ein Kunde hat zu einem Zeitpunkt höchstens einen gültigen Tarif | `EXCLUDE`-Constraint auf `mitgliedschaft` |
| GR4 | Preise und Tarifkonditionen überlappen sich nie | `EXCLUDE`-Constraints |
| GR5 | Bepreist wird mit dem zum **Startzeitpunkt** gültigen Preis | `api_ausleihe_beenden` |
| GR6 | Angefangene Minuten werden aufgerundet | `ceil()` in `dauer_minuten` |
| GR7 | Verbrauchte Freiminuten übersteigen nie das Kontingent | `CHECK` auf `freiminuten_periode` |
| GR8 | Mindestalter 16 Jahre | Prüfung in `api_profil_aktualisieren` (nicht per `CHECK`, siehe Bereich A) |
| GR9 | Nur der Kunde selbst darf seine Ausleihe beenden | `auth.uid()`-Prüfung in `api_ausleihe_beenden` |
| GR10 | Rechnungen werden je Kunde und Monat genau einmal erzeugt | `UNIQUE (kunde_id, periode_jahr, periode_monat)` |

---

## 7 Preisfindung

`api_ausleihe_beenden(p_ausleihe_id, p_end_station_id, p_lat, p_lon)`:

1. Ausleihe mit `FOR UPDATE` sperren; Status muss `aktiv` sein;
   Eigentum über `auth.uid()` prüfen (GR9).
2. `endzeit := now()`; `dauer` = aufgerundete Minuten (GR6).
3. Preiszeile aus `nutzungspreis` für den Typ des Rades, gültig zum
   **Startzeitpunkt** (GR5).
4. Freiminuten aus `freiminuten_periode` der fixierten Mitgliedschaft
   für den Monat der Startzeit: `frei := least(rest, dauer)`.
5. Positionen bilden — jede Zeile bleibt auf der Rechnung sichtbar:

   | Art | Menge | Einzelbetrag | Betrag |
   |---|---|---|---|
   | `STARTGEBUEHR` | 1 | `startgebuehr` | + |
   | `ZEITENTGELT` | `dauer` | `preis_pro_minute` | + |
   | `FREIMINUTEN` | `frei` | `preis_pro_minute` | − |
   | `TARIFRABATT` | 1 | Zwischensumme × `rabatt_prozent`/100 | − |
   | `HOECHSTPREIS_KAPPUNG` | 1 | Überschuss über `tageshoechstpreis` | − |

   Reihenfolge: Rabatt vor Kappung. Das Zeitentgelt wird über **alle**
   Minuten gebildet und die Freiminuten als eigene Gutschrift
   abgezogen — so ist der Wert des Tarifvorteils auf der Rechnung
   ablesbar.
6. `freiminuten_periode.verbraucht_minuten` um `frei` erhöhen.
7. `fahrrad.status := 'verfuegbar'`, `fahrrad_position` fortschreiben.
8. `ausleihe.status := 'abgeschlossen'`.

Alle Schritte in einer Transaktion. Behebt B3 vollständig.

---

## 8 Sicherheitskonzept

**Grundhaltung: default deny.** RLS ist auf jeder Basistabelle aktiv.
`GRANT SELECT ON ALL TABLES` wird nicht verwendet; Rechte werden
einzeln vergeben.

Für `anon` existiert auf **keiner** Basistabelle eine Policy — die
Rolle erreicht ausschließlich die öffentlichen Sichten.

Für `authenticated` existieren Policies ausschließlich auf den
Tabellen mit eigenem Bezug — `kunde`, `ausleihe`, `entgeltposition`,
`rechnung`, `rechnungsposition`, `zahlung`, `zahlungsmittel`,
`mitgliedschaft`, `freiminuten_periode` — und dort nur lesend, jeweils
eingeschränkt über
`EXISTS (SELECT 1 FROM velocity.kunde k WHERE k.kunde_id = <tabelle>.kunde_id AND k.auth_uid = auth.uid())`.
Auf allen übrigen Basistabellen (Stammdaten, Preise, Inhalte) hat auch
`authenticated` keine Policy. Diese Policies sind die Grundlage der
persönlichen Sichten weiter unten — ohne sie lieferten die Sichten
nichts.

**Öffentliche Sichten.** `v_station`, `v_verfuegbares_fahrrad`,
`v_tarifkarte`, `v_tarif`, `v_faq`, `v_nutzungsschritt`, `v_kennzahl`
laufen als *security definer* (PostgreSQL-Standard) und enthalten
ausschließlich Spalten ohne Personenbezug. `GRANT SELECT` an `anon` und
`authenticated`.

**Persönliche Sichten.** `v_meine_ausleihe` und `v_meine_rechnung`
werden mit `security_invoker = true` angelegt und stützen sich auf die
RLS-Policies oben. Nur so greift RLS tatsächlich.

`v_mein_profil` ist die begründete Ausnahme: die Sicht verknüpft
`adresse`, und ein Leserecht auf `adresse` für `authenticated` würde die
Anschriften **aller** Kunden öffnen. Sie läuft deshalb mit
Definer-Rechten und filtert selbst über `where kunde.auth_uid =
auth.uid()`. `adresse` bekommt keine Policy und kein Leserecht.

**Schreibzugriffe** ausschließlich über `SECURITY DEFINER`-Funktionen
mit `SET search_path = velocity, pg_temp`:
`api_kunde_sicherstellen`, `api_profil_aktualisieren`,
`api_ausleihe_starten`, `api_ausleihe_beenden`,
`api_zahlungsmittel_hinterlegen`. `GRANT EXECUTE` nur an
`authenticated`.

**Kein Trigger auf `auth.users`.** Das Fremdschema `auth` wird von
weiteren Anwendungen der Instanz mitgenutzt (dort hängt bereits
`qs.fn_log_login_event`). Stattdessen ruft die Website nach jedem Login
idempotent `api_kunde_sicherstellen()` auf, das aus `auth.uid()` bei
Bedarf den Kundensatz anlegt. Behebt B6 ohne Kopplung an fremdes Schema.

**Verifikation.** Ein Prüfskript ruft mit dem anon-Key jede Basistabelle
und jede Sicht über REST auf und erwartet für alle personenbezogenen
Objekte einen Fehler. Das Ergebnis ist Abnahmekriterium, nicht Beiwerk.

---

## 9 Zugriffsschicht der Website

`src/config.js` zeigt auf Schema `velocity`. `src/supabase.js` wird zur
dünnen Schicht: lesen ausschließlich aus `v_*`, schreiben ausschließlich
über `api_*`.

| Bisher | Neu |
|---|---|
| `from('station')` | `from('v_station')` |
| `from('v_bikes_available')` | `from('v_verfuegbares_fahrrad')` |
| `from('fahrradtyp')` | `from('v_tarifkarte')` |
| `from('tarif')` | `from('v_tarif')` |
| `from('ausleihe')` | `from('v_meine_ausleihe')` |
| `rpc('fn_ausleihe_starten_api')` | `rpc('api_ausleihe_starten')` |
| `rpc('fn_ausleihe_beenden_api')` | `rpc('api_ausleihe_beenden')` |
| — | `from('v_faq')`, `from('v_nutzungsschritt')`, `from('v_kennzahl')` |

Damit verschwinden die fest kodierten Tarifkarten, FAQ-Einträge,
How-to-Schritte und Kennzahlen aus `src/index.html` (behebt B8).

---

## 10 Aufbauschritte

Verzeichnis `db/aufbau/` — aus Studierendensicht die Schritte des
Entwurfs, zugleich die Reihenfolge der Vorlesung.

| # | Datei | Inhalt |
|---|---|---|
| 0001 | `schema_und_konventionen.sql` | Schema, Erweiterung `btree_gist`, ENUMs, Audit-Trigger-Funktion |
| 0002 | `bereich_a_geschaeftspartner.sql` | `adresse`, `kunde` |
| 0003 | `bereich_b_netz_und_flotte.sql` | Station bis `fahrrad_position` |
| 0004 | `bereich_c_tarif_und_preis.sql` | Tarif bis `nutzungspreis` |
| 0005 | `bereich_d_nutzung.sql` | `entgeltart`, `ausleihe`, `entgeltposition` |
| 0006 | `bereich_e_abrechnung.sql` | Zahlungsart bis `zahlung` |
| 0007 | `bereich_f_inhalte.sql` | FAQ, Nutzungsschritt, Kennzahl |
| 0008 | `referenzdaten.sql` | `entgeltart`, `zahlungsart`, Tarife, Inhalte |
| 0009 | `geschaeftslogik.sql` | `fn_*`-Fachlogik und `api_*`-Zugriffsschicht |
| 0010 | `sichten.sql` | `v_*`-Sichten |
| 0011 | `sicherheit.sql` | RLS, Policies, Grants |
| 0012 | `dokumentation.sql` | `COMMENT ON`, Dictionary-Generator |

Jede Datei ist idempotent und trägt einen Kopfkommentar mit Zweck,
betroffenen Objekten und Rücknahme.

Die Tests liegen **nicht** als Aufbauschritt, sondern als eigene
pgTAP-Testdateien unter `db/tests/t0001_*.sql` bis `t0013_*.sql`. pgTAP
1.3.3 ist auf der Instanz verfügbar; jede Testfunktion läuft in einer
eigenen, danach zurückgerollten Transaktion, sodass Testdaten nicht im
Bestand zurückbleiben. Angewandt werden sie über `db/test.py`.

Verzeichnis `db/betrieb/` — nicht Teil des Lehrpfads:
`uebernahme_altdaten.sql`, `abgleichsbericht.sql`,
`altschema_absichern.sql`, `demo_antipattern.sql`.

---

## 11 Datenübernahme aus `cityBikesRental` (Anhang, betrieblich)

Vollständige Übernahme, alle 1015 Kundensätze. Protokolliert in
`velocity.uebernahme_protokoll(lauf_id, quelle, ziel, gelesen,
geschrieben, uebersprungen, hinweis)`, abgeschlossen durch einen
Abgleichsbericht Soll gegen Ist.

| Quelle | Ziel | Regel |
|---|---|---|
| `kunde` (1015) | `adresse`, `kunde` | Adressen extrahieren und deduplizieren. `passwort_hash` wird **nicht** übernommen. `auth_uid` nur für die 3 in `auth_kunde_mapping` gemappten Sätze; die übrigen 1012 sind Konten ohne Login und werden so ausgewiesen. Kundennummer wird aus `kunde_id` erzeugt (`K-000001`). |
| `station` (13) | `adresse`, `station` | 1:1, Adresse extrahiert, `stationsnummer` aus `station_id` |
| `fahrradtyp` (3) | `fahrradtyp`, `nutzungspreis` | Preise nach `nutzungspreis` mit Gültigkeit ab Übernahmedatum |
| — | `hersteller`, `fahrradmodell` | je Typ ein Platzhalter `hersteller = 'unbekannt'`, da im Bestand keine Modellinformation existiert |
| `fahrrad` (352) | `fahrrad`, `fahrrad_position` | `random()`-Koordinaten werden verworfen; Position aus der Station abgeleitet, bei `station_id IS NULL` bleibt die Position leer |
| `tarif` (4) | `tarif`, `tarif_kondition` | Kondition gültig ab Übernahmedatum |
| `mitgliedschaft` (10) | `mitgliedschaft`, `freiminuten_periode` | `verbraucht := kontingent − freiminuten_aktuell` für den laufenden Monat |
| `ausleihe` (32) | `ausleihe`, `entgeltposition` | historische `kosten` als **eine** Position `BESTANDSUEBERNAHME`; Summen stimmen, ohne eine nie stattgefundene Preisfindung zu erfinden |
| `station_fahrradtyp` (24) | — | wird nicht übernommen: fachlich nirgends ausgewertet |

**Bekannte Grenzen, bewusst in Kauf genommen:** Altausleihen lassen sich
nicht rückwirkend mit historisch korrekten Preisen bewerten (B4 wirkt in
die Vergangenheit). Modell- und Herstellerangaben existieren im Bestand
nicht und werden mit Platzhaltern gefüllt.

### 11.1 Absicherung des Altschemas

Nach erfolgreicher Übernahme und geprüftem Abgleichsbericht, in dieser
Reihenfolge:

1. Vollständiger SQL-Dump von `cityBikesRental` als Sicherung.
2. Alle `FOR ALL TO anon`-Policies entfernen (behebt B1).
3. `UPDATE kunde SET passwort_hash = NULL` (behebt B2).
4. Struktur und Datensätze bleiben unverändert erhalten.

Der Trigger `on_auth_user_created` auf `auth.users` bleibt zunächst
bestehen; über seine Abschaltung wird nach der Umstellung der Website
gesondert entschieden.

---

## 12 Deliverables

**Dokumentation** unter `doku/datenmodell/`:
`01-anforderungen.md` · `02-konzeptionelles-modell.md` ·
`03-normalisierung.md` · `04-relationales-modell.md` ·
`05-physisches-modell.md` · `06-data-dictionary.md` (generiert) ·
`07-sicherheitskonzept.md` · `A1-datenuebernahme.md` ·
`erd/*.mmd` (validierte Mermaid-Quellen).

**Foliendeck** unter `slides/`, THWS-Design über `/bint-folie`, rund 45
Folien plus PDF-Export, Gliederung nach dem Entwurfszyklus:
Fallstudie (1–4) · Anforderungsanalyse (5–9) · Konzeptioneller Entwurf
(10–19) · Normalisierung (20–24) · Logischer Entwurf (25–29) ·
Physischer Entwurf (30–34) · Implementierung in Supabase (35–38) ·
Sicherheit (39–42) · Anwendung anbinden (43–45) · Ausblick
Warenwirtschaft (46–47). Jede Folie mit Vortragstext im Notizenfeld und
Verweis auf die zugehörige SQL-Datei.

**Code**: `db/aufbau/*.sql`, `db/betrieb/*.sql`, umgestellte Website
unter `src/`.

---

## 13 Abnahmekriterien

1. Alle Dateien in `db/aufbau/` laufen auf leerem Schema durch und ein
   zweites Mal fehlerfrei (Idempotenz nachgewiesen).
2. Der Abgleichsbericht der Übernahme weist keine unerklärte Abweichung
   aus; die Zeilenzahlen entsprechen Abschnitt 11.
3. Ein REST-Prüfskript mit anon-Key erhält auf **keiner**
   personenbezogenen Tabelle oder Sicht Daten.
4. Die Website funktioniert Ende-zu-Ende im Browser: Karte mit Stationen
   und Rädern, Tarifkarten aus der DB, FAQ aus der DB, Registrierung,
   Login, Ausleihe starten und beenden, Historie.
5. Die Preisfindung ist durch Testfälle in
   `db/tests/t0009_preisfindung.sql` belegt — mindestens: ohne Tarif, mit
   Freiminuten teilweise, mit Freiminuten vollständig, mit Rabatt, mit
   Höchstpreis-Kappung und die Reihenfolge Rabatt vor Kappung.
6. Alle Mermaid-Diagramme validieren gegen den Mermaid-Parser.
7. Jede Tabelle und jede Spalte trägt einen `COMMENT`; das generierte
   Data Dictionary ist vollständig.

---

## 14 Bewusste Grenzen

- Keine echte Zahlungsdienstleister-Anbindung; `zahlung` wird durch
  Testdaten bedient.
- Keine Geodatentypen (PostGIS); Koordinaten bleiben `numeric`. Für den
  Umfang der Fallstudie ausreichend, im Deck als Ausblick erwähnt.
- Keine Mehrsprachigkeit der Redaktionsinhalte.
- Die Warenwirtschaft ist entworfen, aber in Phase 1 nicht angelegt.
