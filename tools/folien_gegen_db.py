#!/usr/bin/env python3
"""Die Zahlen im Foliendeck gegen die Datenbank halten.

WARUM ES DAS GIBT
Zahlen wandern. Sie stehen in der Datenbank, im Test, auf der Website
und im Vortrag - und wenn sich eine aendert, aendern sich selten alle
vier. Dreimal ist das in diesem Projekt schon passiert:

  TESTEN.md nannte 4,00 EUR, als der Preis laengst 16,00 war. Eine
  Aussenpruefung hielt daraufhin den PREIS fuer den Fehler.

  Die Zuladung des Lastenrads stand an vier Stellen mit drei
  verschiedenen Zahlen: 100 in der Spalte, 80 in der Beschreibung,
  70 auf der Startseite.

  Das Deck rechnete mit einer Obergrenze von 15,00 - das war nie die
  des City-Bikes, mit dem das Beispiel rechnet.

Geprueft werden deshalb genau die Zahlen, die im Deck FREI stehen und
in der Datenbank eine Entsprechung haben:

  "... kg"          -> velocity.fahrradtyp.zuladung_kg
  "Obergrenze ..."  -> velocity.nutzungspreis.tageshoechstpreis

Was das NICHT prueft: das Rechenbeispiel selbst. Dessen Zwischenwerte
(6,20 / 1,24 / 4,96) stehen in db/tests/t0009_preisfindung.sql und
werden dort gerechnet, nicht abgeschrieben.

Aufruf:  python3 tools/folien_gegen_db.py
"""
import os
import re
import sys
import zipfile
from xml.etree import ElementTree as ET

import psycopg

WURZEL = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DECK = os.path.join(WURZEL, 'slides', 'velocity-datenbankentwurf.pptx')
NS = 'http://schemas.openxmlformats.org/drawingml/2006/main'

GRUEN, ROT, GRAU, AUS = '\033[0;32m', '\033[0;31m', '\033[0;90m', '\033[0m'


def folientext():
    """Je Folie den sichtbaren Text, in der Reihenfolge des Decks."""
    z = zipfile.ZipFile(DECK)
    namen = sorted((n for n in z.namelist()
                    if re.match(r'ppt/slides/slide\d+\.xml$', n)),
                   key=lambda n: int(re.search(r'(\d+)', n).group(1)))
    for i, name in enumerate(namen, start=1):
        baum = ET.fromstring(z.read(name))
        yield i, ' '.join(t.text or '' for t in baum.iter(f'{{{NS}}}t'))


def aus_der_datenbank():
    for zeile in open(os.path.join(WURZEL, '.env'), encoding='utf-8'):
        zeile = zeile.strip()
        if zeile and not zeile.startswith('#') and '=' in zeile:
            schluessel, wert = zeile.split('=', 1)
            os.environ.setdefault(schluessel, wert)
    con = psycopg.connect(host=os.environ['PGHOST'], port=os.environ['PGPORT'],
                          dbname=os.environ['PGDATABASE'], user=os.environ['PGUSER'],
                          password=os.environ['PGPASSWORD'])
    cur = con.cursor()
    cur.execute('select zuladung_kg from velocity.fahrradtyp where zuladung_kg is not null')
    zuladungen = {int(r[0]) for r in cur.fetchall()}
    cur.execute("""select p.tageshoechstpreis from velocity.nutzungspreis p
                    where upper_inf(p.gueltigkeit)""")
    deckel = {f'{r[0]:.2f}'.replace('.', ',') for r in cur.fetchall()}
    return zuladungen, deckel


def main() -> int:
    zuladungen, deckel = aus_der_datenbank()
    print(f'\nDatenbank sagt: Zuladung {sorted(zuladungen)} kg, '
          f'Tageshoechstpreise {sorted(deckel)}\n')

    fehler = 0
    geprueft = 0
    for nummer, text in folientext():
        for wert in re.findall(r'\b(\d{1,3})\s*kg\b', text):
            geprueft += 1
            if int(wert) not in zuladungen:
                print(f'  {ROT}✗{AUS} Folie {nummer}: "{wert} kg" steht so nicht in '
                      f'fahrradtyp.zuladung_kg')
                fehler += 1
        for wert in re.findall(r'Obergrenze\s*([\d.,]+)', text):
            geprueft += 1
            if wert.rstrip('.,') not in deckel:
                print(f'  {ROT}✗{AUS} Folie {nummer}: "Obergrenze {wert}" steht so nicht in '
                      f'nutzungspreis.tageshoechstpreis')
                fehler += 1

    if fehler:
        print(f'\n{ROT}{fehler} von {geprueft} Zahlen im Deck passen nicht '
              f'zur Datenbank.{AUS}')
        return 1
    print(f'  {GRUEN}✓{AUS} {geprueft} Zahlen im Deck stimmen mit der Datenbank ueberein')
    return 0


if __name__ == '__main__':
    sys.exit(main())
