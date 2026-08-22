# Data Dictionary — Schema `velocity`

Erzeugt aus dem Systemkatalog über `velocity.v_data_dictionary`.
**Nicht von Hand pflegen** — bei Änderungen neu erzeugen:

```bash
python3 db/run.py db/aufbau/0012_dokumentation.sql
```

Die technischen Audit-Spalten `erstellt_am` und `geaendert_am` tragen
bewusst keine Beschreibung: sie bedeuten in jeder Tabelle dasselbe und
werden vom Trigger `trg_<tabelle>_audit` gepflegt. Sie sind die einzigen
Spalten ohne Kommentar; der Test `test_doku_vollstaendig` erzwingt für
alle übrigen einen.


## `adresse` (Tabelle)

Postanschrift. Eigenstaendige Entitaet, weil sie von Kunde, Station, Lieferant und Lager gebraucht wird.

| Spalte | Datentyp | NULL | Vorgabe | Beschreibung |
|---|---|---|---|---|
| `adresse_id` | `bigint` | nein |  | Surrogatschluessel, fachlich bedeutungslos und deshalb stabil. |
| `strasse` | `text` | nein |  | Strassenname ohne Hausnummer. |
| `hausnummer` | `text` | nein | `''::text` | NOT NULL mit Vorgabe leerer Text: in einem UNIQUE-Index gelten zwei NULL-Werte als verschieden, der Fachschluessel wuerde sonst keine Dubletten verhindern. |
| `plz` | `text` | nein |  | Postleitzahl. Fuer land_code DE auf fuenf Ziffern geprueft. |
| `ort` | `text` | nein |  | Ortsname. Bewusst NICHT aus der PLZ abgeleitet: in Deutschland ist plz -> ort keine saubere funktionale Abhaengigkeit. |
| `land_code` | `character(2)` | nein | `'DE'::bpchar` | Laenderkennung nach ISO 3166-1 alpha-2, Vorgabe DE. |
| `erstellt_am` | `timestamp with time zone` | nein | `now()` |  |
| `geaendert_am` | `timestamp with time zone` | nein | `now()` |  |

## `ausleihe` (Tabelle)

Zentraler Geschaeftsvorfall: ein Kunde nutzt ein Rad von einem Zeitpunkt bis zu einem anderen.

| Spalte | Datentyp | NULL | Vorgabe | Beschreibung |
|---|---|---|---|---|
| `ausleihe_id` | `bigint` | nein |  | Surrogatschluessel. |
| `kunde_id` | `bigint` | nein |  | Ausleihender Kunde. |
| `fahrrad_id` | `bigint` | nein |  | Genutztes Rad. Je Rad hoechstens eine aktive Ausleihe - Geschaeftsregel GR1 ueber einen partiellen Unique-Index. |
| `mitgliedschaft_id` | `bigint` | ja |  | Die zum Startzeitpunkt gueltige Mitgliedschaft, hier festgeschrieben. Ein spaeterer Tarifwechsel veraendert die Bepreisung damit nicht rueckwirkend. |
| `start_station_id` | `bigint` | ja |  | Station der Entnahme. NULL, wenn das Rad frei abgestellt war. |
| `start_latitude` | `numeric(9,6)` | ja |  | Breitengrad der Entnahme bei freiem Abstellort. |
| `start_longitude` | `numeric(9,6)` | ja |  | Laengengrad der Entnahme bei freiem Abstellort. |
| `startzeit` | `timestamp with time zone` | nein | `now()` | Beginn der Nutzung. Massgeblich fuer die Preisfindung - Geschaeftsregel GR5. |
| `end_station_id` | `bigint` | ja |  | Station der Rueckgabe. NULL bei freiem Abstellen. |
| `end_latitude` | `numeric(9,6)` | ja |  | Breitengrad der Rueckgabe bei freiem Abstellort. |
| `end_longitude` | `numeric(9,6)` | ja |  | Laengengrad der Rueckgabe bei freiem Abstellort. |
| `endzeit` | `timestamp with time zone` | ja |  | Ende der Nutzung. NULL, solange die Ausleihe aktiv ist. |
| `status` | `velocity.ausleihe_status` | nein | `'aktiv'::velocity.ausleihe_status` | aktiv, abgeschlossen oder storniert. Aktiv und Endzeit schliessen sich per CHECK gegenseitig aus. |
| `dauer_minuten` | `integer` | ja | `(ceil((EXTRACT(epoch FROM (endzeit - startzeit)) / 60.0)))::integer` | Berechnete Spalte: angefangene Minuten, aufgerundet. Nicht beschreibbar - abgeleitete Werte werden abgeleitet, nicht gepflegt. |
| `erstellt_am` | `timestamp with time zone` | nein | `now()` |  |
| `geaendert_am` | `timestamp with time zone` | nein | `now()` |  |

## `entgeltart` (Tabelle)

Klassifikation der Abrechnungspositionen. Referenztabelle statt ENUM, weil sie mit vorzeichen ein eigenes Attribut traegt.

| Spalte | Datentyp | NULL | Vorgabe | Beschreibung |
|---|---|---|---|---|
| `entgeltart_id` | `bigint` | nein |  | Surrogatschluessel. |
| `code` | `text` | nein |  | Fachlicher Schluessel, etwa ZEITENTGELT oder FREIMINUTEN. Wird von der Geschaeftslogik angesprochen. |
| `bezeichnung` | `text` | nein |  | Text fuer die Rechnung. |
| `vorzeichen` | `smallint` | nein |  | Plus eins belastet, minus eins entlastet. Bestimmt das Vorzeichen des Betrags in entgeltposition. |
| `erstellt_am` | `timestamp with time zone` | nein | `now()` |  |
| `geaendert_am` | `timestamp with time zone` | nein | `now()` |  |

## `entgeltposition` (Tabelle)

Einzelposition der Abrechnung einer Ausleihe. Macht die Preisfindung Zeile fuer Zeile nachvollziehbar.

| Spalte | Datentyp | NULL | Vorgabe | Beschreibung |
|---|---|---|---|---|
| `position_id` | `bigint` | nein |  | Surrogatschluessel. |
| `ausleihe_id` | `bigint` | nein |  | Ausleihe, zu der die Position gehoert. |
| `entgeltart_id` | `bigint` | nein |  | Art der Position. Bestimmt ueber vorzeichen, ob belastet oder entlastet wird. |
| `nutzungspreis_id` | `bigint` | ja |  | Beleg der Preisfindung: welcher Preissatz wurde angewandt. NULL bei Positionen ohne Preisbezug, etwa dem Tarifrabatt. |
| `menge` | `numeric(10,2)` | nein | `1` | Bezugsmenge, beim Zeitentgelt die Anzahl Minuten. |
| `einzelbetrag` | `numeric(10,2)` | nein | `0` | Betrag je Mengeneinheit, immer positiv. |
| `betrag` | `numeric(10,2)` | nein |  | Wirksamer Betrag inklusive Vorzeichen. Die Summe aller Positionen ergibt den Preis der Ausleihe. |
| `sortierung` | `integer` | nein | `0` | Reihenfolge auf der Rechnung: 10 Startgebuehr, 20 Zeitentgelt, 30 Freiminuten, 40 Rabatt, 50 Kappung. |
| `erstellt_am` | `timestamp with time zone` | nein | `now()` |  |
| `geaendert_am` | `timestamp with time zone` | nein | `now()` |  |

## `fahrrad` (Tabelle)

Einzelnes physisches Fahrzeug der Flotte, eindeutig ueber die Rahmennummer.

| Spalte | Datentyp | NULL | Vorgabe | Beschreibung |
|---|---|---|---|---|
| `fahrrad_id` | `bigint` | nein |  | Surrogatschluessel. |
| `rahmennummer` | `text` | nein |  | Fachlicher Schluessel, am Rahmen eingeschlagen. |
| `modell_id` | `bigint` | nein |  | Bauart des Rades. |
| `status` | `velocity.fahrrad_status` | nein | `'verfuegbar'::velocity.fahrrad_status` | verfuegbar, ausgeliehen, wartung, defekt oder ausgemustert. Nur verfuegbare Raeder erscheinen auf der Karte. |
| `angeschafft_am` | `date` | ja |  | Datum der Anschaffung. |
| `ausgemustert_am` | `date` | ja |  | Datum der Ausmusterung. NULL, solange das Rad im Bestand ist. |
| `erstellt_am` | `timestamp with time zone` | nein | `now()` |  |
| `geaendert_am` | `timestamp with time zone` | nein | `now()` |  |

## `fahrrad_position` (Tabelle)

Aktueller Standort eines Rades. Als 1:1-Satellit gefuehrt, damit die staendig aenderlichen Bewegungsdaten die Stammdaten nicht beruehren.

| Spalte | Datentyp | NULL | Vorgabe | Beschreibung |
|---|---|---|---|---|
| `fahrrad_id` | `bigint` | nein |  | Zugleich Primaer- und Fremdschluessel: genau eine Position je Rad. |
| `station_id` | `bigint` | ja |  | NULL bedeutet: das Rad steht frei abgestellt, nicht an einer Station |
| `latitude` | `numeric(9,6)` | ja |  | Breitengrad des freien Abstellorts. Steht das Rad an einer Station, gilt deren Koordinate. |
| `longitude` | `numeric(9,6)` | ja |  | Laengengrad des freien Abstellorts. |
| `akkustand_prozent` | `smallint` | ja |  | Ladestand in Prozent. NULL bei Raedern ohne Akku - nicht null, das waere ein leerer Akku. |
| `aktualisiert_am` | `timestamp with time zone` | nein | `now()` | Fachlicher Zeitpunkt der letzten Ortung. |
| `erstellt_am` | `timestamp with time zone` | nein | `now()` |  |
| `geaendert_am` | `timestamp with time zone` | nein | `now()` |  |

## `fahrradmodell` (Tabelle)

Bauart eines Rades. Bindeglied zur Warenwirtschaft: Ersatzteile haengen am Modell, nicht am Einzelrad.

| Spalte | Datentyp | NULL | Vorgabe | Beschreibung |
|---|---|---|---|---|
| `modell_id` | `bigint` | nein |  | Surrogatschluessel. |
| `hersteller_id` | `bigint` | nein |  | Produzent des Modells. |
| `typ_id` | `bigint` | nein |  | Fachliche Klasse, der das Modell angehoert. |
| `modellbezeichnung` | `text` | nein |  | Modellname des Herstellers. Je Hersteller eindeutig. |
| `baujahr` | `integer` | ja |  | Baujahr der Serie. |
| `erstellt_am` | `timestamp with time zone` | nein | `now()` |  |
| `geaendert_am` | `timestamp with time zone` | nein | `now()` |  |

## `fahrradtyp` (Tabelle)

Fachliche Klasse eines Rades (City, E-Bike, Cargo). Traegt bewusst keine Preise - die stehen zeitabhaengig in nutzungspreis.

| Spalte | Datentyp | NULL | Vorgabe | Beschreibung |
|---|---|---|---|---|
| `typ_id` | `bigint` | nein |  | Surrogatschluessel. |
| `typ_code` | `text` | nein |  | Fachlicher Schluessel fuer die Anwendung: CITY, EBIKE, CARGO. |
| `bezeichnung` | `text` | nein |  | Name auf der Website, etwa E-Cargo Loader. |
| `beschreibung` | `text` | ja |  | Fliesstext fuer die Tarifkarte. |
| `hat_elektro` | `boolean` | nein | `false` | Wahr bei Pedelec und E-Lastenrad. Steuert die Akkuanzeige auf der Karte. |
| `zuladung_kg` | `integer` | ja |  | Zulaessige Zuladung in Kilogramm. |
| `erstellt_am` | `timestamp with time zone` | nein | `now()` |  |
| `geaendert_am` | `timestamp with time zone` | nein | `now()` |  |

## `fahrradtyp_merkmal` (Tabelle)

Werbliche Einzelmerkmale eines Fahrradtyps fuer die Tarifkarte der Website. Frueher fest in index.html kodiert.

| Spalte | Datentyp | NULL | Vorgabe | Beschreibung |
|---|---|---|---|---|
| `merkmal_id` | `bigint` | nein |  | Surrogatschluessel. |
| `typ_id` | `bigint` | nein |  | Fahrradtyp, fuer den das Merkmal wirbt. |
| `sortierung` | `integer` | nein |  | Reihenfolge auf der Karte. Je Typ eindeutig. |
| `merkmal` | `text` | nein |  | Der Text des Aufzaehlungspunkts. |
| `erstellt_am` | `timestamp with time zone` | nein | `now()` |  |
| `geaendert_am` | `timestamp with time zone` | nein | `now()` |  |

## `faq_eintrag` (Tabelle)

Haeufig gestellte Frage der Website. Frueher fest in index.html kodiert.

| Spalte | Datentyp | NULL | Vorgabe | Beschreibung |
|---|---|---|---|---|
| `faq_id` | `bigint` | nein |  | Surrogatschluessel. |
| `frage` | `text` | nein |  | Die Frage, zugleich Fachschluessel: derselbe Wortlaut nur einmal. |
| `antwort` | `text` | nein |  | Die Antwort als Fliesstext. |
| `sortierung` | `integer` | nein | `0` | Reihenfolge auf der Seite. |
| `aktiv` | `boolean` | nein | `true` | Nur aktive Eintraege erscheinen in v_faq. Zurueckgezogene bleiben erhalten. |
| `erstellt_am` | `timestamp with time zone` | nein | `now()` |  |
| `geaendert_am` | `timestamp with time zone` | nein | `now()` |  |

## `freiminuten_periode` (Tabelle)

Monatliches Freiminutenkontingent und dessen Verbrauch. Ersetzt einen mutierenden Zaehler, damit der Verlauf rekonstruierbar bleibt.

| Spalte | Datentyp | NULL | Vorgabe | Beschreibung |
|---|---|---|---|---|
| `periode_id` | `bigint` | nein |  | Surrogatschluessel. |
| `mitgliedschaft_id` | `bigint` | nein |  | Mitgliedschaft, zu der die Periode gehoert. |
| `jahr` | `integer` | nein |  | Kalenderjahr der Periode. |
| `monat` | `integer` | nein |  | Kalendermonat der Periode, 1 bis 12. Je Mitgliedschaft und Monat genau eine Zeile. |
| `kontingent_minuten` | `integer` | nein | `0` | Gutgeschriebene Freiminuten des Monats. Der Bestand. |
| `verbraucht_minuten` | `integer` | nein | `0` | Bereits verrechnete Freiminuten. Die Bewegung. Kann das Kontingent nie uebersteigen. |
| `erstellt_am` | `timestamp with time zone` | nein | `now()` |  |
| `geaendert_am` | `timestamp with time zone` | nein | `now()` |  |

## `hersteller` (Tabelle)

Produzent eines Fahrradmodells.

| Spalte | Datentyp | NULL | Vorgabe | Beschreibung |
|---|---|---|---|---|
| `hersteller_id` | `bigint` | nein |  | Surrogatschluessel. |
| `name` | `text` | nein |  | Firmenname, eindeutig. Der Wert unbekannt kennzeichnet Saetze aus der Datenuebernahme ohne Herstellerangabe. |
| `erstellt_am` | `timestamp with time zone` | nein | `now()` |  |
| `geaendert_am` | `timestamp with time zone` | nein | `now()` |  |

## `kennzahl` (Tabelle)

Kennzahl der Kopfleiste. Entweder mit festem Anzeigewert oder berechnet.

| Spalte | Datentyp | NULL | Vorgabe | Beschreibung |
|---|---|---|---|---|
| `kennzahl_id` | `bigint` | nein |  | Surrogatschluessel. |
| `schluessel` | `text` | nein |  | Fachlicher Schluessel, den die Sicht v_kennzahl fuer berechnete Werte auswertet. |
| `anzeigewert` | `text` | ja |  | Fester Text, etwa 24/7. NULL bei berechneten Kennzahlen. |
| `label` | `text` | nein |  | Beschriftung unter dem Wert. |
| `sortierung` | `integer` | nein | `0` | Reihenfolge in der Kopfleiste. |
| `ist_berechnet` | `boolean` | nein | `false` | Wahr, wenn der Wert zur Laufzeit ermittelt wird statt aus anzeigewert zu stammen. |
| `erstellt_am` | `timestamp with time zone` | nein | `now()` |  |
| `geaendert_am` | `timestamp with time zone` | nein | `now()` |  |

## `kunde` (Tabelle)

Geschaeftspartner auf der Nachfrageseite. Die Anmeldung liegt bei Supabase Auth, hier steht kein Passwort.

| Spalte | Datentyp | NULL | Vorgabe | Beschreibung |
|---|---|---|---|---|
| `kunde_id` | `bigint` | nein |  | Surrogatschluessel. |
| `kundennummer` | `text` | nein | `('K-'::text || lpad((nextval('velocity.seq_kundennummer'::regclass))::text, 6, '0'::text))` | Fachlicher Schluessel im Format K-000000, nach aussen kommunizierbar. Wird aus seq_kundennummer vergeben. |
| `auth_uid` | `uuid` | ja |  | Verbindung zum Anmeldekonto in auth.users. NULL bei Konten ohne Login, etwa aus der Datenuebernahme. |
| `email` | `text` | nein |  | Eindeutige Kontaktadresse, zugleich Verknuepfungsmerkmal zum Anmeldekonto. |
| `anrede` | `text` | ja |  | Freitext fuer die Anschrift, keine geschlossene Werteliste. |
| `vorname` | `text` | nein |  | Vorname laut Selbstauskunft. |
| `nachname` | `text` | nein |  | Nachname laut Selbstauskunft. |
| `geburtsdatum` | `date` | ja |  | Grundlage der Altersgrenze von 16 Jahren. Geprueft in api_profil_aktualisieren, nicht per CHECK: eine Bedingung mit current_date waere nicht immutable. |
| `telefon` | `text` | ja |  | Rufnummer, unformatiert gespeichert. |
| `rechnungsadresse_id` | `bigint` | ja |  | Anschrift fuer die Rechnungsstellung. NULL, solange keine hinterlegt ist. |
| `status` | `velocity.kunde_status` | nein | `'aktiv'::velocity.kunde_status` | aktiv, gesperrt oder geschlossen. Nur aktive Kunden duerfen ausleihen. |
| `registriert_am` | `timestamp with time zone` | nein | `now()` | Fachlicher Zeitpunkt der Anmeldung, unabhaengig von der technischen Audit-Spalte. |
| `erstellt_am` | `timestamp with time zone` | nein | `now()` |  |
| `geaendert_am` | `timestamp with time zone` | nein | `now()` |  |

## `mitgliedschaft` (Tabelle)

Einschreibung eines Kunden in einen Tarif fuer einen Zeitraum. Je Kunde nie zwei gleichzeitig.

| Spalte | Datentyp | NULL | Vorgabe | Beschreibung |
|---|---|---|---|---|
| `mitgliedschaft_id` | `bigint` | nein |  | Surrogatschluessel. Wird beim Start einer Ausleihe dort festgeschrieben. |
| `kunde_id` | `bigint` | nein |  | Eingeschriebener Kunde. |
| `tarif_id` | `bigint` | nein |  | Gewaehlter Tarif. |
| `gueltigkeit` | `daterange` | nein |  | Halboffener Zeitraum. Je Kunde ueberschneidungsfrei - Geschaeftsregel GR3, von der Datenbank erzwungen. |
| `erstellt_am` | `timestamp with time zone` | nein | `now()` |  |
| `geaendert_am` | `timestamp with time zone` | nein | `now()` |  |

## `nutzungspreis` (Tabelle)

Zeitabhaengiger Preis je Fahrradtyp. Bepreist wird mit dem zum Startzeitpunkt der Ausleihe gueltigen Satz.

| Spalte | Datentyp | NULL | Vorgabe | Beschreibung |
|---|---|---|---|---|
| `preis_id` | `bigint` | nein |  | Surrogatschluessel. Wird in entgeltposition als Beleg der Preisfindung hinterlegt. |
| `typ_id` | `bigint` | nein |  | Fahrradtyp, fuer den der Preis gilt. |
| `gueltigkeit` | `daterange` | nein |  | Halboffener Zeitraum, je Typ ueberschneidungsfrei. Deshalb bleiben Altrechnungen nachvollziehbar bewertet. |
| `startgebuehr` | `numeric(10,2)` | nein |  | Einmaliges Entgelt je Ausleihe in Euro. |
| `preis_pro_minute` | `numeric(10,2)` | nein |  | Entgelt je angefangener Minute in Euro. |
| `tageshoechstpreis` | `numeric(10,2)` | nein |  | Obergrenze je Ausleihe. Wird nach dem Tarifrabatt angewandt. |
| `erstellt_am` | `timestamp with time zone` | nein | `now()` |  |
| `geaendert_am` | `timestamp with time zone` | nein | `now()` |  |

## `nutzungsschritt` (Tabelle)

Ein Schritt der Anleitung "So einfach geht es" auf der Website.

| Spalte | Datentyp | NULL | Vorgabe | Beschreibung |
|---|---|---|---|---|
| `schritt_id` | `bigint` | nein |  | Surrogatschluessel. |
| `nummer` | `integer` | nein |  | Position in der Abfolge, zugleich Fachschluessel. |
| `titel` | `text` | nein |  | Ueberschrift der Karte. |
| `beschreibung` | `text` | nein |  | Erlaeuternder Text. |
| `icon_code` | `text` | ja |  | Name des Font-Awesome-Symbols, etwa fa-qrcode. |
| `erstellt_am` | `timestamp with time zone` | nein | `now()` |  |
| `geaendert_am` | `timestamp with time zone` | nein | `now()` |  |

## `rechnung` (Tabelle)

Monatlicher Beleg je Kunde ueber die Ausleihen einer Abrechnungsperiode.

| Spalte | Datentyp | NULL | Vorgabe | Beschreibung |
|---|---|---|---|---|
| `rechnung_id` | `bigint` | nein |  | Surrogatschluessel. |
| `rechnungsnummer` | `text` | nein |  | Fachlicher Schluessel, fortlaufend und nach aussen kommuniziert. |
| `kunde_id` | `bigint` | nein |  | Rechnungsempfaenger. |
| `periode_jahr` | `integer` | nein |  | Jahr der Abrechnungsperiode. |
| `periode_monat` | `integer` | nein |  | Monat der Abrechnungsperiode. Je Kunde und Periode genau eine Rechnung - Geschaeftsregel GR10. |
| `erstellt_am_beleg` | `timestamp with time zone` | nein | `now()` | Fachliches Belegdatum. Bewusst anders benannt als die technische Audit-Spalte erstellt_am. |
| `betrag_netto` | `numeric(10,2)` | nein | `0` | Summe der Positionen ohne Umsatzsteuer. |
| `ust_satz` | `numeric(5,2)` | nein | `19.00` | Angewandter Umsatzsteuersatz in Prozent, zum Belegzeitpunkt festgeschrieben. |
| `ust_betrag` | `numeric(10,2)` | nein | `0` | Betrag der Umsatzsteuer. |
| `betrag_brutto` | `numeric(10,2)` | nein | `0` | Zahlbetrag einschliesslich Umsatzsteuer. |
| `status` | `velocity.rechnung_status` | nein | `'entwurf'::velocity.rechnung_status` | entwurf, gestellt, bezahlt oder storniert. |
| `erstellt_am` | `timestamp with time zone` | nein | `now()` |  |
| `geaendert_am` | `timestamp with time zone` | nein | `now()` |  |

## `rechnungsposition` (Tabelle)

Einzelposten einer Rechnung, in der Regel genau eine Ausleihe.

| Spalte | Datentyp | NULL | Vorgabe | Beschreibung |
|---|---|---|---|---|
| `rechnungsposition_id` | `bigint` | nein |  | Surrogatschluessel. |
| `rechnung_id` | `bigint` | nein |  | Rechnungskopf. |
| `position_nr` | `integer` | nein |  | Laufende Nummer auf dem Beleg. Je Rechnung eindeutig. |
| `ausleihe_id` | `bigint` | ja |  | Abgerechnete Ausleihe. NULL bei Positionen ohne Nutzungsbezug, etwa einem Monatsbeitrag. |
| `beschreibung` | `text` | nein |  | Text auf dem Beleg. |
| `betrag` | `numeric(10,2)` | nein |  | Betrag der Position. |
| `erstellt_am` | `timestamp with time zone` | nein | `now()` |  |
| `geaendert_am` | `timestamp with time zone` | nein | `now()` |  |

## `station` (Tabelle)

Fester Standort mit Stellplaetzen, an dem Raeder entliehen und abgestellt werden.

| Spalte | Datentyp | NULL | Vorgabe | Beschreibung |
|---|---|---|---|---|
| `station_id` | `bigint` | nein |  | Surrogatschluessel. |
| `stationsnummer` | `text` | nein |  | Fachlicher Schluessel im Format S-0000. |
| `name` | `text` | nein |  | Anzeigename auf der Karte, etwa Hauptbahnhof. |
| `adresse_id` | `bigint` | nein |  | Anschrift der Station. |
| `latitude` | `numeric(9,6)` | ja |  | Breitengrad in Dezimalgrad, WGS 84. |
| `longitude` | `numeric(9,6)` | ja |  | Laengengrad in Dezimalgrad, WGS 84. |
| `kapazitaet` | `integer` | nein |  | Anzahl der Stellplaetze, muss groesser als null sein. |
| `betriebszeitraum` | `daterange` | nein | `daterange(CURRENT_DATE, NULL::date, '[)'::text)` | Zeitraum, in dem die Station betrieben wird. Halboffen; nach oben offen bedeutet: weiterhin in Betrieb. |
| `erstellt_am` | `timestamp with time zone` | nein | `now()` |  |
| `geaendert_am` | `timestamp with time zone` | nein | `now()` |  |

## `tarif` (Tabelle)

Preismodell, in das sich ein Kunde einschreiben kann.

| Spalte | Datentyp | NULL | Vorgabe | Beschreibung |
|---|---|---|---|---|
| `tarif_id` | `bigint` | nein |  | Surrogatschluessel. |
| `tarif_code` | `text` | nein |  | Fachlicher Schluessel: BASIS, STUDENT, OEPNV, PREMIUM. |
| `bezeichnung` | `text` | nein |  | Name auf der Website. |
| `art` | `velocity.tarifart` | nein | `'standard'::velocity.tarifart` | standard oder vorteil. Vorteilstarife setzen einen Nachweis voraus. |
| `voraussetzung` | `text` | ja |  | Nachweis, den der Kunde erbringen muss, etwa ein Studierendenausweis. |
| `erstellt_am` | `timestamp with time zone` | nein | `now()` |  |
| `geaendert_am` | `timestamp with time zone` | nein | `now()` |  |

## `tarif_kondition` (Tabelle)

Zeitabhaengige Konditionen eines Tarifs. Ueberschneidungsfrei durch EXCLUDE-Constraint.

| Spalte | Datentyp | NULL | Vorgabe | Beschreibung |
|---|---|---|---|---|
| `kondition_id` | `bigint` | nein |  | Surrogatschluessel. |
| `tarif_id` | `bigint` | nein |  | Tarif, fuer den die Kondition gilt. |
| `gueltigkeit` | `daterange` | nein |  | Halboffener Zeitraum. Je Tarif ueberschneidungsfrei: eine Preisaenderung legt einen neuen Zeitraum an, statt den alten zu ueberschreiben. |
| `monatspreis` | `numeric(10,2)` | nein | `0` | Monatliches Entgelt in Euro. Null bei kostenlosen Tarifen. |
| `freiminuten_pro_monat` | `integer` | nein | `0` | Monatliches Kontingent, das in freiminuten_periode gutgeschrieben wird. |
| `rabatt_prozent` | `numeric(5,2)` | nein | `0` | Nachlass auf die Zwischensumme einer Ausleihe. Wirkt VOR der Kappung auf den Tageshoechstpreis. |
| `erstellt_am` | `timestamp with time zone` | nein | `now()` |  |
| `geaendert_am` | `timestamp with time zone` | nein | `now()` |  |

## `uebernahme_protokoll` (Tabelle)

Protokoll der einmaligen Uebernahme aus dem Altschema cityBikesRental.

| Spalte | Datentyp | NULL | Vorgabe | Beschreibung |
|---|---|---|---|---|
| `protokoll_id` | `bigint` | nein |  | Surrogatschluessel. |
| `lauf` | `timestamp with time zone` | nein | `now()` | Zeitstempel des Uebernahmelaufs. Gleicher Wert fuer alle Zeilen eines Laufs. |
| `quelle` | `text` | nein |  | Gelesene Tabelle im Altschema. |
| `ziel` | `text` | nein |  | Beschriebene Tabelle im Schema velocity. |
| `gelesen` | `integer` | nein | `0` | Anzahl der Saetze in der Quelle. |
| `geschrieben` | `integer` | nein | `0` | Anzahl der tatsaechlich neu angelegten Saetze. |
| `uebersprungen` | `integer` | nein | `0` | Anzahl der bewusst ausgelassenen Saetze. |
| `hinweis` | `text` | ja |  | Begruendung fuer Abweichungen und getroffene Annahmen. |
| `erstellt_am` | `timestamp with time zone` | nein | `now()` |  |
| `geaendert_am` | `timestamp with time zone` | nein | `now()` |  |

## `zahlung` (Tabelle)

Zahlungsvorgang zu einer Rechnung.

| Spalte | Datentyp | NULL | Vorgabe | Beschreibung |
|---|---|---|---|---|
| `zahlung_id` | `bigint` | nein |  | Surrogatschluessel. |
| `rechnung_id` | `bigint` | nein |  | Beglichene Rechnung. Teilzahlungen sind als mehrere Zeilen moeglich. |
| `zahlungsmittel_id` | `bigint` | ja |  | Belastetes Zahlungsmittel. NULL, wenn es nachtraeglich geloescht wurde. |
| `betrag` | `numeric(10,2)` | nein |  | Gezahlter Betrag. |
| `gebucht_am` | `timestamp with time zone` | ja |  | Zeitpunkt der Buchung. Pflicht, sobald der Status gebucht ist. |
| `status` | `velocity.zahlung_status` | nein | `'offen'::velocity.zahlung_status` | offen, gebucht, fehlgeschlagen oder erstattet. |
| `erstellt_am` | `timestamp with time zone` | nein | `now()` |  |
| `geaendert_am` | `timestamp with time zone` | nein | `now()` |  |

## `zahlungsart` (Tabelle)

Verfahren der Bezahlung (SEPA, Kreditkarte, PayPal).

| Spalte | Datentyp | NULL | Vorgabe | Beschreibung |
|---|---|---|---|---|
| `zahlungsart_id` | `bigint` | nein |  | Surrogatschluessel. |
| `code` | `text` | nein |  | Fachlicher Schluessel: SEPA, KREDITKARTE, PAYPAL. |
| `bezeichnung` | `text` | nein |  | Text fuer die Oberflaeche. |
| `erstellt_am` | `timestamp with time zone` | nein | `now()` |  |
| `geaendert_am` | `timestamp with time zone` | nein | `now()` |  |

## `zahlungsmittel` (Tabelle)

Beim Zahlungsdienstleister hinterlegtes Mittel eines Kunden. Gespeichert wird nur dessen Token, nie IBAN oder Kartennummer.

| Spalte | Datentyp | NULL | Vorgabe | Beschreibung |
|---|---|---|---|---|
| `zahlungsmittel_id` | `bigint` | nein |  | Surrogatschluessel. |
| `kunde_id` | `bigint` | nein |  | Kunde, dem das Zahlungsmittel gehoert. |
| `zahlungsart_id` | `bigint` | nein |  | Verfahren dieses Zahlungsmittels. |
| `referenz_token` | `text` | nein |  | Token des Zahlungsdienstleisters. Was nicht gespeichert wird, kann nicht abfliessen. |
| `inhaber` | `text` | ja |  | Name des Kontoinhabers laut Dienstleister. |
| `gueltig_bis` | `date` | ja |  | Ablaufdatum, bei Karten relevant. |
| `ist_standard` | `boolean` | nein | `false` | Vorbelegtes Zahlungsmittel. Je Kunde hoechstens eines, ueber einen partiellen Unique-Index erzwungen. |
| `erstellt_am` | `timestamp with time zone` | nein | `now()` |  |
| `geaendert_am` | `timestamp with time zone` | nein | `now()` |  |

## `v_data_dictionary` (Sicht)

Erzeugt das Data Dictionary aus dem Systemkatalog. Grundlage fuer doku/datenmodell/06-data-dictionary.md.

| Spalte | Datentyp | NULL | Vorgabe | Beschreibung |
|---|---|---|---|---|
| `objekt_art` | `text` | ja |  | Tabelle oder Sicht. |
| `tabelle` | `name` | ja |  | Name des Objekts. |
| `spalte` | `name` | ja |  | Name der Spalte. |
| `datentyp` | `text` | ja |  | Datentyp einschliesslich Laenge und Genauigkeit. |
| `nullbar` | `boolean` | ja |  | Wahr, wenn die Spalte NULL zulaesst. |
| `vorgabe` | `text` | ja |  | Vorgabewert als Ausdruck, NULL wenn keiner gesetzt ist. |
| `beschreibung` | `text` | ja |  | Der Spaltenkommentar aus dem Systemkatalog. |
| `tabellenbeschreibung` | `text` | ja |  | Der Tabellenkommentar aus dem Systemkatalog. |
| `position` | `smallint` | ja |  | Ordnungsnummer der Spalte innerhalb des Objekts. |

## `v_faq` (Sicht)

Oeffentliche, aktive FAQ-Eintraege.

| Spalte | Datentyp | NULL | Vorgabe | Beschreibung |
|---|---|---|---|---|
| `faq_id` | `bigint` | ja |  | Schluessel des Eintrags. |
| `frage` | `text` | ja |  | Die Frage. |
| `antwort` | `text` | ja |  | Die Antwort. |
| `sortierung` | `integer` | ja |  | Reihenfolge auf der Seite. |

## `v_kennzahl` (Sicht)

Oeffentliche Kennzahlen, feste und berechnete.

| Spalte | Datentyp | NULL | Vorgabe | Beschreibung |
|---|---|---|---|---|
| `schluessel` | `text` | ja |  | Fachlicher Schluessel der Kennzahl. |
| `label` | `text` | ja |  | Beschriftung unter dem Wert. |
| `sortierung` | `integer` | ja |  | Reihenfolge in der Kopfleiste. |
| `wert` | `text` | ja |  | Anzuzeigender Wert: entweder fest hinterlegt oder zur Laufzeit ermittelt. |

## `v_mein_profil` (Sicht)

Stammdaten des angemeldeten Kunden. Laeuft mit Definer-Rechten und filtert selbst auf auth.uid(), weil adresse nicht freigegeben ist.

| Spalte | Datentyp | NULL | Vorgabe | Beschreibung |
|---|---|---|---|---|
| `kunde_id` | `bigint` | ja |  | Schluessel des Kunden. |
| `kundennummer` | `text` | ja |  | Nach aussen kommunizierte Kundennummer. |
| `email` | `text` | ja |  | Hinterlegte Kontaktadresse. |
| `vorname` | `text` | ja |  | Vorname. |
| `nachname` | `text` | ja |  | Nachname. |
| `telefon` | `text` | ja |  | Rufnummer. |
| `geburtsdatum` | `date` | ja |  | Geburtsdatum, Grundlage der Altersgrenze. |
| `status` | `text` | ja |  | aktiv, gesperrt oder geschlossen. |
| `registriert_am` | `timestamp with time zone` | ja |  | Zeitpunkt der Anmeldung. |
| `strasse` | `text` | ja |  | Strasse der Rechnungsadresse. |
| `hausnummer` | `text` | ja |  | Hausnummer der Rechnungsadresse. |
| `plz` | `text` | ja |  | Postleitzahl der Rechnungsadresse. |
| `ort` | `text` | ja |  | Ort der Rechnungsadresse. |

## `v_meine_ausleihe` (Sicht)

Ausleihen des angemeldeten Kunden. Laeuft mit den Rechten des Aufrufers, begrenzt durch RLS.

| Spalte | Datentyp | NULL | Vorgabe | Beschreibung |
|---|---|---|---|---|
| `ausleihe_id` | `bigint` | ja |  | Schluessel der Ausleihe, wird an api_ausleihe_beenden uebergeben. |
| `startzeit` | `timestamp with time zone` | ja |  | Beginn der Nutzung. |
| `endzeit` | `timestamp with time zone` | ja |  | Ende der Nutzung, NULL bei laufender Fahrt. |
| `status` | `text` | ja |  | aktiv, abgeschlossen oder storniert. |
| `dauer_minuten` | `integer` | ja |  | Angefangene Minuten, aufgerundet. |
| `rahmennummer` | `text` | ja |  | Am Rahmen ablesbare Nummer des genutzten Rades. |
| `typ_code` | `text` | ja |  | CITY, EBIKE oder CARGO. |
| `typ_bezeichnung` | `text` | ja |  | Name des Fahrradtyps. |
| `start_station` | `text` | ja |  | Name der Entnahmestation, NULL bei freiem Abstellort. |
| `end_station` | `text` | ja |  | Name der Rueckgabestation, NULL bei freiem Abstellen. |
| `gesamtbetrag` | `numeric(10,2)` | ja |  | Summe aller Entgeltpositionen dieser Ausleihe. |

## `v_meine_rechnung` (Sicht)

Rechnungen des angemeldeten Kunden. Laeuft mit den Rechten des Aufrufers, begrenzt durch RLS.

| Spalte | Datentyp | NULL | Vorgabe | Beschreibung |
|---|---|---|---|---|
| `rechnung_id` | `bigint` | ja |  | Schluessel der Rechnung. |
| `rechnungsnummer` | `text` | ja |  | Nach aussen kommunizierte Belegnummer. |
| `periode_jahr` | `integer` | ja |  | Jahr der Abrechnungsperiode. |
| `periode_monat` | `integer` | ja |  | Monat der Abrechnungsperiode. |
| `erstellt_am_beleg` | `timestamp with time zone` | ja |  | Belegdatum. |
| `betrag_netto` | `numeric(10,2)` | ja |  | Summe ohne Umsatzsteuer. |
| `ust_betrag` | `numeric(10,2)` | ja |  | Betrag der Umsatzsteuer. |
| `betrag_brutto` | `numeric(10,2)` | ja |  | Zahlbetrag. |
| `status` | `text` | ja |  | entwurf, gestellt, bezahlt oder storniert. |

## `v_nutzungsschritt` (Sicht)

Oeffentliche Schritte der Nutzungsanleitung.

| Spalte | Datentyp | NULL | Vorgabe | Beschreibung |
|---|---|---|---|---|
| `schritt_id` | `bigint` | ja |  | Schluessel des Schritts. |
| `nummer` | `integer` | ja |  | Position in der Abfolge. |
| `titel` | `text` | ja |  | Ueberschrift der Karte. |
| `beschreibung` | `text` | ja |  | Erlaeuternder Text. |
| `icon_code` | `text` | ja |  | Name des Font-Awesome-Symbols. |

## `v_station` (Sicht)

Oeffentliche Stationsliste mit Belegung. Ohne Personenbezug.

| Spalte | Datentyp | NULL | Vorgabe | Beschreibung |
|---|---|---|---|---|
| `station_id` | `bigint` | ja |  | Schluessel der Station. |
| `stationsnummer` | `text` | ja |  | Fachlicher Schluessel der Station. |
| `name` | `text` | ja |  | Anzeigename auf der Karte. |
| `strasse` | `text` | ja |  | Strasse der Station. |
| `hausnummer` | `text` | ja |  | Hausnummer der Station. |
| `plz` | `text` | ja |  | Postleitzahl der Station. |
| `ort` | `text` | ja |  | Ort der Station. |
| `latitude` | `numeric(9,6)` | ja |  | Breitengrad fuer den Kartenmarker. |
| `longitude` | `numeric(9,6)` | ja |  | Laengengrad fuer den Kartenmarker. |
| `kapazitaet` | `integer` | ja |  | Anzahl der Stellplaetze. |
| `verfuegbare_raeder` | `integer` | ja |  | Zahl der aktuell entleihbaren Raeder an dieser Station. |
| `freie_stellplaetze` | `integer` | ja |  | Kapazitaet abzueglich der abgestellten Raeder, nie negativ. |

## `v_tarif` (Sicht)

Oeffentliche Tarifliste mit den heute geltenden Konditionen.

| Spalte | Datentyp | NULL | Vorgabe | Beschreibung |
|---|---|---|---|---|
| `tarif_id` | `bigint` | ja |  | Schluessel des Tarifs. |
| `tarif_code` | `text` | ja |  | Fachlicher Schluessel des Tarifs. |
| `bezeichnung` | `text` | ja |  | Name des Tarifs. |
| `art` | `text` | ja |  | standard oder vorteil. |
| `voraussetzung` | `text` | ja |  | Zu erbringender Nachweis. |
| `monatspreis` | `numeric(10,2)` | ja |  | Heute geltendes Monatsentgelt. |
| `freiminuten_pro_monat` | `integer` | ja |  | Heute geltendes Monatskontingent. |
| `rabatt_prozent` | `numeric(5,2)` | ja |  | Heute geltender Nachlass auf Ausleihen. |

## `v_tarifkarte` (Sicht)

Oeffentliche Preiskarten je Fahrradtyp inklusive Werbemerkmalen.

| Spalte | Datentyp | NULL | Vorgabe | Beschreibung |
|---|---|---|---|---|
| `typ_id` | `bigint` | ja |  | Schluessel des Fahrradtyps. |
| `typ_code` | `text` | ja |  | CITY, EBIKE oder CARGO. |
| `bezeichnung` | `text` | ja |  | Name auf der Karte. |
| `beschreibung` | `text` | ja |  | Fliesstext zur Karte. |
| `hat_elektro` | `boolean` | ja |  | Wahr bei elektrischer Unterstuetzung. |
| `startgebuehr` | `numeric(10,2)` | ja |  | Heute geltende Startgebuehr. |
| `preis_pro_minute` | `numeric(10,2)` | ja |  | Heute geltendes Minutenentgelt. |
| `tageshoechstpreis` | `numeric(10,2)` | ja |  | Heute geltende Obergrenze je Ausleihe. |
| `preis_30_minuten` | `numeric` | ja |  | Beispielpreis fuer eine halbe Stunde: Startgebuehr plus dreissig Minutenentgelte. |
| `merkmale` | `text[]` | ja |  | Die Aufzaehlungspunkte der Karte, nach sortierung geordnet. |

## `v_verfuegbares_fahrrad` (Sicht)

Oeffentliche Liste ausleihbarer Raeder mit Position und geltendem Preis.

| Spalte | Datentyp | NULL | Vorgabe | Beschreibung |
|---|---|---|---|---|
| `fahrrad_id` | `bigint` | ja |  | Schluessel des Rades, wird an api_ausleihe_starten uebergeben. |
| `rahmennummer` | `text` | ja |  | Am Rahmen ablesbare Nummer. |
| `typ_id` | `bigint` | ja |  | Schluessel des Fahrradtyps. |
| `typ_code` | `text` | ja |  | CITY, EBIKE oder CARGO. Steuert die Filterung auf der Karte. |
| `typ_bezeichnung` | `text` | ja |  | Name des Typs fuer die Anzeige. |
| `hat_elektro` | `boolean` | ja |  | Wahr bei elektrischer Unterstuetzung. |
| `akkustand_prozent` | `smallint` | ja |  | Ladestand. NULL bei Raedern ohne Akku. |
| `latitude` | `numeric(9,6)` | ja |  | Breitengrad: die eigene Position, ersatzweise die der Station. |
| `longitude` | `numeric(9,6)` | ja |  | Laengengrad: die eigene Position, ersatzweise die der Station. |
| `station_id` | `bigint` | ja |  | Station, an der das Rad steht. NULL bei freiem Abstellort. |
| `station_name` | `text` | ja |  | Name der Station, NULL bei freiem Abstellort. |
| `startgebuehr` | `numeric(10,2)` | ja |  | Heute geltende Startgebuehr. |
| `preis_pro_minute` | `numeric(10,2)` | ja |  | Heute geltendes Minutenentgelt. |
| `tageshoechstpreis` | `numeric(10,2)` | ja |  | Heute geltende Obergrenze je Ausleihe. |
