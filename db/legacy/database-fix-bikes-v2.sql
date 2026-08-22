-- ============================================
-- VeloCity - Fahrrad-Koordinaten Fix v2
-- Verteilt ALLE Bikes mit individuellen Koordinaten
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

-- 2. View aktualisieren
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
    COALESCE(f.latitude, s.latitude) AS latitude,
    COALESCE(f.longitude, s.longitude) AS longitude
FROM "cityBikesRental".fahrrad f
JOIN "cityBikesRental".fahrradtyp ft ON f.typ_id = ft.typ_id
LEFT JOIN "cityBikesRental".station s ON f.station_id = s.station_id
WHERE f.status = 'verfuegbar';

GRANT SELECT ON "cityBikesRental".v_bikes_available TO anon, authenticated;

-- 3. ALLE verfuegbaren Bikes mit INDIVIDUELLEN zufaelligen Koordinaten versehen
-- ============================================
-- Wuerzburg Zentrum: 49.7913, 9.9534
-- Radius ca. 2-3 km

UPDATE "cityBikesRental".fahrrad
SET
    -- Jedes Bike bekommt eigene zufaellige Koordinaten
    latitude = 49.7913 + (random() - 0.5) * 0.035,
    longitude = 9.9534 + (random() - 0.5) * 0.045
WHERE status = 'verfuegbar';

-- 4. Verifizierung - Zaehle und zeige Ergebnisse
-- ============================================
DO $$
DECLARE
    total_count INTEGER;
    with_coords INTEGER;
BEGIN
    SELECT COUNT(*), COUNT(latitude)
    INTO total_count, with_coords
    FROM "cityBikesRental".fahrrad
    WHERE status = 'verfuegbar';

    RAISE NOTICE '===========================================';
    RAISE NOTICE 'Verfuegbare Bikes gesamt: %', total_count;
    RAISE NOTICE 'Davon mit Koordinaten: %', with_coords;
    RAISE NOTICE '===========================================';
END $$;

-- Zeige 20 Beispiel-Bikes mit ihren Koordinaten
SELECT fahrrad_id, rahmennummer, latitude, longitude
FROM "cityBikesRental".fahrrad
WHERE status = 'verfuegbar' AND latitude IS NOT NULL
ORDER BY fahrrad_id
LIMIT 20;

-- Pruefe die View
SELECT COUNT(*) AS bikes_in_view,
       COUNT(latitude) AS with_latitude
FROM "cityBikesRental".v_bikes_available;
