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

> **Womit wir hier rechnen.** Die VeloCity-Daten sind **synthetisch** — erzeugt für diese
> Fallstudie, nicht in Würzburg gemessen. Die Verfahren, die Fallstricke und die
> Entscheidungswege sind echt; die Zahlen beschreiben kein reales Verkehrsaufkommen.
> Wo unten „die Ströme dieser Stadt" steht, ist immer der Datensatz gemeint.

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

### Ein Zusatz, der bei uns nötig ist: der Lift **im Kontext**

Im Supermarkt gibt es nur einen Korb. Bei uns hat jede Fahrt einen **Kontext** — Werktag
oder frei, und eines von vier Zeitfenstern. Und die Ziele sind je nach Kontext ganz
verschieden beliebt: Der Campus ist werktags früh ein häufiges Ziel und sonntags abends
fast keines.

Rechnet man den Lift gegen den Anteil über **alle** Fahrten, misst man deshalb zwei Dinge
auf einmal: den Zusammenhang *und* den Umstand, dass morgens andere Ziele gefragt sind als
abends. Wir rechnen deshalb gegen die Basisrate **im selben Kontext**:

| | Nenner der Division | Was er misst |
|---|---|---|
| klassischer Lift | Anteil des Ziels an **allen** Fahrten | Zusammenhang **und** Kontexteffekt, vermischt |
| **kontextbedingter Lift** ← unsere Wahl | Anteil des Ziels **im selben Kontext** | nur den Zusammenhang, bei gleichem Kontext |

In beiden Fällen ist der Zähler derselbe: die Konfidenz, also der Anteil der Fahrten ab
dieser Startstation in diesem Kontext, die an diesem Ziel enden.

Der Unterschied ist nicht klein. Für die stärkste Regel dieses Notebooks — werktags früh
vom Hauptbahnhof zum Hubland Campus — liegt der klassische Lift bei **3,58**, der
kontextbedingte bei **1,70**. Mehr als die Hälfte des klassischen Werts kommt also gar
nicht von der Verbindung, sondern daher, dass der Campus morgens ohnehin gefragt ist.

**Wir weisen ab hier ausschließlich den kontextbedingten Lift aus**, und die Schwelle in
den Erfolgskriterien bezieht sich auf ihn. Beide Werte stehen in Phase 4 nebeneinander,
damit der Abstand sichtbar bleibt.

### Die Erfolgskriterien

Eine Regel ist für die Disposition **nur dann brauchbar**, wenn alle drei zutreffen:

| | Kriterium | Schwelle | Warum |
|---|---|---|---|
| 1 | **Support** | mindestens 1 % aller Fahrten | Für eine Regel, die zwanzig Fahrten im Jahr betrifft, fährt kein Transporter |
| 2 | **kontextbedingter Lift** | mindestens 1,3 | Darunter ist es Zufall oder schlicht Größe |
| 3 | **Handlungsfähig** | Start ≠ Ziel, und das Ziel ist eine Station | eine Rundtour verschiebt kein Rad; „frei abgestellt“ ist kein Ort, den man anfahren kann |

**Kriterium 3 wird in Phase 5 als Code geprüft**, nicht als Absichtserklärung. Ein
Kriterium, das nur im Text steht, ist keines.

**Kriterium 1 ist das, das am meisten Regeln aussortiert** — und zwar gerade die mit den
spektakulärsten Lift-Werten. Wir werden das gleich sehen. Ob es dabei das Richtige misst,
ist eine eigene Frage; sie wird in Phase 5 gestellt und fällt unangenehm aus.
"""),

# =====================================================================
PHASE(2, "Was liegt in unseren Warenkörben, und wie häufig ist jedes Ding für sich?"),

CODE('''
import os
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt

# Die Adresse zeigt auf den Zweig 'main' - der sich aendern kann. Fuer eine
# Auswertung, die spaeter exakt reproduzierbar sein muss, gehoert hier ein
# fester Commit-Hash statt 'main' hinein.
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
**Diese Tabelle zeigt den Maßstab — aber nicht den, gegen den wir rechnen werden.** Zwei
Dinge fallen auf. **„Frei abgestellt“ ist mit Abstand das häufigste Ziel**: rund jede
fünfte Fahrt endet so (19,8 %). Und die zehn Stationen liegen eng beieinander, zwischen
7,1 und 10,1 %; sie sind also ähnlich beliebt.

> **Wichtig für später:** Das sind die Anteile über **alle** Fahrten. Der Lift, den wir ab
> Phase 4 ausweisen, rechnet gegen die Basisrate **im jeweiligen Kontext** — und die
> weicht davon deutlich ab. Werktags früh ist der Hubland Campus nicht in 7,6 % der
> Fahrten das Ziel, sondern in 16,1 %. Wer die Tabelle hier für die Lift-Grundlage hält,
> rechnet mit den falschen Nennern.

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
abgestellt“ deshalb als eigenes Ziel.** Die Tabelle darüber zeigt, dass der Anteil je nach
Startstation schwankt — er ist ein Merkmal der Gegend, nicht des Zufalls.

**Zweitens:** 16,5 % der angedockten Fahrten enden dort, wo sie begannen — rund jede
sechste. Das ist der stärkste „Zusammenhang“ im ganzen Datensatz, und er wird jede
Regelliste anführen, wenn man ihn nicht ausschließt.

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
# Die Grenzen muessen die 24 Stunden LUECKENLOS abdecken - sonst faellt die
# Nachtstunde stillschweigend aus der Analyse. Das erste Fenster beginnt
# deshalb bei 0 Uhr und heisst auch so; ein Etikett "5-10" ueber einem
# Fenster, das um Mitternacht anfaengt, waere schlicht falsch.
GRENZEN = [0, 10, 15, 20, 24]
BEZEICHNUNGEN = ["früh (0-10)", "mittag (10-15)", "abend (15-20)", "spät (20-24)"]

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
from scipy.stats import fisher_exact

def regeln_finden(koerbe, kontextspalten, mindest_support=0.005):
    """Findet Regeln {Start, Kontext} -> {Ziel} und rechnet die Kennzahlen.

    Bewusst ohne Bibliothek: jede Zeile hier entspricht einer Zeile in der
    Definition aus Phase 1. Wir geben BEIDE Lift-Varianten aus, damit der
    Unterschied zwischen ihnen sichtbar bleibt und niemand die eine Zahl
    mit der Definition der anderen erklaert.
    """
    n = len(koerbe)
    basis_global = koerbe.ziel.value_counts(normalize=True)
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
                # Vierfeldertafel im Kontext: fuehrt dieser Start haeufiger
                # zu diesem Ziel als alle anderen Starts im selben Fenster?
                nicht_ziel_hier = n_start - n_beide
                ziel_woanders = int((teil.ziel == ziel).sum()) - n_beide
                rest = n_kontext - n_start - ziel_woanders
                p = fisher_exact([[n_beide, nicht_ziel_hier],
                                  [ziel_woanders, rest]], alternative="greater")[1]
                zeilen.append({
                    "Kontext": " · ".join(map(str, kontext)),
                    "wenn Start": start, "dann Ziel": ziel,
                    "Fahrten": n_beide,
                    "Support": support,
                    "Konfidenz": konfidenz,
                    "Lift (Kontext)": konfidenz / basis[ziel],
                    "Lift (klassisch)": konfidenz / basis_global[ziel],
                    "p": p,
                })
    return pd.DataFrame(zeilen)

regeln = regeln_finden(koerbe, ["tagesart", "fenster"])

# KRITERIUM 3 ALS CODE, NICHT ALS ABSICHTSERKLAERUNG.
# Handlungsfaehig heisst: die Regel muss eine Transporterfahrt begruenden
# koennen. "-> frei abgestellt" kann das nicht - "frei abgestellt" ist kein
# Ort, den man anfaehrt. Rundtouren sind schon in Phase 3 ausgeschlossen.
regeln["handlungsfähig"] = regeln["dann Ziel"] != "frei abgestellt"
print(f"{len(regeln)} Regeln mit mindestens 0,5 % Support gefunden, davon "
      f"{int(regeln['handlungsfähig'].sum())} handlungsfähig (Kriterium 3).\\n")

anzeige = ["Kontext", "wenn Start", "dann Ziel", "Fahrten", "Support",
           "Konfidenz", "Lift (Kontext)", "Lift (klassisch)"]
top = regeln.nlargest(10, "Lift (Kontext)")
print("Die zehn Regeln mit dem höchsten kontextbedingten Lift:")
print(top[anzeige].round({"Support": 4, "Konfidenz": 3,
                          "Lift (Kontext)": 2, "Lift (klassisch)": 2}).to_string(index=False))
print("\\nDieselben zehn Regeln, klassischer Lift daneben: er ist durchweg groesser,")
print("weil er den Kontexteffekt mitzaehlt. Beide Spalten beschreiben dieselben Fahrten.")
'''),

MD("""
### Die Zahlen einer einzelnen Regel nachrechnen

Damit klar ist, dass hier keine Magie stattfindet, rechnen wir eine Regel von Hand nach.
"""),

CODE('''
beispiel = regeln.nlargest(1, "Lift (Kontext)").iloc[0]
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
basis_alle = (koerbe.ziel == beispiel["dann Ziel"]).mean()
print(f"  Basisrate im Kontext  = Anteil der Fahrten IN DIESEM FENSTER nach "
      f"{beispiel['dann Ziel']}  = {basisrate:.3f}")
print(f"  Basisrate insgesamt   = Anteil ALLER Fahrten nach "
      f"{beispiel['dann Ziel']}  = {basis_alle:.3f}")
print()
print(f"  Lift (Kontext)   = {n_beide/n_start:.3f} / {basisrate:.3f} "
      f"= {(n_beide/n_start)/basisrate:.2f}   <- diesen weisen wir aus")
print(f"  Lift (klassisch) = {n_beide/n_start:.3f} / {basis_alle:.3f} "
      f"= {(n_beide/n_start)/basis_alle:.2f}")
print()
print("  Die beiden Zahlen beschreiben dieselben Fahrten. Der Unterschied ist der")
print("  Nenner: einmal 'wie beliebt ist das Ziel jetzt', einmal 'wie beliebt ist es")
print("  ueberhaupt'. Wer den einen Wert nennt und den anderen erklaert, taeuscht -")
print("  meist sich selbst.")
'''),

# =====================================================================
PHASE(5, "Die Regeln mit dem höchsten Lift sind nicht die nützlichsten. "
         "Jetzt kommen die Kriterien aus Phase 1 zum Einsatz."),

CODE('''
plt.figure(figsize=(9.5, 5.5))
LIFT = "Lift (Kontext)"
# Die Schwellen werden auf die UNGERUNDETEN Werte angewandt. Eine Regel mit
# Lift 1,296 darf nicht dadurch bestehen, dass sie in der Anzeige als 1,30
# erscheint - sonst entscheidet die Formatierung ueber die Freigabe.
plt.scatter(regeln.Support * 100, regeln[LIFT], s=regeln.Konfidenz * 220,
            alpha=.55, color="#3d4b6b", edgecolor="none")
plt.axvline(1.0, color="#e00034", ls="--", label="Kriterium 1: Support ≥ 1 %")
plt.axhline(1.3, color="#8AB833", ls="--", label="Kriterium 2: Lift ≥ 1,3")
brauchbar = regeln[(regeln.Support >= 0.01) & (regeln[LIFT] >= 1.3)
                   & regeln["handlungsfähig"]]
plt.scatter(brauchbar.Support * 100, brauchbar[LIFT], s=brauchbar.Konfidenz * 220,
            alpha=.9, color="#e00034", edgecolor="none", label="erfüllt alle drei")
plt.xlabel("Support (% aller Fahrten)"); plt.ylabel("kontextbedingter Lift")
plt.title("Jede Blase ist eine Regel — die Größe zeigt die Konfidenz")
plt.legend(); plt.grid(alpha=.3)
plt.tight_layout(); plt.show()

print(f"Regeln insgesamt:                 {len(regeln)}")
print(f"K1  Support ≥ 1 %:                {(regeln.Support >= 0.01).sum()}")
print(f"K2  Lift (Kontext) ≥ 1,3:         {(regeln[LIFT] >= 1.3).sum()}")
print(f"K3  handlungsfähig:               {int(regeln['handlungsfähig'].sum())}")
print(f"alle drei zusammen:               {len(brauchbar)}")

# SIND DIE STARKEN REGELN ZUFALL? Das laesst sich pruefen, statt es zu
# behaupten. 32 Regeln wurden getestet, also korrigieren wir nach Bonferroni:
# jede einzelne p-Wert wird mit der Zahl der Tests multipliziert.
regeln["p_korrigiert"] = (regeln.p * len(regeln)).clip(upper=1.0)
top10 = regeln.nlargest(10, LIFT)
print(f"\\nVon den zehn Regeln mit dem hoechsten Lift halten "
      f"{int((top10.p_korrigiert < 0.05).sum())} von 10 einem Test auf")
print(f"Unabhaengigkeit stand (Fisher, Bonferroni-korrigiert auf {len(regeln)} Tests).")
print(f"Groesster korrigierter p-Wert unter diesen zehn: {top10.p_korrigiert.max():.2e}")

# Wie knapp scheitert die STAERKSTE Regel? Und vor allem: was verlangt die
# Huerde eigentlich, wenn man sie in Fahrten je Werktag uebersetzt?
beste = regeln.loc[regeln.Support.idxmax()]
werktage = koerbe[koerbe.tagesart == "Werktag"].startzeit.dt.date.nunique()
print(f"\\nDie Regel mit dem groessten Support:")
print(f"   {beste['wenn Start']} -> {beste['dann Ziel']}  ({beste.Kontext})")
print(f"   Support {beste.Support:.4f} = {beste.Support * 100:.2f} %"
      f"   Lift (Kontext) {beste[LIFT]:.2f}   {int(beste.Fahrten)} Fahrten")
print(f"   Zur Huerde von 1,00 % fehlen {(0.01 - beste.Support) * 100:.2f} Prozentpunkte.")
print()
print("   DIESELBE HUERDE, IN BETRIEBSGROESSEN:")
print(f"   Diese Regel umfasst {int(beste.Fahrten)} Fahrten in {werktage} Werktagen")
print(f"   = {beste.Fahrten / werktage:.2f} Fahrten je Werktag.")
print(f"   Die 1-%-Huerde verlangt {0.01 * len(koerbe) / werktage:.2f} Fahrten je Werktag.")
print(f"   Der Abstand zur Huerde betraegt {(0.01 * len(koerbe) - beste.Fahrten):.0f} Fahrten")
print(f"   in drei Jahren - rund {(0.01 * len(koerbe) - beste.Fahrten) / werktage * 100:.1f}")
print("   Hundertstel einer Fahrt je Werktag.")
'''),

MD("""
### 5.1 Das Bild erzählt die ganze Geschichte

Die Punktwolke fällt nach rechts ab, und das ist kein Zufall, sondern fast ein
Naturgesetz dieser Methode:

> **Je spezieller eine Regel, desto größer ihr Lift und desto kleiner ihr Support.**

Ganz links oben stehen die spektakulären Regeln — hoher Lift, aber ein Support von
Bruchteilen eines Prozents. Sie beschreiben wenige Fahrten und sind für die Disposition
deshalb wertlos.

### Sind die Top-Regeln denn Zufall? Nachsehen statt behaupten

Es liegt nahe, jetzt zu sagen: *„Wer eine Regelliste nach Lift sortiert und die ersten
zehn vorträgt, trägt zehn Zufälle vor."* Der Satz klingt gut, ist griffig — und in diesem
Datensatz **falsch**. Die Ausgabe oben hat ihn geprüft.

Für jede Regel steht eine Vierfeldertafel zur Verfügung: Fahrten ab dieser Station in
diesem Fenster zu diesem Ziel, gegen alles andere. Fishers exakter Test beantwortet damit
die Frage, ob eine solche Häufung bei Unabhängigkeit noch plausibel wäre. Weil wir nicht
eine Regel testen, sondern alle 32, multiplizieren wir jeden p-Wert mit 32
(**Bonferroni-Korrektur**) — die einfachste und strengste Art, sich das mehrfache
Hinsehen anzurechnen.

**Alle zehn bestehen den Test**, der schwächste noch mit einem korrigierten p-Wert unter
0,001. Diese Regeln sind real; sie sind nur **klein**.

> **Das ist eine wichtige Unterscheidung.** „Statistisch gesichert" und „betrieblich
> relevant" sind zwei verschiedene Dinge, und die Assoziationsanalyse liefert nur das
> erste. Der übliche Merksatz — hoher Lift heißt Zufall — verwechselt beides. Hier
> scheitern die Regeln nicht an der Signifikanz, sondern an der Größe.

**Wo der Merksatz trotzdem stimmt:** Hätten wir keine Support-Untergrenze von 0,5 %
gesetzt, stünden hier Regeln mit drei oder vier Fahrten und Lift-Werten jenseits von 10 —
und die wären dann tatsächlich meist Zufall. Die Untergrenze bei der Suche ist es, die
den Merksatz hier entkräftet, nicht der Datensatz.

### 5.2 Die brauchbaren Regeln — es gibt keine
"""),

CODE('''
ergebnis = brauchbar.sort_values(["Kontext", LIFT], ascending=[True, False])
print(ergebnis[anzeige].to_string(index=False) if len(ergebnis)
      else "(leer — keine Regel erfüllt alle drei Kriterien)")
'''),

MD("""
Die Tabelle ist leer. **Keine einzige Regel erfüllt beide Schwellen aus Phase 1.**

Und sie scheitert knapp: Die stärkste Regel — werktags früh vom Hauptbahnhof zum Hubland
Campus — erreicht einen Support von 0,99 %. Zur Hürde von 1,00 % fehlt ihr **ein
Hundertstel Prozentpunkt**, also rund fünf Fahrten in drei Jahren.

### Die Hürde misst nicht, was sie messen sollte

Jetzt kommt der unangenehme Teil, und er betrifft nicht die Daten, sondern **uns**.

Die Begründung für die Ein-Prozent-Hürde lautete in Phase 1: *„Für eine Regel, die zwanzig
Fahrten im Jahr betrifft, fährt kein Transporter."* Das ist eine Aussage über
**Betriebsgrößen** — über Fahrten je Tag. Gemessen haben wir aber einen **Anteil an allen
Warenkörben über drei Jahre**. Das sind zwei verschiedene Maßstäbe, und die Ausgabe oben
rechnet sie ineinander um:

- Die stärkste Regel umfasst 505 Fahrten — das sind **0,68 Fahrten je Werktag**.
- Die Ein-Prozent-Hürde verlangt **0,69 Fahrten je Werktag**.
- Der Abstand zwischen beiden beträgt **fünf Fahrten in drei Jahren**.

**In der Sprache, in der das Kriterium begründet wurde, unterscheiden die beiden Zahlen
nichts.** Eine Hürde, die zwischen 0,68 und 0,69 Fahrten je Werktag trennt, entscheidet
über nichts Betriebliches — sie entscheidet über eine Stelle hinter dem Komma. Beide Werte
liegen weit unterhalb dessen, was eine Transporterfahrt rechtfertigt.

**Das Kriterium war schlecht formuliert.** Nicht zu streng und nicht zu lax: auf der
falschen Skala.

### Was jetzt nicht passiert

Die naheliegende Reaktion wäre, die Hürde durch eine bessere zu ersetzen und noch einmal
zu rechnen. **Das wäre der Fehler**, und zwar der teuerste in diesem ganzen Notebook.

> Ein Kriterium, das man ändert, **nachdem** man das Ergebnis gesehen hat, misst nichts
> mehr — auch dann nicht, wenn die Änderung sachlich richtig ist. Der Verdacht, dass die
> neue Hürde genau so gewählt wurde, dass das gewünschte Ergebnis herauskommt, lässt sich
> hinterher nicht mehr ausräumen. Nicht einmal von einem selbst.

Die Hürde bleibt also stehen, das Ergebnis lautet **keine Freigabe**, und der Mangel wird
protokolliert statt repariert. Für eine zweite Runde gehört das Kriterium neu formuliert —
**vor** der nächsten Messung, und in der Einheit, in der die Disposition denkt:

> *Eine Regel ist brauchbar, wenn sie mindestens N Fahrten je Werktag betrifft — wobei N
> aus den Kosten einer Transporterfahrt hergeleitet wird, nicht aus einer runden Zahl.*

Dass wir diese Zahl heute nicht nennen können, ist selbst ein Befund: **Die Kosten einer
Transporterfahrt standen nie in den Projektunterlagen.** Ohne sie ist jede Hürde geraten.

### 5.3 Was die durchgefallenen Regeln trotzdem zeigen — als Hypothese

Die neun Regeln, die wenigstens die Lift-Hürde nehmen, dürfen den Umlaufplan nicht
begründen. Ansehen darf man sie trotzdem — sie sind eine **Hypothese**, kein Befund, und
sie werden gleich unabhängig überprüft.

Ein Muster sticht heraus: **morgens** fließt es von den Pendlerstationen zu den
Uni-Stationen. Werktags früh vom Hauptbahnhof zum Hubland Campus ist die stärkste Regel
der Liste.

**Die naheliegende Fortsetzung lautet: abends fließt dasselbe zurück.** Diesen Satz haben
frühere Fassungen dieses Notebooks an dieser Stelle geschrieben. Er hat nur einen Fehler:
**Die Rückrichtung steht gar nicht in der Regelliste.**

Sehen Sie oben nach. Hubland Campus → Hauptbahnhof, abends, ist nicht dabei. Die
Verbindung existiert — 217 Fahrten, kontextbedingter Lift 2,03, der zweithöchste des
ganzen Datensatzes — aber ihr Support liegt bei 0,43 % und damit **unter der
Untergrenze von 0,5 %, mit der die Suche überhaupt erst begonnen hat.** Sie wurde
aussortiert, bevor irgendein Kriterium sie zu sehen bekam.

> **Das ist ein Fallstrick, der leicht zu übersehen ist.** Der `mindest_support` in der
> Suchfunktion ist kein Erfolgskriterium, sondern ein Filter *davor*. Was er entfernt,
> taucht in keiner Auswertung mehr auf — auch nicht als „durchgefallen". Wer über eine
> Regelliste redet, muss diese Untergrenze mitnennen, sonst redet er über eine Auswahl,
> deren Rand er nicht kennt.

Für den Transporter bleibt die Deutung dennoch plausibel: Die Uni-Stationen laufen im Lauf
des Vormittags voll, die Pendlerstationen leeren sich. **Aber sie ist eine Deutung.** Ob
tatsächlich dieselben Menschen morgens hin- und abends zurückfahren, hat die
Assoziationsanalyse nicht gemessen und kann sie nicht messen — sie zählt Fahrten, nicht
Personen. Die nächste Zelle sieht deshalb in den `kunde_id` nach.
"""),

CODE('''
# DIE GEGENPROBE ZUR DEUTUNG: fahren morgens und abends dieselben Leute -
# und zwar AM SELBEN TAG? Nur dann ist es eine Hin- und Rueckfahrt.
koerbe["datum"] = koerbe.startzeit.dt.normalize()

morgens = koerbe[(koerbe.tagesart == "Werktag") & (koerbe.fenster == "früh (0-10)")
                 & (koerbe.start == "Hauptbahnhof") & (koerbe.ziel == "Hubland Campus")]
abends = koerbe[(koerbe.tagesart == "Werktag") & (koerbe.fenster == "abend (15-20)")
                & (koerbe.start == "Hubland Campus") & (koerbe.ziel == "Hauptbahnhof")]

# Zwei verschiedene Fragen, die leicht zu verwechseln sind:
irgendwann = set(morgens.kunde_id) & set(abends.kunde_id)
am_selben_tag = (set(zip(morgens.kunde_id, morgens.datum))
                 & set(zip(abends.kunde_id, abends.datum)))

print(f"Fahrten Hauptbahnhof -> Hubland  (werktags früh):  {len(morgens):>5d}")
print(f"Fahrten Hubland -> Hauptbahnhof  (werktags abends): {len(abends):>5d}")
print()
print(f"Personen mit Morgenfahrt:                           {morgens.kunde_id.nunique():>5d}")
print(f"Personen mit Abendfahrt:                            {abends.kunde_id.nunique():>5d}")
print(f"Personen, die IRGENDWANN in drei Jahren beides taten: {len(irgendwann):>4d}")
print(f"Hin- und Rückfahrt AM SELBEN TAG:                   {len(am_selben_tag):>5d}")
print()
if len(am_selben_tag) == 0:
    print("NULL. Nicht wenige - keine einzige.")
    print("Die Deutung 'dieselben Menschen fahren hin und zurueck' ist damit")
    print("widerlegt, nicht bestaetigt und nicht zurechtgerueckt.")
'''),

MD("""
**Die Deutung ist widerlegt.** In drei Jahren gibt es **keinen einzigen Tag**, an dem
dieselbe Person morgens vom Bahnhof zum Campus und abends zurückgefahren wäre. Nicht
wenige — null.

**Und hier wäre beinahe eine Fehldeutung stehen geblieben.** 49 Personen haben
*irgendwann* beide Richtungen benutzt, und 49 von 354 sind 13,8 %. Eine frühere Fassung
dieses Notebooks hat genau diese Zahl gedruckt und dazu geschrieben, die Deutung halte
„schwächer als erwartet" stand. Das war falsch:

| Was gezählt wurde | Was daraus gelesen wurde |
|---|---|
| 49 Personen benutzten in drei Jahren *irgendwann* beide Richtungen | „49 Personen fahren hin und zurück" |
| Über 1 000 Werktage hinweg, in beliebiger Kombination | ein täglicher Pendelweg |

Zwischen beiden Sätzen liegt die **Tagesbindung** — und ohne sie zählt man Menschen, die
im März einmal hin- und im Oktober einmal zurückgefahren sind, als Pendler.

> **Die Regel merkt davon nichts.** Support, Konfidenz und Lift sind für die
> Hin-Richtung völlig in Ordnung; die Zahlen stimmen. Falsch war nur die *Geschichte*, die
> daneben stand. Assoziationsregeln erzählen keine Geschichten — sie zählen
> Übereinstimmungen. Die Geschichte kommt vom Menschen davor, und sie muss getrennt
> geprüft werden.

**Was der Pendelstrom für den Transporter bedeutet, ändert sich dadurch übrigens nicht.**
Die Räder laufen am Campus auf, ganz gleich, wer sie dorthin gefahren hat. Die Deutung war
für die Maßnahme nie nötig — nur für die Erzählung. Deshalb fällt sie auch ersatzlos
weg.

### 5.4 Das Urteil: keine Freigabe, und trotzdem kein Fehlschlag

| | |
|---|---|
| **Regeln gefunden** (ab 0,5 % Support) | 32 |
| K1 — Support ≥ 1 % | 0 |
| K2 — kontextbedingter Lift ≥ 1,3 | 9 |
| K3 — handlungsfähig | 16 |
| **alle drei zusammen** | **0** |
| **freigegeben** | **keine** |

Was folgt daraus? Drei Wege, und nur einer ist gangbar:

1. **Die Hürde senken.** Verboten. Sie stand vor der Messung fest — auch jetzt, wo wir
   wissen, dass sie auf der falschen Skala liegt.
2. **Regeln mit mehreren Bedingungen suchen** („Regen **und** Werktag **und** Bahnhof“).
   Das hilft hier **nicht**, und der Grund ist wichtig genug für einen eigenen Absatz.
3. **Zurück zu Phase 1**, das Kriterium in Fahrten je Werktag neu formulieren und die
   Kosten einer Transporterfahrt beschaffen. Das ist ein Gespräch mit der Disposition,
   keine Änderung im Notebook.

> **Warum mehr Bedingungen den Support nicht retten können.** Jede zusätzliche Bedingung
> verkleinert die Menge der Körbe, auf die eine Regel zutrifft — **der Support kann
> dadurch nur sinken, nie steigen.** Das ist keine Eigenheit unserer Daten, sondern eine
> Rechenregel: Wer die Bedingung „und es regnet“ hinzufügt, schließt alle trockenen Tage
> aus. Genau darauf beruht der Apriori-Algorithmus: Er muss Kombinationen mit zu geringem
> Support gar nicht erst prüfen, weil ihre Erweiterungen zwangsläufig noch seltener sind.
> **Spezialisieren erhöht den Lift und senkt den Support** — und knapp ist hier der
> Support.

> **Der Ertrag dieses Notebooks steckt nicht in den Regeln.** Er steckt in Phase 6, die
> ohne jede Regel auskommt — und in zwei Einsichten, die teurer waren als jede
> Regelliste: dass ein Erfolgskriterium auf der falschen Skala nichts misst, und dass
> eine Regel, die stimmt, trotzdem eine falsche Geschichte tragen kann.
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
WERKTAGE = koerbe[koerbe.tagesart == "Werktag"].startzeit.dt.date.nunique()
print(f"Der Datensatz enthält {WERKTAGE} verschiedene Werktage.\\n")

werktag = saldo.loc["Werktag"].reset_index()
tabelle_gesamt = werktag.pivot(index="station", columns="fenster", values="netto").fillna(0)
tabelle = (tabelle_gesamt / WERKTAGE).round(2)

# ---------------------------------------------------------------------
# ZWEI SICHTWEISEN AUF DIESELBEN DATEN - UND NUR EINE TAUGT ALS PLAN.
#
# Der Mittelwert oben ist ein VORZEICHENBEHAFTETER Langfristmittelwert.
# Ein Tag mit +6 und ein Tag mit -6 ergeben darin 0 - und aus "0" liest
# man "nichts zu tun", obwohl an beiden Tagen sechs Raeder zu bewegen
# waren. Der Transporter faehrt aber an einzelnen Tagen, nicht im Mittel.
#
# Deshalb rechnen wir den Saldo JE TAG und sehen uns die Verteilung an.
# ---------------------------------------------------------------------
ang_werktag = angedockte_koerbe[angedockte_koerbe.tagesart == "Werktag"].copy()
ang_werktag["datum"] = ang_werktag.startzeit.dt.normalize()

ab_t = ang_werktag.groupby(["datum", "fenster", "start"], observed=True).size().rename("ab")
zu_t = ang_werktag.groupby(["datum", "fenster", "ziel"], observed=True).size().rename("zu")
je_tag = pd.concat([ab_t, zu_t], axis=1).fillna(0)
je_tag.index.names = ["datum", "fenster", "station"]
je_tag["netto"] = je_tag.zu - je_tag.ab

# Brutto-Ungleichgewicht: wieviele Raeder muessten an diesem Tag in diesem
# Fenster bewegt werden, um alle Stationen auszugleichen? Das ist die Summe
# der Ueberschuesse - jedes ueberzaehlige Rad muss genau einmal gefahren
# werden. Vorzeichen heben sich hier NICHT auf.
bedarf = je_tag.groupby(["datum", "fenster"], observed=True).netto.apply(
    lambda x: x[x > 0].sum())
bedarf_tag = bedarf.groupby("datum").sum()

frei_werktag = None  # wird in der naechsten Zelle geografisch gebildet

plt.figure(figsize=(10, 5))
plt.imshow(tabelle.values, cmap="RdBu_r", aspect="auto",
           vmin=-abs(tabelle.values).max(), vmax=abs(tabelle.values).max())
plt.colorbar(label="Netto-Zugang (blau) / Netto-Abgang (rot)")
plt.xticks(range(len(tabelle.columns)), tabelle.columns, rotation=20)
plt.yticks(range(len(tabelle.index)), tabelle.index)
plt.title("Langfristmittel je Werktag — und genau deshalb irreführend")
plt.tight_layout(); plt.show()

print("(A) DER MITTELWERT — Netto-Saldo je Werktag, über alle Werktage gemittelt:")
print(tabelle.to_string())
print(f"\\n    Größter Überschuss: {tabelle.values.max():.2f} Räder je Werktag")
print(f"    Größter Fehlbestand: {tabelle.values.min():.2f} Räder je Werktag")
print(f"    Zum Vergleich: die Stationen fassen {stationen.kapazitaet.min()} "
      f"bis {stationen.kapazitaet.max()} Räder.")
print("\\n    Gelesen als Betriebsanweisung heisst das: nichts zu tun.")

print("\\n" + "=" * 66)
print("(B) DER TAGESBEDARF — wieviele Räder müssen an einem Werktag bewegt werden?\\n")
print(bedarf.groupby("fenster", observed=True).agg(
    Mittel="mean", Median="median",
    P90=lambda x: x.quantile(0.9), Maximum="max").round(1).to_string())
print(f"\\n    Über alle vier Fenster zusammen, je Werktag:")
print(f"      Mittel {bedarf_tag.mean():.1f}   Median {bedarf_tag.median():.0f}   "
      f"P90 {bedarf_tag.quantile(0.9):.0f}   Maximum {bedarf_tag.max():.0f}")

# Ein einzelnes Beispiel macht den Unterschied greifbar.
bsp = je_tag.xs("Hubland Campus", level="station").xs("früh (0-10)", level="fenster").netto
print(f"\\n    Beispiel Hubland Campus, früh:")
print(f"      Langfristmittel {bsp.mean():+.2f} Räder — Spanne der einzelnen Tage "
      f"{bsp.min():+.0f} bis {bsp.max():+.0f}")
print(f"      An {(bsp.abs() >= 5).mean():.0%} der Werktage weicht der Tagessaldo um "
      f"5 oder mehr Räder ab.")
'''),

CODE('''
# Das vollstaendige Raster: jede Station, jedes Fenster, jeder Werktag.
# Ohne diesen Schritt fehlen Tage, an denen eine Station gar nicht vorkam -
# und genau die sind die Nullen, die den Median nach oben ziehen wuerden.
raster = pd.MultiIndex.from_product(
    [sorted(ang_werktag.datum.unique()), BEZEICHNUNGEN, sorted(tabelle.index)],
    names=["datum", "fenster", "station"])
netto_voll = je_tag.netto.reindex(raster, fill_value=0)

kennzahl = netto_voll.groupby(["fenster", "station"], observed=True).agg(
    Median="median",
    P10=lambda x: x.quantile(0.10),
    P90=lambda x: x.quantile(0.90),
    Tage_ab_5=lambda x: (x.abs() >= 5).mean())

print("UMLAUFPLAN WERKTAG — aus den TAGESSALDEN, nicht aus dem Mittelwert\\n")
for fenster in BEZEICHNUNGEN:
    teil = kennzahl.loc[fenster].sort_values("Median", ascending=False)
    auffaellig = teil[(teil.P90 >= 3) | (teil.P10 <= -3)]
    if auffaellig.empty:
        continue
    print(f"{fenster}")
    for station, z in auffaellig.iterrows():
        richtung = "abholen bei  " if z.Median >= 0 else "auffüllen bei"
        print(f"    {richtung} {station:<24s} Median {z.Median:+.0f}   "
              f"typische Spanne {z.P10:+.0f} bis {z.P90:+.0f}   "
              f"an {z.Tage_ab_5:.0%} der Tage ≥ 5 Räder")
    print()

print(f"Gesamtbedarf: im Mittel {bedarf_tag.mean():.0f} Räder je Werktag, "
      f"an jedem zehnten Werktag {bedarf_tag.quantile(0.9):.0f} oder mehr.")

# =====================================================================
# (2) EINSAMMELN - UND ZWAR DA, WO DIE RAEDER STEHEN.
#
# Eine frühere Fassung gruppierte die frei abgestellten Raeder nach ihrer
# STARTstation. Das beantwortet die Frage "wo hat die Fahrt begonnen" -
# gefragt ist aber "wo steht das Rad jetzt". Beides faellt auseinander:
# die Fahrten haben ein Ende, und end_latitude/end_longitude sind fuer
# JEDE frei abgestellte Fahrt gefuellt. Wir ordnen jedes Rad der Station
# zu, die ihm am naechsten liegt.
# =====================================================================
frei = koerbe[(koerbe.tagesart == "Werktag") & (koerbe.ziel == "frei abgestellt")].copy()
fehlend = frei[["end_latitude", "end_longitude"]].isna().any(axis=1).sum()
print(f"\\nFrei abgestellte Fahrten werktags: {len(frei)}, "
      f"davon ohne Endkoordinate: {fehlend}")

def entfernungen_km(punkt_lat, punkt_lon, st_lat, st_lon):
    """Luftlinie in Kilometern, Haversine - eine Zeile Kugelgeometrie."""
    R = 6371.0
    p1 = np.radians(punkt_lat)[:, None]; p2 = np.radians(st_lat)[None, :]
    dphi = p2 - p1
    dlam = np.radians(st_lon)[None, :] - np.radians(punkt_lon)[:, None]
    return 2 * R * np.arcsin(np.sqrt(
        np.sin(dphi / 2) ** 2 + np.cos(p1) * np.cos(p2) * np.sin(dlam / 2) ** 2))

D = entfernungen_km(frei.end_latitude.values, frei.end_longitude.values,
                    stationen.latitude.values, stationen.longitude.values)
frei["nächste_station"] = stationen.name.values[D.argmin(axis=1)]
frei["abstand_km"] = D.min(axis=1)

# Die Gegenprobe: wie weit ist der Abstellort von der STARTstation entfernt?
start_index = {n: i for i, n in enumerate(stationen.name)}
zeile = np.arange(len(frei))
spalte = frei.start.map(start_index).values
abstand_start = D[zeile, spalte]

print(f"Abstand zum Abstellort ...")
print(f"   ... von der nächsten Station:  Median {np.median(frei.abstand_km):.2f} km, "
      f"P90 {np.quantile(frei.abstand_km, .9):.2f} km")
print(f"   ... von der Startstation:      Median {np.median(abstand_start):.2f} km, "
      f"P90 {np.quantile(abstand_start, .9):.2f} km")
print(f"   Anteil, bei dem die nächste Station NICHT die Startstation ist: "
      f"{(frei['nächste_station'] != frei.start).mean():.1%}")

einsammeln = (frei.groupby(["nächste_station", "fenster"], observed=True).size()
              .unstack(fill_value=0).reindex(columns=BEZEICHNUNGEN, fill_value=0)
              / WERKTAGE).round(2)
nach_start = (frei.groupby(["start", "fenster"], observed=True).size()
              .unstack(fill_value=0).reindex(columns=BEZEICHNUNGEN, fill_value=0)
              / WERKTAGE).round(2)

print(f"\\nEINSAMMELPLAN WERKTAG — Räder je Werktag, nach NÄCHSTER Station:")
print(einsammeln.to_string())
print(f"\\ninsgesamt {len(frei) / WERKTAGE:.1f} Räder je Werktag")

print(f"\\nZum Vergleich die alte, falsche Gruppierung nach Startstation:")
print(nach_start.sum(axis=1).sort_values(ascending=False).head(3).round(2).to_string())
print("gegen die richtige nach Abstellort:")
print(einsammeln.sum(axis=1).sort_values(ascending=False).head(3).round(2).to_string())
print("Die drei Schwerpunkte sind andere. Der Fahrer wäre falsch gefahren.")

kennzahl.round(2).to_csv("umlaufplan_werktag.csv")
einsammeln.to_csv("einsammelplan_werktag.csv")
print()
print("geschrieben: umlaufplan_werktag.csv, einsammelplan_werktag.csv")
print("Beide Dateien enthalten Räder JE WERKTAG, keine Dreijahressummen.")
'''),

MD("""
### 6.1 Der Mittelwert, der den Bedarf verschwinden lässt

Tabelle (A) sieht harmlos aus. Der größte Überschuss beträgt **1,75 Räder je Werktag**,
der größte Fehlbestand **−1,15** — bei Stationen, die 20 bis 40 Räder fassen. Wer nur
diese Tabelle liest, kommt zu einem klaren Schluss: **Für zwei Räder fährt kein
Transporter. Der Plan trägt nicht.**

**Genau dieser Schluss stand in einer früheren Fassung dieses Notebooks, und er war
falsch.** Nicht weil sich jemand verrechnet hätte — die Zahlen in (A) stimmen alle. Falsch
war die **Wahl der Kennzahl**.

Der Mittelwert ist **vorzeichenbehaftet**. Ein Tag mit +6 und ein Tag mit −6 ergeben
zusammen 0. Aus dieser 0 liest man „nichts zu tun“ — obwohl an beiden Tagen sechs Räder zu
bewegen waren. **Der Transporter fährt aber an einzelnen Tagen, nicht im Mittel.**

Tabelle (B) rechnet deshalb den Saldo **je Tag** und zählt dann, wie viele Räder an diesem
Tag zu bewegen wären:

| | Räder je Werktag |
|---|---|
| Mittel | **19,8** |
| Median | 19 |
| an jedem zehnten Werktag mindestens | 32 |
| Maximum | **56** |

**Zwischen „1,75“ und „19,8“ liegt kein neuer Datensatz, sondern eine andere
Aggregation.** Das Beispiel Hubland Campus macht es greifbar: Langfristmittel **+1,86**,
aber die einzelnen Werktage reichen von **−3 bis +14**.

> **Die Regel dahinter gilt weit über dieses Notebook hinaus.** Wenn eine Kennzahl über
> Zeit gemittelt wird und dabei positive und negative Werte enthält, **misst der
> Mittelwert den Trend, nicht die Arbeit.** Für alles, was pro Tag getan werden muss —
> Umverteilen, Personaleinsatz, Lagerauffüllung — braucht man die Verteilung der
> Tageswerte, nicht ihren Schwerpunkt.

**Trägt der Plan denn nun?** Diese Frage beantwortet das Notebook **nicht**, und das ist
kein Versäumnis, sondern eine Grenze. 19,8 Räder je Werktag sind ein realer
Transportbedarf. Ob er eine Transporterfahrt rechtfertigt, hängt an zwei Größen, die uns
fehlen: **was eine Fahrt kostet** und **was ein leerer Stationsplatz kostet**. Dieselben
zwei Zahlen fehlten schon der Ein-Prozent-Hürde in Phase 5. Das ist kein Zufall — es ist
dieselbe Lücke, die an zwei Stellen auftaucht.

> **Eine frühere Fassung druckte hier „+1205 Räder laufen auf“.** Das war die Summe über
> 741 Werktage, gedruckt wie eine Anweisung an den Fahrer. Die Korrektur — durch die
> Werktage teilen — war richtig und hat den Fehler nur verschoben: aus einer zu großen
> Zahl ohne Zeitbezug wurde eine zu kleine Zahl mit falscher Aggregation. **Erst der
> Tagessaldo beantwortet die Frage, die gestellt war.**

### 6.2 Der Umlaufplan: Richtung ja, Menge nur als Spanne

Was Tabelle (B) und der Umlaufplan hergeben, ist die **Richtung**: Morgens laufen Hubland
Campus und Universität Sanderring auf, während Hauptbahnhof, Sanderau, Zellerau und
Grombühl sich leeren. Das ist stabil und über die Tage hinweg verlässlich.

Was sie **nicht** hergeben, ist die Stückzahl für einen bestimmten Morgen. Der Median liegt
bei ±1 Rad, die typische Spanne bei −4 bis +4, und an rund jedem zehnten Werktag sind es
fünf oder mehr. **Ein Umlaufplan aus historischen Daten kann deshalb nur sagen, wo der
Transporter hinfahren soll — wie viele Räder er lädt, muss er vor Ort entscheiden.**

Deshalb steht im exportierten Plan auch nicht eine Zahl je Station, sondern Median und
Spanne. Eine einzelne Zahl würde eine Genauigkeit vortäuschen, die in den Daten nicht
steckt.

### 6.3 Das Einsammeln — und wo die Räder wirklich stehen

Werktäglich bleiben **10,7 Räder** frei im Gebiet zurück. Diese Runde braucht keine
einzige Assoziationsregel; sie folgt direkt aus der Auszählung.

Nur muss man dafür wissen, **wo** die Räder stehen. Eine frühere Fassung dieses Notebooks
gruppierte sie nach ihrer **Startstation** — und das ist keine Ortsangabe, sondern eine
Herkunftsangabe:

| | Median | an 9 von 10 Fahrten höchstens |
|---|---|---|
| Abstand des Rades zur **nächsten** Station | 0,30 km | 0,58 km |
| Abstand des Rades zur **Start**station | 1,27 km | 3,03 km |

**Bei 87,1 % der frei abgestellten Räder ist die nächstgelegene Station eine andere als
die, an der die Fahrt begann.** Die Gruppierung nach Startstation war also nicht ungenau —
sie war in fast neun von zehn Fällen die falsche Station. Die drei Schwerpunkte
verschieben sich entsprechend: Nach Abstellort sind es **Residenz, Universität
Sanderring und Hauptbahnhof**, nach Startstation wären es Grombühl, Sanderau und
Zellerau gewesen.

> **Der Fehler war nicht, die Endkoordinaten falsch zu benutzen — sondern sie gar nicht
> zu benutzen.** `end_latitude` und `end_longitude` sind für **jede** frei abgestellte
> Fahrt gefüllt, alle 7 914. Wer eine Frage nach dem Ort mit einer Spalte beantwortet, in
> der keine Orte stehen, bekommt eine plausible Tabelle und einen falsch fahrenden
> Transporter.

**Der Ertrag dieses Notebooks ist damit Plan B, nicht Plan A** — und Plan B kommt ohne
Regeln aus.

### 6.4 Was dieser Plan ist — und was nicht

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

### 6.5 Überwachung — und zwar von dem, was tatsächlich läuft

Eine frühere Fassung überwachte hier „Lift und Support der Leitregeln“. Das war
unmöglich: **Es wurde keine einzige Regel freigegeben.** Man kann nicht überwachen, was
nicht im Einsatz ist.

Im Einsatz ist der Einsammelplan aus 6.3. Also wird der überwacht:

| Wache | Schwelle | Reaktion |
|---|---|---|
| Räder je Werktag im Einsammelplan | weicht zwei Wochen lang um mehr als ein Drittel ab | Nutzungsverhalten hat sich geändert — neu auszählen |
| Schwerpunkt-Station wechselt | zwei Monate in Folge | Route anpassen |
| Anteil frei abgestellter Fahrten | steigt über 25 % oder fällt unter 15 % | Geschäftsgebiet oder Preismodell wurde geändert |
| Tagesbedarf beim Umverteilen (Tabelle B) | P90 überschreitet 40 Räder | Umverteilung neu bewerten — dann lohnt sie womöglich |
| neue Station im Netz | taucht auf | **alles neu rechnen** — siehe unten |
| Baustelle oder Sperrung | gemeldet | betroffene Wege aussetzen, nicht nachjustieren |

**Die vorletzte Zeile gilt auch für die Regeln, falls sie je zum Einsatz kämen.** Der Lift
misst gegen die Basisrate der Ziele im Kontext. Kommt eine elfte Station dazu, verschiebt
sich diese Basisrate für **jede** Regel — auch für solche, die mit der neuen Station
nichts zu tun haben. Assoziationsregeln sind nicht fortschreibbar; sie müssen neu
gerechnet werden.

### 6.6 Ein Hinweis, der nicht fehlen darf

Diese Analyse arbeitet mit **Bewegungsdaten von Personen**. Für den Einsammel- und den
Umlaufplan brauchen wir sie nur aggregiert — und genau so sollten beide auch entstehen.

Die Gegenprobe in Phase 5 ist etwas anderes: Sie greift auf `kunde_id` und Datum zurück
und fragt, wer an welchem Tag welchen Weg gefahren ist. **Das ist ein Bewegungsprofil.**
Dass es hier zur Widerlegung einer eigenen Behauptung diente, macht es nicht harmloser.
Für eine solche Auswertung braucht es eine Rechtsgrundlage und einen Zweck, der über
„wir wollten es genau wissen“ hinausgeht — und im Regelbetrieb hat sie nichts zu suchen.
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
| 5 Evaluation | Von 32 Regeln nehmen 9 die Lift-, 16 die Handlungs-, aber **keine** die Support-Hürde. Die stärkste verfehlt sie um fünf Fahrten in drei Jahren — und die Hürde wird trotzdem nicht gesenkt, obwohl sich zeigt, dass sie auf der falschen Skala liegt. Die Deutung des Pendelstroms wurde von der tagesgenauen Gegenprobe **widerlegt**: null Hin- und Rückfahrten am selben Tag |
| 6 Deployment | Der Langfristmittelwert zeigte 1,75 Räder je Werktag und damit keinen Bedarf; der **Tagessaldo** zeigt 19,8, im Maximum 56. Freigegeben wird die Einsammelrunde: 10,7 Räder je Werktag, verortet über die **End**koordinaten — bei 87 % von ihnen ist die nächste Station eine andere als die Startstation |

**Die drei Sätze, die aus diesem Notebook bleiben**

> **1.** Ein Mittelwert über Plus und Minus misst den Trend, nicht die Arbeit. „1,75 Räder
> je Werktag“ und „19,8 Räder je Werktag“ sind derselbe Datensatz, zweimal aggregiert.

> **2.** Ein Erfolgskriterium muss in der Einheit formuliert sein, in der es begründet
> wurde. Eine Hürde, die zwischen 0,68 und 0,69 Fahrten je Werktag entscheidet, misst
> nichts — und darf trotzdem nicht nachträglich verschoben werden.

> **3.** Eine Regel, deren Zahlen stimmen, kann eine falsche Geschichte tragen. 49
> Personen fuhren „beide Richtungen“ — an keinem einzigen gemeinsamen Tag.

**Was eine zweite Runde anders machen würde**

1. **Das Erfolgskriterium neu formulieren** — in Fahrten je Werktag, hergeleitet aus den
   Kosten einer Transporterfahrt. Diese Kosten zu beschaffen ist die erste Aufgabe, nicht
   die letzte. **Vor** der nächsten Messung.
2. **Die Regelsuche und ihre Prüfung trennen.** Wir haben die 32 Regeln auf demselben
   Datensatz gefunden **und** bewertet. Wer sucht und prüft, wo er gesucht hat, findet
   seine eigenen Zufälle wieder. Sauber wäre: auf den ersten zwei Jahren suchen, am
   dritten prüfen — so wie es Notebook 4 mit seinen Zeitscheiben vormacht.
3. **Zurück zu Phase 3:** Die vier Zeitfenster sind gesetzt, nicht gefunden. Eine
   Aufteilung nach den tatsächlichen Spitzen (aus Notebook 3!) könnte schärfere Regeln
   liefern. Die Untergrenze von 0,5 % Support gehört dabei mit auf den Prüfstand — sie
   hat die zweitstärkste Verbindung des Datensatzes aussortiert, bevor sie jemand
   gesehen hat.
4. **Die Richtung im Blick behalten.** Support und Lift sind symmetrisch: Vertauscht man
   Start und Ziel, bleiben beide gleich. Die **Konfidenz** ist es nicht — sie teilt durch
   die Fahrten ab dem Start und ändert sich, wenn man die Richtung dreht. Und keine der
   drei Kennzahlen kennt ein *weil*: Dass morgens Räder zum Campus fahren, sagt nichts
   darüber, ob die Vorlesung der Grund ist. Für den Transporter ist die Fahrtrichtung
   dasselbe Stück Straße, für eine Werbekampagne nicht.

**Weiter geht es mit Notebook 6 — Anomalieerkennung:** Dort suchen wir nicht das Muster,
sondern seine Ausnahmen. Und wir werden feststellen, dass die schwierigste Frage nicht
lautet „was ist auffällig?“, sondern „**was davon ist ein Problem?**“
"""),
]
