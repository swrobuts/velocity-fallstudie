-- =====================================================================
-- t0024 Ausstattung des einzelnen Rades
--
-- Geprueft werden die REGELN, nicht die Werte: dass ein Motortyp ohne
-- Elektroantrieb abgewiesen wird, dass ein Schloss an genau einem Rad
-- haengt, dass die Erfassung ihre Pflichtangaben verlangt. Welche
-- Bremsen ein bestimmtes City-Bike hat, ist Stammdatenpflege und
-- aendert sich; die Regeln darueber duerfen das nicht.
--
-- Der Umzug des Gewichts vom Typ ans Rad steht in t0003 (dort, wo die
-- Zusicherung frueher das Gegenteil festhielt) und in t0018 fuer
-- v_wawi_modell. Hier steht, was nur mit den neuen Spalten gilt.
-- =====================================================================
create schema if not exists velocity_test;
set search_path = velocity_test, velocity, extensions, public;

create or replace function velocity_test.test_ra_spalten_am_rad()
returns setof text language plpgsql as $$
begin
  return next has_column('velocity'::name, 'fahrrad'::name, 'farbe'::name,
    'Die Farbe haengt am Rad');
  return next has_column('velocity'::name, 'fahrrad'::name, 'gewicht_kg'::name,
    'Das Gewicht haengt am Rad');
  return next has_column('velocity'::name, 'fahrrad'::name, 'rahmenform'::name,
    'Die Rahmenform haengt am Rad');
  return next has_column('velocity'::name, 'fahrrad'::name, 'schaltung'::name,
    'Die Schaltungsbauart haengt am Rad');
  return next has_column('velocity'::name, 'fahrrad'::name, 'bremsen'::name,
    'Die Bremsbauart haengt am Rad');
  return next has_column('velocity'::name, 'fahrrad'::name, 'beleuchtung'::name,
    'Die Beleuchtung haengt am Rad');
  return next has_column('velocity'::name, 'fahrrad'::name, 'antrieb'::name,
    'Der Antrieb haengt am Rad');
  return next has_column('velocity'::name, 'fahrrad'::name, 'motortyp'::name,
    'Der Motortyp haengt am Rad');
  return next has_column('velocity'::name, 'fahrrad'::name, 'reifengroesse_zoll'::name,
    'Die Reifengroesse haengt am Rad');
  return next has_column('velocity'::name, 'fahrrad'::name, 'schlossnummer'::name,
    'Die Schlossnummer haengt am Rad');

  -- Die Gangzahl bleibt AM TYP. Sie folgt der Bauart und nicht dem
  -- Exemplar - haette man sie mit umziehen lassen, waere der Umzug
  -- Selbstzweck gewesen statt einer fachlichen Entscheidung.
  return next hasnt_column('velocity'::name, 'fahrrad'::name, 'gangzahl'::name,
    'Die Gangzahl bleibt am Typ - sie folgt der Bauart, nicht dem Rad');
end;
$$;

-- Der Anlass der ganzen Aenderung: Raeder sollen sich unterscheiden.
-- Eine Spalte, in der ueberall dasselbe steht, haette nichts gewonnen.
create or replace function velocity_test.test_ra_raeder_wiegen_verschieden()
returns setof text language plpgsql as $$
declare v_n bigint; v_ohne bigint;
begin
  select count(distinct gewicht_kg) into v_n from velocity.fahrrad;
  return next cmp_ok(v_n, '>', 1::bigint,
    'Die Flotte kennt mehr als ein Gewicht - sonst waere die Spalte am Rad sinnlos');

  select count(*) into v_ohne from velocity.fahrrad where gewicht_kg is null;
  return next is(v_ohne, 0::bigint,
    'Kein Rad im Bestand ist ohne Gewicht geblieben');
end;
$$;

create or replace function velocity_test.test_ra_motor_nur_bei_elektro()
returns setof text language plpgsql as $$
declare v_city bigint; v_ebike bigint;
begin
  -- Ein Rad eines Typs OHNE Elektroantrieb.
  select f.fahrrad_id into v_city
    from velocity.fahrrad f
    join velocity.fahrradmodell mo on mo.modell_id = f.modell_id
    join velocity.fahrradtyp    t  on t.typ_id     = mo.typ_id
   where not t.hat_elektro
   order by f.fahrrad_id limit 1;

  return next throws_ok(
    format($q$ update velocity.fahrrad set motortyp = 'Bosch Performance CX'
                where fahrrad_id = %s $q$, v_city),
    '23514', null,
    'Ein Rad ohne Elektroantrieb bekommt keinen Motortyp');

  -- Und die Gegenprobe: bei einem Elektrotyp geht es. Ohne sie liesse
  -- sich die Regel auch durch einen Trigger erfuellen, der immer wirft.
  select f.fahrrad_id into v_ebike
    from velocity.fahrrad f
    join velocity.fahrradmodell mo on mo.modell_id = f.modell_id
    join velocity.fahrradtyp    t  on t.typ_id     = mo.typ_id
   where t.hat_elektro
   order by f.fahrrad_id limit 1;

  return next lives_ok(
    format($q$ update velocity.fahrrad set motortyp = 'Pruefmotor'
                where fahrrad_id = %s $q$, v_ebike),
    'Bei einem Elektrotyp wird der Motortyp angenommen');
end;
$$;

create or replace function velocity_test.test_ra_schloss_haengt_an_einem_rad()
returns setof text language plpgsql as $$
declare v_a bigint; v_b bigint;
begin
  select fahrrad_id into v_a from velocity.fahrrad order by fahrrad_id limit 1;
  select fahrrad_id into v_b from velocity.fahrrad
   where fahrrad_id > v_a order by fahrrad_id limit 1;

  update velocity.fahrrad set schlossnummer = 'SCHLOSS-PRUEF' where fahrrad_id = v_a;
  return next throws_ok(
    format($q$ update velocity.fahrrad set schlossnummer = 'SCHLOSS-PRUEF'
                where fahrrad_id = %s $q$, v_b),
    '23505', null,
    'Dieselbe Schlossnummer ein zweites Mal wird abgewiesen');

  -- NULL bleibt beliebig oft erlaubt: Raeder ohne Schloss sind kein
  -- Widerspruch, deshalb ist der Index partiell.
  return next lives_ok(
    format($q$ update velocity.fahrrad set schlossnummer = null
                where fahrrad_id in (%s, %s) $q$, v_a, v_b),
    'Mehrere Raeder ohne Schlossnummer sind kein Widerspruch');
end;
$$;

create or replace function velocity_test.test_ra_farbe_ist_eine_ral_nummer()
returns setof text language plpgsql as $$
declare v_n bigint;
begin
  select count(*) into v_n from velocity.fahrrad where farbe is null;
  return next is(v_n, 0::bigint, 'Kein Rad ohne Farbe - die Spalte ist NOT NULL');

  select fahrrad_id into v_n from velocity.fahrrad order by fahrrad_id limit 1;
  return next throws_ok(
    format($q$ update velocity.fahrrad set farbe = '   ' where fahrrad_id = %s $q$, v_n),
    '23514', null,
    'Ein Leerstring ist keine Farbe');

  -- Die Farbe ist eine Normangabe. 'rot' war der Wert vor der Umstellung
  -- und ist seither keiner mehr - sonst stuenden nach einem Jahr vier
  -- Schreibweisen desselben Lacks nebeneinander.
  return next throws_ok(
    format($q$ update velocity.fahrrad set farbe = 'rot' where fahrrad_id = %s $q$, v_n),
    '23514', null,
    'Ein Klarname ohne RAL-Nummer wird abgewiesen');
  return next throws_ok(
    format($q$ update velocity.fahrrad set farbe = 'RAL3000' where fahrrad_id = %s $q$, v_n),
    '23514', null,
    'Auch RAL3000 ohne Leerzeichen wird abgewiesen');
  return next lives_ok(
    format($q$ update velocity.fahrrad set farbe = 'RAL 6018' where fahrrad_id = %s $q$, v_n),
    'Eine andere RAL-Nummer geht - die Regel prueft die Form, nicht den Ton');
end;
$$;

create or replace function velocity_test.test_ra_anlage_verlangt_ausstattung()
returns setof text language plpgsql as $$
declare v_modell bigint; v_station bigint;
begin
  select modell_id  into v_modell  from velocity.fahrradmodell order by modell_id limit 1;
  select station_id into v_station from velocity.station       order by station_id limit 1;
  perform velocity_test.fixture_rollen('ausstattung', array['disposition']);

  -- Die Pflicht sitzt in der Funktion, nicht als NOT NULL an der
  -- Tabelle: Ladelaeufe und Testvorrichtungen fuegen weiterhin ohne
  -- diese Angaben ein. Genau deshalb muss sie hier geprueft werden -
  -- ein NOT NULL wuerde sich selbst beweisen, eine Funktionspruefung
  -- nicht.
  return next throws_ok(
    format($q$ select velocity.api_rad_anlegen('RN-RA-1', %s, %s, null,
                 'diamant', 'kette', 'felge', 'akku', 'kette') $q$,
           v_modell, v_station),
    '22023', null,
    'Ohne Gewicht wird kein Rad angelegt');

  return next throws_ok(
    format($q$ select velocity.api_rad_anlegen('RN-RA-2', %s, %s, 19.5,
                 'diamant', 'kette', 'felge', 'akku', null) $q$,
           v_modell, v_station),
    '22023', null,
    'Ohne Antrieb wird kein Rad angelegt');

  perform set_config('request.jwt.claims', '', true);
end;
$$;

create or replace function velocity_test.test_ra_anlage_traegt_alles_ein()
returns setof text language plpgsql as $$
declare v_modell bigint; v_station bigint; v_f bigint; v_r record;
begin
  select modell_id  into v_modell  from velocity.fahrradmodell order by modell_id limit 1;
  select station_id into v_station from velocity.station       order by station_id limit 1;
  perform velocity_test.fixture_rollen('ausstattung-voll', array['disposition']);

  v_f := velocity.api_rad_anlegen('RN-RA-3', v_modell, v_station, 21.4,
           'tiefeinsteiger', 'nabe', 'scheibe', 'nabendynamo', 'riemen',
           'RAL 3000', null, 28.0, 'SCHLOSS-RA-3');

  select * into v_r from velocity.fahrrad where fahrrad_id = v_f;
  return next is(v_r.gewicht_kg, 21.4, 'Das Gewicht kommt an');
  return next is(v_r.rahmenform::text,  'tiefeinsteiger', 'Die Rahmenform kommt an');
  return next is(v_r.schaltung::text,   'nabe',           'Die Schaltung kommt an');
  return next is(v_r.bremsen::text,     'scheibe',        'Die Bremsen kommen an');
  return next is(v_r.beleuchtung::text, 'nabendynamo',    'Die Beleuchtung kommt an');
  return next is(v_r.antrieb::text,     'riemen',         'Der Antrieb kommt an');
  return next is(v_r.farbe,             'RAL 3000',       'Die Farbe kommt an');
  return next is(v_r.schlossnummer,     'SCHLOSS-RA-3',   'Die Schlossnummer kommt an');

  -- Die Vorfassung aus 0019 tat beides; beim Umschreiben auf die neue
  -- Signatur ging es zunaechst verloren und fiel erst hier auf. Deshalb
  -- steht es jetzt in einer eigenen Zusicherung und nicht nur nebenbei
  -- in t0019.
  return next isnt(v_r.angeschafft_am, null, 'Das Anschaffungsdatum wird gesetzt');
  return next ok(exists (select 1 from velocity.fahrrad_ereignis
                          where fahrrad_id = v_f and ereignisart = 'angeschafft'),
    'Die Lebenslaufakte beginnt mit der Anschaffung');
  return next ok(exists (select 1 from velocity.fahrrad_position
                          where fahrrad_id = v_f and station_id = v_station),
    'Das Rad steht an der angegebenen Station');

  perform set_config('request.jwt.claims', '', true);
end;
$$;

-- Die Flottensicht muss die neuen Spalten auch herausgeben - sonst
-- stehen sie in der Tabelle und keine Oberflaeche kommt daran.
create or replace function velocity_test.test_ra_flottensicht_zeigt_die_ausstattung()
returns setof text language plpgsql as $$
begin
  return next has_column('velocity'::name, 'v_wawi_flotte'::name, 'farbe'::name,
    'v_wawi_flotte nennt die Farbe');
  return next has_column('velocity'::name, 'v_wawi_flotte'::name, 'rahmenform'::name,
    'v_wawi_flotte nennt die Rahmenform');
  return next has_column('velocity'::name, 'v_wawi_flotte'::name, 'schaltung'::name,
    'v_wawi_flotte nennt die Schaltung');
  return next has_column('velocity'::name, 'v_wawi_flotte'::name, 'bremsen'::name,
    'v_wawi_flotte nennt die Bremsen');
  return next has_column('velocity'::name, 'v_wawi_flotte'::name, 'beleuchtung'::name,
    'v_wawi_flotte nennt die Beleuchtung');
  return next has_column('velocity'::name, 'v_wawi_flotte'::name, 'antrieb'::name,
    'v_wawi_flotte nennt den Antrieb');
  return next has_column('velocity'::name, 'v_wawi_flotte'::name, 'motortyp'::name,
    'v_wawi_flotte nennt den Motortyp');
  return next has_column('velocity'::name, 'v_wawi_flotte'::name, 'schlossnummer'::name,
    'v_wawi_flotte nennt die Schlossnummer');
end;
$$;
