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

    /* Bezugshoehen aus velocity.v_hoehenmarke. Sie standen frueher in
       einer eigenen Grafik unter der Karte; die ist entfallen. Die
       Angabe gehoert dorthin, wo man sie braucht: ins Popover der
       Station, die man gerade anschaut. */
    let hoehenMarken = [];

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
                <h3>${escapeHtml(schritt.titel)}</h3>
                <p>${escapeHtml(schritt.beschreibung)}</p>
            </div>`).join('');
    }

    async function renderTarifkarten() {
        const ziel = document.getElementById('pricing-grid');
        if (!ziel) return;
        const karten = await fetchTarifkarten();
        // Die Hervorhebung haengt am Fahrradtyp, nicht an der Position in
        // der Liste. Sortiert wird nach typ_id; an die Position gebunden
        // wanderte sie bei jeder Preisaenderung auf eine andere Karte -
        // nach der Anhebung des Minutenpreises sass sie am Lastenrad.
        ziel.innerHTML = karten.map((k) => {
          const hervor = k.typ_code === 'EBIKE';
          return `
            <div class="price-card${hervor ? ' popular' : ''}">
                ${hervor ? '<div class="badge-pop">Beliebteste Wahl</div>' : ''}
                <div class="card-content">
                    <div class="header">${escapeHtml(k.bezeichnung)}</div>
                    <div class="price">${euro(k.preis_30_minuten)} <small>/ 30 Min</small></div>
                    <ul class="features-list">
                        ${(k.merkmale || []).map(m =>
                            `<li><i class="fa-solid fa-check"></i> ${escapeHtml(m)}</li>`).join('')}
                    </ul>
                </div>
                <button class="${hervor ? 'btn-primary' : 'btn-outline'} full-width"
                        onclick="document.getElementById('map-section').scrollIntoView()">
                    Fahrt starten
                </button>
            </div>`;
        }).join('');
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

    /* =================================================================
       PREISRECHNER

       Vorher lief hier eine Uhr und der Betrag stieg von selbst. Das
       war huebsch, aber niemand konnte daran ablesen, was eine
       bestimmte Fahrt kostet. Jetzt gibt man die Fahrzeit ein.

       Gerechnet wird mit denselben Regeln wie in der Datenbank:
       angefangene Minuten aufgerundet (GR6), Deckelung auf den
       Tageshoechstpreis. Die Saetze kommen aus v_tarifkarte, stehen
       also nicht im Frontend. Die Aufschluesselung unten entspricht
       Zeile fuer Zeile dem, was velocity.entgeltposition speichert.
       ================================================================= */
    let rechnerTarife = [];
    let rechnerAktiv = 0;

    function rechnerBetrag(t, minuten) {
        const start = Number(t.startgebuehr);
        const zeit  = Math.ceil(minuten) * Number(t.preis_pro_minute);
        const deckel = Number(t.tageshoechstpreis);
        const roh = start + zeit;
        return { start, zeit, deckel, roh, betrag: Math.min(roh, deckel),
                 gekappt: roh > deckel };
    }

    function rechnerZeichnen() {
        const wert   = document.getElementById('meter-value');
        const posten = document.getElementById('meter-detail');
        const feld   = document.getElementById('meter-minuten');
        if (!wert || !rechnerTarife.length) return;

        const t = rechnerTarife[rechnerAktiv];
        const minuten = Math.max(1, Math.min(1440, Number(feld.value) || 1));
        const r = rechnerBetrag(t, minuten);

        wert.textContent = r.betrag.toLocaleString('de-DE',
            { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        const zeilen = [
            ['Startgebühr', euro(r.start)],
            [`Zeitentgelt · ${minuten} Min × ${euro(t.preis_pro_minute)}`, euro(r.zeit)]
        ];
        if (r.gekappt) {
            zeilen.push([`Kappung auf Tageshöchstpreis ${euro(r.deckel)}`,
                         '− ' + euro(r.roh - r.deckel)]);
        }
        posten.innerHTML = zeilen.map(([b, w], i) =>
            `<li${i === zeilen.length - 1 && r.gekappt ? ' class="ist-abzug"' : ''}>
               <span>${escapeHtml(b)}</span><b>${escapeHtml(w)}</b></li>`).join('');
    }

    function rechnerTypenZeichnen() {
        const ziel = document.getElementById('meter-switch');
        if (!ziel) return;
        ziel.innerHTML = rechnerTarife.map((t, i) =>
            `<button type="button" data-i="${i}" aria-pressed="${i === rechnerAktiv}">` +
            `${escapeHtml(t.bezeichnung)}</button>`).join('');
        ziel.querySelectorAll('button').forEach(b => {
            b.addEventListener('click', () => {
                rechnerAktiv = Number(b.dataset.i);
                rechnerTypenZeichnen();
                rechnerZeichnen();
            });
        });
    }

    async function rechnerStarten() {
        if (!document.getElementById('fare-meter')) return;
        const karten = await fetchTarifkarten();
        rechnerTarife = karten.filter(k => k.preis_pro_minute !== null);
        const posten = document.getElementById('meter-detail');
        if (!rechnerTarife.length) {
            if (posten) posten.innerHTML = '<li><span>Tarife nicht verfügbar</span></li>';
            return;
        }
        // E-Bike voreingestellt: das ist das Rad fuer den Berg.
        const ebike = rechnerTarife.findIndex(t => t.typ_code === 'EBIKE');
        rechnerAktiv = ebike >= 0 ? ebike : 0;

        const feld   = document.getElementById('meter-minuten');
        const regler = document.getElementById('meter-regler');
        feld.addEventListener('input', () => {
            if (Number(feld.value) <= Number(regler.max)) regler.value = feld.value;
            rechnerZeichnen();
        });
        regler.addEventListener('input', () => { feld.value = regler.value; rechnerZeichnen(); });

        rechnerTypenZeichnen();
        rechnerZeichnen();
    }

    async function renderInhalte() {
        await Promise.all([
            rechnerStarten(),
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

            // Die Bezugshoehen fuers Popover, einmal geladen.
            if (!hoehenMarken.length) hoehenMarken = await fetchHoehenmarken();
            if (!geschaeftsgebiet) await geschaeftsgebietZeichnen();

            console.log(`Geladen: ${stations.length} Stationen, ${bikes.length} Fahrräder`);
            return true;
        } catch (error) {
            console.error("Fehler beim Laden der Daten:", error);
            Toastify({ text: "Fehler beim Laden der Daten", backgroundColor: "#EF4444" }).showToast();
            return false;
        }
    }

    // ===== KARTE INITIALISIEREN =====
    /* Das Mausrad zoomt NICHT von sich aus. Wer die Seite ueber der
       Karte scrollt, will die Seite scrollen - nicht zoomen. Erst ein
       Klick in die Karte gibt das Rad frei, ein Verlassen nimmt es
       wieder. Genau das war das frustrierende Verhalten. */
    const map = L.map('map', {
        zoomControl: false,
        scrollWheelZoom: false,
        maxBoundsViscosity: 0.85,
        // Viertelstufen: der Ausschnitt laesst sich damit genauer an das
        // Seitenverhaeltnis des Rahmens anpassen als in ganzen Stufen.
        zoomSnap: 0.25,
        zoomDelta: 0.5
    }).setView(APP_CONFIG.defaultMapCenter, APP_CONFIG.defaultZoom);
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    const radHinweis = document.getElementById('karte-hinweis');
    function radFreigeben() {
        map.scrollWheelZoom.enable();
        if (radHinweis) radHinweis.classList.add('ist-aus');
    }
    function radSperren() {
        map.scrollWheelZoom.disable();
        if (radHinweis) radHinweis.classList.remove('ist-aus');
    }
    map.on('click', radFreigeben);
    map.on('focus', radFreigeben);
    map.getContainer().addEventListener('mouseleave', radSperren);

    // Zurueck aufs Gebiet: in der Karte und ueber den Verweis oben.
    document.getElementById('karte-zurueck')?.addEventListener('click', gebietZeigen);
    document.querySelectorAll('a[href="#map-section"]').forEach(a =>
        a.addEventListener('click', () => setTimeout(gebietZeigen, 400)));
    // light_all ist fast weiss - Strassen, Gruen und Wasser verschwinden
    // darin. Voyager bleibt hell, zeichnet die Stadt aber lesbar.
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap &copy; CARTO',
        maxZoom: 19
    }).addTo(map);

    // Das Geschaeftsgebiet kommt aus velocity.v_geschaeftsgebiet. Frueher
    // stand das Vieleck hier fest im Skript - die Karte zeichnete eine
    // Regel, die die Datenbank nicht kannte. Jetzt ist es umgekehrt: die
    // Datenbank haelt die Regel und setzt sie beim Beenden einer Fahrt
    // durch, die Karte zeichnet nur noch nach.
    let geschaeftsgebiet = null;

    // Der Typ polygon kommt als Text: ((Laenge,Breite),(Laenge,Breite),…)
    // Leaflet will [Breite, Laenge] - deshalb wird gedreht.
    function umrissLesen(text) {
        return [...String(text).matchAll(/\(([-0-9.]+),([-0-9.]+)\)/g)]
            .map(m => [Number(m[2]), Number(m[1])]);
    }

    async function geschaeftsgebietZeichnen() {
        const gebiete = await fetchGeschaeftsgebiete();
        const wue = gebiete.find(g => g.name === 'Würzburg') || gebiete[0];
        if (!wue) return;
        geschaeftsgebiet = L.polygon(umrissLesen(wue.umriss), {
            color: '#f00038', fillColor: '#f00038', fillOpacity: 0.07,
            weight: 2.5, dashArray: '8, 6', lineJoin: 'round'
        }).addTo(map);
        gebietZeigen();
        // Die Karte darf das Gebiet nicht verlassen. Ohne diese Grenze
        // landet man mit zwei Wischern in Fuchsstadt und findet nicht
        // zurueck - und genau das ist passiert.
        map.setMaxBounds(geschaeftsgebiet.getBounds().pad(0.45));
        map.setMinZoom(map.getZoom() - 1);
        karteEingepasst = true;
    }

    const stationLayer = L.layerGroup().addTo(map);
    const bikeLayer = L.layerGroup().addTo(map);

    /* =================================================================
       KARTE

       Vorher wurde je verfuegbarem Rad ein Marker gezeichnet - 293
       Stueck. Da alle Raeder einer Station deren Koordinate teilen
       (v_verfuegbares_fahrrad faellt ueber coalesce auf die Station
       zurueck), lagen sie exakt uebereinander. Zu sehen war ein
       einziges Radsymbol je Station, ganz gleich ob 17 oder 28 Raeder
       dort standen. Genau das war die Verwirrung.

       Jetzt traegt jede Station EINEN Marker mit der Zahl der freien
       Raeder. Das Popover schluesselt nach Fahrradtyp auf und leiht
       direkt. Frei abgestellte Raeder bekommen weiterhin einen
       eigenen Marker - sie stehen ja wirklich einzeln.
       ================================================================= */
    const TYP_BILD = {
        CITY:  'assets/rad-city.jpg',
        EBIKE: 'assets/rad-ebike.jpg',
        CARGO: 'assets/rad-cargo.jpg'   // vom Nutzer geliefert
    };
    // Die Filterwerte im HTML sind kurz, der Fachschluessel ist lang.
    const TYP_FILTER = { CITY: 'city', EBIKE: 'ebike', CARGO: 'cargo' };

    const checkboxes = document.querySelectorAll('.filter-option input');

    function gewaehlteTypen() {
        return new Set(Array.from(checkboxes).filter(cb => cb.checked).map(cb => cb.value));
    }

    function radzahlAnzeigen(n) {
        for (const id of ['bike-counter', 'bike-counter-karte']) {
            const el = document.getElementById(id);
            if (el) el.textContent = n;
        }
    }

    function akkuFarbe(prozent) {
        if (prozent === null || prozent === undefined) return null;
        return prozent > 50 ? '#0f9d63' : prozent > 20 ? '#c98a00' : '#c8002f';
    }

    /* Eine Zeile im Popover: Bild, Name, Zahl, Preis, Schaltflaeche. */
    function typZeile(typCode, raeder) {
        const erstes = raeder[0];
        const bild = TYP_BILD[typCode];
        const preis = erstes.preis_pro_minute
            ? euro(Number(erstes.startgebuehr) + Number(erstes.preis_pro_minute) * 30)
            : '—';

        // Akkustand nur bei Raedern mit Akku, und dann der beste im Bestand:
        // das Rad, das die Ausleihe vergibt, ist das mit der meisten Ladung.
        let akku = '';
        if (erstes.hat_elektro) {
            const werte = raeder.map(r => r.akkustand_prozent).filter(v => v !== null && v !== undefined);
            if (werte.length) {
                const beste = Math.max(...werte);
                akku = `<span class="pop-akku" style="color:${akkuFarbe(beste)}">
                          <i class="fa-solid fa-bolt"></i> bis ${beste}&thinsp;% Akku</span>`;
            }
        }

        const bestes = erstes.hat_elektro
            ? raeder.slice().sort((a, b) => (b.akkustand_prozent || 0) - (a.akkustand_prozent || 0))[0]
            : erstes;

        return `
          <div class="pop-typ">
            <div class="pop-bild">${bild
                ? `<img src="${bild}" alt="${escapeHtml(erstes.typ_bezeichnung)}" loading="lazy"
                        onerror="this.replaceWith(Object.assign(document.createElement('span'),
                                 {className:'pop-kein-bild', innerHTML:'<i class=\'fa-solid fa-box\'></i>'}))">`
                : `<span class="pop-kein-bild"><i class="fa-solid fa-box"></i></span>`}</div>
            <div class="pop-text">
              <strong>${escapeHtml(erstes.typ_bezeichnung)}</strong>
              <span class="pop-zahl">${raeder.length} frei</span>
              <span class="pop-preis">${preis} / 30 Min</span>
              ${akku}
            </div>
            <button type="button" class="pop-leihen" data-rad="${bestes.fahrrad_id}">Leihen</button>
          </div>`;
    }

    /* Wie hoch liegt diese Station, und wie weit ist es von dort noch
       hinauf? Die Bezugshoehen kommen aus velocity.v_hoehenmarke, die
       Hoehe der Station aus v_station. Fehlt eine der beiden Angaben,
       entfaellt die Zeile - sie wird nicht geraten. */
    function hoehenZeile(station) {
        if (!Number.isFinite(station.hoehe_m) || !hoehenMarken.length) return '';
        const hinauf = hoehenMarken
            .filter(m => m.hoehe_m > station.hoehe_m)
            .map(m => `${escapeHtml(m.name)} +${m.hoehe_m - station.hoehe_m}`)
            .join(' · ');
        return `
            <div class="pop-hoehe">
              <span class="pop-hoehe-wert">${station.hoehe_m} m</span>
              <span class="pop-hoehe-rest">${hinauf || 'höchster Punkt im Netz'}</span>
            </div>`;
    }

    function stationsPopover(station, raeder) {
        const nachTyp = new Map();
        for (const r of raeder) {
            if (!nachTyp.has(r.typ_code)) nachTyp.set(r.typ_code, []);
            nachTyp.get(r.typ_code).push(r);
        }
        const reihenfolge = ['CITY', 'EBIKE', 'CARGO'].filter(t => nachTyp.has(t));
        const zeilen = reihenfolge.map(t => typZeile(t, nachTyp.get(t))).join('');

        return `
          <div class="pop">
            <div class="pop-kopf">
              <span class="pop-marke">Station</span>
              <strong>${escapeHtml(station.name)}</strong>
              <span class="pop-adresse">${escapeHtml(station.strasse || '')} ${escapeHtml(station.hausnummer || '')}${station.plz ? ' · ' + escapeHtml(station.plz) + ' ' + escapeHtml(station.ort) : ''}</span>
              <span class="pop-frei">${raeder.length} ${raeder.length === 1 ? 'Rad' : 'Räder'} gerade frei</span>
            </div>
            ${hoehenZeile(station)}
            ${zeilen || '<p class="pop-leer">Gerade kein Rad des gewählten Typs hier.</p>'}
            <p class="pop-fuss">Nach dem Leihen öffnet sich das Schloss automatisch.
               Abstellen an einer Station oder frei im Geschäftsgebiet — ohne Zuschlag.</p>
          </div>`;
    }

    function freiesRadPopover(rad) {
        return `
          <div class="pop">
            <div class="pop-kopf">
              <span class="pop-marke">Frei abgestellt</span>
              <strong>${escapeHtml(rad.typ_bezeichnung)}</strong>
              <span class="pop-adresse">Rahmennummer ${escapeHtml(rad.rahmennummer)}</span>
            </div>
            ${typZeile(rad.typ_code, [rad])}
            <p class="pop-fuss">Nach dem Leihen öffnet sich das Schloss automatisch.</p>
          </div>`;
    }

    /* Stationsmarker: eine Scheibe mit der Zahl der freien Raeder.
       Der Durchmesser waechst mit der Wurzel der Anzahl - die
       Kreisflaeche wuerde den Unterschied sonst uebertreiben. */
    function stationsSymbol(anzahl) {
        const d = Math.round(30 + Math.sqrt(anzahl) * 3.4);
        return L.divIcon({
            className: '',
            html: `<div class="karten-station" style="width:${d}px;height:${d}px">
                     <span>${anzahl}</span></div>`,
            iconSize: [d, d],
            iconAnchor: [d / 2, d / 2],
            popupAnchor: [0, -d / 2 - 4]
        });
    }

    function freiesSymbol(rad) {
        const klasse = rad.typ_code === 'CARGO' ? 'ist-cargo'
                     : rad.hat_elektro ? 'ist-ebike' : 'ist-city';
        return L.divIcon({
            className: '',
            html: `<div class="karten-rad ${klasse}"><i class="fa-solid fa-bicycle"></i></div>`,
            // Mittig verankert wie die Stationsscheiben: der Kreis sitzt
            // AUF dem Punkt. Haengt er darueber, sehen Raeder nahe der
            // Gebietsgrenze aus, als staenden sie ausserhalb.
            iconSize: [24, 24], iconAnchor: [12, 12], popupAnchor: [0, -14]
        });
    }

    let karteEingepasst = false;

    /* Zurueck auf das Geschaeftsgebiet. Haengt an der Schaltflaeche in
       der Karte und am Verweis "Live-Karte" in der Kopfzeile. */
    function gebietZeigen() {
        if (!geschaeftsgebiet) return;
        const grenzen = geschaeftsgebiet.getBounds();
        map.fitBounds(grenzen, { padding: [30, 30] });

        // Das Gebiet ist rund 6 mal 5 Kilometer, der Kartenrahmen aber
        // viel breiter als hoch. fitBounds richtet sich nach der engeren
        // Seite - also nach der Hoehe - und laesst links und rechts
        // Landschaft stehen. Auf breiten Rahmen wird deshalb
        // nachgezoomt, bis die Stadt die Breite traegt. Oben und unten
        // wird dabei etwas beschnitten; maxBounds haelt den Ausschnitt
        // trotzdem am Gebiet.
        const el = map.getContainer();
        const verhaeltnis = el.clientWidth / Math.max(el.clientHeight, 1);
        if (verhaeltnis > 1.5) {
            // 1.4 als Bezug: bei einem breiteren Rahmen wird so weit
            // nachgezoomt, dass die Stadt die Breite traegt, der Umriss
            // aber gerade noch ganz ins Bild passt.
            const zu = Math.min(Math.log2(verhaeltnis / 1.4), 1.25);
            map.setZoom(map.getZoom() + Math.round(zu * 4) / 4);
        }
    }

    function karteZeichnen() {
        stationLayer.clearLayers();
        bikeLayer.clearLayers();

        const typen = gewaehlteTypen();
        const raeder = db_Bikes.filter(r => typen.has(TYP_FILTER[r.typ_code] || 'city'));
        radzahlAnzeigen(raeder.length);

        const proStation = new Map();
        const freie = [];
        for (const r of raeder) {
            if (r.station_id) {
                if (!proStation.has(r.station_id)) proStation.set(r.station_id, []);
                proStation.get(r.station_id).push(r);
            } else if (r.latitude && r.longitude) {
                freie.push(r);
            }
        }

        const punkte = [];
        for (const station of db_Stations) {
            if (!station.latitude || !station.longitude) continue;
            const hier = proStation.get(station.station_id) || [];
            punkte.push([station.latitude, station.longitude]);
            L.marker([station.latitude, station.longitude], {
                icon: stationsSymbol(hier.length),
                title: `${station.name} — ${hier.length} frei`
            }).addTo(stationLayer)
              .bindPopup(stationsPopover(station, hier), { maxWidth: 340, minWidth: 300 });
        }

        for (const rad of freie) {
            punkte.push([rad.latitude, rad.longitude]);
            L.marker([rad.latitude, rad.longitude], { icon: freiesSymbol(rad) })
             .addTo(bikeLayer)
             .bindPopup(freiesRadPopover(rad), { maxWidth: 340, minWidth: 300 });
        }

        // Der Ausschnitt folgt dem Geschaeftsgebiet; das setzt
        // geschaeftsgebietZeichnen, sobald die Sicht geladen ist.
    }

    checkboxes.forEach(cb => cb.addEventListener('change', karteZeichnen));

    // Ein Klick im Popover leiht. Delegiert, weil Popovers erst beim
    // Oeffnen in den Baum kommen.
    document.addEventListener('click', (e) => {
        const knopf = e.target.closest('.pop-leihen');
        if (knopf) window.reserveBike(Number(knopf.dataset.rad));
    });

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
                karteZeichnen();
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
            karteZeichnen();

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
        karteZeichnen();
    } else {
        // Fallback: Zeige Fehlermeldung auf der Karte
        document.getElementById("bike-counter").innerText = "0";
    }

});
