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
    // bereich: { schluessel, titel, rollen: [...], icon, aufbauen: async (ziel) => {},
    //            suchePlatzhalter? }
    // suchePlatzhalter (optional, Gestaltungsauftrag Punkt 5): der
    // Platzhalter-/aria-label-Text fuer das gemeinsame Suchfeld in der
    // Kopfleiste, GENAU dann gesetzt, wenn dieser Bereich das Feld
    // tatsaechlich auswertet (heute nur kunden.js). bereichWechseln()
    // weiter unten aktiviert/beschriftet das Feld damit, oder deaktiviert
    // es sichtbar, statt es fuer jeden Bereich gleichermassen (und fuer
    // die meisten wirkungslos) anzubieten - siehe dortiger Kommentar.
    // icon: rohes '<svg viewBox="0 0 24 24">...</svg>'-Markup, EIN MAL je
    // Bereich als Konstante geschrieben - derselbe Aufbau wie aktion.svg
    // in zeigeListe()/zeilenAktionenZelle() weiter unten (kein Icon-Font,
    // keine externe Abhaengigkeit). navigationAufbauen() setzt aria-hidden
    // zentral auf den Wrapper, nicht das Icon selbst schreiben lassen -
    // damit bleibt die Stummschaltung (Gestaltungsauftrag Punkt 3: neben
    // dem ohnehin sichtbaren Text darf ein Screenreader es nicht ein
    // zweites Mal vorlesen) an EINER Stelle garantiert, statt sich auf
    // fuenf gleichlautende Attribute in fuenf Bereichsdateien zu
    // verlassen.
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
        knopf.dataset.bereich = bereich.schluessel;
        knopf.addEventListener('click', () => bereichWechseln(bereich.schluessel));

        // Icon links, Beschriftung rechts - zwei eigene Knoten statt
        // eines gemeinsamen textContent, weil bereich.icon rohes
        // SVG-Markup ist (siehe Kommentar bei bereichAnmelden()) und ein
        // <button>.textContent das sonst als Text statt als Grafik
        // ausgegeben haette. aria-hidden auf dem WRAPPER, nicht auf dem
        // Icon selbst: das Icon ist hier reine Wiedererkennung neben dem
        // ohnehin sichtbaren Text - ein Screenreader soll "Flotte" genau
        // einmal vorlesen, nicht "Bild, Flotte" (Gestaltungsauftrag,
        // Punkt 3).
        const iconWrapper = document.createElement('span');
        iconWrapper.className = 'bereich-icon';
        iconWrapper.setAttribute('aria-hidden', 'true');
        // bereich.icon ist wie aktion.svg in zeilenAktionenZelle() eine
        // im jeweiligen Bereich fest verdrahtete Konstante, keine
        // Nutzereingabe - innerHTML ist hier aus demselben Grund
        // unbedenklich wie dort.
        iconWrapper.innerHTML = bereich.icon;
        knopf.append(iconWrapper);

        const beschriftung = document.createElement('span');
        beschriftung.textContent = bereich.titel;
        knopf.append(beschriftung);

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

// herkunftstext (optional, Gestaltungsauftrag Punkt 3): "sagen, woher man
// kommt" - von bereichSprung() weiter unten gesetzt, sonst nirgends
// (Navigationsklick, erster Bereich beim Anmelden). OHNE eigenes Zutun
// haette ein Sprung hier keine Wirkung gehabt: das melde('') am Ende
// dieser Funktion (siehe dort) loescht die Statuszeile bei JEDEM
// Bereichswechsel bedingungslos, GENAU DAMIT ein alter Stand aus dem
// VORHERIGEN Bereich nicht als scheinbar aktuelle Meldung im neuen
// stehen bleibt - ein einfaches melde(herkunftstext, 'gut') VOR
// bereichWechseln() (wie bei jeder Buchung ueblich, siehe neuerVorgang())
// würde von genau diesem Loeschen sofort wieder ueberschrieben. Der
// Parameter tritt deshalb an die Stelle des sonst leeren melde('')-Rufs.
async function bereichWechseln(schluessel, herkunftstext = null) {
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

    // Punkt 5 der Gestaltung: "es sagt nicht, wonach es sucht, oder ob
    // es gerade etwas einschraenkt" - das Suchfeld liegt in der
    // gemeinsamen Kopfleiste (index.html) und damit ausserhalb jedes
    // einzelnen Bereichs, heute nutzt es aber nur Kundschaft
    // (kunden.js). suchePlatzhalter ist deshalb ein OPTIONALES Feld am
    // bereich-Objekt (siehe bereichAnmelden() oben): vorhanden, wird das
    // Feld aktiviert und benannt; fehlt es, wird das Feld sichtbar
    // deaktiviert statt weiter scheinbar bedienbar, aber folgenlos
    // dazustehen - dieselbe "was man nicht darf/nicht kann, wird nicht
    // angeboten"-Haltung wie bei der Navigation weiter oben. Der Wert
    // wird zusaetzlich geleert: ein Suchtext aus dem VORHERIGEN Bereich
    // durfte den neuen sonst ungefragt mitnehmen, obwohl er dort nie
    // eingegeben wurde.
    const feldSucheGlobal = document.getElementById('feld-suche');
    feldSucheGlobal.value = '';
    feldSucheGlobal.classList.remove('feld-suche-aktiv');
    if (aktiverBereich.suchePlatzhalter) {
        feldSucheGlobal.disabled = false;
        feldSucheGlobal.placeholder = aktiverBereich.suchePlatzhalter;
        feldSucheGlobal.setAttribute('aria-label', aktiverBereich.suchePlatzhalter);
    } else {
        feldSucheGlobal.disabled = true;
        feldSucheGlobal.placeholder = 'In diesem Bereich keine Suche';
        feldSucheGlobal.setAttribute('aria-label', 'Suche in diesem Bereich nicht verfügbar');
    }

    // herkunftstext gesetzt -> als frische Bestaetigung ('gut') stehen
    // lassen, GENAU wie eine Buchung: der direkt folgende Aufruf von
    // aktiverBereich.aufbauen() (der als erste Anweisung neuerVorgang()
    // ausfuehrt, siehe dort) liest letzteMeldeArt OHNE dazwischenliegendes
    // await und unterdrueckt damit die eigene neutrale Uebersichtsmeldung
    // genau einmal - der Sprunggrund bleibt sichtbar, statt sofort von
    // "12 Schadensmeldungen" ueberschrieben zu werden. Ohne herkunftstext
    // (der ueberwiegende Regelfall: Navigationsklick) unveraendert leer,
    // wie zuvor.
    melde(herkunftstext || '', herkunftstext ? 'gut' : 'neutral');
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

    for (const kachel of kacheln) leiste.append(baueKachel(kachel));
}

// Das Kachel-Markup selbst, herausgezogen aus zeigeUebersicht() (siehe
// dort): der Drill-Down (monatsdrilldownEinfuegen() in auswertungen.js)
// braucht dieselben vier Kacheln - Min, Max, Anzahl pro Monat, Tag mit
// den meisten Fahrten - aber NICHT im #uebersichtsstreifen am Kopf von
// #arbeitsliste, sondern in der Detailmaske. Zwei Aufrufer, die beide
// dieselbe Handvoll DOM-Zeilen von Hand nachbauen, wären derselbe
// Befund wie bei werkzeugleiste()/uebersichtsstreifen() selbst: ein
// wiederkehrendes Muster gehört EINMAL hierher, nicht mehrfach in einen
// Bereich - hier zusätzlich nicht mehrfach in DIESE Datei.
function baueKachel(kachel) {
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

    return feld;
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
// In einer TABELLENSPALTE dagegen (mehrere Zeilen untereinander) NICHT
// direkt mit textInhalt aufrufen - siehe balkenSpalten() weiter unten,
// das genau diesen Fall (Balken und Betrag als gemeinsame, rechtsbündige
// Gruppe in EINER Zelle) durch zwei getrennte Spalten ersetzt hat, weil
// unterschiedlich breite Beträge sonst die Nulllinie des Balkens von
// Zeile zu Zeile verschieben (Gestaltungsauftrag, Punkt 5).
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

    // 0.5px eingerueckt statt bei 0/0..breite/hoehe: die Kontur, die
    // .zellbalken-hintergrund jetzt traegt (siehe style.css - vorher gab
    // es hier gar keine, siehe Kommentar dort), liegt sonst zur Haelfte
    // ausserhalb des viewBox und wird vom Standard-overflow:hidden des
    // <svg> auf der Aussenseite gekappt - eingerueckt bleibt die 1px-
    // Linie ringsum vollstaendig sichtbar, nicht nur zur Haelfte.
    const hintergrund = document.createElementNS(SVG_NS, 'rect');
    hintergrund.setAttribute('x', 0.5);
    hintergrund.setAttribute('y', 0.5);
    hintergrund.setAttribute('width', Math.max(0, breite - 1));
    hintergrund.setAttribute('height', Math.max(0, hoehe - 1));
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

// ===== Zeichenbaustein: Säulengrafik (Drill-Down-Aufgabe) =====
//
// Drittes Geschwister von sparkline()/zellbalken() oben, allgemein und
// nicht auswertungsspezifisch gehalten wie beide - der Aufrufer liefert
// Werte, Achsenbeschriftungen und einen zugänglichen Namen, diese
// Funktion weiß nichts von "Fahrten" oder "Monaten".
//
// Der fachliche Unterschied zu den beiden Geschwistern, und der Grund,
// warum diese Funktion NICHT einfach zellbalken() im Kreis aufruft:
// dort KODIERT die Länge einen ANTEIL an einer fest vorgegebenen
// Gesamtbreite (ein Füllstand zwischen 0 und 100 %, ein Umsatz zwischen
// 0 und dem Zeilenmaximum) - die Nulllinie ist dort automatisch die
// linke Kante der Zelle. Eine Säule dagegen steht FREI im Raum; ohne
// eine EIGENS gezeichnete Nulllinie könnte ihre Höhe genauso gut ab
// einem beliebigen Sockel beginnen, und zwei Säulen im Verhältnis 2:1
// sähen dann nicht mehr im Verhältnis 2:1 aus. Deshalb ist die Skala
// hier IMMER bei 0 verankert (maximum kommt ausschließlich aus den
// Werten selbst, nie aus einem vom Aufrufer übergebenen Minimum) - eine
// abgeschnittene y-Achse ist in diesem Projekt für Positionsgrafiken
// (Sparkline) zulässig, für längenkodierende Grafiken wie diese
// ausdrücklich nicht (fachliche Regel des Gestaltungsauftrags).
//
// werte: Zahlen in Anzeigereihenfolge, EINE je Kategorie (Tag im
// Monat). Ein fehlender Betriebstag ist null FAHRTEN (eine Säule der
// Höhe 0, sichtbar auf der Grundlinie), keine ausgelassene Kategorie -
// der Aufrufer muss die Lücke deshalb selbst mit 0 auffüllen, BEVOR er
// diese Funktion ruft (siehe monatsdrilldownEinfuegen() in
// auswertungen.js): ein einfach ausgelassener Index sähe hier genauso
// aus wie eine fehlende Säule und wäre von einem Ladefehler nicht zu
// unterscheiden.
// beschriftungenX: Array gleicher Länge, für die Tooltip-Titel je Säule
// und die drei Eckpunkte der x-Achsenbeschriftung (erster/mittlerer/
// letzter Tag) - keine volle Beschriftung jeder einzelnen Säule, dafür
// ist eine Spalte mit 28 bis 31 Werten zu schmal.
// optionen.beschriftung: der zugängliche Name der GESAMTEN Grafik
// (role="img"), eine fertig formulierte Zusammenfassung (Minimum,
// Maximum, Spitzentag) - dieselbe Pflicht wie bei sparkline() oben
// ("eine Grafik, die Information trägt, darf für einen Screenreader
// nicht stumm sein"). Die Tages-für-Tages-Zahlen selbst gehören NICHT
// in dieses eine Label (31 Zahlen in einem Satz wären für einen
// Screenreader ebenso unbrauchbar wie für ein Auge) - dafür baut der
// Aufrufer zusätzlich eine normale <table>, siehe dort.
// optionen.markierIndizes: hervorgehobene Säulen in --rot, als ARRAY
// statt eines einzelnen Index wie bei sparkline()s markierIndex - zwei
// Tage können denselben Höchstwert tragen (Auftrag, ausdrücklich als
// Fallstrick benannt), dann sind es zwei Spitzentage, nicht einer.
function saeulengrafik(werte, beschriftungenX, optionen = {}) {
    const { breite = 420, hoehe = 120, beschriftung = null, markierIndizes = [] } = optionen;

    const block = document.createElement('div');
    block.className = 'saeulengrafik-block';

    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${breite} ${hoehe}`);
    svg.classList.add('saeulengrafik');

    if (beschriftung) {
        svg.setAttribute('role', 'img');
        svg.setAttribute('aria-label', beschriftung);
    } else {
        svg.setAttribute('aria-hidden', 'true');
        svg.setAttribute('focusable', 'false');
    }

    const werteBereinigt = (werte || []).map((w) => w || 0);
    // Nulllinie ist PFLICHT (siehe Kopfkommentar): die Skala beginnt
    // IMMER bei 0, deshalb kommt "maximum" ausschliesslich aus den
    // Werten selbst - Math.max(1, ...) nur, damit ein Monat mit
    // durchgehend 0 Fahrten nicht durch 0 teilt, nicht als versteckte
    // Untergrenze der Achse.
    const maximum = Math.max(1, ...werteBereinigt);

    if (werteBereinigt.length > 0) {
        const anzahl = werteBereinigt.length;
        const abstand = breite / anzahl;
        const saeulenbreite = Math.max(0.5, abstand - 1);

        // Grundlinie: rein dekorativ (jede Saeule steht ohnehin auf ihr
        // auf), macht aber sichtbar, dass eine Saeule der Hoehe 0 BEWUSST
        // keine Hoehe hat, statt wie eine fehlende Kategorie auszusehen.
        const grundlinie = document.createElementNS(SVG_NS, 'line');
        grundlinie.setAttribute('x1', 0);
        grundlinie.setAttribute('x2', breite);
        grundlinie.setAttribute('y1', hoehe - 0.5);
        grundlinie.setAttribute('y2', hoehe - 0.5);
        grundlinie.setAttribute('class', 'saeulengrafik-grundlinie');
        svg.append(grundlinie);

        werteBereinigt.forEach((wert, i) => {
            // 2px Luft oben, damit der hoechste Wert nicht exakt auf der
            // Kontur des <svg> liegt (dieselbe Ueberlegung wie der 1px-
            // Rand bei sparkline() oben).
            const saeulenhoehe = (wert / maximum) * (hoehe - 2);
            const rect = document.createElementNS(SVG_NS, 'rect');
            rect.setAttribute('x', (i * abstand).toFixed(2));
            rect.setAttribute('y', (hoehe - saeulenhoehe).toFixed(2));
            rect.setAttribute('width', saeulenbreite.toFixed(2));
            rect.setAttribute('height', Math.max(0, saeulenhoehe).toFixed(2));
            rect.setAttribute('class', markierIndizes.includes(i)
                ? 'saeulengrafik-saeule saeulengrafik-saeule-markiert'
                : 'saeulengrafik-saeule');
            if (beschriftungenX && beschriftungenX[i] !== undefined) {
                // <title> auf dem einzelnen <rect>: ein Tooltip beim
                // Hovern EINER Saeule, ohne die Grafik als Ganzes stumm
                // zu machen (svg traegt aria-label bereits fuer sich).
                const titel = document.createElementNS(SVG_NS, 'title');
                titel.textContent = `${beschriftungenX[i]}: ${wert}`;
                rect.append(titel);
            }
            svg.append(rect);
        });
    }

    // y-Achse: nur 0 und das Maximum, keine Zwischenwerte - die
    // begleitende Tabelle (Aufrufer) traegt jede einzelne Zahl bereits
    // exakt, diese beiden Eckwerte dienen nur der groben Einordnung
    // "wie hoch ist hoch". aria-hidden: rein visuelle Orientierung,
    // redundant zu optionen.beschriftung und zur Tabelle.
    const yAchse = document.createElement('div');
    yAchse.className = 'saeulengrafik-y-achse';
    yAchse.setAttribute('aria-hidden', 'true');
    const yOben = document.createElement('span');
    yOben.textContent = maximum.toLocaleString('de-DE');
    const yUnten = document.createElement('span');
    yUnten.textContent = '0';
    yAchse.append(yOben, yUnten);

    block.append(yAchse, svg);

    if (beschriftungenX && beschriftungenX.length > 0) {
        const xAchse = document.createElement('div');
        xAchse.className = 'saeulengrafik-x-achse';
        xAchse.setAttribute('aria-hidden', 'true');
        const indexMitte = Math.floor((beschriftungenX.length - 1) / 2);
        [0, indexMitte, beschriftungenX.length - 1].forEach((i, position) => {
            // Bei sehr wenigen Kategorien (< 3) faellt "Mitte" mit
            // "erster" oder "letzter" zusammen - dann nicht doppelt
            // anzeigen.
            if (position === 1 && (i === 0 || i === beschriftungenX.length - 1)) return;
            const span = document.createElement('span');
            span.textContent = beschriftungenX[i];
            xAchse.append(span);
        });
        block.append(xAchse);
    }

    return block;
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

// ===== Balkenspalte (Gestaltungsauftrag, Punkt 5) =====
//
// "Zudem ist die Ausrichtung der Balken nicht korrekt, da gibt es keine
// vertikale Flucht" - woertlich der Auftrag. Der Grund: zellbalken() legte
// Balken UND Betrag bislang in EINE Zelle, als rechtsbuendige GRUPPE
// (.zellbalken, justify-content: flex-end). Weil der Betrag mal 7,70 €
// und mal 2.011,20 € breit ist, verschob das die ganze Gruppe von Zeile
// zu Zeile unterschiedlich weit nach links - der Balken selbst teilte
// zwar mit jeder anderen Zeile dieselbe SKALA (maximum), aber nicht
// dieselbe NULLLINIE. Als Vergleichsmittel (Bissantz: "Zahlen sehen statt
// lesen") ist ein Balken ohne gemeinsame Nulllinie wertlos - genau der
// Befund, den diese Funktion behebt.
//
// Die Loesung ist keine neue Zeichentechnik, sondern eine ANDERE
// Tabellenstruktur: der Balken bekommt eine EIGENE Spalte fester Breite
// (.balken-spalte in style.css, 76px, unabhaengig vom Zelleninhalt),
// die Zahl eine ZWEITE, gewohnt rechtsbuendige Spalte daneben. Jede Zeile
// beginnt ihren Balken dadurch an DERSELBEN Bildschirmposition, egal wie
// breit der Betrag der jeweiligen Zeile ist.
//
// Liefert ZWEI Spaltendefinitionen zum Einfuegen in ein spalten-Array
// (Spread-Syntax, siehe Aufrufer in auswertungen.js) statt einer - der
// Baustein steht HIER, weil vier Berichte in auswertungen.js unabhaengig
// densselben Fehler geerbt haetten, waere er dort viermal von Hand
// nachgebaut worden (derselbe Befund wie bei werkzeugleiste()/
// uebersichtsstreifen() weiter oben: ein wiederkehrendes Muster gehoert
// EINMAL nach rahmen.js, nicht mehrfach in einen Bereich).
//
// feld/titel: wie bei jeder Spalte - titel gilt fuer die ZAHLENSPALTE,
// die Balkenspalte bleibt visuell ohne Ueberschrift (siehe ariaLabel
// unten) statt denselben Titel ein zweites Mal zu zeigen.
// maximum: die gemeinsame Skala ueber ALLE sichtbaren Zeilen (Bissantz) -
// vom Aufrufer einmal ermittelt, wie bisher direkt an zellbalken()
// uebergeben.
// formatText(wert): formatiert NUR den Zahlwert zu einem fertigen String
// (z. B. geldFormat) - zahlSkaliert() wird hier zentral angewendet, ein
// Aufrufer muss es nicht mehr selbst tun.
// optionen.klasse: String ODER (zeile) => String fuer die Zahlenspalte,
// Vorgabe 'zahl' (siehe zahlKlasse() in auswertungen.js).
// optionen.farbe: String ODER (wert, zeile) => String, an zellbalken()
// weitergereicht - als Funktion, weil eine Balkenfarbe von der Zeile
// abhaengen kann (Stationsauslastung: bernstein sobald der Fuellstand
// voll ist).
// optionen.ariaLabel: der zugaengliche Name der titel-losen
// Balkenspalte, Vorgabe "<titel> (Balken)" - dieselbe Ueberlegung wie
// bei der Aktionen-Spalte in zeigeListe() weiter unten: keine sichtbare
// zweite Ueberschrift, aber eine <th> ohne jeden Namen liesse die Spalte
// fuer einen Screenreader namenlos wirken.
// optionen.summierbar: an die ZAHLENSPALTE (nicht an die namenlose
// Balkenspalte, dort waere eine Zwischensumme ohnehin unsichtbar)
// durchgereicht - siehe der lange Kommentar bei zeigeListe() oben, warum
// das der Bereich entscheiden muss und der Baustein es nicht selbst
// erraet ("umsatz" ist additiv, "umsatz_je_fahrt" waere es nicht).
function balkenSpalten(feld, titel, maximum, formatText, optionen = {}) {
    const { klasse = 'zahl', farbe = null, ariaLabel = `${titel} (Balken)`, summierbar = false } = optionen;
    return [
        {
            feld,
            titel: '',
            ariaLabel,
            klasse: 'balken-spalte',
            formatieren: (wert, zeile) => zellbalken(
                wert, maximum, null,
                farbe ? { farbe: typeof farbe === 'function' ? farbe(wert, zeile) : farbe } : {}
            )
        },
        {
            feld,
            titel,
            klasse,
            summierbar,
            formatieren: (wert) => zahlSkaliert(formatText(wert))
        }
    ];
}

// ===== Spaltenkopf: Sortieren, Filtern, Gruppieren =====
//
// "Man sollte immer bei den Spaltenkoepfen sortieren, filtern und
// gruppieren koennen - bei allen Tabellen", woertlich der Auftrag. "Bei
// allen Tabellen" heisst: ein Baustein HIER, kein Anbau in fuenf
// Dateien - genau wie Werkzeugleiste/Filterleiste/Uebersichtsstreifen
// weiter oben schon denselben Fund hatten (zwei Bereiche erfanden
// dieselbe Werkzeugleiste unabhaengig voneinander, siehe dortiger
// Kommentar). zeigeListe() bleibt deshalb nach aussen UNVERAENDERT
// (dieselben fuenf Parameter, derselbe erste Parameter "kennung" -
// tools/wawi_check.py prueft das ueber alle Aufrufer hinweg) - die drei
// Faehigkeiten haengen ausschliesslich an zusaetzlichen, OPTIONALEN
// Eigenschaften der einzelnen Spaltenobjekte, derselben Machart wie die
// bereits bestehenden "klasse"/"formatieren"/"ariaLabel":
//
//   sortierbar   (Vorgabe: true, sobald die Spalte einen titel traegt)
//   filterbar    (Vorgabe: true, sobald die Spalte einen titel traegt)
//   gruppierbar  (Vorgabe: true, sobald die Spalte einen titel traegt)
//   summierbar   (Vorgabe: false - MUSS vom Bereich ausdruecklich gesetzt
//                werden, siehe Begruendung weiter unten)
//   sortierwert(zeile)   liefert den VERGLEICHBAREN Wert fuer Sortierung
//                UND Gruppierung, wenn er vom rohen Feldwert abweicht
//                (siehe "Nach Wert, nicht nach Anzeige" unten)
//   filterTyp    'auswahl' | 'schwelle' | 'text' - erzwingt die Art des
//                Filterfelds, statt sie aus den geladenen Werten zu
//                erraten (siehe spaltenFilterTyp() weiter unten)
//   summeFormatieren(summe)   formatiert eine Gruppen-Zwischensumme,
//                wenn formatieren() dafuer nicht taugt (co2_ersparnis_kg
//                in auswertungen.js braucht z. B. die ganze Zeile fuer
//                den Schaetzanteil - eine Zwischensumme hat keine Zeile)
//
// NACH WERT, NICHT NACH ANZEIGE (Auftrag, woertlich): sortiert wird
// IMMER ueber spaltenWert() weiter unten - den rohen zeile[feld]-Wert
// oder, wenn angegeben, sortierwert(zeile). Fuer die meisten Spalten ist
// das bereits derselbe Wert, den formatieren() nur ANDERS SCHREIBT
// (2011.2 vs. "2.011,20 €", das ISO-Datum "2026-03-01" vs. "Mär 2026") -
// eine Zahl bleibt eine Zahl, ein ISO-Datum sortiert als Text schon
// richtig chronologisch. Wo der rohe Wert selbst KEINE Rangfolge traegt
// (schwere: 'gering'/'mittel'/'fahruntauglich' alphabetisch waere
// 'fahruntauglich' vor 'gering' - genau der Fehler, der in diesem
// Projekt schon einmal ein fahruntaugliches Rad als "gering" zeigte -
// oder offen_seit: ein Postgres-Intervalltext, an dem "10 Tage" vor "2
// Tage" laege), liefert instandhaltung.js ein eigenes sortierwert(zeile)
// mit an dieser Stelle bereits vorhandenen Hilfsfunktionen (siehe dort).
//
// ALTE UND NEUE FILTER (Auftrag: "die duerfen sich nicht widersprechen"):
// Flotte (Status/Radtyp/Station), Kundschaft (Status) und Instandhaltung
// (Schwere/Mindestalter) haben schon eine eigene zeigeFilterleiste() ueber
// GENAU denselben Spalten, die jetzt auch hier filterbar waeren - bei
// Kundschaft zusaetzlich SERVERSEITIG (die 200-von-1014-Grenze, siehe
// Kommentar bei kundenAufbauen() in kunden.js). Zwei unabhaengige Filter
// auf demselben Feld koennten sich gegenseitig aufheben (Filterleiste
// "gesperrt", Spaltenkopf "aktiv" -> immer null Zeilen) - "schlimmer als
// einer" (Auftrag). Die betroffenen Spalten setzen deshalb bewusst
// filterbar:false (flotte.js: status/typ_code/standort; kunden.js:
// status; instandhaltung.js: schwere/offen_seit) - EIN Feld, EIN
// Bedienelement. Ueberall sonst ist der neue Spaltenkopf-Filter rein
// ADDITIV: er schraenkt nur weiter ein, was der Bereich (Filterleiste,
// Suche, die 200er-Grenze) bereits geladen und gezeigt hat - dieselbe
// Beziehung wie ein Excel-Autofilter ueber einem bereits eingegrenzten
// Datenausschnitt, nie ein zweiter, widerspruechlicher Blick auf
// dieselbe Grundgesamtheit. Bei Kundschaft bleibt das ehrlich, WEIL die
// 200er-Grenze schon in der Statuszeile steht (kundenAufbauen()) -
// dieser Baustein taeuscht nichts Neues vor, er filtert nur das, was
// ohnehin schon als "200 von mehr" ausgewiesen ist.
//
// SUMMIERBAR NUR MIT AUSDRUECKLICHEM OPT-IN (Auftrag: "sag im Baustein,
// welche Spalten summierbar sind, und rechne nur die"): eine
// Durchschnittsspalte summiert ist Unsinn (umsatz_je_fahrt,
// umsatz_je_kunde - "man summiert Durchschnitte nicht, man gewichtet
// sie", derselbe Fehler wie beim ungewichteten Schaetzanteil bei CO2:
// 53,2 % statt 40,0 %, siehe anteilGewichtet() in auswertungen.js), eine
// Zaehl-Spalte ueber MEHRERE MONATE summiert kann DOPPELT zaehlen
// (v_wawi_umsatz_kundengruppe.kunden zaehlt Kunden JE MONAT - ueber
// mehrere Monate summiert waere ein Kunde, der zwoelf Monate lang faehrt,
// zwoelfmal gezaehlt). Nur der jeweilige BEREICH kennt diese fachliche
// Bedeutung einer Spalte; der Baustein hier kennt sie nicht und rechnet
// deshalb NIE von sich aus - er summiert ausschliesslich Spalten, die ihr
// summierbar:true ausdruecklich mitgeben (siehe summierbar-Eintraege in
// auswertungen.js/flotte.js). Wo keine Spalte summierbar ist, zeigt eine
// Gruppe nur ihre Zeilenzahl - "nichts hinschreiben ist besser als etwas
// Falsches" (Auftrag).
//
// FOKUS UND TASTATUR: jeder Klick auf einen Spaltenkopf (Sortieren,
// Gruppieren, Filtern) zeichnet die GANZE Tabelle neu (dieselbe volle
// Neuerstellung wie zeigeListe() sie schon immer macht) - ohne
// Gegenmassnahme spraenge der Tastaturfokus dabei auf <body> zurueck,
// weil das gerade fokussierte Element mit dem alten DOM verschwindet.
// fokusMerken()/fokusWiederherstellen() unten haltem ihn am GLEICHEN
// Bedienelement (ueber data-spaltenkopf-feld/-rolle identifiziert) fest -
// bei einem Texteingabefeld sogar mitsamt Cursorposition, sonst spraenge
// der Cursor bei jedem Tastendruck ans Ende zurueck (siehe die
// 300ms-Verzoegerung bei Text-/Schwellenfiltern weiter unten, demselben
// Muster wie die Kundensuche in kunden.js und der Alters-Schieber in
// instandhaltung.js).
//
// KEIN NEUER *AUFBAUEN()-VORGANG: anders als jede Buchung oder jeder
// Filterleiste-Wechsel ruft ein Klick hier NICHT neuerVorgang() auf und
// laedt nichts nach - die Zeilen sind schon da, ein Klick aendert nur
// die DARSTELLUNG derselben, bereits geladenen zeilen. kennung bleibt
// deshalb ueber beliebig viele Spaltenkopf-Klicks hinweg dieselbe, und
// istAktuellerVorgang(kennung) bleibt so lange wahr, wie kein ECHTER
// Neuaufbau (Bereichswechsel, Reiterwechsel, Buchung) dazwischenkommt.
//
// KEIN zeigeLeermaske() BEI "KEIN TREFFER FUER DIESEN SPALTENFILTER":
// anders als die Erprobung nahelegt ("dafuer gibt es zeigeLeermaske")
// wuerde zeigeLeermaske() den KOMPLETTEN Inhalt von #listenkoerper
// wegwerfen - einschliesslich der Kopf- und Filterzeile selbst, in der
// die Spaltenkopf-Filter stecken. Genau das widerspraeche dem Vorbild
// dieses Bausteins: flotte.js betont ausdruecklich, dass bei "kein
// Treffer" "der Filter sichtbar UND BEDIENBAR bleibt" (siehe
// flotteAufbauen()), weil die alte Filterleiste ein EIGENES Element
// ausserhalb von #listenkoerper ist. Die neuen Spaltenkopf-Filter
// dagegen stecken IM <thead> derselben Tabelle - sie mit
// zeigeLeermaske() zu entfernen hiesse, dass niemand den zu engen Filter
// mehr FEINJUSTIEREN koennte, nur noch komplett zuruecksetzen. Eine
// eigene, schlanke Leerzeile INNERHALB der bestehenden Tabelle (siehe
// baueLeerzeile() weiter unten) haelt Kopf- und Filterzeile stattdessen
// unangetastet - dieselbe Garantie wie bei den Bereichs-eigenen
// Filtern, nur eine Ebene tiefer.
let spaltenkopfListe = null;               // { kennung, zeilen, spalten, beiAuswahl, aktionen }
let spaltenkopfSignatur = null;            // Fingerabdruck der Spaltenliste, siehe zeigeListe()
let spaltenkopfSortFeld = null;            // spalte.feld, das aktuell sortiert, oder null
let spaltenkopfSortRichtung = 0;           // 0 = Ausgangsordnung, 1 = aufsteigend, -1 = absteigend
let spaltenkopfGruppe = null;              // spalte.feld, nach dem gruppiert wird, oder null
let spaltenkopfFilterwerte = new Map();    // spalte.feld -> Filterwert

// Feather-Stil, dieselbe Familie wie RAD_ICONS/SCHADEN_ICONS/KUNDE_ICONS
// in den Bereichen (24x24, currentColor per CSS, siehe .bereich-icon in
// style.css) - EIN Chevron statt dreier verschiedener SVGs fuer
// aufsteigend/absteigend/neutral: Drehung (180°) und Deckkraft
// unterscheiden die drei Zustaende per CSS (siehe .spaltenkopf-sortsymbol*
// in style.css), kein Innerhtml-Austausch bei jedem Klick noetig.
const SPALTENKOPF_SORT_ICON = '<svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>';
// "Ebenen"-Symbol (drei versetzte Rauten) - "nach dieser Spalte
// gruppieren". aria-pressed traegt den Ein/Aus-Zustand, nicht ein
// zweites Icon.
const SPALTENKOPF_GRUPPE_ICON = '<svg viewBox="0 0 24 24"><path d="M12 4l9 5-9 5-9-5 9-5z"/>' +
    '<path d="M3 14l9 5 9-5"/></svg>';

// kennung: von neuerVorgang() geliefert, siehe Kommentar dort. Ein
// veralteter Vorgang zeichnet die Liste nicht mehr - sonst überschriebe
// ein spät zurückkommender Neuaufbau eines VORHERIGEN Bereichs oder
// eines überholten Buchungsvorgangs die Liste, die der Anwender gerade
// vor sich hat.
// spalten: [{ feld, titel, formatieren?, klasse?, ariaLabel?, sortierbar?,
//             filterbar?, gruppierbar?, summierbar?, sortierwert?,
//             filterTyp?, summeFormatieren? }] - formatieren(wert, zeile)
// darf einen String ODER ein einzelnes Element liefern (siehe Kommentar
// an der Stelle weiter unten, wo die Zelle gebaut wird); die uebrigen
// Eigenschaften sind Sortieren/Filtern/Gruppieren vorbehalten, siehe der
// lange Kommentar oben.
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
// keine zusätzliche Spalte, keine Zeile muss etwas davon wissen.
function zeigeListe(kennung, zeilen, spalten, beiAuswahl, aktionen = null) {
    if (!istAktuellerVorgang(kennung)) return;

    // Fingerabdruck der Spaltenliste: dieselbe Tabelle (Bereich,
    // Unterreiter) behaelt Sortierung/Filter/Gruppierung ueber einen
    // Neuaufbau hinweg (eine Buchung, ein erneutes Laden) - genau das
    // "Wiederfinden", das flotteFilterStatus in flotte.js fuer die alte
    // Filterleiste schon vormacht ("ein Bereichswechsel selbst setzt sie
    // NICHT zurueck"), hier einmal fuer alle Bereiche statt je Bereich
    // neu erfunden. Eine ANDERE Tabelle (andere Spalten - Bereichswechsel
    // oder Unterreiterwechsel) faengt dagegen sauber bei null an; ohne
    // diesen Vergleich ueberlebte etwa eine Sortierung nach "Nummer" aus
    // der Flotte einen Wechsel zu Stationen, obwohl "Nummer" dort etwas
    // ganz anderes waere.
    const signatur = spalten.map((s) => `${s.feld}|${s.titel || ''}`).join(',') + (aktionen ? '|+' : '');
    if (signatur !== spaltenkopfSignatur) {
        spaltenkopfSignatur = signatur;
        spaltenkopfSortFeld = null;
        spaltenkopfSortRichtung = 0;
        spaltenkopfGruppe = null;
        spaltenkopfFilterwerte = new Map();
    }

    spaltenkopfListe = { kennung, zeilen, spalten, beiAuswahl, aktionen };
    zeichneArbeitstabelle();
}

// Der eigentliche Zeichenvorgang - getrennt von zeigeListe(), weil jeder
// Klick auf einen Spaltenkopf ihn erneut ausloest, OHNE dass ein neuer
// *Aufbauen()-Vorgang lief (siehe Kopfkommentar oben). Liest
// ausschliesslich aus dem Modulzustand oben; zeigeListe() selbst ist nur
// noch die Stelle, an der dieser Zustand mit frischen Zeilen/Spalten
// befuellt wird.
function zeichneArbeitstabelle() {
    const { kennung, zeilen: zeilenOriginal, spalten, beiAuswahl, aktionen } = spaltenkopfListe;
    if (!istAktuellerVorgang(kennung)) return;

    const fokusMerkmal = fokusMerken();

    // ----- Filtern -----
    const gefiltert = zeilenOriginal.filter((zeile) => spalten.every((spalte) => {
        if (!istFilterbar(spalte)) return true;
        const filterwert = spaltenkopfFilterwerte.get(spalte.feld);
        if (filterwert === undefined) return true;
        const rohwert = zeile[spalte.feld];
        const typ = spaltenFilterTyp(spalte, zeilenOriginal);
        if (typ === 'schwelle') return typeof rohwert === 'number' && rohwert >= filterwert;
        if (typ === 'auswahl') return String(rohwert ?? '') === filterwert;
        // Erst HIER kleingeschrieben, nicht schon beim Speichern des
        // Filterworts (siehe spaltenkopfFilterfeld() weiter unten): der
        // gespeicherte Wert bleibt der Originaltext, den die Person
        // getippt hat - sonst zeigte das Eingabefeld nach dem naechsten
        // Neuzeichnen "chang" statt des getippten "Chang" (im Browser
        // nachgestellt und bestaetigt, siehe Bericht).
        return String(rohwert ?? '').toLocaleLowerCase('de').includes(filterwert.toLocaleLowerCase('de'));
    }));

    // ----- Sortieren -----
    // { zeile, index }: index ist die Ausgangsordnung (die Reihenfolge, in
    // der der Bereich die Zeilen geladen hat - bei den Auswertungen etwa
    // "erst Radtyp, dann Monat", selbst schon bedeutungstragend, siehe
    // Auftrag). Ein dritter Klick auf denselben Spaltenkopf setzt
    // spaltenkopfSortRichtung auf 0 zurueck - die Sortierung faellt dann
    // unten aus, und die Reihenfolge ist wieder GENAU diese
    // Ausgangsordnung, nicht irgendeine neu berechnete.
    let indiziert = gefiltert.map((zeile, index) => ({ zeile, index }));
    const sortSpalte = spaltenkopfSortFeld
        ? spalten.find((s) => s.feld === spaltenkopfSortFeld && istSortierbar(s)) : null;
    if (sortSpalte && spaltenkopfSortRichtung !== 0) {
        indiziert = [...indiziert].sort((a, b) => {
            const wa = spaltenWert(sortSpalte, a.zeile);
            const wb = spaltenWert(sortSpalte, b.zeile);
            const aLeer = wa === null || wa === undefined || wa === '';
            const bLeer = wb === null || wb === undefined || wb === '';
            // Leere Werte immer ans Ende, UNABHAENGIG von der Richtung -
            // sonst spraenge eine leere Zeile beim Umschalten von auf-
            // nach absteigend von ganz unten nach ganz oben, obwohl sich
            // an ihrer fehlenden Angabe nichts geaendert hat.
            if (aLeer && bLeer) return a.index - b.index;
            if (aLeer) return 1;
            if (bLeer) return -1;
            const vergleich = vergleicheWerte(wa, wb) * spaltenkopfSortRichtung;
            return vergleich !== 0 ? vergleich : a.index - b.index;   // stabil bei Gleichstand
        });
    }
    const angezeigt = indiziert.map((e) => e.zeile);

    // ----- Gruppieren -----
    const gruppenSpalte = spaltenkopfGruppe
        ? spalten.find((s) => s.feld === spaltenkopfGruppe && istGruppierbar(s)) : null;
    const gruppen = gruppenSpalte ? gruppiere(angezeigt, gruppenSpalte) : null;

    listenZeilen = angezeigt;
    listenAuswahl = beiAuswahl;
    listenIndex = -1;
    listenZeilenElemente = [];

    const wurzel = listenKoerper();
    wurzel.replaceChildren();

    // Hinweiszeile (Auftrag: "der Zustand muss sichtbar sein... und ein
    // Weg zurueck") - nur eingeblendet, wenn tatsaechlich etwas vom
    // Spaltenkopf aus eingeschraenkt/gruppiert wurde, sonst waere sie
    // Zierrat (derselbe Massstab wie bei zeigeFilterleiste() weiter
    // oben). Zeigt zusaetzlich N-von-M an: bei Kundschaft ist "M" hier
    // die Zahl der bereits geladenen (hoechstens 200) Zeilen, NICHT die
    // 1014 insgesamt - konsistent mit der Statuszeile in kunden.js, die
    // genau das schon offenlegt.
    if (spaltenkopfFilterwerte.size > 0 || gruppenSpalte) {
        wurzel.append(spaltenkopfHinweis(zeilenOriginal.length, angezeigt.length, gruppenSpalte));
    }

    const tabelle = document.createElement('table');
    tabelle.className = 'arbeitstabelle';
    tabelle.append(spaltenkopfKopfzeile(spalten, aktionen));

    const koerper = document.createElement('tbody');
    if (angezeigt.length === 0 && zeilenOriginal.length > 0) {
        koerper.append(baueLeerzeile(spalten, aktionen));
    } else if (gruppen) {
        let laufIndex = 0;
        for (const gruppe of gruppen) {
            koerper.append(spaltenkopfGruppenzeile(gruppe, spalten, aktionen, gruppenSpalte));
            for (const zeile of gruppe.zeilen) {
                koerper.append(baueDatenzeile(zeile, spalten, aktionen, laufIndex));
                laufIndex += 1;
            }
        }
    } else {
        angezeigt.forEach((zeile, index) => koerper.append(baueDatenzeile(zeile, spalten, aktionen, index)));
    }
    tabelle.append(koerper);
    wurzel.append(tabelle);

    fokusWiederherstellen(fokusMerkmal);
}

// ----- Fokuserhalt ueber einen vollstaendigen Neuaufbau der Tabelle -----
//
// Jeder Klick auf einen Spaltenkopf (und jede Eingabe in ein
// Spaltenfilterfeld) reisst die ganze Tabelle ab und baut sie neu auf -
// dieselbe volle Neuerstellung, die zeigeListe() schon immer macht.
// Ohne diese beiden Funktionen spraenge der Tastaturfokus dabei auf
// <body> zurueck: das gerade fokussierte Element existiert nach
// replaceChildren() nicht mehr. data-spaltenkopf-feld/-rolle
// identifizieren dasselbe Bedienelement in der NEUEN Tabelle, ohne dass
// zeigeListe() dafuer eine ID-Fabrik bräuchte.
function fokusMerken() {
    const el = document.activeElement;
    if (!el || !el.dataset || !el.dataset.spaltenkopfFeld) return null;
    return {
        feld: el.dataset.spaltenkopfFeld,
        rolle: el.dataset.spaltenkopfRolle,
        selektion: typeof el.selectionStart === 'number' ? [el.selectionStart, el.selectionEnd] : null
    };
}

function fokusWiederherstellen(merkmal) {
    if (!merkmal) return;
    const ziel = listenKoerper().querySelector(
        `[data-spaltenkopf-feld="${merkmal.feld}"][data-spaltenkopf-rolle="${merkmal.rolle}"]`);
    if (!ziel) return;
    ziel.focus();
    if (merkmal.selektion && typeof ziel.setSelectionRange === 'function') {
        // <input type="number"> erlaubt in manchen Browsern keine
        // Selektion (wirft eine InvalidStateError) - der Fokus selbst
        // (oben) ist damit trotzdem gesetzt, nur der Cursor bleibt an
        // seiner Vorgabeposition statt an der zuvor getippten Stelle.
        try { ziel.setSelectionRange(merkmal.selektion[0], merkmal.selektion[1]); } catch { /* siehe oben */ }
    }
}

// ----- Vorgabewerte je Faehigkeit -----
//
// Alle drei sind "an, sobald die Spalte einen sichtbaren Titel traegt" -
// eine Balkenspalte (leerer Titel, siehe balkenSpalten() weiter unten)
// oder die Aktionen-Spalte haben nichts, das sich beschriften liesse,
// und werden deshalb nie angeboten. Ein Bereich schaltet eine einzelne
// Faehigkeit fuer eine einzelne Spalte gezielt ab (":false"), wenn es
// dafuer schon ein eigenes Bedienelement gibt (siehe der lange Kommentar
// weiter oben) - nie andersherum: eine Spalte MUSS nicht extra
// eingeschaltet werden, um "immer... bei allen Tabellen" zu erfuellen.
function istSortierbar(spalte) { return Boolean(spalte.titel) && spalte.sortierbar !== false; }
function istFilterbar(spalte) { return Boolean(spalte.titel) && spalte.filterbar !== false; }
function istGruppierbar(spalte) { return Boolean(spalte.titel) && spalte.gruppierbar !== false; }

// Der Wert, nach dem sortiert/gruppiert wird - NIE der formatierte
// Anzeigetext (siehe "Nach Wert, nicht nach Anzeige" oben).
function spaltenWert(spalte, zeile) {
    return spalte.sortierwert ? spalte.sortierwert(zeile) : zeile[spalte.feld];
}

// Allgemeiner Wertevergleich: Zahlen numerisch, alles andere als Text
// ueber die deutsche Kollationsfolge (localeCompare mit numeric:true,
// damit "Rad 9" vor "Rad 10" liegt, nicht dahinter). Erwartet bereits
// nicht-leere Werte - leere werden von den beiden Aufrufstellen (Sortieren
// oben, Filteroptionen weiter unten) vorher herausgefiltert, jede mit
// ihrer eigenen Regel, WOHIN ein leerer Wert gehoert.
function vergleicheWerte(a, b) {
    if (typeof a === 'number' && typeof b === 'number') return a - b;
    if (typeof a === 'boolean' && typeof b === 'boolean') return a === b ? 0 : (a ? 1 : -1);
    return String(a).localeCompare(String(b), 'de', { numeric: true, sensitivity: 'base' });
}

// Erraet die Art des Filterfelds aus den TATSAECHLICH GELADENEN Werten
// (Auftrag: "was sinnvoll ist, haengt vom Spaltentyp ab - bei wenigen
// verschiedenen Werten eine Auswahl, bei Zahlen eher eine Grenze, bei
// Text eine Eingabe"), sofern der Bereich nicht selbst filterTyp
// vorgibt. zeilenOriginal (nicht die schon gefilterte Teilmenge!): die
// Optionen einer Auswahl duerfen nicht schrumpfen, nur weil ein ANDERER
// Spaltenfilter gerade etwas ausblendet - sonst verschwaende eine
// gewaehlte Option unter der Hand aus ihrem eigenen <select>.
function spaltenFilterTyp(spalte, zeilenOriginal) {
    if (spalte.filterTyp) return spalte.filterTyp;
    const werte = zeilenOriginal.map((z) => z[spalte.feld]).filter((w) => w !== null && w !== undefined && w !== '');
    if (werte.length === 0) return 'text';
    if (werte.every((w) => typeof w === 'number')) return 'schwelle';
    const verschiedene = new Set(werte.map(String));
    return verschiedene.size <= 10 ? 'auswahl' : 'text';
}

// Anzeigetext fuer EINEN Wert - fuer Auswahloptionen und
// Gruppenueberschriften. Nutzt formatieren() wieder, wenn vorhanden
// (dieselbe Zahl/dasselbe Datum erscheint dann genauso wie in der
// Tabellenzelle selbst, "Mär 2026" statt "2026-03-01") - liefert
// formatieren ein Element (zahlSkaliert() etc.), zaehlt dessen
// textContent, nicht das Element selbst: eine Gruppenueberschrift ist
// Fliesstext, kein zweites Tabellenfeld.
function spaltenBeschriftungFuerWert(spalte, zeile) {
    if (!zeile) return '—';
    const wert = zeile[spalte.feld];
    if (spalte.formatieren) {
        const ergebnis = spalte.formatieren(wert, zeile);
        return ergebnis instanceof Node ? ergebnis.textContent : String(ergebnis);
    }
    return wert === null || wert === undefined || wert === '' ? '—' : String(wert);
}

// Teilt zeilenListe (bereits gefiltert/sortiert) in Gruppen nach
// spalte.feld - eine Map, damit die Reihenfolge der ERSTEN Sichtung
// erhalten bleibt (JS-Maps iterieren in Einfuegereihenfolge): eine
// bereits sinnvoll sortierte Liste (Auswertungen: Radtyp, dann Monat)
// ergibt so Gruppen IN DERSELBEN Reihenfolge, keine neue alphabetische
// Ordnung, die den Zusammenhang zerrisse.
function gruppiere(zeilenListe, spalte) {
    const eimer = new Map();
    for (const zeile of zeilenListe) {
        const schluessel = String(zeile[spalte.feld] ?? '');
        if (!eimer.has(schluessel)) {
            eimer.set(schluessel, { beschriftung: spaltenBeschriftungFuerWert(spalte, zeile), zeilen: [] });
        }
        eimer.get(schluessel).zeilen.push(zeile);
    }
    return [...eimer.values()];
}

// ----- Kopfzeile(n): Titel/Sortieren/Gruppieren, darunter die Filterzeile -----
function spaltenkopfKopfzeile(spalten, aktionen) {
    const kopf = document.createElement('thead');

    const titelZeile = document.createElement('tr');
    for (const spalte of spalten) {
        const th = document.createElement('th');
        const hatTitel = Boolean(spalte.titel);
        // ariaLabel: fuer eine Spalte OHNE sichtbaren Titel (siehe
        // balkenSpalten() weiter unten) - dieselbe Ueberlegung wie bei
        // der Aktionen-Spalte direkt darunter: eine zweite, sichtbare
        // Ueberschrift ("Umsatz") neben der bereits betitelten
        // Zahlenspalte waere Wiederholung, aber eine <th> ganz ohne
        // Namen liesse die Spalte fuer einen Screenreader namenlos.
        if (!hatTitel && spalte.ariaLabel) th.setAttribute('aria-label', spalte.ariaLabel);

        const sortierbar = istSortierbar(spalte);
        const gruppierbar = istGruppierbar(spalte);
        if (sortierbar) {
            const aktiv = spaltenkopfSortFeld === spalte.feld && spaltenkopfSortRichtung !== 0;
            th.setAttribute('aria-sort', aktiv ? (spaltenkopfSortRichtung === 1 ? 'ascending' : 'descending') : 'none');
        }

        if (hatTitel && (sortierbar || gruppierbar)) {
            const wrapper = document.createElement('div');
            wrapper.className = 'spaltenkopf';
            wrapper.append(sortierbar ? spaltenkopfSortknopf(spalte) : spaltenkopfTitelOhneSortierung(spalte));
            if (gruppierbar) wrapper.append(spaltenkopfGruppenknopf(spalte));
            th.append(wrapper);
        } else {
            th.textContent = spalte.titel || '';
        }
        titelZeile.append(th);
    }
    if (aktionen) {
        // Keine sichtbare Beschriftung - eine Spaltenüberschrift "Aktionen"
        // über lauter blossen Icon-Zellen wäre reine Deko. aria-label
        // hält die Tabelle für Screenreader trotzdem vollständig: eine
        // <th> ohne jeden Namen liesse die letzte Spalte namenlos wirken.
        const th = document.createElement('th');
        th.setAttribute('aria-label', 'Aktionen');
        titelZeile.append(th);
    }
    kopf.append(titelZeile);

    // Filterzeile nur, wenn mindestens eine Spalte tatsaechlich filterbar
    // ist - sonst waere eine zweite, komplett leere Kopfzeile Zierrat
    // (derselbe Massstab wie bei zeigeFilterleiste() weiter oben: "ein
    // Bedienelement, das nichts filtert, ist Zierrat"). Beide <tr>
    // bleiben Kinder DESSELBEN <thead> - .arbeitstabelle thead ist
    // "position: sticky", das gilt fuer das ganze Element, nicht Zeile
    // fuer Zeile: beide kleben zusammen am oberen Rand, unveraendert
    // gegenueber vorher.
    if (spalten.some((s) => istFilterbar(s))) {
        kopf.append(spaltenkopfFilterzeile(spalten, aktionen));
    }

    return kopf;
}

function spaltenkopfTitelOhneSortierung(spalte) {
    const spanne = document.createElement('span');
    spanne.textContent = spalte.titel;
    return spanne;
}

function spaltenkopfSortknopf(spalte) {
    const knopf = document.createElement('button');
    knopf.type = 'button';
    knopf.className = 'spaltenkopf-sortknopf';
    knopf.dataset.spaltenkopfFeld = spalte.feld;
    knopf.dataset.spaltenkopfRolle = 'sortieren';

    const titelSpanne = document.createElement('span');
    titelSpanne.textContent = spalte.titel;
    knopf.append(titelSpanne);

    const aktiv = spaltenkopfSortFeld === spalte.feld && spaltenkopfSortRichtung !== 0;
    const symbol = document.createElement('span');
    symbol.className = 'spaltenkopf-sortsymbol'
        + (aktiv ? ' spaltenkopf-sortsymbol-aktiv' : '')
        + (aktiv && spaltenkopfSortRichtung === 1 ? ' spaltenkopf-sortsymbol-auf' : '');
    // Konstantes Markup, keine Nutzereingabe - derselbe Ausnahmefall wie
    // RAD_ICONS/SCHADEN_ICONS in den Bereichen (siehe dortiger Kommentar).
    symbol.innerHTML = SPALTENKOPF_SORT_ICON;
    symbol.setAttribute('aria-hidden', 'true');   // der Text daneben UND aria-label sagen es bereits
    knopf.append(symbol);

    knopf.setAttribute('aria-label', `Nach ${spalte.titel} sortieren`
        + (aktiv ? `, aktuell ${spaltenkopfSortRichtung === 1 ? 'aufsteigend' : 'absteigend'}` : ''));

    // Klick UND Tastatur: ein <button> ist beides ohne weiteren Code -
    // Enter/Leertaste loesen 'click' nativ aus (Auftrag: "mit der
    // Tastatur erreichbar UND bedienbar", kein Nachbau eines
    // Tastatur-Handlers fuer etwas, das der Browser schon kann).
    knopf.addEventListener('click', () => {
        if (spaltenkopfSortFeld !== spalte.feld) {
            spaltenkopfSortFeld = spalte.feld;
            spaltenkopfSortRichtung = 1;
        } else if (spaltenkopfSortRichtung === 1) {
            spaltenkopfSortRichtung = -1;
        } else if (spaltenkopfSortRichtung === -1) {
            // Dritter Klick: zurueck zur Ausgangsordnung (Auftrag).
            spaltenkopfSortFeld = null;
            spaltenkopfSortRichtung = 0;
        } else {
            spaltenkopfSortRichtung = 1;
        }
        zeichneArbeitstabelle();
    });

    return knopf;
}

function spaltenkopfGruppenknopf(spalte) {
    const knopf = document.createElement('button');
    knopf.type = 'button';
    knopf.className = 'spaltenkopf-gruppenknopf';
    knopf.dataset.spaltenkopfFeld = spalte.feld;
    knopf.dataset.spaltenkopfRolle = 'gruppieren';
    const aktiv = spaltenkopfGruppe === spalte.feld;
    knopf.setAttribute('aria-pressed', String(aktiv));
    knopf.setAttribute('aria-label', `Nach ${spalte.titel} gruppieren`);
    knopf.innerHTML = SPALTENKOPF_GRUPPE_ICON;
    knopf.addEventListener('click', () => {
        // Immer nur EINE Gruppierung ueber die ganze Tabelle - ein Klick
        // auf eine ANDERE Spalte ersetzt die vorherige (kein
        // verschachteltes Gruppieren, das der Auftrag nicht verlangt),
        // ein Klick auf dieselbe hebt sie wieder auf.
        spaltenkopfGruppe = aktiv ? null : spalte.feld;
        zeichneArbeitstabelle();
    });
    return knopf;
}

function spaltenkopfFilterzeile(spalten, aktionen) {
    const zeile = document.createElement('tr');
    zeile.className = 'spaltenkopf-filterzeile';
    for (const spalte of spalten) {
        const th = document.createElement('th');
        if (istFilterbar(spalte)) th.append(spaltenkopfFilterfeld(spalte));
        zeile.append(th);
    }
    if (aktionen) zeile.append(document.createElement('th'));
    return zeile;
}

// Baut das eigentliche Filter-Bedienelement - Auswahl, Schwelle oder
// Text, siehe spaltenFilterTyp() weiter oben. Alle drei tragen
// data-spaltenkopf-feld/-rolle="filtern" fuer den Fokuserhalt (siehe
// fokusMerken()/fokusWiederherstellen() oben) und ein aria-label, weil
// keines von ihnen ein <label for> aus dem statischen HTML hat (sie
// entstehen dynamisch, wie die Felder aus zeigeMaske()).
function spaltenkopfFilterfeld(spalte) {
    const { zeilen: zeilenOriginal } = spaltenkopfListe;
    const typ = spaltenFilterTyp(spalte, zeilenOriginal);
    const aktuellerWert = spaltenkopfFilterwerte.get(spalte.feld);

    if (typ === 'auswahl') {
        const auswahl = document.createElement('select');
        auswahl.dataset.spaltenkopfFeld = spalte.feld;
        auswahl.dataset.spaltenkopfRolle = 'filtern';
        auswahl.setAttribute('aria-label', `${spalte.titel} filtern`);
        // Punkt 5, woertlich: "ein greifender Filter muss anders
        // aussehen als ein leerer" - aktuellerWert ist nur gesetzt,
        // solange spaltenkopfFilterwerte fuer dieses Feld tatsaechlich
        // etwas eintraegt (siehe 'change' weiter unten, das bei "Alle"
        // wieder loescht), deshalb reicht diese eine Bedingung.
        if (aktuellerWert !== undefined) auswahl.classList.add('spaltenkopf-filter-aktiv');

        const alle = document.createElement('option');
        alle.value = '';
        alle.textContent = 'Alle';
        auswahl.append(alle);

        const distinct = new Map();   // roher Wert (als String) -> Beispielzeile fuer die Beschriftung
        for (const zeile of zeilenOriginal) {
            const roh = zeile[spalte.feld];
            if (roh === null || roh === undefined || roh === '') continue;
            const schluessel = String(roh);
            if (!distinct.has(schluessel)) distinct.set(schluessel, zeile);
        }
        const sortiert = [...distinct.entries()].sort(([, za], [, zb]) =>
            vergleicheWerte(spaltenWert(spalte, za), spaltenWert(spalte, zb)));
        for (const [schluessel, beispielZeile] of sortiert) {
            const option = document.createElement('option');
            option.value = schluessel;
            option.textContent = spaltenBeschriftungFuerWert(spalte, beispielZeile);
            if (aktuellerWert === schluessel) option.selected = true;
            auswahl.append(option);
        }

        // 'change' statt 'input': feuert erst beim Abschluss der Auswahl,
        // kein Zumuellen der Tabelle waehrend des Durchblaetterns mit den
        // Pfeiltasten - dieselbe Ueberlegung wie beim Auswahl-Typ in
        // zeigeFilterleiste() weiter oben.
        auswahl.addEventListener('change', () => {
            if (auswahl.value === '') spaltenkopfFilterwerte.delete(spalte.feld);
            else spaltenkopfFilterwerte.set(spalte.feld, auswahl.value);
            zeichneArbeitstabelle();
        });
        return auswahl;
    }

    const eingabe = document.createElement('input');
    eingabe.type = typ === 'schwelle' ? 'number' : 'text';
    eingabe.dataset.spaltenkopfFeld = spalte.feld;
    eingabe.dataset.spaltenkopfRolle = 'filtern';
    eingabe.setAttribute('aria-label', typ === 'schwelle' ? `Mindestwert für ${spalte.titel}` : `${spalte.titel} filtern`);
    eingabe.placeholder = typ === 'schwelle' ? '≥' : 'Suche…';
    // Dieselbe Bedingung wie beim <select>-Zweig oben (siehe dortiger
    // Kommentar) - hier zusaetzlich der Grund, warum die Klasse erst
    // NACH dem Debounce (siehe setTimeout unten) wechselt: das ist
    // derselbe Zeitpunkt, zu dem die Tabelle selbst tatsaechlich neu
    // gefiltert wird - "aktiv" soll nicht frueher aufleuchten, als der
    // Filter wirklich zu greifen beginnt.
    if (aktuellerWert !== undefined) {
        eingabe.value = typ === 'schwelle' ? String(aktuellerWert) : aktuellerWert;
        eingabe.classList.add('spaltenkopf-filter-aktiv');
    }

    // 300ms Verzoegerung wie bei der Kundensuche (kunden.js) und dem
    // Alters-Schieber (instandhaltung.js): ohne sie loeste jeder
    // Tastendruck einen kompletten Tabellen-Neuaufbau aus UND risse dabei
    // - siehe fokusMerken()/fokusWiederherstellen() oben - genau das
    // Eingabefeld weg, in das gerade getippt wird.
    let verzoegerung = null;
    eingabe.addEventListener('input', () => {
        clearTimeout(verzoegerung);
        verzoegerung = setTimeout(() => {
            const text = eingabe.value.trim();
            if (text === '') {
                spaltenkopfFilterwerte.delete(spalte.feld);
            } else if (typ === 'schwelle') {
                const zahl = Number(text.replace(',', '.'));
                if (Number.isFinite(zahl)) spaltenkopfFilterwerte.set(spalte.feld, zahl);
                else spaltenkopfFilterwerte.delete(spalte.feld);
            } else {
                // Unveraendert gespeichert (nicht kleingeschrieben) - das
                // Feld zeigt nach dem Neuzeichnen sonst nicht mehr das,
                // was getippt wurde (siehe Kommentar beim Filtern oben).
                spaltenkopfFilterwerte.set(spalte.feld, text);
            }
            zeichneArbeitstabelle();
        }, 300);
    });
    return eingabe;
}

// Hinweiszeile ueber der Tabelle - sichtbarer Zustand UND ein Weg zurueck
// (Auftrag), siehe der lange Kommentar bei zeigeListe() oben. Nur
// eingeblendet, wenn tatsaechlich gefiltert oder gruppiert wird.
function spaltenkopfHinweis(gesamt, angezeigtAnzahl, gruppenSpalte) {
    const zeile = document.createElement('div');
    zeile.className = 'spaltenkopf-hinweis';

    if (spaltenkopfFilterwerte.size > 0) {
        const text = document.createElement('span');
        text.textContent = angezeigtAnzahl === gesamt
            ? `${gesamt} Zeilen`
            : `${angezeigtAnzahl} von ${gesamt} Zeilen (Spaltenfilter aktiv)`;
        zeile.append(text);

        const zuruecksetzen = document.createElement('button');
        zuruecksetzen.type = 'button';
        zuruecksetzen.className = 'spaltenkopf-hinweis-knopf';
        zuruecksetzen.textContent = 'Spaltenfilter zurücksetzen';
        zuruecksetzen.addEventListener('click', () => {
            spaltenkopfFilterwerte = new Map();
            zeichneArbeitstabelle();
        });
        zeile.append(zuruecksetzen);
    }

    if (gruppenSpalte) {
        const text = document.createElement('span');
        text.textContent = `Gruppiert nach ${gruppenSpalte.titel}`;
        zeile.append(text);

        const aufheben = document.createElement('button');
        aufheben.type = 'button';
        aufheben.className = 'spaltenkopf-hinweis-knopf';
        aufheben.textContent = 'Gruppierung aufheben';
        aufheben.addEventListener('click', () => {
            spaltenkopfGruppe = null;
            zeichneArbeitstabelle();
        });
        zeile.append(aufheben);
    }

    return zeile;
}

// Gruppen-Ueberschriftszeile: Beschriftung + je summierbarer Spalte eine
// Zwischensumme (Auftrag: "eine Zwischensumme je Gruppe, wo Summieren
// fachlich stimmt" - und NUR dort, siehe der lange Kommentar bei
// zeigeListe() oben zu summierbar). <th scope="rowgroup"> statt <td>:
// eine Gruppenzeile IST eine Ueberschrift fuer die Zeilen darunter, ein
// Bildschirmleser soll das auch als solche ansagen.
function spaltenkopfGruppenzeile(gruppe, spalten, aktionen, gruppenSpalte) {
    const tr = document.createElement('tr');
    tr.className = 'gruppenkopf-zeile';

    const th = document.createElement('th');
    th.setAttribute('scope', 'rowgroup');
    th.colSpan = spalten.length + (aktionen ? 1 : 0);

    const beschriftung = document.createElement('span');
    beschriftung.className = 'gruppenkopf-beschriftung';
    beschriftung.textContent = `${gruppenSpalte.titel}: ${gruppe.beschriftung} (${gruppe.zeilen.length})`;
    th.append(beschriftung);

    for (const spalte of spalten) {
        if (!spalte.summierbar || !spalte.titel) continue;
        const summe = gruppe.zeilen.reduce((s, z) => s + (Number(z[spalte.feld]) || 0), 0);
        const teil = document.createElement('span');
        teil.className = 'gruppenkopf-teilsumme';
        teil.append(document.createTextNode(`${spalte.titel}: `));
        // summeFormatieren() statt formatieren(): eine Zwischensumme hat
        // keine ZEILE, die ein formatieren(wert, zeile) mit zeile-Zugriff
        // (z. B. co2ZelleElement() in auswertungen.js) brauchen wuerde -
        // siehe der lange Kommentar bei zeigeListe() oben.
        const formatiert = spalte.summeFormatieren ? spalte.summeFormatieren(summe)
            : spalte.formatieren ? spalte.formatieren(summe)
            : summe.toLocaleString('de-DE');
        teil.append(formatiert instanceof Node ? formatiert : document.createTextNode(String(formatiert)));
        th.append(teil);
    }

    tr.append(th);
    return tr;
}

// Baut EINE Datenzeile - derselbe Zellenaufbau, den zeigeListe() vor
// dieser Erweiterung inline hatte, nur herausgeloest, weil er jetzt aus
// zwei Stellen aufgerufen wird (flach ohne Gruppierung, oder je Gruppe
// einmal). index ist die Position in listenZeilen/listenZeilenElemente
// (siehe zeileWaehlen() weiter unten) - bei Gruppierung ein fortlaufender
// Zaehler UEBER alle Gruppen hinweg, nicht je Gruppe neu bei 0: eine
// stabile Bucket-Aufteilung (siehe gruppiere() oben, Map in
// Einfuegereihenfolge) reiht die Zeilen dabei exakt wieder in ihrer
// urspruenglichen Reihenfolge auf, sodass dieser Zaehler und die flache
// Liste "angezeigt" immer dieselbe Zeile meinen.
function baueDatenzeile(zeile, spalten, aktionen, index) {
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
    listenZeilenElemente.push(tr);
    return tr;
}

// "Kein Treffer fuer diesen Spaltenfilter" (Erprobung, Auftrag) - eine
// schlanke Zeile INNERHALB der bestehenden Tabelle statt eines Aufrufs
// von zeigeLeermaske(), das Kopf- UND Filterzeile mit wegraeumen wuerde
// (siehe der lange Kommentar bei zeigeListe() oben, Abschnitt "KEIN
// zeigeLeermaske()"). listenZeilen bleibt dabei [] (siehe
// zeichneArbeitstabelle() oben) - der globale Pfeiltasten-Handler prueft
// das bereits ("if (listenZeilen.length === 0) return"), es gibt hier
// nichts zusaetzlich abzusichern.
function baueLeerzeile(spalten, aktionen) {
    const tr = document.createElement('tr');
    tr.className = 'spaltenkopf-leerzeile';
    const td = document.createElement('td');
    td.colSpan = spalten.length + (aktionen ? 1 : 0);
    td.append(document.createTextNode('Keine Zeile erfüllt die gewählte Einschränkung am Spaltenkopf. '));
    const knopf = document.createElement('button');
    knopf.type = 'button';
    knopf.textContent = 'Spaltenfilter zurücksetzen';
    knopf.addEventListener('click', () => {
        spaltenkopfFilterwerte = new Map();
        zeichneArbeitstabelle();
    });
    td.append(knopf);
    tr.append(td);
    return tr;
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

// Feather-Stil, dieselbe Familie wie SPALTENKOPF_SORT_ICON/aktion.svg
// (24x24, currentColor per CSS) - ein einfaches Kreuz fuer die
// Schliessen-Schaltflaeche in zeigeMaske() (Gestaltungsauftrag Punkt 1).
const DETAILMASKE_SCHLIESSEN_ICON = '<svg viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>';

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

    // Kopfzeile mit Titel UND einer sichtbaren Schliessen-Schaltflaeche
    // (Gestaltungsauftrag Punkt 1: "das fehlt einfach" - Escape allein
    // war vorher der EINZIGE Weg zurueck, unsichtbar fuer jeden, der die
    // Taste nicht kennt oder mit der Maus arbeitet). Ein <div> statt des
    // <h2> direkt an der Wurzel, weil Titel und Knopf nebeneinander
    // stehen muessen - #detailmaske h2 traegt seine bisherige Formatierung
    // unveraendert weiter, nur eine Ebene tiefer (siehe style.css).
    const kopf = document.createElement('div');
    kopf.className = 'detailmaske-kopf';

    const ueberschrift = document.createElement('h2');
    ueberschrift.textContent = titel;
    kopf.append(ueberschrift);

    const schliessenKnopf = document.createElement('button');
    schliessenKnopf.type = 'button';
    schliessenKnopf.className = 'detailmaske-schliessen';
    schliessenKnopf.setAttribute('aria-label', 'Details schliessen');
    schliessenKnopf.title = 'Details schliessen (Esc)';
    // Rohes SVG-Markup, dieselbe Machart wie SPALTENKOPF_SORT_ICON/
    // aktion.svg - eine feste Konstante dieser Datei, keine Nutzereingabe.
    schliessenKnopf.innerHTML = DETAILMASKE_SCHLIESSEN_ICON;
    schliessenKnopf.addEventListener('click', () => { maskeSchliessen(); });
    kopf.append(schliessenKnopf);

    wurzel.append(kopf);

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
        // Ausgangswert festhalten (Gestaltungsauftrag Punkt 1: "wer gerade
        // in einem Feld tippt, erwartet beim ersten Escape das Verwerfen
        // der Eingabe" UND "ungespeicherte Eingaben duerfen nicht durch
        // ein versehentliches Escape verloren gehen"). Ein data-Attribut
        // statt eines separaten Moduls-Zustands: der Vergleichswert lebt
        // damit AM Feld selbst, ueberlebt unveraendert, welches Feld
        // gerade den Fokus traegt, und verschwindet automatisch mit dem
        // Feld, wenn die Maske neu aufgebaut oder geschlossen wird - kein
        // eigenes Aufraeumen noetig. String(...) normalisiert dabei
        // Zahlen/null/undefined auf denselben Vergleichstyp wie
        // eingabe.value (immer ein String).
        eingabe.dataset.ursprungswert = String(feld.wert ?? '');
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

// ===== Querverweise (Gestaltungsauftrag Punkt 3: "Sichten verweben") =====
//
// "Insgesamt also noch viel mehr die Infos untereinander verweben, damit
// sich die Sichten ergaenzen und richtige Workflows moeglich machen" -
// woertlich der Auftrag. Heute sind die fuenf Bereiche fuenf Inseln:
// dieselbe Rahmennummer taucht in Flotte UND Instandhaltung auf, ohne
// dass ein Klick von einer zur anderen fuehrt. EIN Baustein hier statt
// eines eigenen Sprungs je Bereichspaar - dieselbe Wiederholungsfalle wie
// bei Werkzeugleiste/Filterleiste/Uebersichtsstreifen weiter oben (siehe
// deren Kopfkommentare): fuenf Bereiche, die denselben Sprung unabhaengig
// voneinander nachbauen wuerden, sobald ein zweites Bereichspaar dazukommt.
//
// DIE ROLLEN ENTSCHEIDEN MIT (Auftrag, woertlich): darfBereich() prueft
// dieselben bereich.rollen, die navigationAufbauen() oben schon fuer die
// Menuepunkte selbst auswertet - ein Sprung in einen Bereich, den die
// angemeldete Rolle nicht sehen darf, ist dieselbe Einladung zu einer
// unerklaerten Leere wie ein Menuepunkt fuer einen Bereich ohne eigene
// Berechtigung (siehe Kopfkommentar bei navigationAufbauen()). Der
// AUFRUFER prueft darfBereich(), BEVOR er den Sprung-Knopf ueberhaupt
// baut - "was man nicht darf, wird nicht angeboten", nicht ausgegraut.
// bereichSprung() selbst prueft zusaetzlich, defensiv: ein Aufrufer, der
// das vergisst, bekommt einen wortlosen Fehlschlag statt eines Sprungs in
// eine Navigation, die derselbe Nutzer im Menue nie zu sehen bekaeme.
function darfBereich(schluessel) {
    const bereich = bereiche.get(schluessel);
    return Boolean(bereich) && bereich.rollen.some((r) => darfRolle(r));
}

// zielSchluessel: bereich.schluessel des Ziels (siehe bereichAnmelden()).
// herkunftstext: "gekommen von ..." - erscheint als Bestaetigung in der
//   Statuszeile DES ZIELBEREICHS ("sagen, woher man kommt", Auftrag
//   woertlich). Wird an bereichWechseln() durchgereicht statt hier selbst
//   per melde() gesetzt - bereichWechseln() loescht die Statuszeile bei
//   JEDEM Wechsel bedingungslos (siehe dortiger Kommentar), ein melde()
//   HIER waere von genau diesem Loeschen sofort wieder ueberschrieben
//   worden.
// einrichten: optionales async () => {}, LAEUFT NACH bereichWechseln() -
//   der Zielbereich hat seine erste Liste dann bereits geladen und
//   gezeichnet (setzeSpaltenkopfFilter()/waehleZeileMit() unten setzen
//   genau darauf auf). Ein bereichseigenes "vorher" (z. B. Instandhaltung
//   auf den Unterreiter "Schaeden" stellen, BEVOR ihr eigenes aufbauen()
//   laeuft) gehoert NICHT hierher, sondern in eine eigene, vom Zielbereich
//   selbst angebotene Funktion (siehe instandhaltungZeigeSchaeden() in
//   instandhaltung.js) - dieser Baustein kennt die Interna keines
//   einzelnen Bereichs.
async function bereichSprung(zielSchluessel, herkunftstext, einrichten = null) {
    if (!darfBereich(zielSchluessel)) return;   // siehe Kopfkommentar oben
    await bereichWechseln(zielSchluessel, herkunftstext);
    if (einrichten) await einrichten();
}

// "... dorthin FILTERN ..." (Auftrag) - setzt einen Spaltenkopf-Filter
// (zeigeListe()) von AUSSEN, fuer den Einsatz als einrichten() bei
// bereichSprung() oben. feld muss eine Spalte sein, die die geladene
// Liste des ZIELBEREICHS tatsaechlich anbietet (siehe zeigeListe()) -
// sonst wird der Eintrag zwar gesetzt, aber von keiner Spalte abgefragt
// und filtert folglich nichts. zeichneArbeitstabelle() zeichnet sofort
// neu, mit demselben Zustand, den ein Klick auf ein Spaltenkopf-
// Filterfeld auch ausloesen wuerde - kein zweiter Ladevorgang noetig,
// der Zielbereich hat seine Zeilen (spaltenkopfListe) bereits.
function setzeSpaltenkopfFilter(feld, wert) {
    spaltenkopfFilterwerte.set(feld, wert);
    if (spaltenkopfListe) zeichneArbeitstabelle();
}

// "... oder AUSWAEHLEN" (Auftrag) - waehlt von AUSSEN die Zeile aus,
// deren vergleichsfeld genau wert traegt (z. B. fahrrad_id), fuer den
// Einsatz als einrichten() bei bereichSprung() oben. Wortlos folgenlos,
// wenn keine Zeile passt (etwa weil die Zielzeile in der Zwischenzeit
// den Bearbeitungsstand gewechselt hat und aus einer gefilterten Liste
// gefallen ist) - derselbe Grundsatz wie bei jedem anderen veralteten
// Zustand in dieser Oberflaeche: kein Absturz, keine falsche Auswahl.
function waehleZeileMit(vergleichsfeld, wert) {
    const index = listenZeilen.findIndex((z) => z[vergleichsfeld] === wert);
    if (index !== -1) zeileWaehlen(index);
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

// ===== Einstellungen (Gestaltungsauftrag Punkt 3: Zebramuster als
// Wahlmoeglichkeit, "optional anbieten" statt fest einzuschalten) =====
//
// localStorage statt einer Spalte/Tabelle in der Datenbank: eine reine
// Anzeigepraeferenz ohne jede fachliche Bedeutung - sie beeinflusst
// keine Buchung, keinen Bestand, keine Sicht. Der Auftrag verlangt an
// anderer Stelle ausdruecklich "Verfeinerung, nicht Umbau" und "nichts
// an der Datenbank aendern" - eine neue Spalte nur fuer "mag diese
// Person Streifen" waere beides zugleich verletzt, fuer einen Wert, der
// nirgends sonst gebraucht wird. localStorage ueberlebt von sich aus
// jeden Neuaufbau UND jeden Bereichswechsel (beide leeren nur
// #arbeitsliste/#detailmaske, siehe bereichWechseln() oben, nie den
// Browserspeicher) - genau die vom Auftrag verlangte Haltbarkeit, ganz
// ohne eigene Zwischenspeicherung hier im Skript.
const ZEBRA_SPEICHERSCHLUESSEL = 'velocity-wawi-zebra';

function zebraGespeichert() {
    return localStorage.getItem(ZEBRA_SPEICHERSCHLUESSEL) === 'an';
}

// Reines CSS-Zebra (siehe body.zebra-an in style.css): eine Klasse auf
// <body> genuegt, kein Neuzeichnen der gerade sichtbaren Tabelle noetig -
// anders als Sortieren/Filtern/Gruppieren aendert dieser Schalter nicht,
// WELCHE Zeilen dastehen, nur ihr Aussehen.
function zebraAnwenden(aktiv) {
    document.body.classList.toggle('zebra-an', aktiv);
}

// Sofort beim Laden dieser Datei, vor jedem ersten Tabellenaufbau -
// sonst zeichnete die allererste Liste eines Arbeitstages kurz
// ungestreift, bis irgendein spaeterer Codepfad die Einstellung zum
// ersten Mal anwendet.
zebraAnwenden(zebraGespeichert());

const schalterZebra = document.getElementById('schalter-zebra');
schalterZebra.checked = zebraGespeichert();
schalterZebra.addEventListener('change', () => {
    zebraAnwenden(schalterZebra.checked);
    localStorage.setItem(ZEBRA_SPEICHERSCHLUESSEL, schalterZebra.checked ? 'an' : 'aus');
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

// ----- Ungespeicherte Eingaben (Gestaltungsauftrag Punkt 1) -----
//
// feldGeaendert() vergleicht den AKTUELLEN Feldwert mit dem in
// zeigeMaske() hinterlegten data-ursprungswert (siehe dort) - simpel und
// bewusst OHNE Kenntnis der Feldart: ein <select> traegt seinen
// gewaehlten Wert ebenso in .value wie ein <input> oder <textarea>,
// derselbe Stringvergleich passt fuer alle drei.
function feldGeaendert(element) {
    return element.dataset.ursprungswert !== undefined && element.value !== element.dataset.ursprungswert;
}

// true, sobald IRGENDEIN Feld der offenen Maske vom Ausgangswert
// abweicht - unabhaengig davon, wo der Tastaturfokus gerade steht. Nur
// Elemente mit data-ursprungswert zaehlen (siehe zeigeMaske()); Knoepfe
// und sonstige Kinder der Maske tragen dieses Attribut nicht und werden
// von querySelectorAll('[data-ursprungswert]') schon deshalb nicht
// erfasst.
function maskeHatUngespeicherteEingaben() {
    return [...document.querySelectorAll('#detailmaske [data-ursprungswert]')].some(feldGeaendert);
}

// Der user-ausgeloeste Schliessvorgang (Schaltflaeche ODER Escape, siehe
// Tastaturbedienung weiter unten) - anders als maskeVerwerfen() selbst,
// das WEITERHIN das stille, ungefragte Werkzeug fuer PROGRAMMATISCHE
// Wechsel bleibt (Reiterwechsel in instandhaltung.js/auswertungen.js:
// dort wird lediglich die Detailmaske des VORHERIGEN Reiters entfernt,
// bevor der naechste seine eigene aufbaut - kein Anwenderwunsch, keine
// Rueckfrage noetig, sonst muesste jeder Reiterklick erst einen Dialog
// wegklicken).
//
// Rueckfrage NUR, wenn tatsaechlich etwas abweicht (Auftrag: "darf nicht
// durch ein versehentliches Escape verloren gehen") - eine unveraenderte
// Maske schliesst sich sofort, ohne Umweg ueber bestaetige(). Bricht die
// Person die Rueckfrage ab, bleibt die Maske UNVERAENDERT offen: "gar
// nicht erst schliessen" ist hier bewusst die gewaehlte Haelfte der im
// Auftrag offen gelassenen Entscheidung ("nachfragen, oder gar nicht
// erst schliessen") - eine dritte Option (z. B. automatisch speichern)
// wuerde eine Buchung ohne ausdrueckliches "Speichern" ausloesen, was
// diese Warenwirtschaft nirgends sonst tut.
//
// Fokus zurueck zur Ursprungszeile (Auftrag Punkt 1, woertlich): die
// Zeilenreferenz wird VOR maskeVerwerfen() gesichert, weil das dortige
// Zuruecksetzen von listenIndex auf -1 den Zugriff ueber
// listenZeilenElemente[listenIndex] danach nicht mehr hergeben wuerde.
// Ohne offene Zeile (z. B. keine Auswahl bekannt) bleibt der Fokus
// unangetastet - es gibt kein sinnvolleres Ziel als "wo er ohnehin war".
async function maskeSchliessen() {
    const maske = document.getElementById('detailmaske');
    if (!maske.hasChildNodes()) return;

    if (maskeHatUngespeicherteEingaben()) {
        const weiter = await bestaetige(
            'Diese Maske enthaelt Eingaben, die noch nicht gespeichert wurden.\n\n' +
            'Werden sie jetzt geschlossen, gehen sie verloren - es wird nichts gebucht.'
        );
        if (!weiter) return;   // Abbruch: Maske bleibt offen, nichts geht verloren
    }

    const ursprungszeile = listenIndex !== -1 ? listenZeilenElemente[listenIndex] : null;
    maskeVerwerfen();
    ursprungszeile?.focus();
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

        const maske = document.getElementById('detailmaske');
        if (!maske.hasChildNodes()) return;   // nichts offen, nichts zu tun

        // RANGFOLGE (Gestaltungsauftrag Punkt 1, woertlich verlangt):
        // "wer gerade in einem Feld tippt, erwartet beim ersten Escape
        // das Verwerfen der Eingabe, nicht das Schliessen der Maske".
        // Deshalb PRIORITAET 1 - steht der Fokus in einem veraenderten
        // Feld DIESER Maske, wird NUR dieses eine Feld auf seinen
        // Ausgangswert zurueckgesetzt, die Maske bleibt offen, und der
        // Tastendruck ist damit verbraucht (kein Fall-Through in
        // PRIORITAET 2 im selben Tastendruck - sonst schlösse derselbe
        // Escape sofort auch noch die ganze Maske, obwohl gerade erst
        // ein einzelnes Feld gemeint war). Ein zweiter Escape-Druck
        // direkt danach findet das Feld dann unveraendert vor und faellt
        // folgerichtig auf PRIORITAET 2 durch.
        const aktiv = document.activeElement;
        const feldOffen = aktiv && maske.contains(aktiv) && aktiv.dataset.ursprungswert !== undefined;
        if (feldOffen && feldGeaendert(aktiv)) {
            e.preventDefault();
            aktiv.value = aktiv.dataset.ursprungswert;
            return;
        }

        // PRIORITAET 2: kein einzelnes Feld mehr zu verwerfen (entweder
        // stand der Fokus gar nicht in einem Feld dieser Maske, oder das
        // fokussierte Feld ist bereits unveraendert) - jetzt gilt Escape
        // dem Schliessen der GANZEN Maske. maskeSchliessen() fragt selbst
        // nach, falls ANDERE Felder noch unveraendert-ungespeichert
        // dastehen (siehe dortiger Kommentar) - hier ohne await aufgerufen,
        // weil ein synchroner keydown-Handler kein await kennt; die
        // Rueckfrage laeuft als eigener <dialog> und faengt sich selbst
        // im obigen dialog[open]-Fruehausstieg.
        maskeSchliessen();
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
        // BUTTON kam mit den Spaltenkopf-Bedienelementen dazu (Sortieren/
        // Gruppieren, siehe zeigeListe() weiter oben): ohne diese
        // Ergänzung riss ArrowDown/ArrowUp den Tastaturfokus von einem
        // gerade fokussierten Spaltenkopf-Knopf (oder jedem anderen
        // Knopf dieser Oberfläche) in die Zeilenauswahl der Liste, statt
        // schlicht nichts zu tun - im Browser nachgestellt: Tab zum
        // Knopf "Neues Rad anlegen", ArrowDown gedrückt, Fokus sprang
        // ungefragt auf die erste Tabellenzeile.
        const zielTag = document.activeElement?.tagName;
        if (zielTag === 'INPUT' || zielTag === 'TEXTAREA' || zielTag === 'SELECT' || zielTag === 'BUTTON') return;
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
