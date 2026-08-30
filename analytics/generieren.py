"""
VeloCity-Analytics-Datensatz fuer PITM (CRISP-DM-Block).

WICHTIG - Herkunft der Daten (siehe README.md im Output-Ordner):
- wetter.csv: ECHTE historische Wetterdaten Wuerzburg (Open-Meteo/ERA5).
- feiertage.csv: ECHTE bayerische Feiertage.
- veranstaltungen.csv: ECHTE, real wiederkehrende Wuerzburger Grossveranstaltungen
  (Kiliani, Africa Festival, Weindorf, Stramu) mit PLAUSIBLEN Terminen je Jahr
  (exakte Tagesdaten schwanken jaehrlich, hier nicht recherchiert, sondern
  typische Kalenderwochen angesetzt - das steht auch in der Spalte 'genauigkeit').
- station.csv, fahrrad.csv, ausleihe.csv, schadensmeldung.csv,
  wartungsauftrag.csv: VOLLSTAENDIG ERFUNDEN, angelehnt an das echte
  VeloCity-Datenmodell (velocity-fallstudie), aber nie erhoben. Fuer
  didaktisch klare Muster bewusst verstaerkt ("gepimpt") - siehe README.md.

Fester Seed: jeder Lauf erzeugt dieselben Daten.
"""
import csv
import math
import random
from datetime import date, datetime, timedelta

random.seed(20260901)

OUT = "/tmp/velocity_analytics"
VON = date(2023, 9, 1)
BIS = date(2026, 8, 24)

# --------------------------------------------------------------- Stationen
# typ ist NICHT Teil des echten Schemas - nur intern fuer die Generierung,
# damit Clustering die Typen aus dem Nutzungsverhalten wiederfinden kann,
# statt sie vorgesetzt zu bekommen.
STATIONEN = [
    # id, stationsnummer, name, lat, lon, kapazitaet, typ
    (1, "S-0001", "Hauptbahnhof",        49.8018, 9.9359, 40, "pendler"),
    (2, "S-0002", "Residenz",            49.7936, 9.9436, 24, "freizeit"),
    (3, "S-0003", "Alte Mainbruecke",    49.7913, 9.9280, 20, "freizeit"),
    (4, "S-0004", "Sanderring",          49.7889, 9.9366, 30, "uni"),
    (5, "S-0005", "Hubland",             49.7766, 9.9720, 34, "uni"),
    (6, "S-0006", "Marktplatz",          49.7943, 9.9294, 26, "misch"),
    (7, "S-0007", "Zellerau",            49.7891, 9.9089, 22, "pendler"),
    (8, "S-0008", "Ringpark Nord",       49.8021, 9.9421, 18, "freizeit"),
    (9, "S-0009", "Kaeppele",            49.7847, 9.9186, 12, "freizeit"),
    (10, "S-0010", "Grombühl/Klinikum", 49.8064, 9.9536, 28, "pendler"),
]

with open(f"{OUT}/station.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["station_id", "stationsnummer", "name", "latitude", "longitude", "kapazitaet"])
    for sid, snr, name, lat, lon, kap, typ in STATIONEN:
        w.writerow([sid, snr, name, lat, lon, kap])

STATION_TYP = {s[0]: s[6] for s in STATIONEN}
STATION_IDS = [s[0] for s in STATIONEN]

# --------------------------------------------------------------- Flotte
TYPEN = [("CITY", 0.55), ("EBIKE", 0.35), ("CARGO", 0.10)]
N_RAEDER = 220

raeder = []
with open(f"{OUT}/fahrrad.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["fahrrad_id", "rahmennummer", "typ_code", "angeschafft_am", "status"])
    for i in range(1, N_RAEDER + 1):
        r = random.random()
        typ = "CITY" if r < 0.55 else ("EBIKE" if r < 0.90 else "CARGO")
        # Anschaffung gestaffelt: Grundflotte zu Start, Nachkaeufe im 2. und 3. Jahr
        r2 = random.random()
        if r2 < 0.7:
            ang = VON - timedelta(days=random.randint(0, 200))
        elif r2 < 0.9:
            ang = VON + timedelta(days=random.randint(200, 500))
        else:
            ang = VON + timedelta(days=random.randint(500, 900))
        raeder.append({"id": i, "typ": typ, "angeschafft": ang, "km_kumuliert": 0.0,
                        "fahrten_seit_wartung": 0, "ausgemustert": False})
        w.writerow([i, f"WUE-{i:04d}", typ, ang.isoformat(), "verfuegbar"])

# --------------------------------------------------------------- Wetter laden
wetter = {}
with open(f"{OUT}/wetter.csv", encoding="utf-8") as f:
    for row in csv.DictReader(f):
        wetter[row["datum"]] = {
            "temp": float(row["temp_mittel_c"]),
            "regen": float(row["niederschlag_mm"]),
        }

# --------------------------------------------------------------- Feiertage (Bayern, echt)
FEIERTAGE = set()
FEIERTAGE_ROWS = []
_FEIERTAGE_FIX = [(1, 1, "Neujahr"), (1, 6, "Heilige Drei Koenige"), (5, 1, "Tag der Arbeit"),
                   (8, 15, "Mariae Himmelfahrt"), (10, 3, "Tag der Deutschen Einheit"),
                   (11, 1, "Allerheiligen"), (12, 25, "1. Weihnachtsfeiertag"),
                   (12, 26, "2. Weihnachtsfeiertag")]
# bewegliche Feiertage 2023-2026 (Osterbasis), real recherchiert
_OSTERN = {2023: date(2023, 4, 9), 2024: date(2024, 3, 31), 2025: date(2025, 4, 20), 2026: date(2026, 4, 5)}
for jahr in (2023, 2024, 2025, 2026):
    for m, d, name in _FEIERTAGE_FIX:
        dt = date(jahr, m, d)
        FEIERTAGE.add(dt)
        FEIERTAGE_ROWS.append((dt, name))
    ostern = _OSTERN[jahr]
    for delta, name in [(-2, "Karfreitag"), (1, "Ostermontag"), (39, "Christi Himmelfahrt"),
                         (50, "Pfingstmontag"), (60, "Fronleichnam")]:
        dt = ostern + timedelta(days=delta)
        FEIERTAGE.add(dt)
        FEIERTAGE_ROWS.append((dt, name))

with open(f"{OUT}/feiertage.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["datum", "bezeichnung"])
    for dt, name in sorted(FEIERTAGE_ROWS):
        if VON <= dt <= BIS:
            w.writerow([dt.isoformat(), name])

# --------------------------------------------------------------- Veranstaltungen (real, Termine typisiert)
EVENTS = []
for jahr in (2024, 2025, 2026):
    EVENTS.append((date(jahr, 6, 27), date(jahr, 7, 7), "Kiliani-Volksfest", "typische Kalenderwoche"))
    EVENTS.append((date(jahr, 5, 30), date(jahr, 6, 1), "Africa Festival Würzburg", "typisches Wochenende"))
    EVENTS.append((date(jahr, 5, 23), date(jahr, 5, 26), "Würzburger Weindorf (Auftakt)", "typischer Zeitraum"))
    EVENTS.append((date(jahr, 6, 20), date(jahr, 6, 22), "Stramu Straßenmusikfestival", "typisches Wochenende"))
with open(f"{OUT}/veranstaltungen.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["von", "bis", "bezeichnung", "genauigkeit"])
    for von, bis, name, genau in EVENTS:
        if von <= BIS:
            w.writerow([von.isoformat(), bis.isoformat(), name, genau])
EVENT_TAGE = set()
for von, bis, name, genau in EVENTS:
    d = von
    while d <= bis:
        EVENT_TAGE.add(d)
        d += timedelta(days=1)

print("Stammdaten geschrieben. Erzeuge Fahrten ...")

# --------------------------------------------------------------- Semesterzeiten (fuer Uni-Stationen)
def in_semester(d):
    # Wintersemester ca. Mitte Okt - Mitte Feb, Sommersemester ca. Mitte Apr - Mitte Jul
    m, day = d.month, d.day
    if (m == 10 and day >= 14) or m in (11, 12) or (m == 1) or (m == 2 and day <= 14):
        return True
    if (m == 4 and day >= 14) or m in (5, 6) or (m == 7 and day <= 15):
        return True
    return False

# --------------------------------------------------------------- Stundenverteilung je Stationstyp
def stunden_gewicht(typ, stunde, wochenende, semester):
    if typ == "pendler":
        if wochenende:
            return 0.03
        if stunde in (7, 8):
            return 0.14
        if stunde in (17, 18):
            return 0.13
        if 9 <= stunde <= 16:
            return 0.03
        return 0.01
    if typ == "uni":
        if wochenende or not semester:
            return 0.015
        if 9 <= stunde <= 12 or 13 <= stunde <= 16:
            return 0.09
        return 0.02
    if typ == "freizeit":
        if wochenende:
            return 0.10 if 11 <= stunde <= 18 else 0.02
        return 0.05 if 11 <= stunde <= 18 else 0.015
    # misch
    if wochenende:
        return 0.06 if 10 <= stunde <= 19 else 0.02
    return 0.05 if 8 <= stunde <= 19 else 0.02


STATION_GEWICHT_BASIS = {"pendler": 1.15, "uni": 1.05, "freizeit": 0.95, "misch": 0.85}

ausleihe_rows = []
ausleihe_id = 0
kunde_pool = list(range(1, 3200))  # 3.200 Kundinnen/Kunden

d = VON
while d <= BIS:
    key = d.isoformat()
    w = wetter.get(key, {"temp": 12.0, "regen": 0.0})
    temp, regen = w["temp"], w["regen"]
    wochenende = d.isoweekday() in (6, 7)
    feiertag = d in FEIERTAGE
    frei = wochenende or feiertag
    semester = in_semester(d)
    event = d in EVENT_TAGE

    # Saison (Jahresgang), an echten Temperaturen gespiegelt statt nur an sin()
    saison = 0.35 + 0.9 / (1 + math.exp(-(temp - 8) / 6))
    # Wetter: Regen daempft stark, Wind leicht, Temperatur-Sweet-Spot um 20 Grad
    regen_faktor = max(0.25, 1 - regen * 0.10)
    temp_faktor = max(0.35, 1 - ((temp - 20) ** 2) / 550)
    tagesart = 0.75 if frei else 1.00
    event_faktor = 1.55 if event else 1.0

    basis = 92 * saison * regen_faktor * temp_faktor * tagesart * event_faktor
    anzahl = max(8, round(basis * random.uniform(0.85, 1.15)))

    for _ in range(anzahl):
        # Station nach Typgewicht plus zusaetzlichem Event-Bonus fuer Freizeit-Stationen
        gewichte = []
        for sid in STATION_IDS:
            typ = STATION_TYP[sid]
            g = STATION_GEWICHT_BASIS[typ]
            if event and typ == "freizeit":
                g *= 1.8
            gewichte.append(g)
        start_station = random.choices(STATION_IDS, weights=gewichte, k=1)[0]
        typ = STATION_TYP[start_station]

        # Stunde nach stationsspezifischer Verteilung ziehen (12 Kandidatstunden 6-21 Uhr)
        stunden_kandidaten = list(range(5, 23))
        gew_stunden = [stunden_gewicht(typ, h, frei, semester) + 0.005 for h in stunden_kandidaten]
        stunde = random.choices(stunden_kandidaten, weights=gew_stunden, k=1)[0]
        minute = random.randint(0, 59)
        startzeit = datetime(d.year, d.month, d.day, stunde, minute)

        # Rueckkehr zur selben Station: haeufiger bei Freizeit/Kaeppele (Rundtour)
        p_rueckkehr = 0.28 if typ == "freizeit" else 0.10
        if random.random() < p_rueckkehr:
            end_station = start_station
        else:
            end_gewichte = [1.3 if STATION_TYP[s] != typ else 0.7 for s in STATION_IDS]
            end_station = random.choices(STATION_IDS, weights=end_gewichte, k=1)[0]

        # Rad ziehen: nur Raeder, die zum Zeitpunkt schon angeschafft und nicht ausgemustert sind
        kandidaten = [r for r in raeder if r["angeschafft"] <= d and not r["ausgemustert"]]
        rad = random.choice(kandidaten)

        # Dauer: laenger am Wochenende/Freizeit, kuerzer Pendlerfahrten; rechtsschief
        basis_dauer = {"pendler": 11, "uni": 9, "freizeit": 22, "misch": 14}[typ]
        wdauer = random.random()
        dauer = max(4, round(basis_dauer * 0.5 + basis_dauer * 1.5 * wdauer * wdauer))
        if end_station == start_station:
            dauer = round(dauer * 1.4)  # Rundtouren dauern laenger

        endzeit = startzeit + timedelta(minutes=int(dauer))

        # Distanz: nur bei ca. 60% gemessen (wie im Original-Skript), Geschwindigkeit je Typ
        distanz = ""
        if random.random() < 0.60:
            geschw = {"CITY": 13.0, "EBIKE": 18.0, "CARGO": 11.0}[rad["typ"]]
            distanz = round((dauer / 60.0) * geschw * random.uniform(0.80, 1.20), 2)
            rad["km_kumuliert"] += float(distanz)
        else:
            rad["km_kumuliert"] += (dauer / 60.0) * 13.0 * 0.9  # intern trotzdem grob mitzaehlen

        rad["fahrten_seit_wartung"] += 1

        ausleihe_id += 1
        kunde_id = random.choice(kunde_pool)
        ausleihe_rows.append([
            ausleihe_id, kunde_id, rad["id"], start_station, startzeit.isoformat(sep=" "),
            end_station, endzeit.isoformat(sep=" "), "abgeschlossen", distanz,
        ])

    d += timedelta(days=1)

with open(f"{OUT}/ausleihe.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["ausleihe_id", "kunde_id", "fahrrad_id", "start_station_id", "startzeit",
                "end_station_id", "endzeit", "status", "distanz_km"])
    w.writerows(ausleihe_rows)

print(f"Fahrten erzeugt: {len(ausleihe_rows)}")

# --------------------------------------------------------------- Wartungssignal
# Schadensmeldungen und Wartungsauftraege, kumulierte Nutzung als echtes
# Verschleisssignal: mehr Kilometer/Fahrten -> spuerbar hoehere Meldehaeufigkeit.
KATEGORIEN = ["Bremse", "Reifen/Platten", "Schaltung", "Licht", "Rahmen/Lenker", "Sattel/Sitzhaltung"]
KATEGORIEN_EBIKE = KATEGORIEN + ["Akku", "Motor/Unterstuetzung"]

schaden_rows = []
auftrag_rows = []
schaden_id = 0
auftrag_id = 0

for rad in raeder:
    km = rad["km_kumuliert"]
    fahrten = rad["fahrten_seit_wartung"]
    aktiv_tage = max(1, (BIS - rad["angeschafft"]).days)

    # Erwartete Meldungen: negative Basis + Verschleissanteil aus km und Fahrten, bei
    # max(0, ...) gekappt. So bleibt ein guter Teil der Flotte ohne jede Meldung
    # (realistische Klassenverteilung fuer die Klassifikationsuebung), waehrend
    # ueberdurchschnittlich genutzte Raeder deutlich haeufiger melden.
    erwartung = max(0.0, -0.3 + km / 2800.0 + fahrten / 650.0)
    streuung = max(erwartung, 0.3) * 0.35
    n_meldungen = max(0, round(random.gauss(erwartung, streuung)))

    kategorien_pool = KATEGORIEN_EBIKE if rad["typ"] in ("EBIKE", "CARGO") else KATEGORIEN
    laufende_km = 0.0
    for _ in range(n_meldungen):
        # Meldezeitpunkt: spaeter im Nutzungszeitraum wahrscheinlicher (Verschleiss haeuft sich),
        # over Beta-Verteilung mit Rechtsschiefe simuliert
        anteil = random.betavariate(2.2, 1.3)
        gemeldet = rad["angeschafft"] + timedelta(days=int(anteil * aktiv_tage))
        if gemeldet > BIS:
            gemeldet = BIS
        laufende_km += km / max(1, n_meldungen)
        # Schwere waechst tendenziell mit dem bereits gefahrenen Anteil
        schwere_gewicht = [max(0.05, 0.6 - anteil), 0.3, max(0.05, anteil - 0.1)]
        schwere = random.choices(["leicht", "mittel", "fahruntauglich"], weights=schwere_gewicht, k=1)[0]
        kategorie = random.choice(kategorien_pool)

        schaden_id += 1
        gemeldet_dt = datetime(gemeldet.year, gemeldet.month, gemeldet.day,
                                random.randint(7, 19), random.randint(0, 59))
        schaden_rows.append([schaden_id, rad["id"], gemeldet_dt.isoformat(sep=" "),
                              kategorie, schwere, "erledigt" if gemeldet < BIS - timedelta(days=10) else "offen"])

        auftrag_id += 1
        eroeffnet = gemeldet_dt + timedelta(hours=random.randint(2, 60))
        dauer_tage = {"leicht": (0, 2), "mittel": (1, 4), "fahruntauglich": (0, 1)}[schwere]
        erledigt_offset = random.randint(dauer_tage[0], max(dauer_tage[0], dauer_tage[1]))
        erledigt = eroeffnet + timedelta(days=erledigt_offset, hours=random.randint(0, 8))
        ist_erledigt = erledigt < datetime(BIS.year, BIS.month, BIS.day)
        arbeitszeit = {"leicht": random.randint(10, 35), "mittel": random.randint(25, 90),
                       "fahruntauglich": random.randint(45, 180)}[schwere]
        auftrag_rows.append([
            auftrag_id, f"WA-{auftrag_id:05d}", rad["id"], schaden_id,
            eroeffnet.isoformat(sep=" "),
            erledigt.isoformat(sep=" ") if ist_erledigt else "",
            "erledigt" if ist_erledigt else "in_arbeit",
            arbeitszeit if ist_erledigt else "",
        ])

with open(f"{OUT}/schadensmeldung.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["schadensmeldung_id", "fahrrad_id", "gemeldet_am", "kategorie", "schwere", "status"])
    w.writerows(schaden_rows)

with open(f"{OUT}/wartungsauftrag.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["wartungsauftrag_id", "auftragsnummer", "fahrrad_id", "schadensmeldung_id",
                "eroeffnet_am", "erledigt_am", "status", "arbeitszeit_minuten"])
    w.writerows(auftrag_rows)

print(f"Schadensmeldungen: {len(schaden_rows)}, Wartungsauftraege: {len(auftrag_rows)}")

# --------------------------------------------------------------- Verifikation: Verschleisssignal wirklich da?
import statistics
per_rad_km = {r["id"]: r["km_kumuliert"] for r in raeder}
meldungen_je_rad = {}
for row in schaden_rows:
    meldungen_je_rad[row[1]] = meldungen_je_rad.get(row[1], 0) + 1

xs = [per_rad_km[r["id"]] for r in raeder]
ys = [meldungen_je_rad.get(r["id"], 0) for r in raeder]
n = len(xs)
mx, my = sum(xs) / n, sum(ys) / n
cov = sum((x - mx) * (y - my) for x, y in zip(xs, ys)) / n
sx = statistics.pstdev(xs)
sy = statistics.pstdev(ys)
korrelation = cov / (sx * sy) if sx > 0 and sy > 0 else float("nan")
print(f"Korrelation km_kumuliert <-> Anzahl Meldungen je Rad: {korrelation:.3f}")
