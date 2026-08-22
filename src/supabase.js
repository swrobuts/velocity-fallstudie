// ============================================
// VeloCity - Supabase Datenbank-Funktionen
// ============================================

// Supabase Client initialisieren
const supabaseClient = window.supabase.createClient(
    SUPABASE_CONFIG.url,
    SUPABASE_CONFIG.anonKey,
    {
        db: { schema: APP_CONFIG.schema }
    }
);

// ===== STATIONEN LADEN =====
async function fetchStations() {
    const { data, error } = await supabaseClient
        .from('station')
        .select('station_id, name, strasse, hausnummer, plz, ort, kapazitaet, latitude, longitude')
        .eq('aktiv', true);

    if (error) {
        console.error('Fehler beim Laden der Stationen:', error);
        return [];
    }
    return data || [];
}

// ===== VERFUEGBARE FAHRRAEDER LADEN =====
async function fetchAvailableBikes() {
    const { data, error } = await supabaseClient
        .from('v_bikes_available')
        .select('*');

    if (error) {
        console.error('Fehler beim Laden der Fahrraeder:', error);
        return [];
    }
    return data || [];
}

// ===== FAHRRADTYPEN MIT PREISEN =====
async function fetchBikeTypes() {
    const { data, error } = await supabaseClient
        .from('fahrradtyp')
        .select('typ_id, bezeichnung, beschreibung, startgebuehr, preis_pro_minute, tageshoechstpreis, hat_elektro');

    if (error) {
        console.error('Fehler beim Laden der Fahrradtypen:', error);
        return [];
    }
    return data || [];
}

// ===== TARIFE LADEN =====
async function fetchTarife() {
    const { data, error } = await supabaseClient
        .from('tarif')
        .select('*');

    if (error) {
        console.error('Fehler beim Laden der Tarife:', error);
        return [];
    }
    return data || [];
}

// ===== AUSLEIHE STARTEN =====
async function startRental(fahrradId) {
    const { data, error } = await supabaseClient
        .rpc('fn_ausleihe_starten_api', {
            p_fahrrad_id: fahrradId
        });

    if (error) {
        console.error('Fehler beim Starten der Ausleihe:', error);
        throw new Error(error.message || 'Ausleihe konnte nicht gestartet werden');
    }

    // RPC gibt Array zurueck
    const result = Array.isArray(data) ? data[0] : data;

    if (!result || !result.ausleihe_id) {
        throw new Error(result?.status_msg || 'Unbekannter Fehler');
    }

    return result;
}

// ===== AUSLEIHE BEENDEN =====
async function endRental(ausleiheId, endStationId) {
    const { data, error } = await supabaseClient
        .rpc('fn_ausleihe_beenden_api', {
            p_ausleihe_id: ausleiheId,
            p_end_station_id: endStationId
        });

    if (error) {
        console.error('Fehler beim Beenden der Ausleihe:', error);
        throw new Error(error.message || 'Ausleihe konnte nicht beendet werden');
    }

    const result = Array.isArray(data) ? data[0] : data;

    if (result?.status_msg && result.status_msg.includes('Fehler')) {
        throw new Error(result.status_msg);
    }

    return result;
}

// ===== AKTIVE AUSLEIHEN DES AKTUELLEN KUNDEN =====
async function fetchActiveRentals() {
    const { data, error } = await supabaseClient
        .from('ausleihe')
        .select(`
            ausleihe_id,
            startzeit,
            start_station_id,
            fahrrad:fahrrad_id (
                fahrrad_id,
                rahmennummer,
                fahrradtyp:typ_id (
                    bezeichnung,
                    preis_pro_minute
                )
            ),
            station:start_station_id (
                name
            )
        `)
        .eq('status', 'aktiv');

    if (error) {
        console.error('Fehler beim Laden der aktiven Ausleihen:', error);
        return [];
    }
    return data || [];
}

// ===== AUSLEIHE-HISTORIE DES KUNDEN =====
async function fetchRentalHistory() {
    const { data, error } = await supabaseClient
        .from('ausleihe')
        .select(`
            ausleihe_id,
            startzeit,
            endzeit,
            dauer_minuten,
            kosten,
            status,
            fahrrad:fahrrad_id (
                rahmennummer,
                fahrradtyp:typ_id (bezeichnung)
            ),
            start_station:start_station_id (name),
            end_station:end_station_id (name)
        `)
        .order('startzeit', { ascending: false })
        .limit(20);

    if (error) {
        console.error('Fehler beim Laden der Historie:', error);
        return [];
    }
    return data || [];
}
