
import json, sys
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

von = float(np.maximum(1.0, p["modell_unten"].predict(zeile))[0])
bis = float(p["modell_oben"].predict(zeile)[0])
tarif = p["tarif"][typ]
preis = lambda m: round(tarif["startgebuehr"] + m * tarif["preis_pro_minute"], 2)
print(json.dumps({"von_min": round(von), "bis_min": round(bis),
                  "von_eur": preis(round(von)), "bis_eur": preis(round(bis)),
                  "zusage": p["zusage_text"],
                  "gueltig_bis": p["operativ_gueltig_bis"]}))
