#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Erzeugt doku/datenmodell/06-data-dictionary.md aus velocity.v_data_dictionary.

Die Beschreibungen stehen als COMMENT am Objekt in der Datenbank und werden
in db/aufbau/0012_dokumentation.sql gepflegt. Damit gibt es genau eine
Quelle: wer eine Spalte kommentiert, bekommt den Eintrag hier geschenkt.

    python3 db/run.py db/aufbau/0012_dokumentation.sql   # Kommentare setzen
    python3 tools/data_dictionary.py                     # Dokument erzeugen
"""
import sys
from collections import OrderedDict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "db"))
from run import verbinde  # noqa: E402

ZIEL = Path(__file__).resolve().parent.parent / "doku" / "datenmodell" / "06-data-dictionary.md"

KOPF = """# Data Dictionary — Schema `velocity`

Erzeugt aus dem Systemkatalog über `velocity.v_data_dictionary`.
**Nicht von Hand pflegen** — bei Änderungen neu erzeugen:

```bash
python3 db/run.py db/aufbau/0012_dokumentation.sql
python3 tools/data_dictionary.py
```

Die technischen Audit-Spalten `erstellt_am` und `geaendert_am` tragen
bewusst keine Beschreibung: sie bedeuten in jeder Tabelle dasselbe und
werden vom Trigger `trg_<tabelle>_audit` gepflegt. Sie sind die einzigen
Spalten ohne Kommentar; der Test `test_doku_vollstaendig` erzwingt für
alle übrigen einen.
"""


def zelle(wert):
    """Pipe-Zeichen wuerden die Tabelle sprengen."""
    return "" if wert is None else str(wert).replace("|", "\\|")


def main():
    cur = verbinde().cursor()
    cur.execute(
        """select objekt_art, tabelle, spalte, datentyp, nullbar, vorgabe,
                  beschreibung, tabellenbeschreibung
             from velocity.v_data_dictionary
            order by objekt_art desc, tabelle, position"""
    )
    objekte = OrderedDict()
    for art, tab, sp, typ, nullbar, vorgabe, besch, tabbesch in cur.fetchall():
        objekte.setdefault((tab, art, tabbesch), []).append(
            (sp, typ, nullbar, vorgabe, besch)
        )

    teile = [KOPF]
    for (tab, art, tabbesch), spalten in objekte.items():
        teile.append(f"\n## `{tab}` ({art})\n")
        if tabbesch:
            teile.append(f"\n{tabbesch}\n")
        teile.append("\n| Spalte | Datentyp | NULL | Vorgabe | Beschreibung |")
        teile.append("\n|---|---|---|---|---|\n")
        for sp, typ, nullbar, vorgabe, besch in spalten:
            v = f"`{zelle(vorgabe)}`" if vorgabe else ""
            teile.append(
                f"| `{sp}` | `{zelle(typ)}` | {'ja' if nullbar else 'nein'} | "
                f"{v} | {zelle(besch)} |\n"
            )

    ZIEL.write_text("".join(teile), encoding="utf-8")
    spaltenzahl = sum(len(v) for v in objekte.values())
    print(f"{ZIEL.relative_to(Path.cwd())}: {len(objekte)} Objekte, {spaltenzahl} Spalten")


if __name__ == "__main__":
    main()
