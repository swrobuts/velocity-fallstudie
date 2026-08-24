# VeloCity – dritter UX/UI- und End-to-End-Regressionstest

**Geprüfter Prototyp:** `http://localhost:8765/`  
**Prüfdatum:** 24. August 2026  
**Schwerpunkt:** Registrierung mit der vorgegebenen E-Mail-Adresse, Anmeldung, Ausleihstart, laufende Fahrt, Rückgabe, Abrechnung sowie Regression der zuletzt offenen UX-/UI-Befunde

## Kurzurteil

Die neue Fassung hat technisch und gestalterisch erneut Fortschritte gemacht. Der zuvor blockierte Ausleihstart funktioniert jetzt, der Tarifrechner validiert korrekt, die Kartenansichten unterscheiden sich tatsächlich und die mobile Stationsauswahl ist wesentlich zuverlässiger.

Es bestehen jedoch zwei schwere fachliche Stopper:

1. **Die vorgegebene E-Mail-Adresse kann nicht registriert werden**, weil ein alter Auth-Trigger beim Anlegen eines Supabase-Benutzers nochmals einen bereits vorhandenen Altkunden mit derselben E-Mail anlegen will.
2. **Die Rückgabe wird ohne Ortswahl automatisch an der ersten Station der Datenliste verbucht.** Die Testfahrt startete am Würzburger Marktplatz und wurde nach einem Klick auf „Ausleihe beenden“ in der Datenbank am „Schweinfurt Markt“ beendet.

Damit ist die Website noch nicht fachlich abnahmefähig. Der Happy Path läuft zwar inzwischen durch, erzeugt aber bei der Rückgabe falsche Bestands- und Bewegungsdaten.

## Verwendete Registrierungsdaten

- E-Mail: `swrobuts@googlemail.com`
- sichtbarer Benutzername/Vorname: `Robert`
- Nachname im Pflichtfeld: `Test`
- Das vorgegebene Kennwort wurde verwendet, wird aber aus Sicherheitsgründen nicht im Bericht wiederholt.

**Es wurde kein neues Auth-Konto für diese E-Mail angelegt.** Die Registrierung wurde vollständig zurückgerollt.

## Wichtigste Ergebnisse

| Bereich | Ergebnis |
|---|---|
| Registrierung mit vorgegebener E-Mail | **Fehlgeschlagen** – `Database error saving new user` |
| Anmeldung mit den vorgegebenen Daten | **Nicht möglich** – kein Auth-Benutzer entstanden |
| Ausleihstart mit vorhandenem Testkonto | **Funktioniert** |
| Laufender Fahrtbanner und Timer | **Funktionieren**, Produktbezeichnung zunächst zu generisch |
| Ausleihe beenden | **Technisch erfolgreich, fachlich falsch verbucht** |
| Preisberechnung/Entgeltpositionen | **Konsistent** – 0,20 € für eine City-Fahrt von einer Minute |
| Kartenansichten Würzburg/Gesamtnetz | **Behoben** |
| Mobile Stationsauswahl und Popup | **Deutlich verbessert** |
| Tarifrechner-Grenzwerte | **Behoben** |
| Breakpoint 900/901 px | **Behoben** |
| Login direkt nach Logout | **Weiterhin nicht zuverlässig** |
| Passwort-Recovery | JS-Handler behoben, Mailversand weiterhin nicht erfolgreich |

## P0 – fachliche Stopper

### P0-01: Rückgabe wird ohne Benutzerentscheidung an einer falschen Station verbucht

**Reproduktion**

1. Mit einem vorhandenen Testkonto anmelden.
2. Am Marktplatz ein City-Bike ausleihen.
3. Rund eine Minute warten.
4. Im permanenten Fahrtbanner „Ausleihe beenden“ wählen.

**Beobachtung in der Oberfläche**

- Die Ausleihe startet korrekt; der Timer läuft.
- „Ausleihe beenden“ beendet die Fahrt sofort.
- Es gibt keine Auswahl oder Bestätigung des Rückgabeortes.
- Die Anwendung ermittelt keine reale Position und fragt keine Station ab.

**Beobachtung in den Daten**

- `ausleihe_id`: **1628**
- Fahrrad: **CB-00017**, `fahrrad_id` **292**
- Start: **Marktplatz**, Station 30
- Ende: **Schweinfurt Markt**, Station 29
- Dauer: **1 Minute**
- Status: **abgeschlossen**

Der Quellcode bestätigt die Ursache unmittelbar:

```js
// Station auswaehlen (vorerst erste Station)
const endStation = db_Stations[0];
```

Die erste Station der geladenen Liste ist „Schweinfurt Markt“. Deshalb wird eine Fahrt aus Würzburg ohne räumlichen Zusammenhang dorthin zurückgegeben.

**Auswirkung**

- falsche Stationsbestände und falsche Fahrradposition
- unmögliche Bewegungsdaten innerhalb weniger Sekunden
- potenziell falsche Verfügbarkeit für alle Kunden
- unzuverlässige Analysen, Auslastungswerte und Disposition
- keine Übereinstimmung zwischen realer Handlung und Systemzustand

**Empfehlung**

Die Rückgabe benötigt einen expliziten fachlichen Flow:

1. Standort ermitteln oder Station auf der Karte auswählen.
2. Rückgabeart zeigen: „An Station“ oder „frei im Geschäftsgebiet“.
3. Geschäftsgebiet und Distanz plausibilisieren.
4. Station/Position vor dem Abschluss verständlich bestätigen.
5. Erst danach `api_ausleihe_beenden` aufrufen.

**Abnahmekriterium**

Eine Fahrt kann ausschließlich an der vom Kunden gewählten beziehungsweise technisch eindeutig ermittelten Station oder an der bestätigten GPS-Position beendet werden. Eine stillschweigende Defaultstation ist ausgeschlossen.

### P0-02: Registrierung kollidiert mit veralteter Auth-/Altdatenlogik

**Reproduktion**

1. „Login“ → „Registrieren“ öffnen.
2. Robert, Pflichtnachname, `swrobuts@googlemail.com` und gültiges Kennwort eingeben.
3. „Kostenlos registrieren“ wählen.

**Oberflächenergebnis**

> Das hat gerade nicht geklappt. Bitte versuche es erneut. (Database error saving new user)

Ein Login mit denselben Daten endet anschließend korrekt, aber erwartbar mit „Ungültige E-Mail oder Passwort“, weil kein Auth-Benutzer entstanden ist.

**Datenbefund**

- `auth.users`: kein Datensatz für `swrobuts@googlemail.com`
- `velocity.kunde`: Kunde **2334**, Kundennummer **K-000013**, E-Mail vorhanden, `auth_uid = NULL`
- Legacy-Schema `cityBikesRental.kunde`: Kunde **13** mit derselben E-Mail vorhanden
- Auf `auth.users` ist weiterhin der Trigger `on_auth_user_created` aktiv.
- Der Trigger ruft `cityBikesRental.handle_new_user()` auf.
- Diese Funktion versucht bei jeder Auth-Registrierung einen neuen Legacy-Kunden anzulegen.
- `cityBikesRental.kunde.email` besitzt den Unique Index `kunde_email_key`.

Damit kollidiert der Insert mit dem bereits vorhandenen Altkunden; die gesamte Auth-Transaktion wird zurückgerollt.

Besonders auffällig: Im aktuellen Frontendcode steht bereits, dass `api_kunde_sicherstellen` den früheren Trigger ersetzt. Der alte Trigger ist in der tatsächlich genutzten Datenbank dennoch weiterhin vorhanden.

**Auswirkung**

- Bestandskunden ohne `auth_uid` können kein Onlinekonto beanspruchen.
- Wiederholtes Probieren kann den Fehler nicht lösen.
- Die sichtbare Empfehlung „Bitte versuche es erneut“ führt in eine Sackgasse.
- Altdatenmigration und aktuelles Auth-Modell widersprechen sich.

**Empfehlung**

- Legacy-Trigger nach kontrollierter Prüfung entfernen.
- Für vorhandene Kunden einen expliziten Claim-/Migrationsweg bauen: E-Mail verifizieren, Auth-UID an bestehenden `velocity.kunde` hängen, keine zweite Kundenzeile erzeugen.
- E-Mail-Konflikte fachlich unterscheiden: bestehendes Onlinekonto, migrierbarer Altkunde, wirklich neue Registrierung.
- Migration idempotent und mit eindeutigen Tests absichern.

**Abnahmekriterium**

Ein vorhandener Kunde mit E-Mail, aber ohne `auth_uid`, kann ein Auth-Konto aktivieren, ohne dass ein zweiter Kunde entsteht. Die Auth-Transaktion bleibt erfolgreich und `velocity.kunde.auth_uid` wird genau einmal gesetzt.

## P1 – kritisch

### P1-01: Login-Button funktioniert nach Logout weiterhin nicht zuverlässig

In einem Durchlauf ließ sich der Login direkt nach dem Abmelden wieder öffnen. Nach einer weiteren Sitzung war derselbe Ablauf erneut defekt:

1. anmelden
2. Kontomenü öffnen
3. „Abmelden“ wählen
4. auf den nun sichtbaren „Login“-Button klicken

Der Dialog blieb geschlossen; erst nach einem Reload funktionierte der Button wieder. Der Fehler ist damit zustandsabhängig und weiterhin nicht behoben.

**Abnahmekriterium:** Login → Logout → Login funktioniert ohne Reload über mindestens zehn aufeinanderfolgende Zustandswechsel.

### P1-02: Passwort-Recovery erreicht weiterhin keinen erfolgreichen Endzustand

Der frühere JavaScript-Fehler `passwortZuruecksetzen is not defined` ist behoben. Beim Test mit dem vorhandenen Auditkonto erschien jetzt:

> Die E-Mail zum Zurücksetzen konnte gerade nicht versendet werden. Bitte in ein paar Minuten erneut versuchen.

Das ist verständlicher, behebt aber den Recovery-Stopper nicht. SMTP-/Provider-Konfiguration und der vollständige Linkfluss müssen weiterhin getestet werden.

### P1-03: Rückgabe besitzt keine bewusste Bestätigung und keinen persistenten Abschlussbeleg

Der Fahrtbanner enthält nur „Ausleihe beenden“. Ein Klick löst sofort die endgültige Transaktion aus. Rückgabeort, Fahrrad, erwarteter Betrag und Handlungsauswirkung werden vorher nicht bestätigt. Nach Abschluss verschwindet der Fahrtzustand; ein dauerhafter Beleg oder eine Fahrtzusammenfassung ist nicht direkt erreichbar.

**Empfehlung:** Bestätigung mit Fahrrad, Ort und Rückgabeart; danach persistenter Success State mit Dauer, Betrag, Endort und Link zu Fahrt/Beleg.

## P2 – wichtige UX-/UI-Befunde

| ID | Befund | Auswirkung und Empfehlung |
|---|---|---|
| P2-01 | **Der Fahrtbanner nennt beim direkten Start nur „Fahrrad“.** | Beim Start wird `activeRental` ohne `bikeInfo` und `rahmennummer` erzeugt; die konkrete Bezeichnung erscheint erst nach einem späteren Reload aus der View. Sofort „City-Bike CB-00017“ beziehungsweise den korrekten Typ anzeigen. |
| P2-02 | **Registrierungsfehler mischt gute deutsche Copy mit technischer englischer Rohmeldung.** | `(Database error saving new user)` hilft Kunden nicht. Statt Retry eine passende Route anbieten: „Zu dieser E-Mail existieren bereits Kundendaten. Konto aktivieren.“ |
| P2-03 | **Unsichtbare Hero-Produktauswahl bleibt fokussier- und klickbar.** | Bei `opacity:0` bleiben `visibility:visible`, `pointer-events:auto` und die Buttons aktiv. Inaktive Phasen mit `inert`, `visibility:hidden` oder sauberer Fokussteuerung aus dem Interaktionsbaum nehmen. |

## Erfolgreich behobene Regressionen

### Ausleihstart

Der frühere Fehler `permission denied for table fahrrad_position` trat nicht mehr auf. Die Ausleihe wurde angelegt, der Kartenbestand aktualisiert und der Fahrtbanner mit Timer eingeblendet.

### Tarif und Abrechnung

Für die einminütige City-Fahrt entstanden:

- `STARTGEBUEHR`: 0,10 €
- `ZEITENTGELT`: 0,10 €
- Summe: **0,20 €**

Das entspricht dem aktuellen Datentarif von 0,10 € Start plus 0,10 € pro Minute. Die Entgeltpositionen und `v_meine_ausleihe.gesamtbetrag` stimmen überein.

### Kartenansichten

„Würzburg zeigen“ und „Ganzes Netz“ verändern nun tatsächlich Zoom und Markerpositionen. Schweinfurt liegt in der Würzburg-Ansicht außerhalb des sichtbaren Ausschnitts und wird in der Gesamtansicht einbezogen.

### Mobile Karte

- Bei 390 × 844 erscheinen zunächst 13 Stationsmarker und keine 45 frei abgestellten Einzelräder.
- Der Marktplatz-Marker öffnete per Pointer korrekt „Marktplatz“.
- Filter und Ortsumschalter verdecken den Popupkopf nicht mehr.
- Das Popup ist vollständig lesbar und besitzt kontextuelle Leihbuttons.
- Kein horizontaler Overflow.

### Tarifrechner

Die früher widersprüchlichen Werte sind behoben:

| Eingabe | sichtbares Zahlenfeld | Slider |
|---:|---:|---:|
| 0 | 1 | 1 |
| -5 | 1 | 1 |
| 1441 | 1440 | 1440 |
| 1440 | 1440 | 1440 |
| 30 | 30 | 30 |

### Responsive Breakpoint

- 900 px: Scroll-Story ca. 2610 px
- 901 px: Scroll-Story ca. 2612,5 px

Der frühere Sprung um rund 1350 px bei einem Pixel Breitenunterschied ist behoben.

### Produktauswahl

City-/E-Bike-Buttons besitzen nun ein korrekt wechselndes `aria-pressed`. Der aktive Typ ist damit auch semantisch erkennbar.

### Leerer Kartenfilter

Wenn alle Typen abgewählt werden, lautet die Rückmeldung nun verständlich:

> Kein Fahrradtyp ausgewählt — die Karte zeigt gerade keine Räder.

### Statischer Frontend-Check

`python3 tools/frontend_check.py` meldet:

- 59 IDs im HTML
- 46 vom Skript gesucht
- **0 Befunde**

## Customer Journey nach diesem Test

| Phase | Status | Begründung |
|---|---|---|
| Angebot entdecken | **stark** | Hero, Typdifferenzierung und lokale Positionierung überzeugen. |
| Preis verstehen | **stark** | Rechner und Grenzwerte sind nun konsistent. |
| Rad finden | **gut** | Kartenansichten und Mobile-Popup sind deutlich verbessert. |
| Neukunde registrieren | **blockiert** | Legacy-Trigger verhindert das Aktivieren vorhandener Kundendaten. |
| Anmelden | **funktioniert für bestehende Auth-Konten** | Falsche Credentials werden verständlich behandelt. |
| Passwort wiederherstellen | **blockiert** | Mail kann nicht versendet werden. |
| Ausleihe starten | **funktioniert** | Frühere Berechtigungsprobleme sind behoben. |
| Laufende Fahrt verstehen | **teilweise** | Timer funktioniert; konkrete Radbezeichnung fehlt zunächst. |
| Rückgabe | **fachlich falsch** | Defaultstation statt realer/gewählter Position. |
| Abrechnung | **datenbankseitig korrekt** | Betrag und Entgeltpositionen stimmen; sichtbarer Abschlussbeleg fehlt. |

## Durch den Test entstandene Datenänderung

Der End-to-End-Test hat die reale Testdatenbank wie vorgesehen verändert:

- neue abgeschlossene Ausleihe **1628** für Testkunde **7795**
- Fahrrad **CB-00017** wurde am Marktplatz ausgeliehen
- wegen des beschriebenen Fehlers wurde es anschließend an **Schweinfurt Markt** verbucht
- Gesamtbetrag: **0,20 €**

Diese Testdaten und die falsche Fahrradposition wurden bewusst nicht nachträglich manipuliert, damit der Fehler nachvollziehbar bleibt. Sie sollten nach der Analyse kontrolliert bereinigt werden.

## Priorisierte nächste Schritte

### Sofort

1. Rückgabe-Default `db_Stations[0]` entfernen und Rückgabeort fachlich erfassen.
2. Veralteten `on_auth_user_created`-Trigger aus der produktiv genutzten Datenbankmigration entfernen.
3. Claim-/Migrationsflow für Kunden mit E-Mail, aber ohne `auth_uid`, implementieren.
4. Den durch Testfahrt 1628 entstandenen falschen Standort nach Prüfung bereinigen.

### Danach

1. Login-Eventbinding über wiederholte Auth-State-Wechsel stabilisieren.
2. Passwort-Mailversand end-to-end reparieren.
3. Persistenten Rückgabe-/Belegzustand ergänzen.
4. Produktname und Rahmennummer sofort im Fahrtbanner anzeigen.
5. Unsichtbare Hero-Auswahl aus Fokus und Pointerinteraktion nehmen.

## Abnahmekriterien

- [ ] `swrobuts@googlemail.com` kann als vorhandener Altkunde ein Auth-Konto aktivieren, ohne Duplikat und ohne Datenverlust.
- [ ] Nach der Aktivierung ist genau ein `velocity.kunde` mit gesetzter `auth_uid` vorhanden.
- [ ] Auf `auth.users` wirkt kein veralteter Trigger in das Legacy-Schema.
- [ ] Rückgabe fragt Station oder GPS-Position explizit ab.
- [ ] Eine in Würzburg beendete Fahrt kann nicht ohne reale Ortsinformation in Schweinfurt landen.
- [ ] Bestände von Start- und Endstation sowie Fahrradposition bleiben konsistent.
- [ ] Rückgabe zeigt Fahrrad, Dauer, Ort und Betrag persistent an.
- [ ] Login → Logout → Login funktioniert beliebig oft ohne Reload.
- [ ] Passwort-Recovery versendet eine Testmail und der Link funktioniert.
- [ ] Fahrtbanner nennt sofort Typ und Rahmennummer.
- [ ] Tarifrechner, Kartenansichten, Mobile-Popup und Breakpoint-Fixes bleiben erhalten.

## Schlussfazit

Die Oberfläche nähert sich einem professionellen Produkt. Die jetzt sichtbaren Probleme sind weniger gestalterisch als fachlich-architektonisch: Altdatenmigration, Auth-Lifecycle und Rückgabeort müssen dasselbe Domänenmodell verwenden. Sobald diese beiden Stopper behoben sind, lässt sich erstmals eine wirklich glaubwürdige Customer Journey vom Bestandskunden bis zur korrekten Rückgabe demonstrieren.
