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
            Toastify({ text: "Willkommen zurueck!", backgroundColor: "#10B981" }).showToast();

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
                Toastify({ text: "Konto erstellt! Bitte bestaetigen Sie Ihre E-Mail.", backgroundColor: "#F59E0B", duration: 6000 }).showToast();
            } else {
                Toastify({ text: error.message, backgroundColor: "#EF4444" }).showToast();
            }
        }
    });

    // ===== AUTH STATE LISTENER =====
    onAuthStateChange(updateUI);

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
            document.getElementById("bike-counter").innerText = bikes.length;
            document.getElementById("stat-stations").innerText = stations.length;

            console.log(`Geladen: ${stations.length} Stationen, ${bikes.length} Fahrraeder`);
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
        // Mapping von DB-Typ zu Filter-Wert
        const typeName = (bike.typ_name || '').toLowerCase();
        if (typeName.includes('cargo') || typeName.includes('lasten')) return 'cargo';
        if (bike.hat_elektro) return 'ebike';
        return 'city';
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
            const simulatedBattery = Math.floor(Math.random() * 100);

            if (bikeType === 'ebike') {
                typeLabel = "E-Bike";
                let batColor = simulatedBattery > 50 ? '#10B981' : simulatedBattery > 20 ? '#F59E0B' : '#EF4444';
                subIconHtml = `<i class="fa-solid fa-bolt marker-sub" style="color: ${batColor};"></i>`;
                batteryHtml = `<div style="display:flex; justify-content:space-between; color:${batColor}; font-weight:600;"><span><i class="fa-solid fa-battery-half"></i> Akku:</span> <b>${simulatedBattery}%</b></div>`;
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
                    fahrrad_id: rental.fahrrad?.fahrrad_id,
                    startzeit: new Date(rental.startzeit),
                    bikeInfo: rental.fahrrad?.fahrradtyp?.bezeichnung || 'Fahrrad'
                };
                showRentalBanner();
            } else {
                activeRental = null;
                hideRentalBanner();
            }
        } catch (error) {
            console.error('Fehler beim Pruefen aktiver Ausleihen:', error);
        }
    }

    // ===== RENTAL BANNER =====
    function showRentalBanner() {
        if (!activeRental) return;

        const bikeInfo = document.getElementById("rental-bike-info");
        bikeInfo.textContent = `${activeRental.bikeInfo || 'Fahrrad'} #${activeRental.fahrrad_id}`;

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

            const kosten = result?.berechnete_kosten
                ? `${parseFloat(result.berechnete_kosten).toFixed(2).replace('.', ',')} Euro`
                : '-';

            Toastify({
                text: `Ausleihe beendet! Kosten: ${kosten}`,
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
    const dataLoaded = await loadData();

    if (dataLoaded) {
        renderStations();
        updateMarkers();
    } else {
        // Fallback: Zeige Fehlermeldung auf der Karte
        document.getElementById("bike-counter").innerText = "0";
        document.getElementById("stat-stations").innerText = "0";
    }

});
