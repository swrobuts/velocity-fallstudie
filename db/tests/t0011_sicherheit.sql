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
  -- fn_ausleihe_abrechnen bepreist eine Fahrt ohne jede Berechtigungs-
  -- pruefung (das uebernimmt die aufrufende fn_ausleihe_beenden bzw. die
  -- api-Schicht). Bliebe sie fuer anon oder authenticated aufrufbar,
  -- koennte jeder mit dem oeffentlichen Schluessel fremde Ausleihen
  -- abrechnen lassen - genau die PUBLIC-Falle, die oben schon einmal
  -- zugeschlagen hat.
  return next ok(
    not has_function_privilege('anon',
      'velocity.fn_ausleihe_abrechnen(bigint)', 'execute'),
    'Die Bepreisung ist fuer anon nicht aufrufbar');
  return next ok(
    not has_function_privilege('authenticated',
      'velocity.fn_ausleihe_abrechnen(bigint)', 'execute'),
    'Die Bepreisung ist auch fuer authenticated nicht direkt aufrufbar');
end;
$$;

/* Ein Trigger auf auth.users, der in ein Fremdschema schreibt, kann jede
   Registrierung zum Scheitern bringen. Genau das ist am 24.08.2026
   passiert: "cityBikesRental".handle_new_user() legte bei jeder
   Anmeldung einen neuen Altkunden an und lief bei bekannten E-Mails in
   den Unique-Index. Die gesamte Auth-Transaktion fiel zurueck, und
   damit war jeder der 1015 Bestandskunden ausgesperrt.

   auth.users gehoert supabase_auth_admin; dieses Projekt darf den
   Trigger nicht entfernen. Die Funktion gehoert postgres und wurde
   deshalb idempotent und fehlertolerant gemacht (siehe
   db/aufbau/0013_altsystem_abloesen.sql).

   Geprueft wird deshalb nicht die Abwesenheit des Triggers, sondern das,
   worauf es ankommt: dass die aufgerufene Funktion die Registrierung
   nicht mehr zu Fall bringen kann. */
create or replace function velocity_test.test_altsystem_blockiert_keine_anmeldung()
returns setof text language plpgsql as $$
declare
  v_quelle text;
  v_ruft   text;
begin
  select pn.nspname || '.' || p.proname, pg_get_functiondef(p.oid)
    into v_ruft, v_quelle
    from pg_trigger t
    join pg_class     c  on c.oid  = t.tgrelid
    join pg_namespace n  on n.oid  = c.relnamespace
    join pg_proc      p  on p.oid  = t.tgfoid
    join pg_namespace pn on pn.oid = p.pronamespace
   where n.nspname = 'auth' and c.relname = 'users'
     and not t.tgisinternal
     and pn.nspname = 'cityBikesRental'
   limit 1;

  if v_ruft is null then
    return next pass('Kein Trigger auf auth.users schreibt ins Altschema');
    return;
  end if;

  -- Der Trigger liegt auf einer Tabelle, die sich mehrere Anwendungen
  -- teilen. Er darf deshalb weder schreiben noch scheitern.
  return next ok(v_quelle not ilike '%insert into%kunde%',
    v_ruft || ' legt bei einer Anmeldung keinen Kunden mehr an');
  return next ok(v_quelle not ilike '%auth_kunde_mapping%',
    v_ruft || ' schreibt auch keine Zuordnung mehr');
end;
$$;
