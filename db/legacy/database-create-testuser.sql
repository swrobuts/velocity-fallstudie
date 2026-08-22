-- ============================================
-- VeloCity - Test-User erstellen
-- Erstellt einen verifizierten User direkt in der DB
-- Login: test@velocity.de / Test1234!
-- ============================================

-- 1. User in auth.users anlegen (bereits verifiziert)
INSERT INTO auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    raw_user_meta_data,
    is_super_admin,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change
) VALUES (
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'test@velocity.de',
    crypt('Test1234!', gen_salt('bf')),
    NOW(),  -- Sofort bestaetigt!
    NOW(),
    NOW(),
    '{"vorname": "Max", "nachname": "Mustermann"}'::jsonb,
    false,
    '',
    '',
    '',
    ''
)
ON CONFLICT (email) DO NOTHING;

-- 2. Identities-Eintrag (erforderlich fuer Supabase Auth)
INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
)
SELECT
    gen_random_uuid(),
    id,
    jsonb_build_object('sub', id::text, 'email', email),
    'email',
    id::text,
    NOW(),
    NOW(),
    NOW()
FROM auth.users
WHERE email = 'test@velocity.de'
ON CONFLICT DO NOTHING;

-- 3. Pruefen ob Trigger den Kunden angelegt hat
SELECT 'Auth User erstellt:' AS status;
SELECT id, email, email_confirmed_at, raw_user_meta_data
FROM auth.users
WHERE email = 'test@velocity.de';

SELECT 'Kunde-Mapping:' AS status;
SELECT m.auth_uid, m.kunde_id, k.email, k.vorname, k.nachname
FROM "cityBikesRental".auth_kunde_mapping m
JOIN "cityBikesRental".kunde k ON m.kunde_id = k.kunde_id
WHERE k.email = 'test@velocity.de';

-- ============================================
-- Login-Daten:
-- Email: test@velocity.de
-- Passwort: Test1234!
-- ============================================
