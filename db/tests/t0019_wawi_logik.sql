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
    format($q$ select velocity.api_rad_anlegen('RN-L-1', %s, %s, 19.5, 'diamant', 'kette', 'felge', 'akku', 'kette') $q$,
           v_modell, v_station),
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
  v_f := velocity.api_rad_anlegen('RN-L-2', v_modell, v_station, 19.5, 'diamant', 'kette', 'felge', 'akku', 'kette');

  -- GR13: ohne Station geht es nicht. Ein Rad auf 'verfuegbar' ohne Ort
  -- laesst der Trigger trg_radposition_pruefen nicht zu.
  return next throws_ok(
    format($q$ select velocity.api_rad_anlegen('RN-L-3', %s, null, 19.5, 'diamant', 'kette', 'felge', 'akku', 'kette') $q$,
           v_modell),
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
declare v_s bigint; v_beginn date;
begin
  perform velocity_test.fixture_rollen('stat', array['disposition']);
  v_s := velocity.api_station_anlegen('Teststation L', 'Teststrasse', '1',
                                      '97070', 'Wuerzburg', 49.79, 9.93, 12);
  return next ok(v_s is not null, 'Die Station wird angelegt');
  select lower(betriebszeitraum) into v_beginn from velocity.station where station_id = v_s;

  -- Absichtlich NICHT current_date als p_zum: der Betriebsbeginn ist
  -- ebenfalls current_date (Vorgabewert beim Anlegen), und
  -- daterange(x, x, '[)') ist LEER - Postgres liefert lower()/upper()
  -- fuer eine leere Reichweite als NULL. Genau diesen Fall weist
  -- api_station_stilllegen inzwischen zurueck (s.u.); der eigentliche,
  -- realistische Fall ist eine spaetere Stilllegung.
  perform velocity.api_station_stilllegen(v_s, current_date + 30);
  -- GR22: eine Station verschwindet nicht, sie hoert ab einem Datum auf
  -- zu existieren. Sonst verloeren alle Fahrten dorthin ihren Ort.
  return next ok(
    (select station_id from velocity.station where station_id = v_s) is not null,
    'Die Station bleibt als Satz erhalten');
  return next ok(
    not (select upper_inf(betriebszeitraum) from velocity.station where station_id = v_s),
    'Ihr Betriebszeitraum ist geschlossen');
  -- Bislang unbewiesen: die bisherigen Zusicherungen liessen ein
  -- Stilllegen durchgehen, das versehentlich auch den Betriebsbeginn
  -- ueberschreibt. api_station_stilllegen baut die neue Reichweite
  -- ausdruecklich aus dem zuvor gelesenen Betriebsbeginn - hier wird
  -- das auch nachgewiesen, nicht nur angenommen.
  return next is(
    (select lower(betriebszeitraum) from velocity.station where station_id = v_s),
    v_beginn, 'Der Betriebsbeginn bleibt beim Stilllegen unveraendert');

  -- Gefunden beim Schreiben der obigen Zusicherung, nicht angefordert:
  -- eine Stilllegung am Tag des Betriebsbeginns (oder davor) erzeugte
  -- vor der Korrektur eine leere Reichweite und loeschte den
  -- Betriebsbeginn ersatzlos. api_station_stilllegen weist das jetzt
  -- zurueck, statt die Station stillschweigend ohne bekannten Anfang
  -- zurueckzulassen.
  return next throws_ok(
    format($q$ select velocity.api_station_stilllegen(%s, %L) $q$, v_s, v_beginn),
    'P0001', null,
    'Stilllegen am Tag des Betriebsbeginns wird abgewiesen statt eine leere Reichweite zu erzeugen');
  perform set_config('request.jwt.claims', '', true);
end;
$$;

-- GR-unabhaengige Fachregel aus 0012_dokumentation.sql: "Fachlicher
-- Schluessel im Format S-0000", identisch zum Bestand S-0001..S-0010.
-- Eine fruehere Fassung dieser Funktion erzeugte "ST-001" - ein Format,
-- das der Bestand nie getroffen haette (eigener Filter ^ST-\d+$ findet
-- die echten Stationen nicht), und das bei jeder Neuanlage wieder bei 1
-- angefangen haette. Nur "ok(v_s is not null)" haette das nie gefangen -
-- deshalb hier eine eigene, formatscharfe Zusicherung.
create or replace function velocity_test.test_l_stationsnummer_format()
returns setof text language plpgsql as $$
declare v_s1 bigint; v_s2 bigint; v_nr1 text; v_nr2 text; v_erwartet integer;
begin
  perform velocity_test.fixture_rollen('nrformat', array['disposition']);

  select coalesce(max(substring(stationsnummer from '\d+')::integer), 0) + 1
    into v_erwartet
    from velocity.station where stationsnummer ~ '^S-\d+$';

  v_s1 := velocity.api_station_anlegen('Teststation Format 1', 'Teststrasse', '1',
                                       '97070', 'Wuerzburg', 49.79, 9.93, 10);
  select stationsnummer into v_nr1 from velocity.station where station_id = v_s1;
  return next is(v_nr1, 'S-' || lpad(v_erwartet::text, 4, '0'),
                'Die neue Station setzt die bestehende Nummernserie S-0000 fort');

  v_s2 := velocity.api_station_anlegen('Teststation Format 2', 'Teststrasse', '2',
                                       '97070', 'Wuerzburg', 49.80, 9.94, 10);
  select stationsnummer into v_nr2 from velocity.station where station_id = v_s2;
  return next is(v_nr2, 'S-' || lpad((v_erwartet + 1)::text, 4, '0'),
                'Die zweite neue Station bekommt die naechste Nummer, keine Kollision');
  perform set_config('request.jwt.claims', '', true);
end;
$$;

-- Zwei Verzweigungen von api_rad_status_setzen, die bislang keine der
-- vorhandenen Testfunktionen durchlief: test_l_rad_anlegen_und_status
-- meldet seine Vorrichtung nur mit der Rolle disposition an, sodass der
-- werkstatt-Zweig (hat_rolle('werkstatt') = true) nie durchlaufen wurde
-- und ebenso wenig der Fall, dass gar keine der beiden Rollen zutrifft.
create or replace function velocity_test.test_l_status_setzen_rollen_und_grenzen()
returns setof text language plpgsql as $$
declare v_f record; v_station bigint;
begin
  select * into v_f from velocity_test.fixture_rad('statusgrenzen');
  select station_id into v_station from velocity.station order by station_id limit 1;
  insert into velocity.fahrrad_position (fahrrad_id, station_id, akkustand_prozent)
       values (v_f.o_fahrrad_id, v_station, 80);

  -- Zweig 1: Werkstatt darf den Status setzen, auch ohne die Rolle
  -- disposition.
  perform velocity_test.fixture_rollen('statusgrenzen1', array['werkstatt']);
  perform velocity.api_rad_status_setzen(v_f.o_fahrrad_id, 'wartung', null);
  return next is(
    (select status::text from velocity.fahrrad where fahrrad_id = v_f.o_fahrrad_id),
    'wartung', 'Werkstatt darf den Status ohne Rolle disposition setzen');

  -- Die Ablehnung von 'ausgemustert' greift, solange ueberhaupt eine der
  -- beiden Rollen vorliegt - noch niemand hatte das bislang geprueft.
  return next throws_ok(
    format($q$ select velocity.api_rad_status_setzen(%s, 'ausgemustert', null) $q$,
           v_f.o_fahrrad_id),
    'P0001', 'Zum Ausmustern api_rad_ausmustern verwenden',
    'api_rad_status_setzen weist die Ausmusterung zurueck');
  perform set_config('request.jwt.claims', '', true);

  -- Zweig 2: weder werkstatt noch disposition - der else-Zweig von
  -- fn_rolle_verlangen('disposition') muss greifen.
  perform velocity_test.fixture_rollen('statusgrenzen2', array['kundenservice']);
  return next throws_ok(
    format($q$ select velocity.api_rad_status_setzen(%s, 'verfuegbar', null) $q$,
           v_f.o_fahrrad_id),
    '42501', null,
    'Ohne werkstatt und ohne disposition kein Statuswechsel');
  perform set_config('request.jwt.claims', '', true);
end;
$$;

-- W-Befund Gesamtpruefung Punkt 2: api_rad_status_setzen war der dritte
-- und meistbenutzte Pfad zum Status 'verfuegbar' - anders als
-- fn_ausleihe_beenden (0009) und api_auftrag_erledigen (oben) prufte er
-- nicht, ob noch eine fahruntaugliche Meldung offen ist. Ueber den
-- ECHTEN Weg nachgestellt: api_schaden_melden zuerst, danach der Versuch,
-- ueber api_rad_status_setzen zurueck auf 'verfuegbar' zu setzen - nicht
-- ueber ein direktes UPDATE, das den gemeldeten Fall gar nicht erzeugt.
create or replace function velocity_test.test_l_status_verfuegbar_blockt_fahruntauglich()
returns setof text language plpgsql as $$
declare v_f record; v_station bigint; v_s bigint;
begin
  select * into v_f from velocity_test.fixture_rad('statusfahruntauglich');
  select station_id into v_station from velocity.station order by station_id limit 1;
  insert into velocity.fahrrad_position (fahrrad_id, station_id, akkustand_prozent)
       values (v_f.o_fahrrad_id, v_station, 80);

  perform velocity_test.fixture_rollen('statusfahruntauglich', array['werkstatt']);
  v_s := velocity.api_schaden_melden(v_f.o_fahrrad_id, 'Rahmen', 'Rahmen gebrochen',
                                      'fahruntauglich');
  return next is(
    (select status::text from velocity.fahrrad where fahrrad_id = v_f.o_fahrrad_id),
    'defekt', 'Die Meldung setzt das Rad selbst schon auf defekt');

  -- Der eigentliche Befund: ohne die Pruefung liesse sich das Rad hier
  -- trotz offener fahruntauglicher Meldung auf 'verfuegbar' setzen.
  return next throws_ok(
    format($q$ select velocity.api_rad_status_setzen(%s, 'verfuegbar', null) $q$,
           v_f.o_fahrrad_id),
    'P0001', null,
    'api_rad_status_setzen weist verfuegbar bei offener fahruntauglicher Meldung zurueck');
  return next is(
    (select status::text from velocity.fahrrad where fahrrad_id = v_f.o_fahrrad_id),
    'defekt', 'Das Rad bleibt defekt, die abgewiesene Anweisung aendert nichts');
  return next isnt_empty(
    format($q$ select 1 from velocity.schadensmeldung
                where schadensmeldung_id = %s and status = 'offen' $q$, v_s),
    'Die Meldung bleibt offen');

  -- Andere Zielstaende bleiben frei - die Pruefung gilt nur 'verfuegbar'.
  perform velocity.api_rad_status_setzen(v_f.o_fahrrad_id, 'wartung', null);
  return next is(
    (select status::text from velocity.fahrrad where fahrrad_id = v_f.o_fahrrad_id),
    'wartung', 'Andere Zielstaende bleiben trotz offener Meldung erreichbar');
  perform set_config('request.jwt.claims', '', true);
end;
$$;

-- GR15: seit ihrer Entstehung in 0003_bereich_b_netz_und_flotte.sql ohne
-- jeden Regressionstest in der gesamten Kette. trg_stellplaetze_pruefen
-- ist ein "deferrable initially deferred" Constraint-Trigger und feuert
-- planmaessig erst beim COMMIT - pgTAPs runtests() rollt aber jede
-- Testfunktion ueber ein SAVEPOINT zurueck, ohne je zu committen. Ein
-- Test ohne Gegenmassnahme waere IMMER gruen, unabhaengig davon, ob die
-- Regel noch gilt oder laengst kaputt ist - er prueft nichts.
--
-- "set constraints all immediate" erzwingt die aufgeschobene Pruefung
-- an genau der Stelle, an der es steht, statt sie bis zum (hier nie
-- stattfindenden) Transaktionsende aufzuschieben.
create or replace function velocity_test.fixture_stellplatz_ueberschreiten(
  p_rahmennummer text, p_modell_id bigint, p_station_id bigint
) returns void language plpgsql as $$
begin
  perform velocity.api_rad_anlegen(p_rahmennummer, p_modell_id, p_station_id,
                                   19.5, 'diamant', 'kette', 'felge', 'akku', 'kette');
  set constraints all immediate;
end;
$$;

create or replace function velocity_test.test_l_stellplaetze_werden_erzwungen()
returns setof text language plpgsql as $$
declare
  v_station bigint; v_kap integer; v_belegt integer; v_frei integer;
  v_modell bigint; v_i integer;
begin
  select modell_id into v_modell from velocity.fahrradmodell order by modell_id limit 1;

  -- Die Station mit den wenigsten freien Plaetzen auswaehlen, damit
  -- moeglichst wenig Testraeder noetig sind, um sie randvoll zu machen.
  select s.station_id, s.kapazitaet,
         (select count(*) from velocity.fahrrad_position p where p.station_id = s.station_id)
    into v_station, v_kap, v_belegt
    from velocity.station s
   order by s.kapazitaet - (select count(*) from velocity.fahrrad_position p
                              where p.station_id = s.station_id) asc
   limit 1;
  v_frei := v_kap - v_belegt;

  perform velocity_test.fixture_rollen('stell', array['disposition']);

  -- Randvoll machen, ueber die echte Schnittstelle - nicht an ihr
  -- vorbei, sonst prueft der Test die api_-Schicht nicht mehr mit.
  for v_i in 1..v_frei loop
    perform velocity.api_rad_anlegen('RN-STELL-' || v_i, v_modell, v_station,
                                     19.5, 'diamant', 'kette', 'felge', 'akku', 'kette');
  end loop;

  return next throws_ok(
    format($q$ select velocity_test.fixture_stellplatz_ueberschreiten(
                 'RN-STELL-ueberzaehlig', %s, %s) $q$, v_modell, v_station),
    '23514', null,
    'Eine bis zur Kapazitaet gefuellte Station weist ein weiteres Rad ab (GR15)');

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
  -- W3: die urspruengliche Fassung liess Zahlungen, Schadensmeldungen,
  -- das Freiminutenkonto und das Aenderungsprotokoll selbst aus - eine
  -- Auskunft, die nur die Haelfte der gespeicherten Daten zeigt, ist
  -- keine Auskunft nach Art. 15 DSGVO.
  return next ok(v_j ? 'zahlungen',         'Die Auskunft enthaelt die Zahlungen');
  return next ok(v_j ? 'schadensmeldungen', 'Die Auskunft enthaelt die Schadensmeldungen');
  return next ok(v_j ? 'freiminuten',       'Die Auskunft enthaelt das Freiminutenkonto');
  return next ok(v_j ? 'protokoll',         'Die Auskunft enthaelt das Aenderungsprotokoll');
  -- Ebenfalls W3: die Koordinaten je Fahrt gehoeren dazu - sie sind das
  -- Genaueste, was ueber den Aufenthalt der Person gespeichert ist.
  -- 'fahrten' ist hier leer (keine Ausleihe angelegt); geprueft wird,
  -- dass das jsonb-Objekt die Spalten kennt, sobald es eine Zeile gibt -
  -- siehe test_l_fahruntauglich_bleibt_defekt_nach_rueckgabe fuer eine
  -- echte Fahrt.
  return next ok(
    pg_typeof(v_j -> 'fahrten') = 'jsonb'::regtype,
    'Der Fahrten-Abschnitt ist ein jsonb-Array, auch ohne Fahrt');
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

create or replace function velocity_test.test_l_anonymisierung_scrubbt_protokoll()
returns setof text language plpgsql as $$
declare v_k bigint; v_treffer integer;
begin
  insert into velocity.kunde (email, vorname, nachname, telefon, geburtsdatum)
       values ('l-scrub@example.org', 'Petra', 'Musterfrau', '0931 0000', date '1988-07-07')
    returning kunde_id into v_k;

  perform velocity_test.fixture_rollen('scrub', array['kundenservice']);
  -- Kunde anlegen, aendern, anonymisieren - alle drei Schritte
  -- hinterlassen Protokollzeilen, nicht nur der letzte.
  perform velocity.api_kunde_aktualisieren(v_k, 'Petra', 'Musterfrau', '0931 4711');
  perform velocity.api_kunde_anonymisieren(v_k, 'Bericht: Nachweis Protokollbereinigung');

  -- K1, der eigentliche Punkt: kein Klarname, keine echte
  -- Telefonnummer, keine echte E-Mail und kein Geburtsdatum stehen mehr
  -- im Protokoll - weder aus der vorherigen Aenderung noch aus der
  -- Anonymisierung selbst. Die Loeschung darf nicht die Kopie sein, die
  -- sie beseitigen soll.
  select count(*) into v_treffer
    from velocity.aenderungsprotokoll
   where tabelle = 'kunde' and datensatz_id = v_k
     and (wert_alt ilike '%Petra%'      or wert_neu ilike '%Petra%'
       or wert_alt ilike '%Musterfrau%' or wert_neu ilike '%Musterfrau%'
       or wert_alt like '%0931%'        or wert_neu like '%0931%'
       or wert_alt ilike '%l-scrub@example.org%'
       or wert_alt like '%1988-07-07%'  or wert_neu like '%1988-07-07%');
  return next is(v_treffer, 0,
    'Kein Klarname, keine echte Telefonnummer/E-Mail/Geburtsdatum stehen mehr im Protokoll');

  -- Die Zeilen selbst bleiben stehen, mit Zeitpunkt und Mitarbeiter -
  -- Art. 5 Abs. 2 DSGVO verlangt die Spur, WER WANN geaendert hat, auch
  -- nach einer Anonymisierung. Geloescht wuerde auch diese Spur tilgen.
  return next ok(
    (select count(*) > 0 from velocity.aenderungsprotokoll
      where tabelle = 'kunde' and datensatz_id = v_k and feld = 'telefon'
        and zeitpunkt is not null and mitarbeiter_id is not null),
    'Die Protokollzeilen zu telefon bleiben bestehen, mit Zeitpunkt und Mitarbeiter');
  return next ok(
    (select count(*) > 0 from velocity.aenderungsprotokoll
      where tabelle = 'kunde' and datensatz_id = v_k and feld = 'vorname'),
    'Auch die Protokollzeile zu vorname aus der Anonymisierung selbst bleibt bestehen');

  -- Der Anonymisierungsgrund selbst ist kein Personenbezug und bleibt
  -- lesbar - er beschreibt den Vorgang, nicht die Person.
  return next is(
    (select wert_neu from velocity.aenderungsprotokoll
      where tabelle = 'kunde' and datensatz_id = v_k and feld = 'anonymisiert'),
    'Bericht: Nachweis Protokollbereinigung',
    'Der Anonymisierungsgrund selbst bleibt lesbar');
  perform set_config('request.jwt.claims', '', true);
end;
$$;

create or replace function velocity_test.test_l_fahruntauglich_bleibt_defekt_nach_rueckgabe()
returns setof text language plpgsql as $$
declare
  v_kunde bigint; v_typ bigint; v_h bigint; v_m bigint; v_rad bigint;
  v_station bigint; v_e record; v_a bigint; v_s bigint;
begin
  select station_id into v_station from velocity.station order by station_id limit 1;
  insert into velocity.kunde (email, vorname, nachname)
       values ('l-fahruntauglich@example.org', 'Finn', 'Fahrt') returning kunde_id into v_kunde;
  insert into velocity.fahrradtyp (typ_code, bezeichnung)
       values ('L-FU', 'Fahruntauglichtestrad') returning typ_id into v_typ;
  -- fn_ausleihe_beenden ruft fn_ausleihe_abrechnen auf und scheitert
  -- ohne einen gueltigen Preis fuer den Typ (P0002) - der echte Weg
  -- verlangt den vollen Aufbau, nicht nur das Rad.
  insert into velocity.nutzungspreis (typ_id, gueltigkeit, startgebuehr, preis_pro_minute, tageshoechstpreis)
       values (v_typ, daterange(current_date - 1, null, '[)'), 0.10, 0.10, 10.00);
  insert into velocity.hersteller (name) values ('Hersteller L-FU') returning hersteller_id into v_h;
  insert into velocity.fahrradmodell (hersteller_id, typ_id, modellbezeichnung)
       values (v_h, v_typ, 'M-L-FU') returning modell_id into v_m;
  insert into velocity.fahrrad (rahmennummer, modell_id) values ('RN-L-FU', v_m) returning fahrrad_id into v_rad;
  insert into velocity.fahrrad_position (fahrrad_id, station_id) values (v_rad, v_station);

  -- Der echte Weg, nicht fixture_wartungsrad: fn_ausleihe_starten legt
  -- die Fahrt genauso an wie api_ausleihe_starten es fuer einen
  -- angemeldeten Kunden taete, nur ohne den Umweg ueber auth.uid().
  select * into v_e from velocity.fn_ausleihe_starten(v_kunde, v_rad);
  v_a := v_e.ausleihe_id;
  return next ok(v_a is not null, 'Die Fahrt startet');

  -- Waehrend der Fahrt: ein fahruntauglicher Schaden wird gemeldet.
  perform velocity_test.fixture_rollen('fu', array['werkstatt']);
  v_s := velocity.api_schaden_melden(v_rad, 'Rahmen', 'Rahmen gebrochen', 'fahruntauglich');
  perform set_config('request.jwt.claims', '', true);

  -- GR13: das Rad ist noch in Fahrt, der Status bleibt 'ausgeliehen' -
  -- api_schaden_melden darf ihn nicht ueberschreiben.
  return next is(
    (select status::text from velocity.fahrrad where fahrrad_id = v_rad),
    'ausgeliehen', 'Waehrend der Fahrt bleibt der Status ausgeliehen (GR13)');

  -- Rueckgabe ueber den echten Weg.
  perform velocity.fn_ausleihe_beenden(v_kunde, v_a, v_station, null, null);

  -- K2, der eigentliche Punkt: die Rueckgabe darf ein fahruntaugliches
  -- Rad nicht wieder freigeben.
  return next is(
    (select status::text from velocity.fahrrad where fahrrad_id = v_rad),
    'defekt', 'Ein waehrend der Fahrt fahruntauglich gemeldetes Rad bleibt nach der Rueckgabe defekt');
  return next is(
    (select status::text from velocity.schadensmeldung where schadensmeldung_id = v_s),
    'offen', 'Die Meldung bleibt offen - die Rueckgabe behebt sie nicht von selbst');
end;
$$;

-- GR13, gemessene Luecke M-0001: ausgemustert ist ein Endzustand.
--
-- api_rad_ausmustern loescht die Positionszeile mit gutem Grund - ein
-- ausgemustertes Rad hat keinen Ort mehr (s. Kommentar dort). Das wurde
-- einmal mit "nichts zu pruefen" verwechselt: api_rad_status_setzen liess
-- sich danach klaglos auf 'verfuegbar' zuruecksetzen, ganz ohne dass ein
-- neuer Standort hinterlegt wurde - nachgestellt als M-0001 in einer
-- zurueckgerollten Transaktion ("set constraints all immediate erzwingt,
-- kein Fehler"). Dieser Test stellt genau diesen Weg nach: ausmustern,
-- dann ueber dieselbe Oberflaechen-Funktion auf 'verfuegbar' setzen,
-- Ablehnung erwarten - und zwar sofort, nicht erst beim COMMIT.
create or replace function velocity_test.test_l_ausgemustert_kein_weg_zurueck()
returns setof text language plpgsql as $$
declare v_f record; v_station bigint;
begin
  select * into v_f from velocity_test.fixture_rad('ausgemustertzurueck');
  select station_id into v_station from velocity.station order by station_id limit 1;
  insert into velocity.fahrrad_position (fahrrad_id, station_id, akkustand_prozent)
       values (v_f.o_fahrrad_id, v_station, 80);

  perform velocity_test.fixture_rollen('ausgemustertzurueck', array['disposition']);
  perform velocity.api_rad_ausmustern(v_f.o_fahrrad_id, 'Rahmenbruch');
  return next is(
    (select status::text from velocity.fahrrad where fahrrad_id = v_f.o_fahrrad_id),
    'ausgemustert', 'Das Rad ist nach dem Ausmustern ausgemustert');
  return next is(
    (select count(*)::int from velocity.fahrrad_position where fahrrad_id = v_f.o_fahrrad_id),
    0, 'Die Positionszeile ist nach dem Ausmustern weg');

  -- Der eigentliche Befund: ohne die Pruefung liesse sich das Rad hier
  -- klaglos auf 'verfuegbar' zuruecksetzen - Status verfuegbar, keine
  -- Positionszeile, kein Standort.
  return next throws_ok(
    format($q$ select velocity.api_rad_status_setzen(%s, 'verfuegbar', null) $q$,
           v_f.o_fahrrad_id),
    'P0001', null,
    'api_rad_status_setzen weist die Wiederbelebung eines ausgemusterten Rades zurueck');
  return next is(
    (select status::text from velocity.fahrrad where fahrrad_id = v_f.o_fahrrad_id),
    'ausgemustert', 'Das Rad bleibt ausgemustert, die abgewiesene Anweisung aendert nichts');
  perform set_config('request.jwt.claims', '', true);
end;
$$;

-- Gesamtpruefung 26.08.2026, Befund '"Ausgemustert ist Endzustand" steht
-- nur an einer Stelle': api_schaden_melden schrieb bisher
-- "and status <> 'ausgeliehen'" - ein ausgemustertes Rad waere damit
-- klaglos wieder auf 'defekt' gesetzt worden, nur eben nicht ueber die
-- Oberflaeche (beide Masken filtern ausgemusterte Raeder heraus). Dieser
-- Test ruft die Funktion direkt auf, so wie ein zukuenftiger dritter Weg
-- es koennte.
create or replace function velocity_test.test_l_ausgemustert_bleibt_bei_schaden_melden()
returns setof text language plpgsql as $$
declare v_f record; v_station bigint; v_s bigint;
begin
  select * into v_f from velocity_test.fixture_rad('schadenausgemustert');
  select station_id into v_station from velocity.station order by station_id limit 1;
  insert into velocity.fahrrad_position (fahrrad_id, station_id) values (v_f.o_fahrrad_id, v_station);

  perform velocity_test.fixture_rollen('schadenausgemustert1', array['disposition']);
  perform velocity.api_rad_ausmustern(v_f.o_fahrrad_id, 'Rahmenbruch');

  perform velocity_test.fixture_rollen('schadenausgemustert2', array['werkstatt']);
  v_s := velocity.api_schaden_melden(v_f.o_fahrrad_id, 'Rahmen', 'Rahmen gebrochen', 'fahruntauglich');
  return next ok(v_s is not null, 'Die Meldung selbst wird trotzdem angelegt');
  return next is(
    (select status::text from velocity.fahrrad where fahrrad_id = v_f.o_fahrrad_id),
    'ausgemustert',
    'Ein ausgemustertes Rad bleibt ausgemustert, auch nach einer fahruntauglichen Meldung');
  perform set_config('request.jwt.claims', '', true);
end;
$$;

-- Dieselbe Ergaenzung, dieselbe Begruendung, fuer api_auftrag_eroeffnen.
create or replace function velocity_test.test_l_ausgemustert_bleibt_bei_auftrag_eroeffnen()
returns setof text language plpgsql as $$
declare v_f record; v_station bigint; v_w bigint;
begin
  select * into v_f from velocity_test.fixture_rad('auftragausgemustert');
  select station_id into v_station from velocity.station order by station_id limit 1;
  insert into velocity.fahrrad_position (fahrrad_id, station_id) values (v_f.o_fahrrad_id, v_station);

  perform velocity_test.fixture_rollen('auftragausgemustert1', array['disposition']);
  perform velocity.api_rad_ausmustern(v_f.o_fahrrad_id, 'Rahmenbruch');

  perform velocity_test.fixture_rollen('auftragausgemustert2', array['werkstatt']);
  v_w := velocity.api_auftrag_eroeffnen(v_f.o_fahrrad_id, null);
  return next ok(v_w is not null, 'Der Auftrag selbst wird trotzdem angelegt');
  return next is(
    (select status::text from velocity.fahrrad where fahrrad_id = v_f.o_fahrrad_id),
    'ausgemustert',
    'Ein ausgemustertes Rad bleibt ausgemustert, auch nach einem neuen Wartungsauftrag');
  perform set_config('request.jwt.claims', '', true);
end;
$$;

create or replace function velocity_test.test_l_auftrag_eroeffnen_prueft_zugehoerigkeit()
returns setof text language plpgsql as $$
declare v_f1 bigint; v_f2 bigint; v_s1 bigint;
begin
  v_f1 := velocity_test.fixture_wartungsrad('zug1');
  v_f2 := velocity_test.fixture_wartungsrad('zug2');
  perform velocity_test.fixture_rollen('zug', array['werkstatt']);
  v_s1 := velocity.api_schaden_melden(v_f1, 'Licht', 'Licht faellt aus', 'gering');

  -- W6: ein Zahlendreher darf nicht den Schaden eines FREMDEN Rades
  -- fuer einen Auftrag aufgreifen, waehrend das tatsaechlich gemeldete
  -- Rad unbearbeitet bleibt.
  return next throws_ok(
    format($q$ select velocity.api_auftrag_eroeffnen(%s, %s) $q$, v_f2, v_s1),
    'P0001', null,
    'Eine Meldung zu einem fremden Rad wird abgewiesen');
  perform set_config('request.jwt.claims', '', true);
end;
$$;

-- =====================================================================
-- Lehrbetrieb: Vorfuehrbestand auffrischen (Gestaltungsauftrag "Knopf
-- unters Profil")
--
-- Eigene, kleine Vorrichtung statt des Bestands: der Bestand traegt in
-- einer frisch aufgebauten Datenbank keine Raeder/Kunden/Stationen (die
-- kommen erst aus db/betrieb/, das VOR den pgTAP-Tests nicht laeuft),
-- kann aber in einer bereits betriebenen Datenbank hunderte Zeilen
-- tragen. Alle Zusicherungen rechnen deshalb gegen den VORHER-Zustand
-- (gezaehlt, nicht angenommen) statt gegen feste Zahlen - dieselbe
-- Ueberlegung wie bei "GEZAEHLT statt eingetragen" in tools/abnahme.sh.
-- =====================================================================
create or replace function velocity_test.fixture_lehrbetrieb(p_suffix text, p_anzahl integer)
returns table (o_station_id bigint, o_fahrrad_ids bigint[], o_kunde_ids bigint[])
language plpgsql as $$
declare
  v_adresse bigint; v_typ bigint; v_h bigint; v_m bigint; v_f bigint; v_k bigint;
  i integer;
begin
  insert into velocity.adresse (strasse, hausnummer, plz, ort)
       values ('Lehrbetriebstrasse', '1', '97070', 'Wuerzburg')
    returning adresse_id into v_adresse;
  insert into velocity.station (stationsnummer, name, adresse_id, kapazitaet)
       values ('LB-' || p_suffix, 'Lehrbetrieb-Station ' || p_suffix, v_adresse, p_anzahl + 5)
    returning station_id into o_station_id;

  insert into velocity.fahrradtyp (typ_code, bezeichnung)
       values ('LB-' || p_suffix, 'Lehrbetriebstyp ' || p_suffix) returning typ_id into v_typ;
  insert into velocity.hersteller (name) values ('LB-Hersteller-' || p_suffix)
    returning hersteller_id into v_h;
  insert into velocity.fahrradmodell (hersteller_id, typ_id, modellbezeichnung)
       values (v_h, v_typ, 'LB-Modell-' || p_suffix) returning modell_id into v_m;

  o_fahrrad_ids := array[]::bigint[];
  o_kunde_ids   := array[]::bigint[];
  for i in 1..p_anzahl loop
    insert into velocity.fahrrad (rahmennummer, modell_id)
         values ('RN-LB-' || p_suffix || '-' || i, v_m) returning fahrrad_id into v_f;
    insert into velocity.fahrrad_position (fahrrad_id, station_id) values (v_f, o_station_id);
    o_fahrrad_ids := array_append(o_fahrrad_ids, v_f);

    insert into velocity.kunde (email, vorname, nachname)
         values ('lb-' || p_suffix || '-' || i || '@example.org', 'Lena', 'Lehrbetrieb')
      returning kunde_id into v_k;
    o_kunde_ids := array_append(o_kunde_ids, v_k);
  end loop;
  return next;
end;
$$;

-- Gegenprobe zuerst (Reihenfolge bewusst): beweist, dass die Ablehnung
-- OHNE die Rolle leitung wirklich nichts anfasst - nicht nur, dass sie
-- einen Fehler wirft. Ohne dieses Gegenstueck koennte "throws_ok" allein
-- auch eine Funktion bestehen, die zuerst schreibt und danach erst
-- abbricht.
create or replace function velocity_test.test_l_lehrbetrieb_ohne_leitung_kein_zugriff()
returns setof text language plpgsql as $$
declare
  v_fix          record;
  v_alte_ausleihe bigint;
begin
  select * into v_fix from velocity_test.fixture_lehrbetrieb('gegenprobe', 2);
  insert into velocity.ausleihe (kunde_id, fahrrad_id, start_station_id, startzeit, status)
       values (v_fix.o_kunde_ids[1], v_fix.o_fahrrad_ids[1], v_fix.o_station_id,
               now() - interval '2 days', 'aktiv')
    returning ausleihe_id into v_alte_ausleihe;
  update velocity.fahrrad set status = 'ausgeliehen' where fahrrad_id = v_fix.o_fahrrad_ids[1];
  update velocity.fahrrad_position set station_id = null where fahrrad_id = v_fix.o_fahrrad_ids[1];

  -- Alle drei Fachrollen, aber nicht leitung: eine fachlich beschaeftigte
  -- Person soll diese Betriebsfunktion trotzdem nicht ausloesen koennen -
  -- sie ist kein Teil ihrer Fachaufgabe (Begruendung in 0019_wawi_logik.sql).
  perform velocity_test.fixture_rollen('lbgegenprobe',
    array['disposition', 'werkstatt', 'kundenservice']);
  return next throws_ok(
    'select * from velocity.api_lehrbetrieb_vorfuehrbestand_auffrischen()',
    '42501', null,
    'Ohne die Rolle leitung bleibt der Vorfuehrbestand unangetastet');

  -- Die Gegenprobe selbst: die alte Ausleihe der Vorrichtung steht
  -- unveraendert da, nichts wurde vor dem Abbruch schon geschrieben.
  return next is(
    (select status::text from velocity.ausleihe where ausleihe_id = v_alte_ausleihe),
    'aktiv', 'Die abgelehnte Anfrage aendert die alte Ausleihe nicht');
  return next is(
    (select status::text from velocity.fahrrad where fahrrad_id = v_fix.o_fahrrad_ids[1]),
    'ausgeliehen', 'Die abgelehnte Anfrage aendert das Rad nicht');
  perform set_config('request.jwt.claims', '', true);
end;
$$;

create or replace function velocity_test.test_l_lehrbetrieb_vorfuehrbestand_auffrischen()
returns setof text language plpgsql as $$
declare
  v_fix               record;
  v_alte_ausleihe     bigint;
  v_vorher_gesamt     integer;
  v_vorher_kandidaten integer;
  v_protokoll_vorher  integer;
  v_protokoll_nachher integer;
  v_ergebnis          record;
  v_ergebnis2         record;
begin
  select count(*) into v_vorher_gesamt from velocity.fahrrad;
  select count(*) into v_vorher_kandidaten
    from velocity.ausleihe a
   where a.status = 'aktiv'
     and (a.startzeit::date <> current_date
          or exists (select 1 from velocity.kunde k
                      where k.kunde_id = a.kunde_id and k.auth_uid is not null));
  select count(*) into v_protokoll_vorher from velocity.uebernahme_protokoll;

  select * into v_fix from velocity_test.fixture_lehrbetrieb('auffrischen', 6);

  -- Genau der Fall, den Block A schliessen muss: eine aktive Ausleihe
  -- mit einem Starttag vor heute, auf einem der frischen Raeder.
  insert into velocity.ausleihe (kunde_id, fahrrad_id, start_station_id, startzeit, status)
       values (v_fix.o_kunde_ids[1], v_fix.o_fahrrad_ids[1], v_fix.o_station_id,
               now() - interval '2 days', 'aktiv')
    returning ausleihe_id into v_alte_ausleihe;
  update velocity.fahrrad set status = 'ausgeliehen' where fahrrad_id = v_fix.o_fahrrad_ids[1];
  update velocity.fahrrad_position set station_id = null where fahrrad_id = v_fix.o_fahrrad_ids[1];

  -- Zugleich eine offene fahruntaugliche Meldung auf ebendiesem Rad -
  -- das deckt den ZWEITEN Zweig von Block A ('defekt' statt
  -- 'verfuegbar') UND macht die folgende Zusicherung ueber seinen
  -- Endzustand deterministisch: ein Rad ohne diese Meldung wuerde
  -- 'verfuegbar' und stuende danach selbst wieder als Kandidat fuer
  -- Block A auf dieselben Weise zur Wahl - mit dem festen Startwert
  -- zwar reproduzierbar, aber abhaengig von jeder Zeile, die schon
  -- vor diesem Testlauf in der Datenbank stand, und damit nicht ohne
  -- Weiteres vorhersagbar. 'defekt' schliesst das Rad dagegen aus
  -- Block B aus (siehe dortiger Filter) - sein Endzustand steht fest.
  insert into velocity.schadensmeldung
         (fahrrad_id, melder_kunde_id, kategorie, beschreibung, schwere)
       values (v_fix.o_fahrrad_ids[1], v_fix.o_kunde_ids[2], 'Rahmen',
               'Rahmen gebrochen (Testvorrichtung)', 'fahruntauglich');

  perform velocity_test.fixture_rollen('lbauffrischen', array['leitung']);
  select * into v_ergebnis from velocity.api_lehrbetrieb_vorfuehrbestand_auffrischen();

  return next is(v_ergebnis.storniert, v_vorher_kandidaten + 1,
    'Alle veralteten aktiven Ausleihen werden storniert, einschliesslich der Vorrichtung');
  return next is(v_ergebnis.flotte, v_vorher_gesamt + 6,
    'Die gemeldete Flottengroesse zaehlt den gesamten Bestand, nicht nur die neuen Raeder');
  return next is(
    (select count(*)::integer from velocity.ausleihe where status = 'aktiv'),
    v_ergebnis.aktiv, 'Die gemeldete aktive Zahl stimmt mit der Datenbank ueberein');
  return next ok(v_ergebnis.aktiv >= ceil(v_ergebnis.flotte * 0.40)::integer,
    'Die Mindestquote von 40 % ist erreicht');
  return next is(
    round(v_ergebnis.anteil_prozent, 1),
    round(100.0 * v_ergebnis.aktiv / v_ergebnis.flotte, 1),
    'Der gemeldete Anteil passt zu den gemeldeten Zahlen');

  return next is(
    (select status::text from velocity.ausleihe where ausleihe_id = v_alte_ausleihe),
    'storniert', 'Die alte Ausleihe der Vorrichtung wird storniert, nicht abgeschlossen (Umsatz/Fahrten/CO2 bleiben unberuehrt)');
  return next ok(
    (select endzeit is not null and end_station_id is not null
       from velocity.ausleihe where ausleihe_id = v_alte_ausleihe),
    'Endzeit und Endstation werden gemeinsam gesetzt (ausleihe_endort_chk, GR13)');
  return next is(
    (select status::text from velocity.fahrrad where fahrrad_id = v_fix.o_fahrrad_ids[1]),
    'defekt',
    'Das Rad der alten Ausleihe hat eine offene fahruntaugliche Meldung und wird defekt, nicht verfuegbar');
  return next ok(
    (select station_id is not null from velocity.fahrrad_position
      where fahrrad_id = v_fix.o_fahrrad_ids[1]),
    'Trotzdem bekommt es wieder einen Standort zurueck (GR13: kein Ort nur waehrend der Fahrt)');

  select count(*) into v_protokoll_nachher from velocity.uebernahme_protokoll;
  return next is(v_protokoll_nachher, v_protokoll_vorher + 1,
    'Der Lauf hinterlaesst genau einen Nachweis im Uebernahmeprotokoll (nicht im Aenderungsprotokoll, GR19 gilt nur fuer Stammdaten)');

  -- Wiederholbarkeit (Kopfkommentar von db/betrieb/
  -- aktive_ausleihen_mindestquote.sql): ein zweiter Lauf am selben Tag
  -- verdoppelt nichts.
  select * into v_ergebnis2 from velocity.api_lehrbetrieb_vorfuehrbestand_auffrischen();
  return next is(v_ergebnis2.storniert, 0,
    'Ein zweiter Lauf am selben Tag storniert nichts mehr - alles traegt schon das heutige Datum');
  return next is(v_ergebnis2.neu, 0,
    'Ein zweiter Lauf am selben Tag legt nichts nach - die Quote steht bereits');
  return next is(v_ergebnis2.aktiv, v_ergebnis.aktiv,
    'Die aktive Zahl bleibt beim zweiten Lauf unveraendert');
  perform set_config('request.jwt.claims', '', true);
end;
$$;
