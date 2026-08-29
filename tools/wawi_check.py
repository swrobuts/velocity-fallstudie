#!/usr/bin/env python3
"""Statische Gegenprobe zum Vertrag zwischen HTML und JavaScript der
Warenwirtschaft (wawi/). Vorbild: tools/ux_check.py, das denselben
Dienst fuer die Website leistet.

Neun Skripte teilen sich hier einen einzigen, ungemodulten Namensraum
(config.js, daten.js, anmeldung.js, rahmen.js und fuenf Arbeitsbereiche).
Diese Datei zaehlt sie NICHT auf - sie liest sie aus wawi/index.html
heraus, aus demselben Grund, aus dem tools/wawi_veroeffentlichen.sh das
tut (siehe Kopf dort): eine gepflegte Liste ist nach dem naechsten
Arbeitsbereich veraltet, ohne dass es auffiele, und genau ein neuer
Arbeitsbereich hat den Menuepunkt "Auswertungen" schon einmal spurlos
verschwinden lassen (doppeltes `let unterbereich` - ein SyntaxError ohne
jede Fehlermeldung im Browser, siehe Pruefung NAMENSRAUM unten).

Was geprueft wird:
  ABDECKUNG  der Pruefer meldet je Datei, wieviel er nach dem Abzug der
             Kommentare ueberhaupt noch sieht, und faellt durch, wenn
             dabei eine oberste Deklaration verschwindet - die Antwort
             auf den schwersten Befund der dritten Runde, bei dem ein
             Kommentar ein Drittel von rahmen.js unsichtbar machte,
             ohne dass es auffiel (siehe ohne_js_kommentare() unten)
  ANKER      jede id, die per getElementById gesucht wird, existiert
             (im statischen HTML oder als von einem Skript selbst
             erzeugtes Element)
  ZUSTAND    jeder id="zustand-*" im HTML wird im JavaScript geschaltet
  STATUS     die Statuszeile traegt role="status" und aria-live
  LABEL      jedes <input> hat eine Beschriftung - <label for> oder
             aria-label -, dynamisch erzeugte Formularfelder ebenso
  FOKUS      style.css definiert :focus-visible
  TASTATUR   Strg+S und Escape werden behandelt
  SYNTAX     jedes Skript ist fuer sich genommen syntaktisch gueltig
  NAMENSRAUM keine oberste Deklaration (let/const/function) kommt in
             mehr als einem der neun Skripte vor
  VORGANG    jede *Aufbauen()-Funktion beginnt mit neuerVorgang(); die
             vier Bausteine zeigeListe/meldeVorgang/zeigeLeermaske/
             zeigeUnterreiter werden nirgends ohne die Kennung als
             erstes Argument aufgerufen

Was hier NICHT geprueft werden kann, steht am Ende als Handarbeit.

Aufruf:  python3 tools/wawi_check.py
"""
import re
import subprocess
import sys
from pathlib import Path

WURZEL = Path(__file__).resolve().parents[1]
WAWI = WURZEL / 'wawi'

fehler: list[str] = []


def pruefe(kennung: str, bedingung: bool, klartext: str) -> None:
    if bedingung:
        print(f'  ok   {kennung}  {klartext}')
    else:
        print(f'  FEHL {kennung}  {klartext}')
        fehler.append(f'{kennung}: {klartext}')


def ohne_js_kommentare(text: str) -> str:
    """Kommentare aus JavaScript entfernen - zeichenweise, NICHT per
    Textersetzung.

    WARUM ZEICHENWEISE, UND WAS DIE TEXTERSETZUNG GEKOSTET HAT
    Bis zur vierten Pruefrunde stand hier re.sub(r'/\\*.*?\\*/', ...) mit
    re.S. Diese Ersetzung kennt keine Zeichenketten und keine
    Zeilenkommentare: schreibt jemand in einem //-Kommentar die Wortfolge
    "filterleiste()/*Aufbauen()", so bildet der Schraegstrich vor dem
    Stern fuer sie einen Blockkommentar-Anfang, der erst am naechsten
    echten */ endet. Genau das ist passiert - die dritte Pruefrunde fand
    2.918 von 9.200 Zeilen in rahmen.js (32 % der Datei, darin 33
    Funktionsdefinitionen) fuer diesen Pruefer unsichtbar, OHNE dass er
    etwas gemeldet haette.

    Behoben wurde damals nur der eine Kommentar, nicht der Mechanismus.
    Die vierte Runde hat den Fall kuenstlich wiederhergestellt und
    nachgewiesen, dass der Pruefer ihn weiterhin uebersieht. Deshalb
    jetzt ein Abtaster, der die vier Zustaende von JavaScript-Quelltext
    unterscheidet - Code, Zeichenkette ('/"/`), Zeilenkommentar,
    Blockkommentar. Ein /* in einer Zeichenkette oder hinter // beginnt
    damit keinen Kommentar mehr, weil der Abtaster dort gar nicht nach
    Kommentaranfaengen sucht.

    Die verbleibende Feinheit sind regulaere Ausdruecke im Quelltext
    (/.../): ein Schraegstrich beginnt hier nur dann einen Kommentar,
    wenn ihm ein / oder * unmittelbar FOLGT. In einem Regexliteral
    stuende an dieser Stelle ein maskiertes Zeichen (\\/ oder \\*), nie
    ein blankes. Die Pruefung ABDECKUNG weiter unten misst ausserdem
    nach, ob dabei Code verschwunden ist - sie ist die Rueckversicherung
    gegen genau die Sorte Fehler, die diese Funktion frueher hatte."""
    heraus = []
    i, n = 0, len(text)
    while i < n:
        z = text[i]
        if z in ('"', "'", '`'):
            heraus.append(z)
            i += 1
            while i < n:
                heraus.append(text[i])
                if text[i] == '\\':
                    i += 1
                    if i < n:
                        heraus.append(text[i])
                        i += 1
                    continue
                if text[i] == z:
                    i += 1
                    break
                i += 1
            continue
        if z == '/' and i + 1 < n and text[i + 1] == '/':
            while i < n and text[i] != '\n':
                i += 1
            continue
        if z == '/' and i + 1 < n and text[i + 1] == '*':
            i += 2
            while i + 1 < n and not (text[i] == '*' and text[i + 1] == '/'):
                # Zeilenumbrueche erhalten: die Pruefungen unten arbeiten
                # zeilenweise (^-Anker), ein verschluckter Umbruch klebte
                # zwei Zeilen zusammen und veraenderte ihren Anfang.
                if text[i] == '\n':
                    heraus.append('\n')
                i += 1
            i += 2
            continue
        heraus.append(z)
        i += 1
    return ''.join(heraus)


def ohne_html_kommentare(text: str) -> str:
    """<!-- --> entfernen. Eigene Funktion, seit der JS-Abtaster oben
    zeichenweise arbeitet: HTML ist kein JavaScript, und die frueher
    gemeinsame Funktion lief den JS-Regeln ueber index.html hinweg."""
    return re.sub(r'<!--.*?-->', '', text, flags=re.S)


def ohne_css_kommentare(text: str) -> str:
    """/* */ entfernen. In CSS gibt es weder //-Kommentare noch
    Template-Literale; die einfache Ersetzung ist hier korrekt."""
    return re.sub(r'/\*.*?\*/', '', text, flags=re.S)


HTML_ROH = (WAWI / 'index.html').read_text(encoding='utf-8')
CSS = ohne_css_kommentare((WAWI / 'style.css').read_text(encoding='utf-8'))
H = ohne_html_kommentare(HTML_ROH)

# ---- Skripte einlesen: aus index.html, nicht aus einer gepflegten Liste ----
# Zeichenklasse absichtlich weit ([A-Za-z0-9_.-]): die frueher engere
# ([a-z_]) haette ein spaeteres "bereich2.js" oder "wawi-hilfe.js"
# STILLSCHWEIGEND uebergangen - der Pruefer haette acht von neun Dateien
# geprueft und trotzdem gruen gemeldet. Eine Adresse mit Protokoll (die
# beiden CDN-Skripte) kann nicht hineinfallen, weil sie : und / enthaelt.
# (?:\?v=[0-9a-f]+)? seit dem 29.08.2026: die Warenwirtschaft traegt jetzt
# Versionsstempel wie die Kundenwebsite (siehe tools/versionieren.py).
# Ohne diesen Zusatz fand das Muster kein einziges Skript mehr - der
# Pruefer haette stumm nichts geprueft und Vollzug gemeldet. Er hat es
# selbst bemerkt und gewarnt; genau dafuer steht die Warnung unten.
SKRIPT_NAMEN = re.findall(r'<script src="([A-Za-z0-9_.-]+\.js)(?:\?v=[0-9a-f]+)?"', H)
if not SKRIPT_NAMEN:
    print('WARNUNG: kein einziges lokales <script> in wawi/index.html gefunden - '
          'der Pruefer haette nichts geprueft.')
    sys.exit(1)

SKRIPTE_ROH = {name: (WAWI / name).read_text(encoding='utf-8') for name in SKRIPT_NAMEN}
SKRIPTE = {name: ohne_js_kommentare(text) for name, text in SKRIPTE_ROH.items()}
JS_GESAMT = '\n'.join(SKRIPTE.values())

print(f'Gefundene Skripte ({len(SKRIPT_NAMEN)}, aus wawi/index.html gelesen): '
      f'{", ".join(SKRIPT_NAMEN)}\n')

# =====================================================================
# ABDECKUNG — der Pruefer misst sich selbst
# =====================================================================
# "Eine gruene Pruefung, die nichts prueft, ist gefaehrlicher als eine
# rote." Der schwerste Befund der dritten Runde stand nicht in der
# Oberflaeche, sondern hier: ein Kommentar hatte den Pruefer fuer ein
# Drittel von rahmen.js blind gemacht, UND ER MELDETE NICHTS. Genau das
# soll ab hier unmoeglich sein - nicht nur, weil ohne_js_kommentare()
# oben jetzt richtig abtastet (auch ein Abtaster kann Fehler haben),
# sondern weil der Pruefer laut sagt, wieviel er sieht, und stehen
# bleibt, wenn ihm eine oberste Deklaration abhandenkommt.
#
# Verglichen werden die obersten Deklarationen VOR und NACH dem
# Entfernen der Kommentare. Verschwindet eine, gibt es genau zwei
# Moeglichkeiten, und beide gehoeren gemeldet: entweder hat der
# Kommentarabtaster Code verschluckt (der Fehler von damals), oder es
# steht auskommentierter Code in der Datei (der dort nichts zu suchen
# hat - was nicht laeuft, gehoert geloescht, die Versionsverwaltung
# erinnert sich auch ohne Leiche).
print('Vertrag: der Pruefer sieht jede Datei ganz')
OBERSTE_FUNKTION = re.compile(r'^(?:async\s+)?function\s+(\w+)\s*\(', re.M)
OBERSTE_BINDUNG = re.compile(r'^(?:let|const)\s+(\w+)', re.M)
abdeckung_zeichen = [0, 0]
for name in SKRIPT_NAMEN:
    roh, sicht = SKRIPTE_ROH[name], SKRIPTE[name]
    abdeckung_zeichen[0] += len(roh)
    abdeckung_zeichen[1] += len(sicht)
    verloren = ((set(OBERSTE_FUNKTION.findall(roh)) - set(OBERSTE_FUNKTION.findall(sicht)))
                | (set(OBERSTE_BINDUNG.findall(roh)) - set(OBERSTE_BINDUNG.findall(sicht))))
    anteil = 100 * len(sicht) / len(roh) if roh else 0
    pruefe('ABDECKUNG', not verloren,
           f'{name}: {len(roh.splitlines())} Zeilen, {anteil:.0f} % Zeichen nach Kommentarabzug, '
           f'{len(OBERSTE_FUNKTION.findall(sicht))} oberste Funktionen sichtbar'
           + ('' if not verloren else
              f' — VERSCHWUNDEN: {", ".join(sorted(verloren))}'))
print(f'  ---- zusammen {abdeckung_zeichen[1]} von {abdeckung_zeichen[0]} Zeichen '
      f'({100 * abdeckung_zeichen[1] / abdeckung_zeichen[0]:.1f} %) unter Pruefung')

# =====================================================================
# ANKER — jede id, die gesucht wird, existiert irgendwo
# =====================================================================
print('Vertrag: jede id, die per getElementById gesucht wird, existiert')

statische_ids = set(re.findall(r'\bid="([^"]+)"', H))

# Von einem Skript selbst erzeugte ids, literal zugewiesen
# (el.id = '...' oder el.id = "..."). Beide Anfuehrungszeichen, aus
# demselben Grund wie unten bei getElementById: der Bestand schreibt
# heute durchgehend einfache, aber ein spaeteres doppeltes waere sonst
# unsichtbar - eine Luecke, die sich niemand meldet.
dynamische_ids = set(re.findall(r"\.id\s*=\s*'([^']+)'", JS_GESAMT))
dynamische_ids |= set(re.findall(r'\.id\s*=\s*"([^"]+)"', JS_GESAMT))

# ... oder als Template-Literal mit einem zur Laufzeit erst feststehenden
# Rest (zeigeMaske() in rahmen.js: `feld-maske-${feld.name}`). Geprueft
# wird gegen den literalen Anfangsteil vor dem ersten ${.
dynamische_praefixe = tuple(sorted(set(
    re.findall(r"\.id\s*=\s*`([a-z0-9_-]+)\$\{", JS_GESAMT)
)))

gesuchte_ids = sorted(set(re.findall(r"getElementById\(\s*'([^']+)'\s*\)", JS_GESAMT))
                      | set(re.findall(r'getElementById\(\s*"([^"]+)"\s*\)', JS_GESAMT)))
for i in gesuchte_ids:
    vorhanden = (i in statische_ids or i in dynamische_ids
                 or any(i.startswith(p) for p in dynamische_praefixe))
    pruefe('ANKER', vorhanden, f"getElementById('{i}') findet ein Ziel")

# =====================================================================
# ZUSTAND — jede Zustandsschale existiert und wird geschaltet
# =====================================================================
# Nicht auf vier Namen festgelegt: der Dateikopf von rahmen.js selbst
# spricht (noch) von vier Zustaenden, tatsaechlich sind es fuenf
# (zustand-ohne-rolle kam mit der Sammelnachbesserung dazu, ohne dass
# der Kommentar nachgezogen wurde). Ein Pruefer, der die Namen aus dem
# HTML AUSLIEST statt sie aufzuzaehlen, faellt bei einer sechsten Schale
# nicht durch Schweigen aus.
print('\nVertrag: jede Zustandsschale existiert und wird im JavaScript geschaltet')
zustaende = sorted(set(re.findall(r'\bid="(zustand-[a-z-]+)"', H)))
pruefe('ZUSTAND', len(zustaende) >= 2,
       f'mindestens zwei Zustandsschalen im HTML gefunden ({len(zustaende)}: {", ".join(zustaende)})')
for z in zustaende:
    # Der Name muss im Skript vorkommen (bereits kommentarbereinigt) -
    # als Zeichenkette in zeige(...)/getElementById(...) o.ae. Ein
    # Zustand, der nur im HTML existiert, aber nie geschaltet wird, ist
    # tot: entweder immer sichtbar (hidden bleibt stehen) oder nie.
    pruefe('ZUSTAND', f"'{z}'" in JS_GESAMT, f'{z} wird im JavaScript referenziert')

# =====================================================================
# STATUS — die Statuszeile bestaetigt jede Buchung
# =====================================================================
print('\nVertrag: die Statuszeile ist barrierefrei ausgezeichnet')
statuszeile = re.search(r'<footer[^>]*id="statuszeile"[^>]*>', H)
pruefe('STATUS', statuszeile is not None and 'role="status"' in statuszeile.group(),
       'Die Statuszeile traegt role="status"')
pruefe('STATUS', statuszeile is not None and 'aria-live' in statuszeile.group(),
       'Die Statuszeile traegt aria-live')

# =====================================================================
# LABEL — jedes Eingabefeld hat eine Beschriftung
# =====================================================================
print('\nVertrag: jedes Eingabefeld hat eine Beschriftung')
label_fors = set(re.findall(r'<label\s+for="([^"]+)"', H))
for feld in re.findall(r'<input\b[^>]*>', H):
    id_treffer = re.search(r'\bid="([^"]+)"', feld)
    id_text = id_treffer.group(1) if id_treffer else '(ohne id)'
    hat_label = bool(id_treffer and id_treffer.group(1) in label_fors)
    hat_aria = 'aria-label=' in feld or 'aria-labelledby=' in feld
    pruefe('LABEL', hat_label or hat_aria,
           f'<input id="{id_text}"> hat ein <label for> oder ein aria-label')

# Dynamisch erzeugte Formularfelder (zeigeMaske(), bestaetige() und
# frageNachGrund() in rahmen.js) tragen kein statisches <label> - Feld
# und Beschriftung entstehen im selben Funktionsaufruf. Erkennungsmerkmal
# ist die Namenskonvention dieser Warenwirtschaft: id-Werte fuer
# Formularfelder beginnen mit "feld-" oder "dialog-"; Container wie
# "werkzeugleiste" oder "listenkoerper" tun das nicht und werden hier
# bewusst nicht verlangt, ein <label> zu haben - sie sind keine
# Eingabefelder. Verglichen wird der VOLLE Zuweisungsausdruck (inklusive
# Anfuehrungszeichen bzw. Template-Literal): ".id = `feld-maske-${feld.name}`"
# muss wortgleich auch als ".htmlFor = ..." auftauchen.
id_ausdruecke = re.findall(r"\.id\s*=\s*([`'\"][^;]*?[`'\"])\s*;", JS_GESAMT)
label_ausdruecke = set(re.findall(r"\.htmlFor\s*=\s*([`'\"][^;]*?[`'\"])\s*;", JS_GESAMT))
for ausdruck in sorted(set(id_ausdruecke)):
    inhalt = ausdruck.strip('`\'"')
    if not inhalt.startswith(('feld-', 'dialog-')):
        continue   # kein Formularfeld, sondern ein Container
    pruefe('LABEL', ausdruck in label_ausdruecke,
           f'dynamisches Feld {ausdruck} hat ein passendes label.htmlFor')

# =====================================================================
# FOKUS — sichtbarer Tastaturfokus
# =====================================================================
print('\nVertrag: sichtbarer Tastaturfokus ist definiert')
# Substring-Suche waere hier zu grob: ":focus-visible-erweitert { }" -
# eine ungueltige, wirkungslose Pseudoklasse - enthielte die Zeichenkette
# ":focus-visible" trotzdem und wuerde die Pruefung bestehen lassen,
# obwohl keine einzige echte :focus-visible-Regel mehr existiert. Der
# Lookahead verlangt, dass nach "focus-visible" kein weiteres
# Bezeichnerzeichen (Buchstabe, Ziffer, Bindestrich) folgt, sodass genau
# der Selektor erkannt wird - nicht jeder Text, der ihn als Praefix traegt.
pruefe('FOKUS', bool(re.search(r':focus-visible(?![\w-])', CSS)),
       'style.css definiert :focus-visible - ohne sie ist die Tastaturbedienung nur behauptet')

# =====================================================================
# TASTATUR — Strg+S speichert, Escape verwirft
# =====================================================================
print('\nVertrag: Tastatur vor Maus')
pruefe('TASTATUR', "e.key === 'Escape'" in JS_GESAMT,
       'Escape wird im JavaScript behandelt')
pruefe('TASTATUR',
       bool(re.search(r"e\.key === 's'[^\n]*(?:e\.ctrlKey|e\.metaKey)", JS_GESAMT)),
       'Strg+S (bzw. Cmd+S auf dem Mac) wird im JavaScript behandelt')

# =====================================================================
# SYNTAX — jedes Skript ist fuer sich genommen gueltig
# =====================================================================
# Faengt NICHT den Namensraum-Fehler unten (der entsteht erst, wenn
# mehrere Skripte NACHEINANDER im selben globalen Gueltigkeitsbereich
# laufen) - eine einzelne Datei mit einem doppelten "let" in sich selbst
# waere trotzdem ein echter, hiervon erfasster SyntaxError.
print('\nVertrag: jedes Skript ist syntaktisch gueltig')
def node_fehlermeldung(stderr: str) -> str:
    # node --check schliesst mit einer Versionszeile ("Node.js v26.6.0"),
    # nicht mit der eigentlichen Meldung - die letzte Zeile zu nehmen
    # (naheliegend, und der erste Versuch hier) zeigt deshalb nur die
    # Laufzeitversion an, nie den SyntaxError selbst.
    for zeile in stderr.strip().splitlines():
        if 'Error' in zeile:
            return zeile.strip()
    return stderr.strip().splitlines()[0] if stderr.strip() else 'unbekannter Fehler'


for name in SKRIPT_NAMEN:
    ergebnis = subprocess.run(['node', '--check', str(WAWI / name)],
                               capture_output=True, text=True)
    pruefe('SYNTAX', ergebnis.returncode == 0,
           f'{name} ({node_fehlermeldung(ergebnis.stderr) if ergebnis.returncode else "in Ordnung"})')

# =====================================================================
# NAMENSRAUM — keine oberste Deklaration doppelt ueber alle Skripte
# =====================================================================
# Der tatsaechliche Vorfall: auswertungen.js und instandhaltung.js
# hatten unabhaengig voneinander ein oberstes "let unterbereich"
# angelegt. Nicht-Modul-Skripte teilen sich einen lexikalischen
# Gueltigkeitsbereich; das zweite "let" desselben Namens ist dort ein
# SyntaxError ("has already been declared"), sobald der Browser das
# zweite Skript ausfuehrt - und zwar OHNE dass die Konsole differenziert
# meldet, WAS deswegen fehlt: die gesamte Datei danach laeuft nicht mehr,
# also blieb der Menuepunkt "Auswertungen" (aus rahmen.js, das VOR den
# Bereichen laedt) unberuehrt sichtbar, aber jeder Bereich, dessen
# bereichAnmelden()-Aufruf HINTER der zweiten, gescheiterten Datei stand,
# meldete sich nie an. Heute heisst die Variable in auswertungen.js
# "auswertungenReiter" - dieser Pruefer haelt fest, dass sie es bleibt.
print(f'\nVertrag: kein Name kollidiert ueber die {len(SKRIPTE)} Skripte hinweg')
fundort: dict[str, set[str]] = {}
for name, text in SKRIPTE.items():
    for m in re.finditer(r'^(?:let|const)\s+(\w+)', text, re.M):
        fundort.setdefault(m.group(1), set()).add(name)
    for m in re.finditer(r'^(?:async\s+)?function\s+(\w+)\s*\(', text, re.M):
        fundort.setdefault(m.group(1), set()).add(name)
doppelt = {n: d for n, d in fundort.items() if len(d) > 1}
if doppelt:
    for name, dateien in sorted(doppelt.items()):
        pruefe('NAMENSRAUM', False,
               f'{name} ist oberste Deklaration in mehr als einem Skript: {", ".join(sorted(dateien))}')
else:
    pruefe('NAMENSRAUM', True,
           f'{len(fundort)} oberste Deklarationen ueber {len(SKRIPTE)} Skripte, keine doppelt')

# =====================================================================
# VORGANG — der Vertrag der Darstellungsbausteine
# =====================================================================
print('\nVertrag: die Vorgangs-Kennung wird durchgereicht, nicht vergessen')
# Zwei getrennte Zusicherungen, beide aus derselben Nachbesserung
# (siehe Dateikopf-Kommentar bei neuerVorgang() in rahmen.js):
#
#   1. Jede *Aufbauen()-Funktion - der Einstieg, den bereichWechseln()
#      und jeder Reiterwechsel erneut aufruft - zieht sich als ALLER-
#      ERSTE Anweisung eine eigene Kennung.
#   2. Die vier Bausteine, die etwas auf den Bildschirm schreiben,
#      tragen diese Kennung als ERSTES Argument vor sich her - im
#      gesamten Bestand einheitlich unter dem Namen "vorgang", auch in
#      Hilfsfunktionen, die sie nur durchreichen (schaedenZeigen(vorgang)
#      in instandhaltung.js etwa zieht KEINE eigene, siehe dortiger
#      Kommentar). Ein Aufruf mit einem anderen ersten Argument -
#      typischerweise, weil die Kennung schlicht VERGESSEN wurde und
#      sich dadurch jedes nachfolgende Argument um eine Stelle
#      verschiebt - ist die Fehlerklasse, die zwei Pruefrunden gekostet
#      hat (eine ueberholte Antwort ueberschreibt die neue Anzeige).
BAUSTEINE = ('zeigeListe', 'meldeVorgang', 'zeigeLeermaske', 'zeigeUnterreiter')
KENNUNG = 'vorgang'

# rahmen.js definiert die vier Bausteine (function zeigeListe(kennung, ...)
# sieht fuer eine reine Textsuche wie ein AUFRUF mit erstem Argument
# "kennung" aus) - deshalb bei der Aufruf-Suche aussen vor, aber bei der
# *Aufbauen()-Suche ohnehin irrelevant, da rahmen.js selbst keine
# *Aufbauen()-Funktion der fuenf Arbeitsbereiche enthaelt.
AUFRUFTEXT = '\n'.join(t for n, t in SKRIPTE.items() if n != 'rahmen.js')

for name, text in SKRIPTE.items():
    if name == 'rahmen.js':
        continue   # dort STEHEN die Bausteine, dort werden sie nicht aufgerufen
    grenzen = [m.start() for m in re.finditer(r'^(?:async\s+)?function\s+\w+\s*\([^)]*\)\s*\{', text, re.M)]
    grenzen.append(len(text))
    for i in range(len(grenzen) - 1):
        block = text[grenzen[i]:grenzen[i + 1]]
        kopf = re.match(r'^(?:async\s+)?function\s+(\w+)\s*\([^)]*\)\s*\{', block)
        funktionsname = kopf.group(1)
        if not funktionsname.endswith('Aufbauen'):
            continue
        rumpf = block[kopf.end():]
        erste_zeilen = [z for z in rumpf.splitlines() if z.strip()]
        erste = erste_zeilen[0].strip() if erste_zeilen else ''
        beginnt_richtig = bool(re.match(
            rf'(?:const|let)\s+{KENNUNG}\s*=\s*neuerVorgang\(\)', erste))
        pruefe('VORGANG', beginnt_richtig,
               f'{name}: {funktionsname}() beginnt mit const {KENNUNG} = neuerVorgang() '
               f'(erste Zeile: {erste[:60]!r})')

for baustein in BAUSTEINE:
    aufrufe = re.findall(rf'\b{baustein}\(\s*([A-Za-z_$][\w$]*)\s*,', AUFRUFTEXT)
    if not aufrufe:
        pruefe('VORGANG', False, f'{baustein}() wird ueberhaupt aufgerufen (kein Aufruf gefunden)')
        continue
    falsch = [a for a in aufrufe if a != KENNUNG]
    pruefe('VORGANG', not falsch,
           f'{baustein}() traegt ueberall "{KENNUNG}" als erstes Argument'
           + ('' if not falsch else f' — gefunden: {", ".join(sorted(set(falsch)))}'))

print('\nHandarbeit — vom Pruefer nicht entscheidbar:')
print('  · Tab-Reihenfolge und Pfeiltasten in der Arbeitsliste wirklich durchspielen')
print('  · Bildschirmleser auf der Anmeldemaske und in den Dialogen')
print('  · Kontrast der Statuszeilen-Farbklassen (gut/warnung/schlecht) auf dem Bildschirm messen')
print('  · Anmeldung mit M-0001 (alle vier Rollen) und mit einem reinen Kundenkonto durchklicken')

print()
if fehler:
    print(f'{len(fehler)} Punkt(e) offen.')
    sys.exit(1)
print('Alle geprueften Punkte des Vertrags sind erledigt.')
