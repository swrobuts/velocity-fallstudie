// ============================================
// VeloCity Warenwirtschaft — Datenzugriff
//
// Regel dieser Schicht, dieselbe wie bei der Website: gelesen wird
// ausschliesslich aus v_wawi-Sichten, geschrieben ausschliesslich ueber
// api_-Funktionen. Auf Basistabellen greift der Browser nie zu - er
// kaeme auch gar nicht an sie heran, tools/abnahme.sh prueft das von
// aussen.
// ============================================

const supabaseClient = window.supabase.createClient(
    SUPABASE_CONFIG.url,
    SUPABASE_CONFIG.anonKey,
    { db: { schema: WAWI_CONFIG.schema } }
);

// Eine leere Liste ist eine Aussage: "es gibt nichts". Ein Fehler ist
// eine andere: "ich konnte nicht nachsehen". Auf der Website hat das
// Zusammenwerfen beider Faelle einmal einen fehlenden GRANT als "keine
// Fahrten" erscheinen lassen - der Beleg blieb wortlos leer. Hier ist es
// noch heikler: die v_wawi-Sichten liefern bei fehlender ROLLE ebenfalls
// null Zeilen, voellig fehlerfrei. Drei Zustaende, die gleich aussehen
// und verschieden bedeuten.
const ladeFehler = new Map();

// Wettlaufschutz: ruft jemand ladeListe zweimal hintereinander fuer
// dieselbe Quelle auf, bevor die erste Antwort da ist - ab Aufgabe 2
// passiert das real, sobald jemand schnell zwischen Arbeitsbereichen
// wechselt -, koennen die beiden Antworten in beliebiger Reihenfolge
// zurueckkommen. Ohne diesen Zaehler wuerde die zuletzt eintreffende
// Antwort den ladeFehler-Eintrag setzen, selbst wenn sie zur AELTEREN
// der beiden Anfragen gehoert - und wuerde damit den Stand der neueren
// Anfrage ueberschreiben. Jede Anfrage merkt sich beim Start den dann
// aktuellen Zaehlerstand; kommt sie zurueck, waehrend fuer dieselbe
// Quelle laengst eine neuere Anfrage laeuft, wird ihr Eintrag verworfen.
const ladeZaehler = new Map();

async function ladeListe(quelle, spalten = '*', aufbau = (q) => q) {
    const eigenerZaehler = (ladeZaehler.get(quelle) || 0) + 1;
    ladeZaehler.set(quelle, eigenerZaehler);

    const { data, error } = await aufbau(supabaseClient.from(quelle).select(spalten));

    const nochAktuell = ladeZaehler.get(quelle) === eigenerZaehler;
    if (error) {
        console.error(`Fehler beim Laden von ${quelle}:`, error.message);
        if (nochAktuell) ladeFehler.set(quelle, error.message);
        return [];
    }
    if (nochAktuell) ladeFehler.delete(quelle);
    return data || [];
}

function letzterLadeFehler(quelle) {
    return ladeFehler.get(quelle) || null;
}

// Fuer Uebersichtskacheln, die eine GESAMTZAHL brauchen, ohne dafuer die
// zugehoerigen Zeilen zu laden (Gestaltungsauftrag, Punkt 1): "1014
// Kunden, davon 519 gesperrt" gilt unabhaengig vom Suchtext UND von der
// 200er-Grenze der Kundenliste (siehe kundenUebersicht() in kunden.js) -
// eine Kachel, die das aus den geladenen (hoechstens 200) Zeilen
// herleitete, zeigte bei 1014 Kunden einen falschen, von der
// Nachname-Sortierung abhaengigen Zufallswert statt der echten Zahl.
// PostgREST liefert die Gesamtzahl einer Abfrage OHNE ihre Zeilen ueber
// { count: 'exact', head: true } - ein Zaehl-Request ist um
// Groessenordnungen billiger, als 1014 Zeilen zu laden, nur um sie zu
// zaehlen.
async function zaehleZeilen(quelle, aufbau = (q) => q) {
    const { count, error } = await aufbau(
        supabaseClient.from(quelle).select('*', { count: 'exact', head: true }));
    if (error) {
        console.error(`Fehler beim Zaehlen von ${quelle}:`, error.message);
        return null;
    }
    return count;
}

// Schreibende Aufrufe. Anders als beim Lesen wird der Fehler NICHT
// geschluckt: wer bucht, muss wissen, ob die Buchung angekommen ist.
async function rufeAuf(funktion, argumente = {}) {
    const { data, error } = await supabaseClient.rpc(funktion, argumente);
    if (error) {
        throw new Error(uebersetzeFehler(error.message));
    }
    return data;
}

// Die Datenbank meldet fachliche Fehler im Klartext, aber technische in
// PostgreSQL-Sprache. Beides landet sonst wortgleich in der Statuszeile.
function uebersetzeFehler(meldung) {
    if (meldung.includes('Rolle') && meldung.includes('erforderlich')) {
        return meldung;   // fachlich, schon verstaendlich
    }
    if (meldung.includes('permission denied')) {
        return 'Dafuer fehlt die Berechtigung.';
    }
    if (meldung.includes('duplicate key')) {
        return 'Dieser Wert ist bereits vergeben.';
    }
    if (meldung.includes('violates check constraint')) {
        return 'Die Eingabe verletzt eine Geschaeftsregel.';
    }
    return meldung;
}
