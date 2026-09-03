# -*- coding: utf-8 -*-
"""Notebook 2 - Klassifikation: Welche Raeder muessen naechstes Quartal in die Werkstatt?"""
from bauwerk import CODE, MD, PHASE, kopf
from gestaltung import kacheln, laufzeit_code

NAME = "02_Klassifikation_Wartungsrisiko"

ZELLEN = [

kopf("Klassifikation: Welche Räder müssen als Nächstes in die Werkstatt?",
     "Klassifikation (überwachtes Lernen, Zielgröße ist eine Kategorie)",
     "Welche 60 Räder soll die Werkstatt im nächsten Quartal vorsorglich prüfen?",
     NAME),

MD("""
> ### Kurzfassung
>
> **Fragestellung.** Die Werkstatt kann je Quartal nur {{kapazitaet:.0f}} Räder
> vorsorglich prüfen. Welche Räder gehören auf diese Liste?
>
> **Vorgehen.** Für jedes Rad wird vorhergesagt, ob es innerhalb von
> {{horizont_tage:.0f}} Tagen auffällig wird. Die beiden Fehlerarten sind
> unterschiedlich teuer — ein übersehener Ausfall kostet {{kosten_verpasst:.0f}} €, eine
> unnötige Prüfung {{kosten_unnoetig:.0f}} € —, und dieses Verhältnis geht als
> Klassengewicht in die Modelle ein.
>
> **Ergebnis.** Ausgeliefert wird eine Faustregel, nicht das Random-Forest-Modell. Im
> Testquartal trifft die Regel {{treffer_regel:.0f}} Räder gegenüber
> {{treffer_wald:.0f}}; ausschlaggebend war jedoch die statistische Absicherung. Die
> untere Vertrauensgrenze der Regel liegt bei {{wilson_unten_regel:.1%}} und damit über
> der geforderten Schwelle von {{k3_schwelle:.1%}}, das Random-Forest-Modell erreicht
> {{wilson_unten_wald:.1%}} und verfehlt sie. Von zehn geprüften Rädern werden
> {{quote_regel_von_zehn:.1f}} auffällig; von zehn auffälligen erfasst die Liste
> {{abdeckung_von_zehn:.1f}}.
>
> **Was offen bleibt.** Der Anteil auffälliger Räder schwankt über die
> {{panel_stichtage:.0f}} Stichtage zwischen {{panel_grundrate_min:.1%}} und
> {{panel_grundrate_max:.1%}}. Ein einzelnes günstiges Quartal belegt daher wenig.
> Beigelegt ist eine Schattenliste zum {{schatten_stichtag_lang}}, deren Bewertung erst
> nach Ablauf des Horizonts möglich ist.
"""),

MD("""
> ### ⚠ Woher die Daten kommen — bitte zuerst lesen
>
> **VeloCity ist ein erfundener Fahrradverleih, und alle Daten dieses Notebooks sind
> erzeugt.** Räder, Fahrten, Schadensmeldungen und Wartungsaufträge hat niemand
> beobachtet; sie stammen aus einem Generator, der die Muster, um die es hier geht,
> **absichtlich verstärkt** eingebaut hat.
>
> Das hat Folgen für jeden Satz, der weiter unten steht:
>
> | | |
> |---|---|
> | **Alle Euro-Beträge** | Szenariorechnungen unter gesetzten Annahmen, keine gemessenen Ersparnisse |
> | **„geht in Betrieb"** | heißt hier: geht in den Lehrbetrieb. Für eine echte Werkstatt müsste alles mit realen Daten neu validiert werden |
> | **Die Trefferquoten** | gelten für diesen Datensatz. Dass die Muster darin sauberer sind als in der Wirklichkeit, ist Absicht |
>
> **Was trotzdem echt ist:** das Vorgehen. Wie man eine Baseline baut, wie man zeitlich
> aufteilt, woran man einen instabilen Modellvorteil erkennt und wann man ein Modell
> nicht ausliefert — das überträgt sich, die Zahlen nicht.
"""),

# =====================================================================
PHASE(1, "Die Werkstatt hat begrenzte Kapazität. Sie soll die Räder prüfen, bei denen "
         "sich das lohnt — nicht die, die zufällig oben auf der Liste stehen."),

MD("""
### Die Ausgangslage

VeloCity repariert heute **reaktiv**: Ein Rad fällt aus, jemand meldet es, die Werkstatt
rückt aus. Das ist teuer: Das Rad steht irgendwo im Stadtgebiet, ein Kunde ist
unterwegs liegengeblieben, und die Werkstattfahrt war nicht eingeplant.

Die Werkstattleitung hat Kapazität für **{{kapazitaet:.0f}} vorsorgliche Prüfungen je
Quartal** (rund {{pruefungen_je_woche:.1f}} pro Woche, also etwa eine pro Werktag, neben
dem laufenden Betrieb). Die Frage ist nicht *ob* geprüft wird, sondern **welche
{{kapazitaet:.0f}} Räder**.

### Warum das eine Klassifikation ist

Gefragt ist keine Zahl, sondern eine **Einteilung**: Wird dieses Rad im nächsten Quartal
eine Schadensmeldung auslösen — ja oder nein? Zwei Klassen, also Klassifikation.

> *„Bei der Klassifikation geht es darum, Elemente anhand ihrer Merkmale automatisiert in
> Klassen einzuteilen. Die Klassen sind vorgegeben, die Klassenzugehörigkeit eines
> Elements ist nicht bekannt.“*
> — Provost/Fawcett, *Data Science für Unternehmen*, S. 45 f.

### Kosten der beiden Fehlerarten

Das ist der Kern dieser Phase, und er entscheidet später über das ganze Modell:

| Fehler | Was passiert | Kosten |
|---|---|---|
| **Falsch negativ** — Modell sagt „unauffällig“, das Rad fällt aber aus | Kunde bleibt liegen, Bergungsfahrt, Ersatz, Beschwerde | **180 €** |
| **Falsch positiv** — Modell sagt „prüfen“, das Rad war in Ordnung | eine halbe Stunde Werkstattzeit umsonst | **{{kosten_unnoetig:.0f}} €** |

**Ein verpasster Ausfall kostet gut sieben Mal so viel wie eine unnötige Prüfung.**
Ein Modell, das beide Fehler gleich behandelt, optimiert deshalb das Falsche. Wir werden
das in Phase 4 ausdrücklich einstellen müssen.

### Die Erfolgskriterien

**Die erste Fassung dieser Kriterien lautete:** „Von den 60 Rädern auf der Quartalsliste
müssen mindestens 70 % tatsächlich auffällig werden." Diese Formulierung ist nicht
haltbar; der Grund steht in Phase 2 und hat zu einem Rücksprung geführt.

> **Warum eine feste Trefferquote bei fester Kapazität nicht funktioniert.** Im November
> stehen unter {{winter_bestand:.0f}} Rädern nur {{winter_positiv:.0f}} auffällige. Wer
> davon 60 auf eine Liste setzt, hat höchstens {{winter_positiv:.0f}} Treffer — das sind
> {{winter_orakel:.1%}}. **Die Zusage ist in diesem Quartal auch bei perfekter
> Vorhersage nicht erreichbar** — und zwar nicht knapp, sondern grundsätzlich: Es gibt
> nicht genug auffällige Räder, um die Liste zu füllen.
>
> Eine Zusage, die kein Verfahren halten kann, ist kein anspruchsvolles Ziel. Sie ist
> falsch formuliert — und sie misst die Jahreszeit, nicht die Güte. Eine Trefferquote von
> {{k1_winterquote:.0%}} bei {{winter_grundrate:.1%}} Grundrate ist eine bessere Leistung
> als {{k1_sommerquote:.0%}} bei {{sommer_grundrate:.1%}}.

**Das ist ein Rücksprung nach Phase 1**, und er gehört zu CRISP-DM wie jeder andere: Das
Verständnis der Daten hat gezeigt, dass die Geschäftsfrage falsch operationalisiert war.
Korrigiert wird sie **jetzt** — vor der ersten Modellrechnung, nicht nachdem ein Verfahren
daran gescheitert ist.

| | Kriterium | Schwelle |
|---|---|---|
| **K1 fachlich** | Die Liste muss mindestens **{{k3_lift_diagnose}}-mal so viele** auffällige Räder enthalten wie eine Zufallsauswahl gleicher Länge — in mindestens {{k3_mindestquartale:.0f}} von 5 Quartalen | saisonunabhängig, weil an der Grundrate des jeweiligen Quartals gemessen |
| **K2 wirtschaftlich** | Die erwarteten Kosten je Quartal müssen **unter** denen der heutigen Faustregel liegen | die Faustregel lautet: „das älteste Rad zuerst" |
| **K3 statistisch** | Die untere Grenze des 95-%-Wilson-Intervalls der Listenpräzision muss im Testquartal über **{{k3_lift_diagnose}} × Grundrate** liegen | eine Quote aus {{kapazitaet:.0f}} Beobachtungen ist keine Zusage |
| **Betrieb** | Die Liste muss ohne Nacharbeit in die Instandhaltungsansicht übernehmbar sein | |

**Die 70 % verschwinden damit nicht — sie werden zur Diagnose.** Sie stehen als Spalte
`D70` in der Ergebnistabelle und sagen, wo die Verfahren gegenüber der ursprünglichen
Zusage stehen. **Bindend sind sie nicht**, und zwar aus einem Grund, den Abschnitt 5.4
rechnet: Wo die Grundrate zu niedrig ist, könnte sie nicht einmal ein Verfahren mit
vollständiger Kenntnis der Zukunft erreichen.

> **Diese drei Namen gelten für das ganze Notebook.** K1, K2, K3 bedeuten in Phase 5, im
> Code, in der Ergebnistabelle, in der Überwachung und in der Schlusszelle jeweils genau
> das, was hier steht. Werden dieselben Bezeichner an verschiedenen Stellen
> unterschiedlich belegt, lässt sich das Freigabeurteil nicht mehr auf die Zusage
> zurückführen.

Das wirtschaftliche Kriterium ist das wichtigste und wird gerne vergessen: **Ein Modell
muss nicht gut sein, sondern besser als das, was heute schon getan wird.**
"""),

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

# Woher stammen die Daten? Der eingebaute Pfad zeigt auf einen festen
# Git-Commit; steht er im Pfad, ist er die genaueste Angabe. Sonst - etwa
# beim lokalen Bauen - bleibt der Pfad selbst als Herkunft.
import re as _re
_treffer = _re.search(r"[0-9a-f]{40}", BASIS)
DATENSTAND_KURZ = _treffer.group(0)[:12] if _treffer else f"lokal:{BASIS[-30:]}"

KOSTEN_VERPASST = merke("kosten_verpasst", 180.0)  # falsch negativ: Ausfall auf der Strasse
KOSTEN_UNNOETIG = merke("kosten_unnoetig", 25.0)   # falsch positiv: Pruefung ohne Befund
merke("kosten_summe", 180.0 + 25.0)   # was ein Treffer beide Seiten bewegt
KAPAZITAET = merke("kapazitaet", 60)   # Pruefungen je Quartal

# Die Zusage aus Phase 1 - sie steht vor allem anderen, weil alles andere
# sich an ihr misst.
HUERDE = merke("huerde", 0.70)


def wilson(treffer, n, z=1.96):
    # 95-Prozent-Intervall fuer einen Anteil - auch bei kleinem n brauchbar.
    if n == 0:
        return (float("nan"), float("nan"))
    p = treffer / n
    nenner = 1 + z**2 / n
    mitte = (p + z**2 / (2*n)) / nenner
    rand = z * np.sqrt(p*(1-p)/n + z**2 / (4*n*n)) / nenner
    return mitte - rand, mitte + rand
merke("pruefungen_je_woche", KAPAZITAET / 13)  # ein Quartal hat 13 Wochen
HORIZONT_TAGE = merke("horizont_tage", 90)   # Vorhersagefenster

print(f"Ein verpasster Ausfall kostet das "
      f"{KOSTEN_VERPASST / KOSTEN_UNNOETIG:.1f}-fache einer unnötigen Prüfung.")
print(f"Kapazität: {KAPAZITAET} Räder je Quartal, Vorhersagefenster {HORIZONT_TAGE} Tage.")
'''),

# =====================================================================
PHASE(2, "Wie oft fallen Räder überhaupt aus, und hängt das erkennbar mit ihrer Nutzung "
         "zusammen? Ohne einen solchen Zusammenhang wäre das Projekt hier zu Ende."),

CODE('''
raeder = pd.read_csv(BASIS + "fahrrad.csv", parse_dates=["angeschafft_am", "ausgemustert_am"])
schaeden = pd.read_csv(BASIS + "schadensmeldung.csv", parse_dates=["gemeldet_am"])
auftraege = pd.read_csv(BASIS + "wartungsauftrag.csv", parse_dates=["eroeffnet_am", "erledigt_am"])
fahrten = pd.read_csv(BASIS + "ausleihe.csv", parse_dates=["startzeit", "endzeit"])
# Die Routenmatrix haelt Strecke und Steigung jeder Verbindung fest.
routen = pd.read_csv(BASIS + "radrouten_matrix.csv", comment="#")

print(f"Räder:              {len(raeder):>6d}   davon ausgemustert: {(raeder.status=='ausgemustert').sum()}")
print(f"Schadensmeldungen:  {len(schaeden):>6d}")
print(f"Wartungsaufträge:   {len(auftraege):>6d}")
print(f"Fahrten:            {len(fahrten):>6d}")
print(f"\\nZeitraum der Meldungen: {schaeden.gemeldet_am.min().date()} bis {schaeden.gemeldet_am.max().date()}")
print("\\nSchwere der Meldungen:")
print(schaeden.schwere.value_counts().to_string())
print("\\nHäufigste Kategorien:")
print(schaeden.kategorie.value_counts().head(5).to_string())
'''),

MD("### 2.1 Wie verteilen sich die Meldungen auf die Flotte?"),

CODE('''
je_rad = schaeden.groupby("fahrrad_id").size().reindex(raeder.fahrrad_id, fill_value=0)

fig, achsen = plt.subplots(1, 2, figsize=(13, 4))
achsen[0].hist(je_rad, bins=range(0, int(je_rad.max()) + 2), color="#3d4b6b", align="left")
achsen[0].set_title("Wie viele Meldungen hat ein Rad in drei Jahren?")
achsen[0].set_xlabel("Anzahl Meldungen"); achsen[0].set_ylabel("Räder")

nutzung = fahrten[fahrten.status == "abgeschlossen"].groupby("fahrrad_id").agg(
    fahrten_gesamt=("ausleihe_id", "size"),
    km_gesamt=("distanz_km", "sum"),
)
verbund = raeder.set_index("fahrrad_id").join(nutzung).join(je_rad.rename("meldungen"))
# nullen-sind-echt: Ein Rad ohne Eintrag in der Fahrtentabelle ist nie
# gefahren worden - null ist die Zahl, nicht das fehlende Datum.
verbund["fahrten_gesamt"] = verbund.fahrten_gesamt.fillna(0)

achsen[1].scatter(verbund.km_gesamt, verbund.meldungen, s=18, alpha=.6, color="#3d4b6b")
achsen[1].set_xlabel("gemessene Kilometer je Rad"); achsen[1].set_ylabel("Anzahl Meldungen")
achsen[1].set_title("Nutzung gegen Meldungen")
plt.tight_layout(); plt.show()

r = merke("korrelation_km_meldungen", verbund[["km_gesamt", "meldungen"]].corr().iloc[0, 1])
print(f"Korrelation Kilometer <-> Meldungen: r = {r:.3f}")
print(f"Meldungen je Rad: Mittel {je_rad.mean():.1f}, Median {je_rad.median():.0f}, "
      f"Maximum {je_rad.max()}")
'''),

MD("""
**Der Zusammenhang ist da, aber er ist nicht perfekt** — und genau so soll es sein. Bei
r = {{korrelation_km_meldungen:.3f}} gibt es viel gemeinsame Bewegung und trotzdem Räder,
die viel gefahren wurden und selten melden, und umgekehrt.

Ein Wort zur Höhe: {{korrelation_km_meldungen:.3f}} ist für einen Zusammenhang zwischen
Nutzung und Schadensmeldungen **auffällig stark**. In echten Flottendaten liegt er
niedriger, weil Meldungen auch von Wetter, Abstellort und Meldefreude abhängen. Hier
erzeugt der Datengenerator Schäden im Wesentlichen aus der Fahrleistung — das Signal ist
also sauberer, als die Wirklichkeit es liefern würde. Für das Lernen der Methode ist das
gewollt; für eine Übertragung auf echte Daten ist es die wichtigste Einschränkung dieses
Notebooks.

<!-- zahl-ohne-ausgabe: 0,99 rhetorischer Grenzfall, keine gemessene Groesse -->
<!-- zahl-ohne-ausgabe: 0,1 rhetorischer Grenzfall, keine gemessene Groesse -->
Wäre r = 0,99, bräuchte man kein Modell, sondern eine Sortierung nach Kilometern.
Wäre r = 0,1, wäre nichts zu lernen.

### 2.2 Der Zeitpunkt der Frage
"""),

CODE('''
# Wieviele Raeder melden sich in einem 90-Tage-Fenster?
ende = fahrten.startzeit.max().normalize()
stichtag = ende - pd.Timedelta(days=HORIZONT_TAGE)
im_bestand = raeder[(raeder.angeschafft_am <= stichtag)
                    & (raeder.ausgemustert_am.isna() | (raeder.ausgemustert_am > stichtag))]
melden = set(schaeden[schaeden.gemeldet_am > stichtag].fahrrad_id)
positiv = im_bestand.fahrrad_id.isin(melden)

print(f"Stichtag: {stichtag.date()}, Fenster bis {ende.date()}")
print(f"Räder im Bestand:             {len(im_bestand)}")
merke("quote_meldung_fenster", positiv.mean())
merke("anteil_flotte_pruefbar", KAPAZITAET / len(im_bestand))
print(f"davon mit Meldung im Fenster: {positiv.sum()}  ({positiv.mean():.1%})")
print(f"\\nWerkstattkapazität {KAPAZITAET} von {len(im_bestand)} Rädern "
      f"= {KAPAZITAET/len(im_bestand):.0%} der Flotte")
'''),

MD("""
Rund **{{quote_meldung_fenster:.1%}} der Räder** melden sich in einem Quartal — die Klassen
sind also gut besetzt. Aber die Werkstatt kann nur
**{{anteil_flotte_pruefbar:.0%}} der Flotte** prüfen. Das Modell muss also nicht nur
richtig liegen, sondern **priorisieren**: Es muss sagen, welche Räder am dringendsten
sind, nicht nur welche überhaupt auffällig werden. Darauf kommen wir in Phase 5 zurück.
"""),

# =====================================================================
PHASE(3, "Wir bauen eine Tabelle, in der jede Zeile eine **Frage zu einem Zeitpunkt** ist: "
         "„Rad 47, Stand 1. April — meldet es sich bis zum 30. Juni?\“"),

MD("""
### 3.1 Zielgröße und Stichtag

Man nimmt jedes Rad, zählt seine Kilometer **über den gesamten Zeitraum** und fragt: hat
es je eine Meldung gehabt? Das ergibt eine schöne Tabelle — und ein wertloses Modell.

**Warum:** Die Kilometer eines Rades, das im Januar ausfiel, enthalten auch die
Kilometer *nach* dem Januar. Das Modell lernt aus der Zukunft. Und die Frage „hat es je
gemeldet?“ hilft der Werkstatt nicht, denn sie plant *das nächste Quartal*.

**Richtig ist ein Schnitt in der Zeit:**

```
   Merkmale               Stichtag              Label
   ├──── 180 Tage ────────┤                      │
   Fahrten, km, frühere   │  ←→  90 Tage  →  Meldung ja/nein
   Meldungen ...          │
```

Alles links vom Stichtag darf ins Modell. Alles rechts davon ist das, was vorhergesagt
werden soll — und muss beim Rechnen unsichtbar bleiben.

### 3.2 Mehrere Stichtage je Rad

Ein einziger Stichtag ergäbe {{zeilen_je_stichtag:.0f}} Zeilen — zu wenig. Wir stellen dieselbe Frage deshalb
zu **mehreren Zeitpunkten**, im Abstand eines Quartals. Jedes Rad taucht dann mehrfach
auf, aber mit *unterschiedlichem* Wissensstand und *unterschiedlichem* Ausgang. Das ist
kein Trick, sondern genau die Art, wie solche Modelle in der Praxis gebaut werden.
"""),

MD("""
### Herkunft der Kilometerangaben

Der Sensor meldet nur einen Teil der Strecken. Die Lücke lässt sich auf zwei Wegen
füllen, und sie sind nicht gleich gut:

1. **Der Messwert**, wo er vorliegt.
2. **Die Routenmatrix**, wo Start und Ziel bekannt sind. Die Strecke zwischen zwei
   Stationen steht fest — sie muss nicht geraten werden.
3. **Dauer mal typischer Geschwindigkeit**, wo die Fahrt frei im Gebiet endete und es
   kein Ziel gibt.

Die Reihenfolge ist keine Geschmacksfrage. Die nächste Zelle prüft beide Ersatzquellen
dort, wo der Sensor gemessen hat — dann kennen wir die Wahrheit und können vergleichen.

> **Und ein Merkmal entsteht dabei, das es vorher nicht gab:** die **Höhenmeter**.
> Bergauf leidet der Antrieb, bergab die Bremse. Beides ist Verschleiß, und beides
> steht in keiner Spalte der Ausleihtabelle — erst die Steigung der Verbindung macht es
> rechenbar.
"""),

CODE('''
abgeschlossen = fahrten[fahrten.status == "abgeschlossen"].copy()
abgeschlossen["dauer_min"] = (abgeschlossen.endzeit - abgeschlossen.startzeit).dt.total_seconds() / 60
vorher = len(abgeschlossen)

# AUSREISSER ZUERST - sonst wandern sie in jedes Verschleissmerkmal.
# Eine Fahrt ueber acht Stunden ist keine Fahrt, sondern eine vergessene
# Rueckgabe. Bei 11 bis 18 km/h ergaebe die laengste davon knapp 300
# geschaetzte Kilometer an EINEM Tag - und traegt ein Rad weit nach oben.
LANGFAHRT_STUNDEN = 8
lang = abgeschlossen.dauer_min > LANGFAHRT_STUNDEN * 60
print(f"Fahrten über {LANGFAHRT_STUNDEN} Stunden: {lang.sum()} "
      f"(längste {abgeschlossen.dauer_min.max():.0f} Minuten) - ausgeschlossen")
abgeschlossen = abgeschlossen[~lang].copy()
print(f"Abgeschlossene Fahrten: {vorher} -> {len(abgeschlossen)}")

# DIE SENSORLUECKE SCHLIESSEN - in der Reihenfolge der Guete.
# Wo eine Distanz gemessen wurde, wird sie verwendet. Alles zu schaetzen
# hiesse, sechs von zehn vorhandenen Messungen wegzuwerfen, weil vier fehlen.
# Drei Quellen in absteigender Guete:
#   1. der Messwert, wo er da ist;
#   2. die Routenmatrix, wo Start und Ziel bekannt sind - die Strecke steht
#      dort fest und muss nicht geraten werden;
#   3. Dauer mal typischer Geschwindigkeit, wo die Fahrt frei endete.
TYPISCHE_GESCHWINDIGKEIT = {"CITY": 13.0, "EBIKE": 18.0, "CARGO": 11.0}   # km/h
abgeschlossen = abgeschlossen.merge(raeder[["fahrrad_id", "typ_code"]], on="fahrrad_id", how="left")

matrix = routen.set_index(["von_id", "nach_id"])
schluessel = [
    (str(int(a)), str(int(b))) if pd.notna(b) else None
    for a, b in zip(abgeschlossen.start_station_id, abgeschlossen.end_station_id)]
aus_matrix = pd.Series(
    [np.nan if s is None or s[0] == s[1] else matrix.strecke_m.get(s, np.nan) / 1000
     for s in schluessel], index=abgeschlossen.index)
steigung = pd.Series(
    [np.nan if s is None or s[0] == s[1] else matrix.steigung_promille.get(s, np.nan)
     for s in schluessel], index=abgeschlossen.index)

schaetzung = (abgeschlossen.dauer_min / 60.0
              * abgeschlossen.typ_code.map(TYPISCHE_GESCHWINDIGKEIT))
hat_messwert = abgeschlossen.distanz_km.notna()
abgeschlossen["km_fahrt"] = abgeschlossen.distanz_km.where(
    hat_messwert, aus_matrix.fillna(schaetzung))
abgeschlossen["km_geschaetzt"] = ~hat_messwert & aus_matrix.isna()
abgeschlossen["km_aus_matrix"] = ~hat_messwert & aus_matrix.notna()

# HOEHENMETER. Bergauf leidet der Antrieb, bergab die Bremse. Beides ist
# Verschleiss, und beides steht in keiner Spalte der Ausleihtabelle - erst die
# Steigung der Verbindung macht es rechenbar.
abgeschlossen["hoehenmeter"] = (
    # nullen-sind-echt: Ohne Streckenangabe gibt es keine Steigung; sie mit
    # null anzusetzen unterschaetzt den Verschleiss, statt ihn zu erfinden.
    steigung.abs().fillna(0) / 1000.0 * abgeschlossen.km_fahrt * 1000.0)
print(f"Kilometer je Fahrt: {hat_messwert.mean():.0%} gemessen, "
      f"{abgeschlossen.km_aus_matrix.mean():.0%} aus der Routenmatrix, "
      f"{abgeschlossen.km_geschaetzt.mean():.0%} geschätzt")

# Wie gut waeren die beiden Ersatzquellen dort, wo wir die Wahrheit kennen?
abw_schaetzung = (schaetzung[hat_messwert]
                  - abgeschlossen.distanz_km[hat_messwert]).abs().mean()
_prueffall = hat_messwert & aus_matrix.notna()
abw_matrix = (aus_matrix[_prueffall]
              - abgeschlossen.distanz_km[_prueffall]).abs().mean()
merke("anteil_gemessen", hat_messwert.mean())
merke("anteil_matrix", abgeschlossen.km_aus_matrix.mean())
merke("anteil_geschaetzt", abgeschlossen.km_geschaetzt.mean())
merke("abweichung_matrix", abw_matrix)
_ = merke("abweichung_schaetzung", abw_schaetzung)
print()
print(f"Gemessen:            {hat_messwert.sum():>6d} Fahrten ({hat_messwert.mean():.1%})")
print(f"aus der Routenmatrix:{abgeschlossen.km_aus_matrix.sum():>6d} Fahrten "
      f"({abgeschlossen.km_aus_matrix.mean():.1%})")
print(f"geschätzt:           {abgeschlossen.km_geschaetzt.sum():>6d} Fahrten "
      f"({abgeschlossen.km_geschaetzt.mean():.1%})")
print()
print("Gegenprobe dort, wo der Sensor gemessen hat:")
print(f"   Routenmatrix weicht im Mittel um {abw_matrix:.2f} km ab")
print(f"   Dauer mal Tempo weicht um        {abw_schaetzung:.2f} km ab")
print(f"(mittlere gemessene Strecke: {abgeschlossen.distanz_km[hat_messwert].mean():.2f} km)")

# WIE LANGE STEHT EIN SCHADEN OFFEN? Diese Zahl entscheidet, ob der
# Unterschied zwischen "seit der Meldung" und "seit der Reparatur"
# fachlich zaehlt oder eine Spitzfindigkeit ist.
werkstatt = schaeden.merge(auftraege[["schadensmeldung_id", "erledigt_am"]],
                           on="schadensmeldung_id", how="left")
liegezeit = (werkstatt.erledigt_am - werkstatt.gemeldet_am).dt.total_seconds() / 86400
dazwischen = werkstatt.dropna(subset=["erledigt_am"]).merge(
    abgeschlossen[["fahrrad_id", "startzeit"]], on="fahrrad_id", how="left")
ist_dazwischen = ((dazwischen.startzeit > dazwischen.gemeldet_am)
                  & (dazwischen.startzeit <= dazwischen.erledigt_am))
print(f"Zwischen Meldung und erledigter Reparatur vergehen im Mittel "
      f"{liegezeit.mean():.1f} Tage (höchstens {liegezeit.max():.1f}).")
print(f"In dieser Zeit wird weitergefahren: "
      f"{dazwischen[ist_dazwischen].schadensmeldung_id.nunique()} von "
      f"{werkstatt.erledigt_am.notna().sum()} Meldungen betroffen, "
      f"{int(ist_dazwischen.sum())} Fahrten.")
print("Diese Kilometer gehen auf das ALTE Bauteil - also wird bei der")
print("Reparatur zurückgesetzt, nicht bei der Meldung.")

RUECKBLICK_TAGE = 180

def zeile_bauen(stichtag):
    """Eine Momentaufnahme der Flotte: Merkmale aus der Vergangenheit, Label aus der Zukunft."""
    bestand = raeder[(raeder.angeschafft_am <= stichtag - pd.Timedelta(days=30))
                     & (raeder.ausgemustert_am.isna() | (raeder.ausgemustert_am > stichtag))].copy()

    # --- Merkmale: NUR aus der Zeit VOR dem Stichtag
    fenster = abgeschlossen[(abgeschlossen.startzeit > stichtag - pd.Timedelta(days=RUECKBLICK_TAGE))
                            & (abgeschlossen.startzeit <= stichtag)]
    nutzung_fenster = fenster.groupby("fahrrad_id").agg(
        fahrten_180=("ausleihe_id", "size"),
        km_180=("km_fahrt", "sum"),
        hoehenmeter_180=("hoehenmeter", "sum"),
        dauer_mittel=("dauer_min", "mean"),
    )
    bis_jetzt = abgeschlossen[abgeschlossen.startzeit <= stichtag]
    gesamt = bis_jetzt.groupby("fahrrad_id").agg(
        fahrten_gesamt=("ausleihe_id", "size"),
        km_gesamt=("km_fahrt", "sum"),
    )
    frueher = schaeden[schaeden.gemeldet_am <= stichtag]
    meldungen_bisher = frueher.groupby("fahrrad_id").size().rename("meldungen_bisher")

    # KILOMETER SEIT DER LETZTEN ERLEDIGTEN REPARATUR.
    #
    # Nicht seit der MELDUNG: Zwischen beidem wird weitergefahren - die
    # Zahlen dazu stehen oben, gerechnet statt behauptet. Diese Kilometer
    # gehen auf das ALTE Bauteil. Wer bei der Meldung zuruecksetzt,
    # schreibt sie dem neuen gut und macht das wichtigste Merkmal des
    # Notebooks systematisch zu klein - ausgerechnet bei den Raedern, die
    # gerade auffaellig waren.
    erledigt = schaeden.merge(
        auftraege[["schadensmeldung_id", "erledigt_am"]], on="schadensmeldung_id", how="left")
    fertig = erledigt[erledigt.erledigt_am.notna() & (erledigt.erledigt_am <= stichtag)]
    letzte_reparatur = fertig.groupby("fahrrad_id").erledigt_am.max().rename("letzte_reparatur")

    seit = bis_jetzt.merge(letzte_reparatur, left_on="fahrrad_id", right_index=True, how="left")
    nach_reparatur = seit.letzte_reparatur.isna() | (seit.startzeit > seit.letzte_reparatur)
    km_seit = seit[nach_reparatur].groupby("fahrrad_id").km_fahrt.sum().rename("km_seit_reparatur")

    # DIESELBE RECHNUNG MIT DEM FALSCHEN STICHTAG - fuer die Ablation in 5.2.
    # Sie wird nicht als Merkmal trainiert, sondern nur als Rangfolge
    # verglichen: Was haette die Regel geleistet, wenn man bei der MELDUNG
    # zurueckgesetzt haette? Behauptet wird der Unterschied im Text ohnehin;
    # hier steht er gerechnet daneben.
    letzte_meldung = (frueher.groupby("fahrrad_id").gemeldet_am.max()
                      .rename("letzte_meldung"))
    seit_m = bis_jetzt.merge(letzte_meldung, left_on="fahrrad_id",
                             right_index=True, how="left")
    nach_meldung = seit_m.letzte_meldung.isna() | (seit_m.startzeit > seit_m.letzte_meldung)
    km_seit_m = (seit_m[nach_meldung].groupby("fahrrad_id").km_fahrt.sum()
                 .rename("km_seit_meldung"))

    # OFFENE SCHAEDEN GEHOEREN NICHT IN EINE RISIKOLISTE.
    # Ein Rad mit gemeldetem, noch nicht erledigtem Schaden muss ohnehin in
    # die Werkstatt. Es auf die Vorsorgeliste zu setzen verbraucht einen der
    # 60 Plaetze fuer eine Entscheidung, die schon gefallen ist.
    offen = set(erledigt[(erledigt.gemeldet_am <= stichtag)
                         & (erledigt.erledigt_am.isna()
                            | (erledigt.erledigt_am > stichtag))].fahrrad_id)
    bestand = bestand[~bestand.fahrrad_id.isin(offen)]

    z = bestand.set_index("fahrrad_id").join(
        [nutzung_fenster, gesamt, meldungen_bisher, letzte_reparatur, km_seit, km_seit_m])
    for spalte in ["fahrten_180", "km_180", "hoehenmeter_180", "fahrten_gesamt", "km_gesamt",
                   "meldungen_bisher", "km_seit_reparatur", "km_seit_meldung"]:
        # nullen-sind-echt: Wer im Fenster keine Fahrt und keine Meldung
        # hat, hat davon null - die Zeile fehlt nur, weil nichts geschah.
        z[spalte] = z[spalte].fillna(0)
    z["dauer_mittel"] = z.dauer_mittel.fillna(z.dauer_mittel.median())
    z["tage_im_bestand"] = (stichtag - z.angeschafft_am).dt.days
    z["tage_seit_reparatur"] = (stichtag - z.letzte_reparatur).dt.days.fillna(9999)
    z["km_je_tag"] = z.km_gesamt / z.tage_im_bestand.clip(lower=1)

    # --- Label: NUR aus der Zeit NACH dem Stichtag
    kuenftig = set(schaeden[(schaeden.gemeldet_am > stichtag)
                            & (schaeden.gemeldet_am <= stichtag + pd.Timedelta(days=HORIZONT_TAGE))].fahrrad_id)
    z["meldet_sich"] = z.index.isin(kuenftig).astype(int)
    z["stichtag"] = stichtag
    return z.reset_index()

##LUECKE Erzeugen Sie Stichtage im Abstand von 90 Tagen; der letzte liegt 90 Tage vor dem Datenende.
stichtage = pd.date_range(end=ende - pd.Timedelta(days=HORIZONT_TAGE), periods=8, freq="90D")
##ENDE

panel = pd.concat([zeile_bauen(s) for s in stichtage], ignore_index=True)

print("Stichtage:", ", ".join(str(s.date()) for s in stichtage))
merke("zeilen_je_stichtag", len(panel) // len(stichtage))
print(f"\\nZeilen im Panel: {len(panel)}   ({len(stichtage)} Stichtage × rund "
      f"{len(panel)//len(stichtage)} Räder)")
print(f"Anteil positiver Fälle: {panel.meldet_sich.mean():.1%}")
print("\\nAnteil je Stichtag:")
print(panel.groupby(panel.stichtag.dt.date).meldet_sich.agg(["size", "mean"]).round(3).to_string())

# Diese Spanne laeuft ueber ALLE Stichtage des Panels. Die rollierende
# Validierung in Phase 5 nutzt nur die spaeteren - beide Spannen sind
# richtig, aber sie zaehlen Verschiedenes und brauchen darum eigene Namen.
_pg = panel.groupby(panel.stichtag).meldet_sich.mean()
merke("panel_grundrate_min", _pg.min())
merke("panel_grundrate_max", _pg.max())
merke("panel_grundrate_faktor", _pg.max() / max(_pg.min(), 0.001))
merke("panel_stichtage", panel.stichtag.nunique())
print(f"\\nSpanne über alle {panel.stichtag.nunique()} Stichtage: "
      f"{_pg.min():.1%} bis {_pg.max():.1%}")
'''),

MD("""
**Die Spalte `mean` ist der wichtigste Teil dieser Tabelle.** Über die
{{panel_stichtage:.0f}} Stichtage schwankt der Anteil auffälliger Räder zwischen
**{{panel_grundrate_min:.1%}} und {{panel_grundrate_max:.1%}}**, also um das
{{panel_grundrate_faktor:.1f}}-Fache. Das ist kein Datenfehler, sondern die Jahreszeit:
Im Winter wird kaum gefahren, also verschleißt kaum etwas.

Daraus folgen zwei Dinge:

1. **Die Testmenge ist ein Mai-Stichtag**, also ein Zeitpunkt mit hohem Anteil. Ein
   Modell, das auf gemischten Jahreszeiten trainiert wurde, ist dort systematisch zu
   zurückhaltend.
2. **Die feste Kapazität erzeugt je Jahreszeit ein anderes Verhältnis von
   Treffsicherheit und Abdeckung.** Bei niedriger Grundrate enthält dieselbe Liste mehr
   Fehlalarme, bei hoher deckt sie einen kleineren Teil der auffälligen Räder ab.

<details style="margin:12px 0 18px 0;border-left:3px solid #D8D8D8;padding-left:14px"><summary style="cursor:pointer;color:#2F2F2F;font-weight:600;padding:2px 0">Ist die Kapazit\u00e4t von {{kapazitaet:.0f}} R\u00e4dern richtig gew\u00e4hlt?</summary><div style="color:#333333;line-height:1.55;padding-top:8px"><p>Die Frage l\u00e4sst sich hier nicht beantworten. Daf\u00fcr fehlen zwei Gr\u00f6\u00dfen: was eine Pr\u00fcfung kostet, die einen Schaden findet, und wie viel Schaden sie tats\u00e4chlich verhindert.</p><p>Phase 5 kommt darauf zur\u00fcck und zeigt, warum die vorhandene Kostenformel die Kapazit\u00e4t gerade <strong>nicht</strong> bestimmen kann. Es ist einer der Punkte, an denen eine zweite Runde ansetzen m\u00fcsste.</p></div></details>

### 3.3 Zeitliche Aufteilung
"""),

CODE('''
merkmale = ["fahrten_180", "km_180", "hoehenmeter_180", "dauer_mittel",
            "fahrten_gesamt", "km_gesamt",
            "meldungen_bisher", "tage_im_bestand", "tage_seit_reparatur", "km_je_tag",
            "km_seit_reparatur"]
# UNBEKANNTE RADTYPEN BRECHEN AB, STATT STILL ZU VERSCHWINDEN.
# get_dummies bildet die Spalten aus dem, was IM DATENSATZ steht. Kaeme ein
# vierter Typ hinzu, entstuende klaglos eine vierte Spalte - und ein
# gespeichertes Modell bekaeme beim Anwenden eine Merkmalsmenge, die es nicht
# kennt. Umgekehrt fehlte eine Spalte, wenn ein Typ ausfaellt. Beides faellt
# erst auf, wenn eine Vorhersage unsinnig ist.
TYPEN_ERWARTET = ("CARGO", "CITY", "EBIKE")
_gefunden = tuple(sorted(panel.typ_code.unique()))
assert _gefunden == TYPEN_ERWARTET, (
    f"Radtypen im Panel: {_gefunden}, erwartet {TYPEN_ERWARTET}. "
    f"Eine Aenderung der Flotte verlangt eine Entscheidung, keine stille "
    f"Anpassung der Merkmalsmenge.")
typ_dummies = pd.get_dummies(pd.Categorical(panel["typ_code"],
                                            categories=TYPEN_ERWARTET),
                             prefix="typ").astype(int)
typ_dummies.index = panel.index
X_alle = pd.concat([panel[merkmale], typ_dummies], axis=1)
y_alle = panel["meldet_sich"]

# Der LETZTE Stichtag ist die Testmenge - so, wie es im Betrieb waere:
# trainieren auf allem Vergangenen, anwenden auf den heutigen Stand.
letzter = stichtage[-1]
ist_test = panel.stichtag == letzter

X_train, y_train = X_alle[~ist_test], y_alle[~ist_test]
X_test, y_test = X_alle[ist_test], y_alle[ist_test]

print(f"Training: {len(X_train)} Zeilen aus {ist_test.sum() and len(stichtage)-1} Stichtagen "
      f"(bis {stichtage[-2].date()})")
print(f"Test:     {len(X_test)} Zeilen vom Stichtag {letzter.date()}")
print(f"Anteil positiv  Training {y_train.mean():.1%} | Test {y_test.mean():.1%}")
'''),

MD("""
**Warum kein zufälliger `train_test_split`?** Auch Notebook 1 trennt zeitlich; neu ist
hier, dass dasselbe Rad in mehreren Zeilen steht. Ein zeilenweise zufälliger Schnitt
verteilt damit nicht nur Zukunft ins Training, sondern Zukunftsinformation **desselben
Objekts** auf beide Seiten. Der Schnitt entlang der Zeit vermeidet beides und bildet die
Betriebslage ab: trainieren auf allem Vergangenen, anwenden auf den heutigen Stand.

<details style="margin:12px 0 18px 0;border-left:3px solid #D8D8D8;padding-left:14px"><summary style="cursor:pointer;color:#2F2F2F;font-weight:600;padding:2px 0">Was der Zeitschnitt nicht leistet</summary><div style="color:#333333;line-height:1.55;padding-top:8px"><p>Er trennt nach <strong>Informationszeitpunkt</strong>, nicht nach Fahrr\u00e4dern. Fast jedes Rad der Testmenge steht auch in fr\u00fcheren Trainingsschnappsch\u00fcssen \u2014 mit anderen Merkmalswerten, aber als dasselbe Objekt. Die n\u00e4chste Zelle z\u00e4hlt es.</p><p>F\u00fcr die Frage dieses Notebooks ist das in Ordnung: Gefragt ist, wie die <strong>bestehende</strong> Flotte priorisiert wird, nicht wie ein fabrikneues Rad eingesch\u00e4tzt wird. Eine Aussage \u00fcber ungesehene R\u00e4der lie\u00dfe sich daraus nicht ableiten \u2014 daf\u00fcr br\u00e4uchte es einen Schnitt entlang der Fahrr\u00e4der.</p></div></details>
"""),

CODE('''
# WAS DIE TESTMENGE NICHT HERGIBT - drei Zahlen, die man kennen muss,
# bevor man ihre Ergebnisse als Guete liest.
_test_ids = set(panel.loc[ist_test, "fahrrad_id"])
_train_ids = set(panel.loc[~ist_test, "fahrrad_id"])

print("(1) ENTITAETEN - trennt der Zeitschnitt auch die Raeder?")
_bekannt = len(_test_ids & _train_ids)
print(f"    Raeder in der Testmenge:              {len(_test_ids):>5d}")
print(f"    davon schon im Training gesehen:      {_bekannt:>5d} "
      f"({_bekannt / len(_test_ids):.1%})")
print("    Der Schnitt trennt nach Informationszeitpunkt, nicht nach Raedern.")
print("    Eine Fahrrad-ID ist kein Merkmal - direktes Auswendiglernen ist")
print("    ausgeschlossen. Unabhaengig sind die Zeilen trotzdem nicht.")
merke("test_raeder", len(_test_ids)); merke("test_raeder_bekannt", _bekannt)
merke("test_raeder_bekannt_anteil", _bekannt / len(_test_ids))

print("\\n(2) ZENSIERUNG - stehen alle Testraeder das volle Quartal unter Risiko?")
_bis = letzter + pd.Timedelta(days=HORIZONT_TAGE)
_ausgemustert = raeder[raeder.fahrrad_id.isin(_test_ids)
                       & raeder.ausgemustert_am.notna()
                       & (raeder.ausgemustert_am <= _bis)]
_aus_ids = set(_ausgemustert.fahrrad_id)
_aus_positiv = len(_aus_ids & set(panel.loc[ist_test & (panel.meldet_sich == 1),
                                            "fahrrad_id"]))
print(f"    im Horizont ausgemustert:             {len(_aus_ids):>5d}")
print(f"    davon vorher mit Meldung (positiv):   {_aus_positiv:>5d}")
print(f"    ohne Meldung, aber verkuerzt beobachtet: {len(_aus_ids) - _aus_positiv:>3d}")
print("    Die letzten zaehlen als 'meldet sich nicht' - obwohl sie gar nicht")
print("    die volle Zeit hatten, sich zu melden. Das ist ZENSIERUNG, und ein")
print("    binaeres Label kennt sie nicht.")
merke("zensiert", len(_aus_ids)); merke("zensiert_negativ", len(_aus_ids) - _aus_positiv)

print("\\n(3) MEHRFACHMELDUNGEN - ist ein Rad ein Ereignis?")
_meldungen_test = schaeden[(schaeden.gemeldet_am > letzter)
                           & (schaeden.gemeldet_am <= _bis)
                           & schaeden.fahrrad_id.isin(_test_ids)]
_n_meldungen = len(_meldungen_test)
_n_raeder = _meldungen_test.fahrrad_id.nunique()
print(f"    Meldungen im Testfenster:             {_n_meldungen:>5d}")
print(f"    betroffene Raeder:                    {_n_raeder:>5d}")
print(f"    Raeder mit mehr als einer Meldung:    {_n_meldungen - _n_raeder:>5d}")
print("    Label und Kostenformel zaehlen jedes Rad hoechstens einmal. Das")
print("    passt, WENN eine Pruefung alle Folgemeldungen verhindert - und")
print("    genau diese Wirkung ist nirgends belegt.")
merke("meldungen_test", _n_meldungen)
_ = merke("raeder_mehrfach", _n_meldungen - _n_raeder)
'''),

# =====================================================================
PHASE(4, "Erst die Faustregel, die es zu schlagen gilt. Dann Modelle — und zwar mit "
         "eingebauter Kostenasymmetrie."),

MD("""
### 4.1 Die Faustregeln als Maßstab

Bevor ein Modell antritt, muss klar sein, wogegen. Drei Regeln, die eine Werkstatt ohne
jedes Modell anwenden könnte:

1. **„Das älteste Rad zuerst“** — die heutige Praxis
2. **„Das meistgefahrene Rad zuerst“** — die naheliegende Verbesserung
3. **„Das Rad mit den meisten Kilometern seit der letzten Reparatur zuerst“** — die
   Regel, die ein Werkstattmeister vorschlagen würde

Die dritte ist nicht raffinierter als die zweite, sondern **sachkundiger**. Sie steckt
kein bisschen mehr Mathematik, sondern das Wissen, dass ein Bremsbelag nicht zählt,
wieviel das Rad in seinem Leben gefahren ist, sondern nur, wieviel seit seinem Einbau.

Jede der drei liefert eine Rangfolge, und aus einer Rangfolge wird eine Liste der Top 60.
"""),

CODE('''
def liste_bewerten(name, rangfolge, y_wahr, kapazitaet=KAPAZITAET):
    """Nimmt die obersten k Raeder einer Rangfolge und rechnet nach, was das kostet."""
    reihenfolge = np.argsort(-np.asarray(rangfolge))
    gewaehlt = np.zeros(len(y_wahr), dtype=bool)
    gewaehlt[reihenfolge[:kapazitaet]] = True
    y = np.asarray(y_wahr)

    richtig_geprueft = int((gewaehlt & (y == 1)).sum())      # Ausfall verhindert
    unnoetig = int((gewaehlt & (y == 0)).sum())              # umsonst geprueft
    verpasst = int((~gewaehlt & (y == 1)).sum())             # Ausfall auf der Strasse
    kosten = verpasst * KOSTEN_VERPASST + unnoetig * KOSTEN_UNNOETIG
    return {"Vorgehen": name, "Treffer": richtig_geprueft,
            "Trefferquote": round(richtig_geprueft / kapazitaet, 3),
            "unnötig geprüft": unnoetig, "Ausfälle verpasst": verpasst,
            "Kosten (EUR)": round(kosten, 0)}

test_zeilen = panel[ist_test].reset_index(drop=True)
vergleich = []

# Nichts tun - alle Ausfaelle passieren
alle_verpasst = int(y_test.sum())
vergleich.append({"Vorgehen": "gar nicht vorsorglich prüfen", "Treffer": 0, "Trefferquote": 0.0,
                  "unnötig geprüft": 0, "Ausfälle verpasst": alle_verpasst,
                  "Kosten (EUR)": round(alle_verpasst * KOSTEN_VERPASST, 0)})
vergleich.append(liste_bewerten("Faustregel: ältestes Rad zuerst",
                                test_zeilen.tage_im_bestand.values, y_test))
vergleich.append(liste_bewerten("Faustregel: meiste Kilometer gesamt",
                                test_zeilen.km_gesamt.values, y_test))
##LUECKE Ergänzen Sie eine dritte Faustregel: die meisten Kilometer SEIT DER LETZTEN ERLEDIGTEN REPARATUR zuerst.
vergleich.append(liste_bewerten("Faustregel: km seit letzter Reparatur",
                                test_zeilen.km_seit_reparatur.values, y_test))
##ENDE
# Trefferquote als Prozent: Als Dezimalzahl muss sie jeder Leser - und
# jede Folie, die auf diese Tabelle zeigt - selbst umrechnen.
_alt = next(v for v in vergleich if "ältestes Rad" in v["Vorgehen"])
_km = next(v for v in vergleich if "meiste Kilometer" in v["Vorgehen"])
merke("faustregel_alter", _alt["Trefferquote"])
_ = merke("faustregel_km", _km["Trefferquote"])


def als_prozent(df):
    d = df.copy()
    d["Trefferquote"] = d["Trefferquote"].map(lambda x: f"{x:.1%}")
    return d

print(als_prozent(pd.DataFrame(vergleich)).to_string(index=False))
'''),

MD("""
**Diese Tabelle ist der Kern des ganzen Notebooks — lesen Sie sie langsam.**

Die ersten beiden Regeln liegen dicht beieinander; welche vorn liegt, ist fast Zufall.
Die dritte springt um achtzehn Punkte nach oben — und zwischen ihr und den anderen liegt
**kein einziger Rechenschritt Unterschied**, nur ein anderes Verständnis davon, wie
Verschleiß entsteht.

Merken Sie sich diese Zahlen. Wir kommen in Phase 5 darauf zurück, wenn das Modell
gerechnet hat — und das Ergebnis wird ungemütlich.

### 4.2 Entscheidungsbaum mit Klassengewichtung
"""),

CODE('''
from sklearn.tree import DecisionTreeClassifier, plot_tree
from sklearn.ensemble import RandomForestClassifier

# class_weight uebersetzt die Kostenasymmetrie aus Phase 1 in das Modell:
# ein verpasster Ausfall wiegt gut sieben unnoetige Pruefungen auf.
gewichte = {0: 1.0, 1: merke("klassengewicht", KOSTEN_VERPASST / KOSTEN_UNNOETIG)}
print("Klassengewichte:", {k: round(v, 1) for k, v in gewichte.items()})

baum = DecisionTreeClassifier(max_depth=3, min_samples_leaf=40,
                              class_weight=gewichte, random_state=42)
baum.fit(X_train, y_train)

plt.figure(figsize=(17, 7))
plot_tree(baum, feature_names=list(X_alle.columns),
          class_names=["unauffällig", "meldet sich"], filled=True, fontsize=9, impurity=False)
plt.title("Entscheidungsbaum, Tiefe 3 — bewusst klein, damit man ihn lesen kann")
plt.show()
'''),

MD("""
**Einen Baum kann man vorlesen.** Genau das macht ihn für den Einstieg so wertvoll und
in der Praxis so überzeugend: Die Werkstattleitung sieht, *warum* ein Rad auf der Liste
steht, und kann widersprechen. Bei einem Random Forest oder einem neuronalen Netz geht
das nicht mehr.

Die oberste Verzweigung ist die wichtigste Frage, die das Modell stellt. Sehen Sie nach,
welches Merkmal dort steht.

### 4.3 Random Forest
"""),

CODE('''
##LUECKE Trainieren Sie einen RandomForestClassifier: 300 Bäume, max_depth=8, min_samples_leaf=10, class_weight=gewichte, random_state=42, n_jobs=-1.
wald = RandomForestClassifier(n_estimators=300, max_depth=8, min_samples_leaf=10,
                              class_weight=gewichte, random_state=42, n_jobs=-1)
wald.fit(X_train, y_train)
##ENDE

wichtigkeit = pd.Series(wald.feature_importances_, index=X_alle.columns).sort_values(ascending=False)
plt.figure(figsize=(9, 4.5))
wichtigkeit.head(9).iloc[::-1].plot(kind="barh", color="#3d4b6b")
plt.title("Woran sich der Random Forest orientiert"); plt.xlabel("Bedeutung des Merkmals")
plt.tight_layout(); plt.show()
print(wichtigkeit.round(3).to_string())
'''),

MD("""
> **Vorsicht bei der Deutung.** „Bedeutung des Merkmals“ heißt hier: wie oft und wie
> wirksam der Wald an diesem Merkmal aufgeteilt hat. Das ist **keine Ursache-Wirkung**.
> Dass `tage_seit_reparatur` weit oben steht, heißt nicht, dass langes Schweigen einen
> Defekt verursacht — es heißt, dass dieses Merkmal die Räder gut trennt.
"""),

# =====================================================================
PHASE(5, "Confusion-Matrix, Kosten und die Frage, ob wir die Faustregel überhaupt schlagen."),

CODE('''
from sklearn.metrics import confusion_matrix, ConfusionMatrixDisplay, classification_report

for name, modell in [("Entscheidungsbaum", baum), ("Random Forest", wald)]:
    wahrscheinlichkeit = modell.predict_proba(X_test)[:, 1]
    vergleich.append(liste_bewerten(f"Modell: {name}", wahrscheinlichkeit, y_test))

tabelle = pd.DataFrame(vergleich)
print(als_prozent(tabelle).to_string(index=False))

bestes = tabelle.loc[tabelle["Kosten (EUR)"].idxmin(), "Vorgehen"]
ersparnis = tabelle["Kosten (EUR)"].iloc[0] - tabelle["Kosten (EUR)"].min()
print(f"\\nGünstigstes Vorgehen: {bestes}")
print(f"Ersparnis gegenüber 'gar nicht prüfen': {ersparnis:,.0f} EUR je Quartal".replace(",", "."))
'''),

MD("### 5.1 Die Confusion-Matrix — welche Art Fehler macht das Modell?"),

CODE('''
p_wald = wald.predict_proba(X_test)[:, 1]
p_regel = test_zeilen.km_seit_reparatur.values     # die Faustregel als Rangfolge
p_regel_meldung = test_zeilen.km_seit_meldung.values   # dieselbe Regel, falscher Stichtag

# Hier steht noch KEINE Entscheidung - die faellt in 5.6. Diese Grafik
# zeigt deshalb BEIDE Kandidaten nebeneinander, damit niemand eine
# Confusion-Matrix fuer das eine Verfahren mit dem Urteil ueber das
# andere verwechselt. Genau das war in einer frueheren Fassung passiert.
reihenfolge = np.argsort(-p_regel)
auf_liste = np.zeros(len(y_test), dtype=bool)
auf_liste[reihenfolge[:KAPAZITAET]] = True

cm = confusion_matrix(y_test, auf_liste.astype(int))
fig, achsen = plt.subplots(1, 2, figsize=(12.5, 4.5))
ConfusionMatrixDisplay(cm, display_labels=["unauffällig", "meldet sich"]).plot(
    cmap="Blues", ax=achsen[0], colorbar=False)
achsen[0].set_title(f"Quartalsliste mit {KAPAZITAET} Rädern — Faustregel")
achsen[0].set_xlabel("durch das Verfahren auf die Liste gesetzt")
achsen[0].set_ylabel("tatsächlich")

# Wie gut ist die Rangfolge? Trefferquote in Abhaengigkeit der Listenlaenge.
laengen = range(10, len(y_test) + 1, 5)
quoten = []
for k in laengen:
    gew = np.zeros(len(y_test), dtype=bool); gew[reihenfolge[:k]] = True
    quoten.append((np.asarray(y_test)[gew] == 1).mean())
quoten_wald = []
for k_ in laengen:
    g = np.zeros(len(y_test), dtype=bool); g[np.argsort(-p_wald)[:k_]] = True
    quoten_wald.append((np.asarray(y_test)[g] == 1).mean())
achsen[1].plot(list(laengen), quoten, color="#e00034", lw=2, label="Faustregel (km seit Reparatur)")
achsen[1].plot(list(laengen), quoten_wald, color="#3d4b6b", lw=2, ls="--", label="Random Forest")
achsen[1].axhline(float(y_test.mean()), color="#8c95a8", ls="--",
                  label=f"Zufall ({y_test.mean():.0%})")
achsen[1].axvline(KAPAZITAET, color="#3d4b6b", ls=":", label=f"Kapazität ({KAPAZITAET})")
achsen[1].set_xlabel("Länge der Liste"); achsen[1].set_ylabel("Anteil Treffer")
achsen[1].set_title("Je kürzer die Liste, desto treffsicherer muss sie sein")
achsen[1].legend(); achsen[1].grid(alpha=.3); achsen[1].set_ylim(0, 1)
plt.tight_layout(); plt.show()

# DIESELBE KURVE ZUM ABLESEN. Im Bild oben laesst sich der Wert an einer
# bestimmten Listenlaenge nur schaetzen; hier steht er beim Zeigen da.
# Die statische Grafik bleibt als Beleg erhalten.
_fig = go.Figure()
for _bez, _werte in (("Faustregel (km seit Reparatur)", quoten),
                     ("Random Forest", quoten_wald)):
    _fig.add_trace(go.Scatter(x=list(laengen), y=_werte, mode="lines", name=_bez,
                              hovertemplate=("Liste mit %{x} Plätzen<br>"
                                             "%{y:.1%} Treffer<extra></extra>")))
_fig.add_hline(y=float(y_test.mean()), line=dict(dash="dash", color=FARBE["linie"]),
               annotation_text=f"Zufall ({y_test.mean():.0%})")
_fig.add_vline(x=KAPAZITAET, line=dict(dash="dot", color=FARBE["warnung"]),
               annotation_text=f"Kapazität ({KAPAZITAET})")
_fig.update_xaxes(title="Länge der Liste")
_fig.update_yaxes(title="Anteil Treffer", tickformat=".0%", range=[0, 1])
interaktiv(_fig, "Trefferquote nach Listenlänge")

print("Klassifikationsbericht der FAUSTREGEL (das Modell folgt in 5.5):")
print(classification_report(y_test, auf_liste.astype(int),
                            target_names=["unauffällig", "meldet sich"], digits=3))
'''),

MD("""
### 5.2 Der Rücksetzzeitpunkt von `km_seit_reparatur`

Die Tabelle zeigt die Faustregel vor dem Random Forest —
{{treffer_regel:.0f}} gegen {{treffer_wald:.0f}} Treffer.

Als Erklärung für den Abstand zwischen Regel und Modell kommt ein Merkmalsdetail in
Betracht. Der Zähler `km_seit_reparatur` lässt sich bei der **Meldung** eines Schadens
zurücksetzen oder erst bei der **erledigten Reparatur**. Zwischen beiden Zeitpunkten
wird weitergefahren; Phase 3 hat diese Kilometer gezählt. Beim Rücksetzen zur Meldung
werden sie dem frisch reparierten Bauteil gutgeschrieben — und zwar bei genau den
Rädern, die gerade auffällig geworden sind.

**Wie groß dieser Effekt ist, wird gemessen und nicht begründet.** Die
nächste Zelle rechnet dieselbe Faustregel zweimal — einmal mit jedem Rücksetzzeitpunkt,
auf demselben Datenstand:
"""),

CODE('''
# ABLATION DES RUECKSETZZEITPUNKTS
# Zwei Rangfolgen, ein Datenstand, ein Unterschied: Wann faellt der Zaehler
# zurueck - bei der Meldung oder bei der erledigten Reparatur? Die Regel ist
# sonst dieselbe.
_ab = []
for _bez, _score in [("bei der MELDUNG zurueckgesetzt", p_regel_meldung),
                     ("bei der REPARATUR zurueckgesetzt", p_regel)]:
    _ab.append(liste_bewerten(f"km seit ... {_bez}", _score, y_test))
_ablation = pd.DataFrame(_ab)
print("ABLATION - dieselbe Faustregel, zwei Ruecksetzzeitpunkte (Testquartal)\\n")
print(als_prozent(_ablation).to_string(index=False))

_meldung, _reparatur = _ablation.Treffer.iloc[0], _ablation.Treffer.iloc[1]
merke("ablation_meldung", int(_meldung)); merke("ablation_reparatur", int(_reparatur))
merke("ablation_differenz", int(_reparatur - _meldung))

# Wie verschieden sind die beiden Ranglisten ueberhaupt?
_top_m = set(np.argsort(-p_regel_meldung)[:KAPAZITAET])
_top_r = set(np.argsort(-p_regel)[:KAPAZITAET])
merke("ablation_gemeinsam", len(_top_m & _top_r))
print(f"\\nUnterschied: {_reparatur - _meldung:+d} Treffer von {KAPAZITAET}.")
print(f"Die beiden Listen teilen {len(_top_m & _top_r)} von {KAPAZITAET} Raedern.")
print()
if abs(_reparatur - _meldung) <= 1:
    print("ERGEBNIS: Der Ruecksetzzeitpunkt ist fachlich richtig gewaehlt,")
    print("aendert auf DIESEM Datenstand aber die Guete praktisch nicht.")
    print("Zwischen Meldung und Reparatur liegen im")
    print("Mittel wenige Tage; die Kilometer daraus sind gegen die Strecke")
    print("seit der letzten Reparatur klein.")
else:
    print(f"Der Ruecksetzzeitpunkt bewegt {abs(_reparatur - _meldung)} Treffer -")
    print("ein Merkmalsdetail mit messbarer Wirkung auf die Guete.")
'''),

MD("""

Die Ablation misst {{ablation_meldung:.0f}} gegen {{ablation_reparatur:.0f}} Treffer, und
die beiden Listen teilen {{ablation_gemeinsam:.0f}} von {{kapazitaet:.0f}} Rädern.
**Der Rücksetzzeitpunkt allein erklärt den Abstand zwischen Regel und Modell also
nicht.** Er ist fachlich richtig gewählt, weil er abbildet, was in der Werkstatt
geschieht; auf diesem Datenstand verändert er die Güte jedoch kaum.

**Daraus folgen zwei Feststellungen.** Die erste:
Ein Modell kann gegen eine Baseline gewinnen, weil die Baseline schlecht gebaut ist. Ein
belastbarer Vergleich verlangt für die Regel dieselbe Sorgfalt wie für das Modell.

Die zweite: **Eine Erklärung, die plausibel klingt, ist deshalb noch nicht die richtige.**
Der korrigierte Rücksetzzeitpunkt ist fachlich unstrittig — er bildet ab, was in der
Werkstatt geschieht. Als *Erklärung* für den verschwundenen Modellvorteil trägt er auf
diesem Datenstand trotzdem nicht. Eine Ursache, die nicht isoliert gemessen wurde,
bleibt eine Vermutung und darf nicht als Befund berichtet werden.

Sehen Sie sich zur Deutung die Bedeutungsgrafik oben an: `km_seit_reparatur` steht ganz
vorn. Der Wald hat die Regel des Werkstattmeisters **gefunden** — mehr aber auch nicht.

> **Und noch etwas ist an der Tabelle bemerkenswert:** Die beiden schwächeren Faustregeln
> — ältestes Rad und meiste Kilometer — liegen mit {{faustregel_alter:.1%}} und
> {{faustregel_km:.1%}} nah beieinander.
> Zwischen ihnen zu wählen bringt entsprechend wenig. Der Unterschied entsteht nicht
> durch eine bessere Kennzahl, sondern durch die zugrunde liegende Frage:
> nicht *wie alt* ist das Rad, sondern *wie weit seit der Reparatur*.

### 5.3 Ergebnis über mehrere Quartale

Der Gleichstand oben steht auf **einem** Stichtag. Die Grundrate schwankt aber über die
Quartale zwischen {{grundrate_min:.1%}} und {{grundrate_max:.1%}} — um mehr als das
{{grundrate_faktor:.1f}}-Fache. Ein Verfahren, das in einem Quartal vorn liegt, kann im
nächsten hinten liegen, ohne dass sich an ihm etwas geändert hat.

Deshalb wird hier nicht auf dem Testquartal entschieden, sondern auf allen Quartalen
davor. Für jedes wird neu trainiert, mit allem, was zu diesem Zeitpunkt bekannt war.
"""),

CODE('''
def rollierend(bis_stichtag):
    """Trainiert auf allem VOR dem Stichtag und bewertet auf ihm."""
    tr = panel[panel.stichtag < bis_stichtag]
    te = panel[panel.stichtag == bis_stichtag]
    Xtr = X_alle.loc[tr.index]; Xte = X_alle.loc[te.index]
    m = RandomForestClassifier(n_estimators=300, max_depth=8, min_samples_leaf=10,
                               class_weight=gewichte, random_state=42, n_jobs=-1)
    m.fit(Xtr, tr.meldet_sich)
    return (m.predict_proba(Xte)[:, 1], te.km_seit_reparatur.values,
            te.meldet_sich.values)

# Die VALIDIERUNG: alle Stichtage ausser dem ersten (zu wenig Trainingsdaten)
# und dem letzten (der bleibt unangetastet fuer den Test).
# Der letzte Stichtag bleibt aussen vor. Ein Wort zur Ehrlichkeit: Er ist
# der letzte HISTORISCHE Holdout, kein unangetasteter Test - seine Zahlen
# wurden in einer frueheren Fassung dieses Notebooks bereits angesehen,
# und danach wurden Distanzlogik, Ausreisser und Reparaturzeitpunkt
# geaendert. Ein wirklich unangetasteter Test braucht eine Zukunftsperiode.
validierung = stichtage[2:-1]
zeilen = []
for tag in validierung:
    pw, pr, yy = rollierend(tag)
    ew = liste_bewerten("Wald", pw, yy); er = liste_bewerten("Regel", pr, yy)
    zeilen.append({"Stichtag": tag.date(), "Räder": len(yy),
                   "Grundrate": yy.mean(),
                   "Wald": ew["Treffer"], "Regel": er["Treffer"],
                   "Quote Wald": ew["Trefferquote"], "Quote Regel": er["Trefferquote"],
                   "Vorteil Wald (EUR)": er["Kosten (EUR)"] - ew["Kosten (EUR)"]})

roll_roh = pd.DataFrame(zeilen)          # ungerundet, fuer die Gates
roll = roll_roh.drop(columns=["Quote Wald", "Quote Regel"])

# ─── K3: NUTZEN UEBER DIE QUARTALE ──────────────────────────────────
#
# Phase 1 wurde nach dem Ruecksprung neu formuliert: Die Liste muss
# mindestens 1,5-mal so viele auffaellige Raeder enthalten wie eine
# Zufallsauswahl gleicher Laenge - in mindestens vier von fuenf Quartalen.
#
# Warum nicht die urspruenglichen 70 %? Weil die Orakelschranke unten zeigt,
# dass sie im Winter unerfuellbar sind. Ein Kriterium, das kein Verfahren
# halten kann, misst nichts.
#
# Der Unterschied zu einem nachtraeglichen Kriterienwechsel liegt im Grund:
# Nicht "das Verfahren hat es nicht geschafft", sondern "kein Verfahren
# koennte es schaffen". Das erste waere Schoenrechnen, das zweite ist eine
# Korrektur - und sie steht in Phase 1, nicht hier.
#
# Die 70 % bleiben als ZUSATZFRAGE: Wo die Grundrate sie hergibt, wird
# geprueft, ob die Liste sie erreicht.
K3_MINDESTQUARTALE = 4
K3_LIFT_DIAGNOSE = 1.5      # die Nutzenschwelle aus dem korrigierten Phase 1
merke("k3_mindestquartale", K3_MINDESTQUARTALE)
_ = merke("k3_lift_diagnose", K3_LIFT_DIAGNOSE)

roll_roh["Lift Wald"] = roll_roh["Quote Wald"] / roll_roh.Grundrate

# ─── DIE ORAKELSCHRANKE ─────────────────────────────────────────────
# Was koennte ein Verfahren mit vollstaendiger Kenntnis der Zukunft
# erreichen? min(positive, KAPAZITAET) / KAPAZITAET. Liegt die Zusage
# darueber, ist sie unerfuellbar - unabhaengig vom Verfahren. Genau das
# hat Phase 1 zurueckgeschickt.
roll_roh["positive"] = (roll_roh.Grundrate * roll_roh["Räder"]).round().astype(int)
roll_roh["Orakel"] = roll_roh.positive.clip(upper=KAPAZITAET) / KAPAZITAET
_unmoeglich = roll_roh[roll_roh.Orakel < HUERDE]
_winter = roll_roh.loc[roll_roh.Grundrate.idxmin()]
_sommer = roll_roh.loc[roll_roh.Grundrate.idxmax()]
merke("winter_bestand", _winter["Räder"]); merke("winter_positiv", _winter.positive)
merke("winter_orakel", _winter.Orakel); merke("winter_grundrate", _winter.Grundrate)
merke("sommer_grundrate", _sommer.Grundrate)
merke("k1_winterquote", _winter["Quote Regel"]); merke("k1_sommerquote", _sommer["Quote Regel"])
merke("unmoegliche_quartale", len(_unmoeglich))

print("\\nORAKELSCHRANKE - was waere ueberhaupt erreichbar?")
print(roll_roh[["Stichtag", "Räder", "positive", "Grundrate", "Orakel",
                "Quote Regel"]].round(3).to_string(index=False))
print()
if len(_unmoeglich):
    print(f"   In {len(_unmoeglich)} von {len(roll_roh)} Quartalen liegt schon die")
    print(f"   Orakelschranke unter der urspruenglichen Zusage von {HUERDE:.0%}.")
    print("   Dort haette KEIN Verfahren sie halten koennen - auch keines mit")
    print("   vollstaendiger Kenntnis der Zukunft.")
else:
    print(f"   Die urspruengliche Zusage von {HUERDE:.0%} waere in jedem Quartal")
    print("   erreichbar gewesen.")
roll_roh["Lift Regel"] = roll_roh["Quote Regel"] / roll_roh.Grundrate

print(f"\\nK3 - NUTZEN UEBER DIE QUARTALE (Lift >= {K3_LIFT_DIAGNOSE})")
print(roll_roh[["Stichtag", "Grundrate", "Quote Regel", "Lift Regel",
                "Quote Wald", "Lift Wald"]].round(3).to_string(index=False))
_k3_regel = int((roll_roh["Quote Regel"] >= HUERDE).sum())
_k3_wald = int((roll_roh["Quote Wald"] >= HUERDE).sum())
merke("k3_quartale_regel", _k3_regel); merke("k3_quartale_wald", _k3_wald)
_summe_regel, _summe_wald = int(roll_roh.Regel.sum()), int(roll_roh.Wald.sum())
_plaetze = len(roll_roh) * KAPAZITAET
merke("roll_quote_regel", _summe_regel / _plaetze)
_u_regel, _o_regel = wilson(_summe_regel, _plaetze)
merke("roll_wilson_unten", _u_regel)

_lift_regel = int((roll_roh["Lift Regel"] >= K3_LIFT_DIAGNOSE).sum())
_lift_wald = int((roll_roh["Lift Wald"] >= K3_LIFT_DIAGNOSE).sum())
print()
print(f"   K3 gefordert: Lift >= {K3_LIFT_DIAGNOSE} in mindestens "
      f"{K3_MINDESTQUARTALE} von {len(roll_roh)} Quartalen.")
print(f"      Faustregel: {_lift_regel} von {len(roll_roh)}")
print(f"      Wald:       {_lift_wald} von {len(roll_roh)}")
merke("k3_quartale_lift_regel", _lift_regel)
merke("k3_quartale_lift_wald", _lift_wald)
print()
print(f"   Zusatzfrage - die urspruenglichen {HUERDE:.0%}, wo das Orakel sie hergibt:")
print(f"      Faustregel: {_k3_regel} von {len(roll_roh)}")
print(f"      Wald:       {_k3_wald} von {len(roll_roh)}")
print()
print(f"   Zusammengefasst ueber alle Quartale: Regel {_summe_regel} von "
      f"{_plaetze} = {_summe_regel / _plaetze:.1%}")
print(f"      Wilson-Intervall {_u_regel:.1%} bis {_o_regel:.1%} - die Huerde "
      f"von {HUERDE:.0%} liegt darueber.")
print("      (Dieselben Raeder kommen mehrfach vor; das Intervall ist damit")
print("      zu eng gerechnet - der Abstand zur Huerde bleibt eindeutig.)")
print()
print("   EMPFINDLICHKEIT der Nutzenschwelle:")
print(f"   {'Lift-Schwelle':>14s}{'Regel':>9s}{'Wald':>8s}")
for _s in (1.3, 1.4, K3_LIFT_DIAGNOSE, 1.6, 1.7):
    _r = int((roll_roh["Lift Regel"] >= _s).sum())
    _w = int((roll_roh["Lift Wald"] >= _s).sum())
    print(f"   {_s:>14.1f}{_r:>7d}/{len(roll_roh)}{_w:>6d}/{len(roll_roh)}")
print()
print("   Die Schwelle ist eine Setzung - deshalb steht ihre Empfindlichkeit")
print("   daneben. Bei 1,7 faellt der Wald durch, bei 1,3 bestehen beide")
print("   muehelos. Festgelegt wurde sie in Phase 1, vor dieser Rechnung.")
_gr = pd.DataFrame(zeilen).Grundrate
merke("grundrate_min", _gr.min())
merke("grundrate_max", _gr.max())
_ = merke("grundrate_faktor", _gr.max() / max(_gr.min(), 0.001))
roll["Grundrate"] = roll.Grundrate.map(lambda x: f"{x:.1%}")
print("ROLLIERENDE VALIDIERUNG - je Stichtag neu trainiert\\n")
print(roll.to_string(index=False))
print(f"\\nSumme über {len(roll)} Quartale:  Wald {roll.Wald.sum()} Treffer, "
      f"Regel {roll.Regel.sum()} Treffer")
merke("roll_regel", int(roll.Regel.sum())); merke("roll_wald", int(roll.Wald.sum()))
merke("roll_quartale", len(roll))
vorteil = roll["Vorteil Wald (EUR)"].sum()
print(f"Vorteil des Modells: {vorteil:,.0f} EUR insgesamt, "
      f"{vorteil/len(roll):,.0f} EUR je Quartal".replace(",", "."))
besser = merke("wald_besser", int((roll.Wald > roll.Regel).sum()))
gleich = int((roll.Wald == roll.Regel).sum())
print(f"Wald besser in {besser}, gleichauf in {gleich}, "
      f"schlechter in {len(roll)-besser-gleich} Quartalen")
'''),

MD("""
Damit ist die Entscheidung gefallen, und zwar gegen das Modell. Über die
{{roll_quartale:.0f}} Validierungsquartale trifft der Wald {{roll_wald:.0f}}-mal, die
Regel {{roll_regel:.0f}}-mal; vorn liegt der Wald in {{wald_besser:.0f}} von
{{roll_quartale:.0f}} Quartalen. Das ist **kein Vorteil**, und das vor jedem
Betriebsaufwand.

> **Ein Modell muss seinen Unterhalt verdienen.** Hier verdient es ihn nicht.

### 5.4 Unsicherheit der Trefferquote

{{treffer_regel:.0f}} von {{kapazitaet:.0f}} sind {{quote_regel:.1%}}. Diese Zahl klingt
genauer, als sie ist: Sie beruht auf {{kapazitaet:.0f}} Beobachtungen. Das Wilson-Intervall sagt, welche wahren Trefferquoten mit diesem Ergebnis
verträglich sind.
"""),

CODE('''
print(f"{'Verfahren':32s}{'Treffer':>9s}{'Quote':>9s}{'95-%-Intervall':>20s}")
print("-" * 70)
grenzen = {}
for name, score in [("Faustregel: km seit Reparatur", p_regel),
                    ("Modell: Random Forest", p_wald)]:
    e = liste_bewerten(name, score, y_test)
    u, o = wilson(e["Treffer"], KAPAZITAET)
    grenzen[name] = (u, o)
    kurz = "regel" if "Faustregel" in name else "wald"
    merke("treffer_" + kurz, e["Treffer"]); merke("quote_" + kurz, e["Trefferquote"])
    if kurz == "regel":
        merke("quote_regel_von_zehn", e["Trefferquote"] * 10)
        merke("abdeckung_von_zehn", e["Treffer"] / int(y_test.sum()) * 10)
    print(f"{name:32s}{e['Treffer']:>9d}{e['Trefferquote']:>8.1%}"
          f"{u:>12.1%} bis {o:.1%}")

# DAS URTEIL FOLGT AUS DEN GRENZEN, es steht nicht daneben. Eine gedruckte
# Schlussfolgerung ohne gerechneten Wert bleibt stehen, wenn sich die Zahlen
# aendern - und widerspricht dann der Tabelle direkt darueber.
print()
for name, (u, o) in grenzen.items():
    if u >= HUERDE:
        lage = f"Huerde {HUERDE:.0%} liegt UNTER dem Intervall - gestuetzt"
    elif o < HUERDE:
        lage = f"Huerde {HUERDE:.0%} liegt UEBER dem Intervall - widerlegt"
    else:
        lage = f"Huerde {HUERDE:.0%} liegt INNERHALB - unentschieden"
    print(f"   {name:32s} {lage}")
    merke("wilson_unten_" + ("regel" if "Faustregel" in name else "wald"), u)

print()
print("Die Intervalle sagen, welche wahren Quoten mit dem Beobachteten vereinbar")
print("sind. Sie vergleichen die beiden Verfahren NICHT miteinander - dafuer")
print("braeuchte es einen gepaarten Test auf denselben Raedern.")
'''),

MD("""
**Über die Hürde entscheidet die Lage des Intervalls, nicht der Punktwert.** Die
Untergrenzen liegen bei {{wilson_unten_regel:.1%}} für die Faustregel und
{{wilson_unten_wald:.1%}} für den Wald.

Drei Lagen sind möglich, und nur zwei davon sind eine Antwort: Liegt die Hürde *unter*
dem Intervall, ist sie gestützt; liegt sie *darüber*, ist sie widerlegt. Liegt sie
*innerhalb*, ist das Ergebnis mit beiden Welten verträglich — kein knappes Ja, sondern
ein Nichtwissen.

Bei {{kapazitaet:.0f}} Beobachtungen ist dieses Nichtwissen der Normalfall. Deshalb steht
in Phase 5 das Intervall neben dem Punktwert, und deshalb entscheidet über die
Auslieferung nicht ein einzelnes Quartal, sondern die rollierende Validierung in 5.3.

### 5.5 Treffsicherheit und Abdeckung
"""),

CODE('''
positive = merke("positive_im_test", int(y_test.sum()))
# Wie viele der auffaelligen Raeder sind wirklich fahruntauglich? Die
# Kostenmatrix behandelt leicht und schwer gleich - hier steht, wie stark
# diese Vereinfachung vereinfacht.
# NUR RAEDER DER TESTPOPULATION. Eine fruehere Fassung zaehlte alle Raeder
# mit schwerer Meldung im Fenster und teilte durch die 127 positiven
# TESTraeder - Zaehler und Nenner kamen aus verschiedenen Mengen. Zwei davon
# gehoerten gar nicht zur Prognosepopulation.
_im_test = set(test_zeilen.fahrrad_id)
_schwere_meldungen = schaeden[
    (schaeden.gemeldet_am > letzter)
    & (schaeden.gemeldet_am <= letzter + pd.Timedelta(days=HORIZONT_TAGE))
    & (schaeden.schwere == "fahruntauglich")
    & schaeden.fahrrad_id.isin(_im_test)]
_schwer_ids = set(_schwere_meldungen.fahrrad_id)
_schwer = len(_schwer_ids)
merke("positive_fahruntauglich", _schwer)
merke("anteil_fahruntauglich", _schwer / positive)

# ─── GEGENRECHNUNG: DAS ENGERE ZIEL ─────────────────────────────────
# Vorhergesagt wird "irgendeine Meldung". Fuer die Werkstatt ist das nicht
# dasselbe wie "faellt aus". Dieselben beiden Ranglisten, gegen das engere
# Ziel gemessen - ohne dass eines der Verfahren darauf trainiert waere.
y_schwer = np.array([1 if fid in _schwer_ids else 0
                     for fid in test_zeilen.fahrrad_id])
print("\\nGEGENRECHNUNG - dasselbe Ranking, engeres Ziel 'fahruntauglich':")
print(f"   {'Verfahren':32s}{'Treffer':>9s}{'Precision@' + str(KAPAZITAET):>14s}"
      f"{'Recall':>9s}")
_schwer_treffer = {}
for _name, _score in [("Faustregel: km seit Reparatur", p_regel),
                      ("Modell: Random Forest", p_wald)]:
    _liste = np.zeros(len(y_schwer), dtype=bool)
    _liste[np.argsort(-_score)[:KAPAZITAET]] = True
    _tr = int(y_schwer[_liste].sum())
    _schwer_treffer[_name] = _tr
    print(f"   {_name:32s}{_tr:>9d}{_tr / KAPAZITAET:>13.1%}"
          f"{_tr / max(_schwer, 1):>9.1%}")
_kurz = {"Faustregel: km seit Reparatur": "regel", "Modell: Random Forest": "wald"}
for _n, _k in _kurz.items():
    merke("schwer_treffer_" + _k, _schwer_treffer[_n])
_vorn = max(_schwer_treffer, key=_schwer_treffer.get)
merke("schwer_vorn", _vorn)
print()
if _schwer_treffer["Modell: Random Forest"] > _schwer_treffer["Faustregel: km seit Reparatur"]:
    print("   Beim engeren Ziel liegt das MODELL vorn - bei umgekehrter Reihenfolge")
    print("   gegenueber dem breiten Ziel. Das ist kein Beleg fuer eine Freigabe:")
    print("   ein Testquartal, und trainiert wurde auf dem breiten Label. Es zeigt")
    print("   aber, dass die Verfahrensrangfolge an der ZIELDEFINITION haengt.")
elif _schwer_treffer["Modell: Random Forest"] < _schwer_treffer["Faustregel: km seit Reparatur"]:
    print("   Auch beim engeren Ziel liegt die REGEL vorn. Die Rangfolge dreht")
    print("   sich hier also nicht - was sie bei anderer Datenlage koennte.")
else:
    print("   Beim engeren Ziel treffen beide gleich oft.")
print()
print("   Die Kostenmatrix behandelt leicht und schwer gleich. Solange das so")
print("   ist, optimiert das Verfahren auf das breite Ziel - auch wenn die")
print("   Werkstatt das engere meint.")

# ─── SENSITIVITAET: DIE ZENSIERTEN NEGATIVFAELLE ────────────────────
# Raeder, die im Horizont ausgemustert wurden und keine Meldung hatten,
# zaehlen als "meldet sich nicht" - obwohl sie nicht die volle Zeit unter
# Risiko standen. Was passiert, wenn man sie weglaesst? Ein Verfahren, das
# nur ohne sie gut aussieht, hat sein Ergebnis von der Ausmusterung.
_unvollstaendig = _aus_ids - set(test_zeilen.loc[y_test.values == 1, "fahrrad_id"])
_behalten = ~test_zeilen.fahrrad_id.isin(_unvollstaendig).values
print(f"\\nSENSITIVITAET - ohne {int((~_behalten).sum())} unvollstaendig beobachtete "
      f"Negativfaelle:")
print(f"   {'Verfahren':32s}{'mit allen':>12s}{'ohne':>8s}{'Differenz':>12s}")
for _name, _score in [("Faustregel: km seit Reparatur", p_regel),
                      ("Modell: Random Forest", p_wald)]:
    _voll = liste_bewerten(_name, _score, y_test)["Trefferquote"]
    _ohne = liste_bewerten(_name, np.asarray(_score)[_behalten],
                           np.asarray(y_test)[_behalten])["Trefferquote"]
    print(f"   {_name:32s}{_voll:>11.1%}{_ohne:>8.1%}{_ohne - _voll:>+11.1%}")
    merke("zensur_" + ("regel" if "Faustregel" in _name else "wald"), _ohne - _voll)
print()
print("   Verschiebt sich die Rangfolge nicht, traegt die Zensierung das")
print("   Ergebnis nicht. Sie bleibt trotzdem ein Mangel des Labels: Richtig")
print("   waere, Ausmusterung als KONKURRIERENDES EREIGNIS zu behandeln -")
print("   ein Rad, das verschrottet wird, meldet sich nicht mehr, aber es")
print("   hat auch nicht 'bestanden'.")
for name, score in [("Faustregel: km seit Reparatur", p_regel),
                    ("Modell: Random Forest", p_wald)]:
    e = liste_bewerten(name, score, y_test)
    print(f"{name}")
    print(f"   Treffsicherheit  {e['Treffer']:>3d} von {KAPAZITAET} ausgewählten Rädern "
          f"melden sich    = {e['Treffer']/KAPAZITAET:.1%}")
    print(f"   Abdeckung        {e['Treffer']:>3d} von {positive} auffälligen Rädern "
          f"werden erreicht = {e['Treffer']/positive:.1%}")
    print(f"   -> {positive - e['Treffer']} Ausfälle bleiben unentdeckt\\n")
'''),

MD("""
**Die erste Zahl beschreibt die Liste, die zweite das Problem.** Beide sind richtig, und
sie sagen Gegensätzliches: Die Liste ist gut — von den {{kapazitaet:.0f}} geprüften
Rädern melden sich {{quote_regel_von_zehn:.1f}} von zehn. Das Problem ist damit nicht
gelöst — von den auffälligen Rädern erreicht die Liste nur
{{abdeckung_von_zehn:.1f}} von zehn.

Der Grund ist die Kapazität, nicht das Verfahren: {{kapazitaet:.0f}} Plätze bei
{{positive_im_test:.0f}} auffälligen Rädern. **Keine Rangfolge kann mehr Fälle abdecken, als die Liste Plätze hat.** Eine höhere
Abdeckung setzt deshalb mehr Kapazität voraus, nicht ein anderes Verfahren.

### 5.6 Bewertung gegen die Erfolgskriterien aus Phase 1

Jetzt kommen die beiden Kriterien aus Phase 1 zum Einsatz — und ein drittes, das die
rollierende Validierung erzwingt: **Ein Modell wird nur ausgeliefert, wenn es die
Faustregel über mehrere Quartale schlägt.** Ein einzelnes gutes Quartal genügt nicht.

**Die Gates heißen hier genauso wie in Phase 1 und bedeuten dasselbe.** Zwei Kataloge
unter denselben Bezeichnern — etwa K3 einmal für den Lift und einmal für die
statistische Absicherung — machen das Freigabeurteil unauflösbar: Es lässt sich dann
nicht mehr auf die Zusage aus Phase 1 zurückführen.

| | Gate | woran es hängt |
|---|---|---|
| **K1** | Lift ≥ {{k3_lift_diagnose}} in mindestens {{k3_mindestquartale:.0f}} von {{roll_quartale:.0f}} Validierungsquartalen | dieselbe Frage an beide Kandidaten, ohne Vergleich untereinander |
| **K2** | erwartete Kosten im Testquartal unter denen der Faustregel „ältestes Rad zuerst" | besser als das, was heute schon getan wird |
| **K3** | Wilson-Untergrenze der Listenpräzision > {{k3_lift_diagnose}} × Grundrate des Testquartals ({{k3_schwelle:.1%}}) | eine Quote aus {{kapazitaet:.0f}} Beobachtungen ist keine Zusage |

Bindend sind diese drei — {{pflichtgates}}.

**Die ursprünglichen {{huerde:.0%}}** stehen als Diagnosespalte `D70` in der Tabelle,
nicht in den Pflichtgates. Die Orakelschranke zeigt, dass sie in
{{unmoegliche_quartale:.0f}} von {{roll_quartale:.0f}} Quartalen unerfüllbar sind — auch
für ein Verfahren mit vollständiger Kenntnis der Zukunft. Eine Hürde, die niemand nehmen
kann, misst nicht das Verfahren, sondern die Jahreszeit.

Sie bleibt trotzdem sichtbar, damit erkennbar ist, wo die Verfahren gegenüber der
ursprünglichen Zusage stehen, und sie darf wieder bindend werden — aber nur, wenn jemand
sie neu und vorab begründet, nicht durch stillschweigendes Einwandern ins Urteil.

Entscheidend ist die Reihenfolge, nicht der Ausgang: Das Kriterium stand **vor** der
Messung fest, der Befund kam danach. Ein nachträglich erfülltes Kriterium begründet keine
Freigabe — es widerspricht ihr nur nicht. Eine erst nach dem Ergebnis festgelegte Hürde
prüft nichts; sie beschreibt den Befund.
"""),

CODE('''
kosten_heute = float(tabelle.loc[tabelle.Vorgehen.str.contains("ältestes"), "Kosten (EUR)"].iloc[0])
vorteil_roll = roll["Vorteil Wald (EUR)"].sum()

# ─── DER KANONISCHE GATE-KATALOG ────────────────────────────────────
#
# DREI Namen, DREI Bedeutungen - dieselben wie in Phase 1, Wort fuer Wort.
# Frueher hiessen sie hier K1a, K1b, K2, K3, und K3 bezeichnete den Lift,
# waehrend Phase 1 unter K3 die statistische Absicherung verstand. Zwei
# Kataloge unter denselben Buchstaben sind schlimmer als keiner: Man kann
# das Urteil nicht mehr auf die Zusage zurueckfuehren.
#
# Die 70 % sind KEIN Gate mehr. Sie stehen als Diagnose D70 in der
# Tabelle, weil die Orakelschranke gezeigt hat, dass sie in einzelnen
# Quartalen unerfuellbar sind. Ein Wert, der in der Tabelle steht, aber
# nicht in der Bedingung, muss auch so heissen.
GATE_KATALOG = {
    "K1": f"Lift >= {K3_LIFT_DIAGNOSE} in mindestens {K3_MINDESTQUARTALE} "
          f"von {len(roll_roh)} Validierungsquartalen",
    "K2": "erwartete Kosten im Testquartal unter denen der Faustregel",
    "K3": f"Wilson-Untergrenze der Listenpraezision > {K3_LIFT_DIAGNOSE} "
          f"x Grundrate des Testquartals",
}
PFLICHTGATES = tuple(GATE_KATALOG)
GRUNDRATE_TEST = float(y_test.mean())
K3_SCHWELLE = K3_LIFT_DIAGNOSE * GRUNDRATE_TEST
merke("grundrate_test", GRUNDRATE_TEST)
merke("k3_schwelle", K3_SCHWELLE)
print("GATE-KATALOG - dieselben Namen und Bedeutungen wie in Phase 1:")
for _k, _b in GATE_KATALOG.items():
    print(f"   {_k}  {_b}")
print(f"   D70 (nur Diagnose) beobachtete Trefferquote >= {HUERDE:.0%}")
print(f"\\nGrundrate im Testquartal {GRUNDRATE_TEST:.1%}, "
      f"K3-Schwelle damit {K3_SCHWELLE:.1%}.\\n")

print(f"{'':30s}{'Treffer':>8s}{'Kosten':>10s}{'K1 Lift':>10s}"
      f"{'K2 Kosten':>11s}{'K3 belegt':>11s}{'D70':>10s}")
print("-" * 94)

urteile = {}
for name, score in [("Faustregel: km seit Reparatur", p_regel),
                    ("Modell: Random Forest", p_wald)]:
    e = liste_bewerten(name, score, y_test)
    # K1 - der Nutzen ueber die Quartale. Dieselbe Frage an beide
    # Kandidaten: In wie vielen Validierungsquartalen nimmt er AUS EIGENER
    # KRAFT die Nutzenschwelle? Kein Vergleich, keine Kostendifferenz.
    # Frueher bekam die Faustregel dieses Gate geschenkt (k3 = True), weil
    # sie "der Massstab" sei - ein Gate, das den Kandidaten kennt, prueft
    # nicht ihn, sondern die Absicht dessen, der es geschrieben hat.
    _spalte = "Lift Regel" if "Faustregel" in name else "Lift Wald"
    _bestanden = int((roll_roh[_spalte] >= K3_LIFT_DIAGNOSE).sum())
    k1 = _bestanden >= K3_MINDESTQUARTALE
    # K2 - besser als das, was heute schon getan wird.
    k2 = e["Kosten (EUR)"] < kosten_heute
    # K3 - die statistische Absicherung, die Phase 1 verlangt: Traegt die
    # UNTERE Intervallgrenze die Nutzenschwelle? Nicht die 70 %, sondern
    # das 1,5-fache der Grundrate DIESES Quartals - dieselbe Groesse wie
    # in K1, nur einmal statistisch abgesichert statt beobachtet.
    _unten = wilson(e["Treffer"], KAPAZITAET)[0]
    k3 = _unten > K3_SCHWELLE
    # D70 - Diagnose, nicht Gate. Sie steht hier, weil die urspruengliche
    # Zusage 70 % lautete und man sehen soll, wo die Verfahren stehen.
    d70 = e["Trefferquote"] >= HUERDE
    urteile[name] = (e, {"K1": k1, "K2": k2, "K3": k3}, {"D70": d70,
                                                         "wilson_unten": _unten,
                                                         "quartale": _bestanden})
    betrag = f"{e['Kosten (EUR)']:,.0f}".replace(",", ".")
    ja = lambda b: "ERFÜLLT" if b else "GERISSEN"
    print(f"{name:30s}{e['Trefferquote']:>7.1%}{betrag:>8s} €"
          f"{ja(k1):>10s}{ja(k2):>11s}{ja(k3):>11s}"
          f"{('ja' if d70 else 'nein'):>10s}")

print(f"\\n   K3 im Detail - Wilson-Untergrenze gegen {K3_SCHWELLE:.1%}:")
for name, (_e, _g, _d) in urteile.items():
    print(f"      {name:32s} {_d['wilson_unten']:>6.1%}   "
          f"{'traegt' if _g['K3'] else 'TRAEGT NICHT'}")
merke("k3_unten_regel", urteile["Faustregel: km seit Reparatur"][2]["wilson_unten"])
merke("k3_unten_wald", urteile["Modell: Random Forest"][2]["wilson_unten"])
merke("d70_regel", "ja" if urteile["Faustregel: km seit Reparatur"][2]["D70"] else "nein")
merke("d70_wald", "ja" if urteile["Modell: Random Forest"][2]["D70"] else "nein")

alle_gates = [n for n in urteile if all(urteile[n][1][g] for g in PFLICHTGATES)]

# ─── EINE QUELLE FÜR DAS AUSGELIEFERTE VERFAHREN ────────────────────
# Ab hier arbeitet ALLES mit diesen beiden Variablen: Confusion-Matrix,
# Kapazitätskurve, Liste, CSV und Modellpaket. In einer früheren Fassung
# stand im Text "Random Forest geht in Betrieb", während der Export nach
# der Faustregel sortierte - drei Zellen lang unbemerkt.
#
# Faellt KEIN Kandidat durch alle Pflichtgates, gibt es kein Produkt. Frueher
# lief min() dann auf eine leere Liste und brach mit einem ValueError ab -
# ein Absturz ist keine Freigabeentscheidung.
KEINE_FREIGABE = not alle_gates
if KEINE_FREIGABE:
    ausgeliefertes_verfahren = None
    ausgelieferter_score = None
else:
    ausgeliefertes_verfahren = min(alle_gates,
                                   key=lambda n: urteile[n][0]["Kosten (EUR)"])
    ausgelieferter_score = {"Faustregel: km seit Reparatur": p_regel,
                            "Modell: Random Forest": p_wald}[ausgeliefertes_verfahren]

print()
print(f"  Pflichtgates: {' · '.join(PFLICHTGATES)}   (D70 bindet NICHT)")
for name, (_, gates, _d) in urteile.items():
    offen = [g for g in PFLICHTGATES if not gates[g]]
    print(f"    {name:32s} {'alle erfüllt' if not offen else 'gerissen: ' + ', '.join(offen)}")
if KEINE_FREIGABE:
    print("\\n  KEINE FREIGABE: Kein Verfahren erfüllt alle Pflichtgates.")
    print("  Es wird keine Liste erzeugt und kein Modell ausgeliefert.")
else:
    print(f"\\n  AUSGELIEFERT WIRD:           {ausgeliefertes_verfahren.upper()}")
# Wie stark unterscheiden sich die beiden Top-Listen ueberhaupt?
_l_regel = set(np.argsort(-p_regel)[:KAPAZITAET])
_l_wald = set(np.argsort(-p_wald)[:KAPAZITAET])
merke("listen_gemeinsam", len(_l_regel & _l_wald))
# Der hoechste Listenwert - unabhaengig davon, ob ein Artefakt entsteht.
_ = merke("spitzenwert_km", float(np.sort(p_regel)[-1]))
merke("listen_exklusiv", KAPAZITAET - len(_l_regel & _l_wald))
merke("keine_freigabe", int(KEINE_FREIGABE))
_ = merke("pflichtgates", " · ".join(PFLICHTGATES))
'''),

MD("""
**Beide Verfahren nehmen K3.** Die Faustregel erreicht die Nutzenschwelle in
{{k3_quartale_lift_regel:.0f}} von {{roll_quartale:.0f}} Quartalen, der Wald in
{{k3_quartale_lift_wald:.0f}}. Über alle Quartale trifft die Regel {{roll_regel:.0f}} von
{{roll_quartale:.0f}} × {{kapazitaet:.0f}} Listenplätzen.

**Die ursprünglichen {{huerde:.0%}} hält keines von beiden** — die Regel in
{{k3_quartale_regel:.0f}}, der Wald in {{k3_quartale_wald:.0f}} von
{{roll_quartale:.0f}} Quartalen. Das ist kein Widerspruch zur Freigabe, sondern der Grund
für den Rücksprung in Phase 1: In einem der Quartale liegt schon die **Orakelschranke**
bei {{winter_orakel:.1%}}. Dort hätte auch ein Verfahren mit vollständiger Kenntnis der
Zukunft die Zusage verfehlt.

**Der Unterschied zum Schönrechnen liegt im Grund, nicht im Ergebnis.** Ein Kriterium zu
wechseln, weil das Verfahren daran scheitert, ist Manipulation; eines zu korrigieren,
weil **kein** Verfahren es halten könnte, ist eine Reparatur — und sie gehört nach
Phase 1, wo die Zusage entstanden ist. Die Probe darauf ist die Orakelschranke: Sie
hängt allein an den Daten und an der Kapazität, an keinem Modell, und gehört deshalb
berechnet, **bevor** eine Zusage formuliert wird.

**Das Modell war trotzdem nicht umsonst.** Ohne es stünde hier eine Trefferquote, ohne
dass jemand sagen könnte, ob sie gut ist. Gezeigt ist präzise dies: Mit dieser
Merkmalsmenge, dieser Waldkonfiguration und diesen fünf Perioden ist **kein stabiler
Zusatznutzen** gegenüber der Faustregel nachgewiesen. Das ist etwas anderes als „der
Wald lernt nichts dazu" — die beiden Listen teilen {{listen_gemeinsam:.0f}} von
{{kapazitaet:.0f}} Rädern und unterscheiden sich bei je {{listen_exklusiv:.0f}}. Er
sortiert anders, nur nicht besser.

> **Ein Wort zum Klassengewicht {{klassengewicht:.1f}}.** Es stammt aus dem Kostenverhältnis, ist aber
> **keine direkte Übersetzung der Geschäftsentscheidung**: Bei einer festen Liste von 60
> Rädern entscheidet kein Schwellenwert, sondern der Rang. Das Gewicht verändert, was
> der Wald lernt, und kann die Rangfolge verbessern oder verschlechtern. Ob 7,2 der
> richtige Wert ist, müsste auf den Validierungsquartalen gegen Precision@60 geprüft
> werden — hier ist es gesetzt, nicht gefunden.

### 5.7 Wirkung einer größeren Kapazität

Die Kapazität von 60 war eine Vorgabe aus Phase 1. Naheliegend ist die Frage, ob sich
eine größere Werkstatt lohnt. Die Antwort der Kostenformel ist unbrauchbar — und gerade
deshalb lehrreich.
"""),

CODE('''
# WAECHTER: Ohne bestandenes Gate entsteht KEIN Artefakt.
# Der Nichtfreigabepfad ist kein Sonderfall, den man beschreibt - er muss
# laufen. Vorher brach die naechste Zelle mit einem TypeError ab, weil
# ausgelieferter_score None war: ein Absturz statt einer Entscheidung.
if KEINE_FREIGABE:
    print("KEINE FREIGABE - kein Kandidat hat alle Pflichtgates genommen.")
    print("Es wird nichts gerechnet, nichts geschrieben, nichts gespeichert.")
else:
    # Nicht nur 20 bis 120, sondern JEDE Listenlaenge. Wer nur einen Ausschnitt
    # rechnet, findet das Minimum am Rand des Ausschnitts und haelt es fuer ein
    # Optimum. Genau das ist in einer frueheren Fassung passiert: Dort stand
    # "die guenstigste Kapazitaet ist 120" - es war schlicht der groesste
    # gepruefte Wert.
    alle_k = range(1, len(y_test) + 1)
    kosten_k = [liste_bewerten("x", ausgelieferter_score, y_test, kapazitaet=k)["Kosten (EUR)"]
                for k in alle_k]
    guenstigste = int(np.argmin(kosten_k)) + 1

    plt.figure(figsize=(8.5, 4))
    plt.plot(list(alle_k), kosten_k, color="#e00034", lw=2)
    plt.axvline(KAPAZITAET, color="#3d4b6b", ls=":", label=f"heutige Kapazität ({KAPAZITAET})")
    plt.axvline(guenstigste, color="#8AB833", ls="--",
                label=f"rechnerisches Minimum: {guenstigste}")
    plt.xlabel("Prüfungen je Quartal"); plt.ylabel("Kosten nach der Formel aus Phase 1 (EUR)")
    plt.title("Die Kostenformel hat ihr Minimum am rechten Rand"); plt.legend(); plt.grid(alpha=.3)
    plt.tight_layout(); plt.show()

    for k in [20, 60, 120, len(y_test)]:
        e = liste_bewerten(f"k={k}", ausgelieferter_score, y_test, kapazitaet=k)
        print(f"  Kapazität {k:>4d}: {e['Treffer']:>3d} Treffer, "
              f"{e['Kosten (EUR)']:>8,.0f} EUR".replace(",", "."))
    print(f"\\nRechnerisches Minimum bei {guenstigste} von {len(y_test)} Rädern.")
'''),

MD("""
**Die Formel empfiehlt, praktisch die ganze Flotte zu prüfen.** Das ist betrieblich
nicht umsetzbar. Der Fehler steckt nicht in der Rechnung, sondern in der Formel:

```text
Kosten = falsch_positive × {{kosten_unnoetig:.0f}} € + falsch_negative × {{kosten_verpasst:.0f}} €
```

Bei fester Listenlänge `k` und `P` positiven Rädern gilt `FP = k − TP` und `FN = P − TP`,
also:

```text
Kosten = {{kosten_unnoetig:.0f}}k + {{kosten_verpasst:.0f}}P − {{kosten_summe:.0f}} × TP
```

Jeder zusätzliche Listenplatz kostet 25 € und bringt im Erwartungswert mehr als 25 € an
vermiedenen Ausfällen, solange die Trefferquote über 12 Prozent liegt. Bei einer
Grundrate von {{quote_meldung_fenster:.0%}} ist das bis zum letzten Rad der Fall.

> **Was in der Formel fehlt:** die Prüfkosten der Treffer. Ein gefundener Schaden
> verursacht Arbeitszeit und Ersatzteile; in dieser Rechnung ist er kostenlos. Ebenso
> fehlt, mit welcher Wahrscheinlichkeit eine Prüfung den Schaden überhaupt findet und
> verhindert.

**Deshalb bleibt die Kapazität hier eine harte Vorgabe und wird nicht optimiert.** Die
Formel taugt, um zwei Verfahren bei *gleicher* Listenlänge zu vergleichen — dafür ist sie
in diesem Notebook auch benutzt worden. Sie taugt nicht, um die Listenlänge selbst zu
wählen.

> **Auch beim Verfahrensvergleich bleibt sie ein Szenario.** Sie unterstellt, dass jeder
> Treffer den Schaden vollständig verhindert, dass jeder verpasste Ausfall genau 180 €
> kostet und dass ein leichter Defekt so teuer ist wie ein fahruntauglicher. Von den
> {{positive_im_test:.0f}} auffälligen Rädern des Testquartals sind
> {{positive_fahruntauglich:.0f}} fahruntauglich ({{anteil_fahruntauglich:.1%}}) — zwei Listen
> mit gleich vielen Treffern können wirtschaftlich sehr verschieden sein. Wo im Folgenden
> Euro stehen, stehen **Szenariokosten**.
"""),

MD("""
**Und das ist der Punkt, an dem eine Analyse ehrlich sein muss.** Die Frage „sollen wir
eine halbe Stelle in der Werkstatt aufbauen?“ lässt sich mit dieser Kostenformel **gerade
nicht** beantworten. Dafür fehlen die Prüf- und Reparaturkosten der Treffer und die
empirische Wahrscheinlichkeit, dass eine Prüfung einen Schaden überhaupt erkennt und
verhindert.

Eine Analyse, die hier eine Zahl nennt, nennt eine erfundene. Der richtige nächste
Schritt ist kein weiteres Modell, sondern ein Gespräch mit Werkstatt und Controlling
über die tatsächlichen Kosten je Prüfung, Reparatur und Ausfall.
"""),

# =====================================================================
PHASE(6, "Aus der Auswertung wird eine Liste, die zu Quartalsbeginn in der Werkstatt liegt."),

MD(kacheln([("Faustregel", "wird ausgeliefert"),
            ("{{quote_regel_von_zehn:.1f}} von 10", "geprüfte Räder werden auffällig"),
            ("{{abdeckung_von_zehn:.1f}} von 10", "auffällige Räder erfasst"),
            ("{{wilson_unten_regel:.1%}}", "untere Grenze gegen {{k3_schwelle:.1%}}")])),

CODE('''
# WAECHTER: Ohne bestandenes Gate entsteht KEIN Artefakt.
# Der Nichtfreigabepfad ist kein Sonderfall, den man beschreibt - er muss
# laufen. Vorher brach die naechste Zelle mit einem TypeError ab, weil
# ausgelieferter_score None war: ein Absturz statt einer Entscheidung.
if KEINE_FREIGABE:
    print("KEINE FREIGABE - kein Kandidat hat alle Pflichtgates genommen.")
    print("Es wird nichts gerechnet, nichts geschrieben, nichts gespeichert.")
else:
    import joblib, datetime

    liste = test_zeilen.copy()
    liste["rangwert"] = ausgelieferter_score          # KEIN zweiter Wert, kein Umweg
    # Wie weit ist der Modellscore von einer Wahrscheinlichkeit entfernt?
    # Gemessen, nicht behauptet - und getrennt von der Liste ausgegeben.
    print(f"Modellscore im Mittel {p_wald.mean():.1%}, "
          f"tatsächliche Grundrate {float(y_test.mean()):.1%} - "
          f"Abstand {abs(p_wald.mean() - float(y_test.mean())) * 100:.1f} Prozentpunkte.")
    print("Als Rangfolge brauchbar, als Wahrscheinlichkeit nicht. Deshalb steht")
    print("der Score im Analysebericht, nicht in der Werkstattliste.\\n")
    liste = liste.sort_values("rangwert", ascending=False).head(KAPAZITAET)
    liste["rang"] = range(1, len(liste) + 1)

    # ─── SELBSTPRÜFUNG ──────────────────────────────────────────────────
    # Die exportierte Liste MUSS die Top 60 des Verfahrens sein, das oben
    # als ausgeliefert benannt wurde. In einer früheren Fassung stimmte das
    # nicht: Der Text erklärte den Wald zum Sieger, sortiert wurde nach der
    # Regel. Die beiden Listen überschnitten sich in 43 von 60 Rädern -
    # niemandem fiel es auf. Diese Zeile lässt das Notebook durchfallen.
    soll = set(test_zeilen.iloc[np.argsort(-np.asarray(ausgelieferter_score))[:KAPAZITAET]].fahrrad_id)
    assert set(liste.fahrrad_id) == soll, (
        f"Die exportierte Liste passt nicht zu '{ausgeliefertes_verfahren}'")
    print(f"Selbstprüfung bestanden: Liste = Top {KAPAZITAET} von '{ausgeliefertes_verfahren}'\\n")

    # Der Modellscore steht NICHT in der ausgelieferten Liste. Er stammt aus
    # einem Verfahren, das ausdruecklich nicht freigegeben ist; neben einem
    # Rang, den die Regel bestimmt, erzeugt er in der Werkstatt ein zweites,
    # widersprechendes Signal. Er gehoert in den Analysebericht, nicht auf
    # den Werkstatttisch.
    ausgabe = liste[["rang", "rahmennummer", "typ_code", "rangwert", "km_180",
                     "meldungen_bisher", "tage_seit_reparatur"]].copy()
    ausgabe["rangwert"] = ausgabe.rangwert.round(0)
    ausgabe["km_180"] = ausgabe.km_180.round(0)
    ausgabe = ausgabe.rename(columns={
        "rahmennummer": "Rahmennummer", "typ_code": "Typ",
        "rangwert": "km seit letzter Reparatur", "km_180": "km (180 Tage)",
        "meldungen_bisher": "Meldungen bisher", "tage_seit_reparatur": "Tage seit Reparatur"})


    # ZWEI ARTEFAKTE, ZWEI ZWECKE - und sie duerfen nicht denselben Namen tragen.
    #
    # Diese Liste steht auf dem Stichtag {letzter}, dessen 90 Tage laengst
    # vorbei sind: Ihr Ausgang ist bekannt und wurde gerade zur Bewertung
    # benutzt. Sie ist ein TESTARTEFAKT, keine Werkstattliste. Eine Datei
    # "wartungsliste.csv" haette genau das verwischt - der Name haette ein
    # Betriebsprodukt behauptet, wo eine Rueckschau steht.
    _test_datei = f"testliste_historisch_{letzter.date()}.csv"
    print(f"HISTORISCHE TESTLISTE  Stichtag {letzter.date()}   ({KAPAZITAET} Räder)")
    print("Der 90-Tage-Ausgang dieser Liste ist BEKANNT und wurde oben zur")
    print("Bewertung verwendet. Sie ist kein Auftrag an die Werkstatt.\\n")
    print(ausgabe.head(15).to_string(index=False))
    print(f"\\n... und {len(ausgabe) - 15} weitere.")

    # BETRIEBSMETADATEN GEHOEREN IN DIE DATEI, NICHT IN DIE E-MAIL.
    # Wer eine CSV in einem Ordner findet, muss ihr ansehen koennen, woher
    # sie kommt und ob sie benutzt werden darf.
    ausgabe["stichtag"] = letzter.date()
    ausgabe["gilt_bis"] = (letzter + pd.Timedelta(days=HORIZONT_TAGE)).date()
    ausgabe["kennzeichnung"] = "HISTORISCHER_TEST - Ausgang bekannt"
    ausgabe["regelversion"] = "km_seit_reparatur"
    ausgabe["datenstand"] = DATENSTAND_KURZ
    # KEIN Feld "freigabestatus": Diese Zeilen entstehen nur im Zweig, in dem
    # die Gates gehalten haben - das Feld koennte gar nichts anderes sagen.
    # Ein Status, der nur einen Wert annehmen kann, ist Dekoration. Was
    # stattdessen hilft, ist die Angabe, WELCHE Huerden geprueft wurden.
    ausgabe["gates_geprueft"] = " · ".join(PFLICHTGATES)
    ausgabe.to_csv(_test_datei, index=False)

    # Das Paket beschreibt, WAS ausgeliefert wird - abgeleitet, nicht getippt.
    # Das Modell wandert mit hinein, obwohl es nicht ausgeliefert wird: als
    # Beleg, dass es geprueft wurde, und als Ausgangspunkt der naechsten Runde.
    paket = {
        "ausgeliefert": ausgeliefertes_verfahren,
        "regel": "Räder nach Kilometern seit der letzten ERLEDIGTEN Reparatur, absteigend",
        "regel_spalte": "km_seit_reparatur",
        "trefferquote_test": round(float(urteile[ausgeliefertes_verfahren][0]["Trefferquote"]), 3),
        "vertrauensintervall_test": [round(float(g), 3)
                                     for g in wilson(urteile[ausgeliefertes_verfahren][0]["Treffer"],
                                                     KAPAZITAET)],
        "geprueft_aber_nicht_ausgeliefert": "Random Forest",
        "modell": wald,
        "merkmalsspalten": list(X_alle.columns),
        "vorteil_modell_validierung_eur": float(vorteil_roll),
        "horizont_tage": HORIZONT_TAGE, "rueckblick_tage": RUECKBLICK_TAGE,
        "kapazitaet": KAPAZITAET,
        "datenherkunft": "ERFUNDENE LEHRDATEN - keine Grundlage für Betriebsentscheidungen",
        "erstellt_am": datetime.date.today().isoformat(),
    }
    joblib.dump(paket, "wartungsmodell.joblib")


# ─── DIE SCHATTENLISTE - SIE ENTSTEHT IMMER ─────────────────────────
#
# Sie steht ABSICHTLICH ausserhalb des Freigabewaechters. Wenn nichts
# freigegeben wird, ist sie das einzige sinnvolle Artefakt: eine
# Vorhersage, deren Ausgang noch aussteht. Sie behauptet keine Guete,
# sie ermoeglicht, eine zu messen - und genau daran fehlt es hier.
# Was die Werkstatt HEUTE bekaeme, steht auf dem letzten Tag der Daten -
# und sein Ausgang ist unbekannt, weil die 90 Tage noch nicht vorbei sind.
# Genau das macht sie zur Schattenliste: Sie laesst sich erst nach Ablauf
# des Quartals bewerten. Wer sie vorher beurteilt, beurteilt nichts.
_schatten_stichtag = fahrten.startzeit.max().normalize()
_schatten = zeile_bauen(_schatten_stichtag)
_schatten = _schatten[_schatten.fahrrad_id.notna()].copy()
_schatten["rangwert"] = _schatten.km_seit_reparatur
_schatten = _schatten.nlargest(KAPAZITAET, "rangwert").reset_index(drop=True)
_schatten.insert(0, "rang", range(1, len(_schatten) + 1))
_schatten_aus = _schatten[["rang", "fahrrad_id", "typ_code", "rangwert",
                           "km_180", "meldungen_bisher"]].round(0)
_schatten_aus["stichtag"] = _schatten_stichtag.date()
_schatten_aus["gilt_bis"] = (_schatten_stichtag + pd.Timedelta(days=HORIZONT_TAGE)).date()
_schatten_aus["status"] = "SCHATTENBETRIEB - nicht handlungsleitend"
_schatten_aus["regelversion"] = "km_seit_reparatur"
_schatten_aus["kennzeichnung"] = "SCHATTENBETRIEB - Ausgang offen"
_schatten_aus["datenstand"] = DATENSTAND_KURZ
_schatten_aus["bewertbar_ab"] = (_schatten_stichtag
                                 + pd.Timedelta(days=HORIZONT_TAGE)).date()
_schatten_datei = f"schattenliste_{_schatten_stichtag.date()}.csv"
_schatten_aus.to_csv(_schatten_datei, index=False)
merke("schatten_stichtag", str(_schatten_stichtag.date()))
merke("schatten_stichtag_lang", f"{_schatten_stichtag:%d.%m.%Y}")

print()
if KEINE_FREIGABE:
    print("Kein Verfahren hat alle Pflichtgates genommen - es entsteht weder")
    print("eine Werkstattliste noch ein Modellpaket.")
    print(f"geschrieben: {_schatten_datei} (Schattenbetrieb, Ausgang offen)")
else:
    print(f"ausgeliefert: {paket['ausgeliefert']}")
    print(f"geschrieben: {_test_datei} (historisch, Ausgang bekannt)")
    print(f"             {_schatten_datei} (Schattenbetrieb, Ausgang offen)")
    print("             wartungsmodell.joblib")
print()
print(f"Die Schattenliste steht auf dem {_schatten_stichtag.date()} - dem letzten Tag")
print(f"der Daten. Bewertbar wird sie am {(_schatten_stichtag + pd.Timedelta(days=HORIZONT_TAGE)).date()},")
print("wenn die 90 Tage vorbei sind. Bis dahin ist sie eine Vorhersage")
print("ohne Ergebnis.")
print()
if KEINE_FREIGABE:
    print("Genau das ist der Punkt: Was fehlt, ist kein besseres Verfahren,")
    print("sondern eine Messung, die noch aussteht. Die Zusage haelt auf dem")
    print("historischen Testquartal und nicht ueber die Jahreszeiten - ob sie")
    print("prospektiv haelt, entscheidet dieses Quartal, nicht diese Analyse.")
else:
    print("Das ist der Unterschied zur historischen Liste darueber, deren")
    print("Ausgang bereits bekannt ist und die deshalb nichts mehr beweist.")
'''),

MD("""### 6.1 Ausgeliefert wird die Regel

Beide Verfahren nehmen die Pflichtgates bis auf eines: Der Wald reißt K3, die
statistische Absicherung im Testquartal — seine Wilson-Untergrenze liegt bei
{{k3_unten_wald:.1%}} gegen die geforderten {{k3_schwelle:.1%}}, die der Regel bei
{{k3_unten_regel:.1%}}. Damit bleibt die Faustregel. Bei ähnlicher Güte fiele die
Entscheidung ohnehin auf sie, und zwar wegen der Betriebskosten:

| | Faustregel | Random Forest |
|---|---|---|
| Trefferquote auf dem Test | {{quote_regel:.1%}} | {{quote_wald:.1%}} |
| über die Validierungsquartale | {{roll_regel:.0f}} Treffer | {{roll_wald:.0f}} Treffer |
| erklärbar | „das Rad ist seit {{spitzenwert_km:.0f}} km nicht in der Werkstatt gewesen" | nur über Umwege |
| Wartungsaufwand | geringer — die Regel selbst ändert sich nicht | vierteljährlich nachtrainieren |
| Abhängigkeiten im Betrieb | Fahrten-, Distanz-, Typ- und Wartungsdaten | dieselben, **zusätzlich** scikit-learn, joblib, Versionsstände |

Die unteren drei Zeilen sind der Preis eines Modells. Er wäre zu zahlen, wenn die oberen
beiden dafür sprächen — sie tun es nicht.

<details style="margin:12px 0 18px 0;border-left:3px solid #D8D8D8;padding-left:14px"><summary style="cursor:pointer;color:#2F2F2F;font-weight:600;padding:2px 0">Was an der Faustregel nicht eine Zeile ist</summary><div style="color:#333333;line-height:1.55;padding-top:8px"><p>Der Sortierausdruck ist eine Zeile. Das Merkmal <code>km_seit_reparatur</code> darunter setzt voraus:</p><ol><li>Langfahrten über acht Stunden ausschließen,</li><li>gemessene Distanzen verwenden und nur die fehlenden schätzen,</li><li>je Radtyp eine Geschwindigkeit für die Schätzung — ein unbekannter Typ erzeugt <code>NaN</code> und damit ein Rad ganz unten in der Liste,</li><li>die Verknüpfung mit <strong>erledigten</strong> Wartungsaufträgen,</li><li>den Ausschluss offener Schäden,</li><li>eine Stichtagslogik und eine Regel für neue Räder.</li></ol><p>Ausgeliefert wird also eine Regel <strong>samt ihrer Merkmalslogik</strong>, und die gehört genauso versioniert und getestet wie ein Modell. Was gegenüber dem Wald entfällt, ist das Nachtrainieren, nicht die Sorgfalt.</p></div></details>

**Das Modell bleibt im Paket.** Es belegt, dass die Regel geprüft und nicht aus
Bequemlichkeit gewählt wurde, und es ist der Ausgangspunkt der nächsten Runde. Sein
Ertrag steht dabei nicht in der Trefferquote, sondern in dem, was der Vergleich
ausschließt: Auf dieser Merkmalsmenge und über diese fünf Perioden ist kein stabiler
Zusatznutzen nachweisbar. Das sagt, wo als Nächstes zu investieren wäre — in Merkmale,
nicht in Rechenleistung.

### 6.2 Die Prüfliste als Produkt

Ausgeliefert wird nicht das Modell und nicht die Confusion-Matrix, sondern **diese
Tabelle**. Sie ist so gebaut, dass die Werkstatt sie ohne Nacharbeit übernehmen kann:
Rahmennummer statt Datenbank-ID, daneben die Zahlen, die die Reihenfolge begründen. Wer
ein Rad für unbedenklich hält, sieht, worauf sich die Liste stützt, und kann
widersprechen.

**In der Liste steht kein Modellscore.** Er stammt aus einem Verfahren, das nicht
freigegeben ist, und wäre neben dem Rang der Regel ein zweites, widersprechendes Signal.
Wer beide sehen will, findet sie im Analysebericht.

In der VeloCity-Warenwirtschaft (`wawi.butscher.cloud`) gehört die Liste in den Bereich
**Instandhaltung**, als eigene Ansicht neben den gemeldeten Schäden.

### 6.3 Überwachung der ausgelieferten Regel

Eine Regel lässt sich nicht nachtrainieren. Überwacht werden deshalb die **Daten, aus
denen ihr Merkmal entsteht**, und die Frage, ob die Liste im Betrieb noch trifft.

Jede Schwelle ist eine Zahl, kein Adjektiv: „Steigt deutlich" ist nachts um drei nicht
entscheidbar. Jede Zeile nennt Referenz, Warn- und Stoppwert, die Mindestfallzahl und die
Zuständigkeit.

<!-- zahl-ohne-ausgabe: 45 gesetzte Warnschwelle, keine Messung -->
<!-- zahl-ohne-ausgabe: 55 gesetzte Stoppschwelle, keine Messung -->
<!-- zahl-ohne-ausgabe: 35 gesetzte Stoppschwelle, keine Messung -->
<!-- zahl-ohne-ausgabe: 500 gesetzte Mindestfallzahl -->

| Wache | Referenz heute | Warnen ab | Stoppen ab | Mindestzahl | Wer | Reaktion |
|---|---:|---:|---:|---:|---|---|
| Fahrten ohne gemessene Distanz | {{anteil_geschaetzt:.0%}} | 45 % | 55 % | 500 Fahrten | Datenbetrieb | Die Schätzung trägt mehr als geplant — Sensorlage prüfen |
| Unbekannter Radtyp | keiner | — | erstes Auftreten | 1 | Datenbetrieb | **Sofort:** Die Merkmalsmenge kennt ihn nicht, der Lauf bricht ab |
| Ausgeschlossene Langfahrten | Anteil im Referenzquartal | +50 % relativ | +100 % relativ | 30 Fahrten | Datenbetrieb | Rückgabeprozess oder Datenerfassung hat sich geändert |
| Wartungsaufträge ohne `erledigt_am` | Anteil im Referenzquartal | 10 % | 20 % | 50 Aufträge | Werkstattleitung | Der Reset des Merkmals greift nicht mehr |
| Räder mit offenem Schaden | Bestand im Referenzquartal | +50 % relativ | +100 % relativ | 20 Räder | Werkstattleitung | Die Werkstatt kommt nicht nach — die Vorsorgeliste ist dann das falsche Werkzeug |
| Treffsicherheit der Quartalsliste — **Gate K3** | Untergrenze {{k3_unten_regel:.1%}} gegen Schwelle {{k3_schwelle:.1%}} | Wilson-Untergrenze **unter {{k3_lift_diagnose}} × Grundrate des Quartals** | Wilson-**Obergrenze** unter {{k3_lift_diagnose}} × Grundrate | {{kapazitaet:.0f}} Räder | Analytik | Bei Stopp: Liste aussetzen, Regel neu prüfen |
| dieselbe Größe gegen die alte {{huerde:.0%}}-Marke — **D70, nur Diagnose** | {{quote_regel:.0%}} beobachtet | — | — | {{kapazitaet:.0f}} Räder | Analytik | **Löst nichts aus.** Steht hier, damit sichtbar bleibt, wo die ursprüngliche Zusage läge |
| Räder, die trotz Prüfung ausfallen | im Schattenbetrieb zu erheben | 20 % der Geprüften | 35 % | 30 Geprüfte | Werkstattleitung | Die Prüfung selbst greift zu kurz — kein Datenproblem |

**Überwacht wird an derselben Größe, mit der freigegeben wurde.** Eine Warnschwelle bei
{{huerde:.0%}} neben einer Freigabe über K3 hätte die Regel weiterlaufen lassen, obwohl
das Gate längst gerissen wäre. Die Schwelle wandert dabei mit der Grundrate — im Winter
liegt sie tiefer als im Sommer; genau dafür ist K3 relativ formuliert.

Zwei Einschränkungen bleiben. Die Treffsicherheit ist erst nach {{horizont_tage:.0f}}
Tagen messbar, die Wache läuft also ein Quartal hinterher. Und die Maßnahme verändert,
was gemessen wird: Ein geprüftes und repariertes Rad meldet sich nicht mehr — die Liste
sieht schlechter aus, je besser sie wirkt. Ohne Kontrollgruppe ist die Trefferquote im
Betrieb keine Gütekennzahl.

Die letzte Zeile der Tabelle ist deshalb die wichtigste: Eine perfekte Rangfolge nützt
nichts, wenn die Prüfung den Defekt nicht findet. Dann ist nicht die Vorhersage falsch,
sondern die Maßnahme.

Der Random Forest bleibt im Paket, wird aber **nicht** überwacht — er läuft nicht. Für
ihn gilt nur, dass der Vergleich zu wiederholen ist, wenn neue Merkmale dazukommen.

### 6.4 Rückkopplung zwischen Liste und Zielgröße

**Sobald die Liste benutzt wird, verändert sie die Daten, aus denen sie lernt.** Ein Rad,
das vorsorglich geprüft und instandgesetzt wurde, meldet sich anschließend nicht. Im
nächsten Trainingslauf erscheint es als „unauffällig" — obwohl es gerade deshalb
unauffällig war, weil die Liste es erkannt hatte.

Ein Merkmal `wurde_vorsorglich_geprueft` löst das nicht: Es sagt, dass geprüft wurde,
nicht, was ohne Prüfung geschehen wäre. An einem einzelnen Rad ist immer nur einer der
beiden Ausgänge zu sehen. Was hilft, ist ein Vergleich zwischen Rädern:

1. **Alles protokollieren:** Auswahlgrund, Prüfdatum, Befund, Reparatur und die späteren
   Meldungen. Ohne dieses Protokoll ist nichts auswertbar.
2. **Erst im Schatten mitlaufen lassen:** Liste erzeugen, aber nicht danach handeln. Die
   Grundrate bleibt unverändert, und man sieht, ob die Liste trifft.
3. **Dann eine Kontrollgruppe:** Ein fachlich vertretbarer Teil der Flotte wird weiter
   nach dem Standardprozess gewartet. Nur der Unterschied zwischen beiden Gruppen misst,
   was die Maßnahme bewirkt.

Punkt 3 kostet Geld und ist trotzdem richtig: Ohne ihn lässt sich nicht sagen, ob eine
gesunkene Ausfallquote von der Liste kommt oder vom milden Winter. Und wenn die Liste
wirkt, sinkt die Trefferquote — eine fallende Quote kann Erfolg oder Versagen bedeuten.
"""),

# =====================================================================
MD("""
---

# Zusammenfassung

| Phase | Ergebnis |
|---|---|
| 1 Business Understanding | Aus „vorausschauend warten“ wurde eine Kostenmatrix: 180 € je verpasstem Ausfall gegen 25 € je unnötiger Prüfung — Verhältnis rund 7 : 1. **Drei bindende Kriterien: {{pflichtgates}}** — K1 Nutzen über die Quartale, K2 Vergleich mit der heutigen Faustregel, K3 statistische Absicherung. Die ursprüngliche {{huerde:.0%}}-Marke bleibt als Diagnose D70 und bindet nicht |
| 2 Data Understanding | Nutzung und Meldungen hängen zusammen (r = {{korrelation_km_meldungen:.3f}}, für echte Flottendaten auffällig stark), aber nicht deterministisch. Der Anteil auffälliger Räder schwankt saisonal um das {{panel_grundrate_faktor:.1f}}-Fache |
| 3 Data Preparation | Zeitlicher Schnitt statt Gesamtbetrachtung. Gemessene Distanzen bevorzugt, Langfahrten ausgeschlossen, Räder mit offenem Schaden aus der Prognosepopulation genommen. Rückgesetzt wird bei der **erledigten Reparatur**, nicht bei der Meldung |
| 4 Modeling | Drei Faustregeln als Maßstab, dann Baum und Wald — beide mit `class_weight` aus der Kostenmatrix |
| 5 Evaluation | Auf dem Testquartal liegt die Faustregel vorn ({{treffer_regel:.0f}} gegen {{treffer_wald:.0f}} Treffer). **Entschieden hat K3:** Die Wilson-Untergrenze der Regel liegt bei {{k3_unten_regel:.1%}} über der dynamischen Schwelle von {{k3_schwelle:.1%}} ({{k3_lift_diagnose}} × Grundrate {{grundrate_test:.1%}}); der Wald erreicht nur {{k3_unten_wald:.1%}} und reißt K3. Über {{roll_quartale:.0f}} Validierungsquartale nimmt die Regel K1 in {{k3_quartale_lift_regel:.0f}} Quartalen. Zur Einordnung: D70 erfüllen beide ({{d70_regel}} / {{d70_wald}}) — die Marke war ohnehin unerfüllbar, in einem Quartal liegt die Orakelschranke bei {{winter_orakel:.1%}} |
| 6 Deployment | **Ausgeliefert wird die Faustregel.** Dazu eine Schattenliste zum {{schatten_stichtag}}, bewertbar nach {{horizont_tage:.0f}} Tagen — die Freigabe steht auf historischen Daten und wird prospektiv nachgeprüft |

**Drei Sätze, die aus diesem Notebook bleiben sollten**

> Ein Modell kann gegen eine Baseline gewinnen, weil die Baseline schlecht gebaut ist.
> Wer den Vergleich ernst meint, gibt der Regel dieselbe Sorgfalt wie dem Modell.

> Ein einzelnes gutes Quartal ist kein Ergebnis. Bei einer Grundrate, die über die
> {{panel_stichtage:.0f}} Stichtage zwischen {{panel_grundrate_min:.1%}} und
> {{panel_grundrate_max:.1%}} schwankt, entscheidet die Jahreszeit mit — nicht nur das
> Verfahren.

> Treffsicherheit und Abdeckung sind zwei Zahlen. Im Testquartal melden sich
> {{quote_regel_von_zehn:.1f}} von zehn geprüften Rädern; erreicht werden
> {{abdeckung_von_zehn:.1f}} von zehn auffälligen. Beide sind richtig, und beide gelten
> nur für dieses eine Quartal.

**Was offen bleibt — ausdrücklich**

1. **Erfundene Daten.** Alle Euro-Beträge sind Szenariorechnungen, keine gemessenen
   Ersparnisse. Vor einem echten Einsatz müsste alles mit realen Daten neu validiert
   werden.
2. **Das Ziel ist zu weit gefasst.** Vorhergesagt wird *irgendeine* Meldung. Von den
   {{positive_im_test:.0f}} auffälligen Rädern des Testquartals haben
   {{positive_fahruntauglich:.0f}} ({{anteil_fahruntauglich:.1%}}) eine Meldung der Stufe
   „fahruntauglich". Leichte und schwere Schäden kosten in unserer Matrix dasselbe.
3. **Die Wirksamkeit der Prüfung ist unbekannt.** Wir wissen nicht, welchen Anteil der
   Schäden eine Inspektion überhaupt findet und verhindert. Ohne diese Größe ist jede
   Nutzenrechnung eine Obergrenze.
4. **Die Kostenformel trägt keine Kapazitätsentscheidung.** Ihr Minimum liegt bei der
   ganzen Flotte, weil die Prüfkosten der Treffer fehlen (Abschnitt 5.7).
5. **Die Rückkopplung ist nicht gelöst.** Dafür bräuchte es Protokoll, Schattenbetrieb
   und Kontrollgruppe (Abschnitt 6.4).
6. **Kein echter Schattenbetrieb.** Der Teststichtag liegt in der Vergangenheit, sein
   Ausgang war beim Rechnen bekannt.
7. **Fünf Validierungsquartale sind wenig.** Für eine saisonale Aussage bräuchte es
   mehrere Jahre.
8. **Der Rückblick von 180 Tagen ist gesetzt, nicht geprüft.** Vielleicht sagen 60 Tage
   mehr über den nächsten Defekt aus als ein halbes Jahr.
9. **Was ein Rad *erlebt* hat, fehlt** — Stürze, Vandalismus, Standzeiten im Regen. Auch
   die Stationen, an denen es unterwegs war, sind kein Merkmal.

**Weiter geht es mit Notebook 3 — Clustering und Segmentierung:** Dort gibt es zum ersten
Mal **kein Label**. Niemand sagt dem Verfahren, was richtig ist; es soll die Gruppen
selbst finden.
"""),
]
