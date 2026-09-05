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
  return next is(v_km, 49995.4::numeric,
                 'v_wawi_km_co2 summiert unveraendert 49995.4 Kilometer');
  return next is(v_co2, 6612.24::numeric,
                 'v_wawi_km_co2 summiert unveraendert 6612.24 kg CO2');
  return next is(v_fahrten, 12052::bigint,
                 'v_wawi_km_co2 zaehlt unveraendert 12052 Fahrten');

  select count(*), round(sum(kilometer), 2) into v_zeilen, v_km
    from velocity.v_wawi_fahrt_km;
  return next is(v_zeilen, 12052::bigint,
                 'v_wawi_fahrt_km hat unveraendert 12052 Zeilen');
  return next is(v_km, 49995.23::numeric,
                 'v_wawi_fahrt_km summiert unveraendert 49995.23 Kilometer');

  select count(*), round(sum(kilometer), 2) into v_zeilen, v_km
    from velocity.v_wawi_fahrten_je_tag_rad;
  return next is(v_zeilen, 12052::bigint,
                 'v_wawi_fahrten_je_tag_rad hat unveraendert 12052 Zeilen');
  return next is(v_km, 49995.23::numeric,
                 'v_wawi_fahrten_je_tag_rad summiert unveraendert 49995.23 Kilometer');
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
create or replace function velocity_test.test_um_verfahren_unveraendert()
returns setof text language plpgsql as $$
begin
  perform velocity_test.fixture_mitarbeiter('t0025v');
  return next results_eq(
    $sql$select verfahren, count(*)::bigint
           from velocity.v_wawi_fahrt_km group by verfahren order by verfahren$sql$,
    $sql$values ('aus_dauer'::text, 1141::bigint),
                ('aus_luftlinie'::text, 3688::bigint),
                ('gemessen'::text, 7223::bigint)$sql$,
    'Die Verteilung auf die drei Schaetzverfahren bleibt unveraendert');
end;
$$;
