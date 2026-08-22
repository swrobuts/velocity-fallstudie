-- ============================================
-- VeloCity - Fahrrad-Koordinaten Fix
-- Dieses Script:
-- 1. Fuegt latitude/longitude zur fahrrad-Tabelle hinzu
-- 2. Aktualisiert die View v_bikes_available
-- 3. Generiert Testdaten mit Koordinaten in Wuerzburg
-- ============================================

-- 1. Spalten zur Fahrrad-Tabelle hinzufuegen (falls nicht vorhanden)
-- ============================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'cityBikesRental'
        AND table_name = 'fahrrad'
        AND column_name = 'latitude'
    ) THEN
        ALTER TABLE "cityBikesRental".fahrrad ADD COLUMN latitude DECIMAL(10, 8);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'cityBikesRental'
        AND table_name = 'fahrrad'
        AND column_name = 'longitude'
    ) THEN
        ALTER TABLE "cityBikesRental".fahrrad ADD COLUMN longitude DECIMAL(11, 8);
    END IF;
END $$;

-- 2. View aktualisieren - bevorzugt Fahrrad-Koordinaten, Fallback auf Station
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
    -- Bevorzuge Fahrrad-Koordinaten, sonst Station-Koordinaten
    COALESCE(f.latitude, s.latitude) AS latitude,
    COALESCE(f.longitude, s.longitude) AS longitude
FROM "cityBikesRental".fahrrad f
JOIN "cityBikesRental".fahrradtyp ft ON f.typ_id = ft.typ_id
LEFT JOIN "cityBikesRental".station s ON f.station_id = s.station_id
WHERE f.status = 'verfuegbar';

GRANT SELECT ON "cityBikesRental".v_bikes_available TO anon, authenticated;

-- 3. Testdaten: Wuerzburg Zentrum mit realistischen Standorten
-- ============================================
-- Wuerzburg Zentrum: ca. 49.7913, 9.9534
-- Wir verteilen Bikes in einem Radius von ca. 2km

-- Erst alle bestehenden Bikes ohne Koordinaten mit zufaelligen Wuerzburg-Koordinaten versehen
UPDATE "cityBikesRental".fahrrad
SET
    latitude = 49.7913 + (random() - 0.5) * 0.03,
    longitude = 9.9534 + (random() - 0.5) * 0.04
WHERE latitude IS NULL
AND status = 'verfuegbar';

-- 4. Spezifische Standorte fuer einige Bikes (bekannte Orte in Wuerzburg)
-- ============================================

-- Hubland Campus (Universitaet)
UPDATE "cityBikesRental".fahrrad
SET latitude = 49.7832, longitude = 9.9720
WHERE fahrrad_id IN (SELECT fahrrad_id FROM "cityBikesRental".fahrrad WHERE status = 'verfuegbar' ORDER BY fahrrad_id LIMIT 5 OFFSET 0);

-- Hauptbahnhof
UPDATE "cityBikesRental".fahrrad
SET latitude = 49.8019, longitude = 9.9359
WHERE fahrrad_id IN (SELECT fahrrad_id FROM "cityBikesRental".fahrrad WHERE status = 'verfuegbar' ORDER BY fahrrad_id LIMIT 5 OFFSET 5);

-- Alte Mainbruecke
UPDATE "cityBikesRental".fahrrad
SET latitude = 49.7925, longitude = 9.9286
WHERE fahrrad_id IN (SELECT fahrrad_id FROM "cityBikesRental".fahrrad WHERE status = 'verfuegbar' ORDER BY fahrrad_id LIMIT 5 OFFSET 10);

-- Residenz
UPDATE "cityBikesRental".fahrrad
SET latitude = 49.7933, longitude = 9.9392
WHERE fahrrad_id IN (SELECT fahrrad_id FROM "cityBikesRental".fahrrad WHERE status = 'verfuegbar' ORDER BY fahrrad_id LIMIT 5 OFFSET 15);

-- Sanderring (Uni)
UPDATE "cityBikesRental".fahrrad
SET latitude = 49.7876, longitude = 9.9356
WHERE fahrrad_id IN (SELECT fahrrad_id FROM "cityBikesRental".fahrrad WHERE status = 'verfuegbar' ORDER BY fahrrad_id LIMIT 5 OFFSET 20);

-- Dom
UPDATE "cityBikesRental".fahrrad
SET latitude = 49.7918, longitude = 9.9325
WHERE fahrrad_id IN (SELECT fahrrad_id FROM "cityBikesRental".fahrrad WHERE status = 'verfuegbar' ORDER BY fahrrad_id LIMIT 5 OFFSET 25);

-- Juliuspromenade
UPDATE "cityBikesRental".fahrrad
SET latitude = 49.7962, longitude = 9.9312
WHERE fahrrad_id IN (SELECT fahrrad_id FROM "cityBikesRental".fahrrad WHERE status = 'verfuegbar' ORDER BY fahrrad_id LIMIT 5 OFFSET 30);

-- Zellerau
UPDATE "cityBikesRental".fahrrad
SET latitude = 49.8054, longitude = 9.9198
WHERE fahrrad_id IN (SELECT fahrrad_id FROM "cityBikesRental".fahrrad WHERE status = 'verfuegbar' ORDER BY fahrrad_id LIMIT 5 OFFSET 35);

-- ============================================
-- 5. Verifizierung
-- ============================================
-- Zaehle Bikes mit Koordinaten
SELECT
    COUNT(*) AS total_bikes,
    COUNT(latitude) AS bikes_with_coords,
    COUNT(*) - COUNT(latitude) AS bikes_without_coords
FROM "cityBikesRental".fahrrad
WHERE status = 'verfuegbar';

-- Zeige Beispiel-Bikes
SELECT fahrrad_id, rahmennummer, latitude, longitude, status
FROM "cityBikesRental".fahrrad
WHERE status = 'verfuegbar' AND latitude IS NOT NULL
LIMIT 10;
