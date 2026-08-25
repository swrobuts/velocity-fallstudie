-- =====================================================================
-- t0019 Schreibende Funktionen der Warenwirtschaft
-- =====================================================================
create schema if not exists velocity_test;
set search_path = velocity_test, velocity, extensions, public;

-- Vorrichtung: angemeldeter Mitarbeiter mit genau den genannten Rollen.
create or replace function velocity_test.fixture_rollen(p_suffix text, p_codes text[])
returns uuid language plpgsql as $$
declare v_uid uuid := gen_random_uuid(); v_m bigint;
begin
  insert into velocity.mitarbeiter (personalnummer, auth_uid, vorname, nachname, email)
       values ('L-' || p_suffix, v_uid, 'Lena', 'Test', 'l-' || p_suffix || '@example.org')
    returning mitarbeiter_id into v_m;
  insert into velocity.mitarbeiter_rolle (mitarbeiter_id, rolle_id)
  select v_m, rolle_id from velocity.rolle where code = any(p_codes);
  perform set_config('request.jwt.claims', json_build_object('sub', v_uid)::text, true);
  return v_uid;
end;
$$;

create or replace function velocity_test.test_l_ohne_rolle_kein_schreiben()
returns setof text language plpgsql as $$
declare v_modell bigint; v_station bigint;
begin
  select modell_id into v_modell from velocity.fahrradmodell order by modell_id limit 1;
  select station_id into v_station from velocity.station order by station_id limit 1;
  perform velocity_test.fixture_rollen('ohne', array['werkstatt']);
  -- Werkstatt darf reparieren, nicht beschaffen. Die Pruefung sitzt in
  -- der Funktion, nicht in der Oberflaeche: sonst genuegte ein
  -- HTTP-Aufruf an PostgREST, um sie zu umgehen.
  return next throws_ok(
    format($q$ select velocity.api_rad_anlegen('RN-L-1', %s, %s) $q$, v_modell, v_station),
    '42501', null,
    'Ohne Rolle disposition kein neues Rad');
  perform set_config('request.jwt.claims', '', true);
end;
$$;

create or replace function velocity_test.test_l_rad_anlegen_und_status()
returns setof text language plpgsql as $$
declare v_modell bigint; v_f bigint; v_n integer; v_station bigint;
begin
  select modell_id into v_modell from velocity.fahrradmodell order by modell_id limit 1;
  select station_id into v_station from velocity.station order by station_id limit 1;
  perform velocity_test.fixture_rollen('rad', array['disposition']);
  v_f := velocity.api_rad_anlegen('RN-L-2', v_modell, v_station);

  -- GR13: ohne Station geht es nicht. Ein Rad auf 'verfuegbar' ohne Ort
  -- laesst der Trigger trg_radposition_pruefen nicht zu.
  return next throws_ok(
    format($q$ select velocity.api_rad_anlegen('RN-L-3', %s, null) $q$, v_modell),
    'P0001', 'Ein neues Rad braucht eine Station (GR13)',
    'Ein Rad ohne Station wird abgewiesen');
  return next ok(v_f is not null, 'Das Rad wird angelegt');

  -- GR21: die Anschaffung steht in der Lebenslaufakte.
  select count(*) into v_n from velocity.fahrrad_ereignis
   where fahrrad_id = v_f and ereignisart = 'angeschafft';
  return next is(v_n, 1, 'Die Anschaffung erzeugt ein Ereignis');

  perform velocity.api_rad_status_setzen(v_f, 'wartung', 'Inspektion faellig');
  return next is(
    (select status::text from velocity.fahrrad where fahrrad_id = v_f),
    'wartung', 'Der Status wird gesetzt');
  perform set_config('request.jwt.claims', '', true);
end;
$$;

create or replace function velocity_test.test_l_rad_in_fahrt_nicht_ausmustern()
returns setof text language plpgsql as $$
declare v_f record; v_a bigint;
begin
  select * into v_f from velocity_test.fixture_rad('ausmustern');
  insert into velocity.ausleihe (kunde_id, fahrrad_id, start_station_id, startzeit)
  select v_f.o_kunde_id, v_f.o_fahrrad_id, station_id, now()
    from velocity.station order by station_id limit 1;
  perform velocity_test.fixture_rollen('ausm', array['disposition']);
  -- GR20: ein Rad, auf dem gerade jemand sitzt, verschwindet nicht aus
  -- dem Bestand.
  return next throws_ok(
    format($q$ select velocity.api_rad_ausmustern(%s, 'Rahmenbruch') $q$, v_f.o_fahrrad_id),
    'P0001', null,
    'Ein Rad mit laufender Ausleihe wird nicht ausgemustert');
  perform set_config('request.jwt.claims', '', true);
end;
$$;

create or replace function velocity_test.test_l_station_wird_stillgelegt_nicht_geloescht()
returns setof text language plpgsql as $$
declare v_s bigint;
begin
  perform velocity_test.fixture_rollen('stat', array['disposition']);
  v_s := velocity.api_station_anlegen('Teststation L', 'Teststrasse', '1',
                                      '97070', 'Wuerzburg', 49.79, 9.93, 12);
  return next ok(v_s is not null, 'Die Station wird angelegt');

  perform velocity.api_station_stilllegen(v_s, current_date);
  -- GR22: eine Station verschwindet nicht, sie hoert ab einem Datum auf
  -- zu existieren. Sonst verloeren alle Fahrten dorthin ihren Ort.
  return next ok(
    (select station_id from velocity.station where station_id = v_s) is not null,
    'Die Station bleibt als Satz erhalten');
  return next ok(
    not (select upper_inf(betriebszeitraum) from velocity.station where station_id = v_s),
    'Ihr Betriebszeitraum ist geschlossen');
  perform set_config('request.jwt.claims', '', true);
end;
$$;

create or replace function velocity_test.test_l_anonymisieren_statt_loeschen()
returns setof text language plpgsql as $$
declare v_k bigint; v_r bigint; v_kunde record;
begin
  insert into velocity.kunde (email, vorname, nachname, telefon, geburtsdatum)
       values ('l-dsgvo@example.org', 'Lars', 'Loeschmich', '0931 999', date '1990-05-05')
    returning kunde_id into v_k;
  insert into velocity.rechnung (rechnungsnummer, kunde_id, periode_jahr, periode_monat,
                                 erstellt_am_beleg, betrag_netto, ust_satz, ust_betrag,
                                 betrag_brutto, status)
       values ('R-TEST-DSGVO', v_k, 2026, 1, date '2026-02-01',
               10.00, 19.00, 1.90, 11.90, 'bezahlt')
    returning rechnung_id into v_r;

  perform velocity_test.fixture_rollen('dsgvo', array['kundenservice']);
  perform velocity.api_kunde_anonymisieren(v_k, 'Antrag nach Art. 17 DSGVO');

  select * into v_kunde from velocity.kunde where kunde_id = v_k;
  return next ok(v_kunde.kunde_id is not null,
                 'Der Kundensatz bleibt bestehen');
  return next is(v_kunde.vorname, 'Geloescht', 'Der Vorname ist unkenntlich');
  return next is(v_kunde.nachname, 'Geloescht', 'Der Nachname ist unkenntlich');
  return next ok(v_kunde.email like 'anonym-%@velocity.invalid',
                 'Die E-Mail ist ersetzt, nicht geleert - sie ist eindeutig');
  return next ok(v_kunde.telefon is null,     'Die Telefonnummer ist entfernt');
  return next ok(v_kunde.geburtsdatum is null,'Das Geburtsdatum ist entfernt');
  return next is(v_kunde.status::text, 'geschlossen', 'Das Konto ist geschlossen');

  -- Der eigentliche Punkt: Paragraf 147 AO verlangt zehn Jahre
  -- Aufbewahrung fuer Rechnungsbelege, Art. 17 Abs. 3 lit. b DSGVO nimmt
  -- genau solche Pflichten von der Loeschpflicht aus. Wer den Kunden
  -- loescht, verstoesst gegen das Steuerrecht; wer nichts tut, gegen die
  -- DSGVO. Anonymisieren erfuellt beides.
  return next ok(
    (select betrag_brutto from velocity.rechnung where rechnung_id = v_r) = 11.90,
    'Die Rechnung bleibt vollstaendig erhalten');
  perform set_config('request.jwt.claims', '', true);
end;
$$;

create or replace function velocity_test.test_l_auskunft_ist_vollstaendig()
returns setof text language plpgsql as $$
declare v_k bigint; v_j jsonb;
begin
  insert into velocity.kunde (email, vorname, nachname)
       values ('l-auskunft@example.org', 'Lea', 'Auskunft') returning kunde_id into v_k;
  perform velocity_test.fixture_rollen('ausk', array['kundenservice']);
  v_j := velocity.api_kunde_auskunft(v_k);

  -- Art. 15 DSGVO: alles, was zu der Person gespeichert ist, in einem
  -- Dokument. Fehlt ein Abschnitt, ist die Auskunft unvollstaendig -
  -- und damit keine.
  return next ok(v_j ? 'stammdaten',      'Die Auskunft enthaelt die Stammdaten');
  return next ok(v_j ? 'mitgliedschaften','Die Auskunft enthaelt die Mitgliedschaften');
  return next ok(v_j ? 'fahrten',         'Die Auskunft enthaelt die Fahrten');
  return next ok(v_j ? 'rechnungen',      'Die Auskunft enthaelt die Rechnungen');
  -- Aber nicht das, was auch der Kundenservice nicht sehen darf.
  return next ok(not (v_j ? 'zahlungsmittel'),
                 'Die Auskunft enthaelt keine Zahlungsmittel');

  -- GR19: der Auskunftsaufruf selbst wird protokolliert. Wer Daten
  -- einsieht, hinterlaesst eine Spur.
  return next isnt_empty(
    format($q$ select 1 from velocity.aenderungsprotokoll
                where tabelle = 'kunde' and datensatz_id = %s
                  and feld = 'auskunft_erteilt' $q$, v_k),
    'Die Auskunftserteilung ist protokolliert');
  perform set_config('request.jwt.claims', '', true);
end;
$$;

create or replace function velocity_test.test_l_kundenservice_kennt_keine_zahlungsmittel()
returns setof text language plpgsql as $$
declare v_k bigint; v_art bigint;
begin
  -- Ohne eine echte Zeile waere die Zusicherung unten leer und damit
  -- vacuous: sie bestuende auch dann, wenn die Zeilenregel abgeschaltet
  -- waere, weil velocity.zahlungsmittel produktiv noch keine einzige
  -- Zeile aus dem Altsystem uebernommen hat (nachgemessen: count(*) = 0
  -- vor diesem Insert). Ein Test, der ungesehen auch am leeren Zustand
  -- vorbeikaeme, prueft nichts.
  insert into velocity.kunde (email, vorname, nachname)
       values ('l-zahlinhaber@example.org', 'Zoe', 'Inhaberin') returning kunde_id into v_k;
  select zahlungsart_id into v_art from velocity.zahlungsart where code = 'SEPA';
  insert into velocity.zahlungsmittel (kunde_id, zahlungsart_id, referenz_token)
       values (v_k, v_art, 'tok-l-zahl');

  perform velocity_test.fixture_rollen('zahl', array['kundenservice']);
  -- GR17. Der Test steht hier ein zweites Mal, in der Rolle, die dem
  -- Kunden am naechsten ist: wenn irgendwo eine Luecke entsteht, dann
  -- hier.
  --
  -- set local role ist keine Umstaendlichkeit, sondern der Kern des
  -- Tests: db/test.py verbindet sich als postgres, und ein Superuser
  -- umgeht JEDE Rechtepruefung. Ohne Rollenwechsel koennte dieser Test
  -- nie fehlschlagen - er waere eine Zusicherung, die nichts zusichert.
  --
  -- Zusicherung ueber is_empty, nicht throws_ok: GR17 ist hier bewusst
  -- NICHT ueber ein entzogenes Recht umgesetzt. 0011 gewaehrt
  -- authenticated GRANT SELECT auf zahlungsmittel (ein Kunde muss sein
  -- eigenes Zahlungsmittel lesen koennen), und 0017 begruendet
  -- ausdruecklich, warum dabei KEIN pauschaler Entzug stattfindet:
  -- Kunde und Mitarbeiter sind fuer PostgreSQL dieselbe Rolle
  -- "authenticated", ein entzogenes Recht traefe also beide. Die
  -- Trennung haengt allein an der Zeilenregel zahlungsmittel_eigene
  -- (kunde.auth_uid = auth.uid()). Ein Kundenservice-Mitarbeiter, dessen
  -- auth_uid zu keinem kunde.auth_uid passt, bekommt deshalb keinen
  -- Fehler 42501, sondern eine korrekt leergefilterte Ergebnismenge -
  -- das IST die Absicherung. Ein throws_ok auf 42501 waere ein
  -- struktureller Widerspruch zum eigenen Entwurf aus t0017
  -- (test_s_zahlungsmittel_bleibt_gesperrt) und koennte nie gruen
  -- werden, ohne diesen bereits abgenommenen Entwurf aufzuweichen.
  set local role authenticated;
  return next is_empty(
    $q$ select 1 from velocity.zahlungsmittel limit 1 $q$,
    'Auch der Kundenservice sieht kein fremdes Zahlungsmittel - die Zeile existiert, GR17 filtert sie weg');
  reset role;
  perform set_config('request.jwt.claims', '', true);
end;
$$;

create or replace function velocity_test.test_l_schaden_und_auftrag()
returns setof text language plpgsql as $$
declare v_f bigint; v_s bigint; v_w bigint;
begin
  v_f := velocity_test.fixture_wartungsrad('ablauf');
  perform velocity_test.fixture_rollen('werk', array['werkstatt']);

  v_s := velocity.api_schaden_melden(v_f, 'Bremse', 'Bremse greift nicht', 'fahruntauglich');
  return next ok(v_s is not null, 'Die Meldung wird angelegt');
  -- Ein fahruntaugliches Rad gehoert sofort aus dem Verkehr. Das darf
  -- nicht davon abhaengen, ob jemand daran denkt.
  return next is(
    (select status::text from velocity.fahrrad where fahrrad_id = v_f),
    'defekt', 'Ein fahruntauglicher Schaden setzt das Rad auf defekt');

  v_w := velocity.api_auftrag_eroeffnen(v_f, v_s);
  return next is(
    (select status::text from velocity.schadensmeldung where schadensmeldung_id = v_s),
    'in_arbeit', 'Die Meldung wechselt auf in_arbeit');

  perform velocity.api_auftrag_erledigen(v_w, 45, 'Bremszug getauscht');
  return next is(
    (select status::text from velocity.schadensmeldung where schadensmeldung_id = v_s),
    'behoben', 'Mit dem Auftrag gilt der Schaden als behoben');
  return next is(
    (select status::text from velocity.fahrrad where fahrrad_id = v_f),
    'verfuegbar', 'Das Rad ist wieder verfuegbar');
  perform set_config('request.jwt.claims', '', true);
end;
$$;
