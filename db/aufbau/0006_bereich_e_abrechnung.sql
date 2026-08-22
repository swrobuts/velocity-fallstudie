-- =====================================================================
-- 0006 Bereich E: Abrechnung
--
-- Zweck:      Monatliche Fakturierung der Ausleihen und deren Bezahlung.
-- Objekte:    velocity.zahlungsart, velocity.zahlungsmittel,
--             velocity.rechnung, velocity.rechnungsposition,
--             velocity.zahlung
-- Ruecknahme: DROP TABLE velocity.zahlung, velocity.rechnungsposition,
--             velocity.rechnung, velocity.zahlungsmittel,
--             velocity.zahlungsart;
--
-- Benennung: die Belegspalte heisst erstellt_am_beleg, weil erstellt_am
-- bereits die technische Audit-Spalte ist. Fachliche und technische
-- Zeitstempel duerfen nicht denselben Namen tragen.
-- =====================================================================

create table if not exists velocity.zahlungsart (
  zahlungsart_id bigint generated always as identity primary key,
  code           text        not null,
  bezeichnung    text        not null,
  erstellt_am    timestamptz not null default now(),
  geaendert_am   timestamptz not null default now(),
  constraint zahlungsart_code_uk unique (code)
);
select velocity.fn_audit_anhaengen('zahlungsart');

-- ---------------------------------------------------------------------
-- zahlungsmittel
--
-- Gespeichert wird ausschliesslich das Token des Zahlungsdienstleisters.
-- Weder IBAN noch Kartennummer duerfen hier landen: was nicht gespeichert
-- wird, kann nicht abfliessen.
-- ---------------------------------------------------------------------
create table if not exists velocity.zahlungsmittel (
  zahlungsmittel_id bigint generated always as identity primary key,
  kunde_id          bigint      not null,
  zahlungsart_id    bigint      not null,
  referenz_token    text        not null,
  inhaber           text,
  gueltig_bis       date,
  ist_standard      boolean     not null default false,
  erstellt_am       timestamptz not null default now(),
  geaendert_am      timestamptz not null default now(),
  constraint zahlungsmittel_kunde_fk foreign key (kunde_id)
    references velocity.kunde (kunde_id) on update cascade on delete cascade,
  constraint zahlungsmittel_art_fk foreign key (zahlungsart_id)
    references velocity.zahlungsart (zahlungsart_id) on update cascade on delete restrict
);
select velocity.fn_audit_anhaengen('zahlungsmittel');

create unique index if not exists uq_zahlungsmittel_standard
  on velocity.zahlungsmittel (kunde_id) where ist_standard;

create table if not exists velocity.rechnung (
  rechnung_id       bigint generated always as identity primary key,
  rechnungsnummer   text        not null,
  kunde_id          bigint      not null,
  periode_jahr      integer     not null,
  periode_monat     integer     not null,
  erstellt_am_beleg timestamptz not null default now(),
  betrag_netto      numeric(10,2) not null default 0,
  ust_satz          numeric(5,2)  not null default 19.00,
  ust_betrag        numeric(10,2) not null default 0,
  betrag_brutto     numeric(10,2) not null default 0,
  status            velocity.rechnung_status not null default 'entwurf',
  erstellt_am       timestamptz not null default now(),
  geaendert_am      timestamptz not null default now(),
  constraint rechnung_nummer_uk  unique (rechnungsnummer),
  constraint rechnung_periode_uk unique (kunde_id, periode_jahr, periode_monat),
  constraint rechnung_monat_chk  check (periode_monat between 1 and 12),
  constraint rechnung_jahr_chk   check (periode_jahr  between 2000 and 2100),
  constraint rechnung_betrag_chk check (betrag_netto >= 0 and ust_betrag >= 0 and betrag_brutto >= 0),
  constraint rechnung_kunde_fk foreign key (kunde_id)
    references velocity.kunde (kunde_id) on update cascade on delete restrict
);
select velocity.fn_audit_anhaengen('rechnung');

create table if not exists velocity.rechnungsposition (
  rechnungsposition_id bigint generated always as identity primary key,
  rechnung_id          bigint      not null,
  position_nr          integer     not null,
  ausleihe_id          bigint,
  beschreibung         text        not null,
  betrag               numeric(10,2) not null,
  erstellt_am          timestamptz not null default now(),
  geaendert_am         timestamptz not null default now(),
  constraint rechnungsposition_uk unique (rechnung_id, position_nr),
  constraint rechnungsposition_rechnung_fk foreign key (rechnung_id)
    references velocity.rechnung (rechnung_id) on update cascade on delete cascade,
  constraint rechnungsposition_ausleihe_fk foreign key (ausleihe_id)
    references velocity.ausleihe (ausleihe_id) on update cascade on delete restrict
);
select velocity.fn_audit_anhaengen('rechnungsposition');

create table if not exists velocity.zahlung (
  zahlung_id        bigint generated always as identity primary key,
  rechnung_id       bigint      not null,
  zahlungsmittel_id bigint,
  betrag            numeric(10,2) not null,
  gebucht_am        timestamptz,
  status            velocity.zahlung_status not null default 'offen',
  erstellt_am       timestamptz not null default now(),
  geaendert_am      timestamptz not null default now(),
  constraint zahlung_betrag_chk  check (betrag >= 0),
  constraint zahlung_gebucht_chk check (status <> 'gebucht' or gebucht_am is not null),
  constraint zahlung_rechnung_fk foreign key (rechnung_id)
    references velocity.rechnung (rechnung_id) on update cascade on delete restrict,
  constraint zahlung_mittel_fk foreign key (zahlungsmittel_id)
    references velocity.zahlungsmittel (zahlungsmittel_id) on update cascade on delete set null
);
select velocity.fn_audit_anhaengen('zahlung');

create index if not exists idx_rechnung_kunde   on velocity.rechnung (kunde_id);
create index if not exists idx_zahlung_rechnung on velocity.zahlung (rechnung_id);
