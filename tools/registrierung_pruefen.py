#!/usr/bin/env python3
"""Nachsehen, was eine Registrierung tatsaechlich angelegt hat.

Nach dem Befund vom 24.08.2026 ist bei einer Registrierung dreierlei zu
pruefen, und zwar in dieser Reihenfolge:

  1. Ist ueberhaupt ein Auth-Benutzer entstanden?
     Vorher scheiterte die ganze Transaktion an einem Trigger, der in das
     Altschema schrieb - es entstand nichts, nicht einmal der Benutzer.

  2. Wurde der VORHANDENE Kundensatz verknuepft statt ein zweiter
     angelegt? Bestandskunden aus der Datenuebernahme haben eine
     Kundennummer und eine Historie; ein Duplikat wuerde beides
     abschneiden.

  3. Hat das Altschema ein Duplikat bekommen?

Aufruf:
    python3 tools/registrierung_pruefen.py meine@adresse.de
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

GRUEN, ROT, GELB, GRAU, AUS = '\033[0;32m', '\033[0;31m', '\033[0;33m', '\033[0;90m', '\033[0m'


def main() -> int:
    if len(sys.argv) < 2:
        print('Aufruf: python3 tools/registrierung_pruefen.py meine@adresse.de')
        return 2
    email = sys.argv[1].strip().lower()

    con = psycopg.connect(
        host=os.environ['PGHOST'], port=os.environ['PGPORT'],
        dbname=os.environ['PGDATABASE'], user=os.environ['PGUSER'],
        password=os.environ['PGPASSWORD'])
    cur = con.cursor()

    print(f'\nRegistrierung von {email}\n')
    fehler = 0

    # ---- 1 Auth-Benutzer --------------------------------------------
    cur.execute("""select id, email_confirmed_at is not null, created_at
                     from auth.users where lower(email) = %s""", (email,))
    benutzer = cur.fetchall()
    if len(benutzer) == 1:
        uid, bestaetigt, wann = benutzer[0]
        print(f'  {GRUEN}✓{AUS} Auth-Benutzer angelegt  {GRAU}{uid}, {wann:%d.%m.%Y %H:%M}{AUS}')
        if bestaetigt:
            print(f'  {GRUEN}✓{AUS} E-Mail ist bestaetigt')
        else:
            print(f'  {GELB}!{AUS} E-Mail noch nicht bestaetigt — Link im Postfach oeffnen')
    elif not benutzer:
        print(f'  {ROT}✗{AUS} Kein Auth-Benutzer. Die Registrierung ist nicht durchgelaufen.')
        fehler += 1
        uid = None
    else:
        print(f'  {ROT}✗{AUS} {len(benutzer)} Auth-Benutzer mit dieser Adresse')
        fehler += 1
        uid = benutzer[0][0]

    # ---- 2 Kundensatz in velocity -----------------------------------
    cur.execute("""select kunde_id, kundennummer, auth_uid, status, vorname, nachname
                     from velocity.kunde where lower(email) = %s
                    order by kunde_id""", (email,))
    kunden = cur.fetchall()
    if len(kunden) == 1:
        kid, nummer, auth_uid, status, vorname, nachname = kunden[0]
        print(f'  {GRUEN}✓{AUS} Genau ein Kundensatz  {GRAU}{nummer} (kunde_id {kid}, {status}){AUS}')
        # Die Datenuebernahme kannte fuer manche Kunden nur "Unbekannt".
        # Beim ersten Anmelden weicht der Platzhalter dem echten Namen.
        if 'Unbekannt' in (vorname or '', nachname or ''):
            print(f'  {GELB}!{AUS} Name noch ein Platzhalter: {vorname} {nachname}'
                  f'{GRAU} — wird beim naechsten Anmelden ersetzt{AUS}')
        else:
            print(f'  {GRUEN}✓{AUS} Name uebernommen  {GRAU}{vorname} {nachname}{AUS}')
        if auth_uid is None:
            print(f'  {GELB}!{AUS} Noch nicht verknuepft — das geschieht beim ersten Anmelden')
        elif uid and str(auth_uid) == str(uid):
            print(f'  {GRUEN}✓{AUS} Mit dem Auth-Konto verknuepft')
        else:
            print(f'  {ROT}✗{AUS} Verknuepft mit einem anderen Konto: {auth_uid}')
            fehler += 1
    elif not kunden:
        print(f'  {GELB}!{AUS} Kein Kundensatz — entsteht beim ersten Anmelden')
    else:
        print(f'  {ROT}✗{AUS} {len(kunden)} Kundensaetze: ' +
              ', '.join(f'{z[1]} ({z[0]})' for z in kunden))
        fehler += 1

    # ---- 3 Altschema ------------------------------------------------
    cur.execute("""select count(*) from "cityBikesRental".kunde where lower(email) = %s""", (email,))
    alt = cur.fetchone()[0]
    if alt <= 1:
        print(f'  {GRUEN}✓{AUS} Altschema unveraendert  {GRAU}{alt} Satz{AUS}')
    else:
        print(f'  {ROT}✗{AUS} {alt} Saetze im Altschema — der Trigger hat dupliziert')
        fehler += 1

    print()
    if fehler:
        print(f'{ROT}{fehler} Punkt(e) stimmen nicht.{AUS}')
        return 1
    print(f'{GRUEN}Die Registrierung ist sauber verbucht.{AUS}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
