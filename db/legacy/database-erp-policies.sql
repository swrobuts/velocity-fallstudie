-- ============================================
-- VeloCity - RLS Policies fuer ERP-Oberfläche
-- Erlaubt INSERT, UPDATE, DELETE fuer anon/authenticated
-- ============================================

-- KUNDE: Vollzugriff
DROP POLICY IF EXISTS "Kunden verwalten" ON "cityBikesRental".kunde;
CREATE POLICY "Kunden verwalten" ON "cityBikesRental".kunde
    FOR ALL TO anon, authenticated
    USING (true)
    WITH CHECK (true);

-- STATION: Vollzugriff
DROP POLICY IF EXISTS "Stationen verwalten" ON "cityBikesRental".station;
CREATE POLICY "Stationen verwalten" ON "cityBikesRental".station
    FOR ALL TO anon, authenticated
    USING (true)
    WITH CHECK (true);

-- FAHRRAD: Vollzugriff
DROP POLICY IF EXISTS "Fahrraeder verwalten" ON "cityBikesRental".fahrrad;
CREATE POLICY "Fahrraeder verwalten" ON "cityBikesRental".fahrrad
    FOR ALL TO anon, authenticated
    USING (true)
    WITH CHECK (true);

-- FAHRRADTYP: Vollzugriff
DROP POLICY IF EXISTS "Typen verwalten" ON "cityBikesRental".fahrradtyp;
CREATE POLICY "Typen verwalten" ON "cityBikesRental".fahrradtyp
    FOR ALL TO anon, authenticated
    USING (true)
    WITH CHECK (true);

-- TARIF: Vollzugriff
DROP POLICY IF EXISTS "Tarife verwalten" ON "cityBikesRental".tarif;
CREATE POLICY "Tarife verwalten" ON "cityBikesRental".tarif
    FOR ALL TO anon, authenticated
    USING (true)
    WITH CHECK (true);

-- AUSLEIHE: Lesezugriff (kein Bearbeiten ueber ERP)
-- Bleibt bei SELECT only

-- Verifizierung
SELECT 'Policies erstellt:' AS info;
SELECT schemaname, tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'cityBikesRental'
ORDER BY tablename, policyname;
