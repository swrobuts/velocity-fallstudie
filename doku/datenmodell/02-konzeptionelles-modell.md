# 02 Konzeptioneller Entwurf

> Zweiter Schritt: das Entity-Relationship-Modell. Noch keine Datentypen,
> keine Schlüsselstrategie, keine Datenbank — nur Entitäten, Beziehungen
> und Kardinalitäten.

## Notation

Die Diagramme sind Mermaid-ER-Diagramme in der Krähenfuß-Notation:

| Zeichen | Bedeutung |
|---|---|
| `\|\|--o{` | eins zu null-oder-viele |
| `\|\|--\|{` | eins zu ein-oder-viele |
| `\|\|--\|\|` | eins zu eins |
| `\|\|--o\|` | eins zu null-oder-eins |

Die Quellen liegen unter `erd/` und werden bei jeder Änderung gegen den
Mermaid-Parser geprüft:

```bash
node tools/mermaid_check.mjs doku/datenmodell/erd/*.mmd
```

## Bereichsübersicht

Zehn Fachbereiche, davon sechs in Phase 1 umgesetzt.
Quelle: `erd/uebersicht-bereiche.mmd`.

| | Bereich | Entitäten |
|---|---|---|
| **A** | Geschäftspartner | `adresse`, `kunde` |
| **B** | Netz und Flotte | `station`, `fahrradtyp`, `fahrradtyp_merkmal`, `hersteller`, `fahrradmodell`, `fahrrad`, `fahrrad_position` |
| **C** | Tarif und Preis | `tarif`, `tarif_kondition`, `mitgliedschaft`, `freiminuten_periode`, `nutzungspreis` |
| **D** | Nutzung | `ausleihe`, `entgeltart`, `entgeltposition` |
| **E** | Abrechnung | `zahlungsart`, `zahlungsmittel`, `rechnung`, `rechnungsposition`, `zahlung` |
| **F** | Redaktionsinhalte | `faq_eintrag`, `nutzungsschritt`, `kennzahl` |
| **G** | Beschaffung | `lieferant`, `artikelgruppe`, `artikel`, `bestellung`, `bestellposition`, `wareneingang` |
| **H** | Lager | `lager`, `lagerbewegung`, `lagerbestand` |
| **I** | Instandhaltung | `schadensmeldung`, `wartungsauftrag`, `wartungsposition`, `fahrrad_ereignis` |
| **J** | Personal und Logistik | `mitarbeiter`, `rolle`, `umsetzungsauftrag` |

## Die Diagramme

| Datei | Inhalt |
|---|---|
| `erd/uebersicht-bereiche.mmd` | Die zehn Bereiche und ihre Abhängigkeiten |
| `erd/erd-kern.mmd` | Bereiche A bis D mit allen Attributen |
| `erd/erd-abrechnung.mmd` | Bereich E |
| `erd/erd-inhalte.mmd` | Bereich F |
| `erd/erd-wawi.mmd` | Bereiche G bis K für Phase 2 — I, J und K gebaut (Aufgaben 9–13), G und H bleiben Entwurf |

## Acht Entwurfsentscheidungen und ihre Begründung

**1 Adresse als eigene Entität.** Kunde, Station, Lieferant und Lager
brauchen dieselbe Struktur. Vier Mal dieselben fünf Spalten wären
Redundanz auf Schemaebene.

**2 Preise nicht am Fahrradtyp.** Ein Preis gilt für einen Zeitraum.
Läge er am Typ, würde jede Preisanpassung rückwirkend die Bewertung aller
Altausleihen verändern. `nutzungspreis` trägt deshalb einen
Gültigkeitszeitraum.

**3 `entgeltposition` statt eines Kostenbetrags.** Ein einzelner Betrag
verrät nicht, wie er zustande kam. Startgebühr, Zeitentgelt,
Freiminutengutschrift, Tarifrabatt und Kappung sind je eine eigene Zeile
mit Verweis auf den angewandten Preissatz.

**4 `freiminuten_periode` statt eines Zählers.** Ein Feld, das
heruntergezählt wird, verliert seine Geschichte. Kontingent und Verbrauch
je Monat nebeneinander lassen jeden Stand rekonstruieren — der Unterschied
zwischen **Bestand** und **Bewegung**.

**5 `fahrrad_position` als 1:1-Satellit.** Stammdaten ändern sich selten,
Positionen ständig. Die Trennung hält die Stammdatentabelle ruhig und gibt
`station_id IS NULL` eine eindeutige Bedeutung: frei abgestellt.

**6 Dauer als abgeleitetes Attribut.** Die Dauer folgt zwingend aus Start
und Ende. Sie wird berechnet, nicht gepflegt.

**7 Redaktionsinhalte als konkrete Entitäten.** FAQ, Nutzungsschritte und
Kennzahlen könnten in einer generischen Schlüssel-Wert-Tabelle liegen. Das
wäre flexibler und schlechter: keine Typsicherheit, keine Fremdschlüssel,
unlesbare Abfragen. Siehe `03-normalisierung.md`.

**8 `hersteller` und `fahrradmodell` zwischen Typ und Fahrrad.**
Ersatzteile hängen am Modell, nicht am Einzelrad. Ohne diese Zwischenstufe
ließe sich die Warenwirtschaft später nicht sauber anschließen.

## Was daran didaktisch zählt

Ein ERM ist eine **Behauptung über die Wirklichkeit**, keine
Datenbankzeichnung. Jede Kardinalität ist eine fachliche Aussage, die
falsch sein kann. „Ein Kunde hat höchstens einen gültigen Tarif" ist eine
Entscheidung des Fachbereichs — und wird später von der Datenbank
erzwungen, nicht von der Anwendung gehofft.
