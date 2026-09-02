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


VORLAGE = """# Was die sechs Modelle erforschen — und was dabei herauskommt

*VeloCity-Fallstudie · Handout für Studierende · automatisch aus den
Notebook-Ergebnissen erzeugt, deshalb immer auf dem Stand des letzten Laufs.*

---

## Vorab: vier Wörter, ohne die nichts davon zu verstehen ist

Jedes Notebook endet mit einem **Status**. Der sagt, was mit dem Ergebnis
passieren darf — und das ist etwas anderes als „das Modell ist gut".

| Status | Was das heißt |
|---|---|
| **gesperrt** | Das Verfahren hat seine eigene Hürde nicht genommen. Es wird nicht benutzt. |
| **Schattenbetrieb** | Es rechnet mit und wird protokolliert. **Niemand sieht das Ergebnis, niemand handelt danach.** So prüft man, ob eine Rechnung auch in der Wirklichkeit hält. |
| **betriebsgesperrt** | Die Zahlen halten, aber eine Voraussetzung fehlt — zum Beispiel ein Kalender, der nicht weit genug reicht. Kein Modellproblem, trotzdem keine Freigabe. |
| **sichtbar** | Kundschaft oder Personal bekommen das Ergebnis tatsächlich zu sehen. |

Zwei Begriffe kommen ständig vor:

- **Zusage.** Was das Produkt verspricht, in Zahlen. Beispiel aus Notebook 1:
  *„In mindestens {{nb01_gate_schwelle:.0%}} der Fälle liegt der wirkliche Preis in der
  angezeigten Spanne."* An genau diesem Satz wird gemessen — nicht an einer
  Kennzahl, die gut aussieht.
- **Reichweite.** Auf wie viele Anfragen das Produkt überhaupt antwortet. Ein Modell,
  das fast immer schweigt, hat leicht eine hohe Trefferquote. Deshalb zählt beides.

> **Der wichtigste Satz des ganzen Kurses:** Ein Erfolgskriterium wird **vor** der
> Messung festgelegt. Wer es hinterher anpasst, misst nichts mehr — auch dann nicht,
> wenn die Änderung sachlich richtig wäre.

---

## Notebook 1 — Was kostet meine Fahrt? *(Regression)*

**Die Frage.** Der Kunde steht am Rad, gibt ein Ziel ein und will vorher wissen,
was die Fahrt kostet. Der Preis hängt an der Dauer — die Dauer kennt niemand vorher.

**Was das Modell tut.** Es schätzt aus Start, geplantem Ziel, Radtyp und Zeitpunkt
nicht *eine* Zahl, sondern eine **Spanne** („zwischen 8 und 14 Minuten"). Aus der
Spanne wird über die Tariflogik ein Preisbereich.

**Das Ergebnis.**

- Ausgeliefert wird die **{{nb01_kandidat}}**. Sie war nicht die genaueste, sondern
  die einfachste unter denen, die alle Hürden nahmen — eine CSV-Datei statt eines
  Dienstes, der nachts jemanden aus dem Bett holt.
- Die Zusage von {{nb01_gate_schwelle:.0%}} ist auf einem versiegelten Zeitraum belegt:
  **{{nb01_ab_unten:.1%}}** auf der Abnahme, {{nb01_ab_gates_halten:.0f}} von
  {{nb01_ab_gates_gesamt:.0f}} Hürden halten.
- Die App antwortet auf **{{nb01_reichweite_real:.0%}}** der Anfragen. Bei den übrigen
  sagt sie nichts — bewusst, weil die Spanne dort zu breit wäre, um zu nützen.
- Status: **{{nb01_produktstatus}}** ({{nb01_statussatz}}), gültig für Fahrten bis zum
  {{nb01_gueltig_bis_lang}}.

**Der Haken, den man kennen muss.** In {{nb01_zielabweichung:.0%}} der Fahrten endet
jemand woanders, als er angegeben hat. Deshalb trägt die Zusage eine Bedingung, und die
steht in jeder Antwort der App: *„{{nb01_zusage_text}}"*

---

## Notebook 2 — Welches Rad geht als nächstes kaputt? *(Klassifikation)*

**Die Frage.** Die Werkstatt kann pro Woche nur eine begrenzte Zahl Räder prüfen.
Welche soll sie sich ansehen, damit möglichst wenige unterwegs ausfallen?

**Was das Modell tut.** Für jedes Rad wird geschätzt, ob es in den nächsten
{{nb02_horizont_tage:.0f}} Tagen auffällig wird. Das ist eine **Entscheidung**, keine
Zahl — und die beiden Fehler kosten unterschiedlich viel: ein verpasster Ausfall
{{nb02_kosten_verpasst:.0f}} €, eine unnötige Prüfung {{nb02_kosten_unnoetig:.0f}} €.

**Das Ergebnis.**

- **Ausgeliefert wird die Faustregel, nicht der Wald.** Im Testquartal trifft die
  Regel {{nb02_treffer_regel:.0f}} Räder, der Random Forest
  {{nb02_treffer_wald:.0f}} — und entschieden hat die statistische Absicherung:
  Untergrenze der Regel {{nb02_wilson_unten_regel:.1%}} gegen die geforderten
  {{nb02_k3_schwelle:.1%}}, der Wald erreicht nur {{nb02_wilson_unten_wald:.1%}}.
- Von zehn geprüften Rädern melden sich {{nb02_quote_regel_von_zehn:.1f}}; von zehn
  auffälligen erreicht die Liste {{nb02_abdeckung_von_zehn:.1f}}. Beide Zahlen sind
  richtig, und sie messen Verschiedenes.
- Dazu eine Schattenliste zum {{nb02_schatten_stichtag_lang}} — die Freigabe steht auf
  historischen Daten und wird prospektiv nachgeprüft.

**Der Haken.** Der Anteil auffälliger Räder schwankt über die
{{nb02_panel_stichtage:.0f}} Stichtage zwischen {{nb02_panel_grundrate_min:.1%}} und
{{nb02_panel_grundrate_max:.1%}}. Ein einzelnes gutes Quartal ist deshalb kein Ergebnis
— es kann die Jahreszeit gewesen sein.

---

## Notebook 3 — Welche Sorten von Stationen und Kunden gibt es? *(Clustering)*

**Die Frage.** Niemand hat je aufgeschrieben, welche Station ein Pendlerbahnhof ist
und welche Kundin eine Gelegenheitsfahrerin. Steckt das im Verhalten?

**Was das Modell tut.** Es gruppiert — ohne vorgegebene Antwort. Stationen nach ihrem
Tagesgang, Kundschaft nach Zuletzt/Wie-oft/Wie-viel (RFM).

**Das Ergebnis.**

- **Stationen:** benennbare Typen, gegen die verdeckte Wahrheit geprüft —
  {{nb03_generator_treffer:.0%}} richtig zugeordnet, ARI {{nb03_generator_ari:.3f}}.
  Ausgeliefert werden **Stationsprofile als Hypothesen**, kein Sollbestand.
- **Kundschaft:** {{nb03_gates_erfuellt:.0f}} von {{nb03_gates_gesamt:.0f}} Hürden.
  Analytisch **{{nb03_status_analytisch}}**, für den Einsatz
  **{{nb03_status_einsatz}}** — es entsteht nur ein aggregierter Bericht ohne Namen.
  {{nb03_gate_satz_kunden}}

**Die zwei Befunde, die wehtun.**

1. Die **{{nb03_viel_segment}}** bringen den geringsten Umsatz je Fahrt —
   {{nb03_viel_je_fahrt:.2f}} € gegen {{nb03_stark_je_fahrt:.2f}} € bei den
   {{nb03_stark_segment}}n. Kein Messfehler, sondern ein Preisproblem, das die
   Segmentierung sichtbar gemacht hat.
2. **{{nb03_kurze_historie_anteil:.0%}}** der Kundschaft taucht in der Segmentierung
   überhaupt nicht auf, weil sie im letzten Jahr nicht gefahren ist. RFM sieht nur, wer
   kauft — wer aufgehört hat, fällt aus dem Blick.

---

## Notebook 4 — Wie viele Fahrten werden es morgen? *(Zeitreihe)*

**Die Frage.** Die Disposition plant abends für den nächsten Tag. Wie viele Fahrten
kommen?

**Was das Modell tut.** Es rechnet aus Kalender und **Wettervorhersage** eine
Tageszahl. Entscheidend ist das Wort *Vorhersage*: Verglichen wird unter dem Wetter,
das um 18 Uhr bekannt ist — nicht unter dem, das hinterher wirklich war.

**Das Ergebnis.**

- Gewählt wurde **{{nb04_gewaehlt_name}}** mit einem mittleren Fehler von
  {{nb04_mae_linear:.1f}} Fahrten, gegen {{nb04_mae_faustregel:.1f}} bei der Faustregel
  und {{nb04_mae_null:.1f}} beim Nullmodell.
- Unter *Ist*-Wetter liegen lineares Modell und Gradient Boosting praktisch gleichauf
  ({{nb04_ist_linear:.2f}} gegen {{nb04_ist_boosting:.2f}}). Erst unter *Prognose*wetter
  zieht das einfachere Verfahren davon ({{nb04_mae_linear:.2f}} gegen
  {{nb04_mae_boosting:.2f}}) — die Modellwahl hängt daran, womit man vergleicht.
- Status: **{{nb04_status}}** — {{nb04_statussatz}}

**Der Haken.** Prognostiziert werden *Fahrten insgesamt*. Gebraucht werden *Räder je
Station*. Diese Übersetzung ist keine Formel, sondern eine eigene Analyse — und sie
fehlt noch.

---

## Notebook 5 — Von wo nach wo fahren die Leute? *(Assoziation)*

**Die Frage.** Gibt es Strecken, die im selben Zeitfenster häufiger vorkommen, als es
bei zufälliger Zielwahl zu erwarten wäre? Und halten diese Muster über die Zeit?

**Was das Modell tut.** Es zählt — Support, Konfidenz, Lift, drei Divisionen. Danach
wird die Regelmenge in einem Zeitraum gesucht, den es vorher nie gesehen hat, noch
einmal geprüft.

**Das Ergebnis.**

- **Produkt A (automatische Umverteilung): nicht freigegeben.** Nicht weil die Regeln
  schlecht wären, sondern weil die Wirtschaftlichkeit mit diesen Daten
  **{{nb05_a4_zustand_text}}** ist: Die Fahrten, die mangels Rad nie stattfanden, stehen
  nirgends.
- **Produkt B (Dispositionshinweis): {{nb05_b_regeln_n:.0f}} Regeln.** Jede einzeln im
  unangetasteten Zeitraum bestätigt — verlangt war die untere Grenze eines
  Tagesblock-Bootstraps über {{nb05_k2_lift}}, nicht bloß ein Punktschätzer.
  Von {{nb05_b1_kandidaten:.0f}} Kandidaten halten {{nb05_b1_gehalten:.0f}}.
- Status: **{{nb05_status_b}}**

**Der Haken.** Die Hürde aus Phase 1 klingt nach einer Zahl, ist aber keine:
{{nb05_k1_support:.0%}} aller Warenkörbe sind {{nb05_huerde_je_werktag:.2f}} Fahrten je
Werktag — eine Größenordnung, in der kein Transporter losfährt. Das Kriterium war auf
der falschen Skala formuliert. Es wurde trotzdem nicht nachträglich verschoben.

---

## Notebook 6 — Was ist hier gerade seltsam? *(Anomalieerkennung)*

**Die Frage.** Drei verschiedene, und das ist der Kern des Notebooks: Was ist ein
Rückgabeproblem *jetzt*? Was ist eine auffällige Fahrt? Welches Rad hat ein
Datenqualitätsproblem?

**Was das Modell tut.** Für die erste Frage genügt eine Regel. Für die zweite lernt ein
Isolation Forest, was „normal" ist — beim ersten Versuch fand er die Preisklasse statt
der Anomalien, und das fiel nur auf, weil jemand die zehn obersten Zeilen **angesehen**
hat.

**Das Ergebnis.**

- **A1 {{nb06_a1_status}}** — als Regel beschrieben und logisch geprüft; Echtzeitquelle
  und Alarmkanal fehlen.
- **A2 {{nb06_a2_status}}** — es gibt kein Label, also keine belegte Güte. Die globale
  Rangliste meldet {{nb06_globale_quote:.1%}}, die tatsächlich erzeugbare Tagesliste
  {{nb06_tagesquote:.1%}} — **bei demselben Modell**.
- **B {{nb06_b_status}}** — {{nb06_b_gates_halten}} Hürden halten auf dem unangetasteten
  Testabschnitt.

**Der Haken.** Eine Kennzahl auf der Gesamtliste sagt nichts über die Liste, die im
Betrieb tatsächlich entsteht. Der Unterschied zwischen {{nb06_globale_quote:.1%}} und
{{nb06_tagesquote:.1%}} ist kein Rundungsfehler, sondern zwei verschiedene Produkte.

---

## Was Sie mit alldem anfangen können

**Die sechs Status auf einen Blick** — so, wie der letzte Lauf sie gesetzt hat:

| Notebook | Was ausgeliefert wird | Status |
|---|---|---|
| 1 Preisauskunft | {{nb01_kandidat}} als CSV | **{{nb01_produktstatus}}** |
| 2 Wartungsrisiko | Faustregel + Schattenliste | historisch freigegeben, prospektiv offen |
| 3 Segmente | Stationsprofile · aggregierter Kundenbericht | analytisch {{nb03_status_analytisch}}, Einsatz {{nb03_status_einsatz}} |
| 4 Nachfrage | {{nb04_gewaehlt_name}} | **{{nb04_status}}** |
| 5 Wege im Netz | Produkt A: {{nb05_status_a}} · Produkt B: {{nb05_b_regeln_n:.0f}} Regeln | **{{nb05_status_b}}** |
| 6 Anomalien | A1, A2, B getrennt | A1 {{nb06_a1_status}} · A2 {{nb06_a2_status}} · B {{nb06_b_status}} |

**Der größere Teil davon darf am Ende nichts entscheiden.** Das ist kein Scheitern,
sondern das Ergebnis. Ein Kurs, in dem sechs von sechs Modellen freigegeben werden, hat
entweder sehr viel Glück gehabt oder seine Kriterien nachträglich angepasst.

Was Sie an jedem der sechs Notebooks üben können — unabhängig vom Verfahren:

1. **Die Frage vor der Methode.** Jedes Notebook beginnt mit einer
   Geschäftsentscheidung, nicht mit einem Algorithmus. Wer mit „ich nehme mal einen
   Random Forest" anfängt, hat schon verloren.
2. **Das Kriterium vor der Messung.** Und in der Einheit, in der später entschieden
   wird — Notebook 5 zeigt, was passiert, wenn man das versäumt.
3. **Die Baseline ernst nehmen.** In Notebook 2 gewinnt die Faustregel, in Notebook 4
   das einfachere Modell, in Notebook 1 die Tabelle. Dreimal.
4. **Einen Zeitraum versiegeln.** Wer auf denselben Daten einstellt und prüft, misst
   seine eigene Auswahl.
5. **Hinsehen.** Der teuerste Fehler dieser Fallstudie (Notebook 6) fiel nicht durch
   eine Kennzahl auf, sondern durch einen Blick in die Tabelle.

> **Und der Satz, der über allem steht:** Ausgeliefert wird, was gemessen wurde — nicht
> das, was im Text steht.
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
