-- =====================================================================
-- 0002 Bereich A: Geschaeftspartner
--
-- Zweck:      Adresse als eigenstaendige, wiederverwendbare Entitaet und
--             der Kunde als Geschaeftspartner der Ausleihe.
-- Objekte:    velocity.adresse, velocity.kunde, velocity.seq_kundennummer
-- Ruecknahme: DROP TABLE velocity.kunde, velocity.adresse;
--             DROP SEQUENCE velocity.seq_kundennummer;
-- =====================================================================

-- ---------------------------------------------------------------------
-- adresse
--
-- Eigene Entitaet statt Adressspalten am Kunden, weil dieselbe Struktur
-- von Station, Lieferant und Lager gebraucht wird.
--
-- hausnummer ist bewusst NOT NULL mit Vorgabewert '': in einem
-- UNIQUE-Index gelten zwei NULL-Werte als verschieden, der fachliche
-- Schluessel wuerde bei fehlender Hausnummer also keine Dubletten
-- verhindern.
-- ---------------------------------------------------------------------
create table if not exists velocity.adresse (
  adresse_id    bigint generated always as identity primary key,
  strasse       text        not null,
  hausnummer    text        not null default '',
  plz           text        not null,
  ort           text        not null,
  land_code     char(2)     not null default 'DE',
  erstellt_am   timestamptz not null default now(),
  geaendert_am  timestamptz not null default now(),
  constraint adresse_fachschluessel_uk
    unique (strasse, hausnummer, plz, ort, land_code),
  constraint adresse_plz_chk
    check (land_code <> 'DE' or plz ~ '^[0-9]{5}$'),
  constraint adresse_land_chk
    check (land_code ~ '^[A-Z]{2}$')
);

select velocity.fn_audit_anhaengen('adresse');

create index if not exists idx_adresse_ort on velocity.adresse (ort);

-- ---------------------------------------------------------------------
-- kunde
--
-- Kein passwort_hash: die Anmeldung liegt vollstaendig bei Supabase Auth.
-- Die Verbindung dorthin ist auth_uid; eine gesonderte Mapping-Tabelle
-- entfaellt.
--
-- Das Mindestalter (Geschaeftsregel GR8) wird NICHT hier geprueft: eine
-- Bedingung mit current_date waere nicht immutable und koennte beim
-- Wiedereinspielen eines Dumps Zeilen abweisen, die beim Einfuegen
-- gueltig waren. Auf Tabellenebene steht nur eine Plausibilitaetsgrenze;
-- die Altersregel prueft api_profil_aktualisieren in Schritt 0009.
-- ---------------------------------------------------------------------
create sequence if not exists velocity.seq_kundennummer as bigint start 1;

create table if not exists velocity.kunde (
  kunde_id            bigint generated always as identity primary key,
  kundennummer        text        not null
                        default 'K-' || lpad(nextval('velocity.seq_kundennummer')::text, 6, '0'),
  auth_uid            uuid,
  email               text        not null,
  anrede              text,
  vorname             text        not null,
  nachname            text        not null,
  geburtsdatum        date,
  telefon             text,
  rechnungsadresse_id bigint,
  status              velocity.kunde_status not null default 'aktiv',
  registriert_am      timestamptz not null default now(),
  erstellt_am         timestamptz not null default now(),
  geaendert_am        timestamptz not null default now(),
  constraint kunde_kundennummer_uk unique (kundennummer),
  constraint kunde_email_uk        unique (email),
  constraint kunde_auth_uid_uk     unique (auth_uid),
  constraint kunde_email_chk
    check (email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  constraint kunde_geburtsdatum_chk
    check (geburtsdatum is null
           or geburtsdatum between date '1900-01-01' and date '2100-01-01'),
  constraint kunde_rechnungsadresse_fk
    foreign key (rechnungsadresse_id) references velocity.adresse (adresse_id)
    on update cascade on delete restrict,
  constraint kunde_auth_uid_fk
    foreign key (auth_uid) references auth.users (id)
    on update cascade on delete set null
);

select velocity.fn_audit_anhaengen('kunde');

create index if not exists idx_kunde_nachname on velocity.kunde (nachname);
create index if not exists idx_kunde_adresse  on velocity.kunde (rechnungsadresse_id);
