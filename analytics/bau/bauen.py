"""Baut alle CRISP-DM-Notebooks: Vorfuehrfassung (ausgefuehrt) und Uebungsfassung."""
import importlib
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from bauwerk import bauen

MODULE = ["nb01_regression", "nb02_klassifikation", "nb03_clustering",
          "nb04_zeitreihe", "nb05_assoziation", "nb06_anomalie"]

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
        start = time.time()
        bauen(modul.NAME, modul.ZELLEN)
        print(f"     ... {time.time() - start:.0f} s")
