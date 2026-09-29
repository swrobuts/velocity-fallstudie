-- =====================================================================
-- 0026 Meldungseingang: Vorschläge von Jev für die Werkstatt
--
-- Zweck:      Kundinnen und Kunden melden Schäden in freier Sprache, per
--             App, Hotline oder Mail. Das Lehrprojekt "VeloCity × Jev"
--             (Ordner jev/ neben diesem Repository) lässt jede Meldung von
--             Jev beurteilen, dem System-One-Modell von TypeSafe: Ist es ein
--             Schaden, welches Bauteil, wie schwer, ist Weiterfahren
--             gefährlich, ist jemand verletzt? Aus den Wahrscheinlichkeiten
--             entscheidet der Code über Schwellen: sperren, prüfen,
--             Wartungsauftrag oder kein Schaden. Das läuft außerhalb der
--             Datenbank, in einem Notebook.
--
--             Diese Datei zeigt das Ergebnis in der Warenwirtschaft - als
--             VORSCHLAG, nicht als Buchung. Eine Schadensmeldung entsteht
--             erst, wenn jemand aus der Werkstatt den Vorschlag geprüft und
--             übernommen hat, und zwar über dieselbe Funktion wie jede
--             andere Meldung, api_schaden_melden. Wer einen Vorschlag
--             verwirft, tut das ebenfalls ausdrücklich. Beides wird
--             festgehalten; die Entscheidungen sind später die Soll-Werte,
--             an denen sich die Vorschläge messen lassen.
--
--             Dasselbe Muster wie die Wartungsprognose (0021): Eine Analyse
--             liefert ein eingefrorenes Ergebnis, die Warenwirtschaft zeigt
--             es als eigenen Reiter der Instandhaltung. Anders als dort
--             rechnet die Datenbank nichts selbst. Die Urteile kommen fertig
--             aus dem Notebook, geschrieben von der Rolle jev_schreiber, die
--             nichts anderes darf als in jev_labor einfügen.
--
-- Objekte:    Tabelle jev_labor.meldung, jev_labor.lauf, jev_labor.urteil,
--             velocity.jev_vorschlag_entscheidung,
--             Sicht velocity.v_wawi_meldungseingang,
--             Funktion velocity.api_jev_vorschlag_uebernehmen(bigint,text,text,text,text),
--             velocity.api_jev_vorschlag_verwerfen(bigint,text,text),
--             Schema jev_labor, Rolle jev_schreiber (hier ohne Anmeldung
--             angelegt, siehe unten)
-- Ruecknahme: DROP FUNCTION velocity.api_jev_vorschlag_verwerfen(bigint,text,text);
--             DROP FUNCTION velocity.api_jev_vorschlag_uebernehmen(bigint,text,text,text,text);
--             DROP VIEW velocity.v_wawi_meldungseingang;
--             DROP TABLE velocity.jev_vorschlag_entscheidung;
--             DROP TABLE jev_labor.urteil, jev_labor.lauf, jev_labor.meldung;
--             DROP SCHEMA jev_labor;   -- die Tabellen enthalten alle Läufe
--             DROP ROLE jev_schreiber;
-- =====================================================================

-- ---- Das Labor -------------------------------------------------------
-- Die drei Tabellen stehen gleichlautend in jev/sql/01_schema.sql, damit
-- das Labor auch ohne Warenwirtschaft auf einer eigenen Datenbank läuft.
-- Beide Dateien legen sie mit "if not exists" an und ergänzen neue
-- Spalten mit "add column if not exists"; wer eine Spalte ändert, ändert
-- sie an beiden Stellen.
create schema if not exists jev_labor;

comment on schema jev_labor is
  'Labor des Projekts VeloCity × Jev: Meldungen mit Soll-Labels, Läufe und Urteile. '
  'Wird aus dem Notebook über die Rolle jev_schreiber beschrieben; die Warenwirtschaft '
  'liest nur über velocity.v_wawi_meldungseingang.';

create table if not exists jev_labor.meldung (
    meldung_id               text primary key,
    fahrrad_id               integer,
    rahmennummer             text,
    typ_code                 text not null check (typ_code in ('CITY', 'EBIKE', 'CARGO')),
    kanal                    text,
    text                     text not null,
    soll_kategorie           text not null,
    soll_schwere             text check (soll_schwere in ('gering', 'mittel', 'fahruntauglich')),
    soll_sicherheitsrelevant boolean not null,
    soll_personenschaden     boolean not null,
    soll_ist_schaden         boolean not null,
    merkmal                  text
);

create table if not exists jev_labor.lauf (
    lauf_id        bigint generated always as identity primary key,
    zeitpunkt      timestamptz not null,
    modell         text not null,
    regel_version  text not null,
    schwellen      jsonb not null,
    input_tokens   integer,
    output_tokens  integer,
    anmerkung      text
);

-- Nachgetragen mit der Anbindung an die Warenwirtschaft. lauf_schluessel
-- ist der Name des Laufordners im Notebook (etwa
-- 20260929-083904_meldungen_stand1); über ihn lässt sich derselbe Lauf
-- zweimal hochladen, ohne dass er doppelt entsteht.
alter table jev_labor.lauf add column if not exists lauf_schluessel      text;
alter table jev_labor.lauf add column if not exists datensatz            text;
alter table jev_labor.lauf add column if not exists fragen_stand         integer;
alter table jev_labor.lauf add column if not exists fragen_fingerabdruck text;
alter table jev_labor.lauf add column if not exists freigegeben_am       timestamptz;
create unique index if not exists lauf_schluessel_uq on jev_labor.lauf (lauf_schluessel);

create table if not exists jev_labor.urteil (
    lauf_id              bigint not null references jev_labor.lauf (lauf_id) on delete cascade,
    meldung_id           text   not null references jev_labor.meldung (meldung_id),
    modell               text   not null,
    ist_schadensmeldung  numeric(6, 5) not null check (ist_schadensmeldung between 0 and 1),
    kategorie            text   not null,
    kategorie_konfidenz  numeric(6, 5) not null,
    kategorie_wkt        jsonb  not null,
    schwere_stufe        text   not null check (schwere_stufe in ('gering', 'mittel', 'fahruntauglich')),
    schwere_score        numeric(6, 5) not null,
    schwere_konfidenz    numeric(6, 5) not null,
    schwere_wkt          jsonb  not null,
    sicherheitsrelevant  numeric(6, 5) not null check (sicherheitsrelevant between 0 and 1),
    personenschaden      numeric(6, 5) not null check (personenschaden between 0 and 1),
    entscheidung         text   not null check (entscheidung in ('kein_schaden_weiterleiten', 'sperren', 'pruefen', 'auftrag')),
    eskalation           boolean not null,
    begruendung          text,
    wawi_kategorie       text,
    wawi_schwere         text,
    input_tokens         integer,
    output_tokens        integer,
    request_id           text,
    primary key (lauf_id, meldung_id)
);

create index if not exists urteil_meldung_idx on jev_labor.urteil (meldung_id);

comment on table jev_labor.meldung is
  'Synthetische Schadenmeldungen mit Soll-Labels; soll_schwere ist leer, wenn kein Schaden vorliegt. '
  'fahrrad_id zeigt auf echte Räder der Flotte.';
comment on table jev_labor.lauf is
  'Ein Lauf: ein Datensatz, beurteilt mit einem Modell und einem Stand der Fragen. '
  'Nur ein freigegebener Lauf erscheint in der Warenwirtschaft.';
comment on table jev_labor.urteil is
  'Die Antworten von Jev zu einer Meldung und die Entscheidung, die der Code daraus trifft.';
comment on column jev_labor.lauf.lauf_schluessel is
  'Name des Laufordners im Notebook; eindeutig, damit ein zweiter Upload nichts verdoppelt.';
comment on column jev_labor.lauf.datensatz is 'meldungen (48 Meldungen) oder holdout (18 Meldungen).';
comment on column jev_labor.lauf.fragen_stand is 'Stand der Fragen aus velocity_jev/fragen.py; 0 ist die Übergabe.';
comment on column jev_labor.lauf.fragen_fingerabdruck is 'Kurzer Hash über den Wortlaut aller Fragen.';
comment on column jev_labor.lauf.freigegeben_am is
  'Gesetzt, wenn der Lauf in der Warenwirtschaft erscheinen soll. Es erscheint der zuletzt freigegebene.';

-- ---- Rechte im Labor -------------------------------------------------
-- Browser und PostgREST sehen das Labor nicht: kein Recht für anon und
-- authenticated, und das Schema gehört nicht zu den Schemata, die
-- PostgREST ausliefert. Die Warenwirtschaft liest über die Sicht weiter
-- unten, die dem Eigentümer gehört.
revoke all on schema jev_labor from public;
revoke all on all tables in schema jev_labor from public, anon, authenticated;

-- DIE SCHREIBROLLE WIRD OHNE ANMELDUNG ANGELEGT. Ein Passwort gehört
-- nicht in eine Datei, die im Repository liegt. Wer sie benutzen will,
-- setzt es einmalig von Hand:
--
--     alter role jev_schreiber login password '...';
--
-- und trägt die Verbindung als DATABASE_URL in jev/.env beziehungsweise
-- als Umgebungsvariable in Deepnote ein. Ohne diesen Schritt kann sich
-- niemand als jev_schreiber anmelden.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'jev_schreiber') then
    create role jev_schreiber nologin noinherit connection limit 3;
  end if;
end;
$$;

comment on role jev_schreiber is
  'Schreibt Läufe des Projekts VeloCity × Jev in jev_labor. Keine Rechte auf velocity.';

grant usage on schema jev_labor to jev_schreiber;
-- Meldungen dürfen aktualisiert werden: Ein Upload bringt den Stand der
-- CSV-Datei mit, und eine korrigierte Meldung soll die alte ersetzen.
grant select, insert, update on jev_labor.meldung to jev_schreiber;
-- Läufe und Urteile werden eingefügt, nicht geändert. Einzige Ausnahme
-- ist die Freigabe und die Anmerkung eines Laufs.
grant select, insert on jev_labor.lauf, jev_labor.urteil to jev_schreiber;
grant update (freigegeben_am, anmerkung) on jev_labor.lauf to jev_schreiber;

-- Lesend für die Studierenden, dieselbe Rolle wie in
-- db/betrieb/studizugang_lesend.sql. Nur, wo es die Rolle gibt.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'studi') then
    execute 'grant usage on schema jev_labor to studi';
    execute 'grant select on all tables in schema jev_labor to studi';
  end if;
end;
$$;

-- ---- Die Entscheidung der Werkstatt ----------------------------------
-- Eine Zeile je Meldung, nicht je Lauf: Über eine eingegangene Meldung
-- wird einmal entschieden. Erscheint später ein neuer Lauf mit
-- denselben Meldungen, bleibt eine übernommene Meldung übernommen.
create table if not exists velocity.jev_vorschlag_entscheidung (
  jev_vorschlag_entscheidung_id bigint generated always as identity primary key,
  meldung_id          text        not null,
  lauf_id             bigint      not null,
  entscheidung        text        not null,
  schadensmeldung_id  bigint,
  kategorie           text,
  schwere             velocity.schaden_schwere,
  bemerkung           text,
  mitarbeiter_id      bigint      not null,
  erstellt_am         timestamptz not null default now(),
  geaendert_am        timestamptz not null default now(),
  constraint jev_vorschlag_entscheidung_meldung_uq unique (meldung_id),
  constraint jev_vorschlag_entscheidung_art_chk
    check (entscheidung in ('uebernommen', 'verworfen')),
  -- Übernommen heißt: es gibt eine Schadensmeldung dazu. Verworfen heißt:
  -- es gibt keine. Beides zugleich oder keins von beiden ist ein Fehler.
  constraint jev_vorschlag_entscheidung_schaden_chk
    check ((entscheidung = 'uebernommen') = (schadensmeldung_id is not null)),
  constraint jev_vorschlag_entscheidung_urteil_fk foreign key (lauf_id, meldung_id)
    references jev_labor.urteil (lauf_id, meldung_id) on update cascade on delete restrict,
  constraint jev_vorschlag_entscheidung_schaden_fk foreign key (schadensmeldung_id)
    references velocity.schadensmeldung (schadensmeldung_id) on update cascade on delete restrict,
  constraint jev_vorschlag_entscheidung_mitarbeiter_fk foreign key (mitarbeiter_id)
    references velocity.mitarbeiter (mitarbeiter_id) on update cascade on delete restrict
);

select velocity.fn_audit_anhaengen('jev_vorschlag_entscheidung');

comment on table velocity.jev_vorschlag_entscheidung is
  'Was die Werkstatt mit einem Vorschlag von Jev gemacht hat: übernommen (dann mit '
  'Schadensmeldung) oder verworfen. Eine Zeile je Meldung. Die Zeilen sind die '
  'Soll-Werte für die spätere Nachprüfung der Vorschläge.';
comment on column velocity.jev_vorschlag_entscheidung.jev_vorschlag_entscheidung_id is
  'Surrogatschlüssel, fachlich bedeutungslos und deshalb stabil.';
comment on column velocity.jev_vorschlag_entscheidung.meldung_id is
  'Die eingegangene Meldung, etwa M001. Über jede Meldung wird genau einmal entschieden.';
comment on column velocity.jev_vorschlag_entscheidung.lauf_id is
  'Der Lauf, dessen Vorschlag die Werkstatt gesehen hat.';
comment on column velocity.jev_vorschlag_entscheidung.entscheidung is
  'uebernommen oder verworfen.';
comment on column velocity.jev_vorschlag_entscheidung.schadensmeldung_id is
  'Die Schadensmeldung, die bei der Übernahme entstanden ist. NULL bei einem verworfenen Vorschlag.';
comment on column velocity.jev_vorschlag_entscheidung.kategorie is
  'Kategorie, mit der übernommen wurde. Kann vom Vorschlag abweichen; NULL bei verworfen.';
comment on column velocity.jev_vorschlag_entscheidung.schwere is
  'Schwere, mit der übernommen wurde. Kann vom Vorschlag abweichen; NULL bei verworfen.';
comment on column velocity.jev_vorschlag_entscheidung.bemerkung is
  'Freitext der Werkstatt, etwa warum ein Vorschlag verworfen wurde.';
comment on column velocity.jev_vorschlag_entscheidung.mitarbeiter_id is
  'Wer entschieden hat.';

alter table velocity.jev_vorschlag_entscheidung enable row level security;
alter table velocity.jev_vorschlag_entscheidung force row level security;

drop policy if exists jev_vorschlag_entscheidung_mitarbeiter_lesen
  on velocity.jev_vorschlag_entscheidung;
create policy jev_vorschlag_entscheidung_mitarbeiter_lesen
  on velocity.jev_vorschlag_entscheidung
  for select using (velocity.ist_mitarbeiter());

drop policy if exists studi_liest on velocity.jev_vorschlag_entscheidung;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'studi') then
    execute 'create policy studi_liest on velocity.jev_vorschlag_entscheidung '
            'for select to studi using (true)';
  end if;
end;
$$;

-- ---- Die Sicht der Werkstatt -----------------------------------------
-- Es erscheint GENAU EIN Lauf: der zuletzt freigegebene. Probeläufe aus
-- dem Notebook bleiben im Labor, bis jemand sie freigibt. Die
-- Soll-Labels bleiben ebenfalls dort - in einem echten Betrieb gibt es
-- sie nicht, und die Werkstatt soll nicht gegen sie entscheiden.
create or replace view velocity.v_wawi_meldungseingang as
with freigegeben as (
  select l.lauf_id, l.modell, l.fragen_stand, l.freigegeben_am
    from jev_labor.lauf l
   where l.freigegeben_am is not null
   order by l.freigegeben_am desc, l.lauf_id desc
   limit 1
)
select m.meldung_id,
       fg.lauf_id,
       m.kanal,
       m.text                              as meldungstext,
       m.fahrrad_id::bigint                as fahrrad_id,
       coalesce(f.rahmennummer, m.rahmennummer) as rahmennummer,
       coalesce(t.typ_code, m.typ_code)    as typ_code,
       f.status                            as radstatus,
       s.name                              as standort,
       u.entscheidung                      as vorschlag,
       u.begruendung,
       u.eskalation,
       u.kategorie,
       u.kategorie_konfidenz,
       u.schwere_stufe                     as schwere,
       u.schwere_konfidenz,
       u.schwere_wkt,
       u.ist_schadensmeldung,
       u.sicherheitsrelevant,
       u.personenschaden,
       fg.modell,
       fg.fragen_stand,
       fg.freigegeben_am,
       coalesce(e.entscheidung, 'offen')  as bearbeitung,
       e.erstellt_am                       as entschieden_am,
       e.schadensmeldung_id,
       e.bemerkung
  from freigegeben fg
  join jev_labor.urteil  u on u.lauf_id = fg.lauf_id
  join jev_labor.meldung m on m.meldung_id = u.meldung_id
  left join velocity.fahrrad          f  on f.fahrrad_id = m.fahrrad_id
  left join velocity.fahrradmodell    mo on mo.modell_id = f.modell_id
  left join velocity.fahrradtyp       t  on t.typ_id = mo.typ_id
  left join velocity.fahrrad_position fp on fp.fahrrad_id = f.fahrrad_id
  left join velocity.station          s  on s.station_id = fp.station_id
  left join velocity.jev_vorschlag_entscheidung e on e.meldung_id = m.meldung_id
 where velocity.hat_rolle('werkstatt')
    or velocity.hat_rolle('leitung')
    or velocity.hat_rolle('demo');

comment on view velocity.v_wawi_meldungseingang is
  'Arbeitssicht der Werkstatt: jede Meldung des zuletzt freigegebenen Jev-Laufs mit dem '
  'Vorschlag, den Wahrscheinlichkeiten und dem Stand der Bearbeitung. Dieselben Rollen wie '
  'v_wawi_schaden. Filtert selbst über velocity.hat_rolle. Soll-Labels stehen nicht darin.';
comment on column velocity.v_wawi_meldungseingang.meldung_id is 'Kennung der eingegangenen Meldung, etwa M001.';
comment on column velocity.v_wawi_meldungseingang.lauf_id is 'Der freigegebene Lauf, aus dem der Vorschlag stammt.';
comment on column velocity.v_wawi_meldungseingang.kanal is 'Wie die Meldung einging: App, Hotline oder Mail.';
comment on column velocity.v_wawi_meldungseingang.meldungstext is 'Der Text der Kundin oder des Kunden, unverändert.';
comment on column velocity.v_wawi_meldungseingang.fahrrad_id is 'Das gemeldete Rad, für den Sprung in die Flotte.';
comment on column velocity.v_wawi_meldungseingang.rahmennummer is 'Die Nummer, unter der die Werkstatt das Rad sucht.';
comment on column velocity.v_wawi_meldungseingang.typ_code is 'Kurzschlüssel des Radtyps (CITY, EBIKE, CARGO).';
comment on column velocity.v_wawi_meldungseingang.radstatus is 'Heutiger Status des Rades.';
comment on column velocity.v_wawi_meldungseingang.standort is 'Station, an der das Rad zuletzt stand. NULL, solange es unterwegs ist.';
comment on column velocity.v_wawi_meldungseingang.vorschlag is 'Entscheidung des Codes: sperren, pruefen, auftrag oder kein_schaden_weiterleiten.';
comment on column velocity.v_wawi_meldungseingang.begruendung is 'Welche Schwelle den Vorschlag ausgelöst hat, in Klartext.';
comment on column velocity.v_wawi_meldungseingang.eskalation is 'Wahr, wenn Jev einen Personenschaden für wahrscheinlich hält; dann zusätzlich an den Kundendienst.';
comment on column velocity.v_wawi_meldungseingang.kategorie is 'Bauteil laut Jev, eine von 15 Kategorien oder keine_zuordnung.';
comment on column velocity.v_wawi_meldungseingang.kategorie_konfidenz is 'Konfidenz der Kategorie zwischen 0 und 1.';
comment on column velocity.v_wawi_meldungseingang.schwere is 'Schwere laut Jev: gerundeter Erwartungswert über gering, mittel, fahruntauglich.';
comment on column velocity.v_wawi_meldungseingang.schwere_konfidenz is 'Konfidenz der Schwere zwischen 0 und 1.';
comment on column velocity.v_wawi_meldungseingang.schwere_wkt is 'Wahrscheinlichkeit je Stufe als JSON.';
comment on column velocity.v_wawi_meldungseingang.ist_schadensmeldung is 'Wahrscheinlichkeit, dass überhaupt ein Schaden am Rad beschrieben wird.';
comment on column velocity.v_wawi_meldungseingang.sicherheitsrelevant is 'Wahrscheinlichkeit, dass Weiterfahren unmittelbar gefährlich ist.';
comment on column velocity.v_wawi_meldungseingang.personenschaden is 'Wahrscheinlichkeit, dass jemand gestürzt ist oder verletzt wurde.';
comment on column velocity.v_wawi_meldungseingang.modell is 'Das Modell, das beurteilt hat, etwa jev-1.13.0.';
comment on column velocity.v_wawi_meldungseingang.fragen_stand is 'Stand der Fragen, mit dem beurteilt wurde.';
comment on column velocity.v_wawi_meldungseingang.freigegeben_am is 'Wann der Lauf für die Warenwirtschaft freigegeben wurde.';
comment on column velocity.v_wawi_meldungseingang.bearbeitung is 'offen, uebernommen oder verworfen.';
comment on column velocity.v_wawi_meldungseingang.entschieden_am is 'Wann die Werkstatt entschieden hat. NULL, solange offen.';
comment on column velocity.v_wawi_meldungseingang.schadensmeldung_id is 'Die Schadensmeldung, die bei der Übernahme entstanden ist.';
comment on column velocity.v_wawi_meldungseingang.bemerkung is 'Bemerkung der Werkstatt zur Entscheidung.';

-- ---- Übernehmen und verwerfen ----------------------------------------
-- Übernehmen ist EIN Aufruf und damit eine Transaktion: Schadensmeldung
-- anlegen und Entscheidung festhalten gelingen gemeinsam oder gar nicht.
-- Zwei Aufrufe aus dem Browser hintereinander ließen eine Meldung ohne
-- Entscheidung zurück, sobald der zweite scheitert - und beim nächsten
-- Klick entstünde eine zweite Schadensmeldung zum selben Vorgang.
create or replace function velocity.api_jev_vorschlag_uebernehmen(
  p_lauf_id bigint, p_meldung_id text, p_kategorie text, p_beschreibung text, p_schwere text
)
returns bigint
language plpgsql
security definer
set search_path = velocity, pg_temp
as $$
declare v_m bigint; v_rad bigint; v_s bigint;
begin
  v_m := velocity.fn_rolle_verlangen('werkstatt');

  select m.fahrrad_id into v_rad
    from jev_labor.urteil u
    join jev_labor.meldung m on m.meldung_id = u.meldung_id
    join jev_labor.lauf    l on l.lauf_id = u.lauf_id
   where u.lauf_id = p_lauf_id and u.meldung_id = p_meldung_id
     and l.freigegeben_am is not null;
  if not found then
    raise exception 'Zu Meldung % gibt es im freigegebenen Lauf % keinen Vorschlag',
      p_meldung_id, p_lauf_id using errcode = 'P0001';
  end if;
  if v_rad is null then
    raise exception 'Meldung % ist keinem Rad zugeordnet', p_meldung_id using errcode = 'P0001';
  end if;
  -- keine_zuordnung ist ein Ergebnis der Beurteilung, keine Kategorie der
  -- Warenwirtschaft. Wer übernimmt, benennt das Bauteil selbst.
  if nullif(btrim(p_kategorie), '') is null or p_kategorie = 'keine_zuordnung' then
    raise exception 'Bitte eine Kategorie angeben' using errcode = 'P0001';
  end if;
  if nullif(btrim(p_beschreibung), '') is null then
    raise exception 'Bitte eine Beschreibung angeben' using errcode = 'P0001';
  end if;
  if exists (select 1 from velocity.jev_vorschlag_entscheidung where meldung_id = p_meldung_id) then
    raise exception 'Über Meldung % ist bereits entschieden', p_meldung_id using errcode = '23505';
  end if;

  v_s := velocity.api_schaden_melden(v_rad, btrim(p_kategorie), btrim(p_beschreibung), p_schwere);

  insert into velocity.jev_vorschlag_entscheidung
         (meldung_id, lauf_id, entscheidung, schadensmeldung_id, kategorie, schwere, mitarbeiter_id)
  values (p_meldung_id, p_lauf_id, 'uebernommen', v_s, btrim(p_kategorie),
          p_schwere::velocity.schaden_schwere, v_m);
  return v_s;
end;
$$;

comment on function velocity.api_jev_vorschlag_uebernehmen(bigint, text, text, text, text) is
  'Übernimmt einen Vorschlag aus dem Meldungseingang: legt über api_schaden_melden eine '
  'Schadensmeldung an und hält die Entscheidung fest, beides in einer Transaktion. Nur Werkstatt. '
  'Kategorie und Schwere dürfen vom Vorschlag abweichen.';

create or replace function velocity.api_jev_vorschlag_verwerfen(
  p_lauf_id bigint, p_meldung_id text, p_bemerkung text
)
returns void
language plpgsql
security definer
set search_path = velocity, pg_temp
as $$
declare v_m bigint;
begin
  v_m := velocity.fn_rolle_verlangen('werkstatt');

  if not exists (
    select 1 from jev_labor.urteil u
      join jev_labor.lauf l on l.lauf_id = u.lauf_id
     where u.lauf_id = p_lauf_id and u.meldung_id = p_meldung_id
       and l.freigegeben_am is not null
  ) then
    raise exception 'Zu Meldung % gibt es im freigegebenen Lauf % keinen Vorschlag',
      p_meldung_id, p_lauf_id using errcode = 'P0001';
  end if;
  if exists (select 1 from velocity.jev_vorschlag_entscheidung where meldung_id = p_meldung_id) then
    raise exception 'Über Meldung % ist bereits entschieden', p_meldung_id using errcode = '23505';
  end if;

  insert into velocity.jev_vorschlag_entscheidung
         (meldung_id, lauf_id, entscheidung, bemerkung, mitarbeiter_id)
  values (p_meldung_id, p_lauf_id, 'verworfen', nullif(btrim(p_bemerkung), ''), v_m);
end;
$$;

comment on function velocity.api_jev_vorschlag_verwerfen(bigint, text, text) is
  'Verwirft einen Vorschlag aus dem Meldungseingang, etwa weil kein Schaden vorliegt. '
  'Legt keine Schadensmeldung an. Nur Werkstatt.';

-- ---- Rechte ----------------------------------------------------------
-- Dieselbe Reihenfolge wie in 0021: erst alles entziehen, was PostgreSQL
-- von selbst vergibt, dann gezielt erlauben. Die Basistabelle bleibt zu;
-- gelesen wird über die Sicht, geschrieben über die beiden api_-Funktionen.
revoke all on velocity.jev_vorschlag_entscheidung from anon, authenticated;

revoke all on function velocity.api_jev_vorschlag_uebernehmen(bigint, text, text, text, text)
  from public, anon, authenticated;
revoke all on function velocity.api_jev_vorschlag_verwerfen(bigint, text, text)
  from public, anon, authenticated;

grant select on velocity.v_wawi_meldungseingang to authenticated;

grant execute on function
  velocity.api_jev_vorschlag_uebernehmen(bigint, text, text, text, text),
  velocity.api_jev_vorschlag_verwerfen(bigint, text, text)
to authenticated;

-- Wie nach 0021: PostgREST kennt die neue Sicht erst nach
--     bash tools/schema_neu_lesen.sh
