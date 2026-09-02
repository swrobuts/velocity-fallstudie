"""Baut alle CRISP-DM-Notebooks: Vorfuehrfassung (ausgefuehrt) und Uebungsfassung."""
import importlib
import os
import re
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from bauwerk import bauen, datenstand_pruefen

MODULE = ["nb01_regression", "nb02_klassifikation", "nb03_clustering",
          "nb04_zeitreihe", "nb05_assoziation", "nb06_anomalie"]

# Die Pruefer sind ein Tor, keine Beigabe. Wer ein Notebook baut, ohne sie
# laufen zu lassen, liefert ungeprueft aus - und genau so sind mehrere Fehler
# bis in ein externes Gutachten durchgerutscht.
PRUEFER = [
    ("tools/notebook_pruefungen.py", "Bekannte Fehlerbilder"),
    ("tools/notebooktexte_pruefen.py", "Zahlen im Text gegen die Ausgaben"),
    ("tools/tote_schwellen_pruefen.py", "Kriterien ohne Wirkung im Code"),
]


def pruefen(gebaute):
    """Laesst die Pruefer laufen und bricht ab, wenn einer Fehler meldet."""
    import subprocess

    wurzel = os.path.dirname(os.path.dirname(os.path.dirname(
        os.path.abspath(__file__))))
    print("\nPruefe ...")
    gescheitert = []
    # ZUERST: Zeigt DATENSTAND auf die Daten, die hier gerechnet wurden?
    # Diese Pruefung kostet nichts und haette einen ganzen Pruefdurchlauf
    # gerettet - siehe die Begruendung in bauwerk.datenstand_pruefen.
    _stand = datenstand_pruefen(os.path.join(wurzel, "analytics"))
    if _stand:
        print("  FEHLER  Datenstand der Notebooks")
        for _z in _stand:
            print(f"          {_z}")
        gescheitert.append("Datenstand der Notebooks")
    else:
        print("  ok      Datenstand der Notebooks")
    for skript, zweck in PRUEFER:
        lauf = subprocess.run([sys.executable, skript], cwd=wurzel,
                              capture_output=True, text=True)
        if lauf.returncode == 0:
            print(f"  ok      {zweck}")
            continue
        # Nur Funde in den GERADE gebauten Notebooks halten den Bau auf.
        # Was in anderen Notebooks steht, gehoert zu deren Umbau.
        # Kopfzeilen werden am ZEILENANFANG erkannt, nicht per Teilstring:
        # "ok " steckt sonst mitten in "Notebook rechnet" und macht aus einer
        # Detailzeile eine neue Ueberschrift.
        farblos = re.compile(r"\x1b\[[0-9;]*m")
        zeilen = [(farblos.sub("", z), z) for z in lauf.stdout.split("\n")]
        kopf = re.compile(r"^(ok|FEHLER|Hinweis|PRUEFEN)\b")
        eigene, sammelt = [], False
        for nackt, roh in zeilen:
            if kopf.match(nackt):
                # Nur harte Funde halten den Bau auf. Ein Hinweis ist ein
                # Hinweis - sonst blockiert jede fillna-Meldung die Abnahme.
                sammelt = (any(n in nackt for n in gebaute)
                           and nackt.startswith(("FEHLER", "PRUEFEN")))
                if sammelt:
                    eigene.append(nackt)
            elif sammelt and nackt.strip():
                eigene.append(nackt)
        betroffen = bool(eigene)
        fremde = sum(1 for nackt, _ in zeilen
                     if nackt.startswith(("FEHLER", "PRUEFEN"))
                     and not any(n in nackt for n in gebaute))
        nachsatz = f"   ({fremde} Fund(e) in anderen Notebooks)" if fremde else ""
        print(f"  {'FEHLER ' if betroffen else 'ok     '} {zweck}{nachsatz}")
        for zeile in eigene:
            print(f"     {zeile.strip()}")
        if betroffen:
            gescheitert.append(zweck)
    if gescheitert:
        print(f"\nAbgebrochen: {', '.join(gescheitert)}. "
              f"Das Notebook ist gebaut, aber nicht abgenommen.")
        raise SystemExit(1)
    print("Alle Pruefungen bestanden.")


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
    gebaut = []
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
        gebaut.append(modul.NAME)

    if gebaut:
        pruefen(gebaut)
        # DAS HANDOUT ZIEHT SEINE ZAHLEN AUS DENSELBEN MERKZETTELN.
        # Nur nach einem vollstaendigen Lauf: Wer ein einzelnes Notebook
        # neu baut, bekaeme sonst ein Handout aus zwei Datenstaenden -
        # genau der Fehler, den dieses Projekt schon einmal teuer bezahlt
        # hat.
        if len(gebaut) == len(MODULE):
            import handout
            ziel, zeichen = handout.bauen()
            wurzel = os.path.dirname(os.path.dirname(os.path.dirname(
                os.path.abspath(__file__))))
            print(f"\nHandout: {os.path.relpath(ziel, wurzel)} "
                  f"({zeichen:,} Zeichen)".replace(",", "."))
        else:
            print("\nHandout uebersprungen - es braucht alle sechs Notebooks "
                  "aus demselben Lauf.")
