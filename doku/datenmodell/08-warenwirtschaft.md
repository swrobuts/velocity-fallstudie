# 08 Warenwirtschaft

> Kunden und Mitarbeitende sind für PostgreSQL **dieselbe** Rolle. Die
> Trennung steht nicht im Recht, sondern in der Regel.

## Warum eine zweite Oberfläche und kein Verwaltungsbereich

Die Website (`src/`) spricht zehn öffentliche Sichten und fünf
`api_`-Funktionen an — genug, um eine Fahrt zu buchen, aber nichts, womit
sich der Betrieb steuern ließe. Ein Rad als defekt melden, eine Station
stilllegen, einen Kunden nach Art. 17 DSGVO löschen: das sind andere
Aufgaben, für andere Personen, mit anderen Folgen bei einem Fehler.

Naheliegend wäre gewesen, der Website einen `/admin`-Bereich anzufügen.
Dagegen sprechen zwei Dinge, die schon im Sicherheitskonzept
([07](07-sicherheitskonzept.md)) angelegt sind:

1. **Getrennte Bedrohungsmodelle.** Der anon-Key steht im Klartext im
   Browser jedes Besuchers. Ein Verwaltungsbereich, der über denselben
   Weg erreichbar ist, hätte denselben öffentlichen Schlüssel als
   Ausgangspunkt — der Schutz müsste dann vollständig aus der
   Rechteprüfung in der Datenbank kommen, ohne dass ein Angreifer das an
   der Struktur der Website überhaupt sehen könnte, wo er suchen soll.
   Zwei getrennte Anwendungen (`bikes.butscher.cloud`,
   `wawi.butscher.cloud`) machen sichtbar, wo die Grenze verläuft, statt
   sie in einer einzigen Seite zu verstecken.
2. **Andere Bedienung für andere Nutzung.** Eine Kundin bucht eine Fahrt
   in ein oder zwei Minuten, selten und meist mobil. Ein Mitarbeiter der
   Werkstatt öffnet dieselbe Oberfläche acht Stunden am Tag und bearbeitet
   zwanzig Schadensmeldungen hintereinander. Das verlangt eine Arbeitsliste
   mit Tastaturbedienung (Pfeiltasten, `Strg+S`, `Escape`) statt einer
   Werbeseite mit Karte und Tarifkarten — zwei Zumutungen, keine
   Kompromisse zwischen beiden.

Die Warenwirtschaft (`wawi/`) ist deshalb ein eigenes, unabhängig
auslieferbares Verzeichnis: eigenes `index.html`, eigenes `style.css`,
neun eigene JavaScript-Dateien, kein Verweis zurück in `src/`. Sie liest
ausschließlich `v_wawi_*`-Sichten und schreibt ausschließlich über
`api_*`-Funktionen — dieselbe Regel wie bei der Website, jetzt geprüft
gegen ein zweites, unabhängiges Verzeichnis (`tools/abnahme.sh`,
Prüfung 29).

## Der Lehrpunkt: Trennung durch Regel, nicht durch Recht

Wer sich bei `wawi.butscher.cloud` anmeldet, meldet sich bei **derselben**
Supabase-Instanz an wie bei der Website — derselben `auth.users`,
demselben Anmeldeformular, demselben Passwort. PostgreSQL kennt für einen
angemeldeten Nutzer nur eine einzige Rolle: `authenticated`. Ein Kunde und
ein Mitarbeiter sind für die Datenbank ununterscheidbar, solange man nur
auf die **Postgres-Rolle** schaut.

Das ist mit Absicht so gebaut, nicht ein Kompromiss: dasselbe Konto
(`swrobuts@googlemail.com`, Mitarbeiter `M-0001`) gehört zugleich Kunde
2334. Eine Person kann beides gleichzeitig sein, und die Datenbank soll
das nicht verhindern.

Wenn also `GRANT` allein nichts trennen kann — womit trennt die
Warenwirtschaft dann? Mit drei Bausteinen aus
`db/aufbau/0017_wawi_sicherheit.sql`:

```
velocity.mitarbeiter_id_aus_auth()   -- liefert die eigene mitarbeiter_id, oder NULL
velocity.ist_mitarbeiter()           -- ist die eigene auth.uid() mit einem aktiven Mitarbeiter verknüpft?
velocity.hat_rolle(p_code)           -- trägt der eigene Mitarbeitersatz diese Rolle?
```

Alle drei sind `security definer` und werten ausschließlich `auth.uid()`
aus — den Aufrufer selbst. Ein Kunde, der `hat_rolle('leitung')` aufruft,
bekommt `false`; das ist keine Fehlermeldung und kein Rechteentzug,
sondern eine ehrliche Antwort auf eine Frage, die für ihn mit „nein“
beantwortet ist. Über andere Personen verrät keine der drei Funktionen
etwas.

Diese drei Funktionen stecken dann an genau zwei Stellen:

- **In den RLS-Policies** der Warenwirtschaftstabellen (`mitarbeiter`,
  `rolle`, `schadensmeldung`, `wartungsauftrag`, …): jede Policy lautet
  sinngemäß `for select using (velocity.ist_mitarbeiter())`. Kein
  gesondertes `GRANT` für Mitarbeitende — dieselbe Rolle `authenticated`,
  aber eine Zeilenregel, die für einen Kunden immer leer bleibt.
- **In jeder `v_wawi_*`-Sicht selbst.** Die Sichten filtern nicht nach
  Datum oder Kunde, sondern nach Rolle: `v_wawi_flotte` liefert nur
  Zeilen, wenn `hat_rolle('disposition')` oder `hat_rolle('werkstatt')`
  oder `hat_rolle('leitung')` wahr ist. Ein Kunde, der dieselbe Anfrage
  stellt wie ein Mitarbeiter der Disposition, bekommt **null Zeilen** —
  keinen Fehler, keine Sperrmeldung. Die Anfrage ist vollkommen legal,
  ihre Antwort ist bloß leer.

Genau diese Eigenschaft ist die Falle, die die Oberfläche selbst
auffangen muss: „null Zeilen“ heißt in dieser Datenbank **drei**
verschiedene Dinge — kein Mitarbeiter, Mitarbeiter ohne passende Rolle,
oder ehrlich keine Daten. `wawi/anmeldung.js` unterscheidet sie deshalb
ausdrücklich, bevor irgendein Arbeitsbereich aufgebaut wird:

| Rückgabe von `meineRollen()` | Bedeutung | Was die Oberfläche zeigt |
|---|---|---|
| `null` | (noch) nicht angemeldet | Anmeldemaske |
| `false` | angemeldet, aber kein Mitarbeiter | „Kein Zugang“, Verweis auf `bikes.butscher.cloud` |
| leeres `Set` | Mitarbeiter, aber ohne zugeteilte Rolle | „Noch keine Rolle zugeteilt“, Verweis an die Leitung |
| gefülltes `Set` | Mitarbeiter mit mindestens einer Rolle | die Arbeitsoberfläche |

Der zweite Fall ist der häufigste und der, den man als Erstes vergisst:
**jeder** der 1014 Kunden kann sich bei `wawi.butscher.cloud` anmelden,
weil es dieselbe `auth.users` ist. Ohne diese Unterscheidung sähe ein
Kunde eine Arbeitsoberfläche, in der jede Liste leer bleibt —
fehlerfrei, leer, unerklärlich. Prüfung 31 in `tools/abnahme.sh` hält
genau das fest.

Und was einer Rolle nicht erlaubt ist, wird in der Navigation **nicht
angezeigt**, nicht ausgegraut (`wawi/rahmen.js`,
`navigationAufbauen()`): ein ausgegrauter Menüpunkt ist eine Einladung,
nach dem Grund zu fragen, ein fehlender ist keine.

## Was ein Mitarbeiter nicht sieht

Eine `v_wawi_*`-Sicht ist so knapp geschnitten, wie es die Aufgabe
erlaubt — nicht so breit, wie es technisch möglich wäre. Drei Auslassungen
sind bewusst und werden von `db/tests/t0018_wawi_sichten.sql`
(`test_v_kunde_ohne_bewegungsprofil`) maschinell geprüft:

- **Kein Passwort.** Es gibt in dieser Datenbank ohnehin keine
  Passwortspalte — die Anmeldung liegt vollständig bei Supabase Auth
  (siehe [07](07-sicherheitskonzept.md)). Auch ein Mitarbeiter mit der
  Rolle `leitung` kommt an kein Passwort heran, weil es nirgends steht.
- **Keine Bezahldaten.** `v_wawi_kunde` nennt weder ein Zahlungsmittel
  noch dessen Token. Der Kundenservice braucht zum Auskunftgeben und
  Anonymisieren keinen Zugriff auf Zahlungsmittel — und bekommt keinen.
- **Keine einzelne Fahrt — im Arbeitsalltag.** `v_wawi_kunde` liefert
  Fahrten und Umsatz nur als **Summe**. Eine Liste einzelner Fahrten mit
  Start, Ziel und Uhrzeit ist ein Bewegungsprofil, und für Sperrung oder
  Anonymisierung braucht es keins. Genau **eine** Ausnahme gibt es, und
  sie ist gewollt: die Auskunft nach Art. 15 (weiter unten).

Dieselbe Zurückhaltung gilt für eine ganze Sicht, nicht nur für einzelne
Spalten — und hier steckt eine Lehre, die uns erst die Schlussprüfung
gebracht hat. `v_wawi_fahrt_km` ist die Hilfssicht mit Einzelfahrten,
`kunde_id` und Zeitstempel, aus der `v_wawi_km_co2` seine Monatszahlen
bildet. Lange lautete der Schutz: „die Warenwirtschaft baut absichtlich
keine Maske darauf.“

**Das war kein Schutz.** Wer angemeldet ist, braucht keine Maske — die
Sicht war über PostgREST unter ihrem Namen abrufbar, 12 047 Zeilen, und
mit `v_wawi_kunde` verbunden ergab das einen namentlichen
Fahrtenverlauf. Eine Zusage darüber, was man *nicht baut*, ist keine
Schranke; eine Schranke ist, was jemand nicht *umgehen* kann.

Heute ist der Sicht das Leserecht für `authenticated` entzogen. Dass die
Auswertung trotzdem funktioniert, liegt an einer Eigenschaft von
PostgreSQL, die hier zum Lehrstück taugt: eine Sicht greift auf ihre
Grundlagen mit den Rechten **ihres Eigentümers** zu, nicht mit denen des
Aufrufers (solange sie nicht als `security_invoker` angelegt ist).
`v_wawi_km_co2` liest also weiter aus `v_wawi_fahrt_km`, während der
direkte Weg dorthin mit `permission denied` endet. Das Recht auf die
Hilfssicht war von Anfang an überflüssig — es hat nur niemand geprüft.

## Die Größenskalierung der Zahlen — fremdes Verfahren, genannte Quelle

Die Zahlen in den acht Kopftafeln und in den Balkenspalten der
Arbeitslisten sind **verschieden groß gesetzt: je größer der Wert, desto
größer die Zahl.** Das ist keine Erfindung dieses Projekts, und darum
gehört die Herkunft in dieses Dokument und nicht nur in einen Kommentar.

**Das Verfahren heißt Bissantz'Numbers** und stammt von der Bissantz &
Company GmbH. Die öffentliche Beschreibung, nach der `zahlSkaliert()` in
`wawi/rahmen.js` es umsetzt, steht unter
`www.bissantz.de/news/visual-intelligence/bissantznumbers/` (englisch
unter `www.bissantz.de/en/news/knowledge/bissantznumbers-typographically-scaled-numbers/`).
Die Grundregel dort wörtlich: „Je größer der Wert, desto größer die
Zahl." Und die Begründung: „Die Zahlengröße lenkt das Auge zu der
spannendsten Zahl, die man sich näher ansehen sollte."

**Bissantz nennt das Verfahren patentiert.** Auf der Seite zum
Office-Add-in steht die Angabe genauer — „Registered Design. German,
European and US-patents pending."
(`www.bissantz.de/en/news/bissantznumbers-add-in/`). Das gehört
ausdrücklich in die Nennung: Wer diese Fallstudie liest, soll wissen,
dass er es nicht mit einer freien Gestaltungsidee zu tun hat. Was hier
steht, ist die Nachbildung einer **öffentlich beschriebenen Regel** für
ein Lehrprojekt — keine Übernahme einer geschützten Umsetzung und kein
Anspruch auf den Namen.

**Die Quelle steht deshalb an drei Stellen, nicht an einer:** im
Kommentar bei `zahlSkaliert()` in `wawi/rahmen.js` (mit beiden Adressen),
**sichtbar in der Oberfläche** am Fuß jeder Kopftafel
(`kopftafelMethodennote()`, Übersetzungsschlüssel `board.scalingCredit`
in allen sechs Sprachen) — und hier.

Warum die sichtbare Nennung am Fuß der Kopftafel steht und nicht im
Profilmenü: „wo die Methode wirkt" ist die Tabelle, deren Zahlen
tatsächlich verschieden groß gesetzt sind. Wer den Größenunterschied
**sieht** und sich fragt, warum, sucht die Antwort im Blickfeld, nicht
drei Klicks entfernt in einem Menü, das man zum Sprachwechsel aufklappt.
Die Zeile erscheint deshalb auch nur dort, wo wirklich skaliert wird —
`kopftafelMethodennote()` prüft die Spalten — und verschwindet mit der
Tabelle, sobald die Tafel eingeklappt ist.

**Wo NICHT skaliert wird, und warum das eine Aussage ist.** Skaliert wird
ausschließlich dort, wo eine **gemeinsame Spaltenskala mit Nullpunkt**
existiert. Gruppen- und Summenzeilen bleiben draußen: ihr Wert ist aus
genau der Skala herausgerechnet, an der er gemessen würde. Und drei
Spalten der Art „Zahl ohne Balken" wurden einzeln geprüft — mit
verschiedenem Ergebnis:

| Spalte | Werte | Entscheidung |
|---|---|---|
| Umsatz je Radtyp (12 Monate) | 11.219 / 11.540 / 12.628 € — 1,13 zu 1 | **keine Skala**: 0,4 px Spanne; die Fahrtenspalte daneben trägt die Länge (8,0 zu 1) |
| Bewegungen je Station | 2.310 bis 2.488 — 1,08 zu 1 | **keine Skala**: 0,23 px Spanne, weniger als ein Bildschirmpunkt; die Umschlagspalte spreizt dieselbe Größe auf 49–100 % |
| Arbeitszeit je Meldung | 0 / 0 / 0 / 0 / 0 / 30 / 45 Minuten | **Skala** — der Balken bleibt trotzdem weg |

Die letzte Zeile ist der lehrreiche Fall: Ein **Balken** der Länge null
ist unsichtbar, fünf unbearbeitete Meldungen sähen aus wie fünf fehlende
Angaben. Eine **Zahl** der Größe null gibt es dagegen nicht — die Null
steht beim kleinsten Faktor mit 11,9 px lesbar da, während 30 auf
17,0 px und 45 auf 18,2 px wächst. Derselbe Wert, zwei Kanäle, zwei
verschiedene Antworten: Länge versagt hier, Größe trägt.

## Die Landkarte der Stationen — eine Fremdanfrage gegen eine brauchbare Karte

Die Stationskarte in `wawi/stationen.js` zeichnet Kartenkacheln von
OpenStreetMap über Leaflet (siehe `wawi/index.html` und den Kopfkommentar
von `stationenKarteZeigen()` in `wawi/stationen.js`) — eine Abkehr von der
ursprünglichen Projektregel „keine Abhängigkeit außer `supabase-js`"
(siehe die überholte Stelle in
`doku/plans/2026-08-25-velocity-warenwirtschaft-oberflaeche.md`), die
hier ausdrücklich benannt gehört, weil sie eine neue Art von
Datenabfluss einführt, die diese Fallstudie sonst gerade vermeidet.

**Der Unterschied zu `supabase-js` ist wichtig.** `supabase-js` liefert
einmalig JavaScript-Code aus — der Browser lädt ihn, führt ihn aus, und
danach spricht er nur noch mit `supabase.butscher.cloud`, demselben
Server, den diese Anwendung ohnehin kontaktiert. Eine Kartenkachel ist
etwas anderes: **jeder Kartenblick** löst laufende, neue HTTP-Anfragen an
`tile.openstreetmap.org` aus, einen Server, der mit dieser Fallstudie
sonst nichts zu tun hat. Jede dieser Anfragen trägt zwangsläufig die
IP-Adresse des anfragenden Rechners und den genauen Kartenausschnitt
(Koordinaten, Zoomstufe) — das ist, wie HTTP funktioniert, nicht
vermeidbar, sobald man Kartenkacheln überhaupt lädt.

**Das ist eine Abwägung, keine Nachlässigkeit.** Die Alternative — eine
selbst gezeichnete, schematische Karte ohne echte Straßen, wie die erste
Fassung dieser Oberfläche sie hatte — beantwortete die Frage nicht, für
die eine Landkarte überhaupt gebraucht wird: „wo liegt diese Station,
wer ist in der Nähe." Der Auftraggeber hat das wörtlich so benannt (siehe
Kopfkommentar der Karte in `wawi/stationen.js`) und recht behalten. Eine
Fallstudie, die Datensparsamkeit lehren will, muss deshalb auch die
Kehrseite lehren dürfen: manche Funktion lohnt sich trotz einer echten,
messbaren Fremdanfrage — solange die Anfrage benannt, ihr Umfang
begrenzt und ihr Nutzen den Umständen angemessen ist. Für eine Handvoll
Mitarbeitende, die eine Karte gelegentlich öffnen, ist das der Fall;
für eine öffentliche, stark frequentierte Anwendung wäre dieselbe
Abwägung möglicherweise anders ausgefallen (siehe die Nutzungsbedingungen
unter `operations.osmfoundation.org/policies/tiles/`, die genau
deswegen zwischen „leichter Nutzung" und Massenbetrieb unterscheiden).

**Was die Fremdanfrage NICHT preisgibt:** Sie transportiert ausschließlich
den sichtbaren Kartenausschnitt — keine Stations- oder Kundendaten. Der
Schalter „Kundschaft anzeigen" auf der Karte sendet dabei überhaupt
nichts an den Kachelserver; er entscheidet nur, welche bereits geladenen,
längst aggregierten Marken (siehe unten) auf der ohnehin schon
angeforderten Karte zusätzlich eingeblendet werden.

**Die Kundschaft bleibt dabei aggregiert, nicht individuell — dieselbe
Regel wie überall sonst in diesem Dokument.** Die Karte zeigt niemals
einzelne Kundenadressen als Punkte; sie zeigt `v_wawi_kundenorte`, eine
je Ort **gezählte** Kundschaft (`ort`, `latitude`, `longitude`, `kunden`)
aus `velocity.ort_koordinate` (siehe deren Kopfkommentar in
`db/aufbau/0018_wawi_sichten.sql`). Ein Punkt je Wohnadresse wäre exakt
das Bewegungs-/Wohnprofil, das der Abschnitt „Was ein Mitarbeiter nicht
sieht" oben für Fahrten bereits ausschließt — dieselbe Zurückhaltung gilt
hier für Wohnorte.

## Die Auskunft nach Art. 15 DSGVO — die gewollte Ausnahme

Oben steht: keine einzelnen Fahrten. Der Knopf „Auskunft nach Art. 15“
in der Kundenmaske zeigt sie trotzdem — mit Start, Ziel, Zeitstempel und
Koordinaten. Das ist kein Versehen, und es lohnt sich, den Widerspruch
nicht wegzuerklären, sondern anzusehen.

`api_kunde_auskunft` liefert acht Abschnitte: `stammdaten`,
`mitgliedschaften`, `fahrten`, `rechnungen`, `zahlungen`,
`schadensmeldungen`, `freiminuten`, `protokoll`. Art. 15 verlangt
Vollständigkeit — die betroffene Person hat ein Recht darauf zu
erfahren, was über sie gespeichert ist, und das Bewegungsprofil ist der
Teil, der sie am meisten angeht. Ein Profil, das man vor ihr selbst
verbirgt, wäre kein Datenschutz.

Damit stehen zwei Grundsätze desselben Gesetzes gegeneinander:

| Grundsatz | Verlangt |
|---|---|
| Art. 5 Abs. 1 lit. c — Datenminimierung | so wenig wie möglich |
| Art. 15 — Auskunftsrecht | vollständig |

**Auflösen lässt sich das nicht durch Wegnehmen, sondern nur durch
Begrenzen des Anlasses.** Die Fahrten erscheinen ausschließlich in der
Auskunft, nie in einer Arbeitsmaske, nie in einer Liste, nie in einer
Auswertung. Und jeder Aufruf schreibt nach GR19 einen Eintrag ins
Änderungsprotokoll: wer Daten einsieht, ist danach benennbar. Deshalb
steht der Hinweis darauf in der Maske **über** dem Knopf und nicht
darunter — wer klickt, soll vorher wissen, dass er eine Spur
hinterlässt.

Eine Ausnahme gilt auch hier nicht: `zahlungsmittel` fehlt in der
Auskunft. GR17 kennt keine, weil Bezahldaten Dritte betreffen — die
Bank, den Zahlungsdienstleister — und nicht nur die Person, die fragt.

Für die Lehre ist gerade dieser Widerspruch der Ertrag. Eine Regel, die
keine Ausnahme kennt, ist meistens eine, die noch niemand ernsthaft
angewandt hat.

## Der Weg der Löschung nach Art. 17 DSGVO

Der Knopf in `wawi/kunden.js` heißt „Löschung nach Art. 17 DSGVO“. Die
Funktion dahinter, `api_kunde_anonymisieren`
(`db/aufbau/0019_wawi_logik.sql`), löscht den Kundensatz nicht — sie
anonymisiert ihn. Das ist kein Etikettenschwindel, sondern die einzige
Lösung für einen echten Konflikt zwischen zwei Pflichten:

- **§ 147 AO** verlangt zehn Jahre Aufbewahrung für Rechnungsbelege.
- **Art. 17 DSGVO** verlangt die Löschung personenbezogener Daten auf
  Antrag der betroffenen Person.

Beides gleichzeitig zu erfüllen, ginge nicht, wenn eine Rechnung an die
Person gebunden bliebe, die sie ausgestellt hat — löscht man den Kunden,
verstößt man gegen das Steuerrecht; löscht man nichts, gegen die DSGVO.
**Art. 17 Abs. 3 lit. b DSGVO** löst genau diesen Konflikt auf: die
Löschpflicht entfällt, soweit eine gesetzliche Aufbewahrungspflicht
entgegensteht. Anonymisieren erfüllt beide Pflichten zugleich — die
Rechnung bleibt vollständig und in voller Höhe bestehen, aber sie zeigt
auf niemanden mehr, den man identifizieren könnte.

`api_kunde_anonymisieren` tut deshalb genau dies:

- **Was verschwindet:** Vorname, Nachname, E-Mail (ersetzt durch
  `anonym-<id>@velocity.invalid`, eine laut RFC 2606 dauerhaft
  unauflösbare Domain), Telefonnummer, Geburtsdatum, Anschrift,
  Zahlungsmittel und die Verknüpfung zum Anmeldekonto (`auth_uid`). Auch
  im Änderungsprotokoll werden die alten Werte durch `[anonymisiert]`
  ersetzt — sonst hinterließe ausgerechnet die Löschung eine Kopie der
  Daten, die sie beseitigen soll.
- **Was bleibt:** die Fahrten und alle Rechnungen, unverändert und in
  voller Höhe — § 147 AO verlangt genau das.
- **Was das nicht leistet, ausdrücklich:** Die Fahrten selbst tragen
  weiterhin Start- und Endzeit und, bei frei abgestellten Rädern,
  Koordinaten auf sechs Nachkommastellen. Wer werktags stets um 07:40 vom
  selben Punkt losfährt, bleibt darüber wiedererkennbar, auch ganz ohne
  Namen — eine vollständige Anonymisierung müsste Orte vergröbern und
  Zeiten runden, und das tut diese Funktion nicht. Ebenso wenig durchsucht
  sie Freitextfelder (`schadensmeldung.beschreibung`,
  `rechnungsposition.beschreibung`), in denen ein Name stehen könnte,
  den niemand dort vermutet hätte.

Der Bestätigungsdialog in `wawi/kunden.js` sagt genau das — in dieser
Reihenfolge: was verschwindet, was bleibt und warum, was der Vorgang
**nicht** leistet, und dass er nicht rückgängig zu machen ist. Wer hier
klickt, muss zuerst das Wort „LOESCHEN“ eintippen; ein bloßer Klick
reicht für diesen einen Vorgang nicht.

**Der eigentliche Lehrpunkt** liegt im Änderungsprotokoll. Die
`UPDATE`-Anweisung, die die Kundendaten anonymisiert, löst denselben
Protokolltrigger aus wie jede andere Änderung — im Protokoll stünde also
zunächst zeilenweise, **was** gelöscht wurde (`vorname: Petra →
Geloescht`, `email: petra@example.org → anonym-4711@velocity.invalid`,
…). Damit hätte die Löschung ihre eigene Kopie erzeugt. Gelöst wird das
nicht durch Löschen der Protokollzeilen — dann verschwände auch die Spur,
**wer** wann etwas geändert hat, und Art. 5 Abs. 2 DSGVO
(Rechenschaftspflicht) verlangt genau diese Spur. Gelöst wird es, indem
die **Werte** in denselben Protokollzeilen unkenntlich gemacht werden,
während die Zeilen selbst stehen bleiben: das Protokoll sagt danach „an
diesem Tag hat dieser Mitarbeiter diese sechs Felder geändert“, aber
nicht mehr, wie die Person hieß.

Dass ausgerechnet diese eine Funktion das Änderungsprotokoll überschreiben
darf, obwohl auf `aenderungsprotokoll` sonst `using (false)` für jedes
`UPDATE` liegt, ist kein Widerspruch: `api_kunde_anonymisieren` läuft als
`security definer` mit Rechten, die RLS umgehen. Genau eine Funktion im
gesamten Schema darf das Protokoll anfassen — und es ist die, die Art. 17
umsetzt.

## Was auch das nicht leistet

Ein Sicherheitskonzept, das mehr behauptet, als es hält, ist gefährlicher
als eine bekannte Lücke (siehe [07](07-sicherheitskonzept.md)). Deshalb
ausdrücklich: das Altschema `cityBikesRental` liegt unverändert auf
derselben Datenbank und hält für über tausend übernommene Kunden Vorname,
Nachname und E-Mail im Klartext. `db/betrieb/altschema_absichern.sql`
sperrt dort die **Rechte**, nicht die **Daten**. Für einen übernommenen
Kunden ist ein Antrag nach Art. 17 erst erfüllt, wenn zusätzlich zur
Anonymisierung in `velocity.kunde` auch das Altschema geräumt ist.

## Nachweis statt Behauptung

Wie beim Sicherheitskonzept der Website gilt: eine Beschreibung ist
wertlos, solange sie nicht geprüft ist.

| Ebene | Werkzeug |
|---|---|
| In der Datenbank | `db/tests/t0017_wawi_sicherheit.sql`, `t0018_wawi_sichten.sql` — Rollentrennung, `null` bei fehlender Rolle, kein Bewegungsprofil |
| Vertrag HTML/JavaScript | `tools/wawi_check.py` — jede Zustandsschale wird geschaltet, keine Namensraum-Kollision zwischen den neun Skripten, die Vorgangs-Kennung wird nirgends vergessen |
| Über die REST-Schnittstelle | `tools/abnahme.sh`, Prüfungen 21/22/29 — Basistabellen gesperrt, Sichten ohne Anmeldung unerreichbar, nur `v_wawi_*`/`api_*` im Quelltext |
| Im Betrieb | Prüfung 30 — `wawi.butscher.cloud` liefert die Anmeldeseite; Prüfung 31 — ein Kunde ohne Mitarbeiterkonto wird abgewiesen |
