-- =====================================================================
--  REFERENZDATEN, TEIL 3: MONATSRECHNUNGEN
--
--  ACHTUNG: Aufbauend auf ERFUNDENEN Fahrten (referenzdaten_fahrten.sql).
--  Die Rechnungen selbst sind korrekt gerechnet - aus Daten, die niemand
--  erhoben hat.
--
--  Setzt db/betrieb/referenzdaten_fahrten.sql voraus.
--
--  Referenzzeitraum der Fahrten: 01.09.2025 bis zum jeweils aktuellen
--  Tagesende. Abgerechnet werden nur VOLLE Monate, hier 09/2025 bis
--  07/2026: der laufende Monat 08/2026 ist noch nicht vorbei, und eine
--  Rechnung entsteht zum Periodenende (GR10), nicht mitten im Monat.
--
--  Idempotent ueber GR10 selbst: velocity.fn_rechnung_erzeugen (0009)
--  prueft je Kunde und Monat per NOT EXISTS gegen velocity.rechnung und
--  uebergeht, was schon abgerechnet ist. Ein zweiter Lauf dieser Datei
--  erzeugt ueberall 0 Rechnungen - anders als bei
--  referenzdaten_fahrten.sql, wo das Anlegen der Fahrten selbst durch
--  keinen Unique-Constraint geschuetzt ist und deshalb eine eigene
--  Waechterabfrage braucht, reicht hier die Geschaeftsregel selbst als
--  Waechter.
--
--  Ruecknahme:
--    delete from velocity.rechnungsposition where rechnung_id in (
--      select rechnung_id from velocity.rechnung
--       where (periode_jahr, periode_monat) >= (2025, 9)
--         and (periode_jahr, periode_monat) <= (2026, 7));
--    delete from velocity.rechnung
--     where (periode_jahr, periode_monat) >= (2025, 9)
--       and (periode_jahr, periode_monat) <= (2026, 7);
-- =====================================================================

do $$
declare
  v_d     date;
  v_zahl  integer;
  v_summe integer := 0;
begin
  for v_d in
    select d::date from generate_series(date '2025-09-01', date '2026-07-01', interval '1 month') d
  loop
    v_zahl := velocity.fn_rechnung_erzeugen(
                extract(year from v_d)::integer, extract(month from v_d)::integer);
    v_summe := v_summe + v_zahl;
    raise notice '% : % Rechnungen', to_char(v_d, 'YYYY-MM'), v_zahl;
  end loop;
  raise notice 'Rechnungen gesamt: %', v_summe;

  -- ---- Nachweis im Uebernahmeprotokoll --------------------------------
  -- Wie referenzdaten_grundlage.sql/-fahrten.sql: geschrieben traegt das
  -- DELTA dieses Laufs, nicht den Gesamtbestand an velocity.rechnung -
  -- beim zweiten Lauf also 0, weil fn_rechnung_erzeugen dann ueberall 0
  -- liefert.
  insert into velocity.uebernahme_protokoll
         (lauf, quelle, ziel, gelesen, geschrieben, uebersprungen, hinweis)
  values (now(), 'Referenzdaten (erzeugt)',
          'velocity.rechnung, velocity.rechnungsposition',
          0, v_summe, 0,
          format('ERFUNDENE Rechnungen fuer die Lehre, nicht erhoben - berechnet '
                 'aus den ebenfalls erfundenen Referenzfahrten. Monatslauf ueber '
                 '09/2025 bis 07/2026 (elf Monate); 08/2026 bleibt bewusst '
                 'unabgerechnet, weil dieser Monat beim Lauf noch nicht vorbei '
                 'ist. %s neue Rechnungen in diesem Lauf.', v_summe));
end;
$$;

-- Der laufende Monat wird bewusst NICHT abgerechnet: eine Rechnung
-- entsteht zum Periodenende. August 2026 ist noch nicht vorbei.

-- ---- Kontrolle -------------------------------------------------------
do $$
declare v_fehler integer;
begin
  -- GR10 in den Daten nachweisen, nicht nur im Constraint.
  select count(*) into v_fehler from (
    select kunde_id, periode_jahr, periode_monat
      from velocity.rechnung group by 1,2,3 having count(*) > 1) x;
  if v_fehler > 0 then
    raise exception '% Kunde/Monat-Paare mit mehr als einer Rechnung', v_fehler;
  end if;

  select count(*) into v_fehler
    from velocity.rechnung r
   where r.betrag_netto <> (select coalesce(round(sum(betrag), 2), 0)
                              from velocity.rechnungsposition p
                             where p.rechnung_id = r.rechnung_id);
  if v_fehler > 0 then
    raise exception '% Rechnungen stimmen nicht mit ihren Positionen ueberein', v_fehler;
  end if;

  raise notice 'Rechnungen in Ordnung';
end;
$$;
