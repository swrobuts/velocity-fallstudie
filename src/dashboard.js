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

    document.getElementById('dashboard-zeitraum').textContent =
        `${new Date(bilanz.erste_fahrt).toLocaleDateString('de-DE')} bis `
        + `${new Date(bilanz.letzte_fahrt).toLocaleDateString('de-DE')}`;

    abschnitt.hidden = false;
}
