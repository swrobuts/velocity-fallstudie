# Foliendeck — Datenbankentwurf am Fallbeispiel VeloCity

39 Folien im THWS-Design. Gebaut aus dem Vorlagendeck 
`BINT_E4_Datenmodellierung_WS2627_v3.pptx`, das Thema, Layouts und Fußmasken liefert.

## Neu erzeugen

Das Deck wird **nicht von Hand bearbeitet**, sondern erzeugt. Wer eine Folie ändern
will, ändert `build_deck.py` und baut neu — sonst geht die Änderung beim nächsten
Lauf verloren.

```bash
python3 slides/build_deck.py                                  # PPTX erzeugen
python3 slides/check_deck.py slides/velocity-datenbankentwurf.pptx   # Layout prüfen
```

`check_deck.py` prüft, was sich ohne Rendern feststellen lässt: Formen außerhalb der
Inhaltszone (y = 176 bis 494), Schrift unter 13 pt, überlappende Inhaltsformen,
geschätzte Textüberläufe und fehlende Vortragsnotizen. Der Lauf muss
`0 Befund(e)` melden.

## PDF-Export

Das PowerPoint-MCP meldet auf diesem Rechner Erfolg, ohne eine Datei zu schreiben.
Der zuverlässige Weg führt über AppleScript, und zwar aus einem Pfad **außerhalb**
von OneDrive — dort bleibt PowerPoint beim Öffnen hängen:

```bash
cp slides/velocity-datenbankentwurf.pptx /tmp/ && osascript -e 'tell application "Microsoft PowerPoint"' -e 'open POSIX file "/tmp/velocity-datenbankentwurf.pptx"' -e 'delay 3' -e 'save active presentation in ((POSIX file "/Users/robert/Documents/deck.pdf") as string) as save as PDF' -e 'close active presentation saving no' -e 'end tell'
```

## Bausteine

`thws.py` enthält die Motive des Skills `/bint-folie`: Kachelreihe, Regel-Streifen,
Prozesskette, Schichtenstapel, Ampel-Matrix, Code-Kacheln, Tabellen-Redesign,
Sandkarte und Sandband. Höhen von Sandkarte und Sandband werden aus der Textlänge
abgeleitet, damit kein Merksatz abgeschnitten wird.

## Gliederung

| # | Layout | Block | Titel |
|---|---|---|---|
| 1 | Frontpage_Digital |  | Datenbankentwurf am Fallbeispiel VeloCity |
| 2 | Slide | Orientierung | Was Sie nach dieser Einheit können |
| 3 | Slide | Orientierung | Der Entwurfszyklus gibt die Gliederung vor |
| 4 | Chapter |  | 1 · Die Fallstudie |
| 5 | Slide | 1 · Die Fallstudie | VeloCity vermietet Räder minutengenau |
| 6 | Slide | 1 · Die Fallstudie | Zehn Geschäftsregeln, die das Modell tragen müssen |
| 7 | Slide | 1 · Die Fallstudie | Die übrigen fünf Regeln und wo sie greifen |
| 8 | Chapter |  | 2 · Konzeptioneller Entwurf |
| 9 | Slide | 2 · Konzeptioneller Entwurf | Ein ERM ist eine Behauptung über die Wirklichkeit |
| 10 | Slide | 2 · Konzeptioneller Entwurf | Zehn Fachbereiche, davon sechs jetzt umgesetzt |
| 11 | Slide | 2 · Konzeptioneller Entwurf | Vier Entscheidungen, die den Unterschied machen |
| 12 | Slide | 2 · Konzeptioneller Entwurf | Vier weitere Entscheidungen mit Begründung |
| 13 | Chapter |  | 3 · Normalisierung |
| 14 | Slide | 3 · Normalisierung | Die Ausgangstabelle: alles in einer Relation |
| 15 | Slide | 3 · Normalisierung | Erste und zweite Normalform am Beispiel |
| 16 | Slide | 3 · Normalisierung | Dritte Normalform — und warum sie hier nicht genügt |
| 17 | Slide | 3 · Normalisierung | Exkurs: aus der Postleitzahl folgt nicht der Ort |
| 18 | Chapter |  | 4 · Logischer Entwurf |
| 19 | Slide | 4 · Logischer Entwurf | Die Abbildung folgt festen Regeln |
| 20 | Slide | 4 · Logischer Entwurf | Jede Relation trägt zwei Schlüssel |
| 21 | Chapter |  | 5 · Physischer Entwurf |
| 22 | Slide | 5 · Physischer Entwurf | Datentypen sind fachliche Entscheidungen |
| 23 | Slide | 5 · Physischer Entwurf | ENUM oder Referenztabelle — die Regel dahinter |
| 24 | Slide | 5 · Physischer Entwurf | Sieben von zehn Regeln erzwingt die Datenbank |
| 25 | Slide | 5 · Physischer Entwurf | EXCLUDE verhindert, was UNIQUE nicht kann |
| 26 | Slide | 5 · Physischer Entwurf | Warum das Mindestalter kein CHECK sein darf |
| 27 | Chapter |  | 6 · Implementierung |
| 28 | Slide | 6 · Implementierung | Zwölf Aufbauschritte, jeder für sich lauffähig |
| 29 | Slide | 6 · Implementierung | Die Preisfindung als Folge sichtbarer Positionen |
| 30 | Slide | 6 · Implementierung | Dokumentation, die nicht veralten kann |
| 31 | Chapter |  | 7 · Zugriffsschutz |
| 32 | Slide | 7 · Zugriffsschutz | Der Schlüssel im Browser ist kein Geheimnis |
| 33 | Slide | 7 · Zugriffsschutz | Die Falle, die fast jeder übersieht |
| 34 | Slide | 7 · Zugriffsschutz | Nachweis statt Behauptung — auf drei Wegen |
| 35 | Chapter |  | 8 · Anwendung anbinden |
| 36 | Slide | 8 · Anwendung anbinden | Nur Sichten lesen, nur Funktionen schreiben |
| 37 | Chapter |  | 9 · Zusammenfassung und Ausblick |
| 38 | Slide | 9 · Zusammenfassung | Sechs Sätze, die diese Einheit tragen |
| 39 | Slide | 9 · Ausblick | Was die Warenwirtschaft ergänzt |

## Vortragsnotizen

Jede Folie trägt eine Notiz mit dem Kerngedanken. `check_deck.py` meldet fehlende
Notizen als Befund.

## Bekannte Abweichungen vom Skill

- Der Skill `/bint-folie` setzt das PowerPoint-Plugin voraus (`edit_slide_xml`,
  `verify_slide_visual`, Office.js). Das stand hier nicht zur Verfügung; gebaut
  wurde mit python-pptx, geprüft mit `check_deck.py` und durch Sichtkontrolle des
  PDF.
- Das Zeichen `✗` (U+2717) fehlt der Hausschrift und fällt auf ein Buchstaben-X
  zurück. Verwendet wird `×` (U+00D7), in jeder Latin-Schrift vorhanden.
- Die Inhaltsflucht folgt dem Skill (90,8 pt), nicht dem Vorlagendeck (39 pt).
  Kicker, Titel und Quellenzeile stehen wie dort auf 39 pt.
