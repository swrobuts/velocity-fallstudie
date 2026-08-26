-- =====================================================================
--  REFERENZDATEN, TEIL 2: FAHRTEN
--
--  ACHTUNG: ERFUNDENE Daten. Plausibel gebaut, aber nichts davon ist
--  gemessen. Wer sie fuer Aussagen ueber die Wirklichkeit verwendet,
--  verwendet sie falsch.
--
--  Setzt db/betrieb/referenzdaten_grundlage.sql voraus. Ohne die
--  Preisperioden ab 2025-09-01 bricht die Abrechnung mit "Kein
--  gueltiger Preis" ab.
--
--  Was hier bewusst NICHT geschieht: Betraege werden nicht gesetzt.
--  Jede Fahrt laeuft durch fn_ausleihe_abrechnen, also durch dieselbe
--  Preislogik wie eine echte Fahrt. Gesetzte Betraege waeren schneller
--  und wuerden genau das verbergen, was die Fallstudie zeigen soll.
--
--  distanz_km wird nur bei etwa 60 Prozent der Fahrten gesetzt. Sonst
--  waere die Unterscheidung zwischen gemessenem und geschaetztem
--  Kilometer eine Spalte, die immer dasselbe sagt.
--
--  Fester Startwert (setseed): jeder Lauf erzeugt dieselben Daten.
--
--  ABWEICHUNGEN VOM URSPRUENGLICHEN ENTWURF (beim tatsaechlichen Lauf
--  gefunden, nicht am Schreibtisch):
--
--  1. c_basis stand zunaechst auf 33 mit dem Kommentar "Fahrten je Tag
--     im Jahresmittel". Das Jahresmittel des Faktors
--     0.55 + 0.45*sin(...) ist aber 0.55, nicht 1 - macht mit dem
--     Wochenfaktor (im Mittel 0.943) real rund 0.51. 33 * 0.51 * 358
--     Tage ergibt rund 6100 Fahrten, nicht 12000, und riss sogar die
--     eigene Kontrolle "< 8000" (siehe Dateiende). c_basis steht daher
--     auf 65: 65 * 0.51 * 358 ergibt rund 11900 - das "rund 12000" der
--     Zusage.
--
--  2. Die urspruengliche Waechterabfrage pruefte per exists(), ob
--     irgendeine Ausleihe im Referenzzeitraum bereits eine
--     ZEITENTGELT-Position traegt. In dieser Datenbank existiert
--     bereits genau eine solche Zeile (ausleihe_id 2686, Kunde 2334 -
--     derselbe Robert Butscher, der in referenzdaten_grundlage.sql als
--     Mitarbeiter M-0001 angelegt wird -, sechs Sekunden Fahrzeit,
--     erkennbar ein manueller Testritt aus der Entwicklung von
--     fn_ausleihe_starten/-beenden/-abrechnen). Die Abfrage schlug
--     deshalb schon beim ALLERERSTEN Lauf fehl: "bereits vorhanden",
--     obwohl noch keine einzige Referenzfahrt existierte. Der Waechter
--     prueft jetzt wie in referenzdaten_grundlage.sql ueber die Marke
--     im Uebernahmeprotokoll - robust gegen einzelne fremde Zeilen, die
--     zufaellig ins Muster passen.
-- =====================================================================

do $$
declare
  c_von     constant date    := date '2025-09-01';
  c_bis     constant date    := date '2026-08-24';
  c_basis   constant integer := 65;      -- Fahrten je Tag im Jahresmittel
  v_erste   bigint;
  v_letzte  bigint;
  v_a       record;
  v_zahl    integer := 0;
begin
  if exists (
    select 1 from velocity.uebernahme_protokoll
     where quelle = 'Referenzdaten (erzeugt)'
       and ziel = 'velocity.ausleihe, velocity.entgeltposition'
  ) then
    raise notice 'Referenzfahrten sind bereits vorhanden - nichts zu tun';
    return;
  end if;

  perform setseed(0.2308);

  select coalesce(max(ausleihe_id), 0) into v_erste from velocity.ausleihe;

  -- ---- Fahrten anlegen ----------------------------------------------
  -- Aufbau in vier Schritten: Tagesmenge nach Jahres- und Wochengang,
  -- dann je Fahrt Kunde, Rad und Stationen aus nummerierten Vorraeten
  -- ziehen. Nummerierte Vorraete statt "order by random() limit 1" je
  -- Zeile - das waere bei 12 000 Fahrten ein Tabellendurchlauf pro
  -- Fahrt.
  with kunde_vorrat as (
    select row_number() over (order by kunde_id) - 1 as nr, kunde_id
      from velocity.kunde where status = 'aktiv'
  ), rad_vorrat as (
    select row_number() over (order by f.fahrrad_id) - 1 as nr,
           f.fahrrad_id, t.typ_code
      from velocity.fahrrad f
      join velocity.fahrradmodell m on m.modell_id = f.modell_id
      join velocity.fahrradtyp    t on t.typ_id    = m.typ_id
     where f.status <> 'ausgemustert'
  ), station_vorrat as (
    select row_number() over (order by station_id) - 1 as nr, station_id
      from velocity.station where betriebszeitraum @> c_bis
  ), groesse as (
    select (select count(*) from kunde_vorrat)   as kunden,
           (select count(*) from rad_vorrat)     as raeder,
           (select count(*) from station_vorrat) as stationen
  ), tag as (
    select d::date as datum,
           -- Jahresgang: Hoch im Juli, Tief im Januar.
           0.55 + 0.45 * sin(2 * pi() * (extract(doy from d)::numeric - 105) / 365.0) as saison,
           -- Am Wochenende wird weniger gependelt, aber laenger gefahren.
           case when extract(isodow from d) in (6, 7) then 0.80 else 1.00 end as tagesart
      from generate_series(c_von, c_bis, interval '1 day') as d
  ), menge as (
    select datum, tagesart,
           greatest(1, round(c_basis * saison * tagesart * (0.80 + 0.40 * random())))::integer as anzahl
      from tag
  ), fahrt as (
    select m.datum, m.tagesart, g.*,
           random() as w_kunde, random() as w_rad,
           random() as w_start, random() as w_ziel,
           random() as w_stunde, random() as w_dauer,
           random() as w_distanz, random() as w_rueckkehr
      from menge m cross join groesse g,
           generate_series(1, m.anzahl)
  ), gezogen as (
    select f.datum, f.tagesart,
           kv.kunde_id, rv.fahrrad_id, rv.typ_code,
           sv.station_id as start_station_id,
           -- 15 Prozent enden dort, wo sie begannen. Diese Fahrten sind
           -- fuer die Schaetzung der harte Fall: ihre Luftlinie ist null,
           -- gefahren wurde trotzdem.
           case when f.w_rueckkehr < 0.15 then sv.station_id else zv.station_id end as end_station_id,
           f.datum
             + case
                 when f.tagesart = 1.00 and f.w_stunde < 0.22 then interval '7 hours'
                 when f.tagesart = 1.00 and f.w_stunde < 0.45 then interval '17 hours'
                 else (6 + floor(f.w_stunde * 16)) * interval '1 hour'
               end
             + (floor(random() * 60)) * interval '1 minute' as startzeit,
           -- Dauer je Typ verschieden und rechtsschief: viele kurze
           -- Fahrten, wenige lange. w_dauer zweimal multipliziert
           -- erzeugt genau diese Schiefe.
           case rv.typ_code
             when 'CITY'  then 6  + round(40 * f.w_dauer * f.w_dauer)
             when 'EBIKE' then 8  + round(52 * f.w_dauer * f.w_dauer)
             else              12 + round(78 * f.w_dauer * f.w_dauer)
           end::integer as dauer,
           f.w_distanz
      from fahrt f
      join kunde_vorrat   kv on kv.nr = floor(f.w_kunde * f.kunden)
      join rad_vorrat     rv on rv.nr = floor(f.w_rad   * f.raeder)
      join station_vorrat sv on sv.nr = floor(f.w_start * f.stationen)
      join station_vorrat zv on zv.nr = floor(f.w_ziel  * f.stationen)
  )
  insert into velocity.ausleihe
         (kunde_id, fahrrad_id, mitgliedschaft_id, start_station_id, startzeit,
          end_station_id, endzeit, status, distanz_km)
  select g.kunde_id, g.fahrrad_id, m.mitgliedschaft_id, g.start_station_id, g.startzeit,
         g.end_station_id, g.startzeit + g.dauer * interval '1 minute', 'abgeschlossen',
         -- 60 Prozent gemessen. Geschwindigkeit je Typ, mit Streuung.
         case when g.w_distanz < 0.60 then
           -- round(numeric, int) verlangt numeric durchgehend - random()
           -- liefert double precision und wuerde den Ausdruck sonst dorthin
           -- ziehen; round(double precision, int) gibt es in Postgres
           -- nicht (nur die einstellige Form). Deshalb der explizite Cast.
           round((g.dauer / 60.0) * case g.typ_code
                                      when 'CITY'  then 13.0
                                      when 'EBIKE' then 18.0
                                      else              11.0
                                    end * (0.80 + 0.40 * random()::numeric), 2)
         end
    from gezogen g
    left join velocity.mitgliedschaft m
      on m.kunde_id = g.kunde_id and m.gueltigkeit @> g.startzeit::date;

  select max(ausleihe_id) into v_letzte from velocity.ausleihe;
  raise notice 'Fahrten angelegt: ausleihe_id % bis %', v_erste + 1, v_letzte;

  -- ---- Abrechnen ------------------------------------------------------
  -- In zeitlicher Reihenfolge, weil Freiminuten verbraucht werden: wer
  -- sie in anderer Folge abrechnet, verteilt sie anders.
  for v_a in
    select ausleihe_id from velocity.ausleihe
     where ausleihe_id > v_erste and endzeit is not null
     order by startzeit, ausleihe_id
  loop
    perform velocity.fn_ausleihe_abrechnen(v_a.ausleihe_id);
    v_zahl := v_zahl + 1;
  end loop;
  raise notice 'Fahrten abgerechnet: %', v_zahl;

  insert into velocity.uebernahme_protokoll
         (lauf, quelle, ziel, gelesen, geschrieben, uebersprungen, hinweis)
  values (now(), 'Referenzdaten (erzeugt)',
          'velocity.ausleihe, velocity.entgeltposition',
          0, v_zahl, 0,
          format('ERFUNDENE Fahrten für die Lehre, nicht erhoben. '
                 'ausleihe_id %s bis %s, Zeitraum %s bis %s. Beträge durch '
                 'fn_ausleihe_abrechnen gerechnet, nicht gesetzt. distanz_km '
                 'bei rund 60 Prozent gesetzt, sonst null.',
                 v_erste + 1, v_letzte, c_von, c_bis));
end;
$$;

-- ---- Radstatus in Einklang bringen -----------------------------------
-- 37 Raeder standen auf 'ausgeliehen' bei einer einzigen offenen
-- Ausleihe - ein Widerspruch aus der Altdatenuebernahme. Er fiel nie
-- auf, weil keine Oberflaeche Radstatus und Ausleihen nebeneinander
-- zeigte. Die erste Maske der Warenwirtschaft tut genau das. Von den
-- 37 passt genau eines wirklich zur einen aktiven Ausleihe (die
-- Kontrolle am Dateiende prueft das); die uebrigen 36 sind der
-- eigentliche Widerspruch und werden unten korrigiert.
--
-- ABWEICHUNG VOM URSPRUENGLICHEN ENTWURF (beim Lauf gefunden): die
-- reine status-Aktualisierung schlug zuerst am GR13-Waechter
-- (trg_fahrrad_status_ort / trg_radposition_pruefen) fehl - subtiler
-- als "keine Position gefuehrt". Fuer alle 36 betroffenen Raeder
-- EXISTIERT eine fahrrad_position-Zeile, aber mit station_id UND
-- latitude auf null: verfolgt, aber ohne bekannten Ort. Die Pruefung
-- behandelt "keine Zeile" (uebergangen) und "Zeile ohne Ort"
-- (abgelehnt) verschieden, und verlangt fuer jeden Status ausser
-- 'ausgeliehen'/'ausgemustert' einen Ort.
--
-- Eine naive Rundum-Verteilung auf alle aktiven Stationen schlug danach
-- an GR15 (trg_stellplaetze_pruefen) fehl: an der Residenz standen
-- schon 20 Raeder auf 25 Plaetzen, sieben weitere zufaellig zugeteilte
-- ueberfuellten sie. Die 36 Raeder werden deshalb nach freier Kapazitaet
-- verteilt (102 freie Plaetze auf den zehn aktiven Stationen reichen
-- reichlich), nicht gleichmaessig - erfunden wie die uebrigen
-- Referenzdaten, aber noetig, damit der Bestand ueberhaupt
-- widerspruchsfrei wird.
-- greatest(..., 0): die kumulierten Grenzen unten setzen voraus, dass
-- keine Station schon vor diesem Lauf ueber ihrer Kapazitaet belegt ist.
-- Das stimmt in dieser Datenlage (siehe Bericht), ist aber keine
-- Systemgarantie - waere frei negativ, verschoeben sich die Bereiche
-- und koennten sich ueberlappen. greatest(...,0) faengt das ab: eine
-- bereits ueberfuellte Station bekommt dann einfach keine weiteren
-- Raeder zugeteilt, statt die Verteilung zu verfaelschen.
with frei as (
  select s.station_id, greatest(s.kapazitaet
         - (select count(*) from velocity.fahrrad_position p2
             where p2.station_id = s.station_id), 0) as frei
    from velocity.station s
   where s.betriebszeitraum @> date '2026-08-24'
), bereich as (
  select station_id,
         sum(frei) over (order by station_id) - frei as von,
         sum(frei) over (order by station_id)        as bis
    from frei
), betroffen as (
  select f.fahrrad_id, row_number() over (order by f.fahrrad_id) - 1 as nr
    from velocity.fahrrad f
   where f.status = 'ausgeliehen'
     and not exists (select 1 from velocity.ausleihe a
                      where a.fahrrad_id = f.fahrrad_id and a.status = 'aktiv')
)
update velocity.fahrrad_position p
   set station_id = b.station_id, latitude = null, longitude = null
  from betroffen o
  join bereich b on o.nr >= b.von and o.nr < b.bis
 where p.fahrrad_id = o.fahrrad_id;

update velocity.fahrrad f
   set status = 'verfuegbar'
 where f.status = 'ausgeliehen'
   and not exists (select 1 from velocity.ausleihe a
                    where a.fahrrad_id = f.fahrrad_id and a.status = 'aktiv');

-- ---- Kontrolle -------------------------------------------------------
do $$
declare v_fehler integer; v_fahrten integer; v_ohne integer;
begin
  select count(*) into v_fahrten from velocity.ausleihe where startzeit >= date '2025-09-01';
  if v_fahrten < 8000 then
    raise exception 'Zu wenige Referenzfahrten: %', v_fahrten;
  end if;

  -- Jede abgeschlossene Fahrt des Referenzjahres traegt Positionen.
  select count(*) into v_ohne
    from velocity.ausleihe a
   where a.startzeit >= date '2025-09-01' and a.endzeit is not null
     and not exists (select 1 from velocity.entgeltposition e where e.ausleihe_id = a.ausleihe_id);
  if v_ohne > 0 then
    raise exception '% Referenzfahrten ohne Entgeltposition', v_ohne;
  end if;

  -- Der Radstatus widerspricht den Ausleihen nicht mehr.
  select count(*) into v_fehler
    from velocity.fahrrad f
   where (f.status = 'ausgeliehen') <> exists (
           select 1 from velocity.ausleihe a
            where a.fahrrad_id = f.fahrrad_id and a.status = 'aktiv');
  if v_fehler > 0 then
    raise exception '% Raeder mit widerspruechlichem Status', v_fehler;
  end if;

  -- Der Preiswechsel ist in den Daten sichtbar: dieselbe Fahrtdauer
  -- kostet vor und nach dem 01.03.2026 verschieden viel.
  if (select count(distinct einzelbetrag) from velocity.entgeltposition ep
        join velocity.entgeltart ea using (entgeltart_id)
        join velocity.ausleihe a using (ausleihe_id)
        join velocity.fahrradmodell m on m.modell_id =
             (select modell_id from velocity.fahrrad where fahrrad_id = a.fahrrad_id)
        join velocity.fahrradtyp t on t.typ_id = m.typ_id
       where ea.code = 'ZEITENTGELT' and t.typ_code = 'CITY'
         and a.startzeit >= date '2025-09-01') < 2 then
    raise exception 'Der Preiswechsel zum 01.03.2026 schlaegt in den Positionen nicht durch';
  end if;

  raise notice 'Referenzfahrten in Ordnung: % Fahrten, alle abgerechnet', v_fahrten;
end;
$$;

-- ---- Ruecknahme ------------------------------------------------------
-- delete from velocity.entgeltposition where ausleihe_id in
--   (select ausleihe_id from velocity.ausleihe where startzeit >= date '2025-09-01');
-- delete from velocity.ausleihe where startzeit >= date '2025-09-01';
