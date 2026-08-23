-- =====================================================================
--  PREISANPASSUNG: Tageshoechstpreis
--
--  Anlass: der bisherige Deckel von 15 Euro beim E-Bike war zu niedrig
--  angesetzt. Neue Werte, im selben Verhaeltnis wie bisher (Faktor 5):
--
--      City-Bike        10 -> 50 Euro
--      E-Bike Sport     15 -> 75 Euro
--      E-Cargo Loader   22 -> 110 Euro
--
--  WIE das geschieht, ist der eigentliche Punkt. Die laufende Periode
--  wird zum heutigen Tag GESCHLOSSEN und eine neue eroeffnet - der alte
--  Satz wird nicht ueberschrieben. Sonst waeren alle bereits
--  abgerechneten Fahrten rueckwirkend anders bepreist, obwohl
--  entgeltposition.nutzungspreis_id auf genau diese Zeile zeigt.
--  Geschaeftsregel GR5 verlangt den Preis zum STARTZEITPUNKT; das geht
--  nur, wenn Preise eine Historie haben. Der EXCLUDE-Constraint auf
--  nutzungspreis sorgt dafuer, dass die Zeitraeume sich nicht
--  ueberschneiden - er wuerde jeden Fehler hier sofort abweisen.
--
--  Idempotent: laeuft der Block ein zweites Mal, findet er keine
--  offene Periode mit den alten Werten mehr und tut nichts.
--
--  Ruecknahme: die neue Periode loeschen und bei der alten
--  gueltigkeit wieder nach oben oeffnen.
-- =====================================================================

begin;

-- 1. Laufende Periode zum heutigen Tag schliessen, aber nur solange sie
--    noch die alten Werte traegt.
update velocity.nutzungspreis p
   set gueltigkeit = daterange(lower(p.gueltigkeit), current_date, '[)')
  from velocity.fahrradtyp t, (values
    ('CITY', 10.00), ('EBIKE', 15.00), ('CARGO', 22.00)
  ) as alt(typ_code, hoechst)
 where t.typ_id = p.typ_id
   and t.typ_code = alt.typ_code
   and p.tageshoechstpreis = alt.hoechst
   and upper_inf(p.gueltigkeit)
   and lower(p.gueltigkeit) < current_date;

-- 2. Neue Periode ab heute eroeffnen.
insert into velocity.nutzungspreis
       (typ_id, gueltigkeit, startgebuehr, preis_pro_minute, tageshoechstpreis)
select t.typ_id, daterange(current_date, null, '[)'), n.start, n.minute, n.hoechst
  from (values
    ('CITY',  0.10, 0.10,  50.00),
    ('EBIKE', 1.00, 0.10,  75.00),
    ('CARGO', 2.00, 0.10, 110.00)
  ) as n(typ_code, start, minute, hoechst)
  join velocity.fahrradtyp t on t.typ_code = n.typ_code
 where not exists (
   select 1 from velocity.nutzungspreis np
    where np.typ_id = t.typ_id and upper_inf(np.gueltigkeit)
 );

commit;

-- ---- Kontrolle: die Historie soll lueckenlos und ueberschneidungsfrei sein
select t.typ_code, p.gueltigkeit, p.startgebuehr, p.preis_pro_minute,
       p.tageshoechstpreis
  from velocity.nutzungspreis p
  join velocity.fahrradtyp t using (typ_id)
 order by t.typ_id, lower(p.gueltigkeit);

-- =====================================================================
--  NACHTRAG 23.08.2026: Minutenpreis E-Bike Sport
--
--  0,10 -> 0,50 Euro je Minute.
--
--  Diesmal wird die laufende Periode NICHT geschlossen, sondern
--  geaendert. Der Grund: sie hat heute begonnen, und ein Zeitraum
--  [heute, heute) waere leer - daterange wuerde ihn verwerfen. Es gibt
--  auch nichts zu schuetzen: keine einzige entgeltposition verweist auf
--  diese Zeile, es wurde also noch nichts damit abgerechnet. Waere
--  gestern schon eine Fahrt gelaufen, muesste hier wieder geschlossen
--  und neu eroeffnet werden.
--
--  Nebenwirkung, die erwuenscht ist: der Tageshoechstpreis von 75 Euro
--  greift jetzt nach 148 Minuten statt nach 740. Die Kappung ist damit
--  wieder eine Regel, die man im Betrieb zu sehen bekommt.
-- =====================================================================

update velocity.nutzungspreis p
   set preis_pro_minute = 0.50
  from velocity.fahrradtyp t
 where t.typ_id = p.typ_id
   and t.typ_code = 'EBIKE'
   and upper_inf(p.gueltigkeit)
   and p.preis_pro_minute <> 0.50
   and not exists (select 1 from velocity.entgeltposition e
                    where e.nutzungspreis_id = p.preis_id);
