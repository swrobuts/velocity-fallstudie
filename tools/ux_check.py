#!/usr/bin/env python3
"""Statische Gegenprobe zum UX-Audit vom 24.08.2026.

Der vorhandene frontend_check.py prueft den Vertrag zwischen HTML und JS
(gibt es das Element, das das Skript sucht?). Er meldete zum Audit null
Befunde und lag damit richtig - die Probleme lagen woanders. Dieser
Pruefer nimmt sich die Punkte vor, die das Audit tatsaechlich nannte,
und zwar so, dass sie nicht unbemerkt zurueckkommen koennen.

Was hier NICHT geprueft werden kann, steht am Ende als Handarbeit.
"""
import re, sys
from pathlib import Path

WURZEL = Path(__file__).resolve().parents[1]
SRC = WURZEL / 'src'
HTML = (SRC / 'index.html').read_text(encoding='utf-8')
CSS  = (SRC / 'style.css').read_text(encoding='utf-8')
JS   = (SRC / 'script.js').read_text(encoding='utf-8')
AUTH = (SRC / 'auth.js').read_text(encoding='utf-8')

fehler: list[str] = []


def pruefe(kennung: str, bedingung: bool, klartext: str) -> None:
    if bedingung:
        print(f'  ok   {kennung}  {klartext}')
    else:
        print(f'  FEHL {kennung}  {klartext}')
        fehler.append(f'{kennung}: {klartext}')


def ohne_kommentare(text: str) -> str:
    """HTML- und Zeilenkommentare entfernen - sonst zaehlt der Pruefer
    die eigenen Erlaeuterungen als Befund. Zwei getrennte Durchgaenge:
    ein gemeinsames re.S wuerde die ganze Datei schlucken."""
    text = re.sub(r'<!--.*?-->', '', text, flags=re.S)
    text = re.sub(r'/\*.*?\*/', '', text, flags=re.S)
    text = re.sub(r'^\s*//.*$', '', text, flags=re.M)
    return text


H = ohne_kommentare(HTML)
J = ohne_kommentare(JS)
C = ohne_kommentare(CSS)

print('UX-Audit 24.08.2026 — Gegenprobe\n')

print('P1 — kritisch')
pruefe('P1-01', 'id="menue-knopf"' in H and 'id="menue"' in H and 'aria-expanded' in H,
       'Mobile Navigation vorhanden (Menueknopf und Menue)')
pruefe('P1-01', '@media (max-width: 1023px)' in C and '.menue-knopf { display: flex; }' in C,
       'Menue erscheint spaetestens unter 1024 px')
pruefe('P1-02', 'Fahrt starten' not in H and 'Fahrt starten' not in J,
       'Kein Knopf verspricht mehr "Fahrt starten"')
pruefe('P1-02', 'karte-mit-typ' in J and 'auf der Karte zeigen' in J,
       'Tarif-Knopf sagt, was er tut')
pruefe('P1-02', "cb.checked = (cb.value === kurz)" in J,
       'Der gewaehlte Fahrradtyp wird als Kartenfilter uebernommen')
pruefe('P1-03', 'auth-status' in H and "statusZeigen('erfolg'" in J,
       'Registrierung hinterlaesst einen bleibenden Zustand')
pruefe('P1-03', 'formSperren' in J and 'Konto wird angelegt' in J,
       'Waehrend der Anfrage ist das Formular gesperrt')
pruefe('P1-05', 'href="#"' not in H,
       'Kein toter Verweis mehr im Dokument')
pruefe('P1-05', (SRC / 'rechtliches.html').exists(),
       'Die Rechtstexte existieren als eigene Seite')
pruefe('P1-06', 'role="dialog"' in H and 'aria-modal="true"' in H and 'aria-labelledby="auth-titel"' in H,
       'Der Anmeldedialog ist ein Dialog mit Namen')
pruefe('P1-06', "e.key === 'Escape'" in J and 'ruecksprung' in J and 'dialog-offen' in J,
       'Escape schliesst, Fokus kehrt zurueck, Hintergrund steht still')
pruefe('P1-06', '<button type="button" class="auth-tab' in H,
       'Die Reiter sind Schaltflaechen, keine divs')
pruefe('P1-07', 'FREIE_AB_ZOOM' in J,
       'Freie Raeder erscheinen erst ab einer Zoomstufe')
pruefe('P1-08', 'markerBenennen' in J and "setAttribute('aria-label', name)" in J,
       'Jeder Marker bekommt einen Namen')

print('\nP2 — wichtig')
feld = re.search(r'id="meter-minuten"[^>]*', H)
regler = re.search(r'id="meter-regler"[^>]*', H)
def grenze(t):
    return (re.search(r'min="(\d+)"', t).group(1), re.search(r'max="(\d+)"', t).group(1))
pruefe('P2-01', feld and regler and grenze(feld.group()) == grenze(regler.group()),
       f'Feld und Regler teilen Min/Max ({grenze(feld.group()) if feld else "?"} / {grenze(regler.group()) if regler else "?"})')
pruefe('P2-02', 'minutenSetzen' in J and 'ist-korrigiert' in J,
       'Ungueltige Zeitwerte werden sichtbar zurechtgerueckt')
pruefe('P2-03', 'scroll-margin-top' in C and 'zuAbschnitt' in J,
       'Sprungziele beruecksichtigen den festen Kopf und setzen den Fokus')
pruefe('P2-04', '.scroll-story { height: 210vh' in C,
       'Die mobile Buehne ist gekuerzt')
pruefe('P2-05', 'Würzburg &amp; Schweinfurt' in H,
       'Das Netz wird als Wuerzburg und Schweinfurt benannt')
for zeile in re.findall(r'<span class="claim-line[^"]*">(.*?)</span>', H, flags=re.S):
    text = re.sub(r'<[^>]+>', '', zeile)
    pruefe('P2-06', not re.search(r'[a-zäöüß][A-ZÄÖÜ]', text),
           f'Schlagzeile mit Wortabstand: {text.strip()[:44]!r}')
pruefe('P2-07', 'leihen"' in J and 'aria-label="${escapeHtml(erstes.typ_bezeichnung)}' in J,
       'Die Leih-Knoepfe im Popover tragen unterscheidbare Namen')
pruefe('P2-07', 'Infofenster schließen' in J,
       'Die Schliessen-Schaltflaeche des Popovers ist deutsch')
pruefe('P2-08', 'leiht direkt' not in H,
       'Der Kartentext verspricht nicht mehr als er haelt')
pruefe('P2-09', 'Preistabelle der Datenbank' not in H,
       'Kein Entwicklertext in der Kundenansprache')
zahl_auto = len(re.findall(r'autocomplete="(?!off)', H))
pruefe('P2-10', zahl_auto >= 6, f'Autocomplete an den Formularfeldern ({zahl_auto} Stueck)')
pruefe('P2-10', 'passwort-zeigen' in H and 'passwort-vergessen' in H and 'passwortZuruecksetzen' in AUTH,
       'Passwort zeigen und neues Passwort anfordern sind vorhanden')
# Der Anmeldedialog fuehrt zu Recht ein tablist - dort gibt es Panels und
# Pfeiltasten. Geprueft wird deshalb nur die Produktwahl in der Buehne.
produktwahl = re.search(r'<div class="product-tabs".*?</div>', H, flags=re.S)
pruefe('P2-11', produktwahl is not None
       and 'role="tab"' not in produktwahl.group()
       and 'aria-pressed' in produktwahl.group(),
       'Die Produktwahl ist als Umschalter ausgezeichnet, nicht als Tab')
pruefe('P2-12', 'id="karte-stand"' in H and 'aria-live="polite"' in H and 'standMelden' in J,
       'Die Kartenfilterung wird angesagt')

print('\nP3 — Feinschliff')
pruefe('P3-01', 'meta-kurz' in H and '.meta-kurz { display: inline; }' in C,
       'Die Metazeile hat eine kurze Fassung fuer schmale Fenster')
pruefe('P3-03', 'Station mit sieben freien Rädern' not in H,
       'Die Legende ist grammatikalisch richtig')
pruefe('P3-04', 'font: 700 13px/1.3 var(--mono)' in C,
       'Die Fussmarke ist mindestens 13 px gross')
pruefe('P3-06', 'id="live-stand"' in H and 'standSchreiben' in J,
       'Die Live-Zahl traegt einen Aktualitaetszeitpunkt')

print('\nGrundlagen')
ids = re.findall(r'\bid="([^"]+)"', H)
doppelt = {i for i in ids if ids.count(i) > 1}
pruefe('HTML', not doppelt, f'Keine doppelten ids{" — " + ", ".join(sorted(doppelt)) if doppelt else ""}')
pruefe('HTML', H.count('<h1') <= 2, 'Hoechstens die beiden Buehnen-Schlagzeilen als h1')

print('\nHandarbeit — vom Pruefer nicht entscheidbar:')
print('  · Registrierung gegen den echten Dienst durchspielen (Passworteingabe)')
print('  · Bildschirmleser auf der Karte und im Dialog')
print('  · Optischer Eindruck bei 390, 768, 900, 1024 und 1280 px')

print()
if fehler:
    print(f'{len(fehler)} Punkt(e) offen.')
    sys.exit(1)
print('Alle geprueften Punkte des Audits sind erledigt.')
