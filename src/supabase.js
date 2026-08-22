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
async function ladeListe(quelle, spalten = '*', aufbau = (q) => q) {
    const { data, error } = await aufbau(supabaseClient.from(quelle).select(spalten));
    if (error) {
        console.error(`Fehler beim Laden von ${quelle}:`, error.message);
        return [];
    }
    return data || [];
}

// ===== OEFFENTLICHE DATEN =====

async function fetchStations() {
    return ladeListe('v_station',
        'station_id, stationsnummer, name, strasse, hausnummer, plz, ort, ' +
        'latitude, longitude, kapazitaet, verfuegbare_raeder, freie_stellplaetze');
}

async function fetchAvailableBikes() {
    return ladeListe('v_verfuegbares_fahrrad');
}

async function fetchTarifkarten() {
    return ladeListe('v_tarifkarte', '*', (q) => q.order('preis_pro_minute'));
}

async function fetchTarife() {
    return ladeListe('v_tarif', '*', (q) => q.order('monatspreis'));
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
