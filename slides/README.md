# Foliendeck — Datenbankentwurf am Fallbeispiel VeloCity

43 Folien im THWS-Design. Gebaut aus dem Vorlagendeck
`BINT_E4_Datenmodellierung_WS2627_v3.pptx`, das Thema, Layouts und Fußmasken liefert.

## Das didaktische Gerüst

Ein durchgehender Fall trägt das Deck: **Anna fährt 61 Minuten mit einem E-Bike und
zahlt 4,96 Euro.** Die Frage nach diesen 4,96 Euro wird auf Folie 2 gestellt und auf
Folie 32 beantwortet.

- Jedes Kapitel öffnet mit einer **Leitfrage**, die dieser Fall aufwirft.
- Auf Inhaltsfolien stellt ein roter Streifen **„Annas Fahrt“** den Bezug her.
- Wo es trägt, kommt erst der **naive Versuch**, der scheitert, dann die Lösung
  (Motiv `vorher_nachher`).

| Kapitel | Leitfrage |
|---|---|
| 1 Fallstudie | Was muss die Datenbank über Annas Fahrt überhaupt wissen? |
| 2 Konzeptionell | Welche Dinge sind das — und wie hängen sie zusammen? |
| 3 Normalisierung | Warum reicht dafür nicht eine einzige Tabelle? |
| 4 Logisch | Wie wird aus dem Bild ein Satz von Relationen? |
| 5 Physisch | Wie erzwingt die Datenbank, dass Annas Rechnung stimmt? |
| 6 Implementierung | Was kostet die Fahrt genau — und warum? |
| 7 Sicherheit | Wer außer Anna darf ihre Daten sehen? |
| 8 Anbindung | Wie kommt das alles in die Web-Anwendung? |
| 9 Ausblick | Was fehlt, damit Annas Rad auch gewartet wird? |

## Neu erzeugen

Das Deck wird **nicht von Hand bearbeitet**, sondern erzeugt. Wer eine Folie ändern
will, ändert `build_deck.py` und baut neu — sonst geht die Änderung beim nächsten
Lauf verloren. Die Diagramme müssen zuerst gerendert sein.

```bash
bash tools/render_diagrams.sh                                        # PNG aus Mermaid
python3 slides/build_deck.py                                         # PPTX erzeugen
python3 slides/check_deck.py slides/velocity-datenbankentwurf.pptx   # Layout prüfen
```

`check_deck.py` prüft Inhaltszone (y = 176 bis 494), Mindestschriftgröße 13 pt,
überlappende Formen, geschätzte Textüberläufe und fehlende Vortragsnotizen.
Der Lauf muss `0 Befund(e)` melden.

## Diagramme

Siebzehn Mermaid-Quellen unter `doku/datenmodell/erd/`, gerendert nach
`slides/assets/`. Gerendert wird mit `mermaid-cli` und dem lokal installierten
Google Chrome — ein eigener Chromium-Download ist nicht nötig. Das Farbschema steht
in `tools/mermaid-thws.json`.

Auf den sechs Bereichsfolien steht die Anna-Zeile **oben** statt unten und ersetzt die
Einleitung: der Titel trägt die Aussage, die Vertiefung steht in den Notizen — und das
Diagramm bekommt die ganze Fläche. Ohne das ist ein ER-Diagramm im Hörsaal nicht
lesbar.

## PDF-Export

Das PowerPoint-MCP meldet auf diesem Rechner Erfolg, ohne eine Datei zu schreiben.
Der zuverlässige Weg führt über AppleScript, und zwar aus einem Pfad **außerhalb**
von OneDrive — dort bleibt PowerPoint beim Öffnen hängen.

## Gliederung

| # | Layout | Block | Titel |
|---|---|---|---|
| 1 | Frontpage_Digital |  | Datenbankentwurf am Fallbeispiel VeloCity |
| 2 | Slide | Der Fall | Anna fährt 61 Minuten. Das ist alles, was wir wissen. |
| 3 | Slide | Orientierung | Neun Kapitel, neun Fragen an Annas Fahrt |
| 4 | Chapter |  | 1 · Die Fallstudie |
| 5 | Slide | 1 · Die Fallstudie | VeloCity vermietet Räder minutengenau |
| 6 | Slide | 1 · Die Fallstudie | Zehn Geschäftsregeln — jede muss erzwungen werden |
| 7 | Chapter |  | 2 · Konzeptioneller Entwurf |
| 8 | Slide | 2 · Konzeptioneller Entwurf | Substantive werden Entitäten, Verben werden Beziehungen |
| 9 | Slide | 2 · Konzeptioneller Entwurf | Kardinalitäten lesen und prüfen |
| 10 | Slide | 2 · Bereich A | Geschäftspartner: Adresse als eigene Entität |
| 11 | Slide | 2 · Bereich B | Netz und Flotte: Stammdaten und Bewegungsdaten getrennt |
| 12 | Slide | 2 · Bereich C | Tarif und Preis: alles ist zeitabhängig |
| 13 | Slide | 2 · Bereich D | Nutzung: die Ausleihe und ihre Abrechnung |
| 14 | Slide | 2 · Bereich E | Abrechnung: Beleg, Positionen, Zahlung |
| 15 | Slide | 2 · Bereich F | Redaktionsinhalte: warum drei Tabellen und nicht eine |
| 16 | Chapter |  | 3 · Normalisierung |
| 17 | Slide | 3 · Normalisierung | Der naive Versuch: alles in eine Tabelle |
| 18 | Slide | 3 · Normalisierung | 1NF und 2NF: atomar, und alles hängt am ganzen Schlüssel |
| 19 | Slide | 3 · Normalisierung | 3NF — und warum sie hier nicht genügt |
| 20 | Slide | 3 · Normalisierung | Das Ergebnis der Zerlegung |
| 21 | Slide | 3 · Normalisierung | Exkurs: aus der Postleitzahl folgt nicht der Ort |
| 22 | Chapter |  | 4 · Logischer Entwurf |
| 23 | Slide | 4 · Logischer Entwurf | Die Abbildung folgt festen Regeln |
| 24 | Slide | 4 · Logischer Entwurf | Jede Relation trägt zwei Schlüssel |
| 25 | Chapter |  | 5 · Physischer Entwurf |
| 26 | Slide | 5 · Physischer Entwurf | Datentypen sind fachliche Entscheidungen |
| 27 | Slide | 5 · Physischer Entwurf | Sieben von zehn Regeln erzwingt die Datenbank |
| 28 | Slide | 5 · Physischer Entwurf | EXCLUDE verhindert, was UNIQUE nicht kann |
| 29 | Slide | 5 · Physischer Entwurf | Warum das Mindestalter kein CHECK sein darf |
| 30 | Chapter |  | 6 · Implementierung |
| 31 | Slide | 6 · Implementierung | Zwölf Aufbauschritte, jeder für sich lauffähig |
| 32 | Slide | 6 · Implementierung | Annas Rechnung: 4,96 Euro, Zeile für Zeile |
| 33 | Slide | 6 · Implementierung | Dokumentation, die nicht veralten kann |
| 34 | Chapter |  | 7 · Zugriffsschutz |
| 35 | Slide | 7 · Zugriffsschutz | Der Schlüssel im Browser ist kein Geheimnis |
| 36 | Slide | 7 · Zugriffsschutz | Was der Browser erreicht — und was nicht |
| 37 | Slide | 7 · Zugriffsschutz | Die Falle, die fast jeder übersieht |
| 38 | Slide | 7 · Zugriffsschutz | Nachweis statt Behauptung — auf drei Wegen |
| 39 | Chapter |  | 8 · Anwendung anbinden |
| 40 | Slide | 8 · Anwendung anbinden | Nur Sichten lesen, nur Funktionen schreiben |
| 41 | Chapter |  | 9 · Zusammenfassung und Ausblick |
| 42 | Slide | 9 · Zusammenfassung | Sechs Sätze, die diese Einheit tragen |
| 43 | Slide | 9 · Ausblick | Die Warenwirtschaft hängt an denselben Entitäten |

## Bekannte Abweichungen vom Skill

- Der Skill `/bint-folie` setzt das PowerPoint-Plugin voraus (`edit_slide_xml`,
  `verify_slide_visual`, Office.js). Das stand hier nicht zur Verfügung; gebaut wurde
  mit python-pptx, geprüft mit `check_deck.py` und durch Sichtkontrolle des PDF.
- Das Zeichen `✗` (U+2717) fehlt der Hausschrift und fällt auf ein Buchstaben-X zurück.
  Verwendet wird `×` (U+00D7), in jeder Latin-Schrift vorhanden.
- Die Inhaltsflucht folgt dem Skill (90,8 pt), nicht dem Vorlagendeck (39 pt).
  Kicker, Titel und Quellenzeile stehen wie dort auf 39 pt.
