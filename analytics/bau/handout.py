"""Baut das Studierenden-Handout aus den Merkzetteln der sechs Notebooks.

WARUM ALS GENERATOR UND NICHT ALS GESCHRIEBENES DOKUMENT:

Ein Handout mit abgetippten Zahlen ist beim naechsten Datenlauf falsch -
und zwar still. Genau dieser Fehler hat in dieser Fallstudie schon einmal
ein ganzes Gutachten gekostet: Der Text sagte "bestanden", der Lauf sagte
"nicht bestanden", und niemand sah es, weil beide Zahlen plausibel
aussahen.

Deshalb steht hier eine Vorlage mit denselben {{platzhaltern}}, die auch
die Notebooks verwenden - nur mit dem Notebook als Vorsatz:
{{nb01_kandidat}}, {{nb02_horizont_tage}}, {{nb05_b_regeln_n}}. Fehlt ein
Wert, bricht der Bau ab, statt eine Luecke zu drucken.

Aufruf: python3 analytics/bau/handout.py  (oder ueber bauen.py)
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from bauwerk import _einsetzen  # dieselbe Ersetzung wie in den Notebooks

HIER = os.path.dirname(os.path.abspath(__file__))
WURZEL = os.path.dirname(os.path.dirname(HIER))
WERTE = os.path.join(HIER, "werte")
ZIEL = os.path.join(WURZEL, "doku", "analytics",
                    "Handout_Die_sechs_Modelle.md")

# Reihenfolge ist die Reihenfolge der Lehrveranstaltung.
NOTEBOOKS = [
    ("nb01", "01_Regression_Fahrtdauer"),
    ("nb02", "02_Klassifikation_Wartungsrisiko"),
    ("nb03", "03_Clustering_Stationen_und_Kunden"),
    ("nb04", "04_Zeitreihe_Nachfrageprognose"),
    ("nb05", "05_Assoziation_Wege_im_Netz"),
    ("nb06", "06_Anomalieerkennung_Auffaellige_Vorgaenge"),
]


def werte_sammeln():
    """Fuehrt die sechs Merkzettel zu einem Woerterbuch mit Vorsatz zusammen."""
    alle = {}
    for vorsatz, datei in NOTEBOOKS:
        pfad = os.path.join(WERTE, f"{datei}.json")
        if not os.path.exists(pfad):
            raise SystemExit(
                f"ABBRUCH: {datei}.json fehlt. Das Handout kann keine Zahlen\n"
                f"    erfinden - erst 'python3 analytics/bau/bauen.py' laufen lassen.")
        with open(pfad, encoding="utf-8") as f:
            for schluessel, wert in json.load(f).items():
                # Ein Notebook, das seine Schluessel schon selbst benennt
                # (nb04_status), soll nicht nb04_nb04_status heissen.
                kurz = schluessel[len(vorsatz) + 1:] \
                    if schluessel.startswith(vorsatz + "_") else schluessel
                alle[f"{vorsatz}_{kurz}"] = wert
    return alle


VORLAGE = """# Die sechs Modelle der VeloCity-Fallstudie

*Handout zur Lehrveranstaltung. Sämtliche Kennzahlen dieses Dokuments werden beim Bau
der Notebooks aus deren Ergebnissen eingesetzt; es gibt daher keinen Stand, der von den
Notebooks abweicht.*

---

## Begriffe, die in allen sechs Notebooks gleich verwendet werden

Jedes Notebook endet mit einem **Status**. Er beschreibt nicht die Güte eines Verfahrens,
sondern die Frage, wofür dessen Ergebnis verwendet werden darf.

| Status | Bedeutung |
|---|---|
| **gesperrt** | Das Verfahren hat die vorab festgelegte Hürde nicht genommen und wird nicht eingesetzt. |
| **Schattenbetrieb** | Das Verfahren rechnet mit, die Ergebnisse werden protokolliert, aber nicht angezeigt; niemand handelt nach ihnen. Auf diese Weise lässt sich prüfen, ob eine Rechnung auch im laufenden Betrieb trägt. |
| **betriebsgesperrt** | Die Kennzahlen halten, doch eine betriebliche Voraussetzung fehlt — etwa ein Kalender, der nicht weit genug reicht. Das ist kein Modellproblem, begründet aber auch keine Freigabe. |
| **sichtbar** | Das Ergebnis wird Kundschaft oder Personal tatsächlich angezeigt. |

Zwei weitere Begriffe kehren durchgängig wieder:

**Zusage.** Die Leistung, die ein Produkt zusichert, formuliert als überprüfbare Aussage.
In Notebook 1 lautet sie: *In mindestens {{nb01_gate_schwelle:.0%}} der Fälle enthält die
angezeigte Spanne den tatsächlichen Preis.* Gemessen wird an dieser Aussage, nicht an
einer Kennzahl, die sich im Nachhinein als günstig erweist.

**Reichweite.** Der Anteil der Anfragen, die überhaupt beantwortet werden. Ein Verfahren,
das in Zweifelsfällen schweigt, erreicht mühelos eine hohe Trefferquote; erst beide
Größen zusammen beschreiben ein Produkt.

> **Grundregel der gesamten Fallstudie:** Ein Erfolgskriterium wird **vor** der Messung
> festgelegt. Wird es nachträglich angepasst, verliert die Messung ihre Aussagekraft —
> auch dann, wenn die Anpassung sachlich begründet wäre.

---

## Notebook 1 — Preisauskunft vor Fahrtantritt *(Regression)*

**Fragestellung.** Die Kundschaft soll den Preis kennen, bevor sie losfährt. Der Preis
ergibt sich aus der Fahrtdauer, und diese steht zum Zeitpunkt der Anfrage noch nicht fest.

**Vorgehen.** Geschätzt wird keine einzelne Zahl, sondern eine **Spanne** für die Dauer,
die das Tarifblatt in einen Preisbereich umrechnet. Drei Verfahren treten gegeneinander
an: eine Quantilregression, eine Tabelle aus historischen Perzentilen und eine tabellierte
Fassung der Regression. Alle drei werden am selben Kriterium gemessen, bevor entschieden
wird.

**Ergebnis.** {{nb01_zulaessige_satz}} ({{nb01_zulaessige}}). Ausgeliefert wird die
**{{nb01_kandidat}}** — nicht wegen der besseren Prognosegüte, sondern nach einer vorab
festgelegten Auswahlregel,
die bei gleicher Eignung die einfachere Betriebsform bevorzugt. Eine CSV-Datei lässt sich
ohne laufenden Dienst betreiben; das kostet {{nb01_verzicht_reichweite:.1%}} Reichweite
gegenüber der {{nb01_verzicht_kandidat}}.

- Die Zusage von {{nb01_gate_schwelle:.0%}} ist auf einem versiegelten Zeitraum belegt:
  **{{nb01_ab_unten:.1%}}** auf der Abnahme, {{nb01_ab_gates_halten:.0f}} von
  {{nb01_ab_gates_gesamt:.0f}} Gates halten.
- Beantwortet werden **{{nb01_reichweite_real:.0%}}** der Anfragen. In den übrigen Fällen
  gibt die Anwendung keine Auskunft, weil die Spanne dort zu breit wäre, um zu nützen.
- Status: **{{nb01_produktstatus}}**; die Auskunft gilt für Fahrten bis zum
  {{nb01_gueltig_bis_lang}}.

**Was offen bleibt.** In {{nb01_zielabweichung:.0%}} der Fahrten weicht das tatsächliche
Ende vom angegebenen Ziel ab. Die Zusage trägt deshalb eine Bedingung, die in jeder
Antwort der Anwendung mitgeteilt wird: *„{{nb01_zusage_text}}"* Ob eine reale Anwendung
das gewünschte Ziel ebenso vollständig erfasst wie dieser Datensatz, lässt sich nur im
Schattenbetrieb klären.

---

## Notebook 2 — Vorausschauende Wartung *(Klassifikation)*

**Fragestellung.** Die Werkstatt kann je Quartal nur {{nb02_kapazitaet:.0f}} Räder
vorsorglich prüfen. Welche Räder gehören auf diese Liste?

**Vorgehen.** Für jedes Rad wird vorhergesagt, ob es innerhalb von
{{nb02_horizont_tage:.0f}} Tagen auffällig wird. Die beiden Fehlerarten sind
unterschiedlich teuer: Ein übersehener Ausfall kostet {{nb02_kosten_verpasst:.0f}} €,
eine unnötige Prüfung {{nb02_kosten_unnoetig:.0f}} €. Dieses Verhältnis geht als
Klassengewicht in die Modelle ein.

**Ergebnis.** Ausgeliefert wird eine Faustregel, nicht das Random-Forest-Modell. Im
Testquartal trifft die Regel {{nb02_treffer_regel:.0f}} Räder gegenüber
{{nb02_treffer_wald:.0f}}. Ausschlaggebend war jedoch nicht dieser Vorsprung, sondern die
statistische Absicherung: Die untere Vertrauensgrenze der Regel liegt bei
{{nb02_wilson_unten_regel:.1%}} und damit über der geforderten Schwelle von
{{nb02_k3_schwelle:.1%}}; das Random-Forest-Modell erreicht {{nb02_wilson_unten_wald:.1%}}
und verfehlt sie. Von zehn geprüften Rädern werden {{nb02_quote_regel_von_zehn:.1f}}
innerhalb des Horizonts auffällig; von zehn tatsächlich auffälligen Rädern erfasst die
Liste {{nb02_abdeckung_von_zehn:.1f}}. Beide Kennzahlen sind zutreffend und messen
Verschiedenes.

**Was offen bleibt.** Der Anteil auffälliger Räder schwankt über die
{{nb02_panel_stichtage:.0f}} Stichtage zwischen {{nb02_panel_grundrate_min:.1%}} und
{{nb02_panel_grundrate_max:.1%}}. Ein einzelnes günstiges Quartal belegt daher wenig; es
kann ebenso gut die Jahreszeit gewesen sein. Aus diesem Grund liegt eine Schattenliste
zum {{nb02_schatten_stichtag_lang}} bei, deren Bewertung erst nach Ablauf des Horizonts
möglich ist.

---

## Notebook 3 — Stationstypen und Kundensegmente *(Clustering)*

**Fragestellung.** In den Stammdaten ist nicht vermerkt, welche Station als
Pendlerstation dient und welches Nutzungsmuster einzelne Kundengruppen zeigen. Lässt sich
beides aus dem beobachteten Verhalten rekonstruieren?

**Vorgehen.** Zwei getrennte Clusteranalysen: Stationen nach ihrem Tagesgang, Kundschaft
nach Aktualität, Häufigkeit und Umsatz. Da es keine vorgegebene richtige Lösung gibt,
werden die Gruppen an fünf vorab festgelegten Kriterien gemessen — sie müssen benennbar,
unterschiedlich behandelbar und hinreichend groß sein sowie gegenüber dem Startwert und
über die Zeit stabil bleiben.

**Ergebnis.** Bei den **Stationen** entstehen benennbare Typen. Gegen die im Datensatz
hinterlegte, dem Verfahren nicht bekannte Zuordnung geprüft, sind
{{nb03_generator_treffer:.0%}} richtig zugeordnet (Adjusted Rand Index
{{nb03_generator_ari:.3f}}). Ausgeliefert werden Stationsprofile; sie sind ausdrücklich
als Hypothesen gekennzeichnet und geben keinen Sollbestand vor.

Bei der **Kundschaft** halten {{nb03_gates_erfuellt:.0f}} von {{nb03_gates_gesamt:.0f}}
Kriterien. Analytisch gilt das Ergebnis als {{nb03_status_analytisch}}, für den Einsatz
als {{nb03_status_einsatz}}: Es entsteht ausschließlich ein aggregierter Bericht ohne
Namensnennung. {{nb03_gate_satz_kunden}}.

**Zwei Befunde verdienen besondere Beachtung.** Erstens erzielt das Segment
{{nb03_viel_segment}} mit {{nb03_viel_je_fahrt:.2f}} € je Fahrt den geringsten Umsatz,
während es bei den {{nb03_stark_segment}}n {{nb03_stark_je_fahrt:.2f}} € sind. Das ist
kein Messfehler, sondern ein Befund zur Tarifstruktur, den erst die Segmentierung
sichtbar gemacht hat. Zweitens erscheinen {{nb03_kurze_historie_anteil:.0%}} der
Kundschaft in der Segmentierung überhaupt nicht, weil sie im Betrachtungszeitraum nicht
gefahren sind. Ein Verfahren, das auf Nutzung beruht, erfasst abgewanderte Kundschaft
nicht.

---

## Notebook 4 — Nachfrageprognose für den Folgetag *(Zeitreihe)*

**Fragestellung.** Die Disposition plant am Vorabend für den kommenden Tag. Mit wie
vielen Fahrten ist zu rechnen?

**Vorgehen.** Aus Kalendermerkmalen und der **Wettervorhersage** wird eine Tageszahl
geschätzt. Entscheidend ist der Unterschied zwischen Vorhersage und späterem Ist-Wetter:
Verglichen werden die Verfahren unter dem Wetter, das um 18 Uhr bekannt ist, nicht unter
dem, das sich im Nachhinein eingestellt hat.

**Ergebnis.** Gewählt wurde {{nb04_gewaehlt_name}} mit einem mittleren absoluten Fehler
von {{nb04_mae_linear:.1f}} Fahrten, gegenüber {{nb04_mae_faustregel:.1f}} bei der
Faustregel und {{nb04_mae_null:.1f}} beim Nullmodell. Unter Ist-Wetter liegen lineares
Modell und Gradient Boosting praktisch gleichauf ({{nb04_ist_linear:.2f}} gegenüber
{{nb04_ist_boosting:.2f}}); erst unter Prognosewetter setzt sich das einfachere Verfahren
ab ({{nb04_mae_linear:.2f}} gegenüber {{nb04_mae_boosting:.2f}}). Die Modellwahl hängt
damit unmittelbar an der Frage, unter welchen Bedingungen verglichen wird.

**Status.** {{nb04_statussatz}}

**Was offen bleibt.** Prognostiziert wird die Gesamtzahl der Fahrten; benötigt wird die
Zahl der Räder je Station. Diese Umrechnung ist keine Formel, sondern eine eigene
Analyse, und sie steht noch aus.

---

## Notebook 5 — Systematische Ströme im Netz *(Assoziationsanalyse)*

**Fragestellung.** Gibt es Verbindungen, die innerhalb desselben Zeitfensters häufiger
auftreten, als bei zufälliger Zielwahl zu erwarten wäre? Und sind diese Muster zeitlich
stabil?

**Vorgehen.** Gezählt statt trainiert: Support, Konfidenz und Lift ergeben sich aus drei
Divisionen. Die Regeln werden in den ersten zwei Dritteln des Zeitraums gesucht; das
letzte Drittel bleibt bis zur Bestätigung ungeöffnet.

**Ergebnis.** **Produkt A**, die automatische Umverteilung, ist {{nb05_status_a}}.
Ausschlaggebend dafür ist nicht die Qualität der Regeln: Fahrten, die mangels
verfügbarem Rad nie zustande kamen, sind in diesen Daten nicht enthalten und lassen sich
auch nicht aus den beobachteten Fahrten erschließen. Ohne sie ist der Nutzen einer
Umverteilung nicht zu beziffern.

**Produkt B**, der Dispositionshinweis, umfasst {{nb05_b_regeln_n:.0f}} von
{{nb05_b1_kandidaten:.0f}} geprüften Regeln. Gefordert war nicht ein Punktschätzer über
{{nb05_k2_lift}}, sondern die untere Grenze eines Tagesblock-Bootstraps; nur so lässt
sich die Abhängigkeit von Fahrten desselben Tages berücksichtigen. Status:
**{{nb05_status_b}}**.

**Was offen bleibt.** Die Hürde aus Phase 1 ist als Anteil an allen Warenkörben
formuliert. Umgerechnet entspricht sie {{nb05_huerde_je_werktag:.2f}} Fahrten je Werktag
— einer Größenordnung, in der keine Umsetzfahrt begonnen wird. Das Kriterium war damit
auf der falschen Skala formuliert. Verschoben wurde es dennoch nicht, weil eine
nachträglich angepasste Hürde nichts mehr misst.

---

## Notebook 6 — Auffällige Vorgänge erkennen *(Anomalieerkennung)*

**Fragestellung.** Drei Fragen mit drei unterschiedlichen Entscheidungszeitpunkten:
Welches Rad ist gegenwärtig überfällig? Welche abgeschlossenen Vorgänge verdienen am
Folgetag eine Prüfung? Welche Station war über längere Zeit ohne Bewegung?

**Vorgehen.** Die erste Frage beantwortet eine Regel; ein Modell ist dafür nicht
erforderlich. Für die zweite lernt ein Isolation Forest, welche Vorgänge als
unauffällig gelten. Im ersten Anlauf trennte er die Preisklassen statt der Anomalien.
Bemerkt wurde das nicht anhand einer Kennzahl, sondern durch Sichtung der obersten
Zeilen der Rangliste.

**Ergebnis.** Produkt **A1** ist {{nb06_a1_status}}: als Regel beschrieben und
retrospektiv geprüft; Echtzeitquelle, Ausnahmeliste und Alarmkanal fehlen noch. Produkt
**A2** steht auf {{nb06_a2_status}}, da für die Bewertung kein Label vorliegt. Bei
Produkt **B** halten {{nb06_b_gates_halten}} Gates auf dem unangetasteten Testabschnitt;
der Status lautet {{nb06_b_status}}.

**Was offen bleibt.** Die globale Rangliste erreicht eine Trefferquote von
{{nb06_globale_quote:.1%}}, die im Betrieb tatsächlich erzeugbare Tagesliste dagegen
{{nb06_tagesquote:.1%}} — bei identischem Modell. Eine Kennzahl, die auf der Gesamtliste
ermittelt wurde, beschreibt nicht die Liste, mit der später gearbeitet wird.

---

## Übersicht und Ertrag

**Status nach dem letzten Lauf:**

| Notebook | Ausgeliefertes Artefakt | Status |
|---|---|---|
| 1 Preisauskunft | {{nb01_kandidat}} als CSV-Datei | {{nb01_produktstatus}} |
| 2 Wartung | Faustregel und Schattenliste | historisch freigegeben, prospektiv offen |
| 3 Segmente | Stationsprofile; aggregierter Kundenbericht | analytisch {{nb03_status_analytisch}}, Einsatz {{nb03_status_einsatz}} |
| 4 Nachfrage | {{nb04_gewaehlt_name}} | {{nb04_status}} |
| 5 Ströme im Netz | Produkt A: {{nb05_status_a}}; Produkt B: {{nb05_b_regeln_n:.0f}} Regeln | {{nb05_status_b}} |
| 6 Anomalien | A1, A2 und B getrennt | A1 {{nb06_a1_status}}, A2 {{nb06_a2_status}}, B {{nb06_b_status}} |

Der überwiegende Teil dieser Verfahren darf am Ende keine Entscheidung treffen. Das ist
kein Scheitern, sondern das Ergebnis der Prüfung. Eine Fallstudie, in der sechs von sechs
Verfahren freigegeben werden, hat entweder ungewöhnliches Glück gehabt oder ihre
Kriterien nachträglich angepasst.

**Fünf Punkte gelten unabhängig vom Verfahren:**

1. **Die Fragestellung steht vor der Methode.** Jedes Notebook beginnt mit einer
   betrieblichen Entscheidung, nicht mit einem Algorithmus. Wer mit der Wahl des
   Verfahrens einsetzt, überspringt die Festlegungen, an denen sich später alles
   entscheidet.
2. **Das Kriterium steht vor der Messung** — und zwar in der Einheit, in der später
   entschieden wird. Notebook 5 zeigt, welche Folgen es hat, wenn diese Bedingung
   verletzt ist.
3. **Die Vergleichsbasis verdient dieselbe Sorgfalt wie das Modell.** In Notebook 2 setzt
   sich eine Faustregel durch, in Notebook 4 das einfachere Verfahren, in Notebook 1 eine
   Tabelle.
4. **Ein Zeitraum muss versiegelt bleiben.** Wer auf denselben Daten einstellt und prüft,
   misst die Güte seiner eigenen Auswahl.
5. **Ergebnisse müssen gesichtet werden.** Der folgenreichste Fehler dieser Fallstudie
   (Notebook 6) fiel nicht durch eine Kennzahl auf, sondern beim Lesen der Rangliste.

> Maßgeblich ist, was gemessen wurde — nicht, was im begleitenden Text steht.
"""


def bauen():
    werte = werte_sammeln()
    text = _einsetzen(VORLAGE, werte, "Handout-Vorlage")
    os.makedirs(os.path.dirname(ZIEL), exist_ok=True)
    with open(ZIEL, "w", encoding="utf-8") as f:
        f.write(text)
    return ZIEL, len(text)


if __name__ == "__main__":
    ziel, laenge = bauen()
    print(f"Handout geschrieben: {os.path.relpath(ziel, WURZEL)} ({laenge:,} Zeichen)")
