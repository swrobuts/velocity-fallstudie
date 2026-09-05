#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Haelt die "Objekte:"-Aufzaehlung im Kopf jeder db/aufbau/*.sql-Datei
gegen das, was die Datei tatsaechlich anlegt.

ANLASS

Der Kopfkommentar jeder Aufbaudatei traegt unter "Objekte:" eine von Hand
gepflegte Liste dessen, was die Datei anlegt - siehe etwa
db/aufbau/0018_wawi_sichten.sql ab Zeile 10. Legt jemand eine Sicht dazu,
ohne die Liste nachzuziehen, faellt das niemandem auf: die Liste ist dann
still unvollstaendig, und wer sie liest, haelt sie fuer vollstaendig. Sie
wird gelesen - db/aufbau/0018_wawi_sichten.sql selbst listet zwei Sichten,
die auf genau diese Weise fehlen (siehe unten), und tools/data_dictionary.py
sowie die Abnahmedokumentation setzen an anderer Stelle voraus, dass eine
Kopfliste vollstaendig ist.

Dieses Projekt hat dieselbe Fehlerklasse - eine Pruefung bleibt gruen,
waehrend ihre Grundlage aufhoert, vollstaendig zu sein - bereits fuenfmal
gesehen: die Abnahmetabelle in TESTEN.md (36 Zeilen fuer 37 Schritte, ein
eingefuegter Schritt blieb in der Tabelle unnummeriert), die Zahl der
pgTAP-Testfunktionen in TESTEN.md (dreimal falsch: 51, dann 164, dann 178),
die Sichtenliste in Abnahmeschritt 28 von tools/abnahme.sh, und die
Parameterrichtung in tools/mcp_check.py. tools/readme_pruefen.py und
tools/wawi_check.py wurden je als Gegenmassnahme fuer einen Teil davon
gebaut; dieses Werkzeug ist die Gegenmassnahme fuer die Objektlisten in
db/aufbau/.

GEMESSEN AM 05.09.2026

Der erste Lauf fand 19 Abweichungen in sechs Dateien: 0001 (fuenf
Aufzaehlungstypen, die dynamisch ueber eine Wertetabelle entstehen statt
per woertlichem CREATE TYPE - ein Mechanismus, den ein naives Werkzeug
uebersehen haette), 0003 (sechs), 0010 (drei), 0018 (zwei), sowie je eine
in 0004, 0009 und 0022. In 0018 fehlten v_wawi_fahrt_km und
v_wawi_fahrten_je_tag_typ; beide waren spaeter ergaenzt worden, ohne dass
die Objekte-Zeile nachgezogen wurde.

ALLE 19 SIND BEHOBEN (Commit d21760a), das Werkzeug laeuft seither mit
Rueckgabewert 0 durch und haengt in Abnahmeschritt 2. Diese Zahlen stehen
hier als Anlass, nicht als offener Befund - wer sie nachschlagen will,
findet sie im Verlauf jener sieben Dateien.

BIS ZUR ERWEITERUNG VOM 05.09.2026 GALT HIER: das Werkzeug prueft die
Ruecknahme-Zeilen derselben Koepfe nicht. In 0003, 0004 und 0022 waren
sie aus demselben Grund unvollstaendig (geschaeftsgebiet, preisschaetzung,
v_wawi_radereignis fehlten dort) - derselbe Fehlertyp eine Ebene tiefer.
Diese Luecke ist die naechste Ausbaustufe gewesen; siehe den Abschnitt
"ERWEITERT AM 05.09.2026" weiter unten fuer das Ergebnis.

WAS GEPRUEFT WIRD

Fuer jede Datei in db/aufbau/*.sql:
  1. die im Abschnitt "Objekte:" des Kopfkommentars GENANNTEN Namen,
  2. die tatsaechlich angelegten Sichten, Tabellen, Aufzaehlungstypen,
     Funktionen und Sequenzen (siehe ANGELEGTE ARTEN unten fuer die
     Begruendung, warum Sequenzen mitzaehlen, obwohl der Auftrag nur vier
     Arten nennt),
und meldet jede Abweichung in beide Richtungen: angelegt, aber nicht
genannt; genannt, aber nicht angelegt.

ANGELEGTE ARTEN, UND WARUM GENAU DIESE

Der Auftrag nennt CREATE VIEW/CREATE OR REPLACE VIEW, CREATE TABLE,
CREATE TYPE und CREATE OR REPLACE FUNCTION. Ein Blick in den Bestand
(nicht geraten, siehe unten) zeigt zwei Kopfzeilen, die zusaetzlich eine
SEQUENCE als eigenes Objekt fuehren: velocity.seq_kundennummer (0002) und
velocity.seq_wartungsauftrag (0019). Ohne CREATE SEQUENCE als fuenfte Art
meldete dieses Werkzeug in beiden Dateien einen Phantomfund - einen
Namen, der genannt UND angelegt wird, den es nur nicht als solchen
erkennt. Deshalb zaehlt CREATE SEQUENCE dazu.

Ausdruecklich NICHT mitgezaehlt: CREATE INDEX/POLICY/TRIGGER/EXTENSION/
SCHEMA. Sie kommen im Bestand vor (0011 allein legt zwoelf Policies an),
aber keine Kopfzeile fuehrt sie einzeln als benanntes Objekt neben den
vier beauftragten Arten auf einem Niveau, das eine sinnvolle Objekt-
fuer-Objekt-Pruefung trueg - Policies etwa werden in 0011 pauschal als
"RLS und Policies auf allen Basistabellen" beschrieben, nicht einzeln
benannt. Der einzige Fall, in dem ein Trigger ueberhaupt einzeln benannt
wird (0015: "Trigger trg_fahrrad_ereignis auf velocity.fahrrad"), steht
in einem Satz mit einer Praeposition, nicht in einer Aufzaehlung - siehe
KOPFFELD-ZERLEGUNG.

DIE FALLSTRICKE

  Fehlende vs. unvollstaendige Liste
    Jede der 23 Dateien traegt eine "Objekte:"-Zeile (nachgesehen, nicht
    angenommen). Eine leere/keine Liste ist trotzdem ein echter Fall,
    naemlich immer dann, wenn eine Datei ÜBERHAUPT keine der fuenf
    Arten anlegt: 0008 (reine Dateneinfuegung), 0011 (RLS/Policies/
    Grants), 0020 (eine Datenzeile fuer die Demo-Rolle), 0024 (Vorbe-
    legung des Bestands). Ihre "Objekte:"-Felder beschreiben Daten oder
    Rechte, nicht Schemaobjekte einer der fuenf Arten - das ist keine
    unvollstaendige Aufzaehlung, sondern eine Aufzaehlung einer anderen
    Kategorie, die dieses Werkzeug nicht versteht und nicht verstehen
    soll. Eine Datei ohne jede angelegte Sicht/Tabelle/Typ/Funktion/
    Sequenz wird deshalb UEBERSPRUNGEN, nicht als "leere Liste = alles
    fehlt" gegen null Objekte verglichen - sonst meldete dieses Werkzeug
    in 0008 zehn Phantomfunde (Tabellennamen, in die nur Zeilen
    geschrieben werden) und liefe Gefahr, bei jedem Aufruf ignoriert zu
    werden, weil es staendig Befunde meldet, die keine sind. Fehlt die
    Zeile "Objekte:" dagegen komplett, WAEHREND die Datei etwas anlegt,
    ist das ein eigener, schwererer Befund (siehe Hauptschleife).

  Fliesstext vs. Aufzaehlung
    0018 nennt v_wawi_modell und v_wawi_fahrten_je_tag_rad im Fliesstext
    des Hinweis-Abschnitts ("Aufgabe 3 ... ergaenzt v_wawi_modell"), lange
    bevor oder nachdem die eigentliche Objekte-Zeile endet. Ein Werkzeug,
    das den ganzen Kopf durchsucht, faende solche Erwaehnungen und hielte
    die echte Objekte-Zeile faelschlich fuer vollstaendig. Deshalb grenzt
    kopf_objekte_feld() das Feld sauber ab: es beginnt bei "Objekte:" und
    endet an der naechsten "Wort:"-Feldueberschrift, einer leeren
    Kommentarzeile oder der schliessenden "===="-Zeile - je nachdem, was
    zuerst kommt.

  Schemapraefix
    velocity.v_wawi_flotte und v_wawi_kunde sind dasselbe Objekt. Der
    Abgleich normalisiert deshalb: ein Kopfeintrag OHNE Schema gilt als
    erfuellt, sobald IRGENDEIN Schema den Namen anlegt; ein Kopfeintrag
    MIT Schema muss exakt dieses Schema treffen. Das ist bewusst
    asymmetrisch - siehe naechster Punkt.

  Anderes Schema als velocity
    Nachgesehen (nicht angenommen): kein einziges "create ... " in
    db/aufbau/ legt etwas ausserhalb von velocity an, insbesondere kommt
    velocity_demo nirgends vor. Die Schemabehandlung bleibt trotzdem
    allgemein: nennt ein Kopf kuenftig "velocity_demo.v_foo", waehrend
    die Datei "velocity.v_foo" anlegt, meldet der exakte Abgleich das als
    Abweichung - genau das ist der Sinn der Asymmetrie oben.

  Anlegen und im selben Lauf wieder verwerfen
    Zwei Formen kommen tatsaechlich vor.
    (a) DROP ... IF EXISTS unmittelbar VOR einem CREATE (0018 dreimal:
        v_wawi_flotte, v_wawi_fahrt_km, v_wawi_modell; 0010 zehnmal).
        Das ist die idiomatische Art dieses Bestands, eine Sicht mit
        geaenderten Spalten neu zu fassen, weil CREATE OR REPLACE VIEW
        keine Spalten entfernen oder verschieben darf. Nach dem Lauf
        EXISTIERT das Objekt; es zaehlt als angelegt.
    (b) CREATE ... NEU, dann ALTER TYPE ... RENAME TO alt (0003, zweimal:
        bremsart_neu/schaltungsart_neu). Das ist eine bedingte, sich
        selbst abschaltende Migration fuer Bestandsdatenbanken, die noch
        den breiteren Aufzaehlungstyp aus einer AELTEREN Fassung von
        0001 tragen: bremsart entsteht heute bereits schmal in 0001,
        dieser Block hier greift nur, wenn der alte Wert ('ruecktritt')
        noch existiert. bremsart_neu ist reines Geruest ohne eigenen
        Namen im Kopf - waere es als "angelegt" gezaehlt, waere es ein
        Phantomfund, den niemand beheben kann, ohne die Migration zu
        zerstoeren. Der Name verschwindet deshalb aus der Menge der
        angelegten Objekte, sobald eine Umbenennung ihn woanders hin
        traegt; der NEUE Name (bremsart) wird NICHT gutgeschrieben, weil
        er in 0003 nirgends im Kopf steht und in Wahrheit schon 0001
        gehoert - siehe erkenne_angelegte_objekte().

DIE WICHTIGSTE GEGENPROBE DIESES WERKZEUGS GEGEN SICH SELBST

Ein erster Entwurf suchte nach woertlichem "create type" im Dateitext und
fand in db/aufbau/0001_schema_und_konventionen.sql GENAU NULL Treffer -
und haette deshalb faelschlich gemeldet, dass alle elf im Kopf genannten
Aufzaehlungstypen "genannt, aber nicht angelegt" seien. Tatsaechlich legt
0001 seine Aufzaehlungstypen ueber eine Wertetabelle in einer Schleife an
(EXECUTE FORMAT('create type velocity.%I as enum (%s)', ...) - siehe
Zeilen 34-90 dort); ein Textvergleich auf woertliches "create type" sieht
davon nichts, weil der Name erst zur Laufzeit eingesetzt wird. Erst der
Blick in die Datei (nicht das Raten anhand des Auftragswortlauts) deckte
das auf; dynamische_enum_typen() liest deshalb eigens die Namensliste
dieser Wertetabelle. Als Nebenbefund zeigt sich dabei, dass die
Kopfzeile ENUM ohnehin veraltet ist: die Schleife legt LAENGST 16 Typen
an (fuenf mehr - rahmenform, schaltungsart, bremsart, beleuchtungsart,
motorfabrikat - kamen mit der Radausstattung dazu), waehrend die
Kopfzeile weiter elf nennt. Derselbe Fehlertyp wie in 0018, nur einen
Aufbauschritt frueher.

Ebenso wichtig war die Gegenprobe fuer Kommentare: der Rohtext von 0020
enthaelt woertlich "die einzelnen 'create or replace view'-Anweisungen in
0018_wawi_sichten.sql" - ein Textvergleich ohne Kommentarabtrennung
haette das als echte Objektanlage gezaehlt. sql_kern() entfernt deshalb
Kommentare UND Zeichenketten, bevor nach CREATE/DROP/RENAME gesucht wird
(siehe dort).

ERWEITERT AM 05.09.2026: AUCH DIE RUECKNAHME-ZEILE

Derselbe Kopfrahmen traegt neben "Objekte:" ein zweites Feld,
"Ruecknahme:" - die Anweisung, mit der sich rueckgaengig machen laesst,
was die Datei anlegt. Genau derselbe Fehlertyp ist dort moeglich: die
Datei legt etwas an, die Ruecknahme kennt es nicht, und wer sie ausfuehrt,
laesst Reste stehen. Diese Erweiterung (kopf_ruecknahme_feld(),
zerlege_ruecknahme(), pruefe_ruecknahme()) ist die Gegenmassnahme dafuer.

ZWEI MACHARTEN, UND WARUM NUR EINE DAVON PRUEFBAR IST

Anders als bei "Objekte:" gibt es fuer "Ruecknahme:" zwei im Bestand
tatsaechlich genutzte, beide legitime Formen:

  Verweisend
    "DROP SCHEMA velocity CASCADE" (0001) oder "DROP VIEW fuer dieselben
    Namen." (0010, 0018) bzw. "DROP FUNCTION fuer dieselben Namen." (0009,
    0019) nennt keinen einzigen Namen und KANN NICHT veralten - was immer
    die Objekte-Zeile heute oder kuenftig auflistet, "dieselben Namen"
    trifft es automatisch mit. Diese Form ist der Aufzaehlung ausdruecklich
    vorzuziehen, weil eine wiederholte Liste genau das ist, was
    stehenbleibt (siehe ANLASS oben). Sie wird deshalb IMMER als
    vollstaendig behandelt, unabhaengig davon, was die Datei tatsaechlich
    anlegt: eine Pruefung dagegen waere keine Pruefung der Ruecknahme,
    sondern eine Wette darauf, dass "dieselben Namen" auch stimmt - und
    diese Wette gehoert nicht in ein automatisiertes Werkzeug. Meldete
    dieses Werkzeug hier trotzdem etwas, waere es bei jedem Lauf falsch
    (0009, 0010, 0018, 0019, dazu 0001 global) und wuerde ueberlesen -
    unbrauchbar aus demselben Grund wie ein Werkzeug, das bei 0008, 0011,
    0020 und 0024 eine leere Objekte-Liste als "alles fehlt" meldete
    (siehe Fallstrick oben).
  Aufzaehlend
    Die uebrigen Dateien nennen jedes DROP TABLE/VIEW/TYPE/FUNCTION/
    SEQUENCE einzeln, genau wie die Objekte-Zeile - und koennen deshalb
    denselben Fehler machen: ein Name, der beim Anlegen dazukam, ohne dass
    die Ruecknahme ihn nachzog. Nur diese Form wird gegen die tatsaechlich
    angelegten Objekte abgeglichen.

Eine einzelne Ruecknahme-Zeile kann BEIDES mischen, je Art getrennt: 0019
verweist fuer Funktionen ("DROP FUNCTION fuer dieselben Namen"), zaehlt
aber die Sequenz einzeln auf ("DROP SEQUENCE velocity.seq_wartungsauftrag")
und erwaehnt nebenbei einen DROP-TRIGGER-Schritt, der keine der fuenf
geprueften Arten betrifft. 0018 verweist fuer Sichten, zaehlt aber Tabelle
und Funktion einzeln auf. zerlege_ruecknahme() klassifiziert deshalb JEDE
Teilanweisung (getrennt an jedem Punkt oder Semikolon ausserhalb von
Klammern) fuer sich, nicht die Feldzeile als Ganzes.

Erkannt wird ausschliesslich die woertliche Wendung "DROP SCHEMA <name>
CASCADE" (deckt global alle fuenf Arten ab - nur 0001 nutzt das) und
"DROP <ART> fuer/für dieselben Namen" je Art (_VERWEIS_SCHEMA,
_VERWEIS_NAMEN). Eine reine Textsuche nach der Wortfolge "dieselben Namen"
IRGENDWO im Feld waere zu grobschlaechtig: 0006_bereich_e_abrechnung.sql
schreibt im Zweck-Abschnitt (nicht im Ruecknahme-Feld) woertlich
"Zeitstempel duerfen nicht denselben Namen tragen" - eine Erwaehnung ganz
ohne Bezug zu einer Ruecknahme. Weil die Suche an die Feldgrenze von
kopf_ruecknahme_feld() UND an ein vorangehendes "DROP <ART>" gebunden
ist, faellt dieser Satz gar nicht erst in die Betrachtung.

DIE WICHTIGSTE GEGENPROBE DIESER ERWEITERUNG GEGEN SICH SELBST

Fuer db/aufbau/0003_bereich_b_netz_und_flotte.sql stand zur Debatte, ob
zwei der sechs fehlenden Namen - trg_radposition_pruefen und
trg_stellplaetze_pruefen - ueberhaupt ergaenzt werden muessen: beide
haengen ueber ihre Trigger an Tabellen (fahrrad_position, fahrrad,
station), die die Ruecknahme ohnehin per DROP TABLE entfernt, und ein
DROP TABLE nimmt seine Trigger mit. Naheliegend, aber ungeprueft, waere
der Schluss, beide Namen seien deshalb bereits abgedeckt.

Nachgemessen statt uebernommen, gegen dieselbe Art Datenbank, die auch
die Abnahme dieses Projekts benutzt: eine Wegwerftabelle mit Trigger und
Triggerfunktion angelegt, die Tabelle OHNE jede Erwaehnung der Funktion
gedroppt, danach in pg_proc nachgesehen - die Funktion stand noch da.
DROP TABLE entfernt den TRIGGER, weil er seine Tabelle nicht ueberleben
kann; die FUNKTION, die der Trigger aufruft, ist ein eigenstaendiges
Objekt, auf das der Trigger nur verweist (nicht umgekehrt), und bleibt
stehen. trg_radposition_pruefen() und trg_stellplaetze_pruefen() sind
FUNKTIONEN (siehe ihre "create or replace function"-Zeilen in 0003, ihr
Name traegt nur zufaellig das Praefix "trg_") und waeren nach dem DROP
TABLE Datenleichen, genau wie fn_im_geschaeftsgebiet,
fn_fahrrad_motor_passt_zum_typ und fn_fahrrad_bremse_passt_zum_typ - der
vermeintliche Unterschied zwischen den beiden Gruppen haelt der Messung
nicht stand, und alle fuenf Funktionen plus die Tabelle geschaeftsgebiet
sind deshalb einzeln in db/aufbau/0003_bereich_b_netz_und_flotte.sql
ergaenzt worden.

Ebenfalls gemessen statt vermutet: eine SQL-Sprachfunktion (language sql,
so wie fn_im_geschaeftsgebiet), die eine Tabelle in ihrem Rumpf abfragt,
verhindert ebenfalls kein DROP TABLE ohne CASCADE - PostgreSQL analysiert
den Funktionsrumpf nicht auf Objektabhaengigkeiten, solange die Funktion
weder Parameter noch Rueckgabewert vom Zeilentyp der Tabelle traegt. Die
Reihenfolge zwischen "DROP FUNCTION fn_im_geschaeftsgebiet" und "DROP
TABLE geschaeftsgebiet" ist damit beliebig; ergaenzt wurde trotzdem die
Funktion vor der Tabelle, weil das der Mehrheitsstil im Bestand ist
(0015, 0016 und 0021 droppen Funktionen bzw. Trigger vor Tabellen; nur
0018 droppt in umgekehrter Reihenfolge, dort ohne fachlichen Bezug
zwischen der betroffenen Tabelle und Funktion).

EIN ZWEITER FUND, DER DIE MESSUNG UND NICHT DIE UEBERNAHME BESTAETIGT

Fuer db/aufbau/0012_dokumentation.sql war "v_data_dictionary" zunaechst
als fehlender Name vermerkt. Nachgesehen: die Ruecknahme-Zeile lautet
"COMMENT ON ... IS NULL; DROP VIEW v_data_dictionary;" - der Name STEHT
bereits da, nur ohne Schemapraefix. Dieselbe Schemapraefix-Aequivalenz wie
bei kopf_kandidaten() (ein Kopfeintrag ohne Schema gilt als erfuellt,
sobald irgendein Schema den Namen anlegt) gilt hier ebenso, siehe
pruefe_ruecknahme() - "v_data_dictionary" erfuellt
"velocity.v_data_dictionary". 0012 traegt deshalb KEINEN Befund und wurde
NICHT angefasst.

AUFRUF

    python3 tools/objektlisten_pruefen.py

Rueckgabewert 0, wenn jede pruefbare Datei ihre Objekte-Liste UND ihre
enumerierenden Ruecknahme-Angaben vollstaendig und ohne Phantome fuehrt;
1, sobald mindestens eine Abweichung gefunden wird. Eine Ruecknahme, die
fuer eine Art verweisend formuliert ist ("dieselben Namen", "DROP SCHEMA
... CASCADE"), zaehlt fuer diese Art niemals als Abweichung - siehe
"ERWEITERT AM 05.09.2026" oben.
"""
from __future__ import annotations

import re
import sys
from dataclasses import dataclass
from pathlib import Path

WURZEL = Path(__file__).resolve().parent.parent
AUFBAU = WURZEL / "db" / "aufbau"


# =====================================================================
# SQL ohne Kommentare und ohne Zeichenketten
# =====================================================================
def sql_kern(text: str) -> str:
    """Entfernt --Kommentare, '...'-Zeichenketten und $$...$$-Koerper,
    zeichenweise und zustandsbasiert - nicht per Textersetzung.

    WARUM NICHT PER REGEX-ERSETZUNG

    Eine Ersetzung wie re.sub(r'--.*', '', text) kennt keine Zeichen-
    ketten. db/aufbau/0020_demo_zugang.sql schreibt im Kopfkommentar
    woertlich "die einzelnen 'create or replace view'-Anweisungen in
    0018_wawi_sichten.sql" - eine reine Wortsuche nach 'create ... view'
    im UNGEFILTERTEN Text faende diese Beschreibung und hielte 0020
    faelschlich fuer eine Datei, die eine Sicht anlegt. Und
    db/aufbau/0001_schema_und_konventionen.sql fuehrt die Zeichenkette
    'create type velocity.%I as enum (%s)' als Formatvorlage fuer
    EXECUTE FORMAT(...) - ein Fund hier waere kein echtes Objekt (der
    Name ist ein Platzhalter, %I, keine Kennung), sondern noch mehr
    Rauschen ueber den echten Fall (siehe dynamische_enum_typen()).

    Deshalb bleiben nur Zeilenkommentare, Zeichenketten und $$-Koerper
    NICHT im Ergebnis - alles andere (Gross-/Kleinschreibung, Zeilen-
    umbrueche, Leerraum) bleibt erhalten, insbesondere jeder Zeilen-
    umbruch: die aufrufende Suche bestimmt Zeilennummern ueber die Zahl
    der '\\n' vor einem Fund, und das stimmt nur, wenn keine Zeile
    verschluckt wird.

    $$-Koerper werden GANZ entfernt, nicht nur von Kommentaren befreit:
    eine PL/pgSQL-Funktion legt niemals selbst statisch eine Sicht,
    Tabelle, einen Typ oder eine weitere Funktion an (das ginge nur
    dynamisch per EXECUTE - der eine Fall davon, der hier vorkommt, wird
    getrennt in dynamische_enum_typen() behandelt, auf dem UNGEFILTERTEN
    Text). Ein $$-Koerper kann deshalb komplett verschwinden, ohne dass
    ein echtes CREATE/DROP/ALTER verloren ginge.
    """
    heraus: list[str] = []
    i, n = 0, len(text)
    while i < n:
        z = text[i]
        if z == "-" and i + 1 < n and text[i + 1] == "-":
            while i < n and text[i] != "\n":
                i += 1
            continue
        if z == "'":
            i += 1
            while i < n:
                if text[i] == "'":
                    if i + 1 < n and text[i + 1] == "'":
                        i += 2  # maskiertes Quote ('') - Zeichenkette laeuft weiter
                        continue
                    i += 1
                    break
                if text[i] == "\n":
                    heraus.append("\n")
                i += 1
            continue
        if z == "$":
            m = re.match(r"\$([A-Za-z_][A-Za-z0-9_]*)?\$", text[i:])
            if m:
                marke = m.group(0)
                ende = text.find(marke, i + len(marke))
                ende = ende + len(marke) if ende != -1 else n
                heraus.append("\n" * text.count("\n", i, ende))
                i = ende
                continue
        heraus.append(z)
        i += 1
    return "".join(heraus)


def _zeile(text: str, position: int) -> int:
    return text.count("\n", 0, position) + 1


def _schema_und_name(qualifiziert: str) -> tuple[str | None, str]:
    qualifiziert = qualifiziert.strip()
    if "." in qualifiziert:
        schema, name = qualifiziert.split(".", 1)
        return schema, name
    return None, qualifiziert


# =====================================================================
# Tatsaechlich angelegte Objekte
# =====================================================================
@dataclass(frozen=True)
class Objekt:
    art: str                 # 'Sicht' | 'Tabelle' | 'Typ' | 'Funktion' | 'Sequenz'
    schema: str | None
    name: str
    zeile: int


# Je Art: (Muster fuer CREATE, Muster fuer DROP). Beide fangen den
# qualifizierten Namen bis zu einem eindeutigen Abschlusszeichen ein
# (" as" fuer Sicht/Typ, "(" fuer Tabelle/Funktion, Wortende fuer
# Sequenz) - was danach kommt (Spaltenliste, Parameterliste, Signatur),
# wird nicht gebraucht: fuer den Abgleich zaehlt nur der Name.
_CREATE_MUSTER: dict[str, re.Pattern[str]] = {
    # (?:with\s*\([^()]*\)\s*)? erlaubt eine WITH-Klausel zwischen Namen und
    # AS (0010: v_meine_ausleihe/v_meine_rechnung tragen "with
    # (security_invoker = true)"). Ohne diesen Zusatz faende das Muster
    # "as" nicht direkt nach dem Namen und uebersaehe beide Sichten
    # komplett - sie waeren dann trotz Kopfnennung als "genannt, aber
    # nicht angelegt" gemeldet worden, ein Phantomfund dieses Werkzeugs
    # selbst. Bei der ersten Testlauf-Auswertung tatsaechlich aufgetreten,
    # siehe Bericht.
    "Sicht":    re.compile(r"\bcreate\s+(?:or\s+replace\s+)?view\s+([a-zA-Z_][\w.]*)\s*(?:with\s*\([^()]*\)\s*)?as\b", re.I),
    "Tabelle":  re.compile(r"\bcreate\s+table\s+(?:if\s+not\s+exists\s+)?([a-zA-Z_][\w.]*)\s*\(", re.I),
    "Typ":      re.compile(r"\bcreate\s+type\s+([a-zA-Z_][\w.]*)\s+as\b", re.I),
    "Funktion": re.compile(r"\bcreate\s+(?:or\s+replace\s+)?function\s+([a-zA-Z_][\w.]*)\s*\(", re.I),
    "Sequenz":  re.compile(r"\bcreate\s+sequence\s+(?:if\s+not\s+exists\s+)?([a-zA-Z_][\w.]*)\b", re.I),
}
# DROP VIEW/TABLE erlaubt mehrere kommagetrennte Namen in einer
# Anweisung (im Bestand ungenutzt, aber gueltiges SQL); DROP TYPE/
# FUNCTION/SEQUENCE traegt hier nur einen Namen vor dem Abbruchzeichen.
_DROP_MUSTER: dict[str, re.Pattern[str]] = {
    "Sicht":    re.compile(r"\bdrop\s+view\s+(?:if\s+exists\s+)?([a-zA-Z_][\w.]*(?:\s*,\s*[a-zA-Z_][\w.]*)*)", re.I),
    "Tabelle":  re.compile(r"\bdrop\s+table\s+(?:if\s+exists\s+)?([a-zA-Z_][\w.]*(?:\s*,\s*[a-zA-Z_][\w.]*)*)", re.I),
    "Typ":      re.compile(r"\bdrop\s+type\s+(?:if\s+exists\s+)?([a-zA-Z_][\w.]*)", re.I),
    "Funktion": re.compile(r"\bdrop\s+function\s+(?:if\s+exists\s+)?([a-zA-Z_][\w.]*)\s*\(", re.I),
    "Sequenz":  re.compile(r"\bdrop\s+sequence\s+(?:if\s+exists\s+)?([a-zA-Z_][\w.]*)", re.I),
}
# ALTER <ART> <von> RENAME TO <nach> - siehe Docstring, Abschnitt
# "Anlegen und im selben Lauf wieder verwerfen", Fall (b).
_RENAME_MUSTER = re.compile(
    r"\balter\s+(view|table|type|function)\s+([a-zA-Z_][\w.]*)\s+rename\s+to\s+([a-zA-Z_][\w.]*)", re.I
)
_RENAME_ART = {"view": "Sicht", "table": "Tabelle", "type": "Typ", "function": "Funktion"}


def erkenne_angelegte_objekte(kern: str) -> list[Objekt]:
    """Liest CREATE/DROP/ALTER ... RENAME in Dateireihenfolge und liefert,
    was am Ende des Laufs tatsaechlich existiert.

    Ein einfacher Mengenaufbau ("alle CREATE-Treffer minus alle DROP-
    Treffer") wuerde die Reihenfolge ignorieren und damit den Fall aus
    dem Docstring oben, Fall (b), falsch behandeln: dort wird ETWAS
    (velocity.bremsart) angelegt, das schon VOR dem DROP existierte -
    der DROP trifft also den ALTEN Bestand, nicht das eigene CREATE
    dieser Datei. Nur eine Abarbeitung in Dateireihenfolge unterscheidet
    "diese Datei legt X an und wirft es selbst wieder weg" (Fall b, unten
    behandelt) von "diese Datei wirft etwas weg, das eine FRUEHERE Datei
    angelegt hat" (haeufiger Fall, z.B. DROP TYPE velocity.antriebsart in
    0018 - der Typ stammt, falls er existiert, aus einer frueheren
    Fassung von 0001 und wird hier nur aufgeraeumt; das DROP hat keine
    eigene CREATE-Zeile in 0018 und bleibt deshalb ohne Wirkung auf die
    Menge der von 0018 angelegten Objekte).
    """
    ereignisse: list[tuple[int, str, str, str | None, str, str | None, str | None]] = []
    # (position, aktion, art, schema, name, umbenannt_schema, umbenannt_name)
    for art, muster in _CREATE_MUSTER.items():
        for m in muster.finditer(kern):
            schema, name = _schema_und_name(m.group(1))
            ereignisse.append((m.start(), "create", art, schema, name, None, None))
    for art, muster in _DROP_MUSTER.items():
        for m in muster.finditer(kern):
            for teil in m.group(1).split(","):
                schema, name = _schema_und_name(teil)
                if name:
                    ereignisse.append((m.start(), "drop", art, schema, name, None, None))
    for m in _RENAME_MUSTER.finditer(kern):
        art = _RENAME_ART[m.group(1).lower()]
        von_schema, von_name = _schema_und_name(m.group(2))
        nach_schema, nach_name = _schema_und_name(m.group(3))
        # RENAME TO traegt in PostgreSQL nie ein eigenes Schema (nur SET
        # SCHEMA verschiebt); ein Ziel ohne Punkt erbt deshalb das Schema
        # der Quelle.
        nach_schema = nach_schema or von_schema
        ereignisse.append((m.start(), "rename", art, von_schema, von_name, nach_schema, nach_name))
    ereignisse.sort(key=lambda e: e[0])

    lebend: dict[tuple[str, str | None, str], Objekt] = {}
    for pos, aktion, art, schema, name, nach_schema, nach_name in ereignisse:
        schluessel = (art, schema, name)
        if aktion == "create":
            lebend[schluessel] = Objekt(art, schema, name, _zeile(kern, pos))
        elif aktion == "drop":
            lebend.pop(schluessel, None)
        elif aktion == "rename":
            # Das Ziel wird BEWUSST NICHT gutgeschrieben - siehe Docstring
            # oben, Fall (b): im einzigen tatsaechlichen Vorkommen
            # (bremsart_neu/schaltungsart_neu in 0003) gehoert der
            # Zielname einem FRUEHEREN Aufbauschritt (0001), nicht dieser
            # Datei. Wuerde das Ziel hier als "angelegt" gezaehlt, meldete
            # dieses Werkzeug es faelschlich als "angelegt, aber nicht
            # genannt", obwohl 0003 fuer dieses Objekt nie zustaendig war.
            lebend.pop(schluessel, None)
    return list(lebend.values())


# ---- Sonderfall: Aufzaehlungstypen aus einer Wertetabelle in einer
#      Schleife (siehe Docstring, Abschnitt "DIE WICHTIGSTE GEGENPROBE").
#      Arbeitet auf dem UNGEFILTERTEN Text: die Wertetabelle steht in
#      echtem, ausgefuehrtem PL/pgSQL-Code innerhalb eines $$-Koerpers,
#      den sql_kern() fuer die allgemeine Suche absichtlich leert.
_ENUM_MARKE = re.compile(r"execute\s+format\s*\(\s*'create\s+type\s+velocity\.%I\s+as\s+enum", re.I)
_ENUM_TUPEL = re.compile(r"\(\s*'([a-z][a-z0-9_]*)'\s*,\s*array\s*\[", re.I)


def dynamische_enum_typen(roh: str) -> list[Objekt]:
    """Findet Typnamen, die 0001_schema_und_konventionen.sql ueber
    EXECUTE FORMAT('create type velocity.%I as enum (%s)', v_typ.name,
    ...) in einer Schleife anlegt, statt sie woertlich hinzuschreiben.

    Die Namen stehen nicht in der ausgefuehrten Anweisung (dort steht nur
    der Platzhalter %I), sondern in der Wertetabelle, aus der die
    Schleife liest: Zeilen der Form ('name', array[...]). Dieses Muster
    ist eng genug, um nicht mit der Aufzaehlung selbst (array['a','b'])
    zu kollidieren - dort steht vor dem ersten Wert eine eckige, keine
    runde Klammer.

    Nur aktiv, wenn die Formatvorlage tatsaechlich im Text steht (die
    Marke oben): eine Datei ohne dieses Idiom soll nicht versehentlich
    irgendeine "('x', array[...])"-aehnliche Zeile als Typanlage lesen.
    """
    if not _ENUM_MARKE.search(roh):
        return []
    return [
        Objekt("Typ", "velocity", m.group(1), _zeile(roh, m.start()))
        for m in _ENUM_TUPEL.finditer(roh)
    ]


def angelegte_objekte(roh: str) -> list[Objekt]:
    return erkenne_angelegte_objekte(sql_kern(roh)) + dynamische_enum_typen(roh)


# =====================================================================
# Die Objekte-Zeile im Kopfkommentar
# =====================================================================
_TRENNZEILE = re.compile(r"^--\s*=+\s*$")
_LEERZEILE = re.compile(r"^--\s*$")
_FELDZEILE = re.compile(r"^-- ([A-ZÄÖÜ][\wäöüß]*):\s?(.*)$")
_KOMMENTARZEILE = re.compile(r"^--\s?(.*)$")


def _kopf_feld_zeilen(roh: str, feldname: str) -> list[str] | None:
    """Liefert die rohen, von "-- " befreiten Zeilen des Feldes <feldname>
    im Kopfrahmen, oder None, wenn die Datei kein solches Feld traegt.

    Gemeinsame Grenzlogik fuer "Objekte:" und "Ruecknahme:" (und jedes
    weitere "Wort:"-Feld) - was aus den rohen Zeilen einen zusammen-
    haengenden FeldTEXT macht, unterscheidet sich zwischen beiden Feldern
    und bleibt deshalb bewusst AUSSERHALB dieser Funktion; siehe
    kopf_objekte_feld() bzw. kopf_ruecknahme_feld().

    ABGRENZUNG GEGEN DEN FLIESSTEXT DAHINTER (der zentrale Fallstrick)

    0018_wawi_sichten.sql nennt v_wawi_modell und v_wawi_fahrten_je_tag_rad
    ein weiteres Mal im Abschnitt "Hinweis:", in ganzen Saetzen erklaert -
    lange NACH dem Ende der eigentlichen Objekte-Aufzaehlung. Ein Werkzeug,
    das den kompletten Kopfkommentar durchsucht, faende diese Erwaehnungen
    zusaetzlich und hielte die echte, unvollstaendige Objekte-Zeile
    faelschlich fuer vollstaendig - eine gruene Pruefung, die genau den
    Fall verfehlt, fuer den sie gebaut wurde. Ein Feld endet deshalb hart
    an der ERSTEN der drei moeglichen Grenzen: einer neuen
    "Wort:"-Feldueberschrift (Ruecknahme, Hinweis, Loesung, ...), einer
    leeren Kommentarzeile, oder der schliessenden "===="-Zeile des
    Kopfrahmens - je nachdem, was zuerst kommt.

    Der Kopfrahmen selbst wird ueber die ERSTEN ZWEI "===="-Zeilen der
    Datei abgegrenzt (nachgesehen: alle 23 Dateien beginnen mit einer
    solchen Zeile in Zeile 1; vier Dateien verwenden "====" spaeter im
    Fliesstext noch einmal als Abschnittstrenner, weshalb hier gezielt
    nur die ERSTEN zwei gezaehlt werden, nicht "die naechste").
    """
    zeilen = roh.splitlines()
    grenzen = [i for i, z in enumerate(zeilen) if _TRENNZEILE.match(z)]
    if len(grenzen) < 2:
        return None
    block = zeilen[grenzen[0] + 1 : grenzen[1]]

    sammlung: list[str] | None = None
    for z in block:
        feld = _FELDZEILE.match(z)
        if feld:
            if sammlung is not None:
                break  # ein neues Feld beginnt, <feldname> ist zu Ende
            if feld.group(1) == feldname:
                sammlung = [feld.group(2)]
            continue
        if sammlung is None:
            continue
        if _LEERZEILE.match(z) or _TRENNZEILE.match(z):
            break
        weiter = _KOMMENTARZEILE.match(z)
        if weiter:
            sammlung.append(weiter.group(1))
    return sammlung


def kopf_objekte_feld(roh: str) -> str | None:
    """Liefert den Text des Feldes "Objekte:" im Kopfrahmen, oder None,
    wenn die Datei kein solches Feld traegt. Grenzen siehe
    _kopf_feld_zeilen().
    """
    sammlung = _kopf_feld_zeilen(roh, "Objekte")
    if sammlung is None:
        return None

    # Zeilen zu einem Feldtext zusammensetzen - NICHT einfach mit Leerzeichen
    # verketten. 0001 legt die Objekte-Zeile in Kategorien an, jede auf
    # einer eigenen Zeile OHNE trennendes Komma davor ("Schema velocity" /
    # "Erweiterung extensions.btree_gist" / "ENUM kunde_status, ..."): eine
    # blosse Verkettung mit Leerzeichen verschmilzt "velocity" und
    # "Erweiterung" zu einem einzigen, unlesbaren Segment, und
    # kopf_kandidaten() faende darin ueberhaupt keinen brauchbaren
    # Bezeichner mehr - nicht nur fuer diese zwei Kategorien, sondern fuer
    # die ganze restliche Zeile, die an ihr klebt. Eine Zeile, die (nach dem
    # Abtrennen von "--") mit einem der bekannten Kategoriewoerter aus
    # _ETIKETTEN beginnt (Definition weiter unten, Abschnitt "Das
    # Objekte-Feld in einzelne Namen zerlegen"), startet deshalb ein NEUES
    # Listenglied - hier durch ein Semikolon markiert, das
    # _tiefe_bewusst_teilen() dort ebenfalls als Trenner behandelt. Eine
    # Zeile ohne Kategoriewort (z.B.
    # "tarifart, rechnung_status," unter "ENUM kunde_status, ...") ist ein
    # reiner Zeilenumbruch mitten in einer Liste und wird weiter mit einem
    # blossen Leerzeichen angehaengt - das im Bestand uebliche Format
    # (0018 etc.), wo jede umgebrochene Zeile schon ihr eigenes Komma traegt.
    stuecke = [teil.strip() for teil in sammlung if teil.strip()]
    if not stuecke:
        return ""
    feldtext = [stuecke[0]]
    for stueck in stuecke[1:]:
        wortmatch = _ETIKETT_WORT.match(stueck)
        neues_glied = bool(wortmatch and wortmatch.group(1) in _ETIKETTEN)
        feldtext.append((";" if neues_glied else "") + " " + stueck)
    return "".join(feldtext)


# =====================================================================
# Das Objekte-Feld in einzelne Namen zerlegen
# =====================================================================
# Bekannte Kategoriewoerter am Anfang eines Listenpunkts. "verfolgt"
# bedeutet: das Wort wird abgetrennt, der Rest ist ein Namenskandidat
# einer der fuenf geprueften Arten (Beispiel: 0012 "Sicht
# velocity.v_data_dictionary", 0001 "Funktion velocity.fn_audit_setzen()").
# "unverfolgt" bedeutet: das Wort benennt eine Kategorie ausserhalb der
# fuenf geprueften Arten (0001 "Schema velocity", "Erweiterung
# extensions.btree_gist") - der Rest wird NICHT als Namenskandidat
# gewertet, sonst meldete dieses Werkzeug "velocity" bzw.
# "extensions.btree_gist" als Phantomfund, obwohl 0001 tatsaechlich ein
# Schema und eine Erweiterung anlegt, nur eben keine der fuenf
# geprueften Arten. Ein WEITERES Listenglied OHNE eigenes Kategoriewort
# erbt die zuletzt gesehene Kategorie (0001: "ENUM kunde_status,
# fahrrad_status, ..." - nur das erste Glied traegt "ENUM", die
# folgenden nicht).
_ETIKETTEN = {
    "Sicht": "verfolgt", "Tabelle": "verfolgt", "Typ": "verfolgt", "ENUM": "verfolgt",
    "Funktion": "verfolgt", "Sequenz": "verfolgt", "Prozedur": "verfolgt",
    "Schema": "unverfolgt", "Erweiterung": "unverfolgt", "Trigger": "unverfolgt",
    "Index": "unverfolgt", "Policy": "unverfolgt", "Regel": "unverfolgt", "Grant": "unverfolgt",
}
_ETIKETT_WORT = re.compile(r"^([A-ZÄÖÜ][\wäöüß]*)\s+(.+)$")
# Ein Namenskandidat ist EIN Bezeichner, wahlweise schemaqualifiziert,
# wahlweise gefolgt von einer Klammerangabe (Funktionssignatur wie
# "(date,int)" ODER ein Fussnotentext wie 0019s "(Art. 15 DSGVO)" - der
# Inhalt der Klammer wird nicht gepruecht, nur verworfen, weil fuer den
# Abgleich allein der Name zaehlt). Grossbuchstaben am Anfang schliessen
# den Treffer aus: echte Bezeichner sind im ganzen Bestand durchgehend
# klein geschrieben, waehrend SQL-Schluesselwoerter und deutsche
# Substantive im Fliesstext gross beginnen (COMMENT, Tabellen, Sichten,
# RLS, Grants, Trigger, ...). Diese eine Regel spart eine Stoppwortliste
# fuer deutsche Fuellwoerter komplett ein.
_KLARER_BEZEICHNER = re.compile(r"^(?:[a-z][a-z0-9_]*\.)?[a-z][a-z0-9_]*(?:\s*\([^()]*\))?$")


def _tiefe_bewusst_teilen(text: str, trenner: str) -> list[str]:
    """Teilt text an jedem Zeichen aus trenner, das AUSSERHALB runder
    Klammern steht.

    Noetig, weil Listenpunkte selbst Kommas in Klammern tragen koennen:
    eine Funktionssignatur ("fn_wartungsprognose(date,int)", 0021) oder,
    schwerer noch, ein erlaeuternder Nebensatz in Klammern mit eigenem
    Komma (0019: "... an mitarbeiter und station (bewusst NICHT an
    fahrrad, siehe Kommentar unten)."). Eine einfache str.split(',')
    zerrisse beide mitten im Klammerinhalt.
    """
    teile, aktuelles, tiefe = [], [], 0
    for z in text:
        if z == "(":
            tiefe += 1
        elif z == ")":
            tiefe = max(0, tiefe - 1)
        if z in trenner and tiefe == 0:
            teile.append("".join(aktuelles))
            aktuelles = []
            continue
        aktuelles.append(z)
    teile.append("".join(aktuelles))
    return teile


def kopf_kandidaten(feldtext: str) -> set[tuple[str | None, str]]:
    """Zerlegt den Objekte-Feldtext in (Schema-oder-None, Name)-Paare.

    Segmente, die sich nicht auf einen einzelnen klaren Bezeichner
    reduzieren lassen - Fliesstext wie 0008s "Datenzeilen in entgeltart"
    oder 0017s "RLS-Regeln auf den Bereichen J, I, K" -, werden
    STILLSCHWEIGEND uebersprungen, nicht als Fehler gemeldet: sie sind
    kein Verstoss gegen das Listenformat, sondern zeigen an, dass dieser
    Teil des Feldes etwas beschreibt, das ausserhalb der fuenf
    geprueften Arten liegt.
    """
    segmente = _tiefe_bewusst_teilen(feldtext, ",;")
    kandidaten: set[tuple[str | None, str]] = set()
    kategorie = "verfolgt"  # vor dem ersten Etikett: wie eine flache Liste behandeln
    for segment in segmente:
        segment = segment.strip()
        if not segment:
            continue
        rest = segment
        etikett = _ETIKETT_WORT.match(segment)
        if etikett and etikett.group(1) in _ETIKETTEN:
            rest = etikett.group(2)
            kategorie = _ETIKETTEN[etikett.group(1)]
        if kategorie == "unverfolgt":
            continue
        if not _KLARER_BEZEICHNER.match(rest.strip()):
            continue
        bezeichner = re.sub(r"\s*\([^()]*\)\s*$", "", rest.strip())
        kandidaten.add(_schema_und_name(bezeichner))
    return kandidaten


# =====================================================================
# Abgleich je Datei
# =====================================================================
@dataclass
class Ergebnis:
    status: str          # 'uebersprungen' | 'kein_kopf' | 'ok' | 'abweichung'
    hat_kopf: bool
    anzahl_angelegt: int
    befunde: list[str]


def pruefe_datei(pfad: Path) -> Ergebnis:
    roh = pfad.read_text(encoding="utf-8")
    angelegt = angelegte_objekte(roh)

    if not angelegt:
        # Siehe Docstring, Abschnitt "Fehlende vs. unvollstaendige Liste":
        # keine der fuenf Arten wird angelegt, also gibt es nichts, wogegen
        # sich eine Objekte-Zeile pruefen liesse.
        return Ergebnis("uebersprungen", kopf_objekte_feld(roh) is not None, 0, [])

    feld = kopf_objekte_feld(roh)
    if feld is None:
        namen = ", ".join(
            sorted(f"{a.schema + '.' if a.schema else ''}{a.name}" for a in angelegt)
        )
        return Ergebnis(
            "kein_kopf", False, len(angelegt),
            [f"kein Feld \"Objekte:\" im Kopf, obwohl {len(angelegt)} Objekt(e) "
             f"angelegt werden: {namen}"],
        )

    genannt = kopf_kandidaten(feld)
    namen_lose = {a.name for a in angelegt}
    namen_qualifiziert = {(a.schema, a.name) for a in angelegt}

    befunde: list[str] = []
    for a in sorted(angelegt, key=lambda o: o.zeile):
        # Ohne Schema genannt gilt als erfuellt (Schemapraefix-Aequivalenz,
        # siehe Docstring); mit Schema genannt muss es exakt treffen.
        if (a.schema, a.name) in genannt or (None, a.name) in genannt:
            continue
        qual = f"{a.schema + '.' if a.schema else ''}{a.name}"
        befunde.append(f"{a.art} {qual} (Zeile {a.zeile}) angelegt, aber im Kopf nicht genannt")

    for schema, name in sorted(genannt, key=lambda sn: (sn[0] or "", sn[1])):
        ok = (schema, name) in namen_qualifiziert if schema else name in namen_lose
        if not ok:
            qual = f"{schema + '.' if schema else ''}{name}"
            befunde.append(f"{qual} im Kopf genannt, aber nicht angelegt")

    status = "ok" if not befunde else "abweichung"
    return Ergebnis(status, True, len(angelegt), befunde)


# =====================================================================
# Das Ruecknahme-Feld im Kopfkommentar: verweisend oder aufzaehlend
# =====================================================================
# Ausfuehrliche Begruendung im Modul-Docstring, Abschnitt "ERWEITERT AM
# 05.09.2026". Kurzfassung: "Ruecknahme:" nennt entweder gar keine Namen
# (verweisend - "DROP SCHEMA velocity CASCADE", "DROP VIEW fuer dieselben
# Namen.") und ist dann per Konstruktion vollstaendig, oder zaehlt Namen
# einzeln auf (aufzaehlend) und kann denselben Fehler tragen wie eine
# unvollstaendige Objekte-Zeile. Nur Letzteres wird geprueft; eine
# einzelne Feldzeile kann beides je Art mischen (0018, 0019).
def kopf_ruecknahme_feld(roh: str) -> str | None:
    """Liefert den Text des Feldes "Ruecknahme:" im Kopfrahmen, oder None,
    wenn die Datei kein solches Feld traegt. Grenzen siehe
    _kopf_feld_zeilen().

    Anders als kopf_objekte_feld() reicht hier reines Aneinanderhaengen
    mit einem Leerzeichen: "Ruecknahme:" traegt keine Kategoriezeilen ohne
    eigenes Trennzeichen wie "Objekte:" (siehe dort) - jede umgebrochene
    Zeile ist entweder die Fortsetzung eines SQL-aehnlichen DROP-Fragments
    (das eigene Kommas und Semikola schon mitbringt, z.B. 0018/0019) oder
    ein Satz in normaler deutscher Interpunktion (0001). Beides vertraegt
    eine blosse Leerzeichen-Verkettung; nachgeprueft an allen 24
    Vorkommen im Bestand.
    """
    sammlung = _kopf_feld_zeilen(roh, "Ruecknahme")
    if sammlung is None:
        return None
    return " ".join(teil.strip() for teil in sammlung if teil.strip())


# SQL-Schluesselwort -> Art, deckungsgleich mit _CREATE_MUSTER/_DROP_MUSTER
# oben - dieselben fuenf Arten, dieselbe Begruendung (ANGELEGTE ARTEN).
_RUECKNAHME_ART_JE_WORT = {
    "view": "Sicht", "table": "Tabelle", "type": "Typ",
    "function": "Funktion", "sequence": "Sequenz",
}
def _ruecknahme_klauseln(text: str) -> list[str]:
    """Zerlegt einen Ruecknahme-Feldtext in Teilklauseln, getrennt an
    jedem Semikolon und an jedem Punkt, der ein SATZENDE ist - nicht an
    jedem Punkt ueberhaupt. Beides ausserhalb runder Klammern, aus
    demselben Grund wie bei _tiefe_bewusst_teilen(): eine Funktions-
    signatur darf ihr eigenes Satzzeichen nicht als Klauselgrenze
    missverstehen.

    WARUM NICHT EINFACH _tiefe_bewusst_teilen(text, ".;") - DER FEHLER,
    DER DEN ERSTEN ENTWURF DURCHFALLEN LIESS

    Ein schemaqualifizierter Name wie "velocity.tarif" traegt selbst
    einen Punkt. Ein Trenner, der JEDEN Punkt als Klauselende liest,
    zerlegt "velocity.freiminuten_periode, velocity.mitgliedschaft" in
    Bruchstuecke wie "velocity" / "freiminuten_periode, velocity" / ... -
    keines davon ist mehr ein gueltiger Bezeichner, und die enumerierten
    Namen fallen komplett aus der Erkennung heraus, waehrend "velocity"
    selbst als Phantom-Bezeichner uebrig bleibt. Genau das geschah beim
    ersten Testlauf dieser Erweiterung (siehe Bericht) und haette JEDE
    Datei mit einer aufzaehlenden Ruecknahme faelschlich als vollstaendig
    falsch gemeldet.

    Der Unterschied zwischen beiden Punktarten ist einfach und
    zuverlaessig: ein Schema-Punkt steht OHNE Leerzeichen zwischen zwei
    Bezeichnerzeichen ("y" und "f" in "velocity.freiminuten_periode"); ein
    Satzende-Punkt hat danach ein Leerzeichen oder das Textende - nie ein
    weiteres Bezeichnerzeichen. Ein Punkt zaehlt deshalb nur als Grenze,
    wenn NICHTS oder ein Leerzeichen (bzw. Zeilenumbruch) folgt.

    Als Nebeneffekt braucht ein Auslassungszeichen wie "ALTER TABLE ...
    DISABLE ..." (0011, 0017) keine Sonderbehandlung mehr: die ersten
    beiden Punkte einer Punktfolge haben nie ein Leerzeichen danach (der
    naechste Punkt folgt direkt) und zaehlen deshalb nicht als Grenze,
    nur der letzte Punkt vor dem naechsten Wort tut es - und selbst DER
    erzeugt hoechstens eine harmlose Klausel, die nicht mit "drop"
    beginnt (siehe Aufrufer).
    """
    klauseln: list[str] = []
    aktuelle: list[str] = []
    tiefe = 0
    ende = len(text)
    for i, zeichen in enumerate(text):
        if zeichen == "(":
            tiefe += 1
        elif zeichen == ")":
            tiefe = max(0, tiefe - 1)
        grenze = False
        if tiefe == 0:
            if zeichen == ";":
                grenze = True
            elif zeichen == ".":
                nachfolger = text[i + 1] if i + 1 < ende else ""
                grenze = nachfolger == "" or nachfolger.isspace()
        if grenze:
            klauseln.append("".join(aktuelle))
            aktuelle = []
            continue
        aktuelle.append(zeichen)
    klauseln.append("".join(aktuelle))
    return klauseln


# "DROP SCHEMA <name> CASCADE" deckt GLOBAL alle fuenf Arten ab (0001) -
# ein CASCADE auf Schemaebene nimmt Tabellen, Sichten, Typen, Funktionen
# und Sequenzen gleichermassen mit.
_VERWEIS_SCHEMA = re.compile(r"^drop\s+schema\s+\S+\s+cascade\b", re.I)
# Eine Teilklausel, die eine der fuenf Arten betrifft. Andere DROP-Ziele
# (TRIGGER, POLICY) und Nicht-DROP-Klauseln (DELETE, ALTER TABLE, COMMENT
# ON, Fliesstext) werden absichtlich NICHT erkannt - sie betreffen keine
# der geprueften Arten und sollen nicht als "genannt" mitzaehlen.
_RUECKNAHME_KLAUSEL = re.compile(
    r"^drop\s+(view|table|type|function|sequence)\s+(.*)$", re.I | re.S
)
# "fuer dieselben Namen" (oder "für ...") direkt nach dem Artwort macht
# genau DIESE Art in dieser Klausel verweisend - siehe Docstring-Abschnitt
# "WIE VERWEISEND ERKANNT WIRD". Bewusst NICHT einfach nach der Wortfolge
# irgendwo im Feld gesucht (Fallstrick 0006, siehe Modul-Docstring).
_VERWEIS_NAMEN = re.compile(r"^f(?:ue|ü)r\s+dieselben\s+namen\b", re.I)
_IF_EXISTS_PREFIX = re.compile(r"^if\s+exists\s+", re.I)
_TRAILING_MODUS = re.compile(r"\s+(cascade|restrict)\s*$", re.I)


@dataclass
class RuecknahmeBefund:
    verweisend: set[str]                               # Arten, verweisend abgedeckt
    genannt: dict[str, set[tuple[str | None, str]]]     # Art -> aufgezaehlte (Schema, Name)


def zerlege_ruecknahme(feldtext: str) -> RuecknahmeBefund:
    """Zerlegt den Ruecknahme-Feldtext in Teilklauseln (siehe
    _ruecknahme_klauseln()) und klassifiziert JEDE Klausel einzeln als
    verweisend oder aufzaehlend fuer ihre Art.

    Eine Klausel, die nicht mit "drop <art>" beginnt (DELETE, ALTER TABLE,
    COMMENT ON, DROP TRIGGER/POLICY, erklaerender Fliesstext wie in 0019s
    "Fuer das Protokoll je DROP TRIGGER ...") wird STILLSCHWEIGEND
    uebersprungen - dieselbe Haltung wie bei kopf_kandidaten() gegenueber
    Fliesstext im Objekte-Feld: sie ist kein Verstoss, sie betrifft nur
    keine der fuenf geprueften Arten.
    """
    verweisend: set[str] = set()
    genannt: dict[str, set[tuple[str | None, str]]] = {
        art: set() for art in _RUECKNAHME_ART_JE_WORT.values()
    }
    for klausel in _ruecknahme_klauseln(feldtext):
        klausel = klausel.strip()
        if not klausel:
            continue
        if _VERWEIS_SCHEMA.match(klausel):
            verweisend.update(_RUECKNAHME_ART_JE_WORT.values())
            continue
        treffer = _RUECKNAHME_KLAUSEL.match(klausel)
        if not treffer:
            continue  # keine der fuenf Arten betroffen - siehe Docstring
        art = _RUECKNAHME_ART_JE_WORT[treffer.group(1).lower()]
        rest = treffer.group(2).strip()
        if _VERWEIS_NAMEN.match(rest):
            verweisend.add(art)
            continue
        rest = _IF_EXISTS_PREFIX.sub("", rest)
        rest = _TRAILING_MODUS.sub("", rest)
        for segment in _tiefe_bewusst_teilen(rest, ","):
            segment = segment.strip()
            # Stillschweigend uebersprungen, wenn kein klarer Bezeichner -
            # dieselbe Regel wie kopf_kandidaten(), siehe dort.
            if not segment or not _KLARER_BEZEICHNER.match(segment):
                continue
            bezeichner = re.sub(r"\s*\([^()]*\)\s*$", "", segment)
            genannt[art].add(_schema_und_name(bezeichner))
    return RuecknahmeBefund(verweisend, genannt)


@dataclass
class RuecknahmeErgebnis:
    status: str          # 'uebersprungen' | 'kein_feld' | 'ok' | 'abweichung'
    befunde: list[str]


def pruefe_ruecknahme(pfad: Path) -> RuecknahmeErgebnis:
    """Analog zu pruefe_datei(), aber fuer "Ruecknahme:" statt "Objekte:"
    und mit der Verweisend-Ausnahme je Art (siehe Modul-Docstring).
    """
    roh = pfad.read_text(encoding="utf-8")
    angelegt = angelegte_objekte(roh)

    if not angelegt:
        return RuecknahmeErgebnis("uebersprungen", [])

    feld = kopf_ruecknahme_feld(roh)
    if feld is None:
        namen = ", ".join(
            sorted(f"{a.schema + '.' if a.schema else ''}{a.name}" for a in angelegt)
        )
        return RuecknahmeErgebnis(
            "kein_feld",
            [f"kein Feld \"Ruecknahme:\" im Kopf, obwohl {len(angelegt)} Objekt(e) "
             f"angelegt werden: {namen}"],
        )

    befund = zerlege_ruecknahme(feld)
    nach_art: dict[str, list[Objekt]] = {}
    for a in angelegt:
        nach_art.setdefault(a.art, []).append(a)

    befunde: list[str] = []
    for art in sorted(nach_art):
        if art in befund.verweisend:
            continue  # verweisend abgedeckt - kann nicht veralten, nicht geprueft
        objekte = nach_art[art]
        genannt = befund.genannt.get(art, set())
        namen_lose = {o.name for o in objekte}
        namen_qualifiziert = {(o.schema, o.name) for o in objekte}

        for o in sorted(objekte, key=lambda x: x.zeile):
            if (o.schema, o.name) in genannt or (None, o.name) in genannt:
                continue
            qual = f"{o.schema + '.' if o.schema else ''}{o.name}"
            befunde.append(
                f"{o.art} {qual} (Zeile {o.zeile}) angelegt, aber in Ruecknahme nicht genannt"
            )
        for schema, name in sorted(genannt, key=lambda sn: (sn[0] or "", sn[1])):
            ok = (schema, name) in namen_qualifiziert if schema else name in namen_lose
            if not ok:
                qual = f"{schema + '.' if schema else ''}{name}"
                befunde.append(f"{qual} in Ruecknahme genannt, aber nicht angelegt")

    status = "ok" if not befunde else "abweichung"
    return RuecknahmeErgebnis(status, befunde)


# =====================================================================
# Hauptprogramm
# =====================================================================
def main() -> int:
    dateien = sorted(AUFBAU.glob("*.sql"))
    if not dateien:
        print(f"Keine .sql-Dateien gefunden unter {AUFBAU}")
        return 2

    print(f"{len(dateien)} Dateien in db/aufbau/ - Objekte- UND Ruecknahme-Kopf "
          f"gegen CREATE/DROP/ALTER ... RENAME abgeglichen\n"
          f"(geprueft: Sicht, Tabelle, Typ, Funktion, Sequenz - Begruendung im "
          f"Kopfkommentar dieser Datei; eine Ruecknahme, die fuer eine Art "
          f"verweisend formuliert ist - \"dieselben Namen\", \"DROP SCHEMA ... "
          f"CASCADE\" -, gilt fuer diese Art immer als vollstaendig)\n")

    geprueft = 0
    uebersprungen = 0
    mit_objekte_feld = 0
    mit_ruecknahme_feld = 0
    gesamtbefunde = 0
    for pfad in dateien:
        e_obj = pruefe_datei(pfad)
        e_rn = pruefe_ruecknahme(pfad)

        if e_obj.status == "uebersprungen":
            uebersprungen += 1
            if e_obj.hat_kopf:
                mit_objekte_feld += 1
            print(f"  --    {pfad.name}  keine Sicht/Tabelle/Typ/Funktion/Sequenz "
                  f"angelegt - Objekte- und Ruecknahme-Kopf nicht pruefbar")
            continue

        geprueft += 1
        if e_obj.status != "kein_kopf":  # 'kein_kopf' fuehrt per Definition kein Feld
            mit_objekte_feld += 1
        if e_rn.status != "kein_feld":
            mit_ruecknahme_feld += 1

        befunde = list(e_obj.befunde) + list(e_rn.befunde)
        if not befunde:
            print(f"  ok    {pfad.name}  {e_obj.anzahl_angelegt} Objekt(e) angelegt, "
                  f"Objekte- und Ruecknahme-Kopf stimmen ueberein")
            continue

        print(f"  FEHL  {pfad.name}  {e_obj.anzahl_angelegt} Objekt(e) angelegt, "
              f"{len(befunde)} Befund(e):")
        for b in befunde:
            print(f"        {b}")
        gesamtbefunde += len(befunde)

    print(f"\n{len(dateien)} Dateien geprüft; {geprueft} davon legen mindestens "
          f"eine Sicht/Tabelle/Typ/Funktion/Sequenz an und wurden inhaltlich "
          f"abgeglichen, {uebersprungen} uebersprungen (keine solche Anlage - "
          f"Daten, Rechte oder reine Vorbelegung).")
    print(f"{mit_objekte_feld} von {len(dateien)} Dateien fuehren ueberhaupt ein "
          f"Feld \"Objekte:\", das sich als Aufzaehlung lesen laesst.")
    print(f"{mit_ruecknahme_feld} von {len(dateien)} Dateien fuehren ueberhaupt "
          f"ein Feld \"Ruecknahme:\".")

    if gesamtbefunde:
        print(f"\n{gesamtbefunde} Befund(e) insgesamt. Objekte- bzw. "
              f"Ruecknahme-Zeile im Kopf nachziehen: Namen ergaenzen, die "
              f"tatsaechlich angelegt bzw. zurueckzunehmen sind, oder Namen "
              f"streichen, die es nicht mehr gibt.")
        return 1
    print("\nJede pruefbare Datei nennt genau das, was sie anlegt, und ihre "
          "enumerierende Ruecknahme kennt jeden dieser Namen.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
