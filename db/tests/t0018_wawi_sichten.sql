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

  -- Nachtraeglich ergaenzt: die Detailmaske eines Rades brauchte mehr als
  -- Hersteller und Modellname, siehe fahrradmodell und
  -- db/betrieb/flottenmodelle_stammdaten.sql.
  return next has_column('velocity'::name, 'v_wawi_flotte'::name, 'baujahr'::name,
                         'v_wawi_flotte nennt das Baujahr');
  return next has_column('velocity'::name, 'v_wawi_flotte'::name, 'gewicht_kg'::name,
                         'v_wawi_flotte nennt das Gewicht');
  return next has_column('velocity'::name, 'v_wawi_flotte'::name, 'akkukapazitaet_wh'::name,
                         'v_wawi_flotte nennt die Akkukapazitaet');
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

-- Oberflaechenauftrag "Kundschaft erweitern", Punkt 1: "Letzte Ausleihe
-- am" fehlte ganz in v_wawi_kunde. Vier frische Testkunden statt
-- bestehender Datensaetze - die vorhandenen 1014 Kunden haben laengst
-- Ausleihen in beliebigen Zustaenden, ein eigener Kunde je Fall macht
-- das erwartete Ergebnis eindeutig, statt sich auf einen zufaellig
-- passenden Bestandskunden zu verlassen.
create or replace function velocity_test.test_v_kunde_letzte_ausleihe()
returns setof text language plpgsql as $$
declare
  v_station             bigint;
  v_fahrrad_alt         bigint;
  v_fahrrad_aktiv       bigint;
  v_kunde_ohne          bigint;
  v_kunde_abgeschlossen bigint;
  v_kunde_aktiv         bigint;
  v_kunde_storniert     bigint;
  v_letzte              timestamptz;
  v_laeuft              boolean;
begin
  perform velocity_test.fixture_mitarbeiter('letzte-ausleihe');

  insert into velocity.kunde (email, vorname, nachname)
    values ('test-letzte-ausleihe-ohne@example.org', 'Ohne', 'Ausleihe')
    returning kunde_id into v_kunde_ohne;
  insert into velocity.kunde (email, vorname, nachname)
    values ('test-letzte-ausleihe-alt@example.org', 'Alt', 'Ausleihe')
    returning kunde_id into v_kunde_abgeschlossen;
  insert into velocity.kunde (email, vorname, nachname)
    values ('test-letzte-ausleihe-aktiv@example.org', 'Aktiv', 'Ausleihe')
    returning kunde_id into v_kunde_aktiv;
  insert into velocity.kunde (email, vorname, nachname)
    values ('test-letzte-ausleihe-storno@example.org', 'Storno', 'Ausleihe')
    returning kunde_id into v_kunde_storniert;

  select station_id  into v_station     from velocity.station limit 1;
  select fahrrad_id  into v_fahrrad_alt from velocity.fahrrad  limit 1;
  -- Ein Rad OHNE laufende Ausleihe: uq_ausleihe_aktiv_je_fahrrad erlaubt
  -- je Rad hoechstens eine 'aktiv'-Zeile gleichzeitig.
  select fahrrad_id into v_fahrrad_aktiv from velocity.fahrrad f
   where not exists (select 1 from velocity.ausleihe au
                       where au.fahrrad_id = f.fahrrad_id and au.status = 'aktiv')
   limit 1;

  -- Fall 1: keine einzige Ausleihe. NULL ist hier der fachliche Zustand
  -- "hat noch nie ausgeliehen" - nicht "Ladefehler" (Auftrag,
  -- ausdruecklich als wiederkehrende Verwechslung benannt).
  select letzte_ausleihe_am, letzte_ausleihe_laeuft into v_letzte, v_laeuft
    from velocity.v_wawi_kunde where kunde_id = v_kunde_ohne;
  return next is(v_letzte, null, 'Ohne jede Ausleihe ist letzte_ausleihe_am NULL');
  return next is(v_laeuft, null, 'Ohne jede Ausleihe ist letzte_ausleihe_laeuft NULL, nicht false');

  -- Fall 2: eine einzelne, abgeschlossene Ausleihe vor drei Tagen.
  insert into velocity.ausleihe
         (kunde_id, fahrrad_id, start_station_id, startzeit, end_station_id, endzeit, status)
  values (v_kunde_abgeschlossen, v_fahrrad_alt, v_station, now() - interval '3 days',
          v_station, now() - interval '3 days' + interval '20 minutes', 'abgeschlossen');
  select letzte_ausleihe_am, letzte_ausleihe_laeuft into v_letzte, v_laeuft
    from velocity.v_wawi_kunde where kunde_id = v_kunde_abgeschlossen;
  return next cmp_ok(v_letzte, '>', now() - interval '4 days',
    'Eine abgeschlossene Ausleihe liefert ihre eigene startzeit als letzte_ausleihe_am');
  return next is(v_laeuft, false, 'Eine abgeschlossene letzte Ausleihe meldet letzte_ausleihe_laeuft = false');

  -- Fall 3: eine LAUFENDE Ausleihe ist juenger als eine abgeschlossene -
  -- die laufende muss gewinnen (Auftrag: "zaehlt eine laufende Ausleihe
  -- als letzte?" - ja, siehe der ausfuehrliche Kommentar an der Sicht:
  -- 110 von 275 Raedern laufen gerade, ein Ausschluss zeigte fuer genau
  -- diese Kunden ein veraltetes Datum).
  insert into velocity.ausleihe
         (kunde_id, fahrrad_id, start_station_id, startzeit, end_station_id, endzeit, status)
  values (v_kunde_aktiv, v_fahrrad_alt, v_station, now() - interval '10 days',
          v_station, now() - interval '10 days' + interval '15 minutes', 'abgeschlossen');
  insert into velocity.ausleihe (kunde_id, fahrrad_id, start_station_id, startzeit, status)
  values (v_kunde_aktiv, v_fahrrad_aktiv, v_station, now() - interval '5 minutes', 'aktiv');
  select letzte_ausleihe_am, letzte_ausleihe_laeuft into v_letzte, v_laeuft
    from velocity.v_wawi_kunde where kunde_id = v_kunde_aktiv;
  return next cmp_ok(v_letzte, '>', now() - interval '1 hour',
    'Die laufende Ausleihe zaehlt als letzte, nicht die aeltere abgeschlossene');
  return next is(v_laeuft, true,
    'letzte_ausleihe_laeuft meldet true, solange die juengste Ausleihe noch faehrt');

  -- Fall 4: eine STORNIERTE Ausleihe ist die juengste, zaehlt aber nicht
  -- mit - dieselbe Ausnahme, die fahrten_gesamt/fahrten_offen weiter
  -- oben in dieser Sicht bereits kennen: eine stornierte Ausleihe hat
  -- nie stattgefunden.
  insert into velocity.ausleihe
         (kunde_id, fahrrad_id, start_station_id, startzeit, end_station_id, endzeit, status)
  values (v_kunde_storniert, v_fahrrad_alt, v_station, now() - interval '20 days',
          v_station, now() - interval '20 days' + interval '10 minutes', 'abgeschlossen');
  insert into velocity.ausleihe (kunde_id, fahrrad_id, start_station_id, startzeit, status)
  values (v_kunde_storniert, v_fahrrad_alt, v_station, now() - interval '1 day', 'storniert');
  select letzte_ausleihe_am, letzte_ausleihe_laeuft into v_letzte, v_laeuft
    from velocity.v_wawi_kunde where kunde_id = v_kunde_storniert;
  return next cmp_ok(v_letzte, '<', now() - interval '10 days',
    'Eine stornierte Ausleihe zaehlt nicht als letzte, auch wenn sie die juengste waere');
  return next is(v_laeuft, false,
    'Nach Ausschluss der Stornierung bleibt die aeltere abgeschlossene Ausleihe die letzte');

  perform set_config('request.jwt.claims', '', true);
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
    'Werkstatt sieht keine CO2-Auswertung - v_wawi_km_co2 traegt eine eigene '
    '(hat_rolle(''leitung'') or hat_rolle(''demo''))-Schranke, unabhaengig davon, '
    'dass Werkstatt anderswo Fachrolle ist');
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
  -- Ohne Zeilen kann die Maske kein Rad anlegen. Der Bestand fuehrt fuenf
  -- Modellzeilen (ein Produkt je Typ, mehrere Hersteller); die Zahl selbst
  -- ist nicht der Punkt, die Bewohnbarkeit schon.
  return next cmp_ok(v_n, '>', 0, 'Die Auswahlliste ist nicht leer');

  -- Die Sicht ist fuer eine EINGABEmaske da. Wer ein Rad anlegt, muss
  -- Hersteller und Typ lesen koennen, sonst waehlt er eine Nummer.
  return next has_column('velocity'::name, 'v_wawi_modell'::name, 'hersteller'::name,
                         'v_wawi_modell nennt den Hersteller');
  return next has_column('velocity'::name, 'v_wawi_modell'::name, 'typ_code'::name,
                         'v_wawi_modell nennt den Radtyp');
  -- Nachtraeglich ergaenzt, zusammen mit den Stammdaten in fahrradmodell:
  -- die Auswahlliste soll auch die technischen Angaben zeigen koennen,
  -- nicht nur einen Namen.
  return next has_column('velocity'::name, 'v_wawi_modell'::name, 'baujahr'::name,
                         'v_wawi_modell nennt das Baujahr');
  -- Seit 0024_radausstattung.sql NICHT mehr: Das Gewicht haengt am
  -- einzelnen Rad, ein Modell hat keines. Die Auswahlliste darf keinen
  -- Wert zeigen, den es nicht gibt - auch keinen gemittelten, der wie
  -- eine Stammdatenangabe aussaehe.
  return next hasnt_column('velocity'::name, 'v_wawi_modell'::name, 'gewicht_kg'::name,
                           'v_wawi_modell nennt KEIN Gewicht mehr - das haengt am Rad');
  return next has_column('velocity'::name, 'v_wawi_flotte'::name, 'gewicht_kg'::name,
                         'Die Flottensicht zeigt es dafuer je Rad');
  return next has_column('velocity'::name, 'v_wawi_modell'::name, 'akkukapazitaet_wh'::name,
                         'v_wawi_modell nennt die Akkukapazitaet');
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

-- =====================================================================
-- Drill-Down-Aufgabe: v_wawi_fahrten_je_tag
-- =====================================================================

-- Existenz, Dokumentation (test_doku_vollstaendig in t0012 prueft die
-- KOMMENTARE bereits schemaweit) und kein Personenbezug: keine
-- ausleihe_id, keine kunde_id, keine Uhrzeit - dieselbe Probe wie bei
-- test_v_kunde_ohne_bewegungsprofil oben, nur fuer die neue Sicht.
create or replace function velocity_test.test_v_fahrten_je_tag_existiert_ohne_personenbezug()
returns setof text language plpgsql as $$
begin
  return next has_view('velocity'::name, 'v_wawi_fahrten_je_tag'::name,
                       'v_wawi_fahrten_je_tag existiert');
  return next has_column('velocity'::name, 'v_wawi_fahrten_je_tag'::name, 'tag'::name,
                         'v_wawi_fahrten_je_tag nennt den Tag');
  return next has_column('velocity'::name, 'v_wawi_fahrten_je_tag'::name, 'fahrten'::name,
                         'v_wawi_fahrten_je_tag nennt die Zahl der Fahrten');
  return next has_column('velocity'::name, 'v_wawi_fahrten_je_tag'::name, 'umsatz'::name,
                         'v_wawi_fahrten_je_tag nennt den Tagesumsatz');
  return next hasnt_column('velocity'::name, 'v_wawi_fahrten_je_tag'::name, 'ausleihe_id'::name,
                           'v_wawi_fahrten_je_tag nennt keine einzelne Fahrt');
  return next hasnt_column('velocity'::name, 'v_wawi_fahrten_je_tag'::name, 'kunde_id'::name,
                           'v_wawi_fahrten_je_tag nennt keinen Kunden');
end;
$$;

-- Rollenschranke: nach demselben Muster wie test_v_modell_rollentrennung_greift
-- oben eine POSITIVE Probe (leitung sieht Zeilen) UND eine NEGATIVE
-- (werkstatt sieht keine) - eine Sicht, die ihre Schranke von einer
-- anderen Sicht erbt, hat keine eigene (siehe Kopfkommentar der Sicht).
create or replace function velocity_test.test_v_fahrten_je_tag_rollentrennung_greift()
returns setof text language plpgsql as $$
declare v_n integer;
begin
  perform velocity_test.fixture_mitarbeiter_mit_rolle('tag-leitung', 'leitung');
  select count(*) into v_n from velocity.v_wawi_fahrten_je_tag;
  return next cmp_ok(v_n, '>', 0, 'Leitung sieht Tageszeilen');
  perform set_config('request.jwt.claims', '', true);

  perform velocity_test.fixture_mitarbeiter_mit_rolle('tag-werkstatt', 'werkstatt');
  select count(*) into v_n from velocity.v_wawi_fahrten_je_tag;
  return next is(v_n, 0, 'Werkstatt sieht keine Tageszeilen - nur leitung ist zugeteilt');
  perform set_config('request.jwt.claims', '', true);
end;
$$;

-- Die wichtigste Zusicherung dieser Sicht (Auftrag, woertlich: "zwei Wege
-- zur selben Zahl, die auseinanderlaufen koennen"): die Tagessummen eines
-- Monats muessen der Monatszahl entsprechen - und zwar gegen ALLE DREI
-- Monatssichten aus Aufgabe 11, nicht nur eine, weil v_wawi_fahrten_je_tag
-- bewusst keine Radtyp-/Tarifspalte fuehrt (siehe Kopfkommentar der Sicht
-- in 0018_wawi_sichten.sql) und die Tagessumme deshalb JEDER der drei
-- Aufteilungen gleichzeitig entsprechen muss.
create or replace function velocity_test.test_v_fahrten_je_tag_stimmt_mit_monatssichten_ueberein()
returns setof text language plpgsql as $$
begin
  perform velocity_test.fixture_mitarbeiter('tagessumme');

  return next is_empty($q$
    select 1
      from (select date_trunc('month', tag)::date as monat, sum(fahrten) as tagessumme
              from velocity.v_wawi_fahrten_je_tag
             group by 1) t
      join (select monat, sum(fahrten) as monatssumme
              from velocity.v_wawi_umsatz_radtyp
             group by 1) m using (monat)
     where t.tagessumme <> m.monatssumme
  $q$, 'Tagessumme je Monat = Monatssumme aus v_wawi_umsatz_radtyp (ueber alle Radtypen)');

  return next is_empty($q$
    select 1
      from (select date_trunc('month', tag)::date as monat, sum(fahrten) as tagessumme
              from velocity.v_wawi_fahrten_je_tag
             group by 1) t
      join (select monat, sum(fahrten) as monatssumme
              from velocity.v_wawi_umsatz_kundengruppe
             group by 1) m using (monat)
     where t.tagessumme <> m.monatssumme
  $q$, 'Tagessumme je Monat = Monatssumme aus v_wawi_umsatz_kundengruppe (ueber alle Tarife)');

  return next is_empty($q$
    select 1
      from (select date_trunc('month', tag)::date as monat, sum(fahrten) as tagessumme
              from velocity.v_wawi_fahrten_je_tag
             group by 1) t
      join (select monat, sum(fahrten) as monatssumme
              from velocity.v_wawi_km_co2
             group by 1) m using (monat)
     where t.tagessumme <> m.monatssumme
  $q$, 'Tagessumme je Monat = Monatssumme aus v_wawi_km_co2 (ueber alle Radtypen)');

  -- Gegenprobe, dass die drei is_empty()-Proben ueberhaupt etwas
  -- pruefen und nicht bloss leer sind, weil keine der drei Sichten
  -- gemeinsame Monate hat: mindestens ein Monat muss auf beiden Seiten
  -- vorkommen, sonst waeren alle drei Proben trivial erfuellt.
  return next cmp_ok(
    (select count(*)::int from (
       select date_trunc('month', tag)::date as monat from velocity.v_wawi_fahrten_je_tag
       intersect
       select monat from velocity.v_wawi_umsatz_radtyp) gemeinsam),
    '>', 0, 'Es gibt ueberhaupt gemeinsame Monate zwischen Tages- und Monatssicht');

  perform set_config('request.jwt.claims', '', true);
end;
$$;

-- September 2025 (Auftrag, woertlich gemessen): min 34, max 61, Spitzentag
-- der 4. September. Die Datenbank direkt gegen diese drei Zahlen - nicht
-- nur die Monatszahl - schuetzt vor einem Off-by-one-Fehler in
-- date_trunc('day', ...) oder einem falschen Zeitzonen-Cast, den die
-- Monatssummen-Gegenprobe oben allein nicht aufdecken wuerde (die
-- pruefte nur die SUMME, nicht die Verteilung auf die einzelnen Tage).
create or replace function velocity_test.test_v_fahrten_je_tag_september_2025()
returns setof text language plpgsql as $$
declare v_min integer; v_max integer; v_spitzentag date;
begin
  perform velocity_test.fixture_mitarbeiter('sept2025');

  select min(fahrten), max(fahrten)
    into v_min, v_max
    from velocity.v_wawi_fahrten_je_tag
   where tag >= '2025-09-01' and tag < '2025-10-01';
  return next is(v_min, 34, 'September 2025: Minimum 34 Fahrten (Auftrag, gemessen)');
  return next is(v_max, 61, 'September 2025: Maximum 61 Fahrten (Auftrag, gemessen)');

  select tag into v_spitzentag
    from velocity.v_wawi_fahrten_je_tag
   where tag >= '2025-09-01' and tag < '2025-10-01' and fahrten = 61;
  return next is(v_spitzentag, '2025-09-04'::date,
    'September 2025: Spitzentag der 4. September (Auftrag, gemessen)');

  perform set_config('request.jwt.claims', '', true);
end;
$$;

-- =====================================================================
-- "Sichten verweben" (Gestaltungsauftrag Punkt 2b): v_wawi_fahrten_je_tag_rad
-- =====================================================================

-- DER WICHTIGSTE TEST DIESER DATEI (Auftrag, woertlich): kein
-- Kundenbezug in den Spalten. Positiv (die erlaubten Spalten sind da)
-- UND negativ (die verbotenen fehlen) - eine Sicht, die nur behauptet,
-- keinen Personenbezug zu tragen, waere derselbe Fehlschlag wie der
-- fruehere Entwurf von v_wawi_fahrt_km, der sich auf eine geerbte
-- Schranke verliess, die es nicht gab (siehe deren Kopfkommentar in
-- 0018_wawi_sichten.sql). ausleihe_id fehlt bewusst zusaetzlich zu
-- kunde_id/kundennummer: sie liesse sich ueber v_wawi_fahrt_km (dort nur
-- fuer leitung lesbar) wieder auf eine Person zurueckfuehren.
create or replace function velocity_test.test_v_fahrten_je_tag_rad_existiert_ohne_personenbezug()
returns setof text language plpgsql as $$
begin
  return next has_view('velocity'::name, 'v_wawi_fahrten_je_tag_rad'::name,
                       'v_wawi_fahrten_je_tag_rad existiert');

  return next has_column('velocity'::name, 'v_wawi_fahrten_je_tag_rad'::name, 'tag'::name,
                         'nennt den Tag');
  return next has_column('velocity'::name, 'v_wawi_fahrten_je_tag_rad'::name, 'fahrrad_id'::name,
                         'nennt das Rad (fuer den Querverweis in die Flotte)');
  return next has_column('velocity'::name, 'v_wawi_fahrten_je_tag_rad'::name, 'rahmennummer'::name,
                         'nennt die Rahmennummer');
  return next has_column('velocity'::name, 'v_wawi_fahrten_je_tag_rad'::name, 'typ_code'::name,
                         'nennt den Radtyp');
  return next has_column('velocity'::name, 'v_wawi_fahrten_je_tag_rad'::name, 'start_station'::name,
                         'nennt die Startstation');
  return next has_column('velocity'::name, 'v_wawi_fahrten_je_tag_rad'::name, 'ziel_station'::name,
                         'nennt die Zielstation');
  return next has_column('velocity'::name, 'v_wawi_fahrten_je_tag_rad'::name, 'dauer_minuten'::name,
                         'nennt die Dauer');
  return next has_column('velocity'::name, 'v_wawi_fahrten_je_tag_rad'::name, 'kilometer'::name,
                         'nennt die Strecke');
  return next has_column('velocity'::name, 'v_wawi_fahrten_je_tag_rad'::name, 'ist_geschaetzt'::name,
                         'kennzeichnet eine geschaetzte Strecke');
  return next has_column('velocity'::name, 'v_wawi_fahrten_je_tag_rad'::name, 'umsatz'::name,
                         'nennt den Umsatz der einzelnen Fahrt');

  return next hasnt_column('velocity'::name, 'v_wawi_fahrten_je_tag_rad'::name, 'ausleihe_id'::name,
                           'nennt keine Fahrt-Kennung (liesse sich ueber v_wawi_fahrt_km zurueckverfolgen)');
  return next hasnt_column('velocity'::name, 'v_wawi_fahrten_je_tag_rad'::name, 'kunde_id'::name,
                           'nennt keinen Kunden');
  return next hasnt_column('velocity'::name, 'v_wawi_fahrten_je_tag_rad'::name, 'kundennummer'::name,
                           'nennt keine Kundennummer');
  return next hasnt_column('velocity'::name, 'v_wawi_fahrten_je_tag_rad'::name, 'vorname'::name,
                           'nennt keinen Vornamen');
  return next hasnt_column('velocity'::name, 'v_wawi_fahrten_je_tag_rad'::name, 'nachname'::name,
                           'nennt keinen Nachnamen');
  return next hasnt_column('velocity'::name, 'v_wawi_fahrten_je_tag_rad'::name, 'startzeit'::name,
                           'nennt keine Uhrzeit - nur den Tag, der schon aus dem Klickkontext bekannt ist');
end;
$$;

-- DIE FEINERE TAGESSICHT MUSS ZUR GROEBEREN PASSEN (30.08.2026)
-- v_wawi_fahrten_je_tag_typ schneidet dieselben Fahrten nach Radtyp.
-- Wenn beide Sichten je fuer sich gepflegt werden, koennen sie
-- auseinanderlaufen - etwa weil eine spaeter einen Status mehr zulaesst.
-- Dieser Test rechnet die feinere auf die groebere hoch und vergleicht
-- Tag fuer Tag; er faellt aus, sobald sich eine von beiden bewegt.
create or replace function velocity_test.test_v_fahrten_je_tag_typ_passt_zur_tagessicht()
returns setof text language plpgsql as $$
declare v_abweichungen bigint; v_typen bigint;
begin
  perform velocity_test.fixture_mitarbeiter_mit_rolle('leitung-tagtyp', 'leitung');

  select count(*) into v_abweichungen
    from (select tag, sum(fahrten) as fahrten, round(sum(umsatz), 2) as umsatz
            from velocity.v_wawi_fahrten_je_tag_typ group by tag) fein
    full join velocity.v_wawi_fahrten_je_tag grob using (tag)
   where fein.fahrten is distinct from grob.fahrten
      or fein.umsatz  is distinct from grob.umsatz;
  return next is(v_abweichungen, 0::bigint,
                 'ueber alle Radtypen summiert ergibt die feine Tagessicht exakt die grobe');

  -- Gegenprobe: die feine Sicht schneidet wirklich, es gibt mehr als
  -- einen Radtyp. Sonst waere die Zusicherung oben trivial erfuellt.
  select count(distinct typ_code) into v_typen from velocity.v_wawi_fahrten_je_tag_typ;
  return next cmp_ok(v_typen, '>', 1::bigint,
                     'die feine Tagessicht kennt mehr als einen Radtyp');

  perform set_config('request.jwt.claims', '', true);
end;
$$;

-- KORNPROBE ZUR TAGESSICHT (30.08.2026)
-- Dieselbe Gefahr wie eine Ebene tiefer: entgeltposition traegt mehrere
-- Zeilen je Ausleihe. Waere der Tagesumsatz per gewoehnlichem join
-- angehaengt, zaehlte 'fahrten' zwar dank count(distinct) noch richtig -
-- jede kuenftige Kennzahl ohne distinct aber nicht mehr. Der Test haelt
-- deshalb BEIDES fest: die Fahrtenzahl und die Umsatzsumme.
create or replace function velocity_test.test_v_fahrten_je_tag_umsatz_ohne_vervielfachung()
returns setof text language plpgsql as $$
declare v_fahrten bigint; v_erwartet bigint; v_umsatz numeric; v_umsatz_erwartet numeric;
begin
  perform velocity_test.fixture_mitarbeiter_mit_rolle('leitung-tagesumsatz', 'leitung');

  select sum(fahrten) into v_fahrten from velocity.v_wawi_fahrten_je_tag;
  select count(*) into v_erwartet from velocity.ausleihe where status = 'abgeschlossen';
  return next is(v_fahrten, v_erwartet,
                 'die Tagessicht zaehlt jede abgeschlossene Fahrt genau einmal');

  select round(sum(umsatz), 2) into v_umsatz from velocity.v_wawi_fahrten_je_tag;
  select round(sum(ep.betrag), 2) into v_umsatz_erwartet
    from velocity.entgeltposition ep
    join velocity.ausleihe a using (ausleihe_id)
   where a.status = 'abgeschlossen';
  return next is(v_umsatz, v_umsatz_erwartet,
                 'die Tagesumsaetze summieren sich auf die Entgeltpositionen der abgeschlossenen Fahrten');

  perform set_config('request.jwt.claims', '', true);
end;
$$;

-- KORNPROBE ZUM UMSATZ-JOIN (30.08.2026)
-- entgeltposition traegt MEHRERE Zeilen je Ausleihe. Waere der Umsatz per
-- gewoehnlichem join statt per left join lateral angehaengt, haette die Sicht
-- ploetzlich mehr Zeilen als Fahrten - und dauer_minuten wie kilometer waeren
-- beim Summieren zu hoch, ohne dass es irgendwo auffiele. Genau diese
-- Vervielfachung prueft dieser Test.
create or replace function velocity_test.test_v_fahrten_je_tag_rad_korn_bleibt_die_fahrt()
returns setof text language plpgsql as $$
declare v_zeilen bigint; v_fahrten bigint; v_mehrfach bigint;
begin
  perform velocity_test.fixture_mitarbeiter_mit_rolle('leitung-korn', 'leitung');

  select count(*) into v_zeilen from velocity.v_wawi_fahrten_je_tag_rad;
  select count(*) into v_fahrten from velocity.ausleihe where status = 'abgeschlossen';
  return next is(v_zeilen, v_fahrten,
                 'eine Zeile je abgeschlossener Fahrt - der Umsatz-Join vervielfacht nichts');

  -- Gegenprobe am konkreten Fall: es GIBT Fahrten mit mehr als einer
  -- Entgeltposition. Ohne sie liefe der Test oben ins Leere, weil er gar
  -- nichts zu vervielfachen haette.
  select count(*) into v_mehrfach
    from (select ausleihe_id from velocity.entgeltposition
           group by ausleihe_id having count(*) > 1) mehr;
  return next cmp_ok(v_mehrfach, '>', 0::bigint,
                     'es gibt Fahrten mit mehreren Entgeltpositionen (sonst pruefte der Korntest nichts)');

  perform set_config('request.jwt.claims', '', true);
end;
$$;

-- Rollenschranke: POSITIVE Probe fuer BEIDE zugeteilten Rollen (leitung
-- UND disposition, siehe Kopfkommentar der Sicht fuer die Begruendung
-- beider) UND eine NEGATIVE Probe fuer eine dritte, nicht zugeteilte
-- Rolle - dieselbe Gegenprobe wie bei v_wawi_fahrten_je_tag_rollentrennung_greift
-- oben, nur mit zwei erlaubten statt einer.
create or replace function velocity_test.test_v_fahrten_je_tag_rad_rollentrennung_greift()
returns setof text language plpgsql as $$
declare v_n integer;
begin
  perform velocity_test.fixture_mitarbeiter_mit_rolle('tagrad-leitung', 'leitung');
  select count(*) into v_n from velocity.v_wawi_fahrten_je_tag_rad;
  return next cmp_ok(v_n, '>', 0, 'Leitung sieht die Raeder je Tag');
  perform set_config('request.jwt.claims', '', true);

  perform velocity_test.fixture_mitarbeiter_mit_rolle('tagrad-disposition', 'disposition');
  select count(*) into v_n from velocity.v_wawi_fahrten_je_tag_rad;
  return next cmp_ok(v_n, '>', 0,
    'Disposition sieht die Raeder je Tag - Flottenbetrieb, keine Kundenauswertung');
  perform set_config('request.jwt.claims', '', true);

  perform velocity_test.fixture_mitarbeiter_mit_rolle('tagrad-werkstatt', 'werkstatt');
  select count(*) into v_n from velocity.v_wawi_fahrten_je_tag_rad;
  return next is(v_n, 0, 'Werkstatt sieht keine Raeder je Tag - weder leitung noch disposition ist zugeteilt');
  perform set_config('request.jwt.claims', '', true);
end;
$$;

-- Dieselben Fahrten, nur nach Rad statt nach Tag aggregiert geschnitten -
-- der Lehrpunkt des Auftrags wörtlich als Zahl geprüft: die Zeilenzahl
-- dieser Sicht JE TAG muss der fahrten-Spalte von v_wawi_fahrten_je_tag
-- fuer denselben Tag entsprechen. Ohne diese Gegenprobe koennte ein Join-
-- Fehler (z. B. ein versehentlicher inner statt left join auf die
-- Stationen) stillschweigend Zeilen verschlucken, ohne dass es eine der
-- beiden anderen Proben aufdeckte.
create or replace function velocity_test.test_v_fahrten_je_tag_rad_stimmt_mit_tagessumme_ueberein()
returns setof text language plpgsql as $$
begin
  perform velocity_test.fixture_mitarbeiter('tagrad-summe');

  return next is_empty($q$
    select 1
      from (select tag, count(*) as radzeilen from velocity.v_wawi_fahrten_je_tag_rad group by 1) r
      join velocity.v_wawi_fahrten_je_tag t using (tag)
     where r.radzeilen <> t.fahrten
  $q$, 'Zeilenzahl je Tag in v_wawi_fahrten_je_tag_rad = fahrten in v_wawi_fahrten_je_tag');

  -- Gegenprobe, dass obige Pruefung ueberhaupt etwas vergleicht (siehe
  -- dasselbe Muster bei test_v_fahrten_je_tag_stimmt_mit_monatssichten_ueberein).
  return next cmp_ok(
    (select count(*)::int from (
       select tag from velocity.v_wawi_fahrten_je_tag_rad
       intersect
       select tag from velocity.v_wawi_fahrten_je_tag) gemeinsam),
    '>', 0, 'Es gibt ueberhaupt gemeinsame Tage zwischen beiden Sichten');

  perform set_config('request.jwt.claims', '', true);
end;
$$;

-- Der starke Tag aus dem Auftrag (4. September 2025, 61 Fahrten,
-- wörtlich genannt): eine Liste dieser Groesse muss vollstaendig und
-- ohne stille Kuerzung ankommen - "das ist eine Liste, keine
-- Datenflut, aber pruef, was beim staerksten Tag passiert".
create or replace function velocity_test.test_v_fahrten_je_tag_rad_september_2025()
returns setof text language plpgsql as $$
declare v_n integer; v_ohne_rahmennummer integer;
begin
  perform velocity_test.fixture_mitarbeiter('tagrad-sept2025');

  select count(*) into v_n from velocity.v_wawi_fahrten_je_tag_rad where tag = '2025-09-04';
  return next is(v_n, 61, '4. September 2025: 61 Raeder-Zeilen, wie v_wawi_fahrten_je_tag.fahrten (Auftrag)');

  select count(*) into v_ohne_rahmennummer
    from velocity.v_wawi_fahrten_je_tag_rad
   where tag = '2025-09-04' and rahmennummer is null;
  return next is(v_ohne_rahmennummer, 0, 'Jede der 61 Zeilen nennt eine Rahmennummer - keine stumme Luecke');

  -- Ein schwacher Tag desselben Monats zur Gegenprobe: die Sicht liefert
  -- nicht bei jedem Tag zufaellig genau 61 Zeilen zurueck.
  select count(*) into v_n from velocity.v_wawi_fahrten_je_tag_rad where tag = '2025-09-01';
  return next isnt(v_n, 61, 'Ein anderer Tag desselben Monats liefert eine andere Zeilenzahl');

  perform set_config('request.jwt.claims', '', true);
end;
$$;

-- =====================================================================
-- Gestaltungsauftrag "Stationen ausbauen", Punkt 1: v_wawi_station_flotte
-- =====================================================================

create or replace function velocity_test.test_v_station_flotte_existiert()
returns setof text language plpgsql as $$
begin
  return next has_view('velocity'::name, 'v_wawi_station_flotte'::name,
                       'v_wawi_station_flotte existiert');
  return next has_column('velocity'::name, 'v_wawi_station_flotte'::name, 'station_id'::name,
                         'nennt die Station');
  return next has_column('velocity'::name, 'v_wawi_station_flotte'::name, 'fahrrad_id'::name,
                         'nennt das Rad');
  return next has_column('velocity'::name, 'v_wawi_station_flotte'::name, 'rahmennummer'::name,
                         'nennt die Rahmennummer');
  return next has_column('velocity'::name, 'v_wawi_station_flotte'::name, 'status'::name,
                         'nennt den Betriebsstatus');
  return next has_column('velocity'::name, 'v_wawi_station_flotte'::name, 'offene_schaeden'::name,
                         'nennt die Zahl offener Schaeden');
  return next has_column('velocity'::name, 'v_wawi_station_flotte'::name, 'hoechste_schwere'::name,
                         'nennt die hoechste offene Schwere');
end;
$$;

-- Rollenschranke: dieselben Rollen wie v_wawi_station (disposition UND
-- leitung), NICHT werkstatt - siehe Kopfkommentar der Sicht, warum eine
-- dritte, im Stationen-Bereich gar nicht sichtbare Rolle hier absichtlich
-- fehlt, obwohl v_wawi_flotte sie zulaesst.
create or replace function velocity_test.test_v_station_flotte_rollentrennung_greift()
returns setof text language plpgsql as $$
declare v_n integer;
begin
  perform velocity_test.fixture_mitarbeiter_mit_rolle('stationflotte-disposition', 'disposition');
  select count(*) into v_n from velocity.v_wawi_station_flotte;
  return next cmp_ok(v_n, '>', 0, 'Disposition sieht Raeder je Station');
  perform set_config('request.jwt.claims', '', true);

  perform velocity_test.fixture_mitarbeiter_mit_rolle('stationflotte-leitung', 'leitung');
  select count(*) into v_n from velocity.v_wawi_station_flotte;
  return next cmp_ok(v_n, '>', 0, 'Leitung sieht Raeder je Station');
  perform set_config('request.jwt.claims', '', true);

  perform velocity_test.fixture_mitarbeiter_mit_rolle('stationflotte-werkstatt', 'werkstatt');
  select count(*) into v_n from velocity.v_wawi_station_flotte;
  return next is(v_n, 0,
    'Werkstatt sieht v_wawi_station_flotte nicht - sie sieht dieselben Raeder vollstaendig ueber v_wawi_flotte');
  perform set_config('request.jwt.claims', '', true);
end;
$$;

-- Die wichtigste Zusicherung: die Zeilenzahl je Station in dieser Sicht
-- muss v_wawi_station.belegt entsprechen - dieselbe Grundgesamtheit
-- (fahrrad_position mit gesetzter station_id), nur einmal gezaehlt und
-- einmal einzeln aufgelistet. Ohne diese Gegenprobe koennte ein falscher
-- Join (z. B. ein zusaetzlicher, ungewollt vervielfachender Join auf
-- fahrradtyp/-modell) stillschweigend zu viele oder zu wenige Zeilen je
-- Station liefern, ohne dass die blosse Existenzpruefung oben es bemerkte.
create or replace function velocity_test.test_v_station_flotte_stimmt_mit_belegt_ueberein()
returns setof text language plpgsql as $$
begin
  perform velocity_test.fixture_mitarbeiter('stationflotte-belegt');

  return next is_empty($q$
    select 1
      from velocity.v_wawi_station s
      left join (select station_id, count(*) as n from velocity.v_wawi_station_flotte group by 1) f
             on f.station_id = s.station_id
     where s.belegt <> coalesce(f.n, 0)
  $q$, 'Zeilenzahl je Station in v_wawi_station_flotte = v_wawi_station.belegt');

  -- Gegenprobe, dass ueberhaupt Stationen mit Raedern existieren - sonst
  -- waere die Probe oben trivial erfuellt (0 = 0 ueberall).
  return next cmp_ok((select sum(belegt)::int from velocity.v_wawi_station), '>', 0,
    'Es gibt ueberhaupt belegte Stellplaetze, gegen die geprueft wird');

  perform set_config('request.jwt.claims', '', true);
end;
$$;

-- =====================================================================
-- Gestaltungsauftrag "Stationen ausbauen", Punkt 3:
-- v_wawi_stationsverkehr_zeitfenster
-- =====================================================================

create or replace function velocity_test.test_v_stationsverkehr_zeitfenster_existiert_ohne_personenbezug()
returns setof text language plpgsql as $$
begin
  return next has_view('velocity'::name, 'v_wawi_stationsverkehr_zeitfenster'::name,
                       'v_wawi_stationsverkehr_zeitfenster existiert');
  return next has_column('velocity'::name, 'v_wawi_stationsverkehr_zeitfenster'::name,
                         'station_id'::name, 'nennt die Station');
  return next has_column('velocity'::name, 'v_wawi_stationsverkehr_zeitfenster'::name,
                         'wochentyp'::name, 'nennt Werktag/Wochenende');
  return next has_column('velocity'::name, 'v_wawi_stationsverkehr_zeitfenster'::name,
                         'zeitfenster_start_stunde'::name, 'nennt das Zeitfenster');
  return next has_column('velocity'::name, 'v_wawi_stationsverkehr_zeitfenster'::name,
                         'abgaenge_je_tag'::name, 'nennt die Abgangsrate');
  return next has_column('velocity'::name, 'v_wawi_stationsverkehr_zeitfenster'::name,
                         'zugaenge_je_tag'::name, 'nennt die Zugangsrate');
  return next has_column('velocity'::name, 'v_wawi_stationsverkehr_zeitfenster'::name,
                         'saldo_je_tag'::name, 'nennt den Saldo');
  return next has_column('velocity'::name, 'v_wawi_stationsverkehr_zeitfenster'::name,
                         'tage_erfasst'::name, 'nennt die Stichprobengroesse');
  -- Kein Personenbezug (Auftrag, Punkt 3): keine ausleihe_id, keine
  -- kunde_id, kein einzelner Zeitstempel - dieselbe Probe wie bei
  -- v_wawi_fahrten_je_tag_rad oben, hier zusaetzlich ohne Kalendertag
  -- (siehe Kopfkommentar der Sicht).
  return next hasnt_column('velocity'::name, 'v_wawi_stationsverkehr_zeitfenster'::name,
                           'ausleihe_id'::name, 'nennt keine einzelne Fahrt');
  return next hasnt_column('velocity'::name, 'v_wawi_stationsverkehr_zeitfenster'::name,
                           'kunde_id'::name, 'nennt keinen Kunden');
  return next hasnt_column('velocity'::name, 'v_wawi_stationsverkehr_zeitfenster'::name,
                           'startzeit'::name, 'nennt keine Uhrzeit einer einzelnen Fahrt');
  return next hasnt_column('velocity'::name, 'v_wawi_stationsverkehr_zeitfenster'::name,
                           'tag'::name, 'nennt keinen Kalendertag - nur ein wiederkehrendes Zeitfenster');
end;
$$;

-- Rollenschranke: dieselben Rollen wie v_wawi_stationsauslastung
-- (disposition und leitung).
create or replace function velocity_test.test_v_stationsverkehr_zeitfenster_rollentrennung_greift()
returns setof text language plpgsql as $$
declare v_n integer;
begin
  perform velocity_test.fixture_mitarbeiter_mit_rolle('verkehr-disposition', 'disposition');
  select count(*) into v_n from velocity.v_wawi_stationsverkehr_zeitfenster;
  return next cmp_ok(v_n, '>', 0, 'Disposition sieht den Stationsverkehr');
  perform set_config('request.jwt.claims', '', true);

  perform velocity_test.fixture_mitarbeiter_mit_rolle('verkehr-leitung', 'leitung');
  select count(*) into v_n from velocity.v_wawi_stationsverkehr_zeitfenster;
  return next cmp_ok(v_n, '>', 0, 'Leitung sieht den Stationsverkehr');
  perform set_config('request.jwt.claims', '', true);

  perform velocity_test.fixture_mitarbeiter_mit_rolle('verkehr-werkstatt', 'werkstatt');
  select count(*) into v_n from velocity.v_wawi_stationsverkehr_zeitfenster;
  return next is(v_n, 0, 'Werkstatt sieht keinen Stationsverkehr');
  perform set_config('request.jwt.claims', '', true);
end;
$$;

-- Vollstaendiges Raster (Kopfkommentar der Sicht): 10 Stationen x 2
-- Wochentypen x 12 Zweistundenbloecke = 240 Zeilen, jede Station genau
-- 24 davon - auch fuer eine Station, an der ein einzelner Kasten ueber
-- den gesamten Zeitraum null Fahrten sah. Ohne diese Probe koennte ein
-- versehentlicher inner statt left join auf abgaenge/zugaenge ruhige
-- Kaesten stillschweigend verschlucken, statt sie als 0 zu zeigen.
create or replace function velocity_test.test_v_stationsverkehr_zeitfenster_vollstaendiges_raster()
returns setof text language plpgsql as $$
begin
  perform velocity_test.fixture_mitarbeiter('verkehr-raster');

  return next is((select count(*)::int from velocity.v_wawi_stationsverkehr_zeitfenster), 240,
    '10 Stationen x 2 Wochentypen x 12 Zweistundenbloecke = 240 Zeilen');

  return next is_empty($q$
    select station_id from velocity.v_wawi_stationsverkehr_zeitfenster
    group by station_id having count(*) <> 24
  $q$, 'Jede Station traegt genau 24 Zeilen (2 Wochentypen x 12 Bloecke)');

  perform set_config('request.jwt.claims', '', true);
end;
$$;

-- Die wichtigste Zusicherung: ueber ALLE Wochentypen und Zeitfenster
-- summiert, muss abgaenge/zugaenge je Station exakt v_wawi_stationsauslastung
-- entsprechen - dieselben abgeschlossenen Ausleihen, hier nur nach Zeitfenster
-- aufgeteilt statt einmalig aufsummiert. Deckt auf, was die reine
-- Rasterprobe oben nicht kann: eine falsch gruppierte oder doppelt
-- gezaehlte Fahrt wuerde die Summe verschieben, ohne die Zeilenzahl (240)
-- zu aendern.
create or replace function velocity_test.test_v_stationsverkehr_zeitfenster_summe_stimmt_mit_stationsauslastung_ueberein()
returns setof text language plpgsql as $$
begin
  perform velocity_test.fixture_mitarbeiter('verkehr-summe');

  return next is_empty($q$
    select 1
      from velocity.v_wawi_stationsauslastung s
      join (select station_id, sum(abgaenge) as summe
              from velocity.v_wawi_stationsverkehr_zeitfenster group by 1) v
        using (station_id)
     where s.abgaenge <> v.summe
  $q$, 'Summe abgaenge ueber alle Zeitfenster = v_wawi_stationsauslastung.abgaenge je Station');

  return next is_empty($q$
    select 1
      from velocity.v_wawi_stationsauslastung s
      join (select station_id, sum(zugaenge) as summe
              from velocity.v_wawi_stationsverkehr_zeitfenster group by 1) v
        using (station_id)
     where s.zugaenge <> v.summe
  $q$, 'Summe zugaenge ueber alle Zeitfenster = v_wawi_stationsauslastung.zugaenge je Station');

  return next cmp_ok((select sum(abgaenge)::int from velocity.v_wawi_stationsverkehr_zeitfenster), '>', 0,
    'Es gibt ueberhaupt Abgaenge, gegen die geprueft wird');

  perform set_config('request.jwt.claims', '', true);
end;
$$;

-- =====================================================================
-- Gestaltungsauftrag "Stationen ausbauen", Punkt 4: velocity.ort_koordinate
-- und v_wawi_kundenorte
-- =====================================================================

create or replace function velocity_test.test_v_kundenorte_existiert_ohne_personenbezug()
returns setof text language plpgsql as $$
begin
  return next has_view('velocity'::name, 'v_wawi_kundenorte'::name,
                       'v_wawi_kundenorte existiert');
  return next has_column('velocity'::name, 'v_wawi_kundenorte'::name, 'ort'::name,
                         'nennt den Ort');
  return next has_column('velocity'::name, 'v_wawi_kundenorte'::name, 'latitude'::name,
                         'nennt die Koordinate (Breite)');
  return next has_column('velocity'::name, 'v_wawi_kundenorte'::name, 'longitude'::name,
                         'nennt die Koordinate (Laenge)');
  return next has_column('velocity'::name, 'v_wawi_kundenorte'::name, 'kunden'::name,
                         'nennt die Kundenzahl je Ort');
  -- Kein Personenbezug (Auftrag, Punkt 4: "Kunden auf einer Karte sind
  -- Personendaten") - siehe der ausfuehrliche Kopfkommentar der Sicht,
  -- warum eine Zaehlung je Ort zulaessig ist, ein Einzelbezug nicht.
  return next hasnt_column('velocity'::name, 'v_wawi_kundenorte'::name, 'kunde_id'::name,
                           'nennt keinen einzelnen Kunden');
  return next hasnt_column('velocity'::name, 'v_wawi_kundenorte'::name, 'kundennummer'::name,
                           'nennt keine Kundennummer');
  return next hasnt_column('velocity'::name, 'v_wawi_kundenorte'::name, 'vorname'::name,
                           'nennt keinen Vornamen');
  return next hasnt_column('velocity'::name, 'v_wawi_kundenorte'::name, 'nachname'::name,
                           'nennt keinen Nachnamen');
  return next hasnt_column('velocity'::name, 'v_wawi_kundenorte'::name, 'strasse'::name,
                           'nennt keine Strasse - eine Adresse je Ort waere kein Ort mehr');
  return next hasnt_column('velocity'::name, 'v_wawi_kundenorte'::name, 'hausnummer'::name,
                           'nennt keine Hausnummer');
end;
$$;

-- Rollenschranke: disposition und leitung (siehe Kopfkommentar der
-- Sicht), NICHT kundenservice - der sieht dieselben Kunden ohnehin
-- einzeln ueber v_wawi_kunde und braucht die aggregierte Zweitsicht
-- nicht.
create or replace function velocity_test.test_v_kundenorte_rollentrennung_greift()
returns setof text language plpgsql as $$
declare v_n integer;
begin
  perform velocity_test.fixture_mitarbeiter_mit_rolle('kundenorte-disposition', 'disposition');
  select count(*) into v_n from velocity.v_wawi_kundenorte;
  return next cmp_ok(v_n, '>', 0, 'Disposition sieht die Kundenorte');
  perform set_config('request.jwt.claims', '', true);

  perform velocity_test.fixture_mitarbeiter_mit_rolle('kundenorte-leitung', 'leitung');
  select count(*) into v_n from velocity.v_wawi_kundenorte;
  return next cmp_ok(v_n, '>', 0, 'Leitung sieht die Kundenorte');
  perform set_config('request.jwt.claims', '', true);

  perform velocity_test.fixture_mitarbeiter_mit_rolle('kundenorte-kundenservice', 'werkstatt');
  select count(*) into v_n from velocity.v_wawi_kundenorte;
  return next is(v_n, 0, 'Werkstatt sieht die Kundenorte nicht - kein Kundenbezug in dieser Rolle');
  perform set_config('request.jwt.claims', '', true);
end;
$$;

-- Die wichtigste Zusicherung: die Summe der Kundenzahl ueber alle Orte
-- muss der Zahl der Kunden MIT Rechnungsadresse entsprechen (Auftrag,
-- woertlich als Beispiel genannt: "Veitshoechheim 58 Kunden" - hier direkt
-- gegen die gemessene Zahl geprueft), und jeder gefuehrte Ort muss eine
-- Koordinate aus velocity.ort_koordinate tragen - sonst zeigte die Karte
-- einen Ort ohne Marke, ohne dass es auffiele.
create or replace function velocity_test.test_v_kundenorte_summe_und_koordinaten_stimmen()
returns setof text language plpgsql as $$
declare v_summe integer; v_veitshoechheim integer; v_ohne_koordinate integer;
begin
  perform velocity_test.fixture_mitarbeiter('kundenorte-summe');

  select sum(kunden) into v_summe from velocity.v_wawi_kundenorte;
  return next is(v_summe,
    (select count(*)::int from velocity.kunde where rechnungsadresse_id is not null),
    'Summe der Kundenzahl je Ort = Zahl der Kunden mit Rechnungsadresse');

  select kunden into v_veitshoechheim from velocity.v_wawi_kundenorte where ort = 'Veitshöchheim';
  return next is(v_veitshoechheim, 58, 'Veitshoechheim: 58 Kunden (Auftrag, woertlich als Beispiel genannt)');

  select count(*) into v_ohne_koordinate from velocity.v_wawi_kundenorte where latitude is null;
  return next is(v_ohne_koordinate, 0, 'Jeder gefuehrte Ort traegt eine Koordinate aus velocity.ort_koordinate');

  perform set_config('request.jwt.claims', '', true);
end;
$$;

create or replace function velocity_test.test_ort_koordinate_deckt_alle_kundenorte_ab()
returns setof text language plpgsql as $$
begin
  -- Gegenprobe zur Koordinatenprobe oben, aus der anderen Richtung: kein
  -- Ort aus der Kundschaft bleibt ohne Eintrag in ort_koordinate. Ohne
  -- diese zweite Richtung koennte velocity.ort_koordinate zufaellig genug
  -- (aber falsche) Orte enthalten und die erste Probe trotzdem bestehen.
  return next is_empty($q$
    select distinct a.ort
      from velocity.kunde k join velocity.adresse a on a.adresse_id = k.rechnungsadresse_id
     where not exists (select 1 from velocity.ort_koordinate ok where ok.ort = a.ort)
  $q$, 'Jeder in der Kundschaft vorkommende Ort hat einen Eintrag in velocity.ort_koordinate');

  return next cmp_ok((select count(*)::int from velocity.ort_koordinate), '>=', 14,
    'Mindestens die 14 im Auftrag genannten Orte sind hinterlegt');
end;
$$;
