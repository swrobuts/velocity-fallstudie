-- Schließt den pg_net-Schreibweg für den Lehrzugang studi.
-- Als Eigentümer von net ausführen, in EINER Transaktion:
--     python3 db/run.py db/betrieb/studi_net_absichern.sql
--
-- PUBLIC umfasst auch studi. Ein REVOKE nur FROM studi genügt daher nicht.
-- Die bisherigen PUBLIC-Rechte werden für alle anderen vorhandenen
-- Anwendungs-/Betriebsrollen ausdrücklich erhalten; Systemrollen pg_*
-- bekommen keine neuen direkten Grants. Neue Rollen erhalten keinen
-- automatischen net-Zugang. Keine Rolle/Mitgliedschaft wird angelegt.
--
-- Auch Sequenzen und sämtliche Funktionssignaturen werden geschlossen:
-- Nur USAGE(net) zu entziehen genügt bei bereits aufgelösten Namen nicht.
-- Die Änderung berührt keine velocity-/auth-Objekte oder Anmeldedaten.
-- Vor dem produktiven Lauf die net-ACLs sichern. Wiederholbar; nach einem
-- pg_net-Update erneut prüfen, da die Erweiterung PUBLIC-Grants setzen kann.

set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $$
declare
  v_obj record;
  v_rolle text;
  v_rollen text[];
  v_privilegien text;
  v_anzahl integer := 0;
begin
  if not exists (select 1 from pg_roles where rolname = 'studi') then
    raise exception 'Lehrzugang studi fehlt';
  end if;
  if not exists (select 1 from pg_extension where extname = 'pg_net')
     or to_regnamespace('net') is null then
    raise exception 'pg_net bzw. Schema net fehlt';
  end if;

  -- Bei Rollenvererbung wäre das Kopieren an eine andere Rolle ein
  -- möglicher Rückweg. In diesem Fall erst den konkreten Stand klären.
  if exists (select 1 from pg_roles
              where rolname = 'studi' and (rolsuper or rolcreaterole))
     or exists (select 1 from pg_roles
                 where rolname <> 'studi'
                   and pg_has_role('studi', oid, 'MEMBER')) then
    raise exception 'studi hat administrative Attribute oder Rollenmitgliedschaften';
  end if;

  -- Solche zusätzlichen Freigaben liegen auf der geprüften Instanz
  -- nicht vor. Bei einem abweichenden Stand keine Teilkorrektur anwenden.
  if exists (select 1 from pg_attribute a
              join pg_class c on c.oid = a.attrelid
              join pg_namespace n on n.oid = c.relnamespace
             where n.nspname = 'net' and a.attacl is not null) then
    raise exception 'Unerwartete Spaltenrechte in net; gesondert prüfen';
  end if;

  select array_agg(rolname order by rolname) into v_rollen
    from pg_roles where rolname <> 'studi' and rolname !~ '^pg_';

  for v_obj in
    select 'SCHEMA' as art, format('%I', nspname) as name,
           coalesce(nspacl, acldefault('n', nspowner)) as acl,
           nspowner as eigentuemer
      from pg_namespace where nspname = 'net'
    union all
    select case when c.relkind = 'S' then 'SEQUENCE' else 'TABLE' end,
           format('%I.%I', n.nspname, c.relname),
           coalesce(c.relacl, acldefault(
             case when c.relkind = 'S' then 'S'::"char" else 'r'::"char" end,
             c.relowner)), c.relowner
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'net' and c.relkind in ('r', 'p', 'v', 'm', 'f', 'S')
    union all
    select case when p.prokind = 'p' then 'PROCEDURE' else 'FUNCTION' end,
           format('%I.%I(%s)', n.nspname, p.proname,
                  pg_get_function_identity_arguments(p.oid)),
           coalesce(p.proacl, acldefault('f', p.proowner)), p.proowner
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'net'
  loop
    if not pg_has_role(current_user, v_obj.eigentuemer, 'USAGE') then
      raise exception 'Eigentümerrechte fehlen für %', v_obj.name;
    end if;
    if pg_get_userbyid(v_obj.eigentuemer) = 'studi' then
      raise exception 'studi ist Eigentümer von %', v_obj.name;
    end if;

    -- Nur die zuvor tatsächlich öffentlichen Rechte kopieren, kein
    -- pauschales ALL für die Betriebsrollen. Kein WITH GRANT OPTION.
    select string_agg(distinct privilege_type, ', ' order by privilege_type)
      into v_privilegien from aclexplode(v_obj.acl) where grantee = 0;
    if v_privilegien is not null then
      foreach v_rolle in array v_rollen loop
        execute format('grant %s on %s %s to %I',
                       v_privilegien, v_obj.art, v_obj.name, v_rolle);
      end loop;
    end if;
    execute format('revoke all privileges on %s %s from public, studi',
                   v_obj.art, v_obj.name);
    v_anzahl := v_anzahl + 1;
  end loop;

  -- Effektive Rechte prüfen: nicht nur, ob ein direkter Grant fehlt.
  if has_schema_privilege('studi', 'net', 'USAGE,CREATE') then
    raise exception 'studi hat weiterhin Zugriff auf Schema net';
  end if;
  if exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'net' and case
       when c.relkind = 'S' then
         has_sequence_privilege('studi', c.oid, 'SELECT,USAGE,UPDATE')
       when c.relkind in ('r', 'p', 'v', 'm', 'f') then
         has_table_privilege('studi', c.oid,
           'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')
         or has_any_column_privilege('studi', c.oid, 'SELECT,INSERT,UPDATE,REFERENCES')
       else false end
  ) then
    raise exception 'studi hat weiterhin Objekt- oder Spaltenrechte in net';
  end if;
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'net' and has_function_privilege('studi', p.oid, 'EXECUTE')
  ) then
    raise exception 'studi kann weiterhin net-Funktionen ausführen';
  end if;
  raise notice '% net-Objekte abgesichert; bestehende Betriebsrechte erhalten', v_anzahl;
end $$;
