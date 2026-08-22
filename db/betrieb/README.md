# Betriebliche Skripte

Nicht Teil des Lehrpfads. Der Entwurf unter `db/aufbau/` steht für sich;
was hier liegt, betrifft nur die konkrete Instanz.

| Datei | Zweck |
|---|---|
| `uebernahme_altdaten.sql` | Einmalige Übernahme aus `cityBikesRental`, mit Protokoll |
| `abgleichsbericht.sql` | Soll-Ist-Vergleich nach der Übernahme |
| `altschema_absichern.sql` | Schließt den anonymen Zugriff im Altschema |

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
