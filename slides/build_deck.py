#!/usr/bin/env python3
"""Erzeugt das Foliendeck "Datenbankentwurf am Fallbeispiel VeloCity".

Aufruf:
    python3 slides/build_deck.py

Als Vorlage dient ein bestehendes BINT-Deck: daraus kommen Thema,
Layouts und Fußmasken. Alle Folien werden neu gebaut.
"""
from __future__ import annotations

import pathlib
import sys

from pptx import Presentation
from pptx.util import Pt

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from thws import (  # noqa: E402
    BLAU, GRUEN_D, ORANGE, ROT, TUERKIS, TEXT, TEXT_SEK, WEISS,
    ZONE_OBEN, FLUCHT_L, BREITE, SP2, SP2_B,
    ampel_matrix, code_kacheln, kachelreihe, kopf, notizen, prozesskette,
    regel_streifen, sandband, sandkarte, schichtenstapel, tabelle,
)

VORLAGE = pathlib.Path(
    "/Users/robert/Library/CloudStorage/OneDrive-Persönlich/Vorlesungen/"
    "thws-deck-batch/decks/BINT_E4_Datenmodellierung_WS2627_v3.pptx"
)
ZIEL = pathlib.Path(__file__).resolve().parent / "velocity-datenbankentwurf.pptx"

Q = "Fallstudie VeloCity, Schema velocity auf supabase.butscher.cloud. Quellen im Repository unter doku/datenmodell/."


def leere_praesentation() -> Presentation:
    prs = Presentation(str(VORLAGE))
    liste = prs.slides._sldIdLst
    for sld in list(liste):
        prs.part.drop_rel(sld.rId)
        liste.remove(sld)
    return prs


def lay(prs, name):
    return next(l for l in prs.slide_layouts if l.name == name)


def kapitel(prs, nummer, titel, notiz):
    s = prs.slides.add_slide(lay(prs, "Chapter"))
    for ph in s.placeholders:
        if ph.placeholder_format.idx == 0:
            # Größe und Farbe kommen aus dem Master des Vorlagendecks.
            ph.text_frame.text = f"{nummer} · {titel}"
    notizen(s, notiz)
    return s


def folie(prs, kicker, titel, intro=None, quelle=Q):
    s = prs.slides.add_slide(lay(prs, "Slide"))
    kopf(s, kicker, titel, quelle=quelle, intro=intro)
    return s


def baue() -> Presentation:
    prs = leere_praesentation()

    # ============================================================ Titel
    s = prs.slides.add_slide(lay(prs, "Frontpage_Digital"))
    for ph in s.placeholders:
        i = ph.placeholder_format.idx
        if i == 10:
            ph.text_frame.text = "Datenbankentwurf am Fallbeispiel VeloCity"
            for p in ph.text_frame.paragraphs:
                for r in p.runs:
                    r.font.size = Pt(30); r.font.bold = True; r.font.color.rgb = BLAU
        elif i == 11:
            ph.text_frame.text = ("Vom Fachkonzept zur abgesicherten Datenhaltung — "
                                  "Anforderungen, ERM, Normalisierung, Relationenmodell, "
                                  "DDL, Zugriffsschutz")
            for p in ph.text_frame.paragraphs:
                for r in p.runs:
                    r.font.size = Pt(15); r.font.color.rgb = TEXT_SEK
    notizen(s, "Wir entwerfen in dieser Einheit eine Datenhaltung von Grund auf. Kein "
               "vorhandenes Schema, kein Umbau: ein Unternehmen kommt mit einem Auftrag, "
               "und am Ende steht eine Datenbank, die ihre Geschäftsregeln selbst "
               "durchsetzt. Das Beispiel ist ein Bike-Sharing-System in Würzburg.")

    # Lernziele
    s = folie(prs, "Orientierung", "Was Sie nach dieser Einheit können",
              "Der Entwurfszyklus ist kein Ritual, sondern eine Reihenfolge mit Grund: jeder "
              "Schritt trifft Entscheidungen, die der nächste voraussetzt. Wer Spalten "
              "entwirft, bevor die Geschäftsregeln stehen, baut ein Modell für eine "
              "Wirklichkeit, die er nicht geprüft hat.")
    kachelreihe(s, [
        ("Modellieren",
         ["Aus einem Fachtext ein ERM ableiten",
          "Kardinalitäten als prüfbare Aussagen formulieren",
          "Surrogat- und Fachschlüssel unterscheiden"]),
        ("Prüfen",
         ["Funktionale Abhängigkeiten benennen",
          "1NF bis 3NF am Beispiel durchführen",
          "Erkennen, wo Normalisierung nicht genügt"]),
        ("Umsetzen",
         ["Geschäftsregeln in Constraints übersetzen",
          "Zugriffsschutz in der Datenbank verankern",
          "Die Umsetzung nachweisen statt behaupten"]),
    ])
    notizen(s, "Drei Ebenen: modellieren, prüfen, umsetzen. Die dritte ist die, die in "
               "Lehrbüchern oft fehlt — ein Modell ist erst fertig, wenn die Regeln auch "
               "erzwungen werden.")

    # Agenda
    s = folie(prs, "Orientierung", "Der Entwurfszyklus gibt die Gliederung vor",
              "Die Reihenfolge ist zwingend. Anforderungen vor Modell, Modell vor Relationen, "
              "Relationen vor DDL. Wer sie umdreht, bindet sich an eine Umsetzung, bevor er "
              "weiss, was umzusetzen ist.")
    prozesskette(s, "Fachkonzept",
                 [("Anforderungen", None),
                  ("ERM", None),
                  ("Normal-formen", None),
                  ("Relationen", None),
                  ("DDL", None),
                  ("Zugriffs-schutz", None)],
                 "Anwendung", y=270, hoehe=80)
    notizen(s, "Sechs Schritte. Rechts steht die Anwendung — sie ist Abnehmer, nicht "
               "Ausgangspunkt. Die Datenbank wird nicht für eine Oberfläche entworfen, "
               "sondern für das Geschäft.")

    # ================================================== 1 Fallstudie
    kapitel(prs, 1, "Die Fallstudie",
            "Bevor irgendetwas modelliert wird, muss das Geschäft verstanden sein.")

    s = folie(prs, "1 · Die Fallstudie", "VeloCity vermietet Räder minutengenau",
              "Ein Bike-Sharing-System in Würzburg. Kunden finden freie Räder auf einer "
              "Karte, entleihen sie, fahren und stellen sie wieder ab. Vielfahrer schliessen "
              "einen Tarif ab, der Freiminuten und Rabatt mitbringt.")
    kachelreihe(s, [
        ("Drei Fahrzeugklassen",
         ["City-Bike, Stadtrad ohne Motor",
          "E-Bike Sport, Pedelec bis 25 km/h",
          "E-Cargo Loader, Lastenrad bis 100 kg"]),
        ("Zwei Abstellarten",
         ["An einer festen Station, kostenfrei",
          "Frei im Stadtgebiet gegen Zuschlag",
          "Beides muss das Modell abbilden"]),
        ("Vier Tarife",
         ["Basis ohne Freiminuten",
          "Student und OEPNV mit Kontingent",
          "Premium mit Rabatt und Monatspreis"]),
    ])
    notizen(s, "Wichtig ist die zweite Kachel: Free-Floating heisst, dass ein Rad auch "
               "ohne Station eine Position haben muss. Das entscheidet später über die "
               "Struktur der Positionsdaten.")

    s = folie(prs, "1 · Die Fallstudie", "Zehn Geschäftsregeln, die das Modell tragen müssen",
              "Diese Regeln sind die fachliche Substanz. Entscheidend ist nicht, sie zu "
              "notieren, sondern dass jede einzelne am Ende erzwungen wird — von der "
              "Datenbank, nicht von der Anwendung.")
    regel_streifen(s, [
        ("GR1", "Ein Rad ist höchstens einmal gleichzeitig ausgeliehen", "partieller UNIQUE-Index"),
        ("GR2", "Ein Kunde hat höchstens vier aktive Ausleihen", "Prüfung in der Funktion"),
        ("GR3", "Ein Kunde hat zu einem Zeitpunkt einen Tarif", "EXCLUDE-Constraint"),
        ("GR4", "Preise und Konditionen überlappen sich nie", "EXCLUDE-Constraint"),
        ("GR5", "Bepreist wird mit dem Preis zur Startzeit", "in fn_ausleihe_beenden"),
    ], y=190)
    notizen(s, "Fünf von zehn. Rechts steht schon, wo die Regel später landet — das ist "
               "der rote Faden durch die ganze Einheit.")

    s = folie(prs, "1 · Die Fallstudie", "Die übrigen fünf Regeln und wo sie greifen",
              "Nicht jede Regel lässt sich als Constraint formulieren. Drei brauchen "
              "Kontext, den eine Tabelle nicht hat: den angemeldeten Nutzer, das heutige "
              "Datum, den Zustand anderer Zeilen.")
    regel_streifen(s, [
        ("GR6", "Angefangene Minuten werden aufgerundet", "GENERATED-Spalte"),
        ("GR7", "Verbrauch übersteigt nie das Kontingent", "CHECK-Constraint"),
        ("GR8", "Mindestalter 16 Jahre", "in der API-Funktion"),
        ("GR9", "Nur der Kunde beendet seine Ausleihe", "auth.uid()-Prüfung"),
        ("GR10", "Eine Rechnung je Kunde und Monat", "UNIQUE-Constraint"),
    ], y=190)
    notizen(s, "GR8 ist der interessante Fall: das Mindestalter wäre als CHECK verlockend, "
               "ist aber falsch. Warum, klaeren wir im physischen Entwurf.")

    # ================================================== 2 Konzeptionell
    kapitel(prs, 2, "Konzeptioneller Entwurf",
            "Entitäten, Beziehungen, Kardinalitäten — noch keine Datenbank.")

    s = folie(prs, "2 · Konzeptioneller Entwurf", "Ein ERM ist eine Behauptung über die Wirklichkeit",
              "Jede Kardinalität sagt etwas über das Geschäft aus und kann falsch sein. "
              "„Ein Kunde hat höchstens einen gültigen Tarif“ ist keine technische "
              "Festlegung, sondern eine Entscheidung des Fachbereichs.")
    kachelreihe(s, [
        ("Entität",
         ["Ein Ding, über das Daten gehalten werden",
          "Im Text meist ein Substantiv",
          "Beispiel: Kunde, Station, Ausleihe"]),
        ("Beziehung",
         ["Eine Verbindung zwischen Entitäten",
          "Im Text meist ein Verb",
          "Beispiel: Kunde tätigt Ausleihe"]),
        ("Kardinalität",
         ["Wie viele auf jeder Seite stehen",
          "Die eigentliche fachliche Aussage",
          "Muss mit dem Fachbereich geklärt sein"]),
    ])
    notizen(s, "Merksatz: Substantive werden Entitäten, Verben werden Beziehungen. Das "
               "ist eine Heuristik zum Einstieg, kein Automatismus.")

    s = folie(prs, "2 · Konzeptioneller Entwurf", "Zehn Fachbereiche, davon sechs jetzt umgesetzt",
              "Die Aufteilung folgt dem Geschäft, nicht der Technik. Bereiche, die "
              "zusammen geändert werden, gehören zusammen.")
    schichtenstapel(s, [
        ("A Geschäftspartner · adresse, kunde", False),
        ("B Netz und Flotte · station, fahrradtyp, hersteller, fahrradmodell, fahrrad, fahrrad_position", False),
        ("C Tarif und Preis · tarif, tarif_kondition, mitgliedschaft, freiminuten_periode, nutzungspreis", True),
        ("D Nutzung · ausleihe, entgeltart, entgeltposition", True),
        ("E Abrechnung · zahlungsart, zahlungsmittel, rechnung, rechnungsposition, zahlung", False),
        ("F Redaktionsinhalte · faq_eintrag, nutzungsschritt, kennzahl", False),
    ], y=182, hoehe=42, luecke=8)
    notizen(s, "Blau hervorgehoben sind die beiden Bereiche, die den fachlichen Kern "
               "tragen: die zeitabhaengige Bepreisung und der Nutzungsvorgang selbst. "
               "Vier weitere Bereiche G bis J bilden später die Warenwirtschaft.")

    s = folie(prs, "2 · Konzeptioneller Entwurf", "Vier Entscheidungen, die den Unterschied machen",
              "Ein Modell besteht nicht aus Tabellen, sondern aus Entscheidungen. Diese vier "
              "sind die, die man begründen können muss.")
    regel_streifen(s, [
        ("Adresse eigenständig", "wird von Kunde, Station, Lieferant und Lager gebraucht", "keine vierfache Redundanz"),
        ("Preise nicht am Typ", "ein Preis gilt für einen Zeitraum, nicht für immer", "nutzungspreis mit daterange"),
        ("Position als Satellit", "Stammdaten ruhig halten, Bewegungsdaten trennen", "fahrrad_position 1:1"),
        ("Freiminuten je Periode", "ein Zähler verliert seine Geschichte", "Bestand und Bewegung"),
    ], y=200, hoehe=54, chip_b=230)
    notizen(s, "Die zweite Entscheidung ist die folgenreichste. Läge der Preis am Typ, "
               "würde jede Preisanpassung rückwirkend alle Altrechnungen neu bewerten.")

    s = folie(prs, "2 · Konzeptioneller Entwurf", "Vier weitere Entscheidungen mit Begründung",
              "Auch das Weglassen ist eine Entscheidung. Zwei der vier bestehen darin, "
              "etwas bewusst nicht zu tun.")
    regel_streifen(s, [
        ("Dauer ableiten", "folgt zwingend aus Start und Ende, wird nicht gepflegt", "GENERATED-Spalte"),
        ("Kein EAV", "generische Schlüssel-Wert-Tabellen verlieren alles Prüfbare", "drei konkrete Tabellen"),
        ("Modell zwischen Typ und Rad", "Ersatzteile hängen am Modell, nicht am Einzelrad", "Brücke zur Warenwirtschaft"),
        ("Positionen statt Betrag", "ein Betrag verrät nicht, wie er zustande kam", "entgeltposition je Zeile"),
    ], y=200, hoehe=54, chip_b=230)
    notizen(s, "Die letzte Entscheidung ist der Kern der Abrechnung: Startgebühr, "
               "Zeitentgelt, Freiminuten, Rabatt und Kappung stehen als eigene Zeilen auf "
               "der Rechnung. Der Kunde sieht, was sein Tarif wert war.")

    # ================================================== 3 Normalisierung
    kapitel(prs, 3, "Normalisierung",
            "Ein Prüfverfahren, kein Entwurfsverfahren.")

    s = folie(prs, "3 · Normalisierung", "Die Ausgangstabelle: alles in einer Relation",
              "So würde jemand die Ausleihe aufschreiben, der noch nicht normalisiert hat. "
              "Wir zerlegen sie in drei Schritten und beobachten, welche Anomalie jeder "
              "Schritt beseitigt.")
    code_kacheln(s,
        ("ausleihe_flach — der Ausgangszustand",
         ["ausleihe_id", "kunde_email", "kunde_name", "kunde_strasse",
          "kunde_plz", "kunde_ort", "rahmennummer", "typ_bezeichnung",
          "startgebuehr", "preis_pro_minute", "tageshoechstpreis",
          "startzeit", "endzeit", "dauer_minuten", "kosten", "positionen"], ROT),
        ("Die drei Befunde",
         ["1NF  kunde_name trägt Vor- und Nachname",
          "     positionen trägt mehrere Zeilen",
          "",
          "2NF  kunde_email hängt nur an ausleihe_id,",
          "     nicht am ganzen Schlüssel",
          "",
          "3NF  rahmennummer -> typ_bezeichnung",
          "                 -> preis_pro_minute",
          "",
          "     dauer_minuten und kosten sind",
          "     abgeleitet, nicht elementar"], BLAU),
        y=178, hoehe=300)
    notizen(s, "Erst die Befunde sammeln, dann zerlegen. Wer sofort zerlegt, weiss "
               "hinterher nicht, welches Problem er geloest hat.")

    s = folie(prs, "3 · Normalisierung", "Erste und zweite Normalform am Beispiel",
              "Die 1NF verlangt atomare Attribute. Der lehrreichere Fall ist die "
              "wiederholende Gruppe: sie wird zu einer eigenen Relation, nicht zu "
              "mehreren Spalten.")
    kachelreihe(s, [
        ("1NF · atomar",
         ["kunde_name wird zu vorname und nachname",
          "positionen wird eine eigene Relation",
          "",
          "NICHT position1, position2, position3 —",
          "das legt die Anzahl im Schema fest"]),
        ("2NF · keine partielle Abhängigkeit",
         ["Schlüssel (ausleihe_id, position_nr)",
          "kunde_email hängt nur an ausleihe_id",
          "",
          "Folge: Trennung in Kopf und Positionen",
          "Das Kopf-Positionen-Muster ist keine",
          "Konvention, sondern eine Folge der 2NF"]),
    ], y=182, hoehe=190, spalten=2)
    sandband(s, "Merksatz: Eine wiederholende Gruppe wird zu Zeilen, niemals zu Spalten.", y=396)
    notizen(s, "Das Kopf-Positionen-Muster kennen die meisten aus der Praxis. Hier sehen "
               "sie zum ersten Mal, dass es formal begründbar ist.")

    s = folie(prs, "3 · Normalisierung", "Dritte Normalform — und warum sie hier nicht genügt",
              "Die transitive Abhängigkeit vom Rad über den Typ zum Preis ist der "
              "klassische 3NF-Verstoß. Sie aufzulösen ist notwendig, reicht aber fachlich "
              "nicht aus.")
    code_kacheln(s,
        ("Die transitive Kette",
         ["ausleihe_id",
          "   -> rahmennummer",
          "      -> typ_bezeichnung",
          "         -> preis_pro_minute",
          "",
          "Änderungsanomalie: eine Preisänderung",
          "müsste in jeder Ausleihzeile",
          "nachgezogen werden."], ROT),
        ("Nach der Zerlegung — und danach",
         ["3NF:  fahrradtyp und nutzungspreis",
          "      werden eigene Relationen",
          "",
          "ABER: liegt der Preis am Typ, ändert",
          "      eine Anpassung weiterhin",
          "      rückwirkend alle Altrechnungen",
          "",
          "Erst der Gültigkeitszeitraum in",
          "nutzungspreis macht es richtig."], GRUEN_D),
        y=182, hoehe=240)
    sandband(s, "Normalisierung beseitigt Redundanz. Sie ersetzt keine fachliche Analyse.", y=436)
    notizen(s, "Das ist die zentrale Botschaft des Blocks. Die Normalform ist notwendig, "
               "nicht hinreichend.")

    s = folie(prs, "3 · Normalisierung", "Exkurs: aus der Postleitzahl folgt nicht der Ort",
              "Der Lehrbuchklassiker lautet, plz bestimme ort, also gehöre ort in eine "
              "eigene Relation. In Deutschland stimmt das nicht — und der scheinbar saubere "
              "Zerlegungsschritt wäre fachlich falsch.")
    ampel_matrix(s, ["gilt"], [
        ("Eine PLZ hat genau einen Ort", [False],
         "Ländliche Sammel-PLZ umfassen mehrere Orte"),
        ("Ein Ort hat genau eine PLZ", [False],
         "Großstädte haben Dutzende"),
        ("plz -> ort ist funktional", [False],
         "Also keine transitive Abhängigkeit, kein Split"),
    ], y=210, zeilen_h=54, chip_b=80, label_b=340)
    sandband(s, "Eine funktionale Abhängigkeit ist eine Behauptung über die Wirklichkeit "
                "und muss geprüft werden — nicht aus Namensähnlichkeit geschlossen.", y=404)
    notizen(s, "Hier lohnt es sich, im Data Dictionary den Spaltenkommentar zu zeigen: "
               "die Begründung steht direkt an der Spalte und veraltet nicht.")

    # ================================================== 4 Logisch
    kapitel(prs, 4, "Logischer Entwurf",
            "Vom ERM zum Relationenmodell — regelbasiert und damit prüfbar.")

    s = folie(prs, "4 · Logischer Entwurf", "Die Abbildung folgt festen Regeln",
              "Wer eine 1:N-Beziehung auf der Eins-Seite verankert, hat nicht anders "
              "entworfen, sondern falsch abgebildet. Genau deshalb ist dieser Schritt "
              "korrigierbar.")
    tabelle(s, ["ERM-Konstrukt", "Abbildung ins Relationenmodell", "Beispiel im Modell"],
            [["Entitätstyp", "eigene Relation", "kunde, station, ausleihe"],
             ["Attribut", "Spalte", "vorname, kapazitaet"],
             ["1:N-Beziehung", "Fremdschlüssel auf der N-Seite", "ausleihe.kunde_id"],
             ["1:1-Beziehung", "FK auf der optionalen Seite, dort zugleich PK", "fahrrad_position.fahrrad_id"],
             ["M:N-Beziehung", "eigene Verknüpfungsrelation", "in Phase 2: wartungsposition"],
             ["Mehrwertiges Attribut", "eigene Relation", "fahrradtyp_merkmal"]],
            y=190, spalten_b=[210, 400, 293.5], zeilen_h=32)
    notizen(s, "Die 1:1-Abbildung ist die elegante: fahrrad_id ist in fahrrad_position "
               "zugleich Primär- und Fremdschlüssel. Damit ist „höchstens eine Position "
               "je Rad“ ohne zusätzlichen Constraint erzwungen.")

    s = folie(prs, "4 · Logischer Entwurf", "Jede Relation trägt zwei Schlüssel",
              "Surrogatschlüssel als Primärschlüssel, fachlicher Schlüssel als "
              "Eindeutigkeitsbedingung. Beide haben eine Aufgabe, keiner ersetzt den anderen.")
    ampel_matrix(s, ["stabil", "eindeutig", "sprechend"], [
        ("Surrogatschlüssel  kunde_id", [True, True, False],
         "Primärschlüssel"),
        ("Fachschlüssel  kundennummer", [False, True, True],
         "UNIQUE-Bedingung"),
        ("Fachschlüssel als PK", [False, True, True],
         "Änderung zieht durch alle Verweise"),
    ], y=210, zeilen_h=54, chip_b=86, label_b=290)
    sandband(s, "Eine Rahmennummer wird beim Rahmentausch neu vergeben. Ein Primärschlüssel, "
                "der sich ändert, zieht die Änderung durch jede verweisende Relation.", y=404)
    notizen(s, "Die dritte Zeile ist der häufigste Anfängerfehler: den sprechenden "
               "Schlüssel zum Primärschlüssel machen. Er ist eindeutig und sprechend — "
               "aber eben nicht stabil.")

    # ================================================== 5 Physisch
    kapitel(prs, 5, "Physischer Entwurf",
            "Hier wird eine Geschäftsregel entweder erzwungen oder nur gewuenscht.")

    s = folie(prs, "5 · Physischer Entwurf", "Datentypen sind fachliche Entscheidungen",
              "Jede Zeile dieser Tabelle hat einen Grund, der über Geschmack hinausgeht. "
              "Die beiden ersten sind die, an denen in der Praxis am meisten schiefgeht.")
    tabelle(s, ["Zweck", "Typ", "Warum genau dieser"],
            [["Zeitpunkt", "timestamptz", "timestamp ohne Zone verliert den Bezug; Sommerzeit wird doppeldeutig"],
             ["Geldbetrag", "numeric(10,2)", "exakte Dezimalarithmetik; float trifft 0,10 nicht genau"],
             ["Zeitraum", "daterange", "ein Zeitraum ist ein Wert, kein Spaltenpaar — erst so prüfbar"],
             ["Surrogatschlüssel", "bigint IDENTITY", "standardkonform; ALWAYS verhindert Setzen von außen"],
             ["Koordinate", "numeric(9,6)", "sechs Nachkommastellen entsprechen etwa elf Zentimetern"],
             ["Text", "text", "PostgreSQL speichert text und varchar(n) identisch"]],
            y=190, spalten_b=[180, 170, 553.5], zeilen_h=32)
    notizen(s, "Die Zeitzonenfalle ist real: eine Ausleihe in der Nacht der "
               "Zeitumstellung lässt sich mit timestamp ohne Zone nicht eindeutig "
               "einordnen.")

    s = folie(prs, "5 · Physischer Entwurf", "ENUM oder Referenztabelle — die Regel dahinter",
              "Beide beschränken Werte. Die Wahl folgt nicht dem Geschmack, sondern drei "
              "Fragen: wächst die Menge, trägt sie Attribute, muss die Anwendung sie "
              "interpretieren?")
    ampel_matrix(s, ["geschlossen", "Attribute", "wächst"], [
        ("ENUM  fahrrad_status", [True, False, False],
         "verfuegbar, ausgeliehen, wartung, defekt"),
        ("Referenztabelle  entgeltart", [False, True, True],
         "trägt vorzeichen: belastet oder entlastet"),
    ], y=210, zeilen_h=56, chip_b=96, label_b=290)
    sandkarte(s, "Warum entgeltart kein ENUM ist",
              ["Die Preisfindung wertet das Attribut vorzeichen aus. Als ENUM müsste die "
               "Anwendung wissen, welche Art belastet und welche entlastet —",
               "das Wissen läge dann im Code statt in den Daten."], y=384)
    notizen(s, "Preis des ENUM: Erweitern nur mit ALTER TYPE, Umbenennen aufwendig, "
               "Sortierreihenfolge nachtraeglich nicht änderbar.")

    s = folie(prs, "5 · Physischer Entwurf", "Sieben von zehn Regeln erzwingt die Datenbank",
              "Jede Regel, die nicht in einem Constraint, einem Index oder einer Funktion "
              "steht, wird früher oder später verletzt. Die drei übrigen brauchen "
              "Kontext, den ein Constraint nicht hat.")
    tabelle(s, ["Regel", "Umsetzung", "Ort"],
            [["GR1", "CREATE UNIQUE INDEX … WHERE status = 'aktiv'", "partieller Index"],
             ["GR3, GR4", "EXCLUDE USING gist (… WITH =, … WITH &&)", "Constraint"],
             ["GR6", "GENERATED ALWAYS AS (ceil(…)) STORED", "berechnete Spalte"],
             ["GR7", "CHECK (verbraucht <= kontingent)", "Constraint"],
             ["GR10", "UNIQUE (kunde_id, periode_jahr, periode_monat)", "Constraint"],
             ["GR2, GR5", "Prüfung in fn_ausleihe_starten / _beenden", "Funktion"],
             ["GR8, GR9", "Prüfung in der api_-Schicht", "Funktion"]],
            y=186, spalten_b=[130, 500, 273.5], zeilen_h=30)
    notizen(s, "Der Unterschied zwischen den oberen fünf und den unteren zwei Zeilen ist "
               "wichtig: die oberen gelten immer, auch bei direktem SQL-Zugriff. Die "
               "unteren nur, wenn man den vorgesehenen Weg nimmt.")

    s = folie(prs, "5 · Physischer Entwurf", "EXCLUDE verhindert, was UNIQUE nicht kann",
              "Ein UNIQUE kennt nur Gleichheit. Für „diese Zeiträume dürfen sich nicht "
              "überschneiden“ braucht es einen Operator, der Ueberlappung prüfen kann.")
    code_kacheln(s,
        ("Der Constraint",
         ["constraint nutzungspreis_ueberschneidung_ex",
          "  exclude using gist (",
          "    typ_id      with =,",
          "    gueltigkeit with &&",
          "  )",
          "",
          "Zu lesen als: es darf keine zwei Zeilen",
          "geben, bei denen typ_id gleich UND die",
          "Zeiträume überlappend sind."], BLAU),
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
          "   belegt und der Constraint schlägt an."], ORANGE),
        y=182, hoehe=250)
    notizen(s, "Beide Fallstricke sind uns tatsächlich begegnet. Der erste hat die "
               "Anlage abgebrochen, der zweite wäre bei nahtlosen Tarifwechseln "
               "aufgefallen.")

    s = folie(prs, "5 · Physischer Entwurf", "Warum das Mindestalter kein CHECK sein darf",
              "Naheliegend wäre eine Bedingung mit current_date. PostgreSQL akzeptiert sie "
              "sogar. Trotzdem ist sie falsch — und der Grund zeigt, was ein CHECK "
              "eigentlich ist.")
    code_kacheln(s,
        ("Verlockend und falsch",
         ["check (geburtsdatum <=",
          "       current_date - interval '16 years')",
          "",
          "current_date ist nicht IMMUTABLE.",
          "",
          "Ein CHECK wird beim Schreiben geprüft",
          "UND beim Wiedereinspielen eines Dumps.",
          "",
          "Ein Kunde, der bei der Anmeldung 16 war,",
          "bleibt es. Eine Bedingung, die sich auf",
          "„heute“ bezieht, kann den Restore",
          "abbrechen lassen."], ROT),
        ("Richtig",
         ["-- auf der Tabelle: nur immutable",
          "check (geburtsdatum is null",
          "   or geburtsdatum between",
          "      date '1900-01-01'",
          "  and date '2100-01-01')",
          "",
          "-- die Altersregel in der Funktion:",
          "if p_geburtsdatum >",
          "   current_date - interval '16 years'",
          "then",
          "  return 'Mindestalter nicht erreicht';",
          "end if;"], GRUEN_D),
        y=182, hoehe=250)
    sandband(s, "Merksatz: Ein CHECK darf nur von der Zeile selbst abhängen — und von "
                "nichts, was sich mit der Zeit ändert.", y=438)
    notizen(s, "Gute Prüfungsfrage: Warum ist eine CHECK-Bedingung mit current_date "
               "gefährlich, obwohl die Datenbank sie annimmt?")

    # ================================================== 6 Implementierung
    kapitel(prs, 6, "Implementierung",
            "Aufbauschritte, Sichten als Vertrag, Preisfindung, Dokumentation.")

    s = folie(prs, "6 · Implementierung", "Zwölf Aufbauschritte, jeder für sich lauffähig",
              "Jede Datei ist idempotent: sie läuft zweimal hintereinander fehlerfrei. Das "
              "ist keine Spielerei, sondern die Voraussetzung dafür, dass man einen Aufbau "
              "gefahrlos wiederholen kann.")
    schichtenstapel(s, [
        ("0001 Schema, Erweiterungen, Aufzählungstypen, Audit-Mechanik", True),
        ("0002 bis 0007 · die sechs Fachbereiche A bis F, 25 Tabellen", False),
        ("0008 Referenzdaten: Entgeltarten, Preise, Tarife, Inhalte", False),
        ("0009 Geschäftslogik: fn_-Fachlogik und api_-Zugriffsschicht", True),
        ("0010 Sichten · 0011 Zugriffsschutz · 0012 Data Dictionary", True),
    ], y=186, hoehe=48, luecke=10)
    notizen(s, "Die Reihenfolge ist die Reihenfolge dieser Vorlesung. Wer 0004 vor 0003 "
               "ausführt, bekommt einen Fremdschlüsselfehler — die Abhängigkeiten sind "
               "im Schema selbst dokumentiert.")

    s = folie(prs, "6 · Implementierung", "Die Preisfindung als Folge sichtbarer Positionen",
              "Das Zeitentgelt wird über ALLE Minuten gebildet und die Freiminuten als "
              "eigene Gutschrift abgezogen. So ist auf der Rechnung ablesbar, was der "
              "Tarifvorteil wert war.")
    tabelle(s, ["Position", "Menge", "Einzelbetrag", "Betrag", "Beispiel 61 Minuten"],
            [["STARTGEBUEHR", "1", "0,10", "+ 0,10", "Startgebühr City-Bike"],
             ["ZEITENTGELT", "61", "0,10", "+ 6,10", "alle gefahrenen Minuten"],
             ["FREIMINUTEN", "30", "0,10", "− 3,00", "Gutschrift aus dem Tarif"],
             ["TARIFRABATT", "1", "20 %", "− 0,64", "auf die Zwischensumme"],
             ["HOECHSTPREIS", "1", "—", "− 0,00", "erst über der Obergrenze"]],
            y=182, spalten_b=[190, 90, 130, 120, 373.5], zeilen_h=30)
    sandband(s, "Reihenfolge: Rabatt VOR der Kappung. Umgekehrt würde der Rabatt den "
                "bereits gedeckelten Betrag ein zweites Mal senken.", y=376)
    notizen(s, "Neun Testfälle sichern das ab. Der wichtigste prüft die Reihenfolge: bei "
               "Höchstpreis 5,00 und 20 Prozent Rabatt kommt 4,96 heraus — bei "
               "umgekehrter Reihenfolge wären es 4,00.")

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
          "comment on column velocity.kunde.geburtsdatum",
          "  is 'Grundlage der Altersgrenze. Geprüft",
          "      in api_profil_aktualisieren, nicht",
          "      per CHECK: current_date ist nicht",
          "      immutable.';"], BLAU),
        ("Vollständigkeit erzwingen",
         ["-- Test schlägt fehl, solange eine",
          "-- Fachspalte ohne Kommentar ist",
          "select string_agg(c.relname||'.'||a.attname, ', ')",
          "  from pg_class c",
          "  join pg_attribute a on a.attrelid = c.oid",
          " where col_description(c.oid, a.attnum) is null",
          "   and a.attname not in",
          "       ('erstellt_am','geaendert_am');",
          "",
          "316 Spalten, 264 mit Beschreibung,",
          "52 technische Audit-Spalten ausgenommen."], GRUEN_D),
        y=182, hoehe=250)
    notizen(s, "Der Trick ist der Test, nicht der Kommentar. Ohne ihn schreibt man die "
               "ersten zwanzig Kommentare und vergisst die restlichen zweihundert.")

    # ================================================== 7 Sicherheit
    kapitel(prs, 7, "Zugriffsschutz",
            "Der Schutz liegt in der Datenbank. Auf den Browser ist kein Verlass.")

    s = folie(prs, "7 · Zugriffsschutz", "Der Schlüssel im Browser ist kein Geheimnis",
              "Supabase liefert den anon-Key an jeden Besucher aus. Er steht im Quelltext "
              "der Seite. Jeder kann damit beliebige Anfragen stellen — mit curl, ohne die "
              "Website je zu öffnen.")
    sandkarte(s, "Daraus folgt zwingend",
              ["Jede Zugriffsbeschränkung, die im JavaScript steht, ist wirkungslos.",
               "Der Schutz muss in der Datenbank liegen: in Rechten, in Row Level Security "
               "und in Sichten, die nur zeigen, was öffentlich sein darf."],
              y=186, warnung=True)
    code_kacheln(s,
        ("Das Antipattern",
         ["create policy \"alles für alle\"",
          "  on kunde for all",
          "  to anon, authenticated",
          "  using (true) with check (true);",
          "",
          "Folge: jeder mit dem öffentlichen",
          "Schlüssel liest UND ändert sämtliche",
          "Kundendaten."], ROT),
        ("Die Grundhaltung",
         ["-- RLS auf jeder Basistabelle",
          "alter table … enable row level security;",
          "",
          "-- keine Policy für anon",
          "-- Lesen nur über v_-Sichten",
          "-- Schreiben nur über api_-Funktionen",
          "",
          "default deny: was nicht ausdrücklich",
          "erlaubt ist, ist verboten."], GRUEN_D),
        y=300, hoehe=192)
    notizen(s, "Das Antipattern ist der häufigste Supabase-Anfängerfehler. Es gibt im "
               "Schema velocity_demo eine Tabelle mit erfundenen Daten, an der die "
               "Studierenden das live ausprobieren dürfen.")

    s = folie(prs, "7 · Zugriffsschutz", "Die Falle, die fast jeder übersieht",
              "PostgreSQL vergibt das Ausführungsrecht auf jede neu angelegte Funktion "
              "automatisch an die Rolle PUBLIC. Ein Entzug gegen einzelne Rollen greift "
              "deshalb nicht.")
    code_kacheln(s,
        ("Wirkungslos",
         ["revoke all on all functions",
          "  in schema velocity",
          "  from anon, authenticated;",
          "",
          "anon und authenticated erben das Recht",
          "weiterhin über PUBLIC.",
          "",
          "Folge: die interne Fachlogik",
          "fn_ausleihe_beenden bleibt aufrufbar —",
          "und die prüft selbst NICHT auf",
          "auth.uid(), weil das die Schicht",
          "darüber tut."], ROT),
        ("Wirksam",
         ["revoke all on all functions",
          "  in schema velocity",
          "  from public, anon, authenticated;",
          "",
          "alter default privileges",
          "  in schema velocity",
          "  revoke execute on functions",
          "  from public;",
          "",
          "Die zweite Anweisung verhindert den",
          "Rückfall bei künftigen Funktionen."], GRUEN_D),
        y=182, hoehe=250)
    sandband(s, "Aufgedeckt hat das ein Test, nicht Nachdenken. Rechte werden geprüft, "
                "nicht angenommen.", y=438)
    notizen(s, "Ohne diesen Entzug hätte jeder mit dem öffentlichen Schlüssel fremde "
               "Ausleihen abrechnen können. Der Test test_s_api_rechte hat es gefunden.")

    s = folie(prs, "7 · Zugriffsschutz", "Nachweis statt Behauptung — auf drei Wegen",
              "Ein Sicherheitskonzept, das nur beschrieben ist, ist wertlos. Geprüft wird "
              "in der Datenbank, über die Schnittstelle und im Browser.")
    regel_streifen(s, [
        ("In der Datenbank", "RLS überall aktiv, anon ohne Tabellenrechte, Rollenwechsel-Probe", "pgTAP, t0011"),
        ("Ueber die Schnittstelle", "13 gesperrte Ressourcen, 7 öffentliche Sichten", "HTTP 401 gegen 200"),
        ("Im Browser", "Aufrufe der abgemeldeten Seite in der Konsole", "permission denied"),
    ], y=192, hoehe=54, chip_b=200)
    sandkarte(s, "Eine Falle im Prüfwerkzeug selbst",
              ["Der erste Entwurf meldete alle 13 gesperrten Ressourcen als bestanden — "
               "obwohl er nichts geprüft hatte: das Schema war gar nicht exponiert, also "
               "war alles unerreichbar, Sicheres wie Unsicheres.",
               "Ein Test, der „abgesichert“ nicht von „gar nicht erreichbar“ unterscheidet, "
               "ist gefährlicher als kein Test."],
              y=380, warnung=True)
    notizen(s, "Diese Folie ist mir wichtig. Der häufigste Fehler bei Sicherheitstests "
               "ist nicht der fehlende Test, sondern der Test, der aus dem falschen Grund "
               "grün wird.")

    # ================================================== 8 Anbindung
    kapitel(prs, 8, "Anwendung anbinden",
            "Die Sichten sind der Vertrag zwischen Datenbank und Oberfläche.")

    s = folie(prs, "8 · Anwendung anbinden", "Nur Sichten lesen, nur Funktionen schreiben",
              "Die Anwendung kennt keine einzige Basistabelle. Das ist keine Konvention, "
              "sondern erzwungen: sie käme gar nicht an sie heran.")
    code_kacheln(s,
        ("Lesen",
         ["from('v_station')",
          "from('v_verfuegbares_fahrrad')",
          "from('v_tarifkarte')",
          "from('v_tarif')",
          "from('v_faq')",
          "from('v_nutzungsschritt')",
          "from('v_kennzahl')",
          "",
          "-- angemeldet:",
          "from('v_meine_ausleihe')",
          "from('v_mein_profil')"], BLAU),
        ("Schreiben",
         ["rpc('api_kunde_sicherstellen')",
          "rpc('api_ausleihe_starten')",
          "rpc('api_ausleihe_beenden')",
          "rpc('api_profil_aktualisieren')",
          "",
          "-- nicht erreichbar:",
          "from('kunde')        permission denied",
          "from('ausleihe')     permission denied",
          "rpc('fn_ausleihe_beenden')",
          "                     permission denied"], GRUEN_D),
        y=182, hoehe=250)
    notizen(s, "Auch die Inhalte der Seite kommen aus der Datenbank: Tarifkarten, FAQ, "
               "die Schritte der Anleitung und die Kennzahlen. Vorher standen sie fest im "
               "HTML und mussten bei jeder Preisänderung von Hand nachgezogen werden.")

    # ================================================== 9 Abschluss
    kapitel(prs, 9, "Zusammenfassung und Ausblick",
            "Was bleibt, und was die Warenwirtschaft ergänzt.")

    s = folie(prs, "9 · Zusammenfassung", "Sechs Sätze, die diese Einheit tragen",
              "Wenn Sie nichts anderes mitnehmen, dann diese sechs. Jeder einzelne ist an "
              "einer Stelle des Modells belegt.")
    regel_streifen(s, [
        ("Reihenfolge", "Anforderungen vor Modell, Modell vor Relationen, Relationen vor DDL", ""),
        ("Kardinalität", "ist eine fachliche Aussage, keine technische Festlegung", ""),
        ("Normalform", "ist notwendig, aber nicht hinreichend", ""),
        ("Constraint", "was nicht erzwungen wird, wird verletzt", ""),
        ("Schutz", "liegt in der Datenbank, nie im Browser", ""),
        ("Nachweis", "Rechte werden geprüft, nicht angenommen", ""),
    ], y=178, hoehe=46, luecke=5, chip_b=0)
    notizen(s, "Die sechs Sätze eignen sich als Prüfungsvorbereitung: zu jedem sollte "
               "man ein Beispiel aus dem Modell nennen können.")

    s = folie(prs, "9 · Ausblick", "Was die Warenwirtschaft ergänzt",
              "Vier weitere Fachbereiche sind bereits entworfen. Sie hängen an denselben "
              "Entitäten — deshalb war es richtig, hersteller und fahrradmodell schon "
              "jetzt einzuziehen.")
    kachelreihe(s, [
        ("G Beschaffung",
         ["lieferant, artikelgruppe, artikel",
          "bestellung, bestellposition",
          "wareneingang"]),
        ("H Lager",
         ["lager, lagerbewegung",
          "lagerbestand als Sicht",
          "",
          "Bestand ist ein Aggregat von",
          "Bewegungen, kein gepflegter Wert"]),
        ("I und J",
         ["schadensmeldung, wartungsauftrag",
          "wartungsposition, fahrrad_ereignis",
          "mitarbeiter, rolle",
          "umsetzungsauftrag"]),
    ], y=182, hoehe=190)
    sandband(s, "Anschlussstellen: fahrrad zu Schadensmeldung und Wartung, station zum "
                "Umsetzungsauftrag, adresse zu Lieferant und Lager.", y=396)
    notizen(s, "Der Lehrpunkt bei H ist derselbe wie bei den Freiminuten: Bestand gegen "
               "Bewegung. Wer den Lagerbestand als Zahl pflegt, kann ihn nicht mehr "
               "erklären.")

    return prs


if __name__ == "__main__":
    prs = baue()
    prs.save(str(ZIEL))
    print(f"{len(prs.slides.__iter__.__self__._sldIdLst)} Folien geschrieben nach {ZIEL}")
