// ============================================
// VeloCity Warenwirtschaft — Rahmen
//
// Die Oberflaeche muss VIER Zustaende unterscheiden koennen, die im
// Browser gleich aussehen:
//
//   1. nicht angemeldet             -> Anmeldemaske
//   2. angemeldet, kein Mitarbeiter -> Hinweis, kein Zugang
//   3. Mitarbeiter ohne Rolle       -> Hinweis, wer helfen kann
//   4. Mitarbeiter mit Rollen       -> Arbeitsoberflaeche
//
// Der zweite Fall ist der haeufigste und der, den man vergisst: JEDER
// Kunde kann sich hier anmelden, weil es dieselbe auth.users ist. Er
// bekaeme dann eine Oberflaeche, in der jede Sicht null Zeilen liefert -
// fehlerfrei, leer, unerklaerlich. Deshalb wird vor dem Aufbau gefragt,
// nicht danach.
//
// Der dritte Fall ist der, der bei genau einem Mitarbeiter im Bestand
// (VeloCity heute) zum NORMALFALL fuer jeden zweiten neuen Kollegen wird:
// ein echtes Mitarbeiterkonto, dem noch niemand eine Rolle zugeteilt hat.
// meineRollen() liefert dafuer ein LEERES Set - anders als "false" fuer
// "kein Mitarbeiter". Beide vorher gleich zu behandeln ("Kein Zugang")
// schickte diesen Fall in die falsche Richtung: er gehoert nicht zur
// Kundenverwaltung, sondern zur Leitung, die eine Rolle nachtragen kann.
// Deshalb hier vier Faelle statt drei, unterschieden per
// `rollen instanceof Set` statt per Wahrheitswert - ein leeres Set ist
// falsy in JavaScript, eine reine `if (rollen)`-Pruefung haette es mit
// "nicht angemeldet"/"kein Mitarbeiter" verwechselt.
// ============================================

const bereiche = new Map();
let aktiverBereich = null;

// Der Wert, den seiteAufbauen() zuletzt von meineRollen() bekommen hat.
// Gehoert hierher und nicht in anmeldung.js: dort ist rollenZwischenspeicher
// ein technischer Zwischenspeicher mit eigener Lebensdauer (verfaellt bei
// jedem echten Benutzerwechsel, siehe dortiger Kommentar). darfRolle()
// fragt dagegen den Stand, den DIESE Seite zuletzt tatsaechlich geladen
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
        // meineRollen() wirft seit der Pruefung von Aufgabe 1 bei einem
        // technischen Fehlschlag, statt still ein leeres Rollen-Set zu
        // liefern - genau damit ein Netzwerk- oder Rechtefehler nicht wie
        // "kein Mitarbeiter" aussieht. Wird der Wurf hier nicht gefangen,
        // laeuft er als unbehandelte Ablehnung ins Leere: keiner der vier
        // Zustaende wird je sichtbar, die Seite bleibt wortlos beim
        // Ladetext stehen. Es gibt keinen eigenen fuenften Zustand fuer
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
    // ohne Rolle) ist falsy und wuerde von einer if(rollen)-Pruefung
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

// ===== Rollenabhaengige Navigation =====

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

// Fruehrer stand hier direkt "email · rolle1, rolle2, ..." in
// #benutzer-anzeige, einem einzelnen <span> in der Kopfleiste (Punkt 3
// der Gestaltung). Jetzt fuellt diese Funktion das aufklappbare
// Profilmenue - Bedienung (auf/zu, Escape, Klick daneben) wird davon
// GETRENNT, einmalig beim Laden verdrahtet (siehe "Profilmenue"
// weiter unten): navigationAufbauen() und damit profilAufbauen() laeuft
// bei jedem seiteAufbauen()-Durchlauf erneut (z. B. nach USER_UPDATED,
// siehe anmeldung.js), ein hier zusaetzlich angehaengter Klick-Handler
// wuerde sich mit der Zeit vervielfachen.
function profilAufbauen(benutzer, rollen) {
    const meta = benutzer.user_metadata || {};
    const vorname = meta.vorname || '';
    const nachname = meta.nachname || '';
    const anzeigeName = (vorname || nachname) ? `${vorname} ${nachname}`.trim() : benutzer.email;

    // Konterfei: es gibt kein Mitarbeiterfoto, deshalb Initialen aus Vor-
    // und Nachname - beides liegt (falls gepflegt) in user_metadata,
    // demselben Feld, aus dem getUserDisplayName() in src/auth.js fuer
    // Kundenkonten schon den Vornamen liest (siehe dortiger Kommentar).
    // velocity.mitarbeiter fuehrt zwar ebenfalls vorname/nachname, ist
    // aber ueber keine v_wawi_-Sicht und keine RPC fuer den eigenen
    // Datensatz erreichbar - das anzulegen waere eine Datenbankaenderung,
    // die dieser Auftrag ausdruecklich nicht vorsieht. Fehlt die
    // Metadatenangabe, werden die Initialen NOTFALLS aus der E-Mail
    // abgeleitet (siehe initialenAus()).
    //
    // Ein ECHTES Foto ist trotzdem mit einer einzigen Zeile eintauschbar,
    // ohne diese Funktion sonst anzufassen - die Regel dahinter setzt
    // .profilknopf-avatar in style.css bereits als Bildflaeche an
    // (background-size: cover):
    //   const avatar = document.getElementById('profil-initialen');
    //   avatar.style.backgroundImage = `url(${bildUrl})`;
    //   avatar.textContent = '';   // sonst ueberlagern sich Initialen und Foto
    document.getElementById('profil-initialen').textContent =
        initialenAus(vorname, nachname, benutzer.email);

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
    // Notfall-Ableitung aus der E-Mail (Auftrag Punkt 3, ausdruecklich
    // erlaubt): die ersten beiden Buchstaben vor dem @. Nicht einfach
    // die ersten zwei ZEICHEN, weil ein Postfach wie "m.mueller@..." sonst
    // "M." statt "MM" ergaebe - ein Punkt ist kein Initial.
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
    // Bereichs als Karteileiche stehen, bis der neue Bereich zufaellig
    // selbst wieder zeigeListe()/zeigeUnterreiter() aufruft. Der
    // Listenzustand (Auswahl, Zeilen) gehoert ebenfalls zurueckgesetzt -
    // eine ausgewaehlte Zeile eines fremden Bereichs darf nicht als
    // "ausgewaehlt" im neuen Bereich weiterleben.
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

// Jede Buchung wird hier bestaetigt. Wer zwanzig Raeder nacheinander
// umbucht, braucht die Rueckmeldung dort, wo er ohnehin hinsieht - nicht
// als Blase in einer Ecke, die nach drei Sekunden verschwindet. Deshalb
// bleibt der Text stehen, bis der naechste kommt.
function melde(text, art = 'neutral') {
    const zeile = document.getElementById('statuszeile');
    zeile.textContent = text;
    zeile.className = art;   // neutral | gut | warnung | schlecht
    // Von neuerVorgang() gelesen und dort sofort verbraucht (siehe
    // dortiger Kommentar) - deshalb hier roh und ungeprueft gesetzt.
    letzteMeldeArt = art;
}

// ===== Vorgangsverwaltung =====
//
// ERSTER ANLAUF (verworfen): eine Buchungsbestaetigung ("Rad ...
// ausgemustert.", art='gut') kommt aus einem Knopf; direkt danach ruft
// jede *Aufbauen()-Funktion die Liste neu auf und schloss frueher mit
// einer eigenen Uebersichtsmeldung ("10 Stationen") ab, die die
// Bestaetigung sofort ueberschrieb. Die erste Loesung dafuer war EIN
// gemeinsames Bit ("die letzte Meldung war eine noch unverbrauchte
// Bestaetigung"). Die Pruefung hat das durchfallen lassen, mit zwei
// nachgestellten Befunden:
//
//   1. Zwei Buchungen kurz hintereinander, deren Neuaufbauten sich
//      ueberholen (Buchung A startet ihren Neuaufbau, dann Buchung B
//      ihren - B's Bestaetigung steht, dann kommt ZUERST A's Neuaufbau
//      zurueck). Ein einzelnes Bit weiss nicht, dass die Bestaetigung
//      inzwischen zu B gehoert, nicht zu A - A's Neuaufbau "verbraucht"
//      das Bit, das fuer B gedacht war, und B's eigener Neuaufbau
//      schreibt danach ungebremst seine Uebersicht ueber B's eigene,
//      noch druckfrische Bestaetigung.
//   2. Ein Bereichswechsel waehrend ein Neuaufbau des VORHERIGEN
//      Bereichs noch laeuft: kommt der spaet zurueck, schreibt er Liste
//      UND Statuszeile des NEUEN Bereichs voll, obwohl die Navigation
//      laengst woanders steht. Das Bit schuetzt nicht davor - es kennt
//      nur "war zuletzt eine Bestaetigung da", nicht "gehoert dieser
//      Neuaufbau ueberhaupt noch zur Gegenwart".
//
// Beiden Befunden gemeinsam: es gab keine Stelle, an der ein Neuaufbau
// merken konnte, dass ER SELBST veraltet ist. Ein Bit kennt nur DASS
// etwas war, nicht WOZU es gehoerte.
//
// LOESUNG: jeder Vorgang (jeder Aufruf einer *Aufbauen()-Funktion)
// bekommt beim Start eine eigene, fortlaufende Kennung. neuerVorgang()
// liefert sie; jeder weitere Schreibversuch dieses Vorgangs - Liste
// (zeigeListe) UND Statuszeile (meldeVorgang) - traegt diese Kennung
// vor sich her und prueft bei sich SELBST, ob sie noch die aktuelle
// ist. Ein Vorgang, dessen Kennung inzwischen ueberholt wurde -von
// einem neueren Neuaufbau DESSELBEN Bereichs (Befund 1) oder vom
// Neuaufbau eines ANDEREN Bereichs nach einem Wechsel (Befund 2) -
// schreibt gar nichts mehr, weder Liste noch Statuszeile. Kein Bit,
// keine Warteschlange: die zwanzigste Buchung einer Reihe zeigt weiter
// sofort ihre eigene Bestaetigung, unabhaengig davon, wie lange die
// vorherigen Neuaufbauten noch unterwegs sind.
//
// Die Bestaetigung selbst haengt jetzt am VORGANG statt an einem
// geteilten Bit: neuerVorgang() liest, OHNE await dazwischen, welche
// Art die zuletzt sichtbare Meldung hatte (letzteMeldeArt, von melde()
// gesetzt). melde(..., 'gut') und der direkt folgende Aufruf einer
// *Aufbauen()-Funktion stehen in JEDEM Aufrufer als zwei aufeinander-
// folgende Anweisungen OHNE dazwischenliegendes await - JavaScript
// raeumt dazwischen nichts anderes ab. Zeigt die Statuszeile in diesem
// Moment noch eine frische Bestaetigung, gehoert sie zu GENAU DEM
// Vorgang, der jetzt beginnt - nicht zu irgendeinem frueheren. Die
// Markierung wird dabei sofort verbraucht (letzteMeldeArt = null):
// ein zweiter, unabhaengiger Neuaufbau nach demselben Vorgang (ohne
// neue Buchung dazwischen) soll seine eigene Uebersicht wieder normal
// zeigen, nicht ein zweites Mal von derselben, laengst gezeigten
// Bestaetigung unterdrueckt werden.
//
// Verwerfen gehoert HIERHER, nicht in die Bereiche (Ruling der
// zweiten Pruefung): jeder der fuenf Arbeitsbereiche ruft nur
// neuerVorgang() (eine Zeile, ganz am Anfang jeder *Aufbauen()-
// Funktion) und reicht die Kennung an zeigeListe()/meldeVorgang()
// weiter - die Entscheidung, ob ein Schreibversuch noch gilt, faellt
// ausschliesslich hier.
let vorgangsZaehler = 0;
let aktuellerVorgang = 0;            // Kennung des zuletzt gestarteten Vorgangs
let vorgangMitOffenerBestaetigung = null;  // Kennung, deren Bestaetigung noch "frisch" ist
let letzteMeldeArt = null;           // von melde() gesetzt, von neuerVorgang() verbraucht

// Von jeder *Aufbauen()-Funktion als ALLERERSTE Anweisung aufzurufen,
// vor jedem await. Liefert die Kennung dieses Vorgangs.
function neuerVorgang() {
    vorgangsZaehler += 1;
    aktuellerVorgang = vorgangsZaehler;
    vorgangMitOffenerBestaetigung = letzteMeldeArt === 'gut' ? aktuellerVorgang : null;
    letzteMeldeArt = null;   // verbraucht - siehe Begruendung oben
    return aktuellerVorgang;
}

// true, wenn kennung noch der zuletzt gestartete Vorgang ist - false,
// wenn seitdem ein neuerer begonnen hat (ein weiterer Neuaufbau
// desselben Bereichs, ein Bereichswechsel, oder beides).
function istAktuellerVorgang(kennung) {
    return kennung === aktuellerVorgang;
}

// Liefert die Kennung des Vorgangs, der GERADE laeuft - anders als
// neuerVorgang() OHNE selbst einen neuen zu beginnen. Fuer Masken, die vor
// dem Anzeigen selbst nachladen (radAnlegenMaske() in flotte.js: Promise.all
// ueber Modelle und Stationen; schadenMeldenMaske() in instandhaltung.js:
// die Flotte) und deshalb zwischen ihrem eigenen Start und ihrem
// zeigeMaske()-Aufruf einen Bereichswechsel oder Unterreiterwechsel
// erleben koennen. Diese Masken sind selbst KEIN *Aufbauen()-Vorgang und
// duerfen keinen eigenen ziehen - neuerVorgang() verbraucht dabei
// letzteMeldeArt (siehe dort), was einer Anlegemaske ohne eigene
// Buchungsbestaetigung faelschlich eine fremde Bestaetigung klauen wuerde.
// Sie merken sich stattdessen beim Start, welcher *Aufbauen()-Vorgang
// gerade lief, und pruefen nach ihrem eigenen Laden per
// istAktuellerVorgang(), ob er es immer noch ist.
//
// Im Browser nachgestellt (WICHTIG 4): Flotte -> "Neues Rad anlegen"
// geklickt -> vor der Rueckkehr (Promise.all noch unterwegs) zu Stationen
// gewechselt. Ohne diese Pruefung erschien die Anlegemaske verspaetet UEBER
// der Stationenliste; ein Klick auf "Anlegen" dort legte wirklich ein Rad
// an, und der anschliessende flotteAufbauen() bekam die NEUESTE Kennung und
// ueberschrieb damit die gerade angezeigte Stationenliste, waehrend die
// Navigation weiterhin "Stationen" zeigte. Mit der Pruefung bricht
// radAnlegenMaske() nach dem Bereichswechsel wortlos ab, wie ein
// veralteter *Aufbauen()-Vorgang auch.
function laufenderVorgang() {
    return aktuellerVorgang;
}

// Die Statuszeilen-Schreibstelle jeder *Aufbauen()-Funktion - sowohl
// fuer den Ladefehler-Zweig (art='schlecht') als auch fuer die
// abschliessende Uebersichtsmeldung (art='neutral', Vorgabewert). NICHT
// fuer die Bestaetigung selbst, die bleibt ein direkter Aufruf von
// melde(text, 'gut') im Knopf-Handler, BEVOR die *Aufbauen()-Funktion
// (und mit ihr neuerVorgang()) ueberhaupt laeuft.
//
// Ein veralteter Vorgang schreibt ueberhaupt nichts - auch keinen
// Fehler: gehoert der Vorgang nicht mehr zur Gegenwart (Bereich
// gewechselt, oder ein neuerer Neuaufbau laeuft bereits), ist auch sein
// eigener Ladefehler nicht mehr relevant, siehe Befund 2 oben. Nur
// innerhalb eines noch aktuellen Vorgangs gilt die Reihenfolge aus dem
// Auftrag: eine Uebersichtsmeldung (art='neutral') faellt genau einmal
// aus, wenn dieser Vorgang noch eine unverbrauchte Bestaetigung traegt -
// ein Fehler (art='schlecht') dagegen schreibt IMMER, unterdrueckt durch
// nichts.
function meldeVorgang(kennung, text, art = 'neutral') {
    if (!istAktuellerVorgang(kennung)) return;
    if (art === 'neutral' && vorgangMitOffenerBestaetigung === kennung) {
        vorgangMitOffenerBestaetigung = null;   // verbraucht, Bestaetigung bleibt stehen
        return;
    }
    melde(text, art);
}

// ===== Bestaetigungsdialog =====

// Fuer alles, was sich nicht zurueckholen laesst. Kein window.confirm:
// das laesst sich nicht gestalten und nicht mit der Tastatur bedienen,
// wie der Rest dieser Oberflaeche. <dialog>.showModal() uebernimmt die
// Fokusfalle von sich aus und schliesst bei Escape ueber sein eigenes
// 'cancel'-Ereignis, unabhaengig vom globalen keydown-Listener aus
// Schritt 6 - der ueberspringt Escape deshalb, solange ein <dialog>
// offen ist (siehe dort), statt selbst zu reagieren und mit dem
// Browser um dieselbe Taste zu konkurrieren.
function bestaetige(frage, bestaetigungswort = null) {
    return new Promise((ergebnisMelden) => {
        const dialog = document.createElement('dialog');
        dialog.className = 'velocity-dialog';

        // frage traegt bei den wichtigeren Dialogen mehrere inhaltliche
        // Bloecke, getrennt durch eine Leerzeile (\n\n) - der Art.-17-Dialog
        // in kunden.js etwa WAS VERSCHWINDET, WAS BLEIBT, WAS DAS NICHT
        // LEISTET und den Unumkehrbarkeits-Hinweis. EIN <p> mit textContent
        // faltet solche Zeilenumbrueche zu einem einzigen Fliesstext
        // zusammen - .velocity-dialog p kennt kein white-space: pre-line.
        // Deshalb hier ein eigenes <p> je Block, weiterhin ausschliesslich
        // ueber textContent gesetzt, nie ueber innerHTML: ein Text ohne
        // Leerzeile (die meisten Aufrufer) ergibt unveraendert genau ein
        // <p>. Allgemein geloest, weil jeder Dialog ueber bestaetige()
        // laeuft - nicht nur der Art.-17-Fall, der den Fehler gefunden hat.
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
            // Ein Klick allein darf hier nicht reichen - das ist fuer
            // die Anonymisierung gedacht und fuer nichts sonst.
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
        // dialog.close() loest nur 'close' aus, nicht 'cancel' - der
        // Rueckgabewert entscheidet unten einheitlich ueber das Ergebnis,
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
        // Ohne Bestaetigungswort faellt der Anfangsfokus bewusst auf
        // Abbrechen: ein versehentliches Enter darf eine gefaehrliche
        // Aktion nicht bestaetigen. Mit Wort faellt er auf das Feld, weil
        // dort ohnehin zuerst getippt werden muss.
        (eingabe || abbrechenKnopf).focus();
    });
}

// Ein einzeiliger Eingabedialog. Liefert null bei Abbruch - und der
// Aufrufer muss das pruefen: eine Buchung ohne Grund ist eine Buchung,
// die spaeter niemand erklaeren kann.
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
        // Enter im Feld bestaetigt - ein Dialog mit genau einem Feld ist
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
// Liste und Maske gleichzeitig. Der Bearbeitungsfluss ist: auswaehlen,
// aendern, speichern, naechster Satz - ohne Seitenwechsel. Das ist der
// Unterschied zwischen einer Arbeitsmaske und einer Website.

let listenZeilen = [];
let listenAuswahl = null;
let listenIndex = -1;
let listenZeilenElemente = [];

// #arbeitsliste kann zwei Kinder tragen: die Reiterleiste (nur wenn
// zeigeUnterreiter benutzt wurde) und den Listenkoerper. Beide werden
// bei Bedarf angelegt, unabhaengig davon, in welcher Reihenfolge
// zeigeListe/zeigeUnterreiter/zeigeLeermaske aufgerufen werden -
// reiterleiste() haengt sich immer als erstes Kind ein.
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
// erste Stelle gehaengt, nicht nur bei der Neuanlage: Instandhaltung
// (Aufgabe 7) blendet ihre Werkzeugleiste je nach Unterreiter ein und
// aus - zeigeWerkzeugleiste(false, ...) entfernt das Element dabei
// vollstaendig (siehe dort). Kommt es spaeter wieder, legt
// werkzeugleiste() ein NEUES Element an und haengt es vor den
// jeweils aktuellen ersten Kind - traf das bislang unveraendert
// dagebliebene reiterleiste-Element, sprang die Werkzeugleiste ueber
// die Reiter, obwohl instandhaltungAufbauen() sie in der Reihenfolge
// Werkzeugleiste-dann-Reiter aufbaut. Im Browser nachgestellt: Reiter
// wechseln, Werkzeugleiste dabei aus- und wieder einblenden lassen -
// Reiter standen danach unter der Werkzeugleiste, nicht mehr darueber.
// Ein insertBefore auf ein bereits eingehaengtes Element VERSCHIEBT es
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
// (Aufgaben 4 und 5) hatten das unabhaengig voneinander erfunden -
// flotteWerkzeugleiste/flotteWerkzeugleisteAufbauen und
// stationenWerkzeugleiste/stationenWerkzeugleisteAufbauen, wortgleich
// bis auf den Namen, mit je einer eigenen ID. Der Auftrag gab dafuer
// keinen Code vor; zwei Bearbeiter haben unabhaengig dasselbe Muster
// gebaut - ein Zeichen, dass es hierher gehoert, nicht in jeden Bereich
// einzeln.
//
// Find-or-create auf eine FESTE ID, als erstes Kind von #arbeitsliste
// eingehaengt - dieselbe Machart wie listenKoerper() und reiterleiste()
// oben. Genau deshalb braucht dieser Baustein KEINE eigene
// Aufraeumlogik beim Bereichswechsel: bereichWechseln() leert
// #arbeitsliste ohnehin per replaceChildren(), bevor der neue Bereich
// aufbaut - das reisst die Werkzeugleiste des VORHERIGEN Bereichs mit
// heraus, wie es listenkoerper/reiterleiste auch trifft. Eine
// bereichseigene ID und ein bereichseigenes Wegraeumen (wie es die
// beiden Vorlagen taten) waeren nur eine zweite Absicherung fuer
// denselben Fall gewesen - und eine, die vergessen werden kann, wenn
// der Container aus Versehen ausserhalb von #arbeitsliste haengt. Im
// Browser nachgestellt: zwischen Flotte und Stationen hin- und
// hergewechselt, jeweils mit und ohne disposition-Rolle - immer genau
// eine oder gar keine Werkzeugleiste, nie zwei uebereinander.
//
// sichtbar: ob die aufrufende Rolle den Knopf ueberhaupt sehen darf
// (ueblicherweise darfRolle(...)). false raeumt den Container komplett
// ab, statt ihn leer stehen zu lassen - ein Container ohne Inhalt
// bliebe sonst als schmaler, unerklaerter Streifen ueber der Liste
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
    // einzige Aufruf dieses Bausteins ueber alle fuenf Bereiche legt
    // etwas NEU an - "Neues Rad anlegen", "Neuen Kunden anlegen", "Neue
    // Station anlegen", "Schaden melden" - die Werkzeugleiste hat
    // laut ihrem eigenen Kopf-Kommentar oben ohnehin keinen anderen
    // Zweck. Gruen ist hier eindeutig, siehe die ausfuehrlichere
    // Begruendung bei der art-Erlaeuterung von zeigeMaske() weiter unten
    // fuer die Faelle, in denen es das NICHT ist.
    knopf.className = 'knopf-schaffend';
    // Derselbe zentrale Fehlerfang wie bei den Knoepfen aus zeigeMaske()/
    // zeigeLeermaske(): jeder Aufrufer muesste ihn sonst selbst
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

// kennung: von neuerVorgang() geliefert, siehe Kommentar dort. Ein
// veralteter Vorgang zeichnet die Liste nicht mehr - sonst ueberschriebe
// ein spaet zurueckkommender Neuaufbau eines VORHERIGEN Bereichs oder
// eines ueberholten Buchungsvorgangs die Liste, die der Anwender gerade
// vor sich hat.
// spalten: [{ feld, titel, formatieren?, klasse? }]
// Bei Klick UND bei Pfeiltaste: beiAuswahl(zeile) aufrufen und die
// Zeile als ausgewaehlt markieren.
//
// aktionen (Punkt 5, optional): (zeile) => [{ titel, svg, art?, ausfuehren: async () => {} }]
// - titel: der zugaengliche Name des Icon-Knopfs (aria-label/title), da
//   ein Icon allein keinen hat.
// - svg: rohes <svg>...</svg>-Markup, EIN MAL je Bereich als Konstante
//   geschrieben (siehe iconAus() in flotte.js) - kein Icon-Font, keine
//   externe Abhaengigkeit, wie im Auftrag verlangt.
// - art: 'gefaehrlich', um dieselbe rote Einfaerbung wie knopf-gefaehrlich
//   zu bekommen (siehe .zeilen-aktion-gefaehrlich in style.css); sonst
//   weggelassen.
// - ausfuehren: wie bei den Knoepfen aus zeigeMaske() - Fehler werden
//   hier zentral gefangen und in die Statuszeile uebersetzt.
//
// Ohne aktionen (der Vorgabewert) veraendert sich am Ergebnis nichts -
// keine zusaetzliche Spalte, keine Zeile muss etwas davon wissen. Das
// ist mit Absicht so: der Auftrag verlangt den Baustein hier in
// rahmen.js, aber nur EINEN Bereich (flotte.js) als Beleg dafuer, dass
// er verdrahtet ist - die anderen vier bleiben unangetastet und laufen
// unveraendert weiter, bis sie in einem spaeteren Schritt eigene
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
        // Keine sichtbare Beschriftung - eine Spaltenueberschrift "Aktionen"
        // ueber lauter blossen Icon-Zellen waere reine Deko. aria-label
        // haelt die Tabelle fuer Screenreader trotzdem vollstaendig: eine
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
            td.textContent = spalte.formatieren ? spalte.formatieren(wert, zeile) : (wert ?? '');
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

// Baut die Icon-Zelle EINER Zeile - fuer JEDE Zeile aufgerufen, auch
// wenn die Liste fuer diese Zeile keine einzige Handlung anbietet (dann
// bleibt die Zelle leer, aber vorhanden). Genau das haelt die Spalte in
// jeder Zeile gleich breit: eine Zelle, die erst bei :hover ins DOM
// kaeme, wuerde die Tabellenspalte beim ersten Ueberfahren einer Zeile
// nachtraeglich aufweiten - das "Layout verschiebt sich"-Problem, vor
// dem der Auftrag ausdruecklich warnt. Sichtbar/unsichtbar regelt
// stattdessen ausschliesslich CSS (.zeilen-aktionen, opacity statt
// display - siehe dortiger Kommentar fuer den Tastatur-Grund).
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
        // als bei jedem textContent-Aufruf in bestaetige()/frageNachGrund()
        // weiter oben, wo tatsaechlich Benutzereingaben durchlaufen.
        knopf.innerHTML = aktion.svg;
        knopf.addEventListener('click', async (e) => {
            // Sonst waehlte derselbe Klick zusaetzlich die ganze Zeile
            // aus (tr traegt weiter unten einen eigenen 'click'-Handler,
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
// knoepfe: [{ titel, art, ausfuehren: async () => {} }]
// art: 'haupt' | 'neben' | 'gefaehrlich' | 'schaffend'
//
// 'schaffend' (Punkt 4 der Gestaltung, gruen wie --gut) kam mit dieser
// Bearbeitung dazu, ausdruecklich NEBEN 'haupt' statt an dessen Stelle:
// vor dieser Aenderung liefen sowohl "Anlegen"-Knoepfe (ein neues Rad,
// eine neue Station, ein neuer Kunde, ein neuer Wartungsauftrag, eine
// neue Schadensmeldung entsteht) als auch reine "Speichern"/"Erledigen"-
// Knoepfe (eine BESTEHENDE Zeile aendern bzw. abschliessen) unter
// demselben 'haupt'. Gruen fuer das Anlegen ist eindeutig - es laesst
// etwas entstehen. Fuer "Speichern" (kunden.js, eine bestehende Person
// aendern) oder "Erledigen" (instandhaltung.js, einen laufenden Auftrag
// abschliessen) waere Gruen dagegen irrefuehrend: nichts NEUES entsteht
// dabei, und ein rein nach Farbe scannender Blick koennte "gruen = fertig
// buchen" mit "gruen = neu anlegen" verwechseln. Deshalb bleiben diese
// beiden Faelle bei 'haupt' (marine, wie zuvor) - nur die tatsaechlichen
// Neuanlagen (flotte.js, kunden.js kundeAnlegenMaske, instandhaltung.js
// Auftrag eroeffnen/Schaden melden, stationen.js) wurden auf 'schaffend'
// umgestellt. Weiss auf --gut misst 5.36:1 (gemessen, siehe Bericht).
function zeigeMaske(titel, felder, knoepfe) {
    const wurzel = document.getElementById('detailmaske');
    wurzel.replaceChildren();
    hauptknopfElement = null;

    const ueberschrift = document.createElement('h2');
    ueberschrift.textContent = titel;
    wurzel.append(ueberschrift);

    const form = document.createElement('form');
    form.className = 'detailformular';
    // Kein natives Absenden - gespeichert wird ueber die Knoepfe bzw.
    // ueber Strg+S (maskeSpeichern), nicht ueber Enter/Submit.
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
            // abbilden; alles andere (z. B. 'email') geht unveraendert
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
        // ausfuehren() einzeln: rufeAuf() aus daten.js wirft mit
        // Absicht bei einem Fehlschlag, damit der Aufrufer ihn nicht
        // schlucken kann. Diese Stelle ist der eine Ort, an dem alle
        // fuenf Arbeitsbereiche diesen Wurf einheitlich in die
        // Statuszeile uebersetzen.
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
        // erfassen, sonst waere die Tastaturbedienung fuer jede
        // "Anlegen"-Maske stumm geworden, nur weil ihr Knopf jetzt gruen
        // statt marine ist. Eine Maske hat ohnehin hoechstens einen
        // dieser beiden - nie 'haupt' UND 'schaffend' gleichzeitig -,
        // deshalb bleibt "genau ein Hauptknopf" so oder so gewahrt.
        if (def.art === 'haupt' || def.art === 'schaffend') hauptknopfElement = knopf;
    }
    wurzel.append(knopfleiste);
}

// Eine leere Liste ist kein leerer Kasten. Sie sagt, WARUM nichts da ist,
// und bietet an, was als Naechstes zu tun waere.
//
// kennung: von neuerVorgang() geliefert, genau wie bei zeigeListe() -
// und aus demselben Grund (KRITISCH 2). Seit f1ef6c3 traegt jeder
// Neuaufbau eine Kennung; zeigeListe() prueft sie, zeigeLeermaske() tat
// es bisher NICHT, obwohl sie nach demselben await steht wie zeigeListe()
// in jeder *Zeigen()-Funktion (schaedenZeigen()/auftraegeZeigen() in
// instandhaltung.js). Im Browser nachgestellt: Instandhaltung, Reiter
// "Auftraege" angeklickt (Vorgang A, damals leer) und sofort zurueck auf
// "Schaeden" (Vorgang B, gefuellt). B loeste zuerst auf und zeigte die
// Schadensliste; A loeste dann VERSPAETET auf und ueberschrieb sie
// klaglos mit "Keine laufenden Wartungsauftraege" - waehrend der Reiter
// weiterhin "Offene Schaeden" anzeigte und die Werkzeugleiste "Schaden
// melden" stehen liess. Ein in sich widersprüchlicher Bildschirm, den
// dieselbe Pruefung wie bei zeigeListe() verhindert.
// angebot: { titel, ausfuehren: async () => {} } | null
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
        // Bewusst 'knopf-haupt' (marine) statt 'knopf-schaffend' (gruen),
        // anders als bei zeigeWerkzeugleiste() weiter oben: DIESES Angebot
        // ist nicht immer eine Neuanlage. instandhaltung.js bietet ueber
        // denselben Parameter sowohl "Schaden melden" (legt tatsaechlich
        // etwas an) als auch "Zu den offenen Schäden" (wechselt nur den
        // Unterreiter, legt nichts an) an - ein hier fest verdrahtetes
        // Gruen waere im zweiten Fall falsch. Ein eigenes 'art'-Feld im
        // angebot-Objekt haette das sauber getrennt, war fuer eine leere
        // Liste als Randfall aber mehr Aufwand, als der heutige Bestand
        // (zwei von vier Aufrufern nutzen ueberhaupt ein angebot) rechtfertigt.
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

    // Ohne Zeilen gibt es nichts auszuwaehlen - eine noch offene Maske
    // bezoege sich sonst auf eine Zeile, die gerade verschwunden ist.
    document.getElementById('detailmaske').replaceChildren();
    hauptknopfElement = null;
}

// Zwei Listen in einem Bereich, wenn sie fachlich zusammengehoeren.
//
// kennung: dieselbe Absicherung wie bei zeigeListe()/zeigeLeermaske()
// (WICHTIG 3, aus derselben Pruefung wie KRITISCH 2). Heute laeuft jeder
// Aufruf zufaellig SYNCHRON direkt nach neuerVorgang() (siehe
// instandhaltungAufbauen()/auswertungenAufbauen()), also ist der Fehler
// beim jetzigen Baustand nicht auslösbar - aber die Schnittstelle bot
// bislang gar keine Kennung an. Ein kuenftiger Bereich, der die Reiter
// erst NACH einem await aufbaut (etwa nach einem eigenen Nachladen),
// erbte den Fehler aus KRITISCH 2 ohne dass ihn hier etwas hinderte. Die
// Pruefung kostet den heutigen synchronen Fall nichts (kennung ist dann
// immer aktuell) und schuetzt den naechsten Aufrufer trotzdem.
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
// Rollenspeicher ist zu diesem Zeitpunkt gefuellt - seiteAufbauen() hat
// ihn geladen, bevor irgendein Bereich baut.
//
// instanceof Set statt einer Pruefung auf null: geladeneRollen kann jetzt
// auch false sein (kein Mitarbeiter). false.has(...) wuerfe eine
// TypeError - deny-by-default heisst hier, jeden Nicht-Set-Fall
// gleichermassen als "keine Rolle" zu behandeln, nicht nur den
// Anfangszustand vor dem ersten Laden.
function darfRolle(code) {
    return geladeneRollen instanceof Set && geladeneRollen.has(code);
}

// ===== Profilmenue =====
//
// Bedienung des Rundknopfs oben rechts (Punkt 3). Absichtlich getrennt
// von profilAufbauen() oben, das nur den INHALT fuellt: profilAufbauen()
// laeuft bei jedem seiteAufbauen()-Durchlauf erneut, ein hier
// angehaengter Klick-Handler wuerde sich also mit der Zeit vervielfachen,
// wenn er dort staende. Hier, am Skriptende, laeuft er dagegen GENAU
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
// auf einen Klick - ein eigener keydown-Handler fuer das OEFFNEN waere
// eine zweite, ueberfluessige Umsetzung derselben Tastaturbedienung.
// Nur das SCHLIESSEN per Escape braucht eine eigene Behandlung, weiter
// unten im globalen keydown-Listener.
knopfProfil.addEventListener('click', () => {
    if (profilmenueOffen()) profilmenueSchliessen();
    else profilmenueOeffnen();
});

// Klick ausserhalb schliesst das Menue. Auf 'click' verdrahtet, nicht
// 'pointerdown': der oeffnende Klick auf knopfProfil selbst durchlaeuft
// wegen der Ereignisblase erst den eigenen Handler oben (Menue geht auf)
// und danach, im selben Klick, diesen document-Handler - der aber
// erkennt ueber knopfProfil.contains(e.target), dass der Klick INNERHALB
// des Profilbereichs lag, und laesst das gerade geoeffnete Menue in Ruhe.
document.addEventListener('click', (e) => {
    if (!profilmenueOffen()) return;
    if (knopfProfil.contains(e.target) || profilmenue.contains(e.target)) return;
    profilmenueSchliessen();
});

document.getElementById('knopf-einstellungen').addEventListener('click', () => {
    profilmenueSchliessen();
    // Ehrlich statt stumm: es gibt noch keine Einstellungsseite. Der
    // Menuepunkt zu verstecken oder zu deaktivieren haette dieselbe
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
    // selbst - siehe bestaetige(). Wuerde dieser Listener hier zusaetzlich
    // reagieren, verwuerfe Escape gleichzeitig die Maske IM Hintergrund,
    // waehrend der Dialog sich schliesst: zwei Wirkungen fuer einen
    // Tastendruck.
    if (document.querySelector('dialog[open]')) return;

    if (e.key === 'Escape') {
        // Das Profilmenue zuerst pruefen: ist es offen, gehoert Escape
        // IHM - sonst verwuerfe derselbe Tastendruck zusaetzlich eine im
        // Hintergrund vielleicht offene Detailmaske, zwei Wirkungen fuer
        // einen Tastendruck (dieselbe Falle wie beim <dialog> oben).
        if (profilmenueOffen()) {
            profilmenueSchliessen();
            knopfProfil.focus();   // Fokus sichtbar dorthin zurueck, wo er herkam
            return;
        }
        maskeVerwerfen();
        return;
    }
    if (e.key === 's' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();   // sonst oeffnet der Browser seinen eigenen Speichern-Dialog
        maskeSpeichern();
        return;
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        // Nicht feuern, waehrend jemand in einem Eingabefeld der Maske
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
        // Kein seiteAufbauen() hier: onAuthStateChange (SIGNED_IN) loest
        // ueber beiAnmeldungsWechsel weiter unten denselben Aufbau aus.
        // Ein zweiter Aufruf hier wuerde meineRollen() zweimal parallel
        // anstossen.
    } catch (fehler) {
        fehlerAnzeige.textContent = fehler.message;
    }
});

document.getElementById('knopf-abmelden').addEventListener('click', () => abmelden());
document.getElementById('knopf-abmelden-fremd').addEventListener('click', () => abmelden());
// Der einzige Ausweg aus "Mitarbeiter ohne Rolle": ohne diesen Knopf
// saesse dort jemand fest, bis die Leitung eine Rolle zutraegt.
document.getElementById('knopf-abmelden-ohne-rolle').addEventListener('click', () => abmelden());

// beiAnmeldungsWechsel() ruft NICHT sofort mit dem aktuellen Zustand auf
// (anders als das Vorbild src/auth.js) - deshalb wird seiteAufbauen()
// unten zusaetzlich einmal von Hand angestossen, fuer den allerersten
// Seitenaufruf.
beiAnmeldungsWechsel(seiteAufbauen);
seiteAufbauen();
