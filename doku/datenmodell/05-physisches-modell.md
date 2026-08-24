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
| GR11 genau eine Ortsangabe | `CHECK ausleihe_startort_chk` und `ausleihe_endort_chk` |
| GR12 kein Start ohne Standort | Prüfung in `fn_ausleihe_starten` |
| GR13 genau ein Standort je Rad | `CHECK fahrrad_position_ort_chk` **und** Constraint-Trigger |
| GR14 nur im Geschäftsgebiet abstellen | `fn_im_geschaeftsgebiet` in `fn_ausleihe_beenden` |
| GR15 nie mehr Räder als Stellplätze | Constraint-Trigger auf `fahrrad_position` **und** `station` |

### GR11: warum kein NOT NULL

Naheliegend wäre `start_station_id NOT NULL`. Das wäre falsch: die
Fallstudie kennt **zwei** Abstellarten — an einer Station oder frei im
Stadtgebiet. Gefordert ist also nicht „vorhanden", sondern
„genau eines von beiden", und das kann nur ein `CHECK` ausdrücken:

```sql
check ( (start_station_id is not null and start_latitude is null and start_longitude is null)
     or (start_station_id is null and start_latitude is not null and start_longitude is not null) )
```

Am Ende kommt die Zeit hinzu: solange die Fahrt läuft, darf es **keinen**
Rückgabeort geben, danach genau einen. Der zweite `CHECK` bindet die
Ortsangabe deshalb an `endzeit`.

Die Regel hatte eine Nebenwirkung, die den Entwurf verbessert hat: die
Fremdschlüssel auf `station` standen auf `ON DELETE SET NULL`. Mit der
Ortspflicht wäre das fatal — das Löschen einer Station hätte die einzige
Ortsangabe einer abgeschlossenen Fahrt stillschweigend entfernt und die
Zeile ungültig gemacht. Sie stehen jetzt auf `ON DELETE RESTRICT`.
Stationen werden über `betriebszeitraum` außer Betrieb genommen, nicht
gelöscht.

### GR13: wo ein CHECK aufhört

Ein Rad kennt genau drei Zustände:

| Zustand | `station_id` | Koordinaten |
|---|---|---|
| an einer Station | gesetzt | leer |
| frei im Stadtgebiet | leer | gesetzt |
| in Fahrt | leer | leer |

Im Bestand trugen **316 von 352** Zeilen Station *und* Koordinaten —
dieselbe transitive Abhängigkeit wie bei der Ausleihe: die Station
bestimmt den Ort, die Koordinaten daneben sind eine zweite Wahrheit, die
auseinanderlaufen kann. Die Sicht `v_verfuegbares_fahrrad` fällt ohnehin
über `coalesce` auf die Station zurück.

Den ersten Teil — nie beides, Koordinaten immer als Paar — erledigt ein
`CHECK`. Der dritte Zustand aber hängt am **Status des Rades**, und der
steht in `fahrrad`, einer anderen Tabelle. Ein `CHECK` darf nicht über
seine Zeile hinaussehen. Deshalb ein **Constraint-Trigger**:

```sql
create constraint trigger trg_radposition_ort
  after insert or update on velocity.fahrrad_position
  deferrable initially deferred
  for each row execute function velocity.trg_radposition_pruefen();
```

`DEFERRABLE INITIALLY DEFERRED` ist keine Bequemlichkeit, sondern
notwendig: `fn_ausleihe_starten` setzt erst den Status auf
`ausgeliehen` und räumt dann die Position. Zwischen diesen beiden
Anweisungen ist der Zustand zwangsläufig widersprüchlich. Geprüft wird
am Ende der Transaktion, nicht mittendrin. Der Trigger hängt auch an
`fahrrad.status` — sonst käme ein Rad aus der Wartung zurück, ohne dass
jemand weiß, wo es steht.

Der Nebeneffekt ist derselbe wie bei GR11: `fahrrad_position.station_id`
stand auf `ON DELETE SET NULL` und macht damit aus einem abgestellten Rad
eines ohne Standort. Jetzt `RESTRICT` — wer eine Station auflöst, räumt
sie vorher leer.

**Zum Verhältnis von GR12 und GR13:** Sobald GR13 gilt, kann ein
ausleihbares Rad gar keinen unbekannten Standort mehr haben — GR12 ist
damit nicht mehr erreichbar. Die Prüfung in `fn_ausleihe_starten` bleibt
trotzdem stehen. Sie kostet nichts und fängt den Fall ab, falls jemand
GR13 später lockert. Gestaffelte Absicherung, nicht Redundanz.

### GR14: eine Fläche als Regel, nicht als Zeichnung

Das Geschäftsgebiet war ein Vieleck im JavaScript der Karte. Die Seite
zeichnete es, die Datenbank kannte es nicht — sie nahm beim Beenden
einer Fahrt jede Koordinate an, auch eine in Hamburg. Jetzt steht die
Fläche in `velocity.geschaeftsgebiet`, und die Karte zeichnet nach, was
dort hinterlegt ist.

Geprüft wird mit dem **eingebauten** Typ `polygon` und dem Operator `@>`:

```sql
select g.flaeche @> point(p_longitude, p_latitude)
```

PostGIS braucht es dafür nicht. Für ein paar konvexe Vielecke wäre das
zu viel Maschinerie; PostgreSQL bringt die geometrischen Typen im
Sprachkern mit. Zu beachten ist allein die Reihenfolge: `point(x, y)`
heißt hier `point(Längengrad, Breitengrad)` — vertauscht man sie, liegt
Würzburg im Indischen Ozean.

Die Funktion fragt über `exists` und verträgt deshalb beliebig viele
Gebiete. Das war nötig: es gibt **zwei**, Würzburg und Schweinfurt.
Zunächst stand nur Würzburg in der Tabelle — und damit lagen die drei
Stationen am Schweinfurter THWS-Campus außerhalb jedes Geschäftsgebiets.
Eine dort begonnene Fahrt hätte sich nach GR15 nirgends beenden lassen,
nicht einmal an der eigenen Station. Aufgefallen ist das erst bei einer
Prüfung von außen; ein Test hatte den Fehler sogar festgeschrieben
(*„Schweinfurt liegt außerhalb"*). Seit dem 24.08.2026 sichert
`test_station_liegt_im_geschaeftsgebiet` die Regel in die Gegenrichtung:
**keine aktive Station darf außerhalb aller Gebiete liegen.**

### Wann eine Regel prüft — und mit wessen Rechten

Der teuerste Fehler dieses Projekts steckte nicht im Modell, sondern in
einer Zeitangabe. Beide Constraint-Trigger sind `deferrable initially
deferred`: sie feuern erst beim `COMMIT`. Das ist fachlich richtig —
`fn_ausleihe_starten` setzt Status und Position in zwei Anweisungen,
dazwischen ist der Zustand notwendig widersprüchlich.

Nur: beim `COMMIT` ist `api_ausleihe_starten` längst zurückgekehrt, und
mit ihr endet deren `security definer`. Die Prüfung lief damit unter der
Rolle des Aufrufers — bei einer Ausleihe über die Website `authenticated`.
Diese Rolle darf `fahrrad_position` nicht lesen, und soll es auch nicht.

Das Ergebnis war eine Ausleihe, die sauber durchlief und am Ende doch
scheiterte:

```
Funktion lieferte: (1569, 'Ausleihe gestartet')
FEHLER: permission denied for table fahrrad_position
CONTEXT: PL/pgSQL function trg_radposition_pruefen() line 9
```

In den Tests fiel das nie auf, weil pgTAP als `postgres` läuft **und**
alles in einer Transaktion hält, die am Ende zurückgerollt wird — der
`COMMIT`, an dem der Fehler hängt, kommt dort nie. Gefunden hat es erst
eine Prüfung von außen, die die Seite wie ein Kunde bedient hat.

Zwei Lehren, die über dieses Projekt hinausgehen:

1. **Eine Integritätsprüfung muss die Daten sehen dürfen, über die sie
   wacht** — unabhängig davon, wer die Zeile geschrieben hat. Beide
   Triggerfunktionen sind deshalb `security definer` mit festgenageltem
   `search_path` und gehören ausdrücklich `postgres`.
2. **Ein Test, der nie committet, prüft die aufgeschobenen Regeln nicht.**
   `db/durchstich.py` geht deshalb den ganzen Weg mit echten Commits unter
   der Rolle `authenticated` und räumt danach hinter sich auf.

### GR15: eine Zahl, die nie stimmte

Am Dom standen **30 Räder auf 10 Stellplätzen**, acht von zehn Würzburger
Stationen waren überfüllt. Aufgefallen ist es nie, weil die Sicht es
kaschierte:

```sql
greatest(s.kapazitaet - count(p.fahrrad_id), 0) as freie_stellplaetze
```

Das `greatest(…, 0)` macht die Zahl nie negativ — sie war also nie
falsch und nie wahr. Ein Popover, das „28 von 10 Stellplätzen belegt"
anzeigt, ist der Moment, in dem so etwas auffliegt.

Wieder ein Constraint-Trigger statt eines `CHECK`: die Regel zählt
Zeilen einer **anderen** Tabelle. Er hängt an beiden Seiten — am
Abstellen *und* am Herabsetzen der Kapazität. Ohne die zweite Seite
wäre das Schlupfloch offensichtlich: man setzt eine volle Station auf
einen Stellplatz und die Regel ist umgangen.

Die Daten wurden in `db/betrieb/flottenverteilung.sql` in Ordnung
gebracht: Kapazitäten nach dem Charakter der Station, und 45 Räder frei
im Stadtgebiet verteilt. Die Punkte liegen auf Verbindungslinien
zwischen je zwei Stationen — das Geschäftsgebiet ist konvex, also liegt
jeder solche Punkt zwangsläufig darin. Keine Zufallszahl, die daneben
gehen könnte.

Zehn von fünfzehn Regeln setzt die Datenbank durch — GR14 gehört zu den
fünf, die den vorgesehenen Weg über die Funktionsschicht brauchen. Die drei übrigen
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
