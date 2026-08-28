-- =====================================================================
-- t0003 Bereich B: Netz und Flotte
-- =====================================================================
create schema if not exists velocity_test;
set search_path = velocity_test, velocity, extensions, public;

create or replace function velocity_test.test_b_struktur()
returns setof text language plpgsql as $$
begin
  return next has_table('velocity'::name, 'station'::name,            'Tabelle station existiert');
  return next has_table('velocity'::name, 'fahrradtyp'::name,         'Tabelle fahrradtyp existiert');
  return next has_table('velocity'::name, 'fahrradtyp_merkmal'::name, 'Tabelle fahrradtyp_merkmal existiert');
  return next has_table('velocity'::name, 'hersteller'::name,         'Tabelle hersteller existiert');
  return next has_table('velocity'::name, 'fahrradmodell'::name,      'Tabelle fahrradmodell existiert');
  return next has_table('velocity'::name, 'fahrrad'::name,            'Tabelle fahrrad existiert');
  return next has_table('velocity'::name, 'fahrrad_position'::name,   'Tabelle fahrrad_position existiert');

  -- Preise gehoeren nicht an den Typ, sondern in die historisierte
  -- Preistabelle aus Schritt 0004.
  return next hasnt_column('velocity'::name, 'fahrradtyp'::name, 'preis_pro_minute'::name,
                           'fahrradtyp traegt keinen Preis');
  return next hasnt_column('velocity'::name, 'fahrradtyp'::name, 'startgebuehr'::name,
                           'fahrradtyp traegt keine Startgebuehr');
  -- Koordinaten gehoeren an die Position, nicht an das Stammdatum.
  return next hasnt_column('velocity'::name, 'fahrrad'::name, 'latitude'::name,
                           'fahrrad traegt keine Koordinaten');

  return next col_is_pk('velocity'::name, 'fahrrad_position'::name, 'fahrrad_id'::name,
                        'fahrrad_position ist ueber den Fahrradschluessel 1:1 angebunden');
  return next fk_ok('velocity'::name, 'fahrrad'::name, 'modell_id'::name,
                    'velocity'::name, 'fahrradmodell'::name, 'modell_id'::name,
                    'fahrrad verweist auf fahrradmodell');
  return next fk_ok('velocity'::name, 'fahrradmodell'::name, 'typ_id'::name,
                    'velocity'::name, 'fahrradtyp'::name, 'typ_id'::name,
                    'fahrradmodell verweist auf fahrradtyp');
end;
$$;

create or replace function velocity_test.test_b_regeln()
returns setof text language plpgsql as $$
declare
  v_typ     bigint;
  v_herst   bigint;
  v_modell  bigint;
  v_rad     bigint;
begin
  insert into velocity.fahrradtyp (typ_code, bezeichnung, hat_elektro)
       values ('TEST', 'Testrad', false) returning typ_id into v_typ;
  insert into velocity.hersteller (name) values ('Testhersteller') returning hersteller_id into v_herst;
  insert into velocity.fahrradmodell (hersteller_id, typ_id, modellbezeichnung, baujahr)
       values (v_herst, v_typ, 'T1', 2026) returning modell_id into v_modell;
  insert into velocity.fahrrad (rahmennummer, modell_id) values ('RN-TEST-1', v_modell)
    returning fahrrad_id into v_rad;

  return next is((select status::text from velocity.fahrrad where fahrrad_id = v_rad),
                 'verfuegbar', 'Neues Fahrrad ist standardmaessig verfuegbar');

  return next throws_ok(
    $sql$insert into velocity.station (stationsnummer, name, plz_platzhalter)
         values ('X', 'Y', 'Z')$sql$,
    '42703', null, 'Station hat keine Adressspalten, sondern einen Adressverweis');

  return next throws_ok(
    format($sql$insert into velocity.fahrrad_position (fahrrad_id, akkustand_prozent)
                values (%s, 150)$sql$, v_rad),
    '23514', null, 'Akkustand ueber 100 Prozent wird abgewiesen');

  return next lives_ok(
    format($sql$insert into velocity.fahrrad_position (fahrrad_id, latitude, longitude)
                values (%s, 49.7913, 9.9534)$sql$, v_rad),
    'Freie Position ohne Station ist zulaessig (Free-Floating)');
end;
$$;

create or replace function velocity_test.test_b_kapazitaet()
returns setof text language plpgsql as $$
declare
  v_adr bigint;
begin
  insert into velocity.adresse (strasse, hausnummer, plz, ort)
       values ('Bahnhofstrasse', '1', '97070', 'Wuerzburg') returning adresse_id into v_adr;

  return next throws_ok(
    format($sql$insert into velocity.station (stationsnummer, name, adresse_id, kapazitaet)
                values ('S-TEST', 'Teststation', %s, 0)$sql$, v_adr),
    '23514', null, 'Station mit Kapazitaet 0 wird abgewiesen');
end;
$$;

-- =====================================================================
--  GR13: WO STEHT DAS RAD?
--
--  Drei Zustaende, kein vierter: an einer Station, frei im Stadtgebiet,
--  oder in Fahrt und damit nirgends. Der erste Teil steht als CHECK in
--  der Tabelle, der zweite als Constraint-Trigger - er braucht den
--  Status des Rades, und der liegt woanders.
--
--  Der Trigger ist initially deferred und feuert damit erst beim
--  Commit. pgTAP rollt jeden Test zurueck, also wuerde er nie
--  ausloesen. Die Tests erzwingen ihn deshalb mit
--  set constraints all immediate.
-- =====================================================================

create or replace function velocity_test.fixture_rad_ort(p_suffix text)
returns table (o_fahrrad_id bigint, o_station_id bigint)
language plpgsql as $$
declare
  v_typ bigint; v_h bigint; v_m bigint; v_ad bigint;
begin
  insert into velocity.adresse (strasse, plz, ort) values ('Ortstr', '97070', 'Würzburg')
    returning adresse_id into v_ad;
  insert into velocity.station (stationsnummer, name, adresse_id, kapazitaet)
       values ('S-O' || p_suffix, 'Ortstation ' || p_suffix, v_ad, 10)
    returning station_id into o_station_id;
  insert into velocity.fahrradtyp (typ_code, bezeichnung)
       values ('O-' || p_suffix, 'Ortstestrad ' || p_suffix) returning typ_id into v_typ;
  insert into velocity.hersteller (name) values ('Ortshersteller ' || p_suffix)
    returning hersteller_id into v_h;
  insert into velocity.fahrradmodell (hersteller_id, typ_id, modellbezeichnung)
       values (v_h, v_typ, 'OM-' || p_suffix) returning modell_id into v_m;
  insert into velocity.fahrrad (rahmennummer, modell_id) values ('RN-O-' || p_suffix, v_m)
    returning fahrrad_id into o_fahrrad_id;
  return next;
end;
$$;

create or replace function velocity_test.test_b_ort_nie_beides()
returns setof text language plpgsql as $$
declare
  v_f record;
begin
  select * into v_f from velocity_test.fixture_rad_ort('1');

  return next throws_ok(
    format($sql$insert into velocity.fahrrad_position (fahrrad_id, station_id, latitude, longitude)
                values (%s, %s, 49.79, 9.93)$sql$, v_f.o_fahrrad_id, v_f.o_station_id),
    '23514', null, 'Station UND Koordinaten zugleich wird abgewiesen');

  return next throws_ok(
    format($sql$insert into velocity.fahrrad_position (fahrrad_id, latitude)
                values (%s, 49.79)$sql$, v_f.o_fahrrad_id),
    '23514', null, 'Ein halbes Koordinatenpaar wird abgewiesen');

  return next lives_ok(
    format($sql$insert into velocity.fahrrad_position (fahrrad_id, station_id)
                values (%s, %s)$sql$, v_f.o_fahrrad_id, v_f.o_station_id),
    'An einer Station ohne Koordinaten wird angenommen');
end;
$$;

create or replace function velocity_test.test_b_ort_frei_erlaubt()
returns setof text language plpgsql as $$
declare
  v_f record;
begin
  select * into v_f from velocity_test.fixture_rad_ort('2');
  return next lives_ok(
    format($sql$insert into velocity.fahrrad_position (fahrrad_id, latitude, longitude)
                values (%s, 49.79, 9.93)$sql$, v_f.o_fahrrad_id),
    'Frei im Stadtgebiet mit Koordinaten wird angenommen');
end;
$$;

create or replace function velocity_test.test_b_verfuegbar_braucht_standort()
returns setof text language plpgsql as $$
declare
  v_f record;
begin
  select * into v_f from velocity_test.fixture_rad_ort('3');
  insert into velocity.fahrrad_position (fahrrad_id) values (v_f.o_fahrrad_id);

  -- Das Rad ist verfuegbar, hat aber keinen Standort. Der Trigger ist
  -- aufgeschoben, also erzwingen wir die Pruefung.
  begin
    set constraints all immediate;
    return next fail('Ein verfuegbares Rad ohne Standort haette abgewiesen werden muessen');
  exception when check_violation then
    return next pass('Ein verfuegbares Rad ohne Standort wird abgewiesen');
  end;
end;
$$;

create or replace function velocity_test.test_b_ausgeliehen_ohne_standort()
returns setof text language plpgsql as $$
declare
  v_f record;
begin
  select * into v_f from velocity_test.fixture_rad_ort('4');
  insert into velocity.fahrrad_position (fahrrad_id, station_id)
       values (v_f.o_fahrrad_id, v_f.o_station_id);
  update velocity.fahrrad set status = 'ausgeliehen' where fahrrad_id = v_f.o_fahrrad_id;

  -- Ein Rad in Fahrt steht nirgends. Ein Ort waere eine Luege.
  begin
    set constraints all immediate;
    return next fail('Ein ausgeliehenes Rad mit Standort haette abgewiesen werden muessen');
  exception when check_violation then
    return next pass('Ein ausgeliehenes Rad darf keinen Standort tragen');
  end;
end;
$$;

create or replace function velocity_test.test_b_ort_erst_beim_commit()
returns setof text language plpgsql as $$
declare
  v_f record; v_pos velocity.fahrrad_position%rowtype;
begin
  select * into v_f from velocity_test.fixture_rad_ort('5');
  insert into velocity.fahrrad_position (fahrrad_id, station_id)
       values (v_f.o_fahrrad_id, v_f.o_station_id);

  -- Genau dafuer ist der Trigger aufgeschoben: zwischen diesen beiden
  -- Anweisungen ist der Zustand notwendig widerspruechlich. Waere er
  -- immediate, koennte fn_ausleihe_starten seine Arbeit nicht tun.
  update velocity.fahrrad set status = 'ausgeliehen' where fahrrad_id = v_f.o_fahrrad_id;
  update velocity.fahrrad_position
     set station_id = null, latitude = null, longitude = null
   where fahrrad_id = v_f.o_fahrrad_id;

  return next lives_ok('set constraints all immediate',
    'Zwischenzustand in einer Transaktion ist erlaubt, das Ergebnis zaehlt');
  -- Zurueckstellen: set constraints gilt fuer die ganze Transaktion, und
  -- pgTAP faehrt alle Testfunktionen in genau einer. Ohne das hier
  -- pruefte jeder folgende Test sofort statt beim Commit.
  set constraints all deferred;

  select * into v_pos from velocity.fahrrad_position where fahrrad_id = v_f.o_fahrrad_id;
  return next ok(v_pos.station_id is null and v_pos.latitude is null,
                 'Nach dem Start traegt das Rad keinen Standort mehr');
end;
$$;

create or replace function velocity_test.test_b_station_mit_raedern_nicht_loeschbar()
returns setof text language plpgsql as $$
declare
  v_f record;
begin
  select * into v_f from velocity_test.fixture_rad_ort('6');
  insert into velocity.fahrrad_position (fahrrad_id, station_id)
       values (v_f.o_fahrrad_id, v_f.o_station_id);

  -- Mit on delete set null waere aus dem abgestellten Rad eines ohne
  -- bekannten Standort geworden.
  return next throws_ok(
    format($sql$delete from velocity.station where station_id = %s$sql$, v_f.o_station_id),
    '23503', null, 'Eine Station mit abgestellten Raedern laesst sich nicht loeschen');
end;
$$;

-- Trifft den Trigger selbst, ohne den Umweg ueber eine api_-Funktion:
-- Positionszeile loeschen, Status aendern. Genau diese Kombination war
-- die gemessene Luecke (M-0001) - erreichbar ueber api_rad_ausmustern,
-- das die Positionszeile absichtlich loescht, gefolgt von
-- api_rad_status_setzen(..., 'verfuegbar'). Ein Test, der nur die beiden
-- api_-Funktionen durchspielt, wuerde die naechste Regression nicht
-- bemerken, wenn irgendwann ein dritter Weg an api_rad_status_setzen
-- vorbeischreibt - deshalb hier zusaetzlich direkt gegen die Tabellen.
create or replace function velocity_test.test_b_position_geloescht_bleibt_pflicht()
returns setof text language plpgsql as $$
declare
  v_f record;
begin
  select * into v_f from velocity_test.fixture_rad_ort('7');
  insert into velocity.fahrrad_position (fahrrad_id, station_id)
       values (v_f.o_fahrrad_id, v_f.o_station_id);

  -- Die Positionszeile verschwindet komplett - nicht nur ihr Ort wird
  -- geleert. Vor der Korrektur liess "if not found then return null" den
  -- Trigger hier klaglos aussteigen.
  delete from velocity.fahrrad_position where fahrrad_id = v_f.o_fahrrad_id;
  update velocity.fahrrad set status = 'verfuegbar' where fahrrad_id = v_f.o_fahrrad_id;

  begin
    set constraints all immediate;
    return next fail('Ein Rad ohne jede Positionszeile und mit Status verfuegbar haette abgewiesen werden muessen');
  exception when check_violation then
    return next pass('Eine geloeschte Positionszeile ersetzt keinen Standort - GR13 greift weiterhin');
  end;
  set constraints all deferred;
end;
$$;

-- Gesamtpruefung 26.08.2026, Befund "GR13 hat auf dem INSERT-Weg keine
-- Wache": anders als test_b_verfuegbar_braucht_standort oben (das ERST
-- eine leere Positionszeile einfuegt und DANN prueft) bleibt hier die
-- Positionszeile komplett aus - fixture_rad_ort() legt das Rad an und
-- sonst nichts. Vor trg_fahrrad_insert_ort feuerte dabei ueberhaupt kein
-- Trigger: trg_radposition_ort haengt an fahrrad_position, die hier nie
-- angefasst wird, und trg_fahrrad_status_ort an "update of status" -
-- ein blankes INSERT ist keins von beidem. Ein Rad mit Status
-- 'verfuegbar' (Vorgabewert) und ohne jede Positionszeile liess sich so
-- anlegen und ueberstand "set constraints all immediate" (nachgemessen,
-- in einer zurueckgerollten Transaktion, siehe Bericht).
create or replace function velocity_test.test_b_insert_ohne_position_braucht_standort()
returns setof text language plpgsql as $$
declare
  v_f record;
begin
  select * into v_f from velocity_test.fixture_rad_ort('8');

  begin
    set constraints all immediate;
    return next fail('Ein per INSERT angelegtes Rad ohne jede Positionszeile haette abgewiesen werden muessen');
  exception when check_violation then
    return next pass('Ein blankes INSERT ohne Positionszeile wird beim Commit abgewiesen (GR13)');
  end;
  set constraints all deferred;
end;
$$;

-- =====================================================================
--  GESCHAEFTSGEBIET
--
--  Die Flaeche, innerhalb derer frei abgestellt werden darf. Sie stand
--  frueher nur als Vieleck im JavaScript der Karte - gezeichnet, aber
--  nie geprueft. Punkt-in-Flaeche macht der eingebaute Operator @>,
--  ohne PostGIS.
-- =====================================================================

create or replace function velocity_test.test_b_geschaeftsgebiet()
returns setof text language plpgsql as $$
begin
  return next has_table('velocity'::name, 'geschaeftsgebiet'::name,
                        'Tabelle geschaeftsgebiet existiert');
  return next ok((select count(*) > 0 from velocity.geschaeftsgebiet where aktiv),
                 'Mindestens ein aktives Geschäftsgebiet ist hinterlegt');

  -- Innerhalb: Marktplatz und Campus Hubland
  return next ok(velocity.fn_im_geschaeftsgebiet(49.7944, 9.9295),
                 'Der Marktplatz liegt im Geschäftsgebiet');
  return next ok(velocity.fn_im_geschaeftsgebiet(49.7810, 9.9720),
                 'Der Campus Hubland liegt im Geschäftsgebiet');

  -- Schweinfurt ist ein eigenes Gebiet. Dieser Test behauptete frueher
  -- Ausserhalb. Schweinfurt stand zwischenzeitlich als zweites Gebiet im
  -- Modell, weil der Altbestand dort drei Stationen fuehrte. Vierzig
  -- Kilometer ohne Verbindung sind aber kein Netz, sondern zwei; das
  -- Gebiet ist seit dem 25.08.2026 wieder allein Wuerzburg.
  return next ok(not velocity.fn_im_geschaeftsgebiet(49.7900, 9.8800),
                 'Höchberg liegt außerhalb');
  return next ok(not velocity.fn_im_geschaeftsgebiet(50.0467, 10.2283),
                 'Schweinfurt liegt außerhalb');
  return next ok(not velocity.fn_im_geschaeftsgebiet(49.9200, 10.0500),
                 'Das offene Land nördlich von Würzburg liegt außerhalb');

  return next throws_ok(
    $sql$insert into velocity.geschaeftsgebiet (name, flaeche)
         values ('Zweipunkt', polygon '((9.9,49.8),(9.95,49.81))')$sql$,
    '23514', null, 'Ein Vieleck mit zwei Ecken wird abgewiesen');
end;
$$;

create or replace function velocity_test.test_b_beenden_nur_im_gebiet()
returns setof text language plpgsql as $$
declare
  v_f record; v_a bigint; v_e record;
begin
  select * into v_f from velocity_test.fixture_rad_ort('geofence');
  -- Die Vorrichtung legt einen eigenen Fahrradtyp an; der braucht einen
  -- Preis, sonst bricht die Preisfindung ab, bevor der Ort geprueft ist.
  insert into velocity.nutzungspreis (typ_id, gueltigkeit, startgebuehr,
                                      preis_pro_minute, tageshoechstpreis)
  select m.typ_id, daterange(current_date - 30, null, '[)'), 1.00, 0.10, 20.00
    from velocity.fahrrad f
    join velocity.fahrradmodell m on m.modell_id = f.modell_id
   where f.fahrrad_id = v_f.o_fahrrad_id;
  insert into velocity.fahrrad_position (fahrrad_id, latitude, longitude)
       values (v_f.o_fahrrad_id, 49.794400, 9.929500);
  insert into velocity.ausleihe (kunde_id, fahrrad_id, start_latitude, start_longitude, startzeit)
       values ((select kunde_id from velocity.kunde order by kunde_id limit 1),
               v_f.o_fahrrad_id, 49.794400, 9.929500, now())
    returning ausleihe_id into v_a;

  -- Hamburg liegt nicht in Wuerzburg. Frueher nahm die Datenbank das an.
  select * into v_e from velocity.fn_ausleihe_beenden(
    (select kunde_id from velocity.ausleihe where ausleihe_id = v_a),
    v_a, null, 53.550000, 9.993000);
  return next is(v_e.meldung, 'Abstellort liegt ausserhalb des Geschaeftsgebiets',
                 'Abstellen außerhalb des Geschäftsgebiets wird abgewiesen');

  select * into v_e from velocity.fn_ausleihe_beenden(
    (select kunde_id from velocity.ausleihe where ausleihe_id = v_a),
    v_a, null, 49.781000, 9.972000);
  return next ok(v_e.gesamtbetrag is not null,
                 'Abstellen am Hubland, also im Gebiet, wird angenommen');
end;
$$;

-- =====================================================================
--  GR15: NIE MEHR RAEDER ALS STELLPLAETZE
--
--  Der Trigger ist initially deferred und feuert beim Commit; die
--  Tests erzwingen ihn mit set constraints all immediate und stellen
--  danach zurueck - er gilt sonst fuer alle folgenden Tests, weil
--  pgTAP sie in einer einzigen Transaktion faehrt.
-- =====================================================================

create or replace function velocity_test.test_b_stellplaetze_begrenzt()
returns setof text language plpgsql as $$
declare
  v_ad bigint; v_st bigint; v_typ bigint; v_h bigint; v_m bigint; v_rad bigint; i int;
begin
  insert into velocity.adresse (strasse, plz, ort) values ('Platzstr', '97070', 'Würzburg')
    returning adresse_id into v_ad;
  insert into velocity.station (stationsnummer, name, adresse_id, kapazitaet)
       values ('S-P001', 'Teststation Stellplätze', v_ad, 2) returning station_id into v_st;
  insert into velocity.fahrradtyp (typ_code, bezeichnung) values ('P-1', 'Platztestrad')
    returning typ_id into v_typ;
  insert into velocity.hersteller (name) values ('Platzhersteller') returning hersteller_id into v_h;
  insert into velocity.fahrradmodell (hersteller_id, typ_id, modellbezeichnung)
       values (v_h, v_typ, 'PM-1') returning modell_id into v_m;

  -- Zwei Raeder passen auf zwei Stellplaetze.
  for i in 1..2 loop
    insert into velocity.fahrrad (rahmennummer, modell_id) values ('RN-P-' || i, v_m)
      returning fahrrad_id into v_rad;
    insert into velocity.fahrrad_position (fahrrad_id, station_id) values (v_rad, v_st);
  end loop;
  return next lives_ok('set constraints all immediate',
                       'Zwei Räder auf zwei Stellplätzen sind in Ordnung');
  set constraints all deferred;

  -- Das dritte nicht.
  insert into velocity.fahrrad (rahmennummer, modell_id) values ('RN-P-3', v_m)
    returning fahrrad_id into v_rad;
  insert into velocity.fahrrad_position (fahrrad_id, station_id) values (v_rad, v_st);
  begin
    set constraints all immediate;
    return next fail('Ein drittes Rad auf zwei Stellplätzen hätte abgewiesen werden müssen');
  exception when check_violation then
    return next pass('Mehr Räder als Stellplätze werden abgewiesen');
  end;
  set constraints all deferred;
end;
$$;

create or replace function velocity_test.test_b_kapazitaet_nicht_unterschreitbar()
returns setof text language plpgsql as $$
declare
  v_ad bigint; v_st bigint; v_typ bigint; v_h bigint; v_m bigint; v_rad bigint; i int;
begin
  insert into velocity.adresse (strasse, plz, ort) values ('Schrumpfstr', '97070', 'Würzburg')
    returning adresse_id into v_ad;
  insert into velocity.station (stationsnummer, name, adresse_id, kapazitaet)
       values ('S-P002', 'Teststation Schrumpfen', v_ad, 3) returning station_id into v_st;
  insert into velocity.fahrradtyp (typ_code, bezeichnung) values ('P-2', 'Schrumpftestrad')
    returning typ_id into v_typ;
  insert into velocity.hersteller (name) values ('Schrumpfhersteller') returning hersteller_id into v_h;
  insert into velocity.fahrradmodell (hersteller_id, typ_id, modellbezeichnung)
       values (v_h, v_typ, 'SM-1') returning modell_id into v_m;
  for i in 1..3 loop
    insert into velocity.fahrrad (rahmennummer, modell_id) values ('RN-S-' || i, v_m)
      returning fahrrad_id into v_rad;
    insert into velocity.fahrrad_position (fahrrad_id, station_id) values (v_rad, v_st);
  end loop;
  set constraints all deferred;

  -- Die Regel muss auch die andere Richtung abdecken: eine volle
  -- Station kleiner zu machen waere sonst das Schlupfloch.
  update velocity.station set kapazitaet = 1 where station_id = v_st;
  begin
    set constraints all immediate;
    return next fail('Die Kapazität unter den Bestand zu senken hätte abgewiesen werden müssen');
  exception when check_violation then
    return next pass('Kapazität lässt sich nicht unter den Bestand senken');
  end;
  set constraints all deferred;
end;
$$;

/* Jede Station muss in einem Geschaeftsgebiet liegen. Drei Stationen in
   Schweinfurt lagen ausserhalb des einzigen Gebiets - eine dort
   begonnene Fahrt haette sich nach GR15 nirgends beenden lassen, auch
   nicht an der eigenen Station. Aufgefallen ist das erst bei einer
   Aussenpruefung. */
create or replace function velocity_test.test_station_liegt_im_geschaeftsgebiet()
returns setof text language plpgsql as $$
begin
  return next is(
    (select count(*)::int from velocity.station s
      where s.betriebszeitraum @> current_date
        and not velocity.fn_im_geschaeftsgebiet(s.latitude, s.longitude)),
    0, 'Keine aktive Station liegt ausserhalb aller Geschaeftsgebiete');
end;
$$;

-- Nachtraeglich ergaenzt, dann korrigiert: fahrradmodell.hersteller stand
-- als 'unbekannt' und drei Modelle hiessen 'Bestandsrad ...' ohne Baujahr -
-- die Detailmaske eines Rades hatte nichts zum Anzeigen. Ein erster Anlauf
-- haengte die technischen Angaben an fahrradmodell; auf Kundeneinwand
-- (mehrere Modelle je Typ haetten mehrere Preise je Typ verlangt, den es
-- nicht gibt) stehen sie jetzt an fahrradtyp - EIN Wert je Typ, in
-- derselben Reihe wie der Tarif. Siehe db/betrieb/flottenmodelle_stammdaten.sql
-- fuer die Befuellung des tatsaechlichen Bestands.
create or replace function velocity_test.test_b_typ_technische_angaben()
returns setof text language plpgsql as $$
begin
  return next has_column('velocity'::name, 'fahrradtyp'::name, 'gewicht_kg'::name,
                         'fahrradtyp traegt das Gewicht');
  return next has_column('velocity'::name, 'fahrradtyp'::name, 'gangzahl'::name,
                         'fahrradtyp traegt die Gangzahl');
  return next has_column('velocity'::name, 'fahrradtyp'::name, 'rahmenhoehe_cm'::name,
                         'fahrradtyp traegt die Rahmenhoehe');
  return next has_column('velocity'::name, 'fahrradtyp'::name, 'akkukapazitaet_wh'::name,
                         'fahrradtyp traegt die Akkukapazitaet');
  return next has_column('velocity'::name, 'fahrradtyp'::name, 'reichweite_km'::name,
                         'fahrradtyp traegt die Reichweite');
  -- Die Spalten duerfen NICHT mehr an fahrradmodell haengen - sonst waere
  -- der Kundeneinwand nur halb umgesetzt und ein Modell koennte wieder
  -- eigene, vom Typ abweichende technische Angaben bekommen.
  return next hasnt_column('velocity'::name, 'fahrradmodell'::name, 'gewicht_kg'::name,
                           'fahrradmodell traegt kein eigenes Gewicht mehr');
  return next hasnt_column('velocity'::name, 'fahrradmodell'::name, 'rahmenhoehe_cm'::name,
                           'fahrradmodell traegt keine eigene Rahmenhoehe mehr');

  return next lives_ok(
    $sql$insert into velocity.fahrradtyp
          (typ_code, bezeichnung, hat_elektro,
           gewicht_kg, gangzahl, rahmenhoehe_cm, akkukapazitaet_wh, reichweite_km)
        values ('TEST-TA', 'Testrad technische Angaben', true, 24.5, 7, 48, 500, 60)$sql$,
    'Ein Typ mit vollstaendigen technischen Angaben laesst sich anlegen');

  return next lives_ok(
    $sql$insert into velocity.fahrradtyp (typ_code, bezeichnung)
        values ('TEST-TB', 'Testrad ohne technische Angaben')$sql$,
    'Die technischen Angaben bleiben optional - ein City-Typ hat keinen Akku');

  return next throws_ok(
    $sql$insert into velocity.fahrradtyp (typ_code, bezeichnung, gewicht_kg)
        values ('TEST-TC', 'Testrad Gewicht null', 0)$sql$,
    '23514', null, 'Ein Gewicht von null Kilogramm wird abgewiesen');

  return next throws_ok(
    $sql$insert into velocity.fahrradtyp (typ_code, bezeichnung, rahmenhoehe_cm)
        values ('TEST-TD', 'Testrad Rahmenhoehe 10', 10)$sql$,
    '23514', null, 'Eine Rahmenhoehe von 10 cm liegt ausserhalb der Spanne');

  return next throws_ok(
    $sql$insert into velocity.fahrradtyp (typ_code, bezeichnung, akkukapazitaet_wh)
        values ('TEST-TE', 'Testrad Akku negativ', -1)$sql$,
    '23514', null, 'Eine negative Akkukapazitaet wird abgewiesen');

  return next throws_ok(
    $sql$insert into velocity.fahrradtyp (typ_code, bezeichnung, reichweite_km)
        values ('TEST-TF', 'Testrad Reichweite null', 0)$sql$,
    '23514', null, 'Eine Reichweite von null Kilometern wird abgewiesen');

  return next throws_ok(
    $sql$insert into velocity.fahrradtyp (typ_code, bezeichnung, gangzahl)
        values ('TEST-TG', 'Testrad Gangzahl null', 0)$sql$,
    '23514', null, 'Eine Gangzahl von null wird abgewiesen');
end;
$$;

-- Der fachliche Kern des Kundeneinwands: ein Hersteller fertigt ein
-- Produkt zur Spezifikation eines Typs, er erfindet keine eigene
-- Modellreihe dafuer. Mehrere Zeilen je Typ (mehrere Hersteller) sind
-- gewollt, siehe Kommentar an velocity.fahrradmodell - aber jede Zeile
-- muss denselben Produktnamen tragen wie ihr Typ.
create or replace function velocity_test.test_b_modell_teilt_produktnamen_des_typs()
returns setof text language plpgsql as $$
begin
  return next is(
    (select count(*)::int from velocity.fahrradmodell mo
       join velocity.fahrradtyp t on t.typ_id = mo.typ_id
      where mo.modellbezeichnung <> t.bezeichnung),
    0, 'Jede Modellzeile im Bestand traegt denselben Produktnamen wie ihr Typ');
end;
$$;

-- Der Anlass selbst: kein Rad im Bestand darf mehr am Platzhalter
-- 'unbekannt' haengen, und keines der drei alten Bestandsrad-Modelle
-- darf noch referenziert sein. db/betrieb/flottenmodelle_stammdaten.sql
-- ordnet jedes Rad einem echten Modell zu; dieser Test haelt fest, dass
-- das Ergebnis so bleibt.
create or replace function velocity_test.test_b_kein_rad_ohne_hersteller()
returns setof text language plpgsql as $$
begin
  return next is(
    (select count(*)::int from velocity.fahrrad f
       join velocity.fahrradmodell mo on mo.modell_id = f.modell_id
       join velocity.hersteller    h  on h.hersteller_id = mo.hersteller_id
      where h.name = 'unbekannt'),
    0, 'Kein Rad im Bestand haengt noch am Hersteller-Platzhalter unbekannt');
end;
$$;
