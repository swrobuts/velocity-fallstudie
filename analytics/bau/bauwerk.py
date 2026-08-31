"""
Baukasten fuer die CRISP-DM-Notebooks.

EINE QUELLE, ZWEI FASSUNGEN. Jedes Notebook wird hier einmal beschrieben.
Daraus entstehen:

  <name>.ipynb           Vorfuehrfassung - vollstaendig, ausgefuehrt, mit
                         Ausgaben und Diagrammen. Laeuft in Colab von oben
                         nach unten durch.
  uebung/<name>.ipynb    Uebungsfassung - dieselben Texte, aber die als
                         Luecke markierten Stellen sind herausgenommen und
                         durch eine Aufgabe ersetzt.

Warum aus einer Quelle: zwei getrennt gepflegte Notebooks laufen
auseinander, sobald man eines anfasst. Hier kann das nicht passieren - die
Uebungsfassung ist ein Ableitungsprodukt, keine Kopie.

LUECKEN MARKIEREN

In einer Codezelle:

    ##LUECKE Bilden Sie die Spalte 'dauer_min' aus Start- und Endzeit.
    fahrten["dauer_min"] = (fahrten.endzeit - fahrten.startzeit).dt.total_seconds() / 60
    ##ENDE

Vorfuehrfassung: die Markierungszeilen fallen weg, der Code bleibt.
Uebungsfassung: der Code faellt weg, es bleibt

    # AUFGABE: Bilden Sie die Spalte 'dauer_min' aus Start- und Endzeit.
    ...

AUSFUEHREN

Die Vorfuehrfassung wird beim Bauen ausgefuehrt. Faellt eine Zelle um, ist
das Notebook kaputt und der Bau bricht ab - eine Vorfuehrfassung, die nicht
durchlaeuft, waere schlimmer als keine.

Damit das ohne Netz geht, lesen die Notebooks ihre Daten ueber

    BASIS = os.environ.get("VELO_BASIS", "https://raw.githubusercontent.com/...")

Beim Bauen zeigt VELO_BASIS auf den lokalen Ordner, in Colab ist die
Variable nicht gesetzt und es wird von GitHub geladen.
"""
import os
import re
import sys

import nbformat
from nbclient import NotebookClient
from nbformat.v4 import new_code_cell, new_markdown_cell, new_notebook

HIER = os.path.dirname(os.path.abspath(__file__))
ANALYTICS = os.path.dirname(HIER)
ZIEL = os.path.join(ANALYTICS, "notebooks")
ZIEL_UEBUNG = os.path.join(ZIEL, "uebung")

ROHBASIS = "https://raw.githubusercontent.com/swrobuts/velocity-fallstudie/main/analytics/"
COLAB = "https://colab.research.google.com/github/swrobuts/velocity-fallstudie/blob/main/analytics/notebooks/"

# ---------------------------------------------------------------- Bausteine

def MD(text):
    return ("md", text.strip("\n"))


def CODE(quelltext):
    return ("code", quelltext.strip("\n"))


PHASEN = [
    ("Business Understanding", "Was ist die Geschäftsfrage — und woran messen wir Erfolg?"),
    ("Data Understanding",     "Welche Daten haben wir, und taugen sie für diese Frage?"),
    ("Data Preparation",       "Wie wird aus Rohdaten eine Tabelle, mit der ein Verfahren rechnen kann?"),
    ("Modeling",               "Welches Verfahren, welche Einstellungen, wie geprüft?"),
    ("Evaluation",             "Ist das Modell gut genug für die Geschäftsfrage aus Phase 1?"),
    ("Deployment",             "Wie kommt das Modell in den Betrieb — und was passiert danach?"),
]


def PHASE(nummer, zusatz=""):
    """Ein Banner, das in jedem der sechs Notebooks gleich aussieht.

    Die Wiedererkennung ist der eigentliche Zweck: wer das dritte Notebook
    aufschlaegt, weiss ohne Nachdenken, wo er sich im Kreislauf befindet.
    """
    name, frage = PHASEN[nummer - 1]
    balken = " · ".join(
        (f"**{i + 1}. {p[0].split()[0]}**" if i + 1 == nummer else f"{i + 1}. {p[0].split()[0]}")
        for i, p in enumerate(PHASEN))
    text = (f"---\n\n"
            f"{balken}\n\n"
            f"# Phase {nummer} von 6 — {name}\n\n"
            f"> **Leitfrage:** {frage}\n")
    if zusatz:
        text += f">\n> **In diesem Notebook heißt das:** {zusatz}\n"
    return MD(text)


# ---------------------------------------------------------------- Luecken

_LUECKE = re.compile(r"^[ \t]*##LUECKE[ \t]*(.*)$")
_ENDE = re.compile(r"^[ \t]*##ENDE[ \t]*$")


def _teile(quelltext):
    """Zerlegt eine Codezelle in Abschnitte: ('fest', code) oder ('luecke', code, aufgabe)."""
    abschnitte, puffer, aufgabe, luecke = [], [], None, []
    for zeile in quelltext.split("\n"):
        m = _LUECKE.match(zeile)
        if m:
            if puffer:
                abschnitte.append(("fest", "\n".join(puffer)))
                puffer = []
            aufgabe = m.group(1).strip()
            luecke = []
            continue
        if _ENDE.match(zeile):
            abschnitte.append(("luecke", "\n".join(luecke), aufgabe))
            aufgabe, luecke = None, []
            continue
        (luecke if aufgabe is not None else puffer).append(zeile)
    if puffer:
        abschnitte.append(("fest", "\n".join(puffer)))
    return abschnitte


def _vorfuehrung(quelltext):
    return "\n".join(a[1] for a in _teile(quelltext)).strip("\n")


def _uebung(quelltext):
    aus = []
    for a in _teile(quelltext):
        if a[0] == "fest":
            aus.append(a[1])
        else:
            einzug = re.match(r"[ \t]*", a[1].split("\n")[0]).group(0)
            aus.append(f"{einzug}# AUFGABE: {a[2]}\n{einzug}...")
    return "\n".join(aus).strip("\n")


def hat_luecken(zellen):
    return any(art == "code" and any(t[0] == "luecke" for t in _teile(q)) for art, q in zellen)


# ---------------------------------------------------------------- Bauen

def _notebook(zellen, wandler):
    nb = new_notebook()
    nb.metadata.update({
        "kernelspec": {"display_name": "Python 3", "language": "python", "name": "python3"},
        "language_info": {"name": "python"},
        "colab": {"provenance": [], "toc_visible": True},
    })
    for art, inhalt in zellen:
        if art == "md":
            nb.cells.append(new_markdown_cell(inhalt))
        else:
            nb.cells.append(new_code_cell(wandler(inhalt)))
    return nb


def bauen(name, zellen, ausfuehren=True):
    """Schreibt Vorfuehr- und Uebungsfassung. Gibt die Zahl der Luecken zurueck."""
    os.makedirs(ZIEL, exist_ok=True)
    os.makedirs(ZIEL_UEBUNG, exist_ok=True)

    vor = _notebook(zellen, _vorfuehrung)
    if ausfuehren:
        umgebung = dict(os.environ)
        umgebung["VELO_BASIS"] = ANALYTICS + os.sep
        alt = dict(os.environ)
        os.environ.update(umgebung)
        try:
            client = NotebookClient(vor, timeout=900, kernel_name="python3",
                                    resources={"metadata": {"path": ANALYTICS}})
            client.execute()
        finally:
            os.environ.clear()
            os.environ.update(alt)

    pfad_vor = os.path.join(ZIEL, f"{name}.ipynb")
    nbformat.write(vor, pfad_vor)

    ueb = _notebook(zellen, _uebung)
    pfad_ueb = os.path.join(ZIEL_UEBUNG, f"{name}.ipynb")
    nbformat.write(ueb, pfad_ueb)

    n_luecken = sum(len([t for t in _teile(q) if t[0] == "luecke"])
                    for art, q in zellen if art == "code")
    groesse = os.path.getsize(pfad_vor) / 1024
    print(f"  {name:38s} {len(zellen):>3d} Zellen  {n_luecken:>2d} Lücken  "
          f"{groesse:>6.0f} kB  {'ausgeführt' if ausfuehren else 'ohne Lauf'}")
    return n_luecken


# ---------------------------------------------------------------- Textbausteine

def kopf(titel, verfahren, frage, dateiname):
    """Der immer gleiche Notebook-Kopf: Titel, Colab-Knopf, Einordnung."""
    return MD(f"""
# {titel}

**Verfahren:** {verfahren}  |  **Geschäftsfrage:** {frage}

[![In Colab öffnen](https://colab.research.google.com/assets/colab-badge.svg)]({COLAB}{dateiname}.ipynb)

---

## Wie dieses Notebook aufgebaut ist

Es folgt **CRISP-DM** (*Cross-Industry Standard Process for Data Mining*) — dem
Vorgehensmodell, das seit 1999 der De-facto-Standard für Analyseprojekte ist. Sechs
Phasen, und zwar als **Kreislauf**, nicht als Treppe:

| | Phase | Leitfrage |
|---|---|---|
| 1 | Business Understanding | Was ist die Geschäftsfrage — und woran messen wir Erfolg? |
| 2 | Data Understanding | Welche Daten haben wir, und taugen sie für diese Frage? |
| 3 | Data Preparation | Wie wird aus Rohdaten eine Tabelle, mit der ein Verfahren rechnen kann? |
| 4 | Modeling | Welches Verfahren, welche Einstellungen, wie geprüft? |
| 5 | Evaluation | Ist das Modell gut genug für die Geschäftsfrage aus Phase 1? |
| 6 | Deployment | Wie kommt das Modell in den Betrieb — und was passiert danach? |

**Der Pfeil von Phase 5 zurück auf Phase 1 ist kein Schönheitsfehler des Diagramms.**
Er ist die wichtigste Linie darin. In der Praxis stellt sich in der Evaluation regelmäßig
heraus, dass die Frage aus Phase 1 anders gestellt werden muss oder dass Daten fehlen,
an die in Phase 2 niemand gedacht hat. Ein Analyseprojekt, das die sechs Phasen genau
einmal von oben nach unten durchläuft, ist die Ausnahme — nicht die Regel.

Am Ende dieses Notebooks steht deshalb ausdrücklich die Frage, **was eine zweite Runde
anders machen würde**.
""")


def daten_laden_zelle(dateien, erklaerung=""):
    """Die immer gleiche Ladezelle - lokal beim Bauen, von GitHub in Colab."""
    zeilen = ["import os", "",
              '# In Colab ist VELO_BASIS nicht gesetzt: dann wird direkt von GitHub',
              '# geladen - kein Upload, kein Drive-Mount. Beim Bauen dieses Notebooks',
              '# zeigt die Variable auf den lokalen Ordner.',
              f'BASIS = os.environ.get("VELO_BASIS", "{ROHBASIS}")',
              'print("Daten von:", BASIS)']
    return CODE("\n".join(zeilen))
