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
           (tarif_id, gueltigkeit, freiminuten_pro_monat, rabatt_prozent)
         values (v_tarif, daterange(current_date - 365, null, '[)'), p_freiminuten, p_rabatt);
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
         (kunde_id, fahrrad_id, mitgliedschaft_id, start_latitude, start_longitude,
          startzeit, status)
       values (o_kunde_id, v_rad, v_mgl, 49.790000, 9.930000,
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
  select * into v_e from velocity.fn_ausleihe_beenden(v_f.o_kunde_id, v_f.o_ausleihe_id, null, 49.780000, 9.940000);

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
  select * into v_e from velocity.fn_ausleihe_beenden(v_f.o_kunde_id, v_f.o_ausleihe_id, null, 49.780000, 9.940000);

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
  select * into v_e from velocity.fn_ausleihe_beenden(v_f.o_kunde_id, v_f.o_ausleihe_id, null, 49.780000, 9.940000);

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
  select * into v_e from velocity.fn_ausleihe_beenden(v_f.o_kunde_id, v_f.o_ausleihe_id, null, 49.780000, 9.940000);

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
  select * into v_e from velocity.fn_ausleihe_beenden(v_f.o_kunde_id, v_f.o_ausleihe_id, null, 49.780000, 9.940000);

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
  select * into v_e from velocity.fn_ausleihe_beenden(v_f.o_kunde_id, v_f.o_ausleihe_id, null, 49.780000, 9.940000);

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

  select * into v_e from velocity.fn_ausleihe_beenden(v_fremd, v_f.o_ausleihe_id, null, 49.780000, 9.940000);
  return next is(v_e.meldung, 'Keine Berechtigung für diese Ausleihe',
                 'Fremde Ausleihe kann nicht beendet werden (GR9)');
  return next is((select status::text from velocity.ausleihe where ausleihe_id = v_f.o_ausleihe_id),
                 'aktiv', 'Die fremde Ausleihe bleibt unveraendert aktiv');

  perform velocity.fn_ausleihe_beenden(v_f.o_kunde_id, v_f.o_ausleihe_id, null, 49.780000, 9.940000);
  select * into v_e from velocity.fn_ausleihe_beenden(v_f.o_kunde_id, v_f.o_ausleihe_id, null, 49.780000, 9.940000);
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
    insert into velocity.fahrrad_position (fahrrad_id, latitude, longitude)
         values (v_rad, 49.790000, 9.930000);
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

  select * into v_e from velocity.api_ausleihe_beenden(1::bigint, null, 49.780000, 9.940000);
  return next is(v_e.meldung, 'Nicht angemeldet', 'api_ausleihe_beenden weist anonyme Aufrufe ab');
end;
$$;

create or replace function velocity_test.test_p_abrechnen_gleicht_beenden()
returns setof text language plpgsql as $$
declare
  v_f1 record; v_f2 record; v_e1 record; v_a1 bigint; v_a2 bigint;
  v_summe1 numeric; v_summe2 numeric; v_station bigint;
begin
  select station_id into v_station from velocity.station order by station_id limit 1;

  -- Weg A: die Fahrt wird regulaer beendet.
  select * into v_f1 from velocity_test.fixture_rad('abr-a');
  -- fixture_rad legt einen frischen Fahrradtyp ohne Preis an; ohne einen
  -- gueltigen nutzungspreis liefe die Bepreisung sofort in P0002.
  -- Der niedrige Tageshoechstpreis (5.00 gegen 1.00 + 37 x 0.20 = 8.40)
  -- ist bewusst so gewaehlt, dass die Kappung greift - sonst deckte der
  -- Vergleich nur zwei der fuenf moeglichen Positionsarten ab.
  insert into velocity.nutzungspreis (typ_id, gueltigkeit, startgebuehr, preis_pro_minute, tageshoechstpreis)
    select m.typ_id, daterange(current_date - 365, null, '[)'), 1.00, 0.20, 5.00
      from velocity.fahrrad f join velocity.fahrradmodell m on m.modell_id = f.modell_id
     where f.fahrrad_id = v_f1.o_fahrrad_id;
  insert into velocity.ausleihe (kunde_id, fahrrad_id, start_station_id, startzeit)
       values (v_f1.o_kunde_id, v_f1.o_fahrrad_id, v_station, now() - interval '37 minutes')
    returning ausleihe_id into v_a1;
  select * into v_e1 from velocity.fn_ausleihe_beenden(v_f1.o_kunde_id, v_a1, v_station);
  v_summe1 := v_e1.gesamtbetrag;

  -- Weg B: die Fahrt ist schon abgeschlossen und wird nur bepreist.
  select * into v_f2 from velocity_test.fixture_rad('abr-b');
  insert into velocity.nutzungspreis (typ_id, gueltigkeit, startgebuehr, preis_pro_minute, tageshoechstpreis)
    select m.typ_id, daterange(current_date - 365, null, '[)'), 1.00, 0.20, 5.00
      from velocity.fahrrad f join velocity.fahrradmodell m on m.modell_id = f.modell_id
     where f.fahrrad_id = v_f2.o_fahrrad_id;
  insert into velocity.ausleihe (kunde_id, fahrrad_id, start_station_id, startzeit,
                                 end_station_id, endzeit, status)
       values (v_f2.o_kunde_id, v_f2.o_fahrrad_id, v_station, now() - interval '37 minutes',
               v_station, now(), 'abgeschlossen')
    returning ausleihe_id into v_a2;
  v_summe2 := velocity.fn_ausleihe_abrechnen(v_a2);

  -- Ohne diese Pruefung waere is(NULL, NULL) auch gruen, wenn Weg A aus
  -- einem ganz anderen Grund gescheitert waere und gesamtbetrag deshalb
  -- leer bliebe.
  return next is(v_e1.meldung, 'Ausleihe beendet',
                 'Weg A ist tatsaechlich erfolgreich beendet worden');
  return next is(v_summe2, v_summe1,
                 'Beide Wege kommen auf denselben Betrag');
  return next results_eq(
    format($q$ select ea.code, ep.menge, ep.einzelbetrag, ep.betrag
                 from velocity.entgeltposition ep
                 join velocity.entgeltart ea using (entgeltart_id)
                where ep.ausleihe_id = %s order by ep.sortierung $q$, v_a2),
    format($q$ select ea.code, ep.menge, ep.einzelbetrag, ep.betrag
                 from velocity.entgeltposition ep
                 join velocity.entgeltart ea using (entgeltart_id)
                where ep.ausleihe_id = %s order by ep.sortierung $q$, v_a1),
    'Beide Wege erzeugen dieselben Positionen in derselben Reihenfolge');
end;
$$;

create or replace function velocity_test.test_p_abrechnen_weist_offene_fahrt_ab()
returns setof text language plpgsql as $$
declare v_f record; v_a bigint; v_station bigint;
begin
  select station_id into v_station from velocity.station order by station_id limit 1;
  select * into v_f from velocity_test.fixture_rad('abr-offen');
  -- ausleihe_startort_chk verlangt genau eine Ortsangabe; die Station
  -- steht hier fuer den Start, weil die Fahrt gar nicht so weit kommen
  -- soll - es geht nur um die fehlende endzeit.
  insert into velocity.ausleihe (kunde_id, fahrrad_id, start_station_id, startzeit)
       values (v_f.o_kunde_id, v_f.o_fahrrad_id, v_station, now() - interval '10 minutes')
    returning ausleihe_id into v_a;
  -- Eine laufende Fahrt hat noch keine Dauer. Sie zu bepreisen hiesse,
  -- eine Zahl zu erfinden. Der Meldungstext ist Teil der Erwartung,
  -- damit der Test nicht auch bei einer ganz anderen Ausnahme mit
  -- demselben SQLSTATE gruen bliebe.
  return next throws_ok(
    format($q$ select velocity.fn_ausleihe_abrechnen(%s) $q$, v_a),
    'P0001', format('Ausleihe %s ist noch nicht beendet', v_a),
    'Eine noch laufende Fahrt wird nicht bepreist');
end;
$$;

create or replace function velocity_test.test_p_abrechnen_weist_stornierte_fahrt_ab()
returns setof text language plpgsql as $$
declare v_f record; v_a bigint; v_station bigint;
begin
  select station_id into v_station from velocity.station order by station_id limit 1;
  select * into v_f from velocity_test.fixture_rad('abr-storno');
  -- ausleihe_abgeschlossen_chk verlangt eine Endzeit nur bei Status
  -- 'abgeschlossen', verbietet sie bei 'storniert' aber nicht - eine
  -- stornierte Fahrt kann also technisch eine Endzeit tragen. Ohne den
  -- eigenen Statuswaechter in fn_ausleihe_abrechnen wuerde sie trotzdem
  -- bepreist, obwohl sie storniert und nicht abgeschlossen ist.
  insert into velocity.ausleihe (kunde_id, fahrrad_id, start_station_id, startzeit,
                                 end_station_id, endzeit, status)
       values (v_f.o_kunde_id, v_f.o_fahrrad_id, v_station, now() - interval '15 minutes',
               v_station, now(), 'storniert')
    returning ausleihe_id into v_a;
  return next throws_ok(
    format($q$ select velocity.fn_ausleihe_abrechnen(%s) $q$, v_a),
    'P0001', format('Ausleihe %s ist nicht abgeschlossen (Status %s)', v_a, 'storniert'),
    'Eine stornierte Fahrt wird nicht bepreist, auch wenn sie eine Endzeit traegt');
end;
$$;

create or replace function velocity_test.test_p_abrechnen_nur_einmal()
returns setof text language plpgsql as $$
declare v_f record; v_a bigint; v_station bigint;
begin
  select station_id into v_station from velocity.station order by station_id limit 1;
  select * into v_f from velocity_test.fixture_rad('abr-doppelt');
  -- fixture_preisfall passt hier nicht: sie legt die Ausleihe selbst als
  -- 'aktiv' an (fuer Tests von fn_ausleihe_beenden), diese Ausleihe muss
  -- aber schon 'abgeschlossen' sein, damit fn_ausleihe_abrechnen sie
  -- ueberhaupt annimmt. Deshalb fixture_rad und der Preis von Hand.
  insert into velocity.nutzungspreis (typ_id, gueltigkeit, startgebuehr, preis_pro_minute, tageshoechstpreis)
    select m.typ_id, daterange(current_date - 365, null, '[)'), 1.00, 0.20, 20.00
      from velocity.fahrrad f join velocity.fahrradmodell m on m.modell_id = f.modell_id
     where f.fahrrad_id = v_f.o_fahrrad_id;
  insert into velocity.ausleihe (kunde_id, fahrrad_id, start_station_id, startzeit,
                                 end_station_id, endzeit, status)
       values (v_f.o_kunde_id, v_f.o_fahrrad_id, v_station, now() - interval '20 minutes',
               v_station, now(), 'abgeschlossen')
    returning ausleihe_id into v_a;
  perform velocity.fn_ausleihe_abrechnen(v_a);
  -- Zweimal abrechnen hiesse zweimal kassieren.
  return next throws_ok(
    format($q$ select velocity.fn_ausleihe_abrechnen(%s) $q$, v_a),
    'P0001', format('Ausleihe %s ist bereits abgerechnet', v_a),
    'Eine bereits bepreiste Fahrt wird nicht erneut bepreist');
end;
$$;
