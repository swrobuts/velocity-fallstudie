# -*- coding: utf-8 -*-
"""Notebook 1 - Regression: Was kostet die Fahrt zu diesem Ziel?

Runde 2, nach dem zweiten methodischen Review (01.09.2026). Umgesetzt:

  * Statusfilter - 1.605 abgebrochene und stornierte Vorgaenge waren in
    den Modelldaten (3,4 %, Mediandauer 2 Minuten).
  * VIER Zeitraeume statt drei: Der Ruecksprung zur Spanne ist eine neue
    Modellierungsrunde und braucht seinen eigenen unberuehrten Test.
  * Kein Wetter mehr: Tagesmittel und Tagesniederschlag stehen bei der
    Anfrage noch nicht fest.
  * Zyklische Zeitmerkmale.
  * Die Proxy-Annahme hinter end_station_id wird benannt, nicht kaschiert.
  * Ausgeliefert wird die TABELLE - und das Notebook sagt das auch.
  * Rollierende Pruefung, Ziel-Ablation, ehrliche Produktreichweite,
    Abdeckung je Segment, harmonisierte Ueberwachungsgrenzen.
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

Ein Modell, das beim Entsperren nur Startstation, Uhrzeit und Wochentag kennt, kann zwei
Fahrten nicht unterscheiden, die gleich beginnen und völlig verschieden verlaufen: acht
Minuten zum Bahnhof gegen neunzig Minuten die Mainpromenade entlang.

Das ist kein Problem des Verfahrens, sondern ein Informationsproblem. **Also ändern wir
nicht das Verfahren, sondern den Prozess:** Der Nutzer wählt in der App sein Ziel, und
*erst danach* rechnet das Modell.

Daraus folgt die Einsicht, die dieses Notebook trägt:

> Ob ein Merkmal verwendet werden darf, entscheidet nicht sein Spaltenname, sondern der
> **Zeitpunkt, zu dem es im Prozess entsteht**. Ändert man den Prozess, ändert sich die
> Antwort.

Und daraus folgt sofort die erste Einschränkung, die wir offen benennen müssen.
"""),

MD("""
> ### ⚠ Die Annahme, auf der alles Weitere ruht
>
> Wir trainieren auf `end_station_id` — der Station, an der die Fahrt **tatsächlich
> geendet hat**. Im künftigen Betrieb bekommt das Modell die Station, die der Kunde
> **vorher gewählt** hat. Das ist nicht dasselbe.
>
> Beide fallen auseinander, wenn jemand unterwegs umplant, die Zielstation voll ist oder
> die Fahrt anders endet als gedacht. Ein Prozess, den wir künftig ändern, macht eine
> historische Ergebnisspalte nicht rückwirkend zu einer Eingabe.
>
> **Wir behandeln das tatsächliche Ziel deshalb als unvalidierten Stellvertreter für das
> geplante Ziel.** Wie gut dieser Stellvertreter ist, kann dieses Notebook nicht
> beantworten — dafür müsste die App das geplante Ziel erst einmal speichern. Bis dahin
> ist jede Zahl in diesem Notebook eine Obergrenze für das, was im Betrieb erreichbar
> ist.
"""),

PHASE(1, "Aus „der Kunde soll den Preis vorher kennen“ wird eine Zahl mit einer Grenze."),

MD("""
### Der Geschäftsprozess, den wir voraussetzen

```text
Kunde öffnet die App an einer Station    →  Startstation steht fest
Kunde wählt sein Ziel auf der Karte      →  Zielstation steht fest
Kunde tippt auf „Preis schätzen“         →  Modell rechnet
App zeigt den erwarteten Preis           →  Kunde entscheidet
```

### Das analytische Ziel

Geschätzt wird die **Dauer in Minuten**, nicht der Preis. Der Preis folgt daraus über das
Tarifblatt, und das ist exakt bekannt.

> **Man schätzt nie, was man ausrechnen kann.**

### Das Erfolgskriterium — festgelegt, bevor wir die Daten ansehen

| | |
|---|---|
| **fachlich** | Der angezeigte Preis liegt im Mittel weniger als **50 Cent** neben dem tatsächlichen |
| **Herkunft** | Grenze aus dem Produktmanagement |
| **gemessen auf** | einem Zeitraum, den das Modell beim Training nie gesehen hat |

### Der Geltungsbereich

1. **Nur abgeschlossene Fahrten.** Abbrüche und Stornierungen sind keine Fahrten.
2. **Nur Fahrten von Station zu Station.** Wer frei im Geschäftsgebiet abstellt, hat kein
   Ziel gewählt.
3. **Nur reguläre Fahrten bis acht Stunden.** Darüber liegt eine vergessene Rückgabe —
   ein eigener Geschäftsfall.

Punkt 3 ist eine Setzung, keine Messung: Wir haben keine Statusangabe, die „vergessen“
von „sehr lange unterwegs“ trennt. Sie gehört fachlich abgesichert.
"""),

CODE("""
import os
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt

BASIS = os.environ.get("VELO_BASIS",
    "https://raw.githubusercontent.com/swrobuts/velocity-fallstudie/main/analytics/")

ausleihe  = pd.read_csv(BASIS + "ausleihe.csv", parse_dates=["startzeit", "endzeit"])
station   = pd.read_csv(BASIS + "station.csv")
fahrrad   = pd.read_csv(BASIS + "fahrrad.csv")
feiertag  = pd.read_csv(BASIS + "feiertage.csv", parse_dates=["datum"])
schulfrei = pd.read_csv(BASIS + "schulferien.csv", parse_dates=["von", "bis"])
preise    = pd.read_csv(BASIS + "nutzungspreis.csv")

print(f"{len(ausleihe):,} Fahrten, {len(station)} Stationen, {len(fahrrad)} Räder")
print()
print("Das Tarifblatt - exakt bekannt, nichts daran wird geschätzt:")
print(preise.to_string(index=False))
"""),

PHASE(2, "Für wie viele Fahrten gilt die Frage — und was steckt sonst noch in den Daten?"),

MD("""
### 2.1 Nicht jeder Vorgang ist eine Fahrt

Bevor irgendetwas gefiltert wird, ein Blick auf die Statusspalte. Sie wurde in der ersten
Runde dieses Notebooks übersehen — mit Folgen, die wir gleich sehen.
"""),

CODE("""
ausleihe["dauer_min"] = (ausleihe.endzeit - ausleihe.startzeit).dt.total_seconds() / 60

print("Vorgänge nach Status, mit ihrer typischen Dauer:")
for s, g in ausleihe.groupby("status"):
    print(f"   {s:16} n = {len(g):>6,}   Mediandauer {g.dauer_min.median():5.1f} Min")
print()
print("Abbrüche und Stornierungen dauern zwei Minuten. Das sind keine Fahrten,")
print("sondern Vorgänge, die nie eine geworden sind - und sie verzerren")
print("besonders die kurzen Strecken, um die es hier geht.")
"""),

MD("""
### 2.2 Für wie viele Fahrten gibt es ein Ziel?

Die Website wirbt damit, dass man das Rad überall im Geschäftsgebiet abstellen darf.
Genau diese Fahrten haben keine Zielstation und fallen aus dem Geltungsbereich.
"""),

CODE("""
n0 = len(ausleihe)
schritte = [("Rohdaten", n0)]

d = ausleihe[ausleihe.status == "abgeschlossen"]
schritte.append(("nur abgeschlossene Vorgänge", len(d)))
d = d[d.dauer_min >= 1]
schritte.append(("mindestens 1 Minute", len(d)))
d = d[d.dauer_min <= 8 * 60]
schritte.append(("höchstens 8 Stunden (Geltungsbereich)", len(d)))
n_vor_ziel = len(d)
d = d[d.end_station_id.notna()].copy()
schritte.append(("endet an einer Station (Geltungsbereich)", len(d)))

for name, n in schritte:
    print(f"   {name:42} {n:>7,}")
print(f"\\n   Verbleiben {len(d)/n0:.1%} der Rohdaten.")
print(f"   Frei abgestellt und damit ohne Ziel: {1 - len(d)/n_vor_ziel:.1%}")
print("   Das ist kein Datenfehler, sondern ein beworbenes Produktmerkmal.")
"""),

MD("""
### 2.3 Rundtouren — dieselbe Verbindung, jede Dauer
"""),

CODE("""
d["end_station_id"] = d.end_station_id.astype(int)
d["ist_rundtour"] = (d.start_station_id == d.end_station_id).astype(int)

for name, g in (("Rundtour (Start = Ziel)", d[d.ist_rundtour == 1]),
                ("echter Weg", d[d.ist_rundtour == 0])):
    q1, q3 = g.dauer_min.quantile([.25, .75])
    print(f"{name:24} n = {len(g):>6,}   Median {g.dauer_min.median():5.1f} Min"
          f"   mittlere Hälfte {q1:4.0f} bis {q3:4.0f} Min")
print(f"\\nRundtouren sind {d.ist_rundtour.mean():.1%} der Fahrten mit Ziel.")
print("Bei ihnen ist das Ziel gleich dem Start - es trägt per Definition")
print("keine Information über die Dauer bei, und sie streuen doppelt so stark.")
"""),

MD("""
### 2.4 Was die Verbindung erklärt — ein erster Blick

Drei Nachschlagetabellen, je eine Zeile Code. Sie werden uns in Phase 4 als Maßstab
wiederbegegnen.
"""),

CODE("""
namen = station.set_index("station_id").name
d["start_name"] = d.start_station_id.map(namen)
d["ziel_name"]  = d.end_station_id.map(namen)
d["route"]      = d.start_name + " → " + d.ziel_name

def mittlerer_fehler(vorhersage):
    return (d.dauer_min - vorhersage).abs().mean()

print("Mittlerer absoluter Fehler, wenn man nur den Median nimmt:")
print(f"   ... aller Fahrten:      {mittlerer_fehler(d.dauer_min.median()):5.2f} Min")
print(f"   ... je Startstation:    "
      f"{mittlerer_fehler(d.groupby('start_name').dauer_min.transform('median')):5.2f} Min")
print(f"   ... je Verbindung:      "
      f"{mittlerer_fehler(d.groupby('route').dauer_min.transform('median')):5.2f} Min")
print(f"\\n{d.route.nunique()} Verbindungen, im Median "
      f"{d.route.value_counts().median():.0f} Fahrten je Verbindung")
"""),

MD("""
Der Sprung liegt zwischen „nichts wissen“ und „die Startstation kennen“. Das Ziel legt
nur wenige Zehntelminuten drauf. Ob das auch für ein richtiges Modell gilt, prüfen wir in
Phase 4 mit einer Ablation — der Vergleich zweier Nachschlagetabellen ist dafür kein
Beweis.
"""),

CODE("""
fig, achsen = plt.subplots(1, 2, figsize=(13, 4.2))
achsen[0].hist(d.dauer_min, bins=80, range=(0, 120), color="#003E6E")
achsen[0].axvline(d.dauer_min.median(), color="#BE2344", lw=2,
                  label=f"Median {d.dauer_min.median():.0f} Min")
achsen[0].set_title("Fahrtdauer — rechtsschief, langer Ausläufer")
achsen[0].set_xlabel("Minuten"); achsen[0].set_ylabel("Fahrten"); achsen[0].legend()

oben = d.groupby("route").dauer_min.agg(["median", "count"])
oben = oben[oben["count"] >= 200].sort_values("median").tail(12)
achsen[1].barh(range(len(oben)), oben["median"], color="#4AB5C4")
achsen[1].set_yticks(range(len(oben)))
achsen[1].set_yticklabels([r[:32] for r in oben.index], fontsize=8)
achsen[1].set_title("Die zwölf längsten Verbindungen (Median)")
achsen[1].set_xlabel("Minuten")
plt.tight_layout(); plt.show()
"""),

MD("""
Links: stark rechtsschief — deshalb ist der **Median** das richtige Nullmodell, nicht der
Mittelwert. Rechts das Muster, das dieses Notebook trägt: Die langen Verbindungen führen
zu Dom und Residenz, die kurzen verbinden Bahnhof, Klinikum und Campus.
"""),

PHASE(3, "Welche Merkmale sind zum Zeitpunkt der Anfrage verfügbar — und welche nicht?"),

MD("""
### 3.1 Der Leakage-Test

Die Frage ist nicht statistisch, sondern zeitlich: **Was steht in dem Moment zur
Verfügung, in dem die Anzeige erscheinen soll?**

| Spalte | verfügbar? | warum |
|---|---|---|
| `start_station_id` | ja | der Kunde steht dort |
| `end_station_id` | **ja, mit Vorbehalt** | der Kunde hat gewählt — historisch steht hier aber das *tatsächliche* Ziel (siehe Kasten oben) |
| `startzeit` | ja | jetzt |
| Feiertag, Ferien | ja | stehen im Kalender |
| `typ_code` | ja | das Rad steht vor ihm |
| **Tageswetter** | **nein** | Tagesmittel und Tagesniederschlag stehen erst am Abend fest |
| `endzeit`, `dauer_min` | nein | entstehen am Ende der Fahrt |
| `distanz_km`, `entgelt_eur` | nein | werden während und nach der Fahrt gebildet |

Die Wetterzeile ist neu und war in der ersten Runde falsch. Ein Modell, das mit dem
*Tagesmittel* rechnet, benutzt Wissen von heute Abend für eine Anfrage von heute früh —
und ein zeitlicher Schnitt heilt das nicht, weil auch im Testzeitraum das nachträglich
bekannte Tageswetter eingesetzt würde.

Brauchbar wäre archiviertes Prognosewetter mit seinem Erstellungszeitpunkt. Das haben wir
nicht. **Also fällt das Wetter aus dem Modell** — und wir sagen dazu, dass es ein Verlust
ist, kein Gewinn.
"""),

CODE("""
# AUFGABE: Welche Spalten dürfen NICHT ins Modell? Prüfen Sie jede mit der
# Frage: Existiert dieser Wert schon, wenn der Kunde auf "Preis schätzen"
# tippt?
##LUECKE Fünf Spalten entstehen erst während, nach oder am Ende des Tages.
gesperrt = ["endzeit", "dauer_min", "distanz_km", "entgelt_eur",
            "temp_mittel_c"]
##ENDE

print("Gesperrt, weil zum Anfragezeitpunkt nicht vorhanden:")
for s in gesperrt:
    print(f"   {s}")
print()
print("Erlaubt, obwohl es nach 'Ende' klingt: end_station_id -")
print("der Kunde hat sie gewählt. Mit dem Vorbehalt aus dem Kasten oben.")
"""),

MD("""
### 3.2 Merkmale der geplanten Fahrt

Drei Gruppen: die Verbindung, der Zeitpunkt, das Rad. Die Zeitmerkmale werden **zyklisch**
kodiert — 23 Uhr und 0 Uhr sind Nachbarn, als Zahlen aber maximal weit auseinander.
"""),

CODE("""
d = d.merge(fahrrad[["fahrrad_id", "typ_code"]], on="fahrrad_id", how="left")

koord = station.set_index("station_id")
for rolle, spalte in (("start", "start_station_id"), ("ziel", "end_station_id")):
    d[f"{rolle}_lat"] = d[spalte].map(koord.latitude)
    d[f"{rolle}_lon"] = d[spalte].map(koord.longitude)

# Luftlinie nach Haversine - anders als ein Routen-Kürzel auch für eine
# Verbindung berechenbar, die im Training nie vorkam.
R = 6371.0
p1, p2 = np.radians(d.start_lat), np.radians(d.ziel_lat)
dl = np.radians(d.ziel_lon - d.start_lon)
h = np.sin((p2 - p1) / 2) ** 2 + np.cos(p1) * np.cos(p2) * np.sin(dl / 2) ** 2
d["luftlinie_km"] = 2 * R * np.arcsin(np.sqrt(h))

d["datum"]  = d.startzeit.dt.normalize()
d["stunde"] = d.startzeit.dt.hour
d["wochentag"] = d.startzeit.dt.dayofweek
d["ist_wochenende"] = (d.wochentag >= 5).astype(int)
d["monat"] = d.startzeit.dt.month
# Zyklisch: der Dezember liegt neben dem Januar, 23 Uhr neben 0 Uhr.
d["stunde_sin"] = np.sin(2 * np.pi * d.stunde / 24)
d["stunde_cos"] = np.cos(2 * np.pi * d.stunde / 24)
d["monat_sin"]  = np.sin(2 * np.pi * d.monat / 12)
d["monat_cos"]  = np.cos(2 * np.pi * d.monat / 12)
d["ist_feiertag"] = d.datum.isin(feiertag.datum).astype(int)
in_ferien = pd.Series(False, index=d.index)
for _, z in schulfrei.iterrows():
    in_ferien |= (d.datum >= z.von) & (d.datum <= z.bis)
d["ist_ferien"] = in_ferien.astype(int)

print(f"{len(d):,} Fahrten, {d.route.nunique()} Verbindungen")
print(f"Luftlinie {d.luftlinie_km.min():.2f} bis {d.luftlinie_km.max():.2f} km "
      f"(0,00 km sind die Rundtouren)")
"""),

MD("""
### 3.3 Aufteilen — entlang der Zeit, in VIER Abschnitte

Hier liegt die zweite große Korrektur dieser Runde.

Die erste Fassung teilte dreifach: Training, Validierung, Holdout. Danach stellte sich in
der Evaluation heraus, dass die Punktschätzung nicht trägt — und es wurde eine Spanne
entwickelt und **auf demselben Holdout** geprüft. Damit war der Holdout keine unberührte
Prüfmenge mehr, sondern Entwicklungsinformation.

Ein Rücksprung ist eine **neue Modellierungsrunde**. Sie braucht ihren eigenen Test.

| Abschnitt | wofür | Regel |
|---|---|---|
| **Training** (60 %) | das Modell lernt | die ältesten Fahrten |
| **Validierung** (15 %) | wir *wählen* Verfahren und Einstellungen | mittlerer Zeitraum |
| **Test 1** (12,5 %) | die Punktschätzung wird *einmal* gemessen | danach verbraucht |
| **Test 2** (12,5 %) | die zweite Runde wird darauf **kalibriert und freigegeben** | kein Training — aber Auswahl und Filterung |

> **Test 2 ist kein finaler Test, sondern ein Kalibrierungszeitraum.** Auf ihm wird das
> Artefakt ausgewählt, ein Radtyp ausgeschlossen und über einzelne Kombinationen
> entschieden. Wer daraufhin Kennzahlen berichtet, berichtet die Güte einer Auswahl, die
> auf ebendiesen Daten getroffen wurde — sie fällt zu günstig aus.
>
> Die unabhängige Prüfung des fertigen Artefakts kann deshalb erst der Schattenbetrieb
> aus Phase 6.6 leisten. Diesen Zwischenschritt zu benennen ist ehrlicher, als eine
> vierte Menge zu erfinden, für die die Daten nicht reichen:
>
> ```text
> Training → Validierung → Test 1: Punktschätzung
>          → Rücksprung  → Test 2: Kalibrierung und Freigabe des Intervallprodukts
>          → Schattenbetrieb: finale, unabhängige Prüfung
> ```
"""),

CODE("""
d = d.sort_values("startzeit").reset_index(drop=True)
g1, g2, g3 = d.startzeit.quantile([0.60, 0.75, 0.875])

training    = d[d.startzeit <  g1]
validierung = d[(d.startzeit >= g1) & (d.startzeit < g2)]
test1       = d[(d.startzeit >= g2) & (d.startzeit < g3)]
test2       = d[d.startzeit >= g3]

for name, teil in (("Training", training), ("Validierung", validierung),
                   ("Test 1 (Punkt)", test1), ("Test 2 (Spanne)", test2)):
    print(f"{name:16} {len(teil):>7,} Fahrten   "
          f"{teil.startzeit.min():%d.%m.%Y} bis {teil.startzeit.max():%d.%m.%Y}")
print()
print("Test 1 ist Winter und Frühjahr, Test 2 ist Sommer. Dass die beiden")
print("Zeiträume verschiedene Jahreszeiten sind, ist kein Zufall der Aufteilung,")
print("sondern eine Eigenschaft der Daten - und sie wird uns beschäftigen.")
print()
print("ZWEIERLEI IST DABEI ZU BEACHTEN:")
print("1. Die Erkundung in Phase 2 lief ueber den GESAMTEN Datensatz, also auch")
print("   ueber Test 2. Trainiert wurde dort nie, aber blind sind wir ihm")
print("   gegenueber auch nicht.")
print("2. Test 2 traegt in Phase 6 die Auswahl des Artefakts und die Freigabe.")
print("   Er ist damit ein KALIBRIERUNGSZEITRAUM, kein unabhaengiger Endtest.")
print("   Den kann erst der Schattenbetrieb liefern.")
"""),

PHASE(4, "Verdient ein Modell seinen Unterhalt gegenüber einer Nachschlagetabelle?"),

MD("""
### 4.1 Vier Baselines, bevor ein Modell gerechnet wird

Baseline D ist der eigentliche Gegner: *„Für Hauptbahnhof → Hubland brauchen die Leute
normalerweise acht Minuten.“*
"""),

CODE("""
from sklearn.metrics import mean_absolute_error, median_absolute_error

median_gesamt = training.dauer_min.median()
tabelle = [("A  Median aller Fahrten",
            mean_absolute_error(validierung.dauer_min,
                                np.full(len(validierung), median_gesamt)))]

# AUFGABE: Baselines B, C und D. Der Median wird IMMER auf dem Training
# gebildet und auf die Validierung angewandt - nie umgekehrt.
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
### 4.2 Eine Pipeline, damit im Betrieb nichts auseinanderfällt
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
NUMERISCH  = ["luftlinie_km", "ist_rundtour", "stunde_sin", "stunde_cos",
              "monat_sin", "monat_cos", "wochentag", "ist_wochenende",
              "ist_feiertag", "ist_ferien"]
MERKMALE = KATEGORIAL + NUMERISCH

def pipeline(modell, drop=None):
    # handle_unknown="ignore" verhindert einen Absturz bei einer neuen
    # Station. Es macht die Vorhersage aber nicht gültig - die unbekannte
    # Kategorie wird zum Nullvektor. Deshalb verweigert die Auslieferung
    # in Phase 6 unbekannte Kombinationen ausdrücklich.
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
    guete[name] = mean_absolute_error(validierung.dauer_min, v)
    print(f"{name:28} MAE {guete[name]:5.2f} Min")

bestes = min(guete, key=guete.get)
print(f"\\nAuf der VALIDIERUNG gewählt: {bestes}")
print(f"Baseline D lag bei {tabelle[3][1]:.2f} Min - das Modell ist "
      f"{1 - guete[bestes]/tabelle[3][1]:.0%} besser.")
"""),

MD("""
> **Zur linearen Regression:** `drop="first"` beseitigt die Dummy-Falle innerhalb eines
> Merkmals, aber nicht die Abhängigkeiten zwischen ihnen — die Route bestimmt Start und
> Ziel, `ist_rundtour` folgt aus der Route, die Luftlinie ist je Route konstant. Die
> Vorhersagen sind brauchbar, die **Koeffizienten aber nicht eindeutig interpretierbar**.
> Wer sie lesen will, braucht eine redundanzfreie Merkmalsmenge oder eine regularisierte
> Regression.

### 4.3 Bringt das Ziel wirklich etwas? Eine Ablation

Der Vergleich zweier Nachschlagetabellen in Phase 2 war ein Hinweis, kein Beweis. Sauber
ist es, **dasselbe Modell** einmal mit und einmal ohne die Zielmerkmale zu rechnen.
"""),

CODE("""
OHNE_ZIEL_KAT = ["start_name", "typ_code"]
OHNE_ZIEL_NUM = [s for s in NUMERISCH if s not in ("luftlinie_km", "ist_rundtour")]

ohne = Pipeline([
    ("aufbereiten", ColumnTransformer([
        ("kategorial", OneHotEncoder(handle_unknown="ignore"), OHNE_ZIEL_KAT),
        ("numerisch", "passthrough", OHNE_ZIEL_NUM)])),
    ("modell", RandomForestRegressor(n_estimators=200, min_samples_leaf=5,
                                     random_state=42, n_jobs=-1))])
ohne.fit(training[OHNE_ZIEL_KAT + OHNE_ZIEL_NUM], training.dauer_min)
mae_ohne = mean_absolute_error(validierung.dauer_min,
                               ohne.predict(validierung[OHNE_ZIEL_KAT + OHNE_ZIEL_NUM]))

print(f"Random Forest OHNE Zielmerkmale: MAE {mae_ohne:5.2f} Min")
print(f"Random Forest MIT Zielmerkmalen: MAE {guete[bestes]:5.2f} Min")
print(f"Beitrag des Ziels:               {mae_ohne - guete[bestes]:5.2f} Min "
      f"({1 - guete[bestes]/mae_ohne:.0%})")
print()
print("Die neue Geschäftslogik ist richtig - aber der messbare Zusatznutzen")
print("der Zielinformation ist in diesem Datensatz bescheiden. Das gehört")
print("in den Bericht, nicht in eine Fußnote.")
"""),

PHASE(5, "Reicht das für die Preisanzeige? Und wenn nicht — was dann?"),

MD("""
### 5.1 Test 1, einmal
"""),

CODE("""
lernmenge = pd.concat([training, validierung])
final = modelle[bestes]
final.fit(lernmenge[MERKMALE], lernmenge.dauer_min)

pruef = test1.copy()
pruef["dauer_geschaetzt"] = np.maximum(1.0, final.predict(test1[MERKMALE]))
mae_t1 = mean_absolute_error(pruef.dauer_min, pruef.dauer_geschaetzt)

med_route = lernmenge.groupby("route").dauer_min.median()
basis_d = pruef.route.map(med_route).fillna(median_gesamt)

print(f"Random Forest auf Test 1 : MAE {mae_t1:5.2f} Min")
print(f"Baseline D auf Test 1    : MAE {mean_absolute_error(pruef.dauer_min, basis_d):5.2f} Min")
print(f"auf der Validierung      : MAE {guete[bestes]:5.2f} Min")
"""),

MD("""
### 5.2 Von Minuten zu Euro — mit der vollen Tariflogik

Der Preis ist nicht Minuten mal Minutenpreis. Er ist Startgebühr **plus** Minutenpreis,
**gedeckelt** auf den Tageshöchstpreis. Ist- und Schätzpreis werden je Fahrt getrennt
gerechnet.
"""),

CODE("""
tarif = preise.set_index("typ_code")

def fahrpreis(minuten, typ):
    z = tarif.loc[typ]
    roh = z.startgebuehr_eur + np.maximum(0.0, minuten) * z.preis_pro_minute_eur
    return float(min(roh, z.tageshoechstpreis_eur))

# AUFGABE: Ist- und Schätzpreis je Fahrt, daraus der Betrag der Abweichung.
# NICHT die Minutendifferenz mal Preis - wegen des Deckels ist der
# Zusammenhang nicht überall linear.
##LUECKE Drei Zeilen: p_ist, p_geschaetzt, preisfehler.
pruef["p_ist"] = [fahrpreis(m, t) for m, t in zip(pruef.dauer_min, pruef.typ_code)]
pruef["p_geschaetzt"] = [fahrpreis(m, t) for m, t in zip(pruef.dauer_geschaetzt, pruef.typ_code)]
pruef["preisfehler"] = (pruef.p_geschaetzt - pruef.p_ist).abs()
##ENDE

print(f"{'Radtyp':8} {'n':>6} {'Fahrt kostet':>13} {'Abweichung':>12} "
      f"{'unter 0,50 €':>13} {'Kriterium':>12}")
for t, g in pruef.groupby("typ_code"):
    pf = g.preisfehler.mean()
    print(f"{t:8} {len(g):>6,} {g.p_ist.mean():>12.2f} € {pf:>11.2f} € "
          f"{(g.preisfehler < 0.50).mean():>12.0%} "
          f"{'erfüllt' if pf < 0.50 else 'gerissen':>12}")
"""),

MD("""
Für **CITY ist die Grenze eingehalten**, für EBIKE und CARGO nicht.

Bevor daraus eine Freigabe wird, zwei Fragen, die man sich in dieser Lage immer stellen
sollte.
"""),

CODE("""
pruef["abweichung"] = pruef.p_geschaetzt - pruef.p_ist   # mit Vorzeichen

print("Frage 1: Schätzen wir systematisch zu hoch oder zu niedrig?")
for t, g in pruef.groupby("typ_code"):
    print(f"   {t:8} mittlere Abweichung {g.abweichung.mean():+6.2f} €   "
          f"zu hoch bei {(g.abweichung > 0).mean():.0%} der Fahrten")
print("   -> Nein. Über- und Unterschätzung heben sich weitgehend auf.")

print("\\nFrage 2: Ist das Modell für teure Räder schlechter?")
for t, g in pruef.groupby("typ_code"):
    print(f"   {t:8} Abweichung {g.preisfehler.mean():5.2f} € bei einem Fahrpreis von "
          f"{g.p_ist.mean():6.2f} €  =  {g.preisfehler.mean()/g.p_ist.mean():.0%}")
print("   -> Nein. Relativ zum Fahrpreis ist die Abweichung ähnlich.")
print("      Was sich unterscheidet, ist die Strenge einer festen 50-Cent-Grenze.")
"""),

MD("""
### 5.3 Wie belastbar ist dieses Ergebnis?

Eine einzelne Zahl auf einem einzelnen Zeitraum sagt nichts darüber, wie sie im nächsten
Quartal aussieht. Der Fehler ist im Sommer erkennbar größer als im Winter — ein Kriterium,
das nur in einer Jahreszeit hält, ist keine Zusage.

Wir prüfen das **innerhalb** von Training und Validierung: Test 1 ist verbraucht, und
Test 2 ist bis hierher nicht angefasst — er wird ab Phase 5.6 für die zweite Runde
gebraucht.
"""),

CODE("""
lernbasis = pd.concat([training, validierung]).sort_values("startzeit")
grenzen = lernbasis.startzeit.quantile([0.5, 0.6, 0.7, 0.8, 0.9]).tolist()

print(f"{'Fenster':22}{'n':>7}{'MAE':>8}{'CITY Preisfehler':>19}")
schwankung = []
for i in range(len(grenzen) - 1):
    lern_i  = lernbasis[lernbasis.startzeit < grenzen[i]]
    pruef_i = lernbasis[(lernbasis.startzeit >= grenzen[i])
                        & (lernbasis.startzeit < grenzen[i + 1])]
    if len(pruef_i) < 200:
        continue
    m = pipeline(RandomForestRegressor(n_estimators=200, min_samples_leaf=5,
                                       random_state=42, n_jobs=-1))
    m.fit(lern_i[MERKMALE], lern_i.dauer_min)
    v = np.maximum(1.0, m.predict(pruef_i[MERKMALE]))
    c = pruef_i[pruef_i.typ_code == "CITY"]
    vc = np.maximum(1.0, m.predict(c[MERKMALE]))
    pf = np.mean(np.abs([fahrpreis(x, "CITY") for x in vc]
                        - np.array([fahrpreis(x, "CITY") for x in c.dauer_min])))
    schwankung.append(pf)
    print(f"{pruef_i.startzeit.min():%m/%Y} bis {pruef_i.startzeit.max():%m/%Y}   "
          f"{len(pruef_i):>6,}{mean_absolute_error(pruef_i.dauer_min, v):>8.2f}"
          f"{pf:>18.2f} €")

lo, hi = min(schwankung), max(schwankung)
print(f"\\nDer CITY-Preisfehler schwankt zwischen {lo:.2f} € und {hi:.2f} €.")
if lo <= 0.50 <= hi:
    print("Die Grenze von 0,50 € liegt INNERHALB dieser Schwankung - das")
    print("Kriterium haelt also mal und reisst mal. Das ist keine Zusage.")
elif hi < 0.50:
    print(f"Die Grenze von 0,50 € liegt OBERHALB der Schwankung: In allen")
    print(f"vier Fenstern haelt das Kriterium, im schlechtesten mit {0.50-hi:.2f} €")
    print("Abstand. Fuer CITY ist die Punktschaetzung damit belastbar.")
else:
    print("Die Grenze von 0,50 € liegt UNTERHALB der Schwankung - das")
    print("Kriterium reisst in jedem Fenster.")
"""),

MD("""
Der saisonale Unterschied ist deutlich sichtbar — im Sommer, wenn mehr Ausflugsfahrten
stattfinden, steigt der Fehler —, aber er bleibt in allen vier Fenstern unter der Grenze.
**Für CITY ist die Punktschätzung damit belastbar**, nicht nur einmalig gelungen.

Für EBIKE und CARGO gibt es dagegen bisher überhaupt kein Produkt.

### 5.4 Woran es liegt
"""),

CODE("""
print("Rundtouren gegen echte Wege:")
for name, g in (("Rundtour", pruef[pruef.ist_rundtour == 1]),
                ("echter Weg", pruef[pruef.ist_rundtour == 0])):
    print(f"   {name:12} n={len(g):>6,}  "
          f"MAE {mean_absolute_error(g.dauer_min, g.dauer_geschaetzt):5.2f} Min   "
          f"Abweichung {g.preisfehler.mean():5.2f} €")

print("\\nDie treffsichersten und die schwierigsten Verbindungen (CITY, echte Wege):")
c = pruef[(pruef.typ_code == "CITY") & (pruef.ist_rundtour == 0)]
je_route = c.groupby("route").agg(
    n=("dauer_min", "size"), median_ist=("dauer_min", "median"),
    q1=("dauer_min", lambda s: s.quantile(.25)),
    q3=("dauer_min", lambda s: s.quantile(.75)),
    fehler=("preisfehler", "median")).query("n >= 40").sort_values("fehler")
for r, z in pd.concat([je_route.head(4), je_route.tail(4)]).iterrows():
    print(f"   {r[:38]:38} {z.median_ist:4.0f} Min "
          f"(mittlere Hälfte {z.q1:3.0f}-{z.q3:3.0f})  Abweichung {z.fehler:5.2f} €")
"""),

MD("""
Das Muster ist kein statistisches, sondern ein menschliches:

> **Das Modell ist genau, wo gefahren wird, um anzukommen — und ungenau, wo gefahren
> wird, um zu fahren.**

Auf den Pendelverbindungen liegt die Anzeige um wenige Cent daneben. Auf den Verbindungen
zu Dom und Residenz liegt sie deutlich daneben, weil die Leute dort je nach
Anlass zwanzig oder vierzig Minuten unterwegs sind.

**Die derzeit verfügbaren Merkmale reichen nicht aus, um individuelle Stopps und den
Fahrtzweck abzubilden.** Ob überhaupt keine Merkmale das könnten, wissen wir nicht —
Nutzerabsicht, Höhenprofil oder Stationsauslastung sind ungeprüfte Kandidaten.

### 5.5 Der Rücksprung — und warum er kommt, obwohl das Kriterium hält

Für CITY könnten wir jetzt ausliefern. Trotzdem springen wir zurück, und zwar aus zwei
Gründen, die nichts mit einem gerissenen Kriterium zu tun haben.

**Erstens misst das Kriterium den Durchschnitt, nicht die Erfahrung.** 0,41 € im Mittel
klingt gut. Die Zeile daneben sagt aber: Bei rund jeder vierten CITY-Fahrt liegt die
Anzeige um **mehr als 50 Cent** daneben. Ein Kunde erlebt keinen Mittelwert, er erlebt
seine Fahrt.

**Zweitens haben zwei von drei Radtypen gar kein Produkt.** Eine Lösung, die nur für das
billigste Rad funktioniert, ist keine Antwort auf die Geschäftsfrage.

Drei Wege stehen offen:

1. **Grenze lockern.** Verboten — und hier auch unnötig.
2. **Besseres Modell suchen.** Die Ablation in 4.3 zeigt, wie wenig selbst das Ziel
   beiträgt; die fehlende Information steckt nicht im Verfahren.
3. **Die Zusage ändern.** Statt einer Zahl, die für ein Viertel der Fahrten zu genau
   klingt, eine **Spanne**, die die tatsächliche Streuung zeigt.

Der dritte Weg ändert nicht die Verfahrensklasse — eine Quantilregression ist weiterhin
Regression —, sondern das, was die App verspricht.

**Neues Erfolgskriterium, vor der Messung festgelegt:**

| | |
|---|---|
| **trifft** | Die angezeigte Spanne enthält den tatsächlichen Preis in mindestens **80 %** der Fälle — insgesamt *und* je Radtyp |
| **nützt** | Die Spanne ist höchstens **1,00 €** breit, sonst zeigt die App keinen Preis |
| **gemessen auf** | **Test 2** — dem Zeitraum, den bis hierher nichts berührt hat |

### 5.6 Welches Artefakt? Zwei Kandidaten, ehrlich verglichen

In der ersten Fassung stand hier ein Widerspruch: Der Text sagte, die Quantilregression
werde ausgeliefert — gebaut wurde dann eine Tabelle aus historischen Perzentilen. Das
sind zwei verschiedene Produkte, und man muss sich entscheiden.
"""),

CODE("""
from sklearn.ensemble import GradientBoostingRegressor

# Alles, was VOR Test 2 liegt, darf jetzt in die Lernmenge - Test 2 ist
# der unberuehrte Zeitraum dieser zweiten Runde.
basis = pd.concat([training, validierung, test1])
basis = basis[basis.ist_rundtour == 0]
zukunft = test2[test2.ist_rundtour == 0].copy()

FENSTER = [(5, 10, "frueh"), (10, 15, "vormittag"),
           (15, 20, "nachmittag"), (20, 24, "abend")]
def fenster_von(stunde):
    for a, b, name in FENSTER:
        if a <= stunde < b:
            return name
    return "nacht"
for teil in (basis, zukunft):
    teil["fenster"] = teil.stunde.map(fenster_von)

# Kandidat 1: Quantilregression
unten = pipeline(GradientBoostingRegressor(loss="quantile", alpha=0.10, random_state=42))
oben  = pipeline(GradientBoostingRegressor(loss="quantile", alpha=0.90, random_state=42))
unten.fit(basis[MERKMALE], basis.dauer_min)
oben.fit(basis[MERKMALE], basis.dauer_min)
zukunft["modell_von"] = np.maximum(1.0, unten.predict(zukunft[MERKMALE]))
zukunft["modell_bis"] = oben.predict(zukunft[MERKMALE])

# Kandidat 2: Perzentile je Verbindung, Radtyp und Tageszeit.
# Die Freigaberegeln gelten SOFORT und nicht erst nach der Messung: nur
# Kombinationen mit genug Fahrten und einer nuetzlich schmalen Spanne
# kommen ueberhaupt in Frage. Alles andere zu messen und danach
# wegzuwerfen haette die Abdeckung geschoenigt.
gruppen = basis.groupby(["route", "typ_code", "fenster"]).dauer_min
tab = pd.DataFrame({"von_roh": gruppen.quantile(.10), "bis_roh": gruppen.quantile(.90),
                    "n": gruppen.size()}).reset_index()

# ERST RUNDEN, DANN RECHNEN. Die App zeigt ganze Minuten an; wuerde man
# den Preis aus den ungerundeten Quantilen bilden, stuenden nebeneinander
# "5 bis 12 Minuten" und "0,60 bis 1,33 Euro" - und 12 Minuten kosten
# beim City-Bike 1,30. Zwei Angaben, die sich widersprechen, obwohl beide
# fuer sich richtig gerechnet sind.
tab["von"] = tab.von_roh.round()
tab["bis"] = tab.bis_roh.round()
tab["preis_von"] = [fahrpreis(m, t) for m, t in zip(tab["von"], tab.typ_code)]
tab["preis_bis"] = [fahrpreis(m, t) for m, t in zip(tab["bis"], tab.typ_code)]

# Die Ein-Euro-Regel greift auf den ANGEZEIGTEN Werten. Das Runden kann
# eine Spanne knapp ueber die Grenze heben oder unter sie druecken -
# geprueft wird deshalb danach, nicht davor.
tab = tab[(tab.n >= 30) & (tab.preis_bis - tab.preis_von <= 1.00)]
print(f"{len(tab)} Kombinationen erfuellen die beiden Regeln aus Phase 1.")
zukunft = zukunft.merge(tab, on=["route", "typ_code", "fenster"], how="left")

# Gemessen wird gegen das VOLLSTAENDIGE Kriterium aus Phase 5.5, nicht
# nur gegen die Dauerabdeckung: Preisabdeckung insgesamt UND je Radtyp,
# dazu die Breitenregel. Eine Spanne von 1,78 Euro trifft leicht - sie
# nuetzt nur niemandem.
zukunft["p_ist"] = [fahrpreis(m, t) for m, t in zip(zukunft.dauer_min, zukunft.typ_code)]

# AUFGABE: Aus einer Spanne in Minuten wird eine Spanne in Euro, und
# daraus die Frage, ob der tatsaechliche Preis darin liegt.
##LUECKE Zwei Preisgrenzen je Fahrt, dann der Vergleich.
def preisspanne(u, o):
    # Auch hier aus den GERUNDETEN Minuten - bewertet wird, was angezeigt
    # wuerde, nicht ein Zwischenwert, den nie jemand zu sehen bekommt.
    def euro(spalte):
        return pd.Series([fahrpreis(round(m), ty) if pd.notna(m) else np.nan
                          for m, ty in zip(zukunft[spalte], zukunft.typ_code)],
                         index=zukunft.index)
    return euro(u), euro(o)
##ENDE

def bewerten(name, u, o):
    \"\"\"Bewertet nur, was die App tatsaechlich ANZEIGEN wuerde.

    Die Breitenregel gilt je EINZELNER Spanne, nicht im Median: Eine
    Spanne ueber einem Euro wird nicht angezeigt, also darf sie auch
    nicht in die Abdeckung eingehen. Ueber den Median gerechnet haette
    ein Kandidat mit wenigen sehr breiten Spannen gut ausgesehen.
    \"\"\"
    da = zukunft[o].notna()
    von, bis = preisspanne(u, o)
    drin = (zukunft.p_ist >= von - 0.001) & (zukunft.p_ist <= bis + 0.001)
    zeigbar = da & ((bis - von) <= 1.00)
    je_typ = {ty: drin[zeigbar & (zukunft.typ_code == ty)].mean()
              for ty in sorted(zukunft[zeigbar].typ_code.unique())}
    return {
        "Auskunft (angezeigt)": zeigbar.mean(),
        "Abdeckung (angezeigt)": drin[zeigbar].mean(),
        "schlechtester Radtyp": min(je_typ.values()) if je_typ else float("nan"),
        "Breite (Median)": (bis - von)[zeigbar].median(),
        "verworfen, zu breit": (da & ~zeigbar).mean(),
    }

vergleich = pd.DataFrame({
    "Quantilregression": bewerten("Modell", "modell_von", "modell_bis"),
    "Perzentiltabelle":  bewerten("Tabelle", "von", "bis")}).T
print(vergleich.to_string(float_format=lambda x: f"{x:.3f}"))
print()
for name, s in vergleich.iterrows():
    haelt = s["Abdeckung (angezeigt)"] >= 0.80 and s["schlechtester Radtyp"] >= 0.80
    print(f"{name:22} vollstaendiges Kriterium: "
          f"{'ERFUELLT' if haelt else 'NICHT ERFUELLT'}")
"""),

MD("""
Das Ergebnis ist eindeutig, und es fällt anders aus, als die Reihenfolge der Kapitel
vermuten lässt:

- Die **Quantilregression** verwirft gut die Hälfte ihrer Spannen als zu breit. Auf dem
  Rest — knapp der Hälfte aller Anfragen — **erfüllt sie das vollständige Kriterium**,
  insgesamt wie für jeden Radtyp.
- Die **Perzentiltabelle** hält die Breitenregel per Konstruktion und antwortet seltener.
  Sie **verfehlt das Kriterium**, weil sie beim EBIKE deutlich unter 80 Prozent bleibt.

> **Gemessen am eigenen Kriterium ist damit die Quantilregression der bessere Kandidat.**
> Das gehört so gesagt, auch wenn die Entscheidung gleich anders ausfällt.

Bemerkenswert ist die Zeile *verworfen, zu breit*: Über die Hälfte ihrer Spannen wäre für
den Kunden wertlos. Was sie gut macht, ist gerade das Weglassen — sie antwortet nur dort,
wo sie eine schmale Spanne bilden kann.

Hätte man nur die Dauerabdeckung gemessen, sähen beide gut aus. Erst die vollständige
Prüfung — Preis, je Radtyp, Breite — zeigt, dass so noch kein Produkt daraus wird.

**Warum trotzdem die Tabelle?** Nicht wegen der Güte — die spricht für das Modell.
Sondern weil die App eine statische Seite ohne Python ist und kein Modell laden kann.

Weitere Unterschiede:

| | Quantilregression | Perzentiltabelle |
|---|---|---|
| kann eine **neue** Verbindung einschätzen | ja, über Luftlinie und Radtyp | nein |
| ist ohne Python lauffähig | nein | ja |
| ist von Hand prüfbar | nein | ja |
| berücksichtigt Wochentag und Saison | ja | nein |

**Wir liefern die Tabelle aus** — eingeschränkt auf den Bereich, in dem sie das
Kriterium hält, und mit dem Schweigen als Preis. Zwei Gründe:

1. Die App ist statisch und kann kein Modell laden.
2. Eine Auskunft, der jemand mit Ortskenntnis widersprechen kann, ist im Betrieb mehr
   wert als eine, die man glauben muss.

> **Und der Preis dafür steht in den Zahlen:** Die Tabelle antwortet seltener als das
> Modell und am Ende nur für CITY. Wir liefern den schwächeren Kandidaten aus, weil der
> stärkere nicht dorthin passt, wo er laufen müsste.

**Es gäbe einen dritten Weg, und er ist die nächste Runde:** die Vorhersagen des Modells
für jede Kombination aus Verbindung, Radtyp und Tageszeit **vorab ausrechnen und
tabellieren**. Dann liefe im Betrieb wieder nur eine Tabelle, gefüllt aber aus dem
besseren Verfahren. Der Preis wäre, dass die Zeilen nicht mehr für sich sprechen — man
kann eine Modellvorhersage nicht mehr nachrechnen, indem man in die Historie sieht.

Diese Abwägung — nachvollziehbar gegen treffsicher — gehört dem Auftraggeber, nicht der
Analyse. Sie ist hier ausdrücklich als offen vermerkt.

Und damit ist auch die Behauptung vom Tisch, das Modell werde wegen seiner
Verallgemeinerung auf neue Stationen gebraucht: Die Tabelle kann das nicht, und sie
verweigert die Auskunft in genau diesem Fall — was ehrlicher ist als eine Vorhersage aus
einem Nullvektor.

> **Das ist kein analytisches Scheitern.** Der Nachweis, dass eine durchschaubare Tabelle
> für den konkreten Zweck genügt, ist ein Ergebnis. Zum zweiten Mal in dieser Fallstudie
> hält eine Nachschlagetabelle mit einem Verfahren mit — in Notebook 2 wird es zum dritten
> Mal passieren.
"""),

PHASE(6, "Wie kommt das in die App — und was ist dabei noch offen?"),

MD("""
### 6.1 Die Freigabe steckt in der Tabelle

Aufgenommen wird eine Kombination nur, wenn sie drei Bedingungen erfüllt:

1. mindestens 30 Fahrten als Grundlage,
2. eine Spanne von höchstens 1,00 €,
3. und eine **auf Test 2 gemessene** Abdeckung von mindestens 80 Prozent — **insgesamt
   und je Radtyp**, dazu der Ausschluss jeder Kombination, die dort *messbar* darunter
   liegt.

> **Was diese Freigabe leistet — und was nicht.** Die 80 Prozent sind für die Tabelle
> als Ganzes und für jeden freigegebenen Radtyp gemessen. Für die **einzelne**
> Verbindung ist das keine Zusage: Die meisten Kombinationen haben im Testzeitraum nur
> eine Handvoll Fahrten, und aus acht Fahrten lässt sich keine 80-Prozent-Aussage
> ableiten. Ausgeschlossen wird deshalb, was messbar durchfällt — nicht behauptet, dass
> alles Übrige bestanden hätte.
>
> Eine echte Zusage je Verbindung bräuchte den Schattenbetrieb aus 6.6.
"""),

CODE("""
zukunft["p_ist"] = [fahrpreis(m, t) for m, t in zip(zukunft.dauer_min, zukunft.typ_code)]
hat_spanne = zukunft["bis"].notna()
z = zukunft[hat_spanne].copy()
z["im_intervall"] = (z.p_ist >= z.preis_von - 0.001) & (z.p_ist <= z.preis_bis + 0.001)
z["breite"] = z.preis_bis - z.preis_von

print(f"Abdeckung insgesamt auf Test 2: {z.im_intervall.mean():.1%}   (Kriterium 80 %)")
print(f"\\n{'Radtyp':8}{'n':>7}{'Abdeckung':>12}{'Urteil':>12}")
for t, g in z.groupby("typ_code"):
    print(f"{t:8}{len(g):>7,}{g.im_intervall.mean():>11.1%}"
          f"{'erfüllt' if g.im_intervall.mean() >= 0.80 else 'darunter':>12}")

je_komb = z.groupby(["route", "typ_code", "fenster"]).agg(
    abdeckung=("im_intervall", "mean"), n=("im_intervall", "size"),
    breite=("breite", "median"))
gross = je_komb[je_komb.n >= 20]
klein = je_komb[je_komb.n < 20]
print(f"\\nJe Kombination:")
print(f"   {len(gross):>4} mit mindestens 20 Prüffahrten - davon erfüllen "
      f"{(gross.abdeckung >= 0.80).sum()} die 80 %, {(gross.abdeckung < 0.80).sum()} nicht")
if len(gross):
    print(f"        schlechteste {gross.abdeckung.min():.0%}, beste {gross.abdeckung.max():.0%}")
print(f"   {len(klein):>4} mit WENIGER als 20 Prüffahrten "
      f"(im Median {klein.n.median():.0f}) - fuer sie laesst sich")
print(f"        ueber die einzelne Kombination nichts Belastbares sagen.")

# Was messbar durchfaellt, wird nicht ausgeliefert. Das ist KEINE Garantie
# je Kombination - fuer die Mehrzahl ist die Pruefmenge dafuer zu klein -,
# aber es waere unredlich, eine Kombination anzuzeigen, von der wir WISSEN,
# dass sie das Kriterium verfehlt.
durchgefallen = set(gross[gross.abdeckung < 0.80].index)
if durchgefallen:
    print(f"\\n   Ausgeschlossen, weil messbar unter 80 %:")
    for r, ty, fn in sorted(durchgefallen):
        print(f"        {r} / {ty} / {fn}  "
              f"({je_komb.loc[(r, ty, fn), 'abdeckung']:.0%} bei "
              f"{je_komb.loc[(r, ty, fn), 'n']:.0f} Prüffahrten)")
print(f"\\nSpannenbreite im Median: {z.breite.median():.2f} €")

# DRITTE REGEL, und sie kommt aus dieser Messung: Ein Radtyp, dessen
# Spannen die 80 Prozent nicht halten, wird nicht freigegeben - auch dann
# nicht, wenn seine Zeilen die beiden anderen Regeln erfuellen. Sie greift
# HIER und nicht erst beim Schreiben der Datei, damit die Reichweite in
# 6.2 die des ausgelieferten Artefakts ist und nicht die eines groesseren.
je_typ = z.groupby("typ_code").im_intervall.mean()
freigegebene_typen = sorted(je_typ[je_typ >= 0.80].index)
print()
for x in sorted(je_typ.index):
    print(f"   {x:8} {je_typ[x]:.1%}  "
          f"{'freigegeben' if x in freigegebene_typen else 'NICHT freigegeben'}")
tab = tab[tab.typ_code.isin(freigegebene_typen)]
z = z[z.typ_code.isin(freigegebene_typen)]

schluessel = list(zip(tab.route, tab.typ_code, tab.fenster))
tab = tab[[k not in durchgefallen for k in schluessel]]
z = z[[k not in durchgefallen
       for k in zip(z.route, z.typ_code, z.fenster)]]
"""),

MD("""
### 6.2 Die ehrliche Produktreichweite

Eine Zahl, die in der ersten Fassung fehlte und die man nicht verschweigen darf: Für wie
viele Anfragen kann die App überhaupt etwas sagen? Gezählt wird, was **tatsächlich
ausgeliefert** wird — also nach dem Ausschluss aus 6.1.
"""),

CODE("""
alle_t2 = len(test2)
mit_ziel_ohne_rund = len(zukunft)
mit_auskunft = len(z)          # nur freigegebene Radtypen und Kombinationen

print("Von allen Fahrten des Zeitraums Test 2:")
print(f"   {alle_t2:>6,}  Fahrten insgesamt (schon gefiltert: abgeschlossen, mit Ziel)")
print(f"   {mit_ziel_ohne_rund:>6,}  davon echte Wege, keine Rundtouren   "
      f"({mit_ziel_ohne_rund/alle_t2:.0%})")
print(f"   {mit_auskunft:>6,}  davon mit einer freigegebenen Spanne  "
      f"({mit_auskunft/alle_t2:.0%} aller Fahrten)")
print()
print(f"Die App kann also für {mit_auskunft/alle_t2:.0%} der Fahrten einen Preis nennen.")
print("Für den Rest sagt sie ehrlich, dass sie es nicht kann - und das ist")
print("besser als eine Zahl, die nicht trägt.")
"""),

MD("""
### 6.3 Die Tabelle bauen und ausliefern

> **Warum dreißig — und was daran schwach ist.** Dreißig Fahrten sind die Untergrenze für
> eine Zeile. Für ein 10-%- und ein 90-%-Quantil heißt das rund **drei Beobachtungen je
> Rand**; die Ränder der Spanne stehen damit auf dünnem Grund, auch wenn die Mitte gut
> belegt ist.
>
> Die Zahl ist ein Kompromiss, kein Ergebnis: Bei fünfzig fielen rund ein Drittel der
> Verbindungen weg, und die Reichweite sänke weiter unter die ohnehin knappen 23 Prozent.
> Für eine Produktfreigabe wäre der Kompromiss anders zu setzen — mit höherer
> Mindestfallzahl, Bootstrap-Intervallen für die Ränder oder einer kalibrierten
> Intervallmethode. Hier steht er so, und er steht hier, damit man ihn sieht.
"""),

CODE("""
# IDs statt Namen als Schluessel. Namen aendern sich - "Grombuehl/Klinikum"
# wurde zu "Grombühl Klinikum" -, und eine Schnittstelle, die daran haengt,
# bricht bei jeder Umbenennung. Die Namen bleiben mit drin, aber fuer die
# Anzeige, nicht als Schluessel.
id_je_name = station.set_index("name").station_id

zeilen = []
for _, g in tab.iterrows():
    start, ziel = g.route.split(" → ")
    zeilen.append(dict(start_station_id=int(id_je_name[start]),
                       ziel_station_id=int(id_je_name[ziel]),
                       startstation=start, zielstation=ziel, typ_code=g.typ_code,
                       zeitfenster=g.fenster,
                       minuten_von=int(g["von"]), minuten_bis=int(g["bis"]),
                       preis_von=round(g.preis_von, 2), preis_bis=round(g.preis_bis, 2),
                       fahrten_grundlage=int(g.n)))

freigabe_tabelle = pd.DataFrame(zeilen)
freigabe_tabelle.to_csv("preisschaetzung.csv", index=False)

# DIE KENNZAHLEN DES TATSAECHLICH AUSGELIEFERTEN ARTEFAKTS, nach allen
# Filtern. Die Werte weiter oben galten der ungefilterten Tabelle; wer
# nur die liest, berichtet etwas anderes, als er ausliefert.
print("Das ausgelieferte Artefakt:")
print(f"   Radtypen                {sorted(freigabe_tabelle.typ_code.unique())}")
print(f"   Kombinationen           {len(freigabe_tabelle)}")
print(f"   Verbindungen            "
      f"{freigabe_tabelle.groupby(['start_station_id','ziel_station_id']).ngroups}")
print(f"   Abdeckung auf Test 2    {z.im_intervall.mean():.1%}")
print(f"   Preisspanne im Median   {z.breite.median():.2f} €")
print(f"   Reichweite              {len(z)/len(test2):.1%} der Fahrten im Geltungsbereich")
print()
if len(freigabe_tabelle):
    print(freigabe_tabelle.head(6).to_string(index=False))
"""),

MD("""
### 6.4 Die Funktion, die die App aufruft

Sie verweigert die Auskunft, wenn die Kombination nicht freigegeben ist. Eine fachliche
Einschränkung, die nur im Bericht steht, ist keine.
"""),

CODE("""
# Der Schluessel sind die IDs, nicht die Namen. Ein Name aendert sich -
# aus "Grombuehl/Klinikum" wurde "Grombühl Klinikum" -, und eine
# Schnittstelle, die daran haengt, bricht bei jeder Umbenennung still.
if len(freigabe_tabelle):
    NACHSCHLAGE = freigabe_tabelle.set_index(
        ["start_station_id", "ziel_station_id", "typ_code", "zeitfenster"])
else:
    NACHSCHLAGE = pd.DataFrame().set_index(pd.MultiIndex.from_arrays([[], [], [], []]))

def preis_schaetzen(start_id, ziel_id, typ_code, stunde):
    \"\"\"Gibt die Preisspanne zurueck - oder sagt, dass sie es nicht kann.

    Angesprochen wird ueber Stations-IDs. Namen sind Anzeigewerte.
    \"\"\"
    if start_id == ziel_id:
        return {"anzeige": None, "hinweis": "Für Rundfahrten schätzen wir keinen Preis."}
    schluessel = (start_id, ziel_id, typ_code, fenster_von(stunde))
    if schluessel not in NACHSCHLAGE.index:
        return {"anzeige": None,
                "hinweis": "Für diese Verbindung liegt keine belastbare Schätzung vor."}
    z = NACHSCHLAGE.loc[schluessel]
    return {"anzeige": f"{z.preis_von:.2f} bis {z.preis_bis:.2f} €",
            "minuten": f"{z.minuten_von:.0f} bis {z.minuten_bis:.0f} Minuten",
            "grundlage": f"{z.fahrten_grundlage:.0f} vergleichbare Fahrten"}

STUNDE_JE_FENSTER = {"frueh": 8, "vormittag": 12, "nachmittag": 17, "abend": 21}
name_je_id = station.set_index("station_id").name
erste = freigabe_tabelle.iloc[0] if len(freigabe_tabelle) else None
proben = ([(int(erste.start_station_id), int(erste.ziel_station_id), erste.typ_code,
            STUNDE_JE_FENSTER[erste.zeitfenster])] if erste is not None else [])
proben += [(1, 1, "CITY", 8),        # Rundfahrt
           (6, 4, "CITY", 14),       # Verbindung ohne Freigabe
           (1, 999, "CITY", 8)]      # Station, die es nicht gibt

for probe in proben:
    e = preis_schaetzen(*probe)
    # Namen NUR fuer die Ausgabe - so herum ist es richtig.
    n1 = name_je_id.get(probe[0], f"Station {probe[0]}")
    n2 = name_je_id.get(probe[1], f"Station {probe[1]}")
    print(f"{n1} → {n2} ({probe[2]}, {probe[3]} Uhr)")
    if e["anzeige"]:
        print(f"   {e['anzeige']}   {e['minuten']}   Grundlage: {e['grundlage']}")
    else:
        print(f"   keine Anzeige - {e['hinweis']}")
"""),

MD("""
### 6.5 Überwachung — mit Grenzen, die zum Kriterium passen

In der ersten Fassung stand als Erfolgskriterium 80 Prozent, als Handlungsschwelle aber
erst 75 und 60 Prozent. Eine bereits gescheiterte Kombination wäre damit weiter angezeigt
worden. Die Grenzen sind jetzt aneinander ausgerichtet.

| Auslöser | Schwelle | Handlung |
|---|---|---|
| Abdeckung je Kombination, gleitend über 8 Wochen | **untere** Vertrauensgrenze ≥ 80 % | anzeigen |
| | Intervall überlappt 80 % | anzeigen, aber Warnung und Neuberechnung |
| | **obere** Vertrauensgrenze < 80 % | **Kombination abschalten** |
| Fallzahl je Kombination | < 20 im Fenster | keine Aussage möglich, Vorwoche weiterverwenden |
| neue Station | — | keine Zeile, also keine Anzeige |
| **Tarif ändert sich** | Minutenpreis neu | **gesamte Tabelle neu rechnen** — sie enthält Euro |
| Quartalswechsel | — | neu rechnen; im Winter sind die Ausflugsfahrten kürzer |

Die drei Fälle schließen einander aus und decken alles ab — daran war die vorige Fassung
gescheitert: Bei 78 % gemessener Abdeckung trafen „Warnung" und „Abschalten" gleichzeitig
zu, und es stand nirgends, welche Regel gewinnt.

Maßgeblich ist jetzt das **Wilson-Intervall zum Niveau 95 %**, nicht der Schätzwert:

- Liegt schon die untere Grenze bei 80 % oder darüber, ist die Kombination belegt.
- Überlappt das Intervall die 80 %, wissen wir es nicht — dann wird angezeigt und
  gewarnt. Bei 200 Fahrten und 78 % gemessener Abdeckung ist das der Fall.
- Liegt die **obere** Grenze unter 80 %, ist die Kombination widerlegt und wird
  abgeschaltet.

So entscheidet nicht eine gesetzte Ersatzschwelle, sondern die Frage, ob die Daten für
eine Aussage überhaupt reichen. Wer schneller abschalten will, braucht mehr Fahrten je
Fenster, keine andere Zahl.
### 6.6 Was ein echter Schattenbetrieb wäre — und warum wir ihn noch nicht haben

Was dieses Notebook „Test 2“ nennt, ist ein **rückblickender Test auf vergangenen
Daten**. Ein Schattenbetrieb ist etwas anderes:

1. Tabelle zu einem Stichtag einfrieren.
2. In der App das **geplante** Ziel vor dem Entsperren speichern.
3. Schätzung berechnen, aber nicht anzeigen.
4. Nach der Fahrt tatsächliches Ziel, Dauer und Preis ergänzen.
5. Geplantes gegen tatsächliches Ziel vergleichen — das ist der Test der Annahme aus dem
   Kasten ganz oben.
6. Abdeckung, Breite, Reichweite und Ablehnungsgründe je Verbindung auswerten.
7. Erst danach sichtbar schalten.

Punkt 2 und 5 sind der Kern. Ohne sie bleibt die Grundannahme dieses Notebooks ungeprüft.
"""),

MD("""
# Der Kreislauf schließt sich

| Phase | Ergebnis |
|---|---|
| 1 Business Understanding | Der Prozess wurde geändert, nicht das Verfahren. Kriterium: Preisfehler unter 50 Cent. Geltungsbereich ausdrücklich eingeschränkt |
| 2 Data Understanding | Abbrüche und Stornierungen sind keine Fahrten. Ein Fünftel endet frei im Gebiet, ein weiteres Fünftel sind Rundtouren |
| 3 Data Preparation | Zielstation erlaubt — als Stellvertreter. Wetter verboten. Vier Zeitabschnitte, zyklische Zeitmerkmale |
| 4 Modeling | Vier Baselines, dann Modelle; eine Ablation zeigt, wie wenig das Ziel beiträgt |
| 5 Evaluation | CITY hält die Grenze auf Test 1 und in allen vier Fenstern der rollierenden Prüfung. Trotzdem Rücksprung — weil der Mittelwert die einzelne Fahrt nicht abbildet und zwei Radtypen kein Produkt haben |
| 6 Deployment | Ausgeliefert wird die Tabelle, nicht das Modell — für CITY, ohne die messbar durchgefallenen Kombinationen. Kalibriert und freigegeben auf Test 2 |

**Der Rücksprung, den man hier mitverfolgen konnte**

Er kommt nicht, weil das Modell versagt hätte. Für CITY hält die 50-Cent-Grenze auf Test 1
und in allen vier Fenstern der rollierenden Prüfung. Er kommt aus zwei anderen Gründen:

> **Ein Mittelwert ist keine Erfahrung.** Bei rund jeder vierten CITY-Fahrt läge die
> angezeigte Zahl um mehr als 50 Cent daneben — der Durchschnitt sagt darüber nichts.

> **Und für zwei von drei Radtypen gäbe es überhaupt kein Produkt.** Eine Lösung nur für
> das billigste Rad beantwortet die Geschäftsfrage nicht.

Die Spanne löst den ersten Punkt. **Den zweiten löst sie nicht:** Auch das
Intervallprodukt umfasst am Ende nur CITY. Für E-Bike und Lastenrad bleibt die Frage
offen.

**Vier Sätze, die aus diesem Notebook bleiben sollten**

> Ob ein Merkmal verwendet werden darf, entscheidet der Prozess, nicht der Spaltenname.

> Das Modell ist genau, wo gefahren wird, um anzukommen, und ungenau, wo gefahren wird,
> um zu fahren.

> Ein Rücksprung ist eine neue Runde — und eine neue Runde braucht einen eigenen
> Zeitraum. Ob der auch unberührt bleibt, muss man ehrlich sagen: Test 2 trägt hier die
> Kalibrierung, nicht die unabhängige Endprüfung.

> Ausgeliefert wird, was gemessen wurde. Nicht das, was im Text steht.

**Was offen bleibt — ausdrücklich**

1. **Das geplante Ziel wird nicht erfasst.** Alle Zahlen sind Obergrenzen.
2. **Kein echter Schattenbetrieb.** Test 2 hat das Artefakt kalibriert und freigegeben —
   die unabhängige Prüfung des fertigen Artefakts steht damit noch aus.
3. **Keine Zusage je Verbindung.** Die 80 Prozent gelten insgesamt und je Radtyp.
   Ausgeschlossen ist, was messbar durchfällt; für die Mehrzahl der Kombinationen ist die
   Prüfmenge zu klein für eine Einzelaussage.
4. **Kein Wetter.** Ohne archivierte Prognosen fehlt ein vermutlich starkes Merkmal.
5. **Die Acht-Stunden-Grenze ist gesetzt, nicht belegt.**
6. **Kein Produkt für E-Bike und Lastenrad.** Weder als Zahl noch als Spanne.
7. **Der bessere Kandidat wird nicht ausgeliefert.** Die Quantilregression erfüllt das
   Kriterium und antwortet häufiger; ausgeliefert wird die Tabelle, weil die App statisch
   ist. Ihre Vorhersagen vorab zu tabellieren wäre der nächste Schritt.

**Weiter geht es mit Notebook 2 — Klassifikation:** Dort ist die Zielgröße keine Zahl
mehr, sondern eine Entscheidung, und die beiden Fehlerarten sind unterschiedlich teuer.
"""),
]
