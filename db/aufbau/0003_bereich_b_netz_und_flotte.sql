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

-- Nachtraeglich ergaenzt: die Hoehenlage. Eine Station hat einen Ort, und
-- in einer Stadt mit hundert Hoehenmetern Spreizung gehoert die Hoehe zum
-- Ort dazu. Ueber alter table, damit bestehende Datenbanken sie bekommen -
-- create table if not exists allein wuerde die Spalte nie anlegen.
alter table velocity.station add column if not exists hoehe_m integer;
alter table velocity.station drop constraint if exists station_hoehe_chk;
alter table velocity.station add  constraint station_hoehe_chk
  check (hoehe_m is null or hoehe_m between -500 and 5000);

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
  -- restrict wie bei der Ausleihe: mit der Ortspflicht unten wuerde
  -- set null aus einem abgestellten Rad eines ohne bekannten Standort
  -- machen. Wer eine Station aufloest, raeumt sie vorher leer.
  constraint fahrrad_position_station_fk foreign key (station_id)
    references velocity.station (station_id) on update cascade on delete restrict
);
select velocity.fn_audit_anhaengen('fahrrad_position');

-- =====================================================================
--  GR13: WO STEHT DAS RAD?
--
--  Ein Rad kennt genau drei Zustaende, und die Tabelle liess bisher
--  jeden Mischmasch daraus zu:
--
--    an einer Station      station_id gesetzt, Koordinaten leer
--    frei im Stadtgebiet   station_id leer,    Koordinaten gesetzt
--    in Fahrt              beides leer - niemand weiss, wo es gerade ist
--
--  Im Bestand trugen 316 von 352 Zeilen Station UND Koordinaten. Das ist
--  dieselbe transitive Abhaengigkeit wie bei der Ausleihe: die Station
--  bestimmt den Ort, die Koordinaten daneben sind eine zweite Wahrheit,
--  die auseinanderlaufen kann. Die Sicht v_verfuegbares_fahrrad faellt
--  ohnehin ueber coalesce auf die Station zurueck.
--
--  Einmalige Normalisierung, bevor die Regel greift. Idempotent.
--  In einer grossen Tabelle waere hier der Produktionsweg richtig:
--  add constraint ... not valid, dann spaeter validate constraint -
--  das vermeidet die lange Sperre. Bei 352 Zeilen waere das Theater.
-- =====================================================================

update velocity.fahrrad_position p
   set latitude = null, longitude = null
 where p.station_id is not null and (p.latitude is not null or p.longitude is not null);

update velocity.fahrrad_position p
   set station_id = null, latitude = null, longitude = null
  from velocity.fahrrad f
 where f.fahrrad_id = p.fahrrad_id and f.status = 'ausgeliehen'
   and (p.station_id is not null or p.latitude is not null);

-- Den Fremdschluessel bestehender Datenbanken auf restrict umstellen -
-- create table if not exists ruehrt eine vorhandene Tabelle nicht an.
alter table velocity.fahrrad_position drop constraint if exists fahrrad_position_station_fk;
alter table velocity.fahrrad_position add  constraint fahrrad_position_station_fk
  foreign key (station_id) references velocity.station (station_id)
  on update cascade on delete restrict;

-- Was in der Tabelle selbst steht, prueft ein CHECK: nie beides, und
-- Koordinaten immer als Paar.
alter table velocity.fahrrad_position drop constraint if exists fahrrad_position_ort_chk;
alter table velocity.fahrrad_position add  constraint fahrrad_position_ort_chk check (
      not (station_id is not null and (latitude is not null or longitude is not null))
  and (latitude is null) = (longitude is null)
);

-- Der dritte Zustand haengt am STATUS DES RADES, und der steht in einer
-- anderen Tabelle. Ein CHECK darf nicht ueber die Zeile hinaussehen -
-- also ein Constraint-Trigger. Deferrable initially deferred, weil
-- fn_ausleihe_starten und _beenden Status und Position in ZWEI
-- Anweisungen setzen: zwischendurch ist der Zustand notwendig
-- widerspruechlich, am Ende der Transaktion nicht mehr.
create or replace function velocity.trg_radposition_pruefen()
returns trigger
language plpgsql
set search_path = velocity, pg_temp
as $$
declare
  v_rad    bigint := coalesce(new.fahrrad_id, old.fahrrad_id);
  v_status velocity.fahrrad_status;
  v_pos    velocity.fahrrad_position%rowtype;
begin
  select f.status into v_status from velocity.fahrrad f where f.fahrrad_id = v_rad;
  if not found then return null; end if;          -- Rad geloescht, Kaskade laeuft
  select * into v_pos from velocity.fahrrad_position where fahrrad_id = v_rad;
  if not found then return null; end if;          -- keine Position gefuehrt

  if v_pos.station_id is null and v_pos.latitude is null then
    -- Kein Ort. Nur erlaubt, solange das Rad unterwegs oder ausgemustert ist.
    if v_status not in ('ausgeliehen', 'ausgemustert') then
      raise exception 'Rad % hat den Status % und braucht damit einen Standort: '
                      'eine Station oder Koordinaten', v_rad, v_status
        using errcode = '23514';
    end if;
  else
    -- Ein Rad in Fahrt steht nirgends. Ein alter Ort waere eine Luege.
    if v_status = 'ausgeliehen' then
      raise exception 'Rad % ist ausgeliehen und darf keinen Standort tragen', v_rad
        using errcode = '23514';
    end if;
  end if;
  return null;
end;
$$;

comment on function velocity.trg_radposition_pruefen() is
  'Prueft GR13. Steht als Constraint-Trigger und nicht als CHECK, weil die '
  'Regel den Status des Rades braucht - und der liegt in einer anderen Tabelle. '
  'Genau da endet, was ein CHECK leisten kann.';

drop trigger if exists trg_radposition_ort on velocity.fahrrad_position;
create constraint trigger trg_radposition_ort
  after insert or update on velocity.fahrrad_position
  deferrable initially deferred
  for each row execute function velocity.trg_radposition_pruefen();

-- Auch die Gegenrichtung: wer den Status aendert, muss den Standort
-- mitfuehren. Sonst kaeme ein Rad aus der Wartung zurueck, ohne dass
-- jemand weiss, wo es steht.
drop trigger if exists trg_fahrrad_status_ort on velocity.fahrrad;
create constraint trigger trg_fahrrad_status_ort
  after update of status on velocity.fahrrad
  deferrable initially deferred
  for each row execute function velocity.trg_radposition_pruefen();

create index if not exists idx_fahrrad_position_station on velocity.fahrrad_position (station_id);


-- =====================================================================
--  GESCHAEFTSGEBIET
--
--  Innerhalb dieser Flaeche darf ein Rad ueberall abgestellt werden,
--  ausserhalb nicht. Bisher stand das Vieleck fest im JavaScript der
--  Karte - eine Regel, die die Anwendung zeichnet, aber niemand
--  durchsetzt. Jetzt steht sie in der Datenbank und wird beim Beenden
--  einer Fahrt geprueft.
--
--  Der Typ polygon gehoert zum Sprachkern von PostgreSQL; fuer
--  Punkt-in-Flaeche genuegt der Operator @>. PostGIS braucht es dafuer
--  nicht - das waere fuer ein einzelnes konvexes Vieleck zu viel
--  Maschinerie. Achtung auf die Reihenfolge: point(x, y) heisst hier
--  point(Laengengrad, Breitengrad).
-- =====================================================================

create table if not exists velocity.geschaeftsgebiet (
  gebiet_id    bigint generated always as identity primary key,
  name         text        not null,
  flaeche      polygon     not null,
  aktiv        boolean     not null default true,
  erstellt_am  timestamptz not null default now(),
  geaendert_am timestamptz not null default now(),
  constraint geschaeftsgebiet_name_uk unique (name),
  -- Ein Vieleck braucht mindestens drei Ecken, sonst ist es keine Flaeche.
  constraint geschaeftsgebiet_ecken_chk check (npoints(flaeche) >= 3)
);
select velocity.fn_audit_anhaengen('geschaeftsgebiet');

-- Liegt der Punkt in einem aktiven Geschaeftsgebiet?
create or replace function velocity.fn_im_geschaeftsgebiet(
  p_latitude numeric, p_longitude numeric
) returns boolean
language sql
stable
set search_path = velocity, pg_temp
as $$
  select exists (
    select 1 from velocity.geschaeftsgebiet g
     where g.aktiv
       and g.flaeche @> point(p_longitude::float8, p_latitude::float8)
  );
$$;

comment on function velocity.fn_im_geschaeftsgebiet(numeric, numeric) is
  'Wahr, wenn der Punkt in einem aktiven Geschaeftsgebiet liegt. Nutzt den '
  'eingebauten Operator @> auf polygon - ohne PostGIS.';
