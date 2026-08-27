// ============================================
// VeloCity Warenwirtschaft — Flotte
//
// Der erste echte Arbeitsbereich. Er benutzt ausschliesslich die
// Bausteine aus rahmen.js (bereichAnmelden, ladeListe, rufeAuf,
// letzterLadeFehler, zeigeListe, zeigeMaske, zeigeWerkzeugleiste, melde,
// neuerVorgang, meldeVorgang, bestaetige, frageNachGrund, darfRolle) und
// die eigene Sicht v_wawi_flotte - keine Basistabelle, keine fn_-Funktion.
// ============================================

// Navigations-Icon (Gestaltungsauftrag, Punkt 3): ein Fahrrad, aus zwei
// Radkreisen und einem Rahmen-Pfad - dasselbe Raster/dieselbe
// Strichstaerke wie die vier anderen Bereichs-Icons (siehe .bereich-icon
// in style.css, die Familie entsteht dort aus EINEM Regelsatz, nicht aus
// fuenf Einzelfestlegungen).
const ICON_FLOTTE = '<svg viewBox="0 0 24 24"><circle cx="6.5" cy="17" r="3.3"/><circle cx="17.5" cy="17" r="3.3"/><path d="M6.5 17l4-8.5h3.4l3.1 5.5h3.5"/><path d="M12.6 12l-2.3 5"/></svg>';

bereichAnmelden({
    schluessel: 'flotte',
    titelSchluessel: 'nav.flotte',
    icon: ICON_FLOTTE,
    // Dieselben Rollen, die auch v_wawi_flotte durchlaesst. Waeren sie
    // hier weiter gefasst, saehe ein Werkstattmitarbeiter den Menuepunkt
    // und dahinter eine leere Liste - der schlechteste aller Zustaende,
    // weil er wie ein Fehler aussieht und keiner ist.
    rollen: ['disposition', 'werkstatt', 'leitung'],
    aufbauen: flotteAufbauen
});

// Filterzustand (Gestaltungsauftrag, Punkt 2) - modulweit wie
// auswertungenReiter/unterbereich in den Nachbardateien, ueberlebt also
// einen Neuaufbau (Buchung, Reiterwechsel gibt es hier nicht) und wird
// erst durch "Filter zuruecksetzen" oder einen Bereichswechsel wieder
// veraendert (ein Bereichswechsel selbst setzt sie NICHT zurueck - wer
// von Flotte weg- und wieder hinwechselt, soll seinen Filter wiederfinden,
// nicht neu einstellen muessen).
// Gestaltungsauftrag Bedienelemente, Punkt 2: "ich kann bei Filter immer
// nur ein Item aussuchen, brauche aber Multiselect" - jedes der drei Sets
// leer heisst "Alle" (der Ausgangszustand), nichtleer traegt die
// gewaehlten Werte. Rein CLIENTSEITIG gefiltert (raederGefiltert() weiter
// unten) wie zuvor - anders als bei Kundschaft laedt Flotte die
// vollstaendigen 275 Raeder ohnehin auf einmal, eine Serverabfrage
// braeuchte es dafuer nicht.
let flotteFilterStatus = new Set();
let flotteFilterTyp = new Set();
let flotteFilterStandort = new Set();

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
    zeigeWerkzeugleiste(darfRolle('disposition'), t('button.newBike'), radAnlegenMaske);

    // 275 Raeder sind viel fuer eine ungefilterte Liste, aber nicht zu
    // viel, um sie auf einmal zu laden - anders als bei Kunden (Punkt 2
    // des Gestaltungsauftrags: 1014 Zeilen, serverseitig auf 200
    // begrenzt) gibt es hier weder ein .limit() noch eine serverseitige
    // Einschraenkung. Der Status-/Typ-/Stationsfilter unten filtert
    // deshalb bewusst im BROWSER, im bereits vollstaendig geladenen
    // Array raeder: eine zweite Anfrage je Filteraenderung waere fuer
    // 275 Zeilen unnoetig, und die Uebersichtskacheln (die den GESAMTEN
    // Bestand zeigen sollen, nicht die gefilterte Teilmenge) brauchen die
    // vollstaendige Liste ohnehin.
    // fahrtenLetzte30Tage (Punkt 5, Verteilung "Fahrten je Rad"): NUR
    // geladen, wenn die zugrundeliegende Sicht diese Rolle ueberhaupt
    // durchlaesst (siehe fahrtenJeRadVerteilung() weiter unten, ROLLE-
    // Absatz) - fuer ein reines Werkstattkonto bleibt es null, nicht ein
    // leeres [], damit die Kachel dort spaeter GAR NICHT erscheint statt
    // faelschlich "0 Fahrten je Rad" zu zeigen. Parallel zu raeder
    // geladen: beide Anfragen sind unabhaengig voneinander.
    const dreissigTageZurueck = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const [raeder, fahrtenLetzte30Tage] = await Promise.all([
        ladeListe('v_wawi_flotte',
            'fahrrad_id, rahmennummer, typ_code, typ, hersteller, modell, status, ' +
            'angeschafft_am, standort, akkustand_prozent, letzte_wartung, ' +
            'offene_schaeden, hoechste_schwere',
            (q) => q.order('rahmennummer')),
        (darfRolle('disposition') || darfRolle('leitung'))
            ? ladeListe('v_wawi_fahrten_je_tag_rad', 'fahrrad_id', (q) => q.gte('tag', dreissigTageZurueck))
            : Promise.resolve(null)
    ]);

    const fehler = letzterLadeFehler('v_wawi_flotte');
    if (fehler) {
        // meldeVorgang statt melde: ist dieser Aufruf inzwischen
        // veraltet (ueberholt oder der Bereich gewechselt), gehoert auch
        // sein eigener Ladefehler nicht mehr zur Gegenwart - siehe
        // Kommentar bei meldeVorgang() in rahmen.js (Befund 2).
        zeigeUebersicht(vorgang, []);
        // Dieselbe Aufraeumpflicht wie bei zeigeUebersicht(vorgang, [])
        // direkt darueber, nur fuer den eigenen Baustein: sonst bliebe bei
        // einem Ladefehler NACH einem zuvor erfolgreichen Aufbau die
        // Radtyp-Reihe eines fruehreren, jetzt ueberholten Bestands stehen.
        document.getElementById('flotte-typkacheln')?.remove();
        meldeVorgang(vorgang, t('msg.fleetLoadFailed', { fehler }), 'schlecht');
        return;
    }

    // Die Uebersicht (Punkt 1) beschreibt IMMER die ganze Flotte, nie die
    // gefilterte Teilmenge - "womit oeffnet jemand diesen Bereich" ist
    // eine Frage an den Gesamtbestand, nicht an eine gerade gewaehlte
    // Einschraenkung.
    zeigeUebersicht(vorgang, flotteUebersicht(raeder, fahrtenLetzte30Tage));

    const { typen, standorte } = flotteFilterOptionen(raeder);
    // Gestaltungsauftrag, woertlich: "Bei Flotte vermisse ich Produktbilder,
    // wir haben ja die Bikes auch als Bilder, warum werden die nicht
    // miniaturisiert im Kopf angezeigt, damit ich das Produkt/Flotte auch
    // sehe." raeder (UNGEFILTERT) und typen (aus denselben ungefilterten
    // Zeilen, siehe flotteFilterOptionen() weiter unten) - dieselbe
    // Begruendung wie bei zeigeUebersicht() direkt darueber: die Frage
    // "was fahren wir ueberhaupt" bezieht sich auf die ganze Flotte, nicht
    // auf eine gerade gewaehlte Einschraenkung.
    flotteTypkachelnZeigen(vorgang, raeder, typen);
    zeigeFilterleiste(vorgang, true, [
        {
            // Kein { wert: 'alle', ... } mehr in den Optionen - der
            // Rueckweg zu "Alle" ist ein eigener Knopf im
            // Mehrfachauswahl-Popup (mehrfachauswahlFeld() in rahmen.js),
            // Gestaltungsauftrag Bedienelemente Punkt 2: "wartung UND
            // defekt gleichzeitig, um alles zu sehen, was nicht faehrt".
            name: 'status', titel: t('field.status'), wert: flotteFilterStatus,
            optionen: [
                { wert: 'verfuegbar', text: statusAnzeige('verfuegbar', true) },
                { wert: 'ausgeliehen', text: statusAnzeige('ausgeliehen', true) },
                { wert: 'wartung', text: statusAnzeige('wartung', true) },
                { wert: 'defekt', text: statusAnzeige('defekt', true) },
                { wert: 'ausgemustert', text: statusAnzeige('ausgemustert', true) }
            ],
            beiAenderung: (neu) => { flotteFilterStatus = neu; flotteAufbauen(); }
        },
        {
            name: 'typ', titel: t('field.radtyp'), wert: flotteFilterTyp,
            // Aus den geladenen Zeilen gewonnen statt fest eingetragen
            // (CITY/EBIKE/CARGO heute) - ein vierter Radtyp braeuchte
            // sonst eine eigene Codeaenderung hier, obwohl die Flotte
            // ihn schon zeigen wuerde.
            optionen: typen.map(([code, name]) => ({ wert: code, text: name })),
            beiAenderung: (neu) => { flotteFilterTyp = neu; flotteAufbauen(); }
        },
        {
            name: 'standort', titel: t('field.station'), wert: flotteFilterStandort,
            optionen: [
                // standort ist NULL bei laufender Fahrt oder freiem
                // Abstellort (siehe v_wawi_flotte.standort in
                // 0018_wawi_sichten.sql) - ein eigener Auswahlpunkt statt
                // eines stummen Ausschlusses aus der Liste.
                { wert: 'unterwegs', text: t('misc.underwayNoLocation') },
                ...standorte.map((s) => ({ wert: s, text: s }))
            ],
            beiAenderung: (neu) => { flotteFilterStandort = neu; flotteAufbauen(); }
        }
    ]);

    const raederSichtbar = raederGefiltert(raeder);

    if (raeder.length > 0 && raederSichtbar.length === 0) {
        // Der Grenzfall "kein Treffer" (Erprobung, Auftrag): der Filter
        // bleibt sichtbar und bedienbar (siehe zeigeFilterleiste() oben),
        // nur die Tabelle weicht der Leermaske mit einem Rueckweg.
        zeigeLeermaske(
            vorgang,
            t('empty.noBikesFilterTitle'),
            t('empty.noBikesFilterText'),
            {
                titel: t('common.filterResetTitle'),
                ausfuehren: async () => {
                    flotteFilterStatus = new Set();
                    flotteFilterTyp = new Set();
                    flotteFilterStandort = new Set();
                    await flotteAufbauen();
                }
            }
        );
        meldeVorgang(vorgang, t('msg.noBikeWithFilter'));
        return;
    }

    // Fuenfter Parameter radZeilenAktionen (Punkt 5 der Gestaltung, Beleg
    // fuer den neuen Baustein in rahmen.js): dieselben Handlungen wie in
    // radMaske() unten, nur als Icons statt als Knoepfe in der offenen
    // Maske - wer nur den Status setzen oder ausmustern will, muss die
    // Zeile dafuer nicht erst oeffnen. Siehe radHandlungen() weiter
    // unten fuer die gemeinsame Grundlage beider Darstellungen.
    // filterbar:false bei status/typ_code/standort (Spaltenkopf-Baustein,
    // rahmen.js): fuer alle drei gibt es bereits die Filterleiste oben
    // (flotteFilterStatus/-Typ/-Standort) - ein zweiter, unabhaengiger
    // Filter auf demselben Feld koennte sich mit dem ersten widersprechen
    // (Filterleiste "verfuegbar", Spaltenkopf "defekt" -> immer null
    // Zeilen), siehe der lange Kommentar bei zeigeListe() in rahmen.js.
    // Gruppieren bleibt fuer alle drei an - das ist eine neue Faehigkeit,
    // die es vorher gar nicht gab, und widerspricht der Filterleiste
    // nicht (Anzeige, keine Einschraenkung).
    // offene_schaeden: summierbar - eine echte Anzahl je Rad (kein
    // Durchschnitt, keine Ueberzaehlung ueber Zeitraeume wie bei
    // v_wawi_umsatz_kundengruppe.kunden, siehe auswertungen.js), die
    // Summe je Gruppe (z. B. alle Raeder mit Status "defekt") ist
    // fachlich sinnvoll.
    zeigeListe(vorgang, raederSichtbar, [
        { feld: 'rahmennummer',   titel: t('field.rahmennummer') },
        { feld: 'typ_code',       titel: t('field.typ'), filterbar: false },
        { feld: 'status',         titel: t('field.status'), klasse: statusKlasse, filterbar: false,
          formatieren: (wert) => statusAnzeige(wert) },
        { feld: 'standort',       titel: t('field.standort'), filterbar: false },
        { feld: 'offene_schaeden', titel: t('field.schaeden'), formatieren: (n) => n || '', summierbar: true }
    ], radMaske, radZeilenAktionen);

    // meldeVorgang statt melde: nach einer Buchung (Statuswechsel,
    // Ausmustern, Anlegen - siehe radMaske/radAnlegenMaske) ruft genau
    // dieser Aufruf hier sofort im Anschluss auf und ueberschriebe die
    // gerade gezeigte Bestaetigung, bevor sie jemand liest, wenn er noch
    // zu DIESEM Vorgang gehoert. Siehe Begruendung bei meldeVorgang() in
    // rahmen.js.
    meldeVorgang(vorgang, raederSichtbar.length === raeder.length
        ? mengeFormat(raeder.length, 'rad')
        : t('common.xOfPhrase', { x: zahlFormat(raederSichtbar.length), phrase: mengeFormat(raeder.length, 'rad') }));
}

// ===== Uebersicht und Filter (Gestaltungsauftrag, Punkte 1 und 2) =====
//
// "Wer die Flotte oeffnet, will wissen, wie viele einsatzbereit sind und
// wo es klemmt" - die vier Kacheln bilden genau die vier moeglichen
// Werte von status ab (ausgemustert bleibt aussen vor: im heutigen
// Bestand gibt es keine ausgemusterten Raeder, und ein Rad in diesem
// Zustand braucht ohnehin keine Aufmerksamkeit mehr - siehe
// radHandlungen() weiter unten, das auf 'ausgemustert' selbst keine
// Handlung mehr anbietet).
function flotteUebersicht(raeder, fahrtenLetzte30Tage) {
    const gesamt = raeder.length;
    const zaehler = (status) => raeder.filter((r) => r.status === status).length;
    const verfuegbar = zaehler('verfuegbar');
    const ausgeliehen = zaehler('ausgeliehen');
    const wartung = zaehler('wartung');
    const defekt = zaehler('defekt');
    const anteil = (n) => (gesamt ? `${Math.round((n / gesamt) * 100)} %` : '—');

    const wertMitTon = (n, ton) => {
        const spanne = document.createElement('span');
        if (ton) spanne.className = ton;
        spanne.append(zahlSkaliert(String(n)));
        return spanne;
    };

    // Echter Bezug in JEDEM der vier Hinweise (Gestaltungsauftrag Punkt 1):
    // vorher trug nur "Einsatzbereit" die Zaehlerangabe ("X % von Y
    // Raedern"), die uebrigen drei blieben rein qualitativ ("gerade
    // unterwegs" ...). Vier Balken mit gemeinsamer Skala (derselbe Nenner
    // "gesamt") duerfen zwar schon allein durch den Laengenvergleich UEBER
    // die Kacheln hinweg als Anteil gelesen werden (Bissantz: "an einer
    // gemeinsamen Skala ausgerichtet") - jede Kachel soll aber auch FUER
    // SICH ALLEIN stehen koennen, ohne dass man die drei Nachbarkacheln
    // danebenhalten muss, um den Nenner zu erschliessen.
    const raederPhrase = mengeFormat(gesamt, 'rad');
    const kacheln = [
        {
            titel: t('tile.available'),
            wert: zahlSkaliert(String(verfuegbar)),
            grafik: zellbalken(verfuegbar, gesamt),
            hinweis: t('hint.shareOfBikes', { anteil: anteil(verfuegbar), raederPhrase })
        },
        {
            titel: t('tile.onLoan'),
            wert: zahlSkaliert(String(ausgeliehen)),
            grafik: zellbalken(ausgeliehen, gesamt),
            hinweis: t('hint.shareOnLoan', { anteil: anteil(ausgeliehen), raederPhrase })
        },
        {
            titel: t('tile.inMaintenance'),
            wert: wertMitTon(wartung, 'ton-warnung'),
            grafik: zellbalken(wartung, gesamt, null, { farbe: 'var(--warnung-text)' }),
            hinweis: t('hint.shareMaintenance', { anteil: anteil(wartung), raederPhrase })
        },
        {
            titel: t('tile.faulty'),
            wert: wertMitTon(defekt, defekt > 0 ? 'ton-schlecht' : ''),
            grafik: zellbalken(defekt, gesamt, null, { farbe: 'var(--schlecht)' }),
            hinweis: t('hint.shareFaulty', { anteil: anteil(defekt), raederPhrase })
        }
    ];

    // fahrtenLetzte30Tage === null: die Rolle sieht v_wawi_fahrten_je_tag_rad
    // nicht (siehe Aufrufstelle in flotteAufbauen()) - dann faellt die
    // Kachel ganz weg, statt eine falsche Null vorzutaeuschen.
    if (fahrtenLetzte30Tage !== null) {
        const verteilung = fahrtenJeRadVerteilung(raeder, fahrtenLetzte30Tage);
        if (verteilung) kacheln.push(verteilung);
    }

    return kacheln;
}

// ===== Verteilung (Gestaltungsauftrag Punkt 5) =====
//
// "Wie verteilen sich die Fahrten je Rad - arbeiten alle gleich, oder
// stehen manche still?" - woertlich eines der drei Beispiele des
// Auftrags. v_wawi_fahrten_je_tag_rad (Drill-Down-Sicht, disposition UND
// leitung) traegt EINE ZEILE JE FAHRT, nicht aggregiert je Rad - dieselbe
// Sicht ungefiltert zu laden waere ueber 12.000 Zeilen fuer eine einzige
// Kennzahl (dieselbe "keine Basis fuer eine blosse Kennzahl"-Abwaegung,
// die kundenAufbauen() schon bei den 1014 Kunden per zaehleZeilen() trifft,
// hier auf ein Zeitfenster statt auf eine Zaehl-Anfrage angewendet).
// Deshalb NUR die letzten 30 Tage (.gte('tag', ...)) - genug fuer ein
// ehrliches "wird gerade gleichmaessig gefahren", ohne 18 Monate Historie
// laden zu muessen, um eine einzige Verteilungskachel zu befuellen.
//
// darfRolle-Wache (siehe Aufrufstelle in flotteAufbauen()): die Sicht
// selbst filtert auf disposition/leitung, NICHT auf werkstatt (siehe
// 0018_wawi_sichten.sql) - ein Werkstattkonto bekaeme dieselbe Anfrage mit
// null Zeilen zurueck, und OHNE die Wache saehe die Kachel dann faelschlich
// "alle 275 Raeder mit 0 Fahrten" statt schlicht zu fehlen ("was man nicht
// darf, wird nicht angezeigt", nicht als falsche Null vorgetaeuscht).
function fahrtenJeRadVerteilung(raeder, fahrtenLetzte30Tage) {
    const zaehlerJeRad = new Map(raeder.map((r) => [r.fahrrad_id, 0]));
    for (const zeile of fahrtenLetzte30Tage) {
        zaehlerJeRad.set(zeile.fahrrad_id, (zaehlerJeRad.get(zeile.fahrrad_id) || 0) + 1);
    }
    const werte = [...zaehlerJeRad.values()].sort((a, b) => a - b);
    if (werte.length === 0) return null;

    const minimum = werte[0];
    const maximum = werte[werte.length - 1];
    const mitteIndex = Math.floor((werte.length - 1) / 2);
    const median = werte.length % 2 === 1
        ? werte[mitteIndex] : (werte[mitteIndex] + werte[mitteIndex + 1]) / 2;
    const mittel = werte.reduce((s, w) => s + w, 0) / werte.length;
    const stillstehend = werte.filter((w) => w === 0).length;

    const raederPhrase = mengeFormat(werte.length, 'rad');
    return {
        titel: t('tile.ridesPerBike30d'),
        wert: `${zahlFormat(minimum)}–${zahlFormat(maximum)}`,
        hinweis: t('hint.rideDistribution', { median: zahlFormat(median), mittel: zahlFormat(mittel, { maximumFractionDigits: 1 }) })
            + (stillstehend
                ? t('hint.noRidesAtAll', { n: zahlFormat(stillstehend), raederPhrase })
                : t('hint.allRiddenAtLeastOnce', { raederPhrase }))
    };
}

// Optionen aus den bereits geladenen Zeilen gewonnen, nicht fest
// eingetragen - siehe Kommentar am Aufrufort in flotteAufbauen().
function flotteFilterOptionen(raeder) {
    const typen = [...new Map(raeder.map((r) => [r.typ_code, r.typ])).entries()]
        .sort(([a], [b]) => a.localeCompare(b));
    const standorte = [...new Set(raeder.map((r) => r.standort).filter(Boolean))].sort();
    return { typen, standorte };
}

// ===== Radtyp-Kacheln mit Produktbild (Gestaltungsauftrag, woertlich:
// "Bei Flotte vermisse ich Produktbilder ... damit ich das Produkt/Flotte
// auch sehe") =====
//
// UEBER DEN TYPCODE zugeordnet, nicht ueber die Reihenfolge im
// assets-Verzeichnis oder im Bestand (Auftrag, ausdruecklich): eine
// Zuordnung per Position waere lautlos falsch, sobald ein Radtyp
// umsortiert wird oder ein vierter dazukommt - "eine falsche Zuordnung
// faellt niemandem auf, der die Raeder nicht kennt" (Auftrag). typ_code
// traegt heute CITY/CARGO/EBIKE (siehe v_wawi_flotte, gepruefte Werte).
// Fehlt ein Eintrag hier (ein vierter Radtyp ohne Bild), liefert der
// Zugriff darunter schlicht undefined - flotteTypkachelnZeigen() prueft
// das explizit und laesst die Kachel dann ohne Bild, statt ein <img
// src="undefined"> zu erzeugen.
//
// Miniaturisiert aus src/assets/rad-*-frei.webp (freigestellt, Alphakanal
// bereits vorhanden) auf 128px Bildhoehe - genug fuer eine scharfe
// Darstellung bei ~56px CSS-Hoehe auch auf einem Retina-Bildschirm, ohne
// die 500-600 KB grosse Ausgangsdatei ungekuerzt auszuliefern (503–602 KB
// vorher, 15–17 KB nachher je Datei - dieselbe Groessenordnung wie
// profilAufbauen()s Konterfei in rahmen.js, 215 KB auf 23 KB verkleinert).
// NACH wawi/assets/ kopiert, nicht nach src/assets/ verlinkt: wawi/ wird
// eigenstaendig ausgeliefert (siehe tools/wawi_veroeffentlichen.sh), ein
// Verweis auf ../src/assets/ liefe im Betrieb ins Leere.
const RADTYP_BILDER = {
    CITY:  'assets/rad-city-mini.webp',
    CARGO: 'assets/rad-cargo-mini.webp',
    EBIKE: 'assets/rad-ebike-mini.webp'
};

// Eigenstaendiger Kopfbaustein NUR fuer Flotte, anders als Werkzeugleiste/
// Filterleiste/Uebersichtsstreifen in rahmen.js: dort brauchten zwei oder
// mehr Bereiche unabhaengig voneinander dasselbe Muster (siehe deren
// Kopfkommentare dort). Hier ist es ausschliesslich die Flotte, die ihre
// Raeder auch als Bild zeigen soll - deshalb lokal in dieser Datei, nicht
// in rahmen.js.
//
// EIGENE Reihe UNTER der Status-Uebersicht (zeigeUebersicht() am
// Aufrufort), nicht als weitere Kacheln IN ihr: die vier Status-Kacheln
// (Einsatzbereit/Ausgeliehen/Wartung/Defekt) und die Radtyp-Kacheln
// beantworten zwei verschiedene Fragen ("wie einsatzbereit ist die
// Flotte" gegenueber "was fahren wir ueberhaupt") - sie in eine einzige,
// gleichmaessig geteilte Zeile zu zwingen (#uebersichtsstreifen teilt die
// Breite gleichmaessig unter allen Kindern, siehe .uebersichtskachel in
// style.css) haette bis zu acht Kacheln in eine Zeile gequetscht, genau
// die "sehr gedraengt"-Ruege, die diese Oberflaeche schon dreimal traf
// (siehe Kopfkommentar von style.css).
//
// kennung: dieselbe Wettlaufabsicherung wie bei zeigeUebersicht() in
// rahmen.js - flotteAufbauen() ruft diese Funktion zwar ohne
// dazwischenliegendes await auf, aber ein zweiter, gleichlautender
// Aufrufer waere ohne die Pruefung ein stiller Unterschied zwischen
// beiden Bausteinen.
function flotteTypkachelnZeigen(kennung, raeder, typen) {
    if (!istAktuellerVorgang(kennung)) return;

    let leiste = document.getElementById('flotte-typkacheln');
    if (!leiste) {
        leiste = document.createElement('div');
        leiste.id = 'flotte-typkacheln';
        leiste.className = 'flotte-typkacheln';
    }
    // insertBefore(..., listenKoerper()) statt eines eigenen Ankers -
    // dieselbe Find-or-create-Machart wie uebersichtsstreifen()/
    // filterleiste() in rahmen.js (siehe deren Kommentare): listenKoerper()
    // legt den Tabellenkoerper bei Bedarf an, und jedes Element, das VOR
    // ihm eingehaengt wird, bleibt an seinem Platz stehen, unabhaengig von
    // der Aufrufreihenfolge der uebrigen Kopfbausteine.
    document.getElementById('arbeitsliste').insertBefore(leiste, listenKoerper());
    leiste.replaceChildren();

    if (raeder.length === 0) { leiste.remove(); return; }

    const gesamt = raeder.length;
    for (const [code, name] of typen) {
        const anzahl = raeder.filter((r) => r.typ_code === code).length;

        const kachel = document.createElement('div');
        kachel.className = 'flotte-typkachel';

        const bildQuelle = RADTYP_BILDER[code];
        if (bildQuelle) {
            // NUR schmueckend: der Radtypname steht ohnehin gleich daneben
            // als Text (Gestaltungsauftrag, woertlich: "ein Bild, das
            // neben einer Beschriftung dasselbe wiederholt, ist fuer
            // einen Screenreader Laerm") - deshalb alt="" UND aria-hidden,
            // statt den Radtyp ein zweites Mal vorlesen zu lassen.
            const bild = document.createElement('img');
            bild.className = 'flotte-typkachel-bild';
            bild.src = bildQuelle;
            bild.alt = '';
            bild.setAttribute('aria-hidden', 'true');
            // "Ein fehlendes Bild darf die Kachel nicht zerreissen"
            // (Auftrag, woertlich) - der Fall mit gaenzlich fehlendem
            // Eintrag in RADTYP_BILDER ist bereits durch bildQuelle
            // abgefangen (kein <img> erst gar nicht erzeugt); dieser
            // 'error'-Fall haengt zusaetzlich ab, falls die Datei selbst
            // einmal nicht erreichbar ist - das <img> raeumt sich dann
            // selbst weg, statt als kaputtes Symbol stehenzubleiben.
            bild.addEventListener('error', () => bild.remove());
            kachel.append(bild);
        }

        const text = document.createElement('div');
        text.className = 'flotte-typkachel-text';

        const titel = document.createElement('div');
        titel.className = 'flotte-typkachel-titel';
        titel.textContent = name;
        text.append(titel);

        const wert = document.createElement('div');
        wert.className = 'flotte-typkachel-wert';
        wert.append(zahlSkaliert(String(anzahl)));
        text.append(wert);

        const hinweis = document.createElement('div');
        hinweis.className = 'flotte-typkachel-hinweis';
        const anteil = gesamt ? Math.round((anzahl / gesamt) * 100) : 0;
        hinweis.textContent = t('hint.percentOfFleet', { anteil: zahlFormat(anteil) });
        text.append(hinweis);

        kachel.append(text);
        leiste.append(kachel);
    }
}

// Set.size === 0 heisst "Alle" (siehe Kommentar bei flotteFilterStatus
// oben). Der Standort-Sonderfall 'unterwegs' (kein Standort, r.standort
// ist NULL) kann jetzt GEMEINSAM mit echten Stationsnamen markiert sein -
// deshalb zwei getrennte Bedingungen statt eines einzelnen
// Wenn-dann-sonst wie zuvor: "unterwegs ODER eine der gewaehlten
// Stationen", nicht "entweder unterwegs oder eine Station".
function raederGefiltert(raeder) {
    return raeder.filter((r) =>
        (flotteFilterStatus.size === 0 || flotteFilterStatus.has(r.status)) &&
        (flotteFilterTyp.size === 0 || flotteFilterTyp.has(r.typ_code)) &&
        (flotteFilterStandort.size === 0
            || (flotteFilterStandort.has('unterwegs') && !r.standort)
            || (r.standort && flotteFilterStandort.has(r.standort))));
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
                titel: t('button.setTo', { ziel: statusWortInSatz(ziel) }),
                ziel,
                art: 'neben',
                ausfuehren: async () => {
                    const grund = await frageNachGrund(t('button.whyTarget', { ziel: statusWortInSatz(ziel) }));
                    if (grund === null) return;   // Abbruch: kein Aufruf ohne Grund
                    await rufeAuf('api_rad_status_setzen', {
                        p_fahrrad_id: rad.fahrrad_id, p_status: ziel, p_bemerkung: grund
                    });
                    melde(t('msg.bikeNowSetTo', { rahmennummer: rad.rahmennummer, ziel: statusWortInSatz(ziel) }), 'gut');
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
            titel: t('button.decommission'),
            ziel: 'ausmustern',
            art: 'gefaehrlich',
            ausfuehren: async () => {
                // Ausmustern ist nicht zurueckzuholen: das Rad verliert
                // seinen Standort und verschwindet aus jeder Liste. Die
                // Fahrten bleiben, aber das Rad kommt nicht wieder.
                const ok = await bestaetige(t('msg.confirmDecommission', { rahmennummer: rad.rahmennummer }));
                if (!ok) return;
                const grund = await frageNachGrund(t('button.decommissionReason'));
                if (grund === null) return;
                await rufeAuf('api_rad_ausmustern',
                    { p_fahrrad_id: rad.fahrrad_id, p_grund: grund });
                melde(t('msg.bikeDecommissioned', { rahmennummer: rad.rahmennummer }), 'gut');
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
//
// OHNE 'gefaehrlich': "eine gefaehrliche Handlung gehoert nicht als Icon
// in eine Zeile" (Gestaltungsauftrag, Punkt 3) - 'ausmustern' bleibt
// deshalb der Maske vorbehalten, trotz eigenem Bestaetigungsdialog. In
// der ersten Fassung dieser Funktion (Schritt A, vor dieser Regel) stand
// hier noch ein rot eingefaerbtes Ausmustern-Icon; diese Aufgabe zieht
// die Regel nachtraeglich gerade, damit Flotte nicht eine andere
// Formsprache traegt als Kunden (Loeschung nach Art. 17 bleibt ebenso
// aus der Zeile) und Instandhaltung.
function radZeilenAktionen(rad) {
    return radHandlungen(rad)
        .filter((h) => h.art !== 'gefaehrlich')
        .map((h) => ({
            titel: h.titel,
            svg: RAD_ICONS[h.ziel],
            ausfuehren: h.ausfuehren
        }));
}

function radMaske(rad) {
    const knoepfe = radHandlungen(rad);

    // Querverweis (Gestaltungsauftrag Punkt 3): "Rad in der Flotte -> seine
    // Schadensmeldungen". NICHT in radHandlungen() (siehe deren
    // Kopfkommentar-Nachbarschaft): dessen Eintraege tragen ein ziel-Feld
    // fuer RAD_ICONS und erscheinen zusaetzlich als Zeilen-Icon
    // (radZeilenAktionen()) - ein Bereichssprung dort haette dort ein Icon
    // gebraucht, das es nicht gibt, und waere obendrein aus der Liste
    // heraus (statt nur aus der geoeffneten Maske) anklickbar gewesen,
    // ohne dass "seine Schadensmeldungen" fuer eine Reihe von Raedern auf
    // einen Blick noch Sinn ergaebe.
    //
    // darfBereich() zuerst (Auftrag: "wird nicht angeboten"), UND nur bei
    // tatsaechlich vorhandenen offenen Schaeden - ein Sprung ins Leere
    // (Instandhaltung zeigt nur offene/in_arbeit, siehe schaedenZeigen())
    // waere kein Arbeitsweg, nur ein Umweg.
    if (darfBereich('instandhaltung') && rad.offene_schaeden > 0) {
        knoepfe.push({
            titel: mengeFormat(rad.offene_schaeden, 'schadensmeldung'),
            art: 'neben',
            ausfuehren: async () => {
                instandhaltungZeigeSchaeden();   // siehe dortiger Kommentar - muss VOR bereichWechseln() laufen
                await bereichSprung('instandhaltung', t('nav.originBikeFromFleet', { rahmennummer: rad.rahmennummer }),
                    () => setzeSpaltenkopfFilter('rahmennummer', rad.rahmennummer));
            }
        });
    }

    zeigeMaske(`${t('field.rad')} ${rad.rahmennummer}`, [
        { name: 'typ',            titel: t('field.typ'),              wert: `${rad.typ} (${rad.typ_code})`, nurLesen: true },
        { name: 'modell',         titel: t('field.modell'),           wert: `${rad.hersteller} ${rad.modell}`, nurLesen: true },
        { name: 'status',         titel: t('field.status'),           wert: statusAnzeige(rad.status), nurLesen: true },
        { name: 'standort',       titel: t('field.standort'),         wert: rad.standort || t('misc.underway'), nurLesen: true },
        { name: 'angeschafft_am', titel: t('field.angeschafft'),      wert: rad.angeschafft_am, nurLesen: true },
        { name: 'letzte_wartung', titel: t('field.letzteWartung'),    wert: rad.letzte_wartung || t('misc.noneYet'), nurLesen: true },
        { name: 'offene_schaeden', titel: t('field.offeneSchaeden'),  wert: rad.offene_schaeden, nurLesen: true },
        { name: 'hoechste_schwere', titel: t('field.hoechsteSchwere'), wert: rad.hoechste_schwere ? t('schwere.' + rad.hoechste_schwere) : '—', nurLesen: true }
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
        melde(t('msg.modelsOrStationsLoadFailed', { fehler: fehlerModell || fehlerStation }), 'schlecht');
        return;
    }
    if (!modelle.length || !stationen.length) {
        melde(t('msg.noModelsOrStations'), 'schlecht');
        return;
    }

    zeigeMaske(t('button.newBike'), [
        { name: 'rahmennummer', titel: t('field.rahmennummer'), wert: '' },
        {
            name: 'modell_id', titel: t('field.modell'), wert: modelle[0].modell_id,
            optionen: modelle.map((m) => ({
                wert: m.modell_id,
                text: `${m.hersteller} ${m.modellbezeichnung} (${m.typ_code}, ${t('misc.unitsInStock', { n: zahlFormat(m.raeder_im_bestand) })})`
            }))
        },
        {
            // frei steht mit in der Beschriftung, nicht als Filter: eine
            // volle Station weist die Datenbank ueber GR15 ab, aber wer
            // sie trotzdem waehlen will - etwa weil gerade ein Rad
            // ausgemustert wird -, soll das weiterhin koennen.
            name: 'station_id', titel: t('field.station'), wert: stationen[0].station_id,
            optionen: stationen.map((s) => ({
                wert: s.station_id,
                text: `${s.name} (${t('misc.freeShort', { n: zahlFormat(s.frei) })})${s.in_betrieb ? '' : ' — ' + t('misc.decommissionedState')}`
            }))
        }
    ], [
        {
            titel: t('button.create'),
            // 'schaffend' statt 'haupt' (Punkt 4 der Gestaltung, gruen):
            // dieser Knopf legt ein neues Rad an, siehe Begruendung bei
            // der art-Erlaeuterung von zeigeMaske() in rahmen.js.
            art: 'schaffend',
            ausfuehren: async () => {
                const rahmennummer = document.getElementById('feld-maske-rahmennummer').value.trim();
                if (!rahmennummer) {
                    melde(t('msg.frameNumberMissing'), 'schlecht');
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
                melde(t('msg.bikeCreated', { rahmennummer }), 'gut');
                await flotteAufbauen();
            }
        }
    ]);
}
