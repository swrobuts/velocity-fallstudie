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
  ('STARTGEBUEHR',              'Startgebuehr',                          1),
  ('ZEITENTGELT',               'Zeitentgelt',                           1),
  ('FREIMINUTEN',               'Gutschrift Freiminuten',               -1),
  ('TARIFRABATT',               'Tarifrabatt',                          -1),
  ('HOECHSTPREIS_KAPPUNG',      'Kappung auf Tageshoechstpreis',        -1),
  ('ZUSCHLAG_FREIES_ABSTELLEN', 'Zuschlag Abstellen ausserhalb Station', 1),
  ('BESTANDSUEBERNAHME',        'Uebernahme aus dem Altbestand',         1)
on conflict (code) do update
  set bezeichnung = excluded.bezeichnung, vorzeichen = excluded.vorzeichen;

insert into velocity.zahlungsart (code, bezeichnung) values
  ('SEPA',        'SEPA-Lastschrift'),
  ('KREDITKARTE', 'Kreditkarte'),
  ('PAYPAL',      'PayPal')
on conflict (code) do update set bezeichnung = excluded.bezeichnung;

-- ---------------------------------------------------------------------
-- Fahrradtypen: Bezeichnungen wie auf der Website, Codes fuer die Technik.
-- ---------------------------------------------------------------------
insert into velocity.fahrradtyp (typ_code, bezeichnung, beschreibung, hat_elektro, zuladung_kg) values
  ('CITY',  'City-Bike',
   '7-Gang Stadtrad mit Gepaecktraeger, LED-Beleuchtung und verstellbarem Sattel', false, 20),
  ('EBIKE', 'E-Bike Sport',
   'Pedelec mit 250 W Motor, Reichweite bis 50 km, Display mit Akkustand',        true,  20),
  ('CARGO', 'E-Cargo Loader',
   'E-Lastenrad mit grosser Transportbox, Tragkraft bis 80 kg',                   true, 100)
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
    ('EBIKE', 2, 'Bis 25 km/h Unterstuetzung'),
    ('EBIKE', 3, 'Ideal fuers Hubland'),
    ('CARGO', 1, 'Grosse Transportbox (100 kg)'),
    ('CARGO', 2, 'Starker E-Motor'),
    ('CARGO', 3, 'Sitzbank fuer zwei Kinder')
  ) as m(typ_code, sortierung, merkmal)
  join velocity.fahrradtyp t on t.typ_code = m.typ_code
on conflict (typ_id, sortierung) do update set merkmal = excluded.merkmal;

-- ---------------------------------------------------------------------
-- Preise: uebernommen aus cityBikesRental.fahrradtyp, ab heute gueltig
-- und nach oben offen.
-- ---------------------------------------------------------------------
insert into velocity.nutzungspreis (typ_id, gueltigkeit, startgebuehr, preis_pro_minute, tageshoechstpreis)
select t.typ_id, daterange(current_date, null, '[)'), p.start, p.minute, p.hoechst
  from (values
    ('CITY',  0.10, 0.10, 10.00),
    ('EBIKE', 1.00, 0.10, 15.00),
    ('CARGO', 2.00, 0.10, 22.00)
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
  ('STUDENT', 'Studententarif', 'vorteil',  'Gueltiger Studierendenausweis'),
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
   'Ja, absolut! Nutze in der App den Parkmodus. Die Miete laeuft weiter, das Schloss verriegelt.', 2),
  ('Gibt es Rabatte fuer Studierende?',
   'Ja! Registriere dich einfach mit deiner Adresse @uni-wuerzburg.de fuer den Campus-Tarif.', 3),
  ('Was passiert bei einem Defekt?',
   'Melde den Schaden ueber die App. Wir beenden deine Miete sofort kostenfrei.', 4)
on conflict (frage) do update
  set antwort = excluded.antwort, sortierung = excluded.sortierung;

insert into velocity.nutzungsschritt (nummer, titel, beschreibung, icon_code) values
  (1, 'App laden und finden',
      'Registriere dich einmalig kostenlos. Finde in der Web-App oder nativen App das naechste freie Rad in deiner Naehe.',
      'fa-mobile-screen-button'),
  (2, 'Scannen und losfahren',
      'Scanne den QR-Code am Schutzblech oder gib die Rad-Nummer ein. Das Schloss oeffnet sich automatisch.',
      'fa-qrcode'),
  (3, 'Parken und beenden',
      'Stelle das Rad an einer Station (gratis) oder in der Flex-Zone (gegen Gebuehr) ab. Schloss schliessen, fertig.',
      'fa-square-parking')
on conflict (nummer) do update
  set titel = excluded.titel, beschreibung = excluded.beschreibung, icon_code = excluded.icon_code;

insert into velocity.kennzahl (schluessel, anzeigewert, label, sortierung, ist_berechnet) values
  ('stationen',      null,     'Stationen',      1, true),
  ('verfuegbarkeit', '24/7',   'Verfuegbarkeit', 2, false),
  ('oekostrom',      '100%',   'Oekostrom',      3, false),
  ('anmeldegebuehr', '0 Euro', 'Anmeldegebuehr', 4, false)
on conflict (schluessel) do update
  set anzeigewert   = excluded.anzeigewert,
      label         = excluded.label,
      sortierung    = excluded.sortierung,
      ist_berechnet = excluded.ist_berechnet;
