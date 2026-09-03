#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Prueft, dass die ER-Diagramme das Datenmodell vollstaendig abbilden.

WARUM ES DIESE PRUEFUNG BRAUCHT

erd_check.py vergleicht die KARDINALITAETEN der Diagramme gegen den
Systemkatalog - 92 Beziehungen, jede einzeln. Das ist scharf, hat aber
einen blinden Fleck: Eine Tabelle ohne Fremdschluessel hat keine
Beziehung, und was keine Beziehung hat, kann ein Beziehungsvergleich
nicht bemerken. Genau so ist es passiert.

velocity.preisschaetzung kam am 01.09.2026 dazu, trug nur UNIQUE- und
CHECK-Bedingungen und fehlte danach zwei Tage in jedem Diagramm - waehrend
alle Pruefungen gruen blieben. Beim Nachziehen fielen drei weitere auf,
die aus demselben Grund nie in einem Diagramm standen:
geschaeftsgebiet, hoehenmarke und ort_koordinate.

Diese Pruefung schliesst die Luecke in drei Richtungen:

  1  Jede Tabelle des Aufbaus hat in mindestens einem Diagramm einen
     Entitaetsblock. Eine Erwaehnung im Fliesstext eines Flussdiagramms
     genuegt nicht - gefordert ist die Darstellung als Entitaet.
  2  Jede Entitaet eines ER-Diagramms ist eine Tabelle des Aufbaus,
     ausser den bewusst entworfenen und den Lehrbeispielen (siehe
     GEPLANT und LEHRBEISPIEL).
  3  Jede in einem Diagramm gezeigte Spalte gibt es in der Tabelle
     wirklich. Das faengt Umbenennungen und Tippfehler.

Die Diagramme zeigen bewusst eine AUSWAHL der Spalten - KUNDE elf von
fuenfzehn, ADRESSE sechs von acht. Punkt 3 prueft deshalb nur in eine
Richtung: gezeigte Spalten muessen existieren, existierende muessen
nicht gezeigt werden.

Aufruf: python3 tools/erd_vollstaendig.py
"""
from __future__ import annotations

import pathlib
import re
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from schema_lesen import WURZEL, spalten_je_tabelle  # noqa: E402

ERD = WURZEL / "doku" / "datenmodell" / "erd"

# Entwuerfe, die noch nicht gebaut sind. Sie stehen absichtlich im
# Diagramm - Folie 56 des Decks weist sie als "entworfen, aber nicht
# gebaut" aus und hinterlegt sie grau. Wird eine davon gebaut,
# verschwindet sie hier und Punkt 1 verlangt sie im Diagramm.
GEPLANT = {
    "lieferant", "artikelgruppe", "artikel", "bestellung", "bestellposition",
    "wareneingang", "lager", "lagerbewegung", "wartungsposition",
    "umsetzungsauftrag",
}

# Entitaeten, die absichtlich kein Modell abbilden, sondern ein
# Gegenbeispiel: norm-vorher.mmd zeigt den unnormalisierten Entwurf.
LEHRBEISPIEL = {"ausleihe_flach"}


def entitaeten() -> list[tuple[str, str, list[str]]]:
    """[(diagramm, entitaet, [gezeigte spalten])] aus allen ER-Diagrammen."""
    aus = []
    for p in sorted(ERD.glob("*.mmd")):
        q = p.read_text(encoding="utf-8")
        for m in re.finditer(r"^ {4}(\w+)\s*\{(.*?)^ {4}\}", q, re.S | re.M):
            spalten = []
            for zeile in m.group(2).split("\n"):
                w = zeile.split()
                # Ein Attribut ist "typ name [PK|FK|UK] [\"Kommentar\"]".
                if len(w) >= 2 and re.fullmatch(r"[a-z_]\w*", w[1]):
                    spalten.append(w[1])
            aus.append((p.name, m.group(1).lower(), spalten))
    return aus


def main() -> int:
    sp = spalten_je_tabelle()
    gefunden = entitaeten()
    hat_block = {e for _, e, _ in gefunden}

    funde: list[tuple[str, str]] = []

    # 1 Tabelle ohne Entitaetsblock
    for t in sorted(sp):
        if t not in hat_block:
            funde.append((f"Tabelle {t}", "steht in keinem Diagramm"))

    # 2 Entitaet ohne Tabelle
    for datei, ent, _ in gefunden:
        if ent not in sp and ent not in GEPLANT and ent not in LEHRBEISPIEL:
            funde.append((f"{datei}: Entität {ent.upper()}",
                          "keine Tabelle dieses Namens im Aufbau"))

    # 3 Gezeigte Spalte, die es nicht gibt
    for datei, ent, spalten in gefunden:
        if ent not in sp:
            continue
        for c in spalten:
            if c not in sp[ent]:
                funde.append((f"{datei}: {ent.upper()}.{c}",
                              "diese Spalte gibt es in der Tabelle nicht"))

    print(f"{len(sp)} Tabellen, {len(gefunden)} Entitäten in "
          f"{len(list(ERD.glob('*.mmd')))} Diagrammen geprüft")
    if not funde:
        print(f"  Jede Tabelle steht in einem Diagramm, "
              f"jede gezeigte Spalte gibt es. {len(GEPLANT)} geplante "
              f"Entitäten ausgenommen.")
        return 0
    print(f"  {len(funde)} Befund(e):\n")
    for was, warum in funde:
        print(f"  FEHLER  {was}")
        print(f"          {warum}")
    print("\n  Ein Diagramm, das eine Tabelle nicht zeigt, ist keine "
          "Dokumentation\n  des Modells. Diagramm ergänzen oder, bei einem "
          "Entwurf, in GEPLANT\n  in dieser Datei aufnehmen.")
    return 1


if __name__ == "__main__":
    sys.exit(main())
