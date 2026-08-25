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

-- test_s_api_rechte oben nennt einzelne Funktionen beim Namen - genau
-- deshalb ist fn_ausleihe_abrechnen bei ihrer Einfuehrung durchgerutscht,
-- bis eine externe Pruefung es aufgedeckt hat. Eine namentliche Liste
-- vergisst man; ein Sweep ueber alle Funktionen des Schemas nicht.
--
-- Warum das ueberhaupt eine eigene Pruefung braucht: die Anweisung
-- "alter default privileges in schema velocity revoke execute on
-- functions from public" - die genau das kuenftig automatisch haette
-- sichern sollen - legt in dieser Datenbank nachweislich keinen Eintrag
-- in pg_default_acl an (siehe Kommentar in db/aufbau/0011_sicherheit.sql).
-- Jede neu angelegte Funktion entsteht also mit proacl = null, was PUBLIC
-- (und damit anon und authenticated, die PUBLIC immer erben) automatisch
-- EXECUTE gibt, bis das "revoke all on all functions ..." weiter oben in
-- dieser Datei erneut laeuft. Dieser Sweep ist das Sicherheitsnetz fuer
-- genau dieses Vergessen.
--
-- has_function_privilege auf die Rollennamen selbst geprueft, nicht nur
-- pg_proc.proacl gelesen: has_function_privilege rechnet die Vererbung
-- ueber PUBLIC automatisch ein, ein blosser Blick auf proacl (das bei
-- implizitem PUBLIC-Zugriff oft schlicht null ist) wuerde die Luecke
-- gerade nicht zeigen - das war ja genau der Fehler, der uebersehen
-- wurde.
-- Namentliche Ausnahmeliste, absichtlich nur diese zwei Namen und nicht
-- ein Muster wie "ist\_%" oder "hat\_%": ein Muster wuerde jede kuenftige
-- Funktion mit passendem Praefix unbeobachtet durchwinken. Diese Liste
-- muss fuer jede neue Ausnahme von Hand erweitert werden, sonst schlaegt
-- der Sweep an - das ist gewollt.
--
-- ist_mitarbeiter() und hat_rolle(text) (0017): eine Sicht traegt NICHT
-- die Ausfuehrungsrechte ihres Eigentuemers - nachgemessen, ein
-- "select * from v_wawi_flotte" als authenticated scheitert ohne diesen
-- Grant mit "permission denied for function hat_rolle", und zwar bei
-- jeder einzelnen v_wawi_*-Sicht. Unbedenklich sind beide nicht, weil sie
-- harmlos waeren, sondern wegen ihres Zuschnitts: beide sind security
-- definer und filtern ausschliesslich ueber auth.uid(). Ein Aufrufer
-- erfaehrt durch sie nur etwas ueber SICH SELBST - ob er Mitarbeiter ist
-- und welche Rollen er traegt. Ueber andere Personen geben sie nichts
-- preis, und sie taugen auch nicht als Orakel: hat_rolle('gibtsnicht')
-- liefert fuer einen Kunden dieselbe Antwort wie hat_rolle('leitung'),
-- naemlich false. mitarbeiter_id_aus_auth() steht bewusst NICHT auf
-- dieser Liste: sie wird nur aus den beiden anderen heraus aufgerufen,
-- und dort greifen die Rechte des Eigentuemers (security definer).
--
-- fn_luftlinie_km (0018/0019, W1): eine Sicht traegt NICHT die
-- Ausfuehrungsrechte ihres Eigentuemers - nachgemessen, "select * from
-- v_wawi_km_co2" als authenticated scheitert ohne diesen Grant mit
-- "permission denied for function fn_luftlinie_km". Unbedenklich, weil
-- sie eine Formel aus vier numeric-Parametern berechnet und keine
-- Tabelle liest - kein Aufrufer erfaehrt durch sie etwas ueber irgendeine
-- Person.
create or replace function velocity_test.test_s_keine_oeffentliche_funktion()
returns setof text language plpgsql as $$
declare
  v_offen_intern text;
  v_offen_api    text;
begin
  select string_agg(p.proname, ', ' order by p.proname) into v_offen_intern
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'velocity'
     and p.proname not like 'api\_%'
     and p.proname not in ('ist_mitarbeiter', 'hat_rolle', 'fn_luftlinie_km')
     and (has_function_privilege('anon',          p.oid, 'execute')
       or has_function_privilege('authenticated', p.oid, 'execute'));

  return next is(v_offen_intern, null,
    coalesce('Keine interne Funktion ist fuer anon/authenticated ausfuehrbar (offen: '
             || v_offen_intern || ')',
             'Keine interne Funktion (alles ausser api_* und der Ausnahmeliste) ist fuer anon oder authenticated ausfuehrbar'));

  -- Gesamtpruefung Punkt 7: der Sweep oben schliesst api\_% VOLLSTAENDIG
  -- aus - er haette also nie bemerkt, wenn eine api_-Funktion fuer anon
  -- ausfuehrbar wuerde. Genau api_-Funktionen sind die einzigen, die vom
  -- Browser aus erreichbar sind (anon ist der oeffentliche Schluessel
  -- ohne Anmeldung); authenticated soll sie ausfuehren duerfen, anon
  -- nicht. Die zweite Haelfte prueft jetzt genau das. Gegenprobe
  -- durchgefuehrt: mit einem testweisen "grant execute ... to anon" auf
  -- eine api_-Funktion wurde dieser Sweep rot, danach zurueckgenommen.
  select string_agg(p.proname, ', ' order by p.proname) into v_offen_api
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'velocity'
     and p.proname like 'api\_%'
     and has_function_privilege('anon', p.oid, 'execute');

  return next is(v_offen_api, null,
    coalesce('api_-Funktion fuer anon ausfuehrbar (offen: ' || v_offen_api || ')',
             'Keine api_-Funktion ist fuer anon ausfuehrbar'));
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
   db/betrieb/altsystem_abloesen.sql - verschoben aus db/aufbau/0013_,
   weil sie rein instanzspezifisch ist und gegen eine leere Datenbank
   nicht durchlief).

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
