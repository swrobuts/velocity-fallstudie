// ============================================
// VeloCity Warenwirtschaft — Instandhaltung
//
// Zwei Listen in einem Bereich: offene Schaeden und laufende Auftraege.
// Sie gehoeren zusammen, weil der Weg von der Meldung zum Auftrag der
// eigentliche Arbeitsfluss ist - wer sie auf zwei Menuepunkte verteilt,
// zwingt zum Hin- und Herspringen.
//
// Dieser Bereich wird gegen zwei anfangs LEERE Tabellen gebaut
// (schadensmeldung, wartungsauftrag). Die Leermaske ist deshalb kein
// Nachtrag, sondern der Zustand, den ein neuer Mitarbeiter zuerst sieht -
// siehe zeigeLeermaske()-Aufrufe unten und der Kommentar bei
// schaedenZeigen().
//
// Ausschliesslich die Bausteine aus rahmen.js (bereichAnmelden, ladeListe,
// rufeAuf, letzterLadeFehler, zeigeListe, zeigeMaske, zeigeLeermaske,
// zeigeUnterreiter, zeigeWerkzeugleiste, melde, meldeVorgang,
// neuerVorgang, darfRolle) und die eigenen Sichten v_wawi_schaden /
// v_wawi_auftrag / v_wawi_flotte - keine Basistabelle, keine
// fn_-Funktion.
// ============================================

// Navigations-Icon (Gestaltungsauftrag, Punkt 3): derselbe Schraubenschluessel
// wie der Flotten-Status "In Wartung" (siehe RAD_ICONS.wartung in flotte.js) -
// dieselbe Bedeutung verdient dasselbe Symbol, nicht ein zweites,
// aehnliches. Strichfamilie wie die vier anderen Bereichs-Icons (siehe
// .bereich-icon in style.css).
const ICON_INSTANDHALTUNG = '<svg viewBox="0 0 24 24"><path d="M14.7 6.3a4 4 0 00-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 005.4-5.4l-2.6 2.6-2-2z"/></svg>';

bereichAnmelden({
    schluessel: 'instandhaltung',
    titelSchluessel: 'nav.instandhaltung',
    icon: ICON_INSTANDHALTUNG,
    // Dieselben Rollen, die auch v_wawi_schaden und v_wawi_auftrag
    // durchlassen (0018_wawi_sichten.sql) - waeren sie hier weiter
    // gefasst, saehe etwa die Disposition den Menuepunkt und dahinter
    // eine leere Liste, wie im Flotte-Kommentar begruendet.
    rollen: ['werkstatt', 'leitung'],
    aufbauen: instandhaltungAufbauen
});

let unterbereich = 'schaeden';   // 'schaeden' | 'auftraege'

// Fuer den Querverweis aus der Flotte (Gestaltungsauftrag Punkt 3: "Rad
// in der Flotte -> seine Schadensmeldungen"). unterbereich ueberlebt
// bewusst einen Bereichswechsel (siehe Kommentar dort) - ohne diese
// Funktion landete ein Sprung aus der Flotte auf dem Unterreiter, den
// diese Instandhaltungs-Sitzung zuletzt zufaellig zeigte ("Auftraege"),
// statt auf den Schadensmeldungen, die der Sprung eigentlich meint. Muss
// VOR bereichWechseln() laufen (siehe bereichSprung() in rahmen.js -
// deren einrichten() laeuft erst DANACH, wenn instandhaltungAufbauen()
// bereits den falschen Unterreiter geladen haette), deshalb eine eigene,
// von aussen aufrufbare Funktion statt eines einrichten()-Hooks.
function instandhaltungZeigeSchaeden() {
    unterbereich = 'schaeden';
}

// Filterzustand (Gestaltungsauftrag, Punkt 2) - nur fuer den Schaeden-
// Unterreiter ("nach Schwere, nach Alter der Meldung", woertlich der
// Auftrag). instandhaltungFilterAlterStunden=0 bedeutet "alle", siehe
// schaedenZeigen() weiter unten. instandhaltungFilterSchwere ist seit
// der Mehrfachauswahl (Gestaltungsauftrag Bedienelemente, Punkt 2) ein
// Set<string> - leer bedeutet "Alle".
let instandhaltungFilterSchwere = new Set();
let instandhaltungFilterAlterStunden = 0;

async function instandhaltungAufbauen() {
    // ALLERERSTE Anweisung, vor jedem await (siehe Kommentar bei
    // neuerVorgang() in rahmen.js): instandhaltungAufbauen() ist die
    // *Aufbauen()-Funktion, die bereichWechseln() und jeder Reiter- bzw.
    // Buchungswechsel erneut aufruft - schaedenZeigen()/auftraegeZeigen()
    // sind reine Hilfsfunktionen darunter und bekommen die Kennung als
    // Parameter durchgereicht, statt selbst eine neue zu ziehen.
    const vorgang = neuerVorgang();

    // Nur fuer werkstatt sichtbar - dieselbe Rolle, die api_schaden_melden
    // in der Datenbank verlangt - und nur im Schaeden-Reiter: im
    // Auftraege-Reiter gibt es keinen "neu anlegen"-Einstieg, ein Auftrag
    // entsteht aus einer Meldung heraus (siehe schadenMaske), nicht frei
    // gewaehlt.
    //
    // VOR zeigeUnterreiter aufgerufen, nicht danach: beide Bausteine
    // haengen sich als erstes Kind von #arbeitsliste ein (siehe
    // werkzeugleiste()/reiterleiste() in rahmen.js) - wer zuletzt
    // aufgerufen wird, landet zuoberst. Mit dieser Reihenfolge stehen die
    // Reiter uebereinander wie eine Navigation, der Knopf darunter wie
    // eine bereichseigene Aktion - im Browser nachgestellt und bestaetigt
    // (siehe Bericht).
    zeigeWerkzeugleiste(unterbereich === 'schaeden' && darfRolle('werkstatt'),
        t('button.reportDamage'), schadenMeldenMaske);

    zeigeUnterreiter(vorgang, [
        { schluessel: 'schaeden',  titel: t('tab.openDamage') },
        { schluessel: 'auftraege', titel: t('tab.workOrders') }
    ], unterbereich, async (gewaehlt) => {
        unterbereich = gewaehlt;
        // Ohne dies bliebe die Detailmaske des VORHERIGEN Unterreiters
        // stehen - eine Schadensmeldung, wo jetzt die Auftragsliste zu
        // sehen ist, oder umgekehrt. bereichWechseln() in rahmen.js raeumt
        // das nur beim Wechsel des ganzen BEREICHS auf (Flotte/Stationen/
        // Kunden/Instandhaltung), nicht beim Wechsel zwischen zwei
        // Unterreitern desselben Bereichs - das ist hier der erste
        // Verbraucher von zeigeUnterreiter() mit einer eigenen
        // Detailmaske pro Reiter, im Browser nachgestellt und bestaetigt
        // (siehe Bericht).
        maskeVerwerfen();
        await instandhaltungAufbauen();
    });

    // Bereichsweite Kennzahlen (Punkt 1 des Gestaltungsauftrags) -
    // UNABHAENGIG vom aktiven Unterreiter (beide Listen darunter zeigen
    // nur offen/in_arbeit) und unabhaengig von den Filtern unten:
    // "7 Schadensmeldungen, 3 Wartungsauftraege" ist die Gesamtzahl ueber
    // ALLE Bearbeitungsstaende, nicht nur die aktuell offenen fuenf bzw.
    // eine. zaehleZeilen() (daten.js) liefert das, ohne dafuer die
    // Zeilen selbst zu laden - bei dieser Groessenordnung waere ein
    // zweiter voller Request vertretbar gewesen, aber ein Zaehl-Request
    // ist die ehrlichere Wahl: er behauptet nicht, Zeilen geladen zu
    // haben, die niemand ansieht.
    // GESTALTUNGSAUFTRAG PUNKT 4, woertlich: "Bei Instandhaltung hätte ich
    // auch gern die schönen Bilder der Räder wie bei Flotte, dazu mehr
    // KPIs im Header." Drei weitere, ebenso billige Anfragen dazu:
    // gesamtAuftraegeLaufend (eine zweite Zaehl-Anfrage, derselbe Baustein
    // wie die drei bestehenden), schaedenTypCodes (eine schlanke
    // Ladeliste MIT genau einer Spalte, ueber ALLE Schadensmeldungen,
    // nicht nur die aktuell offenen fuenf - "welcher Typ wie oft in der
    // Werkstatt war" ist eine Frage an den GESAMTEN Bestand, dieselbe
    // Ueberlegung wie bei gesamtSchaeden/gesamtAuftraege oben) und
    // radtypNamen (v_wawi_schaden traegt nur typ_code, keinen
    // ausgeschriebenen Namen - siehe deren Spaltenliste - v_wawi_modell
    // dagegen schon; neun Modellzeilen statt einer vierten, eigens
    // angelegten Uebersetzungstabelle nur fuer drei Radtypnamen, die
    // ohnehin schon woanders in der Datenbank stehen).
    const [gesamtSchaeden, gesamtAuftraege, gesamtFahruntauglichOffen, gesamtAuftraegeLaufend, schaedenTypCodes, modelleFuerTypnamen] = await Promise.all([
        zaehleZeilen('v_wawi_schaden'),
        zaehleZeilen('v_wawi_auftrag'),
        zaehleZeilen('v_wawi_schaden',
            (q) => q.eq('schwere', 'fahruntauglich').in('status', ['offen', 'in_arbeit'])),
        zaehleZeilen('v_wawi_auftrag', (q) => q.eq('status', 'in_arbeit')),
        ladeListe('v_wawi_schaden', 'typ_code'),
        ladeListe('v_wawi_modell', 'typ_code, typ')
    ]);
    zeigeUebersicht(vorgang, instandhaltungUebersicht(gesamtSchaeden, gesamtAuftraege, gesamtFahruntauglichOffen, gesamtAuftraegeLaufend));
    instandhaltungTypkachelnZeigen(vorgang, schaedenTypCodes, modelleFuerTypnamen);

    if (unterbereich === 'schaeden') await schaedenZeigen(vorgang);
    else                             await auftraegeZeigen(vorgang);
}

// ===== Bilder je Radtyp (Gestaltungsauftrag Punkt 4) =====
//
// "Bei Instandhaltung hätte ich auch gern die schönen Bilder der Räder
// wie bei Flotte" - woertlich der Auftrag, UND "die Bilder tragen hier
// ohnehin: sie zeigen, welcher Typ wie oft in der Werkstatt ist" (Bericht-
// Vorgabe). Dieselben drei Bilder/derselbe Baustein wie
// flotteTypkachelnZeigen() in flotte.js (RADTYP_BILDER dort, hier nur
// gelesen - flotte.js laedt in index.html VOR instandhaltung.js, siehe
// dortiger Kommentar zum gemeinsamen, ungemodulten Namensraum), aber mit
// einer ANDEREN Zaehlgroesse: nicht "wie viele Raeder dieses Typs gibt es
// in der Flotte", sondern "wie viele Schadensmeldungen betreffen diesen
// Typ, insgesamt". GESTALTUNGSAUFTRAG PUNKT 1 (gemeinsame Form): dieselbe
// Bauart wie in flotte.js - drei Bild-Kacheln in einer eigenen Reihe unter
// dem Uebersichtsstreifen, dieselbe CSS-Klasse (.flotte-typkachel* deckt
// beide Bereiche ab, siehe style.css) statt einer zweiten, aehnlichen
// Bauart nur fuer Instandhaltung.
//
// ALLE DREI TYPEN IMMER GEZEIGT, auch mit 0 Meldungen (anders als
// flotteTypkachelnZeigen(), das nur tatsaechlich vorkommende Typen
// zeigt): "0 von 7" ist hier selbst die Aussage (City-Bikes sind die
// EINZIGEN Raeder mit Schadensmeldungen im heutigen Bestand, siehe
// Bericht) - sie wegzulassen, weil kein einziger Cargo- oder E-Bike-
// Schaden vorliegt, verschwiege genau den Befund, den die Bilder zeigen
// sollen.
function instandhaltungTypkachelnZeigen(kennung, schaedenTypCodes, modelleFuerTypnamen) {
    if (!istAktuellerVorgang(kennung)) return;

    let leiste = document.getElementById('instandhaltung-typkacheln');
    if (!leiste) {
        leiste = document.createElement('div');
        leiste.id = 'instandhaltung-typkacheln';
        leiste.className = 'flotte-typkacheln';
    }
    // insertBefore(..., listenKoerper()) statt reiterleiste(): dieselbe
    // Find-or-create-Machart wie flotteTypkachelnZeigen() in flotte.js
    // (siehe dortiger Kommentar) - listenKoerper() legt den Tabellenkoerper
    // bei Bedarf an, und ALLES, was VOR ihm eingehaengt wird, bleibt an
    // seinem Platz stehen. instandhaltungTypkachelnZeigen() wird NACH
    // zeigeUebersicht() aufgerufen (siehe instandhaltungAufbauen()), das
    // seinerseits denselben Anker benutzt - die Reihenfolge der Aufrufe
    // entscheidet damit zuverlaessig ueber die Reihenfolge im DOM
    // (Uebersicht zuerst aufgebaut, dann diese Reihe: Uebersicht steht
    // oben, Bilder darunter, Tabelle zuunterst).
    document.getElementById('arbeitsliste').insertBefore(leiste, listenKoerper());
    leiste.replaceChildren();

    const gesamt = schaedenTypCodes.length;
    if (gesamt === 0) { leiste.remove(); return; }

    // Namen aus modelleFuerTypnamen gewonnen (v_wawi_modell traegt sowohl
    // typ_code als auch die ausgeschriebene Bezeichnung typ), NICHT aus
    // schaedenTypCodes selbst (das kennt nur den Code, siehe v_wawi_schaden).
    // ALLE bekannten Typen in derselben alphabetischen Reihenfolge wie
    // flotteFilterOptionen() in flotte.js (dort: .sort(([a],[b]) =>
    // a.localeCompare(b)) ueber typ_code) - dieselbe Sortierung an zwei
    // Stellen, damit "City-Bike, Cargo-Bike, E-Bike" nicht in Flotte anders
    // herum steht als in Instandhaltung.
    const typNamen = new Map(modelleFuerTypnamen.map((m) => [m.typ_code, m.typ]));
    const alleTypen = [...typNamen.keys()].sort((a, b) => a.localeCompare(b));

    for (const code of alleTypen) {
        const name = typNamen.get(code);
        const anzahl = schaedenTypCodes.filter((s) => s.typ_code === code).length;

        const kachel = document.createElement('div');
        kachel.className = 'flotte-typkachel';

        const bildQuelle = RADTYP_BILDER[code];
        if (bildQuelle) {
            const bild = document.createElement('img');
            bild.className = 'flotte-typkachel-bild';
            bild.src = bildQuelle;
            bild.alt = '';
            bild.setAttribute('aria-hidden', 'true');
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
        hinweis.textContent = t('hint.percentOfDamageReports', { anteil: zahlFormat(anteil) });
        text.append(hinweis);

        kachel.append(text);
        leiste.append(kachel);
    }
}

// ===== Uebersicht (Gestaltungsauftrag, Punkt 1) =====
//
// "7 Schadensmeldungen, 3 Wartungsauftraege. Wenige Daten - der Streifen
// muss auch mit fast nichts wuerdig aussehen und darf nicht leer wirken"
// - woertlich der Auftrag. Drei Kacheln mit echten, kleinen Zahlen statt
// einer einzigen: die dritte (fahruntauglich UND offen) verbindet zwei
// der drei Zahlen zu einer Kennzahl, die keine der beiden allein zeigt -
// genau das "wortgroße Bild daneben" (Auftrag), auch bei einer
// Grundgesamtheit von sieben.
function instandhaltungUebersicht(gesamtSchaeden, gesamtAuftraege, gesamtFahruntauglichOffen, gesamtAuftraegeLaufend) {
    const anzeige = (n) => (n === null ? '—' : String(n));

    const kacheln = [
        { titel: t('tile.damageReportsTotal'), wert: zahlSkaliert(anzeige(gesamtSchaeden)),
          hinweis: t('hint.overallStates') },
        { titel: t('tile.workOrdersTotal'), wert: zahlSkaliert(anzeige(gesamtAuftraege)),
          hinweis: t('hint.overallStates') }
    ];

    if (gesamtFahruntauglichOffen !== null) {
        const wert = document.createElement('span');
        if (gesamtFahruntauglichOffen > 0) wert.className = 'ton-schlecht';
        wert.textContent = anzeige(gesamtFahruntauglichOffen);
        kacheln.push({
            titel: t('tile.unrideableOpen'),
            wert,
            grafik: gesamtSchaeden ? zellbalken(gesamtFahruntauglichOffen, gesamtSchaeden, null,
                { farbe: 'var(--schlecht)' }) : undefined,
            // Echter Bezug (Gestaltungsauftrag Punkt 1: "2 von 10 - dann
            // ist es ein Anteil") - derselbe Nenner, den der Balken schon
            // als Skala traegt, jetzt auch in Text ausgeschrieben.
            hinweis: gesamtSchaeden
                ? t('msg.unrideableShare', { n: zahlFormat(gesamtFahruntauglichOffen), schadenPhrase: mengeFormat(gesamtSchaeden, 'schadensmeldung') })
                : t('msg.unrideableShareNoTotal')
        });
    }

    // GESTALTUNGSAUFTRAG PUNKT 4, woertlich: "dazu mehr KPIs im Header."
    // Eine vierte, echte Kennzahl statt einer erfundenen (siehe Bericht,
    // Abschnitt "weggelassen"): wie viele der Wartungsauftraege noch
    // LAUFEN (status='in_arbeit'), gegen gesamtAuftraege als Nenner - im
    // heutigen Bestand 1 von 3 (siehe Bericht). "Mittlere Bearbeitungszeit"
    // wurde bewusst NICHT ergaenzt: bei nur ZWEI erledigten Auftraegen
    // waere ein Mittelwert eine Kennzahl ueber eine Stichprobe von zwei,
    // die bei der naechsten Erledigung um mehrere Minuten springen wuerde -
    // "Kennzahlen ueber sieben Faelle sind schnell albern" (Auftrag,
    // woertlich).
    if (gesamtAuftraegeLaufend !== null) {
        kacheln.push({
            titel: t('tile.workOrdersRunning'),
            wert: zahlSkaliert(anzeige(gesamtAuftraegeLaufend)),
            grafik: gesamtAuftraege ? zellbalken(gesamtAuftraegeLaufend, gesamtAuftraege) : undefined,
            hinweis: gesamtAuftraege
                ? t('hint.workOrdersRunningShare', { n: zahlFormat(gesamtAuftraegeLaufend), auftraegePhrase: mengeFormat(gesamtAuftraege, 'auftrag') })
                : undefined
        });
    }

    return kacheln;
}

// ===== Offene Schäden =====

async function schaedenZeigen(vorgang) {
    const schaeden = await ladeListe('v_wawi_schaden',
        'schadensmeldung_id, fahrrad_id, rahmennummer, typ_code, gemeldet_am, ' +
        'melderart, kategorie, beschreibung, schwere, status, offen_seit, auftraege',
        (q) => q.in('status', ['offen', 'in_arbeit']).order('gemeldet_am'));

    const fehler = letzterLadeFehler('v_wawi_schaden');
    if (fehler) {
        // meldeVorgang statt melde: siehe Kommentar bei meldeVorgang() in
        // rahmen.js und bei flotteAufbauen() in flotte.js.
        zeigeFilterleiste(vorgang, false, null);
        meldeVorgang(vorgang, t('msg.damageLoadFailed', { fehler }), 'schlecht');
        return;
    }

    if (schaeden.length === 0) {
        // Eine leere Liste ist kein leerer Kasten. Sie sagt, WARUM nichts
        // da ist, und BIETET AN, was als Naechstes zu tun waere. Ein
        // Mitarbeiter, der am Montag hier landet, soll nicht raten, ob
        // die Software kaputt ist - das ist der eigentliche Lehrpunkt
        // dieser Aufgabe (siehe Dateikopf).
        //
        // KEIN Filter bei einer wirklich leeren Liste - ein Filter ohne
        // eine einzige Zeile darunter waere Zierrat (siehe Kommentar bei
        // zeigeFilterleiste() in rahmen.js). Der Grenzfall "gefiltert
        // leer" (mindestens eine Meldung, aber keine passt) wird weiter
        // unten separat behandelt, MIT sichtbarem Filter.
        zeigeFilterleiste(vorgang, false, null);
        zeigeLeermaske(
            vorgang,
            t('empty.noOpenDamageTitle'),
            t('empty.noOpenDamageText'),
            darfRolle('werkstatt') ? { titel: t('button.reportDamage'), ausfuehren: schadenMeldenMaske } : null
        );
        meldeVorgang(vorgang, t('empty.noOpenDamageTitle'));
        return;
    }

    // Slider-Obergrenze aus den tatsaechlich geladenen Meldungen
    // gewonnen, nicht fest eingetragen - im heutigen Bestand liegen alle
    // fuenf offenen Meldungen um die zwoelf Stunden auseinander (siehe
    // Bericht), eine fest eingetragene Obergrenze (etwa 30 Tage) liesse
    // den Schieber ueber weite Strecken wirkungslos. Math.max(1, ...):
    // ein <input type="range"> mit min=max=0 liesse sich nicht bedienen,
    // waeren alle Meldungen taufrisch.
    const schieberMax = Math.max(1, Math.ceil(Math.max(...schaeden.map((s) => alterInStunden(s.offen_seit)))));
    if (instandhaltungFilterAlterStunden > schieberMax) instandhaltungFilterAlterStunden = 0;

    const sichtbar = schaeden.filter((s) =>
        (instandhaltungFilterSchwere.size === 0 || instandhaltungFilterSchwere.has(s.schwere))
        && alterInStunden(s.offen_seit) >= instandhaltungFilterAlterStunden);

    zeigeFilterleiste(vorgang, true, [
        {
            // Kein { wert: 'alle', ... } mehr in den Optionen - der
            // Rueckweg zu "Alle" ist ein eigener Knopf im
            // Mehrfachauswahl-Popup (mehrfachauswahlFeld() in rahmen.js).
            name: 'schwere', titel: t('field.schwere'), wert: instandhaltungFilterSchwere,
            optionen: [
                { wert: 'gering', text: t('schwere.gering') },
                { wert: 'mittel', text: t('schwere.mittel') },
                { wert: 'fahruntauglich', text: t('schwere.fahruntauglich') }
            ],
            beiAenderung: (neu) => { instandhaltungFilterSchwere = neu; instandhaltungAufbauen(); }
        },
        {
            name: 'alter', titel: t('field.minAge'), typ: 'schieber',
            min: 0, max: schieberMax, step: 1, wert: instandhaltungFilterAlterStunden,
            beschriftung: (stunden) => (stunden === 0 ? t('misc.allLowercase') : t('misc.atLeastValue', { n: zahlFormat(stunden), einheit: t('common.hourAbbrev') })),
            beiAenderung: (neu) => { instandhaltungFilterAlterStunden = neu; instandhaltungAufbauen(); }
        }
    ]);

    if (sichtbar.length === 0) {
        zeigeLeermaske(
            vorgang,
            t('empty.noDamageFilterTitle'),
            t('empty.noDamageFilterText'),
            {
                titel: t('common.filterResetTitle'),
                ausfuehren: async () => {
                    instandhaltungFilterSchwere = new Set();
                    instandhaltungFilterAlterStunden = 0;
                    await instandhaltungAufbauen();
                }
            }
        );
        meldeVorgang(vorgang, t('empty.noDamageFilterTitle'));
        return;
    }

    zeigeListe(vorgang, sichtbar, [
        { feld: 'rahmennummer', titel: t('field.rad') },
        { feld: 'kategorie',    titel: t('field.kategorie') },
        {
            feld: 'schwere', titel: t('field.schwere'),
            // filterbar:false (Spaltenkopf-Baustein, rahmen.js): der
            // Schwere-Filter oben (instandhaltungFilterSchwere) deckt
            // dieses Feld bereits ab - ein zweiter, unabhaengiger Filter
            // koennte sich damit widersprechen, siehe der lange
            // Kommentar bei zeigeListe() in rahmen.js.
            // sortierwert: 'gering'/'mittel'/'fahruntauglich' alphabetisch
            // sortiert wuerde 'fahruntauglich' vor 'gering' zeigen - der
            // Fehler, der in diesem Projekt schon einmal ein
            // fahruntaugliches Rad als "gering" hat erscheinen lassen
            // (siehe Auftrag). SCHWERE_RANG (siehe unten) traegt die
            // tatsaechliche Rangfolge, sortiert wird nach dem Wert, nicht
            // nach der Anzeige.
            filterbar: false,
            sortierwert: (z) => SCHWERE_RANG[z.schwere] ?? -1,
            formatieren: (wert) => t('schwere.' + wert),
            // Nur EIN Parameter (die ganze Zeile), nicht (s) wie im
            // Auftragstext: zeigeListe in rahmen.js ruft eine
            // Funktions-Spalte als spalte.klasse(zeile) auf, nicht
            // spalte.klasse(wert) - derselbe Fund wie statusKlasse in
            // flotte.js, die frei-Spalte in stationen.js und die
            // status-Spalte in kunden.js (siehe dortige Kommentare),
            // hier zum vierten Mal.
            klasse: (z) => (z.schwere === 'fahruntauglich' ? 'schlecht' : z.schwere === 'mittel' ? 'warnung' : '')
        },
        { feld: 'gemeldet_am',  titel: t('field.gemeldet') },
        {
            feld: 'offen_seit', titel: t('field.offenSeit'), formatieren: alterKurz,
            // filterbar:false: der Mindestalter-Schieber oben deckt
            // dieses Feld bereits ab, und praeziser (eine echte
            // Stundenschwelle statt einer aus den geladenen Werten
            // geratenen) - ein zweiter Filter waere hier nicht nur
            // ueberfluessig, sondern schwaecher als der vorhandene.
            // sortierwert: offen_seit ist ein Postgres-Intervalltext
            // ("2 days 03:05:00") - als Text sortiert laege "10 Tage" vor
            // "2 Tage" (die Ziffer '1' < '2'). alterInStunden() (siehe
            // unten, fuer den Schieber ohnehin schon vorhanden) liefert
            // die tatsaechlich vergleichbare Zahl.
            filterbar: false,
            sortierwert: (z) => alterInStunden(z.offen_seit)
        },
        { feld: 'status',       titel: t('field.stand'), formatieren: (wert) => statusAnzeige(wert) }
    ], schadenMaske, schadenZeilenAktionen);

    const dringend = sichtbar.filter((s) => s.schwere === 'fahruntauglich').length;
    const zusatz = sichtbar.length === schaeden.length ? '' : ` ${t('common.of')} ${zahlFormat(schaeden.length)}`;
    meldeVorgang(vorgang, dringend
        ? t('msg.openDamageWithUnrideable', { n: zahlFormat(sichtbar.length), zusatz, dringend: zahlFormat(dringend) })
        : t('msg.openDamageCount', { n: zahlFormat(sichtbar.length), zusatz }));
}

// Rangfolge von schwere, fuer die sortierwert-Eigenschaft der
// Schwere-Spalte in schaedenZeigen() oben (Spaltenkopf-Sortieren,
// rahmen.js) - alphabetisch stuende 'fahruntauglich' vor 'gering',
// genau der Fehler, der in diesem Projekt schon einmal ein
// fahruntaugliches Rad als "gering" hat erscheinen lassen (siehe
// Auftrag). Dieselben drei Werte wie im Schwere-Filter oben
// (instandhaltungFilterSchwere).
const SCHWERE_RANG = { gering: 0, mittel: 1, fahruntauglich: 2 };

// offen_seit kommt als Postgres-Intervall-Text (IntervalStyle 'postgres')
// ueber PostgREST herein, z. B. "2 days 03:05:00.123456", "05:03:10" oder
// "1 day" - nachgemessen gegen die echte Datenbank (siehe Bericht), nicht
// vermutet. Nur hier gebraucht, deshalb keine eigene Datei.
function alterKurz(intervall) {
    if (!intervall) return '';
    const tageMatch = intervall.match(/(\d+)\s+days?/);
    const tage = tageMatch ? Number(tageMatch[1]) : 0;
    if (tage > 0) return mengeFormat(tage, 'tag');

    const zeitMatch = intervall.match(/(\d+):(\d+):(\d+)/);
    const stunden = zeitMatch ? Number(zeitMatch[1]) : 0;
    if (stunden > 0) return mengeFormat(stunden, 'stunde');

    const minuten = zeitMatch ? Number(zeitMatch[2]) : 0;
    return minuten > 0 ? mengeFormat(minuten, 'minute') : t('misc.justNow');
}

// Denselben Intervall-Text wie alterKurz() (siehe dort) in eine Zahl in
// Stunden gewandelt - fuer den Alters-Schieber (Vergleich, Sortierung
// der Obergrenze), waehrend alterKurz() fuer die Tabellenzelle eine grob
// gerundete, LESBARE Form liefert. Beide lesen denselben Text mit
// unterschiedlichem Ziel, deshalb zwei Funktionen statt einer mit einem
// zusaetzlichen Modus-Parameter.
function alterInStunden(intervall) {
    if (!intervall) return 0;
    const tageMatch = intervall.match(/(\d+)\s+days?/);
    const tage = tageMatch ? Number(tageMatch[1]) : 0;
    const zeitMatch = intervall.match(/(\d+):(\d+):(\d+)/);
    const stunden = zeitMatch ? Number(zeitMatch[1]) : 0;
    const minuten = zeitMatch ? Number(zeitMatch[2]) : 0;
    return tage * 24 + stunden + minuten / 60;
}

// Gemeinsame Handlungsliste fuer schadenMaske() (Knopf in der
// Detailmaske) UND schadenZeilenAktionen() (Icon in der Zeile, Punkt 3
// der Gestaltung) - dieselbe Regel (Rolle, Status), einmal formuliert,
// nicht zweimal gepflegt. Dieselbe Machart wie radHandlungen() in
// flotte.js.
function schadenHandlungen(schaden) {
    const handlungen = [];

    // Nur anbieten, solange die Meldung noch offen ist - bei 'in_arbeit'
    // laeuft schon ein Auftrag (schaden.auftraege >= 1), ein zweiter waere
    // keine Korrektur, sondern eine Verdopplung. api_auftrag_eroeffnen
    // prueft das nicht selbst (sie lehnt nur eine Meldung ab, die nicht
    // zu DIESEM Rad gehoert - siehe 0019_wawi_logik.sql) - die Maske darf
    // den unsinnigen Aufruf trotzdem nicht anbieten.
    if (darfRolle('werkstatt') && schaden.status === 'offen') {
        handlungen.push({
            titel: t('button.openWorkOrder'),
            // 'schaffend' statt 'haupt' (Punkt 4 der Gestaltung, gruen):
            // eroeffnet einen neuen Wartungsauftrag, siehe Begruendung bei
            // der art-Erlaeuterung von zeigeMaske() in rahmen.js. Das
            // "Erledigen" weiter unten in auftragMaske() (einen
            // BESTEHENDEN Auftrag abschliessen) bleibt bewusst bei 'haupt'.
            art: 'schaffend',
            ausfuehren: async () => {
                await auftragEroeffnen(schaden);
                await instandhaltungAufbauen();
            }
        });
    }

    return handlungen;
}

// Feather "clipboard" mit Plus - "Auftrag eröffnen". Die einzige
// Handlung aus schadenHandlungen() ist 'schaffend', keine 'gefaehrliche'
// - anders als radZeilenAktionen() in flotte.js muss hier deshalb nichts
// herausgefiltert werden (siehe Kommentar dort fuer den Fall, der es
// erfordert).
const SCHADEN_ICONS = {
    auftrag: '<svg viewBox="0 0 24 24"><rect x="5" y="3" width="14" height="18" rx="2"/>' +
        '<path d="M9 3h6v3H9z"/><path d="M12 11v6M9 14h6"/></svg>'
};

// Fuenfter Parameter von zeigeListe() (Punkt 3 der Gestaltung): wer nur
// einen Auftrag eroeffnen will, muss die Zeile dafuer nicht erst
// oeffnen - "Erledigen" in auftragMaske() weiter unten bekommt dagegen
// KEIN Icon: es braucht die Arbeitszeit (und optional eine Bemerkung)
// aus der offenen Maske, ist also kein in sich abgeschlossener,
// zeilenbezogener Klick wie "Speichern" in kunden.js.
function schadenZeilenAktionen(schaden) {
    return schadenHandlungen(schaden).map((h) => ({
        titel: h.titel,
        svg: SCHADEN_ICONS.auftrag,
        ausfuehren: h.ausfuehren
    }));
}

function schadenMaske(schaden) {
    const knoepfe = schadenHandlungen(schaden);

    // Querverweis (Gestaltungsauftrag Punkt 3, wörtlich genannt):
    // "Schadensmeldung -> das Rad". darfBereich() zuerst - eine Rolle,
    // die Flotte nicht sehen darf, bekommt den Knopf nicht angeboten.
    // Bekannte Grenze: waehleZeileMit() (rahmen.js) findet die Zeile nur
    // in der bereits GELADENEN und noch aktiv GEFILTERTEN Flottenliste
    // (flotteFilterStatus/-Typ/-Standort ueberleben einen Bereichswechsel
    // absichtlich, siehe deren Kommentar in flotte.js) - steht das Rad
    // hinter einem stehengebliebenen Filter (etwa "nur verfuegbar", ein
    // gemeldetes Rad ist aber oft 'defekt'), springt der Sprung zwar in
    // die Flotte, waehlt die Zeile aber nicht aus. Kein Absturz, keine
    // falsche Auswahl - nur ein stiller Rest, den ein eigener
    // "Filter zuruecksetzen"-Aufruf hier vermeiden koennte, aber auf
    // Kosten eines fremden Bereichs, der ungefragt seinen Filterzustand
    // verliert, nur weil irgendwo ein Sprung hinfuehrte.
    if (darfBereich('flotte')) {
        knoepfe.push({
            titel: t('button.bikeInFleet'),
            art: 'neben',
            ausfuehren: () => bereichSprung('flotte', t('nav.originDamageReport', { rahmennummer: schaden.rahmennummer }),
                () => waehleZeileMit('fahrrad_id', schaden.fahrrad_id))
        });
    }

    zeigeMaske(t('misc.reportForBike', { rahmennummer: schaden.rahmennummer }), [
        { name: 'rahmennummer', titel: t('field.rad'),        wert: `${schaden.rahmennummer} (${schaden.typ_code})`, nurLesen: true },
        { name: 'melderart',    titel: t('field.gemeldetVon'), wert: schaden.melderart, nurLesen: true },
        { name: 'gemeldet_am',  titel: t('field.gemeldetAm'),  wert: schaden.gemeldet_am, nurLesen: true },
        { name: 'kategorie',    titel: t('field.kategorie'),    wert: schaden.kategorie, nurLesen: true },
        { name: 'beschreibung', titel: t('field.beschreibung'), wert: schaden.beschreibung, typ: 'mehrzeilig', nurLesen: true },
        { name: 'schwere',      titel: t('field.schwere'),      wert: t('schwere.' + schaden.schwere), nurLesen: true },
        { name: 'status',       titel: t('field.stand'),        wert: statusAnzeige(schaden.status), nurLesen: true },
        { name: 'auftraege',    titel: t('field.bisherigeAuftraege'), wert: zahlFormat(schaden.auftraege), nurLesen: true },
        // Schritt 3 des Auftrags verlangt genau diesen Hinweis, GENAU
        // HIER: ein fahruntauglicher Schaden an einem Rad IN FAHRT sperrt
        // es nicht sofort (GR13 - ein Rad unterwegs behaelt seinen
        // Status), sondern erst bei der Rueckgabe (fn_ausleihe_beenden,
        // db/aufbau/0009_geschaeftslogik.sql). Ohne diesen Satz sieht es
        // aus, als haette eine fahruntaugliche Meldung an einem
        // ausgeliehenen Rad nicht gewirkt - dabei hat sie nur noch nicht
        // gewirkt. Am realen Rad 599 (Erprobung, siehe Bericht)
        // nachgestellt: Meldung angelegt, Radstatus blieb 'ausgeliehen'.
        {
            name: 'hinweis_fahrt', titel: t('field.hinweis'), typ: 'mehrzeilig', nurLesen: true,
            wert: schaden.schwere === 'fahruntauglich'
                ? t('misc.damageBlocksImmediately')
                : t('misc.onlyUnrideableBlocks')
        }
    ], knoepfe);
}

// ===== Ein Schaden melden =====

async function schadenMeldenMaske() {
    // Kennung des Bereichs-Vorgangs, der lief, als dieser Knopf gedrueckt
    // wurde - dieselbe Absicherung wie bei radAnlegenMaske() in flotte.js
    // (WICHTIG 4, siehe Begruendung bei laufenderVorgang() in rahmen.js).
    // Diese Maske laedt selbst nach (die Flotte, siehe unten), bevor sie
    // ueberhaupt eine Maske zeigt - ein Reiterwechsel zu "Wartungsaufträge"
    // oder ein Bereichswechsel WAEHREND dieses Ladens duerfte die dann
    // veraltete Maske nicht mehr ueber den neuen Bildschirm legen.
    const vorgang = laufenderVorgang();

    // v_wawi_flotte ist fuer dieselbe Rolle sichtbar wie der Knopf, der
    // hierher fuehrt (werkstatt, siehe Bereichsrollen oben und
    // 0018_wawi_sichten.sql) - eine leere Auswahlliste hiesse hier also
    // einen technischen Fehler, keine fehlende Berechtigung.
    const raeder = await ladeListe('v_wawi_flotte',
        'fahrrad_id, rahmennummer, typ_code, status',
        // Ausgemusterte Raeder faellt niemand mehr auf, an ihnen wird
        // nichts mehr repariert - dieselbe Ausblendung wie beim
        // Statuswechsel-Knopf in flotte.js.
        (q) => q.neq('status', 'ausgemustert').order('rahmennummer'));

    // Siehe radAnlegenMaske() in flotte.js: ein inzwischen ueberholter
    // Vorgang schreibt nichts mehr, weder Fehler noch Maske.
    if (!istAktuellerVorgang(vorgang)) return;

    const fehler = letzterLadeFehler('v_wawi_flotte');
    if (fehler) {
        melde(t('msg.fleetLoadFailed', { fehler }), 'schlecht');
        return;
    }
    if (!raeder.length) {
        melde(t('msg.noBikeForDamage'), 'schlecht');
        return;
    }

    zeigeMaske(t('button.reportDamage'), [
        {
            name: 'fahrrad_id', titel: t('field.rad'), wert: raeder[0].fahrrad_id,
            optionen: raeder.map((r) => ({
                wert: r.fahrrad_id,
                text: `${r.rahmennummer} · ${r.typ_code} · ${statusAnzeige(r.status)}`
            }))
        },
        { name: 'kategorie', titel: t('field.kategorie'), wert: '' },
        { name: 'beschreibung', titel: t('field.beschreibung'), wert: '', typ: 'mehrzeilig' },
        {
            name: 'schwere', titel: t('field.schwere'), wert: 'gering',
            optionen: [
                { wert: 'gering', text: t('schwere.gering') },
                { wert: 'mittel', text: t('schwere.mittel') },
                { wert: 'fahruntauglich', text: t('schwere.fahruntauglich') }
            ]
        }
    ], [
        {
            titel: t('button.report'),
            // 'schaffend' statt 'haupt' (Punkt 4 der Gestaltung, gruen):
            // legt eine neue Schadensmeldung an, siehe Begruendung bei
            // der art-Erlaeuterung von zeigeMaske() in rahmen.js.
            art: 'schaffend',
            ausfuehren: async () => {
                const fahrradId = Number(document.getElementById('feld-maske-fahrrad_id').value);
                const kategorie = document.getElementById('feld-maske-kategorie').value.trim();
                const beschreibung = document.getElementById('feld-maske-beschreibung').value.trim();
                const schwere = document.getElementById('feld-maske-schwere').value;

                if (!kategorie || !beschreibung) {
                    melde(t('msg.categoryDescriptionRequired'), 'schlecht');
                    return;
                }

                await schadenMelden(fahrradId, kategorie, beschreibung, schwere);
                await instandhaltungAufbauen();
            }
        }
    ]);
}

// Ein fahruntauglicher Schaden setzt das Rad sofort auf 'defekt' - das
// tut api_schaden_melden von sich aus, es haengt nicht daran, ob jemand
// daran denkt. Ausnahme: ein Rad in Fahrt behaelt 'ausgeliehen', weil
// GR13 einem Rad unterwegs keinen anderen Status erlaubt. Bei der
// Rueckgabe prueft fn_ausleihe_beenden dann selbst und setzt 'defekt'
// statt 'verfuegbar'. Sag das in der Maske: sonst sieht es aus, als
// haette die Meldung nicht gewirkt.
async function schadenMelden(fahrradId, kategorie, beschreibung, schwere) {
    const id = await rufeAuf('api_schaden_melden', {
        p_fahrrad_id: fahrradId, p_kategorie: kategorie,
        p_beschreibung: beschreibung, p_schwere: schwere
    });
    melde(schwere === 'fahruntauglich'
        ? t('msg.damageReportedBlocked', { id })
        : t('msg.damageReported', { id }), 'gut');
    return id;
}

// api_auftrag_eroeffnen prueft, dass die Meldung zu DIESEM Rad gehoert.
// Die Maske muss das nicht noch einmal pruefen - aber sie darf das Rad
// auch nicht frei waehlen lassen, sonst provoziert sie die Ablehnung.
async function auftragEroeffnen(schaden) {
    const id = await rufeAuf('api_auftrag_eroeffnen', {
        p_fahrrad_id: schaden.fahrrad_id,
        p_schadensmeldung_id: schaden.schadensmeldung_id
    });
    melde(t('msg.workOrderOpened', { id }), 'gut');
}

// ===== Wartungsaufträge =====

async function auftraegeZeigen(vorgang) {
    // Kein Filter in diesem Unterreiter (Gestaltungsauftrag, Punkt 2:
    // "nach Schwere, nach Alter DER MELDUNG" - beides Eigenschaften einer
    // Schadensmeldung, nicht eines Auftrags) - und deshalb ausdruecklich
    // ABGERAEUMT: die Filterleiste ist ein find-or-create-Element wie die
    // Werkzeugleiste (siehe deren Kommentar in rahmen.js) und ueberlebt
    // sonst unveraendert einen Unterreiterwechsel weg von "Offene
    // Schäden" - dieselbe Karteileichen-Falle, die die Werkzeugleiste
    // hier schon einmal hatte.
    zeigeFilterleiste(vorgang, false, null);

    const auftraege = await ladeListe('v_wawi_auftrag',
        'wartungsauftrag_id, auftragsnummer, fahrrad_id, rahmennummer, schadensmeldung_id, ' +
        'eroeffnet_am, erledigt_am, status, arbeitszeit_minuten, bemerkung, bearbeiter',
        (q) => q.in('status', ['offen', 'in_arbeit']).order('eroeffnet_am'));

    const fehler = letzterLadeFehler('v_wawi_auftrag');
    if (fehler) {
        meldeVorgang(vorgang, t('msg.workOrdersLoadFailed', { fehler }), 'schlecht');
        return;
    }

    if (auftraege.length === 0) {
        zeigeLeermaske(
            vorgang,
            t('empty.noWorkOrdersTitle'),
            t('empty.noWorkOrdersText'),
            {
                titel: t('button.toOpenDamage'),
                ausfuehren: async () => { unterbereich = 'schaeden'; await instandhaltungAufbauen(); }
            }
        );
        meldeVorgang(vorgang, t('empty.noWorkOrdersTitle'));
        return;
    }

    zeigeListe(vorgang, auftraege, [
        { feld: 'rahmennummer',    titel: t('field.rad') },
        { feld: 'auftragsnummer',  titel: t('field.auftrag') },
        { feld: 'status',          titel: t('field.stand'), formatieren: (wert) => statusAnzeige(wert),
          klasse: (z) => (z.status === 'offen' ? 'warnung' : '') },
        { feld: 'eroeffnet_am',    titel: t('field.eroeffnet') },
        { feld: 'bearbeiter',      titel: t('field.bearbeiter'), formatieren: (w) => w || '—' }
    ], auftragMaske);

    meldeVorgang(vorgang, t('msg.activeWorkOrdersCount', { n: zahlFormat(auftraege.length) }));
}

function auftragMaske(auftrag) {
    const knoepfe = [];

    if (darfRolle('werkstatt')) {
        knoepfe.push({
            titel: t('button.resolve'),
            art: 'haupt',
            ausfuehren: async () => {
                const minutenText = document.getElementById('feld-maske-arbeitszeit_minuten').value.trim();
                const minuten = Number(minutenText);
                if (!minutenText || !Number.isInteger(minuten) || minuten < 0) {
                    // Dieselbe Grenze wie der Check wartungsauftrag_arbeitszeit_chk
                    // (0015_bereich_i_instandhaltung.sql) - eine negative
                    // oder fehlende Arbeitszeit provoziert nur die Absage
                    // der Datenbank, ohne dass die Maske vorher etwas
                    // gewonnen haette.
                    melde(t('misc.noMinutesNeeded'), 'schlecht');
                    return;
                }
                const bemerkung = document.getElementById('feld-maske-bemerkung').value.trim();
                await auftragErledigen(auftrag, minuten, bemerkung || null);
                await instandhaltungAufbauen();
            }
        });
    }

    zeigeMaske(t('misc.workOrderTitle', { auftragsnummer: auftrag.auftragsnummer }), [
        { name: 'rahmennummer', titel: t('field.rad'),       wert: auftrag.rahmennummer, nurLesen: true },
        { name: 'status',       titel: t('field.stand'),     wert: statusAnzeige(auftrag.status), nurLesen: true },
        { name: 'eroeffnet_am', titel: t('field.eroeffnet'),  wert: auftrag.eroeffnet_am, nurLesen: true },
        { name: 'bearbeiter',   titel: t('field.bearbeiter'), wert: auftrag.bearbeiter || t('misc.notYetAssigned'), nurLesen: true },
        // Editierbar: erst beim Erledigen traegt die Datenbank sie ein
        // (api_auftrag_erledigen, siehe 0019_wawi_logik.sql) - vorher
        // stehen sie leer. Nur editierbar fuer werkstatt: ohne den
        // "Erledigen"-Knopf (siehe oben) waere ein Eintippen hier eine
        // Sackgasse ohne Weg zum Speichern - dieselbe Ueberlegung wie
        // "was man nicht darf, wird nicht angezeigt", hier auf ein Feld
        // statt einen Knopf angewendet.
        { name: 'arbeitszeit_minuten', titel: t('field.arbeitszeitMinuten'), wert: auftrag.arbeitszeit_minuten ?? '', typ: 'zahl', nurLesen: !darfRolle('werkstatt') },
        { name: 'bemerkung', titel: t('field.bemerkung'), wert: auftrag.bemerkung || '', typ: 'mehrzeilig', nurLesen: !darfRolle('werkstatt') }
    ], knoepfe);
}

// Beim Erledigen wird das Rad NUR frei, wenn kein anderer Schaden offen
// ist. Das entscheidet die Datenbank; die Maske soll das Ergebnis
// nachlesen und melden, nicht vorhersagen.
async function auftragErledigen(auftrag, minuten, bemerkung) {
    await rufeAuf('api_auftrag_erledigen', {
        p_wartungsauftrag_id: auftrag.wartungsauftrag_id,
        p_arbeitszeit_minuten: minuten, p_bemerkung: bemerkung
    });
    melde(t('msg.workOrderCompleted', { auftragsnummer: auftrag.auftragsnummer }), 'gut');
}
