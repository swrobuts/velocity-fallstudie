-- =====================================================================
--  REFERENZDATEN, TEIL 1: GRUNDLAGE
--
--  ACHTUNG: Diese Datei erzeugt ERFUNDENE Daten. Sie sind plausibel
--  gebaut, aber sie messen nichts. Kein Wert hier ist erhoben.
--
--  Anlass: die Auswertungen der Warenwirtschaft brauchen etwas zum
--  Auswerten. In velocity.ausleihe liegen 23 abgeschlossene Fahrten,
--  und keine einzige traegt eine Position aus der Preislogik - alle nur
--  den Pauschalbetrag BESTANDSUEBERNAHME aus dem Altsystem.
--
--  Diese Datei legt die Grundlage fuer das Referenzjahr
--  01.09.2025 bis 24.08.2026:
--
--    1. Preisperioden, die vor dem 22.08.2026 beginnen. Ohne sie
--       schlaegt fn_ausleihe_abrechnen mit "Kein gueltiger Preis" fehl.
--    2. Einen Preiswechsel zum 01.03.2026 - mit Absicht. Bisher zeigt
--       die Historisierung nur das Schema. Mit einem Wechsel mitten im
--       Referenzjahr wird sie in den Daten sichtbar: Fahrten davor
--       rechnen weiter mit dem alten Satz (GR5), und in der
--       Monatsauswertung ist der Sprung zu sehen.
--    3. Tarifkonditionen rueckwirkend ab 01.09.2025. Sie gelten heute
--       erst ab 22.08.2026; ohne Rueckdatierung gaebe es im ganzen
--       Referenzjahr weder Freiminuten noch Premium-Rabatt.
--    4. Rund 400 Mitgliedschaften. Heute haben 10 von 1014 Kunden eine
--       - eine Umsatzauswertung nach Kundengruppe waere damit leer.
--    5. Den ersten Mitarbeiter.
--
--  Idempotent: jeder Block prueft, ob er schon gelaufen ist.
--
--  Ruecknahme: siehe Block 6 am Dateiende (auskommentiert).
-- =====================================================================

begin;

-- ---- 1 und 2: Preisperioden des Referenzjahres ----------------------
-- Nur der Minutenpreis aendert sich zum 01.03.2026. Startgebuehr und
-- Tageshoechstpreis bleiben gleich - so haengt der sichtbare Sprung in
-- der Auswertung an genau einer Groesse und laesst sich nachrechnen.
--
-- Kein "on conflict": auf nutzungspreis liegt ein EXCLUDE-Constraint,
-- und ON CONFLICT arbeitet nur mit eindeutigen Indizes.
insert into velocity.nutzungspreis
       (typ_id, gueltigkeit, startgebuehr, preis_pro_minute, tageshoechstpreis)
select t.typ_id, p.zeitraum, p.startgebuehr, p.minute, p.hoechst
  from (values
    ('CITY',  daterange(date '2025-09-01', date '2026-03-01', '[)'), 0.10, 0.08, 10.00),
    ('EBIKE', daterange(date '2025-09-01', date '2026-03-01', '[)'), 1.00, 0.20, 15.00),
    ('CARGO', daterange(date '2025-09-01', date '2026-03-01', '[)'), 2.00, 0.40, 22.00),
    ('CITY',  daterange(date '2026-03-01', date '2026-08-22', '[)'), 0.10, 0.10, 10.00),
    ('EBIKE', daterange(date '2026-03-01', date '2026-08-22', '[)'), 1.00, 0.25, 15.00),
    ('CARGO', daterange(date '2026-03-01', date '2026-08-22', '[)'), 2.00, 0.50, 22.00)
  ) as p(typ_code, zeitraum, startgebuehr, minute, hoechst)
  join velocity.fahrradtyp t on t.typ_code = p.typ_code
 where not exists (
   select 1 from velocity.nutzungspreis np
    where np.typ_id = t.typ_id and np.gueltigkeit && p.zeitraum
 );

-- ---- 3: Tarifkonditionen rueckdatieren ------------------------------
-- Nicht eine zweite Periode einfuegen, sondern die bestehende nach
-- vorn oeffnen: die Konditionen haben sich nie geaendert. Eine zweite
-- Periode mit identischen Werten waere eine Aenderung, die es nie gab.
update velocity.tarif_kondition k
   set gueltigkeit = daterange(date '2025-09-01', upper(k.gueltigkeit), '[)')
 where lower(k.gueltigkeit) > date '2025-09-01';

-- ---- 4: Mitgliedschaften --------------------------------------------
--
-- ABWEICHUNG VOM URSPRUENGLICHEN ENTWURF: der Block prueft zusaetzlich
-- ueber das Uebernahmeprotokoll, ob er schon einmal vollstaendig
-- gelaufen ist, und tut beim zweiten Lauf GAR NICHTS mehr - nicht nur
-- "so lange, bis 400 erreicht sind". Testlauf: auf 495 aktiven Kunden
-- fand die reine "not exists"-Bedingung beim ersten Lauf 485 Kandidaten
-- und legte, wie gewollt, 400 Mitgliedschaften an. Beim zweiten Lauf
-- waren aber immer noch 85 aktive Kunden ohne Mitgliedschaft uebrig -
-- die Bedingung allein haette sie beim zweiten Lauf zusaetzlich
-- angelegt (410 -> 496 Mitgliedschaften, dazu passende
-- freiminuten_periode-Zeilen), weil "hoechstens 400 pro Lauf" nicht
-- dasselbe ist wie "insgesamt genau einmal". Der Marker aus dem
-- Uebernahmeprotokoll traegt hier die Idempotenz, nicht die
-- Kandidatenauswahl.
--
-- v_neu wird am Ende des Blocks per set_config() in eine
-- transaktionslokale Einstellung geschrieben (dritter Parameter true =
-- nur fuer diese Transaktion, verschwindet beim commit). Grund: das
-- Uebernahmeprotokoll unten in Schritt 6 muss das DELTA dieses Laufs
-- eintragen, nicht den Gesamtbestand - wie db/betrieb/uebernahme_altdaten.sql
-- es mit v_nachher - v_vorher vorrechnet, und wie t0013_uebernahme.sql
-- es prueft. Der Wert entsteht aber als lokale PL/pgSQL-Variable in
-- diesem anonymen Block und waere ausserhalb seines "end;" verloren;
-- set_config/current_setting ist der uebliche Weg, einen Wert innerhalb
-- derselben Transaktion ueber Blockgrenzen hinweg weiterzureichen, ohne
-- eine Tabelle dafuer anzulegen.
do $$
declare
  c_anzahl constant integer := 400;
  v_neu    integer;
begin
  if exists (
    select 1 from velocity.uebernahme_protokoll
     where quelle = 'Referenzdaten (erzeugt)'
       and ziel like 'velocity.nutzungspreis%'
  ) then
    -- Nichts Neues in diesem Lauf - das Protokoll unten traegt dafuer
    -- 0 ein, nicht (versehentlich) den letzten bekannten Wert.
    perform set_config('velocity.referenzdaten_mitgliedschaft_neu', '0', true);
    raise notice 'Mitgliedschaften bereits angelegt, Block 4 wird uebersprungen';
    return;
  end if;

  perform setseed(0.4711);

  -- Verteilung: die meisten fahren im Basistarif, Premium ist die
  -- Ausnahme. Eine Gleichverteilung ueber vier Tarife saehe in jeder
  -- Auswertung gleich langweilig aus.
  insert into velocity.mitgliedschaft (kunde_id, tarif_id, gueltigkeit)
  select k.kunde_id, t.tarif_id,
         daterange(date '2025-09-01'
                   + (floor(random() * 120))::integer, null, '[)')
    from (
      select kunde_id, random() as wurf
        from velocity.kunde
       where status = 'aktiv'
         and not exists (select 1 from velocity.mitgliedschaft m
                          where m.kunde_id = kunde.kunde_id)
       order by kunde_id
       limit c_anzahl
    ) k
    join lateral (
      select tarif_id from velocity.tarif
       where tarif_code = case
               when k.wurf < 0.55 then 'BASIS'
               when k.wurf < 0.80 then 'STUDENT'
               when k.wurf < 0.92 then 'OEPNV'
               else 'PREMIUM' end
    ) t on true;

  get diagnostics v_neu = row_count;
  raise notice 'Mitgliedschaften angelegt: %', v_neu;
  perform set_config('velocity.referenzdaten_mitgliedschaft_neu', v_neu::text, true);

  -- Freiminuten je Monat des Referenzjahres. Ohne sie hat der
  -- Studenten- und OEPNV-Tarif im Referenzjahr keinen Vorteil, und die
  -- Auswertung nach Kundengruppe zeigte nur den Premium-Rabatt.
  insert into velocity.freiminuten_periode
         (mitgliedschaft_id, jahr, monat, kontingent_minuten, verbraucht_minuten)
  select m.mitgliedschaft_id,
         extract(year  from d)::integer,
         extract(month from d)::integer,
         k.freiminuten_pro_monat,
         0
    from velocity.mitgliedschaft m
    join velocity.tarif_kondition k
      on k.tarif_id = m.tarif_id and upper_inf(k.gueltigkeit)
   cross join generate_series(date '2025-09-01', date '2026-08-01', interval '1 month') d
   where k.freiminuten_pro_monat > 0
     and m.gueltigkeit @> d::date
     and not exists (
       select 1 from velocity.freiminuten_periode p
        where p.mitgliedschaft_id = m.mitgliedschaft_id
          and p.jahr  = extract(year  from d)::integer
          and p.monat = extract(month from d)::integer
     );
end;
$$;

-- ---- 5: Der erste Mitarbeiter ---------------------------------------
-- Wer die Warenwirtschaft bedient, muss in mitarbeiter stehen. Der
-- erste Satz kann nicht ueber die Oberflaeche entstehen, weil deren
-- Anlegefunktion selbst Mitarbeiterrechte voraussetzt.
--
-- Die auth_uid gehoert zugleich Kunde 2334 - dieselbe Person ist Kunde
-- UND Mitarbeiter. Das ist Absicht und wird nicht aufgeloest: kunde und
-- mitarbeiter sind getrennte Saetze, die auf dieselbe Anmeldung zeigen.
-- Wer sich auf der Website anmeldet, ist Kunde; wer sich in der
-- Warenwirtschaft anmeldet, ist Mitarbeiter.
insert into velocity.mitarbeiter
       (personalnummer, auth_uid, vorname, nachname, email, eingetreten_am)
select 'M-0001', u.id, 'Robert', 'Butscher', u.email, date '2025-09-01'
  from auth.users u
 where u.email = 'swrobuts@googlemail.com'
   and not exists (select 1 from velocity.mitarbeiter m where m.personalnummer = 'M-0001');

-- Alle vier Rollen: er ist vorerst der einzige. Sobald weitere
-- Mitarbeitende dazukommen, wird das aufgeteilt - eine Person mit allen
-- Rechten ist ein Uebergangszustand, kein Zielbild.
insert into velocity.mitarbeiter_rolle (mitarbeiter_id, rolle_id)
select m.mitarbeiter_id, r.rolle_id
  from velocity.mitarbeiter m cross join velocity.rolle r
 where m.personalnummer = 'M-0001'
on conflict (mitarbeiter_id, rolle_id) do nothing;

-- ---- Nachweis im Uebernahmeprotokoll --------------------------------
insert into velocity.uebernahme_protokoll
       (lauf, quelle, ziel, gelesen, geschrieben, uebersprungen, hinweis)
select now(), 'Referenzdaten (erzeugt)',
       'velocity.nutzungspreis, velocity.mitgliedschaft, velocity.freiminuten_periode, velocity.mitarbeiter',
       0,
       -- Das DELTA dieses Laufs (aus Block 4 durchgereicht, siehe dort),
       -- nicht der Gesamtbestand an velocity.mitgliedschaft. Ein
       -- Gesamtbestand waere eine andere Zahl, die aussieht wie
       -- dieselbe - und wuerde db/betrieb/uebernahme_altdaten.sql und
       -- der Pruefung in t0013_uebernahme.sql widersprechen.
       coalesce(current_setting('velocity.referenzdaten_mitgliedschaft_neu', true)::int, 0),
       0,
       'ERFUNDENE Daten fuer die Lehre, nicht erhoben. Preisperioden ab 2025-09-01 '
       'mit einem Wechsel des Minutenpreises zum 2026-03-01; Tarifkonditionen '
       'rueckdatiert; rund 400 Mitgliedschaften; erster Mitarbeiter M-0001.'
 where not exists (
   select 1 from velocity.uebernahme_protokoll
    where quelle = 'Referenzdaten (erzeugt)'
      and ziel like 'velocity.nutzungspreis%'
 );

commit;

-- ---- Kontrolle -------------------------------------------------------
do $$
declare v_fehler integer; v_zahl integer;
begin
  -- Jeder Tag des Referenzjahres hat je Radtyp genau einen Preis.
  select count(*) into v_fehler
    from velocity.fahrradtyp t
   cross join generate_series(date '2025-09-01', date '2026-08-24', interval '1 day') d
   where (select count(*) from velocity.nutzungspreis p
           where p.typ_id = t.typ_id and p.gueltigkeit @> d::date) <> 1;
  if v_fehler > 0 then
    raise exception 'Preisluecke oder -ueberschneidung an % Tag/Typ-Paaren', v_fehler;
  end if;

  -- Der Wechsel zum 01.03.2026 ist wirklich einer.
  if (select preis_pro_minute from velocity.nutzungspreis p
        join velocity.fahrradtyp t using (typ_id)
       where t.typ_code = 'CITY' and p.gueltigkeit @> date '2026-02-28')
     = (select preis_pro_minute from velocity.nutzungspreis p
          join velocity.fahrradtyp t using (typ_id)
         where t.typ_code = 'CITY' and p.gueltigkeit @> date '2026-03-01') then
    raise exception 'Der Preiswechsel zum 01.03.2026 ist keiner';
  end if;

  select count(*) into v_zahl from velocity.mitgliedschaft;
  if v_zahl < 300 then
    raise exception 'Zu wenige Mitgliedschaften: %', v_zahl;
  end if;

  if not exists (select 1 from velocity.mitarbeiter m
                   join velocity.mitarbeiter_rolle mr using (mitarbeiter_id)
                  where m.personalnummer = 'M-0001'
                  group by m.mitarbeiter_id having count(*) = 4) then
    raise exception 'Mitarbeiter M-0001 fehlt oder hat nicht alle vier Rollen';
  end if;

  raise notice 'Grundlage steht: % Mitgliedschaften, Preise ab 2025-09-01', v_zahl;
end;
$$;

-- ---- Ruecknahme ------------------------------------------------------
-- delete from velocity.freiminuten_periode
--  where mitgliedschaft_id in (select mitgliedschaft_id from velocity.mitgliedschaft
--                               where lower(gueltigkeit) >= date '2025-09-01');
-- delete from velocity.mitgliedschaft where lower(gueltigkeit) >= date '2025-09-01';
-- delete from velocity.nutzungspreis where upper(gueltigkeit) <= date '2026-08-22';
-- delete from velocity.mitarbeiter_rolle where mitarbeiter_id in
--   (select mitarbeiter_id from velocity.mitarbeiter where personalnummer = 'M-0001');
-- delete from velocity.mitarbeiter where personalnummer = 'M-0001';
-- delete from velocity.uebernahme_protokoll
--  where quelle = 'Referenzdaten (erzeugt)'
--    and ziel like 'velocity.nutzungspreis%';
--  -- Zwingend, nicht optional: an genau diesem Protokolleintrag haengt
--  -- die Idempotenzsperre von Block 4 (siehe dort). Bleibt er nach der
--  -- Ruecknahme stehen, haelt ein erneuter Lauf dieser Datei die
--  -- Mitgliedschaften faelschlich fuer bereits angelegt und ueberspringt
--  -- Block 4 dauerhaft - die Sperre behauptet dann etwas, das nicht mehr
--  -- stimmt. Ohne diese Zeile ist die Ruecknahme kein Ruecknahmepfad,
--  -- sondern eine Falle fuer den naechsten Lauf.
