// ============================================
// VeloCity Warenwirtschaft — Rahmen
//
// Die Oberflaeche muss DREI Zustaende unterscheiden koennen, die im
// Browser gleich aussehen:
//
//   1. nicht angemeldet          -> Anmeldemaske
//   2. angemeldet, kein Mitarbeiter -> Hinweis, kein Zugang
//   3. angemeldet, Mitarbeiter   -> Arbeitsoberflaeche
//
// Der zweite Fall ist der haeufigste und der, den man vergisst: JEDER
// Kunde kann sich hier anmelden, weil es dieselbe auth.users ist. Er
// bekaeme dann eine Oberflaeche, in der jede Sicht null Zeilen liefert -
// fehlerfrei, leer, unerklaerlich. Deshalb wird vor dem Aufbau gefragt,
// nicht danach.
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
        zeige('zustand-arbeit', false);
        return;
    }

    geladeneRollen = rollen;

    zeige('zustand-laden', false);
    zeige('zustand-anmeldung', rollen === null);
    zeige('zustand-kein-mitarbeiter', rollen !== null && rollen.size === 0);
    zeige('zustand-arbeit', rollen !== null && rollen.size > 0);

    if (rollen && rollen.size > 0) {
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
    document.getElementById('benutzer-anzeige').textContent =
        `${benutzer.email} · ${[...rollen].join(', ')}`;

    if (erlaubt.length) await bereichWechseln(erlaubt[0].schluessel);
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

        const text = document.createElement('p');
        text.textContent = frage;
        dialog.append(text);

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

function reiterleiste() {
    let el = document.getElementById('reiterleiste');
    if (!el) {
        el = document.createElement('div');
        el.id = 'reiterleiste';
        el.setAttribute('role', 'tablist');
        const wurzel = document.getElementById('arbeitsliste');
        wurzel.insertBefore(el, wurzel.firstChild);
    }
    return el;
}

// spalten: [{ feld, titel, formatieren?, klasse? }]
// Bei Klick UND bei Pfeiltaste: beiAuswahl(zeile) aufrufen und die
// Zeile als ausgewaehlt markieren.
function zeigeListe(zeilen, spalten, beiAuswahl) {
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
        tr.addEventListener('click', () => zeileWaehlen(index));
        koerper.append(tr);
        listenZeilenElemente.push(tr);
    });
    tabelle.append(koerper);
    wurzel.append(tabelle);
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
// art: 'haupt' | 'neben' | 'gefaehrlich'
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
        if (def.art === 'haupt') hauptknopfElement = knopf;
    }
    wurzel.append(knopfleiste);
}

// Eine leere Liste ist kein leerer Kasten. Sie sagt, WARUM nichts da ist,
// und bietet an, was als Naechstes zu tun waere.
// angebot: { titel, ausfuehren: async () => {} } | null
function zeigeLeermaske(titel, erklaerung, angebot = null) {
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
// reiter: [{ schluessel, titel }]
function zeigeUnterreiter(reiter, aktiv, beiWechsel) {
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
function darfRolle(code) {
    return geladeneRollen !== null && geladeneRollen.has(code);
}

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

// beiAnmeldungsWechsel() ruft NICHT sofort mit dem aktuellen Zustand auf
// (anders als das Vorbild src/auth.js) - deshalb wird seiteAufbauen()
// unten zusaetzlich einmal von Hand angestossen, fuer den allerersten
// Seitenaufruf.
beiAnmeldungsWechsel(seiteAufbauen);
seiteAufbauen();
