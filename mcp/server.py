#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""MCP-Server fuer die VeloCity-Warenwirtschaft.

WAS ER IST

Ein Adapter, mehr nicht. Die Warenwirtschaft unter wawi.butscher.cloud
spricht die Datenbank ausschliesslich ueber v_wawi_-Sichten (lesend) und
api_-Funktionen (schreibend) an - keine Basistabelle, kein direktes
UPDATE. Genau das ist bereits eine Werkzeugflaeche; dieser Server legt
nur ein anderes Vorderteil davor. Was der Browser tut, tut hier ein
Agent, ueber dieselben Aufrufe.

WO DIE RECHTE LIEGEN

NICHT hier. Der Server meldet sich mit einem gewoehnlichen
Mitarbeiterkonto an und erbt genau dessen Rollen; darueber entscheiden
Row Level Security und velocity.hat_rolle() in der Datenbank. Es gibt in
diesem Programm keine Rechtepruefung, die sich umgehen liesse, weil es
hier keine gibt. Wer dem Agenten weniger erlauben will, gibt seinem
Konto weniger Rollen - nicht seiner Aufgabenbeschreibung.

Jeder Schreibvorgang landet in velocity.aenderungsprotokoll, mit dem
Mitarbeitersatz, der ihn ausgeloest hat. Bei einem eigenen Agentenkonto
laesst sich damit hinterher trennen, was ein Mensch getan hat und was
eine Maschine - genau darum geht es in der Uebung.

WARUM AUCH DAS UNUMKEHRBARE DABEI IST

api_kunde_anonymisieren loescht Vorname, Nachname und E-Mail
unwiederbringlich; api_rad_ausmustern nimmt ein Rad dauerhaft aus dem
Bestand. Beides ist hier ABSICHTLICH erreichbar. Die Fallstudie ist eine
Versuchsplattform: Studierende sollen sehen, was ein Agent in einem
Warenwirtschaftssystem anrichten kann, nicht nur davon hoeren. Der Weg
zurueck steht daneben:

    bash tools/velocity_sichern.sh --ausgangsstand
    bash tools/velocity_zuruecksetzen.sh

WAS BEWUSST FEHLT

Die vier api_-Funktionen der Website - ausleihe_starten, ausleihe_beenden,
profil_aktualisieren, kunde_sicherstellen. Sie handeln auf dem EIGENEN
Kundensatz des Aufrufers; ein Mitarbeiterkonto hat keinen und liefe in
einen Fehler. Sie fehlen also nicht aus Vorsicht, sondern weil sie hier
nichts tun koennten. tools/mcp_check.py haelt diese Auslassung fest,
damit sie eine Entscheidung bleibt und kein Vergessen wird.

EINRICHTUNG

    .env (nicht versioniert) braucht vier Werte:
        SUPABASE_URL, SUPABASE_ANON_KEY,
        WAWI_AGENT_EMAIL, WAWI_AGENT_PASSWORT

    Eigene Umgebung, damit die allgemeine unberuehrt bleibt:
        bash mcp/einrichten.sh

    Claude Desktop, ~/Library/Application Support/Claude/
    claude_desktop_config.json:

        {"mcpServers": {"velocity-wawi": {
            "command": "<Pfad>/mcp/.venv/bin/python",
            "args": ["<Pfad>/mcp/server.py"]}}}

Aufruf zum Selbsttest: mcp/.venv/bin/python mcp/server.py --pruefen
"""
from __future__ import annotations

import json
import os
import pathlib
import sys
import time
from typing import Any

import httpx
from mcp.server.mcpserver import MCPServer

WURZEL = pathlib.Path(__file__).resolve().parent.parent


# ─────────────────────────────────────────────────────── Zugangsdaten
def _env_laden() -> None:
    """Liest .env nach os.environ, ohne Vorhandenes zu ueberschreiben.

    Dieselbe schlichte Form wie in db/run.py: eine Zeile je Wert, keine
    Bibliothek. Das Passwort steht ausschliesslich dort und wird nie
    ausgegeben - auch nicht in Fehlermeldungen.
    """
    pfad = WURZEL / ".env"
    if not pfad.exists():
        return
    for zeile in pfad.read_text(encoding="utf-8").splitlines():
        zeile = zeile.strip()
        if not zeile or zeile.startswith("#") or "=" not in zeile:
            continue
        schluessel, wert = zeile.split("=", 1)
        os.environ.setdefault(schluessel.strip(), wert.strip())


_env_laden()

URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
ANON = os.environ.get("SUPABASE_ANON_KEY", "")
EMAIL = os.environ.get("WAWI_AGENT_EMAIL", "")
PASSWORT = os.environ.get("WAWI_AGENT_PASSWORT", "")
SCHEMA = "velocity"

_sitzung: dict[str, Any] = {"token": None, "gueltig_bis": 0.0}


def _anmelden() -> str:
    """Holt ein Zugangsmerkmal und haelt es, solange es gilt.

    Supabase gibt die Gueltigkeit in Sekunden zurueck. Erneuert wird 60
    Sekunden vorher - ein Aufruf, der genau auf der Grenze landet, soll
    nicht mit 401 scheitern.
    """
    if _sitzung["token"] and time.time() < _sitzung["gueltig_bis"]:
        return _sitzung["token"]

    fehlend = [n for n, w in (("SUPABASE_URL", URL), ("SUPABASE_ANON_KEY", ANON),
                              ("WAWI_AGENT_EMAIL", EMAIL),
                              ("WAWI_AGENT_PASSWORT", PASSWORT)) if not w]
    if fehlend:
        raise RuntimeError(
            f"In .env fehlen: {', '.join(fehlend)}. "
            f"Siehe .env.example und mcp/README.md.")

    antwort = httpx.post(
        f"{URL}/auth/v1/token", params={"grant_type": "password"},
        headers={"apikey": ANON, "Content-Type": "application/json"},
        json={"email": EMAIL, "password": PASSWORT}, timeout=20)
    if antwort.status_code != 200:
        # Das Passwort taucht hier bewusst nicht auf, auch nicht gekuerzt.
        raise RuntimeError(
            f"Anmeldung als {EMAIL} fehlgeschlagen (HTTP "
            f"{antwort.status_code}). Steht das Konto in auth.users und ist "
            f"es bestaetigt?")
    d = antwort.json()
    _sitzung["token"] = d["access_token"]
    _sitzung["gueltig_bis"] = time.time() + int(d.get("expires_in", 3600)) - 60
    return _sitzung["token"]


def _kopf(schreibend: bool = False) -> dict[str, str]:
    kopf = {"apikey": ANON, "Authorization": f"Bearer {_anmelden()}"}
    kopf["Content-Profile" if schreibend else "Accept-Profile"] = SCHEMA
    return kopf


def _fehlertext(antwort: httpx.Response) -> str:
    """Die Meldung der Datenbank durchreichen, nicht ersetzen.

    velocity gibt bei jeder abgewiesenen Aenderung einen deutschen Satz
    zurueck, der sagt, WARUM sie abgewiesen wurde ("Nur Werkstatt oder
    Leitung duerfen ..."). Ein eigener Text daneben waere schlechter.
    """
    try:
        d = antwort.json()
        teile = [d.get(k) for k in ("message", "details", "hint") if d.get(k)]
        return f"HTTP {antwort.status_code}: " + " — ".join(teile)
    except Exception:
        return f"HTTP {antwort.status_code}: {antwort.text[:300]}"


# ─────────────────────────────────────────────────────── Die Sichten
#
# Die Liste steht hier von Hand, weil PostgREST die Kommentare der
# Datenbank nur mit ausreichenden Rechten herausgibt und ein Server, der
# beim Start erst fragen muss, schlechter zu lesen ist.
#
# Damit sie nicht rostet, haelt tools/mcp_check.py sie gegen den
# Systemkatalog: Jede hier genannte Sicht muss es geben, und jede
# v_wawi_-Sicht der Datenbank muss hier stehen.
SICHTEN = {
    "v_wawi_flotte": "Ein Rad je Zeile: Rahmennummer, Typ, Status, Standort, "
                     "letzte Wartung, offene Schäden.",
    "v_wawi_modell": "Auswahlliste der Radmodelle — liefert die modell_id für "
                     "rad_anlegen.",
    "v_wawi_station": "Kapazität und Belegung je Station, auch stillgelegte.",
    "v_wawi_station_flotte": "Welche Räder stehen an welcher Station.",
    "v_wawi_stationsauslastung": "Zu- und Abgänge sowie Füllstand je Station.",
    "v_wawi_stationsverkehr_zeitfenster": "Zu- und Abgang je Station in "
                     "Zweistundenblöcken, Werktag und Wochenende getrennt.",
    "v_wawi_schaden": "Jede Schadensmeldung mit Rad, Schwere und Alter.",
    "v_wawi_auftrag": "Jeder Wartungsauftrag mit Rad, Bearbeiter und Stand.",
    "v_wawi_wartungsprognose": "Die eingefrorenen Prüflisten: Platz, "
                     "Dringlichkeit, Nutzungsquote je Rad.",
    "v_wawi_kunde": "Stammdaten, laufender Tarif und Kontostand je Kunde.",
    "v_wawi_kundenorte": "Kundschaft je Ort, aggregiert mit Koordinate.",
    "v_wawi_fahrt_km": "Strecke je Fahrt — die einzige Stelle, an der "
                     "geschätzt wird.",
    "v_wawi_fahrten_je_tag": "Fahrten und Umsatz je Kalendertag.",
    "v_wawi_fahrten_je_tag_typ": "Dasselbe, zusätzlich nach Radtyp getrennt.",
    "v_wawi_fahrten_je_tag_rad": "Jede an einem Tag abgeschlossene Fahrt.",
    "v_wawi_umsatz_radtyp": "Monatsumsatz je Radtyp — nur für die Leitung.",
    "v_wawi_umsatz_kundengruppe": "Monatsumsatz je Tarifgruppe — nur für die "
                     "Leitung.",
    "v_wawi_km_co2": "Gefahrene Kilometer und CO₂-Ersparnis gegenüber dem Pkw.",
    "v_wawi_protokoll": "Wer wann an welchem Datensatz welches Feld geändert "
                     "hat — ohne die Werte selbst. Nur für die Rolle leitung.",
    "v_wawi_radereignis": "Lebenslaufakte der Räder: wer wann welchen Status "
                     "gesetzt hat, mit Vorher-Nachher. Das zweite Protokollbuch.",
}

# Die vier api_-Funktionen der Website. Sie handeln auf dem eigenen
# Kundensatz des Aufrufers und koennen von einem Mitarbeiterkonto aus
# nichts ausrichten. tools/mcp_check.py liest diese Liste und meldet
# jede api_-Funktion, die weder Werkzeug noch Auslassung ist.
NICHT_ANGEBOTEN = {
    "api_ausleihe_starten": "handelt auf dem eigenen Kundensatz",
    "api_ausleihe_beenden": "handelt auf dem eigenen Kundensatz",
    "api_profil_aktualisieren": "handelt auf dem eigenen Kundensatz",
    "api_kunde_sicherstellen": "legt den eigenen Kundensatz an",
    "api_preisschaetzer_umschalten": "schaltet die Anzeige im eigenen Konto",
}

server = MCPServer(
    "velocity-wawi",
    instructions=(
        "Warenwirtschaft des Fahrradverleihs VeloCity — eine Fallstudie der "
        "THWS, keine echte Flotte. Lesen über sicht_lesen, ändern über die "
        "übrigen Werkzeuge. Jede Änderung wird protokolliert und ist unter "
        "dem Agentenkonto nachvollziehbar. Einige Eingriffe sind nicht "
        "rücknehmbar; sie sagen das in ihrer Beschreibung."),
)


# ─────────────────────────────────────────────────────── Lesen
@server.tool()
def sichten_auflisten() -> str:
    """Nennt die 20 Sichten der Warenwirtschaft mit ihrem Inhalt.

    Erster Aufruf, wenn unklar ist, wo etwas steht. Die Namen daraus
    gehören in sicht_lesen.
    """
    return "\n".join(f"{name:36} {zweck}" for name, zweck in SICHTEN.items())


@server.tool()
def sicht_lesen(sicht: str, spalten: str = "*", filter: dict[str, str] | None = None,
                sortierung: str | None = None, limit: int = 50) -> str:
    """Liest Zeilen aus einer Sicht der Warenwirtschaft.

    sicht      Name aus sichten_auflisten, etwa "v_wawi_flotte".
    spalten    Kommaliste, "*" für alle.
    filter     Spalte -> PostgREST-Ausdruck. Beispiele:
               {"status": "eq.defekt"}
               {"rahmennummer": "ilike.CB-002*"}
               {"meldungen_bisher": "gte.3"}
    sortierung "rang.asc" oder "gemeldet_am.desc".
    limit      Höchstens 500.
    """
    if sicht not in SICHTEN:
        return (f"Unbekannte Sicht: {sicht}. Verfügbar sind:\n"
                + "\n".join(f"  {n}" for n in SICHTEN))
    limit = max(1, min(int(limit), 500))
    parameter: dict[str, str] = {"select": spalten, "limit": str(limit)}
    if sortierung:
        parameter["order"] = sortierung
    for spalte, ausdruck in (filter or {}).items():
        parameter[spalte] = ausdruck

    antwort = httpx.get(f"{URL}/rest/v1/{sicht}", headers=_kopf(),
                        params=parameter, timeout=30)
    if antwort.status_code != 200:
        return _fehlertext(antwort)
    zeilen = antwort.json()
    if not zeilen:
        return "Keine Zeile trifft zu."
    return (f"{len(zeilen)} Zeile(n) aus {sicht}:\n"
            + json.dumps(zeilen, ensure_ascii=False, indent=1, default=str))


def _rpc(funktion: str, **argumente: Any) -> str:
    """Ruft eine api_-Funktion und gibt ihr Ergebnis als Text zurueck.

    NONE-WERTE WERDEN WEGGELASSEN, NICHT UEBERGEBEN. PostgREST macht aus
    einem uebergebenen null ein SQL-NULL und schaltet damit die VORGABE
    der Funktion ab. Bei api_wartungsprognose_erzeugen (p_stichtag
    default current_date) fiel das im ersten Durchstich auf: Der Aufruf
    ohne Stichtag lief mit stichtag = NULL, fand nichts, schrieb nichts
    und meldete "0" - kein Fehler, nur ein stilles Nichts. Wer einen
    Parameter nicht nennt, will die Vorgabe.
    """
    argumente = {k: v for k, v in argumente.items() if v is not None}
    antwort = httpx.post(f"{URL}/rest/v1/rpc/{funktion}", headers=_kopf(True),
                         json=argumente, timeout=60)
    if antwort.status_code not in (200, 204):
        return _fehlertext(antwort)
    if antwort.status_code == 204 or not antwort.text.strip():
        return "Erledigt."
    return json.dumps(antwort.json(), ensure_ascii=False, indent=1, default=str)


# ─────────────────────────────────────────────────────── Flotte
@server.tool()
def rad_anlegen(rahmennummer: str, modell_id: int, station_id: int,
                gewicht_kg: float, rahmenform: str, schaltung: str,
                bremsen: str, beleuchtung: str, antrieb: str,
                farbe: str = "rot", motortyp: str | None = None,
                reifengroesse_zoll: float | None = None,
                schlossnummer: str | None = None) -> str:
    """Legt ein neues Rad an und stellt es an eine Station.

    Braucht die Rolle disposition. Die modell_id steht in v_wawi_modell,
    die station_id in v_wawi_station. Die Rahmennummer muss frei sein.

    Pflicht ist auch die Ausstattung — ein Rad ohne diese Angaben nimmt
    die Datenbank nicht an:

      gewicht_kg   das gewogene Gewicht DIESES Rades, nicht der Bauart
      rahmenform   diamant | tiefeinsteiger
      schaltung    nabe | kette | keine
      bremsen      felge | scheibe | ruecktritt
      beleuchtung  nabendynamo | akku | keine
      antrieb      kette | riemen

    Freiwillig: farbe (Vorgabe rot), motortyp — nur bei einem Typ mit
    Elektroantrieb, sonst weist die Datenbank es ab —,
    reifengroesse_zoll und schlossnummer, die je Rad eindeutig ist.
    """
    return _rpc("api_rad_anlegen", p_rahmennummer=rahmennummer,
                p_modell_id=modell_id, p_station_id=station_id,
                p_gewicht_kg=gewicht_kg, p_rahmenform=rahmenform,
                p_schaltung=schaltung, p_bremsen=bremsen,
                p_beleuchtung=beleuchtung, p_antrieb=antrieb,
                p_farbe=farbe, p_motortyp=motortyp,
                p_reifengroesse_zoll=reifengroesse_zoll,
                p_schlossnummer=schlossnummer)


@server.tool()
def rad_status_setzen(fahrrad_id: int, status: str, bemerkung: str | None = None) -> str:
    """Setzt den Status eines Rades.

    status: verfuegbar, wartung oder defekt. Ein Rad in laufender Fahrt
    lässt sich nicht umsetzen — das weist die Datenbank ab. Braucht
    werkstatt oder disposition.
    """
    return _rpc("api_rad_status_setzen", p_fahrrad_id=fahrrad_id,
                p_status=status, p_bemerkung=bemerkung)


@server.tool()
def rad_ausmustern(fahrrad_id: int, grund: str) -> str:
    """Nimmt ein Rad dauerhaft aus dem Bestand.

    NICHT RÜCKNEHMBAR. Das Rad zählt danach in keiner Auswertung mehr
    mit. Braucht die Rolle leitung.
    """
    return _rpc("api_rad_ausmustern", p_fahrrad_id=fahrrad_id, p_grund=grund)


# ─────────────────────────────────────────────────────── Instandhaltung
@server.tool()
def schaden_melden(fahrrad_id: int, kategorie: str, beschreibung: str,
                   schwere: str) -> str:
    """Meldet einen Schaden an einem Rad.

    schwere: gering, mittel oder fahruntauglich. Ein fahruntauglicher
    Schaden sperrt das Rad sofort — außer es ist gerade unterwegs, dann
    greift die Sperre bei der Rückgabe. Braucht werkstatt.
    """
    return _rpc("api_schaden_melden", p_fahrrad_id=fahrrad_id,
                p_kategorie=kategorie, p_beschreibung=beschreibung,
                p_schwere=schwere)


@server.tool()
def auftrag_eroeffnen(fahrrad_id: int, schadensmeldung_id: int | None = None) -> str:
    """Eröffnet einen Wartungsauftrag, mit oder ohne Schadensmeldung.

    Ohne Meldung ist es eine Inspektion ohne Anlass. Braucht werkstatt.
    """
    return _rpc("api_auftrag_eroeffnen", p_fahrrad_id=fahrrad_id,
                p_schadensmeldung_id=schadensmeldung_id)


@server.tool()
def auftrag_erledigen(wartungsauftrag_id: int, arbeitszeit_minuten: int,
                      bemerkung: str | None = None) -> str:
    """Schließt einen Wartungsauftrag ab.

    Das Rad wird nur dann wieder frei, wenn kein anderer Schaden offen
    ist — das entscheidet die Datenbank. Braucht werkstatt.
    """
    return _rpc("api_auftrag_erledigen", p_wartungsauftrag_id=wartungsauftrag_id,
                p_arbeitszeit_minuten=arbeitszeit_minuten, p_bemerkung=bemerkung)


@server.tool()
def wartungsprognose_erzeugen(stichtag: str | None = None,
                              kapazitaet: int = 60) -> str:
    """Friert die Prüfliste eines Stichtags ein.

    Sortiert die Räder nach Fahrminuten seit der letzten Reparatur,
    gemessen am Median ihres Radtyps. Eine vorhandene Liste desselben
    Stichtags wird NICHT überschrieben — sie ist der Maßstab für die
    Nachprüfung nach 90 Tagen. Braucht werkstatt oder leitung.
    """
    return _rpc("api_wartungsprognose_erzeugen", p_stichtag=stichtag,
                p_kapazitaet=kapazitaet)


# ─────────────────────────────────────────────────────── Kundschaft
@server.tool()
def kunde_anlegen(vorname: str, nachname: str, email: str,
                  telefon: str | None = None) -> str:
    """Legt einen Kundensatz an. Braucht kundenservice."""
    return _rpc("api_kunde_anlegen", p_vorname=vorname, p_nachname=nachname,
                p_email=email, p_telefon=telefon)


@server.tool()
def kunde_aktualisieren(kunde_id: int, vorname: str, nachname: str,
                        telefon: str | None = None, strasse: str | None = None,
                        hausnummer: str | None = None, plz: str | None = None,
                        ort: str | None = None) -> str:
    """Ändert Stammdaten eines Kunden. Braucht kundenservice."""
    return _rpc("api_kunde_aktualisieren", p_kunde_id=kunde_id,
                p_vorname=vorname, p_nachname=nachname, p_telefon=telefon,
                p_strasse=strasse, p_hausnummer=hausnummer, p_plz=plz, p_ort=ort)


@server.tool()
def kunde_sperren(kunde_id: int, grund: str) -> str:
    """Sperrt einen Kunden für weitere Ausleihen.

    Umkehrbar über kunde_aktualisieren ist das NICHT — der Status wird
    von der Datenbank gesetzt. Braucht kundenservice oder leitung.
    """
    return _rpc("api_kunde_sperren", p_kunde_id=kunde_id, p_grund=grund)


@server.tool()
def kunde_anonymisieren(kunde_id: int, grund: str) -> str:
    """Löscht Vorname, Nachname und E-Mail eines Kunden.

    NICHT RÜCKNEHMBAR — das ist der Zweck der Funktion (Art. 17 DSGVO).
    Fahrten und Rechnungen bleiben bestehen, aber ohne Person dahinter.
    Braucht die Rolle leitung.

    Auf dieser Versuchsplattform ist der Aufruf erlaubt, damit sichtbar
    wird, was ein Agent anrichten kann. Zurück geht es nur über
    bash tools/velocity_zuruecksetzen.sh.
    """
    return _rpc("api_kunde_anonymisieren", p_kunde_id=kunde_id, p_grund=grund)


@server.tool()
def kunde_loeschen(kunde_id: int, grund: str) -> str:
    """Löscht einen Kunden vollständig — die Zeile verschwindet.

    NICHT RÜCKNEHMBAR, und die einzige Stelle im ganzen System, an der
    eine Fachzeile wirklich gelöscht wird.

    Geht nur, wenn NICHTS am Kunden hängt: keine Fahrt, keine Rechnung,
    keine Mitgliedschaft, keine Schadensmeldung. Sonst verweigert die
    Datenbank und nennt, was dagegensteht — für diese Fälle gilt die
    Aufbewahrungspflicht nach § 147 AO und § 257 HGB, und der richtige
    Weg ist kunde_anonymisieren.

    Braucht kundenservice.
    """
    return _rpc("api_kunde_loeschen", p_kunde_id=kunde_id, p_grund=grund)


@server.tool()
def kunde_auskunft(kunde_id: int) -> str:
    """Erzeugt die Selbstauskunft nach Art. 15 DSGVO als JSON.

    Nur lesend. Braucht kundenservice oder leitung.
    """
    return _rpc("api_kunde_auskunft", p_kunde_id=kunde_id)


# ─────────────────────────────────────────────────────── Stationen
@server.tool()
def station_anlegen(name: str, strasse: str, hausnummer: str, plz: str, ort: str,
                    latitude: float, longitude: float, kapazitaet: int) -> str:
    """Legt eine Station an. Braucht disposition oder leitung."""
    return _rpc("api_station_anlegen", p_name=name, p_strasse=strasse,
                p_hausnummer=hausnummer, p_plz=plz, p_ort=ort,
                p_latitude=latitude, p_longitude=longitude,
                p_kapazitaet=kapazitaet)


@server.tool()
def station_stilllegen(station_id: int, zum: str | None = None) -> str:
    """Legt eine Station still, standardmäßig zum heutigen Tag.

    Räder, die dort stehen, müssen vorher weg — sonst weist die
    Datenbank ab. Braucht disposition oder leitung.
    """
    return _rpc("api_station_stilllegen", p_station_id=station_id, p_zum=zum)


# ─────────────────────────────────────────────────────── Lehrbetrieb
@server.tool()
def vorfuehrbestand_auffrischen() -> str:
    """Startet erfundene Ausleihen, bis mindestens 40 % der Flotte unterwegs ist.

    Für Vorführungen: Sie werden nicht abgerechnet und gehen in keine
    Umsatz-, Fahrten- oder CO₂-Auswertung ein. Braucht leitung.
    """
    return _rpc("api_lehrbetrieb_vorfuehrbestand_auffrischen")


@server.tool()
def protokoll_lesen(tabelle: str | None = None, seit: str | None = None,
                    limit: int = 30) -> str:
    """Zeigt, wer zuletzt was geändert hat.

    tabelle  auf eine Tabelle einschränken, etwa "kunde" oder "fahrrad".
    seit     ISO-Zeitpunkt, etwa "2026-09-04T20:00".
    limit    höchstens 200, jüngste zuerst.

    Die geänderten WERTE stehen bewusst nicht darin: Das Protokoll hält
    zu jeder Änderung den alten und den neuen Wert fest — für die ganze
    Kundschaft. Mit ihnen wäre es keine Aufsicht mehr, sondern eine
    Datenquelle. Wer wann was angefasst hat, beantwortet diese Sicht
    vollständig — womit, nicht.

    Braucht die Rolle leitung.
    """
    filter: dict[str, str] = {}
    if tabelle:
        filter["tabelle"] = f"eq.{tabelle}"
    if seit:
        filter["zeitpunkt"] = f"gte.{seit}"
    return sicht_lesen("v_wawi_protokoll", filter=filter,
                       sortierung="zeitpunkt.desc", limit=min(int(limit), 200))


@server.tool()
def radereignisse_lesen(rahmennummer: str | None = None, seit: str | None = None,
                        limit: int = 30) -> str:
    """Zeigt, was zuletzt mit den Rädern geschah — das zweite Protokollbuch.

    rahmennummer  auf ein Rad einschränken, etwa "CB-00021".
    seit          ISO-Zeitpunkt, etwa "2026-09-04T20:00".
    limit         höchstens 200, jüngste zuerst.

    Änderungen an Rädern stehen NICHT in protokoll_lesen: Den
    Protokolltrigger tragen nur kunde, mitarbeiter und station. Räder
    führen eine eigene Lebenslaufakte, und die Bemerkung dort nennt das
    Vorher-Nachher im Klartext ("verfuegbar -> wartung - Grund").

    Braucht werkstatt, disposition oder leitung.
    """
    filter: dict[str, str] = {}
    if rahmennummer:
        filter["rahmennummer"] = f"eq.{rahmennummer}"
    if seit:
        filter["zeitpunkt"] = f"gte.{seit}"
    return sicht_lesen("v_wawi_radereignis", filter=filter,
                       sortierung="zeitpunkt.desc", limit=min(int(limit), 200))


# ─────────────────────────────────────────────────────── Selbsttest
def _selbsttest() -> int:
    """Meldet sich an und liest eine Zeile - mehr nicht.

    Gedacht fuer die Einrichtung: Wer den Server in Claude Desktop
    eintraegt und dort nur "keine Werkzeuge" sieht, sucht sonst im
    falschen Programm.
    """
    print(f"Anmeldung als {EMAIL or '(nicht gesetzt)'} an {URL or '(nicht gesetzt)'}")
    try:
        _anmelden()
    except Exception as fehler:                       # noqa: BLE001
        print(f"  FEHLER  {fehler}")
        return 1
    print("  ok      angemeldet")

    antwort = httpx.get(f"{URL}/rest/v1/v_wawi_flotte", headers=_kopf(),
                        params={"select": "rahmennummer", "limit": "1"}, timeout=30)
    if antwort.status_code != 200 or not antwort.json():
        print(f"  FEHLER  v_wawi_flotte lieferte nichts: {_fehlertext(antwort)}")
        print("          Traegt das Konto einen Mitarbeitersatz mit Rollen?")
        print("          python3 db/run.py db/betrieb/mitarbeiter_agentenkonto.sql")
        return 1
    print(f"  ok      v_wawi_flotte lesbar (erstes Rad: "
          f"{antwort.json()[0]['rahmennummer']})")
    import asyncio
    werkzeuge = asyncio.run(server.list_tools())
    print(f"  ok      {len(SICHTEN)} Sichten, {len(werkzeuge)} Werkzeuge angemeldet")
    return 0


if __name__ == "__main__":
    if "--pruefen" in sys.argv:
        raise SystemExit(_selbsttest())
    server.run("stdio")
