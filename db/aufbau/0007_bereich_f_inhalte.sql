-- =====================================================================
-- 0007 Bereich F: Redaktionsinhalte
--
-- Zweck:      Inhalte der Website, die bisher fest in index.html standen.
-- Objekte:    velocity.faq_eintrag, velocity.nutzungsschritt,
--             velocity.kennzahl, velocity.hoehenmarke
-- Ruecknahme: DROP TABLE velocity.kennzahl, velocity.nutzungsschritt,
--             velocity.faq_eintrag;
--
-- Entwurfsentscheidung: drei konkrete Tabellen statt einer generischen
-- Schluessel-Wert-Tabelle. Ein Entity-Attribute-Value-Modell waere
-- flexibler, verliert aber Typsicherheit, Fremdschluessel und
-- Lesbarkeit der Abfragen. Der Unterschied wird in der Vorlesung an
-- diesem Beispiel behandelt.
-- =====================================================================

create table if not exists velocity.faq_eintrag (
  faq_id       bigint generated always as identity primary key,
  frage        text        not null,
  antwort      text        not null,
  sortierung   integer     not null default 0,
  aktiv        boolean     not null default true,
  erstellt_am  timestamptz not null default now(),
  geaendert_am timestamptz not null default now(),
  constraint faq_eintrag_frage_uk unique (frage)
);
select velocity.fn_audit_anhaengen('faq_eintrag');

create table if not exists velocity.nutzungsschritt (
  schritt_id   bigint generated always as identity primary key,
  nummer       integer     not null,
  titel        text        not null,
  beschreibung text        not null,
  erstellt_am  timestamptz not null default now(),
  geaendert_am timestamptz not null default now(),
  constraint nutzungsschritt_nummer_uk  unique (nummer),
  constraint nutzungsschritt_nummer_chk check (nummer > 0)
);
select velocity.fn_audit_anhaengen('nutzungsschritt');

-- Entfaellt: icon_code.
--
-- Die Spalte hielt den Namen eines Font-Awesome-Symbols. Auf
-- Kachelgroesse blieb davon ein Fleck, der nichts erklaerte; die
-- Anzeige ist entfernt. Eine Spalte, die niemand liest, behauptet ein
-- Merkmal, das es fachlich nicht gibt - also weg damit.
-- create table if not exists ruehrt bestehende Tabellen nicht an,
-- deshalb hier ausdruecklich.
-- cascade, weil v_nutzungsschritt auf der Spalte steht. Die Sicht wird
-- in 0010 neu gebaut und in 0011 wieder freigegeben - die Kette laeuft
-- immer vollstaendig. Wer nur diese eine Datei anwendet, steht so lange
-- ohne die Sicht da; tools/rest_security_check.py wuerde das melden.
alter table velocity.nutzungsschritt drop column if exists icon_code cascade;

create table if not exists velocity.kennzahl (
  kennzahl_id   bigint generated always as identity primary key,
  schluessel    text        not null,
  anzeigewert   text,
  label         text        not null,
  sortierung    integer     not null default 0,
  ist_berechnet boolean     not null default false,
  erstellt_am   timestamptz not null default now(),
  geaendert_am  timestamptz not null default now(),
  constraint kennzahl_schluessel_uk unique (schluessel),
  -- Entweder der Wert steht fest, oder er wird berechnet - nicht keines von beidem.
  constraint kennzahl_wert_chk check (ist_berechnet or anzeigewert is not null)
);
select velocity.fn_audit_anhaengen('kennzahl');


-- =====================================================================
--  HOEHENMARKEN
--
--  Bezugspunkte fuer die Hoehengrafik: die markanten Hoehen rund um
--  Wuerzburg. Sie sind keine Stationen und gehoeren deshalb nicht in
--  velocity.station - aber sie sind Redaktionsinhalt wie die FAQ und
--  haben in der Datenbank ihren Platz, nicht im Frontend.
-- =====================================================================

create table if not exists velocity.hoehenmarke (
  marke_id     bigint generated always as identity primary key,
  name         text        not null,
  hoehe_m      integer     not null,
  latitude     numeric(9,6),
  longitude    numeric(9,6),
  quelle       text        not null,
  sortierung   integer     not null,
  erstellt_am  timestamptz not null default now(),
  geaendert_am timestamptz not null default now(),
  constraint hoehenmarke_name_uk    unique (name),
  constraint hoehenmarke_hoehe_chk  check (hoehe_m between -500 and 5000),
  constraint hoehenmarke_lat_chk    check (latitude  is null or latitude  between  -90 and  90),
  constraint hoehenmarke_lon_chk    check (longitude is null or longitude between -180 and 180)
);
select velocity.fn_audit_anhaengen('hoehenmarke');
