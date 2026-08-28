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
// Anzeigeform eines Zeitstempels in einer Tabellenspalte - Tag, Monat,
// Jahr, ohne Uhrzeit. Dieselbe Form, die die Kundschaft ueber
// kundenDatumFormat() schon benutzt (kunden.js); die Uhrzeit einer
// Schadensmeldung interessiert in der Uebersicht nicht, das Alter steht
// ohnehin in der Nachbarspalte "Offen seit". datumFormat() aus rahmen.js
// folgt dabei der eingestellten Sprache, nicht fest de-DE.
const ZEITSTEMPEL_FORMAT = { day: '2-digit', month: '2-digit', year: 'numeric' };

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
    aufbauen: instandhaltungAufbauen,
    // EINE SUCHE, IN JEDEM BEREICH (Gestaltungsauftrag Punkt 5) - siehe
    // spaltenkopfSuchtext in rahmen.js. Beide Unterreiter laden ihre
    // Zeilen vollstaendig, der Tabellenbaustein sucht darueber.
    suchePlatzhalterSchluessel: 'nav.instandhaltungSuche'
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

// ===== HIER STAND DER EIGENE FILTERZUSTAND DER INSTANDHALTUNG =====
//
// Zwei modulweite Werte (Schwere als Set, Mindestalter in Stunden) und
// eine eigene Filterleiste ueber der Liste. Mit Punkt 5 des
// Gestaltungsauftrags sind beide entfallen - die Filter selbst nicht,
// nur ihr Ort: sie sitzen jetzt in den Spaltenkoepfen "Schwere" und
// "Offen seit" (siehe schaedenZeigen() weiter unten und
// spaltenkopfFilterknopf() in rahmen.js). Dieselbe Begruendung wie bei
// der Flotte, ausfuehrlich dort: beide filterten clientseitig ueber
// Spalten, die in derselben Tabelle stehen, und beide zwangen genau
// diese Spalten zu filterbar:false, damit sich nicht zwei Bedienelemente
// auf demselben Feld widersprechen.
//
// DER MINDESTALTER-SCHIEBER, und was aus ihm geworden ist: er war das
// einzige Bedienelement dieser Oberflaeche, das man nicht ohne Weiteres
// in einen Spaltenkopf umziehen konnte, aus zwei Gruenden - und beide
// sind geloest, nicht umgangen:
//   1. offen_seit ist ein Postgres-Intervalltext ("2 days 03:05:00").
//      Eine Schwelle darauf waere ein Textvergleich gewesen. Der
//      Spaltenfilter vergleicht seit dem Umbau ueber spaltenWert() -
//      also ueber dasselbe sortierwert(), nach dem die Spalte schon
//      immer SORTIERT hat (alterInStunden). Filtern und Sortieren
//      folgen damit derselben Regel "nach Wert, nicht nach Anzeige".
//   2. Der Schieber zeigte neben sich "≥ 3 Std." statt einer nackten
//      Zahl. Genau dafuer gibt es jetzt filterBeschriftung an der Spalte
//      (siehe unten) - die Angabe bleibt lesbar, im selben Wortlaut.
// Was tatsaechlich wegfaellt, ist die BEDIENFORM: ein Zahlenfeld statt
// eines Schiebers. Bewusst so - ein Schieber braucht eine Obergrenze,
// und die musste bisher aus den geladenen Meldungen GERATEN werden
// (Math.max ueber alle Alter); bei sieben Meldungen ergab das eine
// Skala, die sich mit jeder neuen Meldung verschob. Eine getippte
// Stundenzahl hat dieses Problem nicht.

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

    // ALLE Schadensmeldungen und ALLE Wartungsauftraege, unabhaengig vom
    // aktiven Unterreiter und unabhaengig von den Filtern unten: die
    // Kopftafel zeigt jeden der sieben Faelle EINZELN (siehe
    // instandhaltungKopftafel() weiter unten), also auch die zwei bereits
    // behobenen, die in keiner der beiden Listen darunter mehr
    // auftauchen (beide filtern auf offen/in_arbeit).
    //
    // ZWEI VOLLE LADEANFRAGEN STATT VIER ZAEHL-ANFRAGEN, anders als
    // bisher: solange der Kopf nur vier Zahlen zeigte, war zaehleZeilen()
    // die ehrlichere Wahl (es behauptete nicht, Zeilen geladen zu haben,
    // die niemand ansieht). Jetzt sieht sie jemand - jede einzelne. Und
    // sieben plus drei Zeilen sind kein Preis: es sind weniger Daten als
    // eine einzige der frueheren Zaehlanfragen an Netzverkehr kostete.
    const [alleSchaeden, alleAuftraege, modelleFuerTypnamen] = await Promise.all([
        ladeListe('v_wawi_schaden',
            'schadensmeldung_id, rahmennummer, typ_code, gemeldet_am, kategorie, ' +
            'schwere, status, auftraege',
            (q) => q.order('gemeldet_am')),
        ladeListe('v_wawi_auftrag',
            'wartungsauftrag_id, schadensmeldung_id, status, arbeitszeit_minuten'),
        ladeListe('v_wawi_modell', 'typ_code, typ')
    ]);
    zeigeKopftafel(vorgang, instandhaltungKopftafel(
        alleSchaeden, alleAuftraege,
        // v_wawi_schaden traegt nur typ_code, keinen ausgeschriebenen
        // Namen (siehe deren Spaltenliste) - v_wawi_modell dagegen schon.
        // Neun Modellzeilen statt einer eigens angelegten
        // Uebersetzungstabelle nur fuer drei Radtypnamen, die ohnehin
        // schon in der Datenbank stehen.
        new Map(modelleFuerTypnamen.map((m) => [m.typ_code, m.typ]))));

    if (unterbereich === 'schaeden') await schaedenZeigen(vorgang);
    else                             await auftraegeZeigen(vorgang);
}

// ===== Kopftafel der Instandhaltung =====
//
// HIER IST DIE ZEILE DER FALL SELBST - und das ist keine Ausnahme vom
// Muster, sondern seine Regel: "die Zeile ist die feinste Gliederung,
// die noch in den Kopf passt" (siehe zeigeKopftafel() in rahmen.js).
// Bei 275 Raedern sind das fuenf Modellzeilen, bei 1014 Kunden fuenf
// Tarifgruppen - bei SIEBEN Schadensmeldungen sind es die sieben
// Meldungen. Eine Gliederung waere hier nicht feiner als die Sache
// selbst, sondern groeber.
//
// KEINE KENNZAHLEN, UND ZWAR AUSDRUECKLICH (Auftrag, woertlich: "Bei
// dieser Menge sind Kennzahlen schnell albern"). Die sieben Meldungen
// wurden alle am selben Tag erfasst; jede Zeitkennzahl ("mittlere
// Bearbeitungsdauer", "Meldungen je Woche", "Quote je Radtyp") waere
// eine Statistik ueber eine Stichprobe von sieben, von denen zwei
// erledigt sind - sie spraenge beim naechsten erledigten Auftrag um
// zweistellige Prozentwerte und behauptete dabei eine Genauigkeit, die
// die Daten nicht hergeben. Deshalb hat diese Tafel als einzige der
// fuenf KEINE Abweichungsspalte: es gibt keinen Bezugswert, gegen den
// ehrlich zu messen waere. Die Fussnote sagt das, statt die Luecke zu
// verschweigen oder mit einem Platzhalter zu fuellen.
//
// WAS DIE TAFEL DAFUER ZEIGT, UND DIE LISTE DARUNTER NICHT KANN: sie
// verbindet DREI Quellen in einer Zeile - die Meldung (v_wawi_schaden),
// ihren Wartungsauftrag (v_wawi_auftrag) und dessen erfasste Arbeitszeit.
// Die beiden Unterreiter darunter zeigen ENTWEDER Meldungen ODER
// Auftraege, nie beides nebeneinander; welcher Schaden ueberhaupt schon
// einen Auftrag hat und wie viel daran gearbeitet wurde, steht in keiner
// der beiden Listen.
//
// DIE BILDER (Auftrag, woertlich: "hätte ich auch gern die schönen
// Bilder der Räder wie bei Flotte") stehen jetzt als EIN Bild in der
// Tafelbeschriftung statt als drei Kacheln darunter - und dieses eine
// Bild TRAEGT den Befund: alle sieben Meldungen betreffen City-Bikes.
// Drei Kacheln, von denen zwei "0" zeigen, sagten dasselbe mit dreimal
// so viel Flaeche. Sind mehrere Radtypen betroffen, entfaellt das Bild
// (siehe unten) - dann waere ein einzelnes Bild schlicht falsch.
function instandhaltungKopftafel(schaeden, auftraege, radtypNamen) {
    if (!schaeden || schaeden.length === 0) return null;

    // Auftrag je Meldung. Eine Meldung KANN mehrere Auftraege haben
    // (v_wawi_schaden.auftraege zaehlt sie) - im heutigen Bestand hat
    // keine mehr als einen. Die Arbeitszeit wird deshalb SUMMIERT, nicht
    // "der erste Auftrag gewinnt": eine zweite Reparatur am selben
    // Schaden ist zusaetzliche Arbeit, kein Ersatz fuer die erste.
    const arbeitJeMeldung = new Map();
    for (const auftrag of auftraege || []) {
        if (auftrag.schadensmeldung_id == null) continue;
        const bisher = arbeitJeMeldung.get(auftrag.schadensmeldung_id) || { minuten: 0, auftraege: 0 };
        bisher.minuten += Number(auftrag.arbeitszeit_minuten) || 0;
        bisher.auftraege += 1;
        arbeitJeMeldung.set(auftrag.schadensmeldung_id, bisher);
    }

    const zeilen = [...schaeden].sort((a, b) => {
        // Schwerster Schaden zuoberst, bei gleicher Schwere der aelteste
        // zuerst - die Reihenfolge, in der eine Werkstatt sie abarbeiten
        // wuerde, nicht die der Datenbankschluessel.
        const schwere = (INSTANDHALTUNG_SCHWERE_STUFE[b.schwere] || 0) - (INSTANDHALTUNG_SCHWERE_STUFE[a.schwere] || 0);
        if (schwere !== 0) return schwere;
        return String(a.gemeldet_am).localeCompare(String(b.gemeldet_am));
    }).map((schaden) => ({
        ...schaden,
        minuten: (arbeitJeMeldung.get(schaden.schadensmeldung_id) || { minuten: 0 }).minuten,
        hatAuftrag: arbeitJeMeldung.has(schaden.schadensmeldung_id)
    }));

    const raeder = new Set(schaeden.map((s) => s.rahmennummer));
    const typCodes = [...new Set(schaeden.map((s) => s.typ_code).filter(Boolean))];
    const typName = (code) => (radtypNamen && radtypNamen.get(code)) || code;

    const tage = [...new Set(schaeden.map((s) => datumFormat(s.gemeldet_am)))];
    const laufend = zeilen.filter((z) => z.status !== 'behoben').length;
    const minutenGesamt = zeilen.reduce((s, z) => s + z.minuten, 0);

    return {
        titel: t('board.maintenanceTitle'),
        bezug: t('board.maintenanceReference', {
            schadenPhrase: mengeFormat(schaeden.length, 'schadensmeldung'),
            raederPhrase: mengeFormat(raeder.size, 'rad'),
            typen: typCodes.map(typName).join(', '),
            auftraegePhrase: mengeFormat((auftraege || []).length, 'auftrag'),
            tag: tage.length === 1 ? tage[0] : `${tage[tage.length - 1]} - ${tage[0]}`
        }),
        // NUR bei genau EINEM betroffenen Radtyp - sonst behauptete das
        // Bild eine Eindeutigkeit, die es nicht gibt (siehe Kopfkommentar).
        bild: typCodes.length === 1 && radtypBild(typCodes[0])
            ? { quelle: radtypBild(typCodes[0]), alt: typName(typCodes[0]) }
            : null,
        spalten: [
            {
                art: 'rubrik',
                titel: t('col.case'),
                wert: (z) => z.rahmennummer || t('col.together'),
                zusatz: (z) => (z.summenzeile ? null : z.kategorie)
            },
            {
                // ZAHL OHNE BALKEN (art:'zahl', siehe kopftafelZeile() in
                // rahmen.js). Die Arbeitszeit hat die Pruefung als
                // GRAFIK nicht bestanden, als ZAHL sehr wohl:
                // nachgezaehlt tragen fuenf der sieben Meldungen exakt
                // null Minuten (nur die beiden behobenen Faelle haben
                // einen erledigten Auftrag mit 45 bzw. 30 Minuten). Fuenf
                // Balken der Laenge null sind fuenf leere Zellen, in
                // denen "noch nicht bearbeitet" und "keine Angabe" gleich
                // aussehen - und die beiden uebrigen ergaeben einen
                // Vergleich zwischen zwei Werten, fuer den es keine
                // Grafik braucht.
                //
                // Die Zahl bleibt, weil sie eine Frage beantwortet ("was
                // hat die Werkstatt hier schon investiert") und weil die
                // Summe darunter (75 Minuten) der einzige Mengenwert
                // dieser Tafel ist.
                //
                // SIE TRAEGT ABER EINE GROESSENSKALA (skala: true, siehe
                // kopftafelSkala()/kopftafelZeile() in rahmen.js) - kein
                // Widerspruch zum fehlenden Balken, sondern die Folge
                // desselben Befunds. Der Einwand gegen den BALKEN war,
                // dass fuenf Balken der LAENGE NULL unsichtbar sind:
                // "noch nicht bearbeitet" und "keine Angabe" saehen
                // gleich aus. Eine ZAHL der Groesse null gibt es
                // dagegen nicht - die fuenf Nullen stehen beim kleinsten
                // Faktor 0,85 mit 11,9 px lesbar da, waehrend 30 auf
                // 17,0 px und 45 auf 18,2 px waechst (im Browser
                // nachgemessen). Genau der Kanal, der als Laenge
                // versagt, traegt hier also als Groesse: die beiden
                // bearbeiteten Faelle heben sich vom unbearbeiteten Rest
                // ab, ohne dass eine leere Zelle etwas verschweigen
                // muesste.
                //
                // Nullpunkt und gemeinsame Skala wie ueberall sonst:
                // Maximum ueber alle sieben Datenzeilen, Null bei null
                // Minuten. Die Summenzeile (75) bleibt draussen - sie
                // liegt ausserhalb der Skala, aus der sie
                // herausgerechnet wurde.
                art: 'zahl',
                skala: true,
                titel: t('col.workTime'),
                einheit: t('unit.minutes'),
                wert: (z) => z.minuten,
                format: (n) => zahlFormat(n)
            },
            {
                art: 'struktur',
                titel: t('col.severity'),
                einheit: t('unit.threeSteps'),
                segmente: (z) => {
                    const stufe = INSTANDHALTUNG_SCHWERE_STUFE[z.schwere] || 0;
                    return [
                        // t('schwere.'+code), NICHT statusAnzeige(): die
                        // Schwere ist ein eigener Aufzaehlungstyp mit
                        // eigener Uebersetzungsreihe (siehe die Filter-
                        // und Maskenfelder weiter unten, die sie schon
                        // immer so lesen) - statusAnzeige() kennt nur die
                        // Bearbeitungsstaende und haette den Rohwert
                        // unuebersetzt durchgereicht.
                        { wert: stufe, name: t('schwere.' + z.schwere),
                          klasse: INSTANDHALTUNG_SCHWERE_SEGMENT[z.schwere] || 'seg-ruhend' },
                        // Der unausgefuellte Rest der Leiter, in der
                        // Flaechenfarbe des Untergrunds: erst er macht aus
                        // dem Balken eine SKALA ("zwei von drei Stufen")
                        // statt einer beliebig langen Flaeche.
                        { wert: 3 - stufe, name: '', klasse: 'seg-leer' }
                    ];
                },
                beschriftung: (z) => t('board.maintenanceSeverityAria', {
                    rad: z.rahmennummer, schwere: t('schwere.' + z.schwere),
                    stufe: zahlFormat(INSTANDHALTUNG_SCHWERE_STUFE[z.schwere] || 0)
                })
            },
            {
                art: 'profil',
                titel: t('col.progress'),
                einheit: t('unit.reportedToFixed'),
                punkt: (z) => INSTANDHALTUNG_STAND_STUFE[z.status] ?? null,
                beschriftung: (z) => t('board.maintenanceProgressAria', {
                    rad: z.rahmennummer, stand: statusAnzeige(z.status, true),
                    auftrag: z.hatAuftrag ? t('board.maintenanceHasOrder') : t('board.maintenanceNoOrder')
                })
            }
        ],
        zeilen,
        summe: { summenzeile: true, rahmennummer: t('col.together'), minuten: minutenGesamt },
        fussnote: t('board.maintenanceFootnote', {
            schadenPhrase: mengeFormat(schaeden.length, 'schadensmeldung'),
            offen: zahlFormat(laufend),
            minuten: zahlFormat(minutenGesamt)
        })
    };
}

// Die Schwere ist eine ORDNUNG, keine Zahl - drei Stufen, aufsteigend.
// Als Zahl 1/2/3 nur, um sie auf einer Leiter von drei Stufen ZEICHNEN
// zu koennen; es wird nirgends damit gerechnet (kein Mittelwert, keine
// Summe - "die mittlere Schwere 1,86" waere genau die Art Kennzahl, die
// dieser Bereich nicht traegt, siehe Kopfkommentar).
const INSTANDHALTUNG_SCHWERE_STUFE = { gering: 1, mittel: 2, fahruntauglich: 3 };

// Farbe traegt Bedeutung: "fahruntauglich" ist ein Rad, das nicht mehr
// fahren darf - dieselbe Bedeutung, die --schlecht in dieser Oberflaeche
// ueberall hat. "mittel" ist eine Warnung, "gering" bloss eine Notiz.
const INSTANDHALTUNG_SCHWERE_SEGMENT = {
    gering: 'seg-ruhend',
    mittel: 'seg-warnung',
    fahruntauglich: 'seg-schlecht'
};

// Der Bearbeitungsstand als Lage auf einer dreistufigen Achse
// (gemeldet - in Arbeit - behoben). Position kodiert, nicht Laenge: eine
// beschnittene Achse waere hier zulaessig, es gibt aber gar keine, die
// man beschneiden koennte - die drei Stufen SIND die ganze Achse.
const INSTANDHALTUNG_STAND_STUFE = { offen: 0, in_arbeit: 1, behoben: 2 };

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
        // Der Grenzfall "gefiltert leer" (mindestens eine Meldung, aber
        // keine passt) braucht hier keine eigene Behandlung mehr: seit
        // die Filter im Spaltenkopf sitzen, faengt ihn der
        // Tabellenbaustein selbst mit einer Leerzeile INNERHALB der
        // Tabelle ab (baueLeerzeile() in rahmen.js) - Kopf und Filter
        // bleiben dabei bedienbar. Diese Leermaske gilt nur noch dem
        // ECHTEN Nichts: keine einzige offene Meldung im Bestand.
        zeigeLeermaske(
            vorgang,
            t('empty.noOpenDamageTitle'),
            t('empty.noOpenDamageText'),
            darfRolle('werkstatt') ? { titel: t('button.reportDamage'), ausfuehren: schadenMeldenMaske } : null
        );
        meldeVorgang(vorgang, t('empty.noOpenDamageTitle'));
        return;
    }

    zeigeListe(vorgang, schaeden, [
        { feld: 'rahmennummer', titel: t('field.rad') },
        { feld: 'kategorie',    titel: t('field.kategorie') },
        {
            feld: 'schwere', titel: t('field.schwere'),
            // filterbar:false ist entfallen (Gestaltungsauftrag Punkt 5):
            // der Schwere-Filter der frueheren Filterleiste sitzt jetzt
            // HIER, in seinem eigenen Spaltenkopf - EIN Feld, EIN
            // Bedienelement.
            // sortierwert: 'gering'/'mittel'/'fahruntauglich' alphabetisch
            // sortiert wuerde 'fahruntauglich' vor 'gering' zeigen - der
            // Fehler, der in diesem Projekt schon einmal ein
            // fahruntaugliches Rad als "gering" hat erscheinen lassen
            // (siehe Auftrag). SCHWERE_RANG (siehe unten) traegt die
            // tatsaechliche Rangfolge, sortiert wird nach dem Wert, nicht
            // nach der Anzeige.
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
        // formatieren NEU: gemeldet_am ist ein timestamptz und kam
        // deshalb als roher ISO-Zeitstempel aus PostgREST
        // ("2026-08-25T23:00:00+00:00") - genau so stand er auch in der
        // Spalte, waehrend dieselbe Art Angabe in der Kundschaft
        // ("Kunde seit", registriert_am) laengst als "06.02.2016"
        // erschien. Ein Feld, zwei Erscheinungsformen, je nach Bereich.
        // filterbar:false aus demselben Grund wie dort: der
        // Spaltenkopf-Filter vergleicht gegen den ROHEN Zellwert, ein im
        // Anzeigeformat getippter Suchtext faende dort nie einen
        // Treffer. Sortierbar bleibt die Spalte (Vorgabe) - ein
        // ISO-Zeitstempel sortiert als Text schon chronologisch.
        { feld: 'gemeldet_am',  titel: t('field.gemeldet'), filterbar: false,
          formatieren: (wert) => (wert ? datumFormat(wert, ZEITSTEMPEL_FORMAT) : '') },
        {
            feld: 'offen_seit', titel: t('field.offenSeit'), formatieren: alterKurz,
            // sortierwert: offen_seit ist ein Postgres-Intervalltext
            // ("2 days 03:05:00") - als Text sortiert laege "10 Tage" vor
            // "2 Tage" (die Ziffer '1' < '2'). alterInStunden() (siehe
            // unten) liefert die tatsaechlich vergleichbare Zahl.
            sortierwert: (z) => alterInStunden(z.offen_seit),
            // DER FRUEHERE MINDESTALTER-SCHIEBER, jetzt hier (siehe der
            // lange Kommentar oben, wo der Filterzustand stand).
            // filterTyp ausdruecklich 'schwelle' statt geraten: der ROHE
            // Zellwert ist ein Text, spaltenFilterTyp() haette daraus
            // 'text' geschlossen und ein Suchfeld angeboten, in dem
            // "2 days 03:05:00" zu tippen waere. Gefiltert wird gegen
            // sortierwert() (siehe zeichneArbeitstabelle() in rahmen.js),
            // also gegen Stunden - deshalb passt die Schwelle.
            filterTyp: 'schwelle',
            // Damit aus der Zahl wieder eine Angabe wird: "≥ 3 Std.",
            // derselbe Wortlaut, den der Schieber daneben schrieb.
            filterBeschriftung: (stunden) => t('misc.atLeastValue',
                { n: zahlFormat(stunden), einheit: t('common.hourAbbrev') })
        },
        { feld: 'status',       titel: t('field.stand'), formatieren: (wert) => statusAnzeige(wert) }
    ], schadenMaske, schadenZeilenAktionen);

    // Immer ueber ALLE offenen Meldungen gemeldet, nicht mehr ueber eine
    // gefilterte Teilmenge: wie viele Zeilen ein Spaltenfilter gerade
    // uebriglaesst, sagt der Tabellenbaustein unmittelbar ueber der
    // Tabelle (spaltenkopfHinweis() in rahmen.js) - dieselbe Auskunft ein
    // zweites Mal in der Statuszeile waere eine zweite Quelle, die
    // auseinanderlaufen kann. Die Zahl der FAHRUNTAUGLICHEN bleibt
    // dagegen genau richtig hier: sie ist keine Auskunft ueber die
    // Ansicht, sondern ueber den Bestand - "zwei Raeder fahren nicht"
    // gilt, ob man sie gerade sieht oder nicht.
    const dringend = schaeden.filter((s) => s.schwere === 'fahruntauglich').length;
    meldeVorgang(vorgang, dringend
        ? t('msg.openDamageWithUnrideable', { n: zahlFormat(schaeden.length), zusatz: '', dringend: zahlFormat(dringend) })
        : t('msg.openDamageCount', { n: zahlFormat(schaeden.length), zusatz: '' }));
}

// Rangfolge von schwere, fuer die sortierwert-Eigenschaft der
// Schwere-Spalte in schaedenZeigen() oben (Spaltenkopf-Sortieren,
// rahmen.js) - alphabetisch stuende 'fahruntauglich' vor 'gering',
// genau der Fehler, der in diesem Projekt schon einmal ein
// fahruntaugliches Rad als "gering" hat erscheinen lassen (siehe
// Auftrag). Er traegt jetzt zusaetzlich den Spaltenkopf-FILTER dieser
// Spalte: gefiltert wird ueber spaltenWert() und damit ueber genau
// diesen Rang (siehe zeichneArbeitstabelle() in rahmen.js).
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
        { feld: 'eroeffnet_am',    titel: t('field.eroeffnet'), filterbar: false,
          formatieren: (wert) => (wert ? datumFormat(wert, ZEITSTEMPEL_FORMAT) : '') },
        { feld: 'bearbeiter',      titel: t('field.bearbeiter'), formatieren: (w) => w || '—' }
    ], auftragMaske);

    // MEHRZAHL UEBER mengeFormat(), nicht ueber ein festes Wort im
    // Meldungstext (Befund der penibel durchgegangenen Oberflaeche): bei
    // genau einem laufenden Auftrag - dem heutigen Bestand - stand hier
    // "1 laufende Wartungsaufträge". Die Einheit 'auftrag' liegt in
    // MENGENFORMEN (rahmen.js) in allen sechs Sprachen bereits vor und
    // wird vom Kopfbereich dieses Bereichs schon benutzt
    // (board.maintenanceReference); nur diese eine Statuszeile hatte
    // ihre Mehrzahl fest eingetippt. Der Meldungstext traegt jetzt die
    // FERTIGE Mengenphrase plus den Zustand ("... in Arbeit"), wie es
    // jede andere Meldung dieser Oberflaeche haelt.
    meldeVorgang(vorgang, t('msg.activeWorkOrdersCount', {
        auftraegePhrase: mengeFormat(auftraege.length, 'auftrag')
    }));
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
