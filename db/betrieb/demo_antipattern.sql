-- =====================================================================
-- Demo fuer die Sicherheitsfolien: der haeufigste Supabase-Anfaengerfehler
--
-- Zweck:      Studierende duerfen diese Tabelle live mit dem anon-Key
--             auslesen und veraendern. Die Daten sind frei erfunden.
--             Der echte Bestand wird dafuer NICHT geoeffnet.
-- Objekte:    Schema velocity_demo, Tabelle kunde_unsicher
-- Ruecknahme: DROP SCHEMA velocity_demo CASCADE;
-- =====================================================================
create schema if not exists velocity_demo;

create table if not exists velocity_demo.kunde_unsicher (
  id    bigint generated always as identity primary key,
  name  text not null,
  email text not null,
  notiz text
);

insert into velocity_demo.kunde_unsicher (name, email, notiz)
select 'Erfundene Person ' || i,
       'person' || i || '@beispiel.invalid',
       'Frei erfundener Datensatz für die Vorlesung'
  from generate_series(1, 25) i
 where not exists (select 1 from velocity_demo.kunde_unsicher);

alter table velocity_demo.kunde_unsicher enable row level security;

-- GENAU DAS ist der Fehler, der in der Vorlesung gezeigt wird:
drop policy if exists "alles fuer alle" on velocity_demo.kunde_unsicher;
create policy "alles fuer alle" on velocity_demo.kunde_unsicher
  for all to anon, authenticated using (true) with check (true);

grant usage on schema velocity_demo to anon, authenticated;
grant select, insert, update, delete on velocity_demo.kunde_unsicher to anon, authenticated;

comment on schema velocity_demo is
  'Demoschema für die Sicherheitsfolien. Enthaelt ausschliesslich erfundene Daten.';
comment on table velocity_demo.kunde_unsicher is
  'Absichtlich unsicher: FOR ALL TO anon USING (true). Nur zur Vorfuehrung.';
comment on column velocity_demo.kunde_unsicher.id    is 'Surrogatschlüssel.';
comment on column velocity_demo.kunde_unsicher.name  is 'Erfundener Name.';
comment on column velocity_demo.kunde_unsicher.email is 'Erfundene Adresse unter .invalid.';
comment on column velocity_demo.kunde_unsicher.notiz is 'Hinweis, dass die Daten erfunden sind.';
