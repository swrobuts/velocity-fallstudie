# VeloCity – UX/UI-Regressionstest der überarbeiteten Website

**Geprüfter Prototyp:** `http://localhost:8765/`  
**Prüfdatum:** 24. August 2026  
**Prüfperspektive:** kritisches Produktdesign, Usability, Barrierearmut und vollständige Customer Journey  
**Prüfart:** reale Browserinteraktion auf Desktop und Mobile, Kontoanlage, Login/Logout, Passwort-Recovery, Tarifrechner, Produktwahl, Kartenfilter, Marker, Popups, Leihversuche, Navigation, Rechtstexte, FAQ und statischer Frontend-Check

## Kurzurteil

Die Überarbeitung ist gestalterisch und konzeptionell ein großer Schritt nach vorn. Die Seite besitzt inzwischen eine eigenständige, moderne Markenwirkung, eine gute responsive Hauptnavigation, klare Produktaussagen und eine wesentlich konsistentere Führung von Tarifkarte zu Live-Karte. Viele schwere Befunde des ersten Audits sind sauber behoben.

**Trotzdem ist der Prototyp derzeit nicht end-to-end abnahmefähig.** Die Kernhandlung des Produkts – ein Rad ausleihen – scheitert reproduzierbar an einem Datenbank-Berechtigungsfehler. Auch die reguläre Kontoanlage scheitert am Mailversand. Der für den Test ersatzweise direkt angelegte Kunde kann sich anmelden, aber keine Ausleihe beginnen. Rückgabe und Abrechnung waren deshalb nicht prüfbar.

| Dimension | Bewertung | Kurzbegründung |
|---|---:|---|
| Markenwirkung und Ästhetik | 9/10 | Eigenständig, urban, hochwertig und deutlich weniger dunkel |
| Informationsarchitektur | 8/10 | Gute Abfolge, klare Einstiege und funktionierende Sprünge |
| Responsive UX | 7/10 | Mobile Navigation und CTA stark verbessert; Karten- und Breakpointprobleme bleiben |
| Barrierearme Bedienbarkeit | 7/10 | Modal, Marker und Live-Status stark verbessert; Hero-Auswahl und Kartenüberlagerungen bleiben |
| Customer-Journey-Kohärenz | 6/10 | Auswahl und Orientierung sind gut; Registrierung und Ausleihstart brechen die Journey |
| Technische Nutzbarkeit | 3/10 | Die zentrale Transaktion lässt sich nicht abschließen |

## Wichtigste Entscheidung

Ein weiteres visuelles Redesign ist aktuell nicht der Engpass. Die höchste Priorität hat jetzt ein stabiler vertikaler Durchstich:

**Konto anlegen → anmelden → Fahrrad auswählen → Ausleihe starten → laufende Fahrt sehen → Rückgabe beenden → Preis/Beleg sehen.**

Erst wenn dieser Weg automatisiert und manuell vollständig durchläuft, ist der Prototyp belastbar vorführbar.

## Testkonto und Testdaten

Die Registrierung wurde zunächst regulär über die Website versucht:

- E-Mail: `codex.velocity.audit.20260824.101500@example.com`
- Vorname/Nachname: `Codex UXAudit`
- Ergebnis: `Error sending confirmation email`; es entstand weder ein Auth-Benutzer noch ein Kunde.

Um die nachgelagerte Journey trotzdem zu prüfen, wurde derselbe eindeutig gekennzeichnete Benutzer anschließend direkt als bestätigter Testbenutzer in der lokalen Testinstanz angelegt. Beim ersten erfolgreichen Login erzeugte die Anwendung den Kunden korrekt:

- `kunde_id`: **7795**
- Kundennummer: **K-011336**
- Status: **aktiv**
- E-Mail: `codex.velocity.audit.20260824.101500@example.com`

Der Testkunde verbleibt in der Testdatenbank. Für ihn existierte nach den Fehlversuchen **keine Ausleihe**. Das Passwort wird in diesem Bericht bewusst nicht dokumentiert.

## Testabdeckung und Einschränkung

Getestet wurden:

- Desktop mit 1280 × 720 sowie Breiten 901, 1024 und 1280 px
- Mobile/Tablet mit 390, 520, 768 und 900 px
- Hero-Scrollstrecke, City-/E-Bike-Wechsel und sichtbare Zustände
- Headernavigation, Mobile-Menü, Ankerziele und Fokusführung
- Tarifkarten, Produktübergabe an die Karte und Tarifrechner von 1 bis 1440 Minuten sowie Fehleingaben
- Karte, Typfilter, Stationsmarker, frei abgestellte Räder, Popups und Ortsumschalter
- Anmeldung, Registrierung, Abmeldung, erneutes Öffnen des Logins und Passwort-Recovery
- zwei konkrete Ausleihversuche: E-Cargo und City-Bike
- FAQ, Footer und alle vier Rechtstextziele
- statischer Projektcheck `python3 tools/frontend_check.py`: **0 Befunde** bei 50 HTML-IDs und 37 vom Skript referenzierten IDs

Nicht bis zum Ende prüfbar waren laufende Fahrt, Rückgabe, Abrechnung und Beleg, weil bereits das Starten einer Ausleihe technisch scheitert.

## Findings

### P0 – Stopper

#### P0-01: Keine Ausleihe lässt sich starten

**Reproduktion**

1. Mit dem Testkunden anmelden.
2. Auf der Karte eine Station öffnen.
3. E-Cargo oder City-Bike auswählen und „Leihen“ betätigen.

**Beobachtung**

- Toast: „Ausleihe wird gestartet...“
- anschließend: `Fehler: permission denied for table fahrrad_position`
- kein Banner für eine laufende Ausleihe
- keine Zeile in `velocity.ausleihe` für den Testkunden
- mit zwei Fahrradtypen reproduzierbar

**Auswirkung**

Die Kernleistung des Produkts ist vollständig blockiert. Damit sind auch Fahrtstatus, Rückgabe, Tarifabschluss und Beleg nicht erreichbar.

**Empfehlung**

RLS-/GRANT-Kette und die Transaktion zum Ausleihstart prüfen. Der clientseitig verwendete Benutzer beziehungsweise die aufgerufene Datenbankfunktion muss die Position des Fahrrads ausschließlich über eine klar abgesicherte Serverfunktion ändern dürfen. Danach einen echten End-to-End-Test bis zur Rückgabe ergänzen.

**Abnahmekriterium**

Ein angemeldeter Kunde kann City-, E- und Cargo-Bike starten; genau eine aktive Ausleihe entsteht, Fahrradstatus und Position werden konsistent aktualisiert, der Fahrtbanner erscheint und die Rückgabe kann vollständig abgeschlossen werden.

### P1 – kritisch

#### P1-01: Reguläre Registrierung scheitert am Bestätigungs-Mailversand

**Reproduktion:** Auth-Dialog öffnen, „Registrieren“ wählen, gültige neue Daten eingeben und absenden.  
**Beobachtung:** Der Dialog bleibt geöffnet und zeigt die englische Meldung `Error sending confirmation email`. In Auth- und Kundentabelle entsteht kein Datensatz.  
**Auswirkung:** Neue Kunden können die Nutzung nicht beginnen. Die Meldung nennt weder Ursache noch nächsten Schritt.  
**Empfehlung:** SMTP/Provider-Konfiguration reparieren; technische Fehler in kundenverständliche deutsche Zustände übersetzen; Retry und Supportpfad anbieten.  
**Abnahmekriterium:** Die Kontoanlage endet entweder mit „Bestätigungs-E-Mail wurde versendet“ oder mit einer lokalisierten, handlungsorientierten Fehlermeldung. Die Zustände werden automatisiert gegen ein Testpostfach geprüft.

#### P1-02: Passwort-Recovery ist durch einen JavaScript-Fehler funktionslos

**Reproduktion:** Login öffnen, E-Mail eingeben und „Neues Passwort anfordern“ wählen.  
**Beobachtung:** Inline-Fehler `passwortZuruecksetzen is not defined`; keine Mail und kein sinnvoller nächster Schritt.  
**Auswirkung:** Kunden mit vergessenem Passwort sind dauerhaft ausgesperrt.  
**Empfehlung:** Handler korrekt verdrahten, Erfolg und Rate-Limit neutral formulieren und den kompletten Reset-Link testen.  
**Abnahmekriterium:** Für bekannte und unbekannte Adressen erscheint derselbe datenschutzfreundliche Erfolgszustand; der Link aus der Testmail führt zu einem funktionierenden Passwortwechsel.

#### P1-03: Nach dem Logout ist der neue Login-Button bis zum Reload wirkungslos

**Reproduktion:** Anmelden → im Header auf „Codex“ klicken → nach Erfolgstoast auf den nun sichtbaren Button „Login“ klicken.  
**Beobachtung:** Der Dialog öffnet sich nicht. Nach Neuladen der Seite funktioniert derselbe Button wieder.  
**Auswirkung:** Ein gerade abgemeldeter Kunde kann sich nicht erneut anmelden und interpretiert die primäre Aktion als defekt.  
**Zusatzproblem:** Der Button zeigt nur den Vornamen. Dass ein Klick sofort abmeldet, ist weder sichtbar noch zugänglich angekündigt; versehentliche Abmeldung ist wahrscheinlich.  
**Empfehlung:** Eventbindung nach Auth-State-Wechsel erhalten; Kontomenü mit expliziten Einträgen „Konto“ und „Abmelden“ statt Sofort-Logout verwenden.  
**Abnahmekriterium:** Login → Logout → Login funktioniert ohne Reload beliebig oft; der Abmeldevorgang ist eindeutig beschriftet und nicht überraschend.

#### P1-04: Mobile Karten-Popups werden überlagert und Marker sind per Pointer nicht zuverlässig auswählbar

**Reproduktion:** Bei 390 px zur Karte gehen und im dichten Würzburger Stationscluster auf „Marktplatz“ tippen.  
**Beobachtung:** Ein Pointer-Klick auf den sichtbaren Marktplatz-Marker öffnete reproduzierbar „Dom“; per Tastatur/Enter öffnete derselbe benannte Marker korrekt „Marktplatz“. Zudem liegen Filterpanel und Ortsumschalter oberhalb des Popups und verdecken dessen Kopf mit Stationsname und Adresse.  
**Auswirkung:** Mobile Nutzer können nicht sicher erkennen, welche Station sie ausgewählt haben, und verlieren genau vor der Leihentscheidung entscheidenden Kontext.  
**Empfehlung:** Stationen bei engem Zoom clustern oder auffächern; Popup über Controls platzieren beziehungsweise Controls beim Popup ausblenden; alternativ eine synchronisierte Stationsliste verwenden.  
**Abnahmekriterium:** Jeder sichtbare Marker öffnet per Touch zuverlässig seine eigene Station; der gesamte Popupkopf bleibt bei 390 px ohne Überdeckung lesbar.

### P2 – wichtig

| ID | Befund | Evidenz und Auswirkung | Empfehlung / Abnahmekriterium |
|---|---|---|---|
| P2-01 | **„Würzburg zeigen“ und „Ganzes Netz“ ändern nur den Buttonzustand.** | Kartenextent und Markerpositionen waren in beiden Zuständen identisch; selbst in „Würzburg“ blieb Schweinfurt sichtbar. Die Kontrolle verspricht eine Funktion, die nicht stattfindet. | `fitBounds` beziehungsweise definierte Center-/Zoomwerte implementieren. Die Ansichten müssen visuell klar unterschiedliche Gebiete zeigen. |
| P2-02 | **Tarifrechner zeigt ungültige Eingaben, rechnet aber mit einem anderen Wert.** | `0` und `-5` bleiben im Zahlenfeld, Preis und Slider verwenden 1 Minute. Bei `1441` bleibt 1441 sichtbar, intern fällt die Berechnung ebenfalls auf 1 Minute zurück. | Inline validieren oder sichtbar auf 1/1440 begrenzen; niemals still mit einem anderen Wert rechnen. |
| P2-03 | **Unsichtbare Hero-Produktauswahl bleibt fokussierbar.** | Vor der visuellen Einblendung besitzt das Panel `opacity:0`, bleibt aber sichtbar im Accessibility Tree, pointer-aktiv und über die Tastatur erreichbar. | In inaktiven Phasen `visibility:hidden`, `inert` oder passende Fokussteuerung verwenden. Sichtbarkeit und Interaktivität müssen synchron sein. |
| P2-04 | **Der aktive Produkttyp ist semantisch nicht erkennbar.** | City-/E-Bike-Buttons wechseln visuell korrekt, besitzen aber weder `aria-pressed` noch ein vollständiges Tab-Pattern. | Als Toggle-Buttons mit `aria-pressed` modellieren oder korrektes Tablist-/Tab-Pattern vollständig umsetzen. |
| P2-05 | **Ein Ein-Pixel-Breakpoint erzeugt einen massiven Sprung.** | Bei 900 px ist die Story ca. 1890 px hoch, bei 901 px ca. 3240 px: +1350 px beziehungsweise rund 71 % durch einen Pixel Breitenänderung. | Kontinuierliche `clamp()`-/Viewport-Logik oder einen bewusst gewählten Tablet-Breakpoint einsetzen; 900/901 muss vergleichbar lange bleiben. |
| P2-06 | **Stationsmarker bleiben auf Mobile zu dicht.** | Freie Einzelräder werden vorbildlich erst beim Hineinzoomen gezeigt, aber 13 Stationsmarker überlagern sich im Zentrum weiterhin. Das ist die Ursache der falschen Pointerauswahl. | Clustering, Spiderfy oder priorisierte Listenansicht einsetzen. |
| P2-07 | **Filterzustand ohne Typ besitzt keinen hilfreichen Empty State.** | Status: „0 Räder sichtbar an 0 Stationen, gefiltert nach kein Fahrradtyp.“ Grammatikalisch schwach; die Karte erklärt nicht, wie weiterzumachen ist. | Mindestens einen Typ aktiv lassen oder „Wähle mindestens einen Fahrradtyp“ mit Wiederherstellungsaktion anzeigen. |

### P3 – Feinschliff

| ID | Befund | Empfehlung |
|---|---|---|
| P3-01 | Cargo-CTA bricht in der Tarifübersicht auf zwei Zeilen, während die anderen Typen einzeilig bleiben. | Einheitliche Kartenhöhe und Buttonzeilen definieren oder die Bezeichnung kürzen. |
| P3-02 | Tarifkarten sind visuell hochwertig, unterscheiden die Fahrradtypen aber nur typografisch. | Kleine konsistente Silhouetten der realen drei Radtypen einsetzen; keine generischen Icons. |
| P3-03 | „293 Bikes live“ mischt Englisch mit der sonst deutschsprachigen Kundenoberfläche. | „293 Räder im Netz“ beziehungsweise den exakt gemeinten Live-Wert verwenden. |
| P3-04 | Der Sprunglink ist vorhanden, sein Ziel `#facts-title` besitzt jedoch keinen expliziten Fokusanker. | Zielüberschrift programmatisch fokussierbar machen und nach Aktivierung Fokus sowie Scrollposition testen. |

## Regression gegenüber dem ersten Audit

| Früherer Befund | Neuer Status | Kommentar |
|---|---|---|
| Keine Mobile-/Tablet-Navigation | **Behoben** | Menü funktioniert, schließt per Link und Escape und stellt den Fokus sinnvoll wieder her. |
| Tarif-CTA „Fahrt starten“ ohne Kontextübergabe | **Behoben** | Eindeutige typbezogene Beschriftung, korrekter Filter, Kartenfokus und Live-Ansage. |
| Registrierungsversuch ohne sichtbaren Zustand | **Teilweise verbessert, technisch offen** | Fehler wird nun sichtbar, Registrierung scheitert aber weiterhin am Mailversand. |
| E-Bike-Preis 16 € als vermuteter Datenfehler | **Kein Fehler nach aktuellem Soll** | Die aktualisierte Prüfanleitung definiert für 30 Minuten ausdrücklich 3,10 / 16,00 / 5,00 €. |
| Tote Rechtstextlinks | **Behoben** | Impressum, Datenschutz, AGB und Widerruf besitzen reale Inhalte und korrekte Anker. |
| Auth-Dialog ohne Modal- und Fokusverhalten | **Weitgehend behoben** | Dialogrolle, Benennung, Initialfokus, Escape, Scrollsperre und Fokusrückgabe funktionieren. |
| Kein Passwortkomfort | **Teilweise behoben** | Autocomplete und Anzeigen/Verbergen funktionieren; Recovery ist durch JS-Fehler blockiert. |
| Unbenannte Kartenmarker/englischer Popup-Button | **Behoben** | Marker und Leihbuttons sind kontextuell benannt, Popup-Schließen ist lokalisiert. |
| 45 Einzelräder sofort auf Mobile | **Deutlich verbessert** | Einzelräder erscheinen erst beim Zoom; Stationscluster bleibt jedoch problematisch. |
| Tarifregler nur bis 240 Minuten | **Behoben** | Eingabe und Range besitzen jetzt `max=1440`; Validierung außerhalb des Bereichs bleibt fehlerhaft. |
| Sticky Header verdeckt Sprungziele | **Behoben** | Geprüfter Tarif-CTA positionierte Kartenüberschrift unter dem Header und setzte den Fokus. |
| Mobile Scroll-Story fast 3000 px lang | **Verbessert** | Mobile kürzer und CTA im ersten Viewport; harter Sprung bei 900/901 px bleibt. |
| Würzburg-Kommunikation trotz Schweinfurt | **Behoben** | Header nennt „Würzburg & Schweinfurt · 13 Stationen“. |
| H1 mit zusammengeklebten Wörtern | **Behoben** | Ausgelesener H1 enthält korrekte Wortabstände. |
| Entwicklertext unter Preisen | **Behoben** | Kundennutzen und Transparenz stehen im Vordergrund. |
| Keine Aktualität der Live-Daten | **Behoben** | Freie Räder werden mit „vor X Min.“ ergänzt. |

## Customer Journey: aktueller Zustand

| Phase | Urteil | Beobachtung |
|---|---|---|
| Entdecken | **stark** | Hero, lokale Relevanz, Radtypen und CTA schaffen einen merkfähigen Einstieg. |
| Verstehen | **stark** | Anleitung, Tarife und FAQ sind nachvollziehbar; Mobile Navigation hält Abkürzungen offen. |
| Auswählen | **gut** | Typbezogene Claims und Tarif-CTAs übergeben die Auswahl sauber an die Karte. |
| Preis prüfen | **gut mit Validierungsrisiko** | Rechner und Presets sind hilfreich, aber ungültige Werte beschädigen Preisvertrauen. |
| Rad finden | **gut auf Desktop, eingeschränkt mobil** | Filter, Datenstatus und Popups sind reichhaltig; Cluster, View-Schalter und Überlagerung stören mobil. |
| Konto anlegen | **blockiert** | Bestätigungs-Mail kann nicht versendet werden. |
| Anmelden | **funktioniert** | Richtige und falsche Credentials ergeben verständliche Zustände. |
| Passwort wiederherstellen | **blockiert** | Nicht definierter JavaScript-Handler. |
| Ausleihe starten | **blockiert** | Datenbank verweigert Zugriff auf `fahrrad_position`. |
| Fahrt/Rückgabe/Abrechnung | **nicht prüfbar** | Ohne erfolgreiche Starttransaktion nicht erreichbar. |

## Was jetzt besonders gut funktioniert

- Der Hero wirkt modern, eigenständig und produktbezogen, ohne alberne Inszenierung.
- Die Helligkeit und Weißraumverteilung unterstützen den urbanen Premiumcharakter.
- City- und E-Bike werden in Bild, Claim und Auswahl logisch differenziert.
- Navigation und CTA-Hierarchie funktionieren auf Desktop und Mobile deutlich besser.
- Tarifkarten, Presets und Tagesmaximum unterstützen eine reale Kaufentscheidung.
- Der typbezogene Übergang zur Karte ist konsistent und zugänglich angekündigt.
- Marker besitzen sinnvolle Namen; Popups nennen Fahrradtyp und Station eindeutig.
- Rechtstexte, Prototyphinweis und Datenaktualität stärken Vertrauen.
- FAQ basiert auf nativer, gut fokussierbarer Semantik.
- Es gab bei den geprüften Breiten keinen horizontalen Overflow.

## Empfohlene Reihenfolge

### 1. Unmittelbar vor jeder weiteren Demo

1. Berechtigungsfehler beim Ausleihstart beseitigen.
2. SMTP-/Registrierungsstrecke reparieren.
3. Passwort-Recovery verdrahten.
4. Login nach Logout ohne Reload reparieren.
5. Einen automatisierten Happy-Path bis Rückgabe und Abrechnung etablieren.

### 2. Nächster UX-Sprint

1. Mobile Stationscluster und Popup-Z-Index korrigieren.
2. Ortsumschalter tatsächlich auf Würzburg/Gesamtnetz zoomen lassen.
3. Tarifrechner strikt und sichtbar validieren.
4. Unsichtbare Hero-Controls aus Fokus und Accessibility Tree nehmen.
5. 900/901-px-Breakpoint glätten.

### 3. Danach Feinschliff

Typ-Silhouetten in Tarifkarten, einheitliche CTA-Zeilen, konsequente deutsche Begrifflichkeit und Fokusziel des Sprunglinks optimieren.

## Kompakte Abnahmematrix für die nächste Version

- [ ] Registrierung versendet eine reale Testmail und erzeugt genau einen Auth-Benutzer.
- [ ] Passwort-Recovery funktioniert end-to-end.
- [ ] Login → Logout → Login funktioniert ohne Reload.
- [ ] City-, E- und Cargo-Ausleihe können gestartet und beendet werden.
- [ ] Eine Ausleihe erzeugt genau einen konsistenten Datensatz und eine sichtbare laufende Fahrt.
- [ ] Rückgabe aktualisiert Status/Position und zeigt Endpreis beziehungsweise Beleg.
- [ ] „Würzburg zeigen“ und „Ganzes Netz“ erzeugen unterschiedliche, korrekte Kartenansichten.
- [ ] Auf 390 px öffnet jeder Marker per Touch die richtige Station; der Popupkopf bleibt vollständig sichtbar.
- [ ] Rechner akzeptiert nur 1–1440 und zeigt immer exakt den tatsächlich berechneten Wert.
- [ ] Unsichtbare Hero-Elemente sind weder klick- noch fokussierbar.
- [ ] Produktauswahl meldet ihren aktiven Zustand an assistive Technik.
- [ ] Zwischen 900 und 901 px entsteht kein massiver Längensprung.
- [ ] Statischer Frontend-Check bleibt bei 0 Befunden.

## Schlussfazit

Design und inhaltliche Führung sind inzwischen überzeugend genug, um VeloCity als ernsthaften, modernen Mobilitätsdienst wahrzunehmen. Die verbliebenen Risiken sitzen nicht mehr primär im Hero, sondern an den Übergängen zwischen Interface, Authentifizierung und Datenbank. Genau dort muss die nächste Iteration ansetzen. Sobald Kontoanlage und vollständige Ausleihtransaktion stabil laufen, ist die Website sehr nah an einem professionell vorführbaren Gesamterlebnis.
