-- =====================================================================
-- t0008 Referenz- und Redaktionsdaten
-- =====================================================================
create schema if not exists velocity_test;
set search_path = velocity_test, velocity, extensions, public;

create or replace function velocity_test.test_ref_entgeltarten()
returns setof text language plpgsql as $$
begin
  return next is((select count(*)::int from velocity.entgeltart), 7,
                 'Es gibt sieben Entgeltarten');
  return next is((select vorzeichen from velocity.entgeltart where code = 'ZEITENTGELT'),
                 1::smallint, 'Zeitentgelt belastet');
  return next is((select vorzeichen from velocity.entgeltart where code = 'FREIMINUTEN'),
                 (-1)::smallint, 'Freiminuten entlasten');
  return next is((select vorzeichen from velocity.entgeltart where code = 'TARIFRABATT'),
                 (-1)::smallint, 'Tarifrabatt entlastet');
end;
$$;

create or replace function velocity_test.test_ref_preise()
returns setof text language plpgsql as $$
begin
  return next is((select count(*)::int from velocity.fahrradtyp), 3, 'Drei Fahrradtypen');
  return next is((select count(*)::int from velocity.nutzungspreis), 3,
                 'Je Fahrradtyp genau ein gueltiger Preis');
  return next is(
    (select p.preis_pro_minute from velocity.nutzungspreis p
       join velocity.fahrradtyp t on t.typ_id = p.typ_id where t.typ_code = 'CITY'),
    0.10::numeric(10,2), 'CityRad kostet 0,10 Euro je Minute');
  return next is(
    (select p.tageshoechstpreis from velocity.nutzungspreis p
       join velocity.fahrradtyp t on t.typ_id = p.typ_id where t.typ_code = 'CARGO'),
    22.00::numeric(10,2), 'Lastenrad ist bei 22,00 Euro am Tag gedeckelt');
  return next ok(
    (select bool_and(upper_inf(gueltigkeit)) from velocity.nutzungspreis),
    'Alle Preise sind nach oben offen gueltig');
end;
$$;

create or replace function velocity_test.test_ref_tarife_und_inhalte()
returns setof text language plpgsql as $$
begin
  return next is((select count(*)::int from velocity.tarif), 4, 'Vier Tarife');
  return next is(
    (select k.freiminuten_pro_monat from velocity.tarif_kondition k
       join velocity.tarif t on t.tarif_id = k.tarif_id where t.tarif_code = 'PREMIUM'),
    1000, 'Premium bringt 1000 Freiminuten je Monat');
  return next is(
    (select k.rabatt_prozent from velocity.tarif_kondition k
       join velocity.tarif t on t.tarif_id = k.tarif_id where t.tarif_code = 'PREMIUM'),
    20.00::numeric(5,2), 'Premium gewaehrt 20 Prozent Rabatt');
  return next is((select count(*)::int from velocity.faq_eintrag where aktiv), 4,
                 'Vier aktive FAQ-Eintraege');
  return next is((select count(*)::int from velocity.nutzungsschritt), 3, 'Drei Nutzungsschritte');
  return next is((select count(*)::int from velocity.kennzahl), 4, 'Vier Kennzahlen');
  return next is((select count(*)::int from velocity.fahrradtyp_merkmal), 9,
                 'Je Fahrradtyp drei Merkmale fuer die Tarifkarte');
end;
$$;
