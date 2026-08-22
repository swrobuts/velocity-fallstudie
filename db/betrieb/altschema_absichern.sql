-- =====================================================================
-- Altschema cityBikesRental absichern
--
-- Zweck:      Schliesst den anonymen Vollzugriff und entfernt die
--             Klartextpasswoerter. Struktur und Datensaetze bleiben
--             unveraendert erhalten und weiter vorfuehrbar.
--
-- Voraussetzung: Sicherung durch tools/schema_dump.py gezogen und
--             geprueft; Abgleichsbericht der Uebernahme ohne unerklaerte
--             Abweichung.
--
-- FOLGE: Die Warenwirtschafts-Oberflaeche unter erp/ spricht dieses
--        Schema und funktionierte bisher nur ueber den offenen
--        anon-Zugriff. Sie ist nach diesem Schritt ausser Betrieb, bis
--        Phase 2 sie auf velocity umstellt. Das ist beabsichtigt: eine
--        Oberflaeche, die ihre Rechte aus einem oeffentlich
--        ausgelieferten Schluessel bezieht, darf so nicht weiterlaufen.
--
-- Ruecknahme: Aus der Sicherung wiederherstellen. Die entfernten
--             Policies werden bewusst NICHT wieder angelegt.
-- =====================================================================

-- 1 Alle Policies entfernen, die anon Zugriff geben.
do $$
declare
  v_p record;
begin
  for v_p in
    select schemaname, tablename, policyname, roles::text as rollen
      from pg_policies
     where schemaname = 'cityBikesRental'
  loop
    if v_p.rollen like '%anon%' then
      execute format('drop policy %I on %I.%I',
                     v_p.policyname, v_p.schemaname, v_p.tablename);
      raise notice 'Policy entfernt: %.% -> %', v_p.schemaname, v_p.tablename, v_p.policyname;
    end if;
  end loop;
end $$;

-- 2 Rechte zurueckziehen. PUBLIC ausdruecklich mit: EXECUTE auf
--   Funktionen wird von PostgreSQL automatisch an PUBLIC vergeben, ein
--   REVOKE gegen anon allein greift deshalb nicht.
revoke all on all tables    in schema "cityBikesRental" from anon, authenticated;
revoke all on all functions in schema "cityBikesRental" from public, anon, authenticated;
revoke all on all sequences in schema "cityBikesRental" from anon, authenticated;
revoke usage on schema "cityBikesRental" from anon, authenticated;

-- 3 Klartextpasswoerter entfernen. Die Spalte bleibt bestehen, damit
--   die Struktur unveraendert vorfuehrbar ist.
update "cityBikesRental".kunde set passwort_hash = '' where passwort_hash <> '';

-- 4 Ergebnis nachweisen.
select 'verbliebene Policies mit anon' as pruefung, count(*) as anzahl
  from pg_policies
 where schemaname = 'cityBikesRental' and roles::text like '%anon%'
union all
select 'nicht leere Passwortfelder', count(*)
  from "cityBikesRental".kunde where passwort_hash <> ''
union all
select 'Kundensaetze unveraendert vorhanden', count(*)
  from "cityBikesRental".kunde
union all
select 'Tabellen im Altschema unveraendert', count(*)
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'cityBikesRental' and c.relkind = 'r';
