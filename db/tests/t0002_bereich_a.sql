-- =====================================================================
-- t0002 Bereich A: Geschaeftspartner
-- =====================================================================
create schema if not exists velocity_test;
set search_path = velocity_test, velocity, extensions, public;

create or replace function velocity_test.test_a_struktur()
returns setof text language plpgsql as $$
begin
  return next has_table('velocity'::name, 'adresse'::name, 'Tabelle adresse existiert');
  return next has_table('velocity'::name, 'kunde'::name,   'Tabelle kunde existiert');
  return next col_is_pk('velocity'::name, 'adresse'::name, 'adresse_id'::name,
                        'adresse hat den Surrogatschluessel adresse_id');
  return next col_is_pk('velocity'::name, 'kunde'::name, 'kunde_id'::name,
                        'kunde hat den Surrogatschluessel kunde_id');
  return next hasnt_column('velocity'::name, 'kunde'::name, 'passwort_hash'::name,
                           'kunde speichert kein Passwort (Auth liegt bei Supabase)');
  return next fk_ok('velocity'::name, 'kunde'::name, 'rechnungsadresse_id'::name,
                    'velocity'::name, 'adresse'::name, 'adresse_id'::name,
                    'kunde verweist auf adresse');
  return next col_type_is('velocity'::name, 'kunde'::name, 'registriert_am'::name,
                          'timestamp with time zone', 'Zeitstempel sind zeitzonenbehaftet');
end;
$$;

create or replace function velocity_test.test_a_fachschluessel()
returns setof text language plpgsql as $$
declare
  v_id bigint;
begin
  insert into velocity.kunde (email, vorname, nachname)
       values ('anna@example.org', 'Anna', 'Beispiel')
    returning kunde_id into v_id;

  return next matches((select kundennummer from velocity.kunde where kunde_id = v_id),
                      '^K-[0-9]{6}$', 'Kundennummer wird im Format K-000000 vergeben');

  return next throws_ok(
    $sql$insert into velocity.kunde (email, vorname, nachname)
         values ('anna@example.org', 'Zweite', 'Anna')$sql$,
    '23505', null, 'E-Mail ist eindeutig');

  return next throws_ok(
    $sql$insert into velocity.kunde (email, vorname, nachname)
         values ('keine-mail', 'Ohne', 'Klammeraffe')$sql$,
    '23514', null, 'Unplausible E-Mail wird abgewiesen');
end;
$$;

create or replace function velocity_test.test_a_adresse_dedupliziert()
returns setof text language plpgsql as $$
begin
  insert into velocity.adresse (strasse, hausnummer, plz, ort)
       values ('Sanderring', '2', '97070', 'Wuerzburg');

  return next throws_ok(
    $sql$insert into velocity.adresse (strasse, hausnummer, plz, ort)
         values ('Sanderring', '2', '97070', 'Wuerzburg')$sql$,
    '23505', null, 'Gleiche Adresse kann nicht zweimal angelegt werden');

  -- Ohne NOT NULL auf hausnummer waere diese Zusicherung nicht haltbar:
  -- in einem UNIQUE-Index gelten zwei NULL-Werte als verschieden.
  return next col_not_null('velocity'::name, 'adresse'::name, 'hausnummer'::name,
                           'hausnummer ist NOT NULL, damit der Fachschluessel greift');

  return next throws_ok(
    $sql$insert into velocity.adresse (strasse, hausnummer, plz, ort)
         values ('Testweg', '1', '9707', 'Wuerzburg')$sql$,
    '23514', null, 'Deutsche PLZ muss fuenfstellig sein');
end;
$$;
