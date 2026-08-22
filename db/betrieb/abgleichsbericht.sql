-- =====================================================================
-- Abgleichsbericht der Datenuebernahme
--
-- Stellt Soll und Ist gegenueber. Abweichungen muessen erklaerbar sein.
-- =====================================================================
select bereich, soll_alt, ist_neu, ist_neu - soll_alt as abweichung, bemerkung
from (
  select 'a kunde' as bereich,
         (select count(*) from "cityBikesRental".kunde)          as soll_alt,
         (select count(*) from velocity.kunde)                    as ist_neu,
         'Saetze mit unplausibler E-Mail werden ausgelassen'       as bemerkung
  union all
  select 'b station',
         (select count(*) from "cityBikesRental".station),
         (select count(*) from velocity.station), ''
  union all
  select 'c fahrrad',
         (select count(*) from "cityBikesRental".fahrrad),
         (select count(*) from velocity.fahrrad), ''
  union all
  select 'd ausleihe',
         (select count(*) from "cityBikesRental".ausleihe),
         (select count(*) from velocity.ausleihe), ''
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
