-- =====================================================================
-- 0005 Bereich D: Nutzung
--
-- Zweck:      Die Ausleihe als zentraler Geschaeftsvorfall und ihre
--             nachvollziehbare Bepreisung in Einzelpositionen.
-- Objekte:    velocity.entgeltart, velocity.ausleihe,
--             velocity.entgeltposition
-- Ruecknahme: DROP TABLE velocity.entgeltposition, velocity.ausleihe,
--             velocity.entgeltart;
-- =====================================================================

-- Fachliche Klassifikation, deshalb Referenztabelle statt ENUM: sie
-- traegt mit vorzeichen ein eigenes Attribut und waechst fachlich.
create table if not exists velocity.entgeltart (
  entgeltart_id bigint generated always as identity primary key,
  code          text        not null,
  bezeichnung   text        not null,
  vorzeichen    smallint    not null,
  erstellt_am   timestamptz not null default now(),
  geaendert_am  timestamptz not null default now(),
  constraint entgeltart_code_uk        unique (code),
  constraint entgeltart_vorzeichen_chk check (vorzeichen in (-1, 1))
);
select velocity.fn_audit_anhaengen('entgeltart');

create table if not exists velocity.ausleihe (
  ausleihe_id       bigint generated always as identity primary key,
  kunde_id          bigint      not null,
  fahrrad_id        bigint      not null,
  mitgliedschaft_id bigint,
  start_station_id  bigint,
  start_latitude    numeric(9,6),
  start_longitude   numeric(9,6),
  startzeit         timestamptz not null default now(),
  end_station_id    bigint,
  end_latitude      numeric(9,6),
  end_longitude     numeric(9,6),
  endzeit           timestamptz,
  status            velocity.ausleihe_status not null default 'aktiv',
  -- Abgeleiteter Wert, von der Datenbank gepflegt statt von der Anwendung.
  -- Aufgerundet auf angefangene Minuten (Geschaeftsregel GR6).
  dauer_minuten     integer generated always as
                      (ceil(extract(epoch from (endzeit - startzeit)) / 60.0)::integer) stored,
  erstellt_am       timestamptz not null default now(),
  geaendert_am      timestamptz not null default now(),
  constraint ausleihe_zeitfolge_chk     check (endzeit is null or endzeit >= startzeit),
  constraint ausleihe_aktiv_chk         check (status <> 'aktiv'         or endzeit is null),
  constraint ausleihe_abgeschlossen_chk check (status <> 'abgeschlossen' or endzeit is not null),
  constraint ausleihe_kunde_fk foreign key (kunde_id)
    references velocity.kunde (kunde_id) on update cascade on delete restrict,
  constraint ausleihe_fahrrad_fk foreign key (fahrrad_id)
    references velocity.fahrrad (fahrrad_id) on update cascade on delete restrict,
  constraint ausleihe_mitgliedschaft_fk foreign key (mitgliedschaft_id)
    references velocity.mitgliedschaft (mitgliedschaft_id) on update cascade on delete set null,
  constraint ausleihe_startstation_fk foreign key (start_station_id)
    references velocity.station (station_id) on update cascade on delete set null,
  constraint ausleihe_endstation_fk foreign key (end_station_id)
    references velocity.station (station_id) on update cascade on delete set null
);
select velocity.fn_audit_anhaengen('ausleihe');

-- Geschaeftsregel GR1: ein Rad ist hoechstens einmal aktiv ausgeliehen.
create unique index if not exists uq_ausleihe_aktiv_je_fahrrad
  on velocity.ausleihe (fahrrad_id) where status = 'aktiv';

create index if not exists idx_ausleihe_kunde_status on velocity.ausleihe (kunde_id, status);
create index if not exists idx_ausleihe_startzeit    on velocity.ausleihe (startzeit);

-- ---------------------------------------------------------------------
-- entgeltposition
--
-- Jede Zeile der Abrechnung bleibt sichtbar und traegt mit
-- nutzungspreis_id den Beleg, welcher Preissatz angewandt wurde.
-- Damit ist ausgeschlossen, dass Freiminuten oder Rabatte still
-- verrechnet werden.
-- ---------------------------------------------------------------------
create table if not exists velocity.entgeltposition (
  position_id      bigint generated always as identity primary key,
  ausleihe_id      bigint      not null,
  entgeltart_id    bigint      not null,
  nutzungspreis_id bigint,
  menge            numeric(10,2) not null default 1,
  einzelbetrag     numeric(10,2) not null default 0,
  betrag           numeric(10,2) not null,
  sortierung       integer     not null default 0,
  erstellt_am      timestamptz not null default now(),
  geaendert_am     timestamptz not null default now(),
  constraint entgeltposition_menge_chk check (menge >= 0),
  constraint entgeltposition_ausleihe_fk foreign key (ausleihe_id)
    references velocity.ausleihe (ausleihe_id) on update cascade on delete cascade,
  constraint entgeltposition_art_fk foreign key (entgeltart_id)
    references velocity.entgeltart (entgeltart_id) on update cascade on delete restrict,
  constraint entgeltposition_preis_fk foreign key (nutzungspreis_id)
    references velocity.nutzungspreis (preis_id) on update cascade on delete restrict
);
select velocity.fn_audit_anhaengen('entgeltposition');

create index if not exists idx_entgeltposition_ausleihe on velocity.entgeltposition (ausleihe_id);
