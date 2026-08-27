// ============================================
// VeloCity Warenwirtschaft — Stationen
//
// Derselbe Bau wie flotte.js (Aufgabe 4): Liste, Detailmaske, ein paar
// Schaltflaechen, ein Anlegen-Einstieg ueber die geteilte Werkzeugleiste
// aus rahmen.js. Liest v_wawi_station, v_wawi_station_flotte,
// v_wawi_stationsverkehr_zeitfenster und v_wawi_kundenorte - keine
// Basistabelle, keine fn_-Funktion.
//
// GESTALTUNGSAUFTRAG "STATIONEN AUSBAUEN" (vier Punkte, alle vom
// Auftraggeber, wörtlich):
//   1. "es wird nicht erkennbar, welche Räder gerade an welcher Station
//      stehen, das muss in die Details rein" - stationRaederAbschnitt()
//      unten, aus v_wawi_station_flotte (station_id als echter
//      Fremdschluessel statt eines Textvergleichs auf
//      v_wawi_flotte.standort - siehe Kopfkommentar der Sicht in
//      0018_wawi_sichten.sql).
//   2. "vermisse auch die Auslastung der Stellplätze als Donutchart" (in
//      der Uebersicht) und "ein Donut-Chart fuer die Belegung ... 100 %
//      ist die Kapazitaet" (in den Details) - donut() in rahmen.js,
//      zweimal verwendet: netzweit in stationenUebersicht(), je Station
//      in stationBelegungAbschnitt().
//   3. "den Abgang/Zugang nach Zeitslots als Grafik sehen" -
//      stationVerkehrAbschnitt() unten, aus
//      v_wawi_stationsverkehr_zeitfenster (Zweistundenbloecke, Werktag/
//      Wochenende getrennt - Begruendung in deren Kopfkommentar in
//      0018_wawi_sichten.sql).
//   4. "eine neue Sicht ... in der die Standorte auch als Landkarten
//      visualisiert sind und sich zusaetzlich die Kunden einblenden
//      lassen" - ein zweiter Unterreiter "Landkarte" neben "Liste"
//      (zeigeUnterreiter, wie die Unterreiter in instandhaltung.js),
//      selbst gezeichnetes Inline-SVG (stationenKarteZeichnen() unten),
//      Kundschaft aus v_wawi_kundenorte AGGREGIERT je Ort einblendbar -
//      nie als Punkt je Person, siehe deren Kopfkommentar in
//      0018_wawi_sichten.sql.
// ============================================

// Navigations-Icon (Gestaltungsauftrag, Punkt 3): eine Standortmarkierung
// - derselbe Gedanke wie beim Fahrrad-Icon in flotte.js, dieselbe
// Strichfamilie (siehe .bereich-icon in style.css).
const ICON_STATIONEN = '<svg viewBox="0 0 24 24"><path d="M12 21c-4.2-4.6-6.5-8.1-6.5-11a6.5 6.5 0 1 1 13 0c0 2.9-2.3 6.4-6.5 11z"/><circle cx="12" cy="10" r="2.3"/></svg>';

bereichAnmelden({
    schluessel: 'stationen',
    titelSchluessel: 'nav.stationen',
    icon: ICON_STATIONEN,
    // Dieselben Rollen, die auch v_wawi_station durchlaesst (siehe
    // db/aufbau/0018_wawi_sichten.sql) - waeren sie hier weiter gefasst,
    // saehe etwa die Werkstatt den Menuepunkt und dahinter eine leere
    // Liste, wie im Flotte-Kommentar begruendet.
    rollen: ['disposition', 'leitung'],
    aufbauen: stationenAufbauen
});

// 'liste' | 'karte' - EIN eigener Blick statt zweier Bereiche
// (Gestaltungsauftrag Punkt 4: "eine neue Sicht ... vermutlich einen
// eigenen Blick innerhalb der Stationen"), nach demselben Muster wie
// instandhaltung.js' unterbereich ('schaeden'/'auftraege'): dieselben
// Stationsdaten, zwei Darstellungen. Ein eigener BEREICH haette dieselbe
// Rollen-/Ladefehlerpruefung ein zweites Mal gebraucht, fuer denselben
// Datenbestand - genau die Wiederholung, die zeigeUnterreiter() in
// rahmen.js schon fuer Instandhaltung geloest hat.
let stationenUnterbereich = 'liste';

// Ob die Karte zusaetzlich die aggregierte Kundschaft zeigt (Punkt 4).
// Ueberlebt einen Unterreiterwechsel bewusst NICHT anders als jeder
// andere Anzeigezustand hier - ein Blick auf "Liste" und zurueck auf
// "Landkarte" baut die Karte ohnehin neu, der Schalter faengt seinen
// eigenen Wert also selbst aus dieser Variable ab.
let stationenKarteKundenSichtbar = false;

// Beide Arrays werden EINMAL je stationenAufbauen()-Durchlauf geladen
// (Promise.all unten, zusammen mit der Stationsliste selbst) und dann
// SYNCHRON gefiltert, sobald eine Detailmaske oder die Karte sie braucht -
// nicht je Klick neu nachgeladen. Das vermeidet genau die Wettlauf-Falle,
// vor der laufenderVorgang() in rahmen.js warnt (siehe dortiger
// Kommentar, Fall radAnlegenMaske()): stationMaske() wird aus
// zeileWaehlen() OHNE await aufgerufen (siehe dort) und duerfte deshalb
// selbst keinen eigenen Ladevorgang anstossen, dessen Rueckkehr sie erst
// noch abwarten muesste. Bei zehn Stationen, hoechstens 275 Raedern und
// 240 Verkehrszeilen ist "alles auf einmal laden" zudem guenstiger als
// zehn einzelne Nachladungen je Station.
let stationenRaederAlle = [];
let stationenVerkehrAlle = [];
let stationenKundenorteAlle = [];

async function stationenAufbauen() {
    // ALLERERSTE Anweisung, vor jedem await - siehe Kommentar bei
    // neuerVorgang() in rahmen.js und bei flotteAufbauen() in flotte.js.
    const vorgang = neuerVorgang();

    // Wer anlegen darf, bekommt den Knopf VOR der Liste zu sehen - nicht
    // ausgegraut fuer die Leitung, sondern schlicht nicht vorhanden.
    // Nur fuer disposition sichtbar - dieselbe Rolle, die
    // api_station_anlegen in der Datenbank verlangt
    // (fn_rolle_verlangen('disposition') in 0019_wawi_logik.sql).
    // UNABHAENGIG vom Unterreiter (anders als die Werkzeugleiste in
    // instandhaltung.js): eine neue Station anzulegen ist in der Liste
    // wie auf der Karte derselbe sinnvolle Einstieg, keiner der beiden
    // Bloecke hat ein eigenes "Anlegen"-Gegenstueck, das kollidieren
    // koennte.
    zeigeWerkzeugleiste(darfRolle('disposition'), t('button.newStation'), stationAnlegenMaske);

    zeigeUnterreiter(vorgang, [
        { schluessel: 'liste', titel: t('button.list') },
        { schluessel: 'karte', titel: t('button.map') }
    ], stationenUnterbereich, async (gewaehlt) => {
        stationenUnterbereich = gewaehlt;
        maskeVerwerfen();
        await stationenAufbauen();
    });

    // Alle vier Sichten in EINEM Promise.all - dieselbe Ueberlegung wie
    // bei radAnlegenMaske() in flotte.js (Promise.all ueber Modelle und
    // Stationen): unabhaengige Ladeanfragen laufen parallel, nicht
    // nacheinander. v_wawi_kundenorte wird auch geladen, wenn die Karte
    // gar nicht aktiv ist bzw. die Kundschaft dort ausgeblendet bleibt -
    // 14 Zeilen sind kein Preis, gegen den es sich lohnte, den Umschalter
    // auf der Karte mit einer eigenen Nachladung und einer eigenen
    // Wettlauf-Absicherung zu bauen.
    const [stationen, raeder, verkehr, kundenorte] = await Promise.all([
        ladeListe('v_wawi_station',
            'station_id, stationsnummer, name, strasse, hausnummer, plz, ort, ' +
            'latitude, longitude, kapazitaet, belegt, frei, betriebszeitraum, in_betrieb',
            (q) => q.order('stationsnummer')),
        ladeListe('v_wawi_station_flotte',
            'station_id, fahrrad_id, rahmennummer, typ_code, typ, status, ' +
            'akkustand_prozent, offene_schaeden, hoechste_schwere'),
        ladeListe('v_wawi_stationsverkehr_zeitfenster',
            'station_id, wochentyp, zeitfenster_start_stunde, abgaenge_je_tag, ' +
            'zugaenge_je_tag, tage_erfasst'),
        ladeListe('v_wawi_kundenorte', 'ort, latitude, longitude, kunden')
    ]);

    const fehler = letzterLadeFehler('v_wawi_station');
    if (fehler) {
        // meldeVorgang statt melde: ein inzwischen veralteter Aufruf
        // (siehe Kommentar dort) meldet auch seinen eigenen Ladefehler
        // nicht mehr.
        zeigeUebersicht(vorgang, []);
        meldeVorgang(vorgang, t('msg.stationsLoadFailed', { fehler }), 'schlecht');
        return;
    }

    // Raeder/Verkehr/Kundenorte sind eine ERGAENZUNG der Stationsliste,
    // kein Ersatz fuer sie - ein Ladefehler dort darf die Stationsliste
    // selbst nicht verhindern (die Kernfrage "wie viele Stationen, wie
    // voll" bleibt beantwortbar). Die jeweilige Detailmaske bzw. die
    // Karte meldet einen solchen Fehler stattdessen selbst, siehe
    // stationRaederAbschnitt()/stationVerkehrAbschnitt() unten.
    stationenRaederAlle = raeder;
    stationenVerkehrAlle = verkehr;
    stationenKundenorteAlle = kundenorte;

    zeigeUebersicht(vorgang, stationenUebersicht(stationen));

    // KEIN Filter hier (Gestaltungsauftrag, Punkt 2, woertlich): "bei
    // zehn Zeilen braucht es keinen Filter. Bau keinen. Ein
    // Bedienelement, das nichts filtert, ist Zierrat." Flotte (275
    // Zeilen), Kunden (1014) und Instandhaltung (Schwere/Alter mehrerer
    // Meldungen) haben je einen zeigeFilterleiste()-Aufruf - Stationen
    // absichtlich nicht, kein vergessener Baustein. Gilt unveraendert
    // fuer beide Unterreiter: die Karte braucht bei zehn Stationen ebenso
    // wenig einen Filter wie die Tabelle.

    const text = stationenStatuszeileText(stationen);

    if (stationenUnterbereich === 'liste') {
        zeigeListe(vorgang, stationen, [
            { feld: 'stationsnummer', titel: t('field.nummer') },
            { feld: 'name',           titel: t('field.station') },
            { feld: 'ort',            titel: t('field.ort') },
            { feld: 'belegt',         titel: t('field.belegt'), formatieren: (b, z) => `${zahlFormat(b)} / ${zahlFormat(z.kapazitaet)}` },
            // Nur EIN Parameter (die ganze Zeile), nicht (f) wie im
            // Auftragstext: zeigeListe in rahmen.js ruft eine Funktions-
            // Spalte als spalte.klasse(zeile) auf, nicht spalte.klasse(wert).
            // Mit der woertlichen Signatur aus dem Auftrag ("(f) => f === 0")
            // wuerde f auf die ganze Zeile laufen und "f === 0" waere nie
            // wahr - die Warnung fiele lautlos aus. Derselbe Fund wie bei
            // statusKlasse in flotte.js (siehe dortiger Kommentar), hier nur
            // wiederholt, weil der Auftragstext den Fehler ein zweites Mal
            // enthaelt.
            { feld: 'frei',           titel: t('field.frei'),   klasse: (z) => (z.frei === 0 ? 'warnung' : '') }
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

        meldeVorgang(vorgang, text);
    } else {
        stationenKarteZeigen(vorgang, stationen);
        meldeVorgang(vorgang, text);
    }
}

// Gemeinsamer Statuszeilentext fuer beide Unterreiter (Gestaltungsauftrag,
// Punkt 1: "Eine volle Station nimmt keine Rueckgabe an - das ist die
// wichtigste Zahl des Bereichs"). Herausgezogen, statt ihn zweimal
// wortgleich in stationenAufbauen() zu schreiben - dieselbe Information
// gilt fuer die Liste wie fuer die Karte, die Karte zeigt "voll" ohnehin
// zusaetzlich ueber die Ringfarbe jeder Stationsmarke (siehe
// stationenKarteZeichnen() unten), ersetzt den Text damit aber nicht:
// Farbe allein waere fuer einen Screenreader stumm.
function stationenStatuszeileText(stationen) {
    const voll = stationen.filter((s) => s.frei === 0);
    return voll.length
        ? t('msg.stationsSummary', { stationenPhrase: mengeFormat(stationen.length, 'station'),
              n: zahlFormat(voll.length), liste: voll.map((s) => s.name).join(', ') })
        : mengeFormat(stationen.length, 'station');
}

// ===== Uebersicht (Gestaltungsauftrag, Punkt 1 und Punkt 2) =====
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
            titel: t('tile.stations'),
            wert: zahlSkaliert(String(gesamt)),
            // Small multiples (Tufte): Fuellstand jeder einzelnen
            // Station, sortiert nach Stationsnummer wie die Tabelle
            // darunter - dieselbe Idee wie stationsauslastungUebersicht()
            // in auswertungen.js, hier aus belegt/kapazitaet statt aus
            // der dortigen eigenen fuellstand-Spalte berechnet.
            // aktuellIndex: null - "die letzte Station nach Nummer" ist
            // kein aktueller Zeitraum (siehe Kopfkommentar bei
            // saeulenSparkline() in rahmen.js).
            grafik: saeulenSparkline(stationen.map((s) => (s.kapazitaet ? s.belegt / s.kapazitaet : 0)),
                t('hint.fillLevelPerStation'),
                { aktuellIndex: null }
            ),
            hinweis: stillgelegt ? t('hint.decommissionedCount', { n: zahlFormat(stillgelegt) }) : t('hint.allInOperation')
        }
    ];

    if (volle.length > 0) {
        const wert = document.createElement('span');
        wert.className = 'ton-warnung';
        wert.textContent = String(volle.length);
        kacheln.push({
            titel: t('tile.fullStations'),
            wert,
            grafik: zellbalken(volle.length, gesamt, null, { farbe: 'var(--warnung-text)' }),
            // Echter Bezug (Gestaltungsauftrag Punkt 1: "2 von 10 - dann
            // ist es ein Anteil und darf wie einer aussehen") direkt im
            // Text, statt sich auf die "Stationen"-Kachel davor zu
            // verlassen, um den Nenner zu erschliessen.
            hinweis: t('hint.fullStationsShare',
                { n: zahlFormat(volle.length), stationenPhrase: mengeFormat(gesamt, 'station'),
                  liste: volle.map((s) => s.name).join(', ') })
        });
    }

    // ===== Donut fuer die Gesamtauslastung (Gestaltungsauftrag Punkt 2,
    // wörtlich: "vermisse auch die Auslastung der Stellplätze als
    // Donutchart") =====
    //
    // 100 % IST HIER DIE GESAMTKAPAZITAET DES GANZEN NETZES, NICHT EINER
    // EINZELNEN STATION (Auftrag, ausdruecklich als zu entscheidende
    // Frage benannt): der Streifen steht UEBER der ganzen Liste aller
    // zehn Stationen, seine Kennzahl kann sich deshalb nur auf das ganze
    // Netz beziehen - fuer EINE Station gibt es den zweiten Donut in
    // stationBelegungAbschnitt() weiter unten. Um jede Verwechslung
    // auszuschliessen, sagt das ausdrueckliche BOTH der Kacheltitel ("-
    // alle Stationen") UND der Hinweistext darunter UND das aria-label
    // des Donuts selbst dieselbe Einordnung - dreifach, nicht nur einmal,
    // weil genau diese Verwechslung (eine Station vs. das ganze Netz) der
    // Auftrag ausdruecklich als Fallstrick benennt.
    //
    // kachel.wert bleibt LEER: die Zahl steht bereits IM Donut (Auftrag:
    // "ein Donut ohne Zahl ist eine Schaetzaufgabe" - donut() in
    // rahmen.js zeichnet Prozent und Bruch deshalb selbst). Eine zweite,
    // separate Zahl daneben waere dieselbe Zahl zweimal, nicht eine
    // zusaetzliche Information - anders als bei der Saeulen-Sparkline
    // oben, wo "10" (die Stationszahl) und die Sparkline (der Fuellstand
    // JEDER einzelnen Station) tatsaechlich zwei verschiedene Aussagen
    // sind.
    const netzFuellstandProzent = gesamtKapazitaet ? Math.round((gesamtBelegt / gesamtKapazitaet) * 100) : 0;
    const netzBeschriftung = t('hint.networkOccupancyAria', {
        stationenPhrase: mengeFormat(gesamt, 'station'), belegt: zahlFormat(gesamtBelegt),
        kapazitaet: zahlFormat(gesamtKapazitaet), prozent: zahlFormat(netzFuellstandProzent) });
    kacheln.push({
        titel: t('tile.networkOccupancy'),
        wert: '',
        grafik: donut(gesamtBelegt, gesamtKapazitaet, netzBeschriftung, {
            durchmesser: 84,
            dicke: 11,
            bruch: `${gesamtBelegt} / ${gesamtKapazitaet}`
        }),
        hinweis: t('hint.networkOccupancyDetail',
            { belegt: zahlFormat(gesamtBelegt), kapazitaet: zahlFormat(gesamtKapazitaet), stationenPhrase: mengeFormat(gesamt, 'station') })
    });

    // ===== Verteilung (Gestaltungsauftrag Punkt 5) =====
    //
    // "Wie verteilen sich die Stationen zwischen leer und voll?" -
    // woertlich eines der drei Beispiele des Auftrags. "Gesamtbelegung"
    // oben beantwortet nur, wie voll das NETZ ALS GANZES ist (kapazitaets-
    // gewichtet); das sagt nichts darueber, ob alle zehn Stationen nahe
    // beieinander liegen oder weit auseinanderklaffen. Median NEBEN der
    // Spannweite (Auftrag, woertlich als Beispiel genannt) statt eines
    // Histogramms: bei nur zehn Stationen haette ein Histogramm mit
    // seinen ueblichen 5-10 Kaesten kaum mehr als eine Station je Kasten
    // und waere fuer diese Groessenordnung Uebertreibung, waehrend
    // Spannweite+Median die Frage direkt beantworten. Rein aus den
    // bereits geladenen Zeilen berechnet, KEINE zusaetzliche Abfrage.
    const fuellstaende = stationen.map((s) => (s.kapazitaet ? s.belegt / s.kapazitaet : 0)).sort((a, b) => a - b);
    const minFuellstand = fuellstaende[0];
    const maxFuellstand = fuellstaende[fuellstaende.length - 1];
    const mitteIndex = Math.floor((fuellstaende.length - 1) / 2);
    const medianFuellstand = fuellstaende.length % 2 === 1
        ? fuellstaende[mitteIndex]
        : (fuellstaende[mitteIndex] + fuellstaende[mitteIndex + 1]) / 2;
    const leer = stationen.filter((s) => s.belegt === 0).length;
    kacheln.push({
        titel: t('tile.fillRange'),
        wert: `${zahlFormat(Math.round(minFuellstand * 100))}–${zahlFormat(Math.round(maxFuellstand * 100))} %`,
        hinweis: t('hint.fillRangeDetail', {
            median: zahlFormat(Math.round(medianFuellstand * 100)), voll: zahlFormat(volle.length),
            stationenPhrase: mengeFormat(gesamt, 'station'),
            leerZusatz: leer ? t('hint.andEmptyCount', { n: zahlFormat(leer), stationenPhrase: mengeFormat(gesamt, 'station') }) : t('hint.noneEmpty')
        })
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
            titel: t('button.decommissionStation'),
            art: 'gefaehrlich',
            ausfuehren: async () => {
                // GR22: eine Station wird stillgelegt, nicht geloescht.
                // Sonst verloeren alle Fahrten dorthin ihren Ort. Die
                // Funktion weist Stationen mit Raedern ab - und derzeit
                // gibt es keinen Weg, ein Rad umzusetzen. Das ist eine
                // bekannte Luecke; die Meldung darf sie nicht als
                // Softwarefehler erscheinen lassen.
                if (station.belegt > 0) {
                    melde(t('msg.stationStillHasBikes', { name: station.name, raederPhrase: mengeFormat(station.belegt, 'rad') }), 'warnung');
                    return;
                }
                const ok = await bestaetige(t('msg.confirmDecommissionStation', { name: station.name }));
                if (!ok) return;
                await rufeAuf('api_station_stilllegen', { p_station_id: station.station_id });
                melde(t('msg.stationDecommissioned', { name: station.name }), 'gut');
                await stationenAufbauen();
            }
        });
    }

    zeigeMaske(`${station.stationsnummer} · ${station.name}`, [
        { name: 'anschrift',  titel: t('field.anschrift'),
          wert: `${station.strasse} ${station.hausnummer}, ${station.plz} ${station.ort}`, nurLesen: true },
        { name: 'kapazitaet', titel: t('field.stellplaetze'), wert: station.kapazitaet, nurLesen: true },
        { name: 'belegt',     titel: t('field.belegt'),      wert: station.belegt, nurLesen: true },
        { name: 'frei',       titel: t('field.frei'),        wert: station.frei, nurLesen: true },
        { name: 'lage',       titel: t('field.lage'),
          wert: `${station.latitude}, ${station.longitude}`, nurLesen: true },
        { name: 'betrieb',    titel: t('field.betrieb'),
          wert: station.in_betrieb ? t('misc.inOperation') : t('misc.decommissionedState'), nurLesen: true }
    ], knoepfe);

    // Drei zusaetzliche Abschnitte UNTER der von zeigeMaske() gebauten
    // Grundmaske - dieselbe Machart wie monatsdrilldownEinfuegen() in
    // auswertungen.js (dort async wegen eines eigenen Nachladens, hier
    // SYNCHRON: die Daten liegen bereits vollstaendig in
    // stationenRaederAlle/stationenVerkehrAlle, siehe Kopfkommentar
    // dieser Datei). #detailmaske wurde von zeigeMaske() gerade erst
    // geleert und neu gefuellt (replaceChildren, siehe dort) - die
    // folgenden append()-Aufrufe haengen sich dahinter an, sie ersetzen
    // nichts.
    const wurzel = document.getElementById('detailmaske');
    wurzel.append(stationBelegungAbschnitt(station));
    wurzel.append(stationRaederAbschnitt(station));
    wurzel.append(stationVerkehrAbschnitt(station));
}

// ===== Belegung (Gestaltungsauftrag Punkt 2) =====
//
// "Wenn ich auf die Details einer Station klicke, will ich da ein
// Donut-Chart fuer die Belegung sehen, 100 % ist die Kapazitaet" -
// woertlich der Auftrag. Anders als der Netz-Donut in
// stationenUebersicht() oben ist die Skala hier fuer JEDE Station eine
// ANDERE Zahl (ihre eigene Kapazitaet) - der Donut sagt das selbst in
// seinem aria-label, damit niemand die 100 % dieser einen Station mit den
// 100 % des ganzen Netzes verwechselt (derselbe Fallstrick wie oben, hier
// aus der anderen Richtung benannt).
function stationBelegungAbschnitt(station) {
    const abschnitt = document.createElement('section');
    abschnitt.className = 'stationbelegung';

    const ueberschrift = document.createElement('h3');
    ueberschrift.textContent = t('tile.occupancy');
    abschnitt.append(ueberschrift);

    const voll = station.frei === 0;
    const prozent = station.kapazitaet ? Math.round((station.belegt / station.kapazitaet) * 100) : 0;
    const beschriftung = t('hint.stationOccupancyAria', {
        name: station.name, belegt: zahlFormat(station.belegt), kapazitaet: zahlFormat(station.kapazitaet),
        prozent: zahlFormat(prozent), vollZusatz: voll ? t('hint.stationFullNote') : '' });

    // farbe nur bei EXAKT vollem Anteil auf --warnung-text umgestellt -
    // siehe die ausfuehrliche Begruendung im Kopfkommentar von donut() in
    // rahmen.js (--warnung-text gegen --skala-rahmen selbst haelt nur
    // 1.46:1, unter der fuer Grafik verlangten 3:1 - bei einem Anteil von
    // genau 100 % bleibt vom Hintergrundring aber ohnehin nichts sichtbar
    // uebrig, die Grenze existiert dann nicht).
    abschnitt.append(donut(station.belegt, station.kapazitaet, beschriftung, {
        durchmesser: 120,
        dicke: 16,
        farbe: voll ? 'var(--warnung-text)' : 'var(--marine)',
        bruch: `${station.belegt} / ${station.kapazitaet}`
    }));

    return abschnitt;
}

// ===== Raeder an dieser Station (Gestaltungsauftrag Punkt 1) =====
//
// Woertlich der Auftrag: "es wird nicht erkennbar, welche Raeder gerade
// an welcher Station stehen, das muss in die Details rein." Rahmennummer,
// Typ, Status und was sonst zur Einschaetzung hilft (Akkustand, offene
// Schaeden samt hoechster Schwere) - dieselben Angaben wie in der
// Flottenliste, hier nur auf EINE Station eingeschraenkt.
function stationRaederAbschnitt(station) {
    const abschnitt = document.createElement('section');
    abschnitt.className = 'stationraeder';

    const raederHier = stationenRaederAlle.filter((r) => r.station_id === station.station_id);

    const ueberschrift = document.createElement('h3');
    ueberschrift.textContent = t('tile.bikesAtStation', { n: zahlFormat(raederHier.length) });
    abschnitt.append(ueberschrift);

    const fehler = letzterLadeFehler('v_wawi_station_flotte');
    if (fehler) {
        const hinweis = document.createElement('p');
        hinweis.className = 'stationraeder-fehler';
        hinweis.textContent = t('msg.bikesAtStationLoadFailed', { fehler });
        abschnitt.append(hinweis);
        return abschnitt;
    }

    // DER FALL "STATION OHNE RAEDER" (Auftrag: "kommt jetzt haeufiger
    // vor, weil 110 Raeder unterwegs sind") - eine eigene, erklaerende
    // Meldung statt einer leeren Tabelle ohne jede Kopfzeile, dieselbe
    // Haltung wie zeigeLeermaske() in rahmen.js fuer eine ganze Liste,
    // hier nur fuer einen Abschnitt innerhalb der Detailmaske.
    if (raederHier.length === 0) {
        const hinweis = document.createElement('p');
        hinweis.className = 'stationraeder-leer';
        hinweis.textContent = t('tile.noBikesHere');
        abschnitt.append(hinweis);
        return abschnitt;
    }

    const tabelle = document.createElement('table');
    tabelle.className = 'stationraeder-tabelle';

    const kopfzeile = document.createElement('tr');
    for (const titel of [t('field.rahmennummer'), t('field.typ'), t('field.status'), t('field.akku'), t('field.schaeden')]) {
        const th = document.createElement('th');
        th.textContent = titel;
        kopfzeile.append(th);
    }
    tabelle.append(kopfzeile);

    for (const rad of raederHier) {
        const zeile = document.createElement('tr');

        // Querverweis (Gestaltungsauftrag "Sichten verweben", dasselbe
        // Prinzip wie "Rad in der Flotte -> seine Schadensmeldungen" in
        // flotte.js radMaske(), hier in der Gegenrichtung: "Rad an der
        // Station -> seine Flottendetails"). darfBereich() zuerst
        // (Auftrag: "wird nicht angeboten") - unnoetig hier, weil
        // disposition/leitung (die einzigen Rollen dieses Bereichs)
        // Flotte ohnehin sehen, aber defensiv wie jeder andere Sprung in
        // dieser Oberflaeche.
        const zelleRahmennummer = document.createElement('td');
        if (darfBereich('flotte')) {
            const link = document.createElement('button');
            link.type = 'button';
            // Dieselbe Klasse wie der Datum-Knopf im Monats-Drill-Down
            // (auswertungen.js): sieht wie ein Link aus, sonst nichts -
            // ein zweiter, wortgleicher Klassenname fuer denselben
            // visuellen Zweck waere dieselbe Wiederholung, die
            // werkzeugleiste()/uebersichtsstreifen() in rahmen.js schon
            // einmal beseitigt haben.
            link.className = 'monatsdrilldown-tag-knopf';
            link.textContent = rad.rahmennummer;
            link.addEventListener('click', () => {
                bereichSprung('flotte', t('nav.originBikeFromStation', { rahmennummer: rad.rahmennummer, name: station.name }),
                    () => setzeSpaltenkopfFilter('rahmennummer', rad.rahmennummer));
            });
            zelleRahmennummer.append(link);
        } else {
            zelleRahmennummer.textContent = rad.rahmennummer;
        }
        zeile.append(zelleRahmennummer);

        const zelleTyp = document.createElement('td');
        zelleTyp.textContent = rad.typ;
        zeile.append(zelleTyp);

        // Farbe traegt Bedeutung: ein Rad, das noch an einer Station
        // steht, aber nicht 'verfuegbar' ist, ist der eigentlich
        // interessante Fall dieser Liste (siehe Kommentar bei
        // v_wawi_station_flotte.status in 0018_wawi_sichten.sql).
        const zelleStatus = document.createElement('td');
        zelleStatus.textContent = statusAnzeige(rad.status);
        if (rad.status === 'defekt' || rad.hoechste_schwere === 'fahruntauglich') {
            zelleStatus.className = 'ton-schlecht';
        } else if (rad.status === 'wartung') {
            zelleStatus.className = 'ton-warnung';
        }
        zeile.append(zelleStatus);

        const zelleAkku = document.createElement('td');
        zelleAkku.textContent = rad.akkustand_prozent == null ? '—' : `${zahlFormat(rad.akkustand_prozent)} %`;
        zeile.append(zelleAkku);

        const zelleSchaeden = document.createElement('td');
        zelleSchaeden.textContent = rad.offene_schaeden > 0
            ? `${zahlFormat(rad.offene_schaeden)} (${t('schwere.' + rad.hoechste_schwere)})`
            : '—';
        if (rad.hoechste_schwere === 'fahruntauglich') zelleSchaeden.className = 'ton-schlecht';
        else if (rad.offene_schaeden > 0) zelleSchaeden.className = 'ton-warnung';
        zeile.append(zelleSchaeden);

        tabelle.append(zeile);
    }

    abschnitt.append(tabelle);
    return abschnitt;
}

// ===== Zu- und Abgang nach Zeitfenster (Gestaltungsauftrag Punkt 3) =====
//
// Woertlich der Auftrag: "Dann will ich bei den Details den Abgang/
// Zugang nach Zeitslots als Grafik sehen." Zwei kleine Grafiken (Werktag,
// Wochenende), dieselbe Skala fuer beide (Bissantz: "an einer
// gemeinsamen Skala ausgerichtet") - die Begruendung fuer Zweistunden-
// bloecke und die Trennung nach Wochentyp steht ausfuehrlich im
// Kopfkommentar von v_wawi_stationsverkehr_zeitfenster in
// 0018_wawi_sichten.sql, nicht hier ein zweites Mal.
function stationVerkehrAbschnitt(station) {
    const abschnitt = document.createElement('section');
    abschnitt.className = 'stationverkehr';

    const ueberschrift = document.createElement('h3');
    ueberschrift.textContent = t('tile.trafficByTimeSlot');
    abschnitt.append(ueberschrift);

    const fehler = letzterLadeFehler('v_wawi_stationsverkehr_zeitfenster');
    if (fehler) {
        const hinweis = document.createElement('p');
        hinweis.className = 'stationverkehr-fehler';
        hinweis.textContent = t('msg.trafficLoadFailed', { fehler });
        abschnitt.append(hinweis);
        return abschnitt;
    }

    const zeilenHier = stationenVerkehrAlle.filter((z) => z.station_id === station.station_id);
    if (zeilenHier.length === 0) {
        const hinweis = document.createElement('p');
        hinweis.className = 'stationverkehr-leer';
        hinweis.textContent = t('tile.noTrafficData');
        abschnitt.append(hinweis);
        return abschnitt;
    }

    // Legende in TEXT, nicht nur in Farbe (durchgaengige Regel dieser
    // Oberflaeche: eine Bedeutung, die nur an einer Farbe haengt, ist
    // fuer einen Screenreader und fuer Rot-Gruen-Schwaeche gleichermassen
    // unsichtbar).
    const legende = document.createElement('div');
    legende.className = 'stationverkehr-legende';
    const legendeAbgang = document.createElement('span');
    legendeAbgang.className = 'stationverkehr-legende-eintrag stationverkehr-legende-abgang';
    legendeAbgang.textContent = t('tile.legendDepartures');
    const legendeZugang = document.createElement('span');
    legendeZugang.className = 'stationverkehr-legende-eintrag stationverkehr-legende-zugang';
    legendeZugang.textContent = t('tile.legendArrivals');
    legende.append(legendeAbgang, legendeZugang);
    abschnitt.append(legende);

    // GEMEINSAME SKALA UEBER BEIDE WOCHENTYPEN (Bissantz, wie ueberall
    // sonst in dieser Oberflaeche): macht sichtbar, dass Werktage weit
    // mehr Verkehr tragen als Wochenendtage (siehe die nachgemessenen
    // Zahlen im Kopfkommentar der Sicht), statt beide Reihen unabhaengig
    // auf ihre je eigene Hoehe zu strecken und den Unterschied damit
    // wegzuskalieren.
    const maximum = Math.max(0.01, ...zeilenHier.map((z) => Math.max(z.abgaenge_je_tag, z.zugaenge_je_tag)));

    for (const wochentyp of ['werktag', 'wochenende']) {
        const zeilenTyp = zeilenHier
            .filter((z) => z.wochentyp === wochentyp)
            .sort((a, b) => a.zeitfenster_start_stunde - b.zeitfenster_start_stunde);
        if (zeilenTyp.length === 0) continue;

        const block = document.createElement('div');
        block.className = 'stationverkehr-block';

        const wochentypTitel = wochentyp === 'werktag' ? t('tile.weekdays') : t('tile.weekend');
        const titel = document.createElement('h4');
        titel.textContent = wochentypTitel;
        block.append(titel);

        const tageErfasst = zeilenTyp[0].tage_erfasst;
        const maxAbgang = Math.max(...zeilenTyp.map((z) => z.abgaenge_je_tag));
        const maxZugang = Math.max(...zeilenTyp.map((z) => z.zugaenge_je_tag));
        const spitzeAbgang = zeilenTyp.find((z) => z.abgaenge_je_tag === maxAbgang);
        const spitzeZugang = zeilenTyp.find((z) => z.zugaenge_je_tag === maxZugang);
        const beschriftung = t('hint.trafficPatternAria', {
            wochentypTitel, name: station.name, tage: zahlFormat(tageErfasst),
            zeitfensterAb: zeitfensterLabel(spitzeAbgang.zeitfenster_start_stunde), maxAb: zahlFormat(maxAbgang, { maximumFractionDigits: 2 }),
            zeitfensterZu: zeitfensterLabel(spitzeZugang.zeitfenster_start_stunde), maxZu: zahlFormat(maxZugang, { maximumFractionDigits: 2 }) });

        block.append(zeitfensterDivergenzGrafik(zeilenTyp, maximum, beschriftung));
        abschnitt.append(block);
    }

    return abschnitt;
}

function zeitfensterLabel(startStunde) {
    const bis = (startStunde + 2) % 24;
    const pad = (n) => String(n).padStart(2, '0');
    // "Uhr" bleibt Deutsch-spezifisch (Auftrag: Zahlen-/Datumsformat folgt
    // der Sprache, ein Zeitfenster-Etikett wie dieses ist aber kein
    // formatiertes Datum/keine Uhrzeit im Intl-Sinn, sondern eine kurze
    // Wortmarke - fuer die anderen fuenf Sprachen bleibt die Spanne ohne
    // Suffix, das ist knapp genug, um weiterhin eindeutig zu sein.
    return sprache() === 'de' ? `${pad(startStunde)}–${pad(bis)} Uhr` : `${pad(startStunde)}–${pad(bis)}`;
}

// Eigene, kleine Zeichenfunktion statt eines weiteren rahmen.js-Bausteins
// (anders als donut(), das der Auftrag ausdruecklich als geteilten
// Baustein verlangt, siehe dortiger Kopfkommentar): diese zweiseitige
// Bloecke-Grafik hat innerhalb der heutigen fuenf Bereiche nur einen
// einzigen Verbraucher.
//
// ZWEI RICHTUNGEN UM EINE GEMEINSAME NULLLINIE (Auftrag, woertlich als
// bewaehrter Weg genannt) STATT NUR DES SALDOS: ein Saldo von 0 kann
// "keine Fahrten" oder "50 Abgaenge, 50 Zugaenge" bedeuten - fuer die
// Disposition sind das zwei voellig verschiedene Situationen (eine tote
// Station gegenueber einer belebten mit Gleichgewicht). Abgang UND Zugang
// bleiben deshalb als EIGENE Balken sichtbar, nicht nur ihre Differenz -
// die Differenz selbst liest sich trotzdem sofort ab, als Lücke
// zwischen den beiden Balkenenden.
// NULLPUNKT IST PFLICHT (Auftrag, ausdruecklich): beide Richtungen
// beginnen exakt an derselben horizontalen Linie, die Balkenlaenge
// kodiert die Rate - keine abgeschnittene Achse, aus demselben Grund wie
// bei saeulengrafik()/saeulenSparkline() in rahmen.js.
function zeitfensterDivergenzGrafik(zeitfenster, maximum, beschriftung) {
    const breite = 420;
    const hoehe = 100;
    const randUnten = 20;
    const mitteY = (hoehe - randUnten) / 2 + 4;
    const halbeHoehe = mitteY - 6;

    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${breite} ${hoehe}`);
    svg.classList.add('zeitfenstergrafik');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', beschriftung);

    const grundlinie = document.createElementNS(SVG_NS, 'line');
    grundlinie.setAttribute('x1', 0);
    grundlinie.setAttribute('x2', breite);
    grundlinie.setAttribute('y1', mitteY.toFixed(1));
    grundlinie.setAttribute('y2', mitteY.toFixed(1));
    grundlinie.setAttribute('class', 'zeitfenstergrafik-grundlinie');
    svg.append(grundlinie);

    const anzahl = zeitfenster.length;
    const abstand = breite / anzahl;
    const balkenbreite = Math.max(1, abstand - 4);

    zeitfenster.forEach((z, i) => {
        const x = (i * abstand + (abstand - balkenbreite) / 2).toFixed(1);
        const hoeheAb = maximum > 0 ? (z.abgaenge_je_tag / maximum) * halbeHoehe : 0;
        const hoeheZu = maximum > 0 ? (z.zugaenge_je_tag / maximum) * halbeHoehe : 0;
        const label = zeitfensterLabel(z.zeitfenster_start_stunde);

        const rectAb = document.createElementNS(SVG_NS, 'rect');
        rectAb.setAttribute('x', x);
        rectAb.setAttribute('y', (mitteY - hoeheAb).toFixed(1));
        rectAb.setAttribute('width', balkenbreite.toFixed(1));
        rectAb.setAttribute('height', hoeheAb.toFixed(1));
        rectAb.setAttribute('class', 'zeitfenstergrafik-abgang');
        const titelAb = document.createElementNS(SVG_NS, 'title');
        titelAb.textContent = t('hint.departuresPerDayLabel', { label, n: zahlFormat(z.abgaenge_je_tag, { maximumFractionDigits: 2 }) });
        rectAb.append(titelAb);
        svg.append(rectAb);

        const rectZu = document.createElementNS(SVG_NS, 'rect');
        rectZu.setAttribute('x', x);
        rectZu.setAttribute('y', mitteY.toFixed(1));
        rectZu.setAttribute('width', balkenbreite.toFixed(1));
        rectZu.setAttribute('height', hoeheZu.toFixed(1));
        rectZu.setAttribute('class', 'zeitfenstergrafik-zugang');
        const titelZu = document.createElementNS(SVG_NS, 'title');
        titelZu.textContent = t('hint.arrivalsPerDayLabel', { label, n: zahlFormat(z.zugaenge_je_tag, { maximumFractionDigits: 2 }) });
        rectZu.append(titelZu);
        svg.append(rectZu);
    });

    // x-Achse: drei Beschriftungen (erstes, mittleres, letztes Zeitfenster) -
    // dieselbe Zurueckhaltung wie bei saeulengrafik() in rahmen.js, aus
    // demselben Grund: zwoelf volle Beschriftungen waeren bei dieser
    // Breite nicht mehr lesbar, <title> je Balken traegt die genaue
    // Uhrzeit ohnehin schon.
    [0, Math.floor((anzahl - 1) / 2), anzahl - 1].forEach((i, position) => {
        if (position === 1 && (i === 0 || i === anzahl - 1)) return;
        const text = document.createElementNS(SVG_NS, 'text');
        text.setAttribute('x', (i * abstand + abstand / 2).toFixed(1));
        text.setAttribute('y', (hoehe - 4).toFixed(1));
        text.setAttribute('class', 'zeitfenstergrafik-achse');
        text.textContent = `${String(zeitfenster[i].zeitfenster_start_stunde).padStart(2, '0')}h`;
        svg.append(text);
    });

    return svg;
}

// ===== Landkarte (Gestaltungsauftrag Punkt 4) =====
//
// "Mir fehlen Landkarten für die Stationen, ich möchte eine neue Sicht
// haben, in der die Standorte auch als Landkarten visualisiert sind und
// sich zusätzlich die Kunden einblenden lassen" - woertlich der Auftrag.
//
// KEINE KARTENKACHELN (Auftrag, ausdruecklich als harte Grenze benannt):
// jede Kartenkachel waere eine Fremdanfrage aus dem Browser des Nutzers -
// nach der Projektregel ("kein Framework, keine Abhaengigkeit ausser
// supabase-js v2") ebenso ausgeschlossen wie ein Diagrammbaustein fuer
// donut()/saeulenSparkline() oben. Die Karte ist deshalb selbst
// gezeichnetes Inline-SVG aus den echten Stationskoordinaten (v_wawi_
// station.latitude/.longitude) und den echten Ortskoordinaten
// (velocity.ort_koordinate ueber v_wawi_kundenorte) - keine externe
// Anfrage, keine Kartenkachel.
function stationenKarteZeigen(kennung, stationen) {
    if (!istAktuellerVorgang(kennung)) return;

    // Keine Zeilen zum Auswählen/Durchpfeilen - dieselbe Aufraeumung
    // wie bei zeigeLeermaske() in rahmen.js, aus demselben Grund: der
    // globale ArrowUp/Down-Handler dort prueft listenZeilen.length === 0
    // und bleibt dadurch stumm, statt sich auf eine Tabellenzeile zu
    // beziehen, die es hier gar nicht gibt.
    listenZeilen = [];
    listenAuswahl = null;
    listenIndex = -1;
    listenZeilenElemente = [];

    const wurzel = listenKoerper();
    wurzel.replaceChildren();

    const rahmen = document.createElement('div');
    rahmen.className = 'stationenkarte';

    const kopf = document.createElement('div');
    kopf.className = 'stationenkarte-kopf';

    const erklaerung = document.createElement('p');
    erklaerung.className = 'stationenkarte-erklaerung';
    // Ausdruecklich als Schema beschriftet (Auftrag: "Beschrifte das
    // ausdruecklich, damit niemand sie fuer massstabsgetreu haelt") -
    // und die Bedeutung der Marken in Text, nicht nur in der Grafik
    // selbst.
    erklaerung.textContent = t('map.schematicNote');
    kopf.append(erklaerung);

    const schalterLabel = document.createElement('label');
    schalterLabel.className = 'stationenkarte-schalter';
    const schalter = document.createElement('input');
    schalter.type = 'checkbox';
    schalter.checked = stationenKarteKundenSichtbar;
    schalterLabel.append(schalter, document.createTextNode(t('button.showCustomersOnMap')));
    kopf.append(schalterLabel);

    rahmen.append(kopf);

    const kartenflaeche = document.createElement('div');
    kartenflaeche.className = 'stationenkarte-flaeche';
    kartenflaeche.append(stationenKarteZeichnen(stationen, stationenKundenorteAlle, stationenKarteKundenSichtbar));
    rahmen.append(kartenflaeche);

    // Der Schalter zeichnet NUR die Kartenflaeche neu, nicht den ganzen
    // Unterreiter - kein neuer *Aufbauen()-Vorgang, dieselbe Ueberlegung
    // wie beim Schieber-Filter in zeigeFilterleiste() (rahmen.js): eine
    // reine Anzeigeeinstellung braucht keinen Netzwerk-Umweg, die Daten
    // (stationenKundenorteAlle) liegen bereits vollstaendig vor.
    schalter.addEventListener('change', () => {
        stationenKarteKundenSichtbar = schalter.checked;
        kartenflaeche.replaceChildren(
            stationenKarteZeichnen(stationen, stationenKundenorteAlle, stationenKarteKundenSichtbar));
    });

    wurzel.append(rahmen);

    // Ohne Zeilen gibt es nichts auszuwaehlen - eine noch offene Maske
    // bezoege sich sonst auf eine Zeile, die gerade verschwunden ist
    // (dieselbe Ueberlegung wie am Ende von zeigeLeermaske() in
    // rahmen.js). EIN Klick auf eine Stationsmarke oeffnet unten trotzdem
    // wieder eine Detailmaske (stationMaske()) - das ist dann ein neuer,
    // eigener Aufruf, keine Fortsetzung einer alten Auswahl.
    document.getElementById('detailmaske').replaceChildren();
    hauptknopfElement = null;
}

// Reale Bruecken-Koordinaten (OpenStreetMap/Nominatim, siehe Bericht) als
// grobe Stuetzpunkte fuer die Main-Andeutung - kein erfundener Flusslauf,
// aber auch keine vollstaendige Nachzeichnung: drei Punkte innerhalb der
// Stationsspanne (49.781-49.805 Nord) genuegen fuer eine "grobe Linie,
// erkennbar als Schema" (Auftrag, woertlich), mehr wuerde eine Genauigkeit
// vortaeuschen, die diese Karte nicht hat und nicht braucht.
const STATIONENKARTE_MAIN_STUETZPUNKTE = [
    { lat: 49.7987476, lon: 9.9228351 },   // Friedensbrücke
    { lat: 49.7929796, lon: 9.9256566 },   // Alte Mainbrücke
    { lat: 49.7863749, lon: 9.9267634 }    // Ludwigsbrücke
];

// stationen: fuer die Stationsmarken, IMMER gezeichnet.
// kundenorte: v_wawi_kundenorte-Zeilen, nur bei kundenSichtbar gezeichnet
// UND (Punkt 4b, ausdruecklich) in die Kartenausdehnung einbezogen - sonst
// laegen Orte wie Karlstadt oder Marktheidenfeld (deutlich ausserhalb der
// im Auftrag genannten Stationsspanne) ausserhalb des sichtbaren Bereichs,
// sobald der Schalter sie einblendet.
function stationenKarteZeichnen(stationen, kundenorte, kundenSichtbar) {
    const breite = 680;
    const hoehe = 460;
    const rand = 46;

    const stationsPunkte = stationen
        .filter((s) => s.latitude != null && s.longitude != null)
        .map((s) => ({ lat: Number(s.latitude), lon: Number(s.longitude) }));
    const kundenPunkte = kundenSichtbar
        ? kundenorte.filter((o) => o.latitude != null && o.longitude != null)
            .map((o) => ({ lat: Number(o.latitude), lon: Number(o.longitude) }))
        : [];

    const proj = stationenKarteProjektion(stationsPunkte.concat(kundenPunkte), breite, hoehe, rand);

    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${breite} ${hoehe}`);
    svg.classList.add('stationenkarte-svg');
    // role="group", NICHT role="img": diese Karte hat anklickbare
    // Stationsmarken (siehe unten) - ein "img" behauptet fuer einen
    // Screenreader ein einziges, flaches Bild und wuerde interaktive
    // Kinder ignorieren bzw. unerreichbar machen. Die knappe Zusammen-
    // fassung hier ist die Kartenerklaerung ausserhalb der Grafik
    // (.stationenkarte-erklaerung) UND die Karte selbst; jede einzelne
    // Marke traegt zusaetzlich ihr EIGENES aria-label (siehe unten).
    svg.setAttribute('role', 'group');
    svg.setAttribute('aria-label', kundenSichtbar
        ? t('map.areaWithCustomers', { stationenPhrase: mengeFormat(stationen.length, 'station') })
        : t('map.area', { stationenPhrase: mengeFormat(stationen.length, 'station') }));

    // Main (schematisch) - siehe Kopfkommentar bei
    // STATIONENKARTE_MAIN_STUETZPUNKTE. aria-hidden: rein orientierende
    // Andeutung, keine eigene Information, die ein Screenreader braeuchte.
    const mainPunkte = STATIONENKARTE_MAIN_STUETZPUNKTE.map((p) => proj.projizieren(p.lat, p.lon));
    const fluss = document.createElementNS(SVG_NS, 'polyline');
    fluss.setAttribute('points', mainPunkte.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '));
    fluss.setAttribute('class', 'stationenkarte-fluss');
    fluss.setAttribute('aria-hidden', 'true');
    svg.append(fluss);
    const flussText = document.createElementNS(SVG_NS, 'text');
    flussText.setAttribute('x', (mainPunkte[0].x + 8).toFixed(1));
    flussText.setAttribute('y', (mainPunkte[0].y - 6).toFixed(1));
    flussText.setAttribute('class', 'stationenkarte-fluss-text');
    flussText.setAttribute('aria-hidden', 'true');
    flussText.textContent = t('map.riverLabel');
    svg.append(flussText);

    // Kundenmarken ZUERST (unten in der Zeichenreihenfolge), Stations-
    // marken DARUEBER: eine Station soll nie hinter einem grossen
    // Kundenkreis verschwinden, auch wenn beide geografisch nah beieinander
    // liegen (z. B. eine Station im Zentrum, nah an "Würzburg" selbst).
    if (kundenSichtbar) {
        const maxKunden = Math.max(1, ...kundenorte.map((o) => o.kunden));
        for (const ort of kundenorte) {
            if (ort.latitude == null || ort.longitude == null) continue;
            const p = proj.projizieren(Number(ort.latitude), Number(ort.longitude));
            const radius = stationenKarteKundenRadius(ort.kunden, maxKunden);

            const gruppe = document.createElementNS(SVG_NS, 'g');
            gruppe.setAttribute('class', 'stationenkarte-kundenort');
            gruppe.setAttribute('role', 'img');
            gruppe.setAttribute('aria-label', t('map.customersAtLocation', { ort: ort.ort, kundenPhrase: mengeFormat(ort.kunden, 'kunde') }));

            const kreis = document.createElementNS(SVG_NS, 'circle');
            kreis.setAttribute('cx', p.x.toFixed(1));
            kreis.setAttribute('cy', p.y.toFixed(1));
            kreis.setAttribute('r', radius.toFixed(1));
            kreis.setAttribute('class', 'stationenkarte-kundenort-kreis');
            gruppe.append(kreis);

            // Sichtbare Zahl NEBEN der Flaeche (dieselbe Regel wie bei
            // donut() in rahmen.js: "Kunden aus der Flaechengroesse
            // schaetzen" waere fuer Veitshoechheim (58) gegen Karlstadt
            // (9) ebenso eine Schaetzaufgabe wie ein Donut ohne Zahl).
            const beschriftung = document.createElementNS(SVG_NS, 'text');
            beschriftung.setAttribute('x', p.x.toFixed(1));
            beschriftung.setAttribute('y', (p.y + radius + 11).toFixed(1));
            beschriftung.setAttribute('class', 'stationenkarte-kundenort-text');
            beschriftung.setAttribute('aria-hidden', 'true');
            beschriftung.textContent = t('map.customerLabelShort', { ort: ort.ort, n: zahlFormat(ort.kunden) });
            gruppe.append(beschriftung);

            svg.append(gruppe);
        }
    }

    const kapazitaeten = stationen.map((s) => s.kapazitaet);
    const kapMin = Math.min(...kapazitaeten);
    const kapMax = Math.max(...kapazitaeten);

    for (const station of stationen) {
        if (station.latitude == null || station.longitude == null) continue;
        const p = proj.projizieren(Number(station.latitude), Number(station.longitude));
        const durchmesser = stationenKarteStationsDurchmesser(station.kapazitaet, kapMin, kapMax);
        const voll = station.frei === 0;
        const beschriftung = t('map.stationBelegLabel', { name: station.name, belegt: zahlFormat(station.belegt), kapazitaet: zahlFormat(station.kapazitaet) })
            + (voll ? t('map.stationFullSuffix') : '') + t('map.openDetailsSuffix');

        // donut() wiederverwendet, nicht neu gezeichnet (Auftrag: "die
        // anderen Bereiche werden ihn brauchen") - "Groesse = Kapazitaet,
        // Fuellung = Belegung" (Auftrag, woertlich) ist damit exakt
        // dieselbe Grafik wie in der Detailmaske, nur eingebettet in eine
        // Karte statt in eine Kachel.
        const markierung = donut(station.belegt, station.kapazitaet, beschriftung, {
            durchmesser,
            dicke: Math.max(4, durchmesser * 0.16),
            farbe: voll ? 'var(--warnung-text)' : 'var(--marine)'
        });
        // role/aria-label des Donuts hier ABSICHTLICH stummgeschaltet:
        // die umschliessende <g> unten traegt bereits die vollstaendige
        // Beschriftung UND die Klick-/Tastaturbedienung - ein
        // Screenreader soll "Hauptbahnhof: 28 von 40 ... Details oeffnen"
        // genau EINMAL hoeren, nicht zusaetzlich "Bild, 70 Prozent" vom
        // verschachtelten Donut (dasselbe Prinzip wie aria-hidden auf dem
        // Icon-Wrapper in navigationAufbauen(), rahmen.js).
        markierung.removeAttribute('role');
        markierung.setAttribute('aria-hidden', 'true');
        markierung.setAttribute('x', (p.x - durchmesser / 2).toFixed(1));
        markierung.setAttribute('y', (p.y - durchmesser / 2).toFixed(1));

        const marke = document.createElementNS(SVG_NS, 'g');
        marke.setAttribute('class', 'stationenkarte-station');
        marke.setAttribute('tabindex', '0');
        marke.setAttribute('role', 'button');
        marke.setAttribute('aria-label', beschriftung);
        // <title> zusaetzlich zu aria-label: aria-label allein erzeugt
        // KEINEN nativen Mauszeiger-Tooltip (das lesen nur Screenreader) -
        // ohne <title> haette eine sehende Maus-Bedienung keinen Weg an
        // die Zahl, die donut() auf dieser Markengroesse bewusst
        // ausblendet (siehe .stationenkarte-station .donut-text-prozent
        // in style.css).
        const titelElement = document.createElementNS(SVG_NS, 'title');
        titelElement.textContent = beschriftung;
        marke.append(titelElement);
        marke.addEventListener('click', () => stationMaske(station));
        marke.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                stationMaske(station);
            }
        });
        marke.append(markierung);

        const label = document.createElementNS(SVG_NS, 'text');
        label.setAttribute('x', p.x.toFixed(1));
        label.setAttribute('y', (p.y + durchmesser / 2 + 12).toFixed(1));
        label.setAttribute('class', 'stationenkarte-station-text');
        label.setAttribute('aria-hidden', 'true');
        label.textContent = station.stationsnummer;
        marke.append(label);

        svg.append(marke);
    }

    svg.append(stationenKarteMassstabsbalken(proj, breite, hoehe, rand));
    svg.append(stationenKarteNordpfeil(breite, rand));

    return svg;
}

// Kreisdurchmesser linear zwischen 30 und 58 px ueber die tatsaechliche
// Kapazitaetsspanne der geladenen Stationen (20 bis 40 Stellplaetze in
// der Referenzdatenbank) - "Groesse = Kapazitaet" (Auftrag), keine
// willkuerliche feste Groesse je Station.
function stationenKarteStationsDurchmesser(kapazitaet, kapMin, kapMax) {
    const kleinste = 30;
    const groesste = 58;
    if (kapMax === kapMin) return (kleinste + groesste) / 2;
    return kleinste + ((kapazitaet - kapMin) / (kapMax - kapMin)) * (groesste - kleinste);
}

// Flaechenproportional statt radiusproportional (kartografischer
// Standard fuer wertkodierte Kreise): ein zehnmal so grosser Kundenwert
// waere bei radiusproportionaler Skalierung optisch HUNDERTMAL so gross,
// weil die Flaeche quadratisch mit dem Radius waechst - Wuerzburg (573)
// gegen Karlstadt (9) waere damit nicht mehr vergleichbar dargestellt,
// sondern verzerrt.
function stationenKarteKundenRadius(kunden, maxKunden) {
    const radiusMin = 4;
    const radiusMax = 24;
    const flaecheMin = Math.PI * radiusMin * radiusMin;
    const flaecheMax = Math.PI * radiusMax * radiusMax;
    const anteil = maxKunden > 0 ? kunden / maxKunden : 0;
    const flaeche = flaecheMin + anteil * (flaecheMax - flaecheMin);
    return Math.sqrt(flaeche / Math.PI);
}

// Aequidistante Zylinderprojektion (Plate Carrée) um die MITTLERE Breite
// der uebergebenen Punkte - fuer ein derart kleines Gebiet (unter 40 km
// Kantenlaenge selbst mit eingeblendeter Kundschaft) unabhaengig von
// jeder aufwendigeren Projektion ausreichend genau.
//
// DIE LAENGENGRAD-KORREKTUR IST PFLICHT (Auftrag, ausdruecklich als
// Fallstrick benannt): "ein Grad Laenge ist auf dieser Breite deutlich
// kuerzer als ein Grad Breite - wer beides gleich skaliert, verzerrt."
// Bei rund 49.8 Grad Nord ist ein Laengengrad nur noch cos(49.8°) ≈ 0.646
// so lang wie ein Breitengrad - kappa unten korrigiert genau das, INDEM
// jede Laengengrad-Differenz vor der eigentlichen Skalierung mit kappa
// multipliziert wird, sodass beide Achsen anschliessend in derselben
// "Breitengrad-aequivalenten" Einheit vorliegen und EIN gemeinsamer
// Massstab (massstab unten) fuer beide Richtungen gilt.
function stationenKarteProjektion(punkte, breite, hoehe, rand) {
    const latWerte = punkte.map((p) => p.lat);
    const lonWerte = punkte.map((p) => p.lon);
    const latMin = Math.min(...latWerte);
    const latMax = Math.max(...latWerte);
    const lonMin = Math.min(...lonWerte);
    const lonMax = Math.max(...lonWerte);
    const latMitte = (latMin + latMax) / 2;
    const kappa = Math.cos((latMitte * Math.PI) / 180);

    // Mindestspanne, falls jemals nur ein einzelner Punkt hereinkaeme
    // (heute nicht der Fall: mindestens zehn Stationen) - schuetzt vor
    // einer Division durch 0, nicht vor einem realistischen Datenfall.
    const breiteGrad = Math.max(latMax - latMin, 0.002);
    const laengeGrad = Math.max((lonMax - lonMin) * kappa, 0.002);

    const nutzbarBreite = breite - 2 * rand;
    const nutzbarHoehe = hoehe - 2 * rand;
    const massstab = Math.min(nutzbarBreite / laengeGrad, nutzbarHoehe / breiteGrad);

    // Zentrieren: die kuerzere Achse bekommt sonst unnoetig Luft nur auf
    // EINER Seite statt symmetrisch auf beiden.
    const versatzX = rand + (nutzbarBreite - laengeGrad * massstab) / 2;
    const versatzY = rand + (nutzbarHoehe - breiteGrad * massstab) / 2;

    return {
        massstab,
        projizieren(lat, lon) {
            return {
                x: versatzX + (lon - lonMin) * kappa * massstab,
                y: versatzY + (latMax - lat) * massstab   // Norden = oben
            };
        }
    };
}

// Massstabsbalken: rundet auf eine "runde" Kilometerzahl ab, die nicht
// breiter als ein Achtel der Kartenbreite wird - eine Karte, deren
// Ausdehnung sich je nach eingeblendeter Kundschaft aendert (siehe
// stationenKarteZeichnen()), braucht einen Massstab, der sich MIT ihr
// aendert, kein fest eingezeichneter Wert.
function stationenKarteMassstabsbalken(proj, breite, hoehe, rand) {
    const KM_PRO_GRAD_BREITE = 111.32;   // Mittelwert - fuer eine schematische Karte ausreichend genau
    const pixelProKm = proj.massstab / KM_PRO_GRAD_BREITE;
    const kandidaten = [0.25, 0.5, 1, 2, 5, 10, 20, 50];
    const maxBreitePixel = breite / 8;
    let km = kandidaten[0];
    for (const k of kandidaten) {
        if (k * pixelProKm <= maxBreitePixel) km = k;
    }
    const laengePixel = km * pixelProKm;

    const gruppe = document.createElementNS(SVG_NS, 'g');
    gruppe.setAttribute('class', 'stationenkarte-massstab');
    // aria-hidden: ein kartografischer Massstab ist eine Konvention fuer
    // sehende Nutzung der Grafik selbst, kein Ersatz fuer die textuelle
    // Erklaerung (.stationenkarte-erklaerung) - dieselbe Behandlung wie
    // die Achsenbeschriftung bei saeulengrafik() in rahmen.js.
    gruppe.setAttribute('aria-hidden', 'true');

    const y = hoehe - rand / 2;
    const x0 = rand;
    const x1 = rand + laengePixel;

    const balken = document.createElementNS(SVG_NS, 'line');
    balken.setAttribute('x1', x0);
    balken.setAttribute('x2', x1);
    balken.setAttribute('y1', y);
    balken.setAttribute('y2', y);
    gruppe.append(balken);

    for (const x of [x0, x1]) {
        const tick = document.createElementNS(SVG_NS, 'line');
        tick.setAttribute('x1', x);
        tick.setAttribute('x2', x);
        tick.setAttribute('y1', y - 4);
        tick.setAttribute('y2', y + 4);
        gruppe.append(tick);
    }

    const text = document.createElementNS(SVG_NS, 'text');
    text.setAttribute('x', ((x0 + x1) / 2).toFixed(1));
    text.setAttribute('y', (y - 8).toFixed(1));
    text.setAttribute('class', 'stationenkarte-massstab-text');
    text.textContent = km < 1 ? `${Math.round(km * 1000)} m` : `${km} km`;
    gruppe.append(text);

    return gruppe;
}

// Nordpfeil: eine einfache Dreiecksspitze mit "N" - genug, um die
// Orientierung der Karte zu benennen, ohne die "Schema, keine Landkarte"-
// Beschriftung (siehe stationenKarteZeigen()) durch ein aufwendigeres
// Symbol zu unterlaufen.
function stationenKarteNordpfeil(breite, rand) {
    const gruppe = document.createElementNS(SVG_NS, 'g');
    gruppe.setAttribute('class', 'stationenkarte-nordpfeil');
    gruppe.setAttribute('aria-hidden', 'true');   // rein orientierende Konvention, siehe Massstabsbalken oben

    const x = breite - rand / 2 - 4;
    const ySpitze = rand / 2 - 8;
    const yFuss = rand / 2 + 12;

    const pfeil = document.createElementNS(SVG_NS, 'path');
    pfeil.setAttribute('d', `M ${x} ${ySpitze} L ${x - 6} ${yFuss} L ${x} ${yFuss - 4} L ${x + 6} ${yFuss} Z`);
    gruppe.append(pfeil);

    const text = document.createElementNS(SVG_NS, 'text');
    text.setAttribute('x', x);
    text.setAttribute('y', yFuss + 12);
    text.setAttribute('class', 'stationenkarte-nordpfeil-text');
    text.textContent = 'N';
    gruppe.append(text);

    return gruppe;
}

// ===== Eine Station anlegen =====
//
// Der Einstieg dazu ist die Werkzeugleiste am Kopf von
// stationenAufbauen() (zeigeWerkzeugleiste in rahmen.js) - kein eigener
// Leisten-Baustein mehr hier. Die Leitung sieht v_wawi_station zwar
// auch, aber keinen Anlegen-Knopf: was man nicht darf, soll man nicht
// suchen.

function stationAnlegenMaske() {
    zeigeMaske(t('button.newStation'), [
        { name: 'name',       titel: t('field.name'),         wert: '' },
        { name: 'strasse',    titel: t('field.strasse'),      wert: '' },
        { name: 'hausnummer', titel: t('field.hausnummerVoll'), wert: '' },
        { name: 'plz',        titel: t('field.plz'),          wert: '' },
        { name: 'ort',        titel: t('field.ort'),          wert: '' },
        { name: 'latitude',   titel: t('field.breite'),       wert: '', typ: 'zahl' },
        { name: 'longitude',  titel: t('field.laenge'),       wert: '', typ: 'zahl' },
        { name: 'kapazitaet', titel: t('field.stellplaetze'), wert: '', typ: 'zahl' }
    ], [
        {
            titel: t('button.create'),
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
                    melde(t('msg.stationFieldsRequired'), 'schlecht');
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
                    melde(t('msg.latLonRequired'), 'schlecht');
                    return;
                }
                const latitude = Number(latitudeText);
                const longitude = Number(longitudeText);
                if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
                    melde(t('msg.latitudeRange'), 'schlecht');
                    return;
                }
                if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
                    melde(t('msg.longitudeRange'), 'schlecht');
                    return;
                }

                const kapazitaet = Number(feld('kapazitaet'));
                if (!Number.isInteger(kapazitaet) || kapazitaet <= 0) {
                    melde(t('msg.capacityPositiveInteger'), 'schlecht');
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
                melde(t('msg.stationCreated', { name }), 'gut');
                await stationenAufbauen();
            }
        }
    ]);
}
