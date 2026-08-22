# 03 Normalisierung

> Dritter Schritt: die Prüfung, ob das Modell Redundanz und
> Änderungsanomalien enthält. Gearbeitet wird an einer bewusst
> denormalisierten Ausgangstabelle, damit die Schritte sichtbar werden.

## Die Ausgangstabelle

Man stelle sich vor, jemand hätte die Ausleihe „so wie sie ist" in eine
Tabelle geschrieben:

```
ausleihe_flach(
  ausleihe_id, kunde_email, kunde_name, kunde_strasse, kunde_plz, kunde_ort,
  rahmennummer, typ_bezeichnung, startgebuehr, preis_pro_minute,
  tageshoechstpreis, startzeit, endzeit, dauer_minuten, kosten,
  positionen
)
```

## 1NF — alle Attribute atomar

Verletzt durch:

- `kunde_name` enthält Vor- und Nachname in einem Feld.
- `positionen` enthält mehrere Abrechnungszeilen in einem Feld.

Ergebnis der 1NF: `kunde_name` wird in `vorname` und `nachname`
zerlegt; `positionen` wird zu eigenen Zeilen einer separaten Relation.

Der Fall `positionen` ist der lehrreichere: eine wiederholende Gruppe wird
nicht zu mehreren Spalten (`position1`, `position2`, …), sondern zu einer
eigenen Relation. Sonst legt man die Anzahl der Positionen im Schema fest.

## 2NF — keine partielle Abhängigkeit vom Schlüssel

Betrachtet man die Positionen mit dem zusammengesetzten Schlüssel
(`ausleihe_id`, `position_nr`), so hängen `kunde_email`, `rahmennummer`
und `startzeit` nur von `ausleihe_id` ab, nicht vom ganzen Schlüssel.

Ergebnis der 2NF: Trennung in `ausleihe` (Kopf) und `entgeltposition`
(Positionen). Das klassische Kopf-Positionen-Muster ist keine
Konvention, sondern eine Folge der 2NF.

## 3NF — keine transitive Abhängigkeit

In `ausleihe_flach` gilt:

```
ausleihe_id → rahmennummer → typ_bezeichnung → preis_pro_minute
```

Der Preis hängt vom Typ ab, der Typ vom Rad, das Rad von der Ausleihe.
Eine Preisänderung müsste in jeder Ausleihzeile nachgezogen werden —
die klassische Änderungsanomalie.

Ergebnis der 3NF: `fahrradtyp` und `nutzungspreis` werden eigene
Relationen.

**Die 3NF allein genügt hier aber nicht.** Löst man die transitive
Abhängigkeit nur auf und speichert den Preis am Typ, ändert eine
Preisanpassung weiterhin rückwirkend die Bewertung aller Altausleihen.
Erst der **Gültigkeitszeitraum** in `nutzungspreis` macht das Modell
fachlich richtig. Normalisierung beseitigt Redundanz, sie ersetzt keine
fachliche Analyse.

## Ebenfalls transitiv: `dauer_minuten` und `kosten`

Beide folgen aus anderen Attributen. `dauer_minuten` wird deshalb zur
berechneten Spalte, `kosten` verschwindet ganz zugunsten der Positionen.

## Exkurs: `plz → ort`

Der Lehrbuchklassiker lautet: aus der Postleitzahl folgt der Ort, also
gehört `ort` in eine eigene Relation.

In Deutschland stimmt das nicht. Eine Postleitzahl kann mehrere Orte
umfassen (ländliche Sammel-PLZ), und ein Ort hat in aller Regel mehrere
Postleitzahlen. Die Abhängigkeit ist also **nicht funktional**, und der
scheinbar saubere Zerlegungsschritt wäre fachlich falsch.

`velocity.adresse` führt `plz` und `ort` deshalb bewusst nebeneinander.
Der Kommentar an der Spalte hält die Begründung fest — nachlesbar im
Data Dictionary.

Das ist die eigentliche Lektion: **eine funktionale Abhängigkeit ist eine
Behauptung über die Wirklichkeit und muss geprüft werden**, nicht aus der
Namensähnlichkeit zweier Spalten geschlossen.

## Warum kein Entity-Attribute-Value

Für die Redaktionsinhalte wäre eine generische Tabelle denkbar:

```
inhalt_attribut(objekt_typ, objekt_id, attribut, wert)
```

Sie wäre in dritter Normalform und trotzdem eine schlechte Wahl:

| Verlust | Folge |
|---|---|
| Datentypen | Jeder Wert ist Text; Zahlen und Datumsangaben sind ungeprüft |
| Fremdschlüssel | Kein Verweis von `merkmal` auf `fahrradtyp` möglich |
| Constraints | „Eine nicht berechnete Kennzahl braucht einen Anzeigewert" ist nicht formulierbar |
| Lesbarkeit | Jede Abfrage braucht Selbstverknüpfungen je Attribut |
| Ausführungsplanung | Der Optimierer hat keine brauchbare Statistik |

Normalform ist notwendig, nicht hinreichend. `faq_eintrag`,
`nutzungsschritt` und `kennzahl` sind drei kleine, klare Relationen.

## Was daran didaktisch zählt

Normalisierung ist ein **Prüfverfahren**, kein Entwurfsverfahren. Sie
findet Redundanz, aber sie sagt nicht, ob das Modell die Wirklichkeit
trifft. Die beiden Stellen, an denen dieses Modell über die Normalform
hinausgeht — Preishistorisierung und der verweigerte `plz`-Split — sind
genau die, an denen fachliche Analyse die Formalregel schlägt.
