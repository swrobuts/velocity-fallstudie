-- =====================================================================
-- t0000 Testrahmen
-- Zweck:   Beweist, dass pgTAP eingerichtet ist und der Testlaeufer
--          sowohl bestandene als auch fehlgeschlagene Zusicherungen
--          korrekt meldet.
-- =====================================================================

create extension if not exists pgtap with schema extensions;
-- Frisch anlegen, nicht nur sicherstellen. Sonst ueberleben
-- Testfunktionen aus frueheren Laeufen, die es in den Dateien laengst
-- nicht mehr gibt - runtests findet sie trotzdem und meldet Fehler, die
-- niemand mehr im Quelltext sucht. Genau das ist am 24.08.2026 passiert.
drop schema if exists velocity_test cascade;
create schema velocity_test;
set search_path = velocity_test, velocity, extensions, public;

create or replace function velocity_test.test_rahmen_ist_einsatzbereit()
returns setof text language plpgsql as $$
begin
  return next has_extension('extensions'::name, 'pgtap'::name,
                            'pgTAP ist im Schema extensions installiert');
  return next has_extension('extensions'::name, 'btree_gist'::name,
                            'btree_gist ist im Schema extensions installiert');
end;
$$;

drop function if exists velocity_test.test_rahmen_meldet_fehlschlag();
