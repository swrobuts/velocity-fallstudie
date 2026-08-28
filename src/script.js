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

    /* =================================================================
       KOPFZEILE IM ANGEMELDETEN ZUSTAND

       Vorher trug der Knopf nur den Vornamen, und ein Klick meldete
       sofort ab. Das war doppelt unguenstig: die Wirkung stand nirgends,
       und wer sie ausloeste, konnte sich hinterher nicht sofort wieder
       anmelden - eine Aussenpruefung meldete den Knopf danach als tot.
       Jetzt oeffnet der Knopf ein Menue, und Abmelden ist ein eigener,
       beschrifteter Eintrag.
       ================================================================= */
    const kontoMenue = document.getElementById('konto-menue');

    function kontoMenueSetzen(offen) {
        if (!kontoMenue) return;
        kontoMenue.hidden = !offen;
        userNavBtn.setAttribute('aria-expanded', String(offen));
    }

    function abmelden() {
        kontoMenueSetzen(false);
        logout()
            .then(() => Toastify({ text: 'Abgemeldet. Bis bald!',
                                   backgroundColor: '#374151', position: 'right' }).showToast())
            .catch(err => Toastify({ text: err.message, backgroundColor: '#EF4444' }).showToast());
    }

    document.getElementById('konto-abmelden')?.addEventListener('click', abmelden);
    kontoMenue?.querySelectorAll('a').forEach(a =>
        a.addEventListener('click', () => kontoMenueSetzen(false)));

    document.addEventListener('click', (e) => {
        if (!kontoMenue || kontoMenue.hidden) return;
        if (!kontoMenue.contains(e.target) && e.target !== userNavBtn
            && !userNavBtn.contains(e.target)) kontoMenueSetzen(false);
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && kontoMenue && !kontoMenue.hidden) {
            kontoMenueSetzen(false);
            userNavBtn.focus();
        }
    });

    // ===== UI UPDATE FUNKTION =====
    function updateUI(user) {
        if (user) {
            const name = getUserDisplayName();
            userNavBtn.innerHTML = `<i class="fa-solid fa-circle-user"></i> ${escapeHtml(name)}`;
            /* Der Knopf traegt seine Gestalt jetzt selbst (.login im
               Stylesheet). Bis zum 28.08.2026 schaltete er hier zwischen
               btn-primary und btn-outline um - mit dem Ergebnis, dass er
               ROT war, solange niemand angemeldet ist. Das lauteste
               Element des ersten Bildschirms war damit ausgerechnet die
               Handlung, die ein neuer Besucher nicht sucht. Angemeldet
               heisst jetzt: gefuellt in Navy, nicht in der Signalfarbe. */
            userNavBtn.classList.add('ist-angemeldet');
            // Der zugaengliche Name sagt, was der Knopf tut - nicht nur,
            // wer angemeldet ist.
            userNavBtn.setAttribute('aria-label', `Konto von ${name} — Menü öffnen`);
            userNavBtn.setAttribute('aria-expanded', 'false');
            userNavBtn.setAttribute('aria-controls', 'konto-menue');
            document.getElementById('konto-name').textContent = name;
            document.getElementById('konto-mail').textContent = user.email || '';
            userNavBtn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                kontoMenueSetzen(kontoMenue.hidden);
            };
            checkActiveRentals();
        } else {
            kontoMenueSetzen(false);
            userNavBtn.innerHTML = `<i class="fa-regular fa-user"></i> Login`;
            userNavBtn.classList.remove('ist-angemeldet');
            userNavBtn.removeAttribute('aria-label');
            userNavBtn.removeAttribute('aria-expanded');
            userNavBtn.removeAttribute('aria-controls');
            userNavBtn.onclick = (e) => { e.preventDefault(); openModal(); };
            hideRentalBanner();
        }
    }

    /* =================================================================
       ANMELDEDIALOG

       Vorher: ein div, das aussah wie ein Dialog. Der Fokus blieb beim
       Oeffnen hinter dem Overlay auf "Login", Escape tat nichts, der
       Hintergrund scrollte weiter, die Reiter waren divs ohne Tastatur.
       Und nach dem Absenden blieb nur ein Toast, der nach drei Sekunden
       verschwand - bei der Registrierung also praktisch keine Antwort.

       Jetzt: Fokus wandert hinein, eine Falle haelt ihn drin, Escape
       schliesst, der Fokus kehrt zurueck, der Hintergrund steht still.
       Das Ergebnis bleibt als Zustand im Dialog stehen.
       ================================================================= */
    const statusFeld = document.getElementById('auth-status');
    const reiter     = Array.from(document.querySelectorAll('.auth-tab'));
    let ruecksprung  = null;   // wohin der Fokus nach dem Schliessen geht

    function fokussierbare() {
        return Array.from(modal.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )).filter(el => !el.hidden && el.offsetParent !== null && !el.disabled);
    }

    function statusZeigen(art, text, aktion) {
        if (!statusFeld) return;
        statusFeld.hidden = false;
        statusFeld.className = 'auth-status ist-' + art;
        statusFeld.innerHTML = `<span>${escapeHtml(text)}</span>` +
            (aktion ? `<button type="button" class="auth-link" id="auth-status-aktion">${escapeHtml(aktion.text)}</button>` : '');
        if (aktion) {
            document.getElementById('auth-status-aktion').addEventListener('click', aktion.tun);
        }
    }

    function statusLeeren() {
        if (!statusFeld) return;
        statusFeld.hidden = true;
        statusFeld.textContent = '';
        statusFeld.className = 'auth-status';
    }

    function reiterWaehlen(ziel) {
        reiter.forEach(t => {
            const aktiv = t.dataset.target === ziel;
            t.classList.toggle('active', aktiv);
            t.setAttribute('aria-selected', String(aktiv));
            t.tabIndex = aktiv ? 0 : -1;
        });
        document.querySelectorAll('.auth-form').forEach(form => {
            const aktiv = form.id === ziel;
            form.classList.toggle('active', aktiv);
            form.hidden = !aktiv;
        });
        statusLeeren();
    }

    function openModal(ziel) {
        ruecksprung = document.activeElement;
        modal.style.display = 'flex';
        document.body.classList.add('dialog-offen');
        reiterWaehlen(ziel || 'login-form');
        // Der Fokus gehoert in den Dialog, nicht dahinter.
        const erstes = modal.querySelector('.auth-form.active input');
        (erstes || reiter[0]).focus();
    }

    function closeModal() {
        modal.style.display = 'none';
        document.body.classList.remove('dialog-offen');
        statusLeeren();
        if (ruecksprung && document.contains(ruecksprung)) ruecksprung.focus();
        ruecksprung = null;
    }

    function dialogOffen() { return modal.style.display === 'flex'; }

    closeBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

    document.addEventListener('keydown', (e) => {
        if (!dialogOffen()) return;
        if (e.key === 'Escape') { e.preventDefault(); closeModal(); return; }
        if (e.key !== 'Tab') return;
        // Fokusfalle: am Rand umklappen statt hinter das Overlay zu laufen.
        const liste = fokussierbare();
        if (!liste.length) return;
        const erst = liste[0], letzt = liste[liste.length - 1];
        if (e.shiftKey && document.activeElement === erst) { e.preventDefault(); letzt.focus(); }
        else if (!e.shiftKey && document.activeElement === letzt) { e.preventDefault(); erst.focus(); }
    });

    // Reiter: Klick und Pfeiltasten, wie es das Tab-Muster verlangt.
    reiter.forEach((tab, i) => {
        tab.addEventListener('click', () => reiterWaehlen(tab.dataset.target));
        tab.addEventListener('keydown', (e) => {
            const schritt = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1
                          : e.key === 'Home' ? -i : e.key === 'End' ? reiter.length - 1 - i : 0;
            if (!schritt && e.key !== 'Home' && e.key !== 'End') return;
            e.preventDefault();
            const naechst = reiter[(i + schritt + reiter.length) % reiter.length];
            reiterWaehlen(naechst.dataset.target);
            naechst.focus();
        });
    });

    // Passwort sichtbar machen - sonst tippt man blind und wiederholt sich.
    document.querySelectorAll('.passwort-zeigen').forEach(knopf => {
        knopf.addEventListener('click', () => {
            const feld = document.getElementById(knopf.dataset.feld);
            const zeigen = feld.type === 'password';
            feld.type = zeigen ? 'text' : 'password';
            knopf.textContent = zeigen ? 'Verbergen' : 'Zeigen';
            knopf.setAttribute('aria-pressed', String(zeigen));
        });
    });

    // Ein Formular waehrend der Anfrage stillstellen.
    function formSperren(form, gesperrt, text) {
        const knopf = form.querySelector('button[type="submit"]');
        form.querySelectorAll('input, button').forEach(el => el.disabled = gesperrt);
        if (knopf) {
            if (gesperrt) { knopf.dataset.text = knopf.textContent; knopf.textContent = text; }
            else if (knopf.dataset.text) { knopf.textContent = knopf.dataset.text; }
        }
    }

    // ===== LOGIN HANDLER =====
    const loginForm = document.getElementById('login-form');
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value.trim();
        const password = document.getElementById('login-password').value;
        statusLeeren();
        formSperren(loginForm, true, 'Wird geprüft …');

        try {
            await login(email, password);
            closeModal();
            Toastify({ text: 'Willkommen zurück!', backgroundColor: '#10B981' }).showToast();

            if (pendingReservationBikeId) {
                setTimeout(() => {
                    window.reserveBike(pendingReservationBikeId);
                    pendingReservationBikeId = null;
                }, 500);
            }
        } catch (error) {
            // Bleibt stehen. Ein Toast waere nach drei Sekunden weg.
            statusZeigen('fehler', error.message);
            document.getElementById('login-password').value = '';
            document.getElementById('login-password').focus();
        } finally {
            formSperren(loginForm, false);
        }
    });

    // Neues Passwort anfordern - bisher gab es gar keinen Weg zurueck.
    document.getElementById('passwort-vergessen')?.addEventListener('click', async () => {
        const feld = document.getElementById('login-email');
        const email = feld.value.trim();
        if (!email) {
            statusZeigen('hinweis', 'Trage zuerst deine E-Mail-Adresse ein.');
            feld.focus();
            return;
        }
        try {
            await passwortZuruecksetzen(email);
            statusZeigen('erfolg',
                `Wir haben eine E-Mail an ${email} geschickt. Darin steht der Link, mit dem du ein neues Passwort setzt.`);
        } catch (error) {
            statusZeigen('fehler', error.message);
        }
    });

    // ===== REGISTER HANDLER =====
    const regForm = document.getElementById('register-form');
    regForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const vorname  = document.getElementById('reg-vorname').value.trim();
        const nachname = document.getElementById('reg-nachname').value.trim();
        const email    = document.getElementById('reg-email').value.trim();
        const password = document.getElementById('reg-password').value;
        statusLeeren();
        formSperren(regForm, true, 'Konto wird angelegt …');

        try {
            await register(email, password, vorname, nachname);
            // Angemeldet und fertig: der Dialog darf zu.
            closeModal();
            Toastify({ text: 'Konto erstellt. Willkommen bei VeloCity!', backgroundColor: '#10B981' }).showToast();

            if (pendingReservationBikeId) {
                setTimeout(() => {
                    window.reserveBike(pendingReservationBikeId);
                    pendingReservationBikeId = null;
                }, 500);
            }
        } catch (error) {
            if (error.message === 'EMAIL_CONFIRMATION_REQUIRED') {
                // Genau der Fall, der vorher wie ein Fehlschlag aussah: das
                // Konto ist da, es fehlt nur die Bestaetigung. Der Dialog
                // bleibt offen und sagt, was als Naechstes zu tun ist.
                regForm.reset();
                statusZeigen('erfolg',
                    `Konto angelegt. Wir haben eine Bestätigung an ${email} geschickt — öffne den Link darin, dann kannst du dich anmelden.`,
                    { text: 'Zur Anmeldung', tun: () => {
                        reiterWaehlen('login-form');
                        document.getElementById('login-email').value = email;
                        document.getElementById('login-password').focus();
                    }});
            } else {
                // Bei einem Fehler des Mailservers ist der zweite Versuch
                // oft schon erfolgreich - der Knopf spart das Neutippen.
                // Nur wo ein zweiter Versuch ueberhaupt helfen kann.
                // Bei bereits vorhandenen Kundendaten hilft er nicht.
                const wiederholbar = /versendet werden|Verbindung/.test(error.message);
                statusZeigen('fehler', error.message, wiederholbar
                    ? { text: 'Erneut versuchen', tun: () => regForm.requestSubmit() }
                    : null);
                document.getElementById('reg-email').focus();
            }
        } finally {
            formSperren(regForm, false);
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
                <button type="button" data-typ="${escapeHtml(k.typ_code)}"
                        class="karte-mit-typ ${hervor ? 'btn-primary' : 'btn-outline'} full-width"
                        aria-label="${escapeHtml(k.bezeichnung)} auf der Karte zeigen">
                    Auf der Karte zeigen
                </button>
            </div>`;
        }).join('');
    }

    /* Der Knopf hiess auf allen drei Karten "Fahrt starten" und startete
       nichts - er sprang zur Karte und vergass dabei die Wahl, die man
       gerade getroffen hatte. Jetzt heisst er, was er tut, setzt den
       Filter und fuehrt den Fokus auf die Kartenueberschrift. */
    document.addEventListener('click', (e) => {
        const knopf = e.target.closest('.karte-mit-typ');
        if (!knopf) return;
        const kurz = TYP_FILTER[knopf.dataset.typ];
        if (kurz) {
            checkboxes.forEach(cb => cb.checked = (cb.value === kurz));
            karteZeichnen();
        }
        zuAbschnitt('map-section');
    });

    /* Sprungziel sauber ansteuern: der Kopf ist fest und 92 px hoch, die
       Ueberschrift lag danach darunter. scroll-margin-top im Stil regelt
       das Sichtbare, der Fokus hier das Hoerbare. */
    const wenigBewegung = matchMedia('(prefers-reduced-motion: reduce)');

    function zuAbschnitt(id) {
        const abschnitt = document.getElementById(id);
        if (!abschnitt) return;

        const vorher = window.scrollY;
        const sanft = !wenigBewegung.matches;
        abschnitt.scrollIntoView({ behavior: sanft ? 'smooth' : 'auto', block: 'start' });

        // Sanftes Scrollen haengt an requestAnimationFrame. Laeuft das
        // nicht - in einem Hintergrundtab, unter einer Automatisierung,
        // bei abgeschalteter Animation -, bleibt die Seite einfach
        // stehen und der Sprung fuehrt ins Leere. Deshalb wird
        // nachgesehen und notfalls hart gesprungen.
        if (sanft) {
            setTimeout(() => {
                if (Math.abs(window.scrollY - vorher) < 4 &&
                    Math.abs(abschnitt.getBoundingClientRect().top) > 140) {
                    abschnitt.scrollIntoView({ behavior: 'auto', block: 'start' });
                }
            }, 350);
        }

        const titel = abschnitt.querySelector('h1, h2');
        if (titel) {
            titel.setAttribute('tabindex', '-1');
            // Erst nach dem Scrollen fokussieren, sonst springt der Browser
            // ein zweites Mal und landet wieder oben.
            setTimeout(() => titel.focus({ preventScroll: true }), 520);
        }
    }
    window.zuAbschnitt = zuAbschnitt;

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

    // Eine Grenze, an die sich beide Bedienelemente halten. Vorher stand
    // 1440 am Feld und 240 am Regler; bei 1440 zeigte das Feld 1440 und der
    // Regler sprang auf 144 - zwei Zustaende fuer eine Eingabe.
    const MIN_MINUTEN = 1;
    const MAX_MINUTEN = 1440;

    function minutenLesen() {
        const feld = document.getElementById('meter-minuten');
        const roh = Number(feld.value);
        if (!Number.isFinite(roh) || feld.value.trim() === '') return null;
        return Math.round(roh);
    }

    /* Der eingegebene Wert wird sichtbar zurechtgerueckt, nicht still
       ersetzt. Vorher blieb "-5" im Feld stehen, waehrend intern mit 1
       gerechnet wurde - bei Preisen ist das nicht hinnehmbar. */
    function minutenSetzen(wert, ausFeld) {
        const feld   = document.getElementById('meter-minuten');
        const regler = document.getElementById('meter-regler');
        const hinweis = document.getElementById('meter-grenze');
        let minuten = wert;
        let korrigiert = false;

        if (minuten === null) { minuten = MIN_MINUTEN; korrigiert = ausFeld; }
        if (minuten < MIN_MINUTEN) { minuten = MIN_MINUTEN; korrigiert = true; }
        if (minuten > MAX_MINUTEN) { minuten = MAX_MINUTEN; korrigiert = true; }

        if (String(feld.value) !== String(minuten)) feld.value = minuten;
        regler.value = minuten;

        if (hinweis) {
            hinweis.textContent = korrigiert
                ? `Möglich sind ${MIN_MINUTEN} bis ${MAX_MINUTEN} Minuten — auf ${minuten} gesetzt.`
                : `${MIN_MINUTEN} bis ${MAX_MINUTEN} Minuten`;
            hinweis.classList.toggle('ist-korrigiert', korrigiert);
        }
        return minuten;
    }

    function rechnerZeichnen(minuten) {
        const wert   = document.getElementById('meter-value');
        const posten = document.getElementById('meter-detail');
        if (!wert || !rechnerTarife.length) return;

        const t = rechnerTarife[rechnerAktiv];
        if (minuten === undefined) minuten = Number(document.getElementById('meter-regler').value);
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

    function markenZeichnen() {
        const jetzt = Number(document.getElementById('meter-regler').value);
        document.querySelectorAll('.rechner-marken button').forEach(b =>
            b.setAttribute('aria-pressed', String(Number(b.dataset.minuten) === jetzt)));
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

        /* Frueher wurde erst beim Verlassen des Feldes zurechtgerueckt.
           Wer "0" oder "1441" eintippte und hinsah, las im Feld den einen
           Wert und daneben einen Preis, der zu einem anderen gehoerte.
           Bei Preisen ist das nicht hinnehmbar - also sofort begrenzen.
           Zwischenstaende beim Tippen sind davon nicht betroffen: "1",
           "12" und "120" liegen alle im erlaubten Bereich. */
        feld.addEventListener('input', () => {
            const m = minutenLesen();
            if (m !== null && m >= MIN_MINUTEN && m <= MAX_MINUTEN) {
                regler.value = m;
                rechnerZeichnen(m);
                minutenSetzen(m);
            } else if (feld.value.trim() !== '' && feld.value.trim() !== '-') {
                rechnerZeichnen(minutenSetzen(m, true));
            }
            markenZeichnen();
        });
        feld.addEventListener('change', () => { rechnerZeichnen(minutenSetzen(minutenLesen(), true)); markenZeichnen(); });
        feld.addEventListener('blur',   () => { rechnerZeichnen(minutenSetzen(minutenLesen(), true)); markenZeichnen(); });
        regler.addEventListener('input', () => { rechnerZeichnen(minutenSetzen(Number(regler.value))); markenZeichnen(); });

        document.querySelectorAll('.rechner-marken button').forEach(b => {
            b.addEventListener('click', () => {
                rechnerZeichnen(minutenSetzen(Number(b.dataset.minuten)));
                markenZeichnen();
            });
        });

        rechnerTypenZeichnen();
        minutenSetzen(30);
        rechnerZeichnen(30);
        markenZeichnen();
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

            // Die Zahl im Kopf der Buehne gehoert zum RAD, das dort
            // gerade steht - am E-Bike-Halt die freien E-Bikes, nicht
            // die 221 des ganzen Netzes. Die Buehne (hero.js) sagt,
            // welcher Typ gemeint ist; hier wird nur gezaehlt.
            bestandJeTyp = { alle: bikes.length, city: 0, ebike: 0, cargo: 0 };
            for (const r of bikes) {
                const kurz = TYP_FILTER[r.typ_code];
                if (kurz) bestandJeTyp[kurz] += 1;
            }
            radzahlFuerTyp(letzterHeroTyp ?? heroTypAusPille());
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
    /* Ohne animate:false bleibt der Wechsel stehen, sobald die Seite
       keine Bildwiederholung bekommt - im Hintergrundtab, unter einer
       Automatisierung, bei abgeschalteter Animation. Der Knopf sah dann
       aus, als tue er nichts: der Zustand wechselte, die Karte nicht.
       Ein Ortswechsel ist eine Navigation, keine Vorfuehrung. */

    /* KACHELQUELLE: OPENSTREETMAP DIREKT (seit 28.08.2026)
       Bis dahin lagen hier die Voyager-Kacheln von CARTO. CARTO hat den
       freien Zugang inzwischen geschlossen: die Kacheln kommen weiter,
       tragen aber quer ueber die ganze Stadt den Schriftzug
       "API KEY REQUIRED". Nachgemessen am 28.08.2026 an derselben
       Kachel (z12/2148/1400): CARTO 14 686 Byte mit Wasserzeichen,
       tile.openstreetmap.org 26 064 Byte ohne. Wer die Seite oeffnete,
       sah zuerst einen Fehler und dann erst Wuerzburg.

       OpenStreetMap direkt ist ausserdem eine Partei weniger, die
       erfaehrt, welchen Kartenausschnitt ein Besucher anschaut - die
       Warenwirtschaft hat dieselbe Wahl mit derselben Begruendung
       getroffen (wawi/stationen.js, STATIONENKARTE_KACHELN).

       NUTZUNGSBEDINGUNGEN
       Die Tile Usage Policy der OSM Foundation
       (operations.osmfoundation.org/policies/tiles) erlaubt "leichte
       Nutzung" ausdruecklich; eine Lehr-Fallstudie dieser Groesse
       faellt darunter. Was der Browser ohnehin mitliefert - eigener
       User-Agent, Referer, Zwischenspeicherung - erfuellt sie von
       selbst. Die einzige eigene Pflicht ist die sichtbare
       Quellenangabe; Leaflet zeigt sie unten rechts.

       Der Wortlaut bleibt unveraendert, so wie OpenStreetMap ihn
       vorschlaegt - eine Quellenangabe ist kein Oberflaechentext. */
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" ' +
                     'target="_blank" rel="noopener">OpenStreetMap</a> contributors',
        maxZoom: 19
    }).addTo(map);

    // Das Geschaeftsgebiet kommt aus velocity.v_geschaeftsgebiet. Frueher
    // stand das Vieleck hier fest im Skript - die Karte zeichnete eine
    // Regel, die die Datenbank nicht kannte. Jetzt ist es umgekehrt: die
    // Datenbank haelt die Regel und setzt sie beim Beenden einer Fahrt
    // durch, die Karte zeichnet nur noch nach.
    let geschaeftsgebiet = null;   // Wuerzburg: der Ausschnitt beim Start
    let gebietFlaechen = [];       // alle Gebiete, fuer die Gesamtansicht

    // Der Typ polygon kommt als Text: ((Laenge,Breite),(Laenge,Breite),…)
    // Leaflet will [Breite, Laenge] - deshalb wird gedreht.
    function umrissLesen(text) {
        return [...String(text).matchAll(/\(([-0-9.]+),([-0-9.]+)\)/g)]
            .map(m => [Number(m[2]), Number(m[1])]);
    }

    async function geschaeftsgebietZeichnen() {
        // Das Geschaeftsgebiet ist Wuerzburg. fn_im_geschaeftsgebiet fragt
        // ueber exists und vertraegt mehrere Gebiete; die Karte zeichnet
        // deshalb alle, die die Datenbank liefert - heute eines.
        const gebiete = await fetchGeschaeftsgebiete();
        if (!gebiete.length) return;
        // Dieselbe Hausfarbe wie im Stylesheet (--red). Sie wurde am
        // 28.08.2026 dunkler, weil Weiss auf dem alten Rot nur 4,41:1
        // trug; die Umrandung des Gebiets folgt ihr, damit die Karte
        // nicht als einzige Flaeche das alte Rot weiterfuehrt.
        const stil = { color: '#d4002f', fillColor: '#d4002f', fillOpacity: 0.07,
                       weight: 2.5, dashArray: '8, 6', lineJoin: 'round' };
        gebietFlaechen = gebiete.map(g =>
            L.polygon(umrissLesen(g.umriss), stil).addTo(map).bindTooltip(
                `Geschäftsgebiet ${g.name}`, { sticky: true }));

        const wue = gebiete.findIndex(g => g.name === 'Würzburg');
        geschaeftsgebiet = gebietFlaechen[wue >= 0 ? wue : 0];
        gebietZeigen();
        // Die Karte darf das Gebiet nicht verlassen. Ohne diese Grenze
        // landet man mit zwei Wischern in Fuchsstadt und findet nicht
        // zurueck - und genau das ist passiert.
        // Die Grenze umfasst alle gezeichneten Gebiete.
        const alle = netzGrenzen();
        map.setMaxBounds(alle.pad(0.25));
        map.setMinZoom(map.getBoundsZoom(alle) - 0.5);
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
    const TYP_NAME = { city: 'City-Bike', ebike: 'E-Bike Sport', cargo: 'E-Cargo Loader' };

    /* Die Zahl im Kopf der Buehne
       -------------------------------------------------------------
       Sie zeigte bisher immer die Gesamtzahl - auch dann, wenn daneben
       ein Lastenrad stand. Das las sich, als gaebe es 221 Lastenraeder.
       Gezaehlt wird deshalb je Typ; welchen Typ die Buehne gerade zeigt,
       meldet hero.js ueber window.VelocityBestand.zeigeTyp().

       Vor dem Laden steht hier nichts - dann bleibt die Beschriftung
       stehen und die Zahl auf den drei Punkten, die im HTML stehen. */
    const TYP_ZAHLWORT = { city: 'City-Bikes frei', ebike: 'E-Bikes frei',
                           cargo: 'E-Cargo frei', alle: 'Räder frei' };
    let bestandJeTyp = null;
    let letzterHeroTyp = null;

    /* hero.js laeuft VOR dieser Datei (siehe Reihenfolge in index.html)
       und meldet seinen Typ deshalb ins Leere - window.VelocityBestand
       gibt es zu dem Zeitpunkt noch nicht. Statt die Reihenfolge zu
       drehen (die Buehne soll frueh stehen, bevor Daten da sind), wird
       der Typ hier notfalls an der Pille abgelesen: sie traegt ihn im
       aria-pressed. */
    function heroTypAusPille() {
        const an = document.querySelector('.product-tab[aria-pressed="true"]');
        return an?.dataset.product || 'alle';
    }

    function radzahlFuerTyp(kurz) {
        if (TYP_ZAHLWORT[kurz]) letzterHeroTyp = kurz;
        else if (letzterHeroTyp === null) letzterHeroTyp = heroTypAusPille();
        if (!bestandJeTyp) return;
        const zahl = document.getElementById('bike-counter');
        const wort = document.getElementById('bike-counter-label');
        if (zahl) zahl.textContent = bestandJeTyp[letzterHeroTyp];
        if (wort) wort.textContent = TYP_ZAHLWORT[letzterHeroTyp];
    }

    window.VelocityBestand = { zeigeTyp: radzahlFuerTyp };

    const checkboxes = document.querySelectorAll('.filter-option input');

    function gewaehlteTypen() {
        return new Set(Array.from(checkboxes).filter(cb => cb.checked).map(cb => cb.value));
    }

    /* Frueher schrieb der Kartenfilter in dieselbe Zahl wie die Buehne.
       Wer unten die Typen filterte und wieder hochscrollte, sah im Kopf
       die gefilterte Zahl - ohne Anlass, denn oben steht kein Filter.
       Die Buehne fuehrt ihre Zahl jetzt selbst (radzahlFuerTyp). */
    function radzahlAnzeigen(n) {
        void n;
    }

    function akkuFarbe(prozent) {
        if (prozent === null || prozent === undefined) return null;
        return prozent > 50 ? '#0f9d63' : prozent > 20 ? '#c98a00' : '#c8002f';
    }

    /* Eine Zeile im Popover: Bild, Name, Zahl, Preis, Schaltflaeche. */
    function typZeile(typCode, raeder, ort) {
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
            <button type="button" class="pop-leihen" data-rad="${bestes.fahrrad_id}"
                    aria-label="${escapeHtml(erstes.typ_bezeichnung)} ${escapeHtml(ort || '')} leihen">Leihen</button>
          </div>`;
    }

    /* Wie hoch liegt diese Station, und wie weit ist es von dort noch
       hinauf? Die Bezugshoehen kommen aus velocity.v_hoehenmarke, die
       Hoehe der Station aus v_station. Fehlt eine der beiden Angaben,
       entfaellt die Zeile - sie wird nicht geraten.

       Hier stand bis zum 24.08.2026 nur "180 m" und darunter
       "FRANKENWARTE +180 · STEINBURG +105". Was die Zahlen bedeuten,
       musste man erraten: Entfernung? Hoehe? Und +180 wovon aus? Jetzt
       sagt es die Zeile selbst - die Hoehe der Station ueber dem Meer,
       und darunter, wie viele Hoehenmeter von DIESER Station aus noch
       zu treten sind. */
    function hoehenZeile(station) {
        if (!Number.isFinite(station.hoehe_m) || !hoehenMarken.length) return '';
        const hinauf = hoehenMarken
            .filter(m => m.hoehe_m > station.hoehe_m)
            .map(m => `${escapeHtml(m.name)} +${m.hoehe_m - station.hoehe_m} Hm`)
            .join(' · ');
        return `
            <div class="pop-hoehe">
              <p class="pop-hoehe-kopf">
                <span class="pop-hoehe-wert">${station.hoehe_m} m</span>
                <span class="pop-hoehe-was">über dem Meer</span>
              </p>
              <p class="pop-hoehe-rest">${hinauf
                ? `<span class="pop-hoehe-marke">Von hier hinauf:</span> ${hinauf}`
                : 'Höchster Punkt im Netz'}</p>
            </div>`;
    }

    function stationsPopover(station, raeder) {
        const nachTyp = new Map();
        for (const r of raeder) {
            if (!nachTyp.has(r.typ_code)) nachTyp.set(r.typ_code, []);
            nachTyp.get(r.typ_code).push(r);
        }
        const reihenfolge = ['CITY', 'EBIKE', 'CARGO'].filter(t => nachTyp.has(t));
        const ort = 'an der Station ' + station.name;
        const zeilen = reihenfolge.map(t => typZeile(t, nachTyp.get(t), ort)).join('');

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
            ${typZeile(rad.typ_code, [rad], 'mit der Rahmennummer ' + rad.rahmennummer)}
            <p class="pop-fuss">Nach dem Leihen öffnet sich das Schloss automatisch.</p>
          </div>`;
    }

    /* Stationsmarker: eine Scheibe mit der Zahl der freien Raeder.
       Der Durchmesser waechst mit der Wurzel der Anzahl - die
       Kreisflaeche wuerde den Unterschied sonst uebertreiben. */
    /* Die Scheibe ist rund, ihre Trefferflaeche war quadratisch. Bei
       eng beieinanderliegenden Stationen deckte die Ecke der einen die
       Mitte der anderen ab: ein Tipper auf "Marktplatz" oeffnete "Dom",
       und zwar nur mit dem Finger - mit der Tastatur ging es. Genau
       dieser Unterschied hat eine Pruefung von aussen stutzig gemacht.

       clip-path beschneidet nicht nur das Bild, sondern auch die
       Trefferflaeche. Zusaetzlich werden die Scheiben auf schmalen
       Rahmen kleiner, damit sie sich seltener beruehren. */
    function stationsSymbol(anzahl) {
        const schmal = map.getContainer().clientWidth < 620;
        const d = Math.round((schmal ? 24 : 30) + Math.sqrt(anzahl) * (schmal ? 2.2 : 3.4));
        return L.divIcon({
            className: 'marker-rund',
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
            className: 'marker-rund',
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
    /* Die Umgrenzung aller Gebiete - in einem FRISCHEN Objekt.

       Hier steckte ein boeser Fehler: getBounds() eines Vielecks liefert
       nicht eine Kopie, sondern das interne Objekt. Ein
           gebietFlaechen.reduce((b, f) => b.extend(f.getBounds()), …)
       blaeht damit die Grenzen des ERSTEN Vielecks dauerhaft auf. Solange
       es zwei Gebiete gab, war der Ausschnitt danach dauerhaft falsch.

       L.latLngBounds([]) legt ein leeres Objekt an; extend fasst dort
       hinein, ohne die Vielecke anzufassen. */
    function netzGrenzen() {
        const grenzen = L.latLngBounds([]);
        gebietFlaechen.forEach(f => grenzen.extend(f.getBounds()));
        return grenzen;
    }

    function gebietZeigen() {
        if (!geschaeftsgebiet) return;
        const grenzen = geschaeftsgebiet.getBounds();
        map.fitBounds(grenzen, { padding: [30, 30], animate: false });

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
            map.setZoom(map.getZoom() + Math.round(zu * 4) / 4, { animate: false });
        }
    }

    /* Wann traegt die Karte 45 einzelne Radsymbole zusaetzlich zu den 13
       Stationsscheiben? Auf 390 px nicht: dort entsteht ein Markerteppich
       ohne Rangfolge, in dem die Stationen untergehen. Auf einem breiten
       Rahmen sehr wohl - dort ist die Verteilung gerade die Aussage.

       Die Schwelle haengt deshalb an der Rahmenbreite, nicht allein am
       Zoom. Wer auf dem Telefon hineinzoomt, bekommt die Einzelraeder
       trotzdem: dann ist genug Platz je Rad da. */
    const KARTE_TRAEGT_AB = 700;   // Rahmenbreite in Punkten
    const FREIE_AB_ZOOM   = 14.5;  // sonst erst ab dieser Zoomstufe

    function freieSichtbar() {
        return map.getContainer().clientWidth >= KARTE_TRAEGT_AB
            || map.getZoom() >= FREIE_AB_ZOOM;
    }

    /* Jeder Marker braucht einen Namen. Vorher trugen die 13 Stationen
       einen title und die 45 freien Raeder gar nichts - fuer einen
       Screenreader 45 mal "Schaltflaeche". */
    function markerBenennen(marker, name) {
        marker.options.title = name;
        const el = marker.getElement();
        if (el) {
            el.setAttribute('aria-label', name);
            el.setAttribute('title', name);
            el.setAttribute('role', 'button');
        }
    }

    /* Der Weg aus dem leeren Zustand heraus: eine Schaltflaeche, die
       alle Haken zurueckholt. */
    function leerhinweisZeigen(an) {
        const el = document.getElementById('karte-leer');
        if (!el) return;
        el.hidden = !an;
    }

    function standMelden(text) {
        const el = document.getElementById('karte-stand');
        if (el) el.textContent = text;
    }

    /* Marker je Station, damit die Liste unter der Karte dieselbe
       Station oeffnen kann wie ein Tipper auf die Scheibe. */
    const stationsMarker = new Map();
    const fuehrungslinien = L.layerGroup().addTo(map);

    /* =================================================================
       MARKER AUFFAECHERN

       Dom, Marktplatz und Juliuspromenade liegen keine 200 Meter
       auseinander. Auf 390 px Kartenbreite sind das rund 13 Bildpunkte -
       die Scheiben sind aber 33 Punkte breit. Sie MUESSEN sich
       ueberdecken, und die obere faengt den Tipper fuer die untere ab.
       Eine Pruefung von aussen hat genau das gefunden: ein Tipper auf
       "Marktplatz" oeffnete "Dom", mit der Tastatur ging es dagegen.

       Weder eine runde Trefferflaeche noch kleinere Scheiben loesen das:
       die Mittelpunkte liegen naeher beieinander als die Radien. Also
       werden die Scheiben auseinandergeschoben, bis sich keine zwei mehr
       beruehren, und eine duenne Linie zeigt, wo die Station wirklich
       steht. Der wahre Ort geht dabei nicht verloren - er steht in
       marker.echterOrt.

       Das Verfahren ist eine Entspannungsrechnung: solange sich zwei
       Scheiben ueberlappen, schiebt sie jede die andere um die Haelfte
       der Ueberdeckung fort. Nach wenigen Runden steht alles frei.
       ================================================================= */
    function markerEntflechten() {
        fuehrungslinien.clearLayers();
        const punkte = [];
        stationsMarker.forEach(m => {
            if (!m.echterOrt) return;
            const soll = map.latLngToLayerPoint(m.echterOrt);
            const gr = m.options.icon.options.iconSize[0] / 2 + 1.5;
            punkte.push({ m, soll, ist: soll.clone(), r: gr });
        });
        if (punkte.length < 2) return;

        for (let runde = 0; runde < 80; runde++) {
            let bewegt = false;
            for (let i = 0; i < punkte.length; i++) {
                for (let j = i + 1; j < punkte.length; j++) {
                    const a = punkte[i], b = punkte[j];
                    let dx = b.ist.x - a.ist.x, dy = b.ist.y - a.ist.y;
                    let abstand = Math.hypot(dx, dy);
                    const noetig = a.r + b.r;
                    if (abstand >= noetig) continue;
                    if (abstand < 0.01) {          // exakt uebereinander
                        const w = (i * 2.399 + j);  // fester Winkel je Paar
                        dx = Math.cos(w); dy = Math.sin(w); abstand = 1;
                    }
                    const schub = (noetig - abstand) / 2 / abstand;
                    a.ist.x -= dx * schub; a.ist.y -= dy * schub;
                    b.ist.x += dx * schub; b.ist.y += dy * schub;
                    bewegt = true;
                }
            }
            if (!bewegt) break;
        }

        for (const p of punkte) {
            const versatz = Math.hypot(p.ist.x - p.soll.x, p.ist.y - p.soll.y);
            if (versatz < 1.5) { p.m.setLatLng(p.m.echterOrt); continue; }
            p.m.setLatLng(map.layerPointToLatLng(p.ist));
            L.polyline([map.layerPointToLatLng(p.soll), map.layerPointToLatLng(p.ist)],
                       { color: '#061841', weight: 1, opacity: .32, interactive: false })
             .addTo(fuehrungslinien);
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

        let stationenMitRad = 0;
        stationsMarker.clear();
        for (const station of db_Stations) {
            if (!station.latitude || !station.longitude) continue;
            const hier = proStation.get(station.station_id) || [];
            if (hier.length) stationenMitRad++;
            const name = hier.length
                ? `Station ${station.name}, ${hier.length} ${hier.length === 1 ? 'Rad' : 'Räder'} frei`
                : `Station ${station.name}, gerade kein Rad des gewählten Typs`;
            const marker = L.marker([station.latitude, station.longitude], {
                icon: stationsSymbol(hier.length),
                title: name,
                alt: name
            }).addTo(stationLayer)
              .bindPopup(stationsPopover(station, hier), { maxWidth: 340, minWidth: 300 });
            markerBenennen(marker, name);
            // Der wahre Ort bleibt erhalten, auch wenn der Marker gleich
            // beiseitegeschoben wird - siehe markerEntflechten.
            marker.echterOrt = L.latLng(station.latitude, station.longitude);
            stationsMarker.set(station.station_id, marker);
        }

        // Frei abgestellte Raeder erst, wenn der Ausschnitt sie tragen kann.
        // Sie liegen dann auch nicht mehr in der Tabulatorreihenfolge - das
        // war der Grund fuer 97 fokussierbare Elemente auf einer Seite.
        const zeigeFreie = freieSichtbar();
        if (zeigeFreie) {
            for (const rad of freie) {
                const name = `${rad.typ_bezeichnung} ${rad.rahmennummer}, frei abgestellt`;
                const marker = L.marker([rad.latitude, rad.longitude], {
                    icon: freiesSymbol(rad), title: name, alt: name,
                    // Stationen haben Vorrang. Ein frei abgestelltes Rad,
                    // das zufaellig auf einer Stationsscheibe liegt, darf
                    // ihr den Tipper nicht wegnehmen - die Station ist das
                    // Ziel, nach dem gesucht wird.
                    zIndexOffset: -500
                }).addTo(bikeLayer)
                  .bindPopup(freiesRadPopover(rad), { maxWidth: 340, minWidth: 300 });
                markerBenennen(marker, name);
            }
        }

        // Sind alle Haken weg, ist die Karte leer. Eine Zahl allein hilft
        // dann nicht weiter - es braucht den Weg zurueck.
        const gewaehlt = Array.from(typen);
        if (!gewaehlt.length) {
            standMelden('Kein Fahrradtyp ausgewählt — die Karte zeigt gerade keine Räder.');
            leerhinweisZeigen(true);
            return;
        }
        leerhinweisZeigen(false);

        const typText = gewaehlt.length === 3 ? 'allen Fahrradtypen'
                      : gewaehlt.map(t => TYP_NAME[t]).join(' und ');
        standMelden(
            `${raeder.length} ${raeder.length === 1 ? 'Rad' : 'Räder'} an ` +
            `${stationenMitRad} ${stationenMitRad === 1 ? 'Station' : 'Stationen'}, ` +
            `gefiltert nach ${typText}. ` +
            (freie.length === 0 ? ''
             : zeigeFreie ? `${freie.length} davon stehen frei im Geschäftsgebiet.`
             : `${freie.length} frei abgestellte Räder erscheinen beim Hineinzoomen.`));

        markerEntflechten();
        stationslisteZeichnen(proStation);

        // Der Ausschnitt folgt dem Geschaeftsgebiet; das setzt
        // geschaeftsgebietZeichnen, sobald die Sicht geladen ist.
    }

    /* Dieselben Daten wie auf der Karte, nur als Liste. Ein Klick fuehrt
       zur Station und oeffnet ihr Infofenster - auch dann, wenn drei
       Scheiben uebereinanderliegen. */
    function stationslisteZeichnen(proStation) {
        const ziel = document.getElementById('stationsliste-eintraege');
        if (!ziel) return;
        const zeilen = db_Stations
            .filter(st => st.latitude && st.longitude)
            .map(st => ({ st, frei: (proStation.get(st.station_id) || []).length }))
            .sort((a, b) => b.frei - a.frei || a.st.name.localeCompare(b.st.name, 'de'));

        ziel.innerHTML = zeilen.map(({ st, frei }) => `
            <li>
              <button type="button" data-station="${st.station_id}">
                <span class="sl-zahl${frei ? '' : ' ist-leer'}">${frei}</span>
                <span class="sl-text">
                  <strong>${escapeHtml(st.name)}</strong>
                  <small>${escapeHtml(st.strasse || '')} ${escapeHtml(st.hausnummer || '')}${st.ort ? ' · ' + escapeHtml(st.ort) : ''}</small>
                </span>
                <span class="sl-frei">${frei === 1 ? 'Rad frei' : 'Räder frei'}</span>
              </button>
            </li>`).join('');

        ziel.querySelectorAll('button').forEach(b => {
            b.addEventListener('click', () => {
                const id = Number(b.dataset.station);
                const marker = stationsMarker.get(id);
                if (!marker) return;
                const ort = marker.getLatLng();
                document.getElementById('map').scrollIntoView({ behavior: 'auto', block: 'center' });
                map.setView(ort, Math.max(map.getZoom(), 15), { animate: false });
                // Der Zoomsprung kann die Schwelle fuer die Einzelraeder
                // ueberschreiten. Dann zeichnet die Karte neu und der
                // Marker von eben ist nicht mehr derselbe - deshalb wird
                // er nach dem Sprung erneut geholt.
                (stationsMarker.get(id) || marker).openPopup();
            });
        });
    }

    // Beim Zoomen und beim Aendern der Fenstergroesse kann die Schwelle
    // kippen; dann wird neu gezeichnet - aber nur dann.
    let letzteSicht = null;
    function sichtPruefen() {
        const jetzt = freieSichtbar();
        if (jetzt !== letzteSicht) { letzteSicht = jetzt; karteZeichnen(); }
    }
    map.on('zoomend', () => { sichtPruefen(); markerEntflechten(); });
    map.on('resize', () => { sichtPruefen(); markerEntflechten(); });

    // Leaflet beschriftet die Schliessen-Schaltflaeche englisch.
    /* Filterkarte und Ortsumschalter liegen ueber der Kartenflaeche und
       damit auch ueber dem Infofenster - auf 390 px verdeckten sie
       dessen Kopf mit Name und Adresse, also genau die Angabe, wegen
       der man es geoeffnet hat. Solange eines offen ist, treten sie ab.
       Auf breiten Rahmen ist Platz genug; dort bleibt alles stehen. */
    const kartenRahmen = document.querySelector('.map-container-shadow');
    map.on('popupopen', (e) => {
        const knopf = e.popup.getElement()?.querySelector('.leaflet-popup-close-button');
        if (knopf) knopf.setAttribute('aria-label', 'Infofenster schließen');
        kartenRahmen?.classList.add('hat-infofenster');
    });
    map.on('popupclose', () => kartenRahmen?.classList.remove('hat-infofenster'));

    checkboxes.forEach(cb => cb.addEventListener('change', karteZeichnen));

    document.getElementById('karte-alle-typen')?.addEventListener('click', () => {
        checkboxes.forEach(cb => cb.checked = true);
        karteZeichnen();
        checkboxes[0].focus();
    });

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
                // Typ und Rahmennummer stehen bereits in den geladenen
                // Daten. Vorher trug der Balken bis zum naechsten Laden
                // nur "Fahrrad" - der Kunde wusste nicht, welches Rad er
                // gerade hat.
                const rad = db_Bikes.find(r => r.fahrrad_id === bikeId);
                activeRental = {
                    ausleihe_id: result.ausleihe_id,
                    fahrrad_id: bikeId,
                    startzeit: new Date(),
                    bikeInfo: rad?.typ_bezeichnung || 'Fahrrad',
                    rahmennummer: rad?.rahmennummer || '',
                    typ_code: rad?.typ_code || null,
                    start_station_id: rad?.station_id || null,
                    startgebuehr: rad ? Number(rad.startgebuehr) : null,
                    preis_pro_minute: rad ? Number(rad.preis_pro_minute) : null,
                    tageshoechstpreis: rad ? Number(rad.tageshoechstpreis) : null
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
                const satz = rechnerTarife.find(t => t.typ_code === rental.typ_code);
                activeRental = {
                    ausleihe_id: rental.ausleihe_id,
                    rahmennummer: rental.rahmennummer,
                    startzeit: new Date(rental.startzeit),
                    bikeInfo: rental.typ_bezeichnung || 'Fahrrad',
                    typ_code: rental.typ_code || null,
                    start_station_id: (db_Stations.find(st => st.name === rental.start_station) || {}).station_id || null,
                    startgebuehr: satz ? Number(satz.startgebuehr) : null,
                    preis_pro_minute: satz ? Number(satz.preis_pro_minute) : null,
                    tageshoechstpreis: satz ? Number(satz.tageshoechstpreis) : null
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
        rentalBanner.setAttribute('aria-label',
            `Laufende Fahrt mit ${bikeInfo.textContent}`);

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

        // Der laufende Betrag, nach denselben Regeln wie die Datenbank:
        // angefangene Minuten aufgerundet, Deckelung auf den
        // Tageshoechstpreis. Nur wenn die Saetze bekannt sind - geraten
        // wird nichts.
        const anzeige = document.getElementById('rental-preis');
        if (!anzeige) return;
        if (activeRental.preis_pro_minute === null || activeRental.preis_pro_minute === undefined
            || Number.isNaN(activeRental.preis_pro_minute)) { anzeige.textContent = ''; return; }
        const angefangen = Math.max(1, Math.ceil(diff / 60));
        const roh = activeRental.startgebuehr + angefangen * activeRental.preis_pro_minute;
        const betrag = Math.min(roh, activeRental.tageshoechstpreis ?? roh);
        anzeige.textContent = 'bisher ' + euro(betrag);
    }

    /* =================================================================
       RUECKGABE

       Vorher stand hier:

           // Station auswaehlen (vorerst erste Station)
           const endStation = db_Stations[0];

       Das "vorerst" hat drei Fassungen ueberlebt. db_Stations[0] war
       damals eine Station vierzig Kilometer entfernt; eine Testfahrt vom
       Marktplatz wurde dort verbucht - in 57 Sekunden. Falscher Bestand,
       falsche Position, unmoegliche Bewegungsdaten.

       Wo ein Rad abgestellt wird, ist eine fachliche Angabe. Sie wird
       jetzt erfragt: Station aus einer Liste, oder der eigene Standort
       im Geschaeftsgebiet. Geraten wird nichts mehr.
       ================================================================= */
    const rueckgabeModal = document.getElementById('rueckgabe-modal');
    const rueckgabeFrage = document.getElementById('rueckgabe-frage');
    const rueckgabeBeleg = document.getElementById('rueckgabe-beleg');
    const rueckgabeStatus = document.getElementById('rueckgabe-status');
    let rueckgabeOrt = null;      // {latitude, longitude} aus der Ortung
    let rueckgabeRuecksprung = null;

    function rueckgabeMelden(art, text) {
        if (!rueckgabeStatus) return;
        rueckgabeStatus.hidden = false;
        rueckgabeStatus.className = 'rueckgabe-status ist-' + art;
        rueckgabeStatus.textContent = text;
    }

    function rueckgabeStatusLeeren() {
        if (!rueckgabeStatus) return;
        rueckgabeStatus.hidden = true;
        rueckgabeStatus.textContent = '';
    }

    /* Liegt der Punkt im Geschaeftsgebiet? Dieselbe Frage beantwortet
       die Datenbank verbindlich (GR15 ueber fn_im_geschaeftsgebiet).
       Hier wird sie nur vorab gestellt, damit niemand erst nach dem
       Absenden erfaehrt, dass er zu weit draussen steht. Strahlensatz-
       Verfahren, weil Leaflet dafuer nichts mitbringt. */
    function imGeschaeftsgebiet(breite, laenge) {
        for (const flaeche of gebietFlaechen) {
            const ecken = flaeche.getLatLngs()[0];
            let drin = false;
            for (let i = 0, j = ecken.length - 1; i < ecken.length; j = i++) {
                const yi = ecken[i].lat, xi = ecken[i].lng;
                const yj = ecken[j].lat, xj = ecken[j].lng;
                if ((yi > breite) !== (yj > breite) &&
                    laenge < (xj - xi) * (breite - yi) / (yj - yi) + xi) drin = !drin;
            }
            if (drin) return true;
        }
        return false;
    }

    function entfernungMeter(a, b) {
        const R = 6371000, rad = Math.PI / 180;
        const dLat = (b.lat - a.lat) * rad, dLon = (b.lng - a.lng) * rad;
        const x = Math.sin(dLat / 2) ** 2 +
                  Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
        return Math.round(2 * R * Math.asin(Math.sqrt(x)));
    }

    /* Die Stationsliste im Dialog. Kennt die Anwendung den Standort,
       steht die naechstgelegene oben und die Entfernung dabei. */
    /* Kennt die Anwendung den Standort, steht die naechstgelegene Station
       oben. Kennt sie ihn nicht, ist die Startstation der beste Anhalt -
       sie steht dann oben und ist vorausgewaehlt.

       Der Grund: die Liste war alphabetisch. Eine Fahrt liess sich damit
       mit einem Klick am anderen Ende des Netzes zurueckgeben. Erlaubt
       ist das - Raeder werden umgesetzt -, naheliegend nicht. Die
       Entfernung steht jetzt bei jedem Eintrag, damit die Wahl bewusst
       faellt. */
    function rueckgabeStationenFuellen() {
        const feld = document.getElementById('rueckgabe-station');
        if (!feld) return;

        const start = activeRental?.start_station_id
            ? db_Stations.find(st => st.station_id === activeRental.start_station_id)
            : null;
        const bezug = rueckgabeOrt
            ? L.latLng(rueckgabeOrt.latitude, rueckgabeOrt.longitude)
            : (start && start.latitude ? L.latLng(start.latitude, start.longitude) : null);

        const zeilen = db_Stations
            .filter(st => st.latitude && st.longitude)
            .map(st => ({ st, meter: bezug ? entfernungMeter(bezug, L.latLng(st.latitude, st.longitude)) : null }));
        if (bezug) zeilen.sort((a, b) => a.meter - b.meter);
        else zeilen.sort((a, b) => a.st.name.localeCompare(b.st.name, 'de'));

        feld.innerHTML = zeilen.map(({ st, meter }) =>
            `<option value="${st.station_id}">${escapeHtml(st.name)}` +
            `${st.ort ? ' · ' + escapeHtml(st.ort) : ''}` +
            `${meter !== null ? ' · ' + (meter < 1000 ? meter + ' m' : (meter / 1000).toFixed(1) + ' km') : ''}` +
            `${meter === 0 ? ' · Startstation' : ''}` +
            `</option>`).join('');

        if (start) feld.value = String(start.station_id);
    }

    /* Eine Station in einer anderen Stadt ist erlaubt, aber selten
       gemeint. Statt es zu verbieten, wird nachgefragt. */
    function rueckgabeEntfernungPruefen() {
        const feld = document.getElementById('rueckgabe-station');
        const ziel = db_Stations.find(st => st.station_id === Number(feld.value));
        const start = activeRental?.start_station_id
            ? db_Stations.find(st => st.station_id === activeRental.start_station_id)
            : null;
        if (!ziel || !start || !ziel.latitude || !start.latitude) { rueckgabeStatusLeeren(); return; }
        const meter = entfernungMeter(L.latLng(start.latitude, start.longitude),
                                      L.latLng(ziel.latitude, ziel.longitude));
        if (meter > 5000) {
            rueckgabeMelden('hinweis',
                `${ziel.name} liegt ${(meter / 1000).toFixed(1)} km von deiner Startstation `
                + `${start.name} entfernt. Stimmt das?`);
        } else {
            rueckgabeStatusLeeren();
        }
    }

    function rueckgabeArt() {
        return document.querySelector('input[name="rueckgabeart"]:checked')?.value || 'station';
    }

    function rueckgabeAnsichtSetzen() {
        const frei = rueckgabeArt() === 'frei';
        document.getElementById('rueckgabe-station-block').hidden = frei;
        document.getElementById('rueckgabe-frei-block').hidden = !frei;
        rueckgabeStatusLeeren();
    }

    document.querySelectorAll('input[name="rueckgabeart"]').forEach(r =>
        r.addEventListener('change', rueckgabeAnsichtSetzen));
    document.getElementById('rueckgabe-station')?.addEventListener('change', rueckgabeEntfernungPruefen);

    document.getElementById('rueckgabe-standort')?.addEventListener('click', () => {
        if (!navigator.geolocation) {
            rueckgabeMelden('fehler',
                'Dieser Browser gibt keinen Standort heraus. Bitte gib das Rad an einer Station ab.');
            return;
        }
        rueckgabeMelden('hinweis', 'Standort wird ermittelt …');
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const { latitude, longitude } = pos.coords;
                rueckgabeOrt = { latitude, longitude };
                const drin = imGeschaeftsgebiet(latitude, longitude);
                document.getElementById('rueckgabe-ort').textContent =
                    `${latitude.toFixed(5)}, ${longitude.toFixed(5)}` +
                    (pos.coords.accuracy ? ` (± ${Math.round(pos.coords.accuracy)} m)` : '');
                rueckgabeStationenFuellen();
                if (drin) {
                    rueckgabeMelden('erfolg', 'Der Standort liegt im Geschäftsgebiet. Du kannst hier abstellen.');
                } else {
                    rueckgabeMelden('fehler',
                        'Dieser Standort liegt außerhalb des Geschäftsgebiets. '
                        + 'Dort lässt sich keine Fahrt beenden — bitte gib das Rad an einer Station ab.');
                }
            },
            (fehler) => {
                rueckgabeOrt = null;
                rueckgabeMelden('fehler', fehler.code === 1
                    ? 'Der Zugriff auf den Standort wurde abgelehnt. Bitte wähle eine Station.'
                    : 'Der Standort ließ sich nicht ermitteln. Bitte wähle eine Station.');
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 });
    });

    function rueckgabeOeffnen() {
        if (!activeRental) return;
        rueckgabeRuecksprung = document.activeElement;
        rueckgabeOrt = null;
        rueckgabeStatusLeeren();
        rueckgabeFrage.hidden = false;
        rueckgabeBeleg.hidden = true;
        document.getElementById('rueckgabe-ort').textContent = 'Noch kein Standort ermittelt.';
        document.querySelector('input[name="rueckgabeart"][value="station"]').checked = true;
        rueckgabeAnsichtSetzen();
        rueckgabeStationenFuellen();

        const minuten = Math.max(1, Math.ceil((Date.now() - activeRental.startzeit) / 60000));
        document.getElementById('rueckgabe-rad').textContent =
            `${activeRental.bikeInfo || 'Fahrrad'} ${activeRental.rahmennummer || ''}`.trim()
            + ` · seit ${minuten} ${minuten === 1 ? 'Minute' : 'Minuten'} unterwegs`;

        rueckgabeModal.style.display = 'flex';
        document.body.classList.add('dialog-offen');
        document.getElementById('rueckgabe-station').focus();
    }

    function rueckgabeSchliessen() {
        rueckgabeModal.style.display = 'none';
        document.body.classList.remove('dialog-offen');
        if (rueckgabeRuecksprung && document.contains(rueckgabeRuecksprung)) rueckgabeRuecksprung.focus();
        rueckgabeRuecksprung = null;
    }

    function rueckgabeOffen() { return rueckgabeModal.style.display === 'flex'; }

    document.getElementById('rueckgabe-schliessen')?.addEventListener('click', rueckgabeSchliessen);
    document.getElementById('beleg-schliessen')?.addEventListener('click', rueckgabeSchliessen);
    rueckgabeModal?.addEventListener('click', (e) => { if (e.target === rueckgabeModal) rueckgabeSchliessen(); });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && rueckgabeOffen()) { e.preventDefault(); rueckgabeSchliessen(); }
        if (e.key !== 'Tab' || !rueckgabeOffen()) return;
        const liste = Array.from(rueckgabeModal.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )).filter(el => !el.hidden && el.offsetParent !== null && !el.disabled);
        if (!liste.length) return;
        const erst = liste[0], letzt = liste[liste.length - 1];
        if (e.shiftKey && document.activeElement === erst) { e.preventDefault(); letzt.focus(); }
        else if (!e.shiftKey && document.activeElement === letzt) { e.preventDefault(); erst.focus(); }
    });

    endRentalBtn.addEventListener('click', rueckgabeOeffnen);

    document.getElementById('rueckgabe-bestaetigen')?.addEventListener('click', async () => {
        if (!activeRental) return;
        const knopf = document.getElementById('rueckgabe-bestaetigen');
        const art = rueckgabeArt();
        let station = null, breite = null, laenge = null;

        if (art === 'station') {
            station = Number(document.getElementById('rueckgabe-station').value);
            if (!station) { rueckgabeMelden('fehler', 'Bitte wähle eine Station.'); return; }
        } else {
            if (!rueckgabeOrt) {
                rueckgabeMelden('fehler', 'Ermittle zuerst deinen Standort oder wähle eine Station.');
                return;
            }
            if (!imGeschaeftsgebiet(rueckgabeOrt.latitude, rueckgabeOrt.longitude)) {
                rueckgabeMelden('fehler',
                    'Außerhalb des Geschäftsgebiets lässt sich keine Fahrt beenden.');
                return;
            }
            breite = rueckgabeOrt.latitude; laenge = rueckgabeOrt.longitude;
        }

        knopf.disabled = true;
        const beschriftung = knopf.textContent;
        knopf.textContent = 'Wird gebucht …';
        rueckgabeMelden('hinweis', 'Die Rückgabe wird verbucht …');

        try {
            const ergebnis = await endRental(activeRental.ausleihe_id, station, breite, laenge);
            const rad = `${activeRental.bikeInfo || 'Fahrrad'} ${activeRental.rahmennummer || ''}`.trim();
            const ortText = art === 'station'
                ? (db_Stations.find(st => st.station_id === station)?.name || 'Station')
                : `frei abgestellt bei ${breite.toFixed(5)}, ${laenge.toFixed(5)}`;

            activeRental = null;
            hideRentalBanner();
            belegZeigen(rad, ergebnis, ortText);

            await loadData();
            karteZeichnen();
        } catch (fehler) {
            console.error('Fehler beim Beenden:', fehler);
            rueckgabeMelden('fehler', fehler.message);
        } finally {
            knopf.disabled = false;
            knopf.textContent = beschriftung;
        }
    });

    /* Der Beleg bleibt stehen, bis er geschlossen wird. Vorher verschwand
       der Abschluss mit einem Toast nach sechs Sekunden - und mit ihm die
       einzige Stelle, an der Dauer, Ort und Betrag zu sehen waren. */
    async function belegZeigen(rad, ergebnis, ortText) {
        rueckgabeFrage.hidden = true;
        rueckgabeBeleg.hidden = false;
        rueckgabeStatusLeeren();

        const zeilen = [
            ['Fahrrad', rad],
            ['Dauer', `${ergebnis?.dauer_minuten ?? '—'} Min`],
            ['Abgestellt', ortText],
            ['Gesamtbetrag', (ergebnis?.gesamtbetrag ?? null) !== null ? euro(ergebnis.gesamtbetrag) : '—']
        ];
        document.getElementById('beleg-liste').innerHTML = zeilen.map(([b, w]) =>
            `<div><dt>${escapeHtml(b)}</dt><dd>${escapeHtml(w)}</dd></div>`).join('');

        // Die Aufschluesselung kommt aus der Abrechnung, nicht aus dem
        // Seitentext - sie muss zum Betrag passen, den die Datenbank
        // gebucht hat.
        const posten = document.getElementById('beleg-posten');
        posten.innerHTML = '<li><span>Positionen werden geladen …</span></li>';
        try {
            const fahrten = await fetchRentalHistory();
            const fehler = letzterLadeFehler('v_meine_ausleihe');
            const letzte = fahrten[0];
            if (fehler) {
                // Nicht schweigen: der Betrag oben stimmt, nur die
                // Aufschluesselung liess sich nicht holen.
                posten.innerHTML = `<li><span>Die Aufschlüsselung ließ sich nicht laden.</span></li>`;
            } else if (letzte && Array.isArray(letzte.positionen) && letzte.positionen.length) {
                posten.innerHTML = letzte.positionen.map(pos =>
                    `<li><span>${escapeHtml(pos.bezeichnung || pos.code || 'Position')}</span>` +
                    `<b>${escapeHtml(euro(pos.betrag))}</b></li>`).join('');
            } else {
                posten.innerHTML = '';
            }
        } catch (e) {
            posten.innerHTML = '';
        }
        document.getElementById('beleg-schliessen').focus();
    }

    /* =================================================================
       NAVIGATION

       Unter 1024 px stand .site-nav auf display:none und es gab keinen
       Ersatz - die drei wichtigsten Wege waren auf dem Geraet, auf dem
       man ein Leihrad sucht, nicht erreichbar.
       ================================================================= */
    /* Die Sprungmarke zeigte auf #facts-title, setzte den Fokus dort aber
       nicht. Wer sie benutzt, scrollt sonst zwar, tabbt danach aber
       weiter oben aus der Kopfzeile heraus. */
    document.querySelector('.sprungmarke')?.addEventListener('click', (e) => {
        const ziel = document.getElementById(e.currentTarget.getAttribute('href').slice(1));
        if (!ziel) return;
        e.preventDefault();
        ziel.setAttribute('tabindex', '-1');
        ziel.scrollIntoView({ behavior: 'auto', block: 'start' });
        ziel.focus({ preventScroll: true });
    });

    const menueKnopf = document.getElementById('menue-knopf');
    const menue = document.getElementById('menue');

    function menueSetzen(offen) {
        if (!menue || !menueKnopf) return;
        menue.hidden = !offen;
        menueKnopf.setAttribute('aria-expanded', String(offen));
        menueKnopf.setAttribute('aria-label', offen ? 'Menü schließen' : 'Menü öffnen');
        menueKnopf.classList.toggle('ist-offen', offen);
    }

    menueKnopf?.addEventListener('click', () => menueSetzen(menue.hidden));
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && menue && !menue.hidden) { menueSetzen(false); menueKnopf.focus(); }
    });

    // Jeder Sprung im Dokument geht ueber zuAbschnitt: der feste Kopf ist
    // 92 px hoch, ohne das lag die Ueberschrift danach darunter, und der
    // Fokus blieb auf dem Verweis, den man gerade verlassen hat.
    document.querySelectorAll('.site-nav a[href^="#"], .menue a[href^="#"], .primary-cta[href^="#"], .kopf-karte[href^="#"], .hero-cta[href^="#"]')
        .forEach(a => {
            a.addEventListener('click', (e) => {
                const id = a.getAttribute('href').slice(1);
                if (!document.getElementById(id)) return;
                e.preventDefault();
                menueSetzen(false);
                zuAbschnitt(id);
                if (id === 'map-section') setTimeout(gebietZeigen, 520);
            });
        });

    /* Der Knopf im ersten Bildschirm tritt ab, sobald die Buehne laeuft -
       sonst liegt er spaeter unter der zweiten Schlagzeile. */
    const heroCta = document.querySelector('.hero-cta');
    if (heroCta) {
        const ctaPruefen = () => heroCta.classList.toggle('ist-weg', window.scrollY > innerHeight * 0.28);
        addEventListener('scroll', ctaPruefen, { passive: true });
        ctaPruefen();
    }

    /* Die Zeitangabe neben der Zahl ist entfallen. Sie beantwortete eine
       Frage, die im Kopfbereich niemand stellt, und kostete die einzige
       wirklich wechselnde Zahl der Seite ihre Ruhe. Die Aktualitaet
       steht dort, wo sie zaehlt: in der Statuszeile unter der Karte. */

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
