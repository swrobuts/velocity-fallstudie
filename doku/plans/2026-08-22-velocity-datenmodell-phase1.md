# VeloCity Datenmodell Phase 1 — Umsetzungsplan

> **Für agentische Bearbeiter:** ERFORDERLICHE SUB-SKILL: `superpowers:subagent-driven-development` (empfohlen) oder `superpowers:executing-plans`, um diesen Plan Aufgabe für Aufgabe umzusetzen. Die Schritte nutzen Checkbox-Syntax (`- [ ]`) zur Nachverfolgung.

**Ziel:** Eine lehrbuchartig entworfene Datenhaltung für die Bike-Sharing-Anwendung VeloCity im neuen PostgreSQL-Schema `velocity` aufbauen, die Bestandsdaten übernehmen, die Website darauf umstellen und beides dokumentiert und getestet ausliefern.

**Architektur:** Neues Schema `velocity` neben dem unveränderten Altschema `cityBikesRental` auf derselben Supabase-Instanz. Die Website liest ausschließlich über `v_*`-Sichten und schreibt ausschließlich über `SECURITY DEFINER`-Funktionen `api_*`; Basistabellen sind für `anon` und `authenticated` unerreichbar. Alle Aufbauschritte sind idempotente SQL-Dateien, die von einem Python-Runner angewandt und von pgTAP-Tests abgesichert werden.

**Tech-Stack:** PostgreSQL 17.6 (Supabase, self-hosted auf `supabase.butscher.cloud`), PostgREST, Supabase Auth, pgTAP 1.3.3, `btree_gist` 1.7, Python 3 mit `psycopg2` (Runner und Testläufer), Vanilla JS mit `supabase-js` v2 (Frontend), Mermaid 11 (Diagramme), python-pptx über `/bint-folie` (Foliendeck).

**Spec:** `doku/specs/2026-08-22-velocity-datenmodell-design.md` — der Plan argumentiert aus der Spec; beide zusammen lesen.

**Ablageort abweichend vom Standard:** Der Plan liegt unter `doku/plans/` statt `docs/superpowers/plans/`, weil `docs/` in diesem Repository das Build-Ziel der GitHub-Pages-Auslieferung ist.

## Globale Randbedingungen

Diese Vorgaben gelten für **jede** Aufgabe und werden nicht in jeder Aufgabe wiederholt.

- **Schema:** ausschließlich `velocity`. Das Altschema `cityBikesRental` wird bis Aufgabe 17 nicht verändert. Fremdschemata (`auth`, `storage`, `qs`, …) werden nie verändert — insbesondere werden **keine** Trigger auf `auth.users` angelegt.
- **Verbindung:** Host `supabase.butscher.cloud`, Port `5433`, Datenbank `postgres`, Benutzer `postgres`. Zugangsdaten ausschließlich aus `.env` (in `.gitignore`, niemals committen).
- **Sprache der Bezeichner:** Deutsch, `snake_case`, Entitätstabellen im Singular.
- **Primärschlüssel:** `<tabelle>_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY`.
- **Zeitstempel:** ausnahmslos `timestamptz`. **Geld:** `numeric(10,2)`. Niemals `float` für Beträge.
- **Löschregeln:** `ON DELETE RESTRICT` als Standard; `CASCADE` nur bei echter Existenzabhängigkeit (Positionen zu ihrem Kopf).
- **Audit:** jede Basistabelle trägt `erstellt_am timestamptz NOT NULL DEFAULT now()` und `geaendert_am timestamptz NOT NULL DEFAULT now()` sowie den Trigger `trg_<tabelle>_audit`.
- **Idempotenz:** jede Datei unter `db/aufbau/` muss zweimal hintereinander fehlerfrei laufen. `CREATE TABLE IF NOT EXISTS`, `CREATE OR REPLACE`, `DROP POLICY IF EXISTS` vor `CREATE POLICY`, ENUM-Anlage über `DO`-Block mit `pg_type`-Prüfung, Constraints über `DO`-Block mit `pg_constraint`-Prüfung.
- **Dateikopf:** jede SQL-Datei beginnt mit einem Kommentarblock: Zweck, angelegte Objekte, Rücknahme.
- **Keine Klartext-Geheimnisse** in SQL, JS oder Markdown. Der Supabase-anon-Key ist bewusst öffentlich und darf in `src/config.js` stehen; der service_role-Key und das Postgres-Passwort niemals.
- **Commits:** deutschsprachige Commit-Nachrichten, Präfixe `feat:`, `fix:`, `docs:`, `test:`, `chore:`. Jede Aufgabe endet mit genau einem Commit. Nicht pushen — der Branch bleibt lokal, bis der Auftraggeber etwas anderes sagt.
- **Arbeitsverzeichnis:** der Worktree `…/BikesRental/Web/.worktrees/velocity-datenmodell` auf Branch `feature/velocity-datenmodell`. Alle Pfadangaben sind relativ dazu.

## Dateistruktur

| Datei | Verantwortung |
|---|---|
| `.env.example` | Vorlage der Verbindungsparameter, ohne Passwort |
| `db/run.py` | Wendet SQL-Dateien an; eine Transaktion je Datei, Abbruch mit Rückrollung bei Fehler |
| `db/test.py` | Spielt die Testdefinitionen ein und führt `runtests()` aus; wertet TAP aus |
| `db/aufbau/0001_schema_und_konventionen.sql` | Schema, Erweiterungen, ENUM-Typen, Audit-Trigger-Funktion |
| `db/aufbau/0002_bereich_a_geschaeftspartner.sql` | `adresse`, `kunde` |
| `db/aufbau/0003_bereich_b_netz_und_flotte.sql` | `station`, `fahrradtyp`, `fahrradtyp_merkmal`, `hersteller`, `fahrradmodell`, `fahrrad`, `fahrrad_position` |
| `db/aufbau/0004_bereich_c_tarif_und_preis.sql` | `tarif`, `tarif_kondition`, `mitgliedschaft`, `freiminuten_periode`, `nutzungspreis` |
| `db/aufbau/0005_bereich_d_nutzung.sql` | `entgeltart`, `ausleihe`, `entgeltposition` |
| `db/aufbau/0006_bereich_e_abrechnung.sql` | `zahlungsart`, `zahlungsmittel`, `rechnung`, `rechnungsposition`, `zahlung` |
| `db/aufbau/0007_bereich_f_inhalte.sql` | `faq_eintrag`, `nutzungsschritt`, `kennzahl` |
| `db/aufbau/0008_referenzdaten.sql` | `entgeltart`, `zahlungsart`, Tarife, Fahrradtypen, Redaktionsinhalte |
| `db/aufbau/0009_geschaeftslogik.sql` | `api_*`-Funktionen inkl. Preisfindung |
| `db/aufbau/0010_sichten.sql` | `v_*`-Sichten, öffentlich und persönlich |
| `db/aufbau/0011_sicherheit.sql` | RLS, Policies, Grants |
| `db/aufbau/0012_dokumentation.sql` | `COMMENT ON` für alle Objekte, Sicht `v_data_dictionary` |
| `db/tests/t0001_*.sql` … `t0011_*.sql` | pgTAP-Testfunktionen im Schema `velocity_test` |
| `db/betrieb/uebernahme_altdaten.sql` | Übernahme aus `cityBikesRental` inkl. Protokoll |
| `db/betrieb/abgleichsbericht.sql` | Soll-Ist-Vergleich der Übernahme |
| `db/betrieb/altschema_absichern.sql` | anon-Policies entfernen, Klartextpasswörter leeren |
| `db/legacy/` | die zehn gewachsenen Patch-Skripte, unverändert als Beleg |
| `tools/mermaid_check.mjs` | validiert alle `.mmd`-Dateien gegen den Mermaid-Parser |
| `tools/rest_security_check.py` | prüft mit dem anon-Key, dass keine personenbezogene Ressource erreichbar ist |
| `src/config.js`, `src/supabase.js`, `src/auth.js`, `src/script.js`, `src/index.html` | umgestellte Website |
| `doku/datenmodell/*.md`, `doku/datenmodell/erd/*.mmd` | Dokumentation und Diagramme |
| `slides/` | Foliendeck und PDF |

---

### Aufgabe 1: Ausführungswerkzeug und Testrahmen

Ohne Runner und Testläufer ist keine der folgenden Aufgaben prüfbar. `psql` ist auf dem Rechner **nicht** installiert; der Zugriff läuft über Python mit `psycopg2` (vorhanden unter `/Users/robert/miniforge3/bin/python3`, Version 2.9.11).

**Dateien:**
- Anlegen: `.env.example`, `.env` (nicht committen)
- Anlegen: `db/run.py`
- Anlegen: `db/test.py`
- Test: `db/tests/t0000_rahmen.sql`

**Schnittstellen:**
- Liefert: `db/run.py` mit `verbinde() -> psycopg2.connection` und `wende_an(conn, pfad: pathlib.Path) -> None`; Kommandozeile `python3 db/run.py <datei> [<datei> …]`, Rückgabewert 0 bei Erfolg, 1 bei Fehler.
- Liefert: `db/test.py` mit Kommandozeile `python3 db/test.py [<testdatei> …]`, Rückgabewert 0 wenn alle Zusicherungen erfüllt sind, sonst 1.
- Liefert: Konvention, dass Testfunktionen im Schema `velocity_test` liegen und mit `test_` beginnen.

- [ ] **Schritt 1: `.env.example` und `.env` anlegen**

`.env.example` (wird committet):

```
PGHOST=supabase.butscher.cloud
PGPORT=5433
PGDATABASE=postgres
PGUSER=postgres
PGPASSWORD=
```

`.env` (wird **nicht** committet, steht bereits in `.gitignore`) mit demselben Inhalt, aber gesetztem `PGPASSWORD`. Das Passwort erfragen, nicht raten.

Anschließend Rechte einschränken:

```bash
chmod 600 .env
```

- [ ] **Schritt 2: Bewusst fehlschlagenden Test schreiben**

Zweck dieses Schrittes ist ausschließlich, zu beweisen, dass der Testläufer Fehlschläge **erkennt**. Ein Testrahmen, der nie rot wird, ist wertlos.

`db/tests/t0000_rahmen.sql`:

```sql
-- =====================================================================
-- t0000 Testrahmen
-- Zweck:   Beweist, dass pgTAP eingerichtet ist und der Testlaeufer
--          sowohl bestandene als auch fehlgeschlagene Zusicherungen
--          korrekt meldet.
-- =====================================================================

create extension if not exists pgtap with schema extensions;
create schema if not exists velocity_test;
set search_path = velocity_test, velocity, extensions, public;

create or replace function velocity_test.test_rahmen_meldet_fehlschlag()
returns setof text language plpgsql as $$
begin
  return next ok(false, 'Dieser Test MUSS fehlschlagen (Selbsttest des Rahmens)');
end;
$$;
```

- [ ] **Schritt 3: Runner und Testläufer schreiben**

`db/run.py`:

```python
#!/usr/bin/env python3
"""Wendet SQL-Dateien auf die VeloCity-Datenbank an.

Aufruf:
    python3 db/run.py db/aufbau/0001_schema_und_konventionen.sql
    python3 db/run.py db/aufbau/*.sql

Jede Datei laeuft in genau einer Transaktion. Schlaegt eine Datei fehl,
wird sie zurueckgerollt und das Programm bricht mit Rueckgabewert 1 ab.
Bereits erfolgreich angewandte Dateien bleiben bestehen.
"""
from __future__ import annotations

import os
import pathlib
import sys

import psycopg2

SCHLUESSEL = ("PGHOST", "PGPORT", "PGDATABASE", "PGUSER", "PGPASSWORD")


def lade_env(pfad: pathlib.Path) -> None:
    """Liest eine einfache KEY=VALUE-Datei nach os.environ, ohne zu ueberschreiben."""
    if not pfad.exists():
        return
    for zeile in pfad.read_text(encoding="utf-8").splitlines():
        zeile = zeile.strip()
        if not zeile or zeile.startswith("#") or "=" not in zeile:
            continue
        schluessel, wert = zeile.split("=", 1)
        os.environ.setdefault(schluessel.strip(), wert.strip())


def verbinde():
    """Baut die Verbindung aus .env auf und meldet fehlende Parameter klar."""
    wurzel = pathlib.Path(__file__).resolve().parent.parent
    lade_env(wurzel / ".env")
    fehlend = [k for k in SCHLUESSEL if not os.environ.get(k)]
    if fehlend:
        sys.exit("Fehlende Verbindungsparameter in .env: " + ", ".join(fehlend))
    return psycopg2.connect(
        host=os.environ["PGHOST"],
        port=os.environ["PGPORT"],
        dbname=os.environ["PGDATABASE"],
        user=os.environ["PGUSER"],
        password=os.environ["PGPASSWORD"],
        connect_timeout=15,
    )


def wende_an(conn, pfad: pathlib.Path) -> None:
    """Fuehrt eine SQL-Datei als eine Transaktion aus."""
    with conn.cursor() as cur:
        cur.execute(pfad.read_text(encoding="utf-8"))
    conn.commit()


def main(argv: list[str]) -> int:
    if not argv:
        print(__doc__)
        return 2
    conn = verbinde()
    try:
        for name in argv:
            pfad = pathlib.Path(name)
            if not pfad.exists():
                print(f"FEHLER  {pfad} existiert nicht", file=sys.stderr)
                return 1
            try:
                wende_an(conn, pfad)
            except Exception as fehler:  # noqa: BLE001 - Fehlertext soll durchgereicht werden
                conn.rollback()
                print(f"FEHLER  {pfad}\n        {fehler}", file=sys.stderr)
                return 1
            print(f"OK      {pfad}")
    finally:
        conn.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
```

`db/test.py`:

```python
#!/usr/bin/env python3
"""Fuehrt die pgTAP-Tests der VeloCity-Datenbank aus.

Aufruf:
    python3 db/test.py                              # alle Testdateien
    python3 db/test.py db/tests/t0002_bereich_a.sql # einzelne Datei

Die Testdateien legen Funktionen im Schema velocity_test an. Anschliessend
ruft dieses Programm runtests() auf, das jede Testfunktion in einer eigenen
Transaktion ausfuehrt und danach zuruecksetzt. Testdaten bleiben also nicht
in der Datenbank zurueck.

Rueckgabewert 0, wenn alle Zusicherungen erfuellt sind, sonst 1.
"""
from __future__ import annotations

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))

from run import verbinde, wende_an  # noqa: E402


def main(argv: list[str]) -> int:
    wurzel = pathlib.Path(__file__).resolve().parent
    dateien = [pathlib.Path(a) for a in argv] or sorted((wurzel / "tests").glob("t*.sql"))
    if not dateien:
        sys.exit("Keine Testdateien gefunden.")

    conn = verbinde()
    try:
        for pfad in dateien:
            wende_an(conn, pfad)
            print(f"eingespielt  {pfad}")
        with conn.cursor() as cur:
            cur.execute("set search_path = velocity_test, velocity, extensions, public")
            cur.execute("select * from runtests('velocity_test'::name, '^test_')")
            zeilen = [r[0] for r in cur.fetchall()]
        conn.commit()
    finally:
        conn.close()

    fehlschlaege = 0
    for zeile in zeilen:
        print(zeile)
        if zeile.startswith("not ok"):
            fehlschlaege += 1
    print(f"\n{fehlschlaege} fehlgeschlagene Zusicherung(en).")
    return 1 if fehlschlaege else 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
```

- [ ] **Schritt 4: Testläufer ausführen und Fehlschlag-Erkennung prüfen**

```bash
python3 db/test.py db/tests/t0000_rahmen.sql; echo "Rückgabewert: $?"
```

Erwartet: eine Zeile `not ok 1 - Dieser Test MUSS fehlschlagen (Selbsttest des Rahmens)`, danach `1 fehlgeschlagene Zusicherung(en).` und `Rückgabewert: 1`.

Erscheint stattdessen ein Fehler `function ok(boolean, text) does not exist`, ist pgTAP nicht in `extensions` installiert — dann Schritt 2 erneut anwenden und den `search_path` prüfen.

- [ ] **Schritt 5: Test auf eine echte Zusicherung umstellen**

In `db/tests/t0000_rahmen.sql` die Testfunktion ersetzen durch:

```sql
create or replace function velocity_test.test_rahmen_ist_einsatzbereit()
returns setof text language plpgsql as $$
begin
  return next has_extension('extensions'::name, 'pgtap'::name,
                            'pgTAP ist im Schema extensions installiert');
  return next has_extension('extensions'::name, 'btree_gist'::name,
                            'btree_gist ist im Schema extensions installiert');
end;
$$;

drop function if exists velocity_test.test_rahmen_meldet_fehlschlag();
```

- [ ] **Schritt 6: Testläufer erneut ausführen**

```bash
python3 db/test.py db/tests/t0000_rahmen.sql; echo "Rückgabewert: $?"
```

Erwartet: `ok 1 - pgTAP ist im Schema extensions installiert`, `ok 2 - btree_gist ist im Schema extensions installiert`, `0 fehlgeschlagene Zusicherung(en).`, `Rückgabewert: 0`.

- [ ] **Schritt 7: Commit**

```bash
git add .env.example db/run.py db/test.py db/tests/t0000_rahmen.sql
git commit -m "feat: Runner und pgTAP-Testrahmen fuer die VeloCity-Datenbank"
```

Prüfen, dass `.env` **nicht** im Commit ist:

```bash
git show --stat --name-only HEAD | grep -x ".env" && echo "FEHLER: .env wurde committet" || echo "ok, .env nicht committet"
```

---

### Aufgabe 2: Schema, Aufzählungstypen und Audit-Mechanik

**Dateien:**
- Anlegen: `db/aufbau/0001_schema_und_konventionen.sql`
- Test: `db/tests/t0001_konventionen.sql`

**Schnittstellen:**
- Nutzt: `db/run.py`, `db/test.py` aus Aufgabe 1.
- Liefert: Schema `velocity`; ENUM-Typen `velocity.kunde_status`, `velocity.fahrrad_status`, `velocity.ausleihe_status`, `velocity.tarifart`, `velocity.rechnung_status`, `velocity.zahlung_status`; Funktion `velocity.fn_audit_setzen() returns trigger`; Funktion `velocity.fn_audit_anhaengen(p_tabelle text) returns void`, die den Trigger `trg_<tabelle>_audit` an eine Tabelle des Schemas hängt. Alle folgenden Aufgaben rufen `velocity.fn_audit_anhaengen('<tabelle>')` für jede neue Tabelle auf.

- [ ] **Schritt 1: Fehlschlagenden Test schreiben**

`db/tests/t0001_konventionen.sql`:

```sql
-- =====================================================================
-- t0001 Schema, Aufzaehlungstypen und Audit-Mechanik
-- =====================================================================
create schema if not exists velocity_test;
set search_path = velocity_test, velocity, extensions, public;

create or replace function velocity_test.test_konv_schema_existiert()
returns setof text language plpgsql as $$
begin
  return next has_schema('velocity'::name, 'Schema velocity existiert');
end;
$$;

create or replace function velocity_test.test_konv_enums_vollstaendig()
returns setof text language plpgsql as $$
begin
  return next has_enum('velocity'::name, 'kunde_status'::name, 'ENUM kunde_status existiert');
  return next enum_has_labels('velocity'::name, 'kunde_status'::name,
    array['aktiv','gesperrt','geschlossen'], 'kunde_status hat die vereinbarten Werte');
  return next enum_has_labels('velocity'::name, 'fahrrad_status'::name,
    array['verfuegbar','ausgeliehen','wartung','defekt','ausgemustert'],
    'fahrrad_status hat die vereinbarten Werte');
  return next enum_has_labels('velocity'::name, 'ausleihe_status'::name,
    array['aktiv','abgeschlossen','storniert'], 'ausleihe_status hat die vereinbarten Werte');
  return next enum_has_labels('velocity'::name, 'tarifart'::name,
    array['standard','vorteil'], 'tarifart hat die vereinbarten Werte');
  return next enum_has_labels('velocity'::name, 'rechnung_status'::name,
    array['entwurf','gestellt','bezahlt','storniert'], 'rechnung_status hat die vereinbarten Werte');
  return next enum_has_labels('velocity'::name, 'zahlung_status'::name,
    array['offen','gebucht','fehlgeschlagen','erstattet'], 'zahlung_status hat die vereinbarten Werte');
end;
$$;

create or replace function velocity_test.test_konv_audit_wirkt()
returns setof text language plpgsql as $$
declare
  v_erstellt   timestamptz;
  v_geaendert  timestamptz;
begin
  return next has_function('velocity'::name, 'fn_audit_setzen'::name,
                           'Audit-Triggerfunktion existiert');
  return next has_function('velocity'::name, 'fn_audit_anhaengen'::name,
                           array['text'], 'Hilfsfunktion zum Anhaengen existiert');

  -- Wegwerftabelle: runtests() rollt die Transaktion nach dem Test zurueck.
  create table velocity.t_audit_probe (
    id            int primary key,
    erstellt_am   timestamptz not null default now(),
    geaendert_am  timestamptz not null default now()
  );
  perform velocity.fn_audit_anhaengen('t_audit_probe');

  insert into velocity.t_audit_probe (id) values (1);
  select erstellt_am, geaendert_am into v_erstellt, v_geaendert
    from velocity.t_audit_probe where id = 1;
  return next ok(v_erstellt is not null, 'erstellt_am wird beim Einfuegen gesetzt');

  perform pg_sleep(0.01);
  update velocity.t_audit_probe set id = 1 where id = 1;
  select erstellt_am, geaendert_am into v_erstellt, v_geaendert
    from velocity.t_audit_probe where id = 1;
  return next ok(v_geaendert > v_erstellt, 'geaendert_am wird beim Aendern fortgeschrieben');
  return next ok(v_erstellt = (select erstellt_am from velocity.t_audit_probe where id = 1),
                 'erstellt_am bleibt beim Aendern unveraendert');
end;
$$;
```

- [ ] **Schritt 2: Test ausführen und Fehlschlag bestätigen**

```bash
python3 db/test.py db/tests/t0000_rahmen.sql db/tests/t0001_konventionen.sql; echo "Rückgabewert: $?"
```

Erwartet: `not ok` für `has_schema('velocity')` und die ENUM-Zusicherungen, Rückgabewert 1. Der Audit-Test bricht mit einem Fehler ab, weil `velocity` noch nicht existiert — das ist an dieser Stelle richtig.

- [ ] **Schritt 3: Aufbauschritt 0001 schreiben**

`db/aufbau/0001_schema_und_konventionen.sql`:

```sql
-- =====================================================================
-- 0001 Schema und Konventionen
--
-- Zweck:      Legt den Namensraum, die benoetigten Erweiterungen, die
--             Aufzaehlungstypen und die Audit-Mechanik an. Alle weiteren
--             Aufbauschritte setzen darauf auf.
-- Objekte:    Schema velocity
--             Erweiterung extensions.btree_gist
--             ENUM kunde_status, fahrrad_status, ausleihe_status,
--                  tarifart, rechnung_status, zahlung_status
--             Funktion velocity.fn_audit_setzen()
--             Funktion velocity.fn_audit_anhaengen(text)
-- Ruecknahme: DROP SCHEMA velocity CASCADE;
--             Die Erweiterung btree_gist bleibt bestehen, weil sie
--             instanzweit geteilt wird.
-- =====================================================================

create schema if not exists velocity;

-- btree_gist wird fuer die EXCLUDE-Constraints in Schritt 0004 gebraucht:
-- ohne sie fehlt bigint die Operatorklasse fuer den Zugriffsweg gist.
create extension if not exists btree_gist with schema extensions;

-- ---------------------------------------------------------------------
-- Aufzaehlungstypen
--
-- Geschlossene technische Wertemengen werden als ENUM modelliert,
-- fachliche Klassifikationen dagegen als Referenztabelle (siehe
-- entgeltart und zahlungsart). ENUM ist kompakt und schnell, laesst sich
-- aber nur mit ALTER TYPE erweitern und traegt keine Zusatzattribute.
-- ---------------------------------------------------------------------
do $$
declare
  v_typ record;
begin
  for v_typ in
    select * from (values
      ('kunde_status',    array['aktiv','gesperrt','geschlossen']),
      ('fahrrad_status',  array['verfuegbar','ausgeliehen','wartung','defekt','ausgemustert']),
      ('ausleihe_status', array['aktiv','abgeschlossen','storniert']),
      ('tarifart',        array['standard','vorteil']),
      ('rechnung_status', array['entwurf','gestellt','bezahlt','storniert']),
      ('zahlung_status',  array['offen','gebucht','fehlgeschlagen','erstattet'])
    ) as t(name, labels)
  loop
    if not exists (
      select 1 from pg_type ty
        join pg_namespace n on n.oid = ty.typnamespace
       where n.nspname = 'velocity' and ty.typname = v_typ.name
    ) then
      execute format(
        'create type velocity.%I as enum (%s)',
        v_typ.name,
        (select string_agg(quote_literal(l), ', ') from unnest(v_typ.labels) as l)
      );
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Audit-Mechanik
--
-- Jede Basistabelle traegt erstellt_am und geaendert_am. Der Trigger
-- schreibt beide Werte fort, damit sie nicht von der Anwendung abhaengen
-- und auch bei direktem SQL-Zugriff stimmen.
-- ---------------------------------------------------------------------
create or replace function velocity.fn_audit_setzen()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    new.erstellt_am := coalesce(new.erstellt_am, now());
  else
    new.erstellt_am := old.erstellt_am;   -- gegen nachtraegliches Verbiegen
  end if;
  new.geaendert_am := now();
  return new;
end;
$$;

create or replace function velocity.fn_audit_anhaengen(p_tabelle text)
returns void
language plpgsql
as $$
begin
  execute format('drop trigger if exists trg_%1$s_audit on velocity.%1$I', p_tabelle);
  execute format(
    'create trigger trg_%1$s_audit
       before insert or update on velocity.%1$I
       for each row execute function velocity.fn_audit_setzen()',
    p_tabelle
  );
end;
$$;
```

- [ ] **Schritt 4: Aufbauschritt anwenden**

```bash
python3 db/run.py db/aufbau/0001_schema_und_konventionen.sql
```

Erwartet: `OK      db/aufbau/0001_schema_und_konventionen.sql`

- [ ] **Schritt 5: Idempotenz nachweisen**

```bash
python3 db/run.py db/aufbau/0001_schema_und_konventionen.sql
```

Erwartet: erneut `OK`, kein Fehler. Schlägt der zweite Lauf fehl, ist eine Anweisung nicht idempotent — beheben, bevor es weitergeht.

- [ ] **Schritt 6: Tests ausführen und grün sehen**

```bash
python3 db/test.py; echo "Rückgabewert: $?"
```

Erwartet: alle Zusicherungen `ok`, `0 fehlgeschlagene Zusicherung(en).`, Rückgabewert 0.

- [ ] **Schritt 7: Commit**

```bash
git add db/aufbau/0001_schema_und_konventionen.sql db/tests/t0001_konventionen.sql
git commit -m "feat: Schema velocity mit Aufzaehlungstypen und Audit-Mechanik"
```

---

### Aufgabe 3: Bereich A — Geschäftspartner

**Dateien:**
- Anlegen: `db/aufbau/0002_bereich_a_geschaeftspartner.sql`
- Test: `db/tests/t0002_bereich_a.sql`

**Schnittstellen:**
- Nutzt: Schema `velocity`, `velocity.kunde_status`, `velocity.fn_audit_anhaengen(text)` aus Aufgabe 2.
- Liefert: `velocity.adresse(adresse_id, strasse, hausnummer, plz, ort, land_code)` und `velocity.kunde(kunde_id, kundennummer, auth_uid, email, anrede, vorname, nachname, geburtsdatum, telefon, rechnungsadresse_id, status, registriert_am)`. Die Kundennummer wird durch die Vorgabe `'K-' || lpad(nextval('velocity.seq_kundennummer')::text, 6, '0')` automatisch vergeben. Alle folgenden Bereiche verweisen mit `kunde_id bigint` auf `velocity.kunde` und mit `adresse_id bigint` auf `velocity.adresse`.

- [ ] **Schritt 1: Fehlschlagenden Test schreiben**

`db/tests/t0002_bereich_a.sql`:

```sql
-- =====================================================================
-- t0002 Bereich A: Geschaeftspartner
-- =====================================================================
create schema if not exists velocity_test;
set search_path = velocity_test, velocity, extensions, public;

create or replace function velocity_test.test_a_struktur()
returns setof text language plpgsql as $$
begin
  return next has_table('velocity'::name, 'adresse'::name, 'Tabelle adresse existiert');
  return next has_table('velocity'::name, 'kunde'::name,   'Tabelle kunde existiert');
  return next col_is_pk('velocity'::name, 'adresse'::name, 'adresse_id'::name,
                        'adresse hat den Surrogatschluessel adresse_id');
  return next col_is_pk('velocity'::name, 'kunde'::name, 'kunde_id'::name,
                        'kunde hat den Surrogatschluessel kunde_id');
  return next hasnt_column('velocity'::name, 'kunde'::name, 'passwort_hash'::name,
                           'kunde speichert kein Passwort (Auth liegt bei Supabase)');
  return next fk_ok('velocity'::name, 'kunde'::name, 'rechnungsadresse_id'::name,
                    'velocity'::name, 'adresse'::name, 'adresse_id'::name,
                    'kunde verweist auf adresse');
  return next col_type_is('velocity'::name, 'kunde'::name, 'registriert_am'::name,
                          'timestamp with time zone', 'Zeitstempel sind zeitzonenbehaftet');
end;
$$;

create or replace function velocity_test.test_a_fachschluessel()
returns setof text language plpgsql as $$
declare
  v_id bigint;
begin
  insert into velocity.kunde (email, vorname, nachname)
       values ('anna@example.org', 'Anna', 'Beispiel')
    returning kunde_id into v_id;

  return next matches((select kundennummer from velocity.kunde where kunde_id = v_id),
                      '^K-[0-9]{6}$', 'Kundennummer wird im Format K-000000 vergeben');

  return next throws_ok(
    $sql$insert into velocity.kunde (email, vorname, nachname)
         values ('anna@example.org', 'Zweite', 'Anna')$sql$,
    '23505', null, 'E-Mail ist eindeutig');

  return next throws_ok(
    $sql$insert into velocity.kunde (email, vorname, nachname)
         values ('keine-mail', 'Ohne', 'Klammeraffe')$sql$,
    '23514', null, 'Unplausible E-Mail wird abgewiesen');
end;
$$;

create or replace function velocity_test.test_a_adresse_dedupliziert()
returns setof text language plpgsql as $$
begin
  insert into velocity.adresse (strasse, hausnummer, plz, ort)
       values ('Sanderring', '2', '97070', 'Wuerzburg');

  return next throws_ok(
    $sql$insert into velocity.adresse (strasse, hausnummer, plz, ort)
         values ('Sanderring', '2', '97070', 'Wuerzburg')$sql$,
    '23505', null, 'Gleiche Adresse kann nicht zweimal angelegt werden');

  -- Ohne NOT NULL auf hausnummer waere diese Zusicherung nicht haltbar:
  -- in einem UNIQUE-Index gelten zwei NULL-Werte als verschieden.
  return next col_not_null('velocity'::name, 'adresse'::name, 'hausnummer'::name,
                           'hausnummer ist NOT NULL, damit der Fachschluessel greift');

  return next throws_ok(
    $sql$insert into velocity.adresse (strasse, hausnummer, plz, ort)
         values ('Testweg', '1', '9707', 'Wuerzburg')$sql$,
    '23514', null, 'Deutsche PLZ muss fuenfstellig sein');
end;
$$;
```

- [ ] **Schritt 2: Test ausführen und Fehlschlag bestätigen**

```bash
python3 db/test.py; echo "Rückgabewert: $?"
```

Erwartet: `not ok` für `has_table('velocity','adresse')` und Folgezusicherungen, Rückgabewert 1.

- [ ] **Schritt 3: Aufbauschritt 0002 schreiben**

`db/aufbau/0002_bereich_a_geschaeftspartner.sql`:

```sql
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
```

- [ ] **Schritt 4: Anwenden und Idempotenz nachweisen**

```bash
python3 db/run.py db/aufbau/0002_bereich_a_geschaeftspartner.sql
python3 db/run.py db/aufbau/0002_bereich_a_geschaeftspartner.sql
```

Erwartet: zweimal `OK`.

Schlägt der Lauf mit `permission denied for table users` fehl, fehlt dem Benutzer das Recht für den Fremdschlüssel auf `auth.users`. Dann den Fremdschlüssel `kunde_auth_uid_fk` weglassen, die Spalte `auth_uid` behalten und den Verzicht in `doku/datenmodell/05-physisches-modell.md` begründen — nicht heimlich weglassen.

- [ ] **Schritt 5: Tests ausführen und grün sehen**

```bash
python3 db/test.py; echo "Rückgabewert: $?"
```

Erwartet: alle Zusicherungen `ok`, Rückgabewert 0.

- [ ] **Schritt 6: Commit**

```bash
git add db/aufbau/0002_bereich_a_geschaeftspartner.sql db/tests/t0002_bereich_a.sql
git commit -m "feat: Bereich A mit adresse und kunde"
```

---

### Aufgabe 4: Bereich B — Netz und Flotte

**Dateien:**
- Anlegen: `db/aufbau/0003_bereich_b_netz_und_flotte.sql`
- Test: `db/tests/t0003_bereich_b.sql`

**Schnittstellen:**
- Nutzt: `velocity.adresse` aus Aufgabe 3, `velocity.fahrrad_status`, `velocity.fn_audit_anhaengen(text)`.
- Liefert: `velocity.station(station_id, stationsnummer, name, adresse_id, latitude, longitude, kapazitaet, betriebszeitraum)`, `velocity.fahrradtyp(typ_id, typ_code, bezeichnung, beschreibung, hat_elektro, zuladung_kg)`, `velocity.fahrradtyp_merkmal(merkmal_id, typ_id, sortierung, merkmal)`, `velocity.hersteller(hersteller_id, name)`, `velocity.fahrradmodell(modell_id, hersteller_id, typ_id, modellbezeichnung, baujahr)`, `velocity.fahrrad(fahrrad_id, rahmennummer, modell_id, status, angeschafft_am, ausgemustert_am)`, `velocity.fahrrad_position(fahrrad_id, station_id, latitude, longitude, akkustand_prozent, aktualisiert_am)`.

- [ ] **Schritt 1: Fehlschlagenden Test schreiben**

`db/tests/t0003_bereich_b.sql`:

```sql
-- =====================================================================
-- t0003 Bereich B: Netz und Flotte
-- =====================================================================
create schema if not exists velocity_test;
set search_path = velocity_test, velocity, extensions, public;

create or replace function velocity_test.test_b_struktur()
returns setof text language plpgsql as $$
begin
  return next has_table('velocity'::name, 'station'::name,            'Tabelle station existiert');
  return next has_table('velocity'::name, 'fahrradtyp'::name,         'Tabelle fahrradtyp existiert');
  return next has_table('velocity'::name, 'fahrradtyp_merkmal'::name, 'Tabelle fahrradtyp_merkmal existiert');
  return next has_table('velocity'::name, 'hersteller'::name,         'Tabelle hersteller existiert');
  return next has_table('velocity'::name, 'fahrradmodell'::name,      'Tabelle fahrradmodell existiert');
  return next has_table('velocity'::name, 'fahrrad'::name,            'Tabelle fahrrad existiert');
  return next has_table('velocity'::name, 'fahrrad_position'::name,   'Tabelle fahrrad_position existiert');

  -- Preise gehoeren nicht an den Typ, sondern in die historisierte
  -- Preistabelle aus Schritt 0004.
  return next hasnt_column('velocity'::name, 'fahrradtyp'::name, 'preis_pro_minute'::name,
                           'fahrradtyp traegt keinen Preis');
  return next hasnt_column('velocity'::name, 'fahrradtyp'::name, 'startgebuehr'::name,
                           'fahrradtyp traegt keine Startgebuehr');
  -- Koordinaten gehoeren an die Position, nicht an das Stammdatum.
  return next hasnt_column('velocity'::name, 'fahrrad'::name, 'latitude'::name,
                           'fahrrad traegt keine Koordinaten');

  return next col_is_pk('velocity'::name, 'fahrrad_position'::name, 'fahrrad_id'::name,
                        'fahrrad_position ist ueber den Fahrradschluessel 1:1 angebunden');
  return next fk_ok('velocity'::name, 'fahrrad'::name, 'modell_id'::name,
                    'velocity'::name, 'fahrradmodell'::name, 'modell_id'::name,
                    'fahrrad verweist auf fahrradmodell');
  return next fk_ok('velocity'::name, 'fahrradmodell'::name, 'typ_id'::name,
                    'velocity'::name, 'fahrradtyp'::name, 'typ_id'::name,
                    'fahrradmodell verweist auf fahrradtyp');
end;
$$;

create or replace function velocity_test.test_b_regeln()
returns setof text language plpgsql as $$
declare
  v_typ     bigint;
  v_herst   bigint;
  v_modell  bigint;
  v_rad     bigint;
begin
  insert into velocity.fahrradtyp (typ_code, bezeichnung, hat_elektro)
       values ('TEST', 'Testrad', false) returning typ_id into v_typ;
  insert into velocity.hersteller (name) values ('Testhersteller') returning hersteller_id into v_herst;
  insert into velocity.fahrradmodell (hersteller_id, typ_id, modellbezeichnung, baujahr)
       values (v_herst, v_typ, 'T1', 2026) returning modell_id into v_modell;
  insert into velocity.fahrrad (rahmennummer, modell_id) values ('RN-TEST-1')
    returning fahrrad_id into v_rad;

  return next is((select status::text from velocity.fahrrad where fahrrad_id = v_rad),
                 'verfuegbar', 'Neues Fahrrad ist standardmaessig verfuegbar');

  return next throws_ok(
    $sql$insert into velocity.station (stationsnummer, name, plz_platzhalter)
         values ('X', 'Y', 'Z')$sql$,
    '42703', null, 'Station hat keine Adressspalten, sondern einen Adressverweis');

  return next throws_ok(
    format($sql$insert into velocity.fahrrad_position (fahrrad_id, akkustand_prozent)
                values (%s, 150)$sql$, v_rad),
    '23514', null, 'Akkustand ueber 100 Prozent wird abgewiesen');

  return next lives_ok(
    format($sql$insert into velocity.fahrrad_position (fahrrad_id, latitude, longitude)
                values (%s, 49.7913, 9.9534)$sql$, v_rad),
    'Freie Position ohne Station ist zulaessig (Free-Floating)');
end;
$$;

create or replace function velocity_test.test_b_kapazitaet()
returns setof text language plpgsql as $$
declare
  v_adr bigint;
begin
  insert into velocity.adresse (strasse, hausnummer, plz, ort)
       values ('Bahnhofstrasse', '1', '97070', 'Wuerzburg') returning adresse_id into v_adr;

  return next throws_ok(
    format($sql$insert into velocity.station (stationsnummer, name, adresse_id, kapazitaet)
                values ('S-TEST', 'Teststation', %s, 0)$sql$, v_adr),
    '23514', null, 'Station mit Kapazitaet 0 wird abgewiesen');
end;
$$;
```

- [ ] **Schritt 2: Test ausführen und Fehlschlag bestätigen**

```bash
python3 db/test.py; echo "Rückgabewert: $?"
```

Erwartet: `not ok` für die Strukturzusicherungen aus `test_b_struktur`, Rückgabewert 1.

- [ ] **Schritt 3: Aufbauschritt 0003 schreiben**

`db/aufbau/0003_bereich_b_netz_und_flotte.sql`:

```sql
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
  constraint station_nummer_uk    unique (stationsnummer),
  constraint station_kapazitaet_chk check (kapazitaet > 0),
  constraint station_lat_chk  check (latitude  is null or latitude  between  -90 and  90),
  constraint station_lon_chk  check (longitude is null or longitude between -180 and 180),
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
```

- [ ] **Schritt 4: Anwenden und Idempotenz nachweisen**

```bash
python3 db/run.py db/aufbau/0003_bereich_b_netz_und_flotte.sql
python3 db/run.py db/aufbau/0003_bereich_b_netz_und_flotte.sql
```

Erwartet: zweimal `OK`.

- [ ] **Schritt 5: Tests ausführen und grün sehen**

```bash
python3 db/test.py; echo "Rückgabewert: $?"
```

Erwartet: alle Zusicherungen `ok`, Rückgabewert 0.

- [ ] **Schritt 6: Commit**

```bash
git add db/aufbau/0003_bereich_b_netz_und_flotte.sql db/tests/t0003_bereich_b.sql
git commit -m "feat: Bereich B mit Stationsnetz, Flotte und Positionssatellit"
```

---

### Aufgabe 5: Bereich C — Tarif und Preis

Der didaktische Kern des Entwurfs: Preise und Konditionen sind zeitabhängig, Überschneidungen verhindert die Datenbank selbst.

**Dateien:**
- Anlegen: `db/aufbau/0004_bereich_c_tarif_und_preis.sql`
- Test: `db/tests/t0004_bereich_c.sql`

**Schnittstellen:**
- Nutzt: `velocity.kunde`, `velocity.fahrradtyp`, `velocity.tarifart`, `extensions.btree_gist`.
- Liefert: `velocity.tarif(tarif_id, tarif_code, bezeichnung, art, voraussetzung)`, `velocity.tarif_kondition(kondition_id, tarif_id, gueltigkeit, monatspreis, freiminuten_pro_monat, rabatt_prozent)`, `velocity.mitgliedschaft(mitgliedschaft_id, kunde_id, tarif_id, gueltigkeit)`, `velocity.freiminuten_periode(periode_id, mitgliedschaft_id, jahr, monat, kontingent_minuten, verbraucht_minuten)`, `velocity.nutzungspreis(preis_id, typ_id, gueltigkeit, startgebuehr, preis_pro_minute, tageshoechstpreis)`. Alle Zeiträume sind `daterange` mit halboffener Grenze `[)`.

- [ ] **Schritt 1: Fehlschlagenden Test schreiben**

`db/tests/t0004_bereich_c.sql`:

```sql
-- =====================================================================
-- t0004 Bereich C: Tarif und Preis
-- =====================================================================
create schema if not exists velocity_test;
set search_path = velocity_test, velocity, extensions, public;

create or replace function velocity_test.test_c_struktur()
returns setof text language plpgsql as $$
begin
  return next has_table('velocity'::name, 'tarif'::name,               'Tabelle tarif existiert');
  return next has_table('velocity'::name, 'tarif_kondition'::name,     'Tabelle tarif_kondition existiert');
  return next has_table('velocity'::name, 'mitgliedschaft'::name,      'Tabelle mitgliedschaft existiert');
  return next has_table('velocity'::name, 'freiminuten_periode'::name, 'Tabelle freiminuten_periode existiert');
  return next has_table('velocity'::name, 'nutzungspreis'::name,       'Tabelle nutzungspreis existiert');
  return next col_type_is('velocity'::name, 'nutzungspreis'::name, 'gueltigkeit'::name,
                          'daterange', 'Preisgueltigkeit ist ein Zeitraumtyp');
  -- Der mutierende Zaehler des Altmodells darf nicht wiederkehren.
  return next hasnt_column('velocity'::name, 'mitgliedschaft'::name, 'freiminuten_aktuell'::name,
                           'mitgliedschaft fuehrt keinen mutierenden Freiminutenzaehler');
end;
$$;

create or replace function velocity_test.test_c_preise_ueberschneidungsfrei()
returns setof text language plpgsql as $$
declare
  v_typ bigint;
begin
  insert into velocity.fahrradtyp (typ_code, bezeichnung) values ('C1', 'Preistestrad')
    returning typ_id into v_typ;

  insert into velocity.nutzungspreis (typ_id, gueltigkeit, startgebuehr, preis_pro_minute, tageshoechstpreis)
       values (v_typ, daterange(date '2026-01-01', date '2026-07-01', '[)'), 1.00, 0.10, 10.00);

  return next lives_ok(
    format($sql$insert into velocity.nutzungspreis
             (typ_id, gueltigkeit, startgebuehr, preis_pro_minute, tageshoechstpreis)
           values (%s, daterange(date '2026-07-01', null, '[)'), 1.20, 0.12, 12.00)$sql$, v_typ),
    'Anschliessender Preiszeitraum ist zulaessig');

  return next throws_ok(
    format($sql$insert into velocity.nutzungspreis
             (typ_id, gueltigkeit, startgebuehr, preis_pro_minute, tageshoechstpreis)
           values (%s, daterange(date '2026-06-01', date '2026-08-01', '[)'), 9.99, 0.99, 99.00)$sql$, v_typ),
    '23P01', null, 'Ueberschneidender Preiszeitraum wird durch EXCLUDE abgewiesen');
end;
$$;

create or replace function velocity_test.test_c_eine_mitgliedschaft_je_zeitpunkt()
returns setof text language plpgsql as $$
declare
  v_kunde bigint;
  v_t1    bigint;
  v_t2    bigint;
begin
  insert into velocity.kunde (email, vorname, nachname)
       values ('c-test@example.org', 'Cara', 'Test') returning kunde_id into v_kunde;
  insert into velocity.tarif (tarif_code, bezeichnung) values ('C-A', 'Tarif A') returning tarif_id into v_t1;
  insert into velocity.tarif (tarif_code, bezeichnung) values ('C-B', 'Tarif B') returning tarif_id into v_t2;

  insert into velocity.mitgliedschaft (kunde_id, tarif_id, gueltigkeit)
       values (v_kunde, v_t1, daterange(date '2026-01-01', date '2026-06-01', '[)'));

  return next throws_ok(
    format($sql$insert into velocity.mitgliedschaft (kunde_id, tarif_id, gueltigkeit)
           values (%s, %s, daterange(date '2026-05-01', null, '[)'))$sql$, v_kunde, v_t2),
    '23P01', null, 'Zwei gleichzeitig gueltige Tarife je Kunde werden abgewiesen');

  return next lives_ok(
    format($sql$insert into velocity.mitgliedschaft (kunde_id, tarif_id, gueltigkeit)
           values (%s, %s, daterange(date '2026-06-01', null, '[)'))$sql$, v_kunde, v_t2),
    'Nahtloser Tarifwechsel ist zulaessig');
end;
$$;

create or replace function velocity_test.test_c_freiminuten_konto()
returns setof text language plpgsql as $$
declare
  v_kunde bigint;
  v_tarif bigint;
  v_mgl   bigint;
begin
  insert into velocity.kunde (email, vorname, nachname)
       values ('c-frei@example.org', 'Frei', 'Minute') returning kunde_id into v_kunde;
  insert into velocity.tarif (tarif_code, bezeichnung, art)
       values ('C-F', 'Freiminutentarif', 'vorteil') returning tarif_id into v_tarif;
  insert into velocity.mitgliedschaft (kunde_id, tarif_id, gueltigkeit)
       values (v_kunde, v_tarif, daterange(date '2026-01-01', null, '[)'))
    returning mitgliedschaft_id into v_mgl;

  insert into velocity.freiminuten_periode (mitgliedschaft_id, jahr, monat, kontingent_minuten)
       values (v_mgl, 2026, 8, 300);

  return next throws_ok(
    format($sql$update velocity.freiminuten_periode set verbraucht_minuten = 301
                 where mitgliedschaft_id = %s$sql$, v_mgl),
    '23514', null, 'Verbrauch ueber dem Kontingent wird abgewiesen');

  return next throws_ok(
    format($sql$insert into velocity.freiminuten_periode
             (mitgliedschaft_id, jahr, monat, kontingent_minuten)
           values (%s, 2026, 8, 100)$sql$, v_mgl),
    '23505', null, 'Je Mitgliedschaft und Monat gibt es genau eine Periode');
end;
$$;
```

- [ ] **Schritt 2: Test ausführen und Fehlschlag bestätigen**

```bash
python3 db/test.py; echo "Rückgabewert: $?"
```

Erwartet: `not ok` für `test_c_struktur`, Rückgabewert 1.

- [ ] **Schritt 3: Aufbauschritt 0004 schreiben**

`db/aufbau/0004_bereich_c_tarif_und_preis.sql`:

```sql
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
  monatspreis           numeric(10,2) not null default 0,
  freiminuten_pro_monat integer     not null default 0,
  rabatt_prozent        numeric(5,2) not null default 0,
  erstellt_am           timestamptz not null default now(),
  geaendert_am          timestamptz not null default now(),
  constraint tarif_kondition_monatspreis_chk check (monatspreis >= 0),
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
```

- [ ] **Schritt 4: Anwenden und Idempotenz nachweisen**

```bash
python3 db/run.py db/aufbau/0004_bereich_c_tarif_und_preis.sql
python3 db/run.py db/aufbau/0004_bereich_c_tarif_und_preis.sql
```

Erwartet: zweimal `OK`. Bricht der Lauf mit `data type bigint has no default operator class for access method "gist"` ab, fehlt `btree_gist` — Schritt 0001 erneut anwenden.

- [ ] **Schritt 5: Tests ausführen und grün sehen**

```bash
python3 db/test.py; echo "Rückgabewert: $?"
```

Erwartet: alle Zusicherungen `ok`, Rückgabewert 0.

- [ ] **Schritt 6: Commit**

```bash
git add db/aufbau/0004_bereich_c_tarif_und_preis.sql db/tests/t0004_bereich_c.sql
git commit -m "feat: Bereich C mit historisierten Tarifen, Preisen und Freiminutenkonto"
```

---

### Aufgabe 6: Bereich D — Nutzung

**Dateien:**
- Anlegen: `db/aufbau/0005_bereich_d_nutzung.sql`
- Test: `db/tests/t0005_bereich_d.sql`

**Schnittstellen:**
- Nutzt: `velocity.kunde`, `velocity.fahrrad`, `velocity.station`, `velocity.mitgliedschaft`, `velocity.nutzungspreis`, `velocity.ausleihe_status`.
- Liefert: `velocity.entgeltart(entgeltart_id, code, bezeichnung, vorzeichen)`, `velocity.ausleihe(ausleihe_id, kunde_id, fahrrad_id, mitgliedschaft_id, start_station_id, start_latitude, start_longitude, startzeit, end_station_id, end_latitude, end_longitude, endzeit, status, dauer_minuten)` mit `dauer_minuten` als berechneter Spalte, `velocity.entgeltposition(position_id, ausleihe_id, entgeltart_id, nutzungspreis_id, menge, einzelbetrag, betrag, sortierung)`.

- [ ] **Schritt 1: Fehlschlagenden Test schreiben**

`db/tests/t0005_bereich_d.sql`:

```sql
-- =====================================================================
-- t0005 Bereich D: Nutzung
-- =====================================================================
create schema if not exists velocity_test;
set search_path = velocity_test, velocity, extensions, public;

-- Hilfsfunktion: legt Kunde, Typ, Modell und Rad an und liefert die
-- Fahrrad-Kennung. Kein Test, deshalb ohne Praefix test_.
create or replace function velocity_test.fixture_rad(p_suffix text)
returns table (kunde_id bigint, fahrrad_id bigint)
language plpgsql as $$
declare
  v_typ bigint; v_h bigint; v_m bigint;
begin
  insert into velocity.kunde (email, vorname, nachname)
       values ('d-' || p_suffix || '@example.org', 'Dora', 'Test')
    returning velocity.kunde.kunde_id into kunde_id;
  insert into velocity.fahrradtyp (typ_code, bezeichnung)
       values ('D-' || p_suffix, 'Nutzungstestrad ' || p_suffix) returning typ_id into v_typ;
  insert into velocity.hersteller (name) values ('Hersteller ' || p_suffix)
    returning hersteller_id into v_h;
  insert into velocity.fahrradmodell (hersteller_id, typ_id, modellbezeichnung)
       values (v_h, v_typ, 'M-' || p_suffix) returning modell_id into v_m;
  insert into velocity.fahrrad (rahmennummer, modell_id)
       values ('RN-D-' || p_suffix, v_m) returning velocity.fahrrad.fahrrad_id into fahrrad_id;
  return next;
end;
$$;

create or replace function velocity_test.test_d_struktur()
returns setof text language plpgsql as $$
begin
  return next has_table('velocity'::name, 'entgeltart'::name,      'Tabelle entgeltart existiert');
  return next has_table('velocity'::name, 'ausleihe'::name,        'Tabelle ausleihe existiert');
  return next has_table('velocity'::name, 'entgeltposition'::name, 'Tabelle entgeltposition existiert');
  -- Die Kosten stehen in den Positionen, nicht als Einzelwert an der Ausleihe.
  return next hasnt_column('velocity'::name, 'ausleihe'::name, 'kosten'::name,
                           'ausleihe traegt keinen Sammelbetrag');
end;
$$;

create or replace function velocity_test.test_d_dauer_wird_berechnet()
returns setof text language plpgsql as $$
declare
  v_k bigint; v_f bigint; v_a bigint;
begin
  select f.kunde_id, f.fahrrad_id into v_k, v_f from velocity_test.fixture_rad('dauer') f;

  insert into velocity.ausleihe (kunde_id, fahrrad_id, startzeit, endzeit, status)
       values (v_k, v_f, timestamptz '2026-08-01 10:00:00+02',
                          timestamptz '2026-08-01 10:31:20+02', 'abgeschlossen')
    returning ausleihe_id into v_a;

  -- 31 Minuten 20 Sekunden werden zu 32 Minuten aufgerundet (GR6).
  return next is((select dauer_minuten from velocity.ausleihe where ausleihe_id = v_a),
                 32, 'Angefangene Minuten werden aufgerundet');

  return next throws_ok(
    format($sql$update velocity.ausleihe set dauer_minuten = 5 where ausleihe_id = %s$sql$, v_a),
    '428C9', null, 'dauer_minuten ist berechnet und nicht beschreibbar');
end;
$$;

create or replace function velocity_test.test_d_ein_rad_nur_einmal_aktiv()
returns setof text language plpgsql as $$
declare
  v_k bigint; v_f bigint;
begin
  select f.kunde_id, f.fahrrad_id into v_k, v_f from velocity_test.fixture_rad('aktiv') f;

  insert into velocity.ausleihe (kunde_id, fahrrad_id, startzeit) values (v_k, v_f, now());

  return next throws_ok(
    format($sql$insert into velocity.ausleihe (kunde_id, fahrrad_id, startzeit)
                values (%s, %s, now())$sql$, v_k, v_f),
    '23505', null, 'Dasselbe Rad kann nicht zweimal gleichzeitig aktiv ausgeliehen sein');
end;
$$;

create or replace function velocity_test.test_d_statuskonsistenz()
returns setof text language plpgsql as $$
declare
  v_k bigint; v_f bigint;
begin
  select f.kunde_id, f.fahrrad_id into v_k, v_f from velocity_test.fixture_rad('status') f;

  return next throws_ok(
    format($sql$insert into velocity.ausleihe (kunde_id, fahrrad_id, startzeit, endzeit, status)
                values (%s, %s, now(), now(), 'aktiv')$sql$, v_k, v_f),
    '23514', null, 'Aktive Ausleihe darf keine Endzeit haben');

  return next throws_ok(
    format($sql$insert into velocity.ausleihe (kunde_id, fahrrad_id, startzeit, status)
                values (%s, %s, now(), 'abgeschlossen')$sql$, v_k, v_f),
    '23514', null, 'Abgeschlossene Ausleihe braucht eine Endzeit');
end;
$$;
```

- [ ] **Schritt 2: Test ausführen und Fehlschlag bestätigen**

```bash
python3 db/test.py; echo "Rückgabewert: $?"
```

Erwartet: `not ok` für `test_d_struktur`, Rückgabewert 1.

- [ ] **Schritt 3: Aufbauschritt 0005 schreiben**

`db/aufbau/0005_bereich_d_nutzung.sql`:

```sql
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
  constraint entgeltart_code_uk       unique (code),
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
  constraint ausleihe_zeitfolge_chk check (endzeit is null or endzeit >= startzeit),
  constraint ausleihe_aktiv_chk         check (status <> 'aktiv'         or endzeit is null),
  constraint ausleihe_abgeschlossen_chk check (status <> 'abgeschlossen' or endzeit is not null),
  constraint ausleihe_kunde_fk foreign key (kunde_id)
    references velocity.kunde (kunde_id) on update cascade on delete restrict,
  constraint ausleihe_fahrrad_fk foreign key (fahrrad_id)
    references velocity.fahrrad (fahrrad_id) on update cascade on delete restrict,
  constraint ausleihe_mitgliedschaft_fk foreign key (mitgliedschaft_id)
    references velocity.mitgliedschaft (mitgliedschaft_id) on update cascade on delete set null,
  constraint ausleihe_startstation_fk foreign key (start_station_id)
    references velocity.station (station_id) on update cascade on delete set null,
  constraint ausleihe_endstation_fk foreign key (end_station_id)
    references velocity.station (station_id) on update cascade on delete set null
);
select velocity.fn_audit_anhaengen('ausleihe');

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
```

- [ ] **Schritt 4: Anwenden und Idempotenz nachweisen**

```bash
python3 db/run.py db/aufbau/0005_bereich_d_nutzung.sql
python3 db/run.py db/aufbau/0005_bereich_d_nutzung.sql
```

Erwartet: zweimal `OK`.

- [ ] **Schritt 5: Tests ausführen und grün sehen**

```bash
python3 db/test.py; echo "Rückgabewert: $?"
```

Erwartet: alle Zusicherungen `ok`, Rückgabewert 0. Meldet `test_d_dauer_wird_berechnet` einen anderen SQLSTATE als `428C9`, den tatsächlich gemeldeten Code in den Test übernehmen und den Abweichungsgrund als Kommentar vermerken.

- [ ] **Schritt 6: Commit**

```bash
git add db/aufbau/0005_bereich_d_nutzung.sql db/tests/t0005_bereich_d.sql
git commit -m "feat: Bereich D mit Ausleihe und nachvollziehbaren Entgeltpositionen"
```

---

### Aufgabe 7: Bereich E — Abrechnung

**Dateien:**
- Anlegen: `db/aufbau/0006_bereich_e_abrechnung.sql`
- Test: `db/tests/t0006_bereich_e.sql`

**Schnittstellen:**
- Nutzt: `velocity.kunde`, `velocity.ausleihe`, `velocity.rechnung_status`, `velocity.zahlung_status`.
- Liefert: `velocity.zahlungsart(zahlungsart_id, code, bezeichnung)`, `velocity.zahlungsmittel(zahlungsmittel_id, kunde_id, zahlungsart_id, referenz_token, inhaber, gueltig_bis, ist_standard)`, `velocity.rechnung(rechnung_id, rechnungsnummer, kunde_id, periode_jahr, periode_monat, erstellt_am_beleg, betrag_netto, ust_satz, ust_betrag, betrag_brutto, status)`, `velocity.rechnungsposition(rechnungsposition_id, rechnung_id, position_nr, ausleihe_id, beschreibung, betrag)`, `velocity.zahlung(zahlung_id, rechnung_id, zahlungsmittel_id, betrag, gebucht_am, status)`.

> Achtung auf die Benennung: die Belegspalte heißt `erstellt_am_beleg`, weil `erstellt_am` bereits die technische Audit-Spalte ist. Fachliche und technische Zeitstempel dürfen nicht denselben Namen tragen.

- [ ] **Schritt 1: Fehlschlagenden Test schreiben**

`db/tests/t0006_bereich_e.sql`:

```sql
-- =====================================================================
-- t0006 Bereich E: Abrechnung
-- =====================================================================
create schema if not exists velocity_test;
set search_path = velocity_test, velocity, extensions, public;

create or replace function velocity_test.test_e_struktur()
returns setof text language plpgsql as $$
begin
  return next has_table('velocity'::name, 'zahlungsart'::name,       'Tabelle zahlungsart existiert');
  return next has_table('velocity'::name, 'zahlungsmittel'::name,    'Tabelle zahlungsmittel existiert');
  return next has_table('velocity'::name, 'rechnung'::name,          'Tabelle rechnung existiert');
  return next has_table('velocity'::name, 'rechnungsposition'::name, 'Tabelle rechnungsposition existiert');
  return next has_table('velocity'::name, 'zahlung'::name,           'Tabelle zahlung existiert');
  -- Zahlungsdaten liegen beim Dienstleister, nicht bei uns.
  return next hasnt_column('velocity'::name, 'zahlungsmittel'::name, 'iban'::name,
                           'Es wird keine IBAN gespeichert');
  return next hasnt_column('velocity'::name, 'zahlungsmittel'::name, 'kartennummer'::name,
                           'Es wird keine Kartennummer gespeichert');
end;
$$;

create or replace function velocity_test.test_e_regeln()
returns setof text language plpgsql as $$
declare
  v_k bigint; v_za bigint; v_r bigint;
begin
  insert into velocity.kunde (email, vorname, nachname)
       values ('e-test@example.org', 'Emil', 'Test') returning kunde_id into v_k;
  insert into velocity.zahlungsart (code, bezeichnung) values ('E-SEPA', 'SEPA Test')
    returning zahlungsart_id into v_za;

  insert into velocity.zahlungsmittel (kunde_id, zahlungsart_id, referenz_token, ist_standard)
       values (v_k, v_za, 'tok_1', true);
  return next throws_ok(
    format($sql$insert into velocity.zahlungsmittel
             (kunde_id, zahlungsart_id, referenz_token, ist_standard)
           values (%s, %s, 'tok_2', true)$sql$, v_k, v_za),
    '23505', null, 'Je Kunde gibt es hoechstens ein Standardzahlungsmittel');

  insert into velocity.rechnung (rechnungsnummer, kunde_id, periode_jahr, periode_monat,
                                 betrag_netto, ust_satz, ust_betrag, betrag_brutto)
       values ('R-2026-08-0001', v_k, 2026, 8, 10.00, 19.00, 1.90, 11.90)
    returning rechnung_id into v_r;

  return next throws_ok(
    format($sql$insert into velocity.rechnung (rechnungsnummer, kunde_id, periode_jahr,
                 periode_monat, betrag_netto, ust_satz, ust_betrag, betrag_brutto)
           values ('R-2026-08-0002', %s, 2026, 8, 1, 19, 0.19, 1.19)$sql$, v_k),
    '23505', null, 'Je Kunde und Monat gibt es genau eine Rechnung (GR10)');

  insert into velocity.rechnungsposition (rechnung_id, position_nr, beschreibung, betrag)
       values (v_r, 1, 'Fahrt vom 01.08.2026', 11.90);
  return next throws_ok(
    format($sql$insert into velocity.rechnungsposition (rechnung_id, position_nr, beschreibung, betrag)
           values (%s, 1, 'Doppelte Position', 1.00)$sql$, v_r),
    '23505', null, 'Positionsnummern sind je Rechnung eindeutig');

  return next throws_ok(
    format($sql$insert into velocity.rechnung (rechnungsnummer, kunde_id, periode_jahr,
                 periode_monat, betrag_netto, ust_satz, ust_betrag, betrag_brutto)
           values ('R-X', %s, 2026, 13, 1, 19, 0.19, 1.19)$sql$, v_k),
    '23514', null, 'Monat 13 wird abgewiesen');
end;
$$;
```

- [ ] **Schritt 2: Test ausführen und Fehlschlag bestätigen**

```bash
python3 db/test.py; echo "Rückgabewert: $?"
```

Erwartet: `not ok` für `test_e_struktur`, Rückgabewert 1.

- [ ] **Schritt 3: Aufbauschritt 0006 schreiben**

`db/aufbau/0006_bereich_e_abrechnung.sql`:

```sql
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
  constraint zahlung_betrag_chk check (betrag >= 0),
  constraint zahlung_gebucht_chk check (status <> 'gebucht' or gebucht_am is not null),
  constraint zahlung_rechnung_fk foreign key (rechnung_id)
    references velocity.rechnung (rechnung_id) on update cascade on delete restrict,
  constraint zahlung_mittel_fk foreign key (zahlungsmittel_id)
    references velocity.zahlungsmittel (zahlungsmittel_id) on update cascade on delete set null
);
select velocity.fn_audit_anhaengen('zahlung');

create index if not exists idx_rechnung_kunde on velocity.rechnung (kunde_id);
create index if not exists idx_zahlung_rechnung on velocity.zahlung (rechnung_id);
```

- [ ] **Schritt 4: Anwenden, Idempotenz nachweisen, Tests grün sehen**

```bash
python3 db/run.py db/aufbau/0006_bereich_e_abrechnung.sql
python3 db/run.py db/aufbau/0006_bereich_e_abrechnung.sql
python3 db/test.py; echo "Rückgabewert: $?"
```

Erwartet: zweimal `OK`, danach alle Zusicherungen `ok` und Rückgabewert 0.

- [ ] **Schritt 5: Commit**

```bash
git add db/aufbau/0006_bereich_e_abrechnung.sql db/tests/t0006_bereich_e.sql
git commit -m "feat: Bereich E mit Rechnung, Position und Zahlung"
```

---

### Aufgabe 8: Bereich F — Redaktionsinhalte

Holt die fest kodierten Tarifkarten, FAQ-Einträge, How-to-Schritte und Kennzahlen aus `src/index.html` in die Datenbank.

**Dateien:**
- Anlegen: `db/aufbau/0007_bereich_f_inhalte.sql`
- Test: `db/tests/t0007_bereich_f.sql`

**Schnittstellen:**
- Liefert: `velocity.faq_eintrag(faq_id, frage, antwort, sortierung, aktiv)`, `velocity.nutzungsschritt(schritt_id, nummer, titel, beschreibung, icon_code)`, `velocity.kennzahl(kennzahl_id, schluessel, anzeigewert, label, sortierung, ist_berechnet)`.

- [ ] **Schritt 1: Fehlschlagenden Test schreiben**

`db/tests/t0007_bereich_f.sql`:

```sql
-- =====================================================================
-- t0007 Bereich F: Redaktionsinhalte
-- =====================================================================
create schema if not exists velocity_test;
set search_path = velocity_test, velocity, extensions, public;

create or replace function velocity_test.test_f_struktur()
returns setof text language plpgsql as $$
begin
  return next has_table('velocity'::name, 'faq_eintrag'::name,     'Tabelle faq_eintrag existiert');
  return next has_table('velocity'::name, 'nutzungsschritt'::name, 'Tabelle nutzungsschritt existiert');
  return next has_table('velocity'::name, 'kennzahl'::name,        'Tabelle kennzahl existiert');

  -- Bewusst KEIN Entity-Attribute-Value: es gibt keine generische
  -- Schluessel-Wert-Tabelle fuer Inhalte.
  return next hasnt_table('velocity'::name, 'inhalt_attribut'::name,
                          'Es gibt keine generische EAV-Tabelle fuer Inhalte');
end;
$$;

create or replace function velocity_test.test_f_regeln()
returns setof text language plpgsql as $$
begin
  insert into velocity.nutzungsschritt (nummer, titel, beschreibung)
       values (1, 'Finden', 'Freies Rad in der Karte suchen');
  return next throws_ok(
    $sql$insert into velocity.nutzungsschritt (nummer, titel, beschreibung)
         values (1, 'Doppelt', 'Zweiter Schritt mit Nummer 1')$sql$,
    '23505', null, 'Schrittnummern sind eindeutig');

  insert into velocity.kennzahl (schluessel, label, ist_berechnet)
       values ('stationen', 'Stationen', true);
  return next throws_ok(
    $sql$insert into velocity.kennzahl (schluessel, label, anzeigewert, ist_berechnet)
         values ('oekostrom', 'Oekostrom', null, false)$sql$,
    '23514', null, 'Nicht berechnete Kennzahl braucht einen Anzeigewert');
end;
$$;
```

- [ ] **Schritt 2: Test ausführen und Fehlschlag bestätigen**

```bash
python3 db/test.py; echo "Rückgabewert: $?"
```

Erwartet: `not ok` für `test_f_struktur`, Rückgabewert 1.

- [ ] **Schritt 3: Aufbauschritt 0007 schreiben**

`db/aufbau/0007_bereich_f_inhalte.sql`:

```sql
-- =====================================================================
-- 0007 Bereich F: Redaktionsinhalte
--
-- Zweck:      Inhalte der Website, die bisher fest in index.html standen.
-- Objekte:    velocity.faq_eintrag, velocity.nutzungsschritt,
--             velocity.kennzahl
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
  icon_code    text,
  erstellt_am  timestamptz not null default now(),
  geaendert_am timestamptz not null default now(),
  constraint nutzungsschritt_nummer_uk unique (nummer),
  constraint nutzungsschritt_nummer_chk check (nummer > 0)
);
select velocity.fn_audit_anhaengen('nutzungsschritt');

create table if not exists velocity.kennzahl (
  kennzahl_id  bigint generated always as identity primary key,
  schluessel   text        not null,
  anzeigewert  text,
  label        text        not null,
  sortierung   integer     not null default 0,
  ist_berechnet boolean    not null default false,
  erstellt_am  timestamptz not null default now(),
  geaendert_am timestamptz not null default now(),
  constraint kennzahl_schluessel_uk unique (schluessel),
  -- Entweder der Wert steht fest, oder er wird berechnet - nicht keines von beidem.
  constraint kennzahl_wert_chk check (ist_berechnet or anzeigewert is not null)
);
select velocity.fn_audit_anhaengen('kennzahl');
```

- [ ] **Schritt 4: Anwenden, Idempotenz nachweisen, Tests grün sehen**

```bash
python3 db/run.py db/aufbau/0007_bereich_f_inhalte.sql
python3 db/run.py db/aufbau/0007_bereich_f_inhalte.sql
python3 db/test.py; echo "Rückgabewert: $?"
```

Erwartet: zweimal `OK`, danach alle Zusicherungen `ok` und Rückgabewert 0.

- [ ] **Schritt 5: Commit**

```bash
git add db/aufbau/0007_bereich_f_inhalte.sql db/tests/t0007_bereich_f.sql
git commit -m "feat: Bereich F mit FAQ, Nutzungsschritten und Kennzahlen"
```

---

### Aufgabe 9: Referenz- und Redaktionsdaten

**Dateien:**
- Anlegen: `db/aufbau/0008_referenzdaten.sql`
- Test: `db/tests/t0008_referenzdaten.sql`

**Schnittstellen:**
- Liefert: die Codes `STARTGEBUEHR`, `ZEITENTGELT`, `FREIMINUTEN`, `TARIFRABATT`, `HOECHSTPREIS_KAPPUNG`, `ZUSCHLAG_FREIES_ABSTELLEN`, `BESTANDSUEBERNAHME` in `velocity.entgeltart` — Aufgabe 10 schlägt darüber die Positionen auf. Ferner die Fahrradtyp-Codes `CITY`, `EBIKE`, `CARGO` mit zugehörigem `nutzungspreis`, die Tarif-Codes `BASIS`, `STUDENT`, `OEPNV`, `PREMIUM` mit Konditionen sowie die Redaktionsinhalte.

Inhalte und Preise werden aus dem Bestand und aus `src/index.html` übernommen: Preise aus `cityBikesRental.fahrradtyp`, Freiminuten aus `cityBikesRental.tarif`, FAQ und Schritte aus dem HTML.

- [ ] **Schritt 1: Fehlschlagenden Test schreiben**

`db/tests/t0008_referenzdaten.sql`:

```sql
-- =====================================================================
-- t0008 Referenz- und Redaktionsdaten
-- =====================================================================
create schema if not exists velocity_test;
set search_path = velocity_test, velocity, extensions, public;

create or replace function velocity_test.test_ref_entgeltarten()
returns setof text language plpgsql as $$
begin
  return next is((select count(*)::int from velocity.entgeltart), 7,
                 'Es gibt sieben Entgeltarten');
  return next is((select vorzeichen from velocity.entgeltart where code = 'ZEITENTGELT'),
                 1::smallint, 'Zeitentgelt belastet');
  return next is((select vorzeichen from velocity.entgeltart where code = 'FREIMINUTEN'),
                 (-1)::smallint, 'Freiminuten entlasten');
  return next is((select vorzeichen from velocity.entgeltart where code = 'TARIFRABATT'),
                 (-1)::smallint, 'Tarifrabatt entlastet');
end;
$$;

create or replace function velocity_test.test_ref_preise()
returns setof text language plpgsql as $$
begin
  return next is((select count(*)::int from velocity.fahrradtyp), 3, 'Drei Fahrradtypen');
  return next is((select count(*)::int from velocity.nutzungspreis), 3,
                 'Je Fahrradtyp genau ein gueltiger Preis');
  return next is(
    (select p.preis_pro_minute from velocity.nutzungspreis p
       join velocity.fahrradtyp t on t.typ_id = p.typ_id where t.typ_code = 'CITY'),
    0.10::numeric(10,2), 'CityRad kostet 0,10 Euro je Minute');
  return next is(
    (select p.tageshoechstpreis from velocity.nutzungspreis p
       join velocity.fahrradtyp t on t.typ_id = p.typ_id where t.typ_code = 'CARGO'),
    22.00::numeric(10,2), 'Lastenrad ist bei 22,00 Euro am Tag gedeckelt');
  return next ok(
    (select bool_and(upper_inf(gueltigkeit)) from velocity.nutzungspreis),
    'Alle Preise sind nach oben offen gueltig');
end;
$$;

create or replace function velocity_test.test_ref_tarife_und_inhalte()
returns setof text language plpgsql as $$
begin
  return next is((select count(*)::int from velocity.tarif), 4, 'Vier Tarife');
  return next is(
    (select k.freiminuten_pro_monat from velocity.tarif_kondition k
       join velocity.tarif t on t.tarif_id = k.tarif_id where t.tarif_code = 'PREMIUM'),
    1000, 'Premium bringt 1000 Freiminuten je Monat');
  return next is(
    (select k.rabatt_prozent from velocity.tarif_kondition k
       join velocity.tarif t on t.tarif_id = k.tarif_id where t.tarif_code = 'PREMIUM'),
    20.00::numeric(5,2), 'Premium gewaehrt 20 Prozent Rabatt');
  return next is((select count(*)::int from velocity.faq_eintrag where aktiv), 4,
                 'Vier aktive FAQ-Eintraege');
  return next is((select count(*)::int from velocity.nutzungsschritt), 3, 'Drei Nutzungsschritte');
  return next is((select count(*)::int from velocity.kennzahl), 4, 'Vier Kennzahlen');
  return next is((select count(*)::int from velocity.fahrradtyp_merkmal), 9,
                 'Je Fahrradtyp drei Merkmale fuer die Tarifkarte');
end;
$$;
```

- [ ] **Schritt 2: Test ausführen und Fehlschlag bestätigen**

```bash
python3 db/test.py; echo "Rückgabewert: $?"
```

Erwartet: `not ok` mit `have: 0` für die Zählungen, Rückgabewert 1.

- [ ] **Schritt 3: Aufbauschritt 0008 schreiben**

`db/aufbau/0008_referenzdaten.sql`:

```sql
-- =====================================================================
-- 0008 Referenz- und Redaktionsdaten
--
-- Zweck:      Fachlich feste Schluesselwerte sowie die Inhalte, die
--             bisher in src/index.html standen.
-- Objekte:    Datenzeilen in entgeltart, zahlungsart, fahrradtyp,
--             fahrradtyp_merkmal, nutzungspreis, tarif, tarif_kondition,
--             faq_eintrag, nutzungsschritt, kennzahl
-- Ruecknahme: DELETE aus denselben Tabellen; die Struktur bleibt.
--
-- Alle Einfuegungen sind idempotent ueber ON CONFLICT DO UPDATE bzw.
-- DO NOTHING auf dem jeweiligen Fachschluessel.
-- =====================================================================

insert into velocity.entgeltart (code, bezeichnung, vorzeichen) values
  ('STARTGEBUEHR',              'Startgebuehr',                       1),
  ('ZEITENTGELT',               'Zeitentgelt',                        1),
  ('FREIMINUTEN',               'Gutschrift Freiminuten',            -1),
  ('TARIFRABATT',               'Tarifrabatt',                       -1),
  ('HOECHSTPREIS_KAPPUNG',      'Kappung auf Tageshoechstpreis',     -1),
  ('ZUSCHLAG_FREIES_ABSTELLEN', 'Zuschlag Abstellen ausserhalb Station', 1),
  ('BESTANDSUEBERNAHME',        'Uebernahme aus dem Altbestand',      1)
on conflict (code) do update
  set bezeichnung = excluded.bezeichnung, vorzeichen = excluded.vorzeichen;

insert into velocity.zahlungsart (code, bezeichnung) values
  ('SEPA',        'SEPA-Lastschrift'),
  ('KREDITKARTE', 'Kreditkarte'),
  ('PAYPAL',      'PayPal')
on conflict (code) do update set bezeichnung = excluded.bezeichnung;

-- ---------------------------------------------------------------------
-- Fahrradtypen: Bezeichnungen wie auf der Website, Codes fuer die Technik.
-- ---------------------------------------------------------------------
insert into velocity.fahrradtyp (typ_code, bezeichnung, beschreibung, hat_elektro, zuladung_kg) values
  ('CITY',  'City-Bike',
   '7-Gang Stadtrad mit Gepaecktraeger, LED-Beleuchtung und verstellbarem Sattel', false, 20),
  ('EBIKE', 'E-Bike Sport',
   'Pedelec mit 250 W Motor, Reichweite bis 50 km, Display mit Akkustand',        true,  20),
  ('CARGO', 'E-Cargo Loader',
   'E-Lastenrad mit grosser Transportbox, Tragkraft bis 80 kg',                   true, 100)
on conflict (typ_code) do update
  set bezeichnung = excluded.bezeichnung,
      beschreibung = excluded.beschreibung,
      hat_elektro  = excluded.hat_elektro,
      zuladung_kg  = excluded.zuladung_kg;

insert into velocity.fahrradtyp_merkmal (typ_id, sortierung, merkmal)
select t.typ_id, m.sortierung, m.merkmal
  from (values
    ('CITY',  1, '8-Gang Nabenschaltung'),
    ('CITY',  2, 'Pannensichere Reifen'),
    ('CITY',  3, 'Komfort-Sattel'),
    ('EBIKE', 1, 'Bosch Performance CX'),
    ('EBIKE', 2, 'Bis 25 km/h Unterstuetzung'),
    ('EBIKE', 3, 'Ideal fuers Hubland'),
    ('CARGO', 1, 'Grosse Transportbox (100 kg)'),
    ('CARGO', 2, 'Starker E-Motor'),
    ('CARGO', 3, 'Sitzbank fuer zwei Kinder')
  ) as m(typ_code, sortierung, merkmal)
  join velocity.fahrradtyp t on t.typ_code = m.typ_code
on conflict (typ_id, sortierung) do update set merkmal = excluded.merkmal;

-- ---------------------------------------------------------------------
-- Preise: uebernommen aus cityBikesRental.fahrradtyp, ab heute gueltig
-- und nach oben offen.
-- ---------------------------------------------------------------------
insert into velocity.nutzungspreis (typ_id, gueltigkeit, startgebuehr, preis_pro_minute, tageshoechstpreis)
select t.typ_id, daterange(current_date, null, '[)'), p.start, p.minute, p.hoechst
  from (values
    ('CITY',  0.10, 0.10, 10.00),
    ('EBIKE', 1.00, 0.10, 15.00),
    ('CARGO', 2.00, 0.10, 22.00)
  ) as p(typ_code, start, minute, hoechst)
  join velocity.fahrradtyp t on t.typ_code = p.typ_code
 where not exists (
   select 1 from velocity.nutzungspreis np
    where np.typ_id = t.typ_id and upper_inf(np.gueltigkeit)
 );

-- ---------------------------------------------------------------------
-- Tarife und ihre Konditionen
-- ---------------------------------------------------------------------
insert into velocity.tarif (tarif_code, bezeichnung, art, voraussetzung) values
  ('BASIS',   'Basistarif',      'standard', null),
  ('STUDENT', 'Studententarif',  'vorteil',  'Gueltiger Studierendenausweis'),
  ('OEPNV',   'OEPNV-Abo',       'vorteil',  'VGN-Abo oder Deutschlandticket'),
  ('PREMIUM', 'Premium',         'vorteil',  'Kostenpflichtiges Abo')
on conflict (tarif_code) do update
  set bezeichnung = excluded.bezeichnung,
      art          = excluded.art,
      voraussetzung = excluded.voraussetzung;

insert into velocity.tarif_kondition
  (tarif_id, gueltigkeit, monatspreis, freiminuten_pro_monat, rabatt_prozent)
select t.tarif_id, daterange(current_date, null, '[)'), k.monat, k.frei, k.rabatt
  from (values
    ('BASIS',   0.00,  0,     0.00),
    ('STUDENT', 0.00,  300,   0.00),
    ('OEPNV',   0.00,  600,   0.00),
    ('PREMIUM', 9.90,  1000, 20.00)
  ) as k(tarif_code, monat, frei, rabatt)
  join velocity.tarif t on t.tarif_code = k.tarif_code
 where not exists (
   select 1 from velocity.tarif_kondition tk
    where tk.tarif_id = t.tarif_id and upper_inf(tk.gueltigkeit)
 );

-- ---------------------------------------------------------------------
-- Redaktionsinhalte, wortgleich aus src/index.html uebernommen
-- ---------------------------------------------------------------------
insert into velocity.faq_eintrag (frage, antwort, sortierung) values
  ('Wie kann ich bezahlen?',
   'Wir akzeptieren PayPal, Kreditkarte und SEPA-Lastschrift. Die Abrechnung erfolgt automatisch.', 1),
  ('Darf ich das Rad kurz parken?',
   'Ja, absolut! Nutze in der App den Parkmodus. Die Miete laeuft weiter, das Schloss verriegelt.', 2),
  ('Gibt es Rabatte fuer Studierende?',
   'Ja! Registriere dich einfach mit deiner Adresse @uni-wuerzburg.de fuer den Campus-Tarif.', 3),
  ('Was passiert bei einem Defekt?',
   'Melde den Schaden ueber die App. Wir beenden deine Miete sofort kostenfrei.', 4)
on conflict (frage) do update
  set antwort = excluded.antwort, sortierung = excluded.sortierung;

insert into velocity.nutzungsschritt (nummer, titel, beschreibung, icon_code) values
  (1, 'App laden und finden',
      'Registriere dich einmalig kostenlos. Finde in der Web-App oder nativen App das naechste freie Rad in deiner Naehe.',
      'fa-mobile-screen-button'),
  (2, 'Scannen und losfahren',
      'Scanne den QR-Code am Schutzblech oder gib die Rad-Nummer ein. Das Schloss oeffnet sich automatisch.',
      'fa-qrcode'),
  (3, 'Parken und beenden',
      'Stelle das Rad an einer Station (gratis) oder in der Flex-Zone (gegen Gebuehr) ab. Schloss schliessen, fertig.',
      'fa-square-parking')
on conflict (nummer) do update
  set titel = excluded.titel, beschreibung = excluded.beschreibung, icon_code = excluded.icon_code;

insert into velocity.kennzahl (schluessel, anzeigewert, label, sortierung, ist_berechnet) values
  ('stationen',        null,      'Stationen',        1, true),
  ('verfuegbarkeit',   '24/7',    'Verfuegbarkeit',   2, false),
  ('oekostrom',        '100%',    'Oekostrom',        3, false),
  ('anmeldegebuehr',   '0 Euro',  'Anmeldegebuehr',   4, false)
on conflict (schluessel) do update
  set anzeigewert = excluded.anzeigewert,
      label        = excluded.label,
      sortierung   = excluded.sortierung,
      ist_berechnet = excluded.ist_berechnet;
```

- [ ] **Schritt 4: Anwenden, Idempotenz nachweisen, Tests grün sehen**

```bash
python3 db/run.py db/aufbau/0008_referenzdaten.sql
python3 db/run.py db/aufbau/0008_referenzdaten.sql
python3 db/test.py; echo "Rückgabewert: $?"
```

Erwartet: zweimal `OK` und danach alle Zusicherungen `ok`. Meldet `test_ref_preise` nach dem zweiten Lauf sechs statt drei Preise, ist die `WHERE NOT EXISTS`-Bedingung falsch — beheben, nicht die Erwartung anpassen.

- [ ] **Schritt 5: Commit**

```bash
git add db/aufbau/0008_referenzdaten.sql db/tests/t0008_referenzdaten.sql
git commit -m "feat: Referenzdaten, Preise, Tarife und Redaktionsinhalte"
```

---

### Aufgabe 10: Geschäftslogik und Preisfindung

Die wichtigste Aufgabe des Plans. Hier wird der Fachlogikfehler des Altsystems (Befund B3 der Spec) strukturell ausgeschlossen.

**Trennung der Verantwortung:** die Fachlogik liegt in `fn_*`-Funktionen, die eine `kunde_id` als Parameter bekommen und nichts über Anmeldung wissen. Darüber liegen dünne `api_*`-Funktionen mit `SECURITY DEFINER`, die aus `auth.uid()` die `kunde_id` auflösen. Das macht die Fachlogik ohne Anmeldung testbar und ist zugleich die saubere Schichtung für die Vorlesung.

**Dateien:**
- Anlegen: `db/aufbau/0009_geschaeftslogik.sql`
- Test: `db/tests/t0009_preisfindung.sql`

**Schnittstellen:**
- Nutzt: sämtliche Tabellen der Bereiche A bis E, die Entgeltart-Codes aus Aufgabe 9.
- Liefert:
  - `velocity.fn_kunde_aus_auth() returns bigint`
  - `velocity.fn_position_anlegen(p_ausleihe_id bigint, p_code text, p_menge numeric, p_einzelbetrag numeric, p_nutzungspreis_id bigint, p_sortierung integer) returns void`
  - `velocity.fn_ausleihe_starten(p_kunde_id bigint, p_fahrrad_id bigint) returns table (ausleihe_id bigint, meldung text)`
  - `velocity.fn_ausleihe_beenden(p_kunde_id bigint, p_ausleihe_id bigint, p_end_station_id bigint, p_latitude numeric, p_longitude numeric) returns table (gesamtbetrag numeric, dauer_minuten integer, meldung text)`
  - `velocity.api_kunde_sicherstellen() returns table (kunde_id bigint, kundennummer text, ist_neu boolean)`
  - `velocity.api_profil_aktualisieren(p_vorname text, p_nachname text, p_telefon text, p_geburtsdatum date, p_strasse text, p_hausnummer text, p_plz text, p_ort text) returns table (meldung text)`
  - `velocity.api_ausleihe_starten(p_fahrrad_id bigint) returns table (ausleihe_id bigint, meldung text)`
  - `velocity.api_ausleihe_beenden(p_ausleihe_id bigint, p_end_station_id bigint, p_latitude numeric, p_longitude numeric) returns table (gesamtbetrag numeric, dauer_minuten integer, meldung text)`

  Aufgabe 15 ruft ausschließlich die vier `api_*`-Funktionen auf.

- [ ] **Schritt 1: Fehlschlagenden Test schreiben**

Die Vorrichtung legt eine bereits laufende Ausleihe mit einer Startzeit von 60 Minuten und 30 Sekunden in der Vergangenheit an. Damit ergibt das Aufrunden auf angefangene Minuten reproduzierbar **61 Minuten**, unabhängig von der Laufzeit des Tests.

`db/tests/t0009_preisfindung.sql`:

```sql
-- =====================================================================
-- t0009 Geschaeftslogik und Preisfindung
--
-- Preisgrundlage aller Faelle: Startgebuehr 0,10 EUR,
-- 0,10 EUR je Minute, Dauer 61 Minuten => Zwischensumme 6,20 EUR.
-- =====================================================================
create schema if not exists velocity_test;
set search_path = velocity_test, velocity, extensions, public;

-- Vorrichtung: Typ, Preis, Rad, Kunde, optionaler Tarif und eine
-- laufende Ausleihe mit definierter Dauer.
create or replace function velocity_test.fixture_preisfall(
  p_suffix            text,
  p_tageshoechstpreis numeric,
  p_freiminuten       integer,   -- NULL = keine Mitgliedschaft
  p_rabatt            numeric
)
returns table (o_kunde_id bigint, o_ausleihe_id bigint, o_periode_id bigint)
language plpgsql as $$
declare
  v_typ bigint; v_h bigint; v_m bigint; v_rad bigint;
  v_tarif bigint; v_mgl bigint;
begin
  insert into velocity.fahrradtyp (typ_code, bezeichnung)
       values ('P-' || p_suffix, 'Preisfall ' || p_suffix) returning typ_id into v_typ;
  insert into velocity.nutzungspreis
         (typ_id, gueltigkeit, startgebuehr, preis_pro_minute, tageshoechstpreis)
       values (v_typ, daterange(current_date - 365, null, '[)'), 0.10, 0.10, p_tageshoechstpreis);
  insert into velocity.hersteller (name) values ('H-' || p_suffix) returning hersteller_id into v_h;
  insert into velocity.fahrradmodell (hersteller_id, typ_id, modellbezeichnung)
       values (v_h, v_typ, 'M-' || p_suffix) returning modell_id into v_m;
  insert into velocity.fahrrad (rahmennummer, modell_id, status)
       values ('RN-P-' || p_suffix, v_m, 'ausgeliehen') returning fahrrad_id into v_rad;
  insert into velocity.fahrrad_position (fahrrad_id) values (v_rad);

  insert into velocity.kunde (email, vorname, nachname)
       values ('p-' || p_suffix || '@example.org', 'Paul', 'Preis')
    returning kunde_id into o_kunde_id;

  o_periode_id := null;
  v_mgl := null;
  if p_freiminuten is not null then
    insert into velocity.tarif (tarif_code, bezeichnung, art)
         values ('P-' || p_suffix, 'Tarif ' || p_suffix, 'vorteil') returning tarif_id into v_tarif;
    insert into velocity.tarif_kondition
           (tarif_id, gueltigkeit, monatspreis, freiminuten_pro_monat, rabatt_prozent)
         values (v_tarif, daterange(current_date - 365, null, '[)'), 0, p_freiminuten, p_rabatt);
    insert into velocity.mitgliedschaft (kunde_id, tarif_id, gueltigkeit)
         values (o_kunde_id, v_tarif, daterange(current_date - 365, null, '[)'))
      returning mitgliedschaft_id into v_mgl;
    insert into velocity.freiminuten_periode
           (mitgliedschaft_id, jahr, monat, kontingent_minuten, verbraucht_minuten)
         values (v_mgl,
                 extract(year  from now())::int,
                 extract(month from now())::int,
                 p_freiminuten, 0)
      returning periode_id into o_periode_id;
  end if;

  insert into velocity.ausleihe
         (kunde_id, fahrrad_id, mitgliedschaft_id, startzeit, status)
       values (o_kunde_id, v_rad, v_mgl,
               now() - interval '60 minutes 30 seconds', 'aktiv')
    returning ausleihe_id into o_ausleihe_id;

  return next;
end;
$$;

create or replace function velocity_test.test_p1_ohne_tarif()
returns setof text language plpgsql as $$
declare v_f record; v_e record;
begin
  select * into v_f from velocity_test.fixture_preisfall('f1', 10.00, null, 0);
  select * into v_e from velocity.fn_ausleihe_beenden(v_f.o_kunde_id, v_f.o_ausleihe_id, null, null, null);

  return next is(v_e.dauer_minuten, 61, 'Dauer wird auf 61 angefangene Minuten aufgerundet');
  return next is(v_e.gesamtbetrag, 6.20::numeric, 'Ohne Tarif: 0,10 + 61 x 0,10 = 6,20 EUR');
  return next is((select count(*)::int from velocity.entgeltposition
                   where ausleihe_id = v_f.o_ausleihe_id), 2,
                 'Zwei Positionen: Startgebuehr und Zeitentgelt');
  return next is((select sum(betrag) from velocity.entgeltposition
                   where ausleihe_id = v_f.o_ausleihe_id), 6.20::numeric,
                 'Summe der Positionen entspricht dem Rueckgabewert');
  return next is((select status::text from velocity.ausleihe where ausleihe_id = v_f.o_ausleihe_id),
                 'abgeschlossen', 'Ausleihe ist abgeschlossen');
end;
$$;

create or replace function velocity_test.test_p2_freiminuten_teilweise()
returns setof text language plpgsql as $$
declare v_f record; v_e record;
begin
  select * into v_f from velocity_test.fixture_preisfall('f2', 10.00, 30, 0);
  select * into v_e from velocity.fn_ausleihe_beenden(v_f.o_kunde_id, v_f.o_ausleihe_id, null, null, null);

  -- 0,10 + 6,10 - 3,00 (30 Freiminuten x 0,10)
  return next is(v_e.gesamtbetrag, 3.20::numeric, 'Teilweise Freiminuten: 3,20 EUR');
  return next is((select betrag from velocity.entgeltposition p
                    join velocity.entgeltart a on a.entgeltart_id = p.entgeltart_id
                   where p.ausleihe_id = v_f.o_ausleihe_id and a.code = 'FREIMINUTEN'),
                 (-3.00)::numeric, 'Freiminuten stehen als eigene Gutschrift auf der Rechnung');
  return next is((select verbraucht_minuten from velocity.freiminuten_periode
                   where periode_id = v_f.o_periode_id), 30,
                 'Genau die verrechneten Freiminuten werden abgebucht');
end;
$$;

create or replace function velocity_test.test_p3_freiminuten_vollstaendig()
returns setof text language plpgsql as $$
declare v_f record; v_e record;
begin
  select * into v_f from velocity_test.fixture_preisfall('f3', 10.00, 300, 0);
  select * into v_e from velocity.fn_ausleihe_beenden(v_f.o_kunde_id, v_f.o_ausleihe_id, null, null, null);

  -- Nur die Startgebuehr bleibt stehen.
  return next is(v_e.gesamtbetrag, 0.10::numeric, 'Volle Freiminutendeckung: nur Startgebuehr');
  return next is((select verbraucht_minuten from velocity.freiminuten_periode
                   where periode_id = v_f.o_periode_id), 61,
                 'Es werden nur die tatsaechlich gefahrenen Minuten abgebucht, nicht das ganze Kontingent');
end;
$$;

create or replace function velocity_test.test_p4_tarifrabatt()
returns setof text language plpgsql as $$
declare v_f record; v_e record;
begin
  select * into v_f from velocity_test.fixture_preisfall('f4', 10.00, 0, 20.00);
  select * into v_e from velocity.fn_ausleihe_beenden(v_f.o_kunde_id, v_f.o_ausleihe_id, null, null, null);

  -- 6,20 - 20 Prozent (1,24) = 4,96
  return next is(v_e.gesamtbetrag, 4.96::numeric, 'Rabatt von 20 Prozent ergibt 4,96 EUR');
  return next is((select betrag from velocity.entgeltposition p
                    join velocity.entgeltart a on a.entgeltart_id = p.entgeltart_id
                   where p.ausleihe_id = v_f.o_ausleihe_id and a.code = 'TARIFRABATT'),
                 (-1.24)::numeric, 'Rabatt steht als eigene Position auf der Rechnung');
end;
$$;

create or replace function velocity_test.test_p5_hoechstpreis_kappung()
returns setof text language plpgsql as $$
declare v_f record; v_e record;
begin
  select * into v_f from velocity_test.fixture_preisfall('f5', 5.00, null, 0);
  select * into v_e from velocity.fn_ausleihe_beenden(v_f.o_kunde_id, v_f.o_ausleihe_id, null, null, null);

  return next is(v_e.gesamtbetrag, 5.00::numeric, 'Betrag wird auf den Tageshoechstpreis gekappt');
  return next is((select betrag from velocity.entgeltposition p
                    join velocity.entgeltart a on a.entgeltart_id = p.entgeltart_id
                   where p.ausleihe_id = v_f.o_ausleihe_id and a.code = 'HOECHSTPREIS_KAPPUNG'),
                 (-1.20)::numeric, 'Die Kappung bleibt als Position sichtbar');
end;
$$;

create or replace function velocity_test.test_p6_reihenfolge_rabatt_vor_kappung()
returns setof text language plpgsql as $$
declare v_f record; v_e record;
begin
  -- Hoechstpreis 5,00 und 20 Prozent Rabatt: 6,20 - 1,24 = 4,96 liegt
  -- unter der Kappungsgrenze, es wird also NICHT gekappt. Waere die
  -- Reihenfolge umgekehrt, kaeme 4,00 heraus.
  select * into v_f from velocity_test.fixture_preisfall('f6', 5.00, 0, 20.00);
  select * into v_e from velocity.fn_ausleihe_beenden(v_f.o_kunde_id, v_f.o_ausleihe_id, null, null, null);

  return next is(v_e.gesamtbetrag, 4.96::numeric,
                 'Rabatt wird vor der Kappung angewandt (Geschaeftsregel)');
  return next is((select count(*)::int from velocity.entgeltposition p
                    join velocity.entgeltart a on a.entgeltart_id = p.entgeltart_id
                   where p.ausleihe_id = v_f.o_ausleihe_id and a.code = 'HOECHSTPREIS_KAPPUNG'),
                 0, 'Ohne Ueberschreitung entsteht keine Kappungsposition');
end;
$$;

create or replace function velocity_test.test_p7_zugriffsschutz_und_grenzen()
returns setof text language plpgsql as $$
declare v_f record; v_fremd bigint; v_e record;
begin
  select * into v_f from velocity_test.fixture_preisfall('f7', 10.00, null, 0);
  insert into velocity.kunde (email, vorname, nachname)
       values ('fremd@example.org', 'Frieda', 'Fremd') returning kunde_id into v_fremd;

  select * into v_e from velocity.fn_ausleihe_beenden(v_fremd, v_f.o_ausleihe_id, null, null, null);
  return next is(v_e.meldung, 'Keine Berechtigung fuer diese Ausleihe',
                 'Fremde Ausleihe kann nicht beendet werden (GR9)');
  return next is((select status::text from velocity.ausleihe where ausleihe_id = v_f.o_ausleihe_id),
                 'aktiv', 'Die fremde Ausleihe bleibt unveraendert aktiv');

  -- Zweiter Abschluss derselben Ausleihe
  perform velocity.fn_ausleihe_beenden(v_f.o_kunde_id, v_f.o_ausleihe_id, null, null, null);
  select * into v_e from velocity.fn_ausleihe_beenden(v_f.o_kunde_id, v_f.o_ausleihe_id, null, null, null);
  return next is(v_e.meldung, 'Ausleihe ist nicht aktiv',
                 'Eine bereits beendete Ausleihe wird nicht erneut abgerechnet');
end;
$$;

create or replace function velocity_test.test_p8_hoechstens_vier_aktive()
returns setof text language plpgsql as $$
declare
  v_kunde bigint; v_typ bigint; v_h bigint; v_m bigint; v_rad bigint;
  v_e record; i int;
begin
  insert into velocity.kunde (email, vorname, nachname)
       values ('p8@example.org', 'Vier', 'Raeder') returning kunde_id into v_kunde;
  insert into velocity.fahrradtyp (typ_code, bezeichnung) values ('P-8', 'Grenzfall') returning typ_id into v_typ;
  insert into velocity.nutzungspreis (typ_id, gueltigkeit, startgebuehr, preis_pro_minute, tageshoechstpreis)
       values (v_typ, daterange(current_date - 365, null, '[)'), 0.10, 0.10, 10.00);
  insert into velocity.hersteller (name) values ('H-8') returning hersteller_id into v_h;
  insert into velocity.fahrradmodell (hersteller_id, typ_id, modellbezeichnung)
       values (v_h, v_typ, 'M-8') returning modell_id into v_m;

  for i in 1..5 loop
    insert into velocity.fahrrad (rahmennummer, modell_id) values ('RN-P8-' || i, v_m)
      returning fahrrad_id into v_rad;
    insert into velocity.fahrrad_position (fahrrad_id) values (v_rad);
    select * into v_e from velocity.fn_ausleihe_starten(v_kunde, v_rad);
    if i <= 4 then
      return next ok(v_e.ausleihe_id is not null, format('Ausleihe %s wird angenommen', i));
    else
      return next is(v_e.meldung, 'Maximale Anzahl aktiver Ausleihen (4) erreicht',
                     'Die fuenfte gleichzeitige Ausleihe wird abgewiesen (GR2)');
    end if;
  end loop;
end;
$$;

create or replace function velocity_test.test_p9_api_ohne_anmeldung()
returns setof text language plpgsql as $$
declare v_e record;
begin
  -- Ohne JWT liefert auth.uid() NULL; die api-Schicht muss das abfangen,
  -- statt in einen Fehler zu laufen.
  select * into v_e from velocity.api_ausleihe_starten(1::bigint);
  return next is(v_e.meldung, 'Nicht angemeldet', 'api_ausleihe_starten weist anonyme Aufrufe ab');

  select * into v_e from velocity.api_ausleihe_beenden(1::bigint, null, null, null);
  return next is(v_e.meldung, 'Nicht angemeldet', 'api_ausleihe_beenden weist anonyme Aufrufe ab');
end;
$$;
```

- [ ] **Schritt 2: Test ausführen und Fehlschlag bestätigen**

```bash
python3 db/test.py; echo "Rückgabewert: $?"
```

Erwartet: Fehler `function velocity.fn_ausleihe_beenden(...) does not exist`, Rückgabewert 1.

- [ ] **Schritt 3: Aufbauschritt 0009 schreiben**

`db/aufbau/0009_geschaeftslogik.sql`:

```sql
-- =====================================================================
-- 0009 Geschaeftslogik
--
-- Zweck:      Ausleihe starten und beenden, Preisfindung, Anlegen und
--             Pflegen des Kundensatzes zur Anmeldung.
-- Objekte:    velocity.fn_kunde_aus_auth, velocity.fn_position_anlegen,
--             velocity.fn_ausleihe_starten, velocity.fn_ausleihe_beenden,
--             velocity.api_kunde_sicherstellen,
--             velocity.api_profil_aktualisieren,
--             velocity.api_ausleihe_starten, velocity.api_ausleihe_beenden
-- Ruecknahme: DROP FUNCTION fuer dieselben Namen.
--
-- Schichtung: fn_* traegt die Fachlogik und bekommt die kunde_id als
-- Parameter. api_* ist eine duenne Huelle mit SECURITY DEFINER, die aus
-- auth.uid() die kunde_id aufloest. Nur api_* wird der Anwendung
-- freigegeben.
-- =====================================================================

create or replace function velocity.fn_kunde_aus_auth()
returns bigint
language sql
stable
security definer
set search_path = velocity, pg_temp
as $$
  select k.kunde_id from velocity.kunde k where k.auth_uid = auth.uid();
$$;

-- ---------------------------------------------------------------------
-- Legt eine Entgeltposition an. Das Vorzeichen kommt aus der Entgeltart,
-- der Betrag wird auf zwei Nachkommastellen gerundet.
-- ---------------------------------------------------------------------
create or replace function velocity.fn_position_anlegen(
  p_ausleihe_id      bigint,
  p_code             text,
  p_menge            numeric,
  p_einzelbetrag     numeric,
  p_nutzungspreis_id bigint,
  p_sortierung       integer
)
returns void
language plpgsql
set search_path = velocity, pg_temp
as $$
declare
  v_art velocity.entgeltart%rowtype;
begin
  select * into v_art from velocity.entgeltart where code = p_code;
  if not found then
    raise exception 'Unbekannte Entgeltart %', p_code using errcode = 'P0002';
  end if;

  insert into velocity.entgeltposition
    (ausleihe_id, entgeltart_id, nutzungspreis_id, menge, einzelbetrag, betrag, sortierung)
  values
    (p_ausleihe_id, v_art.entgeltart_id, p_nutzungspreis_id, p_menge, p_einzelbetrag,
     round(p_menge * p_einzelbetrag, 2) * v_art.vorzeichen, p_sortierung);
end;
$$;

-- ---------------------------------------------------------------------
-- Ausleihe starten
-- ---------------------------------------------------------------------
create or replace function velocity.fn_ausleihe_starten(
  p_kunde_id   bigint,
  p_fahrrad_id bigint
)
returns table (ausleihe_id bigint, meldung text)
language plpgsql
set search_path = velocity, pg_temp
as $$
declare
  v_status  velocity.fahrrad_status;
  v_pos     velocity.fahrrad_position%rowtype;
  v_aktive  integer;
  v_mgl     bigint;
  v_neu     bigint;
begin
  select f.status into v_status
    from velocity.fahrrad f where f.fahrrad_id = p_fahrrad_id for update;
  if not found then
    return query select null::bigint, 'Fahrrad nicht gefunden'::text; return;
  end if;
  if v_status <> 'verfuegbar' then
    return query select null::bigint,
      format('Fahrrad nicht verfuegbar (Status: %s)', v_status)::text; return;
  end if;

  -- Geschaeftsregel GR2
  select count(*) into v_aktive
    from velocity.ausleihe a where a.kunde_id = p_kunde_id and a.status = 'aktiv';
  if v_aktive >= 4 then
    return query select null::bigint,
      'Maximale Anzahl aktiver Ausleihen (4) erreicht'::text; return;
  end if;

  select * into v_pos from velocity.fahrrad_position where fahrrad_id = p_fahrrad_id;

  -- Die zum Startzeitpunkt gueltige Mitgliedschaft wird fixiert, damit ein
  -- spaeterer Tarifwechsel die Bepreisung nicht rueckwirkend veraendert.
  select m.mitgliedschaft_id into v_mgl
    from velocity.mitgliedschaft m
   where m.kunde_id = p_kunde_id and m.gueltigkeit @> current_date;

  insert into velocity.ausleihe
    (kunde_id, fahrrad_id, mitgliedschaft_id, start_station_id, start_latitude, start_longitude)
  values
    (p_kunde_id, p_fahrrad_id, v_mgl, v_pos.station_id, v_pos.latitude, v_pos.longitude)
  returning velocity.ausleihe.ausleihe_id into v_neu;

  update velocity.fahrrad set status = 'ausgeliehen' where fahrrad_id = p_fahrrad_id;
  update velocity.fahrrad_position
     set station_id = null, aktualisiert_am = now()
   where fahrrad_id = p_fahrrad_id;

  return query select v_neu, 'Ausleihe gestartet'::text;
end;
$$;

-- ---------------------------------------------------------------------
-- Ausleihe beenden und bepreisen
--
-- Reihenfolge der Positionen:
--   1 Startgebuehr
--   2 Zeitentgelt ueber ALLE gefahrenen Minuten
--   3 Gutschrift der Freiminuten (negativ)
--   4 Tarifrabatt auf die Zwischensumme (negativ)
--   5 Kappung auf den Tageshoechstpreis (negativ)
--
-- Das Zeitentgelt wird bewusst ueber alle Minuten gebildet und die
-- Freiminuten als eigene Gutschrift abgezogen. So ist auf der Rechnung
-- ablesbar, was der Tarifvorteil wert war.
--
-- Der Rabatt wird VOR der Kappung angewandt. Umgekehrt wuerde der
-- Rabatt den bereits gedeckelten Betrag noch einmal senken.
-- ---------------------------------------------------------------------
create or replace function velocity.fn_ausleihe_beenden(
  p_kunde_id       bigint,
  p_ausleihe_id    bigint,
  p_end_station_id bigint  default null,
  p_latitude       numeric default null,
  p_longitude      numeric default null
)
returns table (gesamtbetrag numeric, dauer_minuten integer, meldung text)
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
    return query select null::numeric, null::integer, 'Ausleihe nicht gefunden'::text; return;
  end if;
  if v_a.kunde_id <> p_kunde_id then
    return query select null::numeric, null::integer,
      'Keine Berechtigung fuer diese Ausleihe'::text; return;
  end if;
  if v_a.status <> 'aktiv' then
    return query select null::numeric, null::integer, 'Ausleihe ist nicht aktiv'::text; return;
  end if;

  update velocity.ausleihe a
     set endzeit        = now(),
         end_station_id = p_end_station_id,
         end_latitude   = p_latitude,
         end_longitude  = p_longitude,
         status         = 'abgeschlossen'
   where a.ausleihe_id = p_ausleihe_id
  returning * into v_a;

  v_dauer := v_a.dauer_minuten;

  -- Geschaeftsregel GR5: Preis zum STARTzeitpunkt der Ausleihe
  select t.typ_id into v_typ
    from velocity.fahrrad f
    join velocity.fahrradmodell m on m.modell_id = f.modell_id
    join velocity.fahrradtyp    t on t.typ_id    = m.typ_id
   where f.fahrrad_id = v_a.fahrrad_id;

  select * into v_preis
    from velocity.nutzungspreis np
   where np.typ_id = v_typ and np.gueltigkeit @> v_a.startzeit::date;
  if not found then
    raise exception 'Kein gueltiger Preis fuer Fahrradtyp % am %', v_typ, v_a.startzeit::date
      using errcode = 'P0002';
  end if;

  -- Freiminuten und Rabatt aus der fixierten Mitgliedschaft
  if v_a.mitgliedschaft_id is not null then
    select * into v_periode
      from velocity.freiminuten_periode p
     where p.mitgliedschaft_id = v_a.mitgliedschaft_id
       and p.jahr  = extract(year  from v_a.startzeit)::integer
       and p.monat = extract(month from v_a.startzeit)::integer
     for update;
    if found then
      v_frei := least(v_periode.kontingent_minuten - v_periode.verbraucht_minuten, v_dauer);
    end if;

    select coalesce(k.rabatt_prozent, 0) into v_rabatt
      from velocity.mitgliedschaft m
      join velocity.tarif_kondition k
        on k.tarif_id = m.tarif_id and k.gueltigkeit @> v_a.startzeit::date
     where m.mitgliedschaft_id = v_a.mitgliedschaft_id;
    v_rabatt := coalesce(v_rabatt, 0);
  end if;

  perform velocity.fn_position_anlegen(p_ausleihe_id, 'STARTGEBUEHR',
            1, v_preis.startgebuehr, v_preis.preis_id, 10);
  perform velocity.fn_position_anlegen(p_ausleihe_id, 'ZEITENTGELT',
            v_dauer, v_preis.preis_pro_minute, v_preis.preis_id, 20);

  if v_frei > 0 then
    perform velocity.fn_position_anlegen(p_ausleihe_id, 'FREIMINUTEN',
              v_frei, v_preis.preis_pro_minute, v_preis.preis_id, 30);
    update velocity.freiminuten_periode
       set verbraucht_minuten = verbraucht_minuten + v_frei
     where periode_id = v_periode.periode_id;
  end if;

  select coalesce(sum(betrag), 0) into v_summe
    from velocity.entgeltposition where ausleihe_id = p_ausleihe_id;

  if v_rabatt > 0 and v_summe > 0 then
    v_rabattwert := round(v_summe * v_rabatt / 100, 2);
    perform velocity.fn_position_anlegen(p_ausleihe_id, 'TARIFRABATT',
              1, v_rabattwert, null, 40);
    v_summe := v_summe - v_rabattwert;
  end if;

  if v_summe > v_preis.tageshoechstpreis then
    v_ueberschuss := v_summe - v_preis.tageshoechstpreis;
    perform velocity.fn_position_anlegen(p_ausleihe_id, 'HOECHSTPREIS_KAPPUNG',
              1, v_ueberschuss, v_preis.preis_id, 50);
    v_summe := v_preis.tageshoechstpreis;
  end if;

  update velocity.fahrrad set status = 'verfuegbar' where fahrrad_id = v_a.fahrrad_id;
  update velocity.fahrrad_position
     set station_id      = p_end_station_id,
         latitude        = coalesce(p_latitude,  latitude),
         longitude       = coalesce(p_longitude, longitude),
         aktualisiert_am = now()
   where fahrrad_id = v_a.fahrrad_id;

  return query select v_summe, v_dauer, 'Ausleihe beendet'::text;
end;
$$;

-- ---------------------------------------------------------------------
-- Zugriffsschicht
-- ---------------------------------------------------------------------

-- Legt bei Bedarf den Kundensatz zum angemeldeten Konto an. Wird nach
-- jedem Login aufgerufen und ist bewusst idempotent. Ersetzt den Trigger
-- auf auth.users: das Fremdschema wird nicht angefasst.
create or replace function velocity.api_kunde_sicherstellen()
returns table (kunde_id bigint, kundennummer text, ist_neu boolean)
language plpgsql
security definer
set search_path = velocity, pg_temp
as $$
declare
  v_uid   uuid := auth.uid();
  v_email text;
  v_meta  jsonb;
  v_id    bigint;
  v_neu   boolean := false;
begin
  if v_uid is null then
    raise exception 'Nicht angemeldet' using errcode = '28000';
  end if;

  select k.kunde_id into v_id from velocity.kunde k where k.auth_uid = v_uid;

  if not found then
    select u.email, u.raw_user_meta_data into v_email, v_meta
      from auth.users u where u.id = v_uid;

    -- Existiert bereits ein Kundensatz mit dieser E-Mail (etwa aus der
    -- Datenuebernahme), wird er mit dem Konto verknuepft statt doppelt
    -- angelegt.
    insert into velocity.kunde (auth_uid, email, vorname, nachname)
    values (v_uid, v_email,
            coalesce(nullif(v_meta ->> 'vorname',  ''), 'Unbekannt'),
            coalesce(nullif(v_meta ->> 'nachname', ''), 'Unbekannt'))
    on conflict (email) do update set auth_uid = excluded.auth_uid
    returning velocity.kunde.kunde_id into v_id;

    v_neu := true;
  end if;

  return query
    select v_id, k.kundennummer, v_neu from velocity.kunde k where k.kunde_id = v_id;
end;
$$;

-- Geschaeftsregel GR8 wird hier geprueft und nicht als CHECK, weil eine
-- Bedingung mit current_date nicht immutable waere.
create or replace function velocity.api_profil_aktualisieren(
  p_vorname      text,
  p_nachname     text,
  p_telefon      text default null,
  p_geburtsdatum date default null,
  p_strasse      text default null,
  p_hausnummer   text default null,
  p_plz          text default null,
  p_ort          text default null
)
returns table (meldung text)
language plpgsql
security definer
set search_path = velocity, pg_temp
as $$
declare
  v_kunde   bigint := velocity.fn_kunde_aus_auth();
  v_adresse bigint;
begin
  if v_kunde is null then
    return query select 'Nicht angemeldet'::text; return;
  end if;
  if coalesce(trim(p_vorname), '') = '' or coalesce(trim(p_nachname), '') = '' then
    return query select 'Vor- und Nachname sind Pflichtangaben'::text; return;
  end if;
  if p_geburtsdatum is not null
     and p_geburtsdatum > current_date - interval '16 years' then
    return query select 'Mindestalter 16 Jahre nicht erreicht'::text; return;
  end if;

  if p_strasse is not null and p_plz is not null and p_ort is not null then
    insert into velocity.adresse (strasse, hausnummer, plz, ort)
    values (p_strasse, coalesce(p_hausnummer, ''), p_plz, p_ort)
    on conflict (strasse, hausnummer, plz, ort, land_code) do update
      set geaendert_am = now()
    returning adresse_id into v_adresse;
  end if;

  update velocity.kunde
     set vorname             = p_vorname,
         nachname            = p_nachname,
         telefon             = p_telefon,
         geburtsdatum        = coalesce(p_geburtsdatum, geburtsdatum),
         rechnungsadresse_id = coalesce(v_adresse, rechnungsadresse_id)
   where kunde_id = v_kunde;

  return query select 'Profil gespeichert'::text;
end;
$$;

create or replace function velocity.api_ausleihe_starten(p_fahrrad_id bigint)
returns table (ausleihe_id bigint, meldung text)
language plpgsql
security definer
set search_path = velocity, pg_temp
as $$
declare
  v_kunde bigint := velocity.fn_kunde_aus_auth();
begin
  if v_kunde is null then
    return query select null::bigint, 'Nicht angemeldet'::text; return;
  end if;
  return query select * from velocity.fn_ausleihe_starten(v_kunde, p_fahrrad_id);
end;
$$;

create or replace function velocity.api_ausleihe_beenden(
  p_ausleihe_id    bigint,
  p_end_station_id bigint  default null,
  p_latitude       numeric default null,
  p_longitude      numeric default null
)
returns table (gesamtbetrag numeric, dauer_minuten integer, meldung text)
language plpgsql
security definer
set search_path = velocity, pg_temp
as $$
declare
  v_kunde bigint := velocity.fn_kunde_aus_auth();
begin
  if v_kunde is null then
    return query select null::numeric, null::integer, 'Nicht angemeldet'::text; return;
  end if;
  return query select * from velocity.fn_ausleihe_beenden(
    v_kunde, p_ausleihe_id, p_end_station_id, p_latitude, p_longitude);
end;
$$;
```

- [ ] **Schritt 4: Anwenden und Idempotenz nachweisen**

```bash
python3 db/run.py db/aufbau/0009_geschaeftslogik.sql
python3 db/run.py db/aufbau/0009_geschaeftslogik.sql
```

Erwartet: zweimal `OK`. Meldet der zweite Lauf `cannot change return type of existing function`, muss der Datei ein `drop function if exists` mit exakter Signatur vorangestellt werden — dann beide Läufe wiederholen.

- [ ] **Schritt 5: Tests ausführen und grün sehen**

```bash
python3 db/test.py; echo "Rückgabewert: $?"
```

Erwartet: alle neun Preisfindungstests `ok`, Rückgabewert 0. Die Beträge 6,20 / 3,20 / 0,10 / 4,96 / 5,00 / 4,96 müssen exakt stimmen — Abweichungen deuten auf einen Rundungs- oder Reihenfolgefehler und dürfen nicht durch Anpassen der Erwartung „behoben" werden.

- [ ] **Schritt 6: Commit**

```bash
git add db/aufbau/0009_geschaeftslogik.sql db/tests/t0009_preisfindung.sql
git commit -m "feat: Geschaeftslogik mit nachvollziehbarer Preisfindung"
```

---

### Aufgabe 11: Sichten für die Website

**Dateien:**
- Anlegen: `db/aufbau/0010_sichten.sql`
- Test: `db/tests/t0010_sichten.sql`

**Schnittstellen:**
- Liefert die Sichten, die Aufgabe 15 im Frontend anspricht:
  - öffentlich: `v_station`, `v_verfuegbares_fahrrad`, `v_tarifkarte`, `v_tarif`, `v_faq`, `v_nutzungsschritt`, `v_kennzahl`
  - persönlich: `v_meine_ausleihe`, `v_meine_rechnung`, `v_mein_profil`

**Abweichung von der Spec, bewusst und begründet:** Die Spec sieht für alle persönlichen Sichten `security_invoker = true` vor. Für `v_mein_profil` gilt das hier **nicht**: diese Sicht verknüpft `velocity.adresse`, und eine Leserechtigung auf `adresse` für `authenticated` würde die Anschriften **aller** Kunden öffnen. `v_mein_profil` ist deshalb eine Sicht mit Definer-Rechten und einem ausdrücklichen Filter auf `auth.uid()`. `v_meine_ausleihe` und `v_meine_rechnung` bleiben bei `security_invoker = true`, weil sie nur Tabellen verknüpfen, die ohnehin öffentlich lesbar sind. Abschnitt 8 der Spec ist entsprechend nachzuziehen.

- [ ] **Schritt 1: Fehlschlagenden Test schreiben**

`db/tests/t0010_sichten.sql`:

```sql
-- =====================================================================
-- t0010 Sichten
-- =====================================================================
create schema if not exists velocity_test;
set search_path = velocity_test, velocity, extensions, public;

create or replace function velocity_test.test_v_vorhanden()
returns setof text language plpgsql as $$
begin
  return next has_view('velocity'::name, 'v_station'::name,            'Sicht v_station existiert');
  return next has_view('velocity'::name, 'v_verfuegbares_fahrrad'::name,'Sicht v_verfuegbares_fahrrad existiert');
  return next has_view('velocity'::name, 'v_tarifkarte'::name,         'Sicht v_tarifkarte existiert');
  return next has_view('velocity'::name, 'v_tarif'::name,              'Sicht v_tarif existiert');
  return next has_view('velocity'::name, 'v_faq'::name,                'Sicht v_faq existiert');
  return next has_view('velocity'::name, 'v_nutzungsschritt'::name,    'Sicht v_nutzungsschritt existiert');
  return next has_view('velocity'::name, 'v_kennzahl'::name,           'Sicht v_kennzahl existiert');
  return next has_view('velocity'::name, 'v_meine_ausleihe'::name,     'Sicht v_meine_ausleihe existiert');
  return next has_view('velocity'::name, 'v_meine_rechnung'::name,     'Sicht v_meine_rechnung existiert');
  return next has_view('velocity'::name, 'v_mein_profil'::name,        'Sicht v_mein_profil existiert');
end;
$$;

create or replace function velocity_test.test_v_kein_personenbezug()
returns setof text language plpgsql as $$
declare
  v_spalten text;
begin
  -- Keine oeffentliche Sicht darf personenbezogene Spalten fuehren.
  select string_agg(format('%s.%s', table_name, column_name), ', ')
    into v_spalten
    from information_schema.columns
   where table_schema = 'velocity'
     and table_name in ('v_station','v_verfuegbares_fahrrad','v_tarifkarte',
                        'v_tarif','v_faq','v_nutzungsschritt','v_kennzahl')
     and column_name in ('email','vorname','nachname','geburtsdatum','telefon',
                         'auth_uid','kunde_id','kundennummer','referenz_token');

  return next is(v_spalten, null,
    coalesce('Oeffentliche Sichten enthalten keinen Personenbezug (gefunden: '
             || v_spalten || ')', 'Oeffentliche Sichten enthalten keinen Personenbezug'));
end;
$$;

create or replace function velocity_test.test_v_tarifkarte_rechnet()
returns setof text language plpgsql as $$
begin
  return next is(
    (select preis_30_minuten from velocity.v_tarifkarte where typ_code = 'CITY'),
    3.10::numeric, 'City-Bike kostet 0,10 + 30 x 0,10 = 3,10 EUR fuer 30 Minuten');
  return next is(
    (select array_length(merkmale, 1) from velocity.v_tarifkarte where typ_code = 'EBIKE'),
    3, 'E-Bike bringt drei Merkmale fuer die Tarifkarte mit');
end;
$$;

create or replace function velocity_test.test_v_kennzahl_berechnet()
returns setof text language plpgsql as $$
begin
  return next is(
    (select wert from velocity.v_kennzahl where schluessel = 'oekostrom'),
    '100%', 'Feste Kennzahl kommt aus anzeigewert');
  return next is(
    (select wert from velocity.v_kennzahl where schluessel = 'stationen'),
    (select count(*)::text from velocity.station where betriebszeitraum @> current_date),
    'Berechnete Kennzahl zaehlt die aktiven Stationen');
end;
$$;
```

- [ ] **Schritt 2: Test ausführen und Fehlschlag bestätigen**

```bash
python3 db/test.py; echo "Rückgabewert: $?"
```

Erwartet: `not ok` für `test_v_vorhanden`, Rückgabewert 1.

- [ ] **Schritt 3: Aufbauschritt 0010 schreiben**

`db/aufbau/0010_sichten.sql`:

```sql
-- =====================================================================
-- 0010 Sichten
--
-- Zweck:      Der Vertrag zwischen Datenbank und Website. Die Anwendung
--             greift nie auf Basistabellen zu, sondern nur auf diese
--             Sichten und auf die api_-Funktionen.
-- Objekte:    velocity.v_station, v_verfuegbares_fahrrad, v_tarifkarte,
--             v_tarif, v_faq, v_nutzungsschritt, v_kennzahl,
--             v_meine_ausleihe, v_meine_rechnung, v_mein_profil
-- Ruecknahme: DROP VIEW fuer dieselben Namen.
--
-- Oeffentliche Sichten laufen mit den Rechten ihres Eigentuemers
-- (Standard) und enthalten deshalb ausschliesslich Daten ohne
-- Personenbezug. Persoenliche Sichten begrenzen die Zeilen entweder
-- ueber security_invoker plus RLS oder ueber einen ausdruecklichen
-- Filter auf auth.uid().
-- =====================================================================

-- ---------- oeffentlich ----------------------------------------------

create or replace view velocity.v_station as
select s.station_id,
       s.stationsnummer,
       s.name,
       a.strasse, a.hausnummer, a.plz, a.ort,
       s.latitude, s.longitude,
       s.kapazitaet,
       count(*) filter (where f.status = 'verfuegbar')            as verfuegbare_raeder,
       greatest(s.kapazitaet - count(p.fahrrad_id), 0)::integer   as freie_stellplaetze
  from velocity.station s
  join velocity.adresse a          on a.adresse_id = s.adresse_id
  left join velocity.fahrrad_position p on p.station_id = s.station_id
  left join velocity.fahrrad f     on f.fahrrad_id  = p.fahrrad_id
 where s.betriebszeitraum @> current_date
 group by s.station_id, s.stationsnummer, s.name,
          a.strasse, a.hausnummer, a.plz, a.ort,
          s.latitude, s.longitude, s.kapazitaet;

create or replace view velocity.v_verfuegbares_fahrrad as
select f.fahrrad_id,
       f.rahmennummer,
       t.typ_id, t.typ_code,
       t.bezeichnung as typ_bezeichnung,
       t.hat_elektro,
       p.akkustand_prozent,
       coalesce(p.latitude,  s.latitude)  as latitude,
       coalesce(p.longitude, s.longitude) as longitude,
       s.station_id,
       s.name as station_name,
       np.startgebuehr, np.preis_pro_minute, np.tageshoechstpreis
  from velocity.fahrrad f
  join velocity.fahrradmodell m on m.modell_id = f.modell_id
  join velocity.fahrradtyp    t on t.typ_id    = m.typ_id
  left join velocity.fahrrad_position p on p.fahrrad_id  = f.fahrrad_id
  left join velocity.station          s on s.station_id  = p.station_id
  left join velocity.nutzungspreis   np on np.typ_id     = t.typ_id
                                       and np.gueltigkeit @> current_date
 where f.status = 'verfuegbar';

create or replace view velocity.v_tarifkarte as
select t.typ_id, t.typ_code, t.bezeichnung, t.beschreibung, t.hat_elektro,
       np.startgebuehr, np.preis_pro_minute, np.tageshoechstpreis,
       round(np.startgebuehr + np.preis_pro_minute * 30, 2) as preis_30_minuten,
       coalesce(
         (select array_agg(m.merkmal order by m.sortierung)
            from velocity.fahrradtyp_merkmal m where m.typ_id = t.typ_id),
         array[]::text[]
       ) as merkmale
  from velocity.fahrradtyp t
  left join velocity.nutzungspreis np on np.typ_id = t.typ_id
                                     and np.gueltigkeit @> current_date;

create or replace view velocity.v_tarif as
select t.tarif_id, t.tarif_code, t.bezeichnung, t.art::text as art, t.voraussetzung,
       k.monatspreis, k.freiminuten_pro_monat, k.rabatt_prozent
  from velocity.tarif t
  left join velocity.tarif_kondition k on k.tarif_id = t.tarif_id
                                      and k.gueltigkeit @> current_date;

create or replace view velocity.v_faq as
select faq_id, frage, antwort, sortierung
  from velocity.faq_eintrag where aktiv;

create or replace view velocity.v_nutzungsschritt as
select schritt_id, nummer, titel, beschreibung, icon_code
  from velocity.nutzungsschritt;

create or replace view velocity.v_kennzahl as
select k.schluessel,
       k.label,
       k.sortierung,
       case
         when not k.ist_berechnet then k.anzeigewert
         when k.schluessel = 'stationen' then
           (select count(*)::text from velocity.station
             where betriebszeitraum @> current_date)
         else null
       end as wert
  from velocity.kennzahl k;

-- ---------- persoenlich ----------------------------------------------

-- security_invoker: die Zeilenbegrenzung uebernehmen die RLS-Regeln aus
-- Schritt 0011. Verknuepft werden nur Tabellen, die ohnehin oeffentlich
-- lesbar sind.
create or replace view velocity.v_meine_ausleihe
  with (security_invoker = true) as
select a.ausleihe_id,
       a.startzeit, a.endzeit, a.status::text as status, a.dauer_minuten,
       f.rahmennummer,
       t.bezeichnung as typ_bezeichnung,
       ss.name as start_station,
       es.name as end_station,
       coalesce((select sum(ep.betrag) from velocity.entgeltposition ep
                  where ep.ausleihe_id = a.ausleihe_id), 0)::numeric(10,2) as gesamtbetrag
  from velocity.ausleihe a
  join velocity.fahrrad       f on f.fahrrad_id = a.fahrrad_id
  join velocity.fahrradmodell m on m.modell_id  = f.modell_id
  join velocity.fahrradtyp    t on t.typ_id     = m.typ_id
  left join velocity.station ss on ss.station_id = a.start_station_id
  left join velocity.station es on es.station_id = a.end_station_id;

create or replace view velocity.v_meine_rechnung
  with (security_invoker = true) as
select r.rechnung_id, r.rechnungsnummer, r.periode_jahr, r.periode_monat,
       r.erstellt_am_beleg, r.betrag_netto, r.ust_betrag, r.betrag_brutto,
       r.status::text as status
  from velocity.rechnung r;

-- Bewusst MIT Definer-Rechten und ausdruecklichem Filter: diese Sicht
-- verknuepft adresse. Ein Leserecht auf adresse fuer authenticated
-- wuerde die Anschriften aller Kunden oeffnen.
create or replace view velocity.v_mein_profil as
select k.kunde_id, k.kundennummer, k.email, k.vorname, k.nachname,
       k.telefon, k.geburtsdatum, k.status::text as status, k.registriert_am,
       a.strasse, a.hausnummer, a.plz, a.ort
  from velocity.kunde k
  left join velocity.adresse a on a.adresse_id = k.rechnungsadresse_id
 where k.auth_uid = auth.uid();
```

- [ ] **Schritt 4: Anwenden, Idempotenz nachweisen, Tests grün sehen**

```bash
python3 db/run.py db/aufbau/0010_sichten.sql
python3 db/run.py db/aufbau/0010_sichten.sql
python3 db/test.py; echo "Rückgabewert: $?"
```

Erwartet: zweimal `OK`, alle Zusicherungen `ok`. Meldet der zweite Lauf `cannot change name of view column`, die betroffene Sicht in der Datei mit `drop view if exists … cascade;` vorab entfernen.

- [ ] **Schritt 5: Commit**

```bash
git add db/aufbau/0010_sichten.sql db/tests/t0010_sichten.sql
git commit -m "feat: Sichten als Vertrag zwischen Datenbank und Website"
```

---

### Aufgabe 12: Zugriffsschutz

Behebt Befund B1 der Spec. Am Ende dieser Aufgabe muss der öffentlich ausgelieferte anon-Key nachweislich an keine personenbezogenen Daten kommen.

**Dateien:**
- Anlegen: `db/aufbau/0011_sicherheit.sql`
- Anlegen: `tools/rest_security_check.py`
- Test: `db/tests/t0011_sicherheit.sql`

**Schnittstellen:**
- Liefert: RLS auf allen Basistabellen des Schemas, Policies für `authenticated` auf den neun Tabellen mit eigenem Bezug sowie Leserechte auf die vier personenfreien Stammdatentabellen; Grants ausschließlich auf Sichten und `api_*`-Funktionen. `tools/rest_security_check.py` gibt bei bestandener Prüfung 0 zurück.

- [ ] **Schritt 1: Fehlschlagenden Test schreiben**

`db/tests/t0011_sicherheit.sql`:

```sql
-- =====================================================================
-- t0011 Zugriffsschutz
-- =====================================================================
create schema if not exists velocity_test;
set search_path = velocity_test, velocity, extensions, public;

create or replace function velocity_test.test_s_rls_ueberall_aktiv()
returns setof text language plpgsql as $$
declare
  v_offen text;
begin
  select string_agg(c.relname, ', ' order by c.relname) into v_offen
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'velocity' and c.relkind = 'r' and not c.relrowsecurity;

  return next is(v_offen, null,
    coalesce('Alle Basistabellen haben RLS aktiv (offen: ' || v_offen || ')',
             'Alle Basistabellen haben RLS aktiv'));
end;
$$;

create or replace function velocity_test.test_s_anon_hat_keine_tabellenrechte()
returns setof text language plpgsql as $$
declare
  v_tabellen text;
begin
  -- authenticated darf einige Tabellen lesen, per RLS auf die eigenen Zeilen
  -- begrenzt. anon dagegen darf gar keine Basistabelle erreichen - nur die
  -- oeffentlichen Sichten. Genau das wird hier geprueft.
  select string_agg(format('%s:%s', g.table_name, g.privilege_type), ', '
                    order by g.table_name, g.privilege_type)
    into v_tabellen
    from information_schema.role_table_grants g
    join pg_class c     on c.relname = g.table_name
    join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'velocity'
   where g.table_schema = 'velocity'
     and g.grantee = 'anon'
     and c.relkind = 'r';

  return next is(v_tabellen, null,
    coalesce('anon hat keinerlei Rechte auf Basistabellen (gefunden: ' || v_tabellen || ')',
             'anon hat keinerlei Rechte auf Basistabellen'));
end;
$$;

create or replace function velocity_test.test_s_anon_kommt_nicht_an_kunden()
returns setof text language plpgsql as $$
declare
  v_anzahl integer;
begin
  set local role anon;
  begin
    execute 'select count(*) from velocity.kunde' into v_anzahl;
    reset role;
    return next fail('anon konnte velocity.kunde lesen - Zugriffsschutz ist wirkungslos');
  exception when insufficient_privilege then
    reset role;
    return next pass('anon erhaelt auf velocity.kunde keine Berechtigung');
  end;
end;
$$;

create or replace function velocity_test.test_s_anon_darf_oeffentliche_sichten()
returns setof text language plpgsql as $$
declare
  v_anzahl integer;
begin
  set local role anon;
  execute 'select count(*) from velocity.v_tarifkarte' into v_anzahl;
  execute 'select count(*) from velocity.v_faq'        into v_anzahl;
  reset role;
  return next pass('anon darf die oeffentlichen Sichten lesen');
exception when others then
  reset role;
  return next fail('anon kann die oeffentlichen Sichten nicht lesen: ' || sqlerrm);
end;
$$;

create or replace function velocity_test.test_s_api_rechte()
returns setof text language plpgsql as $$
begin
  return next ok(
    has_function_privilege('authenticated',
      'velocity.api_ausleihe_starten(bigint)', 'execute'),
    'authenticated darf api_ausleihe_starten aufrufen');
  return next ok(
    not has_function_privilege('anon',
      'velocity.api_ausleihe_starten(bigint)', 'execute'),
    'anon darf api_ausleihe_starten nicht aufrufen');
  return next ok(
    not has_function_privilege('anon',
      'velocity.fn_ausleihe_beenden(bigint,bigint,bigint,numeric,numeric)', 'execute'),
    'Die Fachlogik ist von aussen nicht aufrufbar');
end;
$$;
```

- [ ] **Schritt 2: Test ausführen und Fehlschlag bestätigen**

```bash
python3 db/test.py; echo "Rückgabewert: $?"
```

Erwartet: mindestens `test_s_rls_ueberall_aktiv` und `test_s_api_rechte` schlagen fehl, Rückgabewert 1.

- [ ] **Schritt 3: Aufbauschritt 0011 schreiben**

`db/aufbau/0011_sicherheit.sql`:

```sql
-- =====================================================================
-- 0011 Zugriffsschutz
--
-- Zweck:      Grundhaltung "default deny". Die Rolle anon erreicht nur
--             die oeffentlichen Sichten, authenticated zusaetzlich die
--             eigenen Zeilen und die api_-Funktionen. Basistabellen mit
--             Personenbezug sind von aussen unerreichbar.
-- Objekte:    RLS und Policies auf allen Basistabellen, Grants
-- Ruecknahme: DROP POLICY je Policy; ALTER TABLE ... DISABLE ROW LEVEL
--             SECURITY; REVOKE der Grants.
-- =====================================================================

grant usage on schema velocity to anon, authenticated;

-- Erst alles zurueckziehen, dann gezielt vergeben. Damit ist der Endstand
-- unabhaengig davon, was vorher galt.
revoke all on all tables    in schema velocity from anon, authenticated;
revoke all on all functions in schema velocity from anon, authenticated;
revoke all on all sequences in schema velocity from anon, authenticated;

-- ---------------------------------------------------------------------
-- RLS auf jeder Basistabelle einschalten
-- ---------------------------------------------------------------------
do $$
declare
  v_t record;
begin
  for v_t in
    select c.relname
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'velocity' and c.relkind = 'r'
  loop
    execute format('alter table velocity.%I enable row level security', v_t.relname);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Personenfreie Stammdaten: authenticated darf lesen, weil die
-- persoenlichen Sichten sie mit den Rechten des Aufrufers verknuepfen.
-- Diese Tabellen sind ueber v_station und v_verfuegbares_fahrrad ohnehin
-- oeffentlich sichtbar; es entsteht also kein zusaetzlicher Einblick.
-- ---------------------------------------------------------------------
do $$
declare
  v_t text;
begin
  foreach v_t in array array['station','fahrrad','fahrradmodell','fahrradtyp'] loop
    execute format('drop policy if exists %I on velocity.%I', v_t || '_lesen_auth', v_t);
    execute format(
      'create policy %I on velocity.%I for select to authenticated using (true)',
      v_t || '_lesen_auth', v_t);
    execute format('grant select on velocity.%I to authenticated', v_t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Eigene Zeilen: nur lesend, immer ueber auth.uid() eingegrenzt.
-- Geschrieben wird ausschliesslich ueber die api_-Funktionen.
-- ---------------------------------------------------------------------
drop policy if exists kunde_eigene on velocity.kunde;
create policy kunde_eigene on velocity.kunde
  for select to authenticated using (auth_uid = auth.uid());
grant select on velocity.kunde to authenticated;

drop policy if exists ausleihe_eigene on velocity.ausleihe;
create policy ausleihe_eigene on velocity.ausleihe
  for select to authenticated using (
    exists (select 1 from velocity.kunde k
             where k.kunde_id = ausleihe.kunde_id and k.auth_uid = auth.uid()));
grant select on velocity.ausleihe to authenticated;

drop policy if exists entgeltposition_eigene on velocity.entgeltposition;
create policy entgeltposition_eigene on velocity.entgeltposition
  for select to authenticated using (
    exists (select 1 from velocity.ausleihe a
              join velocity.kunde k on k.kunde_id = a.kunde_id
             where a.ausleihe_id = entgeltposition.ausleihe_id
               and k.auth_uid = auth.uid()));
grant select on velocity.entgeltposition to authenticated;

drop policy if exists mitgliedschaft_eigene on velocity.mitgliedschaft;
create policy mitgliedschaft_eigene on velocity.mitgliedschaft
  for select to authenticated using (
    exists (select 1 from velocity.kunde k
             where k.kunde_id = mitgliedschaft.kunde_id and k.auth_uid = auth.uid()));
grant select on velocity.mitgliedschaft to authenticated;

drop policy if exists freiminuten_periode_eigene on velocity.freiminuten_periode;
create policy freiminuten_periode_eigene on velocity.freiminuten_periode
  for select to authenticated using (
    exists (select 1 from velocity.mitgliedschaft m
              join velocity.kunde k on k.kunde_id = m.kunde_id
             where m.mitgliedschaft_id = freiminuten_periode.mitgliedschaft_id
               and k.auth_uid = auth.uid()));
grant select on velocity.freiminuten_periode to authenticated;

drop policy if exists rechnung_eigene on velocity.rechnung;
create policy rechnung_eigene on velocity.rechnung
  for select to authenticated using (
    exists (select 1 from velocity.kunde k
             where k.kunde_id = rechnung.kunde_id and k.auth_uid = auth.uid()));
grant select on velocity.rechnung to authenticated;

drop policy if exists rechnungsposition_eigene on velocity.rechnungsposition;
create policy rechnungsposition_eigene on velocity.rechnungsposition
  for select to authenticated using (
    exists (select 1 from velocity.rechnung r
              join velocity.kunde k on k.kunde_id = r.kunde_id
             where r.rechnung_id = rechnungsposition.rechnung_id
               and k.auth_uid = auth.uid()));
grant select on velocity.rechnungsposition to authenticated;

drop policy if exists zahlung_eigene on velocity.zahlung;
create policy zahlung_eigene on velocity.zahlung
  for select to authenticated using (
    exists (select 1 from velocity.rechnung r
              join velocity.kunde k on k.kunde_id = r.kunde_id
             where r.rechnung_id = zahlung.rechnung_id
               and k.auth_uid = auth.uid()));
grant select on velocity.zahlung to authenticated;

drop policy if exists zahlungsmittel_eigene on velocity.zahlungsmittel;
create policy zahlungsmittel_eigene on velocity.zahlungsmittel
  for select to authenticated using (
    exists (select 1 from velocity.kunde k
             where k.kunde_id = zahlungsmittel.kunde_id and k.auth_uid = auth.uid()));
grant select on velocity.zahlungsmittel to authenticated;

-- velocity.adresse bekommt bewusst KEINE Policy und KEIN Leserecht:
-- Anschriften sind ueber v_mein_profil erreichbar, das mit
-- Definer-Rechten laeuft und auf auth.uid() filtert.

-- ---------------------------------------------------------------------
-- Sichten
-- ---------------------------------------------------------------------
grant select on velocity.v_station,
                velocity.v_verfuegbares_fahrrad,
                velocity.v_tarifkarte,
                velocity.v_tarif,
                velocity.v_faq,
                velocity.v_nutzungsschritt,
                velocity.v_kennzahl
  to anon, authenticated;

grant select on velocity.v_meine_ausleihe,
                velocity.v_meine_rechnung,
                velocity.v_mein_profil
  to authenticated;

-- ---------------------------------------------------------------------
-- Funktionen: nur die api_-Schicht, nur fuer angemeldete Nutzer.
-- Die fn_-Fachlogik bleibt von aussen unerreichbar.
-- ---------------------------------------------------------------------
grant execute on function velocity.api_kunde_sicherstellen()                          to authenticated;
grant execute on function velocity.api_profil_aktualisieren(text,text,text,date,text,text,text,text) to authenticated;
grant execute on function velocity.api_ausleihe_starten(bigint)                       to authenticated;
grant execute on function velocity.api_ausleihe_beenden(bigint,bigint,numeric,numeric) to authenticated;
```

- [ ] **Schritt 4: Anwenden, Idempotenz nachweisen, Tests grün sehen**

```bash
python3 db/run.py db/aufbau/0011_sicherheit.sql
python3 db/run.py db/aufbau/0011_sicherheit.sql
python3 db/test.py; echo "Rückgabewert: $?"
```

Erwartet: zweimal `OK`, alle Zusicherungen `ok`.

Schlägt `test_s_anon_kommt_nicht_an_kunden` mit einem anderen Fehler als `insufficient_privilege` fehl, den tatsächlichen Fehler ansehen: eine leere Ergebnismenge statt einer Ablehnung wäre ebenfalls sicher, aber der Test muss dann entsprechend formuliert werden — nicht einfach gestrichen.

- [ ] **Schritt 5: Externe Prüfung über die REST-Schnittstelle schreiben**

Der Test oben prüft die Datenbank von innen. Diese Prüfung geht den Weg, den auch ein Angreifer ginge: über PostgREST mit dem öffentlich ausgelieferten anon-Key.

`tools/rest_security_check.py`:

```python
#!/usr/bin/env python3
"""Prueft ueber die REST-Schnittstelle, dass der anon-Key an keine
personenbezogenen Daten kommt.

Aufruf:
    python3 tools/rest_security_check.py

Liest SUPABASE_URL und SUPABASE_ANON_KEY aus .env. Rueckgabewert 0, wenn
alle Erwartungen erfuellt sind, sonst 1.
"""
from __future__ import annotations

import json
import pathlib
import sys
import urllib.error
import urllib.request

WURZEL = pathlib.Path(__file__).resolve().parent.parent
SCHEMA = "velocity"

# Ressourcen, die anon NICHT erreichen darf.
GESPERRT = [
    "kunde", "adresse", "zahlungsmittel", "rechnung", "rechnungsposition",
    "zahlung", "mitgliedschaft", "freiminuten_periode", "ausleihe",
    "entgeltposition", "v_meine_ausleihe", "v_meine_rechnung", "v_mein_profil",
]

# Ressourcen, die anon erreichen MUSS, damit die Website funktioniert.
ERLAUBT = [
    "v_station", "v_verfuegbares_fahrrad", "v_tarifkarte", "v_tarif",
    "v_faq", "v_nutzungsschritt", "v_kennzahl",
]


def lies_env() -> tuple[str, str]:
    werte: dict[str, str] = {}
    pfad = WURZEL / ".env"
    if pfad.exists():
        for zeile in pfad.read_text(encoding="utf-8").splitlines():
            zeile = zeile.strip()
            if zeile and not zeile.startswith("#") and "=" in zeile:
                k, v = zeile.split("=", 1)
                werte[k.strip()] = v.strip()
    fehlend = [k for k in ("SUPABASE_URL", "SUPABASE_ANON_KEY") if k not in werte]
    if fehlend:
        sys.exit("Fehlend in .env: " + ", ".join(fehlend))
    return werte["SUPABASE_URL"].rstrip("/"), werte["SUPABASE_ANON_KEY"]


def hole(basis: str, key: str, ressource: str) -> tuple[int, str]:
    anfrage = urllib.request.Request(
        f"{basis}/rest/v1/{ressource}?select=*&limit=1",
        headers={"apikey": key, "Accept-Profile": SCHEMA},
    )
    try:
        with urllib.request.urlopen(anfrage, timeout=20) as antwort:
            return antwort.status, antwort.read(400).decode("utf-8", "replace")
    except urllib.error.HTTPError as fehler:
        return fehler.code, fehler.read(400).decode("utf-8", "replace")


def main() -> int:
    basis, key = lies_env()
    fehler = 0

    for ressource in GESPERRT:
        status, koerper = hole(basis, key, ressource)
        if status == 200 and json.loads(koerper or "[]"):
            print(f"FEHLER  {ressource}: anon erhaelt Daten (HTTP 200)")
            fehler += 1
        else:
            print(f"ok      {ressource}: kein Zugriff (HTTP {status})")

    for ressource in ERLAUBT:
        status, koerper = hole(basis, key, ressource)
        if status != 200:
            print(f"FEHLER  {ressource}: sollte oeffentlich sein, HTTP {status} - {koerper[:120]}")
            fehler += 1
        else:
            print(f"ok      {ressource}: oeffentlich erreichbar")

    print(f"\n{fehler} Abweichung(en).")
    return 1 if fehler else 0


if __name__ == "__main__":
    raise SystemExit(main())
```

In `.env` und `.env.example` ergänzen:

```
SUPABASE_URL=https://supabase.butscher.cloud
SUPABASE_ANON_KEY=<anon-Key aus src/config.js>
```

- [ ] **Schritt 6: Externe Prüfung ausführen**

```bash
python3 tools/rest_security_check.py; echo "Rückgabewert: $?"
```

Erwartet: für alle Einträge aus `GESPERRT` eine Zeile `ok … kein Zugriff`, für alle aus `ERLAUBT` eine Zeile `ok … oeffentlich erreichbar`, `0 Abweichung(en).`, Rückgabewert 0.

Meldet eine öffentliche Sicht `HTTP 404` mit `Could not find the table`, muss der PostgREST-Schemacache neu geladen werden:

```bash
python3 -c "
import sys, pathlib; sys.path.insert(0, 'db')
from run import verbinde
c = verbinde(); c.cursor().execute(\"notify pgrst, 'reload schema'\"); c.commit(); print('Schemacache neu geladen')
"
```

Das Schema `velocity` muss außerdem in der PostgREST-Konfiguration freigegeben sein. Aktuell steht dort `pgrst.db_schemas = public, cityBikesRental, WorldHappiness, Rainforest, superstore, apl, qs`. Ergänzen:

```bash
python3 -c "
import sys, pathlib; sys.path.insert(0, 'db')
from run import verbinde
c = verbinde(); cur = c.cursor()
cur.execute(\"alter role authenticator set pgrst.db_schemas = 'public, velocity, cityBikesRental, WorldHappiness, Rainforest, superstore, apl, qs'\")
cur.execute(\"notify pgrst, 'reload config'\")
c.commit(); print('velocity fuer PostgREST freigegeben')
"
```

Danach Schritt 6 wiederholen.

- [ ] **Schritt 7: Commit**

```bash
git add db/aufbau/0011_sicherheit.sql db/tests/t0011_sicherheit.sql tools/rest_security_check.py .env.example
git commit -m "feat: Zugriffsschutz mit default deny und externer REST-Pruefung"
```

---

### Aufgabe 13: Data Dictionary aus dem Systemkatalog

**Dateien:**
- Anlegen: `db/aufbau/0012_dokumentation.sql`
- Test: `db/tests/t0012_dokumentation.sql`

**Schnittstellen:**
- Liefert: `COMMENT ON` für jede Tabelle, jede Spalte und jede Funktion des Schemas sowie die Sicht `velocity.v_data_dictionary(objekt_art, tabelle, spalte, datentyp, nullbar, vorgabe, beschreibung)`. Aufgabe 18 erzeugt daraus `doku/datenmodell/06-data-dictionary.md`.

**Umfang der Kommentare.** Die 25 Tabellenkommentare stehen unten vollständig. Die Spaltenkommentare sind **nicht** einzeln ausgeschrieben — es sind rund 250 — sondern durch den Test `test_doku_vollstaendig` erzwungen: er schlägt fehl, solange auch nur eine Spalte ohne Kommentar ist. Das ist kein offener Punkt, sondern eine maschinell geprüfte Vollständigkeitsbedingung. Zwei Tabellen sind unten als Muster vollständig ausformuliert.

**Regel für Spaltenkommentare:** Schreibe, was fachlich gilt, nicht was der Spaltenname schon sagt. `'Nachname des Kunden'` ist wertlos. `'NULL, solange das Rad frei abgestellt ist'` ist die Information, die jemand braucht.

- [ ] **Schritt 1: Fehlschlagenden Test schreiben**

`db/tests/t0012_dokumentation.sql`:

```sql
-- =====================================================================
-- t0012 Data Dictionary
-- =====================================================================
create schema if not exists velocity_test;
set search_path = velocity_test, velocity, extensions, public;

create or replace function velocity_test.test_doku_vollstaendig()
returns setof text language plpgsql as $$
declare
  v_tabellen text;
  v_spalten  text;
begin
  select string_agg(c.relname, ', ' order by c.relname) into v_tabellen
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'velocity' and c.relkind in ('r','v')
     and obj_description(c.oid, 'pg_class') is null;

  return next is(v_tabellen, null,
    coalesce('Jede Tabelle und Sicht ist kommentiert (ohne: ' || v_tabellen || ')',
             'Jede Tabelle und Sicht ist kommentiert'));

  select string_agg(format('%s.%s', c.relname, a.attname), ', '
                    order by c.relname, a.attnum) into v_spalten
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    join pg_attribute a on a.attrelid = c.oid
   where n.nspname = 'velocity' and c.relkind in ('r','v')
     and a.attnum > 0 and not a.attisdropped
     and a.attname not in ('erstellt_am','geaendert_am')
     and col_description(c.oid, a.attnum) is null;

  return next is(v_spalten, null,
    coalesce('Jede Fachspalte ist kommentiert (ohne: ' || left(v_spalten, 600) || ')',
             'Jede Fachspalte ist kommentiert'));
end;
$$;

create or replace function velocity_test.test_doku_dictionary_sicht()
returns setof text language plpgsql as $$
begin
  return next has_view('velocity'::name, 'v_data_dictionary'::name,
                       'Sicht v_data_dictionary existiert');
  return next ok((select count(*) from velocity.v_data_dictionary) > 200,
                 'Das Dictionary listet alle Spalten des Schemas');
  return next is(
    (select beschreibung from velocity.v_data_dictionary
      where tabelle = 'fahrrad_position' and spalte = 'station_id'),
    'NULL bedeutet: das Rad steht frei abgestellt, nicht an einer Station',
    'Der Kommentar erklaert die Bedeutung von NULL');
end;
$$;
```

- [ ] **Schritt 2: Test ausführen und Fehlschlag bestätigen**

```bash
python3 db/test.py; echo "Rückgabewert: $?"
```

Erwartet: `not ok` mit einer langen Liste unkommentierter Objekte, Rückgabewert 1.

- [ ] **Schritt 3: Aufbauschritt 0012 schreiben**

`db/aufbau/0012_dokumentation.sql` — Kopf, alle Tabellenkommentare, zwei Mustertabellen vollständig, Dictionary-Sicht:

```sql
-- =====================================================================
-- 0012 Dokumentation
--
-- Zweck:      Beschreibt jedes Objekt des Schemas im Systemkatalog.
--             Das Data Dictionary wird daraus erzeugt statt getippt und
--             kann deshalb nicht veralten.
-- Objekte:    COMMENT ON fuer alle Tabellen, Spalten und Funktionen;
--             Sicht velocity.v_data_dictionary
-- Ruecknahme: COMMENT ON ... IS NULL; DROP VIEW v_data_dictionary;
-- =====================================================================

comment on schema velocity is
  'Datenhaltung der Bike-Sharing-Anwendung VeloCity (Fallstudie Datenmodellierung)';

-- ---------- Tabellenkommentare ---------------------------------------
comment on table velocity.adresse is
  'Postanschrift. Eigenstaendige Entitaet, weil sie von Kunde, Station, Lieferant und Lager gebraucht wird.';
comment on table velocity.kunde is
  'Geschaeftspartner auf der Nachfrageseite. Die Anmeldung liegt bei Supabase Auth, hier steht kein Passwort.';
comment on table velocity.station is
  'Fester Standort mit Stellplaetzen, an dem Raeder entliehen und abgestellt werden.';
comment on table velocity.fahrradtyp is
  'Fachliche Klasse eines Rades (City, E-Bike, Cargo). Traegt bewusst keine Preise - die stehen zeitabhaengig in nutzungspreis.';
comment on table velocity.fahrradtyp_merkmal is
  'Werbliche Einzelmerkmale eines Fahrradtyps fuer die Tarifkarte der Website.';
comment on table velocity.hersteller is
  'Produzent eines Fahrradmodells.';
comment on table velocity.fahrradmodell is
  'Bauart eines Rades. Bindeglied zur Warenwirtschaft: Ersatzteile haengen am Modell, nicht am Einzelrad.';
comment on table velocity.fahrrad is
  'Einzelnes physisches Fahrzeug der Flotte, eindeutig ueber die Rahmennummer.';
comment on table velocity.fahrrad_position is
  'Aktueller Standort eines Rades. Als 1:1-Satellit gefuehrt, damit die staendig aenderlichen Bewegungsdaten die Stammdaten nicht beruehren.';
comment on table velocity.tarif is
  'Preismodell, in das sich ein Kunde einschreiben kann.';
comment on table velocity.tarif_kondition is
  'Zeitabhaengige Konditionen eines Tarifs. Ueberschneidungsfrei durch EXCLUDE-Constraint.';
comment on table velocity.mitgliedschaft is
  'Einschreibung eines Kunden in einen Tarif fuer einen Zeitraum. Je Kunde nie zwei gleichzeitig.';
comment on table velocity.freiminuten_periode is
  'Monatliches Freiminutenkontingent und dessen Verbrauch. Ersetzt einen mutierenden Zaehler, damit der Verlauf rekonstruierbar bleibt.';
comment on table velocity.nutzungspreis is
  'Zeitabhaengiger Preis je Fahrradtyp. Bepreist wird mit dem zum Startzeitpunkt der Ausleihe gueltigen Satz.';
comment on table velocity.entgeltart is
  'Klassifikation der Abrechnungspositionen. Referenztabelle statt ENUM, weil sie mit vorzeichen ein eigenes Attribut traegt.';
comment on table velocity.ausleihe is
  'Zentraler Geschaeftsvorfall: ein Kunde nutzt ein Rad von einem Zeitpunkt bis zu einem anderen.';
comment on table velocity.entgeltposition is
  'Einzelposition der Abrechnung einer Ausleihe. Macht die Preisfindung Zeile fuer Zeile nachvollziehbar.';
comment on table velocity.zahlungsart is
  'Verfahren der Bezahlung (SEPA, Kreditkarte, PayPal).';
comment on table velocity.zahlungsmittel is
  'Beim Zahlungsdienstleister hinterlegtes Mittel eines Kunden. Gespeichert wird nur dessen Token, nie IBAN oder Kartennummer.';
comment on table velocity.rechnung is
  'Monatlicher Beleg je Kunde ueber die Ausleihen einer Abrechnungsperiode.';
comment on table velocity.rechnungsposition is
  'Einzelposten einer Rechnung, in der Regel genau eine Ausleihe.';
comment on table velocity.zahlung is
  'Zahlungsvorgang zu einer Rechnung.';
comment on table velocity.faq_eintrag is
  'Haeufig gestellte Frage der Website. Frueher fest in index.html kodiert.';
comment on table velocity.nutzungsschritt is
  'Ein Schritt der Anleitung "So einfach geht es" auf der Website.';
comment on table velocity.kennzahl is
  'Kennzahl der Kopfleiste. Entweder mit festem Anzeigewert oder berechnet.';

-- ---------- Sichtenkommentare ----------------------------------------
comment on view velocity.v_station is
  'Oeffentliche Stationsliste mit Belegung. Ohne Personenbezug.';
comment on view velocity.v_verfuegbares_fahrrad is
  'Oeffentliche Liste ausleihbarer Raeder mit Position und geltendem Preis.';
comment on view velocity.v_tarifkarte is
  'Oeffentliche Preiskarten je Fahrradtyp inklusive Werbemerkmalen.';
comment on view velocity.v_tarif is
  'Oeffentliche Tarifliste mit den heute geltenden Konditionen.';
comment on view velocity.v_faq is 'Oeffentliche, aktive FAQ-Eintraege.';
comment on view velocity.v_nutzungsschritt is 'Oeffentliche Schritte der Nutzungsanleitung.';
comment on view velocity.v_kennzahl is 'Oeffentliche Kennzahlen, feste und berechnete.';
comment on view velocity.v_meine_ausleihe is
  'Ausleihen des angemeldeten Kunden. Laeuft mit den Rechten des Aufrufers, begrenzt durch RLS.';
comment on view velocity.v_meine_rechnung is
  'Rechnungen des angemeldeten Kunden. Laeuft mit den Rechten des Aufrufers, begrenzt durch RLS.';
comment on view velocity.v_mein_profil is
  'Stammdaten des angemeldeten Kunden. Laeuft mit Definer-Rechten und filtert selbst auf auth.uid(), weil adresse nicht freigegeben ist.';

-- ---------- Muster 1: kunde ------------------------------------------
comment on column velocity.kunde.kunde_id is
  'Surrogatschluessel. Fachlich bedeutungslos und deshalb stabil.';
comment on column velocity.kunde.kundennummer is
  'Fachlicher Schluessel im Format K-000000, nach aussen kommunizierbar.';
comment on column velocity.kunde.auth_uid is
  'Verbindung zum Anmeldekonto in auth.users. NULL bei Konten ohne Login, etwa aus der Datenuebernahme.';
comment on column velocity.kunde.email is
  'Eindeutige Kontaktadresse, zugleich Verknuepfungsmerkmal zum Anmeldekonto.';
comment on column velocity.kunde.anrede is 'Freitext fuer die Anschrift, keine geschlossene Werteliste.';
comment on column velocity.kunde.vorname is 'Vorname laut Selbstauskunft.';
comment on column velocity.kunde.nachname is 'Nachname laut Selbstauskunft.';
comment on column velocity.kunde.geburtsdatum is
  'Grundlage der Altersgrenze von 16 Jahren. Geprueft in api_profil_aktualisieren, nicht per CHECK: eine Bedingung mit current_date waere nicht immutable.';
comment on column velocity.kunde.telefon is 'Rufnummer, unformatiert gespeichert.';
comment on column velocity.kunde.rechnungsadresse_id is
  'Anschrift fuer die Rechnungsstellung. NULL, solange keine hinterlegt ist.';
comment on column velocity.kunde.status is
  'aktiv, gesperrt oder geschlossen. Nur aktive Kunden duerfen ausleihen.';
comment on column velocity.kunde.registriert_am is 'Fachlicher Zeitpunkt der Anmeldung.';

-- ---------- Muster 2: entgeltposition --------------------------------
comment on column velocity.entgeltposition.position_id is 'Surrogatschluessel.';
comment on column velocity.entgeltposition.ausleihe_id is 'Ausleihe, zu der die Position gehoert.';
comment on column velocity.entgeltposition.entgeltart_id is
  'Art der Position. Bestimmt ueber vorzeichen, ob belastet oder entlastet wird.';
comment on column velocity.entgeltposition.nutzungspreis_id is
  'Beleg der Preisfindung: welcher Preissatz wurde angewandt. NULL bei Positionen ohne Preisbezug, etwa dem Tarifrabatt.';
comment on column velocity.entgeltposition.menge is
  'Bezugsmenge, bei Zeitentgelt die Anzahl Minuten.';
comment on column velocity.entgeltposition.einzelbetrag is 'Betrag je Mengeneinheit, immer positiv.';
comment on column velocity.entgeltposition.betrag is
  'Wirksamer Betrag inklusive Vorzeichen. Die Summe aller Positionen ergibt den Preis der Ausleihe.';
comment on column velocity.entgeltposition.sortierung is 'Reihenfolge auf der Rechnung.';

-- ---------- Die uebrigen Spaltenkommentare ---------------------------
-- Alle weiteren Spalten sind nach demselben Muster zu kommentieren.
-- Der Test velocity_test.test_doku_vollstaendig prueft die
-- Vollstaendigkeit und schlaegt fehl, solange eine Spalte fehlt.
-- Ausgenommen sind nur die technischen Spalten erstellt_am und
-- geaendert_am.
--
-- Dieser Kommentar ist zwingend, weil test_doku_dictionary_sicht ihn
-- woertlich prueft:
comment on column velocity.fahrrad_position.station_id is
  'NULL bedeutet: das Rad steht frei abgestellt, nicht an einer Station';

-- ---------- Dictionary-Sicht -----------------------------------------
create or replace view velocity.v_data_dictionary as
select case c.relkind when 'r' then 'Tabelle' when 'v' then 'Sicht' end as objekt_art,
       c.relname                                   as tabelle,
       a.attname                                   as spalte,
       format_type(a.atttypid, a.atttypmod)        as datentyp,
       not a.attnotnull                            as nullbar,
       pg_get_expr(d.adbin, d.adrelid)             as vorgabe,
       col_description(c.oid, a.attnum)            as beschreibung,
       obj_description(c.oid, 'pg_class')          as tabellenbeschreibung,
       a.attnum                                    as position
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  join pg_attribute a on a.attrelid = c.oid
  left join pg_attrdef d on d.adrelid = c.oid and d.adnum = a.attnum
 where n.nspname = 'velocity' and c.relkind in ('r','v')
   and a.attnum > 0 and not a.attisdropped;

comment on view velocity.v_data_dictionary is
  'Erzeugt das Data Dictionary aus dem Systemkatalog. Grundlage fuer doku/datenmodell/06-data-dictionary.md.';
```

- [ ] **Schritt 4: Anwenden, Tests grün sehen**

```bash
python3 db/run.py db/aufbau/0012_dokumentation.sql
python3 db/test.py; echo "Rückgabewert: $?"
```

Der Test listet beim ersten Lauf die fehlenden Spalten auf. Diese Kommentare ergänzen und wiederholen, bis `0 fehlgeschlagene Zusicherung(en).` erscheint. Danach zur Sicherheit ein zweiter Lauf der Datei für die Idempotenz.

- [ ] **Schritt 5: Commit**

```bash
git add db/aufbau/0012_dokumentation.sql db/tests/t0012_dokumentation.sql
git commit -m "docs: Data Dictionary aus dem Systemkatalog"
```

---

### Aufgabe 14: Datenübernahme aus dem Altschema

Betrieblicher Schritt, nicht Teil des Lehrpfads. Deshalb unter `db/betrieb/`.

**Dateien:**
- Anlegen: `db/betrieb/uebernahme_altdaten.sql`
- Anlegen: `db/betrieb/abgleichsbericht.sql`
- Test: `db/tests/t0013_uebernahme.sql`

**Schnittstellen:**
- Liefert: `velocity.uebernahme_protokoll(protokoll_id, lauf, quelle, ziel, gelesen, geschrieben, uebersprungen, hinweis, gelaufen_am)` und die übernommenen Daten. Schlüsselzuordnung erfolgt über die **fachlichen** Schlüssel, nicht über Surrogatschlüssel: Kunde über `email`, Station über `stationsnummer` (`S-0001` aus der alten `station_id`), Fahrrad über `rahmennummer`, Fahrradtyp und Tarif über die Bezeichnung.

- [ ] **Schritt 1: Erwartungswerte festhalten und Test schreiben**

Sollwerte aus der Ist-Analyse: `kunde` 1015, `station` 13, `fahrrad` 352, `ausleihe` 32, `mitgliedschaft` 10, `fahrradtyp` 3, `tarif` 4.

`db/tests/t0013_uebernahme.sql`:

```sql
-- =====================================================================
-- t0013 Datenuebernahme
--
-- Diese Tests laufen NACH db/betrieb/uebernahme_altdaten.sql und pruefen
-- den Abgleich. Vor der Uebernahme schlagen sie erwartungsgemaess fehl.
-- =====================================================================
create schema if not exists velocity_test;
set search_path = velocity_test, velocity, extensions, public;

-- Geprueft wird gegen das Uebernahmeprotokoll, nicht gegen die aktuellen
-- Zeilenzahlen: nach der Ende-zu-Ende-Pruefung aus Aufgabe 16 gibt es
-- zusaetzliche Kunden und Ausleihen aus dem laufenden Betrieb. Fuer die
-- Livemengen gilt deshalb nur eine Untergrenze.
create or replace function velocity_test.test_ue_mengen()
returns setof text language plpgsql as $$
declare
  v_lauf timestamptz;
begin
  select max(lauf) into v_lauf from velocity.uebernahme_protokoll;

  return next is((select geschrieben from velocity.uebernahme_protokoll
                   where lauf = v_lauf and ziel = 'velocity.kunde'), 1015,
                 'Das Protokoll weist 1015 uebernommene Kunden aus');
  return next is((select geschrieben from velocity.uebernahme_protokoll
                   where lauf = v_lauf and ziel = 'velocity.station'), 13,
                 'Das Protokoll weist 13 uebernommene Stationen aus');

  return next cmp_ok((select count(*)::int from velocity.kunde),   '>=', 1015,
                     'Mindestens 1015 Kunden vorhanden');
  return next is((select count(*)::int from velocity.station),        13, '13 Stationen vorhanden');
  return next is((select count(*)::int from velocity.fahrrad),       352, '352 Raeder vorhanden');
  return next cmp_ok((select count(*)::int from velocity.ausleihe), '>=',  32,
                     'Mindestens 32 Ausleihen vorhanden');
  return next is((select count(*)::int from velocity.mitgliedschaft), 10, '10 Mitgliedschaften vorhanden');
end;
$$;

create or replace function velocity_test.test_ue_keine_passwoerter()
returns setof text language plpgsql as $$
begin
  return next hasnt_column('velocity'::name, 'kunde'::name, 'passwort_hash'::name,
                           'Es gibt gar keine Passwortspalte, also wurde auch nichts uebernommen');
  return next cmp_ok((select count(*)::int from velocity.kunde where auth_uid is not null),
                     '>=', 3,
                     'Mindestens die drei zuvor verknuepften Konten haben eine Anmeldung');
end;
$$;

create or replace function velocity_test.test_ue_keine_zufallskoordinaten()
returns setof text language plpgsql as $$
begin
  -- Im Altbestand hatte JEDES Rad Koordinaten aus random(). Uebernommen
  -- werden nur Positionen, die sich aus der Station ergeben.
  --
  -- Geprueft werden ausschliesslich Raeder, die nie ausgeliehen wurden:
  -- ein regulaer frei abgestelltes Rad traegt zu Recht eine Koordinate
  -- ohne Station.
  return next ok(
    (select count(*) from velocity.fahrrad_position p
      where p.station_id is null and p.latitude is not null
        and not exists (select 1 from velocity.ausleihe a
                         where a.fahrrad_id = p.fahrrad_id)) = 0,
    'Kein nie genutztes Rad traegt eine aus random() erfundene Koordinate');
end;
$$;

create or replace function velocity_test.test_ue_altbetraege_erhalten()
returns setof text language plpgsql as $$
declare
  v_alt numeric;
  v_neu numeric;
begin
  select coalesce(sum(kosten), 0) into v_alt
    from "cityBikesRental".ausleihe where kosten is not null;
  select coalesce(sum(p.betrag), 0) into v_neu
    from velocity.entgeltposition p
    join velocity.entgeltart a on a.entgeltart_id = p.entgeltart_id
   where a.code = 'BESTANDSUEBERNAHME';

  return next is(v_neu, v_alt, 'Die Summe der Altbetraege bleibt unveraendert erhalten');
end;
$$;

create or replace function velocity_test.test_ue_protokoll()
returns setof text language plpgsql as $$
begin
  return next has_table('velocity'::name, 'uebernahme_protokoll'::name,
                        'Das Uebernahmeprotokoll existiert');
  return next ok((select count(*) from velocity.uebernahme_protokoll) >= 8,
                 'Jeder Uebernahmeschritt ist protokolliert');
end;
$$;
```

- [ ] **Schritt 2: Test ausführen und Fehlschlag bestätigen**

```bash
python3 db/test.py db/tests/t0013_uebernahme.sql; echo "Rückgabewert: $?"
```

Erwartet: `not ok` mit `have: 0` bei den Mengen, Rückgabewert 1.

- [ ] **Schritt 3: Übernahmeskript schreiben**

`db/betrieb/uebernahme_altdaten.sql`:

```sql
-- =====================================================================
-- Datenuebernahme aus cityBikesRental nach velocity
--
-- Zweck:      Einmalige Uebernahme des Altbestands. NICHT Teil des
--             Lehrpfads - der Entwurf steht fuer sich.
-- Objekte:    velocity.uebernahme_protokoll und Datenzeilen
-- Ruecknahme: TRUNCATE der Zieltabellen in Abhaengigkeitsreihenfolge.
--
-- Das Altschema wird ausschliesslich gelesen.
-- Zuordnung ueber fachliche Schluessel, nicht ueber Surrogatschluessel:
-- Kunde ueber email, Station ueber stationsnummer, Fahrrad ueber
-- rahmennummer, Typ und Tarif ueber die Bezeichnung.
--
-- Mehrfach ausfuehrbar: alle Einfuegungen sind ON CONFLICT DO NOTHING
-- bzw. NOT EXISTS.
-- =====================================================================

create table if not exists velocity.uebernahme_protokoll (
  protokoll_id  bigint generated always as identity primary key,
  lauf          timestamptz not null default now(),
  quelle        text not null,
  ziel          text not null,
  gelesen       integer not null default 0,
  geschrieben   integer not null default 0,
  uebersprungen integer not null default 0,
  hinweis       text
);

comment on table velocity.uebernahme_protokoll is
  'Protokoll der einmaligen Uebernahme aus dem Altschema cityBikesRental.';

do $$
declare
  v_lauf     timestamptz := now();
  v_gelesen  integer;
  v_vorher   integer;
  v_nachher  integer;
  v_typ_city bigint; v_typ_ebike bigint; v_typ_cargo bigint;
  v_herst    bigint;
begin

  -- 1 Adressen der Kunden ---------------------------------------------
  select count(*) into v_gelesen from "cityBikesRental".kunde;
  select count(*) into v_vorher  from velocity.adresse;

  insert into velocity.adresse (strasse, hausnummer, plz, ort)
  select distinct
         coalesce(k.strasse, 'unbekannt'),
         coalesce(k.hausnummer, ''),
         coalesce(k.plz, '00000'),
         coalesce(k.ort, 'unbekannt')
    from "cityBikesRental".kunde k
   where k.strasse is not null and k.plz ~ '^[0-9]{5}$'
  on conflict (strasse, hausnummer, plz, ort, land_code) do nothing;

  select count(*) into v_nachher from velocity.adresse;
  insert into velocity.uebernahme_protokoll (lauf, quelle, ziel, gelesen, geschrieben, hinweis)
  values (v_lauf, 'cityBikesRental.kunde', 'velocity.adresse', v_gelesen, v_nachher - v_vorher,
          'Nur Saetze mit fuenfstelliger PLZ; dedupliziert ueber den Fachschluessel');

  -- 2 Kunden ------------------------------------------------------------
  select count(*) into v_vorher from velocity.kunde;

  insert into velocity.kunde
    (kundennummer, auth_uid, email, vorname, nachname, telefon, geburtsdatum,
     rechnungsadresse_id, status, registriert_am)
  select 'K-' || lpad(k.kunde_id::text, 6, '0'),
         m.auth_uid,
         k.email,
         k.vorname,
         k.nachname,
         k.telefon,
         k.geburtsdatum,
         a.adresse_id,
         case when k.aktiv then 'aktiv' else 'gesperrt' end::velocity.kunde_status,
         k.registriert_am at time zone 'Europe/Berlin'
    from "cityBikesRental".kunde k
    left join "cityBikesRental".auth_kunde_mapping m on m.kunde_id = k.kunde_id
    left join velocity.adresse a
           on a.strasse    = coalesce(k.strasse, 'unbekannt')
          and a.hausnummer = coalesce(k.hausnummer, '')
          and a.plz        = coalesce(k.plz, '00000')
          and a.ort        = coalesce(k.ort, 'unbekannt')
   where k.email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
  on conflict (email) do nothing;

  select count(*) into v_nachher from velocity.kunde;
  insert into velocity.uebernahme_protokoll (lauf, quelle, ziel, gelesen, geschrieben, uebersprungen, hinweis)
  values (v_lauf, 'cityBikesRental.kunde', 'velocity.kunde',
          (select count(*) from "cityBikesRental".kunde), v_nachher - v_vorher,
          (select count(*) from "cityBikesRental".kunde) - (v_nachher - v_vorher),
          'passwort_hash wird bewusst nicht uebernommen; auth_uid nur fuer bereits verknuepfte Konten');

  -- Nummernkreis nachziehen, damit neue Kunden nicht kollidieren
  perform setval('velocity.seq_kundennummer',
                 greatest((select coalesce(max(substring(kundennummer from 3)::bigint), 0)
                             from velocity.kunde), 1));

  -- 3 Adressen und Stationen -------------------------------------------
  insert into velocity.adresse (strasse, hausnummer, plz, ort)
  select distinct s.strasse, coalesce(s.hausnummer, ''), s.plz, s.ort
    from "cityBikesRental".station s
  on conflict (strasse, hausnummer, plz, ort, land_code) do nothing;

  select count(*) into v_vorher from velocity.station;

  insert into velocity.station
    (stationsnummer, name, adresse_id, latitude, longitude, kapazitaet, betriebszeitraum)
  select 'S-' || lpad(s.station_id::text, 4, '0'),
         s.name,
         a.adresse_id,
         s.latitude, s.longitude,
         s.kapazitaet,
         case when s.aktiv then daterange(current_date - 365, null, '[)')
              else daterange(current_date - 365, current_date, '[)') end
    from "cityBikesRental".station s
    join velocity.adresse a
      on a.strasse = s.strasse and a.hausnummer = coalesce(s.hausnummer, '')
     and a.plz = s.plz and a.ort = s.ort
  on conflict (stationsnummer) do nothing;

  select count(*) into v_nachher from velocity.station;
  insert into velocity.uebernahme_protokoll (lauf, quelle, ziel, gelesen, geschrieben, hinweis)
  values (v_lauf, 'cityBikesRental.station', 'velocity.station',
          (select count(*) from "cityBikesRental".station), v_nachher - v_vorher,
          'Stationsnummer aus der alten station_id gebildet');

  -- 4 Hersteller und Modelle -------------------------------------------
  -- Im Altbestand gibt es keine Modellangabe. Statt sie zu erfinden,
  -- wird je Typ ein ausdruecklich als unbekannt gekennzeichnetes Modell
  -- angelegt.
  insert into velocity.hersteller (name) values ('unbekannt')
  on conflict (name) do nothing;
  select hersteller_id into v_herst from velocity.hersteller where name = 'unbekannt';

  select typ_id into v_typ_city  from velocity.fahrradtyp where typ_code = 'CITY';
  select typ_id into v_typ_ebike from velocity.fahrradtyp where typ_code = 'EBIKE';
  select typ_id into v_typ_cargo from velocity.fahrradtyp where typ_code = 'CARGO';

  insert into velocity.fahrradmodell (hersteller_id, typ_id, modellbezeichnung)
  values (v_herst, v_typ_city,  'Bestandsrad City'),
         (v_herst, v_typ_ebike, 'Bestandsrad E-Bike'),
         (v_herst, v_typ_cargo, 'Bestandsrad Cargo')
  on conflict (hersteller_id, modellbezeichnung) do nothing;

  insert into velocity.uebernahme_protokoll (lauf, quelle, ziel, gelesen, geschrieben, hinweis)
  values (v_lauf, '-', 'velocity.hersteller, velocity.fahrradmodell', 0, 3,
          'Im Altbestand fehlen Hersteller- und Modellangaben; Platzhalter "unbekannt" angelegt');

  -- 5 Fahrraeder und Positionen ----------------------------------------
  select count(*) into v_vorher from velocity.fahrrad;

  insert into velocity.fahrrad (rahmennummer, modell_id, status, angeschafft_am)
  select f.rahmennummer,
         m.modell_id,
         case f.status::text
           when 'verfuegbar'  then 'verfuegbar'
           when 'ausgeliehen' then 'ausgeliehen'
           when 'wartung'     then 'wartung'
           else 'defekt'
         end::velocity.fahrrad_status,
         f.angeschafft_am
    from "cityBikesRental".fahrrad f
    join "cityBikesRental".fahrradtyp ft on ft.typ_id = f.typ_id
    join velocity.fahrradmodell m
      on m.modellbezeichnung = case ft.bezeichnung
                                 when 'CityRad'   then 'Bestandsrad City'
                                 when 'E-Rad'     then 'Bestandsrad E-Bike'
                                 when 'LastenRad' then 'Bestandsrad Cargo'
                               end
  on conflict (rahmennummer) do nothing;

  select count(*) into v_nachher from velocity.fahrrad;

  -- Position: NUR aus der Station abgeleitet. Die random()-Koordinaten
  -- des Altbestands werden verworfen.
  insert into velocity.fahrrad_position (fahrrad_id, station_id, latitude, longitude)
  select nf.fahrrad_id,
         ns.station_id,
         ns.latitude,
         ns.longitude
    from "cityBikesRental".fahrrad af
    join velocity.fahrrad nf on nf.rahmennummer = af.rahmennummer
    left join velocity.station ns
           on ns.stationsnummer = 'S-' || lpad(af.station_id::text, 4, '0')
  on conflict (fahrrad_id) do nothing;

  insert into velocity.uebernahme_protokoll (lauf, quelle, ziel, gelesen, geschrieben, hinweis)
  values (v_lauf, 'cityBikesRental.fahrrad', 'velocity.fahrrad, velocity.fahrrad_position',
          (select count(*) from "cityBikesRental".fahrrad), v_nachher - v_vorher,
          'Koordinaten aus random() verworfen; Position ausschliesslich aus der Station abgeleitet');

  -- 6 Mitgliedschaften und Freiminuten ---------------------------------
  select count(*) into v_vorher from velocity.mitgliedschaft;

  insert into velocity.mitgliedschaft (kunde_id, tarif_id, gueltigkeit)
  select nk.kunde_id,
         nt.tarif_id,
         daterange(am.gueltig_von, am.gueltig_bis, '[)')
    from "cityBikesRental".mitgliedschaft am
    join "cityBikesRental".kunde ak on ak.kunde_id = am.kunde_id
    join velocity.kunde nk on nk.email = ak.email
    join "cityBikesRental".tarif at on at.tarif_id = am.tarif_id
    join velocity.tarif nt
      on nt.tarif_code = case at.bezeichnung
                           when 'Basistarif'     then 'BASIS'
                           when 'Studententarif' then 'STUDENT'
                           when 'Premium'        then 'PREMIUM'
                           else 'OEPNV'
                         end
   where am.aktiv
     and not exists (select 1 from velocity.mitgliedschaft vm
                      where vm.kunde_id = nk.kunde_id
                        and vm.gueltigkeit && daterange(am.gueltig_von, am.gueltig_bis, '[)'));

  select count(*) into v_nachher from velocity.mitgliedschaft;

  -- Der alte Restzaehler wird in Kontingent und Verbrauch des laufenden
  -- Monats umgerechnet.
  insert into velocity.freiminuten_periode
    (mitgliedschaft_id, jahr, monat, kontingent_minuten, verbraucht_minuten)
  select nm.mitgliedschaft_id,
         extract(year  from current_date)::integer,
         extract(month from current_date)::integer,
         at.freiminuten_pro_monat,
         greatest(at.freiminuten_pro_monat - am.freiminuten_aktuell, 0)
    from "cityBikesRental".mitgliedschaft am
    join "cityBikesRental".kunde ak on ak.kunde_id = am.kunde_id
    join "cityBikesRental".tarif at on at.tarif_id = am.tarif_id
    join velocity.kunde nk on nk.email = ak.email
    join velocity.mitgliedschaft nm on nm.kunde_id = nk.kunde_id
                                   and nm.gueltigkeit @> current_date
   where am.aktiv
  on conflict (mitgliedschaft_id, jahr, monat) do nothing;

  insert into velocity.uebernahme_protokoll (lauf, quelle, ziel, gelesen, geschrieben, hinweis)
  values (v_lauf, 'cityBikesRental.mitgliedschaft',
          'velocity.mitgliedschaft, velocity.freiminuten_periode',
          (select count(*) from "cityBikesRental".mitgliedschaft), v_nachher - v_vorher,
          'freiminuten_aktuell umgerechnet: verbraucht = Kontingent minus Restwert');

  -- 7 Ausleihen ---------------------------------------------------------
  select count(*) into v_vorher from velocity.ausleihe;

  insert into velocity.ausleihe
    (kunde_id, fahrrad_id, start_station_id, startzeit, end_station_id, endzeit, status)
  select nk.kunde_id,
         nf.fahrrad_id,
         nss.station_id,
         aa.startzeit at time zone 'Europe/Berlin',
         nes.station_id,
         aa.endzeit   at time zone 'Europe/Berlin',
         case aa.status::text
           when 'aktiv'         then 'aktiv'
           when 'abgeschlossen' then 'abgeschlossen'
           else 'storniert'
         end::velocity.ausleihe_status
    from "cityBikesRental".ausleihe aa
    join "cityBikesRental".kunde   ak on ak.kunde_id   = aa.kunde_id
    join "cityBikesRental".fahrrad af on af.fahrrad_id = aa.fahrrad_id
    join velocity.kunde   nk on nk.email        = ak.email
    join velocity.fahrrad nf on nf.rahmennummer = af.rahmennummer
    left join velocity.station nss on nss.stationsnummer = 'S-' || lpad(aa.start_station_id::text, 4, '0')
    left join velocity.station nes on nes.stationsnummer = 'S-' || lpad(aa.end_station_id::text,   4, '0')
   where not exists (
     select 1 from velocity.ausleihe va
      where va.kunde_id = nk.kunde_id and va.fahrrad_id = nf.fahrrad_id
        and va.startzeit = aa.startzeit at time zone 'Europe/Berlin');

  select count(*) into v_nachher from velocity.ausleihe;

  -- Die historischen Kosten werden als EINE Position uebernommen. Eine
  -- Preisfindung, die nie stattgefunden hat, wird nicht rekonstruiert.
  insert into velocity.entgeltposition
    (ausleihe_id, entgeltart_id, menge, einzelbetrag, betrag, sortierung)
  select na.ausleihe_id,
         (select entgeltart_id from velocity.entgeltart where code = 'BESTANDSUEBERNAHME'),
         1, aa.kosten, aa.kosten, 1
    from "cityBikesRental".ausleihe aa
    join "cityBikesRental".kunde   ak on ak.kunde_id   = aa.kunde_id
    join "cityBikesRental".fahrrad af on af.fahrrad_id = aa.fahrrad_id
    join velocity.kunde   nk on nk.email        = ak.email
    join velocity.fahrrad nf on nf.rahmennummer = af.rahmennummer
    join velocity.ausleihe na on na.kunde_id = nk.kunde_id
                             and na.fahrrad_id = nf.fahrrad_id
                             and na.startzeit = aa.startzeit at time zone 'Europe/Berlin'
   where aa.kosten is not null
     and not exists (select 1 from velocity.entgeltposition ep
                      where ep.ausleihe_id = na.ausleihe_id);

  insert into velocity.uebernahme_protokoll (lauf, quelle, ziel, gelesen, geschrieben, hinweis)
  values (v_lauf, 'cityBikesRental.ausleihe', 'velocity.ausleihe, velocity.entgeltposition',
          (select count(*) from "cityBikesRental".ausleihe), v_nachher - v_vorher,
          'Altbetraege als Position BESTANDSUEBERNAHME; historische Preise sind nicht rekonstruierbar');

  -- 8 Nicht uebernommen -------------------------------------------------
  insert into velocity.uebernahme_protokoll (lauf, quelle, ziel, gelesen, geschrieben, uebersprungen, hinweis)
  values (v_lauf, 'cityBikesRental.station_fahrradtyp', '-',
          (select count(*) from "cityBikesRental".station_fahrradtyp), 0,
          (select count(*) from "cityBikesRental".station_fahrradtyp),
          'Bewusst nicht uebernommen: fachlich nirgends ausgewertet');

end $$;
```

`db/betrieb/abgleichsbericht.sql`:

```sql
-- =====================================================================
-- Abgleichsbericht der Datenuebernahme
--
-- Stellt Soll und Ist gegenueber. Abweichungen muessen erklaerbar sein.
-- =====================================================================
select bereich, soll_alt, ist_neu, ist_neu - soll_alt as abweichung, bemerkung
from (
  select 'kunde' as bereich,
         (select count(*) from "cityBikesRental".kunde)          as soll_alt,
         (select count(*) from velocity.kunde)                    as ist_neu,
         'Saetze mit unplausibler E-Mail werden ausgelassen'       as bemerkung
  union all
  select 'station',
         (select count(*) from "cityBikesRental".station),
         (select count(*) from velocity.station), ''
  union all
  select 'fahrrad',
         (select count(*) from "cityBikesRental".fahrrad),
         (select count(*) from velocity.fahrrad), ''
  union all
  select 'ausleihe',
         (select count(*) from "cityBikesRental".ausleihe),
         (select count(*) from velocity.ausleihe), ''
  union all
  select 'mitgliedschaft',
         (select count(*) from "cityBikesRental".mitgliedschaft where aktiv),
         (select count(*) from velocity.mitgliedschaft),
         'Nur aktive Mitgliedschaften'
  union all
  select 'Summe Altbetraege in Cent',
         (select coalesce(round(sum(kosten) * 100), 0) from "cityBikesRental".ausleihe),
         (select coalesce(round(sum(p.betrag) * 100), 0) from velocity.entgeltposition p
            join velocity.entgeltart a on a.entgeltart_id = p.entgeltart_id
           where a.code = 'BESTANDSUEBERNAHME'),
         'Muss exakt uebereinstimmen'
) t
order by bereich;
```

- [ ] **Schritt 4: Übernahme ausführen**

```bash
python3 db/run.py db/betrieb/uebernahme_altdaten.sql
```

Erwartet: `OK`.

- [ ] **Schritt 5: Abgleichsbericht ansehen**

```bash
python3 -c "
import sys; sys.path.insert(0, 'db')
from run import verbinde
import pathlib
c = verbinde(); cur = c.cursor()
cur.execute(pathlib.Path('db/betrieb/abgleichsbericht.sql').read_text(encoding='utf-8'))
print(' | '.join(d[0] for d in cur.description))
for r in cur.fetchall(): print(' | '.join(str(x) for x in r))
"
```

Erwartet: `abweichung` ist überall 0 oder durch die Spalte `bemerkung` erklärt. Die Zeile „Summe Altbetraege in Cent" muss exakt 0 Abweichung zeigen. Jede unerklärte Abweichung ist zu beheben, bevor es weitergeht.

- [ ] **Schritt 6: Idempotenz nachweisen und Tests grün sehen**

```bash
python3 db/run.py db/betrieb/uebernahme_altdaten.sql
python3 db/test.py; echo "Rückgabewert: $?"
```

Erwartet: der zweite Übernahmelauf schreibt nichts nach (Protokolleinträge mit `geschrieben = 0`), die Mengen bleiben gleich, alle Zusicherungen `ok`.

- [ ] **Schritt 7: Commit**

```bash
git add db/betrieb/uebernahme_altdaten.sql db/betrieb/abgleichsbericht.sql db/tests/t0013_uebernahme.sql
git commit -m "chore: Uebernahme des Altbestands mit Protokoll und Abgleichsbericht"
```

---

### Aufgabe 15: Website auf das neue Schema umstellen

**Dateien:**
- Ändern: `src/config.js` (Schema auf `velocity`)
- Ersetzen: `src/supabase.js` (nur noch Sichten und `api_*`)
- Ändern: `src/auth.js` (Kundensatz per RPC statt per Trigger)
- Ändern: `src/script.js` (Tarifkarten, FAQ, Schritte, Kennzahlen aus der DB rendern)
- Ändern: `src/index.html` (feste Inhalte durch leere Container ersetzen)

**Schnittstellen:**
- Nutzt: `v_station`, `v_verfuegbares_fahrrad`, `v_tarifkarte`, `v_tarif`, `v_faq`, `v_nutzungsschritt`, `v_kennzahl`, `v_meine_ausleihe`, `api_kunde_sicherstellen`, `api_ausleihe_starten`, `api_ausleihe_beenden`.
- Liefert: `fetchStations()`, `fetchAvailableBikes()`, `fetchTarifkarten()`, `fetchTarife()`, `fetchFaq()`, `fetchNutzungsschritte()`, `fetchKennzahlen()`, `fetchActiveRentals()`, `fetchRentalHistory()`, `startRental(fahrradId)`, `endRental(ausleiheId, stationId, lat, lon)`, `ensureKunde()` — alle als globale Funktionen wie bisher, damit `script.js` unverändert im selben Stil bleibt.

- [ ] **Schritt 1: `src/config.js` umstellen**

```javascript
// ============================================
// VeloCity - Supabase Konfiguration
// ============================================

const SUPABASE_CONFIG = {
    url: 'https://supabase.butscher.cloud',
    // Der anon-Key ist bewusst oeffentlich: er wird an jeden Browser
    // ausgeliefert. Der Schutz liegt vollstaendig in RLS und in den
    // Rechten des Schemas, nicht in der Geheimhaltung dieses Schluessels.
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzYyNjc5NTM1LCJleHAiOjIwNzgwMzk1MzV9.Fv3soDCs_GrM9MA-4Goq1ANCoJ7KzVpuJ9l9z7bQEwk'
};

const APP_CONFIG = {
    defaultMapCenter: [49.7930, 9.9360],
    defaultZoom: 14,
    schema: 'velocity'
};
```

- [ ] **Schritt 2: `src/supabase.js` ersetzen**

```javascript
// ============================================
// VeloCity - Datenzugriff
//
// Regel dieser Schicht: gelesen wird ausschliesslich aus v_-Sichten,
// geschrieben ausschliesslich ueber api_-Funktionen. Auf Basistabellen
// greift der Browser nie zu - er kaeme auch gar nicht an sie heran.
// ============================================

const supabaseClient = window.supabase.createClient(
    SUPABASE_CONFIG.url,
    SUPABASE_CONFIG.anonKey,
    { db: { schema: APP_CONFIG.schema } }
);

// Einheitliche Fehlerbehandlung: Lesefehler liefern eine leere Liste,
// damit ein Ausfall einer Sicht nicht die ganze Seite zerlegt.
async function ladeListe(quelle, spalten = '*', aufbau = (q) => q) {
    const { data, error } = await aufbau(supabaseClient.from(quelle).select(spalten));
    if (error) {
        console.error(`Fehler beim Laden von ${quelle}:`, error.message);
        return [];
    }
    return data || [];
}

// ===== OEFFENTLICHE DATEN =====

async function fetchStations() {
    return ladeListe('v_station',
        'station_id, stationsnummer, name, strasse, hausnummer, plz, ort, ' +
        'latitude, longitude, kapazitaet, verfuegbare_raeder, freie_stellplaetze');
}

async function fetchAvailableBikes() {
    return ladeListe('v_verfuegbares_fahrrad');
}

async function fetchTarifkarten() {
    return ladeListe('v_tarifkarte', '*', (q) => q.order('preis_pro_minute'));
}

async function fetchTarife() {
    return ladeListe('v_tarif', '*', (q) => q.order('monatspreis'));
}

async function fetchFaq() {
    return ladeListe('v_faq', '*', (q) => q.order('sortierung'));
}

async function fetchNutzungsschritte() {
    return ladeListe('v_nutzungsschritt', '*', (q) => q.order('nummer'));
}

async function fetchKennzahlen() {
    return ladeListe('v_kennzahl', '*', (q) => q.order('sortierung'));
}

// ===== EIGENE DATEN (nur angemeldet) =====

async function fetchActiveRentals() {
    return ladeListe('v_meine_ausleihe', '*', (q) => q.eq('status', 'aktiv'));
}

async function fetchRentalHistory() {
    return ladeListe('v_meine_ausleihe', '*',
        (q) => q.order('startzeit', { ascending: false }).limit(20));
}

async function fetchProfil() {
    const zeilen = await ladeListe('v_mein_profil');
    return zeilen[0] || null;
}

// ===== SCHREIBENDE VORGAENGE =====

// Legt bei Bedarf den Kundensatz zum angemeldeten Konto an. Idempotent,
// wird nach jedem Login aufgerufen. Ersetzt den frueheren Trigger auf
// auth.users - ein Fremdschema fasst diese Anwendung nicht an.
async function ensureKunde() {
    const { data, error } = await supabaseClient.rpc('api_kunde_sicherstellen');
    if (error) {
        console.error('Kundensatz konnte nicht sichergestellt werden:', error.message);
        return null;
    }
    return Array.isArray(data) ? data[0] : data;
}

async function startRental(fahrradId) {
    const { data, error } = await supabaseClient.rpc('api_ausleihe_starten', {
        p_fahrrad_id: fahrradId
    });
    if (error) throw new Error(error.message);

    const ergebnis = Array.isArray(data) ? data[0] : data;
    if (!ergebnis || !ergebnis.ausleihe_id) {
        throw new Error(ergebnis?.meldung || 'Ausleihe konnte nicht gestartet werden');
    }
    return ergebnis;
}

async function endRental(ausleiheId, stationId = null, latitude = null, longitude = null) {
    const { data, error } = await supabaseClient.rpc('api_ausleihe_beenden', {
        p_ausleihe_id: ausleiheId,
        p_end_station_id: stationId,
        p_latitude: latitude,
        p_longitude: longitude
    });
    if (error) throw new Error(error.message);

    const ergebnis = Array.isArray(data) ? data[0] : data;
    if (!ergebnis || ergebnis.gesamtbetrag === null) {
        throw new Error(ergebnis?.meldung || 'Ausleihe konnte nicht beendet werden');
    }
    return ergebnis;
}
```

- [ ] **Schritt 3: `src/auth.js` anpassen**

In `auth.js` die Funktion `onAuthStateChange`-Registrierung so ergänzen, dass nach jeder Anmeldung der Kundensatz sichergestellt wird. Im vorhandenen `supabaseClient.auth.onAuthStateChange`-Block direkt nach dem Setzen von `currentUser` einfügen:

```javascript
supabaseClient.auth.onAuthStateChange(async (event, session) => {
    currentUser = session?.user ?? null;
    console.log('Auth State Changed:', event, currentUser?.email);

    // Kundensatz sicherstellen, bevor die Oberflaeche reagiert.
    // Idempotent: legt nur an, was noch fehlt.
    if (currentUser) {
        await ensureKunde();
    }

    authStateListeners.forEach(listener => {
        try {
            listener(currentUser);
        } catch (e) {
            console.error('Auth listener error:', e);
        }
    });
});
```

Und in `initAuth()` genauso:

```javascript
async function initAuth() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
        currentUser = session.user;
        await ensureKunde();
        authStateListeners.forEach(listener => listener(currentUser));
    }
}
```

Die Funktion `register()` bleibt unverändert: der Kundensatz entsteht beim ersten `onAuthStateChange` nach der Registrierung.

- [ ] **Schritt 4: Feste Inhalte aus `src/index.html` entfernen**

Vier Stellen ersetzen, jeweils den gesamten Inhalt durch einen leeren Container:

1. Die vier `<div class="stat-item">` innerhalb von `<div class="container stats-grid">` löschen; das umschließende `div` bekommt `id="stats-grid"`.
2. Der Inhalt von `<div class="howto-grid">` wird gelöscht; das `div` bekommt `id="howto-grid"`.
3. Die drei `<div class="price-card">` innerhalb von `<div class="pricing-grid" id="pricing-grid">` werden gelöscht; die `id` bleibt.
4. Die vier `<details>` innerhalb von `<div class="faq-grid">` werden gelöscht; das `div` bekommt `id="faq-grid"`.

Ergebnis, exemplarisch für die Kennzahlen:

```html
<section class="stats-bar">
    <div class="container stats-grid" id="stats-grid">
        <!-- wird aus velocity.v_kennzahl geladen -->
    </div>
</section>
```

- [ ] **Schritt 5: Renderfunktionen in `src/script.js` ergänzen**

Innerhalb des vorhandenen `DOMContentLoaded`-Blocks, direkt vor `loadData()`, einfügen:

```javascript
    // ===== INHALTE AUS DER DATENBANK =====

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text ?? '';
        return div.innerHTML;
    }

    function euro(betrag) {
        return Number(betrag).toLocaleString('de-DE',
            { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' Euro';
    }

    async function renderKennzahlen() {
        const ziel = document.getElementById('stats-grid');
        if (!ziel) return;
        const zeilen = await fetchKennzahlen();
        ziel.innerHTML = zeilen.map(k => `
            <div class="stat-item">
                <span class="stat-number">${escapeHtml(k.wert)}</span>
                <span class="stat-label">${escapeHtml(k.label)}</span>
            </div>`).join('');
    }

    async function renderNutzungsschritte() {
        const ziel = document.getElementById('howto-grid');
        if (!ziel) return;
        const zeilen = await fetchNutzungsschritte();
        ziel.innerHTML = zeilen.map(s => `
            <div class="howto-card">
                <div class="step-number">${s.nummer}</div>
                <div class="icon-circle"><i class="fa-solid ${escapeHtml(s.icon_code)}"></i></div>
                <h3>${escapeHtml(s.titel)}</h3>
                <p>${escapeHtml(s.beschreibung)}</p>
            </div>`).join('');
    }

    async function renderTarifkarten() {
        const ziel = document.getElementById('pricing-grid');
        if (!ziel) return;
        const karten = await fetchTarifkarten();
        ziel.innerHTML = karten.map((k, i) => `
            <div class="price-card${i === 1 ? ' popular' : ''}">
                ${i === 1 ? '<div class="badge-pop">Beliebteste Wahl</div>' : ''}
                <div class="card-content">
                    <div class="icon-header"><i class="fa-solid fa-bicycle"></i></div>
                    <div class="header">${escapeHtml(k.bezeichnung)}</div>
                    <div class="price">${euro(k.preis_30_minuten)} <small>/ 30 Min</small></div>
                    <ul class="features-list">
                        ${(k.merkmale || []).map(m =>
                            `<li><i class="fa-solid fa-check"></i> ${escapeHtml(m)}</li>`).join('')}
                    </ul>
                </div>
                <button class="${i === 1 ? 'btn-primary' : 'btn-outline'} full-width"
                        onclick="document.getElementById('map-section').scrollIntoView()">
                    Fahrt starten
                </button>
            </div>`).join('');
    }

    async function renderFaq() {
        const ziel = document.getElementById('faq-grid');
        if (!ziel) return;
        const zeilen = await fetchFaq();
        ziel.innerHTML = zeilen.map(f => `
            <details>
                <summary>${escapeHtml(f.frage)}</summary>
                <div class="faq-content">${escapeHtml(f.antwort)}</div>
            </details>`).join('');
    }

    async function renderInhalte() {
        await Promise.all([
            renderKennzahlen(),
            renderNutzungsschritte(),
            renderTarifkarten(),
            renderFaq()
        ]);
    }
```

Anschließend den Aufruf ergänzen, dort wo bisher `loadData()` aufgerufen wird:

```javascript
    renderInhalte();
    loadData();
```

- [ ] **Schritt 6: Aufrufe der Ausleihe anpassen**

In `script.js` ruft der Beenden-Knopf bisher `endRental(ausleiheId, endStationId)` auf. Die neue Signatur nimmt zusätzlich Koordinaten. Die vorhandene Aufrufstelle so ändern, dass bei fehlender Station die Kartenmitte übergeben wird:

```javascript
            const mitte = map.getCenter();
            const result = await endRental(
                aktiveAusleiheId,
                gewaehlteStationId || null,
                gewaehlteStationId ? null : mitte.lat,
                gewaehlteStationId ? null : mitte.lng
            );
            alert(`Fahrt beendet. Dauer: ${result.dauer_minuten} Minuten, Betrag: ${euro(result.gesamtbetrag)}`);
```

Ferner in `mapBikeType(bike)` die Erkennung auf `typ_code` umstellen, weil die Sicht diesen jetzt sauber liefert:

```javascript
    function mapBikeType(bike) {
        switch (bike.typ_code) {
            case 'EBIKE': return 'ebike';
            case 'CARGO': return 'cargo';
            default:      return 'city';
        }
    }
```

Und die erfundene Akkuanzeige durch den echten Wert ersetzen — bisher stand dort `Math.floor(Math.random() * 100)`:

```javascript
            const akkustand = bike.akkustand_prozent;   // NULL bei Raedern ohne Akku
```

Die Stellen, die `simulatedBattery` verwenden, auf `akkustand` umstellen und bei `null` keine Akkuanzeige rendern.

- [ ] **Schritt 7: Statische Prüfung**

```bash
node --check src/config.js && node --check src/supabase.js && node --check src/auth.js && node --check src/script.js && echo "Syntax ok"
```

Erwartet: `Syntax ok`.

```bash
grep -nE "from\('(?!v_)" src/supabase.js || echo "ok: es wird nur aus v_-Sichten gelesen"
grep -n "fn_ausleihe\|cityBikesRental\|Math.random" src/*.js || echo "ok: keine Altaufrufe, keine erfundenen Werte"
```

Erwartet: beide Zeilen melden `ok`. Unterstützt das vorhandene `grep` keine Lookaheads, stattdessen `grep -n "\.from(" src/supabase.js` verwenden und die Trefferliste von Hand prüfen — jede Quelle muss mit `v_` beginnen.

- [ ] **Schritt 8: Commit**

```bash
git add src/config.js src/supabase.js src/auth.js src/script.js src/index.html
git commit -m "feat: Website liest aus Sichten und schreibt ueber api-Funktionen"
```

---

### Aufgabe 16: Verifikation im Browser

Ohne diese Aufgabe ist nur belegt, dass die Datenbank stimmt — nicht, dass die Anwendung funktioniert.

**Dateien:**
- Anlegen: `doku/verifikation/2026-08-22-e2e-protokoll.md`
- Anlegen: `doku/verifikation/*.png` (Belegbilder)

**Schnittstellen:** keine neuen. Diese Aufgabe prüft ausschließlich.

- [ ] **Schritt 1: Seite lokal ausliefern**

```bash
python3 -m http.server 8765 --directory src
```

Im Hintergrund laufen lassen und im Browser `http://localhost:8765` öffnen.

- [ ] **Schritt 2: Öffentliche Ansicht prüfen (abgemeldet)**

Prüfen und je ein Bildschirmfoto ablegen:

| Prüfpunkt | Erwartung |
|---|---|
| Kennzahlenleiste | Vier Kacheln, „Stationen" zeigt **13** (nicht `-`) |
| So einfach geht's | Drei Karten mit Nummer, Symbol, Titel, Text |
| Preismodell | Drei Karten mit den Beträgen 3,10 / 4,00 / 5,00 Euro je 30 Minuten und je drei Merkmalen |
| Karte | 13 Stationsmarker, Fahrradmarker, Filter wirken |
| Häufige Fragen | Vier aufklappbare Einträge |
| Browserkonsole | Keine Fehlermeldung |

Die Beträge ergeben sich aus `startgebuehr + 30 × preis_pro_minute`: City 0,10 + 3,00 = 3,10; E-Bike 1,00 + 3,00 = 4,00; Cargo 2,00 + 3,00 = 5,00.

- [ ] **Schritt 3: Registrierung und Anmeldung prüfen**

Mit einer Testadresse registrieren, danach in der Datenbank nachsehen:

```bash
python3 -c "
import sys; sys.path.insert(0, 'db')
from run import verbinde
c = verbinde(); cur = c.cursor()
cur.execute(\"select kunde_id, kundennummer, email, auth_uid is not null as verknuepft from velocity.kunde order by kunde_id desc limit 3\")
for r in cur.fetchall(): print(r)
"
```

Erwartet: der neue Kunde erscheint mit gesetzter `auth_uid` und einer Kundennummer im Format `K-######`.

- [ ] **Schritt 4: Ausleihe starten und beenden**

Ein Rad auf der Karte auswählen, Fahrt starten, Banner mit laufender Zeit prüfen, Fahrt beenden. Danach die Abrechnung ansehen:

```bash
python3 -c "
import sys; sys.path.insert(0, 'db')
from run import verbinde
c = verbinde(); cur = c.cursor()
cur.execute('''
  select a.ausleihe_id, a.dauer_minuten, ea.code, p.menge, p.einzelbetrag, p.betrag
    from velocity.ausleihe a
    join velocity.entgeltposition p on p.ausleihe_id = a.ausleihe_id
    join velocity.entgeltart ea on ea.entgeltart_id = p.entgeltart_id
   where a.ausleihe_id = (select max(ausleihe_id) from velocity.ausleihe)
   order by p.sortierung''')
for r in cur.fetchall(): print(r)
"
```

Erwartet: mindestens die Positionen `STARTGEBUEHR` und `ZEITENTGELT`; die Summe der Beträge entspricht dem in der Oberfläche angezeigten Betrag.

- [ ] **Schritt 5: Zugriffsschutz aus dem Browser prüfen**

In der Browserkonsole der abgemeldeten Seite:

```javascript
await supabaseClient.from('kunde').select('*').limit(1)
```

Erwartet: ein Fehlerobjekt, **keine** Daten. Das Ergebnis als Bildschirmfoto ablegen — es ist zugleich das Belegbild für die Sicherheitsfolien.

- [ ] **Schritt 6: Protokoll schreiben**

`doku/verifikation/2026-08-22-e2e-protokoll.md` mit einer Tabelle Prüfpunkt / Erwartung / Ergebnis / Belegbild. Fehlgeschlagene Punkte werden aufgeführt und behoben, nicht weggelassen.

- [ ] **Schritt 7: Server beenden und Commit**

```bash
git add doku/verifikation
git commit -m "test: Ende-zu-Ende-Verifikation der umgestellten Website"
```

---

### Aufgabe 17: Altschema absichern

Behebt die Befunde B1 und B2 im Altbestand. Erst nach bestandenem Abgleichsbericht aus Aufgabe 14 ausführen.

**Dateien:**
- Anlegen: `tools/schema_dump.py`
- Anlegen: `db/betrieb/altschema_absichern.sql`
- Anlegen: `doku/verifikation/2026-08-22-sicherung-citybikesrental/` (Sicherungsdateien, nicht committen)

**Schnittstellen:** keine neuen Objekte im Schema `velocity`.

> **Achtung:** Dieser Schritt verändert das Altschema. Er läuft erst, wenn Aufgabe 14 vollständig abgeschlossen und der Abgleichsbericht ohne unerklärte Abweichung ist. Die Sicherung in Schritt 2 ist Voraussetzung, nicht Kür.

- [ ] **Schritt 1: Sicherungswerkzeug schreiben**

`pg_dump` ist auf dem Rechner **nicht** installiert. Statt eine Abhängigkeit einzuführen, sichern wir Struktur und Daten über die vorhandene Verbindung. Das ist kein vollwertiger `pg_dump` — es genügt aber, um Struktur und Inhalt einer Lehrinstanz wiederherstellen zu können, und das wird in der Sicherung auch so vermerkt.

`tools/schema_dump.py`:

```python
#!/usr/bin/env python3
"""Sichert ein Schema als DDL-Uebersicht und CSV-Dateien je Tabelle.

Aufruf:
    python3 tools/schema_dump.py cityBikesRental doku/verifikation/sicherung

Kein Ersatz fuer pg_dump: gesichert werden Tabellenstruktur, Constraints,
Indizes, Funktionsdefinitionen und der Tabelleninhalt als CSV. Nicht
gesichert werden Rechte, Eigentumsverhaeltnisse und Sequenzstaende.
"""
from __future__ import annotations

import csv
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent / "db"))

from run import verbinde  # noqa: E402


def main(argv: list[str]) -> int:
    if len(argv) != 2:
        print(__doc__)
        return 2
    schema, ziel_name = argv
    ziel = pathlib.Path(ziel_name)
    ziel.mkdir(parents=True, exist_ok=True)

    conn = verbinde()
    cur = conn.cursor()

    cur.execute(
        """
        select c.relname
          from pg_class c join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = %s and c.relkind = 'r'
         order by c.relname
        """,
        (schema,),
    )
    tabellen = [r[0] for r in cur.fetchall()]

    # Struktur
    struktur = ziel / "struktur.sql"
    with struktur.open("w", encoding="utf-8") as f:
        f.write(f"-- Strukturuebersicht des Schemas {schema}\n")
        f.write("-- Erzeugt von tools/schema_dump.py. Kein vollwertiger pg_dump:\n")
        f.write("-- Rechte, Eigentuemer und Sequenzstaende sind NICHT enthalten.\n\n")

        cur.execute(
            """
            select table_name, ordinal_position, column_name, data_type,
                   is_nullable, column_default
              from information_schema.columns
             where table_schema = %s
             order by table_name, ordinal_position
            """,
            (schema,),
        )
        f.write("-- ===== Spalten =====\n")
        for zeile in cur.fetchall():
            f.write("-- " + " | ".join("" if x is None else str(x) for x in zeile) + "\n")

        cur.execute(
            """
            select conrelid::regclass::text, conname, pg_get_constraintdef(oid)
              from pg_constraint
             where connamespace = (select oid from pg_namespace where nspname = %s)
             order by 1, 2
            """,
            (schema,),
        )
        f.write("\n-- ===== Constraints =====\n")
        for tabelle, name, definition in cur.fetchall():
            f.write(f"alter table {tabelle} add constraint {name} {definition};\n")

        cur.execute("select indexdef from pg_indexes where schemaname = %s order by indexname", (schema,))
        f.write("\n-- ===== Indizes =====\n")
        for (definition,) in cur.fetchall():
            f.write(definition + ";\n")

        cur.execute(
            """
            select pg_get_functiondef(p.oid)
              from pg_proc p
             where p.pronamespace = (select oid from pg_namespace where nspname = %s)
             order by p.proname
            """,
            (schema,),
        )
        f.write("\n-- ===== Funktionen =====\n")
        for (definition,) in cur.fetchall():
            f.write(definition + "\n\n")

    # Daten
    for tabelle in tabellen:
        pfad = ziel / f"{tabelle}.csv"
        cur.execute(f'select * from "{schema}"."{tabelle}"')
        spalten = [d[0] for d in cur.description]
        with pfad.open("w", encoding="utf-8", newline="") as f:
            schreiber = csv.writer(f)
            schreiber.writerow(spalten)
            schreiber.writerows(cur.fetchall())
        print(f"gesichert  {pfad} ({cur.rowcount} Zeilen)")

    conn.close()
    print(f"\nStruktur: {struktur}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
```

- [ ] **Schritt 2: Sicherung ziehen und prüfen**

```bash
python3 tools/schema_dump.py cityBikesRental doku/verifikation/2026-08-22-sicherung-citybikesrental
wc -l doku/verifikation/2026-08-22-sicherung-citybikesrental/*.csv
```

Erwartet: `kunde.csv` mit 1016 Zeilen (1015 plus Kopfzeile), `fahrrad.csv` mit 353, `station.csv` mit 14, `ausleihe.csv` mit 33. Stimmen die Zahlen nicht, **nicht** weitermachen.

Die Sicherung wird **nicht** committet — sie enthält die Klartextpasswörter. In `.gitignore` ergänzen:

```
doku/verifikation/*sicherung*/
```

- [ ] **Schritt 3: Absicherungsskript schreiben**

`db/betrieb/altschema_absichern.sql`:

```sql
-- =====================================================================
-- Altschema cityBikesRental absichern
--
-- Zweck:      Schliesst den anonymen Vollzugriff und entfernt die
--             Klartextpasswoerter. Struktur und Datensaetze bleiben
--             unveraendert erhalten und weiter vorfuehrbar.
-- Voraussetzung: Sicherung durch tools/schema_dump.py gezogen und
--             geprueft; Abgleichsbericht der Uebernahme ohne unerklaerte
--             Abweichung.
-- Ruecknahme: Aus der Sicherung wiederherstellen. Die entfernten
--             Policies werden bewusst NICHT wieder angelegt.
-- =====================================================================

-- 1 Alle Policies entfernen, die anon Schreib- oder Lesezugriff geben.
do $$
declare
  v_p record;
begin
  for v_p in
    select schemaname, tablename, policyname, roles::text as rollen, cmd
      from pg_policies
     where schemaname = 'cityBikesRental'
  loop
    if v_p.rollen like '%anon%' then
      execute format('drop policy %I on %I.%I',
                     v_p.policyname, v_p.schemaname, v_p.tablename);
      raise notice 'Policy entfernt: %.% -> %', v_p.schemaname, v_p.tablename, v_p.policyname;
    end if;
  end loop;
end $$;

-- 2 Auch die Policies fuer authenticated mit USING (true) auf
--   personenbezogenen Tabellen entfernen.
drop policy if exists "Kunden verwalten" on "cityBikesRental".kunde;

-- 3 Rechte zurueckziehen.
revoke all on all tables    in schema "cityBikesRental" from anon, authenticated;
revoke all on all functions in schema "cityBikesRental" from anon, authenticated;
revoke usage on schema "cityBikesRental" from anon, authenticated;

-- 4 Klartextpasswoerter entfernen. Die Spalte bleibt bestehen, damit
--   die Struktur unveraendert vorfuehrbar ist.
update "cityBikesRental".kunde set passwort_hash = '' where passwort_hash <> '';

-- 5 Ergebnis nachweisen.
select 'verbliebene Policies mit anon' as pruefung, count(*) as anzahl
  from pg_policies
 where schemaname = 'cityBikesRental' and roles::text like '%anon%'
union all
select 'nicht leere Passwortfelder', count(*)
  from "cityBikesRental".kunde where passwort_hash <> ''
union all
select 'Kundensaetze unveraendert vorhanden', count(*)
  from "cityBikesRental".kunde;
```

- [ ] **Schritt 4: Absicherung ausführen und Ergebnis prüfen**

```bash
python3 -c "
import sys, pathlib; sys.path.insert(0, 'db')
from run import verbinde
c = verbinde(); cur = c.cursor()
cur.execute(pathlib.Path('db/betrieb/altschema_absichern.sql').read_text(encoding='utf-8'))
for r in cur.fetchall(): print(r)
c.commit()
"
```

Erwartet: `('verbliebene Policies mit anon', 0)`, `('nicht leere Passwortfelder', 0)`, `('Kundensaetze unveraendert vorhanden', 1015)`.

- [ ] **Schritt 5: Von außen gegenprüfen**

```bash
python3 -c "
import urllib.request, urllib.error, pathlib
key = [l.split('=',1)[1].strip() for l in pathlib.Path('.env').read_text().splitlines() if l.startswith('SUPABASE_ANON_KEY')][0]
r = urllib.request.Request('https://supabase.butscher.cloud/rest/v1/kunde?select=email&limit=1',
                           headers={'apikey': key, 'Accept-Profile': 'cityBikesRental'})
try:
    with urllib.request.urlopen(r, timeout=20) as a:
        print('FEHLER: HTTP', a.status, a.read(200).decode())
except urllib.error.HTTPError as e:
    print('ok: kein Zugriff, HTTP', e.code)
"
```

Erwartet: `ok: kein Zugriff, HTTP 401` oder `403`. Ein `HTTP 200` mit Daten bedeutet, dass die Absicherung nicht gegriffen hat.

- [ ] **Schritt 6: Commit**

```bash
git add tools/schema_dump.py db/betrieb/altschema_absichern.sql .gitignore
git commit -m "chore: Altschema cityBikesRental absichern und Sicherungswerkzeug"
```

---

### Aufgabe 18: Dokumentation des Datenmodells

**Dateien:**
- Anlegen: `tools/mermaid_check.mjs`, `package.json`
- Anlegen: `doku/datenmodell/01-anforderungen.md`
- Anlegen: `doku/datenmodell/02-konzeptionelles-modell.md`
- Anlegen: `doku/datenmodell/03-normalisierung.md`
- Anlegen: `doku/datenmodell/04-relationales-modell.md`
- Anlegen: `doku/datenmodell/05-physisches-modell.md`
- Erzeugen: `doku/datenmodell/06-data-dictionary.md`
- Anlegen: `doku/datenmodell/07-sicherheitskonzept.md`
- Anlegen: `doku/datenmodell/A1-datenuebernahme.md`
- Vorhanden: `doku/datenmodell/erd/erd-kern.mmd`, `erd-abrechnung.mmd`, `erd-inhalte.mmd`, `erd-wawi.mmd`

**Schnittstellen:** keine Codeschnittstellen. Aufgabe 19 zieht ihre Inhalte aus diesen Dateien.

- [ ] **Schritt 1: Mermaid-Prüfwerkzeug einrichten**

```bash
npm init -y >/dev/null && npm install --no-audit --no-fund mermaid@11
```

`tools/mermaid_check.mjs`:

```javascript
// Prueft Mermaid-Quellen gegen den Parser.
// Aufruf: node tools/mermaid_check.mjs doku/datenmodell/erd/*.mmd
import fs from 'node:fs';
import mermaid from 'mermaid';

const dateien = process.argv.slice(2);
if (dateien.length === 0) {
  console.error('Keine Dateien angegeben.');
  process.exit(2);
}

let fehler = 0;
for (const datei of dateien) {
  try {
    await mermaid.parse(fs.readFileSync(datei, 'utf8'));
    console.log('OK    ' + datei);
  } catch (e) {
    fehler++;
    console.log('FEHLER ' + datei + '\n  ' + String(e.message || e).split('\n').slice(0, 6).join('\n  '));
  }
}
process.exit(fehler ? 1 : 0);
```

In `.gitignore` ist `node_modules/` bereits eingetragen.

- [ ] **Schritt 2: Diagramme prüfen**

```bash
node tools/mermaid_check.mjs doku/datenmodell/erd/*.mmd; echo "Rückgabewert: $?"
```

Erwartet: viermal `OK`, Rückgabewert 0.

- [ ] **Schritt 3: Data Dictionary erzeugen**

```bash
python3 -c "
import sys, pathlib; sys.path.insert(0, 'db')
from run import verbinde
c = verbinde(); cur = c.cursor()
cur.execute('''select objekt_art, tabelle, spalte, datentyp, nullbar, vorgabe, beschreibung, tabellenbeschreibung
                 from velocity.v_data_dictionary order by objekt_art desc, tabelle, position''')
zeilen = cur.fetchall()
aus = ['# Data Dictionary — Schema velocity', '',
       'Erzeugt aus dem Systemkatalog über velocity.v_data_dictionary. Nicht von Hand pflegen.', '']
aktuell = None
for art, tab, sp, typ, nullbar, vorgabe, besch, tabbesch in zeilen:
    if tab != aktuell:
        aktuell = tab
        aus += ['', f'## {tab} ({art})', '', (tabbesch or ''), '',
                '| Spalte | Datentyp | NULL | Vorgabe | Beschreibung |',
                '|---|---|---|---|---|']
    aus.append(f'| \`{sp}\` | \`{typ}\` | {\"ja\" if nullbar else \"nein\"} | ' +
               (f'\`{vorgabe}\`' if vorgabe else '') + f' | {besch or \"\"} |')
pathlib.Path('doku/datenmodell/06-data-dictionary.md').write_text('\n'.join(aus) + '\n', encoding='utf-8')
print('geschrieben:', len(zeilen), 'Zeilen')
"
```

Erwartet: über 200 Zeilen, die Datei enthält keine leeren Beschreibungsspalten.

- [ ] **Schritt 4: Die sechs Textdokumente schreiben**

Jede Datei folgt derselben Form: kurze Einordnung, dann Inhalt, dann ein Abschnitt „Was daran didaktisch zählt".

| Datei | Inhalt |
|---|---|
| `01-anforderungen.md` | Fallbeispiel VeloCity, Geschäftsmodell, Glossar (Ausleihe, Station, Tarif, Freiminuten, Entgeltposition …), die zehn Geschäftsregeln GR1 bis GR10 aus Abschnitt 6 der Spec, Mengengerüst |
| `02-konzeptionelles-modell.md` | ERM: Entität, Attribut, Beziehung, Kardinalität; die Bereichsübersicht und die drei Detail-ERDs eingebunden über ```` ```mermaid ````-Blöcke mit dem Inhalt der `.mmd`-Dateien; je Bereich ein Absatz zur Begründung |
| `03-normalisierung.md` | Funktionale Abhängigkeiten der Kernrelationen; 1NF, 2NF, 3NF am Beispiel einer bewusst denormalisierten Ausgangstabelle `ausleihe_flach`, aus der `ausleihe`, `nutzungspreis` und `entgeltposition` entstehen; Exkurs `plz → ort` und warum die Abhängigkeit in Deutschland nicht sauber funktional ist; Grenzen der Normalisierung |
| `04-relationales-modell.md` | Abbildungsregeln ERM → Relationenmodell; das vollständige Relationenschema in Textnotation, Primärschlüssel unterstrichen dargestellt als `__spalte__`, Fremdschlüssel mit `→ zieltabelle` |
| `05-physisches-modell.md` | Datentypwahl und ihre Begründung; Constraints als Geschäftsregeln; `EXCLUDE USING gist` und warum `btree_gist` nötig ist; `GENERATED`-Spalten; partielle Unique-Indizes; warum das Mindestalter nicht als `CHECK` mit `current_date` umgesetzt ist; Indexstrategie |
| `07-sicherheitskonzept.md` | Bedrohungsmodell (der anon-Key ist öffentlich); *default deny*; Sichten mit Definer-Rechten gegen `security_invoker`; RLS-Policies im Überblick; warum kein Trigger auf `auth.users`; das Prüfskript und sein Ergebnis |
| `A1-datenuebernahme.md` | Anhang: Übernahmeregeln, Schlüsselzuordnung über Fachschlüssel, Protokoll, Abgleichsbericht, die bekannten Grenzen |

- [ ] **Schritt 5: Querprüfung**

```bash
node tools/mermaid_check.mjs doku/datenmodell/erd/*.mmd
grep -c "^| " doku/datenmodell/06-data-dictionary.md
ls doku/datenmodell/*.md | wc -l
```

Erwartet: viermal `OK`, über 200 Tabellenzeilen im Dictionary, acht Markdown-Dateien.

- [ ] **Schritt 6: Commit**

```bash
git add tools/mermaid_check.mjs package.json package-lock.json doku/datenmodell
git commit -m "docs: Dokumentation des Datenmodells mit validierten ERDs"
```

---

### Aufgabe 19: Foliendeck

**Dateien:**
- Anlegen: `slides/velocity-datenbankentwurf.pptx`
- Anlegen: `slides/velocity-datenbankentwurf.pdf`
- Anlegen: `slides/README.md` (Gliederung, Quellenverweise je Folie)

**Schnittstellen:** keine. Bezieht Inhalte aus `doku/datenmodell/` und `db/aufbau/`.

- [ ] **Schritt 1: Skill laden**

Die Skill `/bint-folie` aufrufen. Sie liefert Kachelraster, Farbpalette, Textbudget und den PDF-Export der THWS Business School. Ihre Vorgaben gehen den folgenden Schritten vor, wo sie sich widersprechen.

- [ ] **Schritt 2: Gliederung anlegen**

`slides/README.md` mit der Folienliste, je Folie: Nummer, Titel, Kernaussage, Quelle (Datei aus `doku/` oder `db/aufbau/`).

| Block | Folien | Inhalt |
|---|---|---|
| 1 Fallstudie | 1–4 | VeloCity, Geschäftsmodell, Auftrag, Lernziele |
| 2 Anforderungsanalyse | 5–9 | Fachkonzept, Glossar, Geschäftsregeln GR1–GR10, Mengengerüst |
| 3 Konzeptioneller Entwurf | 10–19 | ERM-Notation, Kardinalitäten, Schlüsselarten; Bereiche A–F je eine Folie mit ERD-Ausschnitt |
| 4 Normalisierung | 20–24 | Funktionale Abhängigkeiten, 1NF → 2NF → 3NF an `ausleihe_flach`, Exkurs `plz → ort`, Grenzen |
| 5 Logischer Entwurf | 25–29 | Abbildungsregeln, Relationenschema, Fremdschlüssel, Referenzielle Integrität |
| 6 Physischer Entwurf | 30–34 | Datentypen, Constraints als Geschäftsregeln, `EXCLUDE`, `GENERATED`, Indizes |
| 7 Implementierung | 35–38 | Schema anlegen, Sichten als Vertrag, Funktionen, Data Dictionary aus dem Katalog |
| 8 Sicherheit | 39–42 | Der anon-Key ist öffentlich; *default deny*; `FOR ALL TO anon USING (true)` als Antipattern; Sichten gegen RPC |
| 9 Anwendung anbinden | 43–45 | supabase-js, lesen über Sichten, schreiben über RPC |
| 10 Ausblick | 46–47 | Was die Warenwirtschaft ergänzt |

- [ ] **Schritt 3: Demo-Tabelle für die Sicherheitsfolien anlegen**

Der anon-Zugriff wird nicht am echten Bestand vorgeführt, sondern an einer eigens dafür angelegten Tabelle mit erfundenen Daten. Als Datei `db/betrieb/demo_antipattern.sql`:

```sql
-- =====================================================================
-- Demo fuer die Sicherheitsfolien: der haeufigste Supabase-Anfaengerfehler
--
-- Zweck:      Studierende duerfen diese Tabelle live mit dem anon-Key
--             auslesen. Die Daten sind frei erfunden.
-- Ruecknahme: DROP SCHEMA velocity_demo CASCADE;
-- =====================================================================
create schema if not exists velocity_demo;

create table if not exists velocity_demo.kunde_unsicher (
  id      bigint generated always as identity primary key,
  name    text not null,
  email   text not null,
  notiz   text
);

insert into velocity_demo.kunde_unsicher (name, email, notiz)
select 'Erfundene Person ' || i,
       'person' || i || '@beispiel.invalid',
       'Frei erfundener Datensatz fuer die Vorlesung'
  from generate_series(1, 25) i
 where not exists (select 1 from velocity_demo.kunde_unsicher);

alter table velocity_demo.kunde_unsicher enable row level security;

-- GENAU DAS ist der Fehler, der in der Vorlesung gezeigt wird:
drop policy if exists "alles fuer alle" on velocity_demo.kunde_unsicher;
create policy "alles fuer alle" on velocity_demo.kunde_unsicher
  for all to anon, authenticated using (true) with check (true);

grant usage on schema velocity_demo to anon, authenticated;
grant select, insert, update, delete on velocity_demo.kunde_unsicher to anon, authenticated;
```

Anwenden und das Schema für PostgREST freigeben:

```bash
python3 db/run.py db/betrieb/demo_antipattern.sql
python3 -c "
import sys; sys.path.insert(0, 'db')
from run import verbinde
c = verbinde(); cur = c.cursor()
cur.execute(\"alter role authenticator set pgrst.db_schemas = 'public, velocity, velocity_demo, cityBikesRental, WorldHappiness, Rainforest, superstore, apl, qs'\")
cur.execute(\"notify pgrst, 'reload config'\")
c.commit(); print('velocity_demo freigegeben')
"
```

- [ ] **Schritt 4: Deck bauen**

Nach den Vorgaben aus `/bint-folie`. Für jede Folie gilt:

- Eine Kernaussage je Folie, im Titel formuliert.
- Codeausschnitte gekürzt auf das, was die Aussage trägt — nie eine ganze Datei.
- ERD-Ausschnitte aus den `.mmd`-Quellen gerendert, nie neu gezeichnet.
- Vortragstext im Notizenfeld, mindestens drei Sätze.
- Am Fuß der Folie der Verweis auf die Quelldatei, etwa `db/aufbau/0004_bereich_c_tarif_und_preis.sql`.

- [ ] **Schritt 5: PDF exportieren und Sichtprüfung**

Über den in `/bint-folie` vorgesehenen Weg. Danach jede Seite ansehen und prüfen: kein überlaufender Text, keine abgeschnittenen Diagramme, keine leeren Platzhalter.

- [ ] **Schritt 6: Commit**

```bash
git add slides db/betrieb/demo_antipattern.sql
git commit -m "docs: Foliendeck Datenbankentwurf am Fallbeispiel VeloCity"
```

---

## Abnahme der Phase 1

Erst wenn alle folgenden Befehle ohne Fehler durchlaufen, ist Phase 1 fertig und der Auftraggeber wird um Rückmeldung gebeten.

```bash
python3 db/run.py db/aufbau/*.sql && python3 db/run.py db/aufbau/*.sql
```

```bash
python3 db/test.py; echo "Rückgabewert: $?"
```

```bash
python3 tools/rest_security_check.py; echo "Rückgabewert: $?"
```

```bash
node tools/mermaid_check.mjs doku/datenmodell/erd/*.mmd; echo "Rückgabewert: $?"
```

Dazu, nicht automatisierbar: das Ende-zu-Ende-Protokoll aus Aufgabe 16 liegt vor und weist alle Prüfpunkte als bestanden aus, und das Foliendeck ist als PDF exportiert und durchgesehen.

Danach: Rückmeldung des Auftraggebers einholen, **bevor** Phase 2 (Warenwirtschaft) beginnt.
