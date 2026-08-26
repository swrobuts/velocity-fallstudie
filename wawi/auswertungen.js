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
    titel: 'Auswertungen',
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
    rollen: ['leitung'],
    aufbauen: auswertungenAufbauen
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

    zeigeUnterreiter(vorgang, [
        { schluessel: 'umsatz_radtyp',       titel: 'Umsatz nach Radtyp' },
        { schluessel: 'umsatz_kundengruppe', titel: 'Umsatz nach Kundengruppe' },
        { schluessel: 'km_co2',              titel: 'Kilometer und CO₂' },
        { schluessel: 'stationsauslastung',  titel: 'Stationsauslastung' }
    ], auswertungenReiter, async (gewaehlt) => {
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

// ===== Zahlenformat =====
//
// Deutsches Format (Komma als Dezimaltrennzeichen, Punkt als Tausender-
// trennzeichen) - dasselbe Muster wie euro() in src/script.js, hier nur
// mit Währungszeichen NACH der Zahl statt als Wort ausgeschrieben, weil
// eine Arbeitsmaske knapper sein darf als ein Kundentext. Nur in dieser
// Datei gebraucht, deshalb kein eigener Baustein in rahmen.js.
function geldFormat(betrag) {
    return Number(betrag).toLocaleString('de-DE',
        { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

function zahlFormat(zahl) {
    return Number(zahl).toLocaleString('de-DE');
}

function kmFormat(km) {
    return Number(km).toLocaleString('de-DE',
        { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' km';
}

function kgFormat(kg) {
    return Number(kg).toLocaleString('de-DE',
        { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' kg';
}

function prozentFormat(anteil) {
    return `${Math.round(anteil * 100)} %`;
}

// Eine Nachkommastelle statt gerundeter ganzer Prozent - nur für die
// Übersichtskacheln, wo genau EIN Prozentwert (der
// fahrtgewichtete Schätzanteil, siehe anteilGewichtet()) gegen einen
// zweiten, absichtlich falschen Vergleichswert steht (40,0 % gegen
// 53,2 % - siehe kmCo2Uebersicht()) - ohne die Nachkommastelle sähen
// zwei nah beieinanderliegende, aber unterschiedliche Werte nach
// Rundung leicht gleich aus. Die Tabellenspalten selbst bleiben bei der
// gröberen prozentFormat(), die reicht dort aus.
function prozentFormatFein(anteil) {
    return `${(anteil * 100).toLocaleString('de-DE',
        { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;
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
    return Number(zahl).toLocaleString('de-DE',
        { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function minutenFormat(minuten) {
    return `${zahlFormatFein(minuten)} min`;
}

// monat kommt als Datumstext des Monatsersten ('2026-03-01' o.ae.) über
// PostgREST herein - date_trunc('month', ...)::date in der Sicht. Eine
// Anzeige als "Mär 2026" macht den Jahresgang und den Tarifwechsel zum
// 1. März auf den ersten Blick lesbar, ein rohes ISO-Datum nicht.
const MONATSNAMEN = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
function monatFormat(monat) {
    const [jahr, monatsnummer] = monat.split('-');
    return `${MONATSNAMEN[Number(monatsnummer) - 1]} ${jahr}`;
}

// Ausgeschrieben, nur für den Drill-Down (monatsdrilldownEinfuegen()
// weiter unten): der Auftrag selbst formuliert seine Referenzzahlen mit
// dem vollen Monatsnamen ("der 4. September mit 61 Fahrten"), nicht der
// dreibuchstabigen Kurzform, die monatFormat() für die Tabellenspalte
// verwendet. Zwei Wortlisten für zwei unterschiedliche Zwecke, keine
// Ableitung der einen aus der anderen - "Mär" ließe sich nicht
// zuverlässig zu "März" verlängern, ohne selbst wieder eine Tabelle zu
// pflegen.
const MONATSNAMEN_VOLL = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August',
    'September', 'Oktober', 'November', 'Dezember'];

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
const WOCHENTAGE_KURZ = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
function tagFormat(tag) {
    const [jahr, monat, tagNummer] = tag.split('-').map(Number);
    const wochentag = WOCHENTAGE_KURZ[new Date(jahr, monat - 1, tagNummer).getDay()];
    return `${wochentag}, ${tagNummer}. ${MONATSNAMEN[monat - 1]} ${jahr}`;
}

// Rechtsbündige Zahlenspalte, optional mit einer zweiten Klasse für
// Bedeutung (schlecht/warnung/gut) - siehe Kommentar bei
// ".arbeitstabelle td.zahl" in style.css. zeigeListe() in rahmen.js setzt
// spalte.klasse als EINEN Klassennamen-String (td.className = klasse),
// deshalb hier zusammengesetzt statt als zwei getrennte Klassen erwartet.
function zahlKlasse(zusatz = '') {
    return zusatz ? `zahl ${zusatz}` : 'zahl';
}

// ===== Bausteine für die Übersichtsstreifen (Gestaltungsauftrag, Punkt 1) =====
//
// Reine Rechenhilfen, allgemein über alle vier Reiter - jeder von ihnen
// braucht "eine Reihe je Monat" oder "den Extremwert einer Liste", keiner
// braucht dafür eine eigene Kopie derselben zehn Zeilen.

// zeilen tragen dieselbe Zahl mehrfach (einmal je Radtyp/Tarif in
// diesem Monat) - reiheJeMonat() summiert sie zu EINER Zeile je Monat
// auf, aufsteigend sortiert, für eine Sparkline über den Gesamtverlauf.
function reiheJeMonat(zeilen, feld) {
    const summen = new Map();
    for (const z of zeilen) summen.set(z.monat, (summen.get(z.monat) || 0) + z[feld]);
    return [...summen.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([monat, wert]) => ({ monat, wert }));
}

// Veränderung des letzten gegenüber dem vorletzten Element einer nach
// Monat aufsteigend sortierten Reihe (siehe reiheJeMonat() oben) - für
// die kachel.veraenderung-Zeile der Übersichtskacheln (Gestaltungsauftrag
// Punkt 2, siehe veraenderungZeile() weiter unten). null bei weniger als
// zwei Monaten ODER einem Vormonat von 0 (derselbe Schutz wie bei
// groessterSprung() weiter unten: eine Veränderung "ausgehend von 0" ist
// keine sinnvolle Prozentangabe) - dieselbe "lieber keine Angabe als eine
// falsche" wie überall sonst in dieser Datei.
function letzteVeraenderung(reiheAufsteigend) {
    if (reiheAufsteigend.length < 2) return null;
    const vorher = reiheAufsteigend[reiheAufsteigend.length - 2].wert;
    const jetzt = reiheAufsteigend[reiheAufsteigend.length - 1].wert;
    return vorher ? (jetzt - vorher) / vorher : null;
}

// Das Element mit dem größten (sucheMinimum=false) bzw. kleinsten
// (sucheMinimum=true) Wert in feld - für "die volatilste Station", "der
// schwächste Monat", ohne für jeden Fall eine eigene Schleife.
function extremwert(elemente, feld, sucheMinimum) {
    return elemente.reduce((bisher, el) =>
        (sucheMinimum ? el[feld] < bisher[feld] : el[feld] > bisher[feld]) ? el : bisher);
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
    return `${vorzeichen}${(veraenderung * 100).toLocaleString('de-DE', { maximumFractionDigits: 1 })} %`;
}

// ===== Veränderungszeile für die Übersichtskacheln (Gestaltungsauftrag
// Punkt 2, Vorbild-Auftrag: "▼ −5 ggü. Vorm.") =====
//
// kachel.veraenderung (siehe baueKachel() in rahmen.js) - EIN
// Richtungspfeil plus veraenderungFormat() plus ein Bezugstext ("ggü.
// Vormonat"). Bewusst kein eigenes Farbschema für die Richtung (siehe
// die CSS-Regel bei .uebersichtskachel-veraenderung in style.css für die
// ausführliche Begründung: derselbe Grundsatz wie bei
// veraenderungFormat() selbst, ein Anstieg ist nicht per se gut).
// null (kein Vormonat, siehe veraenderungFormat() oben) liefert KEIN
// Element zurück, sondern null - eine Kachel ohne echten Vergleich soll
// keine leere/sinnlose Veränderungszeile zeigen, sondern gar keine (siehe
// "ohne kachel.veraenderung ändert sich nichts", baueKachel()).
function veraenderungZeile(veraenderung, bezugstext = 'ggü. Vormonat') {
    if (veraenderung === null) return null;
    const zeile = document.createElement('span');
    const pfeil = veraenderung > 0 ? '▲' : veraenderung < 0 ? '▼' : '▬';
    zeile.textContent = `${pfeil} ${veraenderungFormat(veraenderung)} ${bezugstext}`;
    return zeile;
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
    return `${kgFormat(zeile.co2_ersparnis_kg)} (${prozentFormat(zeile.anteil_geschaetzt)} geschätzt)`;
}

function co2ZelleElement(zeile) {
    const wrapper = document.createElement('span');
    wrapper.append(zahlSkaliert(kgFormat(zeile.co2_ersparnis_kg)));
    const hinweis = document.createElement('span');
    hinweis.className = 'zahl-nebenteil';
    hinweis.textContent = ` (${prozentFormat(zeile.anteil_geschaetzt)} geschätzt)`;
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

    const zeilen = await ladeListe('v_wawi_fahrten_je_tag', 'tag, fahrten',
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
    ueberschrift.textContent = `Fahrten je Tag — ${monatFormat(monat)} (gesamt, alle Radtypen und Tarife)`;
    abschnitt.append(ueberschrift);

    const fehler = letzterLadeFehler('v_wawi_fahrten_je_tag');
    if (fehler) {
        const hinweis = document.createElement('p');
        hinweis.className = 'monatsdrilldown-fehler';
        hinweis.textContent = `Die Tageszahlen liessen sich nicht laden: ${fehler}`;
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

    const monatNameVoll = MONATSNAMEN_VOLL[monatsnummer - 1];
    const tageListe = (liste) => liste.length > 1
        ? `${liste.slice(0, -1).join('., ')}. und ${liste[liste.length - 1]}.`
        : `${liste[0]}.`;
    // "1 Fahrt", nicht "1 Fahrten" - ein Monat mit nur ein bis zwei
    // Fahrten insgesamt (Januar 2025 im Referenzjahr) trifft diesen Fall
    // wirklich, kein theoretisches Beispiel.
    const fahrtenWort = (n) => (n === 1 ? 'Fahrt' : 'Fahrten');

    const grafik = saeulengrafik(werte, tage.map((t) => `${t}. ${monatNameVoll}`), {
        beschriftung: `Fahrten je Tag im ${monatNameVoll} ${jahr}, gesamt über alle Radtypen und Tarife: zwischen ` +
            `${zahlFormat(minimum)} und ${zahlFormat(maximum)} ${fahrtenWort(maximum)}, im Mittel ` +
            `${zahlFormat(Math.round(gesamt / tage.length))}. Am meisten Fahrten am ` +
            `${tageListe(maxTage)} ${monatNameVoll} mit je ${zahlFormat(maximum)} ${fahrtenWort(maximum)}.`,
        markierIndizes: maxIndizes
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
            titel: 'Minimum',
            wert: zahlSkaliert(zahlFormat(minimum)),
            hinweis: `${tageListe(minTage)} ${monatNameVoll}`
        }),
        baueKachel({
            titel: 'Maximum',
            wert: zahlSkaliert(zahlFormat(maximum)),
            hinweis: `${tageListe(maxTage)} ${monatNameVoll}`
        }),
        baueKachel({
            titel: 'Anzahl pro Monat',
            wert: zahlSkaliert(zahlFormat(gesamt)),
            hinweis: `${monatFormat(monat)}, gesamt`
        }),
        baueKachel({
            titel: 'Tag mit den meisten Fahrten',
            wert: `${tageListe(maxTage)} ${monatNameVoll}`,
            hinweis: maxTage.length > 1
                ? `${maxTage.length} Tage gleichauf, je ${zahlFormat(maximum)} ${fahrtenWort(maximum)}`
                : `${zahlFormat(maximum)} ${fahrtenWort(maximum)}`
        })
    );
    abschnitt.append(kacheln);

    // ===== Tabelle: dieselben Zahlen, auch ohne Augen erreichbar =====
    // "Eine Grafik, die Information trägt, darf für einen Screenreader
    // nicht stumm sein" (Auftrag) - die Grafik selbst trägt ihre
    // Zusammenfassung im aria-label, jeden einzelnen Tageswert liest
    // diese Tabelle vor, kein <span class="nur-vorlesen">-Versteck: in
    // dieser Warenwirtschaft ist Zahlendichte erwünscht (siehe Dateikopf
    // von style.css), die Tabelle nützt deshalb auch sehenden Blicken,
    // die den exakten Wert eines Tages statt nur die Säulenhöhe wollen.
    const tabelle = document.createElement('table');
    tabelle.className = 'monatsdrilldown-tabelle';
    const beschriftung = document.createElement('caption');
    beschriftung.textContent = `Fahrten je Tag, ${monatFormat(monat)}`;
    tabelle.append(beschriftung);

    const thead = document.createElement('thead');
    const kopfzeile = document.createElement('tr');
    for (const spaltentitel of ['Datum', 'Fahrten']) {
        const th = document.createElement('th');
        th.textContent = spaltentitel;
        th.scope = 'col';
        kopfzeile.append(th);
    }
    thead.append(kopfzeile);
    tabelle.append(thead);

    // Jede eigene Öffnung dieses Monats bekommt ihre eigene, frische
    // Tabelle (zeigeMaske() leert #detailmaske bei jedem Zeilenwechsel,
    // siehe Kopfkommentar dieser Funktion) - kein Tag ist deshalb beim
    // Aufbau bereits ausgewählt, unabhängig davon, was in einem zuvor
    // geöffneten Monat markiert war.
    let tagZeileAusgewaehlt = null;

    const tbody = document.createElement('tbody');
    tage.forEach((tag, i) => {
        const tr = document.createElement('tr');
        const kopf = document.createElement('th');
        kopf.scope = 'row';

        // Gestaltungsauftrag Punkt 2b: "ein Klick auf das Datum würde
        // die weiteren Infos offenlegen" - deshalb ein <button> IM <th>
        // statt reinen Texts, als einzige anklickbare Spalte dieser
        // Tabelle (siehe angepasster Kommentar bei .monatsdrilldown-tabelle
        // in style.css). tagIso ist der PostgREST-Filterschlüssel
        // (tag=eq.JJJJ-MM-TT) von v_wawi_fahrten_je_tag_rad, tagFormat()
        // liefert die lesbare Form MIT Wochentag (Punkt 2a).
        //
        // Aus jahr/monatsnummer gebaut (beide oben schon aus monat
        // geparst), NICHT aus monat selbst: monat traegt hier bereits
        // einen Tagesanteil ("2025-09-01", date_trunc('month', ...)::date
        // aus der Sicht) - ein zweites "-04" einfach angehaengt haette
        // "2025-09-01-04" ergeben, und tagFormat()s Destrukturierung
        // (nur die ersten drei Teile) haette daraus fuer JEDE Zeile
        // denselben ersten Tag gelesen, statt fuer jede Zeile ihren
        // eigenen. Im Browser nachgestellt und gefunden: alle 30 Tage
        // einer Monatstabelle zeigten "Mo, 1. Sep 2025".
        const tagIso = `${jahr}-${String(monatsnummer).padStart(2, '0')}-${String(tag).padStart(2, '0')}`;
        const knopf = document.createElement('button');
        knopf.type = 'button';
        knopf.className = 'monatsdrilldown-tag-knopf';
        knopf.textContent = tagFormat(tagIso);
        knopf.addEventListener('click', () => {
            // Sofortige Markierung, ohne auf die Antwort zu warten -
            // dieselbe Reihenfolge wie zeileWaehlen() in rahmen.js
            // (Auswahl zuerst sichtbar, Inhalt folgt nach): "wo bin ich"
            // (Auftrag) muss beim Klick selbst schon stimmen, nicht erst
            // nach einer Netzwerkantwort.
            tagZeileAusgewaehlt?.classList.remove('monatsdrilldown-tag-ausgewaehlt');
            tr.classList.add('monatsdrilldown-tag-ausgewaehlt');
            tagZeileAusgewaehlt = tr;
            tagdrilldownEinfuegen(tagIso, wurzel, knopf);
        });
        kopf.append(knopf);

        const wertZelle = document.createElement('td');
        wertZelle.className = zahlKlasse(werte[i] === maximum ? 'auffaellig' : '');
        wertZelle.textContent = zahlFormat(werte[i]);
        tr.append(kopf, wertZelle);
        tbody.append(tr);
    });
    tabelle.append(tbody);
    abschnitt.append(tabelle);

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
        'fahrrad_id, rahmennummer, typ_code, typ, start_station, ziel_station, dauer_minuten, kilometer, ist_geschaetzt',
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
    ueberschrift.textContent = `Räder am ${tagFormat(tagIso)}`;
    kopf.append(ueberschrift);

    const zurueckKnopf = document.createElement('button');
    zurueckKnopf.type = 'button';
    zurueckKnopf.className = 'knopf-neben tagdrilldown-zurueck';
    zurueckKnopf.textContent = 'Zurück zur Tagesübersicht';
    zurueckKnopf.addEventListener('click', () => {
        document.querySelector('.monatsdrilldown-tag-ausgewaehlt')
            ?.classList.remove('monatsdrilldown-tag-ausgewaehlt');
        abschnitt.remove();
        herkunftsKnopf.focus();   // Fokus zurueck zur Ursprungszeile, dieselbe Idee wie bei Punkt 1
    });
    kopf.append(zurueckKnopf);
    abschnitt.append(kopf);

    const fehler = letzterLadeFehler('v_wawi_fahrten_je_tag_rad');
    if (fehler) {
        const hinweis = document.createElement('p');
        hinweis.className = 'monatsdrilldown-fehler';
        hinweis.textContent = `Die Räder dieses Tages liessen sich nicht laden: ${fehler}`;
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
        leer.textContent = 'An diesem Tag wurde kein Rad gefahren.';
        abschnitt.append(leer);
        wurzel.append(abschnitt);
        return;
    }

    const tabelle = document.createElement('table');
    tabelle.className = 'monatsdrilldown-tabelle';
    const beschriftung = document.createElement('caption');
    beschriftung.textContent = `Räder am ${tagFormat(tagIso)} - kein Kundenbezug, siehe v_wawi_fahrten_je_tag_rad`;
    tabelle.append(beschriftung);

    const thead = document.createElement('thead');
    const kopfzeile = document.createElement('tr');
    for (const spaltentitel of ['Rahmennummer', 'Typ', 'Start', 'Ziel', 'Dauer', 'Strecke']) {
        const th = document.createElement('th');
        th.textContent = spaltentitel;
        th.scope = 'col';
        kopfzeile.append(th);
    }
    thead.append(kopfzeile);
    tabelle.append(thead);

    const tbody = document.createElement('tbody');
    for (const zeile of zeilen) {
        const tr = document.createElement('tr');

        // Rahmennummer bleibt Text, kein Querverweis-Sprung in DIESER
        // Tabelle: bereichSprung() (rahmen.js, Punkt 3) wechselt den
        // ganzen Arbeitsbereich - von einer dritten Ebene innerhalb der
        // Auswertungen aus waere das ein Sprung "quer durch zwei
        // Bereiche gleichzeitig" (Auswertungen -> Flotte) ohne jede
        // Zwischenstation, und diese Zeile hat keine radAnlegenMaske-
        // aehnliche Zielansicht, in der ein einzelnes Rad ausgewaehlt
        // werden koennte (flotteAufbauen() zeigt IMMER die volle Liste).
        // Der Querverweis aus Punkt 3 sitzt deshalb dort, wo er ein
        // bestehendes Ziel trifft: Flotte -> Schadensmeldungen und
        // Schadensmeldung -> Rad (siehe rahmen.js, bereichSprung()).
        const kopf = document.createElement('th');
        kopf.scope = 'row';
        kopf.textContent = zeile.rahmennummer;
        const typZelle = document.createElement('td');
        typZelle.textContent = zeile.typ;
        const startZelle = document.createElement('td');
        startZelle.textContent = zeile.start_station || '—';
        const zielZelle = document.createElement('td');
        zielZelle.textContent = zeile.ziel_station || '—';
        const dauerZelle = document.createElement('td');
        dauerZelle.className = 'zahl';
        dauerZelle.textContent = minutenFormat(zeile.dauer_minuten);
        const streckeZelle = document.createElement('td');
        streckeZelle.className = 'zahl';
        // ist_geschaetzt gehoert IMMER neben die Zahl, nicht nur bei
        // v_wawi_km_co2 - dieselbe Regel wie dort ("eine Kennzahl, die
        // ihre eigene Unsicherheit nicht mitliefert, ist gefaehrlich").
        streckeZelle.textContent = zeile.kilometer === null
            ? '—'
            : `${kmFormat(zeile.kilometer)}${zeile.ist_geschaetzt ? ' (geschätzt)' : ''}`;

        tr.append(kopf, typZelle, startZelle, zielZelle, dauerZelle, streckeZelle);
        tbody.append(tr);
    }
    tabelle.append(tbody);
    abschnitt.append(tabelle);

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
        zeigeUebersicht(vorgang, []);
        meldeVorgang(vorgang, `Der Umsatz nach Radtyp liess sich nicht laden: ${fehler}`, 'schlecht');
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
        zeigeUebersicht(vorgang, []);
        zeigeLeermaske(
            vorgang,
            'Kein Umsatz nach Radtyp',
            'Es liegt keine Monatszeile vor. Bei einem gefuellten Referenzjahr ist das ' +
            'ungewoehnlich - moeglich ist ein zwischenzeitlicher Rollenverlust statt ' +
            'fehlender Daten.'
        );
        meldeVorgang(vorgang, 'Kein Umsatz nach Radtyp');
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
        { feld: 'typ',            titel: 'Radtyp' },
        { feld: 'monat',          titel: 'Monat',        formatieren: (w) => monatFormat(w) },
        // summierbar: Fahrten und Minuten sind echte Zaehlwerte JE MONAT
        // - anders als v_wawi_umsatz_kundengruppe.kunden (dort zaehlt
        // dieselbe Person in mehreren Monaten mehrfach, siehe dort)
        // gehoert eine Fahrt/eine gefahrene Minute zu GENAU einem Monat,
        // eine Summe ueber mehrere Monate hinweg zaehlt nichts doppelt.
        { feld: 'fahrten',        titel: 'Fahrten',      formatieren: zahlFormat, klasse: zahlKlasse(), summierbar: true },
        { feld: 'minuten',        titel: 'Minuten',      formatieren: zahlFormat, klasse: zahlKlasse(), summierbar: true },
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
        ...balkenSpalten('umsatz', 'Umsatz', umsatzMaximum, geldFormat, { summierbar: true }),
        {
            feld: 'umsatz_je_fahrt', titel: 'Je Fahrt', klasse: zahlKlasse(),
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
            feld: 'minutenJeFahrt', titel: 'Minuten je Fahrt', klasse: zahlKlasse(),
            formatieren: (w) => zahlSkaliert(minutenFormat(w))
        },
        {
            feld: 'veraenderungJeFahrt', titel: 'Δ ggü. Vormonat',
            formatieren: veraenderungFormat,
            klasse: (z) => zahlKlasse(istAuffaellig(z, 'veraenderungJeFahrt') ? 'auffaellig' : '')
        }
    ], umsatzRadtypMaske);

    zeigeUebersicht(vorgang, umsatzRadtypUebersicht(zeilen, flottengroesse));

    // Gesamtsumme UND Fahrten insgesamt in der Statuszeile - die
    // Kontrollzahl aus Schritt 3 des Auftrags (35 454,47 €) soll man
    // ablesen können, ohne selbst zu addieren.
    const gesamtUmsatz = zeilen.reduce((s, z) => s + z.umsatz, 0);
    const gesamtFahrten = zeilen.reduce((s, z) => s + z.fahrten, 0);
    meldeVorgang(vorgang,
        `${zeilen.length} Monatszeilen, ${zahlFormat(gesamtFahrten)} Fahrten, ` +
        `Umsatz gesamt ${geldFormat(gesamtUmsatz)}`);
}

// Vier Kacheln: die drei fuer die Fragen, mit denen jemand diesen Reiter
// öffnet (Auftrag: "wie ist der Verlauf, wo liegt der Schwerpunkt, was
// ist auffällig") - nicht die Gesamtsumme allein, die steht schon in der
// Statuszeile und wäre als einzige Kachel eine bloße Wiederholung - PLUS
// die vierte, neu hinzugekommene Frage: TRÄGT sich die Flotte überhaupt?
// 35.454,47 € Jahresumsatz klingt für sich genommen nach etwas, ohne dass
// klar wäre, ob es viel oder wenig ist - "Umsatz je Rad und Tag" setzt
// die Zahl in Bezug zu dem, was sie erwirtschaften soll (siehe
// flottengroesse-Parameter unten).
function umsatzRadtypUebersicht(zeilen, flottengroesse) {
    const umsatzReihe = reiheJeMonat(zeilen, 'umsatz');
    const fahrtenReihe = reiheJeMonat(zeilen, 'fahrten');
    const gesamtUmsatz = umsatzReihe.reduce((s, r) => s + r.wert, 0);
    const gesamtFahrten = fahrtenReihe.reduce((s, r) => s + r.wert, 0);

    // "Referenzjahr" operationalisiert als die zwölf jüngsten Monate mit
    // Daten, nicht als Kalenderjahr: die sechs frühen Testmonate (Januar-
    // Juni 2025, siehe MINDEST_FAHRTEN_JE_MONAT weiter oben) liegen mehr
    // als ein Jahr vor dem aktuellsten Monat und fallen damit von selbst
    // heraus - ohne dass dafür ein eigens gewählter Schwellenwert nötig
    // wäre. Das trifft sich in diesem Bestand mit "seit dem echten
    // Betriebsstart", muss es aber nicht: die Regel bleibt auch dann
    // richtig, wenn ein künftiges Betriebsjahr die Testmonate irgendwann
    // aus dem Zwölf-Monats-Fenster schiebt.
    const umsatzLetztesJahr = umsatzReihe.slice(-12);
    const fahrtenLetztesJahr = fahrtenReihe.slice(-12);
    const tiefpunkt = extremwert(fahrtenLetztesJahr, 'wert', true);
    const hoehepunkt = extremwert(fahrtenLetztesJahr, 'wert', false);

    const kachelnUmsatz = {
        titel: 'Umsatz gesamt',
        veraenderung: veraenderungZeile(letzteVeraenderung(umsatzLetztesJahr)),
        wert: zahlSkaliert(geldFormat(gesamtUmsatz)),
        grafik: saeulenSparkline(umsatzLetztesJahr.map((r) => r.wert),
            `Monatsumsatz der letzten zwölf Monate (${monatFormat(umsatzLetztesJahr[0].monat)} bis ` +
            `${monatFormat(umsatzLetztesJahr.at(-1).monat)}), von ` +
            `${geldFormat(Math.min(...umsatzLetztesJahr.map((r) => r.wert)))} bis ` +
            `${geldFormat(Math.max(...umsatzLetztesJahr.map((r) => r.wert)))} - die dunkle Säule ganz rechts ` +
            `ist der aktuelle Monat, ${monatFormat(umsatzLetztesJahr.at(-1).monat)} mit ` +
            `${geldFormat(umsatzLetztesJahr.at(-1).wert)}`
        ),
        hinweis: 'Verlauf der letzten 12 Monate'
    };

    const kachelnFahrten = {
        titel: 'Fahrten gesamt',
        veraenderung: veraenderungZeile(letzteVeraenderung(fahrtenLetztesJahr)),
        wert: zahlSkaliert(zahlFormat(gesamtFahrten)),
        grafik: saeulenSparkline(fahrtenLetztesJahr.map((r) => r.wert),
            `Fahrten je Monat, letzte zwölf Monate: ${zahlFormat(tiefpunkt.wert)} im ${monatFormat(tiefpunkt.monat)} ` +
            `am niedrigsten, ${zahlFormat(hoehepunkt.wert)} im ${monatFormat(hoehepunkt.monat)} am höchsten - die ` +
            `dunkle Säule ganz rechts ist der aktuelle Monat, ${monatFormat(fahrtenLetztesJahr.at(-1).monat)} mit ` +
            `${zahlFormat(fahrtenLetztesJahr.at(-1).wert)} Fahrten`,
            { markierIndizes: [fahrtenLetztesJahr.indexOf(hoehepunkt)] }
        ),
        hinweis: `Jahresgang: ${monatFormat(tiefpunkt.monat)} am niedrigsten, ${monatFormat(hoehepunkt.monat)} am höchsten`
    };

    const kacheln = [kachelnUmsatz, kachelnFahrten];

    // "Umsatz je Rad und Tag": genau die Kennzahl, die der Auftrag als
    // Beispiel nennt, um "analytischer" von "mehr Zahlen" abzugrenzen -
    // 35.454,47 € ist ein Fakt, "trägt sich die Flotte damit" ist eine
    // Frage, die erst ein Bezug beantwortet. flottengroesse kommt aus
    // v_wawi_flotte (siehe die Zaehl-Anfrage in umsatzRadtypZeigen()) -
    // OHNE ausgemusterte Räder, weil ein abgeschriebenes Rad nichts mehr
    // erwirtschaftet und den Nenner nur kuenstlich verkleinern wuerde.
    // gesamtUmsatzLetztesJahr statt gesamtUmsatz (oben, alle 18 Monate
    // inkl. der sechs Testmonate): dieselbe Zwoelf-Monats-Abgrenzung wie
    // bei der Sparkline daneben, aus demselben Grund (siehe Kommentar bei
    // umsatzLetztesJahr oben) - ein Nenner aus 275 HEUTIGEN Rädern neben
    // einem Zaehler aus eineinhalb Jahren mit wechselnder Flottengroesse
    // waere unehrlich vermischt. 365 Tage statt der tatsaechlichen
    // Tageszahl des Zwoelf-Monats-Fensters: im aktuellen Bestand
    // (September 2025 bis August 2026, kein Schaltjahr) sind das exakt
    // 365 - eine Rundung, die erst in einem Schaltjahr um einen Tag
    // daneben läge, nicht heute. Kachel entfällt ganz, wenn die
    // Zaehl-Anfrage scheiterte (flottengroesse dann null, siehe
    // zaehleZeilen() in daten.js) oder die Flotte leer ist - derselbe
    // "lieber keine Kachel als eine falsche" wie bei kundenUebersicht()
    // in kunden.js.
    if (flottengroesse) {
        const gesamtUmsatzLetztesJahr = umsatzLetztesJahr.reduce((s, r) => s + r.wert, 0);
        const tageBetrachtet = 365;
        const jeRadJahr = gesamtUmsatzLetztesJahr / flottengroesse;
        const jeRadTag = jeRadJahr / tageBetrachtet;
        kacheln.push({
            titel: 'Umsatz je Rad und Tag',
            wert: zahlSkaliert(geldFormat(jeRadTag)),
            hinweis: `${geldFormat(jeRadJahr)} je Jahr · bezogen auf ${zahlFormat(flottengroesse)} Räder im ` +
                `Bestand (ohne Ausgemusterte) · letzte 12 Monate`
        });
    }

    // Der Preissprung (Gestaltungsauftrag, Punkt 4): NICHT der Radtyp mit
    // dem grössten gefundenen Ausschlag über alle drei Typen - eine
    // solche Suche griffe bei kleiner werdender Stichprobe (E-Bike trägt
    // in manchen Monaten nur 44-130 Fahrten) genauso in die Sprungfeder-
    // Falle wie ein ungewichteter Mittelwert: gegen die Daten geprüft
    // (siehe Bericht) liefert "größter Ausschlag über alle Typen" sogar
    // einen E-Bike-Monat, nicht den tatsächlichen, dokumentierten
    // Tarifwechsel beim City-Bike. Der Fund selbst - WELCHER Radtyp einen
    // Tarifwechsel hatte - ist eine fachliche Tatsache, keine Statistik;
    // gesucht wird hier deshalb GEZIELT im City-Bike, mit derselben
    // Testmonat-Schwelle wie beim Jahresgang oben.
    const cityBetrieb = zeilen
        .filter((z) => z.typ_code === 'CITY' && z.fahrten >= MINDEST_FAHRTEN_JE_MONAT)
        .sort((a, b) => a.monat.localeCompare(b.monat));
    const sprung = groessterSprung(cityBetrieb, 'umsatz_je_fahrt');
    if (sprung) {
        const wertKnoten = document.createElement('span');
        wertKnoten.append(zahlSkaliert(geldFormat(sprung.vorherigerWert)));
        const pfeil = document.createElement('span');
        pfeil.className = 'uebersichtskachel-pfeil';
        pfeil.textContent = ' → ';
        wertKnoten.append(pfeil, zahlSkaliert(geldFormat(sprung.wert)));

        kacheln.push({
            titel: 'Auffällig: Umsatz je Fahrt City-Bike',
            wert: wertKnoten,
            // aktuellIndex: null - diese Reihe zeigt einen SPRUNG
            // (Tarifwechsel), keinen "wo stehen wir heute"-Verlauf; die
            // markierte Säule ist der Sprungmonat, nicht "jetzt" (siehe
            // Kopfkommentar bei saeulenSparkline() in rahmen.js).
            grafik: saeulenSparkline(cityBetrieb.map((z) => z.umsatz_je_fahrt),
                `Umsatz je Fahrt City-Bike, ${cityBetrieb.length} Monate ab ${monatFormat(cityBetrieb[0].monat)}: ` +
                `Sprung von ${geldFormat(sprung.vorherigerWert)} auf ${geldFormat(sprung.wert)} ` +
                `ab ${monatFormat(sprung.monat)}, in Rot markiert`,
                { markierIndizes: [sprung.index], aktuellIndex: null }
            ),
            hinweis: `${veraenderungFormat(sprung.veraenderung)} ab ${monatFormat(sprung.monat)} - Tarifwechsel`
        });
    }

    return kacheln;
}

// async wegen des Drill-Downs (monatsdrilldownEinfuegen() lädt die
// Tageszahlen nach) - zeileWaehlen() in rahmen.js ruft diese Funktion
// ohne await auf, das ist hier gewollt: die Grundmaske (zeigeMaske())
// steht synchron sofort, die Tagesgrafik hängt sich erst danach an, wenn
// ihre eigene Ladeanfrage zurück ist.
async function umsatzRadtypMaske(zeile) {
    zeigeMaske(`${zeile.typ} · ${monatFormat(zeile.monat)}`, [
        { name: 'typ',            titel: 'Radtyp',    wert: `${zeile.typ} (${zeile.typ_code})`, nurLesen: true },
        { name: 'monat',          titel: 'Monat',      wert: monatFormat(zeile.monat), nurLesen: true },
        { name: 'fahrten',        titel: 'Fahrten',    wert: zahlFormat(zeile.fahrten), nurLesen: true },
        { name: 'minuten',        titel: 'Minuten',    wert: zahlFormat(zeile.minuten), nurLesen: true },
        { name: 'umsatz',         titel: 'Umsatz',     wert: geldFormat(zeile.umsatz), nurLesen: true },
        { name: 'umsatz_je_fahrt', titel: 'Je Fahrt',  wert: geldFormat(zeile.umsatz_je_fahrt), nurLesen: true },
        { name: 'minuten_je_fahrt', titel: 'Minuten je Fahrt', wert: minutenFormat(zeile.minutenJeFahrt), nurLesen: true },
        { name: 'veraenderung',   titel: 'Δ ggü. Vormonat', wert: veraenderungFormat(zeile.veraenderungJeFahrt), nurLesen: true }
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
        zeigeUebersicht(vorgang, []);
        meldeVorgang(vorgang, `Der Umsatz nach Kundengruppe liess sich nicht laden: ${fehler}`, 'schlecht');
        return;
    }

    if (zeilen.length === 0) {
        zeigeUebersicht(vorgang, []);
        zeigeLeermaske(
            vorgang,
            'Kein Umsatz nach Kundengruppe',
            'Es liegt keine Monatszeile vor. Bei einem gefuellten Referenzjahr ist das ' +
            'ungewoehnlich - moeglich ist ein zwischenzeitlicher Rollenverlust statt ' +
            'fehlender Daten.'
        );
        meldeVorgang(vorgang, 'Kein Umsatz nach Kundengruppe');
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
    const zeilenMitFahrtenJeKunde = zeilen.map((z) => (
        { ...z, fahrtenJeKunde: z.kunden ? z.fahrten / z.kunden : null }
    ));

    const umsatzMaximum = Math.max(...zeilen.map((z) => z.umsatz));
    zeigeListe(vorgang, zeilenMitFahrtenJeKunde, [
        { feld: 'monat',           titel: 'Monat',      formatieren: (w) => monatFormat(w) },
        { feld: 'tarif',           titel: 'Tarif' },
        // 'kunden' bewusst NICHT summierbar (anders als 'fahrten'/'umsatz'
        // unten): die Spalte zaehlt Kunden JE MONAT - dieselbe Person mit
        // einer laufenden Mitgliedschaft steckt in zwoelf Monatszeilen
        // zwoelfmal. Eine Gruppen-Zwischensumme ueber mehrere Monate (etwa
        // nach Tarif gruppiert) wuerde sie zwoelfmal zaehlen - derselbe
        // Fehlertyp wie beim ungewichteten Schaetzanteil bei CO2
        // (53,2 % statt 40,0 %, siehe anteilGewichtet() weiter oben):
        // "man summiert Durchschnitte/Bestandszaehlungen nicht, man
        // gewichtet bzw. zaehlt sie neu" (Auftrag).
        { feld: 'kunden',          titel: 'Kunden',     formatieren: zahlFormat, klasse: zahlKlasse() },
        // summierbar: eine Fahrt gehoert zu GENAU einem Monat, additiv
        // ueber Monate - kein Doppelzaehl-Risiko wie bei 'kunden' oben.
        { feld: 'fahrten',         titel: 'Fahrten',    formatieren: zahlFormat, klasse: zahlKlasse(), summierbar: true },
        // Dieselbe gemeinsame Skala wie im Radtyp-Reiter (Hichert:
        // einheitliche Notation über alle Auswertungen) - hier über die
        // Zeilen DIESER Tabelle, nicht über beide Umsatztabellen
        // gemeinsam, weil "Umsatz je Monat und Tarif" und "Umsatz je
        // Monat und Radtyp" unterschiedliche Vergleichsgruppen sind.
        // Balken/Betrag in zwei Spalten (balkenSpalten(), siehe
        // Kommentar dort und im Radtyp-Reiter oben). summierbar: derselbe
        // additive Umsatz wie im Radtyp-Reiter.
        ...balkenSpalten('umsatz', 'Umsatz', umsatzMaximum, geldFormat, { summierbar: true }),
        {
            feld: 'umsatz_je_kunde', titel: 'Je Kunde', klasse: zahlKlasse(),
            formatieren: (w) => zahlSkaliert(geldFormat(w))
        },
        // Siehe Kommentar bei zeilenMitFahrtenJeKunde oben. NICHT
        // summierbar - ein Verhaeltnis, derselbe Fehlertyp wie
        // umsatz_je_kunde.
        {
            feld: 'fahrtenJeKunde', titel: 'Fahrten je Kunde', klasse: zahlKlasse(),
            formatieren: (w) => zahlSkaliert(zahlFormatFein(w))
        }
    ], umsatzKundengruppeMaske);

    zeigeUebersicht(vorgang, umsatzKundengruppeUebersicht(zeilen));

    // Dieselbe Gesamtsumme wie im Radtyp-Reiter (35 454,47 € - beide
    // Sichten summieren dieselben Entgeltpositionen, nur anders
    // gruppiert). Zwei getrennte Wege zu derselben Zahl sind die
    // Gegenprobe, die Schritt 3 des Auftrags verlangt - stimmen sie
    // nicht überein, ist eine der beiden Gruppierungen fehlerhaft.
    const gesamtUmsatz = zeilen.reduce((s, z) => s + z.umsatz, 0);
    meldeVorgang(vorgang, `${zeilen.length} Monatszeilen, Umsatz gesamt ${geldFormat(gesamtUmsatz)}`);
}

// Drei Kacheln, in derselben Reihenfolge Verlauf/Schwerpunkt/auffällig
// wie im Radtyp-Reiter (Hichert: einheitliche Notation über alle
// Auswertungen hinweg, nicht nur innerhalb einer Tabelle).
function umsatzKundengruppeUebersicht(zeilen) {
    const umsatzReihe = reiheJeMonat(zeilen, 'umsatz');
    const gesamtUmsatz = umsatzReihe.reduce((s, r) => s + r.wert, 0);
    const letzteZwoelf = umsatzReihe.slice(-12);

    const umsatzJeTarif = new Map();
    for (const z of zeilen) umsatzJeTarif.set(z.tarif_code, (umsatzJeTarif.get(z.tarif_code) || 0) + z.umsatz);
    const gruppen = [...umsatzJeTarif.entries()].sort(([, a], [, b]) => b - a);
    const [groessterCode, groessterUmsatz] = gruppen[0];
    const groessteGruppe = zeilen.find((z) => z.tarif_code === groessterCode).tarif;
    const ohneUmsatz = umsatzJeTarif.get('OHNE') || 0;

    const kacheln = [
        {
            titel: 'Umsatz gesamt',
            veraenderung: veraenderungZeile(letzteVeraenderung(letzteZwoelf)),
            wert: zahlSkaliert(geldFormat(gesamtUmsatz)),
            grafik: saeulenSparkline(letzteZwoelf.map((r) => r.wert),
                `Monatsumsatz der letzten zwölf Monate (${monatFormat(letzteZwoelf[0].monat)} bis ` +
                `${monatFormat(letzteZwoelf.at(-1).monat)}), dieselbe Reihe wie im Reiter "Umsatz nach Radtyp" - ` +
                `die dunkle Säule ganz rechts ist der aktuelle Monat, ${geldFormat(letzteZwoelf.at(-1).wert)}`
            ),
            hinweis: 'Verlauf der letzten 12 Monate - Kontrollrechnung zum Reiter "Umsatz nach Radtyp"'
        },
        {
            titel: 'Größte Kundengruppe',
            wert: groessteGruppe,
            grafik: zellbalken(groessterUmsatz, gesamtUmsatz),
            hinweis: `${prozentFormatFein(groessterUmsatz / gesamtUmsatz)} des Umsatzes (${geldFormat(groessterUmsatz)})`
        }
    ];

    // Auffällig, gegen die Daten geprüft (siehe Bericht): fast die Hälfte
    // des Umsatzes kommt von Fahrten OHNE aktive Mitgliedschaft - eine
    // Zahl, die man ohne diese Kachel erst durch Aufsummieren von 13
    // Zeilen quer über 18 Monate fände. tarif_code 'OHNE' kommt direkt
    // aus der Sicht (siehe 0018_wawi_sichten.sql: "coalesce(tr.tarif_code,
    // 'OHNE')"), kein selbst erfundener Sonderfall.
    if (ohneUmsatz > 0) {
        kacheln.push({
            titel: 'Auffällig: ohne Mitgliedschaft',
            wert: prozentFormatFein(ohneUmsatz / gesamtUmsatz),
            grafik: zellbalken(ohneUmsatz, gesamtUmsatz),
            hinweis: `${geldFormat(ohneUmsatz)} Umsatz aus Fahrten ohne aktiven Tarif`
        });
    }

    return kacheln;
}

// async wegen des Drill-Downs - siehe Kommentar bei umsatzRadtypMaske().
async function umsatzKundengruppeMaske(zeile) {
    zeigeMaske(`${zeile.tarif} · ${monatFormat(zeile.monat)}`, [
        { name: 'tarif',           titel: 'Tarif',    wert: `${zeile.tarif} (${zeile.tarif_code})`, nurLesen: true },
        { name: 'monat',           titel: 'Monat',    wert: monatFormat(zeile.monat), nurLesen: true },
        { name: 'kunden',          titel: 'Kunden',   wert: zahlFormat(zeile.kunden), nurLesen: true },
        { name: 'fahrten',         titel: 'Fahrten',  wert: zahlFormat(zeile.fahrten), nurLesen: true },
        { name: 'umsatz',          titel: 'Umsatz',   wert: geldFormat(zeile.umsatz), nurLesen: true },
        { name: 'umsatz_je_kunde', titel: 'Je Kunde', wert: geldFormat(zeile.umsatz_je_kunde), nurLesen: true },
        { name: 'fahrten_je_kunde', titel: 'Fahrten je Kunde', wert: zahlFormatFein(zeile.fahrtenJeKunde), nurLesen: true }
    ], []);
    await monatsdrilldownEinfuegen(zeile.monat);
}

// ===== Kilometer und CO2 =====

async function kmCo2Zeigen(vorgang) {
    const zeilen = await ladeListe('v_wawi_km_co2',
        'monat, typ_code, fahrten, kilometer, fahrten_geschaetzt, anteil_geschaetzt, co2_ersparnis_kg',
        (q) => q.order('monat').order('typ_code'));

    const fehler = letzterLadeFehler('v_wawi_km_co2');
    if (fehler) {
        zeigeUebersicht(vorgang, []);
        meldeVorgang(vorgang, `Kilometer und CO2 liessen sich nicht laden: ${fehler}`, 'schlecht');
        return;
    }

    if (zeilen.length === 0) {
        zeigeUebersicht(vorgang, []);
        zeigeLeermaske(
            vorgang,
            'Keine Kilometer- und CO2-Zeilen',
            'Es liegt keine Monatszeile vor. Bei einem gefuellten Referenzjahr ist das ' +
            'ungewoehnlich - moeglich ist ein zwischenzeitlicher Rollenverlust statt ' +
            'fehlender Daten.'
        );
        meldeVorgang(vorgang, 'Keine Kilometer- und CO2-Zeilen');
        return;
    }

    // v_wawi_km_co2 liefert nur typ_code (CITY, EBIKE, ...), keinen
    // Anzeigenamen wie v_wawi_umsatz_radtyp.typ - anders als dort wäre
    // ein Zusatz-Join auf fahrradtyp für eine reine Auswertungssicht
    // eine Erweiterung, die niemand beauftragt hat. Der Code selbst ist
    // in dieser Tabelle so kurz und so wenig mehrdeutig (zwei bis drei
    // Werte), dass er unübersetzt lesbar bleibt.
    // kilometerJeFahrt: dieselbe clientseitige Rechnung wie
    // minutenJeFahrt/fahrtenJeKunde in den beiden Reitern davor (siehe
    // dortiger Kommentar) - kilometer und fahrten sind bereits korrekt
    // aggregierte Summen DERSELBEN Zeile. Beantwortet, wie weit eine
    // typische Fahrt dieses Radtyps geht - anders als "Kilometer" (Summe
    // je Monat, oben) unabhaengig davon, wie viele Fahrten im Monat
    // stattfanden, und damit zwischen Radtypen mit sehr unterschiedlicher
    // Flottengroesse (Cargo: 25 Räder, City: 198, siehe Bericht)
    // tatsaechlich vergleichbar.
    const zeilenMitKmJeFahrt = zeilen.map((z) => (
        { ...z, kilometerJeFahrt: z.fahrten ? z.kilometer / z.fahrten : null }
    ));

    const kilometerMaximum = Math.max(...zeilen.map((z) => z.kilometer));
    zeigeListe(vorgang, zeilenMitKmJeFahrt, [
        { feld: 'monat',    titel: 'Monat',   formatieren: (w) => monatFormat(w) },
        { feld: 'typ_code', titel: 'Radtyp' },
        // summierbar: Fahrten je Monat/Radtyp, additiv - kein
        // Doppelzaehl-Risiko (jede Fahrt gehoert zu genau einer Zeile).
        { feld: 'fahrten',  titel: 'Fahrten', formatieren: zahlFormat, klasse: zahlKlasse(), summierbar: true },
        // Balken/Betrag in zwei Spalten (balkenSpalten() in rahmen.js) -
        // siehe Kommentar dort und im Radtyp-Reiter (Gestaltungsauftrag,
        // Punkt 5). summierbar: gefahrene Kilometer sind additiv.
        ...balkenSpalten('kilometer', 'Kilometer', kilometerMaximum, kmFormat, { summierbar: true }),
        // Siehe Kommentar bei zeilenMitKmJeFahrt oben. NICHT summierbar -
        // ein Verhaeltnis, derselbe Fehlertyp wie umsatz_je_fahrt.
        {
            feld: 'kilometerJeFahrt', titel: 'Kilometer je Fahrt', klasse: zahlKlasse(),
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
            feld: 'co2_ersparnis_kg', titel: 'CO₂-Ersparnis',
            formatieren: (w, z) => co2ZelleElement(z), klasse: zahlKlasse(),
            summierbar: true, summeFormatieren: (summe) => kgFormat(summe)
        }
    ], kmCo2Maske);

    zeigeUebersicht(vorgang, kmCo2Uebersicht(zeilen));

    // Die Kontrollrechnung aus Schritt 3: Gesamtersparnis UND der
    // fahrtgewichtete Gesamtanteil - NICHT der Mittelwert der
    // anteil_geschaetzt-Spalte. anteilGewichtet() siehe oben.
    const gesamtCo2 = zeilen.reduce((s, z) => s + z.co2_ersparnis_kg, 0);
    const gesamtFahrten = zeilen.reduce((s, z) => s + z.fahrten, 0);
    meldeVorgang(vorgang,
        `${zeilen.length} Monatszeilen, ${zahlFormat(gesamtFahrten)} Fahrten, ` +
        `CO₂-Ersparnis gesamt ${kgFormat(gesamtCo2)}, ` +
        `davon ${prozentFormat(anteilGewichtet(zeilen))} geschätzt (fahrtgewichtet)`);
}

// Dritte Kachel ist der Kern dieses Reiters, nicht schmückendes Beiwerk:
// der fahrtgewichtete Schätzanteil MUSS hier stehen, weil er sonst genau
// die Fußnoten-Behandlung bekäme, die der Auftrag ausdrücklich verbietet
// ("Die Unsicherheit steht neben der Zahl, nicht in einer Fußnote") - und
// der Hinweis zeigt zusätzlich den falschen, ungewichteten Mittelwert
// gegen den richtigen, damit die Falle nicht nur im Code-Kommentar von
// anteilGewichtet() steht, sondern auch für die Leitung sichtbar ist, die
// diese Tabelle tatsächlich liest.
function kmCo2Uebersicht(zeilen) {
    const co2Reihe = reiheJeMonat(zeilen, 'co2_ersparnis_kg');
    const kmReihe = reiheJeMonat(zeilen, 'kilometer');
    const co2LetzteZwoelf = co2Reihe.slice(-12);
    const kmLetzteZwoelf = kmReihe.slice(-12);
    const gesamtCo2 = co2Reihe.reduce((s, r) => s + r.wert, 0);
    const gesamtKm = kmReihe.reduce((s, r) => s + r.wert, 0);
    const gesamtFahrten = zeilen.reduce((s, z) => s + z.fahrten, 0);
    const gesamtGeschaetzt = zeilen.reduce((s, z) => s + z.fahrten_geschaetzt, 0);
    const anteil = anteilGewichtet(zeilen);
    const naiverMittelwert = zeilen.reduce((s, z) => s + z.anteil_geschaetzt, 0) / zeilen.length;

    return [
        {
            titel: 'CO₂-Ersparnis gesamt',
            veraenderung: veraenderungZeile(letzteVeraenderung(co2LetzteZwoelf)),
            wert: zahlSkaliert(kgFormat(gesamtCo2)),
            grafik: saeulenSparkline(co2LetzteZwoelf.map((r) => r.wert),
                `CO2-Ersparnis je Monat, letzte zwölf Monate (${monatFormat(co2LetzteZwoelf[0].monat)} bis ` +
                `${monatFormat(co2LetzteZwoelf.at(-1).monat)}), von ` +
                `${kgFormat(Math.min(...co2LetzteZwoelf.map((r) => r.wert)))} bis ` +
                `${kgFormat(Math.max(...co2LetzteZwoelf.map((r) => r.wert)))} - die dunkle Säule ganz rechts ` +
                `ist der aktuelle Monat, ${kgFormat(co2LetzteZwoelf.at(-1).wert)}`
            ),
            hinweis: 'Verlauf der letzten 12 Monate'
        },
        {
            titel: 'Kilometer gesamt',
            veraenderung: veraenderungZeile(letzteVeraenderung(kmLetzteZwoelf)),
            wert: zahlSkaliert(kmFormat(gesamtKm)),
            grafik: saeulenSparkline(kmLetzteZwoelf.map((r) => r.wert),
                `Gefahrene Kilometer je Monat, letzte zwölf Monate (${monatFormat(kmLetzteZwoelf[0].monat)} bis ` +
                `${monatFormat(kmLetzteZwoelf.at(-1).monat)}) - die dunkle Säule ganz rechts ist der aktuelle ` +
                `Monat, ${kmFormat(kmLetzteZwoelf.at(-1).wert)}`
            ),
            hinweis: 'Verlauf der letzten 12 Monate'
        },
        {
            titel: 'Davon geschätzt (fahrtgewichtet)',
            wert: prozentFormatFein(anteil),
            grafik: zellbalken(gesamtGeschaetzt, gesamtFahrten),
            hinweis: `${zahlFormat(gesamtGeschaetzt)} von ${zahlFormat(gesamtFahrten)} Fahrten geschätzt - ` +
                `NICHT ${prozentFormatFein(naiverMittelwert)}, wie das einfache Mittel der Zeilen nahelegen würde`
        }
    ];
}

// async wegen des Drill-Downs - siehe Kommentar bei umsatzRadtypMaske().
async function kmCo2Maske(zeile) {
    zeigeMaske(`${zeile.typ_code} · ${monatFormat(zeile.monat)}`, [
        { name: 'typ_code', titel: 'Radtyp',    wert: zeile.typ_code, nurLesen: true },
        { name: 'monat',    titel: 'Monat',      wert: monatFormat(zeile.monat), nurLesen: true },
        { name: 'fahrten',  titel: 'Fahrten',    wert: zahlFormat(zeile.fahrten), nurLesen: true },
        { name: 'kilometer', titel: 'Kilometer', wert: kmFormat(zeile.kilometer), nurLesen: true },
        { name: 'kilometer_je_fahrt', titel: 'Kilometer je Fahrt', wert: kmFormat(zeile.kilometerJeFahrt), nurLesen: true },
        {
            name: 'fahrten_geschaetzt', titel: 'Davon geschätzt',
            wert: `${zahlFormat(zeile.fahrten_geschaetzt)} von ${zahlFormat(zeile.fahrten)} Fahrten ` +
                  `(${prozentFormat(zeile.anteil_geschaetzt)})`,
            nurLesen: true
        },
        { name: 'co2_ersparnis_kg', titel: 'CO₂-Ersparnis', wert: co2ZelleText(zeile), nurLesen: true }
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
        zeigeUebersicht(vorgang, []);
        meldeVorgang(vorgang, `Die Stationsauslastung liess sich nicht laden: ${fehler}`, 'schlecht');
        return;
    }

    if (zeilen.length === 0) {
        zeigeUebersicht(vorgang, []);
        zeigeLeermaske(
            vorgang,
            'Keine Stationsauslastung',
            'Es liegt keine Station vor. Bei zehn angelegten Stationen ist das ' +
            'ungewoehnlich - moeglich ist ein zwischenzeitlicher Rollenverlust statt ' +
            'fehlender Daten.'
        );
        meldeVorgang(vorgang, 'Keine Stationsauslastung');
        return;
    }

    zeigeListe(vorgang, zeilen, [
        { feld: 'stationsnummer', titel: 'Nummer' },
        { feld: 'name',           titel: 'Station' },
        // summierbar bei kapazitaet/belegt/abgaenge/zugaenge/saldo: jede
        // Zeile ist eine EIGENE Station, jeder Wert eine echte Zaehlung
        // fuer genau diese Station (kein Durchschnitt, keine Zeile, die
        // in mehreren Gruppen gleichzeitig steckt) - eine Zwischensumme
        // ueber eine Gruppe von Stationen (z. B. "alle mit negativem
        // Saldo", falls danach gruppiert wird) ist additiv unbedenklich.
        // 'fuellstand' bleibt bewusst NICHT summierbar: das ist ein
        // Verhaeltnis (belegt/kapazitaet), Verhaeltnisse summiert man
        // nicht - derselbe Fehlertyp wie bei umsatz_je_fahrt.
        { feld: 'kapazitaet',     titel: 'Kapazität', formatieren: zahlFormat, klasse: zahlKlasse(), summierbar: true },
        { feld: 'belegt',         titel: 'Belegt',    formatieren: zahlFormat, klasse: zahlKlasse(), summierbar: true },
        { feld: 'abgaenge',       titel: 'Abgänge',   formatieren: zahlFormat, klasse: zahlKlasse(), summierbar: true },
        { feld: 'zugaenge',       titel: 'Zugänge',   formatieren: zahlFormat, klasse: zahlKlasse(), summierbar: true },
        {
            // Farbe trägt Bedeutung: eine Station, die dauerhaft mehr
            // Raeder abgibt als sie bekommt (Saldo negativ), blutet leer
            // und muss von Hand nachgefüllt werden - keine Dekoration,
            // sondern derselbe Signalgedanke wie "frei" in stationen.js.
            feld: 'saldo', titel: 'Saldo', summierbar: true,
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
        ...balkenSpalten('fuellstand', 'Füllstand', 1, prozentFormat, {
            farbe: (w) => (w >= 1 ? 'var(--warnung-text)' : 'var(--marine)'),
            klasse: (z) => zahlKlasse(z.fuellstand >= 1 ? 'warnung' : '')
        })
    ], stationsauslastungMaske);

    zeigeUebersicht(vorgang, stationsauslastungUebersicht(zeilen));

    const leer = zeilen.filter((z) => z.belegt === 0).length;
    meldeVorgang(vorgang, `${zeilen.length} Stationen${leer ? `, ${leer} davon ohne Rad` : ''}`);
}

// Anders als die drei Reiter davor führt diese Sicht keine Monatsspalte
// (siehe Kopfkommentar der Funktion oben) - "Verlauf" gibt es hier nicht,
// deshalb tragen die Sparklines dieser Kacheln keine Zeitachse, sondern
// die zehn Stationen selbst als Achse (sortiert nach Stationsnummer, wie
// die Tabelle darunter) - Tufte nennt das "small multiples": eine Form,
// die die Verteilung über vergleichbare Einheiten zeigt, nicht zwingend
// über Zeit.
function stationsauslastungUebersicht(zeilen) {
    const volle = zeilen.filter((z) => z.fuellstand >= 1);
    const schwaechsteStation = extremwert(zeilen, 'saldo', true);

    // Netzauslastung gesamt: die Frage, die "Stationen" (Anzahl) und
    // "Volle Stationen" (Extremfall) offenlassen - wie voll ist das
    // NETZ ALS GANZES, die Zahl fuer eine Kapazitaetsplanung ("brauchen
    // wir insgesamt mehr Stellplaetze"). KAPAZITAETSGEWICHTET
    // (sum(belegt)/sum(kapazitaet)), NICHT der Durchschnitt der zehn
    // fuellstand-Werte - derselbe Fehlertyp wie beim ungewichteten
    // Schätzanteil bei CO2 (anteilGewichtet() weiter oben): eine große
    // Station zaehlt hier so viel wie eine kleine, wenn man bloss ihre
    // ANTEILE mittelt, obwohl sie absolut mehr Stellplätze stellt. Beim
    // heutigen Bestand (Kapazitaeten 20 bis 40, siehe Bericht) liegen
    // beide Rechnungen nah beieinander (77,3 % gegen 76,8 %) - der
    // Unterschied ist trotzdem kein Rundungsfehler, sondern eine andere
    // Formel, die bei staerker divergierenden Stationsgroessen (ein
    // künftiger Grossstandort neben den heutigen Zehn) deutlich
    // auseinanderlaufen wuerde.
    const gesamtBelegt = zeilen.reduce((s, z) => s + z.belegt, 0);
    const gesamtKapazitaet = zeilen.reduce((s, z) => s + z.kapazitaet, 0);
    const naiverMittelwertFuellstand = zeilen.reduce((s, z) => s + z.fuellstand, 0) / zeilen.length;

    const kacheln = [
        {
            titel: 'Stationen',
            wert: zahlFormat(zeilen.length),
            // aktuellIndex: null - eine "letzte Station nach Nummer" ist
            // kein aktueller Zeitraum, die Hervorhebung waere hier
            // sinnlos (siehe Kopfkommentar bei saeulenSparkline()).
            grafik: saeulenSparkline(zeilen.map((z) => z.fuellstand),
                `Füllstand der ${zeilen.length} Stationen, sortiert nach Stationsnummer, zwischen ` +
                `${prozentFormat(Math.min(...zeilen.map((z) => z.fuellstand)))} und ` +
                `${prozentFormat(Math.max(...zeilen.map((z) => z.fuellstand)))}`,
                { aktuellIndex: null }
            ),
            hinweis: 'Füllstand je Station, sortiert nach Stationsnummer'
        }
    ];

    if (gesamtKapazitaet > 0) {
        kacheln.push({
            titel: 'Netzauslastung gesamt',
            wert: prozentFormatFein(gesamtBelegt / gesamtKapazitaet),
            grafik: zellbalken(gesamtBelegt, gesamtKapazitaet),
            hinweis: `${zahlFormat(gesamtBelegt)} von ${zahlFormat(gesamtKapazitaet)} Stellplätzen belegt · ` +
                `kapazitätsgewichtet, nicht der Durchschnitt der Einzelwerte (${prozentFormatFein(naiverMittelwertFuellstand)})`
        });
    }

    if (volle.length > 0) {
        const wert = document.createElement('span');
        wert.className = 'ton-warnung';
        wert.textContent = zahlFormat(volle.length);
        kacheln.push({
            titel: 'Volle Stationen',
            wert,
            // Echter Bezug im Hinweis (Gestaltungsauftrag Punkt 1: "2 von
            // 10 - dann ist es ein Anteil"), auch ohne eigene Balkengrafik.
            hinweis: `${zahlFormat(volle.length)} von ${zahlFormat(zeilen.length)} Stationen: ` +
                volle.map((z) => z.name).join(', ')
        });
    }

    kacheln.push({
        titel: 'Größtes Ungleichgewicht',
        wert: schwaechsteStation.name,
        grafik: saeulenSparkline(zeilen.map((z) => z.saldo),
            `Saldo der ${zeilen.length} Stationen, sortiert nach Stationsnummer, von ` +
            `${zahlFormat(Math.min(...zeilen.map((z) => z.saldo)))} bis ` +
            `${zahlFormat(Math.max(...zeilen.map((z) => z.saldo)))} - am niedrigsten (rot markiert) ` +
            `bei ${schwaechsteStation.name}`,
            { markierIndizes: [zeilen.indexOf(schwaechsteStation)], aktuellIndex: null }
        ),
        hinweis: `Saldo ${zahlFormat(schwaechsteStation.saldo)} - gibt mehr Räder ab, als sie bekommt`
    });

    return kacheln;
}

function stationsauslastungMaske(zeile) {
    zeigeMaske(`${zeile.stationsnummer} · ${zeile.name}`, [
        { name: 'kapazitaet', titel: 'Kapazität', wert: zahlFormat(zeile.kapazitaet), nurLesen: true },
        { name: 'belegt',     titel: 'Belegt',    wert: zahlFormat(zeile.belegt), nurLesen: true },
        { name: 'abgaenge',   titel: 'Abgänge',   wert: zahlFormat(zeile.abgaenge), nurLesen: true },
        { name: 'zugaenge',   titel: 'Zugänge',   wert: zahlFormat(zeile.zugaenge), nurLesen: true },
        { name: 'saldo',      titel: 'Saldo',     wert: zahlFormat(zeile.saldo), nurLesen: true },
        { name: 'fuellstand', titel: 'Füllstand', wert: prozentFormat(zeile.fuellstand), nurLesen: true }
    ], []);
}
