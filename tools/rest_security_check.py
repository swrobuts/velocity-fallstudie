#!/usr/bin/env python3
"""Prueft ueber die REST-Schnittstelle, dass der anon-Key an keine
personenbezogenen Daten kommt.

Aufruf:
    python3 tools/rest_security_check.py

Liest SUPABASE_URL und SUPABASE_ANON_KEY aus .env.

Rueckgabewert 0, wenn alle Erwartungen erfuellt sind; 1 bei Abweichungen;
2, wenn das Schema bei PostgREST gar nicht freigegeben ist - dann belegt
die Pruefung nichts und darf nicht als bestanden gelten.
"""
from __future__ import annotations

import json
import pathlib
import sys
import urllib.error
import urllib.request

WURZEL = pathlib.Path(__file__).resolve().parent.parent
SCHEMA = "velocity"

# Ressourcen, die anon NICHT erreichen darf.
GESPERRT = [
    "kunde", "adresse", "zahlungsmittel", "rechnung", "rechnungsposition",
    "zahlung", "mitgliedschaft", "freiminuten_periode", "ausleihe",
    "entgeltposition", "v_meine_ausleihe", "v_meine_rechnung", "v_mein_profil",
]

# Ressourcen, die anon erreichen MUSS, damit die Website funktioniert.
ERLAUBT = [
    "v_station", "v_verfuegbares_fahrrad", "v_tarifkarte", "v_tarif",
    "v_faq", "v_nutzungsschritt", "v_kennzahl", "v_hoehenmarke", "v_geschaeftsgebiet",
]


def lies_env() -> tuple[str, str]:
    werte: dict[str, str] = {}
    pfad = WURZEL / ".env"
    if pfad.exists():
        for zeile in pfad.read_text(encoding="utf-8").splitlines():
            zeile = zeile.strip()
            if zeile and not zeile.startswith("#") and "=" in zeile:
                k, v = zeile.split("=", 1)
                werte[k.strip()] = v.strip()
    fehlend = [k for k in ("SUPABASE_URL", "SUPABASE_ANON_KEY") if k not in werte]
    if fehlend:
        sys.exit("Fehlend in .env: " + ", ".join(fehlend))
    return werte["SUPABASE_URL"].rstrip("/"), werte["SUPABASE_ANON_KEY"]


def hole(basis: str, key: str, ressource: str) -> tuple[int, str]:
    anfrage = urllib.request.Request(
        f"{basis}/rest/v1/{ressource}?select=*&limit=1",
        headers={"apikey": key, "Accept-Profile": SCHEMA},
    )
    try:
        with urllib.request.urlopen(anfrage, timeout=20) as antwort:
            return antwort.status, antwort.read(400).decode("utf-8", "replace")
    except urllib.error.HTTPError as fehler:
        return fehler.code, fehler.read(400).decode("utf-8", "replace")


def schema_nicht_freigegeben(koerper: str) -> bool:
    """Erkennt PGRST106: das Schema ist bei PostgREST gar nicht exponiert.

    Diese Unterscheidung ist der Kern der Pruefung. Eine gesperrte
    Ressource, die nur deshalb nicht erreichbar ist, weil das ganze Schema
    unbekannt ist, belegt NICHTS ueber den Zugriffsschutz. Wer das nicht
    trennt, bekommt ein gruenes Ergebnis, das nichts wert ist.
    """
    return '"PGRST106"' in koerper


def main() -> int:
    basis, key = lies_env()

    # Vorpruefung: ist das Schema ueberhaupt exponiert? Sonst ist jede
    # weitere Aussage wertlos.
    status, koerper = hole(basis, key, ERLAUBT[0])
    if schema_nicht_freigegeben(koerper):
        print(f"ABBRUCH  Das Schema '{SCHEMA}' ist bei PostgREST nicht freigegeben.")
        print("         Damit ist NICHTS ueber den Zugriffsschutz belegt: alle")
        print("         Ressourcen waeren unerreichbar, sichere wie unsichere.")
        print()
        print("         Freizuschalten in Supabase Studio unter")
        print("         Project Settings > API > Exposed schemas, oder per")
        print("         PGRST_DB_SCHEMAS in der docker-compose.yml des VPS.")
        print()
        print(f"         Antwort des Servers: {koerper[:200]}")
        return 2

    fehler = 0

    for ressource in GESPERRT:
        status, koerper = hole(basis, key, ressource)
        if status == 200 and json.loads(koerper or "[]"):
            print(f"FEHLER  {ressource}: anon erhaelt Daten (HTTP 200)")
            fehler += 1
        else:
            print(f"ok      {ressource}: kein Zugriff (HTTP {status})")

    for ressource in ERLAUBT:
        status, koerper = hole(basis, key, ressource)
        if status != 200:
            print(f"FEHLER  {ressource}: sollte oeffentlich sein, HTTP {status} - {koerper[:120]}")
            fehler += 1
        else:
            print(f"ok      {ressource}: oeffentlich erreichbar")

    print(f"\n{fehler} Abweichung(en).")
    return 1 if fehler else 0


if __name__ == "__main__":
    raise SystemExit(main())
