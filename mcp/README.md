# Die Warenwirtschaft als Werkzeugfläche für einen Agenten

Ein MCP-Server über `wawi.butscher.cloud`. Er legt kein neues System an,
sondern ein anderes Vorderteil vor dasselbe: 19 Sichten zum Lesen,
15 `api_`-Funktionen zum Ändern — dieselben Aufrufe, die auch der
Browser macht.

## Warum das so wenig Arbeit war

Die Warenwirtschaft spricht die Datenbank ausschließlich über
`v_wawi_`-Sichten und `api_`-Funktionen an. Keine Basistabelle, kein
direktes `UPDATE`. Dieser Schnitt entstand 2026 für zwei
Browseroberflächen, nicht für Agenten — dass er ohne Umbau auch für
einen Agenten trägt, ist das stärkste Argument für die Architektur, das
der Kurs haben kann.

**Die Rechte liegen nicht im Server.** Er meldet sich mit einem
gewöhnlichen Mitarbeiterkonto an und erbt dessen Rollen; darüber
entscheiden Row Level Security und `velocity.hat_rolle()`. In diesem
Programm gibt es keine Rechteprüfung, die sich umgehen ließe, weil es
hier keine gibt. Wer dem Agenten weniger erlauben will, nimmt seinem
**Konto** eine Rolle weg, nicht seiner Aufgabenbeschreibung.

## Einrichten

**1 · Konto.** In Supabase Studio unter *Authentication → Users → Add
user*: `agent@wawi.invalid`, Passwort frei wählbar, **Auto Confirm User
anhaken** (an `.invalid` kann keine Bestätigungsmail ankommen — die
Domain ist nach RFC 2606 reserviert). Dann den Mitarbeitersatz anhängen:

```bash
python3 db/run.py db/betrieb/mitarbeiter_agentenkonto.sql
```

**2 · Umgebung.** Der Server bekommt eine eigene, damit er die
Arbeitsumgebung nicht anfasst, in der noch anderes läuft:

```bash
bash mcp/einrichten.sh
```

Das legt `mcp/.venv` an (gitignored) und nennt am Ende den Python-Pfad,
der in die Konfiguration gehört.

**3 · Zugangsdaten.** In die nicht versionierte `.env`:

```
WAWI_AGENT_EMAIL=agent@wawi.invalid
WAWI_AGENT_PASSWORT=…
```

**4 · Prüfen**, bevor irgendein Client ins Spiel kommt:

```bash
mcp/.venv/bin/python mcp/server.py --pruefen
```

Meldet sich an, liest eine Zeile aus `v_wawi_flotte`, zählt die
Werkzeuge. Wer diesen Schritt überspringt und in Claude Desktop nur
„keine Werkzeuge" sieht, sucht den Fehler im falschen Programm.

**5 · Eintragen.** Claude Desktop, in
`~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "velocity-wawi": {
      "command": "<Pfad>/velocity-fallstudie/mcp/.venv/bin/python",
      "args": ["<Pfad>/velocity-fallstudie/mcp/server.py"]
    }
  }
}
```

Claude Code nimmt denselben Server:

```bash
claude mcp add velocity-wawi -- <Pfad>/mcp/.venv/bin/python <Pfad>/mcp/server.py
```

## Die Werkzeuge

| Lesen | |
|---|---|
| `sichten_auflisten` | nennt die 19 Sichten mit ihrem Inhalt |
| `sicht_lesen` | liest eine davon, mit Filter, Sortierung und Grenze |
| `protokoll_lesen` | wer wann was geändert hat — **ohne die Werte**, Rolle `leitung` |

| Ändern | Rolle |
|---|---|
| `rad_anlegen`, `rad_status_setzen` | disposition · werkstatt |
| `rad_ausmustern` | leitung — **nicht rücknehmbar** |
| `schaden_melden`, `auftrag_eroeffnen`, `auftrag_erledigen` | werkstatt |
| `wartungsprognose_erzeugen` | werkstatt · leitung |
| `kunde_anlegen`, `kunde_aktualisieren`, `kunde_auskunft` | kundenservice |
| `kunde_sperren` | kundenservice · leitung |
| `kunde_anonymisieren` | leitung — **nicht rücknehmbar** |
| `station_anlegen`, `station_stilllegen` | disposition · leitung |
| `vorfuehrbestand_auffrischen` | leitung |

Die Rollenangaben stehen hier zur Übersicht. Durchgesetzt werden sie
nicht hier, sondern in der Datenbank — ein Werkzeug, das der Agent ohne
die nötige Rolle ruft, bekommt den Satz der Datenbank zurück: *„Nur
Werkstatt oder Leitung dürfen …"*.

## Was bewusst fehlt

Fünf `api_`-Funktionen der Website: `ausleihe_starten`,
`ausleihe_beenden`, `profil_aktualisieren`, `kunde_sicherstellen`,
`preisschaetzer_umschalten`. Sie handeln auf dem **eigenen** Kundensatz
des Aufrufers; ein Mitarbeiterkonto hat keinen und liefe in einen
Fehler. Sie fehlen also nicht aus Vorsicht, sondern weil sie hier nichts
tun könnten. Die Liste steht als `NICHT_ANGEBOTEN` im Server, und
`tools/mcp_check.py` sorgt dafür, dass Auslassen eine Entscheidung
bleibt und kein Vergessen wird.

## Der Weg zurück

`kunde_anonymisieren` und `rad_ausmustern` sind **absichtlich**
erreichbar. Die Fallstudie ist eine Versuchsplattform: Studierende
sollen sehen, was ein Agent anrichten kann, nicht nur davon hören.
Deshalb steht daneben:

```bash
bash tools/velocity_sichern.sh --ausgangsstand   # den Stand festhalten
bash tools/velocity_zuruecksetzen.sh             # dorthin zurück
```

Zurückgespielt wird in einer einzigen Transaktion; das Schema `auth`
bleibt unberührt, niemand wird ausgesperrt.

## Damit es nicht rostet

```bash
python3 tools/mcp_check.py
```

Hält jedes Werkzeug gegen den Systemkatalog: Gibt es die Sicht? Gibt es
die Funktion? Heißen ihre Parameter noch so? Und umgekehrt — steht jede
`v_wawi_`-Sicht und jede `api_`-Funktion entweder als Werkzeug da oder
ausdrücklich als Auslassung? Läuft in `tools/abnahme.sh` mit.

## Was im Protokoll landet

Jede Änderung steht in `velocity.aenderungsprotokoll`, mit dem
Mitarbeitersatz, der sie ausgelöst hat. Unter einem eigenen Agentenkonto
lässt sich hinterher trennen, was ein Mensch getan hat und was eine
Maschine — und genau das ist der Gegenstand der Übung. Benutzen mehrere
Studierende dasselbe Konto, sieht man nur *dass* ein Agent gehandelt
hat, nicht welcher.
