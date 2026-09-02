# Die sechs Modelle der VeloCity-Fallstudie

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
In Notebook 1 lautet sie: *In mindestens 80 % der Fälle enthält die
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

**Ergebnis.** Alle drei geprüften Verfahren bestehen sämtliche Hürden (Perzentiltabelle, Quantilregression und Quantiltabelle). Ausgeliefert wird die
**Perzentiltabelle** — nicht wegen der besseren Prognosegüte, sondern nach einer vorab
festgelegten Auswahlregel,
die bei gleicher Eignung die einfachere Betriebsform bevorzugt. Eine CSV-Datei lässt sich
ohne laufenden Dienst betreiben; das kostet 19,0 % Reichweite
gegenüber der Quantilregression.

- Die Zusage von 80 % ist auf einem versiegelten Zeitraum belegt:
  **81,1 %** auf der Abnahme, 7 von
  7 Gates halten.
- Beantwortet werden **34 %** der Anfragen. In den übrigen Fällen
  gibt die Anwendung keine Auskunft, weil die Spanne dort zu breit wäre, um zu nützen.
- Status: **sichtbar**; die Auskunft gilt für Fahrten bis zum
  07.11.2026.

**Was offen bleibt.** In 21 % der Fahrten weicht das tatsächliche
Ende vom angegebenen Ziel ab. Die Zusage trägt deshalb eine Bedingung, die in jeder
Antwort der Anwendung mitgeteilt wird: *„Preis für eine Fahrt zu Ihrem gewählten Ziel, bis 8 Stunden. Fahren Sie ein anderes Ziel an oder länger, gilt die Schätzung nicht."* Ob eine reale Anwendung
das gewünschte Ziel ebenso vollständig erfasst wie dieser Datensatz, lässt sich nur im
Schattenbetrieb klären.

---

## Notebook 2 — Vorausschauende Wartung *(Klassifikation)*

**Fragestellung.** Die Werkstatt kann je Quartal nur 60 Räder
vorsorglich prüfen. Welche Räder gehören auf diese Liste?

**Vorgehen.** Für jedes Rad wird vorhergesagt, ob es innerhalb von
90 Tagen auffällig wird. Die beiden Fehlerarten sind
unterschiedlich teuer: Ein übersehener Ausfall kostet 180 €,
eine unnötige Prüfung 25 €. Dieses Verhältnis geht als
Klassengewicht in die Modelle ein.

**Ergebnis.** Ausgeliefert wird eine Faustregel, nicht das Random-Forest-Modell. Im
Testquartal trifft die Regel 53 Räder gegenüber
44. Ausschlaggebend war jedoch nicht dieser Vorsprung, sondern die
statistische Absicherung: Die untere Vertrauensgrenze der Regel liegt bei
77,8 % und damit über der geforderten Schwelle von
74,3 %; das Random-Forest-Modell erreicht 61,0 %
und verfehlt sie. Von zehn geprüften Rädern werden 8,8
innerhalb des Horizonts auffällig; von zehn tatsächlich auffälligen Rädern erfasst die
Liste 4,6. Beide Kennzahlen sind zutreffend und messen
Verschiedenes.

**Was offen bleibt.** Der Anteil auffälliger Räder schwankt über die
8 Stichtage zwischen 14,4 % und
49,6 %. Ein einzelnes günstiges Quartal belegt daher wenig; es
kann ebenso gut die Jahreszeit gewesen sein. Aus diesem Grund liegt eine Schattenliste
zum 24.08.2026 bei, deren Bewertung erst nach Ablauf des Horizonts
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
80 % richtig zugeordnet (Adjusted Rand Index
0,533). Ausgeliefert werden Stationsprofile; sie sind ausdrücklich
als Hypothesen gekennzeichnet und geben keinen Sollbestand vor.

Bei der **Kundschaft** halten 4 von 5
Kriterien. Analytisch gilt das Ergebnis als nicht belegt, für den Einsatz
als freigegeben: Es entsteht ausschließlich ein aggregierter Bericht ohne
Namensnennung. Der Punktwert liegt unter der Schwelle, die prospektive Prüfung steht jedoch aus — das Kriterium ist damit weder belegt noch widerlegt.

**Zwei Befunde verdienen besondere Beachtung.** Erstens erzielt das Segment
Vielfahrer mit 1,65 € je Fahrt den geringsten Umsatz,
während es bei den Umsatzträgern 6,20 € sind. Das ist
kein Messfehler, sondern ein Befund zur Tarifstruktur, den erst die Segmentierung
sichtbar gemacht hat. Zweitens erscheinen 32 % der
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

**Ergebnis.** Gewählt wurde Lineare Regression mit einem mittleren absoluten Fehler
von 13,9 Fahrten, gegenüber 29,7 bei der
Faustregel und 25,8 beim Nullmodell. Unter Ist-Wetter liegen lineares
Modell und Gradient Boosting praktisch gleichauf (11,14 gegenüber
11,09); erst unter Prognosewetter setzt sich das einfachere Verfahren
ab (13,90 gegenüber 14,34). Die Modellwahl hängt
damit unmittelbar an der Frage, unter welchen Bedingungen verglichen wird.

**Status.** Schattenpilot freigegeben — die Prognose läuft im internen Planungswerkzeug mit und wird protokolliert; niemand handelt nach ihr. Keine operative Dispositionsfreigabe.

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

**Ergebnis.** **Produkt A**, die automatische Umverteilung, ist nicht freigegeben (Wirtschaftlichkeit nicht prüfbar).
Ausschlaggebend dafür ist nicht die Qualität der Regeln: Fahrten, die mangels
verfügbarem Rad nie zustande kamen, sind in diesen Daten nicht enthalten und lassen sich
auch nicht aus den beobachteten Fahrten erschließen. Ohne sie ist der Nutzen einer
Umverteilung nicht zu beziffern.

**Produkt B**, der Dispositionshinweis, umfasst 6 von
11 geprüften Regeln. Gefordert war nicht ein Punktschätzer über
1,3, sondern die untere Grenze eines Tagesblock-Bootstraps; nur so lässt
sich die Abhängigkeit von Fahrten desselben Tages berücksichtigen. Status:
**analytisches Lehr-Gate bestanden — keine reale Betriebsfreigabe**.

**Was offen bleibt.** Die Hürde aus Phase 1 ist als Anteil an allen Warenkörben
formuliert. Umgerechnet entspricht sie 0,66 Fahrten je Werktag
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

**Ergebnis.** Produkt **A1** ist spezifiziert: als Regel beschrieben und
retrospektiv geprüft; Echtzeitquelle, Ausnahmeliste und Alarmkanal fehlen noch. Produkt
**A2** steht auf schatten, da für die Bewertung kein Label vorliegt. Bei
Produkt **B** halten 2 von 3 bindenden Gates auf dem unangetasteten Testabschnitt;
der Status lautet explorativ.

**Was offen bleibt.** Die globale Rangliste erreicht eine Trefferquote von
36,0 %, die im Betrieb tatsächlich erzeugbare Tagesliste dagegen
12,4 % — bei identischem Modell. Eine Kennzahl, die auf der Gesamtliste
ermittelt wurde, beschreibt nicht die Liste, mit der später gearbeitet wird.

---

## Übersicht und Ertrag

**Status nach dem letzten Lauf:**

| Notebook | Ausgeliefertes Artefakt | Status |
|---|---|---|
| 1 Preisauskunft | Perzentiltabelle als CSV-Datei | sichtbar |
| 2 Wartung | Faustregel und Schattenliste | historisch freigegeben, prospektiv offen |
| 3 Segmente | Stationsprofile; aggregierter Kundenbericht | analytisch nicht belegt, Einsatz freigegeben |
| 4 Nachfrage | Lineare Regression | schattenpilot |
| 5 Ströme im Netz | Produkt A: nicht freigegeben (Wirtschaftlichkeit nicht prüfbar); Produkt B: 6 Regeln | analytisches Lehr-Gate bestanden — keine reale Betriebsfreigabe |
| 6 Anomalien | A1, A2 und B getrennt | A1 spezifiziert, A2 schatten, B explorativ |

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
