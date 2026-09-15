#!/usr/bin/env python3
"""Prüft den echten studi-Login, seine Fachleserechte und die net-Sperre.

PGHOST, PGPORT und PGDATABASE kommen wie bei db/run.py aus .env.
Das Kennwort kommt aus STUDI_PASSWORD oder einer verdeckten Eingabe.
Keine Datenänderungen: DML nur mit EXPLAIN ohne ANALYZE; HTTP-Funktionen
zusätzlich in einer READ ONLY-Transaktion, die immer zurückgerollt wird.
"""
from __future__ import annotations

import getpass
import os
from pathlib import Path
import sys

import psycopg2
from psycopg2 import sql

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'db'))
from run import lade_env


def rows(conn, statement, args=None):
    with conn.cursor() as cur:
        cur.execute(statement, args)
        return cur.fetchall()


def verify(conn):
    failures = []

    def check(ok, label):
        print(('ok      ' if ok else 'FEHLER  ') + label)
        if not ok:
            failures.append(label)

    check(rows(conn, 'select current_user')[0][0] == 'studi', 'Echte Anmeldung als studi')
    check(rows(conn, "select to_regnamespace('net') is not null")[0][0], 'Schema net vorhanden')
    check(not rows(conn, "select has_schema_privilege('net','USAGE,CREATE')")[0][0],
          'Kein Schema-Zugriff auf net')
    bad_relations = rows(conn, """select c.relname from pg_class c
        join pg_namespace n on n.oid=c.relnamespace where n.nspname='net' and case
        when c.relkind='S' then has_sequence_privilege(c.oid,'SELECT,USAGE,UPDATE')
        when c.relkind in ('r','p','v','m','f') then
          has_table_privilege(c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')
          or has_any_column_privilege(c.oid,'SELECT,INSERT,UPDATE,REFERENCES')
          or pg_get_userbyid(c.relowner)=current_user
        else false end""")
    check(not bad_relations, 'Keine net-Tabellen-, Spalten- oder Sequenzrechte')
    functions = rows(conn, """select p.proname,has_function_privilege(p.oid,'EXECUTE')
        from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='net'""")
    check(bool(functions) and not any(allowed for _, allowed in functions),
          f'Alle {len(functions)} net-Funktionssignaturen gesperrt')
    check(not rows(conn, """select p.proname from pg_proc p
        join pg_namespace n on n.oid=p.pronamespace
        where n.nspname='velocity' and p.proname like 'api\\_%' escape '\\'
        and has_function_privilege(p.oid,'EXECUTE')"""), 'Fachliche Schreib-APIs bleiben gesperrt')

    objects = rows(conn, """select c.relname,c.relkind from pg_class c
        join pg_namespace n on n.oid=c.relnamespace where n.nspname='velocity'
        and (c.relkind in ('r','p') or (c.relkind='v' and c.relname like 'v_wawi\\_%' escape '\\'))
        order by c.relname""")
    tables = views = 0
    for name, kind in objects:
        conn.rollback()
        conn.set_session(readonly=True)
        try:
            rows(conn, sql.SQL('select count(*) from velocity.{}').format(sql.Identifier(name)))
            tables += kind in ('r', 'p')
            views += kind == 'v'
        except psycopg2.Error as exc:
            check(False, f'Lesen von {name} scheitert ({exc.pgcode})')
    check(tables >= 39 and views >= 20, f'{tables} Fachtabellen und {views} WaWi-Sichten lesbar')

    probes = [
        ('net-Warteschlange INSERT', 'explain insert into net.http_request_queue default values', False),
        ('net-Warteschlange UPDATE', 'explain update net.http_request_queue set url=url where false', False),
        ('net-Warteschlange DELETE', 'explain delete from net.http_request_queue where false', False),
        ('net-Antworten INSERT', 'explain insert into net._http_response default values', False),
        ('net-Antworten UPDATE', 'explain update net._http_response set content=content where false', False),
        ('net-Antworten DELETE', 'explain delete from net._http_response where false', False),
        ('Fachtabelle UPDATE', 'explain update velocity.station set name=name where false', False),
        ('auth.users lesen', 'select count(*) from auth.users', True),
    ]
    probes += [(f'net.{method} aufrufen',
                f"select net.{method}(url => 'https://bikes.butscher.cloud/')", True)
               for method in ('http_get', 'http_post', 'http_delete')]
    for label, statement, readonly in probes:
        conn.rollback()
        conn.set_session(readonly=readonly)
        try:
            rows(conn, statement)
            check(False, label + ': unerwartet erlaubt')
        except psycopg2.Error as exc:
            check(exc.pgcode == '42501', label + f': SQLSTATE {exc.pgcode} (erwartet 42501)')
    conn.rollback()
    print(f'\n{len(failures)} Abweichung(en).')
    return 1 if failures else 0


def main():
    lade_env(ROOT / '.env')
    missing = [key for key in ('PGHOST', 'PGPORT', 'PGDATABASE') if not os.environ.get(key)]
    if missing:
        print('Fehlende Verbindungsparameter: ' + ', '.join(missing))
        return 2
    password = os.environ.get('STUDI_PASSWORD')
    if not password:
        if not sys.stdin.isatty():
            print('STUDI_PASSWORD fehlt; ohne Terminal keine Kennworteingabe möglich.')
            return 2
        password = getpass.getpass('Kennwort für studi: ')
    conn = None
    try:
        conn = psycopg2.connect(host=os.environ['PGHOST'], port=os.environ['PGPORT'],
            dbname=os.environ['PGDATABASE'], user='studi', password=password,
            connect_timeout=15, application_name='velocity_studi_net_check')
        return verify(conn)
    except psycopg2.Error as exc:
        print(f'FEHLER  DB-Prüfung nicht abgeschlossen ({exc.pgcode or type(exc).__name__})')
        return 2
    finally:
        if conn is not None:
            conn.rollback()
            conn.close()


if __name__ == '__main__':
    raise SystemExit(main())
