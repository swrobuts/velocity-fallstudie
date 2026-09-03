#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Haelt den ausgelieferten Stand gegen den hier liegenden.

WARUM ES DIESE PRUEFUNG BRAUCHT

Am 03.09.2026 wurde der Preisschaetzer dreimal reparieret und dreimal
"laeuft" gemeldet - gemessen jedes Mal gegen einen lokalen Server auf
localhost. Auf bikes.butscher.cloud lagen weiter die alten Dateien:
supabase.js mit dem Fingerabdruck 3aeac4c9 statt 114ade78, ohne die
Funktion, um die es ging. Der Nutzer sah drei Runden lang nichts.

Keine Pruefung hat das bemerkt, und das war kein Zufall: Jede einzelne
prueft, was HIER liegt. tools/veroeffentlichen.sh prueft nach dem
Ausliefern, ob das Ausgelieferte angekommen ist - aber niemand prueft, ob
ueberhaupt ausgeliefert wurde. Genau diese Luecke schliesst diese Datei.

WAS GEPRUEFT WIRD

Fuer jede ausgelieferte Seite: Traegt das HTML unter der oeffentlichen
Adresse dieselben Fingerabdruecke wie src/? Ein Unterschied heisst, dass
Besucher etwas anderes bekommen als das, was hier steht und was alle
uebrigen Pruefungen fuer gut befunden haben.

Zusaetzlich wird jede eingebundene Datei einmal abgerufen: Ein Stempel,
der stimmt, waehrend die Datei fehlt, waere die naechste stille Luecke.

Diese Pruefung braucht das Netz und wird rot, sobald hier etwas liegt,
das noch nicht veroeffentlicht ist. Das ist Absicht - dann ist es rot.
Der Weg heraus ist bash tools/veroeffentlichen.sh, nicht eine Ausnahme.

Aufruf: python3 tools/ausgeliefert_pruefen.py
"""
from __future__ import annotations

import pathlib
import re
import sys
import urllib.error
import urllib.request

WURZEL = pathlib.Path(__file__).resolve().parent.parent
QUELLE = WURZEL / "src"
ADRESSE = "https://bikes.butscher.cloud"
SEITEN = ["index.html", "rechtliches.html"]

# Dasselbe Muster wie in tools/versionieren.py: nur oertliche Dateien,
# keine fremden Server, kein Anker, kein mailto.
MUSTER = (r'\b(?:src|href)="(?!https?:|//|#|mailto:)'
          r'([A-Za-z0-9_./-]+\.(?:js|css))\?v=([0-9a-f]+)"')

ZEITSPANNE = 20


def hole(pfad: str) -> tuple[int, str]:
    ziel = f"{ADRESSE}/{pfad}" if pfad else ADRESSE
    try:
        with urllib.request.urlopen(ziel, timeout=ZEITSPANNE) as antwort:
            return antwort.status, antwort.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as fehler:
        return fehler.code, ""
    except Exception as fehler:                       # Netz, DNS, Zertifikat
        return 0, f"{type(fehler).__name__}: {fehler}"


def stempel(text: str) -> dict[str, str]:
    return {datei: fp for datei, fp in re.findall(MUSTER, text)}


def main() -> int:
    funde: list[str] = []
    geprueft = 0

    for seite in SEITEN:
        oertlich = QUELLE / seite
        if not oertlich.exists():
            funde.append(f"{seite}: liegt nicht in src/")
            continue
        status, geliefert = hole(seite if seite != "index.html" else "")
        if status != 200:
            funde.append(f"{seite}: HTTP {status}"
                         + (f" - {geliefert[:80]}" if status == 0 else ""))
            continue

        hier, dort = stempel(oertlich.read_text(encoding="utf-8")), stempel(geliefert)
        for datei, fp in sorted(hier.items()):
            geprueft += 1
            if datei not in dort:
                funde.append(f"{seite}: {datei} wird ausgeliefert gar nicht eingebunden")
            elif dort[datei] != fp:
                funde.append(f"{datei}: ausgeliefert {dort[datei]}, hier {fp}")
        for datei in sorted(set(dort) - set(hier)):
            funde.append(f"{seite}: {datei} ist ausgeliefert, steht aber nicht mehr in src/")

    # Stimmt der Stempel, muss die Datei auch da sein.
    if not funde:
        for datei, fp in sorted(stempel((QUELLE / "index.html")
                                        .read_text(encoding="utf-8")).items()):
            status, _ = hole(f"{datei}?v={fp}")
            if status != 200:
                funde.append(f"{datei}: Stempel stimmt, Datei antwortet mit HTTP {status}")

    print(f"{ADRESSE}: {geprueft} Fingerabdrücke aus {len(SEITEN)} Seiten geprüft")
    if not funde:
        print("  Der ausgelieferte Stand ist der, der hier liegt.")
        return 0
    print(f"  {len(funde)} Abweichung(en):\n")
    for f in funde:
        print(f"  FEHLER  {f}")
    print("\n  Besucher bekommen etwas anderes als das, was hier steht und was\n"
          "  die übrigen Prüfungen für gut befunden haben.\n"
          "  Ausliefern mit:  bash tools/veroeffentlichen.sh")
    return 1


if __name__ == "__main__":
    sys.exit(main())
