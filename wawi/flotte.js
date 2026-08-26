// ============================================
// VeloCity Warenwirtschaft — Flotte
//
// Der erste echte Arbeitsbereich. Er benutzt ausschliesslich die
// Bausteine aus rahmen.js (bereichAnmelden, ladeListe, rufeAuf,
// letzterLadeFehler, zeigeListe, zeigeMaske, zeigeWerkzeugleiste, melde,
// neuerVorgang, meldeVorgang, bestaetige, frageNachGrund, darfRolle) und
// die eigene Sicht v_wawi_flotte - keine Basistabelle, keine fn_-Funktion.
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
    // ALLERERSTE Anweisung, vor jedem await (siehe Kommentar bei
    // neuerVorgang() in rahmen.js): fuenf Buchungen hintereinander lesen
    // fuenfmal ueber diese Zeile fuenf verschiedene Kennungen ein. Kommt
    // ein aelterer Aufruf dieser Funktion spaeter zurueck als ein
    // juengerer, erkennt er an seiner eigenen, dann veralteten Kennung,
    // dass er nichts mehr schreiben darf - weder Liste noch Statuszeile.
    const vorgang = neuerVorgang();

    // Wer anlegen darf, bekommt den Knopf VOR der Liste zu sehen - nicht
    // ausgegraut fuer die anderen beiden Rollen, sondern schlicht nicht
    // vorhanden (siehe radMaske weiter unten fuer denselben Grundsatz).
    // Nur fuer disposition sichtbar - dieselbe Rolle, die api_rad_anlegen
    // in der Datenbank verlangt.
    zeigeWerkzeugleiste(darfRolle('disposition'), 'Neues Rad anlegen', radAnlegenMaske);

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
        // meldeVorgang statt melde: ist dieser Aufruf inzwischen
        // veraltet (ueberholt oder der Bereich gewechselt), gehoert auch
        // sein eigener Ladefehler nicht mehr zur Gegenwart - siehe
        // Kommentar bei meldeVorgang() in rahmen.js (Befund 2).
        meldeVorgang(vorgang, `Die Flotte liess sich nicht laden: ${fehler}`, 'schlecht');
        return;
    }

    // Fuenfter Parameter radZeilenAktionen (Punkt 5 der Gestaltung, Beleg
    // fuer den neuen Baustein in rahmen.js): dieselben Handlungen wie in
    // radMaske() unten, nur als Icons statt als Knoepfe in der offenen
    // Maske - wer nur den Status setzen oder ausmustern will, muss die
    // Zeile dafuer nicht erst oeffnen. Siehe radHandlungen() weiter
    // unten fuer die gemeinsame Grundlage beider Darstellungen.
    zeigeListe(vorgang, raeder, [
        { feld: 'rahmennummer',   titel: 'Rahmennummer' },
        { feld: 'typ_code',       titel: 'Typ' },
        { feld: 'status',         titel: 'Status', klasse: statusKlasse },
        { feld: 'standort',       titel: 'Standort' },
        { feld: 'offene_schaeden', titel: 'Schäden', formatieren: (n) => n || '' }
    ], radMaske, radZeilenAktionen);

    // meldeVorgang statt melde: nach einer Buchung (Statuswechsel,
    // Ausmustern, Anlegen - siehe radMaske/radAnlegenMaske) ruft genau
    // dieser Aufruf hier sofort im Anschluss auf und ueberschriebe die
    // gerade gezeigte Bestaetigung, bevor sie jemand liest, wenn er noch
    // zu DIESEM Vorgang gehoert. Siehe Begruendung bei meldeVorgang() in
    // rahmen.js.
    meldeVorgang(vorgang, `${raeder.length} Räder`);
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

// Gemeinsame Handlungsliste fuer radMaske() (Knoepfe in der Detailmaske)
// UND radZeilenAktionen() (Icons beim Ueberfahren einer Zeile, Punkt 5
// der Gestaltung) - dieselben Regeln (Rolle, Status), einmal formuliert,
// nicht zweimal gepflegt. Jeder Eintrag traegt zusaetzlich "ziel": kein
// Text zum Anzeigen, sondern ein stabiler Schluessel, an dem
// radIconFuer() unten das passende Icon erkennt (Text ("Auf ${ziel}
// setzen") und Icon duerfen sich frei aendern, ohne dass eines vom
// anderen abgeleitet werden muesste).
function radHandlungen(rad) {
    const handlungen = [];

    // Statuswechsel nur fuer die Rolle, die ihn auch in der Datenbank
    // darf. Der Knopf, den die Funktion ohnehin abweist, ist keine
    // Sicherheitsluecke - aber eine Einladung zu einer Fehlermeldung,
    // die niemand braucht.
    //
    // rad.status !== 'ausgemustert' ergaenzt gegenueber vorher: seit
    // commit caf59b5 (GR13, Luecke M-0001) weist api_rad_status_setzen
    // JEDEN Weg aus 'ausgemustert' zurueck ab - 'ausgemustert' ist ein
    // Endzustand, keine Drehtuer (siehe Kommentar dort in
    // 0019_wawi_logik.sql). Vorher liess sich ein ausgemustertes Rad
    // ueber genau diese Knoepfe wieder auf 'verfuegbar' setzen, ohne
    // Standort - GR13-Verstoss, gemessen statt vermutet. Die Knoepfe
    // fuehrten seit der Sperre nur noch zuverlaessig zu einer Absage;
    // dieselbe Regel wie beim Ausmustern-Knopf weiter unten gilt auch
    // hier: was man nicht darf, wird nicht angezeigt, nicht ausgegraut.
    //
    // rad.status !== 'ausgeliehen' ergaenzt in der Gesamtpruefung: ein
    // Rad in Fahrt hat KEINE Positionszeile (die entsteht erst wieder
    // bei der Rueckgabe), und GR13 verlangt fuer 'verfuegbar', 'wartung'
    // und 'defekt' zwingend einen Standort. api_rad_status_setzen nimmt
    // aber gar keinen Standort entgegen - jeder der drei Knoepfe fuehrt
    // fuer ein Rad auf 'ausgeliehen' deshalb IMMER zur Absage, und zwar
    // mit einer Standort-Meldung, die in die falsche Richtung weist (die
    // Ursache ist die laufende Fahrt, nicht ein vergessener Standort).
    // Nachgemessen mit Rad 599 (Gesamtpruefung, zurueckgerollt): alle
    // drei Ziele scheitern, zwei davon woertlich mit "braucht damit
    // einen Standort".
    if ((darfRolle('disposition') || darfRolle('werkstatt'))
        && rad.status !== 'ausgemustert' && rad.status !== 'ausgeliehen') {
        for (const ziel of ['verfuegbar', 'wartung', 'defekt']) {
            if (rad.status === ziel) continue;
            handlungen.push({
                titel: `Auf ${ziel} setzen`,
                ziel,
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

    // Dieselbe Ergaenzung wie oben, aus demselben Fund: api_rad_ausmustern
    // weist ein Rad in Fahrt zwar mit einer klaren Meldung ab ("ist in
    // Fahrt und kann nicht ausgemustert werden", GR20) statt mit der
    // irrefuehrenden Standort-Meldung von oben - aber es bleibt eine
    // sichere Absage, und die Regel dieses Projekts fragt nicht, wie
    // klar die Absage ist, sondern ob es ueberhaupt eine ist.
    if (darfRolle('disposition') && rad.status !== 'ausgemustert' && rad.status !== 'ausgeliehen') {
        handlungen.push({
            titel: 'Ausmustern',
            ziel: 'ausmustern',
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

    return handlungen;
}

// Kleine Inline-SVGs (Feather-Icons-Stil, 24x24, ein <path> je Symbol) -
// keine Icon-Schrift, keine externe Abhaengigkeit, wie im Auftrag
// verlangt. stroke="currentColor" fehlt absichtlich im Markup selbst:
// .zeilen-aktion svg in style.css setzt stroke: currentColor zentral,
// damit jedes Icon automatisch die Ruhe-/Hover-/Gefahr-Farbe seines
// Knopfes erbt, ohne das hier fuer jedes Symbol zu wiederholen.
const RAD_ICONS = {
    // Haken im Kreis - "auf verfuegbar setzen".
    verfuegbar: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/></svg>',
    // Schraubenschluessel - "auf wartung setzen".
    wartung: '<svg viewBox="0 0 24 24"><path d="M14.7 6.3a4 4 0 00-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 005.4-5.4l-2.6 2.6-2-2z"/></svg>',
    // Warndreieck - "auf defekt setzen".
    defekt: '<svg viewBox="0 0 24 24"><path d="M12 4l9 16H3z"/><path d="M12 10v4"/><circle cx="12" cy="17" r="0.3"/></svg>',
    // Auslagern-Pfeil (Kiste mit Pfeil nach aussen) - "ausmustern".
    ausmustern: '<svg viewBox="0 0 24 24"><path d="M4 8V5a1 1 0 011-1h6"/><path d="M20 8V5a1 1 0 00-1-1h-6"/><rect x="4" y="8" width="16" height="12" rx="1"/><path d="M12 12v5m0 0l-2-2m2 2l2-2"/></svg>'
};

// Fuenfter Parameter von zeigeListe() (rahmen.js) - dieselben Handlungen
// wie radMaske() unten, aus radHandlungen() gewonnen, hier nur mit Icon
// statt mit Text dargestellt.
function radZeilenAktionen(rad) {
    return radHandlungen(rad).map((h) => ({
        titel: h.titel,
        svg: RAD_ICONS[h.ziel],
        art: h.art === 'gefaehrlich' ? 'gefaehrlich' : undefined,
        ausfuehren: h.ausfuehren
    }));
}

function radMaske(rad) {
    const knoepfe = radHandlungen(rad);

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
//
// Der Einstieg dazu ist die Werkzeugleiste am Kopf von flotteAufbauen()
// (zeigeWerkzeugleiste in rahmen.js) - kein eigener Leisten-Baustein
// mehr hier, siehe Kommentar dort.

async function radAnlegenMaske() {
    // Kennung des Bereichs-Vorgangs, der lief, als dieser Knopf gedrueckt
    // wurde - siehe laufenderVorgang() in rahmen.js fuer die Begruendung
    // und den im Browser nachgestellten Fall (WICHTIG 4): Flotte -> "Neues
    // Rad anlegen" -> vor der Rueckkehr (Promise.all unten noch unterwegs)
    // zu Stationen gewechselt. Diese Maske ist selbst kein *Aufbauen()-
    // Vorgang und darf keinen eigenen ueber neuerVorgang() ziehen (siehe
    // dort) - sie merkt sich nur, welcher Vorgang gerade lief.
    const vorgang = laufenderVorgang();

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

    // Der Bereich (oder Stationen selbst per Neuaufbau) kann inzwischen
    // gewechselt haben, waehrend beide Sichten liefen - dann gehoert
    // weder ein Ladefehler noch die Maske selbst noch zur Gegenwart,
    // dieselbe Regel wie bei meldeVorgang() in rahmen.js (Befund 2 dort).
    if (!istAktuellerVorgang(vorgang)) return;

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
            // 'schaffend' statt 'haupt' (Punkt 4 der Gestaltung, gruen):
            // dieser Knopf legt ein neues Rad an, siehe Begruendung bei
            // der art-Erlaeuterung von zeigeMaske() in rahmen.js.
            art: 'schaffend',
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
