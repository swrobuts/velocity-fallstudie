#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Vergleicht die GRANTs aus db/aufbau/*.sql mit der Datenbank.

Aufruf:
    python3 tools/grants_pruefen.py

Wozu
----
Die Abnahme prueft bisher nur die eine Richtung: dass keine Funktion
VERSEHENTLICH fuer jeden ausfuehrbar ist. Die andere Richtung fehlte -
dass ein Recht, das im Repo steht, in der Datenbank auch wirklich gesetzt
ist.

Genau daran ist der Preisschaetzer gescheitert: Funktion vorhanden,
Spalte vorhanden, Website ausgeliefert, GRANT im Repo - aber nie
eingespielt. Der Schalter meldete "Einstellung konnte nicht gespeichert
werden", und nichts im Projekt konnte sagen warum.

Ein Recht, das nur in einer SQL-Datei steht, wirkt nicht. Genauso wenig
wie ein Erfolgskriterium, das nur im Text steht.

Wie geprueft wird
-----------------
Aus ALLEN Dateien in db/aufbau/ werden 'grant execute on function ... to
<rolle>' und 'grant select on velocity.v_... to <rolle>' gelesen und
einzeln gegen has_function_privilege beziehungsweise
has_table_privilege geprueft.

ALLE DATEIEN, NICHT NUR 0011 (seit 06.09.2026). Bis dahin las dieses
Werkzeug ausschliesslich 0011_sicherheit.sql und meldete dafuer "alle N
Rechte sind gesetzt" - waehrend es von
db/aufbau/0023_kunde_loeschen.sql:157 (api_kunde_loeschen an
authenticated) und von den Rechten in 0019 und 0021 gar nichts wusste.
Wieder derselbe Fehler wie an neun anderen Stellen dieses Projekts: eine
Pruefung mit von Hand gezogener Grenze bleibt gruen, waehrend hinter der
Grenze etwas fehlt.

Grenzen - bewusst benannt
-------------------------
Geprueft wird, was als grant-Zeile in db/aufbau/ steht. Ein Recht, das
NIRGENDS im Repo steht, aber trotzdem gebraucht wird, sieht dieses
Werkzeug weiterhin nicht - dafuer ist es die falsche Richtung. Rechte
aus db/betrieb/ (Lehrzugang) und Row-Level-Security-Regeln ebenfalls
nicht. Ohne .env-Zugang meldet es sich ab, statt gruen zu behaupten.
"""
from __future__ import annotations

import os
import pathlib
import re
import sys

WURZEL = pathlib.Path(__file__).resolve().parent.parent
QUELLEN = sorted((WURZEL / "db" / "aufbau").glob("*.sql"))

ROT, GRUEN, GELB, AUS = "\033[0;31m", "\033[0;32m", "\033[0;33m", "\033[0m"

# EIN Muster fuer beide Arten, und es vertraegt LISTEN.
#
# Vorher standen hier zwei Muster der Form "...function (velocity.\w+\(...\))
# to (\w+)" - je genau EINE Funktion vor dem "to". Damit war
# 0019_wawi_logik.sql:1248 unsichtbar, wo neunzehn Funktionen in EINER
# Anweisung stehen, darunter velocity.ist_mitarbeiter() und
# velocity.hat_rolle(text). Das Werkzeug meldete am 06.09.2026 "alle 15
# Rechte sind gesetzt", waehrend ist_mitarbeiter fehlte und
# test_k_protokoll_unveraenderlich mit "permission denied for function
# ist_mitarbeiter" starb. Wieder dieselbe Sorte Fehler wie an den
# anderen Stellen dieses Projekts, diesmal in der Pruefung selbst.
# Nach dem "to" darf ebenfalls eine LISTE stehen ("to anon, authenticated") -
# ohne die Wiederholungsgruppe hoerte das Muster beim ersten Rollennamen auf
# und schob den Rest in das Ziel: "velocity.v_preisschaetzung to anon" als
# angebliche Sicht, "authenticated" als Rolle. Am 06.09.2026 im Lauf gesehen.
GRANT = re.compile(
    r"grant\s+(execute\s+on\s+function|select\s+on)\s+(.+?)\s+to\s+"
    r"([a-z_][a-z0-9_]*(?:\s*,\s*[a-z_][a-z0-9_]*)*)\s*;",
    re.IGNORECASE | re.DOTALL)

# Ein Ziel muss ein einfacher Name im Schema velocity sein, mit optionaler
# Signatur. Das siebt aus, was aus dynamischem SQL stammt: 0011_sicherheit.sql
# baut Grants per execute format('grant select on velocity.%I to ...'), und
# ohne diese Pruefung meldete das Werkzeug ernsthaft die fehlende Sicht
# "velocity.%I to authenticated'".
ZIEL = re.compile(r"^velocity\.[a-z_][a-z0-9_]*(?:\([^()]*\))?$", re.IGNORECASE)


def ohne_kommentare(text: str) -> str:
    """Entfernt SQL-Zeilenkommentare.

    Ohne das zaehlt eine auskommentierte grant-Zeile als Versprechen -
    db/betrieb/lehrzugang.sql fuehrt genau so eine. Ein "--" innerhalb
    eines Zeichenkettenliterals bleibt stehen (ungerade Anzahl
    Hochkommata davor)."""
    sauber = []
    for zeile in text.splitlines():
        stelle = zeile.find("--")
        while stelle != -1:
            if zeile.count("'", 0, stelle) % 2 == 0:
                zeile = zeile[:stelle]
                break
            stelle = zeile.find("--", stelle + 2)
        sauber.append(zeile)
    return "\n".join(sauber)


def liste_zerlegen(rohtext: str) -> list[str]:
    """Trennt an Kommas AUSSERHALB der Klammern.

    "a(), b(text, int)" ergibt ["a()", "b(text, int)"] - ein naives
    split(',') haette daraus drei Bruchstuecke gemacht."""
    teile, tiefe, gesammelt = [], 0, []
    for zeichen in rohtext:
        if zeichen == "(":
            tiefe += 1
        elif zeichen == ")":
            tiefe -= 1
        if zeichen == "," and tiefe == 0:
            teile.append("".join(gesammelt))
            gesammelt = []
        else:
            gesammelt.append(zeichen)
    teile.append("".join(gesammelt))
    return [" ".join(teil.split()) for teil in teile if teil.strip()]


def rechte_aus_dem_repo() -> tuple[list, list]:
    """Alle grant-Zeilen aus db/aufbau/, mit Herkunftsdatei.

    Einzige Quelle fuer dieses Werkzeug UND fuer tools/rechte_setzen.py -
    zwei Listen wuerden auseinanderlaufen."""
    funktionen, sichten = [], []
    for quelle in QUELLEN:
        text = ohne_kommentare(quelle.read_text(encoding="utf-8"))
        for art, rohliste, rollen in GRANT.findall(text):
            for ziel in liste_zerlegen(rohliste):
                # Signaturen duerfen ueber Zeilen laufen; Postgres liest
                # sie mit einfachen Leerzeichen genauso.
                ziel = " ".join(ziel.split())
                if not ZIEL.match(ziel.replace(", ", ",").replace(" ", "")
                                  if "(" in ziel else ziel):
                    continue
                for rolle in (r.strip() for r in rollen.split(",")):
                    if art.lower().startswith("execute"):
                        funktionen.append((ziel, rolle, quelle.name))
                    elif "(" not in ziel:   # Sicht oder Tabelle, keine Funktion
                        sichten.append((ziel, rolle, quelle.name))
    return funktionen, sichten


def umgebung_laden() -> None:
    pfad = WURZEL / ".env"
    if not pfad.exists():
        return
    for zeile in pfad.read_text(encoding="utf-8").splitlines():
        if "=" in zeile and not zeile.strip().startswith("#"):
            k, w = zeile.split("=", 1)
            os.environ.setdefault(k.strip(), w.strip())


def main() -> int:
    umgebung_laden()
    try:
        import psycopg2
    except ImportError:
        print(f"{GELB}uebersprungen{AUS} psycopg2 fehlt")
        return 0
    if not os.environ.get("PGHOST"):
        print(f"{GELB}uebersprungen{AUS} kein Datenbankzugang in .env")
        return 0

    # Herkunft mitfuehren: bei einem Fund soll dastehen, WELCHE Datei
    # das Recht verspricht - sonst sucht man es in 24 Dateien.
    funktionen, sichten = rechte_aus_dem_repo()

    try:
        verbindung = psycopg2.connect(
            host=os.environ["PGHOST"], port=os.environ.get("PGPORT", "5432"),
            dbname=os.environ["PGDATABASE"], user=os.environ["PGUSER"],
            password=os.environ["PGPASSWORD"], connect_timeout=15)
    except Exception as fehler:
        print(f"{GELB}uebersprungen{AUS} keine Verbindung: {str(fehler)[:80]}")
        return 0

    zeiger = verbindung.cursor()
    fehlend = []

    for signatur, rolle, datei in funktionen:
        try:
            zeiger.execute("select has_function_privilege(%s, %s, 'execute')",
                           (rolle, signatur))
            if not zeiger.fetchone()[0]:
                fehlend.append(("execute", rolle, signatur, datei))
        except Exception:
            verbindung.rollback()
            fehlend.append(("execute", rolle, signatur + "  [Funktion fehlt]", datei))

    for sicht, rolle, datei in sichten:
        try:
            zeiger.execute("select has_table_privilege(%s, %s, 'select')",
                           (rolle, sicht))
            if not zeiger.fetchone()[0]:
                fehlend.append(("select", rolle, sicht, datei))
        except Exception:
            verbindung.rollback()
            fehlend.append(("select", rolle, sicht + "  [Sicht fehlt]", datei))

    gesamt = len(funktionen) + len(sichten)
    if fehlend:
        print(f"{ROT}FEHLEND{AUS}  {len(fehlend)} von {gesamt} Rechten stehen im "
              f"Repo, aber nicht in der Datenbank:")
        for art, rolle, ziel, datei in fehlend:
            print(f"         {art:<8s} {rolle:<16s} {ziel}")
            print(f"         {'':<8s} {'':<16s}   versprochen in {datei}")
        print("\n         Ein Recht, das nur in der SQL-Datei steht, wirkt nicht.")
        return 1

    print(f"{GRUEN}ok{AUS}       alle {gesamt} Rechte aus {len(QUELLEN)} Dateien "
          f"in db/aufbau/ sind gesetzt")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
