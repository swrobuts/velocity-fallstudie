-- =====================================================================
--  FLOTTENMODELLE: HERSTELLER, MODELLE, TECHNISCHE ANGABEN
--
--  ACHTUNG: Diese Datei erzeugt ERFUNDENE Daten. Sie sind plausibel
--  gebaut, aber sie messen nichts. Kein Hersteller, kein Modellname,
--  kein Baujahr und keine technische Angabe hier ist erhoben. Die
--  Hersteller sind frei erfunden - keine Anlehnung an reale Marken
--  beabsichtigt.
--
--  ANLASS: Die Uebernahme aus cityBikesRental (siehe
--  uebernahme_altdaten.sql) fand im Altbestand keine Modellangabe und
--  legte deshalb je Typ genau ein Modell mit Hersteller 'unbekannt' an -
--  'Bestandsrad City', 'Bestandsrad E-Bike', 'Bestandsrad Cargo', alle
--  drei ohne Baujahr. Auf allen 275 Raedern der Flotte stand seitdem
--  derselbe Platzhalter. Eine Detailmaske, die zu einem Rad Hersteller
--  und technische Angaben zeigen soll, hatte darin buchstaeblich nichts
--  zum Anzeigen - das ist der eigentliche Befund hinter der Beschwerde
--  "das ist infotechnisch recht mau", nicht die Maske selbst.
--
--  WAS DIESE DATEI TUT
--
--    1. Fuenf Hersteller, neun Modelle - mehrere je Typ, nicht eines.
--       Eine Flotte, die aus einer einzigen Bestellung eines einzigen
--       Herstellers bestuende, waere fuer eine Warenwirtschaft ein
--       uninteressanter Sonderfall: keine Frage danach, welcher
--       Hersteller mehr Werkstatttermine verursacht, keine Frage nach
--       dem Alterseffekt. Zwei Stadtrad-Hersteller (Nordwind Rad zuerst,
--       Kvarner Bike Works kam spaeter als zweite Quelle dazu), zwei
--       E-Bike-Hersteller (Kaskade Cycles etabliert, Vantaa Motion mit
--       einer kleinen ersten Charge des Nachfolgemodells) und ein
--       Lastenrad-Hersteller (Loire Manufaktur) ergeben eine Flotte, wie
--       ein Verleiher sie ueber mehrere Beschaffungsrunden tatsaechlich
--       zusammenkauft.
--
--       Je Modell: Gewicht, Gangzahl und Rahmenhoehe (neue Spalten an
--       fahrradmodell, siehe db/aufbau/0003_bereich_b_netz_und_flotte.sql
--       und deren Kommentare in 0012_dokumentation.sql). Bei den
--       elektrischen Typen zusaetzlich Akkukapazitaet und Reichweite -
--       bei den City-Modellen bleiben beide NULL, derselben Konvention
--       folgend wie akkustand_prozent in fahrrad_position.
--
--       Die Baujahre sind uebers Modell gestreut (2021 bis 2025), nicht
--       je Rad: ein Verleiher kauft ueber Jahre in Chargen zu, oft auch
--       ein guenstigeres, laenger produziertes Modell parallel zum
--       aktuellen. Zuladung und die Frage "hat Elektroantrieb" bleiben
--       unangetastet - die stehen schon laenger, richtig, an
--       fahrradtyp und werden hier nicht verdoppelt.
--
--    2. Jedes der 275 vorhandenen Raeder bekommt eines der neuen
--       Modelle SEINES TYPS zugewiesen. Rahmennummer, Status und
--       angeschafft_am aendern sich nicht - nur die modell_id. Innerhalb
--       jedes Typs wandern die zuerst angeschafften Raeder in das
--       aelteste Modell, die zuletzt angeschafften in das juengste: mit
--       jeder Beschaffungsrunde kam ein neueres Modell dazu, keine davon
--       ist rueckwirkend erfunden.
--
--    3. Die drei alten Platzhaltermodelle und der Hersteller 'unbekannt'
--       werden entfernt, sobald kein Rad mehr auf sie zeigt. Ohne diesen
--       Schritt bliebe 'unbekannt' in jeder Auswahlliste stehen - genau
--       die Angabe, die verschwinden soll, nicht nur unbenutzt daliegen.
--
--  WAS SICH NICHT AENDERT: Rahmennummern, Status, angeschafft_am, die
--  Anzahl Raeder je Typ (198 / 52 / 25) und je Status. Keine der vier
--  Auswertungszahlen (Umsatz, Fahrten, CO2, Schaetzanteil) haengt an
--  Hersteller oder Modell - alle drei Aggregationen laufen ueber
--  fahrradtyp, und der bleibt fuer jedes Rad derselbe.
--
--  Idempotent: die WHERE-Bedingung der Zuordnung greift nur auf Raeder,
--  die noch am Hersteller 'unbekannt' haengen. Ein zweiter Lauf findet
--  keine mehr und aendert nichts.
--
--  Ruecknahme: siehe Kommentarblock am Dateiende.
-- =====================================================================

begin;

-- ---- 1a Hersteller ---------------------------------------------------
insert into velocity.hersteller (name) values
  ('Nordwind Rad'),
  ('Kvarner Bike Works'),
  ('Kaskade Cycles'),
  ('Vantaa Motion'),
  ('Loire Manufaktur')
on conflict (name) do nothing;

-- ---- 1b Modelle --------------------------------------------------------
-- Reihenfolge je Typ ist zugleich die Beschaffungsreihenfolge (aeltestes
-- Baujahr zuerst) - Block 2 unten verlaesst sich darauf.
insert into velocity.fahrradmodell
       (hersteller_id, typ_id, modellbezeichnung, baujahr,
        gewicht_kg, gangzahl, rahmenhoehe_cm, akkukapazitaet_wh, reichweite_km)
select h.hersteller_id, t.typ_id, v.modellbezeichnung, v.baujahr,
       v.gewicht_kg, v.gangzahl, v.rahmenhoehe_cm, v.akkukapazitaet_wh, v.reichweite_km
  from (values
    -- hersteller,            typ_code, modellbezeichnung, baujahr, gewicht_kg, gangzahl, rahmenhoehe_cm, akkukapazitaet_wh, reichweite_km
    ('Nordwind Rad',       'CITY',  'CityLine 1',  2021, 21.5, 7, 46, null, null),
    ('Nordwind Rad',       'CITY',  'CityLine 2',  2023, 19.8, 7, 46, null, null),
    ('Kvarner Bike Works', 'CITY',  'Urbano S',    2024, 19.0, 8, 47, null, null),
    ('Kvarner Bike Works', 'CITY',  'Urbano X',    2025, 18.2, 8, 47, null, null),
    ('Kaskade Cycles',     'EBIKE', 'Pulse 400',   2022, 25.5, 5, 48,  400,   45),
    ('Kaskade Cycles',     'EBIKE', 'Pulse 500',   2024, 24.0, 7, 48,  500,   60),
    ('Vantaa Motion',      'EBIKE', 'Spark E',     2025, 22.8, 7, 47,  545,   70),
    ('Loire Manufaktur',   'CARGO', 'Porteur L',   2022, 38.5, 8, 50,  500,   40),
    ('Loire Manufaktur',   'CARGO', 'Porteur XL',  2024, 41.0, 8, 50,  630,   55)
  ) as v(hersteller, typ_code, modellbezeichnung, baujahr,
         gewicht_kg, gangzahl, rahmenhoehe_cm, akkukapazitaet_wh, reichweite_km)
  join velocity.hersteller h on h.name     = v.hersteller
  join velocity.fahrradtyp t on t.typ_code = v.typ_code
on conflict (hersteller_id, modellbezeichnung) do nothing;

-- ---- 2 Bestehende Raeder umhaengen -------------------------------------
-- Je Typ: die Raeder, die noch am Platzhalter 'unbekannt' haengen, nach
-- angeschafft_am (fruehester zuerst) durchnummerieren und in genau der
-- Groesse auf die neuen Modelle verteilen, die Block 1b ihnen zugedacht
-- hat. Die Kontingente je Typ summieren sich exakt auf den heutigen
-- Bestand (198 / 52 / 25) - siehe Pruefblock nach dem COMMIT.
with alt as (
  select f.fahrrad_id,
         mo_alt.typ_id,
         row_number() over (partition by mo_alt.typ_id
                             order by f.angeschafft_am, f.rahmennummer) as rang
    from velocity.fahrrad f
    join velocity.fahrradmodell mo_alt on mo_alt.modell_id     = f.modell_id
    join velocity.hersteller    h_alt  on h_alt.hersteller_id  = mo_alt.hersteller_id
   where h_alt.name = 'unbekannt'
),
kontingent as (
  select t.typ_id, mo.modell_id,
         sum(v.anzahl) over (partition by t.typ_id order by v.reihenfolge
                              rows between unbounded preceding and current row) as bis_rang,
         sum(v.anzahl) over (partition by t.typ_id order by v.reihenfolge
                              rows between unbounded preceding and 1 preceding) as ab_rang_excl
    from (values
      ('CITY',  1, 'CityLine 1', 60),
      ('CITY',  2, 'CityLine 2', 50),
      ('CITY',  3, 'Urbano S',   48),
      ('CITY',  4, 'Urbano X',   40),
      ('EBIKE', 1, 'Pulse 400',  20),
      ('EBIKE', 2, 'Pulse 500',  20),
      ('EBIKE', 3, 'Spark E',    12),
      ('CARGO', 1, 'Porteur L',  15),
      ('CARGO', 2, 'Porteur XL', 10)
    ) as v(typ_code, reihenfolge, modellbezeichnung, anzahl)
    join velocity.fahrradtyp    t  on t.typ_code = v.typ_code
    join velocity.fahrradmodell mo on mo.typ_id  = t.typ_id
                                   and mo.modellbezeichnung = v.modellbezeichnung
)
update velocity.fahrrad f
   set modell_id = k.modell_id
  from alt
  join kontingent k
    on k.typ_id = alt.typ_id
   and alt.rang >  coalesce(k.ab_rang_excl, 0)
   and alt.rang <= k.bis_rang
 where f.fahrrad_id = alt.fahrrad_id;

-- ---- 3 Platzhalter entfernen, sobald verwaist --------------------------
delete from velocity.fahrradmodell mo
 using velocity.hersteller h
 where mo.hersteller_id = h.hersteller_id
   and h.name = 'unbekannt'
   and not exists (select 1 from velocity.fahrrad f where f.modell_id = mo.modell_id);

delete from velocity.hersteller h
 where h.name = 'unbekannt'
   and not exists (select 1 from velocity.fahrradmodell mo where mo.hersteller_id = h.hersteller_id);

-- ---- Nachweis im Uebernahmeprotokoll -----------------------------------
insert into velocity.uebernahme_protokoll
       (lauf, quelle, ziel, gelesen, geschrieben, uebersprungen, hinweis)
select now(), 'Referenzdaten (erzeugt)',
       'velocity.hersteller, velocity.fahrradmodell, velocity.fahrrad',
       275, 275, 0,
       'ERFUNDENE Daten für die Lehre, nicht erhoben. Fünf Hersteller, neun '
       'Modelle über die drei Typen verteilt, Baujahre 2021-2025 gestreut; '
       'die 275 vorhandenen Räder wurden ihrer Anschaffungsreihenfolge nach '
       'den Modellen ihres Typs zugeordnet. Löst den Platzhalter unbekannt '
       'ab, unter dem zuvor die gesamte Flotte lief.'
 where not exists (
   select 1 from velocity.uebernahme_protokoll
    where quelle = 'Referenzdaten (erzeugt)'
      and ziel = 'velocity.hersteller, velocity.fahrradmodell, velocity.fahrrad'
 );

commit;

-- ---- Kontrolle -----------------------------------------------------
do $$
declare
  v_unbekannt integer;
  v_city      integer;
  v_ebike     integer;
  v_cargo     integer;
  v_baujahre  integer;
begin
  select count(*) into v_unbekannt
    from velocity.fahrrad f
    join velocity.fahrradmodell mo on mo.modell_id = f.modell_id
    join velocity.hersteller    h  on h.hersteller_id = mo.hersteller_id
   where h.name = 'unbekannt';
  if v_unbekannt > 0 then
    raise exception 'Noch % Räder hängen am Hersteller-Platzhalter unbekannt', v_unbekannt;
  end if;

  if exists (select 1 from velocity.hersteller where name = 'unbekannt') then
    raise exception 'Der Hersteller-Platzhalter unbekannt existiert noch';
  end if;

  select count(*) filter (where t.typ_code = 'CITY')  into v_city
    from velocity.fahrrad f join velocity.fahrradmodell mo on mo.modell_id = f.modell_id
                            join velocity.fahrradtyp t on t.typ_id = mo.typ_id;
  select count(*) filter (where t.typ_code = 'EBIKE') into v_ebike
    from velocity.fahrrad f join velocity.fahrradmodell mo on mo.modell_id = f.modell_id
                            join velocity.fahrradtyp t on t.typ_id = mo.typ_id;
  select count(*) filter (where t.typ_code = 'CARGO') into v_cargo
    from velocity.fahrrad f join velocity.fahrradmodell mo on mo.modell_id = f.modell_id
                            join velocity.fahrradtyp t on t.typ_id = mo.typ_id;

  if (v_city, v_ebike, v_cargo) is distinct from (198, 52, 25) then
    raise exception 'Bestand je Typ hat sich verschoben: City %, E-Bike %, Cargo %',
      v_city, v_ebike, v_cargo;
  end if;

  select count(distinct baujahr) into v_baujahre from velocity.fahrradmodell where baujahr is not null;
  if v_baujahre < 3 then
    raise exception 'Baujahre sind kaum gestreut: nur % verschiedene Werte', v_baujahre;
  end if;

  raise notice 'Flottenmodelle stehen: City %, E-Bike %, Cargo % - % verschiedene Baujahre',
    v_city, v_ebike, v_cargo, v_baujahre;
end;
$$;

-- ---- Ruecknahme ------------------------------------------------------
-- insert into velocity.hersteller (name) values ('unbekannt')
--   on conflict (name) do nothing;
-- insert into velocity.fahrradmodell (hersteller_id, typ_id, modellbezeichnung)
--   select h.hersteller_id, t.typ_id, m.bezeichnung
--     from (values ('CITY','Bestandsrad City'),('EBIKE','Bestandsrad E-Bike'),
--                  ('CARGO','Bestandsrad Cargo')) as m(typ_code, bezeichnung)
--     join velocity.fahrradtyp t on t.typ_code = m.typ_code
--     cross join (select hersteller_id from velocity.hersteller where name = 'unbekannt') h
--   on conflict (hersteller_id, modellbezeichnung) do nothing;
-- -- Raeder zurueckhaengen: modell_id wieder auf das jeweilige
-- -- Bestandsrad-Modell ihres Typs setzen, dann die neuen Modelle und
-- -- Hersteller aus Block 1 loeschen.
-- delete from velocity.uebernahme_protokoll
--  where quelle = 'Referenzdaten (erzeugt)'
--    and ziel = 'velocity.hersteller, velocity.fahrradmodell, velocity.fahrrad';
