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
create or replace function velocity_test.test_ue_mengen()
returns setof text language plpgsql as $$
begin
  -- Ausgewertet wird das Maximum ueber alle Laeufe, nicht der letzte Lauf:
  -- ein zweiter, idempotenter Lauf schreibt nichts mehr nach und wuerde
  -- sonst faelschlich als Fehlschlag erscheinen.
  return next is((select max(geschrieben) from velocity.uebernahme_protokoll
                   where ziel = 'velocity.kunde'), 1015,
                 'Das Protokoll weist 1015 uebernommene Kunden aus');
  return next is((select max(geschrieben) from velocity.uebernahme_protokoll
                   where ziel = 'velocity.station'), 13,
                 'Das Protokoll weist 13 uebernommene Stationen aus');
  return next is((select geschrieben from velocity.uebernahme_protokoll
                   where ziel = 'velocity.kunde'
                   order by lauf desc limit 1), 0,
                 'Ein erneuter Lauf schreibt nichts nach (Idempotenz)');

  return next cmp_ok((select count(*)::int from velocity.kunde),   '>=', 1015,
                     'Mindestens 1015 Kunden vorhanden');
  return next is((select count(*)::int from velocity.station),        13, '13 Stationen vorhanden');
  return next is((select count(*)::int from velocity.fahrrad),       352, '352 Raeder vorhanden');
  return next cmp_ok((select count(*)::int from velocity.ausleihe), '>=',  32,
                     'Mindestens 32 Ausleihen vorhanden');
  return next is((select count(*)::int from velocity.mitgliedschaft), 10, '10 Mitgliedschaften vorhanden');
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
  select coalesce(sum(kosten), 0) into v_alt
    from "cityBikesRental".ausleihe where kosten is not null;
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
