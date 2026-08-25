# Datenmodell VeloCity — Dokumentation

Entlang des klassischen Entwurfszyklus:

```
Anforderungsanalyse → Konzeptioneller Entwurf → Normalisierung
  → Logischer Entwurf → Physischer Entwurf → Implementierung
  → Sicherheit → Anbindung
```

| Datei | Schritt |
|---|---|
| [01-anforderungen.md](01-anforderungen.md) | Fallstudie, Glossar, zehn Geschäftsregeln, Mengengerüst |
| [02-konzeptionelles-modell.md](02-konzeptionelles-modell.md) | ERM, Bereiche A–J, acht Entwurfsentscheidungen |
| [03-normalisierung.md](03-normalisierung.md) | 1NF bis 3NF am Beispiel, Exkurs `plz → ort`, warum kein EAV |
| [04-relationales-modell.md](04-relationales-modell.md) | Abbildungsregeln, vollständiges Relationenschema, Schlüsselstrategie |
| [05-physisches-modell.md](05-physisches-modell.md) | Datentypen, Constraints als Geschäftsregeln, `EXCLUDE`, Indizes |
| [06-data-dictionary.md](06-data-dictionary.md) | Erzeugt aus dem Systemkatalog, nicht von Hand pflegen |
| [07-sicherheitskonzept.md](07-sicherheitskonzept.md) | Bedrohungsmodell, *default deny*, RLS, Nachweise |
| [A1-datenuebernahme.md](A1-datenuebernahme.md) | Anhang: Übernahme des Altbestands, betrieblich |

## Diagramme

Unter `erd/`, alle gegen den Mermaid-Parser geprüft:

```bash
node tools/mermaid_check.mjs doku/datenmodell/erd/*.mmd
```

| Datei | Inhalt |
|---|---|
| `uebersicht-bereiche.mmd` | Die zehn Fachbereiche und ihre Abhängigkeiten |
| `erd-kern.mmd` | Bereiche A–D mit allen Attributen |
| `erd-abrechnung.mmd` | Bereich E |
| `erd-inhalte.mmd` | Bereich F |
| `erd-wawi.mmd` | Bereiche G–K, Phase 2 — I, J, K gebaut, G und H entworfen |

## Data Dictionary neu erzeugen

Nach jeder Änderung an `db/aufbau/0012_dokumentation.sql`:

```bash
python3 db/run.py db/aufbau/0012_dokumentation.sql
python3 db/test.py db/tests/t0012_dokumentation.sql
```

Der Test schlägt fehl, solange eine Fachspalte ohne Kommentar ist.
