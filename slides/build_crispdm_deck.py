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
                         Fall 2 -> Phase 6  ausgeliefert wird die Regel
                         Fall 3 -> Phase 1  Kriterien ohne Zielgroesse
                         Fall 4 -> Phase 3  Schnitt entlang der Zeit
                         Fall 5 -> Phase 5  von 42 Regeln bleibt eine
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


def folie(prs, kicker, titel, intro=None, quelle=Q):
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
    pfad = ASSETS / f"{name}.png"
    if not pfad.exists():
        raise SystemExit(
            f"Bild fehlt: {pfad}\n"
            "Zuerst: python3 tools/notebook_ausschnitte.py "
            "und bash tools/render_diagrams.sh")
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


def streifen(s, zeilen, **kw):
    """regel_streifen, das auch Zweiertupel annimmt.

    Das Motiv erwartet (Regel, Wirkung, Beispielchip). Der Chip traegt
    hier meist nichts bei - die Wirkung steht schon im Fliesstext -,
    deshalb darf er entfallen.
    """
    regel_streifen(s, [z if len(z) == 3 else (z[0], z[1], "") for z in zeilen], **kw)


def rahmen(prs):
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
                       "2. MAE liegt bei 0,91 €",
                       "3. „Unter einem Euro — ordentlich.“",
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
                       "3. 0,91 € — Kriterium gerissen",
                       "",
                       "Genau so steht es in Notebook 1.",
                       "Und deshalb ist das Ergebnis dort",
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
        ["1", "Regression", "alle sechs", "Die gemittelte Kennzahl verdeckt, dass ein "
                                          "Drittel besteht"],
        ["2", "Klassifikation", "Phase 6", "Ausgeliefert wird die Regel, nicht das Modell"],
        ["3", "Clustering", "Phase 1", "Erfolgskriterien auch ohne Zielgröße"],
        ["4", "Zeitreihe", "Phase 3", "Die genaueste Prognose ist nicht die günstigste"],
        ["5", "Assoziation", "Phase 5", "Von 42 Regeln erfüllt genau eine beide Hürden"],
        ["6", "Anomalie", "Rücksprung", "Kein Verfahren erzeugt Information, die in den "
                                        "Daten nicht steckt"],
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
    kapitel(prs, 2, "Fall 1 — Regression: der volle Durchlauf",
            "Wie lange dauert diese Fahrt — und reicht die Schätzung, um vorher "
            "einen Preis anzuzeigen?",
            "Dieses Kapitel ist das Rückgrat des Decks. Es läuft alle sechs Phasen "
            "vollständig durch, mit den echten Zahlen aus Notebook 1. Die Regression "
            "ist bewusst gewählt: Sie ist das vertrauteste Verfahren, deshalb bleibt "
            "die Aufmerksamkeit beim VORGEHEN statt beim Verfahren. Alle folgenden "
            "Fälle setzen dieses Kapitel voraus.")

    s = folie(prs, "Fall 1", "Der Fall auf einen Blick",
              "Bevor wir loslaufen: wohin die Reise geht. Das Urteil steht hier "
              "schon — die interessante Frage ist, wie man dorthin kommt.")
    steckbrief(s, [
        ("Geschäftsfrage", "Kann VeloCity beim Entsperren anzeigen, was die Fahrt "
                           "kosten wird?"),
        ("Analytisches Ziel", "Fahrtdauer in Minuten schätzen, aus dem, was beim "
                              "Entsperren bekannt ist"),
        ("Erfolgskriterium", "Mittlerer Preisfehler unter 50 Cent — festgelegt vor "
                             "dem ersten Blick in die Daten"),
        ("Daten", "rund 60.000 Fahrten aus drei Jahren, dazu Wetter und Kalender"),
        ("Verfahren", "Nullmodell, lineare Regression, Entscheidungsbaum, Random Forest"),
        ("Urteil", "Ein Drittel der Flotte besteht, zwei Drittel nicht — und das "
                   "sieht man nur getrennt"),
    ], y=unter_intro(s))
    notizen(s, "Sagen Sie das Urteil ruhig vorweg. Es nimmt keine Spannung — im "
               "Gegenteil: Die Studierenden hören danach aufmerksamer zu, weil sie "
               "wissen, dass es nicht glattgeht.")

    # ─────────────────────────────────────────────── Phase 1
    s = folie(prs, "Phase 1 · Business Understanding", "Vom Wunsch zur Zahl",
              "„Der Kunde soll vorher wissen, was es kostet.“ Das ist ein Wunsch, "
              "kein Auftrag. Aus ihm wird in drei Schritten etwas Messbares.")
    prozesskette(s, "Wunsch", [
        ("Geschäfts-\nziel", ""), ("Analytisches\nZiel", ""),
        ("Erfolgs-\nkriterium", ""), ("Fehler-\nkosten", ""),
    ], "Messbar", y=unter_intro(s) + 6, hoehe=84)
    sandkarte(s, "Die drei Schritte an diesem Fall",
              ["Geschäftsziel: Beim Entsperren steht eine Preisangabe auf dem Bildschirm.",
               "Analytisches Ziel: Die DAUER schätzen — der Preis folgt daraus über das Tarifblatt.",
               "Erfolgskriterium: Die Angabe liegt im Mittel unter 50 Cent daneben."],
              y=unter_intro(s) + 106)
    phasenleiste(s, 1)
    notizen(s, "Der Sprung vom Preis zur Dauer ist die eigentliche Modellierungs"
               "entscheidung dieser Phase, und sie fällt hier, nicht in Phase 4. "
               "Den Preis direkt zu schätzen wäre schlechter: Das Tarifblatt ist "
               "bekannt und exakt — man schätzt nie, was man ausrechnen kann.")

    s = folie(prs, "Phase 1 · Business Understanding",
              "Dieselbe Grenze bedeutet für jedes Rad etwas anderes",
              "50 Cent Preistoleranz — geteilt durch den Minutenpreis ergibt das die "
              "erlaubte Abweichung in Minuten. Und die fällt dramatisch verschieden aus.")
    tabelle(s, ["Radtyp", "Minutenpreis", "Erlaubte Abweichung", "Was das heißt"], [
        ["CITY", "0,10 €", "5,0 Minuten", "komfortabel — hier ist Spielraum"],
        ["EBIKE", "0,25 €", "2,0 Minuten", "eng"],
        ["CARGO", "0,50 €", "1,0 Minuten", "praktisch unerreichbar"],
    ], y=unter_intro(s), spalten_b=[130, 150, 220, 403.5], zeilen_h=44)
    sandband(s, "Diese Tabelle entscheidet den ganzen Fall — und sie steht in Phase 1, "
                "lange bevor ein Modell gerechnet wurde. Wer sie überspringt, wundert "
                "sich in Phase 5 über ein Ergebnis, das er nicht deuten kann.",
             y=unter_intro(s) + 190)
    phasenleiste(s, 1)
    notizen(s, "Hier lohnt eine Minute Stille. Die Studierenden sollen selbst darauf "
               "kommen, dass eine EINZIGE Preisgrenze zu drei verschiedenen "
               "Anforderungen an dasselbe Modell führt. Das ist der Kern von Phase 1: "
               "Die Fachlichkeit bestimmt die Messlatte, nicht die Statistik.")

    zellfolie(prs, 1, "1 — Erfolgskriterien", "Phase 1 · im Notebook",
              "Die Umrechnung, Zeile für Zeile",
              "nb1-kriterium",
              "Drei Zeilen Code — und aus einer Preisgrenze werden drei verschiedene "
              "Anforderungen an dasselbe Modell.",
              "Das ist die Zelle, aus der die Tabelle der letzten Folie stammt. Zeigen "
              "Sie auf die Division: grenze_eur geteilt durch preis_pro_minute_eur. "
              "Mehr steckt nicht dahinter — und genau diese drei Zeilen entscheiden "
              "am Ende über das Urteil des ganzen Projekts.")

    s = folie(prs, "Phase 1 · Business Understanding",
              "Erfolgskriterien werden festgelegt, bevor jemand die Daten sieht")
    vorher_nachher(s,
                   ("Was passiert wäre", "Kriterium nach dem Ergebnis", [
                       "MAE 4,58 Minuten, R² 0,754.",
                       "",
                       "„Drei Viertel der Streuung erklärt —",
                       "das ist ein gutes Modell.“",
                       "",
                       "Stimmt sogar. Nur beantwortet es",
                       "die Frage nicht, die gestellt war.",
                   ], False),
                   ("Was tatsächlich steht", "Kriterium vor den Daten", [
                       "„Unter 50 Cent Preisfehler.“",
                       "",
                       "Daraus: 5,0 / 2,0 / 1,0 Minuten",
                       "je nach Radtyp.",
                       "",
                       "Erst diese Grenze macht aus einem",
                       "guten R² ein brauchbares oder ein",
                       "unbrauchbares Ergebnis.",
                   ], False),
                   y=unter_intro(s), hoehe=210)
    phasenleiste(s, 1)
    notizen(s, "R² 0,754 ist für sozialwissenschaftliche Verhältnisse hervorragend. "
               "Und trotzdem reicht es für zwei von drei Radtypen nicht. Genau diese "
               "Diskrepanz ist der Grund, warum Phase 1 nicht übersprungen werden darf.")

    s = folie(prs, "Phase 1 · Business Understanding",
              "Was in dieser Phase noch entschieden wird")
    kachelreihe(s, [
        ("Fehlerkosten", [
            "Ist Unterschätzen so schlimm",
            "wie Überschätzen?",
            "Hier: ja, beide Richtungen",
            "ärgern gleich. In Fall 2 und 4",
            "ist das anders — dort steht",
            "ein Preisschild an jeder Seite.",
        ]),
        ("Datenzugang", [
            "Was ist zum Zeitpunkt der",
            "Vorhersage tatsächlich",
            "bekannt?",
            "Beim Entsperren: Station,",
            "Uhrzeit, Radtyp, Wetter.",
            "Sonst nichts.",
        ]),
        ("Abbruchkriterium", [
            "Wann sagen wir ehrlich,",
            "dass es nicht geht?",
            "Hier: Wenn auch nach einem",
            "Rücksprung kein Radtyp die",
            "Grenze hält, wird die Anzeige",
            "nicht gebaut.",
        ]),
    ], y=unter_intro(s), hoehe=196)
    phasenleiste(s, 1)
    notizen(s, "Der dritte Punkt fehlt in fast allen Lehrbeispielen. Ein Projekt "
               "braucht eine verabredete Abbruchbedingung, sonst läuft es endlos "
               "weiter, weil immer noch ein Verfahren übrig ist, das man probieren "
               "könnte.")

    # ─────────────────────────────────────────────── Phase 2
    s = folie(prs, "Phase 2 · Data Understanding", "Erst sehen, dann rechnen",
              "In dieser Phase wird nichts modelliert. Es wird beschrieben, "
              "erkundet und geprüft — in dieser Reihenfolge.")
    streifen(s, [
        ("2.1 Beschaffen", "Sieben CSV-Dateien, kein Zugriff auf die Produktivdatenbank"),
        ("2.2 Beschreiben", "Wie viele Zeilen, welche Spalten, wo sind Lücken?"),
        ("2.3 Zielgröße", "Zuerst die Dauer selbst ansehen — Verteilung, Ausläufer, Schiefe"),
        ("2.4 Zusammenhänge", "Welche Merkmale trennen? Station, Stunde und Tagesart deutlich"),
    ], y=unter_intro(s), hoehe=54, luecke=8, chip_b=250)
    phasenleiste(s, 2)
    notizen(s, "Die Reihenfolge ist kein Zufall: erst die Zielgröße allein, dann ihr "
               "Verhältnis zu den Merkmalen. Wer mit Korrelationsmatrizen anfängt, "
               "übersieht, dass die Zielgröße rechtsschief ist — und das entscheidet "
               "später über die Modellwahl.")

    s = folie(prs, "Phase 2 · Data Understanding",
              "Zwei Qualitätsbefunde — und die Frage, ob sie Fehler sind",
              "Nicht jede Auffälligkeit ist ein Fehler. Der Unterschied entscheidet "
              "darüber, ob man bereinigt oder ob man etwas gelernt hat.")
    tabelle(s, ["Befund", "Umfang", "Fehler oder Erkenntnis?"], [
        ["Fahrten ohne Distanzangabe", "42 %",
         "Erkenntnis: Nicht jedes Rad hat den Sensor. Die Spalte darf deshalb kein "
         "Pflichtmerkmal werden — sie fehlt bei zwei von fünf Fahrten"],
        ["Vorgänge unter einer Minute", "2,7 %",
         "Fehler: Das sind keine Fahrten, sondern Fehlentsperrungen. Sie werden "
         "begründet ausgeschlossen — mit Zeilenzahl davor und danach"],
    ], y=unter_intro(s), spalten_b=[240, 90, 573.5], zeilen_h=72)
    phasenleiste(s, 2)
    notizen(s, "Das ist die wichtigste Unterscheidung dieser Phase. Die 42 Prozent "
               "sehen aus wie ein Datenqualitätsproblem und sind in Wahrheit eine "
               "Aussage über die Flotte. Wer sie wegbereinigt, verliert 42 Prozent "
               "der Daten für nichts.")

    s = folie(prs, "Phase 2 · Data Understanding",
              "Die Zielgröße ist rechtsschief — und das hat Folgen")
    kachelreihe(s, [
        ("Was man sieht", [
            "Die meisten Fahrten sind kurz.",
            "Ein langer Ausläufer nach rechts:",
            "wenige sehr lange Fahrten.",
            "",
            "Mittelwert und Median fallen",
            "deutlich auseinander.",
        ]),
        ("Warum das zählt", [
            "Der mittlere absolute Fehler",
            "behandelt eine Abweichung von",
            "5 Minuten bei einer 10-Minuten-",
            "Fahrt genauso wie bei einer",
            "Stunde — fachlich ist das",
            "aber nicht dasselbe.",
        ]),
        ("Was daraus folgt", [
            "Vermerkt für Phase 3 und für",
            "den Rücksprung: Ein Modell auf",
            "dem Logarithmus der Dauer",
            "träfe solche Verteilungen",
            "oft besser.",
            "Eine Zeile, große Wirkung.",
        ]),
    ], y=unter_intro(s), hoehe=196)
    phasenleiste(s, 2)
    notizen(s, "Hier entsteht schon in Phase 2 ein Vermerk für einen möglichen "
               "Rücksprung. Genau so soll es sein: Man notiert die Beobachtung, "
               "handelt aber noch nicht — sonst optimiert man ins Blaue.")

    s = folie(prs, "Phase 2 · Data Understanding",
              "Was die Erkundung über die Merkmale sagt",
              "Die späteren Koeffizienten der linearen Regression bestätigen, was "
              "hier schon sichtbar wird — in Minuten je Einheit.")
    tabelle(s, ["Merkmal", "Wirkung auf die Dauer", "Deutung"], [
        ["Wochenende", "+ 8,8 Minuten", "Freizeitfahrten sind länger als Pendelfahrten"],
        ["Feiertag", "+ 7,3 Minuten", "derselbe Effekt, noch stärker"],
        ["Start Residenz", "+ 8,6 Minuten", "touristischer Ausgangspunkt"],
        ["Start Zellerau", "− 10,2 Minuten", "Wohngebiet, kurze Wege in die Stadt"],
        ["Radtyp EBIKE", "− 3,4 Minuten", "schneller unterwegs, gleiche Strecke"],
    ], y=unter_intro(s), spalten_b=[210, 190, 503.5], zeilen_h=38)
    phasenleiste(s, 2)
    notizen(s, "Diese Zahlen sind nicht nur Modellausgabe, sie sind ein Plausibilitäts"
               "test. Wenn hier etwas stünde, das dem Betriebswissen widerspricht, "
               "wäre das ein Grund, die Daten noch einmal anzusehen — nicht das "
               "Betriebswissen zu verwerfen.")

    # ─────────────────────────────────────────────── Phase 3
    s = folie(prs, "Phase 3 · Data Preparation",
              "Die gefährlichste Falle des ganzen Kreislaufs",
              "Leakage: Merkmale, die im Training vorhanden sind, zum Zeitpunkt der "
              "Vorhersage aber noch gar nicht existieren. Das Modell wird großartig — "
              "und im Betrieb unbrauchbar.")
    vorher_nachher(s,
                   ("Verlockend", "Was in den Daten steht", [
                       "endzeit",
                       "distanz_km",
                       "zielstation",
                       "",
                       "Alle drei sagen die Dauer",
                       "hervorragend voraus.",
                       "R² ginge Richtung 1,0.",
                   ], True),
                   ("Zulässig", "Was beim Entsperren bekannt ist", [
                       "startstation, startzeit",
                       "typ_code",
                       "temperatur, niederschlag",
                       "ist_wochenende, ist_feiertag",
                       "",
                       "Die Endzeit kennt man erst,",
                       "wenn die Fahrt vorbei ist.",
                   ], True),
                   y=unter_intro(s), hoehe=216)
    phasenleiste(s, 3)
    notizen(s, "Die Probe aufs Exempel: Stellen Sie sich vor, die App soll den Preis "
               "anzeigen, während der Kunde noch am Rad steht. Woher soll sie die "
               "Zielstation kennen? Genau diese Frage — was weiß ich JETZT? — ist der "
               "Leakage-Test. Er braucht keine Statistik, nur gesunden Menschenverstand.")

    s = folie(prs, "Phase 3 · im Notebook", "Wann weiß man was? Der Leakage-Test",
              "Die Frage ist nicht statistisch, sondern zeitlich: Was steht in dem "
              "Moment zur Verfügung, in dem die Anzeige erscheinen soll?",
              quelle=nbq(1, "3.1"))
    diagramm(s, bild("nb1-leakage"), y=unter_intro(s), hoehe=ZONE_UNTEN - unter_intro(s) - 34)
    notizen(s, "Grün, was beim Entsperren bekannt ist. Rot, was erst beim Abstellen "
               "entsteht. Der Test braucht keine Statistik — nur die Frage, wann der "
               "Wert entsteht. Wer sie stellt, findet Leakage zuverlässig.")

    zellfolie(prs, 1, "3.1", "Phase 3 · im Notebook",
              "Die gesperrten Spalten, im Klartext",
              "nb1-leakage",
              "Im Notebook stehen die drei gesperrten Spalten mit Begründung — nicht "
              "kommentarlos weggelassen, sondern benannt.",
              "Lassen Sie die Studierenden die drei Namen vorlesen. Wer sie später in "
              "einem eigenen Projekt versehentlich verwendet, erinnert sich an diese "
              "Zelle.")

    s = folie(prs, "Phase 3 · Data Preparation",
              "Jeder Filter mit Zeilenzahl davor und danach",
              "Drei begründete Ausschlüsse. Wer nicht mitzählt, merkt nicht, wenn ein "
              "Filter die halbe Datenmenge frisst.")
    tabelle(s, ["Filter", "Begründung"], [
        ["Vorgänge unter 1 Minute", "Fehlentsperrungen, keine Fahrten — 2,7 % der Zeilen"],
        ["Fahrten über 24 Stunden", "Rückgabeprobleme, ein anderer Sachverhalt"],
        ["Ausgemusterte Räder", "Ihre Fahrten stammen aus einem anderen Flottenzustand"],
    ], y=unter_intro(s), spalten_b=[300, 603.5], zeilen_h=44)
    sandband(s, "Ein Filter ohne Zeilenzahl ist eine Behauptung. Mit Zeilenzahl ist er "
                "ein nachprüfbarer Schritt — und genau daran erkennt man in einem "
                "fremden Notebook, ob sorgfältig gearbeitet wurde.",
             y=unter_intro(s) + 180)
    phasenleiste(s, 3)
    notizen(s, "Empfehlen Sie den Studierenden, das in ihren eigenen Notebooks zur "
               "Gewohnheit zu machen: vor jedem Filter len(df), danach len(df). Es "
               "kostet eine Zeile und rettet ganze Projekte.")

    s = folie(prs, "Phase 3 · Data Preparation",
              "Aus einem Zeitstempel werden fünf Merkmale",
              "Merkmale bauen heißt: dem Verfahren das zeigen, was ein Mensch in den "
              "Daten sieht. Ein Zeitstempel allein sagt einem Modell nichts.")
    kachelreihe(s, [
        ("Aus der Zeit", [
            "stunde  — 0 bis 23",
            "wochentag — 0 bis 6",
            "monat — Jahresgang",
            "ist_wochenende",
            "ist_feiertag",
        ]),
        ("Aus dem Wetter", [
            "temperatur",
            "niederschlag",
            "",
            "Angejoint über das Datum,",
            "aus echten ERA5-Daten",
            "für Würzburg.",
        ]),
        ("Kodieren", [
            "Station und Radtyp sind",
            "Kategorien, keine Zahlen.",
            "",
            "One-Hot: aus einer Spalte",
            "mit zehn Werten werden",
            "zehn Ja-Nein-Spalten.",
        ]),
    ], y=unter_intro(s), hoehe=190)
    phasenleiste(s, 3)
    notizen(s, "Der Hinweis auf One-Hot lohnt: Würde man die Stationen von 1 bis 10 "
               "durchnummerieren, unterstellte man dem Modell eine Ordnung, die es "
               "nicht gibt — Station 8 wäre dann „mehr“ als Station 4.")

    s = folie(prs, "Phase 3 · Data Preparation",
              "Aufteilen — und warum es hier zufällig sein darf")
    vorher_nachher(s,
                   ("In diesem Fall", "Zufälliger Schnitt, 80/20", [
                       "Die Frage lautet: Wie lange",
                       "dauert DIESE Fahrt?",
                       "",
                       "Es wird nichts über die Zukunft",
                       "ausgesagt, sondern über eine",
                       "einzelne Fahrt mit bekannten",
                       "Umständen. Zufällig ist zulässig.",
                   ], False),
                   ("In Fall 2 und 4", "Schnitt entlang der Zeit", [
                       "Dort lautet die Frage: Was",
                       "passiert MORGEN?",
                       "",
                       "Ein zufälliger Schnitt ließe das",
                       "Modell aus der Zukunft lernen.",
                       "Das Ergebnis wäre glänzend",
                       "und wertlos.",
                   ], False),
                   y=unter_intro(s), hoehe=216)
    phasenleiste(s, 3)
    notizen(s, "Diese Folie greift vor. Das ist Absicht: Die Studierenden sollen "
               "wissen, dass die Antwort auf „wie teilt man auf?“ von der Frage "
               "abhängt und nicht vom Verfahren. In Fall 4 kommen wir darauf zurück.")

    # ─────────────────────────────────────────────── Phase 4
    s = folie(prs, "Phase 4 · Modeling",
              "Zuerst das Nullmodell — sonst weiß man nicht, was man gewonnen hat",
              "Das Nullmodell tippt immer den Mittelwert. Es ist absichtlich dumm. "
              "Seine Zahl ist der Maßstab, an dem alles andere gemessen wird.")
    tabelle(s, ["Modell", "MAE (Min)", "R²", "Was es bedeutet"], [
        ["Nullmodell (immer der Mittelwert)", "11,58", "−0,000", "der Maßstab"],
        ["Lineare Regression", "5,93", "0,655", "die Hälfte des Fehlers weg"],
        ["Entscheidungsbaum (Tiefe 8)", "4,88", "0,729", "nichtlineare Zusammenhänge"],
        ["Random Forest (200 Bäume)", "4,58", "0,754", "das beste — 60,4 % besser als null"],
    ], y=unter_intro(s), spalten_b=[300, 100, 90, 413.5], zeilen_h=40)
    phasenleiste(s, 4)
    notizen(s, "R² des Nullmodells ist −0,000, nicht 0,000 — ein Rundungsartefakt, das "
               "zeigt, dass es auf der Testmenge minimal schlechter ist als der dortige "
               "Mittelwert. Das ist normal und ein gutes Zeichen dafür, dass die "
               "Testmenge wirklich unberührt war.")

    zellfolie(prs, 1, "4.3", "Phase 4 · im Notebook",
              "Der Modellvergleich, wie er im Notebook steht",
              "nb1-modelle",
              "Vier Zeilen, von oben nach unten immer besser — und die oberste ist "
              "absichtlich dumm.",
              "Die Tabelle wächst im Notebook Zelle für Zelle: erst das Nullmodell "
              "allein, dann kommt die lineare Regression dazu, dann Baum und Wald. "
              "Diese Reihenfolge ist der Grund, warum man am Ende sagen kann, wieviel "
              "jeder Schritt gebracht hat.")

    s = folie(prs, "Phase 4 · Modeling",
              "Vom Durchschaubaren zum Stärkeren, nicht umgekehrt")
    prozesskette(s, "Null-\nmodell", [
        ("Lineare\nRegression", ""), ("Entscheidungs-\nbaum", ""),
        ("Random\nForest", ""),
    ], "Bestes\nModell", y=unter_intro(s) + 10, hoehe=90)
    sandkarte(s, "Warum diese Reihenfolge",
              ["Die lineare Regression liefert Koeffizienten, die man LESEN kann — "
               "„Wochenende: +8,8 Minuten“.",
               "Der Wald ist stärker, aber stumm. Wer mit ihm anfängt, verliert die "
               "Möglichkeit zu prüfen, ob das Modell fachlich Sinn ergibt.",
               "Und wenn der Abstand klein bleibt, gewinnt das einfachere Modell — "
               "siehe Fall 2, wo genau das passiert."],
              y=unter_intro(s) + 124)
    phasenleiste(s, 4)
    notizen(s, "Die Reihenfolge ist kein Ritual. Sie erzeugt bei jedem Schritt eine "
               "Information: Wieviel bringt Nichtlinearität? Wieviel bringt das "
               "Ensemble? Wer sofort den Wald rechnet, hat eine Zahl und keine Antwort.")

    s = folie(prs, "Phase 4 · Modeling",
              "Was die Koeffizienten verraten — und warum man sie ansieht",
              "Die lineare Regression ist hier nicht das beste Modell. Sie ist das "
              "Modell, das erklärt, was in den Daten steckt.")
    code_kacheln(s,
                 ("Die stärksten Verlängerer", [
                     "ist_wochenende        +8.78",
                     "startstation_Residenz +8.55",
                     "ist_feiertag          +7.30",
                     "startstation_Alte     +5.80",
                     "  Mainbruecke",
                 ], GRUEN_D),
                 ("Die stärksten Verkürzer", [
                     "startstation_Zellerau  -10.18",
                     "startstation_Grombuehl  -5.42",
                     "typ_code_EBIKE          -3.38",
                     "startstation_Sanderring -3.35",
                     "startstation_Marktplatz -3.05",
                 ], ROT_A),
                 y=unter_intro(s), hoehe=180)
    phasenleiste(s, 4)
    notizen(s, "Lesen Sie zwei davon laut vor und fragen Sie, ob das plausibel ist. "
               "Residenz und Alte Mainbrücke sind touristisch, Zellerau und Grombühl "
               "sind Wohn- und Klinikgebiet. Das Modell hat die Stadt gelernt, ohne "
               "je einen Stadtplan gesehen zu haben.")

    # ─────────────────────────────────────────────── Phase 5
    s = folie(prs, "Phase 5 · Evaluation",
              "Die technische Güte ist gut. Die Frage ist, ob sie reicht.",
              "MAE 4,58 Minuten, 60 Prozent besser als das Nullmodell. Ein "
              "zufriedenes Nicken — und genau hier hören die meisten Projekte auf.")
    sandkarte(s, "Was jetzt kommt, ist der entscheidende Schritt",
              ["Die 4,58 Minuten müssen in die Währung der Phase 1 übersetzt werden: in Euro.",
               "Minuten × Minutenpreis = Preisfehler. Und der Minutenpreis ist je Radtyp verschieden.",
               "Erst diese Umrechnung beantwortet die Frage, die tatsächlich gestellt war."],
              y=unter_intro(s))
    tabelle(s, ["Blickwinkel", "Ergebnis", "Urteil"], [
        ["Über alle Räder gemittelt", "0,91 € Preisfehler", "Kriterium gerissen"],
        ["Getrennt nach Radtyp", "CITY 0,464 € · EBIKE 1,01 € · CARGO 3,09 €",
         "einer besteht, zwei nicht"],
    ], y=unter_intro(s) + 130, spalten_b=[240, 340, 323.5], zeilen_h=44)
    phasenleiste(s, 5)
    notizen(s, "Lassen Sie die gemittelte Zahl kurz stehen, bevor Sie die zweite Zeile "
               "aufdecken. 0,91 € heißt: Projekt gescheitert, Anzeige wird nicht gebaut. "
               "Die getrennte Betrachtung dreht das Urteil für 53 Prozent aller Fahrten "
               "ins Gegenteil.")

    zellfolie(prs, 1, "5.2", "Phase 5 · im Notebook",
              "Die entscheidende Rechnung: Minuten werden zu Euro",
              "nb1-preisfehler",
              "Hier kippt das Projekt — und zwar nicht in der Statistik, sondern in "
              "der Umrechnung ins Preisblatt.",
              "Das ist die wichtigste Zelle des ganzen Notebooks. Bis hierher sah "
              "alles gut aus. Die Multiplikation mit dem Minutenpreis macht aus einem "
              "ordentlichen Modell ein Urteil — und das fällt je Radtyp anders aus.")

    s = folie(prs, "Phase 5 · Evaluation",
              "Die gemittelte Kennzahl hat ein bestehendes Drittel verdeckt",
              "Dies ist der wichtigste Satz des ganzen Falls — und er hat nichts mit "
              "Statistik zu tun, sondern mit dem Preisblatt.")
    ampel_matrix(s, ["unter 0,50 €"], [
        ("CITY — 0,464 € Preisfehler", [True],
         "Freigabe. Betrifft rund 53 % aller Fahrten"),
        ("EBIKE — 1,01 € Preisfehler", [False],
         "Rücksprung. Mehr als doppelt so hoch wie erlaubt"),
        ("CARGO — 3,09 € Preisfehler", [False],
         "Rücksprung. Die Punktschätzung ist hier die falsche Zusage"),
    ], y=unter_intro(s) + 26, zeilen_h=48, luecke=8, label_b=300)
    sandband(s, "CITY betrifft rund 53 % aller Fahrten — der Nutzen ist real. Wer nur "
                "auf MAE und R² schaut, sieht das nie: Die technische Kennzahl ist für "
                "alle drei Radtypen dieselbe, das fachliche Urteil ist es nicht.",
             y=unter_intro(s) + 192)
    phasenleiste(s, 5)
    notizen(s, "Das Modell ist für alle drei Radtypen gleich gut. Was sich "
               "unterscheidet, ist der Minutenpreis: 0,10 gegen 0,50 Euro. Derselbe "
               "Schätzfehler kostet beim Lastenrad das Fünffache. Die Statistik ist "
               "unschuldig — die Fachlichkeit entscheidet.")

    s = folie(prs, "Phase 5 · Evaluation", "Wo irrt das Modell? — Fehleranalyse",
              "Nicht nur WIE gut, sondern WORAN es scheitert. Eine Kennzahl sagt "
              "das erste, nur der Blick auf die Fälle sagt das zweite.")
    kachelreihe(s, [
        ("Der Befund", [
            "Lange Fahrten werden",
            "systematisch unterschätzt.",
            "",
            "Das Modell zieht alles zur",
            "Mitte — eine Eigenschaft",
            "aller Mittelwertverfahren.",
        ]),
        ("Die Erklärung", [
            "Die Zielgröße ist rechtsschief",
            "(Befund aus Phase 2).",
            "",
            "Was eine Fahrt lang macht,",
            "steht nicht in den Daten:",
            "Umwege, Pausen, Wetterwechsel.",
        ]),
        ("Die Folge", [
            "Für CARGO ist die",
            "Punktschätzung die falsche",
            "Zusage — nicht das falsche",
            "Modell.",
            "",
            "Das führt zum Rücksprung.",
        ]),
    ], y=unter_intro(s), hoehe=196)
    phasenleiste(s, 5)
    notizen(s, "Der Unterschied zwischen „falsches Modell“ und „falsche Zusage“ ist "
               "der Kern dieser Folie. Ein besseres Verfahren würde hier nichts "
               "retten — die Information fehlt in den Daten. Was hilft, ist eine "
               "andere Zusage.")

    s = folie(prs, "Phase 5 · Evaluation", "Das Urteil: weiter, zurück oder abbrechen")
    streifen(s, [
        ("CITY — weiter", "Kriterium erfüllt, Phase 6 für diesen Radtyp"),
        ("EBIKE — zurück", "1,01 € gegen 0,50 € — mehr als doppelt so hoch"),
        ("CARGO — zurück", "3,09 € — die Punktschätzung ist die falsche Zusage"),
        ("Nicht: Schwelle senken", "Die Grenze kam aus dem Produktmanagement. Sie "
                                   "nachträglich zu lockern hieße, das Kriterium "
                                   "abzuschaffen"),
    ], y=unter_intro(s), hoehe=54, luecke=8, chip_b=250)
    phasenleiste(s, 5, rueckspruenge=(1,))
    notizen(s, "Der vierte Streifen ist der wichtigste. Die Versuchung, die Schwelle "
               "auf 1,00 Euro zu setzen, ist groß und wäre in fünf Sekunden getan. "
               "Genau davor schützt die Regel, das Kriterium vor den Daten "
               "festzulegen — es gehört einem anderen, nämlich dem Fach.")

    s = folie(prs, "Phase 5 · Evaluation",
              "Der Rücksprung: nicht das Modell ändern, die Frage ändern",
              "Drei Wege zurück, jeder in eine andere Phase. So sieht ein "
              "Rücksprung konkret aus.")
    tabelle(s, ["Zurück nach", "Was sich ändert", "Warum"], [
        ["Phase 1", "Statt einer Zahl eine Spanne: „zwischen 4 und 9 €“",
         "Das ändert die Geschäftszusage — und damit das Verfahren: gefragt wären "
         "Quantile, nicht Mittelwerte"],
        ["Phase 2", "Neue Merkmale beschaffen: Steigungsprofil, Wetterumschwung",
         "Was eine Fahrt lang macht, steht heute nicht in den Daten"],
        ["Phase 3", "Modell auf dem Logarithmus der Dauer rechnen",
         "Trifft rechtsschiefe Verteilungen besser — eine Zeile, möglicherweise "
         "große Wirkung"],
    ], y=unter_intro(s), spalten_b=[110, 330, 463.5], zeilen_h=58)
    phasenleiste(s, 5, rueckspruenge=(1, 2, 3))
    notizen(s, "Beachten Sie die Reihenfolge der Kosten: Phase 3 ist eine Zeile "
               "Code, Phase 2 ist ein Beschaffungsprojekt, Phase 1 ist ein Gespräch "
               "mit dem Produktmanagement. Man beginnt mit dem Billigsten — aber man "
               "verschweigt die anderen nicht.")

    # ─────────────────────────────────────────────── Phase 6
    s = folie(prs, "Phase 6 · Deployment",
              "Ausgeliefert wird nicht das Modell, sondern ein Paket",
              "Ein gespeichertes Modell ohne seine Merkmalsliste ist wertlos — "
              "niemand weiß mehr, in welcher Reihenfolge die Spalten erwartet werden.")
    code_kacheln(s,
                 ("Was gespeichert wird", [
                     "paket = {",
                     "  'modell':   wald,",
                     "  'merkmale': spalten,",
                     "  'gilt_fuer': ['CITY'],",
                     "  'stand':    '2026-08-31',",
                     "}",
                 ], BLAU),
                 ("Warum jedes Feld", [
                     "modell    — das Gelernte",
                     "merkmale  — Reihenfolge und",
                     "            Namen der Spalten",
                     "gilt_fuer — NUR CITY ist",
                     "            freigegeben",
                     "stand     — wann veraltet es?",
                 ], TUERKIS),
                 y=unter_intro(s), hoehe=190)
    phasenleiste(s, 6)
    notizen(s, "Das Feld gilt_fuer ist die technische Umsetzung des Urteils aus "
               "Phase 5. Die Freigabe steht nicht in einer Aktennotiz, sondern im "
               "Paket selbst — so kann die Anwendung gar nicht auf die Idee kommen, "
               "das Modell für ein Lastenrad zu befragen.")

    s = folie(prs, "Phase 6 · Deployment",
              "Die Funktion, die der Entsperr-Dialog tatsächlich aufruft",
              "Ein Modell, das niemand aufruft, hat keinen Wert. Hier wird aus dem "
              "Gelernten eine Funktion mit einer klaren Schnittstelle.")
    code_kacheln(s,
                 ("Aufruf", [
                     "preis_schaetzen(",
                     "  station='Hauptbahnhof',",
                     "  zeitpunkt=jetzt,",
                     "  typ='CITY',",
                     ")",
                     "-> 'etwa 3,10 EUR'",
                 ], GRUEN_D),
                 ("Was die Funktion prüft", [
                     "1. Ist typ freigegeben?",
                     "   Sonst: keine Anzeige.",
                     "2. Merkmale in der",
                     "   gespeicherten Reihenfolge",
                     "3. Dauer -> Preis ueber das",
                     "   Tarifblatt, nicht geschaetzt",
                 ], ORANGE),
                 y=unter_intro(s), hoehe=190)
    phasenleiste(s, 6)
    notizen(s, "Punkt 3 ist eine Wiederholung der Entscheidung aus Phase 1: Der "
               "Preis wird gerechnet, nicht geschätzt. Geschätzt wird nur, was man "
               "nicht wissen kann — die Dauer.")

    s = folie(prs, "Phase 6 · Deployment",
              "Was nach der Auslieferung passieren muss",
              "Ein Modell ist kein Bauwerk, sondern ein Lebensmittel. Es hat ein "
              "Haltbarkeitsdatum, das niemand kennt — deshalb wird gemessen.")
    tabelle(s, ["Auslöser", "Schwelle", "Handlung"], [
        ["Laufende Messung", "unter 0,45 €", "alles in Ordnung"],
        ["", "0,45 bis 0,55 €", "beobachten, nicht handeln"],
        ["", "über 0,55 €", "nachtrainieren"],
        ["Tarifblatt ändert sich", "Minutenpreis neu",
         "Erfolgskriterium neu rechnen — die erlaubte Minuten-Toleranz hängt daran"],
    ], y=unter_intro(s), spalten_b=[220, 160, 523.5], zeilen_h=40)
    phasenleiste(s, 6)
    notizen(s, "Die letzte Zeile ist die feinste: Ändert VeloCity den Minutenpreis, "
               "ändert sich die erlaubte Minuten-Toleranz — und ein Modell, das "
               "gestern bestanden hat, fällt heute durch, ohne dass sich an ihm "
               "etwas geändert hätte. Das Erfolgskriterium hängt am Geschäft.")

    s = folie(prs, "Phase 6 · Deployment",
              "Der Testwert war optimistisch — und das ist der Normalfall",
              "Der Schattenbetrieb rechnet 30 Tage lang mit, ohne dem Kunden etwas "
              "anzuzeigen. Erst er sagt, was das Modell im Betrieb leistet.")
    tabelle(s, ["Messung", "Preisfehler", "Bewertung"], [
        ["Testmenge aus Phase 5", "0,464 €", "Kriterium erfüllt"],
        ["Schattenbetrieb, letzte 30 Tage", "0,493 €",
         "gerade eben gehalten — aber ohne jede Reserve"],
    ], y=unter_intro(s), spalten_b=[300, 150, 453.5], zeilen_h=44)
    sandkarte(s, "Warum der Testwert schöner ist als die Wirklichkeit", [
        "Die Testmenge ist ein zufälliger Schnitt durch drei Jahre — der "
        "Schattenbetrieb sind 30 zusammenhängende Tage.",
        "Die Ampel steht deshalb auf GELB: weiterlaufen lassen, noch nicht anzeigen.",
        "Die ehrliche Antwort ist nicht, die Schwelle zu senken, sondern weiter zu messen."],
        y=unter_intro(s) + 140)
    phasenleiste(s, 6)
    notizen(s, "Diese Folie ist Gold wert für die Berufspraxis. Fast jedes Modell "
               "wird im Betrieb schlechter als im Test. Wer das erwartet, plant einen "
               "Schattenbetrieb ein. Wer es nicht erwartet, erklärt später, warum die "
               "Zahlen in der Präsentation anders waren.")

    # ─────────────────────────────────────────────── Kreisschluss
    zellfolie(prs, 1, "6.4", "Phase 6 · im Notebook",
              "Der Schattenbetrieb, gerechnet statt behauptet",
              "nb1-schatten",
              "0,493 € gegen 0,464 € auf der Testmenge — die Ampel steht auf GELB, "
              "und das Notebook sagt es selbst.",
              "Beachten Sie die letzte Zeile der Ausgabe: Das Notebook stellt die "
              "Ampel selbst und begründet sie. Ein Bericht, der die Bewertung dem "
              "Leser überlässt, ist kein Bericht.")

    s = folie(prs, "Fall 1 · Abschluss", "Der Kreislauf schließt sich",
              "Sechs Phasen, ein Durchlauf, ein geteiltes Urteil — und drei "
              "benannte Wege zurück.")
    tabelle(s, ["Phase", "Was dabei herauskam"], [
        ["1 Business Understanding", "Aus „Preis vorher anzeigen“ wurde: unter 50 Cent "
                                     "— und daraus je Radtyp eine Minuten-Toleranz"],
        ["2 Data Understanding", "Die Daten tragen die Frage. Zwei Befunde: 42 % ohne "
                                 "Distanz, 2,7 % keine echten Fahrten"],
        ["3 Data Preparation", "Leakage vermieden, drei begründete Filter, Wetter und "
                               "Kalender angejoint"],
        ["4 Modeling", "Nullmodell als Maßstab, dann linear, Baum, Wald — 60,4 % besser"],
        ["5 Evaluation", "Gemittelt gerissen (0,91 €), getrennt besteht CITY (0,464 €)"],
        ["6 Deployment", "Paket, Funktion, Überwachung, Schattenbetrieb — GELB"],
    ], y=unter_intro(s), spalten_b=[230, 673.5], zeilen_h=40)
    notizen(s, "Diese Tabelle steht wörtlich am Ende von Notebook 1. Die Studierenden "
               "finden sie dort wieder — das ist Absicht: Folie und Notebook sollen "
               "sich decken, damit die Vorlesung und die Nacharbeit dieselbe Sprache "
               "sprechen.")


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
    kapitel(prs, 3, "Fall 2 — Klassifikation: wenn die Regel gewinnt",
            "Welche Räder müssen als Nächstes in die Werkstatt — und braucht es "
            "dafür überhaupt ein Modell?",
            "Dieser Fall zeigt Phase 6 von innen. Er endet mit einem Ergebnis, das "
            "in Lehrbüchern selten vorkommt: Das Modell wird gebaut, geprüft — und "
            "dann NICHT ausgeliefert, weil eine einzeilige Regel genauso gut ist.")

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
        ("Urteil", "Regel und Wald treffen gleich gut — ausgeliefert wird die Regel"),
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
              "1458 Trainingszeilen aus sieben Stichtagen, getestet am jüngsten — "
              "kein einziger Blick in die Zukunft.",
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

    s = folie(prs, "Fall 2 · Phase 5", "Gleichstand — und was das bedeutet",
              "Trefferquote und Kosten sind auf die zweite Stelle identisch. Das ist "
              "kein Zufall, sondern eine Aussage über die Aufgabe.")
    tabelle(s, ["Verfahren", "Trefferquote", "Kosten", "Aufwand"], [
        ["Regel A (Kilometerstand)", "70,0 %", "10.890 €", "eine Zeile"],
        ["Random Forest", "70,0 %", "10.890 €", "Training, Pflege, Überwachung"],
    ], y=unter_intro(s), spalten_b=[300, 150, 150, 303.5], zeilen_h=48)
    phasenleiste(s, 5)
    notizen(s, "Lassen Sie die Zahlen wirken. Studierende erwarten hier, dass der Wald "
               "gewinnt — er ist ja das stärkere Verfahren. Dass er es nicht tut, "
               "heißt: Der Verschleiß hängt fast ausschließlich an den gefahrenen "
               "Kilometern. Mehr Information steckt in den Daten nicht.")

    zellfolie(prs, 2, "5.4", "Phase 5 · im Notebook",
              "Der Gleichstand, gegen die Kriterien aus Phase 1 gehalten",
              "nb2-gleichstand",
              "Beide Kandidaten, beide Kriterien, eine Tabelle — und kein Unterschied.",
              "Das Notebook prüft hier ausdrücklich gegen die Kriterien, die in Phase 1 "
              "festgelegt wurden, und nicht gegen das, was sich gerade anbietet. "
              "Genau deshalb ist der Gleichstand ein Ergebnis und keine Enttäuschung.")

    s = folie(prs, "Fall 2 · Phase 6", "Ausgeliefert wird die Regel, nicht das Modell",
              "Bei Gleichstand gewinnt die einfachere Lösung. Das ist keine "
              "Bescheidenheit, sondern eine Kostenrechnung über die Lebensdauer.")
    vorher_nachher(s,
                   ("Das Modell", "Was seine Auslieferung kostet", [
                       "Trainingsdaten vorhalten",
                       "Regelmäßig nachtrainieren",
                       "Überwachen, ob es abdriftet",
                       "Erklären, warum Rad 47 auf",
                       "  der Liste steht",
                       "Jemanden vorhalten, der das kann",
                   ], False),
                   ("Die Regel", "Was ihre Auslieferung kostet", [
                       "Eine SQL-Abfrage",
                       "",
                       "Jede Werkstattkraft versteht,",
                       "warum ein Rad auf der Liste",
                       "steht — und kann widersprechen,",
                       "wenn es falsch ist.",
                   ], False),
                   y=unter_intro(s), hoehe=200)
    phasenleiste(s, 6)
    notizen(s, "Der letzte Punkt rechts ist der eigentliche Gewinn: Eine Regel, der "
               "man widersprechen kann, wird benutzt. Eine Blackbox, die man nur "
               "glauben kann, wird umgangen. Das entscheidet über den Erfolg im "
               "Betrieb mehr als jede Trefferquote.")

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
        ["5 Evaluation", "Gleichstand: je 70,0 % und je 10.890 €"],
        ["6 Deployment", "Die Regel — mit Wartungsliste, Überwachung und der "
                         "Rückkopplungsfalle"],
    ], y=unter_intro(s), spalten_b=[230, 673.5], zeilen_h=40)
    notizen(s, "Ein Modell muss seinen Unterhalt verdienen. Dieser Satz ist die "
               "Quintessenz des Falls — und er gilt weit über die Wartung hinaus.")


def fall3(prs):
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
            "Knapp 30 % der Kundschaft",
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
              "Roh: Faktor 0,91. Bei gleicher Temperatur: 0,74. Derselbe Datensatz, "
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
            "Rund 14 % werden auf die",
            "Prognose aufgeschlagen.",
            "",
            "Der mittlere Fehler steigt.",
            "Die Kosten sinken.",
            "",
            "Beides gleichzeitig.",
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

    zellfolie(prs, 4, "6.1", "Phase 6 · im Notebook",
              "Zwei Fehlerwerte — und nur einer zählt",
              "nb4-ehrlich",
              "MAE 12,65 mit dem tatsächlichen Wetter, 16,96 mit einer simulierten "
              "Vorhersage. Die zweite Zahl ist die ehrliche.",
              "Die Zeile sagt es selbst: „unrealistisch“ und „realistisch“. Wer in "
              "einem Bericht nur die erste Zahl zeigt, hat nicht gelogen und trotzdem "
              "getäuscht. Das Notebook nimmt einem die Entscheidung ab, indem es beide "
              "nebeneinander stellt.")

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
    kapitel(prs, 6, "Fall 5 — Assoziation: wenn die Hürde fast alles wegnimmt",
            "Welche Wege gehören zusammen — und wieviel von dem, was auffällt, "
            "ist überhaupt brauchbar?",
            "Dieser Fall zeigt Phase 5 von innen. Er ist der beste Beleg dafür, "
            "wozu vorab festgelegte Kriterien gut sind: Von 42 gefundenen Regeln "
            "überlebt genau eine.")

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
        ("Urteil", "Von 42 Regeln erfüllen 10 das Lift-, 2 das Support- und nur "
                   "EINE beide Kriterien"),
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

    s = folie(prs, "Fall 5 · Phase 5", "Von 42 Regeln bleibt eine",
              "Hoher Lift und hoher Support schließen einander fast aus. Wer beide "
              "Hürden vorab setzt, siebt radikal.")
    tabelle(s, ["Hürde", "Regeln, die sie erfüllen"], [
        ["Alle gefundenen Regeln", "42"],
        ["Lift ≥ 1,3", "10"],
        ["Support ≥ 1 %", "2"],
        ["Beide zugleich", "1"],
    ], y=unter_intro(s), spalten_b=[500, 403.5], zeilen_h=44)
    phasenleiste(s, 5)
    notizen(s, "Warum schließen sie einander fast aus? Ein sehr spezifisches Muster "
               "ist selten (niedriger Support), ein sehr häufiges ist unspezifisch "
               "(niedriger Lift). Wer nur eine der beiden Hürden setzt, findet "
               "entweder Belangloses oder Zufälliges.")

    zellfolie(prs, 5, "5.2", "Phase 5 · im Notebook",
              "Die Hürden sieben — 42, dann 10, dann 2, dann 1",
              "nb5-huerden",
              "Jede Hürde einzeln aufgeführt, mit der Zahl der Regeln, die sie "
              "überstehen. Die letzte Zeile ist das Ergebnis des Notebooks.",
              "Diese Ausgabe ist der beste Beleg des ganzen Decks dafür, wozu vorab "
              "gesetzte Kriterien gut sind. Hätte man sie nach dem Ergebnis gewählt, "
              "stünde hier eine komfortable Zahl statt einer ehrlichen.")

    s = folie(prs, "Fall 5 · Phase 6", "Zwei Pläne aus einer Analyse",
              "Die eine überlebende Regel begründet zwei verschiedene Einsätze — "
              "und beide tragen denselben Vorbehalt.")
    vorher_nachher(s,
                   ("Plan A", "Umverteilen zwischen Stationen", [
                       "Der Pendelstrom morgens",
                       "leert eine Station und füllt",
                       "eine andere.",
                       "",
                       "Gegengeprüft über die",
                       "kunde_id: Es sind tatsächlich",
                       "dieselben Personen.",
                   ], False),
                   ("Plan B", "Frei abgestellte Räder einsammeln", [
                       "„Frei abgestellt“ wurde ein",
                       "eigenes Ziel — sonst wären",
                       "23 % der Fahrten unsichtbar",
                       "geblieben.",
                       "",
                       "Vorbehalt: Wegeketten sind",
                       "personenbezogene Daten.",
                   ], False),
                   y=unter_intro(s), hoehe=210)
    phasenleiste(s, 6)
    notizen(s, "Der Hinweis rechts unten ist kein Beiwerk. Aus Start-Ziel-Paaren mit "
               "Zeitstempel lassen sich Bewegungsprofile bilden. Wer damit arbeitet, "
               "braucht eine Rechtsgrundlage.")

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
        ["5 Evaluation", "42 Regeln, 10 mit Lift, 2 mit Support, 1 mit beidem"],
        ["6 Deployment", "Zwei Pläne, mit Datenschutzvorbehalt"],
    ], y=unter_intro(s), spalten_b=[230, 673.5], zeilen_h=42)
    notizen(s, "Merksatz: Die auffälligste Regel ist meistens die uninteressanteste. "
               "Erst die vorab gesetzten Hürden trennen Fund von Rauschen.")


def fall6(prs):
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
        ("Erfolgskriterium", "Erstaunlich niedrig: ab 5 % Treffer lohnt sich die Liste"),
        ("Verfahren", "Interquartilsregel als Maßstab, dann Isolation Forest"),
        ("Der Rücksprung", "Phase 4 zurück nach Phase 3 — das Modell fand die "
                           "Preisklasse statt der Anomalien"),
        ("Urteil", "Aufgabe A besteht mit 40 % · Aufgabe B scheitert bei 9,5 % und "
                   "wird nicht freigegeben"),
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
        ["Erster Versuch", "6 %", "unbrauchbar — gefunden wurde die Preisklasse"],
        ["Nach der Normierung", "40 %", "Kriterium aus Phase 1 (5 %) deutlich erfüllt"],
    ], y=unter_intro(s), spalten_b=[250, 180, 473.5], zeilen_h=48)
    phasenleiste(s, 3, rueckspruenge=(4,))
    notizen(s, "Sechs auf vierzig Prozent durch eine Normierung. Studierende sollen "
               "mitnehmen: Der größte Hebel lag nicht im Verfahren, sondern in der "
               "Datenaufbereitung — wie so oft.")

    zellfolie(prs, 6, "4.5", "Nach dem Rücksprung · im Notebook",
              "Dieselbe Auswertung, nach der Normierung",
              "nb6-korrektur",
              "Die Radtyp-Verteilung der fünfzig auffälligsten Vorgänge ist jetzt "
              "gemischt statt einseitig. Genau das war das Ziel der Korrektur.",
              "Vergleichen Sie mit der Folie davor. Dieselbe Auswertung, dieselben "
              "Daten, ein normiertes Merkmal — und ein völlig anderes Bild. Der "
              "Hebel lag in Phase 3, nicht im Verfahren.")

    s = folie(prs, "Fall 6 · Phase 5", "Aufgabe B scheitert — und das ist ein Ergebnis",
              "Stationsausfälle sollten aus dem Fahrtaufkommen erkennbar sein. Sie "
              "sind es nicht. Der Grund liegt nicht am Verfahren.")
    kachelreihe(s, [
        ("Der Befund", [
            "Trefferquote 9,5 %.",
            "",
            "Das Kriterium für Aufgabe B",
            "wird deutlich verfehlt.",
        ]),
        ("Warum", [
            "Rund fünf Fahrten je Station",
            "und Tag.",
            "",
            "Ein Störungstag sieht bei",
            "dieser Grundrate genauso aus",
            "wie ein verregneter",
            "Januarsonntag.",
        ]),
        ("Die Lösung", [
            "Keine bessere Mathematik,",
            "sondern eine bessere",
            "Datenquelle:",
            "",
            "die Statusmeldungen der",
            "Terminals, die ohnehin",
            "anfallen.",
        ]),
    ], y=unter_intro(s), hoehe=200)
    phasenleiste(s, 5)
    notizen(s, "Der Satz, der bleiben soll: Kein Verfahren kann Information erzeugen, "
               "die in den Daten nicht steckt. Ein negatives Ergebnis, sauber "
               "begründet, ist ein vollwertiges Projektergebnis — es verhindert, dass "
               "jemand anderes dieselbe Sackgasse noch einmal ausprobiert.")

    zellfolie(prs, 6, "5.4", "Phase 5 · im Notebook",
              "Aufgabe B, ausgerechnet und verworfen",
              "nb6-aufgabeB",
              "Null gefundene Störungen bei einer Listenlänge von 50. Das Notebook "
              "rechnet das Scheitern aus, statt es zu verschweigen.",
              "Ein negatives Ergebnis, das ausgerechnet und dokumentiert ist, hat "
              "einen echten Wert: Es verhindert, dass jemand anderes dieselbe "
              "Sackgasse noch einmal ausprobiert.")

    s = folie(prs, "Fall 6 · Phase 6", "Ausgeliefert wird nur, was besteht",
              "Zwei Aufgaben, ein Ergebnis. Aufgabe B wird ausdrücklich nicht "
              "freigegeben — und das steht im Bericht.")
    streifen(s, [
        ("Aufgabe A", "Tagesliste mit zehn Plätzen, je Vorgang mit Begründung, WARUM "
                      "er auffällt — sonst kann die Disposition nichts damit anfangen"),
        ("Aufgabe B", "Nicht freigegeben. Die Empfehlung lautet: Terminalmeldungen "
                      "anbinden, statt aus dem Fahrtaufkommen zu schließen"),
        ("Rückkopplungsvorteil", "Anders als in Fall 2 verbessert die Nutzung hier "
                                 "die Datenlage: Jede geprüfte Meldung ist ein Label "
                                 "für die nächste Runde"),
    ], y=unter_intro(s), hoehe=76, luecke=10, chip_b=0)
    phasenleiste(s, 6)
    notizen(s, "Der dritte Punkt ist der Gegensatz zu Fall 2: Dort zerstörte die "
               "Nutzung die Lerngrundlage, hier schafft sie eine. Es lohnt sich, bei "
               "jedem Projekt zu fragen, in welche Richtung die Rückkopplung läuft.")

    s = folie(prs, "Fall 6 · Abschluss", "Der Kreislauf schließt sich")
    tabelle(s, ["Phase", "Was dabei herauskam"], [
        ["1 Business Understanding", "Zwei Aufgaben, zehn Listenplätze, und eine "
                                     "niedrige, aber begründete Hürde: 5 % Treffer"],
        ["2 Data Understanding", "Eine Lücke in der Dauerverteilung trennt Fahrten von "
                                 "Rückgabeproblemen. Sackgasse: die Geschwindigkeit"],
        ["3 Data Preparation", "Sechs Merkmale; distanz_km bleibt draußen, weil ein "
                               "fehlender Sensor kein auffälliger Vorgang ist"],
        ["4 Modeling", "Interquartilsregel unbrauchbar (über 2.000 Treffer), dann "
                       "Isolation Forest — der die Preisklasse fand"],
        ["5 Evaluation", "Nach der Korrektur 6 % → 40 %. Aufgabe A besteht, B scheitert "
                         "an den Grundraten"],
        ["6 Deployment", "Tagesliste mit Begründung; Aufgabe B ausdrücklich nicht "
                         "freigegeben"],
    ], y=unter_intro(s), spalten_b=[230, 673.5], zeilen_h=42)
    notizen(s, "Zwei Sätze aus diesem Notebook gehören an die Tafel: „Sehen Sie sich "
               "immer die Extremfälle an, die ein Modell meldet.“ Und: „Kein Verfahren "
               "kann Information erzeugen, die in den Daten nicht steckt.“")


# ═══════════════════════════════════════════════════ Teil D — Synthese

def teil_synthese(prs):
    kapitel(prs, 8, "Synthese",
            "Was war in allen sechs Fällen gleich — und was hat jeder einzelne "
            "über den Kreislauf gelehrt?",
            "Zum Abschluss legen wir die sechs Fälle zurück auf die Karte aus "
            "Kapitel 1. Jetzt ist sie nicht mehr abstrakt.")

    s = folie(prs, "Synthese", "Sechs Fälle, sechs Blickwinkel auf denselben Kreislauf",
              "Die Tabelle aus Kapitel 1 — jetzt ausgefüllt mit dem, was wir "
              "unterwegs gesehen haben.")
    tabelle(s, ["Fall", "Zeigt", "Der Satz, der bleibt"], [
        ["1 Regression", "Phase 5", "Die gemittelte Kennzahl verdeckte ein bestehendes "
                                    "Drittel — 0,91 € gegen 0,464 €"],
        ["2 Klassifikation", "Phase 6", "Bei Gleichstand gewinnt die einfachere Lösung: "
                                        "ausgeliefert wird die Regel"],
        ["3 Clustering", "Phase 1", "Erfolgskriterien ohne Zielgröße — und eine bessere "
                                    "Frage als die, mit der wir anfingen"],
        ["4 Zeitreihe", "Phase 3", "Der Schnitt folgt der Zeit. Und die genaueste "
                                   "Prognose ist nicht die günstigste"],
        ["5 Assoziation", "Phase 5", "Von 42 Regeln überlebt eine — dank Hürden, die "
                                     "vorher standen"],
        ["6 Anomalie", "Rücksprung", "Kein Verfahren erzeugt Information, die in den "
                                     "Daten nicht steckt"],
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
