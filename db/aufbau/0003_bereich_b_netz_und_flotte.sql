-- =====================================================================
-- 0003 Bereich B: Netz und Flotte
--
-- Zweck:      Stationsnetz und Fahrzeugflotte. Stammdaten und
--             Bewegungsdaten werden bewusst getrennt gefuehrt.
-- Objekte:    velocity.station, velocity.fahrradtyp,
--             velocity.fahrradtyp_merkmal, velocity.hersteller,
--             velocity.fahrradmodell, velocity.fahrrad,
--             velocity.fahrrad_position
-- Ruecknahme: DROP TABLE velocity.fahrrad_position, velocity.fahrrad,
--             velocity.fahrradmodell, velocity.hersteller,
--             velocity.fahrradtyp_merkmal, velocity.fahrradtyp,
--             velocity.station;
-- =====================================================================

create table if not exists velocity.station (
  station_id        bigint generated always as identity primary key,
  stationsnummer    text        not null,
  name              text        not null,
  adresse_id        bigint      not null,
  latitude          numeric(9,6),
  longitude         numeric(9,6),
  kapazitaet        integer     not null,
  betriebszeitraum  daterange   not null default daterange(current_date, null, '[)'),
  erstellt_am       timestamptz not null default now(),
  geaendert_am      timestamptz not null default now(),
  constraint station_nummer_uk      unique (stationsnummer),
  constraint station_kapazitaet_chk check (kapazitaet > 0),
  constraint station_lat_chk        check (latitude  is null or latitude  between  -90 and  90),
  constraint station_lon_chk        check (longitude is null or longitude between -180 and 180),
  constraint station_adresse_fk foreign key (adresse_id)
    references velocity.adresse (adresse_id) on update cascade on delete restrict
);
select velocity.fn_audit_anhaengen('station');

-- ---------------------------------------------------------------------
-- fahrradtyp: fachliche Klasse eines Rades, OHNE Preise.
-- Preise sind zeitabhaengig und stehen deshalb in velocity.nutzungspreis
-- (Schritt 0004). Laegen sie hier, wuerde jede Preisaenderung rueckwirkend
-- die Bewertung aller Altausleihen veraendern.
-- ---------------------------------------------------------------------
create table if not exists velocity.fahrradtyp (
  typ_id        bigint generated always as identity primary key,
  typ_code      text        not null,
  bezeichnung   text        not null,
  beschreibung  text,
  hat_elektro   boolean     not null default false,
  zuladung_kg   integer,
  erstellt_am   timestamptz not null default now(),
  geaendert_am  timestamptz not null default now(),
  constraint fahrradtyp_code_uk        unique (typ_code),
  constraint fahrradtyp_bezeichnung_uk unique (bezeichnung),
  constraint fahrradtyp_zuladung_chk   check (zuladung_kg is null or zuladung_kg > 0)
);
select velocity.fn_audit_anhaengen('fahrradtyp');

-- Werbliche Merkmale der Tarifkarten: bisher fest im HTML.
create table if not exists velocity.fahrradtyp_merkmal (
  merkmal_id    bigint generated always as identity primary key,
  typ_id        bigint      not null,
  sortierung    integer     not null,
  merkmal       text        not null,
  erstellt_am   timestamptz not null default now(),
  geaendert_am  timestamptz not null default now(),
  constraint fahrradtyp_merkmal_uk unique (typ_id, sortierung),
  constraint fahrradtyp_merkmal_typ_fk foreign key (typ_id)
    references velocity.fahrradtyp (typ_id) on update cascade on delete cascade
);
select velocity.fn_audit_anhaengen('fahrradtyp_merkmal');

create table if not exists velocity.hersteller (
  hersteller_id bigint generated always as identity primary key,
  name          text        not null,
  erstellt_am   timestamptz not null default now(),
  geaendert_am  timestamptz not null default now(),
  constraint hersteller_name_uk unique (name)
);
select velocity.fn_audit_anhaengen('hersteller');

-- Bruecke zur Warenwirtschaft: Ersatzteile haengen am Modell, nicht am
-- einzelnen Rad.
create table if not exists velocity.fahrradmodell (
  modell_id         bigint generated always as identity primary key,
  hersteller_id     bigint      not null,
  typ_id            bigint      not null,
  modellbezeichnung text        not null,
  baujahr           integer,
  erstellt_am       timestamptz not null default now(),
  geaendert_am      timestamptz not null default now(),
  constraint fahrradmodell_uk unique (hersteller_id, modellbezeichnung),
  constraint fahrradmodell_baujahr_chk check (baujahr is null or baujahr between 1900 and 2100),
  constraint fahrradmodell_hersteller_fk foreign key (hersteller_id)
    references velocity.hersteller (hersteller_id) on update cascade on delete restrict,
  constraint fahrradmodell_typ_fk foreign key (typ_id)
    references velocity.fahrradtyp (typ_id) on update cascade on delete restrict
);
select velocity.fn_audit_anhaengen('fahrradmodell');

create table if not exists velocity.fahrrad (
  fahrrad_id      bigint generated always as identity primary key,
  rahmennummer    text        not null,
  modell_id       bigint      not null,
  status          velocity.fahrrad_status not null default 'verfuegbar',
  angeschafft_am  date,
  ausgemustert_am date,
  erstellt_am     timestamptz not null default now(),
  geaendert_am    timestamptz not null default now(),
  constraint fahrrad_rahmennummer_uk unique (rahmennummer),
  constraint fahrrad_ausmusterung_chk
    check (ausgemustert_am is null or angeschafft_am is null
           or ausgemustert_am >= angeschafft_am),
  constraint fahrrad_modell_fk foreign key (modell_id)
    references velocity.fahrradmodell (modell_id) on update cascade on delete restrict
);
select velocity.fn_audit_anhaengen('fahrrad');

create index if not exists idx_fahrrad_status on velocity.fahrrad (status);
create index if not exists idx_fahrrad_modell on velocity.fahrrad (modell_id);

-- ---------------------------------------------------------------------
-- fahrrad_position: 1:1-Satellit zu fahrrad.
--
-- Vertikale Trennung: selten aenderliche Stammdaten bleiben in fahrrad,
-- die staendig aenderlichen Bewegungsdaten stehen hier. station_id IS NULL
-- bedeutet eindeutig "frei abgestellt".
-- ---------------------------------------------------------------------
create table if not exists velocity.fahrrad_position (
  fahrrad_id        bigint primary key,
  station_id        bigint,
  latitude          numeric(9,6),
  longitude         numeric(9,6),
  akkustand_prozent smallint,
  aktualisiert_am   timestamptz not null default now(),
  erstellt_am       timestamptz not null default now(),
  geaendert_am      timestamptz not null default now(),
  constraint fahrrad_position_akku_chk
    check (akkustand_prozent is null or akkustand_prozent between 0 and 100),
  constraint fahrrad_position_lat_chk
    check (latitude  is null or latitude  between  -90 and  90),
  constraint fahrrad_position_lon_chk
    check (longitude is null or longitude between -180 and 180),
  constraint fahrrad_position_fahrrad_fk foreign key (fahrrad_id)
    references velocity.fahrrad (fahrrad_id) on update cascade on delete cascade,
  constraint fahrrad_position_station_fk foreign key (station_id)
    references velocity.station (station_id) on update cascade on delete set null
);
select velocity.fn_audit_anhaengen('fahrrad_position');

create index if not exists idx_fahrrad_position_station on velocity.fahrrad_position (station_id);
