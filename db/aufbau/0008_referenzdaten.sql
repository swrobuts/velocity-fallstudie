-- =====================================================================
-- 0008 Referenz- und Redaktionsdaten
--
-- Zweck:      Fachlich feste Schluesselwerte sowie die Inhalte, die
--             bisher in src/index.html standen.
-- Objekte:    Datenzeilen in entgeltart, zahlungsart, fahrradtyp,
--             fahrradtyp_merkmal, nutzungspreis, tarif, tarif_kondition,
--             faq_eintrag, nutzungsschritt, kennzahl
-- Ruecknahme: DELETE aus denselben Tabellen; die Struktur bleibt.
--
-- Alle Einfuegungen sind idempotent ueber ON CONFLICT DO UPDATE bzw.
-- ueber NOT EXISTS auf dem jeweiligen Fachschluessel.
-- =====================================================================

insert into velocity.entgeltart (code, bezeichnung, vorzeichen) values
  ('STARTGEBUEHR',              'Startgebühr',                          1),
  ('ZEITENTGELT',               'Zeitentgelt',                           1),
  ('FREIMINUTEN',               'Gutschrift Freiminuten',               -1),
  ('TARIFRABATT',               'Tarifrabatt',                          -1),
  ('HOECHSTPREIS_KAPPUNG',      'Kappung auf Tageshöchstpreis',        -1),
  ('BESTANDSUEBERNAHME',        'Übernahme aus dem Altbestand',         1)
on conflict (code) do update
  set bezeichnung = excluded.bezeichnung, vorzeichen = excluded.vorzeichen;

-- Entfaellt: ZUSCHLAG_FREIES_ABSTELLEN.
--
-- Der Entwurf sah einen Zuschlag fuers Abstellen ausserhalb einer
-- Station vor. Die Entgeltart stand seither in der Tabelle, wurde aber
-- von der Geschaeftslogik nie erzeugt: die Seite versprach eine Gebuehr,
-- das System berechnete keine. Entschieden wurde gegen den Zuschlag -
-- Abstellen im Geschaeftsgebiet ist kostenfrei. Damit verschwindet die
-- Art auch aus dem Modell, statt als Karteileiche eine Regel zu
-- behaupten, die es nicht gibt.
--
-- Nur loeschen, wenn wirklich nichts darauf verweist. Ein Fremdschluessel
-- aus entgeltposition wuerde das Loeschen ohnehin abweisen (on delete
-- restrict); die Bedingung macht den Block wiederholbar.
delete from velocity.entgeltart a
 where a.code = 'ZUSCHLAG_FREIES_ABSTELLEN'
   and not exists (select 1 from velocity.entgeltposition e
                    where e.entgeltart_id = a.entgeltart_id);

insert into velocity.zahlungsart (code, bezeichnung) values
  ('SEPA',        'SEPA-Lastschrift'),
  ('KREDITKARTE', 'Kreditkarte'),
  ('PAYPAL',      'PayPal')
on conflict (code) do update set bezeichnung = excluded.bezeichnung;

-- ---------------------------------------------------------------------
-- Fahrradtypen: Bezeichnungen wie auf der Website, Codes fuer die Technik.
--
-- EINZEILIGE BESCHREIBUNGEN (gekuerzt am 28.08.2026)
-- Die drei Texte standen als Fliesstext und brauchten auf der Website
-- zwei Zeilen, das Lastenrad nur eine - dadurch sassen Trennlinie und
-- Bestandszeile in der dritten Kachel hoeher als nebenan. Der Betreiber
-- hat entschieden, sie einzeilig zu fuehren. Sie sind jetzt gleich
-- gebaut - erst was es ist, dann die eine Zahl, die dafuer zaehlt -,
-- damit die drei sich als Satz lesen und nicht als drei Einfaelle.
-- "bis 50 km" bleibt woertlich stehen: fahrradmodell.reichweite_km
-- verweist in 0012_dokumentation.sql ausdruecklich darauf. Ebenso
-- "75 kg", das zuladung_kg in derselben Zeile fuehrt.
--
-- AUS 7 GAENGEN WURDEN 8, UND ZWAR ALS FEHLERKORREKTUR.
-- Der alte Fliesstext sagte "7-Gang Stadtrad". Das war falsch: das
-- Werbemerkmal desselben Typs nennt eine Zeile weiter unten "8-Gang
-- Nabenschaltung", und flottenmodelle_stammdaten.sql setzt gangzahl = 8
-- mit ausdruecklichem Verweis auf genau dieses Merkmal. Zwei Angaben
-- zum selben Rad auf derselben Seite, die sich widersprachen - nur fiel
-- es im laengeren Fliesstext niemandem auf. Acht ist die belegte Zahl.
-- ---------------------------------------------------------------------
insert into velocity.fahrradtyp (typ_code, bezeichnung, beschreibung, hat_elektro, zuladung_kg) values
  ('CITY',  'City-Bike',      'Stadtrad, 8 Gänge, LED-Licht',   false, 20),
  ('EBIKE', 'E-Bike Sport',   'Pedelec, Reichweite bis 50 km',  true,  20),
  ('CARGO', 'E-Cargo Loader', 'Lastenrad, Zuladung bis 75 kg',  true,  75)
on conflict (typ_code) do update
  set bezeichnung  = excluded.bezeichnung,
      beschreibung = excluded.beschreibung,
      hat_elektro  = excluded.hat_elektro,
      zuladung_kg  = excluded.zuladung_kg;

insert into velocity.fahrradtyp_merkmal (typ_id, sortierung, merkmal)
select t.typ_id, m.sortierung, m.merkmal
  from (values
    ('CITY',  1, '8-Gang Nabenschaltung'),
    ('CITY',  2, 'Pannensichere Reifen'),
    ('CITY',  3, 'Komfort-Sattel'),
    ('EBIKE', 1, 'Bosch Performance CX'),
    ('EBIKE', 2, 'Bis 25 km/h Unterstützung'),
    ('EBIKE', 3, 'Ideal fürs Hubland'),
    ('CARGO', 1, 'Große Transportbox (75 kg)'),
    ('CARGO', 2, 'Starker E-Motor'),
    ('CARGO', 3, 'Sitzbank für zwei Kinder')
  ) as m(typ_code, sortierung, merkmal)
  join velocity.fahrradtyp t on t.typ_code = m.typ_code
on conflict (typ_id, sortierung) do update set merkmal = excluded.merkmal;

-- ---------------------------------------------------------------------
-- Preise: uebernommen aus cityBikesRental.fahrradtyp, ab heute gueltig
-- und nach oben offen.
--
-- Die Minutenpreise wurden am 25.08.2026 neu gesetzt: 0,10 fuer das
-- City-Bike, 0,25 fuer das E-Bike, 0,50 fuer den Loader. Vorher kostete
-- das Lastenrad mit 0,10 je Minute genauso wenig wie das einfachste Rad
-- und weniger als das E-Bike - eine Reihenfolge, die niemand erklaeren
-- konnte. Fuer die bestehende Datenbank siehe
-- db/betrieb/preisanpassung_minutenpreis.sql.
--
-- Der Tageshoechstpreis wurde am 23.08.2026 angehoben. Eine frische
-- Datenbank startet gleich mit den neuen Werten. In der bestehenden
-- Datenbank wurde stattdessen die laufende Periode geschlossen und eine
-- neue eroeffnet - siehe db/betrieb/preisanpassung_tageshoechstpreis.sql.
-- Preise werden nie ueberschrieben: entgeltposition zeigt auf die Zeile,
-- mit der abgerechnet wurde (Geschaeftsregel GR5).
-- ---------------------------------------------------------------------
insert into velocity.nutzungspreis (typ_id, gueltigkeit, startgebuehr, preis_pro_minute, tageshoechstpreis)
select t.typ_id, daterange(current_date, null, '[)'), p.start, p.minute, p.hoechst
  from (values
    ('CITY',  0.10, 0.10,  50.00),
    ('EBIKE', 1.00, 0.25,  75.00),
    ('CARGO', 2.00, 0.50, 110.00)
  ) as p(typ_code, start, minute, hoechst)
  join velocity.fahrradtyp t on t.typ_code = p.typ_code
 where not exists (
   select 1 from velocity.nutzungspreis np
    where np.typ_id = t.typ_id and upper_inf(np.gueltigkeit)
 );

-- ---------------------------------------------------------------------
-- Tarife und ihre Konditionen
-- ---------------------------------------------------------------------
insert into velocity.tarif (tarif_code, bezeichnung, art, voraussetzung) values
  ('BASIS',   'Basistarif',     'standard', null),
  ('STUDENT', 'Studententarif', 'vorteil',  'Gültiger Studierendenausweis'),
  ('OEPNV',   'OEPNV-Abo',      'vorteil',  'VGN-Abo oder Deutschlandticket'),
  ('PREMIUM', 'Premium',        'vorteil',  'Kostenpflichtiges Abo')
on conflict (tarif_code) do update
  set bezeichnung   = excluded.bezeichnung,
      art           = excluded.art,
      voraussetzung = excluded.voraussetzung;

insert into velocity.tarif_kondition
  (tarif_id, gueltigkeit, monatspreis, freiminuten_pro_monat, rabatt_prozent)
select t.tarif_id, daterange(current_date, null, '[)'), k.monat, k.frei, k.rabatt
  from (values
    ('BASIS',   0.00,    0,  0.00),
    ('STUDENT', 0.00,  300,  0.00),
    ('OEPNV',   0.00,  600,  0.00),
    ('PREMIUM', 9.90, 1000, 20.00)
  ) as k(tarif_code, monat, frei, rabatt)
  join velocity.tarif t on t.tarif_code = k.tarif_code
 where not exists (
   select 1 from velocity.tarif_kondition tk
    where tk.tarif_id = t.tarif_id and upper_inf(tk.gueltigkeit)
 );

-- ---------------------------------------------------------------------
-- Redaktionsinhalte, wortgleich aus src/index.html uebernommen
-- ---------------------------------------------------------------------
insert into velocity.faq_eintrag (frage, antwort, sortierung) values
  ('Wie kann ich bezahlen?',
   'Wir akzeptieren PayPal, Kreditkarte und SEPA-Lastschrift. Die Abrechnung erfolgt automatisch.', 1),
  ('Darf ich das Rad kurz parken?',
   'Ja. Nutze in der App den Parkmodus: die Miete läuft weiter, das Schloss verriegelt.', 2),
  ('Gibt es Rabatte für Studierende?',
   'Registriere dich mit deiner Hochschuladresse für den Campus-Tarif.', 3),
  ('Was passiert bei einem Defekt?',
   'Melde den Schaden über die App. Wir beenden deine Miete sofort kostenfrei.', 4)
on conflict (frage) do update
  set antwort = excluded.antwort, sortierung = excluded.sortierung;

insert into velocity.nutzungsschritt (nummer, titel, beschreibung) values
  (1, 'App laden und finden',
      'Registriere dich einmalig kostenlos. Danach steht dir jedes freie Rad im Netz offen.'),
  (2, 'Scannen und losfahren',
      'Scanne den QR-Code am Schutzblech oder gib die Rad-Nummer ein. Das Schloss öffnet sich automatisch.'),
  (3, 'Parken und beenden',
      'Stelle das Rad an einer Station ab oder frei im rot umrandeten Geschäftsgebiet — beides ohne Zuschlag. Schloss schließen, fertig.')
on conflict (nummer) do update
  set titel = excluded.titel, beschreibung = excluded.beschreibung;

insert into velocity.kennzahl (schluessel, anzeigewert, label, sortierung, ist_berechnet) values
  ('stationen',      null,     'Stationen',      1, true),
  ('verfuegbarkeit', '24/7',   'Verfügbarkeit', 2, false),
  ('oekostrom',      '100%',   'Ökostrom',      3, false),
  ('anmeldegebuehr', '0 Euro', 'Anmeldegebühr', 4, false)
on conflict (schluessel) do update
  set anzeigewert   = excluded.anzeigewert,
      label         = excluded.label,
      sortierung    = excluded.sortierung,
      ist_berechnet = excluded.ist_berechnet;


-- ---------------------------------------------------------------------
-- Hoehenmarken: die markanten Hoehen rund um Wuerzburg.
--
-- Bestimmt wie station.hoehe_m gegen zwei unabhaengige Gelaendemodelle
-- (Copernicus GLO-30 und EU-DEM v1.1) und gemittelt. Genommen wurde
-- jeweils das Maximum eines Rasters um den Ort - der Gipfel, nicht ein
-- beliebiger Punkt am Hang. Es sind Oberflaechenmodelle: in bebautem
-- Gebiet liegen sie rund zehn Meter zu hoch. Belastbar sind die
-- Unterschiede, und genau die traegt die Grafik vor.
-- ---------------------------------------------------------------------
insert into velocity.hoehenmarke (name, hoehe_m, latitude, longitude, quelle, sortierung) values
  ('Frankenwarte',   360, 49.781370, 9.907470, 'Copernicus GLO-30 und EU-DEM v1.1, gemittelt', 1),
  ('Steinburg',      285, 49.814700, 9.912230, 'Copernicus GLO-30 und EU-DEM v1.1, gemittelt', 2),
  ('Campus Hubland', 279, 49.781000, 9.972000, 'Copernicus GLO-30 und EU-DEM v1.1, gemittelt', 3)
on conflict (name) do update
   set hoehe_m = excluded.hoehe_m, latitude = excluded.latitude,
       longitude = excluded.longitude, quelle = excluded.quelle,
       sortierung = excluded.sortierung;


-- ---------------------------------------------------------------------
-- Geschaeftsgebiet Wuerzburg. Die Eckpunkte standen bisher fest im
-- JavaScript der Karte; jetzt zeichnet die Karte, was hier steht.
-- Reihenfolge im Typ polygon: (Laengengrad, Breitengrad).
-- ---------------------------------------------------------------------
-- EIN Gebiet. Es gab zeitweise ein zweites um Schweinfurt, weil der
-- Altbestand dort drei Stationen fuehrte. Vierzig Kilometer Landschaft
-- dazwischen machen daraus aber kein Netz, sondern zwei: ein Rad kann
-- die Strecke nicht zuruecklegen, und jede Aussage ueber Verfuegbarkeit
-- und Wege wird mehrdeutig. Schweinfurt wird deshalb bei der Uebernahme
-- ausgelassen (siehe db/betrieb/uebernahme_altdaten.sql).
--
-- fn_im_geschaeftsgebiet fragt trotzdem ueber exists und vertraegt
-- beliebig viele Gebiete - das Modell bleibt offen fuer eine echte
-- Ausweitung, die dann ein zusammenhaengendes Netz waere.
insert into velocity.geschaeftsgebiet (name, flaeche) values
  ('Würzburg',
   polygon '((9.9100,49.8100),(9.9400,49.8150),(9.9850,49.7850),(9.9600,49.7750),(9.9300,49.7700),(9.9000,49.7850))')
on conflict (name) do update set flaeche = excluded.flaeche;

-- Ein frueher angelegtes Gebiet Schweinfurt wird wieder entfernt.
delete from velocity.geschaeftsgebiet where name = 'Schweinfurt';
