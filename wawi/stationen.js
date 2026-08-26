// ============================================
// VeloCity Warenwirtschaft — Stationen
//
// Derselbe Bau wie flotte.js (Aufgabe 4): Liste, Detailmaske, ein paar
// Schaltflaechen, ein Anlegen-Einstieg ueber die geteilte Werkzeugleiste
// aus rahmen.js. Ausschliesslich die Bausteine aus rahmen.js und die
// eigene Sicht v_wawi_station - keine Basistabelle, keine fn_-Funktion.
// ============================================

bereichAnmelden({
    schluessel: 'stationen',
    titel: 'Stationen',
    // Dieselben Rollen, die auch v_wawi_station durchlaesst (siehe
    // db/aufbau/0018_wawi_sichten.sql) - waeren sie hier weiter gefasst,
    // saehe etwa die Werkstatt den Menuepunkt und dahinter eine leere
    // Liste, wie im Flotte-Kommentar begruendet.
    rollen: ['disposition', 'leitung'],
    aufbauen: stationenAufbauen
});

async function stationenAufbauen() {
    // ALLERERSTE Anweisung, vor jedem await - siehe Kommentar bei
    // neuerVorgang() in rahmen.js und bei flotteAufbauen() in flotte.js.
    const vorgang = neuerVorgang();

    // Wer anlegen darf, bekommt den Knopf VOR der Liste zu sehen - nicht
    // ausgegraut fuer die Leitung, sondern schlicht nicht vorhanden.
    // Nur fuer disposition sichtbar - dieselbe Rolle, die
    // api_station_anlegen in der Datenbank verlangt
    // (fn_rolle_verlangen('disposition') in 0019_wawi_logik.sql).
    zeigeWerkzeugleiste(darfRolle('disposition'), 'Neue Station anlegen', stationAnlegenMaske);

    const stationen = await ladeListe('v_wawi_station',
        'station_id, stationsnummer, name, strasse, hausnummer, plz, ort, ' +
        'latitude, longitude, kapazitaet, belegt, frei, betriebszeitraum, in_betrieb',
        (q) => q.order('stationsnummer'));

    const fehler = letzterLadeFehler('v_wawi_station');
    if (fehler) {
        // meldeVorgang statt melde: ein inzwischen veralteter Aufruf
        // (siehe Kommentar dort) meldet auch seinen eigenen Ladefehler
        // nicht mehr.
        zeigeUebersicht(vorgang, []);
        meldeVorgang(vorgang, `Die Stationen liessen sich nicht laden: ${fehler}`, 'schlecht');
        return;
    }

    zeigeUebersicht(vorgang, stationenUebersicht(stationen));

    // KEIN Filter hier (Gestaltungsauftrag, Punkt 2, woertlich): "bei
    // zehn Zeilen braucht es keinen Filter. Bau keinen. Ein
    // Bedienelement, das nichts filtert, ist Zierrat." Flotte (275
    // Zeilen), Kunden (1014) und Instandhaltung (Schwere/Alter mehrerer
    // Meldungen) haben je einen zeigeFilterleiste()-Aufruf - Stationen
    // absichtlich nicht, kein vergessener Baustein.

    zeigeListe(vorgang, stationen, [
        { feld: 'stationsnummer', titel: 'Nummer' },
        { feld: 'name',           titel: 'Station' },
        { feld: 'ort',            titel: 'Ort' },
        { feld: 'belegt',         titel: 'Belegt', formatieren: (b, z) => `${b} / ${z.kapazitaet}` },
        // Nur EIN Parameter (die ganze Zeile), nicht (f) wie im
        // Auftragstext: zeigeListe in rahmen.js ruft eine Funktions-
        // Spalte als spalte.klasse(zeile) auf, nicht spalte.klasse(wert).
        // Mit der woertlichen Signatur aus dem Auftrag ("(f) => f === 0")
        // wuerde f auf die ganze Zeile laufen und "f === 0" waere nie
        // wahr - die Warnung fiele lautlos aus. Derselbe Fund wie bei
        // statusKlasse in flotte.js (siehe dortiger Kommentar), hier nur
        // wiederholt, weil der Auftragstext den Fehler ein zweites Mal
        // enthaelt.
        { feld: 'frei',           titel: 'Frei',   klasse: (z) => (z.frei === 0 ? 'warnung' : '') }
    ], stationMaske);
    // KEIN fuenfter Parameter (Zeilenicons, Punkt 3): stationMaske()
    // unten kennt genau eine Handlung, "Stilllegen" - und die ist
    // 'gefaehrlich' (Endzustand ohne Weg zurueck, siehe dortiger
    // Kommentar). "Eine gefaehrliche Handlung gehoert nicht als Icon in
    // eine Zeile" (Gestaltungsauftrag, Punkt 3) laesst fuer Stationen
    // damit keine sichere Handlung uebrig, die sich beilaeufig aus der
    // Liste heraus ausloesen liesse. Ein aktionen-Callback, der fuer
    // jede Zeile trotzdem eine (dann staendig leere) Icon-Spalte
    // anhaengte, waere reine Dekoration - derselbe Massstab, den der
    // Auftrag fuer einen wirkungslosen Filter anlegt ("Zierrat ist in
    // diesem Projekt ein Mangel"), hier auf eine Spalte statt auf ein
    // Bedienelement angewendet.

    // Zwei Stationen sind randvoll (S-0001 mit 40/40, S-0002 mit 25/25).
    // Das ist kein Fehler, aber eine Rueckgabe dort scheitert an GR15 -
    // und wer das nicht weiss, haelt es fuer einen Softwarefehler.
    const voll = stationen.filter((s) => s.frei === 0);
    // meldeVorgang statt melde: nach einer Buchung (Stilllegen,
    // Anlegen - siehe stationMaske/stationAnlegenMaske) ruft genau
    // dieser Aufruf hier sofort im Anschluss auf und ueberschriebe die
    // gerade gezeigte Bestaetigung, bevor sie jemand liest, wenn er noch
    // zu DIESEM Vorgang gehoert. Siehe Begruendung bei meldeVorgang() in
    // rahmen.js.
    meldeVorgang(vorgang, voll.length
        ? `${stationen.length} Stationen, ${voll.length} davon voll: ${voll.map((s) => s.name).join(', ')}`
        : `${stationen.length} Stationen`);
}

// ===== Uebersicht (Gestaltungsauftrag, Punkt 1) =====
//
// "Eine volle Station nimmt keine Rueckgabe an - das ist die wichtigste
// Zahl des Bereichs" (Auftrag) - deshalb an zweiter Stelle, direkt nach
// dem blossen Bestand, mit den Namen der betroffenen Stationen im
// Hinweis (dieselbe Machart wie "Volle Stationen" im Reiter
// "Stationsauslastung" von auswertungen.js - dort aus
// v_wawi_stationsauslastung.fuellstand, hier unabhaengig aus
// v_wawi_station.frei/.kapazitaet, weil dieser Bereich ausschliesslich
// diese eine Sicht liest, siehe Dateikopf).
function stationenUebersicht(stationen) {
    const gesamt = stationen.length;
    const gesamtKapazitaet = stationen.reduce((s, z) => s + z.kapazitaet, 0);
    const gesamtBelegt = stationen.reduce((s, z) => s + z.belegt, 0);
    const volle = stationen.filter((s) => s.frei === 0);
    const stillgelegt = stationen.filter((s) => !s.in_betrieb).length;

    const kacheln = [
        {
            titel: 'Stationen',
            wert: zahlSkaliert(String(gesamt)),
            // Small multiples (Tufte): Fuellstand jeder einzelnen
            // Station, sortiert nach Stationsnummer wie die Tabelle
            // darunter - dieselbe Idee wie stationsauslastungUebersicht()
            // in auswertungen.js, hier aus belegt/kapazitaet statt aus
            // der dortigen eigenen fuellstand-Spalte berechnet.
            grafik: sparkline(stationen.map((s) => (s.kapazitaet ? s.belegt / s.kapazitaet : 0)), {
                beschriftung: `Füllstand der ${gesamt} Stationen, sortiert nach Stationsnummer`
            }),
            hinweis: stillgelegt ? `${stillgelegt} davon stillgelegt` : 'alle in Betrieb'
        }
    ];

    if (volle.length > 0) {
        const wert = document.createElement('span');
        wert.className = 'ton-warnung';
        wert.textContent = String(volle.length);
        kacheln.push({
            titel: 'Volle Stationen',
            wert,
            grafik: zellbalken(volle.length, gesamt, null, { farbe: 'var(--warnung-text)' }),
            hinweis: `${volle.map((s) => s.name).join(', ')} - nimmt keine Rückgabe an`
        });
    }

    kacheln.push({
        titel: 'Gesamtbelegung',
        wert: `${Math.round((gesamtKapazitaet ? gesamtBelegt / gesamtKapazitaet : 0) * 100)} %`,
        grafik: zellbalken(gesamtBelegt, gesamtKapazitaet),
        hinweis: `${gesamtBelegt} von ${gesamtKapazitaet} Stellplätzen belegt`
    });

    return kacheln;
}

function stationMaske(station) {
    const knoepfe = [];

    // darfRolle('disposition') ergaenzt gegenueber dem woertlichen
    // Auftragstext, der hier nur station.in_betrieb prueft: api_station_
    // stilllegen verlangt in der Datenbank die Rolle disposition
    // (fn_rolle_verlangen('disposition'), 0019_wawi_logik.sql), aber
    // dieser Bereich ist auch fuer 'leitung' sichtbar. Ohne die Pruefung
    // saehe eine Leitung ohne disposition-Rolle einen Knopf, den die
    // Datenbank ohnehin abweist - eine Einladung zu einer Fehlermeldung,
    // die niemand braucht, und ein Verstoss gegen die globale Regel
    // "was man nicht darf, soll man nicht suchen" (dasselbe Muster wie
    // die Statuswechsel-/Ausmustern-Knoepfe in flotte.js).
    if (darfRolle('disposition') && station.in_betrieb) {
        knoepfe.push({
            titel: 'Stilllegen',
            art: 'gefaehrlich',
            ausfuehren: async () => {
                // GR22: eine Station wird stillgelegt, nicht geloescht.
                // Sonst verloeren alle Fahrten dorthin ihren Ort. Die
                // Funktion weist Stationen mit Raedern ab - und derzeit
                // gibt es keinen Weg, ein Rad umzusetzen. Das ist eine
                // bekannte Luecke; die Meldung darf sie nicht als
                // Softwarefehler erscheinen lassen.
                if (station.belegt > 0) {
                    melde(`An ${station.name} stehen noch ${station.belegt} Räder. ` +
                          `Sie müssen erst woanders zurückgegeben werden.`, 'warnung');
                    return;
                }
                const ok = await bestaetige(
                    `${station.name} zum heutigen Tag stilllegen? Die Station bleibt in ` +
                    `allen Auswertungen sichtbar, nimmt aber keine Räder mehr auf.`);
                if (!ok) return;
                await rufeAuf('api_station_stilllegen', { p_station_id: station.station_id });
                melde(`${station.name} stillgelegt.`, 'gut');
                await stationenAufbauen();
            }
        });
    }

    zeigeMaske(`${station.stationsnummer} · ${station.name}`, [
        { name: 'anschrift',  titel: 'Anschrift',
          wert: `${station.strasse} ${station.hausnummer}, ${station.plz} ${station.ort}`, nurLesen: true },
        { name: 'kapazitaet', titel: 'Stellplätze', wert: station.kapazitaet, nurLesen: true },
        { name: 'belegt',     titel: 'Belegt',      wert: station.belegt, nurLesen: true },
        { name: 'frei',       titel: 'Frei',        wert: station.frei, nurLesen: true },
        { name: 'lage',       titel: 'Lage',
          wert: `${station.latitude}, ${station.longitude}`, nurLesen: true },
        { name: 'betrieb',    titel: 'Betrieb',
          wert: station.in_betrieb ? 'in Betrieb' : 'stillgelegt', nurLesen: true }
    ], knoepfe);
}

// ===== Eine Station anlegen =====
//
// Der Einstieg dazu ist die Werkzeugleiste am Kopf von
// stationenAufbauen() (zeigeWerkzeugleiste in rahmen.js) - kein eigener
// Leisten-Baustein mehr hier. Die Leitung sieht v_wawi_station zwar
// auch, aber keinen Anlegen-Knopf: was man nicht darf, soll man nicht
// suchen.

function stationAnlegenMaske() {
    zeigeMaske('Neue Station anlegen', [
        { name: 'name',       titel: 'Name',       wert: '' },
        { name: 'strasse',    titel: 'Straße',     wert: '' },
        { name: 'hausnummer', titel: 'Hausnummer', wert: '' },
        { name: 'plz',        titel: 'PLZ',        wert: '' },
        { name: 'ort',        titel: 'Ort',        wert: '' },
        { name: 'latitude',   titel: 'Breite',     wert: '', typ: 'zahl' },
        { name: 'longitude',  titel: 'Länge',      wert: '', typ: 'zahl' },
        { name: 'kapazitaet', titel: 'Stellplätze', wert: '', typ: 'zahl' }
    ], [
        {
            titel: 'Anlegen',
            // 'schaffend' statt 'haupt' (Punkt 4 der Gestaltung, gruen):
            // legt eine neue Station an, siehe Begruendung bei der
            // art-Erlaeuterung von zeigeMaske() in rahmen.js.
            art: 'schaffend',
            ausfuehren: async () => {
                const feld = (name) => document.getElementById(`feld-maske-${name}`).value.trim();

                const name = feld('name');
                const strasse = feld('strasse');
                const hausnummer = feld('hausnummer');
                const plz = feld('plz');
                const ort = feld('ort');
                if (!name || !strasse || !hausnummer || !plz || !ort) {
                    melde('Name, Straße, Hausnummer, PLZ und Ort werden benötigt.', 'schlecht');
                    return;
                }

                // Die Datenbank prueft die Koordinaten auch, aber eine
                // Fehlermeldung VOR dem Absenden ist besser als eine
                // danach (Schritt 3 des Auftrags).
                //
                // Number('') ist 0, nicht NaN - ein leeres Feld waere
                // ohne die eigene Leer-Pruefung stillschweigend als
                // Breite/Laenge 0 (Golf von Guinea) durchgegangen, statt
                // als fehlende Angabe abgewiesen zu werden. Deshalb wird
                // hier zuerst der getrimmte Text geprueft, nicht gleich
                // die Zahl.
                const latitudeText = feld('latitude');
                const longitudeText = feld('longitude');
                if (!latitudeText || !longitudeText) {
                    melde('Breite und Länge werden benötigt.', 'schlecht');
                    return;
                }
                const latitude = Number(latitudeText);
                const longitude = Number(longitudeText);
                if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
                    melde('Die Breite muss zwischen -90 und 90 liegen.', 'schlecht');
                    return;
                }
                if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
                    melde('Die Länge muss zwischen -180 und 180 liegen.', 'schlecht');
                    return;
                }

                const kapazitaet = Number(feld('kapazitaet'));
                if (!Number.isInteger(kapazitaet) || kapazitaet <= 0) {
                    melde('Die Stellplatzzahl muss eine positive ganze Zahl sein.', 'schlecht');
                    return;
                }

                await rufeAuf('api_station_anlegen', {
                    p_name: name,
                    p_strasse: strasse,
                    p_hausnummer: hausnummer,
                    p_plz: plz,
                    p_ort: ort,
                    p_latitude: latitude,
                    p_longitude: longitude,
                    p_kapazitaet: kapazitaet
                });
                melde(`Station ${name} angelegt.`, 'gut');
                await stationenAufbauen();
            }
        }
    ]);
}
