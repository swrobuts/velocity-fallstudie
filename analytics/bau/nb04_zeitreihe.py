# -*- coding: utf-8 -*-
"""Notebook 4 - Zeitreihe: Wieviele Fahrten kommen morgen?"""
from bauwerk import CODE, MD, PHASE, kopf
from gestaltung import kacheln, laufzeit_code

NAME = "04_Zeitreihe_Nachfrageprognose"

ZELLEN = [

kopf("Zeitreihe: Wie viele Fahrten kommen morgen?",
     "Zeitreihenprognose (überwacht — mit der Zeit als zusätzlicher Fessel)",
     "Wie viele Fahrten kommen morgen — und wie plant man mit einer Zahl, die man nicht sicher weiß?",
     NAME),

MD("""
> ### Kurzfassung
>
> **Fragestellung.** Die Disposition plant am Vorabend für den kommenden Tag. Mit wie
> vielen Fahrten ist zu rechnen?
>
> **Vorgehen.** Aus Kalendermerkmalen und der Wettervorhersage wird eine Tageszahl
> geschätzt. Entscheidend ist der Unterschied zwischen Vorhersage und späterem
> Ist-Wetter: Verglichen werden die Verfahren unter dem Wetter, das um 18 Uhr bekannt
> ist, nicht unter dem, das sich im Nachhinein eingestellt hat.
>
> **Ergebnis.** Gewählt wurde {{gewaehlt_name}} mit einem mittleren absoluten Fehler von
> {{mae_linear:.1f}} Fahrten, gegenüber {{mae_faustregel:.1f}} bei der Faustregel und
> {{mae_null:.1f}} beim Nullmodell. Unter Ist-Wetter liegen lineares Modell und Gradient
> Boosting praktisch gleichauf ({{ist_linear:.2f}} gegenüber {{ist_boosting:.2f}}); erst
> unter Prognosewetter setzt sich das einfachere Verfahren ab ({{mae_linear:.2f}}
> gegenüber {{mae_boosting:.2f}}). Die Modellwahl hängt damit unmittelbar daran, unter
> welchen Bedingungen verglichen wird.
>
> **Status.** {{nb04_statussatz}}
>
> **Was offen bleibt.** Prognostiziert wird die Gesamtzahl der Fahrten; benötigt wird
> die Zahl der Räder je Station. Diese Umrechnung ist keine Formel, sondern eine eigene
> Analyse, und sie steht noch aus.
"""),

MD("""
## Einordnung: Prognose entlang der Zeit

Auch Notebook 1 trennt bereits **zeitlich** — ein zufälliger Schnitt wäre dort ebenso
falsch gewesen, weil Saison, Tarifänderungen und verändertes Verhalten Fahrten eben nicht
austauschbar machen. Der Unterschied liegt also nicht zwischen „zufällig richtig" und
„zeitlich richtig".

**Er liegt in der Struktur der Aufgabe.** In Notebook 1 ist die Reihenfolge ein
*Risiko*: Sie darf nicht verletzt werden, sonst leckt Zukunft ins Training. Hier ist die
Reihenfolge ein *Bestandteil der Zielgröße*. Drei Dinge kommen hinzu, die es dort nicht
gab:

| | in Notebook 1 | hier |
|---|---|---|
| Beobachtungseinheit | die einzelne Fahrt | der aggregierte Tag |
| Zusammenhang der Zeilen | Zeilen sind Momentaufnahmen | benachbarte Tage hängen voneinander ab (Autokorrelation) |
| Prognosehorizont | keiner — geschätzt wird der aktuelle Vorgang | ausdrücklich: der morgige Tag, entschieden am Vorabend |

> **Die Reihenfolge ist hier ein Teil der Daten, nicht nur eine Nebenbedingung.** Aus der
> Autokorrelation entstehen die Merkmale (Vortag, Vorwoche), aus dem Horizont entsteht
> die Frage, was um 18 Uhr überhaupt bekannt ist. Das zieht sich durch alle sechs Phasen.

> **Ein zufälliger Schnitt bliebe trotzdem verboten** — er gäbe dem Modell den 15. August
> zum Lernen und den 14. zum Testen.
"""),

# =====================================================================
MD("""
> ### ⚠ Woher die Daten kommen — bitte zuerst lesen
>
> **Die Nachfrage in diesem Notebook ist erzeugt.** `ausleihe.csv` stammt aus einem
> Generator, der Wochenrhythmus, Jahresgang, Wetter- und Veranstaltungseffekte
> **absichtlich verstärkt** eingebaut hat. Deshalb sind die Gütewerte hier besser, als
> sie in einem echten Netz wären.
>
> | | |
> |---|---|
> | **Fahrten und Nachfrage** | synthetisch, Muster didaktisch verstärkt |
> | **Wetter** | historische Werte für Würzburg |
> | **Kalender** | Feiertage echt, Ferien und Veranstaltungen typisiert |
> | **Wettervorhersage** | **simuliert** — es gibt keine archivierten Prognosen |
> | **Alle Euro-Beträge** | Szenariorechnungen unter gesetzten Annahmen |
>
> Was sich überträgt, ist das Vorgehen: der zeitliche Schnitt, die Frage nach dem
> Informationsstand um 18 Uhr, die asymmetrischen Kosten und die Einsicht, dass die
> genaueste Prognose nicht die günstigste ist. Die Zahlen übertragen sich nicht.
"""),

PHASE(1, "Die Disposition plant abends für den nächsten Tag. Sie braucht eine Zahl."),

MD("""
### Die Ausgangslage

Jeden Abend plant die Disposition den nächsten Tag: Räder laden, prüfen, verteilen,
Frühdienst besetzen. Grundlage ist heute die Faustregel *„so viel wie letzte Woche"*. An
Veranstaltungstagen und bei Wetterumschwüngen geht das regelmäßig daneben.

> ### ⚠ Was dieses Notebook liefert — und was nicht
>
> Prognostiziert wird die **Zahl der Fahrten** eines Tages. Das ist **nicht** dasselbe wie
> die Zahl bereitzustellender Räder und erst recht nicht der Personalbedarf:
>
> | | |
> |---|---|
> | **ein Rad bedient mehrere Fahrten** | hundert Fahrten heißen nicht hundert Räder |
> | **die Verteilung zählt** | Eine Station kann leer sein, während anderswo Räder stehen |
> | **Ladezustand, Werkstatt, Kapazität** | bestimmen mit, was überhaupt verfügbar ist |
> | **Personalbedarf** | folgt aus Arbeitsmengen, Schichten und Touren, nicht aus Fahrten |
>
> Die Übersetzung von Fahrten zu Rädern und Schichten ist eine **eigene Analyse**, die
> dieses Notebook nicht leistet. Was es leistet, ist die Zahl, auf der sie aufsetzen
> müsste — und die Frage, wie man mit ihrer Unsicherheit umgeht.

### Kosten der beiden Fehlerrichtungen

Die Kosten sind **je Fahrt** angesetzt, nicht je Rad — das ist die Einheit, die dieses
Notebook prognostiziert.

| Fehler | Was passiert | Kosten je Fahrt |
|---|---|---|
| **Unterdeckung** — die Nachfrage war höher als geplant | Kunde findet nichts, fährt nicht, ärgert sich | **4,00 €** (entgangenes Entgelt plus Unzufriedenheit) |
| **Überdeckung** — die Nachfrage war niedriger | unnötiges Laden, Prüfen, Verteilen | **0,80 €** |

**Unterdeckung ist fünfmal so teuer wie Überdeckung.** Das hat eine Folge, die vielen
zunächst widerstrebt: *Die beste Prognose ist dann nicht die genaueste.* Sie ist
absichtlich etwas zu hoch. Wir rechnen das in Phase 5 aus.

### Erfolgskriterien

| | Kriterium | Schwelle |
|---|---|---|
| **K1 fachlich** | Die Prognose muss die Faustregel „wie letzte Woche“ deutlich schlagen | mindestens 30 % weniger Fehler — **in mindestens {{pfad_anteil:.0%}} der Wettervorhersage-Pfade** |
| **K2 wirtschaftlich** | Die erwarteten Kosten je Tag müssen unter denen der Faustregel liegen | ebenfalls **in mindestens {{pfad_anteil:.0%}} der Pfade** |
| **K3 Betrieb** | Die Prognose muss am Vorabend um 18 Uhr vorliegen | dann beginnt die Nachtschicht |

> **Die {{pfad_anteil:.0%}} gelten für K1 *und* K2 — das steht hier, weil es sonst später
> stillschweigend hinzukäme.** Der Grund ist derselbe für beide: Die Wettervorhersage ist
> simuliert, und ein einzelner Pfad ist eine Einzelrealisierung. Ein Kostenvorteil, der
> nur in der Hälfte der Wetterziehungen entsteht, ist kein Kostenvorteil, sondern Glück.

### Was „Pilot" hier bedeutet

Der Begriff wird in dieser Reihe an mehreren Stellen benutzt, und er bedeutet nicht
überall dasselbe. Hier heißt er:

| | |
|---|---|
| **Wer sieht die Prognose** | die Disposition, im internen Planungswerkzeug — niemand sonst |
| **Wird danach gehandelt** | nein. Die Schichtplanung entsteht weiter wie bisher; die Prognose läuft daneben und wird protokolliert |
| **Laufzeit** | mindestens vier zusammenhängende Quartale, damit alle Jahreszeiten einmal vorkommen |
| **Abbruchkriterium** | K1 reißt in zwei aufeinanderfolgenden Monaten, oder die Prognose liegt an mehr als fünf Tagen je Monat nicht um 18 Uhr vor |
| **Was danach entschieden wird** | ob aus dem Mitlauf eine operative Dispositionshilfe wird — das ist eine eigene Freigabe mit eigenen Kriterien |

**Ein Pilot in diesem Sinne ist ein Schattenlauf, keine Dispositionsfreigabe.** Er kostet
nichts außer Rechenzeit, weil niemand nach ihm handelt — und genau deshalb darf er
starten, obwohl das Wetter simuliert ist und nur ein Testfenster vorliegt.

Das dritte Kriterium ist kein Nebensatz: Es bestimmt, **welche Merkmale erlaubt sind.**
Um 18 Uhr des Vortages kennen wir die Wettervorhersage, aber nicht das tatsächliche
Wetter. Deshalb wird in Phase 5 mit einer **simulierten Vorhersage** gerechnet, bevor
geurteilt wird — nicht danach.
"""),

# =====================================================================
PHASE(2, "Eine Zeitreihe schaut man sich zuerst an. Immer."),

CODE('''
import os
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import plotly.graph_objects as go
''' + laufzeit_code() + '''

BASIS = os.environ.get("VELO_BASIS",
    __ROHBASIS__)
pd.set_option("display.width", 150)

fahrten = pd.read_csv(BASIS + "ausleihe.csv", parse_dates=["startzeit"])
echte = fahrten[fahrten.status == "abgeschlossen"]

reihe = echte.groupby(echte.startzeit.dt.normalize()).size().rename("fahrten").to_frame()
reihe.index.name = "datum"

print(f"{len(reihe)} Tage von {reihe.index.min().date()} bis {reihe.index.max().date()}")
print(reihe.fahrten.describe().round(1).to_string())
print(f"\\nLücken in der Reihe: {int((reihe.index.to_series().diff().dt.days > 1).sum())}")
'''),

MD("""
> **Der letzte Wert ist wichtiger, als er aussieht.** Zeitreihen dürfen Lücken haben —
> aber sie müssen **bekannt, erklärt und ausdrücklich behandelt** sein. Jedes Verfahren,
> das mit Verschiebungen arbeitet (`shift`, gleitende Mittel), rechnet sonst still über
> die Löcher hinweg: `shift(7)` greift dann auf den siebtletzten *vorhandenen* Wert zu,
> nicht auf den Tag vor einer Woche. Hier gibt es keine Lücken — geprüft, nicht
> angenommen.

### 2.1 Verlauf der Reihe
"""),

CODE('''
fig, achsen = plt.subplots(2, 1, figsize=(14, 7), sharex=False)
achsen[0].plot(reihe.index, reihe.fahrten, lw=.8, color="#3d4b6b")
achsen[0].plot(reihe.index, reihe.fahrten.rolling(28, center=True).mean(),
               lw=2.2, color="#e00034", label="gleitendes Mittel, 28 Tage")
achsen[0].set_title("Fahrten je Tag über drei Jahre"); achsen[0].legend(); achsen[0].grid(alpha=.3)

letzte = reihe.last("120D") if hasattr(reihe, "last") else reihe.iloc[-120:]
achsen[1].plot(letzte.index, letzte.fahrten, marker=".", lw=1, color="#3d4b6b")
achsen[1].set_title("Die letzten 120 Tage — jetzt sieht man den Wochenrhythmus")
achsen[1].grid(alpha=.3)
plt.tight_layout(); plt.show()

# DIESELBE REIHE ZUM HINEINZOOMEN. Die statischen Bilder oben bleiben
# stehen - sie tragen die Aussage auch dort, wo Skripte entfernt werden.
# Der Zusatz hier ist das, was ein festes Bild nicht kann: einen
# beliebigen Zeitraum aufziehen und einzelne Tage ablesen.
_fig = go.Figure()
_fig.add_trace(go.Scatter(x=reihe.index, y=reihe.fahrten, mode="lines",
                          name="Fahrten je Tag", line=dict(width=.9),
                          hovertemplate="%{x|%d.%m.%Y}<br>%{y} Fahrten<extra></extra>"))
# Gerundet gesendet: Plotly schreibt sonst jede Nachkommastelle des
# gleitenden Mittels in die Datei, und die interessiert im Diagramm nicht.
_fig.add_trace(go.Scatter(x=reihe.index,
                          y=reihe.fahrten.rolling(28, center=True).mean().round(1),
                          mode="lines", name="gleitendes Mittel, 28 Tage",
                          line=dict(width=2.4), hoverinfo="skip"))
_fig.update_xaxes(rangeslider=dict(visible=True), title="Datum")
_fig.update_yaxes(title="Fahrten")
interaktiv(_fig, "Fahrten je Tag - Zeitraum unten aufziehen", hoehe=440)
'''),

MD("""
**Zwei Muster liegen übereinander**, und beide muss ein Modell abbilden können:

- ein **Jahresgang** — im Sommer wird gut doppelt so viel gefahren wie im Winter
- ein **Wochenrhythmus** — im unteren Bild deutlich als regelmäßiges Auf und Ab

Dazu kommen einzelne Ausschläge nach oben und unten, die weder zum Jahr noch zur Woche
gehören. Denen gehen wir gleich nach.

### 2.2 Verfügbare Merkmale
"""),

CODE('''
wetter = pd.read_csv(BASIS + "wetter.csv", parse_dates=["datum"]).set_index("datum")
feiertage = set(pd.read_csv(BASIS + "feiertage.csv", parse_dates=["datum"]).datum)

def tage_aus_zeitraeumen(datei):
    z = pd.read_csv(BASIS + datei, parse_dates=["von", "bis"])
    menge = set()
    for _, r in z.iterrows():
        menge.update(pd.date_range(r.von, r.bis, freq="D"))
    return menge

ferien = tage_aus_zeitraeumen("schulferien.csv")
vorlesung = tage_aus_zeitraeumen("semesterzeiten.csv")
veranstaltungen = tage_aus_zeitraeumen("veranstaltungen.csv")

d = reihe.join(wetter, how="left")
d["wochentag"] = d.index.dayofweek
d["monat"] = d.index.month
d["ist_wochenende"] = (d.wochentag >= 5).astype(int)
d["ist_feiertag"] = d.index.isin(feiertage).astype(int)
d["ist_ferien"] = d.index.isin(ferien).astype(int)
d["ist_vorlesungszeit"] = d.index.isin(vorlesung).astype(int)
d["ist_veranstaltung"] = d.index.isin(veranstaltungen).astype(int)
d = d.dropna(subset=["temp_mittel_c"])

print(f"{len(d)} Tage mit vollständigen Merkmalen")
print("\\nMittlere Fahrten je Wochentag:")
namen = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"]
print(d.groupby("wochentag").fahrten.mean().round(1).rename(index=dict(enumerate(namen))).to_string())
'''),

CODE('''
fig, achsen = plt.subplots(1, 3, figsize=(15, 4))
achsen[0].scatter(d.temp_mittel_c, d.fahrten, s=6, alpha=.3, color="#3d4b6b")
achsen[0].set_xlabel("Tagesmitteltemperatur (°C)"); achsen[0].set_ylabel("Fahrten")
achsen[0].set_title(f"Temperatur   r = {d.fahrten.corr(d.temp_mittel_c):+.2f}")

achsen[1].scatter(d.niederschlag_mm, d.fahrten, s=6, alpha=.3, color="#3d4b6b")
achsen[1].set_xlabel("Niederschlag (mm)")
achsen[1].set_title(f"Niederschlag   r = {d.fahrten.corr(d.niederschlag_mm):+.2f}")

gruppen = [d.loc[d.ist_veranstaltung == 0, "fahrten"], d.loc[d.ist_veranstaltung == 1, "fahrten"]]
achsen[2].boxplot(gruppen, tick_labels=["normal", "Veranstaltung"], showfliers=False)
achsen[2].set_title("Veranstaltungstage")
plt.tight_layout(); plt.show()

faktor = d.loc[d.ist_veranstaltung == 1, "fahrten"].mean() / d.loc[d.ist_veranstaltung == 0, "fahrten"].mean()
print(f"An Veranstaltungstagen im Mittel Faktor {faktor:.2f} gegenüber normalen Tagen.")
'''),

MD("""
### 2.3 Der Ferieneffekt als Scheinzusammenhang

Prüfen wir den Effekt der **Schulferien**. Die naheliegende Rechnung ist ein Vergleich der
Mittelwerte — und sie führt in die Irre.
"""),

CODE('''
werktags = d[d.ist_wochenende == 0]
roh_ferien = werktags.loc[werktags.ist_ferien == 1, "fahrten"].mean()
roh_sonst = werktags.loc[werktags.ist_ferien == 0, "fahrten"].mean()
print(f"ROH:  Ferien-Werktage ⌀ {roh_ferien:.1f}   sonstige Werktage ⌀ {roh_sonst:.1f}"
      f"   Faktor {roh_ferien/roh_sonst:.2f}")

##LUECKE Vergleichen Sie noch einmal, aber nur bei ähnlicher Temperatur (15 bis 22 Grad).
mild = werktags[(werktags.temp_mittel_c >= 15) & (werktags.temp_mittel_c <= 22)]
k_ferien = mild.loc[mild.ist_ferien == 1, "fahrten"].mean()
k_sonst = mild.loc[mild.ist_ferien == 0, "fahrten"].mean()
##ENDE
print(f"BEI 15-22 GRAD:  Ferien ⌀ {k_ferien:.1f}   sonstige ⌀ {k_sonst:.1f}"
      f"   Faktor {k_ferien/k_sonst:.2f}")

print(f"\\nMittlere Temperatur an Ferien-Werktagen:   {werktags.loc[werktags.ist_ferien==1,'temp_mittel_c'].mean():.1f} °C")
print(f"Mittlere Temperatur an sonstigen Werktagen: {werktags.loc[werktags.ist_ferien==0,'temp_mittel_c'].mean():.1f} °C")
'''),

MD("""
**Der rohe Vergleich sagt: Ferien machen kaum einen Unterschied.** Der kontrollierte
Vergleich sagt: In den Ferien liegt die Nachfrage um rund ein Viertel niedriger — bei
vergleichbarer Temperatur.

> **Was hier gezeigt wird, ist ein Zusammenhang, keine Ursache.** Das Temperaturband
> 15–22 °C hält die Temperatur ungefähr fest, sonst nichts: Monat, Wochentag,
> Vorlesungszeit, Feiertage und Veranstaltungen laufen weiter mit. „In den Ferien wird
> bei gleicher Temperatur weniger gefahren“ ist damit belegt — „**weil** Ferien sind“
> nicht. Für die Prognose genügt der Zusammenhang; für eine Maßnahme genügte er nicht.

Beide Rechnungen sind korrekt ausgeführt. Der Unterschied liegt in einer dritten Größe:
**Schulferien liegen überwiegend im Sommer**, und im Sommer ist es warm, und bei Wärme
wird mehr gefahren. Die Wärme hebt an, was die Ferien absenken — und im rohen Mittel
heben sich beide fast auf.

> Man nennt das eine **Störgröße** (Confounder). Sie ist die häufigste Ursache dafür,
> dass eine Auswertung das Gegenteil des Richtigen behauptet. Der Schutz dagegen ist
> nicht mehr Statistik, sondern die Frage: *Was könnte sonst noch anders sein zwischen
> diesen beiden Gruppen?*

Für das Modell hat das eine praktische Folge: Wir geben ihm **beide** Merkmale, Ferien
und Temperatur. Ein Modell, das mehrere Größen gleichzeitig berücksichtigt, trennt genau
das, was der rohe Mittelwertvergleich vermischt.
"""),

# =====================================================================
PHASE(3, "Der Schnitt in der Zeit — und was ein Modell am Vorabend wissen kann."),

CODE('''
merkmale = ["temp_mittel_c", "temp_max_c", "niederschlag_mm", "wind_max_kmh",
            "wochentag", "monat", "ist_wochenende", "ist_feiertag",
            "ist_ferien", "ist_vorlesungszeit", "ist_veranstaltung"]

TESTTAGE = 90
VALIDIERUNGSTAGE = 90
schnitt = d.index.max() - pd.Timedelta(days=TESTTAGE)
schnitt_val = schnitt - pd.Timedelta(days=VALIDIERUNGSTAGE)

##LUECKE Teilen Sie zeitlich in DREI Abschnitte: Training, Validierung, Test.
train = d[d.index <= schnitt_val]
val = d[(d.index > schnitt_val) & (d.index <= schnitt)]
test = d[d.index > schnitt]
##ENDE

X_train, y_train = train[merkmale], train.fahrten
X_val, y_val = val[merkmale], val.fahrten
X_test, y_test = test[merkmale], test.fahrten

# ─── DER INFORMATIONSSTAND VON 18 UHR ────────────────────────────────
#
# Kriterium 3 aus Phase 1 sagt: Die Prognose muss am Vorabend stehen.
# Dann gibt es kein Ist-Wetter, sondern nur eine Vorhersage. Wir
# simulieren sie mit der typischen Unsicherheit einer 24-Stunden-
# Vorhersage - und zwar AB HIER, nicht erst im Test.
#
# Eine fruehere Fassung waehlte Modell und Aufschlag unter Ist-Wetter
# und stoerte erst im Test. Das ist zweierlei Informationsstand in
# einem Verfahren: Man waehlt fuer eine Welt und liefert in eine andere.
# ALLE VIER WETTERFELDER, UND PHYSIKALISCH MOEGLICH.
#
# Zwei Fehler einer frueheren Fassung, beide vom Review gefunden:
#
# (1) Der WIND blieb unangetastet. Das Modell bekam also drei
#     Prognosewerte und einen Messwert - eine Information, die es am
#     Vorabend nicht gibt. Ein Spaltenvertrag ist noch kein
#     Informationsvertrag.
#
# (2) Mittel- und Maximaltemperatur wurden UNABHAENGIG gestoert. Dabei
#     entstanden Tage mit temp_max < temp_mittel - genau die Kombination,
#     die die Prognosefunktion unten als "vermutlich vertauscht"
#     zurueckweist. Der Testrahmen erzeugte Eingaben, die das Produkt
#     ablehnt.
#
# Deshalb wird jetzt die Mitteltemperatur gestoert und die TAGESAMPLITUDE
# getrennt - sie bleibt nicht-negativ, damit das Maximum nie unter das
# Mittel faellt.
STREUUNG_TEMP = 1.5       # Grad, 24-Stunden-Vorhersage
STREUUNG_AMPLITUDE = 1.0  # Grad, Tagesgang
STREUUNG_REGEN = 2.0      # mm
STREUUNG_WIND = 4.0       # km/h

def prognosewetter(X, startwert):
    """Was am Vorabend auf dem Bildschirm stuende - statt der Messung."""
    zufall = np.random.default_rng(startwert)
    Z = X.copy()
    amplitude = (X.temp_max_c - X.temp_mittel_c).clip(lower=0)
    Z["temp_mittel_c"] = X.temp_mittel_c + zufall.normal(0, STREUUNG_TEMP, len(X))
    Z["temp_max_c"] = Z.temp_mittel_c + np.clip(
        amplitude.values + zufall.normal(0, STREUUNG_AMPLITUDE, len(X)), 0, None)
    Z["niederschlag_mm"] = np.clip(
        X.niederschlag_mm.values + zufall.normal(0, STREUUNG_REGEN, len(X)), 0, None)
    Z["wind_max_kmh"] = np.clip(
        X.wind_max_kmh.values + zufall.normal(0, STREUUNG_WIND, len(X)), 0, None)
    # Die Gegenprobe zum Vertrag: was hier herauskommt, muss die
    # Prognosefunktion spaeter auch annehmen.
    assert (Z.temp_max_c >= Z.temp_mittel_c).all(), "unplausible Temperaturen erzeugt"
    assert (Z.niederschlag_mm >= 0).all() and (Z.wind_max_kmh >= 0).all()
    return Z

Xv_prognose = prognosewetter(X_val, 42)     # fuer Auswahl und Aufschlag
Xt_prognose = prognosewetter(X_test, 7)     # fuer den einmaligen Test

for name, teil in (("Training", train), ("Validierung", val), ("Test", test)):
    print(f"{name:<12s}{len(teil):>5d} Tage  {teil.index.min().date()} "
          f"bis {teil.index.max().date()}   Mittel {teil.fahrten.mean():5.1f} Fahrten")
'''),

MD("""
> **Warum drei Abschnitte und nicht zwei?** Weil in Phase 5 nicht nur ein Modell gewählt
> wird, sondern auch ein **Sicherheitsaufschlag**. Beides sind Entscheidungen, und
> Entscheidungen gehören nicht auf die Testmenge — sonst prüft man am Ende, wie gut man
> geraten hat.
>
> Die Validierung trägt die Wahl, der Test misst sie einmal. Das ist derselbe Aufbau wie
> in Notebook 1, nur mit Tagen statt Fahrten.

> **Und die Testmenge ist ein Sommer.** Sie liegt deutlich über dem Trainingsmittel —
> lesen Sie die drei Zahlen oben nebeneinander. Das ist keine Nachlässigkeit, sondern
> genau die Lage im Betrieb: Man trainiert auf der Vergangenheit und prognostiziert den
> kommenden Zeitraum, was immer er bringt.
>
> Es hat aber eine Folge, die am Ende in den Bericht gehört: **Ein Sommerfenster trägt
> keine Jahresaussage.** Wie das Modell im November arbeitet, weiß dieses Notebook
> nicht.
"""),

# =====================================================================
PHASE(4, "Erst die Faustregel der Disposition, dann zwei Modelle."),

CODE('''
from sklearn.linear_model import LinearRegression
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

def bewerten(name, y_wahr, y_prognose):
    return {"Verfahren": name,
            "MAE (Fahrten)": round(mean_absolute_error(y_wahr, y_prognose), 2),
            "RMSE": round(float(np.sqrt(mean_squared_error(y_wahr, y_prognose))), 2),
            "R²": round(r2_score(y_wahr, y_prognose), 3)}

# Gewaehlt wird auf der VALIDIERUNG, und zwar unter PROGNOSEWETTER.
# Die Testmenge bleibt bis Phase 5 unberuehrt.
linear = LinearRegression().fit(X_train, y_train)
##LUECKE Trainieren Sie einen HistGradientBoostingRegressor mit max_iter=400, random_state=42.
boosting = HistGradientBoostingRegressor(max_iter=400, random_state=42).fit(X_train, y_train)
##ENDE

vorwoche_val = d.fahrten.shift(7).loc[val.index]

ergebnisse = []
ergebnisse.append(bewerten("Nullmodell (Mittel des Trainings)", y_val,
                           np.full(len(y_val), y_train.mean())))
ergebnisse.append(bewerten("Faustregel: wie letzte Woche", y_val, vorwoche_val))
for name, modell in (("Lineare Regression", linear), ("Gradient Boosting", boosting)):
    e = bewerten(name, y_val, modell.predict(Xv_prognose))
    e["MAE mit Ist-Wetter"] = round(mean_absolute_error(y_val, modell.predict(X_val)), 2)
    ergebnisse.append(e)

tabelle = pd.DataFrame(ergebnisse)
print("VALIDIERUNG unter Prognosewetter - so, wie es um 18 Uhr aussähe.\\n")
print(tabelle.to_string(index=False))
print("\\nDie letzte Spalte zeigt, was mit dem TATSAECHLICHEN Wetter herauskäme.")
print("Sie steht nur zum Vergleich da - entschieden wird auf der Spalte davor.")

# ─── DIE WAHL ────────────────────────────────────────────────────────
# Abgeleitet, nicht getippt: das Modell mit dem kleinsten MAE unter
# Prognosewetter. Unter Ist-Wetter faele sie anders aus - genau das ist
# der Punkt.
kandidaten = {"Lineare Regression": linear, "Gradient Boosting": boosting}
nur_modelle = tabelle[tabelle.Verfahren.isin(kandidaten)]
gewaehlt_name = nur_modelle.loc[nur_modelle["MAE (Fahrten)"].idxmin(), "Verfahren"]
gewaehlt = kandidaten[gewaehlt_name]
prognose_val = gewaehlt.predict(Xv_prognose)

# Die Zahlen des Fliesstextes stammen ab hier aus dieser Tabelle, nicht
# aus dem Gedaechtnis: was gedruckt wird, wird auch geschrieben.
_mae = dict(zip(tabelle.Verfahren, tabelle["MAE (Fahrten)"]))
_ist = dict(zip(tabelle.Verfahren, tabelle["MAE mit Ist-Wetter"]))
merke("mae_null", _mae["Nullmodell (Mittel des Trainings)"])
merke("mae_faustregel", _mae["Faustregel: wie letzte Woche"])
merke("mae_linear", _mae["Lineare Regression"])
merke("mae_boosting", _mae["Gradient Boosting"])
merke("ist_linear", _ist["Lineare Regression"])
merke("ist_boosting", _ist["Gradient Boosting"])
merke("mittel_training", y_train.mean())
merke("mittel_validierung", y_val.mean())
merke("gewaehlt_name", gewaehlt_name)

print(f"\\nGEWÄHLT: {gewaehlt_name}")
umgekehrt = nur_modelle.loc[nur_modelle["MAE mit Ist-Wetter"].idxmin(), "Verfahren"]
if umgekehrt != gewaehlt_name:
    print(f"Unter Ist-Wetter hätte {umgekehrt} gewonnen. Die Wahl hängt also")
    print("nicht nur am Verfahren, sondern am Informationsstand, unter dem")
    print("man wählt.")
'''),

MD("""
### Drei Beobachtungen zur Reihe

**1. Die Faustregel ist schlechter als das Nullmodell.**
{{mae_faustregel:.2f}} gegen {{mae_null:.2f}} Fahrten MAE — und beide haben ein negatives
R², sind also schlechter als der Mittelwert des Validierungszeitraums selbst.

Das ist kein Rechenfehler. R² misst, wieviel besser ein Verfahren ist als der Mittelwert
**des bewerteten Zeitraums**. Das Nullmodell sagt den Mittelwert des *Trainings* voraus
({{mittel_training:.1f}} Fahrten), die Validierung liegt bei
{{mittel_validierung:.1f}} — schon das reicht für ein negatives R². Die Vorwochenregel ist noch schlechter, weil sie jeden Ausreißer der Vorwoche eine
Woche später wiederholt; die quadratische Rechnung bestraft das doppelt.

> **Eine schwache Faustregel ist trotzdem der richtige Maßstab** — weil sie das ist, was
> die Disposition heute tut. Ob sie gut ist, entscheidet nicht die Statistik, sondern die
> Praxis. Und wenn ein Modell sie nicht schlägt, hilft auch keine bessere Faustregel.

**2. MAE und R² sagen Verschiedenes.** „Wie weit daneben im Schnitt?" gegen „wieviel besser
als der Durchschnitt?". Wer nur eine von beiden berichtet, kann sich die passende
aussuchen — deshalb stehen hier beide.

**3. Unter Prognosewetter dreht sich die Reihenfolge der Modelle.** Mit dem tatsächlichen
Wetter liegt das Boosting vorn ({{ist_boosting:.2f}} gegen {{ist_linear:.2f}} Fahrten
MAE), mit der simulierten Vorhersage die lineare Regression
({{mae_linear:.2f}} gegen {{mae_boosting:.2f}}).

> **Das ist der wichtigste Befund dieses Abschnitts.** Das Boosting nutzt feine
> Wetterunterschiede besser aus — solange das Wetter stimmt. In **dieser Simulation**
> schlägt es die Fehler der Vorhersage mit derselben Feinheit auf die Prognose durch,
> während die gröbere lineare Regression sie glättet. Ob das allgemein für Boosting gilt,
> ist damit nicht gezeigt: Wir haben ein Verfahren, eine Fehlerverteilung und ein Fenster
> beobachtet, nicht eine Gesetzmäßigkeit gemessen.
>
> **Wer unter Ist-Wetter wählt, wählt für eine Welt, in der er nicht liefert.**
"""),

# =====================================================================
PHASE(5, "Wie gut ist die Prognose — und was ist die *richtige* Prognose, wenn die "
         "beiden Fehlerrichtungen unterschiedlich teuer sind?"),

MD("### 5.1 Die Kostenrechnung — und der Aufschlag, der auf die Validierung gehört"),

CODE('''
KOSTEN_UNTER = 4.00
KOSTEN_UEBER = 0.80
print(f"Fehlerkosten aus Phase 1: Unterdeckung {KOSTEN_UNTER:.2f} EUR je Fahrt, "
      f"Überdeckung {KOSTEN_UEBER:.2f} EUR je Fahrt "
      f"(Verhältnis {KOSTEN_UNTER/KOSTEN_UEBER:.0f} zu 1).")
print(f"Kostenoptimal waere damit das "
      f"{KOSTEN_UNTER/(KOSTEN_UNTER+KOSTEN_UEBER):.1%}-Quantil der Nachfrage -")
print("also eine Quantilsregression. Der Aufschlag unten ist die Naeherung dafuer.")

def kosten(y_wahr, y_prognose):
    fehl = np.asarray(y_wahr) - np.asarray(y_prognose)
    unter = np.clip(fehl, 0, None).sum() * KOSTEN_UNTER
    ueber = np.clip(-fehl, 0, None).sum() * KOSTEN_UEBER
    return unter + ueber

# DER AUFSCHLAG WIRD AUF DER VALIDIERUNG GEWAEHLT.
#
# Ihn auf der Testmenge zu suchen waere derselbe Fehler wie eine
# Modellwahl auf dem Test: Man findet den Wert, der genau dort am besten
# passt, und berichtet ihn als Ergebnis. In einer frueheren Fassung
# dieses Notebooks stand genau das - und der so gefundene Aufschlag ging
# anschliessend in das Freigabekriterium ein.
# DER SUCHRAUM MUSS DAS OPTIMUM ENTHALTEN, NICHT NUR BEGRENZEN.
# Eine fruehere Fassung suchte bis 30 % und fand 30 % - also genau den
# groessten geprueften Wert. Das ist kein gefundenes Optimum, sondern ein
# Randminimum: Es sagt nur, dass es innerhalb der Grenze nicht besser ging.
# Wer den Rand als Ergebnis berichtet, berichtet die Grenze des Suchraums.
grund_val = kosten(y_val, prognose_val)
aufschlaege = np.arange(0, 0.81, 0.02)
kostenreihe = [kosten(y_val, prognose_val * (1 + a)) for a in aufschlaege]
_i = int(np.argmin(kostenreihe))
bester = aufschlaege[_i]
AM_RAND = _i in (0, len(aufschlaege) - 1)

plt.figure(figsize=(9, 4))
plt.plot(aufschlaege * 100, kostenreihe, marker="o", color="#e00034")
plt.axvline(bester * 100, color="#3d4b6b", ls="--",
            label=f"günstigster Aufschlag: {bester:.0%}")
plt.xlabel("Sicherheitsaufschlag auf die Prognose (%)")
plt.ylabel("Kosten über die 90 Validierungstage (EUR)")
plt.title("Unterdeckung kostet fünfmal so viel wie Überdeckung"); plt.legend(); plt.grid(alpha=.3)
plt.tight_layout(); plt.show()

print(f"Auf der VALIDIERUNG gewählt:")
print(f"  ohne Aufschlag:  {grund_val:8,.0f} EUR".replace(",", "."))
print(f"  mit {bester:.0%} Aufschlag: {min(kostenreihe):8,.0f} EUR".replace(",", "."))
print(f"  Ersparnis:       {grund_val - min(kostenreihe):8,.0f} EUR über 90 Tage".replace(",", "."))
print(f"\\nSuchraum: {aufschlaege[0]:.0%} bis {aufschlaege[-1]:.0%} in "
      f"{len(aufschlaege)} Schritten.")
if AM_RAND:
    print("ACHTUNG: Das Minimum liegt am RAND des Suchraums. Damit ist nicht")
    print("gezeigt, dass dieser Aufschlag optimal ist - nur, dass es innerhalb")
    print("der Grenze nicht besser ging. Der Suchraum gehoert erweitert.")
else:
    print("Das Minimum liegt INNERHALB des Suchraums - links und rechts davon")
    print("wird es teurer. Das ist ein gefundenes Optimum, kein Randwert.")
merke("aufschlag", bester); merke("aufschlag_am_rand", int(AM_RAND))
merke("aufschlag_max", aufschlaege[-1])
print(f"\\nDieser Aufschlag von {bester:.0%} wird jetzt UNVERAENDERT auf den Test angewendet -")
print(f"zusammen mit dem auf der Validierung gewählten Modell ({gewaehlt_name}).")
'''),

MD("""
### 5.2 Der einmalige Testlauf

Jetzt wird die Testmenge **einmal** angefasst — mit dem Modell aus Phase 4 und dem
Aufschlag aus 5.1, beide vorher festgelegt. Und gleich richtig:

Das **Training** hat mit gemessenem Wetter gerechnet — mit den vorliegenden Daten geht es
nicht anders, denn archivierte Vorabendprognosen haben wir nicht. Vorzuziehen wären sie:
Ein Modell, das auf Messwerten lernt und auf Prognosewerten arbeitet, sieht im Betrieb
etwas anderes als im Training. **Modellwahl und Aufschlag dagegen liefen bereits unter
simuliertem Prognosewetter**, und der Test benutzt gleich dasselbe Verfahren mit einer
unabhängigen Zufallsziehung. Der Informationsstand ist ab der Validierung durchgehend
derselbe. Am Vorabend um
18 Uhr gibt es das nicht; es gibt nur eine **Vorhersage**. Kriterium 3 aus Phase 1 hat
das schon angekündigt: Die Prognose muss um 18 Uhr stehen, und das entscheidet, welche
Merkmale erlaubt sind.

Eine Temperaturvorhersage für den nächsten Tag liegt typischerweise um etwa 1,5 °C
daneben, eine Niederschlagsvorhersage deutlich mehr. **Wir simulieren das, bevor wir
urteilen** — nicht danach.
"""),

CODE('''
# Die Faustregel auf dem Test
vorwoche = d.fahrten.shift(7).loc[test.index]

# (a) Mit dem tatsaechlichen Wetter - die Zahl, die man gerne berichtet
prognose = gewaehlt.predict(X_test)

# (b) Mit simulierter Vorhersage - die Zahl, die im Betrieb gilt.
#     Dasselbe Verfahren wie auf der Validierung, anderer Startwert.
mit_vorhersage = gewaehlt.predict(Xt_prognose)

print(f"{'mit tatsächlichem Wetter (unrealistisch)':<46s} "
      f"MAE {mean_absolute_error(y_test, prognose):6.2f}")
print(f"{'mit simulierter Wettervorhersage (im Betrieb)':<46s} "
      f"MAE {mean_absolute_error(y_test, mit_vorhersage):6.2f}")
verlust = mean_absolute_error(y_test, mit_vorhersage) / mean_absolute_error(y_test, prognose) - 1
print(f"\\nUnterschied: {verlust:+.0%}. Ab hier zählt nur noch die zweite Zeile.")
print("Dass er hier so klein ausfällt, ist eine Eigenschaft des gewählten Modells:")
print("Die lineare Regression reagiert kaum auf feine Wetterunterschiede - und")
print("deshalb auch kaum auf deren Fehler.")
'''),

MD("""
**Die zweite Zahl ist die, gegen die geurteilt wird** — und zwar unabhängig davon, wie
sie ausfällt.

Hier fällt sie sogar etwas **besser** aus als die erste. Das ist kein Widerspruch, sondern
Zufall: Eine einzelne Ziehung von Vorhersagefehlern kann die Prognose zufällig näher an
die Wirklichkeit rücken. Über viele Ziehungen hinweg ist das nicht so — aber „über viele
Ziehungen" ist eben eine Verteilung, kein einzelner Wert.

> **Der Grund, die erste Zahl nicht zu berichten, ist deshalb nicht, dass sie zu gut
> wäre.** Der Grund ist, dass sie **ein anderes Produkt bewertet** als das, was ausgeliefert
> wird. Ein Test mit Wetterdaten, die um 18 Uhr niemand hat, misst ein Werkzeug, das es
> nicht gibt. Ob das Ergebnis dabei schmeichelhaft ausfällt oder nicht, ist gleichgültig.

Die pauschale Aussage *„ein Modell ist im Betrieb schlechter als im Test — immer"*
trifft hier nicht zu; die Zahlen darüber widerlegen sie.
"""),

CODE('''
fig, achsen = plt.subplots(2, 1, figsize=(14, 7))
achsen[0].plot(test.index, y_test, lw=1.6, color="#3d4b6b", label="tatsächlich")
achsen[0].plot(test.index, mit_vorhersage, lw=1.6, color="#e00034",
               label=f"{gewaehlt_name} (mit Wettervorhersage)")
achsen[0].plot(test.index, vorwoche, lw=1, color="#8c95a8", ls="--", label="Faustregel")
achsen[0].set_title("Prognose gegen Wirklichkeit, 90 Testtage"); achsen[0].legend(); achsen[0].grid(alpha=.3)

rest = y_test.values - mit_vorhersage
achsen[1].bar(test.index, rest, color=np.where(rest > 0, "#e00034", "#3d4b6b"), width=1.0)
achsen[1].axhline(0, color="black", lw=.8)
achsen[1].set_title("Abweichung (rot = mehr Fahrten als prognostiziert)"); achsen[1].grid(alpha=.3)
plt.tight_layout(); plt.show()

print(f"Mittlere Abweichung: {rest.mean():+.1f} Fahrten "
      f"({'Modell schätzt im Schnitt zu niedrig' if rest.mean() > 0 else 'zu hoch'})")
print(f"Tage mit Unterdeckung: {(rest > 0).sum()} von {len(rest)}")
'''),

MD("""
**Das ist ein Ergebnis, das man ohne Phase 1 nicht bekommt.** Die Prognose, die im MAE am
besten ist, ist betriebswirtschaftlich *nicht* die beste. Weil Unterdeckung fünfmal so
teuer ist, lohnt es sich, planmäßig etwas zu hoch zu planen.

> **Fachlich sauber wäre statt des Aufschlags eine Quantilsregression** — ein Modell, das
> nicht den Mittelwert schätzt, sondern das kostenoptimale Quantil. Bei 4,00 € gegen
> 0,80 € liegt es bei 4,00 / (4,00 + 0,80) = **83,3 %**. Der Aufschlag hier
> ist die Rechnung des armen Mannes, aber er zeigt dasselbe Prinzip und lässt sich in
> einer Zeile erklären.

### 5.3 Die Erfolgskriterien aus Phase 1
"""),

CODE('''
# ALLE Kriterienzahlen aus dem BETRIEBSFALL: Wettervorhersage statt
# Ist-Wetter, und der Aufschlag aus der Validierung, nicht aus dem Test.
mae_modell = mean_absolute_error(y_test, mit_vorhersage)
mae_faustregel = mean_absolute_error(y_test, vorwoche)
verbesserung = 1 - mae_modell / mae_faustregel
kosten_faustregel = kosten(y_test, vorwoche)
kosten_modell = kosten(y_test, mit_vorhersage * (1 + bester))

# Zum Vergleich, ausdruecklich NICHT entscheidungsrelevant:
kosten_schoen = kosten(y_test, prognose * (1 + bester))

# Die Huerde steht EINMAL. Dreimal getippt hiesse: zweimal falsch,
# sobald sie sich aendert.
K1_HUERDE = merke("k1_huerde", 0.30)

print("Erfolgskriterien aus Phase 1:\\n")
k1 = verbesserung >= K1_HUERDE
print(f"  1. mindestens {K1_HUERDE:.0%} weniger Fehler als die Faustregel   "
      f"{verbesserung:.0%}   {'ERFÜLLT' if k1 else 'GERISSEN'}")
k2 = kosten_modell < kosten_faustregel
werte = f"{kosten_modell:,.0f} gegen {kosten_faustregel:,.0f}".replace(",", ".")
print(f"  2. günstiger als die Faustregel                       {werte} EUR   "
      f"{'ERFÜLLT' if k2 else 'GERISSEN'}")
print(f"     dieselbe Zahl je Tag: {kosten_modell/len(y_test):.2f} gegen "
      f"{kosten_faustregel/len(y_test):.2f} EUR ueber {len(y_test)} Testtage")
# HAELT DAS URTEIL, ODER HAENGT ES AN EINER ZUFALLSZIEHUNG?
#
# Der Test oben benutzt EINE simulierte Wettervorhersage (Startwert 7).
# Ein Kriterium, das nur fuer diese eine Ziehung erfuellt ist, ist kein
# Ergebnis, sondern ein Zufall. Wir ziehen deshalb 300 unabhaengige
# Vorhersagefehler-Pfade auf DEMSELBEN Testfenster und sehen nach, wie
# oft die Kriterien halten. Das Modell und der Aufschlag bleiben fest -
# variiert wird nur die Wetterunsicherheit.
PFADE = 300
treffer_k1, treffer_k2, verbesserungen = 0, 0, []
for i in range(PFADE):
    p_pfad = gewaehlt.predict(prognosewetter(X_test, 1000 + i))
    v = 1 - mean_absolute_error(y_test, p_pfad) / mae_faustregel
    verbesserungen.append(v)
    treffer_k1 += v >= K1_HUERDE
    treffer_k2 += kosten(y_test, p_pfad * (1 + bester)) < kosten_faustregel
v_arr = np.array(verbesserungen)

print(f"\\n  Und über {PFADE} unabhängige Wettervorhersage-Pfade?")
print(f"     Fehlerreduktion: {np.percentile(v_arr, 5):.0%} / "
      f"{np.percentile(v_arr, 50):.0%} / {np.percentile(v_arr, 95):.0%}   "
      f"(5. / 50. / 95. Perzentil)")
print(f"     Kriterium 1 (≥ {K1_HUERDE:.0%}) erfüllt in {treffer_k1} von {PFADE} Pfaden "
      f"= {treffer_k1 / PFADE:.0%}")
print(f"     Kriterium 2 (günstiger) erfüllt in {treffer_k2} von {PFADE} Pfaden "
      f"= {treffer_k2 / PFADE:.0%}")

# ─── DAS URTEIL HAENGT AN DEN PFADEN, NICHT AN EINEM ────────────────
# Phase 1 verlangt die Fehlerreduktion in mindestens 95 % der
# Wettervorhersage-Pfade. Ein einzelner Pfad - auch ein vorab
# festgelegter - waere eine Einzelrealisierung, keine Aussage ueber
# Robustheit. Die Schwelle stand vor der Messung fest.
PFAD_ANTEIL = 0.95
_anteil_k1 = treffer_k1 / PFADE
_anteil_k2 = treffer_k2 / PFADE
K1_ROBUST = _anteil_k1 >= PFAD_ANTEIL
K2_ROBUST = _anteil_k2 >= PFAD_ANTEIL
merke("pfad_anteil", PFAD_ANTEIL)
merke("k1_pfadanteil", _anteil_k1); merke("k2_pfadanteil", _anteil_k2)
# ─── EIN STATUS, EINE BEDEUTUNG ─────────────────────────────────────
#
# "Pilot" heisst hier: Schattenlauf im internen Planungswerkzeug,
# niemand handelt danach (siehe Phase 1). Das ist NICHT dasselbe wie
# eine operative Dispositionsfreigabe - und weil das Wetter simuliert
# ist und nur ein Testfenster vorliegt, waere die auch nicht zu haben.
# Modellpaket, Konsole und Schlusszelle lesen aus dieser einen Variable.
STATUS = ("schattenpilot" if (K1_ROBUST and K2_ROBUST) else "ruecksprung")
STATUS_SATZ = {
    "schattenpilot": "Schattenpilot freigegeben \u2014 die Prognose l\u00e4uft im "
                     "internen Planungswerkzeug mit und wird protokolliert; "
                     "niemand handelt nach ihr. Keine operative "
                     "Dispositionsfreigabe.",
    "ruecksprung": "R\u00fccksprung \u2014 die vorab festgelegten Kriterien "
                   "halten \u00fcber die Wetterpfade nicht.",
}[STATUS]
urteil = STATUS.upper()
merke("nb04_urteil", urteil)
merke("nb04_status", STATUS)
merke("nb04_statussatz", STATUS_SATZ)
print(f"\\n  Gesamturteil: {urteil}")
print(f"  Kriterium 1 haelt in {_anteil_k1:.0%} der Pfade, Kriterium 2 in "
      f"{_anteil_k2:.0%} - gefordert sind {PFAD_ANTEIL:.0%}.")

# Jeder Satz hier folgt aus k1, k2 und treffer_k1. Eine gedruckte
# Schlussfolgerung, die unabhaengig von den Zahlen dasteht, ueberlebt
# deren Aenderung - und widerspricht dann der Tabelle darueber.
_erfuellt = [n for n, gilt in (("1", k1), ("2", k2)) if gilt]
if len(_erfuellt) == 2:
    print("  Beide Kriterien sind in DIESEM Testpfad erfüllt.")
elif _erfuellt:
    print(f"  In DIESEM Testpfad ist nur Kriterium {_erfuellt[0]} erfüllt.")
else:
    print("  In DIESEM Testpfad ist keines der beiden Kriterien erfüllt.")

_fehl = PFADE - treffer_k1
if _fehl:
    print(f"  In {_fehl} von {PFADE} Pfaden ({_fehl / PFADE:.0%}) faellt die")
    print(f"  Fehlerreduktion unter {K1_HUERDE:.0%}. Die Zusage verlangt")
    print(f"  {PFAD_ANTEIL:.0%} - sie ist damit "
          f"{'gehalten' if K1_ROBUST else 'GERISSEN'}.")
else:
    print(f"  Kriterium 1 haelt ueber alle {PFADE} Wetterziehungen.")
print("  Ein einzelner, vorab festgelegter Pfad ist eine gueltige Einzel-")
print("  realisierung - aber keine Aussage darueber, wie robust das Ergebnis")
print(f"  gegenueber Wetterfehlern ist. Genau dafuer stehen die {PFADE} Pfade.")
merke("pfade", PFADE); merke("pfade_k1", treffer_k1); merke("pfade_k1_fehl", _fehl)
print()
print(f"  {STATUS_SATZ}")
print()
print("  Drei Grenzen, die auch im Schattenlauf bestehen bleiben:")
print("  Die Wetterunsicherheit ist simuliert, es gibt nur ein Validierungs-")
print("  und ein Testfenster, und die Übersetzung von Fahrten zu Rädern und")
print("  Schichten steht aus. Genau deshalb ist der Pilot ein Mitlauf und")
print("  keine Dispositionshilfe: Er kostet nichts, weil niemand nach ihm")
print("  handelt - und er sammelt die saisonalen Fenster, die noch fehlen.")
print(f"\\n  Zum Vergleich - mit Ist-Wetter gerechnet waeren es "
      f"{kosten_schoen:,.0f} EUR gewesen.".replace(",", "."))
print("  Diese Zahl steht hier nur, damit man den Unterschied sieht.")

# ─── DIE UNBEQUEME GEGENPROBE ────────────────────────────────────────
# Was haette das ANDERE Modell auf dem Test gebracht? Diese Zahl darf die
# Entscheidung nicht mehr aendern - sie wurde nach der Wahl berechnet.
# Sie steht hier, weil sie etwas ueber das Verfahren sagt.
# JEDES MODELL MIT SEINEM EIGENEN, AUF DER VALIDIERUNG BESTIMMTEN
# AUFSCHLAG. Den Aufschlag der linearen Regression auf das Boosting zu
# legen waere ein unfairer Vergleich: Man haette das Modell des einen mit
# der Entscheidungsregel des anderen kombiniert - ein Paar, das nie
# jemand gewaehlt hat.
def eur(betrag):
    """Tausenderpunkt - und zwar NUR auf der Zahl, nicht auf dem Satz drumherum.
    Ein .replace(',', '.') ueber den ganzen f-String macht aus 'dort, wo'
    ein 'dort. wo'."""
    return f"{betrag:,.0f}".replace(",", ".")

def bester_aufschlag(modell):
    """Der kostenguenstigste Aufschlag AUF DER VALIDIERUNG, je Modell."""
    p_val = modell.predict(Xv_prognose)
    return aufschlaege[int(np.argmin(
        [kosten(y_val, p_val * (1 + a)) for a in aufschlaege]))]

verworfen = {n: m for n, m in kandidaten.items() if n != gewaehlt_name}
for name, modell in verworfen.items():
    p_test = modell.predict(Xt_prognose)
    eigener = bester_aufschlag(modell)
    print(f"\\n  Und was haette {name} auf dem Test gebracht?")
    print(f"     eigener Aufschlag aus der Validierung: {eigener:.0%} "
          f"(gewähltes Modell: {bester:.0%})")
    print(f"     MAE {mean_absolute_error(y_test, p_test):.2f} gegen "
          f"{mean_absolute_error(y_test, mit_vorhersage):.2f}, Kosten "
          f"{eur(kosten(y_test, p_test * (1 + eigener)))} gegen "
          f"{eur(kosten_modell)} EUR")
    v_paar = kosten(y_val, modell.predict(Xv_prognose) * (1 + eigener))
    v_gew = kosten(y_val, gewaehlt.predict(Xv_prognose) * (1 + bester))
    print(f"     Auf der VALIDIERUNG - dort, wo entschieden wurde - kostete dieses "
          f"Paar {eur(v_paar)} EUR")
    print(f"     gegen {eur(v_gew)} EUR des gewählten Paares.")
'''),

MD("""
> ### Die Wahl war richtig getroffen — und trotzdem die schlechtere
>
> Auf dem Testfenster wäre das Gradient Boosting besser gewesen. Die Validierung hat
> trotzdem korrekt entschieden: Sie hatte nur das Frühjahrsfenster, und dort war die
> lineare Regression überlegen. Das Testfenster ist ein Hochsommer mit fast doppelter
> Nachfrage — eine andere Lage, in der die feinere Anpassung des Boostings zahlt.
>
> **Wir wechseln jetzt nicht.** Nach dem Test das Modell zu tauschen hieße, auf dem Test
> zu wählen — und dann wäre er keiner mehr. Das Ergebnis bleibt stehen, und was es zeigt,
> ist keine Schwäche des Verfahrens, sondern der Preis **eines einzigen
> Validierungsfensters**:
>
> **Ein Fenster wählt für ein Fenster.** Was hier fehlt, sind rollierende
> Validierungsfenster über mehrere Jahreszeiten — dieselbe Lehre wie in Notebook 2, wo
> ein einzelnes günstiges Quartal beinahe ein Modell in Betrieb gebracht hätte. Es steht
> als erster Punkt in den offenen Fragen.

### 5.4 Die Tage mit dem größten Fehler
"""),

CODE('''
# EINE Prognoseserie, und zwar die BETRIEBLICHE. Eine fruehere Fassung
# zeigte hier die Prognose mit Ist-Wetter und daneben die Abweichung der
# Prognose mit Vorhersagewetter - tatsaechlich minus Prognose ergab dann
# nicht die angezeigte Abweichung. Die Tabelle war intern falsch.
schlechteste = pd.DataFrame({
    "tatsächlich": y_test.values, "Prognose": mit_vorhersage.round(0),
    "Abweichung": rest.round(0), "Temp": test.temp_mittel_c.values,
    "Regen": test.niederschlag_mm.values, "Wochenende": test.ist_wochenende.values,
    "Feiertag": test.ist_feiertag.values, "Veranstaltung": test.ist_veranstaltung.values,
}, index=test.index)
print("Die fünf Tage mit der größten Unterdeckung "
      "(Prognose mit Wettervorhersage, wie im Betrieb):\\n")
print(schlechteste.nlargest(5, "Abweichung").to_string())
print("\\nDie fünf Tage mit der größten Überdeckung:\\n")
print(schlechteste.nsmallest(5, "Abweichung").to_string())
'''),

# =====================================================================
PHASE(6, "Die Prognose muss jeden Abend um 18 Uhr auf dem Tisch liegen — mit einer "
         "Zutat, die wir bisher geschummelt haben."),

MD(kacheln([("{{gewaehlt_name}}", "gewähltes Verfahren"),
            ("{{mae_linear:.1f}}", "Fahrten mittlerer Fehler"),
            ("{{mae_faustregel:.1f}}", "Fehler der Faustregel"),
            ("{{nb04_status}}", "Status")])),

MD("""
### 6.1 Grenzen der simulierten Wettervorhersage

Das Machbarkeitsurteil in Phase 5 steht schon auf der Betriebszahl — das war die wichtigste
Korrektur an diesem Notebook. Zwei Dinge bleiben trotzdem offen, und sie gehören genannt:

**Erstens ist die Wetterunsicherheit simuliert, nicht gemessen.** Wir haben normalverteiltes
Rauschen auf alle vier Wettergrößen gelegt — 1,5 °C auf die Mitteltemperatur, 1,0 °C auf
den Tagesgang, 2 mm Niederschlag und 4 km/h Wind, aus der Literatur
gegriffen. Eine echte Vorhersage irrt anders: Sie irrt **systematisch**, sie irrt bei
Extremwetter stärker als im Mittel, und sie irrt bei Niederschlag anders als bei
Temperatur. Wer die Zahl belastbar haben will, braucht **archivierte Vorhersagen** —
also das, was am Vorabend tatsächlich auf dem Bildschirm stand.

**Zweitens ist der Testzeitraum ein Sommer.** Das Trainingsmittel liegt weit unter dem
Testmittel; wie das Modell im November arbeitet, weiß dieses Notebook nicht. Eine
Jahresfreigabe bräuchte mindestens vier Testfenster, eines je Jahreszeit.

### 6.2 Die Prognosefunktion
"""),

CODE('''
import joblib, datetime

# WIE WEIT REICHEN DIE KALENDER? Ein Datum ausserhalb ihrer Abdeckung
# wuerde stillschweigend als "kein Feiertag, keine Ferien, keine
# Veranstaltung" gelesen - also als Normaltag. Das waere keine Prognose,
# sondern eine Annahme mit unbekanntem Vorzeichen.
# GUELTIGKEIT IST EIN METADATUM, KEIN MAXIMUM.
#
# Eine fruehere Fassung rechnete
#     KALENDER_BIS = min(max(feiertage), max(ferien), ...)
# und nahm damit das LETZTE EINGETRAGENE EREIGNIS als Ende der Abdeckung.
# Das ist etwas anderes: veranstaltungen.csv endet am 13.07.2026, weil
# danach keine Veranstaltung mehr stattfindet - nicht, weil der Kalender
# dort aufhoert. schulferien.csv reicht bis in den September,
# feiertage.csv bis Mitte August.
#
# Die Folge war absurd: 42 der 90 Testtage lagen hinter dem eigenen
# Gueltigkeitsende. Das Notebook hat also einen Zeitraum ausgewertet, den
# die ausgelieferte Funktion verweigert haette.
#
# Richtig ist ein ausdrueckliches gueltig_bis JE QUELLE. Die CSV-Dateien
# fuehren es nicht - das ist selbst ein Befund. Bis es sie gibt, steht die
# Annahme hier sichtbar und an genau einer Stelle.
KALENDER_GUELTIG_BIS = {
    "feiertage":       pd.Timestamp("2026-08-31"),
    "ferien":          pd.Timestamp("2026-08-31"),
    "vorlesungszeit":  pd.Timestamp("2026-08-31"),
    "veranstaltungen": pd.Timestamp("2026-08-31"),
}
KALENDER_BIS = min(KALENDER_GUELTIG_BIS.values())
print("Kalender-Gueltigkeit (ANGENOMMEN - die CSV-Dateien fuehren kein gueltig_bis):")
for quelle, bis in KALENDER_GUELTIG_BIS.items():
    print(f"   {quelle:<16s} bis {bis.date()}")
# Der Test muss innerhalb der Gueltigkeit liegen - sonst bewertet man
# etwas, das die Funktion gar nicht liefern duerfte.
assert X_test.index.max() <= KALENDER_BIS, (
    f"Das Testfenster reicht bis {X_test.index.max().date()}, die Kalender nur "
    f"bis {KALENDER_BIS.date()}. Erst die Gueltigkeit klaeren.")
print(f"\\nTestfenster {X_test.index.min().date()} bis {X_test.index.max().date()} "
      f"liegt vollstaendig darin.")
print(f"Die Kalender reichen bis {KALENDER_BIS.date()}.")
print("Danach ist 'kein Feiertag' nicht bekannt, sondern nur nicht eingetragen.\\n")

# DER MERKMALSVERTRAG: EINE FUNKTION FUER ALLE DREI ORTE.
#
# Validierung, Test und Prognose muessen dieselben Rohfelder in derselben
# Bedeutung verwenden. Eine fruehere Fassung verlangte hier nur EINE
# Temperatur und leitete daraus ab:
#
#     temp_max_c   = temp_vorhersage + 5      # geraten
#     wind_max_kmh = 15.0                     # stiller Vorgabewert
#
# Beides ist im Test nie geprueft worden, denn dort standen die echten
# Werte. Der Aufschlag "+5" liegt an 36,7 % der Tage um mehr als zwei Grad
# daneben (die Spanne im Datensatz reicht von 0,3 bis 9,8 Grad), und der
# Wind schwankt zwischen 7,8 und 28,7 km/h. Wer so etwas still ergaenzt,
# liefert ein anderes Modell aus als das, das getestet wurde.
#
# Deshalb: alle vier Wetterfelder sind PFLICHT, und es gibt keine
# Vorgabewerte, die einen fehlenden Wert unsichtbar machen.
WETTERFELDER = ["temp_mittel_c", "temp_max_c", "niederschlag_mm", "wind_max_kmh"]
GRENZEN_PLAUSIBEL = {"temp_mittel_c": (-25, 45), "temp_max_c": (-20, 50),
                     "niederschlag_mm": (0, 150), "wind_max_kmh": (0, 200)}

def merkmalszeile(datum, wetter):
    """Baut die Merkmalszeile - dieselbe Logik wie fuer Training und Test."""
    tag = pd.Timestamp(datum)
    fehlt = [f for f in WETTERFELDER if f not in wetter or wetter[f] is None]
    if fehlt:
        raise ValueError(
            f"Diese Wetterfelder fehlen: {', '.join(fehlt)}. Sie werden nicht "
            "geschaetzt - das Modell wurde mit gemessenen Werten trainiert und "
            "unter Prognosewerten geprueft, nicht unter erfundenen.")
    for feld, (unten, oben) in GRENZEN_PLAUSIBEL.items():
        if not unten <= float(wetter[feld]) <= oben:
            raise ValueError(f"{feld} = {wetter[feld]} liegt ausserhalb von "
                             f"{unten} bis {oben}. Einheit oder Quelle pruefen.")
    if float(wetter["temp_max_c"]) < float(wetter["temp_mittel_c"]):
        raise ValueError("temp_max_c ist kleiner als temp_mittel_c - die beiden "
                         "Felder sind vermutlich vertauscht.")
    zeile = pd.DataFrame([{
        **{f: float(wetter[f]) for f in WETTERFELDER},
        "wochentag": tag.dayofweek, "monat": tag.month,
        "ist_wochenende": int(tag.dayofweek >= 5),
        "ist_feiertag": int(tag in feiertage), "ist_ferien": int(tag in ferien),
        "ist_vorlesungszeit": int(tag in vorlesung),
        "ist_veranstaltung": int(tag in veranstaltungen),
    }])
    fehlend = set(merkmale) - set(zeile.columns)
    ueberzaehlig = set(zeile.columns) - set(merkmale)
    if fehlend or ueberzaehlig:
        raise AssertionError(f"Merkmalsvertrag verletzt - fehlend: {fehlend}, "
                             f"ueberzaehlig: {ueberzaehlig}")
    return zeile[merkmale]

def nachfrage_prognostizieren(datum, wetter, aufschlag=None):
    """Die Zahl, die abends um 18 Uhr in der Disposition steht.

    wetter: dict mit allen vier Feldern aus WETTERFELDER - so, wie sie
            der Wetterdienst liefert. Keine Vorgabewerte, keine Ableitungen.
    """
    if aufschlag is None:
        aufschlag = bester
    tag = pd.Timestamp(datum)
    if tag > KALENDER_BIS:
        raise ValueError(
            f"{tag.date()} liegt hinter dem Ende der Kalender ({KALENDER_BIS.date()}). "
            "Feiertage, Ferien, Vorlesungszeit und Veranstaltungen sind dort unbekannt - "
            "sie als 'findet nicht statt' zu lesen waere eine Erfindung. "
            "Erst die Kalender pflegen, dann prognostizieren.")
    roh = max(0.0, float(gewaehlt.predict(merkmalszeile(tag, wetter))[0]))
    return int(round(roh)), int(round(roh * (1 + aufschlag)))

# Gegenprobe des Vertrags: die Spalten der Prognosezeile muessen exakt
# denen entsprechen, mit denen trainiert und getestet wurde.
probe = merkmalszeile("2026-07-07", {"temp_mittel_c": 21.0, "temp_max_c": 26.0,
                                     "niederschlag_mm": 0.0, "wind_max_kmh": 14.0})
assert list(probe.columns) == list(X_test.columns), "Spaltenreihenfolge weicht ab"
print(f"Merkmalsvertrag geprüft: {len(merkmale)} Felder, identisch zu Training und Test.\\n")

print(f"{'Tag':<17s}{'Wetterlage':<26s}{'Fahrten':>9s}{'mit Aufschlag':>15s}")
print("-" * 67)
for datum, wetter, beschreibung in [
        ("2026-07-07", {"temp_mittel_c": 21.0, "temp_max_c": 26.0,
                        "niederschlag_mm": 0.0, "wind_max_kmh": 14.0}, "mild und trocken"),
        ("2026-07-08", {"temp_mittel_c": 21.0, "temp_max_c": 25.0,
                        "niederschlag_mm": 8.0, "wind_max_kmh": 22.0}, "mild, kräftiger Regen"),
        ("2026-07-11", {"temp_mittel_c": 24.0, "temp_max_c": 30.0,
                        "niederschlag_mm": 0.0, "wind_max_kmh": 11.0}, "Samstag, warm"),
        ("2026-07-13", {"temp_mittel_c": 12.0, "temp_max_c": 16.0,
                        "niederschlag_mm": 3.0, "wind_max_kmh": 25.0}, "kühl und nass")]:
    roh, geplant = nachfrage_prognostizieren(datum, wetter)
    tag = pd.Timestamp(datum)
    print(f"{tag.strftime('%a %d.%m.%y'):<17s}{beschreibung:<26s}{roh:>9d}{geplant:>15d}")

# Gegenprobe 1: ein fehlendes Wetterfeld wird nicht ergaenzt, sondern gemeldet.
try:
    nachfrage_prognostizieren("2026-07-07", {"temp_mittel_c": 21.0, "niederschlag_mm": 0.0})
except ValueError as fehler:
    print(f"\\nGegenprobe unvollständiges Wetter:\\n  {fehler}")

# Gegenprobe 2: ein Datum hinter dem Kalenderende bricht ab.
try:
    nachfrage_prognostizieren("2026-12-15", {"temp_mittel_c": 3.0, "temp_max_c": 6.0,
                                             "niederschlag_mm": 1.0, "wind_max_kmh": 18.0})
except ValueError as fehler:
    print(f"\\nGegenprobe 15.12.2026:\\n  {fehler}")

joblib.dump({"modell": gewaehlt, "merkmale": merkmale, "aufschlag": bester,
             # Die BETRIEBSKENNZAHL steht zuerst und heisst so, wie sie
             # gemeint ist. "mae_test" war zweideutig - wer das Paket liest,
             # haelt die Ist-Wetter-Diagnose sonst fuer das Ergebnis.
             "mae_test_prognosewetter": round(
                 float(mean_absolute_error(y_test, mit_vorhersage)), 2),
             "mae_test_istwetter_nur_diagnose": round(
                 float(mean_absolute_error(y_test, prognose)), 2),
             "trainiert_bis": str(X_train.index.max().date()),
             "gewaehlt_auf": "Validierung unter simuliertem Prognosewetter",
             "gewaehltes_verfahren": gewaehlt_name,
             "validierung_bis": str(X_val.index.max().date()),
             "test_bis": str(X_test.index.max().date()),
             "datenherkunft": "ERFUNDENE LEHRDATEN - Nachfrage synthetisch erzeugt",
             "freigabestatus": STATUS,
             "freigabestatus_klartext": STATUS_SATZ,
             "gates": {"K1 Fehlerreduktion je Pfad": bool(K1_ROBUST),
                       "K2 Kostenvorteil je Pfad": bool(K2_ROBUST),
                       "geforderter Pfadanteil": PFAD_ANTEIL},
             "kostenbasis": "Szenarioproxy aus angenommenen Fehlerkosten je Fahrt, "
                            "keine gemessenen Betriebskosten",
             "trainiert_am": datetime.date.today().isoformat()}, "nachfragemodell.joblib")
print("\\ngespeichert: nachfragemodell.joblib")
'''),

MD("""
### 6.3 Überwachung

| Wache | Schwelle | Reaktion |
|---|---|---|
| MAE der letzten 28 Tage | über 20 % schlechter als im Test | Ursache suchen |
| Anteil Tage mit Unterdeckung | über 60 % | Aufschlag erhöhen |
| Güte der Wettervorhersage | Abweichung steigt | Fehler in der Wetterquelle, aber ein Fehler **des Systems** — Reaktion: auf die Faustregel zurückfallen, bis die Quelle wieder liefert |
| Veranstaltungskalender | ein Termin fehlt | **das Modell weiß nichts davon und wird den Tag verfehlen** |

**Die letzte Zeile ist die gefährlichste.** Das Modell kennt Veranstaltungen nur, weil sie
in einer CSV stehen. Findet nächstes Jahr ein neues Festival statt, das niemand einpflegt,
wird die Prognose an diesem Tag deutlich zu niedrig sein — und niemand wird wissen, warum.
**Ein Modell ist nur so aktuell wie die Stammdaten, die es füttert.**

### 6.4 Betriebsablauf

```
   17:45   Wettervorhersage abrufen
   17:50   Kalender prüfen: Feiertag, Ferien, Vorlesungszeit, Veranstaltung
   17:55   Prognose rechnen, Sicherheitsaufschlag aufschlagen
   18:00   Prognose an die nachgelagerte Dispositions- und Personalplanung
           (dort wird daraus eine Schicht - hier nicht)
   ------  am Folgetag
   23:00   tatsächliche Fahrten gegen die Prognose stellen, Abweichung protokollieren
   monatl. MAE der letzten 28 Tage prüfen, vierteljährlich nachtrainieren
```
"""),

# =====================================================================
MD("""
---

# Zusammenfassung

| Phase | Ergebnis |
|---|---|
| 1 Business Understanding | Prognostiziert werden **Fahrten**, nicht Räder oder Schichten — die Übersetzung ist eine eigene Analyse. Zwei ungleich teure Fehlerrichtungen (4,00 € gegen 0,80 € je Fahrt) und ein Betriebskriterium: Die Prognose muss um 18 Uhr stehen |
| 2 Data Understanding | Jahresgang und Wochenrhythmus liegen übereinander. Und eine **Störgröße**: Der rohe Ferieneffekt ist irreführend, weil Ferien im Sommer liegen |
| 3 Data Preparation | Schnitt entlang der Zeit in **drei** Abschnitte: Training, Validierung, Test. Die Testmenge ist der Sommer 2026 und liegt weit über dem Trainingsmittel |
| 4 Modeling | Nullmodell, echte Faustregel, linear und Gradient Boosting — verglichen unter **Prognosewetter**, nicht unter Ist-Wetter. Unter Ist-Wetter hätte das Boosting gewonnen, unter Prognosewetter gewinnt die lineare Regression |
| 5 Evaluation | Modell UND Aufschlag auf der Validierung gewählt, beides unter Prognosewetter. Der Test wurde erst **nach** dem Einfrieren beider Entscheidungen geöffnet; alles danach ist Diagnose und ändert die Wahl nicht mehr. Damit ist dieses Testfenster für eine weitere Entwicklungsrunde verbraucht |
| 6 Deployment | Prognosefunktion, Modellpaket und Überwachung. Status: **{{nb04_status}}** — {{nb04_statussatz}} Offen bleibt, dass die Wetterunsicherheit simuliert und nicht gemessen ist — und dass ein Sommerfenster keine Jahresaussage trägt |

**Was eine zweite Runde anders machen würde**

1. **Zurück zu Phase 1:** Wir haben *Fahrten* prognostiziert, gebraucht werden aber
   *Räder je Station*. Eine Gesamtzahl hilft der Disposition nur halb — die zehn
   Stationen brauchen zehn Prognosen. Das ist dieselbe Methode, aber zehnmal, mit
   deutlich dünneren Daten je Reihe.
2. **Zurück zu Phase 3:** Wir haben keine **Verzögerungsmerkmale** verwendet (Fahrten
   gestern, vorletzte Woche, gleitendes Mittel). Bei Zeitreihen sind das oft die
   stärksten Merkmale überhaupt — hier bewusst weggelassen, damit der Beitrag von Wetter
   und Kalender sichtbar bleibt.
3. **Ein Verfahren, das Unsicherheit mitliefert.** Statt einer Zahl eine Spanne
   (ein Intervall statt einer Zahl) — dann kann die Disposition selbst entscheiden, wie
   vorsichtig sie plant, statt sich auf unseren Aufschlag zu verlassen.

**Was offen bleibt — ausdrücklich**

1. **Ein Validierungsfenster wählt für ein Fenster.** Die Validierung entschied sich für
   die lineare Regression, auf dem Testfenster wäre das Boosting besser gewesen. Was
   fehlt, sind rollierende Fenster über mehrere Jahreszeiten — dann entschiede nicht das
   Frühjahr allein.
2. **Die Wetterunsicherheit ist simuliert, nicht gemessen.** Normalverteiltes Rauschen
   auf Temperatur und Niederschlag. Eine echte Vorhersage irrt systematisch und bei
   Extremwetter stärker. Belastbar wird die Zahl erst mit **archivierten Vorhersagen**.
3. **Ein Sommerfenster trägt keine Jahresaussage.** Das Testmittel liegt weit über dem
   Trainingsmittel. Wie das Modell im November arbeitet, weiß dieses Notebook nicht.
4. **Ein einziges Testfenster.** Für eine **operative Dispositionsfreigabe** bräuchte es
   mehrere, am besten je Jahreszeit eines. Genau die sammelt der Schattenpilot ein — das
   ist sein Zweck, und deshalb ist er keine Vorstufe der Freigabe, sondern ihre
   Voraussetzung.
5. **Der Aufschlag ist eine Krücke.** Fachlich sauber wäre eine Quantilsregression, die
   die Kostenasymmetrie im Modell selbst abbildet statt in einem Faktor danach.
6. **Erfundene Daten.** Alle Euro-Beträge sind Szenariorechnungen unter gesetzten
   Annahmen — die Fehlerkosten von 4,00 € und 0,80 € stammen aus keiner Messung.
7. **Fahrten sind keine Räder und kein Personal.** Die Übersetzung braucht Bestand,
   Ladezustand, Stationskapazität und Schichtregeln — eine eigene Analyse, die dieses
   Notebook nicht leistet.
8. **Die Kalender enden mitten im Prognosehorizont.** Die Prognosefunktion bricht dort
   jetzt ab, statt stillschweigend „kein Feiertag“ anzunehmen. Gepflegt sind sie damit
   aber nicht.
9. **Die lineare Regression wird durch die Kodierung benachteiligt.** `wochentag` und
   `monat` gehen als fortlaufende Zahlen ein; Dezember und Januar liegen dadurch weit
   auseinander. Dass sie unter Prognosewetter trotzdem gewinnt, macht den Befund
   stärker — für einen fairen Vergleich bräuchte es zyklische Merkmale.

**Weiter geht es mit Notebook 5 — Assoziationsanalyse:** Dort gibt es weder eine
Zielgröße noch Gruppen, sondern **Regeln**: Was hängt mit was zusammen? Dabei zeigt
sich, dass die auffälligsten Regeln meist die geringste betriebliche Bedeutung haben.
"""),
]
