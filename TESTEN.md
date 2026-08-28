# Wie du alles testest

## In einem Befehl

```bash
cd ~/Library/CloudStorage/OneDrive-Persönlich/Vorlesungen/"Datenbasierte Fallstudien"/velocity-fallstudie
bash tools/abnahme.sh
```

**31 Prüfungen** (Stand 26.08.2026, siehe „Diese Datei war stale" unten),
jede meldet ✓ oder ✗. Das Skript läuft immer bis zum Ende durch — du
bekommst das vollständige Bild und nicht nur den ersten Fehler.
Rückgabewert 0, wenn alles besteht.

| # | Prüfung | Was sie belegt |
|---|---|---|
| 1 | Zugangsdaten | `.env` ist vollständig |
| 2 | Aufbaukette zweimal | die SQL-Dateien in `db/aufbau/` laufen, gezählt statt eingetragen, und sind idempotent |
| 3 | Datenbanktests | 128 pgTAP-Testfunktionen |
| 4 | Zugriffsschutz | 13 Ressourcen gesperrt, 9 Sichten öffentlich — über HTTP geprüft |
| 5 | Altschema | Der anon-Key kommt nicht mehr an die Altdaten |
| 6 | Abgleichsbericht | Übernahme vollständig, Beträge stimmen auf den Cent |
| 7 | Mermaid-Diagramme | alle Quellen validieren |
| 8 | Kardinalitäten der Diagramme | ERD und Relationenmodell stimmen überein |
| 9 | PDF nicht älter als das Deck | das exportierte PDF ist aktuell |
| 10 | Folieninhalte | Foliendeck gegen die Fachinhalte geprüft |
| 11 | HTML und JavaScript passen zusammen | Vertragsprüfung für `src/` (`tools/frontend_check.py`) |
| 12 | Durchstich | Ausleihe bis Abrechnung, mit echtem COMMIT |
| 13 | Zahlen in Anleitung und Vortrag | gegen die Datenbank nachgerechnet |
| 14 | Freisteller | Radbilder gegen ihre Vorlage |
| 15 | Fingerabdrücke | an allen eingebundenen Dateien der Website |
| 16 | Bedienbarkeit (Website) | Punkte aus dem UX-Audit vom 24.08.2026 (`tools/ux_check.py`) |
| 17 | Website spricht nur Sichten und api-Funktionen | keine Basistabelle, keine `fn_`-Funktion im Frontend |
| 18 | Foliendeck | ohne Layoutbefund |
| 19 | Passwörter unerreichbar | `auth.users` antwortet mit HTTP 406 |
| 20 | Zahlungsmittel gesperrt | HTTP 401 ohne Anmeldung |
| 21 | Warenwirtschaft: Basistabellen | sieben Tabellen antworten mit HTTP 401 |
| 22 | Warenwirtschaft: Sichten ohne Anmeldung | `v_wawi_flotte` antwortet mit HTTP 401 |
| 23 | Rechenannahmen | jede nennt ihre Quelle |
| 24 | Kunde sieht eigene Fahrten | `v_meine_ausleihe`/`v_meine_rechnung`/`v_mein_profil` lesbar |
| 25 | Keine Funktion versehentlich ausführbar | nur `api_`-Funktionen freigegeben, keine für `anon` |
| 26 | Radstatus | stimmt mit offenen Ausleihen überein |
| 27 | Fahruntauglich nicht verfügbar | kein Rad mit offener schwerer Meldung auf „verfügbar" |
| 28 | **Warenwirtschaft: Vertrag HTML/JavaScript** | `tools/wawi_check.py` — Zustandsschalen, Barrierefreiheit, Namensraum, Vorgangs-Kennung |
| 29 | **Warenwirtschaft spricht nur Sichten und api-Funktionen** | keine Basistabelle, keine `fn_`-Funktion in `wawi/` |
| 30 | **`wawi.butscher.cloud` antwortet** | liefert die Anmeldeseite — **bleibt rot bis zur Veröffentlichung**, siehe Hinweis unten |
| 31 | **Warenwirtschaft weist Nicht-Mitarbeitende ab** | der Zustand „kein Mitarbeiter" ist gebaut und wird geschaltet |

> **Prüfung 30 ist zum Stand dieser Aufgabe erwartungsgemäß rot.** Die
> Bereitstellung für `wawi.butscher.cloud` ist gebaut und trocken erprobt
> (`tools/wawi_veroeffentlichen.sh`), die Veröffentlichung selbst steht
> noch aus. Rot heißt hier „noch nicht ausgeliefert", nicht „defekt" —
> nach der Veröffentlichung muss sie ohne Codeänderung grün werden.

## Diese Datei war stale

Diese Anleitung nannte bis zur Gesamtprüfung vom 26.08.2026 vier falsche
Zahlen — nicht Tippfehler, sondern Werte, die beim Schreiben stimmten
und beim Lesen nicht mehr:

| Diese Datei behauptete | Tatsächlich (nachgezählt) | Nachgezählt mit |
|---|---|---|
| „Neun Prüfungen" | 31 Prüfungen | `grep -c '^schritt "' tools/abnahme.sh` |
| „12 SQL-Dateien" | 18 Dateien | `ls db/aufbau/*.sql \| wc -l` |
| „51 pgTAP-Testfunktionen" | 128 Testfunktionen | `python3 db/test.py 2>&1 \| grep -cE '^ok [0-9]+ - velocity_test\.'` |
| „`auth.users` ist leer" | 2 Konten | `select count(*) from auth.users` |

Der Auftrag für diese Aufgabe nannte selbst schon Korrekturzahlen — „27
Prüfungen, 18 SQL-Dateien, 123 pgTAP-Testfunktionen" — und war damit
seinerseits bereits wieder veraltet: fünf Tests und mindestens eine
SQL-Datei waren seither dazugekommen. Die Zahlen oben sind deshalb nicht
aus dem Auftrag übernommen, sondern mit den Befehlen in der dritten
Spalte frisch nachgezählt.

**Warum das mehr als Kosmetik ist:** eine Anleitung mit falscher Zahl
sieht für jemanden, der die Datenbank nicht selbst geöffnet hat, genauso
aus wie eine mit richtiger. Bei den Minutenpreisen (siehe Schritt 1
oben) hat genau das schon einmal dazu geführt, dass eine externe Prüfung
einen **korrekten** Preis für einen Datenfehler hielt, weil die
Anleitung einen älteren Stand nannte. Eine Zahl in einer Testanleitung
ist eine Behauptung über die Gegenwart, kein Protokoll der
Vergangenheit — sie verfällt beim nächsten Commit, der sie nicht
nachzieht.

## Einzeln, wenn etwas rot ist

```bash
python3 db/run.py db/aufbau/*.sql          # Aufbaukette
python3 db/test.py                          # alle Datenbanktests
python3 db/test.py db/tests/t0009_preisfindung.sql   # nur die Preisfindung
python3 tools/rest_security_check.py        # Zugriffsschutz von außen
node tools/mermaid_check.mjs doku/datenmodell/erd/*.mmd
python3 slides/check_deck.py slides/velocity-datenbankentwurf.pptx
python3 tools/frontend_check.py             # Vertrag HTML/JavaScript der Website
python3 tools/ux_check.py                   # Bedienbarkeit der Website
python3 tools/wawi_check.py                 # Vertrag HTML/JavaScript der Warenwirtschaft
```

## Website — was du selbst durchklicken musst

Registrierung, Anmeldung und eine echte Ausleihe kann ich nicht prüfen: dafür
müsste ein Benutzerkonto angelegt und ein Passwort eingegeben werden.

```bash
python3 -m http.server 8765 --directory src
```

> **Vor jedem Durchgang:** `python3 tools/versionieren.py`. Die Seite
> bindet ihre Dateien mit einem Fingerabdruck ein (`script.js?v=…`).
> Ohne den aktuellen Stempel serviert der Browser alte Fassungen — bei
> einer Prüfung von außen führte genau das zu zwei gemeldeten Fehlern,
> die längst behoben waren.

> **Ausleihe und Abrechnung ohne Klicken:** `python3 db/durchstich.py`
> geht den ganzen Weg für alle drei Fahrradtypen gegen die echte
> Datenbank — unter der Rolle `authenticated`, mit echtem COMMIT, und
> räumt danach hinter sich auf.

Dann auf `http://localhost:8765`:

1. **Abgemeldet ansehen.** Kennzahlenleiste zeigt **10 Stationen**
   (alle in Würzburg; Schweinfurt wird seit dem 25.08.2026 nicht mehr
   übernommen), drei Tarifkarten mit
   **3,10 / 8,50 / 17,00 Euro** für 30 Minuten, vier FAQ-Einträge, Karte mit
   Stations- und Fahrradmarkern. Browserkonsole ohne Fehler.

   > Stationszahl und Beträge werden gegen die Datenbank geprüft:
   > `tools/zahlen_gegen_db.py` liest sie aus dieser Datei und hält sie
   > gegen `v_kennzahl` und `v_tarifkarte`. Wer die Preise ändert, ohne
   > diese Anleitung nachzuziehen, bekommt die Abnahme rot. Genau dieser
   > Auseinanderlauf hat eine externe Prüfung einmal zu der Annahme
   > gebracht, der E-Bike-Preis sei ein Datenfehler — er war richtig,
   > die Anleitung war alt. Die Beträge stehen zusätzlich in
   > `db/tests/t0010_sichten.sql`, dort aber als Erwartung an die
   > Preisrechnung, nicht als Abgleich mit diesem Text.
   >
   > Stand 25.08.2026: die Minutenpreise wurden neu gestaffelt (0,10 /
   > 0,25 / 0,50 statt 0,10 / 0,50 / 0,10). Vorher war das Lastenrad für
   > 30 Minuten das günstigste der drei.
2. **Zugriffsschutz in der Konsole prüfen:**
   ```javascript
   await supabaseClient.from('kunde').select('*').limit(1)
   ```
   Erwartung: ein Fehlerobjekt, **keine** Daten.
3. **Registrieren** mit einer beliebigen Adresse. Danach:
   ```bash
   python3 -c "import sys; sys.path.insert(0,'db'); from run import verbinde; c=verbinde(); cur=c.cursor(); cur.execute(\"select kunde_id, kundennummer, email, auth_uid is not null from velocity.kunde order by kunde_id desc limit 3\"); [print(r) for r in cur.fetchall()]"
   ```
   Erwartung: neuer Kunde mit Kundennummer `K-######` und gesetzter `auth_uid`.
4. **Fahrt starten** (Rad auf der Karte wählen), Banner mit laufender Zeit
   prüfen, **Fahrt beenden**. Erwartung: Meldung mit Dauer und Betrag.
5. **Abrechnung ansehen:**
   ```bash
   python3 -c "import sys; sys.path.insert(0,'db'); from run import verbinde; c=verbinde(); cur=c.cursor(); cur.execute('''select ea.code, p.menge, p.einzelbetrag, p.betrag from velocity.ausleihe a join velocity.entgeltposition p on p.ausleihe_id=a.ausleihe_id join velocity.entgeltart ea on ea.entgeltart_id=p.entgeltart_id where a.ausleihe_id=(select max(ausleihe_id) from velocity.ausleihe) order by p.sortierung'''); [print(r) for r in cur.fetchall()]"
   ```
   Erwartung: `STARTGEBUEHR` und `ZEITENTGELT`; die Summe entspricht dem in
   der Oberfläche angezeigten Betrag.

**Hinweis:** Diese Anleitung behauptete hier lange, `auth.users` sei leer.
Das stimmt nicht mehr: `select count(*) from auth.users` liefert **2**
Konten — eines davon `swrobuts@googlemail.com`, zugleich Mitarbeiter
`M-0001` (alle vier Rollen der Warenwirtschaft) und Kunde 2334. Schritt 3
oben legt trotzdem ein WEITERES, eigenes Testkonto an; das vorhandene
Konto bleibt davon unberührt.

## Warenwirtschaft — wie du sie prüfst

Automatisch geprüft wird `wawi/` durch die Prüfungen 21, 22, 28, 29, 30
und 31 in `tools/abnahme.sh` sowie durch `tools/wawi_check.py` allein.
Was bleibt, ist Handarbeit — dieselbe Einschränkung wie bei der Website:
eine echte Anmeldung mit Passworteingabe kann kein Skript ersetzen.

```bash
python3 -m http.server 8766 --directory wawi
```

Dann auf `http://localhost:8766`, angemeldet mit `swrobuts@googlemail.com`
(alle vier Rollen — Disposition, Werkstatt, Kundenservice, Leitung):

1. **Navigation ansehen.** Alle fünf Arbeitsbereiche (Flotte, Stationen,
   Kunden, Instandhaltung, Auswertungen) sind sichtbar — dieses Konto
   trägt jede Rolle. Browserkonsole ohne Fehler.
2. **Formulare zum Anlegen, Umbuchen und Ausmustern ansehen, aber nicht
   abschicken** (Flotte). Eine echte Bestätigung schriebe ein Rad in den
   gemeinsamen Referenzdatenbestand der Lehrveranstaltung, das dort
   nicht hingehört. Wie beim Löschdialog in Punkt 4 reicht
   Escape/Abbrechen, um Feldaufbau und Tastaturbedienung zu prüfen. Dass
   eine Bestätigung sich in der Statuszeile am unteren Rand meldet,
   deckt bereits `tools/wawi_check.py` ab (Vertrag STATUS).
3. **Instandhaltung ansehen.** Die Schadensmeldungen 1038–1044 und die
   Wartungsaufträge 676–678 sind **gewollte Erprobungsdaten** aus dieser
   Aufgabe — kein Datenfehler, wenn sie dort stehen.
4. **Einen Kunden aufrufen, Auskunft nach Art. 15 herunterladen, dann
   NICHT löschen** (Kunden). Der Löschdialog verlangt das Eintippen von
   „LOESCHEN" — Abbrechen reicht, um den Ablauf zu sehen, ohne echte
   Daten zu verändern.
5. **Abmelden, mit einem reinen Kundenkonto ohne Mitarbeiterstatus
   erneut anmelden** (falls eines zur Hand ist). Erwartung: „Kein
   Zugang", kein Arbeitsbereich, kein Fehler in der Konsole — siehe
   Prüfung 31 und `doku/datenmodell/08-warenwirtschaft.md`.

> **Rollenprüfung ohne zweites Konto:** in der Browser-Konsole
> `await hat_rolle_pruefen()` gibt es nicht — stattdessen zeigt
> `document.querySelectorAll('#navigation button')` nach der Anmeldung,
> welche Bereiche die aktuelle Rolle tatsächlich sieht. Ein Bereich, der
> fehlt, ist Absicht (siehe „rollenabhängige Navigation" in
> `doku/datenmodell/08-warenwirtschaft.md`), keine Lücke.

**Anmeldekonto fehlt noch:** es existiert kein eigenes Prüfkonto ohne
Mitarbeiterrolle und keins mit nur einer einzelnen Rolle. Punkt 5 oben
lässt sich deshalb erst durchspielen, sobald die Leitung ein solches
Konto anlegt (`api_kunde_anlegen` legt keinen Mitarbeiter an — das ist
ein anderer Weg, siehe `db/aufbau/0014_bereich_j_personal.sql`). Bis
dahin prüft `db/tests/t0017_wawi_sicherheit.sql`/`t0018_wawi_sichten.sql`
die Rollentrennung gegen echte Fixturen, und die Oberfläche selbst wird
mit Attrappen geprüft (Rollen-Set von Hand gesetzt, keine echte
Anmeldung) — dieselbe Einschränkung wie bei jedem vorherigen Schritt.

**Veröffentlichung:** `wawi.butscher.cloud` ist zum Stand dieser Aufgabe
**noch nicht** ausgeliefert — die Bereitstellung ist gebaut und trocken
erprobt (`tools/wawi_veroeffentlichen.sh`), eine noch laufende Prüfung
steht der Freigabe voran. Prüfung 30 in `tools/abnahme.sh` bleibt deshalb
rot, bis das nachgeholt ist; das ist der erwartete Zustand, keine
Regression.

## Wenn du etwas geändert hast

| Geändert | Danach |
|---|---|
| SQL unter `db/aufbau/` | `python3 db/run.py db/aufbau/*.sql && python3 db/test.py` |
| Ein Diagramm (`.mmd`) | `bash tools/render_diagrams.sh && python3 slides/build_deck.py` |
| Eine Folie | `python3 slides/build_deck.py && python3 slides/check_deck.py slides/velocity-datenbankentwurf.pptx` |
| Etwas an `src/` | Seite neu laden, Konsole prüfen |
| Etwas an `wawi/` | `python3 tools/wawi_check.py`, Seite neu laden, Konsole prüfen |

Das Foliendeck wird **nicht von Hand bearbeitet**: Änderungen gehören in
`slides/build_deck.py`, sonst gehen sie beim nächsten Lauf verloren.
