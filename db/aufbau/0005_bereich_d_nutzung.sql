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
  -- on delete restrict, nicht set null: mit der Ortspflicht unten waere
  -- set null fatal. Das Loeschen einer Station wuerde die einzige
  -- Ortsangabe einer abgeschlossenen Fahrt stillschweigend entfernen.
  -- Stationen werden ausser Betrieb genommen (betriebszeitraum), nicht
  -- geloescht.
  constraint ausleihe_startstation_fk foreign key (start_station_id)
    references velocity.station (station_id) on update cascade on delete restrict,
  constraint ausleihe_endstation_fk foreign key (end_station_id)
    references velocity.station (station_id) on update cascade on delete restrict
);

-- Nachtraeglich ergaenzt fuer die Warenwirtschaft: die gefahrene
-- Strecke. Nullable mit Absicht - null heisst "nicht gemessen", nicht
-- "null Kilometer". Wo sie fehlt, schaetzt v_wawi_km_co2 aus der
-- Luftlinie und kennzeichnet die Zeile als geschaetzt.
alter table velocity.ausleihe
  add column if not exists distanz_km numeric(8,2);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'ausleihe_distanz_chk') then
    alter table velocity.ausleihe
      add constraint ausleihe_distanz_chk
      check (distanz_km is null or distanz_km >= 0);
  end if;
end;
$$;

comment on column velocity.ausleihe.distanz_km is
  'Gefahrene Strecke in Kilometern. null bedeutet nicht gemessen, nicht null Kilometer.';

select velocity.fn_audit_anhaengen('ausleihe');

-- =====================================================================
--  ORTSPFLICHT
--
--  Das Modell schwieg bisher da, wo es sprechen muss: erlaubt war eine
--  Ausleihe ohne Station UND ohne Koordinaten - eine Fahrt, von der
--  niemand weiss, wo sie begann. NOT NULL geht nicht, weil die
--  Fallstudie zwei Abstellarten kennt: an einer Station oder frei im
--  Stadtgebiet gegen Zuschlag. Gefordert ist also nicht "vorhanden",
--  sondern "genau eines von beiden".
--
--  Ueber alter table, damit bestehende Datenbanken sie bekommen;
--  drop constraint if exists davor macht den Block wiederholbar.
-- =====================================================================

alter table velocity.ausleihe drop constraint if exists ausleihe_startort_chk;
alter table velocity.ausleihe add  constraint ausleihe_startort_chk check (
     (start_station_id is not null and start_latitude is     null and start_longitude is     null)
  or (start_station_id is     null and start_latitude is not null and start_longitude is not null)
);

-- Am Ende kommt die Zeit dazu: solange die Fahrt laeuft, gibt es keinen
-- Rueckgabeort, und danach muss es genau einen geben.
alter table velocity.ausleihe drop constraint if exists ausleihe_endort_chk;
alter table velocity.ausleihe add  constraint ausleihe_endort_chk check (
     (endzeit is null
        and end_station_id is null and end_latitude is null and end_longitude is null)
  or (endzeit is not null and (
         (end_station_id is not null and end_latitude is     null and end_longitude is     null)
      or (end_station_id is     null and end_latitude is not null and end_longitude is not null)))
);

-- Die Fremdschluessel bestehender Datenbanken auf restrict umstellen.
alter table velocity.ausleihe drop constraint if exists ausleihe_startstation_fk;
alter table velocity.ausleihe add  constraint ausleihe_startstation_fk
  foreign key (start_station_id) references velocity.station (station_id)
  on update cascade on delete restrict;
alter table velocity.ausleihe drop constraint if exists ausleihe_endstation_fk;
alter table velocity.ausleihe add  constraint ausleihe_endstation_fk
  foreign key (end_station_id) references velocity.station (station_id)
  on update cascade on delete restrict;

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
