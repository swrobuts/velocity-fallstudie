# Was die sechs Modelle erforschen — und was dabei herauskommt

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
  *„In mindestens 80 % der Fälle liegt der wirkliche Preis in der
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

- Ausgeliefert wird die **Perzentiltabelle**. Sie war nicht die genaueste, sondern
  die einfachste unter denen, die alle Hürden nahmen — eine CSV-Datei statt eines
  Dienstes, der nachts jemanden aus dem Bett holt.
- Die Zusage von 80 % ist auf einem versiegelten Zeitraum belegt:
  **81,1 %** auf der Abnahme, 7 von
  7 Hürden halten.
- Die App antwortet auf **34 %** der Anfragen. Bei den übrigen
  sagt sie nichts — bewusst, weil die Spanne dort zu breit wäre, um zu nützen.
- Status: **sichtbar** (die Anzeige ist freigeschaltet), gültig für Fahrten bis zum
  07.11.2026.

**Der Haken, den man kennen muss.** In 21 % der Fahrten endet
jemand woanders, als er angegeben hat. Deshalb trägt die Zusage eine Bedingung, und die
steht in jeder Antwort der App: *„Preis für eine Fahrt zu Ihrem gewählten Ziel, bis 8 Stunden. Fahren Sie ein anderes Ziel an oder länger, gilt die Schätzung nicht."*

---

## Notebook 2 — Welches Rad geht als nächstes kaputt? *(Klassifikation)*

**Die Frage.** Die Werkstatt kann pro Woche nur eine begrenzte Zahl Räder prüfen.
Welche soll sie sich ansehen, damit möglichst wenige unterwegs ausfallen?

**Was das Modell tut.** Für jedes Rad wird geschätzt, ob es in den nächsten
90 Tagen auffällig wird. Das ist eine **Entscheidung**, keine
Zahl — und die beiden Fehler kosten unterschiedlich viel: ein verpasster Ausfall
180 €, eine unnötige Prüfung 25 €.

**Das Ergebnis.**

- **Ausgeliefert wird die Faustregel, nicht der Wald.** Im Testquartal trifft die
  Regel 53 Räder, der Random Forest
  44 — und entschieden hat die statistische Absicherung:
  Untergrenze der Regel 77,8 % gegen die geforderten
  74,3 %, der Wald erreicht nur 61,0 %.
- Von zehn geprüften Rädern melden sich 8,8; von zehn
  auffälligen erreicht die Liste 4,6. Beide Zahlen sind
  richtig, und sie messen Verschiedenes.
- Dazu eine Schattenliste zum 24.08.2026 — die Freigabe steht auf
  historischen Daten und wird prospektiv nachgeprüft.

**Der Haken.** Der Anteil auffälliger Räder schwankt über die
8 Stichtage zwischen 14,4 % und
49,6 %. Ein einzelnes gutes Quartal ist deshalb kein Ergebnis
— es kann die Jahreszeit gewesen sein.

---

## Notebook 3 — Welche Sorten von Stationen und Kunden gibt es? *(Clustering)*

**Die Frage.** Niemand hat je aufgeschrieben, welche Station ein Pendlerbahnhof ist
und welche Kundin eine Gelegenheitsfahrerin. Steckt das im Verhalten?

**Was das Modell tut.** Es gruppiert — ohne vorgegebene Antwort. Stationen nach ihrem
Tagesgang, Kundschaft nach Zuletzt/Wie-oft/Wie-viel (RFM).

**Das Ergebnis.**

- **Stationen:** benennbare Typen, gegen die verdeckte Wahrheit geprüft —
  80 % richtig zugeordnet, ARI 0,533.
  Ausgeliefert werden **Stationsprofile als Hypothesen**, kein Sollbestand.
- **Kundschaft:** 4 von 5 Hürden.
  Analytisch **nicht belegt**, für den Einsatz
  **freigegeben** — es entsteht nur ein aggregierter Bericht ohne Namen.
  Punktwert unter der Schwelle, aber die prospektive Pruefung steht aus - nicht belegt, nicht widerlegt

**Die zwei Befunde, die wehtun.**

1. Die **Vielfahrer** bringen den geringsten Umsatz je Fahrt —
   1,65 € gegen 6,20 € bei den
   Umsatzträgern. Kein Messfehler, sondern ein Preisproblem, das die
   Segmentierung sichtbar gemacht hat.
2. **32 %** der Kundschaft taucht in der Segmentierung
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

- Gewählt wurde **Lineare Regression** mit einem mittleren Fehler von
  13,9 Fahrten, gegen 29,7 bei der Faustregel
  und 25,8 beim Nullmodell.
- Unter *Ist*-Wetter liegen lineares Modell und Gradient Boosting praktisch gleichauf
  (11,14 gegen 11,09). Erst unter *Prognose*wetter
  zieht das einfachere Verfahren davon (13,90 gegen
  14,34) — die Modellwahl hängt daran, womit man vergleicht.
- Status: **schattenpilot** — Schattenpilot freigegeben — die Prognose läuft im internen Planungswerkzeug mit und wird protokolliert; niemand handelt nach ihr. Keine operative Dispositionsfreigabe.

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
  **mit diesen Daten nicht prüfbar** ist: Die Fahrten, die mangels Rad nie stattfanden, stehen
  nirgends.
- **Produkt B (Dispositionshinweis): 6 Regeln.** Jede einzeln im
  unangetasteten Zeitraum bestätigt — verlangt war die untere Grenze eines
  Tagesblock-Bootstraps über 1,3, nicht bloß ein Punktschätzer.
  Von 11 Kandidaten halten 6.
- Status: **analytisches Lehr-Gate bestanden - keine reale Betriebsfreigabe**

**Der Haken.** Die Hürde aus Phase 1 klingt nach einer Zahl, ist aber keine:
1 % aller Warenkörbe sind 0,66 Fahrten je
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

- **A1 spezifiziert** — als Regel beschrieben und logisch geprüft; Echtzeitquelle
  und Alarmkanal fehlen.
- **A2 schatten** — es gibt kein Label, also keine belegte Güte. Die globale
  Rangliste meldet 36,0 %, die tatsächlich erzeugbare Tagesliste
  12,4 % — **bei demselben Modell**.
- **B explorativ** — 2 von 3 bindenden Hürden halten auf dem unangetasteten
  Testabschnitt.

**Der Haken.** Eine Kennzahl auf der Gesamtliste sagt nichts über die Liste, die im
Betrieb tatsächlich entsteht. Der Unterschied zwischen 36,0 % und
12,4 % ist kein Rundungsfehler, sondern zwei verschiedene Produkte.

---

## Was Sie mit alldem anfangen können

**Die sechs Status auf einen Blick** — so, wie der letzte Lauf sie gesetzt hat:

| Notebook | Was ausgeliefert wird | Status |
|---|---|---|
| 1 Preisauskunft | Perzentiltabelle als CSV | **sichtbar** |
| 2 Wartungsrisiko | Faustregel + Schattenliste | historisch freigegeben, prospektiv offen |
| 3 Segmente | Stationsprofile · aggregierter Kundenbericht | analytisch nicht belegt, Einsatz freigegeben |
| 4 Nachfrage | Lineare Regression | **schattenpilot** |
| 5 Wege im Netz | Produkt A: nicht freigegeben (Wirtschaftlichkeit nicht prüfbar) · Produkt B: 6 Regeln | **analytisches Lehr-Gate bestanden - keine reale Betriebsfreigabe** |
| 6 Anomalien | A1, A2, B getrennt | A1 spezifiziert · A2 schatten · B explorativ |

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
