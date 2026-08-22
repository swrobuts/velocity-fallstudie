-- ============================================
-- Pruefe ob User-Kunde Mapping existiert
-- ============================================

-- 1. Alle Auth-User anzeigen
SELECT 'Auth Users:' AS info;
SELECT id, email, email_confirmed_at, created_at
FROM auth.users;

-- 2. Alle Mappings anzeigen
SELECT 'Kunde-Mappings:' AS info;
SELECT * FROM "cityBikesRental".auth_kunde_mapping;

-- 3. Falls kein Mapping existiert - manuell erstellen
-- (Ersetze die UUID mit der ID aus Schritt 1)
/*
INSERT INTO "cityBikesRental".kunde (email, passwort_hash, vorname, nachname, registriert_am, aktiv)
VALUES ('test@velocity.de', 'SUPABASE_AUTH', 'Max', 'Mustermann', NOW(), true);

INSERT INTO "cityBikesRental".auth_kunde_mapping (auth_uid, kunde_id)
SELECT
    (SELECT id FROM auth.users WHERE email = 'test@velocity.de'),
    (SELECT kunde_id FROM "cityBikesRental".kunde WHERE email = 'test@velocity.de');
*/

-- 4. Zeige vollstaendiges Mapping mit Kundendaten
SELECT 'Vollstaendiges Mapping:' AS info;
SELECT
    u.id AS auth_uid,
    u.email AS auth_email,
    m.kunde_id,
    k.vorname,
    k.nachname
FROM auth.users u
LEFT JOIN "cityBikesRental".auth_kunde_mapping m ON u.id = m.auth_uid
LEFT JOIN "cityBikesRental".kunde k ON m.kunde_id = k.kunde_id;
