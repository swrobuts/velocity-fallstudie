// ============================================
// VeloCity - Datenzugriff
//
// Regel dieser Schicht: gelesen wird ausschliesslich aus v_-Sichten,
// geschrieben ausschliesslich ueber api_-Funktionen. Auf Basistabellen
// greift der Browser nie zu - er kaeme auch gar nicht an sie heran.
// ============================================

const supabaseClient = window.supabase.createClient(
    SUPABASE_CONFIG.url,
    SUPABASE_CONFIG.anonKey,
    { db: { schema: APP_CONFIG.schema } }
);

// Einheitliche Fehlerbehandlung: Lesefehler liefern eine leere Liste,
// damit ein Ausfall einer Sicht nicht die ganze Seite zerlegt.
/* Eine leere Liste ist eine Aussage: "es gibt nichts". Ein Fehler ist
   eine andere: "ich konnte nicht nachsehen". Beides als [] zu liefern hat
   einen fehlenden GRANT auf entgeltart als "keine Fahrten" erscheinen
   lassen - der Beleg blieb wortlos leer. Der Fehler wird jetzt gemerkt,
   damit der Aufrufer ihn unterscheiden kann. */
const ladeFehler = new Map();

async function ladeListe(quelle, spalten = '*', aufbau = (q) => q) {
    const { data, error } = await aufbau(supabaseClient.from(quelle).select(spalten));
    if (error) {
        console.error(`Fehler beim Laden von ${quelle}:`, error.message);
        ladeFehler.set(quelle, error.message);
        return [];
    }
    ladeFehler.delete(quelle);
    return data || [];
}

function letzterLadeFehler(quelle) {
    return ladeFehler.get(quelle) || null;
}

// ===== OEFFENTLICHE DATEN =====

async function fetchStations() {
    return ladeListe('v_station',
        'station_id, stationsnummer, name, strasse, hausnummer, plz, ort, ' +
        'latitude, longitude, hoehe_m, kapazitaet, verfuegbare_raeder, freie_stellplaetze');
}

async function fetchAvailableBikes() {
    return ladeListe('v_verfuegbares_fahrrad');
}

async function fetchGeschaeftsgebiete() {
    return ladeListe('v_geschaeftsgebiet');
}

async function fetchHoehenmarken() {
    return ladeListe('v_hoehenmarke');
}

async function fetchTarifkarten() {
    // Reihenfolge des Datenmodells, nicht des Preises: sonst wandern die
    // Karten bei jeder Preisaenderung durcheinander.
    return ladeListe('v_tarifkarte', '*', (q) => q.order('typ_id'));
}

async function fetchFaq() {
    return ladeListe('v_faq', '*', (q) => q.order('sortierung'));
}

async function fetchNutzungsschritte() {
    return ladeListe('v_nutzungsschritt', '*', (q) => q.order('nummer'));
}

async function fetchKennzahlen() {
    return ladeListe('v_kennzahl', '*', (q) => q.order('sortierung'));
}

// ===== EIGENE DATEN (nur angemeldet) =====

async function fetchActiveRentals() {
    return ladeListe('v_meine_ausleihe', '*', (q) => q.eq('status', 'aktiv'));
}

async function fetchRentalHistory() {
    return ladeListe('v_meine_ausleihe', '*',
        (q) => q.order('startzeit', { ascending: false }).limit(20));
}

async function fetchProfil() {
    const zeilen = await ladeListe('v_mein_profil');
    return zeilen[0] || null;
}

/* Die Preisspannen aus dem Analytics-Notebook. Gefiltert wird auf dem
   Server, nicht im Browser: Die Sicht hat gut hundert Zeilen, aber der
   Grundsatz ist derselbe wie ueberall - es kommt nur, was gebraucht wird.

   Findet sich keine Zeile, gibt es fuer diese Verbindung KEINE Schaetzung.
   Das ist der Normalfall und kein Fehler: Rundfahrten und Verbindungen
   mit zu breiter Streuung stehen absichtlich nicht in der Tabelle. */
async function fetchPreisspanne(startstation, zielstation, typCode, zeitfenster) {
    const zeilen = await ladeListe('v_preisschaetzung', '*', (q) => q
        .eq('startstation', startstation)
        .eq('zielstation', zielstation)
        .eq('typ_code', typCode)
        .eq('zeitfenster', zeitfenster));
    return zeilen[0] || null;
}

/* Alle Zielstationen, fuer die es von dieser Startstation aus IM
   GEWAEHLTEN ZEITFENSTER eine Schaetzung gibt. Die Auswahlliste zeigt
   nur, was auch beantwortet werden kann - eine Liste voller Eintraege,
   die dann "keine Schaetzung" melden, waere eine Zumutung.

   Das Zeitfenster fehlte hier bis zum 03.09.2026. Die Liste zeigte jede
   Verbindung, fuer die es IRGENDWANN eine Schaetzung gibt, gesucht wurde
   dann fuer die aktuelle Tageszeit. Wer abends ein E-Bike waehlte, bekam
   eine gefuellte Liste und danach immer "Fuer diese Verbindung schaetzen
   wir nicht" - im Fenster "abend" stehen nur City-Zeilen. Genau die
   Sackgasse, die der Absatz darueber vermeiden will. */
async function fetchSchaetzbareZiele(startstation, typCode, zeitfenster) {
    const zeilen = await ladeListe('v_preisschaetzung', 'zielstation', (q) => q
        .eq('startstation', startstation)
        .eq('typ_code', typCode)
        .eq('zeitfenster', zeitfenster)
        .order('zielstation'));
    return [...new Set(zeilen.map(z => z.zielstation))];
}

/* In welchen Zeitfenstern gibt es fuer diesen Radtyp ueberhaupt etwas?

   Die Datenlage ist je Fenster verschieden - abends liegen am wenigsten
   Fahrten vor. Statt den Nutzer an die Uhr zu binden, bekommt er die
   Fenster zur Auswahl, und zwar nur die, die eine Antwort haben. */
async function fetchSchaetzbareFenster(typCode) {
    const zeilen = await ladeListe('v_preisschaetzung', 'zeitfenster', (q) => q
        .eq('typ_code', typCode));
    return new Set(zeilen.map(z => z.zeitfenster));
}

/* Welche Radtypen haben ueberhaupt eine Schaetzung?

   Gefragt wird EINMAL beim Anmelden, nicht je Kachel: Die Antwort
   entscheidet, ob der Schaetzknopf ueberhaupt anklickbar ist. Ein Knopf,
   der sich oeffnen laesst und dann "keine Schaetzung" meldet, hat den
   Menschen zweimal beschaeftigt und einmal enttaeuscht. */
async function fetchSchaetzbareTypen() {
    const zeilen = await ladeListe('v_preisschaetzung', 'typ_code');
    return new Set(zeilen.map(z => z.typ_code));
}

/* Startstationen, von denen aus es im gewaehlten Zeitfenster
   Schaetzungen gibt - aus demselben Grund wie bei den Zielen. */
async function fetchSchaetzbareStarts(typCode, zeitfenster) {
    const zeilen = await ladeListe('v_preisschaetzung', 'startstation', (q) => q
        .eq('typ_code', typCode)
        .eq('zeitfenster', zeitfenster)
        .order('startstation'));
    return [...new Set(zeilen.map(z => z.startstation))];
}

// ===== SCHREIBENDE VORGAENGE =====

// Legt bei Bedarf den Kundensatz zum angemeldeten Konto an. Idempotent,
// wird nach jedem Login aufgerufen. Ersetzt den frueheren Trigger auf
// auth.users - ein Fremdschema fasst diese Anwendung nicht an.
async function ensureKunde() {
    const { data, error } = await supabaseClient.rpc('api_kunde_sicherstellen');
    if (error) {
        console.error('Kundensatz konnte nicht sichergestellt werden:', error.message);
        return null;
    }
    return Array.isArray(data) ? data[0] : data;
}

/* Den Preisschaetzer ein- oder ausschalten. Die Einstellung haengt am
   Konto, nicht am Geraet - deshalb eine api-Funktion und kein
   localStorage. */
async function setzePreisschaetzer(an) {
    const { data, error } = await supabaseClient.rpc('api_preisschaetzer_umschalten', {
        p_an: an
    });
    if (error) {
        console.error('Preisschätzer konnte nicht umgeschaltet werden:', error.message);
        return null;
    }
    return Array.isArray(data) ? data[0] : data;
}

async function startRental(fahrradId) {
    const { data, error } = await supabaseClient.rpc('api_ausleihe_starten', {
        p_fahrrad_id: fahrradId
    });
    if (error) throw new Error(error.message);

    const ergebnis = Array.isArray(data) ? data[0] : data;
    if (!ergebnis || !ergebnis.ausleihe_id) {
        throw new Error(ergebnis?.meldung || 'Ausleihe konnte nicht gestartet werden');
    }
    return ergebnis;
}

async function endRental(ausleiheId, stationId = null, latitude = null, longitude = null) {
    const { data, error } = await supabaseClient.rpc('api_ausleihe_beenden', {
        p_ausleihe_id: ausleiheId,
        p_end_station_id: stationId,
        p_latitude: latitude,
        p_longitude: longitude
    });
    if (error) throw new Error(error.message);

    const ergebnis = Array.isArray(data) ? data[0] : data;
    if (!ergebnis || ergebnis.gesamtbetrag === null) {
        throw new Error(ergebnis?.meldung || 'Ausleihe konnte nicht beendet werden');
    }
    return ergebnis;
}
