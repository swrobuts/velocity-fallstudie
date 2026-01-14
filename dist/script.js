document.addEventListener("DOMContentLoaded", () => {
    
    // Auth & UI State
    let isLoggedIn = false;
    let currentUser = null;
    let pendingReservationBikeId = null;

    const modal = document.getElementById("auth-modal");
    const userNavBtn = document.getElementById("user-nav-btn");
    const closeBtn = document.querySelector(".close-modal");
    
    function updateUI() {
        if (isLoggedIn) {
            userNavBtn.innerHTML = `<i class="fa-solid fa-circle-user"></i> ${currentUser}`;
            userNavBtn.classList.remove("btn-primary");
            userNavBtn.classList.add("btn-outline");
            userNavBtn.onclick = (e) => {
                e.preventDefault();
                isLoggedIn = false; currentUser = null; updateUI();
                Toastify({ text: "Erfolgreich ausgeloggt.", backgroundColor: "#374151", position: "right" }).showToast();
            };
        } else {
            userNavBtn.innerHTML = `<i class="fa-regular fa-user"></i> Login`;
            userNavBtn.classList.add("btn-primary");
            userNavBtn.classList.remove("btn-outline");
            userNavBtn.onclick = (e) => { e.preventDefault(); openModal(); };
        }
    }

    function openModal() { modal.style.display = "flex"; document.querySelector('.auth-tab[data-target="login-form"]').click(); }
    function closeModal() { modal.style.display = "none"; }
    closeBtn.addEventListener("click", closeModal);
    window.addEventListener("click", (e) => { if (e.target == modal) closeModal(); });

    // Tabs
    document.querySelectorAll(".auth-tab").forEach(tab => {
        tab.addEventListener("click", () => {
            document.querySelectorAll(".auth-tab").forEach(t => t.classList.remove("active"));
            tab.classList.add("active");
            const targetId = tab.getAttribute("data-target");
            document.querySelectorAll(".auth-form").forEach(form => {
                form.classList.remove("active");
                if(form.id === targetId) form.classList.add("active");
            });
        });
    });

    document.getElementById("login-form").addEventListener("submit", (e) => {
        e.preventDefault();
        isLoggedIn = true; currentUser = "Student"; 
        closeModal(); updateUI();
        Toastify({ text: "Willkommen zurück!", backgroundColor: "#10B981" }).showToast();
        if (pendingReservationBikeId) { setTimeout(() => { window.reserveBike(pendingReservationBikeId); pendingReservationBikeId = null; }, 500); }
    });

    document.getElementById("register-form").addEventListener("submit", (e) => {
        e.preventDefault();
        isLoggedIn = true; currentUser = "Neu"; 
        closeModal(); updateUI();
        Toastify({ text: "Konto erstellt!", backgroundColor: "#10B981" }).showToast();
        if (pendingReservationBikeId) { setTimeout(() => { window.reserveBike(pendingReservationBikeId); pendingReservationBikeId = null; }, 500); }
    });

    updateUI();

    // DB Simulation
    const db_Stations = [
        { id: 1, name: "Hauptbahnhof", lat: 49.8014, lng: 9.9363, cap: 50 },
        { id: 2, name: "Juliuspromenade", lat: 49.7975, lng: 9.9315, cap: 20 },
        { id: 3, name: "Sanderring (Uni)", lat: 49.7890, lng: 9.9360, cap: 30 },
        { id: 4, name: "Residenzplatz", lat: 49.7928, lng: 9.9395, cap: 15 },
        { id: 5, name: "Alte Mainbrücke", lat: 49.7932, lng: 9.9295, cap: 10 },
        { id: 6, name: "Hubland Campus", lat: 49.7830, lng: 9.9700, cap: 40 },
        { id: 7, name: "Zellerau", lat: 49.7990, lng: 9.9150, cap: 12 },
        { id: 8, name: "Grombühl", lat: 49.8050, lng: 9.9450, cap: 18 }
    ];

    function getRandomInRange(from, to, fixed) { return (Math.random() * (to - from) + from).toFixed(fixed) * 1; }

    let db_Bikes = [];
    const types = ["city", "city", "city", "city", "city", "ebike", "ebike", "ebike", "cargo"]; 
    const conditions = ["Neuwertig", "Sehr gut", "Gut", "OK"];

    for(let i = 1; i <= 120; i++) {
        let randLat = getRandomInRange(49.7800, 49.8050, 4);
        let randLng = getRandomInRange(9.9100, 9.9700, 4);
        let randType = types[Math.floor(Math.random() * types.length)];
        let randBat = Math.floor(Math.random() * 100);
        let randCond = conditions[Math.floor(Math.random() * conditions.length)];
        
        let gears = (randType === 'city') ? 8 : 11;

        db_Bikes.push({ 
            id: `WÜ-${randType.toUpperCase().substring(0,1)}-${1000 + i}`, 
            type: randType, lat: randLat, lng: randLng, 
            status: "available", battery: randBat, gears: gears, condition: randCond
        });
    }

    const map = L.map('map', { zoomControl: false }).setView([49.7930, 9.9360], 14);
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { attribution: '&copy; OpenStreetMap &copy; CARTO', maxZoom: 19 }).addTo(map);
    L.polygon([[49.8100, 9.9100], [49.8150, 9.9400], [49.7850, 9.9850], [49.7750, 9.9600], [49.7700, 9.9300], [49.7850, 9.9000]], { color: '#D11231', fillColor: '#D11231', fillOpacity: 0.04, weight: 2, dashArray: '8, 8' }).addTo(map);

    const stationLayer = L.layerGroup().addTo(map);
    const bikeLayer = L.layerGroup().addTo(map);

    db_Stations.forEach(station => {
        const stationIcon = L.divIcon({ className: '', html: `<div style="background:#D11231; width:14px; height:14px; border:2px solid white; border-radius:2px; box-shadow: 0 4px 6px rgba(0,0,0,0.2);"></div>`, iconSize: [14, 14] });
        L.marker([station.lat, station.lng], {icon: stationIcon}).addTo(stationLayer).bindPopup(`<b>Hub: ${station.name}</b><br>Kapazität: ${station.cap}`);
    });

    const checkboxes = document.querySelectorAll('.filter-option input');
    
    function updateMarkers() {
        bikeLayer.clearLayers();
        const activeFilters = Array.from(checkboxes).filter(cb => cb.checked).map(cb => cb.value);
        const filteredBikes = db_Bikes.filter(bike => activeFilters.includes(bike.type));
        
        document.getElementById("bike-counter").innerText = filteredBikes.length;

        filteredBikes.forEach(bike => {
            const baseBikeIcon = `<i class="fa-solid fa-bicycle marker-bike"></i>`;
            let subIconHtml = "";
            let typeLabel = "City-Bike";
            let batteryHtml = "";

            if(bike.type === 'ebike') {
                typeLabel = "E-Bike";
                let batColor = bike.battery > 50 ? '#10B981' : bike.battery > 20 ? '#F59E0B' : '#EF4444'; 
                subIconHtml = `<i class="fa-solid fa-bolt marker-sub" style="color: ${batColor};"></i>`;
                batteryHtml = `<div style="display:flex; justify-content:space-between; color:${batColor}; font-weight:600;"><span><i class="fa-solid fa-battery-half"></i> Akku:</span> <b>${bike.battery}%</b></div>`;
            } else if (bike.type === 'cargo') {
                typeLabel = "Cargo-Bike";
                subIconHtml = `<i class="fa-solid fa-box marker-sub" style="color: #2563EB;"></i>`;
                batteryHtml = `<div style="display:flex; justify-content:space-between; color:#2563EB;"><span><i class="fa-solid fa-truck-fast"></i> Zuladung:</span> <b>100kg</b></div>`;
            }

            const bikeIcon = L.divIcon({ className: '', html: `<div class="combined-icon-marker">${baseBikeIcon}${subIconHtml}</div>`, iconSize: [34, 34], iconAnchor: [17, 34], popupAnchor: [0, -34] });
            
            const popupContent = `
                <div style="text-align:center; min-width: 200px; padding: 5px;">
                    <h3 style="margin:0 0 8px 0; color:#111827; font-size: 1rem;">${typeLabel}</h3>
                    <div style="font-size:0.85em; margin-bottom:12px; color:#6B7280; background:#F3F4F6; padding:12px; border-radius:8px; text-align:left;">
                       <div style="display:flex; justify-content:space-between; margin-bottom:4px; border-bottom:1px solid #e5e7eb; padding-bottom:4px;"><span><i class="fa-solid fa-hashtag"></i> ID:</span> <b>${bike.id.split('-')[1]}</b></div>
                       <div style="display:flex; justify-content:space-between; margin-bottom:4px;"><span><i class="fa-solid fa-gears"></i> Gänge:</span> <b>${bike.gears}</b></div>
                       <div style="display:flex; justify-content:space-between; margin-bottom:4px;"><span><i class="fa-solid fa-screwdriver-wrench"></i> Zustand:</span> <b>${bike.condition}</b></div>
                       ${batteryHtml}
                    </div>
                    <button onclick="window.reserveBike('${bike.id}')" style="background:#D11231; color:white; border:none; padding:10px 0; border-radius:50px; cursor:pointer; width:100%; font-weight:600; font-size:0.9rem; box-shadow: 0 4px 6px rgba(209, 18, 49, 0.2);">Jetzt reservieren</button>
                </div>
            `;
            L.marker([bike.lat, bike.lng], {icon: bikeIcon}).addTo(bikeLayer).bindPopup(popupContent);
        });
    }

    checkboxes.forEach(cb => cb.addEventListener('change', updateMarkers));
    updateMarkers();

    window.reserveBike = function(bikeId) {
        if (!isLoggedIn) {
            pendingReservationBikeId = bikeId;
            Toastify({ text: "Bitte logge dich zuerst ein.", duration: 4000, backgroundColor: "#EF4444", gravity: "top", position: "center" }).showToast();
            openModal();
        } else {
            Toastify({ text: `Fahrrad ${bikeId} erfolgreich reserviert!`, duration: 5000, gravity: "top", position: "center", backgroundColor: "#10B981" }).showToast();
        }
    };
});