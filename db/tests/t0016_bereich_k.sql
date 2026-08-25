-- =====================================================================
-- t0016 Bereich K: Protokoll und Rechenannahmen
-- =====================================================================
create schema if not exists velocity_test;
set search_path = velocity_test, velocity, extensions, public;

create or replace function velocity_test.test_k_struktur()
returns setof text language plpgsql as $$
begin
  return next has_table('velocity'::name, 'aenderungsprotokoll'::name,
                        'Tabelle aenderungsprotokoll existiert');
  return next has_table('velocity'::name, 'rechenannahme'::name,
                        'Tabelle rechenannahme existiert');
end;
$$;

create or replace function velocity_test.test_k_protokoll_je_feld()
returns setof text language plpgsql as $$
declare v_k bigint; v_n integer;
begin
  insert into velocity.kunde (email, vorname, nachname)
       values ('k-protokoll@example.org', 'Karl', 'Test') returning kunde_id into v_k;
  delete from velocity.aenderungsprotokoll where tabelle = 'kunde' and datensatz_id = v_k;

  update velocity.kunde set vorname = 'Karla', telefon = '0931 1234'
   where kunde_id = v_k;

  -- GR19: eine Zeile je GEAENDERTEM Feld. Feldweise statt als
  -- JSON-Klumpen, damit die Frage "wer hat je die E-Mail dieses Kunden
  -- geaendert" ohne Werkzeug beantwortbar bleibt.
  select count(*) into v_n from velocity.aenderungsprotokoll
   where tabelle = 'kunde' and datensatz_id = v_k;
  return next is(v_n, 2, 'Zwei geaenderte Felder ergeben zwei Protokollzeilen');

  return next results_eq(
    format($q$ select feld, wert_alt, wert_neu from velocity.aenderungsprotokoll
                where tabelle = 'kunde' and datensatz_id = %s and feld = 'vorname' $q$, v_k),
    $q$ values ('vorname', 'Karl', 'Karla') $q$,
    'Alter und neuer Wert stehen im Protokoll');
end;
$$;

create or replace function velocity_test.test_k_zeitstempel_nicht_protokolliert()
returns setof text language plpgsql as $$
declare v_k bigint; v_n integer;
begin
  insert into velocity.kunde (email, vorname, nachname)
       values ('k-stempel@example.org', 'Kim', 'Test') returning kunde_id into v_k;
  delete from velocity.aenderungsprotokoll where tabelle = 'kunde' and datensatz_id = v_k;
  update velocity.kunde set vorname = 'Kimi' where kunde_id = v_k;
  -- geaendert_am aendert sich bei JEDEM Update. Stuende es im Protokoll,
  -- verdoppelte es jede Zeile ohne einen einzigen Erkenntnisgewinn.
  select count(*) into v_n from velocity.aenderungsprotokoll
   where tabelle = 'kunde' and datensatz_id = v_k and feld in ('erstellt_am','geaendert_am');
  return next is(v_n, 0, 'Audit-Zeitstempel stehen nicht im Aenderungsprotokoll');
end;
$$;

create or replace function velocity_test.test_k_annahmen_ueberschneiden_sich_nicht()
returns setof text language plpgsql as $$
begin
  return next throws_ok(
    $q$ insert into velocity.rechenannahme (code, wert, einheit, gueltigkeit, quelle)
        values ('co2_pkw', 999, 'g/km', daterange(date '2020-01-01', null, '[)'), 'Test') $q$,
    '23P01', null,
    'Ueberschneidende Gueltigkeit derselben Annahme wird abgewiesen');
end;
$$;

create or replace function velocity_test.test_k_annahmen_sind_gesetzt()
returns setof text language plpgsql as $$
begin
  return next results_eq(
    $q$ select code from velocity.rechenannahme where upper_inf(gueltigkeit) order by code $q$,
    $q$ values ('co2_ebike'),('co2_pkw'),('co2_rad'),('umwegfaktor') $q$,
    'Alle vier Rechenannahmen haben eine laufende Periode');
  -- Nicht pruefen, dass keine Zeile ohne Quelle DA ist - das kann keine
  -- sein, quelle ist not null mit CHECK. Pruefen, dass eine solche Zeile
  -- gar nicht erst hineinkommt. Sonst waere die Zusicherung immer wahr.
  return next throws_ok(
    $q$ insert into velocity.rechenannahme (code, wert, einheit, gueltigkeit, quelle)
        values ('test_ohne_quelle', 1, 'x',
                daterange(date '1999-01-01', date '1999-02-01', '[)'), '   ') $q$,
    '23514', null,
    'Eine Annahme ohne Quelle wird abgewiesen');
end;
$$;

create or replace function velocity_test.test_k_protokoll_bei_insert_und_delete()
returns setof text language plpgsql as $$
declare v_k bigint; v_n integer;
begin
  -- Der Trigger ist generisch und faengt alle drei Operationen ab. Bisher
  -- war nur UPDATE geprueft - ausgerechnet bei INSERT und DELETE steht in
  -- fn_protokoll_schreiben aber die heikle Stelle: eine der beiden
  -- jsonb-Seiten ist leer, und v_id muss trotzdem gefunden werden.
  insert into velocity.kunde (email, vorname, nachname)
       values ('k-insert@example.org', 'Kai', 'Test') returning kunde_id into v_k;
  select count(*) into v_n from velocity.aenderungsprotokoll
   where tabelle = 'kunde' and datensatz_id = v_k and aktion = 'INSERT';
  return next cmp_ok(v_n, '>', 0, 'Ein INSERT wird protokolliert');
  return next is(
    (select wert_alt from velocity.aenderungsprotokoll
      where tabelle = 'kunde' and datensatz_id = v_k
        and aktion = 'INSERT' and feld = 'vorname'),
    null, 'Beim INSERT gibt es keinen alten Wert');

  delete from velocity.kunde where kunde_id = v_k;
  select count(*) into v_n from velocity.aenderungsprotokoll
   where tabelle = 'kunde' and datensatz_id = v_k and aktion = 'DELETE';
  return next cmp_ok(v_n, '>', 0,
    'Ein DELETE wird protokolliert - der Satz ist weg, die Spur bleibt');
end;
$$;
