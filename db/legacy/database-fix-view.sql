-- ============================================
-- VeloCity - View Fix
-- Loescht und erstellt die View neu
-- ============================================

-- 1. Alte View loeschen
DROP VIEW IF EXISTS "cityBikesRental".v_bikes_available;

-- 2. View neu erstellen
CREATE VIEW "cityBikesRental".v_bikes_available AS
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

-- 3. Berechtigungen setzen
GRANT SELECT ON "cityBikesRental".v_bikes_available TO anon, authenticated;

-- 4. Ergebnis pruefen
SELECT 'Verfuegbare Bikes in View:' AS info;
SELECT COUNT(*) AS anzahl,
       COUNT(latitude) AS mit_koordinaten
FROM "cityBikesRental".v_bikes_available;

-- 5. Beispiele anzeigen
SELECT fahrrad_id, typ_name, latitude, longitude
FROM "cityBikesRental".v_bikes_available
ORDER BY fahrrad_id
LIMIT 15;
