// ============================================
// VeloCity - Authentifizierung (Supabase Auth)
// ============================================

// Auth-State
let currentUser = null;
let authStateListeners = [];

// Auth State Change Handler registrieren
supabaseClient.auth.onAuthStateChange((event, session) => {
    currentUser = session?.user ?? null;
    console.log('Auth State Changed:', event, currentUser?.email);

    // Die Oberflaeche zuerst: sie darf nicht auf einen Netzaufruf warten.
    benachrichtigen();

    /* Der Kundensatz danach, und ausdruecklich AUSSERHALB dieses
       Rueckrufs. Supabase haelt waehrend onAuthStateChange eine Sperre;
       wer darin auf einen weiteren Aufruf desselben Clients wartet -
       ensureKunde ruft api_kunde_sicherstellen -, kann den Client
       blockieren. Danach reagiert keine Anmeldung mehr, bis die Seite
       neu geladen wird. setTimeout(0) loest den Aufruf aus der Sperre.

       Idempotent: legt nur an, was noch fehlt, und verknuepft einen
       vorhandenen Kundensatz derselben E-Mail, statt einen zweiten
       anzulegen. Ersetzt den frueheren Trigger auf auth.users - ein
       Fremdschema fasst diese Anwendung nicht an. */
    if (currentUser) {
        setTimeout(async () => {
            try {
                await ensureKunde();
            } catch (e) {
                console.error('Kundensatz konnte nicht sichergestellt werden:', e);
            }
            benachrichtigen();
        }, 0);
    }
});

function benachrichtigen() {
    authStateListeners.forEach(listener => {
        try {
            listener(currentUser);
        } catch (e) {
            console.error('Auth listener error:', e);
        }
    });
}

// Listener registrieren (wird bei Auth-Aenderungen aufgerufen)
function onAuthStateChange(callback) {
    authStateListeners.push(callback);
    // Initial aufrufen mit aktuellem State
    callback(currentUser);
}

// ===== LOGIN =====
async function login(email, password) {
    const { data, error } = await supabaseClient.auth.signInWithPassword({
        email: email,
        password: password
    });

    if (error) {
        console.error('Login-Fehler:', error);
        throw new Error(translateAuthError(error.message));
    }

    return data.user;
}

// ===== REGISTRIERUNG =====
async function register(email, password, vorname, nachname) {
    const { data, error } = await supabaseClient.auth.signUp({
        email: email,
        password: password,
        options: {
            data: {
                vorname: vorname,
                nachname: nachname
            }
        }
    });

    if (error) {
        console.error('Registrierungs-Fehler:', error);
        throw new Error(translateAuthError(error.message));
    }

    // Supabase kann Email-Bestaetigung erfordern
    if (data.user && !data.session) {
        throw new Error('EMAIL_CONFIRMATION_REQUIRED');
    }

    return data.user;
}

// ===== PASSWORT ZURUECKSETZEN =====
// Bisher gab es keinen Weg zurueck ins Konto. Supabase schickt den Link
// selbst; die Seite muss nur sagen, wohin er fuehren soll.
async function passwortZuruecksetzen(email) {
    const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + window.location.pathname
    });
    if (error) {
        console.error('Passwort-Reset-Fehler:', error);
        throw new Error(translateAuthError(error.message));
    }
}

// ===== LOGOUT =====
async function logout() {
    const { error } = await supabaseClient.auth.signOut();
    if (error) {
        console.error('Logout-Fehler:', error);
        throw new Error(translateAuthError(error.message));
    }
}

// ===== HILFSFUNKTIONEN =====

function getCurrentUser() {
    return currentUser;
}

function isAuthenticated() {
    return currentUser !== null;
}

function getUserDisplayName() {
    if (!currentUser) return null;

    const metadata = currentUser.user_metadata;
    if (metadata?.vorname) {
        return metadata.vorname;
    }

    // Fallback: Email-Prefix
    return currentUser.email?.split('@')[0] || 'User';
}

/* Fehlermeldungen uebersetzen.

   Eine Pruefung von aussen blieb bei "Error sending confirmation email"
   haengen - englisch, ohne Ursache und ohne naechsten Schritt. Der
   Mailversand haengt an einem Server, der auch einmal ausfaellt; dann
   muss wenigstens dastehen, was zu tun ist. Unbekannte Meldungen werden
   nicht mehr roh durchgereicht: sie bekommen einen deutschen Rahmen und
   behalten den Originaltext in Klammern, damit man ihn melden kann. */
function translateAuthError(message) {
    const translations = {
        'Error sending confirmation email':
            'Die Bestätigungs-E-Mail konnte gerade nicht versendet werden. '
            + 'Das liegt am Mailserver, nicht an deinen Angaben — bitte in ein paar Minuten erneut versuchen.',
        'Error sending recovery email':
            'Die E-Mail zum Zurücksetzen konnte gerade nicht versendet werden. '
            + 'Bitte in ein paar Minuten erneut versuchen.',
        'Signups not allowed for this instance':
            'Neue Konten sind auf diesem Server gerade nicht freigeschaltet.',
        'Password should be at least 6 characters.':
            'Passwort muss mindestens 6 Zeichen haben',
        'Anonymous sign-ins are disabled':
            'Eine Nutzung ohne Konto ist nicht vorgesehen.',
        'Failed to fetch':
            'Keine Verbindung zum Server. Prüfe deine Internetverbindung und versuche es erneut.',
        // Diese Meldung kommt, wenn ein Trigger auf auth.users die
        // Registrierung zurueckrollt - etwa weil zu dieser E-Mail schon
        // Kundendaten aus dem Altsystem vorliegen. "Erneut versuchen"
        // hilft dabei nicht und fuehrt in eine Sackgasse.
        'Database error saving new user':
            'Zu dieser E-Mail-Adresse liegen bereits Kundendaten vor. '
            + 'Das Konto lässt sich daher nicht neu anlegen — bitte melde dich unter '
            + 'hilfe@velocity-wue.de, dann verbinden wir dein bestehendes Konto.',
        'Invalid login credentials': 'Ungültige E-Mail oder Passwort',
        'Email not confirmed': 'Bitte bestätigen Sie zuerst Ihre E-Mail-Adresse',
        'User already registered': 'Diese E-Mail-Adresse ist bereits registriert',
        'Password should be at least 6 characters': 'Passwort muss mindestens 6 Zeichen haben',
        'Unable to validate email address: invalid format': 'Ungültige E-Mail-Adresse',
        'Email rate limit exceeded': 'Zu viele Versuche. Bitte warten Sie einen Moment.',
        'For security purposes, you can only request this after 60 seconds.':
            'Aus Sicherheitsgründen ist das erst nach 60 Sekunden wieder möglich.'
    };

    if (translations[message]) return translations[message];
    // Unbekannt: verstaendlich rahmen, Original mitgeben.
    console.warn('Unuebersetzte Auth-Meldung:', message);
    return `Das hat gerade nicht geklappt. Bitte versuche es erneut. (${message})`;
}

// Session beim Laden wiederherstellen
async function initAuth() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
        currentUser = session.user;
        await ensureKunde();
        authStateListeners.forEach(listener => listener(currentUser));
    }
    demoZugangAufbauen();
}

// Auth initialisieren
initAuth();

/* Der Demozugang zeigt sich nur, wenn BEIDE Werte gesetzt sind. Ein
   Knopf ohne Kennwort waere eine Anmeldung, die sicher fehlschlaegt,
   und ein Hinweis ohne Knopf eine Anleitung ins Leere. */
function demoZugangAufbauen() {
    const email = (APP_CONFIG.demoEmail || '').trim();
    const kennwort = (APP_CONFIG.demoPasswort || '').trim();
    const bereich = document.getElementById('demo-zugang');
    if (!bereich || !email || !kennwort) return;

    // textContent, nicht innerHTML: der Text traegt Werte aus der
    // Konfiguration, und die gehoeren nicht als Markup interpretiert.
    document.getElementById('demo-hinweis').textContent =
        `Zum Ausprobieren: Anmeldung „${email}", Kennwort „${kennwort}".`;
    bereich.hidden = false;

    document.getElementById('demo-anmelden').addEventListener('click', async () => {
        // login() liefert bei Erfolg data.user und wirft bei Fehler einen
        // Error - kein { success }. translateAuthError hat die Meldung
        // bereits ins Deutsche uebersetzt; sie wird unveraendert gezeigt.
        try {
            await login(email, kennwort);
        } catch (fehler) {
            const status = document.getElementById('auth-status');
            status.textContent = fehler.message;
            status.hidden = false;
        }
    });
}
