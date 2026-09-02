
import json, math, sys
import joblib, numpy as np, pandas as pd

p = joblib.load(sys.argv[1])
a = json.loads(sys.argv[2])
s, z, typ = int(a["start_id"]), int(a["ziel_id"]), a["typ_code"]
t = pd.Timestamp(a["zeitpunkt"])

# ALLES aus dem Paket - keine Datei, kein Notebook, kein Netz.
route = p["routenmerkmale"][f"{s}->{z}"]
n_s, n_z = p["stationsnamen"][s], p["stationsnamen"][z]
tag = str(t.date())
zeile = pd.DataFrame([{
    "start_name": n_s, "ziel_name": n_z, "route": n_s + " → " + n_z,
    "typ_code": typ,
    "strecke_km": route["strecke_km"],
    "steigung_promille": route["steigung_promille"],
    "stunde_sin": np.sin(2*np.pi*t.hour/24), "stunde_cos": np.cos(2*np.pi*t.hour/24),
    "wochentag_sin": np.sin(2*np.pi*t.dayofweek/7),
    "wochentag_cos": np.cos(2*np.pi*t.dayofweek/7),
    "monat_sin": np.sin(2*np.pi*t.month/12), "monat_cos": np.cos(2*np.pi*t.month/12),
    "ist_wochenende": int(t.dayofweek >= 5),
    "ist_feiertag": int(tag in set(p["feiertage"])),
    "ist_ferien": int(any(f["von"] <= tag <= f["bis"] for f in p["schulferien"])),
    "zielverlaesslichkeit": p["zielverlaesslichkeit_tabelle"].get(
        str(s) + "->" + str(z), p["zielverlaesslichkeit_global"]),
}])[p["merkmale"]]

# 1) DAS AUSGELIEFERTE PRODUKT: die Tabelle.
fenster = next((n for a, b, n in p["zeitfenster_grenzen"] if a <= t.hour < b), "nacht")
treffer = [r for r in p["tabelle"]
           if r["start_station_id"] == s and r["ziel_station_id"] == z
           and r["typ_code"] == typ and r["zeitfenster"] == fenster]
tab_von = treffer[0]["minuten_von"] if treffer else None
tab_bis = treffer[0]["minuten_bis"] if treffer else None

# 2) DIE ALTERNATIVE: das Modell.
mod_von = float(np.maximum(1.0, p["modell_unten"].predict(zeile))[0])
mod_bis = float(p["modell_oben"].predict(zeile)[0])

# Die VOLLSTAENDIGE Preisformel - mit Deckel.
tar = p["tarif"][typ]
def preis(minuten, frei=0.0, rabatt=0.0):
    m = int(math.ceil(max(0.0, minuten)))
    berechnet = m - min(frei, m)
    tage = max(1, math.ceil(m / (24 * 60)))
    roh = min(tar["startgebuehr"] + berechnet * tar["preis_pro_minute"],
              tar["tageshoechstpreis"] * tage)
    return round(roh * (1 - rabatt / 100.0), 2)

print(json.dumps({
    "produkt": p["produkt"],
    "tab_von_min": tab_von, "tab_bis_min": tab_bis,
    "tab_von_eur": None if tab_von is None else preis(tab_von),
    "tab_bis_eur": None if tab_bis is None else preis(tab_bis),
    "modell_von_min": round(mod_von), "modell_bis_min": round(mod_bis),
    "zusage": p["zusage_text"],
    "gueltig_bis": p["operativ_gueltig_bis"]}))
