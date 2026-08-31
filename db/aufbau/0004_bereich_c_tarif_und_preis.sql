-- =====================================================================
-- 0004 Bereich C: Tarif und Preis
--
-- Zweck:      Zeitabhaengige Konditionen und Preise sowie die
--             Mitgliedschaft des Kunden in einem Tarif.
-- Objekte:    velocity.tarif, velocity.tarif_kondition,
--             velocity.mitgliedschaft, velocity.freiminuten_periode,
--             velocity.nutzungspreis
-- Ruecknahme: DROP TABLE velocity.freiminuten_periode,
--             velocity.mitgliedschaft, velocity.tarif_kondition,
--             velocity.nutzungspreis, velocity.tarif;
--
-- Hinweis:    Alle Zeitraeume sind halboffen '[)'. Damit schliesst das
--             Ende eines Zeitraums nahtlos an den Beginn des naechsten
--             an, ohne sich zu ueberschneiden.
-- =====================================================================

create table if not exists velocity.tarif (
  tarif_id      bigint generated always as identity primary key,
  tarif_code    text        not null,
  bezeichnung   text        not null,
  art           velocity.tarifart not null default 'standard',
  voraussetzung text,
  erstellt_am   timestamptz not null default now(),
  geaendert_am  timestamptz not null default now(),
  constraint tarif_code_uk        unique (tarif_code),
  constraint tarif_bezeichnung_uk unique (bezeichnung)
);
select velocity.fn_audit_anhaengen('tarif');

-- Konditionen sind historisiert: eine Preisanpassung legt einen neuen
-- Zeitraum an, statt den alten zu ueberschreiben.
create table if not exists velocity.tarif_kondition (
  kondition_id          bigint generated always as identity primary key,
  tarif_id              bigint      not null,
  gueltigkeit           daterange   not null,
  freiminuten_pro_monat integer     not null default 0,
  rabatt_prozent        numeric(5,2) not null default 0,
  erstellt_am           timestamptz not null default now(),
  geaendert_am          timestamptz not null default now(),
  constraint tarif_kondition_freiminuten_chk check (freiminuten_pro_monat >= 0),
  constraint tarif_kondition_rabatt_chk      check (rabatt_prozent between 0 and 100),
  constraint tarif_kondition_zeitraum_chk    check (not isempty(gueltigkeit)),
  constraint tarif_kondition_tarif_fk foreign key (tarif_id)
    references velocity.tarif (tarif_id) on update cascade on delete restrict,
  -- Kern der Historisierung: derselbe Tarif darf zu keinem Zeitpunkt zwei
  -- gueltige Konditionen haben. Braucht btree_gist fuer "bigint WITH =".
  constraint tarif_kondition_ueberschneidung_ex
    exclude using gist (tarif_id with =, gueltigkeit with &&)
);
select velocity.fn_audit_anhaengen('tarif_kondition');

-- KEIN MONATSENTGELT - AUCH NICHT ALS MOEGLICHKEIT (31.08.2026).
--
-- Die Kondition trug bis hierher eine Spalte monatspreis. Sie stand in
-- allen Tarifen auf null, aber ihre blosse Existenz hat einmal gereicht:
-- Premium kam mit 9,90 Euro in die Referenzdaten und blieb dort, weil
-- kein Test danach fragte. VeloCity wirbt mit '0 Euro Anmeldegebuehr'
-- und nennt als Preismodell ausschliesslich Startgebuehr, Minutenpreis
-- und Tageshoechstpreis. Ein Monatsentgelt gibt es nicht - deshalb gibt
-- es die Spalte nicht mehr.
--
-- Ein Feld, das eine Zusage brechen kann, ist keine Vorsorge, sondern
-- eine offene Tuer. Der Tarifvorteil steckt in freiminuten_pro_monat und
-- rabatt_prozent; beide bleiben.
-- v_tarif liest die Spalte und haelt sie damit fest; ohne dieses drop
-- scheitert das alter darunter. Kein cascade: das wuerde alles Abhaengige
-- mitreissen, ohne es zu benennen. 0010_sichten.sql legt die Sicht in
-- ihrer neuen Fassung wieder an - die Aufbaudateien laufen der Reihe nach.
drop view if exists velocity.v_tarif;
alter table velocity.tarif_kondition drop column if exists monatspreis;

create table if not exists velocity.mitgliedschaft (
  mitgliedschaft_id bigint generated always as identity primary key,
  kunde_id          bigint      not null,
  tarif_id          bigint      not null,
  gueltigkeit       daterange   not null,
  erstellt_am       timestamptz not null default now(),
  geaendert_am      timestamptz not null default now(),
  constraint mitgliedschaft_zeitraum_chk check (not isempty(gueltigkeit)),
  constraint mitgliedschaft_kunde_fk foreign key (kunde_id)
    references velocity.kunde (kunde_id) on update cascade on delete restrict,
  constraint mitgliedschaft_tarif_fk foreign key (tarif_id)
    references velocity.tarif (tarif_id) on update cascade on delete restrict,
  -- Geschaeftsregel GR3, von der Datenbank erzwungen statt von der Anwendung gehofft.
  constraint mitgliedschaft_ueberschneidung_ex
    exclude using gist (kunde_id with =, gueltigkeit with &&)
);
select velocity.fn_audit_anhaengen('mitgliedschaft');

create index if not exists idx_mitgliedschaft_kunde on velocity.mitgliedschaft (kunde_id);

-- ---------------------------------------------------------------------
-- freiminuten_periode
--
-- Ersetzt den mutierenden Zaehler des Altmodells. Kontingent und
-- Verbrauch stehen je Monat nebeneinander, sind also im Nachhinein
-- rekonstruierbar - Bestand und Bewegung bleiben unterscheidbar.
-- ---------------------------------------------------------------------
create table if not exists velocity.freiminuten_periode (
  periode_id         bigint generated always as identity primary key,
  mitgliedschaft_id  bigint      not null,
  jahr               integer     not null,
  monat              integer     not null,
  kontingent_minuten integer     not null default 0,
  verbraucht_minuten integer     not null default 0,
  erstellt_am        timestamptz not null default now(),
  geaendert_am       timestamptz not null default now(),
  constraint freiminuten_periode_uk unique (mitgliedschaft_id, jahr, monat),
  constraint freiminuten_periode_monat_chk      check (monat between 1 and 12),
  constraint freiminuten_periode_jahr_chk       check (jahr between 2000 and 2100),
  constraint freiminuten_periode_kontingent_chk check (kontingent_minuten >= 0),
  constraint freiminuten_periode_verbrauch_chk
    check (verbraucht_minuten >= 0 and verbraucht_minuten <= kontingent_minuten),
  constraint freiminuten_periode_mitgliedschaft_fk foreign key (mitgliedschaft_id)
    references velocity.mitgliedschaft (mitgliedschaft_id) on update cascade on delete cascade
);
select velocity.fn_audit_anhaengen('freiminuten_periode');

-- ---------------------------------------------------------------------
-- nutzungspreis: der Preis je Fahrradtyp und Zeitraum.
-- Bepreist wird spaeter mit dem zum Startzeitpunkt der Ausleihe
-- gueltigen Satz (Geschaeftsregel GR5).
-- ---------------------------------------------------------------------
create table if not exists velocity.nutzungspreis (
  preis_id          bigint generated always as identity primary key,
  typ_id            bigint      not null,
  gueltigkeit       daterange   not null,
  startgebuehr      numeric(10,2) not null,
  preis_pro_minute  numeric(10,2) not null,
  tageshoechstpreis numeric(10,2) not null,
  erstellt_am       timestamptz not null default now(),
  geaendert_am      timestamptz not null default now(),
  constraint nutzungspreis_start_chk      check (startgebuehr      >= 0),
  constraint nutzungspreis_minute_chk     check (preis_pro_minute  >= 0),
  constraint nutzungspreis_hoechst_chk    check (tageshoechstpreis >= startgebuehr),
  constraint nutzungspreis_zeitraum_chk   check (not isempty(gueltigkeit)),
  constraint nutzungspreis_typ_fk foreign key (typ_id)
    references velocity.fahrradtyp (typ_id) on update cascade on delete restrict,
  constraint nutzungspreis_ueberschneidung_ex
    exclude using gist (typ_id with =, gueltigkeit with &&)
);
select velocity.fn_audit_anhaengen('nutzungspreis');
