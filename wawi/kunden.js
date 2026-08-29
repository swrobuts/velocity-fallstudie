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

// Navigations-Icon (Gestaltungsauftrag, Punkt 3): eine Person - derselbe
// Gedanke wie beim Fahrrad-Icon in flotte.js, dieselbe Strichfamilie
// (siehe .bereich-icon in style.css).
const ICON_KUNDSCHAFT = '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.4"/><path d="M5 20c0-4 3.2-6.6 7-6.6s7 2.6 7 6.6"/></svg>';

bereichAnmelden({
    schluessel: 'kunden',
    // Gestaltungsauftrag, Punkt 2: "Kunden" -> "Kundschaft" - NUR der
    // angezeigte Titel. Der Schluessel 'kunden' (Rollenpruefungen,
    // Navigationszustand), der Dateiname kunden.js und jede darauf
    // aufbauende Funktion/Variable bleiben unangetastet - eine
    // Umbenennung des SCHLUESSELS haette v_wawi_kunde, alle Aufrufer und
    // tools/wawi_check.py mitgerissen, ohne dass der Auftrag danach
    // verlangt.
    titelSchluessel: 'nav.kunden',
    icon: ICON_KUNDSCHAFT,
    // Dieselben Rollen, die auch v_wawi_kunde durchlaesst (siehe
    // db/aufbau/0018_wawi_sichten.sql) - waeren sie hier weiter gefasst,
    // saehe etwa die Werkstatt den Menuepunkt und dahinter eine leere
    // Liste, wie im Flotte-Kommentar begruendet. 'demo' kam in der
    // zweiten Demozugang-Runde dazu: der Auftraggeber hat die Kundschaft
    // fuer den Demozugang ausdruecklich freigegeben ("das sind
    // Musterdaten", siehe der Kommentar an v_wawi_kunde). Das SCHREIBEN
    // bleibt trotzdem gesperrt, ohne dass diese Zeile das wuesste: die
    // vier Knoepfe unten (Speichern/Sperren/Auskunft/Loeschung) pruefen
    // ZUSAETZLICH darfRolle('kundenservice'), das 'demo' nie erfuellt
    // (siehe KRITISCH 1 bei kundeMaske() weiter unten) - derselbe
    // Aufbau, der dort schon 'leitung' ohne 'kundenservice' korrekt von
    // den Knoepfen fernhaelt.
    rollen: ['kundenservice', 'leitung', 'demo'],
    aufbauen: kundenAufbauen,
    // Gestaltungsauftrag Punkt 5: das Suchfeld soll sagen, WONACH es
    // sucht - siehe suchwert()/die .or()-Abfrage weiter unten
    // (Nachname, Vorname, E-Mail, Kundennummer) und bereichWechseln() in
    // rahmen.js, das diesen Text als Platzhalter UND aria-label setzt.
    suchePlatzhalterSchluessel: 'nav.kundenSuche',
    // DIESER Bereich sucht SELBST, und als einziger (siehe
    // spaltenkopfSuchtext in rahmen.js): v_wawi_kunde traegt 1014 Zeilen,
    // geladen sind hoechstens 200 (.limit(200) weiter unten). Eine Suche
    // ueber die geladenen Zeilen faende hier nur, was zufaellig unter den
    // ersten 200 Nachnamen steht - genau die Luege, die schon der
    // Statusfilter unten vermeidet. Der Suchtext geht deshalb an die
    // Datenbank, nicht an den Tabellenbaustein.
    sucheSelbst: true
});

// ===== Suche, SERVERSEITIG =====
//
// Der SICHTBARE Zustand des Feldes (Klasse feld-suche-aktiv) und seine
// Beschriftung liegen seit dem Umbau von Punkt 5 in rahmen.js - dort, wo
// das Feld auch steht und wo alle fuenf Bereiche es benutzen. HIER bleibt
// nur, was allein diesen Bereich angeht: der Suchtext geht als
// PostgREST-Filter an die Datenbank, nicht an die geladenen Zeilen
// (siehe sucheSelbst bei bereichAnmelden() oben).
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
    // eigene Anfrage an die Datenbank schickt - dieselbe Zeitspanne wie
    // beim Spaltenfilter und beim Baustein-Sucher in rahmen.js.
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

// ===== Statusfilter (Gestaltungsauftrag, Punkt 2) =====
//
// "Ein Filter nach Status (aktiv/gesperrt/geschlossen) macht die 519
// begreifbar" - woertlich der Auftrag. SERVERSEITIG per .eq() in der
// Ladeliste unten, aus demselben Grund wie die Suche direkt darueber:
// v_wawi_kunde traegt 1014 Zeilen, die Arbeitsliste begrenzt sie per
// .limit(200) auf die ersten 200 nach Nachname - ein Filter, der nur in
// diesen bereits geladenen 200 suchte, zeigte bei "gesperrt" (519 von
// 1014) einen willkuerlichen Ausschnitt statt der tatsaechlich
// gesperrten Kunden, abhaengig davon, wie viele "A...-K..."-Nachnamen
// zufaellig gesperrt sind. Das waere genau die im Auftrag beschriebene
// Luege: ein Filter, der vorgibt, ueber allen Kunden zu suchen, aber nur
// ueber einem Bruchteil sucht, ohne das zu sagen.
//
// Gestaltungsauftrag Bedienelemente, Punkt 2: "ich kann bei Filter immer
// nur ein Item aussuchen, brauche aber Multiselect" - ein leeres Set
// bedeutet "Alle" (der Ausgangszustand), ein nichtleeres traegt die
// gewaehlten Status-Werte. SERVERSEITIG bleibt es dabei: .in() statt
// .eq() weiter unten in kundenAufbauen() ist PostgREST' eigener Weg,
// mehrere Werte in EINER Abfrage zu uebergeben (?status=in.(aktiv,
// gesperrt)) - dieselbe 200-von-1014-Grenze wie zuvor macht das noetig,
// nicht nur wuenschenswert (siehe Kommentar oben: ein Mehrfachfilter, der
// nur die geladenen 200 durchsuchte, waere dieselbe Luege wie ein
// Einfachfilter, der es tut).
let kundenFilterStatus = new Set();

function kundenStatusText(status) {
    return statusAnzeige(status, true);
}

// ===== Datumsanzeige (Gestaltungsauftrag, Punkt 1) =====
//
// "Schreib Daten so, dass sie sich vergleichen lassen; ein Datum, das
// man rechnen muss, um es einzuordnen, hilft nicht" - woertlich der
// Auftrag. v_wawi_kunde liefert registriert_am/letzte_ausleihe_am als
// ISO-Zeitstempel (supabase-js reicht sie unveraendert durch); roh
// angezeigt waere das "2026-08-22T14:00:00+00:00" - lesbar, aber nicht
// auf einen Blick MIT der Nachbarspalte vergleichbar. Eine einzige
// Formatierfunktion fuer BEIDE neuen Spalten (siehe die Feldliste
// weiter unten) statt je einer eigenen: "Kunde seit" und "Letzte
// Ausleihe am" muessen im GLEICHEN Format nebeneinanderstehen, sonst
// bräuchte man wieder eine Umrechnung, um zwei Daten derselben Person zu
// vergleichen - genau das der Auftrag ausschliesst. day/month/year fest
// zweistellig statt der de-DE-Vorgabe ("22.8.2026"): sonst waeren die
// Spalten von Zeile zu Zeile unterschiedlich breit, dieselbe
// "vertikale Flucht"-Ueberlegung wie bei balkenSpalten() in rahmen.js.
// NICHT nach rahmen.js gezogen: bislang der einzige Verbraucher, siehe
// dieselbe Zurueckhaltung bei der Suche weiter oben in dieser Datei.
function kundenDatumFormat(zeitstempel) {
    return datumFormat(zeitstempel, { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// "Letzte Ausleihe am" - siehe der ausfuehrliche Kommentar an der Sicht
// (db/aufbau/0018_wawi_sichten.sql): letzte_ausleihe_am zaehlt eine
// LAUFENDE Ausleihe ausdruecklich mit, letzte_ausleihe_laeuft sagt, ob
// genau das hier der Fall ist. Zwei Zustaende, die eine leere Zelle
// NICHT mit einem Ladefehler verwechseln lassen duerfen (Auftrag,
// ausdruecklich als wiederkehrende Verwechslung in diesem Projekt
// benannt):
//   - null: noch nie ausgeliehen - eigener, ausgeschriebener Text statt
//     des sonst ueblichen "—" (siehe ort/tarif_code oben/unten): ein
//     blosser Gedankenstrich waere HIER wieder genau die Zelle, die wie
//     ein Ladefehler aussieht, die diese Aufgabe beheben soll.
//   - sonst: das Datum, PLUS ein sichtbarer Zusatz, wenn diese Ausleihe
//     noch laeuft - ein Datum ohne diesen Zusatz sae'he wie eine
//     abgeschlossene Fahrt aus, waere es aber nicht.
function kundenLetzteAusleiheFormat(zeitstempel, zeile) {
    if (!zeitstempel) return t('misc.noRentalYet');
    const datum = kundenDatumFormat(zeitstempel);
    return zeile.letzte_ausleihe_laeuft ? t('misc.stillRunning', { datum }) : datum;
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
    zeigeWerkzeugleiste(darfRolle('kundenservice'), t('button.newCustomer'), kundeAnlegenMaske);

    // Vier Anfragen parallel: die eigentliche (Such- und filter-
    // abhaengige, auf 200 begrenzte) Arbeitsliste, UND drei reine
    // Zaehl-Anfragen (zaehleZeilen(), daten.js) fuer die Kopftafel - die
    // muessen den GESAMTEN Bestand zaehlen, unabhaengig von Suchtext,
    // Statusfilter und der 200er-Grenze (siehe kundenKopftafel() weiter
    // unten und der Kommentar bei kundenFilterStatus oben).
    const [kunden, gesamtAnzahl, gesperrtAnzahl, ohneAdresseAnzahl] = await Promise.all([
        ladeListe('v_wawi_kunde',
            'kunde_id, kundennummer, anrede, vorname, nachname, email, telefon, status, ' +
            'registriert_am, strasse, hausnummer, plz, ort, tarif_code, tarif, ' +
            'mitgliedschaft_seit, fahrten_gesamt, fahrten_offen, umsatz_brutto, offener_betrag, ' +
            'letzte_ausleihe_am, letzte_ausleihe_laeuft',
            (q) => {
                let abfrage = q;
                if (suchtext) {
                    const w = suchwert(suchtext);
                    abfrage = abfrage.or(
                        `nachname.ilike.${w},vorname.ilike.${w},` +
                        `email.ilike.${w},kundennummer.ilike.${w}`);
                }
                // .in() statt .eq(): PostgREST' eigener Weg fuer "mehrere
                // Werte gleichzeitig" (?status=in.(aktiv,gesperrt)) - siehe
                // Kommentar bei kundenFilterStatus oben.
                if (kundenFilterStatus.size > 0) abfrage = abfrage.in('status', [...kundenFilterStatus]);
                return abfrage.order('nachname').limit(200);
            }),
        zaehleZeilen('v_wawi_kunde'),
        zaehleZeilen('v_wawi_kunde', (q) => q.eq('status', 'gesperrt')),
        // WARUM GIBT ES KEINE ADRESSE BEI DEN KUNDEN? (Auftraggeber-Frage,
        // Gestaltungsauftrag Punkt 4) - 901 von 1014 haben tatsaechlich
        // eine, 113 nicht. .is('strasse', null) statt .is('adresse_id',
        // null): v_wawi_kunde liefert kein adresse_id, strasse ist der
        // naechstliegende NULL-Indikator derselben Rechnungsadresse.
        zaehleZeilen('v_wawi_kunde', (q) => q.is('strasse', null))
    ]);

    const fehler = letzterLadeFehler('v_wawi_kunde');
    if (fehler) {
        // meldeVorgang statt melde: ein inzwischen veralteter Aufruf
        // (siehe Kommentar bei neuerVorgang() oben und in rahmen.js)
        // meldet auch seinen eigenen Ladefehler nicht mehr.
        zeigeKopftafel(vorgang, null);
        meldeVorgang(vorgang, t('msg.customersLoadFailed', { fehler }), 'schlecht');
        return;
    }

    // NACH dem Promise.all oben, NICHT darin - eigener, sequentieller
    // Aufruf (Punkt 5, Verteilung): ladeListe() (daten.js) verwaltet
    // ladeFehler/ladeZaehler ueber die "quelle" ALS SCHLUESSEL - ZWEI
    // GLEICHZEITIGE ladeListe('v_wawi_kunde', ...)-Aufrufe (die grosse
    // Arbeitsliste oben UND diese schlanke Ladeliste) teilten sich sonst
    // denselben Zaehler und koennten sich je nach Antwortreihenfolge
    // gegenseitig als "veraltet" markieren (siehe Kopfkommentar bei
    // ladeListe() in daten.js: der Mechanismus ist fuer AUFEINANDER-
    // FOLGENDE Aufrufe derselben Quelle gedacht, nicht fuer zwei
    // ABSICHTLICH gleichzeitig unterschiedliche Projektionen derselben
    // Sicht). Sequenziell nacheinander vermeidet die Kollision vollstaendig
    // - der Zeitverlust ist bei 1014 Zeilen mit vier schmalen Spalten
    // vernachlaessigbar. Ein Fehlschlag HIER wird bewusst NICHT wie oben
    // behandelt (kein Abbruch der ganzen Kundenliste nur wegen ein paar
    // Verteilungskacheln) - ladeListe() liefert dann [], und jede der drei
    // Verteilungsfunktionen unten laesst ihre Kachel dann schlicht weg
    // ("lieber keine Kachel als eine falsche").
    //
    // GESTALTUNGSAUFTRAG PUNKT 2, woertlich: "519 von 1014 sind gesperrt.
    // Wer sind die? Seit wann? Haben sie je gefahren?" - tarif_code UND
    // fahrten_gesamt UND registriert_am kommen deshalb NEU in dieselbe
    // schlanke Ladeliste dazu, die vorher nur umsatz_brutto trug (jetzt
    // alleKennzahlen statt alleUmsaetze genannt) - EINE zusaetzliche
    // Anfrage ueber ALLE 1014 Kunden statt vier einzelner, aus demselben
    // Grund wie oben: eine Verteilung ueber nur die (hoechstens 200)
    // GELADENEN Zeilen waere genau die "Luege", vor der der Auftrag beim
    // Statusfilter schon warnt (siehe Kommentar bei kundenFilterStatus).
    // ort traegt die Wohnort-Angabe der Bezugszeile ("573 in Wuerzburg,
    // verteilt ueber 14 Orte"), tarif den ausgeschriebenen Namen jeder
    // Tarifgruppe - beide werden von kundenKopftafel() weiter unten
    // gebraucht und stehen ohnehin in derselben Zeile.
    const alleKennzahlen = await ladeListe('v_wawi_kunde',
        'status, tarif_code, tarif, umsatz_brutto, fahrten_gesamt, registriert_am, ort');

    zeigeKopftafel(vorgang, kundenKopftafel(gesamtAnzahl, gesperrtAnzahl, ohneAdresseAnzahl, alleKennzahlen));

    zeigeFilterleiste(vorgang, true, [
        {
            // Kein { wert: 'alle', ... } mehr unter den Optionen: der
            // Rueckweg zu "Alle" ist jetzt ein eigener Knopf im
            // Mehrfachauswahl-Popup, kein Listeneintrag (siehe
            // mehrfachauswahlFeld() in rahmen.js).
            name: 'status', titel: t('field.status'), wert: kundenFilterStatus,
            optionen: [
                { wert: 'aktiv', text: statusAnzeige('aktiv', true) },
                { wert: 'gesperrt', text: statusAnzeige('gesperrt', true) },
                { wert: 'geschlossen', text: statusAnzeige('geschlossen', true) }
            ],
            beiAenderung: (neu) => { kundenFilterStatus = neu; kundenAufbauen(); }
        }
    ]);

    if (kunden.length === 0) {
        // Grenzfall "kein Treffer" (Erprobung, Auftrag) - fuer Kunden
        // erreichbar ueber Suchtext UND/ODER Statusfilter, deshalb bietet
        // das Zuruecksetzen beides gemeinsam an. Der Filter bleibt dabei
        // sichtbar (siehe zeigeFilterleiste() oben), nur die Suche selbst
        // muss von Hand geleert werden - ein Rueckweg dafuer ueber
        // angebot waere ein zweiter Weg neben dem Suchfeld in der
        // Kopfleiste, fuer denselben Effekt.
        zeigeLeermaske(
            vorgang,
            t('empty.noCustomersFilterTitle'),
            suchtext
                ? t('empty.noCustomersFilterTextSearch', { suchtext })
                : t('empty.noCustomersFilterText'),
            kundenFilterStatus.size > 0
                ? { titel: t('empty.statusFilterReset'), ausfuehren: async () => {
                      kundenFilterStatus = new Set(); await kundenAufbauen();
                  } }
                : null
        );
        meldeVorgang(vorgang, t('empty.noCustomersFilterTitle'));
        return;
    }

    zeigeListe(vorgang, kunden, [
        { feld: 'kundennummer', titel: t('field.nummer') },
        { feld: 'nachname',     titel: t('field.nachname') },
        { feld: 'vorname',      titel: t('field.vorname') },
        // Nur EIN Parameter (die ganze Zeile), nicht (s) wie im
        // Auftragstext: zeigeListe in rahmen.js ruft eine Funktions-
        // Spalte als spalte.klasse(zeile) auf, nicht spalte.klasse(wert).
        // Mit der woertlichen Signatur aus dem Auftrag ("(s) => s ===
        // 'gesperrt' ...") liefe s auf die ganze Zeile, "s === 'gesperrt'"
        // waere nie wahr und die Faerbung fiele lautlos aus. Derselbe
        // Fund wie statusKlasse in flotte.js und die frei-Spalte in
        // stationen.js (siehe dortige Kommentare), hier zum dritten Mal.
        // filterbar:false (Spaltenkopf-Baustein, rahmen.js): der
        // Statusfilter oben (kundenFilterStatus) filtert bereits
        // SERVERSEITIG genau dieses Feld, vor der 200er-Grenze - ein
        // zweiter, rein clientseitiger Filter auf denselben Werten
        // koennte sich mit dem ersten widersprechen (Filterleiste
        // "gesperrt", Spaltenkopf "aktiv" -> immer null Zeilen unter den
        // geladenen 200), siehe der lange Kommentar bei zeigeListe() in
        // rahmen.js.
        { feld: 'status',       titel: t('field.status'), filterbar: false,
          formatieren: (wert) => statusAnzeige(wert),
          klasse: (z) => (z.status === 'gesperrt' ? 'warnung' : z.status === 'geschlossen' ? 'leise' : '') },
        // EINE BENENNUNG FUER DIE TARIFGRUPPE, UEBERALL (Befund der
        // Referenzangleichung, derselbe wie beim Radtyp in flotte.js):
        // hier stand der tarif_code ("STUDENT", "OEPNV"), waehrend die
        // Kopftafel zwei Zentimeter darueber "Studententarif" und
        // "OEPNV-Abo" schreibt - dieselbe Spalte, zwei Vokabulare, auf
        // demselben Bildschirm. v_wawi_kunde liefert beide Felder (siehe
        // die Ladeanfrage oben), die Aenderung kostet keine Anfrage.
        // '—' bei fehlender Mitgliedschaft bleibt: das ist die
        // Leerzeichen-Regel dieser Liste (siehe der Kommentar bei
        // kundenLetzteAusleiheFormat() oben), und sie hier zugunsten
        // eines ausgeschriebenen "Ohne aktiven Tarif" zu brechen waere
        // eine zweite Entscheidung, die nicht in dieser Aufgabe steckt -
        // sie steht als Befund im Bericht.
        { feld: 'tarif',        titel: t('field.tarif'), formatieren: (wert) => wert || '—' },
        // GESTALTUNGSAUFTRAG, PUNKT 1, woertlich: "Bei Kunde vermisse ich
        // das Attribut 'Kunde seit', 'Letzte Ausleihe am', muss beides in
        // der Tabelle angezeigt werden." Zwei neue Datumsspalten dazu, statt
        // sie der bestehenden Sechserreihe (Nummer/Nachname/Vorname/Ort/
        // Status/Tarif) einfach anzuhaengen: WARUM GERADE ORT WEICHT -
        // nachgemessen (tools/zahlen_gegen_db.py-Stil, siehe Bericht), NICHT
        // geraten: 573 der 1014 Kunden (56 %) wohnen inzwischen in
        // Wuerzburg selbst, alle 1014 verteilen sich auf ganze 14 Orte -
        // derselbe Datenstand-Wechsel, der die Kundschaft insgesamt "in
        // Wuerzburg und Umgebung" ansiedelt (siehe Auftrag). Eine Spalte, in
        // der mehr als die Haelfte aller Zeilen denselben Wert zeigt und
        // der Rest aus 13 weiteren Werten besteht, traegt in dieser
        // Uebersicht kaum noch eigene Information - anders als beim
        // fruehren, bundesweit verteilten Bestand, fuer den Punkt 4 des
        // vorherigen Auftrags Ort ausdruecklich verlangt hatte. Der Ort
        // bleibt deshalb NICHT verschwunden, nur nicht mehr in der
        // Kompaktliste: kundeMaske() weiter unten zeigt ihn unveraendert in
        // der Detailmaske. Damit waechst die Tabelle nur um EINE Spalte
        // netto (6 -> 7), nicht um zwei - "Weissraum grosszuegig" bleibt
        // gewahrt, statt zwei Spalten blind anzuhaengen.
        //
        // filterbar:false auf beiden: der Spaltenkopf-Filter vergleicht
        // gegen den ROHEN Zellwert (den ISO-Zeitstempel), nicht gegen den
        // hier gezeigten Text ("22.08.2026") - ein getippter Suchtext im
        // deutschen Format faende dort nie einen Treffer. Sortierbar bleibt
        // die Spalte trotzdem (Vorgabewert): ein ISO-Zeitstempel sortiert
        // als Text schon richtig chronologisch, siehe der Kommentar bei
        // istSortierbar()/spaltenWert() in rahmen.js.
        { feld: 'registriert_am', titel: t('field.kundeSeit'), filterbar: false,
          formatieren: (wert) => kundenDatumFormat(wert) },
        { feld: 'letzte_ausleihe_am', titel: t('field.letzteAusleihe'), filterbar: false,
          formatieren: (wert, zeile) => kundenLetzteAusleiheFormat(wert, zeile) }
    ], kundeMaske, kundeZeilenAktionen);

    // meldeVorgang statt melde: nach einer Buchung (Sperren,
    // Anonymisieren, Anlegen - siehe kundeMaske/kundeAnlegenMaske) ruft
    // genau dieser Aufruf hier sofort im Anschluss auf und ueberschriebe
    // die gerade gezeigte Bestaetigung, bevor sie jemand liest, wenn er
    // noch zu DIESEM Vorgang gehoert. Siehe Begruendung bei
    // meldeVorgang() in rahmen.js.
    //
    // Der "X davon gesperrt"-Hinweis, den es hier frueher gab (WICHTIG 6),
    // steht jetzt in der Bezugszeile und in der Zusammensetzungsspalte
    // der Kopftafel (siehe kundenKopftafel()) - er zaehlte bisher aus den
    // hoechstens 200
    // GELADENEN Zeilen, nicht aus allen 1014. Ungefiltert waeren das
    // die ersten 200 Nachnamen alphabetisch, nicht die tatsaechlichen
    // 519 - derselbe Fehler, vor dem der Gestaltungsauftrag beim Filter
    // ausdruecklich warnt ("Ein Filter, der nur die geladenen 200 von
    // 1014 durchsucht, luegt"), hier schon vor dieser Aufgabe im
    // Statuszeilen-Text vorhanden. Die Kachel zaehlt ueber zaehleZeilen()
    // richtig; die Statuszeile beschraenkt sich jetzt auf das, was sie
    // tatsaechlich weiss: wie viele der (ggf. eingegrenzten) Treffer
    // geladen sind.
    const einschraenkung = [
        suchtext ? t('msg.searchFor', { suchtext }) : null,
        kundenFilterStatus.size > 0
            ? t('msg.statusList', { liste: [...kundenFilterStatus].map(kundenStatusText).join(', ') }) : null
    ].filter(Boolean).join(', ');
    const zusatz = einschraenkung ? ` (${einschraenkung})` : '';
    meldeVorgang(vorgang, kunden.length === 200
        ? t('msg.customersCapped', { zusatz })
        : `${mengeFormat(kunden.length, 'kunde')}${zusatz}`);
}

// ===== Kopftafel der Kundschaft =====
//
// DIE FRAGE, DIE DIESER KOPF BEANTWORTET: "Wer traegt eigentlich den
// Umsatz - und wie viel von diesen 1014 Datensaetzen ist ueberhaupt
// Kundschaft?"
//
// Die Liste darunter zeigt hoechstens 200 der 1014 Zeilen (serverseitig
// begrenzt) und beantwortet damit ueber die Gesamtheit gar nichts. Die
// Tafel rechnet ueber ALLE 1014 (eigene, schlanke Ladeliste, siehe
// kundenAufbauen()) - und ihre letzte Spalte stellt die Frage, die eine
// blosse Zaehlung nie stellen koennte: WIE WEIT LIEGT DER UMSATZANTEIL
// EINER TARIFGRUPPE UEBER ODER UNTER IHREM KUNDENANTEIL. Das ist eine
// Abweichung im Sinne der IBCS-Notation, keine zweite Zaehlung, und sie
// steht in keiner Zeile der Tabelle darunter.
//
// ZEILEN SIND DIE FUENF TARIFGRUPPEN, einschliesslich der Gruppe "ohne
// aktiven Tarif" - die groesste von allen. Sie wegzulassen, weil sie
// technisch kein Tarif ist, hiesse 604 von 1014 Personen aus dem Kopf zu
// streichen und ausgerechnet den Befund zu verschweigen, den der Auftrag
// als "die auffaelligste Zahl des Bereichs" benennt: die 519 Gesperrten
// stecken fast vollstaendig in dieser einen Zeile, und keine einzige von
// ihnen ist je gefahren.
function kundenKopftafel(gesamtAnzahl, gesperrtAnzahl, ohneAdresseAnzahl, alleKennzahlen) {
    if (!alleKennzahlen || alleKennzahlen.length === 0) return null;

    const gesamt = alleKennzahlen.length;

    const nachTarif = new Map();
    for (const kunde of alleKennzahlen) {
        // tarif ist NULL, wenn keine gueltige Mitgliedschaft besteht
        // (LEFT JOIN in v_wawi_kunde) - eine eigene, benannte Gruppe, kein
        // uebersprungener Datensatz.
        const schluessel = kunde.tarif_code || 'OHNE';
        let eintrag = nachTarif.get(schluessel);
        if (!eintrag) {
            eintrag = {
                schluessel,
                name: kunde.tarif || t('board.customersNoTariff'),
                kunden: 0, gefahren: 0, ohneFahrt: 0, gesperrt: 0,
                umsatz: 0, fahrten: 0
            };
            nachTarif.set(schluessel, eintrag);
        }
        eintrag.kunden += 1;
        eintrag.umsatz += Number(kunde.umsatz_brutto) || 0;
        eintrag.fahrten += Number(kunde.fahrten_gesamt) || 0;
        if (kunde.status === 'gesperrt') eintrag.gesperrt += 1;
        else if ((Number(kunde.fahrten_gesamt) || 0) > 0) eintrag.gefahren += 1;
        else eintrag.ohneFahrt += 1;
        // registriert_am wird hier NICHT mehr eingesammelt: die
        // Zugaenge je Jahr sind als Spalte gestrichen (siehe die
        // Begruendung bei umsatzJeFahrt() weiter unten). Das Feld bleibt
        // in der Liste darunter als Spalte "Kunde seit" stehen, wo es
        // eine Einzelangabe ist und keine Verteilung behauptet.
    }

    const gruppen = [...nachTarif.values()].sort((a, b) => b.kunden - a.kunden);
    const umsatzGesamt = gruppen.reduce((s, g) => s + g.umsatz, 0);

    // ===== DIE ANMELDUNGEN JE JAHR SIND GESTRICHEN, UND WARUM =====
    //
    // Diese Tafel trug bis zu dieser Fassung eine Profilspalte mit den
    // Zugaengen je Kalenderjahr - 27 Saeulen (2000 bis 2026) je
    // Tarifgruppe, auf einer gemeinsamen Skala. An den Daten
    // nachgerechnet, Hoechstwert je Zeile:
    //
    //     ohne Tarif      31   = 100,0 % der Skalenhoehe
    //     Basistarif      15   =  48,4 %
    //     Studententarif   9   =  29,0 %
    //     OEPNV-Abo        5   =  16,1 %
    //     Premium          2   =   6,5 %
    //
    // Vier von fuenf Zeilen blieben damit unter der halben Hoehe, die
    // unterste bei einem Fuenfzehntel - auf 16 Bildschirmpixeln sind das
    // ein bis zwei Pixel, also eine flache Linie. Dazu 27 Saeulen in
    // einer 96 Pixel breiten Zelle: 3,5 Pixel je Saeule, schmaler als
    // die Fuge zwischen ihnen. Die gemeinsame Skala war richtig (ohne
    // sie waeren die Zeilen nicht vergleichbar) - sie machte nur
    // sichtbar, dass hier vier Zeilen nichts zu zeigen haben.
    //
    // Und die Frage dahinter trug ohnehin nicht: die Anmeldejahre
    // reichen bis 2000 zurueck, der Fahrbetrieb beginnt im Januar 2025.
    // Wann jemand ein Konto angelegt hat, sagt ueber die heutige
    // Kundschaft wenig.
    //
    // AN IHRER STELLE STEHT DER UMSATZ JE FAHRT - die Zahl, die
    // erklaert, warum die Abweichungsspalte rechts so weit ausschlaegt.
    // Nachgerechnet: 4,43 EUR (ohne Tarif), 4,26 (Basis), 1,43
    // (Premium), 1,22 (Student), 1,20 (OEPNV-Abo). Zwei deutlich
    // getrennte Gruppen im Verhaeltnis 3,7 zu 1, und zwar ein Befund und
    // keine Zahlenspielerei: wer ein Abo zahlt, faehrt je Fahrt billig -
    // die Abogruppen tragen 24 bis 26 Fahrten je Kopf, die Kundschaft
    // ohne Tarif 3,4.
    //
    // VERHAELTNISZAHL AUS SUMMEN (Hausregel): Rechnungsvolumen der
    // Gruppe geteilt durch ihre Fahrten - nicht der Mittelwert der
    // Einzelquotienten, bei dem 604 Personen mit null bis zwei Fahrten
    // dasselbe Gewicht bekaemen wie 215 Vielfahrer.
    const umsatzJeFahrt = (gruppe) => (gruppe.fahrten ? gruppe.umsatz / gruppe.fahrten : 0);

    // VERHAELTNISZAHL AUS SUMMEN (Hausregel): Umsatzanteil ist "Summe der
    // Rechnungsbetraege dieser Gruppe durch Summe aller Rechnungsbetraege",
    // NICHT der Mittelwert der Einzelanteile - 604 Kunden mit 0 Euro haetten
    // sonst dasselbe Gewicht wie 215 mit dreistelligen Betraegen.
    const umsatzanteil = (gruppe) => (umsatzGesamt ? gruppe.umsatz / umsatzGesamt : 0);
    const kundenanteil = (gruppe) => gruppe.kunden / gesamt;

    const strukturText = (gruppe) => [
        gruppe.gefahren ? `${t('board.customersWithRides')} ${zahlFormat(gruppe.gefahren)}` : null,
        gruppe.ohneFahrt ? `${t('board.customersNoRides')} ${zahlFormat(gruppe.ohneFahrt)}` : null,
        gruppe.gesperrt ? `${statusAnzeige('gesperrt', true)} ${zahlFormat(gruppe.gesperrt)}` : null
    ].filter(Boolean).join(', ');

    const gesamtzeile = {
        summenzeile: true, name: t('col.together'), kunden: gesamt,
        gefahren: gruppen.reduce((s, g) => s + g.gefahren, 0),
        ohneFahrt: gruppen.reduce((s, g) => s + g.ohneFahrt, 0),
        gesperrt: gruppen.reduce((s, g) => s + g.gesperrt, 0),
        umsatz: umsatzGesamt,
        fahrten: gruppen.reduce((s, g) => s + g.fahrten, 0)
    };

    // Konzentration: welchen Anteil am gesamten Rechnungsvolumen traegt
    // das oberste Zehntel der Kundschaft? Aus DENSELBEN 1014 Zeilen
    // gerechnet wie die Tafel selbst, nicht aus einer zweiten Anfrage -
    // zwei Wege zu derselben Zahl koennten leise auseinanderlaufen.
    const umsaetzeAbsteigend = alleKennzahlen
        .map((k) => Number(k.umsatz_brutto) || 0).sort((a, b) => b - a);
    const zehntel = Math.max(1, Math.ceil(gesamt * 0.1));
    const top10 = umsaetzeAbsteigend.slice(0, zehntel).reduce((s, w) => s + w, 0);

    const orte = new Set(alleKennzahlen.map((k) => k.ort).filter(Boolean));
    const nachOrt = new Map();
    for (const kunde of alleKennzahlen) {
        if (!kunde.ort) continue;
        nachOrt.set(kunde.ort, (nachOrt.get(kunde.ort) || 0) + 1);
    }
    const groessterOrt = [...nachOrt.entries()].sort((a, b) => b[1] - a[1])[0] || null;

    return {
        titel: t('board.customersTitle'),
        bezug: t('board.customersReference', {
            kundenPhrase: mengeFormat(gesamtAnzahl ?? gesamt, 'kunde'),
            gesperrt: zahlFormat(gesperrtAnzahl ?? gesamtzeile.gesperrt),
            volumen: geldFormatZentral(umsatzGesamt),
            ort: groessterOrt ? groessterOrt[0] : '?',
            imOrt: groessterOrt ? zahlFormat(groessterOrt[1]) : '0',
            ortePhrase: mengeFormat(orte.size, 'ort')
        }),
        spalten: [
            {
                art: 'rubrik',
                titel: t('col.tariffGroup'),
                wert: (z) => z.name,
                zusatz: (z) => (z.summenzeile || !umsatzGesamt ? null
                    : t('board.customersRevenueShare', {
                        anteil: zahlFormat(Math.round(umsatzanteil(z) * 1000) / 10,
                            { minimumFractionDigits: 1, maximumFractionDigits: 1 })
                    }))
            },
            {
                art: 'groesse',
                titel: t('col.customers'),
                einheit: t('unit.persons'),
                wert: (z) => z.kunden,
                format: (n) => zahlFormat(n),
                // RANG 4 DER FARBORDNUNG - ZUGEHOERIGKEIT (kategorieFarbe()
                // in rahmen.js). Dieselben fuenf Toene tragen die
                // Tarifgruppen im Reiter "Umsatz nach Tarifgruppe" der
                // Auswertungen; "ohne Tarif" bekommt den Schieferton, der
                // sich von den vier bunten Gruppen absetzt, ohne selbst
                // eine Gruppe zu behaupten - es IST keine.
                farbe: (z) => kategorieFarbe(z.schluessel) || 'var(--marine)'
            },
            {
                art: 'struktur',
                titel: t('col.customerMix'),
                einheit: t('unit.shareOfRow'),
                auchSumme: true,
                // ZWEI SEGMENTE STATT DREIER. "ohne Fahrt" ist im
                // heutigen Bestand in ALLEN FUENF Zeilen exakt null
                // (nachgezaehlt: jede nicht gesperrte Kundin, jeder
                // nicht gesperrte Kunde hat mindestens eine
                // abgeschlossene Fahrt) - ein Segment, das nie
                // erscheint, ist kein Segment, sondern ein Eintrag in
                // einer Legende, den niemand je zuordnen kann.
                // strukturBalken() liess es ohnehin schon weg (wert 0
                // wird uebersprungen); es stand nur noch in der
                // Beschriftung und in dieser Liste.
                //
                // Was die Spalte damit sagt, sagt sie klar: vier Zeilen
                // ein voller Balken, eine Zeile zu 86 % gesperrt (518
                // von 604 ohne Tarif). Der Kontrast 14 % gegen 100 % ist
                // der ganze Inhalt dieser Spalte - und er ist sichtbar,
                // das genuegt.
                segmente: (z) => [
                    { wert: z.gefahren, name: t('board.customersWithRides'), klasse: 'seg-aktiv' },
                    { wert: z.gesperrt, name: statusAnzeige('gesperrt', true), klasse: 'seg-warnung' }
                ],
                beschriftung: (z) => t('board.customersMixAria', { name: z.name, aufteilung: strukturText(z) })
            },
            {
                // ERSETZT DIE ANMELDUNGEN JE JAHR - Begruendung und
                // Messwerte stehen oben bei umsatzJeFahrt().
                //
                // LAGEPUNKT, KEINE SAEULENREIHE: es ist EIN Wert je
                // Zeile, keine Form ueber die Zeit. Und kein Balken vom
                // Nullpunkt: fuenf Werte zwischen 1,20 und 4,43 EUR
                // laegen dort zwischen 27 und 100 Prozent Laenge und
                // liessen die drei Abogruppen (1,20 / 1,22 / 1,43) zu
                // einem Klumpen verschmelzen. Auf einer Achse von
                // Kleinst- zu Groesstwert stehen sie getrennt, und die
                // Luecke zwischen den beiden Gruppen ist genau die
                // Aussage.
                art: 'profil',
                titel: t('col.revenuePerRideColumn'),
                einheit: t('unit.euroPerRide'),
                punkt: (z) => (z.summenzeile ? null : Math.round(umsatzJeFahrt(z) * 100) / 100),
                beschriftung: (z) => t('board.customersRevenuePerRideAria', {
                    name: z.name,
                    betrag: geldFormatZentral(umsatzJeFahrt(z)),
                    fahrtenPhrase: mengeFormat(z.fahrten, 'fahrt')
                })
            },
            {
                art: 'abweichung',
                titel: t('col.revenueDeviation'),
                einheit: t('unit.percentagePoints'),
                wert: (z) => (z.summenzeile ? null
                    : Math.round((umsatzanteil(z) - kundenanteil(z)) * 1000) / 10),
                format: (n) => abweichungText(n),
                beschriftung: (z) => t('board.customersDeviationAria', {
                    name: z.name,
                    umsatzanteil: zahlFormat(Math.round(umsatzanteil(z) * 1000) / 10, { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
                    kundenanteil: zahlFormat(Math.round(kundenanteil(z) * 1000) / 10, { minimumFractionDigits: 1, maximumFractionDigits: 1 })
                })
            }
        ],
        zeilen: gruppen,
        summe: gesamtzeile,
        fussnote: t('board.customersFootnote', {
            zehntel: zahlFormat(zehntel),
            anteil: umsatzGesamt ? zahlFormat(top10 / umsatzGesamt * 100, { maximumFractionDigits: 1 }) : '0',
            ohneAdresse: zahlFormat(ohneAdresseAnzahl ?? 0)
        })
    };
}

// Fuenfter Parameter von zeigeListe() (Punkt 3 der Gestaltung): einzig
// "Auskunft nach Art. 15" qualifiziert sich - eine reine Leseabfrage
// ohne Buchung, "das Beilaeufige" (Auftrag). "Speichern" braucht die
// gerade eingetippten Feldwerte der OFFENEN Maske und ist damit kein
// zeilenbezogenes, in sich abgeschlossenes Icon. "Sperren" und
// "Loeschung nach Art. 17" sind 'gefaehrlich' (siehe kundeMaske unten) -
// "eine gefaehrliche Handlung gehoert nicht als Icon in eine Zeile"
// (Gestaltungsauftrag, Punkt 3) schliesst beide ausdruecklich aus.
//
// darfRolle('kundenservice') wiederholt hier dieselbe Pruefung wie in
// kundeMaske() unten (KRITISCH 1: alle vier Funktionen hinter
// api_kunde_* verlangen 'kundenservice', 'leitung' allein reicht nicht) -
// ohne sie saehe eine Leitung ohne kundenservice-Rolle das Auskunfts-Icon
// in jeder Zeile, obwohl api_kunde_auskunft ihr die Ausfuehrung verweigert.
const KUNDE_ICONS = {
    // Feather "file-text": Dokument mit Textzeilen - "Auskunft ansehen".
    auskunft: '<svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>' +
        '<polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/>' +
        '<line x1="16" y1="17" x2="8" y2="17"/></svg>'
};

function kundeZeilenAktionen(kunde) {
    if (!darfRolle('kundenservice')) return [];
    return [{
        titel: t('button.disclosureArt15'),
        svg: KUNDE_ICONS.auskunft,
        ausfuehren: () => auskunftZeigen(kunde)
    }];
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
    // ['kundenservice', 'leitung', 'demo'] angemeldet (siehe
    // bereichAnmelden() oben), aber api_kunde_aktualisieren,
    // api_kunde_sperren, api_kunde_auskunft UND api_kunde_anonymisieren
    // verlangen in der Datenbank strikt 'kundenservice'
    // (fn_rolle_verlangen('kundenservice'), 0019_wawi_logik.sql) - weder
    // 'leitung' noch 'demo' allein reicht dort. Ohne diese Pruefung saehe
    // eine Leitung ohne kundenservice-Rolle alle vier Knoepfe,
    // einschliesslich "Loeschung nach Art. 17": sie koennte "LOESCHEN"
    // eintippen, einen Grund angeben und bekaeme die Rechteverweigerung
    // erst am Ende von rufeAuf(). Fuer 'demo' gilt dieselbe Rechnung -
    // die Rolle ist keine Fachrolle und erfuellt kundenservice nie (siehe
    // db/aufbau/0020_demo_zugang.sql) - deshalb reicht diese EINE
    // Pruefung fuer beide Faelle, ohne eine eigene demo-Abfrage. Dieselbe
    // Regel wie ueberall sonst in dieser Oberflaeche: was man nicht darf,
    // wird nicht angezeigt, nicht ausgegraut (siehe stationMaske() in
    // stationen.js
    // fuer denselben Fund an derselben Stelle - Bereich fuer zwei Rollen
    // offen, Funktion nur fuer eine).
    const knoepfe = [];

    if (darfRolle('kundenservice')) {
        knoepfe.push({
            titel: t('button.save'),
            art: 'haupt',
            ausfuehren: async () => {
                const feld = (name) => document.getElementById(`feld-maske-${name}`).value.trim();

                const vorname = feld('vorname');
                const nachname = feld('nachname');
                if (!vorname || !nachname) {
                    melde(t('msg.firstLastNameRequired'), 'schlecht');
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
                melde(t('msg.customerSaved', { vorname, nachname }), 'gut');
                await kundenAufbauen();
            }
        });
    }

    if (darfRolle('kundenservice') && kunde.status === 'aktiv') {
        knoepfe.push({
            titel: t('button.block'),
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
                const ok = await bestaetige(t('msg.confirmBlockCustomer', { vorname: kunde.vorname, nachname: kunde.nachname }));
                if (!ok) return;
                const grund = await frageNachGrund(t('button.blockReason'));
                if (grund === null) return;
                await rufeAuf('api_kunde_sperren', { p_kunde_id: kunde.kunde_id, p_grund: grund });
                melde(t('msg.customerBlocked', { vorname: kunde.vorname, nachname: kunde.nachname }), 'gut');
                await kundenAufbauen();
            }
        });
    }

    if (darfRolle('kundenservice')) {
        knoepfe.push({ titel: t('button.disclosureArt15'), art: 'neben', ausfuehren: () => auskunftZeigen(kunde) });
    }

    if (darfRolle('kundenservice') && kunde.status !== 'geschlossen') {
        knoepfe.push({ titel: t('button.deletionArt17'), art: 'gefaehrlich',
                       ausfuehren: () => anonymisieren(kunde) });
    }

    zeigeMaske(`${kunde.kundennummer} · ${kunde.vorname} ${kunde.nachname}`, [
        { name: 'anrede',    titel: t('field.anrede'),    wert: kunde.anrede || '',    typ: 'text' },
        { name: 'vorname',   titel: t('field.vorname'),   wert: kunde.vorname,          typ: 'text' },
        { name: 'nachname',  titel: t('field.nachname'),  wert: kunde.nachname,         typ: 'text' },
        // WICHTIG 7: der Status hatte bisher kein eigenes Feld, nur die
        // mittelbare Zeilenfarbe in der Liste (siehe klasse-Funktion in
        // kundenAufbauen()) und die Auswahl der Knoepfe darueber. Wer
        // eine Zeile oeffnet, soll den Status direkt lesen koennen, nicht
        // aus der Abwesenheit eines Knopfes erschliessen muessen - dieselbe
        // Machart wie die uebrigen nur lesenden Feldern (typ, tarif, ...).
        { name: 'status',    titel: t('field.status'),    wert: statusAnzeige(kunde.status),          nurLesen: true },
        // E-Mail nur lesend: sie ist der Anmeldename. Sie zu aendern ist
        // eine Kontoaenderung und gehoert dem Kunden, nicht uns.
        { name: 'email',     titel: t('field.email'),    wert: kunde.email,            nurLesen: true },
        { name: 'telefon',   titel: t('field.telefon'),   wert: kunde.telefon || '',    typ: 'tel' },
        // WARUM GIBT ES KEINE ADRESSE BEI DEN KUNDEN? (Auftraggeber-Frage,
        // Gestaltungsauftrag Punkt 4): 113 von 1014 Kunden haben tatsaechlich
        // keine hinterlegt (die Fussnote der Kopftafel nennt die Zahl
        // bereits) - die vier Felder darunter waren dafuer bislang einfach
        // leer, ununterscheidbar von einem Ladefehler ("diese Verwechslung
        // hat in diesem Projekt schon mehrfach Zeit gekostet", Auftrag).
        // Nur fuer GENAU diesen Fall, nicht fuer jeden Kunden: wer eine
        // Adresse hat, sieht seine gefuellten Felder, keine ueberfluessige
        // Erklaerung obendrueber.
        ...(!kunde.strasse ? [{
            name: 'adresse_hinweis', titel: t('field.anschrift'), typ: 'mehrzeilig', nurLesen: true,
            wert: t('misc.noAddressOnFile')
        }] : []),
        { name: 'strasse',   titel: t('field.strasse'),    wert: kunde.strasse || '',    typ: 'text' },
        { name: 'hausnummer', titel: t('field.hausnummer'), wert: kunde.hausnummer || '', typ: 'text' },
        { name: 'plz',       titel: t('field.plz'),       wert: kunde.plz || '',        typ: 'text' },
        { name: 'ort',       titel: t('field.ort'),       wert: kunde.ort || '',        typ: 'text' },
        { name: 'tarif',     titel: t('field.tarif'),     wert: kunde.tarif || t('misc.noMembership'), nurLesen: true },
        // Dieselben zwei Angaben wie in der Liste (siehe kundenAufbauen()
        // oben) - hier zusaetzlich, weil die Detailmaske schon jedes
        // andere Stammdatum zeigt und "Kunde seit" sonst nur in der
        // Tabelle staende, nicht in der Maske, die man beim Nachschlagen
        // eines EINZELNEN Kunden tatsaechlich oeffnet.
        { name: 'kunde_seit', titel: t('field.kundeSeit'), wert: kundenDatumFormat(kunde.registriert_am),
          nurLesen: true },
        { name: 'letzte_ausleihe', titel: t('field.letzteAusleihe'),
          wert: kundenLetzteAusleiheFormat(kunde.letzte_ausleihe_am, kunde), nurLesen: true },
        { name: 'fahrten',   titel: t('field.fahrten'),   wert: zahlFormat(kunde.fahrten_gesamt),   nurLesen: true },
        { name: 'umsatz',    titel: t('field.umsatz'),    wert: geldFormatZentral(kunde.umsatz_brutto), nurLesen: true },
        { name: 'offen',     titel: t('field.offen'),     wert: geldFormatZentral(kunde.offener_betrag), nurLesen: true },
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
        { name: 'auskunft_hinweis', titel: t('field.hinweis'), typ: 'mehrzeilig', nurLesen: true,
          wert: t('misc.disclosureLoggedNote') }
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
    ueberschrift.textContent = t('auskunft.title', { name: `${kunde.vorname} ${kunde.nachname}` });
    dialog.append(ueberschrift);

    // Reihenfolge wie im Auftragstext (Schritt 3) benannt: stammdaten,
    // mitgliedschaften, fahrten (mit Koordinaten), rechnungen,
    // zahlungen, schadensmeldungen, freiminuten, protokoll.
    const abschnitte = [
        [t('auskunft.stammdaten'), auskunft.stammdaten],
        [t('auskunft.mitgliedschaften'), auskunft.mitgliedschaften],
        [t('auskunft.fahrten'), auskunft.fahrten],
        [t('auskunft.rechnungen'), auskunft.rechnungen],
        [t('auskunft.zahlungen'), auskunft.zahlungen],
        [t('auskunft.schadensmeldungen'), auskunft.schadensmeldungen],
        [t('auskunft.freiminuten'), auskunft.freiminuten],
        [t('auskunft.protokoll'), auskunft.protokoll]
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
    herunterladenKnopf.textContent = t('button.downloadJson');
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
    schliessenKnopf.textContent = t('button.close');
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
        melde(t('art17.runningRideBlocks', { name: `${kunde.vorname} ${kunde.nachname}` }), 'warnung');
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
        [
            t('art17.confirmHeader', { name: `${kunde.vorname} ${kunde.nachname}` }),
            t('art17.whatDisappears'),
            t('art17.whatRemains', { phrase: mengeFormat(kunde.fahrten_gesamt, 'fahrt') }),
            t('art17.whatThisDoesNotAchieve'),
            t('art17.irreversible')
        ].join('\n\n'),
        t('art17.confirmWord')   // muss eingetippt werden - siehe Bericht: bewusst unuebersetzt in jeder Sprache
    );
    if (!ok) return;

    const grund = await frageNachGrund(t('art17.reasonPrompt'));
    if (!grund) { melde(t('art17.abortedNoReason'), 'warnung'); return; }

    await rufeAuf('api_kunde_anonymisieren', { p_kunde_id: kunde.kunde_id, p_grund: grund });
    melde(t('art17.doneMessage', { nummer: kunde.kundennummer }), 'gut');
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
    zeigeMaske(t('button.newCustomer'), [
        { name: 'vorname',  titel: t('field.vorname'),  wert: '' },
        { name: 'nachname', titel: t('field.nachname'), wert: '' },
        { name: 'email',    titel: t('field.email'),   wert: '', typ: 'email' },
        { name: 'telefon',  titel: t('field.telefon'),  wert: '', typ: 'tel' }
    ], [
        {
            titel: t('button.create'),
            // 'schaffend' statt 'haupt' (Punkt 4 der Gestaltung, gruen):
            // legt einen neuen Kunden an, siehe Begruendung bei der
            // art-Erlaeuterung von zeigeMaske() in rahmen.js. Das
            // "Speichern" weiter oben in kundeMaske() (eine BESTEHENDE
            // Person aendern) bleibt bewusst bei 'haupt'.
            art: 'schaffend',
            ausfuehren: async () => {
                const feld = (name) => document.getElementById(`feld-maske-${name}`).value.trim();

                const vorname = feld('vorname');
                const nachname = feld('nachname');
                const email = feld('email');
                if (!vorname || !nachname || !email) {
                    melde(t('msg.nameEmailRequired'), 'schlecht');
                    return;
                }

                await rufeAuf('api_kunde_anlegen', {
                    p_vorname: vorname,
                    p_nachname: nachname,
                    p_email: email,
                    p_telefon: feld('telefon') || null
                });
                const quittungstext = t('msg.customerCreated', { vorname, nachname });
                melde(quittungstext, 'gut');
                await kundenAufbauen();
                await quittung(quittungstext);
            }
        }
    ]);
}
