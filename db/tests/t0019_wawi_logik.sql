-- =====================================================================
-- t0019 Schreibende Funktionen der Warenwirtschaft
-- =====================================================================
create schema if not exists velocity_test;
set search_path = velocity_test, velocity, extensions, public;

-- Vorrichtung: angemeldeter Mitarbeiter mit genau den genannten Rollen.
create or replace function velocity_test.fixture_rollen(p_suffix text, p_codes text[])
returns uuid language plpgsql as $$
declare v_uid uuid := gen_random_uuid(); v_m bigint;
begin
  insert into velocity.mitarbeiter (personalnummer, auth_uid, vorname, nachname, email)
       values ('L-' || p_suffix, v_uid, 'Lena', 'Test', 'l-' || p_suffix || '@example.org')
    returning mitarbeiter_id into v_m;
  insert into velocity.mitarbeiter_rolle (mitarbeiter_id, rolle_id)
  select v_m, rolle_id from velocity.rolle where code = any(p_codes);
  perform set_config('request.jwt.claims', json_build_object('sub', v_uid)::text, true);
  return v_uid;
end;
$$;

create or replace function velocity_test.test_l_ohne_rolle_kein_schreiben()
returns setof text language plpgsql as $$
declare v_modell bigint; v_station bigint;
begin
  select modell_id into v_modell from velocity.fahrradmodell order by modell_id limit 1;
  select station_id into v_station from velocity.station order by station_id limit 1;
  perform velocity_test.fixture_rollen('ohne', array['werkstatt']);
  -- Werkstatt darf reparieren, nicht beschaffen. Die Pruefung sitzt in
  -- der Funktion, nicht in der Oberflaeche: sonst genuegte ein
  -- HTTP-Aufruf an PostgREST, um sie zu umgehen.
  return next throws_ok(
    format($q$ select velocity.api_rad_anlegen('RN-L-1', %s, %s) $q$, v_modell, v_station),
    '42501', null,
    'Ohne Rolle disposition kein neues Rad');
  perform set_config('request.jwt.claims', '', true);
end;
$$;

create or replace function velocity_test.test_l_rad_anlegen_und_status()
returns setof text language plpgsql as $$
declare v_modell bigint; v_f bigint; v_n integer; v_station bigint;
begin
  select modell_id into v_modell from velocity.fahrradmodell order by modell_id limit 1;
  select station_id into v_station from velocity.station order by station_id limit 1;
  perform velocity_test.fixture_rollen('rad', array['disposition']);
  v_f := velocity.api_rad_anlegen('RN-L-2', v_modell, v_station);

  -- GR13: ohne Station geht es nicht. Ein Rad auf 'verfuegbar' ohne Ort
  -- laesst der Trigger trg_radposition_pruefen nicht zu.
  return next throws_ok(
    format($q$ select velocity.api_rad_anlegen('RN-L-3', %s, null) $q$, v_modell),
    'P0001', 'Ein neues Rad braucht eine Station (GR13)',
    'Ein Rad ohne Station wird abgewiesen');
  return next ok(v_f is not null, 'Das Rad wird angelegt');

  -- GR21: die Anschaffung steht in der Lebenslaufakte.
  select count(*) into v_n from velocity.fahrrad_ereignis
   where fahrrad_id = v_f and ereignisart = 'angeschafft';
  return next is(v_n, 1, 'Die Anschaffung erzeugt ein Ereignis');

  perform velocity.api_rad_status_setzen(v_f, 'wartung', 'Inspektion faellig');
  return next is(
    (select status::text from velocity.fahrrad where fahrrad_id = v_f),
    'wartung', 'Der Status wird gesetzt');
  perform set_config('request.jwt.claims', '', true);
end;
$$;

create or replace function velocity_test.test_l_rad_in_fahrt_nicht_ausmustern()
returns setof text language plpgsql as $$
declare v_f record; v_a bigint;
begin
  select * into v_f from velocity_test.fixture_rad('ausmustern');
  insert into velocity.ausleihe (kunde_id, fahrrad_id, start_station_id, startzeit)
  select v_f.o_kunde_id, v_f.o_fahrrad_id, station_id, now()
    from velocity.station order by station_id limit 1;
  perform velocity_test.fixture_rollen('ausm', array['disposition']);
  -- GR20: ein Rad, auf dem gerade jemand sitzt, verschwindet nicht aus
  -- dem Bestand.
  return next throws_ok(
    format($q$ select velocity.api_rad_ausmustern(%s, 'Rahmenbruch') $q$, v_f.o_fahrrad_id),
    'P0001', null,
    'Ein Rad mit laufender Ausleihe wird nicht ausgemustert');
  perform set_config('request.jwt.claims', '', true);
end;
$$;

create or replace function velocity_test.test_l_station_wird_stillgelegt_nicht_geloescht()
returns setof text language plpgsql as $$
declare v_s bigint;
begin
  perform velocity_test.fixture_rollen('stat', array['disposition']);
  v_s := velocity.api_station_anlegen('Teststation L', 'Teststrasse', '1',
                                      '97070', 'Wuerzburg', 49.79, 9.93, 12);
  return next ok(v_s is not null, 'Die Station wird angelegt');

  perform velocity.api_station_stilllegen(v_s, current_date);
  -- GR22: eine Station verschwindet nicht, sie hoert ab einem Datum auf
  -- zu existieren. Sonst verloeren alle Fahrten dorthin ihren Ort.
  return next ok(
    (select station_id from velocity.station where station_id = v_s) is not null,
    'Die Station bleibt als Satz erhalten');
  return next ok(
    not (select upper_inf(betriebszeitraum) from velocity.station where station_id = v_s),
    'Ihr Betriebszeitraum ist geschlossen');
  perform set_config('request.jwt.claims', '', true);
end;
$$;
