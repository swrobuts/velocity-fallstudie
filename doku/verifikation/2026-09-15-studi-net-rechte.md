# studi: pg_net-Rechte korrigiert

**Ergebnis: fixed.** Am 15.09.2026 auf der laufenden Instanz angewendet und
anschließend mit echten Datenbank- und Webanmeldungen geprüft.

## Befund und Änderung

Der Lehrzugang `studi` konnte über `PUBLIC` auf die beiden technischen
pg_net-Tabellen schreiben und HTTP-Funktionen aufrufen. Die VeloCity-Fachdaten
waren bereits durch ihre ACLs geschützt. `default_transaction_read_only=on`
war für den technischen Schreibweg keine ausreichende Schranke.

`db/betrieb/studi_net_absichern.sql` ersetzt die vorhandenen öffentlichen
Schema-, Tabellen-, Sequenz- und Funktionsrechte in `net` durch gleichwertige
direkte Rechte für die übrigen vorhandenen Anwendungs- und Betriebsrollen.
`studi` erhält keine dieser Rechte. Alle installierten Funktionssignaturen
werden erfasst; der Schutz hängt nicht allein am Schema-USAGE.

Die Änderung ist auf `net` begrenzt. Die bisherigen Fachrechte, Anmeldedaten,
Rollenattribute, Mitgliedschaften, Datenbankrechte und Sitzungsvorgaben bleiben
erhalten. Andere Lehrkonten werden nicht neu bewertet; neue Rollen bekommen
keinen automatischen `net`-Zugang.

## Durchführung und Sicherung

1. Live-Katalog und vorhandene Aufrufer geprüft, ursprüngliche ACLs lokal
   gesichert und Rücksetz-SQL vorbereitet.
2. Änderung innerhalb einer Transaktion geprobt und vollständig zurückgerollt.
3. Effektive Rechte der übrigen Rollen vor/nach der Änderung verglichen:
   **594 einzelne Berechtigungen unverändert**. ACLs außerhalb von `net` und
   die genannten Rollen-/Datenbankeinstellungen sind ebenfalls unverändert.
4. Wiederholte Ausführung ohne zusätzlichen Effekt geprüft.
5. Unabhängige Prüfung des Kandidaten: keine konkreten Bypässe oder Regressionen.
6. Änderung in einer Transaktion übernommen. Kein Dienstneustart erforderlich.

SHA-256 der angewendeten SQL-Datei:
`fdd4bb566e57fdfa00fb6a9d8310384609bf12f086c5969e0e12383dcd285068`.

Lokale Sicherung: `.review/net-acl-before.json` und
`.review/net-acl-rollback.sql` im Arbeitsverzeichnis der Prüfung.
Diese instanzbezogenen Sicherungen werden nicht veröffentlicht.

## Verifikation

| Prüfung | Ergebnis |
| --- | --- |
| SQL-Ausführung im Probelauf, `git diff --check`, Python-Kompilierung | Bestanden |
| Neuer Test `python3 tools/studi_net_check.py` vor der Korrektur | 12 erwartete Abweichungen beim offenen `net`-Zugriff |
| Derselbe Test nach der Korrektur | 0 Abweichungen |
| Frische echte Anmeldung als `studi` | Erfolgreich |
| SELECT auf sämtliche Fachtabellen und WaWi-Sichten | 39 Tabellen und 20 Sichten erfolgreich |
| Effektive Tabellen-, Spalten- und Sequenzrechte in `net` | Keine für `studi` |
| Alle installierten `net`-Funktionssignaturen | 12 von 12 für `studi` gesperrt |
| INSERT-/UPDATE-/DELETE-Pläne für beide `net`-Tabellen in schreibbarer Transaktion | SQLSTATE 42501, keine Berechtigung |
| HTTP-GET/POST/DELETE-Funktionsaufrufe als `studi` | SQLSTATE 42501; zusätzlich READ ONLY abgesichert |
| Bereits vor der Änderung vorbereiteter DELETE- und HTTP-Befehl in einer bestehenden `studi`-Sitzung | Nach der Änderung ebenfalls SQLSTATE 42501 |
| Bestehende pgTAP-Sicherheitstests: `runtests('velocity_test'::name, '^test_s_')` | 11 Testfunktionen bestanden, keine fehlgeschlagen |
| `python3 tools/rest_security_check.py` | 17 geschützte Ressourcen HTTP 401, 10 öffentliche Ressourcen erreichbar |
| Frische Website-Demoanmeldung über Supabase Auth | Erfolgreich; Profil, Fahrten, Rechnungen und Bilanz lesbar |
| Website im Browser mit bestehender Sitzung | Dashboard Clara Fake, 35 Fahrten, geladen |
| Frische WaWi-Demo- und Agentenanmeldung | Erfolgreich; erwartete Demo-/Fachrollen und Datenzugriffe bestätigt |
| WaWi im Browser | Flotte, Stationen, Kundschaft, Instandhaltung und Auswertungen geladen |
| Erlaubter echter pg_net-GET auf die öffentliche Website | HTTP 200 als `anon`, `authenticated`, `service_role` und `supabase_functions_admin` |
| `python3 tools/readme_pruefen.py` | Bestanden |

Damit reproduziert der ursprüngliche Schreibweg nicht mehr. Gleichzeitig
bleiben die Fachlesezugänge und die erlaubte technische HTTP-Verarbeitung
funktionsfähig. Die Tabellenproben benutzen ausschließlich EXPLAIN ohne
ANALYZE. Die Sicherheitstests rollen ihre Testdaten zurück. Die vier erlaubten
HTTP-Kontrollaufrufe erzeugen nur die üblichen technischen Queue-/Antwortdaten;
es wurden keine Ausleihen, Rechnungen oder Wartungsaufträge angelegt.

## Geänderte Dateien und Grenzen

- `db/betrieb/studi_net_absichern.sql`: atomare, wiederholbare Korrektur mit Gegenprüfungen.
- `tools/studi_net_check.py`: wiederholbarer Test mit echter `studi`-Anmeldung.
- `db/betrieb/README.md`, `TESTEN.md`: Anwendung, Kennwortübergabe und Wiederholungsprüfung.
- Dieser Bericht: Ergebnisse und Grenzen der Live-Verifikation.

Die vollständige fachliche Abnahme mit echten Buchungen wurde für diese
isolierte ACL-Änderung nicht ausgeführt. Die Sicherheitsprüfungen, die
erhaltenen ACLs, die öffentlichen und angemeldeten Datenzugriffe sowie
die konkret betroffene pg_net-Verarbeitung wurden geprüft.

Nach einer pg_net-Installation oder einem Update ist der Regressionstest
erneut auszuführen: Das Installationsskript der Erweiterung kann wieder
öffentliche Grants setzen. Die Korrektur verändert diesen fremden
Installationsmechanismus nicht.

Grundlagen: [PostgreSQL GRANT](https://www.postgresql.org/docs/17/sql-grant.html)
und [offizielles pg_net-Installationsskript](https://github.com/supabase/pg_net/blob/master/sql/pg_net.sql).
