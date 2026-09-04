-- =====================================================================
-- t0021 Wartungsprognose
--
-- Geprueft wird, was die Regel AUSSCHLIESST und wie sie mit dem
-- Ausreisser umgeht - nicht, welche Raeder heute zufaellig oben stehen.
-- Eine Rangfolge aendert sich mit jedem Betriebstag; die Regeln, nach
-- denen sie entsteht, duerfen das nicht.
-- =====================================================================
create schema if not exists velocity_test;
set search_path = velocity_test, velocity, extensions, public;

-- Vorrichtung: ein Rad mit eigenem Typ, dazu ein Kunde fuer die Fahrten.
-- Eigener Typ, damit der Median dieses Typs allein von diesem Rad
-- abhaengt und die Pruefungen nicht am Bestand der echten Flotte haengen.
create or replace function velocity_test.fixture_prognoserad(p_suffix text)
returns table (o_kunde_id bigint, o_fahrrad_id bigint)
language plpgsql as $$
declare v_typ bigint; v_h bigint; v_m bigint;
begin
  insert into velocity.kunde (email, vorname, nachname)
       values ('wp-' || p_suffix || '@example.org', 'Wanda', 'Test')
    returning kunde_id into o_kunde_id;
  insert into velocity.fahrradtyp (typ_code, bezeichnung)
       values ('WP-' || p_suffix, 'Prognosetestrad ' || p_suffix) returning typ_id into v_typ;
  insert into velocity.hersteller (name) values ('Hersteller WP ' || p_suffix)
    returning hersteller_id into v_h;
  insert into velocity.fahrradmodell (hersteller_id, typ_id, modellbezeichnung)
       values (v_h, v_typ, 'MWP-' || p_suffix) returning modell_id into v_m;
  insert into velocity.fahrrad (rahmennummer, modell_id)
       values ('RN-WP-' || p_suffix, v_m) returning fahrrad_id into o_fahrrad_id;
  return next;
end;
$$;

-- Eine abgeschlossene Fahrt von p_minuten Laenge, p_tage_her Tage her.
create or replace function velocity_test.fixture_prognosefahrt(
    p_kunde bigint, p_rad bigint, p_minuten int, p_tage_her int default 1)
returns bigint language plpgsql as $$
declare v_a bigint;
begin
  -- ausleihe_endort_chk: Eine beendete Fahrt braucht einen Endort -
  -- Station oder Koordinaten. Hier Koordinaten, damit die Vorrichtung
  -- nicht von einer bestimmten Station des Bestands abhaengt.
  insert into velocity.ausleihe (kunde_id, fahrrad_id, start_latitude, start_longitude,
                                 startzeit, endzeit, status, end_latitude, end_longitude)
       values (p_kunde, p_rad, 49.790000, 9.930000,
               now() - make_interval(days => p_tage_her),
               now() - make_interval(days => p_tage_her) + make_interval(mins => p_minuten),
               'abgeschlossen', 49.795000, 9.935000)
    returning ausleihe_id into v_a;
  return v_a;
end;
$$;

create or replace function velocity_test.test_wp_struktur()
returns setof text language plpgsql as $$
begin
  return next has_table('velocity'::name, 'wartungsprognose'::name,
                        'Tabelle wartungsprognose existiert');
  return next has_view('velocity'::name, 'v_wawi_wartungsprognose'::name,
                       'Sicht v_wawi_wartungsprognose existiert');
  return next has_function('velocity'::name, 'fn_wartungsprognose'::name,
                           'Die Regel steht als Funktion da');
  return next has_function('velocity'::name, 'api_wartungsprognose_erzeugen'::name,
                           'Das Einfrieren hat eine api_-Funktion');
  -- typ_median_minuten wird MITGESPEICHERT und nicht nur gerechnet:
  -- ohne den Nenner laesst sich die Quote spaeter nicht nachrechnen,
  -- weil der Median des Typs sich mit jedem Betriebstag verschiebt.
  return next has_column('velocity'::name, 'wartungsprognose'::name,
                         'typ_median_minuten'::name,
                         'Der Nenner der Quote ist mitgespeichert');
end;
$$;

create or replace function velocity_test.test_wp_basistabelle_bleibt_gesperrt()
returns setof text language plpgsql as $$
begin
  -- Dieselbe Regel wie fuer jede andere Basistabelle: die Oberflaeche
  -- spricht die Sicht an, nicht den Tisch darunter.
  return next ok(not has_table_privilege('anon', 'velocity.wartungsprognose', 'select'),
                 'anon liest die Basistabelle nicht');
  return next ok(not has_table_privilege('authenticated', 'velocity.wartungsprognose', 'select'),
                 'authenticated liest die Basistabelle nicht');
end;
$$;

create or replace function velocity_test.test_wp_deckel_greift()
returns setof text language plpgsql as $$
declare v_f record; v_minuten numeric;
begin
  select * into v_f from velocity_test.fixture_prognoserad('deckel');
  -- Eine Fahrt ueber 5.000 Minuten - der Fall EB-00447 aus dem
  -- Kopfkommentar von 0021: 90 Stunden aus einer nicht beendeten
  -- Ausleihe, die die ganze Liste kippte.
  perform velocity_test.fixture_prognosefahrt(v_f.o_kunde_id, v_f.o_fahrrad_id, 5000);

  select p.fahrminuten_seit_reparatur into v_minuten
    from velocity.fn_wartungsprognose(current_date, 500) p
   where p.fahrrad_id = v_f.o_fahrrad_id;

  return next is(v_minuten, 300.0::numeric,
                 'Eine Fahrt ueber 5.000 Minuten zaehlt mit 300, nicht mit 5.000');
end;
$$;

create or replace function velocity_test.test_wp_offener_schaden_fliegt_raus()
returns setof text language plpgsql as $$
declare v_f record; v_drin boolean;
begin
  select * into v_f from velocity_test.fixture_prognoserad('offen');
  perform velocity_test.fixture_prognosefahrt(v_f.o_kunde_id, v_f.o_fahrrad_id, 60);

  select exists (select 1 from velocity.fn_wartungsprognose(current_date, 500) p
                  where p.fahrrad_id = v_f.o_fahrrad_id) into v_drin;
  return next ok(v_drin, 'Ohne offenen Schaden steht das Rad auf der Liste');

  -- Eine Meldung OHNE erledigten Auftrag: das Rad muss ohnehin in die
  -- Werkstatt und verbraucht keinen Vorsorgeplatz.
  insert into velocity.schadensmeldung (fahrrad_id, melder_kunde_id, kategorie,
                                        beschreibung, schwere)
       values (v_f.o_fahrrad_id, v_f.o_kunde_id, 'bremse', 'Test', 'mittel');

  select exists (select 1 from velocity.fn_wartungsprognose(current_date, 500) p
                  where p.fahrrad_id = v_f.o_fahrrad_id) into v_drin;
  return next ok(not v_drin, 'Mit offenem Schaden faellt das Rad von der Liste');
end;
$$;

create or replace function velocity_test.test_wp_ausgemustert_fliegt_raus()
returns setof text language plpgsql as $$
declare v_f record; v_drin boolean;
begin
  select * into v_f from velocity_test.fixture_prognoserad('ausgemustert');
  perform velocity_test.fixture_prognosefahrt(v_f.o_kunde_id, v_f.o_fahrrad_id, 60);

  update velocity.fahrrad set status = 'ausgemustert', ausgemustert_am = current_date - 1
   where fahrrad_id = v_f.o_fahrrad_id;

  select exists (select 1 from velocity.fn_wartungsprognose(current_date, 500) p
                  where p.fahrrad_id = v_f.o_fahrrad_id) into v_drin;
  return next ok(not v_drin, 'Ein ausgemustertes Rad steht nicht auf der Prüfliste');
end;
$$;

create or replace function velocity_test.test_wp_raenge_sind_lueckenlos()
returns setof text language plpgsql as $$
declare v_min int; v_max int; v_anzahl bigint;
begin
  select min(rang), max(rang), count(*) into v_min, v_max, v_anzahl
    from velocity.fn_wartungsprognose(current_date, 25);
  return next is(v_min, 1, 'Der erste Platz ist 1');
  return next is(v_max::bigint, v_anzahl, 'Der letzte Platz ist die Zeilenzahl');
  return next is(count(distinct rang)::bigint, v_anzahl,
                 'Kein Platz ist doppelt vergeben')
    from velocity.fn_wartungsprognose(current_date, 25);
end;
$$;

create or replace function velocity_test.test_wp_quote_faellt_monoton()
returns setof text language plpgsql as $$
declare v_verstoesse bigint;
begin
  -- Der Platz muss der Quote folgen. Faellt das auseinander, sortiert
  -- die Liste nach etwas anderem als dem, was sie ausweist - genau der
  -- Fehler, den die Selbstpruefung in Notebook 2 abfaengt.
  select count(*) into v_verstoesse
    from (select nutzungsquote,
                 lag(nutzungsquote) over (order by rang) as davor
            from velocity.fn_wartungsprognose(current_date, 60)) x
   where davor is not null and nutzungsquote > davor;
  return next is(v_verstoesse, 0::bigint,
                 'Die Nutzungsquote faellt ueber die Plaetze monoton');
end;
$$;

create or replace function velocity_test.test_wp_liste_wird_nicht_verdoppelt()
returns setof text language plpgsql as $$
declare v_rad bigint; v_tag date := date '2099-01-01';
begin
  select fahrrad_id into v_rad from velocity.fahrrad limit 1;
  insert into velocity.wartungsprognose (
      stichtag, fahrrad_id, rang, nutzungsquote, fahrminuten_seit_reparatur,
      typ_median_minuten, fahrten_seit_reparatur, fahrminuten_180,
      regelversion, gilt_bis)
    values (v_tag, v_rad, 1, 1.0, 100, 100, 5, 50, 'test', v_tag + 90);

  return next throws_ok(
    format($q$ insert into velocity.wartungsprognose (
                 stichtag, fahrrad_id, rang, nutzungsquote,
                 fahrminuten_seit_reparatur, typ_median_minuten,
                 fahrten_seit_reparatur, fahrminuten_180, regelversion, gilt_bis)
               values (%L, %s, 2, 1.0, 100, 100, 5, 50, 'test', %L) $q$,
           v_tag, v_rad, v_tag + 90),
    '23505', null,
    'Dasselbe Rad steht je Stichtag nur einmal auf der Liste');
end;
$$;

create or replace function velocity_test.test_wp_gilt_bis_liegt_hinter_dem_stichtag()
returns setof text language plpgsql as $$
declare v_rad bigint;
begin
  select fahrrad_id into v_rad from velocity.fahrrad limit 1;
  -- Ein Vorhersagefenster, das vor seinem Stichtag endet, waere keine
  -- Vorhersage. Der Check faengt das ab, statt es der Auswertung in
  -- 90 Tagen zu ueberlassen.
  return next throws_ok(
    format($q$ insert into velocity.wartungsprognose (
                 stichtag, fahrrad_id, rang, nutzungsquote,
                 fahrminuten_seit_reparatur, typ_median_minuten,
                 fahrten_seit_reparatur, fahrminuten_180, regelversion, gilt_bis)
               values (date '2099-02-01', %s, 1, 1.0, 100, 100, 5, 50, 'test',
                       date '2099-01-01') $q$, v_rad),
    '23514', null,
    'gilt_bis muss hinter dem Stichtag liegen');
end;
$$;

create or replace function velocity_test.test_wp_api_verlangt_eine_rolle()
returns setof text language plpgsql as $$
begin
  -- Ohne angemeldeten Menschen liefert hat_rolle() false - die Funktion
  -- muss das als Absage behandeln und nicht als "keine Einschraenkung".
  return next throws_ok(
    $q$ select velocity.api_wartungsprognose_erzeugen(date '2099-03-01', 10) $q$,
    '42501', null,
    'Ohne Rolle Werkstatt oder Leitung wird keine Liste erzeugt');
end;
$$;
