-- ============================================
-- VeloCity - Auth Setup Diagnose
-- ============================================

-- 1. Pruefen ob Mapping-Tabelle existiert
SELECT 'auth_kunde_mapping Tabelle:' AS check_item;
SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'cityBikesRental'
    AND table_name = 'auth_kunde_mapping'
) AS exists;

-- 2. Pruefen ob Trigger existiert
SELECT 'Trigger on_auth_user_created:' AS check_item;
SELECT EXISTS (
    SELECT 1 FROM information_schema.triggers
    WHERE trigger_name = 'on_auth_user_created'
) AS exists;

-- 3. Pruefen ob Funktion existiert
SELECT 'Funktion handle_new_user:' AS check_item;
SELECT EXISTS (
    SELECT 1 FROM information_schema.routines
    WHERE routine_schema = 'cityBikesRental'
    AND routine_name = 'handle_new_user'
) AS exists;

-- 4. Pruefen ob API-Funktionen existieren
SELECT 'API Funktionen:' AS check_item;
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'cityBikesRental'
AND routine_name LIKE 'fn_%api%';

-- 5. Anzahl User in auth.users
SELECT 'Auth Users:' AS check_item;
SELECT COUNT(*) AS count FROM auth.users;

-- 6. Anzahl Mappings
SELECT 'Kunde-Mappings:' AS check_item;
SELECT COUNT(*) AS count FROM "cityBikesRental".auth_kunde_mapping;

-- 7. Zeige bestehende Mappings
SELECT 'Bestehende Mappings:' AS check_item;
SELECT m.auth_uid, m.kunde_id, k.email, k.vorname, k.nachname
FROM "cityBikesRental".auth_kunde_mapping m
JOIN "cityBikesRental".kunde k ON m.kunde_id = k.kunde_id;
