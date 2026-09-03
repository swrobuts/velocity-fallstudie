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
  -- Der Preisschaetzer ist eine Analytics-Funktion, die man ein- und
  -- ausschalten koennen soll: In der Lehre ist der Vergleich mit und ohne
  -- Modell der eigentliche Erkenntnisgewinn. Voreinstellung aus - eine
  -- Schaetzung, die niemand bestellt hat, gehoert nicht auf den Schirm.
  zeigt_preisschaetzer boolean not null default false,
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

-- Laufende Datenbanken bekommen die Spalte nachtraeglich. Ohne diese
-- Zeile haette nur eine Neuinstallation den Preisschaetzer.
alter table velocity.kunde
  add column if not exists zeigt_preisschaetzer boolean not null default false;

-- Voreinstellung AN, seit dem 03.09.2026.
--
-- Sie stand auf aus, und der Schalter sitzt im Kontomenue. Damit sah den
-- Preisschaetzer faktisch niemand: 1013 von 1014 Konten hatten ihn aus,
-- jedes neue ebenfalls, und abgemeldet war er ohnehin abgeschaltet. Ein
-- Merkmal, das man erst finden muss, um es einzuschalten, wird nicht
-- gefunden - es war zwei Tage lang unbemerkt tot.
--
-- Der Zweck des Schalters bleibt: der Vergleich mit und ohne Modell. Nur
-- die Richtung dreht sich - man schaltet ihn jetzt AUS, um die Seite ohne
-- Modell zu sehen, statt ihn zu suchen, um sie mit Modell zu sehen.
alter table velocity.kunde
  alter column zeigt_preisschaetzer set default true;

select velocity.fn_audit_anhaengen('kunde');

create index if not exists idx_kunde_nachname on velocity.kunde (nachname);
create index if not exists idx_kunde_adresse  on velocity.kunde (rechnungsadresse_id);
