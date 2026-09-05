-- =====================================================================
-- Lesender Zugang zum Datenmodell fuer Studierende
--
-- Zweck:      Studierende sollen das Datenmodell mit einem beliebigen
--             Datenbankwerkzeug erkunden koennen - DataGrip, Navicat,
--             DBeaver, pgAdmin, psql. Alle sprechen dasselbe
--             Postgres-Protokoll; die Loesung gehoert deshalb auf den
--             Server und nicht in eine Anleitung je Programm.
-- Objekte:    Rolle studi (LOGIN, OHNE Kennwort), Leserecht auf die
--             39 Basistabellen von velocity, je Tabelle eine
--             SELECT-Regel fuer diese Rolle
-- Aufruf:     python3 db/run.py db/betrieb/studizugang_lesend.sql
--
-- ---------------------------------------------------------------------
-- WARUM DIREKT AUF DIE TABELLEN UND NICHT AUF EINE SICHTENKOPIE
--
-- Der erste Anlauf legte ein Schema velocity_lesen an: je Basistabelle
-- eine Sicht, Eigentuemer postgres, damit die Zeilenschranke nicht
-- greift. Das funktionierte und hatte einen Mangel, der erst im Werkzeug
-- auffiel: EINE SICHT TRAEGT KEINE FREMDSCHLUESSEL. DataGrip und
-- Verwandte lesen die Beziehungen aus pg_constraint; ueber Sichten
-- finden sie dort nichts und koennen kein Diagramm zeichnen. Von den 41
-- Fremdschluesseln des Schemas war keiner sichtbar - und gerade die
-- Beziehungen sind der Gegenstand einer Modellerkundung.
--
-- Deshalb jetzt der direkte Weg: Leserecht auf velocity selbst. Die
-- Tabellen bringen ihre Fremdschluessel, ihre Kommentare und ihre
-- Datentypen von sich aus mit; das Werkzeug zeichnet daraus sein
-- Diagramm ohne Zutun. Nachgemessen als studi: 41 Fremdschluessel,
-- 39 Primaerschluessel, 32 UNIQUE, 75 CHECK.
--
-- EINE EINSCHRAENKUNG, DIE MAN KENNEN MUSS: Gelesen werden sie ueber
-- pg_catalog - dort steht alles. information_schema.referential_constraints
-- liefert studi dagegen NULL Zeilen, weil diese Sicht nach EIGENTUM
-- filtert und nicht nach Leserecht. DataGrip, Navicat und DBeaver lesen
-- pg_catalog und zeichnen deshalb richtig; ein Werkzeug, das sich allein
-- auf information_schema stuetzt, saehe kein Diagramm.
--
-- velocity_lesen wird dabei abgeraeumt. Zwei Wege zu denselben Daten
-- sind einer zu viel: Der zweite veraltet, sobald jemand nur den ersten
-- pflegt.
--
-- ---------------------------------------------------------------------
-- DIE ZEILENSCHRANKE BLEIBT STEHEN - SIE BEKOMMT EINE AUSNAHME
--
-- Alle 39 Basistabellen tragen Row Level Security, neun davon erzwungen.
-- Ein blosses GRANT SELECT reichte deshalb nicht: studi saehe keine
-- Fehlermeldung, sondern UEBERALL NULL ZEILEN - und die Studierenden
-- suchten den Fehler bei sich.
--
-- BYPASSRLS waere der kurze Weg und ist nicht gangbar: Das Attribut zu
-- vergeben verlangt Superuser-Rechte, und postgres traegt es zwar, ist
-- aber selbst kein Superuser.
--
-- Bleibt die ehrliche Loesung: je Tabelle EINE benannte Regel, die
-- ausschliesslich der Rolle studi ausschliesslich das Lesen erlaubt. Sie
-- steht neben den bestehenden 25 Regeln und hebt keine davon auf - fuer
-- jede andere Rolle aendert sich nichts. Wer wissen will, was studi darf,
-- liest eine Regel und nicht die Abwesenheit einer Schranke.
--
-- Der Preis steht hier offen: Das Schema traegt danach 39 Regeln mehr,
-- und das Sicherheitskapitel wird dadurch nicht uebersichtlicher. Der
-- Gegenwert ist, dass die Ausnahme benannt und begrenzt ist statt
-- pauschal.
--
-- WAS studi NICHT BEKOMMT
--
-- Kein INSERT, UPDATE oder DELETE - die Regeln lauten FOR SELECT, und
-- vergeben wird nur SELECT. Keine api_-Funktion: In velocity hat keine
-- einzige Funktion EXECUTE fuer PUBLIC (nachgemessen), das Leserecht auf
-- das Schema oeffnet also keine. Kein Zugriff auf auth. Keine der
-- v_wawi_-Sichten - sie filtern ueber hat_rolle() gegen ein JWT, das es
-- auf einer Postgres-Verbindung nicht gibt, und lieferten deshalb nur
-- leere Ergebnisse, die wie ein Fehler aussehen.
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
-- Am besten interaktiv in einer psql-Sitzung ueber   \password studi
-- - dann geht der Wert bereits gehasht ueber die Leitung. Vorsicht:
-- Eine leere Eingabe ist kein Fehler, sondern eine LOESCHUNG; psql
-- meldet dann nur "empty string is not a valid password, clearing
-- password".
--
-- ---------------------------------------------------------------------
-- VERBINDUNG - GEMESSEN, NICHT VERMUTET (05.09.2026)
--
--     Host        supabase.butscher.cloud
--     Port        5433        NICHT 5432. Von den drei ueblichen Ports
--                             antwortet nur dieser; 5432 und 6543 sind zu.
--     Datenbank   postgres
--     Benutzer    studi
--     SSL         AUS. Nicht "require" - der Server hat TLS nicht an
--                             (pg_settings: ssl = off). Ein sslmode=require
--                             scheitert mit "server does not support SSL".
--
-- WAS DAS HEISST: Kennwort und alle Abfrageergebnisse gehen
-- unverschluesselt ueber das offene Internet. Bei erfundenen Daten und
-- einem Wegwerf-Kennwort tragbar - aber als Entscheidung, nicht als
-- Ueberraschung. Wer es aendern will, schaltet ssl = on im
-- Postgres-Container ein oder legt einen TLS-Proxy davor; beides ist
-- Serverarbeit und nicht in dieser Datei zu erledigen.
-- =====================================================================

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
  'Leserolle für die Erkundung des Datenmodells durch Studierende. Liest die Basistabellen '
  'von velocity über je eine eigene SELECT-Regel, hat kein Schreibrecht, keinen Zugriff auf '
  'auth und auf keine Funktion. Siehe db/betrieb/studizugang_lesend.sql.';

-- ---- Die Sichtenkopie faellt weg -------------------------------------
-- Sie war der erste Anlauf und ist seit dem direkten Leserecht
-- ueberfluessig. cascade nimmt die 39 Sichten mit; an ihnen haengt
-- nichts anderes.
drop schema if exists velocity_lesen cascade;

-- ---- Leserecht und je Tabelle eine Regel -----------------------------
grant usage on schema velocity to studi;

do $$
declare
  v_tab text;
  v_n   integer := 0;
begin
  -- ALLE Tabellen, ohne Ausnahme - auch zahlungsmittel. Der erste Anlauf
  -- nahm sie heraus, weil test_s_zahlungsmittel_bleibt_gesperrt rot
  -- wurde. Die Entscheidung dagegen ist bewusst gefallen: Die Kundschaft
  -- dieser Fallstudie ist erfunden, die Tabelle ist leer, und ein
  -- Datenmodell mit einem Loch ist als Lehrgegenstand schlechter als
  -- eines ohne. Der Test nennt studi_liest jetzt ausdruecklich als
  -- erlaubte zweite Regel und bleibt fuer jede DRITTE rot.
  for v_tab in
    select c.relname
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'velocity' and c.relkind = 'r'
     order by c.relname
  loop
    -- Nur SELECT. Ein GRANT ALL waere hier der bequeme Fehler.
    execute format('grant select on velocity.%I to studi', v_tab);

    -- Und die Ausnahme von der Zeilenschranke, benannt und auf eine
    -- Rolle und eine Operation begrenzt. drop davor, damit ein zweiter
    -- Lauf nicht an "policy already exists" scheitert.
    execute format('drop policy if exists studi_liest on velocity.%I', v_tab);
    execute format('create policy studi_liest on velocity.%I '
                   'for select to studi using (true)', v_tab);
    v_n := v_n + 1;
  end loop;
  raise notice '% Tabellen fuer studi freigegeben, je mit eigener SELECT-Regel', v_n;
end $$;

-- Damit eine spaeter hinzugekommene Tabelle nicht stumm fehlt. Die REGEL
-- dazu muss trotzdem von Hand kommen - Vorgaberechte kennen keine
-- Policies, und genau deshalb steht unten eine Gegenprobe, die das
-- meldet.
alter default privileges in schema velocity grant select on tables to studi;


-- ---- Und ausdruecklich NICHT ----------------------------------------
-- Der Entzug steht hier, obwohl studi diese Rechte nie bekommen hat:
-- Eine neue Rolle erbt, was PUBLIC hat, und PUBLIC traegt in einer
-- Supabase-Installation mehr, als man beim Lesen der Rechteliste
-- vermutet. Zweimal entzogen ist besser als einmal uebersehen.
revoke all on all functions in schema velocity from studi;
revoke all on schema public from studi;
do $$ begin
  execute format('grant connect on database %I to studi', current_database());
end $$;

-- ---- Gegenprobe ------------------------------------------------------
-- Eine Datei, die Rechte vergibt, sollte am Ende sagen, was dabei
-- herausgekommen ist - sonst glaubt man ihr.
--
-- Geprueft wird ueber die OID und nicht ueber den zusammengesetzten
-- Namen: Ein frueherer Anlauf rief has_table_privilege() mit
-- format('%I.%I', ...) auf und scheiterte an vault.decrypted_secrets.
-- PostgreSQL garantiert die Reihenfolge von WHERE-Filter und
-- Funktionsaufruf NICHT - die Funktion lief also auch ueber Zeilen
-- anderer Schemata und baute daraus einen Namen, den es nicht gibt.
do $$
declare
  v_tab     integer;
  v_lesbar  integer;
  v_schreib integer;
  v_regeln  integer;
  v_auth    integer;
  v_fk      integer;
begin
  select count(*),
         count(*) filter (where has_table_privilege('studi', c.oid, 'select')),
         count(*) filter (where has_table_privilege('studi', c.oid, 'insert')
                             or has_table_privilege('studi', c.oid, 'update')
                             or has_table_privilege('studi', c.oid, 'delete'))
    into v_tab, v_lesbar, v_schreib
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'velocity' and c.relkind = 'r';

  select count(*) into v_regeln
    from pg_policies where schemaname = 'velocity' and policyname = 'studi_liest';

  select count(*) filter (where has_table_privilege('studi', c.oid, 'select'))
    into v_auth
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'auth' and c.relkind = 'r';

  select count(*) into v_fk
    from pg_constraint co join pg_class t on t.oid = co.conrelid
    join pg_namespace n on n.oid = t.relnamespace
   where n.nspname = 'velocity' and co.contype = 'f';

  raise notice 'velocity: % Tabellen, davon % fuer studi lesbar, % Regeln studi_liest',
               v_tab, v_lesbar, v_regeln;
  raise notice 'studi mit Schreibrecht: % Tabellen (erwartet 0)', v_schreib;
  raise notice 'studi liest in auth: % Tabellen (erwartet 0)', v_auth;
  raise notice '% Fremdschluessel stehen dem Werkzeug fuer sein Diagramm zur Verfuegung', v_fk;

  if v_lesbar <> v_tab or v_regeln <> v_tab or v_schreib > 0 or v_auth > 0 then
    raise exception 'Rechte stehen nicht wie beabsichtigt';
  end if;
end $$;
