-- =====================================================================
-- 0010 Sichten
--
-- Zweck:      Der Vertrag zwischen Datenbank und Website. Die Anwendung
--             greift nie auf Basistabellen zu, sondern nur auf diese
--             Sichten und auf die api_-Funktionen.
-- Objekte:    velocity.v_station, v_verfuegbares_fahrrad, v_tarifkarte,
--             v_tarif, v_faq, v_nutzungsschritt, v_kennzahl,
--             v_meine_ausleihe, v_meine_rechnung, v_mein_profil
-- Ruecknahme: DROP VIEW fuer dieselben Namen.
--
-- Oeffentliche Sichten laufen mit den Rechten ihres Eigentuemers
-- (Standard) und enthalten deshalb ausschliesslich Daten ohne
-- Personenbezug. Persoenliche Sichten begrenzen die Zeilen entweder
-- ueber security_invoker plus RLS oder ueber einen ausdruecklichen
-- Filter auf auth.uid().
-- =====================================================================

-- ---------- oeffentlich ----------------------------------------------

drop view if exists velocity.v_station;
create view velocity.v_station as
select s.station_id,
       s.stationsnummer,
       s.name,
       a.strasse, a.hausnummer, a.plz, a.ort,
       s.latitude, s.longitude, s.hoehe_m,
       s.kapazitaet,
       count(*) filter (where f.status = 'verfuegbar')::integer as verfuegbare_raeder,
       greatest(s.kapazitaet - count(p.fahrrad_id), 0)::integer as freie_stellplaetze
  from velocity.station s
  join velocity.adresse a               on a.adresse_id = s.adresse_id
  left join velocity.fahrrad_position p on p.station_id = s.station_id
  left join velocity.fahrrad f          on f.fahrrad_id = p.fahrrad_id
 where s.betriebszeitraum @> current_date
 group by s.station_id, s.stationsnummer, s.name,
          a.strasse, a.hausnummer, a.plz, a.ort,
          s.latitude, s.longitude, s.hoehe_m, s.kapazitaet;

drop view if exists velocity.v_geschaeftsgebiet;
create view velocity.v_geschaeftsgebiet as
select gebiet_id, name, flaeche::text as umriss
  from velocity.geschaeftsgebiet
 where aktiv;

drop view if exists velocity.v_hoehenmarke;
create view velocity.v_hoehenmarke as
select marke_id, name, hoehe_m, latitude, longitude, quelle
  from velocity.hoehenmarke
 order by sortierung;

drop view if exists velocity.v_verfuegbares_fahrrad;
create view velocity.v_verfuegbares_fahrrad as
select f.fahrrad_id,
       f.rahmennummer,
       t.typ_id, t.typ_code,
       t.bezeichnung as typ_bezeichnung,
       t.hat_elektro,
       p.akkustand_prozent,
       coalesce(p.latitude,  s.latitude)  as latitude,
       coalesce(p.longitude, s.longitude) as longitude,
       s.station_id,
       s.name as station_name,
       np.startgebuehr, np.preis_pro_minute, np.tageshoechstpreis
  from velocity.fahrrad f
  join velocity.fahrradmodell m on m.modell_id = f.modell_id
  join velocity.fahrradtyp    t on t.typ_id    = m.typ_id
  left join velocity.fahrrad_position p on p.fahrrad_id = f.fahrrad_id
  left join velocity.station          s on s.station_id = p.station_id
  left join velocity.nutzungspreis   np on np.typ_id    = t.typ_id
                                       and np.gueltigkeit @> current_date
 where f.status = 'verfuegbar';

drop view if exists velocity.v_tarifkarte;
create view velocity.v_tarifkarte as
select t.typ_id, t.typ_code, t.bezeichnung, t.beschreibung, t.hat_elektro,
       np.startgebuehr, np.preis_pro_minute, np.tageshoechstpreis,
       round(np.startgebuehr + np.preis_pro_minute * 30, 2) as preis_30_minuten,
       coalesce(
         (select array_agg(m.merkmal order by m.sortierung)
            from velocity.fahrradtyp_merkmal m where m.typ_id = t.typ_id),
         array[]::text[]
       ) as merkmale
  from velocity.fahrradtyp t
  left join velocity.nutzungspreis np on np.typ_id = t.typ_id
                                     and np.gueltigkeit @> current_date;

drop view if exists velocity.v_tarif;
create view velocity.v_tarif as
select t.tarif_id, t.tarif_code, t.bezeichnung, t.art::text as art, t.voraussetzung,
       k.freiminuten_pro_monat, k.rabatt_prozent
  from velocity.tarif t
  left join velocity.tarif_kondition k on k.tarif_id = t.tarif_id
                                      and k.gueltigkeit @> current_date;

drop view if exists velocity.v_faq;
create view velocity.v_faq as
select faq_id, frage, antwort, sortierung
  from velocity.faq_eintrag where aktiv;

drop view if exists velocity.v_nutzungsschritt;
create view velocity.v_nutzungsschritt as
select schritt_id, nummer, titel, beschreibung
  from velocity.nutzungsschritt;

drop view if exists velocity.v_kennzahl;
create view velocity.v_kennzahl as
select k.schluessel,
       k.label,
       k.sortierung,
       case
         when not k.ist_berechnet then k.anzeigewert
         when k.schluessel = 'stationen' then
           (select count(*)::text from velocity.station
             where betriebszeitraum @> current_date)
         else null
       end as wert
  from velocity.kennzahl k;

-- ---------- persoenlich ----------------------------------------------

-- security_invoker: die Zeilenbegrenzung uebernehmen die RLS-Regeln aus
-- Schritt 0011. Verknuepft werden nur Tabellen, die ohnehin oeffentlich
-- lesbar sind.
drop view if exists velocity.v_meine_ausleihe;
create view velocity.v_meine_ausleihe
  with (security_invoker = true) as
select a.ausleihe_id,
       a.startzeit, a.endzeit, a.status::text as status, a.dauer_minuten,
       f.rahmennummer,
       t.typ_code,
       t.bezeichnung as typ_bezeichnung,
       ss.name as start_station,
       es.name as end_station,
       coalesce((select sum(ep.betrag) from velocity.entgeltposition ep
                  where ep.ausleihe_id = a.ausleihe_id), 0)::numeric(10,2) as gesamtbetrag,
       -- Die Aufschluesselung gehoert zum Beleg. Ohne sie muesste die
       -- Seite den Betrag nachrechnen, um ihn zu erklaeren - und damit
       -- die Preisregeln ein zweites Mal fuehren. Der Beleg zeigt jetzt,
       -- was tatsaechlich gebucht wurde.
       coalesce((select jsonb_agg(jsonb_build_object(
                          'bezeichnung', ea.bezeichnung,
                          'code',        ea.code,
                          'betrag',      ep.betrag)
                        order by ep.sortierung, ep.position_id)
                   from velocity.entgeltposition ep
                   join velocity.entgeltart ea using (entgeltart_id)
                  where ep.ausleihe_id = a.ausleihe_id), '[]'::jsonb) as positionen
  from velocity.ausleihe a
  join velocity.fahrrad       f on f.fahrrad_id = a.fahrrad_id
  join velocity.fahrradmodell m on m.modell_id  = f.modell_id
  join velocity.fahrradtyp    t on t.typ_id     = m.typ_id
  left join velocity.station ss on ss.station_id = a.start_station_id
  left join velocity.station es on es.station_id = a.end_station_id;

drop view if exists velocity.v_meine_rechnung;
create view velocity.v_meine_rechnung
  with (security_invoker = true) as
select r.rechnung_id, r.rechnungsnummer, r.periode_jahr, r.periode_monat,
       r.erstellt_am_beleg, r.betrag_netto, r.ust_betrag, r.betrag_brutto,
       r.status::text as status
  from velocity.rechnung r;

-- Bewusst MIT Definer-Rechten und ausdruecklichem Filter: diese Sicht
-- verknuepft adresse. Ein Leserecht auf adresse fuer authenticated
-- wuerde die Anschriften aller Kunden oeffnen.
drop view if exists velocity.v_mein_profil;
create view velocity.v_mein_profil as
select k.kunde_id, k.kundennummer, k.email, k.vorname, k.nachname,
       k.telefon, k.geburtsdatum, k.status::text as status, k.registriert_am,
       a.strasse, a.hausnummer, a.plz, a.ort
  from velocity.kunde k
  left join velocity.adresse a on a.adresse_id = k.rechnungsadresse_id
 where k.auth_uid = auth.uid();
