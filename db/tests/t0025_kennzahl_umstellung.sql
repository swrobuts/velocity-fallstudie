-- =====================================================================
-- t0025 Zusicherung fuer die Umstellung auf v_fahrt_kennzahl
--
-- Die Kilometer- und CO2-Herleitung stand am 05.09.2026 dreimal im
-- Schema: in v_wawi_fahrt_km, v_wawi_fahrten_je_tag_rad und
-- v_wawi_km_co2. Sie wird in die Basissicht v_fahrt_kennzahl gezogen,
-- und die drei lesen kuenftig aus ihr.
--
-- Diese Datei entstand VOR dem Umbau und haelt den Stand von vorher
-- fest. Sie ist damit das Einzige, was zeigen kann, dass die
-- Umstellung nichts verschoben hat. Waere sie nach dem Umbau
-- geschrieben worden, wuerde sie den Umbau gegen sich selbst messen.
--
-- Laeuft eine dieser Pruefungen rot, ist die Umstellung schuld, nicht
-- der Test. Die Werte werden NICHT nachgezogen, ohne dass jemand
-- verstanden hat, warum sie sich geaendert haben.
--
-- ---------------------------------------------------------------------
-- NACHTRAG 05.09.2026: DIE WERTE UNTEN WURDEN NACHGEZOGEN
--
-- Auslöser war db/betrieb/ausreisser_dauerschaetzung.sql, nicht ein
-- weiterer Umbau der Sichten. Ausleihe 269 (Hauptbahnhof -> Hauptbahnhof,
-- 2552 Minuten Ausleihdauer) hatte keine gemessene Distanz; die Luftlinie
-- ist bei gleicher Start- und Endstation null, und der dritte Fall der
-- Herleitung in velocity.v_fahrt_kennzahl rechnete deshalb Dauer mal
-- Reisegeschwindigkeit - 552,93 km, mit weitem Abstand die längste
-- Einzelfahrt der Flotte und die einzige über 60 km (Platz 2: 21,49 km).
-- Auf Entscheidung des Auftraggebers vom 05.09.2026 wurde distanz_km
-- dieser einen Ausleihe auf 12 km gesetzt - siehe den Kopfkommentar
-- jener Datei für Anlass, Messwerte und die Begründung, warum weder
-- gelöscht noch die allgemeine Formel geändert wurde.
--
-- Das ist genau der Fall, den der Kopf oben verlangt: verstanden, nicht
-- nur beobachtet. Deshalb werden die Werte nachgezogen statt stumm
-- überschrieben - und die alten stehen hier, damit ein Diff sie zeigt:
--
--   ALT (galt seit der Umstellung auf v_fahrt_kennzahl, ebenfalls
--   05.09.2026, bis zur Ausreißer-Korrektur):
--     v_wawi_km_co2              47 Zeilen, 49995.4 km, 6612.24 kg CO2, 12052 Fahrten
--     v_wawi_fahrt_km             12052 Zeilen, 49995.23 km
--     v_wawi_fahrten_je_tag_rad   12052 Zeilen, 49995.23 km
--     Verfahren                   aus_dauer 1141, aus_luftlinie 3688, gemessen 7223
--
--   NEU (nachgemessen nach der Korrektur, selbst erhoben, nicht aus dem
--   Auftrag übernommen):
--     v_wawi_km_co2              47 Zeilen, 49454.5 km, 6543.00 kg CO2, 12052 Fahrten
--     v_wawi_fahrt_km             12052 Zeilen, 49454.30 km
--     v_wawi_fahrten_je_tag_rad   12052 Zeilen, 49454.30 km
--     Verfahren                   aus_dauer 1140, aus_luftlinie 3688, gemessen 7224
--
-- Zeilenzahlen und die Aufteilung nach Fahrradtyp/Monat bleiben in allen
-- drei Sichten unberührt - eine einzige Zeile wechselt lediglich das
-- Verfahren von aus_dauer zu gemessen und liefert seither 12 km statt
-- 552,93 km. 49995.23 - 49454.30 = 540,93 km, exakt 552,93 - 12.
-- ---------------------------------------------------------------------
-- =====================================================================
create schema if not exists velocity_test;
set search_path = velocity_test, velocity, extensions, public;

create or replace function velocity_test.test_um_kennzahlen_unveraendert()
returns setof text language plpgsql as $$
declare
  v_zeilen  bigint;
  v_km      numeric;
  v_co2     numeric;
  v_fahrten bigint;
begin
  -- Ohne diese Vorrichtung liefern alle drei Sichten null Zeilen: ihre
  -- Rollenschranke fragt request.jwt.claims, und ohne Anmeldung ist
  -- dort niemand. Ein Test ohne sie waere immer gruen und wertlos.
  perform velocity_test.fixture_mitarbeiter('t0025');

  select count(*), sum(kilometer), sum(co2_ersparnis_kg), sum(fahrten)
    into v_zeilen, v_km, v_co2, v_fahrten
    from velocity.v_wawi_km_co2;

  return next is(v_zeilen, 47::bigint,
                 'v_wawi_km_co2 hat unveraendert 47 Zeilen');
  return next is(v_km, 49454.5::numeric,
                 'v_wawi_km_co2 summiert 49454.5 Kilometer nach der Ausreisser-Korrektur vom 05.09.2026');
  return next is(v_co2, 6543.00::numeric,
                 'v_wawi_km_co2 summiert 6543.00 kg CO2 nach der Ausreisser-Korrektur vom 05.09.2026');
  return next is(v_fahrten, 12052::bigint,
                 'v_wawi_km_co2 zaehlt unveraendert 12052 Fahrten');

  select count(*), round(sum(kilometer), 2) into v_zeilen, v_km
    from velocity.v_wawi_fahrt_km;
  return next is(v_zeilen, 12052::bigint,
                 'v_wawi_fahrt_km hat unveraendert 12052 Zeilen');
  return next is(v_km, 49454.30::numeric,
                 'v_wawi_fahrt_km summiert 49454.30 Kilometer nach der Ausreisser-Korrektur vom 05.09.2026');

  select count(*), round(sum(kilometer), 2) into v_zeilen, v_km
    from velocity.v_wawi_fahrten_je_tag_rad;
  return next is(v_zeilen, 12052::bigint,
                 'v_wawi_fahrten_je_tag_rad hat unveraendert 12052 Zeilen');
  return next is(v_km, 49454.30::numeric,
                 'v_wawi_fahrten_je_tag_rad summiert 49454.30 Kilometer nach der Ausreisser-Korrektur vom 05.09.2026');
end;
$$;

-- Die Aufteilung nach Verfahren ist der eigentliche Pruefstein: eine
-- verrutschte Fallunterscheidung in der Drei-Fall-Formel laesst die
-- Gesamtsumme fast unveraendert, verschiebt aber die Anteile. Eine
-- Summenpruefung allein wuerde das durchlassen.
--
-- Gemessen am 05.09.2026 (Schritt 3 des Aufgabenzettels):
-- aus_dauer 1141, aus_luftlinie 3688, gemessen 7223 (Summe 12052 =
-- Zeilenzahl von v_wawi_fahrt_km oben).
--
-- NACHGEZOGEN, ebenfalls 05.09.2026, nach db/betrieb/
-- ausreisser_dauerschaetzung.sql (siehe NACHTRAG im Kopf dieser Datei):
-- aus_dauer 1140, aus_luftlinie 3688, gemessen 7224. Genau eine Zeile
-- wandert von aus_dauer zu gemessen - Ausleihe 269 traegt seither eine
-- vorgegebene Distanz statt einer Dauerschaetzung. aus_luftlinie bleibt
-- unberuehrt, weil die Korrektur nur eine Fahrt mit Luftlinie null
-- betraf.
create or replace function velocity_test.test_um_verfahren_unveraendert()
returns setof text language plpgsql as $$
begin
  perform velocity_test.fixture_mitarbeiter('t0025v');
  return next results_eq(
    $sql$select verfahren, count(*)::bigint
           from velocity.v_wawi_fahrt_km group by verfahren order by verfahren$sql$,
    $sql$values ('aus_dauer'::text, 1140::bigint),
                ('aus_luftlinie'::text, 3688::bigint),
                ('gemessen'::text, 7224::bigint)$sql$,
    'Die Verteilung auf die drei Schaetzverfahren nach der Ausreisser-Korrektur vom 05.09.2026');
end;
$$;
