-- =====================================================================
-- VeloCity - Mitarbeitersatz fuer den Agentenzugang
--
-- Zweck:   Ein eigenes Konto, unter dem ein Agent die Warenwirtschaft
--          bedient. Es traegt alle vier Fachrollen und darf damit alles,
--          was ein Mensch mit denselben Rollen darf.
--
-- WARUM EIN EIGENES KONTO UND NICHT M-0001
--
-- Jeder Schreibvorgang landet in velocity.aenderungsprotokoll, und zwar
-- mit dem Mitarbeitersatz, der ihn ausgeloest hat. Meldet sich der Agent
-- als M-0001 an, steht unter jedem seiner Eingriffe "Robert Butscher" -
-- und das Protokoll taugt genau dann nicht mehr als Lehrmittel, wenn es
-- gebraucht wird: naemlich um zu zeigen, WAS der Agent getan hat und
-- was ein Mensch.
--
-- Zwei weitere Gruende, beide praktisch:
--   Der Zugang laesst sich einzeln stilllegen, ohne die eigene
--   Anmeldung anzufassen.
--   Fuer eine spaetere Uebung kann ein zweites Konto mit NUR EINER Rolle
--   entstehen - dann scheitert der Agent an der Datenbank statt an einer
--   Aufgabenbeschreibung, und das ist der ueberzeugendere Nachweis.
--
-- Vorbedingung: Der Anmeldesatz muss in auth.users existieren. Er wird
--          hier NICHT angelegt - Passwoerter gehoeren in die Hand des
--          Betreibers, nicht in eine Datei im Repository. Anlage ueber
--          Supabase Studio -> Authentication -> Add user, mit der unten
--          genannten Adresse.
--
--          Die Adresse endet auf .invalid. Diese Top-Level-Domain ist
--          reserviert und kann niemals Post empfangen (RFC 2606) - fuer
--          ein Maschinenkonto ist das die richtige Wahl, wie beim
--          Demozugang auch.
--
-- Idempotent: laeuft beliebig oft, legt nichts doppelt an.
--
-- Ausfuehren: python3 db/run.py db/betrieb/mitarbeiter_agentenkonto.sql
-- =====================================================================

-- ---- 1: Der Mitarbeitersatz -----------------------------------------
insert into velocity.mitarbeiter
       (personalnummer, auth_uid, vorname, nachname, email, eingetreten_am)
select 'M-AGENT', u.id, 'Agent', 'Zugang', u.email, current_date
  from auth.users u
 where u.email = 'agent@wawi.invalid'
   and not exists (select 1 from velocity.mitarbeiter m
                    where m.personalnummer = 'M-AGENT');

-- ---- 2: Alle vier Fachrollen ----------------------------------------
-- Der Agent soll alles koennen - das ist der Zweck der Versuchsplattform.
-- 'demo' bleibt ausgenommen: Sie ist die oeffentliche Vorfuehrrolle und
-- schraenkt ein, statt zu berechtigen. Ohne diesen Ausschluss vergaebe
-- der cross join fuenf Rollen und der Nachweis unten schluege fehl.
insert into velocity.mitarbeiter_rolle (mitarbeiter_id, rolle_id)
select m.mitarbeiter_id, r.rolle_id
  from velocity.mitarbeiter m cross join velocity.rolle r
 where m.personalnummer = 'M-AGENT'
   and r.code <> 'demo'
on conflict (mitarbeiter_id, rolle_id) do nothing;

-- ---- 3: Nachweis ----------------------------------------------------
-- Ohne diese Pruefung endet der Lauf still, wenn der Anmeldesatz fehlt -
-- und niemand merkt es, bis die erste Anmeldung des Agenten scheitert.
do $$
declare
  v_rollen integer;
begin
  if not exists (select 1 from auth.users where email = 'agent@wawi.invalid') then
    raise exception 'Anmeldesatz agent@wawi.invalid fehlt in auth.users. '
                    'Erst in Supabase Studio anlegen (Authentication -> Add user), '
                    'dann diese Datei erneut laufen lassen.';
  end if;

  select count(*) into v_rollen
    from velocity.mitarbeiter m
    join velocity.mitarbeiter_rolle mr on mr.mitarbeiter_id = m.mitarbeiter_id
   where m.personalnummer = 'M-AGENT';

  if v_rollen <> 4 then
    raise exception 'M-AGENT traegt % Fachrollen statt vier', v_rollen;
  end if;

  raise notice 'M-AGENT ist angelegt und traegt alle vier Fachrollen.';
end;
$$;
