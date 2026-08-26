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

supabaseClient.auth.onAuthStateChange((ereignis) => {
    // Nur bei einem ECHTEN Benutzerwechsel verfaellt der Rollenspeicher.
    // TOKEN_REFRESHED kommt stuendlich waehrend einer laufenden Sitzung -
    // dabei die Rollen neu zu laden hiesse fuenf RPC-Aufrufe und einen
    // Neuaufbau der Navigation, waehrend jemand mitten in einer Buchung
    // steckt.
    if (['SIGNED_IN', 'SIGNED_OUT', 'USER_UPDATED'].includes(ereignis)) {
        rollenZwischenspeicher = null;
        // setTimeout mit 0: Supabase haelt waehrend onAuthStateChange
        // eine Sperre. Ein Rueckruf, der von hier aus synchron wieder in
        // den Client greift - und genau das tut jeder, der meineRollen()
        // aufruft -, blockiert ihn. Dieselbe Falle steht in
        // src/auth.js beschrieben; sie hat die Website einmal
        // eingefroren.
        setTimeout(() => wechselRueckrufe.forEach((r) => r()), 0);
    }
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

// Liefert VIER moegliche Zustaende, nicht drei - ein Mitarbeiter ohne
// zugeteilte Rolle ist etwas anderes als ein Kunde ohne Mitarbeiterkonto,
// auch wenn beide vorher als leeres Set durchgingen:
//
//   null        gar nicht angemeldet
//   false       angemeldet, aber kein Mitarbeiter
//   Set (leer)  Mitarbeiter, aber (noch) ohne zugeteilte Rolle
//   Set (voll)  Mitarbeiter mit Rollen
//
// Der Unterschied zwischen "kein Mitarbeiter" und "Mitarbeiter ohne
// Rolle" entscheidet, wohin die Oberflaeche jemanden schickt: der eine
// gehoert zur Kundenverwaltung, der andere braucht nur eine Rollen-
// zuteilung durch die Leitung. Beide als leeres Set zu behandeln haette
// bei genau einem Mitarbeiter im Bestand jeden zweiten neuen Kollegen
// in die falsche Richtung geschickt.
async function meineRollen() {
    // Zwischenspeicher-Pruefung ausdruecklich NICHT auf Wahrheitswert:
    // false ist ein echtes, zwischenspeicherbares Ergebnis (kein
    // Mitarbeiter) und wuerde eine truthy-Pruefung als "noch nicht
    // geladen" missverstehen - dann waere der Speicher fuer diesen Fall
    // wirkungslos und jeder Aufruf fragte erneut. null bleibt der
    // Sentinel-Wert fuer "noch nicht geladen", weil "gar nicht
    // angemeldet" (ebenfalls null) unten NIE in den Speicher geschrieben
    // wird - der naechste Aufruf soll ja pruefen duerfen, ob inzwischen
    // eine Sitzung besteht.
    if (rollenZwischenspeicher !== null) return rollenZwischenspeicher;

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return null;

    // error MUSS ausgewertet werden. Ein technischer Fehlschlag liefert
    // data = null - genau dieselbe Form wie ein berechtigtes "nein".
    // Ohne diese Pruefung sieht ein Netzwerkfehler aus wie "kein
    // Mitarbeiter", und die Oberflaeche zeigt "Kein Zugang" statt eines
    // Fehlers. Spurlos, nicht einmal ein Eintrag in der Konsole.
    const { data: istMitarbeiter, error: fehlerMitarbeiter } =
        await supabaseClient.rpc('ist_mitarbeiter');
    if (fehlerMitarbeiter) {
        throw new Error(`Die Rollen liessen sich nicht ermitteln: ${fehlerMitarbeiter.message}`);
    }
    if (!istMitarbeiter) {
        rollenZwischenspeicher = false;
        return rollenZwischenspeicher;
    }

    // Vier einzelne Aufrufe statt einer Sicht auf mitarbeiter_rolle: die
    // Tabelle ist fuer den Browser unerreichbar, und das soll sie
    // bleiben. hat_rolle verraet nur, was der Aufrufer ohnehin weiss.
    const treffer = await Promise.all(
        WAWI_CONFIG.rollen.map(async (code) => {
            const { data, error } = await supabaseClient.rpc('hat_rolle', { p_code: code });
            if (error) {
                throw new Error(`Rolle ${code} liess sich nicht pruefen: ${error.message}`);
            }
            return data ? code : null;
        })
    );
    rollenZwischenspeicher = new Set(treffer.filter(Boolean));
    return rollenZwischenspeicher;
}
