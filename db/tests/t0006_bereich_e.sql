-- =====================================================================
-- t0006 Bereich E: Abrechnung
-- =====================================================================
create schema if not exists velocity_test;
set search_path = velocity_test, velocity, extensions, public;

create or replace function velocity_test.test_e_struktur()
returns setof text language plpgsql as $$
begin
  return next has_table('velocity'::name, 'zahlungsart'::name,       'Tabelle zahlungsart existiert');
  return next has_table('velocity'::name, 'zahlungsmittel'::name,    'Tabelle zahlungsmittel existiert');
  return next has_table('velocity'::name, 'rechnung'::name,          'Tabelle rechnung existiert');
  return next has_table('velocity'::name, 'rechnungsposition'::name, 'Tabelle rechnungsposition existiert');
  return next has_table('velocity'::name, 'zahlung'::name,           'Tabelle zahlung existiert');
  -- Zahlungsdaten liegen beim Dienstleister, nicht bei uns.
  return next hasnt_column('velocity'::name, 'zahlungsmittel'::name, 'iban'::name,
                           'Es wird keine IBAN gespeichert');
  return next hasnt_column('velocity'::name, 'zahlungsmittel'::name, 'kartennummer'::name,
                           'Es wird keine Kartennummer gespeichert');
end;
$$;

create or replace function velocity_test.test_e_regeln()
returns setof text language plpgsql as $$
declare
  v_k bigint; v_za bigint; v_r bigint;
begin
  insert into velocity.kunde (email, vorname, nachname)
       values ('e-test@example.org', 'Emil', 'Test') returning kunde_id into v_k;
  insert into velocity.zahlungsart (code, bezeichnung) values ('E-SEPA', 'SEPA Test')
    returning zahlungsart_id into v_za;

  insert into velocity.zahlungsmittel (kunde_id, zahlungsart_id, referenz_token, ist_standard)
       values (v_k, v_za, 'tok_1', true);
  return next throws_ok(
    format($sql$insert into velocity.zahlungsmittel
             (kunde_id, zahlungsart_id, referenz_token, ist_standard)
           values (%s, %s, 'tok_2', true)$sql$, v_k, v_za),
    '23505', null, 'Je Kunde gibt es hoechstens ein Standardzahlungsmittel');

  insert into velocity.rechnung (rechnungsnummer, kunde_id, periode_jahr, periode_monat,
                                 betrag_netto, ust_satz, ust_betrag, betrag_brutto)
       values ('R-2026-08-0001', v_k, 2026, 8, 10.00, 19.00, 1.90, 11.90)
    returning rechnung_id into v_r;

  return next throws_ok(
    format($sql$insert into velocity.rechnung (rechnungsnummer, kunde_id, periode_jahr,
                 periode_monat, betrag_netto, ust_satz, ust_betrag, betrag_brutto)
           values ('R-2026-08-0002', %s, 2026, 8, 1, 19, 0.19, 1.19)$sql$, v_k),
    '23505', null, 'Je Kunde und Monat gibt es genau eine Rechnung (GR10)');

  insert into velocity.rechnungsposition (rechnung_id, position_nr, beschreibung, betrag)
       values (v_r, 1, 'Fahrt vom 01.08.2026', 11.90);
  return next throws_ok(
    format($sql$insert into velocity.rechnungsposition (rechnung_id, position_nr, beschreibung, betrag)
           values (%s, 1, 'Doppelte Position', 1.00)$sql$, v_r),
    '23505', null, 'Positionsnummern sind je Rechnung eindeutig');

  return next throws_ok(
    format($sql$insert into velocity.rechnung (rechnungsnummer, kunde_id, periode_jahr,
                 periode_monat, betrag_netto, ust_satz, ust_betrag, betrag_brutto)
           values ('R-X', %s, 2026, 13, 1, 19, 0.19, 1.19)$sql$, v_k),
    '23514', null, 'Monat 13 wird abgewiesen');
end;
$$;

-- ---------------------------------------------------------------------
-- Vorrichtung fuer die beiden folgenden Tests: eine eigene, garantiert
-- verrechenbare Fahrt in einer Periode, die weder das Referenzjahr
-- (09/2025 bis 08/2026, db/betrieb/referenzdaten_*.sql) noch der
-- uebernommene Altbestand beruehren. Ein Test, dessen Ergebnis davon
-- abhaengt, ob eine Betriebsdatei vorher gelaufen ist, prueft die
-- Reihenfolge der Skripte statt der Geschaeftsregel - siehe die zuvor
-- fehlgeschlagene Fassung dieser Tests, deren v_erst > 0 falsch wurde,
-- sobald referenzdaten_rechnungen.sql 04/2026 bereits abgerechnet hatte.
--
-- Eigener Fahrradtyp (wie fixture_rad in t0005_bereich_d.sql), aber
-- zusaetzlich eine eigene Preisperiode: fuer 2019 existiert in
-- velocity.nutzungspreis sonst keine Zeile, und fn_ausleihe_abrechnen
-- bricht ohne gueltigen Preis mit "Kein gueltiger Preis" ab. Ein
-- eigener Typ haelt die eigene Preisperiode aus der EXCLUDE-Constraint
-- (typ_id, gueltigkeit) jeder bestehenden Preishistorie fern.
create or replace function velocity_test.fixture_e_verrechenbare_fahrt(
  p_suffix text, p_jahr integer, p_monat integer, p_dauer integer default 30
)
returns table (o_kunde_id bigint, o_ausleihe_id bigint)
language plpgsql as $$
declare
  v_typ   bigint;
  v_h     bigint;
  v_m     bigint;
  v_rad   bigint;
  v_start timestamptz;
begin
  insert into velocity.kunde (email, vorname, nachname)
       values ('e-' || p_suffix || '@example.org', 'Erna', 'Test')
    returning kunde_id into o_kunde_id;

  insert into velocity.fahrradtyp (typ_code, bezeichnung)
       values ('E-' || p_suffix, 'Rechnungstestrad ' || p_suffix) returning typ_id into v_typ;
  insert into velocity.hersteller (name) values ('Hersteller E-' || p_suffix)
    returning hersteller_id into v_h;
  insert into velocity.fahrradmodell (hersteller_id, typ_id, modellbezeichnung)
       values (v_h, v_typ, 'M-E-' || p_suffix) returning modell_id into v_m;
  insert into velocity.fahrrad (rahmennummer, modell_id)
       values ('RN-E-' || p_suffix, v_m) returning fahrrad_id into v_rad;

  insert into velocity.nutzungspreis
         (typ_id, gueltigkeit, startgebuehr, preis_pro_minute, tageshoechstpreis)
       values (v_typ, daterange(make_date(p_jahr, 1, 1), make_date(p_jahr + 1, 1, 1), '[)'),
               1.00, 0.10, 20.00);

  v_start := make_timestamptz(p_jahr, p_monat, 15, 10, 0, 0);
  insert into velocity.ausleihe (kunde_id, fahrrad_id, start_latitude, start_longitude,
                                 end_latitude, end_longitude, startzeit, endzeit, status)
       values (o_kunde_id, v_rad, 49.790000, 9.930000, 49.780000, 9.940000,
               v_start, v_start + (p_dauer || ' minutes')::interval, 'abgeschlossen')
    returning ausleihe_id into o_ausleihe_id;

  perform velocity.fn_ausleihe_abrechnen(o_ausleihe_id);
  return next;
end;
$$;

create or replace function velocity_test.test_e_rechnung_je_kunde_und_monat()
returns setof text language plpgsql as $$
declare v_erst integer; v_zweit integer;
begin
  -- GR10 selbst pruefen, nicht den Zustand der Datenbank: eine eigene
  -- verrechenbare Fahrt in 03/2019, ausserhalb jedes Referenz- oder
  -- Altbestands. pgTAP fuehrt jede Testfunktion in einer eigenen
  -- Transaktion aus und rollt sie danach zurueck (siehe db/test.py) -
  -- der Testbestand bleibt also folgenlos.
  perform velocity_test.fixture_e_verrechenbare_fahrt('gr10', 2019, 3);

  v_erst  := velocity.fn_rechnung_erzeugen(2019, 3);
  -- GR10: ein zweiter Lauf darf keine zweite Rechnung erzeugen. Ohne
  -- diese Eigenschaft waere ein versehentlich wiederholter
  -- Monatsabschluss eine Doppelberechnung.
  v_zweit := velocity.fn_rechnung_erzeugen(2019, 3);
  return next cmp_ok(v_erst, '>', 0, 'Der erste Lauf erzeugt Rechnungen');
  return next is(v_zweit, 0, 'Der zweite Lauf erzeugt keine weiteren');
end;
$$;

create or replace function velocity_test.test_e_rechnungsbetrag_stimmt()
returns setof text language plpgsql as $$
declare v_r record;
begin
  -- Eigener Monat (04/2019) aus demselben Grund wie im Test oben: die
  -- Pruefung soll GR10/den Rechnungsbetrag treffen, nicht zufaellig
  -- davon abhaengen, ob eine Betriebsdatei diesen Monat schon
  -- abgerechnet hat.
  perform velocity_test.fixture_e_verrechenbare_fahrt('betrag', 2019, 4);
  perform velocity.fn_rechnung_erzeugen(2019, 4);
  select * into v_r from velocity.rechnung
   where periode_jahr = 2019 and periode_monat = 4
   order by rechnung_id limit 1;

  return next ok(v_r.rechnung_id is not null, 'Es gibt eine Rechnung fuer den Testmonat');
  return next is(v_r.betrag_brutto, round(v_r.betrag_netto * (1 + v_r.ust_satz / 100), 2),
                 'Brutto ist Netto plus Umsatzsteuer');
  return next is(
    (select round(sum(betrag), 2) from velocity.rechnungsposition
      where rechnung_id = v_r.rechnung_id),
    v_r.betrag_netto,
    'Der Rechnungsbetrag ist die Summe seiner Positionen');
end;
$$;
