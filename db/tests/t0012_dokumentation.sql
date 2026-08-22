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
  return next cmp_ok((select count(*)::int from velocity.v_data_dictionary), '>', 200,
                     'Das Dictionary listet alle Spalten des Schemas');
  return next is(
    (select beschreibung from velocity.v_data_dictionary
      where tabelle = 'fahrrad_position' and spalte = 'station_id'),
    'NULL bedeutet: das Rad steht frei abgestellt, nicht an einer Station',
    'Der Kommentar erklaert die Bedeutung von NULL');
end;
$$;
