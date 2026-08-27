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
//   2. "ein Donut-Chart fuer die Belegung ... 100 % ist die Kapazitaet"
//      (in den Details) - donut() in rahmen.js, in
//      stationBelegungAbschnitt(). Der zweite, netzweite Donut im Kopf
//      ist mit dem Kachelband entfallen: die Kopftafel zeigt die Belegung
//      JEDER der zehn Stationen als Strukturbalken auf gemeinsamer Skala
//      und darunter die Zeile "Zusammen" - eine einzelne Netzzahl im Ring
//      waere daneben nur noch dieselbe Zahl ein zweites Mal.
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

// Die Stationsliste selbst, aus demselben Grund zwischengespeichert wie
// die drei Arrays oben: stationDetailkarteAbschnitt() (zweiter Auftrag,
// "die Karte ... wenn ich auf Details gehe") braucht ALLE Stationen, um
// die naechsten Nachbarn der angezeigten zu finden - stationMaske()
// bekommt von zeileWaehlen()/der Kartenmarke aber nur die EINE angeklickte
// Zeile uebergeben, nicht die ganze Liste.
let stationenAlle = [];

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
    const [stationen, raeder, verkehr, kundenorte, auslastung] = await Promise.all([
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
        ladeListe('v_wawi_kundenorte', 'ort, latitude, longitude, kunden'),
        // Fuenfte Sicht, neu in diesem Bereich (Gestaltungsauftrag,
        // "Der Saldo ist die eigentliche Geschichte dieses Bereichs" -
        // woertlich): saldo (zugaenge minus abgaenge, siehe deren Kopf-
        // kommentar in 0018_wawi_sichten.sql) ist eine ueber die gesamte
        // Historie gezaehlte Groesse, die sich aus station.belegt/.frei
        // (reinen Momentanwerten) nicht herleiten liesse - nur diese
        // Sicht kennt sie. Dieselbe Sicht wie stationsauslastungZeigen()
        // in auswertungen.js, hier zusaetzlich IM STATIONEN-KOPF, wo der
        // Auftrag sie ausdruecklich vermisst.
        ladeListe('v_wawi_stationsauslastung', 'station_id, abgaenge, zugaenge, saldo')
    ]);

    const fehler = letzterLadeFehler('v_wawi_station');
    if (fehler) {
        // meldeVorgang statt melde: ein inzwischen veralteter Aufruf
        // (siehe Kommentar dort) meldet auch seinen eigenen Ladefehler
        // nicht mehr.
        zeigeKopftafel(vorgang, null);
        meldeVorgang(vorgang, t('msg.stationsLoadFailed', { fehler }), 'schlecht');
        return;
    }

    // Raeder/Verkehr/Kundenorte/Auslastung sind eine ERGAENZUNG der
    // Stationsliste, kein Ersatz fuer sie - ein Ladefehler dort darf die
    // Stationsliste selbst nicht verhindern (die Kernfrage "wie viele
    // Stationen, wie voll" bleibt beantwortbar). Die jeweilige
    // Detailmaske bzw. die Karte meldet einen solchen Fehler stattdessen
    // selbst, siehe stationRaederAbschnitt()/stationVerkehrAbschnitt()
    // unten; stationenKopftafel() unten laesst die Tagesgang- bzw. die
    // Saldospalte bei einem Ladefehler dort schlicht weg (siehe dort).
    stationenRaederAlle = raeder;
    stationenVerkehrAlle = verkehr;
    stationenKundenorteAlle = kundenorte;
    stationenAlle = stationen;

    zeigeKopftafel(vorgang, stationenKopftafel(stationen, verkehr, auslastung));

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

// ===== Kopftafel der Stationen =====
//
// DIE FRAGE, DIE DIESER KOPF BEANTWORTET: "Welche Station laeuft ueber,
// welche laeuft leer, wann wird sie ueberhaupt gebraucht - und wo muss
// heute jemand Raeder umsetzen?"
//
// Die Liste darunter fuehrt dieselben zehn Stationen, zeigt aber je
// Station nur einen Momentwert (belegt von Kapazitaet). Drei Dinge, die
// ein Disponent morgens braucht, stehen dort nicht und koennen dort auch
// nicht stehen, weil sie aus zwei weiteren Sichten kommen:
//
//   - der TAGESGANG (wann diese Station gefahren wird - eine Reihe von
//     zwoelf Zweistundenbloecken, keine einzelne Zahl),
//   - der SALDO (ob sie ueber die gesamte Historie Raeder ansammelt oder
//     verliert - "die eigentliche Geschichte dieses Bereichs", Auftrag),
//   - und beides IM VERGLEICH ueber alle zehn Stationen, auf EINER Skala.
//
// Genau dafuer sind die zehn Zeilen gleich gebaut: zehn Tagesgaenge
// untereinander auf derselben Achse sind Tuftes small multiples - man
// sieht auf einen Blick, dass alle zehn Stationen denselben Rhythmus
// haben (Morgenspitze, Mittag, starke Nachmittagsspitze) und sich fast
// nur im Saldo unterscheiden. Diese Aussage kann keine einzelne Kachel
// treffen, egal wie gross ihre Zahl ist.
function stationenKopftafel(stationen, verkehr, auslastung) {
    if (!stationen || stationen.length === 0) return null;

    const gesamtKapazitaet = stationen.reduce((s, z) => s + z.kapazitaet, 0);
    const gesamtBelegt = stationen.reduce((s, z) => s + z.belegt, 0);

    // Saldo und Abgaenge je Station aus v_wawi_stationsauslastung - eine
    // ueber die gesamte Historie gezaehlte Groesse, die sich aus
    // station.belegt/.frei (reinen Momentanwerten) nicht herleiten liesse.
    // Faellt diese Sicht aus (Ladefehler), entfallen die betroffenen
    // Spalten, nicht die ganze Tafel: "lieber eine Spalte weniger als
    // eine erfundene" - dieselbe Haltung wie bisher bei der Saldo-Kachel.
    const auslastungFehler = Boolean(letzterLadeFehler('v_wawi_stationsauslastung'));
    const nachId = new Map((auslastung || []).map((a) => [a.station_id, a]));
    const hatSaldo = !auslastungFehler && nachId.size > 0;

    // Tagesgang: die zwoelf Zweistundenbloecke EINES Werktags, je Station.
    // Nur 'werktag' (nicht Wochenende): zwei Reihen je Zeile waeren zwei
    // Grafiken in einer Zelle und damit gerade nicht mehr small multiples;
    // der Werktag traegt die Spitzen, um die es der Disposition geht.
    // Wochenende steht unveraendert in der Detailmaske jeder Station
    // (stationVerkehrAbschnitt() weiter unten) - der Kopf zeigt den
    // Vergleich, die Maske die Tiefe.
    const verkehrFehler = Boolean(letzterLadeFehler('v_wawi_stationsverkehr_zeitfenster'));
    const tagesgang = new Map();
    if (!verkehrFehler) {
        for (const zeile of verkehr || []) {
            if (zeile.wochentyp !== 'werktag') continue;
            let reihe = tagesgang.get(zeile.station_id);
            if (!reihe) { reihe = new Array(12).fill(0); tagesgang.set(zeile.station_id, reihe); }
            reihe[Math.floor(zeile.zeitfenster_start_stunde / 2)] = Number(zeile.abgaenge_je_tag) || 0;
        }
    }
    const hatTagesgang = tagesgang.size > 0;

    const stundeText = (index) => `${zahlFormat(index * 2)}-${zahlFormat(index * 2 + 2)}`;
    const spitzeVon = (reihe) => {
        const hoechster = Math.max(...reihe);
        return { wert: hoechster, index: reihe.indexOf(hoechster) };
    };

    const spalten = [
        {
            art: 'rubrik',
            titel: t('col.station'),
            wert: (z) => z.name,
            zusatz: (z) => (z.summenzeile ? null : z.ort)
        },
        {
            art: 'groesse',
            titel: t('col.capacity'),
            einheit: t('unit.dockingPoints'),
            wert: (z) => z.kapazitaet,
            format: (n) => zahlFormat(n)
        },
        {
            art: 'struktur',
            titel: t('col.occupancy'),
            einheit: t('unit.shareOfRow'),
            auchSumme: true,
            segmente: (z) => [
                // Eine VOLLE Station traegt ihren Balken in --warnung-text
                // statt in --marine: dort passt kein zurueckgegebenes Rad
                // mehr hinein, und das ist eine Handlungsaufforderung, kein
                // Bestwert. Dieselbe Bedeutung, die die Farbe in dieser
                // Oberflaeche ueberall traegt.
                { wert: z.belegt, name: t('col.occupied'), klasse: z.frei === 0 ? 'seg-warnung' : 'seg-aktiv' },
                { wert: z.frei, name: t('col.free'), klasse: 'seg-ruhend' }
            ],
            beschriftung: (z) => t('board.stationOccupancyAria', {
                name: z.name, belegt: zahlFormat(z.belegt), kapazitaet: zahlFormat(z.kapazitaet),
                prozent: zahlFormat(z.kapazitaet ? Math.round((z.belegt / z.kapazitaet) * 100) : 0)
            })
        }
    ];

    if (hatTagesgang) {
        spalten.push({
            art: 'profil',
            titel: t('col.dailyRhythm'),
            einheit: t('unit.departuresPerWorkday'),
            reihe: (z) => tagesgang.get(z.station_id) || null,
            beschriftung: (z) => {
                const reihe = tagesgang.get(z.station_id) || [];
                const spitze = spitzeVon(reihe);
                return t('board.stationRhythmAria', {
                    name: z.name, stunde: stundeText(spitze.index),
                    wert: zahlFormat(spitze.wert, { maximumFractionDigits: 2 })
                });
            }
        });
    }

    if (hatSaldo) {
        spalten.push({
            art: 'abweichung',
            titel: t('col.balance'),
            einheit: t('unit.ridesArrivalsMinusDepartures'),
            wert: (z) => (z.summenzeile ? null : (nachId.get(z.station_id)?.saldo ?? null)),
            format: (n) => abweichungText(n, 0),
            beschriftung: (z) => {
                const eintrag = nachId.get(z.station_id) || {};
                return t('board.stationBalanceAria', {
                    name: z.name, zugaenge: zahlFormat(eintrag.zugaenge ?? 0),
                    abgaenge: zahlFormat(eintrag.abgaenge ?? 0), saldo: zahlFormat(eintrag.saldo ?? 0)
                });
            }
        });
    }

    const abgaengeAlle = hatSaldo
        ? stationen.map((s) => nachId.get(s.station_id)?.abgaenge).filter((n) => n != null)
        : [];

    return {
        titel: t('board.stationsTitle'),
        bezug: t('board.stationsReference', {
            stationenPhrase: mengeFormat(stationen.length, 'station'),
            belegt: zahlFormat(gesamtBelegt), kapazitaet: zahlFormat(gesamtKapazitaet),
            prozent: zahlFormat(gesamtKapazitaet ? Math.round((gesamtBelegt / gesamtKapazitaet) * 100) : 0)
        }),
        spalten,
        zeilen: stationen,
        summe: {
            summenzeile: true, name: t('col.together'),
            kapazitaet: gesamtKapazitaet, belegt: gesamtBelegt, frei: gesamtKapazitaet - gesamtBelegt
        },
        // DER BEFUND, DEN DIE TAFEL ZEIGT, IN EINEM SATZ: die Nachfrage ist
        // ueber alle zehn Stationen fast gleich (die Spanne der Abgaenge ist
        // schmal), die Unterschiede stecken ausschliesslich im Saldo. Genau
        // das ist der Grund, warum die Groessenspalte hier die Kapazitaet
        // zeigt und nicht die Fahrtenzahl: zehn nahezu gleich lange Balken
        // waeren eine wahre, aber nutzlose Grafik.
        fussnote: abgaengeAlle.length > 0
            ? t('board.stationsFootnote', {
                min: zahlFormat(Math.min(...abgaengeAlle)), max: zahlFormat(Math.max(...abgaengeAlle))
            })
            : null
    };
}

function stationMaske(station) {
    // Eine vorherige Detailkarte (falls #detailmaske gerade eine
    // Leaflet-Karte einer ANDEREN Station zeigt) muss VOR zeigeMaske()
    // weg - zeigeMaske() leert #detailmaske gleich per replaceChildren(),
    // danach waere ihr Container nicht mehr im Baum auffindbar und die
    // Leaflet-Instanz liefe als Leiche mit eigenen Fenster-Listenern
    // weiter (siehe stationenKarteAltEntfernen() bei stationenKarteZeichnen()
    // unten).
    stationenKarteAltEntfernen(document.getElementById('detailmaske'));

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

    // VIER zusaetzliche Abschnitte UNTER der von zeigeMaske() gebauten
    // Grundmaske - dieselbe Machart wie monatsdrilldownEinfuegen() in
    // auswertungen.js (dort async wegen eines eigenen Nachladens, hier
    // SYNCHRON: die Daten liegen bereits vollstaendig in
    // stationenRaederAlle/stationenVerkehrAlle/stationenAlle, siehe
    // Kopfkommentar dieser Datei). #detailmaske wurde von zeigeMaske()
    // gerade erst geleert und neu gefuellt (replaceChildren, siehe dort) -
    // die folgenden append()-Aufrufe haengen sich dahinter an, sie
    // ersetzen nichts. Karte VOR Raeder/Verkehr: "wo liegt sie, wie voll
    // ist sie" gehoert zusammen mit dem Belegungsdonut direkt darueber,
    // bevor die beiden operativen Tabellen folgen (zweiter Auftrag:
    // "die Karte mit dem eingetragenen Standort, wenn ich auf Details
    // gehe").
    const wurzel = document.getElementById('detailmaske');
    wurzel.append(stationBelegungAbschnitt(station));
    wurzel.append(stationDetailkarteAbschnitt(station));
    wurzel.append(stationRaederAbschnitt(station));
    wurzel.append(stationVerkehrAbschnitt(station));
}

// ===== Belegung (Gestaltungsauftrag Punkt 2) =====
//
// "Wenn ich auf die Details einer Station klicke, will ich da ein
// Donut-Chart fuer die Belegung sehen, 100 % ist die Kapazitaet" -
// woertlich der Auftrag. Die Skala ist hier fuer JEDE Station eine
// ANDERE Zahl (ihre eigene Kapazitaet) - der Donut sagt das selbst in
// seinem aria-label, damit niemand die 100 % dieser einen Station mit den
// 100 % des ganzen Netzes verwechselt, das die Kopftafel am Kopf der
// Liste in ihrer Zeile "Zusammen" ausweist.
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

// ===== Landkarte in der Detailmaske (zweiter Auftrag, wörtlich: "Mir
// fehlt außerdem immer noch die Karte mit dem eingetragenen Standort,
// wenn ich auf Details gehe.") =====
//
// Es GAB bereits eine Karte (stationenKarteZeichnen() oben, im eigenen
// Unterreiter "Landkarte") - der Auftrag will sie ZUSAETZLICH in der
// Detailmaske EINER Station, nicht eine zweite, eigens dafuer gezeichnete
// Karte ("Benutze sie, statt eine zweite Karte zu bauen"). Dieselbe
// Funktion wird deshalb HIER wiederverwendet, nur mit anderen Argumenten:
//
// AUSSCHNITT: nicht alle zehn Stationen zu gleichen Teilen, sondern diese
// EINE Station plus ihre STATIONDETAILKARTE_NACHBARN naechsten Nachbarn
// nach Luftlinie - bei zehn Stationen auf engem Stadtgebiet wuerde "alle
// zehn" praktisch dieselbe Ausdehnung zeigen wie die Uebersichtskarte und
// nichts vom "diese eine Station" vermitteln; alle zehn WEGZULASSEN bis
// auf die eine wuerde umgekehrt genau die Nachbarn verstecken, die laut
// Auftrag beim Umraeumen helfen ("sie zu zeigen hilft der Disposition,
// weil man sieht, wohin man umräumen kann"). Vier Nachbarn plus die
// Station selbst treffen diese Mitte.
// MASSSTAB: kleinere Zeichenflaeche als die Uebersichtskarte (siehe
// .stationdetailkarte .stationenkarte-leaflet-wrapper in style.css) -
// sie sitzt in der schmaleren Detailmaske, nicht in der vollen
// Arbeitsliste.
// HERVORHEBUNG: ein Ring in --rot um GENAU die angezeigte Station (siehe
// optionen.hervorgehobenId bei stationenKarteZeichnen()) - ohne ihn waere
// unter fuenf gleich gezeichneten Donut-Marken nicht zu erkennen, "das
// bin ich".
// KEIN Kundenschalter hier (anders als die Uebersichtskarte): diese Karte
// beantwortet "wo liegt diese Station und wer ist in der Naehe, um
// umzuraeumen", keine Marktgebiets-Frage - ein zweiter, hier ungenutzter
// Schalter waere Zierrat.
const STATIONDETAILKARTE_NACHBARN = 4;

function stationDetailkarteAbschnitt(station) {
    const abschnitt = document.createElement('section');
    abschnitt.className = 'stationdetailkarte';

    const ueberschrift = document.createElement('h3');
    ueberschrift.textContent = t('tile.stationMap');
    abschnitt.append(ueberschrift);

    if (station.latitude == null || station.longitude == null) {
        // KEIN theoretischer Fall: station_lat_chk/-lon_chk (0003_bereich_
        // b_netz_und_flotte.sql) lauten ausdruecklich "latitude is null OR
        // ... between -90 and 90" - eine Station OHNE Koordinaten ist in
        // diesem Schema gueltig, nicht nur denkbar. stationenKarteZeichnen()
        // ueberspringt eine solche Station bereits stillschweigend (siehe
        // dort); diese Detailkarte braucht dieselbe Absicherung, sonst
        // stuende hier eine "leere Flaeche, die wie ein Fehler aussieht" -
        // genau das verbietet dieselbe Regel wie bei stationRaederAbschnitt()/
        // stationVerkehrAbschnitt() oben.
        const hinweis = document.createElement('p');
        hinweis.className = 'stationdetailkarte-leer';
        hinweis.textContent = t('tile.noStationLocation');
        abschnitt.append(hinweis);
        return abschnitt;
    }

    const erklaerung = document.createElement('p');
    erklaerung.className = 'stationenkarte-erklaerung';
    // Zwei Saetze: WAS die Marken bedeuten (map.mapNote, dieselbe
    // Erklaerung wie auf der Uebersichtskarte) UND, zusaetzlich, WORIN
    // sich dieser Ausschnitt von ihr unterscheidet (Auftrag: "Ueberleg,
    // was in einer Detailkarte anders ist ... Ausschnitt").
    erklaerung.textContent = `${t('map.mapNote')} ${t('map.detailAreaNote')}`;
    abschnitt.append(erklaerung);

    // Naechste Nachbarn nach Luftlinie, mit einer Laengengrad-Korrektur
    // (kappa bei der Breite DIESER Station - ein Laengengrad ist bei rund
    // 49.8 Grad Nord nur noch cos(49.8°) so lang wie ein Breitengrad, wer
    // beides gleich gewichtet, verzerrt die Distanz). Das ist reine
    // Sortierung nach Entfernung fuer NACHBARSCHAFT (nicht das Zeichnen
    // der Karte selbst - das erledigt jetzt Leaflets eigene Projektion,
    // siehe stationenKarteZeichnen() unten) - dafuer genuegt eine lokale
    // Naeherung, eine exakte Grosskreisdistanz waere fuer 10 km
    // Stadtgebiet unnoetiger Aufwand.
    const kappa = Math.cos((Number(station.latitude) * Math.PI) / 180);
    const nachbarnMitAbstand = stationenAlle
        .filter((s) => s.station_id !== station.station_id && s.latitude != null && s.longitude != null)
        .map((s) => {
            const dLat = Number(s.latitude) - Number(station.latitude);
            const dLon = (Number(s.longitude) - Number(station.longitude)) * kappa;
            return { station: s, distanzQuadrat: dLat * dLat + dLon * dLon };
        })
        .sort((a, b) => a.distanzQuadrat - b.distanzQuadrat)
        .slice(0, STATIONDETAILKARTE_NACHBARN)
        .map((e) => e.station);

    const ausschnittStationen = [station, ...nachbarnMitAbstand];

    const kartenflaeche = document.createElement('div');
    kartenflaeche.className = 'stationenkarte-flaeche';
    kartenflaeche.append(stationenKarteZeichnen(ausschnittStationen, [], false,
        { hoehe: 320, hervorgehobenId: station.station_id }));
    abschnitt.append(kartenflaeche);

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

// ===== Landkarte (Gestaltungsauftrag Punkt 4, jetzt mit Leaflet) =====
//
// "Mir fehlen Landkarten für die Stationen, ich möchte eine neue Sicht
// haben, in der die Standorte auch als Landkarten visualisiert sind und
// sich zusätzlich die Kunden einblenden lassen" - woertlich der Auftrag.
//
// FRUEHER SELBST GEZEICHNETES SVG, JETZT LEAFLET - der Auftraggeber,
// woertlich, zu jener ersten Fassung: "warum verwendest du keine Karte
// wie Leaflet und machst die Karte selber? Das macht null Sinn." Er hat
// recht: eine schematische Flaeche ohne Strassen beantwortet "wo ist
// diese Station" gerade nicht. Die damalige Projektregel ("keine
// Abhaengigkeit ausser supabase-js", didaktisch begruendet) gilt fuer
// eine KARTE nicht mehr - die Abkehr und ihre Begruendung stehen
// ausfuehrlich in doku/plans/2026-08-25-velocity-warenwirtschaft-oberflaeche.md
// (dort auch, warum die Regel fuer ALLES ANDERE weiterhin gilt), die
// Datenschutz-Abwaegung unten in doku/datenmodell/08-warenwirtschaft.md.
//
// WAS AUS DER SVG-FASSUNG ERHALTEN BLEIBT (der fachliche Gehalt, nicht
// die Zeichnung):
//   - KREISGROESSE = KAPAZITAET, FUELLUNG = BELEGUNG: donut() aus
//     rahmen.js, unveraendert wiederverwendet - nur nicht mehr direkt in
//     ein <svg> gezeichnet, sondern als HTML-Marke in eine Leaflet-
//     L.divIcon eingesetzt (stationenKarteStationsMarke() unten). Leaflet
//     erlaubt options.html als ECHTES Element statt eines HTML-Strings -
//     donut() baut ohnehin per DOM-API, kein Text aus der Datenbank lief
//     hier je durch innerHTML.
//   - KUNDSCHAFT AGGREGIERT JE ORT, NIE JE PERSON: v_wawi_kundenorte,
//     dieselbe Begruendung wie zuvor (siehe deren Kopfkommentar in
//     0018_wawi_sichten.sql) - einzelne Wohnadressen als Punkte waeren
//     das Wohnprofil, das diese Fallstudie ausdruecklich fernhaelt.
//   - DIE HERVORHEBUNG der angezeigten Station in der Detailkarte (ein
//     Ring in --rot, jetzt ein eigener, nicht interaktiver
//     L.circleMarker UNTER der Donut-Marke).
//   - TASTATURBEDIENUNG UND ZUGAENGLICHE NAMEN je Marke (siehe
//     stationenKarteStationsMarke()/stationenKarteKundenortMarke()
//     unten) - Leaflets EIGENE Bedienelemente (Zoom, Kartenfokus fuer
//     Pfeiltasten-Navigation) sind serienmaessig per Tastatur erreichbar;
//     der Zoom-Regler bekommt hier nur lokalisierte Titel (map.zoomIn/
//     -Out) statt der englischen Vorgabe.
//
// DIE FREMDANFRAGE - EINE ABWAEGUNG, KEINE WARNUNG: jede Kartenkachel
// ist eine eigene HTTP-Anfrage des Mitarbeitenden-Browsers an einen
// fremden Server (hier: OpenStreetMap, siehe STATIONENKARTE_KACHELN
// unten), der dabei IP-Adresse UND den betrachteten Kartenausschnitt
// erfaehrt - in einer Fallstudie, die sonst Datensparsamkeit lehrt, eine
// bewusste Abwaegung: eine brauchbare Karte GEGEN diese eine
// Fremdanfrage. Dieselbe Abwaegung steht ausfuehrlich in
// doku/datenmodell/08-warenwirtschaft.md; die konkrete Ladestelle traegt
// unten in stationenKarteInitialisieren() ihren eigenen Kommentar. Der
// Kundenschalter unten aendert NICHTS an dieser Anfrage - er entscheidet
// nur, welche EIGENEN Marken (aus bereits geladenen Daten) auf der
// ohnehin geladenen Karte erscheinen, er sendet selbst nichts
// Zusaetzliches an den Kachelserver.
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
    // Eine vorherige Uebersichtskarte (falls #arbeitsliste gerade schon
    // eine Leaflet-Karte zeigt, etwa nach einem Reiterwechsel zurueck zu
    // "Landkarte") muss VOR replaceChildren() weg - siehe
    // stationenKarteAltEntfernen() unten.
    stationenKarteAltEntfernen(wurzel);
    wurzel.replaceChildren();

    const rahmen = document.createElement('div');
    rahmen.className = 'stationenkarte';

    const kopf = document.createElement('div');
    kopf.className = 'stationenkarte-kopf';

    const erklaerung = document.createElement('p');
    erklaerung.className = 'stationenkarte-erklaerung';
    erklaerung.textContent = t('map.mapNote');
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
        // Die ALTE Karte (mit oder ohne Kundschaft) traegt eine eigene
        // Leaflet-Instanz, die replaceChildren() unten aus dem Baum
        // nimmt, ohne sie selbst aufzuraeumen - siehe
        // stationenKarteAltEntfernen().
        stationenKarteAltEntfernen(kartenflaeche);
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

// Leaflet raeumt eigene Fensterlistener/laufende Kachel-Anfragen nur bei
// einem echten .remove() auf - ein blosses Entfernen des Kartenbehaelters
// aus dem DOM (replaceChildren(), an allen Aufrufstellen oben/unten)
// taete das NICHT von selbst, das waere ein Leck bei jedem Kartenwechsel.
// behaelter: der ELTERNKNOTEN, der die alte Karte (falls vorhanden) noch
// enthaelt - stationenKarteZeichnen() unten haengt die L.map-Instanz
// dazu als Eigenschaft an ihr <div class="stationenkarte-leaflet">, kein
// zweiter, getrennt zu pflegender Verweis irgendwo im Modul.
function stationenKarteAltEntfernen(behaelter) {
    behaelter?.querySelector?.('.stationenkarte-leaflet')?._leafletKarte?.remove();
}

// Kachelquelle: OpenStreetMap direkt (kein Drittanbieter-Dienst dazwischen -
// weniger Parteien, die den Kartenausschnitt sehen). Die exakte URL UND
// dass Browser die Nutzungsbedingungen automatisch erfuellen (User-Agent,
// Referer, Caching - siehe operations.osmfoundation.org/policies/tiles),
// stehen in deren Tile Usage Policy; fuer den Umfang dieser Fallstudie
// (eine Handvoll Mitarbeitende, keine Massennutzung) bleibt das
// ausdruecklich erlaubte "leichte Nutzung". Einzige eigene Pflicht: eine
// sichtbare Quellenangabe (STATIONENKARTE_ATTRIBUTION unten) - Leaflet
// zeigt sie automatisch unten rechts (attributionControl, Vorgabe).
const STATIONENKARTE_KACHELN = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

// "© OpenStreetMap contributors" bleibt UNVERAENDERT in jeder Sprache -
// dieselbe Entscheidung wie bei "WaWi" in der Wortmarke (siehe
// index.html): eine Quellenangabe ist kein Oberflaechentext, sondern ein
// von OpenStreetMap selbst vorgeschlagener, feststehender Wortlaut.
const STATIONENKARTE_ATTRIBUTION =
    '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors';

// Wuerzburg, Marktplatz - Standardausschnitt NUR fuer den Randfall "keine
// einzige Station/Kundschaft traegt eine Koordinate" (station_lat_chk/
// -lon_chk in 0003_bereich_b_netz_und_flotte.sql erlauben das
// ausdruecklich, siehe stationDetailkarteAbschnitt() oben) - map.fitBounds()
// wirft ohne mindestens einen Punkt eine Exception, ein fester Ausschnitt
// faengt das ab, ohne die Karte deshalb leer bleiben zu lassen.
const STATIONENKARTE_STANDARDMITTE = [49.7913, 9.9534];
const STATIONENKARTE_STANDARDZOOM = 12;

// stationen: fuer die Stationsmarken, IMMER gezeichnet.
// kundenorte: v_wawi_kundenorte-Zeilen, nur bei kundenSichtbar gezeichnet
// UND in die Kartenausdehnung einbezogen (map.fitBounds() unten) - sonst
// laegen Orte wie Karlstadt oder Marktheidenfeld (deutlich ausserhalb der
// Stationsspanne) ausserhalb des sichtbaren Bereichs, sobald der Schalter
// sie einblendet.
//
// optionen.hoehe (Vorgabe 460, die Uebersichtskarte): DIESELBE Funktion
// wird auch fuer die Detailkarte einer einzelnen Station wiederverwendet
// (stationDetailkarteAbschnitt() weiter oben) - dort sitzt sie in der
// schmaleren Detailmaske statt in der vollen Arbeitsliste und bekommt
// deshalb eine kleinere Hoehe uebergeben, KEINE zweite, eigens gezeichnete
// Karte (Auftrag: "Benutze sie, statt eine zweite Karte zu bauen"). Die
// BREITE braucht (anders als bei der fruehreren SVG-Fassung) keinen
// eigenen Parameter mehr - style.css regelt sie ueber max-width je
// Kontext (.stationenkarte-leaflet-huelle bzw. .stationdetailkarte
// .stationenkarte-leaflet-huelle), Leaflet selbst verlangt nur eine feste
// PIXELHOEHE (unten als inline style gesetzt), keine feste Breite.
// optionen.hervorgehobenId: station_id der Station, die zusaetzlich zu
// ihrer Donut-Marke einen Ring in --rot bekommt ("hier hinsehen") - fuer
// die Detailkarte GENAU die Station, deren Maske gerade offen ist; in der
// Uebersichtskarte bleibt der Parameter weg (null).
function stationenKarteZeichnen(stationen, kundenorte, kundenSichtbar, optionen = {}) {
    const { hoehe = 460, hervorgehobenId = null } = optionen;

    const huelle = document.createElement('div');
    huelle.className = 'stationenkarte-leaflet-huelle';

    if (typeof L === 'undefined') {
        // Das Leaflet-<script> selbst kam nicht an (CDN blockiert, kein
        // Netz beim ersten Laden der Seite) - eine leere Flaeche saehe
        // wie ein eigener Fehler dieser Anwendung aus (Auftrag): Text
        // statt Stille, dieselbe Haltung wie bei jedem anderen
        // Ladefehler dieser Oberflaeche (siehe stationRaederAbschnitt()/
        // stationVerkehrAbschnitt() oben).
        const hinweis = document.createElement('p');
        hinweis.className = 'stationenkarte-fehler';
        hinweis.textContent = t('map.libraryUnavailable');
        huelle.append(hinweis);
        return huelle;
    }

    // role="group", NICHT role="img": diese Karte hat anklickbare
    // Stationsmarken - ein "img" behauptet fuer einen Screenreader ein
    // einziges, flaches Bild und wuerde interaktive Kinder unerreichbar
    // machen. Jede einzelne Marke traegt zusaetzlich ihr EIGENES
    // aria-label (siehe stationenKarteStationsMarke() unten).
    huelle.setAttribute('role', 'group');
    huelle.setAttribute('aria-label', kundenSichtbar
        ? t('map.areaWithCustomers', { stationenPhrase: mengeFormat(stationen.length, 'station') })
        : t('map.area', { stationenPhrase: mengeFormat(stationen.length, 'station') }));

    const flaeche = document.createElement('div');
    flaeche.className = 'stationenkarte-leaflet';
    // Leaflet verlangt eine feste PIXELHOEHE seines Behaelters (eine
    // Prozenthoehe allein funktioniert bei ihm nicht zuverlaessig) - die
    // Breite bleibt bewusst der CSS-Klasse ueberlassen (siehe
    // Kopfkommentar oben).
    flaeche.style.height = `${hoehe}px`;
    huelle.append(flaeche);

    const kachelhinweis = document.createElement('p');
    kachelhinweis.className = 'stationenkarte-kachelhinweis';
    kachelhinweis.textContent = t('map.tilesUnavailable');
    kachelhinweis.hidden = true;
    huelle.append(kachelhinweis);

    // Leaflet braucht eine im Dokument ANGEHAENGTE, layoutete Flaeche fuer
    // eine sinnvolle Groesse (getBoundingClientRect() eines noch nicht
    // eingehaengten Elements ist 0x0) - der Aufrufer haengt "huelle" aber
    // erst NACH dieser Funktion ein (siehe stationenKarteZeigen()/
    // stationDetailkarteAbschnitt()). Ein requestAnimationFrame laeuft
    // nach dem naechsten Layout, also nach dem synchronen append()-Aufruf
    // des Aufrufers, der im selben Makrotask folgt.
    requestAnimationFrame(() => {
        stationenKarteInitialisieren(flaeche, kachelhinweis, stationen, kundenorte, kundenSichtbar, hervorgehobenId);
    });

    return huelle;
}

function stationenKarteInitialisieren(flaeche, kachelhinweis, stationen, kundenorte, kundenSichtbar, hervorgehobenId) {
    const karte = L.map(flaeche, {
        // Eine eingebettete Karte in einer scrollbaren Seite: das
        // Mausrad soll die SEITE scrollen, nicht ungefragt in die Karte
        // hineinzoomen, sobald der Zeiger sie nur ueberquert. Erst ein
        // bewusster Klick/Tastaturfokus aktiviert das Rad wieder (siehe
        // die beiden Ereignisse unten) - derselbe, in Leaflets eigener
        // Anleitung empfohlene Griff fuer Karten, die nicht die ganze
        // Seite einnehmen.
        scrollWheelZoom: false,
        zoomControl: false
    });
    // Verweis fuer stationenKarteAltEntfernen() - siehe dortiger
    // Kommentar: die Karte haengt sich selbst an ihren Behaelter, kein
    // zweiter, getrennt zu pflegender Speicherort im Modul.
    flaeche._leafletKarte = karte;

    karte.on('focus', () => karte.scrollWheelZoom.enable());
    karte.on('blur', () => karte.scrollWheelZoom.disable());

    // zoomControl:false oben + eigener Aufruf hier: NUR damit
    // zoomInTitle/zoomOutTitle lokalisiert sind (map.zoomIn/-Out) statt
    // der englischen Leaflet-Vorgabe "Zoom in"/"Zoom out" - die
    // Oberflaeche ist sechssprachig, ein automatisch mitgeliefertes
    // Bedienelement darf davon nicht ausgenommen bleiben.
    L.control.zoom({ zoomInTitle: t('map.zoomIn'), zoomOutTitle: t('map.zoomOut') }).addTo(karte);
    L.control.scale({ metric: true, imperial: false }).addTo(karte);

    // DIE STELLE, DIE DIE KACHELN LAEDT (siehe Kopfkommentar bei
    // stationenKarteZeigen() oben und die ausfuehrliche Abwaegung in
    // doku/datenmodell/08-warenwirtschaft.md): jede Kachel ist eine
    // eigene HTTP-Anfrage des Mitarbeitenden-Browsers an OpenStreetMap,
    // die dabei IP-Adresse und den betrachteten Kartenausschnitt
    // mitteilt. Bewusste Abwaegung, keine versehentliche Nebenwirkung:
    // eine brauchbare Karte gegen genau diese eine Fremdanfrage.
    let kachelnGeladen = 0;
    const kacheln = L.tileLayer(STATIONENKARTE_KACHELN, {
        maxZoom: 19,
        attribution: STATIONENKARTE_ATTRIBUTION
    });
    kacheln.on('tileload', () => {
        kachelnGeladen++;
        kachelhinweis.hidden = true;
    });
    kacheln.on('tileerror', () => {
        // Erst nach einer kurzen Frist pruefen, nicht bei der ersten
        // einzelnen Fehlkachel: eine verlorene Kachel am Kartenrand ist
        // normaler Netzbetrieb, kein Totalausfall. Traf in der Frist
        // KEINE einzige Kachel ein (kein Netz, Tile-Server blockiert),
        // zeigt der Hinweis das - eine Karte, die dann leer und stumm
        // bliebe, saehe wie ein Fehler dieser Anwendung aus (Auftrag),
        // waehrend tatsaechlich nur der Kachelserver nicht erreichbar
        // war. Die Stationsmarken selbst haengen NICHT an den Kacheln
        // (siehe unten) und bleiben unabhaengig davon an der richtigen
        // Position sichtbar und bedienbar.
        setTimeout(() => {
            if (kachelnGeladen === 0) kachelhinweis.hidden = false;
        }, 4000);
    });
    kacheln.addTo(karte);

    // Kundenmarken ZUERST, Stationsmarken DARUEBER: eine Station soll
    // nie hinter einem grossen Kundenkreis verschwinden, auch wenn beide
    // geografisch nah beieinander liegen. Leaflets feste Pane-Reihenfolge
    // (Overlay-Pane fuer L.circleMarker liegt IMMER unter dem Marker-Pane
    // fuer L.marker/L.divIcon) erledigt das von selbst, unabhaengig von
    // der Reihenfolge der addTo()-Aufrufe unten.
    const punkte = [];
    if (kundenSichtbar) {
        const maxKunden = Math.max(1, ...kundenorte.map((o) => o.kunden));
        for (const ort of kundenorte) {
            if (ort.latitude == null || ort.longitude == null) continue;
            punkte.push([Number(ort.latitude), Number(ort.longitude)]);
            stationenKarteKundenortMarke(ort, maxKunden).addTo(karte);
        }
    }

    const kapazitaeten = stationen.map((s) => s.kapazitaet);
    const kapMin = Math.min(...kapazitaeten);
    const kapMax = Math.max(...kapazitaeten);
    for (const station of stationen) {
        if (station.latitude == null || station.longitude == null) continue;
        const latlng = [Number(station.latitude), Number(station.longitude)];
        punkte.push(latlng);

        const istHervorgehoben = hervorgehobenId != null && station.station_id === hervorgehobenId;
        if (istHervorgehoben) {
            // Ring in --rot HINTER der Donut-Marke (zweiter Auftrag:
            // "die Karte mit dem eingetragenen Standort, wenn ich auf
            // Details gehe") - ohne diesen Ring waere die eigene Station
            // unter ihren Nachbarn nicht von einer beliebigen anderen zu
            // unterscheiden.
            L.circleMarker(latlng, {
                radius: stationenKarteStationsDurchmesser(station.kapazitaet, kapMin, kapMax) / 2 + 5,
                className: 'stationenkarte-station-hervorhebung',
                interactive: false
            }).addTo(karte);
        }
        stationenKarteStationsMarke(station, kapMin, kapMax, istHervorgehoben).addTo(karte);
    }

    if (punkte.length > 0) {
        // maxZoom begrenzt nur den Randfall einer sehr engen Punktwolke
        // (etwa vier direkt benachbarte Stationen in der Detailkarte) -
        // ohne ihn zoomte fitBounds() dort so nah heran, dass der
        // "wer ist in der Naehe"-Zusammenhang selbst verloren ginge.
        karte.fitBounds(L.latLngBounds(punkte), { padding: [30, 30], maxZoom: 16 });
    } else {
        karte.setView(STATIONENKARTE_STANDARDMITTE, STATIONENKARTE_STANDARDZOOM);
    }
}

// Eine Stationsmarke: donut() (rahmen.js) traegt Groesse=Kapazitaet und
// Fuellung=Belegung unveraendert weiter, jetzt als L.divIcon statt
// direkt ins Karten-<svg> gezeichnet.
function stationenKarteStationsMarke(station, kapMin, kapMax, istHervorgehoben) {
    const durchmesser = stationenKarteStationsDurchmesser(station.kapazitaet, kapMin, kapMax);
    const voll = station.frei === 0;
    const beschriftung = t('map.stationBelegLabel', { name: station.name, belegt: zahlFormat(station.belegt), kapazitaet: zahlFormat(station.kapazitaet) })
        + (voll ? t('map.stationFullSuffix') : '')
        + (istHervorgehoben ? t('map.currentStationSuffix') : '')
        + t('map.openDetailsSuffix');

    // Weisse Scheibe HINTER dem Donut (per CSS auf .stationenkarte-
    // station-huelle): haelt die in donut() dokumentierten Kontrast-
    // messungen (siehe Kopfkommentar dort, "gegen Weiss gemessen") auch
    // jetzt noch gueltig, wo unter der Marke keine kontrollierte weisse
    // Seite mehr liegt, sondern eine Kartenkachel beliebiger Farbe.
    const huelle = document.createElement('div');
    huelle.className = 'stationenkarte-station-huelle';

    const markierung = donut(station.belegt, station.kapazitaet, beschriftung, {
        durchmesser,
        dicke: Math.max(4, durchmesser * 0.16),
        farbe: voll ? 'var(--warnung-text)' : 'var(--marine)'
    });
    // role/aria-label des Donuts hier ABSICHTLICH stummgeschaltet: der
    // Leaflet-Marker selbst traegt gleich die vollstaendige Beschriftung
    // UND die Klick-/Tastaturbedienung (title/alt unten plus
    // options.keyboard) - ein Screenreader soll "Hauptbahnhof: 28 von 40
    // ... Details oeffnen" genau EINMAL hoeren.
    markierung.removeAttribute('role');
    markierung.setAttribute('aria-hidden', 'true');
    huelle.append(markierung);

    // options.html als ECHTES Element (kein HTML-String): Leaflet haengt
    // es per appendChild an, ohne innerHTML - wichtig, weil station.name
    // zwar keine Freitext-Schadensmeldung ist, aber trotzdem aus der
    // Datenbank stammt (siehe Hausregel).
    const icon = L.divIcon({
        html: huelle,
        // EIGENE Klasse statt der Leaflet-Vorgabe 'leaflet-div-icon' -
        // die brächte ein weisses Kaestchen mit grauem Rahmen mit
        // (.leaflet-div-icon in leaflet.css), das unsere runde,
        // schattierte Huelle nur verdeckt haette.
        className: 'stationenkarte-station-icon',
        iconSize: [durchmesser, durchmesser],
        iconAnchor: [durchmesser / 2, durchmesser / 2]
    });

    const marke = L.marker([Number(station.latitude), Number(station.longitude)], {
        icon,
        keyboard: true,
        // title setzt die native .title-Eigenschaft (Mauszeiger-Tooltip),
        // KEIN innerHTML - noetig, weil donut() bei dieser Markengroesse
        // (30-58px) den Prozentwert selbst ausblendet (siehe
        // .stationenkarte-station-huelle .donut-text-prozent in
        // style.css), eine sehende Maus-Bedienung braucht trotzdem einen
        // Weg an die Zahl.
        title: beschriftung,
        alt: beschriftung
    });

    // Name UND Tastaturbedienung erst NACH dem Einhaengen setzbar -
    // getElement() liefert vor 'add' noch nichts (Leaflet erzeugt das
    // Icon-Element erst dann).
    marke.on('add', () => {
        const element = marke.getElement();
        element.setAttribute('aria-label', beschriftung);
        // Enter UND Leertaste: dieselben beiden Tasten, mit denen ein
        // <button> nativ ausgeloest wird - Leaflets eigener role="button"
        // (options.keyboard, siehe oben) verspricht diese Bedienung, ohne
        // sie fuer ein <div> von selbst umzusetzen.
        element.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                stationMaske(station);
            }
        });
    });
    marke.on('click', () => stationMaske(station));

    // <text>-Beschriftung der SVG-Fassung ersetzt durch eine dauerhaft
    // sichtbare Leaflet-Tooltip - aria-hidden, weil element.aria-label
    // oben (bzw. das title-Attribut) den Namen bereits vollstaendig
    // vorliest bzw. anzeigt; diese Zahl ist ein rein sehendes
    // Schnellueberblick-Hilfsmittel.
    const nummer = document.createElement('span');
    nummer.setAttribute('aria-hidden', 'true');
    nummer.textContent = station.stationsnummer;
    marke.bindTooltip(nummer, {
        permanent: true,
        direction: 'bottom',
        offset: L.point(0, durchmesser / 2 + 2),
        className: 'stationenkarte-station-text',
        interactive: false
    });

    return marke;
}

// Eine Kundenort-Marke: Flaeche = Kundenzahl (flaechenproportional, siehe
// stationenKarteKundenRadius() unten), plus eine sichtbare Zahl daneben -
// "ein Kreis ohne Zahl waere eine Schaetzaufgabe" (derselbe Grundsatz wie
// bei donut(), hier auf die Kundenmarke uebertragen: Wuerzburg (573)
// gegen Karlstadt (9) sind aus der Flaeche allein nicht sicher
// auseinanderzuhalten).
function stationenKarteKundenortMarke(ort, maxKunden) {
    const radius = stationenKarteKundenRadius(ort.kunden, maxKunden);
    const beschriftung = t('map.customersAtLocation', { ort: ort.ort, kundenPhrase: mengeFormat(ort.kunden, 'kunde') });

    const kreis = L.circleMarker([Number(ort.latitude), Number(ort.longitude)], {
        radius,
        className: 'stationenkarte-kundenort-kreis',
        // interactive:false: dieselbe Behandlung wie zuvor die <g> im
        // SVG - ein Klick hier loeste nie etwas aus, nur role="img" samt
        // aria-label (unten, nach dem Einhaengen gesetzt) machen die
        // Zahl fuer einen Screenreader auffindbar.
        interactive: false
    });
    kreis.on('add', () => {
        const element = kreis.getElement();
        element?.setAttribute('role', 'img');
        element?.setAttribute('aria-label', beschriftung);
    });

    const zahl = document.createElement('span');
    zahl.setAttribute('aria-hidden', 'true');   // role="img" oben traegt die Bedeutung bereits vollstaendig
    zahl.textContent = t('map.customerLabelShort', { ort: ort.ort, n: zahlFormat(ort.kunden) });
    kreis.bindTooltip(zahl, {
        permanent: true,
        direction: 'bottom',
        offset: L.point(0, radius),
        className: 'stationenkarte-kundenort-text',
        interactive: false
    });

    return kreis;
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
