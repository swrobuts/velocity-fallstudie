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

-- =====================================================================
--  GR13: WO STEHT DAS RAD?
--
--  Drei Zustaende, kein vierter: an einer Station, frei im Stadtgebiet,
--  oder in Fahrt und damit nirgends. Der erste Teil steht als CHECK in
--  der Tabelle, der zweite als Constraint-Trigger - er braucht den
--  Status des Rades, und der liegt woanders.
--
--  Der Trigger ist initially deferred und feuert damit erst beim
--  Commit. pgTAP rollt jeden Test zurueck, also wuerde er nie
--  ausloesen. Die Tests erzwingen ihn deshalb mit
--  set constraints all immediate.
-- =====================================================================

create or replace function velocity_test.fixture_rad_ort(p_suffix text)
returns table (o_fahrrad_id bigint, o_station_id bigint)
language plpgsql as $$
declare
  v_typ bigint; v_h bigint; v_m bigint; v_ad bigint;
begin
  insert into velocity.adresse (strasse, plz, ort) values ('Ortstr', '97070', 'Würzburg')
    returning adresse_id into v_ad;
  insert into velocity.station (stationsnummer, name, adresse_id, kapazitaet)
       values ('S-O' || p_suffix, 'Ortstation ' || p_suffix, v_ad, 10)
    returning station_id into o_station_id;
  insert into velocity.fahrradtyp (typ_code, bezeichnung)
       values ('O-' || p_suffix, 'Ortstestrad ' || p_suffix) returning typ_id into v_typ;
  insert into velocity.hersteller (name) values ('Ortshersteller ' || p_suffix)
    returning hersteller_id into v_h;
  insert into velocity.fahrradmodell (hersteller_id, typ_id, modellbezeichnung)
       values (v_h, v_typ, 'OM-' || p_suffix) returning modell_id into v_m;
  insert into velocity.fahrrad (rahmennummer, modell_id) values ('RN-O-' || p_suffix, v_m)
    returning fahrrad_id into o_fahrrad_id;
  return next;
end;
$$;

create or replace function velocity_test.test_b_ort_nie_beides()
returns setof text language plpgsql as $$
declare
  v_f record;
begin
  select * into v_f from velocity_test.fixture_rad_ort('1');

  return next throws_ok(
    format($sql$insert into velocity.fahrrad_position (fahrrad_id, station_id, latitude, longitude)
                values (%s, %s, 49.79, 9.93)$sql$, v_f.o_fahrrad_id, v_f.o_station_id),
    '23514', null, 'Station UND Koordinaten zugleich wird abgewiesen');

  return next throws_ok(
    format($sql$insert into velocity.fahrrad_position (fahrrad_id, latitude)
                values (%s, 49.79)$sql$, v_f.o_fahrrad_id),
    '23514', null, 'Ein halbes Koordinatenpaar wird abgewiesen');

  return next lives_ok(
    format($sql$insert into velocity.fahrrad_position (fahrrad_id, station_id)
                values (%s, %s)$sql$, v_f.o_fahrrad_id, v_f.o_station_id),
    'An einer Station ohne Koordinaten wird angenommen');
end;
$$;

create or replace function velocity_test.test_b_ort_frei_erlaubt()
returns setof text language plpgsql as $$
declare
  v_f record;
begin
  select * into v_f from velocity_test.fixture_rad_ort('2');
  return next lives_ok(
    format($sql$insert into velocity.fahrrad_position (fahrrad_id, latitude, longitude)
                values (%s, 49.79, 9.93)$sql$, v_f.o_fahrrad_id),
    'Frei im Stadtgebiet mit Koordinaten wird angenommen');
end;
$$;

create or replace function velocity_test.test_b_verfuegbar_braucht_standort()
returns setof text language plpgsql as $$
declare
  v_f record;
begin
  select * into v_f from velocity_test.fixture_rad_ort('3');
  insert into velocity.fahrrad_position (fahrrad_id) values (v_f.o_fahrrad_id);

  -- Das Rad ist verfuegbar, hat aber keinen Standort. Der Trigger ist
  -- aufgeschoben, also erzwingen wir die Pruefung.
  begin
    set constraints all immediate;
    return next fail('Ein verfuegbares Rad ohne Standort haette abgewiesen werden muessen');
  exception when check_violation then
    return next pass('Ein verfuegbares Rad ohne Standort wird abgewiesen');
  end;
end;
$$;

create or replace function velocity_test.test_b_ausgeliehen_ohne_standort()
returns setof text language plpgsql as $$
declare
  v_f record;
begin
  select * into v_f from velocity_test.fixture_rad_ort('4');
  insert into velocity.fahrrad_position (fahrrad_id, station_id)
       values (v_f.o_fahrrad_id, v_f.o_station_id);
  update velocity.fahrrad set status = 'ausgeliehen' where fahrrad_id = v_f.o_fahrrad_id;

  -- Ein Rad in Fahrt steht nirgends. Ein Ort waere eine Luege.
  begin
    set constraints all immediate;
    return next fail('Ein ausgeliehenes Rad mit Standort haette abgewiesen werden muessen');
  exception when check_violation then
    return next pass('Ein ausgeliehenes Rad darf keinen Standort tragen');
  end;
end;
$$;

create or replace function velocity_test.test_b_ort_erst_beim_commit()
returns setof text language plpgsql as $$
declare
  v_f record; v_pos velocity.fahrrad_position%rowtype;
begin
  select * into v_f from velocity_test.fixture_rad_ort('5');
  insert into velocity.fahrrad_position (fahrrad_id, station_id)
       values (v_f.o_fahrrad_id, v_f.o_station_id);

  -- Genau dafuer ist der Trigger aufgeschoben: zwischen diesen beiden
  -- Anweisungen ist der Zustand notwendig widerspruechlich. Waere er
  -- immediate, koennte fn_ausleihe_starten seine Arbeit nicht tun.
  update velocity.fahrrad set status = 'ausgeliehen' where fahrrad_id = v_f.o_fahrrad_id;
  update velocity.fahrrad_position
     set station_id = null, latitude = null, longitude = null
   where fahrrad_id = v_f.o_fahrrad_id;

  return next lives_ok('set constraints all immediate',
    'Zwischenzustand in einer Transaktion ist erlaubt, das Ergebnis zaehlt');
  -- Zurueckstellen: set constraints gilt fuer die ganze Transaktion, und
  -- pgTAP faehrt alle Testfunktionen in genau einer. Ohne das hier
  -- pruefte jeder folgende Test sofort statt beim Commit.
  set constraints all deferred;

  select * into v_pos from velocity.fahrrad_position where fahrrad_id = v_f.o_fahrrad_id;
  return next ok(v_pos.station_id is null and v_pos.latitude is null,
                 'Nach dem Start traegt das Rad keinen Standort mehr');
end;
$$;

create or replace function velocity_test.test_b_station_mit_raedern_nicht_loeschbar()
returns setof text language plpgsql as $$
declare
  v_f record;
begin
  select * into v_f from velocity_test.fixture_rad_ort('6');
  insert into velocity.fahrrad_position (fahrrad_id, station_id)
       values (v_f.o_fahrrad_id, v_f.o_station_id);

  -- Mit on delete set null waere aus dem abgestellten Rad eines ohne
  -- bekannten Standort geworden.
  return next throws_ok(
    format($sql$delete from velocity.station where station_id = %s$sql$, v_f.o_station_id),
    '23503', null, 'Eine Station mit abgestellten Raedern laesst sich nicht loeschen');
end;
$$;
