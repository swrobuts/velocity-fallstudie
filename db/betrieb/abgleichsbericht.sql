-- =====================================================================
-- Abgleichsbericht der Datenuebernahme
--
-- Stellt Soll und Ist gegenueber. Abweichungen muessen erklaerbar sein.
--
-- WICHTIG: verglichen wird der Stand ZUM ZEITPUNKT DER UEBERNAHME, nicht
-- der Stand von heute. Sobald die Seite in Betrieb ist, entstehen neue
-- Kunden und neue Ausleihen - die sind kein Fehler der Uebernahme,
-- sondern ihr Zweck. Der Bericht meldete sonst genau in dem Moment eine
-- Abweichung, in dem der erste echte Kunde seine erste Fahrt machte.
-- Der Stichtag steht in velocity.uebernahme_protokoll.
--
-- EBENSO WICHTIG: das Soll ist nicht der gesamte Altbestand, sondern der
-- Teil, der uebernommen werden SOLL. Schweinfurt gehoert nicht dazu -
-- drei Stationen vierzig Kilometer ausserhalb, ohne Verbindung zum
-- Wuerzburger Netz. Sie werden bewusst ausgelassen; der Bericht rechnet
-- sie deshalb aus dem Soll heraus, statt sie als Fehlmenge zu melden.
-- Ein Bericht, der eine gewollte Entscheidung als Abweichung fuehrt,
-- wird nach der dritten Meldung nicht mehr gelesen.
-- =====================================================================
with stichtag as (
  select coalesce(max(lauf), now()) as zeitpunkt from velocity.uebernahme_protokoll
),
sw_station as (
  select station_id from "cityBikesRental".station where ort = 'Schweinfurt'
),
-- Raeder, die zu Schweinfurt gehoeren. Eine Fahrt mit einem solchen Rad
-- kommt nicht herueber, auch wenn sie zwischen zwei Wuerzburger
-- Stationen stattfand - das Rad fehlt dann als Bezugspunkt.
sw_rad as (
  select fahrrad_id from "cityBikesRental".fahrrad
   where station_id in (select station_id from sw_station)
)
select bereich, soll_alt, ist_neu, ist_neu - soll_alt as abweichung, bemerkung
from (
  select 'a kunde (bis Stichtag)' as bereich,
         (select count(*) from "cityBikesRental".kunde)          as soll_alt,
         (select count(*) from velocity.kunde
           where erstellt_am < (select zeitpunkt from stichtag)) as ist_neu,
         'Sätze mit unplausibler E-Mail werden ausgelassen; '
         || 'nach dem Stichtag angelegte Konten zaehlen nicht mit'
                                                                 as bemerkung
  union all
  select 'b station (ohne Schweinfurt)',
         (select count(*) from "cityBikesRental".station where ort <> 'Schweinfurt'),
         (select count(*) from velocity.station),
         'Schweinfurt liegt ausserhalb des Geschaeftsgebiets'
  union all
  select 'c fahrrad (ohne Schweinfurt)',
         (select count(*) from "cityBikesRental".fahrrad f
           where f.station_id is null
              or f.station_id not in (select station_id from sw_station)),
         (select count(*) from velocity.fahrrad),
         'Raeder an Schweinfurter Stationen bleiben drueben'
  union all
  select 'd ausleihe (bis Stichtag, ohne Schweinfurt)',
         (select count(*) from "cityBikesRental".ausleihe a
           where a.start_station_id not in (select station_id from sw_station)
             and (a.end_station_id is null
                  or a.end_station_id not in (select station_id from sw_station))
             and a.fahrrad_id not in (select fahrrad_id from sw_rad)),
         (select count(*) from velocity.ausleihe
           where startzeit < (select zeitpunkt from stichtag)),
         'Fahrten nach dem Stichtag sind neues Geschaeft; '
         || 'Fahrten in Schweinfurt gehoeren zu einem anderen Netz'
  union all
  select 'e mitgliedschaft (nur aktive)',
         (select count(*) from "cityBikesRental".mitgliedschaft where aktiv),
         (select count(*) from velocity.mitgliedschaft),
         'Rund 400 zusaetzliche Mitgliedschaften stammen aus '
         || 'db/betrieb/referenzdaten_grundlage.sql (erfundene Referenzdaten '
         || 'fuer das Auswertungsjahr, siehe velocity.uebernahme_protokoll) - '
         || 'kein Uebernahmefehler'
  union all
  select 'f Summe Altbetraege in Cent (ohne Schweinfurt)',
         (select coalesce(round(sum(a.kosten) * 100), 0) from "cityBikesRental".ausleihe a
           where a.start_station_id not in (select station_id from sw_station)
             and (a.end_station_id is null
                  or a.end_station_id not in (select station_id from sw_station))
             and a.fahrrad_id not in (select fahrrad_id from sw_rad)),
         (select coalesce(round(sum(p.betrag) * 100), 0) from velocity.entgeltposition p
            join velocity.entgeltart a on a.entgeltart_id = p.entgeltart_id
           where a.code = 'BESTANDSUEBERNAHME'),
         'Muss exakt uebereinstimmen'
  union all
  select 'g Auth-Verknuepfungen',
         (select count(*) from "cityBikesRental".auth_kunde_mapping),
         (select count(*) from velocity.kunde where auth_uid is not null),
         'Alle Altverweise zeigen auf geloeschte Konten; auth.users ist leer'
) t
order by bereich;
