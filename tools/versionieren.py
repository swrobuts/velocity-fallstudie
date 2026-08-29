#!/usr/bin/env python3
"""Fingerabdruck an jede eigene Datei haengen, die die Seite einbindet.

WARUM
Bei einer Pruefung von aussen am 24.08.2026 wurden vier kritische Befunde
gemeldet. Zwei davon - "passwortZuruecksetzen is not defined" und eine
Produktwahl ohne aria-pressed - waren zu diesem Zeitpunkt bereits behoben.
Der Pruefer hatte eine alte auth.js und eine alte hero.js im Cache. Das
kostete ihn Zeit und uns Glaubwuerdigkeit, und im Hoersaal wuerde es
dreissig Studierende gleichzeitig treffen.

WAS
script.js?v=a1b2c3d4 - der Wert ist die Pruefsumme des Inhalts. Aendert
sich die Datei, aendert sich die Adresse, und der Browser holt sie neu.
Aendert sie sich nicht, bleibt die Adresse gleich und der Cache greift
weiter. Kein Zeitstempel: der wuerde bei jedem Lauf alles entwerten.

AUFRUF
    python3 tools/versionieren.py          setzt die Stempel
    python3 tools/versionieren.py --pruefen   meldet nur Abweichungen
"""
import hashlib
import re
import sys
from pathlib import Path

WURZEL = Path(__file__).resolve().parents[1]
SRC = WURZEL / 'src'
SEITEN = ['index.html', 'rechtliches.html']
# Auch Stylesheets: die Bilder der Buehne stehen als url() darin, und
# ohne Stempel liefert der Browser sie aus dem Cache. Genau das ist am
# 25.08.2026 passiert - eine neu gebaute Wand kam nicht an, und der
# Fehler sah aus wie ein Fehler im Bild.
STYLESHEETS = ['style.css']
# Auch Skripte: script.js baut die Radkacheln und traegt die Bildpfade als
# Zeichenketten. Ohne Stempel entstehen ZWEI Adressen fuer dasselbe Bild -
# die gestempelte aus dem Stylesheet und die ungestempelte von hier. Der
# Browser haelt sie fuer verschiedene Dateien und laedt beide. Am
# 28.08.2026 gemessen: 1,6 MB Fotos wurden doppelt geholt.
SKRIPTE = ['script.js']
# ===== AUCH DIE WARENWIRTSCHAFT (29.08.2026) =====
# Sie war als einzige nie einbezogen. Begruendet hatte ich das damit, dass
# der Server 'cache-control: no-cache' schickt und der Browser deshalb
# ohnehin bei jedem Aufruf nachfragt. Die Beweislage sagt etwas anderes:
# der Nutzer meldete nach JEDER Auslieferung "unveraendert" - fuer den
# Uebergang, die Variable, das Tippziel, die Verdrahtung. Vier Aenderungen,
# vier Mal keine Wirkung. Das ist kein Zufallsmuster.
#
# Ein Stempel macht die Frage gegenstandslos: aendert sich die Datei,
# aendert sich ihre ADRESSE - und keine Zwischenstelle (Browser, Proxy,
# Netz) kann etwas Altes unter einer Adresse liefern, die es nie gab.
WAWI = WURZEL / 'wawi'
WAWI_SEITEN = ['index.html']


def fingerabdruck(pfad: Path) -> str:
    return hashlib.sha256(pfad.read_bytes()).hexdigest()[:8]


def stempeln(seite: Path, nur_pruefen: bool) -> list[str]:
    text = seite.read_text(encoding='utf-8')
    original = text
    abweichungen = []

    def ersetzen(treffer: re.Match) -> str:
        attribut, datei, alt = treffer.group(1), treffer.group(2), treffer.group(3)
        ziel = seite.parent / datei   # gegen das Verzeichnis DER SEITE
        if not ziel.exists():
            abweichungen.append(f'{seite.name}: {datei} fehlt')
            return treffer.group(0)
        neu = fingerabdruck(ziel)
        if alt != neu:
            abweichungen.append(f'{seite.name}: {datei} {alt or "ohne Stempel"} -> {neu}')
        return f'{attribut}="{datei}?v={neu}"'

    # Nur eigene Dateien: alles mit Schema oder fuehrendem Schraegstrich
    # bleibt unberuehrt, ebenso Sprungpunkte und mailto.
    muster = r'\b(src|href)="(?!https?:|//|#|mailto:)([A-Za-z0-9_./-]+\.(?:js|css))(?:\?v=([0-9a-f]*))?"'
    text = re.sub(muster, ersetzen, text)

    if not nur_pruefen and text != original:
        seite.write_text(text, encoding='utf-8')
    return abweichungen


def bilder_stempeln(datei: Path, nur_pruefen: bool) -> list[str]:
    """url(...) in einem Stylesheet mit dem Fingerabdruck der Datei versehen."""
    text = datei.read_text(encoding='utf-8')
    original = text
    abweichungen = []

    def ersetzen(treffer: re.Match) -> str:
        pfad, alt = treffer.group(1), treffer.group(2)
        ziel = (datei.parent / pfad).resolve()
        if not ziel.exists():
            abweichungen.append(f'{datei.name}: {pfad} fehlt')
            return treffer.group(0)
        neu = fingerabdruck(ziel)
        if alt != neu:
            abweichungen.append(f'{datei.name}: {pfad} {alt or "ohne Stempel"} -> {neu}')
        return f'url("{pfad}?v={neu}")'

    muster = (r'url\(\s*"(?!https?:|//|data:)'
              r'([A-Za-z0-9_./-]+\.(?:png|jpg|jpeg|webp|svg|avif|woff2?))'
              r'(?:\?v=([0-9a-f]*))?"\s*\)')
    text = re.sub(muster, ersetzen, text)

    if not nur_pruefen and text != original:
        datei.write_text(text, encoding='utf-8')
    return abweichungen


def bilder_in_skript_stempeln(datei: Path, nur_pruefen: bool) -> list[str]:
    """Bildpfade in Zeichenketten eines Skripts stempeln: 'assets/x.webp'."""
    text = datei.read_text(encoding='utf-8')
    original = text
    abweichungen = []

    def ersetzen(treffer: re.Match) -> str:
        pfad, alt = treffer.group(1), treffer.group(2)
        ziel = datei.parent / pfad
        if not ziel.exists():
            abweichungen.append(f'{datei.name}: {pfad} fehlt')
            return treffer.group(0)
        neu = fingerabdruck(ziel)
        if alt != neu:
            abweichungen.append(f'{datei.name}: {pfad} {alt or "ohne Stempel"} -> {neu}')
        return f"'{pfad}?v={neu}'"

    muster = (r"'(assets/[A-Za-z0-9_./-]+\.(?:png|jpg|jpeg|webp|svg|avif))"
              r"(?:\?v=([0-9a-f]*))?'")
    text = re.sub(muster, ersetzen, text)

    if not nur_pruefen and text != original:
        datei.write_text(text, encoding='utf-8')
    return abweichungen


def main() -> int:
    nur_pruefen = '--pruefen' in sys.argv
    alle = []
    # Die Bilder ZUERST: ihr Stempel steht im Stylesheet, und dessen
    # eigener Fingerabdruck muss den geaenderten Inhalt abbilden.
    for name in STYLESHEETS:
        datei = SRC / name
        if datei.exists():
            alle += bilder_stempeln(datei, nur_pruefen)
    for name in SKRIPTE:
        datei = SRC / name
        if datei.exists():
            alle += bilder_in_skript_stempeln(datei, nur_pruefen)
    for name in SEITEN:
        seite = SRC / name
        if seite.exists():
            alle += stempeln(seite, nur_pruefen)
    for name in WAWI_SEITEN:
        seite = WAWI / name
        if seite.exists():
            alle += stempeln(seite, nur_pruefen)

    if not alle:
        print('Alle Fingerabdruecke stimmen.')
        return 0
    for zeile in alle:
        print(('veraltet: ' if nur_pruefen else 'gesetzt:  ') + zeile)
    if nur_pruefen:
        print(f'\n{len(alle)} Abweichung(en) — python3 tools/versionieren.py')
        return 1
    print(f'\n{len(alle)} Stempel erneuert.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
