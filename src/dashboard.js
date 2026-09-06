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
/* Fuer die vier Kacheln OHNE Nachkommastelle. Begruendung: 40 Prozent
   der Fahrten im Bestand haben keine gemessene Distanz, die Kilometer
   und damit auch die CO2-Zahl sind also teils geschaetzt. Eine
   Nachkommastelle hinter einer Schaetzung behauptet eine Genauigkeit,
   die es nicht gibt. Die genauen Werte stehen weiterhin im Verlauf und
   bei den einzelnen Fahrten. */
const ganz = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 });

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
    // Beschriftung ZUERST: sie steht ueber der Zahl, nicht darunter.
    // Den Zeilenumbruch macht weiterhin flex-basis: 100% in style.css,
    // die Reihenfolge hier bestimmt nur, welche Zeile oben liegt.
    d.append(b, w, e);
    return d;
}

function bilanzZeichnen(b) {
    const ziel = document.getElementById('dashboard-bilanz');
    ziel.replaceChildren(
        kachel(ganz.format(b.km_gesamt), 'km', 'gefahren'),
        kachel(ganz.format(b.co2_ersparnis_kg_gesamt), 'kg', 'CO₂ gespart'),
        kachel(String(b.fahrten_gesamt), '', 'Fahrten')
        /* DREI KACHELN, NICHT VIER (06.09.2026, auf Wunsch des
           Auftraggebers). Die vierte zeigte die Ausgaben. Sie ist raus,
           und zwar aus zwei Gruenden.

           Der erste ist psychologisch: die Ansicht soll zeigen, was
           jemand gefahren und eingespart hat. Ein Betrag gleich daneben,
           in derselben Groesse und demselben Gewicht, macht aus der
           Bilanz eine Rechnung. Was bezahlt wurde, ist damit nicht
           versteckt - es steht im Verlauf unter "Ausgaben", mitsamt
           Gesamtsumme, nur eben nicht als Erstes.

           Der zweite ist Platz: drei Kacheln auf derselben Spur sind
           breiter als vier, und die Zahlen wachsen. */
    );

    /* Der Schaetzanteil steht sichtbar, nicht im Kleingedruckten. 40
       Prozent der Fahrten im Bestand haben keine gemessene Distanz; ein
       Wert, der eine Schaetzung als Messung ausgibt, ist der Punkt, an
       dem ein solches Dashboard unglaubwuerdig wird.

       EIGENES ELEMENT (#dashboard-bilanz-hinweis in index.html), NICHT
       hier angehaengt: als Kind IM SELBEN auto-fit-Raster wie die vier
       Kacheln stand dieses <p> frueher per grid-column: 1/-1 quer ueber
       alle Spuren - und genau das verhinderte, dass ungenutzte auto-fit-
       Spuren zusammenfallen (siehe Kommentar bei .bilanz-hinweis in
       style.css). Das Raster legte sich dadurch auf so viele 148-Punkt-
       Spuren an, wie in die Kartenbreite passen, und die vier Kacheln
       fuellten nur die ersten vier davon - jede blieb auf ihrer
       Mindestbreite stehen, gestaucht an den linken Rand statt die Karte
       zu fuellen. Ausserhalb des Rasters hat dasselbe <p> keinen Einfluss
       mehr auf dessen Spuren. */
    const hinweis = document.getElementById('dashboard-bilanz-hinweis');
    if (b.anteil_geschaetzt > 0) {
        /* "der Kilometer", und die Sicht rechnet seit dem 06.09.2026
           auch so: anteil_geschaetzt ist nach Strecke gewichtet, nicht
           nach Fahrten. Der Satz steht unter einer Kilometerkachel und
           muss deshalb ueber Kilometer sprechen. */
        hinweis.textContent =
            `${zahl.format(b.anteil_geschaetzt * 100)} % der Kilometer sind `
            + 'geschätzt, nicht gemessen. Kilometer und CO₂ sind gerundet.';
        hinweis.hidden = false;
    } else {
        hinweis.hidden = true;
        hinweis.textContent = '';
    }
}

/* Das Konterfei ist ABGELEITET, nicht hinterlegt: keine Bilddatei, kein
   Upload, keine Spalte. Jedes Konto hat sofort eines, auch ein morgen
   angelegtes. Ein Foto kommt nicht in Frage - ein Gesicht unter einer
   erfundenen Identitaet ist keine Illustration, sondern eine Behauptung
   ueber einen Menschen. */
/* Zeichnet den Personenblock im Kopf: Konterfei UND Name. Der Name
   stand bis zum 06.09.2026 nur im aria-label des SVG - sichtbar war
   also nur "CF", und wer das Dashboard zeigt, musste dazusagen, wem es
   gehoert. */
function personZeichnen(vorname, nachname, schluessel) {
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

    // Leer statt "undefined undefined", wenn v_mein_profil nichts
    // liefert - der Kopf zeigt dann nur Ueberschrift und Konterfei.
    document.getElementById('dashboard-name').textContent =
        (vorname && nachname) ? `${vorname} ${nachname}` : '';
}

/* DIESER MONAT GEGEN DIE EIGENEN VORMONATE - ALS BALKEN, NICHT ALS RING.

   Vorher standen hier drei konzentrische Ringe. Zwei Gruende sprachen
   dagegen, beide am 06.09.2026 nachgelesen statt vermutet:

   Ein Ring zeigt Fortschritt zu einem ZIEL - sein Sinn liegt darin, dass
   er sich schliesst. Hier gibt es kein Ziel, sondern einen Vergleich mit
   dem eigenen Median; "geschlossen" bedeutet dabei nichts. Die
   Gestaltungsliteratur haelt Fortschrittsringe ausdruecklich fuer
   Abschlussgroessen bereit, nicht fuer Vergleiche.

   Und konzentrische Ringe sind untereinander gar nicht vergleichbar: das
   optische Gewicht eines Bogens haengt von seinem Radius ab, derselbe
   Anteil sieht auf dem inneren Ring kleiner aus als auf dem aeusseren.
   Dazu schaetzen Menschen Bogenlaengen ohnehin schlecht - lineare
   Laengen dagegen gut.

   Fuer einen Vergleich mit Bezugswert nennt die Literatur den
   Bullet-Chart: ein Balken fuer den Wert, eine Marke fuer den Bezug.
   Genau das steht hier - Balken bis zum Wert des laufenden Monats, Marke
   auf dem Median der Vormonate, Spurende beim besten Monat. Drei Zeilen
   mit gleicher Skala, untereinander lesbar und miteinander vergleichbar.

   Die Bezugsgroesse ist weiter der EIGENE Median, kein festes Ziel: am
   6. eines Monats stuende sonst jede Anzeige auf einem Bruchteil und das
   Dashboard zeigte an jedem Monatsanfang Versagen an. */
function monatZeichnen(monate) {
    const ziel = document.getElementById('dashboard-monat');
    if (!monate.length) { ziel.replaceChildren(); return; }

    const jetzt = new Date();
    const lauf = `${jetzt.getFullYear()}-${String(jetzt.getMonth() + 1).padStart(2, '0')}-01`;
    const aktuell = monate.find((m) => m.monat === lauf);
    const frueher = monate.filter((m) => m.monat !== lauf);
    // Kein laufender Monat oder keine Vergangenheit zum Vergleich: dann
    // gibt es keinen Bezug, gegen den zu messen waere. Ein leerer Block
    // ist hier ehrlicher als eine erfundene Zahl.
    if (!aktuell || !frueher.length) { ziel.replaceChildren(); return; }

    function median(werte) {
        const s = [...werte].sort((a, b) => a - b);
        const m = Math.floor(s.length / 2);
        return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
    }

    const groessen = [
        { feld: 'fahrten', name: 'Fahrten', einheit: '' },
        { feld: 'km',      name: 'Kilometer', einheit: ' km' },
        { feld: 'minuten', name: 'Minuten', einheit: ' min' }
    ];

    const ueber = document.createElement('h3');
    ueber.textContent = 'Dieser Monat';
    const liste = document.createElement('ul');
    liste.className = 'monat-liste';

    groessen.forEach((g) => {
        const wert  = Number(aktuell[g.feld]);
        const mitte = median(frueher.map((m) => Number(m[g.feld])));
        const best  = Math.max(...frueher.map((m) => Number(m[g.feld])), wert);
        const skala = best > 0 ? best : 1;

        const li = document.createElement('li');

        const kopf = document.createElement('div');
        kopf.className = 'monat-kopf';
        const name = document.createElement('span');
        name.className = 'monat-name';
        name.textContent = g.name;
        const zahltext = document.createElement('span');
        zahltext.className = 'monat-wert';
        zahltext.textContent = zahl.format(wert) + g.einheit;
        kopf.append(name, zahltext);

        const spur = document.createElement('div');
        spur.className = 'monat-spur';
        spur.setAttribute('role', 'img');
        spur.setAttribute('aria-label',
            `${g.name}: ${zahl.format(wert)}${g.einheit} in diesem Monat, `
            + `Median der Vormonate ${zahl.format(mitte)}${g.einheit}, `
            + `bester Monat ${zahl.format(best)}${g.einheit}`);
        const balken = document.createElement('div');
        balken.className = 'monat-balken';
        balken.style.width = `${(wert / skala) * 100}%`;
        const marke = document.createElement('span');
        marke.className = 'monat-marke';
        marke.style.left = `${(mitte / skala) * 100}%`;
        spur.append(balken, marke);

        /* Der Median steht ROT da, in genau der Farbe der Marke in der
           Spur darueber. Frueher stand ueber dem Block ein erklaerender
           Satz ("Die Marke sitzt auf dem Median ..."); die gemeinsame
           Farbe sagt dasselbe, ohne dass man es lesen muss. Der beste
           Monat bleibt grau: er braucht keine Marke, er IST das
           Spurende. */
        const fuss = document.createElement('span');
        fuss.className = 'monat-fuss';
        const median_text = document.createElement('span');
        median_text.className = 'monat-median';
        median_text.textContent = `Median ${zahl.format(mitte)}${g.einheit}`;
        const rest = document.createElement('span');
        rest.textContent = ` · bester Monat ${zahl.format(best)}${g.einheit}`;
        fuss.append(median_text, rest);

        li.append(kopf, spur, fuss);
        liste.append(li);
    });

    ziel.replaceChildren(ueber, liste);
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

    /* Der Gesamtwert steht auf HOEHE DER SCHALTER, rechts, nicht unter
       den Balken: dort gehoert er zur getroffenen Auswahl und braucht
       keine eigene Zeile. Er summiert genau die Balken darunter.

       Nicht dieselbe Zahl wie in der Kachel oben, obwohl beide alles
       umfassen: die Kachel rundet auf ganze Zahlen (siehe ganz), hier
       steht der genaue Wert. Wer es auf den Kilometer wissen will,
       findet ihn also hier. */
    const summe = monate.reduce((s, m) => s + Number(m[verlaufGroesse]), 0);
    const gesamt = document.createElement('span');
    gesamt.className = 'verlauf-gesamt';
    gesamt.textContent = `Gesamt ${g.form(summe)}`;
    schalter.append(gesamt);

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

/* STATUS-STUFEN: feste Kilometerschwellen, kein Rang und kein Perzentil.
   Ausgeloest durch die Beanstandung "dieses Diagramm kann man so nicht
   verstehen" zum bisherigen Perzentilbalken (siehe fortschrittZeichnen()
   weiter unten) und den Wunsch nach einem Status/Abzeichen fuer die
   Gamification.

   Gemessen (05.09.2026, 495 gewertete Kunden): zwischen dem schwaechsten
   Zehntel (69 km) und dem staerksten Prozent (168,7 km) liegt nur der
   Faktor 2,4. Ein Status nach RANG waere praktisch bedeutungslos - und er
   koennte fallen, ohne dass die Kundschaft selbst etwas tut, nur weil
   andere mehr gefahren sind. Was sich jemand erarbeitet hat, soll bleiben:
   deshalb feste Kilometerschwellen auf km_gesamt, kein Rang und kein
   Perzentil.

   Die vier Grenzen (90/120/150/200) sind nachgemessen, nicht geschaetzt:
   sie verteilen die 495 Kunden auf 189 | 190 | 99 | 16 | 1 - jede der
   fuenf Stufen belegt, keine schluckt zwei Drittel. Die naheliegende
   Leiter 50/100/150/200/250 ergab dagegen 276 | 202 | 16 | 1 | 0 und liess
   die oberste Stufe leer.

   Sachliche Bezeichnungen ohne Geschlecht: velocity.kunde fuehrt keins,
   jede gebeugte Form waere geraten. */
const STUFEN = [
    { ab: 0,   name: 'Gelegentlich unterwegs' },
    { ab: 90,  name: 'Regelmäßig unterwegs' },
    { ab: 120, name: 'Viel unterwegs' },
    { ab: 150, name: 'Dauerhaft unterwegs' },
    { ab: 200, name: 'An der Spitze' }
];

/* AUSDRUECKLICH BENANNTE AUSNAHME zu "das Dashboard rechnet nicht" (siehe
   Kopfkommentar dieser Datei) - sonst haelt sie spaeter jemand fuer einen
   Regelbruch: Diese Funktion ERFINDET keine Kennzahl, sie fragt nur ab,
   in welchen der oben festgelegten Bereiche km_gesamt aus v_meine_bilanz
   faellt. Dieselbe Ausnahme traegt bereits die Ringlaenge in
   monatZeichnen() und die Balkenbreite in verlaufZeichnen(): eine
   gelieferte Zahl rein darstellen, ohne einen neuen Wert zu bilden. */
function stufeIndex(km) {
    let i = 0;
    for (let j = 1; j < STUFEN.length; j++) {
        if (km >= STUFEN[j].ab) i = j;
    }
    return i;
}

/* Das Abzeichen steht NICHT hier im Block weiter unten, sondern oben im
   Kopf, neben dem Konterfei (#dashboard-abzeichen in index.html) - siehe
   dortigen Kommentar. EINE Abzeichenfarbe fuer alle fuenf Stufen
   (.status-abzeichen, Navy): "kein Pokal, kein Farbrausch" war die
   ausdrueckliche Vorgabe, nur der Text der Stufe wechselt. */
function statusabzeichenZeichnen(b) {
    const ziel = document.getElementById('dashboard-abzeichen');
    const abzeichen = document.createElement('span');
    abzeichen.className = 'status-abzeichen';

    /* Ein Stern, gezeichnet statt als Schriftzeichen gesetzt. Ein
       Emoji-Stern haette auf jedem System anders ausgesehen und in der
       Vorlesung am Beamer womoeglich als leeres Kaestchen; ein SVG-Pfad
       sieht ueberall gleich aus und nimmt per fill="currentColor" die
       Schriftfarbe des Abzeichens an.

       aria-hidden: das Zeichen sagt nichts, was der Text daneben nicht
       schon sagt. Eine Vorlesekraft soll "Viel unterwegs" hoeren, nicht
       "Stern, Viel unterwegs". */
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('class', 'status-zeichen');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    const stern = document.createElementNS(ns, 'path');
    stern.setAttribute('fill', 'currentColor');
    stern.setAttribute('d',
        'M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24'
        + 'l5.46 4.73L5.82 21z');
    svg.append(stern);

    const text = document.createElement('span');
    text.textContent = STUFEN[stufeIndex(Number(b.km_gesamt))].name;

    abzeichen.append(svg, text);
    ziel.replaceChildren(abzeichen);
}

/* Vormals ein Balken zum Flottenvergleich (Perzentil, Median, Bestwert) -
   ohne Beschriftung nicht zu verstehen, wie beanstandet ("dieses Diagramm
   kann man so nicht verstehen"). Ersetzt durch den Fortschritt zur
   naechsten Stufe: ein erreichbares eigenes Ziel statt eines Vergleichs
   mit anderen, mit beschrifteten Werten fuer aktuellen Stand, Ziel und
   verbleibende Kilometer.

   Der Rang bleibt als REINER TEXT (.rang-platz), nicht mehr als Balken:
   anders als die Stufe oben ist er weiterhin ein Vergleich mit anderen
   und koennte fallen, ohne dass die Kundschaft selbst etwas tut - deshalb
   nicht mehr die Hauptaussage des Blocks, sondern eine kleine,
   nachrangige Zusatzzeile. Median und Bestwert der Flotte entfallen
   dagegen ganz: sie erklaerten nur die Marke auf dem jetzt entfernten
   Balken und haetten ohne ihn keinen Bezugspunkt mehr. */
function fortschrittZeichnen(b) {
    const ziel = document.getElementById('dashboard-fortschritt');
    const ueber = document.createElement('h3');
    ueber.textContent = 'Fortschritt';

    const km = Number(b.km_gesamt);
    const i = stufeIndex(km);
    const aktuelle = STUFEN[i];
    const naechste = STUFEN[i + 1];

    const kopf = document.createElement('div');
    kopf.className = 'fortschritt-kopf';
    const stand = document.createElement('span');
    stand.className = 'fortschritt-stand';
    stand.textContent = `${zahl.format(km)} km`;
    const zielfeld = document.createElement('span');
    zielfeld.className = 'fortschritt-ziel';

    const spur = document.createElement('div');
    spur.className = 'fortschritt-spur';
    spur.setAttribute('role', 'img');
    const wert = document.createElement('div');
    wert.className = 'fortschritt-wert';

    const text = document.createElement('p');
    text.className = 'fortschritt-text';

    if (naechste) {
        // Fortschritt INNERHALB der aktuellen Stufe (von deren eigener
        // Untergrenze bis zur naechsten Schwelle), nicht ab 0: so beginnt
        // die Anzeige nach jedem Stufenaufstieg wieder klein und fuellt
        // sich sichtbar wieder auf - ab 0 gemessen waere der Balken kurz
        // vor dem Ziel ohnehin fast voll und der Aufstieg selbst kaum zu
        // erkennen.
        const anteil = ((km - aktuelle.ab) / (naechste.ab - aktuelle.ab)) * 100;
        wert.style.width = `${Math.max(0, Math.min(anteil, 100))}%`;
        zielfeld.textContent = `Ziel ${zahl.format(naechste.ab)} km`;
        spur.setAttribute('aria-label',
            `${zahl.format(km)} von ${zahl.format(naechste.ab)} Kilometern auf dem Weg zur Stufe ${naechste.name}`);
        text.textContent = `Noch ${zahl.format(naechste.ab - km)} km bis zur Stufe ${naechste.name}.`;
    } else {
        // Hoechste Stufe: kein Ziel mehr uebrig. Ein leerer Balken waere
        // hier die schlechteste Loesung - er saehe nach "nichts erreicht"
        // aus, bei genau umgekehrter Sachlage. Deshalb ein VOLLER Balken
        // statt eines leeren, mit eigenem Text statt einer Zielzahl, die
        // es nicht mehr gibt.
        wert.style.width = '100%';
        zielfeld.textContent = 'Höchste Stufe';
        spur.setAttribute('aria-label', `Höchste Stufe erreicht: ${aktuelle.name}, ${zahl.format(km)} km`);
        text.textContent = `Höchste Stufe erreicht: ${aktuelle.name}.`;
    }

    kopf.append(stand, zielfeld);
    spur.append(wert);

    const platz = document.createElement('p');
    platz.className = 'rang-platz';
    platz.textContent = `Platz ${b.rang_km} von ${b.kunden_gewertet}`;

    ziel.replaceChildren(ueber, kopf, spur, text, platz);
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

/* Zeichnet nur - zeigt nichts. Ob #dashboard ueberhaupt sichtbar ist,
   entscheidet ansichtAktualisieren() in script.js (Hash #konto UND
   angemeldet), nicht diese Funktion. Sie laeuft trotzdem bei jeder
   Anmeldung, nicht erst beim Aufruf von #konto: wer die Ansicht oeffnet,
   soll die Daten vorbereitet vorfinden, nicht erst auf das Netz warten. */
async function dashboardZeichnen() {
    const abschnitt = document.getElementById('dashboard');
    const fehlerfeld = document.getElementById('dashboard-fehler');
    if (!abschnitt) return;

    /* Das Konterfei ZUERST, und vor jedem Ausstieg weiter unten. Es
       leitet sich aus dem NAMEN ab, den es unabhaengig von Fahrten gibt -
       ein Konto ohne Fahrt hat trotzdem einen Inhaber. Stand es weiter
       unten, blieb der Kreis bei einem frischen Konto leer, und die
       Ansicht wirkte kaputt statt nur leer. */
    const profil = (await ladeListe('v_mein_profil'))[0] || {};
    personZeichnen(profil.vorname, profil.nachname, profil.kundennummer);

    const bilanz = await ladeBilanz();

    /* Leer ist nicht gleich kaputt. ladeListe() liefert bei einem Fehler
       ebenfalls [], und ein Ladefehler als "noch keine Fahrten"
       auszugeben hat bei den Belegen schon einmal eine halbe Stunde
       Fehlersuche gekostet. */
    const fehler = letzterLadeFehler('v_meine_bilanz');
    if (fehler) {
        fehlerfeld.textContent = 'Die Bilanz konnte nicht geladen werden.';
        fehlerfeld.hidden = false;
        return;
    }
    fehlerfeld.hidden = true;

    if (!bilanz) {
        document.getElementById('dashboard-bilanz').replaceChildren(
            Object.assign(document.createElement('p'), {
                className: 'dashboard-leer',
                textContent: 'Sobald die erste Fahrt abgeschlossen ist, steht hier die Bilanz.'
            }));
        /* Abzeichen und Fortschritt erscheinen AUCH ohne Fahrt, mit null
           Kilometern. v_meine_bilanz liefert fuer ein Konto ohne
           abgeschlossene Fahrt keine Zeile - deshalb hier ein Ersatzwert
           statt eines Ausstiegs.

           Der Grund ist der Zweck der Sache: Wer neu ist, soll sehen,
           dass es eine Leiter gibt und wie weit die erste Sprosse weg
           ist. Ein leerer Bereich zeigt kein Ziel, und ein Ziel ist das
           Einzige, was diese Anzeige zu bieten hat. Genau derselbe
           Fehler steckte zuvor im Konterfei, das aus dem Namen entsteht
           und ebenfalls hinter diesem Ausstieg lag. */
        statusabzeichenZeichnen({ km_gesamt: 0 });
        fortschrittZeichnen({ km_gesamt: 0 });
        zeitraumZeichnen(null);
        return;
    }

    bilanzZeichnen(bilanz);

    const monate = await ladeMonate();
    monatZeichnen(monate);
    verlaufZeichnen(monate);
    statusabzeichenZeichnen(bilanz);
    fortschrittZeichnen(bilanz);
    fahrtenZeichnen(await ladeLetzteFahrten(5));

    zeitraumZeichnen(bilanz);
}

/* Der Zeitraum steht DIREKT UEBER den vier Kacheln und sagt zweierlei:
   dass dort Summen stehen, und ueber welche Zeit summiert wurde. Vorher
   stand nur die nackte Datumsspanne im Kopf neben dem Konterfei - dort
   las sie sich als Angabe zur Person, nicht als Geltungsbereich der
   Zahlen darunter.

   Ausgeschriebener Monatsname statt 5.1.2025: die Zeile ist ein Satz,
   kein Datumsfeld, und in einem Satz liest sich "5. Januar 2025"
   fluessiger als eine Ziffernfolge. */
function zeitraumZeichnen(bilanz) {
    const feld = document.getElementById('dashboard-zeitraum');
    if (!bilanz || !bilanz.erste_fahrt) { feld.textContent = ''; return; }
    const tag = (wert) => new Date(wert).toLocaleDateString('de-DE',
        { day: 'numeric', month: 'long', year: 'numeric' });
    feld.textContent = `Summen über den gesamten Zeitraum, `
        + `${tag(bilanz.erste_fahrt)} bis ${tag(bilanz.letzte_fahrt)}.`;
}
