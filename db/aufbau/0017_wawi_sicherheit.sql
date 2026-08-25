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
-- NICHT "revoke all on all tables in schema velocity": ALL TABLES
-- schliesst in PostgreSQL die Sichten mit ein. Diese eine Anweisung
-- haette der Website jedes Leserecht genommen und die Startseite
-- abgeschaltet. Deshalb ausdruecklich nur relkind = 'r'.
do $$
declare v_t text;
begin
  for v_t in
    select c.relname
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'velocity' and c.relkind = 'r'
  loop
    execute format('revoke all on velocity.%I from anon, authenticated', v_t);
  end loop;
end;
$$;

-- GR17: zahlungsmittel bleibt gesperrt. Die Zeile ist redundant zur
-- Schleife darueber und steht trotzdem hier, damit sie beim Lesen
-- auffaellt und niemand sie versehentlich aufhebt.
revoke all on velocity.zahlungsmittel from anon, authenticated;
