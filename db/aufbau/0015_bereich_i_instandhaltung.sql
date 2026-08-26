-- =====================================================================
-- 0015 Bereich I: Instandhaltung
--
-- Zweck:      Der Weg eines Schadens vom Melden bis zur Behebung, und
--             die Lebenslaufakte eines Rades. Ohne diesen Bereich waere
--             "Status aendern" in der Warenwirtschaft ein Auswahlfeld
--             ohne Anlass und ohne Spur.
-- Objekte:    velocity.schadensmeldung, velocity.wartungsauftrag,
--             velocity.fahrrad_ereignis, velocity.fn_fahrrad_ereignis,
--             Trigger trg_fahrrad_ereignis auf velocity.fahrrad
-- Ruecknahme: DROP TRIGGER trg_fahrrad_ereignis ON velocity.fahrrad;
--             DROP FUNCTION velocity.fn_fahrrad_ereignis();
--             DROP TABLE velocity.wartungsauftrag, velocity.schadensmeldung,
--             velocity.fahrrad_ereignis;
--
-- NICHT gebaut: wartungsposition. Sie verbindet einen Auftrag mit
-- verbauten Artikeln; ohne Bereich G (Beschaffung) und H (Lager) gibt
-- es keine Artikel, auf die sie zeigen koennte.
-- =====================================================================

create table if not exists velocity.schadensmeldung (
  schadensmeldung_id   bigint generated always as identity primary key,
  fahrrad_id           bigint      not null,
  gemeldet_am          timestamptz not null default now(),
  -- Beide nullable, aber genau einer gesetzt: eine Meldung kommt
  -- entweder von einem Kunden oder von einem Mitarbeiter. Ohne Melder
  -- laesst sich spaeter nicht nachfragen; mit zweien weiss niemand,
  -- wen er fragen soll.
  melder_kunde_id      bigint,
  melder_mitarbeiter_id bigint,
  kategorie            text        not null,
  beschreibung         text        not null,
  schwere              velocity.schaden_schwere not null,
  status               velocity.schaden_status  not null default 'offen',
  erstellt_am          timestamptz not null default now(),
  geaendert_am         timestamptz not null default now(),
  constraint schadensmeldung_melder_chk
    check ((melder_kunde_id is not null)::integer
         + (melder_mitarbeiter_id is not null)::integer = 1),
  constraint schadensmeldung_fahrrad_fk foreign key (fahrrad_id)
    references velocity.fahrrad (fahrrad_id) on update cascade on delete restrict,
  constraint schadensmeldung_kunde_fk foreign key (melder_kunde_id)
    references velocity.kunde (kunde_id) on update cascade on delete restrict,
  constraint schadensmeldung_mitarbeiter_fk foreign key (melder_mitarbeiter_id)
    references velocity.mitarbeiter (mitarbeiter_id) on update cascade on delete restrict
);
-- RLS an, aber ohne Regel: Policies kommen erst mit Aufgabe 9. Bis dahin
-- weist die Tabelle jeden Zugriff ab statt versehentlich offen zu stehen -
-- force auch fuer den Tabelleneigentuemer, sonst greift enable allein nicht.
alter table velocity.schadensmeldung enable row level security;
alter table velocity.schadensmeldung force  row level security;
select velocity.fn_audit_anhaengen('schadensmeldung');

create index if not exists schadensmeldung_offen_idx
  on velocity.schadensmeldung (fahrrad_id) where status in ('offen', 'in_arbeit');

create table if not exists velocity.wartungsauftrag (
  wartungsauftrag_id bigint generated always as identity primary key,
  auftragsnummer     text        not null,
  fahrrad_id         bigint      not null,
  -- Nullable: eine Inspektion hat keinen Schaden als Anlass.
  schadensmeldung_id bigint,
  -- Nullable: ein Auftrag kann offen liegen, bevor ihn jemand annimmt.
  mitarbeiter_id     bigint,
  eroeffnet_am       timestamptz not null default now(),
  erledigt_am        timestamptz,
  status             velocity.auftrag_status not null default 'offen',
  arbeitszeit_minuten integer,
  bemerkung          text,
  erstellt_am        timestamptz not null default now(),
  geaendert_am       timestamptz not null default now(),
  constraint wartungsauftrag_nummer_uk unique (auftragsnummer),
  constraint wartungsauftrag_zeitfolge_chk
    check (erledigt_am is null or erledigt_am >= eroeffnet_am),
  constraint wartungsauftrag_erledigt_chk
    check (status <> 'erledigt' or erledigt_am is not null),
  constraint wartungsauftrag_arbeitszeit_chk
    check (arbeitszeit_minuten is null or arbeitszeit_minuten >= 0),
  constraint wartungsauftrag_fahrrad_fk foreign key (fahrrad_id)
    references velocity.fahrrad (fahrrad_id) on update cascade on delete restrict,
  constraint wartungsauftrag_schaden_fk foreign key (schadensmeldung_id)
    references velocity.schadensmeldung (schadensmeldung_id) on update cascade on delete restrict,
  constraint wartungsauftrag_mitarbeiter_fk foreign key (mitarbeiter_id)
    references velocity.mitarbeiter (mitarbeiter_id) on update cascade on delete restrict
);
-- Wie schadensmeldung: RLS ohne Policy bis Aufgabe 9, force gegen den
-- Eigentuemer.
alter table velocity.wartungsauftrag enable row level security;
alter table velocity.wartungsauftrag force  row level security;
select velocity.fn_audit_anhaengen('wartungsauftrag');

-- Die Lebenslaufakte. beleg_tabelle und beleg_id zeigen auf den
-- ausloesenden Vorgang, ohne fuer jede moegliche Quelle einen eigenen
-- Fremdschluessel zu brauchen. Der Preis dafuer ist, dass die Datenbank
-- diesen Verweis nicht prueft - deshalb steht er hier bewusst nur als
-- Spur, nie als tragende Beziehung.
create table if not exists velocity.fahrrad_ereignis (
  ereignis_id    bigint generated always as identity primary key,
  fahrrad_id     bigint      not null,
  zeitpunkt      timestamptz not null default now(),
  ereignisart    velocity.fahrrad_ereignisart not null,
  mitarbeiter_id bigint,
  bemerkung      text,
  beleg_tabelle  text,
  beleg_id       bigint,
  erstellt_am    timestamptz not null default now(),
  geaendert_am   timestamptz not null default now(),
  constraint fahrrad_ereignis_beleg_chk
    check ((beleg_tabelle is null) = (beleg_id is null)),
  constraint fahrrad_ereignis_fahrrad_fk foreign key (fahrrad_id)
    references velocity.fahrrad (fahrrad_id) on update cascade on delete cascade,
  constraint fahrrad_ereignis_mitarbeiter_fk foreign key (mitarbeiter_id)
    references velocity.mitarbeiter (mitarbeiter_id) on update cascade on delete restrict
);
-- Wie schadensmeldung: RLS ohne Policy bis Aufgabe 9, force gegen den
-- Eigentuemer.
alter table velocity.fahrrad_ereignis enable row level security;
alter table velocity.fahrrad_ereignis force  row level security;
select velocity.fn_audit_anhaengen('fahrrad_ereignis');

create index if not exists fahrrad_ereignis_rad_zeit_idx
  on velocity.fahrrad_ereignis (fahrrad_id, zeitpunkt desc);

-- GR21: jede Statusaenderung eines Rades erzeugt ein Ereignis. Der
-- Trigger sitzt an der Tabelle, nicht in der api_-Funktion - sonst
-- entstuende die Luecke genau dann, wenn jemand am Frontend vorbei
-- arbeitet.
create or replace function velocity.fn_fahrrad_ereignis()
returns trigger
language plpgsql
security definer
set search_path = velocity, pg_temp
as $$
declare
  v_mitarbeiter bigint;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;
  select m.mitarbeiter_id into v_mitarbeiter
    from velocity.mitarbeiter m where m.auth_uid = auth.uid();
  insert into velocity.fahrrad_ereignis
         (fahrrad_id, ereignisart, mitarbeiter_id, bemerkung, beleg_tabelle, beleg_id)
  values (new.fahrrad_id,
          case when new.status = 'ausgemustert'
               then 'ausgemustert'::velocity.fahrrad_ereignisart
               else 'status_geaendert'::velocity.fahrrad_ereignisart end,
          v_mitarbeiter,
          format('%s -> %s', old.status, new.status),
          'fahrrad', new.fahrrad_id);
  return new;
end;
$$;

drop trigger if exists trg_fahrrad_ereignis on velocity.fahrrad;
create trigger trg_fahrrad_ereignis
  after update of status on velocity.fahrrad
  for each row execute function velocity.fn_fahrrad_ereignis();

-- ---------------------------------------------------------------------
-- Dokumentation: test_doku_vollstaendig verlangt einen Kommentar an
-- jeder Tabelle und jeder Fachspalte (ausser erstellt_am/geaendert_am).
-- ---------------------------------------------------------------------
comment on table velocity.schadensmeldung is
  'Meldung eines Schadens an einem Rad, Ausgangspunkt der Instandhaltung. Genau ein Melder je Meldung, siehe schadensmeldung_melder_chk.';
comment on column velocity.schadensmeldung.schadensmeldung_id is 'Surrogatschlüssel, fachlich bedeutungslos und deshalb stabil.';
comment on column velocity.schadensmeldung.fahrrad_id is 'Das gemeldete Rad.';
comment on column velocity.schadensmeldung.gemeldet_am is 'Zeitpunkt der Meldung, unabhängig vom technischen erstellt_am.';
comment on column velocity.schadensmeldung.melder_kunde_id is 'Meldender Kunde. Gesetzt oder melder_mitarbeiter_id, nie beide (schadensmeldung_melder_chk) - sonst wüsste niemand, wen man zur Nachfrage anspricht.';
comment on column velocity.schadensmeldung.melder_mitarbeiter_id is 'Meldender Mitarbeiter, etwa nach einer Sichtprüfung in der Werkstatt. Gesetzt oder melder_kunde_id, nie beide.';
comment on column velocity.schadensmeldung.kategorie is 'Freitextliche Grobeinordnung des Schadens, etwa Bremse oder Licht. Keine feste Liste, weil sich Schadensbilder nicht sauber vorab abschliessen lassen.';
comment on column velocity.schadensmeldung.beschreibung is 'Freitext des Melders, was am Rad auffiel.';
comment on column velocity.schadensmeldung.schwere is 'Einordnung der Dringlichkeit; fahruntauglich sperrt das Rad faktisch für die Werkstattplanung, ohne dass diese Tabelle den Fahrradstatus selbst setzt.';
comment on column velocity.schadensmeldung.status is 'Bearbeitungsstand der Meldung, unabhängig vom Status des zugehörigen Wartungsauftrags.';

comment on table velocity.wartungsauftrag is
  'Arbeitsauftrag der Werkstatt: eine Reparatur nach Schadensmeldung oder eine geplante Inspektion ohne Anlass.';
comment on column velocity.wartungsauftrag.wartungsauftrag_id is 'Surrogatschlüssel, fachlich bedeutungslos und deshalb stabil.';
comment on column velocity.wartungsauftrag.auftragsnummer is 'Fachlicher, in der Werkstatt gesprochener Schlüssel - eindeutig über wartungsauftrag_nummer_uk, damit ein Zuruf wie "Auftrag WA-..." keine Verwechslung zulässt.';
comment on column velocity.wartungsauftrag.fahrrad_id is 'Das Rad, an dem gearbeitet wird.';
comment on column velocity.wartungsauftrag.schadensmeldung_id is 'Auslösende Meldung. NULL bei einer geplanten Inspektion ohne konkreten Schaden.';
comment on column velocity.wartungsauftrag.mitarbeiter_id is 'Zuständiger Werkstattmitarbeiter. NULL, solange der Auftrag noch niemandem zugeteilt ist.';
comment on column velocity.wartungsauftrag.eroeffnet_am is 'Zeitpunkt der Auftragseröffnung. Bezugspunkt von wartungsauftrag_zeitfolge_chk.';
comment on column velocity.wartungsauftrag.erledigt_am is 'Zeitpunkt des Abschlusses. Pflicht sobald status = erledigt (wartungsauftrag_erledigt_chk), sonst liesse sich die Durchlaufzeit nicht auswerten.';
comment on column velocity.wartungsauftrag.status is 'Bearbeitungsstand des Auftrags.';
comment on column velocity.wartungsauftrag.arbeitszeit_minuten is 'Aufgewendete Werkstattzeit in Minuten, für die Nachkalkulation. Optional, solange der Auftrag läuft.';
comment on column velocity.wartungsauftrag.bemerkung is 'Freitext der Werkstatt zum Auftrag, etwa verbaute Ersatzteile ohne eigenen Lagerbezug.';

comment on table velocity.fahrrad_ereignis is
  'Lebenslaufakte eines Rades. beleg_tabelle/beleg_id sind eine Spur, keine geprüfte Beziehung.';
comment on column velocity.fahrrad_ereignis.ereignis_id is 'Surrogatschlüssel, fachlich bedeutungslos und deshalb stabil.';
comment on column velocity.fahrrad_ereignis.fahrrad_id is 'Das betroffene Rad. on delete cascade, weil ein Ereignis ohne sein Rad keine eigene Bedeutung hat.';
comment on column velocity.fahrrad_ereignis.zeitpunkt is 'Zeitpunkt des Ereignisses, für die chronologische Lebenslaufakte.';
comment on column velocity.fahrrad_ereignis.ereignisart is 'Art des Ereignisses (GR21), etwa Statuswechsel oder Ausmusterung.';
comment on column velocity.fahrrad_ereignis.mitarbeiter_id is 'Mitarbeiter, unter dessen Anmeldung das Ereignis entstand. NULL, wenn der Trigger ausläuft, ohne eine passende auth.uid() zu finden - etwa bei einem Lauf als postgres.';
comment on column velocity.fahrrad_ereignis.bemerkung is 'Freitext zum Ereignis, beim Statuswechsel automatisch mit alt -> neu befüllt.';
comment on column velocity.fahrrad_ereignis.beleg_tabelle is 'Name der Tabelle des auslösenden Vorgangs, etwa fahrrad. Bewusst ungeprüft, siehe Kommentar an der Tabelle.';
comment on column velocity.fahrrad_ereignis.beleg_id is 'Zeigt auf den auslösenden Vorgang. Bewusst ungeprüft, siehe Kommentar an der Tabelle.';
