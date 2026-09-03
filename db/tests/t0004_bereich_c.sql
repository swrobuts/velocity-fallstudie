-- =====================================================================
-- t0004 Bereich C: Tarif und Preis
-- =====================================================================
create schema if not exists velocity_test;
set search_path = velocity_test, velocity, extensions, public;

create or replace function velocity_test.test_c_struktur()
returns setof text language plpgsql as $$
begin
  return next has_table('velocity'::name, 'tarif'::name,               'Tabelle tarif existiert');
  return next has_table('velocity'::name, 'tarif_kondition'::name,     'Tabelle tarif_kondition existiert');
  return next has_table('velocity'::name, 'mitgliedschaft'::name,      'Tabelle mitgliedschaft existiert');
  return next has_table('velocity'::name, 'freiminuten_periode'::name, 'Tabelle freiminuten_periode existiert');
  return next has_table('velocity'::name, 'nutzungspreis'::name,       'Tabelle nutzungspreis existiert');
  return next col_type_is('velocity'::name, 'nutzungspreis'::name, 'gueltigkeit'::name,
                          'daterange', 'Preisgueltigkeit ist ein Zeitraumtyp');
  -- Der mutierende Zaehler des Altmodells darf nicht wiederkehren.
  return next hasnt_column('velocity'::name, 'mitgliedschaft'::name, 'freiminuten_aktuell'::name,
                           'mitgliedschaft fuehrt keinen mutierenden Freiminutenzaehler');
end;
$$;

create or replace function velocity_test.test_c_preise_ueberschneidungsfrei()
returns setof text language plpgsql as $$
declare
  v_typ bigint;
begin
  insert into velocity.fahrradtyp (typ_code, bezeichnung) values ('C1', 'Preistestrad')
    returning typ_id into v_typ;

  insert into velocity.nutzungspreis (typ_id, gueltigkeit, startgebuehr, preis_pro_minute, tageshoechstpreis)
       values (v_typ, daterange(date '2026-01-01', date '2026-07-01', '[)'), 1.00, 0.10, 10.00);

  return next lives_ok(
    format($sql$insert into velocity.nutzungspreis
             (typ_id, gueltigkeit, startgebuehr, preis_pro_minute, tageshoechstpreis)
           values (%s, daterange(date '2026-07-01', null, '[)'), 1.20, 0.12, 12.00)$sql$, v_typ),
    'Anschliessender Preiszeitraum ist zulaessig');

  return next throws_ok(
    format($sql$insert into velocity.nutzungspreis
             (typ_id, gueltigkeit, startgebuehr, preis_pro_minute, tageshoechstpreis)
           values (%s, daterange(date '2026-06-01', date '2026-08-01', '[)'), 9.99, 0.99, 99.00)$sql$, v_typ),
    '23P01', null, 'Ueberschneidender Preiszeitraum wird durch EXCLUDE abgewiesen');
end;
$$;

create or replace function velocity_test.test_c_eine_mitgliedschaft_je_zeitpunkt()
returns setof text language plpgsql as $$
declare
  v_kunde bigint;
  v_t1    bigint;
  v_t2    bigint;
begin
  insert into velocity.kunde (email, vorname, nachname)
       values ('c-test@example.org', 'Cara', 'Test') returning kunde_id into v_kunde;
  insert into velocity.tarif (tarif_code, bezeichnung) values ('C-A', 'Tarif A') returning tarif_id into v_t1;
  insert into velocity.tarif (tarif_code, bezeichnung) values ('C-B', 'Tarif B') returning tarif_id into v_t2;

  insert into velocity.mitgliedschaft (kunde_id, tarif_id, gueltigkeit)
       values (v_kunde, v_t1, daterange(date '2026-01-01', date '2026-06-01', '[)'));

  return next throws_ok(
    format($sql$insert into velocity.mitgliedschaft (kunde_id, tarif_id, gueltigkeit)
           values (%s, %s, daterange(date '2026-05-01', null, '[)'))$sql$, v_kunde, v_t2),
    '23P01', null, 'Zwei gleichzeitig gueltige Tarife je Kunde werden abgewiesen');

  return next lives_ok(
    format($sql$insert into velocity.mitgliedschaft (kunde_id, tarif_id, gueltigkeit)
           values (%s, %s, daterange(date '2026-06-01', null, '[)'))$sql$, v_kunde, v_t2),
    'Nahtloser Tarifwechsel ist zulaessig');
end;
$$;

create or replace function velocity_test.test_c_freiminuten_konto()
returns setof text language plpgsql as $$
declare
  v_kunde bigint;
  v_tarif bigint;
  v_mgl   bigint;
begin
  insert into velocity.kunde (email, vorname, nachname)
       values ('c-frei@example.org', 'Frei', 'Minute') returning kunde_id into v_kunde;
  insert into velocity.tarif (tarif_code, bezeichnung, art)
       values ('C-F', 'Freiminutentarif', 'vorteil') returning tarif_id into v_tarif;
  insert into velocity.mitgliedschaft (kunde_id, tarif_id, gueltigkeit)
       values (v_kunde, v_tarif, daterange(date '2026-01-01', null, '[)'))
    returning mitgliedschaft_id into v_mgl;

  insert into velocity.freiminuten_periode (mitgliedschaft_id, jahr, monat, kontingent_minuten)
       values (v_mgl, 2026, 8, 300);

  return next throws_ok(
    format($sql$update velocity.freiminuten_periode set verbraucht_minuten = 301
                 where mitgliedschaft_id = %s$sql$, v_mgl),
    '23514', null, 'Verbrauch ueber dem Kontingent wird abgewiesen');

  return next throws_ok(
    format($sql$insert into velocity.freiminuten_periode
             (mitgliedschaft_id, jahr, monat, kontingent_minuten)
           values (%s, 2026, 8, 100)$sql$, v_mgl),
    '23505', null, 'Je Mitgliedschaft und Monat gibt es genau eine Periode');
end;
$$;

-- =====================================================================
-- Preisschaetzung: die Freigabe steckt in der Tabelle
--
-- Geprueft wird nicht, ob Zeilen da sind - das haengt am Ladelauf -,
-- sondern dass die Tabelle KEINE Zeile aufnehmen kann, die in der App
-- nichts zu suchen haette. Eine fachliche Regel, die nur im Bericht
-- steht, ist keine Regel.
-- =====================================================================
create or replace function velocity_test.test_c_preisschaetzung_grenzen()
returns setof text language plpgsql as $$
begin
  return next has_table('velocity'::name, 'preisschaetzung'::name,
                        'Tabelle preisschaetzung existiert');

  return next throws_ok($q$
    insert into velocity.preisschaetzung
      (startstation, zielstation, typ_code, zeitfenster, minuten_von,
       minuten_bis, preis_von, preis_bis, fahrten_grundlage)
    values ('Hauptbahnhof', 'Hauptbahnhof', 'CITY', 'frueh', 5, 10, 0.60, 1.10, 100) $q$,
    '23514', null, 'Eine Rundfahrt wird abgewiesen - fuer sie gibt es keine Schaetzung');

  return next throws_ok($q$
    insert into velocity.preisschaetzung
      (startstation, zielstation, typ_code, zeitfenster, minuten_von,
       minuten_bis, preis_von, preis_bis, fahrten_grundlage)
    values ('Hauptbahnhof', 'Kaeppele', 'CITY', 'nachmittag', 17, 47, 1.83, 4.79, 200) $q$,
    '23514', null, 'Eine Spanne breiter als 1,00 Euro wird abgewiesen');

  return next throws_ok($q$
    insert into velocity.preisschaetzung
      (startstation, zielstation, typ_code, zeitfenster, minuten_von,
       minuten_bis, preis_von, preis_bis, fahrten_grundlage)
    values ('Hauptbahnhof', 'Hubland', 'CITY', 'frueh', 5, 10, 0.60, 1.10, 12) $q$,
    '23514', null, 'Weniger als 30 Fahrten als Grundlage werden abgewiesen');

  return next throws_ok($q$
    insert into velocity.preisschaetzung
      (startstation, zielstation, typ_code, zeitfenster, minuten_von,
       minuten_bis, preis_von, preis_bis, fahrten_grundlage)
    values ('Hauptbahnhof', 'Hubland', 'CITY', 'mittags', 5, 10, 0.60, 1.10, 100) $q$,
    '23514', null, 'Ein unbekanntes Zeitfenster wird abgewiesen');

  -- Erfundene Stationsnamen: 'Hauptbahnhof -> Hubland' steht nach dem
  -- Ladelauf bereits in der Tabelle und liefe in den Eindeutigkeitsschutz.
  return next lives_ok($q$
    insert into velocity.preisschaetzung
      (startstation, zielstation, typ_code, zeitfenster, minuten_von,
       minuten_bis, preis_von, preis_bis, fahrten_grundlage)
    values ('Pruefstelle A', 'Pruefstelle B', 'CITY', 'frueh', 5, 10, 0.60, 1.10, 316) $q$,
    'Eine freigegebene Kombination wird angenommen');
end;
$$;

create or replace function velocity_test.test_c_preisschaetzer_schalter()
returns setof text language plpgsql as $$
declare v_k bigint; v_uid uuid;
begin
  return next has_column('velocity'::name, 'kunde'::name,
                         'zeigt_preisschaetzer'::name,
                         'Die Einstellung haengt am Konto, nicht am Geraet');

  -- Ein Kunde OHNE auth_uid: velocity.kunde hat einen Fremdschluessel auf
  -- auth.users, und dieses Schema gehoert supabase_auth_admin - die
  -- Fallstudie legt dort nichts an, auch nicht in einem Test.
  insert into velocity.kunde (email, vorname, nachname)
       values ('schalter@example.org', 'Sara', 'Test')
    returning kunde_id into v_k;
  -- Voreinstellung AN, seit dem 03.09.2026. Hier stand bis dahin false,
  -- mit der Begruendung, eine Schaetzung, die niemand bestellt hat,
  -- gehoere nicht auf den Schirm. Das Ergebnis war eine andere: Sie kam
  -- ueberhaupt nie auf einen Schirm. 1013 von 1014 Konten hatten den
  -- Schalter aus, jedes neue ebenfalls, und abgemeldet war der Schaetzer
  -- im Frontend fest abgeschaltet. Ein Merkmal, das man erst finden muss,
  -- um es einzuschalten, wird nicht gefunden.
  --
  -- Der Schalter bleibt, und mit ihm der Vergleich mit und ohne Modell -
  -- nur legt man ihn jetzt zum ABschalten um statt zum Einschalten.
  return next is((select zeigt_preisschaetzer from velocity.kunde where kunde_id = v_k),
                 true,
                 'Voreinstellung an - der Schalter ist zum Abschalten da, '
                 'nicht zum Finden');

  -- Fuer den Schalter selbst brauchen wir eine echte Anmeldung. Wir
  -- nehmen einen vorhandenen Kunden mit auth_uid; gibt es keinen, bleibt
  -- der Teil ungeprueft und sagt das auch.
  select kunde_id, auth_uid into v_k, v_uid
    from velocity.kunde where auth_uid is not null limit 1;
  if v_uid is null then
    return next skip('Kein Kunde mit Anmeldung vorhanden - Schalter ungeprueft', 2);
    return;
  end if;

  perform set_config('request.jwt.claims', json_build_object('sub', v_uid)::text, true);
  perform velocity.api_preisschaetzer_umschalten(true);
  return next is((select zeigt_preisschaetzer from velocity.kunde where kunde_id = v_k),
                 true, 'Einschalten wirkt');
  perform velocity.api_preisschaetzer_umschalten(false);
  return next is((select zeigt_preisschaetzer from velocity.kunde where kunde_id = v_k),
                 false, 'Ausschalten wirkt');
end;
$$;
