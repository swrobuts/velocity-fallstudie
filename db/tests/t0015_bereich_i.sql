-- =====================================================================
-- t0015 Bereich I: Instandhaltung
-- =====================================================================
create schema if not exists velocity_test;
set search_path = velocity_test, velocity, extensions, public;

-- Vorrichtung: ein Rad, an dem sich Schaeden melden lassen.
create or replace function velocity_test.fixture_wartungsrad(p_suffix text)
returns bigint language plpgsql as $$
declare v_typ bigint; v_h bigint; v_m bigint; v_f bigint;
begin
  insert into velocity.fahrradtyp (typ_code, bezeichnung)
       values ('I-' || p_suffix, 'Wartungstestrad ' || p_suffix) returning typ_id into v_typ;
  insert into velocity.hersteller (name) values ('Hersteller I ' || p_suffix)
    returning hersteller_id into v_h;
  insert into velocity.fahrradmodell (hersteller_id, typ_id, modellbezeichnung)
       values (v_h, v_typ, 'MI-' || p_suffix) returning modell_id into v_m;
  insert into velocity.fahrrad (rahmennummer, modell_id)
       values ('RN-I-' || p_suffix, v_m) returning fahrrad_id into v_f;
  return v_f;
end;
$$;

create or replace function velocity_test.test_i_struktur()
returns setof text language plpgsql as $$
begin
  return next has_table('velocity'::name, 'schadensmeldung'::name,  'Tabelle schadensmeldung existiert');
  return next has_table('velocity'::name, 'wartungsauftrag'::name,  'Tabelle wartungsauftrag existiert');
  return next has_table('velocity'::name, 'fahrrad_ereignis'::name, 'Tabelle fahrrad_ereignis existiert');
  -- wartungsposition braucht Artikel aus Bereich G. Ohne Lager waere
  -- sie eine Tabelle, die auf nichts zeigt - Spec Abschnitt 1.
  return next hasnt_table('velocity'::name, 'wartungsposition'::name,
                          'wartungsposition ist bewusst nicht gebaut');
end;
$$;

create or replace function velocity_test.test_i_genau_ein_melder()
returns setof text language plpgsql as $$
declare v_f bigint; v_k bigint;
begin
  v_f := velocity_test.fixture_wartungsrad('melder');
  insert into velocity.kunde (email, vorname, nachname)
       values ('i-melder@example.org', 'Ida', 'Test') returning kunde_id into v_k;

  return next lives_ok(
    format($q$ insert into velocity.schadensmeldung
                 (fahrrad_id, melder_kunde_id, kategorie, beschreibung, schwere)
               values (%s, %s, 'Bremse', 'Bremse greift nicht', 'fahruntauglich') $q$, v_f, v_k),
    'Meldung mit genau einem Melder wird angenommen');

  return next throws_ok(
    format($q$ insert into velocity.schadensmeldung
                 (fahrrad_id, kategorie, beschreibung, schwere)
               values (%s, 'Licht', 'Ohne Melder', 'gering') $q$, v_f),
    '23514', null,
    'Meldung ohne Melder wird abgewiesen');

  return next throws_ok(
    format($q$ insert into velocity.schadensmeldung
                 (fahrrad_id, melder_kunde_id, melder_mitarbeiter_id, kategorie, beschreibung, schwere)
               values (%s, %s, 1, 'Licht', 'Zwei Melder', 'gering') $q$, v_f, v_k),
    '23514', null,
    'Meldung mit zwei Meldern wird abgewiesen');
end;
$$;

create or replace function velocity_test.test_i_statuswechsel_wird_protokolliert()
returns setof text language plpgsql as $$
declare v_f bigint; v_n integer;
begin
  v_f := velocity_test.fixture_wartungsrad('ereignis');
  -- GR21: jede Statusaenderung eines Rades erzeugt ein Ereignis.
  update velocity.fahrrad set status = 'wartung' where fahrrad_id = v_f;
  select count(*) into v_n from velocity.fahrrad_ereignis
   where fahrrad_id = v_f and ereignisart = 'status_geaendert';
  return next is(v_n, 1, 'Statuswechsel erzeugt genau ein Ereignis');

  -- Ein UPDATE ohne Statuswechsel darf nichts erzeugen, sonst waere die
  -- Lebenslaufakte nach kurzer Zeit unlesbar.
  update velocity.fahrrad set rahmennummer = rahmennummer || 'x' where fahrrad_id = v_f;
  select count(*) into v_n from velocity.fahrrad_ereignis where fahrrad_id = v_f;
  return next is(v_n, 1, 'Aenderung ohne Statuswechsel erzeugt kein Ereignis');
end;
$$;

create or replace function velocity_test.test_i_auftragsnummer_ist_eindeutig()
returns setof text language plpgsql as $$
declare v_f bigint;
begin
  v_f := velocity_test.fixture_wartungsrad('nummer');
  insert into velocity.wartungsauftrag (auftragsnummer, fahrrad_id)
       values ('WA-TEST-1', v_f);
  return next throws_ok(
    format($q$ insert into velocity.wartungsauftrag (auftragsnummer, fahrrad_id)
               values ('WA-TEST-1', %s) $q$, v_f),
    '23505', null,
    'Doppelte Auftragsnummer wird abgewiesen');
end;
$$;
