#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Erzeugt das Foliendeck „Datenbankentwurf am Fallbeispiel VeloCity".

Aufruf:
    bash tools/render_diagrams.sh      # Diagramme zuerst
    python3 slides/build_deck.py

Als Vorlage dient ein bestehendes BINT-Deck: daraus kommen Thema,
Layouts und Fußmasken. Alle Folien werden neu gebaut.

Didaktisches Gerüst
-------------------
Ein durchgehender Fall trägt das Deck: **Anna fährt 61 Minuten mit einem
E-Bike**. Jedes Kapitel öffnet mit einer Leitfrage, die dieser Fall
aufwirft, und schließt mit ihrer Beantwortung. Auf den Inhaltsfolien
stellt ein roter Streifen am Fuß den Bezug zu Annas Fahrt her.

Wo es trägt, kommt erst der naive Versuch, der scheitert, und dann die
Lösung — nicht die Lösung allein.
"""
from __future__ import annotations

import pathlib
import sys

from pptx import Presentation
from pptx.util import Pt

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from thws import (  # noqa: E402
    BLAU, BREITE, FLUCHT_L, GRUEN_D, ORANGE, ROT_A, TEXT_SEK,
    ZONE_OBEN, ZONE_UNTEN,
    ampel_matrix, code_kacheln, diagramm, faden, kachelreihe, kopf, leitfrage,
    notizen, prozesskette, regel_streifen, sandband, sandkarte,
    schichtenstapel, tabelle, vorher_nachher,
)

WURZEL  = pathlib.Path(__file__).resolve().parent.parent
VORLAGE = pathlib.Path(
    "/Users/robert/Library/CloudStorage/OneDrive-Persönlich/Vorlesungen/"
    "thws-deck-batch/decks/BINT_E4_Datenmodellierung_WS2627_v3.pptx"
)
ZIEL   = WURZEL / "slides" / "velocity-datenbankentwurf.pptx"
ASSETS = WURZEL / "slides" / "assets"

Q = ("Fallstudie VeloCity, Schema velocity auf supabase.butscher.cloud. "
     "Quellen und Diagramme im Repository unter doku/datenmodell/.")


def bild(name: str) -> str:
    pfad = ASSETS / f"{name}.png"
    if not pfad.exists():
        raise SystemExit(f"Diagramm fehlt: {pfad}\nZuerst: bash tools/render_diagrams.sh")
    return str(pfad)


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
    """Erste freie Zeile unterhalb der Einleitung."""
    return getattr(s, '_intro_unten', 110) + abstand


def baue() -> Presentation:
    prs = leere_praesentation()

    # ═══════════════════════════════════════════════════════ Titel
    s = prs.slides.add_slide(lay(prs, "Frontpage_Digital"))
    for ph in s.placeholders:
        i = ph.placeholder_format.idx
        if i == 10:
            ph.text_frame.text = "Datenbankentwurf am Fallbeispiel VeloCity"
        elif i == 11:
            ph.text_frame.text = ("Eine Fahrt, 61 Minuten, 4,96 Euro — und alles, was eine "
                                  "Datenbank dafür wissen und garantieren muss")
    notizen(s, "Wir entwerfen in dieser Einheit eine Datenhaltung von Grund auf. Kein "
               "vorhandenes Schema, kein Umbau: ein Unternehmen kommt mit einem Auftrag. "
               "Damit das nicht abstrakt bleibt, hängen wir alles an EINEN Fall — an eine "
               "einzige Fahrt. Die begleitet uns bis zur letzten Folie.")

    # ═══════════════════════════════════════════ Der Fall als roter Faden
    s = folie(prs, "Der Fall", "Anna fährt 61 Minuten. Das ist alles, was wir wissen.",
              "Aus diesem einen Satz entsteht das gesamte Datenmodell. Jede Frage, die "
              "diese Fahrt aufwirft, beantwortet ein Kapitel dieser Einheit — und am Ende "
              "steht eine Datenbank, die Annas Rechnung selbst berechnet und ihre Regeln "
              "erzwingt.")
    diagramm(s, bild("faden-annas-fahrt"), y=unter_intro(s), hoehe=190)
    sandband(s, "Prüfen Sie im Verlauf mit: Woher weiß die Datenbank am Ende, dass Anna "
                "genau 4,96 Euro zahlt — und nicht 6,20 oder 4,00?", y=396)
    notizen(s, "Die Zahlen sind echt: 61 Minuten, E-Bike, Studententarif mit Rabatt. Am "
               "Ende der Einheit können wir jeden Cent begründen. Die Zwischenbeträge 6,20 "
               "und 4,00 sind die beiden naheliegenden Fehler — der eine ignoriert den "
               "Tarif, der andere dreht die Reihenfolge um.")

    s = folie(prs, "Orientierung", "Neun Kapitel, neun Fragen an Annas Fahrt",
              "Die Reihenfolge ist zwingend. Anforderungen vor Modell, Modell vor "
              "Relationen, Relationen vor DDL. Wer sie umdreht, bindet sich an eine "
              "Umsetzung, bevor er weiß, was umzusetzen ist.")
    tabelle(s, ["Kapitel", "Die Frage, die Annas Fahrt aufwirft"],
            [["1 Fallstudie",     "Was muss die Datenbank über diese Fahrt überhaupt wissen?"],
             ["2 Konzeptionell",  "Welche Dinge sind das — und wie hängen sie zusammen?"],
             ["3 Normalisierung", "Warum reicht dafür nicht eine einzige Tabelle?"],
             ["4 Logisch",        "Wie wird aus dem Bild ein Satz von Relationen?"],
             ["5 Physisch",       "Wie erzwingt die Datenbank, dass Annas Rechnung stimmt?"],
             ["6 Implementierung","Was kostet die Fahrt genau — und warum?"],
             ["7 Sicherheit",     "Wer außer Anna darf ihre Daten sehen?"],
             ["8 Anbindung",      "Wie kommt das alles in die Web-Anwendung?"],
             ["9 Ausblick",       "Was fehlt noch, damit die Räder gewartet werden?"]],
            y=182, spalten_b=[220, 683.5], zeilen_h=30)
    notizen(s, "Diese Tabelle ist die Landkarte. Ich komme nach jedem Kapitel kurz darauf "
               "zurück und hake ab.")

    # ═══════════════════════════════════════════════════ 1 Fallstudie
    kapitel(prs, 1, "Die Fallstudie",
            "Was muss die Datenbank über Annas Fahrt überhaupt wissen?",
            "Bevor irgendetwas modelliert wird, muss das Geschäft verstanden sein. "
            "Anforderungen werden in Substantiven und Regeln notiert, nicht in Tabellen.")

    s = folie(prs, "1 · Die Fallstudie", "VeloCity vermietet Räder minutengenau",
              "Ein Bike-Sharing-System in Würzburg. Kunden finden freie Räder auf einer "
              "Karte, entleihen sie, fahren und stellen sie wieder ab. Vielfahrer schließen "
              "einen Tarif ab, der Freiminuten und Rabatt mitbringt.")
    kachelreihe(s, [
        ("Drei Fahrzeugklassen",
         ["City-Bike, Stadtrad ohne Motor",
          "E-Bike Sport, Pedelec bis 25 km/h",
          "E-Cargo Loader, bis 100 kg Zuladung"]),
        ("Zwei Abstellarten",
         ["An einer festen Station, kostenfrei",
          "Frei im Stadtgebiet gegen Zuschlag",
          "Beides muss das Modell abbilden"]),
        ("Vier Tarife",
         ["Basis ohne Freiminuten",
          "Student und ÖPNV mit Kontingent",
          "Premium mit Rabatt und Monatspreis"]),
    ], y=182, hoehe=150)
    faden(s, "Anna fährt ein E-Bike und hat den Studententarif — 300 Freiminuten im Monat.")
    notizen(s, "Wichtig ist die zweite Kachel: Free-Floating heißt, dass ein Rad auch ohne "
               "Station eine Position haben muss. Das entscheidet später über die Struktur "
               "der Positionsdaten.")

    s = folie(prs, "1 · Die Fallstudie", "Zehn Geschäftsregeln — jede muss erzwungen werden",
              "Diese Regeln sind die fachliche Substanz. Entscheidend ist nicht, sie zu "
              "notieren, sondern dass jede einzelne am Ende erzwungen wird — von der "
              "Datenbank, nicht von der Anwendung.")
    regel_streifen(s, [
        ("GR1", "Ein Rad ist höchstens einmal gleichzeitig ausgeliehen", "partieller UNIQUE-Index"),
        ("GR2", "Ein Kunde hat höchstens vier aktive Ausleihen", "Prüfung in der Funktion"),
        ("GR3", "Ein Kunde hat zu einem Zeitpunkt einen Tarif", "EXCLUDE-Constraint"),
        ("GR4", "Preise und Konditionen überlappen sich nie", "EXCLUDE-Constraint"),
        ("GR5", "Bepreist wird mit dem Preis zur Startzeit", "in fn_ausleihe_beenden"),
        ("GR6", "Angefangene Minuten werden aufgerundet", "GENERATED-Spalte"),
    ], y=174, hoehe=42, luecke=5)
    faden(s, "GR5 entscheidet über Annas Rechnung: es gilt der Preis um 10:00 Uhr, nicht der von heute.")
    notizen(s, "Sechs von zehn. Rechts steht schon, wo die Regel später landet — das ist "
               "der rote Faden durch die Umsetzung. GR7 bis GR12 folgen im physischen Entwurf.")

    # ═══════════════════════════════════════════ 2 Konzeptioneller Entwurf
    kapitel(prs, 2, "Konzeptioneller Entwurf",
            "Welche Dinge sind das — und wie hängen sie zusammen?",
            "Entitäten, Beziehungen, Kardinalitäten. Noch keine Datentypen, keine "
            "Schlüsselstrategie, keine Datenbank.")

    s = folie(prs, "2 · Konzeptioneller Entwurf", "Substantive werden Entitäten, Verben werden Beziehungen",
              "Eine Heuristik zum Einstieg, kein Automatismus — die eigentliche Arbeit steckt in "
              "den Kardinalitäten.")
    oben = unter_intro(s)
    diagramm(s, bild("erm-konzeptionell"), y=oben, hoehe=ZONE_UNTEN - 12 - oben)
    notizen(s, "Bewusst ohne Attribute. Auf dieser Stufe interessiert nur, welche Dinge es "
               "gibt und wie viele davon auf jeder Seite stehen. „Ein Kunde hat höchstens "
               "einen gültigen Tarif“ ist eine Entscheidung des Fachbereichs, keine "
               "technische Festlegung.")

    s = folie(prs, "2 · Konzeptioneller Entwurf", "Kardinalitäten lesen und prüfen",
              "Die Notation ist schnell gelernt. Die Frage dahinter ist die schwierige: "
              "Stimmt die Aussage über die Wirklichkeit?")
    tabelle(s, ["Zeichen", "Bedeutung", "Beispiel im Modell", "Ist das wirklich so?"],
            [["||--o{", "eins zu null oder viele", "KUNDE tätigt AUSLEIHE", "Neukunde ohne Fahrt: ja"],
             ["||--|{", "eins zu ein oder viele",  "RECHNUNG hat POSITION",  "Rechnung ohne Posten wäre sinnlos"],
             ["||--||", "eins zu eins",            "FAHRRAD hat POSITION",   "genau eine Position je Rad"],
             ["||--o|", "eins zu null oder eins",  "AUSLEIHE zu POSITION",   "noch nicht fakturiert: ja"]],
            y=192, spalten_b=[110, 230, 260, 303.5], zeilen_h=34)
    faden(s, "Annas Fahrt ist eine AUSLEIHE — sie verbindet Kunde, Rad, Station und Tarif in einem Vorgang.")
    notizen(s, "Die vierte Spalte ist die wichtige. Jede Kardinalität muss man gegen die "
               "Wirklichkeit prüfen, nicht aus dem Bauch setzen.")

    # Relationale Modelle je Bereich.
    #
    # Diese Folien tragen bewusst nur eine einzeilige Einleitung: das
    # Diagramm ist die Aussage, und es braucht die volle Hoehe, um im
    # Hoersaal lesbar zu bleiben.
    for kicker, titel, intro, bilddatei, fadentext, notiz in [
        ("2 · Bereich A", "Geschäftspartner: Adresse als eigene Entität",
         "Kunde, Station, Lieferant und Lager brauchen dieselbe Adressstruktur — vier Mal "
         "dieselben fünf Spalten wären Redundanz auf Schemaebene.",
         "rel-a-geschaeftspartner",
         "Anna ist ein Satz in kunde — mit Kundennummer, aber ohne Passwort.",
         "Auffällig: keine Passwortspalte. Die Anmeldung liegt vollständig bei Supabase "
         "Auth, verbunden über auth_uid. Und hausnummer ist NOT NULL mit leerem "
         "Vorgabewert — sonst greift der fachliche Schlüssel nicht, weil zwei NULL-Werte "
         "in einem UNIQUE-Index als verschieden gelten."),
        ("2 · Bereich B", "Netz und Flotte: Stammdaten und Bewegungsdaten getrennt",
         "Ein Rad ändert seine Stammdaten fast nie und seine Position ständig — die "
         "1:1-Trennung hält die Stammdatentabelle ruhig.",
         "rel-b-netz-und-flotte",
         "Annas E-Bike steht vor der Fahrt an einer Station, danach vielleicht frei im Stadtgebiet.",
         "station_id IS NULL bedeutet eindeutig: frei abgestellt. Zwischen Typ und Rad "
         "steht das Modell — das wirkt zunächst überflüssig, ist aber die Brücke zur "
         "Warenwirtschaft: Ersatzteile hängen am Modell, nicht am Einzelrad."),
        ("2 · Bereich C", "Tarif und Preis: alles ist zeitabhängig",
         "Ein Preis gilt für einen Zeitraum, nicht für immer — der EXCLUDE-Constraint "
         "verhindert Überschneidungen in der Datenbank, nicht in der Anwendung.",
         "rel-c-tarif-und-preis",
         "Annas Studententarif bringt 300 Freiminuten im Monat und wird beim Start ihrer Fahrt fixiert.",
         "freiminuten_periode ist der Kern: statt eines Zählers, der heruntergezählt wird, "
         "stehen Kontingent und Verbrauch je Monat nebeneinander. Bestand und Bewegung "
         "bleiben unterscheidbar, jeder Stand ist rekonstruierbar."),
        ("2 · Bereich D", "Nutzung: die Ausleihe und ihre Abrechnung",
         "Ein einzelner Kostenbetrag verrät nicht, wie er zustande kam — jede Zeile der "
         "Abrechnung bleibt sichtbar und trägt ihren Beleg.",
         "rel-d-nutzung",
         "Annas Fahrt erzeugt fünf Entgeltpositionen — jede einzeln nachvollziehbar.",
         "Der Fremdschlüssel von entgeltposition auf nutzungspreis ist der wichtigste Pfeil "
         "im ganzen Modell: er dokumentiert, welcher Preissatz tatsächlich angewandt wurde. "
         "Ohne ihn wäre eine Altrechnung nach einer Preisänderung nicht mehr erklärbar."),
        ("2 · Bereich E", "Abrechnung: Beleg, Positionen, Zahlung",
         "Das Kopf-Positionen-Muster, ergänzt um die Zahlung — gespeichert wird nur das "
         "Token des Dienstleisters, weder IBAN noch Kartennummer.",
         "rel-e-abrechnung",
         "Annas Fahrt erscheint am Monatsende als eine Zeile auf einer Rechnung.",
         "Was nicht gespeichert wird, kann nicht abfließen. Das ist keine Bequemlichkeit, "
         "sondern die wirksamste Schutzmaßnahme überhaupt."),
        ("2 · Bereich F", "Redaktionsinhalte: warum drei Tabellen und nicht eine",
         "FAQ, Nutzungsschritte und Kennzahlen könnten in einer generischen "
         "Schlüssel-Wert-Tabelle liegen — das wäre flexibler und schlechter.",
         "rel-f-inhalte",
         "Der Preis, den Anna auf der Tarifkarte sieht, wird aus nutzungspreis gerechnet — nicht getippt.",
         "Ein Entity-Attribute-Value-Modell wäre in dritter Normalform und trotzdem falsch: "
         "keine Typsicherheit, keine Fremdschlüssel, keine Constraints, unlesbare Abfragen. "
         "Normalform ist notwendig, nicht hinreichend."),
    ]:
        # Auf Diagrammfolien steht die Anna-Zeile OBEN statt unten und
        # ersetzt die Einleitung. Der Titel trägt die Aussage, die
        # Vertiefung steht in den Notizen — und das Diagramm bekommt die
        # ganze Fläche, sonst ist es im Hörsaal nicht lesbar.
        s = folie(prs, kicker, titel)
        faden(s, fadentext, y=88)
        diagramm(s, bild(bilddatei), y=134, hoehe=ZONE_UNTEN - 134 - 8)
        notizen(s, intro + "\n\n" + notiz)

    # ═══════════════════════════════════════════════════ 3 Normalisierung
    kapitel(prs, 3, "Normalisierung",
            "Warum reicht für Annas Fahrt nicht eine einzige Tabelle?",
            "Ein Prüfverfahren, kein Entwurfsverfahren. Es findet Redundanz — es sagt "
            "nicht, ob das Modell die Wirklichkeit trifft.")

    s = folie(prs, "3 · Normalisierung", "Der naive Versuch: alles in eine Tabelle",
              "So würde jemand Annas Fahrt aufschreiben, der noch nicht normalisiert hat. "
              "Die Tabelle funktioniert — bis zur ersten Änderung.")
    diagramm(s, bild("norm-vorher"), y=176, x0=FLUCHT_L, breite=390, hoehe=280)
    sandkarte(s, "Drei Anomalien, die daraus folgen",
              ["Einfügen: ein neuer Fahrradtyp lässt sich ohne Ausleihe gar nicht anlegen.",
               "Ändern: eine Preisanpassung müsste in jeder einzelnen Ausleihzeile nachgezogen werden.",
               "Löschen: mit der letzten Ausleihe eines Typs verschwindet auch dessen Preis."],
              y=200, x0=FLUCHT_L + 420, breite=BREITE - 420)
    notizen(s, "Erst die Anomalien zeigen, dann zerlegen. Wer sofort zerlegt, weiß "
               "hinterher nicht, welches Problem er gelöst hat.")

    s = folie(prs, "3 · Normalisierung", "1NF und 2NF: atomar, und alles hängt am ganzen Schlüssel",
              "Die 1NF verlangt atomare Attribute. Der lehrreichere Fall ist die "
              "wiederholende Gruppe: sie wird zu einer eigenen Relation, nicht zu mehreren "
              "Spalten.")
    vorher_nachher(s,
        ("verletzt", "1NF · nicht atomar",
         ["kunde_name  = „Anna Beispiel“",
          "positionen  = „Start 0,10; Zeit 6,10; …“",
          "",
          "Falsche Reparatur:",
          "position1, position2, position3",
          "→ legt die Anzahl im Schema fest"], True),
        ("erfüllt", "1NF · zerlegt",
         ["vorname     = „Anna“",
          "nachname    = „Beispiel“",
          "",
          "entgeltposition als eigene Relation,",
          "eine Zeile je Preisbestandteil",
          "→ die Anzahl ist offen"], True),
        y=176, hoehe=190)
    sandband(s, "2NF: bei zusammengesetztem Schlüssel (ausleihe_id, position_nr) hängt "
                "kunde_email nur an ausleihe_id — daraus folgt die Trennung in Kopf und "
                "Positionen.", y=380)
    notizen(s, "Das Kopf-Positionen-Muster kennen die meisten aus der Praxis. Hier sehen "
               "sie zum ersten Mal, dass es formal begründbar ist und nicht bloß Konvention.")

    s = folie(prs, "3 · Normalisierung", "3NF — und warum sie hier nicht genügt",
              "Die transitive Kette vom Rad über den Typ zum Preis ist der klassische "
              "3NF-Verstoß. Sie aufzulösen ist notwendig, reicht aber fachlich nicht aus.")
    vorher_nachher(s,
        ("3NF verletzt", "Die transitive Kette",
         ["ausleihe_id",
          "  → rahmennummer",
          "     → typ_bezeichnung",
          "        → preis_pro_minute",
          "",
          "Eine Preisänderung müsste in jeder",
          "Ausleihzeile nachgezogen werden."], True),
        ("3NF erfüllt — reicht trotzdem nicht", "Zerlegt, aber immer noch falsch",
         ["fahrradtyp und nutzungspreis",
          "werden eigene Relationen.",
          "",
          "ABER: liegt der Preis am Typ, ändert",
          "eine Anpassung weiterhin rückwirkend",
          "ALLE Altrechnungen — auch Annas."], False),
        y=176, hoehe=200)
    sandband(s, "Erst der Gültigkeitszeitraum in nutzungspreis macht das Modell fachlich "
                "richtig. Normalisierung beseitigt Redundanz — sie ersetzt keine fachliche "
                "Analyse.", y=390)
    notizen(s, "Das ist die zentrale Botschaft des Blocks und eine gute Prüfungsfrage: "
               "Nennen Sie eine Stelle, an der ein Modell in dritter Normalform trotzdem "
               "fachlich falsch ist.")

    s = folie(prs, "3 · Normalisierung", "Das Ergebnis der Zerlegung",
              "Aus einer Tabelle sind acht geworden — jede mit genau einer Aufgabe.")
    oben = unter_intro(s)
    diagramm(s, bild("norm-nachher"), y=oben, hoehe=ZONE_UNTEN - 40 - oben)
    faden(s, "Annas Fahrt liegt jetzt in ausleihe — ihr Preis in nutzungspreis, ihre Abrechnung in entgeltposition.")
    notizen(s, "Acht Relationen statt einer klingt nach mehr Aufwand. Der Aufwand entsteht "
               "einmal beim Entwurf und spart sich bei jeder Änderung wieder ein.")

    s = folie(prs, "3 · Normalisierung", "Exkurs: aus der Postleitzahl folgt nicht der Ort",
              "Der Lehrbuchklassiker lautet, plz bestimme ort, also gehöre ort in eine "
              "eigene Relation. In Deutschland stimmt das nicht — und der scheinbar saubere "
              "Zerlegungsschritt wäre fachlich falsch.")
    ampel_matrix(s, ["gilt"], [
        ("Eine PLZ hat genau einen Ort", [False],
         "Ländliche Sammel-PLZ umfassen mehrere Orte"),
        ("Ein Ort hat genau eine PLZ", [False],
         "Großstädte haben Dutzende"),
        ("plz → ort ist funktional", [False],
         "Also keine transitive Abhängigkeit, kein Split"),
    ], y=206, zeilen_h=52, chip_b=80, label_b=340)
    sandband(s, "Eine funktionale Abhängigkeit ist eine Behauptung über die Wirklichkeit "
                "und muss geprüft werden — nicht aus Namensähnlichkeit geschlossen.", y=396)
    notizen(s, "Hier lohnt der Blick ins Data Dictionary: die Begründung steht als "
               "Kommentar direkt an der Spalte adresse.ort und veraltet nicht.")

    # ═══════════════════════════════════════════════════ 4 Logischer Entwurf
    kapitel(prs, 4, "Logischer Entwurf",
            "Wie wird aus dem Bild ein Satz von Relationen?",
            "Regelbasiert und damit prüfbar. Wer eine 1:N-Beziehung auf der Eins-Seite "
            "verankert, hat nicht anders entworfen, sondern falsch abgebildet.")

    s = folie(prs, "4 · Logischer Entwurf", "Die Abbildung folgt festen Regeln",
              "Dieser Schritt ist mechanisch — und genau deshalb korrigierbar. Ein Fehler "
              "hier ist kein Geschmacksurteil, sondern ein Regelverstoß.")
    tabelle(s, ["ERM-Konstrukt", "Abbildung ins Relationenmodell", "Beispiel im Modell"],
            [["Entitätstyp", "eigene Relation", "kunde, station, ausleihe"],
             ["Attribut", "Spalte", "vorname, kapazitaet"],
             ["1:N-Beziehung", "Fremdschlüssel auf der N-Seite", "ausleihe.kunde_id"],
             ["1:1-Beziehung", "FK auf der optionalen Seite, dort zugleich PK", "fahrrad_position.fahrrad_id"],
             ["M:N-Beziehung", "eigene Verknüpfungsrelation", "Phase 2: wartungsposition"],
             ["Mehrwertiges Attribut", "eigene Relation", "fahrradtyp_merkmal"]],
            y=186, spalten_b=[210, 400, 293.5], zeilen_h=32)
    faden(s, "Annas Fahrt bekommt vier Fremdschlüssel: Kunde, Rad, Mitgliedschaft, Startstation.")
    notizen(s, "Die 1:1-Abbildung ist die elegante: fahrrad_id ist in fahrrad_position "
               "zugleich Primär- und Fremdschlüssel. Damit ist „höchstens eine Position je "
               "Rad“ ohne zusätzlichen Constraint erzwungen.")

    s = folie(prs, "4 · Logischer Entwurf", "Jede Relation trägt zwei Schlüssel",
              "Surrogatschlüssel als Primärschlüssel, fachlicher Schlüssel als "
              "Eindeutigkeitsbedingung. Beide haben eine Aufgabe, keiner ersetzt den anderen.")
    ampel_matrix(s, ["stabil", "eindeutig", "sprechend"], [
        ("Surrogatschlüssel  kunde_id", [True, True, False], "Primärschlüssel"),
        ("Fachschlüssel  kundennummer", [False, True, True], "UNIQUE-Bedingung"),
        ("Fachschlüssel als Primärschlüssel", [False, True, True], "Änderung zieht durch alle Verweise"),
    ], y=206, zeilen_h=52, chip_b=86, label_b=300)
    sandband(s, "Eine Rahmennummer wird beim Rahmentausch neu vergeben. Ein "
                "Primärschlüssel, der sich ändert, zieht die Änderung durch jede "
                "verweisende Relation.", y=396)
    notizen(s, "Die dritte Zeile ist der häufigste Anfängerfehler: den sprechenden "
               "Schlüssel zum Primärschlüssel machen. Er ist eindeutig und sprechend — aber "
               "eben nicht stabil.")

    # ═══════════════════════════════════════════════════ 5 Physischer Entwurf
    kapitel(prs, 5, "Physischer Entwurf",
            "Wie erzwingt die Datenbank, dass Annas Rechnung stimmt?",
            "Hier wird eine Geschäftsregel entweder erzwungen oder nur gewünscht. Jede "
            "Regel, die nicht in einem Constraint steht, wird früher oder später verletzt.")

    s = folie(prs, "5 · Physischer Entwurf", "Datentypen sind fachliche Entscheidungen",
              "Jede Zeile hat einen Grund, der über Geschmack hinausgeht. Die beiden ersten "
              "sind die, an denen in der Praxis am meisten schiefgeht.")
    tabelle(s, ["Zweck", "Typ", "Warum genau dieser"],
            [["Zeitpunkt", "timestamptz", "timestamp ohne Zone verliert den Bezug; Sommerzeit wird doppeldeutig"],
             ["Geldbetrag", "numeric(10,2)", "exakte Dezimalarithmetik; float trifft 0,10 nicht genau"],
             ["Zeitraum", "daterange", "ein Zeitraum ist ein Wert, kein Spaltenpaar — erst so prüfbar"],
             ["Surrogatschlüssel", "bigint IDENTITY", "standardkonform; ALWAYS verhindert Setzen von außen"],
             ["Koordinate", "numeric(9,6)", "sechs Nachkommastellen entsprechen etwa elf Zentimetern"],
             ["Text", "text", "PostgreSQL speichert text und varchar(n) identisch"]],
            y=186, spalten_b=[180, 170, 553.5], zeilen_h=32)
    faden(s, "Annas Startzeit als timestamp ohne Zone wäre in der Nacht der Zeitumstellung nicht eindeutig.")
    notizen(s, "Die Zeitzonenfalle ist real und teuer: eine Fahrt in der Nacht der "
               "Umstellung lässt sich mit timestamp ohne Zone nicht eindeutig einordnen.")

    s = folie(prs, "5 · Physischer Entwurf", "Neun von zwölf Regeln erzwingt die Datenbank",
              "Die oberen sechs gelten immer, auch bei direktem SQL-Zugriff. Die unteren drei "
              "nur, wenn man den vorgesehenen Weg nimmt — sie brauchen Kontext, den ein "
              "Constraint nicht hat.")
    tabelle(s, ["Regel", "Umsetzung", "Wirkt"],
            [["GR1", "CREATE UNIQUE INDEX … WHERE status = 'aktiv'", "immer"],
             ["GR3, GR4", "EXCLUDE USING gist (… WITH =, … WITH &&)", "immer"],
             ["GR6", "GENERATED ALWAYS AS (ceil(…)) STORED", "immer"],
             ["GR7", "CHECK (verbraucht <= kontingent)", "immer"],
             ["GR10", "UNIQUE (kunde_id, periode_jahr, periode_monat)", "immer"],
             ["GR11", "CHECK: Station oder Koordinaten, nie beides", "immer"],
             ["GR2, GR5", "Prüfung in fn_ausleihe_starten und _beenden", "nur über die Funktion"],
             ["GR8, GR9", "Prüfung in der api_-Schicht", "nur über die Funktion"],
             ["GR12", "Prüfung in fn_ausleihe_starten", "nur über die Funktion"]],
            y=186, spalten_b=[130, 520, 253.5], zeilen_h=27)
    notizen(s, "Der Unterschied in der dritten Spalte ist der eigentliche Inhalt dieser "
               "Folie. Constraints sind unbestechlich, Funktionen kann man umgehen — "
               "deshalb muss die Fachlogik von außen unerreichbar sein.")

    s = folie(prs, "5 · Physischer Entwurf", "EXCLUDE verhindert, was UNIQUE nicht kann",
              "Ein UNIQUE kennt nur Gleichheit. Für „diese Zeiträume dürfen sich nicht "
              "überschneiden“ braucht es einen Operator, der Überlappung prüfen kann.")
    code_kacheln(s,
        ("Der Constraint",
         ["constraint nutzungspreis_ueberschneidung_ex",
          "  exclude using gist (",
          "    typ_id      with =,",
          "    gueltigkeit with &&",
          "  )",
          "",
          "Keine zwei Zeilen mit gleichem typ_id",
          "UND überlappenden Zeiträumen."], BLAU),
        ("Zwei Fallstricke",
         ["1  Voraussetzung btree_gist",
          "   Ohne die Erweiterung fehlt bigint",
          "   die Operatorklasse für gist:",
          "   „data type bigint has no default",
          "    operator class for access method",
          "    gist“",
          "",
          "2  Halboffene Grenzen '[)'",
          "   Sonst ist der Wechseltag doppelt",
          "   belegt."], ORANGE),
        y=176, hoehe=240)
    faden(s, "Ohne GR4 könnte es für Annas Fahrtzeitpunkt zwei gültige Preise geben — die Rechnung wäre nicht bestimmt.")
    notizen(s, "Beide Fallstricke sind beim Bauen tatsächlich aufgetreten. Der erste hat "
               "die Anlage abgebrochen, der zweite wäre bei einem nahtlosen Tarifwechsel "
               "aufgefallen.")

    s = folie(prs, "5 · Physischer Entwurf", "Warum das Mindestalter kein CHECK sein darf",
              "Naheliegend wäre eine Bedingung mit current_date. PostgreSQL akzeptiert sie "
              "sogar. Trotzdem ist sie falsch — und der Grund zeigt, was ein CHECK "
              "eigentlich ist.")
    vorher_nachher(s,
        ("verlockend und falsch", "CHECK mit current_date",
         ["check (geburtsdatum <=",
          "  current_date - interval '16 years')",
          "",
          "current_date ist nicht IMMUTABLE.",
          "Ein CHECK wird beim Schreiben geprüft",
          "UND beim Wiedereinspielen eines Dumps.",
          "",
          "Ein Kunde, der bei der Anmeldung 16 war,",
          "bleibt es — der Restore bricht trotzdem ab."], False),
        ("richtig", "Immutable auf der Tabelle, Regel in der Funktion",
         ["check (geburtsdatum is null",
          "   or geburtsdatum between",
          "      date '1900-01-01'",
          "  and date '2100-01-01')",
          "",
          "-- die Altersregel in api_profil_aktualisieren:",
          "if p_geburtsdatum >",
          "   current_date - interval '16 years'",
          "then return 'Mindestalter nicht erreicht';"], False),
        y=176, hoehe=230)
    sandband(s, "Merksatz: Ein CHECK darf nur von der Zeile selbst abhängen — und von "
                "nichts, was sich mit der Zeit ändert.", y=420)
    notizen(s, "Gute Prüfungsfrage: Warum ist eine CHECK-Bedingung mit current_date "
               "gefährlich, obwohl die Datenbank sie annimmt?")

    # ═══════════════════════════════════════════════════ 6 Implementierung
    kapitel(prs, 6, "Implementierung",
            "Was kostet Annas Fahrt genau — und warum?",
            "Jetzt lösen wir die Frage vom Anfang auf. Jeder Cent muss begründbar sein.")

    s = folie(prs, "6 · Implementierung", "Zwölf Aufbauschritte, jeder für sich lauffähig",
              "Jede Datei ist idempotent: sie läuft zweimal hintereinander fehlerfrei. Das "
              "ist die Voraussetzung dafür, dass man einen Aufbau gefahrlos wiederholen kann.")
    schichtenstapel(s, [
        ("0001 Schema, Erweiterungen, Aufzählungstypen, Audit-Mechanik", True),
        ("0002 bis 0007 · die sechs Fachbereiche A bis F, 25 Tabellen", False),
        ("0008 Referenzdaten: Entgeltarten, Preise, Tarife, Inhalte", False),
        ("0009 Geschäftslogik: fn_-Fachlogik und api_-Zugriffsschicht", True),
        ("0010 Sichten · 0011 Zugriffsschutz · 0012 Data Dictionary", True),
    ], y=186, hoehe=48, luecke=10)
    notizen(s, "Die Reihenfolge ist die Reihenfolge dieser Vorlesung. Wer 0004 vor 0003 "
               "ausführt, bekommt einen Fremdschlüsselfehler — die Abhängigkeiten sind im "
               "Schema selbst dokumentiert.")

    s = folie(prs, "6 · Implementierung", "Annas Rechnung: 4,96 Euro, Zeile für Zeile",
              "Das Zeitentgelt wird über ALLE Minuten gebildet und die Freiminuten als "
              "eigene Gutschrift abgezogen. So ist auf der Rechnung ablesbar, was der "
              "Tarifvorteil wert war.")
    tabelle(s, ["Position", "Menge", "Einzelbetrag", "Betrag", "Woher der Wert kommt"],
            [["STARTGEBUEHR", "1", "0,10", "+ 0,10", "nutzungspreis, gültig um 10:00 Uhr"],
             ["ZEITENTGELT", "61", "0,10", "+ 6,10", "dauer_minuten, aufgerundet"],
             ["FREIMINUTEN", "0", "0,10", "- 0,00", "Kontingent im Monat schon verbraucht"],
             ["TARIFRABATT", "1", "20 %", "- 1,24", "tarif_kondition zum Startzeitpunkt"],
             ["HOECHSTPREIS", "1", "—", "- 0,00", "6,20 liegt unter der Obergrenze 15,00"]],
            y=178, spalten_b=[190, 90, 130, 120, 373.5], zeilen_h=30)
    sandband(s, "6,20 - 1,24 = 4,96 Euro. Reihenfolge: Rabatt VOR der Kappung — umgekehrt "
                "käme 4,00 heraus, weil der Rabatt den bereits gedeckelten Betrag ein "
                "zweites Mal senken würde.", y=364)
    faden(s, "Damit ist die Frage vom Anfang beantwortet: 4,96 Euro, und jede Zeile ist belegt.")
    notizen(s, "Das ist die Auflösung des roten Fadens. Neun Testfälle sichern die "
               "Berechnung ab; einer prüft ausdrücklich die Reihenfolge, weil genau dort "
               "der teure Fehler sitzt.")

    s = folie(prs, "6 · Implementierung", "Dokumentation, die nicht veralten kann",
              "Ein Data Dictionary, das von Hand gepflegt wird, ist nach dem zweiten "
              "Release falsch. Die Lösung ist, es aus dem Systemkatalog zu erzeugen — und "
              "die Vollständigkeit maschinell zu erzwingen.")
    code_kacheln(s,
        ("Beschreibung an das Objekt",
         ["comment on column",
          "  velocity.fahrrad_position.station_id is",
          "  'NULL bedeutet: das Rad steht frei",
          "   abgestellt, nicht an einer Station';",
          "",
          "Der Kommentar erklärt, was NULL",
          "bedeutet — nicht, wie die Spalte heißt."], BLAU),
        ("Vollständigkeit erzwingen",
         ["-- Test schlägt fehl, solange eine",
          "-- Fachspalte ohne Kommentar ist",
          "where col_description(c.oid, a.attnum)",
          "      is null",
          "  and a.attname not in",
          "      ('erstellt_am','geaendert_am');",
          "",
          "316 Spalten, 264 beschrieben,",
          "52 technische Audit-Spalten ausgenommen."], GRUEN_D),
        y=176, hoehe=240)
    notizen(s, "Der Trick ist der Test, nicht der Kommentar. Ohne ihn schreibt man die "
               "ersten zwanzig Kommentare und vergisst die restlichen zweihundert.")

    # ═══════════════════════════════════════════════════ 7 Sicherheit
    kapitel(prs, 7, "Zugriffsschutz",
            "Wer außer Anna darf Annas Daten sehen?",
            "Der Schutz liegt in der Datenbank. Auf den Browser ist grundsätzlich kein "
            "Verlass.")

    s = folie(prs, "7 · Zugriffsschutz", "Der Schlüssel im Browser ist kein Geheimnis",
              "Supabase liefert den anon-Key an jeden Besucher aus. Er steht im Quelltext "
              "der Seite. Jeder kann damit beliebige Anfragen stellen — mit curl, ohne die "
              "Website je zu öffnen.")
    vorher_nachher(s,
        ("das Antipattern", "Der häufigste Supabase-Anfängerfehler",
         ["create policy \"alles fuer alle\"",
          "  on kunde for all",
          "  to anon, authenticated",
          "  using (true) with check (true);",
          "",
          "Folge: jeder mit dem öffentlichen",
          "Schlüssel liest UND ändert sämtliche",
          "Kundendaten — auch Annas."], False),
        ("default deny", "Was nicht erlaubt ist, ist verboten",
         ["-- RLS auf jeder Basistabelle",
          "alter table … enable row level security;",
          "",
          "-- keine Policy für anon",
          "-- Lesen nur über v_-Sichten",
          "-- Schreiben nur über api_-Funktionen",
          "",
          "Anna sieht ihre Fahrt, sonst niemand."], False),
        y=176, hoehe=220)
    sandband(s, "Jede Zugriffsbeschränkung, die im JavaScript steht, ist wirkungslos.", y=410)
    notizen(s, "Im Schema velocity_demo liegt eine Tabelle mit erfundenen Daten, an der die "
               "Studierenden das Antipattern live ausprobieren dürfen — ohne den echten "
               "Bestand zu öffnen.")

    s = folie(prs, "7 · Zugriffsschutz", "Was der Browser erreicht — und was nicht",
              "Zwei Schichten trennen die Anwendung von den Tabellen — die Fachlogik dazwischen "
              "prüft selbst nicht auf den angemeldeten Nutzer.")
    oben = unter_intro(s)
    diagramm(s, bild("sicherheit-schichten"), y=oben, hoehe=ZONE_UNTEN - 12 - oben)
    notizen(s, "Der untere rote Kasten ist der Kern: fn_ausleihe_beenden bekommt die "
               "kunde_id als Parameter und glaubt sie. Wäre die Funktion von außen "
               "aufrufbar, könnte jeder fremde Ausleihen abrechnen.")

    s = folie(prs, "7 · Zugriffsschutz", "Die Falle, die fast jeder übersieht",
              "PostgreSQL vergibt das Ausführungsrecht auf jede neu angelegte Funktion "
              "automatisch an die Rolle PUBLIC. Ein Entzug gegen einzelne Rollen greift "
              "deshalb nicht.")
    vorher_nachher(s,
        ("wirkungslos", "REVOKE gegen die Rollen allein",
         ["revoke all on all functions",
          "  in schema velocity",
          "  from anon, authenticated;",
          "",
          "Beide erben das Recht weiterhin",
          "über PUBLIC. Die Fachlogik bleibt",
          "aufrufbar."], False),
        ("wirksam", "PUBLIC ausdrücklich mit entziehen",
         ["revoke all on all functions",
          "  in schema velocity",
          "  from public, anon, authenticated;",
          "",
          "alter default privileges",
          "  in schema velocity",
          "  revoke execute on functions",
          "  from public;"], False),
        y=176, hoehe=210)
    sandband(s, "Aufgedeckt hat das ein Test, nicht Nachdenken. Rechte werden geprüft, "
                "nicht angenommen.", y=400)
    notizen(s, "Die zweite Anweisung verhindert den Rückfall bei künftig angelegten "
               "Funktionen. Ohne sie schnappt die Falle beim nächsten CREATE FUNCTION "
               "wieder zu.")

    s = folie(prs, "7 · Zugriffsschutz", "Nachweis statt Behauptung — auf drei Wegen",
              "Ein Sicherheitskonzept, das nur beschrieben ist, ist wertlos. Geprüft wird in "
              "der Datenbank, über die Schnittstelle und im Browser.")
    regel_streifen(s, [
        ("In der Datenbank", "RLS überall aktiv, anon ohne Tabellenrechte, Rollenwechsel-Probe", "pgTAP, t0011"),
        ("Über die Schnittstelle", "13 gesperrte Ressourcen, 7 öffentliche Sichten", "HTTP 401 gegen 200"),
        ("Im Browser", "Aufrufe der abgemeldeten Seite in der Konsole", "permission denied"),
    ], y=188, hoehe=52, chip_b=200)
    sandkarte(s, "Eine Falle im Prüfwerkzeug selbst",
              ["Der erste Entwurf meldete alle 13 gesperrten Ressourcen als bestanden — "
               "obwohl er nichts geprüft hatte: das Schema war gar nicht exponiert, also war "
               "alles unerreichbar, Sicheres wie Unsicheres.",
               "Ein Test, der „abgesichert“ nicht von „gar nicht erreichbar“ unterscheidet, "
               "ist gefährlicher als kein Test."],
              y=368, warnung=True)
    notizen(s, "Diese Folie ist mir die wichtigste des Blocks. Der häufigste Fehler bei "
               "Sicherheitstests ist nicht der fehlende Test, sondern der Test, der aus dem "
               "falschen Grund grün wird.")

    # ═══════════════════════════════════════════════════ 8 Anbindung
    kapitel(prs, 8, "Anwendung anbinden",
            "Wie kommt Annas Fahrt in die Web-Anwendung?",
            "Die Sichten sind der Vertrag zwischen Datenbank und Oberfläche.")

    s = folie(prs, "8 · Anwendung anbinden", "Nur Sichten lesen, nur Funktionen schreiben",
              "Die Anwendung kennt keine einzige Basistabelle. Das ist keine Konvention, "
              "sondern erzwungen: sie käme gar nicht an sie heran.")
    code_kacheln(s,
        ("Lesen — ausschließlich Sichten",
         ["from('v_station')",
          "from('v_verfuegbares_fahrrad')",
          "from('v_tarifkarte')",
          "from('v_faq')",
          "from('v_kennzahl')",
          "",
          "-- angemeldet:",
          "from('v_meine_ausleihe')",
          "from('v_mein_profil')"], BLAU),
        ("Schreiben — ausschließlich Funktionen",
         ["rpc('api_kunde_sicherstellen')",
          "rpc('api_ausleihe_starten')",
          "rpc('api_ausleihe_beenden')",
          "rpc('api_profil_aktualisieren')",
          "",
          "-- nicht erreichbar:",
          "from('kunde')      permission denied",
          "from('ausleihe')   permission denied",
          "rpc('fn_…')        permission denied"], GRUEN_D),
        y=176, hoehe=240)
    faden(s, "Anna sieht ihre Fahrt über v_meine_ausleihe — begrenzt durch RLS auf ihre eigenen Zeilen.")
    notizen(s, "Auch die Inhalte der Seite kommen aus der Datenbank: Tarifkarten, FAQ, die "
               "Schritte der Anleitung und die Kennzahlen. Vorher standen sie fest im HTML "
               "und mussten bei jeder Preisänderung von Hand nachgezogen werden.")

    # ═══════════════════════════════════════════════════ 9 Abschluss
    kapitel(prs, 9, "Zusammenfassung und Ausblick",
            "Was fehlt noch, damit Annas Rad auch gewartet wird?",
            "Sechs Sätze zum Mitnehmen — und ein Blick auf die Warenwirtschaft.")

    s = folie(prs, "9 · Zusammenfassung", "Sechs Sätze, die diese Einheit tragen",
              "Wenn Sie nichts anderes mitnehmen, dann diese sechs. Zu jedem sollten Sie ein "
              "Beispiel aus Annas Fahrt nennen können.")
    regel_streifen(s, [
        ("Reihenfolge", "Anforderungen vor Modell, Modell vor Relationen, Relationen vor DDL", ""),
        ("Kardinalität", "ist eine fachliche Aussage, keine technische Festlegung", ""),
        ("Normalform", "ist notwendig, aber nicht hinreichend", ""),
        ("Constraint", "was nicht erzwungen wird, wird verletzt", ""),
        ("Schutz", "liegt in der Datenbank, nie im Browser", ""),
        ("Nachweis", "Rechte werden geprüft, nicht angenommen", ""),
    ], y=178, hoehe=46, luecke=5, chip_b=0)
    notizen(s, "Zu jedem Satz gibt es eine Folie in dieser Einheit und eine Stelle im "
               "Modell. Das eignet sich als Prüfungsvorbereitung.")

    s = folie(prs, "9 · Ausblick", "Die Warenwirtschaft hängt an denselben Entitäten",
              "Vier weitere Fachbereiche sind bereits entworfen — deshalb war es richtig, "
              "hersteller und fahrradmodell schon jetzt einzuziehen.")
    oben = unter_intro(s)
    diagramm(s, bild("wawi-anschluss"), y=oben, hoehe=ZONE_UNTEN - 40 - oben)
    faden(s, "Meldet Anna einen Defekt, entsteht daraus ein Wartungsauftrag und eine Lagerbewegung.")
    notizen(s, "Der Lehrpunkt beim Lager ist derselbe wie bei den Freiminuten: Bestand "
               "gegen Bewegung. Wer den Lagerbestand als Zahl pflegt, kann ihn nicht mehr "
               "erklären.")

    return prs


if __name__ == "__main__":
    prs = baue()
    prs.save(str(ZIEL))
    print(f"{len(prs.slides._sldIdLst)} Folien geschrieben nach {ZIEL}")
