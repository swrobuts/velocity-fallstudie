-- =====================================================================
-- VeloCity - Pruefkonto fuer die Warenwirtschaft
-- =====================================================================
-- Zweck:   Ein zweiter Mitarbeitersatz, damit die Oberflaeche unter
--          wawi.butscher.cloud mit einer echten Anmeldung erprobt werden
--          kann. Bis hierher wurde jede Maske nur mit Attrappen geprueft -
--          Attrappen zeigen, dass der Code laeuft, nicht dass die
--          Datenbank die Rechte so vergibt, wie die Oberflaeche annimmt.
--
-- Vorbedingung: Der Anmeldesatz muss in auth.users existieren. Er wird
--          NICHT hier angelegt: das Setzen von Passwoertern gehoert in
--          die Hand des Betreibers, nicht in eine Datei im Repository.
--          Anlage ueber Supabase Studio -> Authentication -> Add user.
--
-- Idempotent: laeuft beliebig oft, legt nichts doppelt an.
--
-- Ausfuehren: python3 db/run.py db/betrieb/mitarbeiter_pruefkonto.sql
-- =====================================================================

-- ---- 1: Der Mitarbeitersatz -----------------------------------------
-- Dieselbe Person wie M-0001, aber eine andere Anmeldung. Das ist
-- Absicht: mitarbeiter zeigt auf eine auth_uid, nicht auf einen
-- Menschen. Wer zwei Anmeldungen hat, hat zwei Mitarbeitersaetze - und
-- genau daran laesst sich pruefen, dass die Rollen an der Anmeldung
-- haengen und nicht am Namen.
insert into velocity.mitarbeiter
       (personalnummer, auth_uid, vorname, nachname, email, eingetreten_am)
select 'M-0002', u.id, 'Robert', 'Butscher', u.email, current_date
  from auth.users u
 where u.email = 'robert.butscher@thws.de'
   and not exists (select 1 from velocity.mitarbeiter m
                    where m.personalnummer = 'M-0002');

-- ---- 2: Alle vier Rollen --------------------------------------------
-- Ein Pruefkonto mit allen Rollen sieht jede Maske. Fuer den Lehrbetrieb
-- wird das spaeter aufgeteilt - eine Rolle je Konto ist die einzige Art,
-- die Rollentrennung von aussen zu pruefen. Vorerst geht es darum,
-- ueberhaupt anmelden zu koennen.
insert into velocity.mitarbeiter_rolle (mitarbeiter_id, rolle_id)
select m.mitarbeiter_id, r.rolle_id
  from velocity.mitarbeiter m cross join velocity.rolle r
 where m.personalnummer = 'M-0002'
on conflict (mitarbeiter_id, rolle_id) do nothing;

-- ---- 3: Nachweis ----------------------------------------------------
-- Ohne diese Pruefung endet der Lauf still, wenn der Anmeldesatz fehlt -
-- und niemand merkt es, bis die Anmeldung im Browser scheitert.
do $$
declare
  v_rollen integer;
begin
  if not exists (select 1 from auth.users where email = 'robert.butscher@thws.de') then
    raise exception 'Anmeldesatz robert.butscher@thws.de fehlt in auth.users. '
                    'Erst in Supabase Studio anlegen, dann diese Datei erneut laufen lassen.';
  end if;

  select count(*) into v_rollen
    from velocity.mitarbeiter m
    join velocity.mitarbeiter_rolle mr on mr.mitarbeiter_id = m.mitarbeiter_id
   where m.personalnummer = 'M-0002';

  if v_rollen <> 4 then
    raise exception 'M-0002 hat % Rollen statt 4', v_rollen;
  end if;

  raise notice 'M-0002 angelegt und mit allen vier Rollen versehen.';
end;
$$;
