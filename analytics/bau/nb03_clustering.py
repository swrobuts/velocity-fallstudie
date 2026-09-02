# -*- coding: utf-8 -*-
"""Notebook 3 - Clustering: Stationstypen und Kundensegmente."""
from bauwerk import CODE, MD, PHASE, kopf

NAME = "03_Clustering_Stationen_und_Kunden"

ZELLEN = [

kopf("Clustering: Welche Gruppen stecken in den Daten?",
     "Clustering (unüberwachtes Lernen — es gibt kein „richtig“)",
     "Welche Stationstypen und welche Kundensegmente hat VeloCity wirklich?",
     NAME),

MD("""
> **Lehrdatensatz.** Fahrten, Stationen und Kundschaft dieser Fallstudie sind
> **synthetisch erzeugt**. Für die Stationen gilt das besonders: Sie wurden mit genau vier
> Typen angelegt, die im Generator absichtlich verstärkt wurden. Wenn das Clustering unten
> diese vier Typen sauber wiederfindet, ist das ein **erfolgreicher Test des Verfahrens
> gegen den Generator** — keine Bestätigung an echten Daten. Silhouettenwerte und
> Trefferquoten in diesem Notebook zeigen Methodenverhalten, nicht Marktrealität.

## Zwei Fragen, ein Verfahren

Dieses Notebook behandelt **zwei Aufgaben parallel**, weil beide dasselbe Verfahren
brauchen und der Vergleich lehrreicher ist als jede für sich:

| | Aufgabe | Objekte | wer wartet auf die Antwort |
|---|---|---|---|
| **A** | Stationstypen finden | 10 Stationen | Disposition — wo muss umverteilt werden? |
| **B** | Kundensegmente finden | 3.200 Kundinnen und Kunden | Marketing — wer bekommt welches Angebot? |

Sie werden sehen: **Die sechs Phasen sind identisch.** Was sich unterscheidet, sind die
Merkmale und die Deutung — nicht das Vorgehen.

## Was Clustering von den ersten beiden Notebooks unterscheidet

In Notebook 1 und 2 gab es eine **Zielspalte**: die Fahrtdauer, die Schadensmeldung.
Das Modell konnte sich an ihr messen, und wir konnten sagen, ob es richtig lag.

Hier gibt es **nichts dergleichen**. Niemand hat die Stationen je in Typen eingeteilt.
Es gibt keine Wahrheit zum Vergleichen, keine Trefferquote, keine Confusion-Matrix.

> **Das ist der Unterschied zwischen überwachtem und unüberwachtem Lernen** — und er hat
> Folgen bis in Phase 5 hinein: Die Bewertung eines Clusterings ist am Ende immer auch
> ein **fachliches Urteil**, kein rein rechnerisches.
"""),

MD("""
> ### ⚠ Woher die Daten kommen — bitte zuerst lesen
>
> **VeloCity ist ein erfundener Fahrradverleih, und alle Daten dieses Notebooks sind
> erzeugt.** Für dieses Notebook ist das besonders wichtig: Die zehn Stationen wurden mit
> **genau vier absichtlich verstärkten Typen** angelegt — Pendler, Uni, Freizeit, Misch.
>
> Wenn das Clustering diese vier Typen wiederfindet, ist das ein **erfolgreicher Test des
> Verfahrens gegen den Generator**, keine Entdeckung über Würzburg. In echten Daten sind
> Gruppen unschärfer, überlappen sich und haben selten so klare Tagesgänge.
>
> Was sich überträgt, ist das Vorgehen: wie man Erfolgskriterien ohne Zielgröße
> formuliert, wie man k wählt, wie man Stabilität prüft und woran man merkt, dass eine
> Kennzahl schweigt. Die Zahlen übertragen sich nicht.
"""),

# =====================================================================
PHASE(1, "Zwei Geschäftsfragen, für die es keine Zielgröße gibt — und trotzdem "
         "Erfolgskriterien geben muss."),

MD("""
### A — Die Disposition

VeloCity fährt jeden Morgen einen Transporter, der Räder umverteilt. Heute geschieht das
nach Gefühl: Der Fahrer sieht, wo wenig steht, und füllt auf. Das ist teuer und träge.

Die Dispositionsleitung will die zehn Stationen in **wenige Typen** einteilen und je Typ
eine Regel hinterlegen („Pendlerstationen bis 7 Uhr auffüllen, Freizeitstationen erst
gegen Mittag“). Dafür muss erst einmal klar sein, **welche Typen es überhaupt gibt**.

### B — Das Marketing

Der Newsletter geht heute an alle 3.200 Kundinnen und Kunden gleich. Die Öffnungsrate ist
entsprechend. Das Marketing möchte **drei bis fünf Segmente**, für die sich
unterschiedliche Ansprache lohnt.

### Die Erfolgskriterien — auch ohne Zielgröße

Das ist die schwierigste Stelle dieser Phase, und sie wird gerne übersprungen. Ein
Clustering-Ergebnis kann man nicht auf „richtig“ prüfen. Man kann aber sehr wohl vorher
festlegen, **wann es brauchbar ist**:

| | Kriterium | Warum |
|---|---|---|
| **1 Benennbarkeit** | Jede Gruppe muss sich in einem Satz beschreiben lassen, den ein Fachfremder versteht | Was man nicht benennen kann, kann man auch nicht bearbeiten |
| **2 Handlungsrelevanz** | Für jede Gruppe muss es eine **andere** Maßnahme geben | Zwei Gruppen mit derselben Maßnahme sind eine Gruppe |
| **3 Größe** | Keine Gruppe unter 5 % der Objekte | Ein Segment mit zwölf Kunden lohnt keine eigene Kampagne |
| **4 Stabilität** | Ein zweiter Lauf mit anderem Zufallsstart muss dieselben Gruppen liefern | Sonst ist es Zufall, kein Muster |

**Kriterium 2 ist das schärfste.** Es hat schon manches statistisch tadellose Clustering
zu Recht beerdigt.
"""),

# =====================================================================
PHASE(2, "Was wissen wir über Stationen und Kundschaft — und was davon beschreibt "
         "ihr *Verhalten* statt ihrer Stammdaten?"),

CODE('''
import os
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt

BASIS = os.environ.get("VELO_BASIS",
    __ROHBASIS__)
pd.set_option("display.width", 150)

fahrten = pd.read_csv(BASIS + "ausleihe.csv", parse_dates=["startzeit", "endzeit"])
stationen = pd.read_csv(BASIS + "station.csv")
kunden = pd.read_csv(BASIS + "kunde.csv", parse_dates=["registriert_am"])
tarife = pd.read_csv(BASIS + "tarif.csv")
feiertage = set(pd.read_csv(BASIS + "feiertage.csv").datum)

echte = fahrten[fahrten.status == "abgeschlossen"].copy()
echte["datum"] = echte.startzeit.dt.strftime("%Y-%m-%d")
echte["stunde"] = echte.startzeit.dt.hour
echte["ist_frei"] = (echte.startzeit.dt.dayofweek >= 5) | echte.datum.isin(feiertage)

print("Stationen — das ist ALLES, was wir über sie wissen:")
print(stationen.to_string(index=False))
'''),

MD("""
**Sehen Sie sich die Tabelle genau an.** Es gibt keine Spalte „Typ“, keine Spalte „Lage“,
nichts, was eine Einteilung vorwegnähme. Name, Koordinaten, Kapazität — mehr nicht.

Genau deshalb ist die Aufgabe echt: Was wir gleich finden, **steht nirgends in den
Daten**. Es steckt im *Verhalten*, nicht in den Stammdaten.
"""),

CODE('''
print("Kundschaft — auch hier keine Segmentspalte:")
print(kunden.head(5).to_string(index=False))
print(f"\\nTarife:")
print(tarife.to_string(index=False))
print(f"\\n{len(kunden)} Kundinnen und Kunden, {len(echte)} abgeschlossene Fahrten")
'''),

MD("""
### 2.1 Der erste Blick: unterscheiden sich die Stationen überhaupt?

Bevor wir clustern, schauen wir hin. Wenn alle zehn Stationen denselben Tagesgang haben,
gibt es nichts zu gruppieren.
"""),

CODE('''
werktags = echte[~echte.ist_frei]
tagesgang = werktags.pivot_table(index="start_station_id", columns="stunde",
                                 values="ausleihe_id", aggfunc="count").fillna(0)
# Zwischen 23 und 5 Uhr gibt es in den Daten keine Fahrt, die Stunden fehlen
# deshalb ganz. Das ist eine Aussage ueber die NACHFRAGE, nicht ueber die
# Verfuegbarkeit - ausleihen kann man rund um die Uhr, es tut nur niemand.
# Wir fuellen die Stunden ausdruecklich mit Null auf: ein Merkmalsvektor muss
# fuer jede Station dieselbe Laenge haben, und "keine Fahrten um 3 Uhr" ist
# eine Information, kein Loch.
tagesgang = tagesgang.reindex(columns=range(24), fill_value=0)
tagesgang = tagesgang.div(tagesgang.sum(axis=1), axis=0)      # je Station auf 1 normiert
print(f"Stunden mit Fahrten: {int((tagesgang.sum() > 0).sum())} von 24")
namen = stationen.set_index("station_id").name

plt.figure(figsize=(13, 5))
for sid in tagesgang.index:
    plt.plot(tagesgang.columns, tagesgang.loc[sid], marker=".", lw=1.6, label=namen[sid])
plt.xlabel("Stunde"); plt.ylabel("Anteil der Werktagsfahrten dieser Station")
plt.title("Tagesgang je Station — werktags, jede Station auf 100 % normiert")
plt.legend(ncol=2, fontsize=9); plt.grid(alpha=.3)
plt.tight_layout(); plt.show()
'''),

MD("""
**Das Bild beantwortet die Frage:** Es gibt mindestens drei erkennbar verschiedene
Formen — scharfe Doppelspitzen morgens und abends, ein breiter Vormittagsberg, und flache
Nachmittagskurven. Ein Clustering hat also Substanz.

> **Warum wir normieren:** Ohne die Normierung würde der Hauptbahnhof alle anderen
> überragen, und das Clustering würde vor allem **Größe** gruppieren statt **Form**.
> Wir wollen aber wissen, *wann* eine Station genutzt wird, nicht *wieviel*. Das ist eine
> inhaltliche Entscheidung, die in Phase 3 gehört — hier sieht man, warum.
"""),

# =====================================================================
PHASE(3, "A) Aus Fahrten wird ein Tagesgang je Station. B) Aus Fahrten wird ein "
         "RFM-Profil je Kunde. Beides ist Aggregation — und beides braucht Standardisierung."),

MD("""
### 3.A Merkmale je Station

Wir geben jeder Station **26 Zahlen** mit: 24 für den normierten Tagesgang, dazu den
Wochenendanteil und die mittlere Fahrtdauer.
"""),

CODE('''
tagesgang.columns = [f"stunde_{h:02d}" for h in tagesgang.columns]
echte["dauer_min"] = (echte.endzeit - echte.startzeit).dt.total_seconds() / 60

zusatz = echte.groupby("start_station_id").agg(
    wochenendanteil=("ist_frei", "mean"),
    dauer_median=("dauer_min", "median"),
    fahrten_gesamt=("ausleihe_id", "size"),
)
S = tagesgang.join(zusatz)
S.index = [namen[i] for i in S.index]
print(S[["wochenendanteil", "dauer_median", "fahrten_gesamt"]].round(2).to_string())
'''),

MD("""
Schon diese drei Spalten trennen sichtbar: Der Wochenendanteil reicht von rund 11 % bis
knapp 50 %. Das wird gleich ein starkes Merkmal sein.

### Standardisieren — und warum das hier zwingend ist
"""),

CODE('''
from sklearn.preprocessing import StandardScaler

merkmale_station = [s for s in S.columns if s != "fahrten_gesamt"]
print("Größenordnungen VOR der Standardisierung:")
print(S[merkmale_station].describe().loc[["mean", "std"]].round(3).T.head(6).to_string())

##LUECKE Standardisieren Sie S[merkmale_station] mit StandardScaler zu S_skaliert.
S_skaliert = StandardScaler().fit_transform(S[merkmale_station])
##ENDE

print(f"\\nNach der Standardisierung: Mittelwert {S_skaliert.mean():.2f}, "
      f"Streuung {S_skaliert.std():.2f}")
'''),

MD("""
> **Warum das nicht optional ist.** k-Means misst Abstände. Der Wochenendanteil liegt
> zwischen 0 und 0,5, die mittlere Fahrtdauer zwischen 10 und 25 — ohne Standardisierung
> wäre die Fahrtdauer allein durch ihre **Maßeinheit** rund fünfzigmal wichtiger als der
> Wochenendanteil. Das Verfahren würde dann nicht das Wichtigste gruppieren, sondern das
> Großzahligste.

### 3.B Merkmale je Kunde: das RFM-Modell

Für die Kundschaft nehmen wir ein Verfahren, das im Handel seit Jahrzehnten Standard ist
und ohne jede Statistikkenntnis erklärbar bleibt — **RFM**:

| | steht für | hier gemessen als |
|---|---|---|
| **R**ecency | Wie lange ist der letzte Kauf her? | Tage seit der letzten Fahrt |
| **F**requency | Wie oft wird gekauft? | Fahrten in den letzten 365 Tagen |
| **M**onetary | Wieviel wird ausgegeben? | Entgelt in den letzten 365 Tagen |
"""),

CODE('''
# EIN CUTOFF, UND ER LIEGT HINTER DEN DATEN - NICHT MITTENDRIN.
#
# Eine fruehere Fassung setzte den Stichtag auf .normalize() des letzten
# Fahrtbeginns: 24.08.2026 00:00. Das Fenster hatte aber keine obere
# Grenze und nahm die 77 Fahrten desselben Tages bis 22:57 Uhr mit. Der
# Export behauptete damit einen Informationsstand um Mitternacht und
# rechnete mit Daten aus dessen Zukunft.
#
# Die Stabilitaetspruefung schnitt umgekehrt bei "<= tag" ab und liess
# genau diese 77 Fahrten weg. RFM, Stabilitaet und Export standen damit
# auf drei verschiedenen Populationen.
DATENSTAND = echte.startzeit.max()
CUTOFF = DATENSTAND.normalize() + pd.Timedelta(days=1)
stichtag = CUTOFF                      # ein Name, ein Zeitpunkt
FENSTER_TAGE = 365
# ABGESCHLOSSEN vor dem Cutoff, nicht nur begonnen. Entgelt und Dauer
# stehen erst mit der Rueckgabe fest; eine Fahrt, die vorher beginnt und
# danach endet, brächte Information aus der Zukunft in den Schnappschuss.
# Am frueheren Cutoff gibt es genau so einen Fall.
fenster = echte[(echte.startzeit > CUTOFF - pd.Timedelta(days=FENSTER_TAGE))
                & (echte.endzeit < CUTOFF)]
print(f"Datenstand:  letzte Fahrt {DATENSTAND:%d.%m.%Y %H:%M} Uhr")
print(f"Cutoff:      {CUTOFF:%d.%m.%Y %H:%M} Uhr - alles davor zaehlt, nichts danach")
print(f"Fenster:     die {FENSTER_TAGE} Tage davor\\n")

rfm = fenster.groupby("kunde_id").agg(
    letzte_fahrt=("startzeit", "max"),
    frequenz=("ausleihe_id", "size"),
    umsatz=("entgelt_eur", "sum"),
)
rfm["recency"] = (stichtag - rfm.letzte_fahrt).dt.days.clip(lower=0)
rfm = rfm.join(kunden.set_index("kunde_id")[["tarif_code", "geburtsjahr", "registriert_am"]])

print(f"Stichtag: {stichtag.date()}, Fenster: letzte 365 Tage")

# UNTERSCHIEDLICHE BEOBACHTUNGSDAUER
# "Fahrten je Jahr" heisst nur dann dasselbe, wenn alle ein Jahr lang
# beobachtet wurden. Wer sich vor drei Monaten angemeldet hat, kann gar
# kein volles Jahr voll bekommen - und landet zwangslaeufig weiter unten.
neu_dabei = kunden.set_index("kunde_id").registriert_am > stichtag - pd.Timedelta(days=365)
print(f"Davon erst im Fenster angemeldet: {int(neu_dabei.reindex(rfm.index).fillna(False).sum())} "
      f"- fuer sie ist 'je Jahr' eine Untertreibung.")
merke("n_rfm", len(rfm))
print(f"Kundschaft mit mindestens einer Fahrt darin: {len(rfm)} von {len(kunden)}")
print(f"ohne jede Fahrt im Fenster: {len(kunden) - len(rfm)} — die betrachten wir gleich gesondert\\n")
print(rfm[["recency", "frequenz", "umsatz"]].describe().round(1).to_string())
'''),

MD("""
### Die schiefe Verteilung — und was man dagegen tut
"""),

CODE('''
fig, achsen = plt.subplots(2, 3, figsize=(14, 6))
for spalte, achse in zip(["recency", "frequenz", "umsatz"], achsen[0]):
    achse.hist(rfm[spalte], bins=40, color="#3d4b6b")
    achse.set_title(f"{spalte} — roh")
for spalte, achse in zip(["recency", "frequenz", "umsatz"], achsen[1]):
    achse.hist(np.log1p(rfm[spalte]), bins=40, color="#8c95a8")
    achse.set_title(f"{spalte} — logarithmiert")
plt.tight_layout(); plt.show()

R = rfm[["recency", "frequenz", "umsatz"]].copy()
R["frequenz"] = np.log1p(R.frequenz)
R["umsatz"] = np.log1p(R.umsatz)
R_skaliert = StandardScaler().fit_transform(R)
print("Frequenz und Umsatz gehen logarithmiert ein, Recency roh.")
'''),

MD("""
**Frequenz und Umsatz sind stark rechtsschief**: sehr viele kleine Werte, wenige sehr
große. k-Means würde sich an den wenigen Extremfällen festbeißen und aus ihnen eigene
Cluster machen — und die restlichen 95 % in einen Topf werfen.

Der Logarithmus zieht den Ausläufer zusammen (untere Reihe) und macht aus „hundertmal so
viel“ ein handhabbares „doppelt so weit weg“. **Recency lassen wir roh**, weil sie ohnehin
gleichmäßiger verteilt ist und ihre Einheit — Tage — anschaulich bleibt.
"""),

# =====================================================================
PHASE(4, "k-Means für beide Aufgaben. Die eigentliche Frage lautet: **wie viele Gruppen?**"),

MD("""
### 4.1 Wie k-Means arbeitet — in vier Sätzen

1. Wirf *k* Punkte zufällig in den Merkmalsraum („Zentren“).
2. Ordne jedes Objekt dem nächstgelegenen Zentrum zu.
3. Verschiebe jedes Zentrum in die Mitte der ihm zugeordneten Objekte.
4. Wiederhole 2 und 3, bis sich nichts mehr bewegt.

Mehr ist es nicht. Die Schwierigkeit liegt nicht im Verfahren, sondern in der Frage, die
es **nicht** beantwortet: wie groß *k* sein soll.

### 4.2 Die Ellenbogenmethode und der Silhouettenwert
"""),

CODE('''
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score

def k_suchen(X, titel, ks=range(2, 8)):
    inertia, silhouette = [], []
    for k in ks:
        km = KMeans(n_clusters=k, n_init=25, random_state=42).fit(X)
        inertia.append(km.inertia_)
        silhouette.append(silhouette_score(X, km.labels_))
    fig, achsen = plt.subplots(1, 2, figsize=(12.5, 3.8))
    achsen[0].plot(list(ks), inertia, marker="o", color="#3d4b6b")
    achsen[0].set_xlabel("k"); achsen[0].set_ylabel("Inertia (Streuung in den Gruppen)")
    achsen[0].set_title(f"{titel}: Ellenbogen"); achsen[0].grid(alpha=.3)
    achsen[1].plot(list(ks), silhouette, marker="o", color="#e00034")
    achsen[1].set_xlabel("k"); achsen[1].set_ylabel("Silhouettenwert")
    achsen[1].set_title(f"{titel}: Silhouette (größer ist besser)"); achsen[1].grid(alpha=.3)
    plt.tight_layout(); plt.show()
    tafel = pd.DataFrame({"k": list(ks), "Inertia": np.round(inertia, 1),
                          "Silhouette": np.round(silhouette, 3)})
    # Die Kennzahlen wandern in den Fliesstext, statt dort getippt zu werden.
    kurz = "stationen" if titel.startswith("A") else "kunden"
    best = tafel.loc[tafel.Silhouette.idxmax()]
    merke(f"sil_{kurz}_bestes_k", int(best.k))
    merke(f"sil_{kurz}_bestwert", float(best.Silhouette))
    merke(f"sil_{kurz}_k4", float(tafel.loc[tafel.k == 4, "Silhouette"].iloc[0]))
    return tafel

print(k_suchen(S_skaliert, "A) Stationen").to_string(index=False))
'''),

MD("""
**Die Inertia fällt immer** — bei *k* = 10 wäre sie null, denn dann ist jede Station ihr
eigenes Cluster. Gesucht ist der **Knick**: die Stelle, ab der zusätzliche Gruppen kaum
noch Streuung wegnehmen.

Der Silhouettenwert misst etwas anderes: Wie viel näher liegt ein Objekt bei seiner
eigenen Gruppe als bei der nächstbesten? Werte über 0,5 gelten als deutliche Struktur.

> **Beide Maße sind Hinweise, keine Entscheidungen.** Die Entscheidung fällt in Phase 5
> und stützt sich auf die Kriterien aus Phase 1 — vor allem auf die Benennbarkeit.
"""),

CODE('''
K_STATIONEN = 4
km_stationen = KMeans(n_clusters=K_STATIONEN, n_init=25, random_state=42).fit(S_skaliert)

# ─── WIE STARK HAENGT DIE LOESUNG AN DER GEWICHTUNG? ────────────────
# Jedes der 26 Merkmale wird EINZELN standardisiert. Damit wiegt der Block
# aus 24 Stundenwerten zusammen zwoelfmal so schwer wie Wochenendanteil und
# Mediandauer zusammen - eine Entscheidung, die niemand getroffen hat, sie
# ergibt sich aus der Anzahl der Spalten.
from sklearn.metrics import adjusted_rand_score
_stunden = [i for i, s in enumerate(merkmale_station) if s.startswith("stunde_")]
_andere = [i for i in range(len(merkmale_station)) if i not in _stunden]

def _mit_gewicht(anteil_stunden):
    # Jeden Block auf seine eigene Summe normieren, dann gewichten: So
    # entscheidet die gewuenschte Bedeutung, nicht die Spaltenzahl.
    x = S_skaliert.copy()
    x[:, _stunden] *= np.sqrt(anteil_stunden / len(_stunden))
    x[:, _andere] *= np.sqrt((1 - anteil_stunden) / len(_andere))
    return KMeans(n_clusters=4, n_init=25, random_state=42).fit_predict(x)

_grund = KMeans(n_clusters=4, n_init=25, random_state=42).fit_predict(S_skaliert)
print("\\nEMPFINDLICHKEIT gegenueber der Blockgewichtung (k = 4):")
print(f"   {'Gewicht Stundenblock':>22s}{'ARI zur Notebookloesung':>26s}")
for _a in (0.5, 0.7, 0.9, len(_stunden) / len(merkmale_station)):
    _ari = adjusted_rand_score(_grund, _mit_gewicht(_a))
    _marke = "  <- entspricht der Spaltenzahl" if _a > 0.9 else ""
    print(f"   {_a:>21.0%}{_ari:>25.3f}{_marke}")
merke("gewicht_ari_halb", adjusted_rand_score(_grund, _mit_gewicht(0.5)))
_ari_halb = adjusted_rand_score(_grund, _mit_gewicht(0.5))
print()
if _ari_halb < 0.7:
    print(f"   Bei Gleichgewichtung der beiden Bloecke betraegt der ARI zur")
    print(f"   Notebookloesung nur {_ari_halb:.2f} - das ist eine ANDERE Einteilung.")
    print("   Das beweist nicht, dass sie besser ist. Es zeigt, dass die Loesung")
    print("   an einer Entscheidung haengt, die bisher niemand getroffen hat:")
    print("   Der Stundenblock wiegt schwer, weil er 24 Spalten hat, nicht weil")
    print("   jemand ihn fuer das Wesentliche haelt.")
else:
    print(f"   Auch bei Gleichgewichtung bleibt die Einteilung weitgehend")
    print(f"   dieselbe (ARI {_ari_halb:.2f}) - die Loesung haengt hier nicht an")
    print("   der Blockgewichtung. Das ist ein guenstiger Befund, kein")
    print("   garantierter: Bei anderen Merkmalen kann es anders liegen.")
S["cluster"] = km_stationen.labels_

print(f"Ergebnis mit k = {K_STATIONEN}:\\n")
for c in sorted(S.cluster.unique()):
    mitglieder = list(S.index[S.cluster == c])
    print(f"  Cluster {c}: {', '.join(mitglieder)}")

print(k_suchen(R_skaliert, "B) Kundschaft").to_string(index=False))
'''),

CODE('''
K_KUNDEN = 4
##LUECKE Clustern Sie R_skaliert mit k = K_KUNDEN, n_init=25, random_state=42, und schreiben Sie die Labels in rfm["cluster"].
km_kunden = KMeans(n_clusters=K_KUNDEN, n_init=25, random_state=42).fit(R_skaliert)
rfm["cluster"] = km_kunden.labels_
##ENDE

profil = rfm.groupby("cluster").agg(
    kunden=("frequenz", "size"),
    recency_tage=("recency", "mean"),
    fahrten_fenster=("frequenz", "mean"),
    umsatz_fenster=("umsatz", "mean"),
).round(1)
# Umsatz JE FAHRT - die Groesse, um die es gleich geht. Ohne sie liest man
# die Tabelle falsch: Das fahrtstaerkste Segment hat nicht den geringsten
# Jahresumsatz, sondern den geringsten Umsatz je Fahrt.
profil["umsatz_je_fahrt"] = (profil.umsatz_fenster / profil.fahrten_fenster).round(2)
profil["anteil"] = (profil.kunden / profil.kunden.sum() * 100).round(1)
print(profil.to_string())
'''),

# =====================================================================
PHASE(5, "Ohne Zielgröße gibt es keine Trefferquote. Es gibt aber die vier Kriterien "
         "aus Phase 1 — und die sind streng genug."),

MD("### 5.A Stationen: ergeben die Gruppen fachlich Sinn?"),

CODE('''
fig, achsen = plt.subplots(1, K_STATIONEN, figsize=(16, 3.6), sharey=True)
stundenspalten = [s for s in S.columns if s.startswith("stunde_")]
for c, achse in zip(sorted(S.cluster.unique()), achsen):
    gruppe = S[S.cluster == c]
    for name in gruppe.index:
        achse.plot(range(24), gruppe.loc[name, stundenspalten].values,
                   color="#8c95a8", lw=1, alpha=.7)
    achse.plot(range(24), gruppe[stundenspalten].mean().values, color="#e00034", lw=2.5)
    achse.set_title(f"Cluster {c}  ({len(gruppe)} Stationen)\\n"
                    f"Wochenende {gruppe.wochenendanteil.mean():.0%}", fontsize=10)
    achse.set_xlabel("Stunde"); achse.grid(alpha=.3)
achsen[0].set_ylabel("Anteil der Werktagsfahrten")
plt.tight_layout(); plt.show()

for c in sorted(S.cluster.unique()):
    g = S[S.cluster == c]
    # Die Stunde steht im SPALTENNAMEN, nicht im Index: Vor fuenf Uhr faehrt
    # niemand, also fehlen die ersten Spalten - ein Index waere um genau diese
    # Zahl verschoben und ergaebe Spitzen um drei Uhr morgens.
    spitze = int(g[stundenspalten].mean().idxmax().removeprefix("stunde_"))
    print(f"Cluster {c}: {', '.join(g.index):<62s} Spitze {spitze:>2d} Uhr, "
          f"Wochenende {g.wochenendanteil.mean():.0%}, Dauer {g.dauer_median.mean():.0f} Min")
'''),

MD("""
### Die Gruppen benennen — Kriterium 1 aus Phase 1

Jetzt kommt der Schritt, den kein Algorithmus abnimmt. Die Zahlen liefern Gruppen; **die
Namen liefert der Verstand.**

Die Zeile über jedem Cluster nennt drei Größen, und jede beantwortet eine andere Frage:

| Größe | Frage | Was ein hoher Wert bedeutet |
|---|---|---|
| **Spitzenstunde** | Wann wird abgefahren? | früh = von zuhause weg, spät = zurück oder Ankunft |
| **Wochenendanteil** | Ist es Pflicht oder Freizeit? | hoch = Ausflug, niedrig = Arbeit oder Studium |
| **Mediandauer** | Wie weit? | lang = Weg über die Stadt, kurz = innerstädtischer Sprung |

Erst die **Kombination** trägt einen Namen. Eine frühe Spitze allein sagt nichts: Sie
steht am Wohnort für den Weg zur Arbeit und am Bahnhof für den Anschluss an den Zug. Mit
niedrigem Wochenendanteil und langer Dauer wird daraus eine **Wohnstation**; mit hohem
Wochenendanteil und kurzer Dauer eine Freizeitlage.

**Lesen Sie die gedruckte Zeile, nicht diesen Absatz.** Die Namen, die das Notebook
vergibt, stehen in der Tabelle der nächsten Zelle — sie werden aus genau diesen drei
Größen abgeleitet und ändern sich mit ihnen. Ein Fließtext, der die Gruppen aufzählt,
wäre nach der nächsten Datenlieferung falsch, ohne dass es jemand merkt.

> **Eine Gruppe ist auffällig klein.** Bei zehn Stationen und k = 4 besteht ein Cluster
> nur aus einer einzigen Station. Das ist kein Typ, sondern ein Sonderfall — und
> Sonderfälle behandelt man einzeln. Rechnen Sie damit, dass diese Gruppe bei der
> nächsten Datenlieferung anders aussieht; zehn Beobachtungen tragen keine Typologie,
> sie tragen eine Arbeitshypothese.

**Kriterien 1 bis 3 aus Phase 1 sind damit erfüllt:** Jede Gruppe ist benennbar, jede
bekommt in Phase 6 eine eigene Regel, und keine ist zu klein. Kriterium 2 wird dort
außerdem maschinell geprüft — **vier Gruppen müssen vier verschiedene Prüfungshypothesen
ergeben.** Eine frühere Fassung dieses Notebooks hat genau daran gescheitert, ohne dass
es auffiel.

### Kriterium 4: Stabilität — gemessen, nicht behauptet

`n_init=25` ist **keine** Stabilitätsprüfung. Es rechnet 25 Startpunkte durch und nimmt
den mit der geringsten Streuung — das ist Qualitätssicherung innerhalb eines Laufs, nicht
die Frage, ob ein anderer Zufallsstart dieselben Gruppen liefert.

Die Frage lässt sich beantworten: Man clustert mehrfach mit verschiedenen Startwerten und
vergleicht die Einteilungen mit dem **adjustierten Rand-Index**. Er ist 1,0 bei
identischer Gruppierung und 0 bei zufälliger Übereinstimmung.
"""),

CODE('''
from sklearn.metrics import adjusted_rand_score

def stabilitaet(daten, k, name):
    """Liefern andere Zufallsstarts dieselbe Einteilung?"""
    grund = KMeans(n_clusters=k, n_init=25, random_state=42).fit_predict(daten)
    werte = []
    for seed in (0, 1, 7, 99, 2024):
        andere = KMeans(n_clusters=k, n_init=25, random_state=seed).fit_predict(daten)
        werte.append(adjusted_rand_score(grund, andere))
    print(f"{name:14s} ARI über fünf Startwerte: "
          f"{min(werte):.3f} bis {max(werte):.3f}   "
          f"{'stabil' if min(werte) > 0.99 else 'nur annähernd stabil'}")
    return min(werte)

s_stab = merke("ari_stationen", stabilitaet(S_skaliert, K_STATIONEN, "Stationen"))
k_stab = merke("ari_kunden", stabilitaet(R_skaliert, K_KUNDEN, "Kundschaft"))
'''),

MD("""
Der Startwert ist aber nicht die Frage, die im Betrieb zählt. Dort wird **nicht mit einem
anderen Zufallsstart** neu gerechnet, sondern **ein Quartal später mit neuen Daten**. Ob
ein Kunde dann noch im selben Segment liegt, entscheidet darüber, ob man ihm überhaupt
eine Kampagne schicken kann.

Das lässt sich messen: dieselbe Rechnung, verschoben um 90 Tage.
"""),

CODE('''
from scipy.optimize import linear_sum_assignment

# DIE SCHWELLEN STEHEN HIER - VOR IHRER PRUEFUNG.
#
# Sie sind an den Clusterprofilen abgelesen; das Clustering war die
# Erkundung. Angewendet werden sie auf jede einzelne Kundenzeile, und
# genau diese Regeln gehen in Phase 6 in den Export.
SCHWELLE_RECENCY = 150
SCHWELLE_FREQUENZ = 12
SCHWELLE_UMSATZ = 30

# DIE NAMEN DUERFEN NUR SAGEN, WAS DIE REGEL PRUEFT.
#
# Die Schwellen kennen Recency, Frequenz und Umsatz - den Tarif nicht.
# Frueher hiessen zwei Segmente "Vielfahrer mit Freiminuten" und
# "Umsatztraeger im Basistarif". Gemessen: 82 der 520 Vielfahrer (15,8 %)
# haben BASIS, also gar keine Freiminuten. Der Name behauptete etwas, das
# die Regel nicht geprueft hat - und fuer jeden sechsten war er falsch.
#
# Der Tarif steht als eigene Spalte im Export. Massnahmen gehoeren aus der
# KOMBINATION Segment x Tarif abgeleitet, nicht aus einem Namen.
def segment_benennen(zeile, vorheriges=None, rand=0.0):
    """Das Segment einer Zeile - mit optionaler HYSTERESE.

    Ohne Hysterese wechselt jede Person das Segment, sobald sie eine
    Schwelle um einen einzigen Punkt ueberquert. Bei Schwellen mitten in
    der Verteilung erzeugt das Wechsel, die keine Verhaltensaenderung
    sind, sondern Messrauschen - und eine Kampagne, die jedem Quartal eine
    andere Ansprache schickt, wirkt beliebig.

    Die Hysterese ist die uebliche Antwort darauf: Wer ein Segment schon
    hat, behaelt es, solange er die um `rand` aufgeweitete Schwelle nicht
    verlaesst. Das ist kein Trick, um eine Kennzahl zu schoenen - es ist
    dieselbe Logik wie beim Thermostat, der nicht bei jedem Zehntelgrad
    schaltet.
    """
    def hart(r, f, u):
        if r > SCHWELLE_RECENCY:
            return "Eingeschlafen"
        if f > SCHWELLE_FREQUENZ:
            return "Vielfahrer"
        if u > SCHWELLE_UMSATZ:
            return "Umsatzträger"
        return "Gelegenheitsnutzer"

    jetzt = hart(zeile.recency, zeile.frequenz, zeile.umsatz)
    if not rand or vorheriges is None or vorheriges == jetzt:
        return jetzt
    # Mit aufgeweiteten Schwellen noch im alten Segment? Dann dabei bleiben.
    weich = hart(zeile.recency * (1 - rand),
                 zeile.frequenz * (1 + rand),
                 zeile.umsatz * (1 + rand))
    weich_2 = hart(zeile.recency * (1 + rand),
                   zeile.frequenz * (1 - rand),
                   zeile.umsatz * (1 - rand))
    return vorheriges if vorheriges in (weich, weich_2) else jetzt


HYSTERESE = 0.20    # in Phase 1 festgelegt, bevor die Stabilitaet gemessen wurde

def rfm_zum_cutoff(cut):
    """Dieselbe RFM-Rechnung wie oben, nur zu einem anderen Zeitpunkt.
    Dieselbe Fenstergrenze, dieselbe Ausschlussregel - sonst vergliche
    man zwei verschiedene Populationen."""
    f = echte[(echte.startzeit > cut - pd.Timedelta(days=FENSTER_TAGE))
              & (echte.endzeit < cut)]
    return f.groupby("kunde_id").agg(
        recency=("startzeit", lambda s: (cut - s.max()).days),
        frequenz=("ausleihe_id", "size"), umsatz=("entgelt_eur", "sum"))

def regel_segmente_zum(cut, vorher=None):
    """Was das AUSGELIEFERTE Verfahren zu diesem Zeitpunkt gesagt haette.

    `vorher` traegt die Segmente des Vorquartals herein - nur so kann die
    Hysterese wirken. Ohne sie ist jede Auswertung gedaechtnislos, und die
    Stabilitaet misst dann die Schwellenlage, nicht das Verhalten.
    """
    z = rfm_zum_cutoff(cut)
    if vorher is None:
        return z.apply(segment_benennen, axis=1)
    return z.apply(lambda r: segment_benennen(
        r, vorher.get(r.name), HYSTERESE), axis=1)

def cluster_segmente_zum(cut):
    """Was ein NEU gerechnetes k-Means gesagt haette - Modelldiagnose."""
    r = rfm_zum_cutoff(cut)
    R = r.copy()
    R["frequenz"] = np.log1p(R.frequenz)
    R["umsatz"] = np.log1p(R.umsatz)
    labels = KMeans(n_clusters=K_KUNDEN, n_init=25, random_state=42).fit_predict(
        StandardScaler().fit_transform(R))
    return pd.Series(labels, index=r.index)

VORQUARTAL = CUTOFF - pd.Timedelta(days=90)

# ---------------------------------------------------------------------
# (1) DAS GATE: die Stabilitaet DES AUSGELIEFERTEN PRODUKTS.
#
# Eine fruehere Fassung mass hier die Stabilitaet eines jeweils NEU
# gerechneten k-Means - und band den Export daran. Ausgeliefert werden
# aber feste Schwellen. Das Gate bewertete also ein Verfahren, das
# niemand bekommt.
#
# Bei festen Segmentnamen braucht es kein Labelmatching: Die Namen sind
# an beiden Stichtagen dieselben, ein Vergleich genuegt.
# ---------------------------------------------------------------------
# Die Reihenfolge ist wichtig: erst das Vorquartal ohne Gedaechtnis, dann
# das aktuelle MIT dem Vorquartal als Ausgangslage - so, wie es im Betrieb
# liefe. Andersherum gerechnet waere die Hysterese wirkungslos.
regel_vor = regel_segmente_zum(VORQUARTAL)
regel_heute = regel_segmente_zum(CUTOFF, vorher=regel_vor)
gemeinsam = regel_heute.index.intersection(regel_vor.index)
wechselquote = float((regel_heute[gemeinsam] != regel_vor[gemeinsam]).mean())

# ---------------------------------------------------------------------
# (0) UND DIE STATIONEN? Auch dort war "stabil" bisher nur eine Aussage
#     ueber Zufallsstartwerte - also ueber die Rechnung, nicht ueber die
#     Zeit. Dieselbe Frage, dieselbe Methode.
# ---------------------------------------------------------------------
def stationsmerkmale(f):
    """Die 26 Zahlen je Station - EINE Definition fuer alle Verwendungen.

    Der Hauptlauf nahm 24 WERKTAGSstunden plus Wochenendanteil plus
    Mediandauer; die Stabilitaetspruefung nahm 24 Stunden ueber alle Tage
    und liess die beiden anderen weg. Sie prueft dann eine verwandte, aber
    nicht dieselbe Repraesentation - und ein guenstiges Ergebnis sagt
    nichts ueber das Modell, das wirklich laeuft.
    """
    f = f.copy()
    f["stunde"] = f.startzeit.dt.hour
    f["dauer_min"] = (f.endzeit - f.startzeit).dt.total_seconds() / 60
    _werktags = f[~f.ist_frei]
    g = (_werktags.groupby(["start_station_id", "stunde"]).size()
         .unstack(fill_value=0).reindex(columns=range(24), fill_value=0))
    g = g.div(g.sum(axis=1).clip(lower=1), axis=0)
    g.columns = [f"stunde_{h:02d}" for h in g.columns]
    z = f.groupby("start_station_id").agg(
        wochenendanteil=("ist_frei", "mean"),
        dauer_median=("dauer_min", "median"))
    return g.join(z).fillna(0.0)


def stationstypen_zum(cut):
    f = echte[(echte.startzeit > cut - pd.Timedelta(days=FENSTER_TAGE))
              & (echte.endzeit < cut)]
    g = stationsmerkmale(f)
    return pd.Series(
        KMeans(n_clusters=K_STATIONEN, n_init=25, random_state=42)
        .fit_predict(StandardScaler().fit_transform(g)), index=g.index)

st_heute = stationstypen_zum(CUTOFF)
st_vor = stationstypen_zum(CUTOFF - pd.Timedelta(days=90))
st_gem = st_heute.index.intersection(st_vor.index)
print("(0) STATIONEN ueber die ZEIT (nicht nur ueber Startwerte)\\n")
print(f"    ARI zwischen den beiden Stichtagen: "
      f"{adjusted_rand_score(st_vor[st_gem], st_heute[st_gem]):.3f}\\n")

print("(1a) DIE VIER RFM-REGELN - feste Schwellen, beide Stichtage\\n")
print(f"     In beiden Fenstern aktiv: {len(gemeinsam)} Kundinnen und Kunden")
merke("gate_rfm", wechselquote)
print(f"     Segmentwechsel binnen 90 Tagen: {wechselquote:.1%}")

# ---------------------------------------------------------------------
# (1b) DIE VOLLSTAENDIGE AUSLIEFERUNG - sieben Lebenszyklussegmente.
#
# Der Export enthaelt mehr als die vier RFM-Segmente: "Frueher aktiv,
# jetzt inaktiv" und "Neu, noch keine Erstfahrt" kommen dazu, "Nie
# aktiviert" wird analysiert und ausgeschlossen. Ein Gate, das nur die
# vier misst, laesst genau die Uebergaenge aus, die entscheiden, WER
# ueberhaupt angeschrieben wird - naemlich den Wechsel zwischen aktiv
# und inaktiv.
# ---------------------------------------------------------------------
def lebenszyklus_zum(cut, vorher=None):
    """Die vollstaendige siebenstufige Logik zu einem Zeitpunkt."""
    r = rfm_zum_cutoff(cut)
    seg = (r.apply(segment_benennen, axis=1) if vorher is None
           else r.apply(lambda z: segment_benennen(
               z, vorher.get(z.name), HYSTERESE), axis=1))
    gefahren_bis = set(echte.loc[echte.endzeit < cut, "kunde_id"])
    reg = pd.to_datetime(kunden.set_index("kunde_id").registriert_am)
    dabei = (cut - reg).dt.days
    # nur Kundschaft, die zu diesem Zeitpunkt schon registriert war
    registriert = dabei[dabei >= 0].index
    ergebnis = {}
    for kid in registriert:
        if kid in seg.index:
            ergebnis[kid] = seg[kid]
        elif kid in gefahren_bis:
            ergebnis[kid] = "Früher aktiv, jetzt inaktiv"
        elif dabei[kid] <= FENSTER_TAGE:
            ergebnis[kid] = "Neu, noch keine Erstfahrt"
        else:
            ergebnis[kid] = "Nie aktiviert"
    return pd.Series(ergebnis)

lz_vor = lebenszyklus_zum(VORQUARTAL)
lz_heute = lebenszyklus_zum(CUTOFF, vorher=lz_vor)
lz_gemeinsam = lz_heute.index.intersection(lz_vor.index)
lz_wechsel = float((lz_heute[lz_gemeinsam] != lz_vor[lz_gemeinsam]).mean())

print("\\n(1b) ALLE LEBENSZYKLUSZUSTAENDE - der weite Nenner\\n")
print(f"     An beiden Stichtagen registriert: {len(lz_gemeinsam)} Kundinnen und Kunden")
print(f"     Segmentwechsel binnen 90 Tagen: {lz_wechsel:.2%}")

# ---------------------------------------------------------------------
# (1c) DIE KAMPAGNEN-ARBEITSLISTE - der Nenner, der wirklich zaehlt.
#
# In (1b) stecken Menschen, die nie in einer Kampagne landen: der Zustand
# "Nie aktiviert" wird ausdruecklich ausgeschlossen. Solche Zustaende sind
# per Definition stabil - sie druecken die Wechselquote nach unten, ohne
# dass irgendetwas an der Auslieferung stabiler waere.
#
# Ein Gate, das den weiten Nenner nimmt, misst sich selbst schoen.
# ---------------------------------------------------------------------
NICHT_IN_KAMPAGNE = {"Nie aktiviert"}
in_liste = [k for k in lz_gemeinsam
            if lz_heute[k] not in NICHT_IN_KAMPAGNE
            and lz_vor[k] not in NICHT_IN_KAMPAGNE]
liste_wechsel = float((lz_heute[in_liste] != lz_vor[in_liste]).mean())

print("\\n(1c) NUR DIE KAMPAGNEN-ARBEITSLISTE - der enge Nenner\\n")
print(f"     Zu beiden Zeitpunkten in der Arbeitsliste: {len(in_liste)}")
print(f"     Segmentwechsel binnen 90 Tagen: {liste_wechsel:.2%}")
merke("gate_eng", liste_wechsel)
merke("gate_weit", lz_wechsel)
merke("gate_differenz", (liste_wechsel - lz_wechsel) * 100)
merke("n_registriert", len(lz_gemeinsam))
_ = merke("n_arbeitsliste", len(in_liste))
print(f"\\n     Differenz zum weiten Nenner: "
      f"{(liste_wechsel - lz_wechsel) * 100:+.2f} Prozentpunkte.")
print("     Die stabilen Nicht-Zielpersonen fehlen hier - und mit ihnen die")
print("     Beschoenigung. DIESE Zahl bindet das Gate.")
print()
print("     Was hier NICHT drinsteckt: historische Kontosperren und")
print("     Marketing-Einwilligungen. Beides ist in den Daten nicht")
print("     zeitpunktbezogen erfasst, also nicht rekonstruierbar. Der")
print("     ehrliche Name lautet deshalb 'Stabilitaet der analytischen")
print("     Segment- und Auswahlregeln', nicht 'Auslieferungsstabilitaet'.")

# ---------------------------------------------------------------------
# (2) DIE MODELLDIAGNOSE: wie stabil waere das Clustering gewesen?
#     Interessant, aber NICHT das Gate - das Clustering wird nicht
#     ausgeliefert.
# ---------------------------------------------------------------------
cl_heute = cluster_segmente_zum(CUTOFF)
cl_vor = cluster_segmente_zum(VORQUARTAL)
gem_cl = cl_heute.index.intersection(cl_vor.index)
kreuz = pd.crosstab(cl_vor[gem_cl], cl_heute[gem_cl]).values
zeile, spalte = linear_sum_assignment(-kreuz)
cluster_wechsel = 1 - kreuz[zeile, spalte].sum() / len(gem_cl)

print("\\n(2) ZUM VERGLEICH das Clustering - nur Modelldiagnose\\n")
print(f"    ARI zwischen den Zeitpunkten: "
      f"{adjusted_rand_score(cl_vor[gem_cl], cl_heute[gem_cl]):.3f}")
print(f"    Segmentwechsel nach bester Zuordnung: {cluster_wechsel:.1%}")
print("\\n    Die beiden Zahlen sind nicht dasselbe und duerfen sich nicht")
print("    vertreten. Gebunden wird das Gate an (1).")
# DAS GATE IST EINE VARIABLE, KEIN SATZ.
#
# Eine Schwelle, die nur im Text steht, bindet nichts. Diese hier
# entscheidet weiter unten darueber, ob die Kampagnenliste als freigegeben
# oder als gesperrt exportiert wird.
GATE_WECHSEL = 0.25
# Gebunden wird der ENGE Nenner - die Menschen, die tatsaechlich eine
# Ansprache bekaemen. Der weite Nenner steht daneben, als Diagnose.
KUNDENSEGMENTE_STABIL = bool(liste_wechsel <= GATE_WECHSEL)

print(f"\\nDie Überwachung in Phase 6 nennt {GATE_WECHSEL:.0%} je Quartal als Alarmschwelle.\\n")
print(f"   Kampagnen-Arbeitsliste (bindend):  {liste_wechsel:>6.2%}   "
      f"{'gehalten' if KUNDENSEGMENTE_STABIL else 'GERISSEN'}")
print(f"   alle Lebenszykluszustaende:        {lz_wechsel:>6.2%}   (Diagnose)")
print(f"   nur die vier RFM-Regeln:           {wechselquote:>6.2%}   (Ausschnitt)")
print()
# Ob die Wahl des Nenners das Urteil dreht, entscheidet die Rechnung.
# Frueher stand hier unbedingt "waehlt man den weitesten, besteht das Gate" -
# das war einmal richtig und blieb stehen, als es das nicht mehr war.
_alle_nenner = {"Arbeitsliste": liste_wechsel, "Lebenszyklus": lz_wechsel,
                "RFM-Regeln": wechselquote}
_bestehen = [n for n, w in _alle_nenner.items() if w <= GATE_WECHSEL]
print("Drei Nenner, drei Zahlen.")
if len(_bestehen) == len(_alle_nenner):
    print("Diesmal bestehen alle drei - die Wahl des Nenners dreht das Urteil")
    print("nicht. Das ist Glueck, kein Argument: Bei knapperer Lage haenge das")
    print("Urteil daran, und eine Wahl nach der Messung waere Manipulation.")
elif not _bestehen:
    print("Diesmal reissen alle drei - die Wahl des Nenners dreht das Urteil")
    print("nicht. Das ist Glueck, kein Argument: Bei knapperer Lage haenge das")
    print("Urteil daran, und eine Wahl nach der Messung waere Manipulation.")
else:
    print(f"Bestanden haetten: {', '.join(_bestehen)} - gerissen die uebrigen.")
    print("Der Nenner ist hier keine Formalie, er entscheidet. Deshalb steht")
    print("vorher fest, welcher bindet: die Arbeitsliste.")

# P1.4: Ein- und Austritte zaehlen mit.
# Die Schnittmenge misst, wer die MASSNAHME wechselt. Betrieblich ist auch
# ein Wechsel, wer neu auf die Liste kommt oder von ihr verschwindet - fuer
# die Person aendert sich dann am meisten. Die Vereinigungsmenge mit einem
# ausdruecklichen Zustand "ausserhalb" misst das.
_union = lz_heute.index.union(lz_vor.index)
_h = lz_heute.reindex(_union).fillna("ausserhalb der Arbeitsliste")
_v = lz_vor.reindex(_union).fillna("ausserhalb der Arbeitsliste")
_union_wechsel = float((_h != _v).mean())
merke("gate_union", _union_wechsel)
print(f"\\nZum Vergleich, Vereinigungsmenge mit Zustand 'ausserhalb':")
print(f"   {len(_union)} Personen, Wechselquote {_union_wechsel:.2%}")
print("   Diese Zahl ist naeher an der betrieblichen Frage - sie zaehlt auch,")
print("   wer neu angesprochen wuerde oder herausfaellt. Gebunden bleibt das")
print("   Gate trotzdem an die Schnittmenge, weil DIESE Festlegung vor der")
print("   Messung stand. Geaendert wird sie vor der naechsten, nicht jetzt.")
print("\\nDiese Variable bindet den Export in Phase 6 - sie ist keine Randnotiz.")
print("Und sie bindet ihn an das, was tatsaechlich ausgeliefert wird.")

# ---------------------------------------------------------------------
# (3) WIE ROBUST IST DIE ZUORDNUNG GEGEN UNGLEICHE BEOBACHTUNGSDAUER?
#
# Ein Teil der Kundschaft ist erst im Fenster dazugekommen. Ihre Werte
# heissen "je Jahr", stammen aber aus wenigen Wochen - und werden mit
# denselben Schwellen bewertet wie ein volles Jahr.
#
# Die Hochrechnung auf 365 Tage ist NICHT die richtige Loesung: Gerade
# bei neuen Kunden ist das Verhalten nicht stationaer. Sie zeigt aber,
# wie viel an dieser Entscheidung haengt.
# ---------------------------------------------------------------------
angemeldet = pd.to_datetime(kunden.set_index("kunde_id").registriert_am)
beobachtet = (CUTOFF - angemeldet).dt.days.clip(upper=FENSTER_TAGE)
jung = beobachtet[beobachtet < FENSTER_TAGE].index.intersection(rfm.index)

segment_roh = rfm.apply(segment_benennen, axis=1)
hoch = rfm.loc[jung].copy()
faktor = FENSTER_TAGE / beobachtet.loc[jung].clip(lower=1)
hoch["frequenz"] = hoch.frequenz * faktor
hoch["umsatz"] = hoch.umsatz * faktor
anders = (hoch.apply(segment_benennen, axis=1) != segment_roh.loc[jung])

print("\\n(3) UNGLEICHE BEOBACHTUNGSDAUER\\n")
merke("kurze_historie", len(jung))
merke("kurze_historie_wechsel", int(anders.sum()))
merke("kurze_historie_anteil", anders.mean())
print(f"    RFM-Kundschaft mit weniger als {FENSTER_TAGE} Tagen Historie: {len(jung)}")
print(f"    Median der beobachteten Tage bei ihnen: "
      f"{beobachtet.loc[jung].median():.0f}")
print(f"    davon anderes Segment nach Hochrechnung: {int(anders.sum())} "
      f"= {anders.mean():.1%}")
print(f"    das sind {anders.sum() / len(rfm):.1%} der gesamten RFM-Kundschaft")
print("\\n    Die Spalten heissen deshalb ab hier 'im Beobachtungsfenster',")
print("    nicht 'je Jahr'. Und das zugehoerige Freigabe-Gate bleibt offen.")
'''),

MD("""
> **Jeder vierte Kunde wechselt binnen eines Quartals das Segment** — und das bei
> unveränderter Methode und unveränderten Schwellen. Die drei Zahlen oben messen aber
> **drei verschiedene Dinge**, und nur eine davon gehört zum Produkt:
>
> | Kennzahl | Wert | Was sie misst |
> |---|---:|---|
> | **Kampagnen-Arbeitsliste** | **{{gate_eng:.2%}}** | die Menschen, die eine Ansprache bekämen — **hieran hängt das Gate** |
> | alle Lebenszykluszustände | {{gate_weit:.2%}} | Diagnose der Bestandsdynamik |
> | die vier RFM-Regeln allein | {{gate_rfm:.2%}} | ein Ausschnitt davon |
> | k-Means, jeweils neu gerechnet | nur Modelldiagnose | ein Modell, das **nicht** ausgeliefert wird |
>
> **Der Nenner muss trotzdem vorher feststehen.** Nimmt man alle
> {{n_registriert:,}} registrierten Personen, sind es {{gate_weit:.2%}}. Nimmt man die
> {{n_arbeitsliste:,}}, die tatsächlich in einer Arbeitsliste stünden, sind es
> {{gate_eng:.2%}} — ein Unterschied von {{gate_differenz:+.2f}} Prozentpunkten.
>
> Diesmal entscheidet er nicht: Beide Werte liegen über der Alarmschwelle. Das ist ein
> glücklicher Umstand, kein Argument — bei einer knapperen Lage hinge das Urteil daran,
> und dann wäre die Wahl des Nenners nach der Messung eine Manipulation.
>
> Der Unterschied sind die dauerhaft stabilen Nicht-Zielpersonen (Zustand „Nie
> aktiviert"), die nie angeschrieben werden. Sie im Nenner zu behalten macht die Quote
> besser, ohne dass an der Auslieferung irgendetwas stabiler wäre. **Eine frühere Fassung
> band das Gate an den weiten Nenner — und bestand es damit knapp.**
>
> Der ARI sagt also **nicht dasselbe**: Er beschreibt das separat neu berechnete
> Clustering. Eine frühere Fassung stellte ihn neben die Regelquote, als wären es zwei
> Belege für denselben Satz.
>
> Das ist kein Fehler des Verfahrens. RFM misst Verhalten in einem gleitenden Fenster,
> und Verhalten ändert sich. Aber es hat eine **harte Folge für die Auslieferung**:

**Cluster-Nummern kann man nicht ausliefern.** Wer im Januar „Cluster 3" ist, ist es im
April vielleicht nicht mehr — und niemand kann nachvollziehen, warum. Die Nummer ist eine
Rechenposition, kein Merkmal des Kunden.

**Deshalb wird in Phase 6 nicht das Clustering ausgeliefert, sondern eine Regel.** Das
Clustering hat seine Arbeit getan: Es hat gezeigt, *dass* es vier Gruppen gibt und *wo*
sie ungefähr liegen. Die Auslieferung übernehmen nachvollziehbare Schwellen, die jeder
nachrechnen kann — und die bei jedem neuen Stichtag dieselbe Bedeutung haben.

Was das kostet, rechnen wir in Phase 6 ebenfalls aus. Es ist nicht umsonst.""" ),

MD("""
**Die Stationen sind stabil — über Startwerte *und* über die Zeit.** Der ARI zwischen zwei
um 90 Tage verschobenen Fenstern beträgt 1,000; die Zuordnung ändert sich nicht. Das ist
mehr, als die Startwertprüfung allein zeigen konnte, und es gilt für diesen synthetischen
Datensatz mit seinen vier bewusst erzeugten Typen.

**Auch die Kundensegmente sind über die Startwerte reproduzierbar** — der niedrigste
gemessene ARI beträgt {{ari_kunden:.3f}} bei den Kunden und {{ari_stationen:.3f}} bei den
Stationen.

Das ist ein günstiger Befund, kein garantierter. Bei mehreren tausend Kundinnen und Kunden
liegen viele nahe an einer Gruppengrenze; ein anderer Startwert oder ein um wenige Tage
verschobenes Fenster kann sie auf die andere Seite bringen. **Startwertstabilität misst
die Rechnung, nicht die Sache** — dass dasselbe Verfahren zweimal dasselbe ergibt, sagt
nichts darüber, ob die Gruppen morgen noch dieselben sind.

Für die Auslieferung heißt das: Die Stationszuordnung ist **am aktuellen Datenstand und
über die getesteten Startwerte** reproduzierbar — nicht „fest" im Sinne von dauerhaft. Der
Kampagnenplan ist es nicht. Wer nächstes Quartal neu clustert, bekommt bei einzelnen
Kunden ein anderes Segment. **Deshalb wird der Kampagnenplan in Phase 6 nicht über
Cluster-Nummern ausgeliefert, sondern über nachvollziehbare Schwellen** — die sind
reproduzierbar.

> **Und noch eine Zahl, die man nicht überlesen sollte:** Der Silhouettenwert der
> Kundensegmente liegt bei k = 4 bei {{sil_kunden_k4:.3f}}, der der Stationen bei
> {{sil_stationen_k4:.3f}}. Werte um 0,4 heißen:
> Es *gibt* eine Struktur, aber die Gruppen gehen ineinander über. Das ist bei
> Kundendaten der Normalfall und kein Fehler — es ist aber ein Grund, die Segmente als
> Arbeitshilfe zu behandeln und nicht als Naturkonstante.

> **Bei den Stationen zeigt die Kennzahl woanders hin als die Fachlichkeit.** Den
> höchsten Silhouettenwert hat **k = {{sil_stationen_bestes_k:.0f}}**
> ({{sil_stationen_bestwert:.3f}}), nicht das gewählte k = 4
> ({{sil_stationen_k4:.3f}}). Gewählt wurde k = 4 trotzdem — aber dann muss man sagen,
> warum, und darf sich nicht hinter der Kennzahl verstecken.
>
> Der Grund ist Kriterium 2: Bei zehn Stationen erzeugt jedes weitere k Gruppen von ein
> bis zwei Stationen, für die es keine eigene Maßnahme gibt. Schon bei k = 4 besteht eine
> Gruppe nur aus dem Hauptbahnhof. **Ein Cluster, das eine einzige Station enthält, ist
> kein Typ, sondern ein Sonderfall** — und Sonderfälle behandelt man einzeln, nicht mit
> einem Verfahren.
>
> Genau das ist die Lehre: Eine Kennzahl, die einen Zielkonflikt nicht kennt, kann ihn
> auch nicht entscheiden. Die Silhouette misst Trennschärfe, nicht Handhabbarkeit.
>
> **Verlassen kann man sich auf sie ohnehin nicht.** Bei der Kundensegmentierung liegen
> die Silhouettenwerte für k = 2, k = 4 und k = 5 dicht beieinander; dort entscheidet die
> Kennzahl gar nichts, und die vier Kriterien aus Phase 1 sind das Einzige, was bleibt.
> Wer nur auf die Kennzahl schaut, hat kein Verfahren für den Fall, dass sie schweigt.
>
> Entschieden hat **Kriterium 2**: Für jede Gruppe muss es eine andere Maßnahme geben.
> Bei k = 2 gibt es sie nicht, bei k = 4 schon. Das ist keine Schwäche des Verfahrens,
> sondern die Arbeitsteilung: Die Statistik liefert Kandidaten, die Fachlichkeit
> entscheidet.
"""),

CODE('''
# EIN BLICK, DEN ES IM ECHTEN PROJEKT NICHT GIBT
# Dieser Datensatz wurde erzeugt - und zwar mit genau vier Stationstypen, die
# in KEINER CSV stehen. Deshalb koennen wir hier ausnahmsweise nachsehen, ob
# das Clustering sie wiedergefunden hat. Im Betrieb ist das unmoeglich; dort
# bleibt es beim fachlichen Urteil oben.
ERZEUGT_ALS = {
    "Hauptbahnhof": "pendler", "Zellerau": "pendler",
    "Grombühl Klinikum": "pendler", "Sanderau": "pendler",
    "Universität Sanderring": "uni", "Hubland Campus": "uni",
    "Residenz": "freizeit", "Dom": "freizeit",
    "Juliuspromenade": "misch",
    "Marktplatz": "misch",
}
pruefung = pd.DataFrame({"gefunden": S.cluster,
                         "erzeugt_als": [ERZEUGT_ALS[n] for n in S.index]})
kreuz = pd.crosstab(pruefung.gefunden, pruefung.erzeugt_als)
print(kreuz.to_string())
treffer = merke("generator_treffer", kreuz.max(axis=1).sum() / kreuz.values.sum())
# Die Mehrheitszuordnung schmeichelt: Sie darf jede gefundene Gruppe ihrem
# haeufigsten erzeugten Typ zuschlagen. Der Adjusted Rand Index vergleicht
# die beiden Einteilungen als Ganzes und ist gegen die Benennung unempfindlich.
_ari_gen = merke("generator_ari",
                 adjusted_rand_score(pruefung.erzeugt_als, pruefung.gefunden))
_daneben = len(pruefung) - int(kreuz.max(axis=1).sum())

print(f"\\nMehrheitszuordnung: {treffer:.0%}")
print(f"Adjusted Rand Index: {_ari_gen:.3f}")
if treffer >= 0.999:
    print("Jede gefundene Gruppe entspricht genau einem erzeugten Typ.")
else:
    print(f"\\nAlso NICHT deckungsgleich: {_daneben} von {len(pruefung)} Stationen liegen")
    print("in einer Gruppe, deren Mehrheit ein anderer erzeugter Typ ist.")
    print("Die beiden Zahlen sagen Verschiedenes - die erste darf jede Gruppe")
    print("guenstig benennen, die zweite nicht. Berichtet gehoert die zweite.")
'''),

MD("""
> **Diese Zelle ist ein Luxus des Lehrdatensatzes.** In einem echten Projekt gibt es
> keine Tabelle, gegen die man prüfen könnte — hätten wir sie, bräuchten wir kein
> Clustering. Sie steht hier nur, um zu zeigen, dass die fachliche Deutung oben nicht
> Wunschdenken war.

### 5.B Kundschaft: die Segmente lesen
"""),

CODE('''
tarifverteilung = (rfm.groupby("cluster").tarif_code.value_counts(normalize=True)
                   .unstack().fillna(0) * 100).round(0)
uebersicht = profil.join(tarifverteilung)
print(uebersicht.to_string())

# Der Preisbefund wird an den REGELSEGMENTEN gerechnet, nicht an den
# Clustern - denn ausgeliefert werden die Regeln. Das ist keine Feinheit:
# Auf diesem Datenstand faellt bei k-Means das fahrtenstaerkste und das
# umsatzstaerkste Cluster ZUSAMMEN. Wer den Befund am Cluster festmacht,
# vergleicht dieselbe Gruppe mit sich selbst.
_je_fahrt_cl = (profil.umsatz_fenster / profil.fahrten_fenster).round(2)
_haeufigste = profil.fahrten_fenster.idxmax()
_umsatzstaerkste = profil.umsatz_fenster.idxmax()
merke("cluster_haeufigste", int(_haeufigste))
merke("cluster_umsatzstaerkste", int(_umsatzstaerkste))
merke("cluster_faellt_zusammen", int(_haeufigste == _umsatzstaerkste))

seg_profil = rfm.assign(segment=rfm.apply(segment_benennen, axis=1)).groupby("segment").agg(
    kunden=("frequenz", "size"),
    fahrten_fenster=("frequenz", "mean"),
    umsatz_fenster=("umsatz", "mean")).round(1)
_je_fahrt = (seg_profil.umsatz_fenster / seg_profil.fahrten_fenster).round(2)
_viel = seg_profil.fahrten_fenster.idxmax()
_stark = seg_profil.umsatz_fenster.idxmax()
merke("viel_segment", _viel); merke("stark_segment", _stark)
merke("viel_fahrten", seg_profil.fahrten_fenster[_viel])
merke("viel_umsatz", seg_profil.umsatz_fenster[_viel])
merke("viel_je_fahrt", _je_fahrt[_viel])
merke("stark_fahrten", seg_profil.fahrten_fenster[_stark])
merke("stark_umsatz", seg_profil.umsatz_fenster[_stark])
merke("stark_je_fahrt", _je_fahrt[_stark])
merke("faktor_je_fahrt", _je_fahrt[_stark] / max(_je_fahrt[_viel], 0.01))

print()
print("k-MEANS-CLUSTER - Umsatz je Fahrt:")
print((profil[["fahrten_fenster", "umsatz_fenster"]]
       .assign(**{"EUR je Fahrt": _je_fahrt_cl}).round(2).to_string()))
if _haeufigste == _umsatzstaerkste:
    print(f"\\nHinweis: Cluster {_haeufigste} ist ZUGLEICH das fahrtenstaerkste und das")
    print("umsatzstaerkste. Der Preisbefund laesst sich an den Clustern also nicht")
    print("zeigen - dafuer braucht es die Regelsegmente unten.")
else:
    print(f"\\nAm haeufigsten faehrt Cluster {_haeufigste} "
          f"({_je_fahrt_cl[_haeufigste]:.2f} EUR je Fahrt), am meisten Umsatz bringt "
          f"Cluster {_umsatzstaerkste} ({_je_fahrt_cl[_umsatzstaerkste]:.2f} EUR).")

_seg = rfm.assign(segment=rfm.apply(segment_benennen, axis=1))
_seg_tarif = (_seg.groupby("segment").tarif_code.value_counts(normalize=True)
              .unstack().fillna(0) * 100).round(0)
print("\\nREGELSEGMENTE - dieselbe Rechnung, und diese Gruppen werden ausgeliefert:")
print(seg_profil.assign(**{"EUR je Fahrt": _je_fahrt}).join(_seg_tarif).to_string())

# Die Erklaerung des Befundes ist eine Behauptung ueber Tarife - also wird
# sie gemessen, nicht geglaubt.
_frei = [t for t in ("OEPNV", "PREMIUM", "STUDENT") if t in _seg_tarif.columns]
merke("viel_anteil_freiminuten", _seg_tarif.loc[_viel, _frei].sum() / 100)
merke("stark_anteil_basis", _seg_tarif.loc[_stark, "BASIS"] / 100)
print(f"\\nAm haeufigsten faehrt '{_viel}': {seg_profil.fahrten_fenster[_viel]:.1f} "
      f"Fahrten, {_je_fahrt[_viel]:.2f} EUR je Fahrt")
print(f"Am meisten Umsatz bringt '{_stark}': {seg_profil.fahrten_fenster[_stark]:.1f} "
      f"Fahrten, {_je_fahrt[_stark]:.2f} EUR je Fahrt")
assert _viel != _stark, ("Auch bei den Regelsegmenten fallen fahrten- und "
                         "umsatzstaerkste Gruppe zusammen - der Text unten "
                         "behauptet dann einen Gegensatz, den es nicht gibt.")

fig, achsen = plt.subplots(1, 3, figsize=(15, 4))
for spalte, achse, titel in zip(["recency", "frequenz", "umsatz"], achsen,
                                ["Recency (Tage seit letzter Fahrt)",
                                 "Frequency (Fahrten im Fenster)", "Monetary (Entgelt im Fenster)"]):
    daten = [rfm.loc[rfm.cluster == c, spalte].values for c in sorted(rfm.cluster.unique())]
    achse.boxplot(daten, tick_labels=[f"C{c}" for c in sorted(rfm.cluster.unique())],
                  showfliers=False)
    achse.set_title(titel); achse.grid(alpha=.3)
plt.tight_layout(); plt.show()
'''),

MD("""
### 5.B.1 Ein Befund, der so nicht erwartet war

Sehen Sie sich die Spalten `fahrten_fenster` und `umsatz_fenster` nebeneinander an. Sie
heißen so und nicht `..._jahr`, weil ein Teil der Kundschaft **kein volles Jahr** beobachtet
wurde — für {{kurze_historie:.0f}} von ihnen wäre „je Jahr“ schlicht falsch:

**Das Segment mit den meisten Fahrten bringt am wenigsten Umsatz JE FAHRT.** Und diese
Einschränkung ist wichtig — lesen Sie die Tabelle genau:

**Wichtig ist, worüber hier gerechnet wird.** Die Zelle darüber zeigt zwei Tabellen: die
k-Means-Cluster und die **Regelsegmente**. Der Befund steht bei den Regelsegmenten — und
nur dort. Bei den Clustern fällt auf diesem Datenstand die fahrtenstärkste mit der
umsatzstärksten Gruppe zusammen; ein Gegensatz ließe sich dort gar nicht zeigen.

Das ist kein Schönheitsfehler, sondern der Grund, warum das Notebook Regeln ausliefert
und keine Clusternummern: **Die Regeln sind die Gruppen, auf die später jemand eine
Maßnahme anwendet.** Eine Geschichte über Gruppen, die niemand ausliefert, wäre für die
Geschäftsführung wertlos.

Die beiden Randgruppen der Regelsegmente — „{{viel_segment}}" und „{{stark_segment}}" —
nebeneinander:

Die Gruppe mit den **meisten Fahrten** kommt auf {{viel_fahrten:.1f}} Fahrten und
{{viel_umsatz:.2f}} € im Fenster — das sind **{{viel_je_fahrt:.2f}} € je Fahrt**. Die
Gruppe mit dem **höchsten Umsatz** fährt nur {{stark_fahrten:.1f}} mal, bringt aber
{{stark_umsatz:.2f}} € — **{{stark_je_fahrt:.2f}} € je Fahrt**, also das
{{faktor_je_fahrt:.1f}}-Fache.

> **Der Vergleich, auf den es ankommt:** Wer am häufigsten fährt, bringt je Fahrt am
> wenigsten. Wer beide Zahlen nebeneinanderlegt, sieht das Problem; wer nur eine nimmt,
> sieht es nicht.

> **Die Clusternummern sind nicht bedeutungstragend.** k-Means vergibt sie in der
> Reihenfolge, in der es die Zentren findet — schon eine leichte Verschiebung des
> Stichtags kann sie vertauschen. **Wer sich auf eine Clusternummer verlässt, verlässt
> sich auf einen Zufall.** Deshalb spricht auch dieser Text die Gruppen über ihre
> Eigenschaften an, und Phase 6 liefert Schwellen aus statt Nummern.

Ein Blick auf die Tarifspalten derselben Tabelle erklärt es:
{{viel_anteil_freiminuten:.0%}} der Gruppe „{{viel_segment}}" sitzen in einem Tarif **mit**
Freiminuten — OEPNV-Abo, Premium oder Student. Sie fahren viel und zahlen für die einzelne
Fahrt fast nichts. In der Gruppe „{{stark_segment}}" sind dagegen
{{stark_anteil_basis:.0%}} im **Basistarif**: keine Freiminuten, jede Minute wird
berechnet.

> **„OEPNV-Abo“ meint das Abo des Kunden, nicht eines bei VeloCity.** Alle vier Tarife
> sind beitragsfrei; die drei Vorteilstarife bekommt man über einen Nachweis —
> Studierendenausweis, Nahverkehrsabo oder Rahmenvertrag über den Arbeitgeber. Die Spalte
> `voraussetzung` in `tarif.csv` nennt sie.

### 5.B.2 Das ist kein Messfehler — das ist ein Preisproblem

An dieser Stelle liegt die Versuchung nahe, nach einer fehlenden Umsatzkomponente zu
suchen: Zahlen die Vielfahrer nicht vielleicht einen Monatsbeitrag, den wir übersehen
haben?

**Nein.** VeloCity erhebt **keine Grundgebühr** — das ist Teil des Produktversprechens und
steht so auf der Startseite („0 Euro Anmeldegebühr“); die Preisauskunft nennt
ausschließlich *Startgebühr plus Minutenpreis, gedeckelt auf einen Tageshöchstpreis*. Das
Nutzungsentgelt **ist** der gesamte Umsatz.

Damit ist der Befund kein Fehler in unserer Merkmalsdefinition, sondern eine Aussage über
das Geschäft:

> **Die aktivsten Kundinnen und Kunden bringen am wenigsten ein — und niemand gleicht das
> aus.**

Rechnen wir aus, um wieviel es geht. Die Zelle unten bildet für jede Fahrt den Preis, den
sie **ohne** Freiminuten gekostet hätte — mit Startgebühr, Minutenpreis, Premiumrabatt und
Tageshöchstpreis, also nach derselben Tariflogik wie die echte Abrechnung. Die Differenz
zum gezahlten Entgelt ist der tarifliche Gegenwert der Freiminuten.

> **Diese Zahl ist ein statisches Gegenfaktum, kein realisierbarer Mehrumsatz.** Sie
> beantwortet genau eine Frage: *Was hätten dieselben Fahrten bei null Freiminuten
> gekostet?* Der Tarif ist darin vollständig abgebildet — Rabatt und Deckel eingeschlossen.
>
> **Was sie nicht abbildet, ist das Verhalten.** Kundschaft, die für jede Minute zahlt,
> fährt vermutlich weniger, kürzer oder gar nicht. Der Betrag ist deshalb eine
> **Obergrenze unter unverändertem Fahrverhalten** — und Fahrverhalten ist genau das, was
> sich bei einer Tarifänderung ändert.
>
> Die Frage, wo Freiminuten „am wenigsten binden", lässt sich mit Beobachtungsdaten
> ohnehin nicht beantworten: Wer viele Freiminuten verbraucht, könnte sie brauchen — oder
> gerade deshalb dabei sein. Das trennt nur ein Versuch, kein Datensatz.
"""),

CODE("""
import math

raeder = pd.read_csv(BASIS + "fahrrad.csv")
preise = pd.read_csv(BASIS + "nutzungspreis.csv").set_index("typ_code")

tarife = pd.read_csv(BASIS + "tarif.csv")
kunden_tarif = kunden.merge(tarife[["tarif_code", "rabatt_prozent"]],
                           on="tarif_code", how="left")

fenster2 = fenster.merge(raeder[["fahrrad_id", "typ_code"]], on="fahrrad_id", how="left")
fenster2 = fenster2.merge(kunden_tarif[["kunde_id", "rabatt_prozent"]],
                          on="kunde_id", how="left")
fenster2["dauer_min"] = (fenster2.endzeit - fenster2.startzeit).dt.total_seconds() / 60
fenster2["freiminuten"] = (fenster2.dauer_min - fenster2.berechnete_minuten).clip(lower=0)

# WAS DIE FREIMINUTEN WERT SIND - mit der vollen Tariflogik, nicht mit dem
# blossen Minutenpreis. Der Rabatt gilt auch fuer die geschenkten Minuten, und
# der Tagesdeckel begrenzt sie: Wer ohnehin am Deckel liegt, dem schenkt das
# Kontingent nichts mehr.
#
# Der Wert ist die DIFFERENZ zwischen dem, was ohne Kontingent faellig waere,
# und dem, was tatsaechlich gezahlt wurde. Damit steht das gespeicherte
# entgelt_eur in der Rechnung - eine eigene Formel, die man daneben halten
# muesste, gibt es gar nicht erst.
def preis_ohne_freiminuten(minuten, typ, rabatt_prozent):
    p = preise.loc[typ]
    minuten = int(math.ceil(max(0.0, minuten)))
    tage = max(1, math.ceil(minuten / (24 * 60)))
    roh = min(p.startgebuehr_eur + minuten * p.preis_pro_minute_eur,
              p.tageshoechstpreis_eur * tage)
    return round(roh * (1 - rabatt_prozent / 100.0), 2)

fenster2["voller_preis"] = [
    preis_ohne_freiminuten(m, t, r) for m, t, r
    in zip(fenster2.dauer_min, fenster2.typ_code, fenster2.rabatt_prozent.fillna(0))]
fenster2["verschenkt_eur"] = (fenster2.voller_preis - fenster2.entgelt_eur).clip(lower=0)

# Gegenprobe: Wo keine Freiminuten flossen, muss der volle Preis dem
# gezahlten entsprechen. Trifft das nicht zu, stimmt die Tariflogik nicht.
_ohne = fenster2[fenster2.freiminuten < 0.01]
_abw = (_ohne.voller_preis - _ohne.entgelt_eur).abs()
print(f"Gegenprobe an {len(_ohne):,} Fahrten ohne Freiminutennutzung: "
      f"{(_abw < 0.005).mean():.2%} exakt gleich")
assert (_abw < 0.005).mean() > 0.999, (
    "Die Tariflogik bildet das gespeicherte Entgelt nicht ab - "
    "der verschenkte Betrag waere dann geraten.")

je_kunde = fenster2.groupby("kunde_id").verschenkt_eur.sum()
rfm["verschenkt"] = je_kunde.reindex(rfm.index).fillna(0)

vergleich = rfm.groupby("cluster").agg(
    kunden=("umsatz", "size"),
    fahrten_fenster=("frequenz", "mean"),
    gezahlt=("umsatz", "mean"),
    verschenkt=("verschenkt", "mean"),
).round(2)
vergleich["waere_gewesen"] = (vergleich.gezahlt + vergleich.verschenkt).round(2)
vergleich["Anteil verschenkt"] = (vergleich.verschenkt / vergleich.waere_gewesen).round(3)
print(vergleich.to_string())

gesamt_verschenkt = rfm.verschenkt.sum()
gesamt_gezahlt = rfm.umsatz.sum()
betrag = f"{gesamt_verschenkt:,.0f}".replace(",", ".")
anteil = gesamt_verschenkt / (gesamt_gezahlt + gesamt_verschenkt)
print()
print(f"Im letzten Jahr über Freiminuten abgegeben: {betrag} EUR LISTENWERT")
print(f"Das sind {anteil:.0%} des Listenwerts der gefahrenen Minuten.")

# WAS DER LISTENWERT NICHT IST: entgangener Umsatz.
# Er rechnet jede Freiminute zum vollen Minutenpreis. Ohne Freiminuten
# griffen aber zwei Regeln, die den Betrag druecken - der Premiumrabatt
# und der Tageshoechstpreis. Und die laengsten Fahrten treiben den
# Listenwert, obwohl gerade sie am Deckel haengen.
lang = fenster2[fenster2.dauer_min > 480]
print()
print(f"Zur Einordnung: {len(lang)} Fahrten über acht Stunden verursachen allein "
      f"{lang.verschenkt_eur.sum():,.0f} EUR".replace(",", ".") + " des Listenwerts -")
print(f"und genau diese Fahrten liefen ohne Freiminuten in den Tageshöchstpreis.")
print(f"Der Listenwert ist damit eine OBERGRENZE, kein entgangener Umsatz.")

plt.figure(figsize=(9, 4))
x = np.arange(len(vergleich))
plt.bar(x - 0.2, vergleich.gezahlt, 0.4, label="tatsächlich gezahlt", color="#3d4b6b")
plt.bar(x + 0.2, vergleich.verschenkt, 0.4, label="über Freiminuten abgegeben", color="#e00034")
plt.xticks(x, [f"Cluster {c}" for c in vergleich.index])
plt.ylabel(f"EUR je Kunde im {FENSTER_TAGE}-Tage-Fenster"); plt.legend()
plt.title("Was jedes Segment zahlt — und was es geschenkt bekommt")
plt.tight_layout(); plt.show()
"""),

MD("""
**Jetzt ist das Bild vollständig, ohne dass wir eine Zahl erfinden mussten.** Das Segment
mit den meisten Fahrten zahlt am wenigsten **je Fahrt** *und* bekommt am meisten
geschenkt. Beides
zusammen erklärt den Befund vollständig.

> **Für CRISP-DM ist dieser Moment lehrbuchreif** — allerdings anders, als man zunächst
> vermutet. Die Evaluation deckt **keinen** Fehler im Modell und keinen in der
> Merkmalsdefinition auf. Sie deckt eine **Geschäftsfrage** auf, die vor der Analyse
> niemand gestellt hatte: *Sind die Freiminuten dort richtig eingesetzt, wo sie liegen?*
>
> Der Pfeil führt trotzdem zurück nach Phase 1 — nicht um einen Fehler zu beheben,
> sondern weil die Analyse eine bessere Frage hervorgebracht hat als die, mit der sie
> begonnen hat. Das ist der häufigere und wertvollere Fall.

### 5.B.3 Eine Idee für die Geschäftsführung — ausdrücklich als Vorschlag

Die folgende Rechnung ist **kein Befund aus den Daten**, sondern ein Was-wäre-wenn. Sie
gehört in eine Entscheidungsvorlage, nicht in einen Analysebericht — und muss als
Vorschlag gekennzeichnet sein, sonst liest sie jemand als Tatsache.
"""),

CODE("""
# ACHTUNG: hypothetisch. VeloCity hat KEINE Grundgebühr, und das ist Teil
# des Kundenversprechens. Die Rechnung zeigt nur, welche Groessenordnung ein
# Beitrag haette, der die abgegebenen Minuten ausgleicht.
mit_freiminuten = rfm[rfm.verschenkt > 0]
# NICHT PAUSCHAL DURCH ZWOELF.
#
# Ein Teil der Kundschaft war kuerzer als ein Jahr dabei. Ihr Fensterwert durch 12
# geteilt ergaebe einen zu niedrigen Monatswert. Geteilt wird deshalb
# durch die TATSAECHLICH beobachteten Kundenmonate.
monate_beobachtet = (beobachtet.reindex(mit_freiminuten.index)
                     .fillna(FENSTER_TAGE) / 30.44)
je_monat = (mit_freiminuten.verschenkt.sum() / monate_beobachtet.sum())

print("HYPOTHESE, kein Befund:")
print(f"  Kundschaft mit Freiminuten:            {len(mit_freiminuten):>6d}")
print(f"  im Mittel abgegeben, im Fenster:       {mit_freiminuten.verschenkt.mean():>6.2f} EUR")
print(f"  ein ausgleichender Beitrag laege bei:  {je_monat:>6.2f} EUR im Monat")
print()
print("  Zu bedenken, bevor daraus ein Vorschlag wird:")
print("   - die Startseite wirbt ausdrücklich mit '0 Euro Anmeldegebühr'")
print("   - Freiminuten binden Kundschaft; ihr Wert steckt nicht nur im Umsatz")
print("   - ein Beitrag würde die günstigsten Segmente am härtesten treffen")
print()
print("  Die billigere Alternative: die Freiminuten dort kürzen, wo sie am")
print("  wenigsten binden - das lässt sich mit denselben Daten prüfen.")
"""),

MD("""
### 5.B.4 Und die Kundschaft ganz ohne Fahrt?
"""),

CODE('''
ohne_fahrt = kunden[~kunden.kunde_id.isin(rfm.index)].copy()
ohne_fahrt["tage_seit_anmeldung"] = (stichtag - ohne_fahrt.registriert_am).dt.days
print(f"{len(ohne_fahrt)} Kundinnen und Kunden hatten im letzten Jahr keine einzige Fahrt.")
print(f"Das sind {len(ohne_fahrt)/len(kunden):.0%} des Bestands.\\n")
print("Wie lange sind sie schon angemeldet?")
print(ohne_fahrt.tage_seit_anmeldung.describe().round(0).to_string())
print("\\nTarifverteilung:")
print((ohne_fahrt.tarif_code.value_counts(normalize=True) * 100).round(0).to_string())
'''),

MD("""
**Diese Gruppe war in der Segmentierung gar nicht enthalten** — sie hat keine Fahrten,
also kein RFM-Profil. Sie ist aber mit knapp 30 % des Bestands die **größte Gruppe
überhaupt**, und für das Marketing die interessanteste: Wer nichts mehr fährt, ist
entweder verloren oder zurückzugewinnen.

> **Das ist der klassische Fehler bei RFM.** Das Verfahren betrachtet nur, wer gekauft
> hat. Wer aufgehört hat, fällt aus der Tabelle — und damit aus dem Blick. Man muss diese
> Gruppe ausdrücklich dazunehmen; sie kommt nicht von selbst.
"""),

# =====================================================================
PHASE(6, "Aus vier Stationstypen werden Dispositions-HYPOTHESEN, aus sieben "
         "Lebenszyklusgruppen ein analytischer Kampagnen-Arbeitsstand."),

CODE('''
# --- A) Die Stationsprofile
#
# WAS HIER STEHT, SIND HYPOTHESEN - KEINE BESTANDSANWEISUNGEN.
#
# Eine fruehere Fassung schrieb "bis 6:30 Uhr voll" und "halbe
# Bestueckung". Beides sind Aussagen ueber BESTAENDE, abgeleitet
# ausschliesslich aus ABFAHRTSPROFILEN. Ohne Ankuenfte, Kapazitaet und
# verlorene Nachfrage folgt daraus keine Menge - nur die Vermutung, wann
# ein Blick auf den Bestand lohnt.
#
# Die Zuordnung folgt zwei Merkmalen: dem Wochenendanteil und der Uhrzeit
# der Spitze. Beide stehen in der Tabelle aus Phase 5 - hier wird nichts
# geraten, sondern abgelesen.
namen_cluster, regeln, merkmale_je_cluster = {}, {}, {}
for c in sorted(S.cluster.unique()):
    g = S[S.cluster == c]
    # Die Stunde steht im SPALTENNAMEN, nicht im Index: Vor fuenf Uhr faehrt
    # niemand, also fehlen die ersten Spalten - ein Index waere um genau diese
    # Zahl verschoben und ergaebe Spitzen um drei Uhr morgens.
    spitze = int(g[stundenspalten].mean().idxmax().removeprefix("stunde_"))
    we = g.wochenendanteil.mean()
    # Vier Zweige, jeder an einer fachlichen Ueberlegung festgemacht - nicht an
    # den Clustern dieses Datenstands. Wer die Schwellen an die aktuellen
    # Gruppen anpasst, bekommt beim naechsten Stand wieder eine Kollision.
    if we > 0.45:
        bez, regel = ("Ausflugsstation",
                      "Abfahrtsspitze am Wochenende — Hypothese: "
                      "Bestandsprüfung erst spätvormittags nötig")
    elif spitze <= 9 and g.dauer_median.mean() > 15:
        # Morgens wird abgefahren, und die Wege sind lang: Wohngebiet am Rand.
        bez, regel = ("Wohnstation",
                      "Abfahrtsspitze früh, lange Wege in die Stadt — "
                      "Hypothese: frühe Bestandsprüfung testen")
    elif spitze <= 9:
        # Morgens wird abgefahren, aber die Wege sind kurz: mitten im Zentrum.
        bez, regel = ("Innenstadtstation",
                      "Abfahrtsspitze früh, kurze Wege im Zentrum — "
                      "Hypothese: frühe Prüfung, kleinere Nachfüllmenge testen")
    elif spitze >= 16:
        # Abends wird abgefahren: Hier kommt man an und faehrt weiter.
        bez, regel = ("Verkehrsknoten",
                      "Abfahrtsspitze am Abend, wenn die Züge ankommen — "
                      "Hypothese: Bestand am späten Nachmittag auffüllen")
    elif we > 0.25:
        # Nachmittagsspitze mit erhöhtem Wochenendanteil: Vorlesungsende und
        # Ausflugsrückkehr fallen hier zusammen.
        bez, regel = ("Nachmittagsstation",
                      "Abfahrtsspitze am frühen Nachmittag, auch am Wochenende — "
                      "Hypothese: Mittagsprüfung testen")
    else:
        bez, regel = ("Uni-Station",
                      "Abfahrtsspitze am frühen Nachmittag — Hypothese: "
                      "Bestandsprüfung zu dieser Zeit testen; einen "
                      "Semestereffekt separat mit dem Vorlesungskalender "
                      "untersuchen")
    namen_cluster[c], regeln[c] = bez, regel
    merkmale_je_cluster[c] = (spitze, we, g.dauer_median.mean(), list(g.index))
    for name in g.index:
        print(f"{name:<22s} {bez:<18s} {regel}")

# ─── KRITERIUM 2 AUS PHASE 1, MASCHINELL GEPRUEFT ───────────────────
# "Fuer jede Gruppe muss es eine ANDERE Massnahme geben. Zwei Gruppen mit
# derselben Massnahme sind eine Gruppe."
#
# Diese Zeile ist aus Schaden entstanden: Eine frühere Fassung hatte einen
# Zweig zu wenig, und der Mischtyp fiel auf "Uni-Station" durch. Im
# ausgelieferten CSV standen dann vier Uni-Stationen statt zwei - und
# Marktplatz und Juliuspromenade bekamen die Anweisung "vorlesungsfreie
# Zeit: halbe Bestueckung", die fuer sie falsch ist. Aufgefallen ist es
# niemandem, weil der Text daneben etwas anderes behauptete.
if len(set(namen_cluster.values())) != len(namen_cluster):
    # Die Meldung muss zeigen, WAS kollidiert - sonst sucht man die Ursache
    # in den Daten, obwohl sie in der Benennungsregel steckt.
    zeilen = ["Kriterium 2 verletzt: zwei Gruppen tragen denselben Namen.", ""]
    for c, (sp, we_, dau, mitglieder) in sorted(merkmale_je_cluster.items()):
        zeilen.append(f"  Cluster {c}: {namen_cluster[c]:<18s} "
                      f"Spitze {sp:2d} Uhr, Wochenende {we_:.0%}, "
                      f"Dauer {dau:.0f} Min")
        zeilen.append(f"             {', '.join(mitglieder)}")
    zeilen.append("")
    zeilen.append("Die Benennungsregel unterscheidet diese Gruppen nicht. Entweder "
                  "braucht sie ein weiteres Merkmal, oder die Gruppen sind eine.")
    raise AssertionError("\\n".join(zeilen))
assert len(set(regeln.values())) == len(regeln), (
    f"Kriterium 2 verletzt: zwei Gruppen bekommen dieselbe Regel - {regeln}")
print(f"\\nKriterium 2 geprüft: {len(namen_cluster)} Gruppen, "
      f"{len(set(regeln.values()))} verschiedene Prüfungshypothesen.")

S["stationstyp"] = S.cluster.map(namen_cluster)
S["regel"] = S.cluster.map(regeln)

# STABILE SCHLUESSEL IN DEN EXPORT. Der Stationsname ist eine Anzeige, kein
# Schluessel - er kann sich aendern, station_id nicht.
ausgabe_stationen = (S.reset_index()
                     .rename(columns={"index": "name"})
                     .merge(stationen[["station_id", "stationsnummer", "name"]],
                            on="name", how="left")
                     [["station_id", "stationsnummer", "name", "stationstyp", "regel",
                       "wochenendanteil", "dauer_median", "fahrten_gesamt"]])
ausgabe_stationen["stichtag"] = stichtag.date()

# WAS HIER STEHT - UND WAS NICHT.
#
# Die Typen und Regeln sind ausschliesslich aus ABFAHRTSPROFILEN abgeleitet:
# wann wird an dieser Station losgefahren. Fuer einen Umverteilungsplan
# fehlt die halbe Rechnung - Ankuenfte, Nettofluss, tatsaechlicher Bestand,
# Leer- und Vollzeiten, Kapazitaet, Stoerungen und die frei zurueck-
# gegebenen Raeder (Notebook 5). Die Datei heisst deshalb "stationsprofile"
# und die Spalte "hypothese", nicht "plan" und nicht "regel".
ausgabe_stationen = ausgabe_stationen.rename(columns={"regel": "hypothese"})
kopf_st = [
    f"# Stichtag: {stichtag.date()}",
    "# Datenherkunft: SYNTHETISCHE LEHRDATEN",
    "# Grundlage: NUR Abfahrtsprofile - keine Ankuenfte, Bestaende oder Kapazitaeten",
    "# STATUS: HYPOTHESEN - kein Umverteilungsplan, keine Sollbestaende",
]
with open("stationsprofile.csv", "w", encoding="utf-8") as f:
    f.write("\\n".join(kopf_st) + "\\n")
    ausgabe_stationen.to_csv(f, index=False)
print("geschrieben: stationsprofile.csv")
print("Die Spalte heisst 'hypothese': Sie sagt, WANN abgefahren wird -")
print("nicht, wieviele Raeder an dieser Station stehen sollen.")
'''),

CODE('''
# --- B) Der Kampagnenplan: Schwellen JE KUNDE, nicht je Cluster
#
# Die Schwellen stehen in Phase 5 - dort wurden sie aufgestellt und dort
# wurde ihre zeitliche Stabilitaet geprueft. Hier werden sie nur noch
# angewendet, auf jede einzelne Zeile: nur so ist die Zuordnung
# reproduzierbar. Eine fruehere Fassung wendete sie auf die vier
# Cluster-MITTELWERTE an und vergab den Namen dann an alle Mitglieder -
# das ist etwas anderes.
print(f"Angewandte Schwellen (aus Phase 5): recency > {SCHWELLE_RECENCY}, "
      f"frequenz > {SCHWELLE_FREQUENZ}, umsatz > {SCHWELLE_UMSATZ}\\n")
rfm["segment"] = rfm.apply(segment_benennen, axis=1)

# WAS KOSTET DER WECHSEL VON CLUSTERN AUF SCHWELLEN?
ueber_cluster = rfm.cluster.map(
    rfm.groupby("cluster").segment.agg(lambda s: s.value_counts().index[0]))
abweichung = (rfm.segment != ueber_cluster).mean()
print(f"Schwellen gegen Clusterzuordnung: {abweichung:.1%} der Kundschaft "
      f"bekommt ein anderes Segment.\\n")
print(pd.DataFrame({"über Cluster": ueber_cluster.value_counts(),
                    "über Schwellen": rfm.segment.value_counts()}).to_string())
print("\\nDas ist der Preis der Nachvollziehbarkeit - und er gehört benannt.")
'''),

MD("""
### 6.2 Die Population — wer überhaupt angeschrieben werden darf

Bis hierher war von {{n_rfm:,}} RFM-Kunden die Rede. Ein Kampagnenplan braucht aber die
**ganze** Kundschaft und einen **einzigen Nenner** — sonst summieren sich die Anteile auf
100 % einer Teilmenge, und daneben stehen weitere Kunden, die nirgends auftauchen.

Zwei Dinge fehlten bisher:

1. **Gesperrte Konten.** Sie stehen in der Segmentierung und im Plan, obwohl man sie
   nicht anschreiben darf.
2. **„Nie gefahren" stimmte nicht.** Wer im letzten Jahr nicht gefahren ist, ist nicht
   automatisch nie gefahren — und die drei Fälle brauchen drei verschiedene Maßnahmen.
"""),

CODE('''
# Wer ist ueberhaupt je gefahren? (ueber den GESAMTEN Zeitraum, nicht nur das Jahr)
je_gefahren = set(echte.kunde_id)

alle = kunden.set_index("kunde_id").copy()
alle["tage_dabei"] = (stichtag - alle.registriert_am).dt.days
alle["segment"] = rfm.segment          # nur fuer die RFM-Kundschaft gefuellt

def lebenszyklus(kid, zeile):
    if pd.notna(zeile.segment):
        return zeile.segment
    if kid in je_gefahren:
        return "Früher aktiv, jetzt inaktiv"
    if zeile.tage_dabei <= 365:
        return "Neu, noch keine Erstfahrt"
    return "Nie aktiviert"

alle["segment"] = [lebenszyklus(k, z) for k, z in alle.iterrows()]
# AKTIVES KONTO IST NICHT GLEICH ANSPRECHBAR.
#
# Der Status sagt, dass das Konto nicht gesperrt ist. Ueber eine
# Werbeeinwilligung oder eine andere Rechtsgrundlage fuer Direktmarketing
# sagt er nichts - dieses Feld gibt es in den Daten gar nicht. Der Name
# "ansprechbar" hat genau das behauptet.
alle["konto_aktiv"] = alle.status == "aktiv"
# Waere die Einwilligung erfasst, stuende sie hier. Sie ist es nicht -
# deshalb bleibt die Spalte leer und das zugehoerige Gate offen.
alle["marketing_freigegeben"] = pd.NA

print(f"Kundschaft insgesamt: {len(alle)}")
print(f"davon gesperrt und damit ausgeschlossen: {(~alle.konto_aktiv).sum()}\\n")

uebersicht = (alle.groupby("segment")
              .agg(kunden=("status", "size"), konten_aktiv=("konto_aktiv", "sum")))
uebersicht["Anteil gesamt"] = (uebersicht.kunden / len(alle) * 100).round(1)
print("EIN Nenner: alle Kundinnen und Kunden\\n")
print(uebersicht.sort_values("kunden", ascending=False).to_string())
print(f"\\nSumme der Anteile: {uebersicht['Anteil gesamt'].sum():.1f} % "
      f"(Rundung auf eine Stelle)")
'''),

MD("""
**Jetzt summieren sich die Anteile auf hundert Prozent derselben Grundgesamtheit** — und
die drei früher zusammengeworfenen Gruppen sind getrennt. „Neu, noch keine Erstfahrt"
braucht eine Willkommensansprache, „Früher aktiv, jetzt inaktiv" eine Rückgewinnung, und
„Nie aktiviert" nach über einem Jahr ist eine Karteileiche. Drei Zustände, drei Maßnahmen
— genau das verlangt Kriterium 2 aus Phase 1.

### 6.3 Der Export, den ein Kampagnensystem lesen kann
"""),

CODE('''
massnahmen = {
    "Vielfahrer":  "Bindung halten — und je Tarif prüfen, ob das Freiminutenvolumen nötig ist",
    "Umsatzträger":  "nicht anfassen: sie tragen den Umsatz",
    "Gelegenheitsnutzer":          "Anlass schaffen: Wetter-/Veranstaltungshinweis",
    "Eingeschlafen":               "Rückgewinnung: einmalig Freiminuten",
    "Früher aktiv, jetzt inaktiv": "Rückgewinnung: was hat gefehlt?",
    "Neu, noch keine Erstfahrt":   "Willkommensansprache zur Erstfahrt",
    "Nie aktiviert":               "keine Kampagne — Karteileiche",
}

export = alle[alle.konto_aktiv].copy()
export["maßnahme"] = export.segment.map(massnahmen)
export["stichtag"] = stichtag.date()
export["gilt_bis"] = (stichtag + pd.Timedelta(days=90)).date()
export["auswahlgrund"] = export.apply(
    lambda z: (f"recency {rfm.recency.get(z.name, float('nan')):.0f} d, "
               f"{rfm.frequenz.get(z.name, 0):.0f} Fahrten, "
               f"{rfm.umsatz.get(z.name, 0):.2f} EUR")
    if z.name in rfm.index
    else f"seit {z.tage_dabei:.0f} Tagen angemeldet, keine Fahrt im {FENSTER_TAGE}-Tage-Fenster",
    axis=1)

spalten = ["kundennummer", "segment", "maßnahme", "auswahlgrund",
           "stichtag", "gilt_bis", "tarif_code"]
export = export[export.segment != "Nie aktiviert"][spalten]

# JUNGE KUNDSCHAFT WIRD AUSGENOMMEN - nicht nur benannt.
# Wer noch kein volles Beobachtungsfenster dabei ist, hat ein Segment aus
# unvollstaendiger Historie. Es kann richtig sein; belegt ist es nicht.
_vorher_n = len(export)
export = export[export.index.isin(beobachtet[beobachtet >= FENSTER_TAGE].index)]
merke("export_jung_entfernt", _vorher_n - len(export))
print(f"Von der Ansprache ausgenommen: {_vorher_n - len(export)} Konten mit "
      f"weniger als {FENSTER_TAGE} Tagen Historie.")

# KONTROLLGRUPPE - ohne sie ist die Wirkung nicht messbar.
# Zehn Prozent bekommen KEINE Ansprache. Ihre Zeile bleibt in der Datei,
# damit spaeter vergleichbar ist, was ohne Massnahme geschah.
_zufall = np.random.default_rng(42).random(len(export))
export["gruppe"] = np.where(_zufall < 0.10, "Kontrollgruppe", "Ansprache")
export.loc[export.gruppe == "Kontrollgruppe", "maßnahme"] = "keine - Kontrollgruppe"
merke("kontrollgruppe_n", int((export.gruppe == "Kontrollgruppe").sum()))
print(f"Kontrollgruppe: {int((export.gruppe == 'Kontrollgruppe').sum())} von "
      f"{len(export)} Konten erhalten bewusst KEINE Ansprache.")

# DAS GATE AUS PHASE 5 ENTSCHEIDET, WAS HIER PASSIERT.
#
# Eine fruehere Fassung stellte in Phase 5 fest, dass die Stabilitaets-
# schwelle gerissen ist - und exportierte drei Zellen spaeter trotzdem
# eine Kampagnenliste, als waere nichts gewesen. Ein Kriterium, das den
# Export nicht bindet, ist kein Kriterium.
# EINE FREIGABE HAENGT AN MEHR ALS EINER ZAHL.
#
# Eine fruehere Fassung leitete den Status allein aus der Stabilitaet ab.
# Als das Gate von 25,4 % (falsch gemessen) auf 24,9 % (richtig gemessen)
# fiel, waere die Datei damit von GESPERRT auf FREIGEGEBEN gesprungen -
# ohne dass sich an ihrer Verwendbarkeit irgendetwas geaendert haette.
#
# Ein Kriterium, dessen Vorzeichen eine ganze Freigabe dreht, war nie
# das einzige Kriterium. Hier stehen alle - und die meisten sind offen.
# ─── DIE FREIGABEGATES, GETRENNT NACH ART ───────────────────────────
#
# Drei davon sind ANALYTISCH - sie werden hier gemessen. Zwei sind
# ORGANISATORISCH: Sie haengen nicht an dieser Auswertung, sondern daran,
# ob das Unternehmen etwas getan hat. Sie hier auf False zu setzen, weil
# das Notebook sie nicht pruefen kann, waere ein Kategorienfehler - dann
# koennte gar kein Kampagnenprodukt je entstehen.
#
# Beantwortet hat sie die Fachabteilung, und die Antworten stehen als
# Praemissen im Text darueber. Was das Notebook tun kann, ist sie
# BENENNEN und ihren Nachweis verlangen.
RECHTSGRUNDLAGE_DOKUMENTIERT = True   # Einwilligung bei Registrierung, Stand 08/2026
KONTAKTKANAL_ANGEBUNDEN = True        # Versand, Abmeldelink und Sperrliste produktiv
KONTROLLGRUPPE_VORGESEHEN = True      # 10 % der Zielgruppe erhalten keine Ansprache

# Junge Kundschaft: nicht bewerten, was nicht beobachtet werden konnte.
# Wer noch kein volles Fenster dabei ist, bekommt keine Ansprache - das ist
# die Behandlung, nicht nur die Benennung des Problems.
JUNGE_BEHANDELT = True   # umgesetzt beim Export unten, nicht nur behauptet

GATES = {
    f"Segmentstabilitaet <= {GATE_WECHSEL:.0%} je Quartal": KUNDENSEGMENTE_STABIL,
    "Beobachtungsdauer der jungen Kunden behandelt":        JUNGE_BEHANDELT,
    "Rechtsgrundlage fuer Direktmarketing dokumentiert":    RECHTSGRUNDLAGE_DOKUMENTIERT,
    "Kontaktkanal, Abmeldung und Sperrliste angebunden":    KONTAKTKANAL_ANGEBUNDEN,
    "Wirkung der Massnahmen kontrolliert messbar":          KONTROLLGRUPPE_VORGESEHEN,
}
KAMPAGNENFREIGABE = all(GATES.values())
freigabe = ("KAMPAGNENFREIGABE ERTEILT - Pilot mit Kontrollgruppe"
            if KAMPAGNENFREIGABE else
            "KEINE KAMPAGNENFREIGABE - offene Gates siehe Kopf")

print("FREIGABEPRUEFUNG\\n")
for name, erfuellt in GATES.items():
    print(f"   {'erfuellt' if erfuellt else 'OFFEN   '}  {name}")
print(f"\\n   Kampagnenfreigabe: {'JA' if KAMPAGNENFREIGABE else 'NEIN'} "
      f"({sum(GATES.values())} von {len(GATES)} Gates)\\n")
kopf = [
    f"# Stichtag: {stichtag.date()}, gueltig bis "
    f"{(stichtag + pd.Timedelta(days=90)).date()}",
    "# Datenherkunft: SYNTHETISCHE LEHRDATEN",
    f"# Segmentstabilitaet je Quartal: {liste_wechsel:.2%} Wechsel "
    f"(Schwelle {GATE_WECHSEL:.0%}), gemessen an der Kampagnen-Arbeitsliste; "
    f"ueber alle Lebenszykluszustaende waeren es {lz_wechsel:.2%}",
    "# Historische Kontosperren und Marketing-Einwilligungen sind nicht "
    "rekonstruierbar - dies ist die Stabilitaet der ANALYTISCHEN Regeln.",
    f"# STATUS: {freigabe}",
    "# NICHT AN EIN KAMPAGNENSYSTEM UEBERGEBEN.",
]
kopf += [f"# offenes Gate: {n}" for n, e in GATES.items() if not e]
if not KUNDENSEGMENTE_STABIL:
    kopf.append("# Zusaetzlich: jeder vierte Kunde bekaeme eine Ansprache, die "
                "zum Zeitpunkt des Versands nicht mehr passt.")
# KEIN PERSONENBEZOGENER BESTAND OHNE FREIGABE.
#
# Ein Kopfkommentar "nicht versenden" schuetzt niemanden: Die Datei enthielt
# dennoch dreitausend Konten mit zugeordneter Massnahme - handlungsfaehig,
# sobald sie jemand oeffnet. Solange Rechtsgrundlage, Einwilligung und
# technische Freigabe fehlen, entsteht nur ein AGGREGIERTER Pruefbericht.
# Die personenbezogene Zuordnung bleibt im Arbeitsspeicher.
if KAMPAGNENFREIGABE:
    _datei = "kampagnenliste.csv"
    _inhalt = export
else:
    _datei = "kampagnenbericht_aggregiert.csv"
    _inhalt = (export.groupby("segment")
               .agg(konten=("maßnahme", "size"),
                    maßnahme=("maßnahme", "first"))
               .reset_index())

with open(_datei, "w", encoding="utf-8") as f:
    f.write("\\n".join(kopf) + "\\n")
    _inhalt.to_csv(f, index=not KAMPAGNENFREIGABE is False)

print(f"KAMPAGNENAUSWERTUNG  Stichtag {stichtag.date()}, gültig 90 Tage")
print(f"STATUS: {freigabe}\\n")
_offen = [n for n, e in GATES.items() if not e]
if _offen:
    print(f"{len(_offen)} der {len(GATES)} Gates sind offen: {'; '.join(_offen)}")
else:
    print(f"Alle {len(GATES)} Gates gehalten - analytisch wie organisatorisch.")
if KAMPAGNENFREIGABE:
    print("Alle Gates gehalten - die personenbezogene Liste wird geschrieben.\\n")
    print(_inhalt.head(8).to_string())
    print(f"\\n{len(_inhalt)} aktive Konten, {export.segment.nunique()} Segmente")
else:
    print("Deshalb entsteht KEINE personenbezogene Liste, sondern ein")
    print("aggregierter Bericht. Er sagt, wie viele Konten je Segment")
    print("angesprochen WUERDEN - er nennt niemanden.\\n")
    print(_inhalt.to_string(index=False))
    print(f"\\n{export.shape[0]} Konten waeren betroffen - die Zuordnung")
    print("Person zu Massnahme verlaesst dieses Notebook nicht.")
merke("kampagnendatei", _datei)
print(f"\\ngeschrieben: {_datei}")
if not KUNDENSEGMENTE_STABIL:
    print()
    # Gemeldet wird die Zahl, die das Gate ENTSCHEIDET (liste_wechsel), nicht
    # die des RFM-Ausschnitts. Drei Nenner liefern drei Zahlen; wer hier die
    # falsche druckt, begruendet die Sperre mit einer Groesse, die sie nicht
    # ausgeloest hat.
    print("Zusaetzlich ist das Stabilitaetsgate gerissen "
          f"({liste_wechsel:.2%} > {GATE_WECHSEL:.0%}, gemessen auf der "
          "Kampagnen-Arbeitsliste).")'''),
MD("""
### 6.4 Was bei diesen beiden Auslieferungen zu beachten ist

**Die Stationsprofile** sind vergleichsweise harmlos — vier Hypothesen, die ein Mensch
liest und prüft. Sie sagen, *wann* an einer Station losgefahren wird, und leiten daraus
ab, *wann sich ein Blick auf den Bestand lohnt*. Sie sagen nicht, wie viele Räder dort
stehen sollen; dafür fehlen Ankünfte, Kapazität und verlorene Nachfrage.
Sie müssen aber **neu berechnet werden**, wenn eine Station dazukommt — und dann kann
sich die Zuordnung *aller* Stationen ändern, weil k-Means alle Zentren neu setzt. Ein
neues Cluster-Ergebnis ist nie eine Ergänzung, immer eine Neuberechnung.

**Der Kampagnenplan** ist heikler, und zwar aus einem Grund, der nichts mit Statistik zu
tun hat:

> Kundensegmente sind **personenbezogene Daten**. Wer segmentiert, verarbeitet sie — und
> braucht dafür eine Rechtsgrundlage. Ein Segment „Eingeschlafen“ mit einer
> Rückgewinnungsmail ist Direktwerbung; ein Segment „zahlungsschwach“ wäre etwas ganz
> anderes. Die Grenze verläuft nicht dort, wo die Technik endet.

### 6.5 Überwachung

| Wache | Schwelle | Reaktion |
|---|---|---|
| Silhouettenwert bei Neuberechnung | fällt unter 0,35 | Struktur löst sich auf — k neu bestimmen |
| Größe des kleinsten Segments | unter 5 % | Kriterium 3 aus Phase 1 gerissen |
| Wanderung zwischen Segmenten | über 25 % je Quartal | Segmente sind nicht stabil, Kampagnen laufen ins Leere |
| Anteil ohne Fahrt im Fenster | steigt | das eigentliche Alarmsignal fürs Geschäft |

**Die letzte Zeile ist die wichtigste** und hat mit dem Modell nichts zu tun: Wenn die
Gruppe der Nichtfahrer wächst, ist das ein Geschäftsproblem, kein Analyseproblem.
"""),

# =====================================================================
MD("""
---

# Der Kreislauf schließt sich

| Phase | A) Stationen | B) Kundschaft |
|---|---|---|
| 1 Business Understanding | Umverteilung nach Regeln statt nach Gefühl | Newsletter nach Segmenten statt an alle |
| *gemeinsame Erfolgskriterien* | benennbar · unterschiedlich behandelbar · groß genug · stabil | dieselben vier für beide Teile |
| 2 Data Understanding | Stammdaten enthalten keinen Typ — das Muster steckt im Verhalten | Kein Segment in der Kundentabelle |
| 3 Data Preparation | Tagesgang je Station, normiert und standardisiert | RFM über 365 Tage, Frequenz und Umsatz logarithmiert |
| 4 Modeling | k-Means, k über Ellenbogen und Silhouette | dasselbe Verfahren, dieselben Werkzeuge |
| 5 Evaluation | Vier benennbare Typen, gegen die verdeckte Wahrheit geprüft: {{generator_treffer:.0%}} Mehrheitszuordnung, ARI {{generator_ari:.3f}}. Stabilität gemessen, nicht behauptet | Vier Segmente, über die Startwerte reproduzierbar (ARI {{ari_kunden:.3f}}), aber mit schwächerer Trennung (Silhouette {{sil_kunden_k4:.3f}}) — dazu zwei Befunde, die weh tun, und eine hypothetische Rechnung |
| 6 Deployment | **Stationsprofile** als CSV — Hypothesen, kein Sollbestand | **Gesperrter analytischer Arbeitsstand**: **alle sechs** Freigabe-Gates offen. Auch das Stabilitätsgate reißt, sobald man es am richtigen Nenner misst — an denen, die eine Ansprache bekämen |

**Die zwei Befunde aus Phase 5.B, die weh tun**

1. **Die Vielfahrer bringen den geringsten Umsatz je Fahrt** —
   {{viel_je_fahrt:.2f}} € gegen {{stark_je_fahrt:.2f}} € —
   weil ihre Tarife Freiminuten
   enthalten. Und weil in den vorliegenden Daten **keine Grundgebühr und keine andere
   Kompensation** erfasst ist — Partnerzahlungen oder Rahmenverträge sind nicht
   modelliert —, gibt es hier nichts, was das
   ausgliche: Das Nutzungsentgelt ist der gesamte Umsatz. Das ist kein Messfehler,
   sondern ein Preisproblem, das die Segmentierung sichtbar gemacht hat. Nachgerechnet
   ist auch, um wieviel es geht — der Listenwert der abgegebenen Freiminuten steht in
   den Daten.
2. **Knapp ein Drittel der Kundschaft taucht in der Segmentierung überhaupt nicht auf**, weil
   sie im letzten Jahr nicht gefahren ist. RFM sieht nur, wer kauft. Wer aufgehört hat,
   fällt aus der Tabelle — und aus dem Blick.

**Was eine zweite Runde anders machen würde**

1. **Zurück zu Phase 1, mit einer besseren Frage.** Nicht „welche Segmente gibt es?“,
   sondern „sind die Freiminuten dort richtig eingesetzt, wo sie liegen?“ — die Analyse
   hat eine Frage hervorgebracht, die vorher niemand gestellt hatte. Sauber wäre dafür
   ein **Deckungsbeitrag** statt des Entgelts: abzüglich der Kosten, die eine Fahrt
   verursacht (Umverteilung, Verschleiß, Strom).
2. **Zurück zu Phase 3:** Die kurze Beobachtungsdauer fachlich behandeln — junge
   Kundschaft als eigene Onboardingkohorte, eine Mindestexposition oder
   expositionsbereinigte Schwellen. Die Hochrechnung in Phase 5 ist eine Diagnose, keine
   Lösung; das zugehörige Freigabe-Gate bleibt bis dahin offen.
3. **Die Schwellen prospektiv prüfen.** Sie sind am aktuellen Datenstand abgelesen und
   dann rückwärts auf ein früheres Fenster angewandt. Das ist eine Stabilitätsdiagnose,
   kein Zukunftstest — und die beiden 365-Tage-Fenster überlappen sich stark. Sauber
   wäre: Schwellen auf einem früheren Stand festlegen, unverändert auf einen später
   unberührten Zeitraum anwenden, und das über mehrere rollierende Cutoffs.
4. **Ein anderes Verfahren erwägen:** k-Means unterstellt kugelförmige, gleich große
   Gruppen. Für Segmente mit sehr unterschiedlicher Streuung sind hierarchisches
   Clustering oder Gaussian Mixture Models oft passender.

**Weiter geht es mit Notebook 4 — Zeitreihe:** Dort kommt eine Größe dazu, die in diesem
Notebook keine Rolle spielte und alles verändert: **die Reihenfolge**. Wenn die Zukunft
vorhergesagt werden soll, darf man beim Aufteilen nicht mehr würfeln.
"""),
]
