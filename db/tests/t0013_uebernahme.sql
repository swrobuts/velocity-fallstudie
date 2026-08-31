-- =====================================================================
-- t0013 Datenuebernahme
--
-- Diese Tests laufen NACH db/betrieb/uebernahme_altdaten.sql und pruefen
-- den Abgleich. Vor der Uebernahme schlagen sie erwartungsgemaess fehl.
-- =====================================================================
create schema if not exists velocity_test;
set search_path = velocity_test, velocity, extensions, public;

-- Geprueft wird gegen das Uebernahmeprotokoll, nicht gegen die aktuellen
-- Zeilenzahlen: nach der Ende-zu-Ende-Pruefung aus Aufgabe 16 gibt es
-- zusaetzliche Kunden und Ausleihen aus dem laufenden Betrieb. Fuer die
-- Livemengen gilt deshalb nur eine Untergrenze.
/* Zwei verschiedene Dinge, die gern verwechselt werden:

   Das PROTOKOLL haelt fest, was bei einem Lauf geschehen IST. Es wird
   nicht nachtraeglich umgeschrieben - der Lauf vom 22.08.2026 hat nun
   einmal 13 Stationen und 352 Raeder geschrieben, damals einschliesslich
   Schweinfurt. Ein Protokoll, das sich der Gegenwart anpasst, ist kein
   Protokoll.

   Der BESTAND ist der Stand von heute. Er wird gegen die Regel geprueft,
   nicht gegen eine gemerkte Zahl: so viele Stationen, wie es im
   Altbestand ausserhalb von Schweinfurt gibt. Dann haelt der Test auch,
   wenn sich der Altbestand aendert. */
create or replace function velocity_test.test_ue_mengen()
returns setof text language plpgsql as $$
begin
  -- Protokoll: der erste Lauf hat stattgefunden und ist festgehalten.
  return next is((select max(geschrieben) from velocity.uebernahme_protokoll
                   where ziel = 'velocity.kunde'), 1015,
                 'Das Protokoll weist 1015 uebernommene Kunden aus');
  return next cmp_ok((select max(geschrieben) from velocity.uebernahme_protokoll
                       where ziel = 'velocity.station'), '>', 0,
                     'Das Protokoll haelt den Stationslauf fest');
  return next is((select geschrieben from velocity.uebernahme_protokoll
                   where ziel = 'velocity.kunde'
                   order by lauf desc limit 1), 0,
                 'Ein erneuter Lauf schreibt nichts nach (Idempotenz)');

  -- Bestand gegen die Regel, nicht gegen eine gemerkte Zahl.
  -- MINDESTENS, aus demselben Grund wie bei den Raedern weiter unten
  -- (30.08.2026): eine ueber die Warenwirtschaft angelegte Station ist
  -- bestimmungsgemaesser Betrieb, kein Fehler der Uebernahme. Bei den
  -- Raedern hat die Gleichheit bereits einen Fehlalarm ausgeloest; hier
  -- vorsorglich, bevor dasselbe beim ersten neu angelegten Standort
  -- passiert. Der Fall, der die Zusicherung rechtfertigt - eine
  -- Uebernahme, die Stationen VERLIERT - wird weiterhin gefangen.
  return next cmp_ok(
    (select count(*)::int from velocity.station), '>=',
    (select count(*)::int from "cityBikesRental".station where ort <> 'Schweinfurt'),
    'Mindestens so viele Stationen wie im Altbestand ausserhalb von Schweinfurt');

  -- MINDESTENS, nicht GENAU (30.08.2026). Die Gleichheit hielt nur so
  -- lange, wie niemand ueber die Warenwirtschaft ein Rad anlegte - genau
  -- das ist beim Erproben des Anlegedialogs geschehen (zwei Raeder,
  -- 10-0815 und 10-0815q). Ein neu angelegtes Rad ist aber kein Fehler der
  -- Uebernahme, sondern der bestimmungsgemaesse Betrieb; ein Test, der
  -- darauf anschlaegt, meldet etwas Richtiges als falsch und stumpft mit
  -- jedem Fehlalarm die Aufmerksamkeit fuer die echten ab.
  -- Was der Test WEITERHIN faengt, ist der Fall, der ihn rechtfertigt:
  -- eine Uebernahme, die Raeder VERLIERT. Dieselbe Schwelle wie bei den
  -- Kunden zwei Zusicherungen weiter unten.
  return next cmp_ok(
    (select count(*)::int from velocity.fahrrad), '>=',
    (select count(*)::int from "cityBikesRental".fahrrad f
      where f.station_id is null
         or f.station_id not in (select station_id from "cityBikesRental".station
                                  where ort = 'Schweinfurt')),
    'Mindestens so viele Raeder wie im Altbestand ausserhalb von Schweinfurt');

  return next cmp_ok(
    (select count(*)::int from velocity.kunde), '>=',
    (select count(*)::int from "cityBikesRental".kunde),
    'Mindestens so viele Kunden wie im Altbestand');

  return next cmp_ok((select count(*)::int from velocity.ausleihe), '>=', 23,
                     'Mindestens 23 Ausleihen vorhanden');
  -- Wie bei kunde und ausleihe: das Protokoll haelt den Uebernahmelauf
  -- exakt fest, der Bestand nur als Untergrenze. Seit Aufgabe 6 legt
  -- db/betrieb/referenzdaten_grundlage.sql zusaetzliche, ERFUNDENE
  -- Mitgliedschaften an - eine exakte Pruefung auf 10 wuerde bei jedem
  -- Lauf dieser Datei zu Unrecht fehlschlagen.
  return next is(
    (select max(geschrieben) from velocity.uebernahme_protokoll
      where ziel = 'velocity.mitgliedschaft, velocity.freiminuten_periode'),
    10,
    'Das Protokoll weist 10 uebernommene Mitgliedschaften aus');
  return next cmp_ok((select count(*)::int from velocity.mitgliedschaft), '>=', 10,
                     'Mindestens so viele Mitgliedschaften wie im Altbestand uebernommen');

  -- Gegenprobe: nichts aus Schweinfurt ist zurueckgeblieben.
  return next is((select count(*)::int from velocity.station s
                    join velocity.adresse a using (adresse_id)
                   where a.ort = 'Schweinfurt'), 0,
                 'Keine Station in Schweinfurt');
  return next is((select count(*)::int from velocity.geschaeftsgebiet
                   where name = 'Schweinfurt'), 0,
                 'Kein Geschaeftsgebiet Schweinfurt');
end;
$$;

create or replace function velocity_test.test_ue_keine_passwoerter()
returns setof text language plpgsql as $$
begin
  return next hasnt_column('velocity'::name, 'kunde'::name, 'passwort_hash'::name,
                           'Es gibt gar keine Passwortspalte, also wurde auch nichts uebernommen');
  -- Keine Zahlenerwartung, sondern die belastbare Invariante: jeder
  -- uebernommene Verweis muss auf ein existierendes Konto zeigen. Der
  -- Altbestand enthielt drei verwaiste Verweise, weil auth_kunde_mapping
  -- keinen Fremdschluessel auf auth.users hatte.
  return next is(
    (select count(*)::int from velocity.kunde k
      where k.auth_uid is not null
        and not exists (select 1 from auth.users u where u.id = k.auth_uid)), 0,
    'Kein Kundensatz verweist auf ein nicht existierendes Anmeldekonto');
end;
$$;

create or replace function velocity_test.test_ue_keine_zufallskoordinaten()
returns setof text language plpgsql as $$
begin
  -- Im Altbestand hatte JEDES Rad Koordinaten aus random(), quer ueber
  -- die Landkarte verstreut. Uebernommen wird davon keine einzige.
  --
  -- Frueher stand hier: kein nie genutztes Rad traegt eine Koordinate.
  -- Das galt nur, solange ueberhaupt kein Rad frei abgestellt war. Seit
  -- der Flottenverteilung stehen 45 Raeder bewusst frei im Stadtgebiet -
  -- die Regel war zu eng gefasst.
  --
  -- Die haltbare Invariante ist schaerfer und trifft den urspruenglichen
  -- Zweck genauer: JEDE frei abgestellte Koordinate liegt im
  -- Geschaeftsgebiet. Erfundene Werte tun das nicht.
  return next ok(
    (select count(*) from velocity.fahrrad_position p
      where p.station_id is null and p.latitude is not null
        and not velocity.fn_im_geschaeftsgebiet(p.latitude, p.longitude)) = 0,
    'Keine frei abgestellte Koordinate liegt ausserhalb des Geschaeftsgebiets');

  return next ok(
    (select count(*) from velocity.fahrrad_position p
      where p.station_id is null and p.latitude is not null) > 0,
    'Es gibt ueberhaupt frei abgestellte Raeder - die Pruefung laeuft nicht ins Leere');
end;
$$;

create or replace function velocity_test.test_ue_altbetraege_erhalten()
returns setof text language plpgsql as $$
declare
  v_alt numeric;
  v_neu numeric;
begin
  -- Verglichen wird der Teil, der uebernommen werden SOLL. Fahrten in
  -- Schweinfurt gehoeren zu einem Netz, das dieses Modell nicht fuehrt;
  -- ihre Betraege stehen deshalb auch nicht in der Summe.
  select coalesce(sum(a.kosten), 0) into v_alt
    from "cityBikesRental".ausleihe a
   where a.kosten is not null
     and a.start_station_id not in
         (select station_id from "cityBikesRental".station where ort = 'Schweinfurt')
     and (a.end_station_id is null or a.end_station_id not in
         (select station_id from "cityBikesRental".station where ort = 'Schweinfurt'))
     and a.fahrrad_id not in
         (select fahrrad_id from "cityBikesRental".fahrrad
           where station_id in (select station_id from "cityBikesRental".station
                                 where ort = 'Schweinfurt'));
  select coalesce(sum(p.betrag), 0) into v_neu
    from velocity.entgeltposition p
    join velocity.entgeltart a on a.entgeltart_id = p.entgeltart_id
   where a.code = 'BESTANDSUEBERNAHME';

  return next is(v_neu, v_alt, 'Die Summe der Altbetraege bleibt unveraendert erhalten');
end;
$$;

create or replace function velocity_test.test_ue_protokoll()
returns setof text language plpgsql as $$
begin
  return next has_table('velocity'::name, 'uebernahme_protokoll'::name,
                        'Das Uebernahmeprotokoll existiert');
  return next cmp_ok((select count(*)::int from velocity.uebernahme_protokoll), '>=', 8,
                     'Jeder Uebernahmeschritt ist protokolliert');
end;
$$;
