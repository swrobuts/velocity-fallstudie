-- ============================================
-- Manuelles Kunde-Mapping fuer bestehende Auth-User
-- ============================================

-- 1. Kunde anlegen (falls nicht existiert)
INSERT INTO "cityBikesRental".kunde (email, passwort_hash, vorname, nachname, registriert_am, aktiv)
SELECT
    u.email,
    'SUPABASE_AUTH',
    COALESCE(u.raw_user_meta_data->>'vorname', 'Test'),
    COALESCE(u.raw_user_meta_data->>'nachname', 'User'),
    NOW(),
    true
FROM auth.users u
WHERE NOT EXISTS (
    SELECT 1 FROM "cityBikesRental".kunde k WHERE k.email = u.email
);

-- 2. Mapping erstellen
INSERT INTO "cityBikesRental".auth_kunde_mapping (auth_uid, kunde_id)
SELECT
    u.id,
    k.kunde_id
FROM auth.users u
JOIN "cityBikesRental".kunde k ON u.email = k.email
WHERE NOT EXISTS (
    SELECT 1 FROM "cityBikesRental".auth_kunde_mapping m WHERE m.auth_uid = u.id
);

-- 3. Ergebnis pruefen
SELECT 'Mapping erstellt:' AS info;
SELECT
    u.email,
    m.auth_uid,
    m.kunde_id,
    k.vorname,
    k.nachname
FROM auth.users u
JOIN "cityBikesRental".auth_kunde_mapping m ON u.id = m.auth_uid
JOIN "cityBikesRental".kunde k ON m.kunde_id = k.kunde_id;
