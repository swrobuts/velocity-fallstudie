// ============================================
// VeloCity - Supabase Konfiguration
// ============================================

const SUPABASE_CONFIG = {
    url: 'https://supabase.butscher.cloud',
    // Der anon-Key ist bewusst oeffentlich: er wird an jeden Browser
    // ausgeliefert. Der Schutz liegt vollstaendig in RLS und in den
    // Rechten des Schemas, nicht in der Geheimhaltung dieses Schluessels.
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzYyNjc5NTM1LCJleHAiOjIwNzgwMzk1MzV9.Fv3soDCs_GrM9MA-4Goq1ANCoJ7KzVpuJ9l9z7bQEwk'
};

const APP_CONFIG = {
    defaultMapCenter: [49.7930, 9.9360],
    defaultZoom: 14,
    schema: 'velocity',
    // Demozugang der Kundenwebsite. BEIDE FELDER BLEIBEN HIER LEER.
    // Die Werte traegt der Betreiber ein; Zugangsdaten gehoeren nicht
    // ins Repository, auch absichtlich oeffentliche nicht. Sind sie
    // leer, erscheint auf der Anmeldemaske weder Knopf noch Hinweis -
    // kein halb funktionierender Zugang.
    demoEmail: '',
    demoPasswort: ''
};
