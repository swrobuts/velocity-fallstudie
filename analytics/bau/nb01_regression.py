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
## Vier Wörter, die in dieser Reihe nicht dasselbe bedeuten

Diese sechs Notebooks liefern am Ende sehr verschiedene Dinge aus, und die Wörter dafür
werden im Alltag als Synonyme benutzt. Hier sind sie es nicht:

| Wort | Was es heißt | Was es **nicht** heißt |
|---|---|---|
| **qualifiziert** | Die vorab festgelegten Gütekriterien halten auf den vorhandenen Daten | dass jemand das Ergebnis zu sehen bekommt — dieses Notebook nennt den Zustand `GATES_HALTEN` |
| **Schattenbetrieb** | Das Verfahren rechnet mit, Ergebnisse werden protokolliert, **niemand sieht sie und niemand handelt danach** | eine abgeschwächte Freigabe |
| **Pilot** | Ein begrenzter, befristeter echter Einsatz mit benanntem Abbruchkriterium und Kontrollmöglichkeit | ein Test |
| **operativer Einsatz** | Das Ergebnis wirkt ohne weitere Prüfung auf Kundschaft, Personal oder Geld | dass das Verfahren fehlerfrei ist |

**Der Unterschied zwischen den ersten beiden ist der teuerste.** „Qualifiziert" ist eine
Aussage über Zahlen; „Schattenbetrieb" ist der Zustand, in dem man prüft, ob diese
Aussage auch trägt, wenn die Wirklichkeit dazwischenkommt. Ein Verfahren kann jede Hürde
nehmen und trotzdem im Schatten bleiben — genau das passiert in diesem Notebook.

> **Warum das nicht in einer Übersichtstabelle über alle sechs Notebooks steht.** Welchen
> Status ein einzelnes Verfahren erreicht, entscheidet seine eigene Rechnung, und die
> steht in seinem eigenen Notebook. Eine Statusübersicht an einer siebten Stelle wäre
> eine zweite Quelle, die beim nächsten Neubau veraltet. **Was hier steht, sind die
> Begriffe — nicht die Ergebnisse.**
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
> sind die Zahlen in diesem Notebook eine **optimistische Näherung** für das, was im
> Betrieb erreichbar ist: Das tatsächliche Ziel ist bereits erreicht, das geplante
> könnte davon abweichen. Eine bewiesene Obergrenze ist das nicht — dafür müsste man
> wissen, wie oft und wie stark beide auseinanderfallen.
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
| **welcher Preis** | Der Betrag, den **dieser Kunde** zahlt — nach Freiminuten, Rabatt und Deckel, nicht der Listenpreis des Radtyps |
| **Herkunft** | Grenze aus dem Produktmanagement |
| **gemessen auf** | einem Zeitraum, den das Modell beim Training nie gesehen hat |

### Der Geltungsbereich

1. **Nur abgeschlossene Fahrten.** Abbrüche und Stornierungen sind keine Fahrten.
2. **Nur Fahrten von Station zu Station.** Wer frei im Geschäftsgebiet abstellt, hat kein
   Ziel gewählt.
3. **Nur Fahrten mit verschiedenem Start und Ziel.** Bei einer Rundfahrt trägt das Ziel
   per Definition keine Information — die App wird für sie keinen Preis nennen. Wir
   nehmen sie trotzdem in die Analyse auf, um zu **zeigen**, wie weit ihre Dauer streut;
   ausgeliefert wird für sie nichts.
4. **Nur reguläre Fahrten bis acht Stunden.** Darüber liegt eine vergessene Rückgabe —
   ein eigener Geschäftsfall.

Punkt 4 ist eine Setzung, keine Messung: Wir haben keine Statusangabe, die „vergessen“
von „sehr lange unterwegs“ trennt. Sie gehört fachlich abgesichert.
"""),

CODE("""
import os
import math
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt

BASIS = os.environ.get("VELO_BASIS",
    __ROHBASIS__)

ausleihe  = pd.read_csv(BASIS + "ausleihe.csv", parse_dates=["startzeit", "endzeit"])
station   = pd.read_csv(BASIS + "station.csv")
fahrrad   = pd.read_csv(BASIS + "fahrrad.csv")
feiertag  = pd.read_csv(BASIS + "feiertage.csv", parse_dates=["datum"])
schulfrei = pd.read_csv(BASIS + "schulferien.csv", parse_dates=["von", "bis"])
preise    = pd.read_csv(BASIS + "nutzungspreis.csv")
# Die Routenmatrix haelt fuer jede Verbindung die tatsaechliche Radstrecke
# und die mittlere Steigung fest. Die Kopfzeilen mit # sind Herkunftsangaben.
routen    = pd.read_csv(BASIS + "radrouten_matrix.csv", comment="#")
# Der Preis haengt am Tarif des Kunden, nicht nur am Radtyp.
kunde     = pd.read_csv(BASIS + "kunde.csv", parse_dates=["registriert_am"])
tarife    = pd.read_csv(BASIS + "tarif.csv")

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
# Acht Stunden: gesetzte Grenze, nicht gemessene. Sie steht als
# benannte Konstante, damit sie im Modellpaket mitgeliefert wird -
# eine Grenze, die nur im Filtercode steht, kennt der Betrieb nicht.
OBERGRENZE_MINUTEN = 8 * 60
d = d[d.dauer_min <= OBERGRENZE_MINUTEN]
schritte.append(("höchstens 8 Stunden (Geltungsbereich)", len(d)))
n_vor_ziel = len(d)
d = d[d.end_station_id.notna()].copy()
schritte.append(("endet an einer Station (Geltungsbereich)", len(d)))

for name, n in schritte:
    print(f"   {name:42} {n:>7,}")
print(f"\\n   Verbleiben {len(d)/n0:.1%} der Rohdaten.")
_ = merke("anteil_frei", 1 - len(d) / n_vor_ziel)
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
_ = merke("anteil_rundtour", d.ist_rundtour.mean())
print(f"\\nRundtouren sind {d.ist_rundtour.mean():.1%} der Fahrten mit Ziel.")
print("Bei ihnen ist das Ziel gleich dem Start - es trägt per Definition")
print("keine Information über die Dauer bei, und sie streuen doppelt so stark.")

# HIER greift der Geltungsbereich aus Phase 1, nicht erst beim Ausliefern.
# Sonst lernt und misst das Notebook an einem anderen Produkt, als es
# anbietet - und die zentrale Guetezahl waere durch Faelle verzerrt, die
# die App nie bedient.
rundtouren = d[d.ist_rundtour == 1].copy()   # bleibt als Kontrast erhalten
d = d[d.ist_rundtour == 0].copy()
print()
print(f"Ab hier rechnen wir nur noch mit den {len(d):,} echten Wegen.")
print(f"Die {len(rundtouren):,} Rundtouren bleiben als Vergleichsgruppe erhalten -")
print("bewertet wird an ihnen nichts, denn angeboten wird ihnen nichts.")
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
Die Startstation allein verbessert wenig. Der große Sprung entsteht erst mit der
**Zielstation** — also mit der vollständigen Verbindung. Genau darauf setzt die neue
App-Logik: erst fragen, wohin es geht, dann schätzen. Ob das auch für ein richtiges
Modell gilt, prüfen wir in Phase 4 mit einer Ablation — der Vergleich zweier
Nachschlagetabellen ist dafür kein Beweis.
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

# Strecke und Steigung aus der Routenmatrix holen. Beide sind Eigenschaften
# der Verbindung, nicht der Fahrt - sie stehen also schon vor dem Losfahren
# fest und sind als Merkmal erlaubt.
matrix = routen.set_index(["von_id", "nach_id"])
schluessel = list(zip(d.start_station_id.astype("Int64").astype(str),
                      d.end_station_id.astype("Int64").astype(str)))
d["strecke_km"] = [matrix.strecke_m.get(s, np.nan) / 1000 for s in schluessel]
d["steigung_promille"] = [matrix.steigung_promille.get(s, np.nan) for s in schluessel]
# Rundtouren waeren hier ein Problem - Start und Ziel sind derselbe Ort, eine
# Relation gibt es nicht. Sie sind aber schon in 2.3 ausgeschieden.
#
# Jede fehlende Strecke ist deshalb jetzt ein Datenfehler. Sie stillschweigend
# auf null zu setzen wuerde ihn verstecken, deshalb hier eine Zusicherung.
fehlt = d.strecke_km.isna()
assert not fehlt.any(), (
    f"{fehlt.sum()} echte Verbindungen fehlen in der Routenmatrix: "
    f"{sorted(set(zip(d[fehlt].start_station_id, d[fehlt].end_station_id)))[:5]}")
d[["strecke_km", "steigung_promille"]] = d[["strecke_km", "steigung_promille"]].fillna(0.0)

d["datum"]  = d.startzeit.dt.normalize()
d["stunde"] = d.startzeit.dt.hour
d["wochentag"] = d.startzeit.dt.dayofweek
d["ist_wochenende"] = (d.wochentag >= 5).astype(int)
# Auch der Wochentag ist zyklisch: Sonntag und Montag liegen nebeneinander,
# als Zahlen 6 und 0 aber maximal weit auseinander.
d["wochentag_sin"] = np.sin(2 * np.pi * d.wochentag / 7)
d["wochentag_cos"] = np.cos(2 * np.pi * d.wochentag / 7)
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

# ---- Tarif und Freiminutenstand
# Der Preis haengt nicht nur am Radtyp: Jeder Tarif bringt ein monatliches
# Freiminutenkontingent und teils einen Rabatt mit. Wie viel davon noch uebrig
# ist, weiss die App zum Anfragezeitpunkt - fuer die Vergangenheit muessen wir
# es aus den bisherigen Fahrten des Monats zurueckrechnen.
#
# Gerechnet wird auf ALLEN abgeschlossenen Fahrten, nicht auf der oben
# gefilterten Menge: Auch eine Rundtour und auch eine sehr lange Fahrt
# verbrauchen Freiminuten. Wer hier auf d rechnet, bekommt zu hohe Restbestaende.
alle = ausleihe[ausleihe.status == "abgeschlossen"].sort_values("startzeit").copy()
alle["dauer_min"] = (alle.endzeit - alle.startzeit).dt.total_seconds() / 60
alle = alle.merge(kunde[["kunde_id", "tarif_code"]], on="kunde_id", how="left")
alle = alle.merge(tarife[["tarif_code", "freiminuten_pro_monat", "rabatt_prozent"]],
                  on="tarif_code", how="left")
alle["genutzt"] = alle.dauer_min - alle.berechnete_minuten
alle["monat"] = alle.startzeit.dt.to_period("M")
# Kumulieren und um die eigene Fahrt vermindern: der Stand VOR dieser Fahrt.
# Ohne diesen Versatz stuende die eigene Nutzung schon im Merkmal - ein
# Leakage, das man erst am zu guten Ergebnis bemerkt.
verbraucht = (alle.groupby(["kunde_id", "monat"]).genutzt.cumsum() - alle.genutzt)
alle["freiminuten_rest"] = (alle.freiminuten_pro_monat - verbraucht).clip(lower=0)
d = d.merge(alle[["ausleihe_id", "tarif_code", "freiminuten_pro_monat",
                  "rabatt_prozent", "freiminuten_rest"]],
            on="ausleihe_id", how="left")

echt = d
print(f"{len(d):,} Fahrten, {d.route.nunique()} Verbindungen")
print(f"Tarife: " + ", ".join(f"{t} {n:,}" for t, n in
                              d.tarif_code.value_counts().items()))
print(f"Freiminuten offen bei Fahrtbeginn: Median "
      f"{d.freiminuten_rest.median():.0f} min, "
      f"{(d.freiminuten_rest == 0).mean():.0%} der Fahrten ohne Restguthaben")
print(f"Strecke {echt.strecke_km.min():.2f} bis {echt.strecke_km.max():.2f} km, "
      f"Median {echt.strecke_km.median():.2f} km")
print(f"Steigung {echt.steigung_promille.min():+.0f} bis "
      f"{echt.steigung_promille.max():+.0f} Promille "
      f"(Hubland liegt 90 Meter über der Altstadt)")
"""),

MD("""
### 3.3 Aufteilen — entlang der Zeit, in VIER Abschnitte

Wir teilen viermal, nicht dreimal. Der Grund steht schon jetzt fest, bevor wir ein
Ergebnis gesehen haben: CRISP-DM sieht den Rücksprung von der Evaluation in die
Modellierung ausdrücklich vor. Wenn wir ihn gehen, ist die zweite Runde ein **neues
Modell** — und ein Test, auf dem bereits gemessen wurde, ist für sie kein Test mehr,
sondern Entwicklungsinformation.

Wer nur dreimal teilt, muss beim Rücksprung entweder neu erheben oder sich selbst
belügen. Der vierte Abschnitt kostet 12,5 % der Daten und erspart beides.

| Abschnitt | wofür | Regel |
|---|---|---|
| **Training** (60 %) | das Modell lernt | die ältesten Fahrten |
| **Validierung** (15 %) | wir *wählen* Verfahren und Einstellungen | mittlerer Zeitraum |
| **Test 1** (12,5 %) | die Punktschätzung wird *einmal* gemessen | danach verbraucht |
| **Test 2** (12,5 %) | die zweite Runde wird darauf **kalibriert und freigegeben** | kein Training — aber Auswahl und Filterung |

> **Test 2 ist kein finaler Test, sondern ein Kalibrierungszeitraum.** Auf ihm wird das
> Artefakt ausgewählt, über Radtypen entschieden und über einzelne Kombinationen
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
ANTEILE = [0.60, 0.75, 0.875]
g1, g2, g3 = d.startzeit.quantile(ANTEILE)
print(f"Aufgeteilt nach Zeit: {ANTEILE[0]:.0%} Training, "
      f"{ANTEILE[1]-ANTEILE[0]:.1%} Validierung, "
      f"{ANTEILE[2]-ANTEILE[1]:.1%} Test 1, {1-ANTEILE[2]:.1%} Test 2\\n")

training    = d[d.startzeit <  g1]
validierung = d[(d.startzeit >= g1) & (d.startzeit < g2)]
test1       = d[(d.startzeit >= g2) & (d.startzeit < g3)]
test2       = d[d.startzeit >= g3]

for name, teil in (("Training", training), ("Validierung", validierung),
                   ("Test 1 (Punkt)", test1), ("Test 2 (Spanne)", test2)):
    print(f"{name:16} {len(teil):>7,} Fahrten   "
          f"{teil.startzeit.min():%d.%m.%Y} bis {teil.startzeit.max():%d.%m.%Y}")
print()
print(f"Test 1 reicht von {test1.startzeit.min():%m/%Y} bis {test1.startzeit.max():%m/%Y}, Test 2 ist Sommer.")
print("Dass die beiden")
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
NUMERISCH  = ["strecke_km", "steigung_promille",
              "stunde_sin", "stunde_cos", "wochentag_sin", "wochentag_cos",
              "monat_sin", "monat_cos", "ist_wochenende",
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
> Ziel, Strecke und Steigung sind je Route konstant. Die
> Vorhersagen sind brauchbar, die **Koeffizienten aber nicht eindeutig interpretierbar**.
> Wer sie lesen will, braucht eine redundanzfreie Merkmalsmenge oder eine regularisierte
> Regression.

### 4.3 Bringt das Ziel wirklich etwas? Eine Ablation

Der Vergleich zweier Nachschlagetabellen in Phase 2 war ein Hinweis, kein Beweis. Sauber
ist es, **dasselbe Modell** einmal mit und einmal ohne die Zielmerkmale zu rechnen.
"""),

CODE("""
OHNE_ZIEL_KAT = ["start_name", "typ_code"]
OHNE_ZIEL_NUM = [s for s in NUMERISCH
                 if s not in ("strecke_km", "steigung_promille")]

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
anteil_ziel = 1 - guete[bestes] / mae_ohne
print(f"Beitrag des Ziels:               {mae_ohne - guete[bestes]:5.2f} Min "
      f"({anteil_ziel:.0%})")
merke("ablation_anteil", anteil_ziel)
_ = merke("mae_ohne_ziel", mae_ohne)  # Wert nur festhalten
print()
print("Wohin jemand faehrt, ist das mit Abstand wichtigste Merkmal: Ohne das")
print("Ziel kennt das Modell die Strecke nicht, und ohne Strecke bleibt nur")
print("der Durchschnitt. Die Geschaeftslogik - erst fragen, dann schaetzen -")
print("ist damit nicht nur richtig, sondern die Voraussetzung des Produkts.")
"""),

MD("""
### 4.4 Was der Wald findet und die Gerade nicht kann

Der Random Forest ist besser als die lineare Regression. Das allein ist kein Argument —
teurer ist er auch. Ein Verfahren, das Wechselwirkungen abbilden kann, rechtfertigt sich
erst, wenn es welche **gibt**.

Würzburg liefert eine: Das Hubland liegt rund neunzig Meter über der Altstadt. Was
kostet diese Steigung an Tempo — und kostet sie jedes Rad dasselbe?

> **Zur Lesart der Zahlen:** Wir teilen die Streckenlänge durch die Ausleihdauer. Das
> ergibt das Tempo von Station zu Station, inklusive Ampeln, Umwegen und dem An- und
> Abschließen — nicht die Geschwindigkeit auf der Strecke. Es liegt deshalb spürbar
> unter dem, was der Tacho zeigen würde. Für den Vergleich zwischen den Radtypen spielt
> das keine Rolle: Der Abzug trifft alle drei gleich.
"""),

CODE("""
echt_v = validierung.copy()
echt_v["kmh"] = echt_v.strecke_km / (echt_v.dauer_min / 60)
klassen = pd.cut(echt_v.steigung_promille, [-100, -8, -3, 3, 8, 100],
                 labels=["stark bergab", "bergab", "eben", "bergauf", "stark bergauf"])
tempo = echt_v.groupby([klassen, "typ_code"], observed=True).kmh.mean().unstack()

print("Mittleres Tempo in km/h je Steigung und Radtyp:")
print(tempo.round(1).to_string())
print()
print("Mittleres Tempo eben gegen stark ansteigend:")
for typ in tempo.columns:
    eben, berg = tempo.loc["eben", typ], tempo.loc["stark bergauf", typ]
    verlust = 1 - berg / eben
    print(f"   {typ:6} {eben:5.1f} -> {berg:5.1f} km/h   {verlust:5.1%} langsamer")
    merke(f"anstieg_{typ.lower()}", verlust)
"""),

MD("""
Auf stark ansteigenden Verbindungen liegt das mittlere Tempo des Citybikes
{{anstieg_city:.0%}} unter dem auf ebenen, beim E-Bike nur {{anstieg_ebike:.0%}}, beim
Lastenrad {{anstieg_cargo:.0%}}. Die naheliegende Erklärung ist der Motor, der die
Hangabtriebskraft abfängt — beweisen lässt sich das hier nicht, denn ansteigende
Verbindungen unterscheiden sich auch in Streckenführung, Verkehr und Anlass.

**Genau das ist eine Wechselwirkung:** Die Wirkung der Steigung hängt vom Radtyp ab. Eine
lineare Regression addiert einen festen Steigungskoeffizienten und einen festen
Radtyp-Zuschlag; sie kann nur sagen „Steigung kostet x Minuten" und „E-Bikes sind y
Minuten schneller", nicht „Steigung kostet das E-Bike weniger". Ein Baum kann es, weil er
erst nach dem Radtyp und dann innerhalb jedes Astes nach der Steigung teilt.

> **Für die Praxis:** Wer die lineare Regression behalten will, muss den
> Wechselwirkungsterm von Hand bilden — Steigung mal Radtyp als eigene Spalte. Das
> Baumverfahren findet ihn selbst. Der Preis dafür sind Koeffizienten, die man nicht
> mehr ablesen kann.
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

Die Geschäftsfrage lautet: *Was kostet **diesen Kunden** die Fahrt?* Das ist nicht der
Listenpreis des Radtyps. Zwischen beiden liegen drei Regeln aus der Preisauskunft:

| Regel | Wirkung |
|---|---|
| **Freiminuten** | Studierende haben 30, ÖPNV-Abonnenten 50, Premium 90 Minuten im Monat |
| **Rabatt** | Premium zahlt 20 % weniger auf den Restbetrag |
| **Tagesdeckel** | Startgebühr plus Zeitentgelt, gedeckelt je angefangenem Tag |

Die Startgebühr fällt **auch dann an**, wenn Freiminuten die ganze Fahrt decken.

Die Reihenfolge ist nicht beliebig: erst aufrunden, dann Freiminuten abziehen, dann
deckeln, dann rabattieren. Eine andere Reihenfolge ergibt andere Beträge.

> **Was hier getrennt bleibt.** Die Regression schätzt nur die **Dauer**. Der Preis
> entsteht daraus durch eine feste Rechenvorschrift ohne jede Unsicherheit. Diese
> Trennung ist keine Förmlichkeit: Ändert das Unternehmen morgen die Tarife, muss
> das Modell nicht neu gelernt werden.
"""),

CODE("""
tarif = preise.set_index("typ_code")

def kundenpreis(minuten, typ, freiminuten_rest, rabatt_prozent):
    \"\"\"Was der Kunde tatsächlich zahlt - Freiminuten und Rabatt eingerechnet.\"\"\"
    z = tarif.loc[typ]
    # Angefangene Minuten zählen voll: die Schätzung ist eine Kommazahl,
    # die Abrechnung kennt nur ganze Minuten.
    minuten = int(math.ceil(max(0.0, minuten)))
    berechnet = minuten - min(freiminuten_rest, minuten)
    tage = max(1, math.ceil(minuten / (24 * 60)))
    roh = min(z.startgebuehr_eur + berechnet * z.preis_pro_minute_eur,
              z.tageshoechstpreis_eur * tage)
    return round(roh * (1 - rabatt_prozent / 100.0), 2)

# Erst gegenprüfen, dann verwenden: Die Formel muss das ergeben, was in der
# Datenbank steht. Sonst bewerten wir gleich unsere eigene Rechnung statt der
# Wirklichkeit - und merken es nie.
nachgerechnet = [kundenpreis(m, t, r, ra) for m, t, r, ra
                 in zip(pruef.dauer_min, pruef.typ_code,
                        pruef.freiminuten_rest, pruef.rabatt_prozent)]
abweichung = (np.array(nachgerechnet) - pruef.entgelt_eur.values)
treffer = float((np.abs(abweichung) < 0.005).mean())
merke("tarif_treffer", treffer)
print(f"Nachgerechnetes Entgelt gegen das gespeicherte: "
      f"{treffer:.2%} exakt gleich, größte Abweichung "
      f"{np.abs(abweichung).max():.2f} €")
assert treffer > 0.999, (
    "Die Tariflogik bildet das gespeicherte Entgelt nicht ab - "
    "jede Preisaussage danach waere ohne Wert.")

# AUFGABE: Ist- und Schätzpreis je Fahrt, daraus der Betrag der Abweichung.
# NICHT die Minutendifferenz mal Preis - wegen Deckel und Freiminuten ist der
# Zusammenhang nicht überall linear.
##LUECKE Drei Zeilen: p_ist, p_geschaetzt, preisfehler.
pruef["p_ist"] = pruef.entgelt_eur
pruef["p_geschaetzt"] = [kundenpreis(m, t, r, ra) for m, t, r, ra
                         in zip(pruef.dauer_geschaetzt, pruef.typ_code,
                                pruef.freiminuten_rest, pruef.rabatt_prozent)]
pruef["preisfehler"] = (pruef.p_geschaetzt - pruef.p_ist).abs()
##ENDE

print(f"{'Radtyp':8} {'n':>6} {'Fahrt kostet':>13} {'Abweichung':>12} "
      f"{'unter 0,50 €':>13} {'Kriterium':>12}")
for t, g in pruef.groupby("typ_code"):
    pf = g.preisfehler.mean()
    print(f"{t:8} {len(g):>6,} {g.p_ist.mean():>12.2f} € {pf:>11.2f} € "
          f"{(g.preisfehler < 0.50).mean():>12.0%} "
          f"{'erfüllt' if pf < 0.50 else 'gerissen':>12}")
    if t == "CITY":
        merke("preisfehler_city", pf)
        _ = merke("city_unter_50", (g.preisfehler < 0.50).mean())
    if t == "CARGO":
        _ = merke("preisfehler_cargo", pf)

# Welche Radtypen die Grenze halten, entscheidet die Messung - nicht der
# Verfasser des Textes. Der Fliesstext holt sich die Namen von hier; damit
# kann keine Aufzaehlung mehr veralten, wenn sich die Zahlen aendern.
def aufzaehlung(namen):
    \"\"\"A, B und C - statt A und B und C.\"\"\"
    namen = list(namen)
    if len(namen) <= 1:
        return namen[0] if namen else "keiner"
    return ", ".join(namen[:-1]) + " und " + namen[-1]


_halten = sorted(t for t, g in pruef.groupby("typ_code")
                 if g.preisfehler.mean() < 0.50)
_reissen = sorted(set(pruef.typ_code.unique()) - set(_halten))
merke("typen_halten", aufzaehlung(_halten))
_ = merke("typen_reissen", aufzaehlung(_reissen))
"""),

MD("""
Für **{{typen_halten}} ist die Grenze eingehalten**, für {{typen_reissen}} nicht.

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
Quartal aussieht. Ein Kriterium, das nur in einer Jahreszeit hält, wäre keine Zusage —
also prüfen wir es über mehrere.

Wir prüfen das **innerhalb** von Training und Validierung: Test 1 ist verbraucht, und
Test 2 wurde bis hierher weder zum Anpassen noch zum Auswählen verwendet. Völlig blind
ist er trotzdem nicht — die Erkundung in Phase 2 hat den gesamten Datensatz gesehen.
Er wird ab Phase 5.6 für die zweite Runde gebraucht.
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
    pf = np.mean(np.abs(
        np.array([kundenpreis(x, "CITY", r, ra) for x, r, ra
                  in zip(vc, c.freiminuten_rest, c.rabatt_prozent)])
        - c.entgelt_eur.values))
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
Der Fehler schwankt über die vier Fenster nur um wenige Cent und bleibt überall deutlich
unter der Grenze. **Für CITY ist die Punktschätzung damit belastbar**, nicht nur einmalig
gelungen. Eine Saisonabhängigkeit, die man erwarten könnte, zeigt sich in diesen vier
Fenstern nicht — was sie über längere Zeiträume tut, sagen sie nicht.

Für CARGO gibt es dagegen bisher kein Produkt.

### 5.4 Woran es liegt
"""),

CODE("""
print("\\nDie treffsichersten und die schwierigsten Verbindungen (CITY):")
c = pruef[pruef.typ_code == "CITY"]
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

> **Das Modell ist auf Verbindungen mit enger Dauerverteilung genau und auf solchen
> mit stark streuender Dauer ungenau.**

Auf den Pendelverbindungen liegt die Anzeige um wenige Cent daneben, auf den
Verbindungen zu Dom und Residenz deutlich weiter. Dass dort der Fahrtzweck streut —
Besorgung, Spaziergang, Ausflug — ist eine plausible, aber ungeprüfte Erklärung:
Der Zweck steht in keiner Spalte.

**Die derzeit verfügbaren Merkmale reichen nicht aus, um individuelle Stopps und den
Fahrtzweck abzubilden.** Ob überhaupt keine Merkmale das könnten, wissen wir nicht —
Nutzerabsicht, Höhenprofil oder Stationsauslastung sind ungeprüfte Kandidaten.

### 5.5 Der Rücksprung — und warum er kommt, obwohl das Kriterium hält

Für CITY könnten wir jetzt ausliefern. Trotzdem springen wir zurück, und zwar aus zwei
Gründen, die nichts mit einem gerissenen Kriterium zu tun haben.

**Erstens misst das Kriterium den Durchschnitt, nicht die Erfahrung.**
{{preisfehler_city:.2f}} € im Mittel klingt gut. Die Spalte daneben sagt aber: Nur
{{city_unter_50:.0%}} der CITY-Fahrten bleiben innerhalb der 50 Cent — bei den übrigen
liegt die Anzeige darüber. Ein Kunde erlebt keinen Mittelwert, er erlebt seine Fahrt.

**Zweitens hat das Lastenrad kein Produkt.** Mit {{preisfehler_cargo:.2f}} € mittlerer
Abweichung reißt es die Grenze um ein Vielfaches. Eine Lösung, die den teuersten Radtyp
ausspart, ist keine vollständige Antwort auf die Geschäftsfrage.

Drei Wege stehen offen:

1. **Grenze lockern.** Verboten — und hier auch unnötig.
2. **Besseres Modell suchen.** Die Ablation in 4.3 zeigt, dass die Verbindung bereits
   {{ablation_anteil:.0%}} des Fehlers erklärt. Ob ein anderes Verfahren mehr aus den
   vorhandenen Spalten holt, haben wir nicht ausgeschöpft — verglichen wurden drei
   Verfahren in je einer Einstellung. Was sicher fehlt, ist der Anlass der einzelnen
   Fahrt, und der steht in keiner Spalte.
3. **Die Zusage ändern.** Statt einer Zahl, die für einen Teil der Fahrten zu genau
   klingt, eine **Spanne**, die die tatsächliche Streuung zeigt.

Der dritte Weg ändert nicht die Verfahrensklasse — eine Quantilregression ist weiterhin
Regression —, sondern das, was die App verspricht.

**Neues Erfolgskriterium, vor der Messung festgelegt.** Die Nützlichkeitsregel hat zwei
Teile, und sie messen absichtlich Verschiedenes:

- Die **Minutengrenze** misst das Modell. Die Unsicherheit entsteht bei der Dauer; dort
  gehört die Gütegrenze hin. Der Preis folgt daraus durch eine feste Rechenvorschrift.
- Die **relative Preisgrenze** misst den Nutzen für den Kunden. Eine Spanne von einem
  Euro bedeutet bei einer Zwei-Euro-Fahrt etwas anderes als bei einer Neun-Euro-Fahrt.

Eine **absolute** Euro-Grenze würde beides vermischen — und teure Radtypen ausschließen,
ohne dass das Modell dort schlechter wäre. Beim Lastenrad kostet die Minute 0,50 €, beim
Citybike 0,10 €: Ein Euro Spielraum sind dort zwei Minuten, hier zehn.

| | |
|---|---|
| **trifft** | Die angezeigte Spanne enthält den tatsächlichen Preis in mindestens **80 %** der Fälle — insgesamt *und* je Radtyp |
| **nützt** | Die Spanne umfasst höchstens **12 Minuten** *und* höchstens **60 %** des angezeigten Preises, sonst zeigt die App nichts |
| **gemessen auf** | **Test 2** — dem Zeitraum, den bis hierher nichts berührt hat |

### 5.6 Welches Artefakt? Drei Kandidaten, ehrlich verglichen

Für die Spanne gibt es drei Wege, und sie führen zu **drei verschiedenen Produkten**:
eine Quantilregression, die für jede Anfrage rechnet; eine Tabelle aus historischen
Perzentilen, die nachschlägt; und die Vorhersagen der Quantilregression, einmal vorab
ausgerechnet und ebenfalls als Tabelle abgelegt. Alle drei werden auf demselben
Kriterium gemessen, bevor entschieden wird — und mit **derselben Anzeigelogik**: ganze
Minuten, daraus der Preis, daraus die Breitenregel.
"""),

CODE("""
from sklearn.ensemble import GradientBoostingRegressor

# Alles, was VOR Test 2 liegt, darf jetzt in die Lernmenge - Test 2 ist
# der unberuehrte Zeitraum dieser zweiten Runde.
basis = pd.concat([training, validierung, test1])
# Rundtouren sind schon in Phase 2.3 ausgeschieden - hier bleibt nichts zu filtern.
zukunft = test2.copy()

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
# GROSS geschrieben, weil sie das ganze Notebook ueberdauern muessen.
# Kleingeschriebene Namen wie unten/oben werden weiter unten von den
# Wilson-Schleifen ueberschrieben - dann waere das Modell ein float, und
# der erste spaetere Zugriff bricht mit AttributeError ab.
Q_UNTEN_NIVEAU, Q_OBEN_NIVEAU = 0.10, 0.90
Q_UNTEN = pipeline(GradientBoostingRegressor(
    loss="quantile", alpha=Q_UNTEN_NIVEAU, random_state=42))
Q_OBEN  = pipeline(GradientBoostingRegressor(
    loss="quantile", alpha=Q_OBEN_NIVEAU, random_state=42))
Q_UNTEN.fit(basis[MERKMALE], basis.dauer_min)
Q_OBEN.fit(basis[MERKMALE], basis.dauer_min)
zukunft["modell_von"] = np.maximum(1.0, Q_UNTEN.predict(zukunft[MERKMALE]))
zukunft["modell_bis"] = Q_OBEN.predict(zukunft[MERKMALE])

# Kandidat 2: Perzentile je Verbindung, Radtyp und Tageszeit.
# Die Freigaberegeln gelten SOFORT und nicht erst nach der Messung: nur
# Kombinationen mit genug Fahrten und einer nuetzlich schmalen Spanne
# kommen ueberhaupt in Frage. Alles andere zu messen und danach
# wegzuwerfen haette die Abdeckung geschoenigt.
# Gruppiert wird ueber die Stations-IDs. Der Routenname bleibt als
# Anzeigewert dabei, wird aber nie wieder auseinandergenommen: Ein Name kann
# sich aendern, eine ID nicht.
gruppen = basis.groupby(["start_station_id", "end_station_id", "route",
                         "typ_code", "fenster"]).dauer_min
tab = pd.DataFrame({"von_roh": gruppen.quantile(.10), "bis_roh": gruppen.quantile(.90),
                    "n": gruppen.size()}).reset_index()

# ERST RUNDEN, DANN RECHNEN. Die App zeigt ganze Minuten an; wuerde man
# den Preis aus den ungerundeten Quantilen bilden, stuenden nebeneinander
# "5 bis 12 Minuten" und "0,60 bis 1,33 Euro" - und 12 Minuten kosten
# beim City-Bike 1,30. Zwei Angaben, die sich widersprechen, obwohl beide
# fuer sich richtig gerechnet sind.
tab["von"] = tab.von_roh.round()
tab["bis"] = tab.bis_roh.round()
# Die Tabelle haelt die DAUERspanne, nicht die Preisspanne: Der Preis haengt
# am Tarif und am Freiminutenstand des angemeldeten Kunden. Zwei Kunden auf
# derselben Strecke zahlen verschieden viel - eine Tabelle je Verbindung
# koennte das gar nicht abbilden. Die App rechnet den Preis zur Laufzeit.
#
# ---- Die Nuetzlichkeitsregel aus Phase 5.5, an EINER Stelle definiert.
# Auswahl und spaetere Ueberwachung muessen dieselbe Regel verwenden - sonst
# fliegt in der Kalibrierung etwas heraus, das im Betrieb noch angezeigt wird.
SPANNE_MAX_MIN = 12          # Guete des Modells
SPANNE_MAX_ANTEIL = 0.60     # Nutzen fuer den Kunden
MINDESTFAHRTEN = 30          # sonst ist das Perzentil geraten


def spanne_nuetzt(minuten_von, minuten_bis, preis_von, preis_bis):
    \"\"\"Ist diese Spanne schmal genug, um sie ueberhaupt anzuzeigen?\"\"\"
    mitte = (preis_von + preis_bis) / 2
    return ((minuten_bis - minuten_von <= SPANNE_MAX_MIN)
            & (preis_bis - preis_von <= SPANNE_MAX_ANTEIL * np.maximum(mitte, 0.01)))


# Fuer die Breitenregel brauchen wir dennoch einen Massstab. Wir nehmen den
# Basistarif: Er hat keine Freiminuten und keinen Rabatt und ist damit der
# TEUERSTE Fall. Wessen Spanne dort unter einem Euro bleibt, bleibt es fuer
# jeden anderen Tarif erst recht.
tab["preis_von_basis"] = [kundenpreis(m, t, 0, 0.0) for m, t in zip(tab["von"], tab.typ_code)]
tab["preis_bis_basis"] = [kundenpreis(m, t, 0, 0.0) for m, t in zip(tab["bis"], tab.typ_code)]

# Die Regel greift auf den ANGEZEIGTEN Werten. Das Runden kann eine Spanne
# knapp ueber die Grenze heben oder unter sie druecken - geprueft wird
# deshalb danach, nicht davor.
tab = tab[(tab.n >= MINDESTFAHRTEN)
          & spanne_nuetzt(tab["von"], tab["bis"],
                          tab.preis_von_basis, tab.preis_bis_basis)]
print(f"{len(tab)} Kombinationen erfuellen Mindestfallzahl und Nuetzlichkeitsregel aus Phase 5.5.")

# ---- Wie sicher ist ein Perzentil aus so wenigen Fahrten?
# Bei dreissig Beobachtungen liegt das 90-Prozent-Perzentil rechnerisch auf der
# siebenundzwanzigsten - es haengt also an den letzten drei Werten. Wie weit es
# dadurch schwanken kann, zeigt ein Bootstrap: dieselbe Gruppe immer wieder mit
# Zuruecklegen ziehen und sehen, wie das Perzentil dabei wandert.
zufall = np.random.default_rng(42)


def perzentil_streuung(werte, anteil=0.90, ziehungen=400):
    \"\"\"Wie weit wandert das Perzentil, wenn man dieselbe Gruppe neu zieht?\"\"\"
    stichproben = zufall.choice(werte, size=(ziehungen, len(werte)), replace=True)
    schaetzungen = np.quantile(stichproben, anteil, axis=1)
    return np.percentile(schaetzungen, 2.5), np.percentile(schaetzungen, 97.5)


print()
print("Unsicherheit des 90-Prozent-Perzentils, je nach Gruppengroesse:")
print(f"   {'n':>7}  {'Gruppen':>8}  {'Perzentil':>10}  {'95-%-Bereich':>14}  {'Breite':>7}")
for untergrenze, obergrenze in ((30, 49), (50, 99), (100, 10 ** 6)):
    passende = [g for _, g in basis.groupby(["route", "typ_code", "fenster"],
                                            observed=True).dauer_min
                if untergrenze <= len(g) <= obergrenze]
    if not passende:
        continue
    # Median und Streuung ueber DIESELBE Auswahl - sonst kann der Median
    # ausserhalb des Bereichs liegen, der ihn erklaeren soll.
    #
    # Frueher stand hier passende[:40] - die ERSTEN vierzig. Welche das sind,
    # haengt an der Sortierung der Gruppierung, also an etwas, das mit der
    # Sache nichts zu tun hat. Gezogen wird jetzt mit festem Startwert; bei
    # hoechstens vierzig Gruppen werden ohnehin alle genommen.
    BOOTSTRAP_GRUPPEN = 40
    if len(passende) <= BOOTSTRAP_GRUPPEN:
        stichprobe = passende
    else:
        _wahl = np.random.default_rng(42).choice(len(passende),
                                                 size=BOOTSTRAP_GRUPPEN, replace=False)
        stichprobe = [passende[i] for i in sorted(_wahl)]
    spannen = [perzentil_streuung(g.values) for g in stichprobe]
    mitte = float(np.median([np.quantile(g.values, 0.90) for g in stichprobe]))
    # Diese beiden hiessen frueher unten/oben - dieselben Namen wie die
    # beiden Quantilmodelle. Die Schleife ueberschrieb sie mit floats;
    # jeder spaetere Zugriff auf das Modell waere abgestuerzt.
    b_unten = float(np.median([s[0] for s in spannen]))
    b_oben = float(np.median([s[1] for s in spannen]))
    schild = f"{untergrenze}-{obergrenze}" if obergrenze < 10 ** 6 else f"ab {untergrenze}"
    _marke = "" if len(passende) <= BOOTSTRAP_GRUPPEN else f" (Stichprobe {len(stichprobe)})"
    print(f"   {schild:>7}  {str(len(passende)) + _marke:>8}  {mitte:>7.0f} min  "
          f"{b_unten:>6.0f}-{b_oben:<3.0f} min  {b_oben - b_unten:>4.0f} min")
    if untergrenze == 30:
        _ = merke("bootstrap_breite_30", b_oben - b_unten)

# ---- Und was kostet eine strengere Mindestfallzahl an Reichweite?
print()
print("Was eine strengere Mindestfallzahl kostet:")
print(f"   {'Mindestens':>10}  {'Kombinationen':>14}  "
      f"{'tatsaechlich angezeigt':>24}")
for schwelle in (30, 50, 100):
    probe = pd.DataFrame({"von_roh": gruppen.quantile(.10), "bis_roh": gruppen.quantile(.90),
                          "n": gruppen.size()}).reset_index()
    probe["von"], probe["bis"] = probe.von_roh.round(), probe.bis_roh.round()
    probe["pv"] = [kundenpreis(m, t, 0, 0.0) for m, t in zip(probe["von"], probe.typ_code)]
    probe["pb"] = [kundenpreis(m, t, 0, 0.0) for m, t in zip(probe["bis"], probe.typ_code)]
    probe = probe[(probe.n >= schwelle)
                  & spanne_nuetzt(probe["von"], probe["bis"], probe.pv, probe.pb)]
    bedient = zukunft.merge(
        probe[["route", "typ_code", "fenster", "von", "bis"]],
        on=["route", "typ_code", "fenster"], how="inner")
    # DIESELBE Laufzeitlogik wie das Produkt: Ohne die kundenbezogene
    # Breitenpruefung zaehlt diese Tabelle Faelle mit, die die App nie zeigt -
    # und ueberschaetzt damit den Preis der Strenge.
    if len(bedient):
        _pv = [kundenpreis(m, ty, r, ra) for m, ty, r, ra
               in zip(bedient["von"], bedient.typ_code,
                      bedient.freiminuten_rest, bedient.rabatt_prozent)]
        _pb = [kundenpreis(m, ty, r, ra) for m, ty, r, ra
               in zip(bedient["bis"], bedient.typ_code,
                      bedient.freiminuten_rest, bedient.rabatt_prozent)]
        bedient = bedient[spanne_nuetzt(bedient["von"], bedient["bis"],
                                        pd.Series(_pv, index=bedient.index),
                                        pd.Series(_pb, index=bedient.index))]
    marke = "  <- gewaehlt" if schwelle == MINDESTFAHRTEN else ""
    print(f"   {schwelle:>10}  {len(probe):>14}  {len(bedient):>17,} "
          f"({len(bedient)/len(zukunft):.0%}){marke}")
# Die Stations-IDs stehen in beiden Tabellen und meinen dasselbe. Beim
# Zusammenfuehren wuerden daraus sonst zwei Spaltenpaare mit Suffixen.
zukunft = zukunft.merge(
    tab.drop(columns=["start_station_id", "end_station_id"]),
    on=["route", "typ_code", "fenster"], how="left")

# ─── DER DRITTE KANDIDAT: DIE QUANTILE, VORAB TABELLIERT ────────────
#
# Die beiden bisherigen Kandidaten haben je einen Nachteil, und es ist
# nicht derselbe. Die Quantilregression trifft besser, braucht aber zur
# Laufzeit ein Modell - scikit-learn, Versionsstaende, ein Dienst, der
# antwortet. Die Perzentiltabelle ist eine CSV, die jedes System lesen
# kann, trifft aber schlechter.
#
# Es gibt einen dritten Weg, und er kostet nichts: die Vorhersagen des
# Modells EINMAL fuer jede Kombination ausrechnen und als Tabelle
# ablegen. Betrieblich ist das eine CSV wie die andere; inhaltlich
# steckt das Modell darin. Was dabei verloren geht, ist die Feinheit
# innerhalb einer Kombination - das Modell kennt Wochentag, Monat und
# Wetterlage, die Tabelle mittelt sie weg.
# WIE TABELLIERT MAN EIN MODELL? Nicht ueber den Medianvektor.
#
# Naheliegend waere: je Gruppe den Median jedes Merkmals bilden und diesen
# einen Vektor durch das Modell schicken. Das geht bei zyklischen Paaren
# schief - die getrennten Mediane von stunde_sin und stunde_cos ergeben
# keinen realen Zeitpunkt, sondern einen Punkt IM Kreis statt auf ihm.
# Ausserdem ist die Vorhersage am Median nicht der Median der Vorhersagen.
#
# Richtig ist der umgekehrte Weg: fuer JEDE real beobachtete Fahrt der
# Gruppe vorhersagen und die Vorhersagen dann zusammenfassen. Damit steht
# in der Tabelle, was das Modell ueber die tatsaechlich vorgekommenen
# Kontexte gesagt haette.
_schluessel = ["start_station_id", "end_station_id", "route", "typ_code", "fenster"]
_alle_vorher = basis[_schluessel + ["start_name", "ziel_name"]].copy()
_alle_vorher["_von"] = np.maximum(1.0, Q_UNTEN.predict(basis[MERKMALE]))
_alle_vorher["_bis"] = Q_OBEN.predict(basis[MERKMALE])
_vertreter = (_alle_vorher.groupby(_schluessel)
              .agg(qtab_von=("_von", "median"), qtab_bis=("_bis", "median"),
                   start_name=("start_name", "first"),
                   ziel_name=("ziel_name", "first"),
                   n=("_von", "size")).reset_index())
_vertreter["qtab_von"] = _vertreter.qtab_von.round()
_vertreter["qtab_bis"] = _vertreter.qtab_bis.round()
_vertreter["p_von"] = [kundenpreis(m, t, 0, 0.0)
                       for m, t in zip(_vertreter.qtab_von, _vertreter.typ_code)]
_vertreter["p_bis"] = [kundenpreis(m, t, 0, 0.0)
                       for m, t in zip(_vertreter.qtab_bis, _vertreter.typ_code)]
# DIESELBEN Huerden wie fuer die Perzentiltabelle - sonst vergleicht man
# zwei Tabellen mit verschiedenen Zulassungsregeln.
qtab = _vertreter[(_vertreter.n >= MINDESTFAHRTEN)
                  & spanne_nuetzt(_vertreter.qtab_von, _vertreter.qtab_bis,
                                  _vertreter.p_von, _vertreter.p_bis)]
print(f"\\nQuantiltabelle: {len(qtab)} Kombinationen (Perzentiltabelle: {len(tab)}).")
zukunft = zukunft.merge(
    qtab[["route", "typ_code", "fenster", "qtab_von", "qtab_bis"]],
    on=["route", "typ_code", "fenster"], how="left")

# Gemessen wird gegen das VOLLSTAENDIGE Kriterium aus Phase 5.5, nicht
# nur gegen die Dauerabdeckung: Preisabdeckung insgesamt UND je Radtyp,
# dazu die Breitenregel. Eine Spanne von 1,78 Euro trifft leicht - sie
# nuetzt nur niemandem.
# Die Wahrheit ist nicht unsere Formel, sondern der Betrag, der dem Kunden
# berechnet wurde. entgelt_eur ist als MERKMAL gesperrt - es entsteht erst nach
# der Fahrt. Als Massstab der Bewertung ist es genau richtig.
zukunft["p_ist"] = zukunft.entgelt_eur

# AUFGABE: Aus einer Spanne in Minuten wird eine Spanne in Euro, und
# daraus die Frage, ob der tatsaechliche Preis darin liegt.
##LUECKE Zwei Preisgrenzen je Fahrt, dann der Vergleich.
def anzeigeminuten(spalte):
    # EINE Stelle rundet. Die App zeigt ganze Minuten; alles, was danach
    # geprueft oder gerechnet wird - Preis UND Breitenregel -, muss von
    # diesen Werten ausgehen. Eine fruehere Fassung rundete nur fuer den
    # Preis und pruefte die Breite auf den ungerundeten Modellwerten: zwei
    # Anzeigelogiken fuer dieselbe Anzeige.
    return zukunft[spalte].round()


def preisspanne(u, o):
    # Je Fahrt mit dem TARIF DIESES KUNDEN, aus den ANGEZEIGTEN Minuten.
    def euro(spalte):
        return pd.Series(
            [kundenpreis(m, ty, r, ra) if pd.notna(m) else np.nan
             for m, ty, r, ra in zip(anzeigeminuten(spalte), zukunft.typ_code,
                                     zukunft.freiminuten_rest,
                                     zukunft.rabatt_prozent)],
            index=zukunft.index)
    return euro(u), euro(o)
##ENDE

# Zwei getrennt geschaetzte Quantile koennen sich theoretisch kreuzen: das
# untere ueber dem oberen. Dann waere die Spanne leer und die Anzeige unsinnig.
for _u, _o in (("modell_von", "modell_bis"), ("von", "bis"),
               ("qtab_von", "qtab_bis")):
    _kreuzt = (zukunft[_u] > zukunft[_o]).sum()
    assert _kreuzt == 0, f"{_kreuzt} gekreuzte Spannen in {_u}/{_o}"

# Eine Quote aus wenigen Faellen ist keine Zusage. Das Wilson-Intervall sagt,
# welche wahren Abdeckungen mit dem Beobachteten noch vereinbar sind - erst
# wenn seine UNTERGRENZE die Schwelle haelt, gilt eine Bedingung als erfuellt.
def wilson(treffer, gesamt, z_wert=1.96):
    if gesamt == 0:
        return 0.0, 1.0
    anteil = treffer / gesamt
    nenner = 1 + z_wert**2 / gesamt
    mitte = (anteil + z_wert**2 / (2 * gesamt)) / nenner
    rand = z_wert * math.sqrt(anteil * (1 - anteil) / gesamt
                              + z_wert**2 / (4 * gesamt**2)) / nenner
    return mitte - rand, mitte + rand


# Das Primaergate aus Phase 6.1, hier schon gebraucht: Die Gruppe, bei der die
# Schaetzung ueberhaupt in den Preis eingeht, entscheidet ueber das Produkt.
# Es gehoert deshalb in den Kandidatenvergleich - nicht erst hinter die Wahl.
GATE_PREISABHAENGIG = 0.80


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
    # Breitenregel auf den ANGEZEIGTEN Minuten - denselben, aus denen der
    # Preis gebildet wurde.
    zeigbar = da & spanne_nuetzt(anzeigeminuten(u), anzeigeminuten(o), von, bis)
    # Ueber ALLE Radtypen des Datensatzes, nicht nur ueber die angezeigten.
    # Sonst verschwindet ein Radtyp, fuer den ein Kandidat nie antwortet,
    # einfach aus der Bewertung - und der Kandidat besteht, weil er schweigt.
    alle_typen = sorted(zukunft.typ_code.unique())
    je_typ, reichweite_typ = {}, {}
    for ty in alle_typen:
        maske = zukunft.typ_code == ty
        gezeigt = zeigbar & maske
        je_typ[ty] = drin[gezeigt].mean() if gezeigt.any() else 0.0
        reichweite_typ[ty] = gezeigt.sum() / max(1, maske.sum())
    # Die Guthabenlage haengt an der Spanne DIESES Kandidaten: Wessen Guthaben
    # die obere Grenze deckt, zahlt nur die Startgebuehr - unabhaengig von der
    # Schaetzung. Ein enger schaetzender Kandidat verschiebt die Grenze.
    # Auch die Gruppenbildung aus den ANGEZEIGTEN Minuten. Sonst haengt die
    # Einteilung "preisabhaengig" an einem Wert, den die App nie zeigt.
    preisabhaengig = zeigbar & (zukunft.freiminuten_rest < anzeigeminuten(u))
    gate_unten, _ = wilson(int(drin[preisabhaengig].sum()), int(preisabhaengig.sum()))
    return {
        "Auskunft (angezeigt)": zeigbar.mean(),
        "Abdeckung (angezeigt)": drin[zeigbar].mean(),
        "preisabhaengig n": int(preisabhaengig.sum()),
        "Primaergate (Untergrenze)": gate_unten,
        "schlechtester Radtyp": min(je_typ.values()) if je_typ else float("nan"),
        "geringste Reichweite": min(reichweite_typ.values()),
        "Breite (Median)": (bis - von)[zeigbar].median(),
        "verworfen, zu breit": (da & ~zeigbar).mean(),
    }

# Vor der Messung festgelegt: Fuer jeden Radtyp muss die App in mindestens
# einem Zehntel der Anfragen ueberhaupt etwas sagen koennen. Ein Produkt, das
# fuer Lastenraeder in neunundneunzig von hundert Faellen schweigt, ist fuer
# Lastenraeder kein Produkt.
MINDESTREICHWEITE = 0.10

vergleich = pd.DataFrame({
    "Quantilregression": bewerten("Modell", "modell_von", "modell_bis"),
    "Perzentiltabelle":  bewerten("Tabelle", "von", "bis"),
    "Quantiltabelle":    bewerten("Quantiltabelle", "qtab_von", "qtab_bis")}).T
# Anteile als Prozent, Breite in Euro. Drei Nachkommastellen zwingen den
# Leser zum Kopfrechnen - und die Folien, die auf diese Tabelle zeigen,
# muessten dieselbe Umrechnung noch einmal machen. Zwei Rechenwege fuer
# dieselbe Zahl sind eine Fehlerquelle ohne Nutzen.
anzeige = vergleich.copy()
for spalte in anzeige.columns:
    if spalte.startswith("Breite"):
        anzeige[spalte] = anzeige[spalte].map(lambda x: f"{x:.2f} EUR")
    elif spalte.endswith(" n"):
        # Eine Fallzahl ist kein Anteil. Vorher stand hier "209700.0 %".
        anzeige[spalte] = anzeige[spalte].map(lambda x: f"{int(x):,}".replace(",", "."))
    else:
        anzeige[spalte] = anzeige[spalte].map(lambda x: f"{x * 100:.1f} %")
print(anzeige.to_string())
print()
for name, s in vergleich.iterrows():
    # Drei Bedingungen, nicht zwei: Wer fuer einen Radtyp fast nie antwortet,
    # erfuellt das Kriterium nicht, auch wenn die wenigen Antworten stimmen.
    haelt = (s["Abdeckung (angezeigt)"] >= 0.80
             and s["schlechtester Radtyp"] >= 0.80
             and s["geringste Reichweite"] >= MINDESTREICHWEITE
             and s["Primaergate (Untergrenze)"] >= GATE_PREISABHAENGIG)
    # Die Fallzahl gehoert neben das Urteil. Eine Quote aus dreissig Faellen
    # traegt keine Freigabe, auch wenn sie ueber der Schwelle liegt.
    n_angezeigt = int(round(s["Auskunft (angezeigt)"] * len(zukunft)))
    print(f"{name:22} auf {n_angezeigt:,} angezeigten Faellen: "
          f"vollstaendiges Kriterium {'ERFUELLT' if haelt else 'NICHT ERFUELLT'}")

# ─── DIE WAHL, ABGELEITET STATT GETIPPT ─────────────────────────────
# Ausgeliefert wird, wer alle Gates nimmt UND unter der Architekturvorgabe
# betrieben werden darf. Beides steht vorher fest; hier wird nur noch
# angewandt.
LAUFZEITDIENST_ERLAUBT = True     # Entscheidung des Auftraggebers, siehe unten
_haelt_alles = {}
for _n, _s in vergleich.iterrows():
    _haelt_alles[_n] = bool(
        _s["Abdeckung (angezeigt)"] >= 0.80
        and _s["schlechtester Radtyp"] >= 0.80
        and _s["geringste Reichweite"] >= MINDESTREICHWEITE
        and _s["Primaergate (Untergrenze)"] >= GATE_PREISABHAENGIG)
_betreibbar = ({"Quantilregression", "Perzentiltabelle", "Quantiltabelle"}
               if LAUFZEITDIENST_ERLAUBT
               else {"Perzentiltabelle", "Quantiltabelle"})
_zulaessig = [n for n in vergleich.index if _haelt_alles[n] and n in _betreibbar]
KANDIDAT = _zulaessig[0] if _zulaessig else None
merke("kandidat", KANDIDAT or "keiner")
print()
print(f"Architekturvorgabe: Laufzeitdienst "
      f"{'zugelassen' if LAUFZEITDIENST_ERLAUBT else 'NICHT zugelassen'}.")
if KANDIDAT:
    print(f"AUSGELIEFERT WIRD: {KANDIDAT}")
else:
    print("KEIN zulaessiger Kandidat: Wer die Gates nimmt, darf nicht betrieben")
    print("werden - wer betrieben werden darf, nimmt sie nicht.")

# Ab hier tragen "von" und "bis" die Spanne des AUSGELIEFERTEN Verfahrens.
# Phase 6 misst damit das Produkt, nicht einen Kandidaten daneben.
_spalten = {"Quantilregression": ("modell_von", "modell_bis"),
            "Perzentiltabelle": ("von", "bis"),
            "Quantiltabelle": ("qtab_von", "qtab_bis")}
if KANDIDAT and _spalten[KANDIDAT] != ("von", "bis"):
    _u, _o = _spalten[KANDIDAT]
    zukunft["tabelle_von"], zukunft["tabelle_bis"] = zukunft["von"], zukunft["bis"]
    zukunft["von"], zukunft["bis"] = anzeigeminuten(_u), anzeigeminuten(_o)

merke("quantil_auskunft", vergleich.loc["Quantilregression", "Auskunft (angezeigt)"])
merke("quantil_verworfen", vergleich.loc["Quantilregression", "verworfen, zu breit"])
merke("tabelle_auskunft", vergleich.loc["Perzentiltabelle", "Auskunft (angezeigt)"])
_ = merke("tabelle_schlechtester", vergleich.loc["Perzentiltabelle", "schlechtester Radtyp"])
merke("tabelle_reichweite", vergleich.loc["Perzentiltabelle", "geringste Reichweite"])
for _n, _k in (("quantil", "Quantilregression"), ("tabelle", "Perzentiltabelle"),
               ("qtab", "Quantiltabelle")):
    merke(f"{_n}_gate", vergleich.loc[_k, "Primaergate (Untergrenze)"])
merke("qtab_auskunft", vergleich.loc["Quantiltabelle", "Auskunft (angezeigt)"])
_ = merke("gate_schwelle", GATE_PREISABHAENGIG)
"""),

MD("""
### Wie sicher ist ein Perzentil aus dreißig Fahrten?

Die Mindestfallzahl von 30 ist eine Setzung, und sie ist knapp: Das 90-Prozent-Perzentil
liegt dann rechnerisch auf der siebenundzwanzigsten Beobachtung — es hängt an den letzten
drei Werten. Der Bootstrap zeigt, wie weit es dadurch wandert, wenn man dieselbe Gruppe
immer wieder mit Zurücklegen zieht.

Bei Gruppen mit 30 bis 49 Fahrten umfasst der mediane 95-Prozent-Bereich des oberen
Randes {{bootstrap_breite_30:.0f}} Minuten. Gemessen an der Nützlichkeitsregel, die der
**ganzen** Spanne höchstens zwölf Minuten zugesteht, ist das erheblich: Der Rand allein
ist fast halb so unsicher wie die Spanne breit sein darf.

**Warum wir trotzdem bei 30 bleiben:** Die Tabelle darunter zeigt den Preis der Strenge.
Bei 50 verlieren wir ein Fünftel der bedienten Anfragen, bei 100 fast die Hälfte. Das ist
eine Abwägung zwischen Schärfe und Reichweite, keine statistische Wahrheit — und sie
gehört zusammen mit der Unsicherheit in den Bericht, nicht in eine Fußnote.

> Für eine Produktfreigabe wäre der saubere Weg ein anderer: die Spanne nicht aus dem
> empirischen Perzentil zu bilden, sondern aus einem Verfahren, das seine eigene
> Unsicherheit kennt — etwa eine zeitlich kalibrierte Conformal Prediction. Das ist der
> nächste Schritt, nicht dieser.
"""),

MD("""
**Drei Kandidaten, und nur einer nimmt alle Hürden.** Entscheidend ist die Spalte
`Primaergate` — die Wilson-Untergrenze in der Gruppe, bei der die Schätzung überhaupt in
den Preis eingeht. Sie steht **im** Vergleich, nicht dahinter: Ein Kandidat, der erst
gewählt und dann am Gate gemessen wird, ist keine Wahl, sondern eine Reihenfolge.

- Die **Quantilregression** antwortet auf {{quantil_auskunft:.1%}} der Anfragen und
  erreicht am Primärgate {{quantil_gate:.1%}} gegen die geforderten
  {{gate_schwelle:.0%}}. Sie verwirft {{quantil_verworfen:.1%}} ihrer Spannen als zu
  breit — und genau dieses Weglassen macht sie gut: Sie antwortet nur dort, wo sie eine
  schmale Spanne bilden kann.
- Die **Perzentiltabelle** antwortet auf {{tabelle_auskunft:.1%}} der Anfragen, erreicht
  aber nur {{tabelle_gate:.1%}} am Primärgate. Ihre geringste Reichweite über alle
  Radtypen beträgt {{tabelle_reichweite:.1%}}.
- Die **Quantiltabelle** ist der Versuch, beides zu bekommen: die Vorhersagen des Modells
  über alle real beobachteten Kontexte einer Kombination gerechnet, zusammengefasst
  und als CSV abgelegt. Betrieblich ist sie eine
  Tabelle wie die andere. Sie antwortet auf {{qtab_auskunft:.1%}} der Anfragen — und
  erreicht am Primärgate {{qtab_gate:.1%}}, **weniger als beide anderen**.

> **Das ist das interessanteste Ergebnis dieses Abschnitts.** Die naheliegende Idee,
> das Modell zu tabellieren und so seine Güte ohne seinen Betriebsaufwand zu bekommen,
> geht nicht auf. Der Grund liegt darin, was beim Tabellieren verloren geht: Das Modell
> kennt Wochentag, Monat, Feiertag und Ferienlage und rechnet für **diese** Anfrage; die
> Tabelle mittelt sie über die Kombination weg. Was die Quantilregression über die
> Perzentiltabelle hebt, steckt also nicht im Verfahren, sondern in den Merkmalen, die
> nur zur Laufzeit verfügbar sind.
>
> **Wer die Güte will, muss den Dienst betreiben.** Das ist keine technische Fußnote,
> sondern die eigentliche Entscheidung: scikit-learn, Versionsstände und ein Dienst, der
> antwortet, gegen eine CSV, die jedes System lesen kann.

> **Warum das Kriterium die Reichweite braucht.** Ohne sie könnte ein Kandidat bestehen,
> indem er für einen ganzen Radtyp schweigt: Was er sagt, stimmt dann fast immer — er
> sagt nur nichts. Die Reichweite je Radtyp gehört deshalb mit hinein, **festgelegt vor
> der Messung**, und ein Radtyp ohne einzige Auskunft zählt als null, nicht als fehlend.

### Die Architekturvorgabe steht vor der Kandidatenwahl

**Bevor irgendein Kandidat gewählt wird, muss feststehen, was betrieben werden darf.**
Diese Reihenfolge ist nicht Formalie: Wer zuerst misst und dann entscheidet, was
betreibbar ist, wählt die Vorgabe, die zum gewünschten Kandidaten passt.

**Die Frage wurde gestellt, bevor gemessen wurde, und sie lautete:** Darf die
Preisauskunft einen Dienst aufrufen, oder muss sie eine Datei sein?

Die Antwort des Auftraggebers: **Ein Laufzeitdienst ist zulässig.** Die Begründung ist
banal und wurde lange übersehen — die App rechnet ohnehin zur Laufzeit. Sie kennt den
angemeldeten Kunden, seinen Tarif, seinen Freiminutenstand und seinen Rabatt und bildet
daraus den Preis. Wer `kundenpreis()` je Anfrage ausführt, betreibt einen Dienst; die
Frage war nie, *ob* gerechnet wird, sondern *was*.

| | Quantilregression | Perzentiltabelle | Quantiltabelle |
|---|---|---|---|
| Primärgate | **{{quantil_gate:.1%}}** ✓ | {{tabelle_gate:.1%}} ✗ | {{qtab_gate:.1%}} ✗ |
| braucht einen Laufzeitdienst | ja | nein | nein |
| von Hand nachprüfbar | nein | ja | nein |
| kennt Wochentag und Saison | ja | nein | nein |

**Damit ist die Entscheidung getroffen: Ausgeliefert wird die Quantilregression.** Sie ist
das einzige Verfahren, das alle Hürden nimmt — und unter der geltenden Vorgabe darf sie
betrieben werden.

> **Wäre die Vorgabe anders ausgefallen, wäre auch das Ergebnis ein anderes.** Bei einer
> rein statischen Architektur bliebe kein zulässiger Kandidat übrig: Beide Tabellen
> reißen das Primärgate. Dann hätte dieses Notebook mit einer Absage geendet — nicht,
> weil das Verfahren schlecht wäre, sondern weil das beste nicht betrieben werden dürfte.
>
> **Deshalb steht die Architekturfrage vor der Kandidatenwahl und nicht danach.** Wer erst
> misst und dann entscheidet, was betreibbar ist, wählt die Vorgabe, die zum gewünschten
> Ergebnis passt.

**Was der Dienst kostet, gehört in dieselbe Entscheidung.** Die Quantilregression bringt
scikit-learn, Versionsstände und einen Prozess mit, der antworten muss. Die Perzentiltabelle
bleibt deshalb als **Rückfallebene** erhalten: Fällt der Dienst aus, kann die App auf sie
zurückfallen — mit geringerer Reichweite und ohne die Zusage, aber mit einer Antwort.

Die Quantiltabelle war der Versuch, beides zu bekommen. Sie ist gebaut, gemessen — und
sie nimmt das Primärgate nicht ({{qtab_gate:.1%}} gegen {{gate_schwelle:.0%}}).

**Wie sie gebaut wird, ist dabei nicht gleichgültig.** Eine erste Fassung bildete je
Kombination den Median jedes Merkmals und schickte diesen einen Vektor durch das Modell.
Das ist falsch, und zwar aus zwei Gründen: Die getrennten Mediane von `stunde_sin` und
`stunde_cos` ergeben keinen realen Zeitpunkt — der Punkt liegt *im* Einheitskreis statt
auf ihm —, und die Vorhersage am Medianvektor ist nicht der Median der Vorhersagen. Jetzt
wird für **jede tatsächlich beobachtete Fahrt** der Gruppe vorhergesagt und erst danach
zusammengefasst. Das hebt die Untergrenze spürbar; für das Gate reicht es nicht.

Was sie zeigt, ist der Grund für ihr Scheitern: Der Schlüssel aus Verbindung, Radtyp und
Tageszeit ist zu grob für die Merkmale, aus denen das Modell seine Güte zieht — Wochentag,
Monat, Feiertag und Ferienlage werden über die Gruppe hinweg gemittelt.

> **Damit ist gezeigt, dass DIESE Materialisierung nicht genügt — nicht, dass jede
> scheitert.** Ein feinerer Schlüssel (Wochentag statt nur Tagesart, Saison statt nur
> Monat) oder zeitlich kalibrierte Conformal-Intervalle wären die nächsten Kandidaten.
> Die Schlussfolgerung bleibt bis dahin auf den geprüften Aufbau begrenzt.


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
2. eine Spanne von höchstens 12 Minuten und 60 % des Preises,
3. und eine **auf Test 2 gemessene** Abdeckung von mindestens 80 Prozent — **insgesamt
   und je Radtyp**, dazu der Ausschluss jeder Kombination, die dort *messbar* darunter
   liegt.

> **Die Gesamtquote verdeckt die Gruppe, auf die es ankommt.**
>
> Die Einteilung steht **vor** der Fahrt fest — die App kennt den Freiminutenstand und
> die geschätzte Spanne, mehr braucht sie nicht:
>
> | Lage bei der Anfrage | Fahrten | Abdeckung | Untergrenze | Spanne |
> |---|---:|---:|---:|---:|
> | Rest deckt die **obere** Grenze | {{n_gedeckt:,}} | {{abdeckung_gedeckt:.1%}} | {{unten_gedeckt:.1%}} | {{breite_gedeckt:.2f}} € |
> | Grenzfall | {{n_grenz:,}} | {{abdeckung_grenz:.1%}} | {{unten_grenz:.1%}} | {{breite_grenz:.2f}} € |
> | Rest deckt die **untere** Grenze nicht | {{n_offen:,}} | {{abdeckung_offen:.1%}} | **{{unten_offen:.1%}}** | {{breite_offen:.2f}} € |
>
> In der ersten Gruppe deckt das Guthaben die **angezeigte obere Grenze**. Innerhalb
> der Spanne ist der Preis damit die Startgebühr, unabhängig von der Dauer. Wer diese
> Grenze überfährt, zahlt trotzdem Minuten — deshalb stehen dort
> {{abdeckung_gedeckt:.1%}} und nicht hundert Prozent. Die dritte Gruppe, {{anteil_preisabhaengig:.0%}} der Anfragen, zahlt
> nach Minuten: **Nur dort leistet die Schätzung überhaupt etwas.** Und dort liegt die
> Untergrenze des Vertrauensbereichs **unter der zugesagten Schwelle von 80 Prozent**.
>
> **Für die Gruppe, auf die es ankommt, ist die Zusage damit nicht statistisch
> gestützt.** Die Gesamtquote von {{abdeckung_gesamt:.1%}} verdeckt das vollständig. Wer
> nur sie berichtet, verspricht etwas, das die Daten nicht hergeben.
>
> Diese Gruppe ist die **vorab festgelegte Evaluationsgruppe**: An ihr, nicht am
> Gesamtmittel, entscheidet sich, ob das Produkt trägt. Sie nachträglich über die
> tatsächliche Dauer abzugrenzen wäre bequemer und wertlos — die App kennt die
> tatsächliche Dauer nicht.

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
zukunft["p_ist"] = zukunft.entgelt_eur
hat_spanne = zukunft["bis"].notna()
z = zukunft[hat_spanne].copy()
# Aus der Dauerspanne wird die Preisspanne DIESES Kunden. Weil die Tariflogik
# monoton ist - mehr Minuten kosten nie weniger -, ueberträgt sie die Abdeckung
# der Dauer unveraendert auf den Preis.
z["preis_von"] = [kundenpreis(m, ty, r, ra) for m, ty, r, ra
                  in zip(z["von"], z.typ_code, z.freiminuten_rest, z.rabatt_prozent)]
z["preis_bis"] = [kundenpreis(m, ty, r, ra) for m, ty, r, ra
                  in zip(z["bis"], z.typ_code, z.freiminuten_rest, z.rabatt_prozent)]

# GEMESSEN WIRD NUR, WAS DIE APP AUCH ZEIGEN WUERDE. Der Vorabfilter der
# Tabelle rechnet mit dem Basistarif. Das ist fuer die absolute Breite der
# teuerste Fall, aber NICHT fuer die relative: Deckt das Guthaben die kurze
# Fahrt und die lange nicht mehr, steht der blossen Startgebuehr ein voller
# Minutenpreis gegenueber - die Spanne ist dann relativ breiter als im
# Basistarif. Ohne diese zweite Pruefung wuerde die App Faelle anzeigen, die
# diese Messung nie gesehen hat.
zeigt_die_app = spanne_nuetzt(z["von"], z["bis"], z.preis_von, z.preis_bis)
verworfen = int((~zeigt_die_app).sum())
print(f"{verworfen:,} von {len(z):,} Faellen sind fuer den jeweiligen Tarif zu breit "
      f"({verworfen / max(1, len(z)):.2%}) - sie zeigt die App nicht,")
print("also gehen sie auch nicht in Abdeckung und Reichweite ein.")
_ = merke("kundenspezifisch_verworfen", verworfen / max(1, len(z)))
z = z[zeigt_die_app].copy()

z["im_intervall"] = (z.p_ist >= z.preis_von - 0.001) & (z.p_ist <= z.preis_bis + 0.001)
z["breite"] = z.preis_bis - z.preis_von

_ = merke("abdeckung_gesamt", z.im_intervall.mean())
print(f"Abdeckung insgesamt auf Test 2: {z.im_intervall.mean():.1%}   (Kriterium 80 %)")
print()
print(f"{'Radtyp':8}{'n':>7}{'Abdeckung':>12}{'95 %-Intervall':>18}{'Urteil':>14}")
for t, g in z.groupby("typ_code"):
    unten, oben = wilson(g.im_intervall.sum(), len(g))
    urteil = ("erfüllt" if unten >= 0.80 else
              "unsicher" if oben >= 0.80 else "darunter")
    print(f"{t:8}{len(g):>7,}{g.im_intervall.mean():>11.1%}"
          f"{unten:>10.1%}–{oben:.1%}{urteil:>14}")
    merke(f"abdeckung_{t.lower()}", g.im_intervall.mean())
    merke(f"unten_{t.lower()}", unten)
    merke(f"n_{t.lower()}", len(g))

# Die zweite Aufteilung ist die wichtigere - und sie muss VORAB moeglich sein.
# Ob die Freiminuten gereicht haben, weiss man erst nach der Fahrt; das taugt
# fuer eine Nachbetrachtung, nicht fuer eine betriebliche Zusage. Die App kennt
# zum Anfragezeitpunkt nur zwei Dinge: den Restbestand und die geschaetzte
# Dauerspanne. Daraus laesst sich schon vorher entscheiden:
#
#   Rest >= obere Grenze  -> selbst die laengste erwartete Fahrt ist gedeckt.
#                            Der Preis ist die Startgebuehr, die Dauer geht gar
#                            nicht ein - jede Schaetzung trifft.
#   Rest <  untere Grenze -> selbst die kuerzeste kostet Minuten. Hier haengt
#                            der Preis voll an der Schaetzung.
#   dazwischen            -> Grenzfall: ob Minuten anfallen, entscheidet sich
#                            erst waehrend der Fahrt.
z["guthabenlage"] = np.where(
    z.freiminuten_rest >= z["bis"], "vorab gedeckt",
    np.where(z.freiminuten_rest < z["von"], "vorab preisabhaengig", "Grenzfall"))
merke("anteil_preisabhaengig", (z.guthabenlage == "vorab preisabhaengig").mean())

print(f"\\n{'Guthabenlage (vorab)':24}{'n':>7}{'Abdeckung':>12}"
      f"{'95 %-Intervall':>18}{'Breite':>9}")
for lage in ("vorab gedeckt", "Grenzfall", "vorab preisabhaengig"):
    g = z[z.guthabenlage == lage]
    if not len(g):
        continue
    unten, oben = wilson(g.im_intervall.sum(), len(g))
    print(f"{lage:24}{len(g):>7,}{g.im_intervall.mean():>11.1%}"
          f"{unten:>10.1%}–{oben:.1%}{g.breite.median():>8.2f}€")
    kurz = {"vorab gedeckt": "gedeckt", "Grenzfall": "grenz",
            "vorab preisabhaengig": "offen"}[lage]
    merke(f"abdeckung_{kurz}", g.im_intervall.mean())
    merke(f"n_{kurz}", len(g))
    merke(f"breite_{kurz}", g.breite.median())
    _ = merke(f"unten_{kurz}", unten)

# Die vorab preisabhaengige Gruppe ist die Evaluationsgruppe, die vor der
# Messung festzulegen war: An ihr entscheidet sich, ob das Produkt taugt.
# DAS PRIMAERGATE. Es steht vor der Messung fest und entscheidet ueber die
# Freigabe - nicht die Gesamtquote, die von den gedeckten Fahrten getragen
# wird und ueber die Dauerprognose fast nichts aussagt.
GATE_PREISABHAENGIG = 0.80

offen = z[z.guthabenlage == "vorab preisabhaengig"]
unten_o, _ = wilson(offen.im_intervall.sum(), len(offen)) if len(offen) else (0.0, 0.0)
PRIMAERGATE_BESTANDEN = bool(unten_o >= GATE_PREISABHAENGIG)
merke("gate_untergrenze", unten_o)
merke("gate_urteil", "bestanden" if PRIMAERGATE_BESTANDEN else "nicht bestanden")
merke("gate_luecke", max(0.0, (GATE_PREISABHAENGIG - unten_o) * 100))
_ = merke("n_gesamt", len(z))
# Dieselbe Gruppe je Radtyp - als DIAGNOSE. Ob sie bindet, ist eine Frage
# der Produktzusage und in Phase 1 entschieden, nicht hier.
print("\\nDieselbe Gruppe je Radtyp (Diagnose, nicht bindend):")
_je_typ_offen = []
for _ty in sorted(offen.typ_code.unique()):
    _g = offen[offen.typ_code == _ty]
    _u, _o = wilson(int(_g.im_intervall.sum()), len(_g))
    _je_typ_offen.append((_ty, len(_g), _g.im_intervall.mean(), _u))
    print(f"   {_ty:6s} {len(_g):>6,d} Faelle   Abdeckung {_g.im_intervall.mean():>6.1%}"
          f"   Untergrenze {_u:>6.1%}"
          f"   {'haelt' if _u >= GATE_PREISABHAENGIG else 'HAELT NICHT'}".replace(",", "."))
_schwaechster = min(_je_typ_offen, key=lambda z: z[3])
merke("offen_kleinste_gruppe", min(z[1] for z in _je_typ_offen))
merke("offen_schwaechster_typ", _schwaechster[0])
merke("offen_schwaechste_grenze", _schwaechster[3])
merke("offen_typen_halten", sum(1 for z in _je_typ_offen if z[3] >= GATE_PREISABHAENGIG))
merke("offen_typen_gesamt", len(_je_typ_offen))

print(f"\\nPRIMAERGATE - vorab preisabhaengige Gruppe:")
print(f"   Untergrenze {unten_o:.1%} gegen geforderte "
      f"{GATE_PREISABHAENGIG:.0%}  ->  "
      f"{'BESTANDEN' if PRIMAERGATE_BESTANDEN else 'NICHT BESTANDEN'}")

# Was 6.5 zur Ueberwachung braucht, muss das Artefakt mitbringen: je Zeile die
# Zahl der Pruefungen, die gemessene Abdeckung und die Unsicherheit. Ohne diese
# Spalten laesst sich spaeter nicht sagen, ob ein Ruecklauf ein echtes Problem
# ist oder das Rauschen von zwoelf Faellen.
belege = z.groupby(["start_station_id", "end_station_id", "typ_code", "fenster"]).agg(
    test2_fahrten=("im_intervall", "size"),
    test2_abdeckung=("im_intervall", "mean")).reset_index()
belege[["test2_untergrenze", "test2_obergrenze"]] = [
    wilson(round(a * n_), n_) for a, n_
    in zip(belege.test2_abdeckung, belege.test2_fahrten)]
# Eine einzige Stelle entscheidet ueber den Status - und dieselbe Funktion
# entscheidet spaeter, ob die App antworten darf. Ein Status, der nur in einer
# Spalte steht und nirgends sperrt, ist keine Freigabelogik, sondern Zierrat.
MINDESTFAHRTEN_FREIGABE = 20
# Nur "widerlegt" wird gesperrt. Was zu duenn ist, um beurteilt zu werden,
# faellt unter die aggregierte Zusage je Radtyp - das ist eine
# Produktentscheidung, und sie steht im Text, nicht nur im Code.
AUSLIEFERBAR = ("gestuetzt", "unbestimmt", "unzureichend")


def freigabestatus(treffer, anzahl):
    \"\"\"Was laesst sich ueber DIESE Kombination sagen?\"\"\"
    if anzahl < MINDESTFAHRTEN_FREIGABE:
        return "unzureichend"          # zu duenn fuer eine eigene Aussage
    unten, oben = wilson(treffer, anzahl)
    if unten >= 0.80:
        return "gestuetzt"
    if oben < 0.80:
        return "widerlegt"             # gesperrt
    return "unbestimmt"


belege["freigabestatus"] = [
    freigabestatus(round(a * n_), n_)
    for a, n_ in zip(belege.test2_abdeckung, belege.test2_fahrten)]
print(f"\\nBelege je Kombination: {len(belege)} Zeilen")
for status, anzahl in belege.freigabestatus.value_counts().items():
    print(f"   {status:14} {anzahl:4d}"
          + ("   -> wird gesperrt" if status not in AUSLIEFERBAR else ""))

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
je_typ_n = z.groupby("typ_code").im_intervall.size()
# Auch hier die Untergrenze, nicht der Punktschaetzer: Ein Radtyp mit 81 %
# aus vierzig Fahrten ist nicht freigegeben, sondern unsicher.
freigegebene_typen = sorted(
    ty for ty in je_typ.index
    if wilson(int(round(je_typ[ty] * je_typ_n[ty])), int(je_typ_n[ty]))[0] >= 0.80)

# Die Radtypfreigabe ist notwendig, aber nicht hinreichend. Ueber das PRODUKT
# entscheidet das Primaergate: Halten die Fahrten, bei denen die Schaetzung
# ueberhaupt in den Preis eingeht, die zugesagten 80 Prozent? Wenn nicht, wird
# die Tabelle gebaut - aber nicht freigegeben.
# ─── EINE STATUSQUELLE FUER DAS GANZE NOTEBOOK ──────────────────────
#
# Drei Stufen, und sie sind NICHT dasselbe. Die Namen sind dieselben wie
# im Begriffskasten ganz oben:
#
#   gesperrt   - die Gates halten nicht; es entsteht kein Produkt
#   schatten   - qualifiziert, aber unabhaengig ungeprueft: Der Dienst
#                rechnet und protokolliert und zeigt nach aussen nichts
#   sichtbar   - die Anzeige ist fuer Kundinnen und Kunden freigeschaltet
#
# "qualifiziert" ist dabei kein eigener Status, sondern die Bedingung
# fuer die beiden oberen: GATES_HALTEN. Ob daraus "schatten" oder
# "sichtbar" wird, entscheidet die zweite Frage - ob unabhaengig
# geprueft wurde.
#
# Warum nicht direkt sichtbar? Weil Test 2 die Intervalle KALIBRIERT hat.
# Derselbe Zeitraum kann nicht zugleich Kalibrierung und unabhaengige
# Endpruefung sein - das ist die Lehre dieses Notebooks, und sie gilt auch
# fuer sein eigenes Ergebnis. Die unabhaengige Pruefung steht aus; bis
# dahin laeuft der Dienst im Schatten.
GATES_HALTEN = bool(PRIMAERGATE_BESTANDEN and len(freigegebene_typen) == 3)
UNABHAENGIG_GEPRUEFT = False      # kein prospektiver Zeitraum mit Wunschziel
PRODUKTSTATUS = ("sichtbar" if (GATES_HALTEN and UNABHAENGIG_GEPRUEFT)
                 else "schatten" if GATES_HALTEN else "gesperrt")
merke("produktstatus", PRODUKTSTATUS)
merke("statussatz", {
    "sichtbar": "die Anzeige ist freigeschaltet",
    "schatten": "der Dienst rechnet und protokolliert, zeigt aber noch nichts an",
    "gesperrt": "der Dienst ist gesperrt",
}[PRODUKTSTATUS])
merke("gates_halten", "ja" if GATES_HALTEN else "nein")

# Die App zeigt nur im Status "sichtbar" etwas an. Im Schattenbetrieb
# rechnet sie, protokolliert und schweigt nach aussen.
PRODUKT_FREIGEGEBEN = PRODUKTSTATUS == "sichtbar"
SCHATTENBETRIEB = PRODUKTSTATUS == "schatten"
_ = merke("produkt_freigegeben", "ja" if PRODUKT_FREIGEGEBEN else "nein")
merke("typen_freigegeben", aufzaehlung(freigegebene_typen))
_ = merke("anzahl_typen_freigegeben", len(freigegebene_typen))
print()
for x in sorted(je_typ.index):
    print(f"   {x:8} {je_typ[x]:.1%}  "
          f"{'Radtypgate erfuellt' if x in freigegebene_typen else 'Radtypgate gerissen'}"
          f"   Status: {PRODUKTSTATUS}")
tab = tab[tab.typ_code.isin(freigegebene_typen)]
z = z[z.typ_code.isin(freigegebene_typen)]

schluessel = list(zip(tab.route, tab.typ_code, tab.fenster))
tab = tab[[k not in durchgefallen for k in schluessel]]
z = z[[k not in durchgefallen
       for k in zip(z.route, z.typ_code, z.fenster)]]
"""),

MD("""
### 6.2 Die ehrliche Produktreichweite

Eine Zahl, die man nicht verschweigen darf: Für wie viele Anfragen kann die App
überhaupt etwas sagen? Ein Kriterium, das nur für die beantworteten Fälle gilt, sagt
nichts über die Reichweite.

**Zwei Zahlen, die man auseinanderhalten muss** — und die Verwechslung ist der häufigste
Fehler in Produktberichten:

| | |
|---|---:|
| **reale Reichweite** — was die App tatsächlich anzeigt | {{reichweite_real:.0%}} |
| **potenzielle Reichweite** — was im Artefakt eine Spanne hat | {{reichweite_potenziell:.0%}} |

Hier fallen beide zusammen, weil das Produkt freigegeben ist: Was eine Spanne hat, wird
auch gezeigt. **Das ist der Ausnahmefall, nicht der Normalfall.** Bei gesperrtem Produkt
wäre die erste Zahl null und die zweite unverändert — und ein Bericht, der nur die zweite
nennt, läse sich wie eine Leistung, obwohl niemand etwas sieht.

Zum Vergleich: Die Perzentiltabelle käme auf {{tabelle_auskunft:.1%}}, die Quantiltabelle
auf {{qtab_auskunft:.1%}}. Beide dürfen nicht ausgeliefert werden — nicht wegen der
Reichweite, sondern weil sie das Primärgate reißen. **Reichweite ist kein Ersatz für
Güte**, und die größere Reichweite der ausgelieferten Regression ist ein Nebeneffekt,
kein Argument.
"""),

CODE("""
alle_t2 = len(test2)
mit_ziel_ohne_rund = len(zukunft)
mit_auskunft = len(z)          # nur freigegebene Radtypen und Kombinationen

# ZWEI REICHWEITEN, UND SIE DUERFEN NICHT VERWECHSELT WERDEN.
#
# Die POTENZIELLE Reichweite zaehlt, fuer wie viele Fahrten das Artefakt
# eine Spanne enthaelt. Die REALE zaehlt, fuer wie viele die App sie auch
# anzeigt - und solange der Freigabestatus sperrt, ist das keine einzige.
# Eine fruehere Fassung druckte hier nur die erste Zahl und schrieb "die
# App kann fuer 54 % der Fahrten einen Preis nennen". Das stimmte fuer das
# Artefakt und war fuer das Produkt falsch.
real = mit_auskunft if PRODUKT_FREIGEGEBEN else 0

print("Von allen Fahrten des Zeitraums Test 2:")
print(f"   {alle_t2:>6,}  Fahrten insgesamt (schon gefiltert: abgeschlossen, mit Ziel)")
print(f"   (Rundtouren sind schon in Phase 2.3 ausgeschieden)")
print(f"   {mit_auskunft:>6,}  davon mit einer erzeugten Spanne im Artefakt  "
      f"({mit_auskunft/alle_t2:.0%} aller Fahrten)")
print(f"   {real:>6,}  davon zeigt die App tatsaechlich an  "
      f"({real/alle_t2:.0%} aller Fahrten)")
print()
merke("reichweite_potenziell", mit_auskunft / alle_t2)
merke("reichweite_real", real / alle_t2)
if PRODUKT_FREIGEGEBEN:
    print(f"Das Produkt ist freigegeben: Die App nennt fuer {real/alle_t2:.0%} der")
    print("Fahrten einen Preis. Fuer den Rest sagt sie ehrlich, dass sie es")
    print("nicht kann - und das ist besser als eine Zahl, die nicht traegt.")
else:
    print(f"Das Produkt ist GESPERRT. Die App nennt fuer {real/alle_t2:.0%} der Fahrten")
    print(f"einen Preis - nicht fuer {mit_auskunft/alle_t2:.0%}. Die zweite Zahl beschreibt,")
    print("was das Artefakt enthaelt; die erste, was geschieht.")
    print()
    print("Diese Unterscheidung ist der haeufigste Fehler in Produktberichten:")
    print("Die potenzielle Reichweite eines gesperrten Artefakts liest sich wie")
    print("eine Leistung, ist aber eine Moeglichkeit.")
"""),

MD("""
### 6.3 Zwei Artefakte — und nur eines ist das Produkt

Am Ende dieser Phase entstehen **zwei** Dateien, und sie zu verwechseln wäre der
folgenreichste Fehler dieses Notebooks:

| Artefakt | was es ist | Zusage |
|---|---|---|
| `modellpaket_preisspanne.joblib` | **das ausgelieferte Verfahren** — beide Quantilmodelle mit Vorverarbeitung, Merkmalsreihenfolge, Radtypen, Gate-Status, Gültigkeitszeitraum | {{gate_schwelle:.0%}}, belegt mit {{gate_untergrenze:.1%}} |
| `preisschaetzung.csv` | die **Rückfalltabelle** aus den historischen Perzentilen — Notbehelf bei Dienstausfall | **keine** — sie nimmt das Primärgate nicht ({{tabelle_gate}}) |

Warum das getrennt gehört: Die Tabelle *sieht aus* wie das Produkt. Sie hat dieselben
Spalten, dieselben Verbindungen, dieselbe Anzeigeform. Sie hält die Zusage aber nicht —
und ein Rückfall, der dieselbe Zusage anzeigt wie das Produkt, ist kein Rückfall, sondern
ein zweites, ungeprüftes Produkt. Die Schnittstelle in 6.4 gibt deshalb bei jeder Antwort
`quelle` und `zusage` mit zurück; im Rückfall steht dort ausdrücklich keine Zusage.

**Ein Beipackzettel gehört zum Modell.** Ein `.joblib` allein ist nicht auslieferbar: Wer
die Merkmalsreihenfolge verliert, bekommt Vorhersagen, die aussehen wie Vorhersagen und
falsch sind. Deshalb liegt neben dem Paket eine lesbare `.json` mit denselben Angaben —
für Menschen, die wissen wollen, was sie da betreiben.

**Und was liest die Website heute?** Die Rückfalltabelle. Der Ladeweg
`db/betrieb/preisschaetzung_laden.py` füllt `velocity.preisschaetzung`, die Website liest
`v_preisschaetzung`. Solange der Laufzeitdienst im Schattenbetrieb läuft, ist das
konsequent — nur darf die Website dann auch nur das anzeigen, was die Tabelle trägt.

### 6.3a Die Tabelle bauen

> **Warum dreißig — und was daran schwach ist.** Dreißig Fahrten sind die Untergrenze für
> eine Zeile. Für ein 10-%- und ein 90-%-Quantil heißt das rund **drei Beobachtungen je
> Rand**; die Ränder der Spanne stehen damit auf dünnem Grund, auch wenn die Mitte gut
> belegt ist.
>
> Die Zahl ist ein Kompromiss, kein Ergebnis: Bei fünfzig fielen rund ein Drittel der
> Verbindungen weg, und die potenzielle Reichweite sänke weiter unter die ohnehin
> knappen {{reichweite_potenziell:.0%}}.
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
name_je_id = station.set_index("station_id").name

# Versionskennungen, die sich aendern, wenn sich etwas aendert. Die Summe der
# Minutenpreise taugt dafuer nicht: Sie ignoriert Startgebuehr und Deckel und
# bliebe gleich, wenn zwei Preise gegenlaeufig angepasst wuerden.
import hashlib

def kennung(rahmen, laenge=12):
    roh = rahmen.sort_index(axis=1).to_csv(index=False).encode("utf-8")
    return hashlib.sha256(roh).hexdigest()[:laenge]

TARIFVERSION = kennung(pd.concat([preise, tarife], axis=0, ignore_index=True))
# Bewusst OHNE den Ladepfad: Ob lokal gebaut oder von GitHub geladen, dieselben
# Daten muessen dieselbe Kennung ergeben.
# Drei Kennzahlen reichen nicht. Eine geaenderte einzelne Zeile, die weder
# die Anzahl noch die spaeteste Startzeit noch die Entgeltsumme verschiebt,
# bliebe unbemerkt - und genau solche Aenderungen macht man beim Nachbessern.
# Gehasht wird deshalb der INHALT jeder Eingabedatei.
def dateikennung(name, laenge=12):
    # SHA-256 des Dateiinhalts - unabhaengig davon, wie pandas ihn liest.
    import urllib.request
    quelle = BASIS + name
    try:
        if quelle.startswith("http"):
            with urllib.request.urlopen(quelle, timeout=30) as f:
                roh = f.read()
        else:
            roh = open(quelle, "rb").read()
    except Exception:                                    # noqa: BLE001
        return "nicht-lesbar"
    return hashlib.sha256(roh).hexdigest()[:laenge]

EINGABEDATEIEN = ["ausleihe.csv", "station.csv", "fahrrad.csv",
                  "nutzungspreis.csv", "tarif.csv", "radrouten_matrix.csv"]
EINGABEKENNUNGEN = {n: dateikennung(n) for n in EINGABEDATEIEN}
DATENVERSION = kennung(pd.DataFrame({
    "datei": list(EINGABEKENNUNGEN), "hash": list(EINGABEKENNUNGEN.values())}))

print(f"Tarifversion {TARIFVERSION}   Datenversion {DATENVERSION}")
print("\\nEingabedateien - SHA-256 (12 Stellen):")
for _n, _h in EINGABEKENNUNGEN.items():
    print(f"   {_n:<22s} {_h}")
print("\\nEine geaenderte Zeile in einer dieser Dateien aendert die Datenversion.")
print("Die drei Kennzahlen der frueheren Fassung - Anzahl, letzte Startzeit,")
print("Entgeltsumme - haetten sie nicht bemerkt.")

zeilen = []
for _, g in tab.iterrows():
    # Die IDs stehen in der Tabelle, seit sie durch die Gruppierung mitgefuehrt
    # werden. Sie aus dem Anzeigenamen zurueckzuspalten waere von einem
    # Trennzeichen abhaengig, das in keinem Stationsnamen vorkommen darf.
    start, ziel = g.start_station_id, g.end_station_id
    zeilen.append(dict(start_station_id=int(start),
                       ziel_station_id=int(ziel),
                       startstation=name_je_id[start], zielstation=name_je_id[ziel],
                       typ_code=g.typ_code,
                       zeitfenster=g.fenster,
                       minuten_von=int(g["von"]), minuten_bis=int(g["bis"]),
                       # Der Basistarif ist der teuerste Fall: keine
                       # Freiminuten, kein Rabatt. Die App rechnet daraus den
                       # Preis des angemeldeten Kunden.
                       preis_von_basis=round(g.preis_von_basis, 2),
                       preis_bis_basis=round(g.preis_bis_basis, 2),
                       fahrten_grundlage=int(g.n),
                       datenstand=str(d.startzeit.max().date()),
                       tarifversion=TARIFVERSION,
                       datenversion=DATENVERSION,
                       # Die Perzentile stammen aus training + validierung +
                       # test1, nicht nur aus dem Training. Ein Feld namens
                       # "trainingsende" haette darueber getaeuscht.
                       produktfreigabe=("frei" if PRODUKT_FREIGEGEBEN
                                        else "gesperrt_primaergate"),
                       lernbasis_bis=str(basis.startzeit.max().date()),
                       kalibrierung_bis=str(test2.startzeit.max().date())))

freigabe_tabelle = pd.DataFrame(zeilen)
# Die Belege aus Test 2 wandern in dieselbe Datei: Wer die Tabelle betreibt,
# sieht je Zeile, worauf ihre Freigabe beruht.
freigabe_tabelle = freigabe_tabelle.merge(
    belege.rename(columns={"end_station_id": "ziel_station_id",
                           "fenster": "zeitfenster"}),
    on=["start_station_id", "ziel_station_id", "typ_code", "zeitfenster"],
    how="left")
freigabe_tabelle[["test2_abdeckung", "test2_untergrenze", "test2_obergrenze"]] = (
    freigabe_tabelle[["test2_abdeckung", "test2_untergrenze",
                      "test2_obergrenze"]].round(4))
freigabe_tabelle["freigabestatus"] = freigabe_tabelle.freigabestatus.fillna(
    "ungeprueft")
# Was der Status sperrt, wird nicht ausgeliefert. Sonst waere er eine Spalte
# ohne Wirkung - und die App wuerde Kombinationen bedienen, die die eigene
# Messung verworfen hat.
gesperrt = ~freigabe_tabelle.freigabestatus.isin(AUSLIEFERBAR)
if gesperrt.any():
    print(f"{gesperrt.sum()} Kombination(en) gesperrt:")
    for _, r in freigabe_tabelle[gesperrt].iterrows():
        anzahl = ("keine" if pd.isna(r.test2_fahrten)
                  else f"{r.test2_fahrten:.0f}")
        print(f"   {r.startstation} → {r.zielstation}, {r.typ_code}, {r.zeitfenster}"
              f"   Status {r.freigabestatus}, {anzahl} Prüffahrten")
freigabe_tabelle = freigabe_tabelle[~gesperrt].copy()
assert freigabe_tabelle.freigabestatus.isin(AUSLIEFERBAR).all()
_verteilung = freigabe_tabelle.freigabestatus.value_counts()
merke("n_zeilen", len(freigabe_tabelle))
merke("n_gestuetzt", int(_verteilung.get("gestuetzt", 0)))
merke("n_unbestimmt", int(_verteilung.get("unbestimmt", 0)))
merke("n_unzureichend", int(_verteilung.get("unzureichend", 0)))
# Was die strenge Alternative gekostet haette: nur verbindungsbezogen belegte
# Zeilen ausliefern. Gemessen mit derselben Laufzeitlogik wie das Produkt.
_streng = freigabe_tabelle[freigabe_tabelle.freigabestatus == "gestuetzt"]
_bedient_streng = z.merge(
    _streng.rename(columns={"ziel_station_id": "end_station_id",
                            "zeitfenster": "fenster"})[
        ["start_station_id", "end_station_id", "typ_code", "fenster"]],
    on=["start_station_id", "end_station_id", "typ_code", "fenster"], how="inner")
_ = merke("reichweite_streng", len(_bedient_streng) / len(zukunft))
# ─── ZWEI ARTEFAKTE, ZWEI ROLLEN - GETRENNT BENANNT ─────────────────
#
# 1. DAS MODELLPAKET ist das ausgelieferte Verfahren. Es enthaelt beide
#    Quantilmodelle samt Vorverarbeitung, die Merkmalsreihenfolge, den
#    Gate-Status und den Gueltigkeitsbereich. Ohne diese Beipacks ist ein
#    Modell nicht auslieferbar: Wer die Merkmalsreihenfolge verliert,
#    bekommt Vorhersagen, die aussehen wie Vorhersagen - und falsch sind.
#
# 2. DIE RUECKFALLTABELLE ist NICHT das Modell. Sie entsteht aus den
#    historischen Perzentilen, nimmt das Primaergate nicht und darf
#    deshalb nicht dieselbe Zusage tragen. Sie ist der Notbehelf bei
#    Dienstausfall - und das Artefakt, das die Website heute liest.
import joblib, json
from pathlib import Path

MODELLPAKET = {
    "verfahren": KANDIDAT,
    "modell_unten": Q_UNTEN, "modell_oben": Q_OBEN,
    "quantil_unten": Q_UNTEN_NIVEAU, "quantil_oben": Q_OBEN_NIVEAU,
    "merkmale": list(MERKMALE),
    "radtypen": sorted(freigegebene_typen),
    "produktstatus": PRODUKTSTATUS,
    "gate_schwelle": GATE_PREISABHAENGIG,
    "gate_untergrenze": float(unten_o),
    "gueltig_ab": str(test2.startzeit.min().date()),
    "gueltig_bis": str(test2.startzeit.max().date()),
    "max_fahrtdauer_minuten": OBERGRENZE_MINUTEN,
    "gebaut_am": str(pd.Timestamp.today().date()),
}
joblib.dump(MODELLPAKET, "modellpaket_preisspanne.joblib")
_beipack = {k: v for k, v in MODELLPAKET.items()
            if k not in ("modell_unten", "modell_oben")}
Path("modellpaket_preisspanne.json").write_text(
    json.dumps(_beipack, ensure_ascii=False, indent=2), encoding="utf-8")
print("Modellpaket geschrieben - das ist das ausgelieferte Verfahren:")
for _k, _v in _beipack.items():
    print(f"   {_k:24s} {_v}")

# Die Rueckfalltabelle behaelt ihren Dateinamen, weil der Ladeweg in die
# Datenbank daran haengt. Der Name sagt aber nicht, was sie ist - deshalb
# steht es hier, im Notebook und im Text darunter.
freigabe_tabelle.to_csv("preisschaetzung.csv", index=False)
print(f"\\nRueckfalltabelle geschrieben: {len(freigabe_tabelle)} Zeilen "
      f"(preisschaetzung.csv) - NICHT das ausgewaehlte Verfahren.")

# DIE KENNZAHLEN DES TATSAECHLICH AUSGELIEFERTEN ARTEFAKTS, nach allen
# Filtern. Die Werte weiter oben galten der ungefilterten Tabelle; wer
# nur die liest, berichtet etwas anderes, als er ausliefert.
print("\\nDie Rueckfalltabelle im Einzelnen:")
print(f"   Radtypen                {sorted(freigabe_tabelle.typ_code.unique())}")
print(f"   Kombinationen           {len(freigabe_tabelle)}")
print(f"   Verbindungen            "
      f"{freigabe_tabelle.groupby(['start_station_id','ziel_station_id']).ngroups}")
print(f"   Abdeckung auf Test 2    {z.im_intervall.mean():.1%}")
print(f"   Preisspanne im Median   {z.breite.median():.2f} €")
print(f"   Reichweite              {len(z)/len(test2):.1%} der Fahrten im Geltungsbereich")
print()
if len(freigabe_tabelle):
    # line_width gross genug, damit die Tabelle NICHT umbricht: Ein
    # Umbruch mitten in den Spalten macht sie im Notebook wie auf der
    # Folie unlesbar - die Werte stehen dann unter den falschen Koepfen.
    print(freigabe_tabelle.head(6).to_string(index=False, line_width=200))
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
def merkmalszeile(start_id, ziel_id, typ_code, zeitpunkt):
    # Die Merkmalszeile fuer EINE Anfrage - dieselben Spalten, in denen das
    # Modell trainiert wurde. Jede davon ist zur Anfragezeit bekannt:
    # Strecke und Steigung stehen in der Routenmatrix, der Rest im Kalender.
    _s = (str(int(start_id)), str(int(ziel_id)))
    _km = matrix.strecke_m.get(_s, np.nan)
    if pd.isna(_km):
        return None
    t = pd.Timestamp(zeitpunkt)
    tag = t.normalize()
    ferien = any((tag >= v) and (tag <= b) for v, b in zip(schulfrei.von, schulfrei.bis))
    return pd.DataFrame([{
        "start_name": name_je_id.get(int(start_id)),
        "ziel_name": name_je_id.get(int(ziel_id)),
        "route": f"{name_je_id.get(int(start_id))} → {name_je_id.get(int(ziel_id))}",
        "typ_code": typ_code,
        "strecke_km": _km / 1000,
        "steigung_promille": matrix.steigung_promille.get(_s, 0.0),
        "stunde_sin": np.sin(2 * np.pi * t.hour / 24),
        "stunde_cos": np.cos(2 * np.pi * t.hour / 24),
        "wochentag_sin": np.sin(2 * np.pi * t.dayofweek / 7),
        "wochentag_cos": np.cos(2 * np.pi * t.dayofweek / 7),
        "monat_sin": np.sin(2 * np.pi * t.month / 12),
        "monat_cos": np.cos(2 * np.pi * t.month / 12),
        "ist_wochenende": int(t.dayofweek >= 5),
        "ist_feiertag": int(tag in set(feiertag.datum)),
        "ist_ferien": int(ferien),
    }])[MERKMALE]


SCHLUESSELSPALTEN = ["start_station_id", "ziel_station_id", "typ_code", "zeitfenster"]
if len(freigabe_tabelle):
    # Ein doppelter Schluessel macht aus .loc[...] eine Tabelle statt einer
    # Zeile - und der Zugriff auf z.minuten_von liefert dann eine Series.
    # Das faellt erst auf, wenn eine Anzeige unsinnig aussieht. Geprueft wird
    # deshalb VOR dem set_index, nicht danach.
    _doppelt = freigabe_tabelle.duplicated(SCHLUESSELSPALTEN).sum()
    assert _doppelt == 0, (
        f"{_doppelt} doppelte Schluessel in der Freigabetabelle - "
        f"der Nachschlagezugriff waere mehrdeutig.")
    NACHSCHLAGE = freigabe_tabelle.set_index(SCHLUESSELSPALTEN)
else:
    NACHSCHLAGE = pd.DataFrame().set_index(pd.MultiIndex.from_arrays([[], [], [], []]))

def preis_schaetzen(start_id, ziel_id, typ_code, zeitpunkt,
                    freiminuten_rest=0, rabatt_prozent=0.0,
                    ohne_produktsperre=False, dienst_verfuegbar=True):
    \"\"\"Gibt die Preisspanne zurueck - oder sagt, dass sie es nicht kann.

    Angesprochen wird ueber Stations-IDs. Namen sind Anzeigewerte.

    Freiminutenstand und Rabatt kommen aus dem Konto des angemeldeten Kunden.
    Ohne Angabe wird der Basistarif gerechnet - der teuerste Fall, den die
    Anzeige einem nicht angemeldeten Besucher zeigen darf.

    ohne_produktsperre dient allein der Pruefung: Damit laesst sich die
    Filterlogik gegen die Offlinebewertung halten, auch wenn das Produkt als
    Ganzes gesperrt ist. Im Betrieb wird der Schalter nie gesetzt.

    dienst_verfuegbar=False schaltet auf die RUECKFALLTABELLE um - den Fall,
    dass der Laufzeitdienst ausfaellt. Die Tabelle nimmt das Primaergate
    NICHT; sie darf deshalb nicht dieselbe Zusage anzeigen. Jede Antwort
    traegt darum "quelle" und "zusage" mit: woher der Wert kommt und was
    zugesagt ist. Eine Rueckfallantwort ohne Zusage ist eine Orientierung,
    keine Auskunft.
    \"\"\"
    # EINGABEN PRUEFEN, BEVOR GERECHNET WIRD.
    # Eine Schnittstelle, die auf unsinnige Eingaben irgendetwas zurueckgibt,
    # ist schlimmer als eine, die nichts zurueckgibt: Der Aufrufer merkt den
    # Fehler nicht. Jeder Grund ist eindeutig benannt, damit die aufrufende
    # Seite unterscheiden kann, was sie falsch gemacht hat.
    # EINE ZEITQUELLE. Frueher nahm der Tabellenzweig eine separate `stunde`
    # und der Modellzweig einen `zeitpunkt` - zwei Angaben, die sich
    # widersprechen konnten, ohne dass es jemand bemerkt haette. Jetzt wird
    # die Stunde aus dem Zeitpunkt abgeleitet; es gibt nichts mehr zu
    # widersprechen.
    try:
        _t = pd.Timestamp(zeitpunkt)
    except (TypeError, ValueError):
        _t = pd.NaT
    if pd.isna(_t):
        return {"anzeige": None, "grund": "zeitpunkt_ungueltig", "status": None,
                "hinweis": "Für die Schätzung wird ein gültiger Startzeitpunkt gebraucht."}
    stunde = int(_t.hour)
    if freiminuten_rest is None or freiminuten_rest < 0:
        return {"anzeige": None, "grund": "freiminuten_ungueltig", "status": None,
                "hinweis": "Ein Freiminutenstand kann nicht negativ sein."}
    if not 0.0 <= rabatt_prozent <= 100.0:
        return {"anzeige": None, "grund": "rabatt_ungueltig", "status": None,
                "hinweis": "Ein Rabatt liegt zwischen 0 und 100 Prozent."}
    if typ_code not in set(preise.typ_code):
        return {"anzeige": None, "grund": "typ_unbekannt", "status": None,
                "hinweis": f"Den Radtyp '{typ_code}' kennt die Preisliste nicht."}

    # Die naechste Pruefung gilt dem PRODUKT, nicht der Anfrage: Solange das
    # Primaergate nicht haelt, zeigt die App gar nichts an - auch nicht dort,
    # wo die einzelne Kombination gut belegt waere.
    if not PRODUKT_FREIGEGEBEN and not ohne_produktsperre:
        _grund = ("schattenbetrieb" if SCHATTENBETRIEB else "produkt_nicht_freigegeben")
        _hinweis = ("Die Auskunft wird berechnet und protokolliert, aber noch nicht "
                    "angezeigt." if SCHATTENBETRIEB else
                    "Die Preisauskunft ist noch nicht freigegeben.")
        return {"anzeige": None, "grund": _grund, "status": PRODUKTSTATUS,
                "hinweis": _hinweis}
    if start_id == ziel_id:
        return {"anzeige": None, "grund": "rundfahrt", "status": None,
                "hinweis": "Für Rundfahrten schätzen wir keinen Preis."}
    # ─── ZWEI WEGE ZU EINER SPANNE ──────────────────────────────────
    # Welcher gilt, entscheidet KANDIDAT - dieselbe Variable, an der auch
    # die Bewertung haengt. Zwei Wege mit getrennten Regeln waeren zwei
    # Produkte; die Zusicherung unten prueft genau das.
    _rueckfall = (KANDIDAT == "Quantilregression") and not dienst_verfuegbar
    if KANDIDAT == "Quantilregression" and dienst_verfuegbar:
        if typ_code not in set(freigegebene_typen):
            return {"anzeige": None, "grund": "typ_nicht_freigegeben", "status": None,
                    "hinweis": "Für diesen Radtyp geben wir keine Auskunft."}
        _zeile = merkmalszeile(start_id, ziel_id, typ_code, _t)
        if _zeile is None:
            return {"anzeige": None, "grund": "keine_zeile", "status": None,
                    "hinweis": "Für diese Verbindung liegt keine Streckenangabe vor."}
        _mv = float(np.maximum(1.0, Q_UNTEN.predict(_zeile))[0])
        _mb = float(Q_OBEN.predict(_zeile)[0])
        z = pd.Series({"minuten_von": round(_mv), "minuten_bis": round(_mb),
                       "freigabestatus": "modell", "test2_fahrten": np.nan})
        _quelle, _zusage = "modell", GATE_PREISABHAENGIG
    else:
        _quelle = "rueckfalltabelle" if _rueckfall else "tabelle"
        # Die Tabelle nimmt das Primaergate nicht. Als REGULAERE Quelle
        # (KANDIDAT == Perzentiltabelle) waere sie deshalb gar nicht
        # ausgewaehlt worden; als RUECKFALL darf sie liefern, aber ohne
        # Zusage - deshalb hier None statt der 80 Prozent.
        _zusage = None if _rueckfall else GATE_PREISABHAENGIG
        schluessel = (start_id, ziel_id, typ_code, fenster_von(stunde))
        if schluessel not in NACHSCHLAGE.index:
            return {"anzeige": None, "grund": "keine_zeile", "status": None,
                    "hinweis": "Für diese Verbindung liegt keine belastbare Schätzung vor."}
        z = NACHSCHLAGE.loc[schluessel]
    von = kundenpreis(z.minuten_von, typ_code, freiminuten_rest, rabatt_prozent)
    bis = kundenpreis(z.minuten_bis, typ_code, freiminuten_rest, rabatt_prozent)
    # DIESELBE Regel wie in der Bewertung, jetzt mit dem Guthaben DIESES Kunden.
    # Der Vorabfilter der Tabelle rechnet mit dem Basistarif; der ist fuer die
    # absolute Breite der teuerste Fall, aber nicht fuer die relative: Deckt das
    # Guthaben die kurze Fahrt und die lange nicht mehr, steht der Startgebuehr
    # ein voller Minutenpreis gegenueber - die Spanne ist dann relativ breiter.
    if not spanne_nuetzt(z.minuten_von, z.minuten_bis, von, bis):
        return {"anzeige": None, "grund": "spanne_zu_breit", "status": z.freigabestatus,
                "hinweis": "Für Ihren Tarif wäre die Spanne zu breit, um zu nützen."}
    # Der Status wandert MIT der Antwort zurueck. Die Anzeige ist fuer alle
    # ausgelieferten Klassen gleich - die Zusage gilt aggregiert je Radtyp -,
    # aber Ueberwachung und Support muessen wissen, worauf die Zeile beruht.
    return {"anzeige": f"{von:.2f} bis {bis:.2f} €",
            "grund": None, "status": z.freigabestatus,
            "quelle": _quelle, "zusage": _zusage,
            "hinweis": (None if _zusage is not None else
                        "Grobe Orientierung aus der Rückfalltabelle - für sie "
                        "gilt die Trefferzusage nicht."),
            "belege": (None if pd.isna(z.test2_fahrten) else int(z.test2_fahrten)),
            "minuten": f"{z.minuten_von:.0f} bis {z.minuten_bis:.0f} Minuten",
            # Die Tabelle kann sagen, auf wie vielen Fahrten eine Zeile beruht.
            # Das Modell kann es nicht - es rechnet, es schlaegt nicht nach.
            # Diese Ehrlichkeit ist der Preis der besseren Guete.
            "grundlage": (f"{z.fahrten_grundlage:.0f} vergleichbare Fahrten"
                          if "fahrten_grundlage" in z.index
                          else "Modellschaetzung, keine Einzelbelege")}

# ─── DIE VORFUEHRUNG - JEDER FALL ERREICHT SEINEN ZWEIG ─────────────
#
# Frueher pruefte diese Zelle nur, ob eine Anzeige ausbleibt. Das ist zu
# wenig: Ein Beispiel, das aus dem falschen Grund scheitert, sieht genauso
# aus wie eines, das den beschrifteten Zweig erreicht. Geprueft wird
# deshalb der GRUND - und beim Positivfall, dass wirklich eine Spanne
# herauskommt.
_ok = zukunft[zukunft["bis"].notna()].iloc[0]
_zeit = _ok.startzeit
_faelle = [
    ("gueltige Anfrage", dict(start_id=int(_ok.start_station_id),
                              ziel_id=int(_ok.end_station_id),
                              typ_code=_ok.typ_code, zeitpunkt=_zeit), None),
    ("Rundfahrt", dict(start_id=int(_ok.start_station_id),
                       ziel_id=int(_ok.start_station_id),
                       typ_code=_ok.typ_code, zeitpunkt=_zeit), "rundfahrt"),
    ("Station, die es nicht gibt", dict(start_id=int(_ok.start_station_id),
                                        ziel_id=999, typ_code=_ok.typ_code,
                                        zeitpunkt=_zeit), "keine_zeile"),
    ("Radtyp, den die Preisliste nicht kennt",
     dict(start_id=int(_ok.start_station_id), ziel_id=int(_ok.end_station_id),
          typ_code="ROLLER", zeitpunkt=_zeit), "typ_unbekannt"),
    ("ohne Zeitpunkt", dict(start_id=int(_ok.start_station_id),
                            ziel_id=int(_ok.end_station_id),
                            typ_code=_ok.typ_code, zeitpunkt=None),
     "zeitpunkt_ungueltig"),
]
# Der Zweig "fuer diesen Tarif zu breit" wird GESUCHT, nicht behauptet.
for _rest in (0, 5, 10, 15, 20, 30):
    _pr = preis_schaetzen(int(_ok.start_station_id), int(_ok.end_station_id),
                          _ok.typ_code, _zeit, freiminuten_rest=_rest,
                          ohne_produktsperre=True)
    if _pr["grund"] == "spanne_zu_breit":
        _faelle.append((f"Spanne zu breit bei {_rest} Freiminuten",
                        dict(start_id=int(_ok.start_station_id),
                             ziel_id=int(_ok.end_station_id), typ_code=_ok.typ_code,
                             zeitpunkt=_zeit, freiminuten_rest=_rest),
                        "spanne_zu_breit"))
        break

print("Die Faelle werden OHNE die Statussperre vorgefuehrt - sonst zeigten sie")
print("alle dieselbe Ablehnung, und man saehe die Unterscheidung nicht.\\n")
for _bez, _arg, _erwartet in _faelle:
    _a = preis_schaetzen(ohne_produktsperre=True, **_arg)
    assert _a["grund"] == _erwartet, (
        f"{_bez}: erwartet {_erwartet!r}, bekommen {_a['grund']!r}")
    if _erwartet is None:
        assert _a["anzeige"] is not None, f"{_bez} liefert keine Spanne"
        print(f"{_bez:42s} {_a['anzeige']}   ({_a['minuten']})")
    else:
        print(f"{_bez:42s} keine Anzeige - {_a['grund']}")
print(f"\\n{len(_faelle)} von {len(_faelle)} Faellen erreichen den beschrifteten Zweig.")

print()
print(f"Im Betrieb gilt der Status '{PRODUKTSTATUS}':")
_echt = preis_schaetzen(**_faelle[0][1])
print(f"   {_echt['hinweis']}  (Grund: {_echt['grund']})")
"""),

MD("""
### 6.4a Zeigt die App genau das, was wir gemessen haben?

Zwischen der Bewertung in Phase 5.6 und der ausgelieferten Funktion liegen mehrere
Schritte: Filter auf der Tabelle, Radtypfreigabe, Statussperre, die kundenbezogene
Breitenregel. Jeder davon kann in der einen Logik stehen und in der anderen fehlen —
und dann verspricht das Notebook etwas, das die App nicht hält.

Statt das zu behaupten, prüfen wir es: **Jede Fahrt aus Test 2 einmal durch beide Wege.**
Wo die Bewertung eine Spanne zählt, muss die App eine anzeigen — und umgekehrt.
"""),

CODE("""
# Der Vergleich laeuft ueber ALLE Testfahrten, nicht ueber eine Auswahl.
stichprobe = zukunft.copy()
aus_der_app = []
for r in stichprobe.itertuples():
    antwort = preis_schaetzen(int(r.start_station_id), int(r.end_station_id),
                              r.typ_code, r.startzeit,
                              freiminuten_rest=r.freiminuten_rest,
                              rabatt_prozent=r.rabatt_prozent,
                              ohne_produktsperre=True)
    aus_der_app.append(antwort["anzeige"] is not None)
stichprobe["app_zeigt"] = aus_der_app

# Die Bewertung: was in z gelandet ist, hat die Messung als anzeigbar gezaehlt.
gezaehlt = set(z.ausleihe_id)
stichprobe["messung_zaehlt"] = stichprobe.ausleihe_id.isin(gezaehlt)

nur_app = int((stichprobe.app_zeigt & ~stichprobe.messung_zaehlt).sum())
nur_messung = int((~stichprobe.app_zeigt & stichprobe.messung_zaehlt).sum())
print(f"Testfahrten geprueft:            {len(stichprobe):>7,}")
print(f"App zeigt, Messung zaehlt nicht: {nur_app:>7,}")
print(f"Messung zaehlt, App zeigt nicht: {nur_messung:>7,}")
merke("konsistenz_nur_app", nur_app)
merke("konsistenz_nur_messung", nur_messung)

# Kein Hinweis, sondern eine Bedingung: Weichen die beiden Wege voneinander ab,
# ist die gemessene Guete nicht die des Produkts - und das Notebook bricht ab.
assert nur_app == 0 and nur_messung == 0, (
    f"Bewertung und Auslieferung sind nicht deckungsgleich: "
    f"{nur_app} Faelle zeigt nur die App, {nur_messung} zaehlt nur die Messung.")
print()
print("Die Filterlogik beider Wege stimmt ueberein.")

# Zweite Aussage, getrennt geprueft: Solange das Produkt gesperrt ist, zeigt
# die App gar nichts - unabhaengig davon, wie gut die einzelne Zeile belegt ist.
probe = zukunft.iloc[0]
gesperrt = preis_schaetzen(int(probe.start_station_id), int(probe.end_station_id),
                           probe.typ_code, probe.startzeit)
if PRODUKT_FREIGEGEBEN:
    print("Status 'sichtbar' - die App zeigt an, was hier gemessen wurde.")
else:
    assert gesperrt["anzeige"] is None, "Trotz gesperrtem Status wird angezeigt"
    assert gesperrt["status"] == PRODUKTSTATUS
    print(f"Status '{PRODUKTSTATUS}': Die App zeigt nach aussen nichts an -")
    print(f"auch nicht fuer Kombinationen, die fuer sich genommen belegt waeren.")
    print(f"Grund, den die Schnittstelle zurueckgibt: {gesperrt['grund']}")

# Dritte Aussage: Die Eingabepruefung meldet den RICHTIGEN Grund. Eine
# Pruefung, die nie ausgeloest wird, ist unbelegt - hier wird jede einzeln
# angesteuert. Die Statussperre wird dafuer umgangen, sonst antwortete
# ohnehin jede Anfrage mit demselben Grund.
print("\\nEINGABEPRUEFUNG - jeder Fehler bekommt seinen eigenen Grund:")
_s, _z, _t = int(probe.start_station_id), int(probe.end_station_id), probe.typ_code
_zt = probe.startzeit
_pruef = [
    ("Zeitpunkt fehlt",        dict(zeitpunkt=None),            "zeitpunkt_ungueltig"),
    ("Zeitpunkt als Unsinn",   dict(zeitpunkt="uebermorgen"),   "zeitpunkt_ungueltig"),
    ("Freiminuten negativ",    dict(freiminuten_rest=-5),       "freiminuten_ungueltig"),
    ("Rabatt 150 %",           dict(rabatt_prozent=150.0),      "rabatt_ungueltig"),
    ("Radtyp 'ROLLER'",        dict(typ_code="ROLLER"),         "typ_unbekannt"),
    ("Start gleich Ziel",      dict(ziel_id=_s),                "rundfahrt"),
]
for _bez, _abw, _erwartet in _pruef:
    _arg = dict(start_id=_s, ziel_id=_z, typ_code=_t, zeitpunkt=_zt,
                ohne_produktsperre=True)
    _arg.update(_abw)
    _antwort = preis_schaetzen(**_arg)
    assert _antwort["grund"] == _erwartet, (
        f"{_bez}: erwartet '{_erwartet}', bekommen '{_antwort['grund']}'")
    assert _antwort["anzeige"] is None, f"{_bez} liefert trotzdem eine Anzeige"
    print(f"   {_bez:<22s} -> {_antwort['grund']}")
print(f"\\n{len(_pruef)} von {len(_pruef)} Faellen abgewiesen, jeder mit eigenem Grund.")

# Vierte Aussage: Der RUECKFALL liefert - aber nicht dieselbe Zusage.
# Ein Fallback, der aussieht wie das Produkt, ist ein zweites Produkt
# ohne Pruefung. Deshalb traegt jede Antwort ihre Quelle und ihre Zusage.
print("\\nRUECKFALL BEI DIENSTAUSFALL:")
_normal = preis_schaetzen(_s, _z, _t, zeitpunkt=_zt, ohne_produktsperre=True)
_notfall = preis_schaetzen(_s, _z, _t, zeitpunkt=_zt, ohne_produktsperre=True,
                           dienst_verfuegbar=False)
for _bez, _a in (("Dienst laeuft", _normal), ("Dienst faellt aus", _notfall)):
    print(f"   {_bez:<18s} Quelle {str(_a.get('quelle')):<16s} "
          f"Zusage {'-' if _a.get('zusage') is None else format(_a['zusage'], '.0%'):<5s} "
          f"{_a['anzeige'] or 'keine Anzeige - ' + str(_a['grund'])}")
assert _normal["quelle"] == "modell" and _normal["zusage"] == GATE_PREISABHAENGIG
if _notfall["anzeige"] is not None:
    assert _notfall["quelle"] == "rueckfalltabelle", _notfall
    assert _notfall["zusage"] is None, "Der Rueckfall darf die Zusage nicht tragen."
    assert _notfall["hinweis"], "Der Rueckfall muss den Vorbehalt mitliefern."
    print(f"   Vorbehalt im Klartext: {_notfall['hinweis']}")
else:
    print(f"   Diese Verbindung steht nicht in der Rueckfalltabelle "
          f"(Grund: {_notfall['grund']}) - dann zeigt die App gar nichts.")
"""),

MD("""
### 6.4b Worauf sich die Zusage bezieht — und worauf nicht

Von den {{n_zeilen:,}} **erzeugten** Kombinationen sind nur {{n_gestuetzt:,}}
**verbindungsbezogen** belegt: Nur bei ihnen liegt die untere Vertrauensgrenze aus
Test 2 über 80 Prozent. Bei {{n_unzureichend:,}} Zeilen ist die Prüfmenge für eine
eigene Aussage zu klein, {{n_unbestimmt:,}} sind statistisch unentschieden.

**Die Entscheidung über den Zuschnitt lautet: alle drei Klassen bleiben, und die Zusage
gilt aggregiert je Radtyp.** Sie lautet damit:

> Über alle Anfragen eines Radtyps hinweg enthält die angezeigte Spanne den tatsächlichen
> Preis in mindestens {{gate_schwelle:.0%}} der Fälle. Für eine **einzelne** Verbindung
> ist das nicht zugesichert.

**Der zweite Satz ist der wichtigere**, und er wird beim Zitieren zuerst weggelassen. Eine
aggregierte Zusage sagt nichts über den Einzelfall: Der Kunde, der auf einer selten
gefahrenen Verbindung eine zu enge Spanne sieht, ist von einer Quote über alle Anfragen
nicht getröstet.

Die Alternative wäre gewesen, nur die {{n_gestuetzt:,}} verbindungsbezogen belegten Fälle
zu bedienen. Das hätte die Reichweite von {{reichweite_real:.0%}} auf
**{{reichweite_streng:.1%}}** gedrückt — eine Auskunft, die fast immer schweigt, benutzt
niemand.

**Damit die Entscheidung nicht im Verborgenen bleibt, wandert der Status mit:** Die
App-Funktion gibt zu jeder Antwort `status` und die Zahl der Prüffahrten zurück.
Überwachung und Support sehen so, worauf eine Anzeige beruht, ohne dass der Kunde mit
einer Statistik behelligt wird. Was die Oberfläche zeigt, ist für alle Klassen gleich —
was das Unternehmen darüber weiß, nicht.

### 6.4c Das Primärgate — und warum es diesmal hält

In 6.1 haben wir die **vorab preisabhängige Gruppe** zur entscheidenden
Evaluationsgruppe erklärt: die Anfragen, bei denen das Freiminutenguthaben die obere
Intervallgrenze *nicht* deckt und der Preis deshalb überhaupt an der Dauerschätzung
hängt. Wer das sagt, muss es auch messen lassen.

**Welche Gates gelten, steht vor der Messung fest — und zwar vollständig.** Ein
Gate-Katalog, der erst nach dem Ergebnis präzisiert wird, ist kein Katalog, sondern eine
nachträgliche Begründung. Diese vier Fragen sind deshalb vorab entschieden:

| | Gate | gilt? |
|---|---|---|
| 1 | preisabhängige Gruppe **aggregiert**: Wilson-Untergrenze ≥ {{gate_schwelle:.0%}} | **ja — bindend** |
| 2 | preisabhängige Gruppe **je Radtyp**: dieselbe Untergrenze | nein |
| 3 | alle angezeigten Fälle je Radtyp: Untergrenze ≥ {{gate_schwelle:.0%}} | **ja** (Kriterium aus 5.5) |
| 4 | Mindestreichweite je Radtyp | **ja** (Kriterium aus 5.5) |

**Warum Gate 2 nicht gilt, und warum das vorher gesagt sein muss.** Die App macht der
Kundschaft **eine** Zusage — nicht drei nach Radtyp getrennte. Das bindende Gate prüft
deshalb die Ebene, auf der die Zusage ausgesprochen wird. Je Radtyp wird dieselbe Größe
als **Diagnose** mitgeführt: Sie zeigt, wo das Produkt schwach ist, ohne es zu sperren.

Diese Entscheidung muss man sich unbequem machen, denn sie hat eine Folge: Gemessen
halten {{offen_typen_halten}} von {{offen_typen_gesamt}} Radtypen dieselbe Untergrenze;
{{offen_schwaechster_typ}} kommt auf {{offen_schwaechste_grenze:.1%}} und läge damit
unter {{gate_schwelle:.0%}}. Als bindendes Gate hätte Gate 2 das Produkt also gekippt.
Genau deshalb ist entscheidend, **wann** die Festlegung fiel: vorher — mit dieser
Begründung und in Kenntnis des Risikos, dass sie später unbequem wird. Nach der Messung
getroffen wäre dieselbe Festlegung das Gegenteil: die Wahl derjenigen Auswertungsebene,
die zum gewünschten Ergebnis führt. Die kleinste Gruppe umfasst
{{offen_kleinste_gruppe}} Fahrten — klein genug, dass ihre Untergrenze stark vom
Stichprobenumfang und nicht nur von der Modellgüte abhängt; das ist die *sachliche*
Nebenbegründung, aber sie trägt die Entscheidung nicht allein.

| | |
|---|---|
| **bindendes Gate** | Untergrenze des 95-%-Intervalls in der preisabhängigen Gruppe, aggregiert ≥ {{gate_schwelle:.0%}} |
| **gemessen** | {{gate_untergrenze:.1%}} |
| **Urteil** | **{{gate_urteil}}** |

**Das Gate hält — und deshalb geht die Preisauskunft in Betrieb, im Status
„{{produktstatus}}".** Das heißt: {{statussatz}}. Die vorab festgelegte Hürde ist
genommen; was fehlt, ist nicht die Güte, sondern eine **unabhängige** Prüfung des
fertigen Artefakts. Test 2 kann sie nicht leisten, weil er die Intervalle kalibriert
hat — derselbe Zeitraum kann nicht beides sein. Das ist die Lehre dieses Notebooks,
angewandt auf sein eigenes Ergebnis.

**In Betrieb heißt nicht fertig.** Was jetzt gilt und was nicht:

| | |
|---|---|
| die App zeigt Preisspannen an | für {{reichweite_real:.0%}} der Anfragen |
| die Zusage lautet | in mindestens {{gate_schwelle:.0%}} der Fälle liegt der Preis in der Spanne |
| sie gilt | **aggregiert je Radtyp**, nicht je Verbindung |
| geprüft wurde sie auf | einem historischen Testzeitraum, den bis dahin nichts berührt hat |
| **nicht** geprüft wurde sie auf | einem prospektiven Zeitraum mit protokolliertem Wunschziel |

> **Der letzte Punkt ist der wichtigste, und er bleibt offen.** Test 2 war unberührt, aber
> er ist Vergangenheit: Wir wissen, wohin die Leute gefahren *sind*, nicht, wohin sie
> fahren *wollten*. Eine Preisauskunft wird vor der Fahrt abgerufen — für ein Ziel, das
> der Kunde eingibt und dann vielleicht ändert. Diese Lücke schließt kein Rechenschritt,
> sondern nur ein Schattenbetrieb, in dem das gewünschte Ziel mitgeschrieben wird.
>
> **Deshalb steht der Status auf „{{produktstatus}}":** {{statussatz}}. Die Überwachung
> aus 6.5 kann den Dienst jederzeit wieder abschalten. Das ist kein Vorbehalt aus Vorsicht — es ist der Teil der
> Prüfung, der sich nicht vorziehen lässt.

> **Warum die Gesamtquote hier nicht zählt.** {{abdeckung_gesamt:.1%}} über alle
> Anfragen klingt komfortabel. Aber {{n_gedeckt:,}} der {{n_gesamt:,}} gemessenen
> Fahrten liegen in der Gruppe, deren Guthaben die Fahrt deckt — dort ist der Preis die
> Startgebühr, und **jede** Schätzung trifft. Diese Fälle tragen die Gesamtquote, ohne
> etwas über die Dauerprognose auszusagen. Ein Gate, das sie mitzählt, misst die
> Tarifstruktur, nicht das Modell.

**Was jetzt zu tun ist** — in dieser Reihenfolge, und keiner der Schritte ist eine
Notebook-Übung:

1. **Das gewünschte Ziel protokollieren**, bevor die Fahrt beginnt. Ohne diese Spalte
   lässt sich nie messen, ob die Auskunft für die *geplante* Fahrt stimmte.
2. **Den Schattenbetrieb aus 6.6 laufen lassen** und das Gate dort erneut messen.
   {{gate_untergrenze:.1%}} sind knapp über {{gate_schwelle:.0%}}, nicht deutlich —
   ein Quartal mit anderer Wetterlage kann das kippen.
3. **Die Überwachung aus 6.5 scharf schalten**, bevor die Anzeige sichtbar wird. Eine
   Ohne Abschaltweg wäre eine Freigabe nur ein Versprechen.


### 6.5 Überwachung — mit Grenzen, die zum Kriterium passen

Die Handlungsschwellen sind am Erfolgskriterium ausgerichtet: Wer bei 80 Prozent
freigibt, darf nicht erst bei 60 Prozent eingreifen — sonst bliebe eine bereits
gescheiterte Kombination weiter in der App.

| Auslöser | Schwelle | Handlung |
|---|---|---|
| Abdeckung je Kombination, gleitend über 8 Wochen | **untere** Vertrauensgrenze ≥ 80 % | anzeigen |
| | Intervall überlappt 80 % | anzeigen, aber Warnung und Neuberechnung |
| | **obere** Vertrauensgrenze < 80 % | **Kombination abschalten** |
| Fallzahl je Kombination | < 20 im Fenster | keine eigene Aussage; es gilt die aggregierte Zusage je Radtyp |
| neue Station | — | keine Zeile, also keine Anzeige |
| **Tarif ändert sich** | Minutenpreis neu | **gesamte Tabelle neu rechnen** — sie enthält Euro |
| Quartalswechsel | — | neu rechnen; im Winter sind die Ausflugsfahrten kürzer |

Die drei Fälle schließen einander aus und decken alles ab — daran war die vorige Fassung
<!-- zahl-ohne-ausgabe: 78 erfundener Beispielwert einer frueheren Fassung -->
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
| 2 Data Understanding | Abbrüche und Stornierungen sind keine Fahrten. {{anteil_frei:.1%}} enden frei im Gebiet, {{anteil_rundtour:.1%}} sind Rundtouren |
| 3 Data Preparation | Zielstation erlaubt — als Stellvertreter. Wetter verboten. Vier Zeitabschnitte, zyklische Zeitmerkmale |
| 4 Modeling | Vier Baselines, dann Modelle; eine Ablation zeigt, dass die Zielangabe {{ablation_anteil:.0%}} des Fehlers erklärt |
| 5 Evaluation | {{typen_halten}} halten die Grenze auf Test 1, {{typen_reissen}} nicht. Trotzdem Rücksprung — weil der Mittelwert die einzelne Fahrt nicht abbildet |
| 6 Deployment | **Ausgeliefert wird die Quantilregression** als Laufzeitdienst — für {{typen_freigegeben}}, als Modellpaket mit Beipackzettel. Das Primärgate der preisabhängigen Gruppe hält mit {{gate_untergrenze:.1%}} die zugesagten {{gate_schwelle:.0%}}. Status: **{{produktstatus}}** — {{statussatz}}. Die Perzentiltabelle bleibt als Rückfallebene, im Code implementiert und **ohne** Zusage |

**Der Rücksprung, den man hier mitverfolgen konnte**

Er kommt nicht, weil das Modell versagt hätte. Für {{typen_halten}} hält die
50-Cent-Grenze auf Test 1 und in allen vier Fenstern der rollierenden Prüfung. Er kommt
aus zwei anderen Gründen:

> **Ein Mittelwert ist keine Erfahrung.** Nur {{city_unter_50:.0%}} der CITY-Fahrten
> bleiben innerhalb der 50 Cent — über die übrigen sagt der Durchschnitt nichts.

> **Und das Lastenrad hätte überhaupt kein Produkt.** Eine Lösung, die den teuersten
> Radtyp ausspart, beantwortet die Geschäftsfrage nicht.

Die Spanne löst **beide** Punkte: Sie zeigt die Streuung, statt sie zu verschweigen, und
sie trägt für **{{typen_freigegeben}}** — weil die Nützlichkeitsregel aus 5.5 die Güte des
Modells von der Preisstruktur trennt. Was bleibt, ist keine Lücke im Sortiment, sondern
eine in der Reichweite: Das erzeugte Artefakt deckt {{reichweite_potenziell:.0%}} der
Fahrten ab — angezeigt werden bei gesperrtem Produkt {{reichweite_real:.0%}}.

**Vier Sätze, die aus diesem Notebook bleiben sollten**

> Ob ein Merkmal verwendet werden darf, entscheidet der Prozess, nicht der Spaltenname.

> Das Modell ist genau auf Verbindungen mit enger Dauerverteilung und ungenau auf
> solchen mit weiter. Woran das liegt, sagen die Daten nicht — der Fahrtzweck steht in
> keiner Spalte.

> Ein Rücksprung ist eine neue Runde — und eine neue Runde braucht einen eigenen
> Zeitraum. Ob der auch unberührt bleibt, muss man ehrlich sagen: Test 2 trägt hier die
> Kalibrierung, nicht die unabhängige Endprüfung.

> Ausgeliefert wird, was gemessen wurde. Nicht das, was im Text steht.

**Was offen bleibt — ausdrücklich**

1. **Das geplante Ziel wird nicht erfasst.** Alle Zahlen sind optimistische Näherungen, keine bewiesenen Obergrenzen.
2. **Das Primärgate hält — je Radtyp aber nicht überall.** Aggregiert
   {{gate_untergrenze:.1%}} gegen {{gate_schwelle:.0%}}; in der Diagnose je Radtyp
   bleibt {{offen_schwaechster_typ}} mit {{offen_schwaechste_grenze:.1%}} darunter.
   Bindend ist die aggregierte Ebene — vorab so festgelegt, weil die App eine Zusage
   macht und nicht drei. Die Diagnose bleibt trotzdem stehen.
3. **Die unabhängige Prüfung steht aus.** Test 2 hat das Artefakt kalibriert; deshalb
   Status „{{produktstatus}}" statt sichtbar. Erst ein prospektiver Zeitraum, den nichts
   berührt hat, kann die Zusage unabhängig belegen.
4. **Keine Zusage je Verbindung.** Die {{gate_schwelle:.0%}} gelten insgesamt.
   Ausgeschlossen ist, was messbar durchfällt; für die Mehrzahl der Kombinationen ist die
   Prüfmenge zu klein für eine Einzelaussage.
5. **Kein Wetter.** Ohne archivierte Prognosen fehlt ein vermutlich starkes Merkmal.
6. **Die Acht-Stunden-Grenze ist gesetzt, nicht belegt.**
7. **Die Punktschätzung trägt {{typen_reissen}} nicht.** Für diesen Radtyp gibt es
   nur die Spanne, keine Zahl — der Minutenpreis lässt keine engere Zusage zu.
8. **Die Architekturfrage entschied mit — und sie wurde vorher gestellt.** Von drei
   Kandidaten nimmt nur die Quantilregression alle Hürden; beide statischen Tabellen
   reißen das Primärgate, auch die aus den Modellvorhersagen gebaute. Weil ein
   Laufzeitdienst zugelassen ist, kommt sie überhaupt in Frage — im Status
   „{{produktstatus}}". Wäre er es nicht, bliebe kein
   zulässiger Kandidat — dasselbe Notebook, dieselben Zahlen, ein anderes Ergebnis.
   Genau deshalb trägt die Rückfalltabelle keine Zusage: Sie ist derselbe Kandidat, der
   die Hürde gerissen hat.
9. **Freigegeben heißt: mit Bedingung.** Die Zusage ist auf einem historischen
   Testzeitraum belegt, nicht auf einem prospektiven. Was fehlt, ist das protokollierte
   Wunschziel — und ohne das lässt sich nie messen, ob die Auskunft für die *geplante*
   Fahrt stimmte. Der Schattenbetrieb läuft deshalb parallel weiter.

**Weiter geht es mit Notebook 2 — Klassifikation:** Dort ist die Zielgröße keine Zahl
mehr, sondern eine Entscheidung, und die beiden Fehlerarten sind unterschiedlich teuer.
"""),
]
