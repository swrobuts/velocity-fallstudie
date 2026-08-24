// ============================================
// VeloCity - Authentifizierung (Supabase Auth)
// ============================================

// Auth-State
let currentUser = null;
let authStateListeners = [];

// Auth State Change Handler registrieren
supabaseClient.auth.onAuthStateChange(async (event, session) => {
    currentUser = session?.user ?? null;
    console.log('Auth State Changed:', event, currentUser?.email);

    // Kundensatz sicherstellen, bevor die Oberflaeche reagiert.
    // Idempotent: legt nur an, was noch fehlt. Ersetzt den frueheren
    // Trigger auf auth.users - ein Fremdschema fasst diese Anwendung
    // nicht an.
    if (currentUser) {
        await ensureKunde();
    }

    // Alle Listener benachrichtigen
    authStateListeners.forEach(listener => {
        try {
            listener(currentUser);
        } catch (e) {
            console.error('Auth listener error:', e);
        }
    });
});

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
}

// Auth initialisieren
initAuth();
