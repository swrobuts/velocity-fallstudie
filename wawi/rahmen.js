// ============================================
// VeloCity Warenwirtschaft — Rahmen
//
// Die Oberfläche muss VIER Zustände unterscheiden können, die im
// Browser gleich aussehen:
//
//   1. nicht angemeldet             -> Anmeldemaske
//   2. angemeldet, kein Mitarbeiter -> Hinweis, kein Zugang
//   3. Mitarbeiter ohne Rolle       -> Hinweis, wer helfen kann
//   4. Mitarbeiter mit Rollen       -> Arbeitsoberfläche
//
// Der zweite Fall ist der häufigste und der, den man vergisst: JEDER
// Kunde kann sich hier anmelden, weil es dieselbe auth.users ist. Er
// bekäme dann eine Oberfläche, in der jede Sicht null Zeilen liefert -
// fehlerfrei, leer, unerklärlich. Deshalb wird vor dem Aufbau gefragt,
// nicht danach.
//
// Der dritte Fall ist der, der bei genau einem Mitarbeiter im Bestand
// (VeloCity heute) zum NORMALFALL für jeden zweiten neuen Kollegen wird:
// ein echtes Mitarbeiterkonto, dem noch niemand eine Rolle zugeteilt hat.
// meineRollen() liefert dafür ein LEERES Set - anders als "false" für
// "kein Mitarbeiter". Beide vorher gleich zu behandeln ("Kein Zugang")
// schickte diesen Fall in die falsche Richtung: er gehört nicht zur
// Kundenverwaltung, sondern zur Leitung, die eine Rolle nachtragen kann.
// Deshalb hier vier Fälle statt drei, unterschieden per
// `rollen instanceof Set` statt per Wahrheitswert - ein leeres Set ist
// falsy in JavaScript, eine reine `if (rollen)`-Prüfung hätte es mit
// "nicht angemeldet"/"kein Mitarbeiter" verwechselt.
// ============================================

const bereiche = new Map();
let aktiverBereich = null;

// Der Wert, den seiteAufbauen() zuletzt von meineRollen() bekommen hat.
// Gehört hierher und nicht in anmeldung.js: dort ist rollenZwischenspeicher
// ein technischer Zwischenspeicher mit eigener Lebensdauer (verfällt bei
// jedem echten Benutzerwechsel, siehe dortiger Kommentar). darfRolle()
// fragt dagegen den Stand, den DIESE Seite zuletzt tatsächlich geladen
// und zur Navigation verwendet hat - das ist ein anderer Zeitpunkt.
let geladeneRollen = null;

function bereichAnmelden(bereich) {
    // bereich: { schluessel, titel, rollen: [...], aufbauen: async (ziel) => {} }
    bereiche.set(bereich.schluessel, bereich);
}

async function seiteAufbauen() {
    let rollen;
    try {
        rollen = await meineRollen();
    } catch (fehler) {
        // meineRollen() wirft seit der Prüfung von Aufgabe 1 bei einem
        // technischen Fehlschlag, statt still ein leeres Rollen-Set zu
        // liefern - genau damit ein Netzwerk- oder Rechtefehler nicht wie
        // "kein Mitarbeiter" aussieht. Wird der Wurf hier nicht gefangen,
        // läuft er als unbehandelte Ablehnung ins Leere: keiner der vier
        // Zustände wird je sichtbar, die Seite bleibt wortlos beim
        // Ladetext stehen. Es gibt keinen eigenen fünften Zustand für
        // diesen Fall - der Ladezustand ist der einzige, der ohnehin noch
        // sichtbar ist, wenn das hier passiert, und wird deshalb zur
        // Fehleranzeige umgewidmet.
        console.error('seiteAufbauen: Rollen konnten nicht ermittelt werden:', fehler);
        const ladeAnzeige = document.getElementById('zustand-laden');
        ladeAnzeige.textContent = `Anmeldung konnte nicht geprueft werden: ${fehler.message}`;
        ladeAnzeige.classList.add('fehler-anzeige');
        zeige('zustand-laden', true);
        zeige('zustand-anmeldung', false);
        zeige('zustand-kein-mitarbeiter', false);
        zeige('zustand-ohne-rolle', false);
        zeige('zustand-arbeit', false);
        return;
    }

    geladeneRollen = rollen;

    // instanceof Set statt Wahrheitswert: ein LEERES Set (Mitarbeiter
    // ohne Rolle) ist falsy und würde von einer if(rollen)-Prüfung
    // nicht von null/false unterschieden - genau der Fehler, den diese
    // Aufgabe korrigiert (siehe Kommentar am Dateianfang).
    zeige('zustand-laden', false);
    zeige('zustand-anmeldung', rollen === null);
    zeige('zustand-kein-mitarbeiter', rollen === false);
    zeige('zustand-ohne-rolle', rollen instanceof Set && rollen.size === 0);
    zeige('zustand-arbeit', rollen instanceof Set && rollen.size > 0);

    if (rollen instanceof Set && rollen.size > 0) {
        await navigationAufbauen(rollen);
    }
}

function zeige(id, sichtbar) {
    document.getElementById(id).hidden = !sichtbar;
}

// ===== Rollenabhängige Navigation =====

// Was eine Rolle nicht darf, wird NICHT angezeigt - nicht ausgegraut.
// Was man nicht darf, soll man nicht suchen. Ein ausgegrauter Eintrag
// ist eine Einladung, nach dem Grund zu fragen; ein fehlender ist keine.
async function navigationAufbauen(rollen) {
    const nav = document.getElementById('navigation');
    nav.replaceChildren();

    const erlaubt = [...bereiche.values()]
        .filter((b) => b.rollen.some((r) => rollen.has(r)));

    for (const bereich of erlaubt) {
        const knopf = document.createElement('button');
        knopf.type = 'button';
        knopf.textContent = bereich.titel;
        knopf.dataset.bereich = bereich.schluessel;
        knopf.addEventListener('click', () => bereichWechseln(bereich.schluessel));
        nav.append(knopf);
    }

    const benutzer = (await angemeldeterBenutzer()).data.user;
    profilAufbauen(benutzer, rollen);

    if (erlaubt.length) await bereichWechseln(erlaubt[0].schluessel);
}

// Frührer stand hier direkt "email · rolle1, rolle2, ..." in
// #benutzer-anzeige, einem einzelnen <span> in der Kopfleiste (Punkt 3
// der Gestaltung). Jetzt füllt diese Funktion das aufklappbare
// Profilmenü - Bedienung (auf/zu, Escape, Klick daneben) wird davon
// GETRENNT, einmalig beim Laden verdrahtet (siehe "Profilmenü"
// weiter unten): navigationAufbauen() und damit profilAufbauen() läuft
// bei jedem seiteAufbauen()-Durchlauf erneut (z. B. nach USER_UPDATED,
// siehe anmeldung.js), ein hier zusätzlich angehängter Klick-Handler
// würde sich mit der Zeit vervielfachen.
function profilAufbauen(benutzer, rollen) {
    const meta = benutzer.user_metadata || {};
    const vorname = meta.vorname || '';
    const nachname = meta.nachname || '';
    const anzeigeName = (vorname || nachname) ? `${vorname} ${nachname}`.trim() : benutzer.email;

    // Konterfei: Initialen aus Vor- und Nachname - beides liegt (falls
    // gepflegt) in user_metadata, demselben Feld, aus dem
    // getUserDisplayName() in src/auth.js für Kundenkonten schon den
    // Vornamen liest (siehe dortiger Kommentar). velocity.mitarbeiter
    // führt zwar ebenfalls vorname/nachname, ist aber über keine
    // v_wawi_-Sicht und keine RPC für den eigenen Datensatz erreichbar -
    // das anzulegen wäre eine Datenbankänderung, die dieser Auftrag
    // ausdrücklich nicht vorsieht. Fehlt die Metadatenangabe, werden die
    // Initialen NOTFALLS aus der E-Mail abgeleitet (siehe initialenAus()).
    const avatar = document.getElementById('profil-initialen');
    avatar.style.backgroundImage = '';
    avatar.textContent = initialenAus(vorname, nachname, benutzer.email);

    // Das Konterfei selbst (assets/konterfei.png, auf 128px verkleinert -
    // ein Mitarbeiterfoto in Ausgangsgröße war 215 KB für einen
    // 40-Pixel-Rundknopf) tritt an die Stelle der Initialen, SOBALD es
    // tatsächlich geladen ist - nicht schon beim bloßen Setzen von
    // backgroundImage, das nimmt kein fehlendes Bild zur Kenntnis. Ein
    // eigenes Image() zum Vorladen ist deshalb nötig: erst sein 'load'
    // ersetzt die Initialen, sein 'error' lässt sie unangetastet stehen -
    // genau der im Auftrag verlangte Rückfall, falls das Bild fehlt oder
    // nicht erreichbar ist. .profilknopf-avatar setzt background-size:
    // cover bereits als Bildfläche an, hier ist dafür keine zweite Regel
    // nötig.
    const vorschau = new Image();
    vorschau.onload = () => {
        avatar.style.backgroundImage = `url(assets/konterfei.png)`;
        avatar.textContent = '';   // sonst überlagern sich Initialen und Foto
    };
    vorschau.src = 'assets/konterfei.png';

    document.getElementById('profil-name').textContent = anzeigeName;
    document.getElementById('profil-email').textContent = benutzer.email;

    const rollenKasten = document.getElementById('profil-rollen');
    rollenKasten.replaceChildren();
    for (const rolle of rollen) {
        const marke = document.createElement('span');
        marke.className = 'rollen-marke';
        marke.textContent = rolle;
        rollenKasten.append(marke);
    }
}

function initialenAus(vorname, nachname, email) {
    if (vorname && nachname) return (vorname[0] + nachname[0]).toUpperCase();
    // Notfall-Ableitung aus der E-Mail (Auftrag Punkt 3, ausdrücklich
    // erlaubt): die ersten beiden Buchstaben vor dem @. Nicht einfach
    // die ersten zwei ZEICHEN, weil ein Postfach wie "m.mueller@..." sonst
    // "M." statt "MM" ergäbe - ein Punkt ist kein Initial.
    const lokal = (email || '').split('@')[0];
    const buchstaben = lokal.replace(/[^a-zA-Z]/g, '');
    const quelle = buchstaben.length >= 2 ? buchstaben : lokal;
    return (quelle.slice(0, 2) || '?').toUpperCase();
}

async function bereichWechseln(schluessel) {
    aktiverBereich = bereiche.get(schluessel);
    document.querySelectorAll('#navigation button').forEach((k) => {
        k.setAttribute('aria-current', k.dataset.bereich === schluessel ? 'page' : 'false');
    });

    // Arbeitsliste UND Detailmaske leeren, nicht nur die Maske: sonst
    // blieben die Unterreiter oder die letzte Liste des VORHERIGEN
    // Bereichs als Karteileiche stehen, bis der neue Bereich zufällig
    // selbst wieder zeigeListe()/zeigeUnterreiter() aufruft. Der
    // Listenzustand (Auswahl, Zeilen) gehört ebenfalls zurückgesetzt -
    // eine ausgewählte Zeile eines fremden Bereichs darf nicht als
    // "ausgewählt" im neuen Bereich weiterleben.
    document.getElementById('arbeitsliste').replaceChildren();
    document.getElementById('detailmaske').replaceChildren();
    hauptknopfElement = null;
    listenZeilen = [];
    listenAuswahl = null;
    listenIndex = -1;
    listenZeilenElemente = [];

    melde('');
    await aktiverBereich.aufbauen();
}

// ===== Die Statuszeile =====

// Jede Buchung wird hier bestätigt. Wer zwanzig Raeder nacheinander
// umbucht, braucht die Rückmeldung dort, wo er ohnehin hinsieht - nicht
// als Blase in einer Ecke, die nach drei Sekunden verschwindet. Deshalb
// bleibt der Text stehen, bis der nächste kommt.
function melde(text, art = 'neutral') {
    const zeile = document.getElementById('statuszeile');
    zeile.textContent = text;
    zeile.className = art;   // neutral | gut | warnung | schlecht
    // Von neuerVorgang() gelesen und dort sofort verbraucht (siehe
    // dortiger Kommentar) - deshalb hier roh und ungeprüft gesetzt.
    letzteMeldeArt = art;
}

// ===== Vorgangsverwaltung =====
//
// ERSTER ANLAUF (verworfen): eine Buchungsbestätigung ("Rad ...
// ausgemustert.", art='gut') kommt aus einem Knopf; direkt danach ruft
// jede *Aufbauen()-Funktion die Liste neu auf und schloss früher mit
// einer eigenen Übersichtsmeldung ("10 Stationen") ab, die die
// Bestätigung sofort überschrieb. Die erste Lösung dafür war EIN
// gemeinsames Bit ("die letzte Meldung war eine noch unverbrauchte
// Bestätigung"). Die Prüfung hat das durchfallen lassen, mit zwei
// nachgestellten Befunden:
//
//   1. Zwei Buchungen kurz hintereinander, deren Neuaufbauten sich
//      überholen (Buchung A startet ihren Neuaufbau, dann Buchung B
//      ihren - B's Bestätigung steht, dann kommt ZUERST A's Neuaufbau
//      zurück). Ein einzelnes Bit weiß nicht, dass die Bestätigung
//      inzwischen zu B gehört, nicht zu A - A's Neuaufbau "verbraucht"
//      das Bit, das für B gedacht war, und B's eigener Neuaufbau
//      schreibt danach ungebremst seine Übersicht über B's eigene,
//      noch druckfrische Bestätigung.
//   2. Ein Bereichswechsel während ein Neuaufbau des VORHERIGEN
//      Bereichs noch läuft: kommt der spät zurück, schreibt er Liste
//      UND Statuszeile des NEUEN Bereichs voll, obwohl die Navigation
//      längst woanders steht. Das Bit schützt nicht davor - es kennt
//      nur "war zuletzt eine Bestätigung da", nicht "gehört dieser
//      Neuaufbau überhaupt noch zur Gegenwart".
//
// Beiden Befunden gemeinsam: es gab keine Stelle, an der ein Neuaufbau
// merken konnte, dass ER SELBST veraltet ist. Ein Bit kennt nur DASS
// etwas war, nicht WOZU es gehörte.
//
// LÖSUNG: jeder Vorgang (jeder Aufruf einer *Aufbauen()-Funktion)
// bekommt beim Start eine eigene, fortlaufende Kennung. neuerVorgang()
// liefert sie; jeder weitere Schreibversuch dieses Vorgangs - Liste
// (zeigeListe) UND Statuszeile (meldeVorgang) - trägt diese Kennung
// vor sich her und prüft bei sich SELBST, ob sie noch die aktuelle
// ist. Ein Vorgang, dessen Kennung inzwischen überholt wurde -von
// einem neueren Neuaufbau DESSELBEN Bereichs (Befund 1) oder vom
// Neuaufbau eines ANDEREN Bereichs nach einem Wechsel (Befund 2) -
// schreibt gar nichts mehr, weder Liste noch Statuszeile. Kein Bit,
// keine Warteschlange: die zwanzigste Buchung einer Reihe zeigt weiter
// sofort ihre eigene Bestätigung, unabhängig davon, wie lange die
// vorherigen Neuaufbauten noch unterwegs sind.
//
// Die Bestätigung selbst hängt jetzt am VORGANG statt an einem
// geteilten Bit: neuerVorgang() liest, OHNE await dazwischen, welche
// Art die zuletzt sichtbare Meldung hatte (letzteMeldeArt, von melde()
// gesetzt). melde(..., 'gut') und der direkt folgende Aufruf einer
// *Aufbauen()-Funktion stehen in JEDEM Aufrufer als zwei aufeinander-
// folgende Anweisungen OHNE dazwischenliegendes await - JavaScript
// räumt dazwischen nichts anderes ab. Zeigt die Statuszeile in diesem
// Moment noch eine frische Bestätigung, gehört sie zu GENAU DEM
// Vorgang, der jetzt beginnt - nicht zu irgendeinem früheren. Die
// Markierung wird dabei sofort verbraucht (letzteMeldeArt = null):
// ein zweiter, unabhängiger Neuaufbau nach demselben Vorgang (ohne
// neue Buchung dazwischen) soll seine eigene Übersicht wieder normal
// zeigen, nicht ein zweites Mal von derselben, längst gezeigten
// Bestätigung unterdrückt werden.
//
// Verwerfen gehört HIERHER, nicht in die Bereiche (Ruling der
// zweiten Prüfung): jeder der fünf Arbeitsbereiche ruft nur
// neuerVorgang() (eine Zeile, ganz am Anfang jeder *Aufbauen()-
// Funktion) und reicht die Kennung an zeigeListe()/meldeVorgang()
// weiter - die Entscheidung, ob ein Schreibversuch noch gilt, fällt
// ausschließlich hier.
let vorgangsZaehler = 0;
let aktuellerVorgang = 0;            // Kennung des zuletzt gestarteten Vorgangs
let vorgangMitOffenerBestaetigung = null;  // Kennung, deren Bestätigung noch "frisch" ist
let letzteMeldeArt = null;           // von melde() gesetzt, von neuerVorgang() verbraucht

// Von jeder *Aufbauen()-Funktion als ALLERERSTE Anweisung aufzurufen,
// vor jedem await. Liefert die Kennung dieses Vorgangs.
function neuerVorgang() {
    vorgangsZaehler += 1;
    aktuellerVorgang = vorgangsZaehler;
    vorgangMitOffenerBestaetigung = letzteMeldeArt === 'gut' ? aktuellerVorgang : null;
    letzteMeldeArt = null;   // verbraucht - siehe Begründung oben
    return aktuellerVorgang;
}

// true, wenn kennung noch der zuletzt gestartete Vorgang ist - false,
// wenn seitdem ein neuerer begonnen hat (ein weiterer Neuaufbau
// desselben Bereichs, ein Bereichswechsel, oder beides).
function istAktuellerVorgang(kennung) {
    return kennung === aktuellerVorgang;
}

// Liefert die Kennung des Vorgangs, der GERADE läuft - anders als
// neuerVorgang() OHNE selbst einen neuen zu beginnen. Für Masken, die vor
// dem Anzeigen selbst nachladen (radAnlegenMaske() in flotte.js: Promise.all
// über Modelle und Stationen; schadenMeldenMaske() in instandhaltung.js:
// die Flotte) und deshalb zwischen ihrem eigenen Start und ihrem
// zeigeMaske()-Aufruf einen Bereichswechsel oder Unterreiterwechsel
// erleben können. Diese Masken sind selbst KEIN *Aufbauen()-Vorgang und
// dürfen keinen eigenen ziehen - neuerVorgang() verbraucht dabei
// letzteMeldeArt (siehe dort), was einer Anlegemaske ohne eigene
// Buchungsbestätigung fälschlich eine fremde Bestätigung klauen würde.
// Sie merken sich stattdessen beim Start, welcher *Aufbauen()-Vorgang
// gerade lief, und pruefen nach ihrem eigenen Laden per
// istAktuellerVorgang(), ob er es immer noch ist.
//
// Im Browser nachgestellt (WICHTIG 4): Flotte -> "Neues Rad anlegen"
// geklickt -> vor der Rückkehr (Promise.all noch unterwegs) zu Stationen
// gewechselt. Ohne diese Prüfung erschien die Anlegemaske verspätet ÜBER
// der Stationenliste; ein Klick auf "Anlegen" dort legte wirklich ein Rad
// an, und der anschließende flotteAufbauen() bekam die NEUESTE Kennung und
// überschrieb damit die gerade angezeigte Stationenliste, während die
// Navigation weiterhin "Stationen" zeigte. Mit der Prüfung bricht
// radAnlegenMaske() nach dem Bereichswechsel wortlos ab, wie ein
// veralteter *Aufbauen()-Vorgang auch.
function laufenderVorgang() {
    return aktuellerVorgang;
}

// Die Statuszeilen-Schreibstelle jeder *Aufbauen()-Funktion - sowohl
// für den Ladefehler-Zweig (art='schlecht') als auch für die
// abschließende Übersichtsmeldung (art='neutral', Vorgabewert). NICHT
// für die Bestätigung selbst, die bleibt ein direkter Aufruf von
// melde(text, 'gut') im Knopf-Handler, BEVOR die *Aufbauen()-Funktion
// (und mit ihr neuerVorgang()) überhaupt läuft.
//
// Ein veralteter Vorgang schreibt überhaupt nichts - auch keinen
// Fehler: gehört der Vorgang nicht mehr zur Gegenwart (Bereich
// gewechselt, oder ein neuerer Neuaufbau läuft bereits), ist auch sein
// eigener Ladefehler nicht mehr relevant, siehe Befund 2 oben. Nur
// innerhalb eines noch aktuellen Vorgangs gilt die Reihenfolge aus dem
// Auftrag: eine Übersichtsmeldung (art='neutral') fällt genau einmal
// aus, wenn dieser Vorgang noch eine unverbrauchte Bestätigung trägt -
// ein Fehler (art='schlecht') dagegen schreibt IMMER, unterdrückt durch
// nichts.
function meldeVorgang(kennung, text, art = 'neutral') {
    if (!istAktuellerVorgang(kennung)) return;
    if (art === 'neutral' && vorgangMitOffenerBestaetigung === kennung) {
        vorgangMitOffenerBestaetigung = null;   // verbraucht, Bestätigung bleibt stehen
        return;
    }
    melde(text, art);
}

// ===== Bestätigungsdialog =====

// Für alles, was sich nicht zurückholen lässt. Kein window.confirm:
// das lässt sich nicht gestalten und nicht mit der Tastatur bedienen,
// wie der Rest dieser Oberfläche. <dialog>.showModal() übernimmt die
// Fokusfalle von sich aus und schließt bei Escape über sein eigenes
// 'cancel'-Ereignis, unabhängig vom globalen keydown-Listener aus
// Schritt 6 - der überspringt Escape deshalb, solange ein <dialog>
// offen ist (siehe dort), statt selbst zu reagieren und mit dem
// Browser um dieselbe Taste zu konkurrieren.
function bestaetige(frage, bestaetigungswort = null) {
    return new Promise((ergebnisMelden) => {
        const dialog = document.createElement('dialog');
        dialog.className = 'velocity-dialog';

        // frage trägt bei den wichtigeren Dialogen mehrere inhaltliche
        // Blöcke, getrennt durch eine Leerzeile (\n\n) - der Art.-17-Dialog
        // in kunden.js etwa WAS VERSCHWINDET, WAS BLEIBT, WAS DAS NICHT
        // LEISTET und den Unumkehrbarkeits-Hinweis. EIN <p> mit textContent
        // faltet solche Zeilenumbrüche zu einem einzigen Fliesstext
        // zusammen - .velocity-dialog p kennt kein white-space: pre-line.
        // Deshalb hier ein eigenes <p> je Block, weiterhin ausschließlich
        // über textContent gesetzt, nie über innerHTML: ein Text ohne
        // Leerzeile (die meisten Aufrufer) ergibt unverändert genau ein
        // <p>. Allgemein gelöst, weil jeder Dialog über bestätige()
        // läuft - nicht nur der Art.-17-Fall, der den Fehler gefunden hat.
        for (const block of frage.split('\n\n')) {
            const absatz = document.createElement('p');
            absatz.textContent = block;
            dialog.append(absatz);
        }

        let eingabe = null;
        const bestaetigenKnopf = document.createElement('button');
        bestaetigenKnopf.type = 'button';
        bestaetigenKnopf.textContent = 'Bestaetigen';
        bestaetigenKnopf.className = 'knopf-gefaehrlich';

        if (bestaetigungswort) {
            // Ein Klick allein darf hier nicht reichen - das ist für
            // die Anonymisierung gedacht und für nichts sonst.
            const label = document.createElement('label');
            label.htmlFor = 'dialog-bestaetigungswort';
            label.textContent = `Zum Bestaetigen "${bestaetigungswort}" eintippen:`;
            dialog.append(label);

            eingabe = document.createElement('input');
            eingabe.type = 'text';
            eingabe.id = 'dialog-bestaetigungswort';
            eingabe.autocomplete = 'off';
            dialog.append(eingabe);

            bestaetigenKnopf.disabled = true;
            eingabe.addEventListener('input', () => {
                bestaetigenKnopf.disabled = eingabe.value !== bestaetigungswort;
            });
        }

        const knopfleiste = document.createElement('div');
        knopfleiste.className = 'knopfleiste';

        const abbrechenKnopf = document.createElement('button');
        abbrechenKnopf.type = 'button';
        abbrechenKnopf.textContent = 'Abbrechen';
        abbrechenKnopf.className = 'knopf-neben';
        // dialog.close() löst nur 'close' aus, nicht 'cancel' - der
        // Rückgabewert entscheidet unten einheitlich über das Ergebnis,
        // egal ob per Klick oder per Escape geschlossen wurde.
        abbrechenKnopf.addEventListener('click', () => dialog.close('nein'));
        bestaetigenKnopf.addEventListener('click', () => dialog.close('ja'));

        knopfleiste.append(abbrechenKnopf, bestaetigenKnopf);
        dialog.append(knopfleiste);
        document.body.append(dialog);

        dialog.addEventListener('close', () => {
            const ergebnis = dialog.returnValue === 'ja';
            dialog.remove();
            ergebnisMelden(ergebnis);
        });

        dialog.showModal();
        // Ohne Bestätigungswort fällt der Anfangsfokus bewusst auf
        // Abbrechen: ein versehentliches Enter darf eine gefährliche
        // Aktion nicht bestätigen. Mit Wort fällt er auf das Feld, weil
        // dort ohnehin zuerst getippt werden muss.
        (eingabe || abbrechenKnopf).focus();
    });
}

// Ein einzeiliger Eingabedialog. Liefert null bei Abbruch - und der
// Aufrufer muss das pruefen: eine Buchung ohne Grund ist eine Buchung,
// die später niemand erklären kann.
function frageNachGrund(titel) {
    return new Promise((ergebnisMelden) => {
        const dialog = document.createElement('dialog');
        dialog.className = 'velocity-dialog';

        const ueberschrift = document.createElement('h2');
        ueberschrift.textContent = titel;
        dialog.append(ueberschrift);

        const label = document.createElement('label');
        label.htmlFor = 'dialog-grund';
        label.textContent = 'Grund';
        dialog.append(label);

        const eingabe = document.createElement('input');
        eingabe.type = 'text';
        eingabe.id = 'dialog-grund';
        eingabe.required = true;
        dialog.append(eingabe);

        const knopfleiste = document.createElement('div');
        knopfleiste.className = 'knopfleiste';

        const abbrechenKnopf = document.createElement('button');
        abbrechenKnopf.type = 'button';
        abbrechenKnopf.textContent = 'Abbrechen';
        abbrechenKnopf.className = 'knopf-neben';
        abbrechenKnopf.addEventListener('click', () => dialog.close());

        const bestaetigenKnopf = document.createElement('button');
        bestaetigenKnopf.type = 'button';
        bestaetigenKnopf.textContent = 'Bestaetigen';
        bestaetigenKnopf.className = 'knopf-haupt';
        bestaetigenKnopf.addEventListener('click', () => {
            if (!eingabe.value.trim()) {
                eingabe.reportValidity();
                return;
            }
            dialog.close('ja');
        });
        // Enter im Feld bestätigt - ein Dialog mit genau einem Feld ist
        // der Fall, in dem das erwartet wird.
        eingabe.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                bestaetigenKnopf.click();
            }
        });

        knopfleiste.append(abbrechenKnopf, bestaetigenKnopf);
        dialog.append(knopfleiste);
        document.body.append(dialog);

        dialog.addEventListener('close', () => {
            const ergebnis = dialog.returnValue === 'ja' ? eingabe.value : null;
            dialog.remove();
            ergebnisMelden(ergebnis);
        });

        dialog.showModal();
        eingabe.focus();
    });
}

// ===== Arbeitsliste =====
//
// Liste und Maske gleichzeitig. Der Bearbeitungsfluss ist: auswählen,
// ändern, speichern, nächster Satz - ohne Seitenwechsel. Das ist der
// Unterschied zwischen einer Arbeitsmaske und einer Website.

let listenZeilen = [];
let listenAuswahl = null;
let listenIndex = -1;
let listenZeilenElemente = [];

// #arbeitsliste kann zwei Kinder tragen: die Reiterleiste (nur wenn
// zeigeUnterreiter benutzt wurde) und den Listenkoerper. Beide werden
// bei Bedarf angelegt, unabhängig davon, in welcher Reihenfolge
// zeigeListe/zeigeUnterreiter/zeigeLeermaske aufgerufen werden -
// reiterleiste() hängt sich immer als erstes Kind ein.
function listenKoerper() {
    let el = document.getElementById('listenkoerper');
    if (!el) {
        el = document.createElement('div');
        el.id = 'listenkoerper';
        document.getElementById('arbeitsliste').append(el);
    }
    return el;
}

// Anders als werkzeugleiste()/listenKoerper() JEDES Mal neu an die
// erste Stelle gehängt, nicht nur bei der Neuanlage: Instandhaltung
// (Aufgabe 7) blendet ihre Werkzeugleiste je nach Unterreiter ein und
// aus - zeigeWerkzeugleiste(false, ...) entfernt das Element dabei
// vollständig (siehe dort). Kommt es später wieder, legt
// werkzeugleiste() ein NEUES Element an und hängt es vor den
// jeweils aktuellen ersten Kind - traf das bislang unverändert
// dagebliebene reiterleiste-Element, sprang die Werkzeugleiste über
// die Reiter, obwohl instandhaltungAufbauen() sie in der Reihenfolge
// Werkzeugleiste-dann-Reiter aufbaut. Im Browser nachgestellt: Reiter
// wechseln, Werkzeugleiste dabei aus- und wieder einblenden lassen -
// Reiter standen danach unter der Werkzeugleiste, nicht mehr darüber.
// Ein insertBefore auf ein bereits eingehängtes Element VERSCHIEBT es
// nur, dupliziert es nicht - deshalb hier ohne Neuanlage-Bedingung.
function reiterleiste() {
    const wurzel = document.getElementById('arbeitsliste');
    let el = document.getElementById('reiterleiste');
    if (!el) {
        el = document.createElement('div');
        el.id = 'reiterleiste';
        el.setAttribute('role', 'tablist');
    }
    wurzel.insertBefore(el, wurzel.firstChild);
    return el;
}

// ===== Werkzeugleiste =====
//
// Aktionen vor der Liste, z. B. "Neu anlegen". Flotte und Stationen
// (Aufgaben 4 und 5) hatten das unabhängig voneinander erfunden -
// flotteWerkzeugleiste/flotteWerkzeugleisteAufbauen und
// stationenWerkzeugleiste/stationenWerkzeugleisteAufbauen, wortgleich
// bis auf den Namen, mit je einer eigenen ID. Der Auftrag gab dafür
// keinen Code vor; zwei Bearbeiter haben unabhängig dasselbe Muster
// gebaut - ein Zeichen, dass es hierher gehört, nicht in jeden Bereich
// einzeln.
//
// Find-or-create auf eine FESTE ID, als erstes Kind von #arbeitsliste
// eingehängt - dieselbe Machart wie listenKoerper() und reiterleiste()
// oben. Genau deshalb braucht dieser Baustein KEINE eigene
// Aufräumlogik beim Bereichswechsel: bereichWechseln() leert
// #arbeitsliste ohnehin per replaceChildren(), bevor der neue Bereich
// aufbaut - das reisst die Werkzeugleiste des VORHERIGEN Bereichs mit
// heraus, wie es listenkoerper/reiterleiste auch trifft. Eine
// bereichseigene ID und ein bereichseigenes Wegräumen (wie es die
// beiden Vorlagen taten) wären nur eine zweite Absicherung für
// denselben Fall gewesen - und eine, die vergessen werden kann, wenn
// der Container aus Versehen außerhalb von #arbeitsliste hängt. Im
// Browser nachgestellt: zwischen Flotte und Stationen hin- und
// hergewechselt, jeweils mit und ohne disposition-Rolle - immer genau
// eine oder gar keine Werkzeugleiste, nie zwei übereinander.
//
// sichtbar: ob die aufrufende Rolle den Knopf überhaupt sehen darf
// (üblicherweise darfRolle(...)). false räumt den Container komplett
// ab, statt ihn leer stehen zu lassen - ein Container ohne Inhalt
// bliebe sonst als schmaler, unerklärter Streifen über der Liste
// stehen (dasselbe Prinzip wie beim Fehlen ganzer Navigationspunkte:
// was man nicht darf, wird nicht angezeigt, nicht ausgegraut).
function werkzeugleiste() {
    let el = document.getElementById('werkzeugleiste');
    if (!el) {
        el = document.createElement('div');
        el.id = 'werkzeugleiste';
        el.className = 'werkzeugleiste';
        const wurzel = document.getElementById('arbeitsliste');
        wurzel.insertBefore(el, wurzel.firstChild);
    }
    el.replaceChildren();
    return el;
}

function zeigeWerkzeugleiste(sichtbar, titel, ausfuehren) {
    if (!sichtbar) {
        document.getElementById('werkzeugleiste')?.remove();
        return;
    }
    const leiste = werkzeugleiste();

    const knopf = document.createElement('button');
    knopf.type = 'button';
    knopf.textContent = titel;
    // knopf-schaffend statt knopf-haupt (Punkt 4 der Gestaltung): jeder
    // einzige Aufruf dieses Bausteins über alle fünf Bereiche legt
    // etwas NEU an - "Neues Rad anlegen", "Neuen Kunden anlegen", "Neue
    // Station anlegen", "Schaden melden" - die Werkzeugleiste hat
    // laut ihrem eigenen Kopf-Kommentar oben ohnehin keinen anderen
    // Zweck. Grün ist hier eindeutig, siehe die ausführlichere
    // Begründung bei der art-Erlaeuterung von zeigeMaske() weiter unten
    // für die Fälle, in denen es das NICHT ist.
    knopf.className = 'knopf-schaffend';
    // Derselbe zentrale Fehlerfang wie bei den Knöpfen aus zeigeMaske()/
    // zeigeLeermaske(): jeder Aufrufer müsste ihn sonst selbst
    // nachbauen.
    knopf.addEventListener('click', async () => {
        knopf.disabled = true;
        try {
            await ausfuehren();
        } catch (fehler) {
            melde(fehler.message, 'schlecht');
        } finally {
            knopf.disabled = false;
        }
    });
    leiste.append(knopf);
}

// ===== Filterleiste (Gestaltungsauftrag, Punkt 2) =====
//
// "Dann ist die UI nicht besonders kreativ, es fehlen oftmals Filter,
// Slider oder andere Bedienelemente" - woertlich der Auftrag. Flotte
// (Status, Radtyp, Station), Kunden (Status) und Instandhaltung (Schwere,
// Alter) hatten das unabhaengig voneinander gebraucht - derselbe Befund
// wie bei der Werkzeugleiste oben (siehe dortiger Kommentar): ein
// Baustein hier statt vier eigene Bauarten. Stationen bekommt BEWUSST
// keinen: zehn Zeilen brauchen keinen Filter, und ein Bedienelement, das
// nichts filtert, ist Zierrat (Auftrag).
//
// Find-or-create auf eine feste id, unmittelbar vor listenKoerper()
// eingehaengt - dieselbe Machart wie uebersichtsstreifen()/reiterleiste()/
// werkzeugleiste() oben, aus demselben Grund: der Streifen soll stabil an
// derselben Stelle stehen, unabhaengig davon, in welcher Reihenfolge ein
// Bereich seine Bausteine aufbaut. Ruft ein Bereich zeigeUebersicht() VOR
// zeigeFilterleiste() auf (wie alle vier Verbraucher es tun), landet die
// Filterleiste dank derselben insertBefore(el, listenKoerper())-Logik
// zwischen Uebersicht und Tabelle - die Uebersicht beschreibt IMMER den
// gesamten Bestand, der Filter schraenkt NUR die Tabelle darunter ein.
function filterleiste() {
    const wurzel = document.getElementById('arbeitsliste');
    let el = document.getElementById('filterleiste');
    if (!el) {
        el = document.createElement('div');
        el.id = 'filterleiste';
        el.className = 'filterleiste';
    }
    wurzel.insertBefore(el, listenKoerper());
    el.replaceChildren();
    return el;
}

// kennung: dieselbe Absicherung wie bei zeigeUebersicht()/zeigeListe() -
// ein Reiterwechsel, dessen Filterleiste erst nach einem eigenen await
// zurueckkommt, dürfte einen inzwischen überholten Bildschirm nicht mehr
// beschreiben.
//
// sichtbar=false raeumt die Leiste komplett ab statt sie leer stehen zu
// lassen - dasselbe Prinzip wie bei zeigeWerkzeugleiste(false, ...) und
// aus demselben Grund noetig wie dort: Instandhaltung zeigt den Alters-/
// Schwere-Filter NUR im Unterreiter "Offene Schäden", nicht bei
// "Wartungsaufträge" - ohne dieses Abraeumen bliebe die Filterleiste des
// vorherigen Unterreiters als Karteileiche stehen (dieselbe Falle, die
// werkzeugleiste() oben fuer genau diesen Bereich schon einmal gefunden
// hat).
//
// filter: [{ name, titel, typ?, optionen?, wert, beiAenderung(neuerWert),
//            min?, max?, step?, beschriftung? }]
// - typ 'auswahl' (Vorgabe): <select> mit optionen [{wert, text}] -
//   feuert sofort bei Auswahl, kein Zumuellen der Statuszeile moeglich
//   (ein select aendert sich nicht waehrend des Tippens).
// - typ 'schieber': <input type="range"> zwischen min und max - feuert
//   bei JEDER Mausbewegung ein 'input'-Ereignis; ohne Verzoegerung loeste
//   das bei jedem Pixel einen kompletten Neuaufbau aus. 300ms Verzoegerung,
//   dieselbe Zeitspanne wie die Kundensuche (kunden.js) - danach ERST
//   beiAenderung() aufgerufen, mit dem zuletzt gezogenen Wert.
// - beschriftung(wert) (nur 'schieber'): formatiert den aktuellen Wert
//   fuer die Anzeige NEBEN dem Schieber ("≥ 3 Std." statt der blossen
//   Zahl 3) UND fuer aria-valuetext, damit ein Bildschirmleser dieselbe
//   Einordnung hoert wie ein sehender Blick.
//
// Die Vorgangs-Kennung UND der Schieber zusammen (Auftrag: "der Filter
// muss die Vorgangs-Kennung beachten"): die 300ms-Verzoegerung eines
// Schiebers kann laenger laufen als der Bereich lebt, den er gerade
// filtert - Schieber gezogen, sofort zu einem anderen Bereich (oder
// Unterreiter) gewechselt, BEVOR die 300ms um sind. Ohne Pruefung riefe
// der dann verspaetet feuernde Timer beiAenderung() trotzdem auf - eine
// Funktion, die typischerweise den *Aufbauen()-Vorgang eines Bereichs
// anstoesst, der laengst nicht mehr der aktuelle ist. istAktuellerVorgang()
// faengt genau das ab: kennung aendert sich nur, wenn seitdem ein neuer
// Vorgang begonnen hat (neuer Bereich, neuer Unterreiter, oder derselbe
// Bereich erneut) - dann bleibt der verspaetete Aufruf wortlos aus.
function zeigeFilterleiste(kennung, sichtbar, filter) {
    if (!istAktuellerVorgang(kennung)) return;
    if (!sichtbar || !filter || filter.length === 0) {
        document.getElementById('filterleiste')?.remove();
        return;
    }

    const leiste = filterleiste();
    for (const f of filter) {
        const feld = document.createElement('div');
        feld.className = 'filterfeld';

        const label = document.createElement('label');
        label.textContent = f.titel;
        label.htmlFor = `filter-${f.name}`;
        feld.append(label);

        if (f.typ === 'schieber') {
            const anzeige = document.createElement('span');
            anzeige.className = 'filterfeld-wert';
            const beschriften = (wert) => (f.beschriftung ? f.beschriftung(wert) : String(wert));
            anzeige.textContent = beschriften(f.wert);

            const eingabe = document.createElement('input');
            eingabe.type = 'range';
            eingabe.id = `filter-${f.name}`;
            eingabe.min = f.min;
            eingabe.max = f.max;
            eingabe.step = f.step ?? 1;
            eingabe.value = f.wert;
            eingabe.setAttribute('aria-valuetext', beschriften(f.wert));

            let verzoegerung = null;
            eingabe.addEventListener('input', () => {
                const wert = Number(eingabe.value);
                const text = beschriften(wert);
                anzeige.textContent = text;
                eingabe.setAttribute('aria-valuetext', text);
                clearTimeout(verzoegerung);
                verzoegerung = setTimeout(() => {
                    if (!istAktuellerVorgang(kennung)) return;   // siehe Kommentar oben
                    f.beiAenderung(wert);
                }, 300);
            });

            const schieberZeile = document.createElement('div');
            schieberZeile.className = 'filterfeld-schieber';
            schieberZeile.append(eingabe, anzeige);
            feld.append(schieberZeile);
        } else {
            const eingabe = document.createElement('select');
            eingabe.id = `filter-${f.name}`;
            for (const option of f.optionen) {
                const opt = document.createElement('option');
                opt.value = option.wert;
                opt.textContent = option.text;
                if (option.wert === f.wert) opt.selected = true;
                eingabe.append(opt);
            }
            eingabe.addEventListener('change', () => {
                if (!istAktuellerVorgang(kennung)) return;
                f.beiAenderung(eingabe.value);
            });
            feld.append(eingabe);
        }

        leiste.append(feld);
    }
}

// ===== Übersichtsstreifen (Gestaltungsauftrag Auswertungen, Punkt 1) =====
//
// "Interessant wäre auch immer eine kleine Übersicht über den Tabellen,
// in denen Dinge zusammengefasst und veranschaulicht werden" - wörtlich
// der Auftrag. Tufte dazu: wenige, aussagekräftige Zahlen mit wortgroßen
// Grafiken daneben (Sparklines) statt eines separaten großen Diagramms -
// "small multiples" statt Deko. Der Streifen sitzt ÜBER der Liste, in
// derselben Ansicht: man verlässt die Tabelle nicht, um ihre zusammen-
// gefasste Form zu sehen.
//
// Find-or-create auf eine feste id, unmittelbar vor listenKoerper()
// eingehängt - dieselbe Machart wie reiterleiste()/werkzeugleiste() oben.
// Dadurch steht der Streifen unabhängig von der Aufrufreihenfolge IMMER
// zwischen einer eventuellen Reiter-/Werkzeugleiste und der Tabelle
// selbst, nie darüber oder darunter vertauscht - genau das Problem, das
// reiterleiste() weiter oben für sich schon lösen musste.
function uebersichtsstreifen() {
    const wurzel = document.getElementById('arbeitsliste');
    let el = document.getElementById('uebersichtsstreifen');
    if (!el) {
        el = document.createElement('div');
        el.id = 'uebersichtsstreifen';
        el.className = 'uebersichtsstreifen';
    }
    wurzel.insertBefore(el, listenKoerper());
    el.replaceChildren();
    return el;
}

// kennung: dieselbe Absicherung wie bei zeigeListe()/zeigeLeermaske() -
// ein Reiterwechsel, dessen Übersicht erst nach einem eigenen await
// zurückkommt, dürfte einen inzwischen überholten Bildschirm nicht mehr
// beschreiben (siehe Kopfkommentar bei neuerVorgang()).
//
// kacheln: [{ titel, wert, grafik?, hinweis? }]
// - titel: die Frage, die die Kachel beantwortet ("Umsatz gesamt", ...).
// - wert: String ODER Element - ein Element für typografisch skalierte
//   Zahlen (siehe zahlSkaliert() weiter unten) oder eine eingefärbte
//   Bedeutung, sonst reicht ein String.
// - grafik (optional): ein <svg>-Element, typischerweise aus sparkline()
//   oder zellbalken() - das "wortgroße Bild daneben" aus dem Auftrag.
// - hinweis (optional): eine zweite, leisere Zeile unter der Zahl - die
//   Einordnung, nicht die Kennzahl selbst ("42 % des Umsatzes ohne feste
//   Mitgliedschaft"). Hierhin gehört auch eine Unsicherheit, die NEBEN
//   der Zahl stehen muss statt in einer Fußnote (Schätzanteil bei
//   Kilometer/CO2, siehe auswertungen.js).
//
// Ohne kacheln (leeres Array, z. B. beim Leer- oder Fehlerzustand einer
// Liste) wird der Streifen abgeräumt statt leer stehen gelassen - dasselbe
// Prinzip wie bei zeigeWerkzeugleiste(false, ...): ein Container ohne
// Inhalt bliebe sonst als schmaler, unerklärter Streifen stehen, und ohne
// dieses explizite Abräumen überlebte die Übersicht des VORHERIGEN
// Reiters unverändert einen Reiterwechsel, der selbst keine Übersicht
// mehr zeigen will (bereichWechseln() leert #arbeitsliste nur beim
// BEREICHSwechsel, nicht beim Reiterwechsel innerhalb der Auswertungen).
function zeigeUebersicht(kennung, kacheln) {
    if (!istAktuellerVorgang(kennung)) return;
    const leiste = uebersichtsstreifen();
    if (!kacheln || kacheln.length === 0) { leiste.remove(); return; }

    for (const kachel of kacheln) {
        const feld = document.createElement('div');
        feld.className = 'uebersichtskachel';

        const titel = document.createElement('div');
        titel.className = 'uebersichtskachel-titel';
        titel.textContent = kachel.titel;
        feld.append(titel);

        const zeile = document.createElement('div');
        zeile.className = 'uebersichtskachel-zeile';
        const wert = document.createElement('div');
        wert.className = 'uebersichtskachel-wert';
        wert.append(kachel.wert);
        zeile.append(wert);
        if (kachel.grafik) zeile.append(kachel.grafik);
        feld.append(zeile);

        if (kachel.hinweis) {
            const hinweis = document.createElement('div');
            hinweis.className = 'uebersichtskachel-hinweis';
            hinweis.textContent = kachel.hinweis;
            feld.append(hinweis);
        }

        leiste.append(feld);
    }
}

// ===== Zeichenbausteine: Sparkline (Tufte) und Zellbalken (Bissantz) =====
//
// Beide als selbst gezeichnetes Inline-SVG, ohne Diagrammbibliothek und
// ohne CDN - harte Grenze dieses Projekts (siehe Dateikopf). Beide bauen
// ihr <svg> über createElementNS(), nicht über innerHTML: die Werte
// kommen zwar aus v_wawi_-Sichten und nicht von einer Nutzereingabe, aber
// ein zweiter, innerHTML-basierter Weg neben dem createElement-Weg, den
// der Rest dieser Datei sonst überall verwendet, wäre eine unnötige
// zweite Bauart für dasselbe Ergebnis.
const SVG_NS = 'http://www.w3.org/2000/svg';

// werte: Zahlen in Anzeigereihenfolge - chronologisch bei einem
// Zeitverlauf, aber ebenso gültig über eine andere Achse (siehe
// stationsauslastungZeigen() in auswertungen.js, wo dieselbe Funktion
// den Füllstand bzw. Saldo der zehn Stationen statt Monate trägt: "small
// multiples" heißt bei Tufte eine Reihe vergleichbarer Werte, nicht
// zwingend eine Zeitreihe).
//
// optionen.beschriftung: der zugängliche Name (role="img" + aria-label).
// OHNE beschriftung gilt die Grafik als rein schmückend (aria-hidden) -
// eine Sparkline, die nichts über die FORM des Verlaufs sagt, was die
// daneben stehende Zahl nicht auch hergäbe, wäre für einen Bildschirm-
// leser sonst stumme Information (Auftrag: "eine Grafik, die Information
// trägt, darf für einen Screenreader nicht stumm sein"). Der Aufrufer
// entscheidet das bewusst je Sparkline, nicht diese Funktion pauschal.
//
// optionen.markierIndex: hebt EINEN Punkt hervor (den Knick beim
// Tarifwechsel, das Minimum eines Saldos, ...) in --rot - demselben
// Farbakzent, den die aktive Navigation und der aktive Reiter in
// style.css schon tragen (Aufmerksamkeit lenken, nicht "schlecht" - dafür
// steht in dieser Warenwirtschaft die andere, eigene Farbe --schlecht).
function sparkline(werte, optionen = {}) {
    const { breite = 72, hoehe = 22, beschriftung = null, markierIndex = null } = optionen;

    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${breite} ${hoehe}`);
    svg.setAttribute('width', breite);
    svg.setAttribute('height', hoehe);
    svg.classList.add('sparklinie');

    if (beschriftung) {
        svg.setAttribute('role', 'img');
        svg.setAttribute('aria-label', beschriftung);
    } else {
        svg.setAttribute('aria-hidden', 'true');
        svg.setAttribute('focusable', 'false');
    }

    if (!werte || werte.length < 2) return svg;   // nichts zu zeichnen, aber ein gültiges <svg>

    const minimum = Math.min(...werte);
    const maximum = Math.max(...werte);
    const spanne = maximum - minimum || 1;   // eine flache Reihe (alle Werte gleich) teilt nicht durch null
    const schrittweite = breite / (werte.length - 1);
    // 1px Rand oben/unten, damit ein Extremwert nicht genau auf der
    // Kontur des <svg> liegt und dort optisch abgeschnitten wirkt.
    const yVon = (wert) => 1 + (hoehe - 2) * (1 - (wert - minimum) / spanne);
    const punkte = werte.map((wert, i) => [i * schrittweite, yVon(wert)]);

    const linie = document.createElementNS(SVG_NS, 'polyline');
    linie.setAttribute('points', punkte.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' '));
    linie.setAttribute('class', 'sparklinie-linie');
    svg.append(linie);

    // Der letzte Punkt bekommt immer einen Marker - der Blick einer
    // Zeitreihe landet ohnehin am aktuellen Rand.
    const [endeX, endeY] = punkte[punkte.length - 1];
    const endpunkt = document.createElementNS(SVG_NS, 'circle');
    endpunkt.setAttribute('cx', endeX);
    endpunkt.setAttribute('cy', endeY);
    endpunkt.setAttribute('r', 1.5);
    endpunkt.setAttribute('class', 'sparklinie-punkt');
    svg.append(endpunkt);

    if (markierIndex !== null && markierIndex >= 0 && markierIndex < punkte.length) {
        const [mx, my] = punkte[markierIndex];
        const markierung = document.createElementNS(SVG_NS, 'circle');
        markierung.setAttribute('cx', mx);
        markierung.setAttribute('cy', my);
        markierung.setAttribute('r', 2.2);
        markierung.setAttribute('class', 'sparklinie-markierung');
        svg.append(markierung);
    }

    return svg;
}

// wert/maximum: derselbe Maßstab für JEDE Zeile einer Spalte (Bissantz:
// "an einer gemeinsamen Skala ausgerichtet") - der Aufrufer ermittelt
// maximum EINMAL über alle sichtbaren Zeilen, nicht je Zeile neu (sonst
// wäre der längste Balken in jeder Zeile gleich lang und der Vergleich
// zwischen Zeilen sinnlos).
//
// textInhalt: der bereits formatierte Zellentext (String oder, für eine
// typografisch skalierte Zahl, ein von zahlSkaliert() gebautes Element) -
// der Balken ERSETZT den Text nicht, er steht daneben. Eine Zahl, die man
// nur noch als Balken sähe, wäre für einen Bildschirmleser bedeutungslos
// und für einen späteren Exportzweck unbrauchbar. null/undefined lässt
// die Textspanne weg - für eine reine Anteilsgrafik in einer
// Übersichtskachel (siehe umsatzKundengruppeUebersicht() in
// auswertungen.js), wo die Zahl bereits als eigener Kachelwert daneben
// steht und nicht doppelt erscheinen soll.
//
// optionen.farbe: CSS-Farbwert für die Füllung - Vorgabe --marine
// (neutral: "hier ist eine Zahl"), überschreibbar, wo Farbe tatsächlich
// etwas bedeutet (z. B. eine volle Station in --warnung-text, siehe
// stationsauslastungZeigen() in auswertungen.js).
//
// aria-hidden auf dem <svg>: der Balken ist eine zweite, rein visuelle
// Darstellung DESSELBEN Werts, der als Text daneben steht - anders als
// eine Sparkline (die eine Form zeigt, die der Text allein nicht hergibt)
// trägt er für sich keine zusätzliche Information.
function zellbalken(wert, maximum, textInhalt = null, optionen = {}) {
    const { breite = 56, hoehe = 12, farbe = 'var(--marine)' } = optionen;
    const anteil = maximum > 0 ? Math.max(0, Math.min(1, wert / maximum)) : 0;

    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${breite} ${hoehe}`);
    svg.setAttribute('width', breite);
    svg.setAttribute('height', hoehe);
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    svg.classList.add('zellbalken-grafik');

    const hintergrund = document.createElementNS(SVG_NS, 'rect');
    hintergrund.setAttribute('x', 0);
    hintergrund.setAttribute('y', 0);
    hintergrund.setAttribute('width', breite);
    hintergrund.setAttribute('height', hoehe);
    hintergrund.setAttribute('class', 'zellbalken-hintergrund');
    svg.append(hintergrund);

    const fuellung = document.createElementNS(SVG_NS, 'rect');
    fuellung.setAttribute('x', 0);
    fuellung.setAttribute('y', 0);
    fuellung.setAttribute('width', breite * anteil);
    fuellung.setAttribute('height', hoehe);
    fuellung.setAttribute('fill', farbe);
    svg.append(fuellung);

    const wrapper = document.createElement('span');
    wrapper.className = 'zellbalken';
    wrapper.append(svg);
    if (textInhalt !== null && textInhalt !== undefined && textInhalt !== '') {
        const text = document.createElement('span');
        text.className = 'zellbalken-text';
        text.append(textInhalt);
        wrapper.append(text);
    }
    return wrapper;
}

// ===== Zeichenbaustein: typografische Skalierung (Bissantz) =====
//
// "Zahlen soll man sehen, nicht lesen": die tragenden Ziffern (Größen-
// ordnung) bleiben in voller Stärke, Tausenderpunkte und die
// Nachkommastellen (samt Einheit) treten optisch zurück - eine
// mehrstellige Zahl wird so auf einen Blick erfasst, nicht Ziffer für
// Ziffer gelesen.
//
// Nimmt eine FERTIG formatierte deutsche Zahl entgegen (Punkt und Komma
// schon gesetzt, z. B. von geldFormat()/kgFormat() in auswertungen.js) -
// das Zerlegen des deutschen Zahlenformats gehört hierher, weil jeder
// Bereich mit einer eigenen, ähnlichen Formatierungsfunktion dieselbe
// Aufteilung braucht; WAS gerundet und WELCHE Einheit angehängt wird,
// bleibt Sache des Aufrufers.
//
// Kein Treffer (ein Text, der nicht wie eine Zahl aussieht) gibt den
// Eingabetext unverändert als einzelnen Textknoten zurück - eine
// typografische Verzierung darf niemals dazu führen, dass eine Zahl aus
// der Tabelle verschwindet, nur weil sie einem erwarteten Muster nicht
// entspricht.
function zahlSkaliert(formatiert) {
    const treffer = String(formatiert).match(/^(-?\d{1,3}(?:\.\d{3})*)(,\d+)?(.*)$/);
    const spanne = document.createElement('span');
    spanne.className = 'zahl-skaliert';
    if (!treffer) {
        spanne.textContent = formatiert;
        return spanne;
    }

    const [, ganzzahl, dezimal, rest] = treffer;
    // Tausenderpunkte selbst leiser, die tragenden Ziffern normal -
    // deshalb die Gruppen einzeln angehängt statt die ganze Ganzzahl als
    // einen Textknoten.
    ganzzahl.split('.').forEach((gruppe, i) => {
        if (i > 0) {
            const trenner = document.createElement('span');
            trenner.className = 'zahl-nebenteil';
            trenner.textContent = '.';
            spanne.append(trenner);
        }
        spanne.append(gruppe);
    });
    if (dezimal || rest) {
        const neben = document.createElement('span');
        neben.className = 'zahl-nebenteil';
        neben.textContent = (dezimal || '') + rest;
        spanne.append(neben);
    }
    return spanne;
}

// kennung: von neuerVorgang() geliefert, siehe Kommentar dort. Ein
// veralteter Vorgang zeichnet die Liste nicht mehr - sonst überschriebe
// ein spät zurückkommender Neuaufbau eines VORHERIGEN Bereichs oder
// eines überholten Buchungsvorgangs die Liste, die der Anwender gerade
// vor sich hat.
// spalten: [{ feld, titel, formatieren?, klasse? }] - formatieren(wert, zeile)
// darf einen String ODER ein einzelnes Element liefern (siehe Kommentar
// an der Stelle weiter unten, wo die Zelle gebaut wird).
// Bei Klick UND bei Pfeiltaste: beiAuswahl(zeile) aufrufen und die
// Zeile als ausgewählt markieren.
//
// aktionen (Punkt 5, optional): (zeile) => [{ titel, svg, art?, ausführen: async () => {} }]
// - titel: der zugängliche Name des Icon-Knopfs (aria-label/title), da
//   ein Icon allein keinen hat.
// - svg: rohes <svg>...</svg>-Markup, EIN MAL je Bereich als Konstante
//   geschrieben (siehe iconAus() in flotte.js) - kein Icon-Font, keine
//   externe Abhängigkeit, wie im Auftrag verlangt.
// - art: 'gefährlich', um dieselbe rote Einfärbung wie knopf-gefährlich
//   zu bekommen (siehe .zeilen-aktion-gefährlich in style.css); sonst
//   weggelassen.
// - ausführen: wie bei den Knöpfen aus zeigeMaske() - Fehler werden
//   hier zentral gefangen und in die Statuszeile übersetzt.
//
// Ohne aktionen (der Vorgabewert) verändert sich am Ergebnis nichts -
// keine zusätzliche Spalte, keine Zeile muss etwas davon wissen. Das
// ist mit Absicht so: der Auftrag verlangt den Baustein hier in
// rahmen.js, aber nur EINEN Bereich (flotte.js) als Beleg dafür, dass
// er verdrahtet ist - die anderen vier bleiben unangetastet und laufen
// unverändert weiter, bis sie in einem späteren Schritt eigene
// aktionen liefern.
function zeigeListe(kennung, zeilen, spalten, beiAuswahl, aktionen = null) {
    if (!istAktuellerVorgang(kennung)) return;

    listenZeilen = zeilen;
    listenAuswahl = beiAuswahl;
    listenIndex = -1;
    listenZeilenElemente = [];

    const wurzel = listenKoerper();
    wurzel.replaceChildren();

    const tabelle = document.createElement('table');
    tabelle.className = 'arbeitstabelle';

    const kopf = document.createElement('thead');
    const kopfZeile = document.createElement('tr');
    for (const spalte of spalten) {
        const th = document.createElement('th');
        th.textContent = spalte.titel;
        kopfZeile.append(th);
    }
    if (aktionen) {
        // Keine sichtbare Beschriftung - eine Spaltenüberschrift "Aktionen"
        // über lauter blossen Icon-Zellen wäre reine Deko. aria-label
        // hält die Tabelle für Screenreader trotzdem vollständig: eine
        // <th> ohne jeden Namen liesse die letzte Spalte namenlos wirken.
        const th = document.createElement('th');
        th.setAttribute('aria-label', 'Aktionen');
        kopfZeile.append(th);
    }
    kopf.append(kopfZeile);
    tabelle.append(kopf);

    const koerper = document.createElement('tbody');
    zeilen.forEach((zeile, index) => {
        const tr = document.createElement('tr');
        tr.tabIndex = -1;
        for (const spalte of spalten) {
            const td = document.createElement('td');
            const wert = zeile[spalte.feld];
            const inhalt = spalte.formatieren ? spalte.formatieren(wert, zeile) : (wert ?? '');
            // formatieren darf statt eines Strings auch ein einzelnes
            // Element liefern - eine Sparkline, einen Zellbalken oder eine
            // typografisch skalierte Zahl (siehe sparkline()/zellbalken()/
            // zahlSkaliert() weiter unten). textContent wäre dafür der
            // falsche Weg: ein Element dort hineingeschrieben erschiene
            // als "[object HTMLSpanElement]", nicht als das Element
            // selbst. replaceChildren() nimmt ein Element ODER (weiterhin)
            // einen String gleich sicher entgegen wie vorher textContent -
            // keine innerHTML-Stelle kommt dazu, an der ein
            // Schadensmeldungstext oder Kundenname durchliefe.
            if (inhalt instanceof Node) {
                td.replaceChildren(inhalt);
            } else {
                td.textContent = inhalt;
            }
            const klasse = typeof spalte.klasse === 'function' ? spalte.klasse(zeile) : spalte.klasse;
            if (klasse) td.className = klasse;
            tr.append(td);
        }
        if (aktionen) tr.append(zeilenAktionenZelle(aktionen(zeile) || []));
        tr.addEventListener('click', () => zeileWaehlen(index));
        koerper.append(tr);
        listenZeilenElemente.push(tr);
    });
    tabelle.append(koerper);
    wurzel.append(tabelle);
}

// Baut die Icon-Zelle EINER Zeile - für JEDE Zeile aufgerufen, auch
// wenn die Liste für diese Zeile keine einzige Handlung anbietet (dann
// bleibt die Zelle leer, aber vorhanden). Genau das hält die Spalte in
// jeder Zeile gleich breit: eine Zelle, die erst bei :hover ins DOM
// käme, würde die Tabellenspalte beim ersten Überfahren einer Zeile
// nachträglich aufweiten - das "Layout verschiebt sich"-Problem, vor
// dem der Auftrag ausdrücklich warnt. Sichtbar/unsichtbar regelt
// stattdessen ausschließlich CSS (.zeilen-aktionen, opacity statt
// display - siehe dortiger Kommentar für den Tastatur-Grund).
function zeilenAktionenZelle(liste) {
    const td = document.createElement('td');
    td.className = 'zeilen-aktionen-zelle';

    const wrapper = document.createElement('div');
    wrapper.className = 'zeilen-aktionen';

    for (const aktion of liste) {
        const knopf = document.createElement('button');
        knopf.type = 'button';
        knopf.className = aktion.art === 'gefaehrlich'
            ? 'zeilen-aktion zeilen-aktion-gefaehrlich' : 'zeilen-aktion';
        knopf.setAttribute('aria-label', aktion.titel);
        knopf.title = aktion.titel;
        // aktion.svg ist keine Nutzereingabe, sondern eine im jeweiligen
        // Bereich fest verdrahtete Konstante (siehe iconAus() in
        // flotte.js) - innerHTML ist hier deshalb unbedenklich, anders
        // als bei jedem textContent-Aufruf in bestätige()/frageNachGrund()
        // weiter oben, wo tatsächlich Benutzereingaben durchlaufen.
        knopf.innerHTML = aktion.svg;
        knopf.addEventListener('click', async (e) => {
            // Sonst wählte derselbe Klick zusätzlich die ganze Zeile
            // aus (tr trägt weiter unten einen eigenen 'click'-Handler,
            // der bei jedem Klick INNERHALB der Zeile feuert).
            e.stopPropagation();
            knopf.disabled = true;
            try {
                await aktion.ausfuehren();
            } catch (fehler) {
                melde(fehler.message, 'schlecht');
            } finally {
                knopf.disabled = false;
            }
        });
        wrapper.append(knopf);
    }

    td.append(wrapper);
    return td;
}

function zeileWaehlen(index) {
    if (index < 0 || index >= listenZeilen.length) return;
    listenZeilenElemente.forEach((el) => {
        el.classList.remove('ausgewaehlt');
        el.tabIndex = -1;
    });
    listenIndex = index;
    const element = listenZeilenElemente[index];
    element.classList.add('ausgewaehlt');
    element.tabIndex = 0;
    element.focus();
    element.scrollIntoView({ block: 'nearest' });
    if (listenAuswahl) listenAuswahl(listenZeilen[index]);
}

// ===== Detailmaske =====

let hauptknopfElement = null;

// felder: [{ name, titel, wert, typ, nurLesen?, optionen? }]
// knöpfe: [{ titel, art, ausführen: async () => {} }]
// art: 'haupt' | 'neben' | 'gefährlich' | 'schaffend'
//
// 'schaffend' (Punkt 4 der Gestaltung, grün wie --gut) kam mit dieser
// Bearbeitung dazu, ausdrücklich NEBEN 'haupt' statt an dessen Stelle:
// vor dieser Änderung liefen sowohl "Anlegen"-Knöpfe (ein neues Rad,
// eine neue Station, ein neuer Kunde, ein neuer Wartungsauftrag, eine
// neue Schadensmeldung entsteht) als auch reine "Speichern"/"Erledigen"-
// Knöpfe (eine BESTEHENDE Zeile ändern bzw. abschließen) unter
// demselben 'haupt'. Grün für das Anlegen ist eindeutig - es lässt
// etwas entstehen. Für "Speichern" (kunden.js, eine bestehende Person
// ändern) oder "Erledigen" (instandhaltung.js, einen laufenden Auftrag
// abschließen) wäre Grün dagegen irreführend: nichts NEUES entsteht
// dabei, und ein rein nach Farbe scannender Blick könnte "grün = fertig
// buchen" mit "grün = neu anlegen" verwechseln. Deshalb bleiben diese
// beiden Fälle bei 'haupt' (marine, wie zuvor) - nur die tatsächlichen
// Neuanlagen (flotte.js, kunden.js kundeAnlegenMaske, instandhaltung.js
// Auftrag eroeffnen/Schaden melden, stationen.js) wurden auf 'schaffend'
// umgestellt. Weiß auf --gut misst 5.36:1 (gemessen, siehe Bericht).
function zeigeMaske(titel, felder, knoepfe) {
    const wurzel = document.getElementById('detailmaske');
    wurzel.replaceChildren();
    hauptknopfElement = null;

    const ueberschrift = document.createElement('h2');
    ueberschrift.textContent = titel;
    wurzel.append(ueberschrift);

    const form = document.createElement('form');
    form.className = 'detailformular';
    // Kein natives Absenden - gespeichert wird über die Knöpfe bzw.
    // über Strg+S (maskeSpeichern), nicht über Enter/Submit.
    form.addEventListener('submit', (e) => e.preventDefault());

    for (const feld of felder) {
        const zeile = document.createElement('div');
        zeile.className = 'formularzeile';

        const label = document.createElement('label');
        label.textContent = feld.titel;
        label.htmlFor = `feld-maske-${feld.name}`;
        zeile.append(label);

        let eingabe;
        if (feld.optionen) {
            eingabe = document.createElement('select');
            for (const option of feld.optionen) {
                const opt = document.createElement('option');
                opt.value = option.wert;
                opt.textContent = option.text;
                if (option.wert === feld.wert) opt.selected = true;
                eingabe.append(opt);
            }
            // <select> kennt kein readonly - disabled ist die einzige
            // native Entsprechung. Nimmt das Feld aus der Tab-Reihenfolge,
            // ist bei nur lesbaren Werten aber ohne praktischen Nachteil.
            if (feld.nurLesen) eingabe.disabled = true;
        } else if (feld.typ === 'mehrzeilig') {
            eingabe = document.createElement('textarea');
            eingabe.value = feld.wert ?? '';
            if (feld.nurLesen) eingabe.readOnly = true;
        } else {
            eingabe = document.createElement('input');
            // Deutsche Typangaben auf die passenden HTML5-Eingabetypen
            // abbilden; alles andere (z. B. 'email') geht unverändert
            // durch.
            const typZuordnung = { zahl: 'number', datum: 'date' };
            eingabe.type = typZuordnung[feld.typ] || feld.typ || 'text';
            eingabe.value = feld.wert ?? '';
            if (feld.nurLesen) eingabe.readOnly = true;
        }
        eingabe.id = `feld-maske-${feld.name}`;
        eingabe.name = feld.name;
        zeile.append(eingabe);
        form.append(zeile);
    }
    wurzel.append(form);

    const knopfleiste = document.createElement('div');
    knopfleiste.className = 'knopfleiste';
    for (const def of knoepfe) {
        const knopf = document.createElement('button');
        knopf.type = 'button';
        knopf.textContent = def.titel;
        knopf.className = `knopf-${def.art}`;
        // Fehler werden hier zentral gefangen, statt in jedem
        // ausführen() einzeln: rufeAuf() aus daten.js wirft mit
        // Absicht bei einem Fehlschlag, damit der Aufrufer ihn nicht
        // schlucken kann. Diese Stelle ist der eine Ort, an dem alle
        // fünf Arbeitsbereiche diesen Wurf einheitlich in die
        // Statuszeile übersetzen.
        knopf.addEventListener('click', async () => {
            knopf.disabled = true;
            try {
                await def.ausfuehren();
            } catch (fehler) {
                melde(fehler.message, 'schlecht');
            } finally {
                knopf.disabled = false;
            }
        });
        knopfleiste.append(knopf);
        // Strg+S (maskeSpeichern()) klickt hauptknopfElement - das muss
        // seit der Aufteilung in 'haupt'/'schaffend' BEIDE Kategorien
        // erfassen, sonst wäre die Tastaturbedienung für jede
        // "Anlegen"-Maske stumm geworden, nur weil ihr Knopf jetzt grün
        // statt marine ist. Eine Maske hat ohnehin höchstens einen
        // dieser beiden - nie 'haupt' UND 'schaffend' gleichzeitig -,
        // deshalb bleibt "genau ein Hauptknopf" so oder so gewahrt.
        if (def.art === 'haupt' || def.art === 'schaffend') hauptknopfElement = knopf;
    }
    wurzel.append(knopfleiste);
}

// Eine leere Liste ist kein leerer Kasten. Sie sagt, WARUM nichts da ist,
// und bietet an, was als Nächstes zu tun wäre.
//
// kennung: von neuerVorgang() geliefert, genau wie bei zeigeListe() -
// und aus demselben Grund (KRITISCH 2). Seit f1ef6c3 trägt jeder
// Neuaufbau eine Kennung; zeigeListe() prüft sie, zeigeLeermaske() tat
// es bisher NICHT, obwohl sie nach demselben await steht wie zeigeListe()
// in jeder *Zeigen()-Funktion (schaedenZeigen()/auftraegeZeigen() in
// instandhaltung.js). Im Browser nachgestellt: Instandhaltung, Reiter
// "Auftraege" angeklickt (Vorgang A, damals leer) und sofort zurück auf
// "Schaeden" (Vorgang B, gefüllt). B löste zuerst auf und zeigte die
// Schadensliste; A löste dann VERSPÄTET auf und überschrieb sie
// klaglos mit "Keine laufenden Wartungsaufträge" - während der Reiter
// weiterhin "Offene Schaeden" anzeigte und die Werkzeugleiste "Schaden
// melden" stehen liess. Ein in sich widersprüchlicher Bildschirm, den
// dieselbe Prüfung wie bei zeigeListe() verhindert.
// angebot: { titel, ausführen: async () => {} } | null
function zeigeLeermaske(kennung, titel, erklaerung, angebot = null) {
    if (!istAktuellerVorgang(kennung)) return;

    listenZeilen = [];
    listenAuswahl = null;
    listenIndex = -1;
    listenZeilenElemente = [];

    const wurzel = listenKoerper();
    wurzel.replaceChildren();

    const kasten = document.createElement('div');
    kasten.className = 'leermaske';

    const ueberschrift = document.createElement('h2');
    ueberschrift.textContent = titel;
    kasten.append(ueberschrift);

    const text = document.createElement('p');
    text.textContent = erklaerung;
    kasten.append(text);

    if (angebot) {
        const knopf = document.createElement('button');
        knopf.type = 'button';
        knopf.textContent = angebot.titel;
        // Bewusst 'knopf-haupt' (marine) statt 'knopf-schaffend' (grün),
        // anders als bei zeigeWerkzeugleiste() weiter oben: DIESES Angebot
        // ist nicht immer eine Neuanlage. instandhaltung.js bietet über
        // denselben Parameter sowohl "Schaden melden" (legt tatsächlich
        // etwas an) als auch "Zu den offenen Schäden" (wechselt nur den
        // Unterreiter, legt nichts an) an - ein hier fest verdrahtetes
        // Grün wäre im zweiten Fall falsch. Ein eigenes 'art'-Feld im
        // angebot-Objekt hätte das sauber getrennt, war für eine leere
        // Liste als Randfall aber mehr Aufwand, als der heutige Bestand
        // (zwei von vier Aufrufern nutzen überhaupt ein angebot) rechtfertigt.
        knopf.className = 'knopf-haupt';
        knopf.addEventListener('click', async () => {
            knopf.disabled = true;
            try {
                await angebot.ausfuehren();
            } catch (fehler) {
                melde(fehler.message, 'schlecht');
            } finally {
                knopf.disabled = false;
            }
        });
        kasten.append(knopf);
    }
    wurzel.append(kasten);

    // Ohne Zeilen gibt es nichts auszuwählen - eine noch offene Maske
    // bezöge sich sonst auf eine Zeile, die gerade verschwunden ist.
    document.getElementById('detailmaske').replaceChildren();
    hauptknopfElement = null;
}

// Zwei Listen in einem Bereich, wenn sie fachlich zusammengehören.
//
// kennung: dieselbe Absicherung wie bei zeigeListe()/zeigeLeermaske()
// (WICHTIG 3, aus derselben Prüfung wie KRITISCH 2). Heute läuft jeder
// Aufruf zufällig SYNCHRON direkt nach neuerVorgang() (siehe
// instandhaltungAufbauen()/auswertungenAufbauen()), also ist der Fehler
// beim jetzigen Baustand nicht auslösbar - aber die Schnittstelle bot
// bislang gar keine Kennung an. Ein künftiger Bereich, der die Reiter
// erst NACH einem await aufbaut (etwa nach einem eigenen Nachladen),
// erbte den Fehler aus KRITISCH 2 ohne dass ihn hier etwas hinderte. Die
// Prüfung kostet den heutigen synchronen Fall nichts (kennung ist dann
// immer aktuell) und schützt den nächsten Aufrufer trotzdem.
// reiter: [{ schluessel, titel }]
function zeigeUnterreiter(kennung, reiter, aktiv, beiWechsel) {
    if (!istAktuellerVorgang(kennung)) return;

    const leiste = reiterleiste();
    leiste.replaceChildren();
    for (const r of reiter) {
        const knopf = document.createElement('button');
        knopf.type = 'button';
        knopf.textContent = r.titel;
        knopf.setAttribute('role', 'tab');
        knopf.setAttribute('aria-selected', String(r.schluessel === aktiv));
        knopf.className = r.schluessel === aktiv ? 'reiter aktiv' : 'reiter';
        knopf.addEventListener('click', () => beiWechsel(r.schluessel));
        leiste.append(knopf);
    }
}

// Synchron, weil jeder Maskenaufbau es mehrfach fragt. Der
// Rollenspeicher ist zu diesem Zeitpunkt gefüllt - seiteAufbauen() hat
// ihn geladen, bevor irgendein Bereich baut.
//
// instanceof Set statt einer Prüfung auf null: geladeneRollen kann jetzt
// auch false sein (kein Mitarbeiter). false.has(...) würfe eine
// TypeError - deny-by-default heißt hier, jeden Nicht-Set-Fall
// gleichermaßen als "keine Rolle" zu behandeln, nicht nur den
// Anfangszustand vor dem ersten Laden.
function darfRolle(code) {
    return geladeneRollen instanceof Set && geladeneRollen.has(code);
}

// ===== Profilmenü =====
//
// Bedienung des Rundknopfs oben rechts (Punkt 3). Absichtlich getrennt
// von profilAufbauen() oben, das nur den INHALT füllt: profilAufbauen()
// läuft bei jedem seiteAufbauen()-Durchlauf erneut, ein hier
// angehängter Klick-Handler würde sich also mit der Zeit vervielfachen,
// wenn er dort stände. Hier, am Skriptende, läuft er dagegen GENAU
// EINMAL - derselbe Aufbau wie bei "Anmeldung verdrahten" unten.
const knopfProfil = document.getElementById('knopf-profil');
const profilmenue = document.getElementById('profilmenue');

function profilmenueOffen() {
    return !profilmenue.hidden;
}

function profilmenueSchliessen() {
    if (!profilmenueOffen()) return;
    profilmenue.hidden = true;
    knopfProfil.setAttribute('aria-expanded', 'false');
}

function profilmenueOeffnen() {
    profilmenue.hidden = false;
    knopfProfil.setAttribute('aria-expanded', 'true');
}

// Ein <button> reagiert schon von sich aus auf Enter UND Leertaste wie
// auf einen Klick - ein eigener keydown-Handler für das ÖFFNEN wäre
// eine zweite, überflüssige Umsetzung derselben Tastaturbedienung.
// Nur das SCHLIESSEN per Escape braucht eine eigene Behandlung, weiter
// unten im globalen keydown-Listener.
knopfProfil.addEventListener('click', () => {
    if (profilmenueOffen()) profilmenueSchliessen();
    else profilmenueOeffnen();
});

// Klick außerhalb schließt das Menü. Auf 'click' verdrahtet, nicht
// 'pointerdown': der öffnende Klick auf knopfProfil selbst durchläuft
// wegen der Ereignisblase erst den eigenen Handler oben (Menü geht auf)
// und danach, im selben Klick, diesen document-Handler - der aber
// erkennt über knopfProfil.contains(e.target), dass der Klick INNERHALB
// des Profilbereichs lag, und lässt das gerade geöffnete Menü in Ruhe.
document.addEventListener('click', (e) => {
    if (!profilmenueOffen()) return;
    if (knopfProfil.contains(e.target) || profilmenue.contains(e.target)) return;
    profilmenueSchliessen();
});

document.getElementById('knopf-einstellungen').addEventListener('click', () => {
    profilmenueSchliessen();
    // Ehrlich statt stumm: es gibt noch keine Einstellungsseite. Der
    // Menüpunkt zu verstecken oder zu deaktivieren hätte dieselbe
    // Frage nur verschoben ("warum fehlt er/ warum tut er nichts?").
    melde('Einstellungen gibt es in dieser Warenwirtschaft noch nicht.', 'neutral');
});

// ===== Tastaturbedienung =====
//
// Tastatur vor Maus. Eine Arbeitsmaske, die Maushandbetrieb erzwingt,
// kostet bei Wiederholung Minuten - und dieselbe Person macht dieselbe
// Buchung hundertmal.
function maskeSpeichern() {
    hauptknopfElement?.click();
}

function maskeVerwerfen() {
    const maske = document.getElementById('detailmaske');
    if (!maske.hasChildNodes()) return;   // nichts offen, nichts zu verwerfen
    maske.replaceChildren();
    hauptknopfElement = null;
    if (listenIndex !== -1) {
        listenZeilenElemente[listenIndex]?.classList.remove('ausgewaehlt');
        listenIndex = -1;
    }
}

document.addEventListener('keydown', (e) => {
    // Ein offener <dialog> behandelt Escape (und seine eigene Fokusfalle)
    // selbst - siehe bestätige(). Würde dieser Listener hier zusätzlich
    // reagieren, verwürfe Escape gleichzeitig die Maske IM Hintergrund,
    // während der Dialog sich schließt: zwei Wirkungen für einen
    // Tastendruck.
    if (document.querySelector('dialog[open]')) return;

    if (e.key === 'Escape') {
        // Das Profilmenü zuerst pruefen: ist es offen, gehört Escape
        // IHM - sonst verwürfe derselbe Tastendruck zusätzlich eine im
        // Hintergrund vielleicht offene Detailmaske, zwei Wirkungen für
        // einen Tastendruck (dieselbe Falle wie beim <dialog> oben).
        if (profilmenueOffen()) {
            profilmenueSchliessen();
            knopfProfil.focus();   // Fokus sichtbar dorthin zurück, wo er herkam
            return;
        }
        maskeVerwerfen();
        return;
    }
    if (e.key === 's' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();   // sonst öffnet der Browser seinen eigenen Speichern-Dialog
        maskeSpeichern();
        return;
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        // Nicht feuern, während jemand in einem Eingabefeld der Maske
        // tippt - dort bewegen Pfeiltasten den Cursor, nicht die Liste.
        const zielTag = document.activeElement?.tagName;
        if (zielTag === 'INPUT' || zielTag === 'TEXTAREA' || zielTag === 'SELECT') return;
        if (listenZeilen.length === 0) return;
        e.preventDefault();
        const richtung = e.key === 'ArrowDown' ? 1 : -1;
        const naechsterIndex = Math.min(Math.max(listenIndex + richtung, 0), listenZeilen.length - 1);
        zeileWaehlen(naechsterIndex);
    }
});

// ===== Anmeldung verdrahten =====

document.getElementById('zustand-anmeldung').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fehlerAnzeige = document.getElementById('anmeldung-fehler');
    fehlerAnzeige.textContent = '';
    try {
        await anmelden(
            document.getElementById('feld-email').value,
            document.getElementById('feld-passwort').value
        );
        // Kein seiteAufbauen() hier: onAuthStateChange (SIGNED_IN) löst
        // über beiAnmeldungsWechsel weiter unten denselben Aufbau aus.
        // Ein zweiter Aufruf hier würde meineRollen() zweimal parallel
        // anstoßen.
    } catch (fehler) {
        fehlerAnzeige.textContent = fehler.message;
    }
});

document.getElementById('knopf-abmelden').addEventListener('click', () => abmelden());
document.getElementById('knopf-abmelden-fremd').addEventListener('click', () => abmelden());
// Der einzige Ausweg aus "Mitarbeiter ohne Rolle": ohne diesen Knopf
// sässe dort jemand fest, bis die Leitung eine Rolle zuträgt.
document.getElementById('knopf-abmelden-ohne-rolle').addEventListener('click', () => abmelden());

// beiAnmeldungsWechsel() ruft NICHT sofort mit dem aktuellen Zustand auf
// (anders als das Vorbild src/auth.js) - deshalb wird seiteAufbauen()
// unten zusätzlich einmal von Hand angestoßen, für den allerersten
// Seitenaufruf.
beiAnmeldungsWechsel(seiteAufbauen);
seiteAufbauen();
