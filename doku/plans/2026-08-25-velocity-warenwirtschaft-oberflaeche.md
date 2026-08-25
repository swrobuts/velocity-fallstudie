# VeloCity Warenwirtschaft — Umsetzungsplan Schritt 2: Oberfläche

> **Für agentische Bearbeiter:** ERFORDERLICHE SUB-SKILL: `superpowers:subagent-driven-development` (empfohlen) oder `superpowers:executing-plans`, um diesen Plan Aufgabe für Aufgabe umzusetzen. Die Schritte nutzen Checkbox-Syntax (`- [ ]`) zur Nachverfolgung.

**Ziel:** Eine Arbeitsoberfläche für Mitarbeitende unter `wawi.butscher.cloud`, die Flotte, Stationen, Kunden und Instandhaltung bedient und die Auswertungen zeigt — ausschließlich über die zehn `v_wawi_*`-Sichten und die dreizehn `api_*`-Funktionen aus Schritt 1.

**Architektur:** Neues Verzeichnis `wawi/` neben `src/`, dieselbe Machart wie die Website: kein Framework, kein Bauschritt, Vanilla-JavaScript mit `supabase-js` v2 aus dem CDN. Der Aufbau folgt der Tradition der ERP-Systeme — feste Kopfleiste, Navigation nach Aufgabenbereich links, Arbeitsliste und Detailmaske nebeneinander, Statuszeile unten. Ausgeliefert wird als statisches Verzeichnis hinter demselben Traefik wie `bikes.butscher.cloud`.

**Tech-Stack:** HTML, CSS und JavaScript ohne Bauwerkzeuge; `supabase-js` v2 über CDN; PostgREST gegen Schema `velocity`; nginx:alpine hinter Traefik; Python 3 für die Prüfwerkzeuge; Bash für Abnahme und Auslieferung.

**Spec:** `doku/specs/2026-08-25-velocity-warenwirtschaft-design.md`, insbesondere Abschnitt 6 — der Plan argumentiert aus der Spec; beide zusammen lesen.

**Vorgänger:** `doku/plans/2026-08-25-velocity-warenwirtschaft-datenbank.md` ist umgesetzt und zusammengeführt. Die Datenbank trägt 123 pgTAP-Testfunktionen, `tools/abnahme.sh` prüft 27 Punkte, alle grün.

**Ablageort abweichend vom Standard:** Der Plan liegt unter `doku/plans/` statt `docs/superpowers/plans/`, weil `docs/` in diesem Repository für die Auslieferung reserviert ist.

---

## Globale Randbedingungen

Diese Vorgaben gelten für **jede** Aufgabe und werden dort nicht wiederholt.

- **Die Oberfläche liest ausschließlich `v_wawi_*`-Sichten und schreibt ausschließlich über `api_*`-Funktionen.** Keine Basistabelle, keine `fn_`-Funktion. `tools/abnahme.sh` prüft das für `src/` bereits von außen; für `wawi/` kommt dieselbe Prüfung dazu (Aufgabe 9).
- **Kein Bauschritt, kein Framework, keine Abhängigkeit im Browser außer `supabase-js` v2 aus dem CDN.** Die Seite muss sich mit `python3 -m http.server` öffnen lassen. Das ist eine didaktische Entscheidung: Studierende sollen jede Zeile lesen können, ohne ein Bündelwerkzeug zu verstehen.
- **Deutsch in Bezeichnern, Kommentaren und Oberfläche.** JavaScript-Bezeichner in `camelCase`, CSS-Klassen in `kebab-case`, beides deutsch (`arbeitsliste`, `detailmaske`, `statusZeile`).
- **Kommentare begründen, sie beschreiben nicht.** Vorbild ist `src/supabase.js` — dort steht bei der Fehlerbehandlung, *warum* ein Fehler nicht als leere Liste durchgereicht wird, und welcher Vorfall dazu geführt hat.
- **Keine Klartext-Geheimnisse.** Der anon-Key gehört in `wawi/config.js` und ist bewusst öffentlich; der service_role-Key und das Postgres-Passwort niemals.
- **Rollenabhängige Navigation:** Was eine Rolle nicht darf, wird **nicht angezeigt** — nicht ausgegraut. Was man nicht darf, soll man nicht suchen.
- **Tastatur vor Maus:** Tab durch die Felder, `Strg+S` speichert, `Escape` verwirft, Pfeiltasten bewegen in der Arbeitsliste. Eine Arbeitsmaske, die Maushandbetrieb erzwingt, kostet bei Wiederholung Minuten.
- **Die Statuszeile bestätigt jede Buchung.** Wer zwanzig Räder nacheinander umbucht, braucht die Rückmeldung dort, wo er hinsieht — nicht als Blase in der Ecke.
- **Farbe trägt Bedeutung, nicht Dekoration.** Rot ist ein defektes Rad, nicht ein Knopf.
- **Jede Aufgabe endet mit genau einem Commit.** Deutschsprachige Nachrichten, Präfixe `feat:`, `fix:`, `docs:`, `test:`, `chore:`. **Nicht pushen.**
- **Zugangsdaten ausschließlich aus `.env`** (in `.gitignore`). Prüfwerkzeuge lesen sie wie `db/run.py`.
- **Barrierefreiheit als Untergrenze, nicht als Kür:** sichtbarer Tastaturfokus, `aria-live` an der Statuszeile, Beschriftungen an jedem Eingabefeld, Kontrast mindestens 4.5:1.

---

## Was Schritt 1 bereitstellt

Damit niemand raten muss, womit die Oberfläche arbeitet. Alles davon existiert und ist geprüft.

**Zehn Sichten.** Lesen mit `supabaseClient.from('<name>').select(...)`:

| Sicht | Inhalt | Sichtbar für |
|---|---|---|
| `v_wawi_flotte` | Rad, Typ, Status, Standort, letzte Wartung, offene Schäden, höchste Schwere | `disposition`, `werkstatt`, `leitung` |
| `v_wawi_kunde` | Stammdaten, Tarif, Fahrten und Umsatz als **Summe**, offener Betrag | `kundenservice`, `leitung` |
| `v_wawi_station` | Station, Kapazität, belegt, frei, Betriebszeitraum | `disposition`, `leitung` |
| `v_wawi_schaden` | offene Meldungen mit Rad, Schwere, Alter, Melderart | `werkstatt`, `leitung` |
| `v_wawi_auftrag` | Wartungsaufträge mit Bearbeiter und Stand | `werkstatt`, `leitung` |
| `v_wawi_umsatz_radtyp` | Monat, Radtyp, Fahrten, Minuten, Umsatz, Umsatz je Fahrt | `leitung` |
| `v_wawi_umsatz_kundengruppe` | Monat, Tarif, Kunden, Fahrten, Umsatz je Kunde | `leitung` |
| `v_wawi_km_co2` | Monat, Radtyp, Kilometer, `fahrten_geschaetzt`, `anteil_geschaetzt`, CO₂-Ersparnis | `leitung` |
| `v_wawi_stationsauslastung` | Station, Abgänge, Zugänge, Saldo, Füllstand | `disposition`, `leitung` |
| `v_wawi_fahrt_km` | Strecke je Fahrt mit `verfahren` (`gemessen`/`aus_dauer`/`aus_luftlinie`) | `leitung` |

**Eine Sicht benutzt die Oberfläche bewusst nicht: `v_wawi_fahrt_km`.**
Sie ist die Hilfssicht, aus der `v_wawi_km_co2` seine Monatszahlen bildet,
und sie führt Einzelfahrten mit `kunde_id` und Zeitstempel. Genau das ist
das Bewegungsprofil, dessen Fernhalten die Spezifikation zum Lehrpunkt
macht — eine Fahrtenliste daraus zu bauen wäre technisch möglich und
fachlich der Fehler, den Schritt 1 an dieser Stelle bereits einmal
gemacht und korrigiert hat. Wer sie in einer Maske braucht, hat ein
anderes Problem als eine fehlende Sicht.

**Wichtig zum Verständnis:** Diese Sichten filtern **selbst** über `velocity.hat_rolle(...)`. Wer die Rolle nicht hat, bekommt keine Fehlermeldung, sondern **null Zeilen**. Die Oberfläche muss das unterscheiden können — dazu Aufgabe 2.

**Dreizehn schreibende Funktionen.** Aufrufen mit `supabaseClient.rpc('<name>', { ... })`:

```
api_rad_anlegen(p_rahmennummer, p_modell_id, p_station_id)        -> fahrrad_id
api_rad_status_setzen(p_fahrrad_id, p_status, p_bemerkung)        -> void
api_rad_ausmustern(p_fahrrad_id, p_grund)                         -> void
api_station_anlegen(p_name, p_strasse, p_hausnummer, p_plz,
                    p_ort, p_latitude, p_longitude, p_kapazitaet) -> station_id
api_station_stilllegen(p_station_id, p_zum)                       -> void
api_kunde_anlegen(p_vorname, p_nachname, p_email, p_telefon)      -> kunde_id
api_kunde_aktualisieren(p_kunde_id, p_vorname, p_nachname,
                        p_telefon, p_strasse, p_hausnummer,
                        p_plz, p_ort)                             -> void
api_kunde_sperren(p_kunde_id, p_grund)                            -> void
api_kunde_auskunft(p_kunde_id)                                    -> jsonb
api_kunde_anonymisieren(p_kunde_id, p_grund)                      -> void
api_schaden_melden(p_fahrrad_id, p_kategorie, p_beschreibung,
                   p_schwere)                                     -> schadensmeldung_id
api_auftrag_eroeffnen(p_fahrrad_id, p_schadensmeldung_id)         -> wartungsauftrag_id
api_auftrag_erledigen(p_wartungsauftrag_id, p_arbeitszeit_minuten,
                      p_bemerkung)                                -> void
```

**Zwei Prädikatsfunktionen**, für `authenticated` freigegeben, damit die Oberfläche ihre Navigation bauen kann:

```
velocity.ist_mitarbeiter()   -> boolean
velocity.hat_rolle(p_code)   -> boolean     -- 'disposition' | 'werkstatt' | 'kundenservice' | 'leitung'
```

**Ein Konto zum Anmelden:** `swrobuts@googlemail.com`, Mitarbeiter `M-0001`, alle vier Rollen. Dasselbe Konto gehört zugleich Kunde 2334 — dieselbe Person ist Kunde **und** Mitarbeiter, und das ist Absicht.

**Zustand der Daten, den die Oberfläche vorfindet:**

| Bereich | Menge |
|---|---|
| Räder | 275 |
| Stationen | 10 |
| Kunden | 1014, davon **519 gesperrt** |
| Fahrten im Referenzjahr | 12 030 |
| Rechnungen | 4117 |
| **Schadensmeldungen** | **0** |
| **Wartungsaufträge** | **0** |
| Mitarbeitende | 1 |

**Die beiden Nullen sind der wichtigste Satz dieses Abschnitts.** Zwei der fünf Arbeitsbereiche haben keine Daten. Aufgabe 6 baut gegen leere Sichten — das ist kein Fehler, sondern der Grund, warum die Leermasken dort mit derselben Sorgfalt entstehen müssen wie die gefüllten. Wer erst mit Daten anfängt, baut die Leermaske nie.

---

## Dateistruktur

| Datei | Verantwortung |
|---|---|
| `wawi/index.html` | Das Gerüst: Kopfleiste, Navigation, Arbeitsbereich, Statuszeile. Eine Seite, keine Unterseiten |
| `wawi/style.css` | Das gesamte Aussehen. Dichter gepackt als die Website: kleinere Grade, engere Zeilen |
| `wawi/config.js` | Adresse und anon-Key, wie `src/config.js` |
| `wawi/daten.js` | **Die einzige Datei, die mit Supabase spricht.** Lesen aus Sichten, Schreiben über `api_` |
| `wawi/anmeldung.js` | Anmelden, Abmelden, Rollen ermitteln, Sitzung beobachten |
| `wawi/rahmen.js` | Navigation, Bereichswechsel, Statuszeile, Tastaturbedienung |
| `wawi/flotte.js` | Arbeitsbereich Flotte |
| `wawi/stationen.js` | Arbeitsbereich Stationen |
| `wawi/kunden.js` | Arbeitsbereich Kunden samt Auskunft und Anonymisierung |
| `wawi/instandhaltung.js` | Arbeitsbereich Schäden und Aufträge |
| `wawi/auswertungen.js` | Arbeitsbereich Auswertungen |
| `deploy/wawi-compose.yml` | nginx hinter Traefik für `wawi.butscher.cloud` |
| `deploy/wawi-nginx.conf` | nginx-Konfiguration |
| `tools/wawi_veroeffentlichen.sh` | Auslieferung mit Gegenprobe |
| `tools/wawi_check.py` | Statische Prüfung: Vertrag zwischen HTML und JS, Bedienbarkeit |

**Warum eine Seite und nicht fünf.** Ein Bereichswechsel ohne Seitenneuladen hält die Sitzung, die Rollen und die Statuszeile am Leben. Der Preis ist eine eigene Zustandsverwaltung — die ist hier klein, weil jeder Bereich dieselbe Form hat: Liste laden, Auswahl merken, Maske füllen.

---

## Aufgabe 1: Gerüst und Anmeldung

**Dateien:**
- Anlegen: `wawi/index.html`, `wawi/style.css`, `wawi/config.js`, `wawi/daten.js`, `wawi/anmeldung.js`, `wawi/assets/favicon.svg` (Kopie aus `src/assets/`)

**Schnittstellen:**
- Liefert: `SUPABASE_CONFIG`, `WAWI_CONFIG`; `anmelden(email, passwort)`, `abmelden()`, `angemeldeterBenutzer()`, `meineRollen()` (liefert `Set<string>`), `beiAnmeldungsWechsel(rueckruf)`; `ladeListe(quelle, spalten, aufbau)`, `letzterLadeFehler(quelle)`, `rufeAuf(funktion, argumente)`

- [ ] **Schritt 1: `wawi/config.js`**

```javascript
// ============================================
// VeloCity Warenwirtschaft — Konfiguration
// ============================================

const SUPABASE_CONFIG = {
    url: 'https://supabase.butscher.cloud',
    // Derselbe oeffentliche anon-Key wie auf der Website, und aus
    // demselben Grund unbedenklich: er wird an jeden Browser
    // ausgeliefert. Der Schutz liegt in RLS, in den Rechten des Schemas
    // und darin, dass jede v_wawi-Sicht selbst ueber hat_rolle filtert.
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzYyNjc5NTM1LCJleHAiOjIwNzgwMzk1MzV9.Fv3soDCs_GrM9MA-4Goq1ANCoJ7KzVpuJ9l9z7bQEwk'
};

const WAWI_CONFIG = {
    schema: 'velocity',
    // Die vier Rollen aus velocity.rolle, in der Reihenfolge, in der die
    // Navigation sie zeigt. Nicht aus der Datenbank gelesen: die
    // Reihenfolge ist eine Gestaltungsentscheidung, keine Fachdatenzeile.
    rollen: ['disposition', 'werkstatt', 'kundenservice', 'leitung']
};
```

- [ ] **Schritt 2: `wawi/daten.js` — die einzige Datei, die mit Supabase spricht**

```javascript
// ============================================
// VeloCity Warenwirtschaft — Datenzugriff
//
// Regel dieser Schicht, dieselbe wie bei der Website: gelesen wird
// ausschliesslich aus v_wawi-Sichten, geschrieben ausschliesslich ueber
// api_-Funktionen. Auf Basistabellen greift der Browser nie zu - er
// kaeme auch gar nicht an sie heran, tools/abnahme.sh prueft das von
// aussen.
// ============================================

const supabaseClient = window.supabase.createClient(
    SUPABASE_CONFIG.url,
    SUPABASE_CONFIG.anonKey,
    { db: { schema: WAWI_CONFIG.schema } }
);

// Eine leere Liste ist eine Aussage: "es gibt nichts". Ein Fehler ist
// eine andere: "ich konnte nicht nachsehen". Auf der Website hat das
// Zusammenwerfen beider Faelle einmal einen fehlenden GRANT als "keine
// Fahrten" erscheinen lassen - der Beleg blieb wortlos leer. Hier ist es
// noch heikler: die v_wawi-Sichten liefern bei fehlender ROLLE ebenfalls
// null Zeilen, voellig fehlerfrei. Drei Zustaende, die gleich aussehen
// und verschieden bedeuten.
const ladeFehler = new Map();

async function ladeListe(quelle, spalten = '*', aufbau = (q) => q) {
    const { data, error } = await aufbau(supabaseClient.from(quelle).select(spalten));
    if (error) {
        console.error(`Fehler beim Laden von ${quelle}:`, error.message);
        ladeFehler.set(quelle, error.message);
        return [];
    }
    ladeFehler.delete(quelle);
    return data || [];
}

function letzterLadeFehler(quelle) {
    return ladeFehler.get(quelle) || null;
}

// Schreibende Aufrufe. Anders als beim Lesen wird der Fehler NICHT
// geschluckt: wer bucht, muss wissen, ob die Buchung angekommen ist.
async function rufeAuf(funktion, argumente = {}) {
    const { data, error } = await supabaseClient.rpc(funktion, argumente);
    if (error) {
        throw new Error(uebersetzeFehler(error.message));
    }
    return data;
}

// Die Datenbank meldet fachliche Fehler im Klartext, aber technische in
// PostgreSQL-Sprache. Beides landet sonst wortgleich in der Statuszeile.
function uebersetzeFehler(meldung) {
    if (meldung.includes('Rolle') && meldung.includes('erforderlich')) {
        return meldung;   // fachlich, schon verstaendlich
    }
    if (meldung.includes('permission denied')) {
        return 'Dafuer fehlt die Berechtigung.';
    }
    if (meldung.includes('duplicate key')) {
        return 'Dieser Wert ist bereits vergeben.';
    }
    if (meldung.includes('violates check constraint')) {
        return 'Die Eingabe verletzt eine Geschaeftsregel.';
    }
    return meldung;
}
```

- [ ] **Schritt 3: `wawi/anmeldung.js`**

```javascript
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

// VIER Rueckgaben, weil es vier Faelle gibt und drei davon leicht
// verwechselt werden:
//
//   null        gar nicht angemeldet
//   false       angemeldet, aber kein Mitarbeiter - der haeufigste Fall,
//               weil jeder KUNDE sich hier anmelden kann
//   Set (leer)  Mitarbeiter, aber ohne jede Rolle. Ein echter Kollege
//               mit einem Eintrag in velocity.mitarbeiter, dem nur
//               niemand eine Aufgabe zugeteilt hat. Ihm "Sie sind nicht
//               als Mitarbeitendenkonto hinterlegt" zu sagen waere
//               schlicht falsch - und er wuesste nicht, wen er fragen
//               soll.
//   Set (voll)  Mitarbeiter mit Rollen
//
// Der Unterschied zwischen false und dem leeren Set kostet eine Zeile
// und erspart einem Kollegen einen Anruf bei der falschen Stelle.
async function meineRollen() {
    if (rollenZwischenspeicher) return rollenZwischenspeicher;

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
        return false;
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
```

- [ ] **Schritt 4: `wawi/index.html` — das Gerüst**

Eine Seite mit fünf Zuständen, die einander ablösen: Anmeldemaske, „kein Mitarbeiter", Arbeitsoberfläche, Ladezustand. Verwende genau diese `id`-Werte — `tools/wawi_check.py` aus Aufgabe 9 prüft den Vertrag zwischen HTML und JavaScript gegen sie:

```html
<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>VeloCity Warenwirtschaft</title>
  <link rel="stylesheet" href="style.css">
  <!-- Eigene Kopie, kein Verweis nach ../src: die Warenwirtschaft wird
       als eigenes Verzeichnis ausgeliefert und hat oberhalb ihrer Wurzel
       nichts. Der Verweis lieferte schon lokal einen 404. -->
  <link rel="icon" href="assets/favicon.svg" type="image/svg+xml">
</head>
<body>
  <!-- Vier Zustaende, von denen immer genau einer sichtbar ist. Kein
       Seitenwechsel: die Sitzung, die Rollen und die Statuszeile
       ueberleben jeden Bereichswechsel. -->
  <div id="zustand-laden" class="vollbild">Einen Moment …</div>

  <form id="zustand-anmeldung" class="vollbild anmeldung" hidden>
    <h1>VeloCity Warenwirtschaft</h1>
    <label for="feld-email">E-Mail</label>
    <input id="feld-email" type="email" autocomplete="username" required>
    <label for="feld-passwort">Passwort</label>
    <input id="feld-passwort" type="password" autocomplete="current-password" required>
    <button type="submit">Anmelden</button>
    <p id="anmeldung-fehler" class="fehler" role="alert"></p>
  </form>

  <!-- Ein echter Kollege ohne zugeteilte Rolle. Ihm zu sagen, er sei
       kein Mitarbeiter, waere falsch - und er wuesste nicht, wen er
       fragen soll. Deshalb ein eigener Zustand mit einem Hinweis, der
       weiterhilft. -->
  <div id="zustand-ohne-rolle" class="vollbild" hidden>
    <h1>Noch keine Aufgabe zugeteilt</h1>
    <p>Ihr Mitarbeitendenkonto ist angelegt, aber es ist Ihnen noch kein
       Aufgabenbereich zugeordnet. Die Leitung kann das nachtragen.</p>
    <button id="knopf-abmelden-ohne-rolle" type="button">Abmelden</button>
  </div>

  <div id="zustand-kein-mitarbeiter" class="vollbild" hidden>
    <h1>Kein Zugang</h1>
    <p>Dieses Konto ist bei VeloCity nicht als Mitarbeitendenkonto hinterlegt.
       Wenn Sie Kundin oder Kunde sind, finden Sie Ihren Bereich unter
       <a href="https://bikes.butscher.cloud">bikes.butscher.cloud</a>.</p>
    <button id="knopf-abmelden-fremd" type="button">Abmelden</button>
  </div>

  <div id="zustand-arbeit" hidden>
    <header id="kopfleiste">
      <span class="wortmarke">VeloCity <b>WaWi</b></span>
      <input id="feld-suche" type="search" placeholder="Suchen" aria-label="Suchen">
      <span id="benutzer-anzeige"></span>
      <button id="knopf-abmelden" type="button">Abmelden</button>
    </header>

    <nav id="navigation" aria-label="Aufgabenbereiche"></nav>

    <main id="arbeitsbereich">
      <section id="arbeitsliste" aria-label="Arbeitsliste"></section>
      <section id="detailmaske" aria-label="Detailmaske"></section>
    </main>

    <!-- aria-live: die Statuszeile ist die Rueckmeldung fuer jede
         Buchung. Wer mit der Tastatur arbeitet oder einen Screenreader
         benutzt, bekommt sie sonst nie mit. -->
    <footer id="statuszeile" role="status" aria-live="polite"></footer>
  </div>

  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
  <script src="config.js"></script>
  <script src="daten.js"></script>
  <script src="anmeldung.js"></script>
  <script src="rahmen.js"></script>
</body>
</html>
```

- [ ] **Schritt 5: `wawi/style.css` — Grundraster**

Die Gestaltung folgt der Website in den Mitteln (Marineblau `#061841`, Rot `#f00038`, dieselbe Schriftfamilie), aber in dichterer Packung. Setz die Farben und Maße als CSS-Variablen an einer Stelle, damit sie nicht durch die Datei wandern. Das Raster: Kopfleiste oben fest, Navigation links fest, darunter Liste und Maske nebeneinander, Statuszeile unten fest.

```css
/* Eine Arbeitsoberflaeche darf voll sein. Sie wird acht Stunden am Tag
   benutzt, nicht acht Sekunden - Information je Bildschirm zaehlt mehr
   als Weissraum. Deshalb kleinere Grade und engere Zeilen als auf der
   Website, aber dieselben Farben: wer zwischen beiden wechselt, soll
   nicht das Produkt wechseln. */
:root {
  --marine:      #061841;
  --rot:         #f00038;
  --grund:       #f7f8fa;
  --flaeche:     #ffffff;
  --linie:       #d8dce4;
  --text:        #1c2333;
  --text-leise:  #5a6478;
  --gut:         #1d7a44;
  --warnung:     #b8860b;
  --schlecht:    #c0301c;
  --zeile:       28px;
  --schrift:     14px;
  --nav-breite:  200px;
  --kopf-hoehe:  48px;
  --fuss-hoehe:  32px;
}

#zustand-arbeit {
  display: grid;
  grid-template-columns: var(--nav-breite) 1fr;
  grid-template-rows: var(--kopf-hoehe) 1fr var(--fuss-hoehe);
  grid-template-areas: "kopf kopf" "nav arbeit" "fuss fuss";
  height: 100vh;
}

/* Sichtbarer Tastaturfokus. Ohne ihn ist die versprochene
   Tastaturbedienung eine Behauptung. */
:focus-visible {
  outline: 2px solid var(--rot);
  outline-offset: 1px;
}
```

Bau das Raster fertig aus. Die Arbeitsliste scrollt für sich, die Detailmaske ebenfalls — die Seite als Ganzes scrollt nie.

- [ ] **Schritt 6: Von Hand prüfen**

```bash
python3 -m http.server 8765 --directory wawi
```

Dann `http://localhost:8765` öffnen und prüfen:
1. Der Ladezustand erscheint und weicht der Anmeldemaske.
2. Anmeldung mit falschem Passwort zeigt „E-Mail oder Passwort stimmen nicht."
3. Anmeldung mit `swrobuts@googlemail.com` führt in den Arbeitszustand (noch leer, das ist richtig).
4. Die Konsole zeigt keine Fehler.

Wenn du kein Passwort hast, sag es mir — dann bekommst du ein Testkonto.

- [ ] **Schritt 7: Commit**

```bash
git add wawi/
git commit -m "feat(wawi): Geruest, Datenzugriff und Anmeldung"
```

---

## Aufgabe 2: Der Rahmen — Navigation, Statuszeile, Tastatur

**Diese Aufgabe entscheidet über alle folgenden.** Sie legt fest, wie ein Arbeitsbereich aussieht; die fünf Bereiche danach füllen nur noch aus.

**Dateien:**
- Anlegen: `wawi/rahmen.js`
- Ändern: `wawi/style.css` (Navigation, Liste, Maske, Statuszeile)

**Schnittstellen:**
- Nutzt: `meineRollen()`, `beiAnmeldungsWechsel()`, `anmelden()`, `abmelden()` aus Aufgabe 1
- Liefert — **alles, was die Aufgaben 4 bis 8 aufrufen; es gibt keine zweite Stelle für Bausteine**:
  - `bereichAnmelden(bereich)` — registriert einen Arbeitsbereich
  - `melde(text, art)` — Statuszeile; `art` ist `neutral` | `gut` | `warnung` | `schlecht`
  - `zeigeListe(zeilen, spalten, beiAuswahl)` — Arbeitsliste mit Tastaturnavigation
  - `zeigeMaske(titel, felder, knoepfe)` — Detailmaske
  - `zeigeLeermaske(titel, erklaerung, angebot)` — die Liste ist leer, und das hat einen Grund
  - `zeigeUnterreiter(reiter, aktiv, beiWechsel)` — zwei Listen in einem Bereich
  - `bestaetige(frage, bestaetigungswort)` — Dialog; mit Wort muss es eingetippt werden
  - `frageNachGrund(titel)` — einzeiliger Eingabedialog, liefert `null` bei Abbruch
  - `darfRolle(code)` — synchron, aus dem Rollenspeicher; `code` ist einer der vier Rollencodes

- [ ] **Schritt 1: Die drei Zustände auseinanderhalten**

Der Kern von `rahmen.js`, und der Grund, warum diese Aufgabe eigen ist:

```javascript
// ============================================
// VeloCity Warenwirtschaft — Rahmen
//
// Die Oberflaeche muss DREI Zustaende unterscheiden koennen, die im
// Browser gleich aussehen:
//
//   1. nicht angemeldet             -> Anmeldemaske
//   2. angemeldet, kein Mitarbeiter -> Hinweis, kein Zugang
//   3. Mitarbeiter ohne Rolle       -> Hinweis, wer helfen kann
//   4. Mitarbeiter mit Rollen       -> Arbeitsoberflaeche
//
// Der zweite Fall ist der haeufigste und der, den man vergisst: JEDER
// Kunde kann sich hier anmelden, weil es dieselbe auth.users ist. Er
// bekaeme dann eine Oberflaeche, in der jede Sicht null Zeilen liefert -
// fehlerfrei, leer, unerklaerlich. Deshalb wird vor dem Aufbau gefragt,
// nicht danach.
// ============================================

const bereiche = new Map();
let aktiverBereich = null;

function bereichAnmelden(bereich) {
    // bereich: { schluessel, titel, rollen: [...], aufbauen: async (ziel) => {} }
    bereiche.set(bereich.schluessel, bereich);
}

async function seiteAufbauen() {
    const rollen = await meineRollen();

    zeige('zustand-laden', false);
    zeige('zustand-anmeldung',        rollen === null);
    zeige('zustand-kein-mitarbeiter', rollen === false);
    zeige('zustand-ohne-rolle',       rollen instanceof Set && rollen.size === 0);
    zeige('zustand-arbeit',           rollen instanceof Set && rollen.size > 0);

    if (rollen instanceof Set && rollen.size > 0) {
        await navigationAufbauen(rollen);
    }
}

function zeige(id, sichtbar) {
    document.getElementById(id).hidden = !sichtbar;
}
```

- [ ] **Schritt 2: Rollenabhängige Navigation**

```javascript
// Was eine Rolle nicht darf, wird NICHT angezeigt - nicht ausgegraut.
// Was man nicht darf, soll man nicht suchen. Ein ausgegrauter Eintrag
// ist eine Einladung, nach dem Grund zu fragen; ein fehlender ist keine.
async function navigationAufbauen(rollen) {
    const nav = document.getElementById('navigation');
    nav.replaceChildren();

    const erlaubt = [...bereiche.values()]
        .filter((b) => b.rollen.some((r) => rollen.has(r)));

    for (const bereich of erlaubt) {
        const knopf = document.createElement('button');
        knopf.type = 'button';
        knopf.textContent = bereich.titel;
        knopf.dataset.bereich = bereich.schluessel;
        knopf.addEventListener('click', () => bereichWechseln(bereich.schluessel));
        nav.append(knopf);
    }

    const benutzer = (await angemeldeterBenutzer()).data.user;
    document.getElementById('benutzer-anzeige').textContent =
        `${benutzer.email} · ${[...rollen].join(', ')}`;

    if (erlaubt.length) await bereichWechseln(erlaubt[0].schluessel);
}

async function bereichWechseln(schluessel) {
    aktiverBereich = bereiche.get(schluessel);
    document.querySelectorAll('#navigation button').forEach((k) => {
        k.setAttribute('aria-current', k.dataset.bereich === schluessel ? 'page' : 'false');
    });
    document.getElementById('detailmaske').replaceChildren();
    melde('');
    await aktiverBereich.aufbauen();
}
```

- [ ] **Schritt 3: Die Statuszeile**

```javascript
// Jede Buchung wird hier bestaetigt. Wer zwanzig Raeder nacheinander
// umbucht, braucht die Rueckmeldung dort, wo er ohnehin hinsieht - nicht
// als Blase in einer Ecke, die nach drei Sekunden verschwindet. Deshalb
// bleibt der Text stehen, bis der naechste kommt.
function melde(text, art = 'neutral') {
    const zeile = document.getElementById('statuszeile');
    zeile.textContent = text;
    zeile.className = art;   // neutral | gut | warnung | schlecht
}

// Fuer alles, was sich nicht zurueckholen laesst. Kein window.confirm:
// das laesst sich nicht gestalten und nicht mit der Tastatur bedienen,
// wie der Rest dieser Oberflaeche.
function bestaetige(frage, bestaetigungswort = null) { /* ... */ }
```

Bau `bestaetige` aus: ein Dialog mit `<dialog>`, Fokusfalle, `Escape` verwirft. Wenn `bestaetigungswort` gesetzt ist, muss der Benutzer es eintippen — das ist für die Anonymisierung gedacht und für nichts sonst.

- [ ] **Schritt 4: Arbeitsliste und Detailmaske**

Beide Bausteine werden von allen fünf Bereichen benutzt. Halte sie schlicht:

```javascript
// Liste und Maske gleichzeitig. Der Bearbeitungsfluss ist: auswaehlen,
// aendern, speichern, naechster Satz - ohne Seitenwechsel. Das ist der
// Unterschied zwischen einer Arbeitsmaske und einer Website.
function zeigeListe(zeilen, spalten, beiAuswahl) {
    // spalten: [{ feld, titel, formatieren?, klasse? }]
    // Bei Klick UND bei Pfeiltaste: beiAuswahl(zeile) aufrufen und die
    // Zeile als ausgewaehlt markieren.
}

function zeigeMaske(titel, felder, knoepfe) {
    // felder: [{ name, titel, wert, typ, nurLesen? }]
    // knoepfe: [{ titel, art, ausfuehren: async () => {} }]
    // art: 'haupt' | 'neben' | 'gefaehrlich'
}
```

Bau beide aus. Die Liste braucht: Kopfzeile, Zeilen, Auswahlmarkierung, Tastaturnavigation mit Pfeil hoch und runter, und eine **Leermaske** — ein Satz, der sagt, warum nichts da ist, nicht ein leerer Kasten.

- [ ] **Schritt 5: Die vier kleinen Bausteine**

Sie sind klein, aber sie gehören hierher und nicht in den ersten Bereich, der sie braucht — sonst stehen sie in `flotte.js` und `kunden.js` importiert aus `flotte.js`, was in einer Woche niemand mehr versteht.

```javascript
// Ein einzeiliger Eingabedialog. Liefert null bei Abbruch - und der
// Aufrufer muss das pruefen: eine Buchung ohne Grund ist eine Buchung,
// die spaeter niemand erklaeren kann.
async function frageNachGrund(titel) { /* <dialog> mit einem <input> */ }

// Eine leere Liste ist kein leerer Kasten. Sie sagt, WARUM nichts da ist,
// und bietet an, was als Naechstes zu tun waere.
function zeigeLeermaske(titel, erklaerung, angebot = null) { /* ... */ }

// Zwei Listen in einem Bereich, wenn sie fachlich zusammengehoeren.
// reiter: [{ schluessel, titel }]
function zeigeUnterreiter(reiter, aktiv, beiWechsel) { /* ... */ }

// Synchron, weil jeder Maskenaufbau es mehrfach fragt. Der
// Rollenspeicher aus anmeldung.js ist zu diesem Zeitpunkt gefuellt -
// seiteAufbauen() hat ihn geladen, bevor irgendein Bereich baut.
function darfRolle(code) {
    return geladeneRollen !== null && geladeneRollen.has(code);
}
```

`geladeneRollen` ist der Wert, den `seiteAufbauen()` von `meineRollen()` bekommen hat. Halte ihn in `rahmen.js` als Modulvariable — nicht in `anmeldung.js`, denn dort ist er ein Zwischenspeicher mit anderer Lebensdauer.

- [ ] **Schritt 6: Tastaturbedienung**

```javascript
// Tastatur vor Maus. Eine Arbeitsmaske, die Maushandbetrieb erzwingt,
// kostet bei Wiederholung Minuten - und dieselbe Person macht dieselbe
// Buchung hundertmal.
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape')                     { maskeVerwerfen(); }
    if (e.key === 's' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); maskeSpeichern(); }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { /* in der Liste bewegen */ }
});
```

- [ ] **Schritt 7: Anmeldung verdrahten und von Hand prüfen**

Formular an `anmelden()` hängen, beide Abmeldeknöpfe an `abmelden()`, `beiAnmeldungsWechsel(seiteAufbauen)` registrieren, am Ende `seiteAufbauen()` aufrufen.

Dann prüfen — und zwar **alle drei Zustände**:
1. Nicht angemeldet → Anmeldemaske.
2. Angemeldet als ein Kunde **ohne** Mitarbeiterkonto → „Kein Zugang". Zum Erproben: leg dir über die Website ein Kundenkonto an, oder frag mich nach einem.
3. Angemeldet als `M-0001` → Navigation mit allen vier Bereichen.
4. Abmelden führt zurück zur Anmeldemaske, ohne Neuladen.

Und die Tastatur: Tab erreicht jedes Bedienelement, der Fokus ist sichtbar, `Escape` schließt den Bestätigungsdialog.

- [ ] **Schritt 8: Commit**

```bash
git add wawi/
git commit -m "feat(wawi): Rahmen - Navigation nach Rolle, Statuszeile, Tastaturbedienung"
```

---

## Aufgabe 3: Die fehlende Sicht auf die Radmodelle

**Eine Datenbankaufgabe mitten im Oberflächenplan — mit Grund.** Beim Schreiben dieses Plans ist aufgefallen, dass `api_rad_anlegen` eine `modell_id` verlangt, aber **keine einzige Sicht** diese Nummer herausgibt. Nachgemessen: `velocity` hat 23 Sichten, keine davon führt `modell_id`. Ein neues Rad ließe sich über die Oberfläche also gar nicht anlegen, und der einzige Ausweg wäre ein Zugriff auf die Basistabelle `fahrradmodell` — genau das, was die Regel dieses Projekts verbietet.

Die Lücke stammt aus Schritt 1: dort wurden die Sichten aus den **Auswertungen** abgeleitet, nicht aus den **Eingaben**. Eine Maske braucht mehr als eine Liste: sie braucht auch das, was in ihre Auswahlfelder gehört.

**Dateien:**
- Ändern: `db/aufbau/0018_wawi_sichten.sql`
- Ändern: `db/tests/t0018_wawi_sichten.sql`
- Ändern: `db/aufbau/0019_wawi_logik.sql` (Rechtevergabe)

**Schnittstellen:**
- Liefert: `velocity.v_wawi_modell (modell_id, hersteller, modellbezeichnung, typ_id, typ_code, typ, hat_elektro, zuladung_kg, raeder_im_bestand)`

- [ ] **Schritt 1: Test schreiben**

Ans Ende von `db/tests/t0018_wawi_sichten.sql`:

```sql
create or replace function velocity_test.test_v_modell_fuer_die_auswahlliste()
returns setof text language plpgsql as $$
declare v_n integer;
begin
  return next has_view('velocity'::name, 'v_wawi_modell'::name, 'v_wawi_modell existiert');

  perform velocity_test.fixture_mitarbeiter('modell');
  select count(*) into v_n from velocity.v_wawi_modell;
  -- Ohne Zeilen kann die Maske kein Rad anlegen. Der Bestand fuehrt drei
  -- Modelle; die Zahl selbst ist nicht der Punkt, die Bewohnbarkeit schon.
  return next cmp_ok(v_n, '>', 0, 'Die Auswahlliste ist nicht leer');

  -- Die Sicht ist fuer eine EINGABEmaske da. Wer ein Rad anlegt, muss
  -- Hersteller und Typ lesen koennen, sonst waehlt er eine Nummer.
  return next has_column('velocity'::name, 'v_wawi_modell'::name, 'hersteller'::name,
                         'v_wawi_modell nennt den Hersteller');
  return next has_column('velocity'::name, 'v_wawi_modell'::name, 'typ_code'::name,
                         'v_wawi_modell nennt den Radtyp');
  perform set_config('request.jwt.claims', '', true);
end;
$$;

create or replace function velocity_test.test_v_modell_nur_fuer_disposition()
returns setof text language plpgsql as $$
declare v_n integer;
begin
  -- Wer keine Raeder anlegt, braucht die Modellliste nicht. Dieselbe
  -- Schranke wie bei v_wawi_flotte, aus demselben Grund: eine Sicht, die
  -- ihre Schranke von einer anderen erbt, hat keine eigene.
  perform velocity_test.fixture_mitarbeiter_mit_rolle('modell-ks', 'kundenservice');
  select count(*) into v_n from velocity.v_wawi_modell;
  return next is(v_n, 0, 'Der Kundenservice sieht die Modellliste nicht');
  perform set_config('request.jwt.claims', '', true);
end;
$$;
```

**Prüfe die Namen der Vorrichtungen**, bevor du sie benutzt: `fixture_mitarbeiter` und `fixture_mitarbeiter_mit_rolle` stehen in derselben Datei aus Aufgabe 10 und 11 des Datenbankplans. Falls sie anders heißen, nimm die vorhandenen.

- [ ] **Schritt 2: Test laufen lassen, Fehlschlag bestätigen**

```bash
python3 db/test.py db/tests/t0018_wawi_sichten.sql
```
Erwartet: Fehler, weil `v_wawi_modell` nicht existiert.

- [ ] **Schritt 3: Die Sicht anlegen**

Ans Ende von `db/aufbau/0018_wawi_sichten.sql`:

```sql
-- ---- Radmodelle -------------------------------------------------------
-- Eine Sicht fuer eine EINGABEmaske, nicht fuer eine Auswertung. Sie ist
-- beim Bau der Oberflaeche entstanden, weil api_rad_anlegen eine
-- modell_id verlangt und keine Sicht sie herausgab - der einzige Ausweg
-- waere ein Zugriff auf die Basistabelle gewesen, und den gibt es nicht.
--
-- Der Fehler dahinter ist lehrreich: die Sichten aus Schritt 1 wurden aus
-- den Auswertungen abgeleitet, nicht aus den Eingaben. Eine Maske
-- braucht mehr als eine Liste - sie braucht auch das, was in ihre
-- Auswahlfelder gehoert.
create or replace view velocity.v_wawi_modell as
select mo.modell_id,
       h.name                as hersteller,
       mo.modellbezeichnung,
       t.typ_id,
       t.typ_code,
       t.bezeichnung         as typ,
       t.hat_elektro,
       t.zuladung_kg,
       -- Wie viele Raeder dieses Modells schon im Bestand sind. In einer
       -- Auswahlliste ist das die nuetzlichste Zusatzangabe: sie sagt,
       -- was ueblich ist, ohne dass jemand nachsehen muss.
       (select count(*) from velocity.fahrrad f
         where f.modell_id = mo.modell_id and f.status <> 'ausgemustert')
                             as raeder_im_bestand
  from velocity.fahrradmodell mo
  join velocity.hersteller    h on h.hersteller_id = mo.hersteller_id
  join velocity.fahrradtyp    t on t.typ_id        = mo.typ_id
 where velocity.hat_rolle('disposition')
    or velocity.hat_rolle('leitung');

comment on view velocity.v_wawi_modell is
  'Auswahlliste fuer die Radanlage. Entstanden beim Bau der Oberflaeche, weil api_rad_anlegen eine modell_id verlangt und keine Sicht sie herausgab.';
```

**Kommentiere jede Spalte.** `test_doku_vollstaendig` in `db/tests/t0012_dokumentation.sql` verlangt es und wird sonst rot.

- [ ] **Schritt 4: Freigeben**

In `db/aufbau/0019_wawi_logik.sql` die Sicht in den bestehenden `grant select`-Block aufnehmen. Der Block steht am Dateiende und listet die zehn `v_wawi_`-Sichten.

- [ ] **Schritt 5: Anwenden und prüfen**

```bash
python3 db/run.py db/aufbau/0018_wawi_sichten.sql db/aufbau/0019_wawi_logik.sql
python3 db/run.py db/aufbau/0018_wawi_sichten.sql db/aufbau/0019_wawi_logik.sql
python3 db/test.py
bash tools/abnahme.sh
```
Erwartet: beide Läufe fehlerfrei, alle Testfunktionen grün, alle Abnahmeprüfungen grün. Die Prüfung „Warenwirtschaft spricht keine Basistabelle an" muss weiterhin bestehen.

**Falls `create or replace view` mit `cannot change name of view column` scheitert:** die Sicht ist neu, das kann nicht passieren. Falls doch, hat jemand vor dir eine gleichnamige angelegt — sag mir Bescheid.

- [ ] **Schritt 6: Die Spezifikation nachziehen**

`doku/specs/2026-08-25-velocity-warenwirtschaft-design.md` Abschnitt 5.1 listet die Arbeitssichten. Trag `v_wawi_modell` dort ein, mit einem Satz, warum sie später kam als die anderen — das ist die Sorte Nachtrag, die eine Spezifikation ehrlich hält.

- [ ] **Schritt 7: Commit**

```bash
git add db/ doku/specs/
git commit -m "feat(wawi): v_wawi_modell - die Auswahlliste, die der Eingabemaske fehlte"
```

---

## Aufgabe 4: Arbeitsbereich Flotte

**Der erste echte Bereich. Er setzt das Muster für die vier folgenden.**

**Dateien:**
- Anlegen: `wawi/flotte.js`
- Ändern: `wawi/index.html` (Skript einbinden)

**Schnittstellen:**
- Nutzt: `ladeListe`, `rufeAuf`, `letzterLadeFehler` aus Aufgabe 1; `bereichAnmelden`, `zeigeListe`, `zeigeMaske`, `melde`, `bestaetige` aus Aufgabe 2
- Liest: `v_wawi_flotte`
- Schreibt: `api_rad_anlegen`, `api_rad_status_setzen`, `api_rad_ausmustern`

- [ ] **Schritt 1: Bereich registrieren und Liste laden**

```javascript
// ============================================
// VeloCity Warenwirtschaft — Flotte
// ============================================

bereichAnmelden({
    schluessel: 'flotte',
    titel: 'Flotte',
    // Dieselben Rollen, die auch v_wawi_flotte durchlaesst. Waeren sie
    // hier weiter gefasst, saehe ein Werkstattmitarbeiter den Menuepunkt
    // und dahinter eine leere Liste - der schlechteste aller Zustaende,
    // weil er wie ein Fehler aussieht und keiner ist.
    rollen: ['disposition', 'werkstatt', 'leitung'],
    aufbauen: flotteAufbauen
});

async function flotteAufbauen() {
    const raeder = await ladeListe('v_wawi_flotte',
        'fahrrad_id, rahmennummer, typ_code, typ, hersteller, modell, status, ' +
        'angeschafft_am, standort, akkustand_prozent, letzte_wartung, ' +
        'offene_schaeden, hoechste_schwere');

    const fehler = letzterLadeFehler('v_wawi_flotte');
    if (fehler) {
        melde(`Die Flotte liess sich nicht laden: ${fehler}`, 'schlecht');
        return;
    }

    zeigeListe(raeder, [
        { feld: 'rahmennummer',   titel: 'Rahmennummer' },
        { feld: 'typ_code',       titel: 'Typ' },
        { feld: 'status',         titel: 'Status', klasse: statusKlasse },
        { feld: 'standort',       titel: 'Standort' },
        { feld: 'offene_schaeden', titel: 'Schäden', formatieren: (n) => n || '' }
    ], radMaske);

    melde(`${raeder.length} Räder`);
}

// Farbe traegt Bedeutung, nicht Dekoration: rot ist ein defektes Rad,
// nicht ein Knopf.
function statusKlasse(status, zeile) {
    if (zeile.hoechste_schwere === 'fahruntauglich') return 'schlecht';
    if (status === 'defekt')  return 'schlecht';
    if (status === 'wartung') return 'warnung';
    if (status === 'ausgemustert') return 'leise';
    return '';
}
```

- [ ] **Schritt 2: Die Detailmaske**

```javascript
function radMaske(rad) {
    const knoepfe = [];

    // Statuswechsel nur fuer die Rolle, die ihn auch in der Datenbank
    // darf. Der Knopf, den die Funktion ohnehin abweist, ist keine
    // Sicherheitsluecke - aber eine Einladung zu einer Fehlermeldung,
    // die niemand braucht.
    if (darfRolle('disposition') || darfRolle('werkstatt')) {
        for (const ziel of ['verfuegbar', 'wartung', 'defekt']) {
            if (rad.status === ziel) continue;
            knoepfe.push({
                titel: `Auf ${ziel} setzen`,
                art: 'neben',
                ausfuehren: async () => {
                    const grund = await frageNachGrund(`Warum ${ziel}?`);
                    await rufeAuf('api_rad_status_setzen', {
                        p_fahrrad_id: rad.fahrrad_id, p_status: ziel, p_bemerkung: grund
                    });
                    melde(`${rad.rahmennummer} steht jetzt auf ${ziel}.`, 'gut');
                    await flotteAufbauen();
                }
            });
        }
    }

    if (darfRolle('disposition') && rad.status !== 'ausgemustert') {
        knoepfe.push({
            titel: 'Ausmustern',
            art: 'gefaehrlich',
            ausfuehren: async () => {
                // Ausmustern ist nicht zurueckzuholen: das Rad verliert
                // seinen Standort und verschwindet aus jeder Liste. Die
                // Fahrten bleiben, aber das Rad kommt nicht wieder.
                const ok = await bestaetige(
                    `${rad.rahmennummer} endgültig ausmustern? Das Rad verliert seinen ` +
                    `Standort und erscheint in keiner Liste mehr. Seine Fahrten bleiben erhalten.`);
                if (!ok) return;
                const grund = await frageNachGrund('Grund der Ausmusterung');
                await rufeAuf('api_rad_ausmustern',
                    { p_fahrrad_id: rad.fahrrad_id, p_grund: grund });
                melde(`${rad.rahmennummer} ausgemustert.`, 'gut');
                await flotteAufbauen();
            }
        });
    }

    zeigeMaske(`Rad ${rad.rahmennummer}`, [
        { name: 'typ',            titel: 'Typ',              wert: `${rad.typ} (${rad.typ_code})`, nurLesen: true },
        { name: 'modell',         titel: 'Modell',           wert: `${rad.hersteller} ${rad.modell}`, nurLesen: true },
        { name: 'status',         titel: 'Status',           wert: rad.status, nurLesen: true },
        { name: 'standort',       titel: 'Standort',         wert: rad.standort || 'unterwegs', nurLesen: true },
        { name: 'angeschafft_am', titel: 'Angeschafft',      wert: rad.angeschafft_am, nurLesen: true },
        { name: 'letzte_wartung', titel: 'Letzte Wartung',   wert: rad.letzte_wartung || 'noch keine', nurLesen: true },
        { name: 'offene_schaeden', titel: 'Offene Schäden',  wert: rad.offene_schaeden, nurLesen: true },
        { name: 'hoechste_schwere', titel: 'Höchste Schwere', wert: rad.hoechste_schwere || '—', nurLesen: true }
    ], knoepfe);
}
```

- [ ] **Schritt 3: Ein Rad anlegen**

`api_rad_anlegen` verlangt **drei** Angaben: Rahmennummer, Modell und **Station**. Die Station ist Pflicht, nicht optional — GR13 verlangt für jedes Rad, das nicht unterwegs ist, einen Ort, und ein neues Rad steht auf `verfuegbar`. Ohne Station weist die Datenbank den Aufruf ab.

Die Auswahllisten für Modell und Station brauchen Daten, die **keine `v_wawi_`-Sicht liefert**. Das ist eine echte Lücke aus Schritt 1: es gibt keine Sicht auf `fahrradmodell`. Für die Stationen nimm `v_wawi_station` (sie zeigt auch `frei`, was hier hilft — eine volle Station weist GR15 ab). Für die Modelle nutzt du `v_wawi_modell` — die Sicht aus Aufgabe 3, die genau für diese Auswahlliste entstanden ist. Sie führt `modell_id`, `hersteller`, `modellbezeichnung`, `typ_code` und `raeder_im_bestand`.

- [ ] **Schritt 4: Von Hand prüfen**

```bash
python3 -m http.server 8765 --directory wawi
```

1. Als `M-0001` anmelden, Bereich Flotte: 275 Räder, davon 2 auf `defekt`, 15 auf `wartung`.
2. Eine Zeile anklicken: die Maske füllt sich.
3. Mit Pfeil runter zur nächsten Zeile: die Maske folgt.
4. Ein Rad auf `wartung` setzen: die Statuszeile bestätigt, die Liste zeigt den neuen Status, die Farbe wechselt.
5. Dasselbe Rad zurück auf `verfuegbar`.
6. **Der wichtige Fall:** Ein Rad mit einer offenen fahruntauglichen Meldung lässt sich **nicht** auf `verfuegbar` setzen — die Datenbank weist es ab. Da es derzeit keine Schadensmeldungen gibt, lässt sich das erst nach Aufgabe 6 erproben. Notier es dir.

- [ ] **Schritt 5: Commit**

```bash
git add wawi/
git commit -m "feat(wawi): Arbeitsbereich Flotte"
```

---

## Aufgabe 5: Arbeitsbereich Stationen

**Dateien:**
- Anlegen: `wawi/stationen.js`
- Ändern: `wawi/index.html` (Skript einbinden)

**Schnittstellen:**
- Liest: `v_wawi_station`
- Schreibt: `api_station_anlegen`, `api_station_stilllegen`

- [ ] **Schritt 1: Liste und Maske**

```javascript
// ============================================
// VeloCity Warenwirtschaft — Stationen
// ============================================

bereichAnmelden({
    schluessel: 'stationen',
    titel: 'Stationen',
    rollen: ['disposition', 'leitung'],
    aufbauen: stationenAufbauen
});

async function stationenAufbauen() {
    const stationen = await ladeListe('v_wawi_station',
        'station_id, stationsnummer, name, strasse, hausnummer, plz, ort, ' +
        'latitude, longitude, kapazitaet, belegt, frei, betriebszeitraum, in_betrieb');

    const fehler = letzterLadeFehler('v_wawi_station');
    if (fehler) { melde(`Die Stationen liessen sich nicht laden: ${fehler}`, 'schlecht'); return; }

    zeigeListe(stationen, [
        { feld: 'stationsnummer', titel: 'Nummer' },
        { feld: 'name',           titel: 'Station' },
        { feld: 'ort',            titel: 'Ort' },
        { feld: 'belegt',         titel: 'Belegt', formatieren: (b, z) => `${b} / ${z.kapazitaet}` },
        { feld: 'frei',           titel: 'Frei',   klasse: (f) => (f === 0 ? 'warnung' : '') }
    ], stationMaske);

    // Zwei Stationen sind randvoll (S-0001 mit 40/40, S-0002 mit 25/25).
    // Das ist kein Fehler, aber eine Rueckgabe dort scheitert an GR15 -
    // und wer das nicht weiss, haelt es fuer einen Softwarefehler.
    const voll = stationen.filter((s) => s.frei === 0);
    melde(voll.length
        ? `${stationen.length} Stationen, ${voll.length} davon voll: ${voll.map((s) => s.name).join(', ')}`
        : `${stationen.length} Stationen`);
}
```

- [ ] **Schritt 2: Stilllegen, nicht löschen**

```javascript
function stationMaske(station) {
    const knoepfe = [];

    if (station.in_betrieb) {
        knoepfe.push({
            titel: 'Stilllegen',
            art: 'gefaehrlich',
            ausfuehren: async () => {
                // GR22: eine Station wird stillgelegt, nicht geloescht.
                // Sonst verloeren alle Fahrten dorthin ihren Ort. Die
                // Funktion weist Stationen mit Raedern ab - und derzeit
                // gibt es keinen Weg, ein Rad umzusetzen. Das ist eine
                // bekannte Luecke; die Meldung darf sie nicht als
                // Softwarefehler erscheinen lassen.
                if (station.belegt > 0) {
                    melde(`An ${station.name} stehen noch ${station.belegt} Räder. ` +
                          `Sie müssen erst woanders zurückgegeben werden.`, 'warnung');
                    return;
                }
                const ok = await bestaetige(
                    `${station.name} zum heutigen Tag stilllegen? Die Station bleibt in ` +
                    `allen Auswertungen sichtbar, nimmt aber keine Räder mehr auf.`);
                if (!ok) return;
                await rufeAuf('api_station_stilllegen', { p_station_id: station.station_id });
                melde(`${station.name} stillgelegt.`, 'gut');
                await stationenAufbauen();
            }
        });
    }

    zeigeMaske(`${station.stationsnummer} · ${station.name}`, [
        { name: 'anschrift',  titel: 'Anschrift',
          wert: `${station.strasse} ${station.hausnummer}, ${station.plz} ${station.ort}`, nurLesen: true },
        { name: 'kapazitaet', titel: 'Stellplätze', wert: station.kapazitaet, nurLesen: true },
        { name: 'belegt',     titel: 'Belegt',      wert: station.belegt, nurLesen: true },
        { name: 'frei',       titel: 'Frei',        wert: station.frei, nurLesen: true },
        { name: 'lage',       titel: 'Lage',
          wert: `${station.latitude}, ${station.longitude}`, nurLesen: true },
        { name: 'betrieb',    titel: 'Betrieb',
          wert: station.in_betrieb ? 'in Betrieb' : 'stillgelegt', nurLesen: true }
    ], knoepfe);
}
```

- [ ] **Schritt 3: Eine Station anlegen**

`api_station_anlegen` verlangt acht Angaben: Name, Straße, Hausnummer, PLZ, Ort, Breite, Länge, Kapazität. Die Stationsnummer vergibt die Datenbank selbst im Format `S-0000`.

Prüfe die Koordinaten **in der Maske**, bevor du sie schickst: Breite zwischen -90 und 90, Länge zwischen -180 und 180. Die Datenbank prüft es auch, aber eine Fehlermeldung, die man vor dem Absenden bekommt, ist besser als eine danach.

- [ ] **Schritt 4: Von Hand prüfen**

1. Zehn Stationen, `S-0001` bis `S-0010`. Zwei zeigen `frei = 0`.
2. Eine neue Station anlegen: sie bekommt `S-0011`.
3. Die neue Station stilllegen (sie hat keine Räder): sie bleibt in der Liste, `in_betrieb` wechselt.
4. Eine Station **mit** Rädern stilllegen: die Meldung erscheint in der Statuszeile, ohne dass etwas passiert.

- [ ] **Schritt 5: Commit**

```bash
git add wawi/
git commit -m "feat(wawi): Arbeitsbereich Stationen"
```

---

## Aufgabe 6: Arbeitsbereich Kunden — mit den Betroffenenrechten

**Der inhaltlich wichtigste Bereich.** Hier sitzt der Lehrpunkt der ganzen Fallstudie: „Recht auf Löschung" ist keine `DELETE`-Anweisung.

**Dateien:**
- Anlegen: `wawi/kunden.js`
- Ändern: `wawi/index.html` (Skript einbinden)

**Schnittstellen:**
- Liest: `v_wawi_kunde`
- Schreibt: `api_kunde_anlegen`, `api_kunde_aktualisieren`, `api_kunde_sperren`, `api_kunde_auskunft`, `api_kunde_anonymisieren`

- [ ] **Schritt 1: Liste mit Suche**

Bei 1014 Kunden ist eine ungefilterte Liste unbrauchbar. Nutze das Suchfeld aus der Kopfleiste: Filter über Name, E-Mail und Kundennummer, serverseitig mit `.ilike()`, und lade höchstens 200 Zeilen.

```javascript
bereichAnmelden({
    schluessel: 'kunden',
    titel: 'Kunden',
    rollen: ['kundenservice', 'leitung'],
    aufbauen: kundenAufbauen
});

async function kundenAufbauen(suchtext = '') {
    const kunden = await ladeListe('v_wawi_kunde',
        'kunde_id, kundennummer, anrede, vorname, nachname, email, telefon, status, ' +
        'registriert_am, strasse, hausnummer, plz, ort, tarif_code, tarif, ' +
        'mitgliedschaft_seit, fahrten_gesamt, fahrten_offen, umsatz_brutto, offener_betrag',
        (q) => {
            let abfrage = q;
            if (suchtext) {
                abfrage = abfrage.or(
                    `nachname.ilike.%${suchtext}%,vorname.ilike.%${suchtext}%,` +
                    `email.ilike.%${suchtext}%,kundennummer.ilike.%${suchtext}%`);
            }
            return abfrage.order('nachname').limit(200);
        });

    zeigeListe(kunden, [
        { feld: 'kundennummer', titel: 'Nummer' },
        { feld: 'nachname',     titel: 'Nachname' },
        { feld: 'vorname',      titel: 'Vorname' },
        { feld: 'status',       titel: 'Status',
          klasse: (s) => (s === 'gesperrt' ? 'warnung' : s === 'geschlossen' ? 'leise' : '') },
        { feld: 'tarif_code',   titel: 'Tarif', formatieren: (t) => t || '—' }
    ], kundeMaske);

    // 519 der 1014 Kunden stehen auf 'gesperrt'. Wer das nicht weiss,
    // haelt die vielen gelben Zeilen fuer einen Fehler. Und es gibt
    // derzeit keine Funktion, die entsperrt - eine bekannte Luecke.
    melde(kunden.length === 200
        ? `200 von mehr Kunden — bitte suchen`
        : `${kunden.length} Kunden`);
}
```

- [ ] **Schritt 2: Die Maske — was sie zeigt und was nicht**

```javascript
function kundeMaske(kunde) {
    // Diese Maske zeigt bewusst KEINE einzelnen Fahrten. Eine Liste mit
    // Start, Ziel und Uhrzeit ist ein Bewegungsprofil; der Kundenservice
    // braucht Summen, keine Wege. v_wawi_kunde liefert deshalb nur
    // fahrten_gesamt und umsatz_brutto - und keine ausleihe_id, die man
    // weiterverfolgen koennte.
    //
    // Sie zeigt auch keine Zahlungsmittel (GR17) und nichts aus dem
    // Schema auth. Das Passwort ist fuer diese Oberflaeche schlicht
    // unerreichbar, nicht nur ausgeblendet.
    const knoepfe = [
        { titel: 'Speichern', art: 'haupt', ausfuehren: async () => { /* api_kunde_aktualisieren */ } }
    ];

    if (kunde.status === 'aktiv') {
        knoepfe.push({ titel: 'Sperren', art: 'neben', ausfuehren: async () => { /* api_kunde_sperren */ } });
    }

    knoepfe.push({ titel: 'Auskunft nach Art. 15', art: 'neben', ausfuehren: () => auskunftZeigen(kunde) });

    if (kunde.status !== 'geschlossen') {
        knoepfe.push({ titel: 'Löschung nach Art. 17', art: 'gefaehrlich',
                       ausfuehren: () => anonymisieren(kunde) });
    }

    zeigeMaske(`${kunde.kundennummer} · ${kunde.vorname} ${kunde.nachname}`, [
        { name: 'anrede',    titel: 'Anrede',    wert: kunde.anrede || '',    typ: 'text' },
        { name: 'vorname',   titel: 'Vorname',   wert: kunde.vorname,          typ: 'text' },
        { name: 'nachname',  titel: 'Nachname',  wert: kunde.nachname,         typ: 'text' },
        // E-Mail nur lesend: sie ist der Anmeldename. Sie zu aendern ist
        // eine Kontoaenderung und gehoert dem Kunden, nicht uns.
        { name: 'email',     titel: 'E-Mail',    wert: kunde.email,            nurLesen: true },
        { name: 'telefon',   titel: 'Telefon',   wert: kunde.telefon || '',    typ: 'tel' },
        { name: 'strasse',   titel: 'Straße',    wert: kunde.strasse || '',    typ: 'text' },
        { name: 'hausnummer', titel: 'Nr.',      wert: kunde.hausnummer || '', typ: 'text' },
        { name: 'plz',       titel: 'PLZ',       wert: kunde.plz || '',        typ: 'text' },
        { name: 'ort',       titel: 'Ort',       wert: kunde.ort || '',        typ: 'text' },
        { name: 'tarif',     titel: 'Tarif',     wert: kunde.tarif || 'ohne Mitgliedschaft', nurLesen: true },
        { name: 'fahrten',   titel: 'Fahrten',   wert: kunde.fahrten_gesamt,   nurLesen: true },
        { name: 'umsatz',    titel: 'Umsatz',    wert: `${kunde.umsatz_brutto} €`, nurLesen: true },
        { name: 'offen',     titel: 'Offen',     wert: `${kunde.offener_betrag} €`, nurLesen: true }
    ], knoepfe);
}
```

- [ ] **Schritt 3: Die Auskunft nach Art. 15**

`api_kunde_auskunft` liefert ein JSON-Dokument mit acht Abschnitten: `stammdaten`, `mitgliedschaften`, `fahrten` (mit Koordinaten), `rechnungen`, `zahlungen`, `schadensmeldungen`, `freiminuten`, `protokoll`.

Zeig es in einem Dialog, gegliedert nach Abschnitten, und biete es zum Herunterladen als JSON an. **Der Aufruf selbst wird protokolliert** — wer Daten einsieht, hinterlässt eine Spur. Sag das in der Maske, bevor der Knopf gedrückt wird, nicht danach.

- [ ] **Schritt 4: Die Löschung nach Art. 17 — der Lehrpunkt**

Dieser Dialog ist der wichtigste Text der ganzen Oberfläche. Er muss erklären, was tatsächlich passiert:

```javascript
async function anonymisieren(kunde) {
    // Der Knopf heisst "Loeschung nach Art. 17", und die Funktion
    // dahinter heisst anonymisieren. Das ist kein Etikettenschwindel,
    // sondern der Kern: Paragraf 147 AO verlangt zehn Jahre Aufbewahrung
    // fuer Rechnungsbelege, Art. 17 Abs. 3 lit. b DSGVO nimmt genau
    // solche Pflichten von der Loeschpflicht aus. Wer den Kunden
    // loescht, verstoesst gegen das Steuerrecht; wer nichts tut, gegen
    // die DSGVO. Anonymisieren erfuellt beides.
    //
    // Der Dialog muss das sagen. Wer hier klickt, soll wissen, was
    // bleibt - nicht nur, dass etwas verschwindet.
    const ok = await bestaetige(
        `Löschung nach Art. 17 DSGVO für ${kunde.vorname} ${kunde.nachname}?\n\n` +
        `WAS VERSCHWINDET: Name, E-Mail, Telefonnummer, Geburtsdatum, Anschrift, ` +
        `Zahlungsmittel und die Verknüpfung zum Anmeldekonto. Auch im Änderungsprotokoll ` +
        `werden die alten Werte unkenntlich gemacht.\n\n` +
        `WAS BLEIBT: die ${kunde.fahrten_gesamt} Fahrten und alle Rechnungen, in voller Höhe. ` +
        `Das Steuerrecht verlangt zehn Jahre Aufbewahrung, und die DSGVO nimmt genau ` +
        `diese Pflicht von der Löschung aus.\n\n` +
        `WAS DAS NICHT LEISTET: Die Fahrten tragen Zeiten und Orte. Wer regelmäßig zur ` +
        `selben Zeit vom selben Punkt fährt, bleibt darüber auffindbar.\n\n` +
        `Der Vorgang ist nicht rückgängig zu machen.`,
        'LOESCHEN'   // muss eingetippt werden
    );
    if (!ok) return;

    const grund = await frageNachGrund('Grund (etwa: Antrag der betroffenen Person vom …)');
    if (!grund) { melde('Abgebrochen: ohne Grund keine Löschung.', 'warnung'); return; }

    await rufeAuf('api_kunde_anonymisieren', { p_kunde_id: kunde.kunde_id, p_grund: grund });
    melde(`Kunde ${kunde.kundennummer} anonymisiert. Rechnungen und Fahrten bleiben erhalten.`, 'gut');
    await kundenAufbauen();
}
```

- [ ] **Schritt 5: Von Hand prüfen**

1. Suche nach „Butscher": Kunde 2334 erscheint.
2. Telefonnummer ändern, `Strg+S`: die Statuszeile bestätigt, ein Neuladen zeigt den neuen Wert.
3. Auskunft für einen Kunden mit Fahrten: alle acht Abschnitte sind da, `zahlungsmittel` fehlt.
4. **Anonymisierung an einem Testkunden, den du selbst anlegst** — nicht an einem Bestandskunden. Danach: Name ist `Geloescht`, E-Mail ist `anonym-<id>@velocity.invalid`, Fahrten und Rechnungen unverändert.
5. Nach der Anonymisierung eine Auskunft für denselben Kunden: im Abschnitt `protokoll` steht `[anonymisiert]`, nicht der alte Name.

- [ ] **Schritt 6: Commit**

```bash
git add wawi/
git commit -m "feat(wawi): Arbeitsbereich Kunden mit Auskunft und Loeschung nach DSGVO"
```

---

## Aufgabe 7: Arbeitsbereich Instandhaltung — gegen leere Sichten

**Dieser Bereich wird gegen zwei leere Tabellen gebaut. Das ist der Punkt.**

`schadensmeldung` und `wartungsauftrag` haben null Zeilen. Wer erst mit Daten anfängt, baut die Leermaske nie — und die Leermaske ist der Zustand, den ein neuer Mitarbeiter am Montagmorgen als Erstes sieht. Sie muss sagen, warum nichts da ist und was man tun kann, nicht ein leerer Kasten sein.

**Dateien:**
- Anlegen: `wawi/instandhaltung.js`
- Ändern: `wawi/index.html` (Skript einbinden)

**Schnittstellen:**
- Liest: `v_wawi_schaden`, `v_wawi_auftrag`, `v_wawi_flotte` (für die Radauswahl beim Melden)
- Schreibt: `api_schaden_melden`, `api_auftrag_eroeffnen`, `api_auftrag_erledigen`

- [ ] **Schritt 1: Zwei Listen in einem Bereich**

```javascript
// ============================================
// VeloCity Warenwirtschaft — Instandhaltung
//
// Zwei Listen in einem Bereich: offene Schaeden und laufende Auftraege.
// Sie gehoeren zusammen, weil der Weg von der Meldung zum Auftrag der
// eigentliche Arbeitsfluss ist - wer sie auf zwei Menuepunkte verteilt,
// zwingt zum Hin- und Herspringen.
// ============================================

bereichAnmelden({
    schluessel: 'instandhaltung',
    titel: 'Instandhaltung',
    rollen: ['werkstatt', 'leitung'],
    aufbauen: instandhaltungAufbauen
});

let unterbereich = 'schaeden';   // 'schaeden' | 'auftraege'

async function instandhaltungAufbauen() {
    // Zwei Reiter ueber der Liste, kein zweiter Menuepunkt.
    zeigeUnterreiter([
        { schluessel: 'schaeden',  titel: 'Offene Schäden' },
        { schluessel: 'auftraege', titel: 'Wartungsaufträge' }
    ], unterbereich, async (gewaehlt) => { unterbereich = gewaehlt; await instandhaltungAufbauen(); });

    if (unterbereich === 'schaeden') await schaedenZeigen();
    else                            await auftraegeZeigen();
}
```

- [ ] **Schritt 2: Die Leermaske — sorgfältig, nicht nebenbei**

```javascript
async function schaedenZeigen() {
    const schaeden = await ladeListe('v_wawi_schaden',
        'schadensmeldung_id, fahrrad_id, rahmennummer, typ_code, gemeldet_am, ' +
        'melderart, kategorie, beschreibung, schwere, status, offen_seit, auftraege',
        (q) => q.in('status', ['offen', 'in_arbeit']).order('gemeldet_am'));

    const fehler = letzterLadeFehler('v_wawi_schaden');
    if (fehler) { melde(`Die Schäden liessen sich nicht laden: ${fehler}`, 'schlecht'); return; }

    if (schaeden.length === 0) {
        // Eine leere Liste ist kein leerer Kasten. Sie sagt, WARUM nichts
        // da ist, und BIETET AN, was als Naechstes zu tun waere. Ein
        // Mitarbeiter, der am Montag hier landet, soll nicht raten, ob
        // die Software kaputt ist.
        zeigeLeermaske(
            'Keine offenen Schäden',
            'Es liegt derzeit keine Schadensmeldung vor. Das ist der Normalfall — ' +
            'gemeldet wird, wenn an einem Rad etwas auffällt.',
            { titel: 'Schaden melden', ausfuehren: schadenMeldenMaske }
        );
        melde('Keine offenen Schäden');
        return;
    }

    zeigeListe(schaeden, [
        { feld: 'rahmennummer', titel: 'Rad' },
        { feld: 'kategorie',    titel: 'Kategorie' },
        { feld: 'schwere',      titel: 'Schwere',
          klasse: (s) => (s === 'fahruntauglich' ? 'schlecht' : s === 'mittel' ? 'warnung' : '') },
        { feld: 'gemeldet_am',  titel: 'Gemeldet' },
        { feld: 'offen_seit',   titel: 'Offen seit', formatieren: alterKurz },   // alterKurz baust du hier, es wird nur hier gebraucht
        { feld: 'status',       titel: 'Stand' }
    ], schadenMaske);

    const dringend = schaeden.filter((s) => s.schwere === 'fahruntauglich').length;
    melde(dringend
        ? `${schaeden.length} offene Schäden, davon ${dringend} fahruntauglich`
        : `${schaeden.length} offene Schäden`);
}
```

Bau `zeigeLeermaske(titel, erklaerung, angebot)` in `rahmen.js` aus. Sie wird auch von den anderen Bereichen gebraucht — heute noch nicht sichtbar, aber sobald jemand nach einem Suchbegriff filtert, der nichts findet.

- [ ] **Schritt 3: Melden, eröffnen, erledigen**

Der Arbeitsfluss ist eine Kette, und die Maske soll sie führen:

```javascript
// Ein fahruntauglicher Schaden setzt das Rad sofort auf 'defekt' - das
// tut api_schaden_melden von sich aus, es haengt nicht daran, ob jemand
// daran denkt. Ausnahme: ein Rad in Fahrt behaelt 'ausgeliehen', weil
// GR13 einem Rad unterwegs keinen anderen Status erlaubt. Bei der
// Rueckgabe prueft fn_ausleihe_beenden dann selbst und setzt 'defekt'
// statt 'verfuegbar'. Sag das in der Maske: sonst sieht es aus, als
// haette die Meldung nicht gewirkt.
async function schadenMelden(fahrradId, kategorie, beschreibung, schwere) {
    const id = await rufeAuf('api_schaden_melden', {
        p_fahrrad_id: fahrradId, p_kategorie: kategorie,
        p_beschreibung: beschreibung, p_schwere: schwere
    });
    melde(schwere === 'fahruntauglich'
        ? `Meldung ${id} angelegt. Das Rad ist gesperrt — sofern es nicht gerade gefahren wird; ` +
          `dann wird es bei der Rückgabe gesperrt.`
        : `Meldung ${id} angelegt.`, 'gut');
    return id;
}

// api_auftrag_eroeffnen prueft, dass die Meldung zu DIESEM Rad gehoert.
// Die Maske muss das nicht noch einmal pruefen - aber sie darf das Rad
// auch nicht frei waehlen lassen, sonst provoziert sie die Ablehnung.
async function auftragEroeffnen(schaden) {
    const id = await rufeAuf('api_auftrag_eroeffnen', {
        p_fahrrad_id: schaden.fahrrad_id,
        p_schadensmeldung_id: schaden.schadensmeldung_id
    });
    melde(`Auftrag ${id} eröffnet, Rad steht auf Wartung.`, 'gut');
}

// Beim Erledigen wird das Rad NUR frei, wenn kein anderer Schaden offen
// ist. Das entscheidet die Datenbank; die Maske soll das Ergebnis
// nachlesen und melden, nicht vorhersagen.
async function auftragErledigen(auftrag, minuten, bemerkung) {
    await rufeAuf('api_auftrag_erledigen', {
        p_wartungsauftrag_id: auftrag.wartungsauftrag_id,
        p_arbeitszeit_minuten: minuten, p_bemerkung: bemerkung
    });
    melde(`Auftrag ${auftrag.auftragsnummer} erledigt.`, 'gut');
}
```

- [ ] **Schritt 4: Von Hand prüfen — und dabei den Bereich mit Leben füllen**

Dies ist die erste Gelegenheit, den ganzen Weg zu gehen. Nutze sie:

1. Bereich öffnen: beide Listen sind leer, beide Leermasken erklären es.
2. Einen Schaden melden, Schwere `gering`: die Liste zeigt ihn, das Rad bleibt `verfuegbar`.
3. Einen Schaden melden, Schwere `fahruntauglich`: das Rad steht danach auf `defekt`.
4. **Zurück in den Bereich Flotte:** Das Rad lässt sich jetzt **nicht** auf `verfuegbar` setzen. Genau der Fall aus Aufgabe 4, Schritt 4, Punkt 6 — jetzt ist er prüfbar.
5. Auftrag eröffnen: die Meldung wechselt auf `in_arbeit`, das Rad auf `wartung`.
6. Auftrag erledigen: die Meldung wechselt auf `behoben`, das Rad wieder auf `verfuegbar`.
7. Zwei Schäden an **einem** Rad anlegen, einen erledigen: das Rad bleibt gesperrt, weil der zweite offen ist.

**Lass die Testdaten stehen und sag mir, wie viele du angelegt hast.** Der Bereich ist ohne Daten nicht vorführbar, und ein paar echte Meldungen sind besser als eine leere Maske — bis wir entscheiden, ob Referenzdaten für Bereich I nachkommen.

- [ ] **Schritt 5: Commit**

```bash
git add wawi/
git commit -m "feat(wawi): Arbeitsbereich Instandhaltung, mit Leermasken die etwas sagen"
```

---

## Aufgabe 8: Arbeitsbereich Auswertungen

**Dateien:**
- Anlegen: `wawi/auswertungen.js`
- Ändern: `wawi/index.html` (Skript einbinden)

**Schnittstellen:**
- Liest: `v_wawi_umsatz_radtyp`, `v_wawi_umsatz_kundengruppe`, `v_wawi_km_co2`, `v_wawi_stationsauslastung`

- [ ] **Schritt 1: Vier Auswertungen, ein Bereich**

```javascript
bereichAnmelden({
    schluessel: 'auswertungen',
    titel: 'Auswertungen',
    // Nur die Leitung. Die Stationsauslastung sieht zusaetzlich die
    // Disposition - aber die liegt im Bereich Stationen, nicht hier.
    rollen: ['leitung'],
    aufbauen: auswertungenAufbauen
});
```

Vier Reiter: Umsatz nach Radtyp, Umsatz nach Kundengruppe, Kilometer und CO₂, Stationsauslastung. Jede als Tabelle mit Monatszeilen, ohne Diagrammbibliothek — eine Tabelle mit rechtsbündigen Zahlen ist für eine Arbeitsmaske oft besser lesbar als ein Balken.

- [ ] **Schritt 2: Die Zahlen richtig darstellen**

Zwei Stellen brauchen Sorgfalt:

```javascript
// v_wawi_km_co2 liefert anteil_geschaetzt JE ZEILE. Wer die Spalte ueber
// Monate mittelt, bekommt 0,532; der tatsaechliche fahrtgewichtete
// Anteil liegt bei 0,400 - dreizehn Prozentpunkte Unterschied, weil die
// Zeilen sehr unterschiedlich gross sind. Deshalb liefert die Sicht auch
// fahrten_geschaetzt, und eine Summenzeile MUSS damit gewichten.
function anteilGewichtet(zeilen) {
    const fahrten     = zeilen.reduce((s, z) => s + z.fahrten, 0);
    const geschaetzt  = zeilen.reduce((s, z) => s + z.fahrten_geschaetzt, 0);
    return fahrten ? geschaetzt / fahrten : 0;
}

// Die CO2-Ersparnis ist eine Schaetzung, und sie sagt es selbst. Zeig
// den Schaetzanteil NEBEN der Zahl, nicht in einer Fussnote: eine
// Kennzahl, die ihre eigene Unsicherheit nicht mitliefert, ist fuer
// Marketing brauchbar und fuer alles andere gefaehrlich.
function co2Zelle(zeile) {
    return `${zeile.co2_ersparnis_kg} kg ` +
           `<span class="leise">(${Math.round(zeile.anteil_geschaetzt * 100)} % geschätzt)</span>`;
}
```

- [ ] **Schritt 3: Von Hand prüfen und gegenrechnen**

Die Zahlen stehen fest; prüfe die Oberfläche gegen sie:

| Auswertung | Erwartung |
|---|---|
| Umsatz gesamt (Radtyp) | 35 454,47 € |
| Umsatz gesamt (Kundengruppe) | derselbe Betrag |
| Basistarif | 4308 Fahrten, 18 172,32 €, 4,22 € je Fahrt |
| Studententarif | 2265 Fahrten, 1 295,26 €, 0,57 € je Fahrt |
| CO₂-Ersparnis | 6 611,95 kg |
| Anteil geschätzt, **fahrtgewichtet** | 40,0 % |
| Jahresgang | Januar am niedrigsten, Juli am höchsten |
| City-Bike, Umsatz je Fahrt | Sprung von 0,94 € (Februar) auf 1,24 € (März) |

Der letzte Punkt ist der interessanteste: der Sprung ist der Preiswechsel zum 1. März. Wenn deine Maske ihn zeigt, ist die Historisierung nicht mehr nur behauptet.

**Wenn eine Zahl abweicht, melde es** — nicht die Oberfläche anpassen, bis sie passt.

- [ ] **Schritt 4: Commit**

```bash
git add wawi/
git commit -m "feat(wawi): Arbeitsbereich Auswertungen"
```

---

## Aufgabe 9: Bereitstellung unter wawi.butscher.cloud

**Dateien:**
- Anlegen: `deploy/wawi-compose.yml`, `deploy/wawi-nginx.conf`, `tools/wawi_veroeffentlichen.sh`

**Der DNS-Eintrag für `wawi.butscher.cloud` ist bereits angelegt.**

- [ ] **Schritt 1: Die beiden Deploy-Dateien**

Nimm `deploy/docker-compose.yml` und `deploy/nginx.conf` als Vorbild — Zeile für Zeile dasselbe Muster, nur mit anderem Namen, anderem Pfad und anderer Adresse:

```yaml
# =====================================================================
# wawi.butscher.cloud
#
# Dieselbe Machart wie bikes.butscher.cloud: nginx:alpine mit einem
# schreibgeschuetzt eingehaengten Verzeichnis hinter dem Traefik, der auf
# diesem Server ohnehin laeuft. Kein Node, kein Build, kein Prozess der
# etwas rechnet.
#
# Getrennter Container statt eines zweiten Pfads unter bikes: die
# Warenwirtschaft ist eine andere Anwendung fuer andere Leute. Sie soll
# sich abschalten lassen, ohne die Website mitzunehmen.
#
# NICHT von Hand hochladen. Es gibt tools/wawi_veroeffentlichen.sh.
# =====================================================================
services:
  wawi:
    image: nginx:alpine
    container_name: wawi
    restart: unless-stopped
    volumes:
      - /opt/wawi-deploy/site:/usr/share/nginx/html:ro
      - /opt/wawi-deploy/nginx.conf:/etc/nginx/conf.d/default.conf:ro
    networks:
      - root_default
    labels:
      - traefik.enable=true
      - traefik.http.routers.wawi.rule=Host(`wawi.butscher.cloud`)
      - traefik.http.routers.wawi.entrypoints=websecure
      - traefik.http.routers.wawi.tls=true
      - traefik.http.routers.wawi.tls.certresolver=mytlschallenge
      - traefik.http.services.wawi.loadbalancer.server.port=80
      - traefik.http.routers.wawi-http.rule=Host(`wawi.butscher.cloud`)
      - traefik.http.routers.wawi-http.entrypoints=web
      - traefik.http.routers.wawi-http.middlewares=wawi-redirect
      - traefik.http.middlewares.wawi-redirect.redirectscheme.scheme=https

networks:
  root_default:
    external: true
```

- [ ] **Schritt 2: Das Auslieferungswerkzeug**

`tools/wawi_veroeffentlichen.sh`, nach dem Vorbild von `tools/veroeffentlichen.sh`. Übernimm dessen Aufbau: Fingerabdrücke prüfen, Dateiliste aus den Seiten ableiten, `rsync -rltz --delete`, danach `ssh chmod -R a+rX` und die Gegenprobe über HTTP.

**Die zwei Fallen, die dort schon einmal zugeschlagen haben** und im Quelltext dokumentiert sind:
- `rsync -a` trägt Modus 700 mit; nginx antwortet dann mit 403. Deshalb der `chmod`-Lauf danach.
- macOS' `openrsync` kennt kein `--chmod`, und bash 3.2 kein `mapfile`. Der Umweg steht im Vorbild.

Host `bot.butscher.cloud`, Fernpfad `/opt/wawi-deploy`, Adresse `https://wawi.butscher.cloud`.

- [ ] **Schritt 3: Die Gegenprobe muss mehr prüfen als HTTP 200**

Eine Anmeldeseite antwortet auch dann mit 200, wenn dahinter nichts funktioniert. Prüfe zusätzlich:
- Die Adresse liefert HTML, das den String `VeloCity Warenwirtschaft` enthält.
- `http://` wird auf `https://` umgeleitet (301, 302 oder 308).
- Alle eingebundenen Skripte antworten mit 200 — leite die Liste aus `index.html` ab, statt sie zu pflegen.

- [ ] **Schritt 4: Ausliefern und im Browser nachsehen**

```bash
bash tools/wawi_veroeffentlichen.sh --trocken
bash tools/wawi_veroeffentlichen.sh
```

Dann `https://wawi.butscher.cloud` öffnen und anmelden. Prüfe insbesondere, dass die Anmeldung über HTTPS funktioniert — Supabase setzt Cookies, die über HTTP anders behandelt werden.

- [ ] **Schritt 5: Commit**

```bash
git add deploy/ tools/
git commit -m "feat(wawi): Bereitstellung unter wawi.butscher.cloud"
```

---

## Aufgabe 10: Prüfwerkzeug, Abnahme und Dokumentation

**Dateien:**
- Anlegen: `tools/wawi_check.py`
- Ändern: `tools/abnahme.sh` (Prüfungen 28 bis 31)
- Ändern: `README.md`, `TESTEN.md`
- Anlegen: `doku/datenmodell/08-warenwirtschaft.md`

- [ ] **Schritt 1: `tools/wawi_check.py`**

Nach dem Vorbild von `tools/ux_check.py`: eine statische Gegenprobe, die den Vertrag zwischen HTML und JavaScript prüft und die Bedienbarkeitszusagen festhält, damit sie nicht unbemerkt zurückkommen.

Was geprüft werden soll:
- Jede `id`, die ein Skript über `getElementById` sucht, existiert im HTML.
- Jede der vier Zustandsschalen (`zustand-laden`, `zustand-anmeldung`, `zustand-kein-mitarbeiter`, `zustand-arbeit`) ist im HTML vorhanden und wird im JavaScript geschaltet.
- Die Statuszeile trägt `role="status"` und `aria-live`.
- Jedes `<input>` hat ein `<label>` mit passendem `for`.
- Das CSS definiert `:focus-visible` — ohne sichtbaren Fokus ist die versprochene Tastaturbedienung eine Behauptung.
- `Strg+S` und `Escape` werden im JavaScript behandelt.

Bau jede Prüfung so, dass sie rot werden **kann**, und mach die Gegenprobe: nimm testweise ein `<label>` heraus, sieh die Prüfung anschlagen, setz es zurück.

- [ ] **Schritt 2: Vier Abnahmeprüfungen**

Im Stil der bestehenden (`schritt` / `ergebnis`, keine Hilfsfunktion `pruefe`):

```bash
# --------------------------------------------- 28 WaWi-Vertrag
schritt "Warenwirtschaft: Vertrag zwischen HTML und JavaScript"
if python3 tools/wawi_check.py >/tmp/abnahme-wawi.log 2>&1; then
  ergebnis 0 "$(grep -c '^  ok' /tmp/abnahme-wawi.log) Punkte nachgeprueft"
else
  ergebnis 1 "$(grep -c '^  FEHL' /tmp/abnahme-wawi.log) Punkt(e) offen"
  grep '^  FEHL' /tmp/abnahme-wawi.log | head -10 | sed 's/^/     /'
fi

# --------------------------------------------- 29 WaWi spricht nur Sichten
schritt "Warenwirtschaft spricht nur Sichten und api-Funktionen"
# Dieselbe Regel wie fuer die Website, und derselbe Test - nur gegen
# wawi/daten.js. Ein Zugriff auf eine Basistabelle waere hier
# gefaehrlicher als dort: die Warenwirtschaft sieht Personendaten.
verstoss=$(grep -oE "\.from\('[a-z_]+'\)" wawi/daten.js wawi/*.js | grep -v "'v_wawi" || true)
verstoss="$verstoss$(grep -oE "rpc\('[a-z_]+'" wawi/*.js | grep -vE "'(api_|ist_mitarbeiter|hat_rolle)" || true)"
if [ -z "$(echo "$verstoss" | tr -d '[:space:]')" ]; then
  ergebnis 0 "keine Basistabelle, keine fn_-Funktion in der Warenwirtschaft"
else
  ergebnis 1 "Verstoss: $verstoss"
fi

# --------------------------------------------- 30 WaWi erreichbar
schritt "wawi.butscher.cloud antwortet"
code=$(curl -s -o /tmp/wawi.html -w '%{http_code}' https://wawi.butscher.cloud)
if [ "$code" = "200" ] && grep -q "VeloCity Warenwirtschaft" /tmp/wawi.html; then
  ergebnis 0 "erreichbar und liefert die Anmeldeseite"
else
  ergebnis 1 "HTTP $code, Inhalt unerwartet"
fi

# --------------------------------------------- 31 kein Kundenzugang
schritt "Warenwirtschaft weist Nicht-Mitarbeitende ab"
# Der haeufigste Fall und der, den man vergisst: JEDER Kunde kann sich
# anmelden, weil es dieselbe auth.users ist. Die Oberflaeche muss das
# vor dem Aufbau erkennen, nicht danach.
if grep -q "zustand-kein-mitarbeiter" wawi/index.html && \
   grep -q "zustand-kein-mitarbeiter" wawi/rahmen.js; then
  ergebnis 0 "Der Zustand 'kein Mitarbeiter' ist gebaut und wird geschaltet"
else
  ergebnis 1 "Der Zustand 'kein Mitarbeiter' fehlt"
fi
```

- [ ] **Schritt 3: Jede neue Prüfung gegen sich selbst testen**

Eine Prüfung, die nie rot war, prüft nichts. Für jede der vier den Fehlerfall herstellen, rot werden sehen, zurücknehmen. **Berichte für jede, ob sie rot wurde.**

- [ ] **Schritt 4: `doku/datenmodell/08-warenwirtschaft.md`**

Ein Kapitel, das die Warenwirtschaft erklärt — für Studierende, nicht für Entwickler. Was hineingehört:
- Warum es eine getrennte Oberfläche gibt und keinen Administrationsbereich in der Website.
- Wie Kunden und Mitarbeitende auseinandergehalten werden, obwohl beide dieselbe Datenbankrolle haben. Das ist der Kern und der beste Lehrpunkt: die Trennung steckt nicht im Recht, sondern in der Regel.
- Was ein Mitarbeiter **nicht** sieht und warum: keine Bezahldaten, kein Passwort, keine einzelnen Fahrten.
- Der Weg der Löschung nach Art. 17 — inklusive dessen, was sie nicht leistet.

- [ ] **Schritt 5: `README.md` und `TESTEN.md`**

`README.md`: die Warenwirtschaft in die Übersicht aufnehmen, `wawi/` in die Verzeichnisliste, `tools/wawi_veroeffentlichen.sh` und `tools/wawi_check.py` in die Werkzeugliste, die Prüfungszahl anheben.

`TESTEN.md`: **Diese Datei ist nachweislich veraltet** — sie nennt „neun Prüfungen" (es sind 27 plus deine vier), „12 SQL-Dateien" (es sind 18), „51 pgTAP-Testfunktionen" (es sind 123) und behauptet, `auth.users` sei leer (es sind zwei Konten). Zieh alle Zahlen nach und ergänze einen Abschnitt, wie man die Warenwirtschaft prüft. Eine Anleitung, die falsche Zahlen nennt, hat einmal dazu geführt, dass eine externe Prüfung den *Preis* für den Fehler hielt.

- [ ] **Schritt 6: Alles zusammen**

```bash
python3 db/test.py
bash tools/abnahme.sh
python3 tools/zahlen_gegen_db.py
```
Erwartet: alles grün, 31 Abnahmeprüfungen.

- [ ] **Schritt 7: Commit**

```bash
git add tools/ doku/ README.md TESTEN.md
git commit -m "docs(wawi): Pruefwerkzeug, vier Abnahmepruefungen, Kapitel zur Warenwirtschaft"
```

---

## Nach dem letzten Commit

Die Warenwirtschaft steht dann vollständig: Datenbank und Oberfläche, beide geprüft, beide ausgeliefert.

**Was bewusst offen bleibt** — damit niemand danach sucht:

- **Bereich I hat keine Referenzdaten.** Was in Aufgabe 7 an Testmeldungen entsteht, ist von Hand angelegt. Ob ein Generator dazukommt wie für die Fahrten, ist eine offene Entscheidung.
- **Kunden lassen sich sperren, aber nicht entsperren.** 519 von 1014 stehen auf `gesperrt`, und keine Funktion setzt zurück. Braucht ein `api_kunde_entsperren`.
- **Räder lassen sich nicht umsetzen.** Damit ist GR22 („Station stilllegen, nicht löschen") praktisch nicht anwendbar: jede Station trägt Räder. Braucht ein `api_rad_umsetzen`.
- **Der Abrechnungskreis ist offen.** `velocity.zahlung` hat null Zeilen, keine Funktion bucht einen Zahlungseingang, keine storniert eine Rechnung. Damit wird keine Rechnung je `bezahlt`.
- **Mitarbeiterverwaltung fehlt.** Die Spezifikation gibt sie der Rolle `leitung`; es gibt sie nicht. Solange bleibt `M-0001` der einzige Zugang.
- **`velocity.rechnung` trägt keine Empfängerdaten.** Eine Modellierungsfrage, die beim Auftraggeber liegt.

Diese sechs Punkte sind kein Versäumnis dieses Plans, sondern der ehrliche Rand dessen, was zwei Schritte leisten. Sie gehören in die Übergabe.
