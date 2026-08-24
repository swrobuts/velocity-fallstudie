# VeloCity – kritisches UX-, UI- und Customer-Journey-Audit

**Geprüfter Prototyp:** `http://localhost:8765/`  
**Prüfdatum:** 24. August 2026  
**Perspektive:** kritische Design-, Usability- und Customer-Journey-Prüfung; keine reine Codeprüfung

## Kurzurteil

Der Prototyp hat eine starke visuelle Identität und einen ungewöhnlich guten Einstieg: Die großformatige Fahrradinszenierung, die klare Typografie und der produktbezogene Wechsel zwischen E-Bike und City-Bike sind merkfähig, hochwertig und nicht austauschbar. Auf Desktop wirkt die Seite grundsätzlich professionell.

Die Customer Journey bricht jedoch genau dort, wo aus Interesse eine Handlung werden soll. Auf Mobile und kleineren Tablets verschwindet die Hauptnavigation vollständig. Die Tarif-CTAs versprechen „Fahrt starten“, führen aber nur zur Karte und vergessen den gewählten Fahrradtyp. Der Registrierungsversuch lieferte kein sichtbares Ergebnis. Gleichzeitig stehen ein auffälliger Preiswiderspruch und tote Rechtstexte einer vertrauenswürdigen Nutzung entgegen.

**Gesamturteil:** visuell bereits stark, als belastbare kundenorientierte Anwendung aber noch nicht abnahmefähig. Die größte Hebelwirkung liegt nicht in einem weiteren Redesign des Hero, sondern in einer lückenlosen Journey von **Produkt verstehen → Preis prüfen → passenden Typ auf der Karte sehen → anmelden → konkrete Ausleihe beginnen**.

| Dimension | Einschätzung | Kurzbegründung |
|---|---:|---|
| Markenwirkung und Ästhetik | 8/10 | Eigenständig, urban, hochwertig und konsistent |
| Informationsarchitektur Desktop | 7/10 | Gute Abfolge, aber lange Hero-Strecke und unpräzise Ankerzustände |
| Mobile/Tablet-Usability | 4/10 | Keine Hauptnavigation bis 900 px; sehr lange Seite; überfüllte Karte |
| Customer-Journey-Kohärenz | 5/10 | Gute Orientierung oben, deutliche Kontextverluste an den CTAs |
| Barrierearme Bedienbarkeit | 4/10 | Gute FAQ-Semantik und Bewegungsreduktion, aber problematischer Dialog und Karte |
| Vertrauen/Produktionsreife | 3/10 | Preiswiderspruch, unklare Registrierung und tote Rechtstexte |

## Prüfumfang

Getestet wurden:

- vollständige Seite und Scroll-Story auf Desktop (1280 × 720), Tablet (768 × 1024) und Mobile (390 × 844)
- Breakpoints bei 390, 768, 900, 1024 und 1280 px
- Headernavigation und Sprungziele
- Scroll-Animation und Produktwechsel City-Bike/E-Bike
- Anleitung, Tarifkarten und Tarifrechner einschließlich Grenz- und Fehleingaben
- Kartenfilter, Stationsmarker, einzelne Fahrräder, Popup und Leih-CTA
- Login, Registrierung, Fehlermeldungen, Fokus, Escape und Hintergrundscroll
- FAQ-Akkordeons und Footerlinks
- semantische Rollen, zugängliche Namen, Fokusierbarkeit und reduzierte Bewegung
- vorhandener statischer Frontend-Check; dieser meldet **0 formale ID-/Selektorbefunde**, deckt die nachfolgenden Journey- und Bedienprobleme aber nicht ab

### Prioritäten

- **P0 – Stopper:** Nutzung oder Datenintegrität unmittelbar blockiert. Im geprüften Umfang kein eindeutiger P0.
- **P1 – kritisch:** Kernjourney, Vertrauen oder wesentliche Zielgruppe stark beeinträchtigt; vor einer öffentlichen Demo beheben.
- **P2 – wichtig:** deutliche Reibung, Missverständnisse oder Barrieren; im nächsten UX-Sprint beheben.
- **P3 – Feinschliff:** Qualitätsgewinn ohne unmittelbaren Journey-Abbruch.

## Findings

### P1 – kritisch

| ID | Befund und reproduzierbare Evidenz | Auswirkung auf die Customer Journey | Konkrete Empfehlung |
|---|---|---|---|
| P1-01 | **Mobile und Tablet verlieren die komplette Hauptnavigation.** Bei 390, 768 und 900 px steht `.site-nav` auf `display:none`; ein Hamburger, Menüdialog oder anderer Ersatz existiert nicht. Erst ab 1024 px erscheint die Navigation wieder. | Die drei wichtigsten Wege „So geht’s“, „Preise“ und „Live-Karte“ sind auf einem Großteil mobiler Geräte nicht direkt erreichbar. Wiederkehrende Nutzer müssen mehrere tausend Pixel scrollen. | Kompaktes Mobile-Menü oder mindestens drei klare Schnellzugriffe in den Header integrieren. „Live-Karte“ sollte als primäre Aktion dauerhaft erreichbar bleiben. |
| P1-02 | **Die Tarif-CTAs sind semantisch und funktional irreführend.** Alle drei Buttons heißen „Fahrt starten“, führen aber lediglich per `scrollIntoView()` zur Karte. Der gewählte Typ wird nicht als Kartenfilter übernommen; nach Klick auf Cargo bleiben alle Typen aktiv. | Erwartungsverletzung an einem zentralen Conversion-Punkt. Nutzer müssen ihre Entscheidung erneut treffen und verstehen nicht, warum keine Fahrt beginnt. | Entweder echte Reservierungs-/Ausleihlogik starten oder ehrlich beschriften: „City-Bikes auf Karte zeigen“. Beim Sprung Typfilter setzen, Ziel fokussieren und eine kurze Bestätigung anzeigen. |
| P1-03 | **Registrierung lieferte im Browser keinen sichtbaren Endzustand.** Zwei ausgefüllte Registrierungsversuche – darunter eine eindeutige Testadresse – leerten die Felder, ließen den Dialog geöffnet und zeigten weder Erfolg noch Fehler. Login mit falschen Daten zeigte dagegen korrekt „Ungültige E-Mail oder Passwort“. | Der wichtigste Einstieg in die Nutzung wirkt defekt oder unzuverlässig. Nutzer wissen weder, ob ein Konto angelegt wurde, noch was als Nächstes zu tun ist. Mehrfachregistrierungen sind wahrscheinlich. | Registrierung mit echtem Backendzustand erneut testen. Während der Anfrage Loading-Zustand und deaktivierten Submit zeigen; danach klarer Success-Screen („E-Mail prüfen“) oder persistente Inline-Fehlermeldung. Serverantwort und Auth-Event protokollieren. |
| P1-04 | **Auffälliger Preiswiderspruch.** Der Browser zeigt für 30 Minuten 3,10 € (City), **16,00 € (E-Bike)** und 5,00 € (Cargo). Die projektspezifische Prüfanleitung erwartet 3,10 / **4,00** / 5,00 €. Zusätzlich wird das E-Bike als „Beliebteste Wahl“ markiert und die Überschrift verspricht „ein Preismodell“. | Ein möglicher Daten-/Tariffehler beschädigt Vertrauen unmittelbar. Selbst falls 16 € beabsichtigt sind, fehlen Erklärung und Plausibilisierung; Cargo erscheint überraschend deutlich günstiger. | Datenquelle und Solltarif vor jeder Demo abgleichen. „Ein Preismodell“ durch „ein einfaches Prinzip“ ersetzen und Unterschiede pro Typ transparent erklären. Automatisierten UI-Test gegen definierte Referenztarife ergänzen. |
| P1-05 | **Rechtliche Vertrauensanker sind tote Links.** Impressum, Datenschutz, AGB/Nutzungsbedingungen und Widerrufsrecht haben jeweils nur `href="#"`. | Bei Registrierung, Standortdaten und Zahlung ist das ein massiver Vertrauens- und je nach Einsatz ein Compliance-Mangel. | Echte Inhalte/Seiten hinterlegen. Bis dahin nicht als fertige Links darstellen; Prototypstatus klar kennzeichnen. |
| P1-06 | **Der Auth-Dialog ist visuell, aber nicht funktional ein Modal.** Es fehlen `role="dialog"`, `aria-modal`, Benennung und Fokusfalle. Beim Öffnen bleibt der Fokus auf „Login“ hinter dem Overlay; Escape schließt nicht; der Hintergrund bleibt scrollbar. Die Reiter „Anmelden/Registrieren“ sind nicht fokussierbare `div`-Elemente. | Tastatur- und Screenreader-Nutzer verlieren Kontext und können den Dialog nur eingeschränkt bedienen. Auch sehende Nutzer erleben einen unvollständigen Dialogstandard. | Native `<dialog>`-Lösung oder vollständiges Dialog-Pattern: Fokus auf Überschrift/erstes Feld, Fokusfalle, Escape, Fokus-Rückgabe, Hintergrundsperre, `aria-labelledby`. Reiter als Buttons oder korrektes Tab-Pattern bauen. |
| P1-07 | **Die Mobile-Karte ist visuell überladen.** Stations- und freie Fahrradmarker liegen dicht übereinander; auf 390 px entsteht ein „Marker-Teppich“ ohne erkennbare Priorität oder räumliche Gruppierung. Filterkarte und Reset-Button reduzieren die nutzbare Fläche zusätzlich. | Der zentrale „Finde ein Rad“-Schritt ist auf dem wahrscheinlichsten Nutzungskontext – unterwegs am Smartphone – deutlich schwerer als auf Desktop. | Bei kleinem Zoom clustern, zunächst Stationen priorisieren und freie Fahrräder erst nach Typwahl/Zoom einblenden. Alternativ Karten-/Listenumschalter mit Distanz, Typ und Verfügbarkeit anbieten. |
| P1-08 | **45 freie Fahrradmarker sind fokussierbare, aber unbenannte Schaltflächen.** Im geladenen Kartenstand wurden 60 `role=button`-Elemente gezählt; 45 hatten weder Text, `title` noch `aria-label`. Insgesamt besitzt die Seite 97 fokussierbare Elemente. | Screenreader erhalten „Schaltfläche“ ohne Bedeutung; Tastaturnutzer müssen durch Dutzende unidentifizierbare Marker navigieren. | Jeder Marker braucht einen eindeutigen Namen, z. B. „E-Bike 4711, frei, 120 m entfernt“. Bei niedriger Zoomstufe Marker aus der Tab-Reihenfolge nehmen oder clustern. |

### P2 – wichtig

| ID | Befund und reproduzierbare Evidenz | Auswirkung | Konkrete Empfehlung |
|---|---|---|---|
| P2-01 | **Tarifrechner: Zahl und Regler laufen auseinander.** Zahlenfeld: `max=1440`; Regler: `max=240`. Bei 1440 Minuten zeigte das Zahlenfeld 1440, der Regler sprang auf 144. | Die Oberfläche vermittelt zwei widersprüchliche Zustände und macht die Tagesdeckelung schwer nachvollziehbar. | Gemeinsame Min-/Max-Konstante verwenden. Für lange Nutzung besser Presets („30 Min“, „2 Std“, „1 Tag“) plus Eingabefeld. |
| P2-02 | **Ungültige Zeitwerte bleiben sichtbar.** Bei 0 bzw. –5 Minuten blieb der falsche Wert im Zahlenfeld, während intern mit 1 Minute gerechnet und der Regler auf 1 gesetzt wurde. | Nutzer sehen eine andere Eingabe als die tatsächlich berechnete. Das ist bei Preisen besonders problematisch. | Wert sichtbar normalisieren oder Inline-Validierung zeigen; niemals still mit einem anderen Wert rechnen. |
| P2-03 | **Header-Sprungziele berücksichtigen den Sticky Header nicht sauber.** Nach Klick lagen die Zielsektionen bei `top:0`, während der Header 92 px hoch ist; der Fokus blieb auf dem alten/offscreen Element. | Abschnittslabel können verdeckt sein und Tastatur-/Screenreader-Nutzer erhalten keine neue Orientierung. | `scroll-margin-top` an Zielsektionen sowie programmatischen Fokus auf die Zielüberschrift setzen. |
| P2-04 | **Die mobile Scroll-Story ist zu lang und startet ohne sichtbare Aktion.** Bei 390/768/900 px ist der Hero rund 2970 px hoch; auf Mobile werden vor den Kennzahlen mehr als drei Bildschirmhöhen durchlaufen. Im ersten Viewport ist weder CTA noch Scrollhinweis sichtbar. | Gute Inszenierung kippt in Verzögerung. Nutzer mit konkretem Ziel erreichen Preise/Karte unnötig spät und wissen anfangs nicht sicher, dass Scrollen die Interaktion steuert. | Mobile Story auf etwa 140–180 vh verkürzen, CTA schon im ersten Viewport anbieten und die Produktauswahl früher zugänglich machen. |
| P2-05 | **Lokale Positionierung ist widersprüchlich.** Header und Kennzahl sprechen von „Würzburg · 13 Stationen“, die Karte enthält jedoch auch Stationen in Schweinfurt. | Der Nutzer kann Netzgröße und Geschäftsgebiet nicht sicher einordnen. | Entweder „Würzburg und Region“ kommunizieren und Gesamtzahl korrekt erklären oder Würzburg-/Schweinfurt-Ansichten bewusst trennen. |
| P2-06 | **Zugänglicher Hero-Text enthält zusammengeklebte Wörter.** Der ausgelesene H1 lautet u. a. „Würzburg hatviele Berge“ und „Wir liefern denRückenwind“; beim City-Claim entsprechend „Entspanntshoppen“. Die optischen Zeilen-Spans enthalten keine semantischen Leerzeichen. | Screenreader lesen den zentralen Claim fehlerhaft – ausgerechnet den wichtigsten Inhalt der Seite. | Leerzeichen im tatsächlichen Textknoten erhalten; optische Umbrüche nur per CSS bzw. mit `display:block`-Spans inklusive korrekt gesetzter Wortabstände erzeugen. |
| P2-07 | **Karten-Popup hat mehrfach identische „Leihen“-Buttons.** Drei Fahrradtypen werden korrekt aufgeschlüsselt, aber alle Aktionen haben denselben zugänglichen Namen. Die Popup-Schließen-Schaltfläche heißt englisch „Close popup“. | Bei linearer Navigation ist unklar, welches Fahrrad ausgeliehen wird; Sprachwechsel wirkt unfertig. | Namen kontextualisieren: „City-Bike an Station Marktplatz leihen“. Schließen-Label lokalisieren. |
| P2-08 | **Kartentext verspricht zu viel.** „Ein Klick schlüsselt nach Fahrradtyp auf und leiht direkt“ beschreibt den tatsächlichen Ablauf nicht: Erst öffnet sich ein Popup, dann wird ein Typ gewählt, anschließend ist gegebenenfalls Login nötig. | Falsches mentales Modell und Erwartungsbruch. | Copy präzisieren: „Station auswählen, Fahrradtyp prüfen und Ausleihe starten.“ |
| P2-09 | **Entwicklertext steht in der Kundenkommunikation.** Unter den Tarifen heißt es: „Alle Zahlen kommen aus der Preistabelle der Datenbank, nicht aus dem Seitentext.“ | Technisch interessant, für Kunden aber kein Nutzen und ein Bruch im urbanen Markenauftritt. | Durch eine vertrauensbildende Aussage ersetzen, z. B. „Du siehst jederzeit den aktuellen Tarif – transparent bis zum Tagesmaximum.“ |
| P2-10 | **Login-Formular ist funktional zu knapp.** Kein „Passwort vergessen?“, keine Passwortanzeige und keine `autocomplete`-Attribute (`email`, `current-password`, `new-password`, Namen). | Mehr Eingabeaufwand, schlechtere Passwortmanager-Unterstützung und keine Recovery-Route. | Recovery-Link, Show/Hide, passende Autocomplete-Werte und klaren Lade-/Fehlerzustand ergänzen. |
| P2-11 | **Produktwahl im Hero erfüllt das Tab-Pattern nur teilweise.** `role=tablist` und `aria-selected` sind vorhanden, beide Buttons bleiben aber regulär tabbbar; eine Pfeiltastenlogik bzw. ein roving `tabindex` ist nicht erkennbar. | Zusätzliche Tabs und inkonsistentes Verhalten gegenüber erwarteten ARIA-Tabs. | Entweder als einfache Toggle-Buttons ohne Tab-Rollen markieren oder vollständiges Tab-Pattern mit Pfeiltasten und `tabindex=0/-1` umsetzen. |
| P2-12 | **Keine Live-Ansage bei Kartenfilterung.** Die Filter verändern die Markerzahl korrekt (z. B. 58 → 31 → 18 → 13), aber es gibt keine `aria-live`-Rückmeldung. | Sehende Nutzer erkennen die Änderung, Screenreader-Nutzer nicht. | Kurze Statuszeile ergänzen: „18 passende Räder an 13 Stationen sichtbar.“ |

### P3 – Feinschliff

| ID | Befund | Empfehlung |
|---|---|---|
| P3-01 | Die Hero-Metazeile „E-Bike · Unterstützung bis 25 km/h“ bricht bei schmalen Viewports optisch unruhig um. | Kürzere Mobile-Fassung oder kontrollierten Umbruch definieren. |
| P3-02 | Preis- und Feature-Karten sind sauber, aber rein textlich. Die visuelle Differenz zwischen City-, E- und Cargo-Bike entsteht erst an anderer Stelle. | Kleine, konsistente Produkt-Silhouetten oder prägnante Typ-Icons ergänzen; keine dekorativen Stockbilder. |
| P3-03 | Die Kartenlegende „7 Station mit sieben freien Rädern“ ist grammatikalisch falsch und wirkt wie ein aktueller Wert statt wie ein Beispiel. | „Stationssymbol – Zahl = verfügbare Räder“ verwenden. |
| P3-04 | Die kleinste Footer-Marke „Velo · City · Velocity“ ist 11 px groß und liegt mit rund **4,28:1** knapp unter WCAG AA für normalen Text. | Auf mindestens 12–13 px bzw. höheren Kontrast anheben. |
| P3-05 | Der Login-Button dominiert im Desktop-Header visuell stärker als die meist wichtigere Live-Karte. | Für Erstbesucher „Live-Karte“ als primäre Headeraktion prüfen; Login sekundär, aber gut sichtbar halten. |
| P3-06 | Die Angabe „293 Räder live“ wirkt präzise, besitzt aber keinen erkennbaren Aktualitätszeitpunkt. | Bei echten Live-Daten „vor X Min. aktualisiert“ oder Refresh-Status ergänzen. |

## Customer Journey: Soll und Ist

| Phase | Nutzerfrage | Was gut funktioniert | Wo die Journey derzeit bricht |
|---|---|---|---|
| 1. Entdecken | „Was ist VeloCity?“ | Hero erklärt Produkt und lokale Relevanz emotional stark. | Mobile CTA fehlt im ersten Viewport; Story ist sehr lang. |
| 2. Verstehen | „Wie funktioniert es?“ | Drei verständliche Schritte; relevante FAQ. | Mobile Navigation zur Erklärung fehlt; Fließtext ist eher klein. |
| 3. Auswählen | „Welches Rad passt?“ | City/E-Bike-Wechsel und Cargo-Tarif machen das Angebot sichtbar. | Produktkontext geht nach Klick auf Tarif-CTA verloren. |
| 4. Preis prüfen | „Was kostet meine Fahrt?“ | Interaktiver Rechner und Tagesmaximum sind grundsätzlich stark. | E-Bike-Preiswiderspruch; ungültige Werte; Regler-/Feld-Desynchronisation. |
| 5. Finden | „Wo ist jetzt ein Rad?“ | Datenreiche Karte, funktionierende Typfilter, gute Stationsdetails. | Mobile Markerüberlastung; Würzburg/Schweinfurt unklar; 45 unbenannte Marker. |
| 6. Aktivieren | „Wie starte ich?“ | Leihbuttons und Login sind vorhanden; Loginfehler wird verständlich angezeigt. | „Fahrt starten“ startet nichts; Registrierung ohne sichtbaren Abschluss; Dialog nicht tastaturfest. |
| 7. Vertrauen | „Kann ich dem Dienst vertrauen?“ | Transparente Preiselemente, Kontaktadresse und relevante FAQ. | Tote Rechtstexte und möglicher Tariffehler sind klare Vertrauensstopper. |

## Was bereits überzeugend gelöst ist

- **Eigenständige visuelle Sprache:** Navy, Rot, Weiß, Condensed Display Type und technische Monospace-Akzente ergeben ein konsistentes, urbanes System.
- **Hero mit Aussage:** Bild und Claim bilden eine echte Produktthese; die Animation hat inhaltliche Funktion und ist keine bloße Dekoration.
- **Starke Desktop-Hierarchie:** große Überschriften, gute Weißräume, klar erkennbare Sektionen und eindeutige Primäraktionen.
- **Tarifrechner als Entscheidungshilfe:** Das Grundkonzept „Fahrzeit → nachvollziehbare Zerlegung → Tagesmaximum“ unterstützt die Kaufentscheidung sehr gut.
- **Kartenfilter funktionieren:** Die sichtbaren Marker reagieren korrekt auf City/E-Bike/Cargo; Stationszahlen werden passend neu berechnet.
- **Stations-Popup:** Visuell gut strukturiert, mit Verfügbarkeit, Typen, Preisen und Höheninformation.
- **FAQ:** Native `<details>/<summary>`-Semantik, verständliche Fragen und gut sichtbarer Tastaturfokus.
- **Reduced Motion:** `prefers-reduced-motion` wird ernst genommen; die Scroll-Inszenierung wird auf eine statische, bedienbare Variante reduziert.
- **Responsive Stabilität:** Bei den geprüften Breiten trat kein horizontaler Overflow auf; Bilder und Fonts waren vollständig geladen.

## Empfohlene Reihenfolge der Überarbeitung

### Vor der nächsten öffentlichen Demo

1. E-Bike-Tarif gegen Sollwert prüfen und korrigieren bzw. erklären.
2. Registrierung mit eindeutigen Erfolgs-/Fehlerzuständen reparieren und End-to-End testen.
3. Mobile/Tablet-Navigation ergänzen.
4. Tarif-CTA umbenennen und gewählten Fahrradtyp an die Karte übergeben.
5. Rechtstexte verlinken oder Prototypstatus offen kennzeichnen.
6. Auth-Dialog nach vollständigem Dialog-Pattern umbauen.

### Nächster UX-Sprint

1. Mobile Karte clustern bzw. Stationen-/Listenansicht priorisieren.
2. Marker zugänglich benennen und Fokuslast reduzieren.
3. Tarifrechner validieren und beide Controls synchronisieren.
4. Mobile Scroll-Story deutlich kürzen und CTA vorziehen.
5. Würzburg-/Schweinfurt-Gebietslogik und Netzkennzahlen schärfen.
6. Ankerfokus, H1-Textabstände und Karten-Popup-Namen korrigieren.

### Danach: visueller Feinschliff

Produktbilder/Silhouetten in den Tarifkarten, Footer-Kontrast, Mobile-Zeilenumbrüche und Priorisierung der Headeraktionen optimieren. Erst nach diesen Journey-Korrekturen lohnt sich weiteres Fine-Tuning am Hero.

## Abnahmekriterien für die nächste Version

- Bei 390, 768 und 900 px sind Preise, Anleitung und Live-Karte direkt über eine Navigation erreichbar.
- „Cargo auf Karte zeigen“ aktiviert ausschließlich Cargo, scrollt korrekt und fokussiert die Kartenüberschrift.
- Registrierung endet immer mit einem eindeutigen, persistenten Erfolg oder einer handlungsorientierten Fehlermeldung.
- Die drei 30-Minuten-Preise entsprechen einem dokumentierten Sollwert und einem automatisierten UI-Test.
- Zahlenfeld und Slider zeigen zu jedem Zeitpunkt denselben gültigen Wert.
- Auth-Dialog öffnet mit Fokus innen, schließt per Escape und gibt Fokus zurück.
- Kein Kartenmarker ist ohne zugänglichen Namen; bei Mobile ist die Karte ohne Markerüberlagerung bedienbar.
- Alle Rechtstexte führen zu realen Inhalten.
- Die Hauptüberschrift wird von einem Screenreader mit korrekten Wortabständen ausgegeben.
- Reduced-Motion-Ansicht, FAQ-Fokus und kein horizontaler Overflow bleiben erhalten.

