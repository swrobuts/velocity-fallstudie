// ============================================
// VeloCity Warenwirtschaft — Kunden
//
// Der inhaltlich wichtigste Bereich der ganzen Oberflaeche: hier sitzen
// die Betroffenenrechte der DSGVO. "Recht auf Loeschung" ist keine
// DELETE-Anweisung - siehe der lange Kommentar bei anonymisieren() weiter
// unten, das ist der eigentliche Lehrpunkt.
//
// Derselbe Bau wie flotte.js/stationen.js (Aufgaben 4/5): Liste,
// Detailmaske, ein paar Schaltflaechen, ein Anlegen-Einstieg ueber die
// geteilte Werkzeugleiste aus rahmen.js. Ausschliesslich die Bausteine
// aus rahmen.js und die eigene Sicht v_wawi_kunde - keine Basistabelle,
// keine fn_-Funktion.
// ============================================

bereichAnmelden({
    schluessel: 'kunden',
    titel: 'Kunden',
    // Dieselben Rollen, die auch v_wawi_kunde durchlaesst (siehe
    // db/aufbau/0018_wawi_sichten.sql) - waeren sie hier weiter gefasst,
    // saehe etwa die Werkstatt den Menuepunkt und dahinter eine leere
    // Liste, wie im Flotte-Kommentar begruendet.
    rollen: ['kundenservice', 'leitung'],
    aufbauen: kundenAufbauen
});

// ===== Suche =====
//
// Das Suchfeld liegt in der gemeinsamen Kopfleiste (index.html) und
// gehoert damit allen fuenf Arbeitsbereichen - aber Kunden ist der
// erste, der es braucht (275 Raeder und 10 Stationen kommen bei
// Aufgabe 4/5 noch ohne Suche aus, siehe dortige Kommentare). Die
// Verdrahtung steht deshalb hier statt in rahmen.js: anders als die
// Werkzeugleiste (die zwei Bereiche unabhaengig voneinander erfunden
// hatten, siehe Kommentar dort) gibt es bisher nur diesen einen
// Verbraucher. Braucht ein zweiter Bereich sie kuenftig auch, gehoert
// sie dann - und erst dann - nach rahmen.js gezogen.
const feldSuche = document.getElementById('feld-suche');
let sucheVerzoegerung = null;
feldSuche.addEventListener('input', () => {
    // aktiverBereich (aus rahmen.js, gemeinsamer Namensraum aller
    // <script>-Dateien ohne Module) verhindert, dass ein Tastendruck im
    // Suchfeld waehrend Flotte oder Stationen aktiv sind trotzdem
    // kundenAufbauen() ausloest und deren Liste unter der Hand
    // ueberschreibt.
    if (aktiverBereich?.schluessel !== 'kunden') return;
    clearTimeout(sucheVerzoegerung);
    // 300ms: reaktionsschnell genug, um sich sofort anzufuehlen, lang
    // genug, dass ein normaler Tippfluss nicht bei jedem Buchstaben eine
    // eigene Anfrage an die Datenbank schickt.
    sucheVerzoegerung = setTimeout(() => kundenAufbauen(feldSuche.value.trim()), 300);
});

// PostgREST behandelt Komma, Punkt und Klammern in einem .or()-Ausdruck
// als SYNTAX, nicht als Zeichen im Suchtext. Gegen den echten Endpunkt
// geprueft (curl, mit dem anon-Key): der unveraenderte Auftragstext
// (".or(`nachname.ilike.%${suchtext}%,...`)") lieferte fuer den Suchtext
// "A,B)test" einen HTTP 400 mit PGRST100 ("failed to parse logic tree") -
// das Komma zerlegt die Bedingung an einer Stelle, an der keine neue
// Bedingung gemeint war, und die ueberzaehlige Klammer bricht die
// Klammerung der gesamten or()-Gruppe. Rechte kann das nicht ausweiten:
// v_wawi_kunde filtert selbst ueber hat_rolle, unabhaengig davon, was im
// Filter steht. Aber die Suche liefert dann entweder einen Fehler statt
// eines Ergebnisses oder - bei gutartiger gewaehlten Sonderzeichen -
// still etwas anderes als gemeint.
//
// Die von PostgREST selbst vorgesehene Loesung: den Wert in doppelte
// Anfuehrungszeichen setzen und darin enthaltene Anfuehrungszeichen bzw.
// Backslashes escapen. Ebenfalls gegen den echten Endpunkt geprueft: mit
// dieser Quotierung liefert derselbe Suchtext denselben sauberen
// Parse-Erfolg wie ein unauffaelliger (beide Male 401 wegen des
// rechtelosen anon-Keys, aber ohne PGRST100 - der Filter selbst ist
// gueltig).
function suchwert(text) {
    const escaped = text.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    return `"%${escaped}%"`;
}

async function kundenAufbauen(suchtext) {
    // ALLERERSTE Anweisung, vor jedem await - siehe Kommentar bei
    // neuerVorgang() in rahmen.js und bei flotteAufbauen() in flotte.js.
    // Schuetzt hier nebenbei auch vor einer zweiten, ganz eigenen Race:
    // die Suche unten loest kundenAufbauen() bei jedem beruhigten
    // Tippen erneut aus (300ms Debounce). Tippt jemand waehrend eine
    // aeltere Suchanfrage noch unterwegs ist weiter, kommt die AELTERE
    // Antwort manchmal NACH der neueren zurueck - ohne Kennung ueberschriebe
    // sie die Liste der neueren Suche mit ihren eigenen, laengst
    // ueberholten Treffern.
    const vorgang = neuerVorgang();

    // Kein Standardwert '' im Funktionskopf: bereichWechseln() in
    // rahmen.js ruft jedes aufbauen() ohne Argument auf (das gilt fuer
    // alle fuenf Bereiche gleich, nicht nur fuer Kunden - siehe dort).
    // Stuende hier "suchtext = ''", zeigte ein Wechsel zurueck zu Kunden
    // immer die ungefilterte Liste, selbst wenn im Suchfeld noch ein
    // alter Suchtext steht: Anzeige und Feldinhalt liefen auseinander.
    // Bei undefined wird deshalb der aktuelle Feldinhalt genommen.
    if (suchtext === undefined) suchtext = feldSuche.value.trim();

    // Wer anlegen darf, bekommt den Knopf VOR der Liste zu sehen - nicht
    // ausgegraut fuer die Leitung, sondern schlicht nicht vorhanden,
    // dieselbe Regel wie bei Flotte und Stationen. Nur fuer
    // kundenservice sichtbar - dieselbe Rolle, die api_kunde_anlegen in
    // der Datenbank verlangt. Im Auftragstext fuer diese Aufgabe fehlt
    // dieser Einstieg (anders als bei Flotte/Stationen, wo er explizit
    // vorgegeben ist) - er wird trotzdem gebraucht: Schritt 5.4
    // verlangt einen selbst angelegten Testkunden, und ohne einen
    // Anlegen-Weg IN der Oberflaeche waere das keine Handprobe der
    // Oberflaeche mehr, sondern eine der Datenbank.
    zeigeWerkzeugleiste(darfRolle('kundenservice'), 'Neuen Kunden anlegen', kundeAnlegenMaske);

    const kunden = await ladeListe('v_wawi_kunde',
        'kunde_id, kundennummer, anrede, vorname, nachname, email, telefon, status, ' +
        'registriert_am, strasse, hausnummer, plz, ort, tarif_code, tarif, ' +
        'mitgliedschaft_seit, fahrten_gesamt, fahrten_offen, umsatz_brutto, offener_betrag',
        (q) => {
            let abfrage = q;
            if (suchtext) {
                const w = suchwert(suchtext);
                abfrage = abfrage.or(
                    `nachname.ilike.${w},vorname.ilike.${w},` +
                    `email.ilike.${w},kundennummer.ilike.${w}`);
            }
            return abfrage.order('nachname').limit(200);
        });

    const fehler = letzterLadeFehler('v_wawi_kunde');
    if (fehler) {
        // meldeVorgang statt melde: ein inzwischen veralteter Aufruf
        // (siehe Kommentar bei neuerVorgang() oben und in rahmen.js)
        // meldet auch seinen eigenen Ladefehler nicht mehr.
        meldeVorgang(vorgang, `Die Kunden liessen sich nicht laden: ${fehler}`, 'schlecht');
        return;
    }

    zeigeListe(vorgang, kunden, [
        { feld: 'kundennummer', titel: 'Nummer' },
        { feld: 'nachname',     titel: 'Nachname' },
        { feld: 'vorname',      titel: 'Vorname' },
        // Nur EIN Parameter (die ganze Zeile), nicht (s) wie im
        // Auftragstext: zeigeListe in rahmen.js ruft eine Funktions-
        // Spalte als spalte.klasse(zeile) auf, nicht spalte.klasse(wert).
        // Mit der woertlichen Signatur aus dem Auftrag ("(s) => s ===
        // 'gesperrt' ...") liefe s auf die ganze Zeile, "s === 'gesperrt'"
        // waere nie wahr und die Faerbung fiele lautlos aus. Derselbe
        // Fund wie statusKlasse in flotte.js und die frei-Spalte in
        // stationen.js (siehe dortige Kommentare), hier zum dritten Mal.
        { feld: 'status',       titel: 'Status',
          klasse: (z) => (z.status === 'gesperrt' ? 'warnung' : z.status === 'geschlossen' ? 'leise' : '') },
        { feld: 'tarif_code',   titel: 'Tarif', formatieren: (t) => t || '—' }
    ], kundeMaske);

    // WICHTIG 6: 519 der 1014 Kunden stehen auf 'gesperrt', und es gibt
    // derzeit keine Funktion, die entsperrt (bekannte Luecke, siehe auch
    // der Bestaetigungstext beim Sperren-Knopf in kundeMaske). Die
    // Erklaerung dazu stand bisher nur im Quelltext und im Dialog beim
    // NEU-Sperren - beides erreicht nicht, wer die Liste oeffnet und die
    // vielen gelben Zeilen sieht (die klasse-Funktion oben faerbt sie).
    // Genau DORT, wo es gelesen wird, gehoert der Hinweis hin - deshalb
    // hier in der Statuszeile, direkt bei der Zeilenzahl, nach demselben
    // Muster wie die "X davon voll"-Meldung in stationen.js.
    const gesperrt = kunden.filter((k) => k.status === 'gesperrt').length;

    // meldeVorgang statt melde: nach einer Buchung (Sperren,
    // Anonymisieren, Anlegen - siehe kundeMaske/kundeAnlegenMaske) ruft
    // genau dieser Aufruf hier sofort im Anschluss auf und ueberschriebe
    // die gerade gezeigte Bestaetigung, bevor sie jemand liest, wenn er
    // noch zu DIESEM Vorgang gehoert. Siehe Begruendung bei
    // meldeVorgang() in rahmen.js.
    let uebersicht;
    if (kunden.length === 200) {
        uebersicht = '200 von mehr Kunden — bitte weiter eingrenzen';
    } else {
        uebersicht = suchtext ? `${kunden.length} Kunden zu „${suchtext}“` : `${kunden.length} Kunden`;
        if (gesperrt) {
            uebersicht += `, ${gesperrt} davon gesperrt — es gibt derzeit keine Funktion, die entsperrt`;
        }
    }
    meldeVorgang(vorgang, uebersicht);
}

function kundeMaske(kunde) {
    // Diese Maske zeigt bewusst KEINE einzelnen Fahrten. Eine Liste mit
    // Start, Ziel und Uhrzeit ist ein Bewegungsprofil; der Kundenservice
    // braucht Summen, keine Wege. v_wawi_kunde liefert deshalb nur
    // fahrten_gesamt und umsatz_brutto - und keine ausleihe_id, die man
    // weiterverfolgen koennte. Genau das ist der Grund, warum diese
    // Oberflaeche v_wawi_fahrt_km nirgends benutzt (siehe Vorbemerkung
    // im Auftrag).
    //
    // Sie zeigt auch keine Zahlungsmittel (GR17) und nichts aus dem
    // Schema auth. Das Passwort ist fuer diese Oberflaeche schlicht
    // unerreichbar, nicht nur ausgeblendet.
    //
    // KRITISCH 1: alle vier Knoepfe unten stehen zusaetzlich hinter
    // darfRolle('kundenservice') - der Bereich selbst ist fuer
    // ['kundenservice', 'leitung'] angemeldet (siehe bereichAnmelden()
    // oben), aber api_kunde_aktualisieren, api_kunde_sperren,
    // api_kunde_auskunft UND api_kunde_anonymisieren verlangen in der
    // Datenbank strikt 'kundenservice' (fn_rolle_verlangen('kundenservice'),
    // 0019_wawi_logik.sql) - 'leitung' allein reicht dort NICHT. Ohne diese
    // Pruefung saehe eine Leitung ohne kundenservice-Rolle alle vier
    // Knoepfe, einschliesslich "Loeschung nach Art. 17": sie koennte
    // "LOESCHEN" eintippen, einen Grund angeben und bekaeme die
    // Rechteverweigerung erst am Ende von rufeAuf(). Dieselbe Regel wie
    // ueberall sonst in dieser Oberflaeche: was man nicht darf, wird nicht
    // angezeigt, nicht ausgegraut (siehe stationMaske() in stationen.js
    // fuer denselben Fund an derselben Stelle - Bereich fuer zwei Rollen
    // offen, Funktion nur fuer eine).
    const knoepfe = [];

    if (darfRolle('kundenservice')) {
        knoepfe.push({
            titel: 'Speichern',
            art: 'haupt',
            ausfuehren: async () => {
                const feld = (name) => document.getElementById(`feld-maske-${name}`).value.trim();

                const vorname = feld('vorname');
                const nachname = feld('nachname');
                if (!vorname || !nachname) {
                    melde('Vorname und Nachname werden benoetigt.', 'schlecht');
                    return;
                }

                // strasse entscheidet in api_kunde_aktualisieren allein
                // darueber, ob die Adresse ueberhaupt angefasst wird (die
                // Funktion prueft nur "p_strasse is not null"). Ein
                // leeres Feld wird deshalb zu null, nicht zu einem
                // leeren String - sonst haette ein Kunde ohne Adresse,
                // dessen Adressfelder allesamt leer bleiben, versucht,
                // eine leere Adresse anzulegen, statt einfach keine zu
                // haben.
                const strasse = feld('strasse');

                await rufeAuf('api_kunde_aktualisieren', {
                    p_kunde_id: kunde.kunde_id,
                    p_vorname: vorname,
                    p_nachname: nachname,
                    p_telefon: feld('telefon') || null,
                    p_strasse: strasse || null,
                    p_hausnummer: feld('hausnummer') || null,
                    p_plz: feld('plz') || null,
                    p_ort: feld('ort') || null
                });
                melde(`${vorname} ${nachname} gespeichert.`, 'gut');
                await kundenAufbauen();
            }
        });
    }

    if (darfRolle('kundenservice') && kunde.status === 'aktiv') {
        knoepfe.push({
            titel: 'Sperren',
            // 'gefaehrlich' statt des 'neben' aus dem Auftragstext, und
            // mit einem Bestaetigungsdialog, den der Auftragstext an
            // dieser Stelle nicht vorsieht: es gibt derzeit KEINE
            // Funktion, die eine Sperrung wieder aufhebt (bekannte
            // Luecke, siehe Kommentar in kundenAufbauen). Eine Sperrung
            // ist damit in der Praxis nicht rueckgaengig zu machen, auch
            // wenn die Datenbank selbst kein Verbot dafuer kennt -
            // dieselbe Einstufung wie bei "Ausmustern" in flotte.js und
            // "Stilllegen" in stationen.js, aus demselben Grund
            // (Endzustand ohne Weg zurueck).
            art: 'gefaehrlich',
            ausfuehren: async () => {
                const ok = await bestaetige(
                    `${kunde.vorname} ${kunde.nachname} sperren? Es gibt derzeit keine Funktion, ` +
                    `die eine Sperrung wieder aufhebt - das ist eine bekannte Luecke dieser ` +
                    `Warenwirtschaft, keine Bequemlichkeit dieses Dialogs.`);
                if (!ok) return;
                const grund = await frageNachGrund('Grund der Sperrung');
                if (grund === null) return;
                await rufeAuf('api_kunde_sperren', { p_kunde_id: kunde.kunde_id, p_grund: grund });
                melde(`${kunde.vorname} ${kunde.nachname} gesperrt.`, 'gut');
                await kundenAufbauen();
            }
        });
    }

    if (darfRolle('kundenservice')) {
        knoepfe.push({ titel: 'Auskunft nach Art. 15', art: 'neben', ausfuehren: () => auskunftZeigen(kunde) });
    }

    if (darfRolle('kundenservice') && kunde.status !== 'geschlossen') {
        knoepfe.push({ titel: 'Löschung nach Art. 17', art: 'gefaehrlich',
                       ausfuehren: () => anonymisieren(kunde) });
    }

    zeigeMaske(`${kunde.kundennummer} · ${kunde.vorname} ${kunde.nachname}`, [
        { name: 'anrede',    titel: 'Anrede',    wert: kunde.anrede || '',    typ: 'text' },
        { name: 'vorname',   titel: 'Vorname',   wert: kunde.vorname,          typ: 'text' },
        { name: 'nachname',  titel: 'Nachname',  wert: kunde.nachname,         typ: 'text' },
        // WICHTIG 7: der Status hatte bisher kein eigenes Feld, nur die
        // mittelbare Zeilenfarbe in der Liste (siehe klasse-Funktion in
        // kundenAufbauen()) und die Auswahl der Knoepfe darueber. Wer
        // eine Zeile oeffnet, soll den Status direkt lesen koennen, nicht
        // aus der Abwesenheit eines Knopfes erschliessen muessen - dieselbe
        // Machart wie die uebrigen nur lesenden Feldern (typ, tarif, ...).
        { name: 'status',    titel: 'Status',    wert: kunde.status,          nurLesen: true },
        // E-Mail nur lesend: sie ist der Anmeldename. Sie zu aendern ist
        // eine Kontoaenderung und gehoert dem Kunden, nicht uns.
        { name: 'email',     titel: 'E-Mail',    wert: kunde.email,            nurLesen: true },
        { name: 'telefon',   titel: 'Telefon',   wert: kunde.telefon || '',    typ: 'tel' },
        { name: 'strasse',   titel: 'Straße',    wert: kunde.strasse || '',    typ: 'text' },
        { name: 'hausnummer', titel: 'Nr.',      wert: kunde.hausnummer || '', typ: 'text' },
        { name: 'plz',       titel: 'PLZ',       wert: kunde.plz || '',        typ: 'text' },
        { name: 'ort',       titel: 'Ort',       wert: kunde.ort || '',        typ: 'text' },
        { name: 'tarif',     titel: 'Tarif',     wert: kunde.tarif || 'ohne Mitgliedschaft', nurLesen: true },
        { name: 'fahrten',   titel: 'Fahrten',   wert: kunde.fahrten_gesamt,   nurLesen: true },
        { name: 'umsatz',    titel: 'Umsatz',    wert: `${kunde.umsatz_brutto} €`, nurLesen: true },
        { name: 'offen',     titel: 'Offen',     wert: `${kunde.offener_betrag} €`, nurLesen: true },
        // Schritt 3 des Auftrags verlangt, dass die Protokollierung VOR
        // dem Knopf gesagt wird, nicht danach. zeigeMaske() aus
        // rahmen.js kennt keinen eigenen Baustein fuer erklaerenden Text
        // zwischen Feldern und Knopfleiste (anders als bestaetige(), das
        // genau dafuer gebaut ist) - ein eigener Baustein dafuer waere
        // fuer einen einzigen Verbraucher verfrueht, siehe Begruendung
        // beim Suchfeld oben. Deshalb hier ein schreibgeschuetztes Feld
        // statt eines neuen rahmen.js-Bausteins: es steht im selben
        // Formular oberhalb der Knopfleiste und damit zwingend vor jedem
        // Klick auf "Auskunft nach Art. 15".
        { name: 'auskunft_hinweis', titel: 'Hinweis', typ: 'mehrzeilig', nurLesen: true,
          wert: 'Der Abruf der Auskunft nach Art. 15 wird protokolliert (GR19): ' +
                'wer sie einsieht, hinterlaesst eine Spur im Aenderungsprotokoll.' }
    ], knoepfe);
}

// ===== Auskunft nach Art. 15 DSGVO =====
//
// api_kunde_auskunft liefert acht Abschnitte in einem JSON-Dokument.
// zeigeMaske() aus rahmen.js baut ein Bearbeitungsformular mit Feldern
// und einer Knopfleiste - fuer eine reine Anzeige mit acht
// unterschiedlich geformten Abschnitten (ein Objekt, sieben Listen) ist
// das der falsche Baustein. Der Dialog wird deshalb von Hand gebaut,
// nach demselben Muster wie bestaetige()/frageNachGrund() in rahmen.js
// (eigenes <dialog>, showModal(), Aufraeumen bei 'close').
async function auskunftZeigen(kunde) {
    const auskunft = await rufeAuf('api_kunde_auskunft', { p_kunde_id: kunde.kunde_id });

    const dialog = document.createElement('dialog');
    dialog.className = 'velocity-dialog';
    // Breiter und hoeher als .velocity-dialog aus style.css vorsieht
    // (max-width 420px): jene Klasse ist auf einen Satz und ein
    // Eingabefeld zugeschnitten, die Auskunft aber traegt acht
    // Abschnitte, teils mit langen Listen (Fahrten, Rechnungen). Als
    // Inline-Stil gesetzt statt als neue CSS-Klasse: style.css stand
    // nicht in der Liste der fuer diese Aufgabe zu aendernden Dateien,
    // und eine Groessenausnahme fuer einen einzigen Dialog ist keinen
    // eigenen Klassennamen wert.
    dialog.style.maxWidth = '640px';
    dialog.style.width = '90vw';
    dialog.style.maxHeight = '85vh';
    dialog.style.overflowY = 'auto';

    const ueberschrift = document.createElement('h2');
    ueberschrift.textContent = `Auskunft nach Art. 15 DSGVO · ${kunde.vorname} ${kunde.nachname}`;
    dialog.append(ueberschrift);

    // Reihenfolge wie im Auftragstext (Schritt 3) benannt: stammdaten,
    // mitgliedschaften, fahrten (mit Koordinaten), rechnungen,
    // zahlungen, schadensmeldungen, freiminuten, protokoll.
    const abschnitte = [
        ['Stammdaten', auskunft.stammdaten],
        ['Mitgliedschaften', auskunft.mitgliedschaften],
        ['Fahrten', auskunft.fahrten],
        ['Rechnungen', auskunft.rechnungen],
        ['Zahlungen', auskunft.zahlungen],
        ['Schadensmeldungen', auskunft.schadensmeldungen],
        ['Freiminuten', auskunft.freiminuten],
        ['Protokoll', auskunft.protokoll]
    ];
    for (const [titel, inhalt] of abschnitte) {
        const h3 = document.createElement('h3');
        h3.textContent = titel;
        h3.style.color = 'var(--marine)';
        h3.style.margin = '12px 0 4px';
        h3.style.fontSize = '13px';
        dialog.append(h3);

        const pre = document.createElement('pre');
        pre.textContent = JSON.stringify(inhalt, null, 2);
        pre.style.whiteSpace = 'pre-wrap';
        pre.style.wordBreak = 'break-word';
        pre.style.fontSize = '12px';
        pre.style.background = 'var(--grund)';
        pre.style.padding = '8px';
        pre.style.borderRadius = '4px';
        pre.style.margin = '0';
        dialog.append(pre);
    }

    const knopfleiste = document.createElement('div');
    knopfleiste.className = 'knopfleiste';

    const herunterladenKnopf = document.createElement('button');
    herunterladenKnopf.type = 'button';
    herunterladenKnopf.textContent = 'Als JSON herunterladen';
    herunterladenKnopf.className = 'knopf-neben';
    herunterladenKnopf.addEventListener('click', () => {
        const blob = new Blob([JSON.stringify(auskunft, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `auskunft-${kunde.kundennummer}.json`;
        link.click();
        URL.revokeObjectURL(url);
    });

    const schliessenKnopf = document.createElement('button');
    schliessenKnopf.type = 'button';
    schliessenKnopf.textContent = 'Schließen';
    schliessenKnopf.className = 'knopf-haupt';
    schliessenKnopf.addEventListener('click', () => dialog.close());

    knopfleiste.append(herunterladenKnopf, schliessenKnopf);
    dialog.append(knopfleiste);
    document.body.append(dialog);

    dialog.addEventListener('close', () => dialog.remove());
    dialog.showModal();
    schliessenKnopf.focus();
}

// ===== Loeschung nach Art. 17 DSGVO — der Lehrpunkt =====

async function anonymisieren(kunde) {
    // api_kunde_anonymisieren weist eine laufende Fahrt ab (der Kunde
    // muss erst zurueckgeben). Ohne diese Vorabpruefung saehe der Kunde
    // erst nach dem Eintippen von "LOESCHEN" und einem Grund eine
    // Fehlermeldung - derselbe Grundsatz wie bei "Stilllegen" in
    // stationen.js (dortige Vorabpruefung auf station.belegt).
    if (kunde.fahrten_offen > 0) {
        melde(`${kunde.vorname} ${kunde.nachname} hat noch eine laufende Fahrt. ` +
              `Erst die Rueckgabe abwarten.`, 'warnung');
        return;
    }

    // Der Knopf heisst "Loeschung nach Art. 17", und die Funktion
    // dahinter heisst anonymisieren. Das ist kein Etikettenschwindel,
    // sondern der Kern: Paragraf 147 AO verlangt zehn Jahre Aufbewahrung
    // fuer Rechnungsbelege, Art. 17 Abs. 3 lit. b DSGVO nimmt genau
    // solche Pflichten von der Loeschpflicht aus. Wer den Kunden
    // loescht, verstoesst gegen das Steuerrecht; wer nichts tut, gegen
    // die DSGVO. Anonymisieren erfuellt beides.
    //
    // Der Dialog muss das sagen. Wer hier klickt, soll wissen, was
    // bleibt - nicht nur, dass etwas verschwindet.
    const ok = await bestaetige(
        `Löschung nach Art. 17 DSGVO für ${kunde.vorname} ${kunde.nachname}?\n\n` +
        `WAS VERSCHWINDET: Name, E-Mail, Telefonnummer, Geburtsdatum, Anschrift, ` +
        `Zahlungsmittel und die Verknüpfung zum Anmeldekonto. Auch im Änderungsprotokoll ` +
        `werden die alten Werte unkenntlich gemacht.\n\n` +
        `WAS BLEIBT: die ${kunde.fahrten_gesamt} Fahrten und alle Rechnungen, in voller Höhe. ` +
        `Das Steuerrecht verlangt zehn Jahre Aufbewahrung, und die DSGVO nimmt genau ` +
        `diese Pflicht von der Löschung aus.\n\n` +
        `WAS DAS NICHT LEISTET: Die Fahrten tragen Zeiten und Orte. Wer regelmäßig zur ` +
        `selben Zeit vom selben Punkt fährt, bleibt darüber auffindbar.\n\n` +
        `Der Vorgang ist nicht rückgängig zu machen.`,
        'LOESCHEN'   // muss eingetippt werden
    );
    if (!ok) return;

    const grund = await frageNachGrund('Grund (etwa: Antrag der betroffenen Person vom …)');
    if (!grund) { melde('Abgebrochen: ohne Grund keine Löschung.', 'warnung'); return; }

    await rufeAuf('api_kunde_anonymisieren', { p_kunde_id: kunde.kunde_id, p_grund: grund });
    melde(`Kunde ${kunde.kundennummer} anonymisiert. Rechnungen und Fahrten bleiben erhalten.`, 'gut');
    await kundenAufbauen();
}

// ===== Einen Kunden anlegen =====
//
// Kein eigener Leisten-Baustein hier, siehe Kommentar bei
// zeigeWerkzeugleiste() in rahmen.js. Der Einstieg dazu ist die
// Werkzeugleiste am Kopf von kundenAufbauen().
//
// Im Auftragstext fuer diese Aufgabe nicht als eigener Schritt
// ausformuliert (anders als bei Flotte/Stationen) - aber Schritt 5.4
// verlangt einen Testkunden, "den du selbst anlegst", und dafuer braucht
// es einen Weg in der Oberflaeche selbst, nicht nur in der Datenbank.

function kundeAnlegenMaske() {
    zeigeMaske('Neuen Kunden anlegen', [
        { name: 'vorname',  titel: 'Vorname',  wert: '' },
        { name: 'nachname', titel: 'Nachname', wert: '' },
        { name: 'email',    titel: 'E-Mail',   wert: '', typ: 'email' },
        { name: 'telefon',  titel: 'Telefon',  wert: '', typ: 'tel' }
    ], [
        {
            titel: 'Anlegen',
            art: 'haupt',
            ausfuehren: async () => {
                const feld = (name) => document.getElementById(`feld-maske-${name}`).value.trim();

                const vorname = feld('vorname');
                const nachname = feld('nachname');
                const email = feld('email');
                if (!vorname || !nachname || !email) {
                    melde('Vorname, Nachname und E-Mail werden benoetigt.', 'schlecht');
                    return;
                }

                await rufeAuf('api_kunde_anlegen', {
                    p_vorname: vorname,
                    p_nachname: nachname,
                    p_email: email,
                    p_telefon: feld('telefon') || null
                });
                melde(`Kunde ${vorname} ${nachname} angelegt.`, 'gut');
                await kundenAufbauen();
            }
        }
    ]);
}
