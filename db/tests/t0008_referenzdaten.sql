-- =====================================================================
-- t0008 Referenz- und Redaktionsdaten
-- =====================================================================
create schema if not exists velocity_test;
set search_path = velocity_test, velocity, extensions, public;

create or replace function velocity_test.test_ref_entgeltarten()
returns setof text language plpgsql as $$
begin
  -- Sechs, nicht sieben: der Zuschlag fuers freie Abstellen wurde
  -- gestrichen, weil er nie erhoben wird.
  return next is((select count(*)::int from velocity.entgeltart), 6,
                 'Es gibt sechs Entgeltarten');
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
  -- Preise haben eine Historie. Nach der Anpassung vom 23.08.2026 gibt es
  -- je Typ zwei Perioden; gefragt ist immer die HEUTE gueltige. Genau
  -- deshalb steht der Zeitbezug in der Abfrage - ohne ihn liefert die
  -- Unterabfrage mehr als eine Zeile und der Test stirbt.
  return next is((select count(*)::int from velocity.nutzungspreis
                   where gueltigkeit @> current_date), 3,
                 'Je Fahrradtyp genau ein heute gueltiger Preis');
  return next is(
    (select p.preis_pro_minute from velocity.nutzungspreis p
       join velocity.fahrradtyp t on t.typ_id = p.typ_id
      where t.typ_code = 'CITY' and p.gueltigkeit @> current_date),
    0.10::numeric(10,2), 'City-Bike kostet 0,10 Euro je Minute');
  return next is(
    (select p.tageshoechstpreis from velocity.nutzungspreis p
       join velocity.fahrradtyp t on t.typ_id = p.typ_id
      where t.typ_code = 'CARGO' and p.gueltigkeit @> current_date),
    110.00::numeric(10,2), 'E-Cargo Loader ist bei 110,00 Euro am Tag gedeckelt');
  -- Frueher stand hier: alle Preise sind nach oben offen. Das galt nur,
  -- solange es je Typ eine einzige Periode gab. Die haltbare Invariante
  -- ist eine andere: je Fahrradtyp gibt es GENAU EINE offene Periode -
  -- den heute geltenden Satz. Alles davor ist geschlossene Historie.
  return next is(
    (select count(*)::int from velocity.nutzungspreis where upper_inf(gueltigkeit)),
    (select count(*)::int from velocity.fahrradtyp),
    'Je Fahrradtyp genau eine nach oben offene Preisperiode');
  return next ok(
    not exists (
      select 1 from velocity.nutzungspreis a join velocity.nutzungspreis b
        on a.typ_id = b.typ_id and a.preis_id < b.preis_id
       where a.gueltigkeit && b.gueltigkeit),
    'Preisperioden eines Fahrradtyps ueberschneiden sich nie');
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
  -- Die Startseite fuehrt '0 Euro Anmeldegebuehr' als Kennzahl, und die
  -- Preisauskunft nennt ausschliesslich Startgebuehr, Minutenpreis und
  -- Tageshoechstpreis. Ein Monatsentgelt widerspraeche beidem. Bis zum
  -- 31.08.2026 stand Premium mit 9,90 Euro in den Referenzdaten, ohne dass
  -- ein Test das bemerkt haette.
  --
  -- Geprueft wird jetzt die Struktur statt der Werte: die Spalte gibt es
  -- nicht mehr. Das ist die staerkere Zusicherung - ein Wert kann wieder
  -- gesetzt werden, eine fehlende Spalte nicht.
  return next hasnt_column('velocity'::name, 'tarif_kondition'::name,
    'monatspreis'::name,
    'Kein Monatsentgelt - die Spalte existiert nicht');
  return next is((select count(*)::int from velocity.faq_eintrag where aktiv), 4,
                 'Vier aktive FAQ-Eintraege');
  return next is((select count(*)::int from velocity.nutzungsschritt), 3, 'Drei Nutzungsschritte');
  return next is((select count(*)::int from velocity.kennzahl), 4, 'Vier Kennzahlen');
  return next is((select count(*)::int from velocity.fahrradtyp_merkmal), 9,
                 'Je Fahrradtyp drei Merkmale fuer die Tarifkarte');
end;
$$;
