-- =====================================================================
-- t0014 Bereich J: Personal
-- =====================================================================
create schema if not exists velocity_test;
set search_path = velocity_test, velocity, extensions, public;

create or replace function velocity_test.test_j_struktur()
returns setof text language plpgsql as $$
begin
  return next has_table('velocity'::name, 'rolle'::name,             'Tabelle rolle existiert');
  return next has_table('velocity'::name, 'mitarbeiter'::name,       'Tabelle mitarbeiter existiert');
  return next has_table('velocity'::name, 'mitarbeiter_rolle'::name, 'Tabelle mitarbeiter_rolle existiert');
  -- Die Zuordnung ist m:n. Eine Spalte rolle_id an mitarbeiter waere
  -- die 1:n-Variante aus dem alten ERD und wuerde Mehrfachrollen
  -- ueber Sammelrollen erzwingen - siehe Spec Abschnitt 1.
  return next hasnt_column('velocity'::name, 'mitarbeiter'::name, 'rolle_id'::name,
                           'mitarbeiter traegt keine einzelne rolle_id');
  return next col_is_pk('velocity'::name, 'mitarbeiter_rolle'::name,
                        array['mitarbeiter_id','rolle_id'],
                        'mitarbeiter_rolle hat einen zusammengesetzten Schluessel');
end;
$$;

create or replace function velocity_test.test_j_vier_rollen_stehen_bereit()
returns setof text language plpgsql as $$
begin
  -- "where code <> 'demo'" seit 0020_demo_zugang.sql: eine fuenfte Rolle
  -- kam dazu, ausdruecklich KEINE Fachrolle (kein Aufgabenzuschnitt, nur
  -- ein Lese-Zugang fuer Vorfuehrungen) - deshalb bleibt die Aussage
  -- dieses Tests unveraendert "genau die VIER fachlichen Rollen", statt
  -- fuenf zu erwarten. Existenz und Sonderstellung von 'demo' prueft
  -- t0020_demo_zugang.sql.
  return next results_eq(
    $q$ select code from velocity.rolle where code <> 'demo' order by code $q$,
    $q$ values ('disposition'),('kundenservice'),('leitung'),('werkstatt') $q$,
    'Genau die vier fachlichen Rollen sind angelegt (demo ausgenommen, siehe 0020_demo_zugang.sql)');
end;
$$;

create or replace function velocity_test.test_j_auth_uid_darf_fehlen()
returns setof text language plpgsql as $$
declare v_id bigint;
begin
  -- Ein Mitarbeiter wird angelegt, bevor er sich das erste Mal anmeldet.
  insert into velocity.mitarbeiter (personalnummer, vorname, nachname, email)
       values ('J-TEST-1', 'Jana', 'Test', 'j-test-1@example.org')
    returning mitarbeiter_id into v_id;
  return next ok(v_id is not null, 'Mitarbeiter ohne auth_uid ist anlegbar');
end;
$$;

create or replace function velocity_test.test_j_ausgeschieden_braucht_datum()
returns setof text language plpgsql as $$
begin
  insert into velocity.mitarbeiter (personalnummer, vorname, nachname, email)
       values ('J-TEST-2', 'Jens', 'Test', 'j-test-2@example.org');
  -- GR16 haengt daran, dass 'aktiv' etwas bedeutet. Ein Ausgeschiedener
  -- ohne Austrittsdatum waere ein Satz, dem man nicht ansieht, ab wann
  -- er nicht mehr gilt.
  return next throws_ok(
    $q$ update velocity.mitarbeiter set status = 'ausgeschieden'
         where personalnummer = 'J-TEST-2' $q$,
    '23514',
    null,
    'Status ausgeschieden ohne ausgetreten_am wird abgewiesen');
end;
$$;
