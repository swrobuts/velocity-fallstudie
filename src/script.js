// ============================================
// VeloCity - Hauptanwendung
// ============================================

document.addEventListener("DOMContentLoaded", async () => {

    // ===== STATE =====
    let pendingReservationBikeId = null;
    let activeRental = null;
    let rentalTimerInterval = null;
    let db_Stations = [];
    let db_Bikes = [];

    // ===== DOM ELEMENTE =====
    const modal = document.getElementById("auth-modal");
    const userNavBtn = document.getElementById("user-nav-btn");
    const closeBtn = document.querySelector(".close-modal");
    const rentalBanner = document.getElementById("active-rental-banner");
    const endRentalBtn = document.getElementById("end-rental-btn");

    // ===== UI UPDATE FUNKTION =====
    function updateUI(user) {
        if (user) {
            const displayName = getUserDisplayName();
            userNavBtn.innerHTML = `<i class="fa-solid fa-circle-user"></i> ${displayName}`;
            userNavBtn.classList.remove("btn-primary");
            userNavBtn.classList.add("btn-outline");
            userNavBtn.onclick = async (e) => {
                e.preventDefault();
                try {
                    await logout();
                    Toastify({ text: "Erfolgreich ausgeloggt.", backgroundColor: "#374151", position: "right" }).showToast();
                } catch (error) {
                    Toastify({ text: error.message, backgroundColor: "#EF4444" }).showToast();
                }
            };
            // Aktive Ausleihen pruefen
            checkActiveRentals();
        } else {
            userNavBtn.innerHTML = `<i class="fa-regular fa-user"></i> Login`;
            userNavBtn.classList.add("btn-primary");
            userNavBtn.classList.remove("btn-outline");
            userNavBtn.onclick = (e) => { e.preventDefault(); openModal(); };
            // Banner verstecken
            hideRentalBanner();
        }
    }

    // ===== MODAL FUNKTIONEN =====
    function openModal() {
        modal.style.display = "flex";
        document.querySelector('.auth-tab[data-target="login-form"]').click();
    }

    function closeModal() {
        modal.style.display = "none";
    }

    closeBtn.addEventListener("click", closeModal);
    window.addEventListener("click", (e) => { if (e.target == modal) closeModal(); });

    // Tab-Wechsel
    document.querySelectorAll(".auth-tab").forEach(tab => {
        tab.addEventListener("click", () => {
            document.querySelectorAll(".auth-tab").forEach(t => t.classList.remove("active"));
            tab.classList.add("active");
            const targetId = tab.getAttribute("data-target");
            document.querySelectorAll(".auth-form").forEach(form => {
                form.classList.remove("active");
                if (form.id === targetId) form.classList.add("active");
            });
        });
    });

    // ===== LOGIN HANDLER =====
    document.getElementById("login-form").addEventListener("submit", async (e) => {
        e.preventDefault();
        const email = document.getElementById("login-email").value;
        const password = document.getElementById("login-password").value;

        try {
            await login(email, password);
            closeModal();
            Toastify({ text: "Willkommen zurück!", backgroundColor: "#10B981" }).showToast();

            if (pendingReservationBikeId) {
                setTimeout(() => {
                    window.reserveBike(pendingReservationBikeId);
                    pendingReservationBikeId = null;
                }, 500);
            }
        } catch (error) {
            Toastify({ text: error.message, backgroundColor: "#EF4444" }).showToast();
        }
    });

    // ===== REGISTER HANDLER =====
    document.getElementById("register-form").addEventListener("submit", async (e) => {
        e.preventDefault();
        const vorname = document.getElementById("reg-vorname").value;
        const nachname = document.getElementById("reg-nachname").value;
        const email = document.getElementById("reg-email").value;
        const password = document.getElementById("reg-password").value;

        try {
            await register(email, password, vorname, nachname);
            closeModal();
            Toastify({ text: "Konto erstellt! Willkommen bei VeloCity!", backgroundColor: "#10B981" }).showToast();

            if (pendingReservationBikeId) {
                setTimeout(() => {
                    window.reserveBike(pendingReservationBikeId);
                    pendingReservationBikeId = null;
                }, 500);
            }
        } catch (error) {
            if (error.message === 'EMAIL_CONFIRMATION_REQUIRED') {
                Toastify({ text: "Konto erstellt! Bitte bestätigen Sie Ihre E-Mail.", backgroundColor: "#F59E0B", duration: 6000 }).showToast();
            } else {
                Toastify({ text: error.message, backgroundColor: "#EF4444" }).showToast();
            }
        }
    });

    // ===== AUTH STATE LISTENER =====
    onAuthStateChange(updateUI);

    // ===== INHALTE AUS DER DATENBANK =====
    // Tarifkarten, FAQ, Nutzungsschritte und Kennzahlen standen frueher
    // fest in index.html. Jetzt kommen sie aus den v_-Sichten.

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text ?? '';
        return div.innerHTML;
    }

    function euro(betrag) {
        return Number(betrag).toLocaleString('de-DE',
            { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' Euro';
    }

    /* =================================================================
       HOEHENSPIEGEL

       Wuerzburg ist der Grund fuer die Pedelecs: rund hundert Hoehenmeter
       zwischen der tiefsten und der hoechsten Station. Diese Zeichnung war
       zuerst ein festverdrahtetes Schema - und ein Schema ist genau einmal
       interessant. Jetzt kommt jeder Wert aus velocity.v_station: die Hoehe
       als Stammdatum, die Belegung als Momentaufnahme. Beim naechsten Besuch
       steht sie anders da, weil die Raeder anders stehen.

       Der Kurvenzug verbindet die Stationen in der Reihenfolge ihrer Hoehe.
       Er ist kein Streckenprofil und behauptet keinen Weg - er zeigt, wie
       flach die Stadt am Fluss liegt und wie steil es zum Campus geht.
       ================================================================= */
    const HS = { b: 1240, h: 340, l: 74, r: 1108, o: 46, u: 250 };

    function hoehenspiegelZeichnen(stationen) {
        const ziel = document.getElementById('profil-bild');
        if (!ziel) return;

        const orte = stationen
            .filter(s => s.ort === 'Würzburg' && Number.isFinite(s.hoehe_m))
            .sort((a, b) => a.hoehe_m - b.hoehe_m);
        if (orte.length < 2) { ziel.innerHTML = ''; return; }

        const hMin = orte[0].hoehe_m, hMax = orte[orte.length - 1].hoehe_m;
        const spanne = Math.max(hMax - hMin, 1);
        // Etwas Luft ueber und unter den Randwerten, sonst kleben die
        // Punkte an der Rahmenkante.
        const von = hMin - spanne * 0.10, bis = hMax + spanne * 0.10;
        const y = (h) => HS.o + (bis - h) / (bis - von) * (HS.u - HS.o);
        const x = (i) => orte.length === 1 ? HS.l
                       : HS.l + i * (HS.r - HS.l) / (orte.length - 1);

        const punkte = orte.map((s, i) => ({ s, x: x(i), y: y(s.hoehe_m) }));
        // Die obere Bildhaelfte bleibt leer, weil fast alle Stationen unten
        // am Fluss liegen. Diese Leere ist die Aussage - also spricht sie
        // sie aus, mit Zahlen aus denselben Daten.
        const talZahl = orte.filter(s => s.hoehe_m <= hMin + 15).length;

        // Weicher Kurvenzug durch die Punkte (Catmull-Rom als Bezier).
        let d = `M${punkte[0].x.toFixed(1)} ${punkte[0].y.toFixed(1)}`;
        for (let i = 0; i < punkte.length - 1; i++) {
            const p0 = punkte[i - 1] || punkte[i], p1 = punkte[i];
            const p2 = punkte[i + 1], p3 = punkte[i + 2] || p2;
            const c1x = p1.x + (p2.x - p0.x) / 6, c1y = p1.y + (p2.y - p0.y) / 6;
            const c2x = p2.x - (p3.x - p1.x) / 6, c2y = p2.y - (p3.y - p1.y) / 6;
            d += ` C${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)}`
               + ` ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
        }

        const marken = punkte.map(({ s, x, y }) => {
            const frei = s.verfuegbare_raeder || 0;
            const voll = Math.max(s.kapazitaet || 1, 1);
            const anteil = Math.min(frei / voll, 1);
            // Flaechentreu: der Radius waechst mit der Wurzel der Anzahl,
            // sonst uebertreibt die Kreisflaeche den Unterschied.
            const rad = 5 + Math.sqrt(frei) * 1.15;
            return `
      <g class="hs-station" tabindex="0" role="listitem"
         aria-label="${escapeHtml(s.name)}, ${s.hoehe_m} Meter, ${frei} von ${voll} Rädern frei">
        <line class="hs-lot" x1="${x.toFixed(1)}" y1="${y.toFixed(1)}"
              x2="${x.toFixed(1)}" y2="${HS.u}"/>
        <circle class="hs-ring" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${rad.toFixed(1)}"/>
        <circle class="hs-kern" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}"
                r="${(rad * anteil).toFixed(1)}"/>
        <text class="hs-zahl" x="${x.toFixed(1)}" y="${(y - rad - 8).toFixed(1)}">${frei}</text>
        <text class="hs-name" transform="translate(${x.toFixed(1)} ${HS.u + 14}) rotate(-42)"
              >${escapeHtml(s.name)}</text>
        <title>${escapeHtml(s.name)} · ${s.hoehe_m} m · ${frei} von ${voll} frei</title>
      </g>`;
        }).join('');

        const yTief = y(hMin), yHoch = y(hMax), xMass = HS.r + 34;
        ziel.innerHTML = `
    <svg class="profil-svg" viewBox="0 0 ${HS.b} ${HS.h}" role="list"
         aria-label="Würzburger Stationen nach Höhenlage, mit der Zahl der gerade freien Räder">
      <defs>
        <linearGradient id="hang" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stop-color="var(--red)" stop-opacity=".15"/>
          <stop offset="100%" stop-color="var(--red)" stop-opacity=".012"/>
        </linearGradient>
      </defs>

      <g class="p-raster">
        <line x1="${HS.l}" y1="${yTief.toFixed(1)}" x2="${HS.r}" y2="${yTief.toFixed(1)}"/>
        <line x1="${HS.l}" y1="${yHoch.toFixed(1)}" x2="${HS.r}" y2="${yHoch.toFixed(1)}"/>
        <text x="${HS.l - 10}" y="${(yTief + 3.8).toFixed(1)}">${hMin} m</text>
        <text x="${HS.l - 10}" y="${(yHoch + 3.8).toFixed(1)}">${hMax} m</text>
      </g>

      <text class="hs-satz" x="${HS.l}" y="106">${talZahl} Stationen liegen unten am Fluss.</text>
      <text class="hs-satz hs-satz-2" x="${HS.l}" y="140">Bis ${escapeHtml(orte[orte.length - 1].name)} sind es ${hMax - hMin} Höhenmeter.</text>

      <path class="p-flaeche" d="${d} L${HS.r} ${HS.u} L${HS.l} ${HS.u} Z"/>
      <path class="p-linie"   d="${d}"/>
      <line class="p-grundlinie" x1="${HS.l}" y1="${HS.u}" x2="${HS.r}" y2="${HS.u}"/>
      ${marken}

      <g class="p-mass">
        <line class="p-pfeil" x1="${xMass}" y1="${yHoch.toFixed(1)}"
              x2="${xMass}" y2="${yTief.toFixed(1)}"/>
        <path class="p-spitze" d="M${xMass - 4} ${(yHoch + 7).toFixed(1)}
              L${xMass} ${yHoch.toFixed(1)} L${xMass + 4} ${(yHoch + 7).toFixed(1)} Z"/>
        <path class="p-spitze" d="M${xMass - 4} ${(yTief - 7).toFixed(1)}
              L${xMass} ${yTief.toFixed(1)} L${xMass + 4} ${(yTief - 7).toFixed(1)} Z"/>
        <text class="p-mass-text" x="${xMass + 13}"
              y="${((yHoch + yTief) / 2 - 2).toFixed(1)}">${hMax - hMin}</text>
        <text class="p-mass-text p-klein" x="${xMass + 13}"
              y="${((yHoch + yTief) / 2 + 13).toFixed(1)}">Höhenmeter</text>
      </g>
    </svg>`;
    }

    async function renderKennzahlen() {
        const ziel = document.getElementById('stats-grid');
        if (!ziel) return;
        const zeilen = await fetchKennzahlen();
        // Markup nach dem Entwurf des Nutzers: b traegt den Wert,
        // span das Etikett. Die Werte selbst kommen aus v_kennzahl.
        ziel.innerHTML = zeilen.map(k => `
            <div class="stat">
                <b>${escapeHtml(k.wert)}</b>
                <span>${escapeHtml(k.label)}</span>
            </div>`).join('');

        // Dieselbe Quelle speist die Kopfzeile der Buehne.
        const stationen = zeilen.find(k => k.schluessel === 'stationen');
        const anzeige = document.getElementById('stationen-zaehler');
        if (anzeige && stationen) anzeige.textContent = stationen.wert;
    }

    async function renderNutzungsschritte() {
        const ziel = document.getElementById('howto-grid');
        if (!ziel) return;
        const zeilen = await fetchNutzungsschritte();
        ziel.innerHTML = zeilen.map(schritt => `
            <div class="howto-card">
                <div class="step-number">${schritt.nummer}</div>
                <div class="icon-circle"><i class="fa-solid ${escapeHtml(schritt.icon_code)}"></i></div>
                <h3>${escapeHtml(schritt.titel)}</h3>
                <p>${escapeHtml(schritt.beschreibung)}</p>
            </div>`).join('');
    }

    async function renderTarifkarten() {
        const ziel = document.getElementById('pricing-grid');
        if (!ziel) return;
        const karten = await fetchTarifkarten();
        ziel.innerHTML = karten.map((k, i) => `
            <div class="price-card${i === 1 ? ' popular' : ''}">
                ${i === 1 ? '<div class="badge-pop">Beliebteste Wahl</div>' : ''}
                <div class="card-content">
                    <div class="header">${escapeHtml(k.bezeichnung)}</div>
                    <div class="price">${euro(k.preis_30_minuten)} <small>/ 30 Min</small></div>
                    <ul class="features-list">
                        ${(k.merkmale || []).map(m =>
                            `<li><i class="fa-solid fa-check"></i> ${escapeHtml(m)}</li>`).join('')}
                    </ul>
                </div>
                <button class="${i === 1 ? 'btn-primary' : 'btn-outline'} full-width"
                        onclick="document.getElementById('map-section').scrollIntoView()">
                    Fahrt starten
                </button>
            </div>`).join('');
    }

    async function renderFaq() {
        const ziel = document.getElementById('faq-grid');
        if (!ziel) return;
        const zeilen = await fetchFaq();
        ziel.innerHTML = zeilen.map(f => `
            <details>
                <summary>${escapeHtml(f.frage)}</summary>
                <div class="faq-content">${escapeHtml(f.antwort)}</div>
            </details>`).join('');
    }

    // ===== FAHRPREISZAEHLER =====
    // Rechnet mit denselben Regeln wie die Datenbank: angefangene Minuten
    // werden aufgerundet (Geschaeftsregel GR6), der Betrag ist auf den
    // Tageshoechstpreis gedeckelt. Die Saetze kommen aus v_tarifkarte,
    // sind also nicht im Frontend hinterlegt.
    let zaehlerTarife = [];
    let zaehlerAktiv = 0;
    const zaehlerStart = Date.now();

    function zaehlerZeichnen() {
        const wert   = document.getElementById('meter-value');
        const detail = document.getElementById('meter-detail');
        const uhr    = document.getElementById('meter-clock');
        if (!wert || zaehlerTarife.length === 0) return;

        const t = zaehlerTarife[zaehlerAktiv];
        const sekunden = Math.floor((Date.now() - zaehlerStart) / 1000);
        const minuten  = Math.ceil(sekunden / 60);   // angefangene Minuten, wie GR6

        const roh = Number(t.startgebuehr) + minuten * Number(t.preis_pro_minute);
        const betrag = Math.min(roh, Number(t.tageshoechstpreis));

        wert.textContent = betrag.toLocaleString('de-DE',
            { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        const mm = String(Math.floor(sekunden / 60)).padStart(2, '0');
        const ss = String(sekunden % 60).padStart(2, '0');
        uhr.textContent = `${mm}:${ss}`;

        const gedeckelt = roh > Number(t.tageshoechstpreis);
        // Knapp halten: die Zeile steht neben der Uhr und darf nicht umbrechen.
        const zahl = (n) => Number(n).toLocaleString('de-DE',
            { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        detail.textContent = gedeckelt
            ? `Tageshöchstpreis erreicht`
            : `${zahl(t.startgebuehr)} Start · ${zahl(t.preis_pro_minute)}/Min · ` +
              `max ${zahl(t.tageshoechstpreis)}`;
    }

    function zaehlerSchalterZeichnen() {
        const ziel = document.getElementById('meter-switch');
        if (!ziel) return;
        ziel.innerHTML = zaehlerTarife.map((t, i) =>
            `<button type="button" data-i="${i}" aria-pressed="${i === zaehlerAktiv}">` +
            `${escapeHtml(t.typ_code)}</button>`).join('');
        ziel.querySelectorAll('button').forEach(b => {
            b.addEventListener('click', () => {
                zaehlerAktiv = Number(b.dataset.i);
                zaehlerSchalterZeichnen();
                zaehlerZeichnen();
            });
        });
    }

    async function zaehlerStarten() {
        if (!document.getElementById('fare-meter')) return;
        const karten = await fetchTarifkarten();
        zaehlerTarife = karten.filter(k => k.preis_pro_minute !== null);
        if (zaehlerTarife.length === 0) {
            document.getElementById('meter-detail').textContent =
                'Tarife nicht verfügbar';
            return;
        }
        // E-Bike voreingestellt: das ist das Rad fuer den Berg.
        const ebike = zaehlerTarife.findIndex(t => t.typ_code === 'EBIKE');
        zaehlerAktiv = ebike >= 0 ? ebike : 0;
        zaehlerSchalterZeichnen();
        zaehlerZeichnen();
        setInterval(zaehlerZeichnen, 1000);
    }

    async function renderInhalte() {
        await Promise.all([
            zaehlerStarten(),
            renderKennzahlen(),
            renderNutzungsschritte(),
            renderTarifkarten(),
            renderFaq()
        ]);
    }

    // ===== DATEN LADEN =====
    async function loadData() {
        try {
            // Parallel laden
            const [stations, bikes] = await Promise.all([
                fetchStations(),
                fetchAvailableBikes()
            ]);

            db_Stations = stations;
            db_Bikes = bikes;

            // Stats aktualisieren
            // Zwei Stellen zeigen dieselbe Zahl: die Kopfzeile der
            // Buehne und die Karte am unteren Rand.
            for (const id of ['bike-counter', 'bike-counter-karte']) {
                const el = document.getElementById(id);
                if (el) el.textContent = bikes.length;
            }
            // Die Stationszahl kommt aus velocity.v_kennzahl und wird von
            // renderKennzahlen gesetzt, nicht mehr hier.

            // Der Hoehenspiegel liest dieselben Stationsdaten wie die Karte.
            hoehenspiegelZeichnen(stations);

            console.log(`Geladen: ${stations.length} Stationen, ${bikes.length} Fahrräder`);
            return true;
        } catch (error) {
            console.error("Fehler beim Laden der Daten:", error);
            Toastify({ text: "Fehler beim Laden der Daten", backgroundColor: "#EF4444" }).showToast();
            return false;
        }
    }

    // ===== KARTE INITIALISIEREN =====
    const map = L.map('map', { zoomControl: false }).setView(APP_CONFIG.defaultMapCenter, APP_CONFIG.defaultZoom);
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap &copy; CARTO',
        maxZoom: 19
    }).addTo(map);

    // Geschaeftsgebiet Polygon (Wuerzburg)
    L.polygon([
        [49.8100, 9.9100], [49.8150, 9.9400], [49.7850, 9.9850],
        [49.7750, 9.9600], [49.7700, 9.9300], [49.7850, 9.9000]
    ], {
        color: '#D11231', fillColor: '#D11231', fillOpacity: 0.04,
        weight: 2, dashArray: '8, 8'
    }).addTo(map);

    const stationLayer = L.layerGroup().addTo(map);
    const bikeLayer = L.layerGroup().addTo(map);

    // ===== STATIONEN ANZEIGEN =====
    function renderStations() {
        stationLayer.clearLayers();

        db_Stations.forEach(station => {
            if (!station.latitude || !station.longitude) return;

            const stationIcon = L.divIcon({
                className: '',
                html: `<div style="background:#D11231; width:14px; height:14px; border:2px solid white; border-radius:2px; box-shadow: 0 4px 6px rgba(0,0,0,0.2);"></div>`,
                iconSize: [14, 14]
            });

            const popupContent = `
                <b>Hub: ${station.name}</b><br>
                ${station.strasse} ${station.hausnummer || ''}<br>
                <small>${station.plz} ${station.ort}</small><br>
                <span style="color:#6B7280;">Kapazitaet: ${station.kapazitaet} Stellplaetze</span>
            `;

            L.marker([station.latitude, station.longitude], { icon: stationIcon })
                .addTo(stationLayer)
                .bindPopup(popupContent);
        });
    }

    // ===== FAHRRAEDER ANZEIGEN =====
    const checkboxes = document.querySelectorAll('.filter-option input');

    function mapBikeType(bike) {
        // Die Sicht liefert einen sauberen Code; frueher wurde der
        // Anzeigename per Textvergleich geraten.
        switch (bike.typ_code) {
            case 'EBIKE': return 'ebike';
            case 'CARGO': return 'cargo';
            default:      return 'city';
        }
    }

    function updateMarkers() {
        bikeLayer.clearLayers();

        const activeFilters = Array.from(checkboxes).filter(cb => cb.checked).map(cb => cb.value);
        const filteredBikes = db_Bikes.filter(bike => activeFilters.includes(mapBikeType(bike)));

        document.getElementById("bike-counter").innerText = filteredBikes.length;

        filteredBikes.forEach(bike => {
            if (!bike.latitude || !bike.longitude) return;

            const bikeType = mapBikeType(bike);
            const baseBikeIcon = `<i class="fa-solid fa-bicycle marker-bike"></i>`;
            let subIconHtml = "";
            let typeLabel = "City-Bike";
            let batteryHtml = "";

            // Simulierter Akkustand fuer E-Bikes (da nicht in DB)
            // Echter Wert aus der Sicht. NULL bei Raedern ohne Akku -
            // das ist etwas anderes als ein leerer Akku.
            const akkustand = bike.akkustand_prozent;

            if (bikeType === 'ebike') {
                typeLabel = "E-Bike";
                let batColor = akkustand > 50 ? '#10B981' : akkustand > 20 ? '#F59E0B' : '#EF4444';
                subIconHtml = `<i class="fa-solid fa-bolt marker-sub" style="color: ${batColor};"></i>`;
                batteryHtml = akkustand === null || akkustand === undefined
                    ? ''
                    : `<div style="display:flex; justify-content:space-between; color:${batColor}; font-weight:600;"><span><i class="fa-solid fa-battery-half"></i> Akku:</span> <b>${akkustand}%</b></div>`;
            } else if (bikeType === 'cargo') {
                typeLabel = "Cargo-Bike";
                subIconHtml = `<i class="fa-solid fa-box marker-sub" style="color: #2563EB;"></i>`;
                batteryHtml = `<div style="display:flex; justify-content:space-between; color:#2563EB;"><span><i class="fa-solid fa-truck-fast"></i> Zuladung:</span> <b>100kg</b></div>`;
            }

            const bikeIcon = L.divIcon({
                className: '',
                html: `<div class="combined-icon-marker">${baseBikeIcon}${subIconHtml}</div>`,
                iconSize: [34, 34],
                iconAnchor: [17, 34],
                popupAnchor: [0, -34]
            });

            const priceInfo = bike.preis_pro_minute
                ? `${(bike.preis_pro_minute * 30).toFixed(2).replace('.', ',')} Euro / 30 Min`
                : '-';

            const popupContent = `
                <div style="text-align:center; min-width: 200px; padding: 5px;">
                    <h3 style="margin:0 0 8px 0; color:#111827; font-size: 1rem;">${typeLabel}</h3>
                    <div style="font-size:0.85em; margin-bottom:12px; color:#6B7280; background:#F3F4F6; padding:12px; border-radius:8px; text-align:left;">
                       <div style="display:flex; justify-content:space-between; margin-bottom:4px; border-bottom:1px solid #e5e7eb; padding-bottom:4px;">
                           <span><i class="fa-solid fa-hashtag"></i> ID:</span> <b>${bike.fahrrad_id}</b>
                       </div>
                       <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                           <span><i class="fa-solid fa-location-dot"></i> Station:</span> <b>${bike.station_name || '-'}</b>
                       </div>
                       <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                           <span><i class="fa-solid fa-euro-sign"></i> Preis:</span> <b>${priceInfo}</b>
                       </div>
                       ${batteryHtml}
                    </div>
                    <button onclick="window.reserveBike(${bike.fahrrad_id})" style="background:#D11231; color:white; border:none; padding:10px 0; border-radius:50px; cursor:pointer; width:100%; font-weight:600; font-size:0.9rem; box-shadow: 0 4px 6px rgba(209, 18, 49, 0.2);">Jetzt ausleihen</button>
                </div>
            `;

            L.marker([bike.latitude, bike.longitude], { icon: bikeIcon })
                .addTo(bikeLayer)
                .bindPopup(popupContent);
        });
    }

    checkboxes.forEach(cb => cb.addEventListener('change', updateMarkers));

    // ===== AUSLEIHE FUNKTION =====
    window.reserveBike = async function(bikeId) {
        if (!isAuthenticated()) {
            pendingReservationBikeId = bikeId;
            Toastify({
                text: "Bitte loggen Sie sich zuerst ein.",
                duration: 4000,
                backgroundColor: "#EF4444",
                gravity: "top",
                position: "center"
            }).showToast();
            openModal();
            return;
        }

        // Pruefen ob bereits aktive Ausleihe
        if (activeRental) {
            Toastify({
                text: "Sie haben bereits eine aktive Ausleihe. Bitte beenden Sie diese zuerst.",
                duration: 4000,
                backgroundColor: "#F59E0B",
                gravity: "top",
                position: "center"
            }).showToast();
            return;
        }

        try {
            Toastify({ text: "Ausleihe wird gestartet...", backgroundColor: "#6B7280" }).showToast();

            const result = await startRental(bikeId);

            if (result && result.ausleihe_id) {
                activeRental = {
                    ausleihe_id: result.ausleihe_id,
                    fahrrad_id: bikeId,
                    startzeit: new Date()
                };

                Toastify({
                    text: `Fahrrad #${bikeId} erfolgreich ausgeliehen!`,
                    duration: 5000,
                    gravity: "top",
                    position: "center",
                    backgroundColor: "#10B981"
                }).showToast();

                // Daten neu laden und Banner zeigen
                await loadData();
                updateMarkers();
                showRentalBanner();
            } else {
                throw new Error(result?.status_msg || 'Unbekannter Fehler');
            }
        } catch (error) {
            console.error('Ausleihe-Fehler:', error);
            Toastify({
                text: `Fehler: ${error.message}`,
                duration: 5000,
                backgroundColor: "#EF4444"
            }).showToast();
        }
    };

    // ===== AKTIVE AUSLEIHEN PRUEFEN =====
    async function checkActiveRentals() {
        if (!isAuthenticated()) return;

        try {
            const rentals = await fetchActiveRentals();
            if (rentals && rentals.length > 0) {
                const rental = rentals[0];
                activeRental = {
                    ausleihe_id: rental.ausleihe_id,
                    rahmennummer: rental.rahmennummer,
                    startzeit: new Date(rental.startzeit),
                    bikeInfo: rental.typ_bezeichnung || 'Fahrrad'
                };
                showRentalBanner();
            } else {
                activeRental = null;
                hideRentalBanner();
            }
        } catch (error) {
            console.error('Fehler beim Prüfen aktiver Ausleihen:', error);
        }
    }

    // ===== RENTAL BANNER =====
    function showRentalBanner() {
        if (!activeRental) return;

        const bikeInfo = document.getElementById("rental-bike-info");
        bikeInfo.textContent = `${activeRental.bikeInfo || 'Fahrrad'} ${activeRental.rahmennummer || ''}`.trim();

        rentalBanner.style.display = "block";
        startRentalTimer();
    }

    function hideRentalBanner() {
        rentalBanner.style.display = "none";
        stopRentalTimer();
    }

    function startRentalTimer() {
        stopRentalTimer();
        updateRentalDuration();
        rentalTimerInterval = setInterval(updateRentalDuration, 1000);
    }

    function stopRentalTimer() {
        if (rentalTimerInterval) {
            clearInterval(rentalTimerInterval);
            rentalTimerInterval = null;
        }
    }

    function updateRentalDuration() {
        if (!activeRental || !activeRental.startzeit) return;

        const now = new Date();
        const diff = Math.floor((now - activeRental.startzeit) / 1000);
        const minutes = Math.floor(diff / 60);
        const seconds = diff % 60;

        document.getElementById("rental-duration").textContent =
            `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }

    // ===== AUSLEIHE BEENDEN =====
    endRentalBtn.addEventListener("click", async () => {
        if (!activeRental) return;

        // Station auswaehlen (vorerst erste Station)
        const endStation = db_Stations[0];

        if (!endStation) {
            Toastify({ text: "Keine Station gefunden", backgroundColor: "#EF4444" }).showToast();
            return;
        }

        try {
            Toastify({ text: "Ausleihe wird beendet...", backgroundColor: "#6B7280" }).showToast();

            const result = await endRental(activeRental.ausleihe_id, endStation.station_id);

            const kosten = (result?.gesamtbetrag ?? null) !== null
                ? euro(result.gesamtbetrag)
                : '-';

            Toastify({
                text: `Ausleihe beendet! Dauer: ${result?.dauer_minuten ?? '-'} Min, Kosten: ${kosten}`,
                duration: 6000,
                gravity: "top",
                position: "center",
                backgroundColor: "#10B981"
            }).showToast();

            activeRental = null;
            hideRentalBanner();

            // Daten neu laden
            await loadData();
            updateMarkers();

        } catch (error) {
            console.error('Fehler beim Beenden:', error);
            Toastify({
                text: `Fehler: ${error.message}`,
                backgroundColor: "#EF4444"
            }).showToast();
        }
    });

    // ===== INITIALISIERUNG =====
    await renderInhalte();
    const dataLoaded = await loadData();

    if (dataLoaded) {
        renderStations();
        updateMarkers();
    } else {
        // Fallback: Zeige Fehlermeldung auf der Karte
        document.getElementById("bike-counter").innerText = "0";
    }

});
