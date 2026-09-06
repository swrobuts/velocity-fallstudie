-- =====================================================================
-- 0001 Schema und Konventionen
--
-- Zweck:      Legt den Namensraum, die benoetigten Erweiterungen, die
--             Aufzaehlungstypen und die Audit-Mechanik an. Alle weiteren
--             Aufbauschritte setzen darauf auf.
-- Objekte:    Schema velocity
--             Erweiterung extensions.btree_gist
--             ENUM kunde_status, fahrrad_status, ausleihe_status,
--                  tarifart, rechnung_status, zahlung_status,
--                  mitarbeiter_status, schaden_schwere, schaden_status,
--                  auftrag_status, fahrrad_ereignisart, rahmenform,
--                  schaltungsart, bremsart, beleuchtungsart,
--                  motorfabrikat (16 Typen insgesamt, alle ueber eine
--                  Wertetabelle in einer Schleife per EXECUTE FORMAT
--                  angelegt - keiner steht als woertliches CREATE TYPE
--                  im Text, siehe Schleife weiter unten)
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
-- Zeitpunkte: IMMER timestamptz, nie timestamp
--
-- Jede Zeitspalte dieses Modells ist timestamptz. Das ist keine
-- Gewohnheit, sondern die eine Entscheidung, die eine ganze Fehlerklasse
-- ausschliesst - und sie wird hier festgehalten, weil man sie einer
-- Spalte nicht ansieht.
--
-- WAS DER UNTERSCHIED IST. timestamp speichert eine ABLESUNG: "9:44",
-- ohne zu sagen, auf welcher Uhr. timestamptz speichert einen
-- ZEITPUNKT: den Augenblick selbst, unabhaengig davon, wer wo auf die
-- Uhr sieht. Beide belegen acht Byte, beide sehen in einer Abfrage
-- gleich aus - der Unterschied zeigt sich erst, wenn zwei Zeitzonen ins
-- Spiel kommen.
--
-- WAS DAS IM BETRIEB HEISST. Ein Wert wird als der Augenblick abgelegt
-- und beim Lesen in die Zeitzone der SITZUNG umgerechnet. Dieselbe Zeile
-- erscheint deshalb verschieden, je nachdem wer sie liest:
--
--   psql mit timezone=UTC              2026-09-06 09:44:35+00
--   die Website (toLocaleString de-DE) 6.9.2026, 11:44:35
--
-- Das sind nicht zwei Werte, das ist einer. Im September gilt
-- Sommerzeit, also zwei Stunden Unterschied; im Januar waere es eine.
--
-- DIE FALLE, und sie ist am 06.09.2026 im Betrieb aufgetreten: Wer die
-- Ausgabe einer UTC-Sitzung abschreibt und als Ortszeit weiterverwendet,
-- verschiebt jeden Wert um zwei Stunden. Auswertungen nach Tageszeit
-- wandern dann ueber die Mittagsspitze, Tagesabgrenzungen ueber
-- Mitternacht. Der gespeicherte Wert war dabei nie falsch.
--
-- WIE MAN ES RICHTIG LIEST. Entweder einmal die Sitzung stellen:
--
--   set timezone = 'Europe/Berlin';
--
-- oder je Ausgabespalte umrechnen:
--
--   select a.startzeit at time zone 'Europe/Berlin' as start_ortszeit ...
--
-- "at time zone" liefert ein timestamp OHNE Zone. Fuer die Anzeige ist
-- das genau richtig, zum Rechnen nicht: wer damit vergleicht, sortiert
-- oder gruppiert, hat die Information weggeworfen, auf die es ankam.
-- Deshalb gehoert es in die Ausgabespalte, nie in where oder order by.
--
-- WAS ABSICHTLICH NICHT timestamptz IST: reine Kalenderangaben wie
-- angeschafft_am oder gueltigkeit. Ein Kaufdatum ist ein Tag, kein
-- Augenblick; date ist dort der richtige Typ, und eine Umrechnung waere
-- dort sogar schaedlich.
-- ---------------------------------------------------------------------

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
      ('zahlung_status',     array['offen','gebucht','fehlgeschlagen','erstattet']),
      -- Bereich J und I, Phase 2 (Warenwirtschaft)
      ('mitarbeiter_status', array['aktiv','beurlaubt','ausgeschieden']),
      ('schaden_schwere',    array['gering','mittel','fahruntauglich']),
      ('schaden_status',     array['offen','in_arbeit','behoben','verworfen']),
      ('auftrag_status',     array['offen','in_arbeit','erledigt','abgebrochen']),
      ('fahrrad_ereignisart',array['angeschafft','status_geaendert','gewartet','umgesetzt','ausgemustert']),
      -- Ausstattung eines einzelnen Rades (0024_radausstattung.sql).
      -- Aufzaehlungstypen und nicht Freitext, weil sich diese Listen
      -- abschliessen lassen - anders als schadensmeldung.kategorie, wo
      -- der Spaltenkommentar die Gegenentscheidung begruendet: ein
      -- Schadensbild laesst sich nicht vorab aufzaehlen, eine Bremsbauart
      -- schon.
      ('rahmenform',        array['diamant','tiefeinsteiger']),
      -- Nur 'nabe': Die Flotte faehrt ausschliesslich Nabenschaltung,
      -- eine Kettenschaltung gibt es nicht. Die Spalte bleibt trotzdem
      -- stehen - wie farbe - damit die Stelle da ist, sobald sich das
      -- aendert. Die ZAHL der Gaenge steht weiter am Typ
      -- (fahrradtyp.gangzahl), weil sie der Bauart folgt: City 8,
      -- E-Bike und Cargo 11.
      ('schaltungsart',     array['nabe']),
      -- Ohne 'ruecktritt': angeboten werden Felgen- und Scheibenbremse.
      ('bremsart',          array['felge','scheibe']),
      ('beleuchtungsart',   array['nabendynamo','akku','keine']),
      -- Zwei Fabrikate, beide erfunden wie die Hersteller der Fallstudie.
      -- Sie stehen zugleich als Werbemerkmal auf der Tarifkarte
      -- (0008_referenzdaten.sql) - eine Tatsache, eine Stelle. Die
      -- Klartexte "Vantaa Motion M50" und "Vantaa Motion C85" liefert
      -- die Oberflaeche ueber wert.vantaa_m50 / wert.vantaa_c85; der
      -- Bezeichner bleibt ASCII wie bei jedem anderen Aufzaehlungswert.
      ('motorfabrikat',     array['vantaa_m50','vantaa_c85'])
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
