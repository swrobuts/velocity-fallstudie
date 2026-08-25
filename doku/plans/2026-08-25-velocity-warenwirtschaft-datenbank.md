# VeloCity Warenwirtschaft — Umsetzungsplan Schritt 1: Datenbank

> **Für agentische Bearbeiter:** ERFORDERLICHE SUB-SKILL: `superpowers:subagent-driven-development` (empfohlen) oder `superpowers:executing-plans`, um diesen Plan Aufgabe für Aufgabe umzusetzen. Die Schritte nutzen Checkbox-Syntax (`- [ ]`) zur Nachverfolgung.

**Ziel:** Die Datenbankseite der Warenwirtschaft bauen — Personal, Instandhaltung, Änderungsprotokoll, die Auswertungssichten samt Kilometer- und CO₂-Rechnung, die schreibenden `api_`-Funktionen mit Rollenprüfung, den Zugriffsschutz und ein Referenzjahr an Daten, an dem sich die Auswertungen nachrechnen lassen.

**Architektur:** Drei neue Bereiche (J Personal, I Instandhaltung, K Protokoll und Kennzahlen) im bestehenden Schema `velocity`, in derselben Machart wie die Bereiche A bis F: idempotente, nummerierte SQL-Dateien unter `db/aufbau/`, pgTAP-Tests unter `db/tests/`. Die Warenwirtschaft greift wie die Website ausschließlich über `v_*`-Sichten und `api_*`-Funktionen zu; unterschieden werden Kunde und Mitarbeiter über zwei `SECURITY DEFINER`-Funktionen, die aus `auth.uid()` auflösen. Die Referenzdaten entstehen unter `db/betrieb/` und werden von der echten Preislogik bepreist, nicht mit gesetzten Beträgen gefüllt.

**Tech-Stack:** PostgreSQL 17.6 (self-hosted Supabase auf `supabase.butscher.cloud`, Port 5433), PostgREST, pgTAP 1.3.3, `btree_gist` 1.7, Python 3 mit `psycopg` (`db/run.py`, `db/test.py`), Bash (`tools/abnahme.sh`).

**Spec:** `doku/specs/2026-08-25-velocity-warenwirtschaft-design.md` — der Plan argumentiert aus der Spec; beide zusammen lesen.

**Ablageort abweichend vom Standard:** Der Plan liegt unter `doku/plans/` statt `docs/superpowers/plans/`, weil `docs/` in diesem Repository für die Auslieferung reserviert ist.

**Schritt 2 (Oberfläche unter `wawi.butscher.cloud`) ist NICHT Teil dieses Plans.** Er entsteht erst, wenn dieser hier umgesetzt ist.

---

## Globale Randbedingungen

Diese Vorgaben gelten für **jede** Aufgabe und werden dort nicht wiederholt.

- **Schema:** ausschließlich `velocity`. Fremdschemata (`auth`, `storage`, `extensions`) werden nie verändert — insbesondere **keine** Trigger auf `auth.users`.
- **Verbindung:** Zugangsdaten ausschließlich aus `.env` (in `.gitignore`, niemals committen). Anwenden mit `python3 db/run.py <datei>`, testen mit `python3 db/test.py <datei>`.
- **Bezeichner:** Deutsch, `snake_case`, Entitätstabellen im Singular.
- **Primärschlüssel:** `<tabelle>_id bigint generated always as identity primary key`.
- **Zeitstempel:** ausnahmslos `timestamptz`. **Geld:** `numeric(10,2)`. Niemals `float` für Beträge.
- **Löschregeln:** `on update cascade on delete restrict` als Standard; `cascade` nur bei echter Existenzabhängigkeit (Positionen zu ihrem Kopf).
- **Audit:** jede neue Basistabelle trägt `erstellt_am timestamptz not null default now()` und `geaendert_am timestamptz not null default now()` sowie `select velocity.fn_audit_anhaengen('<tabelle>');` nach dem `create table` — die beiden RLS-Zeilen dürfen dazwischenstehen, damit Tabelle, Schutz und Audit als ein Block zusammenbleiben.
- **Idempotenz:** jede Datei unter `db/aufbau/` muss zweimal hintereinander fehlerfrei laufen. `create table if not exists`, `create or replace`, `drop policy if exists` vor `create policy`, ENUMs über den `do`-Block in `0001`, Constraints über `do`-Block mit `pg_constraint`-Prüfung.
- **Dateikopf:** jede SQL-Datei beginnt mit einem Kommentarblock aus Zweck, Objekten und Rücknahme — Vorbild `db/aufbau/0005_bereich_d_nutzung.sql`.
- **Kommentare auf Deutsch, ohne Umlaute im SQL-Quelltext** (die bestehenden Dateien schreiben `Ruecknahme`, `Gueltigkeit`); in Markdown und in `comment on`-Texten sind Umlaute erwünscht.
- **Kommentare begründen, sie beschreiben nicht.** Nicht „legt die Tabelle rolle an", sondern warum die Zuordnung m:n ist. Der bestehende Bestand hält das durch; er ist der Maßstab.
- **Jede neue Tabelle, jede neue Sicht und jede neue Fachspalte bekommt
  einen Kommentar.** Das ist kein guter Vorsatz, sondern ein
  durchgesetzter Standard: `test_doku_vollstaendig` in
  `db/tests/t0012_dokumentation.sql` sammelt alle Tabellen, Sichten und
  Spalten ohne `obj_description`/`col_description` ein und schlägt fehl,
  sobald eine fehlt. Ausgenommen sind nur `erstellt_am` und
  `geaendert_am`. Vorbild für Ton und Länge: `db/aufbau/0012_dokumentation.sql`
  — der Kommentar sagt, **wofür** die Spalte da ist oder **warum** sie so
  aussieht, nicht wie sie heißt. `comment on column velocity.mitarbeiter.auth_uid
  is 'Verknuepfung zur Anmeldung. Leer, solange sich die Person nie angemeldet hat.'`
  ist ein Kommentar; `is 'Die auth_uid'` ist keiner.
- **Row Level Security wird in derselben Datei eingeschaltet, die die
  Tabelle anlegt** — `enable` und `force`, auch wenn die Regeln erst
  später kommen. `test_s_rls_ueberall_aktiv` in
  `db/tests/t0011_sicherheit.sql` prüft das über alle Basistabellen
  hinweg. Eine Tabelle mit eingeschaltetem RLS und ohne Regel weist jeden
  Zugriff ab — das ist zwischen ihrer Anlage und Aufgabe 9 genau das
  richtige Verhalten.
- **Neue Geschäftsregeln GR16 bis GR22** sind in Abschnitt 4.4 der Spec definiert. Wer eine umsetzt, nennt sie im Kommentar beim Namen.
- **Commits:** deutschsprachige Nachrichten, Präfixe `feat:`, `fix:`, `docs:`, `test:`, `chore:`. Jede Aufgabe endet mit genau einem Commit. **Nicht pushen.**
- **Arbeitsverzeichnis:** der Worktree `…/BikesRental/Web/.worktrees/velocity-datenmodell`. Alle Pfade sind relativ dazu.
- **Erfundene Daten werden als erfunden gekennzeichnet.** Jede Datei, die Referenzdaten erzeugt, sagt das in ihrem Kopf, und der Lauf wird in `velocity.uebernahme_protokoll` festgehalten.

---

## Dateistruktur

| Datei | Verantwortung |
|---|---|
| `db/aufbau/0001_schema_und_konventionen.sql` | **ändern:** fünf neue ENUM-Typen in die bestehende Werteliste |
| `db/aufbau/0005_bereich_d_nutzung.sql` | **ändern:** Spalte `ausleihe.distanz_km` |
| `db/aufbau/0009_geschaeftslogik.sql` | **ändern:** Preislogik als `fn_ausleihe_abrechnen` herauslösen |
| `db/aufbau/0014_bereich_j_personal.sql` | `rolle`, `mitarbeiter`, `mitarbeiter_rolle` |
| `db/aufbau/0015_bereich_i_instandhaltung.sql` | `schadensmeldung`, `wartungsauftrag`, `fahrrad_ereignis` und der Trigger zu GR21 |
| `db/aufbau/0016_bereich_k_protokoll.sql` | `aenderungsprotokoll`, `rechenannahme`, generischer Protokolltrigger |
| `db/aufbau/0017_wawi_sicherheit.sql` | `ist_mitarbeiter`, `hat_rolle`, RLS-Regeln, Rechtevergabe |
| `db/aufbau/0018_wawi_sichten.sql` | die zehn `v_wawi_*`-Sichten und `fn_luftlinie_km` |
| `db/aufbau/0019_wawi_logik.sql` | die dreizehn `api_*`-Funktionen der Warenwirtschaft |
| `db/betrieb/referenzdaten_grundlage.sql` | Preisperioden und Tarifkonditionen des Referenzjahres, Mitgliedschaften, erster Mitarbeiter |
| `db/betrieb/referenzdaten_fahrten.sql` | rund 12 000 Fahrten samt Bepreisung, Radstatus angleichen |
| `db/betrieb/referenzdaten_rechnungen.sql` | Monatsrechnungen über das Referenzjahr |
| `db/tests/t0014_bereich_j.sql` … `t0019_wawi_logik.sql` | je eine Testdatei zur zugehörigen Aufbaudatei |
| `tools/abnahme.sh` | **ändern:** neue Prüfungen 19 bis 25 |
| `doku/datenmodell/erd/erd-wawi.mmd` | **ändern:** gebaute Bereiche vom Entwurf abgrenzen |

Die Sicherheitsfunktionen stehen **vor** den Sichten, nicht dahinter. Der
Grund steht in Aufgabe 9: PostgREST kennt nur eine Datenbankrolle
`authenticated` für Kunden *und* Mitarbeitende, deshalb filtert jede
`v_wawi_*`-Sicht selbst über `velocity.hat_rolle(...)`. Eine Sicht, die
diese Funktion aufruft, kann nicht vor ihr angelegt werden.

Reihenfolge der Nummern ist bindend: `db/run.py` wendet die Dateien sortiert an, und `0013_altsystem_abloesen.sql` muss vor den neuen Bereichen laufen.

---

## Aufgabe 1: Bereich J — Personal

**Dateien:**
- Ändern: `db/aufbau/0001_schema_und_konventionen.sql` (ENUM-Liste)
- Anlegen: `db/aufbau/0014_bereich_j_personal.sql`
- Test: `db/tests/t0014_bereich_j.sql`

**Schnittstellen:**
- Nutzt: `velocity.fn_audit_anhaengen(text)` aus `0001`
- Liefert: Tabellen `velocity.rolle (rolle_id, code, bezeichnung, beschreibung)`, `velocity.mitarbeiter (mitarbeiter_id, personalnummer, auth_uid, vorname, nachname, email, eingetreten_am, ausgetreten_am, status)`, `velocity.mitarbeiter_rolle (mitarbeiter_id, rolle_id)`; die vier Rollencodes `disposition`, `werkstatt`, `kundenservice`, `leitung`

- [ ] **Schritt 1: ENUM-Typen ergänzen**

In `db/aufbau/0001_schema_und_konventionen.sql` die bestehende Werteliste im `do`-Block um fünf Zeilen erweitern. Die Liste endet heute mit `('zahlung_status', array[...])`; dahinter ein Komma und die neuen Zeilen einfügen:

```sql
      ('zahlung_status',     array['offen','gebucht','fehlgeschlagen','erstattet']),
      -- Bereich J und I, Phase 2 (Warenwirtschaft)
      ('mitarbeiter_status', array['aktiv','beurlaubt','ausgeschieden']),
      ('schaden_schwere',    array['gering','mittel','fahruntauglich']),
      ('schaden_status',     array['offen','in_arbeit','behoben','verworfen']),
      ('auftrag_status',     array['offen','in_arbeit','erledigt','abgebrochen']),
      ('fahrrad_ereignisart',array['angeschafft','status_geaendert','gewartet','umgesetzt','ausgemustert'])
```

- [ ] **Schritt 2: Testdatei anlegen und den Fehlschlag sehen**

`db/tests/t0014_bereich_j.sql`:

```sql
-- =====================================================================
-- t0014 Bereich J: Personal
-- =====================================================================
create schema if not exists velocity_test;
set search_path = velocity_test, velocity, extensions, public;

create or replace function velocity_test.test_j_struktur()
returns setof text language plpgsql as $$
begin
  return next has_table('velocity'::name, 'rolle'::name,             'Tabelle rolle existiert');
  return next has_table('velocity'::name, 'mitarbeiter'::name,       'Tabelle mitarbeiter existiert');
  return next has_table('velocity'::name, 'mitarbeiter_rolle'::name, 'Tabelle mitarbeiter_rolle existiert');
  -- Die Zuordnung ist m:n. Eine Spalte rolle_id an mitarbeiter waere
  -- die 1:n-Variante aus dem alten ERD und wuerde Mehrfachrollen
  -- ueber Sammelrollen erzwingen - siehe Spec Abschnitt 1.
  return next hasnt_column('velocity'::name, 'mitarbeiter'::name, 'rolle_id'::name,
                           'mitarbeiter traegt keine einzelne rolle_id');
  return next col_is_pk('velocity'::name, 'mitarbeiter_rolle'::name,
                        array['mitarbeiter_id','rolle_id'],
                        'mitarbeiter_rolle hat einen zusammengesetzten Schluessel');
end;
$$;

create or replace function velocity_test.test_j_vier_rollen_stehen_bereit()
returns setof text language plpgsql as $$
begin
  return next results_eq(
    $q$ select code from velocity.rolle order by code $q$,
    $q$ values ('disposition'),('kundenservice'),('leitung'),('werkstatt') $q$,
    'Genau die vier fachlichen Rollen sind angelegt');
end;
$$;

create or replace function velocity_test.test_j_auth_uid_darf_fehlen()
returns setof text language plpgsql as $$
declare v_id bigint;
begin
  -- Ein Mitarbeiter wird angelegt, bevor er sich das erste Mal anmeldet.
  insert into velocity.mitarbeiter (personalnummer, vorname, nachname, email)
       values ('J-TEST-1', 'Jana', 'Test', 'j-test-1@example.org')
    returning mitarbeiter_id into v_id;
  return next ok(v_id is not null, 'Mitarbeiter ohne auth_uid ist anlegbar');
end;
$$;

create or replace function velocity_test.test_j_ausgeschieden_braucht_datum()
returns setof text language plpgsql as $$
begin
  insert into velocity.mitarbeiter (personalnummer, vorname, nachname, email)
       values ('J-TEST-2', 'Jens', 'Test', 'j-test-2@example.org');
  -- GR16 haengt daran, dass 'aktiv' etwas bedeutet. Ein Ausgeschiedener
  -- ohne Austrittsdatum waere ein Satz, dem man nicht ansieht, ab wann
  -- er nicht mehr gilt.
  return next throws_ok(
    $q$ update velocity.mitarbeiter set status = 'ausgeschieden'
         where personalnummer = 'J-TEST-2' $q$,
    '23514',
    null,
    'Status ausgeschieden ohne ausgetreten_am wird abgewiesen');
end;
$$;
```

- [ ] **Schritt 3: Test laufen lassen, Fehlschlag bestätigen**

```bash
python3 db/test.py db/tests/t0014_bereich_j.sql
```

Danach die beiden schemaweiten Prüfungen, die jede neue Tabelle betreffen:

```bash
python3 db/test.py db/tests/t0011_sicherheit.sql db/tests/t0012_dokumentation.sql
```
Erwartet: `test_s_rls_ueberall_aktiv` und `test_doku_vollstaendig` grün. Schlagen sie fehl, nennen sie die Tabelle oder Spalte, der RLS oder ein Kommentar fehlt.
Erwartet: Fehler, weil `velocity.rolle` nicht existiert.

- [ ] **Schritt 4: Aufbaudatei schreiben**

`db/aufbau/0014_bereich_j_personal.sql`:

```sql
-- =====================================================================
-- 0014 Bereich J: Personal
--
-- Zweck:      Wer die Warenwirtschaft bedienen darf, und wofuer. Ohne
--             diesen Bereich gibt es keine Mitarbeitenden - und damit
--             niemanden, den der Zugriffsschutz von einem Kunden
--             unterscheiden koennte.
-- Objekte:    velocity.rolle, velocity.mitarbeiter,
--             velocity.mitarbeiter_rolle
-- Ruecknahme: DROP TABLE velocity.mitarbeiter_rolle, velocity.mitarbeiter,
--             velocity.rolle;
-- =====================================================================

-- Fachliche Klassifikation mit eigener Beschreibung, deshalb Tabelle
-- statt ENUM: Rollen bekommen spaeter Rechte angehaengt, ein ENUM-Label
-- kann nichts tragen.
create table if not exists velocity.rolle (
  rolle_id     bigint generated always as identity primary key,
  code         text        not null,
  bezeichnung  text        not null,
  beschreibung text,
  erstellt_am  timestamptz not null default now(),
  geaendert_am timestamptz not null default now(),
  constraint rolle_code_uk unique (code)
);
select velocity.fn_audit_anhaengen('rolle');

create table if not exists velocity.mitarbeiter (
  mitarbeiter_id bigint generated always as identity primary key,
  personalnummer text        not null,
  -- Nullable: der Personalsatz entsteht bei der Einstellung, die
  -- Anmeldung erst danach. Dieselbe Trennung wie bei kunde.auth_uid.
  auth_uid       uuid,
  vorname        text        not null,
  nachname       text        not null,
  email          text        not null,
  eingetreten_am date        not null default current_date,
  ausgetreten_am date,
  status         velocity.mitarbeiter_status not null default 'aktiv',
  erstellt_am    timestamptz not null default now(),
  geaendert_am   timestamptz not null default now(),
  constraint mitarbeiter_personalnummer_uk unique (personalnummer),
  constraint mitarbeiter_auth_uid_uk       unique (auth_uid),
  constraint mitarbeiter_email_uk          unique (email),
  constraint mitarbeiter_email_chk
    check (email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  constraint mitarbeiter_austritt_chk
    check (ausgetreten_am is null or ausgetreten_am >= eingetreten_am),
  -- GR16 prueft den Status. Waere 'ausgeschieden' ohne Datum erlaubt,
  -- liesse sich nicht mehr feststellen, ab wann der Zugriff endete.
  constraint mitarbeiter_ausgeschieden_chk
    check (status <> 'ausgeschieden' or ausgetreten_am is not null)
);
select velocity.fn_audit_anhaengen('mitarbeiter');

-- m:n statt der 1:n-Variante aus dem alten ERD. Wer Werkstatt UND
-- Disposition macht, braeuchte sonst eine Sammelrolle - und bekaeme mit
-- ihr Rechte, die keine seiner beiden Aufgaben verlangt. Das
-- widerspricht Art. 5 Abs. 1 lit. c DSGVO (Datenminimierung).
create table if not exists velocity.mitarbeiter_rolle (
  mitarbeiter_id bigint      not null,
  rolle_id       bigint      not null,
  erstellt_am    timestamptz not null default now(),
  geaendert_am   timestamptz not null default now(),
  constraint mitarbeiter_rolle_pk primary key (mitarbeiter_id, rolle_id),
  -- cascade, nicht restrict: die Zuordnung hat ohne ihren Mitarbeiter
  -- keine eigene Bedeutung. Der Mitarbeitersatz selbst wird ohnehin
  -- nicht geloescht, sondern auf 'ausgeschieden' gesetzt.
  constraint mitarbeiter_rolle_mitarbeiter_fk foreign key (mitarbeiter_id)
    references velocity.mitarbeiter (mitarbeiter_id) on update cascade on delete cascade,
  constraint mitarbeiter_rolle_rolle_fk foreign key (rolle_id)
    references velocity.rolle (rolle_id) on update cascade on delete restrict
);
select velocity.fn_audit_anhaengen('mitarbeiter_rolle');

-- Die vier Rollen sind aus den Aufgaben abgeleitet, nicht aus der
-- Hierarchie. Eine Rolle 'Abteilungsleiter' saehe im Organigramm
-- richtig aus und sagte ueber Rechte nichts.
insert into velocity.rolle (code, bezeichnung, beschreibung) values
  ('disposition',   'Disposition',   'Flotte, Stationen, Radstatus'),
  ('werkstatt',     'Werkstatt',     'Schadensmeldungen und Wartungsauftraege'),
  ('kundenservice', 'Kundenservice', 'Kundenstammdaten, Sperren, Auskunft nach Art. 15 DSGVO'),
  ('leitung',       'Leitung',       'zusaetzlich Auswertungen und Mitarbeiterverwaltung')
on conflict (code) do update
  set bezeichnung  = excluded.bezeichnung,
      beschreibung = excluded.beschreibung;

comment on table velocity.mitarbeiter_rolle is
  'Zuordnung m:n. Abweichung vom Entwurf aus Phase 1, begruendet mit Datenminimierung.';
```

- [ ] **Schritt 5: Anwenden, Idempotenz prüfen, Tests laufen lassen**

```bash
python3 db/run.py db/aufbau/0001_schema_und_konventionen.sql db/aufbau/0014_bereich_j_personal.sql
```
Danach denselben Befehl **ein zweites Mal** — er muss wieder fehlerfrei durchlaufen.

```bash
python3 db/test.py db/tests/t0014_bereich_j.sql
```
Erwartet: alle vier Testfunktionen `ok`.

- [ ] **Schritt 6: Commit**

```bash
git add db/aufbau/0001_schema_und_konventionen.sql db/aufbau/0014_bereich_j_personal.sql db/tests/t0014_bereich_j.sql
git commit -m "feat(wawi): Bereich J - Personal mit Rollen als m:n-Zuordnung"
```

---

## Aufgabe 2: Bereich I — Instandhaltung

**Dateien:**
- Anlegen: `db/aufbau/0015_bereich_i_instandhaltung.sql`
- Test: `db/tests/t0015_bereich_i.sql`

**Schnittstellen:**
- Nutzt: `velocity.mitarbeiter (mitarbeiter_id)` aus Aufgabe 1, `velocity.fahrrad (fahrrad_id, status)`, `velocity.kunde (kunde_id)`
- Liefert: `velocity.schadensmeldung (schadensmeldung_id, fahrrad_id, gemeldet_am, melder_kunde_id, melder_mitarbeiter_id, kategorie, beschreibung, schwere, status)`, `velocity.wartungsauftrag (wartungsauftrag_id, auftragsnummer, fahrrad_id, schadensmeldung_id, mitarbeiter_id, eroeffnet_am, erledigt_am, status, arbeitszeit_minuten, bemerkung)`, `velocity.fahrrad_ereignis (ereignis_id, fahrrad_id, zeitpunkt, ereignisart, mitarbeiter_id, bemerkung, beleg_tabelle, beleg_id)`; Trigger `trg_fahrrad_ereignis` auf `velocity.fahrrad`

- [ ] **Schritt 1: Testdatei anlegen**

`db/tests/t0015_bereich_i.sql`:

```sql
-- =====================================================================
-- t0015 Bereich I: Instandhaltung
-- =====================================================================
create schema if not exists velocity_test;
set search_path = velocity_test, velocity, extensions, public;

-- Vorrichtung: ein Rad, an dem sich Schaeden melden lassen.
create or replace function velocity_test.fixture_wartungsrad(p_suffix text)
returns bigint language plpgsql as $$
declare v_typ bigint; v_h bigint; v_m bigint; v_f bigint;
begin
  insert into velocity.fahrradtyp (typ_code, bezeichnung)
       values ('I-' || p_suffix, 'Wartungstestrad ' || p_suffix) returning typ_id into v_typ;
  insert into velocity.hersteller (name) values ('Hersteller I ' || p_suffix)
    returning hersteller_id into v_h;
  insert into velocity.fahrradmodell (hersteller_id, typ_id, modellbezeichnung)
       values (v_h, v_typ, 'MI-' || p_suffix) returning modell_id into v_m;
  insert into velocity.fahrrad (rahmennummer, modell_id)
       values ('RN-I-' || p_suffix, v_m) returning fahrrad_id into v_f;
  return v_f;
end;
$$;

create or replace function velocity_test.test_i_struktur()
returns setof text language plpgsql as $$
begin
  return next has_table('velocity'::name, 'schadensmeldung'::name,  'Tabelle schadensmeldung existiert');
  return next has_table('velocity'::name, 'wartungsauftrag'::name,  'Tabelle wartungsauftrag existiert');
  return next has_table('velocity'::name, 'fahrrad_ereignis'::name, 'Tabelle fahrrad_ereignis existiert');
  -- wartungsposition braucht Artikel aus Bereich G. Ohne Lager waere
  -- sie eine Tabelle, die auf nichts zeigt - Spec Abschnitt 1.
  return next hasnt_table('velocity'::name, 'wartungsposition'::name,
                          'wartungsposition ist bewusst nicht gebaut');
end;
$$;

create or replace function velocity_test.test_i_genau_ein_melder()
returns setof text language plpgsql as $$
declare v_f bigint; v_k bigint;
begin
  v_f := velocity_test.fixture_wartungsrad('melder');
  insert into velocity.kunde (email, vorname, nachname)
       values ('i-melder@example.org', 'Ida', 'Test') returning kunde_id into v_k;

  return next lives_ok(
    format($q$ insert into velocity.schadensmeldung
                 (fahrrad_id, melder_kunde_id, kategorie, beschreibung, schwere)
               values (%s, %s, 'Bremse', 'Bremse greift nicht', 'fahruntauglich') $q$, v_f, v_k),
    'Meldung mit genau einem Melder wird angenommen');

  return next throws_ok(
    format($q$ insert into velocity.schadensmeldung
                 (fahrrad_id, kategorie, beschreibung, schwere)
               values (%s, 'Licht', 'Ohne Melder', 'gering') $q$, v_f),
    '23514', null,
    'Meldung ohne Melder wird abgewiesen');

  return next throws_ok(
    format($q$ insert into velocity.schadensmeldung
                 (fahrrad_id, melder_kunde_id, melder_mitarbeiter_id, kategorie, beschreibung, schwere)
               values (%s, %s, 1, 'Licht', 'Zwei Melder', 'gering') $q$, v_f, v_k),
    '23514', null,
    'Meldung mit zwei Meldern wird abgewiesen');
end;
$$;

create or replace function velocity_test.test_i_statuswechsel_wird_protokolliert()
returns setof text language plpgsql as $$
declare v_f bigint; v_n integer;
begin
  v_f := velocity_test.fixture_wartungsrad('ereignis');
  -- GR21: jede Statusaenderung eines Rades erzeugt ein Ereignis.
  update velocity.fahrrad set status = 'wartung' where fahrrad_id = v_f;
  select count(*) into v_n from velocity.fahrrad_ereignis
   where fahrrad_id = v_f and ereignisart = 'status_geaendert';
  return next is(v_n, 1, 'Statuswechsel erzeugt genau ein Ereignis');

  -- Ein UPDATE ohne Statuswechsel darf nichts erzeugen, sonst waere die
  -- Lebenslaufakte nach kurzer Zeit unlesbar.
  update velocity.fahrrad set rahmennummer = rahmennummer || 'x' where fahrrad_id = v_f;
  select count(*) into v_n from velocity.fahrrad_ereignis where fahrrad_id = v_f;
  return next is(v_n, 1, 'Aenderung ohne Statuswechsel erzeugt kein Ereignis');
end;
$$;

create or replace function velocity_test.test_i_auftragsnummer_ist_eindeutig()
returns setof text language plpgsql as $$
declare v_f bigint;
begin
  v_f := velocity_test.fixture_wartungsrad('nummer');
  insert into velocity.wartungsauftrag (auftragsnummer, fahrrad_id)
       values ('WA-TEST-1', v_f);
  return next throws_ok(
    format($q$ insert into velocity.wartungsauftrag (auftragsnummer, fahrrad_id)
               values ('WA-TEST-1', %s) $q$, v_f),
    '23505', null,
    'Doppelte Auftragsnummer wird abgewiesen');
end;
$$;
```

- [ ] **Schritt 2: Test laufen lassen, Fehlschlag bestätigen**

```bash
python3 db/test.py db/tests/t0015_bereich_i.sql
```

Danach die beiden schemaweiten Prüfungen, die jede neue Tabelle betreffen:

```bash
python3 db/test.py db/tests/t0011_sicherheit.sql db/tests/t0012_dokumentation.sql
```
Erwartet: `test_s_rls_ueberall_aktiv` und `test_doku_vollstaendig` grün. Schlagen sie fehl, nennen sie die Tabelle oder Spalte, der RLS oder ein Kommentar fehlt.
Erwartet: Fehler, weil `velocity.schadensmeldung` nicht existiert.

- [ ] **Schritt 3: Aufbaudatei schreiben**

`db/aufbau/0015_bereich_i_instandhaltung.sql`:

```sql
-- =====================================================================
-- 0015 Bereich I: Instandhaltung
--
-- Zweck:      Der Weg eines Schadens vom Melden bis zur Behebung, und
--             die Lebenslaufakte eines Rades. Ohne diesen Bereich waere
--             "Status aendern" in der Warenwirtschaft ein Auswahlfeld
--             ohne Anlass und ohne Spur.
-- Objekte:    velocity.schadensmeldung, velocity.wartungsauftrag,
--             velocity.fahrrad_ereignis, velocity.fn_fahrrad_ereignis,
--             Trigger trg_fahrrad_ereignis auf velocity.fahrrad
-- Ruecknahme: DROP TRIGGER trg_fahrrad_ereignis ON velocity.fahrrad;
--             DROP FUNCTION velocity.fn_fahrrad_ereignis();
--             DROP TABLE velocity.wartungsauftrag, velocity.schadensmeldung,
--             velocity.fahrrad_ereignis;
--
-- NICHT gebaut: wartungsposition. Sie verbindet einen Auftrag mit
-- verbauten Artikeln; ohne Bereich G (Beschaffung) und H (Lager) gibt
-- es keine Artikel, auf die sie zeigen koennte.
-- =====================================================================

create table if not exists velocity.schadensmeldung (
  schadensmeldung_id   bigint generated always as identity primary key,
  fahrrad_id           bigint      not null,
  gemeldet_am          timestamptz not null default now(),
  -- Beide nullable, aber genau einer gesetzt: eine Meldung kommt
  -- entweder von einem Kunden oder von einem Mitarbeiter. Ohne Melder
  -- laesst sich spaeter nicht nachfragen; mit zweien weiss niemand,
  -- wen er fragen soll.
  melder_kunde_id      bigint,
  melder_mitarbeiter_id bigint,
  kategorie            text        not null,
  beschreibung         text        not null,
  schwere              velocity.schaden_schwere not null,
  status               velocity.schaden_status  not null default 'offen',
  erstellt_am          timestamptz not null default now(),
  geaendert_am         timestamptz not null default now(),
  constraint schadensmeldung_melder_chk
    check ((melder_kunde_id is not null)::integer
         + (melder_mitarbeiter_id is not null)::integer = 1),
  constraint schadensmeldung_fahrrad_fk foreign key (fahrrad_id)
    references velocity.fahrrad (fahrrad_id) on update cascade on delete restrict,
  constraint schadensmeldung_kunde_fk foreign key (melder_kunde_id)
    references velocity.kunde (kunde_id) on update cascade on delete restrict,
  constraint schadensmeldung_mitarbeiter_fk foreign key (melder_mitarbeiter_id)
    references velocity.mitarbeiter (mitarbeiter_id) on update cascade on delete restrict
);
select velocity.fn_audit_anhaengen('schadensmeldung');

create index if not exists schadensmeldung_offen_idx
  on velocity.schadensmeldung (fahrrad_id) where status in ('offen', 'in_arbeit');

create table if not exists velocity.wartungsauftrag (
  wartungsauftrag_id bigint generated always as identity primary key,
  auftragsnummer     text        not null,
  fahrrad_id         bigint      not null,
  -- Nullable: eine Inspektion hat keinen Schaden als Anlass.
  schadensmeldung_id bigint,
  -- Nullable: ein Auftrag kann offen liegen, bevor ihn jemand annimmt.
  mitarbeiter_id     bigint,
  eroeffnet_am       timestamptz not null default now(),
  erledigt_am        timestamptz,
  status             velocity.auftrag_status not null default 'offen',
  arbeitszeit_minuten integer,
  bemerkung          text,
  erstellt_am        timestamptz not null default now(),
  geaendert_am       timestamptz not null default now(),
  constraint wartungsauftrag_nummer_uk unique (auftragsnummer),
  constraint wartungsauftrag_zeitfolge_chk
    check (erledigt_am is null or erledigt_am >= eroeffnet_am),
  constraint wartungsauftrag_erledigt_chk
    check (status <> 'erledigt' or erledigt_am is not null),
  constraint wartungsauftrag_arbeitszeit_chk
    check (arbeitszeit_minuten is null or arbeitszeit_minuten >= 0),
  constraint wartungsauftrag_fahrrad_fk foreign key (fahrrad_id)
    references velocity.fahrrad (fahrrad_id) on update cascade on delete restrict,
  constraint wartungsauftrag_schaden_fk foreign key (schadensmeldung_id)
    references velocity.schadensmeldung (schadensmeldung_id) on update cascade on delete restrict,
  constraint wartungsauftrag_mitarbeiter_fk foreign key (mitarbeiter_id)
    references velocity.mitarbeiter (mitarbeiter_id) on update cascade on delete restrict
);
select velocity.fn_audit_anhaengen('wartungsauftrag');

-- Die Lebenslaufakte. beleg_tabelle und beleg_id zeigen auf den
-- ausloesenden Vorgang, ohne fuer jede moegliche Quelle einen eigenen
-- Fremdschluessel zu brauchen. Der Preis dafuer ist, dass die Datenbank
-- diesen Verweis nicht prueft - deshalb steht er hier bewusst nur als
-- Spur, nie als tragende Beziehung.
create table if not exists velocity.fahrrad_ereignis (
  ereignis_id    bigint generated always as identity primary key,
  fahrrad_id     bigint      not null,
  zeitpunkt      timestamptz not null default now(),
  ereignisart    velocity.fahrrad_ereignisart not null,
  mitarbeiter_id bigint,
  bemerkung      text,
  beleg_tabelle  text,
  beleg_id       bigint,
  erstellt_am    timestamptz not null default now(),
  geaendert_am   timestamptz not null default now(),
  constraint fahrrad_ereignis_beleg_chk
    check ((beleg_tabelle is null) = (beleg_id is null)),
  constraint fahrrad_ereignis_fahrrad_fk foreign key (fahrrad_id)
    references velocity.fahrrad (fahrrad_id) on update cascade on delete cascade,
  constraint fahrrad_ereignis_mitarbeiter_fk foreign key (mitarbeiter_id)
    references velocity.mitarbeiter (mitarbeiter_id) on update cascade on delete restrict
);
select velocity.fn_audit_anhaengen('fahrrad_ereignis');

create index if not exists fahrrad_ereignis_rad_zeit_idx
  on velocity.fahrrad_ereignis (fahrrad_id, zeitpunkt desc);

-- GR21: jede Statusaenderung eines Rades erzeugt ein Ereignis. Der
-- Trigger sitzt an der Tabelle, nicht in der api_-Funktion - sonst
-- entstuende die Luecke genau dann, wenn jemand am Frontend vorbei
-- arbeitet.
create or replace function velocity.fn_fahrrad_ereignis()
returns trigger
language plpgsql
security definer
set search_path = velocity, pg_temp
as $$
declare
  v_mitarbeiter bigint;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;
  select m.mitarbeiter_id into v_mitarbeiter
    from velocity.mitarbeiter m where m.auth_uid = auth.uid();
  insert into velocity.fahrrad_ereignis
         (fahrrad_id, ereignisart, mitarbeiter_id, bemerkung, beleg_tabelle, beleg_id)
  values (new.fahrrad_id,
          case when new.status = 'ausgemustert'
               then 'ausgemustert'::velocity.fahrrad_ereignisart
               else 'status_geaendert'::velocity.fahrrad_ereignisart end,
          v_mitarbeiter,
          format('%s -> %s', old.status, new.status),
          'fahrrad', new.fahrrad_id);
  return new;
end;
$$;

drop trigger if exists trg_fahrrad_ereignis on velocity.fahrrad;
create trigger trg_fahrrad_ereignis
  after update of status on velocity.fahrrad
  for each row execute function velocity.fn_fahrrad_ereignis();

comment on table velocity.fahrrad_ereignis is
  'Lebenslaufakte eines Rades. beleg_tabelle/beleg_id sind eine Spur, keine gepruefte Beziehung.';
```

- [ ] **Schritt 4: Anwenden, Idempotenz prüfen, Tests laufen lassen**

```bash
python3 db/run.py db/aufbau/0015_bereich_i_instandhaltung.sql
```
Denselben Befehl **ein zweites Mal** laufen lassen — muss fehlerfrei durchlaufen.

```bash
python3 db/test.py db/tests/t0015_bereich_i.sql
```
Erwartet: alle vier Testfunktionen `ok`.

- [ ] **Schritt 5: Bestehende Tests gegenprüfen**

Der neue Trigger sitzt auf `velocity.fahrrad` und feuert in fremden Tests mit. Deshalb die ganze Kette laufen lassen:

```bash
python3 db/test.py
```
Erwartet: keine neuen Fehlschläge gegenüber vorher.

- [ ] **Schritt 6: Commit**

```bash
git add db/aufbau/0015_bereich_i_instandhaltung.sql db/tests/t0015_bereich_i.sql
git commit -m "feat(wawi): Bereich I - Instandhaltung mit Lebenslaufakte je Rad"
```

---

## Aufgabe 3: Bereich K — Protokoll und Rechenannahmen

**Dateien:**
- Anlegen: `db/aufbau/0016_bereich_k_protokoll.sql`
- Test: `db/tests/t0016_bereich_k.sql`

**Schnittstellen:**
- Nutzt: `velocity.mitarbeiter (mitarbeiter_id, auth_uid)` aus Aufgabe 1
- Liefert: `velocity.aenderungsprotokoll (protokoll_id, zeitpunkt, mitarbeiter_id, tabelle, datensatz_id, aktion, feld, wert_alt, wert_neu)`, `velocity.rechenannahme (annahme_id, code, wert, einheit, gueltigkeit, quelle, erlaeuterung)`, `velocity.fn_protokoll_anhaengen(p_tabelle text, p_schluessel text)`, die Codes `co2_pkw`, `co2_ebike`, `co2_rad`, `umwegfaktor`

- [ ] **Schritt 1: Testdatei anlegen**

`db/tests/t0016_bereich_k.sql`:

```sql
-- =====================================================================
-- t0016 Bereich K: Protokoll und Rechenannahmen
-- =====================================================================
create schema if not exists velocity_test;
set search_path = velocity_test, velocity, extensions, public;

create or replace function velocity_test.test_k_struktur()
returns setof text language plpgsql as $$
begin
  return next has_table('velocity'::name, 'aenderungsprotokoll'::name,
                        'Tabelle aenderungsprotokoll existiert');
  return next has_table('velocity'::name, 'rechenannahme'::name,
                        'Tabelle rechenannahme existiert');
end;
$$;

create or replace function velocity_test.test_k_protokoll_je_feld()
returns setof text language plpgsql as $$
declare v_k bigint; v_n integer;
begin
  insert into velocity.kunde (email, vorname, nachname)
       values ('k-protokoll@example.org', 'Karl', 'Test') returning kunde_id into v_k;
  delete from velocity.aenderungsprotokoll where tabelle = 'kunde' and datensatz_id = v_k;

  update velocity.kunde set vorname = 'Karla', telefon = '0931 1234'
   where kunde_id = v_k;

  -- GR19: eine Zeile je GEAENDERTEM Feld. Feldweise statt als
  -- JSON-Klumpen, damit die Frage "wer hat je die E-Mail dieses Kunden
  -- geaendert" ohne Werkzeug beantwortbar bleibt.
  select count(*) into v_n from velocity.aenderungsprotokoll
   where tabelle = 'kunde' and datensatz_id = v_k;
  return next is(v_n, 2, 'Zwei geaenderte Felder ergeben zwei Protokollzeilen');

  return next results_eq(
    format($q$ select feld, wert_alt, wert_neu from velocity.aenderungsprotokoll
                where tabelle = 'kunde' and datensatz_id = %s and feld = 'vorname' $q$, v_k),
    $q$ values ('vorname', 'Karl', 'Karla') $q$,
    'Alter und neuer Wert stehen im Protokoll');
end;
$$;

create or replace function velocity_test.test_k_zeitstempel_nicht_protokolliert()
returns setof text language plpgsql as $$
declare v_k bigint; v_n integer;
begin
  insert into velocity.kunde (email, vorname, nachname)
       values ('k-stempel@example.org', 'Kim', 'Test') returning kunde_id into v_k;
  delete from velocity.aenderungsprotokoll where tabelle = 'kunde' and datensatz_id = v_k;
  update velocity.kunde set vorname = 'Kimi' where kunde_id = v_k;
  -- geaendert_am aendert sich bei JEDEM Update. Stuende es im Protokoll,
  -- verdoppelte es jede Zeile ohne einen einzigen Erkenntnisgewinn.
  select count(*) into v_n from velocity.aenderungsprotokoll
   where tabelle = 'kunde' and datensatz_id = v_k and feld in ('erstellt_am','geaendert_am');
  return next is(v_n, 0, 'Audit-Zeitstempel stehen nicht im Aenderungsprotokoll');
end;
$$;

create or replace function velocity_test.test_k_annahmen_ueberschneiden_sich_nicht()
returns setof text language plpgsql as $$
begin
  return next throws_ok(
    $q$ insert into velocity.rechenannahme (code, wert, einheit, gueltigkeit, quelle)
        values ('co2_pkw', 999, 'g/km', daterange(date '2020-01-01', null, '[)'), 'Test') $q$,
    '23P01', null,
    'Ueberschneidende Gueltigkeit derselben Annahme wird abgewiesen');
end;
$$;

create or replace function velocity_test.test_k_annahmen_sind_gesetzt()
returns setof text language plpgsql as $$
begin
  return next results_eq(
    $q$ select code from velocity.rechenannahme where upper_inf(gueltigkeit) order by code $q$,
    $q$ values ('co2_ebike'),('co2_pkw'),('co2_rad'),('umwegfaktor') $q$,
    'Alle vier Rechenannahmen haben eine laufende Periode');
  -- Nicht pruefen, dass keine Zeile ohne Quelle DA ist - das kann keine
  -- sein, quelle ist not null mit CHECK. Pruefen, dass eine solche Zeile
  -- gar nicht erst hineinkommt. Sonst waere die Zusicherung immer wahr.
  return next throws_ok(
    $q$ insert into velocity.rechenannahme (code, wert, einheit, gueltigkeit, quelle)
        values ('test_ohne_quelle', 1, 'x',
                daterange(date '1999-01-01', date '1999-02-01', '[)'), '   ') $q$,
    '23514', null,
    'Eine Annahme ohne Quelle wird abgewiesen');
end;
$$;

create or replace function velocity_test.test_k_protokoll_bei_insert_und_delete()
returns setof text language plpgsql as $$
declare v_k bigint; v_n integer;
begin
  -- Der Trigger ist generisch und faengt alle drei Operationen ab. Bisher
  -- war nur UPDATE geprueft - ausgerechnet bei INSERT und DELETE steht in
  -- fn_protokoll_schreiben aber die heikle Stelle: eine der beiden
  -- jsonb-Seiten ist leer, und v_id muss trotzdem gefunden werden.
  insert into velocity.kunde (email, vorname, nachname)
       values ('k-insert@example.org', 'Kai', 'Test') returning kunde_id into v_k;
  select count(*) into v_n from velocity.aenderungsprotokoll
   where tabelle = 'kunde' and datensatz_id = v_k and aktion = 'INSERT';
  return next cmp_ok(v_n, '>', 0, 'Ein INSERT wird protokolliert');
  return next is(
    (select wert_alt from velocity.aenderungsprotokoll
      where tabelle = 'kunde' and datensatz_id = v_k
        and aktion = 'INSERT' and feld = 'vorname'),
    null, 'Beim INSERT gibt es keinen alten Wert');

  delete from velocity.kunde where kunde_id = v_k;
  select count(*) into v_n from velocity.aenderungsprotokoll
   where tabelle = 'kunde' and datensatz_id = v_k and aktion = 'DELETE';
  return next cmp_ok(v_n, '>', 0,
    'Ein DELETE wird protokolliert - der Satz ist weg, die Spur bleibt');
end;
$$;
```

- [ ] **Schritt 2: Test laufen lassen, Fehlschlag bestätigen**

```bash
python3 db/test.py db/tests/t0016_bereich_k.sql
```

Danach die beiden schemaweiten Prüfungen, die jede neue Tabelle betreffen:

```bash
python3 db/test.py db/tests/t0011_sicherheit.sql db/tests/t0012_dokumentation.sql
```
Erwartet: `test_s_rls_ueberall_aktiv` und `test_doku_vollstaendig` grün. Schlagen sie fehl, nennen sie die Tabelle oder Spalte, der RLS oder ein Kommentar fehlt.
Erwartet: Fehler, weil `velocity.aenderungsprotokoll` nicht existiert.

- [ ] **Schritt 3: Aufbaudatei schreiben**

`db/aufbau/0016_bereich_k_protokoll.sql`:

```sql
-- =====================================================================
-- 0016 Bereich K: Protokoll und Rechenannahmen
--
-- Zweck:      Zwei Dinge, die es in Phase 1 nicht gab und die eine
--             Warenwirtschaft braucht: eine Spur, wer welchen Wert
--             geaendert hat (Art. 5 Abs. 2 DSGVO, Rechenschaftspflicht),
--             und ein Ort fuer die Zahlen, die eine Auswertung ANNIMMT
--             statt sie zu messen.
-- Objekte:    velocity.aenderungsprotokoll, velocity.rechenannahme,
--             velocity.fn_protokoll_schreiben,
--             velocity.fn_protokoll_anhaengen
-- Ruecknahme: DROP FUNCTION velocity.fn_protokoll_anhaengen(text, text);
--             DROP FUNCTION velocity.fn_protokoll_schreiben();
--             DROP TABLE velocity.aenderungsprotokoll, velocity.rechenannahme;
-- =====================================================================

create table if not exists velocity.aenderungsprotokoll (
  protokoll_id   bigint generated always as identity primary key,
  zeitpunkt      timestamptz not null default now(),
  -- Nullable: eine Aenderung kann aus einem Wartungsskript kommen, das
  -- unter keinem Benutzer laeuft. Dann steht null da, und das ist eine
  -- ehrlichere Angabe als ein erfundener Verursacher.
  mitarbeiter_id bigint,
  tabelle        text        not null,
  datensatz_id   bigint      not null,
  aktion         text        not null,
  feld           text        not null,
  wert_alt       text,
  wert_neu       text,
  erstellt_am    timestamptz not null default now(),
  geaendert_am   timestamptz not null default now(),
  constraint aenderungsprotokoll_aktion_chk check (aktion in ('INSERT','UPDATE','DELETE')),
  constraint aenderungsprotokoll_mitarbeiter_fk foreign key (mitarbeiter_id)
    references velocity.mitarbeiter (mitarbeiter_id) on update cascade on delete restrict
);
select velocity.fn_audit_anhaengen('aenderungsprotokoll');

create index if not exists aenderungsprotokoll_satz_idx
  on velocity.aenderungsprotokoll (tabelle, datensatz_id, zeitpunkt desc);

-- Jede Zahl, die eine Auswertung annimmt statt sie zu messen - mit
-- Quelle und Gueltigkeit. Sie gehoert in die Datenbank und nicht in den
-- Code: in dieser Fallstudie sind Zahlen schon dreimal auseinander
-- gelaufen, weil sie an zwei Stellen standen.
create table if not exists velocity.rechenannahme (
  annahme_id   bigint generated always as identity primary key,
  code         text        not null,
  wert         numeric(12,4) not null,
  einheit      text        not null,
  gueltigkeit  daterange   not null,
  quelle       text        not null,
  erlaeuterung text,
  erstellt_am  timestamptz not null default now(),
  geaendert_am timestamptz not null default now(),
  constraint rechenannahme_quelle_chk check (btrim(quelle) <> ''),
  -- Dieselbe Zeitscheibenlogik wie bei nutzungspreis: eine Annahme darf
  -- sich aendern, aber zu jedem Tag darf es hoechstens eine geben.
  constraint rechenannahme_zeitraum_ex
    exclude using gist (code with =, gueltigkeit with &&)
);
select velocity.fn_audit_anhaengen('rechenannahme');

-- Generischer Protokolltrigger. tg_argv[0] traegt den Namen der
-- Schluesselspalte, weil sie je Tabelle anders heisst.
create or replace function velocity.fn_protokoll_schreiben()
returns trigger
language plpgsql
security definer
set search_path = velocity, pg_temp
as $$
declare
  v_alt  jsonb := case when tg_op = 'INSERT' then '{}'::jsonb else to_jsonb(old) end;
  v_neu  jsonb := case when tg_op = 'DELETE' then '{}'::jsonb else to_jsonb(new) end;
  v_id   bigint;
  v_ma   bigint;
  v_feld text;
begin
  v_id := coalesce((v_neu ->> tg_argv[0])::bigint, (v_alt ->> tg_argv[0])::bigint);
  select m.mitarbeiter_id into v_ma
    from velocity.mitarbeiter m where m.auth_uid = auth.uid();

  for v_feld in
    select key from jsonb_object_keys(v_alt || v_neu) as t(key)
     -- erstellt_am und geaendert_am aendern sich bei jedem Update und
     -- wuerden das Protokoll verdoppeln, ohne etwas zu erzaehlen.
     where key not in ('erstellt_am', 'geaendert_am')
  loop
    if (v_alt -> v_feld) is distinct from (v_neu -> v_feld) then
      insert into velocity.aenderungsprotokoll
             (mitarbeiter_id, tabelle, datensatz_id, aktion, feld, wert_alt, wert_neu)
      values (v_ma, tg_table_name, v_id, tg_op, v_feld,
              v_alt ->> v_feld, v_neu ->> v_feld);
    end if;
  end loop;
  return coalesce(new, old);
end;
$$;

-- Haengt das Protokoll an eine Tabelle - dasselbe Muster wie
-- fn_audit_anhaengen, damit spaetere Tabellen es mit einer Zeile
-- bekommen.
create or replace function velocity.fn_protokoll_anhaengen(
  p_tabelle text, p_schluessel text
)
returns void
language plpgsql
as $$
begin
  execute format('drop trigger if exists trg_%1$s_protokoll on velocity.%1$I', p_tabelle);
  execute format(
    'create trigger trg_%1$s_protokoll after insert or update or delete on velocity.%1$I '
    'for each row execute function velocity.fn_protokoll_schreiben(%2$L)',
    p_tabelle, p_schluessel);
end;
$$;

-- GR19: Kundenstammdaten werden protokolliert. Weitere Tabellen kommen
-- in Aufgabe 12 dazu, wenn die schreibenden Funktionen stehen.
select velocity.fn_protokoll_anhaengen('kunde', 'kunde_id');

-- Die Vergleichswerte. Zahlen fuer Deutschland, gerundet; sie dienen
-- der Groessenordnung, nicht der Bilanz.
-- Kein "on conflict on constraint": ON CONFLICT arbeitet nur mit
-- eindeutigen Indizes, nicht mit EXCLUDE-Constraints. Die Idempotenz
-- kommt deshalb aus einem where not exists auf dieselbe Bedingung, die
-- der Constraint prueft.
insert into velocity.rechenannahme (code, wert, einheit, gueltigkeit, quelle, erlaeuterung)
select v.code, v.wert, v.einheit, v.gueltigkeit, v.quelle, v.erlaeuterung
  from (values
    ('co2_pkw',     140.0000, 'g CO2e/Pkm', daterange(date '2025-01-01', null, '[)'),
     'Umweltbundesamt, Vergleich der Verkehrsmittel, Stand 2024',
     'Durchschnittlicher Pkw im Personenverkehr, inkl. Vorkette'),
    ('co2_ebike',    12.0000, 'g CO2e/Pkm', daterange(date '2025-01-01', null, '[)'),
     'Umweltbundesamt, Vergleich der Verkehrsmittel, Stand 2024',
     'Pedelec inkl. Strom und Herstellung'),
    ('co2_rad',       5.0000, 'g CO2e/Pkm', daterange(date '2025-01-01', null, '[)'),
     'Umweltbundesamt, Vergleich der Verkehrsmittel, Stand 2024',
     'Fahrrad ohne Motor, im Wesentlichen Herstellung und Wartung'),
    ('umwegfaktor',   1.2500, 'Faktor',     daterange(date '2025-01-01', null, '[)'),
     'Annahme dieser Fallstudie, nicht gemessen',
     'Verhaeltnis der tatsaechlich gefahrenen Strecke zur Luftlinie im Stadtverkehr')
  ) as v(code, wert, einheit, gueltigkeit, quelle, erlaeuterung)
 where not exists (
   select 1 from velocity.rechenannahme r
    where r.code = v.code and r.gueltigkeit && v.gueltigkeit
 );

comment on table velocity.rechenannahme is
  'Zahlen, die eine Auswertung annimmt statt sie zu messen. Jede nennt ihre Quelle.';
comment on column velocity.rechenannahme.quelle is
  'Pflichtangabe. Eine Annahme ohne Herkunft ist eine Behauptung.';
```

- [ ] **Schritt 4: Anwenden, Idempotenz prüfen, Tests laufen lassen**

```bash
python3 db/run.py db/aufbau/0016_bereich_k_protokoll.sql
```
Denselben Befehl **ein zweites Mal** laufen lassen.

```bash
python3 db/test.py db/tests/t0016_bereich_k.sql
```
Erwartet: alle sechs Testfunktionen `ok`.

- [ ] **Schritt 5: Bestehende Tests gegenprüfen**

Der Protokolltrigger sitzt auf `velocity.kunde` und feuert in vielen fremden Tests mit:

```bash
python3 db/test.py
```
Erwartet: keine neuen Fehlschläge.

- [ ] **Schritt 6: Commit**

```bash
git add db/aufbau/0016_bereich_k_protokoll.sql db/tests/t0016_bereich_k.sql
git commit -m "feat(wawi): Bereich K - Aenderungsprotokoll und Rechenannahmen"
```

---

## Aufgabe 4: Gefahrene Strecke an der Ausleihe

**Dateien:**
- Ändern: `db/aufbau/0005_bereich_d_nutzung.sql` (Spalte anhängen)
- Test: `db/tests/t0005_bereich_d.sql` (eine Testfunktion ergänzen)

**Schnittstellen:**
- Liefert: Spalte `velocity.ausleihe.distanz_km numeric(8,2)`, nullable

- [ ] **Schritt 1: Test ergänzen**

Ans Ende von `db/tests/t0005_bereich_d.sql` anhängen:

```sql
create or replace function velocity_test.test_d_distanz_ist_optional()
returns setof text language plpgsql as $$
declare v_f record; v_a bigint;
begin
  return next has_column('velocity'::name, 'ausleihe'::name, 'distanz_km'::name,
                         'ausleihe traegt eine Distanz');
  return next col_is_null('velocity'::name, 'ausleihe'::name, 'distanz_km'::name,
                          'Die Distanz darf fehlen: null heisst nicht gemessen');

  select * into v_f from velocity_test.fixture_rad('distanz');
  -- Koordinaten statt Station: ausleihe_startort_chk verlangt GENAU eine
  -- Ortsangabe. Alle drei Felder null waere keine, und der Insert
  -- scheiterte am Constraint, bevor der Test etwas pruefen koennte.
  insert into velocity.ausleihe (kunde_id, fahrrad_id,
                                 start_latitude, start_longitude, startzeit)
       values (v_f.o_kunde_id, v_f.o_fahrrad_id, 49.79, 9.93,
               now() - interval '1 hour')
    returning ausleihe_id into v_a;

  -- Eine negative Strecke ist kein Messfehler, sondern ein Denkfehler.
  return next throws_ok(
    format($q$ update velocity.ausleihe set distanz_km = -1 where ausleihe_id = %s $q$, v_a),
    '23514', null,
    'Negative Distanz wird abgewiesen');
  return next lives_ok(
    format($q$ update velocity.ausleihe set distanz_km = 0 where ausleihe_id = %s $q$, v_a),
    'Null Kilometer sind erlaubt: eine Fahrt kann dort enden, wo sie begann');
end;
$$;
```

- [ ] **Schritt 2: Test laufen lassen, Fehlschlag bestätigen**

```bash
python3 db/test.py db/tests/t0005_bereich_d.sql
```
Erwartet: `test_d_distanz_ist_optional` schlägt fehl, weil die Spalte fehlt.

- [ ] **Schritt 3: Spalte anhängen**

In `db/aufbau/0005_bereich_d_nutzung.sql` **nach** dem `create table ... velocity.ausleihe (...)` und **vor** `select velocity.fn_audit_anhaengen('ausleihe');` einfügen. `alter table`, nicht in die Spaltenliste hinein: `create table if not exists` legt bei bestehender Tabelle nichts mehr an, eine neue Spalte in der Liste bliebe also in jeder existierenden Datenbank aus.

```sql
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
```

- [ ] **Schritt 4: Anwenden, Idempotenz prüfen, Test laufen lassen**

```bash
python3 db/run.py db/aufbau/0005_bereich_d_nutzung.sql
python3 db/run.py db/aufbau/0005_bereich_d_nutzung.sql
python3 db/test.py db/tests/t0005_bereich_d.sql
```
Erwartet: beide Läufe fehlerfrei, alle Testfunktionen `ok`.

- [ ] **Schritt 5: Commit**

```bash
git add db/aufbau/0005_bereich_d_nutzung.sql db/tests/t0005_bereich_d.sql
git commit -m "feat(wawi): ausleihe.distanz_km - gefahrene Strecke, nullable"
```

---

## Aufgabe 5: Preislogik als eigene Funktion herauslösen

**Warum:** `fn_ausleihe_beenden` setzt `endzeit = now()`. Damit lässt sich keine vergangene Fahrt abschließen — und ohne vergangene Fahrten gibt es kein Referenzjahr. Ein Parameter „so tun, als sei es damals" wäre ein Loch im Zugriffsschutz: ein Kunde könnte sich billiger rechnen. Die Trennung löst beides. Die neue Funktion **bepreist** eine bereits abgeschlossene Fahrt; sie entscheidet nicht, wann diese endete.

**Dateien:**
- Ändern: `db/aufbau/0009_geschaeftslogik.sql`
- Test: `db/tests/t0009_preisfindung.sql` (eine Testfunktion ergänzen)

**Schnittstellen:**
- Nutzt: `velocity.fn_position_anlegen(bigint, text, numeric, numeric, bigint, integer)`
- Liefert: `velocity.fn_ausleihe_abrechnen(p_ausleihe_id bigint) returns numeric` — legt die Entgeltpositionen an und gibt die Summe zurück
- Unverändert nach außen: `velocity.fn_ausleihe_beenden(bigint, bigint, bigint, numeric, numeric) returns table (gesamtbetrag numeric, dauer_minuten integer, meldung text)` und `velocity.api_ausleihe_beenden(...)`

- [ ] **Schritt 1: Gleichwertigkeitstest schreiben**

Ans Ende von `db/tests/t0009_preisfindung.sql` anhängen. Der Test vergleicht beide Wege am **selben** Sachverhalt: eine Fahrt über `fn_ausleihe_beenden`, eine baugleiche über `fn_ausleihe_abrechnen`.

```sql
create or replace function velocity_test.test_p_abrechnen_gleicht_beenden()
returns setof text language plpgsql as $$
declare
  v_f1 record; v_f2 record; v_a1 bigint; v_a2 bigint;
  v_summe1 numeric; v_summe2 numeric; v_station bigint;
begin
  select station_id into v_station from velocity.station order by station_id limit 1;

  -- Weg A: die Fahrt wird regulaer beendet.
  select * into v_f1 from velocity_test.fixture_rad('abr-a');
  insert into velocity.ausleihe (kunde_id, fahrrad_id, start_station_id, startzeit)
       values (v_f1.o_kunde_id, v_f1.o_fahrrad_id, v_station, now() - interval '37 minutes')
    returning ausleihe_id into v_a1;
  select gesamtbetrag into v_summe1
    from velocity.fn_ausleihe_beenden(v_f1.o_kunde_id, v_a1, v_station);

  -- Weg B: die Fahrt ist schon abgeschlossen und wird nur bepreist.
  select * into v_f2 from velocity_test.fixture_rad('abr-b');
  insert into velocity.ausleihe (kunde_id, fahrrad_id, start_station_id, startzeit,
                                 end_station_id, endzeit, status)
       values (v_f2.o_kunde_id, v_f2.o_fahrrad_id, v_station, now() - interval '37 minutes',
               v_station, now(), 'abgeschlossen')
    returning ausleihe_id into v_a2;
  v_summe2 := velocity.fn_ausleihe_abrechnen(v_a2);

  return next is(v_summe2, v_summe1,
                 'Beide Wege kommen auf denselben Betrag');
  return next results_eq(
    format($q$ select ea.code, ep.menge, ep.einzelbetrag, ep.betrag
                 from velocity.entgeltposition ep
                 join velocity.entgeltart ea using (entgeltart_id)
                where ep.ausleihe_id = %s order by ep.sortierung $q$, v_a2),
    format($q$ select ea.code, ep.menge, ep.einzelbetrag, ep.betrag
                 from velocity.entgeltposition ep
                 join velocity.entgeltart ea using (entgeltart_id)
                where ep.ausleihe_id = %s order by ep.sortierung $q$, v_a1),
    'Beide Wege erzeugen dieselben Positionen in derselben Reihenfolge');
end;
$$;

create or replace function velocity_test.test_p_abrechnen_weist_offene_fahrt_ab()
returns setof text language plpgsql as $$
declare v_f record; v_a bigint;
begin
  select * into v_f from velocity_test.fixture_rad('abr-offen');
  insert into velocity.ausleihe (kunde_id, fahrrad_id, start_station_id, startzeit)
       values (v_f.o_kunde_id, v_f.o_fahrrad_id, null, now() - interval '10 minutes')
    returning ausleihe_id into v_a;
  -- Eine laufende Fahrt hat noch keine Dauer. Sie zu bepreisen hiesse,
  -- eine Zahl zu erfinden.
  return next throws_ok(
    format($q$ select velocity.fn_ausleihe_abrechnen(%s) $q$, v_a),
    'P0001', null,
    'Eine noch laufende Fahrt wird nicht bepreist');
end;
$$;

create or replace function velocity_test.test_p_abrechnen_nur_einmal()
returns setof text language plpgsql as $$
declare v_f record; v_a bigint; v_station bigint;
begin
  select station_id into v_station from velocity.station order by station_id limit 1;
  select * into v_f from velocity_test.fixture_rad('abr-doppelt');
  insert into velocity.ausleihe (kunde_id, fahrrad_id, start_station_id, startzeit,
                                 end_station_id, endzeit, status)
       values (v_f.o_kunde_id, v_f.o_fahrrad_id, v_station, now() - interval '20 minutes',
               v_station, now(), 'abgeschlossen')
    returning ausleihe_id into v_a;
  perform velocity.fn_ausleihe_abrechnen(v_a);
  -- Zweimal abrechnen hiesse zweimal kassieren.
  return next throws_ok(
    format($q$ select velocity.fn_ausleihe_abrechnen(%s) $q$, v_a),
    'P0001', null,
    'Eine bereits bepreiste Fahrt wird nicht erneut bepreist');
end;
$$;
```

- [ ] **Schritt 2: Test laufen lassen, Fehlschlag bestätigen**

```bash
python3 db/test.py db/tests/t0009_preisfindung.sql
```
Erwartet: die drei neuen Funktionen schlagen fehl, weil `fn_ausleihe_abrechnen` nicht existiert.

- [ ] **Schritt 3: Die neue Funktion anlegen**

In `db/aufbau/0009_geschaeftslogik.sql` **vor** `create or replace function velocity.fn_ausleihe_beenden` einfügen. Der Rumpf wird aus `fn_ausleihe_beenden` **wörtlich übernommen**: alles ab `v_dauer := v_a.dauer_minuten;` bis einschließlich des `HOECHSTPREIS_KAPPUNG`-Blocks. Nicht umschreiben — der Gleichwertigkeitstest aus Schritt 1 prüft genau das.

```sql
-- Bepreist eine BEREITS abgeschlossene Fahrt. Herausgeloest aus
-- fn_ausleihe_beenden, weil dort endzeit = now() gesetzt wird und die
-- Funktion deshalb keine vergangene Fahrt abschliessen kann - fuer die
-- Referenzdaten (db/betrieb/referenzdaten_fahrten.sql) ist genau das
-- noetig. Ein Parameter "Endzeit frei waehlbar" an fn_ausleihe_beenden
-- waere die naheliegende Abkuerzung und zugleich ein Loch im
-- Zugriffsschutz: ein Kunde koennte sich billiger rechnen. Diese
-- Funktion bepreist nur; sie entscheidet nicht, wann die Fahrt endete.
--
-- Sie ist bewusst NICHT security definer und wird nicht an anon oder
-- authenticated freigegeben.
create or replace function velocity.fn_ausleihe_abrechnen(p_ausleihe_id bigint)
returns numeric
language plpgsql
set search_path = velocity, pg_temp
as $$
declare
  v_a           velocity.ausleihe%rowtype;
  v_typ         bigint;
  v_preis       velocity.nutzungspreis%rowtype;
  v_dauer       integer;
  v_periode     velocity.freiminuten_periode%rowtype;
  v_frei        integer := 0;
  v_rabatt      numeric(5,2) := 0;
  v_rabattwert  numeric(10,2);
  v_summe       numeric(10,2);
  v_ueberschuss numeric(10,2);
begin
  select * into v_a from velocity.ausleihe a
   where a.ausleihe_id = p_ausleihe_id for update;
  if not found then
    raise exception 'Ausleihe % nicht gefunden', p_ausleihe_id using errcode = 'P0001';
  end if;
  if v_a.endzeit is null then
    raise exception 'Ausleihe % ist noch nicht beendet', p_ausleihe_id using errcode = 'P0001';
  end if;
  if exists (select 1 from velocity.entgeltposition e where e.ausleihe_id = p_ausleihe_id) then
    raise exception 'Ausleihe % ist bereits abgerechnet', p_ausleihe_id using errcode = 'P0001';
  end if;

  -- ---- ab hier woertlich aus fn_ausleihe_beenden uebernommen --------
  v_dauer := v_a.dauer_minuten;
  -- ... (Preisermittlung nach GR5, Freiminuten, Rabatt, die fuenf
  --      fn_position_anlegen-Aufrufe, Kappung auf den Tageshoechstpreis)
  -- ---- Ende der uebernommenen Zeilen --------------------------------

  return v_summe;
end;
$$;
```

**Der Bearbeiter ersetzt den mit `...` markierten Bereich durch die Zeilen aus `fn_ausleihe_beenden`, unverändert.** Zur Kontrolle: die übernommenen Zeilen beginnen mit dem Kommentar `-- Geschaeftsregel GR5: Preis zum STARTzeitpunkt der Ausleihe` und enden mit `v_summe := v_preis.tageshoechstpreis; end if;`. Die beiden `update`-Anweisungen danach (`fahrrad` und `fahrrad_position`) gehören **nicht** dazu — sie betreffen den Verbleib des Rades, nicht den Preis.

- [ ] **Schritt 4: `fn_ausleihe_beenden` auf die neue Funktion umstellen**

In `fn_ausleihe_beenden` den nun doppelten Block durch einen Aufruf ersetzen. Aus

```sql
  v_dauer := v_a.dauer_minuten;
  -- Geschaeftsregel GR5: ... (der gesamte Preisblock)
  ...
    v_summe := v_preis.tageshoechstpreis;
  end if;

  update velocity.fahrrad set status = 'verfuegbar' where fahrrad_id = v_a.fahrrad_id;
```

wird

```sql
  v_dauer := v_a.dauer_minuten;
  -- Die Preisermittlung steht in fn_ausleihe_abrechnen, damit sie auch
  -- fuer bereits abgeschlossene Fahrten zur Verfuegung steht.
  v_summe := velocity.fn_ausleihe_abrechnen(p_ausleihe_id);

  update velocity.fahrrad set status = 'verfuegbar' where fahrrad_id = v_a.fahrrad_id;
```

Die nun unbenutzten Variablen `v_typ`, `v_preis`, `v_periode`, `v_frei`, `v_rabatt`, `v_rabattwert`, `v_ueberschuss` aus dem `declare`-Block von `fn_ausleihe_beenden` streichen. `v_a`, `v_dauer` und `v_summe` bleiben.

- [ ] **Schritt 5: Anwenden und Tests laufen lassen**

```bash
python3 db/run.py db/aufbau/0009_geschaeftslogik.sql
python3 db/run.py db/aufbau/0009_geschaeftslogik.sql
python3 db/test.py db/tests/t0009_preisfindung.sql
```
Erwartet: beide Läufe fehlerfrei, alle Testfunktionen `ok` — insbesondere `test_p_abrechnen_gleicht_beenden`.

- [ ] **Schritt 6: Ganze Testkette und Durchstich**

Die Umstellung berührt den zentralen Geschäftsvorfall. Deshalb beides:

```bash
python3 db/test.py
python3 db/durchstich.py
```
Erwartet: keine neuen Fehlschläge; der Durchstich meldet wie bisher.

- [ ] **Schritt 7: Commit**

```bash
git add db/aufbau/0009_geschaeftslogik.sql db/tests/t0009_preisfindung.sql
git commit -m "refactor(logik): Preisermittlung als fn_ausleihe_abrechnen herausgeloest"
```

---

## Aufgabe 6: Referenzdaten — Grundlage

**Warum:** Die Preishistorie beginnt heute am 22.08.2026. Fahrten davor haben an ihrem Starttag keinen gültigen Preis und lassen sich nicht abrechnen. Vor den Fahrten muss also die Grundlage stehen: Preise, Tarifkonditionen, Mitgliedschaften — und der erste Mitarbeiter, ohne den niemand einen zweiten anlegen kann.

**Dateien:**
- Anlegen: `db/betrieb/referenzdaten_grundlage.sql`
- Ändern: `db/betrieb/README.md` (die neue Datei eintragen)

**Schnittstellen:**
- Nutzt: `velocity.mitarbeiter`, `velocity.rolle`, `velocity.mitarbeiter_rolle` aus Aufgabe 1
- Liefert: Preisperioden `[2025-09-01, 2026-03-01)` und `[2026-03-01, 2026-08-22)` je Radtyp; rund 400 Mitgliedschaften mit `freiminuten_periode` je Monat; Mitarbeiter `M-0001`

- [ ] **Schritt 1: Die Datei schreiben**

`db/betrieb/referenzdaten_grundlage.sql`:

```sql
-- =====================================================================
--  REFERENZDATEN, TEIL 1: GRUNDLAGE
--
--  ACHTUNG: Diese Datei erzeugt ERFUNDENE Daten. Sie sind plausibel
--  gebaut, aber sie messen nichts. Kein Wert hier ist erhoben.
--
--  Anlass: die Auswertungen der Warenwirtschaft brauchen etwas zum
--  Auswerten. In velocity.ausleihe liegen 23 abgeschlossene Fahrten,
--  und keine einzige traegt eine Position aus der Preislogik - alle nur
--  den Pauschalbetrag BESTANDSUEBERNAHME aus dem Altsystem.
--
--  Diese Datei legt die Grundlage fuer das Referenzjahr
--  01.09.2025 bis 24.08.2026:
--
--    1. Preisperioden, die vor dem 22.08.2026 beginnen. Ohne sie
--       schlaegt fn_ausleihe_abrechnen mit "Kein gueltiger Preis" fehl.
--    2. Einen Preiswechsel zum 01.03.2026 - mit Absicht. Bisher zeigt
--       die Historisierung nur das Schema. Mit einem Wechsel mitten im
--       Referenzjahr wird sie in den Daten sichtbar: Fahrten davor
--       rechnen weiter mit dem alten Satz (GR5), und in der
--       Monatsauswertung ist der Sprung zu sehen.
--    3. Tarifkonditionen rueckwirkend ab 01.09.2025. Sie gelten heute
--       erst ab 22.08.2026; ohne Rueckdatierung gaebe es im ganzen
--       Referenzjahr weder Freiminuten noch Premium-Rabatt.
--    4. Rund 400 Mitgliedschaften. Heute haben 10 von 1014 Kunden eine
--       - eine Umsatzauswertung nach Kundengruppe waere damit leer.
--    5. Den ersten Mitarbeiter.
--
--  Idempotent: jeder Block prueft, ob er schon gelaufen ist.
--
--  Ruecknahme: siehe Block 6 am Dateiende (auskommentiert).
-- =====================================================================

begin;

-- ---- 1 und 2: Preisperioden des Referenzjahres ----------------------
-- Nur der Minutenpreis aendert sich zum 01.03.2026. Startgebuehr und
-- Tageshoechstpreis bleiben gleich - so haengt der sichtbare Sprung in
-- der Auswertung an genau einer Groesse und laesst sich nachrechnen.
--
-- Kein "on conflict": auf nutzungspreis liegt ein EXCLUDE-Constraint,
-- und ON CONFLICT arbeitet nur mit eindeutigen Indizes.
insert into velocity.nutzungspreis
       (typ_id, gueltigkeit, startgebuehr, preis_pro_minute, tageshoechstpreis)
select t.typ_id, p.zeitraum, p.startgebuehr, p.minute, p.hoechst
  from (values
    ('CITY',  daterange(date '2025-09-01', date '2026-03-01', '[)'), 0.10, 0.08, 10.00),
    ('EBIKE', daterange(date '2025-09-01', date '2026-03-01', '[)'), 1.00, 0.20, 15.00),
    ('CARGO', daterange(date '2025-09-01', date '2026-03-01', '[)'), 2.00, 0.40, 22.00),
    ('CITY',  daterange(date '2026-03-01', date '2026-08-22', '[)'), 0.10, 0.10, 10.00),
    ('EBIKE', daterange(date '2026-03-01', date '2026-08-22', '[)'), 1.00, 0.25, 15.00),
    ('CARGO', daterange(date '2026-03-01', date '2026-08-22', '[)'), 2.00, 0.50, 22.00)
  ) as p(typ_code, zeitraum, startgebuehr, minute, hoechst)
  join velocity.fahrradtyp t on t.typ_code = p.typ_code
 where not exists (
   select 1 from velocity.nutzungspreis np
    where np.typ_id = t.typ_id and np.gueltigkeit && p.zeitraum
 );

-- ---- 3: Tarifkonditionen rueckdatieren ------------------------------
-- Nicht eine zweite Periode einfuegen, sondern die bestehende nach
-- vorn oeffnen: die Konditionen haben sich nie geaendert. Eine zweite
-- Periode mit identischen Werten waere eine Aenderung, die es nie gab.
update velocity.tarif_kondition k
   set gueltigkeit = daterange(date '2025-09-01', upper(k.gueltigkeit), '[)')
 where lower(k.gueltigkeit) > date '2025-09-01';

-- ---- 4: Mitgliedschaften --------------------------------------------
do $$
declare
  c_anzahl constant integer := 400;
  v_neu    integer;
begin
  perform setseed(0.4711);

  -- Verteilung: die meisten fahren im Basistarif, Premium ist die
  -- Ausnahme. Eine Gleichverteilung ueber vier Tarife saehe in jeder
  -- Auswertung gleich langweilig aus.
  insert into velocity.mitgliedschaft (kunde_id, tarif_id, gueltigkeit)
  select k.kunde_id, t.tarif_id,
         daterange(date '2025-09-01'
                   + (floor(random() * 120))::integer, null, '[)')
    from (
      select kunde_id, random() as wurf
        from velocity.kunde
       where status = 'aktiv'
         and not exists (select 1 from velocity.mitgliedschaft m
                          where m.kunde_id = kunde.kunde_id)
       order by kunde_id
       limit c_anzahl
    ) k
    join lateral (
      select tarif_id from velocity.tarif
       where tarif_code = case
               when k.wurf < 0.55 then 'BASIS'
               when k.wurf < 0.80 then 'STUDENT'
               when k.wurf < 0.92 then 'OEPNV'
               else 'PREMIUM' end
    ) t on true;

  get diagnostics v_neu = row_count;
  raise notice 'Mitgliedschaften angelegt: %', v_neu;

  -- Freiminuten je Monat des Referenzjahres. Ohne sie hat der
  -- Studenten- und OEPNV-Tarif im Referenzjahr keinen Vorteil, und die
  -- Auswertung nach Kundengruppe zeigte nur den Premium-Rabatt.
  insert into velocity.freiminuten_periode
         (mitgliedschaft_id, jahr, monat, kontingent_minuten, verbraucht_minuten)
  select m.mitgliedschaft_id,
         extract(year  from d)::integer,
         extract(month from d)::integer,
         k.freiminuten_pro_monat,
         0
    from velocity.mitgliedschaft m
    join velocity.tarif_kondition k
      on k.tarif_id = m.tarif_id and upper_inf(k.gueltigkeit)
   cross join generate_series(date '2025-09-01', date '2026-08-01', interval '1 month') d
   where k.freiminuten_pro_monat > 0
     and m.gueltigkeit @> d::date
     and not exists (
       select 1 from velocity.freiminuten_periode p
        where p.mitgliedschaft_id = m.mitgliedschaft_id
          and p.jahr  = extract(year  from d)::integer
          and p.monat = extract(month from d)::integer
     );
end;
$$;

-- ---- 5: Der erste Mitarbeiter ---------------------------------------
-- Wer die Warenwirtschaft bedient, muss in mitarbeiter stehen. Der
-- erste Satz kann nicht ueber die Oberflaeche entstehen, weil deren
-- Anlegefunktion selbst Mitarbeiterrechte voraussetzt.
--
-- Die auth_uid gehoert zugleich Kunde 2334 - dieselbe Person ist Kunde
-- UND Mitarbeiter. Das ist Absicht und wird nicht aufgeloest: kunde und
-- mitarbeiter sind getrennte Saetze, die auf dieselbe Anmeldung zeigen.
-- Wer sich auf der Website anmeldet, ist Kunde; wer sich in der
-- Warenwirtschaft anmeldet, ist Mitarbeiter.
insert into velocity.mitarbeiter
       (personalnummer, auth_uid, vorname, nachname, email, eingetreten_am)
select 'M-0001', u.id, 'Robert', 'Butscher', u.email, date '2025-09-01'
  from auth.users u
 where u.email = 'swrobuts@googlemail.com'
   and not exists (select 1 from velocity.mitarbeiter m where m.personalnummer = 'M-0001');

-- Alle vier Rollen: er ist vorerst der einzige. Sobald weitere
-- Mitarbeitende dazukommen, wird das aufgeteilt - eine Person mit allen
-- Rechten ist ein Uebergangszustand, kein Zielbild.
insert into velocity.mitarbeiter_rolle (mitarbeiter_id, rolle_id)
select m.mitarbeiter_id, r.rolle_id
  from velocity.mitarbeiter m cross join velocity.rolle r
 where m.personalnummer = 'M-0001'
on conflict (mitarbeiter_id, rolle_id) do nothing;

-- ---- Nachweis im Uebernahmeprotokoll --------------------------------
insert into velocity.uebernahme_protokoll
       (lauf, quelle, ziel, gelesen, geschrieben, uebersprungen, hinweis)
select now(), 'Referenzdaten (erzeugt)',
       'velocity.nutzungspreis, velocity.mitgliedschaft, velocity.freiminuten_periode, velocity.mitarbeiter',
       0,
       (select count(*) from velocity.mitgliedschaft),
       0,
       'ERFUNDENE Daten fuer die Lehre, nicht erhoben. Preisperioden ab 2025-09-01 '
       'mit einem Wechsel des Minutenpreises zum 2026-03-01; Tarifkonditionen '
       'rueckdatiert; rund 400 Mitgliedschaften; erster Mitarbeiter M-0001.'
 where not exists (
   select 1 from velocity.uebernahme_protokoll
    where quelle = 'Referenzdaten (erzeugt)'
      and ziel like 'velocity.nutzungspreis%'
 );

commit;

-- ---- Kontrolle -------------------------------------------------------
do $$
declare v_fehler integer; v_zahl integer;
begin
  -- Jeder Tag des Referenzjahres hat je Radtyp genau einen Preis.
  select count(*) into v_fehler
    from velocity.fahrradtyp t
   cross join generate_series(date '2025-09-01', date '2026-08-24', interval '1 day') d
   where (select count(*) from velocity.nutzungspreis p
           where p.typ_id = t.typ_id and p.gueltigkeit @> d::date) <> 1;
  if v_fehler > 0 then
    raise exception 'Preisluecke oder -ueberschneidung an % Tag/Typ-Paaren', v_fehler;
  end if;

  -- Der Wechsel zum 01.03.2026 ist wirklich einer.
  if (select preis_pro_minute from velocity.nutzungspreis p
        join velocity.fahrradtyp t using (typ_id)
       where t.typ_code = 'CITY' and p.gueltigkeit @> date '2026-02-28')
     = (select preis_pro_minute from velocity.nutzungspreis p
          join velocity.fahrradtyp t using (typ_id)
         where t.typ_code = 'CITY' and p.gueltigkeit @> date '2026-03-01') then
    raise exception 'Der Preiswechsel zum 01.03.2026 ist keiner';
  end if;

  select count(*) into v_zahl from velocity.mitgliedschaft;
  if v_zahl < 300 then
    raise exception 'Zu wenige Mitgliedschaften: %', v_zahl;
  end if;

  if not exists (select 1 from velocity.mitarbeiter m
                   join velocity.mitarbeiter_rolle mr using (mitarbeiter_id)
                  where m.personalnummer = 'M-0001'
                  group by m.mitarbeiter_id having count(*) = 4) then
    raise exception 'Mitarbeiter M-0001 fehlt oder hat nicht alle vier Rollen';
  end if;

  raise notice 'Grundlage steht: % Mitgliedschaften, Preise ab 2025-09-01', v_zahl;
end;
$$;

-- ---- Ruecknahme ------------------------------------------------------
-- delete from velocity.freiminuten_periode
--  where mitgliedschaft_id in (select mitgliedschaft_id from velocity.mitgliedschaft
--                               where lower(gueltigkeit) >= date '2025-09-01');
-- delete from velocity.mitgliedschaft where lower(gueltigkeit) >= date '2025-09-01';
-- delete from velocity.nutzungspreis where upper(gueltigkeit) <= date '2026-08-22';
-- delete from velocity.mitarbeiter_rolle where mitarbeiter_id in
--   (select mitarbeiter_id from velocity.mitarbeiter where personalnummer = 'M-0001');
-- delete from velocity.mitarbeiter where personalnummer = 'M-0001';
```

- [ ] **Schritt 2: Anwenden**

```bash
python3 db/run.py db/betrieb/referenzdaten_grundlage.sql
```
Erwartet: die vier `notice`-Zeilen, kein `exception`.

- [ ] **Schritt 3: Idempotenz prüfen**

```bash
python3 db/run.py db/betrieb/referenzdaten_grundlage.sql
```
Erwartet: läuft erneut fehlerfrei durch und legt **nichts** zusätzlich an. Gegenprobe:

```bash
python3 -c "
import os,psycopg
for z in open('.env',encoding='utf-8'):
    z=z.strip()
    if z and not z.startswith('#') and '=' in z:
        k,v=z.split('=',1); os.environ.setdefault(k,v)
c=psycopg.connect(host=os.environ['PGHOST'],port=os.environ['PGPORT'],dbname=os.environ['PGDATABASE'],
                  user=os.environ['PGUSER'],password=os.environ['PGPASSWORD']).cursor()
for t in ['nutzungspreis','mitgliedschaft','freiminuten_periode','mitarbeiter']:
    c.execute(f'select count(*) from velocity.{t}'); print(t, c.fetchone()[0])
"
```
Die Zahlen müssen denen nach dem ersten Lauf entsprechen.

- [ ] **Schritt 4: `db/betrieb/README.md` ergänzen**

Die drei Referenzdatendateien in die dortige Übersicht aufnehmen, mit dem Hinweis, dass sie in der Reihenfolge `grundlage` → `fahrten` → `rechnungen` laufen müssen und **erfundene** Daten erzeugen.

- [ ] **Schritt 5: Commit**

```bash
git add db/betrieb/referenzdaten_grundlage.sql db/betrieb/README.md
git commit -m "feat(referenz): Grundlage des Referenzjahres - Preise, Tarife, Mitgliedschaften, erster Mitarbeiter"
```

---

## Aufgabe 7: Referenzdaten — Fahrten

**Dateien:**
- Anlegen: `db/betrieb/referenzdaten_fahrten.sql`

**Schnittstellen:**
- Nutzt: `velocity.fn_ausleihe_abrechnen(bigint)` aus Aufgabe 5, die Grundlage aus Aufgabe 6
- Liefert: rund 12 000 abgeschlossene Fahrten im Referenzjahr mit Entgeltpositionen; `distanz_km` bei etwa 60 % gesetzt; Radstatus im Einklang mit den offenen Ausleihen

**Laufzeit:** ein bis drei Minuten. Der größte Teil davon ist die Abrechnungsschleife, die `fn_ausleihe_abrechnen` einmal je Fahrt aufruft.

- [ ] **Schritt 1: Die Datei schreiben**

`db/betrieb/referenzdaten_fahrten.sql`:

```sql
-- =====================================================================
--  REFERENZDATEN, TEIL 2: FAHRTEN
--
--  ACHTUNG: ERFUNDENE Daten. Plausibel gebaut, aber nichts davon ist
--  gemessen. Wer sie fuer Aussagen ueber die Wirklichkeit verwendet,
--  verwendet sie falsch.
--
--  Setzt db/betrieb/referenzdaten_grundlage.sql voraus. Ohne die
--  Preisperioden ab 2025-09-01 bricht die Abrechnung mit "Kein
--  gueltiger Preis" ab.
--
--  Was hier bewusst NICHT geschieht: Betraege werden nicht gesetzt.
--  Jede Fahrt laeuft durch fn_ausleihe_abrechnen, also durch dieselbe
--  Preislogik wie eine echte Fahrt. Gesetzte Betraege waeren schneller
--  und wuerden genau das verbergen, was die Fallstudie zeigen soll.
--
--  distanz_km wird nur bei etwa 60 Prozent der Fahrten gesetzt. Sonst
--  waere die Unterscheidung zwischen gemessenem und geschaetztem
--  Kilometer eine Spalte, die immer dasselbe sagt.
--
--  Fester Startwert (setseed): jeder Lauf erzeugt dieselben Daten.
--
--  Ruecknahme: siehe Dateiende (auskommentiert).
-- =====================================================================

do $$
declare
  c_von     constant date    := date '2025-09-01';
  c_bis     constant date    := date '2026-08-24';
  c_basis   constant integer := 33;      -- Fahrten je Tag im Jahresmittel
  v_erste   bigint;
  v_letzte  bigint;
  v_a       record;
  v_zahl    integer := 0;
begin
  if exists (select 1 from velocity.ausleihe where startzeit >= c_von
               and exists (select 1 from velocity.entgeltposition e
                            join velocity.entgeltart ea using (entgeltart_id)
                           where e.ausleihe_id = ausleihe.ausleihe_id
                             and ea.code = 'ZEITENTGELT')) then
    raise notice 'Referenzfahrten sind bereits vorhanden - nichts zu tun';
    return;
  end if;

  perform setseed(0.2308);

  select coalesce(max(ausleihe_id), 0) into v_erste from velocity.ausleihe;

  -- ---- Fahrten anlegen ----------------------------------------------
  -- Aufbau in vier Schritten: Tagesmenge nach Jahres- und Wochengang,
  -- dann je Fahrt Kunde, Rad und Stationen aus nummerierten Vorraeten
  -- ziehen. Nummerierte Vorraete statt "order by random() limit 1" je
  -- Zeile - das waere bei 12 000 Fahrten ein Tabellendurchlauf pro
  -- Fahrt.
  with kunde_vorrat as (
    select row_number() over (order by kunde_id) - 1 as nr, kunde_id
      from velocity.kunde where status = 'aktiv'
  ), rad_vorrat as (
    select row_number() over (order by f.fahrrad_id) - 1 as nr,
           f.fahrrad_id, t.typ_code
      from velocity.fahrrad f
      join velocity.fahrradmodell m on m.modell_id = f.modell_id
      join velocity.fahrradtyp    t on t.typ_id    = m.typ_id
     where f.status <> 'ausgemustert'
  ), station_vorrat as (
    select row_number() over (order by station_id) - 1 as nr, station_id
      from velocity.station where betriebszeitraum @> c_bis
  ), groesse as (
    select (select count(*) from kunde_vorrat)   as kunden,
           (select count(*) from rad_vorrat)     as raeder,
           (select count(*) from station_vorrat) as stationen
  ), tag as (
    select d::date as datum,
           -- Jahresgang: Hoch im Juli, Tief im Januar.
           0.55 + 0.45 * sin(2 * pi() * (extract(doy from d)::numeric - 105) / 365.0) as saison,
           -- Am Wochenende wird weniger gependelt, aber laenger gefahren.
           case when extract(isodow from d) in (6, 7) then 0.80 else 1.00 end as tagesart
      from generate_series(c_von, c_bis, interval '1 day') as d
  ), menge as (
    select datum, tagesart,
           greatest(1, round(c_basis * saison * tagesart * (0.80 + 0.40 * random())))::integer as anzahl
      from tag
  ), fahrt as (
    select m.datum, m.tagesart, g.*,
           random() as w_kunde, random() as w_rad,
           random() as w_start, random() as w_ziel,
           random() as w_stunde, random() as w_dauer,
           random() as w_distanz, random() as w_rueckkehr
      from menge m cross join groesse g,
           generate_series(1, m.anzahl)
  ), gezogen as (
    select f.datum, f.tagesart,
           kv.kunde_id, rv.fahrrad_id, rv.typ_code,
           sv.station_id as start_station_id,
           -- 15 Prozent enden dort, wo sie begannen. Diese Fahrten sind
           -- fuer die Schaetzung der harte Fall: ihre Luftlinie ist null,
           -- gefahren wurde trotzdem.
           case when f.w_rueckkehr < 0.15 then sv.station_id else zv.station_id end as end_station_id,
           f.datum
             + case
                 when f.tagesart = 1.00 and f.w_stunde < 0.22 then interval '7 hours'
                 when f.tagesart = 1.00 and f.w_stunde < 0.45 then interval '17 hours'
                 else (6 + floor(f.w_stunde * 16)) * interval '1 hour'
               end
             + (floor(random() * 60)) * interval '1 minute' as startzeit,
           -- Dauer je Typ verschieden und rechtsschief: viele kurze
           -- Fahrten, wenige lange. w_dauer zweimal multipliziert
           -- erzeugt genau diese Schiefe.
           case rv.typ_code
             when 'CITY'  then 6  + round(40 * f.w_dauer * f.w_dauer)
             when 'EBIKE' then 8  + round(52 * f.w_dauer * f.w_dauer)
             else              12 + round(78 * f.w_dauer * f.w_dauer)
           end::integer as dauer,
           f.w_distanz
      from fahrt f
      join kunde_vorrat   kv on kv.nr = floor(f.w_kunde * f.kunden)
      join rad_vorrat     rv on rv.nr = floor(f.w_rad   * f.raeder)
      join station_vorrat sv on sv.nr = floor(f.w_start * f.stationen)
      join station_vorrat zv on zv.nr = floor(f.w_ziel  * f.stationen)
  )
  insert into velocity.ausleihe
         (kunde_id, fahrrad_id, mitgliedschaft_id, start_station_id, startzeit,
          end_station_id, endzeit, status, distanz_km)
  select g.kunde_id, g.fahrrad_id, m.mitgliedschaft_id, g.start_station_id, g.startzeit,
         g.end_station_id, g.startzeit + g.dauer * interval '1 minute', 'abgeschlossen',
         -- 60 Prozent gemessen. Geschwindigkeit je Typ, mit Streuung.
         case when g.w_distanz < 0.60 then
           round((g.dauer / 60.0) * case g.typ_code
                                      when 'CITY'  then 13.0
                                      when 'EBIKE' then 18.0
                                      else              11.0
                                    end * (0.80 + 0.40 * random()), 2)
         end
    from gezogen g
    left join velocity.mitgliedschaft m
      on m.kunde_id = g.kunde_id and m.gueltigkeit @> g.startzeit::date;

  select max(ausleihe_id) into v_letzte from velocity.ausleihe;
  raise notice 'Fahrten angelegt: ausleihe_id % bis %', v_erste + 1, v_letzte;

  -- ---- Abrechnen ------------------------------------------------------
  -- In zeitlicher Reihenfolge, weil Freiminuten verbraucht werden: wer
  -- sie in anderer Folge abrechnet, verteilt sie anders.
  for v_a in
    select ausleihe_id from velocity.ausleihe
     where ausleihe_id > v_erste and endzeit is not null
     order by startzeit, ausleihe_id
  loop
    perform velocity.fn_ausleihe_abrechnen(v_a.ausleihe_id);
    v_zahl := v_zahl + 1;
  end loop;
  raise notice 'Fahrten abgerechnet: %', v_zahl;

  insert into velocity.uebernahme_protokoll
         (lauf, quelle, ziel, gelesen, geschrieben, uebersprungen, hinweis)
  values (now(), 'Referenzdaten (erzeugt)',
          'velocity.ausleihe, velocity.entgeltposition',
          0, v_zahl, 0,
          format('ERFUNDENE Fahrten fuer die Lehre, nicht erhoben. '
                 'ausleihe_id %s bis %s, Zeitraum %s bis %s. Betraege durch '
                 'fn_ausleihe_abrechnen gerechnet, nicht gesetzt. distanz_km '
                 'bei rund 60 Prozent gesetzt, sonst null.',
                 v_erste + 1, v_letzte, c_von, c_bis));
end;
$$;

-- ---- Radstatus in Einklang bringen -----------------------------------
-- 37 Raeder standen auf 'ausgeliehen' bei einer einzigen offenen
-- Ausleihe - ein Widerspruch aus der Altdatenuebernahme. Er fiel nie
-- auf, weil keine Oberflaeche Radstatus und Ausleihen nebeneinander
-- zeigte. Die erste Maske der Warenwirtschaft tut genau das.
update velocity.fahrrad f
   set status = 'verfuegbar'
 where f.status = 'ausgeliehen'
   and not exists (select 1 from velocity.ausleihe a
                    where a.fahrrad_id = f.fahrrad_id and a.status = 'aktiv');

-- ---- Kontrolle -------------------------------------------------------
do $$
declare v_fehler integer; v_fahrten integer; v_ohne integer;
begin
  select count(*) into v_fahrten from velocity.ausleihe where startzeit >= date '2025-09-01';
  if v_fahrten < 8000 then
    raise exception 'Zu wenige Referenzfahrten: %', v_fahrten;
  end if;

  -- Jede abgeschlossene Fahrt des Referenzjahres traegt Positionen.
  select count(*) into v_ohne
    from velocity.ausleihe a
   where a.startzeit >= date '2025-09-01' and a.endzeit is not null
     and not exists (select 1 from velocity.entgeltposition e where e.ausleihe_id = a.ausleihe_id);
  if v_ohne > 0 then
    raise exception '% Referenzfahrten ohne Entgeltposition', v_ohne;
  end if;

  -- Der Radstatus widerspricht den Ausleihen nicht mehr.
  select count(*) into v_fehler
    from velocity.fahrrad f
   where (f.status = 'ausgeliehen') <> exists (
           select 1 from velocity.ausleihe a
            where a.fahrrad_id = f.fahrrad_id and a.status = 'aktiv');
  if v_fehler > 0 then
    raise exception '% Raeder mit widerspruechlichem Status', v_fehler;
  end if;

  -- Der Preiswechsel ist in den Daten sichtbar: dieselbe Fahrtdauer
  -- kostet vor und nach dem 01.03.2026 verschieden viel.
  if (select count(distinct einzelbetrag) from velocity.entgeltposition ep
        join velocity.entgeltart ea using (entgeltart_id)
        join velocity.ausleihe a using (ausleihe_id)
        join velocity.fahrradmodell m on m.modell_id =
             (select modell_id from velocity.fahrrad where fahrrad_id = a.fahrrad_id)
        join velocity.fahrradtyp t on t.typ_id = m.typ_id
       where ea.code = 'ZEITENTGELT' and t.typ_code = 'CITY'
         and a.startzeit >= date '2025-09-01') < 2 then
    raise exception 'Der Preiswechsel zum 01.03.2026 schlaegt in den Positionen nicht durch';
  end if;

  raise notice 'Referenzfahrten in Ordnung: % Fahrten, alle abgerechnet', v_fahrten;
end;
$$;

-- ---- Ruecknahme ------------------------------------------------------
-- delete from velocity.entgeltposition where ausleihe_id in
--   (select ausleihe_id from velocity.ausleihe where startzeit >= date '2025-09-01');
-- delete from velocity.ausleihe where startzeit >= date '2025-09-01';
```

- [ ] **Schritt 2: Anwenden**

```bash
python3 db/run.py db/betrieb/referenzdaten_fahrten.sql
```
Erwartet: drei `notice`-Zeilen, kein `exception`. Dauer ein bis drei Minuten.

- [ ] **Schritt 3: Ergebnis ansehen**

```bash
python3 -c "
import os,psycopg
for z in open('.env',encoding='utf-8'):
    z=z.strip()
    if z and not z.startswith('#') and '=' in z:
        k,v=z.split('=',1); os.environ.setdefault(k,v)
c=psycopg.connect(host=os.environ['PGHOST'],port=os.environ['PGPORT'],dbname=os.environ['PGDATABASE'],
                  user=os.environ['PGUSER'],password=os.environ['PGPASSWORD']).cursor()
c.execute('''select to_char(a.startzeit,'YYYY-MM') monat, t.typ_code,
                    count(*) fahrten, round(sum(ep.betrag*ea.vorzeichen),2) umsatz
               from velocity.ausleihe a
               join velocity.entgeltposition ep using (ausleihe_id)
               join velocity.entgeltart ea using (entgeltart_id)
               join velocity.fahrrad f on f.fahrrad_id = a.fahrrad_id
               join velocity.fahrradmodell m on m.modell_id = f.modell_id
               join velocity.fahrradtyp t on t.typ_id = m.typ_id
              where a.startzeit >= date '2025-09-01'
              group by 1,2 order by 1,2''')
for r in c.fetchall(): print(r)
"
```
Erwartet: zwölf Monate × drei Typen, Sommer deutlich über Winter, und beim City-Bike ein Sprung im Umsatz je Fahrt ab März 2026.

- [ ] **Schritt 4: Idempotenz prüfen**

```bash
python3 db/run.py db/betrieb/referenzdaten_fahrten.sql
```
Erwartet: `Referenzfahrten sind bereits vorhanden - nichts zu tun`, danach die Kontrollen ohne Fehler.

- [ ] **Schritt 5: Ganze Testkette**

```bash
python3 db/test.py
```
Erwartet: keine neuen Fehlschläge. Falls `t0010_sichten.sql` an Zählwerten scheitert, die sich durch die Referenzdaten geändert haben: den Test auf die **Absicht** umstellen (Verhältnis, Vorhandensein), nicht die alte Zahl nachtragen.

- [ ] **Schritt 6: Commit**

```bash
git add db/betrieb/referenzdaten_fahrten.sql
git commit -m "feat(referenz): rund 12 000 Fahrten im Referenzjahr, durch die echte Preislogik abgerechnet"
```

---

## Aufgabe 8: Monatsrechnungen

**Warum:** GR10 („Rechnungen werden je Kunde und Monat genau einmal erzeugt") steht seit Phase 1 in den Anforderungen, und `velocity.rechnung` ist leer — die Regel war nie umgesetzt. Ohne Rechnungen hat die Kundenmaske der Warenwirtschaft keinen Rechnungsstand anzuzeigen.

**Dateien:**
- Ändern: `db/aufbau/0009_geschaeftslogik.sql`
- Anlegen: `db/betrieb/referenzdaten_rechnungen.sql`
- Test: `db/tests/t0006_bereich_e.sql` (zwei Testfunktionen ergänzen)

**Schnittstellen:**
- Liefert: `velocity.fn_rechnung_erzeugen(p_jahr integer, p_monat integer) returns integer` — Anzahl erzeugter Rechnungen

- [ ] **Schritt 1: Test ergänzen**

Ans Ende von `db/tests/t0006_bereich_e.sql`:

```sql
create or replace function velocity_test.test_e_rechnung_je_kunde_und_monat()
returns setof text language plpgsql as $$
declare v_erst integer; v_zweit integer;
begin
  v_erst  := velocity.fn_rechnung_erzeugen(2026, 4);
  -- GR10: ein zweiter Lauf darf keine zweite Rechnung erzeugen. Ohne
  -- diese Eigenschaft waere ein versehentlich wiederholter
  -- Monatsabschluss eine Doppelberechnung.
  v_zweit := velocity.fn_rechnung_erzeugen(2026, 4);
  return next cmp_ok(v_erst, '>', 0, 'Der erste Lauf erzeugt Rechnungen');
  return next is(v_zweit, 0, 'Der zweite Lauf erzeugt keine weiteren');
end;
$$;

create or replace function velocity_test.test_e_rechnungsbetrag_stimmt()
returns setof text language plpgsql as $$
declare v_r record;
begin
  perform velocity.fn_rechnung_erzeugen(2026, 5);
  select * into v_r from velocity.rechnung
   where periode_jahr = 2026 and periode_monat = 5
   order by rechnung_id limit 1;

  return next ok(v_r.rechnung_id is not null, 'Es gibt eine Rechnung fuer 05/2026');
  return next is(v_r.betrag_brutto, round(v_r.betrag_netto * (1 + v_r.ust_satz / 100), 2),
                 'Brutto ist Netto plus Umsatzsteuer');
  return next is(
    (select round(sum(betrag), 2) from velocity.rechnungsposition
      where rechnung_id = v_r.rechnung_id),
    v_r.betrag_netto,
    'Der Rechnungsbetrag ist die Summe seiner Positionen');
end;
$$;
```

- [ ] **Schritt 2: Test laufen lassen, Fehlschlag bestätigen**

```bash
python3 db/test.py db/tests/t0006_bereich_e.sql
```
Erwartet: beide neuen Funktionen schlagen fehl — `fn_rechnung_erzeugen` existiert nicht.

- [ ] **Schritt 3: Die Funktion anlegen**

Ans Ende von `db/aufbau/0009_geschaeftslogik.sql`:

```sql
-- GR10: Rechnungen werden je Kunde und Monat genau einmal erzeugt. Die
-- Regel stand seit Phase 1 in den Anforderungen und in einem UNIQUE-
-- Constraint - erzeugt hat sie bis jetzt niemand.
--
-- Ein Monatslauf, kein Trigger: eine Rechnung entsteht zum
-- Periodenende, nicht bei jeder Fahrt. Der Lauf ist wiederholbar; was
-- schon abgerechnet ist, wird uebergangen.
create or replace function velocity.fn_rechnung_erzeugen(
  p_jahr integer, p_monat integer
)
returns integer
language plpgsql
set search_path = velocity, pg_temp
as $$
declare
  c_ust  constant numeric(5,2) := 19.00;
  v_von  date := make_date(p_jahr, p_monat, 1);
  v_bis  date := (make_date(p_jahr, p_monat, 1) + interval '1 month')::date;
  v_k    record;
  v_r    bigint;
  v_netto numeric(10,2);
  v_zahl integer := 0;
begin
  for v_k in
    select a.kunde_id, round(sum(ep.betrag * ea.vorzeichen), 2) as netto
      from velocity.ausleihe a
      join velocity.entgeltposition ep using (ausleihe_id)
      join velocity.entgeltart      ea using (entgeltart_id)
     where a.startzeit >= v_von and a.startzeit < v_bis
       and a.status = 'abgeschlossen'
       and not exists (
         select 1 from velocity.rechnung r
          where r.kunde_id = a.kunde_id
            and r.periode_jahr = p_jahr and r.periode_monat = p_monat)
     group by a.kunde_id
    having round(sum(ep.betrag * ea.vorzeichen), 2) > 0
     order by a.kunde_id
  loop
    v_netto := v_k.netto;
    insert into velocity.rechnung
           (rechnungsnummer, kunde_id, periode_jahr, periode_monat,
            erstellt_am_beleg, betrag_netto, ust_satz, ust_betrag,
            betrag_brutto, status)
    values (format('R-%s-%s-%s', p_jahr, lpad(p_monat::text, 2, '0'),
                   lpad(v_k.kunde_id::text, 6, '0')),
            v_k.kunde_id, p_jahr, p_monat, v_bis,
            v_netto, c_ust, round(v_netto * c_ust / 100, 2),
            round(v_netto * (1 + c_ust / 100), 2), 'gestellt')
    returning rechnung_id into v_r;

    -- Eine Position je Fahrt. Der Kunde soll auf seiner Rechnung
    -- wiederfinden, welche Fahrt was gekostet hat - eine Summenzeile
    -- waere billiger und nicht pruefbar.
    insert into velocity.rechnungsposition
           (rechnung_id, position_nr, ausleihe_id, beschreibung, betrag)
    select v_r,
           row_number() over (order by a.startzeit),
           a.ausleihe_id,
           format('Fahrt am %s, %s Minuten',
                  to_char(a.startzeit, 'DD.MM.YYYY HH24:MI'), a.dauer_minuten),
           round(sum(ep.betrag * ea.vorzeichen), 2)
      from velocity.ausleihe a
      join velocity.entgeltposition ep using (ausleihe_id)
      join velocity.entgeltart      ea using (entgeltart_id)
     where a.kunde_id = v_k.kunde_id
       and a.startzeit >= v_von and a.startzeit < v_bis
       and a.status = 'abgeschlossen'
     group by a.ausleihe_id, a.startzeit, a.dauer_minuten;

    v_zahl := v_zahl + 1;
  end loop;

  return v_zahl;
end;
$$;
```

- [ ] **Schritt 4: Anwenden und Test laufen lassen**

```bash
python3 db/run.py db/aufbau/0009_geschaeftslogik.sql
python3 db/run.py db/aufbau/0009_geschaeftslogik.sql
python3 db/test.py db/tests/t0006_bereich_e.sql
```
Erwartet: beide Läufe fehlerfrei, alle Testfunktionen `ok`.

- [ ] **Schritt 5: Den Monatslauf über das Referenzjahr fahren**

`db/betrieb/referenzdaten_rechnungen.sql`:

```sql
-- =====================================================================
--  REFERENZDATEN, TEIL 3: MONATSRECHNUNGEN
--
--  ACHTUNG: Aufbauend auf ERFUNDENEN Fahrten. Die Rechnungen selbst
--  sind korrekt gerechnet - aus Daten, die niemand erhoben hat.
--
--  Setzt db/betrieb/referenzdaten_fahrten.sql voraus.
--  Idempotent ueber GR10: fn_rechnung_erzeugen uebergeht, was schon
--  abgerechnet ist.
--
--  Ruecknahme:
--    delete from velocity.rechnungsposition;
--    delete from velocity.rechnung;
-- =====================================================================

do $$
declare
  v_d    date;
  v_zahl integer;
  v_summe integer := 0;
begin
  for v_d in
    select d::date from generate_series(date '2025-09-01', date '2026-07-01', interval '1 month') d
  loop
    v_zahl := velocity.fn_rechnung_erzeugen(
                extract(year from v_d)::integer, extract(month from v_d)::integer);
    v_summe := v_summe + v_zahl;
    raise notice '% : % Rechnungen', to_char(v_d, 'YYYY-MM'), v_zahl;
  end loop;
  raise notice 'Rechnungen gesamt: %', v_summe;
end;
$$;

-- Der laufende Monat wird bewusst NICHT abgerechnet: eine Rechnung
-- entsteht zum Periodenende. August 2026 ist noch nicht vorbei.

do $$
declare v_fehler integer;
begin
  -- GR10 in den Daten nachweisen, nicht nur im Constraint.
  select count(*) into v_fehler from (
    select kunde_id, periode_jahr, periode_monat
      from velocity.rechnung group by 1,2,3 having count(*) > 1) x;
  if v_fehler > 0 then
    raise exception '% Kunde/Monat-Paare mit mehr als einer Rechnung', v_fehler;
  end if;

  select count(*) into v_fehler
    from velocity.rechnung r
   where r.betrag_netto <> (select coalesce(round(sum(betrag), 2), 0)
                              from velocity.rechnungsposition p
                             where p.rechnung_id = r.rechnung_id);
  if v_fehler > 0 then
    raise exception '% Rechnungen stimmen nicht mit ihren Positionen ueberein', v_fehler;
  end if;

  raise notice 'Rechnungen in Ordnung';
end;
$$;
```

```bash
python3 db/run.py db/betrieb/referenzdaten_rechnungen.sql
python3 db/run.py db/betrieb/referenzdaten_rechnungen.sql
```
Erwartet: der erste Lauf meldet elf Monate mit Rechnungen, der zweite überall `0`. Beide ohne `exception`.

- [ ] **Schritt 6: Commit**

```bash
git add db/aufbau/0009_geschaeftslogik.sql db/tests/t0006_bereich_e.sql db/betrieb/referenzdaten_rechnungen.sql
git commit -m "feat(abrechnung): fn_rechnung_erzeugen setzt GR10 um, Monatsrechnungen fuer das Referenzjahr"
```

---

## Aufgabe 9: Wer ist Mitarbeiter — Zugriffsschutz

**Der Kern des ganzen Schritts.** PostgREST meldet jeden angemeldeten Benutzer als Datenbankrolle `authenticated` an — Kunden wie Mitarbeitende. Rechtevergabe allein trennt sie deshalb **nicht**: ein `grant select on v_wawi_kunde to authenticated` gäbe jedem Kunden die Stammdaten aller anderen. Die Trennung muss in die Sicht selbst und in die RLS-Regel, und beide fragen dieselben zwei Funktionen.

**Dateien:**
- Anlegen: `db/aufbau/0017_wawi_sicherheit.sql`
- Test: `db/tests/t0017_wawi_sicherheit.sql`

**Schnittstellen:**
- Liefert: `velocity.ist_mitarbeiter() returns boolean`, `velocity.hat_rolle(p_code text) returns boolean`, `velocity.mitarbeiter_id_aus_auth() returns bigint`; RLS auf allen Tabellen der Bereiche J, I, K

- [ ] **Schritt 1: Testdatei anlegen**

`db/tests/t0017_wawi_sicherheit.sql`:

```sql
-- =====================================================================
-- t0017 Zugriffsschutz der Warenwirtschaft
-- =====================================================================
create schema if not exists velocity_test;
set search_path = velocity_test, velocity, extensions, public;

create or replace function velocity_test.test_s_ohne_anmeldung_kein_mitarbeiter()
returns setof text language plpgsql as $$
begin
  -- Ohne JWT liefert auth.uid() null. Wer null ist, ist niemand.
  return next ok(not velocity.ist_mitarbeiter(),
                 'Ohne Anmeldung ist niemand Mitarbeiter');
  return next ok(not velocity.hat_rolle('leitung'),
                 'Ohne Anmeldung hat niemand eine Rolle');
end;
$$;

create or replace function velocity_test.test_s_beurlaubt_zaehlt_nicht()
returns setof text language plpgsql as $$
declare v_uid uuid := gen_random_uuid(); v_m bigint;
begin
  insert into velocity.mitarbeiter (personalnummer, auth_uid, vorname, nachname, email, status)
       values ('S-TEST-1', v_uid, 'Sina', 'Test', 's-test-1@example.org', 'beurlaubt')
    returning mitarbeiter_id into v_m;
  perform set_config('request.jwt.claims', json_build_object('sub', v_uid)::text, true);
  -- GR16: nur AKTIVE Mitarbeitende haben Zugriff. Wer beurlaubt ist,
  -- behaelt seinen Satz und verliert den Zugang.
  return next ok(not velocity.ist_mitarbeiter(),
                 'Ein beurlaubter Mitarbeiter gilt nicht als Mitarbeiter');
  update velocity.mitarbeiter set status = 'aktiv' where mitarbeiter_id = v_m;
  return next ok(velocity.ist_mitarbeiter(),
                 'Nach Rueckkehr gilt er wieder');
  perform set_config('request.jwt.claims', '', true);
end;
$$;

create or replace function velocity_test.test_s_rolle_wird_geprueft()
returns setof text language plpgsql as $$
declare v_uid uuid := gen_random_uuid(); v_m bigint;
begin
  insert into velocity.mitarbeiter (personalnummer, auth_uid, vorname, nachname, email)
       values ('S-TEST-2', v_uid, 'Sven', 'Test', 's-test-2@example.org')
    returning mitarbeiter_id into v_m;
  insert into velocity.mitarbeiter_rolle (mitarbeiter_id, rolle_id)
  select v_m, rolle_id from velocity.rolle where code = 'werkstatt';
  perform set_config('request.jwt.claims', json_build_object('sub', v_uid)::text, true);
  return next ok(velocity.hat_rolle('werkstatt'), 'Die zugeteilte Rolle wird erkannt');
  return next ok(not velocity.hat_rolle('kundenservice'),
                 'Eine nicht zugeteilte Rolle wird nicht erkannt');
  perform set_config('request.jwt.claims', '', true);
end;
$$;

create or replace function velocity_test.test_s_zahlungsmittel_bleibt_gesperrt()
returns setof text language plpgsql as $$
begin
  -- GR17: Mitarbeitende sehen keine Zahlungsmittel. Das darf nicht an
  -- der Disziplin der Oberflaeche haengen, sondern am Recht.
  return next ok(not has_table_privilege('authenticated', 'velocity.zahlungsmittel', 'SELECT'),
                 'authenticated darf zahlungsmittel nicht lesen');
  return next ok(not has_table_privilege('anon', 'velocity.zahlungsmittel', 'SELECT'),
                 'anon darf zahlungsmittel nicht lesen');
  return next is_empty(
    $q$ select c.relname from pg_class c
          join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'velocity' and c.relkind = 'v'
           and c.relname like 'v_wawi%'
           and pg_get_viewdef(c.oid) ilike '%zahlungsmittel%' $q$,
    'Keine v_wawi-Sicht greift auf zahlungsmittel zu');
end;
$$;

create or replace function velocity_test.test_s_rls_ist_scharf()
returns setof text language plpgsql as $$
begin
  return next results_eq(
    $q$ select c.relname::text from pg_class c
          join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'velocity' and c.relkind = 'r'
           and c.relname in ('rolle','mitarbeiter','mitarbeiter_rolle','schadensmeldung',
                             'wartungsauftrag','fahrrad_ereignis','aenderungsprotokoll',
                             'rechenannahme')
           and not c.relrowsecurity
        order by 1 $q$,
    $q$ select null::text where false $q$,
    'Auf allen neuen Tabellen ist Row Level Security eingeschaltet');
end;
$$;
```

- [ ] **Schritt 2: Test laufen lassen, Fehlschlag bestätigen**

```bash
python3 db/test.py db/tests/t0017_wawi_sicherheit.sql
```
Erwartet: Fehler, weil `velocity.ist_mitarbeiter` nicht existiert.

- [ ] **Schritt 3: Aufbaudatei schreiben**

`db/aufbau/0017_wawi_sicherheit.sql`:

```sql
-- =====================================================================
-- 0017 Zugriffsschutz der Warenwirtschaft
--
-- Zweck:      Kunden und Mitarbeitende auseinanderhalten - obwohl beide
--             fuer PostgreSQL dieselbe Rolle 'authenticated' sind.
--             Rechtevergabe allein reicht dafuer nicht: ein
--             grant select ... to authenticated gaebe jedem Kunden die
--             Stammdaten aller anderen. Die Trennung steht deshalb in
--             drei Funktionen, die RLS-Regeln UND Sichten befragen.
-- Objekte:    velocity.mitarbeiter_id_aus_auth, velocity.ist_mitarbeiter,
--             velocity.hat_rolle, RLS-Regeln auf den Bereichen J, I, K
-- Ruecknahme: DROP FUNCTION velocity.hat_rolle(text),
--             velocity.ist_mitarbeiter(), velocity.mitarbeiter_id_aus_auth();
--             ALTER TABLE ... DISABLE ROW LEVEL SECURITY je Tabelle.
-- =====================================================================

-- security definer, damit die Funktion velocity.mitarbeiter lesen darf,
-- ohne dass der Aufrufer es duerfte. stable, damit der Planer sie je
-- Anweisung einmal auswertet statt je Zeile.
create or replace function velocity.mitarbeiter_id_aus_auth()
returns bigint
language sql
stable
security definer
set search_path = velocity, pg_temp
as $$
  select m.mitarbeiter_id from velocity.mitarbeiter m
   where m.auth_uid = auth.uid() and m.status = 'aktiv';
$$;

-- GR16: nur aktive Mitarbeitende. Der Statusfilter steckt schon in
-- mitarbeiter_id_aus_auth - hier steht er nicht noch einmal, damit es
-- nur EINE Stelle gibt, an der 'aktiv' definiert wird.
create or replace function velocity.ist_mitarbeiter()
returns boolean
language sql
stable
security definer
set search_path = velocity, pg_temp
as $$
  select velocity.mitarbeiter_id_aus_auth() is not null;
$$;

create or replace function velocity.hat_rolle(p_code text)
returns boolean
language sql
stable
security definer
set search_path = velocity, pg_temp
as $$
  select exists (
    select 1
      from velocity.mitarbeiter_rolle mr
      join velocity.rolle r on r.rolle_id = mr.rolle_id
     where mr.mitarbeiter_id = velocity.mitarbeiter_id_aus_auth()
       and r.code = p_code
  );
$$;

comment on function velocity.ist_mitarbeiter() is
  'Einziger Ort, an dem entschieden wird, wer Mitarbeiter ist. GR16.';

-- ---- Row Level Security ---------------------------------------------
-- RLS ist auf diesen Tabellen bereits seit ihrer Anlage eingeschaltet
-- (globale Randbedingung). Bis hierher hiess das: niemand kommt heran,
-- weil keine Regel existiert. Jetzt kommen die Regeln dazu.
--
-- enable und force stehen trotzdem noch einmal hier - idempotent und
-- billig. Sie sind die Zusicherung, dass diese Datei fuer sich allein
-- einen vollstaendigen Zustand herstellt und nicht darauf baut, dass
-- eine fruehere Datei etwas nicht vergessen hat.
do $$
declare v_t text;
begin
  foreach v_t in array array['rolle','mitarbeiter','mitarbeiter_rolle',
                             'schadensmeldung','wartungsauftrag','fahrrad_ereignis',
                             'aenderungsprotokoll','rechenannahme']
  loop
    execute format('alter table velocity.%I enable row level security', v_t);
    execute format('alter table velocity.%I force row level security', v_t);
    execute format('drop policy if exists %I on velocity.%I',
                   v_t || '_mitarbeiter_lesen', v_t);
    execute format(
      'create policy %I on velocity.%I for select using (velocity.ist_mitarbeiter())',
      v_t || '_mitarbeiter_lesen', v_t);
  end loop;
end;
$$;

-- Das Aenderungsprotokoll darf niemand aendern, auch die Leitung nicht.
-- Ein Protokoll, das sich nachtraeglich glaetten laesst, beweist nichts
-- (Art. 5 Abs. 2 DSGVO, Rechenschaftspflicht).
drop policy if exists aenderungsprotokoll_unveraenderlich on velocity.aenderungsprotokoll;
create policy aenderungsprotokoll_unveraenderlich on velocity.aenderungsprotokoll
  for update using (false);
drop policy if exists aenderungsprotokoll_unloeschbar on velocity.aenderungsprotokoll;
create policy aenderungsprotokoll_unloeschbar on velocity.aenderungsprotokoll
  for delete using (false);

-- ---- Rechte ----------------------------------------------------------
-- Keine Basistabelle wird freigegeben. Die Warenwirtschaft spricht
-- ausschliesslich Sichten und api_-Funktionen an - dieselbe Regel wie
-- fuer die Website, und tools/abnahme.sh prueft sie von aussen.
--
-- NICHT "revoke all on all tables in schema velocity": ALL TABLES
-- schliesst in PostgreSQL die Sichten mit ein. Diese eine Anweisung
-- haette der Website jedes Leserecht genommen und die Startseite
-- abgeschaltet. Deshalb ausdruecklich nur relkind = 'r'.
do $$
declare v_t text;
begin
  for v_t in
    select c.relname
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'velocity' and c.relkind = 'r'
  loop
    execute format('revoke all on velocity.%I from anon, authenticated', v_t);
  end loop;
end;
$$;

-- GR17: zahlungsmittel bleibt gesperrt. Die Zeile ist redundant zur
-- Schleife darueber und steht trotzdem hier, damit sie beim Lesen
-- auffaellt und niemand sie versehentlich aufhebt.
revoke all on velocity.zahlungsmittel from anon, authenticated;
```

- [ ] **Schritt 4: Anwenden, Idempotenz prüfen, Tests laufen lassen**

```bash
python3 db/run.py db/aufbau/0017_wawi_sicherheit.sql
python3 db/run.py db/aufbau/0017_wawi_sicherheit.sql
python3 db/test.py db/tests/t0017_wawi_sicherheit.sql
```
Erwartet: beide Läufe fehlerfrei; `test_s_zahlungsmittel_bleibt_gesperrt` besteht bereits, die Sichtprüfung darin ist zu diesem Zeitpunkt leer und damit erfüllt.

- [ ] **Schritt 5: Bestehende Rechte gegenprüfen**

Die Schleife entzieht Rechte an allen Basistabellen — auch solchen, die
die Website vielleicht doch direkt liest. Deshalb sofort:

```bash
bash tools/abnahme.sh
```
Erwartet: alle 18 Prüfungen weiter grün, insbesondere „Website spricht
nur Sichten und api-Funktionen". Falls eine bricht, ist ein `grant`
verlorengegangen — dann den fehlenden `grant` in
`db/aufbau/0011_sicherheit.sql` suchen und **dort** wiederherstellen,
nicht in `0017`. Der Grund für die Trennung: `0011` ist die Stelle, an
der die Rechte der Website stehen; stünde ein Teil davon in `0017`,
müsste man künftig zwei Dateien lesen, um eine Frage zu beantworten.

- [ ] **Schritt 6: Commit**

```bash
git add db/aufbau/0017_wawi_sicherheit.sql db/tests/t0017_wawi_sicherheit.sql
git commit -m "feat(wawi): Zugriffsschutz - ist_mitarbeiter, hat_rolle und RLS auf den neuen Bereichen"
```

---

## Aufgabe 10: Arbeitssichten

**Dateien:**
- Anlegen: `db/aufbau/0018_wawi_sichten.sql` (erster Teil; die Auswertungen kommen in Aufgabe 11 in dieselbe Datei)
- Test: `db/tests/t0018_wawi_sichten.sql`

**Schnittstellen:**
- Nutzt: `velocity.hat_rolle(text)`, `velocity.ist_mitarbeiter()` aus Aufgabe 9
- Liefert: `v_wawi_flotte`, `v_wawi_kunde`, `v_wawi_station`, `v_wawi_schaden`, `v_wawi_auftrag`

- [ ] **Schritt 1: Testdatei anlegen**

`db/tests/t0018_wawi_sichten.sql`:

```sql
-- =====================================================================
-- t0018 Sichten der Warenwirtschaft
-- =====================================================================
create schema if not exists velocity_test;
set search_path = velocity_test, velocity, extensions, public;

-- Vorrichtung: ein angemeldeter Mitarbeiter mit allen Rollen.
create or replace function velocity_test.fixture_mitarbeiter(p_suffix text)
returns uuid language plpgsql as $$
declare v_uid uuid := gen_random_uuid(); v_m bigint;
begin
  insert into velocity.mitarbeiter (personalnummer, auth_uid, vorname, nachname, email)
       values ('T-' || p_suffix, v_uid, 'Tom', 'Test', 't-' || p_suffix || '@example.org')
    returning mitarbeiter_id into v_m;
  insert into velocity.mitarbeiter_rolle (mitarbeiter_id, rolle_id)
  select v_m, rolle_id from velocity.rolle;
  perform set_config('request.jwt.claims', json_build_object('sub', v_uid)::text, true);
  return v_uid;
end;
$$;

create or replace function velocity_test.test_v_sichten_existieren()
returns setof text language plpgsql as $$
begin
  return next has_view('velocity'::name, 'v_wawi_flotte'::name,  'v_wawi_flotte existiert');
  return next has_view('velocity'::name, 'v_wawi_kunde'::name,   'v_wawi_kunde existiert');
  return next has_view('velocity'::name, 'v_wawi_station'::name, 'v_wawi_station existiert');
  return next has_view('velocity'::name, 'v_wawi_schaden'::name, 'v_wawi_schaden existiert');
  return next has_view('velocity'::name, 'v_wawi_auftrag'::name, 'v_wawi_auftrag existiert');
end;
$$;

create or replace function velocity_test.test_v_ohne_rolle_keine_zeile()
returns setof text language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '', true);
  -- Das ist die eigentliche Sperre: PostgREST meldet Kunden und
  -- Mitarbeitende als dieselbe Datenbankrolle an. Wenn die Sicht nicht
  -- selbst filtert, liest jeder Kunde alle Kundenstammdaten.
  return next is_empty($q$ select 1 from velocity.v_wawi_kunde $q$,
                       'Ohne Anmeldung liefert v_wawi_kunde nichts');
  return next is_empty($q$ select 1 from velocity.v_wawi_flotte $q$,
                       'Ohne Anmeldung liefert v_wawi_flotte nichts');
end;
$$;

create or replace function velocity_test.test_v_mit_rolle_liefert_zeilen()
returns setof text language plpgsql as $$
declare v_n integer;
begin
  perform velocity_test.fixture_mitarbeiter('sicht');
  select count(*) into v_n from velocity.v_wawi_flotte;
  return next cmp_ok(v_n, '>', 0, 'Mit Rolle liefert v_wawi_flotte Raeder');
  select count(*) into v_n from velocity.v_wawi_station;
  return next cmp_ok(v_n, '>', 0, 'Mit Rolle liefert v_wawi_station Stationen');
  perform set_config('request.jwt.claims', '', true);
end;
$$;

create or replace function velocity_test.test_v_kunde_ohne_bewegungsprofil()
returns setof text language plpgsql as $$
begin
  -- Eine Liste von Fahrten mit Start, Ziel und Uhrzeit ist ein
  -- Bewegungsprofil. Der Kundenservice braucht es nicht; die Auswertung
  -- braucht nur Summen. Was niemand braucht, wird nicht ausgeliefert.
  return next hasnt_column('velocity'::name, 'v_wawi_kunde'::name, 'ausleihe_id'::name,
                           'v_wawi_kunde nennt keine einzelne Fahrt');
  return next hasnt_column('velocity'::name, 'v_wawi_kunde'::name, 'passwort_hash'::name,
                           'v_wawi_kunde nennt kein Passwort');
  return next hasnt_column('velocity'::name, 'v_wawi_kunde'::name, 'zahlungsmittel_id'::name,
                           'v_wawi_kunde nennt kein Zahlungsmittel');
end;
$$;
```

- [ ] **Schritt 2: Test laufen lassen, Fehlschlag bestätigen**

```bash
python3 db/test.py db/tests/t0018_wawi_sichten.sql
```
Erwartet: Fehler, weil `v_wawi_flotte` nicht existiert.

- [ ] **Schritt 3: Aufbaudatei schreiben**

`db/aufbau/0018_wawi_sichten.sql` — Kopf und die fünf Arbeitssichten:

```sql
-- =====================================================================
-- 0018 Sichten der Warenwirtschaft
--
-- Zweck:      Die Fenster, durch die die Warenwirtschaft auf die Daten
--             sieht. Jede Sicht filtert SELBST ueber velocity.hat_rolle
--             - nicht aus Vorsicht, sondern aus Notwendigkeit:
--             PostgREST meldet Kunden und Mitarbeitende als dieselbe
--             Datenbankrolle 'authenticated' an. Ohne Filter in der
--             Sicht laese jeder Kunde die Stammdaten aller anderen.
-- Objekte:    velocity.fn_luftlinie_km, velocity.v_wawi_flotte,
--             v_wawi_kunde, v_wawi_station, v_wawi_schaden,
--             v_wawi_auftrag, v_wawi_umsatz_radtyp,
--             v_wawi_umsatz_kundengruppe, v_wawi_km_co2,
--             v_wawi_stationsauslastung
-- Ruecknahme: DROP VIEW fuer dieselben Namen; DROP FUNCTION
--             velocity.fn_luftlinie_km(numeric,numeric,numeric,numeric);
-- =====================================================================

-- Luftlinie nach Haversine, ohne PostGIS - dieselbe Entscheidung wie
-- beim Geschaeftsgebiet: eine Erweiterung fuer eine Formel mit fuenf
-- Zeilen waere ein Betriebsrisiko ohne Gegenwert.
create or replace function velocity.fn_luftlinie_km(
  p_lat1 numeric, p_lon1 numeric, p_lat2 numeric, p_lon2 numeric
)
returns numeric
language sql
immutable
as $$
  select case
    when p_lat1 is null or p_lon1 is null or p_lat2 is null or p_lon2 is null then null
    else round((6371.0 * 2 * asin(sqrt(
           power(sin(radians(p_lat2 - p_lat1) / 2), 2)
         + cos(radians(p_lat1)) * cos(radians(p_lat2))
         * power(sin(radians(p_lon2 - p_lon1) / 2), 2)
         )))::numeric, 3)
  end;
$$;

-- ---- Flotte ----------------------------------------------------------
create or replace view velocity.v_wawi_flotte as
select f.fahrrad_id,
       f.rahmennummer,
       t.typ_code,
       t.bezeichnung          as typ,
       h.name                 as hersteller,
       mo.modellbezeichnung   as modell,
       f.status,
       f.angeschafft_am,
       s.name                 as standort,
       fp.latitude, fp.longitude, fp.akkustand_prozent,
       (select max(w.erledigt_am) from velocity.wartungsauftrag w
         where w.fahrrad_id = f.fahrrad_id and w.status = 'erledigt') as letzte_wartung,
       (select count(*) from velocity.schadensmeldung sm
         where sm.fahrrad_id = f.fahrrad_id and sm.status in ('offen','in_arbeit'))
                              as offene_schaeden,
       -- Die dringlichste offene Meldung bestimmt, ob das Rad ueberhaupt
       -- fahren darf. Sie gehoert in die Liste, nicht in die Detailmaske.
       (select max(sm.schwere::text) from velocity.schadensmeldung sm
         where sm.fahrrad_id = f.fahrrad_id and sm.status in ('offen','in_arbeit'))
                              as hoechste_schwere
  from velocity.fahrrad f
  join velocity.fahrradmodell mo on mo.modell_id = f.modell_id
  join velocity.fahrradtyp    t  on t.typ_id     = mo.typ_id
  join velocity.hersteller    h  on h.hersteller_id = mo.hersteller_id
  left join velocity.fahrrad_position fp on fp.fahrrad_id = f.fahrrad_id
  left join velocity.station          s  on s.station_id  = fp.station_id
 where velocity.hat_rolle('disposition')
    or velocity.hat_rolle('werkstatt')
    or velocity.hat_rolle('leitung');

-- ---- Kunden ----------------------------------------------------------
-- Bewusst OHNE einzelne Fahrten: eine Liste mit Start, Ziel und Uhrzeit
-- ist ein Bewegungsprofil. Der Kundenservice braucht Summen, keine
-- Wege. Bewusst OHNE Zahlungsmittel (GR17) und ohne alles aus dem
-- Schema auth.
create or replace view velocity.v_wawi_kunde as
select k.kunde_id,
       k.kundennummer,
       k.anrede, k.vorname, k.nachname, k.email, k.telefon,
       k.status,
       k.registriert_am,
       a.strasse, a.hausnummer, a.plz, a.ort,
       tr.tarif_code,
       tr.bezeichnung as tarif,
       m.gueltigkeit  as mitgliedschaft_seit,
       (select count(*) from velocity.ausleihe au
         where au.kunde_id = k.kunde_id and au.status = 'abgeschlossen') as fahrten_gesamt,
       (select count(*) from velocity.ausleihe au
         where au.kunde_id = k.kunde_id and au.status = 'aktiv')          as fahrten_offen,
       (select coalesce(sum(r.betrag_brutto), 0) from velocity.rechnung r
         where r.kunde_id = k.kunde_id)                                   as umsatz_brutto,
       (select coalesce(sum(r.betrag_brutto), 0) from velocity.rechnung r
         where r.kunde_id = k.kunde_id and r.status = 'gestellt')         as offener_betrag
  from velocity.kunde k
  left join velocity.adresse a on a.adresse_id = k.rechnungsadresse_id
  left join velocity.mitgliedschaft m
         on m.kunde_id = k.kunde_id and upper_inf(m.gueltigkeit)
  left join velocity.tarif tr on tr.tarif_id = m.tarif_id
 where velocity.hat_rolle('kundenservice')
    or velocity.hat_rolle('leitung');

-- ---- Stationen -------------------------------------------------------
create or replace view velocity.v_wawi_station as
select s.station_id,
       s.stationsnummer,
       s.name,
       a.strasse, a.hausnummer, a.plz, a.ort,
       s.latitude, s.longitude,
       s.kapazitaet,
       count(fp.fahrrad_id)                       as belegt,
       s.kapazitaet - count(fp.fahrrad_id)        as frei,
       s.betriebszeitraum,
       upper_inf(s.betriebszeitraum)              as in_betrieb
  from velocity.station s
  join velocity.adresse a on a.adresse_id = s.adresse_id
  left join velocity.fahrrad_position fp on fp.station_id = s.station_id
 where velocity.hat_rolle('disposition')
    or velocity.hat_rolle('leitung')
 group by s.station_id, s.stationsnummer, s.name, a.strasse, a.hausnummer,
          a.plz, a.ort, s.latitude, s.longitude, s.kapazitaet, s.betriebszeitraum;

-- ---- Schadensmeldungen -----------------------------------------------
create or replace view velocity.v_wawi_schaden as
select sm.schadensmeldung_id,
       sm.fahrrad_id,
       f.rahmennummer,
       t.typ_code,
       sm.gemeldet_am,
       -- Wer gemeldet hat, aber nicht WER genau: fuer die Werkstatt
       -- zaehlt, ob die Meldung aus dem Betrieb oder von draussen kam.
       case when sm.melder_kunde_id is not null then 'Kunde' else 'Mitarbeiter' end as melderart,
       sm.kategorie, sm.beschreibung, sm.schwere, sm.status,
       (now() - sm.gemeldet_am)                                   as offen_seit,
       (select count(*) from velocity.wartungsauftrag w
         where w.schadensmeldung_id = sm.schadensmeldung_id)      as auftraege
  from velocity.schadensmeldung sm
  join velocity.fahrrad f on f.fahrrad_id = sm.fahrrad_id
  join velocity.fahrradmodell mo on mo.modell_id = f.modell_id
  join velocity.fahrradtyp    t  on t.typ_id = mo.typ_id
 where velocity.hat_rolle('werkstatt')
    or velocity.hat_rolle('disposition')
    or velocity.hat_rolle('leitung');

-- ---- Wartungsauftraege -----------------------------------------------
create or replace view velocity.v_wawi_auftrag as
select w.wartungsauftrag_id,
       w.auftragsnummer,
       w.fahrrad_id,
       f.rahmennummer,
       w.schadensmeldung_id,
       w.eroeffnet_am, w.erledigt_am, w.status,
       w.arbeitszeit_minuten, w.bemerkung,
       m.vorname || ' ' || m.nachname as bearbeiter
  from velocity.wartungsauftrag w
  join velocity.fahrrad f on f.fahrrad_id = w.fahrrad_id
  left join velocity.mitarbeiter m on m.mitarbeiter_id = w.mitarbeiter_id
 where velocity.hat_rolle('werkstatt')
    or velocity.hat_rolle('leitung');
```

- [ ] **Schritt 4: Anwenden, Idempotenz prüfen, Tests laufen lassen**

```bash
python3 db/run.py db/aufbau/0018_wawi_sichten.sql
python3 db/run.py db/aufbau/0018_wawi_sichten.sql
python3 db/test.py db/tests/t0018_wawi_sichten.sql db/tests/t0012_dokumentation.sql
```
Erwartet: beide Läufe fehlerfrei, alle Testfunktionen `ok`.

**`test_doku_vollstaendig` betrifft Sichten genauso wie Tabellen** — und
zwar samt jeder einzelnen Spalte. Die fünf Sichten dieser Aufgabe haben
zusammen rund sechzig Spalten; jede braucht ein `comment on column`. Das
ist der Preis dafür, dass in diesem Projekt niemand raten muss, was
`saldo` oder `hoechste_schwere` bedeutet. Schreibe die Kommentare
zusammen mit der Sicht, nicht hinterher: bei sechzig Spalten am Stück
entstehen sonst sechzig Wiederholungen des Spaltennamens.

Falls `create or replace view` mit `cannot change name of view column` scheitert: die Sicht mit `drop view if exists velocity.<name> cascade;` davor abräumen. `create or replace` kann Spalten nur anhängen, nicht umbenennen.

- [ ] **Schritt 5: Commit**

```bash
git add db/aufbau/0018_wawi_sichten.sql db/tests/t0018_wawi_sichten.sql
git commit -m "feat(wawi): Arbeitssichten Flotte, Kunden, Stationen, Schaeden, Auftraege"
```

---

## Aufgabe 11: Auswertungssichten

**Dateien:**
- Ändern: `db/aufbau/0018_wawi_sichten.sql` (anhängen)
- Ändern: `db/tests/t0018_wawi_sichten.sql` (anhängen)

**Schnittstellen:**
- Nutzt: `velocity.fn_luftlinie_km(numeric,numeric,numeric,numeric)` aus Aufgabe 10, `velocity.rechenannahme` aus Aufgabe 3
- Liefert: `v_wawi_fahrt_km` (Hilfssicht), `v_wawi_umsatz_radtyp`, `v_wawi_umsatz_kundengruppe`, `v_wawi_km_co2`, `v_wawi_stationsauslastung`

- [ ] **Schritt 1: Tests ergänzen**

Ans Ende von `db/tests/t0018_wawi_sichten.sql`:

```sql
create or replace function velocity_test.test_v_umsatz_nach_radtyp()
returns setof text language plpgsql as $$
declare v_n integer;
begin
  perform velocity_test.fixture_mitarbeiter('umsatz');
  select count(*) into v_n from velocity.v_wawi_umsatz_radtyp;
  return next cmp_ok(v_n, '>', 0, 'Die Umsatzauswertung nach Radtyp liefert Zeilen');

  -- Der Umsatz der Sicht muss der Summe der Positionen entsprechen.
  -- Eine Auswertung, die anders rechnet als die Buchhaltung, ist
  -- schlimmer als keine.
  return next is(
    (select round(sum(umsatz), 2) from velocity.v_wawi_umsatz_radtyp),
    (select round(sum(ep.betrag * ea.vorzeichen), 2)
       from velocity.entgeltposition ep
       join velocity.entgeltart ea using (entgeltart_id)
       join velocity.ausleihe a using (ausleihe_id)
      where a.status = 'abgeschlossen'),
    'Der Umsatz der Sicht ist die Summe der Entgeltpositionen');
  perform set_config('request.jwt.claims', '', true);
end;
$$;

create or replace function velocity_test.test_v_km_kennzeichnet_schaetzung()
returns setof text language plpgsql as $$
declare v_gemessen integer; v_geschaetzt integer;
begin
  perform velocity_test.fixture_mitarbeiter('km');
  select count(*) filter (where not ist_geschaetzt),
         count(*) filter (where ist_geschaetzt)
    into v_gemessen, v_geschaetzt
    from velocity.v_wawi_fahrt_km;
  -- Beide Sorten muessen vorkommen, sonst prueft der Rest nichts.
  return next cmp_ok(v_gemessen,   '>', 0, 'Es gibt gemessene Strecken');
  return next cmp_ok(v_geschaetzt, '>', 0, 'Es gibt geschaetzte Strecken');

  return next is_empty(
    $q$ select 1 from velocity.v_wawi_km_co2
         where anteil_geschaetzt is null or anteil_geschaetzt < 0 or anteil_geschaetzt > 1 $q$,
    'Jede Zeile der CO2-Auswertung weist ihren geschaetzten Anteil aus');
  perform set_config('request.jwt.claims', '', true);
end;
$$;

create or replace function velocity_test.test_v_co2_rechnet_gegen_die_annahmen()
returns setof text language plpgsql as $$
declare v_zeile record; v_erwartet numeric;
begin
  perform velocity_test.fixture_mitarbeiter('co2');
  select * into v_zeile from velocity.v_wawi_km_co2
   where typ_code = 'CITY' and kilometer > 0 order by monat limit 1;

  select round(v_zeile.kilometer
               * ((select wert from velocity.rechenannahme
                    where code = 'co2_pkw' and upper_inf(gueltigkeit))
                - (select wert from velocity.rechenannahme
                    where code = 'co2_rad' and upper_inf(gueltigkeit)))
               / 1000.0, 2)
    into v_erwartet;
  return next is(v_zeile.co2_ersparnis_kg, v_erwartet,
                 'Die CO2-Ersparnis folgt den Werten aus rechenannahme');
  perform set_config('request.jwt.claims', '', true);
end;
$$;
```

- [ ] **Schritt 2: Test laufen lassen, Fehlschlag bestätigen**

```bash
python3 db/test.py db/tests/t0018_wawi_sichten.sql
```
Erwartet: die drei neuen Funktionen schlagen fehl.

- [ ] **Schritt 3: Die Auswertungen an `db/aufbau/0018_wawi_sichten.sql` anhängen**

```sql
-- ---- Umsatz nach Radtyp ----------------------------------------------
-- Monatsweise, weil eine Jahressumme keine Frage beantwortet, die
-- jemand tatsaechlich stellt.
create or replace view velocity.v_wawi_umsatz_radtyp as
select date_trunc('month', a.startzeit)::date              as monat,
       t.typ_code,
       t.bezeichnung                                       as typ,
       count(distinct a.ausleihe_id)                       as fahrten,
       sum(a.dauer_minuten)                                as minuten,
       round(sum(ep.betrag * ea.vorzeichen), 2)            as umsatz,
       round(sum(ep.betrag * ea.vorzeichen)
             / nullif(count(distinct a.ausleihe_id), 0), 2) as umsatz_je_fahrt
  from velocity.ausleihe a
  join velocity.entgeltposition ep using (ausleihe_id)
  join velocity.entgeltart      ea using (entgeltart_id)
  join velocity.fahrrad         f  on f.fahrrad_id = a.fahrrad_id
  join velocity.fahrradmodell   mo on mo.modell_id = f.modell_id
  join velocity.fahrradtyp      t  on t.typ_id     = mo.typ_id
 where a.status = 'abgeschlossen'
   and (velocity.hat_rolle('leitung') or velocity.hat_rolle('disposition'))
 group by 1, 2, 3;

-- ---- Umsatz nach Kundengruppe ----------------------------------------
-- Die Gruppe ist der Tarif zum Zeitpunkt der FAHRT, nicht der heutige.
-- Wer im Maerz Student war und im Juli nicht mehr, gehoert im Maerz zu
-- den Studenten - alles andere schriebe die Vergangenheit um.
create or replace view velocity.v_wawi_umsatz_kundengruppe as
select date_trunc('month', a.startzeit)::date   as monat,
       coalesce(tr.tarif_code, 'OHNE')          as tarif_code,
       coalesce(tr.bezeichnung, 'Ohne Mitgliedschaft') as tarif,
       count(distinct a.kunde_id)               as kunden,
       count(distinct a.ausleihe_id)            as fahrten,
       round(sum(ep.betrag * ea.vorzeichen), 2) as umsatz,
       round(sum(ep.betrag * ea.vorzeichen)
             / nullif(count(distinct a.kunde_id), 0), 2) as umsatz_je_kunde
  from velocity.ausleihe a
  join velocity.entgeltposition ep using (ausleihe_id)
  join velocity.entgeltart      ea using (entgeltart_id)
  left join velocity.mitgliedschaft m on m.mitgliedschaft_id = a.mitgliedschaft_id
  left join velocity.tarif         tr on tr.tarif_id = m.tarif_id
 where a.status = 'abgeschlossen'
   and velocity.hat_rolle('leitung')
 group by 1, 2, 3;

-- ---- Strecke je Fahrt ------------------------------------------------
-- Hilfssicht. Sie traegt die einzige Stelle, an der geschaetzt wird -
-- und die Kennzeichnung, DASS geschaetzt wurde. Eine Kennzahl, die ihre
-- eigene Unsicherheit nicht mitliefert, ist fuer Marketing brauchbar
-- und fuer alles andere gefaehrlich.
create or replace view velocity.v_wawi_fahrt_km as
select a.ausleihe_id,
       a.startzeit,
       a.kunde_id,
       t.typ_code,
       coalesce(
         a.distanz_km,
         round(velocity.fn_luftlinie_km(
                 coalesce(s1.latitude,  a.start_latitude),
                 coalesce(s1.longitude, a.start_longitude),
                 coalesce(s2.latitude,  a.end_latitude),
                 coalesce(s2.longitude, a.end_longitude)) * ra.wert, 2)
       )                        as kilometer,
       a.distanz_km is null     as ist_geschaetzt
  from velocity.ausleihe a
  join velocity.fahrrad       f  on f.fahrrad_id = a.fahrrad_id
  join velocity.fahrradmodell mo on mo.modell_id = f.modell_id
  join velocity.fahrradtyp    t  on t.typ_id     = mo.typ_id
  left join velocity.station s1 on s1.station_id = a.start_station_id
  left join velocity.station s2 on s2.station_id = a.end_station_id
  left join velocity.rechenannahme ra
         on ra.code = 'umwegfaktor' and ra.gueltigkeit @> a.startzeit::date
 where a.status = 'abgeschlossen'
   and velocity.ist_mitarbeiter();

-- ---- Kilometer und CO2 -----------------------------------------------
-- Die Ersparnis ist die Differenz zum Pkw, nicht die Emission des
-- Rades. Beide Faktoren kommen aus rechenannahme und gelten zum
-- Zeitpunkt der Fahrt - dieselbe Zeitscheibenlogik wie bei den Preisen.
create or replace view velocity.v_wawi_km_co2 as
select date_trunc('month', k.startzeit)::date as monat,
       k.typ_code,
       count(*)                                        as fahrten,
       round(sum(k.kilometer), 1)                      as kilometer,
       round(avg(case when k.ist_geschaetzt then 1.0 else 0.0 end), 3)
                                                       as anteil_geschaetzt,
       round(sum(k.kilometer * (pkw.wert - eigen.wert)) / 1000.0, 2)
                                                       as co2_ersparnis_kg
  from velocity.v_wawi_fahrt_km k
  join velocity.rechenannahme pkw
    on pkw.code = 'co2_pkw' and pkw.gueltigkeit @> k.startzeit::date
  join velocity.rechenannahme eigen
    on eigen.code = case when k.typ_code = 'CITY' then 'co2_rad' else 'co2_ebike' end
   and eigen.gueltigkeit @> k.startzeit::date
 where k.kilometer is not null
 group by 1, 2;

-- ---- Stationsauslastung ----------------------------------------------
create or replace view velocity.v_wawi_stationsauslastung as
select s.station_id,
       s.stationsnummer,
       s.name,
       s.kapazitaet,
       (select count(*) from velocity.ausleihe a
         where a.start_station_id = s.station_id and a.status = 'abgeschlossen') as abgaenge,
       (select count(*) from velocity.ausleihe a
         where a.end_station_id = s.station_id and a.status = 'abgeschlossen')   as zugaenge,
       (select count(*) from velocity.ausleihe a
         where a.end_station_id = s.station_id and a.status = 'abgeschlossen')
       - (select count(*) from velocity.ausleihe a
           where a.start_station_id = s.station_id and a.status = 'abgeschlossen') as saldo,
       (select count(*) from velocity.fahrrad_position fp
         where fp.station_id = s.station_id)                                     as belegt,
       round((select count(*) from velocity.fahrrad_position fp
               where fp.station_id = s.station_id)::numeric
             / nullif(s.kapazitaet, 0), 3)                                       as fuellstand
  from velocity.station s
 where velocity.hat_rolle('disposition') or velocity.hat_rolle('leitung');

comment on view velocity.v_wawi_fahrt_km is
  'Einzige Stelle, an der Strecken geschaetzt werden. ist_geschaetzt sagt, ob.';
comment on view velocity.v_wawi_km_co2 is
  'CO2-Ersparnis gegenueber dem Pkw. anteil_geschaetzt gehoert in jede Darstellung dieser Zahl.';
```

- [ ] **Schritt 4: Anwenden und Tests laufen lassen**

```bash
python3 db/run.py db/aufbau/0018_wawi_sichten.sql
python3 db/run.py db/aufbau/0018_wawi_sichten.sql
python3 db/test.py db/tests/t0018_wawi_sichten.sql db/tests/t0012_dokumentation.sql
```
Erwartet: beide Läufe fehlerfrei, alle acht Testfunktionen `ok` — und
`test_doku_vollstaendig` grün. Auch die fünf Auswertungssichten brauchen
Kommentare an der Sicht und an jeder Spalte. Bei `anteil_geschaetzt` und
`co2_ersparnis_kg` ist der Kommentar wichtiger als anderswo: er hält
fest, dass die eine Zahl die Unsicherheit der anderen ist.

- [ ] **Schritt 5: Die Zahlen ansehen**

```bash
python3 -c "
import os,psycopg
for z in open('.env',encoding='utf-8'):
    z=z.strip()
    if z and not z.startswith('#') and '=' in z:
        k,v=z.split('=',1); os.environ.setdefault(k,v)
c=psycopg.connect(host=os.environ['PGHOST'],port=os.environ['PGPORT'],dbname=os.environ['PGDATABASE'],
                  user=os.environ['PGUSER'],password=os.environ['PGPASSWORD']).cursor()
c.execute('select monat, typ_code, fahrten, kilometer, anteil_geschaetzt, co2_ersparnis_kg'
          '  from velocity.v_wawi_km_co2 order by monat, typ_code limit 12')
for r in c.fetchall(): print(r)
"
```
Als `postgres` gilt `ist_mitarbeiter()` nicht — die Sicht liefert dann **leer**. Das ist richtig so und beweist die Sperre. Zum Ansehen der Zahlen vorher in derselben Sitzung `set_config('request.jwt.claims', ...)` mit der `auth_uid` von `M-0001` setzen.

- [ ] **Schritt 6: Commit**

```bash
git add db/aufbau/0018_wawi_sichten.sql db/tests/t0018_wawi_sichten.sql
git commit -m "feat(wawi): Auswertungen - Umsatz, Kilometer und CO2 mit ausgewiesenem Schaetzanteil"
```

---

## Aufgabe 12: Schreibende Funktionen — Flotte und Stationen

**Dateien:**
- Anlegen: `db/aufbau/0019_wawi_logik.sql` (erster Teil)
- Test: `db/tests/t0019_wawi_logik.sql`

**Schnittstellen:**
- Nutzt: `velocity.hat_rolle(text)`, `velocity.mitarbeiter_id_aus_auth()` aus Aufgabe 9
- Liefert: `velocity.fn_rolle_verlangen(p_code text) returns bigint`; `api_rad_anlegen(p_rahmennummer text, p_modell_id bigint, p_station_id bigint) returns bigint`; `api_rad_status_setzen(p_fahrrad_id bigint, p_status text, p_bemerkung text) returns void`; `api_rad_ausmustern(p_fahrrad_id bigint, p_grund text) returns void`; `api_station_anlegen(p_name text, p_strasse text, p_hausnummer text, p_plz text, p_ort text, p_latitude numeric, p_longitude numeric, p_kapazitaet integer) returns bigint`; `api_station_stilllegen(p_station_id bigint, p_zum date) returns void`

- [ ] **Schritt 1: Testdatei anlegen**

`db/tests/t0019_wawi_logik.sql`:

```sql
-- =====================================================================
-- t0019 Schreibende Funktionen der Warenwirtschaft
-- =====================================================================
create schema if not exists velocity_test;
set search_path = velocity_test, velocity, extensions, public;

-- Vorrichtung: angemeldeter Mitarbeiter mit genau den genannten Rollen.
create or replace function velocity_test.fixture_rollen(p_suffix text, p_codes text[])
returns uuid language plpgsql as $$
declare v_uid uuid := gen_random_uuid(); v_m bigint;
begin
  insert into velocity.mitarbeiter (personalnummer, auth_uid, vorname, nachname, email)
       values ('L-' || p_suffix, v_uid, 'Lena', 'Test', 'l-' || p_suffix || '@example.org')
    returning mitarbeiter_id into v_m;
  insert into velocity.mitarbeiter_rolle (mitarbeiter_id, rolle_id)
  select v_m, rolle_id from velocity.rolle where code = any(p_codes);
  perform set_config('request.jwt.claims', json_build_object('sub', v_uid)::text, true);
  return v_uid;
end;
$$;

create or replace function velocity_test.test_l_ohne_rolle_kein_schreiben()
returns setof text language plpgsql as $$
declare v_modell bigint;
begin
  select modell_id into v_modell from velocity.fahrradmodell order by modell_id limit 1;
  perform velocity_test.fixture_rollen('ohne', array['werkstatt']);
  -- Werkstatt darf reparieren, nicht beschaffen. Die Pruefung sitzt in
  -- der Funktion, nicht in der Oberflaeche: sonst genuegte ein
  -- HTTP-Aufruf an PostgREST, um sie zu umgehen.
  return next throws_ok(
    format($q$ select velocity.api_rad_anlegen('RN-L-1', %s, null) $q$, v_modell),
    '42501', null,
    'Ohne Rolle disposition kein neues Rad');
  perform set_config('request.jwt.claims', '', true);
end;
$$;

create or replace function velocity_test.test_l_rad_anlegen_und_status()
returns setof text language plpgsql as $$
declare v_modell bigint; v_f bigint; v_n integer;
begin
  select modell_id into v_modell from velocity.fahrradmodell order by modell_id limit 1;
  perform velocity_test.fixture_rollen('rad', array['disposition']);
  v_f := velocity.api_rad_anlegen('RN-L-2', v_modell, null);
  return next ok(v_f is not null, 'Das Rad wird angelegt');

  -- GR21: die Anschaffung steht in der Lebenslaufakte.
  select count(*) into v_n from velocity.fahrrad_ereignis
   where fahrrad_id = v_f and ereignisart = 'angeschafft';
  return next is(v_n, 1, 'Die Anschaffung erzeugt ein Ereignis');

  perform velocity.api_rad_status_setzen(v_f, 'wartung', 'Inspektion faellig');
  return next is(
    (select status::text from velocity.fahrrad where fahrrad_id = v_f),
    'wartung', 'Der Status wird gesetzt');
  perform set_config('request.jwt.claims', '', true);
end;
$$;

create or replace function velocity_test.test_l_rad_in_fahrt_nicht_ausmustern()
returns setof text language plpgsql as $$
declare v_f record; v_a bigint;
begin
  select * into v_f from velocity_test.fixture_rad('ausmustern');
  insert into velocity.ausleihe (kunde_id, fahrrad_id, start_station_id, startzeit)
  select v_f.o_kunde_id, v_f.o_fahrrad_id, station_id, now()
    from velocity.station order by station_id limit 1;
  perform velocity_test.fixture_rollen('ausm', array['disposition']);
  -- GR20: ein Rad, auf dem gerade jemand sitzt, verschwindet nicht aus
  -- dem Bestand.
  return next throws_ok(
    format($q$ select velocity.api_rad_ausmustern(%s, 'Rahmenbruch') $q$, v_f.o_fahrrad_id),
    'P0001', null,
    'Ein Rad mit laufender Ausleihe wird nicht ausgemustert');
  perform set_config('request.jwt.claims', '', true);
end;
$$;

create or replace function velocity_test.test_l_station_wird_stillgelegt_nicht_geloescht()
returns setof text language plpgsql as $$
declare v_s bigint;
begin
  perform velocity_test.fixture_rollen('stat', array['disposition']);
  v_s := velocity.api_station_anlegen('Teststation L', 'Teststrasse', '1',
                                      '97070', 'Wuerzburg', 49.79, 9.93, 12);
  return next ok(v_s is not null, 'Die Station wird angelegt');

  perform velocity.api_station_stilllegen(v_s, current_date);
  -- GR22: eine Station verschwindet nicht, sie hoert ab einem Datum auf
  -- zu existieren. Sonst verloeren alle Fahrten dorthin ihren Ort.
  return next ok(
    (select station_id from velocity.station where station_id = v_s) is not null,
    'Die Station bleibt als Satz erhalten');
  return next ok(
    not (select upper_inf(betriebszeitraum) from velocity.station where station_id = v_s),
    'Ihr Betriebszeitraum ist geschlossen');
  perform set_config('request.jwt.claims', '', true);
end;
$$;
```

- [ ] **Schritt 2: Test laufen lassen, Fehlschlag bestätigen**

```bash
python3 db/test.py db/tests/t0005_bereich_d.sql db/tests/t0015_bereich_i.sql db/tests/t0019_wawi_logik.sql
```
Erwartet: Fehler, weil `velocity.api_rad_anlegen` nicht existiert.

Die beiden vorangestellten Dateien sind kein Zierrat: `t0019` benutzt
`velocity_test.fixture_rad` aus `t0005` und `fixture_wartungsrad` aus
`t0015`. `t0000_rahmen.sql` wirft das Schema `velocity_test` zu Beginn
jedes vollständigen Laufs weg, deshalb müssen die Vorrichtungen bei
einem Einzellauf mit eingespielt werden.

- [ ] **Schritt 3: Aufbaudatei schreiben**

`db/aufbau/0019_wawi_logik.sql`:

```sql
-- =====================================================================
-- 0019 Schreibende Funktionen der Warenwirtschaft
--
-- Zweck:      Alles, was die Warenwirtschaft aendert, laeuft hier
--             hindurch. Die Oberflaeche schreibt nie in eine Tabelle -
--             dieselbe Regel wie fuer die Website, und tools/abnahme.sh
--             prueft sie von aussen.
-- Objekte:    velocity.fn_rolle_verlangen, velocity.api_rad_anlegen,
--             api_rad_status_setzen, api_rad_ausmustern,
--             api_station_anlegen, api_station_stilllegen,
--             api_kunde_anlegen, api_kunde_aktualisieren,
--             api_kunde_sperren, api_kunde_auskunft,
--             api_kunde_anonymisieren, api_schaden_melden,
--             api_auftrag_eroeffnen, api_auftrag_erledigen
-- Ruecknahme: DROP FUNCTION fuer dieselben Namen.
-- =====================================================================

-- Jede api_-Funktion beginnt mit fn_rolle_verlangen. Der Rueckgabewert
-- ist die mitarbeiter_id - so wird in einem Schritt geprueft UND der
-- Verursacher ermittelt, statt zweimal dasselbe nachzuschlagen.
create or replace function velocity.fn_rolle_verlangen(p_code text)
returns bigint
language plpgsql
stable
security definer
set search_path = velocity, pg_temp
as $$
declare v_m bigint;
begin
  v_m := velocity.mitarbeiter_id_aus_auth();
  if v_m is null then
    raise exception 'Kein aktiver Mitarbeiter angemeldet'
      using errcode = '42501';
  end if;
  if not velocity.hat_rolle(p_code) then
    raise exception 'Rolle % erforderlich', p_code
      using errcode = '42501';
  end if;
  return v_m;
end;
$$;

-- ---- Flotte ----------------------------------------------------------
create or replace function velocity.api_rad_anlegen(
  p_rahmennummer text, p_modell_id bigint, p_station_id bigint default null
)
returns bigint
language plpgsql
security definer
set search_path = velocity, pg_temp
as $$
declare v_m bigint; v_f bigint;
begin
  v_m := velocity.fn_rolle_verlangen('disposition');

  insert into velocity.fahrrad (rahmennummer, modell_id, status, angeschafft_am)
       values (p_rahmennummer, p_modell_id, 'verfuegbar', current_date)
    returning fahrrad_id into v_f;

  -- GR12 aus Phase 1: ein Rad ohne bekannten Standort laesst sich nicht
  -- ausleihen. Ein neues Rad bekommt deshalb sofort eine Position.
  insert into velocity.fahrrad_position (fahrrad_id, station_id, akkustand_prozent)
       values (v_f, p_station_id, 100);

  insert into velocity.fahrrad_ereignis
         (fahrrad_id, ereignisart, mitarbeiter_id, bemerkung, beleg_tabelle, beleg_id)
  values (v_f, 'angeschafft', v_m, 'Neu ins System aufgenommen', 'fahrrad', v_f);

  return v_f;
end;
$$;

create or replace function velocity.api_rad_status_setzen(
  p_fahrrad_id bigint, p_status text, p_bemerkung text default null
)
returns void
language plpgsql
security definer
set search_path = velocity, pg_temp
as $$
declare v_m bigint;
begin
  -- Werkstatt UND Disposition duerfen das: die eine setzt 'wartung',
  -- die andere 'verfuegbar'. Eine gemeinsame Funktion statt zweier
  -- fast gleicher.
  if velocity.hat_rolle('werkstatt') then
    v_m := velocity.fn_rolle_verlangen('werkstatt');
  else
    v_m := velocity.fn_rolle_verlangen('disposition');
  end if;

  if p_status = 'ausgemustert' then
    raise exception 'Zum Ausmustern api_rad_ausmustern verwenden'
      using errcode = 'P0001';
  end if;

  update velocity.fahrrad
     set status = p_status::velocity.fahrrad_status
   where fahrrad_id = p_fahrrad_id;
  if not found then
    raise exception 'Rad % nicht gefunden', p_fahrrad_id using errcode = 'P0001';
  end if;

  -- Der Trigger trg_fahrrad_ereignis hat den Wechsel bereits
  -- festgehalten; hier kommt nur die Begruendung dazu.
  if p_bemerkung is not null then
    update velocity.fahrrad_ereignis
       set bemerkung = bemerkung || ' - ' || p_bemerkung, mitarbeiter_id = v_m
     where ereignis_id = (select max(ereignis_id) from velocity.fahrrad_ereignis
                           where fahrrad_id = p_fahrrad_id);
  end if;
end;
$$;

create or replace function velocity.api_rad_ausmustern(
  p_fahrrad_id bigint, p_grund text
)
returns void
language plpgsql
security definer
set search_path = velocity, pg_temp
as $$
declare v_m bigint;
begin
  v_m := velocity.fn_rolle_verlangen('disposition');

  -- GR20: ein Rad, auf dem gerade jemand sitzt, verschwindet nicht aus
  -- dem Bestand. Die Pruefung steht hier und nicht als CHECK, weil sie
  -- zwei Tabellen betrifft.
  if exists (select 1 from velocity.ausleihe a
              where a.fahrrad_id = p_fahrrad_id and a.status = 'aktiv') then
    raise exception 'Rad % ist in Fahrt und kann nicht ausgemustert werden', p_fahrrad_id
      using errcode = 'P0001';
  end if;

  update velocity.fahrrad
     set status = 'ausgemustert', ausgemustert_am = current_date
   where fahrrad_id = p_fahrrad_id;
  if not found then
    raise exception 'Rad % nicht gefunden', p_fahrrad_id using errcode = 'P0001';
  end if;

  -- Kein delete: die Fahrten dieses Rades bleiben abgerechnet, und die
  -- Lebenslaufakte behaelt ihren Bezug. Dasselbe Muster wie bei Kunden
  -- (GR18) und Stationen (GR22).
  delete from velocity.fahrrad_position where fahrrad_id = p_fahrrad_id;

  update velocity.fahrrad_ereignis
     set mitarbeiter_id = v_m, bemerkung = bemerkung || ' - ' || p_grund
   where ereignis_id = (select max(ereignis_id) from velocity.fahrrad_ereignis
                         where fahrrad_id = p_fahrrad_id);
end;
$$;

-- ---- Stationen -------------------------------------------------------
create or replace function velocity.api_station_anlegen(
  p_name text, p_strasse text, p_hausnummer text, p_plz text, p_ort text,
  p_latitude numeric, p_longitude numeric, p_kapazitaet integer
)
returns bigint
language plpgsql
security definer
set search_path = velocity, pg_temp
as $$
declare v_m bigint; v_adresse bigint; v_s bigint; v_nummer text;
begin
  v_m := velocity.fn_rolle_verlangen('disposition');

  insert into velocity.adresse (strasse, hausnummer, plz, ort)
       values (p_strasse, p_hausnummer, p_plz, p_ort)
    returning adresse_id into v_adresse;

  select 'ST-' || lpad((coalesce(max(substring(stationsnummer from '\d+')::integer), 0) + 1)::text,
                       3, '0')
    into v_nummer
    from velocity.station where stationsnummer ~ '^ST-\d+$';

  insert into velocity.station
         (stationsnummer, name, adresse_id, latitude, longitude, kapazitaet)
       values (coalesce(v_nummer, 'ST-001'), p_name, v_adresse,
               p_latitude, p_longitude, p_kapazitaet)
    returning station_id into v_s;

  return v_s;
end;
$$;

create or replace function velocity.api_station_stilllegen(
  p_station_id bigint, p_zum date default current_date
)
returns void
language plpgsql
security definer
set search_path = velocity, pg_temp
as $$
declare v_m bigint; v_raeder integer;
begin
  v_m := velocity.fn_rolle_verlangen('disposition');

  -- GR22: eine Station wird stillgelegt, nicht geloescht. Ein delete
  -- scheiterte ohnehin am on delete restrict der Ausleihen - aber mit
  -- einer Fehlermeldung, die niemandem sagt, was zu tun ist.
  select count(*) into v_raeder
    from velocity.fahrrad_position where station_id = p_station_id;
  if v_raeder > 0 then
    raise exception 'An Station % stehen noch % Raeder. Erst umsetzen, dann stilllegen.',
      p_station_id, v_raeder using errcode = 'P0001';
  end if;

  update velocity.station
     set betriebszeitraum = daterange(lower(betriebszeitraum), p_zum, '[)')
   where station_id = p_station_id;
  if not found then
    raise exception 'Station % nicht gefunden', p_station_id using errcode = 'P0001';
  end if;
end;
$$;
```

- [ ] **Schritt 4: Anwenden und Tests laufen lassen**

```bash
python3 db/run.py db/aufbau/0019_wawi_logik.sql
python3 db/run.py db/aufbau/0019_wawi_logik.sql
python3 db/test.py db/tests/t0005_bereich_d.sql db/tests/t0015_bereich_i.sql db/tests/t0019_wawi_logik.sql
```
Erwartet: beide Läufe fehlerfrei, alle vier Testfunktionen `ok`.

- [ ] **Schritt 5: Commit**

```bash
git add db/aufbau/0019_wawi_logik.sql db/tests/t0019_wawi_logik.sql
git commit -m "feat(wawi): schreibende Funktionen fuer Flotte und Stationen"
```

---

## Aufgabe 13: Schreibende Funktionen — Kunden, Betroffenenrechte, Instandhaltung

**Der wichtigste Teil des ganzen Plans.** Hier steht der Lehrpunkt des Bereichs: „Recht auf Löschung" ist im Datenmodell **keine** `DELETE`-Anweisung.

**Dateien:**
- Ändern: `db/aufbau/0019_wawi_logik.sql` (anhängen)
- Ändern: `db/tests/t0019_wawi_logik.sql` (anhängen)

**Schnittstellen:**
- Liefert: `api_kunde_anlegen(p_vorname text, p_nachname text, p_email text, p_telefon text) returns bigint`; `api_kunde_aktualisieren(p_kunde_id bigint, p_vorname text, p_nachname text, p_telefon text, p_strasse text, p_hausnummer text, p_plz text, p_ort text) returns void`; `api_kunde_sperren(p_kunde_id bigint, p_grund text) returns void`; `api_kunde_auskunft(p_kunde_id bigint) returns jsonb`; `api_kunde_anonymisieren(p_kunde_id bigint, p_grund text) returns void`; `api_schaden_melden(p_fahrrad_id bigint, p_kategorie text, p_beschreibung text, p_schwere text) returns bigint`; `api_auftrag_eroeffnen(p_fahrrad_id bigint, p_schadensmeldung_id bigint) returns bigint`; `api_auftrag_erledigen(p_wartungsauftrag_id bigint, p_arbeitszeit_minuten integer, p_bemerkung text) returns void`

- [ ] **Schritt 1: Tests ergänzen**

Ans Ende von `db/tests/t0019_wawi_logik.sql`:

```sql
create or replace function velocity_test.test_l_anonymisieren_statt_loeschen()
returns setof text language plpgsql as $$
declare v_k bigint; v_r bigint; v_kunde record;
begin
  insert into velocity.kunde (email, vorname, nachname, telefon, geburtsdatum)
       values ('l-dsgvo@example.org', 'Lars', 'Loeschmich', '0931 999', date '1990-05-05')
    returning kunde_id into v_k;
  insert into velocity.rechnung (rechnungsnummer, kunde_id, periode_jahr, periode_monat,
                                 erstellt_am_beleg, betrag_netto, ust_satz, ust_betrag,
                                 betrag_brutto, status)
       values ('R-TEST-DSGVO', v_k, 2026, 1, date '2026-02-01',
               10.00, 19.00, 1.90, 11.90, 'bezahlt')
    returning rechnung_id into v_r;

  perform velocity_test.fixture_rollen('dsgvo', array['kundenservice']);
  perform velocity.api_kunde_anonymisieren(v_k, 'Antrag nach Art. 17 DSGVO');

  select * into v_kunde from velocity.kunde where kunde_id = v_k;
  return next ok(v_kunde.kunde_id is not null,
                 'Der Kundensatz bleibt bestehen');
  return next is(v_kunde.vorname, 'Geloescht', 'Der Vorname ist unkenntlich');
  return next is(v_kunde.nachname, 'Geloescht', 'Der Nachname ist unkenntlich');
  return next ok(v_kunde.email like 'anonym-%@velocity.invalid',
                 'Die E-Mail ist ersetzt, nicht geleert - sie ist eindeutig');
  return next ok(v_kunde.telefon is null,     'Die Telefonnummer ist entfernt');
  return next ok(v_kunde.geburtsdatum is null,'Das Geburtsdatum ist entfernt');
  return next is(v_kunde.status::text, 'geschlossen', 'Das Konto ist geschlossen');

  -- Der eigentliche Punkt: Paragraf 147 AO verlangt zehn Jahre
  -- Aufbewahrung fuer Rechnungsbelege, Art. 17 Abs. 3 lit. b DSGVO nimmt
  -- genau solche Pflichten von der Loeschpflicht aus. Wer den Kunden
  -- loescht, verstoesst gegen das Steuerrecht; wer nichts tut, gegen die
  -- DSGVO. Anonymisieren erfuellt beides.
  return next ok(
    (select betrag_brutto from velocity.rechnung where rechnung_id = v_r) = 11.90,
    'Die Rechnung bleibt vollstaendig erhalten');
  perform set_config('request.jwt.claims', '', true);
end;
$$;

create or replace function velocity_test.test_l_auskunft_ist_vollstaendig()
returns setof text language plpgsql as $$
declare v_k bigint; v_j jsonb;
begin
  insert into velocity.kunde (email, vorname, nachname)
       values ('l-auskunft@example.org', 'Lea', 'Auskunft') returning kunde_id into v_k;
  perform velocity_test.fixture_rollen('ausk', array['kundenservice']);
  v_j := velocity.api_kunde_auskunft(v_k);

  -- Art. 15 DSGVO: alles, was zu der Person gespeichert ist, in einem
  -- Dokument. Fehlt ein Abschnitt, ist die Auskunft unvollstaendig -
  -- und damit keine.
  return next ok(v_j ? 'stammdaten',      'Die Auskunft enthaelt die Stammdaten');
  return next ok(v_j ? 'mitgliedschaften','Die Auskunft enthaelt die Mitgliedschaften');
  return next ok(v_j ? 'fahrten',         'Die Auskunft enthaelt die Fahrten');
  return next ok(v_j ? 'rechnungen',      'Die Auskunft enthaelt die Rechnungen');
  -- Aber nicht das, was auch der Kundenservice nicht sehen darf.
  return next ok(not (v_j ? 'zahlungsmittel'),
                 'Die Auskunft enthaelt keine Zahlungsmittel');

  -- GR19: der Auskunftsaufruf selbst wird protokolliert. Wer Daten
  -- einsieht, hinterlaesst eine Spur.
  return next isnt_empty(
    format($q$ select 1 from velocity.aenderungsprotokoll
                where tabelle = 'kunde' and datensatz_id = %s
                  and feld = 'auskunft_erteilt' $q$, v_k),
    'Die Auskunftserteilung ist protokolliert');
  perform set_config('request.jwt.claims', '', true);
end;
$$;

create or replace function velocity_test.test_l_kundenservice_kennt_keine_zahlungsmittel()
returns setof text language plpgsql as $$
begin
  perform velocity_test.fixture_rollen('zahl', array['kundenservice']);
  -- GR17. Der Test steht hier ein zweites Mal, in der Rolle, die dem
  -- Kunden am naechsten ist: wenn irgendwo eine Luecke entsteht, dann
  -- hier.
  --
  -- set local role ist keine Umstaendlichkeit, sondern der Kern des
  -- Tests: db/test.py verbindet sich als postgres, und ein Superuser
  -- umgeht JEDE Rechtepruefung. Ohne Rollenwechsel koennte dieser Test
  -- nie fehlschlagen - er waere eine Zusicherung, die nichts zusichert.
  set local role authenticated;
  return next throws_ok(
    $q$ select 1 from velocity.zahlungsmittel limit 1 $q$,
    '42501', null,
    'Auch der Kundenservice kommt nicht an die Zahlungsmittel');
  reset role;
  perform set_config('request.jwt.claims', '', true);
end;
$$;

create or replace function velocity_test.test_l_schaden_und_auftrag()
returns setof text language plpgsql as $$
declare v_f bigint; v_s bigint; v_w bigint;
begin
  v_f := velocity_test.fixture_wartungsrad('ablauf');
  perform velocity_test.fixture_rollen('werk', array['werkstatt']);

  v_s := velocity.api_schaden_melden(v_f, 'Bremse', 'Bremse greift nicht', 'fahruntauglich');
  return next ok(v_s is not null, 'Die Meldung wird angelegt');
  -- Ein fahruntaugliches Rad gehoert sofort aus dem Verkehr. Das darf
  -- nicht davon abhaengen, ob jemand daran denkt.
  return next is(
    (select status::text from velocity.fahrrad where fahrrad_id = v_f),
    'defekt', 'Ein fahruntauglicher Schaden setzt das Rad auf defekt');

  v_w := velocity.api_auftrag_eroeffnen(v_f, v_s);
  return next is(
    (select status::text from velocity.schadensmeldung where schadensmeldung_id = v_s),
    'in_arbeit', 'Die Meldung wechselt auf in_arbeit');

  perform velocity.api_auftrag_erledigen(v_w, 45, 'Bremszug getauscht');
  return next is(
    (select status::text from velocity.schadensmeldung where schadensmeldung_id = v_s),
    'behoben', 'Mit dem Auftrag gilt der Schaden als behoben');
  return next is(
    (select status::text from velocity.fahrrad where fahrrad_id = v_f),
    'verfuegbar', 'Das Rad ist wieder verfuegbar');
  perform set_config('request.jwt.claims', '', true);
end;
$$;
```

- [ ] **Schritt 2: Test laufen lassen, Fehlschlag bestätigen**

```bash
python3 db/test.py db/tests/t0005_bereich_d.sql db/tests/t0015_bereich_i.sql db/tests/t0019_wawi_logik.sql
```
Erwartet: die vier neuen Funktionen schlagen fehl.

- [ ] **Schritt 3: An `db/aufbau/0019_wawi_logik.sql` anhängen**

```sql
-- ---- Kunden ----------------------------------------------------------
create or replace function velocity.api_kunde_anlegen(
  p_vorname text, p_nachname text, p_email text, p_telefon text default null
)
returns bigint
language plpgsql
security definer
set search_path = velocity, pg_temp
as $$
declare v_m bigint; v_k bigint;
begin
  v_m := velocity.fn_rolle_verlangen('kundenservice');
  insert into velocity.kunde (vorname, nachname, email, telefon, status)
       values (p_vorname, p_nachname, lower(btrim(p_email)), p_telefon, 'aktiv')
    returning kunde_id into v_k;
  -- auth_uid bleibt leer: das Konto entsteht, wenn sich die Person das
  -- erste Mal anmeldet. Ein Mitarbeiter kann und soll kein Passwort
  -- setzen.
  return v_k;
end;
$$;

create or replace function velocity.api_kunde_aktualisieren(
  p_kunde_id bigint, p_vorname text, p_nachname text, p_telefon text default null,
  p_strasse text default null, p_hausnummer text default null,
  p_plz text default null, p_ort text default null
)
returns void
language plpgsql
security definer
set search_path = velocity, pg_temp
as $$
declare v_m bigint; v_adresse bigint;
begin
  v_m := velocity.fn_rolle_verlangen('kundenservice');

  if p_strasse is not null then
    select rechnungsadresse_id into v_adresse from velocity.kunde where kunde_id = p_kunde_id;
    if v_adresse is null then
      insert into velocity.adresse (strasse, hausnummer, plz, ort)
           values (p_strasse, p_hausnummer, p_plz, p_ort) returning adresse_id into v_adresse;
    else
      update velocity.adresse
         set strasse = p_strasse, hausnummer = p_hausnummer, plz = p_plz, ort = p_ort
       where adresse_id = v_adresse;
    end if;
  end if;

  update velocity.kunde
     set vorname = p_vorname, nachname = p_nachname, telefon = p_telefon,
         rechnungsadresse_id = coalesce(v_adresse, rechnungsadresse_id)
   where kunde_id = p_kunde_id;
  if not found then
    raise exception 'Kunde % nicht gefunden', p_kunde_id using errcode = 'P0001';
  end if;
  -- Die E-Mail wird bewusst NICHT geaendert: sie ist der Anmeldename.
  -- Sie zu aendern ist eine Kontoaenderung und gehoert dem Kunden.
end;
$$;

create or replace function velocity.api_kunde_sperren(
  p_kunde_id bigint, p_grund text
)
returns void
language plpgsql
security definer
set search_path = velocity, pg_temp
as $$
declare v_m bigint;
begin
  v_m := velocity.fn_rolle_verlangen('kundenservice');
  if exists (select 1 from velocity.ausleihe a
              where a.kunde_id = p_kunde_id and a.status = 'aktiv') then
    raise exception 'Kunde % ist gerade unterwegs. Erst Rueckgabe abwarten.', p_kunde_id
      using errcode = 'P0001';
  end if;
  update velocity.kunde set status = 'gesperrt' where kunde_id = p_kunde_id;
  if not found then
    raise exception 'Kunde % nicht gefunden', p_kunde_id using errcode = 'P0001';
  end if;
  insert into velocity.aenderungsprotokoll
         (mitarbeiter_id, tabelle, datensatz_id, aktion, feld, wert_alt, wert_neu)
  values (v_m, 'kunde', p_kunde_id, 'UPDATE', 'sperrgrund', null, p_grund);
end;
$$;

-- Art. 15 DSGVO: Auskunft. Alles zu einer Person in EINEM Dokument -
-- nicht, weil JSON schoen waere, sondern weil die Auskunft als Ganzes
-- herausgegeben wird und nicht als sieben Abfragen.
create or replace function velocity.api_kunde_auskunft(p_kunde_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = velocity, pg_temp
as $$
declare v_m bigint; v_j jsonb;
begin
  v_m := velocity.fn_rolle_verlangen('kundenservice');

  select jsonb_build_object(
    'erteilt_am', now(),
    'rechtsgrundlage', 'Art. 15 DSGVO',
    'stammdaten', (
      select to_jsonb(x) from (
        select k.kunde_id, k.kundennummer, k.anrede, k.vorname, k.nachname,
               k.email, k.telefon, k.geburtsdatum, k.status, k.registriert_am,
               a.strasse, a.hausnummer, a.plz, a.ort
          from velocity.kunde k
          left join velocity.adresse a on a.adresse_id = k.rechnungsadresse_id
         where k.kunde_id = p_kunde_id) x),
    'mitgliedschaften', coalesce((
      select jsonb_agg(to_jsonb(x)) from (
        select m.mitgliedschaft_id, t.tarif_code, t.bezeichnung, m.gueltigkeit
          from velocity.mitgliedschaft m
          join velocity.tarif t on t.tarif_id = m.tarif_id
         where m.kunde_id = p_kunde_id order by lower(m.gueltigkeit)) x), '[]'::jsonb),
    'fahrten', coalesce((
      select jsonb_agg(to_jsonb(x)) from (
        select a.ausleihe_id, a.startzeit, a.endzeit, a.dauer_minuten, a.distanz_km,
               s1.name as von, s2.name as nach
          from velocity.ausleihe a
          left join velocity.station s1 on s1.station_id = a.start_station_id
          left join velocity.station s2 on s2.station_id = a.end_station_id
         where a.kunde_id = p_kunde_id order by a.startzeit) x), '[]'::jsonb),
    'rechnungen', coalesce((
      select jsonb_agg(to_jsonb(x)) from (
        select r.rechnungsnummer, r.periode_jahr, r.periode_monat,
               r.betrag_netto, r.ust_betrag, r.betrag_brutto, r.status
          from velocity.rechnung r
         where r.kunde_id = p_kunde_id
         order by r.periode_jahr, r.periode_monat) x), '[]'::jsonb)
    -- Zahlungsmittel stehen hier NICHT (GR17). Sie sind Teil der
    -- Auskunft, die der Kunde selbst ueber sein Konto erhaelt; der
    -- Kundenservice bekommt sie nie zu sehen, auch nicht mittelbar.
  ) into v_j;

  if v_j -> 'stammdaten' = 'null'::jsonb then
    raise exception 'Kunde % nicht gefunden', p_kunde_id using errcode = 'P0001';
  end if;

  -- Wer Daten einsieht, hinterlaesst eine Spur (GR19).
  insert into velocity.aenderungsprotokoll
         (mitarbeiter_id, tabelle, datensatz_id, aktion, feld, wert_alt, wert_neu)
  values (v_m, 'kunde', p_kunde_id, 'UPDATE', 'auskunft_erteilt', null,
          'Auskunft nach Art. 15 DSGVO erteilt');

  return v_j;
end;
$$;

-- Art. 17 DSGVO: Loeschung. Umgesetzt als Anonymisierung.
--
-- Warum nicht delete: Paragraf 147 AO verlangt zehn Jahre Aufbewahrung
-- fuer Rechnungsbelege. Art. 17 Abs. 3 lit. b DSGVO nimmt genau solche
-- rechtlichen Pflichten von der Loeschpflicht aus. Wer den Kunden
-- loescht, verstoesst gegen das Steuerrecht; wer gar nichts tut, gegen
-- die DSGVO. Anonymisieren erfuellt beides: die Person ist nicht mehr
-- identifizierbar, die Buchhaltung bleibt vollstaendig.
--
-- Das ist der zentrale Lehrpunkt dieses Bereichs: "Recht auf Loeschung"
-- ist im Datenmodell keine DELETE-Anweisung.
create or replace function velocity.api_kunde_anonymisieren(
  p_kunde_id bigint, p_grund text
)
returns void
language plpgsql
security definer
set search_path = velocity, pg_temp
as $$
declare v_m bigint; v_adresse bigint; v_offen integer;
begin
  v_m := velocity.fn_rolle_verlangen('kundenservice');

  select count(*) into v_offen from velocity.ausleihe a
   where a.kunde_id = p_kunde_id and a.status = 'aktiv';
  if v_offen > 0 then
    raise exception 'Kunde % hat eine laufende Fahrt', p_kunde_id using errcode = 'P0001';
  end if;

  select rechnungsadresse_id into v_adresse from velocity.kunde where kunde_id = p_kunde_id;
  if not found then
    raise exception 'Kunde % nicht gefunden', p_kunde_id using errcode = 'P0001';
  end if;

  -- Zahlungsmittel werden geloescht, nicht anonymisiert: sie
  -- unterliegen keiner Aufbewahrungspflicht und haben ohne Person
  -- keinen Zweck.
  delete from velocity.zahlungsmittel where kunde_id = p_kunde_id;

  update velocity.kunde
     set vorname      = 'Geloescht',
         nachname     = 'Geloescht',
         -- Nicht leeren, sondern ersetzen: auf email liegt ein
         -- UNIQUE-Constraint, und mehrere anonymisierte Kunden
         -- muessen nebeneinander bestehen koennen. Die Domain
         -- .invalid ist per RFC 2606 dauerhaft unaufloesbar.
         email        = 'anonym-' || p_kunde_id || '@velocity.invalid',
         telefon      = null,
         geburtsdatum = null,
         anrede       = null,
         auth_uid     = null,
         rechnungsadresse_id = null,
         status       = 'geschlossen'
   where kunde_id = p_kunde_id;

  -- Die Adresse nur dann loeschen, wenn keine gestellte Rechnung sie
  -- noch braucht. Sonst bleibt sie stehen und traegt nur noch die
  -- Rechnung, nicht mehr den Kunden.
  if v_adresse is not null
     and not exists (select 1 from velocity.kunde k where k.rechnungsadresse_id = v_adresse)
     and not exists (select 1 from velocity.station s where s.adresse_id = v_adresse) then
    delete from velocity.adresse where adresse_id = v_adresse;
  end if;

  insert into velocity.aenderungsprotokoll
         (mitarbeiter_id, tabelle, datensatz_id, aktion, feld, wert_alt, wert_neu)
  values (v_m, 'kunde', p_kunde_id, 'UPDATE', 'anonymisiert', null, p_grund);
end;
$$;

-- ---- Instandhaltung --------------------------------------------------
create or replace function velocity.api_schaden_melden(
  p_fahrrad_id bigint, p_kategorie text, p_beschreibung text, p_schwere text
)
returns bigint
language plpgsql
security definer
set search_path = velocity, pg_temp
as $$
declare v_m bigint; v_s bigint;
begin
  v_m := velocity.fn_rolle_verlangen('werkstatt');
  insert into velocity.schadensmeldung
         (fahrrad_id, melder_mitarbeiter_id, kategorie, beschreibung, schwere)
       values (p_fahrrad_id, v_m, p_kategorie, p_beschreibung,
               p_schwere::velocity.schaden_schwere)
    returning schadensmeldung_id into v_s;

  -- Ein fahruntaugliches Rad gehoert sofort aus dem Verkehr. Das darf
  -- nicht davon abhaengen, ob jemand daran denkt, danach noch den
  -- Status zu setzen.
  if p_schwere = 'fahruntauglich' then
    update velocity.fahrrad set status = 'defekt'
     where fahrrad_id = p_fahrrad_id and status <> 'ausgeliehen';
  end if;
  return v_s;
end;
$$;

create or replace function velocity.api_auftrag_eroeffnen(
  p_fahrrad_id bigint, p_schadensmeldung_id bigint default null
)
returns bigint
language plpgsql
security definer
set search_path = velocity, pg_temp
as $$
declare v_m bigint; v_w bigint; v_nummer text;
begin
  v_m := velocity.fn_rolle_verlangen('werkstatt');
  select 'WA-' || to_char(now(), 'YYYY') || '-'
         || lpad((count(*) + 1)::text, 5, '0')
    into v_nummer
    from velocity.wartungsauftrag
   where eroeffnet_am >= date_trunc('year', now());

  insert into velocity.wartungsauftrag
         (auftragsnummer, fahrrad_id, schadensmeldung_id, mitarbeiter_id, status)
       values (v_nummer, p_fahrrad_id, p_schadensmeldung_id, v_m, 'in_arbeit')
    returning wartungsauftrag_id into v_w;

  if p_schadensmeldung_id is not null then
    update velocity.schadensmeldung set status = 'in_arbeit'
     where schadensmeldung_id = p_schadensmeldung_id;
  end if;
  update velocity.fahrrad set status = 'wartung'
   where fahrrad_id = p_fahrrad_id and status <> 'ausgeliehen';
  return v_w;
end;
$$;

create or replace function velocity.api_auftrag_erledigen(
  p_wartungsauftrag_id bigint, p_arbeitszeit_minuten integer, p_bemerkung text default null
)
returns void
language plpgsql
security definer
set search_path = velocity, pg_temp
as $$
declare v_m bigint; v_w velocity.wartungsauftrag%rowtype; v_offen integer;
begin
  v_m := velocity.fn_rolle_verlangen('werkstatt');
  update velocity.wartungsauftrag
     set status = 'erledigt', erledigt_am = now(),
         arbeitszeit_minuten = p_arbeitszeit_minuten,
         bemerkung = p_bemerkung, mitarbeiter_id = coalesce(mitarbeiter_id, v_m)
   where wartungsauftrag_id = p_wartungsauftrag_id
  returning * into v_w;
  if not found then
    raise exception 'Auftrag % nicht gefunden', p_wartungsauftrag_id using errcode = 'P0001';
  end if;

  if v_w.schadensmeldung_id is not null then
    update velocity.schadensmeldung set status = 'behoben'
     where schadensmeldung_id = v_w.schadensmeldung_id;
  end if;

  insert into velocity.fahrrad_ereignis
         (fahrrad_id, ereignisart, mitarbeiter_id, bemerkung, beleg_tabelle, beleg_id)
  values (v_w.fahrrad_id, 'gewartet', v_m, coalesce(p_bemerkung, 'Wartung erledigt'),
          'wartungsauftrag', v_w.wartungsauftrag_id);

  -- Das Rad wird nur frei, wenn kein anderer Schaden mehr offen ist.
  -- Sonst repariert man eine Bremse und schickt ein Rad mit gebrochener
  -- Gabel zurueck auf die Strasse.
  select count(*) into v_offen from velocity.schadensmeldung sm
   where sm.fahrrad_id = v_w.fahrrad_id and sm.status in ('offen', 'in_arbeit');
  if v_offen = 0 then
    update velocity.fahrrad set status = 'verfuegbar'
     where fahrrad_id = v_w.fahrrad_id and status = 'wartung';
  end if;
end;
$$;

-- ---- GR19 auf die uebrigen Stammdaten ausweiten ----------------------
-- kunde traegt das Protokoll seit 0016. Diese drei kommen dazu, sobald
-- es Funktionen gibt, die sie aendern.
select velocity.fn_protokoll_anhaengen('mitarbeiter', 'mitarbeiter_id');
select velocity.fn_protokoll_anhaengen('fahrrad',     'fahrrad_id');
select velocity.fn_protokoll_anhaengen('station',     'station_id');

-- ---- Rechte ----------------------------------------------------------
-- ERST entziehen, DANN gezielt vergeben. Diese Zeile ist nicht
-- vorsorglich, sie ist notwendig: PostgreSQL gibt jeder NEU angelegten
-- Funktion implizit EXECUTE an PUBLIC, und die Zeile
-- "alter default privileges ... revoke execute on functions from public"
-- in 0011 hat in dieser Datenbank nachweislich KEINEN Eintrag in
-- pg_default_acl erzeugt - sie schuetzt neue Funktionen also nicht,
-- entgegen ihrem eigenen Kommentar. Aufgefallen ist das in Aufgabe 5:
-- nach einem Lauf von 0009 allein stand fn_ausleihe_abrechnen mit
-- proacl = null da, also offen fuer anon und authenticated.
--
-- Ohne diese Zeile waeren api_kunde_auskunft und
-- api_kunde_anonymisieren fuer jeden angemeldeten Kunden aufrufbar.
revoke all on all functions in schema velocity from public, anon, authenticated;

-- Nur die api_-Funktionen und die Sichten, keine Tabelle.
grant execute on function
  velocity.api_rad_anlegen(text, bigint, bigint),
  velocity.api_rad_status_setzen(bigint, text, text),
  velocity.api_rad_ausmustern(bigint, text),
  velocity.api_station_anlegen(text, text, text, text, text, numeric, numeric, integer),
  velocity.api_station_stilllegen(bigint, date),
  velocity.api_kunde_anlegen(text, text, text, text),
  velocity.api_kunde_aktualisieren(bigint, text, text, text, text, text, text, text),
  velocity.api_kunde_sperren(bigint, text),
  velocity.api_kunde_auskunft(bigint),
  velocity.api_kunde_anonymisieren(bigint, text),
  velocity.api_schaden_melden(bigint, text, text, text),
  velocity.api_auftrag_eroeffnen(bigint, bigint),
  velocity.api_auftrag_erledigen(bigint, integer, text)
to authenticated;

grant select on
  velocity.v_wawi_flotte, velocity.v_wawi_kunde, velocity.v_wawi_station,
  velocity.v_wawi_schaden, velocity.v_wawi_auftrag, velocity.v_wawi_fahrt_km,
  velocity.v_wawi_umsatz_radtyp, velocity.v_wawi_umsatz_kundengruppe,
  velocity.v_wawi_km_co2, velocity.v_wawi_stationsauslastung
to authenticated;
```

- [ ] **Schritt 4: Anwenden und Tests laufen lassen**

```bash
python3 db/run.py db/aufbau/0019_wawi_logik.sql
python3 db/run.py db/aufbau/0019_wawi_logik.sql
python3 db/test.py db/tests/t0005_bereich_d.sql db/tests/t0015_bereich_i.sql db/tests/t0019_wawi_logik.sql
```
Erwartet: beide Läufe fehlerfrei, alle acht Testfunktionen `ok`.

- [ ] **Schritt 5: Ganze Kette und Abnahme**

```bash
python3 db/test.py
bash tools/abnahme.sh
```
Erwartet: keine neuen Fehlschläge, alle bisherigen 18 Prüfungen grün.

- [ ] **Schritt 6: Commit**

```bash
git add db/aufbau/0019_wawi_logik.sql db/tests/t0019_wawi_logik.sql
git commit -m "feat(wawi): Kundenpflege, Auskunft und Anonymisierung nach Art. 15 und 17 DSGVO"
```

---

## Aufgabe 14: Abnahme, Dokumentation, Diagramm

**Dateien:**
- Ändern: `tools/abnahme.sh` (Prüfungen 19 bis 23)
- Ändern: `doku/datenmodell/01-anforderungen.md` (GR16 bis GR22)
- Ändern: `doku/datenmodell/05-physisches-modell.md` (die neuen Bereiche)
- Ändern: `doku/datenmodell/07-sicherheitskonzept.md` (Schutz, den es nicht gibt)
- Ändern: `doku/datenmodell/erd/erd-wawi.mmd` (gebaut vs. entworfen)
- Ändern: `README.md` (Werkzeugliste, Prüfungszahl)

- [ ] **Schritt 1: Die neuen Geschäftsregeln eintragen**

In `doku/datenmodell/01-anforderungen.md` die Tabelle unter GR15 fortsetzen. Die Formulierungen wörtlich aus Abschnitt 4.4 der Spec:

```markdown
| GR16 | Nur aktive Mitarbeitende haben Zugriff auf die Warenwirtschaft |
| GR17 | Mitarbeitende sehen keine Zahlungsmittel und keine Passwörter |
| GR18 | Ein Kunde mit Rechnungen wird anonymisiert, nie gelöscht |
| GR19 | Jede Änderung an Stammdaten wird feldweise protokolliert |
| GR20 | Ein Rad mit laufender Ausleihe wird nicht ausgemustert |
| GR21 | Jede Statusänderung eines Rades erzeugt ein Ereignis in der Lebenslaufakte |
| GR22 | Eine Station mit Rädern wird stillgelegt, nicht gelöscht |
```

Darunter den Hinweis, dass GR16 bis GR22 aus Phase 2 stammen und in `doku/specs/2026-08-25-velocity-warenwirtschaft-design.md` begründet sind.

- [ ] **Schritt 2: Sieben Prüfungen an `tools/abnahme.sh` anhängen**

`abnahme.sh` kennt keine Hilfsfunktion `pruefe`, sondern das Paar
`schritt "Titel"` und `ergebnis <0|1> "Meldung"`; `nr` zählt selbst
hoch. `KEY` und `URL` werden dort, wo sie gebraucht werden, aus `.env`
gelesen. Die neuen Blöcke folgen genau diesem Muster und kommen vor die
Schlussauswertung am Dateiende.

```bash
# --------------------------------------------- 19 Passwoerter
schritt "Passwoerter sind von aussen unerreichbar"
KEY=$(grep '^SUPABASE_ANON_KEY=' .env 2>/dev/null | cut -d= -f2-)
URL=$(grep '^SUPABASE_URL=' .env 2>/dev/null | cut -d= -f2-)
# Das Schema auth ist fuer PostgREST nicht freigegeben. Diese Pruefung
# haelt fest, dass das so bleibt - sie ist der Nachweis zu GR17.
code=$(curl -s -o /dev/null -w '%{http_code}' \
        "$URL/rest/v1/users?select=id" -H "apikey: $KEY")
[ "$code" = "200" ] && ergebnis 1 "auth.users antwortet mit 200" \
                    || ergebnis 0 "auth.users nicht erreichbar (HTTP $code)"

# --------------------------------------------- 20 Zahlungsmittel
schritt "Zahlungsmittel bleiben gesperrt"
# GR17, der wichtigste Einzelnachweis des Bereichs: Mitarbeitende
# duerfen Bezahldaten nicht sehen, und zwar nicht, weil die Oberflaeche
# sie nicht anzeigt, sondern weil das Recht fehlt.
code=$(curl -s -o /dev/null -w '%{http_code}' \
        "$URL/rest/v1/zahlungsmittel?select=zahlungsmittel_id" -H "apikey: $KEY")
[ "$code" = "200" ] && ergebnis 1 "zahlungsmittel antwortet mit 200" \
                    || ergebnis 0 "zahlungsmittel gesperrt (HTTP $code)"

# --------------------------------------------- 21 Basistabellen der WaWi
schritt "Warenwirtschaft spricht keine Basistabelle an"
offen=""
for t in mitarbeiter rolle mitarbeiter_rolle schadensmeldung wartungsauftrag \
         fahrrad_ereignis aenderungsprotokoll; do
  code=$(curl -s -o /dev/null -w '%{http_code}' \
          "$URL/rest/v1/$t?select=*&limit=1" -H "apikey: $KEY")
  [ "$code" = "200" ] && offen="$offen $t"
done
[ -z "$offen" ] && ergebnis 0 "keine der sieben Tabellen ist lesbar" \
                || ergebnis 1 "erreichbar:$offen"

# --------------------------------------------- 22 Sichten ohne Anmeldung
schritt "WaWi-Sichten sind ohne Anmeldung leer"
# Nicht 403, sondern leer: PostgREST meldet Kunden und Mitarbeitende als
# dieselbe Rolle an, deshalb filtert jede Sicht selbst ueber
# velocity.hat_rolle. Eine leere Antwort ist hier der Beweis.
inhalt=$(curl -s "$URL/rest/v1/v_wawi_flotte?select=fahrrad_id&limit=1" -H "apikey: $KEY")
[ "$inhalt" = "[]" ] && ergebnis 0 "v_wawi_flotte liefert []" \
                     || ergebnis 1 "v_wawi_flotte liefert: $inhalt"

# --------------------------------------------- 23 Rechenannahmen
schritt "Jede Rechenannahme nennt ihre Quelle"
# Eine Zahl ohne Herkunft ist eine Behauptung. Der CHECK-Constraint
# rechenannahme_quelle_chk weist eine leere Quelle bereits ab; diese
# Pruefung ist die zweite Sperre und faellt auf, wenn der Constraint
# je verschwindet.
n=$(python3 - <<'PYEOF'
import os, psycopg
for z in open('.env', encoding='utf-8'):
    z = z.strip()
    if z and not z.startswith('#') and '=' in z:
        k, v = z.split('=', 1); os.environ.setdefault(k, v)
c = psycopg.connect(host=os.environ['PGHOST'], port=os.environ['PGPORT'],
                    dbname=os.environ['PGDATABASE'], user=os.environ['PGUSER'],
                    password=os.environ['PGPASSWORD']).cursor()
c.execute("select count(*) from velocity.rechenannahme "
          "where quelle is null or btrim(quelle) = ''")
print(c.fetchone()[0])
PYEOF
)
[ "$n" = "0" ] && ergebnis 0 "alle Annahmen mit Quelle" \
               || ergebnis 1 "$n Annahmen ohne Quelle"

# --------------------------------------------- 24 Funktionsrechte
schritt "Keine Funktion ist versehentlich fuer jeden ausfuehrbar"
# PostgreSQL gibt jeder neu angelegten Funktion implizit EXECUTE an
# PUBLIC. Die Zeile "alter default privileges" in 0011 faengt das
# NICHT ab - in Aufgabe 5 nachgemessen. Es bleibt der explizite
# revoke, und der wirkt nur, wenn er nach der letzten Funktion laeuft.
n=$(python3 - <<'PYEOF'
import os, psycopg
for z in open('.env', encoding='utf-8'):
    z = z.strip()
    if z and not z.startswith('#') and '=' in z:
        k, v = z.split('=', 1); os.environ.setdefault(k, v)
c = psycopg.connect(host=os.environ['PGHOST'], port=os.environ['PGPORT'],
                    dbname=os.environ['PGDATABASE'], user=os.environ['PGUSER'],
                    password=os.environ['PGPASSWORD']).cursor()
c.execute("""select count(*) from pg_proc p
               join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'velocity'
                and p.proname not like 'api\\_%'
                and (p.proacl is null
                     or exists (select 1 from aclexplode(p.proacl) a
                                 join pg_roles r on r.oid = a.grantee
                                where r.rolname in ('anon','authenticated')))""")
print(c.fetchone()[0])
PYEOF
)
[ "$n" = "0" ] && ergebnis 0 "nur api_-Funktionen sind freigegeben" \
               || ergebnis 1 "$n Nicht-api-Funktion(en) fuer anon oder authenticated ausfuehrbar"

# --------------------------------------------- 25 Radstatus
schritt "Radstatus und offene Ausleihen stimmen ueberein"
# Genau dieser Widerspruch lag 37-fach in den uebernommenen Daten und
# fiel nie auf, weil keine Oberflaeche beides nebeneinander zeigte.
n=$(python3 - <<'PYEOF'
import os, psycopg
for z in open('.env', encoding='utf-8'):
    z = z.strip()
    if z and not z.startswith('#') and '=' in z:
        k, v = z.split('=', 1); os.environ.setdefault(k, v)
c = psycopg.connect(host=os.environ['PGHOST'], port=os.environ['PGPORT'],
                    dbname=os.environ['PGDATABASE'], user=os.environ['PGUSER'],
                    password=os.environ['PGPASSWORD']).cursor()
c.execute("""select count(*) from velocity.fahrrad f
              where (f.status = 'ausgeliehen') <> exists (
                select 1 from velocity.ausleihe a
                 where a.fahrrad_id = f.fahrrad_id and a.status = 'aktiv')""")
print(c.fetchone()[0])
PYEOF
)
[ "$n" = "0" ] && ergebnis 0 "kein Rad mit widerspruechlichem Status" \
               || ergebnis 1 "$n Raeder mit widerspruechlichem Status"
```

Die Schlusszeile der Datei, die `fehler` auswertet und die Gesamtzahl
meldet, bleibt unverändert — `nr` zählt selbst mit. Falls im Kopf der
Datei eine feste Zahl steht („Abnahme Phase 1"), diese Überschrift auf
Phase 1 **und** 2 erweitern.

- [ ] **Schritt 3: `tools/abnahme.sh` laufen lassen**

```bash
bash tools/abnahme.sh
```
Erwartet: 25 Prüfungen, alle grün.

- [ ] **Schritt 4: Jede neue Prüfung gegen sich selbst testen**

Eine Prüfung, die nie rot war, prüft nichts. Für jede der sieben einmal den Fehlerfall herstellen und bestätigen, dass sie anschlägt — danach zurücknehmen. Beispiel für Prüfung 23:

```bash
python3 -c "
import os,psycopg
for z in open('.env',encoding='utf-8'):
    z=z.strip()
    if z and not z.startswith('#') and '=' in z:
        k,v=z.split('=',1); os.environ.setdefault(k,v)
con=psycopg.connect(host=os.environ['PGHOST'],port=os.environ['PGPORT'],dbname=os.environ['PGDATABASE'],
                    user=os.environ['PGUSER'],password=os.environ['PGPASSWORD'])
c=con.cursor(); c.execute(\"insert into velocity.rechenannahme (code,wert,einheit,gueltigkeit,quelle) values ('test',1,'x',daterange(date '2000-01-01',date '2000-02-01','[)'),' ')\"); con.commit()
"
bash tools/abnahme.sh   # Pruefung 23 muss rot sein
python3 -c "
import os,psycopg
for z in open('.env',encoding='utf-8'):
    z=z.strip()
    if z and not z.startswith('#') and '=' in z:
        k,v=z.split('=',1); os.environ.setdefault(k,v)
con=psycopg.connect(host=os.environ['PGHOST'],port=os.environ['PGPORT'],dbname=os.environ['PGDATABASE'],
                    user=os.environ['PGUSER'],password=os.environ['PGPASSWORD'])
c=con.cursor(); c.execute(\"delete from velocity.rechenannahme where code='test'\"); con.commit()
"
bash tools/abnahme.sh   # wieder gruen
```

Der `check`-Constraint `rechenannahme_quelle_chk` weist eine leere Quelle bereits ab — falls das Einfügen scheitert, ist das der bessere Beweis: dann notiere in der Prüfung als Kommentar, dass der Constraint sie vorwegnimmt, und behalte sie als zweite Sperre.

- [ ] **Schritt 5: Das ERD nachziehen**

In `doku/datenmodell/erd/erd-wawi.mmd` die Bereiche J, I und K als **gebaut** kennzeichnen, G und H als **entworfen**, und `wartungsposition` mit dem Vermerk versehen, warum sie fehlt. Danach das Diagramm prüfen:

```bash
node tools/mermaid_check.mjs doku/datenmodell/erd/*.mmd
```

- [ ] **Schritt 6: `05-physisches-modell.md` und `README.md` ergänzen**

In `05-physisches-modell.md` die acht neuen Tabellen mit je einem Satz zur Begründung aufnehmen — insbesondere die Abweichung m:n bei den Rollen und den Verzicht auf `wartungsposition`.

**Zuerst eine Stelle, die sicherheitsrelevant falsch ist:**
`doku/datenmodell/07-sicherheitskonzept.md` beschreibt
`alter default privileges in schema velocity revoke execute on functions
from public` weiterhin als wirksamen Schutz für künftig angelegte
Funktionen. Die Anweisung ist in Aufgabe 5 entfernt worden, weil sie in
dieser Datenbank nachweislich keinen `pg_default_acl`-Eintrag erzeugt
und nichts geschützt hat. Ein Sicherheitskonzept, das eine Schutzmaßnahme
behauptet, die es nicht gibt, ist gefährlicher als eine Lücke, von der
man weiß. Stelle die Stelle richtig: der Schutz kommt allein aus dem
expliziten `revoke all on all functions in schema velocity from public,
anon, authenticated`, dieser muss nach jeder neu angelegten Funktion
erneut laufen, und abgesichert wird das durch die Sweep-Testfunktion
`test_s_keine_oeffentliche_funktion` in `db/tests/t0011_sicherheit.sql`
sowie durch Abnahmeprüfung 24.

**Und eine Stelle nachziehen, die durch Aufgabe 5 falsch geworden ist:**
`doku/datenmodell/05-physisches-modell.md` und `slides/build_deck.py`
ordnen GR5 („Preis zum Startzeitpunkt der Fahrt") weiterhin
`fn_ausleihe_beenden` zu. Die Regel lebt seit Aufgabe 5 in
`fn_ausleihe_abrechnen`. Beide Stellen suchen und richtigstellen — das
Foliendeck danach neu bauen, sonst steht die alte Zuordnung im PDF.

In `README.md` die Prüfungszahl von 18 auf 25 heben und die drei Referenzdatendateien in der Werkzeugliste nennen, mit dem Hinweis, dass sie **erfundene** Daten erzeugen.

- [ ] **Schritt 7: Alles zusammen prüfen**

```bash
python3 db/test.py
bash tools/abnahme.sh
python3 tools/zahlen_gegen_db.py
```
Erwartet: alles grün. `zahlen_gegen_db.py` prüft Anleitung und Foliendeck gegen die Datenbank — die Preisperioden aus Aufgabe 6 dürfen dort nichts verschoben haben, weil die **laufende** Periode unverändert blieb.

- [ ] **Schritt 8: Commit**

```bash
git add tools/abnahme.sh doku/datenmodell/ README.md
git commit -m "docs(wawi): Geschaeftsregeln GR16 bis GR22, fuenf neue Abnahmepruefungen, ERD nachgezogen"
```

---

## Nach dem letzten Commit

Schritt 1 ist damit fertig: die Datenbank trägt die Warenwirtschaft, und die Auswertungen liefern Zahlen, die sich gegenrechnen lassen — ohne dass eine einzige Zeile Oberfläche existiert. Das ist Absicht.

**Was als Nächstes ansteht** (nicht Teil dieses Plans): der Umsetzungsplan für Schritt 2, die Oberfläche unter `wawi.butscher.cloud`. Er baut auf genau den Sichten und Funktionen auf, die dieser Plan angelegt hat — und erst jetzt lässt sich gegen etwas planen, das wirklich existiert.

**Erst danach** wird der alte Prototyp unter `erp/` weggeräumt. Er spricht noch das Altschema `cityBikesRental` an; solange nichts Neues steht, ist er der einzige Beleg dafür, wie die Innensicht einmal gedacht war.
