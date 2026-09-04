# Data Dictionary — Schema `velocity`

Erzeugt aus dem Systemkatalog über `velocity.v_data_dictionary`.
**Nicht von Hand pflegen** — bei Änderungen neu erzeugen:

```bash
python3 db/run.py db/aufbau/0012_dokumentation.sql
python3 tools/data_dictionary.py
```

Die technischen Audit-Spalten `erstellt_am` und `geaendert_am` tragen
bewusst keine Beschreibung: sie bedeuten in jeder Tabelle dasselbe und
werden vom Trigger `trg_<tabelle>_audit` gepflegt. Sie sind die einzigen
Spalten ohne Kommentar; der Test `test_doku_vollstaendig` erzwingt für
alle übrigen einen.

## `adresse` (Tabelle)

Postanschrift. Eigenständige Entität, weil sie von Kunde, Station, Lieferant und Lager gebraucht wird.

| Spalte | Datentyp | NULL | Vorgabe | Beschreibung |
|---|---|---|---|---|
| `adresse_id` | `bigint` | nein |  | Surrogatschlüssel, fachlich bedeutungslos und deshalb stabil. |
| `strasse` | `text` | nein |  | Straßenname ohne Hausnummer. |
| `hausnummer` | `text` | nein | `''::text` | NOT NULL mit Vorgabe leerer Text: in einem UNIQUE-Index gelten zwei NULL-Werte als verschieden, der Fachschlüssel würde sonst keine Dubletten verhindern. |
| `plz` | `text` | nein |  | Postleitzahl. Für land_code DE auf fünf Ziffern geprüft. |
| `ort` | `text` | nein |  | Ortsname. Bewusst NICHT aus der PLZ abgeleitet: in Deutschland ist plz -> ort keine saubere funktionale Abhängigkeit. |
| `land_code` | `character(2)` | nein | `'DE'::bpchar` | Länderkennung nach ISO 3166-1 alpha-2, Vorgabe DE. |
| `erstellt_am` | `timestamp with time zone` | nein | `now()` |  |
| `geaendert_am` | `timestamp with time zone` | nein | `now()` |  |

## `aenderungsprotokoll` (Tabelle)

Feldweise Spur jeder Änderung an protokollierten Tabellen (Art. 5 Abs. 2 DSGVO). Eine Zeile je geändertem Feld, nicht je Anweisung, damit sich die Historie eines einzelnen Feldes ohne Werkzeug herausfiltern lässt. tabelle/datensatz_id sind eine Spur, keine geprüfte Beziehung - wie beleg_tabelle/beleg_id bei fahrrad_ereignis.

| Spalte | Datentyp | NULL | Vorgabe | Beschreibung |
|---|---|---|---|---|
| `protokoll_id` | `bigint` | nein |  | Surrogatschlüssel, fachlich bedeutungslos und deshalb stabil. |
| `zeitpunkt` | `timestamp with time zone` | nein | `now()` | Zeitpunkt der protokollierten Änderung, unabhängig vom technischen erstellt_am dieser Zeile. |
| `mitarbeiter_id` | `bigint` | ja |  | Wer die Änderung ausgelöst hat. NULL, wenn kein angemeldeter Mitarbeiter ermittelbar war, etwa bei einem Wartungsskript - ein erfundener Verursacher wäre schlechter als keiner. |
| `tabelle` | `text` | nein |  | Name der veränderten Tabelle, aus tg_table_name des auslösenden Triggers. Bewusst ohne Fremdschlüssel: der Trigger und diese Tabelle sind für beliebige Zieltabellen gebaut, ein FK könnte nur auf eine einzige davon zeigen. |
| `datensatz_id` | `bigint` | nein |  | Primärschlüsselwert des veränderten Datensatzes in seiner Tabelle. Bewusst ohne Fremdschlüssel, siehe Kommentar an tabelle und an der Tabelle selbst. |
| `aktion` | `text` | nein |  | Art der Änderung: INSERT, UPDATE oder DELETE, siehe aenderungsprotokoll_aktion_chk. |
| `feld` | `text` | nein |  | Name des veränderten Feldes. Eine Zeile je Feld statt ein JSON-Klumpen, damit "wer hat je die E-Mail geändert" ohne Werkzeug beantwortbar bleibt (GR19). |
| `wert_alt` | `text` | ja |  | Wert des Feldes vor der Änderung, als Text. NULL bei INSERT. Text statt Originaltyp, weil ein und derselbe Trigger auf jede Tabelle und jede Spalte passen muss - ein typisierter Wert bräuchte eine eigene Spalte je Datentyp. |
| `wert_neu` | `text` | ja |  | Wert des Feldes nach der Änderung, als Text. NULL bei DELETE. Gleicher Grund wie wert_alt: generischer Typ für einen tabellenunabhängigen Trigger. |
| `erstellt_am` | `timestamp with time zone` | nein | `now()` |  |
| `geaendert_am` | `timestamp with time zone` | nein | `now()` |  |

## `ausleihe` (Tabelle)

Zentraler Geschäftsvorfall: ein Kunde nutzt ein Rad von einem Zeitpunkt bis zu einem anderen.

| Spalte | Datentyp | NULL | Vorgabe | Beschreibung |
|---|---|---|---|---|
| `ausleihe_id` | `bigint` | nein |  | Surrogatschlüssel. |
| `kunde_id` | `bigint` | nein |  | Ausleihender Kunde. |
| `fahrrad_id` | `bigint` | nein |  | Genutztes Rad. Je Rad höchstens eine aktive Ausleihe - Geschäftsregel GR1 über einen partiellen Unique-Index. |
| `mitgliedschaft_id` | `bigint` | ja |  | Die zum Startzeitpunkt gültige Mitgliedschaft, hier festgeschrieben. Ein späterer Tarifwechsel verändert die Bepreisung damit nicht rückwirkend. |
| `start_station_id` | `bigint` | ja |  | Station der Entnahme. NULL, wenn das Rad frei abgestellt war. |
| `start_latitude` | `numeric(9,6)` | ja |  | Breitengrad der Entnahme bei freiem Abstellort. |
| `start_longitude` | `numeric(9,6)` | ja |  | Längengrad der Entnahme bei freiem Abstellort. |
| `startzeit` | `timestamp with time zone` | nein | `now()` | Beginn der Nutzung. Maßgeblich für die Preisfindung - Geschäftsregel GR5. |
| `end_station_id` | `bigint` | ja |  | Station der Rückgabe. NULL bei freiem Abstellen. |
| `end_latitude` | `numeric(9,6)` | ja |  | Breitengrad der Rückgabe bei freiem Abstellort. |
| `end_longitude` | `numeric(9,6)` | ja |  | Längengrad der Rückgabe bei freiem Abstellort. |
| `endzeit` | `timestamp with time zone` | ja |  | Ende der Nutzung. NULL, solange die Ausleihe aktiv ist. |
| `status` | `velocity.ausleihe_status` | nein | `'aktiv'::velocity.ausleihe_status` | aktiv, abgeschlossen oder storniert. Aktiv und Endzeit schließen sich per CHECK gegenseitig aus. |
| `dauer_minuten` | `integer` | ja | `(ceil((EXTRACT(epoch FROM (endzeit - startzeit)) / 60.0)))::integer` | Berechnete Spalte: angefangene Minuten, aufgerundet. Nicht beschreibbar - abgeleitete Werte werden abgeleitet, nicht gepflegt. |
| `erstellt_am` | `timestamp with time zone` | nein | `now()` |  |
| `geaendert_am` | `timestamp with time zone` | nein | `now()` |  |
| `distanz_km` | `numeric(8,2)` | ja |  | Gefahrene Strecke in Kilometern. null bedeutet nicht gemessen, nicht null Kilometer. |

## `entgeltart` (Tabelle)

Klassifikation der Abrechnungspositionen. Referenztabelle statt ENUM, weil sie mit vorzeichen ein eigenes Attribut trägt.

| Spalte | Datentyp | NULL | Vorgabe | Beschreibung |
|---|---|---|---|---|
| `entgeltart_id` | `bigint` | nein |  | Surrogatschlüssel. |
| `code` | `text` | nein |  | Fachlicher Schlüssel, etwa ZEITENTGELT oder FREIMINUTEN. Wird von der Geschäftslogik angesprochen. |
| `bezeichnung` | `text` | nein |  | Text für die Rechnung. |
| `vorzeichen` | `smallint` | nein |  | Plus eins belastet, minus eins entlastet. Bestimmt das Vorzeichen des Betrags in entgeltposition. |
| `erstellt_am` | `timestamp with time zone` | nein | `now()` |  |
| `geaendert_am` | `timestamp with time zone` | nein | `now()` |  |

## `entgeltposition` (Tabelle)

Einzelposition der Abrechnung einer Ausleihe. Macht die Preisfindung Zeile für Zeile nachvollziehbar.

| Spalte | Datentyp | NULL | Vorgabe | Beschreibung |
|---|---|---|---|---|
| `position_id` | `bigint` | nein |  | Surrogatschlüssel. |
| `ausleihe_id` | `bigint` | nein |  | Ausleihe, zu der die Position gehört. |
| `entgeltart_id` | `bigint` | nein |  | Art der Position. Bestimmt über vorzeichen, ob belastet oder entlastet wird. |
| `nutzungspreis_id` | `bigint` | ja |  | Beleg der Preisfindung: welcher Preissatz wurde angewandt. NULL bei Positionen ohne Preisbezug, etwa dem Tarifrabatt. |
| `menge` | `numeric(10,2)` | nein | `1` | Bezugsmenge, beim Zeitentgelt die Anzahl Minuten. |
| `einzelbetrag` | `numeric(10,2)` | nein | `0` | Betrag je Mengeneinheit, immer positiv. |
| `betrag` | `numeric(10,2)` | nein |  | Wirksamer Betrag inklusive Vorzeichen. Die Summe aller Positionen ergibt den Preis der Ausleihe. |
| `sortierung` | `integer` | nein | `0` | Reihenfolge auf der Rechnung: 10 Startgebühr, 20 Zeitentgelt, 30 Freiminuten, 40 Rabatt, 50 Kappung. |
| `erstellt_am` | `timestamp with time zone` | nein | `now()` |  |
| `geaendert_am` | `timestamp with time zone` | nein | `now()` |  |

## `fahrrad` (Tabelle)

Einzelnes physisches Fahrzeug der Flotte, eindeutig über die Rahmennummer.

| Spalte | Datentyp | NULL | Vorgabe | Beschreibung |
|---|---|---|---|---|
| `fahrrad_id` | `bigint` | nein |  | Surrogatschlüssel. |
| `rahmennummer` | `text` | nein |  | Fachlicher Schlüssel, am Rahmen eingeschlagen. |
| `modell_id` | `bigint` | nein |  | Bauart des Rades. |
| `status` | `velocity.fahrrad_status` | nein | `'verfuegbar'::velocity.fahrrad_status` | verfügbar, ausgeliehen, wartung, defekt oder ausgemustert. Nur verfügbare Räder erscheinen auf der Karte. |
| `angeschafft_am` | `date` | ja |  | Datum der Anschaffung. |
| `ausgemustert_am` | `date` | ja |  | Datum der Ausmusterung. NULL, solange das Rad im Bestand ist. |
| `erstellt_am` | `timestamp with time zone` | nein | `now()` |  |
| `geaendert_am` | `timestamp with time zone` | nein | `now()` |  |

## `fahrrad_ereignis` (Tabelle)

Lebenslaufakte eines Rades. beleg_tabelle/beleg_id sind eine Spur, keine geprüfte Beziehung.

| Spalte | Datentyp | NULL | Vorgabe | Beschreibung |
|---|---|---|---|---|
| `ereignis_id` | `bigint` | nein |  | Surrogatschlüssel, fachlich bedeutungslos und deshalb stabil. |
| `fahrrad_id` | `bigint` | nein |  | Das betroffene Rad. on delete cascade, weil ein Ereignis ohne sein Rad keine eigene Bedeutung hat. |
| `zeitpunkt` | `timestamp with time zone` | nein | `now()` | Zeitpunkt des Ereignisses, für die chronologische Lebenslaufakte. |
| `ereignisart` | `velocity.fahrrad_ereignisart` | nein |  | Art des Ereignisses (GR21), etwa Statuswechsel oder Ausmusterung. |
| `mitarbeiter_id` | `bigint` | ja |  | Mitarbeiter, unter dessen Anmeldung das Ereignis entstand. NULL, wenn der Trigger ausläuft, ohne eine passende auth.uid() zu finden - etwa bei einem Lauf als postgres. |
| `bemerkung` | `text` | ja |  | Freitext zum Ereignis, beim Statuswechsel automatisch mit alt -> neu befüllt. |
| `beleg_tabelle` | `text` | ja |  | Name der Tabelle des auslösenden Vorgangs, etwa fahrrad. Bewusst ungeprüft, siehe Kommentar an der Tabelle. |
| `beleg_id` | `bigint` | ja |  | Zeigt auf den auslösenden Vorgang. Bewusst ungeprüft, siehe Kommentar an der Tabelle. |
| `erstellt_am` | `timestamp with time zone` | nein | `now()` |  |
| `geaendert_am` | `timestamp with time zone` | nein | `now()` |  |

## `fahrrad_position` (Tabelle)

Aktueller Standort eines Rades. Als 1:1-Satellit geführt, damit die ständig änderlichen Bewegungsdaten die Stammdaten nicht berühren.

| Spalte | Datentyp | NULL | Vorgabe | Beschreibung |
|---|---|---|---|---|
| `fahrrad_id` | `bigint` | nein |  | Zugleich Primär- und Fremdschlüssel: genau eine Position je Rad. |
| `station_id` | `bigint` | ja |  | NULL bedeutet: das Rad steht frei abgestellt, nicht an einer Station |
| `latitude` | `numeric(9,6)` | ja |  | Breitengrad des freien Abstellorts. Steht das Rad an einer Station, gilt deren Koordinate. |
| `longitude` | `numeric(9,6)` | ja |  | Längengrad des freien Abstellorts. |
| `akkustand_prozent` | `smallint` | ja |  | Ladestand in Prozent. NULL bei Rädern ohne Akku - nicht null, das wäre ein leerer Akku. |
| `aktualisiert_am` | `timestamp with time zone` | nein | `now()` | Fachlicher Zeitpunkt der letzten Ortung. |
| `erstellt_am` | `timestamp with time zone` | nein | `now()` |  |
| `geaendert_am` | `timestamp with time zone` | nein | `now()` |  |

## `fahrradmodell` (Tabelle)

Welcher Hersteller das EINE Produkt eines Typs fertigt, und seit welchem Baujahr. Bindeglied zur Warenwirtschaft: Ersatzteile hängen am Modell, nicht am Einzelrad. Mehrere Zeilen je Typ sind normal und gewollt - ein Verleiher schreibt eine Spezifikation aus und bezieht sie von mehreren Herstellern, verkauft aber ein einziges Produkt (siehe fahrradtyp.bezeichnung, das jede Zeile hier unverändert übernimmt). Technische Angaben stehen deshalb NICHT hier, sondern an fahrradtyp - sie gelten je Spezifikation, nicht je Hersteller.

| Spalte | Datentyp | NULL | Vorgabe | Beschreibung |
|---|---|---|---|---|
| `modell_id` | `bigint` | nein |  | Surrogatschlüssel. |
| `hersteller_id` | `bigint` | nein |  | Produzent, der zur Spezifikation des Typs fertigt. |
| `typ_id` | `bigint` | nein |  | Fachliche Klasse (das Produkt), zu der dieser Hersteller liefert. |
| `modellbezeichnung` | `text` | nein |  | Der Produktname - identisch mit fahrradtyp.bezeichnung des zugehörigen Typs, unabhängig vom Hersteller. Kein eigener Modellname je Hersteller: Kundschaft mietet ein City-Bike, keine Marke. |
| `baujahr` | `integer` | ja |  | Jahr, seit dem dieser Hersteller den Typ beliefert - nicht das Baujahr eines einzelnen Rades, das über mehrere Beschaffungschargen desselben Herstellers variieren kann. |
| `erstellt_am` | `timestamp with time zone` | nein | `now()` |  |
| `geaendert_am` | `timestamp with time zone` | nein | `now()` |  |

## `fahrradtyp` (Tabelle)

Fachliche Klasse eines Rades (City, E-Bike, Cargo) - zugleich das einzige Produkt dieser Klasse. Trägt bewusst keine Preise - die stehen zeitabhängig in nutzungspreis.

| Spalte | Datentyp | NULL | Vorgabe | Beschreibung |
|---|---|---|---|---|
| `typ_id` | `bigint` | nein |  | Surrogatschlüssel. |
| `typ_code` | `text` | nein |  | Fachlicher Schlüssel für die Anwendung: CITY, EBIKE, CARGO. |
| `bezeichnung` | `text` | nein |  | Name auf der Website, etwa E-Cargo Loader. Zugleich der Produktname, den jede Modellzeile in fahrradmodell für diesen Typ trägt - ein Verleiher bietet ein City-Bike an, keine Modellpalette. |
| `beschreibung` | `text` | ja |  | Fließtext für die Tarifkarte. |
| `hat_elektro` | `boolean` | nein | `false` | Wahr bei Pedelec und E-Lastenrad. Steuert die Akkuanzeige auf der Karte. |
| `zuladung_kg` | `integer` | ja |  | Zulässige Zuladung in Kilogramm. |
| `erstellt_am` | `timestamp with time zone` | nein | `now()` |  |
| `geaendert_am` | `timestamp with time zone` | nein | `now()` |  |
| `gewicht_kg` | `numeric(4,1)` | ja |  | Leergewicht in Kilogramm, für jedes Rad dieses Typs gleich - Hersteller fertigen zu dieser Vorgabe, sie handeln sie nicht aus. Ursprünglich an fahrradmodell, auf Kundeneinwand hierher verschoben: unterschiedliche Werte je Modell hätten unterschiedliche Preise verlangt, aber der Tarif hängt am Typ, nicht am Modell. |
| `gangzahl` | `integer` | ja |  | Zahl der Gänge der Schaltung, für jedes Rad dieses Typs gleich. Siehe gewicht_kg zur Begründung, warum das hier steht und nicht an fahrradmodell. |
| `rahmenhoehe_cm` | `integer` | ja |  | Rahmenhöhe in Zentimetern, für jedes Rad dieses Typs dieselbe eine Größe - kein L/XL-Sortiment: ein Leihrad hat eine Rahmengröße, die individuelle Anpassung an die fahrende Person läuft über den Sattel-Schnellspanner, nicht über eine Modellwahl. Siehe gewicht_kg zur Begründung des Spaltenumzugs von fahrradmodell. |
| `akkukapazitaet_wh` | `integer` | ja |  | Kapazität des Akkus in Wattstunden, für jedes Rad dieses Typs gleich. NULL bei einem Typ ohne Elektroantrieb (hat_elektro = falsch). Siehe gewicht_kg zur Begründung des Spaltenumzugs von fahrradmodell. |
| `reichweite_km` | `integer` | ja |  | Herstellerangabe zur Reichweite je Akkuladung in Kilometern, für jedes Rad dieses Typs gleich - beim E-Bike Sport identisch mit der auf der Tarifkarte beworbenen Reichweite bis 50 km (siehe fahrradtyp.beschreibung). NULL bei einem Typ ohne Elektroantrieb. Siehe gewicht_kg zur Begründung des Spaltenumzugs von fahrradmodell. |

## `fahrradtyp_merkmal` (Tabelle)

Werbliche Einzelmerkmale eines Fahrradtyps für die Tarifkarte der Website. Früher fest in index.html kodiert.

| Spalte | Datentyp | NULL | Vorgabe | Beschreibung |
|---|---|---|---|---|
| `merkmal_id` | `bigint` | nein |  | Surrogatschlüssel. |
| `typ_id` | `bigint` | nein |  | Fahrradtyp, für den das Merkmal wirbt. |
| `sortierung` | `integer` | nein |  | Reihenfolge auf der Karte. Je Typ eindeutig. |
| `merkmal` | `text` | nein |  | Der Text des Aufzählungspunkts. |
| `erstellt_am` | `timestamp with time zone` | nein | `now()` |  |
| `geaendert_am` | `timestamp with time zone` | nein | `now()` |  |

## `faq_eintrag` (Tabelle)

Häufig gestellte Frage der Website. Früher fest in index.html kodiert.

| Spalte | Datentyp | NULL | Vorgabe | Beschreibung |
|---|---|---|---|---|
| `faq_id` | `bigint` | nein |  | Surrogatschlüssel. |
| `frage` | `text` | nein |  | Die Frage, zugleich Fachschlüssel: derselbe Wortlaut nur einmal. |
| `antwort` | `text` | nein |  | Die Antwort als Fließtext. |
| `sortierung` | `integer` | nein | `0` | Reihenfolge auf der Seite. |
| `aktiv` | `boolean` | nein | `true` | Nur aktive Einträge erscheinen in v_faq. Zurückgezogene bleiben erhalten. |
| `erstellt_am` | `timestamp with time zone` | nein | `now()` |  |
| `geaendert_am` | `timestamp with time zone` | nein | `now()` |  |

## `freiminuten_periode` (Tabelle)

Monatliches Freiminutenkontingent und dessen Verbrauch. Ersetzt einen mutierenden Zähler, damit der Verlauf rekonstruierbar bleibt.

| Spalte | Datentyp | NULL | Vorgabe | Beschreibung |
|---|---|---|---|---|
| `periode_id` | `bigint` | nein |  | Surrogatschlüssel. |
| `mitgliedschaft_id` | `bigint` | nein |  | Mitgliedschaft, zu der die Periode gehört. |
| `jahr` | `integer` | nein |  | Kalenderjahr der Periode. |
| `monat` | `integer` | nein |  | Kalendermonat der Periode, 1 bis 12. Je Mitgliedschaft und Monat genau eine Zeile. |
| `kontingent_minuten` | `integer` | nein | `0` | Gutgeschriebene Freiminuten des Monats. Der Bestand. |
| `verbraucht_minuten` | `integer` | nein | `0` | Bereits verrechnete Freiminuten. Die Bewegung. Kann das Kontingent nie übersteigen. |
| `erstellt_am` | `timestamp with time zone` | nein | `now()` |  |
| `geaendert_am` | `timestamp with time zone` | nein | `now()` |  |

## `geschaeftsgebiet` (Tabelle)

Fläche, innerhalb derer ein Rad überall abgestellt werden darf. Stand früher fest im JavaScript der Karte - eine Regel ohne Durchsetzung.

| Spalte | Datentyp | NULL | Vorgabe | Beschreibung |
|---|---|---|---|---|
| `gebiet_id` | `bigint` | nein |  | Surrogatschlüssel. |
| `name` | `text` | nein |  | Name des Gebiets, zugleich Fachschlüssel. |
| `flaeche` | `polygon` | nein |  | Das Vieleck als eingebauter Typ polygon, in der Reihenfolge (Längengrad, Breitengrad). Punkt-in-Fläche prüft der Operator @>; PostGIS wird dafür nicht gebraucht. |
| `aktiv` | `boolean` | nein | `true` | Nur aktive Gebiete gelten. |
| `erstellt_am` | `timestamp with time zone` | nein | `now()` |  |
| `geaendert_am` | `timestamp with time zone` | nein | `now()` |  |

## `hersteller` (Tabelle)

Produzent eines Fahrradmodells.

| Spalte | Datentyp | NULL | Vorgabe | Beschreibung |
|---|---|---|---|---|
| `hersteller_id` | `bigint` | nein |  | Surrogatschlüssel. |
| `name` | `text` | nein |  | Firmenname, eindeutig. Bis zur Bereinigung in db/betrieb/flottenmodelle_stammdaten.sql kennzeichnete der Wert unbekannt Sätze aus der Datenübernahme ohne Herstellerangabe - dieser Platzhalter kommt im heutigen Bestand nicht mehr vor. |
| `erstellt_am` | `timestamp with time zone` | nein | `now()` |  |
| `geaendert_am` | `timestamp with time zone` | nein | `now()` |  |

## `hoehenmarke` (Tabelle)

Markante Höhen rund um Würzburg als Bezugspunkte der Höhengrafik. Keine Stationen, aber Redaktionsinhalt - deshalb in der Datenbank und nicht im Frontend.

| Spalte | Datentyp | NULL | Vorgabe | Beschreibung |
|---|---|---|---|---|
| `marke_id` | `bigint` | nein |  | Surrogatschlüssel. |
| `name` | `text` | nein |  | Name der Höhe, zugleich Fachschlüssel. |
| `hoehe_m` | `integer` | nein |  | Höhe in Metern, bestimmt wie station.hoehe_m gegen zwei Geländemodelle und gemittelt. Genommen wurde das Maximum eines Rasters um den Ort - der Gipfel, nicht ein Punkt am Hang. |
| `latitude` | `numeric(9,6)` | ja |  | Breitengrad des gemessenen Punktes. |
| `longitude` | `numeric(9,6)` | ja |  | Längengrad des gemessenen Punktes. |
| `quelle` | `text` | nein |  | Herkunft des Höhenwerts, für die Bildunterschrift. |
| `sortierung` | `integer` | nein |  | Reihenfolge in der Grafik, absteigend nach Höhe. |
| `erstellt_am` | `timestamp with time zone` | nein | `now()` |  |
| `geaendert_am` | `timestamp with time zone` | nein | `now()` |  |

## `kennzahl` (Tabelle)

Kennzahl der Kopfleiste. Entweder mit festem Anzeigewert oder berechnet.

| Spalte | Datentyp | NULL | Vorgabe | Beschreibung |
|---|---|---|---|---|
| `kennzahl_id` | `bigint` | nein |  | Surrogatschlüssel. |
| `schluessel` | `text` | nein |  | Fachlicher Schlüssel, den die Sicht v_kennzahl für berechnete Werte auswertet. |
| `anzeigewert` | `text` | ja |  | Fester Text, etwa 24/7. NULL bei berechneten Kennzahlen. |
| `label` | `text` | nein |  | Beschriftung unter dem Wert. |
| `sortierung` | `integer` | nein | `0` | Reihenfolge in der Kopfleiste. |
| `ist_berechnet` | `boolean` | nein | `false` | Wahr, wenn der Wert zur Laufzeit ermittelt wird statt aus anzeigewert zu stammen. |
| `erstellt_am` | `timestamp with time zone` | nein | `now()` |  |
| `geaendert_am` | `timestamp with time zone` | nein | `now()` |  |

## `kunde` (Tabelle)

Geschäftspartner auf der Nachfrageseite. Die Anmeldung liegt bei Supabase Auth, hier steht kein Passwort.

| Spalte | Datentyp | NULL | Vorgabe | Beschreibung |
|---|---|---|---|---|
| `kunde_id` | `bigint` | nein |  | Surrogatschlüssel. |
| `kundennummer` | `text` | nein | `('K-'::text \|\| lpad((nextval('velocity.seq_kundennummer'::regclass))::text, 6, '0'::text))` | Fachlicher Schlüssel im Format K-000000, nach außen kommunizierbar. Wird aus seq_kundennummer vergeben. |
| `auth_uid` | `uuid` | ja |  | Verbindung zum Anmeldekonto in auth.users. NULL bei Konten ohne Login, etwa aus der Datenübernahme. |
| `email` | `text` | nein |  | Eindeutige Kontaktadresse, zugleich Verknüpfungsmerkmal zum Anmeldekonto. |
| `anrede` | `text` | ja |  | Freitext für die Anschrift, keine geschlossene Werteliste. |
| `vorname` | `text` | nein |  | Vorname laut Selbstauskunft. |
| `nachname` | `text` | nein |  | Nachname laut Selbstauskunft. |
| `geburtsdatum` | `date` | ja |  | Grundlage der Altersgrenze von 16 Jahren. Geprüft in api_profil_aktualisieren, nicht per CHECK: eine Bedingung mit current_date wäre nicht immutable. |
| `telefon` | `text` | ja |  | Rufnummer, unformatiert gespeichert. |
| `rechnungsadresse_id` | `bigint` | ja |  | Anschrift für die Rechnungsstellung. NULL, solange keine hinterlegt ist. |
| `status` | `velocity.kunde_status` | nein | `'aktiv'::velocity.kunde_status` | aktiv, gesperrt oder geschlossen. Nur aktive Kunden dürfen ausleihen. |
| `registriert_am` | `timestamp with time zone` | nein | `now()` | Fachlicher Zeitpunkt der Anmeldung, unabhängig von der technischen Audit-Spalte. |
| `erstellt_am` | `timestamp with time zone` | nein | `now()` |  |
| `geaendert_am` | `timestamp with time zone` | nein | `now()` |  |
| `zeigt_preisschaetzer` | `boolean` | nein | `true` | Zeigt die App auf den Radkacheln den Knopf fuer die Preisschaetzung? Voreinstellung an, seit dem 03.09.2026. Die Einstellung haengt am Konto, nicht am Geraet - der Auftraggeber wollte den Vergleich mit und ohne Modell ueber Geraete hinweg vorfuehren koennen. Bis zum 03.09.2026 stand die Voreinstellung auf aus; damit hatten 1013 von 1014 Konten den Schaetzer abgeschaltet, ohne es je entschieden zu haben, und abgemeldet war er im Frontend fest aus. Der Vergleich ist weiterhin moeglich - man legt den Schalter jetzt zum Abschalten um. |

## `mitarbeiter` (Tabelle)

Person, die die Warenwirtschaft bedient. Anders als kunde keine Vertragsbeziehung, sondern eine oder mehrere Rollen über mitarbeiter_rolle.

| Spalte | Datentyp | NULL | Vorgabe | Beschreibung |
|---|---|---|---|---|
| `mitarbeiter_id` | `bigint` | nein |  | Surrogatschlüssel, fachlich bedeutungslos und deshalb stabil. |
| `personalnummer` | `text` | nein |  | Fachlicher Schlüssel der Personalverwaltung, unabhängig vom Anmeldekonto. |
| `auth_uid` | `uuid` | ja |  | Verknüpfung zur Anmeldung. Leer, solange sich die Person nie angemeldet hat. |
| `vorname` | `text` | nein |  | Vorname laut Personalakte. |
| `nachname` | `text` | nein |  | Nachname laut Personalakte. |
| `email` | `text` | nein |  | Dienstliche Kontaktadresse, zugleich eindeutiges Merkmal für die Anmeldung. |
| `eingetreten_am` | `date` | nein | `CURRENT_DATE` | Datum des Diensteintritts. Bezugspunkt von mitarbeiter_austritt_chk, das ein Austrittsdatum davor abweist. |
| `ausgetreten_am` | `date` | ja |  | Datum des Ausscheidens. NULL, solange die Person aktiv oder beurlaubt ist; Pflicht sobald status = ausgeschieden (GR16, siehe mitarbeiter_ausgeschieden_chk). |
| `status` | `velocity.mitarbeiter_status` | nein | `'aktiv'::velocity.mitarbeiter_status` | aktiv, beurlaubt oder ausgeschieden. Erst der Status entscheidet über den Zugriff, das Austrittsdatum allein würde nicht reichen (GR16). |
| `erstellt_am` | `timestamp with time zone` | nein | `now()` |  |
| `geaendert_am` | `timestamp with time zone` | nein | `now()` |  |

## `mitarbeiter_rolle` (Tabelle)

Zuordnung m:n. Abweichung vom Entwurf aus Phase 1, begründet mit Datenminimierung.

| Spalte | Datentyp | NULL | Vorgabe | Beschreibung |
|---|---|---|---|---|
| `mitarbeiter_id` | `bigint` | nein |  | Hälfte des zusammengesetzten Schlüssels: welcher Mitarbeiter die Rolle hat. |
| `rolle_id` | `bigint` | nein |  | Hälfte des zusammengesetzten Schlüssels: welche Rolle zugeordnet ist. |
| `erstellt_am` | `timestamp with time zone` | nein | `now()` |  |
| `geaendert_am` | `timestamp with time zone` | nein | `now()` |  |

## `mitgliedschaft` (Tabelle)

Einschreibung eines Kunden in einen Tarif für einen Zeitraum. Je Kunde nie zwei gleichzeitig.

| Spalte | Datentyp | NULL | Vorgabe | Beschreibung |
|---|---|---|---|---|
| `mitgliedschaft_id` | `bigint` | nein |  | Surrogatschlüssel. Wird beim Start einer Ausleihe dort festgeschrieben. |
| `kunde_id` | `bigint` | nein |  | Eingeschriebener Kunde. |
| `tarif_id` | `bigint` | nein |  | Gewählter Tarif. |
| `gueltigkeit` | `daterange` | nein |  | Halboffener Zeitraum. Je Kunde überschneidungsfrei - Geschäftsregel GR3, von der Datenbank erzwungen. |
| `erstellt_am` | `timestamp with time zone` | nein | `now()` |  |
| `geaendert_am` | `timestamp with time zone` | nein | `now()` |  |

## `nutzungspreis` (Tabelle)

Zeitabhängiger Preis je Fahrradtyp. Bepreist wird mit dem zum Startzeitpunkt der Ausleihe gültigen Satz.

| Spalte | Datentyp | NULL | Vorgabe | Beschreibung |
|---|---|---|---|---|
| `preis_id` | `bigint` | nein |  | Surrogatschlüssel. Wird in entgeltposition als Beleg der Preisfindung hinterlegt. |
| `typ_id` | `bigint` | nein |  | Fahrradtyp, für den der Preis gilt. |
| `gueltigkeit` | `daterange` | nein |  | Halboffener Zeitraum, je Typ überschneidungsfrei. Deshalb bleiben Altrechnungen nachvollziehbar bewertet. |
| `startgebuehr` | `numeric(10,2)` | nein |  | Einmaliges Entgelt je Ausleihe in Euro. |
| `preis_pro_minute` | `numeric(10,2)` | nein |  | Entgelt je angefangener Minute in Euro. |
| `tageshoechstpreis` | `numeric(10,2)` | nein |  | Obergrenze je Ausleihe. Wird nach dem Tarifrabatt angewandt. |
| `erstellt_am` | `timestamp with time zone` | nein | `now()` |  |
| `geaendert_am` | `timestamp with time zone` | nein | `now()` |  |

## `nutzungsschritt` (Tabelle)

Ein Schritt der Anleitung "So einfach geht es" auf der Website.

| Spalte | Datentyp | NULL | Vorgabe | Beschreibung |
|---|---|---|---|---|
| `schritt_id` | `bigint` | nein |  | Surrogatschlüssel. |
| `nummer` | `integer` | nein |  | Position in der Abfolge, zugleich Fachschlüssel. |
| `titel` | `text` | nein |  | Überschrift der Karte. |
| `beschreibung` | `text` | nein |  | Erläuternder Text. |
| `erstellt_am` | `timestamp with time zone` | nein | `now()` |  |
| `geaendert_am` | `timestamp with time zone` | nein | `now()` |  |

## `ort_koordinate` (Tabelle)

Koordinaten je Ortsname, fuer die schematische Landkarte der Stationen (Gestaltungsauftrag Stationen, Punkt 4). Enthaelt genau die Orte, die unter velocity.adresse.ort in dieser Datenbank tatsaechlich vorkommen (siehe Kopfkommentar). Werte aus OpenStreetMap/Nominatim (Ortszentrum), nicht geschaetzt - "pruef sie, statt sie zu raten" (Auftrag, woertlich).

| Spalte | Datentyp | NULL | Vorgabe | Beschreibung |
|---|---|---|---|---|
| `ort` | `text` | nein |  | Ortsname, wortgleich zu velocity.adresse.ort - der Join-Schluessel zu v_wawi_kundenorte. |
| `latitude` | `numeric(9,6)` | nein |  | Breitengrad des Ortszentrums. |
| `longitude` | `numeric(9,6)` | nein |  | Laengengrad des Ortszentrums. |

## `preisschaetzung` (Tabelle)

Ergebnis der Quantilregression aus analytics/notebooks/01_Regression_Fahrtdauer.ipynb: je Verbindung, Radtyp und Tageszeit eine Preisspanne. Enthaelt NUR die freigegebenen Kombinationen - mindestens 30 Fahrten als Grundlage, hoechstens 12 Minuten Spannbreite und hoechstens 60 Prozent der Preismitte. Was fehlt, wird in der App nicht angezeigt.

| Spalte | Datentyp | NULL | Vorgabe | Beschreibung |
|---|---|---|---|---|
| `schaetzung_id` | `bigint` | nein |  | Technischer Schluessel. Fachlich identifiziert wird eine Zeile ueber Startstation, Zielstation, Radtyp und Zeitfenster. |
| `startstation` | `text` | nein |  | Name der Station, an der die Fahrt beginnt - so, wie er in velocity.station steht. Bewusst der Name und nicht die ID: Die Tabelle kommt aus einem Notebook, das mit Namen arbeitet, und sie soll ohne Nachschlagen lesbar sein. |
| `zielstation` | `text` | nein |  | Name der vom Kunden gewaehlten Zielstation. Nie gleich der Startstation - fuer Rundfahrten gibt es keine Schaetzung. |
| `typ_code` | `text` | nein |  | Fahrradtyp, fuer den die Spanne gilt. Der Minutenpreis unterscheidet sich je Typ, also auch die Euro-Spanne. |
| `zeitfenster` | `text` | nein |  | frueh (5-10), vormittag (10-15), nachmittag (15-20), abend (20-24). Grober als die Stunde, weil eine Spanne je Stunde auf zu wenigen Fahrten beruhen wuerde. |
| `minuten_von` | `integer` | nein |  | Untere Grenze der geschaetzten Dauer, aus dem 10-Prozent-Quantil der vergleichbaren Fahrten. |
| `minuten_bis` | `integer` | nein |  | Obere Grenze der geschaetzten Dauer, aus dem 90-Prozent-Quantil. Zusammen decken die beiden Grenzen rund 80 Prozent der tatsaechlichen Fahrten ab. |
| `preis_von` | `numeric(6,2)` | nein |  | Untere Grenze der angezeigten Spanne in Euro, aus dem 10-Prozent-Quantil der Dauer ueber das Tarifblatt gerechnet. ACHTUNG: Aendert sich der Minutenpreis, ist diese Spalte falsch - Tabelle neu laden. |
| `preis_bis` | `numeric(6,2)` | nein |  | Obere Grenze der angezeigten Spanne in Euro. Die Differenz zu preis_von ist per CHECK auf einen Euro begrenzt - eine breitere Spanne ist ehrlich, aber zum Planen unbrauchbar. |
| `fahrten_grundlage` | `integer` | nein |  | Zahl der vergleichbaren Fahrten, auf denen die Spanne beruht. Wird in der App genannt, damit die Schaetzung nachvollziehbar bleibt. |
| `stand` | `date` | nein | `CURRENT_DATE` | Wann die Zeile berechnet wurde. Aeltere Staende sind ein Grund, die Tabelle neu zu laden - vor allem nach einer Tarifaenderung. |
| `erstellt_am` | `timestamp with time zone` | nein | `now()` |  |
| `geaendert_am` | `timestamp with time zone` | nein | `now()` |  |
| `start_station_id` | `bigint` | ja |  | Startstation als ID - der stabile Schluessel. Namen aendern sich, IDs nicht. |
| `ziel_station_id` | `bigint` | ja |  | Zielstation als ID. Die Namensspalten daneben sind fuer die Anzeige, nicht zum Verknuepfen. |

## `rechenannahme` (Tabelle)

Zahlen, die eine Auswertung annimmt statt sie zu messen. Jede nennt ihre Quelle.

| Spalte | Datentyp | NULL | Vorgabe | Beschreibung |
|---|---|---|---|---|
| `annahme_id` | `bigint` | nein |  | Surrogatschlüssel, fachlich bedeutungslos und deshalb stabil. |
| `code` | `text` | nein |  | Fachlicher Bezeichner der Annahme, etwa co2_pkw oder umwegfaktor. Auswertungen suchen darüber, nicht über den Surrogatschlüssel. |
| `wert` | `numeric(12,4)` | nein |  | Der angenommene Zahlenwert in der angegebenen Einheit. |
| `einheit` | `text` | nein |  | Einheit von wert, etwa g CO2e/Pkm, damit der Wert ohne Rückfrage einzuordnen ist. |
| `gueltigkeit` | `daterange` | nein |  | Zeitraum, für den dieser Wert gilt. Überschneidungsfrei je code erzwungen durch rechenannahme_zeitraum_ex, damit eine Auswertung zu jedem Tag genau einen Wert findet. |
| `quelle` | `text` | nein |  | Pflichtangabe. Eine Annahme ohne Herkunft ist eine Behauptung. |
| `erlaeuterung` | `text` | ja |  | Freitext, was der Wert genau umfasst, etwa ob eine Vorkette eingerechnet ist. |
| `erstellt_am` | `timestamp with time zone` | nein | `now()` |  |
| `geaendert_am` | `timestamp with time zone` | nein | `now()` |  |

## `rechnung` (Tabelle)

Monatlicher Beleg je Kunde über die Ausleihen einer Abrechnungsperiode.

| Spalte | Datentyp | NULL | Vorgabe | Beschreibung |
|---|---|---|---|---|
| `rechnung_id` | `bigint` | nein |  | Surrogatschlüssel. |
| `rechnungsnummer` | `text` | nein |  | Fachlicher Schlüssel, fortlaufend und nach außen kommuniziert. |
| `kunde_id` | `bigint` | nein |  | Rechnungsempfänger. |
| `periode_jahr` | `integer` | nein |  | Jahr der Abrechnungsperiode. |
| `periode_monat` | `integer` | nein |  | Monat der Abrechnungsperiode. Je Kunde und Periode genau eine Rechnung - Geschäftsregel GR10. |
| `erstellt_am_beleg` | `timestamp with time zone` | nein | `now()` | Fachliches Belegdatum. Bewusst anders benannt als die technische Audit-Spalte erstellt_am. |
| `betrag_netto` | `numeric(10,2)` | nein | `0` | Summe der Positionen ohne Umsatzsteuer. |
| `ust_satz` | `numeric(5,2)` | nein | `19.00` | Angewandter Umsatzsteuersatz in Prozent, zum Belegzeitpunkt festgeschrieben. |
| `ust_betrag` | `numeric(10,2)` | nein | `0` | Betrag der Umsatzsteuer. |
| `betrag_brutto` | `numeric(10,2)` | nein | `0` | Zahlbetrag einschließlich Umsatzsteuer. |
| `status` | `velocity.rechnung_status` | nein | `'entwurf'::velocity.rechnung_status` | entwurf, gestellt, bezahlt oder storniert. |
| `erstellt_am` | `timestamp with time zone` | nein | `now()` |  |
| `geaendert_am` | `timestamp with time zone` | nein | `now()` |  |

## `rechnungsposition` (Tabelle)

Einzelposten einer Rechnung, in der Regel genau eine Ausleihe.

| Spalte | Datentyp | NULL | Vorgabe | Beschreibung |
|---|---|---|---|---|
| `rechnungsposition_id` | `bigint` | nein |  | Surrogatschlüssel. |
| `rechnung_id` | `bigint` | nein |  | Rechnungskopf. |
| `position_nr` | `integer` | nein |  | Laufende Nummer auf dem Beleg. Je Rechnung eindeutig. |
| `ausleihe_id` | `bigint` | ja |  | Abgerechnete Ausleihe. NULL bei Positionen ohne Nutzungsbezug, etwa einer Gutschrift nach einer Beschwerde. |
| `beschreibung` | `text` | nein |  | Text auf dem Beleg. |
| `betrag` | `numeric(10,2)` | nein |  | Betrag der Position. |
| `erstellt_am` | `timestamp with time zone` | nein | `now()` |  |
| `geaendert_am` | `timestamp with time zone` | nein | `now()` |  |

## `rolle` (Tabelle)

Fachliche Klassifikation von Aufgabenbereichen. Tabelle statt ENUM, weil ihr später Rechte angehängt werden - siehe Kommentar am create table.

| Spalte | Datentyp | NULL | Vorgabe | Beschreibung |
|---|---|---|---|---|
| `rolle_id` | `bigint` | nein |  | Surrogatschlüssel, fachlich bedeutungslos und deshalb stabil. |
| `code` | `text` | nein |  | Fachlicher Schlüssel, in Code und Policies referenzierbar - anders als bezeichnung, die sich ändern darf, ohne dass etwas bricht. |
| `bezeichnung` | `text` | nein |  | Anzeigename der Rolle in der Oberfläche. |
| `beschreibung` | `text` | ja |  | Erläutert den Aufgabenzuschnitt der Rolle. Optional, weil nicht jede künftige Rolle Erklärungsbedarf hat. |
| `erstellt_am` | `timestamp with time zone` | nein | `now()` |  |
| `geaendert_am` | `timestamp with time zone` | nein | `now()` |  |

## `schadensmeldung` (Tabelle)

Meldung eines Schadens an einem Rad, Ausgangspunkt der Instandhaltung. Genau ein Melder je Meldung, siehe schadensmeldung_melder_chk.

| Spalte | Datentyp | NULL | Vorgabe | Beschreibung |
|---|---|---|---|---|
| `schadensmeldung_id` | `bigint` | nein |  | Surrogatschlüssel, fachlich bedeutungslos und deshalb stabil. |
| `fahrrad_id` | `bigint` | nein |  | Das gemeldete Rad. |
| `gemeldet_am` | `timestamp with time zone` | nein | `now()` | Zeitpunkt der Meldung, unabhängig vom technischen erstellt_am. |
| `melder_kunde_id` | `bigint` | ja |  | Meldender Kunde. Gesetzt oder melder_mitarbeiter_id, nie beide (schadensmeldung_melder_chk) - sonst wüsste niemand, wen man zur Nachfrage anspricht. |
| `melder_mitarbeiter_id` | `bigint` | ja |  | Meldender Mitarbeiter, etwa nach einer Sichtprüfung in der Werkstatt. Gesetzt oder melder_kunde_id, nie beide. |
| `kategorie` | `text` | nein |  | Freitextliche Grobeinordnung des Schadens, etwa Bremse oder Licht. Keine feste Liste, weil sich Schadensbilder nicht sauber vorab abschliessen lassen. |
| `beschreibung` | `text` | nein |  | Freitext des Melders, was am Rad auffiel. |
| `schwere` | `velocity.schaden_schwere` | nein |  | Einordnung der Dringlichkeit; fahruntauglich sperrt das Rad faktisch für die Werkstattplanung, ohne dass diese Tabelle den Fahrradstatus selbst setzt. |
| `status` | `velocity.schaden_status` | nein | `'offen'::velocity.schaden_status` | Bearbeitungsstand der Meldung, unabhängig vom Status des zugehörigen Wartungsauftrags. |
| `erstellt_am` | `timestamp with time zone` | nein | `now()` |  |
| `geaendert_am` | `timestamp with time zone` | nein | `now()` |  |

## `station` (Tabelle)

Fester Standort mit Stellplätzen, an dem Räder entliehen und abgestellt werden.

| Spalte | Datentyp | NULL | Vorgabe | Beschreibung |
|---|---|---|---|---|
| `station_id` | `bigint` | nein |  | Surrogatschlüssel. |
| `stationsnummer` | `text` | nein |  | Fachlicher Schlüssel im Format S-0000. |
| `name` | `text` | nein |  | Anzeigename auf der Karte, etwa Hauptbahnhof. |
| `adresse_id` | `bigint` | nein |  | Anschrift der Station. |
| `latitude` | `numeric(9,6)` | ja |  | Breitengrad in Dezimalgrad, WGS 84. |
| `longitude` | `numeric(9,6)` | ja |  | Längengrad in Dezimalgrad, WGS 84. |
| `kapazitaet` | `integer` | nein |  | Anzahl der Stellplätze, muss größer als null sein. |
| `betriebszeitraum` | `daterange` | nein | `daterange(CURRENT_DATE, NULL::date, '[)'::text)` | Zeitraum, in dem die Station betrieben wird. Halboffen; nach oben offen bedeutet: weiterhin in Betrieb. |
| `erstellt_am` | `timestamp with time zone` | nein | `now()` |  |
| `geaendert_am` | `timestamp with time zone` | nein | `now()` |  |
| `hoehe_m` | `integer` | ja |  | Höhenlage in Metern, aus den Koordinaten gegen zwei unabhängige Geländemodelle bestimmt (Copernicus GLO-30 und EU-DEM v1.1) und gemittelt. Beides sind Oberflächenmodelle: in bebautem Gebiet liegen sie rund zehn Meter zu hoch. Belastbar sind deshalb die Unterschiede, nicht die absoluten Werte - und genau die Unterschiede trägt die Anwendung vor. Gesetzt in db/betrieb/stationslage_korrigieren.sql. |

## `tarif` (Tabelle)

Preismodell, in das sich ein Kunde einschreiben kann.

| Spalte | Datentyp | NULL | Vorgabe | Beschreibung |
|---|---|---|---|---|
| `tarif_id` | `bigint` | nein |  | Surrogatschlüssel. |
| `tarif_code` | `text` | nein |  | Fachlicher Schlüssel: BASIS, STUDENT, OEPNV, PREMIUM. |
| `bezeichnung` | `text` | nein |  | Name auf der Website. |
| `art` | `velocity.tarifart` | nein | `'standard'::velocity.tarifart` | standard oder vorteil. Vorteilstarife setzen einen Nachweis voraus. |
| `voraussetzung` | `text` | ja |  | Nachweis, den der Kunde erbringen muss, etwa ein Studierendenausweis. |
| `erstellt_am` | `timestamp with time zone` | nein | `now()` |  |
| `geaendert_am` | `timestamp with time zone` | nein | `now()` |  |

## `tarif_kondition` (Tabelle)

Zeitabhängige Konditionen eines Tarifs. Überschneidungsfrei durch EXCLUDE-Constraint.

| Spalte | Datentyp | NULL | Vorgabe | Beschreibung |
|---|---|---|---|---|
| `kondition_id` | `bigint` | nein |  | Surrogatschlüssel. |
| `tarif_id` | `bigint` | nein |  | Tarif, für den die Kondition gilt. |
| `gueltigkeit` | `daterange` | nein |  | Halboffener Zeitraum. Je Tarif überschneidungsfrei: eine Preisänderung legt einen neuen Zeitraum an, statt den alten zu überschreiben. |
| `freiminuten_pro_monat` | `integer` | nein | `0` | Monatliches Kontingent, das in freiminuten_periode gutgeschrieben wird. |
| `rabatt_prozent` | `numeric(5,2)` | nein | `0` | Nachlass auf die Zwischensumme einer Ausleihe. Wirkt VOR der Kappung auf den Tageshöchstpreis. |
| `erstellt_am` | `timestamp with time zone` | nein | `now()` |  |
| `geaendert_am` | `timestamp with time zone` | nein | `now()` |  |

## `uebernahme_protokoll` (Tabelle)

Protokoll der einmaligen Übernahme aus dem Altschema cityBikesRental.

| Spalte | Datentyp | NULL | Vorgabe | Beschreibung |
|---|---|---|---|---|
| `protokoll_id` | `bigint` | nein |  | Surrogatschlüssel. |
| `lauf` | `timestamp with time zone` | nein | `now()` | Zeitstempel des Übernahmelaufs. Gleicher Wert für alle Zeilen eines Laufs. |
| `quelle` | `text` | nein |  | Gelesene Tabelle im Altschema. |
| `ziel` | `text` | nein |  | Beschriebene Tabelle im Schema velocity. |
| `gelesen` | `integer` | nein | `0` | Anzahl der Sätze in der Quelle. |
| `geschrieben` | `integer` | nein | `0` | Anzahl der tatsächlich neu angelegten Sätze. |
| `uebersprungen` | `integer` | nein | `0` | Anzahl der bewusst ausgelassenen Sätze. |
| `hinweis` | `text` | ja |  | Begründung für Abweichungen und getroffene Annahmen. |
| `erstellt_am` | `timestamp with time zone` | nein | `now()` |  |
| `geaendert_am` | `timestamp with time zone` | nein | `now()` |  |

## `wartungsauftrag` (Tabelle)

Arbeitsauftrag der Werkstatt: eine Reparatur nach Schadensmeldung oder eine geplante Inspektion ohne Anlass.

| Spalte | Datentyp | NULL | Vorgabe | Beschreibung |
|---|---|---|---|---|
| `wartungsauftrag_id` | `bigint` | nein |  | Surrogatschlüssel, fachlich bedeutungslos und deshalb stabil. |
| `auftragsnummer` | `text` | nein |  | Fachlicher, in der Werkstatt gesprochener Schlüssel - eindeutig über wartungsauftrag_nummer_uk, damit ein Zuruf wie "Auftrag WA-..." keine Verwechslung zulässt. |
| `fahrrad_id` | `bigint` | nein |  | Das Rad, an dem gearbeitet wird. |
| `schadensmeldung_id` | `bigint` | ja |  | Auslösende Meldung. NULL bei einer geplanten Inspektion ohne konkreten Schaden. |
| `mitarbeiter_id` | `bigint` | ja |  | Zuständiger Werkstattmitarbeiter. NULL, solange der Auftrag noch niemandem zugeteilt ist. |
| `eroeffnet_am` | `timestamp with time zone` | nein | `now()` | Zeitpunkt der Auftragseröffnung. Bezugspunkt von wartungsauftrag_zeitfolge_chk. |
| `erledigt_am` | `timestamp with time zone` | ja |  | Zeitpunkt des Abschlusses. Pflicht sobald status = erledigt (wartungsauftrag_erledigt_chk), sonst liesse sich die Durchlaufzeit nicht auswerten. |
| `status` | `velocity.auftrag_status` | nein | `'offen'::velocity.auftrag_status` | Bearbeitungsstand des Auftrags. |
| `arbeitszeit_minuten` | `integer` | ja |  | Aufgewendete Werkstattzeit in Minuten, für die Nachkalkulation. Optional, solange der Auftrag läuft. |
| `bemerkung` | `text` | ja |  | Freitext der Werkstatt zum Auftrag, etwa verbaute Ersatzteile ohne eigenen Lagerbezug. |
| `erstellt_am` | `timestamp with time zone` | nein | `now()` |  |
| `geaendert_am` | `timestamp with time zone` | nein | `now()` |  |

## `wartungsprognose` (Tabelle)

Eingefrorene Prüfliste der Werkstatt zu einem Stichtag: je Zeile ein Rad mit seinem Platz. Wird nicht neu berechnet, damit sie nach Ablauf von gilt_bis nachprüfbar bleibt. Siehe Kopfkommentar von 0021_wartungsprognose.sql.

| Spalte | Datentyp | NULL | Vorgabe | Beschreibung |
|---|---|---|---|---|
| `wartungsprognose_id` | `bigint` | nein |  | Surrogatschlüssel, fachlich bedeutungslos und deshalb stabil. |
| `stichtag` | `date` | nein |  | Tag, für den die Liste gerechnet wurde. Zusammen mit rang bzw. fahrrad_id eindeutig. |
| `fahrrad_id` | `bigint` | nein |  | Das Rad, das geprüft werden soll. |
| `rang` | `integer` | nein |  | Platz auf der Liste, 1 = zuerst prüfen. Ergibt sich aus nutzungsquote, absteigend. |
| `nutzungsquote` | `numeric(8,3)` | nein |  | Der Rangwert: Fahrminuten seit der letzten Reparatur, geteilt durch den Median des Radtyps. 1,4 heißt "40 % mehr gearbeitet als ein durchschnittliches Rad seiner Art". Ohne diese Normierung rangiert die Liste den Typ statt das Rad, siehe Kopfkommentar. |
| `fahrminuten_seit_reparatur` | `numeric(12,1)` | nein |  | Summe der Fahrminuten seit der letzten ERLEDIGTEN Reparatur, je Fahrt bei 300 Minuten gekappt. Nicht seit der Meldung: zwischen Meldung und Reparatur wird weitergefahren, und diese Zeit geht auf das alte Bauteil. |
| `typ_median_minuten` | `numeric(12,1)` | nein |  | Der Nenner der nutzungsquote: Median derselben Größe über alle Räder dieses Typs. Mitgespeichert, damit die Quote später nachrechenbar bleibt. |
| `fahrten_seit_reparatur` | `integer` | nein |  | Zahl der Fahrten seit der letzten erledigten Reparatur - sagt, auf wievielen Fahrten die Fahrminuten beruhen. |
| `fahrminuten_180` | `numeric(12,1)` | nein |  | Fahrminuten der letzten 180 Tage, unabhängig von der Reparatur. Zeigt, ob ein Rad gerade viel läuft oder seine Minuten aus einer älteren Phase stammen. |
| `km_gemessen` | `numeric(12,2)` | ja |  | Gemessene Kilometer im selben Zeitraum - Zusatzangabe, nicht der Rangwert. Unvollständig, deshalb steht anteil_mit_distanz daneben. |
| `anteil_mit_distanz` | `numeric(4,3)` | ja |  | Anteil der Fahrten seit der letzten Reparatur, die eine Strecke gemeldet haben. Sagt, wieviel km_gemessen wert ist. |
| `letzte_reparatur` | `date` | ja |  | Tag der letzten erledigten Reparatur, NULL wenn das Rad noch nie repariert wurde. |
| `meldungen_bisher` | `integer` | nein | `0` | Zahl der bisherigen Schadensmeldungen dieses Rades bis zum Stichtag. |
| `regelversion` | `text` | nein |  | Welche Regel die Reihenfolge bestimmt hat. Ändert sich die Regel, ändert sich dieser Wert - alte Listen bleiben damit lesbar. |
| `gilt_bis` | `date` | nein |  | Ende des Vorhersagefensters. Erst danach lässt sich die Liste an dem messen, was tatsächlich eingetreten ist. |
| `betriebsmodus` | `text` | nein | `'probelauf'::text` | probelauf: die Liste läuft mit und ordnet keine Reparatur an. verbindlich: erst nach bestandener Nachprüfung. |
| `erstellt_am` | `timestamp with time zone` | nein | `now()` | Zeitpunkt des Einfrierens. |
| `geaendert_am` | `timestamp with time zone` | nein | `now()` | Zeitpunkt der letzten Änderung, gesetzt von fn_audit_anhaengen. |

## `zahlung` (Tabelle)

Zahlungsvorgang zu einer Rechnung.

| Spalte | Datentyp | NULL | Vorgabe | Beschreibung |
|---|---|---|---|---|
| `zahlung_id` | `bigint` | nein |  | Surrogatschlüssel. |
| `rechnung_id` | `bigint` | nein |  | Beglichene Rechnung. Teilzahlungen sind als mehrere Zeilen möglich. |
| `zahlungsmittel_id` | `bigint` | ja |  | Belastetes Zahlungsmittel. NULL, wenn es nachträglich gelöscht wurde. |
| `betrag` | `numeric(10,2)` | nein |  | Gezahlter Betrag. |
| `gebucht_am` | `timestamp with time zone` | ja |  | Zeitpunkt der Buchung. Pflicht, sobald der Status gebucht ist. |
| `status` | `velocity.zahlung_status` | nein | `'offen'::velocity.zahlung_status` | offen, gebucht, fehlgeschlagen oder erstattet. |
| `erstellt_am` | `timestamp with time zone` | nein | `now()` |  |
| `geaendert_am` | `timestamp with time zone` | nein | `now()` |  |

## `zahlungsart` (Tabelle)

Verfahren der Bezahlung (SEPA, Kreditkarte, PayPal).

| Spalte | Datentyp | NULL | Vorgabe | Beschreibung |
|---|---|---|---|---|
| `zahlungsart_id` | `bigint` | nein |  | Surrogatschlüssel. |
| `code` | `text` | nein |  | Fachlicher Schlüssel: SEPA, KREDITKARTE, PAYPAL. |
| `bezeichnung` | `text` | nein |  | Text für die Oberfläche. |
| `erstellt_am` | `timestamp with time zone` | nein | `now()` |  |
| `geaendert_am` | `timestamp with time zone` | nein | `now()` |  |

## `zahlungsmittel` (Tabelle)

Beim Zahlungsdienstleister hinterlegtes Mittel eines Kunden. Gespeichert wird nur dessen Token, nie IBAN oder Kartennummer.

| Spalte | Datentyp | NULL | Vorgabe | Beschreibung |
|---|---|---|---|---|
| `zahlungsmittel_id` | `bigint` | nein |  | Surrogatschlüssel. |
| `kunde_id` | `bigint` | nein |  | Kunde, dem das Zahlungsmittel gehört. |
| `zahlungsart_id` | `bigint` | nein |  | Verfahren dieses Zahlungsmittels. |
| `referenz_token` | `text` | nein |  | Token des Zahlungsdienstleisters. Was nicht gespeichert wird, kann nicht abfließen. |
| `inhaber` | `text` | ja |  | Name des Kontoinhabers laut Dienstleister. |
| `gueltig_bis` | `date` | ja |  | Ablaufdatum, bei Karten relevant. |
| `ist_standard` | `boolean` | nein | `false` | Vorbelegtes Zahlungsmittel. Je Kunde höchstens eines, über einen partiellen Unique-Index erzwungen. |
| `erstellt_am` | `timestamp with time zone` | nein | `now()` |  |
| `geaendert_am` | `timestamp with time zone` | nein | `now()` |  |

## `v_data_dictionary` (Sicht)

Erzeugt das Data Dictionary aus dem Systemkatalog. Grundlage für doku/datenmodell/06-data-dictionary.md.

| Spalte | Datentyp | NULL | Vorgabe | Beschreibung |
|---|---|---|---|---|
| `objekt_art` | `text` | ja |  | Tabelle oder Sicht. |
| `tabelle` | `name` | ja |  | Name des Objekts. |
| `spalte` | `name` | ja |  | Name der Spalte. |
| `datentyp` | `text` | ja |  | Datentyp einschließlich Länge und Genauigkeit. |
| `nullbar` | `boolean` | ja |  | Wahr, wenn die Spalte NULL zulässt. |
| `vorgabe` | `text` | ja |  | Vorgabewert als Ausdruck, NULL wenn keiner gesetzt ist. |
| `beschreibung` | `text` | ja |  | Der Spaltenkommentar aus dem Systemkatalog. |
| `tabellenbeschreibung` | `text` | ja |  | Der Tabellenkommentar aus dem Systemkatalog. |
| `position` | `smallint` | ja |  | Ordnungsnummer der Spalte innerhalb des Objekts. |

## `v_faq` (Sicht)

Öffentliche, aktive FAQ-Einträge.

| Spalte | Datentyp | NULL | Vorgabe | Beschreibung |
|---|---|---|---|---|
| `faq_id` | `bigint` | ja |  | Schlüssel des Eintrags. |
| `frage` | `text` | ja |  | Die Frage. |
| `antwort` | `text` | ja |  | Die Antwort. |
| `sortierung` | `integer` | ja |  | Reihenfolge auf der Seite. |

## `v_geschaeftsgebiet` (Sicht)

Öffentliche Umrisse der aktiven Geschäftsgebiete.

| Spalte | Datentyp | NULL | Vorgabe | Beschreibung |
|---|---|---|---|---|
| `gebiet_id` | `bigint` | ja |  | Schlüssel des Gebiets. |
| `name` | `text` | ja |  | Name des Gebiets. |
| `umriss` | `text` | ja |  | Das Vieleck als Text, Form ((Länge,Breite),…). Die Karte zeichnet daraus ihren Umriss. |

## `v_hoehenmarke` (Sicht)

Öffentliche Bezugshöhen für die Höhengrafik.

| Spalte | Datentyp | NULL | Vorgabe | Beschreibung |
|---|---|---|---|---|
| `marke_id` | `bigint` | ja |  | Schlüssel der Höhenmarke. |
| `name` | `text` | ja |  | Name der Höhe. |
| `hoehe_m` | `integer` | ja |  | Höhe in Metern. Siehe hoehenmarke.hoehe_m zur Genauigkeit. |
| `latitude` | `numeric(9,6)` | ja |  | Breitengrad. |
| `longitude` | `numeric(9,6)` | ja |  | Längengrad. |
| `quelle` | `text` | ja |  | Herkunft des Höhenwerts. |

## `v_kennzahl` (Sicht)

Öffentliche Kennzahlen, feste und berechnete.

| Spalte | Datentyp | NULL | Vorgabe | Beschreibung |
|---|---|---|---|---|
| `schluessel` | `text` | ja |  | Fachlicher Schlüssel der Kennzahl. |
| `label` | `text` | ja |  | Beschriftung unter dem Wert. |
| `sortierung` | `integer` | ja |  | Reihenfolge in der Kopfleiste. |
| `wert` | `text` | ja |  | Anzuzeigender Wert: entweder fest hinterlegt oder zur Laufzeit ermittelt. |

## `v_mein_profil` (Sicht)

Stammdaten des angemeldeten Kunden. Läuft mit Definer-Rechten und filtert selbst auf auth.uid(), weil adresse nicht freigegeben ist.

| Spalte | Datentyp | NULL | Vorgabe | Beschreibung |
|---|---|---|---|---|
| `kunde_id` | `bigint` | ja |  | Schlüssel des Kunden. |
| `kundennummer` | `text` | ja |  | Nach außen kommunizierte Kundennummer. |
| `email` | `text` | ja |  | Hinterlegte Kontaktadresse. |
| `vorname` | `text` | ja |  | Vorname. |
| `nachname` | `text` | ja |  | Nachname. |
| `telefon` | `text` | ja |  | Rufnummer. |
| `geburtsdatum` | `date` | ja |  | Geburtsdatum, Grundlage der Altersgrenze. |
| `status` | `text` | ja |  | aktiv, gesperrt oder geschlossen. |
| `registriert_am` | `timestamp with time zone` | ja |  | Zeitpunkt der Anmeldung. |
| `zeigt_preisschaetzer` | `boolean` | ja |  | Hat der Kunde den Preisschaetzer eingeschaltet? Steuert, ob die Radkacheln den Knopf zeigen. |
| `strasse` | `text` | ja |  | Strasse der Rechnungsadresse. |
| `hausnummer` | `text` | ja |  | Hausnummer der Rechnungsadresse. |
| `plz` | `text` | ja |  | Postleitzahl der Rechnungsadresse. |
| `ort` | `text` | ja |  | Ort der Rechnungsadresse. |

## `v_meine_ausleihe` (Sicht)

Ausleihen des angemeldeten Kunden. Läuft mit den Rechten des Aufrufers, begrenzt durch RLS.

| Spalte | Datentyp | NULL | Vorgabe | Beschreibung |
|---|---|---|---|---|
| `ausleihe_id` | `bigint` | ja |  | Schlüssel der Ausleihe, wird an api_ausleihe_beenden übergeben. |
| `startzeit` | `timestamp with time zone` | ja |  | Beginn der Nutzung. |
| `endzeit` | `timestamp with time zone` | ja |  | Ende der Nutzung, NULL bei laufender Fahrt. |
| `status` | `text` | ja |  | aktiv, abgeschlossen oder storniert. |
| `dauer_minuten` | `integer` | ja |  | Angefangene Minuten, aufgerundet. |
| `rahmennummer` | `text` | ja |  | Am Rahmen ablesbare Nummer des genutzten Rades. |
| `typ_code` | `text` | ja |  | CITY, EBIKE oder CARGO. |
| `typ_bezeichnung` | `text` | ja |  | Name des Fahrradtyps. |
| `start_station` | `text` | ja |  | Name der Entnahmestation, NULL bei freiem Abstellort. |
| `end_station` | `text` | ja |  | Name der Rückgabestation, NULL bei freiem Abstellen. |
| `gesamtbetrag` | `numeric(10,2)` | ja |  | Summe aller Entgeltpositionen dieser Ausleihe. |
| `positionen` | `jsonb` | ja |  | Die gebuchten Entgeltpositionen als jsonb-Feld: Bezeichnung, Code und Betrag je Zeile. Der Beleg zeigt damit, was abgerechnet wurde, ohne die Preisregeln im Frontend nachzubauen. |

## `v_meine_rechnung` (Sicht)

Rechnungen des angemeldeten Kunden. Läuft mit den Rechten des Aufrufers, begrenzt durch RLS.

| Spalte | Datentyp | NULL | Vorgabe | Beschreibung |
|---|---|---|---|---|
| `rechnung_id` | `bigint` | ja |  | Schlüssel der Rechnung. |
| `rechnungsnummer` | `text` | ja |  | Nach außen kommunizierte Belegnummer. |
| `periode_jahr` | `integer` | ja |  | Jahr der Abrechnungsperiode. |
| `periode_monat` | `integer` | ja |  | Monat der Abrechnungsperiode. |
| `erstellt_am_beleg` | `timestamp with time zone` | ja |  | Belegdatum. |
| `betrag_netto` | `numeric(10,2)` | ja |  | Summe ohne Umsatzsteuer. |
| `ust_betrag` | `numeric(10,2)` | ja |  | Betrag der Umsatzsteuer. |
| `betrag_brutto` | `numeric(10,2)` | ja |  | Zahlbetrag. |
| `status` | `text` | ja |  | entwurf, gestellt, bezahlt oder storniert. |

## `v_nutzungsschritt` (Sicht)

Öffentliche Schritte der Nutzungsanleitung.

| Spalte | Datentyp | NULL | Vorgabe | Beschreibung |
|---|---|---|---|---|
| `schritt_id` | `bigint` | ja |  | Schlüssel des Schritts. |
| `nummer` | `integer` | ja |  | Position in der Abfolge. |
| `titel` | `text` | ja |  | Überschrift der Karte. |
| `beschreibung` | `text` | ja |  | Erläuternder Text. |

## `v_preisschaetzung` (Sicht)

Die freigegebenen Preisspannen, wie die Website sie liest. Enthaelt keine Zeile fuer Rundfahrten und keine fuer Verbindungen, deren Spanne die Nuetzlichkeitsregel aus Phase 5.5 des Notebooks reisst (hoechstens 12 Minuten und hoechstens 60 Prozent der Preismitte) - was hier fehlt, wird in der App nicht angezeigt.

| Spalte | Datentyp | NULL | Vorgabe | Beschreibung |
|---|---|---|---|---|
| `start_station_id` | `bigint` | ja |  | Startstation als ID - damit die App nicht ueber Namen verknuepfen muss. |
| `ziel_station_id` | `bigint` | ja |  | Zielstation als ID. |
| `startstation` | `text` | ja |  | Name der Startstation. |
| `zielstation` | `text` | ja |  | Name der gewaehlten Zielstation. |
| `typ_code` | `text` | ja |  | Fahrradtyp, fuer den die Spanne gilt. |
| `zeitfenster` | `text` | ja |  | frueh, vormittag, nachmittag oder abend. |
| `minuten_von` | `integer` | ja |  | Untere Grenze der geschaetzten Dauer in Minuten. |
| `minuten_bis` | `integer` | ja |  | Obere Grenze der geschaetzten Dauer in Minuten. |
| `preis_von` | `numeric(6,2)` | ja |  | Untere Grenze der angezeigten Preisspanne in Euro. |
| `preis_bis` | `numeric(6,2)` | ja |  | Obere Grenze der angezeigten Preisspanne in Euro. |
| `fahrten_grundlage` | `integer` | ja |  | Zahl der Fahrten, auf denen die Spanne beruht - wird in der App genannt. |
| `stand` | `date` | ja |  | Datum der Berechnung. |

## `v_station` (Sicht)

Öffentliche Stationsliste mit Belegung. Ohne Personenbezug.

| Spalte | Datentyp | NULL | Vorgabe | Beschreibung |
|---|---|---|---|---|
| `station_id` | `bigint` | ja |  | Schlüssel der Station. |
| `stationsnummer` | `text` | ja |  | Fachlicher Schlüssel der Station. |
| `name` | `text` | ja |  | Anzeigename auf der Karte. |
| `strasse` | `text` | ja |  | Strasse der Station. |
| `hausnummer` | `text` | ja |  | Hausnummer der Station. |
| `plz` | `text` | ja |  | Postleitzahl der Station. |
| `ort` | `text` | ja |  | Ort der Station. |
| `latitude` | `numeric(9,6)` | ja |  | Breitengrad für den Kartenmarker. |
| `longitude` | `numeric(9,6)` | ja |  | Längengrad für den Kartenmarker. |
| `hoehe_m` | `integer` | ja |  | Höhenlage der Station. Siehe station.hoehe_m zur Herkunft und zur Genauigkeit. |
| `kapazitaet` | `integer` | ja |  | Anzahl der Stellplätze. |
| `verfuegbare_raeder` | `integer` | ja |  | Zahl der aktuell entleihbaren Räder an dieser Station. |
| `freie_stellplaetze` | `integer` | ja |  | Kapazität abzüglich der abgestellten Räder, nie negativ. |

## `v_tarif` (Sicht)

Öffentliche Tarifliste mit den heute geltenden Konditionen.

| Spalte | Datentyp | NULL | Vorgabe | Beschreibung |
|---|---|---|---|---|
| `tarif_id` | `bigint` | ja |  | Schlüssel des Tarifs. |
| `tarif_code` | `text` | ja |  | Fachlicher Schlüssel des Tarifs. |
| `bezeichnung` | `text` | ja |  | Name des Tarifs. |
| `art` | `text` | ja |  | standard oder vorteil. |
| `voraussetzung` | `text` | ja |  | Zu erbringender Nachweis. |
| `freiminuten_pro_monat` | `integer` | ja |  | Heute geltendes Monatskontingent. |
| `rabatt_prozent` | `numeric(5,2)` | ja |  | Heute geltender Nachlass auf Ausleihen. |

## `v_tarifkarte` (Sicht)

Öffentliche Preiskarten je Fahrradtyp inklusive Werbemerkmalen.

| Spalte | Datentyp | NULL | Vorgabe | Beschreibung |
|---|---|---|---|---|
| `typ_id` | `bigint` | ja |  | Schlüssel des Fahrradtyps. |
| `typ_code` | `text` | ja |  | CITY, EBIKE oder CARGO. |
| `bezeichnung` | `text` | ja |  | Name auf der Karte. |
| `beschreibung` | `text` | ja |  | Fließtext zur Karte. |
| `hat_elektro` | `boolean` | ja |  | Wahr bei elektrischer Unterstützung. |
| `startgebuehr` | `numeric(10,2)` | ja |  | Heute geltende Startgebühr. |
| `preis_pro_minute` | `numeric(10,2)` | ja |  | Heute geltendes Minutenentgelt. |
| `tageshoechstpreis` | `numeric(10,2)` | ja |  | Heute geltende Obergrenze je Ausleihe. |
| `preis_30_minuten` | `numeric` | ja |  | Beispielpreis für eine halbe Stunde: Startgebühr plus dreißig Minutenentgelte. |
| `merkmale` | `text[]` | ja |  | Die Aufzählungspunkte der Karte, nach sortierung geordnet. |

## `v_verfuegbares_fahrrad` (Sicht)

Öffentliche Liste ausleihbarer Räder mit Position und geltendem Preis.

| Spalte | Datentyp | NULL | Vorgabe | Beschreibung |
|---|---|---|---|---|
| `fahrrad_id` | `bigint` | ja |  | Schlüssel des Rades, wird an api_ausleihe_starten übergeben. |
| `rahmennummer` | `text` | ja |  | Am Rahmen ablesbare Nummer. |
| `typ_id` | `bigint` | ja |  | Schlüssel des Fahrradtyps. |
| `typ_code` | `text` | ja |  | CITY, EBIKE oder CARGO. Steuert die Filterung auf der Karte. |
| `typ_bezeichnung` | `text` | ja |  | Name des Typs für die Anzeige. |
| `hat_elektro` | `boolean` | ja |  | Wahr bei elektrischer Unterstützung. |
| `akkustand_prozent` | `smallint` | ja |  | Ladestand. NULL bei Rädern ohne Akku. |
| `latitude` | `numeric(9,6)` | ja |  | Breitengrad: die eigene Position, ersatzweise die der Station. |
| `longitude` | `numeric(9,6)` | ja |  | Längengrad: die eigene Position, ersatzweise die der Station. |
| `station_id` | `bigint` | ja |  | Station, an der das Rad steht. NULL bei freiem Abstellort. |
| `station_name` | `text` | ja |  | Name der Station, NULL bei freiem Abstellort. |
| `startgebuehr` | `numeric(10,2)` | ja |  | Heute geltende Startgebühr. |
| `preis_pro_minute` | `numeric(10,2)` | ja |  | Heute geltendes Minutenentgelt. |
| `tageshoechstpreis` | `numeric(10,2)` | ja |  | Heute geltende Obergrenze je Ausleihe. |

## `v_wawi_auftrag` (Sicht)

Arbeitssicht der Werkstatt: jeder Wartungsauftrag mit Rad, Bearbeiter und Bearbeitungsstand. Filtert selbst über velocity.hat_rolle. Seit dem Demozugang zusätzlich für velocity.hat_rolle('demo') lesbar (0020_demo_zugang.sql).

| Spalte | Datentyp | NULL | Vorgabe | Beschreibung |
|---|---|---|---|---|
| `wartungsauftrag_id` | `bigint` | ja |  | Surrogatschlüssel, fachlich bedeutungslos und deshalb stabil. |
| `auftragsnummer` | `text` | ja |  | Fachlicher, in der Werkstatt gesprochener Schlüssel des Auftrags. |
| `fahrrad_id` | `bigint` | ja |  | Das Rad, an dem gearbeitet wird. |
| `rahmennummer` | `text` | ja |  | Am Rahmen ablesbare Nummer des Rades, für den Werkstattzuruf ohne Nachschlagen. |
| `schadensmeldung_id` | `bigint` | ja |  | Auslösende Meldung. NULL bei einer geplanten Inspektion ohne konkreten Schaden. |
| `eroeffnet_am` | `timestamp with time zone` | ja |  | Zeitpunkt der Auftragseröffnung. |
| `erledigt_am` | `timestamp with time zone` | ja |  | Zeitpunkt des Abschlusses. NULL, solange der Auftrag läuft. |
| `status` | `velocity.auftrag_status` | ja |  | Bearbeitungsstand des Auftrags: offen, in_arbeit, erledigt oder abgebrochen. |
| `arbeitszeit_minuten` | `integer` | ja |  | Aufgewendete Werkstattzeit in Minuten. NULL, solange der Auftrag läuft. |
| `bemerkung` | `text` | ja |  | Freitext der Werkstatt zum Auftrag, etwa verbaute Ersatzteile ohne eigenen Lagerbezug. |
| `bearbeiter` | `text` | ja |  | Voller Name des zuständigen Werkstattmitarbeiters. NULL, solange der Auftrag noch niemandem zugeteilt ist. |

## `v_wawi_fahrt_km` (Sicht)

Einzige Stelle, an der Strecken geschätzt werden. ist_geschaetzt sagt, ob; verfahren sagt, WOMIT. Trägt seit der Gesamtprüfung vom 25.08.2026 eine eigene velocity.hat_rolle('leitung')-Schranke statt nur velocity.ist_mitarbeiter(): die Zeilen führen ausleihe_id, kunde_id und startzeit je Einzelfahrt, also ein Bewegungsprofil - Spec 4.2 gibt das ausdrücklich nur der Leitung, nicht jeder Fachrolle. Der frühere Stand begründete das Fehlen der eigenen Schranke mit demselben Satz, der hier jetzt für das Gegenteil steht: eine Sicht, die ihre Schranke von einer anderen erbt, hat keine eigene. Traegt AUS DEMSELBEN GRUND KEIN velocity.hat_rolle('demo') (0020_demo_zugang.sql) - ohnehin fuer authenticated vollstaendig entzogen (siehe unten), und ein Bewegungsprofil bliebe das Letzte, was ein oeffentlich beworbener Zugang lesen darf, unabhaengig davon, ueber welchen Weg. v_wawi_km_co2 liest seit der zweiten Demozugang-Runde NICHT MEHR FROM dieser Sicht (siehe deren eigener Kommentar) - es gibt also seither ohnehin keinen indirekten Zugriffsweg mehr, den diese Zeile noch offenhalten müsste.

| Spalte | Datentyp | NULL | Vorgabe | Beschreibung |
|---|---|---|---|---|
| `ausleihe_id` | `bigint` | ja |  | Schlüssel der Fahrt, für einen Verweis auf die einzelne Ausleihe hinter einer Aggregation. v_wawi_km_co2 liest diese Spalte seit ihrer Entkopplung (zweite Demozugang-Runde) nicht mehr über diese Sicht, sondern direkt aus velocity.ausleihe. |
| `startzeit` | `timestamp with time zone` | ja |  | Beginn der Fahrt, Grundlage der Monatsgruppierung und der Zeitscheibe für Umwegfaktor, Reisegeschwindigkeit und CO2-Annahmen (rechenannahme.gueltigkeit). |
| `kunde_id` | `bigint` | ja |  | Fahrender Kunde, für eine spätere Auswertung je Kunde ohne erneuten Join auf ausleihe. |
| `typ_code` | `text` | ja |  | Fahrradtyp der Fahrt. v_wawi_km_co2 bestimmt daraus dieselbe CO2-Annahme (co2_rad für CITY, sonst co2_ebike) - seit ihrer Entkopplung (zweite Demozugang-Runde) über einen eigenen Join auf fahrradtyp, nicht mehr über diese Spalte. |
| `kilometer` | `numeric` | ja |  | Drei Fälle, siehe verfahren: gemessene Strecke (ausleihe.distanz_km), wo vorhanden; sonst, bei einer Rundfahrt mit Luftlinie null (Start- und Endpunkt gleich), aus der Dauer geschätzt (rechenannahme reisegeschwindigkeit); sonst aus der Luftlinie zwischen Start- und Endpunkt mal Umwegfaktor (rechenannahme). NULL, wenn weder Distanz noch beide Koordinatenpaare vorliegen - eine erfundene Zahl aus einem halben Koordinatenpaar wäre schlimmer als keine. |
| `ist_geschaetzt` | `boolean` | ja |  | Wahr, wenn kilometer nicht gemessen wurde (verfahren aus_dauer oder aus_luftlinie). Gehört zu jeder Verwendung von kilometer dazu, siehe Kopfkommentar der Sicht. |
| `verfahren` | `text` | ja |  | gemessen, aus_dauer oder aus_luftlinie - WOMIT kilometer ermittelt wurde. Nötig, weil ist_geschaetzt allein zwei verschiedene Schätzverfahren in einen Topf würfe: aus_dauer (Rundfahrten, Luftlinie strukturell null, Reisegeschwindigkeit als Grundlage) und aus_luftlinie (Luftlinie mal Umwegfaktor) irren sich auf unterschiedliche Weise und müssen sich getrennt auswerten lassen. |

## `v_wawi_fahrten_je_tag` (Sicht)

Tagesaggregation der abgeschlossenen Fahrten für den Drill-Down aus einer angeklickten Monatszeile der Auswertungen. Absichtlich ohne Personenbezug: keine ausleihe_id, keine kunde_id, keine Uhrzeit - eine Tagessumme ist kein Bewegungsprofil, anders als v_wawi_fahrt_km (siehe deren Kopfkommentar). Bewusst ohne Radtyp-Spalte, siehe Kommentar am create view. Filtert selbst über velocity.hat_rolle('leitung'), dieselbe Rolle wie die drei Monatssichten, aus denen heraus der Drill-Down aufgerufen wird. Seit dem Demozugang zusätzlich für velocity.hat_rolle('demo') lesbar (0020_demo_zugang.sql).

| Spalte | Datentyp | NULL | Vorgabe | Beschreibung |
|---|---|---|---|---|
| `tag` | `date` | ja |  | Kalendertag der Fahrt (startzeit), die x-Achse der Säulengrafik. Ein Tag ohne abgeschlossene Fahrt taucht hier NICHT als Zeile auf - die Oberfläche muss ihn selbst als null Fahrten ergänzen, sonst sieht eine echte Lücke im Betrieb wie ein Ladefehler aus (siehe monatsdrilldownEinfuegen() in auswertungen.js). |
| `fahrten` | `bigint` | ja |  | Zahl der an diesem Tag abgeschlossenen Ausleihen, dieselbe Zählweise (count(distinct ausleihe_id) where status = 'abgeschlossen') wie in v_wawi_umsatz_radtyp/v_wawi_umsatz_kundengruppe/v_wawi_km_co2 - die Summe dieser Spalte über einen Monat muss deshalb die fahrten-Summe der passenden Zeilen jeder der drei Monatssichten ergeben. Genau das prüft test_v_fahrten_je_tag_stimmt_mit_monatssichten_ueberein in t0018_wawi_sichten.sql als wichtigste Zusicherung dieser Sicht. |
| `umsatz` | `numeric` | ja |  | Summe der Entgeltpositionen aller an diesem Tag abgeschlossenen Fahrten, in Euro. Korrekturpositionen mit negativem Betrag zaehlen mit (wie in v_wawi_umsatz_radtyp). null, wenn keine der Fahrten des Tages abgerechnet ist - die Oberflaeche zeigt dann einen Gedankenstrich, nicht 0,00 Euro. |

## `v_wawi_fahrten_je_tag_rad` (Sicht)

Dritte Ebene des Drill-Downs (Monat -> Tag -> Räder): jede an einem Tag abgeschlossene Fahrt, vom RAD her gesehen statt vom Kunden - Flottenbetrieb, kein Bewegungsprofil. Bewusst OHNE ausleihe_id, kunde_id, kundennummer oder Name: dieselben Fahrten wie v_wawi_fahrten_je_tag, nach Rad statt nach Kunde geschnitten - siehe ausführlicher Kopfkommentar am create view für die Begründung dieser Grenze. Kein Join auf v_wawi_fahrt_km (deren eigene hat_rolle('leitung')-Schranke würde disposition sonst ungewollt ausschließen) - die Kilometerformel steht deshalb ein zweites Mal hier. Filtert selbst über velocity.hat_rolle('leitung') oder velocity.hat_rolle('disposition'). Seit dem Demozugang zusätzlich für velocity.hat_rolle('demo') lesbar (0020_demo_zugang.sql).

| Spalte | Datentyp | NULL | Vorgabe | Beschreibung |
|---|---|---|---|---|
| `tag` | `date` | ja |  | Kalendertag der Fahrt (startzeit) - derselbe Wert wie v_wawi_fahrten_je_tag.tag, hier je Fahrt statt aggregiert. Für die Oberfläche der PostgREST-Filterschlüssel dieser Sicht (tag=eq.JJJJ-MM-TT). |
| `fahrrad_id` | `bigint` | ja |  | Schlüssel des Rades, für den Sprung von dieser Zeile in die Flottensicht (v_wawi_flotte) - der Querverweis aus dem Gestaltungsauftrag Punkt 3. |
| `rahmennummer` | `text` | ja |  | Am Rahmen ablesbare Nummer, der Bezug zum physischen Rad vor Ort. |
| `typ_code` | `text` | ja |  | Fachlicher Schlüssel des Fahrradtyps. |
| `typ` | `text` | ja |  | Anzeigename des Fahrradtyps. |
| `start_station` | `text` | ja |  | Name der Station, an der die Fahrt begann. NULL bei freiem Abstellort als Startpunkt. |
| `ziel_station` | `text` | ja |  | Name der Station, an der die Fahrt endete. NULL bei freiem Abstellort als Zielpunkt. |
| `dauer_minuten` | `integer` | ja |  | Dauer der Fahrt in Minuten. |
| `kilometer` | `numeric` | ja |  | Gefahrene Strecke - gemessen oder geschätzt, siehe ist_geschaetzt und die Drei-Fall-Formel im Kopfkommentar (identisch zu v_wawi_fahrt_km.kilometer). NULL, wenn weder Distanz noch beide Koordinatenpaare vorliegen. |
| `ist_geschaetzt` | `boolean` | ja |  | Wahr, wenn kilometer nicht gemessen, sondern aus Dauer oder Luftlinie geschätzt wurde - gehört zu jeder Anzeige von kilometer dazu. |
| `umsatz` | `numeric` | ja |  | Summe der Entgeltpositionen dieser einen Fahrt, in Euro. Netto in dem Sinn, dass Korrekturpositionen mit negativem Betrag mitzaehlen (siehe v_wawi_umsatz_radtyp weiter oben). null, wenn die Fahrt keine Entgeltposition traegt - dann ist sie NICHT abgerechnet, was etwas anderes ist als 0,00 Euro; die Oberflaeche zeigt dafuer einen Gedankenstrich. Additiv ueber Fahrten, deshalb in der Warenwirtschaft als summierbare Spalte gefuehrt. |

## `v_wawi_fahrten_je_tag_typ` (Sicht)

Fahrten und Umsatz je Kalendertag UND Radtyp - die nach Radtyp filterbare Fassung von v_wawi_fahrten_je_tag. Die Summe ueber alle Radtypen eines Tages ergibt exakt dessen Zeile dort (in t0018 geprueft). Kein Kundenbezug. Filtert selbst ueber velocity.hat_rolle('leitung') oder velocity.hat_rolle('demo') - dieselbe Schranke wie die groebere Sicht.

| Spalte | Datentyp | NULL | Vorgabe | Beschreibung |
|---|---|---|---|---|
| `tag` | `date` | ja |  | Kalendertag der Fahrt (startzeit) - derselbe Wert wie in v_wawi_fahrten_je_tag, nur je Radtyp noch einmal aufgeteilt. |
| `typ_code` | `text` | ja |  | Fachlicher Schluessel des Radtyps (fahrradtyp.typ_code) - der Wert, ueber den die Oberflaeche filtert; die Anzeige nimmt bezeichnung aus der Spalte typ daneben. |
| `typ` | `text` | ja |  | Bezeichnung des Radtyps zum Anzeigen (fahrradtyp.bezeichnung), z. B. "City-Bike". |
| `fahrten` | `bigint` | ja |  | Zahl der an diesem Tag abgeschlossenen Fahrten MIT DIESEM RADTYP. Ueber alle Radtypen summiert ergibt sie die Fahrtenzahl in v_wawi_fahrten_je_tag. |
| `umsatz` | `numeric` | ja |  | Summe der Entgeltpositionen der Fahrten dieses Tages MIT DIESEM RADTYP, in Euro. null, wenn keine davon abgerechnet ist - nicht abgerechnet ist etwas anderes als null Euro. |

## `v_wawi_flotte` (Sicht)

Arbeitssicht der Flotte für Disposition und Werkstatt: ein Rad je Zeile mit Standort, Wartungshistorie und dem dringlichsten offenen Schaden. Filtert selbst über velocity.hat_rolle, siehe Kopfkommentar der Datei. Seit dem Demozugang zusätzlich für velocity.hat_rolle('demo') lesbar (siehe 0020_demo_zugang.sql) - keine Personendaten in dieser Sicht.

| Spalte | Datentyp | NULL | Vorgabe | Beschreibung |
|---|---|---|---|---|
| `fahrrad_id` | `bigint` | ja |  | Schlüssel des Rades, für Verweise in die Werkstatt- und Auftragssichten. |
| `rahmennummer` | `text` | ja |  | Am Rahmen ablesbare Nummer, der Bezug zum physischen Rad vor Ort. |
| `typ_code` | `text` | ja |  | Fachlicher Schlüssel des Fahrradtyps, für Filter in der Oberfläche. |
| `typ` | `text` | ja |  | Anzeigename des Fahrradtyps. |
| `hersteller` | `text` | ja |  | Name des Herstellers laut Modellstammdaten. |
| `modell` | `text` | ja |  | Modellbezeichnung, für die Ersatzteilsuche in der Werkstatt. |
| `status` | `velocity.fahrrad_status` | ja |  | Aktueller Betriebsstatus des Rades - verfuegbar, ausgeliehen, wartung, defekt oder ausgemustert. Anders als die öffentliche v_verfuegbares_fahrrad zeigt diese Sicht gerade auch die NICHT verfügbaren Räder: die Disposition muss wissen, welches Rad in der Wartung hängt, nicht nur, welches gerade fahrbereit ist. |
| `angeschafft_am` | `date` | ja |  | Anschaffungsdatum, Grundlage für Abschreibung und Alterseinschätzung. |
| `standort` | `text` | ja |  | Name der Station, an der das Rad steht. NULL bei freiem Abstellort oder laufender Fahrt. |
| `latitude` | `numeric(9,6)` | ja |  | Breitengrad der zuletzt gemeldeten Position, unabhängig von einer Station. |
| `longitude` | `numeric(9,6)` | ja |  | Längengrad der zuletzt gemeldeten Position, unabhängig von einer Station. |
| `akkustand_prozent` | `smallint` | ja |  | Ladestand des Akkus. NULL bei Rädern ohne Elektroantrieb. |
| `letzte_wartung` | `timestamp with time zone` | ja |  | Abschlusszeitpunkt des zuletzt erledigten Wartungsauftrags. NULL, wenn das Rad noch nie in der Werkstatt war. |
| `offene_schaeden` | `bigint` | ja |  | Zahl der noch nicht abgeschlossenen Schadensmeldungen (offen oder in_arbeit). |
| `hoechste_schwere` | `text` | ja |  | Schwerste noch offene Meldung nach der natürlichen Rangfolge des ENUM (gering < mittel < fahruntauglich), nicht alphabetisch. NULL, wenn keine offene Meldung vorliegt - entscheidet, ob das Rad überhaupt eingeplant werden darf. |
| `baujahr` | `integer` | ja |  | Baujahr laut Stammdaten - das Jahr, seit dem der Hersteller dieser Modellzeile den Typ beliefert. |
| `gewicht_kg` | `numeric(4,1)` | ja |  | Leergewicht des Fahrradtyps laut Stammdaten - gilt für jedes Rad dieses Typs gleich, unabhängig vom Hersteller. |
| `gangzahl` | `integer` | ja |  | Zahl der Gänge des Fahrradtyps laut Stammdaten - gilt für jedes Rad dieses Typs gleich, unabhängig vom Hersteller. |
| `rahmenhoehe_cm` | `integer` | ja |  | Rahmenhöhe des Fahrradtyps laut Stammdaten - eine Größe je Typ, individuelle Anpassung läuft über den Sattel-Schnellspanner. |
| `akkukapazitaet_wh` | `integer` | ja |  | Akkukapazität des Fahrradtyps laut Stammdaten. NULL bei einem Rad ohne Elektroantrieb. |
| `reichweite_km` | `integer` | ja |  | Herstellerangabe zur Reichweite des Fahrradtyps laut Stammdaten. NULL bei einem Rad ohne Elektroantrieb. |

## `v_wawi_km_co2` (Sicht)

CO2-Ersparnis gegenüber dem Pkw, für Leitung und - seit der zweiten Demozugang-Runde - für 'demo'. Liest seither NICHT MEHR FROM v_wawi_fahrt_km, sondern direkt aus velocity.ausleihe (dieselbe Drei-Fall-Kilometerformel ein drittes Mal, siehe Kopfkommentar am create view) und trägt dadurch eine eigene, unabhängige (hat_rolle('leitung') or hat_rolle('demo'))-Schranke, nicht mehr nur geerbt aus v_wawi_fahrt_km. anteil_geschaetzt und fahrten_geschaetzt gehören in jede Darstellung dieser Zahl. 'demo' ist hier unbedenklich, anders als bei v_wawi_fahrt_km selbst: diese Sicht führt weder kunde_id noch ausleihe_id, nur eine Monatsaggregation je Radtyp ohne Personenbezug - dieselbe Einstufung wie v_wawi_umsatz_radtyp/v_wawi_umsatz_kundengruppe.

| Spalte | Datentyp | NULL | Vorgabe | Beschreibung |
|---|---|---|---|---|
| `monat` | `date` | ja |  | Erster Tag des Monats der Fahrt (ausleihe.startzeit). |
| `typ_code` | `text` | ja |  | Fahrradtyp, bestimmt die verglichene Eigenemission (co2_rad vs. co2_ebike). |
| `fahrten` | `bigint` | ja |  | Zahl der Fahrten mit bekannter oder geschätzter Kilometerzahl in diesem Monat und Typ. Nenner für anteil_geschaetzt. |
| `kilometer` | `numeric` | ja |  | Summe der gefahrenen Kilometer, gemessen und geschätzt gemeinsam - anteil_geschaetzt und fahrten_geschaetzt sagen, wie viel davon Schätzung ist. |
| `fahrten_geschaetzt` | `bigint` | ja |  | Zähler zu anteil_geschaetzt: Anzahl der Fahrten dieser Zeile mit geschätzter statt gemessener Kilometerzahl. Nötig, weil ein einfaches Mittel von anteil_geschaetzt über mehrere Zeilen NICHT den fahrtgewichteten Gesamtanteil ergibt, sobald die Zeilen unterschiedlich gross sind (hier: 1 bis über 1000 Fahrten je Monat/Typ) - wer richtig gewichten will, summiert fahrten_geschaetzt und fahrten getrennt und teilt erst danach. |
| `anteil_geschaetzt` | `numeric` | ja |  | Anteil der Fahrten DIESER ZEILE, deren Kilometer geschätzt statt gemessen wurden (0 bis 1) - keine über Zeilen gemittelte Kennzahl. Ein arithmetisches Mittel dieser Spalte über mehrere Monate/Typen ist NICHT der Gesamtanteil, weil die Zeilen sehr unterschiedlich viele Fahrten tragen (1 bis über 1000); dafür fahrten_geschaetzt verwenden. Ohne diese Spalte wäre kilometer eine Zahl ohne Herkunftsangabe - sie ist die Unsicherheit von kilometer und co2_ersparnis_kg, kein optionales Detail. |
| `co2_ersparnis_kg` | `numeric` | ja |  | Differenz zwischen der CO2-Last eines vergleichbaren Pkw und der des tatsächlich genutzten Fahrzeugs (rechenannahme co2_pkw minus co2_rad bzw. co2_ebike, beide in g CO2e/Pkm, daher /1000 für kg) für die gefahrenen Kilometer dieser Zeile. Basiert teilweise auf geschätzten Kilometern - siehe anteil_geschaetzt und fahrten_geschaetzt, ohne die diese Zahl unbelegt wäre. |

## `v_wawi_kunde` (Sicht)

Arbeitssicht des Kundenservice: Stammdaten, laufender Tarif und Kontostand je Kunde. Bewusst ohne einzelne Fahrten (Bewegungsprofil), ohne Zahlungsmittel (GR17) und ohne alles aus dem Schema auth - was niemand braucht, wird nicht ausgeliefert. Filtert selbst über velocity.hat_rolle. Seit der zweiten Demozugang-Runde zusätzlich für velocity.hat_rolle('demo') lesbar (0020_demo_zugang.sql) - ausdrückliche Entscheidung des Auftraggebers: die 1014 Kundensätze sind vollständig erfundene Musterdaten, keine echten Personen. Schreiben bleibt gesperrt: die vier api_kunde_*-Funktionen verlangen weiterhin 'kundenservice' (0019_wawi_logik.sql), unabhängig von dieser Sicht - wawi/kunden.js zeigt deshalb Speichern/Sperren/Auskunft/Löschung für 'demo' nicht an, obwohl der Bereich selbst jetzt sichtbar ist.

| Spalte | Datentyp | NULL | Vorgabe | Beschreibung |
|---|---|---|---|---|
| `kunde_id` | `bigint` | ja |  | Surrogatschlüssel, fachlich bedeutungslos und deshalb stabil. |
| `kundennummer` | `text` | ja |  | Fachlicher, am Telefon nennbarer Schlüssel des Kunden. |
| `anrede` | `text` | ja |  | Anrede für die Korrespondenz. |
| `vorname` | `text` | ja |  | Vorname des Kunden. |
| `nachname` | `text` | ja |  | Nachname des Kunden. |
| `email` | `text` | ja |  | Kontaktadresse, zugleich eindeutiges Merkmal für die Anmeldung. |
| `telefon` | `text` | ja |  | Telefonische Kontaktmöglichkeit, optional. |
| `status` | `velocity.kunde_status` | ja |  | aktiv, gesperrt oder geschlossen - der Kundenservice muss ihn sehen, um eine Sperre überhaupt erklären zu können. |
| `registriert_am` | `timestamp with time zone` | ja |  | Zeitpunkt der Registrierung, unabhängig vom technischen erstellt_am. |
| `strasse` | `text` | ja |  | Strasse der Rechnungsadresse. NULL, solange keine hinterlegt ist. |
| `hausnummer` | `text` | ja |  | Hausnummer der Rechnungsadresse. |
| `plz` | `text` | ja |  | Postleitzahl der Rechnungsadresse. |
| `ort` | `text` | ja |  | Ort der Rechnungsadresse. |
| `tarif_code` | `text` | ja |  | Fachlicher Schlüssel des aktuell laufenden Tarifs. NULL ohne aktive Mitgliedschaft. |
| `tarif` | `text` | ja |  | Anzeigename des aktuell laufenden Tarifs. |
| `mitgliedschaft_seit` | `date` | ja |  | Beginn der aktuell laufenden Mitgliedschaft (die mit offenem Ende, siehe upper_inf in der Sicht). NULL ohne aktive Mitgliedschaft. |
| `fahrten_gesamt` | `bigint` | ja |  | Anzahl abgeschlossener Ausleihen. Eine Summe statt einer Liste - siehe Kommentar am create view. |
| `fahrten_offen` | `bigint` | ja |  | Anzahl aktuell laufender Ausleihen, typischerweise null oder eins. |
| `umsatz_brutto` | `numeric` | ja |  | Summe aller Rechnungsbeträge des Kunden, unabhängig vom Zahlungsstatus. |
| `offener_betrag` | `numeric` | ja |  | Summe der gestellten, noch nicht bezahlten Rechnungen - der Betrag, um den es bei einer Mahnung geht. |
| `letzte_ausleihe_am` | `timestamp with time zone` | ja |  | Start der zeitlich juengsten Ausleihe (aktiv oder abgeschlossen, storniert zaehlt nicht) - siehe letzte_ausleihe_laeuft, ob sie noch andauert. NULL heisst: dieser Kunde hat noch nie ausgeliehen, kein Ladefehler. |
| `letzte_ausleihe_laeuft` | `boolean` | ja |  | true, wenn die unter letzte_ausleihe_am genannte Ausleihe noch laeuft (status aktiv); false, wenn sie abgeschlossen ist; NULL, wenn es noch keine Ausleihe gibt. |

## `v_wawi_kundenorte` (Sicht)

Kundschaft je Ort, aggregiert mit Koordinate fuer die Stationskarte (Gestaltungsauftrag Stationen, Punkt 4). Absichtlich ohne kunde_id, Name oder Adresse - siehe der ausfuehrliche Kopfkommentar am create view fuer die Begruendung, warum eine Zaehlung je Ort zulaessig ist, wo ein Punkt je Person es nicht waere. Filtert selbst ueber velocity.hat_rolle, seit dem Demozugang zusaetzlich velocity.hat_rolle('demo') (0020_demo_zugang.sql) - dieselbe Aggregation, die auch fuer disposition schon die Grenze zieht, gilt fuer 'demo' identisch, deshalb KEIN Widerspruch zum Ausschluss von v_wawi_kunde.

| Spalte | Datentyp | NULL | Vorgabe | Beschreibung |
|---|---|---|---|---|
| `ort` | `text` | ja |  | Ortsname laut Rechnungsadresse. |
| `latitude` | `numeric(9,6)` | ja |  | Breitengrad des Ortszentrums aus velocity.ort_koordinate. NULL, wenn der Ort dort (noch) nicht gepflegt ist - die Oberflaeche zeigt einen solchen Ort dann ohne Marke statt an einer geratenen Position. |
| `longitude` | `numeric(9,6)` | ja |  | Laengengrad des Ortszentrums, siehe latitude. |
| `kunden` | `bigint` | ja |  | Zahl der Kunden mit diesem Ort in der Rechnungsadresse - die Kennzahl, die die Aggregation zulaessig macht (siehe Kopfkommentar). |

## `v_wawi_modell` (Sicht)

Auswahlliste für die Radanlage. Entstanden beim Bau der Oberfläche, weil api_rad_anlegen eine modell_id verlangt und keine Sicht sie herausgab. Seit dem Demozugang zusätzlich für velocity.hat_rolle('demo') lesbar (0020_demo_zugang.sql) - der Demozugang liest die Auswahlliste ohnehin nie schreibend weiter, siehe dort.

| Spalte | Datentyp | NULL | Vorgabe | Beschreibung |
|---|---|---|---|---|
| `modell_id` | `bigint` | ja |  | Schlüssel des Modells, der Wert, den api_rad_anlegen als p_modell_id erwartet. |
| `hersteller` | `text` | ja |  | Name des Herstellers, für die Auswahlliste ohne Nachschlagen einer Nummer. |
| `modellbezeichnung` | `text` | ja |  | Der Produktname, identisch mit dem Anzeigenamen des Typs (Spalte typ) - zusammen mit hersteller die lesbare Kennung des Eintrags, weil mehrere Hersteller dasselbe Produkt zur selben Spezifikation liefern können. |
| `typ_id` | `bigint` | ja |  | Schlüssel des Fahrradtyps, falls die Oberfläche danach filtert oder gruppiert. |
| `typ_code` | `text` | ja |  | Fachlicher Schlüssel des Fahrradtyps. |
| `typ` | `text` | ja |  | Anzeigename des Fahrradtyps. |
| `hat_elektro` | `boolean` | ja |  | Wahr bei einem Modell mit Elektroantrieb - hilft der Auswahlliste, City- von E-Bike-Modellen zu unterscheiden, ohne den Typnamen zu parsen. |
| `zuladung_kg` | `integer` | ja |  | Maximale Zuladung des Fahrradtyps laut Stammdaten. NULL, wenn der Typ keine Zuladungsgrenze führt. |
| `raeder_im_bestand` | `bigint` | ja |  | Zahl der nicht ausgemusterten Räder dieses Modells im Bestand - zeigt an, was üblich ist, ohne dass jemand in der Flottensicht nachsehen muss. |
| `baujahr` | `integer` | ja |  | Baujahr laut Stammdaten - das Jahr, seit dem der Hersteller dieser Modellzeile den Typ beliefert. |
| `gewicht_kg` | `numeric(4,1)` | ja |  | Leergewicht des Fahrradtyps laut Stammdaten - gilt für jedes Modell dieses Typs gleich, unabhängig vom Hersteller. |
| `gangzahl` | `integer` | ja |  | Zahl der Gänge des Fahrradtyps laut Stammdaten - gilt für jedes Modell dieses Typs gleich, unabhängig vom Hersteller. |
| `rahmenhoehe_cm` | `integer` | ja |  | Rahmenhöhe des Fahrradtyps laut Stammdaten - eine Größe je Typ, individuelle Anpassung läuft über den Sattel-Schnellspanner. |
| `akkukapazitaet_wh` | `integer` | ja |  | Akkukapazität des Fahrradtyps laut Stammdaten. NULL bei einem Modell ohne Elektroantrieb. |
| `reichweite_km` | `integer` | ja |  | Herstellerangabe zur Reichweite des Fahrradtyps laut Stammdaten. NULL bei einem Modell ohne Elektroantrieb. |

## `v_wawi_schaden` (Sicht)

Arbeitssicht der Werkstatt: jede Schadensmeldung mit Rad, Schwere und Alter, unabhängig vom Bearbeitungsstand. Filtert selbst über velocity.hat_rolle. Seit dem Demozugang zusätzlich für velocity.hat_rolle('demo') lesbar (0020_demo_zugang.sql). Bewusst OHNE disposition (Spec 5.1 nennt nur werkstatt) - Gesamtprüfung Punkt 3: die Disposition sieht ihren Bedarf für die Flottenplanung, offene Schäden je Rad, bereits über v_wawi_flotte.offene_schaeden und .hoechste_schwere. Freitext (kategorie, beschreibung) und melderart braucht sie dafür nicht - "was niemand braucht, wird nicht ausgeliefert" (Spec 4.2). Ein früherer Entwurf liess disposition hier zusätzlich zu; das war derselbe Rechteüberschuss, der bei v_wawi_umsatz_radtyp weiter unten schon einmal zurückgenommen wurde.

| Spalte | Datentyp | NULL | Vorgabe | Beschreibung |
|---|---|---|---|---|
| `schadensmeldung_id` | `bigint` | ja |  | Surrogatschlüssel, fachlich bedeutungslos und deshalb stabil. |
| `fahrrad_id` | `bigint` | ja |  | Das gemeldete Rad. |
| `rahmennummer` | `text` | ja |  | Am Rahmen ablesbare Nummer des gemeldeten Rades. |
| `typ_code` | `text` | ja |  | Fahrradtyp des gemeldeten Rades, für Filter in der Werkstattliste. |
| `gemeldet_am` | `timestamp with time zone` | ja |  | Zeitpunkt der Meldung. |
| `melderart` | `text` | ja |  | "Kunde" oder "Mitarbeiter" - wer gemeldet hat, nicht wer genau. Für die Werkstatt zählt nur die Herkunft der Meldung, eine Rückfrage läuft über den Kundenservice bzw. die Personalliste, nicht über diese Sicht. |
| `kategorie` | `text` | ja |  | Freitextliche Grobeinordnung des Schadens, etwa Bremse oder Licht. |
| `beschreibung` | `text` | ja |  | Freitext des Melders, was am Rad auffiel. |
| `schwere` | `velocity.schaden_schwere` | ja |  | Einordnung der Dringlichkeit; fahruntauglich sperrt das Rad faktisch für die Werkstattplanung. |
| `status` | `velocity.schaden_status` | ja |  | Bearbeitungsstand der Meldung: offen, in_arbeit, behoben oder verworfen. |
| `offen_seit` | `interval` | ja |  | Zeitspanne seit der Meldung bis jetzt - die Wartezeit, nicht ein fester Zeitpunkt, damit sie beim nächsten Aufruf automatisch weiterläuft. |
| `auftraege` | `bigint` | ja |  | Zahl der Wartungsaufträge, die aus dieser Meldung entstanden sind. Mehr als einer zeigt einen wiederholten oder nachgebesserten Fall an. |

## `v_wawi_station` (Sicht)

Arbeitssicht der Disposition: Kapazitaet und Belegung je Station, samt stillgelegter Stationen (GR22 - eine Station wird stillgelegt, nicht gelöscht, deshalb bleibt sie hier sichtbar statt zu verschwinden). Filtert selbst über velocity.hat_rolle. Seit dem Demozugang zusätzlich für velocity.hat_rolle('demo') lesbar (0020_demo_zugang.sql).

| Spalte | Datentyp | NULL | Vorgabe | Beschreibung |
|---|---|---|---|---|
| `station_id` | `bigint` | ja |  | Surrogatschlüssel, fachlich bedeutungslos und deshalb stabil. |
| `stationsnummer` | `text` | ja |  | Fachlicher Schlüssel der Station. |
| `name` | `text` | ja |  | Anzeigename der Station. |
| `strasse` | `text` | ja |  | Strasse des Stationsstandorts. |
| `hausnummer` | `text` | ja |  | Hausnummer des Stationsstandorts. |
| `plz` | `text` | ja |  | Postleitzahl des Stationsstandorts. |
| `ort` | `text` | ja |  | Ort des Stationsstandorts. |
| `latitude` | `numeric(9,6)` | ja |  | Breitengrad für den Kartenmarker. |
| `longitude` | `numeric(9,6)` | ja |  | Längengrad für den Kartenmarker. |
| `kapazitaet` | `integer` | ja |  | Zahl der Stellplätze laut Stammdaten. |
| `belegt` | `bigint` | ja |  | Zahl der Räder, die aktuell an dieser Station stehen. |
| `frei` | `bigint` | ja |  | Kapazitaet abzüglich belegt. Anders als die öffentliche v_station ohne greatest(..., 0): GR15 verhindert Überfüllung bereits beim Abstellen, ein negativer Wert wäre hier also ein Alarmsignal und keine Zahl, die kaschiert werden sollte. |
| `betriebszeitraum` | `daterange` | ja |  | Zeitraum, in dem die Station betrieben wird oder wurde. Offenes Ende bedeutet weiterhin in Betrieb. |
| `in_betrieb` | `boolean` | ja |  | Wahr, solange betriebszeitraum kein Ende trägt. Kurzform für die Oberfläche, ohne dass sie den Bereichstyp selbst auswerten muss. |

## `v_wawi_station_flotte` (Sicht)

Welche Raeder stehen an welcher Station (Gestaltungsauftrag Stationen, Punkt 1) - dieselben Spalten wie v_wawi_flotte, aber ueber station_id gefiltert statt ueber den Namenstext v_wawi_flotte.standort, der keine unique-Constraint traegt (siehe Kopfkommentar am create view). Nur Raeder MIT Station (fp.station_id is not null) - ein Rad auf freier Ausleihe gehoert in keine Stationsdetailmaske. Filtert selbst ueber velocity.hat_rolle, dieselben Rollen wie v_wawi_station, seit dem Demozugang zusaetzlich velocity.hat_rolle('demo') (0020_demo_zugang.sql).

| Spalte | Datentyp | NULL | Vorgabe | Beschreibung |
|---|---|---|---|---|
| `station_id` | `bigint` | ja |  | Schluessel der Station, der Filterschluessel dieser Sicht (station_id=eq.<id>). |
| `fahrrad_id` | `bigint` | ja |  | Schluessel des Rades, fuer den Sprung in die Flottensicht (v_wawi_flotte). |
| `rahmennummer` | `text` | ja |  | Am Rahmen ablesbare Nummer, der Bezug zum physischen Rad vor Ort. |
| `typ_code` | `text` | ja |  | Fachlicher Schluessel des Fahrradtyps. |
| `typ` | `text` | ja |  | Anzeigename des Fahrradtyps. |
| `status` | `velocity.fahrrad_status` | ja |  | Aktueller Betriebsstatus des Rades - verfuegbar, ausgeliehen, wartung, defekt oder ausgemustert. Ein Rad mit Status ausgeliehen sollte hier praktisch nicht auftauchen (fahrrad_position wird bei der Ausleihe geraeumt); steht es trotzdem noch da, ist das ein Hinweis auf eine unsaubere Rueckgabe, kein Softwarefehler dieser Sicht. |
| `akkustand_prozent` | `smallint` | ja |  | Ladestand des Akkus. NULL bei Raedern ohne Elektroantrieb. |
| `offene_schaeden` | `bigint` | ja |  | Zahl der noch nicht abgeschlossenen Schadensmeldungen (offen oder in_arbeit). |
| `hoechste_schwere` | `text` | ja |  | Schwerste noch offene Meldung nach der natuerlichen Rangfolge des ENUM (gering < mittel < fahruntauglich), nicht alphabetisch. NULL, wenn keine offene Meldung vorliegt. |

## `v_wawi_stationsauslastung` (Sicht)

Zu- und Abgaenge sowie aktueller Fuellstand je Station, für Disposition und Leitung. Zählt ausschliesslich abgeschlossene Ausleihen - eine laufende Fahrt hat an ihrer Endstation noch keinen Zugang. Filtert selbst über velocity.hat_rolle. Seit dem Demozugang zusätzlich für velocity.hat_rolle('demo') lesbar (0020_demo_zugang.sql).

| Spalte | Datentyp | NULL | Vorgabe | Beschreibung |
|---|---|---|---|---|
| `station_id` | `bigint` | ja |  | Schlüssel der Station. |
| `stationsnummer` | `text` | ja |  | Fachlicher Schlüssel der Station. |
| `name` | `text` | ja |  | Anzeigename der Station. |
| `kapazitaet` | `integer` | ja |  | Zahl der Stellplätze laut Stammdaten, Nenner von fuellstand. |
| `abgaenge` | `bigint` | ja |  | Zahl der abgeschlossenen Ausleihen, die an dieser Station begonnen haben - wie oft ein Rad hier abgeholt wurde. |
| `zugaenge` | `bigint` | ja |  | Zahl der abgeschlossenen Ausleihen, die an dieser Station geendet haben - wie oft ein Rad hier abgestellt wurde. |
| `saldo` | `bigint` | ja |  | zugaenge minus abgaenge. Positiv heisst, die Station sammelt über die Zeit mehr Räder an, als sie abgibt - ein Hinweis für die Disposition, wo nachverteilt werden muss. |
| `belegt` | `bigint` | ja |  | Zahl der Räder, die aktuell laut fahrrad_position an dieser Station stehen - der Momentanwert, anders als abgaenge/zugaenge, die über die gesamte Historie zählen. |
| `fuellstand` | `numeric` | ja |  | belegt geteilt durch kapazitaet, gerundet auf drei Nachkommastellen. NULL bei einer Station ohne Stellplätze (kapazitaet = 0), was laut station_kapazitaet_chk nicht vorkommen sollte, aber nullif schützt vor einer Division durch null statt einem Fehler ohne Kontext. |

## `v_wawi_stationsverkehr_zeitfenster` (Sicht)

Zu- und Abgang je Station in Zweistundenbloecken, getrennt nach Werktag und Wochenende, gemittelt ueber den gesamten verfuegbaren Zeitraum (Gestaltungsauftrag Stationen, Punkt 3) - siehe Kopfkommentar am create view fuer die nachgemessene Begruendung von Blockgroesse, Wochentagstrennung und Mittelungszeitraum. Aggregat ohne Personenbezug: keine ausleihe_id, keine kunde_id, kein Kalendertag. Filtert selbst ueber velocity.hat_rolle, dieselben Rollen wie v_wawi_stationsauslastung, seit dem Demozugang zusaetzlich velocity.hat_rolle('demo') (0020_demo_zugang.sql).

| Spalte | Datentyp | NULL | Vorgabe | Beschreibung |
|---|---|---|---|---|
| `station_id` | `bigint` | ja |  | Schluessel der Station. |
| `name` | `text` | ja |  | Anzeigename der Station. |
| `wochentyp` | `text` | ja |  | 'werktag' (Montag bis Freitag) oder 'wochenende' (Samstag/Sonntag) - getrennt gehalten, weil beide nachweislich unterschiedliche Tagesrhythmen zeigen, siehe Kopfkommentar. |
| `zeitfenster_start_stunde` | `integer` | ja |  | Erste Stunde des Zweistundenblocks (0, 2, 4, ... 22) in lokaler Datenbankzeit. Der Block umfasst diese und die folgende Stunde. |
| `abgaenge` | `bigint` | ja |  | Summe der abgeschlossenen Ausleihen, die in diesem Block an dieser Station begonnen haben, ueber den GESAMTEN erfassten Zeitraum (nicht je Tag) - der Zaehler zu abgaenge_je_tag. |
| `zugaenge` | `bigint` | ja |  | Summe der abgeschlossenen Ausleihen, die in diesem Block an dieser Station geendet haben, ueber den gesamten erfassten Zeitraum - der Zaehler zu zugaenge_je_tag. |
| `abgaenge_je_tag` | `numeric` | ja |  | abgaenge geteilt durch tage_erfasst - die vergleichbare Rate, weil Werktage (428) und Wochenendtage (171) im Zeitraum unterschiedlich haeufig sind. Das ist die Zahl fuer die Grafik, nicht die rohe Summe abgaenge. |
| `zugaenge_je_tag` | `numeric` | ja |  | zugaenge geteilt durch tage_erfasst, siehe abgaenge_je_tag. |
| `saldo_je_tag` | `numeric` | ja |  | zugaenge_je_tag minus abgaenge_je_tag. Positiv heisst, die Station sammelt in diesem Zeitfenster im Mittel mehr Raeder an, als sie abgibt - der Hinweis, wann nachverteilt werden muss. |
| `tage_erfasst` | `bigint` | ja |  | Zahl der Werktage bzw. Wochenendtage im gesamten erfassten Zeitraum (Nenner von abgaenge_je_tag/zugaenge_je_tag/saldo_je_tag) - macht sichtbar, auf wie vielen Tagen die Rate beruht, statt eine Genauigkeit vorzutaeuschen, die eine einzelne Randstunde mit wenigen Fahrten nicht hat. |

## `v_wawi_umsatz_kundengruppe` (Sicht)

Monatsumsatz je Tarifgruppe für die Leitung. Die Gruppe ist der Tarif zum Zeitpunkt der Fahrt (a.mitgliedschaft_id), nicht der heutige - siehe Kommentar am create view. sum(ep.betrag) ohne zweite Multiplikation mit vorzeichen, wie bei v_wawi_umsatz_radtyp. Filtert selbst über velocity.hat_rolle. Seit dem Demozugang zusätzlich für velocity.hat_rolle('demo') lesbar (0020_demo_zugang.sql) - eine Gruppenaggregation (Tarifgruppe je Monat), kein Einzelkunde.

| Spalte | Datentyp | NULL | Vorgabe | Beschreibung |
|---|---|---|---|---|
| `monat` | `date` | ja |  | Erster Tag des Monats der Fahrt. |
| `tarif_code` | `text` | ja |  | Fachlicher Schlüssel des Tarifs zum Fahrtzeitpunkt, oder OHNE ohne zugeordnete Mitgliedschaft (etwa Einzelfahrten ohne Vertrag). |
| `tarif` | `text` | ja |  | Anzeigename des Tarifs, oder "Ohne Mitgliedschaft" als Sammelgruppe. |
| `kunden` | `bigint` | ja |  | Zahl der verschiedenen Kunden dieser Gruppe im Monat. |
| `fahrten` | `bigint` | ja |  | Zahl der abgeschlossenen Ausleihen dieser Gruppe im Monat. |
| `umsatz` | `numeric` | ja |  | Summe der Entgeltpositionen (ep.betrag), bereits vorzeichenbehaftet - siehe Kopfkommentar von v_wawi_umsatz_radtyp. |
| `umsatz_je_kunde` | `numeric` | ja |  | umsatz geteilt durch kunden, die Kennzahl für den Vergleich zwischen Tarifgruppen unabhängig von deren Kundenzahl. |

## `v_wawi_umsatz_radtyp` (Sicht)

Monatsumsatz je Fahrradtyp, ausschliesslich für die Leitung - die Spec reserviert Auswertungen für diese Rolle, disposition bekommt nur die Stationsauslastung. sum(ep.betrag) ohne zweite Multiplikation mit vorzeichen - siehe Kommentar am create view. Filtert selbst über velocity.hat_rolle. Seit dem Demozugang zusätzlich für velocity.hat_rolle('demo') lesbar (0020_demo_zugang.sql) - eine Monatsaggregation ohne Personenbezug.

| Spalte | Datentyp | NULL | Vorgabe | Beschreibung |
|---|---|---|---|---|
| `monat` | `date` | ja |  | Erster Tag des Monats der Fahrt (startzeit), Gruppierungsschlüssel für einen Zeitverlauf statt einer bedeutungslosen Jahressumme. |
| `typ_code` | `text` | ja |  | Fachlicher Schlüssel des Fahrradtyps. |
| `typ` | `text` | ja |  | Anzeigename des Fahrradtyps. |
| `fahrten` | `bigint` | ja |  | Zahl der abgeschlossenen Ausleihen dieses Typs im Monat. |
| `minuten` | `bigint` | ja |  | Summe der Fahrtdauer in Minuten, die Auslastungsseite neben dem Umsatz. |
| `umsatz` | `numeric` | ja |  | Summe der Entgeltpositionen (ep.betrag), bereits vorzeichenbehaftet aus fn_position_anlegen. Keine zweite Multiplikation mit vorzeichen - das würde Rabatte und Kappungen zu Einnahmen machen, siehe Kopfkommentar. |
| `umsatz_je_fahrt` | `numeric` | ja |  | umsatz geteilt durch fahrten, die Kennzahl für den Vergleich zwischen Radtypen unabhängig von deren Flottengrösse. |

## `v_wawi_wartungsprognose` (Sicht)

Arbeitssicht der eingefrorenen Prüflisten: ein Rad je Zeile mit Platz, Dringlichkeit, Standort und den Zahlen, die den Platz begründen. Filtert selbst über velocity.hat_rolle.

| Spalte | Datentyp | NULL | Vorgabe | Beschreibung |
|---|---|---|---|---|
| `stichtag` | `date` | ja |  | Tag, für den die Liste gerechnet wurde. |
| `rang` | `integer` | ja |  | Platz auf der Liste, 1 = zuerst prüfen. |
| `fahrrad_id` | `bigint` | ja |  | Das Rad, für den Sprung in die Flotte. |
| `rahmennummer` | `text` | ja |  | Die Nummer, unter der die Werkstatt das Rad sucht. |
| `typ_code` | `text` | ja |  | Kurzschlüssel des Radtyps (CITY, EBIKE, CARGO). |
| `typ` | `text` | ja |  | Ausgeschriebener Name des Radtyps. |
| `radstatus` | `velocity.fahrrad_status` | ja |  | Heutiger Status des Rades - kann sich seit dem Stichtag geändert haben. |
| `standort` | `text` | ja |  | Station, an der das Rad zuletzt stand. NULL, wenn es frei abgestellt wurde. |
| `nutzungsquote` | `numeric(8,3)` | ja |  | Der Rangwert: Fahrminuten seit der Reparatur, geteilt durch den Median des Radtyps. |
| `fahrminuten_seit_reparatur` | `numeric(12,1)` | ja |  | Der Zähler der Quote, je Fahrt bei 300 Minuten gekappt. |
| `typ_median_minuten` | `numeric(12,1)` | ja |  | Der Nenner der Quote. |
| `fahrten_seit_reparatur` | `integer` | ja |  | Auf wievielen Fahrten die Minuten beruhen. |
| `fahrminuten_180` | `numeric(12,1)` | ja |  | Fahrminuten der letzten 180 Tage. |
| `km_gemessen` | `numeric(12,2)` | ja |  | Gemessene Kilometer im selben Zeitraum - Zusatzangabe, nicht der Rangwert. |
| `anteil_mit_distanz` | `numeric(4,3)` | ja |  | Anteil der Fahrten mit gemeldeter Strecke. Sagt, wieviel km_gemessen wert ist. |
| `letzte_reparatur` | `date` | ja |  | Tag der letzten erledigten Reparatur, NULL wenn nie repariert. |
| `meldungen_bisher` | `integer` | ja |  | Zahl der bisherigen Schadensmeldungen bis zum Stichtag. |
| `regelversion` | `text` | ja |  | Welche Regel die Reihenfolge bestimmt hat. |
| `gilt_bis` | `date` | ja |  | Ende des Vorhersagefensters. |
| `betriebsmodus` | `text` | ja |  | probelauf: die Liste ordnet keine Reparatur an. |
| `dringlichkeit` | `text` | ja |  | Reihenfolge des Arbeitstags: zuerst (Platz 1-20), danach (21-40), wenn Zeit bleibt (ab 41). |
