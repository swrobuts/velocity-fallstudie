-- =====================================================================
-- 0017 Zugriffsschutz der Warenwirtschaft
--
-- Zweck:      Kunden und Mitarbeitende auseinanderhalten - obwohl beide
--             fuer PostgreSQL dieselbe Rolle 'authenticated' sind.
--             Rechtevergabe allein reicht dafuer nicht: ein
--             grant select ... to authenticated gaebe jedem Kunden die
--             Stammdaten aller anderen. Die Trennung steht deshalb in
--             drei Funktionen, die RLS-Regeln UND Sichten befragen.
-- Objekte:    velocity.mitarbeiter_id_aus_auth, velocity.ist_mitarbeiter,
--             velocity.hat_rolle, RLS-Regeln auf den Bereichen J, I, K
-- Ruecknahme: DROP FUNCTION velocity.hat_rolle(text),
--             velocity.ist_mitarbeiter(), velocity.mitarbeiter_id_aus_auth();
--             ALTER TABLE ... DISABLE ROW LEVEL SECURITY je Tabelle.
-- =====================================================================

-- security definer, damit die Funktion velocity.mitarbeiter lesen darf,
-- ohne dass der Aufrufer es duerfte. stable, damit der Planer sie je
-- Anweisung einmal auswertet statt je Zeile.
create or replace function velocity.mitarbeiter_id_aus_auth()
returns bigint
language sql
stable
security definer
set search_path = velocity, pg_temp
as $$
  select m.mitarbeiter_id from velocity.mitarbeiter m
   where m.auth_uid = auth.uid() and m.status = 'aktiv';
$$;

-- GR16: nur aktive Mitarbeitende. Der Statusfilter steckt schon in
-- mitarbeiter_id_aus_auth - hier steht er nicht noch einmal, damit es
-- nur EINE Stelle gibt, an der 'aktiv' definiert wird.
create or replace function velocity.ist_mitarbeiter()
returns boolean
language sql
stable
security definer
set search_path = velocity, pg_temp
as $$
  select velocity.mitarbeiter_id_aus_auth() is not null;
$$;

create or replace function velocity.hat_rolle(p_code text)
returns boolean
language sql
stable
security definer
set search_path = velocity, pg_temp
as $$
  select exists (
    select 1
      from velocity.mitarbeiter_rolle mr
      join velocity.rolle r on r.rolle_id = mr.rolle_id
     where mr.mitarbeiter_id = velocity.mitarbeiter_id_aus_auth()
       and r.code = p_code
  );
$$;

comment on function velocity.ist_mitarbeiter() is
  'Einziger Ort, an dem entschieden wird, wer Mitarbeiter ist. GR16.';

-- ---- Row Level Security ---------------------------------------------
-- RLS ist auf diesen Tabellen bereits seit ihrer Anlage eingeschaltet
-- (globale Randbedingung). Bis hierher hiess das: niemand kommt heran,
-- weil keine Regel existiert. Jetzt kommen die Regeln dazu.
--
-- enable und force stehen trotzdem noch einmal hier - idempotent und
-- billig. Sie sind die Zusicherung, dass diese Datei fuer sich allein
-- einen vollstaendigen Zustand herstellt und nicht darauf baut, dass
-- eine fruehere Datei etwas nicht vergessen hat.
do $$
declare v_t text;
begin
  foreach v_t in array array['rolle','mitarbeiter','mitarbeiter_rolle',
                             'schadensmeldung','wartungsauftrag','fahrrad_ereignis',
                             'aenderungsprotokoll','rechenannahme']
  loop
    execute format('alter table velocity.%I enable row level security', v_t);
    execute format('alter table velocity.%I force row level security', v_t);
    execute format('drop policy if exists %I on velocity.%I',
                   v_t || '_mitarbeiter_lesen', v_t);
    execute format(
      'create policy %I on velocity.%I for select using (velocity.ist_mitarbeiter())',
      v_t || '_mitarbeiter_lesen', v_t);
  end loop;
end;
$$;

-- Das Aenderungsprotokoll darf niemand aendern, auch die Leitung nicht.
-- Ein Protokoll, das sich nachtraeglich glaetten laesst, beweist nichts
-- (Art. 5 Abs. 2 DSGVO, Rechenschaftspflicht).
drop policy if exists aenderungsprotokoll_unveraenderlich on velocity.aenderungsprotokoll;
create policy aenderungsprotokoll_unveraenderlich on velocity.aenderungsprotokoll
  for update using (false);
drop policy if exists aenderungsprotokoll_unloeschbar on velocity.aenderungsprotokoll;
create policy aenderungsprotokoll_unloeschbar on velocity.aenderungsprotokoll
  for delete using (false);

-- ---- Rechte ----------------------------------------------------------
-- Keine Basistabelle wird freigegeben. Die Warenwirtschaft spricht
-- ausschliesslich Sichten und api_-Funktionen an - dieselbe Regel wie
-- fuer die Website, und tools/abnahme.sh prueft sie von aussen.
--
-- Zwei Einschraenkungen, beide teuer gelernt.
--
-- ERSTENS nicht "revoke all on all tables in schema velocity": ALL
-- TABLES schliesst in PostgreSQL die Sichten mit ein und haette der
-- Website jedes Leserecht genommen.
--
-- ZWEITENS - und das war der eigentliche Fehler - nicht ueber ALLE
-- Basistabellen des Schemas iterieren, sondern nur ueber die acht
-- neuen. Die erste Fassung tat das und riss die Rechte mit, die
-- 0011_sicherheit.sql fuer die "eigene Zeilen"-Regeln der Kunden
-- vergeben hatte: kunde, ausleihe, entgeltposition, mitgliedschaft,
-- rechnung und weitere. Folge war kein theoretisches Risiko, sondern
-- ein Funktionsbruch - v_meine_ausleihe und v_meine_rechnung laufen mit
-- security_invoker = true und brauchen die Rechte des AUFRUFERS. Ein
-- angemeldeter Kunde bekam "permission denied for table ausleihe" und
-- sah seine eigenen Fahrten nicht mehr.
--
-- Aufgefallen ist es erst in der Pruefung, per SET ROLE authenticated.
-- Weder die pgTAP-Kette noch tools/abnahme.sh haben es bemerkt: der
-- REST-Test prueft nur mit dem anon-Key und erwartet dort ohnehin eine
-- Sperre, und der Durchstich ruft authenticated nur ueber
-- security-definer-Funktionen auf.
do $$
declare v_t text;
begin
  foreach v_t in array array['rolle','mitarbeiter','mitarbeiter_rolle',
                             'schadensmeldung','wartungsauftrag','fahrrad_ereignis',
                             'aenderungsprotokoll','rechenannahme']
  loop
    execute format('revoke all on velocity.%I from anon, authenticated', v_t);
  end loop;
end;
$$;

-- GR17: zahlungsmittel bleibt gesperrt. Die Zeile ist redundant zur
-- Schleife darueber und steht trotzdem hier, damit sie beim Lesen
-- auffaellt und niemand sie versehentlich aufhebt.
revoke all on velocity.zahlungsmittel from anon, authenticated;

-- Diese beiden Funktionen MUESSEN fuer authenticated ausfuehrbar sein.
-- Nachgemessen: eine Sicht traegt NICHT die Ausfuehrungsrechte ihres
-- Eigentuemers. Ein "select * from v_wawi_flotte" als authenticated
-- scheitert sonst mit "permission denied for function hat_rolle" -
-- und damit jede einzelne Sicht der Warenwirtschaft.
--
-- Dass das unbedenklich ist, liegt an ihrem Zuschnitt, nicht an ihrer
-- Harmlosigkeit: beide sind security definer und filtern ausschliesslich
-- ueber auth.uid(). Ein Aufrufer erfaehrt durch sie nur etwas ueber SICH
-- SELBST - ob er Mitarbeiter ist und welche Rollen er traegt. Ueber
-- andere Personen geben sie nichts preis, und sie taugen auch nicht als
-- Orakel: hat_rolle('gibtsnicht') liefert dieselbe Antwort wie
-- hat_rolle('leitung') fuer einen Kunden, naemlich false.
--
-- mitarbeiter_id_aus_auth bleibt bewusst gesperrt. Sie wird nur aus den
-- beiden anderen heraus aufgerufen, und dort greifen die Rechte des
-- Eigentuemers.
grant execute on function
  velocity.ist_mitarbeiter(),
  velocity.hat_rolle(text)
to authenticated;
