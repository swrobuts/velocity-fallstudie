-- ============================================
-- VeloCity Supabase Integration - Database Setup
-- Fuehre dieses Script auf deinem VPS aus
-- ============================================

-- 1. Mapping-Tabelle: Supabase Auth UUID <-> Kunde ID
-- ============================================
CREATE TABLE IF NOT EXISTS "cityBikesRental".auth_kunde_mapping (
    auth_uid UUID PRIMARY KEY,
    kunde_id INTEGER NOT NULL REFERENCES "cityBikesRental".kunde(kunde_id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mapping_kunde ON "cityBikesRental".auth_kunde_mapping(kunde_id);

-- 2. Trigger-Funktion: Automatisch Kunde anlegen bei Registrierung
-- ============================================
CREATE OR REPLACE FUNCTION "cityBikesRental".handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    v_kunde_id INTEGER;
BEGIN
    -- Neuen Kunden anlegen
    INSERT INTO "cityBikesRental".kunde (
        email,
        passwort_hash,
        vorname,
        nachname,
        registriert_am,
        aktiv
    ) VALUES (
        NEW.email,
        'SUPABASE_AUTH',
        COALESCE(NEW.raw_user_meta_data->>'vorname', 'Unbekannt'),
        COALESCE(NEW.raw_user_meta_data->>'nachname', 'Unbekannt'),
        NOW(),
        true
    ) RETURNING kunde_id INTO v_kunde_id;

    -- Mapping erstellen
    INSERT INTO "cityBikesRental".auth_kunde_mapping (auth_uid, kunde_id)
    VALUES (NEW.id, v_kunde_id);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger erstellen (falls nicht existiert)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION "cityBikesRental".handle_new_user();

-- 3. Helper-Funktion: Kunde-ID des aktuellen Users holen
-- ============================================
CREATE OR REPLACE FUNCTION "cityBikesRental".get_kunde_id()
RETURNS INTEGER AS $$
    SELECT kunde_id FROM "cityBikesRental".auth_kunde_mapping
    WHERE auth_uid = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 4. Row Level Security aktivieren
-- ============================================

-- Station (oeffentlich lesbar)
ALTER TABLE "cityBikesRental".station ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Stationen oeffentlich lesbar" ON "cityBikesRental".station;
CREATE POLICY "Stationen oeffentlich lesbar" ON "cityBikesRental".station
    FOR SELECT TO anon, authenticated USING (aktiv = true);

-- Fahrrad (oeffentlich lesbar)
ALTER TABLE "cityBikesRental".fahrrad ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Fahrraeder oeffentlich lesbar" ON "cityBikesRental".fahrrad;
CREATE POLICY "Fahrraeder oeffentlich lesbar" ON "cityBikesRental".fahrrad
    FOR SELECT TO anon, authenticated USING (true);

-- Fahrradtyp (oeffentlich lesbar)
ALTER TABLE "cityBikesRental".fahrradtyp ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Typen oeffentlich lesbar" ON "cityBikesRental".fahrradtyp;
CREATE POLICY "Typen oeffentlich lesbar" ON "cityBikesRental".fahrradtyp
    FOR SELECT TO anon, authenticated USING (true);

-- Tarif (oeffentlich lesbar)
ALTER TABLE "cityBikesRental".tarif ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tarife oeffentlich lesbar" ON "cityBikesRental".tarif;
CREATE POLICY "Tarife oeffentlich lesbar" ON "cityBikesRental".tarif
    FOR SELECT TO anon, authenticated USING (true);

-- Ausleihe (nur eigene)
ALTER TABLE "cityBikesRental".ausleihe ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Eigene Ausleihen lesen" ON "cityBikesRental".ausleihe;
CREATE POLICY "Eigene Ausleihen lesen" ON "cityBikesRental".ausleihe
    FOR SELECT TO authenticated
    USING (kunde_id = "cityBikesRental".get_kunde_id());

-- Kunde (nur eigene Daten)
ALTER TABLE "cityBikesRental".kunde ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Eigene Kundendaten lesen" ON "cityBikesRental".kunde;
CREATE POLICY "Eigene Kundendaten lesen" ON "cityBikesRental".kunde
    FOR SELECT TO authenticated
    USING (kunde_id = "cityBikesRental".get_kunde_id());

-- Mapping-Tabelle (nur eigenes)
ALTER TABLE "cityBikesRental".auth_kunde_mapping ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Eigenes Mapping lesen" ON "cityBikesRental".auth_kunde_mapping;
CREATE POLICY "Eigenes Mapping lesen" ON "cityBikesRental".auth_kunde_mapping
    FOR SELECT TO authenticated USING (auth_uid = auth.uid());

-- 5. API-Wrapper fuer Ausleihe starten
-- ============================================
CREATE OR REPLACE FUNCTION "cityBikesRental".fn_ausleihe_starten_api(p_fahrrad_id INTEGER)
RETURNS TABLE(ausleihe_id INTEGER, status_msg TEXT) AS $$
DECLARE
    v_kunde_id INTEGER;
BEGIN
    -- Kunde-ID aus Mapping holen
    SELECT kunde_id INTO v_kunde_id
    FROM "cityBikesRental".auth_kunde_mapping
    WHERE auth_uid = auth.uid();

    IF v_kunde_id IS NULL THEN
        RETURN QUERY SELECT NULL::INTEGER, 'Nicht authentifiziert'::TEXT;
        RETURN;
    END IF;

    -- Bestehende Funktion aufrufen
    RETURN QUERY SELECT * FROM "cityBikesRental".fn_ausleihe_starten(v_kunde_id, p_fahrrad_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. API-Wrapper fuer Ausleihe beenden
-- ============================================
CREATE OR REPLACE FUNCTION "cityBikesRental".fn_ausleihe_beenden_api(
    p_ausleihe_id INTEGER,
    p_end_station_id INTEGER
)
RETURNS TABLE(berechnete_kosten NUMERIC, status_msg TEXT) AS $$
DECLARE
    v_kunde_id INTEGER;
    v_ausleihe_kunde INTEGER;
BEGIN
    -- Kunde-ID aus Mapping holen
    SELECT kunde_id INTO v_kunde_id
    FROM "cityBikesRental".auth_kunde_mapping
    WHERE auth_uid = auth.uid();

    IF v_kunde_id IS NULL THEN
        RETURN QUERY SELECT NULL::NUMERIC, 'Nicht authentifiziert'::TEXT;
        RETURN;
    END IF;

    -- Pruefen ob Ausleihe dem Kunden gehoert
    SELECT kunde_id INTO v_ausleihe_kunde
    FROM "cityBikesRental".ausleihe
    WHERE ausleihe_id = p_ausleihe_id;

    IF v_ausleihe_kunde IS NULL OR v_ausleihe_kunde != v_kunde_id THEN
        RETURN QUERY SELECT NULL::NUMERIC, 'Keine Berechtigung fuer diese Ausleihe'::TEXT;
        RETURN;
    END IF;

    RETURN QUERY SELECT * FROM "cityBikesRental".fn_ausleihe_beenden(p_ausleihe_id, p_end_station_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Berechtigungen fuer authentifizierte User
-- ============================================
GRANT USAGE ON SCHEMA "cityBikesRental" TO anon, authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA "cityBikesRental" TO anon, authenticated;
GRANT EXECUTE ON FUNCTION "cityBikesRental".fn_ausleihe_starten_api TO authenticated;
GRANT EXECUTE ON FUNCTION "cityBikesRental".fn_ausleihe_beenden_api TO authenticated;
GRANT EXECUTE ON FUNCTION "cityBikesRental".get_kunde_id TO authenticated;

-- 8. View fuer verfuegbare Fahrraeder mit Koordinaten (API-freundlich)
-- ============================================
CREATE OR REPLACE VIEW "cityBikesRental".v_bikes_available AS
SELECT
    f.fahrrad_id,
    f.rahmennummer,
    f.status,
    ft.typ_id,
    ft.bezeichnung AS typ_name,
    ft.hat_elektro,
    ft.startgebuehr,
    ft.preis_pro_minute,
    ft.tageshoechstpreis,
    s.station_id,
    s.name AS station_name,
    s.latitude,
    s.longitude
FROM "cityBikesRental".fahrrad f
JOIN "cityBikesRental".fahrradtyp ft ON f.typ_id = ft.typ_id
JOIN "cityBikesRental".station s ON f.station_id = s.station_id
WHERE f.status = 'verfuegbar' AND s.aktiv = true;

GRANT SELECT ON "cityBikesRental".v_bikes_available TO anon, authenticated;

-- ============================================
-- FERTIG!
-- Teste mit: SELECT * FROM "cityBikesRental".v_bikes_available LIMIT 5;
-- ============================================
