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
import json
import os
import re
import sys

import nbformat
from nbclient import NotebookClient
from nbformat.v4 import new_code_cell, new_markdown_cell, new_notebook

HIER = os.path.dirname(os.path.abspath(__file__))
ANALYTICS = os.path.dirname(HIER)
ZIEL = os.path.join(ANALYTICS, "notebooks")
WERTE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "werte")
ZIEL_UEBUNG = os.path.join(ZIEL, "uebung")

# Die Daten haengen an einem festen COMMIT, nicht an main und nicht an einem
# Tag: main bewegt sich mit jedem Push, und ein Tag laesst sich verschieben -
# beides ist schon passiert. Nur die Commit-Kennung ist unveraenderlich.
#
# Beim Erneuern der Musterdaten wird dieser Wert bewusst nachgezogen. Das ist
# der Sinn: Wer die Daten aendert, aendert sichtbar auch den Datenstand.
DATENSTAND = "316b3db6532966693909430503b3ba597077754f"
ROHBASIS = ("https://raw.githubusercontent.com/swrobuts/velocity-fallstudie/"
            f"{DATENSTAND}/analytics/")
COLAB = "https://colab.research.google.com/github/swrobuts/velocity-fallstudie/blob/main/analytics/notebooks/"


# ---------------------------------------------------------------- Platzhalter
#
# Ergebniszahlen gehoeren nicht in den Fliesstext. Sonst zeigt der Text nach
# jeder Datenaenderung auf Werte, die das Notebook gar nicht mehr rechnet.
#
# Der Code registriert seine Ergebnisse mit merke("schluessel", wert), der
# Markdown-Text verweist mit {{schluessel}} oder {{schluessel:.2f}} darauf.
# Nach dem Ausfuehren ersetzt der Bauvorgang die Platzhalter durch die
# tatsaechlich gerechneten Werte - in deutscher Schreibweise.
#
# Vorgaben bleiben hart im Text: eine Gueteschwelle, die vor dem Ergebnis
# feststeht, ist eine Entscheidung und kein Messwert.

MERKZETTEL_ANFANG = '''
_MERKZETTEL = {}


def merke(schluessel, wert):
    """Haelt ein Ergebnis fuer den Fliesstext fest und gibt es zurueck."""
    _MERKZETTEL[schluessel] = wert
    return wert
'''

_MERKZETTEL_MARKE = "##MERKZETTEL##"
MERKZETTEL_ENDE = (
    "import json as _json\n"
    f'print("{_MERKZETTEL_MARKE}" + _json.dumps(_MERKZETTEL, default=str))')

_PLATZHALTER = re.compile(r"\{\{([a-z0-9_]+)(?::([^}]+))?\}\}")


def _deutsch(text):
    """Englische Zahlschreibweise in deutsche umsetzen: 1,234.5 -> 1.234,5."""
    return text.replace(",", "\x00").replace(".", ",").replace("\x00", ".")


def _einsetzen(text, werte, herkunft):
    """Ersetzt {{schluessel}} und {{schluessel:format}} durch die Messwerte."""
    def ersatz(treffer):
        schluessel, form = treffer.group(1), treffer.group(2)
        if schluessel not in werte:
            raise SystemExit(
                f"ABBRUCH: {herkunft} verweist auf {{{{{schluessel}}}}}, aber der Code "
                f"hat diesen Wert nicht mit merke() festgehalten.\n"
                f"    Bekannt sind: {', '.join(sorted(werte)) or '(keine)'}")
        wert = werte[schluessel]
        if form is None:
            # Die deutsche Schreibweise gilt fuer ZAHLEN. Auf einen Text
            # angewandt macht sie aus "CARGO, CITY und EBIKE" ein
            # "CARGO. CITY und EBIKE" - der Tausch von Punkt und Komma
            # kennt den Unterschied nicht, also fragen wir vorher.
            try:
                float(str(wert).replace(",", "."))
            except (TypeError, ValueError):
                return str(wert)
            return _deutsch(str(wert))
        try:
            zahl = float(wert)
            # Ganze Zahlen ohne Nachkommastelle setzen: 108.781, nicht 108.781,0.
            if zahl.is_integer() and not any(z in form for z in "fe%g"):
                gesetzt = format(int(zahl), form)
            else:
                gesetzt = format(zahl, form)
        except (TypeError, ValueError):
            gesetzt = format(wert, form)
        # Im Deutschen steht vor dem Prozentzeichen ein Leerzeichen.
        return _deutsch(gesetzt).replace("%", " %") if gesetzt.endswith("%") \
            else _deutsch(gesetzt)
    return _PLATZHALTER.sub(ersatz, text)


def _werte_einsammeln(notebook):
    """Liest den Merkzettel aus der Ausgabe der letzten Codezelle."""
    for zelle in reversed(notebook.cells):
        if zelle.get("cell_type") != "code":
            continue
        for ausgabe in zelle.get("outputs", []):
            text = ausgabe.get("text", "")
            if _MERKZETTEL_MARKE in text:
                return json.loads(text.split(_MERKZETTEL_MARKE, 1)[1].strip())
    return {}


# ---------------------------------------------------------------- Bausteine

def MD(text):
    return ("md", text.strip("\n"))


def CODE(quelltext):
    """Eine Codezelle - und sofort gegengeprueft, ob sie ueberhaupt parst.

    Warum hier und nicht erst beim Ausfuehren: Die Bauskripte schreiben
    ihren Code in dreifach zitierte Strings. Ein `\\n` in einem print muss
    darin DOPPELT maskiert sein, sonst wird daraus beim Parsen des
    Bauskripts ein echter Zeilenumbruch - und der zerreisst den String in
    der erzeugten Zelle. Die Fehlermeldung kommt dann aus dem Notebook,
    zeigt auf eine Zeilennummer INNERHALB der Zelle und nennt das
    Bauskript nicht. Beim Umbau von Notebook 2 ist mir das sechsmal
    hintereinander passiert; jedes Mal kostete es einen Bauversuch.

    Diese Pruefung nennt Zelle, Zeile und Ursache sofort.
    """
    quelltext = quelltext.strip("\n")
    # Der Marker fuer die Datenquelle wird hier ersetzt, nicht im Zellcode
    # verkettet: Eine Verkettung funktioniert nur in Bloecken mit einer
    # bestimmten Anfuehrungsform und steht in der anderen woertlich im
    # Notebook - dann laeuft es beim Studierenden gar nicht erst an.
    quelltext = quelltext.replace("__ROHBASIS__", f'"{ROHBASIS}"')
    try:
        compile(quelltext, "<CODE-Block>", "exec")
    except SyntaxError as fehler:
        zeilen = quelltext.split("\n")
        stelle = zeilen[fehler.lineno - 1] if fehler.lineno and fehler.lineno <= len(zeilen) else ""
        hinweis = ""
        if "unterminated string" in str(fehler.msg or ""):
            hinweis = ("\n    Verdacht: ein einfaches \\n in einem String. In den "
                       "Bauskripten\n    muss es doppelt maskiert sein.")
        raise SystemExit(
            f"ABBRUCH: Ein CODE-Block laesst sich nicht parsen.\n"
            f"    {fehler.msg} in Zeile {fehler.lineno} des Blocks\n"
            f"    > {stelle.strip()}{hinweis}") from None
    return ("code", quelltext)


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
    """Schreibt Vorfuehr- und Uebungsfassung. Gibt die Zahl der Luecken zurueck.

    Vor dem Ausfuehren wird der Merkzettel angelegt, danach ausgelesen: alle
    {{platzhalter}} im Fliesstext werden durch die tatsaechlich gerechneten
    Werte ersetzt. Ein Platzhalter ohne passendes merke() bricht den Bau ab.
    """
    os.makedirs(ZIEL, exist_ok=True)
    os.makedirs(ZIEL_UEBUNG, exist_ok=True)

    braucht_werte = any(art == "md" and _PLATZHALTER.search(inhalt)
                        for art, inhalt in zellen)
    if braucht_werte and not ausfuehren:
        raise SystemExit(f"ABBRUCH: {name} enthaelt Platzhalter, wird aber nicht "
                         f"ausgefuehrt - die Werte koennten nicht eingesetzt werden.")

    arbeit = list(zellen)
    if braucht_werte:
        arbeit = [CODE(MERKZETTEL_ANFANG)] + arbeit + [CODE(MERKZETTEL_ENDE)]

    vor = _notebook(arbeit, _vorfuehrung)
    if ausfuehren:
        alt = dict(os.environ)
        os.environ["VELO_BASIS"] = ANALYTICS + os.sep
        try:
            client = NotebookClient(vor, timeout=1800, kernel_name="python3",
                                    resources={"metadata": {"path": ANALYTICS}})
            client.execute()
        finally:
            os.environ.clear()
            os.environ.update(alt)

    werte = _werte_einsammeln(vor) if braucht_werte else {}
    if braucht_werte:
        # Die Ausgabezelle hat ihren Zweck erfuellt und verlaesst das Notebook.
        vor.cells = vor.cells[:-1]
        for zelle in vor.cells:
            if zelle.cell_type == "markdown":
                zelle.source = _einsetzen(zelle.source, werte, f"{name} (Vorfuehrung)")
        zellen = [(art, _einsetzen(inhalt, werte, f"{name} (Uebung)")
                   if art == "md" else inhalt) for art, inhalt in zellen]
        zellen = [("code", MERKZETTEL_ANFANG)] + zellen

    # Der Merkzettel verlaesst das Notebook, aber nicht den Bau: Die
    # Textpruefung muss eingesetzte Werte von handgetippten unterscheiden
    # koennen. Ein eingesetzter Wert ist per Konstruktion richtig; nur eine
    # von Hand geschriebene Zahl kann der Ausgabe widersprechen.
    os.makedirs(WERTE, exist_ok=True)
    with open(os.path.join(WERTE, f"{name}.json"), "w", encoding="utf-8") as f:
        json.dump(werte, f, ensure_ascii=False, indent=1, default=str)

    nbformat.write(vor, os.path.join(ZIEL, f"{name}.ipynb"))
    ueb = _notebook(zellen, _uebung)
    nbformat.write(ueb, os.path.join(ZIEL_UEBUNG, f"{name}.ipynb"))

    n_luecken = sum(len([t for t in _teile(quelltext) if t[0] == "luecke"])
                    for art, quelltext in zellen if art == "code")
    groesse = os.path.getsize(os.path.join(ZIEL, f"{name}.ipynb")) / 1024
    print(f"  {name:38s} {len(vor.cells):>3d} Zellen  {n_luecken:>2d} Lücken  "
          f"{len(werte):>2d} Werte  {groesse:>6.0f} kB  "
          f"{'ausgeführt' if ausfuehren else 'ohne Lauf'}")
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
