#!/usr/bin/env python3
"""Vertikaler Durchstich: ausleihen und zurueckgeben, wie es die Website tut.

Warum ein eigenes Skript und kein pgTAP-Test? Weil pgTAP alles in EINER
Transaktion haelt und am Ende zurueckrollt. Genau das haette den Fehler
verdeckt, an dem eine Aussenpruefung am 24.08.2026 haengengeblieben ist:
die aufgeschobenen Constraint-Trigger feuern erst beim COMMIT, und erst
dort faellt auf, dass sie unter der Rolle des Aufrufers laufen. Ein Test
ohne COMMIT sieht das nie.

Dieses Skript committet deshalb wirklich - und raeumt danach hinter sich
auf, damit der Bestand unveraendert bleibt.

Aufruf:  python3 db/durchstich.py
"""
import os
import sys

import psycopg

WURZEL = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

for zeile in open(os.path.join(WURZEL, '.env'), encoding='utf-8'):
    zeile = zeile.strip()
    if zeile and not zeile.startswith('#') and '=' in zeile:
        schluessel, wert = zeile.split('=', 1)
        os.environ.setdefault(schluessel, wert)

GRUEN, ROT, GRAU, AUS = '\033[0;32m', '\033[0;31m', '\033[0;90m', '\033[0m'
fehler = []


def pruefe(text, bedingung, zusatz=''):
    if bedingung:
        print(f'  {GRUEN}✓{AUS} {text}{GRAU}{"  " + zusatz if zusatz else ""}{AUS}')
    else:
        print(f'  {ROT}✗{AUS} {text}  {zusatz}')
        fehler.append(text)


def verbinden():
    return psycopg.connect(
        host=os.environ['PGHOST'], port=os.environ['PGPORT'],
        dbname=os.environ['PGDATABASE'], user=os.environ['PGUSER'],
        password=os.environ['PGPASSWORD'], autocommit=False)


def als_kunde(cur, uid):
    """Die Sitzung so stellen, wie PostgREST sie fuer einen angemeldeten
    Besucher stellt: Rolle authenticated, Kennung im JWT-Anspruch."""
    cur.execute("select set_config('request.jwt.claims', %s, false)",
                ('{"sub":"%s","role":"authenticated"}' % uid,))
    cur.execute('set role authenticated')


def als_verwalter(cur):
    cur.execute('reset role')


def durchstich(con, typ_code, kunde, uid):
    cur = con.cursor()
    als_verwalter(cur)
    cur.execute("""
        select f.fahrrad_id, p.station_id, t.bezeichnung
          from velocity.fahrrad f
          join velocity.fahrrad_position p using (fahrrad_id)
          join velocity.fahrradmodell m using (modell_id)
          join velocity.fahrradtyp t using (typ_id)
         where f.status = 'verfuegbar' and p.station_id is not null
           and t.typ_code = %s
         limit 1""", (typ_code,))
    zeile = cur.fetchone()
    if not zeile:
        pruefe(f'{typ_code}: freies Rad an einer Station gefunden', False)
        return
    rad, station, bezeichnung = zeile
    con.commit()

    print(f'\n{GRAU}── {bezeichnung} (Rad {rad}, Station {station}){AUS}')

    # ---- starten ----------------------------------------------------
    als_kunde(cur, uid)
    cur.execute('select ausleihe_id, meldung from velocity.api_ausleihe_starten(%s)', (rad,))
    ausleihe, meldung = cur.fetchone()
    try:
        con.commit()
        pruefe('Ausleihe startet und die Transaktion haelt', ausleihe is not None,
               f'#{ausleihe} — {meldung}')
    except Exception as e:
        con.rollback()
        pruefe('Ausleihe startet und die Transaktion haelt', False, str(e).splitlines()[0])
        return

    # ---- Zustand waehrend der Fahrt ---------------------------------
    als_verwalter(cur)
    cur.execute("""select count(*) from velocity.ausleihe
                    where kunde_id = %s and endzeit is null""", (kunde,))
    pruefe('Genau eine laufende Ausleihe', cur.fetchone()[0] == 1)
    cur.execute('select status from velocity.fahrrad where fahrrad_id = %s', (rad,))
    pruefe('Das Rad steht auf ausgeliehen', cur.fetchone()[0] == 'ausgeliehen')
    # GR13 loescht die Zeile nicht, sondern leert sie: waehrend der Fahrt
    # steht dort weder eine Station noch eine Koordinate. Der Datensatz
    # bleibt, damit der Akkustand nicht verlorengeht.
    cur.execute("""select station_id, latitude, longitude
                     from velocity.fahrrad_position where fahrrad_id = %s""", (rad,))
    ort = cur.fetchone()
    pruefe('Das Rad traegt waehrend der Fahrt keinen Standort',
           ort is None or ort == (None, None, None), str(ort))
    cur.execute("""select count(*) from velocity.v_verfuegbares_fahrrad
                    where fahrrad_id = %s""", (rad,))
    pruefe('Das Rad ist nicht mehr ausleihbar', cur.fetchone()[0] == 0)
    con.commit()

    # ---- beenden ----------------------------------------------------
    als_kunde(cur, uid)
    cur.execute("""select gesamtbetrag, dauer_minuten, meldung
                     from velocity.api_ausleihe_beenden(%s, %s)""", (ausleihe, station))
    betrag, dauer, meldung2 = cur.fetchone()
    try:
        con.commit()
        pruefe('Rueckgabe wird gebucht', betrag is not None,
               f'{betrag} Euro fuer {dauer} Min — {meldung2}')
    except Exception as e:
        con.rollback()
        pruefe('Rueckgabe wird gebucht', False, str(e).splitlines()[0])
        return

    # ---- Zustand nach der Fahrt -------------------------------------
    als_verwalter(cur)
    cur.execute("""select count(*) from velocity.ausleihe
                    where kunde_id = %s and endzeit is null""", (kunde,))
    pruefe('Keine laufende Ausleihe mehr', cur.fetchone()[0] == 0)
    cur.execute('select status from velocity.fahrrad where fahrrad_id = %s', (rad,))
    pruefe('Das Rad steht wieder auf verfuegbar', cur.fetchone()[0] == 'verfuegbar')
    cur.execute("""select station_id from velocity.fahrrad_position where fahrrad_id = %s""", (rad,))
    zurueck = cur.fetchone()
    pruefe('Das Rad steht wieder an der Station', zurueck and zurueck[0] == station)
    cur.execute("""select count(*), coalesce(sum(betrag), 0)
                     from velocity.entgeltposition where ausleihe_id = %s""", (ausleihe,))
    anzahl, summe = cur.fetchone()
    pruefe('Die Abrechnung traegt Positionen', anzahl > 0, f'{anzahl} Position(en), {summe} Euro')
    pruefe('Positionen und Gesamtbetrag stimmen ueberein', summe == betrag,
           f'{summe} gegen {betrag}')
    con.commit()

    # ---- aufraeumen -------------------------------------------------
    cur.execute('delete from velocity.entgeltposition where ausleihe_id = %s', (ausleihe,))
    cur.execute('delete from velocity.ausleihe where ausleihe_id = %s', (ausleihe,))
    con.commit()
    print(f'  {GRAU}Testausleihe #{ausleihe} wieder entfernt{AUS}')


def main():
    con = verbinden()
    cur = con.cursor()
    cur.execute('select kunde_id, auth_uid from velocity.kunde where auth_uid is not null limit 1')
    zeile = cur.fetchone()
    con.commit()
    if not zeile:
        print(f'{ROT}Kein Kunde mit auth_uid vorhanden — bitte einmal ueber die Seite anmelden.{AUS}')
        return 1
    kunde, uid = zeile
    print(f'Durchstich fuer Kunde {kunde}\n')

    for typ in ('CITY', 'EBIKE', 'CARGO'):
        durchstich(con, typ, kunde, uid)

    print()
    if fehler:
        print(f'{ROT}{len(fehler)} Schritt(e) fehlgeschlagen.{AUS}')
        return 1
    print(f'{GRUEN}Der Weg von der Ausleihe bis zur Abrechnung laeuft fuer alle drei Typen.{AUS}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
