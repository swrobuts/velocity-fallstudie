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
    // weil er wie ein Fehler aussieht und keiner ist. 'demo'
    // (0020_demo_zugang.sql) dazu: die Sicht laesst sie seit dem
    // Demozugang zusaetzlich zu, und die schreibenden Knoepfe dieses
    // Bereichs bleiben ihr trotzdem verwehrt - sie haengen an
    // darfRolle('disposition')/('werkstatt'), keine davon ist 'demo'.
    rollen: ['disposition', 'werkstatt', 'leitung', 'demo'],
    aufbauen: flotteAufbauen,
    // EINE SUCHE, IN JEDEM BEREICH (Gestaltungsauftrag Punkt 5, siehe
    // spaltenkopfSuchtext in rahmen.js): das Feld in der Kopfleiste stand
    // hier bis zu diesem Umbau abgeschaltet da ("In diesem Bereich keine
    // Suche"). Die Flotte laedt alle 275 Raeder auf einmal - der
    // Tabellenbaustein kann darueber suchen, ohne dass etwas
    // nachgeladen werden muesste; kein sucheSelbst noetig.
    suchePlatzhalterSchluessel: 'nav.flotteSuche'
});

// ===== HIER STAND DER EIGENE FILTERZUSTAND DER FLOTTE =====
//
// Drei modulweite Sets (Status, Radtyp, Standort) und eine eigene
// Filterleiste ueber der Liste. Beide sind mit Punkt 5 des
// Gestaltungsauftrags entfallen - NICHT die Filter selbst, nur ihr Ort:
// sie sitzen jetzt in den Spaltenkoepfen Status, Radtyp und Standort,
// wo die Werte ohnehin stehen (siehe spaltenkopfFilterknopf() in
// rahmen.js).
//
// WARUM DAS DER RICHTIGE ORT IST, und nicht bloss ein anderer: alle drei
// filterten CLIENTSEITIG ueber genau die Spalten, die zwei Zentimeter
// darunter in der Tabelle stehen. Sie waren damit ein ZWEITES
// Bedienelement fuer dasselbe Feld - und genau deshalb mussten dieselben
// drei Spalten bisher filterbar:false tragen, damit sich die beiden nicht
// widersprechen konnten. Ein Filter, der einen anderen abschalten muss,
// um nicht zu luegen, steht am falschen Platz. Jetzt gibt es je Feld
// genau EIN Bedienelement, und es sitzt an seiner Spalte.
//
// WAS DABEI NICHT VERLOREN GEHT:
//   · Mehrfachauswahl - der Spaltenkopf-Filter ist fuer Auswahlspalten
//     dieselbe Mehrfachauswahl (mehrfachauswahlEintraege() in rahmen.js,
//     aus dem gemeinsamen Baustein herausgeloest).
//   · Der Sonderfall "unterwegs, kein Standort" - v_wawi_flotte liefert
//     standort NULL, solange ein Rad faehrt. Er war der einzige echte
//     Grund, den Standortfilter von Hand zu bauen; der Baustein bietet
//     leere Werte jetzt selbst als eigenen Auswahlpunkt an und
//     beschriftet ihn ueber formatieren(null) - also mit genau dem Wort,
//     das auch in der Tabellenzelle steht (siehe die Spalte 'standort'
//     weiter unten und t('common.filterEmpty') in rahmen.js).
//   · Das Wiederfinden ueber einen Neuaufbau hinweg - der Baustein haelt
//     Sortierung, Gruppierung und Filter an derselben Spaltensignatur
//     fest (siehe zeigeListe() in rahmen.js).
//
// WAS SICH AENDERT: ein BEREICHSWECHSEL setzt die Filter jetzt zurueck
// (andere Spaltensignatur), waehrend die eigenen Sets ihn ueberlebten.
// Bewusst in Kauf genommen: dieselbe Regel gilt damit fuer alle fuenf
// Bereiche, statt fuer die Flotte eine eigene.

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
    // 275 Zeilen unnoetig, und die Kopftafel (die den GESAMTEN Bestand
    // gliedern soll, nicht die gefilterte Teilmenge) braucht die
    // vollstaendige Liste ohnehin.
    // KEINE ZWEITE ANFRAGE fuer den Kopf: die Kopftafel gliedert nach
    // Modell, Status und Baujahr - alle drei Angaben stehen bereits in
    // dieser einen Zeile (v_wawi_flotte reicht sie aus fahrradmodell und
    // fahrradtyp durch). Die fuenf Modellzeilen des Kopfes (ein Produkt
    // je Typ, aber je Hersteller eine eigene Zeile) und die 275 Radzeilen
    // der Liste kommen damit aus DERSELBEN Ladung, koennen also nicht
    // auseinanderlaufen.
    const raeder = await ladeListe('v_wawi_flotte',
        'fahrrad_id, rahmennummer, typ_code, typ, hersteller, modell, status, ' +
        'angeschafft_am, standort, akkustand_prozent, letzte_wartung, ' +
        'offene_schaeden, hoechste_schwere, baujahr, gewicht_kg, gangzahl, ' +
        'rahmenhoehe_cm, akkukapazitaet_wh, reichweite_km',
        (q) => q.order('rahmennummer'));

    const fehler = letzterLadeFehler('v_wawi_flotte');
    if (fehler) {
        // meldeVorgang statt melde: ist dieser Aufruf inzwischen
        // veraltet (ueberholt oder der Bereich gewechselt), gehoert auch
        // sein eigener Ladefehler nicht mehr zur Gegenwart - siehe
        // Kommentar bei meldeVorgang() in rahmen.js (Befund 2).
        zeigeKopftafel(vorgang, null);
        meldeVorgang(vorgang, t('msg.fleetLoadFailed', { fehler }), 'schlecht');
        return;
    }

    // Die Uebersicht (Punkt 1) beschreibt IMMER die ganze Flotte, nie die
    // gefilterte Teilmenge - "womit oeffnet jemand diesen Bereich" ist
    // eine Frage an den Gesamtbestand, nicht an eine gerade gewaehlte
    // Einschraenkung.
    zeigeKopftafel(vorgang, flotteKopftafel(raeder));

    // KEINE eigene Leermaske mehr fuer "kein Treffer": den Fall behandelt
    // seit dem Umzug der Filter in den Spaltenkopf der Tabellenbaustein
    // selbst (baueLeerzeile() in rahmen.js) - und er behandelt ihn
    // BESSER. zeigeLeermaske() ersetzte den kompletten Inhalt der
    // Arbeitsliste; das war richtig, solange der Filter in einer eigenen
    // Leiste DARUEBER sass und stehenblieb. Jetzt steckt er IM
    // Tabellenkopf - ihn mit wegzuraeumen hiesse, dass niemand den zu
    // engen Filter mehr feinjustieren, sondern ihn nur noch komplett
    // zuruecksetzen koennte. Die schlanke Leerzeile INNERHALB der Tabelle
    // laesst Kopf und Filter unangetastet und bietet denselben Rueckweg.

    // Fuenfter Parameter radZeilenAktionen (Punkt 5 der Gestaltung, Beleg
    // fuer den neuen Baustein in rahmen.js): dieselben Handlungen wie in
    // radMaske() unten, nur als Icons statt als Knoepfe in der offenen
    // Maske - wer nur den Status setzen oder ausmustern will, muss die
    // Zeile dafuer nicht erst oeffnen. Siehe radHandlungen() weiter
    // unten fuer die gemeinsame Grundlage beider Darstellungen.
    // filterbar:false ist bei status/typ/standort ERSATZLOS ENTFALLEN
    // (Gestaltungsauftrag Punkt 5): es stand dort nur, weil dieselben drei
    // Felder eine zweite, eigene Filterleiste hatten und sich zwei
    // unabhaengige Filter auf demselben Feld widersprochen haetten. Die
    // Leiste ist weg, der Filter sitzt jetzt hier im Spaltenkopf - EIN
    // Feld, EIN Bedienelement, wie es die Regel immer schon verlangte.
    // Siehe den langen Kommentar an der Stelle, wo der Filterzustand
    // stand (oben in dieser Datei).
    // offene_schaeden: summierbar - eine echte Anzahl je Rad (kein
    // Durchschnitt, keine Ueberzaehlung ueber Zeitraeume wie bei
    // v_wawi_umsatz_kundengruppe.kunden, siehe auswertungen.js), die
    // Summe je Gruppe (z. B. alle Raeder mit Status "defekt") ist
    // fachlich sinnvoll.
    zeigeListe(vorgang, raeder, [
        { feld: 'rahmennummer',   titel: t('field.rahmennummer') },
        // EINE BENENNUNG FUER DEN RADTYP, UEBERALL (Befund der
        // Referenzangleichung): hier stand der typ_code ("CITY"),
        // waehrend die Filterleiste unmittelbar darueber und die
        // Kopftafel unmittelbar darueber beide den Produktnamen
        // ("City-Bike") fuehren - drei Stellen desselben Bildschirms,
        // zwei Vokabulare. Das Kuerzel war nie eine Ersparnis, die
        // jemand gefordert haette; es war das Feld, das beim Bau der
        // Liste am naechsten lag. v_wawi_flotte liefert beide Spalten
        // (siehe die Ladeanfrage oben), die Zeile kostet nichts.
        // Ebenso die Ueberschrift: t('field.radtyp') statt
        // t('field.typ') - dieselbe Spalte hiess in der Flotte "Typ",
        // in den Auswertungen "Radtyp" und in jeder Kopftafel "Radtyp".
        { feld: 'typ',            titel: t('field.radtyp') },
        { feld: 'status',         titel: t('field.status'), klasse: statusKlasse,
          formatieren: (wert) => statusAnzeige(wert) },
        // formatieren-Rueckfall auf misc.underway (Erprobung, Hinweis aus
        // dem Bild): standort ist NULL bei einem Rad in laufender Fahrt
        // (GR13 - unterwegs steht es nirgends) - fachlich richtig, sah in
        // der Spalte aber wie eine leere, fehlerhafte Zelle aus, weil die
        // Detailmaske (radMaske() weiter unten, Feld 'standort') diesen
        // Fall schon immer mit Text abfing, NUR diese eine
        // Tabellenspalte nicht.
        // formatieren(null) liefert "unterwegs" - dasselbe Wort steht
        // deshalb ohne weiteres Zutun als eigener Auswahlpunkt im
        // Filterfenster dieser Spalte (siehe spaltenkopfFilterInhalt() in
        // rahmen.js): der Sonderfall, den die alte Filterleiste von Hand
        // nachbauen musste, faellt hier von selbst richtig aus.
        { feld: 'standort',       titel: t('field.standort'),
          formatieren: (wert) => wert || t('misc.underway') },
        // klasse:'zahl' (Vorgabe der Arbeitstabelle, siehe
        // .arbeitstabelle td.zahl in style.css): eine Anzahl ist eine
        // Zahl und gehoert rechtsbuendig mit Tabellenziffern gesetzt,
        // wie jede Zahlenspalte der Auswertungen. Diese Spalte lief als
        // einzige Anzahl der Flotte linksbuendig - derselbe Wert, zwei
        // Erscheinungsformen, je nachdem, in welchem Bereich man ihn
        // ansieht.
        { feld: 'offene_schaeden', titel: t('field.schaeden'), klasse: 'zahl',
          formatieren: (n) => n || '', summierbar: true }
    ], radMaske, radZeilenAktionen);

    // meldeVorgang statt melde: nach einer Buchung (Statuswechsel,
    // Ausmustern, Anlegen - siehe radMaske/radAnlegenMaske) ruft genau
    // dieser Aufruf hier sofort im Anschluss auf und ueberschriebe die
    // gerade gezeigte Bestaetigung, bevor sie jemand liest, wenn er noch
    // zu DIESEM Vorgang gehoert. Siehe Begruendung bei meldeVorgang() in
    // rahmen.js.
    // Immer die GANZE Flotte gemeldet, nicht mehr eine gefilterte
    // Teilmenge: seit die Filter im Spaltenkopf sitzen, sagt der
    // Tabellenbaustein selbst, wie viele Zeilen von wie vielen gerade zu
    // sehen sind (spaltenkopfHinweis() in rahmen.js, unmittelbar ueber
    // der Tabelle). Dieselbe Zahl zusaetzlich in der Statuszeile am
    // unteren Fensterrand zu wiederholen, waere eine zweite Quelle fuer
    // dieselbe Auskunft - und die beiden koennten auseinanderlaufen.
    meldeVorgang(vorgang, mengeFormat(raeder.length, 'rad'));
}

// ===== Kopftafel der Flotte =====
//
// DIE FRAGE, DIE DIESER KOPF BEANTWORTET: "Welches Modell steht wie oft
// im Bestand, wie alt ist es, wie viel davon faehrt gerade - und welches
// Modell faellt dabei aus dem Rahmen?"
//
// Die Liste darunter kann das nicht zeigen: sie fuehrt 275 einzelne
// Raeder, nach Rahmennummer sortiert. Wer aus ihr die Struktur des
// Bestands lesen will, muss sie erst sortieren, gruppieren und im Kopf
// zusammenzaehlen. Genau diese Zusammenfassung ist der Kopf - und sie
// zaehlt NICHT einfach dieselbe Liste noch einmal: die Einsatzquote je
// Modell gegen die Quote der Gesamtflotte (letzte Spalte) steht in
// keiner Zeile der Tabelle und laesst sich aus ihr auch nicht ablesen.
//
// ZEILEN SIND DIE FUENF MODELLZEILEN (ein Produkt je Radtyp, aber je
// Hersteller eine eigene Zeile), gruppiert nach den drei Radtypen - die
// feinste Gliederung, die noch in den Kopf passt (siehe zeigeKopftafel()
// in rahmen.js). Drei Radtyp-Zeilen allein waeren zu grob (sie
// verstecken, dass das City-Bike von Nordwind Rad und das von Kvarner
// Bike Works sich um drei Baujahre unterscheiden), 275 Radzeilen waeren
// die Liste selbst. Der Gruppierungsschluessel unten nimmt deshalb den
// HERSTELLER mit auf, nicht nur den Modellnamen: seit der Produktkorrektur
// (siehe db/betrieb/flottenmodelle_stammdaten.sql) tragen alle Modellzeilen
// eines Typs denselben Produktnamen ("City-Bike" zweimal, einmal je
// Hersteller) - ohne den Hersteller im Schluessel fielen sie zu EINER
// Zeile zusammen, und die Tafel waere nicht mehr von der reinen
// Typ-Gruppierung zu unterscheiden.
//
// DIE PRODUKTBILDER (Gestaltungsauftrag, frueher woertlich: "Bei Flotte
// vermisse ich Produktbilder ... damit ich das Produkt/Flotte auch
// sehe") stehen jetzt IN der Gruppenzeile ihres Radtyps statt in einer
// eigenen Kachelreihe darunter. Das ist derselbe Wunsch, an der
// richtigen Stelle erfuellt: das Bild sitzt neben der Zahl, die es
// betrifft, und kostet keine eigene Zeile Bildschirmhoehe mehr.
function flotteKopftafel(raeder) {
    if (raeder.length === 0) return null;

    const gesamt = raeder.length;

    // Ein Eintrag je Modellzeile (Typ + Hersteller). baujahr/hersteller
    // kommen aus dem MODELL (v_wawi_flotte reicht sie aus fahrradmodell
    // durch, siehe deren Definition) und sind darum innerhalb einer
    // Modellzeile konstant - das erste gefundene Rad genuegt, ein
    // Mittelwert waere hier eine Rechnung ueber lauter gleiche Werte.
    // SCHLUESSEL MIT HERSTELLER, NICHT NUR MODELLNAME: rad.modell ist seit
    // der Produktkorrektur der Produktname des TYPS (z.B. "City-Bike" bei
    // sowohl Nordwind Rad als auch Kvarner Bike Works) - ohne hersteller
    // im Schluessel wuerden zwei Hersteller desselben Produkts zu einer
    // Zeile verschmelzen und die Tafel verloere genau die
    // Herstellergliederung, die sie zeigen soll (siehe Kopfkommentar).
    const nachModell = new Map();
    for (const rad of raeder) {
        const schluessel = `${rad.typ_code} ${rad.hersteller} ${rad.modell}`;
        let eintrag = nachModell.get(schluessel);
        if (!eintrag) {
            eintrag = { typCode: rad.typ_code, typ: rad.typ, modell: rad.modell,
                        hersteller: rad.hersteller, baujahr: rad.baujahr,
                        bestand: 0, status: new Map() };
            nachModell.set(schluessel, eintrag);
        }
        eintrag.bestand += 1;
        eintrag.status.set(rad.status, (eintrag.status.get(rad.status) || 0) + 1);
    }

    // VERHAELTNISZAHL AUS SUMMEN, nicht als Mittel von Einzelquotienten
    // (Hausregel des Projekts, an dieser Oberflaeche schon einmal 13
    // Prozentpunkte teuer): die Flottenquote ist "alle ausgeliehenen
    // Raeder durch alle Raeder", NICHT der Durchschnitt der fuenf
    // Modellquoten - fuenf Modellzeilen mit 12 bis 110 Raedern haetten
    // dabei dasselbe Gewicht bekommen.
    const ausgeliehenGesamt = raeder.filter((r) => r.status === 'ausgeliehen').length;
    const flottenquote = ausgeliehenGesamt / gesamt;

    const zaehle = (eintrag, status) => eintrag.status.get(status) || 0;
    const segmenteVon = (eintrag) => FLOTTE_STATUS_REIHE.map((status) => ({
        wert: zaehle(eintrag, status),
        name: statusAnzeige(status, true),
        klasse: FLOTTE_STATUS_SEGMENT[status]
    }));
    const strukturText = (eintrag) => FLOTTE_STATUS_REIHE
        .filter((status) => zaehle(eintrag, status) > 0)
        .map((status) => `${statusAnzeige(status, true)} ${zahlFormat(zaehle(eintrag, status))}`)
        .join(', ');

    // Radtyp-Gruppen in der Reihenfolge, in der die Radtypen im Bestand
    // vorkommen; innerhalb einer Gruppe das groesste Modell zuerst - so
    // steht immer oben, was den Bestand traegt.
    const typen = [...new Map(raeder.map((r) => [r.typ_code, r.typ])).entries()]
        .sort(([a], [b]) => a.localeCompare(b));

    const zeilen = [];
    for (const [typCode, typName] of typen) {
        const modelleDesTyps = [...nachModell.values()]
            .filter((m) => m.typCode === typCode)
            .sort((a, b) => b.bestand - a.bestand);
        if (modelleDesTyps.length === 0) continue;

        const gruppe = {
            istGruppe: true,
            typCode,
            name: typName,
            bestand: modelleDesTyps.reduce((s, m) => s + m.bestand, 0),
            status: new Map()
        };
        for (const modell of modelleDesTyps) {
            for (const [status, anzahl] of modell.status) {
                gruppe.status.set(status, (gruppe.status.get(status) || 0) + anzahl);
            }
        }
        zeilen.push(gruppe, ...modelleDesTyps);
    }

    const gesamtzeile = { name: t('col.together'), bestand: gesamt, status: new Map() };
    for (const rad of raeder) gesamtzeile.status.set(rad.status, (gesamtzeile.status.get(rad.status) || 0) + 1);

    // EIN EINSATZBEREITES RAD OHNE STANDORT IST EIN PROBLEM (Auftrag,
    // woertlich - Rang 2 der Farbordnung, "Schwelle"): es steht als
    // verfuegbar in der Kartei, aber niemand weiss, wo. Gezaehlt wird
    // ausdruecklich NUR ueber 'verfuegbar' - die 110 ausgeliehenen
    // Raeder haben ebenfalls keinen Stationsplatz, und das ist bei einem
    // Rad, auf dem gerade jemand faehrt, der Normalfall und kein Befund.
    // In der Datenbank nachgezaehlt: 137 Raeder ohne Stationsplatz, davon
    // 110 ausgeliehen und 27 verfuegbar. Eine Zahl, die beide Faelle
    // zusammenwuerfe, waere um das Fuenffache zu gross und damit
    // wertlos.
    const ohneStandort = raeder.filter(
        (r) => r.status === 'verfuegbar' && !r.standort).length;

    const baujahre = raeder.map((r) => r.baujahr).filter((j) => j != null);
    const vonJahr = baujahre.length ? Math.min(...baujahre) : null;
    const bisJahr = baujahre.length ? Math.max(...baujahre) : null;
    const hersteller = new Set(raeder.map((r) => r.hersteller).filter(Boolean));

    return {
        titel: t('board.fleetTitle'),
        bezug: t('board.fleetReference', {
            raederPhrase: mengeFormat(gesamt, 'rad'),
            modellePhrase: mengeFormat(nachModell.size, 'modell'),
            herstellerPhrase: mengeFormat(hersteller.size, 'hersteller'),
            vonJahr: vonJahr === null ? '?' : jahrFormat(vonJahr),
            bisJahr: bisJahr === null ? '?' : jahrFormat(bisJahr),
            quote: zahlFormat(Math.round(flottenquote * 100))
        }),
        spalten: [
            {
                art: 'rubrik',
                titel: t('col.model'),
                wert: (z) => z.name || z.modell,
                zusatz: (z) => (z.istGruppe || !z.hersteller ? null : z.hersteller),
                // Bild NUR in der Gruppenzeile: dasselbe Bild in jeder der
                // vier City-Zeilen zu wiederholen waere genau der Laerm,
                // den der Auftrag frueher schon an einer Beschriftung
                // geruegt hat, die ein Bild nur verdoppelt.
                bild: (z) => (z.istGruppe ? radtypBild(z.typCode) : null)
            },
            {
                art: 'groesse',
                titel: t('col.stock'),
                einheit: t('unit.bikes'),
                wert: (z) => z.bestand,
                format: (n) => zahlFormat(n),
                // RANG 4 DER FARBORDNUNG - ZUGEHOERIGKEIT (kategorieFarbe()
                // in rahmen.js). Die fuenf Modellzeilen stehen in drei
                // Radtyp-Bloecken; der Balken traegt jetzt die Farbe
                // seines Blocks. Der Nutzen ist nicht Schmuck, sondern
                // Wiedererkennung: dasselbe Blau steht in "Umsatz nach
                // Radtyp" und in "Wegstrecke nach Radtyp" wieder fuer das
                // City-Bike. Wer die Flotte im Kopf hat, findet sie in den
                // Auswertungen ohne die Beschriftung zu lesen.
                // Die Laenge kodiert weiterhin allein den Bestand - die
                // Farbe nimmt ihr nichts weg, sie beantwortet eine zweite
                // Frage ("zu wem gehoert die Zeile"), die bislang nur die
                // Einrueckung beantwortete.
                farbe: (z) => kategorieFarbe(z.typCode) || 'var(--marine)'
            },
            {
                art: 'struktur',
                titel: t('col.statusMix'),
                einheit: t('unit.shareOfRow'),
                auchSumme: true,
                segmente: segmenteVon,
                beschriftung: (z) => t('board.fleetStatusAria', {
                    name: z.name || z.modell, aufteilung: strukturText(z)
                })
            },
            {
                art: 'profil',
                titel: t('col.modelYear'),
                einheit: vonJahr === null ? '' : `${jahrFormat(vonJahr)} – ${jahrFormat(bisJahr)}`,
                punkt: (z) => (z.istGruppe ? null : z.baujahr),
                beschriftung: (z) => t('board.fleetYearAria', {
                    name: z.modell, jahr: jahrFormat(z.baujahr),
                    vonJahr: jahrFormat(vonJahr), bisJahr: jahrFormat(bisJahr)
                })
            },
            {
                art: 'abweichung',
                titel: t('col.utilisationDeviation'),
                einheit: t('unit.percentagePoints'),
                wert: (z) => (z.istGruppe || !z.bestand ? null
                    : Math.round((zaehle(z, 'ausgeliehen') / z.bestand - flottenquote) * 1000) / 10),
                format: (n) => abweichungText(n),
                beschriftung: (z) => t('board.fleetDeviationAria', {
                    name: z.modell,
                    quote: zahlFormat(Math.round((zaehle(z, 'ausgeliehen') / z.bestand) * 100)),
                    flottenquote: zahlFormat(Math.round(flottenquote * 100))
                })
            }
        ],
        zeilen,
        summe: gesamtzeile,
        // Zwei vollstaendige Saetze, mit Leerzeichen verbunden - nicht
        // ein Satz aus zwei uebersetzten Bruchstuecken (dieselbe Regel
        // wie bei der Umsatztafel in auswertungen.js): jeder Teil bleibt
        // in jeder Sprache fuer sich uebersetzbar. Der zweite Satz
        // entfaellt, wenn es nichts zu melden gibt - eine Fussnote, die
        // "0 Raeder ohne Standort" schreibt, meldet einen Nicht-Befund.
        fussnote: [
            t('board.fleetFootnote', { quote: zahlFormat(Math.round(flottenquote * 100)) }),
            ohneStandort > 0
                ? t('board.fleetNoLocationFootnote', {
                    raederPhrase: mengeFormat(ohneStandort, 'rad')
                })
                : null
        ].filter(Boolean).join(' ')
    };
}

// In welcher Reihenfolge die vier Statuswerte im Strukturbalken stehen -
// IMMER dieselbe, in jeder Zeile und in jeder Gruppe. Das ist nicht
// Kosmetik, sondern die Bedingung dafuer, dass man die Balken zweier
// Zeilen ueberhaupt vergleichen kann: eine wechselnde Reihenfolge machte
// aus derselben Aufteilung zwei verschiedene Bilder. Sie ist zugleich die
// zweite Absicherung gegen den Farbfall - "Wartung" (--warnung-text) und
// "Defekt" (--schlecht) unterscheiden sich in der HELLIGKEIT kaum (1.07:1
// gemessen), wohl aber im Farbton und eben in ihrer festen Position ganz
// rechts im Balken.
const FLOTTE_STATUS_REIHE = ['ausgeliehen', 'verfuegbar', 'wartung', 'defekt'];

// Welche Statusfarbe welche Bedeutung traegt - an EINER Stelle, nicht in
// jedem Aufruf von strukturBalken(): "ausgeliehen" ist die Flaeche, die
// verdient (voll), "verfuegbar" die, die bereitsteht (ruhig), Wartung und
// Defekt sind Warnung und Schaden. Ein 'ausgemustert' im Bestand faellt
// bewusst auf 'seg-ruhend' zurueck statt auf eine eigene, unvermessene
// fuenfte Farbe - im heutigen Bestand kommt es nicht vor.
const FLOTTE_STATUS_SEGMENT = {
    ausgeliehen: 'seg-aktiv',
    verfuegbar:  'seg-ruhend',
    wartung:     'seg-warnung',
    defekt:      'seg-schlecht',
    ausgemustert: 'seg-ruhend'
};

// ===== Produktbilder je Radtyp =====
// Die Tabelle selbst ist nach rahmen.js gewandert (RADTYP_BILDER, dort
// unmittelbar neben KATEGORIE_FARBE) - aus demselben Grund, aus dem
// kategorieFarbe() dort steht: sie ist bereichsuebergreifend. Sie hat
// inzwischen DREI Verbraucher (Flotte hier, Instandhaltung, und seit der
// Referenzangleichung auch zwei Reiter der Auswertungen), und eine
// Zuordnung, die drei Bereiche teilen, gehoert nicht in einen davon -
// derselbe Befund, den werkzeugleiste()/kopftafelWurzel() in rahmen.js
// schon einmal beseitigt haben. Verwendet wird sie hier unveraendert
// weiter (siehe flotteKopftafel() oben und radMaske() unten).

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

    // GESTALTUNGSAUFTRAG PUNKT 5, woertlich: "ich will in der rechten
    // Kachel das Bild des jeweiligen Rades sehen, dann auch noch die
    // Angaben vom Hersteller." Dasselbe radtypBild() wie in der
    // Kopftafel oben (ueber typ_code zugeordnet, aus demselben Grund -
    // siehe RADTYP_BILDER in rahmen.js), hier aber die BEDEUTENDE Abbildung der
    // ganzen Maske statt einer schmueckenden Wiederholung neben einem
    // Titel - alt bleibt trotzdem leer/aria-hidden, weil "Typ:
    // {rad.typ} ({rad.typ_code})" gleich im ersten Feld darunter steht:
    // ein Bildname, der denselben Satz noch einmal vorliest, waere fuer
    // einen Screenreader Laerm (derselbe Grundsatz wie bei den
    // Typ-Kacheln). Fehlt die Datei (radtypBild() kennt den typ_code
    // nicht, oder das 'error'-Ereignis der Datei selbst), erscheint gar
    // kein Bildbereich statt eines kaputten Platzhalters - zeigeMaske()
    // in rahmen.js haengt den Rahmen nur ein, wenn bild tatsaechlich
    // etwas ist.
    let bild = null;
    const bildQuelle = radtypBild(rad.typ_code);
    if (bildQuelle) {
        bild = document.createElement('img');
        bild.src = bildQuelle;
        bild.alt = '';
        bild.setAttribute('aria-hidden', 'true');
        bild.addEventListener('error', () => bild.remove());
    }

    // Herstellerangaben (Punkt 5) - seit eben in v_wawi_flotte, dieselben
    // Spalten wie in v_wawi_modell (siehe Datenbank-Bericht). NULL BEI
    // AKKU/REICHWEITE HEISST NICHT-ELEKTRISCH, NICHT "fehlt" (Auftrag,
    // woertlich: "ein leeres Feld sieht aus wie ein Ladefehler - das hat
    // in diesem Projekt mehrfach Zeit gekostet") - beide Felder werden
    // deshalb bei einem nicht-elektrischen Rad GAR NICHT erst in die
    // Feldliste aufgenommen, statt sie leer oder mit einem Gedankenstrich
    // zu zeigen. WICHTIG, gegen die Datenbank geprueft (siehe Bericht):
    // "elektrisch" ist NICHT gleichbedeutend mit typ_code === 'EBIKE' -
    // fahrradtyp.hat_elektro steht auch bei CARGO auf true ("E-Cargo
    // Loader"), nur CITY ist durchgehend nicht-elektrisch. Eine Pruefung
    // auf den Typcode waere deshalb an dieser Stelle STUMM FALSCH
    // gewesen (ein Cargo-Rad mit echtem Akku haette keinen gezeigt) - die
    // Pruefung gilt deshalb dem tatsaechlichen WERT (reichweite_km !=
    // null), nicht dem Typcode. Jedes elektrische Modell traegt in der
    // heutigen Modellpalette immer BEIDE Werte zusammen - eine Pruefung
    // auf reichweite_km allein reicht deshalb, keine zweite auf
    // akkukapazitaet_wh noetig.
    const herstellerFelder = [
        { name: 'baujahr',       titel: t('field.baujahr'),       wert: rad.baujahr, nurLesen: true },
        { name: 'gewicht_kg',    titel: t('field.gewicht'),       wert: rad.gewicht_kg != null ? `${zahlFormat(rad.gewicht_kg)} kg` : '—', nurLesen: true },
        { name: 'gangzahl',      titel: t('field.gangzahl'),      wert: rad.gangzahl, nurLesen: true },
        { name: 'rahmenhoehe_cm', titel: t('field.rahmenhoehe'),  wert: rad.rahmenhoehe_cm != null ? `${zahlFormat(rad.rahmenhoehe_cm)} cm` : '—', nurLesen: true }
    ];
    if (rad.reichweite_km != null) {
        herstellerFelder.push(
            { name: 'akkukapazitaet_wh', titel: t('field.akkukapazitaet'), wert: `${zahlFormat(rad.akkukapazitaet_wh)} Wh`, nurLesen: true },
            { name: 'reichweite_km',     titel: t('field.reichweite'),     wert: `${zahlFormat(rad.reichweite_km)} km`, nurLesen: true }
        );
    }

    zeigeMaske(`${t('field.rad')} ${rad.rahmennummer}`, [
        { name: 'typ',            titel: t('field.radtyp'),           wert: `${rad.typ} (${rad.typ_code})`, nurLesen: true },
        { name: 'modell',         titel: t('field.modell'),           wert: `${rad.hersteller} ${rad.modell}`, nurLesen: true },
        ...herstellerFelder,
        { name: 'status',         titel: t('field.status'),           wert: statusAnzeige(rad.status), nurLesen: true },
        { name: 'standort',       titel: t('field.standort'),         wert: rad.standort || t('misc.underway'), nurLesen: true },
        { name: 'angeschafft_am', titel: t('field.angeschafft'),      wert: rad.angeschafft_am, nurLesen: true },
        { name: 'letzte_wartung', titel: t('field.letzteWartung'),    wert: rad.letzte_wartung || t('misc.noneYet'), nurLesen: true },
        { name: 'offene_schaeden', titel: t('field.offeneSchaeden'),  wert: rad.offene_schaeden, nurLesen: true },
        { name: 'hoechste_schwere', titel: t('field.hoechsteSchwere'), wert: rad.hoechste_schwere ? t('schwere.' + rad.hoechste_schwere) : '—', nurLesen: true }
    ], knoepfe, bild);
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

// Die Werte der Aufzaehlungstypen aus 0024_radausstattung.sql, in der
// Reihenfolge, in der sie dort stehen. Von Hand gefuehrt und nicht aus
// der Datenbank gelesen: Eine Sicht dafuer gibt es nicht, und eine
// eigene anzulegen waere fuer sechs feste Listen zu viel Mechanik.
// tools/wawi_check.py haelt sie gegen die Aufbaudatei.
const AUSSTATTUNG = {
    rahmenform:  ['diamant', 'tiefeinsteiger'],
    schaltung:   ['nabe', 'kette', 'keine'],
    bremsen:     ['felge', 'scheibe', 'ruecktritt'],
    beleuchtung: ['nabendynamo', 'akku', 'keine'],
    antrieb:     ['kette', 'riemen']
};

// Ein Maskenfeld auslesen. <select>.value und <input>.value verhalten
// sich gleich, der Unterschied liegt nur im getrimmten Text.
function feldWert(name) {
    const feld = document.getElementById(`feld-maske-${name}`);
    return feld ? feld.value.trim() : '';
}

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
        meldeFehler(t('msg.modelsOrStationsLoadFailed', { fehler: fehlerModell || fehlerStation }));
        return;
    }
    if (!modelle.length || !stationen.length) {
        meldeFehler(t('msg.noModelsOrStations'));
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
        },
        // Ausstattung. Seit 0024_radausstattung.sql verlangt
        // api_rad_anlegen sechs davon - Gewicht, Rahmenform, Schaltung,
        // Bremsen, Beleuchtung, Antrieb -, und die Datenbank weist die
        // Anlage sonst mit 22023 ab. Die Auswahllisten fuehren genau die
        // Werte der Aufzaehlungstypen; uebersetzt wird nur die
        // Beschriftung, gespeichert der ASCII-Bezeichner.
        { name: 'gewicht_kg', titel: t('field.gewicht'), wert: '' },
        {
            name: 'rahmenform', titel: t('field.rahmenform'), wert: 'diamant',
            optionen: AUSSTATTUNG.rahmenform.map((w) => ({ wert: w, text: t(`wert.${w}`) }))
        },
        {
            name: 'schaltung', titel: t('field.schaltung'), wert: 'kette',
            optionen: AUSSTATTUNG.schaltung.map((w) => ({ wert: w, text: t(`wert.${w}`) }))
        },
        {
            name: 'bremsen', titel: t('field.bremsen'), wert: 'felge',
            optionen: AUSSTATTUNG.bremsen.map((w) => ({ wert: w, text: t(`wert.${w}`) }))
        },
        {
            name: 'beleuchtung', titel: t('field.beleuchtung'), wert: 'nabendynamo',
            optionen: AUSSTATTUNG.beleuchtung.map((w) => ({ wert: w, text: t(`wert.${w}`) }))
        },
        {
            name: 'antrieb', titel: t('field.antrieb'), wert: 'kette',
            optionen: AUSSTATTUNG.antrieb.map((w) => ({ wert: w, text: t(`wert.${w}`) }))
        },
        // Freiwillig. Die Farbe ist vorbelegt, weil die ganze Flotte rot
        // ist - das Feld steht trotzdem da, damit es nicht erst gesucht
        // werden muss, wenn das eines Tages nicht mehr stimmt.
        { name: 'farbe', titel: t('field.farbe'), wert: 'RAL 3000' },
        { name: 'motortyp', titel: t('field.motortyp'), wert: '' },
        { name: 'reifengroesse_zoll', titel: t('field.reifengroesse'), wert: '' },
        { name: 'schlossnummer', titel: t('field.schlossnummer'), wert: '' }
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
                    meldeFehler(t('msg.frameNumberMissing'));
                    return;
                }
                // <select>.value ist immer ein String - fuer die
                // bigint-Parameter der Funktion wird daraus wieder eine
                // Zahl, statt darauf zu vertrauen, dass PostgREST die
                // Umwandlung selbst uebernimmt.
                const modellId = Number(document.getElementById('feld-maske-modell_id').value);
                const stationId = Number(document.getElementById('feld-maske-station_id').value);

                // Das Gewicht ist Pflicht und muss eine Zahl sein. Die
                // Datenbank faengt beides ab (22023 bei NULL,
                // fahrrad_gewicht_chk bei <= 0) - hier steht die Meldung
                // nur frueher und in der Sprache der Oberflaeche.
                const gewicht = Number(feldWert('gewicht_kg').replace(',', '.'));
                if (!Number.isFinite(gewicht) || gewicht <= 0) {
                    meldeFehler(t('msg.gewichtFehlt'));
                    return;
                }
                const reifen = Number(feldWert('reifengroesse_zoll').replace(',', '.'));

                await rufeAuf('api_rad_anlegen', {
                    p_rahmennummer: rahmennummer,
                    p_modell_id: modellId,
                    p_station_id: stationId,
                    p_gewicht_kg: gewicht,
                    p_rahmenform: feldWert('rahmenform'),
                    p_schaltung: feldWert('schaltung'),
                    p_bremsen: feldWert('bremsen'),
                    p_beleuchtung: feldWert('beleuchtung'),
                    p_antrieb: feldWert('antrieb'),
                    p_farbe: feldWert('farbe') || 'RAL 3000',
                    // Leere Felder als null, nicht als Leerstring: die
                    // Funktion macht daraus zwar selbst NULL, aber ein
                    // Leerstring im Aufruf sagt "ausdruecklich leer" und
                    // nicht "nicht angegeben".
                    p_motortyp: feldWert('motortyp') || null,
                    p_reifengroesse_zoll: Number.isFinite(reifen) && reifen > 0 ? reifen : null,
                    p_schlossnummer: feldWert('schlossnummer') || null
                });
                const quittungstext = t('msg.bikeCreated', { rahmennummer });
                melde(quittungstext, 'gut');
                await flotteAufbauen();
                // NACH dem Neuaufbau: die Liste zeigt das neue Rad dann
                // bereits, wenn der Dialog weggeht - sonst quittiert er
                // etwas, das man hinter ihm noch nicht sieht.
                await quittung(quittungstext);
            }
        }
    ]);
}
