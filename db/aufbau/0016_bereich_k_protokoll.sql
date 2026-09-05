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
-- RLS an, aber ohne Regel: Policies kommen erst mit Aufgabe 9. Bis dahin
-- weist die Tabelle jeden Zugriff ab statt versehentlich offen zu stehen -
-- force auch fuer den Tabelleneigentuemer, sonst greift enable allein nicht.
alter table velocity.aenderungsprotokoll enable row level security;
alter table velocity.aenderungsprotokoll force  row level security;
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
-- Wie aenderungsprotokoll: RLS ohne Policy bis Aufgabe 9, force gegen den
-- Eigentuemer.
alter table velocity.rechenannahme enable row level security;
alter table velocity.rechenannahme force  row level security;
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
     'Verhältnis der tatsächlich gefahrenen Strecke zur Luftlinie im Stadtverkehr'),
    ('reisegeschwindigkeit', 13.0000, 'km/h', daterange(date '2025-01-01', null, '[)'),
     'Annahme dieser Fallstudie, nicht gemessen',
     'Nur für Rundfahrten: wer dort startet, wo er endet, hat eine Luftlinie von '
     'null. Dann bleibt die Dauer als einzige Grundlage.'),
    ('max_fahrzeit_je_tag', 3.0000, 'h/Tag', daterange(date '2025-01-01', null, '[)'),
     'Entscheidung des Auftraggebers, nicht gemessen',
     'Obergrenze für Rundfahrten, deren Kilometer aus der Dauer geschätzt werden '
     '(siehe reisegeschwindigkeit): je angefangenem Kalendertag der Ausleihe zählt '
     'höchstens diese Stundenzahl als gefahrene Zeit, auch wenn die Ausleihe '
     'insgesamt länger dauerte.')
  ) as v(code, wert, einheit, gueltigkeit, quelle, erlaeuterung)
 where not exists (
   select 1 from velocity.rechenannahme r
    where r.code = v.code and r.gueltigkeit && v.gueltigkeit
 );

-- Umlaute in der Erlaeuterung nachziehen: das insert oben trifft eine
-- bereits vorhandene Zeile (gleicher code, ueberlappende gueltigkeit)
-- nicht erneut, siehe "where not exists" oben. Ohne dieses update bliebe
-- eine schon angelegte Zeile bei der alten, transliterierten Schreibweise
-- stehen, auch nachdem die Werte oben berichtigt sind. Idempotent: nach
-- dem ersten Lauf stimmt erlaeuterung bereits ueberein, das where greift
-- dann nicht mehr.
update velocity.rechenannahme
   set erlaeuterung = v.erlaeuterung
  from (values
    ('umwegfaktor',
     'Verhältnis der tatsächlich gefahrenen Strecke zur Luftlinie im Stadtverkehr'),
    ('reisegeschwindigkeit',
     'Nur für Rundfahrten: wer dort startet, wo er endet, hat eine Luftlinie von '
     'null. Dann bleibt die Dauer als einzige Grundlage.')
  ) as v(code, erlaeuterung)
 where rechenannahme.code = v.code
   and rechenannahme.erlaeuterung <> v.erlaeuterung;

-- ---------------------------------------------------------------------
-- Dokumentation: test_doku_vollstaendig verlangt einen Kommentar an
-- jeder Tabelle und jeder Fachspalte (ausser erstellt_am/geaendert_am).
-- ---------------------------------------------------------------------
comment on table velocity.aenderungsprotokoll is
  'Feldweise Spur jeder Änderung an protokollierten Tabellen (Art. 5 Abs. 2 DSGVO). Eine Zeile je geändertem Feld, nicht je Anweisung, damit sich die Historie eines einzelnen Feldes ohne Werkzeug herausfiltern lässt. tabelle/datensatz_id sind eine Spur, keine geprüfte Beziehung - wie beleg_tabelle/beleg_id bei fahrrad_ereignis.';
comment on column velocity.aenderungsprotokoll.protokoll_id is 'Surrogatschlüssel, fachlich bedeutungslos und deshalb stabil.';
comment on column velocity.aenderungsprotokoll.zeitpunkt is 'Zeitpunkt der protokollierten Änderung, unabhängig vom technischen erstellt_am dieser Zeile.';
comment on column velocity.aenderungsprotokoll.mitarbeiter_id is 'Wer die Änderung ausgelöst hat. NULL, wenn kein angemeldeter Mitarbeiter ermittelbar war, etwa bei einem Wartungsskript - ein erfundener Verursacher wäre schlechter als keiner.';
comment on column velocity.aenderungsprotokoll.tabelle is 'Name der veränderten Tabelle, aus tg_table_name des auslösenden Triggers. Bewusst ohne Fremdschlüssel: der Trigger und diese Tabelle sind für beliebige Zieltabellen gebaut, ein FK könnte nur auf eine einzige davon zeigen.';
comment on column velocity.aenderungsprotokoll.datensatz_id is 'Primärschlüsselwert des veränderten Datensatzes in seiner Tabelle. Bewusst ohne Fremdschlüssel, siehe Kommentar an tabelle und an der Tabelle selbst.';
comment on column velocity.aenderungsprotokoll.aktion is 'Art der Änderung: INSERT, UPDATE oder DELETE, siehe aenderungsprotokoll_aktion_chk.';
comment on column velocity.aenderungsprotokoll.feld is 'Name des veränderten Feldes. Eine Zeile je Feld statt ein JSON-Klumpen, damit "wer hat je die E-Mail geändert" ohne Werkzeug beantwortbar bleibt (GR19).';
comment on column velocity.aenderungsprotokoll.wert_alt is 'Wert des Feldes vor der Änderung, als Text. NULL bei INSERT. Text statt Originaltyp, weil ein und derselbe Trigger auf jede Tabelle und jede Spalte passen muss - ein typisierter Wert bräuchte eine eigene Spalte je Datentyp.';
comment on column velocity.aenderungsprotokoll.wert_neu is 'Wert des Feldes nach der Änderung, als Text. NULL bei DELETE. Gleicher Grund wie wert_alt: generischer Typ für einen tabellenunabhängigen Trigger.';

comment on table velocity.rechenannahme is
  'Zahlen, die eine Auswertung annimmt statt sie zu messen. Jede nennt ihre Quelle.';
comment on column velocity.rechenannahme.annahme_id is 'Surrogatschlüssel, fachlich bedeutungslos und deshalb stabil.';
comment on column velocity.rechenannahme.code is 'Fachlicher Bezeichner der Annahme, etwa co2_pkw oder umwegfaktor. Auswertungen suchen darüber, nicht über den Surrogatschlüssel.';
comment on column velocity.rechenannahme.wert is 'Der angenommene Zahlenwert in der angegebenen Einheit.';
comment on column velocity.rechenannahme.einheit is 'Einheit von wert, etwa g CO2e/Pkm, damit der Wert ohne Rückfrage einzuordnen ist.';
comment on column velocity.rechenannahme.gueltigkeit is 'Zeitraum, für den dieser Wert gilt. Überschneidungsfrei je code erzwungen durch rechenannahme_zeitraum_ex, damit eine Auswertung zu jedem Tag genau einen Wert findet.';
comment on column velocity.rechenannahme.quelle is
  'Pflichtangabe. Eine Annahme ohne Herkunft ist eine Behauptung.';
comment on column velocity.rechenannahme.erlaeuterung is 'Freitext, was der Wert genau umfasst, etwa ob eine Vorkette eingerechnet ist.';
