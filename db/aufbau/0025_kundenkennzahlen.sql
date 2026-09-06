-- =====================================================================
-- 0025 Kundenkennzahlen fuer das persoenliche Dashboard
--
-- Zweck:      Aufgabe 4 des Dashboard-Auftrags: die eigenen Kilometer,
--             das eigene CO2 und der eigene Rang auf der Kundenwebsite.
--             Eigene Datei statt Erweiterung von 0018: alle drei Sichten
--             lesen aus velocity.v_fahrt_kennzahl (Aufgabe 2), und eine
--             Sicht kann nur lesen, was zum Zeitpunkt ihrer Anlage schon
--             besteht. Diese Datei laeuft deshalb NACH 0018.
--
--             ALLE DREI LAUFEN MIT EIGENTUEMERRECHTEN und filtern selbst
--             ueber auth.uid() - das Muster von velocity.v_mein_profil
--             (0010_sichten.sql), nicht das von v_meine_ausleihe
--             (security_invoker plus RLS-Regel ausleihe_eigene). Der
--             Grund ist zwingend, nicht stilistisch: v_meine_bilanz
--             bildet den Rang in einer Zwischenstufe (je_kunde) ueber
--             ALLE gewerteten Kunden, bevor auf die anmeldende Person
--             gefiltert wird. Unter security_invoker muesste diese
--             Zwischenstufe als Rolle authenticated direkt auf
--             v_fahrt_kennzahl lesen - und genau das verweigert 0018
--             ausdruecklich ("revoke all ... from public, anon,
--             authenticated", weil die Sicht kunde_id je Einzelfahrt
--             fuehrt, siehe deren Kopfkommentar). Eine invoker-Variante
--             braeche fuer echte Kundschaft deshalb nicht nur den Rang,
--             sondern die gesamte Sicht mit Fehler 42501 (permission
--             denied), noch bevor eine einzige Zeile entstuende.
--
--             Nachgemessen (nicht nur behauptet): eine manuelle
--             Gegenprobe mit security_invoker=true UND einer Abfrage
--             als Rolle authenticated (set local role authenticated) -
--             nicht als postgres, denn db/test.py verbindet sich als
--             postgres, und Tabelleneigentuemer plus BYPASSRLS umgehen
--             jede Schranke unabhaengig von security_invoker (dasselbe
--             Muster wie in t0016_bereich_k.sql) - liefert exakt diesen
--             Fehler. Ohne den Rollenwechsel bliebe jede Gegenprobe
--             gruen und wuerde nichts beweisen.
--
--             NACH AUSSEN GEHEN NUR ZAHLEN. Rang, Anzahl der gewerteten
--             Kunden, Perzentil, Median und Bestwert der Flotte sind
--             Kennzahlen, keine Personen; kein Name und keine
--             Kundennummer eines Dritten verlaesst diese Sichten -
--             dieselbe Unterscheidung wie bei v_wawi_umsatz_kundengruppe
--             (0018_wawi_sichten.sql).
--
--             Gemessen am 05.09.2026: 495 von 1.014 Kunden haben
--             mindestens eine abgeschlossene Fahrt und werden gewertet
--             (12.052 abgeschlossene Fahrten insgesamt, v_fahrt_kennzahl).
-- Objekte:    velocity.v_meine_fahrt_kennzahl, velocity.v_meine_monatsbilanz,
--             velocity.v_meine_bilanz
-- Ruecknahme: DROP VIEW velocity.v_meine_fahrt_kennzahl;
--             DROP VIEW velocity.v_meine_monatsbilanz;
--             DROP VIEW velocity.v_meine_bilanz;
-- =====================================================================
set search_path = velocity, public;

-- ---- Je Fahrt --------------------------------------------------------
create or replace view velocity.v_meine_fahrt_kennzahl as
select fk.ausleihe_id,
       fk.startzeit, fk.endzeit, fk.dauer_minuten,
       fk.typ_code, t.bezeichnung as typ_bezeichnung,
       f.rahmennummer,
       ss.name as start_station,
       es.name as end_station,
       fk.km, fk.ist_geschaetzt, fk.verfahren,
       round(fk.co2_ersparnis_g, 1) as co2_ersparnis_g,
       fk.betrag_brutto
  from velocity.v_fahrt_kennzahl fk
  join velocity.kunde         k  on k.kunde_id   = fk.kunde_id
  join velocity.ausleihe      a  on a.ausleihe_id = fk.ausleihe_id
  join velocity.fahrrad       f  on f.fahrrad_id = fk.fahrrad_id
  join velocity.fahrradmodell mo on mo.modell_id = f.modell_id
  join velocity.fahrradtyp    t  on t.typ_id     = mo.typ_id
  left join velocity.station ss on ss.station_id = a.start_station_id
  left join velocity.station es on es.station_id = a.end_station_id
 where k.auth_uid = auth.uid();

comment on view velocity.v_meine_fahrt_kennzahl is
  'Eigene Fahrten des Anmeldenden, um Typ-, Rad- und Stationsbezeichnung ergänzt. '
  'Liest aus velocity.v_fahrt_kennzahl und filtert selbst über k.auth_uid = auth.uid(); '
  'läuft mit Eigentümerrechten, siehe Kopfkommentar der Datei.';
comment on column velocity.v_meine_fahrt_kennzahl.ausleihe_id is
  'Schlüssel der Fahrt, Verweis auf velocity.ausleihe.';
comment on column velocity.v_meine_fahrt_kennzahl.startzeit is
  'Beginn der Fahrt.';
comment on column velocity.v_meine_fahrt_kennzahl.endzeit is
  'Ende der Fahrt.';
comment on column velocity.v_meine_fahrt_kennzahl.dauer_minuten is
  'Fahrtdauer in aufgerundeten Minuten.';
comment on column velocity.v_meine_fahrt_kennzahl.typ_code is
  'Fachlicher Schlüssel des Fahrradtyps.';
comment on column velocity.v_meine_fahrt_kennzahl.typ_bezeichnung is
  'Anzeigename des Fahrradtyps.';
comment on column velocity.v_meine_fahrt_kennzahl.rahmennummer is
  'Rahmennummer des gefahrenen Rades.';
comment on column velocity.v_meine_fahrt_kennzahl.start_station is
  'Name der Startstation, NULL bei freiem Abstellort.';
comment on column velocity.v_meine_fahrt_kennzahl.end_station is
  'Name der Zielstation, NULL bei freiem Abstellort.';
comment on column velocity.v_meine_fahrt_kennzahl.km is
  'Gefahrene Kilometer; die Drei-Fall-Herleitung steht bei velocity.v_fahrt_kennzahl.km.';
comment on column velocity.v_meine_fahrt_kennzahl.ist_geschaetzt is
  'Wahr, wenn km nicht gemessen, sondern geschätzt wurde.';
comment on column velocity.v_meine_fahrt_kennzahl.verfahren is
  'gemessen, aus_dauer oder aus_luftlinie - womit km ermittelt wurde.';
comment on column velocity.v_meine_fahrt_kennzahl.co2_ersparnis_g is
  'CO2-Ersparnis dieser Fahrt gegenüber einem vergleichbaren Pkw, in Gramm, auf eine '
  'Nachkommastelle gerundet.';
comment on column velocity.v_meine_fahrt_kennzahl.betrag_brutto is
  'Entgelt dieser Fahrt, 0 ohne Entgeltposition.';

-- ---- Je Monat ----------------------------------------------------------
create or replace view velocity.v_meine_monatsbilanz as
select date_trunc('month', fk.startzeit)::date          as monat,
       count(*)::integer                                as fahrten,
       sum(fk.dauer_minuten)::integer                   as minuten,
       round(sum(fk.km), 1)                             as km,
       round(sum(fk.co2_ersparnis_g) / 1000.0, 2)       as co2_ersparnis_kg,
       sum(fk.betrag_brutto)                            as ausgaben_brutto,
       -- NACH KILOMETERN GEWICHTET, NICHT NACH FAHRTEN (06.09.2026).
       -- Hier stand avg(case when ist_geschaetzt then 1 else 0 end),
       -- also der Anteil der FAHRTEN mit geschätzter Strecke. Der Wert
       -- war richtig gerechnet, beantwortete aber die falsche Frage:
       -- er steht auf der Website unter einer Kilometerkachel, und wer
       -- dort „30 %" liest, denkt an Kilometer, nicht an Fahrten. Eine
       -- Fahrt wird ohnehin nie geschätzt — sie ist erfasst; geschätzt
       -- wird allein ihre Strecke (v_fahrt_kennzahl.ist_geschaetzt ist
       -- „a.distanz_km is null").
       --
       -- Die beiden Zahlen gehen deutlich auseinander, weil die
       -- Schätzung überwiegend kurze Fahrten trifft: bei K-000001 waren
       -- es am 06.09.2026 28,6 % der Fahrten, aber nur 17,0 % der
       -- Kilometer (zehn Luftlinienfahrten mit zusammen 14,4 km gegen
       -- 152,2 gemessene km). Nach Fahrten gezählt wirkt die Bilanz
       -- also unsicherer, als sie ist.
       --
       -- nullif gegen Division durch null: ohne km gibt es auch keine
       -- geschätzten km, coalesce macht daraus die ehrliche 0.
       round(coalesce(sum(fk.km) filter (where fk.ist_geschaetzt)
                      / nullif(sum(fk.km), 0), 0), 3)   as anteil_geschaetzt
  from velocity.v_fahrt_kennzahl fk
  join velocity.kunde k on k.kunde_id = fk.kunde_id
 where k.auth_uid = auth.uid()
 group by 1;

comment on view velocity.v_meine_monatsbilanz is
  'Eigene Fahrten des Anmeldenden, je Kalendermonat aggregiert - Grundlage des '
  'Verlaufsdiagramms im Dashboard. Läuft mit Eigentümerrechten und filtert selbst über '
  'auth.uid(), siehe Kopfkommentar der Datei.';
comment on column velocity.v_meine_monatsbilanz.monat is
  'Erster Tag des Monats der Fahrt (startzeit), Gruppierungsschlüssel.';
comment on column velocity.v_meine_monatsbilanz.fahrten is
  'Zahl der abgeschlossenen Fahrten in diesem Monat.';
comment on column velocity.v_meine_monatsbilanz.minuten is
  'Summe der Fahrtdauer dieses Monats, in Minuten.';
comment on column velocity.v_meine_monatsbilanz.km is
  'Summe der gefahrenen Kilometer dieses Monats, auf eine Nachkommastelle gerundet.';
comment on column velocity.v_meine_monatsbilanz.co2_ersparnis_kg is
  'Summe der CO2-Ersparnis dieses Monats in Kilogramm; erst summiert, dann gerundet - '
  'velocity.v_fahrt_kennzahl.co2_ersparnis_g ist bewusst ungerundet.';
comment on column velocity.v_meine_monatsbilanz.ausgaben_brutto is
  'Summe der Entgelte dieses Monats.';
comment on column velocity.v_meine_monatsbilanz.anteil_geschaetzt is
  'Anteil der Kilometer dieses Monats, die geschätzt statt gemessen sind, zwischen '
  '0 und 1. Nach Kilometern gewichtet, nicht nach Fahrten - eine Fahrt wird nie '
  'geschätzt, nur ihre Strecke.';

-- ---- Eine einzige Zeile, mit der Einordnung ---------------------------
create or replace view velocity.v_meine_bilanz as
with je_kunde as (
  -- Ueber ALLE Kunden. Diese Zwischenstufe ist der Grund, warum die
  -- Sicht mit Eigentuemerrechten laufen muss.
  select fk.kunde_id,
         count(*)                                 as fahrten,
         sum(fk.dauer_minuten)                    as minuten,
         sum(fk.km)                               as km,
         sum(fk.co2_ersparnis_g)                  as co2_g,
         sum(fk.betrag_brutto)                    as ausgaben,
         min(fk.startzeit)                        as erste,
         max(fk.startzeit)                        as letzte,
         -- Nach Kilometern gewichtet - Begründung ausführlich bei
         -- v_meine_monatsbilanz weiter oben.
         coalesce(sum(fk.km) filter (where fk.ist_geschaetzt)
                  / nullif(sum(fk.km), 0), 0)      as geschaetzt
    from velocity.v_fahrt_kennzahl fk
   group by fk.kunde_id
),
mit_rang as (
  -- Gewertet wird, wer mindestens eine abgeschlossene Fahrt hat. Ein
  -- Rang unter Konten ohne jede Fahrt waere keine Einordnung, sondern
  -- eine geschenkte Platzierung.
  --
  -- ::numeric bei percent_rank(): die Funktion liefert double precision,
  -- und round(double precision, integer) kennt PostgreSQL nicht (nur
  -- round(numeric, integer)) - nachgemessen, nicht vermutet. Ohne den
  -- Cast bricht schon die Anlage der Sicht mit "function round(double
  -- precision, integer) does not exist" ab.
  select j.*,
         rank()        over (order by j.km desc) as rang_km,
         count(*)      over ()                   as kunden_gewertet,
         (percent_rank() over (order by j.km))::numeric as perzentil_anteil
    from je_kunde j
),
flotte as (
  -- ::numeric aus demselben Grund wie bei perzentil_anteil:
  -- percentile_cont() liefert ebenfalls double precision.
  select (percentile_cont(0.5) within group (order by km))::numeric as median_km,
         max(km)                                        as bestwert_km
    from je_kunde
)
select r.fahrten                            as fahrten_gesamt,
       r.minuten                            as minuten_gesamt,
       round(r.km, 1)                       as km_gesamt,
       round(r.co2_g / 1000.0, 2)           as co2_ersparnis_kg_gesamt,
       r.ausgaben                           as ausgaben_gesamt,
       r.erste                              as erste_fahrt,
       r.letzte                             as letzte_fahrt,
       r.rang_km,
       r.kunden_gewertet,
       round(r.perzentil_anteil * 100, 1)   as perzentil,
       round(f.median_km, 1)                as median_km_flotte,
       round(f.bestwert_km, 1)              as bestwert_km_flotte,
       round(r.geschaetzt, 3)               as anteil_geschaetzt
  from mit_rang r
  cross join flotte f
  join velocity.kunde k on k.kunde_id = r.kunde_id
 where k.auth_uid = auth.uid();

comment on view velocity.v_meine_bilanz is
  'Genau eine Zeile: die des Anmeldenden. Rang, Perzentil, Median und Bestwert '
  'entstehen aus einer Zwischenstufe über alle gewerteten Kunden, von der nach außen '
  'ausschließlich Zahlen gelangen - kein Name, keine Kundennummer, keine fremde Zeile.';
comment on column velocity.v_meine_bilanz.fahrten_gesamt is
  'Zahl aller abgeschlossenen Fahrten des Anmeldenden.';
comment on column velocity.v_meine_bilanz.minuten_gesamt is
  'Summe der Fahrtdauer aller eigenen Fahrten, in Minuten.';
comment on column velocity.v_meine_bilanz.km_gesamt is
  'Summe der eigenen Kilometer, auf eine Nachkommastelle gerundet.';
comment on column velocity.v_meine_bilanz.co2_ersparnis_kg_gesamt is
  'Summe der eigenen CO2-Ersparnis in Kilogramm; erst summiert, dann gerundet - '
  'velocity.v_fahrt_kennzahl.co2_ersparnis_g ist bewusst ungerundet.';
comment on column velocity.v_meine_bilanz.ausgaben_gesamt is
  'Summe aller eigenen Entgelte.';
comment on column velocity.v_meine_bilanz.erste_fahrt is
  'Startzeit der ersten abgeschlossenen Fahrt.';
comment on column velocity.v_meine_bilanz.letzte_fahrt is
  'Startzeit der letzten abgeschlossenen Fahrt.';
comment on column velocity.v_meine_bilanz.rang_km is
  'Platz nach gefahrenen Kilometern unter allen gewerteten Kunden; 1 ist der Bestwert.';
comment on column velocity.v_meine_bilanz.kunden_gewertet is
  'Zahl der Kunden mit mindestens einer abgeschlossenen Fahrt - Grundlage von rang_km '
  'und perzentil, keine Kundennummer, kein Name.';
comment on column velocity.v_meine_bilanz.perzentil is
  'Anteil der gewerteten Kunden mit gleich vielen oder weniger Kilometern, in Prozent.';
comment on column velocity.v_meine_bilanz.median_km_flotte is
  'Median der Kilometer über alle gewerteten Kunden.';
comment on column velocity.v_meine_bilanz.bestwert_km_flotte is
  'Höchster Kilometerwert unter allen gewerteten Kunden - eine Zahl, keine Kundennummer, '
  'kein Name.';
comment on column velocity.v_meine_bilanz.anteil_geschaetzt is
  'Anteil der eigenen Kilometer, die geschätzt statt gemessen sind, zwischen 0 und 1. '
  'Nach Kilometern gewichtet, nicht nach Fahrten - eine Fahrt wird nie geschätzt, '
  'nur ihre Strecke.';

grant select on velocity.v_meine_fahrt_kennzahl to authenticated;
grant select on velocity.v_meine_monatsbilanz   to authenticated;
grant select on velocity.v_meine_bilanz         to authenticated;
