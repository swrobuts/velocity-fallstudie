// ============================================
// VeloCity Warenwirtschaft — Flotte
//
// Der erste echte Arbeitsbereich. Er benutzt ausschliesslich die neun
// Bausteine aus rahmen.js (bereichAnmelden, ladeListe, rufeAuf,
// letzterLadeFehler, zeigeListe, zeigeMaske, melde, bestaetige,
// frageNachGrund, darfRolle) und die eigene Sicht v_wawi_flotte -
// keine Basistabelle, keine fn_-Funktion.
// ============================================

bereichAnmelden({
    schluessel: 'flotte',
    titel: 'Flotte',
    // Dieselben Rollen, die auch v_wawi_flotte durchlaesst. Waeren sie
    // hier weiter gefasst, saehe ein Werkstattmitarbeiter den Menuepunkt
    // und dahinter eine leere Liste - der schlechteste aller Zustaende,
    // weil er wie ein Fehler aussieht und keiner ist.
    rollen: ['disposition', 'werkstatt', 'leitung'],
    aufbauen: flotteAufbauen
});

async function flotteAufbauen() {
    // Wer anlegen darf, bekommt den Knopf VOR der Liste zu sehen - nicht
    // ausgegraut fuer die anderen beiden Rollen, sondern schlicht nicht
    // vorhanden (siehe radMaske weiter unten fuer denselben Grundsatz).
    flotteWerkzeugleisteAufbauen();

    // 275 Raeder sind viel fuer eine ungefilterte Liste, aber nicht zu
    // viel, um sie auf einmal zu laden. Eine Suche ist hier nicht
    // vorgesehen (die kommt erst beim Kundenbereich) - eine Sortierung
    // nach Rahmennummer reicht, um darin etwas wiederzufinden.
    const raeder = await ladeListe('v_wawi_flotte',
        'fahrrad_id, rahmennummer, typ_code, typ, hersteller, modell, status, ' +
        'angeschafft_am, standort, akkustand_prozent, letzte_wartung, ' +
        'offene_schaeden, hoechste_schwere',
        (q) => q.order('rahmennummer'));

    const fehler = letzterLadeFehler('v_wawi_flotte');
    if (fehler) {
        melde(`Die Flotte liess sich nicht laden: ${fehler}`, 'schlecht');
        return;
    }

    zeigeListe(raeder, [
        { feld: 'rahmennummer',   titel: 'Rahmennummer' },
        { feld: 'typ_code',       titel: 'Typ' },
        { feld: 'status',         titel: 'Status', klasse: statusKlasse },
        { feld: 'standort',       titel: 'Standort' },
        { feld: 'offene_schaeden', titel: 'Schäden', formatieren: (n) => n || '' }
    ], radMaske);

    melde(`${raeder.length} Räder`);
}

// Farbe traegt Bedeutung, nicht Dekoration: rot ist ein defektes Rad,
// nicht ein Knopf.
//
// Nur EIN Parameter, nicht (status, zeile) wie im Auftragstext: zeigeListe
// in rahmen.js ruft eine Funktions-Spalte als spalte.klasse(zeile) auf -
// die ganze Zeile, nicht Wert und Zeile getrennt (anders als bei
// spalte.formatieren, das tatsaechlich (wert, zeile) bekommt). Mit der
// woertlichen Signatur aus dem Auftrag laeuft status hier auf die ganze
// Zeile und zeile auf undefined - im Browser nachgestellt und bestaetigt
// (TypeError beim Zugriff auf zeile.hoechste_schwere).
function statusKlasse(zeile) {
    if (zeile.hoechste_schwere === 'fahruntauglich') return 'schlecht';
    if (zeile.status === 'defekt')  return 'schlecht';
    if (zeile.status === 'wartung') return 'warnung';
    if (zeile.status === 'ausgemustert') return 'leise';
    return '';
}

function radMaske(rad) {
    const knoepfe = [];

    // Statuswechsel nur fuer die Rolle, die ihn auch in der Datenbank
    // darf. Der Knopf, den die Funktion ohnehin abweist, ist keine
    // Sicherheitsluecke - aber eine Einladung zu einer Fehlermeldung,
    // die niemand braucht.
    if (darfRolle('disposition') || darfRolle('werkstatt')) {
        for (const ziel of ['verfuegbar', 'wartung', 'defekt']) {
            if (rad.status === ziel) continue;
            knoepfe.push({
                titel: `Auf ${ziel} setzen`,
                art: 'neben',
                ausfuehren: async () => {
                    const grund = await frageNachGrund(`Warum ${ziel}?`);
                    if (grund === null) return;   // Abbruch: kein Aufruf ohne Grund
                    await rufeAuf('api_rad_status_setzen', {
                        p_fahrrad_id: rad.fahrrad_id, p_status: ziel, p_bemerkung: grund
                    });
                    melde(`${rad.rahmennummer} steht jetzt auf ${ziel}.`, 'gut');
                    await flotteAufbauen();
                }
            });
        }
    }

    if (darfRolle('disposition') && rad.status !== 'ausgemustert') {
        knoepfe.push({
            titel: 'Ausmustern',
            art: 'gefaehrlich',
            ausfuehren: async () => {
                // Ausmustern ist nicht zurueckzuholen: das Rad verliert
                // seinen Standort und verschwindet aus jeder Liste. Die
                // Fahrten bleiben, aber das Rad kommt nicht wieder.
                const ok = await bestaetige(
                    `${rad.rahmennummer} endgültig ausmustern? Das Rad verliert seinen ` +
                    `Standort und erscheint in keiner Liste mehr. Seine Fahrten bleiben erhalten.`);
                if (!ok) return;
                const grund = await frageNachGrund('Grund der Ausmusterung');
                if (grund === null) return;
                await rufeAuf('api_rad_ausmustern',
                    { p_fahrrad_id: rad.fahrrad_id, p_grund: grund });
                melde(`${rad.rahmennummer} ausgemustert.`, 'gut');
                await flotteAufbauen();
            }
        });
    }

    zeigeMaske(`Rad ${rad.rahmennummer}`, [
        { name: 'typ',            titel: 'Typ',              wert: `${rad.typ} (${rad.typ_code})`, nurLesen: true },
        { name: 'modell',         titel: 'Modell',           wert: `${rad.hersteller} ${rad.modell}`, nurLesen: true },
        { name: 'status',         titel: 'Status',           wert: rad.status, nurLesen: true },
        { name: 'standort',       titel: 'Standort',         wert: rad.standort || 'unterwegs', nurLesen: true },
        { name: 'angeschafft_am', titel: 'Angeschafft',      wert: rad.angeschafft_am, nurLesen: true },
        { name: 'letzte_wartung', titel: 'Letzte Wartung',   wert: rad.letzte_wartung || 'noch keine', nurLesen: true },
        { name: 'offene_schaeden', titel: 'Offene Schäden',  wert: rad.offene_schaeden, nurLesen: true },
        { name: 'hoechste_schwere', titel: 'Höchste Schwere', wert: rad.hoechste_schwere || '—', nurLesen: true }
    ], knoepfe);
}

// ===== Ein Rad anlegen =====
//
// api_rad_anlegen verlangt drei Angaben - Rahmennummer, Modell, Station -
// und keine v_wawi_-Sicht liefert Modelle oder Stationen von sich aus in
// einer fuer eine Eingabemaske passenden Form ausser v_wawi_modell
// (Aufgabe 3, eigens dafuer angelegt) und v_wawi_station.

// Eigener, an dieser Stelle im DOM liegender Werkzeugleisten-Container,
// nach demselben Fund-oder-Anlegen-Muster wie reiterleiste() in
// rahmen.js: flotteAufbauen() laeuft nicht nur beim ersten Aufbau des
// Bereichs (dann ist #arbeitsliste leer), sondern auch nach jeder
// Buchung ueber radMaske() - ohne dieses Muster stapelten sich die
// Knoepfe bei jedem erneuten Aufruf.
function flotteWerkzeugleiste() {
    let el = document.getElementById('flotte-werkzeugleiste');
    if (!el) {
        el = document.createElement('div');
        el.id = 'flotte-werkzeugleiste';
        el.className = 'werkzeugleiste';
        const wurzel = document.getElementById('arbeitsliste');
        wurzel.insertBefore(el, wurzel.firstChild);
    }
    el.replaceChildren();
    return el;
}

// Nur fuer disposition sichtbar - dieselbe Rolle, die api_rad_anlegen in
// der Datenbank verlangt (GR-Grundsatz dieser Oberflaeche: was man nicht
// darf, soll man nicht suchen). Werkstatt und Leitung ohne disposition
// bekommen deshalb gar keinen - auch keinen leeren - Leistenbereich: ein
// Container ohne Inhalt bliebe sonst als schmaler, unerklaerter Streifen
// ueber der Liste stehen.
function flotteWerkzeugleisteAufbauen() {
    if (!darfRolle('disposition')) {
        document.getElementById('flotte-werkzeugleiste')?.remove();
        return;
    }
    const leiste = flotteWerkzeugleiste();

    const knopf = document.createElement('button');
    knopf.type = 'button';
    knopf.textContent = 'Neues Rad anlegen';
    knopf.className = 'knopf-haupt';
    knopf.addEventListener('click', async () => {
        knopf.disabled = true;
        try {
            await radAnlegenMaske();
        } catch (fehler) {
            melde(fehler.message, 'schlecht');
        } finally {
            knopf.disabled = false;
        }
    });
    leiste.append(knopf);
}

async function radAnlegenMaske() {
    // Beide Sichten sind fuer dieselbe Rolle sichtbar wie der Knopf, der
    // hierher fuehrt (disposition) - eine leere Auswahlliste hiesse hier
    // also einen technischen Fehler, keine fehlende Berechtigung.
    const [modelle, stationen] = await Promise.all([
        ladeListe('v_wawi_modell',
            'modell_id, hersteller, modellbezeichnung, typ_code, raeder_im_bestand',
            (q) => q.order('hersteller').order('modellbezeichnung')),
        ladeListe('v_wawi_station', 'station_id, name, frei, in_betrieb',
            (q) => q.order('name'))
    ]);

    const fehlerModell = letzterLadeFehler('v_wawi_modell');
    const fehlerStation = letzterLadeFehler('v_wawi_station');
    if (fehlerModell || fehlerStation) {
        melde(`Modelle oder Stationen liessen sich nicht laden: ${fehlerModell || fehlerStation}`, 'schlecht');
        return;
    }
    if (!modelle.length || !stationen.length) {
        melde('Es gibt weder Modelle noch Stationen, aus denen ein neues Rad angelegt werden koennte.', 'schlecht');
        return;
    }

    zeigeMaske('Neues Rad anlegen', [
        { name: 'rahmennummer', titel: 'Rahmennummer', wert: '' },
        {
            name: 'modell_id', titel: 'Modell', wert: modelle[0].modell_id,
            optionen: modelle.map((m) => ({
                wert: m.modell_id,
                text: `${m.hersteller} ${m.modellbezeichnung} (${m.typ_code}, ${m.raeder_im_bestand} im Bestand)`
            }))
        },
        {
            // frei steht mit in der Beschriftung, nicht als Filter: eine
            // volle Station weist die Datenbank ueber GR15 ab, aber wer
            // sie trotzdem waehlen will - etwa weil gerade ein Rad
            // ausgemustert wird -, soll das weiterhin koennen.
            name: 'station_id', titel: 'Station', wert: stationen[0].station_id,
            optionen: stationen.map((s) => ({
                wert: s.station_id,
                text: `${s.name} (${s.frei} frei)${s.in_betrieb ? '' : ' — stillgelegt'}`
            }))
        }
    ], [
        {
            titel: 'Anlegen',
            art: 'haupt',
            ausfuehren: async () => {
                const rahmennummer = document.getElementById('feld-maske-rahmennummer').value.trim();
                if (!rahmennummer) {
                    melde('Die Rahmennummer fehlt.', 'schlecht');
                    return;
                }
                // <select>.value ist immer ein String - fuer die
                // bigint-Parameter der Funktion wird daraus wieder eine
                // Zahl, statt darauf zu vertrauen, dass PostgREST die
                // Umwandlung selbst uebernimmt.
                const modellId = Number(document.getElementById('feld-maske-modell_id').value);
                const stationId = Number(document.getElementById('feld-maske-station_id').value);

                await rufeAuf('api_rad_anlegen', {
                    p_rahmennummer: rahmennummer,
                    p_modell_id: modellId,
                    p_station_id: stationId
                });
                melde(`Rad ${rahmennummer} angelegt.`, 'gut');
                await flotteAufbauen();
            }
        }
    ]);
}
