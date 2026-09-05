// ============================================
// VeloCity - persoenliches Dashboard
//
// EIGENE DATEI, WEIL script.js 2 618 ZEILEN HAT. Diese Datei laedt die
// drei Kundensichten und zeichnet daraus; sie RECHNET NICHT. Jede
// angezeigte Zahl kommt aus einer Sicht - eine Kennzahl, die nur hier
// entstuende, waere von keinem Datenbanktest erreichbar.
// ============================================

async function ladeBilanz() {
    const zeilen = await ladeListe('v_meine_bilanz');
    return zeilen[0] || null;
}

async function ladeMonate() {
    return ladeListe('v_meine_monatsbilanz', '*', (q) => q.order('monat'));
}

async function ladeLetzteFahrten(anzahl = 5) {
    return ladeListe('v_meine_fahrt_kennzahl', '*',
        (q) => q.order('startzeit', { ascending: false }).limit(anzahl));
}

/* Zahlen im Dashboard werden EINHEITLICH deutsch formatiert. Ohne das
   stuenden 1234.5 und 1.234,5 nebeneinander auf derselben Seite. */
const zahl = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 });
const euro = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });

function kachel(wert, einheit, beschriftung) {
    const d = document.createElement('div');
    d.className = 'bilanz-kachel';
    const w = document.createElement('span');
    w.className = 'bilanz-wert';
    w.textContent = wert;
    const e = document.createElement('span');
    e.className = 'bilanz-einheit';
    e.textContent = einheit;
    const b = document.createElement('span');
    b.className = 'bilanz-beschriftung';
    b.textContent = beschriftung;
    d.append(w, e, b);
    return d;
}

function bilanzZeichnen(b) {
    const ziel = document.getElementById('dashboard-bilanz');
    ziel.replaceChildren(
        kachel(zahl.format(b.km_gesamt), 'km', 'gefahren'),
        kachel(zahl.format(b.co2_ersparnis_kg_gesamt), 'kg', 'CO₂ gespart'),
        kachel(String(b.fahrten_gesamt), '', 'Fahrten'),
        kachel(euro.format(b.ausgaben_gesamt), '', 'ausgegeben')
    );

    /* Der Schaetzanteil steht sichtbar, nicht im Kleingedruckten. 40
       Prozent der Fahrten im Bestand haben keine gemessene Distanz; ein
       Wert, der eine Schaetzung als Messung ausgibt, ist der Punkt, an
       dem ein solches Dashboard unglaubwuerdig wird. */
    if (b.anteil_geschaetzt > 0) {
        const hinweis = document.createElement('p');
        hinweis.className = 'bilanz-hinweis';
        hinweis.textContent =
            `${zahl.format(b.anteil_geschaetzt * 100)} % der Strecken sind geschätzt, `
            + 'nicht gemessen.';
        ziel.append(hinweis);
    }
}

/* Das Konterfei ist ABGELEITET, nicht hinterlegt: keine Bilddatei, kein
   Upload, keine Spalte. Jedes Konto hat sofort eines, auch ein morgen
   angelegtes. Ein Foto kommt nicht in Frage - ein Gesicht unter einer
   erfundenen Identitaet ist keine Illustration, sondern eine Behauptung
   ueber einen Menschen. */
function konterfeiZeichnen(vorname, nachname, schluessel) {
    const initialen = ((vorname || '?')[0] + (nachname || '?')[0]).toUpperCase();
    let summe = 0;
    for (const z of String(schluessel || initialen)) summe = (summe * 31 + z.charCodeAt(0)) % 360;

    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 96 96');
    svg.setAttribute('class', 'konterfei-svg');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', `${vorname} ${nachname}`);

    const scheibe = document.createElementNS(ns, 'circle');
    scheibe.setAttribute('cx', '48'); scheibe.setAttribute('cy', '48');
    scheibe.setAttribute('r', '44');
    scheibe.setAttribute('fill', `hsl(${summe} 42% 88%)`);
    scheibe.setAttribute('stroke', `hsl(${summe} 46% 42%)`);
    scheibe.setAttribute('stroke-width', '3');

    const text = document.createElementNS(ns, 'text');
    text.setAttribute('x', '48'); text.setAttribute('y', '49');
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('dominant-baseline', 'central');
    text.setAttribute('font-size', '34');
    text.setAttribute('font-weight', '600');
    text.setAttribute('fill', `hsl(${summe} 46% 28%)`);
    text.textContent = initialen;

    svg.append(scheibe, text);
    document.getElementById('dashboard-konterfei').replaceChildren(svg);
}

/* Drei Ringe fuer den LAUFENDEN Monat, gemessen am eigenen
   Monatsdurchschnitt - nicht an einem festen Ziel. Am 5. eines Monats
   stuenden die Ringe sonst auf einem Bruchteil, und das Dashboard zeigte
   an jedem Monatsanfang Versagen an. */
function ringeZeichnen(monate) {
    const ziel = document.getElementById('dashboard-ringe');
    if (!monate.length) { ziel.replaceChildren(); return; }

    const jetzt = new Date();
    const lauf = `${jetzt.getFullYear()}-${String(jetzt.getMonth() + 1).padStart(2, '0')}-01`;
    const aktuell = monate.find((m) => m.monat === lauf);
    const frueher = monate.filter((m) => m.monat !== lauf);
    // Kein laufender Monat (noch keine Fahrt seit dem Ersten) oder keine
    // Vergangenheit zum Vergleich: dann gibt es keinen eigenen
    // Durchschnitt, gegen den zu messen waere. Ein leerer Block ist hier
    // ehrlicher als eine erfundene Zahl.
    if (!aktuell || !frueher.length) { ziel.replaceChildren(); return; }

    const mittel = (feld) => frueher.reduce((s, m) => s + Number(m[feld]), 0) / frueher.length;
    // Farben gegen die weisse Kartenflaeche geprueft (WCAG 1.4.11, 3:1 fuer
    // grafische Objekte): Rot 4,2:1, Gruen 3,45:1, Blau 4,79:1.
    const ringe = [
        { feld: 'fahrten', name: 'Fahrten',   farbe: '#e2402d' },
        { feld: 'km',      name: 'Kilometer', farbe: '#1f9d6b' },
        { feld: 'minuten', name: 'Minuten',   farbe: '#2f74c0' }
    ];

    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 200 200');
    svg.setAttribute('class', 'ringe-svg');
    svg.setAttribute('role', 'img');

    const teile = [];
    ringe.forEach((r, i) => {
        const radius = 84 - i * 24;
        const umfang = 2 * Math.PI * radius;
        const soll = mittel(r.feld);
        const anteil = soll > 0 ? Math.min(Number(aktuell[r.feld]) / soll, 1) : 0;

        for (const [klasse, laenge, farbe] of [
            ['ring-grund', umfang, '#e6e3dc'],
            ['ring-wert',  umfang * anteil, r.farbe]
        ]) {
            const kreis = document.createElementNS(ns, 'circle');
            kreis.setAttribute('cx', '100'); kreis.setAttribute('cy', '100');
            kreis.setAttribute('r', String(radius));
            kreis.setAttribute('fill', 'none');
            kreis.setAttribute('stroke', farbe);
            kreis.setAttribute('stroke-width', '16');
            kreis.setAttribute('stroke-linecap', 'round');
            kreis.setAttribute('class', klasse);
            kreis.setAttribute('stroke-dasharray', `${laenge} ${umfang}`);
            kreis.setAttribute('transform', 'rotate(-90 100 100)');
            svg.append(kreis);
        }
        teile.push(`${r.name} ${Math.round(anteil * 100)} Prozent des eigenen Durchschnitts`);
    });

    svg.setAttribute('aria-label', 'Laufender Monat: ' + teile.join(', '));

    const ueber = document.createElement('h3');
    ueber.textContent = 'Dieser Monat';
    const legende = document.createElement('ul');
    legende.className = 'ringe-legende';
    ringe.forEach((r) => {
        const li = document.createElement('li');
        const punkt = document.createElement('span');
        punkt.className = 'ringe-punkt';
        punkt.style.background = r.farbe;
        const text = document.createElement('span');
        text.textContent = `${r.name}: ${zahl.format(aktuell[r.feld])} `
            + `(Durchschnitt ${zahl.format(mittel(r.feld))})`;
        li.append(punkt, text);
        legende.append(li);
    });
    ziel.replaceChildren(ueber, svg, legende);
}

/* Ein Balken je Monat, umschaltbar. Die Achse beginnt bei null: hier
   kodiert LAENGE den Wert, und eine beschnittene Achse waere bei einer
   Laengenkodierung eine Falschaussage. Balkenbreite in Prozent ist eine
   reine Darstellungsgroesse aus einer gelieferten Zahl, kein neuer Wert -
   dieselbe Ausnahme wie bei der Ringlaenge oben. */
const VERLAUF_GROESSEN = {
    km:              { name: 'Kilometer', form: (w) => zahl.format(w) + ' km' },
    fahrten:         { name: 'Fahrten',   form: (w) => String(w) },
    ausgaben_brutto: { name: 'Ausgaben',  form: (w) => euro.format(w) }
};
let verlaufGroesse = 'km';

function verlaufZeichnen(monate) {
    const ziel = document.getElementById('dashboard-verlauf');
    if (!monate.length) { ziel.replaceChildren(); return; }
    const g = VERLAUF_GROESSEN[verlaufGroesse];
    const groesst = Math.max(...monate.map((m) => Number(m[verlaufGroesse])), 0) || 1;

    const ueber = document.createElement('h3');
    ueber.textContent = `Verlauf: ${g.name}`;

    const schalter = document.createElement('div');
    schalter.className = 'verlauf-schalter';
    schalter.setAttribute('role', 'group');
    schalter.setAttribute('aria-label', 'Anzeigegröße wählen');
    for (const [schluessel, wert] of Object.entries(VERLAUF_GROESSEN)) {
        const knopf = document.createElement('button');
        knopf.type = 'button';
        knopf.textContent = wert.name;
        knopf.setAttribute('aria-pressed', String(schluessel === verlaufGroesse));
        knopf.addEventListener('click', () => { verlaufGroesse = schluessel; verlaufZeichnen(monate); });
        schalter.append(knopf);
    }

    const liste = document.createElement('ol');
    liste.className = 'verlauf-balken';
    monate.forEach((m) => {
        const wert = Number(m[verlaufGroesse]);
        const li = document.createElement('li');
        const monat = document.createElement('span');
        monat.className = 'verlauf-monat';
        // "T00:00:00" haengt eine Uhrzeit an: ein reines Datum
        // ("2026-09-01") liest JavaScript als UTC-Mitternacht, was
        // westlich von Greenwich einen Tag zu frueh anzeigen kann. Mit
        // Uhrzeit liest der Browser lokal - der Tag bleibt der aus der
        // Sicht gemeinte.
        monat.textContent = new Date(`${m.monat}T00:00:00`)
            .toLocaleDateString('de-DE', { month: 'short', year: '2-digit' });
        const spur = document.createElement('span');
        spur.className = 'verlauf-spur';
        const balken = document.createElement('span');
        balken.className = 'verlauf-wert';
        balken.style.width = `${(wert / groesst) * 100}%`;
        spur.append(balken);
        const text = document.createElement('span');
        text.className = 'verlauf-zahl';
        text.textContent = g.form(wert);
        li.append(monat, spur, text);
        liste.append(li);
    });
    ziel.replaceChildren(ueber, schalter, liste);
}

/* Nach aussen gehen nur Zahlen. Median und Bestwert sind Kennzahlen der
   Flotte, keine Personen - es gibt hier keine Bestenliste und keinen
   fremden Namen. */
function einordnungZeichnen(b) {
    const ziel = document.getElementById('dashboard-einordnung');
    const ueber = document.createElement('h3');
    ueber.textContent = 'Einordnung';

    const platz = document.createElement('p');
    platz.className = 'einordnung-platz';
    platz.textContent = `Platz ${b.rang_km} von ${b.kunden_gewertet}`;

    const erklaerung = document.createElement('p');
    erklaerung.className = 'einordnung-text';
    // "Median", nicht "Mittelwert": velocity.v_meine_bilanz.median_km_flotte
    // entsteht per percentile_cont(0.5) - das ist der Median, kein
    // arithmetisches Mittel. Die beiden Woerter benennen im Deutschen
    // unterschiedliche Kennzahlen.
    erklaerung.textContent =
        `Gewertet wird, wer mindestens eine Fahrt abgeschlossen hat. `
        + `Median der Flotte: ${zahl.format(b.median_km_flotte)} km, `
        + `Bestwert: ${zahl.format(b.bestwert_km_flotte)} km.`;

    const spur = document.createElement('div');
    spur.className = 'perzentil-spur';
    spur.setAttribute('role', 'img');
    spur.setAttribute('aria-label',
        `Eigene Kilometer ${zahl.format(b.km_gesamt)}, `
        + `besser als ${zahl.format(b.perzentil)} Prozent der gewerteten Kunden`);
    const gefuellt = document.createElement('div');
    gefuellt.className = 'perzentil-wert';
    gefuellt.style.width = `${b.perzentil}%`;
    const marke = document.createElement('span');
    marke.className = 'perzentil-marke';
    marke.style.left = `${(b.median_km_flotte / b.bestwert_km_flotte) * 100}%`;
    marke.title = 'Median der Flotte';
    spur.append(gefuellt, marke);

    ziel.replaceChildren(ueber, platz, spur, erklaerung);
}

function fahrtenZeichnen(fahrten) {
    const ziel = document.getElementById('dashboard-fahrten');
    const ueber = document.createElement('h3');
    ueber.textContent = 'Letzte Fahrten';
    if (!fahrten.length) {
        ziel.replaceChildren(ueber);
        return;
    }
    const liste = document.createElement('ul');
    liste.className = 'fahrten-liste';
    fahrten.forEach((f) => {
        const li = document.createElement('li');
        const kopf = document.createElement('span');
        kopf.className = 'fahrt-kopf';
        kopf.textContent = `${new Date(f.startzeit).toLocaleDateString('de-DE')} · `
            + `${f.typ_bezeichnung} ${f.rahmennummer}`;
        const weg = document.createElement('span');
        weg.className = 'fahrt-weg';
        weg.textContent = `${f.start_station || 'freier Start'} → ${f.end_station || 'freies Ziel'}`;
        const zahlen = document.createElement('span');
        zahlen.className = 'fahrt-zahlen';
        // Das Sternchen sagt, dass die Strecke geschaetzt ist. Ohne
        // Kennzeichnung stuende eine Schaetzung wie eine Messung da.
        zahlen.textContent = `${zahl.format(f.km)} km${f.ist_geschaetzt ? ' *' : ''} · `
            + `${f.dauer_minuten} min · ${euro.format(f.betrag_brutto)}`;
        li.append(kopf, weg, zahlen);
        liste.append(li);
    });
    ziel.replaceChildren(ueber, liste);

    // Die Fussnote nur zeigen, wenn mindestens eine der fuenf Fahrten
    // tatsaechlich geschaetzt ist - dasselbe Prinzip wie beim
    // Schaetzhinweis in bilanzZeichnen(): eine Fussnote zu einem Zeichen,
    // das gar nicht auftaucht, waere eine Behauptung ins Leere.
    if (fahrten.some((f) => f.ist_geschaetzt)) {
        const fussnote = document.createElement('p');
        fussnote.className = 'fahrten-fussnote';
        fussnote.textContent = '* Strecke geschätzt, nicht gemessen.';
        ziel.append(fussnote);
    }
}

async function dashboardZeichnen() {
    const abschnitt = document.getElementById('dashboard');
    const fehlerfeld = document.getElementById('dashboard-fehler');
    if (!abschnitt) return;

    const bilanz = await ladeBilanz();

    /* Leer ist nicht gleich kaputt. ladeListe() liefert bei einem Fehler
       ebenfalls [], und ein Ladefehler als "noch keine Fahrten"
       auszugeben hat bei den Belegen schon einmal eine halbe Stunde
       Fehlersuche gekostet. */
    const fehler = letzterLadeFehler('v_meine_bilanz');
    if (fehler) {
        fehlerfeld.textContent = 'Die Bilanz konnte nicht geladen werden.';
        fehlerfeld.hidden = false;
        abschnitt.hidden = false;
        return;
    }
    fehlerfeld.hidden = true;

    if (!bilanz) {
        abschnitt.hidden = false;
        document.getElementById('dashboard-bilanz').replaceChildren(
            Object.assign(document.createElement('p'), {
                className: 'dashboard-leer',
                textContent: 'Sobald die erste Fahrt abgeschlossen ist, steht hier die Bilanz.'
            }));
        return;
    }

    const profil = (await ladeListe('v_mein_profil'))[0] || {};
    konterfeiZeichnen(profil.vorname, profil.nachname, profil.kundennummer);
    bilanzZeichnen(bilanz);

    const monate = await ladeMonate();
    ringeZeichnen(monate);
    verlaufZeichnen(monate);
    einordnungZeichnen(bilanz);
    fahrtenZeichnen(await ladeLetzteFahrten(5));

    document.getElementById('dashboard-zeitraum').textContent =
        `${new Date(bilanz.erste_fahrt).toLocaleDateString('de-DE')} bis `
        + `${new Date(bilanz.letzte_fahrt).toLocaleDateString('de-DE')}`;

    abschnitt.hidden = false;
}
