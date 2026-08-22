-- =====================================================================
-- t0003 Bereich B: Netz und Flotte
-- =====================================================================
create schema if not exists velocity_test;
set search_path = velocity_test, velocity, extensions, public;

create or replace function velocity_test.test_b_struktur()
returns setof text language plpgsql as $$
begin
  return next has_table('velocity'::name, 'station'::name,            'Tabelle station existiert');
  return next has_table('velocity'::name, 'fahrradtyp'::name,         'Tabelle fahrradtyp existiert');
  return next has_table('velocity'::name, 'fahrradtyp_merkmal'::name, 'Tabelle fahrradtyp_merkmal existiert');
  return next has_table('velocity'::name, 'hersteller'::name,         'Tabelle hersteller existiert');
  return next has_table('velocity'::name, 'fahrradmodell'::name,      'Tabelle fahrradmodell existiert');
  return next has_table('velocity'::name, 'fahrrad'::name,            'Tabelle fahrrad existiert');
  return next has_table('velocity'::name, 'fahrrad_position'::name,   'Tabelle fahrrad_position existiert');

  -- Preise gehoeren nicht an den Typ, sondern in die historisierte
  -- Preistabelle aus Schritt 0004.
  return next hasnt_column('velocity'::name, 'fahrradtyp'::name, 'preis_pro_minute'::name,
                           'fahrradtyp traegt keinen Preis');
  return next hasnt_column('velocity'::name, 'fahrradtyp'::name, 'startgebuehr'::name,
                           'fahrradtyp traegt keine Startgebuehr');
  -- Koordinaten gehoeren an die Position, nicht an das Stammdatum.
  return next hasnt_column('velocity'::name, 'fahrrad'::name, 'latitude'::name,
                           'fahrrad traegt keine Koordinaten');

  return next col_is_pk('velocity'::name, 'fahrrad_position'::name, 'fahrrad_id'::name,
                        'fahrrad_position ist ueber den Fahrradschluessel 1:1 angebunden');
  return next fk_ok('velocity'::name, 'fahrrad'::name, 'modell_id'::name,
                    'velocity'::name, 'fahrradmodell'::name, 'modell_id'::name,
                    'fahrrad verweist auf fahrradmodell');
  return next fk_ok('velocity'::name, 'fahrradmodell'::name, 'typ_id'::name,
                    'velocity'::name, 'fahrradtyp'::name, 'typ_id'::name,
                    'fahrradmodell verweist auf fahrradtyp');
end;
$$;

create or replace function velocity_test.test_b_regeln()
returns setof text language plpgsql as $$
declare
  v_typ     bigint;
  v_herst   bigint;
  v_modell  bigint;
  v_rad     bigint;
begin
  insert into velocity.fahrradtyp (typ_code, bezeichnung, hat_elektro)
       values ('TEST', 'Testrad', false) returning typ_id into v_typ;
  insert into velocity.hersteller (name) values ('Testhersteller') returning hersteller_id into v_herst;
  insert into velocity.fahrradmodell (hersteller_id, typ_id, modellbezeichnung, baujahr)
       values (v_herst, v_typ, 'T1', 2026) returning modell_id into v_modell;
  insert into velocity.fahrrad (rahmennummer, modell_id) values ('RN-TEST-1', v_modell)
    returning fahrrad_id into v_rad;

  return next is((select status::text from velocity.fahrrad where fahrrad_id = v_rad),
                 'verfuegbar', 'Neues Fahrrad ist standardmaessig verfuegbar');

  return next throws_ok(
    $sql$insert into velocity.station (stationsnummer, name, plz_platzhalter)
         values ('X', 'Y', 'Z')$sql$,
    '42703', null, 'Station hat keine Adressspalten, sondern einen Adressverweis');

  return next throws_ok(
    format($sql$insert into velocity.fahrrad_position (fahrrad_id, akkustand_prozent)
                values (%s, 150)$sql$, v_rad),
    '23514', null, 'Akkustand ueber 100 Prozent wird abgewiesen');

  return next lives_ok(
    format($sql$insert into velocity.fahrrad_position (fahrrad_id, latitude, longitude)
                values (%s, 49.7913, 9.9534)$sql$, v_rad),
    'Freie Position ohne Station ist zulaessig (Free-Floating)');
end;
$$;

create or replace function velocity_test.test_b_kapazitaet()
returns setof text language plpgsql as $$
declare
  v_adr bigint;
begin
  insert into velocity.adresse (strasse, hausnummer, plz, ort)
       values ('Bahnhofstrasse', '1', '97070', 'Wuerzburg') returning adresse_id into v_adr;

  return next throws_ok(
    format($sql$insert into velocity.station (stationsnummer, name, adresse_id, kapazitaet)
                values ('S-TEST', 'Teststation', %s, 0)$sql$, v_adr),
    '23514', null, 'Station mit Kapazitaet 0 wird abgewiesen');
end;
$$;
