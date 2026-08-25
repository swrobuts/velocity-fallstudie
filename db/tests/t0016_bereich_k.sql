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

  update velocity.kunde set vorname = 'Karla', telefon = '0931 1234'
   where kunde_id = v_k;

  -- GR19: eine Zeile je GEAENDERTEM Feld. Feldweise statt als
  -- JSON-Klumpen, damit die Frage "wer hat je die E-Mail dieses Kunden
  -- geaendert" ohne Werkzeug beantwortbar bleibt.
  --
  -- Gefiltert wird auf aktion = 'UPDATE', nicht mehr auf ein
  -- vorangestelltes DELETE der INSERT-Zeilen: der Trigger schreibt beim
  -- Anlegen des Kunden selbst schon eine Protokollzeile je belegter
  -- Spalte (v_alt = '{}' fuer INSERT). Ein DELETE zum Zuruecksetzen
  -- widersprach ausgerechnet dem Gegenstand dieser Testdatei - dem
  -- Aenderungsprotokoll, das laut GR19/Art. 5 Abs. 2 DSGVO unveraenderlich
  -- sein soll (siehe test_k_protokoll_unveraenderlich unten) - und
  -- gelang nur, weil db/test.py als postgres mit BYPASSRLS verbindet.
  select count(*) into v_n from velocity.aenderungsprotokoll
   where tabelle = 'kunde' and datensatz_id = v_k and aktion = 'UPDATE';
  return next is(v_n, 2, 'Zwei geaenderte Felder ergeben zwei Protokollzeilen');

  return next results_eq(
    format($q$ select feld, wert_alt, wert_neu from velocity.aenderungsprotokoll
                where tabelle = 'kunde' and datensatz_id = %s and feld = 'vorname'
                  and aktion = 'UPDATE' $q$, v_k),
    $q$ values ('vorname', 'Karl', 'Karla') $q$,
    'Alter und neuer Wert stehen im Protokoll');
end;
$$;

-- Gesamtpruefung Punkt 8: die Unveraenderlichkeit des Aenderungsprotokolls
-- (Art. 5 Abs. 2 DSGVO, Rechenschaftspflicht) hatte keinen eigenen Test.
-- Die beiden Regeln aenderungsprotokoll_unveraenderlich und
-- _unloeschbar (db/aufbau/0017_wawi_sicherheit.sql, using (false))
-- blieben ungeprueft.
--
-- authenticated hat gar kein GRANT UPDATE/DELETE auf die Basistabelle -
-- das allein wiese jeden Versuch schon mit 42501 ab, bevor die
-- Zeilenregel ueberhaupt zum Zug kaeme. Damit dieser Test wirklich die
-- beiden RLS-Regeln prueft und nicht nur die fehlende Rechtevergabe,
-- gewaehrt er das Recht innerhalb der eigenen, von runtests() per
-- SAVEPOINT zurueckgerollten Transaktion voruebergehend selbst - und
-- zeigt so, dass selbst MIT dem Tabellenrecht kein Vorgang durchkommt:
-- using (false) laesst keine Zeile passieren, betroffen sind 0 Zeilen,
-- kein Fehler.
--
-- set local role authenticated nach dem Muster von
-- test_l_kundenservice_kennt_keine_zahlungsmittel
-- (db/tests/t0019_wawi_logik.sql): db/test.py verbindet sich als
-- postgres, und Tabelleneigentuemer plus BYPASSRLS umgehen RLS
-- vollstaendig, FORCE ROW LEVEL SECURITY hin oder her - genau das war
-- der Grund, warum das DELETE in t0016 Zeile 22 (siehe oben) bislang
-- unbemerkt gegen dieselben Regeln verstiess, die hier jetzt geprueft
-- werden.
create or replace function velocity_test.test_k_protokoll_unveraenderlich()
returns setof text language plpgsql as $$
declare v_k bigint; v_alt text; v_n integer;
begin
  insert into velocity.kunde (email, vorname, nachname)
       values ('k-unveraenderlich@example.org', 'Uwe', 'Test') returning kunde_id into v_k;
  update velocity.kunde set vorname = 'Ulf' where kunde_id = v_k;

  select wert_alt into v_alt from velocity.aenderungsprotokoll
   where tabelle = 'kunde' and datensatz_id = v_k and feld = 'vorname' and aktion = 'UPDATE';
  return next ok(v_alt is not null, 'Vorrichtung: es gibt eine Protokollzeile zum Manipulieren');

  -- SELECT gehoert mit in den Grant, nicht nur UPDATE/DELETE: ein UPDATE
  -- oder DELETE mit einer WHERE-Bedingung, die Spalten NENNT (statt
  -- einer Konstanten wie "where false"), braucht laut PostgreSQL auch
  -- SELECT auf genau diese Spalten, um die Bedingung ueberhaupt
  -- auszuwerten - sonst scheitert der Versuch schon an "permission
  -- denied for table", bevor die Zeilenregel je zum Zug kommt. Ohne
  -- diese drei Zeilen haette der Test also wieder nur die fehlende
  -- Rechtevergabe geprueft, nicht die beiden RLS-Regeln (nachgemessen).
  grant select, update, delete on velocity.aenderungsprotokoll to authenticated;
  set local role authenticated;

  update velocity.aenderungsprotokoll set wert_alt = 'Faelschung'
   where tabelle = 'kunde' and datensatz_id = v_k and feld = 'vorname' and aktion = 'UPDATE';
  get diagnostics v_n = row_count;
  return next is(v_n, 0,
    'aenderungsprotokoll_unveraenderlich laesst kein UPDATE durch (GR19, Art. 5 Abs. 2 DSGVO)');

  delete from velocity.aenderungsprotokoll
   where tabelle = 'kunde' and datensatz_id = v_k and feld = 'vorname' and aktion = 'UPDATE';
  get diagnostics v_n = row_count;
  return next is(v_n, 0,
    'aenderungsprotokoll_unloeschbar laesst kein DELETE durch (GR19, Art. 5 Abs. 2 DSGVO)');

  reset role;

  return next is(
    (select wert_alt from velocity.aenderungsprotokoll
      where tabelle = 'kunde' and datensatz_id = v_k and feld = 'vorname' and aktion = 'UPDATE'),
    v_alt, 'Die Zeile ist unveraendert - beide Aenderungsversuche haben nichts bewirkt');
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
    $q$ values ('co2_ebike'),('co2_pkw'),('co2_rad'),('reisegeschwindigkeit'),('umwegfaktor') $q$,
    'Alle fuenf Rechenannahmen haben eine laufende Periode');
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
