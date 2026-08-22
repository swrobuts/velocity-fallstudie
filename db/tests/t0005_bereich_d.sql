-- =====================================================================
-- t0005 Bereich D: Nutzung
-- =====================================================================
create schema if not exists velocity_test;
set search_path = velocity_test, velocity, extensions, public;

-- Vorrichtung: legt Kunde, Typ, Modell und Rad an. Kein Test, deshalb
-- ohne Praefix test_.
create or replace function velocity_test.fixture_rad(p_suffix text)
returns table (o_kunde_id bigint, o_fahrrad_id bigint)
language plpgsql as $$
declare
  v_typ bigint; v_h bigint; v_m bigint;
begin
  insert into velocity.kunde (email, vorname, nachname)
       values ('d-' || p_suffix || '@example.org', 'Dora', 'Test')
    returning kunde_id into o_kunde_id;
  insert into velocity.fahrradtyp (typ_code, bezeichnung)
       values ('D-' || p_suffix, 'Nutzungstestrad ' || p_suffix) returning typ_id into v_typ;
  insert into velocity.hersteller (name) values ('Hersteller ' || p_suffix)
    returning hersteller_id into v_h;
  insert into velocity.fahrradmodell (hersteller_id, typ_id, modellbezeichnung)
       values (v_h, v_typ, 'M-' || p_suffix) returning modell_id into v_m;
  insert into velocity.fahrrad (rahmennummer, modell_id)
       values ('RN-D-' || p_suffix, v_m) returning fahrrad_id into o_fahrrad_id;
  return next;
end;
$$;

create or replace function velocity_test.test_d_struktur()
returns setof text language plpgsql as $$
begin
  return next has_table('velocity'::name, 'entgeltart'::name,      'Tabelle entgeltart existiert');
  return next has_table('velocity'::name, 'ausleihe'::name,        'Tabelle ausleihe existiert');
  return next has_table('velocity'::name, 'entgeltposition'::name, 'Tabelle entgeltposition existiert');
  -- Die Kosten stehen in den Positionen, nicht als Einzelwert an der Ausleihe.
  return next hasnt_column('velocity'::name, 'ausleihe'::name, 'kosten'::name,
                           'ausleihe traegt keinen Sammelbetrag');
end;
$$;

create or replace function velocity_test.test_d_dauer_wird_berechnet()
returns setof text language plpgsql as $$
declare
  v_f record; v_a bigint;
begin
  select * into v_f from velocity_test.fixture_rad('dauer');

  insert into velocity.ausleihe (kunde_id, fahrrad_id, startzeit, endzeit, status)
       values (v_f.o_kunde_id, v_f.o_fahrrad_id,
               timestamptz '2026-08-01 10:00:00+02',
               timestamptz '2026-08-01 10:31:20+02', 'abgeschlossen')
    returning ausleihe_id into v_a;

  -- 31 Minuten 20 Sekunden werden zu 32 Minuten aufgerundet (GR6).
  return next is((select dauer_minuten from velocity.ausleihe where ausleihe_id = v_a),
                 32, 'Angefangene Minuten werden aufgerundet');

  return next throws_ok(
    format($sql$update velocity.ausleihe set dauer_minuten = 5 where ausleihe_id = %s$sql$, v_a),
    '428C9', null, 'dauer_minuten ist berechnet und nicht beschreibbar');
end;
$$;

create or replace function velocity_test.test_d_ein_rad_nur_einmal_aktiv()
returns setof text language plpgsql as $$
declare
  v_f record;
begin
  select * into v_f from velocity_test.fixture_rad('aktiv');

  insert into velocity.ausleihe (kunde_id, fahrrad_id, startzeit)
       values (v_f.o_kunde_id, v_f.o_fahrrad_id, now());

  return next throws_ok(
    format($sql$insert into velocity.ausleihe (kunde_id, fahrrad_id, startzeit)
                values (%s, %s, now())$sql$, v_f.o_kunde_id, v_f.o_fahrrad_id),
    '23505', null, 'Dasselbe Rad kann nicht zweimal gleichzeitig aktiv ausgeliehen sein');
end;
$$;

create or replace function velocity_test.test_d_statuskonsistenz()
returns setof text language plpgsql as $$
declare
  v_f record;
begin
  select * into v_f from velocity_test.fixture_rad('status');

  return next throws_ok(
    format($sql$insert into velocity.ausleihe (kunde_id, fahrrad_id, startzeit, endzeit, status)
                values (%s, %s, now(), now(), 'aktiv')$sql$, v_f.o_kunde_id, v_f.o_fahrrad_id),
    '23514', null, 'Aktive Ausleihe darf keine Endzeit haben');

  return next throws_ok(
    format($sql$insert into velocity.ausleihe (kunde_id, fahrrad_id, startzeit, status)
                values (%s, %s, now(), 'abgeschlossen')$sql$, v_f.o_kunde_id, v_f.o_fahrrad_id),
    '23514', null, 'Abgeschlossene Ausleihe braucht eine Endzeit');
end;
$$;
