-- =====================================================================
-- t0023 Vollstaendiges Loeschen eines Kunden
--
-- Geprueft wird die HUERDE, nicht das Loeschen: Dass ein delete eine
-- Zeile entfernt, ist Postgres. Interessant ist, ob die Funktion sich
-- weigert, sobald ein Beleg daranhaengt - und zwar bei jedem der vier
-- Faelle einzeln, nicht nur beim ersten.
-- =====================================================================
create schema if not exists velocity_test;
set search_path = velocity_test, velocity, extensions, public;

-- Ein Kunde ohne jeden Beleg, dazu eine eigene Adresse.
create or replace function velocity_test.fixture_loeschkunde(p_suffix text)
returns bigint language plpgsql as $$
declare v_adresse bigint; v_kunde bigint;
begin
  insert into velocity.adresse (strasse, hausnummer, plz, ort)
       values ('Loeschweg', p_suffix, '97070', 'Wuerzburg')
    returning adresse_id into v_adresse;
  insert into velocity.kunde (email, vorname, nachname, rechnungsadresse_id)
       values ('loesch-' || p_suffix || '@example.org', 'Lea', 'Loesch', v_adresse)
    returning kunde_id into v_kunde;
  return v_kunde;
end;
$$;

create or replace function velocity_test.test_l_ohne_beleg_wird_geloescht()
returns setof text language plpgsql as $$
declare v_kunde bigint; v_adresse bigint; v_n bigint;
begin
  perform velocity_test.fixture_rollen('loesch-frei', array['kundenservice']);
  v_kunde := velocity_test.fixture_loeschkunde('frei');
  select rechnungsadresse_id into v_adresse from velocity.kunde where kunde_id = v_kunde;

  perform velocity.api_kunde_loeschen(v_kunde, 'Antrag nach Art. 17, kein Beleg');

  select count(*) into v_n from velocity.kunde where kunde_id = v_kunde;
  return next is(v_n, 0::bigint, 'Der Kundensatz ist weg - nicht anonymisiert, weg');

  -- Die Adresse gehoerte nur ihm und geht mit. Bliebe sie stehen, waere
  -- die Loeschung unvollstaendig: eine Anschrift ist ein Personendatum.
  select count(*) into v_n from velocity.adresse where adresse_id = v_adresse;
  return next is(v_n, 0::bigint, 'Die allein benutzte Rechnungsadresse geht mit');

  perform set_config('request.jwt.claims', '', true);
end;
$$;

create or replace function velocity_test.test_l_protokoll_ist_bereinigt()
returns setof text language plpgsql as $$
declare v_kunde bigint; v_rest bigint; v_vermerk bigint;
begin
  perform velocity_test.fixture_rollen('loesch-prot', array['kundenservice']);
  v_kunde := velocity_test.fixture_loeschkunde('prot');
  -- Eine Aenderung VOR dem Loeschen, damit das Protokoll einen alten
  -- Wert traegt, der hinterher nicht mehr dastehen darf.
  update velocity.kunde set telefon = '0931-123456' where kunde_id = v_kunde;

  perform velocity.api_kunde_loeschen(v_kunde, 'Antrag nach Art. 17');

  -- KEIN Feldwert dieses Kunden steht mehr im Klartext im Protokoll.
  -- Der DELETE selbst schreibt die alten Werte noch einmal hinein -
  -- deshalb bereinigt die Funktion NACH dem Loeschen, nicht vorher.
  select count(*) into v_rest from velocity.aenderungsprotokoll
   where tabelle = 'kunde' and datensatz_id = v_kunde
     and (wert_alt is not null and wert_alt not in ('[geloescht]', '[anonymisiert]')
       or wert_neu is not null and wert_neu not in ('[geloescht]', '[anonymisiert]',
                                                    'Antrag nach Art. 17'));
  return next is(v_rest, 0::bigint,
    'Kein Klartextwert dieses Kunden steht mehr im Protokoll');

  -- Der Vorgang selbst bleibt nachweisbar. Eine Loeschung, die keine
  -- Spur hinterlaesst, ist von einem Datenverlust nicht zu unterscheiden.
  select count(*) into v_vermerk from velocity.aenderungsprotokoll
   where tabelle = 'kunde' and datensatz_id = v_kunde and feld = 'geloescht';
  return next cmp_ok(v_vermerk, '>', 0::bigint,
    'Ein Vermerk ueber die Loeschung bleibt stehen, mit Grund');

  perform set_config('request.jwt.claims', '', true);
end;
$$;

create or replace function velocity_test.test_l_beleg_verhindert_loeschen()
returns setof text language plpgsql as $$
declare v_kunde bigint; v_f record;
begin
  perform velocity_test.fixture_rollen('loesch-beleg', array['kundenservice']);

  -- Fall 1: eine Fahrt. fixture_rad legt Kunde und Rad zusammen an.
  select * into v_f from velocity_test.fixture_rad('loesch-fahrt');
  insert into velocity.ausleihe (kunde_id, fahrrad_id, start_latitude, start_longitude,
                                 startzeit, endzeit, status, end_latitude, end_longitude)
       values (v_f.o_kunde_id, v_f.o_fahrrad_id, 49.79, 9.93,
               now() - interval '2 days', now() - interval '2 days' + interval '20 min',
               'abgeschlossen', 49.795, 9.935);
  return next throws_ok(
    format('select velocity.api_kunde_loeschen(%s, %L)', v_f.o_kunde_id, 'Versuch'),
    'P0001', null, 'Eine Fahrt verhindert das Loeschen');

  -- Fall 2: eine Mitgliedschaft, sonst nichts.
  v_kunde := velocity_test.fixture_loeschkunde('mitglied');
  -- gueltigkeit ist ein Zeitraum, kein Startdatum - die Tabelle fuehrt
  -- ihre Laufzeit als daterange (nachgesehen, nicht vermutet).
  insert into velocity.mitgliedschaft (kunde_id, tarif_id, gueltigkeit)
  select v_kunde, t.tarif_id, daterange(current_date - 30, null)
    from velocity.tarif t limit 1;
  return next throws_ok(
    format('select velocity.api_kunde_loeschen(%s, %L)', v_kunde, 'Versuch'),
    'P0001', null, 'Eine Mitgliedschaft verhindert das Loeschen');

  perform set_config('request.jwt.claims', '', true);
end;
$$;

create or replace function velocity_test.test_l_ohne_rolle_und_ohne_grund()
returns setof text language plpgsql as $$
declare v_kunde bigint;
begin
  perform velocity_test.fixture_rollen('loesch-grund', array['kundenservice']);
  v_kunde := velocity_test.fixture_loeschkunde('grund');
  -- Ein Grund ist Pflicht: Er ist das Einzige, was hinterher noch sagt,
  -- WARUM eine Zeile fehlt.
  return next throws_ok(
    format('select velocity.api_kunde_loeschen(%s, %L)', v_kunde, '  '),
    '22023', null, 'Ohne Grund wird nicht geloescht');
  perform set_config('request.jwt.claims', '', true);

  -- Und ohne die Rolle gar nicht.
  perform velocity_test.fixture_rollen('loesch-ohnerolle', array[]::text[]);
  return next throws_ok(
    format('select velocity.api_kunde_loeschen(%s, %L)', v_kunde, 'Versuch'),
    null, null, 'Ohne die Rolle kundenservice wird nicht geloescht');
  perform set_config('request.jwt.claims', '', true);
end;
$$;
