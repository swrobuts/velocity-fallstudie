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
