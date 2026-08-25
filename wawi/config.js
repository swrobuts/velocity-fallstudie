// ============================================
// VeloCity Warenwirtschaft — Konfiguration
// ============================================

const SUPABASE_CONFIG = {
    url: 'https://supabase.butscher.cloud',
    // Derselbe oeffentliche anon-Key wie auf der Website, und aus
    // demselben Grund unbedenklich: er wird an jeden Browser
    // ausgeliefert. Der Schutz liegt in RLS, in den Rechten des Schemas
    // und darin, dass jede v_wawi-Sicht selbst ueber hat_rolle filtert.
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzYyNjc5NTM1LCJleHAiOjIwNzgwMzk1MzV9.Fv3soDCs_GrM9MA-4Goq1ANCoJ7KzVpuJ9l9z7bQEwk'
};

const WAWI_CONFIG = {
    schema: 'velocity',
    // Die vier Rollen aus velocity.rolle, in der Reihenfolge, in der die
    // Navigation sie zeigt. Nicht aus der Datenbank gelesen: die
    // Reihenfolge ist eine Gestaltungsentscheidung, keine Fachdatenzeile.
    rollen: ['disposition', 'werkstatt', 'kundenservice', 'leitung']
};
