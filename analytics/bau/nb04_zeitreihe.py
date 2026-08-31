# -*- coding: utf-8 -*-
"""Notebook 4 - Zeitreihe: Wieviele Fahrten kommen morgen?"""
from bauwerk import CODE, MD, PHASE, kopf

NAME = "04_Zeitreihe_Nachfrageprognose"

ZELLEN = [

kopf("Zeitreihe: Wie viele Fahrten kommen morgen?",
     "Zeitreihenprognose (überwacht — mit der Zeit als zusätzlicher Fessel)",
     "Wie viele Räder müssen morgen früh einsatzbereit sein, und wie viele Leute braucht der Frühdienst?",
     NAME),

MD("""
## Was diese Aufgabe von den ersten drei unterscheidet

In Notebook 1 haben wir Fahrten zufällig in Training und Test geteilt. Das war richtig,
weil Fahrten untereinander austauschbar sind.

**Hier wäre dasselbe Vorgehen ein schwerer Fehler.** Wir sagen die *Zukunft* vorher, und
die Zukunft darf beim Training nicht schon auf dem Tisch gelegen haben. Ein zufälliger
Schnitt würde dem Modell den 15. August zum Lernen geben und den 14. zum Testen — es
wüsste dann bereits, wie der Sommer 2026 verlaufen ist.

> **Die Reihenfolge ist hier ein Teil der Daten.** Das ist der ganze Unterschied — und
> er zieht sich durch alle sechs Phasen.
"""),

# =====================================================================
PHASE(1, "Die Disposition plant abends für den nächsten Tag. Sie braucht eine Zahl."),

MD("""
### Die Ausgangslage

Jeden Abend entscheidet die Disposition zwei Dinge:

1. **Wie viele Räder** müssen über Nacht geladen, geprüft und verteilt werden?
2. **Wie viele Leute** kommen morgen in den Frühdienst?

Heute geschieht das nach der Faustregel *„so viel wie letzte Woche“*. An
Veranstaltungstagen und bei Wetterumschwüngen geht das regelmäßig daneben.

### Die beiden Fehlerarten — wieder unterschiedlich teuer

| Fehler | Was passiert | Kosten je Fahrt |
|---|---|---|
| **Unterdeckung** — zu wenige Räder bereit | Kunde findet nichts, fährt nicht, ärgert sich | **4,00 €** (entgangenes Entgelt plus Unzufriedenheit) |
| **Überdeckung** — zu viele Räder bereit | unnötiges Laden, Prüfen, Verteilen | **0,80 €** |

**Unterdeckung ist fünfmal so teuer wie Überdeckung.** Das hat eine Folge, die vielen
zunächst widerstrebt: *Die beste Prognose ist dann nicht die genaueste.* Sie ist
absichtlich etwas zu hoch. Wir rechnen das in Phase 5 aus.

### Erfolgskriterien

| | Kriterium | Schwelle |
|---|---|---|
| **fachlich** | Die Prognose muss die Faustregel „wie letzte Woche“ deutlich schlagen | mindestens 30 % weniger Fehler |
| **wirtschaftlich** | Die erwarteten Kosten je Tag müssen unter denen der Faustregel liegen | |
| **Betrieb** | Die Prognose muss am Vorabend um 18 Uhr vorliegen | dann beginnt die Nachtschicht |

Das dritte Kriterium ist kein Nebensatz: Es bestimmt, **welche Merkmale erlaubt sind.**
Um 18 Uhr des Vortages kennen wir die Wettervorhersage, aber nicht das tatsächliche
Wetter. Darauf kommen wir in Phase 6 zurück — dort wird es unangenehm.
"""),

# =====================================================================
PHASE(2, "Eine Zeitreihe schaut man sich zuerst an. Immer."),

CODE('''
import os
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt

BASIS = os.environ.get("VELO_BASIS",
    "https://raw.githubusercontent.com/swrobuts/velocity-fallstudie/main/analytics/")
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
> **Der letzte Wert ist wichtiger, als er aussieht.** Eine Zeitreihe mit Lücken ist keine
> Zeitreihe — jedes Verfahren, das mit Verschiebungen arbeitet (`shift`, gleitende
> Mittel), rechnet dann still über Löcher hinweg. Hier gibt es keine.

### 2.1 Die Reihe ansehen
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
'''),

MD("""
**Zwei Muster liegen übereinander**, und beide muss ein Modell abbilden können:

- ein **Jahresgang** — im Sommer wird gut doppelt so viel gefahren wie im Winter
- ein **Wochenrhythmus** — im unteren Bild deutlich als regelmäßiges Auf und Ab

Dazu kommen einzelne Ausschläge nach oben und unten, die weder zum Jahr noch zur Woche
gehören. Denen gehen wir gleich nach.

### 2.2 Die Merkmale, die sich anbieten
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
### 2.3 Eine Falle, in die man hier zwangsläufig tappt

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
Vergleich sagt: Ferien senken die Nachfrage um rund ein Viertel.

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
schnitt = d.index.max() - pd.Timedelta(days=TESTTAGE)

##LUECKE Teilen Sie zeitlich: alles bis zum Schnitt ins Training, alles danach in den Test.
train = d[d.index <= schnitt]
test = d[d.index > schnitt]
##ENDE

X_train, y_train = train[merkmale], train.fahrten
X_test, y_test = test[merkmale], test.fahrten

print(f"Training: {len(train):>4d} Tage  {train.index.min().date()} bis {train.index.max().date()}")
print(f"Test:     {len(test):>4d} Tage  {test.index.min().date()} bis {test.index.max().date()}")
print(f"\\nMittlere Fahrten  Training {y_train.mean():.1f} | Test {y_test.mean():.1f}")
'''),

MD("""
> **Die Testmenge ist ein Sommer.** Das Training enthält alle Jahreszeiten, der Test nur
> den Hochsommer — und der liegt deutlich über dem Trainingsmittel. Das ist keine
> Nachlässigkeit, sondern genau die Lage im Betrieb: Man trainiert auf der Vergangenheit
> und prognostiziert den kommenden Zeitraum, was immer er bringt.
>
> Wir müssen es aber bei der Bewertung wissen. Ein Modell, das die Sommerlage nicht
> trifft, fällt hier auf — und das soll es auch.
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

ergebnisse = []
ergebnisse.append(bewerten("Nullmodell (Mittel des Trainings)", y_test,
                           np.full(len(y_test), y_train.mean())))

# Die Faustregel der Disposition: so viel wie am gleichen Wochentag der Vorwoche.
vorwoche = d.fahrten.shift(7).loc[test.index]
ergebnisse.append(bewerten("Faustregel: wie letzte Woche", y_test, vorwoche))

linear = LinearRegression().fit(X_train, y_train)
ergebnisse.append(bewerten("Lineare Regression", y_test, linear.predict(X_test)))

##LUECKE Trainieren Sie einen HistGradientBoostingRegressor mit max_iter=400, random_state=42.
boosting = HistGradientBoostingRegressor(max_iter=400, random_state=42).fit(X_train, y_train)
##ENDE
prognose = boosting.predict(X_test)
ergebnisse.append(bewerten("Gradient Boosting", y_test, prognose))

tabelle = pd.DataFrame(ergebnisse)
print(tabelle.to_string(index=False))
'''),

MD("""
### Zwei Beobachtungen, die man leicht überliest

**1. Zwei Verfahren haben ein negatives R².** Das sieht nach einem Rechenfehler aus, ist
aber korrekt — und lehrreich.

R² misst, wieviel besser ein Verfahren ist als der Mittelwert **der Testmenge**. Ein
negativer Wert heißt: schlechter als dieser Mittelwert.

- Beim **Nullmodell** (−1,19) liegt es daran, dass es den Mittelwert des *Trainings*
  vorhersagt — und der Test ist ein Hochsommer, der deutlich darüber liegt. Das Nullmodell
  ist also systematisch zu niedrig. Genau davor hatten wir in Phase 3 gewarnt.
- Bei der **Faustregel** (−0,26) liegt es an der Streuung: Sie trifft im Mittel näher als
  das Nullmodell (kleinerer MAE), verschätzt sich aber gelegentlich stark, und die
  quadratische Rechnung bestraft große Fehler überproportional.

> **Deshalb steht hier mehr als eine Kennzahl.** MAE und R² beantworten verschiedene
> Fragen — „wie weit daneben im Schnitt?" gegen „wie viel besser als raten?". Wer nur
> eine von beiden berichtet, kann sich die passende aussuchen.

**2. Genau diese Faustregel wird heute benutzt.** Das ist kein Strohmann, sondern die
Messlatte aus Phase 1 — und sie zeigt, wieviel hier zu holen ist.
"""),

# =====================================================================
PHASE(5, "Wie gut ist die Prognose — und was ist die *richtige* Prognose, wenn die "
         "beiden Fehlerrichtungen unterschiedlich teuer sind?"),

CODE('''
fig, achsen = plt.subplots(2, 1, figsize=(14, 7))
achsen[0].plot(test.index, y_test, lw=1.6, color="#3d4b6b", label="tatsächlich")
achsen[0].plot(test.index, prognose, lw=1.6, color="#e00034", label="Gradient Boosting")
achsen[0].plot(test.index, vorwoche, lw=1, color="#8c95a8", ls="--", label="Faustregel")
achsen[0].set_title("Prognose gegen Wirklichkeit, 90 Testtage"); achsen[0].legend(); achsen[0].grid(alpha=.3)

rest = y_test.values - prognose
achsen[1].bar(test.index, rest, color=np.where(rest > 0, "#e00034", "#3d4b6b"), width=1.0)
achsen[1].axhline(0, color="black", lw=.8)
achsen[1].set_title("Abweichung (rot = zu wenig Räder bereitgestellt)"); achsen[1].grid(alpha=.3)
plt.tight_layout(); plt.show()

print(f"Mittlere Abweichung: {rest.mean():+.1f} Fahrten "
      f"({'Modell schätzt im Schnitt zu niedrig' if rest.mean() > 0 else 'zu hoch'})")
print(f"Tage mit Unterdeckung: {(rest > 0).sum()} von {len(rest)}")
'''),

MD("### 5.1 Die Kostenrechnung — und warum die genaueste Prognose nicht die beste ist"),

CODE('''
KOSTEN_UNTER = 4.00
KOSTEN_UEBER = 0.80

def kosten(y_wahr, y_prognose):
    fehl = np.asarray(y_wahr) - np.asarray(y_prognose)
    unter = np.clip(fehl, 0, None).sum() * KOSTEN_UNTER
    ueber = np.clip(-fehl, 0, None).sum() * KOSTEN_UEBER
    return unter + ueber

grund = kosten(y_test, prognose)
print(f"Kosten der reinen Prognose über {len(y_test)} Tage: {grund:,.0f} EUR".replace(",", "."))

# Was passiert, wenn wir bewusst etwas zu hoch planen?
aufschlaege = np.arange(0, 0.31, 0.02)
kostenreihe = [kosten(y_test, prognose * (1 + a)) for a in aufschlaege]
bester = aufschlaege[int(np.argmin(kostenreihe))]

plt.figure(figsize=(9, 4))
plt.plot(aufschlaege * 100, kostenreihe, marker="o", color="#e00034")
plt.axvline(bester * 100, color="#3d4b6b", ls="--",
            label=f"günstigster Aufschlag: {bester:.0%}")
plt.xlabel("Sicherheitsaufschlag auf die Prognose (%)"); plt.ylabel("Kosten über 90 Tage (EUR)")
plt.title("Unterdeckung kostet fünfmal so viel wie Überdeckung"); plt.legend(); plt.grid(alpha=.3)
plt.tight_layout(); plt.show()

print(f"Ohne Aufschlag:  {grund:8,.0f} EUR".replace(",", "."))
print(f"Mit {bester:.0%} Aufschlag: {min(kostenreihe):8,.0f} EUR".replace(",", "."))
print(f"Ersparnis:       {grund - min(kostenreihe):8,.0f} EUR über 90 Tage".replace(",", "."))
'''),

MD("""
**Das ist ein Ergebnis, das man ohne Phase 1 nicht bekommt.** Die Prognose, die im MAE am
besten ist, ist betriebswirtschaftlich *nicht* die beste. Weil Unterdeckung fünfmal so
teuer ist, lohnt es sich, planmäßig etwas zu hoch zu planen.

> **Fachlich sauber wäre statt des Aufschlags eine Quantilsregression** — ein Modell, das
> nicht den Mittelwert schätzt, sondern zum Beispiel das 80-%-Quantil. Der Aufschlag hier
> ist die Rechnung des armen Mannes, aber er zeigt dasselbe Prinzip und lässt sich in
> einer Zeile erklären.

### 5.2 Die Erfolgskriterien aus Phase 1
"""),

CODE('''
mae_modell = mean_absolute_error(y_test, prognose)
mae_faustregel = mean_absolute_error(y_test, vorwoche)
verbesserung = 1 - mae_modell / mae_faustregel
kosten_faustregel = kosten(y_test, vorwoche)
kosten_modell = min(kostenreihe)

print("Erfolgskriterien aus Phase 1:\\n")
k1 = verbesserung >= 0.30
print(f"  1. mindestens 30 % weniger Fehler als die Faustregel   {verbesserung:.0%}   "
      f"{'ERFÜLLT' if k1 else 'GERISSEN'}")
k2 = kosten_modell < kosten_faustregel
werte = f"{kosten_modell:,.0f} gegen {kosten_faustregel:,.0f}".replace(",", ".")
print(f"  2. günstiger als die Faustregel                       {werte} EUR   "
      f"{'ERFÜLLT' if k2 else 'GERISSEN'}")
print(f"\\n  Gesamturteil: {'FREIGABE' if (k1 and k2) else 'RÜCKSPRUNG'}")
'''),

MD("### 5.3 Wo irrt das Modell? Die schlechtesten Tage ansehen"),

CODE('''
schlechteste = pd.DataFrame({
    "tatsächlich": y_test.values, "Prognose": prognose.round(0),
    "Abweichung": rest.round(0), "Temp": test.temp_mittel_c.values,
    "Regen": test.niederschlag_mm.values, "Wochenende": test.ist_wochenende.values,
    "Feiertag": test.ist_feiertag.values, "Veranstaltung": test.ist_veranstaltung.values,
}, index=test.index)
print("Die fünf Tage mit der größten Unterdeckung:\\n")
print(schlechteste.nlargest(5, "Abweichung").to_string())
print("\\nDie fünf Tage mit der größten Überdeckung:\\n")
print(schlechteste.nsmallest(5, "Abweichung").to_string())
'''),

# =====================================================================
PHASE(6, "Die Prognose muss jeden Abend um 18 Uhr auf dem Tisch liegen — mit einer "
         "Zutat, die wir bisher geschummelt haben."),

MD("""
### 6.1 Das ehrliche Eingeständnis

Unser Modell hat mit dem **tatsächlichen** Wetter gerechnet. Am Vorabend um 18 Uhr gibt
es das nicht — es gibt nur eine **Vorhersage**.

Das ist kein Schönheitsfehler, sondern eine echte Einschränkung, und sie gehört
ausgerechnet. Eine Temperaturvorhersage für den nächsten Tag liegt typischerweise um
etwa 1,5 °C daneben, eine Niederschlagsvorhersage deutlich mehr. Simulieren wir das.
"""),

CODE('''
zufall = np.random.default_rng(42)
X_prognosewetter = X_test.copy()
# Typische Unsicherheit einer 24-Stunden-Vorhersage
X_prognosewetter["temp_mittel_c"] += zufall.normal(0, 1.5, len(X_test))
X_prognosewetter["temp_max_c"] += zufall.normal(0, 1.8, len(X_test))
X_prognosewetter["niederschlag_mm"] = np.clip(
    X_test.niederschlag_mm.values + zufall.normal(0, 2.0, len(X_test)), 0, None)

mit_vorhersage = boosting.predict(X_prognosewetter)

print(f"{'mit tatsächlichem Wetter (unrealistisch)':<45s} MAE {mean_absolute_error(y_test, prognose):6.2f}")
print(f"{'mit simulierter Wettervorhersage (realistisch)':<45s} MAE {mean_absolute_error(y_test, mit_vorhersage):6.2f}")
verlust = mean_absolute_error(y_test, mit_vorhersage) / mean_absolute_error(y_test, prognose) - 1
print(f"\\nDer Fehler steigt um {verlust:.0%}.")
print(f"Kosten mit Vorhersagewetter: {kosten(y_test, mit_vorhersage * (1 + bester)):,.0f} EUR"
      .replace(",", "."))
print(f"Kosten der Faustregel:       {kosten_faustregel:,.0f} EUR".replace(",", "."))
'''),

MD("""
**Das ist die Zahl, die in den Projektbericht gehört** — nicht die schönere von vorhin.
Ein Modell, das mit Daten rechnet, die es im Betrieb nicht geben wird, ist im Betrieb
schlechter als im Test. Immer.

Erfreulich: Auch mit dieser Einschränkung bleibt die Prognose deutlich besser als die
Faustregel. Die Freigabe hält.

### 6.2 Die Prognosefunktion
"""),

CODE('''
import joblib, datetime

def nachfrage_prognostizieren(datum, temp_vorhersage, regen_vorhersage,
                              wind_vorhersage=15.0, aufschlag=None):
    """Die Zahl, die abends um 18 Uhr in der Disposition steht."""
    if aufschlag is None:
        aufschlag = bester
    tag = pd.Timestamp(datum)
    zeile = pd.DataFrame([{
        "temp_mittel_c": temp_vorhersage, "temp_max_c": temp_vorhersage + 5,
        "niederschlag_mm": regen_vorhersage, "wind_max_kmh": wind_vorhersage,
        "wochentag": tag.dayofweek, "monat": tag.month,
        "ist_wochenende": int(tag.dayofweek >= 5),
        "ist_feiertag": int(tag in feiertage), "ist_ferien": int(tag in ferien),
        "ist_vorlesungszeit": int(tag in vorlesung),
        "ist_veranstaltung": int(tag in veranstaltungen),
    }])[merkmale]
    roh = float(boosting.predict(zeile)[0])
    return int(round(roh)), int(round(roh * (1 + aufschlag)))

print(f"{'Tag':<17s}{'Wetterlage':<26s}{'Prognose':>10s}{'bereitstellen':>15s}")
print("-" * 68)
for datum, temp, regen, beschreibung in [
        ("2026-09-15", 21.0, 0.0, "mild und trocken"),
        ("2026-09-16", 21.0, 8.0, "mild, kräftiger Regen"),
        ("2026-09-19", 24.0, 0.0, "Samstag, warm"),
        ("2026-12-15", 3.0, 1.0, "Winter, nasskalt")]:
    roh, geplant = nachfrage_prognostizieren(datum, temp, regen)
    tag = pd.Timestamp(datum)
    print(f"{tag.strftime('%a %d.%m.%y'):<17s}{beschreibung:<26s}{roh:>10d}{geplant:>15d}")

joblib.dump({"modell": boosting, "merkmale": merkmale, "aufschlag": bester,
             "mae_test": round(float(mean_absolute_error(y_test, prognose)), 2),
             "mae_mit_wettervorhersage": round(float(mean_absolute_error(y_test, mit_vorhersage)), 2),
             "trainiert_bis": str(schnitt.date()),
             "trainiert_am": datetime.date.today().isoformat()}, "nachfragemodell.joblib")
print("\\ngespeichert: nachfragemodell.joblib")
'''),

MD("""
### 6.3 Überwachung

| Wache | Schwelle | Reaktion |
|---|---|---|
| MAE der letzten 28 Tage | über 20 % schlechter als im Test | Ursache suchen |
| Anteil Tage mit Unterdeckung | über 60 % | Aufschlag erhöhen |
| Güte der Wettervorhersage | Abweichung steigt | nicht das Modell ist schuld — die Quelle |
| Veranstaltungskalender | ein Termin fehlt | **das Modell weiß nichts davon und wird den Tag verfehlen** |

**Die letzte Zeile ist die gefährlichste.** Das Modell kennt Veranstaltungen nur, weil sie
in einer CSV stehen. Findet nächstes Jahr ein neues Festival statt, das niemand einpflegt,
wird die Prognose an diesem Tag deutlich zu niedrig sein — und niemand wird wissen, warum.
**Ein Modell ist nur so aktuell wie die Stammdaten, die es füttert.**

### 6.4 Der Betriebsablauf

```
   17:45   Wettervorhersage abrufen
   17:50   Kalender prüfen: Feiertag, Ferien, Vorlesungszeit, Veranstaltung
   17:55   Prognose rechnen, Sicherheitsaufschlag aufschlagen
   18:00   Zahl an die Disposition und die Schichtplanung
   ------  am Folgetag
   23:00   tatsächliche Fahrten gegen die Prognose stellen, Abweichung protokollieren
   monatl. MAE der letzten 28 Tage prüfen, vierteljährlich nachtrainieren
```
"""),

# =====================================================================
MD("""
---

# Der Kreislauf schließt sich

| Phase | Ergebnis |
|---|---|
| 1 Business Understanding | Zwei Entscheidungen (Räder, Frühdienst), zwei ungleich teure Fehlerrichtungen (4,00 € gegen 0,80 €) und ein Betriebskriterium — die Prognose muss um 18 Uhr stehen |
| 2 Data Understanding | Jahresgang und Wochenrhythmus liegen übereinander. Und eine **Störgröße**: Der rohe Ferieneffekt ist irreführend, weil Ferien im Sommer liegen |
| 3 Data Preparation | Schnitt entlang der Zeit statt zufällig — die Testmenge ist der Sommer 2026 |
| 4 Modeling | Nullmodell, dann die echte Faustregel der Disposition, dann linear und Gradient Boosting |
| 5 Evaluation | Klar besser als die Faustregel. Und: Die genaueste Prognose ist **nicht** die günstigste — ein Sicherheitsaufschlag senkt die Kosten |
| 6 Deployment | Das Modell rechnete mit dem tatsächlichen Wetter; mit einer simulierten Vorhersage steigt der Fehler spürbar. Die ehrliche Zahl gehört in den Bericht |

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
   („zwischen 95 und 130 Fahrten“) — dann kann die Disposition selbst entscheiden, wie
   vorsichtig sie plant, statt sich auf unseren Aufschlag zu verlassen.

**Weiter geht es mit Notebook 5 — Assoziationsanalyse:** Dort gibt es weder eine
Zielgröße noch Gruppen, sondern **Regeln**: Was hängt mit was zusammen? Und wir werden
sehen, dass die auffälligste Regel meistens die uninteressanteste ist.
"""),
]
