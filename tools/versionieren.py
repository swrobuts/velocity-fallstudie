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


def fingerabdruck(pfad: Path) -> str:
    return hashlib.sha256(pfad.read_bytes()).hexdigest()[:8]


def stempeln(seite: Path, nur_pruefen: bool) -> list[str]:
    text = seite.read_text(encoding='utf-8')
    original = text
    abweichungen = []

    def ersetzen(treffer: re.Match) -> str:
        attribut, datei, alt = treffer.group(1), treffer.group(2), treffer.group(3)
        ziel = SRC / datei
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


def main() -> int:
    nur_pruefen = '--pruefen' in sys.argv
    alle = []
    for name in SEITEN:
        seite = SRC / name
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
