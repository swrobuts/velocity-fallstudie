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
import heapq
import math
import os
import random
import statistics
from datetime import date, datetime, timedelta

random.seed(20260901)

OUT = os.environ.get("VELO_OUT") or os.path.dirname(os.path.abspath(__file__))
VON = date(2021, 8, 24)         # Betriebsaufnahme, genau fuenf Jahre
BIS = date(2026, 8, 24)         # Datenstand
# Die ersten Monate sind ein Markthochlauf: Bekanntheit und Flotte wachsen,
# die Nachfrage erreicht erst nach ANLAUF_TAGE ihr volles Niveau.
ANLAUF_TAGE = 540
ANLAUF_START = 0.42
# E-Bikes kommen erst im dritten Betriebsjahr in die Flotte. Der Zulauf
# verteilt sich ueber ein Quartal und hebt das Nachfrageniveau dauerhaft.
EBIKE_AB = date(2023, 9, 1)
EBIKE_RAMPE_TAGE = 90
EBIKE_HUB = 0.16


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
# NAMEN, NUMMERN UND KOORDINATEN STAMMEN AUS velocity.station (01.09.2026).
#
# Die Namen muessen mit der Betriebsdatenbank uebereinstimmen: Notebook 1
# liefert seine Preisspannen an die Kundenwebsite, die dieselben Stationen
# anzeigt.
#
# Die Spalte typ steuert die Erzeugung und wird NICHT exportiert. Sie ist
# nach dem tatsaechlichen Ort vergeben: Bahnhof, Klinikum, Sanderau und
# Zellerau tragen Pendelverkehr, die beiden Hochschulstandorte den
# Vorlesungsrhythmus, Dom und Residenz den Ausflugsverkehr.
STATIONEN = [
    # id, nummer, name, lat, lon, kapazitaet, typ
    (1,  "S-0001", "Hauptbahnhof",           49.8019, 9.9358, 60, "pendler"),
    (2,  "S-0002", "Marktplatz",             49.7944, 9.9295, 40, "misch"),
    (3,  "S-0003", "Universität Sanderring", 49.7880, 9.9353, 55, "uni"),
    (4,  "S-0004", "Residenz",               49.7930, 9.9390, 35, "freizeit"),
    (5,  "S-0005", "Juliuspromenade",        49.7960, 9.9280, 45, "misch"),
    (6,  "S-0006", "Dom",                    49.7938, 9.9322, 35, "freizeit"),
    (7,  "S-0007", "Sanderau",               49.7818, 9.9412, 50, "pendler"),
    (8,  "S-0008", "Hubland Campus",         49.7810, 9.9720, 65, "uni"),
    (9,  "S-0009", "Grombühl Klinikum",      49.8046, 9.9424, 45, "pendler"),
    (10, "S-0010", "Zellerau",               49.7965, 9.9142, 35, "pendler"),
]
schreibe("station.csv",
         ["station_id", "stationsnummer", "name", "latitude", "longitude", "kapazitaet"],
         [[s[0], s[1], s[2], s[3], s[4], s[5]] for s in STATIONEN])

STATION_TYP = {s[0]: s[6] for s in STATIONEN}
STATION_IDS = [s[0] for s in STATIONEN]
STATION_NAME = {s[0]: s[2] for s in STATIONEN}

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
# Die Flotte laeuft ueber fuenf Jahre einmal um: Raeder werden beschafft,
# fahren vier bis fuenfeinhalb Jahre und werden dann ausgemustert. Daraus
# entsteht eine Altersstruktur - ohne sie waeren alle Raeder gleich alt und
# die Verschleissvorhersage haette nichts zu unterscheiden.
#
# E-Bikes kommen erst zum dritten Betriebsjahr dazu (EBIKE_AB).
# =====================================================================
LEBENSDAUER_TAGE = (1460, 2010)          # vier bis fuenfeinhalb Jahre
BESCHAFFUNG_TRANCHE_TAGE = 180           # die Startflotte kommt in Lieferungen

# Sollstaerke je Radtyp zu Beginn und am Datenstand. Dazwischen wird linear
# interpoliert, E-Bikes erst ab ihrem Einfuehrungsdatum.
SOLLFLOTTE = {"CITY": (105, 138), "CARGO": (25, 27), "EBIKE": (0, 88)}


def sollstaerke(typ_code, tag):
    """Wie viele Raeder dieses Typs sollen an diesem Tag im Bestand sein?"""
    von_wert, bis_wert = SOLLFLOTTE[typ_code]
    if typ_code == "EBIKE":
        if tag < EBIKE_AB:
            return 0
        anteil = min(1.0, (tag - EBIKE_AB).days / EBIKE_RAMPE_TAGE)
        # Nach der Rampe waechst der Bestand noch langsam weiter.
        rest = max(0.0, (tag - EBIKE_AB).days - EBIKE_RAMPE_TAGE) / max(
            1, (BIS - EBIKE_AB).days - EBIKE_RAMPE_TAGE)
        return round(bis_wert * (0.72 * anteil + 0.28 * min(1.0, rest)))
    anteil = min(1.0, max(0.0, (tag - VON).days / max(1, (BIS - VON).days)))
    return round(von_wert + (bis_wert - von_wert) * anteil)


raeder = []
fahrrad_rows = []
naechste_id = 1


def rad_anschaffen(typ_code, tag):
    """Legt ein Rad an und wuerfelt seine Lebensdauer aus."""
    global naechste_id
    lebensdauer = random.randint(*LEBENSDAUER_TAGE)
    ende_tag = tag + timedelta(days=lebensdauer)
    ausgemustert = ende_tag if ende_tag <= BIS else None
    rad = {"id": naechste_id, "typ": typ_code, "angeschafft": tag,
           "ausgemustert_am": ausgemustert, "km_kumuliert": 0.0,
           "hoehenmeter": 0.0, "fahrten": 0, "verlauf": []}
    raeder.append(rad)
    naechste_id += 1
    return rad


# Startflotte: ueber das erste halbe Jahr in Tranchen geliefert.
for typ_code in ("CITY", "CARGO"):
    for nummer in range(SOLLFLOTTE[typ_code][0]):
        # Die Haelfte steht zur Betriebsaufnahme bereit, der Rest kommt in
        # Tranchen nach. Ohne diese erste Lieferung gaebe es am Eroeffnungstag
        # kein einziges Rad - und keine Fahrt.
        tage = 0 if nummer < SOLLFLOTTE[typ_code][0] // 2 else random.randint(
            10, BESCHAFFUNG_TRANCHE_TAGE)
        rad_anschaffen(typ_code, VON + timedelta(days=tage))

# Danach monatlich auffuellen: Ersatz fuer Ausmusterungen und Wachstum.
tag = VON + timedelta(days=30)
while tag <= BIS:
    for typ_code in SOLLFLOTTE:
        vorhanden = sum(1 for r in raeder
                        if r["typ"] == typ_code
                        and r["angeschafft"] <= tag
                        and (r["ausgemustert_am"] is None or r["ausgemustert_am"] > tag))
        for _ in range(max(0, sollstaerke(typ_code, tag) - vorhanden)):
            rad_anschaffen(typ_code, tag - timedelta(days=random.randint(0, 25)))
    tag += timedelta(days=30)

raeder.sort(key=lambda r: r["id"])
for rad in raeder:
    fahrrad_rows.append([rad["id"], f"WUE-{rad['id']:04d}", rad["typ"],
                         rad["angeschafft"].isoformat(),
                         "ausgemustert" if rad["ausgemustert_am"] else "verfuegbar",
                         rad["ausgemustert_am"].isoformat() if rad["ausgemustert_am"] else ""])
N_RAEDER = len(raeder)

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
_OSTERN = {2021: date(2021, 4, 4),  2022: date(2022, 4, 17),
           2023: date(2023, 4, 9),  2024: date(2024, 3, 31),
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
# Amtliche Ferientermine, abgerufen von ferien-api.de. Anders als der
# Veranstaltungskalender sind das keine typisierten Zeitraeume, sondern die
# tatsaechlichen Daten - ausgewiesen in der Spalte 'genauigkeit'.
# =====================================================================
FERIEN = [
    (date(2021,  3, 29), date(2021,  4, 10), "Osterferien"),
    (date(2021,  5, 25), date(2021,  6,  4), "Pfingstferien"),
    (date(2021,  7, 30), date(2021,  9, 13), "Sommerferien"),
    (date(2021, 11,  2), date(2021, 11,  5), "Herbstferien"),
    (date(2021, 12, 24), date(2022,  1,  8), "Weihnachtsferien"),
    (date(2022,  2, 28), date(2022,  3,  4), "Fruehjahrsferien"),
    (date(2022,  4, 11), date(2022,  4, 23), "Osterferien"),
    (date(2022,  6,  7), date(2022,  6, 18), "Pfingstferien"),
    (date(2022,  8,  1), date(2022,  9, 12), "Sommerferien"),
    (date(2022, 10, 31), date(2022, 11,  4), "Herbstferien"),
    (date(2022, 12, 24), date(2023,  1,  7), "Weihnachtsferien"),
    (date(2023,  2, 20), date(2023,  2, 24), "Fruehjahrsferien"),
    (date(2023,  4,  3), date(2023,  4, 15), "Osterferien"),
    (date(2023,  5, 30), date(2023,  6,  9), "Pfingstferien"),
    (date(2023,  7, 31), date(2023,  9, 11), "Sommerferien"),
    (date(2023, 10, 30), date(2023, 11,  3), "Herbstferien"),
    (date(2023, 12, 23), date(2024,  1,  5), "Weihnachtsferien"),
    (date(2024,  2, 12), date(2024,  2, 16), "Fruehjahrsferien"),
    (date(2024,  3, 25), date(2024,  4,  6), "Osterferien"),
    (date(2024,  5, 21), date(2024,  6,  1), "Pfingstferien"),
    (date(2024,  7, 29), date(2024,  9,  9), "Sommerferien"),
    (date(2024, 10, 28), date(2024, 10, 31), "Herbstferien"),
    (date(2024, 12, 23), date(2025,  1,  3), "Weihnachtsferien"),
    (date(2025,  3,  3), date(2025,  3,  7), "Fruehjahrsferien"),
    (date(2025,  4, 14), date(2025,  4, 25), "Osterferien"),
    (date(2025,  6, 10), date(2025,  6, 20), "Pfingstferien"),
    (date(2025,  8,  1), date(2025,  9, 15), "Sommerferien"),
    (date(2025, 11,  3), date(2025, 11,  7), "Herbstferien"),
    (date(2025, 12, 22), date(2026,  1,  5), "Weihnachtsferien"),
    (date(2026,  2, 16), date(2026,  2, 21), "Frühjahrsferien"),
    (date(2026,  3, 30), date(2026,  4, 11), "Osterferien"),
    (date(2026,  5, 26), date(2026,  6,  6), "Pfingstferien"),
    (date(2026,  8,  3), date(2026,  9, 15), "Sommerferien"),
    (date(2026, 11,  2), date(2026, 11,  7), "Herbstferien"),
]
FERIENTAGE = set()
for von, bis, name in FERIEN:
    d = von
    while d <= bis:
        FERIENTAGE.add(d)
        d += timedelta(days=1)
schreibe("schulferien.csv", ["von", "bis", "bezeichnung", "genauigkeit"],
         [[v.isoformat(), b.isoformat(), n, "amtlicher Termin"]
          for v, b, n in FERIEN if VON <= b and v <= BIS])

# =====================================================================
# SEMESTERZEITEN (JMU Wuerzburg, typisiert)
# Als eigene Datei koennen die Studierenden sie als Merkmal joinen - genau die
# Arbeit, um die es in der Data-Preparation-Phase geht.
# =====================================================================
SEMESTER = []
for jahr in range(2021, 2027):
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
# Die Freiminutenkontingente sind knapp bemessen: Bei einer mittleren
# Fahrtdauer von rund einer Viertelstunde entsprechen sie zwei bis sechs
# Freifahrten im Monat. Grosszuegigere Kontingente - etwa die zehnfache
# Menge - wuerden praktisch jede Nutzung decken; der Fahrpreis haenge dann
# fuer fast alle Kunden nur noch an der Startgebuehr und gar nicht mehr an
# der Fahrtdauer. Mit diesen Werten zahlt rund die Haelfte aller Fahrten
# nach Minuten.
TARIFE = [
    ("BASIS",   "Basistarif",     "",                                  0,  0.0),
    ("STUDENT", "Studententarif", "Gültiger Studierendenausweis",     30,  0.0),
    ("OEPNV",   "OEPNV-Abo",      "VGN-Abo oder Deutschlandticket",   50,  0.0),
    ("PREMIUM", "Premium",        "Rahmenvertrag über den Arbeitgeber", 90, 20.0),
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
#
# Jeder Kunde bekommt ein PROFIL, das steuert, wie oft, wann und wo er
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

# ---- Stammstrecken
# Wer pendelt, faehrt fast immer dieselbe Strecke: morgens von zu Hause zur
# Arbeit, abends zurueck. Ohne diese Gewohnheit wuerfelt jede Fahrt neu, und
# eine Assoziationsanalyse findet nur Stationstypen statt Verhaltensmuster.
#
# WOHNSTATIONEN sind die Wohngebiete im Netz, ZIELSTATIONEN die Arbeits- und
# Studienorte. Die Achse jedes Kunden wird daraus gezogen.
WOHNSTATIONEN = [7, 9, 10, 2, 5]          # Sanderau, Grombuehl, Zellerau, Markt, Julius
ZIELSTATIONEN = [1, 3, 8, 9]              # Hauptbahnhof, Sanderring, Hubland, Klinikum
# Anteil der Fahrten, die auf der eigenen Stammachse laufen.
STAMMANTEIL = {"pendler": 0.88, "studium": 0.74, "vielfahrer": 0.70,
               "freizeit": 0.22, "gelegenheit": 0.10}

# ---- Profilwandel
# Aus dem Studenten wird ein Pendler, aus dem Vielfahrer ein Gelegenheitsnutzer,
# bevor er ganz aufhoert. Ueber fuenf Jahre ist das die Regel, nicht die
# Ausnahme - und fuer die Segmentierung der interessantere Befund als die
# Segmente selbst. Angaben als Wahrscheinlichkeit je Jahr.
PROFILWECHSEL = {
    "studium":     {"pendler": 0.17, "freizeit": 0.05},
    "gelegenheit": {"freizeit": 0.08},
    "freizeit":    {"pendler": 0.04, "gelegenheit": 0.09},
    "pendler":     {"freizeit": 0.04, "vielfahrer": 0.03},
    "vielfahrer":  {"pendler": 0.06},
}

kunden = {}
kunde_rows = []
for kid in range(1, N_KUNDEN + 1):
    profil = random.choices([p[0] for p in PROFILE], weights=[p[1] for p in PROFILE], k=1)[0]
    p = next(x for x in PROFILE if x[0] == profil)

    # Anmeldung: ein kleiner Grundstock zur Betriebsaufnahme, danach
    # laufender Zulauf. Er folgt dem Markthochlauf, ist also in den ersten
    # Monaten duenner als spaeter.
    if random.random() < 0.12:
        registriert = VON + timedelta(days=random.randint(0, 30))
    else:
        spanne = (BIS - VON).days - 30
        # Wurzelverteilung: mehr Anmeldungen in den spaeteren Jahren.
        registriert = VON + timedelta(days=int(spanne * random.random() ** 0.72))

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

    # Stammachse: wo der Kunde wohnt und wohin er regelmaessig faehrt.
    heimat = random.choice(WOHNSTATIONEN)
    ziel_regel = random.choice([s for s in ZIELSTATIONEN if s != heimat])

    # Profilverlauf ueber die Jahre. Der Eintrag gilt ab dem genannten Datum.
    verlauf = [(registriert, profil)]
    jetziges, jahr_ab = profil, registriert
    while True:
        jahr_ab = jahr_ab + timedelta(days=365)
        if jahr_ab > min(aktiv_bis, BIS):
            break
        uebergaenge = PROFILWECHSEL.get(jetziges, {})
        wurf = random.random()
        summe = 0.0
        for neues, wahrscheinlichkeit in uebergaenge.items():
            summe += wahrscheinlichkeit
            if wurf < summe:
                jetziges = neues
                verlauf.append((jahr_ab, jetziges))
                break

    kunden[kid] = {"profil": profil, "profil_verlauf": verlauf,
                   "registriert": registriert, "aktiv_bis": aktiv_bis,
                   "tarif": tarif, "intensitaet": intensitaet,
                   "heimat": heimat, "ziel_regel": ziel_regel,
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
# ROUTENMATRIX UND FAHRZEITMODELL
#
# Strecken und Hoehen stammen aus analytics/radrouten_matrix.csv: echte
# Radrouten aus dem OSRM-Fahrradprofil, Hoehen aus SRTM. Die Datei wird mit
# tools/radrouten_abrufen.py erzeugt und ist eingecheckt, damit die
# Datenerzeugung ohne Netzzugang reproduzierbar bleibt.
#
# Die Fahrzeit folgt daraus, nicht umgekehrt:
#   gefahrene Strecke = kuerzeste Route x Umwegbereitschaft des Fahrers
#   Tempo             = Grundtempo des Radtyps x Steigung x Wetter x Anlass
#   Dauer             = Strecke / Tempo + Halte + Streuung
# =====================================================================
ROUTEN = {}
ORTE = {}
with open(os.path.join(OUT, "radrouten_matrix.csv"), encoding="utf-8") as f:
    zeilen = [z for z in f if not z.startswith("#")]
for row in csv.DictReader(zeilen):
    ROUTEN[(row["von_id"], row["nach_id"])] = (
        float(row["strecke_m"]) / 1000.0, float(row["steigung_promille"]))
    ORTE[row["von_id"]] = row["von_art"]
ABSTELLORTE = sorted(o for o, art in ORTE.items() if art == "abstellort")
ABSTELLORT_KOORD = {}
with open(os.path.join(OUT, "abstellort.csv"), encoding="utf-8") as f:
    for row in csv.DictReader(f):
        if row["art"] == "abstellort":
            ABSTELLORT_KOORD[row["ort_id"]] = (float(row["lat"]), float(row["lon"]))

# Grundtempo in km/h bei ebener Strecke.
GRUNDTEMPO = {"CITY": 13.2, "EBIKE": 17.0, "CARGO": 11.0}
# Wirkung der mittleren Steigung je Promille. Der Motor des E-Bikes faengt den
# Anstieg weitgehend ab, das Lastenrad leidet am staerksten. Bergab bringt nur
# etwa die Haelfte dessen, was bergauf kostet - man bremst.
STEIGUNG_BERGAUF = {"CITY": 0.0140, "EBIKE": 0.0040, "CARGO": 0.0180}
STEIGUNG_BERGAB = {"CITY": 0.0070, "EBIKE": 0.0030, "CARGO": 0.0080}
TEMPO_GRENZEN = (6.0, 28.0)
TEMPO_HOECHSTWERT = 29.0        # Obergrenze auch nach der Streuung
# Wie weit faehrt wer ueber die kuerzeste Route hinaus?
UMWEG_PROFIL = {"pendler": 1.03, "studium": 1.08, "freizeit": 1.42,
                "gelegenheit": 1.28, "vielfahrer": 1.02}
HALT_GRUND_MIN = 1.2            # Losfahren, Anschliessen
HALT_JE_KM_MIN = 0.45           # Ampeln und Kreuzungen
DAUER_STREUUNG = 0.17           # Streubreite der Lognormalverteilung
RUNDTOUR_KM = (2.5, 9.0)        # Fahrten, die dort enden, wo sie begannen
FREI_ABSTELLEN_KM = 1.1         # so weit vom Ziel darf frei abgestellt werden


def strecke_und_steigung(von_ort, nach_ort):
    """Kuerzeste Radroute in km und mittlere Steigung in Promille.

    Ortskennungen sind Zeichenketten: Stationen tragen ihre Nummer, freie
    Abstellorte ein P-Kuerzel. Eine Fahrt, die dort endet, wo sie begann,
    hat keine Relation in der Matrix - sie bekommt eine Rundtourstrecke.
    """
    von, nach = str(von_ort), str(nach_ort)
    if von == nach:
        return random.uniform(*RUNDTOUR_KM), 0.0
    return ROUTEN[(von, nach)]


def fahrtempo(typ_code, steigung_promille, temp_c, regen_mm, stunde, profil):
    """Tempo in km/h aus Radtyp, Steigung, Wetter, Tageszeit und Anlass."""
    if steigung_promille >= 0:
        faktor = 1 - STEIGUNG_BERGAUF[typ_code] * steigung_promille
    else:
        faktor = 1 - STEIGUNG_BERGAB[typ_code] * steigung_promille
    tempo = GRUNDTEMPO[typ_code] * faktor
    # Regen treibt an, Hitze bremst.
    tempo *= 1 + 0.012 * min(regen_mm, 8)
    tempo *= 1 - 0.004 * max(0.0, temp_c - 22)
    # Wer zur Arbeit faehrt, faehrt zuegiger als der Nachmittagsausflug.
    if stunde in (7, 8, 17, 18):
        tempo *= 1.06
    elif 13 <= stunde <= 18:
        tempo *= 0.95
    tempo *= {"pendler": 1.08, "studium": 1.02, "freizeit": 0.88,
              "gelegenheit": 0.92, "vielfahrer": 1.10}[profil]
    return min(max(tempo, TEMPO_GRENZEN[0]), TEMPO_GRENZEN[1])


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
        # Die Form des Tagesgangs unterscheidet die Uni-Stationen, nicht ihre
        # Hoehe - darauf setzt das Clustering auf.
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

    Die Gewichte haengen am Tagestyp: eine Freizeitstation lebt am Wochenende,
    eine Pendlerstation ist dann leer. Der Wochenendanteil wird damit zum
    trennschaerfsten Merkmal des Stationsclusterings.
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
# Dieselben Verkehre wie zuvor, jetzt auf den echten Stationen. Die
# Pendelachsen laufen zum Bahnhof und zu den beiden Hochschulstandorten,
# die Ausflugswege am Wochenende zwischen Dom, Residenz und Promenade.
STARKE_WEGE = {
    (1, 8, "frueh", False): 2.6,    # Hauptbahnhof -> Hubland Campus
    (1, 3, "frueh", False): 2.0,    # Hauptbahnhof -> Universität Sanderring
    (1, 9, "frueh", False): 2.2,    # Hauptbahnhof -> Grombühl Klinikum
    (8, 1, "abend", False): 2.8,    # Hubland Campus -> Hauptbahnhof
    (3, 1, "abend", False): 2.1,    # Universität Sanderring -> Hauptbahnhof
    (9, 1, "abend", False): 2.0,    # Grombühl Klinikum -> Hauptbahnhof
    (10, 2, "frueh", False): 1.8,   # Zellerau -> Marktplatz
    (7, 3, "frueh", False): 1.9,    # Sanderau -> Universität Sanderring
    (4, 6, "frueh", True): 2.4,     # Residenz -> Dom (Wochenende)
    (6, 5, "mittag", True): 2.6,    # Dom -> Juliuspromenade
    (5, 6, "abend", True): 2.2,     # Juliuspromenade -> Dom
    (4, 5, "mittag", True): 1.9,    # Residenz -> Juliuspromenade
}

PROFIL_CODES = [p[0] for p in PROFILE]

_pool_cache = {}


def profil_am(kunde, tag):
    """Welches Profil hatte dieser Kunde an diesem Tag?"""
    jetziges = kunde["profil_verlauf"][0][1]
    for ab, code in kunde["profil_verlauf"]:
        if ab <= tag:
            jetziges = code
        else:
            break
    return jetziges


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
            # Das Profil kann sich ueber die Jahre aendern - massgeblich ist,
            # welches der Kunde in DIESEM Monat hat.
            if profil_am(k, monatsbeginn) != code:
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
# ---------------------------------------------------------------- Bestand
# Jedes Rad steht an einem Ort oder ist unterwegs. Ohne diese Buchfuehrung
# entstehen Raeder aus dem Nichts: Am Hubland sammelten sich rechnerisch
# tausende Raeder auf vierzig Plaetzen, in der Zellerau verschwanden sie.
#
# Daraus folgen zwei Ereignisse, die es vorher nicht gab und die den Betrieb
# erst realistisch machen: eine Anfrage an einer leeren Station scheitert, und
# eine volle Zielstation zwingt zum freien Abstellen. Beides wird protokolliert.
KAPAZITAET = {s[0]: s[5] for s in STATIONEN}
VOLL_AB = 0.97                  # ab diesem Fuellgrad gilt eine Station als voll
UMSETZEN_UEBER = 0.66           # daraus raeumt der Betreiber nachts ab
UMSETZEN_UNTER = 0.38           # dorthin bringt er die Raeder
EINSAMMELN_P = 0.65             # Anteil der frei stehenden Raeder je Nacht

an_ort = {sid: [] for sid in STATION_IDS}
for _ort in ABSTELLORTE:
    an_ort[_ort] = []
rad_ort = {}
rad_nach_id = {}
ausser_dienst = set()
unterwegs = []                  # Halde aus (endzeit, lfd, rad_id, zielort)
# Eine Stationsnummer ist eine Zahl, ein Abstellort eine Zeichenkette. Ohne
# eigene Ordnungszahl wuerde die Halde die beiden bei Gleichstand
# miteinander vergleichen.
rueckgabe_lfd = 0
fehlanfrage_rows = []
umsetzfahrt_rows = []

def ausgleichen(zeitpunkt, einsammeln):
    """Raeumt ueberfuellte Stationen ab und fuellt leere auf.

    Laeuft zweimal taeglich: mittags nur zwischen den Stationen, nachts
    zusaetzlich mit dem Einsammeln der frei abgestellten Raeder. Ohne diesen
    Betriebsaufwand liefe das Netz binnen Wochen einseitig voll.
    """
    eingesammelt = 0
    if einsammeln:
        for ort in ABSTELLORTE:
            stehen = an_ort[ort]
            for rid in [r for r in stehen if random.random() < EINSAMMELN_P]:
                # Der Transporter faehrt ohnehin durch die Stadt: Er bringt das
                # Rad nicht zur naechsten, sondern zur leersten Station. Zur
                # naechstgelegenen zu fahren wuerde die Innenstadtstationen
                # ueberfuellen, weil dort die meisten Stellplaetze liegen.
                ziel = min(STATION_IDS,
                           key=lambda s: (len(an_ort[s]) / KAPAZITAET[s],
                                          ROUTEN[(ort, str(s))][0]))
                stehen.remove(rid)
                an_ort[ziel].append(rid)
                rad_ort[rid] = ziel
                eingesammelt += 1
                umsetzfahrt_rows.append(
                    [zeitpunkt.isoformat(sep=" "), rid, ort, ziel, "eingesammelt"])

    verschoben = 0
    for quelle in sorted(STATION_IDS,
                         key=lambda s: -len(an_ort[s]) / KAPAZITAET[s]):
        while len(an_ort[quelle]) > KAPAZITAET[quelle] * UMSETZEN_UEBER:
            # Auf die relativ leerste Station - auch wenn keine wirklich leer
            # ist. Sonst bliebe eine ueberfuellte Station ueberfuellt, nur weil
            # nirgends ein Engpass herrscht. Das Hubland lief so ueber.
            ziel = min((s for s in STATION_IDS if s != quelle),
                       key=lambda s: len(an_ort[s]) / KAPAZITAET[s])
            if len(an_ort[ziel]) >= KAPAZITAET[ziel] * UMSETZEN_UEBER:
                break                      # nirgends mehr Platz
            rid = an_ort[quelle].pop()
            an_ort[ziel].append(rid)
            rad_ort[rid] = ziel
            verschoben += 1
            umsetzfahrt_rows.append(
                [zeitpunkt.isoformat(sep=" "), rid, quelle, ziel, "umgesetzt"])
    return eingesammelt, verschoben


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

    # Markthochlauf: die ersten Monate liegen unter dem spaeteren Niveau.
    anlauf = ANLAUF_START + (1 - ANLAUF_START) * min(
        1.0, (d - VON).days / ANLAUF_TAGE)
    # E-Bikes heben die Nachfrage dauerhaft: sie erschliessen das Hubland
    # und die Steigungen, die mit dem Citybike muehsam sind.
    if d < EBIKE_AB:
        ebike_hub = 1.0
    else:
        ebike_hub = 1 + EBIKE_HUB * min(1.0, (d - EBIKE_AB).days / EBIKE_RAMPE_TAGE)
    basis = (104 * saison * regen_faktor * temp_faktor * tagesart
             * event_staerke * ferien_faktor * anlauf * ebike_hub)
    anzahl = max(8, round(basis * random.uniform(0.85, 1.15)))

    pools = monatspool(d)
    verfuegbare_raeder = [r for r in raeder
                          if r["angeschafft"] <= d
                          and (r["ausgemustert_am"] is None or r["ausgemustert_am"] > d)]
    if not verfuegbare_raeder:
        d += timedelta(days=1)
        continue

    offene_stationen = [s for s in STATION_IDS if s not in gestoert] or STATION_IDS

    # Neu angeschaffte Raeder einstellen, ausgemusterte abziehen.
    for r in verfuegbare_raeder:
        # rad_nach_id kennt jedes je eingestellte Rad. rad_ort dagegen nur die,
        # die gerade irgendwo stehen - wer unterwegs ist, fehlt dort und wuerde
        # sonst ein zweites Mal eingestellt.
        if r["id"] not in rad_nach_id:
            platz = random.choices(STATION_IDS,
                                   weights=[KAPAZITAET[s] for s in STATION_IDS], k=1)[0]
            an_ort[platz].append(r["id"])
            rad_ort[r["id"]] = platz
            rad_nach_id[r["id"]] = r
    for r in raeder:
        if r["ausgemustert_am"] is not None and r["ausgemustert_am"] <= d:
            ausser_dienst.add(r["id"])
            ort = rad_ort.pop(r["id"], None)
            if ort is not None and r["id"] in an_ort[ort]:
                an_ort[ort].remove(r["id"])

    # Erst planen, dann chronologisch abarbeiten: nur in der richtigen
    # Reihenfolge laesst sich sagen, ob an einer Station gerade ein Rad steht.
    plaene = []
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
        # Der Pool wird je Monat gebildet, der Anmeldetag liegt darin: wer sich
        # erst spaeter im Monat anmeldet, kann heute noch nicht fahren.
        for _versuch in range(6):
            kunde_id = random.choices(ids, weights=gew, k=1)[0]
            kunde = kunden[kunde_id]
            if kunde["registriert"] <= d:
                break
        else:
            continue
        kundenprofil = profil_am(kunde, d)

        # ---- Stammachse
        # Wer regelmaessig faehrt, faehrt fast immer dieselbe Strecke: morgens
        # von zu Hause zum Arbeits- oder Studienort, nachmittags zurueck. Diese
        # Gewohnheit ueberschreibt die Stationsgewichte - sonst wuerfelte jede
        # Fahrt neu, und im Netz waeren keine Wege wiederzuerkennen.
        # Wo der Kunde gerade ist, entscheidet ueber die Richtung: von zu Hause
        # geht es hin, vom Arbeitsort zurueck. Ohne diese Buchfuehrung koennte
        # jemand zweimal hintereinander hinfahren - und an der Zielstation
        # wuerden sich Raeder auftuermen, die niemand zurueckbringt.
        hier = kunde.get("standort", kunde["heimat"])
        passt_zur_zeit = (stunde < 13) == (hier == kunde["heimat"])
        auf_achse = (random.random() < STAMMANTEIL[kundenprofil]
                     and kunde["heimat"] in offene_stationen
                     and kunde["ziel_regel"] in offene_stationen
                     and passt_zur_zeit
                     and not frei)
        achse_ziel = None
        if auf_achse:
            achse_ziel = (kunde["ziel_regel"] if hier == kunde["heimat"]
                          else kunde["heimat"])
            start_station = hier
            kunde["standort"] = achse_ziel
            typ = STATION_TYP[start_station]

        # ---- Ziel
        # Die Zielwahl haengt an Tageszeit, Wochentag und Stationstyp. Erst
        # dadurch entstehen Verbindungen, die deutlich ueber der Basisrate
        # liegen - die Regeln, die die Assoziationsanalyse findet.
        #
        # Jetzt haengt die Zielwahl von Startstationstyp UND Tageszeit ab, wie
        # es echte Pendlerstroeme tun: morgens vom Bahnhof zur Uni und in die
        # Klinik, abends zurueck, am Wochenende die Ausflugsrunde.
        fenster = ("frueh" if stunde < 10 else
                   "mittag" if stunde < 15 else
                   "abend" if stunde < 20 else "spaet")
        p_rueckkehr = 0.28 if typ == "freizeit" else 0.10
        if achse_ziel is not None:
            end_station = achse_ziel
        elif random.random() < p_rueckkehr:
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

        plaene.append((startzeit, kunde_id, start_station, end_station,
                       typ, stunde, kundenprofil))

    plaene.sort(key=lambda x: x[0])
    tages_ausgleich = [0, 0]
    mittag_erledigt = False
    for startzeit, kunde_id, start_station, end_station, typ, stunde, kundenprofil in plaene:
        kunde = kunden[kunde_id]
        # Mittags faehrt das Team einmal durch, bevor die Nachmittagsspitze kommt.
        if not mittag_erledigt and startzeit.hour >= 13:
            tages_ausgleich = list(ausgleichen(
                datetime(d.year, d.month, d.day, 12, 55), einsammeln=False))
            mittag_erledigt = True

        # Alles, was bis jetzt zurueckgegeben wurde, steht wieder bereit.
        while unterwegs and unterwegs[0][0] <= startzeit:
            _, _, zurueck_id, zurueck_ort = heapq.heappop(unterwegs)
            if zurueck_id in ausser_dienst:
                continue
            an_ort[zurueck_ort].append(zurueck_id)
            rad_ort[zurueck_id] = zurueck_ort

        bereit = an_ort[start_station]
        if not bereit:
            # Kein Rad an der Station: die Anfrage scheitert. Die Nachfrage war
            # da, bedient wurde sie nicht - genau diese Faelle fehlen einer
            # Prognose, die nur die abgeschlossenen Fahrten zaehlt.
            fehlanfrage_rows.append([startzeit.isoformat(sep=" "), start_station,
                                     "kein Rad verfuegbar"])
            continue
        rad_id = random.choice(bereit)
        bereit.remove(rad_id)
        rad = rad_nach_id[rad_id]

        # ---- Endpunkt: Station oder freier Abstellort
        # Die Website wirbt mit "Frei im Geschaeftsgebiet - ueberall in der
        # roten Umrandung, ohne Zuschlag". Freizeitfahrten enden haeufiger frei
        # als Pendelfahrten. Der Abstellort ist einer der oeffentlichen
        # Fahrradstellplaetze der Stadt in der Naehe des angesteuerten Ziels.
        p_frei = 0.30 if STATION_TYP[end_station] == "freizeit" else 0.16
        frei_abgestellt = random.random() < p_frei
        # Ist die Zielstation voll, bleibt nur das freie Abstellen. Geprueft
        # wird der Stand bei Fahrtbeginn - in zwanzig Minuten aendert er sich
        # kaum, und die Ankunftszeit steht hier noch nicht fest.
        if not frei_abgestellt and (len(an_ort[end_station])
                                    >= KAPAZITAET[end_station] * VOLL_AB):
            fehlanfrage_rows.append([startzeit.isoformat(sep=" "), end_station,
                                     "kein Platz frei"])
            frei_abgestellt = True
        end_lon = end_lat = ""
        ziel_ort = str(end_station)
        if frei_abgestellt:
            nahe = [o for o in ABSTELLORTE
                    if ROUTEN[(str(end_station), o)][0] <= FREI_ABSTELLEN_KM]
            if nahe:
                ziel_ort = random.choice(nahe)
                lat, lon = ABSTELLORT_KOORD[ziel_ort]
                end_lat, end_lon = round(lat, 6), round(lon, 6)
            else:
                frei_abgestellt = False

        # ---- Strecke und Dauer
        # Die kuerzeste Route steht in der Matrix. Wer nicht zweckgerichtet
        # faehrt, faehrt weiter als noetig - das ist die Umwegbereitschaft.
        kurz_km, steigung = strecke_und_steigung(start_station, ziel_ort)
        umweg = UMWEG_PROFIL[kundenprofil] * (1.12 if frei else 1.0)
        if STATION_TYP[end_station] == "freizeit":
            umweg *= 1.10
        strecke_km = kurz_km * umweg * random.uniform(0.94, 1.14)
        tempo = fahrtempo(rad["typ"], steigung, temp, regen, stunde, kundenprofil)
        reine_fahrzeit = strecke_km / tempo * 60
        mittel = reine_fahrzeit + HALT_GRUND_MIN + HALT_JE_KM_MIN * strecke_km
        dauer = max(2, round(random.lognormvariate(
            math.log(max(mittel, 2.0)), DAUER_STREUUNG)))
        # Die Streuung darf die Fahrt nicht schneller machen, als ein Rad faehrt.
        dauer = max(dauer, math.ceil(strecke_km / TEMPO_HOECHSTWERT * 60))
        hoehenmeter = max(0.0, steigung / 1000.0 * strecke_km * 1000.0)

        # ---- Status
        r_status = random.random()
        if r_status < 0.022:
            # Am Terminal abgebrochen: das Rad war nie wirklich unterwegs.
            status = "abgebrochen"
            dauer = random.randint(1, 3)
            end_station, ziel_ort = start_station, str(start_station)
            frei_abgestellt = False
            end_lon = end_lat = ""
            strecke_km, hoehenmeter = 0.0, 0.0
        elif r_status < 0.027:
            status = "storniert"
            dauer = random.randint(1, 2)
            end_station, ziel_ort = start_station, str(start_station)
            frei_abgestellt = False
            end_lon = end_lat = ""
            strecke_km, hoehenmeter = 0.0, 0.0
        else:
            status = "abgeschlossen"
            # Vergessene Rueckgabe: die Strecke bleibt normal, nur die Ausleihe
            # laeuft weiter. Eine Regel auf die Dauer allein wuerde auch echte
            # Tagesausfluege treffen - erst Dauer UND Strecke zusammen verraten
            # den Fall.
            if random.random() < 0.0007:
                dauer = random.randint(8 * 60, 30 * 60)
                langzeit_gesetzt += 1

        endzeit = startzeit + timedelta(minutes=int(dauer))
        # Das Rad steht ab der Rueckgabe wieder zur Verfuegung - am Zielort,
        # nicht dort, wo es gebraucht wuerde.
        rueckgabe_ort = ziel_ort if frei_abgestellt else end_station
        rueckgabe_lfd += 1
        heapq.heappush(unterwegs, (endzeit, rueckgabe_lfd, rad["id"], rueckgabe_ort))
        rad_ort.pop(rad["id"], None)

        # ---- Distanz: der Sensor meldet nur einen Teil der Fahrten
        distanz = ""
        if status == "abgeschlossen":
            if random.random() < 0.60:
                distanz = round(strecke_km, 2)
            rad["km_kumuliert"] += strecke_km
            rad["hoehenmeter"] += hoehenmeter
            # Fuer das Verschleissmodell: wann wurde wieviel gefahren und
            # wieviel davon bergauf.
            rad["verlauf"].append((d, strecke_km, hoehenmeter))
        rad["fahrten"] += 1

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

    # ---- Nachtschicht des Betreibers
    # Was bis Mitternacht zurueckkommt, wird eingebucht; danach raeumt der
    # Betreiber auf: frei stehende Raeder werden eingesammelt, ueberfuellte
    # Stationen entlastet, leere aufgefuellt. Ohne diese Umsetzfahrten liefe
    # das Netz binnen Wochen leer - genau das ist der betriebliche Aufwand,
    # den eine Standortplanung senken soll.
    mitternacht = datetime(d.year, d.month, d.day, 23, 59)
    while unterwegs and unterwegs[0][0] <= mitternacht:
        _, _, zurueck_id, zurueck_ort = heapq.heappop(unterwegs)
        if zurueck_id in ausser_dienst:
            continue
        an_ort[zurueck_ort].append(zurueck_id)
        rad_ort[zurueck_id] = zurueck_ort

    # Ueber Nacht kehrt jeder heim - mit dem Rad, zu Fuss oder mit dem Bus.
    for _k in kunden.values():
        _k["standort"] = _k["heimat"]
    eingesammelt, verschoben = ausgleichen(mitternacht, einsammeln=True)


    d += timedelta(days=1)

schreibe("fehlanfrage.csv", ["zeitpunkt", "station_id", "grund"], fehlanfrage_rows)
schreibe("umsetzfahrt.csv",
         ["zeitpunkt", "fahrrad_id", "von_ort", "nach_station_id", "art"],
         umsetzfahrt_rows)
# =====================================================================
# DAS GEPLANTE ZIEL - was der Kunde VOR der Fahrt in der App auswaehlt
# =====================================================================
#
# Warum diese Spalte existiert, und warum sie hier und nicht oben
# entsteht:
#
# Die App fragt vor dem Entsperren nach dem Ziel - erst danach kann sie
# einen Preis schaetzen. Was in den Betriebsdaten steht, ist aber das
# Ziel, an dem die Fahrt TATSAECHLICH endete. Beides faellt auseinander:
# Man aendert unterwegs die Meinung, faehrt weiter, stellt frei ab.
#
# Ohne diese Spalte laesst sich die Preisauskunft nie freigeben - man
# koennte immer nur pruefen, wie gut die Schaetzung fuer ein Ziel war,
# das die App zur Anfragezeit gar nicht kannte. Genau das war der
# Freigabeblocker in Notebook 1.
#
# ZWEI DINGE SIND DABEI EHRLICH ZU SAGEN:
#   1. Die Abweichungsquote ist eine SZENARIOANNAHME, keine Messung.
#      Im echten Betrieb muss sie protokolliert werden; hier ist sie
#      gesetzt, und die Notebooks nennen sie als solche.
#   2. Der Zufall kommt aus einem EIGENEN Generator. Der Hauptstrom
#      bleibt unberuehrt, damit alle uebrigen Spalten und alle anderen
#      Dateien Zeichen fuer Zeichen dieselben bleiben wie vorher.
# WER FREI ABSTELLT, IST TROTZDEM ANGEKOMMEN.
#
# Eine erste Fassung wertete JEDE frei abgestellte Fahrt als
# Zielabweichung. Das war falsch gedacht: Wer sein Rad hundert Meter vor
# der Station abstellt, ist dort, wo er hinwollte - und genau darauf
# kommt es an, denn der Preis haengt an der DAUER. Mit jener Fassung lag
# die Zielabweichung bei rund einem Viertel aller Fahrten; das ist fuer
# ein Produkt, dessen Preis am genannten Ziel haengt, unplausibel hoch.
#
# Richtig ist: Das geplante Ziel ist die Station, in deren Naehe die
# Fahrt endete - ob angedockt oder nicht. Eine echte Abweichung ist,
# wenn jemand unterwegs umdisponiert und woanders landet.
ZIELTREUE = 0.90          # Anteil der Fahrten, die am geplanten Ziel enden
_zrng = random.Random(20260902)
_station_ids = list(STATION_IDS)
_koord = {sid: (lat, lon) for sid, _n, _b, lat, lon, _k, _t in STATIONEN}

def _naechste_station(lat, lon):
    return min(_station_ids,
               key=lambda i: (_koord[i][0] - lat) ** 2 + (_koord[i][1] - lon) ** 2)

for _row in ausleihe_rows:
    _start, _ende, _lat, _lon = _row[3], _row[5], _row[11], _row[12]
    if _ende != "":
        _angekommen = _ende
    elif _lat not in ("", None) and _lon not in ("", None):
        _angekommen = _naechste_station(float(_lat), float(_lon))
    else:
        _angekommen = None
    if _angekommen is not None and _zrng.random() < ZIELTREUE:
        # Gefahren wie geplant. Auch eine Rundtour ist eine Absicht: Wer
        # eine Runde dreht, waehlt in der App seine Startstation als Ziel -
        # und bekommt dort keine Auskunft, weil eine Rundtour keine
        # Verbindung ist. Das ist eine Produktentscheidung, kein Datenfehler.
        _geplant = _angekommen
    else:
        # Unterwegs umdisponiert: Das geplante Ziel ist eine andere Station.
        _moeglich = [i for i in _station_ids if i != _angekommen]
        _geplant = _zrng.choice(_moeglich)
    _row.append(_geplant)

schreibe("ausleihe.csv",
         ["ausleihe_id", "kunde_id", "fahrrad_id", "start_station_id", "startzeit",
          "end_station_id", "endzeit", "status", "distanz_km", "entgelt_eur",
          "berechnete_minuten", "end_latitude", "end_longitude",
          "geplante_ziel_station_id"],
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

# VERSCHLEISS ENTSTEHT ENTLANG DER ZEIT
#
# Das Modell laeuft die Fahrten jedes Rades der Reihe nach ab. Die
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
    offene_reparaturen = []   # (erledigt_datum, restfaktor)

    for tag, km, hm in rad["verlauf"]:
        # Der Verschleiss faellt erst, wenn die Reparatur FERTIG ist - nicht
        # schon bei der Meldung. Zwischen beidem wird weitergefahren, und
        # diese Kilometer gehen weiter auf das defekte Bauteil. Genau darauf
        # beruht die Lehrgeschichte in Notebook 2: Ein Merkmal, das bei der
        # Meldung zurueckspringt, schreibt sie dem frisch reparierten Rad gut.
        # Setzte der Generator hier schon zurueck, waere seine eigene Wahrheit
        # eine andere als die, die das Notebook erklaert.
        while offene_reparaturen and offene_reparaturen[0][0] <= tag:
            _, faktor = offene_reparaturen.pop(0)
            km_seit_wartung *= faktor
        # Hoehenmeter verschleissen ueberproportional: bergauf den
        # Antrieb, bergab die Bremsen. Zehn Hoehenmeter zaehlen wie ein
        # zusaetzlicher Kilometer.
        km_seit_wartung += km + hm / 10.0
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
        # null, denn repariert wird das Defekte, nicht das ganze Rad. Wirksam
        # wird das am Tag des Abschlusses, oben in der Schleife.
        offene_reparaturen.append((erledigt.date(), random.uniform(0.05, 0.25)))
        offene_reparaturen.sort(key=lambda e: e[0])

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
