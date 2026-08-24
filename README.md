# VeloCity — Fallstudie Datenbankentwurf

Ein fiktiver Fahrradverleih in Würzburg, als durchgehendes Lehrbeispiel:
vom Relationenmodell über PostgreSQL mit Row Level Security bis zur
Website, die ausschließlich über Sichten und `api_`-Funktionen auf die
Daten zugreift.

**Live:** [bikes.butscher.cloud](https://bikes.butscher.cloud)

Lehrveranstaltung *Datenbasierte Fallstudien*, THWS Würzburg-Schweinfurt.
Prof. Dr. Robert Butscher.

---

## Worum es didaktisch geht

Die meisten Datenbankübungen hören beim ER-Diagramm auf. Hier läuft die
Kette einmal ganz durch, und zwar so, dass jede Entscheidung nachlesbar
begründet ist:

| Schritt | Wo |
|---|---|
| Fachlicher Entwurf, ERD, Relationenmodell | `doku/datenmodell/` |
| Aufbau der Datenbank, in Reihenfolge nummeriert | `db/aufbau/` |
| Übernahme aus einem Altbestand samt Abgleichsbericht | `db/betrieb/` |
| Geschäftslogik in der Datenbank, nicht im Frontend | `db/aufbau/0009_geschaeftslogik.sql` |
| Zugriffsschutz über RLS | `db/aufbau/0010_*`, `0011_*` |
| Tests (pgTAP) und ein Durchstich mit echten COMMITs | `db/tests/`, `db/durchstich.py` |
| Oberfläche | `src/` |

Die SQL-Dateien sind **idempotent**: jede läuft zweimal hintereinander
fehlerfrei. Jede beginnt mit einem Kopf, der Zweck, angelegte Objekte
und Rücknahme nennt.

## Aufbau

```
db/aufbau/      Schema, Referenzdaten, Logik, Rechte — in dieser Folge
db/betrieb/     Datenübernahme, Abgleich, einmalige Eingriffe
db/tests/       pgTAP-Tests
doku/           Entwurf, Spezifikationen, Verifikationsprotokolle
src/            Die Website: HTML, CSS, JavaScript, keine Bauwerkzeuge
slides/         Foliendeck zur Fallstudie
tools/          Prüf- und Bauwerkzeuge (siehe unten)
deploy/         nginx und docker-compose für den Betrieb
```

## Die Website

Kein Framework, kein Build-Schritt: die Seite besteht aus zwei
HTML-Dateien, einem Stylesheet und sieben JavaScript-Dateien. Sie
spricht direkt mit PostgREST.

Zum Ansehen genügt ein statischer Server:

```bash
python3 -m http.server 8765 --directory src
```

Für echte Daten braucht es eine eigene Supabase-Instanz und einen
angepassten `src/config.js`.

## Werkzeuge

```bash
bash tools/abnahme.sh                  # alle 17 Prüfungen
python3 tools/versionieren.py          # Fingerabdrücke der eingebundenen Dateien
python3 tools/ux_check.py              # Bedienbarkeit und Regressionen
python3 tools/freisteller_pruefen.py   # die Radbilder gegen ihre Vorlagen
python3 tools/raeder_weissgrund.py     # Radbilder neu erzeugen
bash tools/veroeffentlichen.sh         # auf den Server stellen
```

`tools/abnahme.sh` fasst alles zusammen — von der Idempotenz der
SQL-Kette über den Zugriffsschutz bis zu den Bildern. Was dort grün ist,
ist nachgerechnet und nicht nur angesehen.

## Zum anon-Key in `src/config.js`

Der Schlüssel steht dort im Klartext und gehört dorthin: er wird an
jeden Browser ausgeliefert und ist kein Geheimnis. Der Schutz liegt
vollständig in Row Level Security und in den Rechten des Schemas.
`tools/abnahme.sh` prüft beides von außen — dass gesperrte Ressourcen
mit 401 antworten und dass die Oberfläche keine Basistabelle anspricht.

Der `service_role`-Schlüssel und das Postgres-Passwort stehen
ausschließlich in einer nicht versionierten `.env`; `.env.example` zeigt
die Felder.

## Lizenz

MIT, siehe `LICENSE.txt`. Die Fahrradaufnahmen sind für diese
Lehrveranstaltung erstellt.
