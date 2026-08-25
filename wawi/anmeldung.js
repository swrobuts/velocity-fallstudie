// ============================================
// VeloCity Warenwirtschaft — Anmeldung und Rollen
//
// Angemeldet wird ueber dieselbe auth.users wie auf der Website. Ob
// jemand Mitarbeiter ist, sagt die Datenbank ueber velocity.
// ist_mitarbeiter(); WELCHE Rollen er traegt, sagt velocity.hat_rolle.
// Beide sind security definer und filtern ueber auth.uid() - ein
// Aufrufer erfaehrt durch sie nur etwas ueber sich selbst.
// ============================================

let rollenZwischenspeicher = null;
const wechselRueckrufe = [];

supabaseClient.auth.onAuthStateChange(() => {
    // Bei jedem Wechsel verfaellt der Rollenspeicher. Ihn stehen zu
    // lassen hiesse, dass nach einem Benutzerwechsel die Navigation des
    // Vorgaengers stehen bleibt.
    rollenZwischenspeicher = null;
    setTimeout(() => wechselRueckrufe.forEach((r) => r()), 0);
});

function beiAnmeldungsWechsel(rueckruf) {
    wechselRueckrufe.push(rueckruf);
}

async function anmelden(email, passwort) {
    const { error } = await supabaseClient.auth.signInWithPassword({ email, password: passwort });
    if (error) {
        throw new Error(error.message.includes('Invalid login')
            ? 'E-Mail oder Passwort stimmen nicht.'
            : error.message);
    }
}

async function abmelden() {
    await supabaseClient.auth.signOut();
    rollenZwischenspeicher = null;
}

function angemeldeterBenutzer() {
    return supabaseClient.auth.getUser();
}

// Liefert ein Set der Rollencodes. Leeres Set heisst: angemeldet, aber
// kein Mitarbeiter - der haeufigste Fall, weil jeder KUNDE sich hier
// anmelden koennte. Die Oberflaeche muss das unterscheiden koennen,
// deshalb null fuer "gar nicht angemeldet".
async function meineRollen() {
    if (rollenZwischenspeicher) return rollenZwischenspeicher;

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return null;

    const { data: istMitarbeiter } = await supabaseClient.rpc('ist_mitarbeiter');
    if (!istMitarbeiter) {
        rollenZwischenspeicher = new Set();
        return rollenZwischenspeicher;
    }

    // Vier einzelne Aufrufe statt einer Sicht auf mitarbeiter_rolle: die
    // Tabelle ist fuer den Browser unerreichbar, und das soll sie
    // bleiben. hat_rolle verraet nur, was der Aufrufer ohnehin weiss.
    const treffer = await Promise.all(
        WAWI_CONFIG.rollen.map(async (code) => {
            const { data } = await supabaseClient.rpc('hat_rolle', { p_code: code });
            return data ? code : null;
        })
    );
    rollenZwischenspeicher = new Set(treffer.filter(Boolean));
    return rollenZwischenspeicher;
}
