-- =====================================================================
-- t0018 Sichten der Warenwirtschaft
-- =====================================================================
create schema if not exists velocity_test;
set search_path = velocity_test, velocity, extensions, public;

-- Vorrichtung: ein angemeldeter Mitarbeiter mit allen Rollen.
create or replace function velocity_test.fixture_mitarbeiter(p_suffix text)
returns uuid language plpgsql as $$
declare v_uid uuid := gen_random_uuid(); v_m bigint;
begin
  insert into velocity.mitarbeiter (personalnummer, auth_uid, vorname, nachname, email)
       values ('T-' || p_suffix, v_uid, 'Tom', 'Test', 't-' || p_suffix || '@example.org')
    returning mitarbeiter_id into v_m;
  insert into velocity.mitarbeiter_rolle (mitarbeiter_id, rolle_id)
  select v_m, rolle_id from velocity.rolle;
  perform set_config('request.jwt.claims', json_build_object('sub', v_uid)::text, true);
  return v_uid;
end;
$$;

-- Vorrichtung fuer die Negativpruefung: ein Mitarbeiter mit GENAU EINER
-- Rolle. fixture_mitarbeiter allein kann nicht zeigen, dass eine Rolle
-- eine Sicht zu Recht NICHT sieht - mit allen Rollen gleichzeitig sieht
-- er ohnehin alles. Erst eine einzelne, gezielt zugeteilte Rolle macht
-- den Ausschluss pruefbar.
create or replace function velocity_test.fixture_mitarbeiter_mit_rolle(p_suffix text, p_rolle text)
returns uuid language plpgsql as $$
declare v_uid uuid := gen_random_uuid(); v_m bigint;
begin
  insert into velocity.mitarbeiter (personalnummer, auth_uid, vorname, nachname, email)
       values ('T-' || p_suffix, v_uid, 'Tom', 'Test', 't-' || p_suffix || '@example.org')
    returning mitarbeiter_id into v_m;
  insert into velocity.mitarbeiter_rolle (mitarbeiter_id, rolle_id)
  select v_m, rolle_id from velocity.rolle where code = p_rolle;
  perform set_config('request.jwt.claims', json_build_object('sub', v_uid)::text, true);
  return v_uid;
end;
$$;

-- Vorrichtung: je eine Zeile Schadensmeldung/Wartungsauftrag. Beide
-- Tabellen sind in dieser Datenbank noch leer (keine Referenzdaten fuer
-- die Instandhaltung) - ein is_empty()- oder "liefert Zeilen"-Test ohne
-- eigene Zeile waere unabhaengig vom Rollenfilter immer wahr bzw. immer
-- falsch und pruefte damit gar nichts. runtests() rollt die
-- Testtransaktion nach jeder Funktion zurueck, es bleibt keine Spur.
create or replace function velocity_test.fixture_schaden_und_auftrag()
returns void language plpgsql as $$
declare v_fahrrad_id bigint; v_kunde_id bigint; v_schaden_id bigint;
begin
  select fahrrad_id into v_fahrrad_id from velocity.fahrrad limit 1;
  select kunde_id   into v_kunde_id   from velocity.kunde   limit 1;
  insert into velocity.schadensmeldung
         (fahrrad_id, melder_kunde_id, kategorie, beschreibung, schwere)
  values (v_fahrrad_id, v_kunde_id, 'Test', 'Testmeldung fuer die Rollenpruefung', 'gering')
    returning schadensmeldung_id into v_schaden_id;
  insert into velocity.wartungsauftrag (auftragsnummer, fahrrad_id, schadensmeldung_id)
  values ('WA-TEST-' || v_schaden_id, v_fahrrad_id, v_schaden_id);
end;
$$;

create or replace function velocity_test.test_v_sichten_existieren()
returns setof text language plpgsql as $$
begin
  return next has_view('velocity'::name, 'v_wawi_flotte'::name,  'v_wawi_flotte existiert');
  return next has_view('velocity'::name, 'v_wawi_kunde'::name,   'v_wawi_kunde existiert');
  return next has_view('velocity'::name, 'v_wawi_station'::name, 'v_wawi_station existiert');
  return next has_view('velocity'::name, 'v_wawi_schaden'::name, 'v_wawi_schaden existiert');
  return next has_view('velocity'::name, 'v_wawi_auftrag'::name, 'v_wawi_auftrag existiert');
end;
$$;

create or replace function velocity_test.test_v_ohne_rolle_keine_zeile()
returns setof text language plpgsql as $$
begin
  -- schadensmeldung/wartungsauftrag sind sonst leer - siehe Kommentar an
  -- fixture_schaden_und_auftrag.
  perform velocity_test.fixture_schaden_und_auftrag();
  perform set_config('request.jwt.claims', '', true);
  -- Das ist die eigentliche Sperre: PostgREST meldet Kunden und
  -- Mitarbeitende als dieselbe Datenbankrolle an. Wenn eine Sicht nicht
  -- selbst filtert, liest jeder Kunde die Stammdaten aller anderen. Alle
  -- fuenf Arbeitssichten muessen das zeigen, nicht nur zwei von fuenf -
  -- genau die Luecke, die der Rest dieser Testdatei bisher offen liess.
  return next is_empty($q$ select 1 from velocity.v_wawi_kunde $q$,
                       'Ohne Anmeldung liefert v_wawi_kunde nichts');
  return next is_empty($q$ select 1 from velocity.v_wawi_flotte $q$,
                       'Ohne Anmeldung liefert v_wawi_flotte nichts');
  return next is_empty($q$ select 1 from velocity.v_wawi_station $q$,
                       'Ohne Anmeldung liefert v_wawi_station nichts');
  return next is_empty($q$ select 1 from velocity.v_wawi_schaden $q$,
                       'Ohne Anmeldung liefert v_wawi_schaden nichts');
  return next is_empty($q$ select 1 from velocity.v_wawi_auftrag $q$,
                       'Ohne Anmeldung liefert v_wawi_auftrag nichts');
end;
$$;

create or replace function velocity_test.test_v_mit_rolle_liefert_zeilen()
returns setof text language plpgsql as $$
declare v_n integer;
begin
  -- schadensmeldung/wartungsauftrag sind sonst leer - siehe Kommentar an
  -- fixture_schaden_und_auftrag.
  perform velocity_test.fixture_schaden_und_auftrag();
  perform velocity_test.fixture_mitarbeiter('sicht');
  select count(*) into v_n from velocity.v_wawi_flotte;
  return next cmp_ok(v_n, '>', 0, 'Mit Rolle liefert v_wawi_flotte Raeder');
  select count(*) into v_n from velocity.v_wawi_station;
  return next cmp_ok(v_n, '>', 0, 'Mit Rolle liefert v_wawi_station Stationen');
  select count(*) into v_n from velocity.v_wawi_kunde;
  return next cmp_ok(v_n, '>', 0, 'Mit Rolle liefert v_wawi_kunde Kunden');
  select count(*) into v_n from velocity.v_wawi_schaden;
  return next cmp_ok(v_n, '>', 0, 'Mit Rolle liefert v_wawi_schaden Meldungen');
  select count(*) into v_n from velocity.v_wawi_auftrag;
  return next cmp_ok(v_n, '>', 0, 'Mit Rolle liefert v_wawi_auftrag Auftraege');
  perform set_config('request.jwt.claims', '', true);
end;
$$;

-- Die beiden Tests oben zeigen nur, dass IRGENDEINE Rolle etwas sieht -
-- mit allen vier Rollen gleichzeitig (fixture_mitarbeiter) sieht der
-- Testmitarbeiter ohnehin jede Sicht. Der eigentliche Streitpunkt
-- zwischen Kunde und Mitarbeiter ist die Trennung: dieselbe
-- Datenbankrolle 'authenticated', aber unterschiedliche Sichtbarkeit je
-- nach zugeteilter Fachrolle. Das prueft nur eine Zusicherung, die eine
-- NICHT zugeteilte Rolle ausdruecklich als leer erwartet.
create or replace function velocity_test.test_v_rollentrennung_greift()
returns setof text language plpgsql as $$
declare v_n integer;
begin
  perform velocity_test.fixture_mitarbeiter_mit_rolle('disposition-only', 'disposition');
  select count(*) into v_n from velocity.v_wawi_flotte;
  return next cmp_ok(v_n, '>', 0, 'Disposition sieht die Flotte');
  select count(*) into v_n from velocity.v_wawi_kunde;
  return next is(v_n, 0, 'Disposition sieht keine Kundenstammdaten - kundenservice/leitung sind nicht zugeteilt');
  perform set_config('request.jwt.claims', '', true);

  perform velocity_test.fixture_mitarbeiter_mit_rolle('kundenservice-only', 'kundenservice');
  select count(*) into v_n from velocity.v_wawi_kunde;
  return next cmp_ok(v_n, '>', 0, 'Kundenservice sieht die Kundenstammdaten');
  select count(*) into v_n from velocity.v_wawi_flotte;
  return next is(v_n, 0, 'Kundenservice sieht nicht die Flotte - disposition/werkstatt/leitung sind nicht zugeteilt');
  perform set_config('request.jwt.claims', '', true);
end;
$$;

-- Gesamtpruefung Punkt 3: v_wawi_fahrt_km fuehrte ausleihe_id, kunde_id
-- und startzeit je Einzelfahrt und filterte bis dahin nur ueber
-- velocity.ist_mitarbeiter() - das liess JEDE Fachrolle durch, auch
-- kundenservice. Ein Mitarbeiter mit NUR dieser Rolle konnte damit die
-- vollstaendige Fahrtenliste eines Kunden mit Zeitstempeln abrufen: ein
-- Bewegungsprofil, das Spec 4.2 dem Kundenservice ausdruecklich verweigert.
-- Nach dem Muster von test_v_rollentrennung_greift oben: genau EINE nicht
-- zugeteilte Rolle pruefen, nicht fixture_mitarbeiter mit allen Rollen.
create or replace function velocity_test.test_v_fahrt_km_nur_leitung()
returns setof text language plpgsql as $$
declare v_n integer;
begin
  perform velocity_test.fixture_mitarbeiter_mit_rolle('kundenservice-fahrtkm', 'kundenservice');
  select count(*) into v_n from velocity.v_wawi_fahrt_km;
  return next is(v_n, 0,
    'Kundenservice sieht keine Einzelfahrten - v_wawi_fahrt_km ist ein Bewegungsprofil, nur leitung darf');
  perform set_config('request.jwt.claims', '', true);

  perform velocity_test.fixture_mitarbeiter_mit_rolle('werkstatt-fahrtkm', 'werkstatt');
  select count(*) into v_n from velocity.v_wawi_fahrt_km;
  return next is(v_n, 0, 'Werkstatt sieht keine Einzelfahrten - nur leitung ist zugeteilt');
  perform set_config('request.jwt.claims', '', true);

  perform velocity_test.fixture_mitarbeiter_mit_rolle('leitung-fahrtkm', 'leitung');
  select count(*) into v_n from velocity.v_wawi_fahrt_km;
  return next cmp_ok(v_n, '>', 0, 'Leitung sieht die Einzelfahrten');
  perform set_config('request.jwt.claims', '', true);
end;
$$;

create or replace function velocity_test.test_v_kunde_ohne_bewegungsprofil()
returns setof text language plpgsql as $$
begin
  -- Eine Liste von Fahrten mit Start, Ziel und Uhrzeit ist ein
  -- Bewegungsprofil. Der Kundenservice braucht es nicht; die Auswertung
  -- braucht nur Summen. Was niemand braucht, wird nicht ausgeliefert.
  return next hasnt_column('velocity'::name, 'v_wawi_kunde'::name, 'ausleihe_id'::name,
                           'v_wawi_kunde nennt keine einzelne Fahrt');
  return next hasnt_column('velocity'::name, 'v_wawi_kunde'::name, 'passwort_hash'::name,
                           'v_wawi_kunde nennt kein Passwort');
  return next hasnt_column('velocity'::name, 'v_wawi_kunde'::name, 'zahlungsmittel_id'::name,
                           'v_wawi_kunde nennt kein Zahlungsmittel');
end;
$$;

create or replace function velocity_test.test_v_umsatz_nach_radtyp()
returns setof text language plpgsql as $$
declare v_n integer;
begin
  perform velocity_test.fixture_mitarbeiter('umsatz');
  select count(*) into v_n from velocity.v_wawi_umsatz_radtyp;
  return next cmp_ok(v_n, '>', 0, 'Die Umsatzauswertung nach Radtyp liefert Zeilen');

  -- Der Umsatz der Sicht muss der Summe der Positionen entsprechen.
  -- Eine Auswertung, die anders rechnet als die Buchhaltung, ist
  -- schlimmer als keine.
  return next is(
    (select round(sum(umsatz), 2) from velocity.v_wawi_umsatz_radtyp),
    (select round(sum(ep.betrag), 2)
       from velocity.entgeltposition ep
       join velocity.entgeltart ea using (entgeltart_id)
       join velocity.ausleihe a using (ausleihe_id)
      where a.status = 'abgeschlossen'),
    'Der Umsatz der Sicht ist die Summe der Entgeltpositionen');
  perform set_config('request.jwt.claims', '', true);
end;
$$;

create or replace function velocity_test.test_v_km_kennzeichnet_schaetzung()
returns setof text language plpgsql as $$
declare v_gemessen integer; v_geschaetzt integer;
begin
  perform velocity_test.fixture_mitarbeiter('km');
  select count(*) filter (where not ist_geschaetzt),
         count(*) filter (where ist_geschaetzt)
    into v_gemessen, v_geschaetzt
    from velocity.v_wawi_fahrt_km;
  -- Beide Sorten muessen vorkommen, sonst prueft der Rest nichts.
  return next cmp_ok(v_gemessen,   '>', 0, 'Es gibt gemessene Strecken');
  return next cmp_ok(v_geschaetzt, '>', 0, 'Es gibt geschaetzte Strecken');

  return next is_empty(
    $q$ select 1 from velocity.v_wawi_km_co2
         where anteil_geschaetzt is null or anteil_geschaetzt < 0 or anteil_geschaetzt > 1 $q$,
    'Jede Zeile der CO2-Auswertung weist ihren geschaetzten Anteil aus');
  perform set_config('request.jwt.claims', '', true);
end;
$$;

create or replace function velocity_test.test_v_co2_rechnet_gegen_die_annahmen()
returns setof text language plpgsql as $$
declare v_zeile record; v_erwartet numeric;
begin
  perform velocity_test.fixture_mitarbeiter('co2');
  select * into v_zeile from velocity.v_wawi_km_co2
   where typ_code = 'CITY' and kilometer > 0 order by monat limit 1;

  select round(v_zeile.kilometer
               * ((select wert from velocity.rechenannahme
                    where code = 'co2_pkw' and upper_inf(gueltigkeit))
                - (select wert from velocity.rechenannahme
                    where code = 'co2_rad' and upper_inf(gueltigkeit)))
               / 1000.0, 2)
    into v_erwartet;
  return next is(v_zeile.co2_ersparnis_kg, v_erwartet,
                 'Die CO2-Ersparnis folgt den Werten aus rechenannahme');
  perform set_config('request.jwt.claims', '', true);
end;
$$;

-- Fix (Aufgabe 11, zweiter Durchgang): die vier Auswertungssichten oben
-- wurden bislang nur mit fixture_mitarbeiter geprueft - der traegt ALLE
-- vier Rollen gleichzeitig und sieht deshalb ohnehin alles. Das deckt
-- keinen Rollenfilter auf, auch keinen fehlenden: v_wawi_km_co2 filterte
-- ueber v_wawi_fahrt_km zunaechst nur ist_mitarbeiter() (jede Fachrolle),
-- nicht hat_rolle('leitung') - und kein bisheriger Test haette das
-- gemerkt. Wie test_v_rollentrennung_greift oben: genau EINE Rolle
-- zuteilen und pruefen, dass eine NICHT zugeteilte Rolle leer bleibt.
create or replace function velocity_test.test_v_auswertung_rollentrennung_greift()
returns setof text language plpgsql as $$
declare v_n integer;
begin
  -- werkstatt darf keine der vier Auswertungen sehen: weder umsatz_radtyp/
  -- umsatz_kundengruppe/km_co2 (nur leitung) noch stationsauslastung
  -- (nur disposition/leitung).
  perform velocity_test.fixture_mitarbeiter_mit_rolle('werkstatt-auswertung', 'werkstatt');
  select count(*) into v_n from velocity.v_wawi_umsatz_radtyp;
  return next is(v_n, 0, 'Werkstatt sieht keinen Umsatz nach Radtyp - nur leitung ist zugeteilt');
  select count(*) into v_n from velocity.v_wawi_umsatz_kundengruppe;
  return next is(v_n, 0, 'Werkstatt sieht keinen Umsatz nach Kundengruppe - nur leitung ist zugeteilt');
  select count(*) into v_n from velocity.v_wawi_km_co2;
  return next is(v_n, 0,
    'Werkstatt sieht keine CO2-Auswertung - ist_mitarbeiter() aus v_wawi_fahrt_km allein reicht nicht, '
    'v_wawi_km_co2 braucht ihren eigenen hat_rolle(''leitung'')-Filter');
  select count(*) into v_n from velocity.v_wawi_stationsauslastung;
  return next is(v_n, 0, 'Werkstatt sieht keine Stationsauslastung - nur disposition/leitung sind zugeteilt');
  perform set_config('request.jwt.claims', '', true);

  -- leitung sieht alle vier.
  perform velocity_test.fixture_mitarbeiter_mit_rolle('leitung-auswertung', 'leitung');
  select count(*) into v_n from velocity.v_wawi_umsatz_radtyp;
  return next cmp_ok(v_n, '>', 0, 'Leitung sieht den Umsatz nach Radtyp');
  select count(*) into v_n from velocity.v_wawi_umsatz_kundengruppe;
  return next cmp_ok(v_n, '>', 0, 'Leitung sieht den Umsatz nach Kundengruppe');
  select count(*) into v_n from velocity.v_wawi_km_co2;
  return next cmp_ok(v_n, '>', 0, 'Leitung sieht die CO2-Auswertung');
  select count(*) into v_n from velocity.v_wawi_stationsauslastung;
  return next cmp_ok(v_n, '>', 0, 'Leitung sieht die Stationsauslastung');
  perform set_config('request.jwt.claims', '', true);

  -- disposition sieht NUR die Stationsauslastung, nicht die drei anderen.
  perform velocity_test.fixture_mitarbeiter_mit_rolle('disposition-auswertung', 'disposition');
  select count(*) into v_n from velocity.v_wawi_stationsauslastung;
  return next cmp_ok(v_n, '>', 0, 'Disposition sieht die Stationsauslastung');
  select count(*) into v_n from velocity.v_wawi_umsatz_radtyp;
  return next is(v_n, 0,
    'Disposition sieht keinen Umsatz nach Radtyp - die Spec gibt ihr nur die Stationsauslastung');
  select count(*) into v_n from velocity.v_wawi_km_co2;
  return next is(v_n, 0, 'Disposition sieht keine CO2-Auswertung - nur leitung ist zugeteilt');
  perform set_config('request.jwt.claims', '', true);
end;
$$;

-- Aufgabe 3 (Oberflaechenplan): v_wawi_modell - die Auswahlliste, ohne die
-- api_rad_anlegen keine modell_id fuer eine neue Radanlage hergibt.
create or replace function velocity_test.test_v_modell_fuer_die_auswahlliste()
returns setof text language plpgsql as $$
declare v_n integer;
begin
  return next has_view('velocity'::name, 'v_wawi_modell'::name, 'v_wawi_modell existiert');

  perform velocity_test.fixture_mitarbeiter('modell');
  select count(*) into v_n from velocity.v_wawi_modell;
  -- Ohne Zeilen kann die Maske kein Rad anlegen. Der Bestand fuehrt drei
  -- Modelle; die Zahl selbst ist nicht der Punkt, die Bewohnbarkeit schon.
  return next cmp_ok(v_n, '>', 0, 'Die Auswahlliste ist nicht leer');

  -- Die Sicht ist fuer eine EINGABEmaske da. Wer ein Rad anlegt, muss
  -- Hersteller und Typ lesen koennen, sonst waehlt er eine Nummer.
  return next has_column('velocity'::name, 'v_wawi_modell'::name, 'hersteller'::name,
                         'v_wawi_modell nennt den Hersteller');
  return next has_column('velocity'::name, 'v_wawi_modell'::name, 'typ_code'::name,
                         'v_wawi_modell nennt den Radtyp');
  perform set_config('request.jwt.claims', '', true);
end;
$$;

create or replace function velocity_test.test_v_modell_nur_fuer_disposition()
returns setof text language plpgsql as $$
declare v_n integer;
begin
  -- Wer keine Raeder anlegt, braucht die Modellliste nicht. Dieselbe
  -- Schranke wie bei v_wawi_flotte, aus demselben Grund: eine Sicht, die
  -- ihre Schranke von einer anderen erbt, hat keine eigene.
  perform velocity_test.fixture_mitarbeiter_mit_rolle('modell-ks', 'kundenservice');
  select count(*) into v_n from velocity.v_wawi_modell;
  return next is(v_n, 0, 'Der Kundenservice sieht die Modellliste nicht');
  perform set_config('request.jwt.claims', '', true);
end;
$$;

-- Die beiden Tests oben pruefen die Grenze nur zur Haelfte: die
-- Auswahllisten-Probe vergibt ueber fixture_mitarbeiter ALLE vier Rollen und
-- zeigt so nur, dass irgendeine Rolle etwas sieht; die Disposition-Probe
-- prueft trotz ihres Namens ausschliesslich, dass kundenservice aussen vor
-- bleibt. Ungeprueft: dass disposition ALLEIN Zeilen sieht, und dass
-- werkstatt ausgeschlossen ist. Gerade werkstatt ist der heikle Fall - die
-- Schwestersicht v_wawi_flotte laesst werkstatt zu, und beim Nachbauen
-- weiterer Sichten wird genau diese Zeile kopiert.
create or replace function velocity_test.test_v_modell_rollentrennung_greift()
returns setof text language plpgsql as $$
declare v_n integer;
begin
  perform velocity_test.fixture_mitarbeiter_mit_rolle('modell-disposition', 'disposition');
  select count(*) into v_n from velocity.v_wawi_modell;
  return next cmp_ok(v_n, '>', 0, 'Disposition allein sieht die Modellliste');
  perform set_config('request.jwt.claims', '', true);

  perform velocity_test.fixture_mitarbeiter_mit_rolle('modell-leitung', 'leitung');
  select count(*) into v_n from velocity.v_wawi_modell;
  return next cmp_ok(v_n, '>', 0, 'Leitung allein sieht die Modellliste');
  perform set_config('request.jwt.claims', '', true);

  perform velocity_test.fixture_mitarbeiter_mit_rolle('modell-werkstatt', 'werkstatt');
  select count(*) into v_n from velocity.v_wawi_modell;
  return next is(v_n, 0,
    'Werkstatt sieht die Modellliste nicht - anders als bei v_wawi_flotte ist sie hier nicht zugeteilt');
  perform set_config('request.jwt.claims', '', true);
end;
$$;
