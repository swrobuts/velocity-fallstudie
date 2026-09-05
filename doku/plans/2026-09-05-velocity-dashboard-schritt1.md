# Kundendashboard Schritt 1 — Umsetzungsplan

> **Für agentische Bearbeiter:** ERFORDERLICHER UNTER-SKILL: `superpowers:subagent-driven-development`
> (empfohlen) oder `superpowers:executing-plans`. Die Schritte tragen Kästchen (`- [ ]`).

**Ziel:** Ein angemeldeter Kunde sieht auf `bikes.butscher.cloud` seine eigenen Kilometer,
sein eingespartes CO₂, seine Ausgaben, den Verlauf über die Monate und seinen Rang — und
Studierende kommen ohne Mail-Registrierung über einen Knopf hinein.

**Aufbau:** Eine schrankenlose Basissicht `v_fahrt_kennzahl` trägt die Kilometer- und
CO₂-Herleitung, die heute dreifach im Schema steht. Drei Sichten der Warenwirtschaft und drei
neue Kundensichten lesen aus ihr. Die Oberfläche rechnet nichts, sie zeigt nur, was die Sichten
liefern.

**Technik:** PostgreSQL 15 auf Supabase, PostgREST, pgTAP; im Browser reines HTML/CSS/JS ohne
Bibliothek, Diagramme als Inline-SVG.

**Spezifikation:** `doku/specs/2026-09-05-velocity-dashboard-design.md` — mitlesen, der Plan
argumentiert aus ihr.

## Weltweite Vorgaben

Diese Punkte gelten für **jede** Aufgabe und werden in keiner einzeln wiederholt.

- **Deutsche Texte mit echten Umlauten** (ü ö ä ß). Bezeichner bleiben ASCII.
- **Nüchterner Ton.** Keine Bilder, keine Personifizierung, keine Pointen — auch nicht in
  Kommentaren.
- **Die Kundenwebsite ist einsprachig deutsch.** Kein `data-i18n`, keine Übersetzungstabelle.
  Die sechs Sprachen liegen allein in `wawi/`.
- **Kein `innerHTML` mit Daten aus der Datenbank.** `textContent` oder
  `document.createElement`.
- **Die Oberfläche liest ausschließlich `v_*`-Sichten und schreibt ausschließlich über
  `api_*`-Funktionen.** Abnahmeschritt 35 prüft das.
- **Keine Zugangsdaten im Quelltext.** `src/config.js` bekommt die Felder leer; die Werte
  trägt der Betreiber ein. Das gilt auch für ein absichtlich öffentliches Kennwort.
- **Die Aufbaukette `db/aufbau/*.sql` muss zweimal hintereinander fehlerfrei laufen.**
  Abnahmeschritt 2. Jede Änderung dort wird gegen diesen Lauf geprüft, nicht gegen einen
  einzelnen.
- **Jede neue Behauptung bekommt eine Prüfung, und jede Prüfung eine Gegenprobe.** Eine
  Prüfung, von der nicht gezeigt wurde, dass sie rot werden kann, zählt nicht.
- **Schreibende Läufe gegen die Produktivdatenbank nur mit ausdrücklicher Zustimmung des
  Betreibers.** Vorher ein Abzug: `bash tools/velocity_sichern.sh`.
- Datenbank erreichbar über
  `ssh bot.butscher.cloud "docker exec -i supabase-db psql -U postgres -d postgres"`.
- Testreihe: `python3 db/test.py`. Abnahme: `bash tools/abnahme.sh`.

## Dateien

| Datei | Zuständig für |
|---|---|
| `db/aufbau/0018_wawi_sichten.sql` | **ändern** — Basissicht `v_fahrt_kennzahl` neu, direkt hinter `fn_luftlinie_km` (Zeile 81); die drei bestehenden Sichten lesen künftig aus ihr |
| `db/aufbau/0025_kundenkennzahlen.sql` | **neu** — die drei Kundensichten. Eigene Datei, weil sie nach 0018 laufen muss |
| `db/betrieb/demokonto_website.sql` | **neu** — K-000001 auf Clara Fake umbenennen und mit dem Anmeldekonto verknüpfen |
| `db/tests/t0025_kennzahl_umstellung.sql` | **neu** — die eingefrorenen Vergleichswerte |
| `db/tests/t0026_kundenkennzahlen.sql` | **neu** — Rang, Filterung, Summenkonsistenz |
| `src/config.js` | **ändern** — zwei leere Felder für den Demozugang |
| `src/index.html` | **ändern** — Dashboard-Abschnitt, Demoknopf, Hinweis |
| `src/dashboard.js` | **neu** — Laden und Zeichnen. Eigene Datei: `script.js` hat 2 618 Zeilen |
| `src/style.css` | **ändern** — Gestaltung des Dashboards |
| `TESTEN.md` | **ändern** — Zahl der pgTAP-Tests |

### Warum die Basissicht nicht nach `0010_sichten.sql` kommt

Die Spezifikation nannte 0010. Nachgemessen am 05.09.2026 geht das nicht: `fn_luftlinie_km`
wird erst in **0018** definiert (Zeile 81) und die Tabelle `rechenannahme` erst in **0016**.
Eine Sicht kann nur lesen, was zum Zeitpunkt ihrer Anlage existiert. Die Basissicht kommt
deshalb an den **Anfang von 0018**, hinter die Funktion und vor die drei Sichten, die sie
lesen (Zeilen 710, 809, 1355). Die Kundensichten brauchen die Basissicht und kommen in eine
neue Datei **nach** 0018.

---

### Aufgabe 1: Die Vergleichswerte einfrieren, bevor irgendetwas umgestellt wird

Der Umbau von drei Sichten ist der einzige riskante Teil des Vorhabens. Ein Vergleich, der
erst NACH dem Umbau entsteht, misst den Umbau gegen sich selbst und ist wertlos. Diese
Aufgabe legt deshalb zuerst das Netz und ändert **keine Zeile** an den Sichten.

**Dateien:**
- Neu: `db/tests/t0025_kennzahl_umstellung.sql`

**Schnittstellen:**
- Verbraucht: `velocity_test.fixture_mitarbeiter(p_suffix text) returns uuid` aus
  `db/tests/t0018_wawi_sichten.sql` — legt einen Mitarbeiter mit allen Rollen an und setzt
  `request.jwt.claims`. Ohne diese Vorrichtung liefern die drei Sichten null Zeilen, weil
  ihre Rollenschranke greift.
- Liefert: `velocity_test.test_um_kennzahlen_unveraendert()` — die Zusicherung, die in
  Aufgabe 3 grün bleiben muss.

- [ ] **Schritt 1: Die heutigen Werte selbst nachmessen**

Nicht aus diesem Plan abschreiben, sondern messen — steht in der Datenbank ein anderer Stand,
sind die Zahlen unten falsch und die eingefrorenen Werte müssen die gemessenen sein.

```bash
ssh bot.butscher.cloud "docker exec -i supabase-db psql -U postgres -d postgres -tA -F' | '" << 'SQL'
begin;
set search_path = velocity_test, velocity, extensions, public;
select velocity_test.fixture_mitarbeiter('einfrieren');
select 'km_co2 Zeilen', count(*)::text from velocity.v_wawi_km_co2
union all select 'km_co2 Summe kilometer', sum(kilometer)::text from velocity.v_wawi_km_co2
union all select 'km_co2 Summe co2_kg', sum(co2_ersparnis_kg)::text from velocity.v_wawi_km_co2
union all select 'km_co2 Summe fahrten', sum(fahrten)::text from velocity.v_wawi_km_co2
union all select 'fahrt_km Zeilen', count(*)::text from velocity.v_wawi_fahrt_km
union all select 'fahrt_km Summe km', round(sum(kilometer),2)::text from velocity.v_wawi_fahrt_km
union all select 'je_tag_rad Zeilen', count(*)::text from velocity.v_wawi_fahrten_je_tag_rad
union all select 'je_tag_rad Summe km', round(sum(kilometer),2)::text from velocity.v_wawi_fahrten_je_tag_rad;
rollback;
SQL
```

Gemessen am 05.09.2026:

| | |
|---|---|
| `v_wawi_km_co2` | 47 Zeilen, Σ kilometer 49995.4, Σ co2_ersparnis_kg 6612.24, Σ fahrten 12052 |
| `v_wawi_fahrt_km` | 12052 Zeilen, Σ kilometer 49995.23 |
| `v_wawi_fahrten_je_tag_rad` | 12052 Zeilen, Σ kilometer 49995.23 |

Die 17 Hundertstel Unterschied zwischen 49995.4 und 49995.23 sind **kein Fehler**:
`v_wawi_km_co2` rundet je Monatsgruppe, die beiden anderen je Fahrt. Wer diesen Unterschied
"behebt", bricht die Zusicherung.

- [ ] **Schritt 2: Die Zusicherung schreiben**

Datei `db/tests/t0025_kennzahl_umstellung.sql`:

```sql
-- =====================================================================
-- t0025 Zusicherung fuer die Umstellung auf v_fahrt_kennzahl
--
-- Die Kilometer- und CO2-Herleitung stand am 05.09.2026 dreimal im
-- Schema: in v_wawi_fahrt_km, v_wawi_fahrten_je_tag_rad und
-- v_wawi_km_co2. Sie wird in die Basissicht v_fahrt_kennzahl gezogen,
-- und die drei lesen kuenftig aus ihr.
--
-- Diese Datei entstand VOR dem Umbau und haelt den Stand von vorher
-- fest. Sie ist damit das Einzige, was zeigen kann, dass die
-- Umstellung nichts verschoben hat. Waere sie nach dem Umbau
-- geschrieben worden, wuerde sie den Umbau gegen sich selbst messen.
--
-- Laeuft eine dieser Pruefungen rot, ist die Umstellung schuld, nicht
-- der Test. Die Werte werden NICHT nachgezogen, ohne dass jemand
-- verstanden hat, warum sie sich geaendert haben.
-- =====================================================================
create schema if not exists velocity_test;
set search_path = velocity_test, velocity, extensions, public;

create or replace function velocity_test.test_um_kennzahlen_unveraendert()
returns setof text language plpgsql as $$
declare
  v_zeilen  bigint;
  v_km      numeric;
  v_co2     numeric;
  v_fahrten bigint;
begin
  -- Ohne diese Vorrichtung liefern alle drei Sichten null Zeilen: ihre
  -- Rollenschranke fragt request.jwt.claims, und ohne Anmeldung ist
  -- dort niemand. Ein Test ohne sie waere immer gruen und wertlos.
  perform velocity_test.fixture_mitarbeiter('t0025');

  select count(*), sum(kilometer), sum(co2_ersparnis_kg), sum(fahrten)
    into v_zeilen, v_km, v_co2, v_fahrten
    from velocity.v_wawi_km_co2;

  return next is(v_zeilen, 47::bigint,
                 'v_wawi_km_co2 hat unveraendert 47 Zeilen');
  return next is(v_km, 49995.4::numeric,
                 'v_wawi_km_co2 summiert unveraendert 49995.4 Kilometer');
  return next is(v_co2, 6612.24::numeric,
                 'v_wawi_km_co2 summiert unveraendert 6612.24 kg CO2');
  return next is(v_fahrten, 12052::bigint,
                 'v_wawi_km_co2 zaehlt unveraendert 12052 Fahrten');

  select count(*), round(sum(kilometer), 2) into v_zeilen, v_km
    from velocity.v_wawi_fahrt_km;
  return next is(v_zeilen, 12052::bigint,
                 'v_wawi_fahrt_km hat unveraendert 12052 Zeilen');
  return next is(v_km, 49995.23::numeric,
                 'v_wawi_fahrt_km summiert unveraendert 49995.23 Kilometer');

  select count(*), round(sum(kilometer), 2) into v_zeilen, v_km
    from velocity.v_wawi_fahrten_je_tag_rad;
  return next is(v_zeilen, 12052::bigint,
                 'v_wawi_fahrten_je_tag_rad hat unveraendert 12052 Zeilen');
  return next is(v_km, 49995.23::numeric,
                 'v_wawi_fahrten_je_tag_rad summiert unveraendert 49995.23 Kilometer');
end;
$$;

-- Die Aufteilung nach Verfahren ist der eigentliche Pruefstein: eine
-- verrutschte Fallunterscheidung in der Drei-Fall-Formel laesst die
-- Gesamtsumme fast unveraendert, verschiebt aber die Anteile. Eine
-- Summenpruefung allein wuerde das durchlassen.
create or replace function velocity_test.test_um_verfahren_unveraendert()
returns setof text language plpgsql as $$
begin
  perform velocity_test.fixture_mitarbeiter('t0025v');
  return next results_eq(
    $sql$select verfahren, count(*)::bigint
           from velocity.v_wawi_fahrt_km group by verfahren order by verfahren$sql$,
    $sql$values ('aus_dauer'::text, 0::bigint),
                ('aus_luftlinie'::text, 0::bigint),
                ('gemessen'::text, 0::bigint)$sql$,
    'Die Verteilung auf die drei Schaetzverfahren bleibt unveraendert');
end;
$$;
```

- [ ] **Schritt 3: Die echten Verfahrenszahlen einsetzen**

Die drei Nullen oben sind Absicht: sie zwingen zum Messen. Zahlen holen —

```bash
ssh bot.butscher.cloud "docker exec -i supabase-db psql -U postgres -d postgres -tA -F' | '" << 'SQL'
begin;
set search_path = velocity_test, velocity, extensions, public;
select velocity_test.fixture_mitarbeiter('verfahren');
select verfahren, count(*) from velocity.v_wawi_fahrt_km group by verfahren order by verfahren;
rollback;
SQL
```

— und die drei `0::bigint` durch die gemessenen Werte ersetzen. Die Reihenfolge
`aus_dauer`, `aus_luftlinie`, `gemessen` beibehalten, `results_eq` vergleicht der Reihe nach.

- [ ] **Schritt 4: Die Zusicherung muss JETZT schon grün sein**

Run: `python3 db/test.py 2>&1 | tail -3`
Erwartet: 191 bestandene, 0 fehlgeschlagene Testfunktion(en).

Sie prüft den unveränderten Stand gegen sich selbst — grün ist hier der Beweis, dass die
Werte richtig abgelesen wurden, nicht dass etwas funktioniert. Rot bedeutet: falsch
gemessen, nicht "Umbau kaputt" (es wurde ja noch nichts umgebaut).

- [ ] **Schritt 5: Gegenprobe — kann sie überhaupt rot werden?**

```bash
ssh bot.butscher.cloud "docker exec -i supabase-db psql -U postgres -d postgres -tA" << 'SQL'
begin;
set search_path = velocity_test, velocity, extensions, public;
select plan(8);
-- Eine einzige Fahrt verkuerzen. Aendert die Summe um wenige Kilometer.
update velocity.ausleihe set distanz_km = 0.01
 where ausleihe_id = (select min(ausleihe_id) from velocity.ausleihe
                       where status = 'abgeschlossen' and distanz_km is not null);
select t from velocity_test.test_um_kennzahlen_unveraendert() t;
rollback;
SQL
```

Erwartet: mindestens `not ok` bei den Kilometersummen. Bleibt alles grün, prüft die
Zusicherung nichts und muss repariert werden, bevor es weitergeht.

- [ ] **Schritt 6: Festschreiben**

```bash
git add db/tests/t0025_kennzahl_umstellung.sql TESTEN.md
git commit -m "test(kennzahlen): Vergleichswerte vor der Umstellung einfrieren"
```

`TESTEN.md` Zeile 18 auf die neue Zahl setzen; `python3 tools/readme_pruefen.py` nennt sie.

---

### Aufgabe 2: Die Basissicht `v_fahrt_kennzahl`

Eine Zeile je abgeschlossener Fahrt, mit der Herleitung, die heute dreifach im Schema steht.

**Dateien:**
- Ändern: `db/aufbau/0018_wawi_sichten.sql` — neuer Abschnitt hinter `fn_luftlinie_km`
  (Zeile 81 ff., nach deren `grant`/`revoke`-Block), **vor** Zeile 710
- Ändern: `db/tests/t0018_wawi_sichten.sql` — anhängen

**Schnittstellen:**
- Liefert: `velocity.v_fahrt_kennzahl` mit den Spalten
  `ausleihe_id bigint, kunde_id bigint, fahrrad_id bigint, typ_code text,
  startzeit timestamptz, endzeit timestamptz, dauer_minuten integer, km numeric,
  ist_geschaetzt boolean, verfahren text, co2_ersparnis_g numeric,
  betrag_brutto numeric(10,2)`. Aufgaben 3 und 4 lesen daraus.

- [ ] **Schritt 1: Die Sicht schreiben**

Einfügen in `db/aufbau/0018_wawi_sichten.sql` hinter dem `revoke`/`grant`-Block von
`fn_luftlinie_km`:

```sql
-- =====================================================================
--  BASISSICHT: eine Zeile je abgeschlossener Fahrt
--
--  WARUM ES SIE GIBT
--
--  Die Drei-Fall-Herleitung der Kilometer stand bis zum 05.09.2026
--  DREIMAL in dieser Datei - in v_wawi_fahrt_km, v_wawi_km_co2 und
--  v_wawi_fahrten_je_tag_rad. Der frueher hier stehende Grund war
--  triftig: die drei tragen VERSCHIEDENE Rollenschranken (leitung /
--  leitung+demo / leitung+disposition), und eine Sicht auf eine Sicht
--  mit engerer Schranke haette die engere Schranke geerbt.
--
--  Diese Sicht traegt GAR KEINE Schranke und wird an niemanden
--  vergeben. Eine Sicht laeuft mit den Rechten ihres Eigentuemers
--  (postgres, bypassrls); die drei koennen sie deshalb lesen, ohne
--  etwas zu erben, und behalten ihre eigene Schranke dort, wo sie
--  hingehoert - in ihrer eigenen where-Bedingung.
--
--  KEIN GRANT AN authenticated. Die Zeilen fuehren ausleihe_id,
--  kunde_id und startzeit je Einzelfahrt, also ein Bewegungsprofil -
--  dieselbe Einstufung wie v_wawi_fahrt_km. Gelesen wird sie
--  ausschliesslich mittelbar, ueber die Sichten darueber.
--
--  co2_ersparnis_g IST BEWUSST UNGERUNDET. v_wawi_km_co2 rundet die
--  Monatssumme auf zwei Stellen. Wuerde hier schon je Fahrt gerundet,
--  summierten sich bis zu 12 052 Rundungsfehler auf, und die
--  Monatswerte wichen von den bisherigen ab. Die Zusicherung in
--  t0025 wuerde das melden.
-- =====================================================================
create or replace view velocity.v_fahrt_kennzahl as
select a.ausleihe_id,
       a.kunde_id,
       a.fahrrad_id,
       t.typ_code,
       a.startzeit,
       a.endzeit,
       a.dauer_minuten,
       k.kilometer                          as km,
       k.ist_geschaetzt,
       k.verfahren,
       k.kilometer * (pkw.wert - eigen.wert) as co2_ersparnis_g,
       coalesce((select sum(ep.betrag) from velocity.entgeltposition ep
                  where ep.ausleihe_id = a.ausleihe_id), 0)::numeric(10,2)
                                            as betrag_brutto
  from velocity.ausleihe a
  join velocity.fahrrad       f  on f.fahrrad_id = a.fahrrad_id
  join velocity.fahrradmodell mo on mo.modell_id = f.modell_id
  join velocity.fahrradtyp    t  on t.typ_id     = mo.typ_id
  left join velocity.station s1 on s1.station_id = a.start_station_id
  left join velocity.station s2 on s2.station_id = a.end_station_id
  left join velocity.rechenannahme ra
         on ra.code = 'umwegfaktor' and ra.gueltigkeit @> a.startzeit::date
  left join velocity.rechenannahme tempo
         on tempo.code = 'reisegeschwindigkeit'
        and tempo.gueltigkeit @> a.startzeit::date
  -- Die Luftlinie EINMAL, statt wie bisher bis zu viermal je Zeile in
  -- derselben Sicht. Gleiche Formel, gleiche Argumente; dass sich am
  -- Ergebnis nichts aendert, zeigt t0025.
  cross join lateral (
    select velocity.fn_luftlinie_km(
             coalesce(s1.latitude,  a.start_latitude),
             coalesce(s1.longitude, a.start_longitude),
             coalesce(s2.latitude,  a.end_latitude),
             coalesce(s2.longitude, a.end_longitude)) as luftlinie_km
  ) l
  cross join lateral (
    select
      case
        when a.distanz_km is not null then a.distanz_km
        when l.luftlinie_km = 0 then round(a.dauer_minuten / 60.0 * tempo.wert, 2)
        else round(l.luftlinie_km * ra.wert, 2)
      end                        as kilometer,
      a.distanz_km is null       as ist_geschaetzt,
      case when a.distanz_km is not null then 'gemessen'
           when l.luftlinie_km = 0       then 'aus_dauer'
           else 'aus_luftlinie'
      end                        as verfahren
  ) k
  join velocity.rechenannahme pkw
    on pkw.code = 'co2_pkw' and pkw.gueltigkeit @> a.startzeit::date
  join velocity.rechenannahme eigen
    on eigen.code = case when t.typ_code = 'CITY' then 'co2_rad' else 'co2_ebike' end
   and eigen.gueltigkeit @> a.startzeit::date
 where a.status = 'abgeschlossen'
   and k.kilometer is not null;

comment on view velocity.v_fahrt_kennzahl is
  'Eine Zeile je abgeschlossener Fahrt mit Kilometern, Schätzverfahren, CO2-Ersparnis '
  'in Gramm (ungerundet) und Entgeltsumme. Einzige Stelle im Schema, an der die '
  'Drei-Fall-Herleitung der Strecke steht. Trägt KEINE Rollenschranke und wird an '
  'niemanden vergeben - sie führt ein Bewegungsprofil und wird ausschließlich mittelbar '
  'gelesen, über die Sichten darüber.';

-- Kein grant. Die Zeile steht hier als Absicht, nicht als Versehen:
-- die Vorgabe aus 0011_sicherheit.sql entzieht PUBLIC ohnehin alles,
-- und t0018 prueft, dass hier nie ein grant nachgetragen wird.
revoke all on velocity.v_fahrt_kennzahl from public, anon, authenticated;
```

- [ ] **Schritt 2: Die Aufbaukette zweimal laufen lassen**

```bash
for lauf in 1 2; do
  echo "--- Lauf $lauf ---"
  for f in db/aufbau/*.sql; do
    ssh bot.butscher.cloud "docker exec -i supabase-db psql -U postgres -d postgres -q -v ON_ERROR_STOP=1" < "$f" || { echo "FEHLER in $f"; break 2; }
  done
done
```

Erwartet: beide Läufe ohne Ausgabe einer Fehlermeldung.

- [ ] **Schritt 3: Die Prüfungen schreiben**

Anhängen an `db/tests/t0018_wawi_sichten.sql`:

```sql
create or replace function velocity_test.test_wv_basissicht_form()
returns setof text language plpgsql as $$
begin
  return next has_view('velocity', 'v_fahrt_kennzahl', 'Die Basissicht existiert');
  return next columns_are('velocity', 'v_fahrt_kennzahl',
    array['ausleihe_id','kunde_id','fahrrad_id','typ_code','startzeit','endzeit',
          'dauer_minuten','km','ist_geschaetzt','verfahren','co2_ersparnis_g',
          'betrag_brutto'],
    'Die Basissicht führt genau die zwölf vereinbarten Spalten');
end;
$$;

create or replace function velocity_test.test_wv_basissicht_ohne_recht()
returns setof text language plpgsql as $$
begin
  -- Der eigentliche Schutz dieser Sicht. Sie fuehrt kunde_id und
  -- startzeit je Einzelfahrt; ein grant an authenticated waere das
  -- Bewegungsprofil der gesamten Kundschaft fuer jeden Angemeldeten.
  return next ok(not has_table_privilege('authenticated',
                   'velocity.v_fahrt_kennzahl', 'SELECT'),
                 'authenticated darf die Basissicht nicht lesen');
  return next ok(not has_table_privilege('anon',
                   'velocity.v_fahrt_kennzahl', 'SELECT'),
                 'anon darf die Basissicht nicht lesen');
end;
$$;

create or replace function velocity_test.test_wv_basissicht_nur_abgeschlossen()
returns setof text language plpgsql as $$
begin
  -- Eine laufende Fahrt hat keine Endzeit und keine Entgeltpositionen.
  -- Stuende sie in der Basissicht, zaehlte das Dashboard sie mit und
  -- wiese Kilometer aus, die noch gar nicht gefahren wurden.
  return next is_empty(
    $sql$select f.ausleihe_id from velocity.v_fahrt_kennzahl f
           join velocity.ausleihe a using (ausleihe_id)
          where a.status <> 'abgeschlossen'$sql$,
    'Die Basissicht führt ausschließlich abgeschlossene Fahrten');
  return next is_empty(
    $sql$select ausleihe_id from velocity.v_fahrt_kennzahl where km is null$sql$,
    'Keine Zeile ohne Kilometerwert');
end;
$$;
```

- [ ] **Schritt 4: Testreihe**

Run: `python3 db/test.py 2>&1 | tail -3`
Erwartet: 194 bestandene, 0 fehlgeschlagene.

- [ ] **Schritt 5: Gegenprobe zum Rechteschutz**

```bash
ssh bot.butscher.cloud "docker exec -i supabase-db psql -U postgres -d postgres -tA" << 'SQL'
begin;
set search_path = velocity_test, velocity, extensions, public;
select plan(2);
grant select on velocity.v_fahrt_kennzahl to authenticated;
select t from velocity_test.test_wv_basissicht_ohne_recht() t;
rollback;
SQL
```

Erwartet: `not ok 1`. Bleibt es grün, prüft der Test nichts.

- [ ] **Schritt 6: Festschreiben**

```bash
git add db/aufbau/0018_wawi_sichten.sql db/tests/t0018_wawi_sichten.sql TESTEN.md
git commit -m "feat(kennzahlen): Basissicht v_fahrt_kennzahl"
```

---

### Aufgabe 3: Die drei Sichten der Warenwirtschaft auf die Basissicht umstellen

Hier wird die Dreifachführung aufgelöst. Die Zusicherung aus Aufgabe 1 ist der Maßstab.

**Dateien:**
- Ändern: `db/aufbau/0018_wawi_sichten.sql` — Zeilen 710 ff. (`v_wawi_fahrt_km`),
  809 ff. (`v_wawi_km_co2`), 1355 ff. (`v_wawi_fahrten_je_tag_rad`)

**Schnittstellen:**
- Verbraucht: `velocity.v_fahrt_kennzahl` aus Aufgabe 2.
- Liefert: nichts Neues. **Spaltenlisten und Rollenschranken bleiben Zeichen für Zeichen,
  wie sie sind.**

- [ ] **Schritt 1: `v_wawi_fahrt_km` umstellen**

Die bisherigen Spalten sind `ausleihe_id, startzeit, kunde_id, typ_code, kilometer,
ist_geschaetzt, verfahren` — genau die Basissicht, anders benannt und mit Schranke:

```sql
create or replace view velocity.v_wawi_fahrt_km as
select fk.ausleihe_id,
       fk.startzeit,
       fk.kunde_id,
       fk.typ_code,
       fk.km          as kilometer,
       fk.ist_geschaetzt,
       fk.verfahren
  from velocity.v_fahrt_kennzahl fk
 -- Unveraendert aus dem bisherigen Stand uebernommen. Die Schranke
 -- gehoert in DIESE Sicht, nicht in die Basissicht: nur hier ist
 -- entschieden, wer das Bewegungsprofil sehen darf.
 where velocity.hat_rolle('leitung');
```

Die `comment on view`- und `comment on column`-Anweisungen darunter **unverändert stehen
lassen** — sie beschreiben weiter richtig, was die Sicht tut.

- [ ] **Schritt 2: `v_wawi_km_co2` umstellen**

```sql
create or replace view velocity.v_wawi_km_co2 as
select date_trunc('month', fk.startzeit)::date          as monat,
       fk.typ_code,
       count(*)                                         as fahrten,
       round(sum(fk.km), 1)                             as kilometer,
       count(*) filter (where fk.ist_geschaetzt)        as fahrten_geschaetzt,
       round(avg(case when fk.ist_geschaetzt then 1.0 else 0.0 end), 3)
                                                        as anteil_geschaetzt,
       -- Erst summieren, dann runden - wie bisher. co2_ersparnis_g ist
       -- in der Basissicht ungerundet, genau dafuer.
       round(sum(fk.co2_ersparnis_g) / 1000.0, 2)       as co2_ersparnis_kg
  from velocity.v_fahrt_kennzahl fk
 where velocity.hat_rolle('leitung') or velocity.hat_rolle('demo')
 group by 1, 2;
```

- [ ] **Schritt 3: `v_wawi_fahrten_je_tag_rad` umstellen**

Diese Sicht führt zusätzlich `rahmennummer, typ, start_station, ziel_station, umsatz`. Nur
`kilometer` und `ist_geschaetzt` kommen aus der Basissicht; **alles andere bleibt, wie es
ist** — insbesondere der `umsatz`-Ausdruck wird nicht angefasst. Die vorhandene
Kilometerformel wird durch einen Join auf `v_fahrt_kennzahl` über `ausleihe_id` ersetzt, die
`cross join lateral`-Blöcke und die `left join`s auf `rechenannahme` fallen weg. Schranke
`velocity.hat_rolle('leitung') or velocity.hat_rolle('disposition')` unverändert.

- [ ] **Schritt 4: Kette zweimal, dann die Zusicherung**

```bash
for lauf in 1 2; do for f in db/aufbau/*.sql; do
  ssh bot.butscher.cloud "docker exec -i supabase-db psql -U postgres -d postgres -q -v ON_ERROR_STOP=1" < "$f" || { echo "FEHLER in $f"; break 2; }
done; done
python3 db/test.py 2>&1 | tail -3
```

Erwartet: 194 bestandene, 0 fehlgeschlagene — **darunter die vier Funktionen aus t0025 und
t0018**. Läuft t0025 rot, ist die Umstellung schuld. Die eingefrorenen Werte werden dann
**nicht** nachgezogen; stattdessen wird die Abweichung gesucht.

- [ ] **Schritt 5: Nachweisen, dass die Formel nur noch einmal dasteht**

```bash
grep -c "fn_luftlinie_km" db/aufbau/0018_wawi_sichten.sql
```

Erwartet: deutlich weniger als bisher 12, und `fn_luftlinie_km` erscheint außerhalb ihrer
eigenen Definition nur noch in `v_fahrt_kennzahl`.

- [ ] **Schritt 6: Festschreiben**

```bash
git add db/aufbau/0018_wawi_sichten.sql
git commit -m "refactor(sichten): die drei WaWi-Sichten lesen aus v_fahrt_kennzahl"
```

---

### Aufgabe 4: Die drei Kundensichten

**Dateien:**
- Neu: `db/aufbau/0025_kundenkennzahlen.sql`
- Neu: `db/tests/t0026_kundenkennzahlen.sql`

**Schnittstellen:**
- Verbraucht: `velocity.v_fahrt_kennzahl` aus Aufgabe 2.
- Liefert: `v_meine_fahrt_kennzahl`, `v_meine_monatsbilanz`, `v_meine_bilanz` — alle
  `grant select … to authenticated`. Aufgabe 7 liest genau diese drei.

**Der Filtermechanismus.** Im Projekt gibt es zwei Muster: `v_meine_ausleihe` steht auf
`security_invoker = true` und überlässt das Filtern der RLS-Regel `ausleihe_eigene`;
`v_mein_profil` läuft mit Eigentümerrechten und trägt `where k.auth_uid = auth.uid()` selbst.
**Hier gilt das zweite**, und zwar zwingend: der Rang muss über alle 495 gewerteten Kunden
rechnen. Unter `security_invoker` sähe die Unterabfrage nur die eigenen Fahrten, und der Rang
wäre immer 1 von 1 — eine Sicht, die immer schmeichelt und nie stimmt.

- [ ] **Schritt 1: Die Datei anlegen**

`db/aufbau/0025_kundenkennzahlen.sql`:

```sql
-- =====================================================================
--  KUNDENKENNZAHLEN FUER DAS PERSOENLICHE DASHBOARD
--
--  Eigene Datei nach 0018, weil alle drei Sichten v_fahrt_kennzahl
--  lesen und eine Sicht nur lesen kann, was es zum Zeitpunkt ihrer
--  Anlage schon gibt.
--
--  ALLE DREI LAUFEN MIT EIGENTUEMERRECHTEN und filtern selbst ueber
--  auth.uid(). Das ist NICHT das Muster von v_meine_ausleihe
--  (security_invoker plus RLS), sondern das von v_mein_profil - und
--  zwar zwingend: v_meine_bilanz muss den Rang ueber alle gewerteten
--  Kunden bilden. Unter security_invoker saehe die Unterabfrage nur
--  die eigenen Fahrten, und jeder Kunde staende auf Platz 1 von 1.
--
--  NACH AUSSEN GEHEN NUR ZAHLEN. Rang, Anzahl, Perzentil, Median und
--  Bestwert der Flotte sind Kennzahlen, keine Personen; kein Name und
--  keine Kundennummer eines Dritten verlaesst diese Sichten. Dieselbe
--  Unterscheidung wie bei v_wawi_umsatz_kundengruppe.
-- =====================================================================
set search_path = velocity, public;

-- ---- Je Fahrt ------------------------------------------------------
create or replace view velocity.v_meine_fahrt_kennzahl as
select fk.ausleihe_id,
       fk.startzeit, fk.endzeit, fk.dauer_minuten,
       fk.typ_code, t.bezeichnung as typ_bezeichnung,
       f.rahmennummer,
       ss.name as start_station,
       es.name as end_station,
       fk.km, fk.ist_geschaetzt, fk.verfahren,
       round(fk.co2_ersparnis_g, 1) as co2_ersparnis_g,
       fk.betrag_brutto
  from velocity.v_fahrt_kennzahl fk
  join velocity.kunde         k  on k.kunde_id   = fk.kunde_id
  join velocity.ausleihe      a  on a.ausleihe_id = fk.ausleihe_id
  join velocity.fahrrad       f  on f.fahrrad_id = fk.fahrrad_id
  join velocity.fahrradmodell mo on mo.modell_id = f.modell_id
  join velocity.fahrradtyp    t  on t.typ_id     = mo.typ_id
  left join velocity.station ss on ss.station_id = a.start_station_id
  left join velocity.station es on es.station_id = a.end_station_id
 where k.auth_uid = auth.uid();

-- ---- Je Monat ------------------------------------------------------
create or replace view velocity.v_meine_monatsbilanz as
select date_trunc('month', fk.startzeit)::date          as monat,
       count(*)::integer                                as fahrten,
       sum(fk.dauer_minuten)::integer                   as minuten,
       round(sum(fk.km), 1)                             as km,
       round(sum(fk.co2_ersparnis_g) / 1000.0, 2)       as co2_ersparnis_kg,
       sum(fk.betrag_brutto)                            as ausgaben_brutto,
       round(avg(case when fk.ist_geschaetzt then 1.0 else 0.0 end), 3)
                                                        as anteil_geschaetzt
  from velocity.v_fahrt_kennzahl fk
  join velocity.kunde k on k.kunde_id = fk.kunde_id
 where k.auth_uid = auth.uid()
 group by 1;

-- ---- Eine einzige Zeile, mit der Einordnung -------------------------
create or replace view velocity.v_meine_bilanz as
with je_kunde as (
  -- Ueber ALLE Kunden. Diese Zwischenstufe ist der Grund, warum die
  -- Sicht mit Eigentuemerrechten laufen muss.
  select fk.kunde_id,
         count(*)                                 as fahrten,
         sum(fk.dauer_minuten)                    as minuten,
         sum(fk.km)                               as km,
         sum(fk.co2_ersparnis_g)                  as co2_g,
         sum(fk.betrag_brutto)                    as ausgaben,
         min(fk.startzeit)                        as erste,
         max(fk.startzeit)                        as letzte,
         avg(case when fk.ist_geschaetzt then 1.0 else 0.0 end) as geschaetzt
    from velocity.v_fahrt_kennzahl fk
   group by fk.kunde_id
),
mit_rang as (
  -- Gewertet wird, wer mindestens eine abgeschlossene Fahrt hat. Ein
  -- Rang unter Konten ohne jede Fahrt waere keine Einordnung, sondern
  -- eine geschenkte Platzierung.
  select j.*,
         rank()        over (order by j.km desc) as rang_km,
         count(*)      over ()                   as kunden_gewertet,
         percent_rank() over (order by j.km)     as perzentil_anteil
    from je_kunde j
),
flotte as (
  select percentile_cont(0.5) within group (order by km) as median_km,
         max(km)                                        as bestwert_km
    from je_kunde
)
select r.fahrten                            as fahrten_gesamt,
       r.minuten                            as minuten_gesamt,
       round(r.km, 1)                       as km_gesamt,
       round(r.co2_g / 1000.0, 2)           as co2_ersparnis_kg_gesamt,
       r.ausgaben                           as ausgaben_gesamt,
       r.erste                              as erste_fahrt,
       r.letzte                             as letzte_fahrt,
       r.rang_km,
       r.kunden_gewertet,
       round(r.perzentil_anteil * 100, 1)   as perzentil,
       round(f.median_km, 1)                as median_km_flotte,
       round(f.bestwert_km, 1)              as bestwert_km_flotte,
       round(r.geschaetzt, 3)               as anteil_geschaetzt
  from mit_rang r
  cross join flotte f
  join velocity.kunde k on k.kunde_id = r.kunde_id
 where k.auth_uid = auth.uid();

comment on view velocity.v_meine_bilanz is
  'Genau eine Zeile: die des Anmeldenden. Rang, Perzentil, Median und Bestwert '
  'entstehen aus einer Zwischenstufe über alle gewerteten Kunden, von der nach außen '
  'ausschließlich Zahlen gelangen - kein Name, keine Kundennummer, keine fremde Zeile.';

grant select on velocity.v_meine_fahrt_kennzahl to authenticated;
grant select on velocity.v_meine_monatsbilanz   to authenticated;
grant select on velocity.v_meine_bilanz         to authenticated;
```

- [ ] **Schritt 2: Kette zweimal laufen lassen**

```bash
for lauf in 1 2; do for f in db/aufbau/*.sql; do
  ssh bot.butscher.cloud "docker exec -i supabase-db psql -U postgres -d postgres -q -v ON_ERROR_STOP=1" < "$f" || { echo "FEHLER in $f"; break 2; }
done; done
```

- [ ] **Schritt 3: Die Prüfungen schreiben**

`db/tests/t0026_kundenkennzahlen.sql`:

```sql
-- =====================================================================
-- t0026 Kundenkennzahlen des persoenlichen Dashboards
-- =====================================================================
create schema if not exists velocity_test;
set search_path = velocity_test, velocity, extensions, public;

-- Vorrichtung: einen VORHANDENEN Kundensatz anmelden. runtests() gibt
-- jeder Testfunktion eine eigene Transaktion und nimmt sie hinterher
-- zurueck; das Setzen von auth_uid an einer Bestandszeile ist deshalb
-- folgenlos. Ein frisch erfundener Kunde waere hier untauglich: er
-- haette keine Fahrten, und genau die sollen gemessen werden.
create or replace function velocity_test.fixture_kunde_anmelden(p_kundennummer text)
returns uuid language plpgsql as $$
declare v_uid uuid := gen_random_uuid();
begin
  update velocity.kunde set auth_uid = v_uid where kundennummer = p_kundennummer;
  if not found then
    raise exception 'Kundensatz % gibt es nicht', p_kundennummer;
  end if;
  perform set_config('request.jwt.claims', json_build_object('sub', v_uid)::text, true);
  return v_uid;
end;
$$;

create or replace function velocity_test.test_kk_bilanz_ist_eine_zeile()
returns setof text language plpgsql as $$
begin
  perform velocity_test.fixture_kunde_anmelden('K-000001');
  return next is((select count(*)::int from velocity.v_meine_bilanz), 1,
                 'v_meine_bilanz liefert genau eine Zeile');
end;
$$;

create or replace function velocity_test.test_kk_jeder_sieht_seine_eigene()
returns setof text language plpgsql as $$
declare v_a numeric; v_b numeric;
begin
  perform velocity_test.fixture_kunde_anmelden('K-000001');
  select km_gesamt into v_a from velocity.v_meine_bilanz;
  perform velocity_test.fixture_kunde_anmelden('K-000013');
  select km_gesamt into v_b from velocity.v_meine_bilanz;
  -- Wuerde die Sicht nicht filtern, kaeme zweimal dasselbe heraus.
  return next isnt(v_a, v_b,
                 'Zwei verschiedene Kunden sehen zwei verschiedene Bilanzen');
end;
$$;

create or replace function velocity_test.test_kk_rang_ist_kein_einzelrang()
returns setof text language plpgsql as $$
declare v_anzahl integer; v_rang bigint;
begin
  perform velocity_test.fixture_kunde_anmelden('K-000013');
  select kunden_gewertet, rang_km into v_anzahl, v_rang from velocity.v_meine_bilanz;
  -- Der Kernfehler, den diese Pruefung abfaengt: liefe die Sicht unter
  -- security_invoker, saehe die Zwischenstufe nur die eigenen Fahrten
  -- und jeder staende auf Platz 1 von 1.
  return next cmp_ok(v_anzahl, '>', 1,
                 'Der Rang wird ueber mehr als einen Kunden gebildet');
  return next cmp_ok(v_rang, '<=', v_anzahl::bigint,
                 'Der eigene Platz liegt innerhalb des Feldes');
end;
$$;

create or replace function velocity_test.test_kk_mehr_km_kleinerer_rang()
returns setof text language plpgsql as $$
declare v_km_a numeric; v_rang_a bigint; v_km_b numeric; v_rang_b bigint;
begin
  perform velocity_test.fixture_kunde_anmelden('K-000013');
  select km_gesamt, rang_km into v_km_a, v_rang_a from velocity.v_meine_bilanz;
  perform velocity_test.fixture_kunde_anmelden('K-000001');
  select km_gesamt, rang_km into v_km_b, v_rang_b from velocity.v_meine_bilanz;
  return next ok((v_km_a > v_km_b) = (v_rang_a < v_rang_b),
                 'Wer mehr Kilometer hat, traegt den kleineren Rang');
end;
$$;

create or replace function velocity_test.test_kk_gewertet_nur_mit_fahrt()
returns setof text language plpgsql as $$
declare v_gemeldet integer; v_erwartet integer;
begin
  perform velocity_test.fixture_kunde_anmelden('K-000013');
  select kunden_gewertet into v_gemeldet from velocity.v_meine_bilanz;
  select count(distinct kunde_id)::int into v_erwartet from velocity.v_fahrt_kennzahl;
  -- Gemessen am 05.09.2026: 495 von 1 014 Kunden haben ueberhaupt eine
  -- abgeschlossene Fahrt. Zaehlte die Sicht alle 1 014, waere der Rang
  -- unter Konten ohne jede Fahrt gebildet - eine geschenkte
  -- Platzierung, keine Einordnung. Verglichen wird gegen die
  -- Basissicht, nicht gegen die feste Zahl 495: der Bestand waechst.
  return next is(v_gemeldet, v_erwartet,
                 'kunden_gewertet zaehlt genau die Kunden mit mindestens einer Fahrt');
  return next cmp_ok(v_gemeldet, '<', (select count(*)::int from velocity.kunde),
                 'Kunden ohne jede Fahrt werden nicht mitgezaehlt');
end;
$$;

create or replace function velocity_test.test_kk_summen_stimmen_ueberein()
returns setof text language plpgsql as $$
declare v_monat numeric; v_gesamt numeric;
begin
  perform velocity_test.fixture_kunde_anmelden('K-000001');
  select round(sum(km), 1) into v_monat from velocity.v_meine_monatsbilanz;
  select km_gesamt        into v_gesamt from velocity.v_meine_bilanz;
  -- Zwei Sichten, dieselbe Groesse. Laufen sie auseinander, zeigt das
  -- Dashboard im Verlauf etwas anderes als in der Bilanz darueber -
  -- und niemand weiss, welche der beiden Zahlen stimmt.
  return next is(v_monat, v_gesamt,
                 'Die Monatssummen ergeben die Gesamtbilanz');
end;
$$;

create or replace function velocity_test.test_kk_keine_fremden_zeilen()
returns setof text language plpgsql as $$
begin
  perform velocity_test.fixture_kunde_anmelden('K-000001');
  return next is_empty(
    $sql$select f.ausleihe_id from velocity.v_meine_fahrt_kennzahl f
           join velocity.ausleihe a using (ausleihe_id)
           join velocity.kunde k on k.kunde_id = a.kunde_id
          where k.kundennummer <> 'K-000001'$sql$,
    'v_meine_fahrt_kennzahl führt keine fremde Fahrt');
end;
$$;
```

- [ ] **Schritt 4: Testreihe**

Run: `python3 db/test.py 2>&1 | tail -3`
Erwartet: 201 bestandene, 0 fehlgeschlagene.

- [ ] **Schritt 5: Gegenprobe — der Rang muss ohne Eigentümerrechte brechen**

```bash
ssh bot.butscher.cloud "docker exec -i supabase-db psql -U postgres -d postgres -tA" << 'SQL'
begin;
set search_path = velocity_test, velocity, extensions, public;
select plan(2);
alter view velocity.v_meine_bilanz set (security_invoker = true);
select t from velocity_test.test_kk_rang_ist_kein_einzelrang() t;
rollback;
SQL
```

Erwartet: `not ok` — unter `security_invoker` bricht der Rang zusammen. Bleibt es grün,
prüft der Test nicht, was er behauptet.

- [ ] **Schritt 6: Festschreiben**

```bash
git add db/aufbau/0025_kundenkennzahlen.sql db/tests/t0026_kundenkennzahlen.sql TESTEN.md
git commit -m "feat(kennzahlen): drei Kundensichten mit Rang ohne Preisgabe Dritter"
```

---

### Aufgabe 5: Demokonto und Clara Fake

**Dateien:**
- Neu: `db/betrieb/demokonto_website.sql`

**Vorbedingung, die schon erfüllt ist:** `demo@bikes.invalid` steht seit dem 05.09.2026 in
`auth.users` (nachgemessen). Legt der Betreiber die Datenbank neu auf, muss er das Konto in
Supabase Studio erneut anlegen, mit **„Auto Confirm User"** — an `.invalid` kommt keine
Bestätigungsmail an. **Das Anlegen von Anmeldekonten ist nicht Teil dieses Plans.**

- [ ] **Schritt 1: Das Skript schreiben**

```sql
-- =====================================================================
--  DEMOKONTO DER KUNDENWEBSITE MIT EINEM KUNDENSATZ VERBINDEN
--
--  Das Anmeldekonto demo@bikes.invalid legt der Betreiber in Supabase
--  Studio an ("Auto Confirm User"), nicht dieses Skript: auth.users
--  gehoert nicht dem Schema velocity, und Zugangsdaten gehoeren nicht
--  in eine Datei im Repository.
--
--  DER KUNDENSATZ: K-000001, ausgewaehlt aus 495 Kandidaten nach allen
--  drei Radtypen, mindestens zwoelf Monaten mit Fahrten, mindestens
--  sechs Rechnungen und keinem bestehenden Anmeldekonto. 30 Fahrten,
--  9 Rechnungen, 05.01.2025 bis 24.08.2026.
--
--  DIE UMBENENNUNG: Der Satz hiess "Max Mustermann" - und genau so
--  heisst im Impressum und im Fussbereich der Geschaeftsfuehrer der
--  VeloCity GmbH (src/rechtliches.html, src/index.html). Ein Demokunde
--  desselben Namens haette zwei Rollen unter einem Namen gefuehrt.
--  "Clara Fake" loest das auf und sagt zugleich, dass die Person
--  erfunden ist. Die Impressumszeilen werden NICHT angefasst.
--
--  Die Adresse zieht db/betrieb/kundenmails_anonymisieren.sql nach:
--  sie leitet aus dem Namen ab, also wird aus max.mustermann@ nach
--  einem erneuten Lauf clara.fake@mail.invalid. Reihenfolge deshalb:
--  erst diese Datei, dann jene.
--
--  IDEMPOTENT: ein zweiter Lauf findet den Satz bereits umbenannt und
--  verknuepft vor und schreibt nichts an.
-- =====================================================================
do $$
declare
  v_uid   uuid;
  v_kunde bigint;
begin
  select id into v_uid from auth.users where email = 'demo@bikes.invalid';
  if v_uid is null then
    raise exception
      'Das Anmeldekonto demo@bikes.invalid fehlt. Erst in Supabase Studio anlegen '
      '(Authentication, Add user, "Auto Confirm User" ankreuzen), dann diese Datei.';
  end if;

  select kunde_id into v_kunde from velocity.kunde where kundennummer = 'K-000001';
  if v_kunde is null then
    raise exception 'Kundensatz K-000001 fehlt';
  end if;

  update velocity.kunde
     set vorname = 'Clara', nachname = 'Fake'
   where kunde_id = v_kunde
     and (vorname, nachname) is distinct from ('Clara', 'Fake');

  update velocity.kunde
     set auth_uid = v_uid
   where kunde_id = v_kunde
     and auth_uid is distinct from v_uid;

  -- ---- Gegenprobe --------------------------------------------------
  if not exists (select 1 from velocity.kunde
                  where kunde_id = v_kunde and auth_uid = v_uid
                    and vorname = 'Clara' and nachname = 'Fake') then
    raise exception 'Die Verknuepfung hat nicht gegriffen';
  end if;

  if exists (select 1 from velocity.kunde
              where auth_uid = v_uid and kunde_id <> v_kunde) then
    raise exception 'Das Demokonto haengt an mehr als einem Kundensatz';
  end if;

  raise notice 'Demokonto verbunden mit K-000001 (Clara Fake), kunde_id %', v_kunde;
end;
$$;
```

- [ ] **Schritt 2: Laufen lassen — Zustimmung des Betreibers einholen**

Dies ist ein schreibender Lauf gegen die Produktivdatenbank und ändert einen Bestandssatz.
Vorher `bash tools/velocity_sichern.sh`, dann fragen, dann:

```bash
ssh bot.butscher.cloud "docker exec -i supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1" < db/betrieb/demokonto_website.sql
ssh bot.butscher.cloud "docker exec -i supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1" < db/betrieb/kundenmails_anonymisieren.sql
```

Erwartet: `Demokonto verbunden mit K-000001 (Clara Fake)`, danach
`Kundenmailadressen umgestellt: 1 Saetze geaendert, 1 ausgenommen`.

- [ ] **Schritt 3: Nachprüfen**

```bash
ssh bot.butscher.cloud "docker exec -i supabase-db psql -U postgres -d postgres -tA -F' | '" << 'SQL'
select k.kundennummer, k.vorname, k.nachname, k.email, u.email
  from velocity.kunde k join auth.users u on u.id = k.auth_uid
 order by k.kundennummer;
SQL
```

Erwartet: `K-000001 | Clara | Fake | clara.fake@mail.invalid | demo@bikes.invalid` und
`K-000013 | Robert | Butscher | swrobuts@googlemail.com | swrobuts@googlemail.com`.

- [ ] **Schritt 4: Testreihe und Festschreiben**

```bash
python3 db/test.py 2>&1 | tail -3
git add db/betrieb/demokonto_website.sql
git commit -m "feat(betrieb): Demokonto der Website mit Clara Fake verbinden"
```

Die Prüfung `test_ref_kundenmails_sind_unzustellbar` aus `t0008` deckt die neue Adresse
mit ab; eine eigene Prüfung braucht es nicht.

---

### Aufgabe 6: Der Demozugang auf der Anmeldemaske

**Dateien:**
- Ändern: `src/config.js` — zwei Felder in `APP_CONFIG`
- Ändern: `src/index.html` — Knopf und Hinweis im Anmeldeformular (`#login-form`, ab Zeile 52)
- Ändern: `src/auth.js` — eine Funktion

**Schnittstellen:**
- Verbraucht: `login(email, password)` aus `src/auth.js` Zeile 58.
- Liefert: `APP_CONFIG.demoEmail`, `APP_CONFIG.demoPasswort` — Aufgabe 7 prüft sie nicht,
  benutzt sie nicht; sie gehören allein zu dieser Aufgabe.

- [ ] **Schritt 1: Die Felder anlegen — leer**

In `src/config.js`, `APP_CONFIG` erweitern:

```javascript
const APP_CONFIG = {
    defaultMapCenter: [49.7930, 9.9360],
    defaultZoom: 14,
    schema: 'velocity',
    // Demozugang der Kundenwebsite. BEIDE FELDER BLEIBEN HIER LEER.
    // Die Werte traegt der Betreiber ein; Zugangsdaten gehoeren nicht
    // ins Repository, auch absichtlich oeffentliche nicht. Sind sie
    // leer, erscheint auf der Anmeldemaske weder Knopf noch Hinweis -
    // kein halb funktionierender Zugang.
    demoEmail: '',
    demoPasswort: ''
};
```

- [ ] **Schritt 2: Knopf und Hinweis ins HTML**

In `src/index.html` innerhalb `<form id="login-form">`, nach dem Absendeknopf:

```html
<div id="demo-zugang" class="demo-zugang" hidden>
    <button type="button" id="demo-anmelden" class="btn btn-sekundaer">
        Demo ansehen
    </button>
    <p id="demo-hinweis" class="demo-hinweis"></p>
</div>
```

Der Hinweistext steht **nicht** im HTML. Er wird in Schritt 3 aus denselben Werten erzeugt,
aus denen sich der Knopf anmeldet — so gibt es das Kennwort an genau einer Stelle.

- [ ] **Schritt 3: Verdrahten**

Ans Ende von `src/auth.js`:

```javascript
/* Der Demozugang zeigt sich nur, wenn BEIDE Werte gesetzt sind. Ein
   Knopf ohne Kennwort waere eine Anmeldung, die sicher fehlschlaegt,
   und ein Hinweis ohne Knopf eine Anleitung ins Leere. */
function demoZugangAufbauen() {
    const email = (APP_CONFIG.demoEmail || '').trim();
    const kennwort = (APP_CONFIG.demoPasswort || '').trim();
    const bereich = document.getElementById('demo-zugang');
    if (!bereich || !email || !kennwort) return;

    // textContent, nicht innerHTML: der Text traegt Werte aus der
    // Konfiguration, und die gehoeren nicht als Markup interpretiert.
    document.getElementById('demo-hinweis').textContent =
        `Zum Ausprobieren: Anmeldung „${email}", Kennwort „${kennwort}".`;
    bereich.hidden = false;

    document.getElementById('demo-anmelden').addEventListener('click', async () => {
        const ergebnis = await login(email, kennwort);
        if (!ergebnis.success) {
            const status = document.getElementById('auth-status');
            status.textContent = 'Der Demozugang ist gerade nicht verfügbar.';
            status.hidden = false;
        }
    });
}
```

Aufruf in `initAuth()` (Zeile 191) am Ende ergänzen: `demoZugangAufbauen();`

**Rückgabewert prüfen, nicht raten:** ob `login()` `{ success }` liefert, steht in
`src/auth.js` Zeile 58 ff. Weicht die Form ab, wird die Bedingung oben daran angepasst.

- [ ] **Schritt 4: Von Hand ansehen**

```bash
python3 -m http.server 8765 --directory src
```

Erwartet bei leeren Feldern: **kein** Knopf, **kein** Hinweis, Anmeldemaske unverändert. Dann
die beiden Werte lokal probeweise füllen (`demo@bikes.invalid` / das Kennwort), Seite neu
laden: Knopf und Hinweis erscheinen, ein Klick meldet an. **Die Werte danach wieder
entfernen** — sie dürfen nicht festgeschrieben werden.

- [ ] **Schritt 5: Festschreiben**

```bash
git diff --stat src/config.js   # muss zwei leere Felder zeigen, keine Werte
git add src/config.js src/index.html src/auth.js
git commit -m "feat(website): Demozugang auf der Anmeldemaske"
```

---

### Aufgabe 7: Dashboard-Gerüst, Bilanz und Konterfei

**Dateien:**
- Neu: `src/dashboard.js`
- Ändern: `src/index.html` — neuer Abschnitt, Skripteinbindung
- Ändern: `src/style.css`

**Schnittstellen:**
- Verbraucht: `ladeListe(quelle, spalten, aufbau)` und `letzterLadeFehler(quelle)` aus
  `src/supabase.js` (Zeilen 24 und 35); die drei Sichten aus Aufgabe 4.
- Liefert: `dashboardZeichnen()` — von Aufgabe 8 um die Diagramme erweitert.

- [ ] **Schritt 1: Der Abschnitt im HTML**

In `src/index.html`, im angemeldeten Bereich:

```html
<section id="dashboard" class="dashboard" hidden aria-labelledby="dashboard-titel">
    <header class="dashboard-kopf">
        <div id="dashboard-konterfei" class="konterfei" aria-hidden="true"></div>
        <div>
            <h2 id="dashboard-titel">Meine Bilanz</h2>
            <p id="dashboard-zeitraum" class="dashboard-zeitraum"></p>
        </div>
    </header>
    <p id="dashboard-fehler" class="dashboard-fehler" role="status" hidden></p>
    <div id="dashboard-bilanz" class="bilanz-gitter"></div>
    <div id="dashboard-ringe" class="dashboard-block"></div>
    <div id="dashboard-verlauf" class="dashboard-block"></div>
    <div id="dashboard-einordnung" class="dashboard-block"></div>
    <div id="dashboard-fahrten" class="dashboard-block"></div>
</section>
```

Und vor `</body>`, nach `script.js`:

```html
<script src="dashboard.js"></script>
```

Ohne `?v=` — den Stempel setzt `tools/versionieren.py` in Aufgabe 9.

- [ ] **Schritt 2: `src/dashboard.js` anlegen**

```javascript
// ============================================
// VeloCity - persoenliches Dashboard
//
// EIGENE DATEI, WEIL script.js 2 618 ZEILEN HAT. Diese Datei laedt die
// drei Kundensichten und zeichnet daraus; sie RECHNET NICHT. Jede
// angezeigte Zahl kommt aus einer Sicht - eine Kennzahl, die nur hier
// entstuende, waere von keinem Datenbanktest erreichbar.
// ============================================

async function ladeBilanz() {
    const zeilen = await ladeListe('v_meine_bilanz');
    return zeilen[0] || null;
}

async function ladeMonate() {
    return ladeListe('v_meine_monatsbilanz', '*', (q) => q.order('monat'));
}

async function ladeLetzteFahrten(anzahl = 5) {
    return ladeListe('v_meine_fahrt_kennzahl', '*',
        (q) => q.order('startzeit', { ascending: false }).limit(anzahl));
}

/* Zahlen im Dashboard werden EINHEITLICH deutsch formatiert. Ohne das
   stuenden 1234.5 und 1.234,5 nebeneinander auf derselben Seite. */
const zahl = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 });
const euro = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });

function kachel(wert, einheit, beschriftung) {
    const d = document.createElement('div');
    d.className = 'bilanz-kachel';
    const w = document.createElement('span');
    w.className = 'bilanz-wert';
    w.textContent = wert;
    const e = document.createElement('span');
    e.className = 'bilanz-einheit';
    e.textContent = einheit;
    const b = document.createElement('span');
    b.className = 'bilanz-beschriftung';
    b.textContent = beschriftung;
    d.append(w, e, b);
    return d;
}

function bilanzZeichnen(b) {
    const ziel = document.getElementById('dashboard-bilanz');
    ziel.replaceChildren(
        kachel(zahl.format(b.km_gesamt), 'km', 'gefahren'),
        kachel(zahl.format(b.co2_ersparnis_kg_gesamt), 'kg', 'CO₂ gespart'),
        kachel(String(b.fahrten_gesamt), '', 'Fahrten'),
        kachel(euro.format(b.ausgaben_gesamt), '', 'ausgegeben')
    );

    /* Der Schaetzanteil steht sichtbar, nicht im Kleingedruckten. 41
       Prozent der Fahrten haben keine gemessene Distanz; ein Wert, der
       eine Schaetzung als Messung ausgibt, ist der Punkt, an dem ein
       solches Dashboard unglaubwuerdig wird. */
    if (b.anteil_geschaetzt > 0) {
        const hinweis = document.createElement('p');
        hinweis.className = 'bilanz-hinweis';
        hinweis.textContent =
            `${zahl.format(b.anteil_geschaetzt * 100)} % der Strecken sind geschätzt, `
            + 'nicht gemessen.';
        ziel.append(hinweis);
    }
}

/* Das Konterfei ist ABGELEITET, nicht hinterlegt: keine Bilddatei, kein
   Upload, keine Spalte. Jedes Konto hat sofort eines, auch ein morgen
   angelegtes. Ein Foto kommt nicht in Frage - ein Gesicht unter einer
   erfundenen Identitaet ist keine Illustration, sondern eine Behauptung
   ueber einen Menschen. */
function konterfeiZeichnen(vorname, nachname, schluessel) {
    const initialen = ((vorname || '?')[0] + (nachname || '?')[0]).toUpperCase();
    let summe = 0;
    for (const z of String(schluessel || initialen)) summe = (summe * 31 + z.charCodeAt(0)) % 360;

    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 96 96');
    svg.setAttribute('class', 'konterfei-svg');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', `${vorname} ${nachname}`);

    const scheibe = document.createElementNS(ns, 'circle');
    scheibe.setAttribute('cx', '48'); scheibe.setAttribute('cy', '48');
    scheibe.setAttribute('r', '44');
    scheibe.setAttribute('fill', `hsl(${summe} 42% 88%)`);
    scheibe.setAttribute('stroke', `hsl(${summe} 46% 42%)`);
    scheibe.setAttribute('stroke-width', '3');

    const text = document.createElementNS(ns, 'text');
    text.setAttribute('x', '48'); text.setAttribute('y', '49');
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('dominant-baseline', 'central');
    text.setAttribute('font-size', '34');
    text.setAttribute('font-weight', '600');
    text.setAttribute('fill', `hsl(${summe} 46% 28%)`);
    text.textContent = initialen;

    svg.append(scheibe, text);
    document.getElementById('dashboard-konterfei').replaceChildren(svg);
}

async function dashboardZeichnen() {
    const abschnitt = document.getElementById('dashboard');
    const fehlerfeld = document.getElementById('dashboard-fehler');
    if (!abschnitt) return;

    const bilanz = await ladeBilanz();

    /* Leer ist nicht gleich kaputt. ladeListe() liefert bei einem Fehler
       ebenfalls [], und ein Ladefehler als "noch keine Fahrten"
       auszugeben hat bei den Belegen schon einmal eine halbe Stunde
       Fehlersuche gekostet. */
    const fehler = letzterLadeFehler('v_meine_bilanz');
    if (fehler) {
        fehlerfeld.textContent = 'Die Bilanz konnte nicht geladen werden.';
        fehlerfeld.hidden = false;
        abschnitt.hidden = false;
        return;
    }
    fehlerfeld.hidden = true;

    if (!bilanz) {
        abschnitt.hidden = false;
        document.getElementById('dashboard-bilanz').replaceChildren(
            Object.assign(document.createElement('p'), {
                className: 'dashboard-leer',
                textContent: 'Sobald die erste Fahrt abgeschlossen ist, steht hier die Bilanz.'
            }));
        return;
    }

    const profil = (await ladeListe('v_mein_profil'))[0] || {};
    konterfeiZeichnen(profil.vorname, profil.nachname, profil.kundennummer);
    bilanzZeichnen(bilanz);

    document.getElementById('dashboard-zeitraum').textContent =
        `${new Date(bilanz.erste_fahrt).toLocaleDateString('de-DE')} bis `
        + `${new Date(bilanz.letzte_fahrt).toLocaleDateString('de-DE')}`;

    abschnitt.hidden = false;
}
```

- [ ] **Schritt 3: Aufrufen, wenn jemand angemeldet ist**

In `src/script.js` an der Stelle, an der der angemeldete Bereich aufgebaut wird,
`dashboardZeichnen();` ergänzen. Die Stelle finden:

```bash
grep -n "isAuthenticated()\|onAuthStateChange" src/script.js | head
```

- [ ] **Schritt 4: Von Hand ansehen**

`python3 -m http.server 8765 --directory src`, anmelden mit dem Demozugang. Erwartet: vier
Kacheln mit Zahlen, links davon ein Kreis mit „CF", darunter der Zeitraum. Abgemeldet: der
Abschnitt bleibt verborgen.

- [ ] **Schritt 5: Festschreiben**

```bash
git add src/dashboard.js src/index.html src/style.css src/script.js
git commit -m "feat(website): Dashboard-Geruest, Bilanz und Konterfei"
```

---

### Aufgabe 8: Ringe, Verlauf, Einordnung und letzte Fahrten

Vier Blöcke, alle als Inline-SVG ohne Bibliothek. **Eine Aussage je Block, die Zahl vor der
Erklärung** — das ist es, was die Gesundheits-Apps auszeichnet, nicht die Farbe.

**Dateien:**
- Ändern: `src/dashboard.js`
- Ändern: `src/style.css`

**Schnittstellen:**
- Verbraucht: `ladeMonate()`, `ladeLetzteFahrten(anzahl)`, `zahl`, `euro` und
  `dashboardZeichnen()` aus Aufgabe 7.

- [ ] **Schritt 1: Die Ringe**

```javascript
/* Drei Ringe fuer den LAUFENDEN Monat, gemessen am eigenen
   Monatsdurchschnitt - nicht an einem festen Ziel. Am 5. eines Monats
   stuenden die Ringe sonst auf einem Bruchteil, und das Dashboard zeigte
   an jedem Monatsanfang Versagen an. */
function ringeZeichnen(monate) {
    const ziel = document.getElementById('dashboard-ringe');
    if (!monate.length) { ziel.replaceChildren(); return; }

    const jetzt = new Date();
    const lauf = `${jetzt.getFullYear()}-${String(jetzt.getMonth() + 1).padStart(2, '0')}-01`;
    const aktuell = monate.find((m) => m.monat === lauf);
    const frueher = monate.filter((m) => m.monat !== lauf);
    if (!aktuell || !frueher.length) { ziel.replaceChildren(); return; }

    const mittel = (feld) => frueher.reduce((s, m) => s + Number(m[feld]), 0) / frueher.length;
    const ringe = [
        { feld: 'fahrten', name: 'Fahrten', farbe: '#e2402d' },
        { feld: 'km',      name: 'Kilometer', farbe: '#1f9d6b' },
        { feld: 'minuten', name: 'Minuten', farbe: '#2f74c0' }
    ];

    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 200 200');
    svg.setAttribute('class', 'ringe-svg');
    svg.setAttribute('role', 'img');

    const teile = [];
    ringe.forEach((r, i) => {
        const radius = 84 - i * 24;
        const umfang = 2 * Math.PI * radius;
        const soll = mittel(r.feld);
        const anteil = soll > 0 ? Math.min(Number(aktuell[r.feld]) / soll, 1) : 0;

        for (const [klasse, laenge, farbe] of [
            ['ring-grund', umfang, '#e6e3dc'],
            ['ring-wert',  umfang * anteil, r.farbe]
        ]) {
            const kreis = document.createElementNS(ns, 'circle');
            kreis.setAttribute('cx', '100'); kreis.setAttribute('cy', '100');
            kreis.setAttribute('r', String(radius));
            kreis.setAttribute('fill', 'none');
            kreis.setAttribute('stroke', farbe);
            kreis.setAttribute('stroke-width', '16');
            kreis.setAttribute('stroke-linecap', 'round');
            kreis.setAttribute('class', klasse);
            kreis.setAttribute('stroke-dasharray', `${laenge} ${umfang}`);
            kreis.setAttribute('transform', 'rotate(-90 100 100)');
            svg.append(kreis);
        }
        teile.push(`${r.name} ${Math.round(anteil * 100)} Prozent des eigenen Durchschnitts`);
    });

    svg.setAttribute('aria-label', 'Laufender Monat: ' + teile.join(', '));

    const ueber = document.createElement('h3');
    ueber.textContent = 'Dieser Monat';
    const legende = document.createElement('ul');
    legende.className = 'ringe-legende';
    ringe.forEach((r) => {
        const li = document.createElement('li');
        const punkt = document.createElement('span');
        punkt.className = 'ringe-punkt';
        punkt.style.background = r.farbe;
        const text = document.createElement('span');
        text.textContent = `${r.name}: ${zahl.format(aktuell[r.feld])} `
            + `(Durchschnitt ${zahl.format(mittel(r.feld))})`;
        li.append(punkt, text);
        legende.append(li);
    });
    ziel.replaceChildren(ueber, svg, legende);
}
```

- [ ] **Schritt 2: Der Verlauf**

```javascript
/* Ein Balken je Monat, umschaltbar. Die Achse beginnt bei null: hier
   kodiert LAENGE den Wert, und eine beschnittene Achse waere bei einer
   Laengenkodierung eine Falschaussage. */
const VERLAUF_GROESSEN = {
    km:              { name: 'Kilometer', form: (w) => zahl.format(w) + ' km' },
    fahrten:         { name: 'Fahrten',   form: (w) => String(w) },
    ausgaben_brutto: { name: 'Ausgaben',  form: (w) => euro.format(w) }
};
let verlaufGroesse = 'km';

function verlaufZeichnen(monate) {
    const ziel = document.getElementById('dashboard-verlauf');
    if (!monate.length) { ziel.replaceChildren(); return; }
    const g = VERLAUF_GROESSEN[verlaufGroesse];
    const groesst = Math.max(...monate.map((m) => Number(m[verlaufGroesse])), 0) || 1;

    const ueber = document.createElement('h3');
    ueber.textContent = `Verlauf: ${g.name}`;

    const schalter = document.createElement('div');
    schalter.className = 'verlauf-schalter';
    schalter.setAttribute('role', 'group');
    for (const [schluessel, wert] of Object.entries(VERLAUF_GROESSEN)) {
        const knopf = document.createElement('button');
        knopf.type = 'button';
        knopf.textContent = wert.name;
        knopf.setAttribute('aria-pressed', String(schluessel === verlaufGroesse));
        knopf.addEventListener('click', () => { verlaufGroesse = schluessel; verlaufZeichnen(monate); });
        schalter.append(knopf);
    }

    const liste = document.createElement('ol');
    liste.className = 'verlauf-balken';
    monate.forEach((m) => {
        const wert = Number(m[verlaufGroesse]);
        const li = document.createElement('li');
        const monat = document.createElement('span');
        monat.className = 'verlauf-monat';
        monat.textContent = new Date(m.monat)
            .toLocaleDateString('de-DE', { month: 'short', year: '2-digit' });
        const spur = document.createElement('span');
        spur.className = 'verlauf-spur';
        const balken = document.createElement('span');
        balken.className = 'verlauf-wert';
        balken.style.width = `${(wert / groesst) * 100}%`;
        spur.append(balken);
        const text = document.createElement('span');
        text.className = 'verlauf-zahl';
        text.textContent = g.form(wert);
        li.append(monat, spur, text);
        liste.append(li);
    });
    ziel.replaceChildren(ueber, schalter, liste);
}
```

- [ ] **Schritt 3: Die Einordnung**

```javascript
/* Nach aussen gehen nur Zahlen. Median und Bestwert sind Kennzahlen der
   Flotte, keine Personen - es gibt hier keine Bestenliste und keinen
   fremden Namen. */
function einordnungZeichnen(b) {
    const ziel = document.getElementById('dashboard-einordnung');
    const ueber = document.createElement('h3');
    ueber.textContent = 'Einordnung';

    const platz = document.createElement('p');
    platz.className = 'einordnung-platz';
    platz.textContent = `Platz ${b.rang_km} von ${b.kunden_gewertet}`;

    const erklaerung = document.createElement('p');
    erklaerung.className = 'einordnung-text';
    erklaerung.textContent =
        `Gewertet wird, wer mindestens eine Fahrt abgeschlossen hat. `
        + `Mittelwert der Flotte: ${zahl.format(b.median_km_flotte)} km, `
        + `Bestwert: ${zahl.format(b.bestwert_km_flotte)} km.`;

    const spur = document.createElement('div');
    spur.className = 'perzentil-spur';
    spur.setAttribute('role', 'img');
    spur.setAttribute('aria-label',
        `Eigene Kilometer ${zahl.format(b.km_gesamt)}, `
        + `besser als ${zahl.format(b.perzentil)} Prozent der gewerteten Kunden`);
    const gefuellt = document.createElement('div');
    gefuellt.className = 'perzentil-wert';
    gefuellt.style.width = `${b.perzentil}%`;
    const marke = document.createElement('span');
    marke.className = 'perzentil-marke';
    marke.style.left = `${(b.median_km_flotte / b.bestwert_km_flotte) * 100}%`;
    marke.title = 'Mittelwert der Flotte';
    spur.append(gefuellt, marke);

    ziel.replaceChildren(ueber, platz, spur, erklaerung);
}
```

- [ ] **Schritt 4: Die letzten Fahrten**

```javascript
function fahrtenZeichnen(fahrten) {
    const ziel = document.getElementById('dashboard-fahrten');
    const ueber = document.createElement('h3');
    ueber.textContent = 'Letzte Fahrten';
    if (!fahrten.length) {
        ziel.replaceChildren(ueber);
        return;
    }
    const liste = document.createElement('ul');
    liste.className = 'fahrten-liste';
    fahrten.forEach((f) => {
        const li = document.createElement('li');
        const kopf = document.createElement('span');
        kopf.className = 'fahrt-kopf';
        kopf.textContent = `${new Date(f.startzeit).toLocaleDateString('de-DE')} · `
            + `${f.typ_bezeichnung} ${f.rahmennummer}`;
        const weg = document.createElement('span');
        weg.className = 'fahrt-weg';
        weg.textContent = `${f.start_station || 'freier Start'} → ${f.end_station || 'freies Ziel'}`;
        const zahlen = document.createElement('span');
        zahlen.className = 'fahrt-zahlen';
        // Das Sternchen sagt, dass die Strecke geschaetzt ist. Ohne
        // Kennzeichnung stuende eine Schaetzung wie eine Messung da.
        zahlen.textContent = `${zahl.format(f.km)} km${f.ist_geschaetzt ? ' *' : ''} · `
            + `${f.dauer_minuten} min · ${euro.format(f.betrag_brutto)}`;
        li.append(kopf, weg, zahlen);
        liste.append(li);
    });
    const fussnote = document.createElement('p');
    fussnote.className = 'fahrten-fussnote';
    fussnote.textContent = '* Strecke geschätzt, nicht gemessen.';
    ziel.replaceChildren(ueber, liste, fussnote);
}
```

- [ ] **Schritt 5: In `dashboardZeichnen()` einhängen**

Nach `bilanzZeichnen(bilanz);` ergänzen:

```javascript
    const monate = await ladeMonate();
    ringeZeichnen(monate);
    verlaufZeichnen(monate);
    einordnungZeichnen(bilanz);
    fahrtenZeichnen(await ladeLetzteFahrten(5));
```

- [ ] **Schritt 6: Von Hand ansehen, mit beiden Konten**

`python3 -m http.server 8765 --directory src`. Mit dem Demozugang **und** mit dem Konto des
Betreibers anmelden — 30 gegen 44 Fahrten, also zwei verschiedene Bilder. Prüfen:

- Die Balken beginnen bei null und der längste füllt die Spur.
- Die drei Schalter wechseln die Größe, `aria-pressed` folgt.
- Kein Wert steht doppelt formatiert da (1234.5 neben 1.234,5).
- Bei Fenstern unter 600 px bricht nichts aus dem Rahmen.

- [ ] **Schritt 7: Festschreiben**

```bash
git add src/dashboard.js src/style.css
git commit -m "feat(website): Ringe, Verlauf, Einordnung und letzte Fahrten"
```

---

### Aufgabe 9: Prüfwerkzeuge, Versionierung, Abnahme

Ohne diese Aufgabe ist das Vorhaben nicht fertig, sondern nur sichtbar.

**Dateien:**
- Ändern: `tools/frontend_check.py` — falls nötig
- Ändern: `TESTEN.md`
- Ändern: `src/index.html` — Stempel

- [ ] **Schritt 1: Der Vertrag zwischen HTML und JavaScript**

```bash
python3 tools/frontend_check.py
```

Meldet das Werkzeug Kennungen, die `dashboard.js` benutzt und im HTML fehlen (oder
umgekehrt), ist das ein echter Befund — **erst im Code beheben**, nicht im Prüfer. Nur wenn
eine Kennung nachweislich zur Laufzeit erzeugt wird, gehört sie in die Ausnahmeliste ab
Zeile 26, mit einer Zeile Begründung daneben.

- [ ] **Schritt 2: Fingerabdrücke setzen**

```bash
python3 tools/versionieren.py
python3 tools/versionieren.py --pruefen
```

Erwartet: `dashboard.js?v=<pruefsumme>` steht in `index.html`, und der zweite Aufruf meldet
keine Abweichung. Ohne diesen Schritt bekommen Studierende im Hörsaal eine alte Datei aus
dem Cache.

- [ ] **Schritt 3: Die Zahl der Tests nachziehen**

```bash
python3 db/test.py 2>&1 | tail -3
python3 tools/readme_pruefen.py
```

`TESTEN.md` Zeile 18 auf die gemeldete Zahl setzen. Der Prüfer nennt Soll und Ist.

- [ ] **Schritt 4: Die Abnahme**

```bash
bash tools/abnahme.sh 2>&1 | tail -20
```

Erwartet: `Alle 37 Pruefungen bestanden.` Besonders zu beachten:

- **Schritt 2** — Aufbaukette zweimal fehlerfrei. Die neue Datei `0025` läuft mit.
- **Schritt 28** — die Liste der Sichten. Kommen vier neue dazu, muss die Liste sie kennen;
  sonst prüft sie eine Teilmenge und bleibt stillschweigend grün. Genau dieser Fehler ist in
  diesem Projekt schon viermal aufgetreten.
- **Schritt 35** — die Website spricht nur Sichten und `api_`-Funktionen.

- [ ] **Schritt 5: Veröffentlichen — Entscheidung des Betreibers**

```bash
bash tools/veroeffentlichen.sh
```

Erst fragen. Vorher ist auf `bikes.butscher.cloud` nichts vom Dashboard zu sehen, und das
ist der richtige Zustand, solange niemand zugestimmt hat.

- [ ] **Schritt 6: Festschreiben**

```bash
git add -A
git commit -m "chore(dashboard): Pruefwerkzeuge, Fingerabdruecke und Abnahme"
```

---

## Was ausdrücklich nicht dazugehört

- **Badges.** Schritt 2. Sie hängen vollständig an den Kennzahlen aus Aufgabe 4; auf
  ungeprüften Zahlen wären sie zweimal Arbeit.
- **Eine Bestenliste.** Entschieden am 05.09.2026: nur der eigene Rang. Eine Liste mit Namen
  anderer Kunden wäre die erste Stelle, an der die Website etwas über Dritte preisgibt.
- **Neue Fahrten erzeugen.** Der Lehrdatensatz trägt 12 052 abgeschlossene Ausleihen über 20
  Monate. Beide Konten haben echte Historie; eine zweite Datenquelle neben der ersten wäre
  ein Rückschritt.
- **Mehrsprachigkeit der Kundenwebsite.** Sie ist einsprachig deutsch, und daran ändert
  dieser Plan nichts. Wer sie mehrsprachig will, macht daraus einen eigenen Auftrag.
