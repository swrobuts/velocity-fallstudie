-- =====================================================================
-- t0017 Zugriffsschutz der Warenwirtschaft
-- =====================================================================
create schema if not exists velocity_test;
set search_path = velocity_test, velocity, extensions, public;

create or replace function velocity_test.test_s_ohne_anmeldung_kein_mitarbeiter()
returns setof text language plpgsql as $$
begin
  -- Ohne JWT liefert auth.uid() null. Wer null ist, ist niemand.
  return next ok(not velocity.ist_mitarbeiter(),
                 'Ohne Anmeldung ist niemand Mitarbeiter');
  return next ok(not velocity.hat_rolle('leitung'),
                 'Ohne Anmeldung hat niemand eine Rolle');
end;
$$;

create or replace function velocity_test.test_s_beurlaubt_zaehlt_nicht()
returns setof text language plpgsql as $$
declare v_uid uuid := gen_random_uuid(); v_m bigint;
begin
  insert into velocity.mitarbeiter (personalnummer, auth_uid, vorname, nachname, email, status)
       values ('S-TEST-1', v_uid, 'Sina', 'Test', 's-test-1@example.org', 'beurlaubt')
    returning mitarbeiter_id into v_m;
  perform set_config('request.jwt.claims', json_build_object('sub', v_uid)::text, true);
  -- GR16: nur AKTIVE Mitarbeitende haben Zugriff. Wer beurlaubt ist,
  -- behaelt seinen Satz und verliert den Zugang.
  return next ok(not velocity.ist_mitarbeiter(),
                 'Ein beurlaubter Mitarbeiter gilt nicht als Mitarbeiter');
  update velocity.mitarbeiter set status = 'aktiv' where mitarbeiter_id = v_m;
  return next ok(velocity.ist_mitarbeiter(),
                 'Nach Rueckkehr gilt er wieder');
  perform set_config('request.jwt.claims', '', true);
end;
$$;

create or replace function velocity_test.test_s_rolle_wird_geprueft()
returns setof text language plpgsql as $$
declare v_uid uuid := gen_random_uuid(); v_m bigint;
begin
  insert into velocity.mitarbeiter (personalnummer, auth_uid, vorname, nachname, email)
       values ('S-TEST-2', v_uid, 'Sven', 'Test', 's-test-2@example.org')
    returning mitarbeiter_id into v_m;
  insert into velocity.mitarbeiter_rolle (mitarbeiter_id, rolle_id)
  select v_m, rolle_id from velocity.rolle where code = 'werkstatt';
  perform set_config('request.jwt.claims', json_build_object('sub', v_uid)::text, true);
  return next ok(velocity.hat_rolle('werkstatt'), 'Die zugeteilte Rolle wird erkannt');
  return next ok(not velocity.hat_rolle('kundenservice'),
                 'Eine nicht zugeteilte Rolle wird nicht erkannt');
  perform set_config('request.jwt.claims', '', true);
end;
$$;

create or replace function velocity_test.test_s_zahlungsmittel_bleibt_gesperrt()
returns setof text language plpgsql as $$
declare
  v_abweichung text;
begin
  -- GR17. Nicht ueber das Recht geprueft, sondern ueber die Regel: ein
  -- Entzug fuer authenticated traefe Kunden und Mitarbeitende zugleich,
  -- weil PostgREST beide als dieselbe Rolle anmeldet.
  return next ok(not has_table_privilege('anon', 'velocity.zahlungsmittel', 'SELECT'),
                 'anon darf zahlungsmittel nicht lesen');

  -- Absichtlich grob statt fein: eine fruehere Fassung sah nur Regeln mit
  -- cmd = 'SELECT' an. Eine Regel "for all using (true)" traegt cmd = 'ALL'
  -- und waere komplett unbeobachtet durchgerutscht - nachgemessen, sie
  -- liess Kunde A live die Bezahldaten von Kunde B lesen, waehrend alle
  -- vier Zusicherungen grau-gruen blieben. Deshalb hier keine Bedingung
  -- auf cmd, sondern eine Zusicherung ueber ALLE Regeln der Tabelle: es
  -- gibt genau eine, sie heisst zahlungsmittel_eigene, gilt fuer SELECT
  -- und filtert ueber auth.uid(). Jede zusaetzliche Regel - gleich
  -- welchen cmd-Werts, gleich wie formuliert - laesst diesen Test rot
  -- werden und nennt sie beim Namen. Das ist bei einer Tabelle mit
  -- Bezahldaten die richtige Haerte: wer hier kuenftig eine zweite Regel
  -- braucht, soll ueber einen roten Test stolpern und das bewusst
  -- entscheiden, statt sie beilaeufig hinzuzufuegen.
  select string_agg(
           format('%s (cmd=%s, ueber_auth_uid=%s)', policyname, cmd,
                  qual like '%auth.uid()%'),
           ', ' order by policyname)
    into v_abweichung
    from pg_policies
   where schemaname = 'velocity' and tablename = 'zahlungsmittel'
     and not (policyname = 'zahlungsmittel_eigene' and cmd = 'SELECT'
              and qual like '%auth.uid()%');

  if v_abweichung is null and not exists (
       select 1 from pg_policies
        where schemaname = 'velocity' and tablename = 'zahlungsmittel'
          and policyname = 'zahlungsmittel_eigene')
  then
    v_abweichung := 'zahlungsmittel_eigene fehlt';
  end if;

  return next is(v_abweichung, null,
    coalesce('Regel(n) auf zahlungsmittel weichen ab: ' || v_abweichung,
             'Auf zahlungsmittel gibt es ausschliesslich zahlungsmittel_eigene, fuer SELECT ueber auth.uid()'));

  return next is_empty(
    $q$ select c.relname from pg_class c
          join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'velocity' and c.relkind = 'v'
           and c.relname like 'v_wawi%'
           and pg_get_viewdef(c.oid) ilike '%zahlungsmittel%' $q$,
    'Keine v_wawi-Sicht greift auf zahlungsmittel zu');
end;
$$;

create or replace function velocity_test.test_s_rls_ist_scharf()
returns setof text language plpgsql as $$
begin
  return next results_eq(
    $q$ select c.relname::text from pg_class c
          join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'velocity' and c.relkind = 'r'
           and c.relname in ('rolle','mitarbeiter','mitarbeiter_rolle','schadensmeldung',
                             'wartungsauftrag','fahrrad_ereignis','aenderungsprotokoll',
                             'rechenannahme')
           and not c.relrowsecurity
        order by 1 $q$,
    $q$ select null::text where false $q$,
    'Auf allen neuen Tabellen ist Row Level Security eingeschaltet');
end;
$$;
