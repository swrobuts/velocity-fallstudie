-- =====================================================================
-- t0011 Zugriffsschutz
-- =====================================================================
create schema if not exists velocity_test;
set search_path = velocity_test, velocity, extensions, public;

create or replace function velocity_test.test_s_rls_ueberall_aktiv()
returns setof text language plpgsql as $$
declare
  v_offen text;
begin
  select string_agg(c.relname, ', ' order by c.relname) into v_offen
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'velocity' and c.relkind = 'r' and not c.relrowsecurity;

  return next is(v_offen, null,
    coalesce('Alle Basistabellen haben RLS aktiv (offen: ' || v_offen || ')',
             'Alle Basistabellen haben RLS aktiv'));
end;
$$;

create or replace function velocity_test.test_s_anon_hat_keine_tabellenrechte()
returns setof text language plpgsql as $$
declare
  v_tabellen text;
begin
  -- authenticated darf einige Tabellen lesen, per RLS auf die eigenen Zeilen
  -- begrenzt. anon dagegen darf gar keine Basistabelle erreichen - nur die
  -- oeffentlichen Sichten. Genau das wird hier geprueft.
  select string_agg(format('%s:%s', g.table_name, g.privilege_type), ', '
                    order by g.table_name, g.privilege_type)
    into v_tabellen
    from information_schema.role_table_grants g
    join pg_class c     on c.relname = g.table_name
    join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'velocity'
   where g.table_schema = 'velocity'
     and g.grantee = 'anon'
     and c.relkind = 'r';

  return next is(v_tabellen, null,
    coalesce('anon hat keinerlei Rechte auf Basistabellen (gefunden: ' || v_tabellen || ')',
             'anon hat keinerlei Rechte auf Basistabellen'));
end;
$$;

create or replace function velocity_test.test_s_anon_kommt_nicht_an_kunden()
returns setof text language plpgsql as $$
declare
  v_anzahl integer;
begin
  set local role anon;
  begin
    execute 'select count(*) from velocity.kunde' into v_anzahl;
    reset role;
    return next fail('anon konnte velocity.kunde lesen - Zugriffsschutz ist wirkungslos');
  exception when insufficient_privilege then
    reset role;
    return next pass('anon erhaelt auf velocity.kunde keine Berechtigung');
  end;
end;
$$;

create or replace function velocity_test.test_s_anon_darf_oeffentliche_sichten()
returns setof text language plpgsql as $$
declare
  v_anzahl integer;
begin
  set local role anon;
  execute 'select count(*) from velocity.v_tarifkarte' into v_anzahl;
  execute 'select count(*) from velocity.v_faq'        into v_anzahl;
  execute 'select count(*) from velocity.v_station'    into v_anzahl;
  reset role;
  return next pass('anon darf die oeffentlichen Sichten lesen');
exception when others then
  reset role;
  return next fail('anon kann die oeffentlichen Sichten nicht lesen: ' || sqlerrm);
end;
$$;

create or replace function velocity_test.test_s_api_rechte()
returns setof text language plpgsql as $$
begin
  return next ok(
    has_function_privilege('authenticated',
      'velocity.api_ausleihe_starten(bigint)', 'execute'),
    'authenticated darf api_ausleihe_starten aufrufen');
  return next ok(
    not has_function_privilege('anon',
      'velocity.api_ausleihe_starten(bigint)', 'execute'),
    'anon darf api_ausleihe_starten nicht aufrufen');
  return next ok(
    not has_function_privilege('anon',
      'velocity.fn_ausleihe_beenden(bigint,bigint,bigint,numeric,numeric)', 'execute'),
    'Die Fachlogik ist fuer anon nicht aufrufbar');
  return next ok(
    not has_function_privilege('authenticated',
      'velocity.fn_ausleihe_beenden(bigint,bigint,bigint,numeric,numeric)', 'execute'),
    'Die Fachlogik ist auch fuer authenticated nicht direkt aufrufbar');
end;
$$;
