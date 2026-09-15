# Betriebliche Skripte

Nicht Teil des Lehrpfads. Der Entwurf unter `db/aufbau/` steht für sich;
was hier liegt, betrifft nur die konkrete Instanz.

| Datei | Zweck |
|---|---|
| `uebernahme_altdaten.sql` | Einmalige Übernahme aus `cityBikesRental`, mit Protokoll |
| `abgleichsbericht.sql` | Soll-Ist-Vergleich nach der Übernahme |
| `altschema_absichern.sql` | Schließt den anonymen Zugriff im Altschema |
| `altsystem_abloesen.sql` | Setzt `"cityBikesRental".handle_new_user()` auf Leerlauf, verhindert Fremdanmeldungen im Kundenbestand (verschoben aus `db/aufbau/0013_`, lief gegen eine leere Datenbank nicht durch) |
| `referenzdaten_grundlage.sql` | Referenzjahr, Teil 1: Preisperioden, Tarifkonditionen, Mitgliedschaften, erster Mitarbeiter |
| `flottenmodelle_stammdaten.sql` | Löst den Hersteller-Platzhalter `unbekannt` ab: fünf Hersteller, neun Modelle mit Baujahr/Gewicht/Gangzahl/Akku/Reichweite, alle 275 Räder umgehängt |
| `studi_net_absichern.sql` | Schließt den über PUBLIC offenen pg_net-Zugriff für `studi`, erhält die bisherigen Rechte der anderen vorhandenen Anwendungs- und Betriebsrollen |

## Lehrzugang und pg_net

`studi_net_absichern.sql` ergänzt den Fachschutz aus `studizugang_lesend.sql`
und `lehrzugang.sql`. Die Standardeinstellung `default_transaction_read_only`
ist keine Rechtebeschränkung: Die eigene Sitzung kann sie abschalten.

Die Korrektur ersetzt ausschließlich im Schema `net` vorhandene
`PUBLIC`-Freigaben durch gleichwertige direkte Grants an die übrigen
vorhandenen Rollen (ohne die PostgreSQL-Systemrollen `pg_*`). Damit bleiben
insbesondere die Supabase-Betriebsrollen und andere Anwendungen auf der
gemeinsam genutzten Instanz beim bisherigen Stand. Andere Lehrkonten werden
mit dieser auf `studi` begrenzten Korrektur nicht neu bewertet.

Für `studi` werden Schema-, Tabellen-, Sequenz- und Funktionsrechte entzogen.
Auch bereits aufgelöste Objektnamen dürfen keinen Schreibweg offenlassen.
Anmeldedaten, Rollenmitgliedschaften und die Fachrechte in `velocity` bleiben
unverändert. Neue Rollen erhalten anschließend keinen automatischen
`net`-Zugang; dieser muss bei Bedarf gezielt eingerichtet werden.

Vor dem produktiven Lauf die aktuellen `net`-ACLs sichern und die bisherigen
effektiven Rechte der Betriebsrollen erfassen. Als Eigentümer der
`net`-Objekte in einer Transaktion ausführen:

```bash
python3 db/run.py db/betrieb/studi_net_absichern.sql
python3 tools/studi_net_check.py
python3 tools/rest_security_check.py
```

`studi_net_check.py` verwendet Host, Port und Datenbank aus `.env`, meldet
sich jedoch ausdrücklich als `studi` an. Das Kennwort wird verdeckt abgefragt
oder aus `STUDI_PASSWORD` gelesen. Der Test prüft Fachlesezugriff, alle
installierten `net`-Funktionssignaturen und verweigerte Schreibpläne.
Es werden keine Fahrten gebucht oder HTTP-Aufträge abgeschickt.
Danach Website- und WaWi-Demoanmeldung sowie einen erlaubten pg_net-Aufruf
mit einer Betriebsrolle prüfen.

**Nach pg_net-Installation oder -Update erneut prüfen:** Die Erweiterung
kann selbst wieder `PUBLIC`-Grants setzen. Bei erneut geöffnetem Zugang die
Korrektur wiederholen. Ein Lauf ohne neue `PUBLIC`-Grants ist idempotent und
erteilt auch später angelegten Rollen keine zusätzlichen Rechte.

Hintergrund: [PostgreSQL-Rechtevergabe](https://www.postgresql.org/docs/17/sql-grant.html)
und [pg_net-Installationsskript](https://github.com/supabase/pg_net/blob/master/sql/pg_net.sql).

## Referenzdaten für das Lehrjahr

Drei Dateien bauen gemeinsam ein Referenzjahr an Bewegungsdaten auf, auf
dem die Warenwirtschaft überhaupt etwas auszuwerten hat. Sie müssen in
dieser Reihenfolge laufen, weil jede die vorherige voraussetzt:

`referenzdaten_grundlage.sql` → `referenzdaten_fahrten.sql` → `referenzdaten_rechnungen.sql`

(die beiden letzteren entstehen erst mit den Folgeaufgaben). **Alle drei
erzeugen ERFUNDENE Daten** — plausibel gebaut, aber nicht erhoben. Jede
Datei sagt das in ihrem Kopf, und jeder Lauf wird in
`velocity.uebernahme_protokoll` festgehalten.

## Ein Schema für PostgREST freischalten

Damit die Website ein Schema über die REST-Schnittstelle lesen kann, muss
es exponiert sein. Auf dieser Instanz gibt es dabei **zwei** Stellschrauben,
und die eine sticht die andere:

| Stelle | Wirkung |
|---|---|
| `PGRST_DB_SCHEMAS` in `/root/supabase/docker/.env` | Vorgabe beim Start |
| `ALTER ROLE authenticator SET pgrst.db_schemas` | **überschreibt** die Vorgabe |

PostgREST liest bei aktiver In-Datenbank-Konfiguration die Rolleneinstellung.
Eine Änderung allein in der `.env` bleibt deshalb wirkungslos, solange die
Rolleneinstellung existiert. Beide sollten übereinstimmen, damit die Datei
nicht in die Irre führt.

**Wichtig:** `PGRST_DB_CHANNEL_ENABLED=false` auf dieser Instanz. PostgREST
horcht also **nicht** auf `NOTIFY pgrst, 'reload config'`. Jede Änderung
braucht einen Neustart des Dienstes — das unterbricht die REST-Schnittstelle
aller Anwendungen auf der Instanz für einige Sekunden.

### Ablauf

```bash
# 1 Sicherung
ssh vps 'cp -n /root/supabase/docker/.env /root/supabase/docker/.env.bak-$(date +%Y%m%d)'

# 2 Vorgabe in der .env ergaenzen (Beispiel: velocity)
ssh vps "sed -i 's|^PGRST_DB_SCHEMAS=public,|PGRST_DB_SCHEMAS=public,velocity,|' /root/supabase/docker/.env"

# 3 Rolleneinstellung setzen - sie ist die wirksame
ssh vps "docker exec -i supabase-db psql -U supabase_admin -d postgres -c \
  \"alter role authenticator set pgrst.db_schemas = 'public, velocity, cityBikesRental, WorldHappiness, Rainforest, superstore, apl, qs'\""

# 4 Dienst neu starten (NOTIFY genuegt hier nicht)
ssh vps 'cd /root/supabase/docker && docker compose up -d rest'

# 5 Nachweisen
python3 tools/rest_security_check.py
```

Der Benutzer `postgres` reicht für Schritt 3 **nicht**: ihm fehlt das
ADMIN-Recht auf die Rolle `authenticator`. Nötig ist `supabase_admin`,
erreichbar nur über `docker exec` auf dem Host.

### Offene Unstimmigkeit

Die beiden Listen weichen voneinander ab, und zwar schon vor dieser Arbeit:

- `.env`: `public, velocity, storage, graphql_public, cityBikesRental, WorldHappiness, Rainforest, apl, qs, superstore`
- Rolleneinstellung: `public, velocity, cityBikesRental, WorldHappiness, Rainforest, superstore, apl, qs`

`storage` und `graphql_public` stehen in der Datei, sind über die
Rolleneinstellung aber **nicht** exponiert. Das war schon vorher so und
wurde bewusst nicht angetastet, um das Verhalten anderer Anwendungen nicht
zu verändern. Wer Supabase Storage oder die GraphQL-Schnittstelle über REST
braucht, muss die Rolleneinstellung entsprechend erweitern.
