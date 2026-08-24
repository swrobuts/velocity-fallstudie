-- =====================================================================
--  PREISANPASSUNG: Minutenpreis
--
--  Anlass: die Reihenfolge stimmte nicht. Das Lastenrad kostete mit
--  0,10 Euro je Minute genauso wenig wie das einfachste Rad - und nur
--  ein Fuenftel des E-Bikes, obwohl es das aufwendigste Fahrzeug im
--  Netz ist. Neue Staffel:
--
--      City-Bike        0,10 -> 0,10 Euro/Minute  (unveraendert)
--      E-Bike Sport     0,50 -> 0,25 Euro/Minute
--      E-Cargo Loader   0,10 -> 0,50 Euro/Minute
--
--  Das City-Bike bleibt unberuehrt: wo sich nichts aendert, wird auch
--  keine neue Periode eroeffnet. Eine Historie soll die Aenderungen
--  zeigen, nicht die Laeufe dieses Skripts.
--
--  WIE das geschieht, ist derselbe Punkt wie bei
--  preisanpassung_tageshoechstpreis.sql: die laufende Periode wird zum
--  heutigen Tag GESCHLOSSEN und eine neue eroeffnet. Der alte Satz wird
--  nicht ueberschrieben, denn entgeltposition.preis_id zeigt auf
--  genau diese Zeile. Geschaeftsregel GR5 verlangt den Preis zum
--  STARTZEITPUNKT der Fahrt; das geht nur mit Historie. Der
--  EXCLUDE-Constraint auf nutzungspreis weist jede Ueberschneidung ab.
--
--  WAS DAS FUER BESTEHENDE FAHRTEN BEDEUTET: nichts. Sie zeigen weiter
--  auf ihre alte Preiszeile und bleiben abgerechnet wie abgerechnet.
--
--  Idempotent: laeuft der Block ein zweites Mal, findet er keine offene
--  Periode mit den alten Werten mehr und tut nichts.
--
--  Ruecknahme: die neue Periode loeschen und bei der alten
--  gueltigkeit wieder nach oben oeffnen.
-- =====================================================================

begin;

-- 1. Laufende Periode schliessen - aber nur, solange sie noch den alten
--    Minutenpreis traegt.
update velocity.nutzungspreis p
   set gueltigkeit = daterange(lower(p.gueltigkeit), current_date, '[)')
  from velocity.fahrradtyp t, (values
    ('EBIKE', 0.50), ('CARGO', 0.10)
  ) as alt(typ_code, minute)
 where t.typ_id = p.typ_id
   and t.typ_code = alt.typ_code
   and p.preis_pro_minute = alt.minute
   and upper_inf(p.gueltigkeit)
   and lower(p.gueltigkeit) < current_date;

-- 2. Neue Periode ab heute eroeffnen. Startgebuehr und Tageshoechstpreis
--    bleiben, wie sie waren - geaendert wird nur der Minutenpreis.
insert into velocity.nutzungspreis
       (typ_id, gueltigkeit, startgebuehr, preis_pro_minute, tageshoechstpreis)
select t.typ_id, daterange(current_date, null, '[)'), n.start, n.minute, n.hoechst
  from (values
    ('EBIKE', 1.00, 0.25,  75.00),
    ('CARGO', 2.00, 0.50, 110.00)
  ) as n(typ_code, start, minute, hoechst)
  join velocity.fahrradtyp t on t.typ_code = n.typ_code
 where not exists (
   select 1 from velocity.nutzungspreis np
    where np.typ_id = t.typ_id and upper_inf(np.gueltigkeit)
 );

commit;

-- ---- Kontrolle -------------------------------------------------------
-- Je Typ genau eine offene Periode, und die traegt den neuen Preis.
do $$
declare
  v_fehler integer;
begin
  select count(*) into v_fehler
    from velocity.fahrradtyp t
    left join velocity.nutzungspreis p
      on p.typ_id = t.typ_id and upper_inf(p.gueltigkeit)
   where p.preis_id is null
      or (t.typ_code = 'CITY'  and p.preis_pro_minute <> 0.10)
      or (t.typ_code = 'EBIKE' and p.preis_pro_minute <> 0.25)
      or (t.typ_code = 'CARGO' and p.preis_pro_minute <> 0.50);
  if v_fehler > 0 then
    raise exception 'Minutenpreise stimmen nicht: % Typ(en) abweichend', v_fehler;
  end if;

  -- Keine Luecke und keine Ueberschneidung in der Historie.
  select count(*) into v_fehler
    from velocity.nutzungspreis a
    join velocity.nutzungspreis b
      on a.typ_id = b.typ_id
     and a.preis_id <> b.preis_id
     and a.gueltigkeit && b.gueltigkeit;
  if v_fehler > 0 then
    raise exception 'Preisperioden ueberschneiden sich: % Paare', v_fehler;
  end if;

  raise notice 'Minutenpreise gesetzt: City 0,10 · E-Bike 0,25 · Loader 0,50';
end;
$$;
