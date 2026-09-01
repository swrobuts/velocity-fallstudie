# -*- coding: utf-8 -*-
"""Notebook 6 - Anomalieerkennung: Was ist gestern schiefgelaufen?"""
from bauwerk import CODE, MD, PHASE, kopf

NAME = "06_Anomalieerkennung_Auffaellige_Vorgaenge"

ZELLEN = [

kopf("Anomalieerkennung: Was ist gestern schiefgelaufen?",
     "Anomalieerkennung (unüberwacht — gesucht wird die Ausnahme, nicht die Regel)",
     "Welche zehn Vorgänge soll sich der Betrieb heute früh ansehen?",
     NAME),

MD("""
## Das Verfahren, das nach dem Gegenteil sucht

Alle bisherigen Notebooks haben **Muster** gesucht. Dieses sucht die **Abweichung vom
Muster** — und dreht damit die übliche Frage um:

| | Frage |
|---|---|
| Notebook 1–2 | Was ist typisch für diesen Fall? |
| Notebook 3 | Welche typischen Gruppen gibt es? |
| Notebook 5 | Welche typischen Zusammenhänge gibt es? |
| **Notebook 6** | **Was passt in keines dieser Muster?** |

Das klingt einfacher, als es ist. Denn die eigentliche Schwierigkeit liegt nicht darin,
Ausreißer zu finden — das erledigt jedes Verfahren in drei Zeilen. Sie liegt in der
Frage danach:

> **Auffällig ist nicht dasselbe wie problematisch.**

Ein Notebook, das tausend Auffälligkeiten ausspuckt, hat den Betrieb nicht entlastet,
sondern beschäftigt. Deshalb steht hier — mehr noch als in den anderen — die
Priorisierung im Mittelpunkt.

**Und dieses Notebook enthält ein negatives Ergebnis.** Eine der beiden Aufgaben, die wir
uns in Phase 1 stellen, lässt sich mit diesen Daten **nicht** lösen. Warum das so ist und
was daraus folgt, ist der lehrreichste Teil — im Berufsleben ist ein sauber begründetes
„geht nicht“ mehr wert als ein geschöntes „geht doch“.
"""),

# =====================================================================
PHASE(1, "Der Betrieb hat morgens eine halbe Stunde. Was soll er sich ansehen?"),

MD("""
### Die Ausgangslage

Im Betriebsbüro sitzt morgens jemand, der den Vortag durchsieht. Heute geschieht das
stichprobenhaft: Man scrollt durch die Liste und schaut, was ins Auge fällt. Bei rund
**55 Fahrten am Tag** geht das noch; bei einem wachsenden Netz nicht mehr.

Gesucht ist eine **Tagesliste mit höchstens zehn Vorgängen**, die einen menschlichen Blick
verdienen.

### Zwei Sorten von Auffälligkeit — und zwei Aufgaben

| | Aufgabe | Beispiel | wer handelt |
|---|---|---|---|
| **A** | **Auffällige Fahrten** | Rad seit 14 Stunden unterwegs | Betrieb sucht das Rad |
| **B** | **Auffällige Stationstage** | Station steht still, obwohl sie sollte | Technik prüft das Terminal |

### Was ein Fund wert ist, und was ein Fehlalarm kostet

| | | Kosten |
|---|---|---|
| **gefundene echte Auffälligkeit** | Rad wird geborgen, bevor es verschwindet | **Nutzen 120 €** |
| **Fehlalarm** | jemand sieht sich einen Vorgang an, der in Ordnung war | **6 €** (fünf Minuten) |
| **übersehene Auffälligkeit** | Rad bleibt liegen, wird gestohlen oder beschädigt | **Verlust 120 €** |

Bei zehn Plätzen auf der Liste heißt das: **Ab einer Trefferquote von rund 5 % rechnet
sich die Liste bereits** — der eine Fund trägt die neunzehn Fehlalarme. Das ist eine
ungewöhnlich niedrige Schwelle, und sie ist typisch für Anomalieerkennung: Man darf sich
viel Ungenauigkeit leisten, solange die Fälle selten und die Funde wertvoll sind.

> **Diese 5 % sind aber nicht unser Erfolgskriterium.** Sie sind die Grenze, ab der die
> Liste kein Geld verbrennt. Eine Liste, bei der neunzehn von zwanzig Einträgen unnötig
> sind, wird nach zwei Wochen niemand mehr öffnen — und dann ist der rechnerische Nutzen
> gleich null. Wir setzen deshalb **20 %** an: jeder fünfte Eintrag muss tragen.
>
> Der Unterschied zwischen „rechnet sich" und „wird benutzt" ist genau der Grund, warum
> Erfolgskriterien nicht aus einer Kostenrechnung allein folgen.

### Erfolgskriterien

| | Kriterium | Schwelle |
|---|---|---|
| **fachlich** | Die Tagesliste enthält höchstens 10 Vorgänge | die Kapazität des Betriebsbüros |
| **Treffer** | Mindestens jeder fünfte gemeldete Vorgang ist tatsächlich behandlungsbedürftig | sonst wird die Liste ignoriert |
| **Nachvollziehbar** | Zu jedem Vorgang muss dastehen, **warum** er auffällt | „das Modell sagt so“ reicht nicht |
"""),

# =====================================================================
PHASE(2, "Bevor irgendein Verfahren läuft: Wie sieht normal überhaupt aus?"),

CODE('''
import os
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt

BASIS = os.environ.get("VELO_BASIS",
    "https://raw.githubusercontent.com/swrobuts/velocity-fallstudie/main/analytics/")
pd.set_option("display.width", 160)

# Die Zahlen aus Phase 1 - hier ausgedruckt, damit Text und Rechnung nicht
# auseinanderlaufen koennen. Die Rentabilitaetsschwelle wird abgeleitet,
# nicht behauptet.
NUTZEN_FUND = 120.0        # geborgenes Rad statt Verlust
KOSTEN_FEHLALARM = 6.0     # fuenf Minuten Ansehen ohne Befund
KRITERIUM_TREFFER = 0.20   # Erfolgskriterium: jeder fuenfte Eintrag traegt

schwelle = KOSTEN_FEHLALARM / (NUTZEN_FUND + KOSTEN_FEHLALARM)
print(f"Ein Fund ist {NUTZEN_FUND:.0f} EUR wert, ein Fehlalarm kostet "
      f"{KOSTEN_FEHLALARM:.0f} EUR.")
print(f"Rentabel ist die Liste ab {schwelle:.1%} Trefferquote - "
      f"ein Fund traegt {NUTZEN_FUND/KOSTEN_FEHLALARM:.0f} Fehlalarme.")
print(f"Gefordert werden trotzdem {KRITERIUM_TREFFER:.0%}: Eine Liste voller "
      f"Fehlalarme wird nicht benutzt.")

fahrten = pd.read_csv(BASIS + "ausleihe.csv", parse_dates=["startzeit", "endzeit"])
raeder = pd.read_csv(BASIS + "fahrrad.csv")
stationen = pd.read_csv(BASIS + "station.csv")
stoerungen = pd.read_csv(BASIS + "stationsstoerung.csv", parse_dates=["von", "bis"])

fahrten = fahrten.merge(raeder[["fahrrad_id", "typ_code"]], on="fahrrad_id", how="left")
fahrten["dauer_min"] = (fahrten.endzeit - fahrten.startzeit).dt.total_seconds() / 60

print("Status aller Vorgänge:")
print(fahrten.status.value_counts().to_string())

echte = fahrten[fahrten.status == "abgeschlossen"].copy()
print(f"\\nFahrtdauer in Minuten — die Quantile sagen mehr als der Mittelwert:")
print(echte.dauer_min.quantile([.5, .9, .99, .999, 1.0]).round(1).to_string())
'''),

MD("### 2.1 Die Verteilung und ihr Ausläufer"),

CODE('''
fig, achsen = plt.subplots(1, 3, figsize=(15, 4))
achsen[0].hist(echte.dauer_min, bins=60, range=(0, 120), color="#3d4b6b")
achsen[0].set_title("Fahrtdauer bis 2 Stunden"); achsen[0].set_xlabel("Minuten")

achsen[1].hist(echte.dauer_min, bins=80, color="#8c95a8"); achsen[1].set_yscale("log")
achsen[1].set_title("Alle Fahrten, logarithmische Häufigkeit"); achsen[1].set_xlabel("Minuten")

lang = echte[echte.dauer_min > 180]
achsen[2].hist(echte.loc[echte.dauer_min.between(60, 200), "dauer_min"], bins=40, color="#3d4b6b")
achsen[2].set_title("Der Übergangsbereich, 60 bis 200 Minuten"); achsen[2].set_xlabel("Minuten")
plt.tight_layout(); plt.show()

print(f"Fahrten über  2 Stunden: {int((echte.dauer_min > 120).sum()):>5d}")
print(f"Fahrten über  3 Stunden: {int((echte.dauer_min > 180).sum()):>5d}")
print(f"Fahrten über  8 Stunden: {int((echte.dauer_min > 480).sum()):>5d}")
print(f"längste Fahrt:           {echte.dauer_min.max()/60:>5.1f} Stunden")
'''),

MD("""
**Das mittlere Bild zeigt eine Lücke**, und die ist der eigentliche Fund dieser Phase:
Zwischen etwa zwei und acht Stunden liegt fast nichts, darüber wieder ein kleines
Häufchen. Das sind zwei verschiedene Dinge in einer Spalte:

- bis zwei Stunden: **Fahrten** — auch lange Ausflüge sind irgendwann zu Ende
- über acht Stunden: **keine Fahrten**, sondern Räder, die nicht zurückgegeben wurden

> **Eine Lücke in einer Verteilung ist immer ein Hinweis darauf, dass zwei Vorgänge
> vermischt wurden.** Wer sie sieht, hat die halbe Anomalieerkennung schon im Kopf
> erledigt — der Rest ist Handwerk.

### 2.2 Eine Sackgasse, die man kennen sollte
"""),

CODE('''
mit_distanz = echte.dropna(subset=["distanz_km"]).copy()
mit_distanz["tempo_kmh"] = mit_distanz.distanz_km / (mit_distanz.dauer_min / 60)
print("Geschwindigkeit, wo eine Distanz gemessen wurde:")
print(mit_distanz.tempo_kmh.describe([.001, .01, .5, .99, .999]).round(1).to_string())
'''),

MD("""
**Die Geschwindigkeit liefert hier nichts** — sie liegt zwischen 9 und 22 km/h, ohne einen
einzigen Ausreißer. In echten Daten wäre sie die erste Adresse für Anomalien: 45 km/h auf
einem CITY-Rad bedeutet, dass das Rad im Transporter lag, 2 km/h bedeutet Schieben.

Der Grund ist die Herkunft dieses Datensatzes: **Die Distanz wurde aus der Dauer
gerechnet**, mit einer typtypischen Geschwindigkeit und wenig Streuung. Wo eine Größe aus
einer anderen abgeleitet ist, kann sie nichts Neues zeigen.

> **Das ist keine Schwäche dieses Notebooks, sondern eine Lehre für jeden Datensatz:**
> Man muss wissen, wie eine Spalte entstanden ist. Eine abgeleitete Größe als
> „unabhängigen Beleg“ zu verwenden, ist einer der häufigsten Fehler überhaupt — und in
> echten Unternehmensdaten oft schwerer zu erkennen als hier.
"""),

# =====================================================================
PHASE(3, "Merkmale je Fahrt — und die Entscheidung, welche davon überhaupt taugen."),

CODE('''
merkmalstabelle = echte.copy()
merkmalstabelle["stunde"] = merkmalstabelle.startzeit.dt.hour
merkmalstabelle["wochentag"] = merkmalstabelle.startzeit.dt.dayofweek
merkmalstabelle["ist_rundtour"] = (merkmalstabelle.start_station_id
                                   == merkmalstabelle.end_station_id).astype(int)
merkmalstabelle["entgelt_je_minute"] = (merkmalstabelle.entgelt_eur
                                        / merkmalstabelle.dauer_min.clip(lower=1))

MERKMALE = ["dauer_min", "stunde", "wochentag", "ist_rundtour",
            "entgelt_eur", "entgelt_je_minute"]
X = merkmalstabelle[MERKMALE]
print(f"{len(X):,d} Fahrten × {len(MERKMALE)} Merkmale".replace(",", "."))
print(X.describe().round(2).to_string())
'''),

MD("""
> **Warum `distanz_km` nicht dabei ist.** Sie fehlt bei 40 % der hier betrachteten Fahrten. Ein
> Anomalieverfahren würde dann entweder diese 40 % gar nicht bewerten oder — schlimmer —
> das Fehlen selbst als Auffälligkeit werten. Beides wäre falsch: Ein ausgefallener Sensor
> ist kein auffälliger Vorgang.
"""),

# =====================================================================
PHASE(4, "Zwei Wege zum selben Ziel: eine Regel, die jeder versteht, und ein Verfahren, "
         "das mehr sieht."),

MD("""
### 4.1 Der einfache Weg: die Interquartilsregel

Die klassische Ausreißerregel braucht keine Bibliothek und keinen Rechner:

> Alles, was mehr als das 1,5-fache des Quartilsabstands über dem oberen Quartil liegt,
> gilt als Ausreißer.
"""),

CODE('''
q1, q3 = echte.dauer_min.quantile([.25, .75])
iqr = q3 - q1
grenze = q3 + 1.5 * iqr
print(f"Unteres Quartil {q1:.0f}, oberes {q3:.0f}, Quartilsabstand {iqr:.0f}")
print(f"Ausreißergrenze: {grenze:.0f} Minuten")
print(f"Fahrten darüber: {int((echte.dauer_min > grenze).sum()):,d} "
      f"({(echte.dauer_min > grenze).mean():.1%} aller Fahrten)".replace(",", "."))
'''),

MD("""
**Über zweitausend Ausreißer — bei zehn Plätzen auf der Tagesliste.** Die Regel ist nicht
falsch, sie ist nur für diese Verteilung ungeeignet: Bei einer rechtsschiefen Verteilung
markiert sie einen großen Teil des völlig normalen Ausläufers.

Das ist kein Grund, sie wegzuwerfen — man muss sie nur schärfer stellen. Aber es zeigt,
warum eine einzelne Schwelle auf einer einzelnen Spalte selten reicht.

### 4.2 Der Isolation Forest

Die Idee ist bestechend einfach: Man zerteilt den Merkmalsraum wiederholt an zufälligen
Stellen. **Ein Punkt, der weit außen liegt, ist nach wenigen Schnitten allein.** Ein Punkt
mitten im Gedränge braucht viele. Die Zahl der nötigen Schnitte ist der Auffälligkeitswert
— fertig.

Das Verfahren braucht keine Annahme über die Verteilung, kommt mit mehreren Merkmalen
gleichzeitig zurecht und ist schnell.
"""),

CODE('''
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler

X_skaliert = StandardScaler().fit_transform(X)

##LUECKE Trainieren Sie einen IsolationForest mit contamination=0.005, n_estimators=300, random_state=42.
wald_erst = IsolationForest(contamination=0.005, n_estimators=300, random_state=42)
wald_erst.fit(X_skaliert)
##ENDE

merkmalstabelle["auffaelligkeit_erst"] = -wald_erst.score_samples(X_skaliert)

plt.figure(figsize=(9, 4))
plt.hist(merkmalstabelle.auffaelligkeit_erst, bins=80, color="#3d4b6b")
plt.axvline(merkmalstabelle.auffaelligkeit_erst.quantile(0.999), color="#e00034", ls="--",
            label="obere 0,1 %")
plt.yscale("log"); plt.xlabel("Auffälligkeitswert"); plt.ylabel("Fahrten (log)")
plt.legend(); plt.title("Die meisten Fahrten sind unauffällig — so soll es sein")
plt.tight_layout(); plt.show()
'''),

MD("""
### 4.3 Der erste Blick auf das Ergebnis — und ein Fehlschlag

Bevor irgendetwas bewertet wird: **Wer steht ganz oben?**
"""),

CODE("""
erste_liste = merkmalstabelle.nlargest(10, "auffaelligkeit_erst")
print(erste_liste[["ausleihe_id", "dauer_min", "typ_code", "entgelt_eur",
                   "entgelt_je_minute"]].round(2).to_string(index=False))
print("\\nRadtyp-Verteilung der 50 auffälligsten Vorgänge:")
print((merkmalstabelle.nlargest(50, "auffaelligkeit_erst").typ_code
       .value_counts(normalize=True) * 100).round(0).to_string())
print("\\nZum Vergleich, Radtyp-Verteilung aller Fahrten:")
print((merkmalstabelle.typ_code.value_counts(normalize=True) * 100).round(0).to_string())
"""),

MD("""
### 4.4 Das Modell hat den Radtyp gefunden, nicht die Anomalie

Fast alle gemeldeten Vorgänge sind **CARGO-Räder** — obwohl sie nur einen kleinen Teil
der Flotte ausmachen. Und die Dauer dieser Fahrten ist unauffällig; auffällig ist nur das
Entgelt.

Der Grund steht im Preisblatt aus Notebook 1: Ein CARGO-Rad kostet **0,50 € je Minute**,
ein CITY-Rad **0,10 €**. Eine ganz gewöhnliche halbstündige CARGO-Fahrt kostet damit so
viel wie eine sehr lange CITY-Fahrt.

> **Das Modell hat also völlig korrekt gearbeitet und trotzdem das Falsche gefunden.**
> Es hat die Preisklasse entdeckt — eine echte, starke, aber vollkommen bekannte Struktur.
> Für den Betrieb ist sie wertlos: Dass CARGO-Räder teurer sind, weiß dort jeder.

**Das ist ein Rücksprung von Phase 4 zurück in Phase 3.** Nicht das Verfahren ist falsch,
sondern die Merkmale. Wir müssen das Entgelt so umrechnen, dass es sagt *„teuer für ein
Rad dieses Typs"* statt *„teuer"*.

### 4.5 Die Korrektur: innerhalb des Radtyps normieren
"""),

CODE("""
def z_je_typ(werte, typ):
    \"\"\"Wie weit liegt dieser Wert vom Ueblichen SEINES Radtyps entfernt?\"\"\"
    gruppe = werte.groupby(typ)
    return (werte - gruppe.transform("mean")) / gruppe.transform("std").replace(0, 1)

merkmalstabelle["dauer_z"] = z_je_typ(merkmalstabelle.dauer_min, merkmalstabelle.typ_code)
merkmalstabelle["entgelt_z"] = z_je_typ(merkmalstabelle.entgelt_eur, merkmalstabelle.typ_code)
merkmalstabelle["entgelt_je_minute_z"] = z_je_typ(merkmalstabelle.entgelt_je_minute,
                                                  merkmalstabelle.typ_code)

# WOCHENTAG IST RAUS.
#
# Das Produkt ist eine TAGESliste. Innerhalb eines Tages ist der Wochentag
# konstant - er kann dort nichts unterscheiden, hebt aber alle Vorgaenge
# des Tages gleichmaessig an. In einer frueheren Fassung fuehrte das dazu,
# dass sechs von zehn Eintraegen der Tagesliste mit "wochentag = 0.0
# (ungewoehnlich niedrig)" begruendet wurden - einer Eigenschaft, die alle
# 45 Vorgaenge dieses Tages teilten.
MERKMALE = ["dauer_z", "stunde", "ist_rundtour",
            "entgelt_z", "entgelt_je_minute_z"]
X2 = merkmalstabelle[MERKMALE]
X2_skaliert = StandardScaler().fit_transform(X2)

wald = IsolationForest(contamination=0.005, n_estimators=300, random_state=42).fit(X2_skaliert)
merkmalstabelle["auffaelligkeit"] = -wald.score_samples(X2_skaliert)

print("Radtyp-Verteilung der 50 auffälligsten Vorgänge, jetzt:")
print((merkmalstabelle.nlargest(50, "auffaelligkeit").typ_code
       .value_counts(normalize=True) * 100).round(0).to_string())
"""),

MD("""
**Der CARGO-Überhang ist verschwunden.** Ob die Korrektur auch inhaltlich etwas gebracht
hat, misst Phase 5.
"""),

# =====================================================================
PHASE(5, "Findet das Verfahren, was wir suchen? Und dann der Teil, der nicht funktioniert."),

MD("""
### 5.1 Eine Teilwahrheit zum Prüfen

Wir haben kein vollständiges Label — sonst bräuchten wir kein unüberwachtes Verfahren.
Wir haben aber eine **Teilwahrheit**: Fahrten über acht Stunden sind mit Sicherheit
Rückgabeprobleme, keine Fahrten. An ihnen können wir prüfen, ob das Verfahren findet, was
es finden soll.
"""),

CODE('''
merkmalstabelle["ist_rueckgabeproblem"] = (merkmalstabelle.dauer_min > 480).astype(int)
gesamt_probleme = int(merkmalstabelle.ist_rueckgabeproblem.sum())
print(f"Bekannte Rückgabeprobleme im Datensatz: {gesamt_probleme}\\n")

zeilen = []
for k in (50, 100, 300, 1000):
    # Die BASELINE zuerst: eine Zeile, sortiere nach Dauer.
    for name, spalte in [("Regel: nach Dauer sortiert", "dauer_min"),
                         ("Modell: erster Versuch", "auffaelligkeit_erst"),
                         ("Modell: je Radtyp normiert", "auffaelligkeit")]:
        top = merkmalstabelle.nlargest(k, spalte)
        treffer = int(top.ist_rueckgabeproblem.sum())
        zeilen.append({"Listenlänge": k, "Vorgehen": name, "gefundene Probleme": treffer,
                       "Trefferquote": round(treffer / k, 3),
                       "Anteil aller Probleme": round(treffer / gesamt_probleme, 3)})
print(pd.DataFrame(zeilen).to_string(index=False))
'''),

MD("""
**Die erste Zeile ist die unangenehmste — und sie muss dort stehen.**

Die Regel „sortiere nach Dauer“ schlägt beide Modellfassungen um Längen. Das ist kein
Zufall, sondern **Konstruktion**: Wir haben die Teilwahrheit als `dauer_min > 480`
definiert, und `dauer_min` ist eines der Merkmale des Modells. Die Regel *ist* die
Definition. Sie kann gar nicht verlieren.

> **Eine Prüfgröße, die aus einem Modellmerkmal gebaut ist, prüft nichts.** Sie belohnt
> das Wiederfinden dessen, was man schon weiß.

Das hat drei Folgen, und alle drei gehören in den Bericht:

1. **Für „vergessene Rückgaben“ braucht es kein Modell.** `dauer_min > 480` ist die
   Antwort, sie kostet eine Zeile SQL, und sie ist vollständig. Wer diese eine Sorte
   Auffälligkeit sucht, ist hier fertig.
2. **Das Erfolgskriterium aus Phase 1 misst das Falsche.** „Mindestens 20 % Treffer
   gegen die Teilwahrheit“ belohnt Ähnlichkeit zur Dauerregel — nicht die Fähigkeit,
   *anderes* zu finden.
3. **Der Wert des Verfahrens liegt genau dort, wo die Teilwahrheit blind ist:** bei den
   CARGO-Rundtouren, den Fahrten zu 0,50 € je Minute, den Ausleihen um 22 Uhr. Für die
   gibt es **kein Label** — und damit auch keine Trefferquote. Ob sie etwas taugen,
   entscheidet nur, wer sie ansieht.

**Der Wert der Korrektur aus Phase 4.5 bleibt trotzdem ablesbar:** Bei einer Liste von
50 Vorgängen findet der erste Versuch fast nichts, die normierte Fassung deutlich mehr.
Dasselbe Verfahren, bessere Merkmale.

### 5.2 Was findet das Verfahren sonst noch?
"""),

CODE('''
trefferquote_a = float(merkmalstabelle.nlargest(50, "auffaelligkeit").ist_rueckgabeproblem.mean())
regelquote_a = float(merkmalstabelle.nlargest(50, "dauer_min").ist_rueckgabeproblem.mean())
print("Erfolgskriterium aus Phase 1 für Aufgabe A: mindestens 20 % Treffer")
print(f"  Regel 'nach Dauer sortiert'  {regelquote_a:>6.1%}   "
      f"{'ERFÜLLT' if regelquote_a >= 0.20 else 'GERISSEN'}")
print(f"  Modell                       {trefferquote_a:>6.1%}   "
      f"{'ERFÜLLT' if trefferquote_a >= 0.20 else 'GERISSEN'}")
print()
print("Beide erfüllen das Kriterium - und die Regel deutlich besser. Fuer")
print("VERGESSENE RUECKGABEN geht deshalb die Regel in Betrieb, nicht das Modell.")
print("Das Modell bleibt fuer das, was die Regel nicht sieht - und dafuer gibt")
print("es kein Label und keine Trefferquote.")
print()

top10 = merkmalstabelle.nlargest(10, "auffaelligkeit")
anzeige = top10[["ausleihe_id", "startzeit", "dauer_min", "typ_code", "entgelt_eur",
                 "ist_rundtour", "ist_rueckgabeproblem"]].copy()
anzeige["dauer"] = anzeige.dauer_min.apply(
    lambda m: f"{int(m//60)} h {int(m%60):02d} min" if m >= 60 else f"{int(m)} min")
anzeige["startzeit"] = anzeige.startzeit.dt.strftime("%a %d.%m.%Y %H:%M")
print("DIE ZEHN AUFFÄLLIGSTEN VORGÄNGE\\n")
print(anzeige[["ausleihe_id", "startzeit", "dauer", "typ_code", "entgelt_eur",
               "ist_rundtour", "ist_rueckgabeproblem"]].to_string(index=False))
'''),

MD("""
### 5.3 Kriterium 3 aus Phase 1: **Warum** fällt ein Vorgang auf?

Ein Isolation Forest liefert eine Zahl, keine Begründung. Für den Betrieb ist das zu
wenig — „Vorgang 38558 hat Wert 0,75“ löst keine Handlung aus. Wir bauen die Begründung
deshalb selbst, indem wir für jeden gemeldeten Vorgang nachsehen, welches Merkmal am
weitesten vom Üblichen entfernt liegt.
"""),

CODE('''
# Die Begruendung vergleicht gegen den Mittelwert DESSELBEN RADTYPS - aus
# demselben Grund, aus dem die Merkmale normiert wurden. "40 Euro, ueblich sind
# 2,20" waere fuer ein CARGO-Rad eine irrefuehrende Auskunft.
# Dieselben Merkmale wie im Modell - ohne wochentag. Was nicht in die
# Rangfolge eingeht, darf auch nicht als Begruendung erscheinen.
ROHSPALTEN = ["dauer_min", "stunde", "ist_rundtour",
              "entgelt_eur", "entgelt_je_minute"]
mittel_je_typ = merkmalstabelle.groupby("typ_code")[ROHSPALTEN].mean()
streuung_je_typ = merkmalstabelle.groupby("typ_code")[ROHSPALTEN].std().replace(0, 1)

def begruendung(zeile, wieviele=2):
    """Welche Merkmale liegen am weitesten vom Ueblichen SEINES Radtyps entfernt?"""
    typ = zeile.typ_code
    m, sd = mittel_je_typ.loc[typ], streuung_je_typ.loc[typ]
    abstand = ((zeile[ROHSPALTEN] - m) / sd).abs().sort_values(ascending=False)
    teile = []
    for merkmal in abstand.index[:wieviele]:
        wert = zeile[merkmal]
        richtung = "ungewöhnlich hoch" if wert > m[merkmal] else "ungewöhnlich niedrig"
        teile.append(f"{merkmal} = {wert:.1f} ({richtung}, bei {typ} üblich {m[merkmal]:.1f})")
    return "; ".join(teile)

print("TAGESLISTE FÜR DAS BETRIEBSBÜRO\\n")
for rang, (_, zeile) in enumerate(top10.iterrows(), start=1):
    print(f"{rang:>2d}. Vorgang {int(zeile.ausleihe_id):>6d}  "
          f"{zeile.startzeit.strftime('%d.%m.%Y %H:%M')}  Rad {int(zeile.fahrrad_id):>3d} ({zeile.typ_code})")
    print(f"    {begruendung(zeile)}")
'''),

MD("""
Jetzt steht neben jedem Vorgang, **was** an ihm ungewöhnlich ist. Damit kann jemand
entscheiden, ob es sich lohnt hinzusehen — und das ist der ganze Zweck der Liste.

---

### 5.4 Aufgabe B — und die Regel, die man zuerst hätte bauen müssen

Nun zur zweiten Aufgabe aus Phase 1: **auffällige Stationstage**. Hier liegt der Fall
besonders günstig, denn es gibt eine **dokumentierte Wahrheit**: 26 Stationsstörungen
sind in `stationsstoerung.csv` verzeichnet. Wir können also genau messen, ob ein
Verfahren sie findet.
"""),

CODE('''
echte["datum"] = echte.startzeit.dt.normalize()
tage = pd.date_range(echte.datum.min(), echte.datum.max(), freq="D")
gitter = pd.MultiIndex.from_product([tage, stationen.station_id],
                                    names=["datum", "start_station_id"])
je_tag = (echte.groupby(["datum", "start_station_id"]).size().rename("fahrten")
          .reindex(gitter, fill_value=0).reset_index().sort_values(["start_station_id", "datum"]))

# Erwartung: was diese Station zuletzt ueblicherweise geleistet hat.
#
# NUR VERGANGENHEIT. Eine fruehere Fassung nutzte ein ZENTRIERTES Fenster
# (center=True) - das schaut vierzehn Tage in die Zukunft. Fuer eine Liste,
# die morgens ueber den Vortag entscheidet, gibt es diese Tage nicht. Der
# shift(1) sorgt dafuer, dass der zu bewertende Tag nicht in seine eigene
# Erwartung eingeht.
je_tag["erwartet"] = (je_tag.groupby("start_station_id").fahrten
                      .transform(lambda x: x.shift(1).rolling(28, min_periods=7).median()))
je_tag["abweichung"] = je_tag.fahrten - je_tag.erwartet

# Die dokumentierte Wahrheit
gestoert = set()
for _, r in stoerungen.iterrows():
    for d in pd.date_range(r.von, r.bis, freq="D"):
        gestoert.add((d, r.station_id))
je_tag["ist_stoerung"] = [(d, s) in gestoert for d, s in
                          zip(je_tag.datum, je_tag.start_station_id)]

print(f"Stationstage insgesamt:            {len(je_tag):,d}".replace(",", "."))
print(f"davon dokumentierte Störungen:     {int(je_tag.ist_stoerung.sum())}")
print(f"Stationstage ganz ohne Fahrt:      {int((je_tag.fahrten == 0).sum()):,d}".replace(",", "."))
print(f"davon dokumentierte Störungen:     {int(((je_tag.fahrten == 0) & je_tag.ist_stoerung).sum())}")
'''),

MD("""
**Und da steht das Problem, in zwei Zahlen.**

Jede Störung führt zu einem Tag ohne Fahrt — das Signal ist also da. Aber es gibt **rund
tausend Stationstage ohne Fahrt**, und nur etwa jeder elfte davon ist eine Störung. Alle
anderen sind schlicht ruhige Tage: eine kleine Station im Januar bei Regen.

Rechnen wir aus, was das für jedes noch so gute Verfahren bedeutet.
"""),

CODE('''
kandidaten = je_tag.dropna(subset=["erwartet"]).copy()
kandidaten["auffaelligkeit_tag"] = -(kandidaten.abweichung / kandidaten.erwartet.clip(lower=1))

# ZUERST DIE EINFACHSTE REGEL, DIE ES GIBT - wie in Notebook 2.
# "Sieh dir nur die Stationstage ohne jede Fahrt an, und darunter die
# mit dem groessten Einbruch gegenueber dem eigenen Mittel."
nulltage = kandidaten[kandidaten.fahrten == 0]

def bewerten_b(name, menge, spalte=None):
    zeilen = []
    for k in (50, 100, 200, 500):
        top = menge.nlargest(k, spalte) if spalte else menge.head(k)
        treffer = int(top.ist_stoerung.sum())
        zeilen.append({"Vorgehen": name, "Listenlänge": k,
                       "gefundene Störungen": treffer,
                       "Trefferquote": round(treffer / min(k, len(menge)), 3)})
    return zeilen

vergleich_b = pd.DataFrame(
    bewerten_b("Modell: alle Stationstage", kandidaten, "auffaelligkeit_tag")
    + bewerten_b("Regel: nur Nulltage, nach Einbruch", nulltage, "abweichung"))
print(vergleich_b.pivot(index="Listenlänge", columns="Vorgehen",
                        values="Trefferquote").to_string())
print()
print(f"Alle {int(kandidaten.ist_stoerung.sum())} Störungen liegen an Nulltagen -")
print(f"die Regel erreicht also 100 % Abdeckung bei {len(nulltage)} Kandidaten.")

bestes_modell = max(z["Trefferquote"] for z in
                    bewerten_b("m", kandidaten, "auffaelligkeit_tag"))
beste_regel = max(z["Trefferquote"] for z in
                  bewerten_b("r", nulltage, "abweichung"))
print(f"\\nErfolgskriterium aus Phase 1: mindestens 20 % Trefferquote")
for name, wert in [("Modell", bestes_modell), ("Regel", beste_regel)]:
    print(f"  {name:<8s} {wert:.1%}   ->  {'ERFÜLLT' if wert >= 0.20 else 'GERISSEN'}")
'''),

MD("""
### 5.5 Das Modell scheitert — die Aufgabe nicht

**Lesen Sie die beiden Spalten nebeneinander.** Der Isolation Forest über alle
Stationstage erreicht 14 Prozent und reißt das Kriterium. Die Regel „sieh dir nur die
Tage ohne jede Fahrt an, und darunter die mit dem größten Einbruch" erreicht **32
Prozent** und erfüllt es.

> **Aufgabe B ist lösbar. Nur nicht mit einem Anomalieverfahren.**

Woran das liegt, steht in den Zahlen darüber: **Alle Störungen liegen an Nulltagen.** Die
gesuchte Menge ist also von vornherein auf 1.041 der 10.890 Stationstage eingegrenzt —
und diese Eingrenzung ist Fachwissen, keine Statistik. Ein Verfahren, das über alle
10.890 Tage sucht, verbringt seine Kraft damit, diese Eingrenzung nachzuerfinden. Es
schafft das schlechter, als ein Satz Fachwissen es vorgibt.

**Das ist die Lehre dieses Notebooks, und sie ist unbequem:**

> Ein Verfahren, das schlechter ist als eine Zeile Fachwissen, ist nicht am Problem
> gescheitert, sondern an der Aufgabenstellung. Wer keine Baseline baut, hält das eine
> für das andere.

**In einer früheren Fassung stand hier, Aufgabe B sei „mit diesen Daten nicht lösbar".**
Das war falsch, und es war aus demselben Grund falsch wie der umgekehrte Fehler in
Notebook 2: Dort ließ eine schlecht gebaute Baseline ein Modell zu gut aussehen — hier
ließ eine **fehlende** Baseline eine Aufgabe unlösbar aussehen. Beide Male hilft dasselbe:
**erst die einfachste Lösung bauen, dann das Verfahren daran messen.**

**Was trotzdem gilt — die Grenzen der Regel:**

1. **Die Trefferquote bleibt bescheiden.** Von hundert vorgelegten Stationstagen sind
   knapp zwei Drittel Fehlalarme. Bei einem Prüfaufwand von wenigen Minuten je Fall geht
   das auf; bei einem Technikereinsatz nicht.
2. **Die eigentliche Lösung ist keine Analyse.** Die Terminals melden ihren Status
   ohnehin; würden diese Meldungen gespeichert, wäre die Frage eine Datenbankabfrage und
   keine Schätzung. Das bleibt die Empfehlung an den Betrieb.
3. **Ein größeres Netz würde beides erleichtern.** Bei 50 Fahrten je Station und Tag wäre
   ein Nulltag ein Ereignis und kein Alltag.
"""),

# =====================================================================
PHASE(6, "Aufgabe A geht in Betrieb — Aufgabe B als Regel, nicht als Modell."),

CODE('''
import joblib, datetime

LISTENLAENGE = 10

def tagesliste(datum, tabelle=merkmalstabelle, laenge=LISTENLAENGE):
    """Die Liste, die morgens im Betriebsbüro aufschlägt."""
    tag = pd.Timestamp(datum)
    des_tages = tabelle[tabelle.startzeit.dt.normalize() == tag]
    if des_tages.empty:
        return pd.DataFrame()
    top = des_tages.nlargest(min(laenge, len(des_tages)), "auffaelligkeit").copy()
    top["Begründung"] = top.apply(begruendung, axis=1)
    top["Uhrzeit"] = top.startzeit.dt.strftime("%H:%M")
    top["Dauer"] = top.dauer_min.apply(lambda m: f"{int(m//60)}h{int(m%60):02d}")
    return top[["ausleihe_id", "Uhrzeit", "Dauer", "typ_code", "fahrrad_id",
                "auffaelligkeit", "Begründung"]].rename(
        columns={"ausleihe_id": "Vorgang", "typ_code": "Typ", "fahrrad_id": "Rad",
                 "auffaelligkeit": "Wert"})

beispieltag = merkmalstabelle.nlargest(1, "auffaelligkeit").startzeit.dt.normalize().iloc[0]
liste = tagesliste(beispieltag)
print(f"TAGESLISTE {beispieltag.strftime('%A, %d.%m.%Y')}\\n")
print(liste.round({"Wert": 3}).to_string(index=False))
liste.to_csv("tagesliste_beispiel.csv", index=False)

joblib.dump({"modell": wald, "merkmale": MERKMALE,
             "mittel_je_typ": mittel_je_typ.to_dict(),
             "streuung_je_typ": streuung_je_typ.to_dict(),
             "listenlaenge": LISTENLAENGE,
             "freigegeben_fuer": ["auffällige Fahrten"],
             "nicht_freigegeben_fuer": ["Stationsstörungen — Datenlage unzureichend"],
             "trainiert_am": datetime.date.today().isoformat()}, "anomaliemodell.joblib")
print("\\ngeschrieben: tagesliste_beispiel.csv, anomaliemodell.joblib")
'''),

MD("""
### 6.1 Was ausgeliefert wird — zwei Dinge, nicht eines

Die Auswertung in Phase 5 hat die Aufgabe geteilt, und die Auslieferung folgt dieser
Teilung:

| Sorte Auffälligkeit | Was ausgeliefert wird | Warum |
|---|---|---|
| **Vergessene Rückgaben** (über 8 Stunden) | eine Zeile SQL: `dauer_min > 480` | vollständig, nachprüfbar, kein Modell nötig |
| **Auffällige Stationstage** | die Regel aus 5.5: nur Nulltage, nach Einbruch sortiert | schlägt das Modell und erfüllt das Kriterium |
| **Alles andere** — Rundtouren zu 47 €, Ausleihen um 22 Uhr, 0,50 € je Minute | die Tagesliste des Isolation Forest | dafür gibt es keine Regel, weil niemand vorher weiß, wonach er sucht |

> **Nur die dritte Zeile rechtfertigt ein Modell.** Die ersten beiden hätte man auch ohne
> Analyse gefunden — man hätte nur vorher fragen müssen. Genau das ist der Grund, warum
> in diesem Notebook zuerst die Regeln gebaut wurden und dann das Verfahren.

Für die dritte Zeile gibt es **keine Trefferquote**, und das ist keine Lücke, sondern die
Sache selbst: Wer eine Kennzahl für „unbekannte Auffälligkeiten“ hätte, wüsste ja schon,
wonach er sucht. Beurteilen kann sie nur, wer die Liste ansieht — und genau dafür steht
in jeder Zeile eine Begründung.

### 6.2 Der Rückkopplungsvorteil, den dieses Modell hat

In Notebook 2 war die Rückkopplung ein Problem: Wer die Wartungsliste befolgt, verhindert
die Ausfälle, die er vorhersagen wollte, und verdirbt sich damit die Trainingsdaten.

**Hier ist es umgekehrt ein Geschenk.** Jeder Vorgang, den das Betriebsbüro ansieht,
bekommt ein Urteil: *war tatsächlich ein Problem* oder *war in Ordnung*. Nach einem
Vierteljahr liegen ein paar hundert solcher Urteile vor — und damit ein **echtes Label**.

Dann kann aus der Anomalieerkennung eine **Klassifikation** werden, wie in Notebook 2.
Das ist der übliche Weg: Unüberwacht anfangen, weil man nichts hat; überwacht
weitermachen, sobald Rückmeldungen da sind.

> **Dafür muss man die Rückmeldungen aber von Anfang an erfassen.** Wer die Tagesliste
> ausdruckt und abhakt, hat nach einem Jahr nichts. Wer sie in einer Maske mit zwei
> Knöpfen bestätigt, hat einen Trainingsdatensatz.

### 6.3 Überwachung

| Wache | Schwelle | Reaktion |
|---|---|---|
| Trefferquote der Tagesliste | unter 20 % über einen Monat | Schwelle oder Merkmale überarbeiten |
| Anteil bestätigter Vorgänge | Rückmeldung bleibt aus | **die Liste wird ignoriert** — organisatorisches Problem |
| Verteilung der Fahrtdauer | verschiebt sich | „normal“ hat sich geändert, Modell neu anlernen |
| Zahl der Vorgänge je Tag | wächst deutlich | zehn Plätze reichen nicht mehr |

**Die zweite Zeile ist die wichtigste.** Ein Anomaliemodell, dessen Meldungen niemand
bestätigt, ist nach einem halben Jahr nicht mehr zu bewerten — und wird still abgeschaltet.
"""),

# =====================================================================
MD("""
---

# Der Kreislauf schließt sich

| Phase | Ergebnis |
|---|---|
| 1 Business Understanding | Zwei Aufgaben, eine Tagesliste mit zehn Plätzen. Die Kosten-Nutzen-Rechnung ergibt eine Rentabilitätsschwelle von 5 % — das Erfolgskriterium liegt mit 20 % bewusst darüber, weil eine Liste voller Fehlalarme nicht benutzt wird |
| 2 Data Understanding | Eine **Lücke** in der Dauerverteilung trennt Fahrten von Rückgabeproblemen. Und eine Sackgasse: Die Geschwindigkeit taugt nichts, weil sie aus der Dauer abgeleitet ist |
| 3 Data Preparation | Sechs Merkmale je Fahrt; `distanz_km` bleibt draußen, weil ein fehlender Sensor kein auffälliger Vorgang ist |
| 4 Modeling | Interquartilsregel (über 2.000 Treffer — unbrauchbar), dann Isolation Forest — der **beim ersten Versuch die Preisklasse fand statt der Anomalien**. Rücksprung nach Phase 3, Entgelt je Radtyp normiert |
| 5 Evaluation | Die Korrektur hebt Aufgabe A von 2 % auf 36 %. Bei Aufgabe B **verfehlt das Modell** das Kriterium mit 14 % — eine einzeilige Regel erreicht 32 % und erfüllt es. Das Verfahren war das Problem, nicht die Daten |
| 6 Deployment | Tagesliste mit Begründung je Vorgang. Für Aufgabe B wird die Regel empfohlen, nicht das Modell |

**Der Rücksprung, den man in diesem Notebook mitverfolgen konnte**

Zwischen Phase 4 und Phase 5 steht ein echter Rückschritt: Das erste Modell hat sauber
gerechnet und Unbrauchbares geliefert, weil ein CARGO-Rad fünfmal so teuer ist wie ein
CITY-Rad. Aufgefallen ist das nicht durch eine Kennzahl, sondern dadurch, dass jemand die
zehn obersten Zeilen **angesehen** hat.

> **Sehen Sie sich immer die Extremfälle an, die ein Modell meldet.** Eine Kennzahl sagt
> Ihnen, *wie gut* — nur der Blick auf die Fälle sagt Ihnen, *woran*.

**Die zwei Sätze, die aus diesem Notebook bleiben**

> Sehen Sie sich immer an, was ein Modell meldet. Der CARGO-Fehlschlag stand in keiner
> Kennzahl — er stand in den zehn obersten Zeilen.

> Ein Verfahren, das schlechter ist als eine Zeile Fachwissen, ist nicht am Problem
> gescheitert, sondern an der Aufgabenstellung.

Bei Aufgabe B hat der Isolation Forest über alle 10.890 Stationstage gesucht, obwohl
alle Störungen an den 1.041 Nulltagen liegen. Diese Eingrenzung ist Fachwissen. Wer sie
dem Verfahren überlässt, bekommt sie schlechter zurück, als er sie hätte hineingeben
können.

Die eigentliche Lösung bleibt trotzdem eine bessere Datenquelle: Die Statusmeldungen der
Terminals fallen ohnehin an. Würden sie gespeichert, wäre die Frage eine Abfrage und
keine Schätzung.

**Was eine zweite Runde anders machen würde**

1. **Terminalmeldungen beschaffen** und Aufgabe B damit erneut angehen. Vermutlich ist
   sie dann gar keine Analyseaufgabe mehr, sondern eine Abfrage — auch das ist ein
   legitimes Ergebnis. Bis dahin läuft die Regel aus 5.5.
2. **Rückmeldungen einsammeln.** Sobald ein paar hundert Vorgänge beurteilt sind, wird
   aus der Anomalieerkennung eine Klassifikation mit echtem Label.
3. **Nach Radtyp getrennt rechnen.** Was bei einem CARGO-Rad normal ist — lange Dauer,
   hohes Entgelt —, ist bei einem CITY-Rad auffällig. Ein gemeinsames Modell mittelt
   diesen Unterschied weg.

---

# Damit ist der Kreis geschlossen — über alle sechs Notebooks

| | Verfahren | Zielgröße | Was am Ende herauskam |
|---|---|---|---|
| 1 | Regression | eine Zahl | Preisanzeige — freigegeben nur für CITY |
| 2 | Klassifikation | eine Kategorie | Wartungsliste — und die Erkenntnis, dass Sachverstand das Verfahren schlug |
| 3 | Clustering | keine | Vier Stationstypen, vier Kundensegmente — und eine falsch definierte Umsatzgröße |
| 4 | Zeitreihe | eine Zahl, in der Zeit | Nachfrageprognose — mit ehrlichem Abschlag für die Wettervorhersage |
| 5 | Assoziation | keine | Umlaufplan — und die Einsicht, dass hoher Lift meist wenig Support bedeutet |
| 6 | Anomalie | keine | Tagesliste — und ein sauber begründetes „geht nicht“ für die zweite Aufgabe |

**Dreimal Freigabe, einmal Teilfreigabe, zweimal Rücksprung.** Das ist keine schlechte
Bilanz, sondern eine realistische. Analyseprojekte, in denen alles auf Anhieb funktioniert,
gibt es in Lehrbüchern — und sonst nirgends.
"""),
]
