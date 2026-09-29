-- =====================================================================
-- t0027 Meldungseingang (0026_jev_meldungseingang.sql)
--
-- Geprüft wird, was die Anbindung zusichert: Das Labor ist von außen
-- unerreichbar, die Schreibrolle darf nur einfügen, die Werkstatt sieht
-- nur freigegebene Läufe, und aus einem Vorschlag wird genau dann eine
-- Schadensmeldung, wenn jemand aus der Werkstatt ihn übernimmt.
-- runtests() rollt jede Testfunktion zurück; die Vorrichtungen bleiben
-- nicht in der Datenbank.
-- =====================================================================
create schema if not exists velocity_test;
set search_path = velocity_test, velocity, extensions, public;

-- Vorrichtung: ein Lauf mit einer Meldung zu einem vorhandenen Rad.
-- p_freigeben entscheidet, ob der Lauf in der Warenwirtschaft erscheint.
create or replace function velocity_test.fixture_jev_vorschlag(p_suffix text, p_freigeben boolean)
returns bigint language plpgsql as $$
declare v_rad bigint; v_lauf bigint;
begin
  select fahrrad_id into v_rad from velocity.fahrrad
   where status = 'verfuegbar' order by fahrrad_id limit 1;

  insert into jev_labor.meldung (meldung_id, fahrrad_id, typ_code, kanal, text, soll_kategorie,
                                 soll_schwere, soll_sicherheitsrelevant, soll_personenschaden,
                                 soll_ist_schaden, merkmal)
       values ('TJ-' || p_suffix, v_rad, 'CITY', 'App', 'Bremse vorne greift kaum.', 'Bremse',
               'fahruntauglich', true, false, true, 'Test');

  insert into jev_labor.lauf (zeitpunkt, modell, regel_version, schwellen, lauf_schluessel,
                              datensatz, fragen_stand, freigegeben_am)
       values (now(), 'test', 'test', '{}'::jsonb, 'test-' || p_suffix, 'meldungen', 1,
               case when p_freigeben then clock_timestamp() end)
    returning lauf_id into v_lauf;

  insert into jev_labor.urteil (lauf_id, meldung_id, modell, ist_schadensmeldung, kategorie,
                                kategorie_konfidenz, kategorie_wkt, schwere_stufe, schwere_score,
                                schwere_konfidenz, schwere_wkt, sicherheitsrelevant,
                                personenschaden, entscheidung, eskalation, begruendung,
                                wawi_kategorie, wawi_schwere)
       values (v_lauf, 'TJ-' || p_suffix, 'test', 0.97, 'Bremse', 1, '{"Bremse": 1}'::jsonb,
               'fahruntauglich', 2, 1, '{"fahruntauglich": 1}'::jsonb, 0.95, 0.03, 'sperren',
               false, 'sicherheitsrelevant 0.95', 'Bremse', 'fahruntauglich');
  return v_lauf;
end;
$$;

-- Vorrichtung: angemeldeter Mitarbeiter mit genau den genannten Rollen.
create or replace function velocity_test.fixture_jev_rollen(p_suffix text, p_codes text[])
returns bigint language plpgsql as $$
declare v_uid uuid := gen_random_uuid(); v_m bigint;
begin
  insert into velocity.mitarbeiter (personalnummer, auth_uid, vorname, nachname, email)
       values ('J-' || p_suffix, v_uid, 'Jana', 'Test', 'j-' || p_suffix || '@example.org')
    returning mitarbeiter_id into v_m;
  insert into velocity.mitarbeiter_rolle (mitarbeiter_id, rolle_id)
  select v_m, rolle_id from velocity.rolle where code = any(p_codes);
  perform set_config('request.jwt.claims', json_build_object('sub', v_uid)::text, true);
  return v_m;
end;
$$;

create or replace function velocity_test.test_j_rechte()
returns setof text language plpgsql as $$
begin
  return next is(has_table_privilege('anon', 'velocity.v_wawi_meldungseingang', 'select'), false,
    'anon liest den Meldungseingang nicht');
  return next is(has_table_privilege('authenticated', 'velocity.v_wawi_meldungseingang', 'select'), true,
    'Angemeldete lesen die Sicht; wer Zeilen sieht, entscheidet hat_rolle');
  return next is(has_table_privilege('authenticated', 'jev_labor.urteil', 'select'), false,
    'Das Labor ist für Angemeldete nicht direkt lesbar');
  return next is(has_table_privilege('anon', 'jev_labor.meldung', 'select'), false,
    'Das Labor ist für anon nicht lesbar');
  return next is(has_table_privilege('authenticated', 'velocity.jev_vorschlag_entscheidung', 'insert'), false,
    'Entscheidungen entstehen nur über die api_-Funktionen');
  return next is(has_table_privilege('jev_schreiber', 'jev_labor.urteil', 'insert'), true,
    'jev_schreiber fügt Urteile ein');
  return next is(has_table_privilege('jev_schreiber', 'jev_labor.urteil', 'update'), false,
    'jev_schreiber ändert keine Urteile');
  return next is(has_column_privilege('jev_schreiber', 'jev_labor.lauf', 'freigegeben_am', 'update'), true,
    'jev_schreiber darf einen Lauf freigeben');
  return next is(has_column_privilege('jev_schreiber', 'jev_labor.lauf', 'modell', 'update'), false,
    'jev_schreiber darf einen Lauf sonst nicht ändern');
  return next is(has_table_privilege('jev_schreiber', 'velocity.schadensmeldung', 'select'), false,
    'jev_schreiber sieht nichts aus dem Betrieb');
  return next is(has_function_privilege('anon',
    'velocity.api_jev_vorschlag_uebernehmen(bigint, text, text, text, text)', 'execute'), false,
    'anon kann keinen Vorschlag übernehmen');
end;
$$;

create or replace function velocity_test.test_j_nur_freigegebene_laeufe()
returns setof text language plpgsql as $$
begin
  perform velocity_test.fixture_jev_vorschlag('sichtbar', true);
  perform velocity_test.fixture_jev_vorschlag('entwurf', false);
  perform velocity_test.fixture_jev_rollen('sicht', array['werkstatt']);

  return next is((select bearbeitung from velocity.v_wawi_meldungseingang where meldung_id = 'TJ-sichtbar'),
    'offen', 'Ein freigegebener Vorschlag erscheint als offen');
  return next is((select count(*)::int from velocity.v_wawi_meldungseingang where meldung_id = 'TJ-entwurf'),
    0, 'Ein nicht freigegebener Lauf erscheint nicht');

  perform set_config('request.jwt.claims', '', true);
  perform velocity_test.fixture_jev_rollen('dispo', array['disposition']);
  return next is((select count(*)::int from velocity.v_wawi_meldungseingang), 0,
    'Die Disposition sieht den Meldungseingang nicht');
  perform set_config('request.jwt.claims', '', true);
end;
$$;

create or replace function velocity_test.test_j_uebernehmen()
returns setof text language plpgsql as $$
declare v_lauf bigint; v_m bigint; v_s bigint;
begin
  v_lauf := velocity_test.fixture_jev_vorschlag('ueber', true);
  v_m := velocity_test.fixture_jev_rollen('ueber', array['werkstatt']);

  return next throws_ok(
    format($q$ select velocity.api_jev_vorschlag_uebernehmen(%s, 'TJ-ueber', 'keine_zuordnung', 'x', 'gering') $q$, v_lauf),
    'P0001', 'Bitte eine Kategorie angeben',
    'keine_zuordnung wird nicht als Kategorie übernommen');

  -- Kategorie und Schwere dürfen vom Vorschlag abweichen: Die Werkstatt
  -- entscheidet, der Vorschlag lautete fahruntauglich.
  v_s := velocity.api_jev_vorschlag_uebernehmen(v_lauf, 'TJ-ueber', 'Bremse', 'Bremse vorne greift kaum.', 'mittel');

  return next is((select kategorie || '/' || schwere::text from velocity.schadensmeldung
                   where schadensmeldung_id = v_s),
    'Bremse/mittel', 'Die Schadensmeldung trägt Kategorie und Schwere der Werkstatt');
  return next is((select melder_mitarbeiter_id from velocity.schadensmeldung where schadensmeldung_id = v_s),
    v_m, 'Gemeldet hat, wer übernommen hat');
  return next is((select bearbeitung || '/' || schadensmeldung_id::text
                    from velocity.v_wawi_meldungseingang where meldung_id = 'TJ-ueber'),
    'uebernommen/' || v_s::text, 'Der Meldungseingang zeigt die Übernahme samt Schadensmeldung');
  return next throws_ok(
    format($q$ select velocity.api_jev_vorschlag_uebernehmen(%s, 'TJ-ueber', 'Bremse', 'x', 'mittel') $q$, v_lauf),
    '23505', null, 'Eine zweite Übernahme derselben Meldung wird abgewiesen');
  perform set_config('request.jwt.claims', '', true);
end;
$$;

create or replace function velocity_test.test_j_verwerfen()
returns setof text language plpgsql as $$
declare v_lauf bigint; v_vorher int;
begin
  v_lauf := velocity_test.fixture_jev_vorschlag('verw', true);
  perform velocity_test.fixture_jev_rollen('verw', array['werkstatt']);
  select count(*) into v_vorher from velocity.schadensmeldung;

  perform velocity.api_jev_vorschlag_verwerfen(v_lauf, 'TJ-verw', 'Kein Schaden am Rad');

  return next is((select bearbeitung from velocity.v_wawi_meldungseingang where meldung_id = 'TJ-verw'),
    'verworfen', 'Der Vorschlag steht als verworfen im Eingang');
  return next is((select count(*)::int from velocity.schadensmeldung), v_vorher,
    'Verwerfen legt keine Schadensmeldung an');
  return next throws_ok(
    format($q$ select velocity.api_jev_vorschlag_uebernehmen(%s, 'TJ-verw', 'Bremse', 'x', 'mittel') $q$, v_lauf),
    '23505', null, 'Ein verworfener Vorschlag lässt sich nicht nachträglich übernehmen');
  perform set_config('request.jwt.claims', '', true);
end;
$$;

create or replace function velocity_test.test_j_nur_werkstatt()
returns setof text language plpgsql as $$
declare v_lauf bigint;
begin
  v_lauf := velocity_test.fixture_jev_vorschlag('rolle', true);
  perform velocity_test.fixture_jev_rollen('rolle', array['leitung']);
  -- Die Leitung sieht den Eingang, entscheidet aber nicht - dieselbe
  -- Rolle, die api_schaden_melden verlangt.
  return next throws_ok(
    format($q$ select velocity.api_jev_vorschlag_verwerfen(%s, 'TJ-rolle', null) $q$, v_lauf),
    '42501', null, 'Ohne Rolle werkstatt keine Entscheidung');

  perform set_config('request.jwt.claims', '', true);
  v_lauf := velocity_test.fixture_jev_vorschlag('entwurf2', false);
  perform velocity_test.fixture_jev_rollen('entwurf2', array['werkstatt']);
  return next throws_ok(
    format($q$ select velocity.api_jev_vorschlag_verwerfen(%s, 'TJ-entwurf2', null) $q$, v_lauf),
    'P0001', null, 'Über einen nicht freigegebenen Lauf wird nicht entschieden');
  perform set_config('request.jwt.claims', '', true);
end;
$$;
