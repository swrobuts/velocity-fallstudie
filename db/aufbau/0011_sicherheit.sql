-- =====================================================================
-- 0011 Zugriffsschutz
--
-- Zweck:      Grundhaltung "default deny". Die Rolle anon erreicht nur
--             die oeffentlichen Sichten, authenticated zusaetzlich die
--             eigenen Zeilen und die api_-Funktionen. Basistabellen mit
--             Personenbezug sind von aussen unerreichbar.
-- Objekte:    RLS und Policies auf allen Basistabellen, Grants
-- Ruecknahme: DROP POLICY je Policy; ALTER TABLE ... DISABLE ROW LEVEL
--             SECURITY; REVOKE der Grants.
-- =====================================================================

grant usage on schema velocity to anon, authenticated;

-- Erst alles zurueckziehen, dann gezielt vergeben. Damit ist der Endstand
-- unabhaengig davon, was vorher galt.
revoke all on all tables    in schema velocity from anon, authenticated;
revoke all on all sequences in schema velocity from anon, authenticated;

-- ---------------------------------------------------------------------
-- ACHTUNG, haeufig uebersehene Falle:
-- PostgreSQL vergibt EXECUTE auf neu angelegte Funktionen automatisch an
-- die Rolle PUBLIC. Ein REVOKE gegen anon und authenticated allein
-- greift deshalb nicht - beide Rollen erben das Recht weiterhin ueber
-- PUBLIC. Ohne die naechste Zeile koennte jeder mit dem oeffentlichen
-- anon-Key auch die interne Fachlogik fn_ausleihe_beenden aufrufen und
-- damit die Pruefung auf auth.uid() umgehen.
-- Der Testfall test_s_api_rechte hat genau das aufgedeckt.
-- ---------------------------------------------------------------------
revoke all on all functions in schema velocity from public, anon, authenticated;

-- Damit die Falle auch bei kuenftig angelegten Funktionen nicht wieder
-- zuschnappt:
alter default privileges in schema velocity revoke execute on functions from public;

-- ---------------------------------------------------------------------
-- RLS auf jeder Basistabelle einschalten
-- ---------------------------------------------------------------------
do $$
declare
  v_t record;
begin
  for v_t in
    select c.relname
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'velocity' and c.relkind = 'r'
  loop
    execute format('alter table velocity.%I enable row level security', v_t.relname);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Personenfreie Stammdaten: authenticated darf lesen, weil die
-- persoenlichen Sichten sie mit den Rechten des Aufrufers verknuepfen.
-- Diese Tabellen sind ueber v_station und v_verfuegbares_fahrrad ohnehin
-- oeffentlich sichtbar; es entsteht also kein zusaetzlicher Einblick.
-- ---------------------------------------------------------------------
do $$
declare
  v_t text;
begin
  foreach v_t in array array['station','fahrrad','fahrradmodell','fahrradtyp'] loop
    execute format('drop policy if exists %I on velocity.%I', v_t || '_lesen_auth', v_t);
    execute format(
      'create policy %I on velocity.%I for select to authenticated using (true)',
      v_t || '_lesen_auth', v_t);
    execute format('grant select on velocity.%I to authenticated', v_t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Eigene Zeilen: nur lesend, immer ueber auth.uid() eingegrenzt.
-- Geschrieben wird ausschliesslich ueber die api_-Funktionen.
-- ---------------------------------------------------------------------
drop policy if exists kunde_eigene on velocity.kunde;
create policy kunde_eigene on velocity.kunde
  for select to authenticated using (auth_uid = auth.uid());
grant select on velocity.kunde to authenticated;

drop policy if exists ausleihe_eigene on velocity.ausleihe;
create policy ausleihe_eigene on velocity.ausleihe
  for select to authenticated using (
    exists (select 1 from velocity.kunde k
             where k.kunde_id = ausleihe.kunde_id and k.auth_uid = auth.uid()));
grant select on velocity.ausleihe to authenticated;

drop policy if exists entgeltposition_eigene on velocity.entgeltposition;
create policy entgeltposition_eigene on velocity.entgeltposition
  for select to authenticated using (
    exists (select 1 from velocity.ausleihe a
              join velocity.kunde k on k.kunde_id = a.kunde_id
             where a.ausleihe_id = entgeltposition.ausleihe_id
               and k.auth_uid = auth.uid()));
grant select on velocity.entgeltposition to authenticated;

drop policy if exists mitgliedschaft_eigene on velocity.mitgliedschaft;
create policy mitgliedschaft_eigene on velocity.mitgliedschaft
  for select to authenticated using (
    exists (select 1 from velocity.kunde k
             where k.kunde_id = mitgliedschaft.kunde_id and k.auth_uid = auth.uid()));
grant select on velocity.mitgliedschaft to authenticated;

drop policy if exists freiminuten_periode_eigene on velocity.freiminuten_periode;
create policy freiminuten_periode_eigene on velocity.freiminuten_periode
  for select to authenticated using (
    exists (select 1 from velocity.mitgliedschaft m
              join velocity.kunde k on k.kunde_id = m.kunde_id
             where m.mitgliedschaft_id = freiminuten_periode.mitgliedschaft_id
               and k.auth_uid = auth.uid()));
grant select on velocity.freiminuten_periode to authenticated;

drop policy if exists rechnung_eigene on velocity.rechnung;
create policy rechnung_eigene on velocity.rechnung
  for select to authenticated using (
    exists (select 1 from velocity.kunde k
             where k.kunde_id = rechnung.kunde_id and k.auth_uid = auth.uid()));
grant select on velocity.rechnung to authenticated;

drop policy if exists rechnungsposition_eigene on velocity.rechnungsposition;
create policy rechnungsposition_eigene on velocity.rechnungsposition
  for select to authenticated using (
    exists (select 1 from velocity.rechnung r
              join velocity.kunde k on k.kunde_id = r.kunde_id
             where r.rechnung_id = rechnungsposition.rechnung_id
               and k.auth_uid = auth.uid()));
grant select on velocity.rechnungsposition to authenticated;

drop policy if exists zahlung_eigene on velocity.zahlung;
create policy zahlung_eigene on velocity.zahlung
  for select to authenticated using (
    exists (select 1 from velocity.rechnung r
              join velocity.kunde k on k.kunde_id = r.kunde_id
             where r.rechnung_id = zahlung.rechnung_id
               and k.auth_uid = auth.uid()));
grant select on velocity.zahlung to authenticated;

drop policy if exists zahlungsmittel_eigene on velocity.zahlungsmittel;
create policy zahlungsmittel_eigene on velocity.zahlungsmittel
  for select to authenticated using (
    exists (select 1 from velocity.kunde k
             where k.kunde_id = zahlungsmittel.kunde_id and k.auth_uid = auth.uid()));
grant select on velocity.zahlungsmittel to authenticated;

-- velocity.adresse bekommt bewusst KEINE Policy und KEIN Leserecht:
-- Anschriften sind ueber v_mein_profil erreichbar, das mit
-- Definer-Rechten laeuft und auf auth.uid() filtert.

-- ---------------------------------------------------------------------
-- Sichten
-- ---------------------------------------------------------------------
grant select on velocity.v_station,
                velocity.v_verfuegbares_fahrrad,
                velocity.v_tarifkarte,
                velocity.v_tarif,
                velocity.v_faq,
                velocity.v_nutzungsschritt,
                velocity.v_kennzahl,
                velocity.v_hoehenmarke
  to anon, authenticated;

grant select on velocity.v_meine_ausleihe,
                velocity.v_meine_rechnung,
                velocity.v_mein_profil
  to authenticated;

-- ---------------------------------------------------------------------
-- Funktionen: nur die api_-Schicht, nur fuer angemeldete Nutzer.
-- Die fn_-Fachlogik bleibt von aussen unerreichbar.
-- ---------------------------------------------------------------------
grant execute on function velocity.api_kunde_sicherstellen()                           to authenticated;
grant execute on function velocity.api_profil_aktualisieren(text,text,text,date,text,text,text,text) to authenticated;
grant execute on function velocity.api_ausleihe_starten(bigint)                        to authenticated;
grant execute on function velocity.api_ausleihe_beenden(bigint,bigint,numeric,numeric) to authenticated;
