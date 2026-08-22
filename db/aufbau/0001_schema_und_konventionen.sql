-- =====================================================================
-- 0001 Schema und Konventionen
--
-- Zweck:      Legt den Namensraum, die benoetigten Erweiterungen, die
--             Aufzaehlungstypen und die Audit-Mechanik an. Alle weiteren
--             Aufbauschritte setzen darauf auf.
-- Objekte:    Schema velocity
--             Erweiterung extensions.btree_gist
--             ENUM kunde_status, fahrrad_status, ausleihe_status,
--                  tarifart, rechnung_status, zahlung_status
--             Funktion velocity.fn_audit_setzen()
--             Funktion velocity.fn_audit_anhaengen(text)
-- Ruecknahme: DROP SCHEMA velocity CASCADE;
--             Die Erweiterung btree_gist bleibt bestehen, weil sie
--             instanzweit geteilt wird.
-- =====================================================================

create schema if not exists velocity;

-- btree_gist wird fuer die EXCLUDE-Constraints in Schritt 0004 gebraucht:
-- ohne sie fehlt bigint die Operatorklasse fuer den Zugriffsweg gist.
create extension if not exists btree_gist with schema extensions;

-- ---------------------------------------------------------------------
-- Aufzaehlungstypen
--
-- Geschlossene technische Wertemengen werden als ENUM modelliert,
-- fachliche Klassifikationen dagegen als Referenztabelle (siehe
-- entgeltart und zahlungsart). ENUM ist kompakt und schnell, laesst sich
-- aber nur mit ALTER TYPE erweitern und traegt keine Zusatzattribute.
-- ---------------------------------------------------------------------
do $$
declare
  v_typ record;
begin
  for v_typ in
    select * from (values
      ('kunde_status',    array['aktiv','gesperrt','geschlossen']),
      ('fahrrad_status',  array['verfuegbar','ausgeliehen','wartung','defekt','ausgemustert']),
      ('ausleihe_status', array['aktiv','abgeschlossen','storniert']),
      ('tarifart',        array['standard','vorteil']),
      ('rechnung_status', array['entwurf','gestellt','bezahlt','storniert']),
      ('zahlung_status',  array['offen','gebucht','fehlgeschlagen','erstattet'])
    ) as t(name, labels)
  loop
    if not exists (
      select 1 from pg_type ty
        join pg_namespace n on n.oid = ty.typnamespace
       where n.nspname = 'velocity' and ty.typname = v_typ.name
    ) then
      execute format(
        'create type velocity.%I as enum (%s)',
        v_typ.name,
        (select string_agg(quote_literal(l), ', ') from unnest(v_typ.labels) as l)
      );
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Audit-Mechanik
--
-- Jede Basistabelle traegt erstellt_am und geaendert_am. Der Trigger
-- schreibt beide Werte fort, damit sie nicht von der Anwendung abhaengen
-- und auch bei direktem SQL-Zugriff stimmen.
--
-- Verwendet wird bewusst now() und nicht clock_timestamp():
--   now()             = Beginn der Transaktion, konstant waehrend ihrer Dauer
--   clock_timestamp() = tatsaechliche Uhrzeit, aendert sich Zeile fuer Zeile
-- Fuer Audit-Spalten ist die Transaktionszeit richtig: alle in einem
-- Vorgang geaenderten Zeilen tragen denselben Stempel und lassen sich
-- damit als ein Aenderungssatz erkennen. Folge fuer Tests: innerhalb
-- einer Transaktion sind erstellt_am und geaendert_am gleich.
-- ---------------------------------------------------------------------
create or replace function velocity.fn_audit_setzen()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    new.erstellt_am := coalesce(new.erstellt_am, now());
  else
    new.erstellt_am := old.erstellt_am;   -- gegen nachtraegliches Verbiegen
  end if;
  new.geaendert_am := now();
  return new;
end;
$$;

create or replace function velocity.fn_audit_anhaengen(p_tabelle text)
returns void
language plpgsql
as $$
begin
  execute format('drop trigger if exists trg_%1$s_audit on velocity.%1$I', p_tabelle);
  execute format(
    'create trigger trg_%1$s_audit
       before insert or update on velocity.%1$I
       for each row execute function velocity.fn_audit_setzen()',
    p_tabelle
  );
end;
$$;
