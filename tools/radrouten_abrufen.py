"""Ruft die Radroutenmatrix fuer alle Start- und Zielorte des Systems ab.

Orte sind die zehn Stationen aus analytics/station.csv und eine raeumlich
gestreute Auswahl der oeffentlichen Fahrradstellplaetze der Stadt Wuerzburg.
Die Stellplaetze dienen als Endpunkte freistehender Raeder.

Strecken kommen aus dem OSRM-Fahrradprofil, Hoehen aus SRTM 30 m.
Das Ergebnis wird eingecheckt, damit die Datenerzeugung ohne Netzzugang
reproduzierbar bleibt. Neu abrufen nur, wenn sich die Ortsliste aendert.

Aufruf:  python tools/radrouten_abrufen.py
"""
from __future__ import annotations

import json
import math
import time
import urllib.request
from pathlib import Path

import pandas as pd
from sklearn.cluster import KMeans

BASIS = Path(__file__).resolve().parent.parent
ROUTER = "https://routing.openstreetmap.de/routed-bike/route/v1/driving"
HOEHEN = "https://api.opentopodata.org/v1/srtm30m"
OPENDATA = ("https://opendata.wuerzburg.de/api/explore/v2.1/catalog/datasets/"
            "fahrradstellplaetze-stadt-wuerzburg/records")
KOPF = {"User-Agent": "velocity-fallstudie/2.0 (lehre)"}
ABSTELLORTE = 25
PAUSE_S = 0.35
ERDRADIUS_M = 6_371_008.8


def hole(url: str, versuche: int = 3) -> dict:
    for versuch in range(versuche):
        try:
            with urllib.request.urlopen(
                    urllib.request.Request(url, headers=KOPF), timeout=60) as antwort:
                return json.loads(antwort.read().decode())
        except Exception:
            if versuch == versuche - 1:
                raise
            time.sleep(2 ** versuch)
    raise RuntimeError("unerreichbar")


def luftlinie_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = math.radians(lat2 - lat1), math.radians(lon2 - lon1)
    x = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * ERDRADIUS_M * math.asin(math.sqrt(x))


def im_gebiet(lon: float, lat: float, polygon: list[tuple[float, float]]) -> bool:
    innen, j = False, len(polygon) - 1
    for i in range(len(polygon)):
        xi, yi = polygon[i]
        xj, yj = polygon[j]
        if ((yi > lat) != (yj > lat)) and (lon < (xj - xi) * (lat - yi) / (yj - yi) + xi):
            innen = not innen
        j = i
    return innen


def abstellorte() -> pd.DataFrame:
    """Waehlt raeumlich gestreute Stellplaetze innerhalb des Geschaeftsgebiets."""
    saetze, versatz = [], 0
    while True:
        seite = hole(f"{OPENDATA}?limit=100&offset={versatz}").get("results", [])
        saetze += seite
        if len(seite) < 100:
            break
        versatz += len(seite)

    zeilen = []
    for satz in saetze:
        punkt = satz.get("geo_point_2d") or {}
        if punkt.get("lat") is None or punkt.get("lon") is None:
            continue
        zeilen.append({"lat": float(punkt["lat"]), "lon": float(punkt["lon"]),
                       "name": (satz.get("title") or "Abstellort").strip()})
    alle = pd.DataFrame(zeilen).drop_duplicates(subset=["lat", "lon"])

    ecken = pd.read_csv(BASIS / "analytics/geschaeftsgebiet.csv").sort_values("ecke")
    polygon = list(zip(ecken.longitude, ecken.latitude))
    innen = alle[[im_gebiet(r.lon, r.lat, polygon) for r in alle.itertuples()]].copy()
    print(f"Stellplaetze: {len(alle)} gesamt, {len(innen)} im Geschaeftsgebiet")

    gruppen = KMeans(n_clusters=ABSTELLORTE, n_init=10, random_state=42)
    innen["gruppe"] = gruppen.fit_predict(innen[["lon", "lat"]].values)
    gewaehlt = []
    for nummer in range(ABSTELLORTE):
        teil = innen[innen.gruppe == nummer]
        mitte = gruppen.cluster_centers_[nummer]
        abstand = (teil.lon - mitte[0]) ** 2 + (teil.lat - mitte[1]) ** 2
        gewaehlt.append(teil.loc[abstand.idxmin()])
    orte = pd.DataFrame(gewaehlt).reset_index(drop=True)
    orte["ort_id"] = [f"P-{i + 1:04d}" for i in range(len(orte))]
    return orte[["ort_id", "name", "lat", "lon"]]


def main() -> None:
    stationen = pd.read_csv(BASIS / "analytics/station.csv")
    orte = pd.concat([
        pd.DataFrame({"ort_id": stationen.station_id.astype(str),
                      "name": stationen.name, "art": "station",
                      "lat": stationen.latitude, "lon": stationen.longitude}),
        abstellorte().assign(art="abstellort"),
    ], ignore_index=True)
    print(f"{len(orte)} Orte, {len(orte) * (len(orte) - 1)} gerichtete Relationen")

    punkte = "|".join(f"{r.lat},{r.lon}" for r in orte.itertuples())
    orte["hoehe_m"] = [e["elevation"] for e in hole(f"{HOEHEN}?locations={punkte}")["results"]]

    zeilen, erledigt = [], 0
    gesamt = len(orte) * (len(orte) - 1)
    for von in orte.itertuples():
        for nach in orte.itertuples():
            if von.ort_id == nach.ort_id:
                continue
            paar = f"{von.lon:.6f},{von.lat:.6f};{nach.lon:.6f},{nach.lat:.6f}"
            route = hole(f"{ROUTER}/{paar}?overview=false")["routes"][0]
            strecke = round(float(route["distance"]), 1)
            luft = luftlinie_m(von.lat, von.lon, nach.lat, nach.lon)
            hoehe = nach.hoehe_m - von.hoehe_m
            zeilen.append({
                "von_id": von.ort_id, "von_name": von.name, "von_art": von.art,
                "nach_id": nach.ort_id, "nach_name": nach.name, "nach_art": nach.art,
                "luftlinie_m": round(luft, 1), "strecke_m": strecke,
                "hoehendifferenz_m": round(hoehe, 1),
                "steigung_promille": round(hoehe / strecke * 1000, 2) if strecke else 0.0,
                "umwegfaktor": round(strecke / luft, 3) if luft else 1.0,
            })
            erledigt += 1
            if erledigt % 100 == 0:
                print(f"   {erledigt}/{gesamt}", flush=True)
            time.sleep(PAUSE_S)

    matrix = pd.DataFrame(zeilen)
    ziel = BASIS / "analytics/radrouten_matrix.csv"
    heute = pd.Timestamp.today().strftime("%d.%m.%Y")
    with open(ziel, "w", encoding="utf-8") as datei:
        datei.write(
            "# Radroutenmatrix VeloCity Wuerzburg\n"
            f"# {len(matrix)} gerichtete Relationen zwischen {len(orte)} Orten:\n"
            f"# {(orte.art == 'station').sum()} Stationen und "
            f"{(orte.art == 'abstellort').sum()} oeffentliche Abstellorte.\n"
            "# Strecke: OSRM Fahrradprofil, routing.openstreetmap.de/routed-bike.\n"
            "# Hoehe: OpenTopoData SRTM 30 m. Abstellorte: OpenData Stadt Wuerzburg.\n"
            f"# Abgerufen am {heute} mit tools/radrouten_abrufen.py.\n"
            "# luftlinie_m: Haversine. umwegfaktor = strecke_m / luftlinie_m.\n"
            "# steigung_promille = hoehendifferenz_m / strecke_m * 1000.\n")
        matrix.to_csv(datei, index=False)
    orte.to_csv(BASIS / "analytics/abstellort.csv", index=False)
    print(f"Fertig: {ziel} ({len(matrix)} Zeilen)")


if __name__ == "__main__":
    main()
