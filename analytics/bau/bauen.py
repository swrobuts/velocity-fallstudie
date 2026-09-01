"""Baut alle CRISP-DM-Notebooks: Vorfuehrfassung (ausgefuehrt) und Uebungsfassung."""
import importlib
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from bauwerk import bauen

MODULE = ["nb01_regression", "nb02_klassifikation", "nb03_clustering",
          "nb04_zeitreihe", "nb05_assoziation", "nb06_anomalie"]

def stelle_finden(modul_name):
    """Sucht die letzte Zeile, bis zu der das Bauskript noch parst.

    Die Fehlermeldung von Python zeigt auf die Stelle, an der das Parsen
    scheitert - nicht auf die, an der der Block zerbrochen ist. Zwischen
    beiden koennen Dutzende Zeilen liegen.
    """
    import ast
    pfad = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                        f"{modul_name}.py")
    with open(pfad, encoding="utf-8") as datei:
        zeilen = datei.read().split("\n")
    letzte = 0
    for bis in range(1, len(zeilen) + 1):
        try:
            ast.parse("\n".join(zeilen[:bis]) + "\n]")
            letzte = bis
        except SyntaxError:
            pass
    verdacht = next((z for z in zeilen[letzte:letzte + 40] if '"""' in z), "")
    return (f"Bis Zeile {letzte} parst das Skript noch. Erster Verdacht danach:\n"
            f"     > {verdacht.strip()[:90]}")


if __name__ == "__main__":
    gewuenscht = sys.argv[1:] or MODULE
    print("Baue Notebooks ...")
    for name in gewuenscht:
        if not any(name in m for m in MODULE):
            print(f"  unbekannt: {name}")
            continue
        modul_name = next(m for m in MODULE if name in m)
        try:
            modul = importlib.import_module(modul_name)
        except ModuleNotFoundError:
            print(f"  {modul_name:38s} noch nicht geschrieben")
            continue
        except SyntaxError as fehler:
            # Ein unmaskiertes dreifaches Anfuehrungszeichen in einer Zelle
            # schliesst den umgebenden CODE-Block. Python meldet den Fehler dann
            # Dutzende Zeilen spaeter an einer voellig unbeteiligten Stelle.
            # Deshalb suchen wir die wirkliche Bruchstelle selbst.
            print(f"  {modul_name}: {fehler.msg} (gemeldet in Zeile {fehler.lineno})")
            print(f"     {stelle_finden(modul_name)}")
            raise SystemExit(1) from None
        start = time.time()
        bauen(modul.NAME, modul.ZELLEN)
        print(f"     ... {time.time() - start:.0f} s")
