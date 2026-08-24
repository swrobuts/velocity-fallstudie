# Fremde Projekte im Kundenbestand — Befund und Behebung

**Datum:** 25.08.2026
**Ausgelöst durch:** Rückmeldung des Betreibers zu `arnd.gottschalk@thws.de`

## Befund

Auf dem Server läuft **ein gemeinsames `auth.users`** für mehrere
Projekte: den Fahrradverleih (`cityBikesRental`, abgelöst durch
`velocity`), die Lehrveranstaltungsevaluation (`qs` — `lve_bogen`,
`lve_item_response`, `lve_login_event`), ein Antragsverfahren (`apl`)
und weitere.

Darauf lag der Trigger `on_auth_user_created`, der
`cityBikesRental.handle_new_user()` aufrief. Die Funktion legte bei
**jeder** Anmeldung einen Fahrradkunden an — unabhängig davon, wofür
sich jemand anmeldete.

Die Belege stehen im Zeitabstand:

| Adresse | in `qs.allow_email` freigeschaltet | als Fahrradkunde angelegt | Abstand | Fahrten |
|---|---|---|---:|---:|
| `robert.butscher@thws.de` | 27.04.2026 05:07 | 27.04.2026 06:12 | **+65 Min** | 0 |
| `arnd.gottschalk@thws.de` | 06.05.2026 15:01 | 06.05.2026 16:55 | **+114 Min** | 0 |

Zur Gegenprobe: `swrobuts@googlemail.com` steht ebenfalls in der
LVE-Freigabe, ist aber seit dem **15.01.2026** Fahrradkunde mit **sieben
Fahrten** — drei Monate vor dem LVE-Eintrag. Ein echter Kunde, kein
Überläufer. Die Unterscheidung trägt.

Über die Datenübernahme vom 22.08.2026 wanderten beide Fremdeinträge
nach `velocity.kunde` (2332, 2333). Die Übernahme hat korrekt kopiert,
was dastand; der Fehler lag eine Ebene tiefer.

## Behebung

1. **`cityBikesRental.handle_new_user()` ist ein Leerlauf.** Der Trigger
   selbst ließ sich nicht entfernen: `auth.users` gehört
   `supabase_auth_admin`, der Projektzugang ist dort nicht Eigentümer
   (*must be owner of relation users*). Die Funktion gehört `postgres`
   und wurde deshalb entkernt — in der Wirkung dasselbe.
   Siehe `db/aufbau/0013_altsystem_abloesen.sql`.
2. **Beide Fremdeinträge entfernt** — aus `velocity.kunde` und aus
   `cityBikesRental.kunde` samt Zuordnung.
3. **Abgesichert** in `db/tests/t0011_sicherheit.sql`: ein Trigger auf
   `auth.users`, der ins Altschema zeigt, darf weder Kunden anlegen noch
   Zuordnungen schreiben.

## Die Regel dahinter

**Eine Anwendung holt sich, was sie braucht. Sie lässt es sich nicht von
einer gemeinsamen Tabelle zuschieben.**

`velocity.api_kunde_sicherstellen()` legt den Kundensatz beim ersten
Anmelden an — an der Stelle, an der er hingehört, und nur für den, der
sich tatsächlich bei VeloCity anmeldet. Ein Trigger auf einer geteilten
Tabelle kann diese Unterscheidung nicht treffen; er sieht nur, dass sich
*jemand* angemeldet hat.

## Was noch zu prüfen ist

`auth.users` bleibt geteilt. Wer dort einen weiteren Trigger anlegt,
wiederholt den Fehler. Für die Zukunft wäre eine getrennte
Supabase-Instanz je Projekt die sauberere Grenze — solange sie geteilt
bleibt, gilt: **kein Projekt schreibt bei einer Anmeldung in ein
anderes Schema.**
