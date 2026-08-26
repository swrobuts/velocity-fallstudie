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
// zeigeUnterreiter, melde, meldeVorgang, neuerVorgang, maskeVerwerfen)
// und die eigenen Sichten v_wawi_umsatz_radtyp, v_wawi_umsatz_kundengruppe,
// v_wawi_km_co2, v_wawi_stationsauslastung - keine Basistabelle, keine
// fn_-Funktion. rufeAuf() taucht in dieser Datei bewusst nicht auf: es
// gibt in diesem Bereich nichts zu schreiben.
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

// monat kommt als Datumstext des Monatsersten ('2026-03-01' o.ae.) über
// PostgREST herein - date_trunc('month', ...)::date in der Sicht. Eine
// Anzeige als "Mär 2026" macht den Jahresgang und den Tarifwechsel zum
// 1. März auf den ersten Blick lesbar, ein rohes ISO-Datum nicht.
const MONATSNAMEN = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
function monatFormat(monat) {
    const [jahr, monatsnummer] = monat.split('-');
    return `${MONATSNAMEN[Number(monatsnummer) - 1]} ${jahr}`;
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
    const zeilen = await ladeListe('v_wawi_umsatz_radtyp',
        'monat, typ_code, typ, fahrten, minuten, umsatz, umsatz_je_fahrt',
        (q) => q.order('typ_code').order('monat'));

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
    const zeilenMitVeraenderung = zeilen.map((z, i) => {
        const vorherige = i > 0 && zeilen[i - 1].typ_code === z.typ_code ? zeilen[i - 1] : null;
        const veraenderungJeFahrt = vorherige && vorherige.umsatz_je_fahrt
            ? (z.umsatz_je_fahrt - vorherige.umsatz_je_fahrt) / vorherige.umsatz_je_fahrt : null;
        return { ...z, veraenderungJeFahrt, vorherigeFahrten: vorherige ? vorherige.fahrten : null };
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
        {
            feld: 'veraenderungJeFahrt', titel: 'Δ ggü. Vormonat',
            formatieren: veraenderungFormat,
            klasse: (z) => zahlKlasse(istAuffaellig(z, 'veraenderungJeFahrt') ? 'auffaellig' : '')
        }
    ], umsatzRadtypMaske);

    zeigeUebersicht(vorgang, umsatzRadtypUebersicht(zeilen));

    // Gesamtsumme UND Fahrten insgesamt in der Statuszeile - die
    // Kontrollzahl aus Schritt 3 des Auftrags (35 454,47 €) soll man
    // ablesen können, ohne selbst zu addieren.
    const gesamtUmsatz = zeilen.reduce((s, z) => s + z.umsatz, 0);
    const gesamtFahrten = zeilen.reduce((s, z) => s + z.fahrten, 0);
    meldeVorgang(vorgang,
        `${zeilen.length} Monatszeilen, ${zahlFormat(gesamtFahrten)} Fahrten, ` +
        `Umsatz gesamt ${geldFormat(gesamtUmsatz)}`);
}

// Drei Kacheln für die drei Fragen, mit denen jemand diesen Reiter öffnet
// (Auftrag: "wie ist der Verlauf, wo liegt der Schwerpunkt, was ist
// auffällig") - nicht die Gesamtsumme allein, die steht schon in der
// Statuszeile und wäre als einzige Kachel eine bloße Wiederholung.
function umsatzRadtypUebersicht(zeilen) {
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
        wert: zahlSkaliert(geldFormat(gesamtUmsatz)),
        grafik: sparkline(umsatzLetztesJahr.map((r) => r.wert), {
            beschriftung: `Monatsumsatz der letzten zwölf Monate, von ` +
                `${geldFormat(Math.min(...umsatzLetztesJahr.map((r) => r.wert)))} bis ` +
                `${geldFormat(Math.max(...umsatzLetztesJahr.map((r) => r.wert)))}`
        }),
        hinweis: 'Verlauf der letzten 12 Monate'
    };

    const kachelnFahrten = {
        titel: 'Fahrten gesamt',
        wert: zahlSkaliert(zahlFormat(gesamtFahrten)),
        grafik: sparkline(fahrtenLetztesJahr.map((r) => r.wert), {
            beschriftung: `Fahrten je Monat: ${zahlFormat(tiefpunkt.wert)} im ${monatFormat(tiefpunkt.monat)} ` +
                `am niedrigsten, ${zahlFormat(hoehepunkt.wert)} im ${monatFormat(hoehepunkt.monat)} am höchsten`,
            markierIndex: fahrtenLetztesJahr.indexOf(hoehepunkt)
        }),
        hinweis: `Jahresgang: ${monatFormat(tiefpunkt.monat)} am niedrigsten, ${monatFormat(hoehepunkt.monat)} am höchsten`
    };

    const kacheln = [kachelnUmsatz, kachelnFahrten];

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
            grafik: sparkline(cityBetrieb.map((z) => z.umsatz_je_fahrt), {
                beschriftung: `Umsatz je Fahrt City-Bike: Sprung von ${geldFormat(sprung.vorherigerWert)} ` +
                    `auf ${geldFormat(sprung.wert)} ab ${monatFormat(sprung.monat)}`,
                markierIndex: sprung.index
            }),
            hinweis: `${veraenderungFormat(sprung.veraenderung)} ab ${monatFormat(sprung.monat)} - Tarifwechsel`
        });
    }

    return kacheln;
}

function umsatzRadtypMaske(zeile) {
    zeigeMaske(`${zeile.typ} · ${monatFormat(zeile.monat)}`, [
        { name: 'typ',            titel: 'Radtyp',    wert: `${zeile.typ} (${zeile.typ_code})`, nurLesen: true },
        { name: 'monat',          titel: 'Monat',      wert: monatFormat(zeile.monat), nurLesen: true },
        { name: 'fahrten',        titel: 'Fahrten',    wert: zahlFormat(zeile.fahrten), nurLesen: true },
        { name: 'minuten',        titel: 'Minuten',    wert: zahlFormat(zeile.minuten), nurLesen: true },
        { name: 'umsatz',         titel: 'Umsatz',     wert: geldFormat(zeile.umsatz), nurLesen: true },
        { name: 'umsatz_je_fahrt', titel: 'Je Fahrt',  wert: geldFormat(zeile.umsatz_je_fahrt), nurLesen: true },
        { name: 'veraenderung',   titel: 'Δ ggü. Vormonat', wert: veraenderungFormat(zeile.veraenderungJeFahrt), nurLesen: true }
    ], []);
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

    const umsatzMaximum = Math.max(...zeilen.map((z) => z.umsatz));
    zeigeListe(vorgang, zeilen, [
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
            wert: zahlSkaliert(geldFormat(gesamtUmsatz)),
            grafik: sparkline(letzteZwoelf.map((r) => r.wert), {
                beschriftung: 'Monatsumsatz der letzten zwölf Monate, dieselbe Reihe wie im Reiter "Umsatz nach Radtyp"'
            }),
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
    const kilometerMaximum = Math.max(...zeilen.map((z) => z.kilometer));
    zeigeListe(vorgang, zeilen, [
        { feld: 'monat',    titel: 'Monat',   formatieren: (w) => monatFormat(w) },
        { feld: 'typ_code', titel: 'Radtyp' },
        // summierbar: Fahrten je Monat/Radtyp, additiv - kein
        // Doppelzaehl-Risiko (jede Fahrt gehoert zu genau einer Zeile).
        { feld: 'fahrten',  titel: 'Fahrten', formatieren: zahlFormat, klasse: zahlKlasse(), summierbar: true },
        // Balken/Betrag in zwei Spalten (balkenSpalten() in rahmen.js) -
        // siehe Kommentar dort und im Radtyp-Reiter (Gestaltungsauftrag,
        // Punkt 5). summierbar: gefahrene Kilometer sind additiv.
        ...balkenSpalten('kilometer', 'Kilometer', kilometerMaximum, kmFormat, { summierbar: true }),
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
    const gesamtCo2 = co2Reihe.reduce((s, r) => s + r.wert, 0);
    const gesamtKm = kmReihe.reduce((s, r) => s + r.wert, 0);
    const gesamtFahrten = zeilen.reduce((s, z) => s + z.fahrten, 0);
    const gesamtGeschaetzt = zeilen.reduce((s, z) => s + z.fahrten_geschaetzt, 0);
    const anteil = anteilGewichtet(zeilen);
    const naiverMittelwert = zeilen.reduce((s, z) => s + z.anteil_geschaetzt, 0) / zeilen.length;

    return [
        {
            titel: 'CO₂-Ersparnis gesamt',
            wert: zahlSkaliert(kgFormat(gesamtCo2)),
            grafik: sparkline(co2Reihe.slice(-12).map((r) => r.wert), {
                beschriftung: `CO2-Ersparnis je Monat, letzte zwölf Monate, von ` +
                    `${kgFormat(Math.min(...co2Reihe.slice(-12).map((r) => r.wert)))} bis ` +
                    `${kgFormat(Math.max(...co2Reihe.slice(-12).map((r) => r.wert)))}`
            }),
            hinweis: 'Verlauf der letzten 12 Monate'
        },
        {
            titel: 'Kilometer gesamt',
            wert: zahlSkaliert(kmFormat(gesamtKm)),
            grafik: sparkline(kmReihe.slice(-12).map((r) => r.wert), {
                beschriftung: `Gefahrene Kilometer je Monat, letzte zwölf Monate`
            }),
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
        { name: 'co2_ersparnis_kg', titel: 'CO₂-Ersparnis', wert: co2ZelleText(zeile), nurLesen: true }
    ], []);
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

    const kacheln = [
        {
            titel: 'Stationen',
            wert: zahlFormat(zeilen.length),
            grafik: sparkline(zeilen.map((z) => z.fuellstand), {
                beschriftung: `Füllstand der ${zeilen.length} Stationen, zwischen ` +
                    `${prozentFormat(Math.min(...zeilen.map((z) => z.fuellstand)))} und ` +
                    `${prozentFormat(Math.max(...zeilen.map((z) => z.fuellstand)))}`
            }),
            hinweis: 'Füllstand je Station, sortiert nach Stationsnummer'
        }
    ];

    if (volle.length > 0) {
        const wert = document.createElement('span');
        wert.className = 'ton-warnung';
        wert.textContent = zahlFormat(volle.length);
        kacheln.push({
            titel: 'Volle Stationen',
            wert,
            hinweis: volle.map((z) => z.name).join(', ')
        });
    }

    kacheln.push({
        titel: 'Größtes Ungleichgewicht',
        wert: schwaechsteStation.name,
        grafik: sparkline(zeilen.map((z) => z.saldo), {
            beschriftung: `Saldo der ${zeilen.length} Stationen, von ${zahlFormat(Math.min(...zeilen.map((z) => z.saldo)))} ` +
                `bis ${zahlFormat(Math.max(...zeilen.map((z) => z.saldo)))} - am niedrigsten bei ${schwaechsteStation.name}`,
            markierIndex: zeilen.indexOf(schwaechsteStation)
        }),
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
