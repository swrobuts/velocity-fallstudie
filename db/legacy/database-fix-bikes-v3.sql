-- ============================================
-- VeloCity - Fahrrad-Koordinaten Fix v3
-- WICHTIG: Dieses Script muss als superuser/postgres ausgefuehrt werden
-- ============================================

-- 1. Zuerst pruefen wir den aktuellen Zustand
-- ============================================
SELECT 'VORHER - Bikes mit Koordinaten:' AS info;
SELECT COUNT(*) AS total,
       COUNT(latitude) AS mit_lat,
       COUNT(longitude) AS mit_lon
FROM "cityBikesRental".fahrrad;

-- 2. RLS temporaer deaktivieren falls aktiv
-- ============================================
ALTER TABLE "cityBikesRental".fahrrad DISABLE ROW LEVEL SECURITY;

-- 3. Sicherstellen dass Spalten existieren
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
        RAISE NOTICE 'Spalte latitude hinzugefuegt';
    ELSE
        RAISE NOTICE 'Spalte latitude existiert bereits';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'cityBikesRental'
        AND table_name = 'fahrrad'
        AND column_name = 'longitude'
    ) THEN
        ALTER TABLE "cityBikesRental".fahrrad ADD COLUMN longitude DECIMAL(11, 8);
        RAISE NOTICE 'Spalte longitude hinzugefuegt';
    ELSE
        RAISE NOTICE 'Spalte longitude existiert bereits';
    END IF;
END $$;

-- 4. ALLE Bikes updaten (nicht nur verfuegbare)
-- Wuerzburg Zentrum: 49.7913, 9.9534
-- ============================================
UPDATE "cityBikesRental".fahrrad
SET
    latitude = 49.7913 + (random() - 0.5) * 0.035,
    longitude = 9.9534 + (random() - 0.5) * 0.045;

-- 5. RLS wieder aktivieren
-- ============================================
ALTER TABLE "cityBikesRental".fahrrad ENABLE ROW LEVEL SECURITY;

-- 6. Ergebnis pruefen
-- ============================================
SELECT 'NACHHER - Bikes mit Koordinaten:' AS info;
SELECT COUNT(*) AS total,
       COUNT(latitude) AS mit_lat,
       COUNT(longitude) AS mit_lon
FROM "cityBikesRental".fahrrad;

-- 7. Beispiele anzeigen
-- ============================================
SELECT fahrrad_id, rahmennummer, status, latitude, longitude
FROM "cityBikesRental".fahrrad
ORDER BY fahrrad_id
LIMIT 20;

-- 8. View neu erstellen (mit COALESCE fuer Fallback auf Station)
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

-- 9. View-Ergebnis pruefen
-- ============================================
SELECT 'VIEW - Verfuegbare Bikes:' AS info;
SELECT COUNT(*) AS anzahl,
       COUNT(latitude) AS mit_koordinaten
FROM "cityBikesRental".v_bikes_available;

-- 10. Einige Beispiele aus der View
-- ============================================
SELECT fahrrad_id, typ_name, station_name, latitude, longitude
FROM "cityBikesRental".v_bikes_available
ORDER BY fahrrad_id
LIMIT 10;
