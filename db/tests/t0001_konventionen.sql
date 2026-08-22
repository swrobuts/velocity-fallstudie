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
  v_erstellt  timestamptz;
  v_geaendert timestamptz;
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
  return next is(v_geaendert, v_erstellt,
    'Innerhalb einer Transaktion sind beide Stempel gleich: now() ist die Transaktionszeit');

  -- Beweist, dass der Trigger bei UPDATE wirklich greift: beide Spalten
  -- werden mit offensichtlich falschen Werten ueberschrieben. Der Trigger
  -- muss geaendert_am auf now() zwingen und erstellt_am zuruecksetzen.
  update velocity.t_audit_probe
     set geaendert_am = timestamptz '2000-01-01 00:00:00+00',
         erstellt_am  = timestamptz '1999-01-01 00:00:00+00'
   where id = 1;

  select erstellt_am, geaendert_am into v_erstellt, v_geaendert
    from velocity.t_audit_probe where id = 1;
  return next is(v_geaendert, now(),
    'geaendert_am wird beim Aendern auf die Transaktionszeit gezwungen');
  return next isnt(v_erstellt, timestamptz '1999-01-01 00:00:00+00',
    'Ein von aussen gesetztes erstellt_am wird verworfen');
  return next is(v_erstellt, v_geaendert,
    'erstellt_am behaelt seinen urspruenglichen Wert aus derselben Transaktion');
end;
$$;
