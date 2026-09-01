# -*- coding: utf-8 -*-
"""Notebook 1 - Regression: Was kostet die Fahrt zu diesem Ziel?

Vollstaendig neu gefasst am 01.09.2026. Der fruehere Ansatz - beim
Entsperren die Dauer schaetzen, ohne das Ziel zu kennen - ist ersatzlos
entfallen. Der Grund steht im Notebook selbst und traegt den ganzen Fall:
Ein Modell, das die Fahrtdauer ohne Ziel schaetzt, sagt etwas voraus, das
der Nutzer besser weiss.
"""
from bauwerk import CODE, MD, PHASE, kopf

NAME = "01_Regression_Fahrtdauer"

ZELLEN = [

kopf("Regression: Was kostet die Fahrt zu diesem Ziel?",
     "Regression (überwachtes Lernen, Zielgröße ist eine Zahl)",
     "Können wir dem Kunden vor der Fahrt sagen, was sie kosten wird?",
     NAME),

MD("""
## Der Einwand, mit dem dieses Notebook anfängt

Die naheliegende Idee lautet: Beim Entsperren schätzt ein Modell die Fahrtdauer, das
Tarifblatt macht daraus einen Preis, die App zeigt ihn an.

Diese Idee hat einen Fehler, und zwar keinen technischen.

> **Der Nutzer weiß besser als jedes Modell, wie lange er fahren wird.** Er kennt sein
> Ziel, er weiß, ob er es eilig hat, und er weiß, ob er unterwegs anhält.

Ein Modell, das beim Entsperren nur Startstation, Uhrzeit und Wetter kennt, kann zwei
Fahrten nicht unterscheiden, die gleich beginnen und völlig verschieden verlaufen: acht
Minuten zum Bahnhof gegen neunzig Minuten die Mainpromenade entlang. Es sagt für beide
dasselbe.

Das ist kein Problem des Verfahrens, sondern ein Informationsproblem: Was vorhergesagt
werden soll, steckt nicht in den Merkmalen.

**Also ändern wir nicht das Verfahren, sondern den Prozess.** Der Nutzer wählt in der App
sein Ziel, und *erst danach* rechnet das Modell. Jetzt weiß es, worüber es spricht — und
sagt etwas, das der Nutzer tatsächlich nicht weiß: wie lange diese Verbindung unter
diesen Umständen erfahrungsgemäß dauert.

Diese Verschiebung hat eine Folge, die uns in Phase 3 wieder begegnet:

> Ob ein Merkmal verwendet werden darf, entscheidet nicht sein Spaltenname, sondern der
> **Zeitpunkt, zu dem es im Prozess entsteht**. Ändert man den Prozess, ändert sich die
> Antwort.
"""),

PHASE(1, "Aus „der Kunde soll den Preis vorher kennen“ wird eine Zahl mit einer Grenze."),

MD("""
### Die Ausgangslage

VeloCity zeigt vor der Fahrt keinen Preis. Der Tarif steht auf der Website — Startgebühr,
Minutenpreis, Tageshöchstpreis —, aber was die konkrete Fahrt kostet, sieht man erst auf
der Rechnung. Der Kundenservice meldet das als häufigste Rückfrage.

### Der Geschäftsprozess, den wir voraussetzen

```text
Kunde öffnet die App an einer Station    →  Startstation steht fest
Kunde wählt sein Ziel auf der Karte      →  Zielstation steht fest
Kunde tippt auf „Preis schätzen“         →  Modell rechnet
App zeigt den erwarteten Preis           →  Kunde entscheidet
```

Der dritte Schritt ist der Kern: Das Modell wird **nicht** beim Öffnen der App aufgerufen,
sondern erst, wenn die geplante Fahrt bekannt ist.

### Das analytische Ziel

Geschätzt wird die **Dauer in Minuten**, nicht der Preis. Der Preis folgt daraus über das
Tarifblatt, und das ist exakt bekannt.

> **Man schätzt nie, was man ausrechnen kann.** Ein Modell auf den Preis anzusetzen hieße,
> Unsicherheit dort zu erzeugen, wo Gewissheit herrscht.

### Das Erfolgskriterium — festgelegt, bevor wir die Daten ansehen

| | |
|---|---|
| **fachlich** | Der angezeigte Preis liegt im Mittel weniger als **50 Cent** neben dem tatsächlichen |
| **Herkunft** | Grenze aus dem Produktmanagement |
| **gemessen auf** | einem Zeitraum, den das Modell beim Training nie gesehen hat |

Diese Grenze wird nicht verhandelt, nachdem das Ergebnis vorliegt. Reißt sie, ist das ein
Ergebnis — kein Anlass, sie zu lockern.

### Der Geltungsbereich

Zwei Einschränkungen gehören hierher, nicht in eine Fußnote am Ende:

1. **Nur Fahrten von Station zu Station.** Wer sein Rad frei im Geschäftsgebiet abstellt,
   hat kein Ziel gewählt. Wie groß dieser Anteil ist, sehen wir gleich.
2. **Nur reguläre Fahrten bis acht Stunden.** Alles darüber ist keine Fahrt, sondern eine
   vergessene Rückgabe — ein eigener Geschäftsfall, kein Ausreißer zum Wegwerfen.
"""),

CODE("""
import os
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt

BASIS = os.environ.get("VELO_BASIS",
    "https://raw.githubusercontent.com/swrobuts/velocity-fallstudie/main/analytics/")

ausleihe = pd.read_csv(BASIS + "ausleihe.csv", parse_dates=["startzeit", "endzeit"])
station  = pd.read_csv(BASIS + "station.csv")
fahrrad  = pd.read_csv(BASIS + "fahrrad.csv")
wetter   = pd.read_csv(BASIS + "wetter.csv", parse_dates=["datum"])
feiertag = pd.read_csv(BASIS + "feiertage.csv", parse_dates=["datum"])
schulfrei = pd.read_csv(BASIS + "schulferien.csv", parse_dates=["von", "bis"])
preise   = pd.read_csv(BASIS + "nutzungspreis.csv")

print(f"{len(ausleihe):,} Fahrten, {len(station)} Stationen, {len(fahrrad)} Räder")
print()
print("Das Tarifblatt - exakt bekannt, nichts daran wird geschätzt:")
print(preise.to_string(index=False))
"""),

PHASE(2, "Für wie viele Fahrten gilt die neue Frage überhaupt — und was erklärt die Verbindung?"),

MD("""
### 2.1 Für wie viele Fahrten gibt es ein Ziel?

Die erste Frage an die Daten ist keine statistische, sondern eine des Geltungsbereichs.
Die Website wirbt damit, dass man das Rad überall im Geschäftsgebiet abstellen darf.
Genau diese Fahrten haben keine Zielstation.
"""),

CODE("""
ausleihe["dauer_min"] = (ausleihe.endzeit - ausleihe.startzeit).dt.total_seconds() / 60
regulaer = ausleihe[(ausleihe.dauer_min >= 1) & (ausleihe.dauer_min <= 8 * 60)]

mit_ziel  = int(regulaer.end_station_id.notna().sum())
ohne_ziel = int(regulaer.end_station_id.isna().sum())

print(f"reguläre Fahrten (1 Min bis 8 Std): {len(regulaer):,}")
print(f"   endet an einer Station:          {mit_ziel:,}  ({mit_ziel/len(regulaer):.1%})")
print(f"   endet frei im Geschäftsgebiet:   {ohne_ziel:,}  ({ohne_ziel/len(regulaer):.1%})")
print()
print("Die zweite Gruppe ist kein Datenfehler, sondern ein beworbenes")
print("Produktmerkmal. Für sie gilt die neue Geschäftsfrage nicht.")
"""),

MD("""
Gut ein Fünftel aller Fahrten fällt aus dem Geltungsbereich. Das gehört offen gesagt: Die
Preisschätzung wird von vornherein nicht für alle Kunden funktionieren.

### 2.2 Rundtouren — dieselbe Verbindung, jede Dauer

Unter den Fahrten mit Ziel gibt es eine Gruppe, bei der die Zielstation nichts erklärt:
Fahrten, die dort enden, wo sie begonnen haben.
"""),

CODE("""
mz = regulaer[regulaer.end_station_id.notna()].copy()
mz["end_station_id"] = mz.end_station_id.astype(int)
mz["ist_rundtour"] = (mz.start_station_id == mz.end_station_id).astype(int)

for name, gruppe in (("Rundtour (Start = Ziel)", mz[mz.ist_rundtour == 1]),
                     ("echter Weg", mz[mz.ist_rundtour == 0])):
    q1, q3 = gruppe.dauer_min.quantile([.25, .75])
    print(f"{name:24} n = {len(gruppe):>6,}   Median {gruppe.dauer_min.median():5.1f} Min"
          f"   mittlere Hälfte {q1:4.0f} bis {q3:4.0f} Min")

print(f"\\nRundtouren sind {mz.ist_rundtour.mean():.1%} der Fahrten mit Ziel.")
print("Bei ihnen ist das Ziel gleich dem Start - es trägt per Definition")
print("keine Information über die Dauer bei. Und sie streuen doppelt so stark.")
"""),

MD("""
Merken Sie sich diese Gruppe. Sie wird in Phase 5 zur entscheidenden Größe.

### 2.3 Was die Verbindung erklärt — ein erster Blick

Bevor wir modellieren, eine einfache Frage: Wie viel sagt allein das Wissen, *welche
Verbindung* gefahren wird, über die Dauer? Drei Nachschlagetabellen, je eine Zeile Code.
"""),

CODE("""
namen = station.set_index("station_id").name
mz["start_name"] = mz.start_station_id.map(namen)
mz["ziel_name"]  = mz.end_station_id.map(namen)
mz["route"]      = mz.start_name + " → " + mz.ziel_name

def mittlerer_fehler(vorhersage):
    return (mz.dauer_min - vorhersage).abs().mean()

print("Mittlerer absoluter Fehler, wenn man nur den Median nimmt:")
print(f"   ... aller Fahrten:      {mittlerer_fehler(mz.dauer_min.median()):5.2f} Min")
print(f"   ... je Startstation:    "
      f"{mittlerer_fehler(mz.groupby('start_name').dauer_min.transform('median')):5.2f} Min")
print(f"   ... je Verbindung:      "
      f"{mittlerer_fehler(mz.groupby('route').dauer_min.transform('median')):5.2f} Min")
print(f"\\n{mz.route.nunique()} verschiedene Verbindungen, im Median "
      f"{mz.route.value_counts().median():.0f} Fahrten je Verbindung")
"""),

MD("""
Ein wichtiger Befund, und er fällt bescheidener aus als erwartet: Die Zielstation
verbessert die Schätzung gegenüber der Startstation allein nur um etwa eine Fünftel
Minute. Der große Sprung liegt zwischen „nichts wissen“ und „die Startstation kennen“ —
nicht zwischen Start und Ziel.

Das ist kein Grund aufzuhören, aber ein Grund, in Phase 4 eine **Verbindungs-Baseline**
mitlaufen zu lassen, gegen die sich jedes Modell behaupten muss.
"""),

CODE("""
fig, achsen = plt.subplots(1, 2, figsize=(13, 4.2))

achsen[0].hist(mz.dauer_min, bins=80, range=(0, 120), color="#003E6E")
achsen[0].axvline(mz.dauer_min.median(), color="#BE2344", lw=2,
                  label=f"Median {mz.dauer_min.median():.0f} Min")
achsen[0].set_title("Fahrtdauer — rechtsschief, langer Ausläufer")
achsen[0].set_xlabel("Minuten"); achsen[0].set_ylabel("Fahrten"); achsen[0].legend()

oben = mz.groupby("route").dauer_min.agg(["median", "count"])
oben = oben[oben["count"] >= 200].sort_values("median").tail(12)
achsen[1].barh(range(len(oben)), oben["median"], color="#4AB5C4")
achsen[1].set_yticks(range(len(oben)))
achsen[1].set_yticklabels([r[:32] for r in oben.index], fontsize=8)
achsen[1].set_title("Die zwölf längsten Verbindungen (Median)")
achsen[1].set_xlabel("Minuten")
plt.tight_layout(); plt.show()
"""),

MD("""
Links die Zielgröße: stark rechtsschief. Deshalb nehmen wir gleich den **Median** als
Nullmodell und nicht den Mittelwert — für den mittleren absoluten Fehler ist der Median
die beste konstante Vorhersage.

Rechts das Muster, das dieses Notebook trägt: Die langen Verbindungen führen zum Käppele
und in den Ringpark — Ausflugsziele. Die kurzen verbinden Bahnhof, Klinikum und Campus —
Pendelwege.
"""),

PHASE(3, "Welche Merkmale sind zum Zeitpunkt der Anzeige verfügbar — und welche nicht?"),

MD("""
### 3.1 Der Leakage-Test, neu beantwortet

Leakage heißt: ein Merkmal verwenden, das es zum Vorhersagezeitpunkt noch gar nicht gibt.
Das Modell wird großartig und im Betrieb unbrauchbar.

Der Test ist keine Statistik, sondern eine Frage an den Prozess: **Was steht in dem
Moment zur Verfügung, in dem die Anzeige erscheinen soll?**

| Spalte | verfügbar? | warum |
|---|---|---|
| `start_station_id` | ja | der Kunde steht dort |
| `end_station_id` | **ja** | **der Kunde hat sein Ziel gewählt — das ist der ganze Punkt** |
| `startzeit` | ja | jetzt |
| Wetter, Kalender | ja | bekannt |
| `typ_code` | ja | das Rad steht vor ihm |
| `endzeit` | nein | entsteht erst am Ende der Fahrt |
| `dauer_min` | nein | das ist die Zielgröße |
| `distanz_km` | nein | wird während der Fahrt gemessen |
| `entgelt_eur` | nein | wird nach der Fahrt berechnet |

Die zweite Zeile ist die interessante. Im ursprünglichen Prozess — Anzeige beim Entsperren,
ohne Zielauswahl — wäre die Zielstation Leakage gewesen. Im neuen Prozess ist sie eine
Eingabe des Kunden.

> **Dieselbe Spalte, dieselben Daten, gegenteiliges Urteil.** Was den Unterschied macht,
> ist allein der Prozess, in dem das Modell läuft.
"""),

CODE("""
# AUFGABE: Tragen Sie die Spalten ein, die NICHT ins Modell dürfen.
# Prüfen Sie jede Spalte mit der Frage: Existiert dieser Wert schon,
# wenn der Kunde auf "Preis schätzen" tippt?
##LUECKE Welche vier Spalten entstehen erst während oder nach der Fahrt?
gesperrt = ["endzeit", "dauer_min", "distanz_km", "entgelt_eur"]
##ENDE

print("Gesperrt, weil zum Vorhersagezeitpunkt nicht vorhanden:")
for s in gesperrt:
    print(f"   {s}")
print()
print("Ausdrücklich ERLAUBT, obwohl es nach 'Ende' klingt: end_station_id.")
print("Der Kunde hat sie ausgewählt, bevor gerechnet wird.")
"""),

MD("""
### 3.2 Filtern, mit Zeilenzahl davor und danach

Jeder Filter wird gezählt. Ein Filter ohne Zeilenzahl ist eine Behauptung.
"""),

CODE("""
n0 = len(ausleihe)
schritte = [("Rohdaten", n0)]

d = ausleihe[ausleihe.dauer_min >= 1]
schritte.append(("mindestens 1 Minute (Fehlentsperrungen raus)", len(d)))

d = d[d.dauer_min <= 8 * 60]
schritte.append(("höchstens 8 Stunden (vergessene Rückgaben raus)", len(d)))

d = d[d.end_station_id.notna()].copy()
schritte.append(("endet an einer Station (Geltungsbereich)", len(d)))

for name, n in schritte:
    print(f"   {name:48} {n:>7,}")
print(f"\\n   Verbleiben {len(d)/n0:.1%} der Rohdaten.")
print(f"   Der größte Einzelschritt ist der Geltungsbereich, nicht die Bereinigung.")
"""),

MD("""
### 3.3 Merkmale der geplanten Fahrt bauen

Drei Gruppen: die Verbindung, der Zeitpunkt, das Wetter. Dazu ein Merkmal, das sich aus
den Stationskoordinaten ergibt und auch für **neue** Verbindungen funktioniert.
"""),

CODE("""
d["end_station_id"] = d.end_station_id.astype(int)
d = d.merge(fahrrad[["fahrrad_id", "typ_code"]], on="fahrrad_id", how="left")

koord = station.set_index("station_id")
for rolle, spalte in (("start", "start_station_id"), ("ziel", "end_station_id")):
    d[f"{rolle}_lat"]  = d[spalte].map(koord.latitude)
    d[f"{rolle}_lon"]  = d[spalte].map(koord.longitude)
    d[f"{rolle}_name"] = d[spalte].map(koord.name)

# Luftlinie nach Haversine. Anders als ein Routen-Kürzel funktioniert sie
# auch für eine Verbindung, die im Training nie vorkam - wichtig, sobald
# eine neue Station ans Netz geht.
R = 6371.0
p1, p2 = np.radians(d.start_lat), np.radians(d.ziel_lat)
dl = np.radians(d.ziel_lon - d.start_lon)
h = np.sin((p2 - p1) / 2) ** 2 + np.cos(p1) * np.cos(p2) * np.sin(dl / 2) ** 2
d["luftlinie_km"] = 2 * R * np.arcsin(np.sqrt(h))

d["route"] = d.start_name + " → " + d.ziel_name
d["ist_rundtour"] = (d.start_station_id == d.end_station_id).astype(int)

d["datum"]  = d.startzeit.dt.normalize()
d["stunde"] = d.startzeit.dt.hour
d["wochentag"] = d.startzeit.dt.dayofweek
d["ist_wochenende"] = (d.wochentag >= 5).astype(int)
d["monat"] = d.startzeit.dt.month
d = d.merge(wetter[["datum", "temp_mittel_c", "niederschlag_mm"]], on="datum", how="left")
d["ist_feiertag"] = d.datum.isin(feiertag.datum).astype(int)
in_ferien = pd.Series(False, index=d.index)
for _, z in schulfrei.iterrows():
    in_ferien |= (d.datum >= z.von) & (d.datum <= z.bis)
d["ist_ferien"] = in_ferien.astype(int)

print(f"{len(d):,} Fahrten, {d.route.nunique()} Verbindungen")
print(f"Luftlinie: {d.luftlinie_km.min():.2f} bis {d.luftlinie_km.max():.2f} km")
print(f"   (0,00 km sind die Rundtouren - Start und Ziel fallen zusammen)")
"""),

MD("""
### 3.4 Aufteilen — entlang der Zeit, in drei Teile

Hier liegt der wichtigste methodische Unterschied zu einem Lehrbuchbeispiel. Wir teilen
**dreifach**:

| Teil | wofür | Regel |
|---|---|---|
| **Training** | das Modell lernt | die ältesten Fahrten |
| **Validierung** | wir *wählen* Verfahren und Einstellungen | mittlerer Zeitraum |
| **Holdout** | wir *messen* das Ergebnis — genau einmal | die jüngsten Fahrten |

Warum drei statt zwei? Wer mehrere Modelle auf derselben Menge vergleicht und dann das
beste auf ebendieser Menge bewertet, hat sie zur Auswahl benutzt. Die Zahl, die dabei
herauskommt, ist zu optimistisch — man hat sich das beste Ergebnis ausgesucht.

Und warum entlang der Zeit statt zufällig? Weil der Betrieb so aussieht: Aus der
Vergangenheit werden künftige Fahrten prognostiziert. Ein zufälliger Schnitt ließe das
Modell aus Wochen lernen, die zum Zeitpunkt der Vorhersage noch gar nicht stattgefunden
haben.
"""),

CODE("""
d = d.sort_values("startzeit").reset_index(drop=True)
g_val  = d.startzeit.quantile(0.70)
g_hold = d.startzeit.quantile(0.85)

training    = d[d.startzeit <  g_val]
validierung = d[(d.startzeit >= g_val) & (d.startzeit < g_hold)]
holdout     = d[d.startzeit >= g_hold]

for name, teil in (("Training", training), ("Validierung", validierung),
                   ("Holdout", holdout)):
    print(f"{name:12} {len(teil):>7,} Fahrten   "
          f"{teil.startzeit.min():%d.%m.%Y} bis {teil.startzeit.max():%d.%m.%Y}")
print()
print("Der Holdout wird ab jetzt NICHT mehr angefasst - bis Phase 5.")
"""),

PHASE(4, "Verdient ein Modell seinen Unterhalt gegenüber einer Nachschlagetabelle?"),

MD("""
### 4.1 Vier Baselines, bevor ein Modell gerechnet wird

Ein Modell ist nur dann gerechtfertigt, wenn es etwas schlägt, das ohne Modell zu haben
wäre. Vier Kandidaten, aufsteigend nach dem, was sie wissen:

| | weiß | Aufwand |
|---|---|---|
| A | nichts — der Median aller Fahrten | eine Zeile |
| B | den Radtyp | eine Zeile |
| C | die Startstation | eine Zeile |
| D | **die Verbindung** | eine Zeile |

Baseline D ist der eigentliche Gegner: Sie verkörpert die Aussage *„Für Hauptbahnhof →
Hubland brauchen die Leute normalerweise acht Minuten.“* Wenn ein Random Forest das kaum
schlägt, ist das ein Ergebnis — und kein gutes für den Random Forest.
"""),

CODE("""
from sklearn.metrics import mean_absolute_error, median_absolute_error

median_gesamt = training.dauer_min.median()
tabelle = [("A  Median aller Fahrten",
            mean_absolute_error(validierung.dauer_min,
                                np.full(len(validierung), median_gesamt)))]

# AUFGABE: Bauen Sie die Baselines B, C und D. Der Median wird IMMER auf
# dem Training gebildet und auf die Validierung angewandt - nie umgekehrt.
##LUECKE Ergänzen Sie die drei Gruppierungsspalten.
for beschriftung, spalte in (("B  Median je Radtyp", "typ_code"),
                             ("C  Median je Startstation", "start_name"),
                             ("D  Median je Verbindung", "route")):
##ENDE
    med = training.groupby(spalte).dauer_min.median()
    vorhersage = validierung[spalte].map(med).fillna(median_gesamt)
    tabelle.append((beschriftung, mean_absolute_error(validierung.dauer_min, vorhersage)))

for name, fehler in tabelle:
    print(f"{name:30} MAE {fehler:5.2f} Min")
print()
print(f"Vom Nichtwissen zur Startstation: {tabelle[0][1] - tabelle[2][1]:.2f} Min gewonnen.")
print(f"Von der Startstation zum Ziel:    {tabelle[2][1] - tabelle[3][1]:.2f} Min gewonnen.")
"""),

MD("""
Der zweite Satz ist die Zahl, um die es geht. Das Ziel — die neue Produktidee, der ganze
Umbau — bringt gegenüber der Startstation allein wenige Zehntelminuten.

Wir bauen das Modell trotzdem, aber jetzt mit einer klaren Messlatte: Es muss Baseline D
deutlich schlagen, sonst liefern wir die Nachschlagetabelle aus.

### 4.2 Eine Pipeline, damit im Betrieb nichts auseinanderfällt

Die Kodierung der Kategorien gehört **in** das Modell, nicht daneben. Sonst passiert im
Betrieb genau das, was am teuersten ist: Eine unbekannte Station erzeugt lauter Nullen,
das Modell rechnet klaglos weiter und liefert Unsinn.
"""),

CODE("""
from sklearn.compose import ColumnTransformer
from sklearn.dummy import DummyRegressor
from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import LinearRegression
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder
from sklearn.tree import DecisionTreeRegressor

KATEGORIAL = ["start_name", "ziel_name", "route", "typ_code"]
NUMERISCH  = ["luftlinie_km", "ist_rundtour", "stunde", "wochentag",
              "ist_wochenende", "monat", "temp_mittel_c", "niederschlag_mm",
              "ist_feiertag", "ist_ferien"]
MERKMALE = KATEGORIAL + NUMERISCH

def pipeline(modell, drop=None):
    # handle_unknown="ignore": eine unbekannte Station wirft keinen Fehler.
    # drop="first": eine Referenzkategorie je Merkmal entfällt, sonst sind
    # die Koeffizienten des linearen Modells nicht eindeutig.
    return Pipeline([
        ("aufbereiten", ColumnTransformer([
            ("kategorial", OneHotEncoder(handle_unknown="ignore", drop=drop), KATEGORIAL),
            ("numerisch", "passthrough", NUMERISCH)])),
        ("modell", modell)])

modelle = {
    "Nullmodell (Median)":       pipeline(DummyRegressor(strategy="median")),
    "Lineare Regression":        pipeline(LinearRegression(), drop="first"),
    "Entscheidungsbaum (T=10)":  pipeline(DecisionTreeRegressor(max_depth=10, random_state=42)),
    "Random Forest (200 Bäume)": pipeline(RandomForestRegressor(
        n_estimators=200, min_samples_leaf=5, random_state=42, n_jobs=-1)),
}

guete = {}
for name, mp in modelle.items():
    mp.fit(training[MERKMALE], training.dauer_min)
    v = mp.predict(validierung[MERKMALE])
    guete[name] = (mean_absolute_error(validierung.dauer_min, v),
                   median_absolute_error(validierung.dauer_min, v))
    print(f"{name:28} MAE {guete[name][0]:5.2f} Min   Median-Fehler {guete[name][1]:5.2f} Min")

bestes = min(guete, key=lambda k: guete[k][0])
print(f"\\nAuf der VALIDIERUNG gewählt: {bestes}")
print(f"Baseline D lag bei {tabelle[3][1]:.2f} Min - das Modell ist "
      f"{1 - guete[bestes][0]/tabelle[3][1]:.0%} besser.")
"""),

MD("""
Das Modell schlägt die Verbindungs-Baseline deutlich. Es hat also etwas gelernt, das über
„typische Dauer dieser Strecke“ hinausgeht — vermutlich das Zusammenspiel von Uhrzeit,
Wochentag und Verbindung.

**Die Wahl ist damit gefallen.** Sie ist auf der Validierung gefallen, nicht auf dem
Holdout. Was jetzt kommt, ist eine Messung, keine Auswahl mehr.
"""),

PHASE(5, "Reicht das für die Preisanzeige? Gemessen auf einem Zeitraum, den niemand gesehen hat."),

MD("""
### 5.1 Der Holdout, einmal

Das gewählte Verfahren wird auf Training **und** Validierung neu trainiert — beide liegen
in der Vergangenheit des Holdouts, also ist das zulässig — und einmal auf dem Holdout
gemessen.
"""),

CODE("""
lernmenge = pd.concat([training, validierung])
final = modelle[bestes]
final.fit(lernmenge[MERKMALE], lernmenge.dauer_min)

pruef = holdout.copy()
pruef["dauer_geschaetzt"] = np.maximum(1.0, final.predict(holdout[MERKMALE]))

mae_holdout = mean_absolute_error(pruef.dauer_min, pruef.dauer_geschaetzt)
med_route = lernmenge.groupby("route").dauer_min.median()
basis_d = pruef.route.map(med_route).fillna(median_gesamt)

print(f"Random Forest auf dem Holdout : MAE {mae_holdout:5.2f} Min")
print(f"Baseline D auf dem Holdout    : MAE "
      f"{mean_absolute_error(pruef.dauer_min, basis_d):5.2f} Min")
print(f"auf der Validierung waren es  : MAE {guete[bestes][0]:5.2f} Min")
print()
print(f"Der ehrliche Wert ist {mae_holdout/guete[bestes][0] - 1:.0%} schlechter als der,")
print("mit dem wir das Modell ausgewählt haben. Genau dafür gibt es den Holdout.")
"""),

MD("""
Dieser Sprung ist der wichtigste Satz der Phase. Ein zufälliger Schnitt hätte ihn
verdeckt: Er hätte Fahrten aus demselben Sommer ins Training gelegt, aus dem er dann
prüft.

### 5.2 Von Minuten zu Euro — mit der vollen Tariflogik

Jetzt wird die Zahl in die Währung aus Phase 1 übersetzt. Und zwar richtig: Der Preis ist
nicht Minuten mal Minutenpreis. Er ist Startgebühr **plus** Minutenpreis, **gedeckelt**
auf den Tageshöchstpreis. Ist- und Schätzpreis werden je Fahrt getrennt gerechnet und
dann verglichen.
"""),

CODE("""
tarif = preise.set_index("typ_code")

def fahrpreis(minuten, typ):
    z = tarif.loc[typ]
    roh = z.startgebuehr_eur + np.maximum(0.0, minuten) * z.preis_pro_minute_eur
    return float(min(roh, z.tageshoechstpreis_eur))

# AUFGABE: Berechnen Sie Ist- und Schätzpreis je Fahrt und daraus den
# Betrag der Abweichung. Achtung: NICHT die Minutendifferenz mal Preis -
# wegen des Tagesdeckels ist der Zusammenhang nicht überall linear.
##LUECKE Drei Zeilen: p_ist, p_geschaetzt, preisfehler.
pruef["p_ist"] = [fahrpreis(m, t) for m, t in zip(pruef.dauer_min, pruef.typ_code)]
pruef["p_geschaetzt"] = [fahrpreis(m, t) for m, t in zip(pruef.dauer_geschaetzt, pruef.typ_code)]
pruef["preisfehler"] = (pruef.p_geschaetzt - pruef.p_ist).abs()
##ENDE

print(f"{'Radtyp':8} {'n':>6} {'Fahrt kostet':>13} {'Abweichung':>12} "
      f"{'davon unter':>13} {'Kriterium':>12}")
print(f"{'':8} {'':>6} {'im Schnitt':>13} {'im Schnitt':>12} {'0,50 €':>13} {'':>12}")
for t, g in pruef.groupby("typ_code"):
    pf = g.preisfehler.mean()
    print(f"{t:8} {len(g):>6,} {g.p_ist.mean():>12.2f} € {pf:>11.2f} € "
          f"{(g.preisfehler < 0.50).mean():>12.0%} "
          f"{'erfüllt' if pf < 0.50 else 'gerissen':>12}")
print(f"\\ninsgesamt: {pruef.preisfehler.mean():.2f} € - die Grenze lag bei 0,50 €.")
"""),

MD("""
### 5.3 Das Urteil

Die Grenze aus Phase 1 ist für **jeden** Radtyp gerissen. Das ist ein klares Ergebnis, und
es wird nicht dadurch besser, dass man die Grenze nachträglich anhebt.

Bevor wir daraus etwas folgern, zwei Fragen, die man sich in dieser Lage immer stellen
sollte.
"""),

CODE("""
pruef["abweichung"] = pruef.p_geschaetzt - pruef.p_ist   # mit Vorzeichen

print("Frage 1: Schätzen wir systematisch zu hoch oder zu niedrig?")
for t, g in pruef.groupby("typ_code"):
    print(f"   {t:8} mittlere Abweichung {g.abweichung.mean():+6.2f} €   "
          f"zu hoch bei {(g.abweichung > 0).mean():.0%} der Fahrten")
print("   -> Nein. Über- und Unterschätzung heben sich fast auf.")
print("      Es gibt keinen Aufschlag, den man herausrechnen könnte.")

print("\\nFrage 2: Ist das Modell für teure Räder schlechter?")
for t, g in pruef.groupby("typ_code"):
    print(f"   {t:8} Abweichung {g.preisfehler.mean():5.2f} € bei einem Fahrpreis von "
          f"{g.p_ist.mean():6.2f} €  =  {g.preisfehler.mean()/g.p_ist.mean():.0%}")
print("   -> Nein. Relativ zum Fahrpreis ist die Abweichung überall ähnlich.")
print("      Was sich unterscheidet, ist die Strenge einer festen 50-Cent-Grenze.")
"""),

MD("""
Beide Antworten sind wichtig für die Deutung:

- Die Schätzung ist **nicht verzerrt**. Sie liegt mal darüber, mal darunter.
- Das Modell ist für alle Radtypen **relativ gleich gut**. Beim Lastenrad wirkt es nur
  deshalb schlechter, weil 50 Cent bei einem Fahrpreis von 15 Euro eine sehr viel engere
  Vorgabe sind als bei zwei Euro.

Was die Grenze reißt, ist also nicht ein Fehler in eine Richtung, sondern die **Streuung
der einzelnen Fahrt**. Die Frage ist damit: Woher kommt diese Streuung?

### 5.4 Fehleranalyse — wo genau irrt das Modell?
"""),

CODE("""
print("Rundtouren gegen echte Wege:")
for name, g in (("Rundtour", pruef[pruef.ist_rundtour == 1]),
                ("echter Weg", pruef[pruef.ist_rundtour == 0])):
    print(f"   {name:12} n={len(g):>6,}  "
          f"MAE {mean_absolute_error(g.dauer_min, g.dauer_geschaetzt):5.2f} Min   "
          f"Abweichung {g.preisfehler.mean():5.2f} €")

print("\\nDie fünf treffsichersten und die fünf schwierigsten Verbindungen (CITY):")
c = pruef[(pruef.typ_code == "CITY") & (pruef.ist_rundtour == 0)]
je_route = c.groupby("route").agg(
    n=("dauer_min", "size"), median_ist=("dauer_min", "median"),
    q1=("dauer_min", lambda s: s.quantile(.25)),
    q3=("dauer_min", lambda s: s.quantile(.75)),
    fehler=("preisfehler", "median")).query("n >= 40").sort_values("fehler")
for r, z in pd.concat([je_route.head(5), je_route.tail(5)]).iterrows():
    print(f"   {r[:38]:38} {z.median_ist:4.0f} Min "
          f"(mittlere Hälfte {z.q1:3.0f}-{z.q3:3.0f})  Abweichung {z.fehler:5.2f} €")
"""),

MD("""
Damit ist das Muster klar, und es ist kein statistisches, sondern ein menschliches:

> **Das Modell ist genau, wo gefahren wird, um anzukommen — und ungenau, wo gefahren
> wird, um zu fahren.**

Auf den Pendelverbindungen liegt die Anzeige um wenige Cent daneben, und die tatsächlichen
Fahrten streuen nur um zwei, drei Minuten. Auf den Verbindungen zum Käppele und in den
Ringpark liegt sie um mehr als einen halben Euro daneben, weil die Leute dort zwischen
zwanzig und vierzig Minuten unterwegs sind — je nachdem, ob sie eine Pause machen.

Kein Merkmal der Welt kann diesen Unterschied auflösen. Ob jemand am Aussichtspunkt
anhält, steht in keiner Tabelle.

### 5.5 Der Rücksprung — zurück nach Phase 1

Wir haben drei Möglichkeiten:

1. **Grenze lockern.** Verboten. Sie kam aus dem Produktmanagement, nicht aus den Daten.
2. **Besseres Modell suchen.** Aussichtslos. Die Information fehlt in den Daten, nicht im
   Verfahren.
3. **Die Zusage ändern.** Statt einer Zahl, die Genauigkeit vortäuscht, eine **Spanne**,
   die die tatsächliche Streuung abbildet.

Der dritte Weg ist der ehrliche. Er ändert nicht das Verfahren — eine Quantilregression
ist weiterhin Regression —, sondern das, was die App verspricht.

**Neues Erfolgskriterium, wieder vor der Messung festgelegt:**

| | |
|---|---|
| **trifft** | Die angezeigte Spanne enthält den tatsächlichen Preis in mindestens **80 %** der Fälle |
| **nützt** | Die Spanne ist höchstens **1,00 €** breit — sonst zeigt die App keinen Preis, sondern einen Hinweis |

Der zweite Punkt ist der eigentliche Fortschritt. Er macht aus einer Ja-Nein-Entscheidung
über das ganze Produkt eine Entscheidung **je Verbindung**.
"""),

CODE("""
from sklearn.ensemble import GradientBoostingRegressor

echte_wege = lernmenge[lernmenge.ist_rundtour == 0]
hold_wege  = pruef[pruef.ist_rundtour == 0].copy()

unten = pipeline(GradientBoostingRegressor(loss="quantile", alpha=0.10, random_state=42))
oben  = pipeline(GradientBoostingRegressor(loss="quantile", alpha=0.90, random_state=42))
unten.fit(echte_wege[MERKMALE], echte_wege.dauer_min)
oben.fit(echte_wege[MERKMALE], echte_wege.dauer_min)

hold_wege["min_min"] = np.maximum(1.0, unten.predict(hold_wege[MERKMALE]))
hold_wege["max_min"] = oben.predict(hold_wege[MERKMALE])

# Die Nachschlagetabelle als Gegner - diesmal für Spannen.
p10 = echte_wege.groupby("route").dauer_min.quantile(.10)
p90 = echte_wege.groupby("route").dauer_min.quantile(.90)
hold_wege["basis_min"] = hold_wege.route.map(p10)
hold_wege["basis_max"] = hold_wege.route.map(p90)

# AUFGABE: Wie oft liegt die tatsächliche Dauer INNERHALB der Spanne?
##LUECKE Berechnen Sie die Abdeckung für beide Verfahren.
def abdeckung(u, o):
    return ((hold_wege.dauer_min >= hold_wege[u]) & (hold_wege.dauer_min <= hold_wege[o])).mean()
##ENDE

print(f"{'Verfahren':32} {'Abdeckung':>10} {'Breite (Median)':>17}")
for name, u, o in (("Quantilregression", "min_min", "max_min"),
                   ("Perzentile der Verbindung", "basis_min", "basis_max")):
    print(f"{name:32} {abdeckung(u, o):>9.1%} "
          f"{(hold_wege[o] - hold_wege[u]).median():>13.1f} Min")
print("\\nZiel waren 80 % Abdeckung - beide erreichen das.")
print("Und wieder hält die Nachschlagetabelle mit dem Verfahren mit.")
"""),

MD("""
Zum zweiten Mal in diesem Notebook liegt eine Tabelle aus der Historie gleichauf mit einem
Verfahren. Das ist kein Zufall und keine Schwäche der Implementierung: Wenn die Streuung
einer Verbindung im Wesentlichen davon abhängt, *welche* Verbindung es ist, dann steckt
die Antwort schon in der Verteilung dieser Verbindung.

Wir liefern trotzdem die Quantilregression aus, aber aus einem Grund, der nichts mit
Genauigkeit zu tun hat: Sie kann für eine **neue** Verbindung über Luftlinie und Radtyp
eine Spanne bilden. Die Nachschlagetabelle kann das nicht — sie hätte für eine neue
Station keine Zeile.
"""),

CODE("""
def preis_spanne(zeile):
    return (fahrpreis(zeile.min_min, zeile.typ_code),
            fahrpreis(zeile.max_min, zeile.typ_code))

spannen = hold_wege.apply(preis_spanne, axis=1, result_type="expand")
hold_wege["preis_von"], hold_wege["preis_bis"] = spannen[0], spannen[1]
hold_wege["breite_eur"] = hold_wege.preis_bis - hold_wege.preis_von

city = hold_wege[hold_wege.typ_code == "CITY"]
je_verbindung = city.groupby("route").agg(
    n=("breite_eur", "size"), von=("preis_von", "median"),
    bis=("preis_bis", "median"), breite=("breite_eur", "median")).query("n >= 40")
je_verbindung = je_verbindung.sort_values("breite")

print("Die schmalsten Spannen - hier ist eine Preisangabe nützlich:")
for r, z in je_verbindung.head(4).iterrows():
    print(f"   {r[:40]:40} {z.von:4.2f} bis {z.bis:4.2f} €   (Breite {z.breite:4.2f} €)")
print("\\nDie breitesten - hier wäre eine Preisangabe eine Zumutung:")
for r, z in je_verbindung.tail(3).iterrows():
    print(f"   {r[:40]:40} {z.von:4.2f} bis {z.bis:4.2f} €   (Breite {z.breite:4.2f} €)")

freigabe = (je_verbindung.breite <= 1.00)
print(f"\\nVerbindungen mit einer Spanne bis 1,00 €: "
      f"{freigabe.sum()} von {len(je_verbindung)}")
print(f"Anteil der Fahrten, die davon profitieren: "
      f"{city.breite_eur.le(1.00).mean():.0%}")
"""),

MD("""
Das ist das Ergebnis, mit dem wir in die Auslieferung gehen. Es ist kein glattes „besteht“,
sondern eine differenzierte Aussage:

- Die Spanne **trifft** — in vier von fünf Fällen liegt der tatsächliche Preis darin.
- Sie ist **auf etwa der Hälfte der Verbindungen nützlich schmal**.
- Auf den übrigen ist sie ehrlich, aber zu breit, um damit zu planen.

Damit wird die Freigabe nicht mehr je Radtyp entschieden, sondern **je Verbindung**. Nicht
das Rad macht eine Fahrt unvorhersehbar, sondern der Anlass.
"""),

PHASE(6, "Wie kommt das in die App — und wie verhindert man, dass es dort Unsinn anzeigt?"),

MD("""
### 6.1 Was ausgeliefert wird

Nicht das Modellobjekt, sondern eine **Tabelle**: je Verbindung, Radtyp und Tageszeit eine
Spanne. Das hat drei Gründe.

1. Die Website ist eine statische Anwendung ohne Python. Sie kann kein sklearn-Modell
   laden.
2. Die Merkmale, die das Modell braucht, ändern sich innerhalb eines Tages kaum — eine
   Spanne je Tageszeit reicht.
3. Eine Tabelle ist prüfbar. Man kann sie lesen, und jemand mit Ortskenntnis kann
   widersprechen.

Die Freigabe steckt **in** der Tabelle: Verbindungen mit zu breiter Spanne bekommen keine
Zeile. Was nicht drinsteht, wird nicht angezeigt.
"""),

CODE("""
FENSTER = [(5, 10, "frueh"), (10, 15, "vormittag"),
           (15, 20, "nachmittag"), (20, 24, "abend")]

def fenster_von(stunde):
    for a, b, name in FENSTER:
        if a <= stunde < b:
            return name
    return "nacht"

basis = pd.concat([lernmenge, pruef])
basis = basis[basis.ist_rundtour == 0].copy()
basis["fenster"] = basis.stunde.map(fenster_von)

zeilen = []
for (route, typ, fenster), g in basis.groupby(["route", "typ_code", "fenster"]):
    if len(g) < 30:                      # zu duenn fuer eine belastbare Spanne
        continue
    u, o = g.dauer_min.quantile(.10), g.dauer_min.quantile(.90)
    pv, pb = fahrpreis(u, typ), fahrpreis(o, typ)
    if pb - pv > 1.00:                   # zu breit, um nuetzlich zu sein
        continue
    start, ziel = route.split(" → ")
    zeilen.append(dict(startstation=start, zielstation=ziel, typ_code=typ,
                       zeitfenster=fenster, minuten_von=round(u), minuten_bis=round(o),
                       preis_von=round(pv, 2), preis_bis=round(pb, 2),
                       fahrten_grundlage=len(g)))

freigabe_tabelle = pd.DataFrame(zeilen)
print(f"{len(freigabe_tabelle)} freigegebene Kombinationen aus "
      f"Verbindung, Radtyp und Tageszeit")
print(f"   Verbindungen:  {freigabe_tabelle.startstation.nunique()} Start- x "
      f"{freigabe_tabelle.zielstation.nunique()} Zielstationen")
print(f"   Radtypen:      {sorted(freigabe_tabelle.typ_code.unique())}")
print()
print(freigabe_tabelle.head(8).to_string(index=False))
"""),

MD("""
### 6.2 Die Funktion, die die App aufruft

Sie tut drei Dinge, und das dritte ist das wichtigste: Sie **verweigert** die Auskunft,
wenn die Kombination nicht freigegeben ist. Eine fachliche Einschränkung, die nur im
Bericht steht, ist keine Einschränkung.
"""),

CODE("""
NACHSCHLAGE = freigabe_tabelle.set_index(
    ["startstation", "zielstation", "typ_code", "zeitfenster"])

def preis_schaetzen(start, ziel, typ_code, stunde):
    \"\"\"Gibt die Preisspanne zurueck - oder sagt, dass sie es nicht kann.\"\"\"
    if start == ziel:
        return {"anzeige": None,
                "hinweis": "Für Rundfahrten schätzen wir keinen Preis."}
    schluessel = (start, ziel, typ_code, fenster_von(stunde))
    if schluessel not in NACHSCHLAGE.index:
        return {"anzeige": None,
                "hinweis": "Für diese Verbindung liegt keine belastbare Schätzung vor."}
    z = NACHSCHLAGE.loc[schluessel]
    return {"anzeige": f"{z.preis_von:.2f} bis {z.preis_bis:.2f} €",
            "minuten": f"{z.minuten_von:.0f} bis {z.minuten_bis:.0f} Minuten",
            "grundlage": f"{z.fahrten_grundlage:.0f} vergleichbare Fahrten"}

for probe in [("Hauptbahnhof", "Hubland", "CITY", 8),
              ("Hauptbahnhof", "Hauptbahnhof", "CITY", 8),
              ("Residenz", "Käppele", "CITY", 14),
              ("Hauptbahnhof", "Neue Station", "CITY", 8)]:
    ergebnis = preis_schaetzen(*probe)
    print(f"{probe[0]} → {probe[1]} ({probe[2]}, {probe[3]} Uhr)")
    if ergebnis["anzeige"]:
        print(f"   {ergebnis['anzeige']}   {ergebnis['minuten']}   "
              f"Grundlage: {ergebnis['grundlage']}")
    else:
        print(f"   keine Anzeige - {ergebnis['hinweis']}")
"""),

MD("""
Die vier Proben zeigen alle Fälle, die im Betrieb vorkommen: eine freigegebene Verbindung,
eine Rundfahrt, eine Verbindung mit zu breiter Streuung und eine Station, die es im
Training nicht gab. In drei von vier Fällen sagt die Funktion ehrlich, dass sie nichts zu
sagen hat.

### 6.3 Die Tabelle für die Datenbank
"""),

CODE("""
freigabe_tabelle.to_csv("preisschaetzung.csv", index=False)
print(f"preisschaetzung.csv geschrieben: {len(freigabe_tabelle)} Zeilen")
print()
print("In der Datenbank wird daraus velocity.preisschaetzung, gelesen über")
print("die Sicht v_preisschaetzung. Die Website ruft ausschliesslich die Sicht auf -")
print("dieselbe Regel wie fuer alle anderen Daten der Anwendung.")
"""),

MD("""
### 6.4 Was danach passieren muss

| Auslöser | Schwelle | Handlung |
|---|---|---|
| laufende Messung je Verbindung | Abdeckung unter 75 % | Spanne neu berechnen |
| | Abdeckung unter 60 % | Verbindung aus der Tabelle nehmen |
| neue Station geht ans Netz | — | keine Zeile, also keine Anzeige, bis genug Fahrten vorliegen |
| Tarif ändert sich | Minutenpreis neu | **gesamte Tabelle neu rechnen** — die Euro-Spannen hängen daran |
| Jahreszeit | Quartalswechsel | Tabelle neu rechnen; im Winter sind die Ausflugsfahrten kürzer |

Die vierte Zeile ist die unauffälligste und die gefährlichste. Die Tabelle enthält Euro,
nicht Minuten. Ändert VeloCity den Minutenpreis, sind alle Spannen falsch, ohne dass sich
an den Daten oder am Modell irgendetwas geändert hätte.

### 6.5 Die Rückkopplung

Anders als bei der vorausschauenden Wartung in Notebook 2 arbeitet die Rückkopplung hier
**für** uns: Jede angezeigte Schätzung wird von einer tatsächlichen Fahrt gefolgt, deren
Dauer wir messen. Die Anzeige beeinflusst das Verhalten kaum — niemand fährt langsamer,
weil eine Spanne breiter war.

Eine Einschränkung bleibt: Wenn die Anzeige jemanden vom Fahren abhält, fehlt uns genau
diese Fahrt in den Daten. Bei einem Preisrahmen von ein bis zwei Euro ist der Effekt
vermutlich klein, aber er gehört benannt.
"""),

MD("""
# Der Kreislauf schließt sich

**Was dieses Notebook gezeigt hat**

| Phase | Ergebnis |
|---|---|
| 1 Business Understanding | Der Prozess wurde geändert, nicht das Verfahren: Der Kunde wählt sein Ziel, dann wird gerechnet. Erfolgskriterium: Preisfehler unter 50 Cent |
| 2 Data Understanding | Gut ein Fünftel der Fahrten endet frei im Gebiet und fällt aus dem Geltungsbereich. Ein weiteres Fünftel sind Rundtouren. Die Verbindung erklärt weniger, als die Produktidee nahelegt |
| 3 Data Preparation | Die Zielstation ist erlaubt, **weil der Prozess sie liefert**. Dreiteiliger Schnitt entlang der Zeit, Pipeline mit `handle_unknown` |
| 4 Modeling | Vier Baselines vor dem ersten Modell. Der Random Forest schlägt die Verbindungs-Baseline deutlich — die Wahl fällt auf der Validierung |
| 5 Evaluation | Auf dem Holdout deutlich schlechter als auf der Validierung. Mit der vollen Tariflogik reißt **jeder** Radtyp die 50-Cent-Grenze. Die Fehleranalyse zeigt: Pendeln ist vorhersagbar, Ausflüge sind es nicht |
| 6 Deployment | Rücksprung zur Spanne. Freigabe je Verbindung, als Tabelle, technisch erzwungen |

**Der Rücksprung, den man hier mitverfolgen konnte**

Zwischen 5.4 und 5.5 steht ein echter Rückschritt. Nicht weil das Modell schlecht
gerechnet hätte, sondern weil die **Zusage** falsch war. Eine Punktschätzung behauptet
eine Genauigkeit, die es bei einer Ausflugsfahrt nicht gibt.

> Wenn ein Modell an einem Kriterium scheitert, gibt es drei Antworten: das Kriterium
> senken, das Verfahren wechseln, oder die Zusage ändern. Nur die dritte ist hier
> ehrlich — und sie ist keine Niederlage, sondern ein besseres Produkt.

**Zwei Sätze, die aus diesem Notebook bleiben sollten**

> Ob ein Merkmal verwendet werden darf, entscheidet der Prozess, nicht der Spaltenname.

> Das Modell ist genau, wo gefahren wird, um anzukommen, und ungenau, wo gefahren wird,
> um zu fahren.

**Was eine zweite Runde anders machen würde**

1. **Zurück zu Phase 2:** Höhenmeter zwischen den Stationen. Würzburg ist nicht flach, und
   das Käppele liegt auf einem Berg. Die Daten dazu haben wir nicht — sie müssten
   beschafft werden.
2. **Zurück zu Phase 1:** Für Rundtouren und frei abgestellte Fahrten gibt es bisher gar
   kein Angebot. Eine Spanne „für eine Stunde Ausflug rechnen Sie mit ...“ wäre ein
   eigenes, einfacheres Produkt.
3. **Zurück zu Phase 3:** Die Zeitfenster sind gesetzt, nicht gefunden. Die tatsächlichen
   Spitzen aus Notebook 3 könnten schärfere Spannen ergeben.

**Weiter geht es mit Notebook 2 — Klassifikation:** Dort ist die Zielgröße keine Zahl
mehr, sondern eine Entscheidung: *Braucht dieses Rad bald Wartung, ja oder nein?* Und dort
werden die beiden Fehlerarten — Fehlalarm gegen verpassten Alarm — unterschiedlich teuer
sein.
"""),
]
