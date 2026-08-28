-- =====================================================================
-- t0020 Demozugang (nur lesend)
--
-- Zwei Zusicherungen traegt der Auftrag woertlich als "der wichtigste
-- Test": der Demozugang kann JEDE Sicht lesen und KEINE EINZIGE
-- api_-Funktion ausfuehren. Beide werden hier vollstaendig geprueft,
-- nicht an einer Stichprobe - siehe test_d_sichten_lesbar_fuer_demo und
-- test_d_keine_api_funktion_fuer_demo. Jede der beiden traegt eine
-- eigene Gegenprobe, die zeigt, dass ein gruener Test tatsaechlich an
-- der Rolle 'demo' haengt und nicht schlicht daran, dass irgendjemand
-- angemeldet ist.
--
-- ZWEITE DEMOZUGANG-RUNDE: test_d_sichten_lesbar_fuer_demo pruefte
-- bisher "13 von 15, zwei begruendete Ausnahmen" (v_wawi_kunde,
-- v_wawi_km_co2) und behauptete fuer genau diese zwei ausdruecklich
-- LEERE Ergebnisse fuer 'demo'. Der Auftraggeber hat v_wawi_kunde
-- freigegeben (die Kundschaft sind Musterdaten), und v_wawi_km_co2
-- wurde von v_wawi_fahrt_km entkoppelt und laesst 'demo' seither auch
-- zu (0018_wawi_sichten.sql). Die Behauptung "leer fuer demo" ist damit
-- fuer beide Sichten in ihr GEGENTEIL verkehrt: die Zusicherung
-- unten prueft jetzt "alle 15, keine Ausnahme mehr", mit derselben
-- Sweep-Bauweise wie zuvor.
-- =====================================================================
create schema if not exists velocity_test;
set search_path = velocity_test, velocity, extensions, public;

-- Jede api_-Funktion des Schemas mit einem gueltigen, rein NULL-
-- wertigen Aufruf - nicht nur die vierzehn der Warenwirtschaft
-- (0019_wawi_logik.sql), auch die vier kundenseitigen aus
-- 0009_geschaeftslogik.sql (api_kunde_sicherstellen,
-- api_profil_aktualisieren, api_ausleihe_starten, api_ausleihe_beenden):
-- der Auftrag verlangt "keine einzige api_*-Funktion", nicht "keine
-- einzige Warenwirtschaftsfunktion". Nachgemessen, welche Fallstricke
-- das hat: 0020_demo_zugang.sql erklaert ausfuehrlich, warum genau diese
-- vier ohne eigene Pruefung ein Scheunentor waeren.
--
-- Dieselbe Bauweise wie test_s_keine_oeffentliche_funktion in
-- t0011_sicherheit.sql: dynamisch ueber pg_proc, nicht elf/vierzehn/
-- achtzehn Funktionsnamen von Hand abgetippt - eine neue api_-Funktion
-- taucht damit automatisch in beiden Sweeps unten auf, ohne dass diese
-- Datei angefasst werden muesste.
--
-- NULL-Argumente sind zulaessig, weil jede der 18 Funktionen ihre
-- Rollenpruefung (fn_rolle_verlangen bzw. den neuen
-- velocity.hat_rolle('demo')-Waechter) nachweislich als ALLERERSTE
-- Anweisung ausfuehrt (nachgemessen per pg_get_functiondef beim Bau
-- dieser Datei) - kein Aufruf kommt an einer Pruefung von p_irgendwas
-- vorbei, bevor die Rolle gepruoft wurde.
create or replace function velocity_test.fixture_alle_api_aufrufe()
returns table(proname text, aufruf text) language sql as $$
  select p.proname,
         format('select velocity.%I(%s)', p.proname,
                coalesce(
                  (select string_agg(format('null::%s', t.typname), ', ' order by o.ord)
                     from unnest(p.proargtypes::oid[]) with ordinality as o(argtype, ord)
                     join pg_type t on t.oid = o.argtype),
                  ''))
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'velocity' and p.proname like 'api\_%'
   order by p.proname;
$$;

-- ---- Sichten: ALLE 15 lesbar, keine Ausnahme mehr ----------------------
-- Zweite Demozugang-Runde: v_wawi_kunde (Auftraggeber-Entscheidung,
-- Musterdaten) und v_wawi_km_co2 (entkoppelt von v_wawi_fahrt_km) lassen
-- 'demo' inzwischen ebenfalls zu (siehe 0018_wawi_sichten.sql). Diese
-- Zusicherung ersetzt die fruehere "13 von 15, zwei Ausnahmen" durch
-- "alle 15" - dieselbe Sweep-Bauweise, keine Ausnahmeliste mehr noetig.
create or replace function velocity_test.test_d_sichten_lesbar_fuer_demo()
returns setof text language plpgsql as $$
declare
  v_sicht     text;
  v_leer      text[] := '{}';
  v_voll_ohne text[] := '{}';
  v_n         bigint;
  v_gezaehlt  integer := 0;
begin
  perform velocity_test.fixture_rollen('demo-lesen', array['demo']);

  -- Dynamisch ueber pg_class statt fuenfzehn Namen von Hand: jede fuer
  -- authenticated lesbare v_wawi_-Sicht, ohne Ausnahme. v_wawi_fahrt_km
  -- taucht hier gar nicht erst auf - ihr Select-Recht ist authenticated
  -- in 0019_wawi_logik.sql weiterhin vollstaendig entzogen
  -- (has_table_privilege liefert fuer sie false, unveraendert seit der
  -- ersten Runde: sie fuehrt kunde_id je Einzelfahrt, ein
  -- Bewegungsprofil, das bleibt unabhaengig von 'demo' gesperrt).
  for v_sicht in
    select c.relname from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'velocity' and c.relkind = 'v'
       and c.relname like 'v\_wawi\_%'
       and has_table_privilege('authenticated', 'velocity.' || c.relname, 'SELECT')
     order by 1
  loop
    v_gezaehlt := v_gezaehlt + 1;
    execute format('select count(*) from velocity.%I', v_sicht) into v_n;
    if v_n = 0 then
      v_leer := array_append(v_leer, v_sicht);
    end if;
  end loop;

  -- Gegen einen Sweep, der ins Leere liefe, weil das Namensmuster eines
  -- Tages auf nichts mehr passt (dieselbe Ueberlegung wie im
  -- Kopfkommentar von db/test.py).
  return next ok(v_gezaehlt >= 15,
    format('Mindestens 15 fuer authenticated lesbare v_wawi-Sichten gefunden (tatsaechlich %s)', v_gezaehlt));

  return next ok(coalesce(array_length(v_leer, 1), 0) = 0,
    'Jede fuer authenticated lesbare v_wawi-Sicht liefert fuer die reine demo-Rolle mindestens eine Zeile'
    || case when array_length(v_leer, 1) > 0
         then ' (leer: ' || array_to_string(v_leer, ', ') || ')' else '' end);

  -- Namentlich statt nur im Sweep: die beiden Sichten, die in der ersten
  -- Runde die begruendeten Ausnahmen waren, tragen jetzt namentlich das
  -- Gegenteil ihrer frueheren Zusicherung (Auftrag, woertlich: "muessen
  -- mit - und in ihr Gegenteil verkehrt werden").
  execute 'select count(*) from velocity.v_wawi_kunde' into v_n;
  return next cmp_ok(v_n, '>', 0::bigint,
    'v_wawi_kunde liefert fuer die reine demo-Rolle Zeilen - Auftraggeber-Entscheidung, die Kundschaft sind Musterdaten, siehe Kommentar dort');

  execute 'select count(*) from velocity.v_wawi_km_co2' into v_n;
  return next cmp_ok(v_n, '>', 0::bigint,
    'v_wawi_km_co2 liefert fuer die reine demo-Rolle Zeilen - entkoppelt von v_wawi_fahrt_km, siehe Kommentar dort');

  perform set_config('request.jwt.claims', '', true);

  -- Gegenprobe: ein Mitarbeiter OHNE jede Rolle sieht in KEINER dieser
  -- Sichten etwas. Ohne diese Gegenprobe koennte der Test oben auch
  -- gruen sein, weil schlicht JEDER angemeldete Mitarbeiter etwas sieht
  -- - und bewiese damit nichts ueber die Rolle 'demo' im Speziellen.
  perform velocity_test.fixture_rollen('demo-gegenprobe', array[]::text[]);
  for v_sicht in
    select c.relname from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'velocity' and c.relkind = 'v'
       and c.relname like 'v\_wawi\_%'
       and has_table_privilege('authenticated', 'velocity.' || c.relname, 'SELECT')
     order by 1
  loop
    execute format('select count(*) from velocity.%I', v_sicht) into v_n;
    if v_n > 0 then
      v_voll_ohne := array_append(v_voll_ohne, v_sicht);
    end if;
  end loop;
  return next ok(coalesce(array_length(v_voll_ohne, 1), 0) = 0,
    'Gegenprobe: ein Mitarbeiter ohne jede Rolle sieht in keiner dieser Sichten etwas'
    || case when array_length(v_voll_ohne, 1) > 0
         then ' (unerwartet gefuellt: ' || array_to_string(v_voll_ohne, ', ') || ')' else '' end);

  perform set_config('request.jwt.claims', '', true);
end;
$$;

-- ---- Schreiben: KEINE der 18 api_-Funktionen fuer die reine demo-Rolle
create or replace function velocity_test.test_d_keine_api_funktion_fuer_demo()
returns setof text language plpgsql as $$
declare
  v_rec      record;
  v_versagt  text[] := '{}';
  v_gezaehlt integer := 0;
begin
  perform velocity_test.fixture_rollen('demo-schreiben', array['demo']);

  for v_rec in select * from velocity_test.fixture_alle_api_aufrufe() loop
    v_gezaehlt := v_gezaehlt + 1;
    begin
      execute v_rec.aufruf;
      v_versagt := array_append(v_versagt, v_rec.proname || ' (kein Fehler)');
    exception
      when sqlstate '42501' then
        null; -- erwartet: Rolle verlangt bzw. Demozugang: nur Lesen
      when others then
        v_versagt := array_append(v_versagt,
          format('%s (%s: %s)', v_rec.proname, sqlstate, sqlerrm));
    end;
  end loop;

  return next ok(v_gezaehlt >= 18,
    format('Mindestens 18 api_-Funktionen gefunden und geprueft (tatsaechlich %s)', v_gezaehlt));

  return next ok(coalesce(array_length(v_versagt, 1), 0) = 0,
    'Jede api_-Funktion des Schemas weist die reine demo-Rolle mit Fehlercode 42501 ab'
    || case when array_length(v_versagt, 1) > 0
         then ' (Ausnahmen: ' || array_to_string(v_versagt, '; ') || ')' else '' end);

  perform set_config('request.jwt.claims', '', true);
end;
$$;

-- ---- Gegenprobe: dieselbe Schranke trifft NUR 'demo' ------------------
-- Ohne diese Gegenprobe koennte der Sweep oben auch dann fuer den
-- falschen Grund gruen sein: wenn die vier neuen Waechter in
-- 0009_geschaeftslogik.sql aus Versehen JEDEN angemeldeten Mitarbeiter
-- blockierten statt nur 'demo', bliebe test_d_keine_api_funktion_fuer_demo
-- unveraendert gruen - er betrachtet ja nur ein demo-Konto. Diese Probe
-- laeuft denselben Sweep fuer ein Konto mit ALLEN VIER Fachrollen und
-- verlangt, dass KEINE der 18 Funktionen mit 42501 antwortet - jede
-- andere Fehlermeldung (etwa "Station nicht gefunden" durch die
-- Null-Argumente oder ein NOT-NULL-Verstoss, weil das Testkonto keinen
-- echten auth.users-Satz hat) ist hier ausdruecklich kein Fehlschlag,
-- nur eine 42501 waere einer.
create or replace function velocity_test.test_d_api_sweep_blockt_nur_demo()
returns setof text language plpgsql as $$
declare
  v_rec       record;
  v_blockiert text[] := '{}';
begin
  perform velocity_test.fixture_rollen(
    'nicht-demo', array['disposition', 'werkstatt', 'kundenservice', 'leitung']);

  for v_rec in select * from velocity_test.fixture_alle_api_aufrufe() loop
    begin
      execute v_rec.aufruf;
    exception
      when sqlstate '42501' then
        v_blockiert := array_append(v_blockiert, v_rec.proname);
      when others then
        null; -- jeder andere Fehler ist hier erwartet und irrelevant
    end;
  end loop;

  return next ok(coalesce(array_length(v_blockiert, 1), 0) = 0,
    'Ein Konto mit allen vier Fachrollen (keine davon ''demo'') wird von keiner api_-Funktion mit 42501 abgewiesen'
    || case when array_length(v_blockiert, 1) > 0
         then ' (faelschlich blockiert: ' || array_to_string(v_blockiert, ', ') || ')' else '' end);

  perform set_config('request.jwt.claims', '', true);
end;
$$;
