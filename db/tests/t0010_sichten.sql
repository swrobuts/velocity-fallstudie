-- =====================================================================
-- t0010 Sichten
-- =====================================================================
create schema if not exists velocity_test;
set search_path = velocity_test, velocity, extensions, public;

create or replace function velocity_test.test_v_vorhanden()
returns setof text language plpgsql as $$
begin
  return next has_view('velocity'::name, 'v_station'::name,             'Sicht v_station existiert');
  return next has_view('velocity'::name, 'v_verfuegbares_fahrrad'::name,'Sicht v_verfuegbares_fahrrad existiert');
  return next has_view('velocity'::name, 'v_tarifkarte'::name,          'Sicht v_tarifkarte existiert');
  return next has_view('velocity'::name, 'v_tarif'::name,               'Sicht v_tarif existiert');
  return next has_view('velocity'::name, 'v_faq'::name,                 'Sicht v_faq existiert');
  return next has_view('velocity'::name, 'v_nutzungsschritt'::name,     'Sicht v_nutzungsschritt existiert');
  return next has_view('velocity'::name, 'v_kennzahl'::name,            'Sicht v_kennzahl existiert');
  return next has_view('velocity'::name, 'v_meine_ausleihe'::name,      'Sicht v_meine_ausleihe existiert');
  return next has_view('velocity'::name, 'v_meine_rechnung'::name,      'Sicht v_meine_rechnung existiert');
  return next has_view('velocity'::name, 'v_mein_profil'::name,         'Sicht v_mein_profil existiert');
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

create or replace function velocity_test.test_v_mein_profil_filtert_selbst()
returns setof text language plpgsql as $$
declare
  v_def text;
begin
  -- v_mein_profil laeuft mit Definer-Rechten (weil sie adresse verknuepft)
  -- und muss deshalb selbst auf auth.uid() filtern.
  select pg_get_viewdef('velocity.v_mein_profil'::regclass, true) into v_def;
  return next matches(v_def, 'auth\.uid\(\)',
    'v_mein_profil filtert ausdruecklich auf auth.uid()');
  return next is(
    (select count(*)::int from velocity.v_mein_profil), 0,
    'Ohne Anmeldung liefert v_mein_profil keine Zeile');
end;
$$;
