-- =====================================================================
-- Leseschema und Rolle fuer die Erkundung durch Studierende
--
-- Zweck:      Studierende sollen das Datenmodell mit einem beliebigen
--             Datenbankwerkzeug ansehen koennen - Navicat, DBeaver,
--             pgAdmin, DataGrip, psql. Alle sprechen dasselbe
--             Postgres-Protokoll; die Loesung gehoert deshalb auf den
--             Server und nicht in eine Anleitung je Programm.
-- Objekte:    Schema velocity_lesen mit einer Sicht je Basistabelle,
--             Rolle studi (LOGIN, OHNE Kennwort)
-- Aufruf:     python3 db/run.py db/betrieb/studizugang_leseschema.sql
--
-- ---------------------------------------------------------------------
-- WARUM EIN EIGENES SCHEMA UND NICHT EIN RECHT AUF velocity
--
-- Alle 39 Basistabellen tragen Row Level Security, und die
-- v_wawi_-Sichten filtern ueber velocity.hat_rolle(), das
-- request.jwt.claims liest. Auf einer direkten Postgres-Verbindung gibt
-- es kein JWT. Eine gewoehnliche Leserolle auf velocity saehe deshalb
-- keine Fehlermeldung, sondern UEBERALL NULL ZEILEN - und Studierende
-- suchten den Fehler bei sich.
--
-- BYPASSRLS waere der andere Weg und ist hier nicht gangbar: Das
-- Attribut zu vergeben verlangt Superuser-Rechte, und die Kennung, mit
-- der dieses Projekt arbeitet (postgres), traegt zwar bypassrls, ist
-- aber selbst kein Superuser.
--
-- Bleibt das Leseschema: Die Sichten darin gehoeren postgres, laufen
-- also mit dessen Rechten - und weil postgres bypassrls traegt, greift
-- die Zeilenschranke der Basistabellen nicht. Die Rolle studi bekommt
-- SELECT ausschliesslich auf DIESES Schema, nie auf velocity.
--
-- ---------------------------------------------------------------------
-- WAS DAS KOSTET, UND WARUM ES TROTZDEM RICHTIG IST
--
-- Dieses Schema UMGEHT die Row Level Security, die im Sicherheitskapitel
-- als Schranke gelehrt wird. Das ist kein Widerspruch, solange man es
-- ausspricht: Es ist ein Lesefenster fuer die Modellerkundung, nicht die
-- Anwendung. Wer zeigen will, wie RLS wirkt, nimmt die Warenwirtschaft -
-- dort sitzt die Schranke, und dort ist sie der Gegenstand.
--
-- Der Zugang ist rein lesend: kein INSERT, kein UPDATE, kein DELETE,
-- kein Zugriff auf das Schema auth, keine api_-Funktion.
--
-- ---------------------------------------------------------------------
-- DAS KENNWORT STEHT NICHT IN DIESER DATEI
--
-- Die Rolle wird mit LOGIN, aber OHNE Kennwort angelegt. Ohne gesetztes
-- Kennwort kann sich niemand anmelden - die Rolle ist bis dahin
-- wirkungslos und nicht etwa offen. Gesetzt wird es getrennt, damit es
-- weder im Repository noch in einer Shell-Historie landet:
--
--     alter role studi with login password '…';
--
-- Am besten interaktiv ueber   psql -c '\password studi'   - dann geht
-- der Wert bereits gehasht ueber die Leitung.
-- =====================================================================

create schema if not exists velocity_lesen;

comment on schema velocity_lesen is
  'Lesefenster auf das Datenmodell für die Erkundung mit beliebigen Datenbankwerkzeugen. '
  'Eine Sicht je Basistabelle von velocity, Eigentümer postgres - damit greift die Row Level '
  'Security der Tabellen nicht. Ausschließlich lesend. Siehe Kopfkommentar von '
  'db/betrieb/studizugang_leseschema.sql.';

-- ---- Je Basistabelle eine Sicht --------------------------------------
-- Abgeleitet und nicht aufgezaehlt: Eine gepflegte Liste waere nach der
-- naechsten neuen Tabelle unvollstaendig, ohne dass es auffiele -
-- dieselbe Regel wie bei tools/wawi_veroeffentlichen.sh und bei
-- Abnahmeschritt 28.
--
-- drop und neu statt CREATE OR REPLACE: Ein REPLACE scheitert, sobald
-- eine Spalte weggefallen ist (siehe den Umbau der Ausstattung), und
-- diese Datei laeuft ohnehin nur auf Zuruf.
do $$
declare
  v_tab text;
  v_n   integer := 0;
begin
  for v_tab in
    select tablename from pg_tables where schemaname = 'velocity' order by tablename
  loop
    execute format('drop view if exists velocity_lesen.%I', v_tab);
    execute format('create view velocity_lesen.%I as select * from velocity.%I',
                   v_tab, v_tab);
    v_n := v_n + 1;
  end loop;
  raise notice '% Sichten in velocity_lesen angelegt', v_n;
end $$;

-- ---- Die Rolle -------------------------------------------------------
-- create role ist nicht idempotent, deshalb die Abfrage davor. Kein
-- Kennwort: siehe Kopfkommentar.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'studi') then
    create role studi login;
    raise notice 'Rolle studi angelegt - ohne Kennwort, also noch nicht anmeldefaehig';
  else
    raise notice 'Rolle studi war schon da';
  end if;
end $$;

comment on role studi is
  'Leserolle für die Erkundung des Datenmodells durch Studierende. Sieht ausschließlich '
  'velocity_lesen, hat kein Schreibrecht und keinen Zugriff auf auth.';

-- ---- Rechte: nur lesen, nur dieses Schema ----------------------------
do $$ begin
  execute format('grant connect on database %I to studi', current_database());
end $$;

grant usage on schema velocity_lesen to studi;
grant select on all tables in schema velocity_lesen to studi;

-- Damit eine spaeter hinzugekommene Sicht nicht von Hand freigegeben
-- werden muss - und damit niemand sich darauf verlaesst, dass ein
-- erneuter Lauf dieser Datei das schon richten wird.
alter default privileges in schema velocity_lesen grant select on tables to studi;

-- ---- Und ausdruecklich NICHT ----------------------------------------
-- Der Entzug steht hier, obwohl studi diese Rechte nie bekommen hat:
-- Eine neue Rolle erbt, was PUBLIC hat, und PUBLIC traegt in einer
-- Supabase-Installation mehr, als man beim Lesen der Rechteliste
-- vermutet. Zweimal entzogen ist besser als einmal uebersehen.
revoke all on schema velocity from studi;
revoke all on all tables in schema velocity from studi;
revoke all on all functions in schema velocity from studi;
revoke all on schema public from studi;

-- ---- Gegenprobe ------------------------------------------------------
-- Eine Datei, die Rechte vergibt, sollte am Ende sagen, was dabei
-- herausgekommen ist - sonst glaubt man ihr.
--
-- Geprueft wird ueber die OID und nicht ueber den zusammengesetzten
-- Namen: Die erste Fassung rief has_table_privilege() mit
-- format('velocity_lesen.%I', viewname) auf und scheiterte an
-- vault.decrypted_secrets. Grund ist, dass PostgreSQL die Reihenfolge
-- von WHERE-Filter und Funktionsaufruf NICHT garantiert - die Funktion
-- lief also auch ueber Zeilen anderer Schemata und baute daraus einen
-- Namen, den es nicht gibt. Mit einer OID kann das nicht passieren.
do $$
declare
  v_sichten integer;
  v_lesbar  integer;
  v_schreib integer;
  v_velo    integer;
begin
  select count(*), count(*) filter (where has_table_privilege('studi', c.oid, 'select')),
         count(*) filter (where has_table_privilege('studi', c.oid, 'insert')
                             or has_table_privilege('studi', c.oid, 'update')
                             or has_table_privilege('studi', c.oid, 'delete'))
    into v_sichten, v_lesbar, v_schreib
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'velocity_lesen' and c.relkind = 'v';

  select count(*) filter (where has_table_privilege('studi', c.oid, 'select'))
    into v_velo
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'velocity' and c.relkind = 'r';

  raise notice 'velocity_lesen: % Sichten, davon % fuer studi lesbar', v_sichten, v_lesbar;
  raise notice 'studi mit Schreibrecht: % Sichten (erwartet 0)', v_schreib;
  raise notice 'studi liest direkt aus velocity: % Tabellen (erwartet 0)', v_velo;

  if v_sichten = 0 or v_lesbar <> v_sichten or v_schreib > 0 or v_velo > 0 then
    raise exception 'Rechte stehen nicht wie beabsichtigt';
  end if;
end $$;
