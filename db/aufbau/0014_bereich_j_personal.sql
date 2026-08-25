-- =====================================================================
-- 0014 Bereich J: Personal
--
-- Zweck:      Wer die Warenwirtschaft bedienen darf, und wofuer. Ohne
--             diesen Bereich gibt es keine Mitarbeitenden - und damit
--             niemanden, den der Zugriffsschutz von einem Kunden
--             unterscheiden koennte.
-- Objekte:    velocity.rolle, velocity.mitarbeiter,
--             velocity.mitarbeiter_rolle, jeweils mit RLS (enable und
--             force, noch ohne Policy - die kommen mit Aufgabe 9) und
--             vollstaendiger COMMENT-ON-Dokumentation
-- Ruecknahme: DROP TABLE velocity.mitarbeiter_rolle, velocity.mitarbeiter,
--             velocity.rolle;
-- =====================================================================

-- Fachliche Klassifikation mit eigener Beschreibung, deshalb Tabelle
-- statt ENUM: Rollen bekommen spaeter Rechte angehaengt, ein ENUM-Label
-- kann nichts tragen.
create table if not exists velocity.rolle (
  rolle_id     bigint generated always as identity primary key,
  code         text        not null,
  bezeichnung  text        not null,
  beschreibung text,
  erstellt_am  timestamptz not null default now(),
  geaendert_am timestamptz not null default now(),
  constraint rolle_code_uk unique (code)
);
-- RLS an, aber ohne Regel: Policies kommen erst mit Aufgabe 9. Bis dahin
-- weist die Tabelle jeden Zugriff ab statt versehentlich offen zu stehen -
-- force auch fuer den Tabelleneigentuemer, sonst greift enable allein nicht.
alter table velocity.rolle enable row level security;
alter table velocity.rolle force  row level security;
select velocity.fn_audit_anhaengen('rolle');

create table if not exists velocity.mitarbeiter (
  mitarbeiter_id bigint generated always as identity primary key,
  personalnummer text        not null,
  -- Nullable: der Personalsatz entsteht bei der Einstellung, die
  -- Anmeldung erst danach. Dieselbe Trennung wie bei kunde.auth_uid.
  auth_uid       uuid,
  vorname        text        not null,
  nachname       text        not null,
  email          text        not null,
  eingetreten_am date        not null default current_date,
  ausgetreten_am date,
  status         velocity.mitarbeiter_status not null default 'aktiv',
  erstellt_am    timestamptz not null default now(),
  geaendert_am   timestamptz not null default now(),
  constraint mitarbeiter_personalnummer_uk unique (personalnummer),
  constraint mitarbeiter_auth_uid_uk       unique (auth_uid),
  constraint mitarbeiter_email_uk          unique (email),
  constraint mitarbeiter_email_chk
    check (email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  constraint mitarbeiter_austritt_chk
    check (ausgetreten_am is null or ausgetreten_am >= eingetreten_am),
  -- GR16 prueft den Status. Waere 'ausgeschieden' ohne Datum erlaubt,
  -- liesse sich nicht mehr feststellen, ab wann der Zugriff endete.
  constraint mitarbeiter_ausgeschieden_chk
    check (status <> 'ausgeschieden' or ausgetreten_am is not null)
);
-- Wie rolle: RLS ohne Policy bis Aufgabe 9, force gegen den Eigentuemer.
alter table velocity.mitarbeiter enable row level security;
alter table velocity.mitarbeiter force  row level security;
select velocity.fn_audit_anhaengen('mitarbeiter');

-- m:n statt der 1:n-Variante aus dem alten ERD. Wer Werkstatt UND
-- Disposition macht, braeuchte sonst eine Sammelrolle - und bekaeme mit
-- ihr Rechte, die keine seiner beiden Aufgaben verlangt. Das
-- widerspricht Art. 5 Abs. 1 lit. c DSGVO (Datenminimierung).
create table if not exists velocity.mitarbeiter_rolle (
  mitarbeiter_id bigint      not null,
  rolle_id       bigint      not null,
  erstellt_am    timestamptz not null default now(),
  geaendert_am   timestamptz not null default now(),
  constraint mitarbeiter_rolle_pk primary key (mitarbeiter_id, rolle_id),
  -- cascade, nicht restrict: die Zuordnung hat ohne ihren Mitarbeiter
  -- keine eigene Bedeutung. Der Mitarbeitersatz selbst wird ohnehin
  -- nicht geloescht, sondern auf 'ausgeschieden' gesetzt.
  constraint mitarbeiter_rolle_mitarbeiter_fk foreign key (mitarbeiter_id)
    references velocity.mitarbeiter (mitarbeiter_id) on update cascade on delete cascade,
  constraint mitarbeiter_rolle_rolle_fk foreign key (rolle_id)
    references velocity.rolle (rolle_id) on update cascade on delete restrict
);
-- Wie rolle: RLS ohne Policy bis Aufgabe 9, force gegen den Eigentuemer.
alter table velocity.mitarbeiter_rolle enable row level security;
alter table velocity.mitarbeiter_rolle force  row level security;
select velocity.fn_audit_anhaengen('mitarbeiter_rolle');

-- Die vier Rollen sind aus den Aufgaben abgeleitet, nicht aus der
-- Hierarchie. Eine Rolle 'Abteilungsleiter' saehe im Organigramm
-- richtig aus und sagte ueber Rechte nichts.
insert into velocity.rolle (code, bezeichnung, beschreibung) values
  ('disposition',   'Disposition',   'Flotte, Stationen, Radstatus'),
  ('werkstatt',     'Werkstatt',     'Schadensmeldungen und Wartungsauftraege'),
  ('kundenservice', 'Kundenservice', 'Kundenstammdaten, Sperren, Auskunft nach Art. 15 DSGVO'),
  ('leitung',       'Leitung',       'zusaetzlich Auswertungen und Mitarbeiterverwaltung')
on conflict (code) do update
  set bezeichnung  = excluded.bezeichnung,
      beschreibung = excluded.beschreibung;

comment on table velocity.mitarbeiter_rolle is
  'Zuordnung m:n. Abweichung vom Entwurf aus Phase 1, begruendet mit Datenminimierung.';

-- ---------------------------------------------------------------------
-- Dokumentation: test_doku_vollstaendig verlangt einen Kommentar an
-- jeder Tabelle und jeder Fachspalte (ausser erstellt_am/geaendert_am).
-- ---------------------------------------------------------------------
comment on table velocity.rolle is
  'Fachliche Klassifikation von Aufgabenbereichen. Tabelle statt ENUM, weil ihr spaeter Rechte angehaengt werden - siehe Kommentar am create table.';
comment on column velocity.rolle.rolle_id is 'Surrogatschluessel, fachlich bedeutungslos und deshalb stabil.';
comment on column velocity.rolle.code is 'Fachlicher Schluessel, in Code und Policies referenzierbar - anders als bezeichnung, die sich aendern darf, ohne dass etwas bricht.';
comment on column velocity.rolle.bezeichnung is 'Anzeigename der Rolle in der Oberflaeche.';
comment on column velocity.rolle.beschreibung is 'Erlaeutert den Aufgabenzuschnitt der Rolle. Optional, weil nicht jede kuenftige Rolle Erklaerungsbedarf hat.';

comment on table velocity.mitarbeiter is
  'Person, die die Warenwirtschaft bedient. Anders als kunde keine Vertragsbeziehung, sondern eine oder mehrere Rollen ueber mitarbeiter_rolle.';
comment on column velocity.mitarbeiter.mitarbeiter_id is 'Surrogatschluessel, fachlich bedeutungslos und deshalb stabil.';
comment on column velocity.mitarbeiter.personalnummer is 'Fachlicher Schluessel der Personalverwaltung, unabhaengig vom Anmeldekonto.';
comment on column velocity.mitarbeiter.auth_uid is 'Verknuepfung zur Anmeldung. Leer, solange sich die Person nie angemeldet hat.';
comment on column velocity.mitarbeiter.vorname is 'Vorname laut Personalakte.';
comment on column velocity.mitarbeiter.nachname is 'Nachname laut Personalakte.';
comment on column velocity.mitarbeiter.email is 'Dienstliche Kontaktadresse, zugleich eindeutiges Merkmal fuer die Anmeldung.';
comment on column velocity.mitarbeiter.eingetreten_am is 'Datum des Diensteintritts. Bezugspunkt von mitarbeiter_austritt_chk, das ein Austrittsdatum davor abweist.';
comment on column velocity.mitarbeiter.ausgetreten_am is 'Datum des Ausscheidens. NULL, solange die Person aktiv oder beurlaubt ist; Pflicht sobald status = ausgeschieden (GR16, siehe mitarbeiter_ausgeschieden_chk).';
comment on column velocity.mitarbeiter.status is 'aktiv, beurlaubt oder ausgeschieden. Erst der Status entscheidet ueber den Zugriff, das Austrittsdatum allein wuerde nicht reichen (GR16).';

comment on column velocity.mitarbeiter_rolle.mitarbeiter_id is 'Haelfte des zusammengesetzten Schluessels: welcher Mitarbeiter die Rolle hat.';
comment on column velocity.mitarbeiter_rolle.rolle_id is 'Haelfte des zusammengesetzten Schluessels: welche Rolle zugeordnet ist.';
