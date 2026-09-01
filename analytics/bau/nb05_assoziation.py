# -*- coding: utf-8 -*-
"""Notebook 5 - Assoziationsanalyse: Welche Wege gehoeren zusammen?"""
from bauwerk import CODE, MD, PHASE, kopf

NAME = "05_Assoziation_Wege_im_Netz"

ZELLEN = [

kopf("Assoziationsanalyse: Welche Wege gehören zusammen?",
     "Assoziationsanalyse (unüberwacht — das Ergebnis sind Regeln, keine Zahlen und keine Gruppen)",
     "Zwischen welchen Stationen gibt es systematische Ströme, und wann?",
     NAME),

MD("""
## Das dritte Gesicht des maschinellen Lernens

| Notebook | Ergebnis des Verfahrens |
|---|---|
| 1 und 2 | eine **Vorhersage** je Objekt (Dauer, Ausfallrisiko) |
| 3 | eine **Gruppe** je Objekt (Stationstyp, Kundensegment) |
| **5** | **Regeln über Zusammenhänge** — keine Vorhersage, keine Gruppe |

Die Assoziationsanalyse stammt aus dem Handel und heißt dort **Warenkorbanalyse**: Welche
Artikel liegen zusammen im Einkaufswagen? Das berühmte (und wahrscheinlich erfundene)
Beispiel ist *Windeln und Bier*.

Übertragen auf VeloCity: **Eine Fahrt ist ein Warenkorb.** Darin liegen die Startstation,
die Zielstation, die Tageszeit, der Wochentag, der Radtyp. Die Frage lautet: Was liegt
regelmäßig zusammen im selben Korb?

> **Warum wir das ohne Bibliothek rechnen.** Für Assoziationsregeln gibt es fertige
> Pakete (`mlxtend`, `apyori`). Wir rechnen die drei Kennzahlen hier von Hand — sie
> bestehen aus je einer Division, und wer sie einmal selbst gerechnet hat, fällt später
> nicht auf eine Regel herein, die nur nach etwas aussieht.
"""),

# =====================================================================
PHASE(1, "Die Disposition weiß, dass sie morgens umverteilen muss. Sie weiß nicht, "
         "**wohin**."),

MD("""
### Die Ausgangslage

Aus Notebook 3 wissen wir, welche **Typen** von Stationen es gibt. Was wir nicht wissen:
**welche Station sich zugunsten welcher anderen leert.** Der Transporter fährt morgens
los und verteilt nach Gefühl um.

Die Frage ist also nicht mehr „wie viele Räder“ (das war Notebook 4), sondern
**„von wo nach wo“**.

### Warum Assoziationsanalyse und nicht einfach eine Kreuztabelle?

Eine Kreuztabelle Start × Ziel könnte man auch bauen. Sie hätte aber ein Problem: Sie
zeigt **absolute Häufigkeiten**, und die größten Zahlen stehen dort, wo einfach am
meisten los ist. Der Hauptbahnhof taucht überall oben auf — nicht weil er besondere
Beziehungen hat, sondern weil er groß ist.

Die Assoziationsanalyse rechnet das heraus. Ihre dritte Kennzahl, der **Lift**, fragt
genau das: *Kommt diese Kombination häufiger vor, als man bei Unabhängigkeit erwarten
würde?*

### Die drei Kennzahlen — an einem Beispiel aus dem Handel

Regel: **{Brot} → {Butter}**

| Kennzahl | Frage | Rechnung |
|---|---|---|
| **Support** | Wie oft kommt die Kombination überhaupt vor? | Körbe mit Brot *und* Butter ÷ alle Körbe |
| **Konfidenz** | Wenn Brot drin ist — wie oft dann auch Butter? | Körbe mit beidem ÷ Körbe mit Brot |
| **Lift** | Ist das mehr, als der Zufall hergäbe? | Konfidenz ÷ Anteil aller Körbe mit Butter |

**Lift = 1** heißt: kein Zusammenhang. **Lift = 2**: doppelt so häufig wie erwartet.
**Lift < 1**: die beiden meiden einander.

### Die Erfolgskriterien

Eine Regel ist für die Disposition **nur dann brauchbar**, wenn alle drei zutreffen:

| | Kriterium | Schwelle | Warum |
|---|---|---|---|
| 1 | **Support** | mindestens 1 % aller Fahrten | Für eine Regel, die zwanzig Fahrten im Jahr betrifft, fährt kein Transporter |
| 2 | **Lift** | mindestens 1,3 | Darunter ist es Zufall oder schlicht Größe |
| 3 | **Handlungsfähig** | die Regel muss eine Fahrt des Transporters begründen | „Käppele → Käppele“ ist wahr und nutzlos |

**Kriterium 1 ist das, das am meisten Regeln aussortiert** — und zwar gerade die mit den
spektakulärsten Lift-Werten. Wir werden das gleich sehen.
"""),

# =====================================================================
PHASE(2, "Was liegt in unseren Warenkörben, und wie häufig ist jedes Ding für sich?"),

CODE('''
import os
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt

BASIS = os.environ.get("VELO_BASIS",
    "https://raw.githubusercontent.com/swrobuts/velocity-fallstudie/main/analytics/")
pd.set_option("display.width", 160)

fahrten = pd.read_csv(BASIS + "ausleihe.csv", parse_dates=["startzeit"])
stationen = pd.read_csv(BASIS + "station.csv")
raeder = pd.read_csv(BASIS + "fahrrad.csv")
feiertage = set(pd.read_csv(BASIS + "feiertage.csv").datum)

k = fahrten[fahrten.status == "abgeschlossen"].copy()
namen = stationen.set_index("station_id").name
k["start"] = k.start_station_id.map(namen)
# FREI ABGESTELLT IST EIN ZIEL, KEIN FEHLENDER WERT.
# Rund ein Fuenftel der Fahrten endet nicht an einer Station, sondern irgendwo
# im Geschaeftsgebiet - die Kundenwebsite wirbt damit ("ueberall in der roten
# Umrandung, ohne Zuschlag"). Wer diese Zeilen als fehlende Werte behandelt,
# wirft ein Fuenftel der Daten weg, ohne es zu merken, und alle Regeln
# verlieren ein Fuenftel ihrer Belege.
k["ziel"] = k.end_station_id.map(namen).fillna("frei abgestellt")
k["stunde"] = k.startzeit.dt.hour
k["ist_frei"] = ((k.startzeit.dt.dayofweek >= 5)
                 | k.startzeit.dt.strftime("%Y-%m-%d").isin(feiertage))
k = k.merge(raeder[["fahrrad_id", "typ_code"]], on="fahrrad_id", how="left")

print(f"{len(k):,d} Fahrten als 'Warenkörbe'".replace(",", "."))
print("\\nWie häufig ist jede Station als ZIEL? (das sind die Basisraten für den Lift)")
basis_ziel = k.ziel.value_counts(normalize=True)
print((basis_ziel * 100).round(1).to_string())
'''),

MD("""
**Diese Tabelle ist wichtiger, als sie aussieht.** Sie ist der Maßstab, gegen den der
Lift rechnet. Zwei Dinge fallen auf. **„Frei abgestellt“ ist mit Abstand das häufigste Ziel** — fast
jede vierte Fahrt endet so. Und die zehn Stationen liegen eng beieinander, zwischen rund
6 und 9 %; sie sind also ähnlich beliebt. Genau deshalb wird eine Konfidenz von 30 %
gleich als auffällig zu erkennen sein: Sie ist mehr als dreimal so hoch, wie der Zufall
hergäbe.

### 2.1 Der triviale Zusammenhang, den man zuerst finden muss
"""),

CODE('''
print(f"Anteil der Fahrten, die frei abgestellt enden: {(k.ziel == 'frei abgestellt').mean():.1%}")
print()
print("Wo endet es frei? (Anteil je Startstation)")
je_start = k.assign(f=(k.ziel == "frei abgestellt")).groupby("start").f.mean()
print((je_start.sort_values(ascending=False) * 100).round(1).to_string())

angedockt = k[k.ziel != "frei abgestellt"]
rundtour = (angedockt.start == angedockt.ziel).mean()
print()
print(f"Anteil Rundtouren unter den angedockten Fahrten: {rundtour:.1%}")
je_station = angedockt.assign(r=(angedockt.start == angedockt.ziel)).groupby("start").r.mean()
print((je_station.sort_values(ascending=False) * 100).round(1).to_string())
'''),

MD("""
**Zwei Befunde stehen hier, und beide sind wichtig.**

**Erstens:** Rund ein Fünftel der Fahrten endet **nicht an einer Station**. Das ist kein
Datenmangel, sondern ein beworbenes Merkmal — man darf das Rad überall im Geschäftsgebiet
abstellen. Ein Analyst, der `end_station_id` als Pflichtfeld behandelt und die Zeilen
verwirft, verliert ein Fünftel seiner Belege und merkt es nicht. **Wir behandeln „frei
abgestellt“ deshalb als eigenes Ziel.** Bei den Ausflugsstationen ist der Anteil am
höchsten — wer aufs Käppele fährt, stellt oben ab, wo er ist.

**Zweitens:** Knapp ein Fünftel der angedockten Fahrten endet dort, wo es begann. Das ist der
stärkste „Zusammenhang“ im ganzen Datensatz, und er wird jede Regelliste anführen, wenn
man ihn nicht ausschließt.

**Nützlich ist er trotzdem nicht.** Eine Rundtour verschiebt kein einziges Rad; für die
Disposition ist sie ein Nullsummenvorgang. Wir schließen Rundtouren deshalb aus der
Regelsuche aus — **ausdrücklich und begründet**, nicht heimlich.

> Das ist ein wiederkehrendes Muster bei Assoziationsanalysen: **Die stärkste Regel ist
> fast immer die, die man schon kannte.** Im Supermarkt ist es „wer Milch kauft, kauft
> Milch derselben Marke“. Der Wert des Verfahrens beginnt erst darunter.
"""),

# =====================================================================
PHASE(3, "Aus jeder Fahrt wird ein Warenkorb mit Zeitfenster und Tagesart."),

CODE('''
# Zeitfenster statt Stunden: 24 Stunden ergaeben 24 mal so viele Regeln mit je
# einem Vierundzwanzigstel der Belege. Vier Fenster halten die Regeln belegbar
# und entsprechen dem, wonach die Disposition ohnehin plant.
GRENZEN = [0, 10, 15, 20, 24]
BEZEICHNUNGEN = ["früh (5-10)", "mittag (10-15)", "abend (15-20)", "spät (20-24)"]

##LUECKE Bilden Sie die Spalte 'fenster' mit pd.cut über die Stunde, Grenzen GRENZEN, Namen BEZEICHNUNGEN.
k["fenster"] = pd.cut(k.stunde, GRENZEN, labels=BEZEICHNUNGEN, right=False)
##ENDE
k["tagesart"] = np.where(k.ist_frei, "frei", "Werktag")

# Rundtouren ausgeschlossen (siehe Phase 2). Die frei abgestellten Fahrten
# bleiben drin - sie sind ein Ziel wie jedes andere.
koerbe = k[k.start != k.ziel].copy()
print(f"Warenkörbe für die Regelsuche: {len(koerbe):,d}".replace(",", "."))
print("\\nVerteilung über die Zeitfenster:")
print(pd.crosstab(koerbe.fenster, koerbe.tagesart, margins=True).to_string())
'''),

# =====================================================================
PHASE(4, "Support, Konfidenz und Lift — drei Divisionen, von Hand gerechnet."),

CODE('''
def regeln_finden(koerbe, kontextspalten, mindest_support=0.005):
    """Findet Regeln {Start, Kontext} -> {Ziel} und rechnet die drei Kennzahlen.

    Bewusst ohne Bibliothek: jede Zeile hier entspricht einer Zeile in der
    Definition aus Phase 1.
    """
    n = len(koerbe)
    zeilen = []
    for kontext, teil in koerbe.groupby(kontextspalten, observed=True):
        if not isinstance(kontext, tuple):
            kontext = (kontext,)
        # Basisrate des Ziels IM SELBEN KONTEXT - sonst vergliche man
        # Aepfel mit Birnen (Werktagsziele gegen Wochenendziele).
        basis = teil.ziel.value_counts(normalize=True)
        n_kontext = len(teil)
        for start, gruppe in teil.groupby("start", observed=True):
            n_start = len(gruppe)
            for ziel, n_beide in gruppe.ziel.value_counts().items():
                support = n_beide / n
                if support < mindest_support:
                    continue
                konfidenz = n_beide / n_start
                lift = konfidenz / basis[ziel]
                zeilen.append({
                    "Kontext": " · ".join(map(str, kontext)),
                    "wenn Start": start, "dann Ziel": ziel,
                    "Fahrten": n_beide,
                    "Support": round(support, 4),
                    "Konfidenz": round(konfidenz, 3),
                    "Lift": round(lift, 2),
                })
    return pd.DataFrame(zeilen)

regeln = regeln_finden(koerbe, ["tagesart", "fenster"])
print(f"{len(regeln)} Regeln mit mindestens 0,5 % Support gefunden.\\n")
print("Die zehn Regeln mit dem höchsten Lift:")
print(regeln.nlargest(10, "Lift").to_string(index=False))
'''),

MD("""
### Die Zahlen einer einzelnen Regel nachrechnen

Damit klar ist, dass hier keine Magie stattfindet, rechnen wir eine Regel von Hand nach.
"""),

CODE('''
beispiel = regeln.nlargest(1, "Lift").iloc[0]
teil = koerbe[(koerbe.tagesart == beispiel.Kontext.split(" · ")[0])
              & (koerbe.fenster == beispiel.Kontext.split(" · ")[1])]
n_gesamt = len(koerbe)
n_start = int((teil.start == beispiel["wenn Start"]).sum())
n_beide = int(((teil.start == beispiel["wenn Start"]) & (teil.ziel == beispiel["dann Ziel"])).sum())
basisrate = (teil.ziel == beispiel["dann Ziel"]).mean()

print(f"Regel:  WENN Start = {beispiel['wenn Start']}  ({beispiel.Kontext})")
print(f"        DANN Ziel  = {beispiel['dann Ziel']}\\n")
def zeile(text, zahl):
    print(f"  {text:<46s}{f'{zahl:,d}'.replace(',', '.'):>9s}")

zeile("Fahrten insgesamt (alle Kontexte)", n_gesamt)
zeile(f"Fahrten ab {beispiel['wenn Start']} in diesem Kontext", n_start)
zeile(f"davon nach {beispiel['dann Ziel']}", n_beide)
print()
print(f"  Support    = {n_beide} / {n_gesamt}   = {n_beide/n_gesamt:.4f}  ({n_beide/n_gesamt:.2%})")
print(f"  Konfidenz  = {n_beide} / {n_start}      = {n_beide/n_start:.3f}   ({n_beide/n_start:.1%})")
print(f"  Basisrate  = Anteil aller Fahrten in diesem Kontext nach "
      f"{beispiel['dann Ziel']} = {basisrate:.3f}")
print(f"  Lift       = {n_beide/n_start:.3f} / {basisrate:.3f} = {(n_beide/n_start)/basisrate:.2f}")
'''),

# =====================================================================
PHASE(5, "Die Regeln mit dem höchsten Lift sind nicht die nützlichsten. "
         "Jetzt kommen die Kriterien aus Phase 1 zum Einsatz."),

CODE('''
plt.figure(figsize=(9.5, 5.5))
plt.scatter(regeln.Support * 100, regeln.Lift, s=regeln.Konfidenz * 220,
            alpha=.55, color="#3d4b6b", edgecolor="none")
plt.axvline(1.0, color="#e00034", ls="--", label="Kriterium 1: Support ≥ 1 %")
plt.axhline(1.3, color="#8AB833", ls="--", label="Kriterium 2: Lift ≥ 1,3")
brauchbar = regeln[(regeln.Support >= 0.01) & (regeln.Lift >= 1.3)]
plt.scatter(brauchbar.Support * 100, brauchbar.Lift, s=brauchbar.Konfidenz * 220,
            alpha=.9, color="#e00034", edgecolor="none", label="erfüllt beide")
plt.xlabel("Support (% aller Fahrten)"); plt.ylabel("Lift")
plt.title("Jede Blase ist eine Regel — die Größe zeigt die Konfidenz")
plt.legend(); plt.grid(alpha=.3)
plt.tight_layout(); plt.show()

print(f"Regeln insgesamt:            {len(regeln)}")
print(f"davon mit Lift ≥ 1,3:        {(regeln.Lift >= 1.3).sum()}")
print(f"davon mit Support ≥ 1 %:     {(regeln.Support >= 0.01).sum()}")
print(f"davon mit BEIDEM:            {len(brauchbar)}")

# Wie knapp scheitert die STAERKSTE Regel? Diese Zeile entscheidet, ob
# das Ergebnis eine Aussage ueber die Stadt ist oder ueber die Huerde.
beste = regeln.loc[regeln.Support.idxmax()]
print(f"\\nDie Regel mit dem groessten Support:")
print(f"   {beste['wenn Start']} -> {beste['dann Ziel']}  ({beste.Kontext})")
print(f"   Support {beste.Support:.4f} = {beste.Support * 100:.2f} %"
      f"   Lift {beste.Lift:.2f}   {int(beste.Fahrten)} Fahrten")
print(f"   Zur Huerde von 1,00 % fehlen {(0.01 - beste.Support) * 100:.2f} Prozentpunkte.")
'''),

MD("""
### 5.1 Das Bild erzählt die ganze Geschichte

Die Punktwolke fällt nach rechts ab, und das ist kein Zufall, sondern fast ein
Naturgesetz dieser Methode:

> **Je spezieller eine Regel, desto größer ihr Lift und desto kleiner ihr Support.**

Ganz links oben stehen die spektakulären Regeln — hoher Lift, aber ein Support von
Bruchteilen eines Prozents. Sie beschreiben eine Handvoll Fahrten. Für die Disposition
sind sie wertlos, und schlimmer noch: Bei so wenigen Fällen ist der hohe Lift oft
schlicht Zufall.

**Wer eine Regelliste nach Lift sortiert und die ersten zehn vorträgt, trägt zehn
Zufälle vor.** Das ist der häufigste Fehler bei Assoziationsanalysen.

### 5.2 Die brauchbaren Regeln — es gibt keine
"""),

CODE('''
ergebnis = brauchbar.sort_values(["Kontext", "Lift"], ascending=[True, False])
print(ergebnis.to_string(index=False))
'''),

MD("""
Die Tabelle ist leer. **Keine einzige Regel erfüllt beide Schwellen aus Phase 1.**

Und sie scheitert knapp: Die stärkste Regel — werktags früh vom Hauptbahnhof zum Hubland
Campus — erreicht einen Support von 0,99 %. Zur Hürde von 1,00 % fehlt ihr **ein
Hundertstel Prozentpunkt**, also rund fünf Fahrten in drei Jahren.

**Was verlangt diese Hürde eigentlich?** Der Support misst gegen *alle* 50.983
Warenkörbe. Die größte Ausgangsmenge — eine Station in einem Zeitfenster — umfasst
3,7 % davon. Ein Prozent Support heißt also: **Eine einzige Verbindung muss über ein
Viertel des gesamten Abflusses dieser Station in diesem Fenster auf sich ziehen** — bei
elf möglichen Zielen, wo die Gleichverteilung 10 % ergäbe.

Das ist eine anspruchsvolle, aber keine unmögliche Forderung. Sie ist auch nicht willkürlich:
Eine Regel, die weniger als ein Prozent aller Fahrten betrifft, bewegt im Betrieb nichts.
**Die Hürde ist streng, weil die Maßnahme teuer ist** — ein Transporter fährt nicht für
Ausnahmen.

> **Genau hier entscheidet sich, ob ein Erfolgskriterium etwas wert ist.** Die Hürde auf
> 0,9 % zu senken wäre die Arbeit von zehn Sekunden, und niemand würde es je bemerken.
> Es wäre aber dasselbe, wie sie gar nicht erst aufgestellt zu haben: Ein Kriterium, das
> man nach dem Ergebnis anpasst, misst nichts.

**Das Ergebnis ist damit: keine Regel wird freigegeben.** Was das für das Projekt heißt,
steht in 5.4 — und es heißt ausdrücklich nicht, dass die Analyse umsonst war.

### 5.3 Was die durchgefallenen Regeln trotzdem zeigen — als Hypothese

Die neun Regeln, die wenigstens die Lift-Hürde nehmen, dürfen den Umlaufplan nicht
begründen. Ansehen darf man sie trotzdem — sie sind eine **Hypothese**, kein Befund, und
sie werden gleich unabhängig überprüft.

Zwei Muster stechen in ihnen heraus, und sie gehören zusammen:

- **morgens** fließt es von den Pendlerstationen zu den Uni-Stationen
- **abends** fließt dasselbe zurück

Das ist der klassische Pendelstrom — und für den Transporter bedeutet er: Die
Uni-Stationen laufen im Lauf des Vormittags voll und sind abends leer, die
Pendlerstationen umgekehrt. **Wer morgens um 6 Uhr am Hubland auffüllt, hat den Tag
falsch verstanden.**

> **Ein Wort zur Vorsicht.** Wir haben hier keine Ursache nachgewiesen. Wir haben
> gezeigt, dass zwei Dinge häufiger zusammen auftreten als erwartet — mehr nicht. Dass
> es dieselben Menschen sind, die morgens hin- und abends zurückfahren, ist eine
> *plausible Deutung*, keine Messung. Prüfen ließe sie sich über die `kunde_id`; das wäre
> eine eigene Analyse.
"""),

CODE('''
# Die Gegenprobe zur Deutung: fahren morgens und abends dieselben Leute?
morgens = koerbe[(koerbe.tagesart == "Werktag") & (koerbe.fenster == "früh (5-10)")
                 & (koerbe.start == "Hauptbahnhof") & (koerbe.ziel == "Hubland Campus")]
abends = koerbe[(koerbe.tagesart == "Werktag") & (koerbe.fenster == "abend (15-20)")
                & (koerbe.start == "Hubland Campus") & (koerbe.ziel == "Hauptbahnhof")]
gemeinsam = set(morgens.kunde_id) & set(abends.kunde_id)

print(f"Kundschaft mit Fahrt Hauptbahnhof -> Hubland  (morgens): {morgens.kunde_id.nunique():>5d}")
print(f"Kundschaft mit Fahrt Hubland -> Hauptbahnhof  (abends):  {abends.kunde_id.nunique():>5d}")
print(f"Personen, die BEIDES getan haben:                       {len(gemeinsam):>5d}")
print(f"\\nAnteil an der Morgengruppe: {len(gemeinsam)/max(morgens.kunde_id.nunique(),1):.1%}")
'''),

MD("""
**Die Deutung hält stand — schwächer, als man erwartet hätte.** Von 354 Personen, die
morgens vom Bahnhof zum Campus fahren, fahren abends 49 dieselbe Strecke zurück: **13,8 %**,
also etwa jede siebte. Mehr als Zufall hergäbe, aber weit entfernt von dem geschlossenen
Pendelstrom, den die Regel nahelegt.

Sechs von sieben tun etwas anderes: Sie fahren zu anderer Zeit zurück, nehmen einen
anderen Weg, oder gar kein Rad. **Die Regel beschreibt eine Richtung, keine Personen.**

Und genau so geht man mit einer Regel um, die man ernst nehmen will: **nachfassen, nicht
glauben.** Hier hat das Nachfassen die Deutung nicht widerlegt, aber deutlich
zurechtgerückt — und das ist der Normalfall.

### 5.4 Das Urteil: keine Freigabe, und trotzdem kein Fehlschlag

| | |
|---|---|
| **Regeln gefunden** | 32 |
| **davon mit Lift ≥ 1,3** | 9 |
| **davon mit Support ≥ 1 %** | 0 |
| **freigegeben** | **keine** |

Was folgt daraus? Drei Wege, und zwei davon sind verboten:

1. **Die Hürde senken.** Verboten. Sie stand vor der Messung fest.
2. **Andere Regelformen suchen.** Zulässig, aber eine neue Runde: Regeln mit mehreren
   Bedingungen statt „ein Start → ein Ziel“ hätten größere Warenkörbe und damit anderen
   Support.
3. **Zurück zu Phase 1 und fragen, ob 1 % die richtige Hürde ist.** Das ist die ehrliche
   Antwort — aber es ist ein Gespräch mit der Disposition, keine Änderung im Notebook.

> **Der Ertrag dieses Notebooks steckt nicht in den Regeln.** Er steckt in den Salden aus
> Phase 6, die ohne jede Regel auskommen — und in der Erkenntnis, dass die stärksten
> Ströme dieser Stadt zu schwach sind, um eine Ein-Prozent-Hürde zu nehmen. Auch das ist
> ein Befund über das Netz.
"""),

# =====================================================================
PHASE(6, "Aus Regeln wird ein Umlaufplan für den Transporter."),

CODE('''
# ZWEI VERSCHIEDENE AUFGABEN, GETRENNT GERECHNET
#
# (1) UMVERTEILEN zwischen Stationen: dafuer zaehlen nur Fahrten, die an
#     einer Station enden - nur sie verschieben Raeder von A nach B.
# (2) EINSAMMELN der frei abgestellten Raeder: sie verlassen ihre Station und
#     kommen an keiner anderen an. Wuerde man beides in eine Tabelle werfen,
#     stuende ueberall "auffuellen" - und die Zeile "abholen bei: frei
#     abgestellt" waere als Anweisung sinnlos.
angedockte_koerbe = koerbe[koerbe.ziel != "frei abgestellt"]

ab = angedockte_koerbe.groupby(["tagesart", "fenster", "start"], observed=True).size().rename("ab")
zu = angedockte_koerbe.groupby(["tagesart", "fenster", "ziel"], observed=True).size().rename("zu")
saldo = pd.concat([ab, zu], axis=1).fillna(0)
saldo.index.names = ["tagesart", "fenster", "station"]
saldo["netto"] = saldo.zu - saldo.ab

# JE WERKTAG, NICHT ueber drei Jahre summiert.
#
# Eine frühere Fassung druckte hier die Rohsummen - "+1205 Raeder laufen
# auf" am Hubland. Das liest sich wie eine Anweisung an den Transporter
# und ist in Wirklichkeit die Summe ueber alle Werktage des Datensatzes.
# Wer eine Zahl als Betriebsanweisung ausgibt, muss sie auf den Zeitraum
# beziehen, fuer den die Anweisung gilt.
WERKTAGE = koerbe[koerbe.tagesart == "Werktag"].startzeit.dt.date.nunique()
print(f"Der Datensatz enthält {WERKTAGE} verschiedene Werktage.\\n")

werktag = saldo.loc["Werktag"].reset_index()
tabelle_gesamt = werktag.pivot(index="station", columns="fenster", values="netto").fillna(0)
tabelle = (tabelle_gesamt / WERKTAGE).round(2)

# (2) Wieviele Raeder bleiben je Startstation frei im Gebiet zurueck?
frei_werktag = (koerbe[(koerbe.tagesart == "Werktag") & (koerbe.ziel == "frei abgestellt")]
                .groupby(["fenster", "start"], observed=True).size()
                .unstack(fill_value=0).T.reindex(tabelle.index).fillna(0).astype(int))

plt.figure(figsize=(10, 5))
plt.imshow(tabelle.values, cmap="RdBu_r", aspect="auto",
           vmin=-abs(tabelle.values).max(), vmax=abs(tabelle.values).max())
plt.colorbar(label="Netto-Zugang (blau) / Netto-Abgang (rot)")
plt.xticks(range(len(tabelle.columns)), tabelle.columns, rotation=20)
plt.yticks(range(len(tabelle.index)), tabelle.index)
plt.title("Werktags, nur angedockte Fahrten: wo laufen Räder auf, wo fehlen sie?")
plt.tight_layout(); plt.show()

print("(1) Umverteilen zwischen Stationen — Netto-Saldo JE WERKTAG:")
print(tabelle.to_string())
print(f"\\nGrößter Überschuss: {tabelle.values.max():.1f} Räder je Werktag")
print(f"Größter Fehlbestand: {tabelle.values.min():.1f} Räder je Werktag")
print(f"Zum Vergleich: die Stationen fassen {stationen.kapazitaet.min()} "
      f"bis {stationen.kapazitaet.max()} Räder.")
print()
print("(2) Einsammeln — frei abgestellte Räder je Startstation und Zeitfenster:")
print(frei_werktag.to_string())
'''),

CODE('''
print("UMLAUFPLAN WERKTAG — abgeleitet aus den Salden oben, je Werktag\\n")
for fenster in [b for b in BEZEICHNUNGEN if b in tabelle.columns]:
    spalte = tabelle[fenster].sort_values()
    quellen = spalte[spalte < -spalte.abs().max() * 0.25]
    senken = spalte[spalte > spalte.abs().max() * 0.25]
    if quellen.empty and senken.empty:
        continue
    print(f"{fenster}")
    for station, wert in senken.items():
        print(f"    abholen bei   {station:<24s} (+{wert:.1f} Räder je Werktag)")
    for station, wert in quellen.items():
        print(f"    auffüllen bei {station:<24s} ({wert:.1f} Räder je Werktag)")
    print()

gesamt_frei = int(frei_werktag.values.sum())
print(f"Einsammelrunde: werktags bleiben rund {gesamt_frei / WERKTAGE:.0f} Räder je Tag")
print(f"frei im Gebiet zurück ({gesamt_frei} über {WERKTAGE} Werktage). Schwerpunkt:")
spitzen = (frei_werktag.sum(axis=1) / WERKTAGE).sort_values(ascending=False).head(3)
for station, wert in spitzen.items():
    print(f"    rund um {station:<24s} {wert:.1f} je Werktag")

tabelle.to_csv("umlaufplan_werktag.csv")
frei_werktag.to_csv("einsammelplan_werktag.csv")
print()
print("geschrieben: umlaufplan_werktag.csv, einsammelplan_werktag.csv")
'''),

MD("""
### 6.1 Der Plan trägt nicht — und das ist das Ergebnis

Lesen Sie die Zahlen im Umlaufplan noch einmal. Der größte Überschuss beträgt **1,8 Räder
je Werktag**, der größte Fehlbestand **1,1** — bei Stationen, die 20 bis 40 Räder fassen.

> **Für 1,8 Räder fährt kein Transporter durch Würzburg.** Der Umverteilungsplan ist
> rechnerisch korrekt und betrieblich bedeutungslos.

Das ist kein Rechenfehler, sondern ein Befund über das Netz: **Die zehn Stationen
Würzburgs sind im Tagesmittel nahezu ausgeglichen.** Was morgens vom Hauptbahnhof zum
Hubland fließt, fließt abends zurück — und was übrig bleibt, liegt im Bereich einer
einzigen Fahrt je Tag.

**Das passt zum Befund aus Phase 5, und zwar nicht zufällig.** Dort nahm keine Regel die
Ein-Prozent-Hürde; hier ist der Saldo zu klein für eine Maßnahme. Beides misst dasselbe:
Die Ströme in diesem Netz sind real, aber schwach.

> **Eine frühere Fassung dieses Notebooks druckte hier „+1205 Räder laufen auf".** Das
> war die Summe über 741 Werktage, gedruckt wie eine Anweisung an den Fahrer. Die Zahl
> war richtig, die Einheit fehlte — und mit ihr die Einsicht, dass der Plan nichts trägt.
> **Eine Betriebsanweisung ohne Zeitbezug ist keine Betriebsanweisung.**

### 6.2 Was trotzdem trägt: das Einsammeln

Die zweite Zahl sieht anders aus. Werktäglich bleiben rund elf Räder frei im Gebiet
zurück — das ist eine Runde, die sich lohnt, und sie braucht keine einzige
Assoziationsregel. Sie folgt direkt aus der Auszählung.

**Der Ertrag dieses Notebooks ist damit Plan B, nicht Plan A.**

### 6.3 Was dieser Plan ist — und was nicht

Er sagt, **wo** und **wann** einzusammeln ist. Er sagt nicht, **wie viele** Räder an eine
Station gehören — das war Notebook 4, und beide gehören im Betrieb zusammen.

Und er besteht aus **zwei Teilen**, die man nicht vermengen darf:

| | Aufgabe | Datengrundlage |
|---|---|---|
| **Umverteilen** | Räder von vollen zu leeren Stationen fahren | nur Fahrten, die an einer Station enden |
| **Einsammeln** | frei abgestellte Räder aufnehmen | die frei endenden Fahrten |

Rechnet man beides in einer Tabelle, steht bei **jeder** Station „auffüllen" — denn ein
Fünftel aller Räder verlässt das Stationsnetz und kommt nirgends an. Die Zeile „abholen
bei: frei abgestellt" wäre als Anweisung sinnlos: Der Fahrer weiß dann, dass irgendwo
Räder stehen, aber nicht wo.

### 6.4 Überwachung

| Wache | Schwelle | Reaktion |
|---|---|---|
| Lift der Leitregeln | fällt unter 1,3 | die Ströme haben sich verschoben |
| Support der Leitregeln | fällt unter 1 % | die Regel betrifft zu wenige Fahrten |
| neue Station im Netz | taucht auf | **alle Basisraten verschieben sich** — komplett neu rechnen |
| Baustelle oder Sperrung | gemeldet | Regeln für die betroffenen Wege aussetzen, nicht anpassen |

**Die dritte Zeile ist die unangenehmste.** Der Lift misst gegen die Basisrate aller
Ziele. Kommt eine elfte Station dazu, ändert sich diese Basisrate für **jede** Regel —
auch für solche, die mit der neuen Station nichts zu tun haben. Assoziationsregeln sind
nicht fortschreibbar; sie müssen neu gerechnet werden.

### 6.5 Ein Hinweis, der nicht fehlen darf

Diese Analyse arbeitet mit **Bewegungsdaten von Personen**. Für den Umlaufplan brauchen
wir sie nur aggregiert — und genau so sollte er auch entstehen. Die Gegenprobe in Phase 5,
die auf `kunde_id` zurückgreift, ist etwas anderes: Sie stellt fest, dass identifizierbare
Personen morgens und abends dieselbe Strecke fahren. Das ist ein Bewegungsprofil, und
dafür braucht es mehr als technische Machbarkeit.
"""),

# =====================================================================
MD("""
---

# Der Kreislauf schließt sich

| Phase | Ergebnis |
|---|---|
| 1 Business Understanding | „Von wo nach wo?“ statt „wie viele?“. Drei Erfolgskriterien: Support ≥ 1 %, Lift ≥ 1,3, und die Regel muss eine Transporterfahrt begründen |
| 2 Data Understanding | Eine Fahrt ist ein Warenkorb. Der stärkste Zusammenhang im Datensatz sind die Rundtouren (knapp 20 % der angedockten Fahrten) — wahr und nutzlos, deshalb ausgeschlossen |
| 3 Data Preparation | Vier Zeitfenster statt 24 Stunden, sonst wäre jede Regel unbelegt |
| 4 Modeling | Support, Konfidenz und Lift von Hand — drei Divisionen, eine davon Zeile für Zeile nachgerechnet |
| 5 Evaluation | Hoher Lift und hoher Support schließen einander fast aus: von 32 Regeln nehmen 9 die Lift-, aber **keine** die Support-Hürde. Die stärkste verfehlt sie um ein Hundertstel Prozentpunkt — und die Hürde wird trotzdem nicht gesenkt. Die Deutung des Pendelstroms hielt der Gegenprobe über die `kunde_id` nur teilweise stand (13,8 %) |
| 6 Deployment | Der Umverteilungsplan **trägt nicht**: Der größte Saldo beträgt 1,8 Räder je Werktag bei Stationen für 20 bis 40. Was trägt, ist die Einsammelrunde — rund elf frei abgestellte Räder je Werktag, und dafür braucht es keine einzige Regel |

**Der Satz, der aus diesem Notebook bleibt**

> Eine Zahl ohne Zeitbezug ist keine Betriebsanweisung. „+1205 Räder laufen auf“ klingt
> nach Handlungsbedarf und heißt in Wirklichkeit: 1,6 Räder am Tag.

**Was eine zweite Runde anders machen würde**

1. **Zurück zu Phase 1:** Wir haben nur Regeln der Form „ein Start → ein Ziel“ gesucht.
   Interessanter wären Regeln mit mehreren Bedingungen — „Regen **und** Werktag **und**
   Bahnhof“. Dafür ist der Apriori-Algorithmus gemacht, der Kombinationen systematisch
   durchsucht, statt sie vorzugeben.
2. **Zurück zu Phase 3:** Die vier Zeitfenster sind gesetzt, nicht gefunden. Eine
   Aufteilung nach den tatsächlichen Spitzen (aus Notebook 3!) könnte schärfere Regeln
   liefern.
3. **Die Richtung prüfen.** Assoziation ist symmetrisch — sie kennt kein *weil*. Ob der
   Strom morgens vom Bahnhof kommt oder zum Campus geht, ist für den Transporter derselbe
   Weg, für eine Werbekampagne aber nicht.

**Weiter geht es mit Notebook 6 — Anomalieerkennung:** Dort suchen wir nicht das Muster,
sondern seine Ausnahmen. Und wir werden feststellen, dass die schwierigste Frage nicht
lautet „was ist auffällig?“, sondern „**was davon ist ein Problem?**“
"""),
]
