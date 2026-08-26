// ============================================
// VeloCity Warenwirtschaft — Auswertungen
//
// Vier Reiter, vier reine Lesesichten, keine Buchung. Anders als die
// vier Arbeitsbereiche davor gibt es hier keine Werkzeugleiste und keine
// schreibenden Knoepfe in der Detailmaske - "Auswertungen" liest, es
// bucht nicht. Die Detailmaske je Zeile bleibt trotzdem stehen (siehe
// *Maske()-Funktionen unten): wer mit Pfeiltasten durch die Liste geht,
// soll eine Zeile auch OHNE die ganze Tabellenbreite lesen koennen -
// derselbe Grund, aus dem Screenreader-Nutzer eine Tabelle zeilenweise,
// nicht spaltenweise erfassen.
//
// Ausschliesslich die Bausteine aus rahmen.js (bereichAnmelden, ladeListe,
// letzterLadeFehler, zeigeListe, zeigeMaske, zeigeLeermaske,
// zeigeUnterreiter, melde, meldeVorgang, neuerVorgang, maskeVerwerfen)
// und die eigenen Sichten v_wawi_umsatz_radtyp, v_wawi_umsatz_kundengruppe,
// v_wawi_km_co2, v_wawi_stationsauslastung - keine Basistabelle, keine
// fn_-Funktion. rufeAuf() taucht in dieser Datei bewusst nicht auf: es
// gibt in diesem Bereich nichts zu schreiben.
//
// v_wawi_fahrt_km wird bewusst NICHT gelesen (auch nicht fuer eine
// eigene Fahrtenliste): sie fuehrt Einzelfahrten mit kunde_id und
// Zeitstempel, also ein Bewegungsprofil - genau das, dessen Fernhalten
// die Spezifikation zum Lehrpunkt macht (siehe Kopfkommentar der Sicht
// in 0018_wawi_sichten.sql und der Auftragstext dieser Aufgabe).
// v_wawi_km_co2 liefert schon die richtige, aggregierte Ebene.
// ============================================

bereichAnmelden({
    schluessel: 'auswertungen',
    titel: 'Auswertungen',
    // Nur die Leitung. v_wawi_stationsauslastung laesst zusaetzlich
    // disposition durch (0018_wawi_sichten.sql, "hat_rolle('disposition')
    // or hat_rolle('leitung')") - die drei anderen Sichten filtern
    // ausschliesslich auf 'leitung'. Diese Datei zeigt trotzdem alle vier
    // Reiter nur der Leitung: die Disposition bekommt die
    // Stationsauslastung im Bereich Stationen (Aufgabe 5), nicht hier -
    // ein zweiter Zugang zu denselben Zahlen unter anderem Namen waere
    // keine Vereinfachung. Genau umgekehrt zu dem Fund, der gerade in
    // kunden.js geprueft wurde (Bereich fuer zwei Rollen sichtbar, aber
    // nur eine der beiden von den dahinterliegenden Funktionen
    // akzeptiert): hier ist der Bereich ENGER als die Sicht erlaubt, mit
    // Absicht und aus einem im Kommentar der Sicht selbst genannten Grund.
    rollen: ['leitung'],
    aufbauen: auswertungenAufbauen
});

// NICHT "unterbereich" genannt, obwohl es fachlich dasselbe waere:
// instandhaltung.js deklariert bereits ein globales "let unterbereich" -
// alle wawi/*.js-Dateien teilen sich, weil sie ganz ohne Module und ohne
// Buendelwerkzeug ueber <script>-Tags geladen werden (globale
// Randbedingung dieser Aufgabe), EINEN einzigen Gueltigkeitsbereich. Ein
// zweites "let unterbereich" hier waere kein stiller Bug, sondern ein
// SyntaxError beim Laden dieser Datei ("Identifier 'unterbereich' has
// already been declared") - das ganze Skript liefe gar nicht erst an,
// bereichAnmelden() wuerde nie aufgerufen, und der Menuepunkt
// "Auswertungen" bliebe spurlos unsichtbar. Genau das im Browser
// nachgestellt und bestaetigt (siehe Bericht), deshalb hier der
// bereichseigene Name.
let auswertungenReiter = 'umsatz_radtyp';   // 'umsatz_radtyp' | 'umsatz_kundengruppe' | 'km_co2' | 'stationsauslastung'

async function auswertungenAufbauen() {
    // ALLERERSTE Anweisung, vor jedem await - siehe Kommentar bei
    // neuerVorgang() in rahmen.js. Ein Reiterwechsel UND ein
    // Bereichswechsel loesen beide einen neuen Vorgang aus; ein
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
        // Dieselbe Begruendung wie in instandhaltung.js: ohne dies
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
// mit Waehrungszeichen NACH der Zahl statt als Wort ausgeschrieben, weil
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

// monat kommt als Datumstext des Monatsersten ('2026-03-01' o.ae.) ueber
// PostgREST herein - date_trunc('month', ...)::date in der Sicht. Eine
// Anzeige als "Mär 2026" macht den Jahresgang und den Tarifwechsel zum
// 1. Maerz auf den ersten Blick lesbar, ein rohes ISO-Datum nicht.
const MONATSNAMEN = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
function monatFormat(monat) {
    const [jahr, monatsnummer] = monat.split('-');
    return `${MONATSNAMEN[Number(monatsnummer) - 1]} ${jahr}`;
}

// Rechtsbuendige Zahlenspalte, optional mit einer zweiten Klasse fuer
// Bedeutung (schlecht/warnung/gut) - siehe Kommentar bei
// ".arbeitstabelle td.zahl" in style.css. zeigeListe() in rahmen.js setzt
// spalte.klasse als EINEN Klassennamen-String (td.className = klasse),
// deshalb hier zusammengesetzt statt als zwei getrennte Klassen erwartet.
function zahlKlasse(zusatz = '') {
    return zusatz ? `zahl ${zusatz}` : 'zahl';
}

// ===== Der Fehler aus Schritt 2 des Auftrags, korrigiert =====
//
// anteilGewichtet() ist woertlich aus dem Auftrag uebernommen - sie ist
// richtig. co2Zelle() dagegen NICHT: der Auftrag baut sie mit einem
// eingebetteten <span class="leise">...</span> und einem Rueckgabewert,
// der als Zellinhalt gedacht ist. zeigeListe() in rahmen.js setzt
// Zellinhalte aber ausschliesslich ueber td.textContent (siehe dort) -
// nie ueber innerHTML. Ein <span> erschiene dort wortwoertlich als Text
// in der Tabelle ("6611.95 kg <span class="leise">(40 % geschätzt)
// </span>"), nicht als graue Klammer.
//
// Entscheidung: OHNE Auszeichnung, nicht rahmen.js um einen zweiten Weg
// erweitern, Zellen aus Elementen zu bauen. Begruendung im Bericht:
// zusammengefasst, weil der fachliche Kern des Auftrags - der
// Schaetzanteil steht SICHTBAR NEBEN der Zahl, nicht in einer Fussnote -
// mit reinem Text vollstaendig erreicht wird, waehrend eine allgemeine
// "zeigeZelle(elemente)"-API in rahmen.js fuer diese eine Verwendung ein
// zweites, selten gebrauchtes Zellformat einfuehrte, das jeder kuenftige
// Bearbeiter zusaetzlich zu textContent verstehen muesste. Die reine
// Textloesung kostet nur den grauen Ton der Klammer - eine Dekoration,
// keine Information.
function co2Zelle(zeile) {
    return `${kgFormat(zeile.co2_ersparnis_kg)} (${prozentFormat(zeile.anteil_geschaetzt)} geschätzt)`;
}

// v_wawi_km_co2 liefert anteil_geschaetzt JE ZEILE. Wer die Spalte ueber
// Monate/Radtypen mittelt, bekommt 0,532 (siehe Bericht, gegen die
// Datenbank gemessen) - der tatsaechliche, fahrtgewichtete Anteil liegt
// bei 0,400, dreizehn Prozentpunkte darunter, weil die Zeilen sehr
// unterschiedlich viele Fahrten tragen (1 bis ueber 1000 je Monat/Typ).
// Deshalb hier ueber die absoluten Zaehler summiert und erst danach
// geteilt, nicht ueber den Anteil selbst gemittelt.
function anteilGewichtet(zeilen) {
    const fahrten    = zeilen.reduce((s, z) => s + z.fahrten, 0);
    const geschaetzt = zeilen.reduce((s, z) => s + z.fahrten_geschaetzt, 0);
    return fahrten ? geschaetzt / fahrten : 0;
}

// ===== Umsatz nach Radtyp =====

async function umsatzRadtypZeigen(vorgang) {
    const zeilen = await ladeListe('v_wawi_umsatz_radtyp',
        'monat, typ_code, typ, fahrten, minuten, umsatz, umsatz_je_fahrt',
        (q) => q.order('monat').order('typ_code'));

    const fehler = letzterLadeFehler('v_wawi_umsatz_radtyp');
    if (fehler) {
        meldeVorgang(vorgang, `Der Umsatz nach Radtyp liess sich nicht laden: ${fehler}`, 'schlecht');
        return;
    }

    if (zeilen.length === 0) {
        // Anders als bei Instandhaltung ist eine leere Liste hier KEIN
        // erwarteter Normalfall (siehe Bestandstabelle im Auftrag: das
        // Referenzjahr traegt 12 030 Fahrten und 4117 Rechnungen) -
        // trotzdem dieselbe Sorgfalt: null Zeilen koennten auch bedeuten,
        // dass hat_rolle('leitung') gerade false liefert, obwohl die
        // Navigation den Bereich zeigt (z. B. eine Rolle, die zwischen
        // Laden der Navigation und Laden dieser Liste entzogen wurde).
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

    zeigeListe(vorgang, zeilen, [
        { feld: 'monat',          titel: 'Monat',        formatieren: (w) => monatFormat(w) },
        { feld: 'typ',            titel: 'Radtyp' },
        { feld: 'fahrten',        titel: 'Fahrten',      formatieren: zahlFormat, klasse: zahlKlasse() },
        { feld: 'minuten',        titel: 'Minuten',      formatieren: zahlFormat, klasse: zahlKlasse() },
        { feld: 'umsatz',         titel: 'Umsatz',       formatieren: geldFormat, klasse: zahlKlasse() },
        { feld: 'umsatz_je_fahrt', titel: 'Je Fahrt',    formatieren: geldFormat, klasse: zahlKlasse() }
    ], umsatzRadtypMaske);

    // Gesamtsumme UND Fahrten insgesamt in der Statuszeile - die
    // Kontrollzahl aus Schritt 3 des Auftrags (35 454,47 €) soll man
    // ablesen koennen, ohne selbst zu addieren.
    const gesamtUmsatz = zeilen.reduce((s, z) => s + z.umsatz, 0);
    const gesamtFahrten = zeilen.reduce((s, z) => s + z.fahrten, 0);
    meldeVorgang(vorgang,
        `${zeilen.length} Monatszeilen, ${zahlFormat(gesamtFahrten)} Fahrten, ` +
        `Umsatz gesamt ${geldFormat(gesamtUmsatz)}`);
}

function umsatzRadtypMaske(zeile) {
    zeigeMaske(`${zeile.typ} · ${monatFormat(zeile.monat)}`, [
        { name: 'typ',            titel: 'Radtyp',    wert: `${zeile.typ} (${zeile.typ_code})`, nurLesen: true },
        { name: 'monat',          titel: 'Monat',      wert: monatFormat(zeile.monat), nurLesen: true },
        { name: 'fahrten',        titel: 'Fahrten',    wert: zahlFormat(zeile.fahrten), nurLesen: true },
        { name: 'minuten',        titel: 'Minuten',    wert: zahlFormat(zeile.minuten), nurLesen: true },
        { name: 'umsatz',         titel: 'Umsatz',     wert: geldFormat(zeile.umsatz), nurLesen: true },
        { name: 'umsatz_je_fahrt', titel: 'Je Fahrt',  wert: geldFormat(zeile.umsatz_je_fahrt), nurLesen: true }
    ], []);
}

// ===== Umsatz nach Kundengruppe =====

async function umsatzKundengruppeZeigen(vorgang) {
    const zeilen = await ladeListe('v_wawi_umsatz_kundengruppe',
        'monat, tarif_code, tarif, kunden, fahrten, umsatz, umsatz_je_kunde',
        (q) => q.order('monat').order('tarif_code'));

    const fehler = letzterLadeFehler('v_wawi_umsatz_kundengruppe');
    if (fehler) {
        meldeVorgang(vorgang, `Der Umsatz nach Kundengruppe liess sich nicht laden: ${fehler}`, 'schlecht');
        return;
    }

    if (zeilen.length === 0) {
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

    zeigeListe(vorgang, zeilen, [
        { feld: 'monat',           titel: 'Monat',      formatieren: (w) => monatFormat(w) },
        { feld: 'tarif',           titel: 'Tarif' },
        { feld: 'kunden',          titel: 'Kunden',     formatieren: zahlFormat, klasse: zahlKlasse() },
        { feld: 'fahrten',         titel: 'Fahrten',    formatieren: zahlFormat, klasse: zahlKlasse() },
        { feld: 'umsatz',          titel: 'Umsatz',     formatieren: geldFormat, klasse: zahlKlasse() },
        { feld: 'umsatz_je_kunde', titel: 'Je Kunde',   formatieren: geldFormat, klasse: zahlKlasse() }
    ], umsatzKundengruppeMaske);

    // Dieselbe Gesamtsumme wie im Radtyp-Reiter (35 454,47 € - beide
    // Sichten summieren dieselben Entgeltpositionen, nur anders
    // gruppiert). Zwei getrennte Wege zu derselben Zahl sind die
    // Gegenprobe, die Schritt 3 des Auftrags verlangt - stimmen sie
    // nicht ueberein, ist eine der beiden Gruppierungen fehlerhaft.
    const gesamtUmsatz = zeilen.reduce((s, z) => s + z.umsatz, 0);
    meldeVorgang(vorgang, `${zeilen.length} Monatszeilen, Umsatz gesamt ${geldFormat(gesamtUmsatz)}`);
}

function umsatzKundengruppeMaske(zeile) {
    zeigeMaske(`${zeile.tarif} · ${monatFormat(zeile.monat)}`, [
        { name: 'tarif',           titel: 'Tarif',    wert: `${zeile.tarif} (${zeile.tarif_code})`, nurLesen: true },
        { name: 'monat',           titel: 'Monat',    wert: monatFormat(zeile.monat), nurLesen: true },
        { name: 'kunden',          titel: 'Kunden',   wert: zahlFormat(zeile.kunden), nurLesen: true },
        { name: 'fahrten',         titel: 'Fahrten',  wert: zahlFormat(zeile.fahrten), nurLesen: true },
        { name: 'umsatz',          titel: 'Umsatz',   wert: geldFormat(zeile.umsatz), nurLesen: true },
        { name: 'umsatz_je_kunde', titel: 'Je Kunde', wert: geldFormat(zeile.umsatz_je_kunde), nurLesen: true }
    ], []);
}

// ===== Kilometer und CO2 =====

async function kmCo2Zeigen(vorgang) {
    const zeilen = await ladeListe('v_wawi_km_co2',
        'monat, typ_code, fahrten, kilometer, fahrten_geschaetzt, anteil_geschaetzt, co2_ersparnis_kg',
        (q) => q.order('monat').order('typ_code'));

    const fehler = letzterLadeFehler('v_wawi_km_co2');
    if (fehler) {
        meldeVorgang(vorgang, `Kilometer und CO2 liessen sich nicht laden: ${fehler}`, 'schlecht');
        return;
    }

    if (zeilen.length === 0) {
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
    // Anzeigenamen wie v_wawi_umsatz_radtyp.typ - anders als dort waere
    // ein Zusatz-Join auf fahrradtyp fuer eine reine Auswertungssicht
    // eine Erweiterung, die niemand beauftragt hat. Der Code selbst ist
    // in dieser Tabelle so kurz und so wenig mehrdeutig (zwei bis drei
    // Werte), dass er unuebersetzt lesbar bleibt.
    zeigeListe(vorgang, zeilen, [
        { feld: 'monat',    titel: 'Monat',   formatieren: (w) => monatFormat(w) },
        { feld: 'typ_code', titel: 'Radtyp' },
        { feld: 'fahrten',  titel: 'Fahrten', formatieren: zahlFormat, klasse: zahlKlasse() },
        { feld: 'kilometer', titel: 'Kilometer', formatieren: kmFormat, klasse: zahlKlasse() },
        {
            // Schritt 2 des Auftrags, korrigiert - siehe Kommentar bei
            // co2Zelle() weiter oben: der Schaetzanteil DIESER ZEILE
            // steht direkt neben der Zahl, nicht in einer Fussnote.
            feld: 'co2_ersparnis_kg', titel: 'CO₂-Ersparnis',
            formatieren: (w, z) => co2Zelle(z), klasse: zahlKlasse()
        }
    ], kmCo2Maske);

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

function kmCo2Maske(zeile) {
    zeigeMaske(`${zeile.typ_code} · ${monatFormat(zeile.monat)}`, [
        { name: 'typ_code', titel: 'Radtyp',    wert: zeile.typ_code, nurLesen: true },
        { name: 'monat',    titel: 'Monat',      wert: monatFormat(zeile.monat), nurLesen: true },
        { name: 'fahrten',  titel: 'Fahrten',    wert: zahlFormat(zeile.fahrten), nurLesen: true },
        { name: 'kilometer', titel: 'Kilometer', wert: kmFormat(zeile.kilometer), nurLesen: true },
        {
            name: 'fahrten_geschaetzt', titel: 'Davon geschätzt',
            wert: `${zahlFormat(zeile.fahrten_geschaetzt)} von ${zahlFormat(zeile.fahrten)} Fahrten ` +
                  `(${prozentFormat(zeile.anteil_geschaetzt)})`,
            nurLesen: true
        },
        { name: 'co2_ersparnis_kg', titel: 'CO₂-Ersparnis', wert: co2Zelle(zeile), nurLesen: true }
    ], []);
}

// ===== Stationsauslastung =====
//
// Anders als die drei Reiter davor liefert diese Sicht KEINE Monatszeilen
// - v_wawi_stationsauslastung fuehrt keine monat-Spalte (siehe
// 0018_wawi_sichten.sql: station_id, stationsnummer, name, kapazitaet,
// abgaenge, zugaenge, saldo, belegt, fuellstand). Sie ist eine
// Gesamtstands-Momentaufnahme je Station ueber den kompletten Bestand an
// abgeschlossenen Ausleihen, nicht nach Monat gruppiert. Der Auftragstext
// ("Jede als Tabelle mit Monatszeilen") beschreibt damit fuer diesen
// vierten Reiter nicht, was die Sicht liefert - gegen die tatsaechlichen
// Spalten geprueft (0018_wawi_sichten.sql), nicht vermutet. Eine Zeile je
// Station ist die einzige Darstellung, die zu den Spalten passt.
async function stationsauslastungZeigen(vorgang) {
    const zeilen = await ladeListe('v_wawi_stationsauslastung',
        'station_id, stationsnummer, name, kapazitaet, abgaenge, zugaenge, saldo, belegt, fuellstand',
        (q) => q.order('stationsnummer'));

    const fehler = letzterLadeFehler('v_wawi_stationsauslastung');
    if (fehler) {
        meldeVorgang(vorgang, `Die Stationsauslastung liess sich nicht laden: ${fehler}`, 'schlecht');
        return;
    }

    if (zeilen.length === 0) {
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
        { feld: 'kapazitaet',     titel: 'Kapazität', formatieren: zahlFormat, klasse: zahlKlasse() },
        { feld: 'belegt',         titel: 'Belegt',    formatieren: zahlFormat, klasse: zahlKlasse() },
        { feld: 'abgaenge',       titel: 'Abgänge',   formatieren: zahlFormat, klasse: zahlKlasse() },
        { feld: 'zugaenge',       titel: 'Zugänge',   formatieren: zahlFormat, klasse: zahlKlasse() },
        {
            // Farbe traegt Bedeutung: eine Station, die dauerhaft mehr
            // Raeder abgibt als sie bekommt (Saldo negativ), blutet leer
            // und muss von Hand nachgefuellt werden - keine Dekoration,
            // sondern derselbe Signalgedanke wie "frei" in stationen.js.
            feld: 'saldo', titel: 'Saldo',
            formatieren: (w) => (w > 0 ? `+${zahlFormat(w)}` : zahlFormat(w)),
            klasse: (z) => zahlKlasse(z.saldo < 0 ? 'warnung' : z.saldo > 0 ? 'gut' : '')
        },
        {
            feld: 'fuellstand', titel: 'Füllstand', formatieren: prozentFormat,
            klasse: (z) => zahlKlasse(z.fuellstand >= 1 ? 'warnung' : '')
        }
    ], stationsauslastungMaske);

    const leer = zeilen.filter((z) => z.belegt === 0).length;
    meldeVorgang(vorgang, `${zeilen.length} Stationen${leer ? `, ${leer} davon ohne Rad` : ''}`);
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
