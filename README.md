# VeloCity — Fallstudie Datenbankentwurf

Ein fiktiver Fahrradverleih in Würzburg, als durchgehendes Lehrbeispiel:
vom Relationenmodell über PostgreSQL mit Row Level Security bis zu zwei
Oberflächen, die beide ausschließlich über Sichten und `api_`-Funktionen
auf die Daten zugreifen — die Website für Kundschaft und die
Warenwirtschaft für den Betrieb.

**Live:** [bikes.butscher.cloud](https://bikes.butscher.cloud)
(Warenwirtschaft: `wawi.butscher.cloud`, Freigabe steht noch aus — siehe
`tools/wawi_veroeffentlichen.sh`)

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
| Zugriffsschutz über RLS | `db/aufbau/0010_*`, `0011_*`, `0017_*` |
| Tests (pgTAP) und ein Durchstich mit echten COMMITs | `db/tests/`, `db/durchstich.py` |
| Website (Kundschaft) | `src/` |
| Warenwirtschaft (Betrieb) | `wawi/`, siehe `doku/datenmodell/08-warenwirtschaft.md` |

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
wawi/           Die Warenwirtschaft: eigenes HTML/CSS/JavaScript, kein Bauwerkzeug
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

## Die Warenwirtschaft

Dieselbe didaktische Entscheidung wie bei der Website — kein Framework,
kein Build-Schritt —, aber eine eigene Anwendung für andere Personen:
`wawi/` bedient Disposition, Werkstatt, Kundenservice und Leitung, nicht
die Kundschaft. Neun JavaScript-Dateien (`config.js`, `daten.js`,
`anmeldung.js`, `rahmen.js` und fünf Arbeitsbereiche), ein Stylesheet,
keine Abhängigkeit außer `supabase-js` aus dem CDN. Angemeldet wird über
dieselbe `auth.users` wie bei der Website — die Trennung zwischen Kunden
und Mitarbeitenden steckt nicht im Zugriffsrecht, sondern in einer
Datenbankregel; siehe `doku/datenmodell/08-warenwirtschaft.md`.

```bash
python3 -m http.server 8766 --directory wawi
```

## Werkzeuge

```bash
bash tools/abnahme.sh                  # alle 31 Prüfungen
python3 tools/versionieren.py          # Fingerabdrücke der eingebundenen Dateien
python3 tools/ux_check.py              # Bedienbarkeit und Regressionen der Website
python3 tools/wawi_check.py            # Vertrag zwischen HTML und JavaScript der Warenwirtschaft
python3 tools/freisteller_pruefen.py   # die Radbilder gegen ihre Vorlagen
python3 tools/zahlen_gegen_db.py       # Anleitung und Vortrag gegen die Datenbank
python3 tools/raeder_weissgrund.py     # Radbilder neu erzeugen
bash tools/veroeffentlichen.sh         # Website auf den Server stellen
bash tools/wawi_veroeffentlichen.sh    # Warenwirtschaft auf den Server stellen

# db/betrieb/referenzdaten_grundlage.sql   ERFUNDENE Preisperioden und
# db/betrieb/referenzdaten_fahrten.sql     Mitgliedschaften, Fahrten und
# db/betrieb/referenzdaten_rechnungen.sql  Monatsrechnungen fuer ein
#   volles Auswertungsjahr — plausibel gebaut, aber nicht erhoben. Jeder
#   Lauf steht in velocity.uebernahme_protokoll.
```

`tools/abnahme.sh` fasst alles zusammen — von der Idempotenz der
SQL-Kette über den Zugriffsschutz bis zu beiden Oberflächen. Was dort
grün ist, ist nachgerechnet und nicht nur angesehen.

## Zum anon-Key in `src/config.js` und `wawi/config.js`

Derselbe öffentliche Schlüssel steht in beiden Dateien im Klartext und
gehört dorthin: er wird an jeden Browser ausgeliefert und ist kein
Geheimnis. Der Schutz liegt vollständig in Row Level Security und in den
Rechten des Schemas — für die Warenwirtschaft zusätzlich darin, dass
jede `v_wawi_*`-Sicht selbst über `velocity.hat_rolle(...)` filtert.
`tools/abnahme.sh` prüft das für beide Oberflächen von außen — dass
gesperrte Ressourcen mit 401 antworten und dass keine der beiden eine
Basistabelle anspricht.

Der `service_role`-Schlüssel und das Postgres-Passwort stehen
ausschließlich in einer nicht versionierten `.env`; `.env.example` zeigt
die Felder.

## Lizenz

MIT, siehe `LICENSE.txt`. Die Fahrradaufnahmen sind für diese
Lehrveranstaltung erstellt.
