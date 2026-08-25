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
-- Vorrichtung fuer die folgenden Tests: eine eigene, garantiert
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
--
-- Die alte, vierparametrige Fassung wird explizit weggeworfen: "create
-- or replace" ersetzt eine Funktion nur bei identischer Signatur, bei
-- zusaetzlichen Parametern legt es einen zweiten, ueberladenen
-- Eintrag an. Ohne den drop bliebe die alte Fassung stehen und ein
-- Aufruf mit nur drei Argumenten (beide haben p_dauer als einzigen
-- Pflichtparameter mit Default) waere doppeldeutig - "is not unique".
drop function if exists velocity_test.fixture_e_verrechenbare_fahrt(text, integer, integer, integer);

-- Die Preisparameter sind absichtlich frei waehlbar (nicht nur die
-- Dauer): test_e_rechnungsbetrag_stimmt braucht eine Fahrt, deren
-- Positionen NICHT alle dasselbe Vorzeichen tragen, sonst waere ein
-- Rueckfall der doppelten Vorzeichenanwendung (siehe
-- fn_rechnung_erzeugen, GR10-Kommentar) unsichtbar: fuer
-- ausschliesslich positive Positionen ist betrag * vorzeichen dasselbe
-- wie betrag. Ueber einen niedrigen tageshoechstpreis entsteht eine
-- HOECHSTPREIS_KAPPUNG-Position (vorzeichen -1) - der billigste Weg zu
-- einer negativen Position, weil er nur Zahlen aendert und keine
-- weiteren Tabellen (Tarif, Mitgliedschaft, Freiminuten) braucht.
create or replace function velocity_test.fixture_e_verrechenbare_fahrt(
  p_suffix        text,
  p_jahr          integer,
  p_monat         integer,
  p_dauer         integer default 30,
  p_startgebuehr  numeric default 1.00,
  p_minutenpreis  numeric default 0.10,
  p_hoechstpreis  numeric default 20.00
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
               p_startgebuehr, p_minutenpreis, p_hoechstpreis);

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
declare
  v_a      record;   -- Fahrt A: wird gekappt, bleibt aber verrechenbar (netto > 0)
  v_b      record;   -- Fahrt B: wird auf genau 0 gekappt, darf keine Rechnung ergeben
  v_zahl   integer;
  v_r      record;
begin
  -- Eigener Monat (07/2019) aus demselben Grund wie im Test oben: die
  -- Pruefung soll fn_rechnung_erzeugen selbst treffen, nicht zufaellig
  -- davon abhaengen, ob eine Betriebsdatei diesen Monat schon
  -- abgerechnet hat.
  --
  -- Fahrt A: Startgebuehr 5,00 + 20 Minuten a 1,00 = 25,00 vor der
  -- Kappung; der Tageshoechstpreis liegt bei 12,00, die Kappung zieht
  -- also 13,00 als eigene (negative) Position ab. Der erwartete
  -- Nettobetrag ist deshalb GENAU der gewaehlte Tageshoechstpreis -
  -- ein von Hand gebildeter Erwartungswert aus den Parametern, die
  -- dieser Test selbst gesetzt hat, nicht die in fn_rechnung_erzeugen
  -- verwendete Summenformel gegen sich selbst. Wuerde die doppelte
  -- Vorzeichenanwendung aus dem urspruenglichen Planentwurf
  -- zurueckkehren, wuerde die Kappung den Betrag ERHOEHEN statt
  -- senken (25,00 + 13,00 = 38,00) - dieser Test wird dann rot, statt
  -- faelschlich gruen zu bleiben, wie es die vorherige Fassung ohne
  -- jede negative Position getan haette.
  select * into v_a from velocity_test.fixture_e_verrechenbare_fahrt(
    p_suffix => 'kappung_a', p_jahr => 2019, p_monat => 7,
    p_dauer => 20, p_startgebuehr => 5.00, p_minutenpreis => 1.00, p_hoechstpreis => 12.00);

  -- Fahrt B: Startgebuehr 0,00 + 5 Minuten a 1,00 = 5,00 vor der
  -- Kappung, Tageshoechstpreis 0,00 - die Kappung zieht die vollen
  -- 5,00 wieder ab, der Nettobetrag ist exakt 0,00. Damit durchlaeuft
  -- dieser Test auch den having-Filter in fn_rechnung_erzeugen
  -- (`> 0`), der bislang nie griff: kein Kunde in den Referenzdaten
  -- oder den bisherigen Tests hatte je eine Monatssumme von 0 oder
  -- darunter.
  select * into v_b from velocity_test.fixture_e_verrechenbare_fahrt(
    p_suffix => 'kappung_b', p_jahr => 2019, p_monat => 7,
    p_dauer => 5, p_startgebuehr => 0.00, p_minutenpreis => 1.00, p_hoechstpreis => 0.00);

  v_zahl := velocity.fn_rechnung_erzeugen(2019, 7);
  return next is(v_zahl, 1,
    'Von zwei Kunden im Testmonat erzeugt nur der mit positivem Nettobetrag eine Rechnung');

  select * into v_r from velocity.rechnung
   where periode_jahr = 2019 and periode_monat = 7 and kunde_id = v_a.o_kunde_id;
  return next ok(v_r.rechnung_id is not null, 'Es gibt eine Rechnung fuer die gekappte, aber positive Fahrt');
  return next is(v_r.betrag_netto, 12.00::numeric(10,2),
                 'Der Nettobetrag entspricht dem von Hand vorgegebenen Tageshoechstpreis');
  return next is(v_r.betrag_brutto, 14.28::numeric(10,2),
                 'Der Bruttobetrag entspricht Netto plus 19 Prozent Umsatzsteuer');
  return next is(
    (select round(sum(betrag), 2) from velocity.rechnungsposition
      where rechnung_id = v_r.rechnung_id),
    v_r.betrag_netto,
    'Der Rechnungsbetrag ist die Summe seiner Positionen');

  return next is(
    (select count(*) from velocity.rechnung
      where periode_jahr = 2019 and periode_monat = 7 and kunde_id = v_b.o_kunde_id),
    0::bigint,
    'Eine vollstaendig gekappte Fahrt (Nettobetrag 0) erzeugt keine Rechnung');
end;
$$;
