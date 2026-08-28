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
    // Die vier Fachrollen aus velocity.rolle, in der Reihenfolge, in der
    // die Navigation sie zeigt, dazu 'demo' (0020_demo_zugang.sql) ganz
    // am Ende - keine Fachrolle, aber meineRollen() in anmeldung.js
    // iteriert genau ueber diese Liste, um jede Rolle per hat_rolle()
    // abzufragen. Fehlte 'demo' hier, saehe ein Demo-Konto sich selbst
    // als "Mitarbeiter ohne Rolle" (leeres Set), obwohl velocity.rolle
    // und velocity.mitarbeiter_rolle die Zuteilung laengst tragen. Nicht
    // aus der Datenbank gelesen: die Reihenfolge ist eine
    // Gestaltungsentscheidung, keine Fachdatenzeile.
    rollen: ['disposition', 'werkstatt', 'kundenservice', 'leitung', 'demo'],
    // Technische Anmeldeadresse fuer den oeffentlichen Demozugang.
    // Supabase verlangt eine E-Mail-Adresse, "demo" allein waere keine -
    // siehe kennungZuEmail() in anmeldung.js fuer die Abbildung. Die
    // Endung .invalid ist nach RFC 2606 ausdruecklich dafuer reserviert,
    // niemals eine echte, registrierbare Domain zu sein - diese Adresse
    // kann also nie mit einer echten Kundin oder einem echten Mitarbeiter
    // kollidieren. Muss mit dem Anmeldesatz uebereinstimmen, den der
    // Betreiber in Supabase Studio anlegt (siehe
    // db/betrieb/mitarbeiter_demozugang.sql).
    demoEmail: 'demo@wawi.invalid'
};
