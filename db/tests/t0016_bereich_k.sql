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
-- _unloeschbar (db/aufbau/0017_wawi_sicherheit.sql) blieben ungeprueft.
--
-- authenticated hat gar kein GRANT UPDATE/DELETE auf die Basistabelle -
-- das allein wiese jeden Versuch schon mit 42501 ab, bevor die
-- Zeilenregel ueberhaupt zum Zug kaeme. Damit dieser Test wirklich die
-- beiden RLS-Regeln prueft und nicht nur die fehlende Rechtevergabe,
-- gewaehrt er das Recht innerhalb der eigenen, von runtests() per
-- SAVEPOINT zurueckgerollten Transaktion voruebergehend selbst.
--
-- set local role authenticated nach dem Muster von
-- test_l_kundenservice_kennt_keine_zahlungsmittel
-- (db/tests/t0019_wawi_logik.sql): db/test.py verbindet sich als
-- postgres, und Tabelleneigentuemer plus BYPASSRLS umgehen RLS
-- vollstaendig, FORCE ROW LEVEL SECURITY hin oder her - genau das war
-- der Grund, warum das DELETE in t0016 Zeile 22 (siehe oben) bislang
-- unbemerkt gegen dieselben Regeln verstiess, die hier jetzt geprueft
-- werden.
--
-- Ein angemeldeter Mitarbeiter ist noetig, nicht nur ein GRANT: ein
-- UPDATE/DELETE muss die Zielzeile erst SEHEN, bevor seine eigene Regel
-- ueberhaupt zum Zug kommt, und dafuer gilt zusaetzlich die SELECT-Policy
-- aenderungsprotokoll_mitarbeiter_lesen (velocity.ist_mitarbeiter()). Ohne
-- Mitarbeiter-Vorrichtung waere die Zeile fuer authenticated unsichtbar
-- und jeder Versuch schluege mit 0 betroffenen Zeilen fehl, ganz gleich,
-- ob unveraenderlich_/unloeschbar wirken oder nicht - der Test haette
-- nichts geprueft.
--
-- Die eigentliche Schaerfung ist die GEGENPROBE weiter unten: eine
-- using(false)-Regel, die permissiv (der CREATE-POLICY-Standard) statt
-- restriktiv angelegt ist, blockiert genauso lange nichts, wie sich
-- niemand traut, daneben eine zweite permissive Regel anzulegen -
-- permissive Regeln werden mit ODER verknuepft, und using(false) OR
-- using(true) ist using(true). Der erste Testteil (ohne Gegenprobe)
-- haette also selbst dann 0 betroffene Zeilen gemeldet, wenn
-- unveraenderlich_/unloeschbar noch permissiv waeren - er pruefte nur den
-- IST-Zustand, nicht die Regel selbst. Die Gegenprobe legt testweise eine
-- zusaetzliche permissive Regel `using (true)` an: bleibt es danach immer
-- noch bei 0 Zeilen, ist die bestehende Regel tatsaechlich restriktiv;
-- ginge der Zugriff durch, waere sie nur eine von mehreren permissiven
-- Regeln gewesen und haette gar nichts erzwungen. Genau diesen Unterschied
-- konnte der Test bisher nicht sehen (Gesamtpruefung, Befund zu 0017).
create or replace function velocity_test.test_k_protokoll_unveraenderlich()
returns setof text language plpgsql as $$
declare v_k bigint; v_alt text; v_n integer; v_uid uuid := gen_random_uuid();
begin
  insert into velocity.kunde (email, vorname, nachname)
       values ('k-unveraenderlich@example.org', 'Uwe', 'Test') returning kunde_id into v_k;
  update velocity.kunde set vorname = 'Ulf' where kunde_id = v_k;

  select wert_alt into v_alt from velocity.aenderungsprotokoll
   where tabelle = 'kunde' and datensatz_id = v_k and feld = 'vorname' and aktion = 'UPDATE';
  return next ok(v_alt is not null, 'Vorrichtung: es gibt eine Protokollzeile zum Manipulieren');

  -- Vorrichtung: ein angemeldeter Mitarbeiter, damit die SELECT-Policy
  -- die Zeile ueberhaupt sichtbar macht (siehe oben).
  insert into velocity.mitarbeiter (personalnummer, auth_uid, vorname, nachname, email)
       values ('K-UNVERAENDERLICH', v_uid, 'Petra', 'Test', 'k-unveraenderlich-mit@example.org');
  perform set_config('request.jwt.claims', json_build_object('sub', v_uid)::text, true);

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

  -- Gegenprobe: legt eine zusaetzliche PERMISSIVE Regel `using (true)` an.
  -- Waeren unveraenderlich_/unloeschbar selbst nur permissiv (der
  -- CREATE-POLICY-Standard), wuerde diese Zusatzregel sie per ODER
  -- ueberstimmen und der Zugriff ginge durch - genau das hat der Pruefer
  -- experimentell belegt. Nur als AS RESTRICTIVE angelegt (UND-Verknuepfung,
  -- db/aufbau/0017_wawi_sicherheit.sql) bleibt es bei 0 Zeilen.
  create policy gegenprobe_permissiv_update on velocity.aenderungsprotokoll
    for update using (true);
  create policy gegenprobe_permissiv_delete on velocity.aenderungsprotokoll
    for delete using (true);

  set local role authenticated;

  update velocity.aenderungsprotokoll set wert_alt = 'Faelschung'
   where tabelle = 'kunde' and datensatz_id = v_k and feld = 'vorname' and aktion = 'UPDATE';
  get diagnostics v_n = row_count;
  return next is(v_n, 0,
    'Gegenprobe UPDATE: eine zusaetzliche permissive Regel using(true) darf '
    'aenderungsprotokoll_unveraenderlich nicht ueberstimmen - nur AS RESTRICTIVE '
    'verknuepft mit UND statt ODER');

  delete from velocity.aenderungsprotokoll
   where tabelle = 'kunde' and datensatz_id = v_k and feld = 'vorname' and aktion = 'UPDATE';
  get diagnostics v_n = row_count;
  return next is(v_n, 0,
    'Gegenprobe DELETE: eine zusaetzliche permissive Regel using(true) darf '
    'aenderungsprotokoll_unloeschbar nicht ueberstimmen - nur AS RESTRICTIVE '
    'verknuepft mit UND statt ODER');

  reset role;
  drop policy gegenprobe_permissiv_update on velocity.aenderungsprotokoll;
  drop policy gegenprobe_permissiv_delete on velocity.aenderungsprotokoll;
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
  -- max_fahrzeit_je_tag kam am 05.09.2026 dazu: Tagesdeckel fuer den
  -- dritten Fall der Kilometer-Herleitung in velocity.v_fahrt_kennzahl
  -- (db/aufbau/0018_wawi_sichten.sql), siehe dort fuer die Begruendung.
  -- fahrt_deckel_minuten_wartung kam am 05.09.2026 dazu: Obergrenze der
  -- Fahrzeit EINER Fahrt in velocity.fn_wartungsprognose
  -- (db/aufbau/0021_wartungsprognose.sql). Bis dahin stand die Zahl als
  -- blosse 300 im Rumpf der Funktion - ohne Einheit, ohne Quelle, ohne
  -- Gueltigkeit und nur durch Aendern von SQL zu bewegen.
  return next results_eq(
    $q$ select code from velocity.rechenannahme where upper_inf(gueltigkeit) order by code $q$,
    $q$ values ('co2_ebike'),('co2_pkw'),('co2_rad'),
              ('fahrt_deckel_minuten_wartung'),('max_fahrzeit_je_tag'),
              ('reisegeschwindigkeit'),('umwegfaktor') $q$,
    'Alle sieben Rechenannahmen haben eine laufende Periode');

  -- Die Einheit ist hier keine Zierde. Zwei Annahmen deckeln Fahrzeit:
  -- max_fahrzeit_je_tag in STUNDEN je Kalendertag, fahrt_deckel_minuten_wartung
  -- in MINUTEN je Fahrt. Wer den einen Wert in die andere Rechnung
  -- schriebe, bekaeme eine Liste, die plausibel aussieht und um den
  -- Faktor 60 danebenliegt.
  return next is(
    (select einheit from velocity.rechenannahme
      where code = 'fahrt_deckel_minuten_wartung' and upper_inf(gueltigkeit)),
    'min'::text, 'Der Fahrtdeckel der Wartungsprognose steht in Minuten');
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
