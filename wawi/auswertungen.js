// ============================================
// VeloCity Warenwirtschaft — Auswertungen
//
// Vier Reiter, vier reine Lesesichten, keine Buchung. Anders als die
// vier Arbeitsbereiche davor gibt es hier keine Werkzeugleiste und keine
// schreibenden Knöpfe in der Detailmaske - "Auswertungen" liest, es
// bucht nicht. Die Detailmaske je Zeile bleibt trotzdem stehen (siehe
// *Maske()-Funktionen unten): wer mit Pfeiltasten durch die Liste geht,
// soll eine Zeile auch OHNE die ganze Tabellenbreite lesen können -
// derselbe Grund, aus dem Screenreader-Nutzer eine Tabelle zeilenweise,
// nicht spaltenweise erfassen.
//
// Ausschließlich die Bausteine aus rahmen.js (bereichAnmelden, ladeListe,
// letzterLadeFehler, zeigeListe, zeigeMaske, zeigeLeermaske,
// zeigeUnterreiter, melde, meldeVorgang, neuerVorgang, laufenderVorgang,
// istAktuellerVorgang, baueKachel, sparkline, zellbalken, saeulengrafik,
// zahlSkaliert, maskeVerwerfen), zaehleZeilen() aus daten.js (Aufgabe
// "analytischer" - eine reine Zaehlanfrage als Bezugsgroesse, dasselbe
// Muster wie in kunden.js/instandhaltung.js) und die eigenen Sichten
// v_wawi_umsatz_radtyp, v_wawi_umsatz_kundengruppe, v_wawi_km_co2,
// v_wawi_stationsauslastung, v_wawi_fahrten_je_tag (Drill-Down-Aufgabe),
// v_wawi_flotte (Aufgabe "analytischer" - ausschliesslich als
// Bezugsgroesse fuer "Umsatz je Rad und Tag", siehe
// umsatzRadtypZeigen()/umsatzRadtypUebersicht(); KEINE neue Sicht dafuer
// noetig, v_wawi_flotte war schon vorhanden und fuer 'leitung'
// freigegeben) - keine Basistabelle, keine fn_-Funktion. rufeAuf() taucht
// in dieser Datei bewusst nicht auf: es gibt in diesem Bereich nichts zu
// schreiben.
//
// v_wawi_fahrt_km wird bewusst NICHT gelesen (auch nicht für eine
// eigene Fahrtenliste): sie führt Einzelfahrten mit kunde_id und
// Zeitstempel, also ein Bewegungsprofil - genau das, dessen Fernhalten
// die Spezifikation zum Lehrpunkt macht (siehe Kopfkommentar der Sicht
// in 0018_wawi_sichten.sql und der Auftragstext dieser Aufgabe).
// v_wawi_km_co2 liefert schon die richtige, aggregierte Ebene.
// ============================================

// Navigations-Icon (Gestaltungsauftrag, Punkt 3): drei ansteigende
// Balken - dieselbe Bissantz-Sprache wie die Balken/Sparklines dieses
// Bereichs selbst, dieselbe Strichfamilie wie die vier anderen
// Bereichs-Icons (siehe .bereich-icon in style.css).
const ICON_AUSWERTUNGEN = '<svg viewBox="0 0 24 24"><path d="M6 19v-6M12 19V6M18 19v-9"/></svg>';

bereichAnmelden({
    schluessel: 'auswertungen',
    titelSchluessel: 'nav.auswertungen',
    icon: ICON_AUSWERTUNGEN,
    // Nur die Leitung. v_wawi_stationsauslastung lässt zusätzlich
    // disposition durch (0018_wawi_sichten.sql, "hat_rolle('disposition')
    // or hat_rolle('leitung')") - die drei anderen Sichten filtern
    // ausschließlich auf 'leitung'. Diese Datei zeigt trotzdem alle vier
    // Reiter nur der Leitung: die Disposition bekommt die
    // Stationsauslastung im Bereich Stationen (Aufgabe 5), nicht hier -
    // ein zweiter Zugang zu denselben Zahlen unter anderem Namen wäre
    // keine Vereinfachung. Genau umgekehrt zu dem Fund, der gerade in
    // kunden.js geprüft wurde (Bereich für zwei Rollen sichtbar, aber
    // nur eine der beiden von den dahinterliegenden Funktionen
    // akzeptiert): hier ist der Bereich ENGER als die Sicht erlaubt, mit
    // Absicht und aus einem im Kommentar der Sicht selbst genannten Grund.
    //
    // 'demo' (0020_demo_zugang.sql) kommt dazu: alle vier zugrundeliegenden
    // Sichten lassen sie inzwischen zu. v_wawi_km_co2 (erste Runde: NOCH
    // NICHT, weil sie damals FROM v_wawi_fahrt_km las, deren eigene
    // Schranke nur 'leitung' zulaesst) wurde in der zweiten Demozugang-
    // Runde von v_wawi_fahrt_km entkoppelt und traegt seither ihre
    // eigene, unabhaengige Schranke fuer 'leitung' UND 'demo' (siehe
    // deren Kommentar in 0018_wawi_sichten.sql) - alle vier Reiter sind
    // damit fuer 'demo' inzwischen gleich weit offen wie fuer 'leitung',
    // kein Reiter muss mehr eigens ausgeblendet werden.
    rollen: ['leitung', 'demo'],
    aufbauen: auswertungenAufbauen,
    // EINE SUCHE, IN JEDEM BEREICH (Gestaltungsauftrag Punkt 5) - siehe
    // spaltenkopfSuchtext in rahmen.js. Alle vier Reiter laden ihre
    // Zeilen vollstaendig; gesucht wird ueber den ANGEZEIGTEN Text
    // mit ("Sep 2025", "2.011,20 €"), nicht nur ueber den rohen Wert -
    // sonst faende man in dieser Tabelle nichts, was man liest.
    suchePlatzhalterSchluessel: 'nav.auswertungenSuche'
});

// NICHT "unterbereich" genannt, obwohl es fachlich dasselbe wäre:
// instandhaltung.js deklariert bereits ein globales "let unterbereich" -
// alle wawi/*.js-Dateien teilen sich, weil sie ganz ohne Module und ohne
// Bündelwerkzeug über <script>-Tags geladen werden (globale
// Randbedingung dieser Aufgabe), EINEN einzigen Gültigkeitsbereich. Ein
// zweites "let unterbereich" hier wäre kein stiller Bug, sondern ein
// SyntaxError beim Laden dieser Datei ("Identifier 'unterbereich' has
// already been declared") - das ganze Skript liefe gar nicht erst an,
// bereichAnmelden() würde nie aufgerufen, und der Menüpunkt
// "Auswertungen" bliebe spurlos unsichtbar. Genau das im Browser
// nachgestellt und bestätigt (siehe Bericht), deshalb hier der
// bereichseigene Name.
let auswertungenReiter = 'umsatz_radtyp';   // 'umsatz_radtyp' | 'umsatz_kundengruppe' | 'km_co2' | 'stationsauslastung'

async function auswertungenAufbauen() {
    // ALLERERSTE Anweisung, vor jedem await - siehe Kommentar bei
    // neuerVorgang() in rahmen.js. Ein Reiterwechsel UND ein
    // Bereichswechsel lösen beide einen neuen Vorgang aus; ein
    // veralteter darf weder die Liste noch die Statuszeile mehr
    // beschreiben.
    const vorgang = neuerVorgang();

    // Alle vier Reiter, ohne Ausnahme: seit v_wawi_km_co2 von
    // v_wawi_fahrt_km entkoppelt ist (zweite Demozugang-Runde), lassen
    // alle vier zugrundeliegenden Sichten dieselben zwei Rollen zu -
    // ['leitung', 'demo'], siehe bereichAnmelden() oben. Der fruehere
    // Filter, der den Reiter "Kilometer und CO2" eigens fuer 'demo'
    // ausblendete (v_wawi_km_co2 lieferte damals fuer 'demo' null
    // Zeilen), ist damit ueberfluessig geworden und entfaellt - eine
    // Bedingung, die nie mehr falsch werden kann, ist kein Filter mehr,
    // nur noch totes Gewicht.
    const reiter = [
        { schluessel: 'umsatz_radtyp',       titel: t('tab.revenueByBikeType') },
        { schluessel: 'umsatz_kundengruppe', titel: t('tab.revenueByCustomerGroup') },
        { schluessel: 'km_co2',              titel: t('tab.kmCo2') },
        { schluessel: 'stationsauslastung',  titel: t('tab.stationOccupancy') }
    ];

    // Verbleibt als reine Vorsichtsmassnahme, auch ohne den obigen
    // Filter: sollte eine kuenftige Rollenaenderung doch wieder einen
    // Reiter verschwinden lassen, faellt ein noch darauf stehender
    // auswertungenReiter (etwa nach einem Bereichswechsel mit
    // veralteter Auswahl) auf den ersten verbliebenen Reiter zurueck,
    // statt eine Tafel zu einem Reiter zu zeigen, den die Kopfzeile gar
    // nicht mehr anbietet.
    if (!reiter.some((r) => r.schluessel === auswertungenReiter)) {
        auswertungenReiter = reiter[0].schluessel;
    }

    zeigeUnterreiter(vorgang, reiter, auswertungenReiter, async (gewaehlt) => {
        auswertungenReiter = gewaehlt;
        // Dieselbe Begründung wie in instandhaltung.js: ohne dies
        // bliebe die Detailmaske des VORHERIGEN Reiters stehen - eine
        // Monatszeile aus "Umsatz nach Radtyp", wo jetzt "Kilometer und
        // CO2" zu sehen ist.
        maskeVerwerfen();
        await auswertungenAufbauen();
    });

    switch (auswertungenReiter) {
        case 'umsatz_radtyp':       await umsatzRadtypZeigen(vorgang); break;
        case 'umsatz_kundengruppe': await umsatzKundengruppeZeigen(vorgang); break;
        case 'km_co2':              await kmCo2Zeigen(vorgang); break;
        case 'stationsauslastung':  await stationsauslastungZeigen(vorgang); break;
    }
}

// ===== Zahlenformat (Mehrsprachigkeit, Fallstrick 2) =====
//
// zahlFormat() selbst kommt jetzt aus rahmen.js (dort locale-aware, siehe
// UEBERSETZUNGEN-Kopfkommentar) - eine eigene, gleichnamige Funktion HIER
// haette die globale aus rahmen.js in DEMSELBEN, ungemodulten
// Namensraum ueberschrieben (alle neun Skripte teilen sich einen
// einzigen globalen Gueltigkeitsbereich, siehe Dateikopf), und zwar fuer
// ALLE fuenf Bereiche, nicht nur fuer diese Datei - genau der
// NAMENSRAUM-Fehler, vor dem tools/wawi_check.py warnt. Die uebrigen
// Formatierer bleiben lokal (nur hier gebraucht), rufen aber jetzt
// zahlFormat()/geldFormatZentral() aus rahmen.js auf statt selbst fest
// 'de-DE' zu waehlen - fuer einen englischen Nutzer muss "35.454,47 €"
// zu "35,454.47 €" werden (Auftrag, woertlich). Die Waehrung bleibt der
// Euro (Auftrag: "das ist keine Sprachfrage") - nur die Formatierung
// folgt der Sprache.
function geldFormat(betrag) {
    return geldFormatZentral(betrag);
}

function kmFormat(km) {
    return `${zahlFormat(km, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km`;
}

function kgFormat(kg) {
    return `${zahlFormat(kg, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg`;
}

function prozentFormat(anteil) {
    return `${zahlFormat(Math.round(anteil * 100))} %`;
}

// Eine Nachkommastelle statt gerundeter ganzer Prozent - fuer die Stellen,
// an denen ZWEI nah beieinanderliegende Anteile GEGENEINANDER gestellt
// werden (die Fussnote der Kilometer-Tafel: fahrtgewichteter Schaetzanteil
// gegen das blosse Mittel der Monatsanteile, 40,0 % gegen 40,2 % im
// Zwoelf-Monats-Fenster und 40,1 % gegen 53,2 % ueber alle geladenen
// Monate). Ohne die Nachkommastelle saehen die beiden ersten nach Rundung
// gleich aus, und die Gegenprobe verlöre genau die Aussage, wegen der sie
// dasteht. Die Tabellenspalten selbst bleiben bei der groeberen
// prozentFormat(), die reicht dort aus.
function prozentFormatFein(anteil) {
    return `${zahlFormat(anteil * 100, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;
}


// Eine Nachkommastelle, ohne Einheit - fuer die drei neuen "je"-Spalten
// unten (Minuten je Fahrt, Kilometer je Fahrt, Fahrten je Kunde), deren
// Werte oft zwischen 5 und 60 liegen: zahlFormat() rundet auf ganze
// Zahlen und verschluckte dort echte Unterschiede (19,2 vs. 19,4 Minuten
// saehen beide als "19" aus), kgFormat()/geldFormat() bringen eine
// Einheit mit, die hier falsch waere. minutenFormat() haengt "min" an
// denselben Zahlkern, statt eine dritte, fast identische Funktion zu
// schreiben.
function zahlFormatFein(zahl) {
    return zahlFormat(zahl, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function minutenFormat(minuten) {
    return `${zahlFormatFein(minuten)} min`;
}

// monat kommt als Datumstext des Monatsersten ('2026-03-01' o.ae.) über
// PostgREST herein - date_trunc('month', ...)::date in der Sicht. Eine
// Anzeige als "Mär 2026" macht den Jahresgang und den Tarifwechsel zum
// 1. März auf den ersten Blick lesbar, ein rohes ISO-Datum nicht.
//
// MEHRSPRACHIGKEIT (Fallstrick 2, Monats-/Wochentagsnamen): Deutsch
// behaelt die eigene, seit jeher hier gepflegte Kurzform OHNE
// Punkte ("Okt", nicht "Okt.") - Zug 1 dieses Auftrags verlangt, dass
// Deutsch nach dem Umbau GENAU wie vorher aussieht, und
// Intl.DateTimeFormat('de-DE', {month:'short'}) liefert nachweislich
// "Okt." MIT Punkt (im Browser/Node geprueft) - ein spuerbarer
// Unterschied in einer eng bemessenen Tabellenspalte. Fuer die anderen
// fuenf Sprachen gibt es dagegen KEINE vorbestehende Kurzform zu
// bewahren - dort uebernimmt Intl.DateTimeFormat die vollstaendige,
// jeweils korrekte Kurzform (Reihenfolge, Punktsetzung, Sprache), statt
// sie von Hand nachzubauen.
const MONATSNAMEN_DE = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
const MONATSNAMEN_VOLL_DE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August',
    'September', 'Oktober', 'November', 'Dezember'];
const WOCHENTAGE_KURZ_DE = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

// jahr/monatsnummerEins (1-12) statt eines fertigen Date, weil alle
// Aufrufer diese beiden Teile ohnehin schon aus einem ISO-Text zerlegt
// haben (siehe monatFormat()/tagFormat() unten) - ein zweites Zerlegen
// waere nur Wiederholung.
function monatKurzName(jahr, monatsnummerEins) {
    if (sprache() === 'de') return MONATSNAMEN_DE[monatsnummerEins - 1];
    return new Intl.DateTimeFormat(localeTag(), { month: 'short' }).format(new Date(jahr, monatsnummerEins - 1, 1));
}

function monatFormat(monat) {
    const [jahr, monatsnummer] = monat.split('-').map(Number);
    return `${monatKurzName(jahr, monatsnummer)} ${jahr}`;
}

// Ausgeschrieben, nur für den Drill-Down (monatsdrilldownEinfuegen()
// weiter unten): der Auftrag selbst formuliert seine Referenzzahlen mit
// dem vollen Monatsnamen ("der 4. September mit 61 Fahrten"), nicht der
// dreibuchstabigen Kurzform, die monatFormat() für die Tabellenspalte
// verwendet.
function monatVollName(jahr, monatsnummerEins) {
    if (sprache() === 'de') return MONATSNAMEN_VOLL_DE[monatsnummerEins - 1];
    return new Intl.DateTimeFormat(localeTag(), { month: 'long' }).format(new Date(jahr, monatsnummerEins - 1, 1));
}

// ===== Datumsformat der Tagestabelle (Gestaltungsauftrag Punkt 2a) =====
//
// "Nicht 1., 2., 3. Tag, sondern schon das Datum, mit Wochentag" -
// wörtlich der Auftrag, samt Begründung: "Sa, 4. Okt 2025" erklärt einen
// Ausschlag, den "4." nicht erklärt, weil der Jahresgang dieser Daten
// einen Wochenrhythmus trägt (Wochenenden fahren anders als Werktage).
//
// tag kommt als ISO-Datumstext ('2025-10-04') herein. new Date(tag) läse
// das als UTC-Mitternacht und könnte je nach Zeitzone des Browsers einen
// Tag zurück- oder vorspringen - derselbe Fallstrick, den die
// Monatsrandberechnung in monatsdrilldownEinfuegen() weiter unten schon
// vermeidet. Deshalb hier wie dort in die drei Zahlanteile zerlegt und
// über new Date(jahr, monat, tag) mit LOKALEN Zeitkomponenten gebaut -
// keine ISO-Zeitzonenkonvertierung im Spiel, getDay() liefert exakt den
// Wochentag des gemeinten Kalendertags.
function wochentagKurzName(datum) {
    if (sprache() === 'de') return WOCHENTAGE_KURZ_DE[datum.getDay()];
    return new Intl.DateTimeFormat(localeTag(), { weekday: 'short' }).format(datum);
}

// Kalenderkopf beginnt am Montag (ISO 8601, in jeder der sechs Sprachen
// gleich ueblich) - Index 0 = Montag ... 6 = Sonntag, anders als
// getDay() (0 = Sonntag). Verwendet von monatsdrilldownEinfuegen() weiter
// unten für die Spaltenköpfe des Monatskalenders.
function wochentageMoZuerst() {
    // 1. Januar 2024 war ein Montag - beliebiger, aber bewusst gewaehlter
    // Ankerpunkt, um sieben aufeinanderfolgende Wochentagsnamen ab Montag
    // zu gewinnen, ohne sie fuer jede Sprache von Hand einzutragen.
    return [0, 1, 2, 3, 4, 5, 6].map((i) => wochentagKurzName(new Date(2024, 0, 1 + i)));
}

function tagFormat(tag) {
    const [jahr, monat, tagNummer] = tag.split('-').map(Number);
    const wochentag = wochentagKurzName(new Date(jahr, monat - 1, tagNummer));
    return `${wochentag}, ${tagNummer}. ${monatKurzName(jahr, monat)} ${jahr}`;
}

// Rechtsbündige Zahlenspalte, optional mit einer zweiten Klasse für
// Bedeutung (schlecht/warnung/gut) - siehe Kommentar bei
// ".arbeitstabelle td.zahl" in style.css. zeigeListe() in rahmen.js setzt
// spalte.klasse als EINEN Klassennamen-String (td.className = klasse),
// deshalb hier zusammengesetzt statt als zwei getrennte Klassen erwartet.
function zahlKlasse(zusatz = '') {
    return zusatz ? `zahl ${zusatz}` : 'zahl';
}




// Untergrenze für "echten Betrieb" statt eines Testmonats mit ein oder
// zwei Fahrten: die ersten Monate im Bestand (Januar-Juni 2025) tragen
// einzelne Testfahrten, deren Umsatz je Fahrt zwischen zwei Monaten um
// zweistellige Prozentsätze schwankt, OHNE dass irgendetwas fachlich
// passiert wäre - reiner Zufall bei sehr kleiner Stichprobe. Ohne diese
// Schwelle fände groessterSprung() (siehe unten) den größten AUSSCHLAG,
// nicht den größten FUND - dieselbe Art Fehler, den anteilGewichtet()
// oben für den Schätzanteil schon vermeidet: eine ungewichtete Kennzahl
// auf zu kleiner Grundlage sieht dramatischer aus, als sie ist. Gegen die
// Daten geprüft (siehe Bericht): 30 trennt die Testmonate (höchstens 8
// Fahrten) sauber vom Betrieb ab (mindestens 117 Fahrten je Monat/Typ).
const MINDEST_FAHRTEN_JE_MONAT = 30;

// Größter relativer Sprung zwischen zwei aufeinanderfolgenden Elementen
// einer bereits nach Datum sortierten Reihe, unabhängig davon, welches
// Feld verglichen wird - liefert null ohne mindestens zwei Elemente mit
// einem von null verschiedenen Vorgängerwert.
function groessterSprung(zeitreiheAufsteigend, feld) {
    let ergebnis = null;
    for (let i = 1; i < zeitreiheAufsteigend.length; i++) {
        const vorherigerWert = zeitreiheAufsteigend[i - 1][feld];
        const wert = zeitreiheAufsteigend[i][feld];
        if (!vorherigerWert) continue;
        const veraenderung = (wert - vorherigerWert) / vorherigerWert;
        if (!ergebnis || Math.abs(veraenderung) > Math.abs(ergebnis.veraenderung)) {
            ergebnis = { index: i, monat: zeitreiheAufsteigend[i].monat, vorherigerWert, wert, veraenderung };
        }
    }
    return ergebnis;
}

// Veränderung ggü. Vormonat als Text - null (erster Monat eines Radtyps,
// kein Vormonat zum Vergleichen) wird als Gedankenstrich ausgewiesen,
// nicht als leere Zelle: eine leere Zelle sieht wie ein Ladefehler aus,
// ein Gedankenstrich sagt "hier gibt es strukturell nichts zu vergleichen".
function veraenderungFormat(veraenderung) {
    if (veraenderung === null) return '—';
    const vorzeichen = veraenderung > 0 ? '+' : '';
    return `${vorzeichen}${zahlFormat(veraenderung * 100, { maximumFractionDigits: 1 })} %`;
}


// Schwelle, ab der eine Veränderung in der Tabelle hervorgehoben wird -
// bewusst nur per Fettung (Tufte: Ink nur, wo sie etwas bedeutet), NICHT
// per Farbe: ein Preisanstieg ist nicht per se "gut" oder "schlecht" wie
// eine volle Station oder ein negativer Saldo, nur bemerkenswert. Rot
// (siehe --rot in style.css, 4.41:1 auf Weiß - siehe Bericht) läge für
// Fließtext ohnehin unter der hier verlangten 4.5:1-Untergrenze.
const AUFFAELLIGKEITS_SCHWELLE = 0.15;
function istAuffaellig(zeile, feld) {
    const veraenderung = zeile[feld];
    return veraenderung !== null && Math.abs(veraenderung) >= AUFFAELLIGKEITS_SCHWELLE
        && zeile.fahrten >= MINDEST_FAHRTEN_JE_MONAT && zeile.vorherigeFahrten >= MINDEST_FAHRTEN_JE_MONAT;
}

// ===== Der Fehler aus Schritt 2 des Auftrags, korrigiert =====
//
// anteilGewichtet() ist wörtlich aus dem Auftrag übernommen - sie ist
// richtig. co2Zelle() dagegen war es NICHT in ihrer ersten Fassung: der
// Auftrag baute sie mit einem eingebetteten <span class="leise">...</span>
// und einem Rückgabewert, der als Zellinhalt gedacht war. zeigeListe() in
// rahmen.js setzte Zellinhalte damals ausschließlich über td.textContent -
// nie über innerHTML. Ein <span> wäre dort wortwörtlich als Text
// erschienen ("6611.95 kg <span class="leise">(40 % geschätzt)</span>"),
// nicht als graue Klammer. Die damalige Entscheidung war deshalb: OHNE
// Auszeichnung, reiner Text, mit dem grauen Ton als bewusst hingenommenem
// Verlust.
//
// Diese Gestaltungsaufgabe hat den Grund für den Verzicht beseitigt:
// zeigeListe() akzeptiert seit der Erweiterung dort auch ein Element
// statt eines Strings (siehe Kommentar an der Zellbau-Stelle in
// rahmen.js). Die Fußnoten-Frage bleibt trotzdem der fachliche Kern:
// co2ZelleElement() unten setzt den Schätzanteil deshalb WEITERHIN direkt
// neben die Zahl, nicht in einer eigenen Spalte oder einer Fußnote - nur
// die graue Klammer ist jetzt echt grau statt nur behauptet.
//
// co2ZelleText() bleibt daneben bestehen: kmCo2Maske() unten befüllt ein
// <input readOnly>, dessen .value ausschließlich einen String annimmt -
// ein Element wäre dort so falsch, wie es vorher in der Tabellenzelle war.
function co2ZelleText(zeile) {
    return kgFormat(zeile.co2_ersparnis_kg) + t('misc.estimatedParen', { prozent: prozentFormat(zeile.anteil_geschaetzt) });
}

function co2ZelleElement(zeile) {
    const wrapper = document.createElement('span');
    wrapper.append(zahlSkaliert(kgFormat(zeile.co2_ersparnis_kg)));
    const hinweis = document.createElement('span');
    hinweis.className = 'zahl-zusatz';
    hinweis.textContent = t('misc.estimatedParen', { prozent: prozentFormat(zeile.anteil_geschaetzt) });
    wrapper.append(hinweis);
    return wrapper;
}

// v_wawi_km_co2 liefert anteil_geschaetzt JE ZEILE. Wer die Spalte über
// Monate/Radtypen mittelt, bekommt 0,532 (siehe Bericht, gegen die
// Datenbank gemessen) - der tatsächliche, fahrtgewichtete Anteil liegt
// bei 0,400, dreizehn Prozentpunkte darunter, weil die Zeilen sehr
// unterschiedlich viele Fahrten tragen (1 bis über 1000 je Monat/Typ).
// Deshalb hier über die absoluten Zähler summiert und erst danach
// geteilt, nicht über den Anteil selbst gemittelt.
function anteilGewichtet(zeilen) {
    const fahrten    = zeilen.reduce((s, z) => s + z.fahrten, 0);
    const geschaetzt = zeilen.reduce((s, z) => s + z.fahrten_geschaetzt, 0);
    return fahrten ? geschaetzt / fahrten : 0;
}

// ===== Drill-Down: Tage eines angeklickten Monats =====
//
// EINMAL hier statt dreimal in den drei *Maske()-Funktionen weiter unten
// (Umsatz nach Radtyp/Kundengruppe, Kilometer und CO2 - alle drei
// zeigen Monatszeilen und rufen deshalb dieselbe Funktion aus ihrer
// eigenen *Maske() heraus auf).
//
// Zeigt IMMER die Tagessumme ÜBER ALLE Radtypen UND Tarife, unabhängig
// davon, welche Zeile (welcher Radtyp/Tarif) angeklickt wurde: der
// Auftrag beschreibt den Drill-Down als Eigenschaft des MONATS ("ich
// klicke auf den Monat ... und bekomme eine Säulengrafik"), nicht der
// Kombination aus Monat und Radtyp/Tarif - und v_wawi_fahrten_je_tag
// führt bewusst keine solche Aufteilung (siehe deren Kommentar in
// 0018_wawi_sichten.sql). Die Überschrift sagt "gesamt" deshalb
// ausdrücklich dazu, damit niemand die Tageszahlen für "nur diese eine
// Zeile" hält - "alle Radtypen" allein wäre dafür sogar irreführend: in
// der Kundengruppe-Maske ist die angeklickte Zeile nach TARIF
// unterschieden, nicht nach Radtyp, und "alle Radtypen" spräche dort die
// eigentlich fehlende Aufteilung gar nicht an.
//
// Wettlaufschutz nach demselben Muster wie ladeZaehler in daten.js:
// klickt jemand schnell zwei Zeilen hintereinander, bevor die erste
// Tagesabfrage zurück ist, darf die SPÄTER gestartete, aber FRÜHER
// zurückkommende Abfrage nicht von der langsameren überschrieben werden
// - und die langsamere darf nicht mehr an die inzwischen für eine ANDERE
// Zeile neu aufgebaute Maske andocken. istAktuellerVorgang() allein
// reicht dafür nicht: ein Bereichs-/Reiterwechsel ändert den Vorgang,
// aber zwei Klicks auf zwei verschiedene Monatszeilen IM SELBEN Reiter
// bleiben derselbe Vorgang.
let drilldownZaehler = 0;

async function monatsdrilldownEinfuegen(monat) {
    // Kennung des Bereichs-Vorgangs, der lief, als die Zeile ausgewählt
    // wurde - dasselbe Muster wie laufenderVorgang() bei radAnlegenMaske()
    // in flotte.js: diese Funktion ist selbst kein *Aufbauen()-Vorgang
    // und darf keinen eigenen über neuerVorgang() ziehen.
    const vorgang = laufenderVorgang();
    const eigenerZaehler = ++drilldownZaehler;

    const [jahr, monatsnummerText] = monat.split('-');
    const monatsnummer = Number(monatsnummerText);
    const naechsterMonat = monatsnummer === 12
        ? `${Number(jahr) + 1}-01-01`
        : `${jahr}-${String(monatsnummer + 1).padStart(2, '0')}-01`;
    // new Date(jahr, monatsnummer, 0): monatsnummer ist 1-basiert (9 für
    // September), JS-Date-Monate sind 0-basiert (9 = Oktober) - Tag 0
    // des so gebildeten Monats ist deshalb der LETZTE Tag des
    // eigentlich gemeinten Monats. Rechnet mit den lokalen
    // Datumsanteilen, keinem ISO-String - keine Zeitzonenverschiebung
    // möglich, die hier eine falsche Tageszahl einschmuggeln könnte.
    const tageImMonat = new Date(Number(jahr), monatsnummer, 0).getDate();

    const zeilen = await ladeListe('v_wawi_fahrten_je_tag', 'tag, fahrten, umsatz',
        (q) => q.gte('tag', `${monat}`).lt('tag', naechsterMonat).order('tag'));

    // Bereich/Reiter gewechselt ODER eine neuere Zeile ausgewählt,
    // während diese Abfrage unterwegs war - dann gehört weder ein
    // Fehler noch die Grafik selbst noch zur Gegenwart (Muster wie bei
    // meldeVorgang() in rahmen.js, Befund 2 dort).
    if (!istAktuellerVorgang(vorgang) || eigenerZaehler !== drilldownZaehler) return;

    const wurzel = document.getElementById('detailmaske');
    if (!wurzel) return;

    const abschnitt = document.createElement('section');
    abschnitt.className = 'monatsdrilldown';
    const ueberschrift = document.createElement('h3');
    ueberschrift.textContent = t('hint.ridesPerDayHeading', { monat: monatFormat(monat) });
    abschnitt.append(ueberschrift);

    const fehler = letzterLadeFehler('v_wawi_fahrten_je_tag');
    if (fehler) {
        const hinweis = document.createElement('p');
        hinweis.className = 'monatsdrilldown-fehler';
        hinweis.textContent = t('msg.dailyFiguresLoadFailed', { fehler });
        abschnitt.append(hinweis);
        wurzel.append(abschnitt);
        return;
    }

    // Tagesarray LÜCKENLOS über alle Kalendertage des Monats - ein Tag
    // ohne Betrieb liefert keine Zeile aus der Sicht (siehe deren
    // Kommentar in 0018_wawi_sichten.sql), ist aber null Fahrten, keine
    // fehlende Säule. Eine ausgelassene Kategorie sähe in der Grafik wie
    // ein Ladefehler aus (Auftrag, ausdrücklich benannt).
    const tage = Array.from({ length: tageImMonat }, (_, i) => i + 1);
    const fahrtenNachTag = new Map(zeilen.map((z) => [Number(z.tag.slice(8, 10)), z.fahrten]));
    const werte = tage.map((tag) => fahrtenNachTag.get(tag) ?? 0);
    // Tagesumsatz parallel zu den Fahrten (30.08.2026, Auftrag: "Ich zeige
    // auf einen Tag, es wird der Tagesgesamtumsatz gezeigt; auch bei dem
    // Säulendiagramm"). NICHT in werte[] hineingerechnet: die Säulenhöhe
    // und die Farbstufe des Kalenders bleiben die FAHRTEN - zwei Größen in
    // einer Fläche wären nicht mehr ablesbar. Der Umsatz kommt nur im
    // Hinweisfenster dazu.
    // undefined statt 0 fuer einen Tag ohne Zeile: er hatte keinen
    // Betrieb, sein Umsatz ist nicht "null Euro", sondern gar keiner -
    // die Beschriftung laesst ihn dann weg.
    const umsatzNachTag = new Map(zeilen
        .filter((z) => z.umsatz !== null && z.umsatz !== undefined)
        .map((z) => [Number(z.tag.slice(8, 10)), Number(z.umsatz)]));
    const umsaetze = tage.map((tag) => umsatzNachTag.get(tag));

    // Ein Text fuer beide Orte - Kalenderkachel und Saeule zeigen denselben
    // Tag, also darf sich ihre Auskunft nicht unterscheiden.
    function tagHinweis(index) {
        const datum = `${tage[index]}. ${monatNameVoll}`;
        const fahrtenText = mengeFormat(werte[index], 'fahrt');
        const umsatz = umsaetze[index];
        return umsatz === undefined
            ? `${datum}: ${fahrtenText}`
            : t('hint.dayRidesRevenue', { datum, phrase: fahrtenText, umsatz: geldFormat(umsatz) });
    }

    const gesamt = werte.reduce((s, w) => s + w, 0);
    const minimum = Math.min(...werte);
    const maximum = Math.max(...werte);
    // Fallstrick aus dem Auftrag, wörtlich: "Wenn zwei Tage denselben
    // Höchstwert haben, gibt es zwei Spitzentage." Deshalb ALLE Indizes
    // mit dem Maximalwert sammeln, nicht nur den ersten gefundenen -
    // dieselbe Entscheidung für das Minimum, aus Konsistenz.
    const minTage    = tage.filter((_, i) => werte[i] === minimum);
    const maxIndizes = tage.map((_, i) => i).filter((i) => werte[i] === maximum);
    const maxTage    = maxIndizes.map((i) => tage[i]);

    const monatNameVoll = monatVollName(Number(jahr), monatsnummer);
    // Deutsch behaelt die eigene Aufzaehlungsform ("4. und 7.", mit
    // Punkt je Zahl) exakt wie vorher (Zug 1) - fuer die anderen fuenf
    // Sprachen ein einfacher, sprachueblicher Aufzaehlungssatz mit dem
    // jeweiligen Wort fuer "und" (common.and), ohne den deutschen
    // Ordnungspunkt, der dort keine Entsprechung hat.
    const tageListe = (liste) => {
        if (sprache() === 'de') {
            return liste.length > 1
                ? `${liste.slice(0, -1).join('., ')}. und ${liste[liste.length - 1]}.`
                : `${liste[0]}.`;
        }
        return liste.length > 1
            ? `${liste.slice(0, -1).join(', ')} ${t('common.and')} ${liste[liste.length - 1]}`
            : `${liste[0]}`;
    };
    // mengeFormat('fahrt', n) statt einer eigenen fahrtenWort()-Funktion
    // (Fallstrick 1): "1 Fahrt", nicht "1 Fahrten" - ein Monat mit nur
    // ein bis zwei Fahrten insgesamt (Januar 2025 im Referenzjahr) trifft
    // diesen Fall wirklich, kein theoretisches Beispiel - und Polnisch/
    // Tuerkisch brauchen dieselbe Zahl in eigenen Formen (siehe
    // MENGENFORMEN in rahmen.js).
    const maxPhrase = mengeFormat(maximum, 'fahrt');

    const grafik = saeulengrafik(werte, tage.map((t) => `${t}. ${monatNameVoll}`), {
        beschriftung: t('hint.dailyRidesChartAria', {
            monat: monatNameVoll, jahr: zahlFormat(Number(jahr), { useGrouping: false }),
            min: zahlFormat(minimum), maxPhrase, mittel: zahlFormat(Math.round(gesamt / tage.length)),
            tageListe: tageListe(maxTage)
        }),
        markierIndizes: maxIndizes,
        // Hinweis JE SAEULE statt des Vorgabetexts "Tag: Zahl" - derselbe
        // Wortlaut wie auf der Kalenderkachel darunter.
        titelJeIndex: (i) => tagHinweis(i)
    });
    abschnitt.append(grafik);

    // ===== Zusammenfassung (Auftrag, wörtlich: Min, Max, Anzahl pro
    // Monat, Tag mit den meisten Fahrten) - dieselben Kacheln wie im
    // Übersichtsstreifen oben (baueKachel() in rahmen.js), nur in einem
    // 2x2-Raster statt einer Reihe (siehe .monatsdrilldown-kacheln in
    // style.css: die Detailmaske ist schmaler als #arbeitsliste). =====
    const kacheln = document.createElement('div');
    kacheln.className = 'monatsdrilldown-kacheln';
    kacheln.append(
        baueKachel({
            titel: t('tile.minimum'),
            wert: zahlSkaliert(zahlFormat(minimum)),
            hinweis: `${tageListe(minTage)} ${monatNameVoll}`
        }),
        baueKachel({
            titel: t('tile.maximum'),
            wert: zahlSkaliert(zahlFormat(maximum)),
            hinweis: `${tageListe(maxTage)} ${monatNameVoll}`
        }),
        baueKachel({
            titel: t('tile.countPerMonth'),
            wert: zahlSkaliert(zahlFormat(gesamt)),
            hinweis: t('hint.totalForMonth', { phrase: monatFormat(monat) })
        }),
        baueKachel({
            titel: t('tile.dayWithMostRides'),
            wert: `${tageListe(maxTage)} ${monatNameVoll}`,
            hinweis: maxTage.length > 1
                ? t('hint.tiedDaysCount', { tagePhrase: mengeFormat(maxTage.length, 'tag'), phrase: maxPhrase })
                : maxPhrase
        })
    );
    abschnitt.append(kacheln);

    // ===== Kalender statt Tagesliste (Gestaltungsauftrag, wörtlich: "wir
    // bauen statt der Tagesliste eine Kalendersicht und wenn ich auf eine
    // Kachel im Kalender klicke kommen unten die Einzeldaten") =====
    //
    // EIN KALENDER IST EINE TABELLE (Auftrag, als Antwort auf den selbst
    // benannten Fallstrick "eine Tabelle ist für einen Screenreader gut
    // lesbar, ein Kalender aus <div>-Kacheln wäre es nicht"): Wochentage
    // als Spaltenköpfe (<th scope="col">), Wochen als Zeilen - dieselbe
    // <table>/<caption>/<th>-Grundlage wie die frühere Tagesliste, nur zu
    // sieben Spalten umgruppiert statt einer einzigen Datumsspalte. Die
    // Barrierefreiheit entsteht damit aus der Struktur selbst, nicht aus
    // einer nachträglichen ARIA-Reparatur.
    //
    // ZAHL UND FARBE, NICHT NUR FARBE (Auftrag, wörtlich: "ein Kalender,
    // der Werte nur über Farbintensität zeigt, zwingt zum Schätzen"):
    // jede Kachel zeigt Tag UND Fahrtenzahl als Text (siehe
    // .monatskalender-tag-nummer/-wert weiter unten), die Färbung TRITT
    // HINZU, ersetzt den Text nirgends.
    //
    // FÜNF STUFEN, RELATIV ZUM MONATSHÖCHSTWERT - derselbe Bezug wie die
    // Säulengrafik direkt darüber, die ebenfalls auf `maximum` skaliert
    // ist: 0 Fahrten bleibt ungefärbt (Weiß), eine gefärbte Nullfläche
    // wäre eine Behauptung über nichts. Die vier ÜBRIGEN Stufen sind
    // ceil(wert / maximum * 4) - vier Anteile von je 25 Prozentpunkten
    // des Höchstwerts (>0-25 %, >25-50 %, >50-75 %, >75-100 %). Dieselben
    // vier Grenzen benennt die Legende weiter unten wortgleich als
    // Prozentanteile, keine zweite, unabhängige Ableitung - und ein
    // PROZENTANTEIL statt fester Fahrtenzahlen, weil die vier Stufen
    // selbst für jeden Monat unverändert gelten, ein absoluter Grenzwert
    // aber nur für DIESEN einen Monat richtig wäre.
    //
    // FARBEN GEMESSEN (Auftrag: "Kontrast ... messen" gilt auch für eine
    // Farbskala, nicht nur für Fließtext): vier Töne auf der
    // Marine-Skala (--marine gemischt mit Weiß), keine vier neuen,
    // unvermessenen Farben - siehe .monatskalender-stufe-* in style.css
    // für die genauen Werte und denselben Kontrast-Nachweis ein zweites
    // Mal am Ort der Definition.
    const stufeVonWert = (wert) => (wert === 0 ? 0 : Math.min(4, Math.ceil((wert / maximum) * 4)));

    const kalender = document.createElement('table');
    kalender.className = 'monatskalender';
    const kalenderBeschriftung = document.createElement('caption');
    kalenderBeschriftung.textContent = t('hint.calendarCaption', { monat: monatFormat(monat) });
    kalender.append(kalenderBeschriftung);

    const kalenderKopf = document.createElement('thead');
    const kalenderKopfzeile = document.createElement('tr');
    wochentageMoZuerst().forEach((name, i) => {
        const th = document.createElement('th');
        th.scope = 'col';
        th.textContent = name;
        // i 5/6 = Samstag/Sonntag (Montag zuerst, siehe WOCHENTAGE_MO_ZUERST
        // oben) - Gestaltungsauftrag, wörtlich: "der Wochenrhythmus ist in
        // diesen Daten echt ... lass es sichtbar werden, ohne den Kalender
        // zu bunt zu machen". Eine eigene, LEISE Kennzeichnung der
        // Wochenend-SPALTENKÖPFE (statt einer weiteren Farbe an der
        // einzelnen Kachel, die schon die Fahrtenzahl trägt) macht den
        // Rhythmus auf einen Blick sichtbar, ohne die Werteskala mit einer
        // zweiten Bedeutung zu überladen.
        if (i >= 5) th.className = 'monatskalender-wochenende';
        kalenderKopfzeile.append(th);
    });
    kalenderKopf.append(kalenderKopfzeile);
    kalender.append(kalenderKopf);

    // Montag-Index des 1. des Monats (0 = Montag ... 6 = Sonntag) - aus
    // denselben lokalen Datumsanteilen gebaut wie tagFormat() oben, aus
    // demselben Grund: kein ISO-String, keine Zeitzonenverschiebung durch
    // die Zeitzone des Browsers. new Date(...).getDay() liefert 0 für
    // Sonntag; (getDay() + 6) % 7 dreht das auf einen Montag-zuerst-Index.
    const ersterWochentag = new Date(Number(jahr), monatsnummer - 1, 1).getDay();
    const fuehrendeLeerfelder = (ersterWochentag + 6) % 7;
    const wochenAnzahl = Math.ceil((fuehrendeLeerfelder + tageImMonat) / 7);

    const kalenderKoerper = document.createElement('tbody');
    // Jede eigene Öffnung dieses Monats bekommt ihren eigenen, frischen
    // Kalender (zeigeMaske() leert #detailmaske bei jedem Zeilenwechsel,
    // siehe Kopfkommentar dieser Funktion) - keine Kachel ist deshalb beim
    // Aufbau bereits ausgewählt, unabhängig davon, was in einem zuvor
    // geöffneten Monat markiert war.
    let tagKnopfAusgewaehlt = null;

    for (let woche = 0; woche < wochenAnzahl; woche++) {
        const zeile = document.createElement('tr');
        for (let spalte = 0; spalte < 7; spalte++) {
            const feldIndex = woche * 7 + spalte;
            const tagNummer = feldIndex - fuehrendeLeerfelder + 1;
            const td = document.createElement('td');

            if (tagNummer < 1 || tagNummer > tageImMonat) {
                // "Kein Tag" MUSS anders aussehen als "0 Fahrten" (Auftrag,
                // ausdrücklich) - eine leere, randlose Zelle statt einer
                // gefärbten oder umrandeten Kachel mit einer "0" darin
                // (siehe .monatskalender-leer in style.css). aria-hidden:
                // nichts hier vorzulesen - ein Screenreader soll eine
                // Wochenzeile am Monatsrand nicht mit sieben Zellen
                // ankündigen und einen Teil davon dann stumm lassen.
                td.className = 'monatskalender-leer';
                td.setAttribute('aria-hidden', 'true');
                zeile.append(td);
                continue;
            }

            const i = tagNummer - 1;   // Index in tage[]/werte[] - siehe deren Aufbau weiter oben
            const wert = werte[i];
            // Aus jahr/monatsnummer gebaut (beide oben schon aus monat
            // geparst), NICHT aus monat selbst: monat trägt hier bereits
            // einen Tagesanteil ("2025-09-01", date_trunc('month', ...)::date
            // aus der Sicht) - ein zweites "-04" einfach angehängt hätte
            // "2025-09-01-04" ergeben. Derselbe Fallstrick, den die
            // frühere Tagesliste hier schon vermied.
            const tagIso = `${jahr}-${String(monatsnummer).padStart(2, '0')}-${String(tagNummer).padStart(2, '0')}`;
            const stufe = stufeVonWert(wert);

            td.className = 'monatskalender-zelle';
            const knopf = document.createElement('button');
            knopf.type = 'button';
            knopf.className = `monatskalender-tag-knopf monatskalender-stufe-${stufe}`;
            // Zugänglicher Name trägt DATUM UND WERT (Auftrag,
            // ausdrücklich) - überschreibt per aria-label den Text, den
            // ein Screenreader sonst aus den beiden <span> darunter
            // zusammensetzen würde ("4" gefolgt von "12" ergäbe "412",
            // nicht "4. Fahrten: 12"). tagFormat() liefert dieselbe Form
            // MIT Wochentag wie zuvor die Tagesliste (Gestaltungsauftrag
            // Punkt 2a, unverändert gültig).
            knopf.setAttribute('aria-label', umsaetze[i] === undefined
                ? t('hint.dayRidesAria', { datum: tagFormat(tagIso), phrase: mengeFormat(wert, 'fahrt') })
                : t('hint.dayRidesRevenueAria', {
                    datum: tagFormat(tagIso), phrase: mengeFormat(wert, 'fahrt'),
                    umsatz: geldFormat(umsaetze[i])
                }));
            // Hinweisfenster beim Zeigen UND beim Tastaturfokus (siehe
            // hinweisfensterVerknuepfen() in rahmen.js) - derselbe Text wie
            // an der zugehoerigen Saeule im Diagramm darueber.
            hinweisfensterVerknuepfen(knopf, tagHinweis(i));

            const tagSpanne = document.createElement('span');
            tagSpanne.className = 'monatskalender-tag-nummer';
            tagSpanne.textContent = String(tagNummer);
            const wertSpanne = document.createElement('span');
            wertSpanne.className = 'monatskalender-tag-wert';
            wertSpanne.textContent = zahlFormat(wert);
            knopf.append(tagSpanne, wertSpanne);

            knopf.addEventListener('click', () => {
                // Sofortige Markierung, ohne auf die Antwort zu warten -
                // dieselbe Reihenfolge wie zeileWaehlen() in rahmen.js
                // (Auswahl zuerst sichtbar, Inhalt folgt nach): "wo bin
                // ich" (Auftrag) muss beim Klick selbst schon stimmen,
                // nicht erst nach einer Netzwerkantwort.
                tagKnopfAusgewaehlt?.classList.remove('monatskalender-tag-ausgewaehlt');
                knopf.classList.add('monatskalender-tag-ausgewaehlt');
                tagKnopfAusgewaehlt = knopf;
                tagdrilldownEinfuegen(tagIso, wurzel, knopf);
            });

            td.append(knopf);
            zeile.append(td);
        }
        kalenderKoerper.append(zeile);
    }
    kalender.append(kalenderKoerper);
    abschnitt.append(kalender);

    // ===== Legende (Gestaltungsauftrag, wörtlich: "eine Einfärbung ohne
    // Skala ist eine Behauptung") - dieselben vier Grenzen wie
    // stufeVonWert() oben, als Prozentanteile vom Monatshöchstwert benannt
    // statt fester Fahrtenzahlen (Begründung siehe dort). =====
    const legende = document.createElement('div');
    legende.className = 'monatskalender-legende';
    const legendeSatz = document.createElement('p');
    legendeSatz.className = 'monatskalender-legende-satz';
    legendeSatz.textContent = t('hint.legendColorScale', { phrase: maxPhrase });
    legende.append(legendeSatz);

    const legendeSkala = document.createElement('div');
    legendeSkala.className = 'monatskalender-legende-skala';
    ['0', '> 0–25 %', '> 25–50 %', '> 50–75 %', '> 75–100 %'].forEach((text, stufe) => {
        const eintrag = document.createElement('span');
        eintrag.className = 'monatskalender-legende-eintrag';

        const marke = document.createElement('span');
        marke.className = `monatskalender-legende-marke monatskalender-stufe-${stufe}`;
        // Die Marke selbst ist reine Illustration der Beschriftung daneben
        // (derselbe Grundsatz wie bei den Bereichs-Icons in rahmen.js) -
        // die Bedeutung jeder Stufe steht als Text im nächsten <span>,
        // nicht nur in der Farbe.
        marke.setAttribute('aria-hidden', 'true');

        const beschriftungSpanne = document.createElement('span');
        beschriftungSpanne.textContent = text;

        eintrag.append(marke, beschriftungSpanne);
        legendeSkala.append(eintrag);
    });
    legende.append(legendeSkala);
    abschnitt.append(legende);

    wurzel.append(abschnitt);
}

// ===== Dritte Ebene: Räder je Tag (Gestaltungsauftrag Punkt 2b) =====
//
// Wettlaufschutz nach demselben Muster wie drilldownZaehler oben, eine
// Ebene tiefer: klickt jemand zwei Tage schnell hintereinander, darf die
// später gestartete, aber frueher zurueckkommende Abfrage nicht von der
// langsameren ueberschrieben werden.
let tagdrilldownZaehler = 0;

// wurzel: #detailmaske, vom Aufrufer durchgereicht statt hier erneut
// per getElementById geholt - monatsdrilldownEinfuegen() hat sie schon
// einmal aufgeloest, eine zweite Auflösung waere nur eine zweite
// Gelegenheit, denselben Fehler zu machen (dort: "wurzel" fehlt, wenn
// die Maske inzwischen weg ist).
// herkunftsKnopf: der Datum-Knopf, aus dem dieser Aufruf kam - fuer den
// "Weg zurueck" unten (Fokus zurueck zur Zeile, dieselbe Idee wie
// maskeSchliessen() in rahmen.js fuer die Detailmaske insgesamt).
async function tagdrilldownEinfuegen(tagIso, wurzel, herkunftsKnopf) {
    const vorgang = laufenderVorgang();
    const eigenerMonatsZaehler = drilldownZaehler;   // siehe Kommentar oben
    const eigenerTagZaehler = ++tagdrilldownZaehler;

    // Alte Ebene 3 sofort raus, VOR dem await: ein zweiter Tag,
    // angeklickt bevor die Antwort des ersten da ist, soll nicht erst
    // beide Tabellen gleichzeitig zeigen, bevor die erste verschwindet.
    document.getElementById('tagdrilldown')?.remove();

    const zeilen = await ladeListe('v_wawi_fahrten_je_tag_rad',
        'fahrrad_id, rahmennummer, typ_code, typ, start_station, ziel_station, dauer_minuten, kilometer, ist_geschaetzt, umsatz',
        (q) => q.eq('tag', tagIso).order('rahmennummer'));

    // Vier unabhaengige Gruende, warum dieses Ergebnis nicht mehr gilt:
    // Bereich/Reiter gewechselt (istAktuellerVorgang), eine andere
    // Monatszeile geoeffnet (drilldownZaehler), ein anderer Tag
    // angeklickt (tagdrilldownZaehler), oder die Maske ist inzwischen
    // ganz weg (wurzel nicht mehr im DOM - moeglich, wenn maskeSchliessen()
    // aus rahmen.js zwischen Klick und Antwort schloss).
    if (!istAktuellerVorgang(vorgang) || eigenerMonatsZaehler !== drilldownZaehler
        || eigenerTagZaehler !== tagdrilldownZaehler || !wurzel.isConnected) return;

    const abschnitt = document.createElement('section');
    abschnitt.id = 'tagdrilldown';
    abschnitt.className = 'tagdrilldown';

    // Kopfzeile MIT Rueckweg: "ein Weg zurueck auf jede Ebene ist
    // Pflicht, und man muss jederzeit sehen, wo man ist" (Auftrag). Die
    // Ueberschrift nennt den Tag (wo man ist), der Knopf daneben nimmt
    // die Ebene wieder weg, ohne die ganze Detailmaske zu schliessen
    // (das bliebe Punkt 1 vorbehalten) - man landet wieder bei der
    // Tagestabelle aus Ebene 2, nicht beim Ausgangspunkt Ebene 1.
    const kopf = document.createElement('div');
    kopf.className = 'tagdrilldown-kopf';
    const ueberschrift = document.createElement('h3');
    ueberschrift.textContent = t('misc.bikesOnDate', { datum: tagFormat(tagIso) });
    kopf.append(ueberschrift);

    const zurueckKnopf = document.createElement('button');
    zurueckKnopf.type = 'button';
    zurueckKnopf.className = 'knopf-neben tagdrilldown-zurueck';
    zurueckKnopf.textContent = t('button.backToDayOverview');
    zurueckKnopf.addEventListener('click', () => {
        document.querySelector('.monatskalender-tag-ausgewaehlt')
            ?.classList.remove('monatskalender-tag-ausgewaehlt');
        abschnitt.remove();
        herkunftsKnopf.focus();   // Fokus zurueck zur Ursprungszeile, dieselbe Idee wie bei Punkt 1
    });
    kopf.append(zurueckKnopf);
    abschnitt.append(kopf);

    const fehler = letzterLadeFehler('v_wawi_fahrten_je_tag_rad');
    if (fehler) {
        const hinweis = document.createElement('p');
        hinweis.className = 'monatsdrilldown-fehler';
        hinweis.textContent = t('msg.thisDayBikesLoadFailed', { fehler });
        abschnitt.append(hinweis);
        wurzel.append(abschnitt);
        return;
    }

    if (zeilen.length === 0) {
        // Kommt vor: ein Betriebstag ohne jede Fahrt (Saeule der Hoehe 0
        // in der Grafik darueber, siehe Kommentar bei saeulengrafik() in
        // rahmen.js) ist ein gueltiger Klickziel, keine fehlerhafte
        // Eingabe - "keine Fahrten" ist eine gueltige, erwartbare Antwort.
        const leer = document.createElement('p');
        leer.textContent = t('misc.noBikeRiddenThisDay');
        abschnitt.append(leer);
        wurzel.append(abschnitt);
        return;
    }

    // ===== DIESELBE TABELLE WIE LINKS (30.08.2026) =====
    // Auftrag: "auch Sortieren, Gruppieren, Filtern". Statt der bis hierher
    // handgebauten <table> zeichnet jetzt zeigeDetailtabelle() (rahmen.js)
    // - derselbe Code wie die Arbeitsliste, nur mit eigenem Zustand und
    // kompaktem Spaltenmenue. Gruppieren nach Radtyp oder nach Startstation
    // beantwortet hier die Frage, fuer die man den Tag ueberhaupt aufmacht.
    //
    // Die Rahmennummer bleibt Text ohne Querverweis - siehe die
    // Begruendung, die schon die frueher handgebaute Fassung trug: ein
    // Sprung von hier aus wechselte den ganzen Arbeitsbereich.
    // Die Zeile ueber der Tabelle. Sie nannte bis hierher die Sicht, aus der
    // die Zeilen stammen; der Auftrag wirft diesen Namen heraus und setzt
    // den Tagesumsatz an seine Stelle. Der Vorbehalt "kein Kundenbezug"
    // bleibt: er ist eine Aussage ueber die Daten, kein Verweis auf ihre
    // Herkunft.
    //
    // DIE SUMME KOMMT AUS DEN GELADENEN ZEILEN, nicht aus
    // v_wawi_fahrten_je_tag. Zwei Gruende: die Zahl stimmt damit IMMER mit
    // der Tabelle darunter ueberein (dieselben Zeilen, dieselbe Summe),
    // und die beiden Sichten tragen verschiedene Rollenschranken -
    // v_wawi_fahrten_je_tag liest nur leitung/demo, diese hier auch
    // disposition. Ein Dispositionskonto saehe die Tabelle, aber keine
    // Tagessumme, und muesste hier einen leeren Wert erklaeren.
    // null-Umsaetze (nicht abgerechnet) fallen aus der Summe heraus,
    // statt als Null mitzuzaehlen.
    const tagesumsatz = zeilen.reduce((summe, z) => summe + (Number(z.umsatz) || 0), 0);
    const herkunft = document.createElement('p');
    herkunft.className = 'monatsdrilldown-herkunft';
    herkunft.textContent = t('misc.bikesOnDateCaption', {
        datum: tagFormat(tagIso), umsatz: geldFormat(tagesumsatz)
    });
    abschnitt.append(herkunft);

    const tabellenplatz = document.createElement('div');
    tabellenplatz.className = 'arbeitstabelle-kompakt-behaelter';
    abschnitt.append(tabellenplatz);
    zeigeDetailtabelle('monatsdrilldown-raeder', tabellenplatz, zeilen, [
        { feld: 'rahmennummer', titel: t('field.rahmennummer') },
        { feld: 'typ',          titel: t('field.radtyp') },
        { feld: 'start_station', titel: t('field.start'),
          formatieren: (w) => w || '—' },
        { feld: 'ziel_station',  titel: t('field.ziel'),
          formatieren: (w) => w || '—' },
        // summierbar: eine Fahrtdauer gehoert zu GENAU einer Fahrt, die
        // Summe ueber eine Gruppe ist also die tatsaechlich gefahrene Zeit -
        // dieselbe Pruefung wie bei 'fahrten'/'minuten' im Radtyp-Reiter.
        { feld: 'dauer_minuten', titel: t('field.dauer'), klasse: 'zahl',
          formatieren: (w) => minutenFormat(w), summierbar: true },
        // ist_geschaetzt gehoert IMMER neben die Zahl (dieselbe Regel wie
        // bei v_wawi_km_co2: "eine Kennzahl, die ihre eigene Unsicherheit
        // nicht mitliefert, ist gefaehrlich"). sortierwert traegt die
        // blanke Zahl, damit nach Strecke und nicht nach dem Text mit dem
        // angehaengten Zusatz sortiert wird.
        { feld: 'kilometer', titel: t('field.strecke'), klasse: 'zahl',
          sortierwert: (z) => z.kilometer,
          formatieren: (w, z) => (w === null ? '—'
              : `${kmFormat(w)}${z.ist_geschaetzt ? t('misc.estimatedSuffix') : ''}`),
          // summierbar: gefahrene Kilometer sind additiv (dieselbe
          // Begruendung wie im Reiter "Kilometer und CO2").
          summierbar: true,
          // EIGENES summeFormatieren, aus zwei Gruenden. Erstens ruft die
          // Gruppenzeile formatieren() sonst OHNE Zeile auf, und die
          // Vorgabe oben greift dann auf z.ist_geschaetzt einer
          // undefinierten Zeile zu. Zweitens - der fachliche Grund - muss
          // die Summe den Vorbehalt ihrer Bestandteile mittragen: enthaelt
          // die Gruppe auch nur eine geschaetzte Strecke, ist die Summe
          // geschaetzt. Eine Kennzahl, die ihre eigene Unsicherheit nicht
          // mitliefert, ist gefaehrlich (dieselbe Regel wie bei
          // v_wawi_km_co2).
          summeFormatieren: (summe, gruppenzeilen) => `${kmFormat(summe)}`
              + (gruppenzeilen.some((z) => z.ist_geschaetzt) ? t('misc.estimatedSuffix') : '') },
        // UMSATZ JE FAHRT. Kommt seit 0018_wawi_sichten.sql aus der Sicht
        // selbst (left join lateral auf entgeltposition, Korn bleibt die
        // Fahrt - siehe die Kornprobe in t0018).
        // null heisst NICHT ABGERECHNET, nicht "null Euro": in der
        // Datenbank nachgezaehlt traegt derzeit jede der 12 049
        // abgeschlossenen Fahrten Entgeltpositionen, der Fall tritt also
        // heute nicht auf - er waere aber der einzige, in dem ein
        // Gedankenstrich richtig ist, und deshalb steht er hier.
        // summierbar: Entgelte sind ueber Fahrten additiv, dieselbe
        // Pruefung wie bei 'umsatz' in den Monatstafeln.
        { feld: 'umsatz', titel: t('field.umsatz'), klasse: 'zahl',
          formatieren: (w) => (w === null || w === undefined ? '—' : geldFormat(w)),
          summierbar: true, summeFormatieren: (summe) => geldFormat(summe) }
    ]);

    wurzel.append(abschnitt);
}

// ===== Umsatz nach Radtyp =====

async function umsatzRadtypZeigen(vorgang) {
    // Sortierung nach Radtyp UND ERST DANN nach Monat (Gestaltungsauftrag,
    // Punkt 4) - vorher stand "monat, typ_code": die beiden City-Bike-
    // Zeilen um den Tarifwechsel (Februar/März 2026) lagen damit 46
    // Zeilen sortiert nach Monat auseinander, nie nebeneinander. Mit
    // dieser Sortierung liegen alle Monate EINES Radtyps hintereinander -
    // wer den Verlauf eines Typs lesen will (das ist praktisch immer die
    // Frage, nicht "was geschah im Juni über alle Typen"), muss dafür
    // nicht mehr selbst filtern.
    // Parallel zur Monatsliste geladen, nicht danach: zaehleZeilen()
    // (daten.js) fragt nur die Gesamtzahl ab, ohne dafuer die 275 Zeilen
    // von v_wawi_flotte zu laden (dasselbe Muster wie die drei
    // Zaehl-Anfragen in kundenAufbauen(), kunden.js). Der Nenner fuer
    // "Umsatz je Rad und Tag" unten in umsatzRadtypUebersicht() -
    // ausdruecklich ohne 'ausgemustert' (.neq, dasselbe Muster wie die
    // Ersatzteilliste in instandhaltung.js): ein abgeschriebenes Rad
    // erwirtschaftet nichts mehr und gehoert nicht in die Flotte, die
    // sich tragen soll. Ein Fehler beim Zaehlen liefert null statt eines
    // Wurfs (siehe zaehleZeilen()) - umsatzRadtypUebersicht() laesst die
    // Kachel dann einfach weg, genau wie kundenUebersicht() es bei den
    // eigenen Zaehl-Anfragen schon tut, statt den ganzen Reiter mit
    // "schlecht" zu melden: eine fehlende Bezugsgroesse fuer EINE Kachel
    // ist kein Grund, die Monatsliste selbst als gescheitert auszuweisen.
    const [zeilen, flottengroesse] = await Promise.all([
        ladeListe('v_wawi_umsatz_radtyp',
            'monat, typ_code, typ, fahrten, minuten, umsatz, umsatz_je_fahrt',
            (q) => q.order('typ_code').order('monat')),
        zaehleZeilen('v_wawi_flotte', (q) => q.neq('status', 'ausgemustert'))
    ]);

    const fehler = letzterLadeFehler('v_wawi_umsatz_radtyp');
    if (fehler) {
        zeigeKopftafel(vorgang, null);
        meldeVorgang(vorgang, t('msg.revenueByBikeTypeLoadFailed', { fehler }), 'schlecht');
        return;
    }

    if (zeilen.length === 0) {
        // Anders als bei Instandhaltung ist eine leere Liste hier KEIN
        // erwarteter Normalfall (siehe Bestandstabelle im Auftrag: das
        // Referenzjahr trägt 12 030 Fahrten und 4117 Rechnungen) -
        // trotzdem dieselbe Sorgfalt: null Zeilen könnten auch bedeuten,
        // dass hat_rolle('leitung') gerade false liefert, obwohl die
        // Navigation den Bereich zeigt (z. B. eine Rolle, die zwischen
        // Laden der Navigation und Laden dieser Liste entzogen wurde).
        zeigeKopftafel(vorgang, null);
        zeigeLeermaske(
            vorgang,
            t('empty.noRevenueByBikeTypeTitle'),
            t('empty.noRevenueByBikeTypeText')
        );
        meldeVorgang(vorgang, t('empty.noRevenueByBikeTypeTitle'));
        return;
    }

    // Veränderung ggü. Vormonat DESSELBEN Radtyps (Gestaltungsauftrag,
    // Punkt 4, zweite Hälfte: eine Veränderungsspalte). Da die Liste jetzt
    // primär nach typ_code sortiert ist, liegt der Vormonat - falls
    // vorhanden - immer direkt davor in derselben Reihe; ein
    // Radtypwechsel zwischen zwei Zeilen (erster Monat eines Typs) wird
    // über den typ_code-Vergleich erkannt und liefert bewusst null statt
    // eines Vergleichs über Typgrenzen hinweg, der fachlich keinen Sinn
    // ergäbe (siehe veraenderungFormat()).
    // minutenJeFahrt: dieselbe Rechnung wie umsatz_je_fahrt (aus der
    // Sicht), nur clientseitig statt in SQL - fahrten und minuten
    // stehen als Summen JE ZEILE bereits fest (eine Zeile ist ein Monat
    // UND ein Radtyp), die Division innerhalb DERSELBEN Zeile zaehlt
    // keine Falle ein: der Fehler, vor dem anteilGewichtet() weiter oben
    // warnt, entsteht erst, wenn man einen Quotienten UEBER ZEILEN
    // HINWEG mittelt, nicht wenn man ihn INNERHALB einer bereits
    // korrekt aggregierten Zeile bildet - exakt dieselbe Unterscheidung,
    // die veraenderungJeFahrt hier schon immer genutzt hat, um
    // clientseitig statt in der Sicht zu rechnen.
    const zeilenMitVeraenderung = zeilen.map((z, i) => {
        const vorherige = i > 0 && zeilen[i - 1].typ_code === z.typ_code ? zeilen[i - 1] : null;
        const veraenderungJeFahrt = vorherige && vorherige.umsatz_je_fahrt
            ? (z.umsatz_je_fahrt - vorherige.umsatz_je_fahrt) / vorherige.umsatz_je_fahrt : null;
        const minutenJeFahrt = z.fahrten ? z.minuten / z.fahrten : null;
        return { ...z, veraenderungJeFahrt, vorherigeFahrten: vorherige ? vorherige.fahrten : null, minutenJeFahrt };
    });

    const umsatzMaximum = Math.max(...zeilen.map((z) => z.umsatz));
    zeigeListe(vorgang, zeilenMitVeraenderung, [
        // gruppierbar (Vorgabe) bei 'typ': "Umsatz nach Radtyp" nach
        // Radtyp gruppiert ist "der eigentliche Gewinn" (Auftrag) - die
        // Zwischensumme je Gruppe kommt aus den summierbar:true-Spalten
        // unten (Fahrten, Minuten, Umsatz), nicht aus Je-Fahrt/Δ - siehe
        // der lange Kommentar bei zeigeListe() in rahmen.js.
        { feld: 'typ',            titel: t('field.radtyp') },
        { feld: 'monat',          titel: t('field.monat'),        formatieren: (w) => monatFormat(w) },
        // summierbar: Fahrten und Minuten sind echte Zaehlwerte JE MONAT
        // - anders als v_wawi_umsatz_kundengruppe.kunden (dort zaehlt
        // dieselbe Person in mehreren Monaten mehrfach, siehe dort)
        // gehoert eine Fahrt/eine gefahrene Minute zu GENAU einem Monat,
        // eine Summe ueber mehrere Monate hinweg zaehlt nichts doppelt.
        { feld: 'fahrten',        titel: t('field.fahrten'),      formatieren: zahlFormat, klasse: zahlKlasse(), summierbar: true },
        { feld: 'minuten',        titel: t('field.minuten'),      formatieren: zahlFormat, klasse: zahlKlasse(), summierbar: true },
        // Bissantz: Balken an einer GEMEINSAMEN Skala ausgerichtet -
        // umsatzMaximum gilt für jede Zeile der Liste, nicht neu je Zeile
        // berechnet. Balken und Betrag in ZWEI Spalten (balkenSpalten() in
        // rahmen.js), nicht mehr in einer gemeinsamen, rechtsbündigen
        // Zelle - siehe dortiger Kommentar (Gestaltungsauftrag, Punkt 5:
        // "keine vertikale Flucht", weil 7,70 € und 2.011,20 € die Gruppe
        // unterschiedlich breit machten und den Balken mitzogen).
        // summierbar: Umsatz ist additiv ueber Monate UND ueber Radtypen -
        // die Kontrollzahl 35.454,47 € aus der Statuszeile ist genau die
        // Summe aller Gruppen-Zwischensummen, siehe Bericht.
        ...balkenSpalten('umsatz', t('field.umsatz'), umsatzMaximum, geldFormat, { summierbar: true }),
        {
            feld: 'umsatz_je_fahrt', titel: t('field.jeFahrt'), klasse: zahlKlasse(),
            formatieren: (w) => zahlSkaliert(geldFormat(w))
        },
        // Frage, die weder "Fahrten" noch "Minuten" (beide Summen JE
        // MONAT, siehe Kommentar dort) beantworten: wie lange dauert
        // EINE Fahrt dieses Radtyps typischerweise? Ein Cargo-Rad mit
        // Anhaenger fuer den Wocheneinkauf und ein City-Bike zur
        // Bahnhofsfahrt unterscheiden sich hier fachlich, nicht nur in
        // der Minutensumme, die bei unterschiedlicher Flottengroesse
        // ohnehin nicht vergleichbar waere. NICHT summierbar - ein
        // Mittelwert, derselbe Fehlertyp wie umsatz_je_fahrt.
        {
            feld: 'minutenJeFahrt', titel: t('field.minutenJeFahrt'), klasse: zahlKlasse(),
            formatieren: (w) => zahlSkaliert(minutenFormat(w))
        },
        {
            feld: 'veraenderungJeFahrt', titel: t('field.deltaVormonat'),
            formatieren: veraenderungFormat,
            klasse: (z) => zahlKlasse(istAuffaellig(z, 'veraenderungJeFahrt') ? 'auffaellig' : '')
        }
    ], umsatzRadtypMaske);

    zeigeKopftafel(vorgang, umsatzRadtypKopftafel(zeilen, flottengroesse));

    // Gesamtsumme UND Fahrten insgesamt in der Statuszeile - die
    // Kontrollzahl aus Schritt 3 des Auftrags (35 454,47 €) soll man
    // ablesen können, ohne selbst zu addieren.
    const gesamtUmsatz = zeilen.reduce((s, z) => s + z.umsatz, 0);
    const gesamtFahrten = zeilen.reduce((s, z) => s + z.fahrten, 0);
    meldeVorgang(vorgang, t('msg.revenueByBikeTypeSummary', {
        monatszeilen: mengeFormat(zeilen.length, 'monatszeile'), fahrten: mengeFormat(gesamtFahrten, 'fahrt'),
        umsatz: geldFormat(gesamtUmsatz) }));
}

// ===== Kopftafeln der Auswertungen =====
//
// Alle vier Reiter dieses Bereichs zeigen Monatszeilen: 36 bis 60 Zeilen,
// in denen jede einzelne Zahl richtig, aber keine Struktur sichtbar ist.
// Die Kopftafel fasst dieselben Zeilen nach der Dimension zusammen, die
// die Tabelle in die Laenge zieht (Radtyp, Tarif, Station), und stellt
// den zwoelf Monatswerten jeder Gruppe EINE gemeinsame Achse unter -
// damit werden aus drei Zahlenkolonnen drei vergleichbare Verlaeufe
// (Tufte, small multiples).
//
// DER BEFUND, DEN ERST DIE ABWEICHUNGSSPALTE SICHTBAR MACHT: das
// City-Bike traegt fast drei Viertel aller Fahrten, aber nur knapp ein
// Drittel des Umsatzes; Lastenrad und E-Bike umgekehrt. Diese Aussage
// steht in KEINER der 36 Monatszeilen und laesst sich aus ihnen auch
// nicht ablesen - sie entsteht erst, wenn man zwei Anteile voneinander
// abzieht (IBCS: die Abweichung ist eine eigene Groesse mit eigener
// Spalte und eigener, um die Null zentrierter Skala).
//
// ZWOELF MONATE, NICHT ALLE GELADENEN: dieselbe Fensterwahl wie bisher
// in den Kacheln (siehe die Begruendung, die frueher an
// umsatzRadtypUebersicht() stand) - die sechs fruehen Testmonate liegen
// mehr als ein Jahr vor dem juengsten Monat und fallen dadurch von
// selbst heraus, ohne dass dafuer ein eigens gewaehlter Schwellenwert
// noetig waere. Die Tabelle darunter zeigt unveraendert ALLE geladenen
// Monate; die Bezugszeile der Tafel sagt deshalb ausdruecklich, welches
// Fenster sie meint.
// ===== DER GEWAEHLTE ZEITRAUM (29.08.2026) =====
// Auftrag: "bei den Auswertungen sollte der User den Zeitraum aendern
// koennen". Bis hierher waren zwoelf Monate fest verdrahtet.
//
// Der Wert steht an EINER Stelle, weil das Fenster an einer Stelle
// geschnitten wird (auswertungenMonatsgliederung() unten). Alle drei
// Monatstafeln - Umsatz nach Radtyp, Umsatz nach Kundengruppe,
// Kilometer und CO2 - lesen ihn dadurch von selbst.
//
// 0 heisst "alles Geladene". Nicht null oder 'alle': slice(-0) waere das
// LEERE Ende des Feldes, ein stiller Totalausfall - deshalb wird die
// Null unten ausdruecklich abgefangen, nicht gerechnet.
const AUSWERTUNGEN_FENSTER_SCHLUESSEL = 'velocity-wawi-auswertungen-fenster';
const AUSWERTUNGEN_FENSTER_WAHL = [3, 6, 12, 24, 0];

function auswertungenFensterGemerkt() {
    const wert = Number(gemerkt(AUSWERTUNGEN_FENSTER_SCHLUESSEL));
    return AUSWERTUNGEN_FENSTER_WAHL.includes(wert) ? wert : 12;
}

let auswertungenFenster = auswertungenFensterGemerkt();

// Der gewaehlte Zeitraum als EINHEITENZUSATZ ("Euro, 12 Monate"). Bis zum
// Zeitwaehler stand diese Zahl fest in den Sprachdateien - die Werte selbst
// folgten dem Fenster (auswertungenSumme(z, fenster, ...)), die Beschriftung
// aber nicht: bei "Alles" behaupteten die Spalten weiter "12 Monate" ueber
// Zahlen, die zwanzig Monate summierten. Eine Einheit, die den Bezug falsch
// angibt, ist schlimmer als gar keine - sie wird geglaubt.
// Eigener Wortlaut fuer 0 statt des Knopftextes "Alles": auf dem Knopf steht
// die WAHL ("Alles"), unter der Spalte der BEZUG - "Euro, Alles" waere in
// keiner der sechs Sprachen ein Satz.
function auswertungenFensterWort() {
    return auswertungenFenster === 0
        ? t('board.periodAllLabel') : t('board.periodMonths', { n: auswertungenFenster });
}

// Die Wahl fuer eine Kopftafel: der Baustein in rahmen.js macht daraus
// eine Reihe Knoepfe neben der Zeitzeile (siehe zeigeKopftafel()).
function auswertungenZeitWahl() {
    return {
        aktuell: auswertungenFenster,
        optionen: AUSWERTUNGEN_FENSTER_WAHL.map((n) => ({
            wert: n,
            text: n === 0 ? t('board.periodAll') : t('board.periodMonths', { n })
        })),
        beiWechsel: async (wert) => {
            auswertungenFenster = wert;
            merke(AUSWERTUNGEN_FENSTER_SCHLUESSEL, String(wert));
            // Dieselbe Begruendung wie beim Reiterwechsel weiter oben: eine
            // offene Detailmaske zeigt eine Zeile aus dem ALTEN Fenster.
            maskeVerwerfen();
            await auswertungenAufbauen();
        }
    };
}

function auswertungenMonatsgliederung(zeilen, schluesselVon, nameVon) {
    const alleMonate = [...new Set(zeilen.map((z) => z.monat))].sort();
    const fenster = auswertungenFenster === 0
        ? alleMonate
        : alleMonate.slice(-auswertungenFenster);
    const imFenster = new Set(fenster);

    const gruppen = new Map();
    for (const zeile of zeilen) {
        if (!imFenster.has(zeile.monat)) continue;
        const schluessel = schluesselVon(zeile);
        let gruppe = gruppen.get(schluessel);
        if (!gruppe) {
            gruppe = { schluessel, name: nameVon(zeile), jeMonat: new Map() };
            gruppen.set(schluessel, gruppe);
        }
        gruppe.jeMonat.set(zeile.monat, zeile);
    }
    return { fenster, gruppen: [...gruppen.values()] };
}

// Eine Reihe ueber das Zwoelf-Monats-Fenster, LUECKEN ALS NULL: ein
// Monat, in dem eine Gruppe gar nicht vorkommt (kein Cargo-Umsatz im
// Januar), ist eine Saeule der Hoehe 0 - keine ausgelassene Kategorie.
// Ein einfach uebersprungener Monat saehe genauso aus wie eine kuerzere
// Reihe und waere von einem Ladefehler nicht zu unterscheiden (derselbe
// Grund wie bei saeulengrafik() in rahmen.js, dort schon benannt).
function auswertungenReihe(gruppe, fenster, feld) {
    return fenster.map((monat) => Number(gruppe.jeMonat.get(monat)?.[feld]) || 0);
}

function auswertungenSumme(gruppe, fenster, feld) {
    return auswertungenReihe(gruppe, fenster, feld).reduce((s, w) => s + w, 0);
}

// Sommerhalbjahr April bis September, Winterhalbjahr Oktober bis Maerz -
// nach der KALENDERMONATSNUMMER, nicht nach der Position im Fenster: das
// Fenster wandert mit jedem neuen Monat, die Jahreszeit nicht.
function auswertungenIstSommer(monat) {
    const nummer = Number(String(monat).slice(5, 7));
    return nummer >= 4 && nummer <= 9;
}

// DIE AUSSAGE DER HALBJAHRESSPALTE IST IHRE GLEICHFOERMIGKEIT, und die
// muss dastehen, sonst sieht die Spalte wie Zierrat aus: alle drei
// Radtypen (und alle fuenf Tarifgruppen) tragen im Winterhalbjahr fast
// denselben Umsatzanteil. Genau das ist der Befund - der Jahresgang ist
// eine Eigenschaft des NETZES, keine des Produkts, und er taugt deshalb
// nicht zur Unterscheidung der Zeilen. Small multiples zeigen
// Gleichheit ebenso gut wie Unterschied (Tufte); verschwiegen werden
// darf sie deswegen nicht.
function auswertungenWinterspanne(gruppen, fenster, feld) {
    const anteile = gruppen.map((g) => {
        const { sommer, winter } = auswertungenHalbjahrSegmente(g, fenster, feld);
        const summe = sommer + winter;
        return summe ? winter / summe : 0;
    });
    return { min: Math.round(Math.min(...anteile) * 100), max: Math.round(Math.max(...anteile) * 100) };
}

function auswertungenHalbjahrSegmente(gruppe, fenster, feld) {
    let sommer = 0, winter = 0;
    for (const monat of fenster) {
        const wert = Number(gruppe.jeMonat.get(monat)?.[feld]) || 0;
        if (auswertungenIstSommer(monat)) sommer += wert; else winter += wert;
    }
    return { sommer, winter };
}

// ===== Reiter "Umsatz nach Radtyp" =====
function umsatzRadtypKopftafel(zeilen, flottengroesse) {
    if (!zeilen || zeilen.length === 0) return null;
    const { fenster, gruppen } = auswertungenMonatsgliederung(
        zeilen, (z) => z.typ_code, (z) => z.typ);
    if (gruppen.length === 0) return null;

    const umsatzGesamt = gruppen.reduce((s, g) => s + auswertungenSumme(g, fenster, 'umsatz'), 0);
    const fahrtenGesamt = gruppen.reduce((s, g) => s + auswertungenSumme(g, fenster, 'fahrten'), 0);
    gruppen.sort((a, b) => auswertungenSumme(b, fenster, 'umsatz') - auswertungenSumme(a, fenster, 'umsatz'));

    // VERHAELTNISZAHLEN AUS SUMMEN (Hausregel): Umsatz- und Fahrtenanteil
    // beide aus den Zwoelf-Monats-SUMMEN, nicht als Mittel der zwoelf
    // Monatsanteile - ein Januar mit 208 Fahrten haette dabei dasselbe
    // Gewicht bekommen wie ein Juli mit 1939.
    const umsatzanteil = (g) => (umsatzGesamt ? auswertungenSumme(g, fenster, 'umsatz') / umsatzGesamt : 0);
    const fahrtenanteil = (g) => (fahrtenGesamt ? auswertungenSumme(g, fenster, 'fahrten') / fahrtenGesamt : 0);

    // Ueber ALLE geladenen Monate gesucht, nicht nur ueber das
    // Zwoelf-Monats-Fenster: der Tarifwechsel ist ein Ereignis der
    // Betriebsgeschichte, kein Wert des Berichtszeitraums - dieselbe
    // Testmonat-Schwelle wie bisher.
    const cityBetrieb = zeilen
        .filter((z) => z.typ_code === 'CITY' && z.fahrten >= MINDEST_FAHRTEN_JE_MONAT)
        .sort((a, b) => a.monat.localeCompare(b.monat));
    const preissprung = groessterSprung(cityBetrieb, 'umsatz_je_fahrt');
    const winterspanne = auswertungenWinterspanne(gruppen, fenster, 'umsatz');

    return {
        titel: t('board.revenueTypeTitle'),
        zeitWahl: auswertungenZeitWahl(),
        zeit: t('board.periodRange', {
            von: monatFormat(fenster[0]),
            bis: monatFormat(fenster[fenster.length - 1])
        }),
        // "Umsatz je Rad und Tag" - die Kennzahl, die "analytischer" von
        // "mehr Zahlen" unterscheidet: der Gesamtumsatz ist ein Fakt,
        // "traegt sich die Flotte damit" ist eine Frage, die erst ein
        // Bezug beantwortet. flottengroesse kommt aus v_wawi_flotte OHNE
        // ausgemusterte Raeder (siehe die Zaehl-Anfrage in
        // umsatzRadtypZeigen()) - ein abgeschriebenes Rad erwirtschaftet
        // nichts mehr und wuerde den Nenner nur kuenstlich vergroessern.
        // 365 Tage: das Zwoelf-Monats-Fenster ist im heutigen Bestand
        // genau ein Jahr ohne Schalttag.
        bezug: flottengroesse
            ? t('board.revenueReferenceWithFleet', {
                umsatz: geldFormat(umsatzGesamt), fahrtenPhrase: mengeFormat(fahrtenGesamt, 'fahrt'),
                vonMonat: monatFormat(fenster[0]), bisMonat: monatFormat(fenster[fenster.length - 1]),
                jeRadTag: geldFormat(umsatzGesamt / flottengroesse / 365),
                raederPhrase: mengeFormat(flottengroesse, 'rad')
            })
            : t('board.revenueReference', {
                umsatz: geldFormat(umsatzGesamt), fahrtenPhrase: mengeFormat(fahrtenGesamt, 'fahrt'),
                vonMonat: monatFormat(fenster[0]), bisMonat: monatFormat(fenster[fenster.length - 1])
            }),
        spalten: auswertungenGeldSpalten({
            rubrikTitel: t('col.bikeType'),
            fenster, umsatzanteil, fahrtenanteil,
            // Der Balken traegt hier die FAHRTEN, nicht den Umsatz -
            // siehe die Begruendung mit den Messwerten bei
            // auswertungenGeldSpalten() weiter unten (drei Umsaetze im
            // Verhaeltnis 1,13 zu 1 gegen drei Fahrtenzahlen im
            // Verhaeltnis 8,0 zu 1).
            groesse: 'fahrten',
            // ANGLEICHUNG AN DIE FLOTTENTAFEL (Auftrag: sie ist die
            // optische Referenz). Dort steht das Produktbild in der
            // Zeile seines Radtyps; hier SIND die drei Zeilen die drei
            // Radtypen, und dieselben drei Dateien liegen bereits im
            // Auslieferungsverzeichnis (siehe RADTYP_BILDER in
            // rahmen.js). Es gab keinen sachlichen Grund fuer den
            // Unterschied - nur den, dass dieser Reiter frueher gebaut
            // wurde als die Bilder. Der Nutzen ist derselbe wie bei der
            // Kategoriefarbe eine Zeile tiefer: Wiedererkennung ueber
            // Bereiche hinweg, ohne die Beschriftung lesen zu muessen.
            // Rein schmueckend (alt="", aria-hidden - siehe
            // kopftafelZeile()): der Typname steht unmittelbar daneben.
            bild: (g) => radtypBild(g.schluessel),
            zusatz: (g) => t('board.revenuePerRide', {
                betrag: geldFormat(auswertungenSumme(g, fenster, 'fahrten')
                    ? auswertungenSumme(g, fenster, 'umsatz') / auswertungenSumme(g, fenster, 'fahrten') : 0)
            })
        }),
        zeilen: gruppen,
        summe: {
            summenzeile: true, name: t('col.together'),
            summeUmsatz: umsatzGesamt, summeFahrten: fahrtenGesamt, jeMonat: new Map()
        },
        // DER PREISWECHSEL ALS FUSSNOTE, nicht als eigene Spalte: er ist
        // ein EINMALIGES Ereignis in genau EINER der drei Zeilen (das
        // City-Bike, zum 1. Maerz 2026) - eine Spalte dafuer stuende in
        // zwei von drei Zeilen leer und behauptete eine Regelmaessigkeit,
        // die es nicht gibt. Gesucht wird deshalb GEZIELT im City-Bike
        // und nicht "der groesste Ausschlag ueber alle Typen": eine
        // solche Suche liefert bei kleiner werdender Stichprobe (E-Bike
        // traegt in manchen Monaten nur 44 Fahrten) einen zufaelligen
        // E-Bike-Monat statt des tatsaechlichen, dokumentierten
        // Tarifwechsels - gegen die Daten geprueft, siehe Bericht.
        // Zwei vollstaendige Saetze, mit Leerzeichen verbunden - nicht
        // ein Satz aus zwei uebersetzten Bruchstuecken: jeder Teil bleibt
        // in jeder Sprache fuer sich uebersetzbar.
        fussnote: [
            preissprung
                ? t('board.revenueTypeFootnote', {
                    von: geldFormat(preissprung.vorherigerWert), nach: geldFormat(preissprung.wert),
                    veraenderung: veraenderungFormat(preissprung.veraenderung),
                    monat: monatFormat(preissprung.monat)
                })
                : null,
            t('board.halfYearFootnote', {
                min: zahlFormat(winterspanne.min), max: zahlFormat(winterspanne.max)
            })
        ].filter(Boolean).join(' ')
    };
}

// Die Spalten, die sich die beiden Umsatz-Reiter teilen - EINMAL
// beschrieben, nicht zweimal fast gleich: die Reiter unterscheiden sich
// nur darin, WONACH sie gliedern (Radtyp gegen Tarif), nicht darin, was
// sie ueber eine Gruppe aussagen.
//
// ===== DER HALBJAHRESMIX IST GESTRICHEN, UND WARUM =====
//
// Hier stand eine Strukturspalte "Sommer-/Winterhalbjahr". Nachgerechnet
// ueber das Zwoelfmonatsfenster, Winteranteil am Umsatz:
//
//     Radtyp:       Cargo 27,1 %   E-Bike 26,7 %   City 25,0 %
//     Tarifgruppe:  zwischen 21,4 % und 31,8 %
//
// Zwei Prozentpunkte Spanne ueber drei Zeilen, zehn ueber fuenf. Drei
// bzw. fuenf 100-%-Balken, deren Trennkante an praktisch derselben
// Stelle sitzt - eine Spalte, die zeigt, dass es nichts zu zeigen gibt.
//
// Der frühere Kommentar an dieser Stelle verteidigte genau das: "die
// Aussage der Halbjahresspalte IST ihre Gleichfoermigkeit". Das stimmt
// als Befund und ist als Grafik trotzdem falsch - eine Gleichheit
// braucht keine fuenf gleich aussehenden Balken, sie braucht einen Satz.
// Der steht unveraendert in der Fussnote beider Reiter
// (board.halfYearFootnote, mit den gemessenen Grenzen), und dort ist er
// jetzt das Einzige, was diese Aussage traegt - statt einer Spalte, die
// dieselbe Aussage viermal wiederholt und dabei aussieht, als
// unterschiede sie etwas.
//
// ===== WELCHE GROESSE DEN BALKEN TRAEGT, ENTSCHEIDET DER REITER =====
//
// optionen.groesse: 'umsatz' oder 'fahrten'. Der Grund ist wieder eine
// Messung, kein Geschmack:
//
//   NACH TARIFGRUPPE traegt der Umsatz. Fuenf Gruppen zwischen 249,76 und
//   18.172,32 EUR - Verhaeltnis 73 zu 1, der Balken zeigt eine echte
//   Rangfolge.
//
//   NACH RADTYP traegt er NICHT. Drei Radtypen zwischen 11.219,14 und
//   12.628,08 EUR - Verhaeltnis 1,13 zu 1. Vom Nullpunkt aus gezeichnet
//   waeren das drei Balken mit 89, 91 und 100 Prozent Laenge: kein Auge
//   unterscheidet die. Der Umsatz steht dort deshalb als reine Zahl
//   (art:'zahl'), und den Balken traegt die FAHRTENZAHL - 1.081 / 2.328 /
//   8.620, Verhaeltnis 8,0 zu 1.
//
//   Und das ist nicht bloss ein Ausweichen: die Spannung zwischen beiden
//   Groessen IST der Befund dieses Reiters. Drei Radtypen bringen fast
//   denselben Umsatz mit voellig verschieden vielen Fahrten - genau das
//   misst die Abweichungsspalte rechts (Cargo +26,7, E-Bike +13,3, City
//   -40,0 Prozentpunkte). Zahl und Balken nebeneinander machen sichtbar,
//   woher dieser Ausschlag kommt.
//
// optionen.bild: optional, (zeile) => Bildquelle oder null. Siehe die
// Angleichung an die Flottentafel bei umsatzRadtypKopftafel() weiter
// oben - nur der Radtyp-Reiter reicht hier etwas herein, der
// Tarifgruppen-Reiter laesst es weg, weil es zu einer Tarifgruppe kein
// Bild gibt. Die Stelle bleibt dann EINHEITLICH leer (kopftafelZeile()
// in rahmen.js haengt ohne Quelle gar kein <img> ein), sie wird nicht
// mit einem Platzhalter gefuellt.
function auswertungenGeldSpalten({ rubrikTitel, fenster, umsatzanteil, fahrtenanteil, zusatz,
                                   groesse = 'umsatz', bild = null }) {
    const spalten = [
        {
            art: 'rubrik',
            titel: rubrikTitel,
            wert: (z) => z.name,
            zusatz: (z) => (z.summenzeile ? null : zusatz(z)),
            bild: bild ? ((z) => (z.summenzeile ? null : bild(z))) : null
        }
    ];

    const umsatzWert = (z) => (z.summenzeile ? z.summeUmsatz : auswertungenSumme(z, fenster, 'umsatz'));

    if (groesse === 'fahrten') {
        spalten.push({
            // OHNE BALKEN UND OHNE GROESSENSKALA - beide Auslassungen
            // geprueft, beide bleiben (skala: true waere hier moeglich,
            // siehe kopftafelSkala() in rahmen.js, und ist ausdruecklich
            // NICHT gesetzt). Die drei Zwoelfmonatsumsaetze liegen bei
            // 11.219 / 11.540 / 12.628 Euro, ein Verhaeltnis von 1,13 zu
            // 1. Als Balken waeren das drei Laengen zwischen 89 und 100
            // Prozent; als Groesse 17,8 / 17,9 / 18,2 px - vier Zehntel
            // Pixel Spanne ueber die ganze Spalte. Eine Skala, die
            // niemand ablesen kann, behauptet einen Vergleich, den es
            // nicht gibt; und die Fahrtenspalte unmittelbar daneben
            // traegt die Laenge ohnehin schon (8.620 / 2.328 / 1.081,
            // ein Verhaeltnis von 8,0 zu 1) - genau dort wird der
            // Unterschied zwischen den Radtypen sichtbar.
            art: 'zahl',
            titel: t('col.revenue'),
            einheit: t('unit.euroPeriod', { zeitraum: auswertungenFensterWort() }),
            wert: umsatzWert,
            format: (n) => geldFormat(n)
        });
        spalten.push({
            art: 'groesse',
            titel: t('col.rides'),
            einheit: t('unit.ridesPeriod', { zeitraum: auswertungenFensterWort() }),
            wert: (z) => (z.summenzeile ? z.summeFahrten : auswertungenSumme(z, fenster, 'fahrten')),
            format: (n) => zahlFormat(n),
            // RANG 4 DER FARBORDNUNG - derselbe Ton, den dieser Radtyp in
            // der Flotte und in der Wegstrecke traegt (kategorieFarbe()
            // in rahmen.js).
            farbe: (z) => kategorieFarbe(z.schluessel) || 'var(--marine)'
        });
    } else {
        spalten.push({
            art: 'groesse',
            titel: t('col.revenue'),
            einheit: t('unit.euroPeriod', { zeitraum: auswertungenFensterWort() }),
            wert: umsatzWert,
            format: (n) => geldFormat(n),
            farbe: (z) => kategorieFarbe(z.schluessel) || 'var(--marine)'
        });
    }

    spalten.push({
        art: 'profil',
        titel: t('col.monthlyCourse'),
        einheit: `${monatFormat(fenster[0])} - ${monatFormat(fenster[fenster.length - 1])}`,
        reihe: (z) => (z.summenzeile ? null : auswertungenReihe(z, fenster, 'umsatz')),
        // aktuellIndex: die LETZTE Saeule ist der juengste Monat -
        // hier gibt es, anders als bei einer Reihe ueber Stationen
        // oder Baujahre, tatsaechlich einen "aktuellen" Zeitraum.
        aktuellIndex: fenster.length - 1,
        beschriftung: (z) => {
            const reihe = auswertungenReihe(z, fenster, 'umsatz');
            const hoechster = Math.max(...reihe);
            return t('board.monthlyCourseAria', {
                name: z.name, vonMonat: monatFormat(fenster[0]),
                bisMonat: monatFormat(fenster[fenster.length - 1]),
                max: geldFormat(hoechster), maxMonat: monatFormat(fenster[reihe.indexOf(hoechster)]),
                aktuell: geldFormat(reihe[reihe.length - 1])
            });
        },
        // Mouse-over JE SAEULE (Gestaltungsauftrag Punkt 4) - siehe
        // saeulenSparkline()/kopftafelZeile() in rahmen.js. index statt
        // erneutem Nachschlagen von fenster.length: der Aufrufer dort
        // reicht immer denselben Index, mit dem auch die Saeule selbst
        // gezeichnet wurde.
        beschriftungTeil: (z, index, wert) => t('board.seriesPartPhrase', {
            teil: monatFormat(fenster[index]), wert: geldFormat(wert)
        })
    });

    spalten.push({
        art: 'abweichung',
        titel: t('col.revenueVsRides'),
        einheit: t('unit.percentagePoints'),
        wert: (z) => (z.summenzeile ? null
            : Math.round((umsatzanteil(z) - fahrtenanteil(z)) * 1000) / 10),
        format: (n) => abweichungText(n),
        beschriftung: (z) => t('board.revenueVsRidesAria', {
            name: z.name,
            umsatzanteil: zahlFormat(Math.round(umsatzanteil(z) * 1000) / 10, { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
            fahrtenanteil: zahlFormat(Math.round(fahrtenanteil(z) * 1000) / 10, { minimumFractionDigits: 1, maximumFractionDigits: 1 })
        })
    });

    return spalten;
}

// ===== Reiter "Umsatz nach Kundengruppe" =====

// Der Anzeigename einer Tarifgruppe - EINMAL, fuer Kopftafel UND Liste.
//
// v_wawi_umsatz_kundengruppe fuehrt die Kundschaft ohne gueltige
// Mitgliedschaft unter tarif_code 'OHNE' mit dem Klartext "Ohne
// Mitgliedschaft". Das ist ein Wort AUS DER DATENBANK und stand deshalb
// in allen sechs Sprachen deutsch da - waehrend der Bereich "Kundschaft"
// dieselbe Gruppe seit jeher ueber einen Uebersetzungsschluessel nennt
// ("Ohne aktiven Tarif", board.customersNoTariff, siehe kundenKopftafel()
// in kunden.js). Zwei Tafeln, dieselbe Gruppe, zwei Namen - und einer
// davon nur auf Deutsch.
//
// Der Schluessel gewinnt: er ist uebersetzt, und "ohne aktiven Tarif"
// trifft die Sache genauer (eine Mitgliedschaft kann bestehen und
// abgelaufen sein). Die vier ECHTEN Tarife behalten ihren Klartext aus
// der Datenbank - sie sind Produktnamen, keine Oberflaechentexte
// (dieselbe Regel, nach der auch Stationsnamen unuebersetzt bleiben).
//
// EINE Funktion fuer beide Verwendungen, nicht zwei gleichlautende
// Ausdruecke: Kopftafel und Arbeitsliste stehen in diesem Reiter
// UNMITTELBAR uebereinander. Liefen sie auseinander, stuende der eine
// Name zwei Zentimeter ueber dem anderen - genau der Fall, den diese
// Aenderung beseitigen soll.
function tarifAnzeige(zeile) {
    return zeile.tarif_code === 'OHNE' ? t('board.customersNoTariff') : zeile.tarif;
}

function umsatzKundengruppeKopftafel(zeilen) {
    if (!zeilen || zeilen.length === 0) return null;
    // ANGLEICHUNG AN DIE FLOTTENTAFEL bzw. an den Bereich "Kundschaft":
    // der Anzeigename kommt aus tarifAnzeige() oben, nicht mehr roh aus
    // der Sicht - Begruendung dort.
    const { fenster, gruppen } = auswertungenMonatsgliederung(
        zeilen, (z) => z.tarif_code, tarifAnzeige);
    if (gruppen.length === 0) return null;

    const umsatzGesamt = gruppen.reduce((s, g) => s + auswertungenSumme(g, fenster, 'umsatz'), 0);
    const fahrtenGesamt = gruppen.reduce((s, g) => s + auswertungenSumme(g, fenster, 'fahrten'), 0);
    gruppen.sort((a, b) => auswertungenSumme(b, fenster, 'umsatz') - auswertungenSumme(a, fenster, 'umsatz'));

    const umsatzanteil = (g) => (umsatzGesamt ? auswertungenSumme(g, fenster, 'umsatz') / umsatzGesamt : 0);
    const fahrtenanteil = (g) => (fahrtenGesamt ? auswertungenSumme(g, fenster, 'fahrten') / fahrtenGesamt : 0);
    const winterspanne = auswertungenWinterspanne(gruppen, fenster, 'umsatz');

    return {
        titel: t('board.revenueGroupTitle'),
        zeitWahl: auswertungenZeitWahl(),
        // Der Zeitraum steht jetzt in der eigenen Zeitzeile der Tafel
        // (siehe zeigeKopftafel() in rahmen.js) statt mitten im
        // Bezugssatz - damit steht er auf JEDER Tafel an derselben
        // Stelle, auch auf denen ohne Periode.
        zeit: t('board.periodRange', {
            von: monatFormat(fenster[0]),
            bis: monatFormat(fenster[fenster.length - 1])
        }),
        bezug: t('board.revenueReference', {
            umsatz: geldFormat(umsatzGesamt), fahrtenPhrase: mengeFormat(fahrtenGesamt, 'fahrt'),
            vonMonat: monatFormat(fenster[0]), bisMonat: monatFormat(fenster[fenster.length - 1])
        }),
        spalten: auswertungenGeldSpalten({
            rubrikTitel: t('col.tariffGroup'),
            fenster, umsatzanteil, fahrtenanteil,
            // kunden ist je Monatszeile die Zahl der AKTIVEN Kundinnen und
            // Kunden dieses Tarifs - ueber zwoelf Monate summiert waere sie
            // eine Mehrfachzaehlung derselben Personen. Deshalb der
            // HOECHSTWERT der zwoelf Monate ("so viele waren es im
            // staerksten Monat"), nicht die Summe.
            zusatz: (g) => t('board.customersActiveMax', {
                kundenPhrase: mengeFormat(Math.max(...auswertungenReihe(g, fenster, 'kunden')), 'kunde')
            })
        }),
        zeilen: gruppen,
        summe: { summenzeile: true, name: t('col.together'), summeUmsatz: umsatzGesamt, jeMonat: new Map() },
        fussnote: `${t('board.revenueGroupFootnote')} ${t('board.halfYearFootnote', {
            min: zahlFormat(winterspanne.min), max: zahlFormat(winterspanne.max)
        })}`
    };
}

// ===== Reiter "Kilometer und CO2" =====
function kmCo2Kopftafel(zeilen, radtypNamen) {
    if (!zeilen || zeilen.length === 0) return null;
    // ANGLEICHUNG AN DIE FLOTTENTAFEL (Auftrag: sie ist die optische
    // Referenz aller Tafeln). Bis zu dieser Runde stand hier zweimal
    // typ_code - die Rubrikspalte zeigte also "CITY", "EBIKE", "CARGO",
    // waehrend die Flottentafel und der Nachbarreiter "Umsatz nach
    // Radtyp" fuer DIESELBEN drei Zeilen "City-Bike", "E-Bike Sport" und
    // "E-Cargo Loader" schreiben. Zwei Tafeln, dieselbe Sache, zwei
    // Namen: genau die Uneinheitlichkeit, die der Auftrag benennt. Der
    // Grund war nie sachlich, sondern eine fehlende Spalte in
    // v_wawi_km_co2 - kmCo2Zeigen() reicht die Namen jetzt aus
    // v_wawi_modell herein (siehe dort).
    // FALLBACK AUF DEN CODE, nicht auf einen leeren Namen: faellt
    // v_wawi_modell aus, steht wieder "CITY" da - kurz, aber wahr. Eine
    // Zeile ohne Namen waere schlechter als eine mit dem Kuerzel.
    const typName = (code) => (radtypNamen && radtypNamen.get(code)) || code;
    const { fenster, gruppen } = auswertungenMonatsgliederung(
        zeilen, (z) => z.typ_code, (z) => typName(z.typ_code));
    if (gruppen.length === 0) return null;

    gruppen.sort((a, b) => auswertungenSumme(b, fenster, 'kilometer') - auswertungenSumme(a, fenster, 'kilometer'));
    const kmGesamt = gruppen.reduce((s, g) => s + auswertungenSumme(g, fenster, 'kilometer'), 0);
    const fahrtenGesamt = gruppen.reduce((s, g) => s + auswertungenSumme(g, fenster, 'fahrten'), 0);
    const geschaetztGesamt = gruppen.reduce((s, g) => s + auswertungenSumme(g, fenster, 'fahrten_geschaetzt'), 0);
    // DER FEHLER, DER HIER SCHON EINMAL 13 PROZENTPUNKTE GEKOSTET HAT:
    // der Schaetzanteil ist "geschaetzte Fahrten durch alle Fahrten",
    // NICHT der Mittelwert der Monats-/Typanteile (ungewichtet 53,2 %
    // gegen fahrtgewichtet 40,0 %, siehe Bericht). Beide Zaehler kommen
    // deshalb aus Summen ueber dasselbe Fenster.
    const schaetzanteil = fahrtenGesamt ? geschaetztGesamt / fahrtenGesamt : 0;
    // DIE GEGENPROBE STEHT IN DER FUSSNOTE, mit Zahlen statt mit einer
    // Behauptung: derselbe Anteil, einmal fahrtgewichtet und einmal als
    // schlichtes Mittel der Monatsanteile. Im Zwoelf-Monats-Fenster
    // liegen beide dicht beieinander (40,0 gegen 40,2 % - jeder Monat
    // traegt hier aehnlich viele Fahrten); ueber ALLE geladenen Monate
    // klaffen sie weit auseinander (40,1 gegen 53,2 %), weil die sechs
    // duennen Testmonate im ungewichteten Mittel genauso schwer wiegen
    // wie ein Juli mit 1939 Fahrten. Beide Paare stehen da - erst der
    // Vergleich macht sichtbar, WORAN der Unterschied haengt, und genau
    // dieser Fehler hat in diesem Projekt schon einmal 13 Prozentpunkte
    // gekostet.
    const mittelDerAnteile = (reihen) => (reihen.length
        ? reihen.reduce((s, z) => s + (Number(z.anteil_geschaetzt) || 0), 0) / reihen.length : 0);
    const imFenster = new Set(fenster);
    const ungewichtetFenster = mittelDerAnteile(zeilen.filter((z) => imFenster.has(z.monat)));
    const ungewichtetAlle = mittelDerAnteile(zeilen);
    const fahrtenAlle = zeilen.reduce((s, z) => s + (Number(z.fahrten) || 0), 0);
    const geschaetztAlle = zeilen.reduce((s, z) => s + (Number(z.fahrten_geschaetzt) || 0), 0);
    const gewichtetAlle = fahrtenAlle ? geschaetztAlle / fahrtenAlle : 0;
    const kmJeFahrtGesamt = fahrtenGesamt ? kmGesamt / fahrtenGesamt : 0;
    const kmJeFahrt = (g) => {
        const fahrten = auswertungenSumme(g, fenster, 'fahrten');
        return fahrten ? auswertungenSumme(g, fenster, 'kilometer') / fahrten : 0;
    };

    return {
        titel: t('board.kmTitle'),
        zeitWahl: auswertungenZeitWahl(),
        // Der Zeitraum steht jetzt in der eigenen Zeitzeile der Tafel
        // (siehe zeigeKopftafel() in rahmen.js) statt mitten im
        // Bezugssatz - damit steht er auf JEDER Tafel an derselben
        // Stelle, auch auf denen ohne Periode.
        zeit: t('board.periodRange', {
            von: monatFormat(fenster[0]),
            bis: monatFormat(fenster[fenster.length - 1])
        }),
        // ===== DIE SPALTE "DATENGUETE" IST GESTRICHEN, UND WARUM =====
        // Hier stand ein 100-%-Strukturbalken "gemessen / geschaetzt".
        // Nachgerechnet ueber das Zwoelfmonatsfenster liegt der
        // Schaetzanteil bei Cargo 38,7 %, City 41,3 %, E-Bike 39,2 % -
        // 2,6 Prozentpunkte Spanne ueber drei Zeilen. Drei Balken mit
        // derselben Trennkante.
        // Die Einschraenkung selbst faellt damit NICHT weg, im Gegenteil:
        // sie steht doppelt im Text, wo sie hingehoert - in der
        // Bezugszeile gleich hier darunter ("40,0 % der Fahrten
        // geschaetzt") und ausfuehrlich in der Fussnote, samt der
        // Gegenrechnung fahrtgewichtet gegen ungewichtet. Ein Vorbehalt
        // ist ein Satz, keine Flaeche: dass er fuer alle drei Radtypen
        // gleichermassen gilt, sagt der Satz genauer als drei gleich
        // aussehende Balken.
        bezug: t('board.kmReference', {
            km: kmFormat(kmGesamt), fahrtenPhrase: mengeFormat(fahrtenGesamt, 'fahrt'),
            vonMonat: monatFormat(fenster[0]), bisMonat: monatFormat(fenster[fenster.length - 1]),
            anteil: prozentFormat(schaetzanteil)
        }),
        spalten: [
            {
                art: 'rubrik',
                titel: t('col.bikeType'),
                wert: (z) => z.name,
                // Dasselbe Produktbild wie in der Flottentafel und im
                // Reiter "Umsatz nach Radtyp" - siehe RADTYP_BILDER in
                // rahmen.js. Rein schmueckend (alt="", aria-hidden):
                // der Typname steht unmittelbar daneben.
                bild: (z) => (z.summenzeile ? null : radtypBild(z.schluessel)),
                zusatz: (z) => (z.summenzeile ? null
                    : t('board.co2PerRide', {
                        kg: kgFormat(auswertungenSumme(z, fenster, 'fahrten')
                            ? auswertungenSumme(z, fenster, 'co2_ersparnis_kg') / auswertungenSumme(z, fenster, 'fahrten') : 0)
                    }))
            },
            {
                art: 'groesse',
                titel: t('col.kilometres'),
                einheit: t('unit.kmPeriod', { zeitraum: auswertungenFensterWort() }),
                wert: (z) => (z.summenzeile ? z.summeKm : auswertungenSumme(z, fenster, 'kilometer')),
                format: (n) => kmFormat(n),
                // RANG 4 DER FARBORDNUNG - dieselben drei Toene wie in
                // der Flotte und im Umsatz nach Radtyp. Hier traegt die
                // Groesse den Balken ohne Vorbehalt: 6.022 / 13.567 /
                // 30.362 km, Verhaeltnis 5,0 zu 1.
                farbe: (z) => kategorieFarbe(z.schluessel) || 'var(--marine)'
            },
            {
                art: 'profil',
                titel: t('col.monthlyCourse'),
                einheit: `${monatFormat(fenster[0])} - ${monatFormat(fenster[fenster.length - 1])}`,
                reihe: (z) => (z.summenzeile ? null : auswertungenReihe(z, fenster, 'kilometer')),
                aktuellIndex: fenster.length - 1,
                beschriftung: (z) => {
                    const reihe = auswertungenReihe(z, fenster, 'kilometer');
                    const hoechster = Math.max(...reihe);
                    return t('board.monthlyCourseAria', {
                        name: z.name, vonMonat: monatFormat(fenster[0]),
                        bisMonat: monatFormat(fenster[fenster.length - 1]),
                        max: kmFormat(hoechster), maxMonat: monatFormat(fenster[reihe.indexOf(hoechster)]),
                        aktuell: kmFormat(reihe[reihe.length - 1])
                    });
                },
                // Siehe die Begruendung bei der Umsatz-Tafel weiter oben.
                beschriftungTeil: (z, index, wert) => t('board.seriesPartPhrase', {
                    teil: monatFormat(fenster[index]), wert: kmFormat(wert)
                })
            },
            {
                art: 'abweichung',
                titel: t('col.kmPerRideDeviation'),
                einheit: t('unit.kmPerRide'),
                wert: (z) => (z.summenzeile ? null : Math.round((kmJeFahrt(z) - kmJeFahrtGesamt) * 100) / 100),
                format: (n) => abweichungText(n, 2),
                beschriftung: (z) => t('board.kmPerRideAria', {
                    name: z.name, je: kmFormat(kmJeFahrt(z)), schnitt: kmFormat(kmJeFahrtGesamt)
                })
            }
        ],
        zeilen: gruppen,
        summe: { summenzeile: true, name: t('col.together'), summeKm: kmGesamt, jeMonat: new Map() },
        fussnote: t('board.kmFootnote', {
            anteil: prozentFormatFein(schaetzanteil), ungewichtet: prozentFormatFein(ungewichtetFenster),
            alleGewichtet: prozentFormatFein(gewichtetAlle), alleUngewichtet: prozentFormatFein(ungewichtetAlle),
            monatszeilen: mengeFormat(zeilen.length, 'monatszeile')
        })
    };
}

// ===== Reiter "Stationsauslastung" =====
//
// Dieselben zehn Stationen wie im Bereich "Stationen", aber eine andere
// Frage: dort geht es um den Bestand JETZT (wie voll ist welche
// Station), hier um die ueber die gesamte Historie gezaehlte Bewegung.
//
// ===== ZWEI SPALTEN HABEN DIE PRUEFUNG NICHT BESTANDEN =====
//
// ERSTENS DIE GROESSE. Sie zeigte die Bewegungen (Abgaenge plus
// Zugaenge): 2.310 bis 2.488 ueber zehn Stationen - Verhaeltnis 1,08 zu
// 1. Zehn Balken zwischen 93 und 100 Prozent Laenge, also zehn gleich
// lange Balken. Die alte Fussnote gab das sogar zu ("die Nachfrage ist
// gleichmaessig verteilt") - eine Grafik, die ihre eigene Nutzlosigkeit
// in der Fussnote erklaert, gehoert ersetzt, nicht erklaert.
// Jetzt steht dort die Bewegung JE STELLPLATZ: 57,8 (Hubland) bis 117,1
// (Zellerau), Verhaeltnis 2,0 zu 1. Derselbe Befund wie im Bereich
// "Stationen" und aus demselben Grund lesenswert - die Nachfrage ist
// gleich verteilt, die Kapazitaet nicht. Die absolute Bewegungszahl
// bleibt als reine Zahl daneben stehen (art:'zahl'), sie ist die
// Grundlage der Rechnung und darf nicht verschwinden.
//
// ZWEITENS DIE BELEGUNG. Der 100-%-Strukturbalken "belegt / frei" zeigte
// exakt denselben Quotienten wie die Fuellstandsspalte daneben - zweimal
// dieselbe Zahl, einmal als Flaeche, einmal als Punkt. Von den beiden
// bleibt der PUNKT: er sitzt auf einer Achse von 30 bis 70 Prozent und
// nutzt damit die volle Spaltenbreite, waehrend der Strukturbalken
// dieselben zehn Werte in das mittlere Drittel einer 0-bis-100-Skala
// druckte (genau der Befund des Auftraggebers: "nutzt sie den
// verfuegbaren Bereich, oder drueckt sie zehn Werte in ein Drittel der
// Breite?").
function stationsauslastungKopftafel(zeilen) {
    if (!zeilen || zeilen.length === 0) return null;

    const fahrtenVon = (z) => (Number(z.abgaenge) || 0) + (Number(z.zugaenge) || 0);
    const fuellstandVon = (z) => (z.kapazitaet ? (Number(z.belegt) || 0) / z.kapazitaet : 0);
    // VERHAELTNISZAHL AUS SUMMEN (Hausregel): Bewegungen dieser Station
    // geteilt durch ihre Stellplaetze. Dieselbe Rechnung wie
    // umschlagVon() in stationen.js - beide Tafeln muessen dieselbe Zahl
    // nennen, sonst haette VeloCity zwei Wahrheiten ueber Zellerau.
    const umschlagVon = (z) => (z.kapazitaet ? fahrtenVon(z) / z.kapazitaet : null);
    const abgaenge = zeilen.map((z) => Number(z.abgaenge) || 0);

    return {
        titel: t('board.stationLoadTitle'),
        // Diese Tafel mischt zwei Zeitbezuege, und das muss sie sagen:
        // belegt/fuellstand kommen aus fahrrad_position und gelten JETZT,
        // abgaenge/zugaenge zaehlen JEDE abgeschlossene Ausleihe seit
        // Betriebsbeginn (siehe v_wawi_stationsauslastung in
        // 0018_wawi_sichten.sql - dort steht keine Zeitgrenze). Ein
        // einzelner Zeitraum waere hier falsch, ein einzelner
        // Zeitstempel ebenso.
        zeit: t('board.stationLoadTime'),
        bezug: t('board.stationLoadReference', {
            stationenPhrase: mengeFormat(zeilen.length, 'station'),
            fahrten: zahlFormat(zeilen.reduce((s, z) => s + (Number(z.abgaenge) || 0), 0))
        }),
        spalten: [
            {
                art: 'rubrik',
                titel: t('col.station'),
                wert: (z) => z.name,
                zusatz: (z) => (z.summenzeile ? null : z.stationsnummer)
            },
            {
                // OHNE BALKEN UND OHNE GROESSENSKALA, beides geprueft
                // (skala: true waere moeglich, siehe kopftafelSkala() in
                // rahmen.js, und ist ausdruecklich NICHT gesetzt). Die
                // zehn Stationen liegen bei 2.310 bis 2.488 Bewegungen,
                // ein Verhaeltnis von 1,08 zu 1: als Groesse waeren das
                // 17,97 bis 18,20 px - 0,23 px Spanne, weniger als ein
                // Bildschirmpunkt. Was die Tafel zu sagen hat, sagt die
                // UMSCHLAGSPALTE daneben, die dieselbe Groesse auf die
                // Stellplaetze bezieht und dadurch auf 49 bis 100
                // Prozent Balkenlaenge spreizt - und die Saldospalte
                // rechts. Genau das steht auch in der Fussnote dieser
                // Tafel: die Bewegungen selbst unterscheiden sich kaum.
                art: 'zahl',
                titel: t('col.movements'),
                einheit: t('unit.departuresPlusArrivals'),
                wert: (z) => (z.summenzeile ? z.summeFahrten : fahrtenVon(z)),
                format: (n) => zahlFormat(n)
            },
            {
                // BALKEN HIER, LAGEPUNKT IN stationen.js - und das ist
                // kein Versehen: dort ist die Groessenspalte bereits von
                // der Belegung besetzt, der Umschlag steht also in der
                // Profilspalte und kodiert Position. Hier ist die
                // Groessenspalte frei, und ein Balken vom Nullpunkt ist
                // die staerkere Darstellung, solange die Werte ihn
                // tragen: 57,8 bis 117,1 ergeben Balkenlaengen von 49 bis
                // 100 Prozent - ein halber Balken Unterschied zwischen
                // Hubland und Zellerau. (Zum Vergleich: die abgeloeste
                // Bewegungsspalte lag bei 93 bis 100 Prozent.)
                art: 'groesse',
                titel: t('col.turnover'),
                einheit: t('unit.movementsPerDock'),
                wert: (z) => (z.summenzeile ? null : umschlagVon(z)),
                format: (n) => zahlFormat(n, { maximumFractionDigits: 0 }),
                beschriftung: (z) => t('board.stationTurnoverAria', {
                    name: z.name,
                    wert: zahlFormat(umschlagVon(z) ?? 0, { maximumFractionDigits: 0 }),
                    kapazitaet: zahlFormat(z.kapazitaet)
                })
            },
            {
                art: 'profil',
                titel: t('col.fillLevel'),
                einheit: t('unit.zeroToHundred'),
                punkt: (z) => (z.summenzeile ? null : Math.round(fuellstandVon(z) * 100)),
                beschriftung: (z) => t('board.fillLevelAria', {
                    name: z.name, prozent: zahlFormat(Math.round(fuellstandVon(z) * 100))
                })
            },
            {
                art: 'abweichung',
                titel: t('col.balance'),
                einheit: t('unit.ridesArrivalsMinusDepartures'),
                wert: (z) => (z.summenzeile ? null : Number(z.saldo) || 0),
                format: (n) => abweichungText(n, 0),
                beschriftung: (z) => t('board.stationBalanceAria', {
                    name: z.name, zugaenge: zahlFormat(z.zugaenge), abgaenge: zahlFormat(z.abgaenge),
                    saldo: zahlFormat(z.saldo)
                })
            }
        ],
        zeilen,
        summe: {
            summenzeile: true, name: t('col.together'),
            summeFahrten: zeilen.reduce((s, z) => s + fahrtenVon(z), 0),
            belegt: zeilen.reduce((s, z) => s + (Number(z.belegt) || 0), 0),
            kapazitaet: zeilen.reduce((s, z) => s + z.kapazitaet, 0)
        },
        // Der eigentliche Befund dieser Tafel steht in der Saldospalte
        // rechts (-65 bis +122 ueber zehn Stationen, Verhaeltnis 30 zu 1
        // zwischen groesstem und kleinstem Betrag) - alles, was ein
        // Disponent hier zu entscheiden hat, steht dort. Die Fussnote
        // nennt die Zahl, die das begruendet: die Abgaenge selbst
        // unterscheiden sich kaum.
        fussnote: t('board.stationLoadFootnote', {
            min: zahlFormat(Math.min(...abgaenge)), max: zahlFormat(Math.max(...abgaenge))
        })
    };
}

// async wegen des Drill-Downs (monatsdrilldownEinfuegen() lädt die
// Tageszahlen nach) - zeileWaehlen() in rahmen.js ruft diese Funktion
// ohne await auf, das ist hier gewollt: die Grundmaske (zeigeMaske())
// steht synchron sofort, die Tagesgrafik hängt sich erst danach an, wenn
// ihre eigene Ladeanfrage zurück ist.
async function umsatzRadtypMaske(zeile) {
    zeigeMaske(`${zeile.typ} · ${monatFormat(zeile.monat)}`, [
        { name: 'typ',            titel: t('field.radtyp'),    wert: `${zeile.typ} (${zeile.typ_code})`, nurLesen: true },
        { name: 'monat',          titel: t('field.monat'),      wert: monatFormat(zeile.monat), nurLesen: true },
        { name: 'fahrten',        titel: t('field.fahrten'),    wert: zahlFormat(zeile.fahrten), nurLesen: true },
        { name: 'minuten',        titel: t('field.minuten'),    wert: zahlFormat(zeile.minuten), nurLesen: true },
        { name: 'umsatz',         titel: t('field.umsatz'),     wert: geldFormat(zeile.umsatz), nurLesen: true },
        { name: 'umsatz_je_fahrt', titel: t('field.jeFahrt'),  wert: geldFormat(zeile.umsatz_je_fahrt), nurLesen: true },
        { name: 'minuten_je_fahrt', titel: t('field.minutenJeFahrt'), wert: minutenFormat(zeile.minutenJeFahrt), nurLesen: true },
        { name: 'veraenderung',   titel: t('field.deltaVormonat'), wert: veraenderungFormat(zeile.veraenderungJeFahrt), nurLesen: true }
    ], []);
    await monatsdrilldownEinfuegen(zeile.monat);
}

// ===== Umsatz nach Kundengruppe =====

async function umsatzKundengruppeZeigen(vorgang) {
    const zeilen = await ladeListe('v_wawi_umsatz_kundengruppe',
        'monat, tarif_code, tarif, kunden, fahrten, umsatz, umsatz_je_kunde',
        (q) => q.order('monat').order('tarif_code'));

    const fehler = letzterLadeFehler('v_wawi_umsatz_kundengruppe');
    if (fehler) {
        zeigeKopftafel(vorgang, null);
        meldeVorgang(vorgang, t('msg.revenueByCustomerGroupLoadFailed', { fehler }), 'schlecht');
        return;
    }

    if (zeilen.length === 0) {
        zeigeKopftafel(vorgang, null);
        zeigeLeermaske(
            vorgang,
            t('empty.noRevenueByCustomerGroupTitle'),
            t('empty.noRevenueByBikeTypeText')
        );
        meldeVorgang(vorgang, t('empty.noRevenueByCustomerGroupTitle'));
        return;
    }

    // fahrtenJeKunde: dieselbe clientseitige Rechnung wie minutenJeFahrt
    // im Radtyp-Reiter (siehe dortiger Kommentar) - fahrten und kunden
    // sind bereits korrekt aggregierte Summen DERSELBEN Zeile (ein Monat,
    // ein Tarif), die Division innerhalb dieser einen Zeile faellt nicht
    // in die Mittelwert-Falle. Beantwortet eine andere Frage als
    // umsatz_je_kunde (Geld je Kopf): wie OFT nutzt eine Kundengruppe ihre
    // Mitgliedschaft im Monat - "OHNE Mitgliedschaft" fährt nur, wer
    // gerade ein Rad braucht, "STUDENT"/"BASIS" pendeln damit. Gegen die
    // Datenbank nachgerechnet (Bericht): ueber den gesamten Bestand liegt
    // "OHNE" bei rund 8 Fahrten je Kunde, jede echte Mitgliedschaft bei
    // rund 20 - ein Unterschied, den umsatz_je_kunde allein nicht zeigt.
    // tarif wird HIER schon auf den Anzeigenamen gesetzt (siehe
    // tarifAnzeige() weiter unten), nicht erst ueber ein formatieren:
    // in der Spaltendefinition: die Spalte ist sortier-, filter- und
    // gruppierbar (siehe zeigeListe() in rahmen.js), und alle drei
    // arbeiten auf dem FELDWERT. Waere nur die Anzeige uebersetzt,
    // stuende im Filterfeld weiterhin der deutsche Rohwert - man muesste
    // "Ohne Mitgliedschaft" eintippen, um "Sin tarifa activa" zu
    // finden. tarif_code bleibt unveraendert daneben stehen und traegt
    // weiterhin den Gruppierungsschluessel.
    const zeilenMitFahrtenJeKunde = zeilen.map((z) => (
        { ...z, tarif: tarifAnzeige(z), fahrtenJeKunde: z.kunden ? z.fahrten / z.kunden : null }
    ));

    const umsatzMaximum = Math.max(...zeilen.map((z) => z.umsatz));
    zeigeListe(vorgang, zeilenMitFahrtenJeKunde, [
        { feld: 'monat',           titel: t('field.monat'),      formatieren: (w) => monatFormat(w) },
        { feld: 'tarif',           titel: t('field.tarif') },
        // 'kunden' bewusst NICHT summierbar (anders als 'fahrten'/'umsatz'
        // unten): die Spalte zaehlt Kunden JE MONAT - dieselbe Person mit
        // einer laufenden Mitgliedschaft steckt in zwoelf Monatszeilen
        // zwoelfmal. Eine Gruppen-Zwischensumme ueber mehrere Monate (etwa
        // nach Tarif gruppiert) wuerde sie zwoelfmal zaehlen - derselbe
        // Fehlertyp wie beim ungewichteten Schaetzanteil bei CO2
        // (53,2 % statt 40,0 %, siehe anteilGewichtet() weiter oben):
        // "man summiert Durchschnitte/Bestandszaehlungen nicht, man
        // gewichtet bzw. zaehlt sie neu" (Auftrag).
        { feld: 'kunden',          titel: t('field.kunden'),     formatieren: zahlFormat, klasse: zahlKlasse() },
        // summierbar: eine Fahrt gehoert zu GENAU einem Monat, additiv
        // ueber Monate - kein Doppelzaehl-Risiko wie bei 'kunden' oben.
        { feld: 'fahrten',         titel: t('field.fahrten'),    formatieren: zahlFormat, klasse: zahlKlasse(), summierbar: true },
        // Dieselbe gemeinsame Skala wie im Radtyp-Reiter (Hichert:
        // einheitliche Notation über alle Auswertungen) - hier über die
        // Zeilen DIESER Tabelle, nicht über beide Umsatztabellen
        // gemeinsam, weil "Umsatz je Monat und Tarif" und "Umsatz je
        // Monat und Radtyp" unterschiedliche Vergleichsgruppen sind.
        // Balken/Betrag in zwei Spalten (balkenSpalten(), siehe
        // Kommentar dort und im Radtyp-Reiter oben). summierbar: derselbe
        // additive Umsatz wie im Radtyp-Reiter.
        ...balkenSpalten('umsatz', t('field.umsatz'), umsatzMaximum, geldFormat, { summierbar: true }),
        {
            feld: 'umsatz_je_kunde', titel: t('field.jeKunde'), klasse: zahlKlasse(),
            formatieren: (w) => zahlSkaliert(geldFormat(w))
        },
        // Siehe Kommentar bei zeilenMitFahrtenJeKunde oben. NICHT
        // summierbar - ein Verhaeltnis, derselbe Fehlertyp wie
        // umsatz_je_kunde.
        {
            feld: 'fahrtenJeKunde', titel: t('field.fahrtenJeKunde'), klasse: zahlKlasse(),
            formatieren: (w) => zahlSkaliert(zahlFormatFein(w))
        }
    ], umsatzKundengruppeMaske);

    zeigeKopftafel(vorgang, umsatzKundengruppeKopftafel(zeilen));

    // Dieselbe Gesamtsumme wie im Radtyp-Reiter (35 454,47 € - beide
    // Sichten summieren dieselben Entgeltpositionen, nur anders
    // gruppiert). Zwei getrennte Wege zu derselben Zahl sind die
    // Gegenprobe, die Schritt 3 des Auftrags verlangt - stimmen sie
    // nicht überein, ist eine der beiden Gruppierungen fehlerhaft.
    const gesamtUmsatz = zeilen.reduce((s, z) => s + z.umsatz, 0);
    meldeVorgang(vorgang, t('msg.revenueByCustomerGroupSummary', { monatszeilen: mengeFormat(zeilen.length, 'monatszeile'), umsatz: geldFormat(gesamtUmsatz) }));
}


// async wegen des Drill-Downs - siehe Kommentar bei umsatzRadtypMaske().
async function umsatzKundengruppeMaske(zeile) {
    zeigeMaske(`${zeile.tarif} · ${monatFormat(zeile.monat)}`, [
        { name: 'tarif',           titel: t('field.tarif'),    wert: `${zeile.tarif} (${zeile.tarif_code})`, nurLesen: true },
        { name: 'monat',           titel: t('field.monat'),    wert: monatFormat(zeile.monat), nurLesen: true },
        { name: 'kunden',          titel: t('field.kunden'),   wert: zahlFormat(zeile.kunden), nurLesen: true },
        { name: 'fahrten',         titel: t('field.fahrten'),  wert: zahlFormat(zeile.fahrten), nurLesen: true },
        { name: 'umsatz',          titel: t('field.umsatz'),   wert: geldFormat(zeile.umsatz), nurLesen: true },
        { name: 'umsatz_je_kunde', titel: t('field.jeKunde'), wert: geldFormat(zeile.umsatz_je_kunde), nurLesen: true },
        { name: 'fahrten_je_kunde', titel: t('field.fahrtenJeKunde'), wert: zahlFormatFein(zeile.fahrtenJeKunde), nurLesen: true }
    ], []);
    await monatsdrilldownEinfuegen(zeile.monat);
}

// ===== Kilometer und CO2 =====

async function kmCo2Zeigen(vorgang) {
    // ZWEITE, WINZIGE LADEANFRAGE FUER DIE AUSGESCHRIEBENEN RADTYPNAMEN -
    // die Angleichung an die Flottentafel (Auftrag) verlangt sie, siehe
    // die ausfuehrliche Begruendung bei kmCo2Kopftafel() weiter unten.
    // v_wawi_km_co2 fuehrt nur typ_code; v_wawi_modell fuehrt beides und
    // ist mit fuenf Zeilen kein Preis. Genau derselbe Weg, den
    // instandhaltungAufbauen() in instandhaltung.js fuer dasselbe
    // Problem schon geht - eine zweite Bauart dafuer waere eine zu viel.
    // Promise.all: die beiden Anfragen haengen nicht voneinander ab.
    const [zeilen, modelleFuerTypnamen] = await Promise.all([
        ladeListe('v_wawi_km_co2',
            'monat, typ_code, fahrten, kilometer, fahrten_geschaetzt, anteil_geschaetzt, co2_ersparnis_kg',
            (q) => q.order('monat').order('typ_code')),
        ladeListe('v_wawi_modell', 'typ_code, typ')
    ]);
    // Ein Ladefehler HIER darf die Tafel nicht verhindern - der Radtypname
    // ist eine Beschriftung, keine Kennzahl. Faellt v_wawi_modell aus,
    // bleibt die Karte leer, und kmCo2Kopftafel() faellt je Zeile auf den
    // typ_code zurueck (siehe dort). Dieselbe Haltung wie bei den
    // Stationen: "lieber eine Spalte weniger als eine erfundene" - hier
    // sogar nur "lieber ein Kuerzel als gar keine Zeile".
    const radtypNamen = new Map(modelleFuerTypnamen.map((m) => [m.typ_code, m.typ]));
    // Derselbe Rueckfall wie in kmCo2Kopftafel(): faellt v_wawi_modell
    // aus, steht wieder der typ_code da - kurz, aber wahr.
    const typName = (code) => radtypNamen.get(code) || code;

    const fehler = letzterLadeFehler('v_wawi_km_co2');
    if (fehler) {
        zeigeKopftafel(vorgang, null);
        meldeVorgang(vorgang, t('msg.kmCo2LoadFailed', { fehler }), 'schlecht');
        return;
    }

    if (zeilen.length === 0) {
        zeigeKopftafel(vorgang, null);
        zeigeLeermaske(
            vorgang,
            t('empty.noKmCo2Title'),
            t('empty.noRevenueByBikeTypeText')
        );
        meldeVorgang(vorgang, t('empty.noKmCo2Title'));
        return;
    }

    // In der LISTE bleibt der typ_code stehen, und das ist kein
    // Widerspruch zur ausgeschriebenen Bezeichnung in der Kopftafel
    // darueber (siehe kmCo2Kopftafel()): die Arbeitsliste der Flotte
    // fuehrt ihre Radtypspalte ebenfalls als typ_code (siehe flotte.js) -
    // eine Datenspalte in einer langen Tabelle darf das kurze Kuerzel
    // tragen, eine Zeilenbeschriftung im Kopf nicht, weil sie dort die
    // einzige Benennung der Zeile ist. Beide Gewohnheiten sind damit je
    // fuer sich einheitlich, quer ueber alle Bereiche.
    // kilometerJeFahrt: dieselbe clientseitige Rechnung wie
    // minutenJeFahrt/fahrtenJeKunde in den beiden Reitern davor (siehe
    // dortiger Kommentar) - kilometer und fahrten sind bereits korrekt
    // aggregierte Summen DERSELBEN Zeile. Beantwortet, wie weit eine
    // typische Fahrt dieses Radtyps geht - anders als "Kilometer" (Summe
    // je Monat, oben) unabhaengig davon, wie viele Fahrten im Monat
    // stattfanden, und damit zwischen Radtypen mit sehr unterschiedlicher
    // Flottengroesse (Cargo: 25 Räder, City: 198, siehe Bericht)
    // tatsaechlich vergleichbar.
    // typ wird HIER gesetzt, aus derselben Namenskarte wie die Kopftafel
    // darueber (siehe kmCo2Zeigen()/kmCo2Kopftafel()): der Radtyp heisst
    // in dieser Oberflaeche ueberall gleich - in der Filterleiste, in der
    // Kopftafel, in der Liste und in der Maske. Als echtes FELD und nicht
    // ueber ein formatieren: in der Spaltendefinition, weil Sortieren,
    // Filtern und Gruppieren auf dem Feldwert arbeiten (siehe zeigeListe()
    // in rahmen.js) - sonst stuende im Filterfeld weiterhin "CITY",
    // waehrend die Zelle daneben "City-Bike" zeigt. typ_code bleibt
    // unveraendert erhalten und traegt weiterhin jede Gruppierung im
    // Programmtext.
    const zeilenMitKmJeFahrt = zeilen.map((z) => (
        { ...z, typ: typName(z.typ_code), kilometerJeFahrt: z.fahrten ? z.kilometer / z.fahrten : null }
    ));

    const kilometerMaximum = Math.max(...zeilen.map((z) => z.kilometer));
    zeigeListe(vorgang, zeilenMitKmJeFahrt, [
        { feld: 'monat',    titel: t('field.monat'),   formatieren: (w) => monatFormat(w) },
        { feld: 'typ',      titel: t('field.radtyp') },
        // summierbar: Fahrten je Monat/Radtyp, additiv - kein
        // Doppelzaehl-Risiko (jede Fahrt gehoert zu genau einer Zeile).
        { feld: 'fahrten',  titel: t('field.fahrten'), formatieren: zahlFormat, klasse: zahlKlasse(), summierbar: true },
        // Balken/Betrag in zwei Spalten (balkenSpalten() in rahmen.js) -
        // siehe Kommentar dort und im Radtyp-Reiter (Gestaltungsauftrag,
        // Punkt 5). summierbar: gefahrene Kilometer sind additiv.
        ...balkenSpalten('kilometer', t('field.kilometer'), kilometerMaximum, kmFormat, { summierbar: true }),
        // Siehe Kommentar bei zeilenMitKmJeFahrt oben. NICHT summierbar -
        // ein Verhaeltnis, derselbe Fehlertyp wie umsatz_je_fahrt.
        {
            feld: 'kilometerJeFahrt', titel: t('field.kilometerJeFahrt'), klasse: zahlKlasse(),
            formatieren: (w) => zahlSkaliert(kmFormat(w))
        },
        {
            // Schritt 2 des Auftrags, korrigiert - siehe Kommentar bei
            // co2ZelleText()/co2ZelleElement() weiter oben: der
            // Schätzanteil DIESER ZEILE steht direkt neben der Zahl,
            // nicht in einer Fußnote.
            //
            // summierbar: die Kilogramm-Ersparnis selbst ist additiv -
            // NUR die Zahl, nicht der daneben angezeigte Schätzanteil
            // (der ist ein gewichteter Anteil, siehe anteilGewichtet()
            // weiter oben, und wuerde in einer Zwischensumme naiv/falsch
            // gemittelt). summeFormatieren() statt formatieren(): eine
            // Zwischensumme hat keine ZEILE, die co2ZelleElement()
            // bräuchte (die liest zeile.anteil_geschaetzt) - sie bekommt
            // stattdessen nur die reine kg-Zahl, ohne (falschen) Anteil.
            feld: 'co2_ersparnis_kg', titel: t('field.co2Ersparnis'),
            formatieren: (w, z) => co2ZelleElement(z), klasse: zahlKlasse(),
            summierbar: true, summeFormatieren: (summe) => kgFormat(summe)
        }
    ], kmCo2Maske);

    zeigeKopftafel(vorgang, kmCo2Kopftafel(zeilen, radtypNamen));

    // Die Kontrollrechnung aus Schritt 3: Gesamtersparnis UND der
    // fahrtgewichtete Gesamtanteil - NICHT der Mittelwert der
    // anteil_geschaetzt-Spalte. anteilGewichtet() siehe oben.
    const gesamtCo2 = zeilen.reduce((s, z) => s + z.co2_ersparnis_kg, 0);
    const gesamtFahrten = zeilen.reduce((s, z) => s + z.fahrten, 0);
    meldeVorgang(vorgang, t('msg.kmCo2Summary', {
        monatszeilen: mengeFormat(zeilen.length, 'monatszeile'), fahrten: mengeFormat(gesamtFahrten, 'fahrt'),
        co2: kgFormat(gesamtCo2), prozent: prozentFormat(anteilGewichtet(zeilen))
    }));
}


// async wegen des Drill-Downs - siehe Kommentar bei umsatzRadtypMaske().
async function kmCo2Maske(zeile) {
    // Titel und erstes Feld wie in umsatzRadtypMaske() weiter oben:
    // Produktname vorn, Kuerzel in Klammern. zeile.typ setzt
    // kmCo2Zeigen() beim Aufbau der Zeilen (siehe dort) - dieselbe
    // Benennung wie in Kopftafel, Liste und Filterleiste.
    zeigeMaske(`${zeile.typ} · ${monatFormat(zeile.monat)}`, [
        { name: 'typ',      titel: t('field.radtyp'),    wert: `${zeile.typ} (${zeile.typ_code})`, nurLesen: true },
        { name: 'monat',    titel: t('field.monat'),      wert: monatFormat(zeile.monat), nurLesen: true },
        { name: 'fahrten',  titel: t('field.fahrten'),    wert: zahlFormat(zeile.fahrten), nurLesen: true },
        { name: 'kilometer', titel: t('field.kilometer'), wert: kmFormat(zeile.kilometer), nurLesen: true },
        { name: 'kilometer_je_fahrt', titel: t('field.kilometerJeFahrt'), wert: kmFormat(zeile.kilometerJeFahrt), nurLesen: true },
        {
            name: 'fahrten_geschaetzt', titel: t('field.davonGeschaetzt'),
            wert: t('misc.estimatedRidesDetail', {
                geschaetzt: zahlFormat(zeile.fahrten_geschaetzt), fahrtenPhrase: mengeFormat(zeile.fahrten, 'fahrt'),
                prozent: prozentFormat(zeile.anteil_geschaetzt) }),
            nurLesen: true
        },
        { name: 'co2_ersparnis_kg', titel: t('field.co2Ersparnis'), wert: co2ZelleText(zeile), nurLesen: true }
    ], []);
    await monatsdrilldownEinfuegen(zeile.monat);
}

// ===== Stationsauslastung =====
//
// Anders als die drei Reiter davor liefert diese Sicht KEINE Monatszeilen
// - v_wawi_stationsauslastung führt keine monat-Spalte (siehe
// 0018_wawi_sichten.sql: station_id, stationsnummer, name, kapazitaet,
// abgaenge, zugaenge, saldo, belegt, fuellstand). Sie ist eine
// Gesamtstands-Momentaufnahme je Station über den kompletten Bestand an
// abgeschlossenen Ausleihen, nicht nach Monat gruppiert. Der Auftragstext
// ("Jede als Tabelle mit Monatszeilen") beschreibt damit für diesen
// vierten Reiter nicht, was die Sicht liefert - gegen die tatsächlichen
// Spalten geprüft (0018_wawi_sichten.sql), nicht vermutet. Eine Zeile je
// Station ist die einzige Darstellung, die zu den Spalten passt.
async function stationsauslastungZeigen(vorgang) {
    const zeilen = await ladeListe('v_wawi_stationsauslastung',
        'station_id, stationsnummer, name, kapazitaet, abgaenge, zugaenge, saldo, belegt, fuellstand',
        (q) => q.order('stationsnummer'));

    const fehler = letzterLadeFehler('v_wawi_stationsauslastung');
    if (fehler) {
        zeigeKopftafel(vorgang, null);
        meldeVorgang(vorgang, t('msg.stationOccupancyLoadFailed', { fehler }), 'schlecht');
        return;
    }

    if (zeilen.length === 0) {
        zeigeKopftafel(vorgang, null);
        zeigeLeermaske(
            vorgang,
            t('empty.noStationOccupancyTitle'),
            t('empty.noStationOccupancyText')
        );
        meldeVorgang(vorgang, t('empty.noStationOccupancyTitle'));
        return;
    }

    zeigeListe(vorgang, zeilen, [
        { feld: 'stationsnummer', titel: t('field.nummer') },
        { feld: 'name',           titel: t('field.station') },
        // summierbar bei kapazitaet/belegt/abgaenge/zugaenge/saldo: jede
        // Zeile ist eine EIGENE Station, jeder Wert eine echte Zaehlung
        // fuer genau diese Station (kein Durchschnitt, keine Zeile, die
        // in mehreren Gruppen gleichzeitig steckt) - eine Zwischensumme
        // ueber eine Gruppe von Stationen (z. B. "alle mit negativem
        // Saldo", falls danach gruppiert wird) ist additiv unbedenklich.
        // 'fuellstand' bleibt bewusst NICHT summierbar: das ist ein
        // Verhaeltnis (belegt/kapazitaet), Verhaeltnisse summiert man
        // nicht - derselbe Fehlertyp wie bei umsatz_je_fahrt.
        { feld: 'kapazitaet',     titel: t('field.kapazitaet'), formatieren: zahlFormat, klasse: zahlKlasse(), summierbar: true },
        { feld: 'belegt',         titel: t('field.belegt'),    formatieren: zahlFormat, klasse: zahlKlasse(), summierbar: true },
        { feld: 'abgaenge',       titel: t('field.abgaenge'),   formatieren: zahlFormat, klasse: zahlKlasse(), summierbar: true },
        { feld: 'zugaenge',       titel: t('field.zugaenge'),   formatieren: zahlFormat, klasse: zahlKlasse(), summierbar: true },
        {
            // Farbe trägt Bedeutung: eine Station, die dauerhaft mehr
            // Raeder abgibt als sie bekommt (Saldo negativ), blutet leer
            // und muss von Hand nachgefüllt werden - keine Dekoration,
            // sondern derselbe Signalgedanke wie "frei" in stationen.js.
            feld: 'saldo', titel: t('field.saldo'), summierbar: true,
            formatieren: (w) => (w > 0 ? `+${zahlFormat(w)}` : zahlFormat(w)),
            klasse: (z) => zahlKlasse(z.saldo < 0 ? 'warnung' : z.saldo > 0 ? 'gut' : '')
        },
        // Bissantz-Balken an einer FESTEN gemeinsamen Skala (0-100 %,
        // nicht das Maximum dieser Liste) - anders als bei den
        // Umsatzspalten ist hier die Obergrenze fachlich vorgegeben (eine
        // Station kann nicht mehr als voll sein), keine relative Größe
        // unter den zehn Zeilen. Farbe wie in der Textspalte daneben:
        // bernstein, sobald die Station voll ist - als Funktion an
        // balkenSpalten() übergeben, weil sie vom WERT dieser Zeile
        // abhängt (siehe Kommentar dort). Balken/Betrag in zwei Spalten,
        // aus demselben Grund wie in den drei Reitern davor
        // (Gestaltungsauftrag, Punkt 5). Kein summierbar hier (Vorgabe
        // false) - fuellstand ist ein Verhaeltnis, siehe Kommentar oben.
        ...balkenSpalten('fuellstand', t('field.fuellstand'), 1, prozentFormat, {
            farbe: (w) => (w >= 1 ? 'var(--warnung-text)' : 'var(--marine)'),
            klasse: (z) => zahlKlasse(z.fuellstand >= 1 ? 'warnung' : '')
        })
    ], stationsauslastungMaske);

    zeigeKopftafel(vorgang, stationsauslastungKopftafel(zeilen));

    const leer = zeilen.filter((z) => z.belegt === 0).length;
    meldeVorgang(vorgang, `${mengeFormat(zeilen.length, 'station')}${leer ? t('msg.stationsWithoutBikeSuffix', { n: zahlFormat(leer) }) : ''}`);
}


function stationsauslastungMaske(zeile) {
    zeigeMaske(`${zeile.stationsnummer} · ${zeile.name}`, [
        { name: 'kapazitaet', titel: t('field.kapazitaet'), wert: zahlFormat(zeile.kapazitaet), nurLesen: true },
        { name: 'belegt',     titel: t('field.belegt'),    wert: zahlFormat(zeile.belegt), nurLesen: true },
        { name: 'abgaenge',   titel: t('field.abgaenge'),   wert: zahlFormat(zeile.abgaenge), nurLesen: true },
        { name: 'zugaenge',   titel: t('field.zugaenge'),   wert: zahlFormat(zeile.zugaenge), nurLesen: true },
        { name: 'saldo',      titel: t('field.saldo'),     wert: zahlFormat(zeile.saldo), nurLesen: true },
        { name: 'fuellstand', titel: t('field.fuellstand'), wert: prozentFormat(zeile.fuellstand), nurLesen: true }
    ], []);
}
