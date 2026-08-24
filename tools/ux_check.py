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
pruefe('P1-02', 'karte-mit-typ' in J and 'Auf der Karte zeigen' in J
       and 'aria-label="${escapeHtml(k.bezeichnung)} auf der Karte zeigen"' in J,
       'Tarif-Knopf sagt kurz was er tut und traegt den vollen Namen')
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
pruefe('P2-04', 'clamp(180vh, 40vh + 250vw, 360vh)' in C,
       'Die Buehne ist mobil kurz und waechst stetig mit der Breite')
# Die Fassung vom 24.08. nannte "Wuerzburg & Schweinfurt". Schweinfurt ist
# seither ausgegliedert - vierzig Kilometer ohne Verbindung sind kein Netz,
# sondern zwei. Geprueft wird jetzt, dass keine Spur davon zurueckbleibt.
pruefe('P2-05', 'Schweinfurt' not in H and 'Schweinfurt' not in J,
       'Keine Spur von Schweinfurt mehr in der Oberflaeche')
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
pruefe('HTML', H.count('<h1') <= 3, 'Hoechstens die drei Buehnen-Schlagzeilen als h1')

# =====================================================================
# Regressionspruefung vom 24.08.2026, zweiter Durchgang
# =====================================================================
print('\n\nRegressionspruefung 24.08.2026 — zweiter Durchgang\n')

print('P0 — Stopper')
B = (WURZEL / 'db/aufbau/0003_bereich_b_netz_und_flotte.sql').read_text(encoding='utf-8')
for funktion in ('trg_radposition_pruefen', 'trg_stellplaetze_pruefen'):
    stelle = B.index(f'create or replace function velocity.{funktion}()')
    kopf = B[stelle:stelle + 320]
    pruefe('P0-01', 'security definer' in kopf,
           f'{funktion} laeuft mit den Rechten des Eigners')
pruefe('P0-01', (WURZEL / 'db/durchstich.py').exists(),
       'Der Weg bis zur Abrechnung ist als Test hinterlegt')

print('\nP1 — kritisch')
pruefe('P1-01', 'Error sending confirmation email' in AUTH,
       'Der Fehler des Mailversands ist uebersetzt')
pruefe('P1-01', 'Unuebersetzte Auth-Meldung' in AUTH,
       'Unbekannte Meldungen werden gerahmt statt roh durchgereicht')
pruefe('P1-01', 'Erneut versuchen' in J, 'Nach einem Fehlversuch gibt es einen zweiten')
pruefe('P1-02', 'passwortZuruecksetzen' in AUTH and 'resetPasswordForEmail' in AUTH,
       'Passwort zuruecksetzen ist verdrahtet')
pruefe('P1-03', 'konto-menue' in H and 'konto-abmelden' in H,
       'Abmelden ist ein eigener, beschrifteter Eintrag')
pruefe('P1-03', 'aria-label\', `Konto von ${name} — Menü öffnen`' in J,
       'Der Kopfknopf sagt, was er tut')
pruefe('P1-04', 'markerEntflechten' in J,
       'Ueberdeckte Marker werden aufgefaechert')
pruefe('P1-04', 'hat-infofenster' in J and 'hat-infofenster .map-controls' in C,
       'Bedienelemente treten hinter das Infofenster zurueck')
pruefe('P1-04', 'marker-rund' in J and '.marker-rund { clip-path: circle(50%); }' in C,
       'Die Trefferflaeche folgt der sichtbaren Scheibe')

print('\nP2 — wichtig')
pruefe('P2-01', 'netzGrenzen' in J and 'L.latLngBounds([])' in J,
       'Die Gebietsgrenzen werden nicht mehr mutiert')
pruefe('P2-01', J.count('animate: false') >= 3,
       'Der Ortswechsel haengt nicht an einer Animation')
pruefe('P2-02', 'rechnerZeichnen(minutenSetzen(m, true))' in J,
       'Ungueltige Werte werden schon beim Tippen begrenzt')
pruefe('P2-03', 'inert' in (SRC / 'hero.js').read_text(encoding='utf-8'),
       'Unsichtbare Bedienflaechen sind inert')
pruefe('P2-05', 'clamp(180vh, 40vh + 250vw, 360vh)' in C
       and '.scroll-story { height: 210vh' not in C,
       'Kein Stufensprung mehr zwischen 900 und 901 px')
pruefe('P2-06', 'stationsliste' in H and 'stationslisteZeichnen' in J,
       'Die Stationsliste ist der verlaessliche Weg zur Station')
pruefe('P2-07', 'karte-leer' in H and 'karte-alle-typen' in H,
       'Der leere Filterzustand bietet einen Weg zurueck')

print('\nP3 — Feinschliff')
pruefe('P3-01', 'Auf der Karte zeigen' in J,
       'Die Tarif-Knoepfe tragen dieselbe kurze Aufschrift')
pruefe('P3-03', 'Bikes' not in H, 'Keine englischen Produktbegriffe in der Ansprache')
pruefe('P3-04', "querySelector('.sprungmarke')" in J,
       'Die Sprungmarke setzt den Fokus auf ihr Ziel')

print('\nCache')
fehlend = [d for d in re.findall(r'(?:src|href)="(?!https?:|//|#|mailto:)([A-Za-z0-9_./-]+\.(?:js|css))(\?v=[0-9a-f]+)?"', HTML)
           if not d[1]]
pruefe('CACHE', not fehlend,
       f'Jede eigene Datei traegt einen Fingerabdruck{"" if not fehlend else " — fehlt bei " + ", ".join(d[0] for d in fehlend)}')

# =====================================================================
# Dritter Durchgang, 24.08.2026
# =====================================================================
print('\n\nRegressionspruefung 24.08.2026 — dritter Durchgang\n')

print('P0 — fachliche Stopper')
pruefe('P0-01', 'db_Stations[0]' not in J,
       'Keine stillschweigende Vorgabestation mehr bei der Rueckgabe')
pruefe('P0-01', 'rueckgabe-modal' in H and 'rueckgabeOeffnen' in J,
       'Die Rueckgabe fragt nach dem Ort')
pruefe('P0-01', 'imGeschaeftsgebiet' in J,
       'Ein freier Standort wird vor dem Buchen geprueft')
pruefe('P0-01', "name=\"rueckgabeart\"" in H,
       'Station oder freies Abstellen sind zwei bewusste Wege')

ALT = (WURZEL / 'db/aufbau/0013_altsystem_abloesen.sql')
pruefe('P0-02', ALT.exists(), 'Der Altsystem-Trigger ist entschaerft (0013)')
if ALT.exists():
    # Ohne die Kommentare zu entfernen zaehlt die Erlaeuterung dessen,
    # was frueher dort stand, als Befund - derselbe Fehler, den der
    # Frontend-Pruefer schon einmal gemacht hat.
    quelle = re.sub(r'--[^\n]*', '', ALT.read_text(encoding='utf-8'))
    # Die Funktion ist inzwischen ein Leerlauf - sie legt gar keinen
    # Altkunden mehr an. Damit kann sie weder eine Registrierung zu Fall
    # bringen noch Anmeldungen fremder Projekte einsammeln.
    pruefe('P0-02', 'insert into "cityBikesRental".kunde' not in quelle,
           'Das Altsystem legt bei einer Anmeldung keinen Kunden mehr an')
    pruefe('P0-02', 'Leerlauf' in quelle,
           'Der Trigger auf der gemeinsamen auth.users tut nichts mehr')
pruefe('P0-02', 'Database error saving new user' in AUTH,
       'Die Meldung bei vorhandenen Kundendaten ist verstaendlich')
pruefe('P0-02', 'hilfe@velocity-wue.de' in AUTH,
       'Sie nennt einen Weg statt eines sinnlosen zweiten Versuchs')

print('\nP1 — kritisch')
pruefe('P1-01', '.toastify { top: 108px !important; }' in C,
       'Kurzmeldungen verdecken den Login-Knopf nicht mehr')
pruefe('P1-01', 'function benachrichtigen()' in AUTH and 'setTimeout(async () =>' in AUTH,
       'Der Auth-Rueckruf wartet nicht mehr in der Sperre auf einen Netzaufruf')
pruefe('P1-03', 'rueckgabe-beleg' in H and 'belegZeigen' in J,
       'Der Abschluss bleibt als Beleg stehen')
pruefe('P1-03', 'beleg-posten' in H,
       'Der Beleg zeigt die gebuchten Positionen')

print('\nP2 — wichtig')
pruefe('P2-01', "rad?.typ_bezeichnung" in J and 'rental-preis' in H,
       'Der Fahrtbalken nennt Typ, Nummer und laufenden Betrag sofort')
pruefe('P2-02', "/versendet werden|Verbindung/" in J,
       'Ein zweiter Versuch wird nur angeboten, wo er helfen kann')
pruefe('P2-03', '[inert], [inert] * { pointer-events: none !important; }' in C,
       'Der Rueckfall fuer inert greift auch gegen spaetere Klassenregeln')

print('\nDatenmodell')
SICHTEN = (WURZEL / 'db/aufbau/0010_sichten.sql').read_text(encoding='utf-8')
RECHTE  = (WURZEL / 'db/aufbau/0011_sicherheit.sql').read_text(encoding='utf-8')
pruefe('SICHT', "'positionen'" in SICHTEN or 'as positionen' in SICHTEN,
       'v_meine_ausleihe liefert die gebuchten Positionen')
pruefe('RECHT', "'entgeltart'" in RECHTE,
       'authenticated darf entgeltart lesen — sonst bleibt die Sicht leer')
pruefe('LADEN', 'letzterLadeFehler' in (SRC / 'supabase.js').read_text(encoding='utf-8'),
       'Ein Ladefehler wird nicht mehr als leere Liste ausgegeben')

print('\nOberflaeche — Floskeln und Netzgroesse (25.08.)')
pruefe('TEXT', 'Jede Scheibe ist eine Station' not in H,
       'Die erklaerende Bildunterschrift der Karte ist weg')
pruefe('TEXT', 'Zahlung, Parken, Studierendentarif' not in H,
       'Das Inhaltsverzeichnis ueber der FAQ ist weg')
pruefe('TEXT', 'Finde das passende Rad an einer Station' not in H,
       'Die Fuellzeile unter "Bereit, wenn du es bist" ist weg')
pruefe('TEXT', 'Einfach, smart, elektrisch' not in H,
       'Die Dreiwortformel im Fuss ist weg')
pruefe('TEXT', 'Scrollen, um das Netz zu entdecken' not in H
       and '@keyframes tippen' in C,
       'Der Scrollhinweis ist ein Pfeil statt eines Satzes')
# Zweimal war der Pfeil zu leise, weil er nur aus einem Winkel bestand
# und keinen eigenen Grund hatte. Im echten Browser nachgesehen.
pruefe('TEXT', '.scroll-hint {' in C and 'border-radius: 50%' in
       C[C.index('.scroll-hint {'):C.index('.scroll-hint {') + 420],
       'Der Pfeil traegt eine eigene Scheibe und steht auf jedem Grund')

print('\nBuehne — Wechsel statt Ueberblendung (25.08.)')
MODELL = (SRC / 'velocity-scroll-model.js').read_text(encoding='utf-8')
pruefe('BUEHNE', 'velocity-bike-morph.js' not in re.sub(r'<!--.*?-->', '', HTML, flags=re.S),
       'Der WebGL-Morph wird nicht mehr geladen')
pruefe('BUEHNE', 'photo-wand' in H and 'velocity-wand' in C,
       'Die Wand liegt als eigene Ebene unter den Raedern')
pruefe('BUEHNE', 'rad-ebike-frei' in C and 'rad-city-frei' in C,
       'Die Raeder sind freigestellt')
pruefe('BUEHNE', 'var(--ebike-exit) * 104%' in C and '(1 - var(--city-enter)) * 104%' in C,
       'Sie wechseln den Platz - eine volle Bildbreite auseinander')
pruefe('BUEHNE', 'transitionCoverOpacity: 0,' in MODELL,
       'Kein Schleier mehr noetig: es gibt nichts zu ueberstrahlen')
produkt = re.search(r'<div class="product-tabs".*?</div>', H, flags=re.S)
pruefe('TEXT', produkt and produkt.group().count('<button') == 3,
       'Die Produktwahl fuehrt alle drei Fahrradtypen')
pruefe('TEXT', 'live-zahl' in H and '.live-zahl b {' in C,
       'Die Live-Zahl steht gross, nicht in Kleinversalien')

print('\nHandarbeit — vom Pruefer nicht entscheidbar:')
print('  · Registrierung gegen den echten Dienst durchspielen (Passworteingabe)')
print('  · Bildschirmleser auf der Karte und im Dialog')
print('  · Optischer Eindruck bei 390, 768, 900, 1024 und 1280 px')
print('  · Bestaetigungsmail wirklich empfangen (Postfach)')
print('  · python3 db/durchstich.py — Ausleihe bis Abrechnung gegen die echte Datenbank')

print()
if fehler:
    print(f'{len(fehler)} Punkt(e) offen.')
    sys.exit(1)
print('Alle geprueften Punkte des Audits sind erledigt.')
