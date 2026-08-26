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
