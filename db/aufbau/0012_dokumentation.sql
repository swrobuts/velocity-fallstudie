-- =====================================================================
-- 0012 Dokumentation
--
-- Zweck:      Beschreibt jedes Objekt des Schemas im Systemkatalog.
--             Das Data Dictionary wird daraus erzeugt statt getippt und
--             kann deshalb nicht veralten.
-- Objekte:    COMMENT ON fuer alle Tabellen, Sichten und Spalten;
--             Sicht velocity.v_data_dictionary
-- Ruecknahme: COMMENT ON ... IS NULL; DROP VIEW v_data_dictionary;
--
-- Regel fuer Spaltenkommentare: sage, was fachlich gilt, nicht was der
-- Spaltenname schon sagt. "Nachname des Kunden" ist wertlos.
-- "NULL, solange das Rad frei abgestellt ist" ist die Information, die
-- jemand braucht.
-- =====================================================================

comment on schema velocity is
  'Datenhaltung der Bike-Sharing-Anwendung VeloCity (Fallstudie Datenmodellierung)';

-- ===================== Bereich A: Geschaeftspartner ==================

comment on table velocity.adresse is
  'Postanschrift. Eigenständige Entität, weil sie von Kunde, Station, Lieferant und Lager gebraucht wird.';
comment on column velocity.adresse.adresse_id is 'Surrogatschlüssel, fachlich bedeutungslos und deshalb stabil.';
comment on column velocity.adresse.strasse    is 'Straßenname ohne Hausnummer.';
comment on column velocity.adresse.hausnummer is 'NOT NULL mit Vorgabe leerer Text: in einem UNIQUE-Index gelten zwei NULL-Werte als verschieden, der Fachschlüssel würde sonst keine Dubletten verhindern.';
comment on column velocity.adresse.plz        is 'Postleitzahl. Für land_code DE auf fünf Ziffern geprüft.';
comment on column velocity.adresse.ort        is 'Ortsname. Bewusst NICHT aus der PLZ abgeleitet: in Deutschland ist plz -> ort keine saubere funktionale Abhängigkeit.';
comment on column velocity.adresse.land_code  is 'Länderkennung nach ISO 3166-1 alpha-2, Vorgabe DE.';

comment on table velocity.kunde is
  'Geschäftspartner auf der Nachfrageseite. Die Anmeldung liegt bei Supabase Auth, hier steht kein Passwort.';
comment on column velocity.kunde.kunde_id            is 'Surrogatschlüssel.';
comment on column velocity.kunde.kundennummer        is 'Fachlicher Schlüssel im Format K-000000, nach außen kommunizierbar. Wird aus seq_kundennummer vergeben.';
comment on column velocity.kunde.auth_uid            is 'Verbindung zum Anmeldekonto in auth.users. NULL bei Konten ohne Login, etwa aus der Datenübernahme.';
comment on column velocity.kunde.email               is 'Eindeutige Kontaktadresse, zugleich Verknüpfungsmerkmal zum Anmeldekonto.';
comment on column velocity.kunde.anrede              is 'Freitext für die Anschrift, keine geschlossene Werteliste.';
comment on column velocity.kunde.vorname             is 'Vorname laut Selbstauskunft.';
comment on column velocity.kunde.nachname            is 'Nachname laut Selbstauskunft.';
comment on column velocity.kunde.geburtsdatum        is 'Grundlage der Altersgrenze von 16 Jahren. Geprüft in api_profil_aktualisieren, nicht per CHECK: eine Bedingung mit current_date wäre nicht immutable.';
comment on column velocity.kunde.telefon             is 'Rufnummer, unformatiert gespeichert.';
comment on column velocity.kunde.rechnungsadresse_id is 'Anschrift für die Rechnungsstellung. NULL, solange keine hinterlegt ist.';
comment on column velocity.kunde.status              is 'aktiv, gesperrt oder geschlossen. Nur aktive Kunden dürfen ausleihen.';
comment on column velocity.kunde.registriert_am      is 'Fachlicher Zeitpunkt der Anmeldung, unabhängig von der technischen Audit-Spalte.';

-- ===================== Bereich B: Netz und Flotte ====================

comment on table velocity.station is
  'Fester Standort mit Stellplätzen, an dem Räder entliehen und abgestellt werden.';
comment on column velocity.station.station_id       is 'Surrogatschlüssel.';
comment on column velocity.station.stationsnummer   is 'Fachlicher Schlüssel im Format S-0000.';
comment on column velocity.station.name             is 'Anzeigename auf der Karte, etwa Hauptbahnhof.';
comment on column velocity.station.adresse_id       is 'Anschrift der Station.';
comment on column velocity.station.latitude         is 'Breitengrad in Dezimalgrad, WGS 84.';
comment on column velocity.station.longitude        is 'Längengrad in Dezimalgrad, WGS 84.';
comment on table  velocity.geschaeftsgebiet is
  'Fläche, innerhalb derer ein Rad überall abgestellt werden darf. Stand '
  'früher fest im JavaScript der Karte - eine Regel ohne Durchsetzung.';
comment on column velocity.geschaeftsgebiet.gebiet_id is 'Surrogatschlüssel.';
comment on column velocity.geschaeftsgebiet.name      is 'Name des Gebiets, zugleich Fachschlüssel.';
comment on column velocity.geschaeftsgebiet.flaeche   is
  'Das Vieleck als eingebauter Typ polygon, in der Reihenfolge (Längengrad, Breitengrad). '
  'Punkt-in-Fläche prüft der Operator @>; PostGIS wird dafür nicht gebraucht.';
comment on column velocity.geschaeftsgebiet.aktiv     is 'Nur aktive Gebiete gelten.';

comment on view   velocity.v_geschaeftsgebiet is 'Öffentliche Umrisse der aktiven Geschäftsgebiete.';
comment on column velocity.v_geschaeftsgebiet.gebiet_id is 'Schlüssel des Gebiets.';
comment on column velocity.v_geschaeftsgebiet.name      is 'Name des Gebiets.';
comment on column velocity.v_geschaeftsgebiet.umriss    is
  'Das Vieleck als Text, Form ((Länge,Breite),…). Die Karte zeichnet daraus ihren Umriss.';

comment on table  velocity.hoehenmarke is
  'Markante Höhen rund um Würzburg als Bezugspunkte der Höhengrafik. Keine '
  'Stationen, aber Redaktionsinhalt - deshalb in der Datenbank und nicht im Frontend.';
comment on column velocity.hoehenmarke.marke_id   is 'Surrogatschlüssel.';
comment on column velocity.hoehenmarke.name       is 'Name der Höhe, zugleich Fachschlüssel.';
comment on column velocity.hoehenmarke.hoehe_m    is
  'Höhe in Metern, bestimmt wie station.hoehe_m gegen zwei Geländemodelle und gemittelt. '
  'Genommen wurde das Maximum eines Rasters um den Ort - der Gipfel, nicht ein Punkt am Hang.';
comment on column velocity.hoehenmarke.latitude   is 'Breitengrad des gemessenen Punktes.';
comment on column velocity.hoehenmarke.longitude  is 'Längengrad des gemessenen Punktes.';
comment on column velocity.hoehenmarke.quelle     is 'Herkunft des Höhenwerts, für die Bildunterschrift.';
comment on column velocity.hoehenmarke.sortierung is 'Reihenfolge in der Grafik, absteigend nach Höhe.';

comment on view   velocity.v_hoehenmarke is 'Öffentliche Bezugshöhen für die Höhengrafik.';
comment on column velocity.v_hoehenmarke.marke_id  is 'Schlüssel der Höhenmarke.';
comment on column velocity.v_hoehenmarke.name      is 'Name der Höhe.';
comment on column velocity.v_hoehenmarke.hoehe_m   is 'Höhe in Metern. Siehe hoehenmarke.hoehe_m zur Genauigkeit.';
comment on column velocity.v_hoehenmarke.latitude  is 'Breitengrad.';
comment on column velocity.v_hoehenmarke.longitude is 'Längengrad.';
comment on column velocity.v_hoehenmarke.quelle    is 'Herkunft des Höhenwerts.';

comment on column velocity.station.hoehe_m is
  'Höhenlage in Metern, aus den Koordinaten gegen zwei unabhängige Geländemodelle '
  'bestimmt (Copernicus GLO-30 und EU-DEM v1.1) und gemittelt. Beides sind '
  'Oberflächenmodelle: in bebautem Gebiet liegen sie rund zehn Meter zu hoch. '
  'Belastbar sind deshalb die Unterschiede, nicht die absoluten Werte - und genau '
  'die Unterschiede trägt die Anwendung vor. Gesetzt in '
  'db/betrieb/stationslage_korrigieren.sql.';
comment on column velocity.v_station.hoehe_m is
  'Höhenlage der Station. Siehe station.hoehe_m zur Herkunft und zur Genauigkeit.';
comment on column velocity.station.kapazitaet       is 'Anzahl der Stellplätze, muss größer als null sein.';
comment on column velocity.station.betriebszeitraum is 'Zeitraum, in dem die Station betrieben wird. Halboffen; nach oben offen bedeutet: weiterhin in Betrieb.';

comment on table velocity.fahrradtyp is
  'Fachliche Klasse eines Rades (City, E-Bike, Cargo) - zugleich das einzige Produkt dieser Klasse. Trägt bewusst keine Preise - die stehen zeitabhängig in nutzungspreis.';
comment on column velocity.fahrradtyp.typ_id       is 'Surrogatschlüssel.';
comment on column velocity.fahrradtyp.typ_code     is 'Fachlicher Schlüssel für die Anwendung: CITY, EBIKE, CARGO.';
comment on column velocity.fahrradtyp.bezeichnung  is 'Name auf der Website, etwa E-Cargo Loader. Zugleich der Produktname, den jede Modellzeile in fahrradmodell für diesen Typ trägt - ein Verleiher bietet ein City-Bike an, keine Modellpalette.';
comment on column velocity.fahrradtyp.beschreibung is 'Fließtext für die Tarifkarte.';
comment on column velocity.fahrradtyp.hat_elektro  is 'Wahr bei Pedelec und E-Lastenrad. Steuert die Akkuanzeige auf der Karte.';
comment on column velocity.fahrradtyp.zuladung_kg  is 'Zulässige Zuladung in Kilogramm.';
comment on column velocity.fahrradtyp.gewicht_kg is
  'Leergewicht in Kilogramm, für jedes Rad dieses Typs gleich - Hersteller fertigen zu dieser Vorgabe, sie handeln sie nicht aus. Ursprünglich an fahrradmodell, auf Kundeneinwand hierher verschoben: unterschiedliche Werte je Modell hätten unterschiedliche Preise verlangt, aber der Tarif hängt am Typ, nicht am Modell.';
comment on column velocity.fahrradtyp.gangzahl is
  'Zahl der Gänge der Schaltung, für jedes Rad dieses Typs gleich. Siehe gewicht_kg zur Begründung, warum das hier steht und nicht an fahrradmodell.';
comment on column velocity.fahrradtyp.rahmenhoehe_cm is
  'Rahmenhöhe in Zentimetern, für jedes Rad dieses Typs dieselbe eine Größe - kein L/XL-Sortiment: ein Leihrad hat eine Rahmengröße, die individuelle Anpassung an die fahrende Person läuft über den Sattel-Schnellspanner, nicht über eine Modellwahl. Siehe gewicht_kg zur Begründung des Spaltenumzugs von fahrradmodell.';
comment on column velocity.fahrradtyp.akkukapazitaet_wh is
  'Kapazität des Akkus in Wattstunden, für jedes Rad dieses Typs gleich. NULL bei einem Typ ohne Elektroantrieb (hat_elektro = falsch). Siehe gewicht_kg zur Begründung des Spaltenumzugs von fahrradmodell.';
comment on column velocity.fahrradtyp.reichweite_km is
  'Herstellerangabe zur Reichweite je Akkuladung in Kilometern, für jedes Rad dieses Typs gleich - beim E-Bike Sport identisch mit der auf der Tarifkarte beworbenen Reichweite bis 50 km (siehe fahrradtyp.beschreibung). NULL bei einem Typ ohne Elektroantrieb. Siehe gewicht_kg zur Begründung des Spaltenumzugs von fahrradmodell.';

comment on table velocity.fahrradtyp_merkmal is
  'Werbliche Einzelmerkmale eines Fahrradtyps für die Tarifkarte der Website. Früher fest in index.html kodiert.';
comment on column velocity.fahrradtyp_merkmal.merkmal_id is 'Surrogatschlüssel.';
comment on column velocity.fahrradtyp_merkmal.typ_id     is 'Fahrradtyp, für den das Merkmal wirbt.';
comment on column velocity.fahrradtyp_merkmal.sortierung is 'Reihenfolge auf der Karte. Je Typ eindeutig.';
comment on column velocity.fahrradtyp_merkmal.merkmal    is 'Der Text des Aufzählungspunkts.';

comment on table velocity.hersteller is 'Produzent eines Fahrradmodells.';
comment on column velocity.hersteller.hersteller_id is 'Surrogatschlüssel.';
comment on column velocity.hersteller.name          is 'Firmenname, eindeutig. Bis zur Bereinigung in db/betrieb/flottenmodelle_stammdaten.sql kennzeichnete der Wert unbekannt Sätze aus der Datenübernahme ohne Herstellerangabe - dieser Platzhalter kommt im heutigen Bestand nicht mehr vor.';

comment on table velocity.fahrradmodell is
  'Welcher Hersteller das EINE Produkt eines Typs fertigt, und seit welchem Baujahr. Bindeglied zur Warenwirtschaft: Ersatzteile hängen am Modell, nicht am Einzelrad. Mehrere Zeilen je Typ sind normal und gewollt - ein Verleiher schreibt eine Spezifikation aus und bezieht sie von mehreren Herstellern, verkauft aber ein einziges Produkt (siehe fahrradtyp.bezeichnung, das jede Zeile hier unverändert übernimmt). Technische Angaben stehen deshalb NICHT hier, sondern an fahrradtyp - sie gelten je Spezifikation, nicht je Hersteller.';
comment on column velocity.fahrradmodell.modell_id         is 'Surrogatschlüssel.';
comment on column velocity.fahrradmodell.hersteller_id     is 'Produzent, der zur Spezifikation des Typs fertigt.';
comment on column velocity.fahrradmodell.typ_id            is 'Fachliche Klasse (das Produkt), zu der dieser Hersteller liefert.';
comment on column velocity.fahrradmodell.modellbezeichnung is 'Der Produktname - identisch mit fahrradtyp.bezeichnung des zugehörigen Typs, unabhängig vom Hersteller. Kein eigener Modellname je Hersteller: Kundschaft mietet ein City-Bike, keine Marke.';
comment on column velocity.fahrradmodell.baujahr           is 'Jahr, seit dem dieser Hersteller den Typ beliefert - nicht das Baujahr eines einzelnen Rades, das über mehrere Beschaffungschargen desselben Herstellers variieren kann.';

comment on table velocity.fahrrad is
  'Einzelnes physisches Fahrzeug der Flotte, eindeutig über die Rahmennummer.';
comment on column velocity.fahrrad.fahrrad_id      is 'Surrogatschlüssel.';
comment on column velocity.fahrrad.rahmennummer    is 'Fachlicher Schlüssel, am Rahmen eingeschlagen.';
comment on column velocity.fahrrad.modell_id       is 'Bauart des Rades.';
comment on column velocity.fahrrad.status          is 'verfügbar, ausgeliehen, wartung, defekt oder ausgemustert. Nur verfügbare Räder erscheinen auf der Karte.';
comment on column velocity.fahrrad.angeschafft_am  is 'Datum der Anschaffung.';
comment on column velocity.fahrrad.ausgemustert_am is 'Datum der Ausmusterung. NULL, solange das Rad im Bestand ist.';

comment on table velocity.fahrrad_position is
  'Aktueller Standort eines Rades. Als 1:1-Satellit geführt, damit die ständig änderlichen Bewegungsdaten die Stammdaten nicht berühren.';
comment on column velocity.fahrrad_position.fahrrad_id        is 'Zugleich Primär- und Fremdschlüssel: genau eine Position je Rad.';
comment on column velocity.fahrrad_position.station_id        is 'NULL bedeutet: das Rad steht frei abgestellt, nicht an einer Station';
comment on column velocity.fahrrad_position.latitude          is 'Breitengrad des freien Abstellorts. Steht das Rad an einer Station, gilt deren Koordinate.';
comment on column velocity.fahrrad_position.longitude         is 'Längengrad des freien Abstellorts.';
comment on column velocity.fahrrad_position.akkustand_prozent is 'Ladestand in Prozent. NULL bei Rädern ohne Akku - nicht null, das wäre ein leerer Akku.';
comment on column velocity.fahrrad_position.aktualisiert_am   is 'Fachlicher Zeitpunkt der letzten Ortung.';

-- ===================== Bereich C: Tarif und Preis ====================

comment on table velocity.tarif is 'Preismodell, in das sich ein Kunde einschreiben kann.';
comment on column velocity.tarif.tarif_id      is 'Surrogatschlüssel.';
comment on column velocity.tarif.tarif_code    is 'Fachlicher Schlüssel: BASIS, STUDENT, OEPNV, PREMIUM.';
comment on column velocity.tarif.bezeichnung   is 'Name auf der Website.';
comment on column velocity.tarif.art           is 'standard oder vorteil. Vorteilstarife setzen einen Nachweis voraus.';
comment on column velocity.tarif.voraussetzung is 'Nachweis, den der Kunde erbringen muss, etwa ein Studierendenausweis.';

comment on table velocity.tarif_kondition is
  'Zeitabhängige Konditionen eines Tarifs. Überschneidungsfrei durch EXCLUDE-Constraint.';
comment on column velocity.tarif_kondition.kondition_id          is 'Surrogatschlüssel.';
comment on column velocity.tarif_kondition.tarif_id              is 'Tarif, für den die Kondition gilt.';
comment on column velocity.tarif_kondition.gueltigkeit           is 'Halboffener Zeitraum. Je Tarif überschneidungsfrei: eine Preisänderung legt einen neuen Zeitraum an, statt den alten zu überschreiben.';
comment on column velocity.tarif_kondition.monatspreis           is 'Monatliches Entgelt in Euro. Bei VeloCity ist es in allen Tarifen null: die Startseite wirbt mit "0 Euro Anmeldegebühr", die Vorteilstarife bekommt man über einen Nachweis. Die Spalte bleibt, weil das Datenmodell den Fall tragen können soll.';
comment on column velocity.tarif_kondition.freiminuten_pro_monat is 'Monatliches Kontingent, das in freiminuten_periode gutgeschrieben wird.';
comment on column velocity.tarif_kondition.rabatt_prozent        is 'Nachlass auf die Zwischensumme einer Ausleihe. Wirkt VOR der Kappung auf den Tageshöchstpreis.';

comment on table velocity.mitgliedschaft is
  'Einschreibung eines Kunden in einen Tarif für einen Zeitraum. Je Kunde nie zwei gleichzeitig.';
comment on column velocity.mitgliedschaft.mitgliedschaft_id is 'Surrogatschlüssel. Wird beim Start einer Ausleihe dort festgeschrieben.';
comment on column velocity.mitgliedschaft.kunde_id          is 'Eingeschriebener Kunde.';
comment on column velocity.mitgliedschaft.tarif_id          is 'Gewählter Tarif.';
comment on column velocity.mitgliedschaft.gueltigkeit       is 'Halboffener Zeitraum. Je Kunde überschneidungsfrei - Geschäftsregel GR3, von der Datenbank erzwungen.';

comment on table velocity.freiminuten_periode is
  'Monatliches Freiminutenkontingent und dessen Verbrauch. Ersetzt einen mutierenden Zähler, damit der Verlauf rekonstruierbar bleibt.';
comment on column velocity.freiminuten_periode.periode_id         is 'Surrogatschlüssel.';
comment on column velocity.freiminuten_periode.mitgliedschaft_id  is 'Mitgliedschaft, zu der die Periode gehört.';
comment on column velocity.freiminuten_periode.jahr               is 'Kalenderjahr der Periode.';
comment on column velocity.freiminuten_periode.monat              is 'Kalendermonat der Periode, 1 bis 12. Je Mitgliedschaft und Monat genau eine Zeile.';
comment on column velocity.freiminuten_periode.kontingent_minuten is 'Gutgeschriebene Freiminuten des Monats. Der Bestand.';
comment on column velocity.freiminuten_periode.verbraucht_minuten is 'Bereits verrechnete Freiminuten. Die Bewegung. Kann das Kontingent nie übersteigen.';

comment on table velocity.nutzungspreis is
  'Zeitabhängiger Preis je Fahrradtyp. Bepreist wird mit dem zum Startzeitpunkt der Ausleihe gültigen Satz.';
comment on column velocity.nutzungspreis.preis_id          is 'Surrogatschlüssel. Wird in entgeltposition als Beleg der Preisfindung hinterlegt.';
comment on column velocity.nutzungspreis.typ_id            is 'Fahrradtyp, für den der Preis gilt.';
comment on column velocity.nutzungspreis.gueltigkeit       is 'Halboffener Zeitraum, je Typ überschneidungsfrei. Deshalb bleiben Altrechnungen nachvollziehbar bewertet.';
comment on column velocity.nutzungspreis.startgebuehr      is 'Einmaliges Entgelt je Ausleihe in Euro.';
comment on column velocity.nutzungspreis.preis_pro_minute  is 'Entgelt je angefangener Minute in Euro.';
comment on column velocity.nutzungspreis.tageshoechstpreis is 'Obergrenze je Ausleihe. Wird nach dem Tarifrabatt angewandt.';

-- ===================== Bereich D: Nutzung ============================

comment on table velocity.entgeltart is
  'Klassifikation der Abrechnungspositionen. Referenztabelle statt ENUM, weil sie mit vorzeichen ein eigenes Attribut trägt.';
comment on column velocity.entgeltart.entgeltart_id is 'Surrogatschlüssel.';
comment on column velocity.entgeltart.code          is 'Fachlicher Schlüssel, etwa ZEITENTGELT oder FREIMINUTEN. Wird von der Geschäftslogik angesprochen.';
comment on column velocity.entgeltart.bezeichnung   is 'Text für die Rechnung.';
comment on column velocity.entgeltart.vorzeichen    is 'Plus eins belastet, minus eins entlastet. Bestimmt das Vorzeichen des Betrags in entgeltposition.';

comment on table velocity.ausleihe is
  'Zentraler Geschäftsvorfall: ein Kunde nutzt ein Rad von einem Zeitpunkt bis zu einem anderen.';
comment on column velocity.ausleihe.ausleihe_id       is 'Surrogatschlüssel.';
comment on column velocity.ausleihe.kunde_id          is 'Ausleihender Kunde.';
comment on column velocity.ausleihe.fahrrad_id        is 'Genutztes Rad. Je Rad höchstens eine aktive Ausleihe - Geschäftsregel GR1 über einen partiellen Unique-Index.';
comment on column velocity.ausleihe.mitgliedschaft_id is 'Die zum Startzeitpunkt gültige Mitgliedschaft, hier festgeschrieben. Ein späterer Tarifwechsel verändert die Bepreisung damit nicht rückwirkend.';
comment on column velocity.ausleihe.start_station_id  is 'Station der Entnahme. NULL, wenn das Rad frei abgestellt war.';
comment on column velocity.ausleihe.start_latitude    is 'Breitengrad der Entnahme bei freiem Abstellort.';
comment on column velocity.ausleihe.start_longitude   is 'Längengrad der Entnahme bei freiem Abstellort.';
comment on column velocity.ausleihe.startzeit         is 'Beginn der Nutzung. Maßgeblich für die Preisfindung - Geschäftsregel GR5.';
comment on column velocity.ausleihe.end_station_id    is 'Station der Rückgabe. NULL bei freiem Abstellen.';
comment on column velocity.ausleihe.end_latitude      is 'Breitengrad der Rückgabe bei freiem Abstellort.';
comment on column velocity.ausleihe.end_longitude     is 'Längengrad der Rückgabe bei freiem Abstellort.';
comment on column velocity.ausleihe.endzeit           is 'Ende der Nutzung. NULL, solange die Ausleihe aktiv ist.';
comment on column velocity.ausleihe.status            is 'aktiv, abgeschlossen oder storniert. Aktiv und Endzeit schließen sich per CHECK gegenseitig aus.';
comment on column velocity.ausleihe.dauer_minuten     is 'Berechnete Spalte: angefangene Minuten, aufgerundet. Nicht beschreibbar - abgeleitete Werte werden abgeleitet, nicht gepflegt.';

comment on table velocity.entgeltposition is
  'Einzelposition der Abrechnung einer Ausleihe. Macht die Preisfindung Zeile für Zeile nachvollziehbar.';
comment on column velocity.entgeltposition.position_id      is 'Surrogatschlüssel.';
comment on column velocity.entgeltposition.ausleihe_id      is 'Ausleihe, zu der die Position gehört.';
comment on column velocity.entgeltposition.entgeltart_id    is 'Art der Position. Bestimmt über vorzeichen, ob belastet oder entlastet wird.';
comment on column velocity.entgeltposition.nutzungspreis_id is 'Beleg der Preisfindung: welcher Preissatz wurde angewandt. NULL bei Positionen ohne Preisbezug, etwa dem Tarifrabatt.';
comment on column velocity.entgeltposition.menge            is 'Bezugsmenge, beim Zeitentgelt die Anzahl Minuten.';
comment on column velocity.entgeltposition.einzelbetrag     is 'Betrag je Mengeneinheit, immer positiv.';
comment on column velocity.entgeltposition.betrag           is 'Wirksamer Betrag inklusive Vorzeichen. Die Summe aller Positionen ergibt den Preis der Ausleihe.';
comment on column velocity.entgeltposition.sortierung       is 'Reihenfolge auf der Rechnung: 10 Startgebühr, 20 Zeitentgelt, 30 Freiminuten, 40 Rabatt, 50 Kappung.';

-- ===================== Bereich E: Abrechnung =========================

comment on table velocity.zahlungsart is 'Verfahren der Bezahlung (SEPA, Kreditkarte, PayPal).';
comment on column velocity.zahlungsart.zahlungsart_id is 'Surrogatschlüssel.';
comment on column velocity.zahlungsart.code           is 'Fachlicher Schlüssel: SEPA, KREDITKARTE, PAYPAL.';
comment on column velocity.zahlungsart.bezeichnung    is 'Text für die Oberfläche.';

comment on table velocity.zahlungsmittel is
  'Beim Zahlungsdienstleister hinterlegtes Mittel eines Kunden. Gespeichert wird nur dessen Token, nie IBAN oder Kartennummer.';
comment on column velocity.zahlungsmittel.zahlungsmittel_id is 'Surrogatschlüssel.';
comment on column velocity.zahlungsmittel.kunde_id          is 'Kunde, dem das Zahlungsmittel gehört.';
comment on column velocity.zahlungsmittel.zahlungsart_id    is 'Verfahren dieses Zahlungsmittels.';
comment on column velocity.zahlungsmittel.referenz_token    is 'Token des Zahlungsdienstleisters. Was nicht gespeichert wird, kann nicht abfließen.';
comment on column velocity.zahlungsmittel.inhaber           is 'Name des Kontoinhabers laut Dienstleister.';
comment on column velocity.zahlungsmittel.gueltig_bis       is 'Ablaufdatum, bei Karten relevant.';
comment on column velocity.zahlungsmittel.ist_standard      is 'Vorbelegtes Zahlungsmittel. Je Kunde höchstens eines, über einen partiellen Unique-Index erzwungen.';

comment on table velocity.rechnung is
  'Monatlicher Beleg je Kunde über die Ausleihen einer Abrechnungsperiode.';
comment on column velocity.rechnung.rechnung_id       is 'Surrogatschlüssel.';
comment on column velocity.rechnung.rechnungsnummer   is 'Fachlicher Schlüssel, fortlaufend und nach außen kommuniziert.';
comment on column velocity.rechnung.kunde_id          is 'Rechnungsempfänger.';
comment on column velocity.rechnung.periode_jahr      is 'Jahr der Abrechnungsperiode.';
comment on column velocity.rechnung.periode_monat     is 'Monat der Abrechnungsperiode. Je Kunde und Periode genau eine Rechnung - Geschäftsregel GR10.';
comment on column velocity.rechnung.erstellt_am_beleg is 'Fachliches Belegdatum. Bewusst anders benannt als die technische Audit-Spalte erstellt_am.';
comment on column velocity.rechnung.betrag_netto      is 'Summe der Positionen ohne Umsatzsteuer.';
comment on column velocity.rechnung.ust_satz          is 'Angewandter Umsatzsteuersatz in Prozent, zum Belegzeitpunkt festgeschrieben.';
comment on column velocity.rechnung.ust_betrag        is 'Betrag der Umsatzsteuer.';
comment on column velocity.rechnung.betrag_brutto     is 'Zahlbetrag einschließlich Umsatzsteuer.';
comment on column velocity.rechnung.status            is 'entwurf, gestellt, bezahlt oder storniert.';

comment on table velocity.rechnungsposition is
  'Einzelposten einer Rechnung, in der Regel genau eine Ausleihe.';
comment on column velocity.rechnungsposition.rechnungsposition_id is 'Surrogatschlüssel.';
comment on column velocity.rechnungsposition.rechnung_id          is 'Rechnungskopf.';
comment on column velocity.rechnungsposition.position_nr          is 'Laufende Nummer auf dem Beleg. Je Rechnung eindeutig.';
comment on column velocity.rechnungsposition.ausleihe_id          is 'Abgerechnete Ausleihe. NULL bei Positionen ohne Nutzungsbezug, etwa einem Monatsbeitrag.';
comment on column velocity.rechnungsposition.beschreibung         is 'Text auf dem Beleg.';
comment on column velocity.rechnungsposition.betrag               is 'Betrag der Position.';

comment on table velocity.zahlung is 'Zahlungsvorgang zu einer Rechnung.';
comment on column velocity.zahlung.zahlung_id        is 'Surrogatschlüssel.';
comment on column velocity.zahlung.rechnung_id       is 'Beglichene Rechnung. Teilzahlungen sind als mehrere Zeilen möglich.';
comment on column velocity.zahlung.zahlungsmittel_id is 'Belastetes Zahlungsmittel. NULL, wenn es nachträglich gelöscht wurde.';
comment on column velocity.zahlung.betrag            is 'Gezahlter Betrag.';
comment on column velocity.zahlung.gebucht_am        is 'Zeitpunkt der Buchung. Pflicht, sobald der Status gebucht ist.';
comment on column velocity.zahlung.status            is 'offen, gebucht, fehlgeschlagen oder erstattet.';

-- ===================== Bereich F: Redaktionsinhalte ==================

comment on table velocity.faq_eintrag is
  'Häufig gestellte Frage der Website. Früher fest in index.html kodiert.';
comment on column velocity.faq_eintrag.faq_id     is 'Surrogatschlüssel.';
comment on column velocity.faq_eintrag.frage      is 'Die Frage, zugleich Fachschlüssel: derselbe Wortlaut nur einmal.';
comment on column velocity.faq_eintrag.antwort    is 'Die Antwort als Fließtext.';
comment on column velocity.faq_eintrag.sortierung is 'Reihenfolge auf der Seite.';
comment on column velocity.faq_eintrag.aktiv      is 'Nur aktive Einträge erscheinen in v_faq. Zurückgezogene bleiben erhalten.';

comment on table velocity.nutzungsschritt is
  'Ein Schritt der Anleitung "So einfach geht es" auf der Website.';
comment on column velocity.nutzungsschritt.schritt_id   is 'Surrogatschlüssel.';
comment on column velocity.nutzungsschritt.nummer       is 'Position in der Abfolge, zugleich Fachschlüssel.';
comment on column velocity.nutzungsschritt.titel        is 'Überschrift der Karte.';
comment on column velocity.nutzungsschritt.beschreibung is 'Erläuternder Text.';

comment on table velocity.kennzahl is
  'Kennzahl der Kopfleiste. Entweder mit festem Anzeigewert oder berechnet.';
comment on column velocity.kennzahl.kennzahl_id   is 'Surrogatschlüssel.';
comment on column velocity.kennzahl.schluessel    is 'Fachlicher Schlüssel, den die Sicht v_kennzahl für berechnete Werte auswertet.';
comment on column velocity.kennzahl.anzeigewert   is 'Fester Text, etwa 24/7. NULL bei berechneten Kennzahlen.';
comment on column velocity.kennzahl.label         is 'Beschriftung unter dem Wert.';
comment on column velocity.kennzahl.sortierung    is 'Reihenfolge in der Kopfleiste.';
comment on column velocity.kennzahl.ist_berechnet is 'Wahr, wenn der Wert zur Laufzeit ermittelt wird statt aus anzeigewert zu stammen.';

-- ===================== Sichten =======================================

comment on view velocity.v_station is 'Öffentliche Stationsliste mit Belegung. Ohne Personenbezug.';
comment on column velocity.v_station.station_id         is 'Schlüssel der Station.';
comment on column velocity.v_station.stationsnummer     is 'Fachlicher Schlüssel der Station.';
comment on column velocity.v_station.name               is 'Anzeigename auf der Karte.';
comment on column velocity.v_station.strasse            is 'Strasse der Station.';
comment on column velocity.v_station.hausnummer         is 'Hausnummer der Station.';
comment on column velocity.v_station.plz                is 'Postleitzahl der Station.';
comment on column velocity.v_station.ort                is 'Ort der Station.';
comment on column velocity.v_station.latitude           is 'Breitengrad für den Kartenmarker.';
comment on column velocity.v_station.longitude          is 'Längengrad für den Kartenmarker.';
comment on column velocity.v_station.kapazitaet         is 'Anzahl der Stellplätze.';
comment on column velocity.v_station.verfuegbare_raeder is 'Zahl der aktuell entleihbaren Räder an dieser Station.';
comment on column velocity.v_station.freie_stellplaetze is 'Kapazität abzüglich der abgestellten Räder, nie negativ.';

comment on view velocity.v_verfuegbares_fahrrad is
  'Öffentliche Liste ausleihbarer Räder mit Position und geltendem Preis.';
comment on column velocity.v_verfuegbares_fahrrad.fahrrad_id        is 'Schlüssel des Rades, wird an api_ausleihe_starten übergeben.';
comment on column velocity.v_verfuegbares_fahrrad.rahmennummer      is 'Am Rahmen ablesbare Nummer.';
comment on column velocity.v_verfuegbares_fahrrad.typ_id            is 'Schlüssel des Fahrradtyps.';
comment on column velocity.v_verfuegbares_fahrrad.typ_code          is 'CITY, EBIKE oder CARGO. Steuert die Filterung auf der Karte.';
comment on column velocity.v_verfuegbares_fahrrad.typ_bezeichnung   is 'Name des Typs für die Anzeige.';
comment on column velocity.v_verfuegbares_fahrrad.hat_elektro       is 'Wahr bei elektrischer Unterstützung.';
comment on column velocity.v_verfuegbares_fahrrad.akkustand_prozent is 'Ladestand. NULL bei Rädern ohne Akku.';
comment on column velocity.v_verfuegbares_fahrrad.latitude          is 'Breitengrad: die eigene Position, ersatzweise die der Station.';
comment on column velocity.v_verfuegbares_fahrrad.longitude         is 'Längengrad: die eigene Position, ersatzweise die der Station.';
comment on column velocity.v_verfuegbares_fahrrad.station_id        is 'Station, an der das Rad steht. NULL bei freiem Abstellort.';
comment on column velocity.v_verfuegbares_fahrrad.station_name      is 'Name der Station, NULL bei freiem Abstellort.';
comment on column velocity.v_verfuegbares_fahrrad.startgebuehr      is 'Heute geltende Startgebühr.';
comment on column velocity.v_verfuegbares_fahrrad.preis_pro_minute  is 'Heute geltendes Minutenentgelt.';
comment on column velocity.v_verfuegbares_fahrrad.tageshoechstpreis is 'Heute geltende Obergrenze je Ausleihe.';

comment on view velocity.v_tarifkarte is
  'Öffentliche Preiskarten je Fahrradtyp inklusive Werbemerkmalen.';
comment on column velocity.v_tarifkarte.typ_id            is 'Schlüssel des Fahrradtyps.';
comment on column velocity.v_tarifkarte.typ_code          is 'CITY, EBIKE oder CARGO.';
comment on column velocity.v_tarifkarte.bezeichnung       is 'Name auf der Karte.';
comment on column velocity.v_tarifkarte.beschreibung      is 'Fließtext zur Karte.';
comment on column velocity.v_tarifkarte.hat_elektro       is 'Wahr bei elektrischer Unterstützung.';
comment on column velocity.v_tarifkarte.startgebuehr      is 'Heute geltende Startgebühr.';
comment on column velocity.v_tarifkarte.preis_pro_minute  is 'Heute geltendes Minutenentgelt.';
comment on column velocity.v_tarifkarte.tageshoechstpreis is 'Heute geltende Obergrenze je Ausleihe.';
comment on column velocity.v_tarifkarte.preis_30_minuten  is 'Beispielpreis für eine halbe Stunde: Startgebühr plus dreißig Minutenentgelte.';
comment on column velocity.v_tarifkarte.merkmale          is 'Die Aufzählungspunkte der Karte, nach sortierung geordnet.';

comment on view velocity.v_tarif is 'Öffentliche Tarifliste mit den heute geltenden Konditionen.';
comment on column velocity.v_tarif.tarif_id              is 'Schlüssel des Tarifs.';
comment on column velocity.v_tarif.tarif_code            is 'Fachlicher Schlüssel des Tarifs.';
comment on column velocity.v_tarif.bezeichnung           is 'Name des Tarifs.';
comment on column velocity.v_tarif.art                   is 'standard oder vorteil.';
comment on column velocity.v_tarif.voraussetzung         is 'Zu erbringender Nachweis.';
comment on column velocity.v_tarif.monatspreis           is 'Heute geltendes Monatsentgelt.';
comment on column velocity.v_tarif.freiminuten_pro_monat is 'Heute geltendes Monatskontingent.';
comment on column velocity.v_tarif.rabatt_prozent        is 'Heute geltender Nachlass auf Ausleihen.';

comment on view velocity.v_faq is 'Öffentliche, aktive FAQ-Einträge.';
comment on column velocity.v_faq.faq_id     is 'Schlüssel des Eintrags.';
comment on column velocity.v_faq.frage      is 'Die Frage.';
comment on column velocity.v_faq.antwort    is 'Die Antwort.';
comment on column velocity.v_faq.sortierung is 'Reihenfolge auf der Seite.';

comment on view velocity.v_nutzungsschritt is 'Öffentliche Schritte der Nutzungsanleitung.';
comment on column velocity.v_nutzungsschritt.schritt_id   is 'Schlüssel des Schritts.';
comment on column velocity.v_nutzungsschritt.nummer       is 'Position in der Abfolge.';
comment on column velocity.v_nutzungsschritt.titel        is 'Überschrift der Karte.';
comment on column velocity.v_nutzungsschritt.beschreibung is 'Erläuternder Text.';

comment on view velocity.v_kennzahl is 'Öffentliche Kennzahlen, feste und berechnete.';
comment on column velocity.v_kennzahl.schluessel is 'Fachlicher Schlüssel der Kennzahl.';
comment on column velocity.v_kennzahl.label      is 'Beschriftung unter dem Wert.';
comment on column velocity.v_kennzahl.sortierung is 'Reihenfolge in der Kopfleiste.';
comment on column velocity.v_kennzahl.wert       is 'Anzuzeigender Wert: entweder fest hinterlegt oder zur Laufzeit ermittelt.';

comment on view velocity.v_meine_ausleihe is
  'Ausleihen des angemeldeten Kunden. Läuft mit den Rechten des Aufrufers, begrenzt durch RLS.';
comment on column velocity.v_meine_ausleihe.ausleihe_id     is 'Schlüssel der Ausleihe, wird an api_ausleihe_beenden übergeben.';
comment on column velocity.v_meine_ausleihe.startzeit       is 'Beginn der Nutzung.';
comment on column velocity.v_meine_ausleihe.endzeit         is 'Ende der Nutzung, NULL bei laufender Fahrt.';
comment on column velocity.v_meine_ausleihe.status          is 'aktiv, abgeschlossen oder storniert.';
comment on column velocity.v_meine_ausleihe.dauer_minuten   is 'Angefangene Minuten, aufgerundet.';
comment on column velocity.v_meine_ausleihe.rahmennummer    is 'Am Rahmen ablesbare Nummer des genutzten Rades.';
comment on column velocity.v_meine_ausleihe.typ_code        is 'CITY, EBIKE oder CARGO.';
comment on column velocity.v_meine_ausleihe.typ_bezeichnung is 'Name des Fahrradtyps.';
comment on column velocity.v_meine_ausleihe.start_station   is 'Name der Entnahmestation, NULL bei freiem Abstellort.';
comment on column velocity.v_meine_ausleihe.end_station     is 'Name der Rückgabestation, NULL bei freiem Abstellen.';
comment on column velocity.v_meine_ausleihe.gesamtbetrag    is 'Summe aller Entgeltpositionen dieser Ausleihe.';
comment on column velocity.v_meine_ausleihe.positionen      is 'Die gebuchten Entgeltpositionen als jsonb-Feld: Bezeichnung, Code und Betrag je Zeile. Der Beleg zeigt damit, was abgerechnet wurde, ohne die Preisregeln im Frontend nachzubauen.';

comment on view velocity.v_meine_rechnung is
  'Rechnungen des angemeldeten Kunden. Läuft mit den Rechten des Aufrufers, begrenzt durch RLS.';
comment on column velocity.v_meine_rechnung.rechnung_id       is 'Schlüssel der Rechnung.';
comment on column velocity.v_meine_rechnung.rechnungsnummer   is 'Nach außen kommunizierte Belegnummer.';
comment on column velocity.v_meine_rechnung.periode_jahr      is 'Jahr der Abrechnungsperiode.';
comment on column velocity.v_meine_rechnung.periode_monat     is 'Monat der Abrechnungsperiode.';
comment on column velocity.v_meine_rechnung.erstellt_am_beleg is 'Belegdatum.';
comment on column velocity.v_meine_rechnung.betrag_netto      is 'Summe ohne Umsatzsteuer.';
comment on column velocity.v_meine_rechnung.ust_betrag        is 'Betrag der Umsatzsteuer.';
comment on column velocity.v_meine_rechnung.betrag_brutto     is 'Zahlbetrag.';
comment on column velocity.v_meine_rechnung.status            is 'entwurf, gestellt, bezahlt oder storniert.';

comment on view velocity.v_mein_profil is
  'Stammdaten des angemeldeten Kunden. Läuft mit Definer-Rechten und filtert selbst auf auth.uid(), weil adresse nicht freigegeben ist.';
comment on column velocity.v_mein_profil.kunde_id       is 'Schlüssel des Kunden.';
comment on column velocity.v_mein_profil.kundennummer   is 'Nach außen kommunizierte Kundennummer.';
comment on column velocity.v_mein_profil.email          is 'Hinterlegte Kontaktadresse.';
comment on column velocity.v_mein_profil.vorname        is 'Vorname.';
comment on column velocity.v_mein_profil.nachname       is 'Nachname.';
comment on column velocity.v_mein_profil.telefon        is 'Rufnummer.';
comment on column velocity.v_mein_profil.geburtsdatum   is 'Geburtsdatum, Grundlage der Altersgrenze.';
comment on column velocity.v_mein_profil.status         is 'aktiv, gesperrt oder geschlossen.';
comment on column velocity.v_mein_profil.registriert_am is 'Zeitpunkt der Anmeldung.';
comment on column velocity.v_mein_profil.strasse        is 'Strasse der Rechnungsadresse.';
comment on column velocity.v_mein_profil.hausnummer     is 'Hausnummer der Rechnungsadresse.';
comment on column velocity.v_mein_profil.plz            is 'Postleitzahl der Rechnungsadresse.';
comment on column velocity.v_mein_profil.ort            is 'Ort der Rechnungsadresse.';

-- ===================== Dictionary-Sicht ==============================

create or replace view velocity.v_data_dictionary as
select case c.relkind when 'r' then 'Tabelle' when 'v' then 'Sicht' end as objekt_art,
       c.relname                            as tabelle,
       a.attname                            as spalte,
       format_type(a.atttypid, a.atttypmod) as datentyp,
       not a.attnotnull                     as nullbar,
       pg_get_expr(d.adbin, d.adrelid)      as vorgabe,
       col_description(c.oid, a.attnum)     as beschreibung,
       obj_description(c.oid, 'pg_class')   as tabellenbeschreibung,
       a.attnum                             as position
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  join pg_attribute a on a.attrelid = c.oid
  left join pg_attrdef d on d.adrelid = c.oid and d.adnum = a.attnum
 where n.nspname = 'velocity' and c.relkind in ('r','v')
   and a.attnum > 0 and not a.attisdropped;

comment on view velocity.v_data_dictionary is
  'Erzeugt das Data Dictionary aus dem Systemkatalog. Grundlage für doku/datenmodell/06-data-dictionary.md.';
comment on column velocity.v_data_dictionary.objekt_art           is 'Tabelle oder Sicht.';
comment on column velocity.v_data_dictionary.tabelle              is 'Name des Objekts.';
comment on column velocity.v_data_dictionary.spalte               is 'Name der Spalte.';
comment on column velocity.v_data_dictionary.datentyp             is 'Datentyp einschließlich Länge und Genauigkeit.';
comment on column velocity.v_data_dictionary.nullbar              is 'Wahr, wenn die Spalte NULL zulässt.';
comment on column velocity.v_data_dictionary.vorgabe              is 'Vorgabewert als Ausdruck, NULL wenn keiner gesetzt ist.';
comment on column velocity.v_data_dictionary.beschreibung         is 'Der Spaltenkommentar aus dem Systemkatalog.';
comment on column velocity.v_data_dictionary.tabellenbeschreibung is 'Der Tabellenkommentar aus dem Systemkatalog.';
comment on column velocity.v_data_dictionary.position             is 'Ordnungsnummer der Spalte innerhalb des Objekts.';
