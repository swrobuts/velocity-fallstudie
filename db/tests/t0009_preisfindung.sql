-- =====================================================================
-- t0009 Geschaeftslogik und Preisfindung
--
-- Preisgrundlage aller Faelle: Startgebuehr 0,10 EUR,
-- 0,10 EUR je Minute, Dauer 61 Minuten => Zwischensumme 6,20 EUR.
-- =====================================================================
create schema if not exists velocity_test;
set search_path = velocity_test, velocity, extensions, public;

-- Vorrichtung: Typ, Preis, Rad, Kunde, optionaler Tarif und eine
-- laufende Ausleihe mit definierter Dauer. Die Startzeit liegt
-- 60 Minuten und 30 Sekunden zurueck, damit das Aufrunden auf
-- angefangene Minuten reproduzierbar 61 ergibt.
create or replace function velocity_test.fixture_preisfall(
  p_suffix            text,
  p_tageshoechstpreis numeric,
  p_freiminuten       integer,   -- NULL = keine Mitgliedschaft
  p_rabatt            numeric
)
returns table (o_kunde_id bigint, o_ausleihe_id bigint, o_periode_id bigint)
language plpgsql as $$
declare
  v_typ bigint; v_h bigint; v_m bigint; v_rad bigint;
  v_tarif bigint; v_mgl bigint;
begin
  insert into velocity.fahrradtyp (typ_code, bezeichnung)
       values ('P-' || p_suffix, 'Preisfall ' || p_suffix) returning typ_id into v_typ;
  insert into velocity.nutzungspreis
         (typ_id, gueltigkeit, startgebuehr, preis_pro_minute, tageshoechstpreis)
       values (v_typ, daterange(current_date - 365, null, '[)'), 0.10, 0.10, p_tageshoechstpreis);
  insert into velocity.hersteller (name) values ('H-' || p_suffix) returning hersteller_id into v_h;
  insert into velocity.fahrradmodell (hersteller_id, typ_id, modellbezeichnung)
       values (v_h, v_typ, 'M-' || p_suffix) returning modell_id into v_m;
  insert into velocity.fahrrad (rahmennummer, modell_id, status)
       values ('RN-P-' || p_suffix, v_m, 'ausgeliehen') returning fahrrad_id into v_rad;
  insert into velocity.fahrrad_position (fahrrad_id) values (v_rad);

  insert into velocity.kunde (email, vorname, nachname)
       values ('p-' || p_suffix || '@example.org', 'Paul', 'Preis')
    returning kunde_id into o_kunde_id;

  o_periode_id := null;
  v_mgl := null;
  if p_freiminuten is not null then
    insert into velocity.tarif (tarif_code, bezeichnung, art)
         values ('P-' || p_suffix, 'Tarif ' || p_suffix, 'vorteil') returning tarif_id into v_tarif;
    insert into velocity.tarif_kondition
           (tarif_id, gueltigkeit, monatspreis, freiminuten_pro_monat, rabatt_prozent)
         values (v_tarif, daterange(current_date - 365, null, '[)'), 0, p_freiminuten, p_rabatt);
    insert into velocity.mitgliedschaft (kunde_id, tarif_id, gueltigkeit)
         values (o_kunde_id, v_tarif, daterange(current_date - 365, null, '[)'))
      returning mitgliedschaft_id into v_mgl;
    insert into velocity.freiminuten_periode
           (mitgliedschaft_id, jahr, monat, kontingent_minuten, verbraucht_minuten)
         values (v_mgl,
                 extract(year  from now())::int,
                 extract(month from now())::int,
                 p_freiminuten, 0)
      returning periode_id into o_periode_id;
  end if;

  insert into velocity.ausleihe
         (kunde_id, fahrrad_id, mitgliedschaft_id, startzeit, status)
       values (o_kunde_id, v_rad, v_mgl,
               now() - interval '60 minutes 30 seconds', 'aktiv')
    returning ausleihe_id into o_ausleihe_id;

  return next;
end;
$$;

create or replace function velocity_test.test_p1_ohne_tarif()
returns setof text language plpgsql as $$
declare v_f record; v_e record;
begin
  select * into v_f from velocity_test.fixture_preisfall('f1', 10.00, null, 0);
  select * into v_e from velocity.fn_ausleihe_beenden(v_f.o_kunde_id, v_f.o_ausleihe_id, null, null, null);

  return next is(v_e.dauer_minuten, 61, 'Dauer wird auf 61 angefangene Minuten aufgerundet');
  return next is(v_e.gesamtbetrag, 6.20::numeric, 'Ohne Tarif: 0,10 + 61 x 0,10 = 6,20 EUR');
  return next is((select count(*)::int from velocity.entgeltposition
                   where ausleihe_id = v_f.o_ausleihe_id), 2,
                 'Zwei Positionen: Startgebuehr und Zeitentgelt');
  return next is((select sum(betrag) from velocity.entgeltposition
                   where ausleihe_id = v_f.o_ausleihe_id), 6.20::numeric,
                 'Summe der Positionen entspricht dem Rueckgabewert');
  return next is((select status::text from velocity.ausleihe where ausleihe_id = v_f.o_ausleihe_id),
                 'abgeschlossen', 'Ausleihe ist abgeschlossen');
end;
$$;

create or replace function velocity_test.test_p2_freiminuten_teilweise()
returns setof text language plpgsql as $$
declare v_f record; v_e record;
begin
  select * into v_f from velocity_test.fixture_preisfall('f2', 10.00, 30, 0);
  select * into v_e from velocity.fn_ausleihe_beenden(v_f.o_kunde_id, v_f.o_ausleihe_id, null, null, null);

  -- 0,10 + 6,10 - 3,00 (30 Freiminuten x 0,10)
  return next is(v_e.gesamtbetrag, 3.20::numeric, 'Teilweise Freiminuten: 3,20 EUR');
  return next is((select betrag from velocity.entgeltposition p
                    join velocity.entgeltart a on a.entgeltart_id = p.entgeltart_id
                   where p.ausleihe_id = v_f.o_ausleihe_id and a.code = 'FREIMINUTEN'),
                 (-3.00)::numeric, 'Freiminuten stehen als eigene Gutschrift auf der Rechnung');
  return next is((select verbraucht_minuten from velocity.freiminuten_periode
                   where periode_id = v_f.o_periode_id), 30,
                 'Genau die verrechneten Freiminuten werden abgebucht');
end;
$$;

create or replace function velocity_test.test_p3_freiminuten_vollstaendig()
returns setof text language plpgsql as $$
declare v_f record; v_e record;
begin
  select * into v_f from velocity_test.fixture_preisfall('f3', 10.00, 300, 0);
  select * into v_e from velocity.fn_ausleihe_beenden(v_f.o_kunde_id, v_f.o_ausleihe_id, null, null, null);

  return next is(v_e.gesamtbetrag, 0.10::numeric, 'Volle Freiminutendeckung: nur Startgebuehr');
  return next is((select verbraucht_minuten from velocity.freiminuten_periode
                   where periode_id = v_f.o_periode_id), 61,
                 'Es werden nur die tatsaechlich gefahrenen Minuten abgebucht, nicht das ganze Kontingent');
end;
$$;

create or replace function velocity_test.test_p4_tarifrabatt()
returns setof text language plpgsql as $$
declare v_f record; v_e record;
begin
  select * into v_f from velocity_test.fixture_preisfall('f4', 10.00, 0, 20.00);
  select * into v_e from velocity.fn_ausleihe_beenden(v_f.o_kunde_id, v_f.o_ausleihe_id, null, null, null);

  -- 6,20 - 20 Prozent (1,24) = 4,96
  return next is(v_e.gesamtbetrag, 4.96::numeric, 'Rabatt von 20 Prozent ergibt 4,96 EUR');
  return next is((select betrag from velocity.entgeltposition p
                    join velocity.entgeltart a on a.entgeltart_id = p.entgeltart_id
                   where p.ausleihe_id = v_f.o_ausleihe_id and a.code = 'TARIFRABATT'),
                 (-1.24)::numeric, 'Rabatt steht als eigene Position auf der Rechnung');
end;
$$;

create or replace function velocity_test.test_p5_hoechstpreis_kappung()
returns setof text language plpgsql as $$
declare v_f record; v_e record;
begin
  select * into v_f from velocity_test.fixture_preisfall('f5', 5.00, null, 0);
  select * into v_e from velocity.fn_ausleihe_beenden(v_f.o_kunde_id, v_f.o_ausleihe_id, null, null, null);

  return next is(v_e.gesamtbetrag, 5.00::numeric, 'Betrag wird auf den Tageshoechstpreis gekappt');
  return next is((select betrag from velocity.entgeltposition p
                    join velocity.entgeltart a on a.entgeltart_id = p.entgeltart_id
                   where p.ausleihe_id = v_f.o_ausleihe_id and a.code = 'HOECHSTPREIS_KAPPUNG'),
                 (-1.20)::numeric, 'Die Kappung bleibt als Position sichtbar');
end;
$$;

create or replace function velocity_test.test_p6_reihenfolge_rabatt_vor_kappung()
returns setof text language plpgsql as $$
declare v_f record; v_e record;
begin
  -- Hoechstpreis 5,00 und 20 Prozent Rabatt: 6,20 - 1,24 = 4,96 liegt
  -- unter der Kappungsgrenze, es wird also NICHT gekappt. Waere die
  -- Reihenfolge umgekehrt, kaeme 4,00 heraus.
  select * into v_f from velocity_test.fixture_preisfall('f6', 5.00, 0, 20.00);
  select * into v_e from velocity.fn_ausleihe_beenden(v_f.o_kunde_id, v_f.o_ausleihe_id, null, null, null);

  return next is(v_e.gesamtbetrag, 4.96::numeric,
                 'Rabatt wird vor der Kappung angewandt (Geschaeftsregel)');
  return next is((select count(*)::int from velocity.entgeltposition p
                    join velocity.entgeltart a on a.entgeltart_id = p.entgeltart_id
                   where p.ausleihe_id = v_f.o_ausleihe_id and a.code = 'HOECHSTPREIS_KAPPUNG'),
                 0, 'Ohne Ueberschreitung entsteht keine Kappungsposition');
end;
$$;

create or replace function velocity_test.test_p7_zugriffsschutz_und_grenzen()
returns setof text language plpgsql as $$
declare v_f record; v_fremd bigint; v_e record;
begin
  select * into v_f from velocity_test.fixture_preisfall('f7', 10.00, null, 0);
  insert into velocity.kunde (email, vorname, nachname)
       values ('fremd@example.org', 'Frieda', 'Fremd') returning kunde_id into v_fremd;

  select * into v_e from velocity.fn_ausleihe_beenden(v_fremd, v_f.o_ausleihe_id, null, null, null);
  return next is(v_e.meldung, 'Keine Berechtigung fuer diese Ausleihe',
                 'Fremde Ausleihe kann nicht beendet werden (GR9)');
  return next is((select status::text from velocity.ausleihe where ausleihe_id = v_f.o_ausleihe_id),
                 'aktiv', 'Die fremde Ausleihe bleibt unveraendert aktiv');

  perform velocity.fn_ausleihe_beenden(v_f.o_kunde_id, v_f.o_ausleihe_id, null, null, null);
  select * into v_e from velocity.fn_ausleihe_beenden(v_f.o_kunde_id, v_f.o_ausleihe_id, null, null, null);
  return next is(v_e.meldung, 'Ausleihe ist nicht aktiv',
                 'Eine bereits beendete Ausleihe wird nicht erneut abgerechnet');
end;
$$;

create or replace function velocity_test.test_p8_hoechstens_vier_aktive()
returns setof text language plpgsql as $$
declare
  v_kunde bigint; v_typ bigint; v_h bigint; v_m bigint; v_rad bigint;
  v_e record; i int;
begin
  insert into velocity.kunde (email, vorname, nachname)
       values ('p8@example.org', 'Vier', 'Raeder') returning kunde_id into v_kunde;
  insert into velocity.fahrradtyp (typ_code, bezeichnung) values ('P-8', 'Grenzfall') returning typ_id into v_typ;
  insert into velocity.nutzungspreis (typ_id, gueltigkeit, startgebuehr, preis_pro_minute, tageshoechstpreis)
       values (v_typ, daterange(current_date - 365, null, '[)'), 0.10, 0.10, 10.00);
  insert into velocity.hersteller (name) values ('H-8') returning hersteller_id into v_h;
  insert into velocity.fahrradmodell (hersteller_id, typ_id, modellbezeichnung)
       values (v_h, v_typ, 'M-8') returning modell_id into v_m;

  for i in 1..5 loop
    insert into velocity.fahrrad (rahmennummer, modell_id) values ('RN-P8-' || i, v_m)
      returning fahrrad_id into v_rad;
    insert into velocity.fahrrad_position (fahrrad_id) values (v_rad);
    select * into v_e from velocity.fn_ausleihe_starten(v_kunde, v_rad);
    if i <= 4 then
      return next ok(v_e.ausleihe_id is not null, format('Ausleihe %s wird angenommen', i));
    else
      return next is(v_e.meldung, 'Maximale Anzahl aktiver Ausleihen (4) erreicht',
                     'Die fuenfte gleichzeitige Ausleihe wird abgewiesen (GR2)');
    end if;
  end loop;
end;
$$;

create or replace function velocity_test.test_p9_api_ohne_anmeldung()
returns setof text language plpgsql as $$
declare v_e record;
begin
  -- Ohne JWT liefert auth.uid() NULL; die api-Schicht muss das abfangen,
  -- statt in einen Fehler zu laufen.
  select * into v_e from velocity.api_ausleihe_starten(1::bigint);
  return next is(v_e.meldung, 'Nicht angemeldet', 'api_ausleihe_starten weist anonyme Aufrufe ab');

  select * into v_e from velocity.api_ausleihe_beenden(1::bigint, null, null, null);
  return next is(v_e.meldung, 'Nicht angemeldet', 'api_ausleihe_beenden weist anonyme Aufrufe ab');
end;
$$;
