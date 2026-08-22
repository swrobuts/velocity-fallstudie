# A1 Datenübernahme aus dem Altbestand

> **Anhang, nicht Teil des Lehrpfads.** Der Entwurf steht für sich; dies
> hier betrifft nur die konkrete Instanz, auf der ein gewachsenes Schema
> `cityBikesRental` vorlag.

## Grundsätze

- Das Altschema wird ausschließlich **gelesen**.
- Die Zuordnung läuft über **fachliche** Schlüssel, nicht über
  Surrogatschlüssel: Kunde über `email`, Station über die aus der alten
  `station_id` gebildete `stationsnummer`, Fahrrad über `rahmennummer`,
  Typ und Tarif über die Bezeichnung. Surrogatschlüssel sind
  instanzspezifisch und taugen nicht zur Zuordnung zwischen Systemen.
- Jeder Schritt schreibt nach `velocity.uebernahme_protokoll`.
- Das Skript ist mehrfach ausführbar; ein zweiter Lauf schreibt nichts nach.

## Ergebnis

| Bereich | alt | neu | Abweichung |
|---|---|---|---|
| Kunde | 1015 | 1015 | 0 |
| Station | 13 | 13 | 0 |
| Fahrrad | 352 | 352 | 0 |
| Ausleihe | 32 | 32 | 0 |
| Mitgliedschaft (aktiv) | 10 | 10 | 0 |
| Summe der Altbeträge in Cent | 13000 | 13000 | 0 |
| Auth-Verknüpfungen | 3 | 0 | −3, siehe unten |

Zusätzlich entstanden 901 Adressen aus den Adressspalten der Kunden und
13 aus denen der Stationen, dedupliziert über den fachlichen Schlüssel.

## Getroffene Annahmen

**Passwörter werden nicht übernommen.** Die alte Spalte `passwort_hash`
enthielt gemischt bcrypt-Hashes, Klartextpasswörter und den Marker
`SUPABASE_AUTH`. Das neue Modell hat gar keine Passwortspalte.

**Hersteller und Modell sind Platzhalter.** Der Altbestand kennt nur den
Fahrradtyp. Statt Angaben zu erfinden, entsteht je Typ ein Modell unter
dem Hersteller `unbekannt` — als solches erkennbar und später korrigierbar.

**Koordinaten werden verworfen.** Die Positionen der Räder im Altbestand
stammten aus `random()` (nachlesbar in `db/legacy/database-fix-bikes-v3.sql`).
Übernommen wird nur, was sich aus der Station ableiten lässt. Erfundene
Daten in ein neues Modell zu tragen wäre schlimmer als eine Lücke.

**Altbeträge als eine Position.** Die historischen `kosten` werden als
**eine** Zeile der Art `BESTANDSUEBERNAHME` eingestellt. Die Summen
stimmen damit auf den Cent, ohne eine Preisfindung zu erfinden, die nie
stattgefunden hat.

**`station_fahrradtyp` wird nicht übernommen.** Die Tabelle wurde
fachlich nirgends ausgewertet.

## Zwei Befunde im Altbestand

**Verwaiste Auth-Verweise.** `auth_kunde_mapping` hatte **keinen**
Fremdschlüssel auf `auth.users` und enthielt drei Verweise auf gelöschte
Konten. Der Fremdschlüssel im neuen Modell brach die Übernahme sofort ab
— genau dafür ist er da. Übernommen wird nur, was auf ein existierendes
Konto zeigt.

Bei der Gelegenheit fiel auf: **`auth.users` ist vollständig leer.** Es
existiert auf der Instanz derzeit kein einziges Anmeldekonto. Die
Anmeldung der alten Website funktionierte also für niemanden mehr; ohne
Fremdschlüssel war das unsichtbar geblieben.

**Fehlender Zeilenschutz.** Die Protokolltabelle entsteht im
Übernahmeskript, also nach dem Sicherheitsschritt 0011, und stand deshalb
als einzige ohne RLS da. Der Test `test_s_rls_ueberall_aktiv` fand es;
das Skript setzt RLS jetzt selbst.

## Bekannte Grenzen

Altausleihen lassen sich **nicht** rückwirkend mit historisch korrekten
Preisen bewerten. Der Altbestand kannte keine Preishistorie; welcher Satz
im Januar galt, ist nicht mehr feststellbar. Die übernommenen Beträge
stimmen, ihre Herleitung fehlt.

## Absicherung des Altschemas

Nach geprüftem Abgleich, in dieser Reihenfolge:

1. Vollständige Sicherung über `tools/schema_dump.py` (Struktur,
   Constraints, Indizes, Funktionen, alle Tabellen als CSV).
2. Elf `anon`-Policies entfernt, Rechte auf Tabellen, Funktionen und
   Sequenzen zurückgezogen, `USAGE` auf dem Schema entzogen.
3. `passwort_hash` geleert.

Struktur und alle 1015 Kundensätze bleiben unverändert vorführbar.
Nachweis: dieselbe Abfrage, die zuvor die vollständigen Kundendaten
lieferte, gibt jetzt HTTP 401.

**Folge:** die Warenwirtschafts-Oberfläche unter `erp/` spricht dieses
Schema und funktionierte nur über den offenen anon-Zugriff. Sie ist außer
Betrieb, bis Phase 2 sie auf `velocity` umstellt. Das ist beabsichtigt:
eine Oberfläche, die ihre Rechte aus einem öffentlich ausgelieferten
Schlüssel bezieht, darf nicht weiterlaufen.
