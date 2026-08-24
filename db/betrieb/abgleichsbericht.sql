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
-- =====================================================================
with stichtag as (
  select coalesce(max(lauf), now()) as zeitpunkt from velocity.uebernahme_protokoll
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
  select 'b station',
         (select count(*) from "cityBikesRental".station),
         (select count(*) from velocity.station), ''
  union all
  select 'c fahrrad',
         (select count(*) from "cityBikesRental".fahrrad),
         (select count(*) from velocity.fahrrad), ''
  union all
  select 'd ausleihe (bis Stichtag)',
         (select count(*) from "cityBikesRental".ausleihe),
         (select count(*) from velocity.ausleihe
           where startzeit < (select zeitpunkt from stichtag)),
         'Fahrten nach dem Stichtag sind neues Geschaeft'
  union all
  select 'e mitgliedschaft (nur aktive)',
         (select count(*) from "cityBikesRental".mitgliedschaft where aktiv),
         (select count(*) from velocity.mitgliedschaft), ''
  union all
  select 'f Summe Altbetraege in Cent',
         (select coalesce(round(sum(kosten) * 100), 0) from "cityBikesRental".ausleihe),
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
