#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Erzeugt das Foliendeck „CRISP-DM an sechs Fallbeispielen".

Aufruf:
    python3 slides/build_crispdm_deck.py
    python3 slides/check_deck.py slides/velocity-crispdm.pptx

Didaktisches Geruest
--------------------
Die Frage war: sechsmal der volle Kreislauf, oder einmal generisch und
dann die Faelle einsortiert? Beides waere falsch. Sechsmal derselbe
Rahmen begraebt die sechs UNTERSCHIEDLICHEN Lehren unter der immer
gleichen Gliederung. Einmal generisch und dann nur einsortiert laesst
die Studierenden nie ein Projekt von Anfang bis Ende erleben.

Deshalb vier Teile:

  A Die Karte          Der Kreislauf einmal kompakt - ein Nachschlage-
                       werk, keine Lektion.
  B Der Referenzfall   Notebook 1 Phase fuer Phase, mit den echten
                       Zahlen. Hier wird die Karte konkret. Regression
                       ist die vertrauteste Methode; die Aufmerksamkeit
                       bleibt beim Vorgehen statt beim Verfahren.
  C Fuenf Faelle       Gleiches Geruest, Tiefe nur dort, wo dieser Fall
                       etwas Neues zeigt. Denn jedes Notebook betont
                       eine andere Phase:
                         Fall 2 -> Phase 6  das Modell verdient seinen Unterhalt nicht
                         Fall 3 -> Phase 1  Kriterien ohne Zielgroesse
                         Fall 4 -> Phase 3  Schnitt entlang der Zeit
                         Fall 5 -> Phase 5  keine Regel, und der Plan traegt nicht
                         Fall 6 -> Ruecksprung 4 nach 3
  D Synthese           Die sechs Faelle zurueck auf den Kreislauf.

Der wiederkehrende Anker ist die PHASENLEISTE am Fuss jeder Inhalts-
folie - dieselbe Rolle, die im Datenbankdeck der rote Faden zu Annas
Fahrt spielt. Sie macht die Struktur sichtbar, ohne sie zu wiederholen.

Alle Zahlen stammen aus den ausgefuehrten Notebooks unter
analytics/notebooks/, nicht aus dem Gedaechtnis.
"""
from __future__ import annotations

import pathlib
import re
import sys

from pptx import Presentation

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from thws import (  # noqa: E402
    BLAU, BREITE, FLUCHT_L, GRUEN_D, ORANGE, ROT_A, TUERKIS, TEXT_SEK,
    ZONE_OBEN, ZONE_UNTEN,
    ampel_matrix, code_kacheln, diagramm, kachelreihe, kopf, leitfrage, notizen,
    phasenleiste, prozesskette, regel_streifen, sandband, sandkarte,
    schichtenstapel, steckbrief, tabelle, vorher_nachher,
)

WURZEL  = pathlib.Path(__file__).resolve().parent.parent
ZIEL    = WURZEL / "slides" / "velocity-crispdm.pptx"

VORLAGE = pathlib.Path(
    "/Users/robert/.claude/skills/thws-slides/assets/template.pptx"
)
if not VORLAGE.exists():
    raise SystemExit(
        f"Vorlage fehlt: {VORLAGE}\n"
        "Ohne sie fehlen die Layouts Frontpage_Digital/Chapter/Slide."
    )

Q = ("Sechs Notebooks unter analytics/notebooks/ der Fallstudie VeloCity. "
     "Alle Zahlen sind den ausgefuehrten Notebooks entnommen.")


# ─────────────────────────────────────────────────────────── Grundgeruest

def leere_praesentation() -> Presentation:
    prs = Presentation(str(VORLAGE))
    liste = prs.slides._sldIdLst
    for sld in list(liste):
        prs.part.drop_rel(sld.rId)
        liste.remove(sld)
    return prs


def lay(prs, name):
    return next(l for l in prs.slide_layouts if l.name == name)


def kapitel(prs, nummer, titel, frage, notiz):
    s = prs.slides.add_slide(lay(prs, "Chapter"))
    for ph in s.placeholders:
        if ph.placeholder_format.idx == 0:
            ph.text_frame.text = f"{nummer} · {titel}"
    leitfrage(s, frage)
    notizen(s, notiz)
    return s


# Welches Notebook gerade behandelt wird. Die Fallkapitel setzen das am
# Anfang; folie() leitet daraus zusammen mit dem Kicker die Fusszeile ab.
AKTUELLES_NB = [None]


def folie(prs, kicker, titel, intro=None, quelle=None):
    """Eine Inhaltsfolie. Die Quellenzeile entsteht, wo es geht, von selbst.

    Das Deck ist eine Lesehilfe: Jede Folie eines Fallkapitels soll sagen,
    wo im Notebook das Gezeigte steht. Von Hand gepflegt bleibt das nicht
    vollstaendig - beim ersten Durchlauf trugen 24 von 120 Folien eine
    Quelle. Deshalb wird sie aus dem Kicker abgeleitet: „Phase 5 · ...“
    oder „Fall 2 · Phase 5“ ergibt Abschnitt 5 des laufenden Notebooks.
    """
    if quelle is None:
        nb = AKTUELLES_NB[0]
        phase = re.search(r"Phase (\d)", kicker)
        quelle = nbq(nb, phase.group(1) if phase else "") if nb else Q
    s = prs.slides.add_slide(lay(prs, "Slide"))
    s._intro_unten = kopf(s, kicker, titel, quelle=quelle, intro=intro)
    return s


def unter_intro(s, abstand=16):
    return getattr(s, '_intro_unten', 110) + abstand


ASSETS = WURZEL / "slides" / "assets"

NB_DATEI = {
    1: "01_Regression_Fahrtdauer",
    2: "02_Klassifikation_Wartungsrisiko",
    3: "03_Clustering_Stationen_und_Kunden",
    4: "04_Zeitreihe_Nachfrageprognose",
    5: "05_Assoziation_Wege_im_Netz",
    6: "06_Anomalieerkennung_Auffaellige_Vorgaenge",
}


def nbq(nummer, abschnitt="", hinweis=""):
    """Quellenzeile, die auf Datei UND Abschnitt zeigt.

    Das Deck ist eine Lesehilfe. Eine Folie, die eine Zahl nennt, ohne zu
    sagen, wo sie steht, schickt die Studierenden auf die Suche. Diese
    Zeile beendet die Suche: Datei, Abschnitt, fertig.
    """
    teile = [f"analytics/notebooks/{NB_DATEI[nummer]}.ipynb"]
    if abschnitt:
        teile.append(f"Abschnitt {abschnitt}")
    if hinweis:
        teile.append(hinweis)
    return " · ".join(teile)


def bild(name: str) -> str:
    """Pfad zu einem Bild - und die Pruefung, ob es noch aktuell ist.

    Ein Zellausschnitt, der aelter ist als sein Notebook, zeigt eine
    Ausgabe, die es so nicht mehr gibt. Genau das ist passiert: Der
    Suchanker fuer nb2-kriterien zeigte auf eine geloeschte Zeile, das
    Werkzeug brach ab - und der Deckbau lief trotzdem durch, weil das
    alte PNG noch dalag. Auf der Folie stand danach ein Bild aus einer
    Fassung, deren Urteil umgedreht worden war.
    """
    pfad = ASSETS / f"{name}.png"
    if not pfad.exists():
        raise SystemExit(
            f"Bild fehlt: {pfad}\n"
            "Zuerst: python3 tools/notebook_ausschnitte.py "
            "und bash tools/render_diagrams.sh")
    # Zwei Sorten Bilder, zwei Quellen: Mermaid-Diagramme kommen aus einer
    # .mmd-Datei, Zellausschnitte aus einem Notebook. Der Praefix nb1-
    # steht bei beiden - entschieden wird deshalb ueber die Existenz der
    # Diagrammquelle, nicht ueber den Namen.
    diagramm_quelle = WURZEL / "doku" / "analytics" / "diagramme" / f"{name}.mmd"
    if diagramm_quelle.exists():
        quelle, befehl = diagramm_quelle, "bash tools/render_diagrams.sh"
    else:
        nummer = name[2] if name.startswith("nb") and name[2:3].isdigit() else None
        if not (nummer and int(nummer) in NB_DATEI):
            return str(pfad)
        quelle = WURZEL / "analytics" / "notebooks" / f"{NB_DATEI[int(nummer)]}.ipynb"
        befehl = f"python3 tools/notebook_ausschnitte.py {name}"
    if quelle.exists() and quelle.stat().st_mtime > pfad.stat().st_mtime + 1:
        raise SystemExit(
            f"Bild veraltet: {pfad.name} ist aelter als {quelle.name}.\n"
            f"Zuerst: {befehl}")
    return str(pfad)


def zellfolie(prs, nb, abschnitt, kicker, titel, ausschnitt, deutung, notiz):
    """Eine Folie, die eine ECHTE Notebookzelle zeigt und sie deutet.

    Das Bild traegt die Folie, der Text darunter sagt, worauf zu achten
    ist. Ohne diese eine Zeile ist ein Screenshot nur Dekoration.
    """
    s = folie(prs, kicker, titel, quelle=nbq(nb, abschnitt))
    y = unter_intro(s, 10)
    # Die Hoehe des Bandes folgt seinem Text (dieselbe Rechnung wie in
    # thws.sandband). Geschaetzt hatte ich 60 - bei drei Zeilen ragte das
    # Band dann 6 pt aus der Inhaltszone, und der Pruefer hat es gemeldet.
    je_zeile = int((BREITE - 32) / (14 * 0.52))
    band_h = max(52, max(1, -(-len(deutung) // je_zeile)) * 20 + 26)
    band_y = ZONE_UNTEN - band_h
    diagramm(s, bild(ausschnitt), y=y, hoehe=band_y - y - 14)
    sandband(s, deutung, y=band_y)
    notizen(s, notiz)
    return s


# ── Hoehen ausrechnen statt schaetzen
#
# Die zweite Form auf einer Folie braucht die Unterkante der ersten.
# Beim Umbau von Fall 1 standen dort geschaetzte Zahlen, und der
# Deckpruefer meldete elf Ueberlappungen - eine Tabelle mit fuenf
# Zeilen ist eben 40 pt hoeher als eine mit vier. Diese drei Funktionen
# nutzen dieselben Formeln wie die Motive in thws.py.

def h_tabelle(n_zeilen, zeilen_h):
    """Kopfzeile plus n Datenzeilen."""
    return (n_zeilen + 1) * zeilen_h


def h_gestapelt(n, hoehe, luecke):
    """streifen, schichtenstapel, ampel_matrix - n Karten mit Luecke."""
    return n * hoehe + (n - 1) * luecke


def darunter(y, hoehe, abstand=14):
    return y + hoehe + abstand


def streifen(s, zeilen, **kw):
    """regel_streifen, das auch Zweiertupel annimmt.

    Das Motiv erwartet (Regel, Wirkung, Beispielchip). Der Chip traegt
    hier meist nichts bei - die Wirkung steht schon im Fliesstext -,
    deshalb darf er entfallen.
    """
    regel_streifen(s, [z if len(z) == 3 else (z[0], z[1], "") for z in zeilen], **kw)


def rahmen(prs):
    AKTUELLES_NB[0] = None
    """Die zwei Folien zwischen Titel und Kapitel 1: Aufhaenger und Wegweiser."""
    s = folie(prs, "Der Ausgangspunkt",
              "Sechs Projekte, sechs Verfahren — und sechsmal dieselbe Reihenfolge",
              "Regression, Klassifikation, Clustering, Zeitreihe, Assoziation, "
              "Anomalieerkennung. Verschiedene Fragen, verschiedene Mathematik. "
              "Der Weg zum Ergebnis ist in allen sechs Fällen derselbe.")
    tabelle(s, ["Notebook", "Frage an die Daten"], [
        ["1 Regression", "Wie lange dauert diese Fahrt?"],
        ["2 Klassifikation", "Welche Räder müssen als Nächstes in die Werkstatt?"],
        ["3 Clustering", "Welche Gruppen stecken in den Daten?"],
        ["4 Zeitreihe", "Wie viele Fahrten kommen morgen?"],
        ["5 Assoziation", "Welche Wege gehören zusammen?"],
        ["6 Anomalieerkennung", "Was ist gestern schiefgelaufen?"],
    ], y=unter_intro(s), spalten_b=[250, 653.5], zeilen_h=40)
    notizen(s, "Lesen Sie die sechs Fragen laut vor. Sie klingen nach sechs völlig "
               "verschiedenen Aufgaben — und das sind sie auch. Genau deshalb ist es "
               "bemerkenswert, dass der Weg zur Antwort in allen sechs derselbe ist. "
               "Dieser Weg heißt CRISP-DM.")

    s = folie(prs, "Wegweiser", "Wie dieses Deck gebaut ist — und warum so",
              "Der Kreislauf wird nicht sechsmal wiederholt. Ein Fall läuft "
              "vollständig durch, die anderen fünf gehen dort in die Tiefe, wo sie "
              "etwas Neues zeigen.")
    streifen(s, [
        ("Kapitel 1 — Die Karte", "Der Kreislauf einmal kompakt. Bewusst knapp: "
                                  "Er bleibt abstrakt, bis der erste Fall ihn füllt"),
        ("Kapitel 2 — Fall 1 ganz", "Regression, alle sechs Phasen, mit den echten "
                                    "Zahlen. Hier wird die Karte konkret"),
        ("Kapitel 3 bis 7 — fünf Fälle", "Gleiches Gerüst, Tiefe nur an der Stelle, "
                                         "an der dieser Fall etwas beisteuert"),
        ("Kapitel 8 — Synthese", "Die sechs Fälle zurück auf die Karte gelegt"),
    ], y=unter_intro(s), hoehe=62, luecke=9, chip_b=0)
    notizen(s, "Weisen Sie auf die Leiste am Fuß der Folien hin: Sie zeigt jederzeit, "
               "in welcher Phase wir gerade sind. Wo ein Feld sandfarben mit rotem "
               "Rand erscheint, ist an dieser Stelle zurückgesprungen worden.")


# ═══════════════════════════════════════════════════ Teil A — Die Karte

def teil_karte(prs):
    AKTUELLES_NB[0] = None
    kapitel(prs, 1, "Der Kreislauf",
            "Warum braucht ein Datenprojekt überhaupt eine feste Schrittfolge?",
            "Wir bauen in diesem Kapitel die Landkarte. Sie ist bewusst knapp gehalten "
            "— sechs Phasen, was jede beantwortet, wo die Rücksprünge sitzen. Konkret "
            "wird das erst im nächsten Kapitel am ersten Fall. Wer die Karte jetzt "
            "abstrakt findet, hat recht: Sie IST abstrakt, bis der erste Fall sie "
            "füllt. Deshalb steht sie hier nur zwölf Folien lang.")

    # ── Warum ein Vorgehensmodell
    s = folie(prs, "Ausgangslage",
              "Ohne Reihenfolge ist ein Werkzeugkasten nur ein Haufen Werkzeug",
              "Die Verfahren sind lernbar und in wenigen Zeilen aufgerufen. Was Projekte "
              "scheitern lässt, ist fast nie die Mathematik — es ist die Reihenfolge.")
    y = unter_intro(s)
    kachelreihe(s, [
        ("Ohne Modell", [
            "Man beginnt mit den Daten, die da sind",
            "Das Ziel entsteht unterwegs",
            "Erfolg wird beurteilt, nachdem",
            "man das Ergebnis gesehen hat",
        ]),
        ("Die Folge", [
            "Jedes Ergebnis lässt sich",
            "im Nachhinein gut finden",
            "Niemand kann sagen, ob das",
            "Projekt sein Ziel erreicht hat",
        ]),
        ("Mit CRISP-DM", [
            "Die Frage steht vor den Daten",
            "Die Hürde steht vor dem Ergebnis",
            "Und es gibt einen benannten Ort",
            "für das Eingeständnis: zurück",
        ]),
    ], y=y, hoehe=178)
    sandband(s, "CRISP-DM ist kein Werkzeug, sondern eine Reihenfolge mit "
                "verbindlichen Zwischenständen. Der Wert steckt nicht in den sechs "
                "Namen, sondern darin, dass man sie NICHT überspringen darf.",
             y=y + 194)
    notizen(s, "Fragen Sie hier in den Raum: Wer hat schon einmal eine Auswertung "
               "gemacht und dabei das Erfolgskriterium erst festgelegt, als das "
               "Ergebnis schon auf dem Tisch lag? Fast alle haben. Das ist keine "
               "Nachlässigkeit, sondern die natürliche Reihenfolge — und genau "
               "deshalb braucht es ein Modell, das dagegen hält.")

    # ── Die sechs Phasen
    s = folie(prs, "Überblick", "Sechs Phasen, und jede beantwortet genau eine Frage",
              "Von der Geschäftsfrage zum laufenden Betrieb. Die Reihenfolge ist "
              "verbindlich, aber sie ist keine Einbahnstraße.")
    diagramm(s, bild("crispdm-kreis"), y=unter_intro(s), breite=BREITE)
    sandkarte(s, "Die Faustregel, die alle unterschätzen",
              ["Phase 2 und 3 kosten in echten Projekten 60 bis 80 Prozent der Zeit.",
               "Phase 4 — das Modellieren, an das alle denken — sind oft zehn Zeilen Code.",
               "Wer beim Lesen eines Notebooks die Zeilen zählt, sieht dasselbe Verhältnis."],
              y=unter_intro(s) + 130)
    phasenleiste(s, 0)
    notizen(s, "Die Kette liest sich von links nach rechts, aber sie ist ein KREIS. "
               "Das Wort Kreislauf steht nicht zufällig im Namen. Auf der übernächsten "
               "Folie sehen wir, wo in unseren sechs Fällen tatsächlich zurückgesprungen "
               "wurde — in vier von sechs.")

    # ── Je eine Folie pro Phase
    phasen = [
        (1, "Business Understanding", "Was ist das Problem — und woran messen wir Erfolg?",
         [("Geschäftsziel", "Was soll sich im Betrieb ändern? In der Sprache des Fachs, "
                            "nicht der Statistik"),
          ("Analytisches Ziel", "Was genau soll geschätzt, sortiert oder gruppiert werden?"),
          ("Erfolgskriterium", "Eine Zahl mit einer Hürde — festgelegt, BEVOR jemand "
                               "die Daten gesehen hat"),
          ("Fehlerkosten", "Welcher Fehler ist teurer? Fast nie sind beide gleich teuer")],
         "Das ist die Phase, die am häufigsten übersprungen wird — und die einzige, "
         "die man nicht nachholen kann. Ein Erfolgskriterium, das nach dem Ergebnis "
         "festgelegt wird, ist keins."),
        (2, "Data Understanding", "Tragen die Daten die Frage überhaupt?",
         [("Beschaffen", "Woher kommen die Daten, und was fehlt?"),
          ("Beschreiben", "Wie viele Zeilen, welche Spalten, welche Lücken?"),
          ("Erkunden", "Zuerst die Zielgröße ansehen, dann die Zusammenhänge"),
          ("Qualität prüfen", "Was ist unplausibel — und ist es ein Fehler oder ein Befund?")],
         "Hier wird nicht modelliert, hier wird GESEHEN. Wer diese Phase abkürzt, "
         "modelliert später Artefakte. In Notebook 6 kostet genau das eine ganze Runde."),
        (3, "Data Preparation", "Wie werden aus Rohdaten Merkmale, die man verwenden darf?",
         [("Auswählen", "Zeilen und Spalten begründet ausschließen — jeder Filter "
                        "mit Zeilenzahl davor und danach"),
          ("Bereinigen", "Fehlende Werte, Ausreißer, Dubletten"),
          ("Merkmale bauen", "Aus Zeitstempel wird Stunde, Wochentag, Feiertag"),
          ("Aufteilen", "Trainings- und Testmenge — bei Zeitbezug entlang der Zeit, "
                        "nicht zufällig")],
         "Die teuerste Phase, und die mit der gefährlichsten Falle: Merkmale, die es "
         "zum Vorhersagezeitpunkt gar nicht gibt. Dazu gleich mehr."),
        (4, "Modeling", "Welches Verfahren, und woran messen wir es?",
         [("Nullmodell zuerst", "Der einfachste denkbare Tipp. Wer den nicht schlägt, "
                                "hat nichts gewonnen"),
          ("Faustregel als Maßstab", "Was macht der Betrieb heute ohne Modell?"),
          ("Dann erst Verfahren", "Vom Durchschaubaren zum Stärkeren, nicht umgekehrt"),
          ("Kosten einbauen", "Ungleiche Fehlerkosten gehören ins Modell, nicht in "
                              "die Nachbetrachtung")],
         "Die kürzeste Phase. Sie wirkt in jedem Lehrbuch wie die Hauptsache und ist "
         "in der Praxis der kleinste Teil."),
        (5, "Evaluation", "Reicht das für die Entscheidung, um die es geht?",
         [("Technische Güte", "MAE, Trefferquote, Silhouette — notwendig, aber nie "
                              "hinreichend"),
          ("Gegen die Hürde", "Die Zahl aus Phase 1 — bestanden oder nicht"),
          ("Fehler ansehen", "Nicht nur wie gut, sondern WORAN es scheitert"),
          ("Urteil fällen", "Weiter, zurück, oder ehrlich abbrechen")],
         "Hier entscheidet sich, ob das Projekt weitergeht. Und hier zeigt sich, ob "
         "die Kriterien aus Phase 1 etwas taugten."),
        (6, "Deployment", "Wie kommt das Ergebnis in den Betrieb — und wer merkt, wenn es kippt?",
         [("Haltbar machen", "Modell und Merkmalsliste zusammen speichern"),
          ("Einbauen", "Die Funktion, die der Betrieb tatsächlich aufruft"),
          ("Überwachen", "Woran erkennt man, dass das Modell veraltet?"),
          ("Rückkopplung bedenken", "Verändert die Auslieferung die Daten, aus denen "
                                    "wir künftig lernen?")],
         "Die Phase, die in Lehrbeispielen fast immer fehlt. Ein Modell, das niemand "
         "aufruft, hat keinen Wert — und eines, das niemand überwacht, ist eine "
         "tickende Uhr."),
    ]
    for nr, name, frage, punkte, notiz in phasen:
        s = folie(prs, f"Phase {nr} von 6", f"{name}: {frage}")
        streifen(s, punkte, y=unter_intro(s), hoehe=54, luecke=8, chip_b=250)
        phasenleiste(s, nr)
        notizen(s, notiz)

    # ── Die Rücksprünge
    s = folie(prs, "Der Kern", "Der Rücksprung ist kein Scheitern — er ist das Verfahren",
              "Was CRISP-DM von einer Checkliste unterscheidet, sind die Pfeile "
              "zurück. In unseren sechs Fällen wurde viermal zurückgesprungen.")
    tabelle(s, ["Fall", "Rücksprung", "Warum"], [
        ["1 Regression", "5 → 1", "Für zwei von drei Radtypen ist eine Punktschätzung "
                                  "die falsche Zusage — eine Spanne wäre ehrlich"],
        ["3 Clustering", "5 → 1", "Die Analyse brachte eine bessere Frage hervor, als "
                                  "die war, mit der wir angefangen hatten"],
        ["6 Anomalie", "4 → 3", "Das Modell fand die Preisklasse statt der Anomalien — "
                                "die Merkmale mussten normiert werden"],
        ["6 Anomalie", "5 → Ende", "Aufgabe B scheitert an den Grunddaten. Ein negatives "
                                   "Ergebnis, ausdrücklich nicht ausgeliefert"],
    ], y=unter_intro(s), spalten_b=[150, 130, 623.5], zeilen_h=44)
    sandband(s, "Ein Projekt, das ohne einen einzigen Rücksprung durchläuft, hat "
                "entweder eine triviale Frage gestellt — oder nicht genau genug "
                "hingesehen.", y=unter_intro(s) + 232)
    phasenleiste(s, 0, rueckspruenge=(1, 3))
    notizen(s, "Diese Folie ist das Herz des Kapitels. Studierende lesen CRISP-DM "
               "als Abarbeitungsliste und empfinden einen Rücksprung als Fehler. "
               "In Wahrheit ist der Rücksprung der Beleg dafür, dass jemand "
               "hingesehen hat. In Notebook 6 kann man ihn Zelle für Zelle mitlesen.")

    # ── Die zwei häufigen Fehler
    s = folie(prs, "Zwei Fehler", "Zwei Fehler, die man in fast jedem Erstprojekt sieht")
    vorher_nachher(s,
                   ("So läuft es meistens", "Kriterium nach dem Ergebnis", [
                       "1. Daten laden, Modell rechnen",
                       "2. Der Fehler liegt bei 3,96 Minuten",
                       "3. „Unter vier Minuten — ordentlich.“",
                       "",
                       "Die Hürde wurde an das Ergebnis",
                       "angelegt, nicht umgekehrt. So kann",
                       "kein Projekt scheitern — und deshalb",
                       "sagt sein Erfolg auch nichts.",
                   ], False),
                   ("So gehört es", "Kriterium vor den Daten", [
                       "1. „Der Preisfehler muss unter",
                       "   50 Cent liegen“ — vor allem",
                       "   anderen festgelegt",
                       "2. Daten laden, Modell rechnen",
                       "3. CITY 0,41 € hält, EBIKE 0,85 €",
                       "   und CARGO 2,48 € reißen",
                       "",
                       "Genau so steht es in Notebook 1 —",
                       "und deshalb ist das Ergebnis dort",
                       "eine Erkenntnis statt einer Ausrede.",
                   ], False),
                   y=unter_intro(s), hoehe=222)
    phasenleiste(s, 0)
    notizen(s, "Der zweite Fehler steht auf der nächsten Folie: das Verfahren wählen, "
               "bevor die Frage steht. Beide Fehler haben dieselbe Wurzel — man fängt "
               "bei dem an, was Spaß macht, statt bei dem, was entschieden werden soll.")

    # ── Die sechs Fälle im Überblick
    s = folie(prs, "Wegweiser", "Sechs Fälle — und jeder zeigt eine andere Phase von innen",
              "Deshalb wird der Kreislauf hier nicht sechsmal wiederholt. Fall 1 "
              "läuft vollständig durch; die übrigen fünf gehen dort in die Tiefe, "
              "wo sie etwas Neues zu zeigen haben.")
    tabelle(s, ["Fall", "Verfahren", "Zeigt", "Der Satz, der bleibt"], [
        ["1", "Regression", "alle sechs", "Ob ein Merkmal erlaubt ist, entscheidet der "
                                          "Prozess — nicht der Spaltenname"],
        ["2", "Klassifikation", "Phase 6", "Ein Modell muss seinen Unterhalt verdienen — "
                                           "hier verdient es ihn nicht"],
        ["3", "Clustering", "Phase 1", "Erfolgskriterien auch ohne Zielgröße"],
        ["4", "Zeitreihe", "Phase 3", "Die genaueste Prognose ist nicht die günstigste"],
        ["5", "Assoziation", "Phase 5", "Keine Regel nimmt beide Hürden — und die "
                                        "Hürde bleibt trotzdem stehen"],
        ["6", "Anomalie", "Rücksprung", "Ein Verfahren, das schlechter ist als eine "
                                        "Zeile Fachwissen, ist an der Aufgabenstellung "
                                        "gescheitert"],
    ], y=unter_intro(s), spalten_b=[50, 130, 110, 613.5], zeilen_h=42)
    phasenleiste(s, 0)
    notizen(s, "Diese Tabelle ist der Fahrplan für den Rest des Decks. Sie taucht in "
               "der Synthese am Ende noch einmal auf, dann ausgefüllt mit dem, was "
               "wir unterwegs gesehen haben.")

    s = folie(prs, "Wegweiser", "Dieselbe Zuordnung als Bild",
              "Welcher Fall beleuchtet welche Phase? Diese Zuordnung ist der Grund "
              "für den Aufbau des Decks.")
    diagramm(s, bild("crispdm-faelle"), y=unter_intro(s),
             hoehe=ZONE_UNTEN - unter_intro(s) - 34)
    notizen(s, "Zwei Fälle zeigen auf Phase 5 — Fall 1 und Fall 5 —, aber aus "
               "verschiedenen Richtungen: der eine, weil die gemittelte Kennzahl "
               "täuscht, der andere, weil vorab gesetzte Hürden radikal sieben. "
               "Das ist kein Zufall: Phase 5 ist die Phase, in der sich entscheidet, "
               "ob die Arbeit der Phasen 1 bis 4 etwas taugte.")


# ═════════════════════════════════════ Teil B — Referenzfall Notebook 1

def teil_referenzfall(prs):
    AKTUELLES_NB[0] = 1
    kapitel(prs, 2, "Fall 1 — Regression: der volle Durchlauf",
            "Was kostet die Fahrt zu diesem Ziel — und wann sagt die App besser "
            "gar nichts?",
            "Dieses Kapitel ist das Rückgrat des Decks. Es läuft alle sechs Phasen "
            "vollständig durch, mit den echten Zahlen aus Notebook 1. Die Regression "
            "ist bewusst gewählt: Sie ist das vertrauteste Verfahren, deshalb bleibt "
            "die Aufmerksamkeit beim VORGEHEN statt beim Verfahren. Alle folgenden "
            "Fälle setzen dieses Kapitel voraus. Bitten Sie die Studierenden, das "
            "Notebook parallel offen zu haben — jede Folie nennt in der Fußzeile "
            "ihren Abschnitt.")

    # ── Der Einwand, aus dem der ganze Fall entsteht
    s = folie(prs, "Fall 1", "Der Einwand, mit dem dieses Notebook anfängt",
              "Die naheliegende Idee: Beim Entsperren schätzt ein Modell die "
              "Fahrtdauer, das Tarifblatt macht daraus einen Preis. Diese Idee hat "
              "einen Fehler — und zwar keinen technischen.")
    vorher_nachher(s,
                   ("Die naheliegende Idee", "Schätzen beim Entsperren", [
                       "Das Modell kennt Startstation,",
                       "Uhrzeit und Wochentag.",
                       "",
                       "Damit kann es zwei Fahrten nicht",
                       "unterscheiden, die gleich beginnen:",
                       "acht Minuten zum Bahnhof gegen",
                       "neunzig Minuten am Main entlang.",
                   ], False),
                   ("Der Einwand", "Der Nutzer weiß es besser", [
                       "Er kennt sein Ziel.",
                       "Er weiß, ob er es eilig hat.",
                       "Er weiß, ob er unterwegs anhält.",
                       "",
                       "Wozu soll ein Modell etwas",
                       "vorhersagen, das der Mensch",
                       "davor längst weiß?",
                   ], False),
                   y=unter_intro(s), hoehe=206)
    phasenleiste(s, 1)
    notizen(s, "Diese Folie ist der Einstieg in den ganzen Fall, und sie ist "
               "unbequem: Der Einwand kommt nicht aus der Statistik, sondern aus dem "
               "Produkt. Ein Modell, das eine Zahl liefert, die der Nutzer selbst "
               "besser kennt, ist technisch einwandfrei und trotzdem nutzlos. "
               "Lassen Sie die Studierenden zuerst selbst überlegen, was man dagegen "
               "tun kann — die meisten schlagen ein besseres Verfahren vor. Die "
               "Antwort auf der nächsten Folie ist eine andere.")

    s = folie(prs, "Fall 1", "Nicht das Verfahren ändern — den Prozess",
              "Das Problem ist keins des Verfahrens, sondern eines der Information. "
              "Fehlende Information holt man nicht durch mehr Rechenleistung herein, "
              "sondern indem man fragt.")
    prozesskette(s, "App an der\nStation", [
        ("Ziel auf der\nKarte wählen", ""), ("„Preis\nschätzen“", ""),
        ("Spanne wird\nangezeigt", ""),
    ], "Kunde\nentscheidet", y=unter_intro(s) + 6, hoehe=84)
    sandkarte(s, "Und daraus folgt die Einsicht, die das ganze Notebook trägt",
              ["Ob ein Merkmal verwendet werden darf, entscheidet nicht sein "
               "Spaltenname, sondern der Zeitpunkt, zu dem es im Prozess entsteht.",
               "Die Zielstation war im alten Entwurf verboten. Im neuen ist sie "
               "erlaubt — nicht, weil sich die Daten geändert hätten, sondern weil "
               "der Kunde sie jetzt vorher eingibt.",
               "Ändert man den Prozess, ändert sich die Antwort auf die Frage, was "
               "Leakage ist."],
              y=unter_intro(s) + 106)
    phasenleiste(s, 1)
    notizen(s, "Das ist der Satz, den die Studierenden aus Notebook 1 mitnehmen "
               "sollen. Leakage wird meistens als Liste verbotener Spaltennamen "
               "gelehrt. Hier sieht man, dass dieselbe Spalte je nach Prozess "
               "verboten oder erlaubt ist. Wer nur die Liste gelernt hat, hätte die "
               "Zielstation weiterhin gesperrt — und damit das bessere Produkt "
               "verhindert.")

    s = folie(prs, "Fall 1", "Die Annahme, auf der alles Weitere ruht",
              "Ein Prozess, den wir künftig ändern, macht eine historische "
              "Ergebnisspalte nicht rückwirkend zu einer Eingabe. Das muss auf den "
              "Tisch, bevor irgendeine Zahl fällt.")
    kachelreihe(s, [
        ("Worauf trainiert wird", [
            "end_station_id — die Station,",
            "an der die Fahrt tatsächlich",
            "geendet hat.",
            "",
            "Das steht so in den",
            "historischen Daten.",
        ]),
        ("Was im Betrieb ankommt", [
            "Die Station, die der Kunde",
            "vorher gewählt hat.",
            "",
            "Beide fallen auseinander,",
            "wenn jemand umplant oder",
            "die Zielstation voll ist.",
        ]),
        ("Was daraus folgt", [
            "Das tatsächliche Ziel ist ein",
            "unvalidierter Stellvertreter",
            "für das geplante.",
            "",
            "Jede Zahl in diesem Notebook",
            "ist deshalb eine Obergrenze.",
        ]),
    ], y=unter_intro(s), hoehe=186)
    sandband(s, "Prüfen lässt sich diese Annahme erst, wenn die App das geplante Ziel "
                "speichert. Bis dahin steht sie als Vorbehalt im Notebook — nicht in "
                "einer Fußnote am Ende.", y=unter_intro(s) + 196)
    phasenleiste(s, 1)
    notizen(s, "Diese Folie ist der Grund, warum das Notebook glaubwürdig ist. Es "
               "wäre leicht gewesen, den Unterschied zwischen geplantem und "
               "tatsächlichem Ziel zu übergehen — niemand hätte es gemerkt. Fragen "
               "Sie die Studierenden, welche Zahl auf den folgenden Folien dadurch "
               "kleiner würde. Antwort: alle.")

    s = folie(prs, "Fall 1", "Der Fall auf einen Blick",
              "Bevor wir loslaufen: wohin die Reise geht. Das Urteil steht hier "
              "schon — interessant ist der Weg dorthin.")
    steckbrief(s, [
        ("Geschäftsfrage", "Kann die App den Preis nennen, nachdem der Kunde sein "
                           "Ziel gewählt hat?"),
        ("Analytisches Ziel", "Die Dauer in Minuten schätzen — der Preis folgt "
                              "daraus über das Tarifblatt"),
        ("Erfolgskriterium", "Preisfehler unter 50 Cent, festgelegt vor dem ersten "
                             "Blick in die Daten"),
        ("Daten", "60.425 Vorgänge aus drei Jahren, davon 47.054 im Geltungsbereich"),
        ("Verfahren", "Vier Baselines, dann lineare Regression, Baum, Random Forest"),
        ("Urteil", "CITY hält die Grenze — und wir springen trotzdem zurück"),
    ], y=unter_intro(s))
    notizen(s, "Die letzte Zeile ist der ungewöhnliche Teil. In den meisten "
               "Lehrbeispielen kommt der Rücksprung, weil etwas schiefgeht. Hier "
               "kommt er, obwohl das Kriterium hält. Warum, sehen wir in Phase 5.")

    # ─────────────────────────────────────────────── Phase 1
    s = folie(prs, "Phase 1 · Business Understanding", "Vom Wunsch zur Zahl",
              "„Der Kunde soll wissen, was es kostet.“ Das ist ein Wunsch, kein "
              "Auftrag. Aus ihm wird in drei Schritten etwas Messbares.")
    streifen(s, [
        ("Geschäftsziel", "Nach der Zielwahl steht eine Preisangabe auf dem Bildschirm"),
        ("Analytisches Ziel", "Geschätzt wird die DAUER, nicht der Preis"),
        ("Erfolgskriterium", "Die Angabe liegt im Mittel unter 50 Cent daneben — "
                             "die Grenze kommt aus dem Produktmanagement"),
        ("Gemessen auf", "einem Zeitraum, den das Modell beim Training nie gesehen hat"),
    ], y=(y := unter_intro(s)), hoehe=48, luecke=9, chip_b=250)
    sandband(s, "Man schätzt nie, was man ausrechnen kann. Das Tarifblatt ist exakt "
                "bekannt — es zu schätzen wäre ein zusätzlicher Fehler ohne jeden "
                "Gegenwert.", y=darunter(y, h_gestapelt(4, 48, 9)))
    phasenleiste(s, 1)
    notizen(s, "Der Sprung vom Preis zur Dauer ist die eigentliche "
               "Modellierungsentscheidung dieser Phase, und sie fällt hier, nicht in "
               "Phase 4. Wer den Preis direkt schätzt, schätzt zwei Dinge auf einmal: "
               "die Dauer und die Tariflogik. Die zweite kennt er aber genau.")

    s = folie(prs, "Phase 1 · Business Understanding",
              "Der Geltungsbereich — was ausdrücklich nicht dazugehört",
              "Drei Einschränkungen, und die dritte ist eine Setzung. Der Unterschied "
              "gehört benannt, nicht versteckt.")
    tabelle(s, ["Einschränkung", "Warum", "Belegt oder gesetzt?"], [
        ["Nur abgeschlossene Fahrten", "Abbrüche und Stornierungen sind keine Fahrten",
         "belegt — sie dauern zwei Minuten"],
        ["Nur Station zu Station", "Wer frei im Gebiet abstellt, hat kein Ziel gewählt",
         "belegt — betrifft ein Fünftel"],
        ["Nur Fahrten bis acht Stunden",
         "Darüber liegt eine vergessene Rückgabe, ein eigener Geschäftsfall",
         "gesetzt — es gibt keine Statusangabe, die das trennt"],
    ], y=(y := unter_intro(s)), spalten_b=[220, 350, 333.5], zeilen_h=58)
    sandband(s, "Die dritte Zeile ist die ehrlichste der Folie: Acht Stunden sind "
                "eine Verabredung, keine Messung. Sie gehört fachlich abgesichert — "
                "und bis dahin steht sie als offener Punkt im Notebook.",
             y=darunter(y, h_tabelle(3, 58)))
    phasenleiste(s, 1)
    notizen(s, "Der Geltungsbereich entscheidet mit darüber, wie gut ein Modell "
               "aussieht. Wer ihn eng zieht, bekommt bessere Zahlen für ein "
               "kleineres Produkt. Deshalb gehört er in Phase 1 und nicht in die "
               "Datenaufbereitung — sonst gerät er zur nachträglichen Ausrede.")

    zellfolie(prs, 1, "1 — Das Tarifblatt", "Phase 1 · im Notebook",
              "Das Tarifblatt: drei Räder, drei Minutenpreise",
              "nb1-tarif",
              "Startgebühr, Minutenpreis, Tageshöchstpreis — daraus wird später der "
              "Preis gerechnet, nicht geschätzt.",
              "Zeigen Sie auf die Spalte preis_pro_minute_eur: 0,10 gegen 0,25 gegen "
              "0,50 Euro. Dieselbe 50-Cent-Grenze bedeutet damit für das City-Rad "
              "fünf Minuten Spielraum und für das Lastenrad eine einzige. Diese "
              "Spreizung entscheidet in Phase 5 über das Urteil — und sie steht "
              "schon hier, in Phase 1.")

    # ─────────────────────────────────────────────── Phase 2
    s = folie(prs, "Phase 2 · Data Understanding", "Nicht jeder Vorgang ist eine Fahrt",
              "Bevor irgendetwas gerechnet wird: Was steht überhaupt in der Tabelle? "
              "Die Antwort ändert die Datenmenge um ein Fünftel.")
    tabelle(s, ["Status", "Anzahl", "Mediandauer", "Was das heißt"], [
        ["abgeschlossen", "58.737", "11 Minuten", "das sind Fahrten"],
        ["abgebrochen", "1.364", "2 Minuten", "Vorgänge, die nie eine wurden"],
        ["storniert", "324", "1 Minute", "dito — und beide verzerren die kurzen Wege"],
    ], y=unter_intro(s), spalten_b=[190, 120, 150, 443.5], zeilen_h=46)
    sandband(s, "Zwei Minuten sind keine Fahrt, sondern ein Fehlgriff am Schloss. "
                "Wer sie mitzählt, drückt genau die kurzen Strecken nach unten, um "
                "die es hier geht.", y=unter_intro(s) + 194)
    phasenleiste(s, 2)
    notizen(s, "Diese Folie steht bewusst vor allen Kennzahlen. Studierende beginnen "
               "Phase 2 meistens mit einer Verteilung der Zielgröße. Sinnvoller ist "
               "die Frage, ob jede Zeile überhaupt den Sachverhalt beschreibt, um "
               "den es geht — hier tut das jede fünfte Zeile nicht.")

    zellfolie(prs, 1, "2.2", "Phase 2 · im Notebook",
              "Der Trichter: von 60.425 auf 47.054 Fahrten",
              "nb1-trichter",
              "Jeder Schritt mit Zeilenzahl. 77,9 Prozent bleiben übrig — und ein "
              "Fünftel fehlt aus einem Grund, der kein Fehler ist.",
              "Fast 20 Prozent der Fahrten enden frei im Geschäftsgebiet und haben "
              "deshalb kein Ziel. Das sieht aus wie ein Datenqualitätsproblem und ist "
              "in Wahrheit ein beworbenes Produktmerkmal. Wer es wegbereinigt, "
              "verliert ein Fünftel der Daten für nichts — wer es als Fehler meldet, "
              "blamiert sich vor dem Fachbereich.")

    s = folie(prs, "Phase 2 · Data Understanding",
              "Rundtouren: dieselbe Verbindung, jede beliebige Dauer",
              "Bei jeder sechsten Fahrt mit Ziel ist das Ziel der Start. Für ein "
              "Modell, das aus der Verbindung lernt, ist das ein Problem.")
    tabelle(s, ["Art der Fahrt", "Anzahl", "Mediandauer", "Mittlere Hälfte"], [
        ["Rundtour — Start ist gleich Ziel", "7.749", "18 Minuten", "11 bis 33 Minuten"],
        ["echter Weg", "39.305", "10 Minuten", "7 bis 16 Minuten"],
    ], y=(y := unter_intro(s)), spalten_b=[330, 120, 160, 293.5], zeilen_h=48)
    sandkarte(s, "Warum das zählt",
              ["Bei einer Rundtour trägt das Ziel per Definition nichts zur Dauer bei "
               "— es ist ja der Start.",
               "Und sie streuen doppelt so stark: 22 Minuten Spannweite gegen 9.",
               "Das ausgelieferte Produkt wird Rundtouren deshalb gar nicht "
               "beantworten. Diese Entscheidung fällt hier, nicht in Phase 6."],
              y=darunter(y, h_tabelle(2, 48)))
    phasenleiste(s, 2)
    notizen(s, "16,5 Prozent klingt nach einer Randgruppe. Es sind aber genau die "
               "Fahrten, bei denen das neue Verfahren nichts gewinnt — der Kunde "
               "wählt als Ziel den Start und bekommt trotzdem keine belastbare "
               "Auskunft. Die App sagt das später offen.")

    s = folie(prs, "Phase 2 · Data Understanding",
              "Was die Verbindung erklärt — ein erster Blick ohne Modell",
              "Man kann den Nutzen der Zielinformation schätzen, bevor man ein "
              "Verfahren wählt: Wie weit kommt man mit dem bloßen Median?")
    tabelle(s, ["Was man weiß", "Mittlerer absoluter Fehler"], [
        ["gar nichts — der Median aller Fahrten", "8,04 Minuten"],
        ["die Startstation", "5,29 Minuten"],
        ["Start UND Ziel — die Verbindung", "5,03 Minuten"],
    ], y=unter_intro(s), spalten_b=[450, 453.5], zeilen_h=46)
    sandband(s, "Der große Sprung kommt von der Startstation, nicht vom Ziel. Diese "
                "Zahl steht in Phase 2 — und sie wird in Phase 4 mit einem Modell "
                "noch einmal überprüft.", y=unter_intro(s) + 194)
    phasenleiste(s, 2)
    notizen(s, "Hier lohnt eine Vorwarnung an die Studierenden: Das ganze Notebook "
               "ist um die Zielinformation herum gebaut, und schon in Phase 2 zeigt "
               "sich, dass sie wenig beiträgt. Ein Projekt, das diese Zahl "
               "verschweigt, verkauft seinen eigenen Umbau schöner, als er ist.")

    # ─────────────────────────────────────────────── Phase 3
    s = folie(prs, "Phase 3 · Data Preparation",
              "Der Leakage-Test: nicht welche Spalte, sondern wann sie entsteht",
              "Die Frage ist nicht statistisch, sondern zeitlich: Was steht in dem "
              "Moment zur Verfügung, in dem die Anzeige erscheinen soll?",
              quelle=nbq(1, "3.1"))
    diagramm(s, bild("nb1-leakage"), y=unter_intro(s),
             hoehe=ZONE_UNTEN - unter_intro(s) - 34)
    notizen(s, "Grün, was beim Antippen von „Preis schätzen“ bekannt ist. Rot, was "
               "erst beim Abstellen entsteht. Die Zielstation steht auf der grünen "
               "Seite — im alten Entwurf stand sie auf der roten. Nichts an den "
               "Daten hat sich geändert, nur der Prozess. Der sandfarbene Kasten "
               "rechts hält den Vorbehalt fest, damit das Bild nicht mehr verspricht, "
               "als das Notebook belegen kann.")

    zellfolie(prs, 1, "3.1", "Phase 3 · im Notebook",
              "Gesperrt und erlaubt, jeweils mit Begründung",
              "nb1-gesperrt",
              "Fünf Spalten sind gesperrt, weil sie zum Anfragezeitpunkt nicht "
              "existieren. Eine ist erlaubt, obwohl sie nach „Ende“ klingt.",
              "Lassen Sie die Studierenden die letzte Zeile lesen. end_station_id "
              "ist erlaubt, weil der Kunde sie gewählt hat — mit dem Vorbehalt aus "
              "dem Kasten. Auch temp_mittel_c ist gesperrt: Das Tagesmittel der "
              "Temperatur kennt man erst am Abend. Wer Wetter verwenden will, "
              "braucht archivierte Prognosen, keine Messwerte.")

    s = folie(prs, "Phase 3 · Data Preparation",
              "Aufteilen: vier Abschnitte entlang der Zeit, nicht zwei",
              "Ein Rücksprung ist eine neue Runde — und eine neue Runde braucht "
              "einen Zeitraum, den die alte nicht schon aufgebraucht hat.")
    tabelle(s, ["Abschnitt", "Fahrten", "Zeitraum", "Wofür"], [
        ["Training", "28.232", "09/2023 bis 07/2025", "das Modell lernt"],
        ["Validierung", "7.058", "07/2025 bis 12/2025", "Modellwahl"],
        ["Test 1", "5.882", "12/2025 bis 06/2026", "Prüfung der Punktschätzung"],
        ["Test 2", "5.882", "06/2026 bis 08/2026", "Prüfung der Spanne nach dem Rücksprung"],
    ], y=(y := unter_intro(s)), spalten_b=[150, 110, 240, 403.5], zeilen_h=42)
    sandband(s, "Test 1 ist Winter und Frühjahr, Test 2 ist Sommer. Das ist kein "
                "Zufall der Aufteilung, sondern eine Eigenschaft der Daten — und es "
                "wird uns in Phase 5 beschäftigen.", y=darunter(y, h_tabelle(4, 42)))
    phasenleiste(s, 3)
    notizen(s, "Der übliche Fehler ist ein zweigeteilter Datensatz. Dann prüft man "
               "nach dem Rücksprung auf demselben Testzeitraum, auf dem man schon "
               "einmal geprüft hat — und weiß nicht mehr, ob das Ergebnis hält oder "
               "ob man sich an den Testdaten entlanggehangelt hat. Vier Abschnitte "
               "kosten nichts außer Vorausdenken.")

    zellfolie(prs, 1, "3.3", "Phase 3 · im Notebook",
              "Die Aufteilung — samt zweier unbequemer Hinweise",
              "nb1-abschnitte",
              "Das Notebook sagt selbst, wo seine Aufteilung nicht sauber ist: Die "
              "Erkundung in Phase 2 lief über den gesamten Datensatz.",
              "Punkt 2 der Ausgabe ist der wichtigere: Test 2 trägt in Phase 6 die "
              "Auswahl des Artefakts UND die Freigabe. Damit ist er eine "
              "Kalibrierung, keine unabhängige Endprüfung mehr. Das steht so im "
              "Notebook — und es ist die Sorte Satz, die man in Projektberichten "
              "selten liest.")

    # ─────────────────────────────────────────────── Phase 4
    s = folie(prs, "Phase 4 · Modeling",
              "Vier Baselines, bevor ein Modell gerechnet wird",
              "Ohne Maßstab ist jede Zahl gut. Diese vier Zeilen kosten zusammen "
              "zehn Minuten und entscheiden, was später als Erfolg gelten darf.")
    tabelle(s, ["Baseline", "MAE (Minuten)", "Was sie beweist"], [
        ["A  Median aller Fahrten", "8,10", "die Untergrenze des Nichtwissens"],
        ["B  Median je Radtyp", "8,01", "der Radtyp allein bringt fast nichts"],
        ["C  Median je Startstation", "5,29", "der große Sprung — 2,81 Minuten"],
        ["D  Median je Verbindung", "5,02", "das Ziel bringt 0,27 Minuten dazu"],
    ], y=(y := unter_intro(s)), spalten_b=[290, 160, 453.5], zeilen_h=42)
    sandband(s, "Baseline D ist der eigentliche Gegner: Sie ist eine Nachschlagetabelle "
                "aus Medianen und kostet keine Zeile Modellcode. Alles, was ein "
                "Verfahren später beiträgt, muss über diesen 5,02 Minuten liegen.",
             y=darunter(y, h_tabelle(4, 42)))
    phasenleiste(s, 4)
    notizen(s, "Der Vergleich B gegen C ist lehrreich: Der Radtyp — also die "
               "Eigenschaft, an der das Preisblatt hängt — sagt über die Dauer fast "
               "nichts. Die Startstation sagt viel. Studierende erwarten das "
               "umgekehrt, weil E-Bikes schneller sind. Sie sind schneller, aber "
               "die Leute fahren mit ihnen weiter.")

    zellfolie(prs, 1, "4.1", "Phase 4 · im Notebook",
              "Die vier Baselines, wie sie im Notebook stehen",
              "nb1-baselines",
              "2,81 Minuten kommen von der Startstation, 0,27 vom Ziel. Diese beiden "
              "Zahlen tragen die ganze Diskussion um den Prozessumbau.",
              "Fragen Sie an dieser Stelle: Rechtfertigen 0,27 Minuten einen Umbau "
              "der App? Die ehrliche Antwort ist, dass die Zahl allein es nicht tut. "
              "Was sie rechtfertigt, ist das ANDERE Produkt, das dadurch möglich "
              "wird — eine Auskunft zum gewählten Ziel statt einer Zahl, die der "
              "Kunde ohnehin besser kennt.")

    s = folie(prs, "Phase 4 · Modeling",
              "Eine Pipeline, damit im Betrieb nichts auseinanderfällt",
              "Kodierung und Modell gehören in ein Objekt. Getrennt gespeichert "
              "überleben sie den ersten Betriebsmonat nicht.")
    code_kacheln(s,
                 ("Was zusammengehört", [
                     "ColumnTransformer",
                     "  OneHotEncoder(",
                     "    handle_unknown='ignore')",
                     "  numerische Spalten",
                     "+ RandomForestRegressor",
                     "= eine Pipeline",
                 ], BLAU),
                 ("Warum zusammen", [
                     "Die Spaltenreihenfolge steckt",
                     "im selben Objekt wie das",
                     "Modell — sie kann nicht mehr",
                     "verrutschen.",
                     "handle_unknown: eine neue",
                     "Station wirft keinen Fehler.",
                 ], TUERKIS),
                 y=unter_intro(s), hoehe=200)
    phasenleiste(s, 4)
    notizen(s, "Eine Pipeline ist keine Stilfrage. Wer den Kodierer getrennt vom "
               "Modell speichert, hat zwei Dateien, die zusammenpassen müssen — und "
               "irgendwann tun sie es nicht mehr. handle_unknown='ignore' ist die "
               "zweite Vorsorge: Eine Station, die es beim Training noch nicht gab, "
               "führt zu einer Vorhersage aus lauter Nullen statt zu einem Absturz. "
               "Ob diese Vorhersage etwas taugt, ist eine andere Frage — in Phase 6 "
               "wird sie deshalb gar nicht erst angeboten.")

    s = folie(prs, "Phase 4 · Modeling",
              "Vier Modelle, gewählt wird auf der Validierung",
              "Nicht auf dem Test. Der Unterschied trennt eine Modellwahl von einer "
              "nachträglichen Begründung.")
    tabelle(s, ["Modell", "MAE auf der Validierung", "Was es beisteuert"], [
        ["Nullmodell (Median)", "8,10 Minuten", "der Median, ohne jedes Merkmal"],
        ["Lineare Regression", "4,61 Minuten", "schon besser als Baseline D"],
        ["Entscheidungsbaum (Tiefe 10)", "4,23 Minuten", "nichtlineare Zusammenhänge"],
        ["Random Forest (200 Bäume) — gewählt", "3,96 Minuten", "21 % besser als Baseline D"],
    ], y=(y := unter_intro(s)), spalten_b=[350, 230, 323.5], zeilen_h=40)
    sandband(s, "21 Prozent gegenüber einer Nachschlagetabelle aus Medianen: ein "
                "realer Gewinn, aber kein spektakulärer. Ob er den Betrieb eines "
                "Modells rechtfertigt, entscheidet Phase 6.",
             y=darunter(y, h_tabelle(4, 40)))
    phasenleiste(s, 4)
    notizen(s, "Der Vergleich in der dritten Spalte ist der ehrliche: nicht gegen "
               "das Nullmodell, sondern gegen die beste Baseline. Gegen das "
               "Nullmodell wären es 51 Prozent — eine Zahl, die gut klingt und "
               "nichts bedeutet, weil niemand das Nullmodell ausliefern würde.")

    s = folie(prs, "Phase 4 · Modeling",
              "Bringt das Ziel wirklich etwas? Eine Ablation",
              "Das ganze Projekt ruht auf der Annahme, dass die Zielwahl hilft. Also "
              "wird sie geprüft — indem man sie wegnimmt.")
    vorher_nachher(s,
                   ("Ohne Zielmerkmale", "Nur Start, Zeit, Radtyp", [
                       "MAE  4,35 Minuten",
                       "",
                       "Das Modell weiß nicht, wohin",
                       "die Fahrt geht — und ist",
                       "trotzdem deutlich besser als",
                       "jede Baseline.",
                   ], False),
                   ("Mit Zielmerkmalen", "Ziel und Luftlinie dazu", [
                       "MAE  3,96 Minuten",
                       "",
                       "Beitrag des Ziels:",
                       "0,39 Minuten — neun Prozent.",
                       "",
                       "Real, aber bescheiden.",
                   ], False),
                   y=unter_intro(s), hoehe=196)
    sandband(s, "Das gehört in den Bericht, nicht in eine Fußnote: Die neue "
                "Geschäftslogik ist richtig, ihr messbarer Zusatznutzen in diesem "
                "Datensatz ist klein.", y=unter_intro(s) + 206)
    phasenleiste(s, 4)
    notizen(s, "Eine Ablation ist die billigste Selbstkontrolle, die es gibt: einmal "
               "ohne das Merkmal rechnen, an dem das Projekt hängt. Wer sie "
               "weglässt, kann nicht ausschließen, dass sein Umbau nichts bringt. "
               "Hier bringt er etwas — nur weniger, als die Erzählung nahelegt.")

    # ─────────────────────────────────────────────── Phase 5
    s = folie(prs, "Phase 5 · Evaluation",
              "Von Minuten zu Euro — mit der vollen Tariflogik",
              "3,93 Minuten auf Test 1. Diese Zahl beantwortet die Frage aus Phase 1 "
              "nicht. Erst die Umrechnung in Euro tut das.")
    tabelle(s, ["Radtyp", "Fahrten", "Fahrt kostet", "Abweichung",
                "unter 0,50 €", "Kriterium"], [
        ["CITY", "3.325", "1,67 €", "0,41 €", "74 %", "erfüllt"],
        ["EBIKE", "2.049", "4,34 €", "0,85 €", "51 %", "gerissen"],
        ["CARGO", "508", "11,97 €", "2,48 €", "19 %", "gerissen"],
    ], y=(y := unter_intro(s)), spalten_b=[110, 110, 160, 160, 160, 203.5], zeilen_h=46)
    sandkarte(s, "Gerechnet wird der volle Tarif, nicht Minuten mal Minutenpreis",
              ["Startgebühr plus Minuten mal Minutenpreis, gedeckelt auf den "
               "Tageshöchstpreis — für den tatsächlichen und den geschätzten Wert "
               "getrennt.",
               "Nur so entspricht die Zahl dem, was auf der Rechnung des Kunden "
               "steht."],
              y=darunter(y, h_tabelle(3, 46)))
    phasenleiste(s, 5)
    notizen(s, "Die Spalte ganz rechts ist die eigentliche Nachricht dieser Folie: "
               "Bei CITY liegt die Anzeige in 74 Prozent der Fälle innerhalb der "
               "Toleranz — also bei rund jeder vierten Fahrt außerhalb. Der "
               "Mittelwert von 0,41 Euro sagt darüber nichts. Merken Sie sich diese "
               "26 Prozent; sie sind gleich der Grund für den Rücksprung.")

    zellfolie(prs, 1, "5.2", "Phase 5 · im Notebook",
              "Die entscheidende Rechnung, Zeile für Zeile",
              "nb1-preisfehler",
              "Drei Zeilen, drei Urteile — und die Statistik ist bei allen dreien "
              "dieselbe. Was sich unterscheidet, ist der Minutenpreis.",
              "Diese Tabelle ist der Kern von Phase 5. Das Modell ist für alle drei "
              "Radtypen gleich gut; das fachliche Urteil fällt trotzdem "
              "verschieden aus. Wer nur MAE und R² berichtet, sieht das nie.")

    s = folie(prs, "Phase 5 · Evaluation",
              "Zwei Gegenproben — und beide fallen negativ aus",
              "Bevor man ein Ergebnis erklärt, prüft man die zwei naheliegenden "
              "Erklärungen. Hier trägt keine von beiden.")
    vorher_nachher(s,
                   ("Vermutung 1", "Schätzen wir systematisch zu hoch?", [
                       "CARGO   − 0,25 €",
                       "CITY    + 0,04 €",
                       "EBIKE   + 0,11 €",
                       "",
                       "Nein. Über- und Unterschätzung",
                       "heben sich weitgehend auf.",
                   ], False),
                   ("Vermutung 2", "Ist das Modell bei teuren Rädern schlechter?", [
                       "CARGO   2,48 € von 11,97 €  = 21 %",
                       "CITY    0,41 € von  1,67 €  = 24 %",
                       "EBIKE   0,85 € von  4,34 €  = 20 %",
                       "",
                       "Nein. Relativ zum Fahrpreis ist",
                       "die Abweichung überall ähnlich.",
                   ], False),
                   y=unter_intro(s), hoehe=196)
    sandband(s, "Was sich unterscheidet, ist nicht das Modell, sondern die Strenge "
                "einer festen 50-Cent-Grenze bei drei sehr verschiedenen Fahrpreisen.",
             y=unter_intro(s) + 206)
    phasenleiste(s, 5)
    notizen(s, "Diese Folie schützt vor einer bequemen Fehldiagnose. Man könnte aus "
               "der vorigen Tabelle schließen, das Modell tauge für teure Räder "
               "nicht — und dann Monate mit besseren Verfahren verbringen. Es liegt "
               "aber nicht am Modell, sondern daran, dass 50 Cent von 1,67 Euro "
               "etwas anderes sind als 50 Cent von 11,97 Euro.")

    s = folie(prs, "Phase 5 · Evaluation",
              "Wie belastbar ist das? Vier Fenster statt einer Zahl",
              "Ein einzelner Testzeitraum kann günstig liegen. Rollierend geprüft "
              "sieht man, wie stark das Ergebnis schwankt.")
    tabelle(s, ["Fenster", "Fahrten", "MAE (Minuten)", "CITY-Preisfehler"], [
        ["10/2024 bis 02/2025", "3.529", "3,52", "0,37 €"],
        ["02/2025 bis 05/2025", "3.529", "3,73", "0,38 €"],
        ["05/2025 bis 07/2025", "3.529", "4,39", "0,45 €"],
        ["07/2025 bis 09/2025", "3.529", "4,33", "0,45 €"],
    ], y=(y := unter_intro(s)), spalten_b=[300, 130, 200, 273.5], zeilen_h=40)
    sandband(s, "Der CITY-Preisfehler schwankt zwischen 0,37 € und 0,45 €. Die Grenze "
                "von 0,50 € liegt oberhalb der gesamten Schwankung — im schlechtesten "
                "Fenster mit fünf Cent Abstand. Für CITY ist die Punktschätzung damit "
                "belastbar.", y=darunter(y, h_tabelle(4, 40)))
    phasenleiste(s, 5)
    notizen(s, "Die beiden schlechteren Fenster sind Sommer. Das Modell wird im "
               "Sommer schlechter, weil dann mehr aus Vergnügen gefahren wird. Diese "
               "Beobachtung erklärt später, warum die Tabelle quartalsweise neu "
               "gerechnet werden muss — und sie ist ein Beispiel dafür, dass eine "
               "einzelne Testzahl eine Jahreszeit sein kann.")

    s = folie(prs, "Phase 5 · Evaluation", "Woran es liegt — und woran nicht",
              "Nicht wie gut, sondern woran es scheitert. Das Muster ist kein "
              "statistisches, sondern ein menschliches.")
    vorher_nachher(s,
                   ("Schwierig", "Gefahren, um zu fahren", [
                       "Dom → Residenz",
                       "  32 Min · Abweichung 0,77 €",
                       "Residenz → Juliuspromenade",
                       "  28 Min · Abweichung 0,78 €",
                       "",
                       "Je nach Anlass zwanzig oder",
                       "vierzig Minuten unterwegs.",
                   ], False),
                   ("Treffsicher", "Gefahren, um anzukommen", [
                       "Grombühl Klinikum → Sanderau",
                       "  7 Min · Abweichung 0,09 €",
                       "Sanderau → Uni Sanderring",
                       "  7 Min · Abweichung 0,11 €",
                       "",
                       "Pendelwege, jeden Tag",
                       "ungefähr gleich.",
                   ], False),
                   y=unter_intro(s), hoehe=196)
    sandband(s, "Das Modell ist genau, wo gefahren wird, um anzukommen — und ungenau, "
                "wo gefahren wird, um zu fahren.", y=unter_intro(s) + 206)
    phasenleiste(s, 5)
    notizen(s, "Ein zweiter Befund derselben Zelle: Rundtouren haben 6,05 Minuten MAE "
               "gegen 3,49 bei echten Wegen. Beides sagt dasselbe — was eine Fahrt "
               "lang macht, ist der Zweck, und der steht in keiner Spalte. Ob "
               "überhaupt kein Merkmal das könnte, wissen wir nicht: Nutzerabsicht, "
               "Höhenprofil und Stationsauslastung sind ungeprüfte Kandidaten.")

    s = folie(prs, "Phase 5 · Evaluation",
              "Der Rücksprung — obwohl das Kriterium hält",
              "Für CITY könnten wir jetzt ausliefern. Wir tun es nicht, und zwar aus "
              "zwei Gründen, die nichts mit einem gerissenen Kriterium zu tun haben.")
    kachelreihe(s, [
        ("Ein Mittelwert ist\nkeine Erfahrung", [
            "0,41 € im Mittel klingt gut.",
            "",
            "Bei rund jeder vierten",
            "CITY-Fahrt liegt die Anzeige",
            "aber um mehr als 50 Cent",
            "daneben. Ein Kunde erlebt",
            "keinen Mittelwert.",
        ]),
        ("Zwei von drei Radtypen\nhaben kein Produkt", [
            "EBIKE und CARGO reißen die",
            "Grenze deutlich.",
            "",
            "Eine Lösung nur für das",
            "billigste Rad beantwortet",
            "die Geschäftsfrage nicht.",
        ]),
        ("Also: die Zusage ändern", [
            "Nicht die Grenze lockern —",
            "verboten und hier unnötig.",
            "",
            "Nicht das Verfahren tauschen —",
            "die Ablation zeigt, dass die",
            "Information fehlt, nicht die",
            "Rechenkraft.",
        ]),
    ], y=unter_intro(s), hoehe=196)
    phasenleiste(s, 5, rueckspruenge=(1,))
    notizen(s, "Das ist der ungewöhnlichste Moment des Falls. Der Rücksprung kommt "
               "nicht aus einem Fehlschlag, sondern aus zwei Beobachtungen, die das "
               "Erfolgskriterium selbst nicht abbildet. Genau deshalb reicht es "
               "nicht, Kriterien abzuhaken — man muss sie auch daraufhin ansehen, "
               "was sie NICHT messen.")

    s = folie(prs, "Phase 5 · Evaluation",
              "Das neue Kriterium — wieder vor der Messung festgelegt",
              "Statt einer Zahl eine Spanne. Damit ändert sich nicht die "
              "Verfahrensklasse, sondern das, was die App verspricht.")
    tabelle(s, ["", "Neues Erfolgskriterium"], [
        ["trifft", "Die angezeigte Spanne enthält den tatsächlichen Preis in "
                   "mindestens 80 % der Fälle — insgesamt UND je Radtyp"],
        ["nützt", "Die Spanne ist höchstens 1,00 € breit. Ist sie breiter, zeigt die "
                  "App gar nichts an"],
        ["gemessen auf", "Test 2 — dem Zeitraum, den bis hierher nichts berührt hat"],
    ], y=(y := unter_intro(s)), spalten_b=[180, 723.5], zeilen_h=54)
    sandband(s, "Die zweite Zeile ist die wichtigere. Eine Spanne von 4 bis 12 Euro "
                "trifft fast immer — und nützt niemandem. Ohne die Breitenregel wäre "
                "das Kriterium wertlos.", y=darunter(y, h_tabelle(3, 54)))
    phasenleiste(s, 5, rueckspruenge=(1,))
    notizen(s, "Beide Zeilen zusammen sind ein gutes Beispiel dafür, wie ein "
               "Kriterium aussehen muss: Eine Bedingung allein lässt sich immer "
               "erfüllen, indem man die andere verletzt. Erst das Paar beschreibt "
               "ein Produkt.")

    s = folie(prs, "Phase 5 · Evaluation",
              "Zwei Kandidaten für dieselbe Zusage",
              "Eine Spanne kann man rechnen lassen oder nachschlagen. Beide Wege "
              "werden gebaut und gegen dasselbe Kriterium gehalten.")
    tabelle(s, ["", "Quantilregression", "Perzentiltabelle"], [
        ["antwortet bei", "45,4 % der Anfragen", "31,0 %"],
        ["Abdeckung (angezeigt)", "87,5 %", "83,2 %"],
        ["schlechtester Radtyp", "86,5 %", "74,6 % — EBIKE"],
        ["verworfen, weil zu breit", "54,6 %", "0 % (per Konstruktion)"],
        ["Kriterium insgesamt", "erfüllt", "verfehlt"],
    ], y=(y := unter_intro(s)), spalten_b=[280, 320, 303.5], zeilen_h=32)
    sandband(s, "Gemessen am eigenen Kriterium ist die Quantilregression der bessere "
                "Kandidat. Das gehört so gesagt — auch wenn die Entscheidung gleich "
                "anders ausfällt.", y=darunter(y, h_tabelle(5, 32)))
    phasenleiste(s, 5)
    notizen(s, "Die Zeile „verworfen, weil zu breit“ ist die interessanteste: Über "
               "die Hälfte der Spannen des Modells wäre für den Kunden wertlos. Was "
               "das Modell gut macht, ist gerade das Weglassen — es antwortet nur "
               "dort, wo es eine schmale Spanne bilden kann.")

    zellfolie(prs, 1, "5.6", "Phase 5 · im Notebook",
              "Der Kandidatenvergleich, wie er im Notebook steht",
              "nb1-kandidaten",
              "Hätte man nur die Dauerabdeckung gemessen, sähen beide gut aus. Erst "
              "die vollständige Prüfung — Preis, je Radtyp, Breite — trennt sie.",
              "Weisen Sie darauf hin, dass die Bewertung nur zählt, was die App "
              "tatsächlich ANZEIGEN würde. Eine Spanne über einem Euro wird nicht "
              "angezeigt, also darf sie auch nicht in die Abdeckung eingehen. Über "
              "den Median gerechnet hätte ein Kandidat mit wenigen sehr breiten "
              "Spannen deutlich besser ausgesehen, als er ist.")

    s = folie(prs, "Phase 5 · Evaluation",
              "Warum trotzdem die Tabelle ausgeliefert wird",
              "Nicht wegen der Güte — die spricht für das Modell. Sondern weil die "
              "App eine statische Seite ohne Python ist.")
    vorher_nachher(s,
                   ("Quantilregression", "Was für sie spricht", [
                       "trifft häufiger und antwortet öfter",
                       "kann eine neue Verbindung",
                       "  einschätzen",
                       "berücksichtigt Wochentag",
                       "  und Saison",
                       "",
                       "Braucht aber Python im Betrieb.",
                   ], False),
                   ("Perzentiltabelle", "Was für sie spricht", [
                       "läuft ohne Python — 136 Zeilen",
                       "  in der Datenbank",
                       "ist von Hand nachprüfbar",
                       "wer Ortskenntnis hat, kann",
                       "  widersprechen",
                       "",
                       "Antwortet dafür seltener.",
                   ], False),
                   y=unter_intro(s), hoehe=200)
    sandband(s, "Wir liefern den schwächeren Kandidaten aus, weil der stärkere nicht "
                "dorthin passt, wo er laufen müsste. Der dritte Weg — die "
                "Modellvorhersagen vorab tabellieren — steht als offene Entscheidung "
                "im Notebook.", y=unter_intro(s) + 210)
    phasenleiste(s, 5)
    notizen(s, "Der dritte Weg wäre, die Vorhersagen des Modells für jede Kombination "
               "vorab auszurechnen und zu tabellieren: bessere Treffsicherheit, "
               "gleiche Betriebsform. Der Preis wäre, dass die Zeilen nicht mehr für "
               "sich sprechen — eine Modellvorhersage kann man nicht nachrechnen, "
               "indem man in die Historie sieht. Diese Abwägung gehört dem "
               "Auftraggeber, nicht der Analyse.")

    # ─────────────────────────────────────────────── Phase 6
    s = folie(prs, "Phase 6 · Deployment",
              "Vom Datensatz zum Artefakt — durch Streichen",
              "Drei Filter stehen zwischen 60.425 Rohzeilen und 136 Tabellenzeilen. "
              "Jeder von ihnen erzeugt Schweigen, wo keine Auskunft trägt.",
              quelle=nbq(1, "6.1 bis 6.3"))
    diagramm(s, bild("nb1-artefakt"), y=unter_intro(s) + 20,
             hoehe=ZONE_UNTEN - unter_intro(s) - 60)
    notizen(s, "Gehen Sie den Weg einmal von rechts nach links: Jede Zeile, die es "
               "in das grüne Feld geschafft hat, hat drei Prüfungen bestanden. Und "
               "jede Zeile, die im roten Feld gelandet ist, führt in der App nicht zu "
               "einer schlechteren Anzeige, sondern zu gar keiner. Das ist der "
               "Unterschied zwischen einem Produkt mit Geltungsbereich und einem, das "
               "auf jede Frage irgendetwas antwortet.")

    s = folie(prs, "Phase 6 · Deployment", "Die Freigabe steckt in der Tabelle",
              "Nicht in einer Aktennotiz und nicht in einer Bedingung im "
              "Anwendungscode: Was nicht trägt, hat keine Zeile.")
    ampel_matrix(s, ["80 %"], [
        ("CITY — 84,0 % auf Test 2", [True],
         "1.408 Prüffahrten. Freigegeben"),
        ("EBIKE — 74,6 % auf Test 2", [False],
         "nur 134 Prüffahrten. Keine Zeile in der Tabelle"),
        ("CARGO — keine Kombination erreicht 30 Fahrten", [False],
         "scheitert schon an der Datengrundlage"),
    ], y=(y := unter_intro(s) + 26), zeilen_h=48, luecke=8, label_b=330)
    sandkarte(s, "Und eine Ebene tiefer, je Kombination",
              ["14 Kombinationen haben mindestens 20 Prüffahrten — 11 davon halten "
               "die 80 %, 3 nicht. Diese drei werden ausgeschlossen.",
               "140 Kombinationen haben weniger (im Median 7). Für sie lässt sich "
               "einzeln nichts Belastbares sagen — sie bleiben drin, aber die "
               "Zusage gilt nur insgesamt und je Radtyp."],
              y=darunter(y, h_gestapelt(3, 48, 8)))
    phasenleiste(s, 6)
    notizen(s, "Der zweite Punkt der Sandkarte ist eine ehrliche Einschränkung, die "
               "man leicht übergeht: Die 80 Prozent sind insgesamt und je Radtyp "
               "geprüft, nicht je Verbindung. Ausgeschlossen wird nur, was messbar "
               "durchfällt — nicht alles, was ungeprüft ist. Das steht so auch in "
               "der Liste der offenen Punkte am Ende des Notebooks.")

    zellfolie(prs, 1, "6.3", "Phase 6 · im Notebook",
              "Das ausgelieferte Artefakt, Zeile für Zeile",
              "nb1-tabelle",
              "136 Zeilen, 60 Verbindungen, nur CITY. Zwei Stationen, ein Radtyp, "
              "ein Zeitfenster — und zwei Zahlen in Minuten und in Euro.",
              "Achten Sie auf die letzte Spalte: fahrten_grundlage. Jede Zeile sagt, "
              "auf wie vielen vergleichbaren Fahrten sie beruht. Damit kann jeder im "
              "Betrieb nachsehen, wie belastbar eine einzelne Auskunft ist — bei 192 "
              "Fahrten anders als bei 42. Genau das kann eine Modellvorhersage nicht.")

    s = folie(prs, "Phase 6 · Deployment", "Die ehrliche Produktreichweite",
              "Was die App am Ende wirklich beantworten kann. Diese Zahl steht im "
              "Notebook, weil sie sonst niemand ausrechnet.")
    schichtenstapel(s, [
        ("5.882 Fahrten im Prüfzeitraum — abgeschlossen und mit Ziel", False),
        ("4.969 davon echte Wege, keine Rundtouren  ·  84 %", False),
        ("1.326 davon mit einer freigegebenen Spanne  ·  23 % aller Fahrten", True),
    ], y=(y := unter_intro(s) + 10), hoehe=52, luecke=14)
    sandband(s, "Die App kann für gut jede fünfte Fahrt einen Preis nennen. Für den "
                "Rest sagt sie, dass sie es nicht kann — und das ist besser als eine "
                "Zahl, die nicht trägt.", y=darunter(y, h_gestapelt(3, 52, 14)))
    phasenleiste(s, 6)
    notizen(s, "22,5 Prozent klingen nach einem mageren Ergebnis, und in einer "
               "Projektpräsentation würde diese Zahl gern fehlen. Sie ist aber die "
               "einzige, die beschreibt, was der Kunde erlebt. Fragen Sie die "
               "Studierenden, welche Zahl sie stattdessen berichtet hätten — die "
               "meisten nennen die 84,5 Prozent Abdeckung, und die gilt nur für die "
               "Fahrten, bei denen überhaupt etwas angezeigt wird.")

    s = folie(prs, "Phase 6 · Deployment",
              "Die Funktion, die die App aufruft — und wann sie schweigt",
              "Vier Eingaben, eine Antwort. In drei von vier Fällen lautet die "
              "Antwort: keine Anzeige.")
    code_kacheln(s,
                 ("Der Aufruf", [
                     "preis_schaetzen(",
                     "  start_id=9,",
                     "  ziel_id=6,",
                     "  typ_code='CITY',",
                     "  stunde=17,",
                     ")",
                 ], BLAU),
                 ("Die vier möglichen Antworten", [
                     "0,60 bis 1,30 € · 5 bis 12 Min",
                     "  Grundlage: 78 Fahrten",
                     "— Für Rundfahrten schätzen wir",
                     "  keinen Preis.",
                     "— Für diese Verbindung liegt",
                     "  keine belastbare Schätzung vor.",
                 ], GRUEN_D),
                 y=unter_intro(s), hoehe=186)
    sandband(s, "Die Begründung wird mitgeliefert, nicht nur das Schweigen. Eine App, "
                "die ohne Erklärung nichts anzeigt, wirkt kaputt — eine, die den "
                "Grund nennt, wirkt sorgfältig.", y=unter_intro(s) + 196)
    phasenleiste(s, 6)
    notizen(s, "Die dritte Antwort deckt zwei sehr verschiedene Fälle ab: eine "
               "bekannte Verbindung ohne genügend Fahrten und eine Station, die es "
               "gar nicht gibt. Beide führen zur selben Auskunft, und das ist "
               "richtig so — der Kunde soll nicht erfahren, wie die Tabelle gebaut "
               "ist, sondern nur, ob er eine Zahl bekommt.")

    zellfolie(prs, 1, "6.4", "Phase 6 · im Notebook",
              "Vier Anfragen, drei Absagen",
              "nb1-app",
              "So sieht die Schnittstelle zur Webanwendung aus: eine Zeile mit Preis, "
              "Minuten und Fallzahl — oder eine Absage mit Grund.",
              "Diese Zelle ist die Brücke zwischen Notebook und Produkt. Die Tabelle "
              "wird nach velocity.preisschaetzung geladen, die Website liest sie über "
              "eine Sicht und zeigt beim Radtyp einen kleinen Preisschätzer an — "
              "ein- und ausschaltbar über eine Option im Kundenkonto. Damit ist "
              "Phase 6 hier keine Übung, sondern eine ausgelieferte Funktion.")

    s = folie(prs, "Phase 6 · Deployment",
              "Überwachung: drei Fälle, die einander ausschließen",
              "Eine Schwelle allein genügt nicht. Bei 78 Prozent gemessener "
              "Abdeckung muss klar sein, welche Regel gilt — sonst greifen zwei "
              "gleichzeitig.")
    tabelle(s, ["Auslöser", "Schwelle", "Handlung"], [
        ["Abdeckung je Kombination,\ngleitend über 8 Wochen",
         "untere Vertrauensgrenze ≥ 80 %", "anzeigen"],
        ["", "Intervall überlappt 80 %", "anzeigen, aber Warnung und Neuberechnung"],
        ["", "obere Vertrauensgrenze < 80 %", "Kombination abschalten"],
        ["Fallzahl je Kombination", "unter 20 im Fenster",
         "keine Aussage möglich, Vorwoche weiterverwenden"],
        ["Tarif ändert sich", "Minutenpreis neu",
         "gesamte Tabelle neu rechnen — sie enthält Euro"],
    ], y=unter_intro(s), spalten_b=[230, 260, 413.5], zeilen_h=44)
    phasenleiste(s, 6)
    notizen(s, "Maßgeblich ist das Wilson-Intervall zum Niveau 95 Prozent, nicht der "
               "Schätzwert. Damit entscheidet nicht eine gesetzte Ersatzschwelle, "
               "sondern die Frage, ob die Daten überhaupt für eine Aussage reichen. "
               "Wer schneller abschalten will, braucht mehr Fahrten je Fenster — "
               "keine andere Zahl. Die letzte Zeile ist die feinste: Die Tabelle "
               "enthält Euro, nicht nur Minuten. Eine Tarifänderung macht sie in "
               "einer Nacht falsch.")

    s = folie(prs, "Phase 6 · Deployment",
              "Was ein echter Schattenbetrieb wäre — und warum wir ihn nicht haben",
              "Was dieses Notebook Test 2 nennt, ist ein rückblickender Test auf "
              "vergangenen Daten. Ein Schattenbetrieb ist etwas anderes.")
    streifen(s, [
        ("1 bis 3", "Tabelle einfrieren · in der App das GEPLANTE Ziel speichern · "
                    "Schätzung berechnen, aber nicht anzeigen"),
        ("4 und 5", "Nach der Fahrt tatsächliches Ziel und Dauer ergänzen · geplantes "
                    "gegen tatsächliches Ziel vergleichen"),
        ("6 und 7", "Abdeckung, Breite, Reichweite und Ablehnungsgründe auswerten · "
                    "erst danach sichtbar schalten"),
    ], y=(y := unter_intro(s)), hoehe=62, luecke=10, chip_b=140)
    sandkarte(s, "Schritt 2 und 5 sind der Kern", [
        "Sie prüfen die Annahme vom Anfang: Ist das geplante Ziel ein brauchbarer "
        "Stellvertreter für das tatsächliche?",
        "Ohne sie bleibt die Grundannahme dieses Notebooks ungeprüft — und alle "
        "Zahlen bleiben Obergrenzen.",
    ], y=darunter(y, h_gestapelt(3, 62, 10)))
    phasenleiste(s, 6)
    notizen(s, "Hier schließt sich der Kreis zur dritten Folie dieses Kapitels. Die "
               "Annahme wurde am Anfang benannt, hat das ganze Notebook getragen — "
               "und am Ende steht, wie man sie prüfen würde und dass es noch nicht "
               "geschehen ist. Das ist der Unterschied zwischen einer offenen Frage "
               "und einer verschwiegenen.")

    # ─────────────────────────────────────────────── Kreisschluss
    s = folie(prs, "Fall 1 · Abschluss", "Der Kreislauf schließt sich",
              "Sechs Phasen, ein Rücksprung von Phase 5 zurück in Phase 1 — und ein "
              "Produkt, das öfter schweigt als spricht.")
    tabelle(s, ["Phase", "Was dabei herauskam"], [
        ["1 Business Understanding", "Der Prozess wurde geändert, nicht das "
                                     "Verfahren. Kriterium: unter 50 Cent"],
        ["2 Data Understanding", "Ein Fünftel endet frei im Gebiet, ein weiteres "
                                 "Fünftel sind Rundtouren"],
        ["3 Data Preparation", "Zielstation erlaubt — als Stellvertreter. Wetter "
                               "gesperrt. Vier Zeitabschnitte"],
        ["4 Modeling", "Vier Baselines, dann Modelle. Eine Ablation zeigt: das Ziel "
                       "bringt 9 %"],
        ["5 Evaluation", "CITY hält die Grenze. Trotzdem Rücksprung — der Mittelwert "
                         "bildet die einzelne Fahrt nicht ab"],
        ["6 Deployment", "Ausgeliefert wird die Tabelle, nicht das Modell. 136 "
                         "Zeilen, nur CITY, 22,5 % Reichweite"],
    ], y=unter_intro(s), spalten_b=[230, 673.5], zeilen_h=40)
    notizen(s, "Diese Tabelle steht wörtlich am Ende von Notebook 1. Die Studierenden "
               "finden sie dort wieder — Folie und Notebook sollen dieselbe Sprache "
               "sprechen, damit die Nacharbeit nicht bei null anfängt.")

    s = folie(prs, "Fall 1 · Abschluss", "Was offen bleibt — ausdrücklich",
              "Ein Projektbericht ohne diese Liste ist unvollständig. Sie steht am "
              "Ende des Notebooks, nicht im Kleingedruckten.")
    tabelle(s, ["Offener Punkt", "Was daraus folgt"], [
        ["Das geplante Ziel wird nicht erfasst", "Alle Zahlen sind Obergrenzen"],
        ["Kein echter Schattenbetrieb", "Test 2 hat kalibriert und freigegeben — die "
                                        "unabhängige Endprüfung steht aus"],
        ["Keine Zusage je Verbindung", "Die 80 % gelten insgesamt und je Radtyp"],
        ["Kein Wetter", "Ohne archivierte Prognosen fehlt ein vermutlich starkes "
                        "Merkmal"],
        ["Kein Produkt für EBIKE und CARGO", "Weder als Zahl noch als Spanne"],
        ["Der bessere Kandidat wird nicht ausgeliefert",
         "Die Modellvorhersagen zu tabellieren wäre der nächste Schritt"],
    ], y=unter_intro(s), spalten_b=[350, 553.5], zeilen_h=42)
    notizen(s, "Gehen Sie diese Liste langsam durch. Sie ist der beste Teil des "
               "Notebooks: Jeder Punkt ist eine Einschränkung, die niemand bemerkt "
               "hätte. Ein Bericht, der so etwas aufschreibt, ist mehr wert als "
               "einer mit besseren Zahlen — weil man auf ihm aufbauen kann.")

# ═════════════════════════════════════════════ Teil C — Faelle 2 bis 6
#
# Gleiches Geruest in allen fuenf Kapiteln:
#   1 Kapitelfolie mit Leitfrage
#   2 Steckbrief
#   3 Was hier anders ist als in Fall 1
#   4 Phasen 1 bis 3 im Schnelldurchlauf
#   5-7 die Fokusphase, in der Tiefe
#   8 Deployment
#   9 Der Kreislauf schliesst sich
#
# Nur eine grosse Form je Folie plus Phasenleiste - so bleibt die
# Inhaltszone ohne Abstandsrechnerei eingehalten.

def fall2(prs):
    AKTUELLES_NB[0] = 2
    kapitel(prs, 3, "Fall 2 — Klassifikation: was ein Modell wert sein muss",
            "Welche Räder müssen als Nächstes in die Werkstatt — und lohnt sich "
            "dafür der Betrieb eines Modells?",
            "Dieser Fall zeigt Phase 6 von innen und endet mit einem Ergebnis, das "
            "in Lehrbüchern selten vorkommt: Das Modell wird gebaut, geprüft — und "
            "nicht ausgeliefert, weil eine einzeilige Faustregel genauso gut ist. "
            "Zwei Dinge machen den Fall lehrreich: Der Maßstab entsteht VOR dem "
            "Modell, und er wird über mehrere Quartale geprüft statt über eines.")

    s = folie(prs, "Fall 2", "Der Fall auf einen Blick")
    steckbrief(s, [
        ("Geschäftsfrage", "Welche 60 Räder soll die Werkstatt im nächsten Quartal prüfen?"),
        ("Analytisches Ziel", "Je Rad die Wahrscheinlichkeit einer Schadensmeldung "
                              "in den nächsten 90 Tagen"),
        ("Erfolgskriterium", "Zwei Hürden — und eine davon ist der Vergleich mit der "
                             "heutigen Faustregel"),
        ("Fehlerkosten", "180 € je verpasstem Ausfall gegen 25 € je unnötiger Prüfung "
                         "— rund 7 : 1"),
        ("Verfahren", "Zwei Faustregeln als Maßstab, dann Entscheidungsbaum und "
                      "Random Forest"),
        ("Urteil", "Gleichstand auf dem Test, über fünf Quartale liegt die Regel "
                   "vorn — ausgeliefert wird die Regel"),
    ], y=unter_intro(s))
    notizen(s, "Die Kostenmatrix in Zeile 4 ist der Unterschied zu Fall 1. Dort waren "
               "beide Fehlerrichtungen gleich ärgerlich; hier kostet die eine das "
               "Siebenfache der anderen. Das gehört ins Modell, nicht in die "
               "Nachbetrachtung.")

    zellfolie(prs, 2, "1 — Fehlerkosten", "Phase 1 · im Notebook",
              "Die Kostenmatrix, aus der alles Weitere folgt",
              "nb2-kosten",
              "180 € gegen 25 €. Diese beiden Zahlen bestimmen das Erfolgskriterium, "
              "die Klassengewichte und am Ende die Auslieferung.",
              "Fragen Sie, woher solche Zahlen kommen. Antwort: aus dem Betrieb, nicht "
              "aus den Daten. Ein Datenprojekt, das sie nicht erfragt, erfindet sie "
              "implizit — meist als 1 : 1, und das ist fast immer falsch.")

    s = folie(prs, "Fall 2", "Was hier anders ist als in Fall 1",
              "Drei Unterschiede — und jeder verändert eine Phase.")
    tabelle(s, ["", "Fall 1 — Regression", "Fall 2 — Klassifikation"], [
        ["Zielgröße", "eine Zahl: Minuten", "ja oder nein: meldet sich das Rad?"],
        ["Fehlerkosten", "beide Richtungen gleich", "180 € gegen 25 € — rund 7 : 1"],
        ["Aufteilung", "zufällig zulässig", "zeitlich zwingend: Merkmale aus 180 Tagen "
                                            "davor, Label aus 90 Tagen danach"],
        ["Maßstab", "Nullmodell", "Nullmodell UND die heutige Faustregel der Werkstatt"],
    ], y=unter_intro(s), spalten_b=[150, 280, 473.5], zeilen_h=48)
    notizen(s, "Die letzte Zeile ist die wichtigste. Ein Nullmodell zu schlagen ist "
               "leicht. Den Menschen zu schlagen, der die Arbeit heute macht, ist die "
               "eigentliche Messlatte — und die fehlt in fast allen Lehrbeispielen.")

    s = folie(prs, "Fall 2 · Phasen 1 bis 3", "Der Schnelldurchlauf",
              "Die ersten drei Phasen laufen wie in Fall 1. Was sie hier "
              "hervorbringen, steht in drei Zeilen.")
    streifen(s, [
        ("Phase 1", "Aus „vorausschauend warten“ wird eine Kostenmatrix: 180 € gegen "
                    "25 €, und zwei Erfolgskriterien"),
        ("Phase 2", "Nutzung und Meldungen hängen zusammen (r ≈ 0,7), aber nicht "
                    "deterministisch. 44 % der Räder melden sich je Quartal, die "
                    "Werkstatt schafft 26 %"),
        ("Phase 3", "Zeitlicher Schnitt: acht Stichtage, Merkmale aus 180 Tagen davor, "
                    "Label aus 90 Tagen danach, Testmenge ist der jüngste Stichtag"),
    ], y=unter_intro(s), hoehe=76, luecke=10, chip_b=0)
    notizen(s, "Der Satz „44 Prozent melden sich, die Werkstatt schafft 26“ ist der "
               "Grund, warum es überhaupt eine Rangfolge braucht. Es geht nicht darum, "
               "alle Defekte zu finden, sondern die richtigen 60 Räder auszuwählen.")

    zellfolie(prs, 2, "3.3", "Phase 3 · im Notebook",
              "Der zeitliche Schnitt, in Zahlen",
              "nb2-schnitt",
              "Sieben Stichtage zum Trainieren, der jüngste zum Testen — und ein "
              "Anteil positiver Fälle, der sich dabei verdoppelt.",
              "Die Zeilenzahlen stehen mit Absicht in der Ausgabe. Wer sie nicht "
              "ausgibt, merkt nicht, wenn ein Stichtag leer bleibt oder ein Filter "
              "mehr wegnimmt als gedacht.")

    s = folie(prs, "Fall 2 · Phase 4", "Zuerst die Faustregeln — dann erst die Modelle",
              "Zwei Regeln, wie sie die Werkstatt heute im Kopf hat. Sie sind der "
              "Maßstab, an dem sich jedes Modell messen lassen muss.")
    code_kacheln(s,
                 ("Regel A — Kilometerstand", [
                     "Die 60 Raeder mit den",
                     "meisten Kilometern seit",
                     "der letzten Wartung.",
                     "",
                     "Eine Zeile Code.",
                 ], ORANGE),
                 ("Regel B — Alter", [
                     "Die 60 aeltesten Raeder",
                     "der Flotte.",
                     "",
                     "Ebenfalls eine Zeile.",
                     "Deutlich schwaecher als A.",
                 ], TEXT_SEK),
                 y=unter_intro(s), hoehe=180)
    phasenleiste(s, 4)
    notizen(s, "Diese beiden Regeln kosten zusammen zwei Zeilen und zehn Minuten. "
               "Wer sie nicht rechnet, kann am Ende nicht sagen, ob das Modell etwas "
               "beigetragen hat — er kann nur sagen, dass es funktioniert.")

    s = folie(prs, "Fall 2 · Phase 5", "Gleichstand auf dem Testquartal",
              "Beide Erfolgskriterien standen vor der Messung fest: mindestens 70 % "
              "Trefferquote, und günstiger als die heutige Faustregel.")
    tabelle(s, ["Vorgehen", "Treffer", "Trefferquote", "Kosten je Quartal"], [
        ["gar nicht vorsorglich prüfen", "0", "0 %", "18.360 €"],
        ["Faustregel: ältestes Rad", "27", "45,0 %", "14.325 €"],
        ["Faustregel: meiste Kilometer", "31", "51,7 %", "13.505 €"],
        ["Faustregel: km seit letzter Reparatur", "43", "71,7 %", "11.045 €"],
        ["Random Forest", "43", "71,7 %", "11.045 €"],
    ], y=(y := unter_intro(s)), spalten_b=[380, 120, 180, 223.5], zeilen_h=36)
    sandband(s, "Treffer für Treffer identisch. Der Wald mit 300 Bäumen findet nichts, "
                "was über „Kilometer seit der Reparatur“ hinausgeht.",
             y=darunter(y, h_tabelle(5, 36)))
    phasenleiste(s, 5)
    notizen(s, "Lassen Sie die letzten beiden Zeilen wirken. Studierende erwarten "
               "hier, dass der Wald gewinnt — er ist ja das stärkere Verfahren. Dass "
               "er es nicht tut, heißt: Der Verschleiß hängt fast ausschließlich an "
               "den Kilometern seit der Reparatur. Mehr Information steckt in diesen "
               "Merkmalen nicht. Und beachten Sie die beiden schwächeren Regeln: 45 "
               "und 52 Prozent. Der Gewinn steckt nicht darin, eine bessere Kennzahl "
               "zu suchen, sondern die richtige Frage zu stellen.")

    s = folie(prs, "Fall 2 · Phase 5",
              "Ein Quartal ist keine Aussage — fünf schon eher",
              "Der Anteil auffälliger Räder schwankt zwischen 8 % im November und "
              "46 % im Mai. Wer auf einem Quartal entscheidet, entscheidet über die "
              "Jahreszeit mit.")
    tabelle(s, ["Stichtag", "Grundrate", "Random Forest", "Faustregel"], [
        ["03/2025", "22,7 %", "21", "25"],
        ["05/2025", "46,9 %", "42", "45"],
        ["08/2025", "26,5 %", "30", "30"],
        ["11/2025", "7,6 %", "11", "10"],
        ["02/2026", "20,7 %", "25", "27"],
        ["Summe", "", "129", "137"],
    ], y=(y := unter_intro(s)), spalten_b=[220, 200, 250, 233.5], zeilen_h=32)
    sandband(s, "Über fünf Quartale liegt die Faustregel vorn — der Wald kostet 328 € "
                "je Quartal mehr, noch vor jedem Betriebsaufwand.",
             y=darunter(y, h_tabelle(6, 32)))
    phasenleiste(s, 5)
    notizen(s, "Für jedes Quartal wird neu trainiert, mit allem, was zu diesem "
               "Zeitpunkt bekannt war. Das letzte Quartal bleibt unangetastet — es ist "
               "der Test, nicht die Entscheidungsgrundlage. Genau daran war eine "
               "frühere Fassung dieses Falls gescheitert: Sie hat auf dem einen "
               "günstigen Quartal entschieden.")

    s = folie(prs, "Fall 2 · Phase 5",
              "Wie sicher ist eine Trefferquote aus 60 Beobachtungen?",
              "43 von 60 sind 71,7 %. Die Zahl klingt genauer, als sie ist.")
    kachelreihe(s, [
        ("Das Wilson-Intervall", [
            "71,7 % aus 60 Beobachtungen",
            "bedeutet:",
            "",
            "59,2 % bis 81,5 %",
            "",
            "Verträglich mit 60 % ebenso",
            "wie mit 80 %.",
        ]),
        ("Was das heißt", [
            "Die 70-%-Hürde liegt mitten",
            "im Intervall.",
            "",
            "Sie ist damit nicht belegt,",
            "sondern nur nicht widerlegt.",
            "",
            "Ein Treffer weniger wäre",
            "exakt 70,0 % gewesen.",
        ]),
        ("Was hilft", [
            "Nicht ein größeres Modell,",
            "sondern mehr Perioden.",
            "",
            "Fünf Quartale trennen die",
            "Verfahren, ein Quartal",
            "nicht.",
        ]),
    ], y=unter_intro(s), hoehe=196)
    phasenleiste(s, 5)
    notizen(s, "Diese Folie gehört zu den wichtigsten des Decks. Studierende lesen "
               "71,7 Prozent als eine Tatsache. Sie ist eine Schätzung aus 60 "
               "Beobachtungen, und die Unsicherheit ist größer als jeder Unterschied, "
               "über den hier gestritten wird.")

    zellfolie(prs, 2, "5.4", "Phase 5 · im Notebook",
              "Drei Kriterien, und das dritte entscheidet",
              "nb2-kriterien",
              "Trefferquote und Kosten sind gleich. Das dritte Kriterium — der "
              "Vorteil über mehrere Quartale — reißt das Modell.",
              "Das dritte Kriterium ist erst nach dem Review dazugekommen, und es ist "
              "das wichtigste: Ein Verfahren muss über mehrere Perioden vorn liegen, "
              "nicht über eine. Ohne dieses Kriterium hätte das Notebook das Modell "
              "ausgeliefert — auf Grundlage eines einzigen günstigen Quartals.")

    s = folie(prs, "Fall 2 · Phase 6",
              "Ausgeliefert wird die Regel — und das Modell bleibt im Paket",
              "Bei Gleichstand gewinnt die einfachere Lösung. Das ist keine "
              "Bescheidenheit, sondern eine Rechnung über die Lebensdauer.")
    tabelle(s, ["", "Faustregel", "Random Forest"], [
        ["Trefferquote auf dem Test", "71,7 %", "71,7 %"],
        ["über fünf Validierungsquartale", "137 Treffer", "129 Treffer"],
        ["erklärbar", "„seit 592 km nicht in der Werkstatt“", "nur über Umwege"],
        ["Wartungsaufwand", "keiner", "vierteljährlich nachtrainieren"],
        ["Abhängigkeiten im Betrieb", "keine", "scikit-learn, joblib, Versionsstände"],
    ], y=(y := unter_intro(s)), spalten_b=[260, 320, 323.5], zeilen_h=36)
    sandband(s, "Die unteren drei Zeilen sind der Preis eines Modells. Er wäre zu "
                "zahlen, wenn die oberen beiden dafür sprächen. Sie tun es nicht.",
             y=darunter(y, h_tabelle(5, 36)))
    phasenleiste(s, 6)
    notizen(s, "Ein Modell muss seinen Unterhalt verdienen. Hier verdient es ihn "
               "nicht — und der Bericht muss das so schreiben, statt das Modell "
               "auszuliefern, weil man es nun einmal gebaut hat. Zum zweiten Mal in "
               "dieser Fallstudie hält ein durchschaubares Verfahren mit einem "
               "Modell mit; in Notebook 1 war es eine Nachschlagetabelle.")

    s = folie(prs, "Fall 2 · Phase 6", "Warum das Modell trotzdem nicht umsonst war",
              "Ein Verfahren, das nicht ausgeliefert wird, kann trotzdem die "
              "wertvollste Auskunft des Projekts liefern.")
    kachelreihe(s, [
        ("Es belegt die Wahl", [
            "Die Regel ist nicht aus",
            "Bequemlichkeit gewählt,",
            "sondern geprüft.",
            "",
            "Das ist der Unterschied",
            "zwischen einer Entscheidung",
            "und einer Unterlassung.",
        ]),
        ("Es misst die Obergrenze", [
            "Ein Wald mit 300 Bäumen",
            "findet auf diesen Merkmalen",
            "nichts, was über „Kilometer",
            "seit der Reparatur“ hinausgeht.",
            "",
            "Mehr Rechenleistung hilft",
            "hier nicht.",
        ]),
        ("Es ist der nächste Anlauf", [
            "Kommen neue Merkmale dazu —",
            "Stürze, Standzeiten, Stationen",
            "der Fahrten —, wird der",
            "Vergleich wiederholt.",
            "",
            "Dann kann er anders",
            "ausgehen.",
        ]),
    ], y=unter_intro(s), hoehe=200)
    phasenleiste(s, 6)
    notizen(s, "Die mittlere Kachel ist der eigentliche Ertrag. „Mehr Modell hilft "
               "nicht, mehr Information vielleicht schon“ ist eine belastbare Aussage "
               "über die Daten — und sie sagt dem Auftraggeber, wo er als Nächstes "
               "investieren muss: nicht in Rechenleistung, sondern in Erfassung.")

    s = folie(prs, "Fall 2 · Phase 6", "Die Rückkopplung, die dieses Verfahren schwierig macht",
              "Wer die Liste abarbeitet, verändert die Daten, aus denen das nächste "
              "Modell lernt. Diese Falle betrifft jede vorausschauende Wartung.")
    diagramm(s, bild("nb2-rueckkopplung"), y=unter_intro(s),
             hoehe=ZONE_UNTEN - unter_intro(s) - 34)
    notizen(s, "Das Modell sabotiert sich selbst, wenn es erfolgreich ist. Der Ausweg "
               "ist eine Kontrollgruppe: ein Teil der Flotte wird bewusst nicht nach "
               "Liste gewartet, damit man weiter lernt, was ohne Eingriff passiert "
               "wäre. Das kostet Geld und ist trotzdem richtig.")

    s = folie(prs, "Fall 2 · Abschluss", "Der Kreislauf schließt sich",
              "Ein Fall, der mit einem negativen Modellurteil endet — und trotzdem "
              "ein Erfolg ist.")
    tabelle(s, ["Phase", "Was dabei herauskam"], [
        ["1 Business Understanding", "Kostenmatrix 180 € gegen 25 €, zwei Kriterien — "
                                     "eines davon der Vergleich mit der Faustregel"],
        ["2 Data Understanding", "r ≈ 0,7, aber nicht deterministisch. 44 % melden "
                                 "sich, die Werkstatt schafft 26 %"],
        ["3 Data Preparation", "Zeitlicher Schnitt, acht Stichtage, jüngster als Test"],
        ["4 Modeling", "Erst zwei Faustregeln, dann Baum und Wald mit class_weight "
                       "aus der Kostenmatrix"],
        ["5 Evaluation", "Gleichstand auf dem Test. Über fünf Validierungsquartale "
                         "liegt die Regel vorn: 137 gegen 129 Treffer"],
        ["6 Deployment", "Die Regel — mit Wartungsliste, Überwachung und der "
                         "Rückkopplungsfalle. Das Modell bleibt im Paket"],
    ], y=unter_intro(s), spalten_b=[230, 673.5], zeilen_h=40)
    notizen(s, "Ein Modell muss seinen Unterhalt verdienen. Dieser Satz ist die "
               "Quintessenz des Falls — und er gilt weit über die Wartung hinaus.")


def fall3(prs):
    AKTUELLES_NB[0] = 3
    kapitel(prs, 4, "Fall 3 — Clustering: Erfolg ohne Zielgröße",
            "Wie legt man Erfolgskriterien fest, wenn es gar keine richtige Antwort "
            "gibt, an der man messen könnte?",
            "Der erste Fall ohne Label. Niemand sagt dem Verfahren, was richtig ist. "
            "Genau deshalb zeigt dieser Fall Phase 1 von innen: Die Erfolgskriterien "
            "müssen völlig anders gebaut werden — und sie sind trotzdem prüfbar.")

    s = folie(prs, "Fall 3", "Der Fall auf einen Blick")
    steckbrief(s, [
        ("Zwei Fragen", "A) Welche Stationstypen gibt es? B) Welche Kundengruppen?"),
        ("Analytisches Ziel", "Gruppen finden, die niemand vorgegeben hat"),
        ("Das Neue", "Es gibt keine Zielgröße — also auch keine Trefferquote"),
        ("Erfolgskriterien", "Benennbar · unterschiedlich behandelbar · groß genug · stabil"),
        ("Verfahren", "k-Means, k über Ellenbogenmethode und Silhouettenwert"),
        ("Urteil", "Vier Stationstypen, gegen die verdeckte Wahrheit geprüft: 100 % — "
                   "und zwei Befunde, die weh tun"),
    ], y=unter_intro(s))
    notizen(s, "Zeile 4 ist der Kern dieses Kapitels. Vier Kriterien, keines davon "
               "eine Kennzahl aus der Statistik. Sie sind trotzdem prüfbar — und sie "
               "stehen vor der Analyse fest, genau wie in Fall 1.")

    s = folie(prs, "Fall 3 · Phase 1", "Erfolgskriterien ohne richtige Antwort",
              "Ohne Label gibt es keine Trefferquote. Die Kriterien kommen deshalb "
              "aus dem Betrieb — und sie sind schärfer, als sie klingen.")
    streifen(s, [
        ("Benennbar", "Wenn die Disposition der Gruppe keinen Namen geben kann, "
                      "ist sie keine Gruppe"),
        ("Behandelbar", "Zwei Gruppen, die man gleich behandelt, sind eine Gruppe"),
        ("Groß genug", "Eine Gruppe mit drei Mitgliedern rechtfertigt keinen eigenen "
                       "Prozess"),
        ("Stabil", "Andere Zeiträume, ähnliche Gruppen — sonst hat man Rauschen "
                   "gruppiert"),
    ], y=unter_intro(s), hoehe=62, luecke=9, chip_b=0)
    phasenleiste(s, 1)
    notizen(s, "Fragen Sie: Welches dieser vier Kriterien ist statistisch? Keines. "
               "Und trotzdem kann man an jedem scheitern. Das ist der Beweis, dass "
               "Erfolgskriterien aus dem Fach kommen und nicht aus dem Verfahren.")

    s = folie(prs, "Fall 3 · Phasen 2 und 3", "Der Schnelldurchlauf",
              "Was die Daten hergeben — und warum hier zwingend standardisiert "
              "werden muss.")
    streifen(s, [
        ("Phase 2", "Die Stammdaten enthalten keinen Stationstyp. Das Muster steckt "
                    "nicht in den Attributen, sondern im Verhalten über den Tag"),
        ("Phase 3.A", "Tagesgang je Station, normiert und standardisiert"),
        ("Phase 3.B", "RFM über 365 Tage: Recency, Frequency, Monetary — Frequenz und "
                      "Umsatz logarithmiert, weil beide stark rechtsschief sind"),
    ], y=unter_intro(s), hoehe=76, luecke=10, chip_b=0)
    phasenleiste(s, 3)
    notizen(s, "Standardisieren ist bei k-Means nicht optional. Das Verfahren misst "
               "Abstände; eine Spalte in Euro und eine in Stückzahl haben völlig "
               "verschiedene Größenordnungen. Ohne Standardisierung entscheidet "
               "allein die Spalte mit den größten Zahlen.")

    s = folie(prs, "Fall 3 · Phase 4", "Wie viele Gruppen? Zwei Hinweise, keine Antwort",
              "k wird nicht berechnet, sondern begründet. Zwei Werkzeuge helfen — "
              "entscheiden muss der Mensch.")
    kachelreihe(s, [
        ("Ellenbogenmethode", [
            "Man rechnet k = 2, 3, 4 …",
            "und trägt die Streuung",
            "innerhalb der Gruppen auf.",
            "",
            "Wo der Knick ist, bringt eine",
            "weitere Gruppe wenig.",
        ]),
        ("Silhouettenwert", [
            "Misst je Punkt: Wie nah bin",
            "ich meiner Gruppe gegenüber",
            "der nächsten fremden?",
            "",
            "Höher ist besser.",
            "Bereich −1 bis +1.",
        ]),
        ("Und dann?", [
            "Beide Werkzeuge geben einen",
            "Hinweis, keinen Beweis.",
            "",
            "Die Entscheidung fällt an",
            "Kriterium 1 aus Phase 1:",
            "Kann man sie benennen?",
        ]),
    ], y=unter_intro(s), hoehe=190)
    phasenleiste(s, 4)
    notizen(s, "Das ist der Unterschied zu den überwachten Verfahren: Dort sagt eine "
               "Kennzahl, welches Modell besser ist. Hier sagt keine Kennzahl, welches "
               "k richtig ist. Die Fachlichkeit entscheidet — und deshalb standen die "
               "Kriterien vorher fest.")

    zellfolie(prs, 3, "4.2", "Phase 4 · im Notebook",
              "Ellenbogen und Silhouette, nebeneinander gerechnet",
              "nb3-k",
              "Zwei Kennzahlen je k — und keine davon entscheidet. Die Entscheidung "
              "fällt am Kriterium „benennbar“ aus Phase 1.",
              "Zeigen Sie auf die Spalte Silhouette: Der Unterschied zwischen k=3 und "
              "k=4 ist klein. Wer allein danach ginge, könnte würfeln. Erst die Frage, "
              "ob die Disposition den Gruppen einen Namen geben kann, entscheidet.")

    s = folie(prs, "Fall 3 · Phase 5", "Zwei Befunde, die weh tun",
              "Die Segmentierung sollte Zielgruppen für den Newsletter liefern. "
              "Herausgekommen ist eine Frage an die Preisgestaltung.")
    kachelreihe(s, [
        ("Befund 1", [
            "Die Vielfahrer bringen den",
            "GERINGSTEN Umsatz.",
            "",
            "Ihre Tarife enthalten",
            "Freiminuten — und weil es",
            "keine Grundgebühr gibt, ist",
            "das Nutzungsentgelt der",
            "gesamte Umsatz.",
        ]),
        ("Befund 2", [
            "Knapp ein Drittel der",
            "Kundschaft — 998 von 3.200 —",
            "taucht in der Segmentierung",
            "gar nicht auf.",
            "",
            "RFM sieht nur, wer kauft.",
            "Wer aufgehört hat, fällt aus",
            "der Tabelle — und aus dem",
            "Blick.",
        ]),
        ("Was daraus folgt", [
            "Kein Messfehler, sondern ein",
            "Preisproblem, das die",
            "Segmentierung sichtbar",
            "gemacht hat.",
            "",
            "Das ist ein Rücksprung nach",
            "Phase 1 — mit einer besseren",
            "Frage als der ersten.",
        ]),
    ], y=unter_intro(s), hoehe=222)
    notizen(s, "Hier passiert das, wovon CRISP-DM lebt: Die Analyse bringt eine Frage "
               "hervor, die vorher niemand gestellt hatte. Nicht „welche Segmente gibt "
               "es?“, sondern „sind die Freiminuten dort richtig eingesetzt, wo sie "
               "liegen?“ Betonen Sie: Es gibt bei VeloCity keine Grundgebühr — das ist "
               "Teil des Produktversprechens, nicht ein Versäumnis.")

    zellfolie(prs, 3, "5.B.3", "Phase 5 · im Notebook",
              "Die Idee für die Geschäftsführung — ausdrücklich als Hypothese",
              "nb3-hypothese",
              "Das Notebook schreibt „HYPOTHESE, kein Befund“ in die Ausgabe selbst. "
              "Damit kann die Zahl nicht als Ergebnis missverstanden werden.",
              "Das ist handwerklich vorbildlich und gehört betont: Eine Rechnung, die "
              "auf einer Annahme beruht, kennzeichnet sich selbst — im Code, nicht nur "
              "im Fließtext daneben. Wer nur die Ausgabe kopiert, kopiert die Warnung mit.")

    s = folie(prs, "Fall 3 · Phase 6", "Zwei Auslieferungen, zwei Vorbehalte",
              "Aus einer Analyse werden zwei sehr verschiedene Produkte — und beide "
              "tragen eine Einschränkung.")
    vorher_nachher(s,
                   ("A — Disposition", "Dispositionsplan als CSV", [
                       "Je Station der Typ und die",
                       "empfohlene Umverteilung.",
                       "",
                       "Vorbehalt: Die Gruppen sind",
                       "aus einem Jahr gerechnet.",
                       "Ändert sich das Netz, muss",
                       "neu gruppiert werden.",
                   ], False),
                   ("B — Marketing", "Kampagnenplan je Segment", [
                       "Vier Segmente, vier Ansprachen.",
                       "",
                       "Vorbehalt: Datenschutz. Eine",
                       "Segmentierung ist eine",
                       "Profilbildung — sie braucht",
                       "eine Rechtsgrundlage, keine",
                       "gute Absicht.",
                   ], False),
                   y=unter_intro(s), hoehe=210)
    phasenleiste(s, 6)
    notizen(s, "Der Datenschutzvorbehalt gehört auf die Folie und nicht in eine "
               "Fußnote. Studierende bauen später Segmentierungen in Unternehmen — "
               "und die Frage nach der Rechtsgrundlage kommt dort garantiert.")

    s = folie(prs, "Fall 3 · Phase 5",
              "Ein Kriterium, das man behauptet, ist keines",
              "Kriterium 4 aus Phase 1 lautete: „Ein zweiter Lauf mit anderem "
              "Zufallsstart muss dieselben Gruppen liefern.“ Belegt wurde es zunächst "
              "mit `n_init=25` — und das prüft etwas anderes.")
    vorher_nachher(s,
                   ("Was behauptet wurde", "n_init=25 als Beleg", [
                       "„25 Zufallsstarts, der beste",
                       "wird genommen.“",
                       "",
                       "Das ist Qualitätssicherung",
                       "INNERHALB eines Laufs — nicht",
                       "die Frage, ob ein anderer",
                       "Start dasselbe Ergebnis",
                       "liefert.",
                   ], False),
                   ("Was gemessen wurde", "Adjustierter Rand-Index", [
                       "Fünf Startwerte, jeder gegen",
                       "den Grundlauf verglichen.",
                       "",
                       "Stationen:   1,000 bis 1,000",
                       "Kundschaft:  0,895 bis 0,993",
                       "",
                       "Die Stationen sind stabil,",
                       "die Segmente nur annähernd.",
                   ], False),
                   y=unter_intro(s), hoehe=206)
    phasenleiste(s, 5)
    notizen(s, "Das Ergebnis ist gut — aber es war vorher nicht belegt, sondern "
               "behauptet. Der Unterschied zählt: Hätte die Messung eine Instabilität "
               "gezeigt, wäre sie unbemerkt in die Auslieferung gewandert. Für den "
               "Kampagnenplan hat der Befund eine praktische Folge: Er wird nicht über "
               "Cluster-Nummern ausgeliefert, sondern über nachvollziehbare Schwellen "
               "— die sind reproduzierbar, die Nummern nicht.")

    s = folie(prs, "Fall 3 · Abschluss", "Der Kreislauf schließt sich",
              "Zwei Fragen, ein Verfahren — und ein Ergebnis, das die "
              "Ausgangsfrage übertroffen hat.")
    tabelle(s, ["Phase", "A) Stationen", "B) Kundschaft"], [
        ["1 Business", "Umverteilung nach Regeln", "Newsletter nach Segmenten"],
        ["2 Data", "kein Typ in den Stammdaten", "kein Segment in der Kundentabelle"],
        ["3 Preparation", "Tagesgang, standardisiert", "RFM, logarithmiert"],
        ["4 Modeling", "k-Means, Ellenbogen + Silhouette", "dasselbe Verfahren"],
        ["5 Evaluation", "vier Typen, 100 % Übereinstimmung", "vier Segmente, zwei "
                                                              "Befunde"],
        ["6 Deployment", "Dispositionsplan", "Kampagnenplan, mit Vorbehalt"],
    ], y=unter_intro(s), spalten_b=[160, 340, 403.5], zeilen_h=40)
    notizen(s, "Die 100 Prozent in Zeile 5 sind eine Besonderheit dieses Lehrdatensatzes: "
               "Die Stationstypen sind beim Erzeugen bewusst eingebaut worden, deshalb "
               "gibt es eine verdeckte Wahrheit zum Gegenprüfen. In echten Daten hat "
               "man die nicht — dort bleiben nur die vier Kriterien aus Phase 1.")



def fall4(prs):
    AKTUELLES_NB[0] = 4
    kapitel(prs, 5, "Fall 4 — Zeitreihe: der Schnitt entlang der Zeit",
            "Wie viele Fahrten kommen morgen — und warum ist die genaueste "
            "Prognose nicht die beste?",
            "Dieser Fall zeigt Phase 3 von innen. Zwei Dinge gehen hier anders als "
            "in allen bisherigen Fällen: Die Aufteilung muss der Zeit folgen, und "
            "eine Störgröße macht einen Effekt vor, den es so nicht gibt.")

    s = folie(prs, "Fall 4", "Der Fall auf einen Blick")
    steckbrief(s, [
        ("Geschäftsfrage", "Wie viele Räder müssen morgen früh bereitstehen, und "
                           "braucht es einen Frühdienst?"),
        ("Analytisches Ziel", "Zahl der Fahrten am Folgetag"),
        ("Fehlerkosten", "4,00 € je fehlendem Rad gegen 0,80 € je überzähligem — "
                         "die Richtungen sind ungleich teuer"),
        ("Betriebskriterium", "Die Prognose muss um 18 Uhr stehen — sonst ist sie "
                              "wertlos, egal wie genau"),
        ("Verfahren", "Nullmodell, die echte Faustregel der Disposition, linear, "
                      "Gradient Boosting"),
        ("Urteil", "Klar besser als die Faustregel — und die genaueste Prognose ist "
                   "nicht die günstigste"),
    ], y=unter_intro(s))
    notizen(s, "Zeile 4 ist ungewöhnlich und wichtig: ein Erfolgskriterium, das nichts "
               "mit Genauigkeit zu tun hat. Ein Modell, das um 20 Uhr fertig wird, hat "
               "die Aufgabe verfehlt, auch wenn es perfekt trifft.")

    s = folie(prs, "Fall 4 · Phase 2", "Die Störgröße, in die man hier zwangsläufig tappt",
              "Der rohe Ferieneffekt sagt: In den Ferien wird mehr gefahren. Das "
              "stimmt — und es ist trotzdem irreführend.")
    vorher_nachher(s,
                   ("Was man misst", "Ferien = mehr Fahrten", [
                       "Die Differenz ist deutlich",
                       "und statistisch belastbar.",
                       "",
                       "Schlussfolgerung:",
                       "„Ferien treiben die Nachfrage.“",
                       "",
                       "Und das ist falsch.",
                   ], False),
                   ("Was wirklich wirkt", "Ferien liegen im Sommer", [
                       "Die langen Ferien fallen mit",
                       "der warmen Jahreszeit zusammen.",
                       "",
                       "Gemessen wird das Wetter,",
                       "benannt werden die Ferien.",
                       "",
                       "Klassische Störgröße.",
                   ], False),
                   y=unter_intro(s), hoehe=210)
    phasenleiste(s, 2)
    notizen(s, "Der Prüfstein: Vergleichen Sie Ferien- und Nichtferientage BEI "
               "gleicher Temperatur. Dann schrumpft der Effekt zusammen. Genau diese "
               "Kontrolle unterscheidet eine Datenanalyse von einer Korrelationsjagd.")

    zellfolie(prs, 4, "2.3", "Phase 2 · im Notebook",
              "Die Störgröße, in zwei Zeilen entlarvt",
              "nb4-stoergroesse",
              "Roh: Faktor 0,91. Bei gleicher Temperatur: 0,75. Derselbe Datensatz, "
              "zwei völlig verschiedene Aussagen.",
              "Das ist die schärfste Zelle des Notebooks. Die rohe Zahl legt nahe, "
              "Ferien wirkten schwach dämpfend. Kontrolliert man die Temperatur, ist "
              "der Effekt deutlich stärker — er war vorher vom Sommer überdeckt. "
              "Lassen Sie die beiden Faktoren nebeneinander stehen.")

    s = folie(prs, "Fall 4 · Phase 3", "Der Schnitt folgt der Zeit, nicht dem Zufall",
              "Dies ist die Folie, wegen der dieser Fall im Deck steht. Ein "
              "zufälliger Schnitt wäre hier ein schwerer, aber unsichtbarer Fehler.")
    vorher_nachher(s,
                   ("Falsch", "Zufällig, 80/20", [
                       "Das Modell lernt aus dem",
                       "August 2026 und sagt den",
                       "Juli 2026 vorher.",
                       "",
                       "Es kennt die Zukunft.",
                       "Das Ergebnis wird glänzend",
                       "und ist wertlos.",
                   ], False),
                   ("Richtig", "Entlang der Zeit", [
                       "Training bis Frühjahr 2026,",
                       "Test ist der Sommer 2026.",
                       "",
                       "Das entspricht genau der",
                       "Lage im Betrieb: Man kennt",
                       "die Vergangenheit und sagt",
                       "den nächsten Tag vorher.",
                   ], False),
                   y=unter_intro(s), hoehe=210)
    phasenleiste(s, 3)
    notizen(s, "Der Fehler ist deshalb so gefährlich, weil er sich nicht durch eine "
               "schlechte Kennzahl verrät — im Gegenteil, die Kennzahl wird besser. "
               "Auffallen würde er erst im Betrieb, Wochen später.")

    s = folie(prs, "Fall 4 · Phase 4", "Vier Stufen, und die zweite ist ein Mensch",
              "Wieder gilt: erst der Maßstab, dann die Verfahren. Der wichtigste "
              "Maßstab ist hier die Regel, nach der die Disposition heute arbeitet.")
    prozesskette(s, "Null-\nmodell", [
        ("Faustregel der\nDisposition", ""), ("Lineare\nRegression", ""),
        ("Gradient\nBoosting", ""),
    ], "Bestes\nModell", y=unter_intro(s) + 20, hoehe=96)
    phasenleiste(s, 4)
    notizen(s, "Die Faustregel lautet sinngemäß: so viele wie am gleichen Wochentag "
               "der Vorwoche. Das ist erstaunlich stark und schlägt das Nullmodell "
               "deutlich. Wer sie nicht mitrechnet, hält sein Modell für besser, als "
               "es ist.")

    s = folie(prs, "Fall 4 · Phase 5", "Die genaueste Prognose ist nicht die günstigste",
              "Weil ein fehlendes Rad 4,00 € kostet und ein überzähliges 0,80 €, "
              "verschiebt sich das Optimum — weg vom kleinsten Fehler.")
    kachelreihe(s, [
        ("Ohne Aufschlag", [
            "Die Prognose trifft im Mittel",
            "am besten.",
            "",
            "Sie liegt genauso oft zu hoch",
            "wie zu tief — und jede zu",
            "tiefe Schätzung kostet das",
            "Fünffache einer zu hohen.",
        ]),
        ("Mit Aufschlag", [
            "Rund 12 % werden auf die",
            "Prognose aufgeschlagen —",
            "gewählt auf der Validierung,",
            "nicht auf dem Test.",
            "",
            "Der mittlere Fehler steigt.",
            "Die Kosten sinken. Beides",
            "gleichzeitig.",
        ]),
        ("Was man lernt", [
            "Die Kennzahl, die man",
            "optimiert, muss die Kosten",
            "abbilden — nicht die",
            "Genauigkeit.",
            "",
            "Sonst optimiert man das",
            "Falsche, sehr sorgfältig.",
        ]),
    ], y=unter_intro(s), hoehe=210)
    phasenleiste(s, 5)
    notizen(s, "Das ist für viele die überraschendste Folie des ganzen Decks. Ein "
               "absichtlich schlechteres Modell ist das bessere Werkzeug. Der Grund "
               "steht in Phase 1: die ungleichen Fehlerkosten. Wer Phase 1 "
               "übersprungen hat, kann diese Entscheidung gar nicht treffen.")

    zellfolie(prs, 4, "5.1", "Phase 5 · im Notebook",
              "Die Kostenrechnung, die den Aufschlag begründet",
              "nb4-aufschlag",
              "Das Notebook rechnet beides aus: die Kosten ohne und mit "
              "Sicherheitsaufschlag. Erst dieser Vergleich rechtfertigt ein "
              "absichtlich ungenaueres Modell.",
              "Ohne diese Rechnung wäre der Aufschlag reine Bauchentscheidung. Mit ihr "
              "ist er eine belegte Optimierung — und genau das ist der Unterschied "
              "zwischen Erfahrung und Willkür.")

    s = folie(prs, "Fall 4 · Phase 6", "Das ehrliche Eingeständnis gehört in den Bericht",
              "Das Modell rechnete mit dem TATSÄCHLICHEN Wetter. Im Betrieb steht "
              "nur eine Wettervorhersage zur Verfügung.")
    tabelle(s, ["Rechnung", "Grundlage", "Ergebnis"], [
        ["In der Evaluation", "tatsächliches Wetter des Tages", "der schöne Wert"],
        ["Im Betrieb", "Wettervorhersage von gestern 18 Uhr",
         "spürbar höherer Fehler — und das ist die Zahl, die zählt"],
    ], y=unter_intro(s), spalten_b=[220, 330, 353.5], zeilen_h=48)
    phasenleiste(s, 6)
    notizen(s, "Die Versuchung, den schönen Wert zu berichten, ist groß — er ist ja "
               "korrekt gerechnet. Er beantwortet nur nicht die Frage, die im Betrieb "
               "gestellt wird. Dasselbe Muster wie der Schattenbetrieb in Fall 1.")

    zellfolie(prs, 4, "5.2", "Phase 5 · im Notebook",
              "Zwei Fehlerwerte — und nur einer zählt",
              "nb4-ehrlich",
              "MAE 12,25 mit dem tatsächlichen Wetter, 16,90 mit einer simulierten "
              "Vorhersage. Geurteilt wird auf der zweiten Zahl — davor, nicht danach.",
              "Diese Zelle stand in einer früheren Fassung in Phase 6, also NACH der "
              "Freigabe. Die Freigabe fiel damit auf einer Zahl, die das ausgelieferte "
              "Produkt nie erreicht — mit Ist-Wetter 1.727 €, im Betrieb 3.523 €. "
              "Jetzt steht die Zelle vor dem Urteil. Wer in einem Bericht nur die "
              "erste Zahl zeigt, hat nicht gelogen und trotzdem getäuscht.")

    s = folie(prs, "Fall 4 · Abschluss", "Der Kreislauf schließt sich")
    tabelle(s, ["Phase", "Was dabei herauskam"], [
        ["1 Business Understanding", "Zwei Entscheidungen, zwei ungleich teure "
                                     "Fehlerrichtungen (4,00 € gegen 0,80 €), ein "
                                     "Betriebskriterium: 18 Uhr"],
        ["2 Data Understanding", "Jahresgang und Wochenrhythmus übereinander — und "
                                 "eine Störgröße: Ferien liegen im Sommer"],
        ["3 Data Preparation", "Schnitt entlang der Zeit, Testmenge ist der Sommer 2026"],
        ["4 Modeling", "Nullmodell, echte Faustregel, linear, Gradient Boosting"],
        ["5 Evaluation", "Klar besser als die Faustregel — und ein Sicherheitsaufschlag "
                         "senkt die Kosten"],
        ["6 Deployment", "Mit simulierter Vorhersage steigt der Fehler. Die ehrliche "
                         "Zahl gehört in den Bericht"],
    ], y=unter_intro(s), spalten_b=[230, 673.5], zeilen_h=42)
    notizen(s, "Merksatz für diesen Fall: Bei allem, was mit Zeit zu tun hat, ist die "
               "Aufteilung die erste Frage — nicht das Verfahren.")


def fall5(prs):
    AKTUELLES_NB[0] = 5
    kapitel(prs, 6, "Fall 5 — Assoziation: wenn die Hürde alles wegnimmt",
            "Welche Wege gehören zusammen — und wieviel von dem, was auffällt, "
            "ist überhaupt brauchbar?",
            "Dieser Fall zeigt Phase 5 von innen. Er ist der beste Beleg dafür, "
            "wozu vorab festgelegte Kriterien gut sind: Von 32 gefundenen Regeln "
            "übersteht keine einzige beide Hürden — und die stärkste verfehlt sie "
            "um ein Hundertstel Prozentpunkt. Genau das ist der Moment, in dem die "
            "Versuchung am größten ist, das Kriterium nachträglich zu senken.")

    s = folie(prs, "Fall 5", "Der Fall auf einen Blick")
    steckbrief(s, [
        ("Geschäftsfrage", "Von wo nach wo wird gefahren — und wo muss der "
                           "Transporter Räder umverteilen?"),
        ("Das Neue", "Weder Zielgröße noch Gruppen, sondern Regeln: Was hängt mit "
                     "was zusammen?"),
        ("Drei Kriterien", "Support ≥ 1 % · Lift ≥ 1,3 · die Regel muss eine "
                           "Transporterfahrt begründen"),
        ("Datensicht", "Eine Fahrt ist ein Warenkorb: Startort und Zielort zusammen"),
        ("Verfahren", "Support, Konfidenz und Lift von Hand — drei Divisionen"),
        ("Urteil", "Von 32 Regeln nimmt keine beide Hürden — die stärkste "
                   "verfehlt sie um 0,01 Prozentpunkte"),
    ], y=unter_intro(s))
    notizen(s, "Die drei Kennzahlen sind mit Absicht von Hand gerechnet und nicht aus "
               "einer Bibliothek geholt. Wer die drei Divisionen einmal selbst "
               "gemacht hat, verwechselt Konfidenz und Lift nie wieder.")

    s = folie(prs, "Fall 5 · Phase 1", "Drei Kennzahlen — am Beispiel aus dem Handel",
              "Support, Konfidenz und Lift beantworten drei verschiedene Fragen. "
              "Nur die dritte sagt, ob ein Zusammenhang überhaupt einer ist.")
    tabelle(s, ["Kennzahl", "Frage", "Falle"], [
        ["Support", "Wie oft kommt die Kombination überhaupt vor?",
         "Hoher Support heißt nur: es ist häufig. Nicht: es hängt zusammen"],
        ["Konfidenz", "Wenn A, wie oft dann auch B?",
         "Hoch, wenn B einfach oft vorkommt — auch ohne jeden Zusammenhang"],
        ["Lift", "Wie oft passiert es gemeinsam, verglichen mit Zufall?",
         "Lift 1,0 heißt: kein Zusammenhang. Das ist die einzige der drei "
         "Kennzahlen, die das erkennt"],
    ], y=unter_intro(s), spalten_b=[130, 300, 473.5], zeilen_h=56)
    phasenleiste(s, 1)
    notizen(s, "Das klassische Handelsbeispiel: Brot und Milch haben hohen Support und "
               "hohe Konfidenz — aber Lift um 1,0. Sie werden zusammen gekauft, weil "
               "beide oft gekauft werden, nicht weil sie zusammengehören.")

    s = folie(prs, "Fall 5 · Phase 2", "Der stärkste Zusammenhang ist wahr und nutzlos",
              "Was das Verfahren zuerst findet, sind die Rundtouren: Start und Ziel "
              "sind dieselbe Station, bei knapp 20 % der angedockten Fahrten.")
    kachelreihe(s, [
        ("Der Befund", [
            "Rundtouren sind mit Abstand",
            "das häufigste Muster.",
            "",
            "Support hoch, Konfidenz hoch,",
            "Lift hoch.",
            "Eine perfekte Regel.",
        ]),
        ("Warum nutzlos", [
            "Kriterium 3 aus Phase 1:",
            "Die Regel muss eine Fahrt",
            "des Transporters begründen.",
            "",
            "Bei einer Rundtour steht das",
            "Rad am Ende dort, wo es",
            "gestartet ist. Nichts zu tun.",
        ]),
        ("Die Lehre", [
            "Ein starker Zusammenhang",
            "ist nicht dasselbe wie ein",
            "brauchbarer.",
            "",
            "Rundtouren werden",
            "ausgeschlossen — begründet",
            "und dokumentiert.",
        ]),
    ], y=unter_intro(s), hoehe=200)
    phasenleiste(s, 2)
    notizen(s, "Das dritte Erfolgskriterium aus Phase 1 tut hier genau seine Arbeit. "
               "Ohne es wäre die stärkste Regel des Datensatzes das Hauptergebnis "
               "gewesen — und der Bericht wertlos.")

    s = folie(prs, "Fall 5 · Phase 3", "Vier Zeitfenster statt vierundzwanzig Stunden",
              "Ohne diese Entscheidung wäre jede Regel unbelegt — bei 24 Stunden "
              "fällt auf jede einzelne zu wenig, um irgendetwas zu zeigen.")
    kachelreihe(s, [
        ("Das Problem", [
            "Teilt man den Tag in Stunden,",
            "hat jede Start-Ziel-Stunden-",
            "Kombination eine Handvoll",
            "Fahrten.",
            "",
            "Support nahe null, jede Regel",
            "ununterscheidbar vom Zufall.",
        ]),
        ("Die Lösung", [
            "Vier Fenster, an den",
            "tatsächlichen Spitzen",
            "orientiert:",
            "",
            "Früh · Vormittag ·",
            "Nachmittag · Abend",
        ]),
        ("Der Vorbehalt", [
            "Die vier Fenster sind gesetzt,",
            "nicht gefunden.",
            "",
            "Eine Aufteilung nach den",
            "Spitzen aus Notebook 3 könnte",
            "schärfere Regeln liefern —",
            "notiert für die zweite Runde.",
        ]),
    ], y=unter_intro(s), hoehe=200)
    phasenleiste(s, 3)
    notizen(s, "Der Vorbehalt rechts ist wichtig: Eine Entscheidung, die gesetzt und "
               "nicht geprüft wurde, gehört benannt. Sonst liest sie sich später wie "
               "ein Befund.")

    zellfolie(prs, 5, "4", "Phase 4 · im Notebook",
              "Eine einzelne Regel, von Hand nachgerechnet",
              "nb5-regel",
              "Support, Konfidenz und Lift für eine konkrete Regel — drei Divisionen, "
              "Zeile für Zeile nachvollziehbar.",
              "Wer diese drei Divisionen einmal selbst gesehen hat, verwechselt "
              "Konfidenz und Lift nicht mehr. Deshalb steht die Rechnung im Notebook "
              "ausgeschrieben und nicht als Bibliotheksaufruf.")

    s = folie(prs, "Fall 5 · Phase 5", "Von 32 Regeln bleibt keine",
              "Hoher Lift und hoher Support schließen einander fast aus. Wer beide "
              "Hürden vorab setzt, siebt radikal — hier bis auf null.")
    tabelle(s, ["Hürde", "Regeln, die sie erfüllen"], [
        ["Alle gefundenen Regeln", "32"],
        ["Lift ≥ 1,3", "9"],
        ["Support ≥ 1 %", "0"],
        ["Beide zugleich", "0"],
    ], y=(y := unter_intro(s)), spalten_b=[500, 403.5], zeilen_h=44)
    sandband(s, "Die stärkste Regel — werktags früh vom Hauptbahnhof zum Hubland "
                "Campus — erreicht 0,99 % Support. Zur Hürde fehlen 0,01 "
                "Prozentpunkte, also rund fünf Fahrten in drei Jahren.",
             y=darunter(y, h_tabelle(4, 44)))
    phasenleiste(s, 5)
    notizen(s, "Warum schließen sie einander fast aus? Ein sehr spezifisches Muster "
               "ist selten (niedriger Support), ein sehr häufiges ist unspezifisch "
               "(niedriger Lift). Wer nur eine der beiden Hürden setzt, findet "
               "entweder Belangloses oder Zufälliges. Hier kommt beides zusammen — "
               "und das Ergebnis ist eine leere Liste.")

    s = folie(prs, "Fall 5 · Phase 5",
              "0,99 gegen 1,00 Prozent — der teuerste Moment eines Projekts",
              "Die Hürde auf 0,9 % zu senken wäre die Arbeit von zehn Sekunden. "
              "Niemand würde es je bemerken. Genau deshalb darf es nicht passieren.")
    kachelreihe(s, [
        ("Was verlockend wäre", [
            "„0,99 ist doch praktisch 1.“",
            "",
            "Eine Zeile im Notebook, und",
            "aus dem Fehlschlag wird ein",
            "Ergebnis mit einer Regel,",
            "über die man vortragen kann.",
        ]),
        ("Warum es verboten ist", [
            "Ein Kriterium, das man nach",
            "dem Ergebnis anpasst, misst",
            "nichts mehr.",
            "",
            "Es wäre dasselbe, wie es gar",
            "nicht erst aufgestellt zu",
            "haben.",
        ]),
        ("Was stattdessen gilt", [
            "Keine Regel wird freigegeben.",
            "",
            "Ob 1 % die richtige Hürde für",
            "ein Netz aus zehn Stationen",
            "ist, gehört zurück in Phase 1",
            "— als Gespräch mit der",
            "Disposition, nicht als Zeile.",
        ]),
    ], y=unter_intro(s), hoehe=196)
    phasenleiste(s, 5, rueckspruenge=(1,))
    notizen(s, "Dies ist die vielleicht wichtigste Folie des ganzen Decks. Der Fall "
               "ist so knapp, dass jede Ausrede greifbar wäre — und genau daran "
               "zeigt sich, ob ein Erfolgskriterium ernst gemeint war. Fragen Sie "
               "die Studierenden ehrlich, was sie täten. Die meisten würden senken. "
               "Genau deshalb steht diese Folie hier.")

    zellfolie(prs, 5, "5.2", "Phase 5 · im Notebook",
              "Die Hürden sieben — 32, dann 9, dann keine",
              "nb5-huerden",
              "Und darunter, gemessen statt behauptet: wie knapp die stärkste Regel "
              "scheitert.",
              "Diese Ausgabe ist der beste Beleg des ganzen Decks dafür, wozu vorab "
              "gesetzte Kriterien gut sind. Beachten Sie die letzten Zeilen: Das "
              "Notebook rechnet aus, wie weit die beste Regel danebenliegt, statt "
              "das Scheitern nur zu behaupten. Wer den Abstand kennt, kann in "
              "Phase 1 begründet darüber reden — wer ihn nicht kennt, senkt die "
              "Hürde aus dem Bauch heraus.")

    s = folie(prs, "Fall 5 · Phase 6", "Von zwei Plänen trägt einer",
              "Beide entstehen aus den Salden je Station und Zeitfenster, nicht aus "
              "den Regeln. Nur einer von beiden ergibt eine Anweisung, die jemand "
              "ausführen kann.")
    vorher_nachher(s,
                   ("Plan A — trägt nicht", "Umverteilen zwischen Stationen", [
                       "Größter Überschuss:",
                       "1,8 Räder je Werktag.",
                       "Größter Fehlbestand: 1,1.",
                       "",
                       "Die Stationen fassen 20 bis 40.",
                       "",
                       "Für 1,8 Räder fährt kein",
                       "Transporter durch Würzburg.",
                   ], False),
                   ("Plan B — trägt", "Frei abgestellte Räder einsammeln", [
                       "Rund elf Räder je Werktag",
                       "bleiben frei im Gebiet.",
                       "",
                       "Das ist eine Runde, die sich",
                       "lohnt — und sie braucht keine",
                       "einzige Assoziationsregel.",
                       "",
                       "Vorbehalt: Wegeketten sind",
                       "personenbezogene Daten.",
                   ], False),
                   y=unter_intro(s), hoehe=214)
    phasenleiste(s, 6)
    notizen(s, "Eine frühere Fassung dieses Notebooks druckte hier „+1205 Räder laufen "
               "auf“ — die Summe über 741 Werktage, gedruckt wie eine Anweisung an den "
               "Fahrer. Die Zahl war richtig, die Einheit fehlte, und mit ihr die "
               "Einsicht, dass der Plan nichts trägt. Merksatz: Eine Zahl ohne "
               "Zeitbezug ist keine Betriebsanweisung. Der Hinweis rechts unten ist "
               "ebenfalls kein Beiwerk — aus Start-Ziel-Paaren mit Zeitstempel lassen "
               "sich Bewegungsprofile bilden.")

    s = folie(prs, "Fall 5 · Abschluss", "Der Kreislauf schließt sich")
    tabelle(s, ["Phase", "Was dabei herauskam"], [
        ["1 Business Understanding", "„Von wo nach wo?“ statt „wie viele?“. Drei "
                                     "Kriterien, darunter eines, das rein fachlich ist"],
        ["2 Data Understanding", "Eine Fahrt ist ein Warenkorb. Rundtouren: wahr und "
                                 "nutzlos, deshalb ausgeschlossen"],
        ["3 Data Preparation", "Vier Zeitfenster statt 24 Stunden, sonst wäre jede "
                               "Regel unbelegt"],
        ["4 Modeling", "Support, Konfidenz und Lift von Hand — eine Regel Zeile für "
                       "Zeile nachgerechnet"],
        ["5 Evaluation", "32 Regeln, 9 mit Lift, keine mit Support — die stärkste "
                         "verfehlt die Hürde um 0,01 Prozentpunkte"],
        ["6 Deployment", "Der Umverteilungsplan trägt nicht — 1,8 Räder je "
                         "Werktag. Was trägt, ist die Einsammelrunde"],
    ], y=unter_intro(s), spalten_b=[230, 673.5], zeilen_h=42)
    notizen(s, "Merksatz: Die auffälligste Regel ist meistens die uninteressanteste. "
               "Erst die vorab gesetzten Hürden trennen Fund von Rauschen.")


def fall6(prs):
    AKTUELLES_NB[0] = 6
    kapitel(prs, 7, "Fall 6 — Anomalie: der Rücksprung zum Mitlesen",
            "Was ist gestern schiefgelaufen — und was tut man, wenn das Modell "
            "sauber rechnet und trotzdem Unbrauchbares liefert?",
            "Der einzige Fall, in dem der Rücksprung nicht am Ende steht, sondern "
            "mitten im Notebook Zelle für Zelle mitzulesen ist. Und der einzige, "
            "der mit einem ausdrücklich negativen Ergebnis endet.")

    s = folie(prs, "Fall 6", "Der Fall auf einen Blick")
    steckbrief(s, [
        ("Zwei Aufgaben", "A) Auffällige Fahrten finden  B) Stationsausfälle erkennen"),
        ("Das Produkt", "Eine Tagesliste mit zehn Plätzen für die Disposition"),
        ("Erfolgskriterium", "Jeder fünfte Eintrag muss tragen — 20 %. Rentabel "
                             "wäre die Liste schon ab 5 %"),
        ("Verfahren", "Interquartilsregel als Maßstab, dann Isolation Forest"),
        ("Der Rücksprung", "Phase 4 zurück nach Phase 3 — das Modell fand die "
                           "Preisklasse statt der Anomalien"),
        ("Urteil", "Beide Aufgaben lösbar — aber je einmal gewinnt eine Regel gegen "
                   "das Modell"),
    ], y=unter_intro(s))
    notizen(s, "Die 5 Prozent in Zeile 3 überraschen. Sie kommen aus einer "
               "Kosten-Nutzen-Rechnung: Ein gefundener Vorgang spart mehr, als neun "
               "Fehlalarme an Prüfzeit kosten. Erfolgskriterien sind nicht immer "
               "anspruchsvoll — sie müssen begründet sein.")

    s = folie(prs, "Fall 6 · Phase 2", "Eine Sackgasse, die man kennen sollte",
              "Die Geschwindigkeit wäre ein naheliegendes Merkmal für auffällige "
              "Fahrten. Sie taugt hier nichts — und zwar aus einem lehrreichen Grund.")
    vorher_nachher(s,
                   ("Der Einfall", "Geschwindigkeit als Merkmal", [
                       "Ungewöhnlich schnell oder",
                       "langsam — klingt nach genau",
                       "dem, was eine Anomalie",
                       "ausmacht.",
                   ], False),
                   ("Der Haken", "Sie ist abgeleitet", [
                       "Geschwindigkeit = Distanz",
                       "geteilt durch Dauer.",
                       "",
                       "Die Dauer ist schon ein",
                       "Merkmal. Man fügt keine",
                       "Information hinzu, sondern",
                       "dieselbe noch einmal.",
                   ], False),
                   y=unter_intro(s), hoehe=200)
    phasenleiste(s, 2)
    notizen(s, "Dazu kommt: Die Distanz fehlt bei 42 Prozent der Fahrten — derselbe "
               "Befund wie in Fall 1. Ein Merkmal, das bei zwei von fünf Fahrten "
               "fehlt und ansonsten nur Bekanntes wiederholt, ist keine gute Wahl.")

    s = folie(prs, "Fall 6 · Phase 4", "Das Modell rechnete sauber und fand das Falsche",
              "Der Isolation Forest lieferte beim ersten Versuch eine Liste, die "
              "sich beim Ansehen als völlig unbrauchbar erwies.")
    kachelreihe(s, [
        ("Was oben stand", [
            "Fast ausschließlich",
            "E-Cargo-Fahrten.",
            "",
            "Das Modell hatte etwas",
            "gefunden — nur nicht das,",
            "wonach gesucht war.",
        ]),
        ("Warum", [
            "Ein CARGO-Rad kostet 0,50 €",
            "je Minute, ein CITY-Rad",
            "0,10 €.",
            "",
            "Beim Entgelt ist jede",
            "Cargo-Fahrt ein Ausreißer —",
            "völlig zu Recht.",
        ]),
        ("Wie es auffiel", [
            "Nicht durch eine Kennzahl.",
            "",
            "Sondern dadurch, dass jemand",
            "die zehn obersten Zeilen",
            "ANGESEHEN hat.",
        ]),
    ], y=unter_intro(s), hoehe=190)
    phasenleiste(s, 4)
    notizen(s, "Das ist die wichtigste Folie dieses Kapitels. Jede Kennzahl hätte hier "
               "grün gemeldet — das Verfahren hat sauber gearbeitet und stabile "
               "Ausreißer gefunden. Nur der Blick auf die Fälle zeigt, dass es die "
               "Preisklasse war.")

    zellfolie(prs, 6, "4.4", "Phase 4 · im Notebook",
              "Der Fehlschlag, den nur der Blick auf die Zeilen zeigt",
              "nb6-fehlschlag",
              "Oben in der Liste: fast nur CARGO. Die Spalte entgelt_je_minute "
              "verrät, warum — das Modell hat die Preisklasse gefunden.",
              "Keine Kennzahl hätte das gemeldet. Der Isolation Forest hat sauber "
              "gearbeitet und stabile Ausreißer gefunden. Erst die Tabelle zeigt, "
              "dass es die falschen sind. Das ist die Begründung für die Regel: "
              "Sehen Sie sich immer die Extremfälle an.")

    s = folie(prs, "Fall 6 · Rücksprung", "Zurück nach Phase 3 — und was es brachte",
              "Die Korrektur ist klein: das Entgelt innerhalb des Radtyps normieren. "
              "Die Wirkung ist groß.")
    tabelle(s, ["", "Trefferquote", "Bewertung"], [
        ["Erster Versuch", "2,0 %", "unbrauchbar — gefunden wurde die Preisklasse"],
        ["Nach der Normierung", "36,0 %", "Kriterium aus Phase 1 (20 %) erfüllt"],
    ], y=unter_intro(s), spalten_b=[250, 180, 473.5], zeilen_h=48)
    phasenleiste(s, 3, rueckspruenge=(4,))
    notizen(s, "Von 2 auf 36 Prozent durch eine Normierung — von einem Treffer unter "
               "fünfzig auf achtzehn. Studierende sollen mitnehmen: Der größte Hebel "
               "lag nicht im Verfahren, sondern in der Datenaufbereitung, wie so oft. "
               "Und beachten Sie den Maßstab: 20 Prozent sind das Erfolgskriterium, "
               "nicht die Rentabilitätsschwelle. Rechnen würde sich die Liste schon "
               "ab 5 Prozent — aber eine Liste, bei der neunzehn von zwanzig "
               "Einträgen unnötig sind, öffnet nach zwei Wochen niemand mehr.")

    zellfolie(prs, 6, "4.5", "Nach dem Rücksprung · im Notebook",
              "Dieselbe Auswertung, nach der Normierung",
              "nb6-korrektur",
              "Die Radtyp-Verteilung der fünfzig auffälligsten Vorgänge ist jetzt "
              "gemischt statt einseitig. Genau das war das Ziel der Korrektur.",
              "Vergleichen Sie mit der Folie davor. Dieselbe Auswertung, dieselben "
              "Daten, ein normiertes Merkmal — und ein völlig anderes Bild. Der "
              "Hebel lag in Phase 3, nicht im Verfahren.")

    s = folie(prs, "Fall 6 · Phase 5",
              "Das Modell scheitert — die Aufgabe nicht",
              "Stationsausfälle sollten aus dem Fahrtaufkommen erkennbar sein. Der "
              "Isolation Forest findet sie nicht. Eine Zeile Fachwissen schon.")
    tabelle(s, ["Vorgehen", "Trefferquote", "Kriterium 20 %"], [
        ["Isolation Forest über alle 10.890 Stationstage", "14 %", "gerissen"],
        ["Regel: nur die 1.041 Tage ohne Fahrt, nach Einbruch sortiert",
         "32 %", "erfüllt"],
    ], y=(y := unter_intro(s)), spalten_b=[520, 200, 183.5], zeilen_h=52)
    sandkarte(s, "Warum die Regel gewinnt",
              ["Alle 107 Störungen liegen an Tagen ohne jede Fahrt. Diese Eingrenzung "
               "ist Fachwissen, keine Statistik.",
               "Ein Verfahren, das über alle 10.890 Tage sucht, verbringt seine Kraft "
               "damit, die Eingrenzung nachzuerfinden — und schafft es schlechter, als "
               "ein Satz sie vorgibt."],
              y=darunter(y, h_tabelle(2, 52)))
    phasenleiste(s, 5)
    notizen(s, "Diese Folie ist das Gegenstück zu Fall 2. Dort ließ eine schlecht "
               "gebaute Baseline ein Modell zu gut aussehen. Hier ließ eine FEHLENDE "
               "Baseline eine Aufgabe unlösbar aussehen — eine frühere Fassung des "
               "Notebooks schrieb, Aufgabe B sei mit diesen Daten nicht lösbar. Beide "
               "Male hilft dasselbe: erst die einfachste Lösung bauen, dann das "
               "Verfahren daran messen.")

    zellfolie(prs, 6, "5.4", "Phase 5 · im Notebook",
              "Modell gegen Regel, Zeile für Zeile",
              "nb6-aufgabeB",
              "Bei jeder Listenlänge liegt die Regel vorn. Bei 50 Plätzen findet das "
              "Modell keine einzige Störung, die Regel jede dritte.",
              "Lassen Sie die Studierenden die erste Spalte lesen, bevor Sie die "
              "zweite aufdecken. Ein Modell, das bei fünfzig Plätzen null Treffer "
              "hat, sieht nach einem unlösbaren Problem aus — bis jemand die Regel "
              "danebenstellt.")

    s = folie(prs, "Fall 6 · Phase 6", "Drei Sorten Auffälligkeit, drei Antworten",
              "Die Auswertung hat die Aufgabe geteilt. Nur eine der drei Sorten "
              "rechtfertigt ein Modell.")
    streifen(s, [
        ("Vergessene Rückgaben", "Eine Zeile SQL: dauer_min > 480. Vollständig, "
                                 "nachprüfbar, kein Modell nötig"),
        ("Auffällige Stationstage", "Die Regel aus 5.5 — nur Nulltage, nach Einbruch "
                                    "sortiert. Schlägt das Modell und erfüllt das Kriterium"),
        ("Alles andere", "Die Tagesliste des Isolation Forest. Dafür gibt es keine "
                         "Regel — und keine Trefferquote, weil niemand vorher weiß, "
                         "wonach er sucht"),
        ("Rückkopplungsvorteil", "Anders als in Fall 2 verbessert die Nutzung hier "
                                 "die Datenlage: Jede geprüfte Meldung ist ein Label "
                                 "für die nächste Runde"),
    ], y=unter_intro(s), hoehe=62, luecke=8, chip_b=0)
    phasenleiste(s, 6)
    notizen(s, "Der dritte Punkt ist der Gegensatz zu Fall 2: Dort zerstörte die "
               "Nutzung die Lerngrundlage, hier schafft sie eine. Es lohnt sich, bei "
               "jedem Projekt zu fragen, in welche Richtung die Rückkopplung läuft.")

    s = folie(prs, "Fall 6 · Abschluss", "Der Kreislauf schließt sich")
    tabelle(s, ["Phase", "Was dabei herauskam"], [
        ["1 Business Understanding", "Zwei Aufgaben, zehn Listenplätze. Rentabel ab "
                                     "5 %, gefordert werden 20 % — sonst wird die "
                                     "Liste nicht benutzt"],
        ["2 Data Understanding", "Eine Lücke in der Dauerverteilung trennt Fahrten von "
                                 "Rückgabeproblemen. Sackgasse: die Geschwindigkeit"],
        ["3 Data Preparation", "Sechs Merkmale; distanz_km bleibt draußen, weil ein "
                               "fehlender Sensor kein auffälliger Vorgang ist"],
        ["4 Modeling", "Interquartilsregel unbrauchbar (über 2.000 Treffer), dann "
                       "Isolation Forest — der die Preisklasse fand"],
        ["5 Evaluation", "Bei beiden Aufgaben schlägt eine Regel das Modell: 90 % "
                         "gegen 28 % und 32 % gegen 14 %"],
        ["6 Deployment", "Zwei Regeln und eine Tagesliste — jede für die Sorte "
                         "Auffälligkeit, für die sie taugt"],
    ], y=unter_intro(s), spalten_b=[230, 673.5], zeilen_h=42)
    notizen(s, "Zwei Sätze aus diesem Notebook gehören an die Tafel: „Sehen Sie sich "
               "immer die Extremfälle an, die ein Modell meldet.“ Und: „Kein Verfahren "
               "kann Information erzeugen, die in den Daten nicht steckt.“")


# ═══════════════════════════════════════════════════ Teil D — Synthese

def teil_synthese(prs):
    AKTUELLES_NB[0] = None
    kapitel(prs, 8, "Synthese",
            "Was war in allen sechs Fällen gleich — und was hat jeder einzelne "
            "über den Kreislauf gelehrt?",
            "Zum Abschluss legen wir die sechs Fälle zurück auf die Karte aus "
            "Kapitel 1. Jetzt ist sie nicht mehr abstrakt.")

    s = folie(prs, "Synthese", "Sechs Fälle, sechs Blickwinkel auf denselben Kreislauf",
              "Die Tabelle aus Kapitel 1 — jetzt ausgefüllt mit dem, was wir "
              "unterwegs gesehen haben.")
    tabelle(s, ["Fall", "Zeigt", "Der Satz, der bleibt"], [
        ["1 Regression", "Phase 5", "Der Rücksprung kam, obwohl das Kriterium hielt — "
                                    "ein Mittelwert ist keine Erfahrung"],
        ["2 Klassifikation", "Phase 6", "Der scheinbare Modellvorsprung war ein "
                                        "Defekt im Merkmal, gegen das er antrat"],
        ["3 Clustering", "Phase 1", "Erfolgskriterien ohne Zielgröße — und eine bessere "
                                    "Frage als die, mit der wir anfingen"],
        ["4 Zeitreihe", "Phase 3", "Der Schnitt folgt der Zeit. Und die genaueste "
                                   "Prognose ist nicht die günstigste"],
        ["5 Assoziation", "Phase 5", "Keine der 32 Regeln überlebt — die stärkste "
                                     "scheitert um 0,01 Prozentpunkte"],
        ["6 Anomalie", "Rücksprung", "Zweimal schlägt eine Zeile Fachwissen das "
                                     "Verfahren — weil vorher keine Baseline stand"],
    ], y=unter_intro(s), spalten_b=[170, 110, 623.5], zeilen_h=42)
    notizen(s, "Gehen Sie die sechs Zeilen einzeln durch und lassen Sie die "
               "Studierenden sagen, an welcher Stelle im jeweiligen Notebook das "
               "stand. Wer das kann, hat den Kreislauf verstanden.")

    s = folie(prs, "Synthese", "Fünf Dinge, die in allen sechs Fällen gleich waren",
              "Unabhängig vom Verfahren, unabhängig von der Frage — diese fünf "
              "Schritte kamen jedes Mal vor.")
    streifen(s, [
        ("Kriterium vor den Daten", "In allen sechs Fällen stand die Hürde fest, "
                                    "bevor jemand ein Modell gerechnet hat"),
        ("Ein Maßstab zuerst", "Nullmodell, Faustregel oder Interquartilsregel — "
                               "immer erst der billige Vergleich"),
        ("Die Fälle ansehen", "In jedem Fall brachte der Blick auf einzelne Zeilen "
                              "etwas, das keine Kennzahl gezeigt hätte"),
        ("Fehlerkosten benennen", "Wo die beiden Fehlerrichtungen ungleich teuer "
                                  "sind, gehört das ins Modell — nicht in die Diskussion"),
        ("Den Rücksprung aushalten", "Vier der sechs Fälle enden mit einem benannten "
                                     "Weg zurück statt mit einem Haken"),
    ], y=unter_intro(s), hoehe=56, luecke=8, chip_b=0)
    notizen(s, "Diese fünf Punkte sind das eigentliche Lernziel des Blocks. Die "
               "Verfahren kann man nachschlagen; diese Reihenfolge muss man sich "
               "angewöhnen.")

    s = folie(prs, "Synthese", "Wo die Zeit tatsächlich hingeht",
              "Zählt man die Codezellen der sechs Notebooks nach Phasen, ergibt "
              "sich dasselbe Bild wie in echten Projekten.")
    kachelreihe(s, [
        ("Phasen 1 bis 3", [
            "Frage schärfen, Daten ansehen,",
            "Merkmale bauen.",
            "",
            "Der weitaus größte Teil —",
            "und der, den man beim Lesen",
            "am liebsten überspringt.",
        ]),
        ("Phase 4", [
            "Das Modellieren.",
            "",
            "In jedem der sechs Notebooks",
            "ein knappes Kapitel, oft",
            "wenige Zeilen Code.",
            "",
            "Nicht die Hauptsache.",
        ]),
        ("Phasen 5 und 6", [
            "Bewerten und ausliefern.",
            "",
            "Der Teil, der in Lehrbüchern",
            "fehlt — und der über Erfolg",
            "oder Misserfolg im Betrieb",
            "entscheidet.",
        ]),
    ], y=unter_intro(s), hoehe=200)
    notizen(s, "Wenn die Studierenden aus diesem Block eine Sache mitnehmen: Der "
               "spannende Teil ist nicht der, den man erwartet. Wer Data Science "
               "lernt, um Modelle zu bauen, verbringt 70 Prozent seiner Zeit mit "
               "etwas anderem.")

    s = folie(prs, "Synthese", "Die Notebooks — und wie sie weiterhelfen",
              "Zu jedem der sechs Fälle gibt es zwei Fassungen: eine vollständig "
              "gerechnete und eine mit Lücken zum Selbstausfüllen.")
    tabelle(s, ["", "Vorführfassung", "Übungsfassung"], [
        ["Ablage", "analytics/notebooks/", "analytics/notebooks/uebung/"],
        ["Ausgaben", "vollständig eingebettet, sofort lesbar", "leer — sie entstehen "
                                                               "beim Rechnen"],
        ["Code", "vollständig", "an den Kernstellen ausgeschnitten"],
        ["Aufgaben", "keine", "1 bis 4 je Notebook, an der jeweils lehrreichsten Stelle"],
        ["Struktur", "sechs Phasen als Überschriften", "identisch — auch die "
                                                        "Übungsfassung führt durch alle sechs"],
    ], y=unter_intro(s), spalten_b=[140, 400, 363.5], zeilen_h=42)
    notizen(s, "Empfehlen Sie, die Vorführfassung zu lesen und die Übungsfassung zu "
               "rechnen. Beide tragen dieselbe Phasenstruktur, sodass man beim "
               "Steckenbleiben in der einen die Antwort in der anderen findet.")

    s = folie(prs, "Synthese", "Acht Sätze, die diesen Block tragen")
    streifen(s, [
        ("Erst die Frage", "Ein Erfolgskriterium, das nach dem Ergebnis entsteht, "
                           "ist keins"),
        ("Dann der Maßstab", "Wer das Nullmodell nicht schlägt, hat nichts gewonnen"),
        ("Leakage prüfen", "Was weiß ich zum Zeitpunkt der Vorhersage wirklich?"),
        ("Kosten sind ungleich", "Fast nie sind beide Fehlerrichtungen gleich teuer"),
        ("Kennzahlen trennen", "Technische Güte und fachliches Urteil sind zwei Dinge"),
        ("Die Fälle ansehen", "Eine Kennzahl sagt, wie gut. Nur der Blick sagt, woran"),
        ("Einfach schlägt stark", "Bei Gleichstand gewinnt, was man erklären kann"),
        ("Zurück ist normal", "Der Rücksprung ist das Verfahren, nicht sein Scheitern"),
    ], y=unter_intro(s), hoehe=36, luecke=4, chip_b=0)
    notizen(s, "Diese acht Sätze fassen die sechs Fälle zusammen. Keiner davon ist "
               "verfahrensspezifisch — sie gelten für die Regression genauso wie für "
               "die Anomalieerkennung. Das ist der Sinn eines Vorgehensmodells.")

    s = folie(prs, "Ausblick", "Was dieser Block nicht behandelt hat",
              "Damit klar ist, wo die Grenzen liegen — und was ein nächster Schritt "
              "wäre.")
    tabelle(s, ["Thema", "Warum es hier fehlt"], [
        ["Neuronale Netze", "Bei diesen Datenmengen und Fragestellungen ohne Vorteil "
                            "gegenüber den gezeigten Verfahren — und deutlich schwerer "
                            "zu erklären"],
        ["Hyperparameter-Suche", "Systematisches Durchprobieren hätte die Ergebnisse "
                                 "leicht verbessert und den Blick auf das Vorgehen "
                                 "verstellt"],
        ["Produktivbetrieb", "Ausliefern heißt hier: eine Funktion und ein Plan. Echte "
                             "Bereitstellung, Versionierung und Überwachung sind ein "
                             "eigenes Feld"],
        ["Kausalität", "Alle sechs Fälle finden Zusammenhänge, keine Ursachen. Die "
                       "Störgröße in Fall 4 zeigt, wie schnell man das verwechselt"],
    ], y=unter_intro(s), spalten_b=[250, 653.5], zeilen_h=54)
    notizen(s, "Der letzte Punkt ist der wichtigste für die Berufspraxis. Ein Modell, "
               "das Zusammenhänge findet, wird im Unternehmen regelmäßig als Beleg "
               "für Ursachen gelesen. Fall 4 ist das beste Gegenbeispiel, das dieses "
               "Deck zu bieten hat.")



def baue() -> Presentation:
    prs = leere_praesentation()
    s = prs.slides.add_slide(lay(prs, "Frontpage_Digital"))
    for ph in s.placeholders:
        i = ph.placeholder_format.idx
        if i == 10:
            ph.text_frame.text = "CRISP-DM an sechs Fallbeispielen"
        elif i == 11:
            ph.text_frame.text = ("Sechs Datenprojekte bei VeloCity — und ein Vorgehen, "
                                  "das in allen sechs dasselbe ist")
    notizen(s, "Sechs Notebooks, sechs Verfahren, ein Vorgehensmodell. Wir laufen "
               "einen Fall vollständig durch und sehen an den fünf anderen, was "
               "jeweils anders ist.")
    rahmen(prs)
    teil_karte(prs)
    teil_referenzfall(prs)
    fall2(prs)
    fall3(prs)
    fall4(prs)
    fall5(prs)
    fall6(prs)
    teil_synthese(prs)
    return prs


if __name__ == "__main__":
    prs = baue()
    prs.save(str(ZIEL))
    print(f"{len(prs.slides.__iter__.__self__._sldIdLst)} Folien -> {ZIEL}")
