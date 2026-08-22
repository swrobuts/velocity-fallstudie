# 05 Physischer Entwurf

> Fünfter Schritt: die Umsetzung in PostgreSQL. Hier fallen die
> Entscheidungen, die das Relationenmodell offenlässt.

## Datentypen und ihre Begründung

| Zweck | Typ | Warum |
|---|---|---|
| Surrogatschlüssel | `bigint GENERATED ALWAYS AS IDENTITY` | Standardkonform, im Gegensatz zu `serial`; `ALWAYS` verhindert versehentliches Setzen von außen |
| Zeitpunkt | `timestamptz` | ausnahmslos. `timestamp` ohne Zone verliert die Information, auf welche Zeit sich der Wert bezieht — bei Sommerzeitumstellung entstehen unauflösbare Doppeldeutigkeiten |
| Geldbetrag | `numeric(10,2)` | Exakte Dezimalarithmetik. `float` rechnet binär und trifft 0,10 nicht genau |
| Zeitraum | `daterange` | Ein Zeitraum ist ein Wert, kein Paar aus zwei Spalten. Erst dadurch sind Überschneidungen prüfbar |
| Prozentsatz | `numeric(5,2)` | Zwei Nachkommastellen genügen fachlich |
| Koordinate | `numeric(9,6)` | Sechs Nachkommastellen entsprechen etwa 11 cm |
| Text | `text` | PostgreSQL speichert `varchar(n)` und `text` identisch. Eine Längengrenze ist nur dann sinnvoll, wenn sie fachlich begründet ist |
| Statuswert | `ENUM` | Geschlossene technische Menge |
| Klassifikation | Referenztabelle | Wenn sie wächst oder eigene Attribute trägt |

## ENUM gegen Referenztabelle

Beide sind Wertebeschränkungen; die Wahl folgt einer Regel:

**ENUM**, wenn die Menge geschlossen ist, sich selten ändert und keine
Zusatzattribute trägt: `fahrrad_status`, `ausleihe_status`,
`rechnung_status`, `zahlung_status`, `kunde_status`, `tarifart`.

**Referenztabelle**, wenn sie fachlich wächst oder Attribute trägt:
`entgeltart` führt mit `vorzeichen` ein Attribut mit, das die
Preisfindung auswertet. Als ENUM müsste die Anwendung wissen, welche Art
belastet und welche entlastet — das Wissen läge dann im Code statt in
den Daten.

Der Preis des ENUM: Erweitern geht nur mit `ALTER TYPE`, Umbenennen ist
aufwendig, und eine Sortierreihenfolge lässt sich nicht nachträglich
ändern.

## Constraints sind Geschäftsregeln

| Regel | Umsetzung |
|---|---|
| GR1 ein Rad höchstens einmal aktiv | `CREATE UNIQUE INDEX … ON ausleihe (fahrrad_id) WHERE status = 'aktiv'` |
| GR2 höchstens vier aktive Ausleihen | Prüfung in `fn_ausleihe_starten` |
| GR3 ein gültiger Tarif je Kunde | `EXCLUDE USING gist (kunde_id WITH =, gueltigkeit WITH &&)` |
| GR4 Preise überlappen nie | `EXCLUDE` auf `nutzungspreis` und `tarif_kondition` |
| GR5 Preis zum Startzeitpunkt | `fn_ausleihe_beenden`, Verweis in `entgeltposition.nutzungspreis_id` |
| GR6 angefangene Minuten | `GENERATED ALWAYS AS (ceil(...)) STORED` |
| GR7 Verbrauch ≤ Kontingent | `CHECK (verbraucht_minuten <= kontingent_minuten)` |
| GR8 Mindestalter 16 | `api_profil_aktualisieren` — **nicht** als `CHECK`, siehe unten |
| GR9 nur eigene Ausleihe beenden | `auth.uid()`-Prüfung in `api_ausleihe_beenden` |
| GR10 eine Rechnung je Kunde und Monat | `UNIQUE (kunde_id, periode_jahr, periode_monat)` |

Sieben von zehn Regeln setzt die Datenbank durch. Die drei übrigen
brauchen Kontext, den ein Constraint nicht hat: den angemeldeten Nutzer,
das aktuelle Datum, den Zustand anderer Zeilen.

## Der `EXCLUDE`-Constraint

```sql
constraint nutzungspreis_ueberschneidung_ex
  exclude using gist (typ_id with =, gueltigkeit with &&)
```

Zu lesen als: es darf keine zwei Zeilen geben, bei denen `typ_id` gleich
**und** die Zeiträume überlappend sind. Ein `UNIQUE` kann das nicht —
es kennt nur Gleichheit, keine Überschneidung.

**Voraussetzung:** die Erweiterung `btree_gist`. Der Zugriffsweg `gist`
kennt für `bigint` von Haus aus keinen Gleichheitsoperator; ohne die
Erweiterung scheitert die Anlage mit
*„data type bigint has no default operator class for access method gist"*.

Alle Zeiträume sind halboffen (`'[)'`). Damit schließt ein Zeitraum
nahtlos an den nächsten an, ohne sich zu überschneiden — bei
geschlossenen Grenzen wäre der Wechseltag doppelt belegt.

## Warum das Mindestalter kein CHECK ist

Naheliegend wäre:

```sql
check (geburtsdatum <= current_date - interval '16 years')
```

PostgreSQL akzeptiert das sogar — getestet. Trotzdem ist es falsch:
`current_date` ist nicht `IMMUTABLE`. Ein `CHECK` wird beim Schreiben
geprüft **und beim Wiedereinspielen eines Dumps erneut**. Ein Kunde, der
bei der Anmeldung 16 war, bleibt es; eine Bedingung, die sich auf „heute"
bezieht, kann bei der Wiederherstellung dennoch anschlagen und den
Restore abbrechen lassen.

Auf der Tabelle steht deshalb nur eine immutable Plausibilitätsgrenze:

```sql
check (geburtsdatum is null
       or geburtsdatum between date '1900-01-01' and date '2100-01-01')
```

Die Altersregel prüft `api_profil_aktualisieren`.

**Merksatz:** ein `CHECK` darf nur von der Zeile selbst abhängen und von
nichts, was sich mit der Zeit ändert.

## Berechnete Spalten

```sql
dauer_minuten integer generated always as
  (ceil(extract(epoch from (endzeit - startzeit)) / 60.0)::integer) stored
```

Der Wert lässt sich nicht von außen setzen — ein `UPDATE` darauf
scheitert mit SQLSTATE `428C9`. Damit ist ausgeschlossen, dass Dauer und
Zeitstempel auseinanderlaufen.

## Der partielle Unique-Index

```sql
create unique index uq_ausleihe_aktiv_je_fahrrad
  on ausleihe (fahrrad_id) where status = 'aktiv';
```

Ein gewöhnliches `UNIQUE (fahrrad_id)` wäre falsch: ein Rad darf über die
Jahre beliebig oft ausgeliehen werden, nur nicht zweimal **gleichzeitig**.
Die `WHERE`-Klausel macht aus einer zu strengen Regel die richtige.

## Audit und `now()` gegen `clock_timestamp()`

Jede Tabelle trägt `erstellt_am` und `geaendert_am`, gepflegt vom Trigger
`trg_<tabelle>_audit`. Verwendet wird `now()`, also die **Transaktions**zeit,
nicht `clock_timestamp()`.

Begründung: alle in einem Vorgang geänderten Zeilen sollen denselben
Stempel tragen und damit als ein Änderungssatz erkennbar sein.

Folge für Tests: innerhalb einer Transaktion sind `erstellt_am` und
`geaendert_am` **gleich**. Ein Test, der per `pg_sleep` auf einen
Zeitfortschritt wartet, prüft ins Leere — `now()` bewegt sich nicht.
`t0001` prüft stattdessen, dass der Trigger von außen gesetzte Werte
überschreibt.

## Indexstrategie

Angelegt wird nur, was einem Zugriffspfad der Anwendung entspricht:

| Index | Wofür |
|---|---|
| `idx_ausleihe_kunde_status` | „meine aktiven Ausleihen" |
| `idx_ausleihe_startzeit` | Historie, absteigend sortiert |
| `idx_entgeltposition_ausleihe` | Positionen zur Ausleihe |
| `idx_fahrrad_status` | verfügbare Räder für die Karte |
| `idx_fahrrad_position_station` | Belegung je Station |
| `idx_kunde_nachname`, `idx_adresse_ort` | Suche in der Verwaltung |

Primär- und Eindeutigkeitsbedingungen bringen ihre Indizes selbst mit.
Fremdschlüssel bekommen nur dann einen eigenen Index, wenn über sie auch
gelesen wird — ein Index kostet bei jedem Schreibvorgang.

## Was daran didaktisch zählt

Der physische Entwurf ist die Stelle, an der eine Geschäftsregel entweder
**erzwungen** oder nur **gewünscht** wird. Jede Regel, die nicht in einem
Constraint, einem Index oder einer Funktion steht, wird früher oder
später verletzt.
