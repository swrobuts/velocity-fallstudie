#!/usr/bin/env python3
"""Zahlen in Anleitung und Vortrag gegen die Datenbank halten.

WARUM ES DAS GIBT
Zahlen wandern. Sie stehen in der Datenbank, im Test, auf der Website,
in der Pruefanleitung und im Vortrag - und wenn sich eine aendert,
aendern sich selten alle fuenf. Dreimal ist das hier schon passiert:

  TESTEN.md nannte 4,00 Euro, als der Preis laengst 16,00 war. Eine
  externe Pruefung hielt daraufhin den PREIS fuer den Fehler und
  meldete ihn als kritischen Befund.

  Die Zuladung des Lastenrads stand an vier Stellen mit drei
  verschiedenen Zahlen: 100 in der Spalte, 80 in der Beschreibung,
  70 auf der Startseite.

  Das Deck rechnete mit einer Obergrenze von 15,00 - das war nie die
  des City-Bikes, mit dem das Beispiel rechnet.

WAS GEPRUEFT WIRD
Nur Zahlen, die frei im Text stehen UND in der Datenbank eine
Entsprechung haben. Die Datenbank ist die Quelle; der Text hat ihr zu
folgen, nie umgekehrt.

  TESTEN.md   "... Stationen"                -> v_kennzahl
              "A / B / C Euro" fuer 30 Min   -> v_tarifkarte
  Foliendeck  "... kg"                       -> fahrradtyp.zuladung_kg
              "Obergrenze ..."               -> nutzungspreis.tageshoechstpreis

WAS NICHT GEPRUEFT WIRD
Das Rechenbeispiel des Vortrags (6,20 / 1,24 / 4,96). Diese Werte werden
in db/tests/t0009_preisfindung.sql gerechnet, nicht abgeschrieben - dort
gehoeren sie hin.

Und Aufzeichnungen: die Protokolle in doku/verifikation und die
Gutachten halten fest, was an einem bestimmten Tag galt. Sie SOLLEN
veralten. Ein Protokoll nachzuziehen hiesse, eine Messung zu faelschen.

Aufruf:  python3 tools/zahlen_gegen_db.py
"""
import os
import re
import sys
import zipfile
from xml.etree import ElementTree as ET

import psycopg

WURZEL = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DECK = os.path.join(WURZEL, 'slides', 'velocity-datenbankentwurf.pptx')
ANLEITUNG = os.path.join(WURZEL, 'TESTEN.md')
NS = 'http://schemas.openxmlformats.org/drawingml/2006/main'

GRUEN, ROT, GRAU, AUS = '\033[0;32m', '\033[0;31m', '\033[0;90m', '\033[0m'

fehler = 0
geprueft = 0


def melde(gut: bool, text: str) -> None:
    global fehler, geprueft
    geprueft += 1
    if gut:
        print(f'  {GRUEN}✓{AUS} {text}')
    else:
        print(f'  {ROT}✗{AUS} {text}')
        fehler += 1


def euro(wert) -> str:
    return f'{wert:.2f}'.replace('.', ',')


def datenbank() -> dict:
    for zeile in open(os.path.join(WURZEL, '.env'), encoding='utf-8'):
        zeile = zeile.strip()
        if zeile and not zeile.startswith('#') and '=' in zeile:
            schluessel, wert = zeile.split('=', 1)
            os.environ.setdefault(schluessel, wert)
    con = psycopg.connect(host=os.environ['PGHOST'], port=os.environ['PGPORT'],
                          dbname=os.environ['PGDATABASE'], user=os.environ['PGUSER'],
                          password=os.environ['PGPASSWORD'])
    cur = con.cursor()
    soll = {}
    cur.execute('select zuladung_kg from velocity.fahrradtyp where zuladung_kg is not null')
    soll['zuladung'] = {int(r[0]) for r in cur.fetchall()}
    cur.execute('select tageshoechstpreis from velocity.nutzungspreis '
                ' where upper_inf(gueltigkeit)')
    soll['deckel'] = {euro(r[0]) for r in cur.fetchall()}
    # In der Reihenfolge der Tarifkarten auf der Seite, also nach typ_id.
    cur.execute('select preis_30_minuten from velocity.v_tarifkarte order by typ_id')
    soll['tarifkarte'] = [euro(r[0]) for r in cur.fetchall()]
    cur.execute("select wert from velocity.v_kennzahl where schluessel = 'stationen'")
    soll['stationen'] = cur.fetchone()[0]
    return soll


def folientext():
    z = zipfile.ZipFile(DECK)
    namen = sorted((n for n in z.namelist()
                    if re.match(r'ppt/slides/slide\d+\.xml$', n)),
                   key=lambda n: int(re.search(r'(\d+)', n).group(1)))
    for i, name in enumerate(namen, start=1):
        baum = ET.fromstring(z.read(name))
        yield i, ' '.join(t.text or '' for t in baum.iter(f'{{{NS}}}t'))


def pruefe_anleitung(soll: dict) -> None:
    print(f'\nTESTEN.md {GRAU}gegen v_kennzahl und v_tarifkarte{AUS}')
    text = open(ANLEITUNG, encoding='utf-8').read()

    treffer = re.search(r'\*\*(\d+)\s+Stationen\*\*', text)
    hat = treffer.group(1) if treffer else 'keine Angabe'
    melde(hat == soll['stationen'],
          f'Stationszahl  {GRAU}Anleitung {hat}, Datenbank {soll["stationen"]}{AUS}')

    treffer = re.search(r'\*\*([\d,]+)\s*/\s*([\d,]+)\s*/\s*([\d,]+)\s*Euro\*\*', text)
    hat = list(treffer.groups()) if treffer else []
    melde(hat == soll['tarifkarte'],
          f'Preise fuer 30 Minuten  {GRAU}Anleitung '
          f'{" / ".join(hat) or "keine Angabe"}, '
          f'Datenbank {" / ".join(soll["tarifkarte"])}{AUS}')


def pruefe_folien(soll: dict) -> None:
    print(f'\nFoliendeck {GRAU}gegen fahrradtyp und nutzungspreis{AUS}')
    offen, zahlen = [], 0
    for nummer, text in folientext():
        for wert in re.findall(r'\b(\d{1,3})\s*kg\b', text):
            zahlen += 1
            if int(wert) not in soll['zuladung']:
                offen.append(f'Folie {nummer}: "{wert} kg" steht so nicht in '
                             f'fahrradtyp.zuladung_kg')
        for wert in re.findall(r'Obergrenze\s*([\d.,]+)', text):
            zahlen += 1
            if wert.rstrip('.,') not in soll['deckel']:
                offen.append(f'Folie {nummer}: "Obergrenze {wert}" steht so nicht in '
                             f'nutzungspreis.tageshoechstpreis')
    for satz in offen:
        melde(False, satz)
    if not offen:
        # zahlen > 0 gehoert in die BEDINGUNG, nicht nur in die Meldung:
        # bis zur vierten Pruefrunde stand hier melde(True, ...), und ein
        # Deck ohne eine einzige der gesuchten Zahlen kam als gruenes
        # "0 freistehende Zahlen stimmen" durch - die Pruefung konnte
        # "alles richtig" nicht von "nichts geprueft" unterscheiden.
        # Nachgewiesen mit einem Foliensatz ohne Zahlen. Genau die Sorte
        # gruener Pruefung, die gefaehrlicher ist als eine rote.
        melde(zahlen > 0,
              f'{zahlen} freistehende Zahlen stimmen  '
              f'{GRAU}Zuladung {sorted(soll["zuladung"])} kg, '
              f'Deckel {sorted(soll["deckel"])}{AUS}'
              + ('' if zahlen else '  — KEINE gefunden, es wurde nichts abgeglichen'))


def main() -> int:
    soll = datenbank()
    pruefe_anleitung(soll)
    pruefe_folien(soll)
    print()
    if fehler:
        print(f'{ROT}{fehler} von {geprueft} Pruefungen weichen von der Datenbank ab.{AUS}')
        return 1
    print(f'{GRUEN}Anleitung und Vortrag stimmen mit der Datenbank ueberein.{AUS}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
