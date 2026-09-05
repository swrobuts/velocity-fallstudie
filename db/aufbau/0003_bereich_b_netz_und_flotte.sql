-- =====================================================================
-- 0003 Bereich B: Netz und Flotte
--
-- Zweck:      Stationsnetz und Fahrzeugflotte. Stammdaten und
--             Bewegungsdaten werden bewusst getrennt gefuehrt.
-- Objekte:    velocity.station, velocity.fahrradtyp,
--             velocity.fahrradtyp_merkmal, velocity.hersteller,
--             velocity.fahrradmodell, velocity.fahrrad,
--             velocity.fahrrad_position, velocity.geschaeftsgebiet,
--             velocity.trg_radposition_pruefen,
--             velocity.trg_stellplaetze_pruefen,
--             velocity.fn_im_geschaeftsgebiet,
--             velocity.fn_fahrrad_motor_passt_zum_typ,
--             velocity.fn_fahrrad_bremse_passt_zum_typ
-- Ruecknahme: DROP FUNCTION velocity.trg_radposition_pruefen(),
--             velocity.trg_stellplaetze_pruefen(),
--             velocity.fn_im_geschaeftsgebiet(numeric,numeric),
--             velocity.fn_fahrrad_motor_passt_zum_typ(),
--             velocity.fn_fahrrad_bremse_passt_zum_typ();
--             DROP TABLE velocity.fahrrad_position, velocity.fahrrad,
--             velocity.fahrradmodell, velocity.hersteller,
--             velocity.fahrradtyp_merkmal, velocity.fahrradtyp,
--             velocity.station, velocity.geschaeftsgebiet;
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

-- Nachtraeglich ergaenzt, dann ein zweites Mal korrigiert - beide Male aus
-- demselben Anlass: die technischen Angaben, die eine Warenwirtschaft ueber
-- ein Rad wissen muss und die bisher fehlten. Der erste Anlauf haengte
-- Gewicht, Gangzahl, Rahmenhoehe, Akkukapazitaet und Reichweite an
-- fahrradmodell - mit der Folge, dass ein Verleiher mit mehreren Modellen
-- je Typ auch mehrere Preise je Typ gebraucht haette, hatte aber keinen: der
-- Tarif haengt an fahrradtyp (Schritt 0004), nicht an fahrradmodell. Der
-- Auftraggeber hat das zu Recht bemaengelt (siehe Kopfkommentar von
-- db/betrieb/flottenmodelle_stammdaten.sql) - eine Rahmenhoehe unter "L"
-- oder "XL" ist bei einem Leihrad zudem sachlich falsch, weil die
-- Sattelhoehe individuell per Schnellspanner eingestellt wird, nicht die
-- Rahmengroesse gewaehlt. Die Spalten stehen deshalb jetzt an fahrradtyp:
-- EIN Wert je Typ, in derselben Reihe wie der Tarif. Akkukapazitaet und
-- Reichweite bleiben NULL bei einem Typ ohne Elektroantrieb (siehe
-- fahrradtyp.hat_elektro) - wie akkustand_prozent in fahrrad_position schon
-- vormacht, ohne dass dafuer ein Trigger noetig war. Ueber alter table, aus
-- demselben Grund wie bei station.hoehe_m: create table if not exists
-- allein wuerde die Spalten in einer bestehenden Datenbank nie anlegen.
-- gewicht_kg stand hier bis zur Ausstattungserweiterung. Es haengt
-- seither am einzelnen Rad, weiter unten in dieser Datei - ein Rad
-- wiegt, was es wiegt, und nicht was seine Bauart wiegen soll.
alter table velocity.fahrradtyp add column if not exists gangzahl          integer;
alter table velocity.fahrradtyp add column if not exists rahmenhoehe_cm    integer;
alter table velocity.fahrradtyp add column if not exists akkukapazitaet_wh integer;
alter table velocity.fahrradtyp add column if not exists reichweite_km     integer;

alter table velocity.fahrradtyp drop constraint if exists fahrradtyp_gangzahl_chk;
alter table velocity.fahrradtyp add  constraint fahrradtyp_gangzahl_chk
  check (gangzahl is null or gangzahl > 0);

-- Spanne grosszuegig gewaehlt: von einem Kinderlaufrad bis zu einem
-- Cargo-Rahmen mit tiefem Einstieg, nicht auf den heutigen Bestand
-- zugeschnitten.
alter table velocity.fahrradtyp drop constraint if exists fahrradtyp_rahmenhoehe_chk;
alter table velocity.fahrradtyp add  constraint fahrradtyp_rahmenhoehe_chk
  check (rahmenhoehe_cm is null or rahmenhoehe_cm between 30 and 80);

alter table velocity.fahrradtyp drop constraint if exists fahrradtyp_akku_chk;
alter table velocity.fahrradtyp add  constraint fahrradtyp_akku_chk
  check (akkukapazitaet_wh is null or akkukapazitaet_wh > 0);

alter table velocity.fahrradtyp drop constraint if exists fahrradtyp_reichweite_chk;
alter table velocity.fahrradtyp add  constraint fahrradtyp_reichweite_chk
  check (reichweite_km is null or reichweite_km > 0);

-- Die fuenf Spalten muessen auch von fahrradmodell verschwinden, falls
-- eine bestehende Datenbank sie dort noch aus dem ersten, korrigierten
-- Anlauf traegt - das steht ABSICHTLICH NICHT hier, sondern am Ende von
-- 0018_wawi_sichten.sql: v_wawi_flotte und v_wawi_modell lesen die fuenf
-- Spalten heute noch von fahrradmodell, und "alter table ... drop column"
-- schlaegt fehl, solange eine Sicht von der Spalte abhaengt. Diese Datei
-- laeuft vor 0018 - die Spalten faellen deshalb dort, direkt NACHDEM
-- beide Sichten auf fahrradtyp umgestellt sind, nicht hier.

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

-- ---------------------------------------------------------------------
-- WARUM security definer? Das war ein Stopper, kein Feinschliff.
--
-- Ein aufgeschobener Constraint-Trigger feuert beim COMMIT - also
-- NACHDEM api_ausleihe_starten zurueckgekehrt ist. Damit endet auch
-- deren security definer: die Pruefung laeuft wieder unter der Rolle
-- des Aufrufers, und das ist bei einer Ausleihe ueber die Website
-- authenticated. Diese Rolle darf fahrrad_position nicht lesen, und
-- soll es auch nicht.
--
-- Die Folge: die Ausleihe lief sauber durch, die Regelpruefung scheiterte
-- am Ende an "permission denied for table fahrrad_position", und die
-- ganze Transaktion fiel zurueck. In den Tests fiel das nie auf - die
-- laufen als postgres.
--
-- Eine Integritaetspruefung muss die Daten sehen duerfen, ueber die sie
-- wacht, ganz gleich wer die Zeile geschrieben hat. Deshalb definer,
-- und deshalb ein festgenagelter search_path: sonst koennte jemand mit
-- eigenem Schema die Pruefung unterwandern.
-- ---------------------------------------------------------------------
create or replace function velocity.trg_radposition_pruefen()
returns trigger
language plpgsql
security definer
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
  -- KEIN "if not found then return null" hier: das stand einmal genau so
  -- da und wurde per M-0001 als die Luecke nachgemessen, die GR13 gerade
  -- verhindern soll. "Keine Positionszeile" ist kein Fall von "nichts zu
  -- pruefen", sondern die radikalste Form von "kein Standort" - schlimmer
  -- als eine Zeile mit leeren Feldern, nicht harmloser. Erreichbar war das
  -- ueber api_rad_ausmustern: die Funktion loescht die Positionszeile
  -- absichtlich (ein ausgemustertes Rad hat keinen Ort mehr), aber danach
  -- liess sich das Rad ueber api_rad_status_setzen(..., 'verfuegbar')
  -- klaglos wiederbeleben, ganz ohne dass je ein Standort hinterlegt
  -- wurde. select ... into auf eine nicht gefundene Zeile setzt v_pos
  -- ohnehin komplett auf NULL, darum reicht es, den fruehen Ausstieg zu
  -- streichen: die fehlende Zeile faellt von selbst in denselben Zweig
  -- wie eine vorhandene Zeile ohne Ort.

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
  'Prüft GR13. Steht als Constraint-Trigger und nicht als CHECK, weil die '
  'Regel den Status des Rades braucht - und der liegt in einer anderen Tabelle. '
  'Genau da endet, was ein CHECK leisten kann.';

-- Auch "or delete": wer die Positionszeile eines Rades entfernt, das noch
-- verfuegbar/wartung/defekt ist, erzeugt am Bestand genau den Zustand
-- ohne Standort, den GR13 verbietet - ganz ohne dass ein UPDATE auf
-- fahrrad.status noetig waere. Ohne dieses Ereignis liefe ein blankes
-- DELETE ungeprueft durch: dieselbe Luecke wie M-0001, nur ohne den
-- Umweg ueber api_rad_ausmustern.
drop trigger if exists trg_radposition_ort on velocity.fahrrad_position;
create constraint trigger trg_radposition_ort
  after insert or update or delete on velocity.fahrrad_position
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

-- Und der dritte Weg zu einem Rad ohne Standort: ein blankes INSERT.
-- Gesamtpruefung 26.08.2026, gemessen statt vermutet: "insert into
-- velocity.fahrrad (..., status) values (..., 'verfuegbar')" ganz ohne
-- zugehoerige fahrrad_position-Zeile lief bis hierher durch, auch nach
-- "set constraints all immediate" - trg_fahrrad_status_ort feuert nur
-- bei "update of status", nicht bei insert, und trg_radposition_ort
-- haengt an fahrrad_position, die hier nie angefasst wird. Ueber
-- api_rad_anlegen und ueber PostgREST ist der Weg dicht (die Basistabelle
-- ist authenticated entzogen, die Funktion verlangt eine Station) - aber
-- genau der rohe INSERT ist der Weg jeder Datenuebernahme, und der
-- Kommentar oben an dieser Regel darf nicht so lesen, als sei die Wurzel
-- bereits vollstaendig verriegelt.
drop trigger if exists trg_fahrrad_insert_ort on velocity.fahrrad;
create constraint trigger trg_fahrrad_insert_ort
  after insert on velocity.fahrrad
  deferrable initially deferred
  for each row execute function velocity.trg_radposition_pruefen();

create index if not exists idx_fahrrad_position_station on velocity.fahrrad_position (station_id);


-- =====================================================================
--  GR15: NIE MEHR RAEDER ALS STELLPLAETZE
--
--  Eine Station hat endlich viele Stellplaetze. In den Altdaten standen
--  am Dom 30 Raeder auf 10 Plaetzen, und acht von zehn Wuerzburger
--  Stationen waren ueberfuellt. Die Sicht v_station kaschierte es:
--  freie_stellplaetze rechnet mit greatest(..., 0) und wurde deshalb
--  nie negativ - die Zahl war nie falsch und nie wahr.
--
--  Wieder ein Constraint-Trigger und kein CHECK: die Regel zaehlt
--  Zeilen einer ANDEREN Tabelle. Deferrable, damit ein Umraeumen in
--  mehreren Anweisungen zwischendurch ueber die Grenze gehen darf -
--  gezaehlt wird am Ende der Transaktion.
--
--  Er haengt an beiden Seiten: am Abstellen und am Herabsetzen der
--  Kapazitaet. Sonst koennte man eine volle Station auf null Plaetze
--  setzen und die Regel waere umgangen.
-- =====================================================================

-- Auch diese Pruefung feuert erst beim COMMIT - siehe die Begruendung
-- bei trg_radposition_pruefen.
create or replace function velocity.trg_stellplaetze_pruefen()
returns trigger
language plpgsql
security definer
set search_path = velocity, pg_temp
as $$
declare
  v_station bigint := coalesce(new.station_id, old.station_id);
  v_kap     integer;
  v_dort    integer;
  v_name    text;
begin
  if v_station is null then return null; end if;
  select s.kapazitaet, s.name into v_kap, v_name
    from velocity.station s where s.station_id = v_station;
  if not found then return null; end if;          -- Station geloescht

  select count(*) into v_dort
    from velocity.fahrrad_position p where p.station_id = v_station;

  if v_dort > v_kap then
    raise exception 'Station % hat % Stellplaetze, es stehen aber % Raeder dort',
      v_name, v_kap, v_dort using errcode = '23514';
  end if;
  return null;
end;
$$;

-- security definer laeuft unter dem EIGNER. Beide Funktionen gehoeren
-- deshalb ausdruecklich postgres - nicht dem, der die Datei zufaellig
-- einspielt.
alter function velocity.trg_radposition_pruefen()  owner to postgres;
alter function velocity.trg_stellplaetze_pruefen() owner to postgres;

comment on function velocity.trg_stellplaetze_pruefen() is
  'Prüft GR15. Steht als Constraint-Trigger und nicht als CHECK, weil die Regel '
  'Zeilen einer anderen Tabelle zählt.';

drop trigger if exists trg_position_stellplaetze on velocity.fahrrad_position;
create constraint trigger trg_position_stellplaetze
  after insert or update of station_id on velocity.fahrrad_position
  deferrable initially deferred
  for each row execute function velocity.trg_stellplaetze_pruefen();

drop trigger if exists trg_station_stellplaetze on velocity.station;
create constraint trigger trg_station_stellplaetze
  after update of kapazitaet on velocity.station
  deferrable initially deferred
  for each row execute function velocity.trg_stellplaetze_pruefen();

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
  'Wahr, wenn der Punkt in einem aktiven Geschäftsgebiet liegt. Nutzt den '
  'eingebauten Operator @> auf polygon - ohne PostGIS.';


-- =====================================================================
-- Ausstattung des einzelnen Rades
--
-- Bis hierher hatte ein Rad sechs fachliche Spalten und sonst nichts
-- Eigenes; alles Technische hing am TYP. Raeder unterscheiden sich aber
-- im Gewicht, werden umgeruestet, bekommen ein anderes Schloss.
--
-- Warum die Spalten HIER stehen und nicht in der Datei, die sie
-- eingefuehrt hat: 0018_wawi_sichten.sql gibt sie in v_wawi_flotte
-- heraus, und eine Sicht kann nur lesen, was zum Zeitpunkt ihrer Anlage
-- schon existiert. Der erste Anlauf legte sie in 0024 an - beim
-- vollstaendigen Kettenlauf scheiterte dann 0018 mit "cannot drop
-- columns from view", weil es die Sicht mit seiner alten, kuerzeren
-- Spaltenliste neu setzte. Die Reihenfolge der Kette ist kein Detail.
--
-- Die Begruendung der einzelnen Merkmale steht in
-- db/aufbau/0024_radausstattung.sql, das die Vorbelegung und die
-- Erfassung traegt.
-- =====================================================================
-- ---- Die Spalten -----------------------------------------------------
-- Nullable bis auf farbe. NOT NULL waere hier falsch: In fahrrad fuegen
-- auch die Ladelaeufe unter db/betrieb/ und die pgTAP-Vorrichtungen ein
-- (velocity_test.fixture_rad und Verwandte), und die kennen diese
-- Merkmale nicht. Die Pflicht gehoert an den Erfassungsweg, nicht an die
-- Tabelle - api_rad_anlegen weiter unten setzt sie durch.
alter table velocity.fahrrad
  add column if not exists farbe              text not null default 'RAL 3000',
  add column if not exists gewicht_kg         numeric(4,1),
  add column if not exists rahmenform         velocity.rahmenform,
  add column if not exists schaltung          velocity.schaltungsart,
  add column if not exists bremsen            velocity.bremsart,
  add column if not exists beleuchtung        velocity.beleuchtungsart,
  add column if not exists motortyp           text,
  add column if not exists reifengroesse_zoll numeric(3,1),
  add column if not exists schlossnummer      text;

comment on column velocity.fahrrad.farbe is
  'Lackierung dieses Rades als RAL-Classic-Nummer, Vorgabe RAL 3000 (Feuerrot). Die gesamte '
  'Flotte trägt heute denselben Wert, die Spalte unterscheidet also nichts - sie steht hier '
  'für den Tag, an dem das nicht mehr gilt. Nur der Code, kein Klarname: Ein Name daneben '
  'wäre dieselbe Tatsache ein zweites Mal, und er könnte vom Code abweichen.';
comment on column velocity.fahrrad.gewicht_kg is
  'Gewogenes Gewicht DIESES Rades in Kilogramm. Stand bis 0024 als Typwert an fahrradtyp und '
  'galt damit für jedes Rad der Bauart gleich; Anbauteile, Akku und Verschleiß machen den '
  'Unterschied. Siehe Kopfkommentar.';
comment on column velocity.fahrrad.rahmenform is
  'Diamant oder Tiefeinsteiger. Entscheidet, wer aufsteigen kann - eine Angabe für die '
  'Ausleihe, nicht für die Werkstatt.';
comment on column velocity.fahrrad.schaltung is
  'Bauart der Schaltung: Naben-, Kettenschaltung oder keine. Die Zahl der Gänge steht weiterhin '
  'am Typ (fahrradtyp.gangzahl) - sie folgt der Bauart, nicht dem Exemplar.';
comment on column velocity.fahrrad.bremsen is
  'Bauart der Bremsanlage: Felge, Scheibe oder Rücktritt.';
comment on column velocity.fahrrad.beleuchtung is
  'Nabendynamo, Akkulicht oder keine. Bei Rädern ohne Beleuchtung ist der Nachtbetrieb eine '
  'Frage an die Disposition, keine an die Werkstatt.';
-- antrieb stand hier, solange es Kette und Riemen gab. Die Flotte
-- faehrt ausschliesslich Kette; die Spalte und der Aufzaehlungstyp
-- antriebsart sind mit der Praezisierung der Ausstattung entfallen,
-- abgeraeumt am Ende von 0018_wawi_sichten.sql (die Sicht musste
-- zuerst aufhoeren, die Spalte zu lesen).
comment on column velocity.fahrrad.motortyp is
  'Fabrikat des Antriebsmotors, etwa „Bosch Performance CX". NULL bei einem Rad ohne '
  'Elektroantrieb - das erzwingt der Trigger trg_fahrrad_motor_passt_zum_typ.';
comment on column velocity.fahrrad.reifengroesse_zoll is
  'Laufradgröße in Zoll, für die Ersatzteilhaltung.';
comment on column velocity.fahrrad.schlossnummer is
  'Nummer des fest verbauten Rahmenschlosses. Eindeutig, sofern vergeben - ein Schloss hängt '
  'an genau einem Rad.';

-- ---- Regeln ----------------------------------------------------------
alter table velocity.fahrrad drop constraint if exists fahrrad_gewicht_chk;
alter table velocity.fahrrad add  constraint fahrrad_gewicht_chk
  check (gewicht_kg is null or gewicht_kg > 0);

alter table velocity.fahrrad drop constraint if exists fahrrad_reifen_chk;
alter table velocity.fahrrad add  constraint fahrrad_reifen_chk
  check (reifengroesse_zoll is null or reifengroesse_zoll between 12 and 32);

-- Leerstring ist kein Wert. Ohne diese Regel liesse sich die Pflicht in
-- api_rad_anlegen mit einem Leerzeichen umgehen.
-- add column if not exists laesst eine BESTEHENDE Spalte voellig
-- unberuehrt - auch ihren Vorgabewert. Die Zeile oben legt farbe also nur
-- in einer frischen Datenbank mit 'RAL 3000' an; wo die Spalte schon
-- stand, blieb 'rot' die Vorgabe, und jeder Einfuegevorgang ohne
-- ausdrueckliche Farbe lief in die Formatregel weiter unten. 54 pgTAP-
-- Funktionen haben das gemeldet, bevor es irgendwohin ausgeliefert wurde.
alter table velocity.fahrrad alter column farbe set default 'RAL 3000';

-- Der Bestand trug bis zur Umstellung auf RAL den Wert 'rot'. Die
-- Umsetzung steht HIER und nicht in einer Betriebsdatei, weil die
-- Formatregel darunter sie voraussetzt: Ein Constraint laesst sich nicht
-- anlegen, solange Zeilen dagegen verstossen. Idempotent, weil sie beim
-- zweiten Lauf keine Zeile mehr findet.
update velocity.fahrrad set farbe = 'RAL 3000' where farbe = 'rot';

-- Die Farbe ist eine Normangabe, kein Freitext. Ohne diese Regel stuenden
-- nach einem Jahr 'rot', 'Rot', 'feuerrot' und 'RAL3000' nebeneinander
-- und bezeichneten denselben Lack.
--
-- Was die Regel ABSCHNEIDET, und zwar absichtlich: Sonderlackierungen und
-- Folierungen, die keine RAL-Nummer haben. Wer so ein Rad aufnehmen will,
-- muss die Regel aendern - das ist die richtige Huerde dafuer, hoch genug,
-- dass es eine Entscheidung bleibt.
alter table velocity.fahrrad drop constraint if exists fahrrad_farbe_chk;
alter table velocity.fahrrad add  constraint fahrrad_farbe_chk
  check (farbe ~ '^RAL [0-9]{4}$');

-- fahrrad_motortyp_chk gab es hier, solange motortyp Freitext war: eine
-- Regel gegen den Leerstring. Seit der Umstellung auf den
-- Aufzaehlungstyp velocity.motorfabrikat (weiter unten in dieser Datei)
-- ist sie gegenstandslos - ein Aufzaehlungswert kann kein Leerstring
-- sein, und der Typ laesst ohnehin nur die beiden Fabrikate zu.
alter table velocity.fahrrad drop constraint if exists fahrrad_motortyp_chk;

-- Ein Schloss haengt an genau einem Rad. Partiell, weil NULL erlaubt
-- bleibt und mehrere Raeder ohne Schloss kein Widerspruch sind.
drop index if exists velocity.fahrrad_schlossnummer_uk;
create unique index fahrrad_schlossnummer_uk
    on velocity.fahrrad (schlossnummer)
 where schlossnummer is not null;

-- ---- Der Motor muss zum Typ passen -----------------------------------
-- Das ist eine Bedingung ueber zwei Tabellen hinweg, und die kann ein
-- CHECK nicht pruefen: Er sieht nur die eigene Zeile. Ein Rad, dessen Typ
-- hat_elektro = falsch traegt, darf kein Motorfabrikat fuehren.
--
-- Grenze, die dieser Trigger NICHT abdeckt: Wird fahrradtyp.hat_elektro
-- nachtraeglich auf falsch gesetzt, bleiben bereits eingetragene
-- Motortypen stehen. Dafuer braeuchte es einen zweiten Trigger auf
-- fahrradtyp. Angesichts dessen, dass sich der Elektroantrieb eines
-- Produkttyps nicht aendert, waere das mehr Mechanik als Nutzen.
create or replace function velocity.fn_fahrrad_motor_passt_zum_typ()
returns trigger
language plpgsql
as $$
declare v_elektro boolean;
begin
  if new.motortyp is null then
    return new;
  end if;
  select t.hat_elektro into v_elektro
    from velocity.fahrradmodell mo
    join velocity.fahrradtyp    t on t.typ_id = mo.typ_id
   where mo.modell_id = new.modell_id;
  if not coalesce(v_elektro, false) then
    raise exception
      'Rad % führt den Motortyp %, sein Typ hat aber keinen Elektroantrieb',
      coalesce(new.rahmennummer, '(neu)'), new.motortyp
      using errcode = '23514';
  end if;
  return new;
end;
$$;

-- Erst der Entzug: PostgreSQL gibt EXECUTE auf eine neue Funktion an
-- PUBLIC. Ohne diese Zeile waere die Triggerfunktion fuer anon
-- ausfuehrbar - gefunden von test_s_keine_oeffentliche_funktion, derselben
-- Zusicherung, die den gleichen Fehler schon in 0021 aufgedeckt hat.
revoke all on function velocity.fn_fahrrad_motor_passt_zum_typ()
  from public, anon, authenticated;

drop trigger if exists trg_fahrrad_motor_passt_zum_typ on velocity.fahrrad;
create trigger trg_fahrrad_motor_passt_zum_typ
  before insert or update of motortyp, modell_id on velocity.fahrrad
  for each row execute function velocity.fn_fahrrad_motor_passt_zum_typ();

-- ---------------------------------------------------------------------
-- Erstinbetriebnahme, und die Praezisierung der Ausstattung
--
-- angeschafft_am ist das KAUFDATUM - so heisst es in der Oberflaeche
-- seither. Zwischen Kauf und erster Fahrt liegen Aufbau, Pruefung und
-- Auslieferung an die Station; fuer die Gewaehrleistung zaehlt das eine
-- Datum, fuer die Nutzungsdauer das andere. Deshalb zwei Spalten.
alter table velocity.fahrrad
  add column if not exists erstinbetriebnahme_am date;

comment on column velocity.fahrrad.angeschafft_am is
  'Kaufdatum dieses Rades. Nicht der Tag der ersten Fahrt - dafür steht erstinbetriebnahme_am.';
comment on column velocity.fahrrad.erstinbetriebnahme_am is
  'Tag der Erstinbetriebnahme: ab wann das Rad im Verleih stand. Liegt nie vor dem Kaufdatum, '
  'kann aber fehlen, solange ein gekauftes Rad noch nicht aufgebaut ist.';

alter table velocity.fahrrad drop constraint if exists fahrrad_inbetriebnahme_chk;
alter table velocity.fahrrad add  constraint fahrrad_inbetriebnahme_chk
  check (erstinbetriebnahme_am is null or angeschafft_am is null
      or erstinbetriebnahme_am >= angeschafft_am);

-- ---- Erst die Daten, dann die Typen ---------------------------------
-- Die Reihenfolge ist zwingend: Ein Aufzaehlungstyp laesst sich nicht
-- verkleinern, solange eine Zeile den wegfallenden Wert traegt.
update velocity.fahrrad set schaltung = 'nabe'
 where schaltung is not null and schaltung::text <> 'nabe';

update velocity.fahrrad f set bremsen = 'scheibe'
  from velocity.fahrradmodell mo, velocity.fahrradtyp t
 where mo.modell_id = f.modell_id and t.typ_id = mo.typ_id
   and t.typ_code = 'CARGO' and f.bremsen::text <> 'scheibe';

update velocity.fahrrad set bremsen = 'scheibe'
 where bremsen is not null and bremsen::text = 'ruecktritt';

-- ---- Die Aufzaehlungstypen nachziehen -------------------------------
-- Zuerst muss die Sicht weg. "alter column ... type" scheitert, solange
-- eine Sicht auf die Spalte zeigt ("cannot alter type of a column used
-- by a view"), und v_wawi_flotte fuehrt bremsen, schaltung und motortyp.
-- 0018_wawi_sichten.sql legt sie weiter hinten in der Kette ohnehin neu
-- an, mitsamt ihren Spaltenkommentaren; das Leserecht kommt aus dem
-- grant-Block am Ende von 0019_wawi_logik.sql. Wer NUR diese Datei
-- ausfuehrt, hat die Sicht solange nicht - dann gehoert 0018 hinterher.
--
-- Kein cascade: Haengt eines Tages doch etwas an v_wawi_flotte, soll das
-- hier laut scheitern und nicht stillschweigend mitgerissen werden.
drop view if exists velocity.v_wawi_flotte;

-- Und derselbe Grund noch einmal fuer den Motorwaechter: Ein Trigger,
-- der "update of motortyp" nennt, haengt an der Spalte, und PostgreSQL
-- laesst ihren Typ dann nicht aendern. Er wird weiter unten in dieser
-- Datei wieder angelegt - unveraendert, nur nach der Umstellung.
drop trigger if exists trg_fahrrad_motor_passt_zum_typ on velocity.fahrrad;

-- PostgreSQL kann einem Aufzaehlungstyp Werte HINZUFUEGEN, aber keine
-- entfernen. Verkleinern heisst deshalb: neuen Typ anlegen, die Spalte
-- umhaengen, den alten wegwerfen, den neuen umbenennen. Der Block laeuft
-- nur, solange der alte Wert noch im Typ steht - beim zweiten Lauf ist
-- die Bedingung falsch und er tut nichts.
do $$
begin
  if exists (select 1 from pg_enum e
               join pg_type ty on ty.oid = e.enumtypid
               join pg_namespace n on n.oid = ty.typnamespace
              where n.nspname = 'velocity' and ty.typname = 'bremsart'
                and e.enumlabel = 'ruecktritt') then
    create type velocity.bremsart_neu as enum ('felge','scheibe');
    alter table velocity.fahrrad
      alter column bremsen type velocity.bremsart_neu
      using bremsen::text::velocity.bremsart_neu;
    drop type velocity.bremsart;
    alter type velocity.bremsart_neu rename to bremsart;
  end if;

  if exists (select 1 from pg_enum e
               join pg_type ty on ty.oid = e.enumtypid
               join pg_namespace n on n.oid = ty.typnamespace
              where n.nspname = 'velocity' and ty.typname = 'schaltungsart'
                and e.enumlabel = 'kette') then
    create type velocity.schaltungsart_neu as enum ('nabe');
    alter table velocity.fahrrad
      alter column schaltung type velocity.schaltungsart_neu
      using schaltung::text::velocity.schaltungsart_neu;
    drop type velocity.schaltungsart;
    alter type velocity.schaltungsart_neu rename to schaltungsart;
  end if;

  -- motortyp war Freitext und wird zur Auswahl. Der bisherige Bestand
  -- traegt "Bosch Performance CX" aus dem Werbemerkmal; er wird auf das
  -- E-Bike-Fabrikat abgebildet. Ein unbekannter Freitext wuerde die
  -- Umstellung scheitern lassen - das ist gewollt: Er waere ein Wert,
  -- den niemand zugeordnet hat.
  if exists (select 1 from information_schema.columns
              where table_schema = 'velocity' and table_name = 'fahrrad'
                and column_name = 'motortyp' and data_type = 'text') then
    update velocity.fahrrad set motortyp = 'vantaa_m50'
     where motortyp is not null and motortyp not in ('vantaa_m50','vantaa_c85');
    alter table velocity.fahrrad drop constraint if exists fahrrad_motortyp_chk;
    alter table velocity.fahrrad
      alter column motortyp type velocity.motorfabrikat
      using motortyp::velocity.motorfabrikat;
  end if;
end $$;

-- ---- Der Motorwaechter zurueck --------------------------------------
-- Wortgleich zu der Fassung weiter oben; er musste fuer die
-- Typumstellung weichen. Die Funktion selbst blieb unberuehrt.
create trigger trg_fahrrad_motor_passt_zum_typ
  before insert or update of motortyp, modell_id on velocity.fahrrad
  for each row execute function velocity.fn_fahrrad_motor_passt_zum_typ();

-- ---- Scheibenbremse ist beim Lastenrad Pflicht ----------------------
-- Wieder eine Bedingung ueber zwei Tabellen hinweg, die ein CHECK nicht
-- sehen kann - dieselbe Bauart wie beim Motortyp. Ein Lastenrad traegt
-- bis zu 75 kg Zuladung; eine Felgenbremse ist dafuer nicht zugelassen.
create or replace function velocity.fn_fahrrad_bremse_passt_zum_typ()
returns trigger
language plpgsql
as $$
declare v_typ text;
begin
  if new.bremsen is null then
    return new;
  end if;
  select t.typ_code into v_typ
    from velocity.fahrradmodell mo
    join velocity.fahrradtyp    t on t.typ_id = mo.typ_id
   where mo.modell_id = new.modell_id;
  if v_typ = 'CARGO' and new.bremsen::text <> 'scheibe' then
    raise exception
      'Rad % ist ein Lastenrad und braucht eine Scheibenbremse, nicht %',
      coalesce(new.rahmennummer, '(neu)'), new.bremsen
      using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function velocity.fn_fahrrad_bremse_passt_zum_typ()
  from public, anon, authenticated;

drop trigger if exists trg_fahrrad_bremse_passt_zum_typ on velocity.fahrrad;
create trigger trg_fahrrad_bremse_passt_zum_typ
  before insert or update of bremsen, modell_id on velocity.fahrrad
  for each row execute function velocity.fn_fahrrad_bremse_passt_zum_typ();
