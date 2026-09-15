const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');

const root = path.resolve(__dirname, '..');
const source = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
function deferred() {
    let resolve;
    const promise = new Promise((done) => { resolve = done; });
    return { promise, resolve };
}
function page(t) {
    const dom = new JSDOM(source('src/index.html'), {
        url: 'https://velocity.test/', runScripts: 'outside-only'
    });
    t.after(() => dom.window.close());
    dom.window.console = { log() {}, warn() {}, error() {} };
    return dom.window;
}
function auth(t, updateUser = async () => ({ data: {}, error: null })) {
    const w = page(t);
    let change;
    w.supabaseClient = { auth: {
        onAuthStateChange(callback) { change = callback; },
        getSession: async () => ({ data: { session: null } }),
        updateUser
    } };
    w.ensureKunde = async () => null;
    w.APP_CONFIG = {};
    w.eval(source('src/auth.js'));
    return { w, change: (...args) => change(...args) };
}

async function application(t, updateUser) {
    const result = auth(t, updateUser);
    const { w } = result;
    // Vollstaendiges script.js, echte Formulare; nur Netz und Kartenbibliothek
    // werden ersetzt. Keine Konten, Mails oder Buchungen im Live-System.
    await tick();
    for (const name of ['fetchProfil', 'fetchActiveRentals', 'fetchTarifkarten',
        'fetchKennzahlen', 'fetchNutzungsschritte', 'fetchFaq', 'fetchStations',
        'fetchAvailableBikes', 'fetchHoehenmarken', 'fetchGeschaeftsgebiete']) {
        w[name] = async () => [];
    }
    w.fetchSchaetzbareTypen = async () => new Set();
    w.dashboardZeichnen = async () => {};
    w.dashboardZuruecksetzen = () => {};
    w.Toastify = () => ({ showToast() {} });
    w.scrollTo = () => {};
    w.matchMedia = () => ({ matches: false, addEventListener() {} });
    w.ResizeObserver = w.IntersectionObserver = class {
        observe() {}
        unobserve() {}
        disconnect() {}
    };
    const map = new Proxy(() => {}, {
        get(_, key) {
            if (key === 'getContainer') return () => w.document.getElementById('map');
            if (key === 'isValid') return () => false;
            if (key === 'getZoom') return () => 13;
            return map;
        },
        apply() { return map; }
    });
    w.L = map;
    w.eval(source('src/script.js'));
    w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
    await tick();
    return result;
}

test('Recovery-Formular oeffnet, prueft die Wiederholung und bestaetigt den gespeicherten Wechsel', async (t) => {
    let saves = 0;
    const { w, change } = await application(t, async () => {
        saves++;
        return { data: {}, error: null };
    });
    change('PASSWORD_RECOVERY', { user: { id: 'a', email: 'a@example.test' } });
    await tick();
    const form = w.document.getElementById('recovery-form');
    assert.equal(form.hidden, false);
    assert.equal(w.document.getElementById('auth-modal').style.display, 'flex');
    assert.equal(w.document.querySelector('.auth-tabs').hidden, true);
    w.document.querySelector('.close-modal').click();
    w.document.getElementById('user-nav-btn').click();
    assert.equal(form.hidden, false);
    assert.equal(w.document.getElementById('auth-modal').style.display, 'flex');
    const password = w.document.getElementById('recovery-password');
    const confirm = w.document.getElementById('recovery-confirm');
    password.value = 'neues-testpasswort';
    confirm.value = 'anderes-testpasswort';
    form.requestSubmit();
    await tick();
    assert.equal(saves, 0);
    assert.match(w.document.getElementById('auth-status').textContent, /stimmen nicht/);
    confirm.value = password.value;
    form.requestSubmit();
    await tick();
    assert.equal(saves, 1);
    assert.match(w.document.getElementById('auth-status').textContent, /gespeichert/);
    assert.equal(password.value, '');
    assert.equal(form.hidden, true);
    assert.equal(w.document.querySelector('.auth-tabs').hidden, false);
});

test('Abmeldung waehrend einer Ausleihabfrage blendet deren spaete Antwort nicht wieder ein', async (t) => {
    const { w, change } = await application(t);
    const pending = deferred();
    w.fetchActiveRentals = () => pending.promise;
    change('SIGNED_IN', { user: { id: 'a' } });
    await tick();
    change('SIGNED_OUT', null);
    pending.resolve([{ ausleihe_id: 1, startzeit: '2026-09-01', rahmennummer: 'ALTES-RAD' }]);
    await tick();
    assert.equal(w.document.getElementById('active-rental-banner').style.display, 'none');
});

test('Recovery-Link vor der UI-Initialisierung bleibt erkannt und speichert das neue Passwort', async (t) => {
    let written;
    const { w, change } = auth(t, async (data) => {
        written = data;
        return { data: {}, error: null };
    });
    change('PASSWORD_RECOVERY', { user: { id: 'a' } });
    assert.equal(w.istPasswortWiederherstellung(), true);
    await w.passwortSpeichern('neues-testpasswort');
    assert.equal(written.password, 'neues-testpasswort');
    assert.equal(w.istPasswortWiederherstellung(), false);
});

test('Fehlgeschlagener Passwortwechsel bleibt wiederholbar', async (t) => {
    const { w, change } = auth(t, async () => ({ error: { message: 'Failed to fetch' } }));
    change('PASSWORD_RECOVERY', { user: { id: 'a' } });
    await assert.rejects(w.passwortSpeichern('neues-testpasswort'), /Verbindung/);
    assert.equal(w.istPasswortWiederherstellung(), true);
    change('SIGNED_OUT', null);
    assert.equal(w.istPasswortWiederherstellung(), false);
});

for (const oldFailed of [true, false]) {
    test(`Lesefehlerstatus gehoert zur neueren Anfrage (alte Anfrage ${oldFailed ? 'fehlerhaft' : 'erfolgreich'})`, async () => {
        const old = deferred();
        let response = old.promise;
        const client = { from: () => ({ select: () => response }) };
        const ctx = vm.createContext({ console: { error() {} },
            SUPABASE_CONFIG: {}, APP_CONFIG: {},
            window: { supabase: { createClient: () => client } } });
        vm.runInContext(source('src/supabase.js'), ctx);
        const first = ctx.ladeListe('v_meine_bilanz');
        response = Promise.resolve(oldFailed ? { data: [] } : { error: { message: 'neu' } });
        await ctx.ladeListe('v_meine_bilanz');
        old.resolve(oldFailed ? { error: { message: 'alt' } } : { data: [] });
        await first;
        assert.equal(ctx.letzterLadeFehler('v_meine_bilanz'), oldFailed ? null : 'neu');
    });
}

const bilanzen = (name = 'Anna') => ({
    v_mein_profil: [{ vorname: name, nachname: 'Test', kundennummer: name }],
    v_meine_bilanz: [{ km_gesamt: 20, co2_ersparnis_kg_gesamt: 2,
        fahrten_gesamt: 1, anteil_geschaetzt: 0.5,
        erste_fahrt: '2026-09-01', letzte_fahrt: '2026-09-01' }],
    v_meine_monatsbilanz: [],
    v_meine_fahrt_kennzahl: [{ startzeit: '2026-09-01', typ_bezeichnung: 'City',
        rahmennummer: 'TEST-RAD', start_station: 'Start', end_station: 'Ziel',
        km: 20, dauer_minuten: 60, betrag_brutto: 6 }]
});
function dashboard(t) {
    const w = page(t);
    let user = { id: 'a' };
    let rows = bilanzen();
    let failures = new Map();
    w.getCurrentUser = () => user;
    w.ladeListe = async (view) => rows[view] || [];
    w.letzterLadeFehler = (view) => failures.get(view) || null;
    w.eval(source('src/dashboard.js'));
    w.eval("fahrtenZeitraum = 'alle'");
    return { w, setUser(value) { user = value; }, setRows(value) { rows = value; }, failures };
}

test('Leeres neues Konto zeigt keine Fahrten und Hinweise des vorigen Kontos', async (t) => {
    const { w, setRows, setUser } = dashboard(t);
    await w.dashboardZeichnen();
    assert.match(w.document.getElementById('dashboard-fahrten').textContent, /TEST-RAD/);
    setUser({ id: 'b' });
    setRows({ v_mein_profil: [{ vorname: 'Berta', nachname: 'Neu' }] });
    await w.dashboardZeichnen();
    assert.doesNotMatch(w.document.getElementById('dashboard').textContent, /TEST-RAD/);
    assert.equal(w.document.getElementById('dashboard-bilanz-hinweis').textContent, '');
    assert.equal(w.document.getElementById('dashboard-name').textContent, 'Berta Neu');
});

test('Verspaetete Antwort des alten Kontos ueberschreibt die neue Bilanz nicht', async (t) => {
    const { w, setUser } = dashboard(t);
    const old = deferred();
    const a = bilanzen('Anna');
    w.ladeListe = (view) => old.promise.then(() => a[view]);
    const first = w.dashboardZeichnen();
    setUser({ id: 'b' });
    const b = bilanzen('Berta');
    w.ladeListe = async (view) => b[view];
    await w.dashboardZeichnen();
    old.resolve();
    await first;
    assert.equal(w.document.getElementById('dashboard-name').textContent, 'Berta Test');
});

test('Abmelden verwirft auch eine noch laufende Dashboard-Abfrage', async (t) => {
    const { w, setUser } = dashboard(t);
    const pending = deferred();
    w.ladeListe = (view) => pending.promise.then(() => bilanzen()[view]);
    const loading = w.dashboardZeichnen();
    setUser(null);
    w.dashboardZuruecksetzen();
    pending.resolve();
    await loading;
    assert.equal(w.document.getElementById('dashboard-name').textContent, '');
    assert.equal(w.document.getElementById('dashboard-fahrten').textContent, '');
});

for (const view of ['v_mein_profil', 'v_meine_bilanz', 'v_meine_monatsbilanz', 'v_meine_fahrt_kennzahl']) {
    test(`Dashboard meldet Lesefehler in ${view} statt einer leeren oder alten Bilanz`, async (t) => {
        const { w, failures } = dashboard(t);
        await w.dashboardZeichnen();
        failures.set(view, 'Keine Verbindung');
        await w.dashboardZeichnen();
        assert.equal(w.document.getElementById('dashboard-fehler').hidden, false);
        assert.doesNotMatch(w.document.getElementById('dashboard-fahrten').textContent, /TEST-RAD/);
    });
}

function roles() {
    let change;
    let user = { id: 'a' };
    let rpc = async () => ({ data: true });
    const ctx = vm.createContext({ console, setTimeout, WAWI_CONFIG: { rollen: ['leitung'] },
        supabaseClient: {
            auth: { onAuthStateChange(fn) { change = fn; },
                getUser: async () => ({ data: { user } }) },
            rpc: (...args) => rpc(...args)
        }
    });
    vm.runInContext(source('wawi/anmeldung.js'), ctx);
    return { ctx, change, setUser(value) { user = value; }, setRpc(value) { rpc = value; } };
}

test('WaWi behaelt offene Eingaben bei SIGNED_IN fuer dasselbe Konto', async () => {
    const { ctx, change } = roles();
    let rebuilt = 0;
    ctx.beiAnmeldungsWechsel(() => rebuilt++);
    change('SIGNED_IN', { user: { id: 'a' } });
    await tick();
    assert.equal(rebuilt, 1);
    change('SIGNED_IN', { user: { id: 'a' } });
    await tick();
    assert.equal(rebuilt, 1);
    change('USER_UPDATED', { user: { id: 'a' } });
    await tick();
    assert.equal(rebuilt, 2);
});

test('WaWi uebernimmt verspaetete Rollen des vorigen Kontos nicht in den Cache', async () => {
    const { ctx, change, setUser, setRpc } = roles();
    change('SIGNED_IN', { user: { id: 'a' } });
    const old = deferred();
    setRpc(() => old.promise);
    const first = ctx.meineRollen();
    await tick();
    setUser({ id: 'b' });
    change('SIGNED_IN', { user: { id: 'b' } });
    setRpc(async () => ({ data: false }));
    assert.equal(await ctx.meineRollen(), false);
    old.resolve({ data: true });
    await first;
    assert.equal(await ctx.meineRollen(), false);
});
