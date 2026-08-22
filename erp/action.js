/*
  CityBike CRUD-Oberfläche
  JavaScript-Teil für CodePen

  External Scripts (in CodePen Settings → JS):
  https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2
  https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js
*/

// ============================================
// KONFIGURATION
// ============================================
const SUPABASE_URL = 'https://supabase.butscher.cloud';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzYyNjc5NTM1LCJleHAiOjIwNzgwMzk1MzV9.Fv3soDCs_GrM9MA-4Goq1ANCoJ7KzVpuJ9l9z7bQEwk';

// ============================================
// SUPABASE CLIENT MIT SCHEMA-KONFIGURATION
// ============================================
const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    db: {
        schema: 'cityBikesRental'
    }
});

// ============================================
// HILFSFUNKTIONEN
// ============================================

// Toast-Benachrichtigung anzeigen
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    const toastTitle = document.getElementById('toast-title');
    const toastMessage = document.getElementById('toast-message');
    const toastIcon = document.getElementById('toast-icon');

    toast.className = 'toast ' + type;
    toastTitle.textContent = type === 'success' ? 'Erfolg' : type === 'error' ? 'Fehler' : 'Info';
    toastMessage.textContent = message;
    toastIcon.className = type === 'success' ? 'bi bi-check-circle me-2 text-success' :
        type === 'error' ? 'bi bi-exclamation-circle me-2 text-danger' :
            'bi bi-info-circle me-2';

    const bsToast = new bootstrap.Toast(toast);
    bsToast.show();
}

// Datum formatieren
function formatDate(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('de-DE');
}

// Datetime formatieren
function formatDateTime(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('de-DE') + ' ' + date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

// Status-Badge erstellen
function statusBadge(status) {
    return `<span class="badge badge-${status}">${status}</span>`;
}

// Boolean-Badge erstellen
function boolBadge(value) {
    return value ? '<span class="badge badge-ja">Ja</span>' : '<span class="badge badge-nein">Nein</span>';
}

// Verbindungsstatus aktualisieren
function setConnectionStatus(connected, message = '') {
    const status = document.getElementById('connection-status');
    if (connected) {
        status.className = 'badge connected';
        status.innerHTML = '<i class="bi bi-circle-fill me-1"></i>Verbunden';
    } else {
        status.className = 'badge error';
        status.innerHTML = '<i class="bi bi-circle-fill me-1"></i>' + (message || 'Fehler');
    }
}

// ============================================
// KUNDEN
// ============================================

async function loadKunden() {
    try {
        const { data, error } = await db
            .from('kunde')
            .select('*')
            .order('nachname');

        if (error) throw error;

        const tbody = document.querySelector('#kunden-table tbody');

        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="empty-state"><i class="bi bi-people"></i><br>Keine Kunden vorhanden</td></tr>';
            return;
        }

        tbody.innerHTML = data.map(k => `
      <tr>
        <td>${k.kunde_id}</td>
        <td>${k.vorname} ${k.nachname}</td>
        <td>${k.email}</td>
        <td>${k.ort || '-'}</td>
        <td>${formatDate(k.registriert_am)}</td>
        <td>${boolBadge(k.aktiv)}</td>
        <td class="action-buttons">
          <button class="btn btn-action btn-edit" onclick="editKunde(${k.kunde_id})" title="Bearbeiten">
            <i class="bi bi-pencil"></i>
          </button>
          <button class="btn btn-action btn-delete" onclick="deleteKunde(${k.kunde_id})" title="Löschen">
            <i class="bi bi-trash"></i>
          </button>
        </td>
      </tr>
    `).join('');

    } catch (error) {
        console.error('Fehler beim Laden der Kunden:', error);
        showToast('Fehler beim Laden der Kunden: ' + error.message, 'error');
    }
}

function showKundeModal(kunde = null) {
    document.getElementById('kundeModalTitle').textContent = kunde ? 'Kunde bearbeiten' : 'Neuer Kunde';
    document.getElementById('kunde-id').value = kunde?.kunde_id || '';
    document.getElementById('kunde-vorname').value = kunde?.vorname || '';
    document.getElementById('kunde-nachname').value = kunde?.nachname || '';
    document.getElementById('kunde-email').value = kunde?.email || '';
    document.getElementById('kunde-telefon').value = kunde?.telefon || '';
    document.getElementById('kunde-geburtsdatum').value = kunde?.geburtsdatum || '';
    document.getElementById('kunde-strasse').value = kunde?.strasse || '';
    document.getElementById('kunde-hausnummer').value = kunde?.hausnummer || '';
    document.getElementById('kunde-plz').value = kunde?.plz || '';
    document.getElementById('kunde-ort').value = kunde?.ort || '';
    document.getElementById('kunde-aktiv').checked = kunde?.aktiv ?? true;

    new bootstrap.Modal(document.getElementById('kundeModal')).show();
}

async function editKunde(id) {
    const { data, error } = await db.from('kunde').select('*').eq('kunde_id', id).single();
    if (error) {
        showToast('Fehler: ' + error.message, 'error');
        return;
    }
    showKundeModal(data);
}

async function saveKunde() {
    const id = document.getElementById('kunde-id').value;
    const kunde = {
        vorname: document.getElementById('kunde-vorname').value,
        nachname: document.getElementById('kunde-nachname').value,
        email: document.getElementById('kunde-email').value,
        telefon: document.getElementById('kunde-telefon').value || null,
        geburtsdatum: document.getElementById('kunde-geburtsdatum').value || null,
        strasse: document.getElementById('kunde-strasse').value || null,
        hausnummer: document.getElementById('kunde-hausnummer').value || null,
        plz: document.getElementById('kunde-plz').value || null,
        ort: document.getElementById('kunde-ort').value || null,
        aktiv: document.getElementById('kunde-aktiv').checked
    };

    try {
        let error;
        if (id) {
            ({ error } = await db.from('kunde').update(kunde).eq('kunde_id', id));
        } else {
            kunde.passwort_hash = '$2b$12$placeholder'; // Platzhalter für neuen Kunden
            ({ error } = await db.from('kunde').insert(kunde));
        }

        if (error) throw error;

        bootstrap.Modal.getInstance(document.getElementById('kundeModal')).hide();
        showToast(id ? 'Kunde aktualisiert' : 'Kunde angelegt', 'success');
        loadKunden();

    } catch (error) {
        showToast('Fehler: ' + error.message, 'error');
    }
}

async function deleteKunde(id) {
    if (!confirm('Kunde deaktivieren?\n\n(Kunde wird nicht gelöscht, sondern auf inaktiv gesetzt)')) return;

    try {
        // Soft Delete: Kunde deaktivieren statt löschen
        const { error } = await db
            .from('kunde')
            .update({ aktiv: false })
            .eq('kunde_id', id);

        if (error) throw error;
        showToast('Kunde deaktiviert', 'success');
        loadKunden();
    } catch (error) {
        showToast('Fehler: ' + error.message, 'error');
    }
}

// ============================================
// STATIONEN
// ============================================

async function loadStationen() {
    try {
        const { data, error } = await db
            .from('station')
            .select('*')
            .order('ort, name');

        if (error) throw error;

        const tbody = document.querySelector('#stationen-table tbody');

        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="empty-state"><i class="bi bi-geo-alt"></i><br>Keine Stationen vorhanden</td></tr>';
            return;
        }

        tbody.innerHTML = data.map(s => `
      <tr>
        <td>${s.station_id}</td>
        <td>${s.name}</td>
        <td>${s.strasse} ${s.hausnummer || ''}</td>
        <td>${s.plz} ${s.ort}</td>
        <td>${s.kapazitaet}</td>
        <td>${boolBadge(s.aktiv)}</td>
        <td class="action-buttons">
          <button class="btn btn-action btn-edit" onclick="editStation(${s.station_id})" title="Bearbeiten">
            <i class="bi bi-pencil"></i>
          </button>
          <button class="btn btn-action btn-delete" onclick="deleteStation(${s.station_id})" title="Löschen">
            <i class="bi bi-trash"></i>
          </button>
        </td>
      </tr>
    `).join('');

    } catch (error) {
        console.error('Fehler beim Laden der Stationen:', error);
        showToast('Fehler beim Laden der Stationen: ' + error.message, 'error');
    }
}

function showStationModal(station = null) {
    document.getElementById('stationModalTitle').textContent = station ? 'Station bearbeiten' : 'Neue Station';
    document.getElementById('station-id').value = station?.station_id || '';
    document.getElementById('station-name').value = station?.name || '';
    document.getElementById('station-strasse').value = station?.strasse || '';
    document.getElementById('station-hausnummer').value = station?.hausnummer || '';
    document.getElementById('station-plz').value = station?.plz || '';
    document.getElementById('station-ort').value = station?.ort || '';
    document.getElementById('station-kapazitaet').value = station?.kapazitaet || '';
    document.getElementById('station-latitude').value = station?.latitude || '';
    document.getElementById('station-longitude').value = station?.longitude || '';
    document.getElementById('station-aktiv').checked = station?.aktiv ?? true;

    new bootstrap.Modal(document.getElementById('stationModal')).show();
}

async function editStation(id) {
    const { data, error } = await db.from('station').select('*').eq('station_id', id).single();
    if (error) {
        showToast('Fehler: ' + error.message, 'error');
        return;
    }
    showStationModal(data);
}

async function saveStation() {
    const id = document.getElementById('station-id').value;
    const station = {
        name: document.getElementById('station-name').value,
        strasse: document.getElementById('station-strasse').value,
        hausnummer: document.getElementById('station-hausnummer').value || null,
        plz: document.getElementById('station-plz').value,
        ort: document.getElementById('station-ort').value,
        kapazitaet: parseInt(document.getElementById('station-kapazitaet').value),
        latitude: parseFloat(document.getElementById('station-latitude').value) || null,
        longitude: parseFloat(document.getElementById('station-longitude').value) || null,
        aktiv: document.getElementById('station-aktiv').checked
    };

    try {
        let error;
        if (id) {
            ({ error } = await db.from('station').update(station).eq('station_id', id));
        } else {
            ({ error } = await db.from('station').insert(station));
        }

        if (error) throw error;

        bootstrap.Modal.getInstance(document.getElementById('stationModal')).hide();
        showToast(id ? 'Station aktualisiert' : 'Station angelegt', 'success');
        loadStationen();
        loadStationenDropdown(); // Dropdown in Fahrrad-Modal aktualisieren

    } catch (error) {
        showToast('Fehler: ' + error.message, 'error');
    }
}

async function deleteStation(id) {
    if (!confirm('Station deaktivieren?\n\n(Station wird nicht gelöscht, sondern auf inaktiv gesetzt)')) return;

    try {
        // Soft Delete: Station deaktivieren statt löschen
        const { error } = await db
            .from('station')
            .update({ aktiv: false })
            .eq('station_id', id);

        if (error) throw error;
        showToast('Station deaktiviert', 'success');
        loadStationen();
    } catch (error) {
        showToast('Fehler: ' + error.message, 'error');
    }
}

// ============================================
// FAHRRÄDER
// ============================================

async function loadFahrraeder() {
    try {
        let query = db
            .from('fahrrad')
            .select(`
        *,
        fahrradtyp (bezeichnung),
        station (name)
      `)
            .order('rahmennummer');

        const statusFilter = document.getElementById('filter-status').value;
        if (statusFilter) {
            query = query.eq('status', statusFilter);
        }

        const { data, error } = await query;

        if (error) throw error;

        const tbody = document.querySelector('#fahrraeder-table tbody');

        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="empty-state"><i class="bi bi-bicycle"></i><br>Keine Fahrräder gefunden</td></tr>';
            return;
        }

        tbody.innerHTML = data.map(f => `
      <tr>
        <td>${f.fahrrad_id}</td>
        <td><code>${f.rahmennummer}</code></td>
        <td>${f.fahrradtyp?.bezeichnung || '-'}</td>
        <td>${f.station?.name || '<em>unterwegs</em>'}</td>
        <td>${statusBadge(f.status)}</td>
        <td>${formatDate(f.letzte_wartung)}</td>
        <td class="action-buttons">
          <button class="btn btn-action btn-edit" onclick="editFahrrad(${f.fahrrad_id})" title="Bearbeiten">
            <i class="bi bi-pencil"></i>
          </button>
          <button class="btn btn-action btn-delete" onclick="deleteFahrrad(${f.fahrrad_id})" title="Löschen">
            <i class="bi bi-trash"></i>
          </button>
        </td>
      </tr>
    `).join('');

    } catch (error) {
        console.error('Fehler beim Laden der Fahrräder:', error);
        showToast('Fehler beim Laden der Fahrräder: ' + error.message, 'error');
    }
}

async function loadTypenDropdown() {
    const { data } = await db.from('fahrradtyp').select('typ_id, bezeichnung').order('bezeichnung');
    const select = document.getElementById('fahrrad-typ');
    select.innerHTML = '<option value="">-- wählen --</option>' +
        (data || []).map(t => `<option value="${t.typ_id}">${t.bezeichnung}</option>`).join('');
}

async function loadStationenDropdown() {
    const { data } = await db.from('station').select('station_id, name, ort').eq('aktiv', true).order('ort, name');
    const select = document.getElementById('fahrrad-station');
    select.innerHTML = '<option value="">-- unterwegs --</option>' +
        (data || []).map(s => `<option value="${s.station_id}">${s.name} (${s.ort})</option>`).join('');
}

function showFahrradModal(fahrrad = null) {
    document.getElementById('fahrradModalTitle').textContent = fahrrad ? 'Fahrrad bearbeiten' : 'Neues Fahrrad';
    document.getElementById('fahrrad-id').value = fahrrad?.fahrrad_id || '';
    document.getElementById('fahrrad-rahmennummer').value = fahrrad?.rahmennummer || '';
    document.getElementById('fahrrad-typ').value = fahrrad?.typ_id || '';
    document.getElementById('fahrrad-station').value = fahrrad?.station_id || '';
    document.getElementById('fahrrad-status').value = fahrrad?.status || 'verfuegbar';
    document.getElementById('fahrrad-wartung').value = fahrrad?.letzte_wartung || '';
    document.getElementById('fahrrad-angeschafft').value = fahrrad?.angeschafft_am || '';

    new bootstrap.Modal(document.getElementById('fahrradModal')).show();
}

async function editFahrrad(id) {
    const { data, error } = await db.from('fahrrad').select('*').eq('fahrrad_id', id).single();
    if (error) {
        showToast('Fehler: ' + error.message, 'error');
        return;
    }
    showFahrradModal(data);
}

async function saveFahrrad() {
    const id = document.getElementById('fahrrad-id').value;
    const fahrrad = {
        rahmennummer: document.getElementById('fahrrad-rahmennummer').value,
        typ_id: parseInt(document.getElementById('fahrrad-typ').value),
        station_id: document.getElementById('fahrrad-station').value ? parseInt(document.getElementById('fahrrad-station').value) : null,
        status: document.getElementById('fahrrad-status').value,
        letzte_wartung: document.getElementById('fahrrad-wartung').value || null,
        angeschafft_am: document.getElementById('fahrrad-angeschafft').value || null
    };

    try {
        let error;
        if (id) {
            ({ error } = await db.from('fahrrad').update(fahrrad).eq('fahrrad_id', id));
        } else {
            ({ error } = await db.from('fahrrad').insert(fahrrad));
        }

        if (error) throw error;

        bootstrap.Modal.getInstance(document.getElementById('fahrradModal')).hide();
        showToast(id ? 'Fahrrad aktualisiert' : 'Fahrrad angelegt', 'success');
        loadFahrraeder();

    } catch (error) {
        showToast('Fehler: ' + error.message, 'error');
    }
}

async function deleteFahrrad(id) {
    if (!confirm('Fahrrad als defekt markieren?\n\n(Fahrrad wird nicht gelöscht, sondern Status auf "defekt" gesetzt)')) return;

    try {
        // Soft Delete: Fahrrad auf defekt setzen statt löschen
        const { error } = await db
            .from('fahrrad')
            .update({ status: 'defekt' })
            .eq('fahrrad_id', id);

        if (error) throw error;
        showToast('Fahrrad als defekt markiert', 'success');
        loadFahrraeder();
    } catch (error) {
        showToast('Fehler: ' + error.message, 'error');
    }
}

// ============================================
// AUSLEIHEN
// ============================================

async function loadAusleihen() {
    try {
        let query = db
            .from('ausleihe')
            .select(`
        *,
        kunde (vorname, nachname),
        fahrrad (rahmennummer)
      `)
            .order('startzeit', { ascending: false })
            .limit(100);

        const statusFilter = document.getElementById('filter-ausleihe-status').value;
        if (statusFilter) {
            query = query.eq('status', statusFilter);
        }

        const { data, error } = await query;

        if (error) throw error;

        const tbody = document.querySelector('#ausleihen-table tbody');

        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="empty-state"><i class="bi bi-clock-history"></i><br>Keine Ausleihen gefunden</td></tr>';
            return;
        }

        tbody.innerHTML = data.map(a => {
            // Dauer berechnen falls Start- und Endzeit vorhanden
            let dauerStr = '-';
            if (a.startzeit && a.endzeit) {
                const dauer = Math.round((new Date(a.endzeit) - new Date(a.startzeit)) / 60000);
                dauerStr = dauer + ' min';
            }
            return `
      <tr>
        <td>${a.ausleihe_id}</td>
        <td>${a.kunde?.vorname || ''} ${a.kunde?.nachname || ''}</td>
        <td><code>${a.fahrrad?.rahmennummer || '-'}</code></td>
        <td>${formatDateTime(a.startzeit)}</td>
        <td>${a.endzeit ? formatDateTime(a.endzeit) : '<em>noch unterwegs</em>'}</td>
        <td>${dauerStr}</td>
        <td>${a.kosten ? a.kosten.toFixed(2) + ' €' : '-'}</td>
        <td>${statusBadge(a.status)}</td>
      </tr>
    `}).join('');

    } catch (error) {
        console.error('Fehler beim Laden der Ausleihen:', error);
        showToast('Fehler beim Laden der Ausleihen: ' + error.message, 'error');
    }
}

// ============================================
// TARIFE
// ============================================

async function loadTarife() {
    try {
        const { data, error } = await db
            .from('tarif')
            .select('*')
            .order('bezeichnung');

        if (error) throw error;

        const tbody = document.querySelector('#tarife-table tbody');

        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="empty-state"><i class="bi bi-tags"></i><br>Keine Tarife vorhanden</td></tr>';
            return;
        }

        tbody.innerHTML = data.map(t => `
      <tr>
        <td>${t.tarif_id}</td>
        <td>${t.bezeichnung}</td>
        <td><span class="badge bg-secondary">${t.tariftyp}</span></td>
        <td>${t.freiminuten_pro_monat}</td>
        <td>${t.rabatt_prozent || 0} %</td>
        <td>${(t.monatspreis || 0).toFixed(2)} €</td>
        <td class="action-buttons">
          <button class="btn btn-action btn-edit" onclick="editTarif(${t.tarif_id})" title="Bearbeiten">
            <i class="bi bi-pencil"></i>
          </button>
          <button class="btn btn-action btn-delete" onclick="deleteTarif(${t.tarif_id})" title="Löschen">
            <i class="bi bi-trash"></i>
          </button>
        </td>
      </tr>
    `).join('');

    } catch (error) {
        console.error('Fehler beim Laden der Tarife:', error);
        showToast('Fehler beim Laden der Tarife: ' + error.message, 'error');
    }
}

function showTarifModal(tarif = null) {
    document.getElementById('tarifModalTitle').textContent = tarif ? 'Tarif bearbeiten' : 'Neuer Tarif';
    document.getElementById('tarif-id').value = tarif?.tarif_id || '';
    document.getElementById('tarif-bezeichnung').value = tarif?.bezeichnung || '';
    document.getElementById('tarif-tariftyp').value = tarif?.tariftyp || 'standard';
    document.getElementById('tarif-freiminuten').value = tarif?.freiminuten_pro_monat || 0;
    document.getElementById('tarif-rabatt').value = tarif?.rabatt_prozent || 0;
    document.getElementById('tarif-monatspreis').value = tarif?.monatspreis || 0;
    document.getElementById('tarif-voraussetzung').value = tarif?.voraussetzung || '';

    new bootstrap.Modal(document.getElementById('tarifModal')).show();
}

async function editTarif(id) {
    const { data, error } = await db.from('tarif').select('*').eq('tarif_id', id).single();
    if (error) {
        showToast('Fehler: ' + error.message, 'error');
        return;
    }
    showTarifModal(data);
}

async function saveTarif() {
    const id = document.getElementById('tarif-id').value;
    const tarif = {
        bezeichnung: document.getElementById('tarif-bezeichnung').value,
        tariftyp: document.getElementById('tarif-tariftyp').value,
        freiminuten_pro_monat: parseInt(document.getElementById('tarif-freiminuten').value) || 0,
        rabatt_prozent: parseFloat(document.getElementById('tarif-rabatt').value) || 0,
        monatspreis: parseFloat(document.getElementById('tarif-monatspreis').value) || 0,
        voraussetzung: document.getElementById('tarif-voraussetzung').value || null
    };

    try {
        let error;
        if (id) {
            ({ error } = await db.from('tarif').update(tarif).eq('tarif_id', id));
        } else {
            ({ error } = await db.from('tarif').insert(tarif));
        }

        if (error) throw error;

        bootstrap.Modal.getInstance(document.getElementById('tarifModal')).hide();
        showToast(id ? 'Tarif aktualisiert' : 'Tarif angelegt', 'success');
        loadTarife();

    } catch (error) {
        showToast('Fehler: ' + error.message, 'error');
    }
}

async function deleteTarif(id) {
    if (!confirm('Tarif wirklich löschen?')) return;

    try {
        const { error } = await db.from('tarif').delete().eq('tarif_id', id);
        if (error) throw error;
        showToast('Tarif gelöscht', 'success');
        loadTarife();
    } catch (error) {
        showToast('Fehler: ' + error.message, 'error');
    }
}

// ============================================
// TAB-WECHSEL EVENT
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    // Tab-Wechsel Events
    document.querySelectorAll('#mainTabs button[data-bs-toggle="tab"]').forEach(tab => {
        tab.addEventListener('shown.bs.tab', (e) => {
            const target = e.target.getAttribute('data-bs-target');
            switch (target) {
                case '#kunden': loadKunden(); break;
                case '#stationen': loadStationen(); break;
                case '#fahrraeder': loadFahrraeder(); break;
                case '#ausleihen': loadAusleihen(); break;
                case '#tarife': loadTarife(); break;
            }
        });
    });
});

// ============================================
// INITIALISIERUNG
// ============================================

async function init() {
    try {
        // Verbindung testen
        const { data, error } = await db.from('kunde').select('kunde_id').limit(1);

        if (error) {
            throw error;
        }

        setConnectionStatus(true);
        showToast('Verbindung zu cityBikesRental hergestellt', 'success');

        // Initiale Daten laden
        await loadKunden();
        await loadTypenDropdown();
        await loadStationenDropdown();

    } catch (error) {
        console.error('Initialisierungsfehler:', error);
        setConnectionStatus(false, 'Verbindungsfehler');
        showToast('Verbindung fehlgeschlagen: ' + error.message + '\n\nPrüfe: 1) Schema in PostgREST freigegeben? 2) RLS deaktiviert?', 'error');
    }
}

// Start
init();