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

create or replace function velocity_test.test_e_rechnung_je_kunde_und_monat()
returns setof text language plpgsql as $$
declare v_erst integer; v_zweit integer;
begin
  v_erst  := velocity.fn_rechnung_erzeugen(2026, 4);
  -- GR10: ein zweiter Lauf darf keine zweite Rechnung erzeugen. Ohne
  -- diese Eigenschaft waere ein versehentlich wiederholter
  -- Monatsabschluss eine Doppelberechnung.
  v_zweit := velocity.fn_rechnung_erzeugen(2026, 4);
  return next cmp_ok(v_erst, '>', 0, 'Der erste Lauf erzeugt Rechnungen');
  return next is(v_zweit, 0, 'Der zweite Lauf erzeugt keine weiteren');
end;
$$;

create or replace function velocity_test.test_e_rechnungsbetrag_stimmt()
returns setof text language plpgsql as $$
declare v_r record;
begin
  perform velocity.fn_rechnung_erzeugen(2026, 5);
  select * into v_r from velocity.rechnung
   where periode_jahr = 2026 and periode_monat = 5
   order by rechnung_id limit 1;

  return next ok(v_r.rechnung_id is not null, 'Es gibt eine Rechnung fuer 05/2026');
  return next is(v_r.betrag_brutto, round(v_r.betrag_netto * (1 + v_r.ust_satz / 100), 2),
                 'Brutto ist Netto plus Umsatzsteuer');
  return next is(
    (select round(sum(betrag), 2) from velocity.rechnungsposition
      where rechnung_id = v_r.rechnung_id),
    v_r.betrag_netto,
    'Der Rechnungsbetrag ist die Summe seiner Positionen');
end;
$$;
