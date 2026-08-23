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

  insert into velocity.ausleihe (kunde_id, fahrrad_id, start_latitude, start_longitude,
                                 end_latitude, end_longitude, startzeit, endzeit, status)
       values (v_f.o_kunde_id, v_f.o_fahrrad_id, 49.790000, 9.930000, 49.780000, 9.940000,
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

  insert into velocity.ausleihe (kunde_id, fahrrad_id, start_latitude, start_longitude, startzeit)
       values (v_f.o_kunde_id, v_f.o_fahrrad_id, 49.790000, 9.930000, now());

  return next throws_ok(
    format($sql$insert into velocity.ausleihe (kunde_id, fahrrad_id, start_latitude, start_longitude, startzeit)
                values (%s, %s, 49.790000, 9.930000, now())$sql$, v_f.o_kunde_id, v_f.o_fahrrad_id),
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
    format($sql$insert into velocity.ausleihe (kunde_id, fahrrad_id, start_latitude, start_longitude, startzeit,
                                                   end_latitude, end_longitude, endzeit, status)
                values (%s, %s, 49.790000, 9.930000, now(), 49.790000, 9.930000, now(), 'aktiv')$sql$,
           v_f.o_kunde_id, v_f.o_fahrrad_id),
    '23514', null, 'Aktive Ausleihe darf keine Endzeit haben');

  return next throws_ok(
    format($sql$insert into velocity.ausleihe (kunde_id, fahrrad_id, start_latitude, start_longitude, startzeit, status)
                values (%s, %s, 49.790000, 9.930000, now(), 'abgeschlossen')$sql$,
           v_f.o_kunde_id, v_f.o_fahrrad_id),
    '23514', null, 'Abgeschlossene Ausleihe braucht eine Endzeit');
end;
$$;

-- =====================================================================
--  ORTSPFLICHT
--
--  Aufgekommen aus einer Ruecknachfrage zum ER-Diagramm: das Modell
--  erlaubte eine Ausleihe ohne Station UND ohne Koordinaten - eine
--  Fahrt, von der niemand weiss, wo sie begann. NOT NULL geht nicht,
--  weil die Fallstudie zwei Abstellarten kennt. Gefordert ist "genau
--  eines von beiden".
-- =====================================================================

create or replace function velocity_test.test_d_startort_genau_einer()
returns setof text language plpgsql as $$
declare
  v_f record; v_st bigint; v_ad bigint;
begin
  select * into v_f from velocity_test.fixture_rad('startort');
  insert into velocity.adresse (strasse, plz, ort) values ('Teststr', '97070', 'Würzburg')
    returning adresse_id into v_ad;
  insert into velocity.station (stationsnummer, name, adresse_id, kapazitaet)
       values ('S-T001', 'Teststation Startort', v_ad, 10) returning station_id into v_st;

  return next throws_ok(
    format($sql$insert into velocity.ausleihe (kunde_id, fahrrad_id, startzeit)
                values (%s, %s, now())$sql$, v_f.o_kunde_id, v_f.o_fahrrad_id),
    '23514', null, 'Ausleihe ohne jede Ortsangabe wird abgewiesen');

  return next throws_ok(
    format($sql$insert into velocity.ausleihe
                  (kunde_id, fahrrad_id, start_station_id,
                   start_latitude, start_longitude, startzeit)
                values (%s, %s, %s, 49.79, 9.93, now())$sql$,
           v_f.o_kunde_id, v_f.o_fahrrad_id, v_st),
    '23514', null, 'Station UND Koordinaten zugleich wird abgewiesen');

  return next lives_ok(
    format($sql$insert into velocity.ausleihe (kunde_id, fahrrad_id, start_station_id, startzeit)
                values (%s, %s, %s, now())$sql$, v_f.o_kunde_id, v_f.o_fahrrad_id, v_st),
    'Start an einer Station wird angenommen');
end;
$$;

create or replace function velocity_test.test_d_startort_frei_erlaubt()
returns setof text language plpgsql as $$
declare
  v_f record;
begin
  select * into v_f from velocity_test.fixture_rad('startfrei');
  -- Die Fallstudie kennt zwei Abstellarten. Frei im Stadtgebiet muss gehen.
  return next lives_ok(
    format($sql$insert into velocity.ausleihe
                  (kunde_id, fahrrad_id, start_latitude, start_longitude, startzeit)
                values (%s, %s, 49.79, 9.93, now())$sql$,
           v_f.o_kunde_id, v_f.o_fahrrad_id),
    'Freies Abstellen als Startort wird angenommen');
end;
$$;

create or replace function velocity_test.test_d_endort_folgt_der_endzeit()
returns setof text language plpgsql as $$
declare
  v_f record; v_a bigint;
begin
  select * into v_f from velocity_test.fixture_rad('endort');

  insert into velocity.ausleihe (kunde_id, fahrrad_id, start_latitude, start_longitude, startzeit)
       values (v_f.o_kunde_id, v_f.o_fahrrad_id, 49.79, 9.93, now())
    returning ausleihe_id into v_a;

  return next throws_ok(
    format($sql$update velocity.ausleihe set end_latitude = 49.78, end_longitude = 9.94
                 where ausleihe_id = %s$sql$, v_a),
    '23514', null, 'Laufende Ausleihe darf keinen Rueckgabeort tragen');

  return next throws_ok(
    format($sql$update velocity.ausleihe
                   set endzeit = now(), status = 'abgeschlossen'
                 where ausleihe_id = %s$sql$, v_a),
    '23514', null, 'Beendete Ausleihe ohne Rueckgabeort wird abgewiesen');

  return next lives_ok(
    format($sql$update velocity.ausleihe
                   set endzeit = now(), status = 'abgeschlossen',
                       end_latitude = 49.78, end_longitude = 9.94
                 where ausleihe_id = %s$sql$, v_a),
    'Beenden mit genau einer Ortsangabe wird angenommen');
end;
$$;

create or replace function velocity_test.test_d_station_nicht_loeschbar()
returns setof text language plpgsql as $$
declare
  v_f record; v_st bigint; v_ad bigint;
begin
  select * into v_f from velocity_test.fixture_rad('stloesch');
  insert into velocity.adresse (strasse, plz, ort) values ('Loeschstr', '97070', 'Würzburg')
    returning adresse_id into v_ad;
  insert into velocity.station (stationsnummer, name, adresse_id, kapazitaet)
       values ('S-T002', 'Teststation Loeschen', v_ad, 10) returning station_id into v_st;
  insert into velocity.ausleihe (kunde_id, fahrrad_id, start_station_id, startzeit)
       values (v_f.o_kunde_id, v_f.o_fahrrad_id, v_st, now());

  -- Mit on delete set null waere hier die einzige Ortsangabe der Fahrt
  -- stillschweigend verschwunden. Stationen werden ausser Betrieb
  -- genommen, nicht geloescht.
  return next throws_ok(
    format($sql$delete from velocity.station where station_id = %s$sql$, v_st),
    '23503', null, 'Eine Station mit Ausleihen laesst sich nicht loeschen');
end;
$$;

create or replace function velocity_test.test_d_beenden_meldet_ortsfehler()
returns setof text language plpgsql as $$
declare
  v_f record; v_a bigint; v_e record;
begin
  select * into v_f from velocity_test.fixture_rad('endmeldung');
  insert into velocity.ausleihe (kunde_id, fahrrad_id, start_latitude, start_longitude, startzeit)
       values (v_f.o_kunde_id, v_f.o_fahrrad_id, 49.79, 9.93, now())
    returning ausleihe_id into v_a;

  -- Fachliche Fehler gehoeren in die Meldung, nicht in einen SQLSTATE,
  -- mit dem die Anwendung nichts anfangen kann.
  select * into v_e from velocity.fn_ausleihe_beenden(v_f.o_kunde_id, v_a);
  return next is(v_e.meldung,
    'Rueckgabe braucht entweder eine Station oder Koordinaten, nicht beides',
    'Beenden ohne Ortsangabe meldet fachlich, statt den Constraint feuern zu lassen');
end;
$$;

create or replace function velocity_test.test_d_rad_ohne_standort_nicht_leihbar()
returns setof text language plpgsql as $$
declare
  v_f record; v_e record;
begin
  select * into v_f from velocity_test.fixture_rad('ohnestandort');
  -- Position ohne Station und ohne Koordinaten: der Standort ist unbekannt.
  insert into velocity.fahrrad_position (fahrrad_id) values (v_f.o_fahrrad_id);

  select * into v_e from velocity.fn_ausleihe_starten(v_f.o_kunde_id, v_f.o_fahrrad_id);
  return next is(v_e.meldung, 'Standort des Rades unbekannt, Ausleihe nicht moeglich',
                 'Ein Rad, das niemand finden kann, laesst sich nicht ausleihen');
  return next ok(v_e.ausleihe_id is null, 'Es entsteht keine Ausleihe ohne Startort');
end;
$$;
