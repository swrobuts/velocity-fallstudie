"""
VeloCity-Analytics-Datensatz fuer den CRISP-DM-Block.

WICHTIG - HERKUNFT DER DATEN (ausfuehrlich in README.md):

ECHT (recherchiert, nicht erfunden):
  wetter.csv          Tageswerte Wuerzburg, Open-Meteo/ERA5-Archiv.
  feiertage.csv       Bayerische gesetzliche Feiertage, bewegliche ueber Ostern.
  schulferien.csv     Bayerische Schulferien - Zeitraeume real wiederkehrend,
                      Tagesgrenzen typisiert (Spalte 'genauigkeit').
  veranstaltungen.csv Wuerzburger Grossveranstaltungen, Termine typisiert.
  semesterzeiten.csv  Vorlesungszeiten JMU Wuerzburg, typisiert.
  tarif.csv           Tarife und Konditionen wie im echten VeloCity-Modell
  nutzungspreis.csv   (db/aufbau/0008_referenzdaten.sql) - Struktur und Werte
                      uebernommen, nicht neu erfunden.

ERFUNDEN (nie erhoben, aber am echten VeloCity-Datenmodell entlang gebaut):
  station.csv, fahrrad.csv, kunde.csv, ausleihe.csv, schadensmeldung.csv,
  wartungsauftrag.csv, stationsstoerung.csv

Die erfundenen Daten sind fuer die Lehre bewusst VERSTAERKT: die Muster, die
die sechs Verfahren finden sollen, sind absichtlich eingebaut und werden am
Ende dieses Skripts nachgemessen. Das gehoert in der Veranstaltung offen
gesagt - es ist ein Lehrdatensatz, keine Wirklichkeitsbeschreibung.

WAS NICHT EXPORTIERT WIRD, OBWOHL ES HIER ENTSTEHT:
  - der Stationstyp (pendler/uni/freizeit/misch)
  - das Kundenprofil (pendler/studium/freizeit/gelegenheit/abgewandert)
Beide steuern die Erzeugung, stehen aber in KEINER CSV. Genau deshalb kann
das Clustering sie wiederfinden - haette es sie als Spalte, waere die Uebung
sinnlos.

Fester Seed: jeder Lauf erzeugt dieselben Daten.
Aufruf:  python3 generieren.py         (schreibt neben dieses Skript)
         VELO_OUT=/tmp/x python3 ...   (schreibt woandershin)

wetter.csv muss im Zielordner bereits liegen - es sind echte Messdaten und
wird von diesem Skript nur gelesen, nie erzeugt.
"""
import csv
import math
import os
import random
import statistics
from datetime import date, datetime, timedelta

random.seed(20260901)

OUT = os.environ.get("VELO_OUT") or os.path.dirname(os.path.abspath(__file__))
VON = date(2023, 9, 1)
BIS = date(2026, 8, 24)


def schreibe(dateiname, kopf, zeilen):
    with open(os.path.join(OUT, dateiname), "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(kopf)
        w.writerows(zeilen)
    print(f"  {dateiname:24s} {len(zeilen):>6d} Zeilen")


print("Stammdaten ...")

# =====================================================================
# STATIONEN
# typ steuert die Erzeugung und wird NICHT exportiert (siehe Kopfkommentar).
# =====================================================================
STATIONEN = [
    # id, nummer, name, lat, lon, kapazitaet, typ
    (1,  "S-0001", "Hauptbahnhof",       49.8018, 9.9359, 40, "pendler"),
    (2,  "S-0002", "Residenz",           49.7936, 9.9436, 24, "freizeit"),
    (3,  "S-0003", "Alte Mainbruecke",   49.7913, 9.9280, 20, "freizeit"),
    (4,  "S-0004", "Sanderring",         49.7889, 9.9366, 30, "uni"),
    (5,  "S-0005", "Hubland",            49.7766, 9.9720, 34, "uni"),
    (6,  "S-0006", "Marktplatz",         49.7943, 9.9294, 26, "misch"),
    (7,  "S-0007", "Zellerau",           49.7891, 9.9089, 22, "pendler"),
    (8,  "S-0008", "Ringpark Nord",      49.8021, 9.9421, 18, "freizeit"),
    (9,  "S-0009", "Kaeppele",           49.7847, 9.9186, 12, "freizeit"),
    (10, "S-0010", "Grombuehl/Klinikum", 49.8064, 9.9536, 28, "pendler"),
]
schreibe("station.csv",
         ["station_id", "stationsnummer", "name", "latitude", "longitude", "kapazitaet"],
         [[s[0], s[1], s[2], s[3], s[4], s[5]] for s in STATIONEN])

STATION_TYP = {s[0]: s[6] for s in STATIONEN}
STATION_IDS = [s[0] for s in STATIONEN]
STATION_NAME = {s[0]: s[2] for s in STATIONEN}
STATION_ORT = {s[0]: (s[4], s[3]) for s in STATIONEN}   # (longitude, latitude)

# =====================================================================
# GESCHAEFTSGEBIET
# Echt: das Polygon aus db/aufbau/0008_referenzdaten.sql. Innerhalb dieser
# Flaeche darf ein Rad ueberall abgestellt werden - die Kundenwebsite wirbt
# ausdruecklich damit ("Frei im Geschaeftsgebiet, ohne Zuschlag").
# =====================================================================
GEBIET = [(9.9100, 49.8100), (9.9400, 49.8150), (9.9850, 49.7850),
          (9.9600, 49.7750), (9.9300, 49.7700), (9.9000, 49.7850)]
schreibe("geschaeftsgebiet.csv", ["ecke", "longitude", "latitude"],
         [[i + 1, lon, lat] for i, (lon, lat) in enumerate(GEBIET)])


def im_gebiet(lon, lat):
    """Strahlverfahren: liegt der Punkt innerhalb des Polygons?"""
    drin = False
    n = len(GEBIET)
    for i in range(n):
        x1, y1 = GEBIET[i]
        x2, y2 = GEBIET[(i + 1) % n]
        if (y1 > lat) != (y2 > lat):
            schnitt = x1 + (lat - y1) * (x2 - x1) / (y2 - y1)
            if lon < schnitt:
                drin = not drin
    return drin


# =====================================================================
# FAHRRADTYPEN
# Echt: Bezeichnungen und Merkmale aus db/aufbau/0008_referenzdaten.sql -
# dieselben, die auf der Kundenwebsite in den Tarifkarten stehen.
# =====================================================================
FAHRRADTYPEN = [
    ("CITY",  "City-Bike",      "Stadtrad, 8 Gänge, LED-Licht",  "nein", 20),
    ("EBIKE", "E-Bike Sport",   "Pedelec, Reichweite bis 50 km", "ja",   20),
    ("CARGO", "E-Cargo Loader", "Lastenrad, Zuladung bis 75 kg", "ja",   75),
]
schreibe("fahrradtyp.csv",
         ["typ_code", "bezeichnung", "beschreibung", "hat_elektro", "zuladung_kg"],
         [list(t) for t in FAHRRADTYPEN])

# =====================================================================
# FLOTTE
# Neu gegenueber der ersten Fassung: ein Teil der Raeder wird im Zeitverlauf
# ausgemustert. Vorher hatte jedes Rad den Status 'verfuegbar' - eine Spalte
# ohne jede Streuung, aus der kein Verfahren etwas lernen kann.
# =====================================================================
N_RAEDER = 240
raeder = []
fahrrad_rows = []
for i in range(1, N_RAEDER + 1):
    r = random.random()
    typ = "CITY" if r < 0.55 else ("EBIKE" if r < 0.90 else "CARGO")
    r2 = random.random()
    if r2 < 0.65:
        ang = VON - timedelta(days=random.randint(0, 200))
    elif r2 < 0.88:
        ang = VON + timedelta(days=random.randint(200, 500))
    else:
        ang = VON + timedelta(days=random.randint(500, 900))
    # Ausmusterung: nur alte Raeder, und nur ein kleiner Teil.
    ausgemustert_am = None
    if ang < VON and random.random() < 0.09:
        ausgemustert_am = VON + timedelta(days=random.randint(400, 1050))
        if ausgemustert_am > BIS:
            ausgemustert_am = None
    raeder.append({"id": i, "typ": typ, "angeschafft": ang, "ausgemustert_am": ausgemustert_am,
                   "km_kumuliert": 0.0, "fahrten": 0, "verlauf": []})
    fahrrad_rows.append([i, f"WUE-{i:04d}", typ, ang.isoformat(),
                         "ausgemustert" if ausgemustert_am else "verfuegbar",
                         ausgemustert_am.isoformat() if ausgemustert_am else ""])
schreibe("fahrrad.csv",
         ["fahrrad_id", "rahmennummer", "typ_code", "angeschafft_am", "status", "ausgemustert_am"],
         fahrrad_rows)

# =====================================================================
# WETTER (echt, wird nur gelesen)
# =====================================================================
wetter = {}
with open(os.path.join(OUT, "wetter.csv"), encoding="utf-8") as f:
    for row in csv.DictReader(f):
        wetter[row["datum"]] = {"temp": float(row["temp_mittel_c"]),
                                "regen": float(row["niederschlag_mm"]),
                                "wind": float(row["wind_max_kmh"])}

# =====================================================================
# FEIERTAGE (echt, Bayern)
# =====================================================================
FEIERTAGE = set()
feiertag_rows = []
_FEST = [(1, 1, "Neujahr"), (1, 6, "Heilige Drei Koenige"), (5, 1, "Tag der Arbeit"),
         (8, 15, "Mariae Himmelfahrt"), (10, 3, "Tag der Deutschen Einheit"),
         (11, 1, "Allerheiligen"), (12, 25, "1. Weihnachtsfeiertag"),
         (12, 26, "2. Weihnachtsfeiertag")]
_OSTERN = {2023: date(2023, 4, 9), 2024: date(2024, 3, 31),
           2025: date(2025, 4, 20), 2026: date(2026, 4, 5)}
for jahr in (2023, 2024, 2025, 2026):
    for m, t, name in _FEST:
        dt = date(jahr, m, t)
        FEIERTAGE.add(dt)
        feiertag_rows.append((dt, name))
    for delta, name in [(-2, "Karfreitag"), (1, "Ostermontag"), (39, "Christi Himmelfahrt"),
                        (50, "Pfingstmontag"), (60, "Fronleichnam")]:
        dt = _OSTERN[jahr] + timedelta(days=delta)
        FEIERTAGE.add(dt)
        feiertag_rows.append((dt, name))
schreibe("feiertage.csv", ["datum", "bezeichnung"],
         [[d.isoformat(), n] for d, n in sorted(feiertag_rows) if VON <= d <= BIS])

# =====================================================================
# SCHULFERIEN BAYERN
# Real wiederkehrende Ferienabschnitte. Die Tagesgrenzen schwanken jaehrlich;
# hier stehen die typischen Zeitraeume - dieselbe Ehrlichkeit wie bei den
# Veranstaltungen, ausgewiesen in der Spalte 'genauigkeit'.
# =====================================================================
FERIEN = [
    (date(2023, 10, 30), date(2023, 11,  3), "Herbstferien"),
    (date(2023, 12, 27), date(2024,  1,  5), "Weihnachtsferien"),
    (date(2024,  2, 12), date(2024,  2, 16), "Fruehjahrsferien"),
    (date(2024,  3, 25), date(2024,  4,  6), "Osterferien"),
    (date(2024,  5, 21), date(2024,  5, 31), "Pfingstferien"),
    (date(2024,  7, 29), date(2024,  9,  9), "Sommerferien"),
    (date(2024, 10, 28), date(2024, 10, 31), "Herbstferien"),
    (date(2024, 12, 23), date(2025,  1,  3), "Weihnachtsferien"),
    (date(2025,  3,  3), date(2025,  3,  7), "Fruehjahrsferien"),
    (date(2025,  4, 14), date(2025,  4, 25), "Osterferien"),
    (date(2025,  6, 10), date(2025,  6, 20), "Pfingstferien"),
    (date(2025,  8,  1), date(2025,  9, 15), "Sommerferien"),
    (date(2025, 11,  3), date(2025, 11,  7), "Herbstferien"),
    (date(2025, 12, 22), date(2026,  1,  5), "Weihnachtsferien"),
    (date(2026,  2, 16), date(2026,  2, 20), "Fruehjahrsferien"),
    (date(2026,  3, 30), date(2026,  4, 10), "Osterferien"),
    (date(2026,  5, 26), date(2026,  6,  5), "Pfingstferien"),
    (date(2026,  8,  3), date(2026,  9, 14), "Sommerferien"),
]
FERIENTAGE = set()
for von, bis, name in FERIEN:
    d = von
    while d <= bis:
        FERIENTAGE.add(d)
        d += timedelta(days=1)
schreibe("schulferien.csv", ["von", "bis", "bezeichnung", "genauigkeit"],
         [[v.isoformat(), b.isoformat(), n, "typischer Zeitraum"]
          for v, b, n in FERIEN if v <= BIS])

# =====================================================================
# SEMESTERZEITEN (JMU Wuerzburg, typisiert)
# Bisher steckte diese Information nur in einer Funktion im Generator. Als
# eigene Datei koennen die Studierenden sie als Merkmal joinen - genau die
# Arbeit, um die es in der Data-Preparation-Phase geht.
# =====================================================================
SEMESTER = []
for jahr in (2023, 2024, 2025, 2026):
    SEMESTER.append((date(jahr, 4, 14), date(jahr, 7, 15), f"Sommersemester {jahr}", "Vorlesungszeit"))
    SEMESTER.append((date(jahr, 10, 14), date(jahr + 1, 2, 14),
                     f"Wintersemester {jahr}/{str(jahr + 1)[2:]}", "Vorlesungszeit"))
VORLESUNGSTAGE = set()
for von, bis, name, art in SEMESTER:
    d = von
    while d <= bis:
        VORLESUNGSTAGE.add(d)
        d += timedelta(days=1)
schreibe("semesterzeiten.csv", ["von", "bis", "bezeichnung", "art", "genauigkeit"],
         [[v.isoformat(), b.isoformat(), n, a, "typischer Zeitraum"]
          for v, b, n, a in SEMESTER if v <= BIS])

# =====================================================================
# VERANSTALTUNGEN (real wiederkehrend, Termine typisiert)
# Von vier auf neun Reihen erweitert: mit zwoelf Eintraegen in drei Jahren
# war der Eventeffekt in der Zeitreihe kaum vom Rauschen zu trennen.
# =====================================================================
EVENT_REIHEN = [
    ((6, 27), (7,  7), "Kiliani-Volksfest",             "typische Kalenderwoche", 1.9),
    ((5, 30), (6,  1), "Africa Festival",               "typisches Wochenende",   1.6),
    ((5, 23), (5, 26), "Weindorf am Marktplatz",        "typischer Zeitraum",     1.5),
    ((6, 20), (6, 22), "Stramu Strassenmusikfestival",  "typisches Wochenende",   1.7),
    ((7, 11), (7, 13), "Hafensommer",                   "typisches Wochenende",   1.4),
    ((9,  5), (9,  7), "Wuerzburger Weinparade",        "typisches Wochenende",   1.5),
    ((11, 29), (12, 22), "Weihnachtsmarkt",             "typischer Zeitraum",     1.3),
    ((4, 25), (4, 27), "Fruehlingsfest",                "typisches Wochenende",   1.4),
    ((10, 3), (10, 5), "Wuerzburger Herbstfest",        "typisches Wochenende",   1.3),
]
EVENTS = []
for jahr in (2023, 2024, 2025, 2026):
    for (vm, vt), (bm, bt), name, genau, staerke in EVENT_REIHEN:
        von = date(jahr, vm, vt)
        bis = date(jahr if bm >= vm else jahr + 1, bm, bt)
        if von > BIS or bis < VON:
            continue
        EVENTS.append((von, bis, name, genau, staerke))
EVENT_STAERKE = {}
for von, bis, name, genau, staerke in EVENTS:
    d = von
    while d <= bis:
        EVENT_STAERKE[d] = max(EVENT_STAERKE.get(d, 1.0), staerke)
        d += timedelta(days=1)
schreibe("veranstaltungen.csv", ["von", "bis", "bezeichnung", "genauigkeit"],
         [[v.isoformat(), b.isoformat(), n, g] for v, b, n, g, _ in sorted(EVENTS)])

# =====================================================================
# TARIFE UND NUTZUNGSPREISE
#
# KEINE GRUNDGEBUEHR (korrigiert am 31.08.2026).
# Das Preismodell aus db/aufbau/0008_referenzdaten.sql sieht fuer den Tarif
# PREMIUM einen Monatspreis von 9,90 EUR vor, mit der Voraussetzung
# "Kostenpflichtiges Abo". Das widerspricht dem, was die Kundenwebsite
# verspricht: Ihre Kennzahl lautet "0 Euro Anmeldegebuehr", und die FAQ nennt
# als Preismodell ausschliesslich "Startgebuehr plus Minutenpreis, gedeckelt
# auf einen Tageshoechstpreis" - von einem monatlichen Beitrag steht dort
# nichts.
#
# Ein Lehrdatensatz darf dem Produktversprechen nicht widersprechen, sonst
# wird die Fallstudie in sich unstimmig. Deshalb gibt es hier KEINEN
# Monatspreis und keine Spalte dafuer. Die vier Tarife unterscheiden sich
# allein durch Freiminuten und Rabatt; sie sind Vorteilstarife, die man
# ueber einen Nachweis bekommt, nicht durch Zahlung.
#
# NACHGEZOGEN AM 31.08.2026: Der Widerspruch stand urspruenglich in den
# Referenzdaten selbst. Er ist dort inzwischen behoben - Premium hat kein
# Monatsentgelt mehr, die Voraussetzung lautet "Rahmenvertrag ueber den
# Arbeitgeber" statt "Kostenpflichtiges Abo". Und die Spalte monatspreis ist
# ganz entfallen: Sie stand ueberall auf null, aber ihre blosse Existenz
# hatte gereicht, damit die 9,90 Euro hineingerieten. Ein pgTAP-Test prueft
# jetzt, dass es die Spalte nicht gibt - eine Zahl laesst sich wieder
# setzen, eine fehlende Spalte nicht. Datenbank und Lehrdatensatz sagen
# damit dasselbe, und der Lehrdatensatz hatte von Anfang an recht.
# =====================================================================
# Bezeichnungen und Voraussetzungen WOERTLICH aus der Datenbank
# (db/aufbau/0008_referenzdaten.sql). Ich hatte hier zwischenzeitlich eigene
# Namen erfunden ("Nahverkehrstarif", "Vielfahrertarif") - das war eine neue
# Abweichung, wo gerade eine beseitigt werden sollte. "OEPNV-Abo" meint das
# Nahverkehrsabo des KUNDEN als Nachweis, nicht ein Abo bei VeloCity; die
# Spalte voraussetzung macht das jetzt sichtbar.
TARIFE = [
    ("BASIS",   "Basistarif",     "",                                   0,  0.0),
    ("STUDENT", "Studententarif", "Gültiger Studierendenausweis",     300,  0.0),
    ("OEPNV",   "OEPNV-Abo",      "VGN-Abo oder Deutschlandticket",   600,  0.0),
    ("PREMIUM", "Premium",        "Rahmenvertrag über den Arbeitgeber", 1000, 20.0),
]
schreibe("tarif.csv",
         ["tarif_code", "bezeichnung", "voraussetzung",
          "freiminuten_pro_monat", "rabatt_prozent"],
         [list(t) for t in TARIFE])
TARIF_INFO = {t[0]: {"frei": t[3], "rabatt": t[4]} for t in TARIFE}

PREISE = [("CITY", 0.10, 0.10, 50.00), ("EBIKE", 1.00, 0.25, 75.00), ("CARGO", 2.00, 0.50, 110.00)]
schreibe("nutzungspreis.csv",
         ["typ_code", "startgebuehr_eur", "preis_pro_minute_eur", "tageshoechstpreis_eur"],
         [list(p) for p in PREISE])
PREIS_INFO = {p[0]: {"start": p[1], "minute": p[2], "deckel": p[3]} for p in PREISE}

print("Kundschaft ...")

# =====================================================================
# KUNDSCHAFT
# DIE ZENTRALE AENDERUNG GEGENUEBER DER ERSTEN FASSUNG.
#
# Vorher: kunde_id = random.choice(1..3199) - gleichverteilt. Jeder Kunde
# bekam dadurch rund achtzehn Fahrten, und zwar quer durch alle Tageszeiten
# und Stationen. Eine RFM-Segmentierung darauf findet nichts, weil es nichts
# zu finden gibt: alle Kunden sind gleich.
#
# Jetzt bekommt jeder Kunde ein PROFIL, das steuert, wie oft, wann und wo er
# faehrt und wie lange er ueberhaupt dabei bleibt. Das Profil steht in KEINER
# CSV - die Segmentierung muss es aus Recency, Frequency und Monetary
# zurueckgewinnen.
# =====================================================================
PROFILE = [
    # code, anteil, intensitaet (Fahrten je Monat, grob), tarifgewichte, bleibt_dabei
    ("pendler",     0.15, 11.0, {"OEPNV": 0.45, "PREMIUM": 0.30, "BASIS": 0.20, "STUDENT": 0.05}, 0.93),
    ("studium",     0.21,  6.5, {"STUDENT": 0.80, "BASIS": 0.15, "OEPNV": 0.05}, 0.80),
    ("freizeit",    0.27,  2.2, {"BASIS": 0.70, "PREMIUM": 0.15, "OEPNV": 0.15}, 0.72),
    ("gelegenheit", 0.29,  0.5, {"BASIS": 0.92, "STUDENT": 0.05, "OEPNV": 0.03}, 0.35),
    ("vielfahrer",  0.08, 20.0, {"PREMIUM": 0.60, "OEPNV": 0.30, "BASIS": 0.10}, 0.96),
]
STADTTEILE = ["Altstadt", "Sanderau", "Grombuehl", "Zellerau", "Frauenland",
              "Heidingsfeld", "Lengfeld", "Versbach", "Umland"]
N_KUNDEN = 3200

kunden = {}
kunde_rows = []
for kid in range(1, N_KUNDEN + 1):
    profil = random.choices([p[0] for p in PROFILE], weights=[p[1] for p in PROFILE], k=1)[0]
    p = next(x for x in PROFILE if x[0] == profil)

    # Anmeldung: die Haelfte war zu Beginn dabei, der Rest kommt laufend dazu.
    if random.random() < 0.45:
        registriert = VON - timedelta(days=random.randint(0, 400))
    else:
        registriert = VON + timedelta(days=random.randint(0, (BIS - VON).days - 30))

    # Bleibt der Kunde bis zum Schluss dabei? Wenn nicht, endet seine Aktivitaet
    # irgendwann - daraus entsteht spaeter das Abwanderungslabel, abgeleitet aus
    # den Fahrten, nicht aus dieser Spalte (die wird nicht exportiert).
    if random.random() < p[4]:
        aktiv_bis = BIS
    else:
        start = max(registriert, VON)
        spanne = (BIS - start).days
        aktiv_bis = start + timedelta(days=int(spanne * random.uniform(0.15, 0.80))) if spanne > 60 else BIS

    tarifgewichte = p[3]
    tarif = random.choices(list(tarifgewichte), weights=list(tarifgewichte.values()), k=1)[0]

    # Altersstruktur je Profil: Studium jung, Pendler mittel, Freizeit breiter.
    if profil == "studium":
        geburtsjahr = random.randint(1998, 2007)
    elif profil in ("pendler", "vielfahrer"):
        geburtsjahr = random.randint(1975, 1999)
    else:
        geburtsjahr = random.randint(1955, 2005)

    intensitaet = p[2] * random.uniform(0.55, 1.6)
    kunden[kid] = {"profil": profil, "registriert": registriert, "aktiv_bis": aktiv_bis,
                   "tarif": tarif, "intensitaet": intensitaet,
                   "freiminuten_rest": {}, "fahrten": 0, "umsatz": 0.0}
    kunde_rows.append([kid, f"K-{kid:06d}", registriert.isoformat(), geburtsjahr,
                       random.choice(STADTTEILE), tarif,
                       "aktiv" if random.random() > 0.02 else "gesperrt"])

schreibe("kunde.csv",
         ["kunde_id", "kundennummer", "registriert_am", "geburtsjahr", "stadtteil",
          "tarif_code", "status"],
         kunde_rows)

# =====================================================================
# STATIONSSTOERUNGEN
# Bisher lief das Netz drei Jahre lang stoerungsfrei. Ausfaelle geben der
# Data-Preparation-Phase etwas zu tun (Luecken erkennen und einordnen) und
# der Anomalieerkennung etwas zu finden.
# =====================================================================
STOERGRUENDE = ["Bauarbeiten", "Vandalismus", "Stromausfall Ladepunkt",
                "Softwarefehler Terminal", "Hochwasser Mainufer"]
stoerungen = []
for _ in range(26):
    sid = random.choice(STATION_IDS)
    beginn = VON + timedelta(days=random.randint(20, (BIS - VON).days - 10))
    dauer = random.choices([1, 2, 3, 5, 9, 16], weights=[30, 25, 20, 12, 8, 5], k=1)[0]
    stoerungen.append({"station_id": sid, "von": beginn, "bis": beginn + timedelta(days=dauer - 1),
                       "grund": random.choice(STOERGRUENDE)})
STOERTAGE = {}
for s in stoerungen:
    d = s["von"]
    while d <= s["bis"]:
        STOERTAGE.setdefault(d, set()).add(s["station_id"])
        d += timedelta(days=1)
schreibe("stationsstoerung.csv", ["station_id", "von", "bis", "grund"],
         [[s["station_id"], s["von"].isoformat(), s["bis"].isoformat(), s["grund"]]
          for s in sorted(stoerungen, key=lambda x: (x["von"], x["station_id"]))])

# =====================================================================
# HILFSFUNKTIONEN FUER DIE FAHRTENERZEUGUNG
# =====================================================================
def stunden_gewicht(typ, stunde, frei, vorlesung):
    """Tagesgang je Stationstyp - das Signal, das das Clustering finden soll."""
    if typ == "pendler":
        if frei:
            return 0.03
        if stunde in (7, 8):
            return 0.14
        if stunde in (17, 18):
            return 0.13
        if 9 <= stunde <= 16:
            return 0.03
        return 0.01
    if typ == "uni":
        if frei or not vorlesung:
            return 0.015
        # Doppelspitze zu den Vorlesungsblöcken, mit Delle in der Mittagspause.
        # Vorher lag hier ein flacher Wert ueber 9 bis 16 Uhr - damit war die
        # Spitzenstunde reiner Zufall (gemessen: 16 Uhr statt Vormittag), und
        # das Clustering haette die Uni-Stationen nur an ihrer Breite erkannt,
        # nicht an einer Form.
        if stunde in (10, 14):
            return 0.13
        if stunde in (9, 11, 13, 15):
            return 0.08
        if stunde == 12:
            return 0.055
        if stunde == 16:
            return 0.05
        return 0.02
    if typ == "freizeit":
        if frei:
            return 0.10 if 11 <= stunde <= 18 else 0.02
        return 0.05 if 11 <= stunde <= 18 else 0.015
    if frei:
        return 0.06 if 10 <= stunde <= 19 else 0.02
    return 0.05 if 8 <= stunde <= 19 else 0.02


def station_gewicht(typ, frei, vorlesung, event):
    """Wie stark zieht eine Station an diesem Tag Fahrten an?

    Bis zum 31.08.2026 stand hier EIN Satz Gewichte fuer alle Tage. Folge:
    jede Station hatte denselben Wochenendanteil (gemessen 28 bis 31 Prozent
    quer durch alle zehn) - ein Merkmal, das nichts unterschied, obwohl es das
    unterscheidendste sein sollte. Eine Freizeitstation lebt am Wochenende,
    eine Pendlerstation ist dann leer. Jetzt haengen die Gewichte am Tagestyp.
    """
    if frei:
        g = {"pendler": 0.55, "uni": 0.40, "freizeit": 1.85, "misch": 1.00}[typ]
    else:
        g = {"pendler": 1.30, "uni": 1.20, "freizeit": 0.70, "misch": 0.85}[typ]
    if typ == "uni" and not vorlesung:
        g *= 0.45
    if event and typ == "freizeit":
        g *= 1.8
    return g
# ---------------------------------------------------------------- Wege im Netz
# Wohin faehrt jemand, der hier und jetzt startet? Gewichte je Kombination
# aus Start- und Zieltyp, Tageszeit und Tagesart. Die Zahlen sind gesetzt,
# nicht gemessen - sie bilden nach, was jede Stadt kennt: morgens vom Bahnhof
# in die Arbeits- und Studienviertel, abends zurueck, am Wochenende an den
# Fluss und auf die Huegel.
def zielgewicht(start_typ, ziel_typ, fenster, frei):
    if frei:
        tabelle = {
            ("freizeit", "freizeit"): 3.0, ("freizeit", "misch"): 1.6,
            ("misch", "freizeit"): 2.6, ("pendler", "freizeit"): 2.4,
            ("uni", "freizeit"): 2.2,
        }
        return tabelle.get((start_typ, ziel_typ), 0.7)
    if fenster == "frueh":
        tabelle = {
            ("pendler", "uni"): 3.2, ("pendler", "misch"): 2.0, ("pendler", "pendler"): 1.4,
            ("uni", "uni"): 1.6, ("uni", "misch"): 1.0,
            ("misch", "uni"): 1.8, ("misch", "pendler"): 1.2,
            ("freizeit", "pendler"): 1.6, ("freizeit", "misch"): 1.2,
        }
        return tabelle.get((start_typ, ziel_typ), 0.5)
    if fenster == "abend":
        tabelle = {
            ("uni", "pendler"): 3.2, ("uni", "misch"): 1.8, ("uni", "freizeit"): 1.4,
            ("pendler", "pendler"): 2.0, ("pendler", "freizeit"): 1.5,
            ("misch", "pendler"): 2.2, ("misch", "freizeit"): 1.6,
            ("freizeit", "freizeit"): 1.8, ("freizeit", "pendler"): 1.4,
        }
        return tabelle.get((start_typ, ziel_typ), 0.6)
    # mittags und spaetabends bleibt es durchmischt
    return {"freizeit": 1.4, "misch": 1.2}.get(ziel_typ, 1.0)


# Benannte Verbindungen, die es in Wuerzburg so oder aehnlich gibt.
# Schluessel: (start_id, ziel_id, Zeitfenster, ist_freier_Tag) -> Verstaerkung
STARKE_WEGE = {
    (1, 5, "frueh", False): 2.6,    # Hauptbahnhof -> Hubland (Campus)
    (1, 4, "frueh", False): 2.0,    # Hauptbahnhof -> Sanderring
    (1, 10, "frueh", False): 2.2,   # Hauptbahnhof -> Klinikum
    (5, 1, "abend", False): 2.8,    # Hubland -> Hauptbahnhof
    (4, 1, "abend", False): 2.1,    # Sanderring -> Hauptbahnhof
    (10, 1, "abend", False): 2.0,   # Klinikum -> Hauptbahnhof
    (7, 6, "frueh", False): 1.8,    # Zellerau -> Marktplatz
    (2, 3, "frueh", True): 2.4,     # Residenz -> Alte Mainbruecke (Wochenende)
    (3, 9, "mittag", True): 2.6,    # Alte Mainbruecke -> Kaeppele
    (9, 3, "abend", True): 2.2,     # Kaeppele -> Alte Mainbruecke
    (2, 8, "mittag", True): 1.9,    # Residenz -> Ringpark
}

PROFIL_CODES = [p[0] for p in PROFILE]

_pool_cache = {}


def monatspool(d):
    """Je Monat und Profil: welche Kundschaft ist aktiv, mit welchem Gewicht.

    Einmal je Monat gerechnet statt einmal je Fahrt - sonst laeuft der
    Generator ueber Minuten statt Sekunden (57.000 Fahrten mal 3.200 Kunden).
    """
    key = (d.year, d.month)
    if key in _pool_cache:
        return _pool_cache[key]
    monatsbeginn = date(d.year, d.month, 1)
    monatsende = date(d.year + (d.month == 12), (d.month % 12) + 1, 1) - timedelta(days=1)
    pools = {}
    for code in PROFIL_CODES:
        ids, gew = [], []
        for kid, k in kunden.items():
            if k["profil"] != code:
                continue
            if k["registriert"] > monatsende or k["aktiv_bis"] < monatsbeginn:
                continue
            ids.append(kid)
            gew.append(k["intensitaet"])
        pools[code] = (ids, gew, sum(gew))
    _pool_cache[key] = pools
    return pools


def profil_gewichte(stationstyp, frei, stunde, vorlesung):
    """Wie wahrscheinlich ist welches Kundenprofil in dieser Situation?

    Das ist der Kern der Segmentierung: wer werktags um acht am Hauptbahnhof
    startet, ist mit hoher Wahrscheinlichkeit Pendler; wer sonntags am
    Kaeppele startet, eher Freizeitnutzer. Genau diese Kopplung macht spaeter
    aus Recency, Frequency und Monetary unterscheidbare Segmente.
    """
    g = dict.fromkeys(PROFIL_CODES, 1.0)
    if not frei and stunde in (7, 8, 17, 18):
        g["pendler"] *= 4.5
        g["vielfahrer"] *= 2.5
        g["gelegenheit"] *= 0.35
        g["freizeit"] *= 0.5
    if stationstyp == "pendler":
        g["pendler"] *= 3.0
        g["vielfahrer"] *= 1.8
        g["gelegenheit"] *= 0.6
    elif stationstyp == "uni":
        g["studium"] *= 4.5 if vorlesung else 0.8
        g["pendler"] *= 0.6
    elif stationstyp == "freizeit":
        g["freizeit"] *= 3.2
        g["gelegenheit"] *= 2.2
        g["pendler"] *= 0.25
    if frei:
        g["freizeit"] *= 2.0
        g["gelegenheit"] *= 1.8
        g["pendler"] *= 0.2
        g["studium"] *= 0.6
    return g


def entgelt_berechnen(kunde, typ_code, dauer_min, d):
    """Startgebuehr plus Minutenpreis, gedeckelt, danach Freiminuten und Rabatt.

    Bewusst originalgetreu nach dem echten Preismodell: die Startgebuehr faellt
    AUCH an, wenn Freiminuten die gesamte Fahrzeit decken. Das ist eine der
    Stellen, an denen Studierende in der Data-Understanding-Phase stutzen
    sollen - ein Entgelt groesser null bei null berechneten Minuten ist kein
    Fehler, sondern die Regel.
    """
    p = PREIS_INFO[typ_code]
    monat = (d.year, d.month)
    rest = kunde["freiminuten_rest"].get(monat)
    if rest is None:
        rest = TARIF_INFO[kunde["tarif"]]["frei"]
    genutzt = min(rest, dauer_min)
    kunde["freiminuten_rest"][monat] = rest - genutzt
    berechnete_minuten = dauer_min - genutzt
    # Der Deckel gilt JE TAG ("gedeckelt auf einen Tageshoechstpreis", so steht
    # es in der Preisauskunft der Website). Eine Ausleihe ueber 30 Stunden ist
    # damit nicht so teuer wie eine ueber 20, aber auch nicht gleich teuer -
    # sie beruehrt zwei Tage.
    tage = max(1, math.ceil(dauer_min / (24 * 60)))
    betrag = min(p["start"] + berechnete_minuten * p["minute"], p["deckel"] * tage)
    betrag *= (1 - TARIF_INFO[kunde["tarif"]]["rabatt"] / 100.0)
    return round(betrag, 2), berechnete_minuten


print("Fahrten ...")

# =====================================================================
# FAHRTEN
# =====================================================================
ausleihe_rows = []
ausleihe_id = 0
langzeit_gesetzt = 0

d = VON
while d <= BIS:
    key = d.isoformat()
    w = wetter.get(key, {"temp": 12.0, "regen": 0.0, "wind": 10.0})
    temp, regen = w["temp"], w["regen"]
    frei = d.isoweekday() in (6, 7) or d in FEIERTAGE
    vorlesung = d in VORLESUNGSTAGE
    ferien = d in FERIENTAGE
    event_staerke = EVENT_STAERKE.get(d, 1.0)
    gestoert = STOERTAGE.get(d, set())

    saison = 0.35 + 0.9 / (1 + math.exp(-(temp - 8) / 6))
    regen_faktor = max(0.25, 1 - regen * 0.10)
    temp_faktor = max(0.35, 1 - ((temp - 20) ** 2) / 550)
    tagesart = 0.75 if frei else 1.00
    # Schulferien daempfen die Werktagsnachfrage spuerbar - ein Effekt, den
    # die Zeitreihe ohne die neue schulferien.csv nicht erklaeren koennte.
    ferien_faktor = 0.80 if (ferien and not frei) else 1.0

    basis = 96 * saison * regen_faktor * temp_faktor * tagesart * event_staerke * ferien_faktor
    anzahl = max(8, round(basis * random.uniform(0.85, 1.15)))

    pools = monatspool(d)
    verfuegbare_raeder = [r for r in raeder
                          if r["angeschafft"] <= d
                          and (r["ausgemustert_am"] is None or r["ausgemustert_am"] > d)]
    if not verfuegbare_raeder:
        d += timedelta(days=1)
        continue

    offene_stationen = [s for s in STATION_IDS if s not in gestoert] or STATION_IDS

    for _ in range(anzahl):
        gewichte = [station_gewicht(STATION_TYP[sid], frei, vorlesung, event_staerke > 1.0)
                    for sid in offene_stationen]
        start_station = random.choices(offene_stationen, weights=gewichte, k=1)[0]
        typ = STATION_TYP[start_station]

        stunden = list(range(5, 23))
        stunde = random.choices(
            stunden, weights=[stunden_gewicht(typ, h, frei, vorlesung) + 0.005 for h in stunden], k=1)[0]
        startzeit = datetime(d.year, d.month, d.day, stunde, random.randint(0, 59))

        # ---- Kundschaft nach Profil ziehen
        kontext = profil_gewichte(typ, frei, stunde, vorlesung)
        codes, scores = [], []
        for code in PROFIL_CODES:
            ids, gew, summe = pools[code]
            if not ids:
                continue
            codes.append(code)
            scores.append(kontext[code] * summe)
        if not codes:
            d += timedelta(days=1)
            break
        profil = random.choices(codes, weights=scores, k=1)[0]
        ids, gew, _ = pools[profil]
        kunde_id = random.choices(ids, weights=gew, k=1)[0]
        kunde = kunden[kunde_id]

        # ---- Ziel
        # ERWEITERT AM 31.08.2026. Vorher hing die Zielwahl nur davon ab, ob
        # der Zieltyp vom Starttyp abwich. Folge: ausser den Rundtouren war
        # jedes Ziel gleich wahrscheinlich - gemessen rund 10 Prozent je Ziel
        # bei einer Basisrate von 10 Prozent, also Lift 1,0 auf ganzer Linie.
        # Fuer eine Assoziationsanalyse gab es damit nichts zu finden.
        #
        # Jetzt haengt die Zielwahl von Startstationstyp UND Tageszeit ab, wie
        # es echte Pendlerstroeme tun: morgens vom Bahnhof zur Uni und in die
        # Klinik, abends zurueck, am Wochenende die Ausflugsrunde.
        fenster = ("frueh" if stunde < 10 else
                   "mittag" if stunde < 15 else
                   "abend" if stunde < 20 else "spaet")
        p_rueckkehr = 0.28 if typ == "freizeit" else 0.10
        if random.random() < p_rueckkehr:
            end_station = start_station
        else:
            end_gew = []
            for sid in offene_stationen:
                ziel_typ = STATION_TYP[sid]
                g = zielgewicht(typ, ziel_typ, fenster, frei)
                # Einzelne benannte Verbindungen zusaetzlich verstaerken. Sie
                # geben der Assoziationsanalyse Regeln, die man zitieren kann.
                g *= STARKE_WEGE.get((start_station, sid, fenster, frei), 1.0)
                if sid == start_station:
                    g *= 0.25
                end_gew.append(g)
            end_station = random.choices(offene_stationen, weights=end_gew, k=1)[0]

        rad = random.choice(verfuegbare_raeder)

        # ---- Dauer
        # ERWEITERT AM 31.08.2026. Vorher hing die Dauer NUR vom Stationstyp
        # und vom Zufall ab. Fuer die Regressionsuebung war das zu wenig:
        # gemessen erreichten lineare Regression, Entscheidungsbaum und Random
        # Forest allesamt R² = 0,35 und einen MAE von 6,95 bis 6,98 Minuten -
        # ununterscheidbar. Ein Notebook, das drei Verfahren vergleicht, braucht
        # aber etwas zu vergleichen, und ein Random Forest rechtfertigt sich nur
        # ueber Wechselwirkungen, die es zu finden gibt.
        #
        # Jetzt wirken sechs Groessen auf die Dauer, alle fachlich begruendbar:
        basis_dauer = {"pendler": 11, "uni": 9, "freizeit": 22, "misch": 14}[typ]
        # Regen kuerzt (man beeilt sich), Waerme verlaengert (man bummelt).
        f_wetter = (1 - 0.022 * min(regen, 9)) * (1 + 0.013 * (temp - 12))
        # Pendlerstunden sind zweckgerichtet, der Nachmittag ist es nicht.
        f_stunde = 0.78 if stunde in (7, 8, 17, 18) else (1.22 if 13 <= stunde <= 18 else 1.0)
        f_frei = 1.28 if frei else 1.0
        # E-Bikes sind schneller, Lastenraeder langsamer - bei gleichem Weg.
        f_typ = {"CITY": 1.0, "EBIKE": 0.84, "CARGO": 1.20}[rad["typ"]]
        # Wer wie faehrt: das Profil steht in keiner CSV, wirkt aber. Ueber den
        # Tarif ist es teilweise erschliessbar - eine realistische Lage, in der
        # das Modell nur einen Teil der Wahrheit sehen kann.
        f_profil = {"pendler": 0.74, "studium": 0.86, "freizeit": 1.34,
                    "gelegenheit": 1.24, "vielfahrer": 0.80}[kunde["profil"]]
        mittel = basis_dauer * f_wetter * f_stunde * f_frei * f_typ * f_profil
        if end_station == start_station:
            mittel *= 1.4
        # Lognormal statt quadratischem Zufall: haelt die Rechtsschiefe, laesst
        # aber einen lernbaren Erwartungswert stehen. Die Streuung ist auf 0,21
        # gesetzt, damit das guenstigste Rad (CITY, 0,10 EUR/Min) die
        # 50-Cent-Schwelle aus der Business-Understanding-Phase erreichen KANN,
        # die teureren aber nicht. Das ist eine bewusste Entscheidung fuer den
        # Lehrdatensatz: sie erzeugt ein DIFFERENZIERTES Ergebnis - Teilfreigabe
        # fuer einen Radtyp, Ruecksprung fuer die anderen - statt eines
        # langweiligen "alles gut" oder "alles schlecht".
        dauer = max(3, round(random.lognormvariate(math.log(max(mittel, 2.0)), 0.21)))

        # ---- Frei abstellen statt andocken
        # Die Kundenwebsite bewirbt es als Merkmal: "Frei im Geschaeftsgebiet -
        # ueberall in der roten Umrandung, ohne Zuschlag." Das Datenmodell sieht
        # es ebenfalls vor (end_station_id ist nullable, daneben stehen
        # Koordinatenspalten). Bis zum 31.08.2026 endete hier jede Fahrt an einer
        # Station - ein Datensatz, der dem eigenen Produktversprechen widerspricht.
        #
        # Freizeitfahrten enden haeufiger frei als Pendelfahrten: wer zum Kaeppele
        # hochfaehrt, stellt oben ab, wo er ist.
        p_frei = 0.30 if STATION_TYP[end_station] == "freizeit" else 0.16
        frei_abgestellt = random.random() < p_frei
        end_lon = end_lat = ""
        if frei_abgestellt:
            # In der Naehe der angesteuerten Station, aber im Gebiet - sonst
            # waere die Fahrt laut Website gar nicht beendbar.
            basis_lon, basis_lat = STATION_ORT[end_station]
            for _ in range(20):
                lon = basis_lon + random.gauss(0, 0.0045)
                lat = basis_lat + random.gauss(0, 0.0032)
                if im_gebiet(lon, lat):
                    end_lon, end_lat = round(lon, 6), round(lat, 6)
                    break
            else:
                frei_abgestellt = False     # kein Platz gefunden: doch andocken

        # ---- Status
        r_status = random.random()
        if r_status < 0.022:
            status = "abgebrochen"      # am Terminal abgebrochen, Rad nie wirklich weg
            dauer = random.randint(1, 3)
            end_station = start_station
            frei_abgestellt = False
            end_lon = end_lat = ""
        elif r_status < 0.027:
            status = "storniert"
            dauer = random.randint(1, 2)
            end_station = start_station
            frei_abgestellt = False
            end_lon = end_lat = ""
        else:
            status = "abgeschlossen"
            # Vergessene Rueckgaben: seltene, sehr lange Ausleihen. Sie sind der
            # Anker fuer die Anomalieerkennung - selten genug, um nicht ins
            # Mittel zu rutschen, haeufig genug, um sie zu finden.
            if random.random() < 0.0007:
                dauer = random.randint(8 * 60, 30 * 60)
                langzeit_gesetzt += 1

        endzeit = startzeit + timedelta(minutes=int(dauer))

        # ---- Distanz: weiterhin nur zu 60 Prozent gemessen (Datenqualitaet!)
        distanz = ""
        if status == "abgeschlossen" and random.random() < 0.60:
            geschw = {"CITY": 13.0, "EBIKE": 18.0, "CARGO": 11.0}[rad["typ"]]
            distanz = round((dauer / 60.0) * geschw * random.uniform(0.80, 1.20), 2)
            rad["km_kumuliert"] += float(distanz)
        elif status == "abgeschlossen":
            rad["km_kumuliert"] += (dauer / 60.0) * 13.0 * 0.9
        rad["fahrten"] += 1
        # Fuer das Verschleissmodell weiter unten: WANN wurde wieviel gefahren.
        # Der Sensor meldet nur 60 Prozent der Distanzen - verschlissen wird
        # trotzdem, deshalb hier die geschaetzte Strecke, nicht die gemessene.
        if status == "abgeschlossen":
            geschw = {"CITY": 13.0, "EBIKE": 18.0, "CARGO": 11.0}[rad["typ"]]
            rad["verlauf"].append((d, (dauer / 60.0) * geschw))

        # ---- Entgelt
        if status == "abgeschlossen":
            betrag, berechnete = entgelt_berechnen(kunde, rad["typ"], int(dauer), d)
        else:
            betrag, berechnete = 0.0, 0
        kunde["fahrten"] += 1
        kunde["umsatz"] += betrag

        ausleihe_id += 1
        ausleihe_rows.append([
            ausleihe_id, kunde_id, rad["id"], start_station, startzeit.isoformat(sep=" "),
            "" if frei_abgestellt else end_station, endzeit.isoformat(sep=" "),
            status, distanz, f"{betrag:.2f}", berechnete, end_lat, end_lon,
        ])

    d += timedelta(days=1)

schreibe("ausleihe.csv",
         ["ausleihe_id", "kunde_id", "fahrrad_id", "start_station_id", "startzeit",
          "end_station_id", "endzeit", "status", "distanz_km", "entgelt_eur",
          "berechnete_minuten", "end_latitude", "end_longitude"],
         ausleihe_rows)

print("Instandhaltung ...")

# =====================================================================
# SCHADENSMELDUNGEN UND WARTUNGSAUFTRAEGE
# Die kumulierte Nutzung ist das Verschleisssignal: mehr Kilometer und mehr
# Fahrten fuehren zu spuerbar mehr Meldungen - spuerbar, aber bewusst nicht
# perfekt. Ein zu sauberes Signal macht die Klassifikationsuebung wertlos,
# weil jeder Baum sofort 100 Prozent trifft.
# =====================================================================
KATEGORIEN = ["Bremse", "Reifen/Platten", "Schaltung", "Licht", "Rahmen/Lenker", "Sattel/Sitzhaltung"]
KATEGORIEN_EBIKE = KATEGORIEN + ["Akku", "Motor/Unterstuetzung"]

schaden_rows, auftrag_rows = [], []
schaden_id = auftrag_id = 0

# VERSCHLEISS ENTSTEHT ENTLANG DER ZEIT (31.08.2026)
#
# Die erste Fassung zog die ANZAHL Meldungen aus der Lebenszeit-Nutzung und
# verteilte sie dann zufaellig ueber das Radleben. Fuer die Klassifikation war
# das toedlich: WANN eine Meldung kommt, hing von nichts ab, was man vorher
# haette wissen koennen. Gemessen schlug die Faustregel "meiste Kilometer"
# (46,7 % Treffer) den Random Forest (41,7 %) - voellig zu Recht, denn mehr als
# die Lebenszeit-Nutzung steckte gar nicht in den Daten.
#
# Jetzt laeuft das Modell die Fahrten jedes Rades der Reihe nach ab. Die
# Gefaehrdung waechst mit den Kilometern SEIT DER LETZTEN REPARATUR und faellt
# danach auf null zurueck. Das ist physikalisch das Naheliegende - ein Bremsbelag
# weiss nicht, wieviel das Rad in seinem ganzen Leben gefahren ist, sondern nur,
# wieviel seit seinem Einbau - und es macht die juengere Nutzung zu einem
# Merkmal, das etwas vorhersagt.
KATEGORIEN = ["Bremse", "Reifen/Platten", "Schaltung", "Licht", "Rahmen/Lenker", "Sattel/Sitzhaltung"]
KATEGORIEN_EBIKE = KATEGORIEN + ["Akku", "Motor/Unterstuetzung"]

# Kilometer, ab denen es ernst wird - je Radtyp verschieden, weil Lastenraeder
# schwerer und E-Bikes schneller sind.
VERSCHLEISS_SCHWELLE = {"CITY": 300.0, "EBIKE": 260.0, "CARGO": 210.0}

schaden_rows, auftrag_rows = [], []
schaden_id = auftrag_id = 0

for rad in raeder:
    schwelle = VERSCHLEISS_SCHWELLE[rad["typ"]]
    km_seit_wartung = random.uniform(0, schwelle * 0.6)   # Vorgeschichte
    pool = KATEGORIEN_EBIKE if rad["typ"] in ("EBIKE", "CARGO") else KATEGORIEN
    ende_rad = rad["ausgemustert_am"] or BIS

    for tag, km in rad["verlauf"]:
        km_seit_wartung += km
        # Gefaehrdung je Fahrt: waechst ueberproportional mit der Strecke seit
        # der letzten Reparatur. Der Exponent 2,2 sorgt dafuer, dass ein frisch
        # gewartetes Rad praktisch sicher ist und ein lange gefahrenes deutlich
        # auffaellig wird - ein Verlauf, den ein Baum gut abbilden kann.
        gefaehrdung = 0.012 * (km_seit_wartung / schwelle) ** 2.2
        if random.random() >= min(gefaehrdung, 0.35):
            continue

        anteil = min(1.0, km_seit_wartung / (schwelle * 1.8))
        schwere = random.choices(
            ["leicht", "mittel", "fahruntauglich"],
            weights=[max(0.08, 0.55 - anteil * 0.4), 0.32, max(0.08, anteil * 0.5)], k=1)[0]

        schaden_id += 1
        gemeldet_dt = datetime(tag.year, tag.month, tag.day,
                               random.randint(7, 19), random.randint(0, 59))
        schaden_rows.append([schaden_id, rad["id"], gemeldet_dt.isoformat(sep=" "),
                             random.choice(pool), schwere,
                             "erledigt" if tag < BIS - timedelta(days=10) else "offen"])

        auftrag_id += 1
        eroeffnet = gemeldet_dt + timedelta(hours=random.randint(2, 60))
        spanne = {"leicht": (0, 2), "mittel": (1, 4), "fahruntauglich": (0, 1)}[schwere]
        erledigt = eroeffnet + timedelta(days=random.randint(*spanne), hours=random.randint(0, 8))
        ist_erledigt = erledigt < datetime(BIS.year, BIS.month, BIS.day)
        arbeitszeit = {"leicht": random.randint(10, 35), "mittel": random.randint(25, 90),
                       "fahruntauglich": random.randint(45, 180)}[schwere]
        auftrag_rows.append([auftrag_id, f"WA-{auftrag_id:05d}", rad["id"], schaden_id,
                             eroeffnet.isoformat(sep=" "),
                             erledigt.isoformat(sep=" ") if ist_erledigt else "",
                             "erledigt" if ist_erledigt else "in_arbeit",
                             arbeitszeit if ist_erledigt else ""])

        # Nach der Reparatur beginnt der Verschleiss von vorn - nicht ganz bei
        # null, denn repariert wird das Defekte, nicht das ganze Rad.
        km_seit_wartung *= random.uniform(0.05, 0.25)

schreibe("schadensmeldung.csv",
         ["schadensmeldung_id", "fahrrad_id", "gemeldet_am", "kategorie", "schwere", "status"],
         schaden_rows)
schreibe("wartungsauftrag.csv",
         ["wartungsauftrag_id", "auftragsnummer", "fahrrad_id", "schadensmeldung_id",
          "eroeffnet_am", "erledigt_am", "status", "arbeitszeit_minuten"],
         auftrag_rows)

# =====================================================================
# NACHMESSUNG
# Kein Muster wird behauptet, das hier nicht gemessen wird. Die Zahlen, die
# dieser Block ausgibt, stehen so auch in README.md - wer den Generator
# aendert, sieht sofort, ob die Zusage noch haelt.
# =====================================================================
def korrelation(xs, ys):
    n = len(xs)
    if n < 2:
        return float("nan")
    mx, my = sum(xs) / n, sum(ys) / n
    cov = sum((x - mx) * (y - my) for x, y in zip(xs, ys)) / n
    sx, sy = statistics.pstdev(xs), statistics.pstdev(ys)
    return cov / (sx * sy) if sx > 0 and sy > 0 else float("nan")


print("\n" + "=" * 66)
print("NACHMESSUNG DER EINGEBAUTEN MUSTER")
print("=" * 66)

# --- Tagesreihe aufbauen
je_tag = {}
for row in ausleihe_rows:
    tag = row[4][:10]
    je_tag[tag] = je_tag.get(tag, 0) + 1
tage = sorted(je_tag)
temps = [wetter[t]["temp"] for t in tage if t in wetter]
regen = [wetter[t]["regen"] for t in tage if t in wetter]
fahrten_tag = [je_tag[t] for t in tage if t in wetter]

print(f"Fahrten gesamt                 {len(ausleihe_rows):>10,d}".replace(",", "."))
print(f"Kundschaft                     {N_KUNDEN:>10,d}".replace(",", "."))
print(f"Raeder                         {N_RAEDER:>10,d}".replace(",", "."))
print(f"Umsatz gesamt                  {sum(k['umsatz'] for k in kunden.values()):>10,.2f} EUR"
      .replace(",", "X").replace(".", ",").replace("X", "."))
print()
print(f"Temperatur  <-> Tagesfahrten   r = {korrelation(temps, fahrten_tag):+.3f}   (Ziel: stark positiv)")
print(f"Niederschlag<-> Tagesfahrten   r = {korrelation(regen, fahrten_tag):+.3f}   (Ziel: klar negativ)")

werk = [je_tag[t] for t in tage
        if date.fromisoformat(t).isoweekday() <= 5 and date.fromisoformat(t) not in FEIERTAGE]
wend = [je_tag[t] for t in tage
        if date.fromisoformat(t).isoweekday() > 5 or date.fromisoformat(t) in FEIERTAGE]
print(f"Werktag ⌀ {sum(werk)/len(werk):5.1f}  gegen  frei ⌀ {sum(wend)/len(wend):5.1f} Fahrten/Tag")

ferien_werk = [je_tag[t] for t in tage if date.fromisoformat(t) in FERIENTAGE
               and date.fromisoformat(t).isoweekday() <= 5]
norm_werk = [je_tag[t] for t in tage if date.fromisoformat(t) not in FERIENTAGE
             and date.fromisoformat(t).isoweekday() <= 5]
print(f"Schulferien (werktags) ⌀ {sum(ferien_werk)/len(ferien_werk):5.1f}  gegen sonst ⌀ "
      f"{sum(norm_werk)/len(norm_werk):5.1f}   <- roh, IRREFUEHREND")
# Der rohe Vergleich taeuscht: Ferien liegen ueberwiegend im Sommer, und die
# Waerme hebt die Nachfrage genau dann an. Erst bei vergleichbarer Temperatur
# wird der Ferieneffekt sichtbar. Das ist kein Schoenheitsfehler des
# Datensatzes, sondern ein Lehrstueck - eine Scheinkorrelation zum Anfassen,
# die in der Data-Understanding-Phase auffliegen soll.
warm_ferien = [je_tag[t] for t in tage if date.fromisoformat(t) in FERIENTAGE
               and date.fromisoformat(t).isoweekday() <= 5 and 15 <= wetter[t]["temp"] <= 22]
warm_sonst = [je_tag[t] for t in tage if date.fromisoformat(t) not in FERIENTAGE
              and date.fromisoformat(t).isoweekday() <= 5 and 15 <= wetter[t]["temp"] <= 22]
print(f"   bei 15-22 Grad:      ⌀ {sum(warm_ferien)/len(warm_ferien):5.1f}  gegen sonst ⌀ "
      f"{sum(warm_sonst)/len(warm_sonst):5.1f}   <- kontrolliert, Faktor "
      f"{(sum(warm_ferien)/len(warm_ferien))/(sum(warm_sonst)/len(warm_sonst)):.2f}")

ev = [je_tag[t] for t in tage if date.fromisoformat(t) in EVENT_STAERKE]
nev = [je_tag[t] for t in tage if date.fromisoformat(t) not in EVENT_STAERKE]
print(f"Veranstaltungstage ⌀ {sum(ev)/len(ev):5.1f}  gegen sonst ⌀ {sum(nev)/len(nev):5.1f} "
      f"(Faktor {(sum(ev)/len(ev))/(sum(nev)/len(nev)):.2f})")

# --- Spitzenstunde je Stationstyp (das Clustering-Signal)
print("\nSpitzenstunde werktags je Station (Signal fuer das Clustering):")
stunde_je_station = {}
for row in ausleihe_rows:
    dt = datetime.fromisoformat(row[4])
    if dt.date().isoweekday() > 5 or dt.date() in FEIERTAGE:
        continue
    stunde_je_station.setdefault(row[3], {}).setdefault(dt.hour, 0)
    stunde_je_station[row[3]][dt.hour] += 1
for sid in STATION_IDS:
    verteilung = stunde_je_station.get(sid, {})
    spitze = max(verteilung, key=verteilung.get) if verteilung else -1
    print(f"   {STATION_NAME[sid]:<20s} {spitze:>2d} Uhr   (erzeugt als: {STATION_TYP[sid]})")

# --- Kundensegmente (das RFM-Signal)
print("\nFahrten und Umsatz je Kundenprofil (Signal fuer die Segmentierung):")
je_profil = {}
for k in kunden.values():
    e = je_profil.setdefault(k["profil"], {"n": 0, "fahrten": 0, "umsatz": 0.0})
    e["n"] += 1
    e["fahrten"] += k["fahrten"]
    e["umsatz"] += k["umsatz"]
for code in PROFIL_CODES:
    e = je_profil[code]
    print(f"   {code:<12s} {e['n']:>5d} Kunden   ⌀ {e['fahrten']/e['n']:>6.1f} Fahrten   "
          f"⌀ {e['umsatz']/e['n']:>7.2f} EUR")

# --- Abwanderung (Label fuer die Klassifikation)
letzte_fahrt = {}
for row in ausleihe_rows:
    kid = row[1]
    tag = row[4][:10]
    if kid not in letzte_fahrt or tag > letzte_fahrt[kid]:
        letzte_fahrt[kid] = tag
stichtag = BIS
abgewandert = sum(1 for kid in kunden
                  if kid not in letzte_fahrt
                  or (stichtag - date.fromisoformat(letzte_fahrt[kid])).days > 90)
print(f"\nOhne Fahrt in den letzten 90 Tagen: {abgewandert} von {N_KUNDEN} "
      f"({abgewandert/N_KUNDEN:.1%})   (Label fuer die Abwanderungsklassifikation)")

# --- Verschleisssignal (Label fuer die Klassifikation)
meldungen_je_rad = {}
for row in schaden_rows:
    meldungen_je_rad[row[1]] = meldungen_je_rad.get(row[1], 0) + 1
xs = [r["km_kumuliert"] for r in raeder]
ys = [meldungen_je_rad.get(r["id"], 0) for r in raeder]
mit = sum(1 for y in ys if y > 0)
print(f"km je Rad <-> Anzahl Meldungen r = {korrelation(xs, ys):+.3f}")
print(f"Raeder mit mindestens einer Meldung: {mit} von {N_RAEDER} ({mit/N_RAEDER:.1%})")

# --- Anomalien und Stoerungen
lang = sum(1 for row in ausleihe_rows
           if (datetime.fromisoformat(row[6]) - datetime.fromisoformat(row[4])).total_seconds() > 8 * 3600)
print(f"\nAusleihen ueber 8 Stunden: {lang}   (Anker fuer die Anomalieerkennung)")
print(f"Stationsstoerungen: {len(stoerungen)} an {len(STOERTAGE)} Tagen")
abg = sum(1 for row in ausleihe_rows if row[7] != "abgeschlossen")
print(f"Nicht abgeschlossene Fahrten: {abg} ({abg/len(ausleihe_rows):.1%})")
ohne_distanz = sum(1 for row in ausleihe_rows if row[8] == "")
print(f"Fahrten ohne gemessene Distanz: {ohne_distanz} ({ohne_distanz/len(ausleihe_rows):.1%})"
      f"   (Thema der Data-Preparation-Phase)")
print("=" * 66)
