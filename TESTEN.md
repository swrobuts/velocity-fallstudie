# Wie du alles testest

## In einem Befehl

```bash
cd ".../BikesRental/Web/.worktrees/velocity-datenmodell" && bash tools/abnahme.sh
```

Neun Prüfungen, jede meldet ✓ oder ✗. Das Skript läuft immer bis zum Ende
durch — du bekommst das vollständige Bild und nicht nur den ersten Fehler.
Rückgabewert 0, wenn alles besteht.

| # | Prüfung | Was sie belegt |
|---|---|---|
| 1 | Zugangsdaten | `.env` ist vollständig |
| 2 | Aufbaukette zweimal | 12 SQL-Dateien laufen, und sie sind idempotent |
| 3 | Datenbanktests | 51 pgTAP-Testfunktionen, darunter neun zur Preisfindung |
| 4 | Zugriffsschutz | 13 Ressourcen gesperrt, 7 Sichten öffentlich — über HTTP geprüft |
| 5 | Altschema | Der anon-Key kommt nicht mehr an die Altdaten |
| 6 | Abgleichsbericht | Übernahme vollständig, Beträge stimmen auf den Cent |
| 7 | Diagramme | 17 Mermaid-Quellen validieren |
| 8 | Website | Nur `v_`-Sichten und `api_`-Funktionen, Syntax in Ordnung |
| 9 | Foliendeck | 43 Folien ohne Layoutbefund |

## Einzeln, wenn etwas rot ist

```bash
python3 db/run.py db/aufbau/*.sql          # Aufbaukette
python3 db/test.py                          # alle Datenbanktests
python3 db/test.py db/tests/t0009_preisfindung.sql   # nur die Preisfindung
python3 tools/rest_security_check.py        # Zugriffsschutz von außen
node tools/mermaid_check.mjs doku/datenmodell/erd/*.mmd
python3 slides/check_deck.py slides/velocity-datenbankentwurf.pptx
```

## Was du selbst durchklicken musst

Registrierung, Anmeldung und eine echte Ausleihe kann ich nicht prüfen: dafür
müsste ein Benutzerkonto angelegt und ein Passwort eingegeben werden.

```bash
python3 -m http.server 8765 --directory src
```

> **Vor jedem Durchgang:** `python3 tools/versionieren.py`. Die Seite
> bindet ihre Dateien mit einem Fingerabdruck ein (`script.js?v=…`).
> Ohne den aktuellen Stempel serviert der Browser alte Fassungen — bei
> einer Prüfung von außen führte genau das zu zwei gemeldeten Fehlern,
> die längst behoben waren.

> **Ausleihe und Abrechnung ohne Klicken:** `python3 db/durchstich.py`
> geht den ganzen Weg für alle drei Fahrradtypen gegen die echte
> Datenbank — unter der Rolle `authenticated`, mit echtem COMMIT, und
> räumt danach hinter sich auf.

Dann auf `http://localhost:8765`:

1. **Abgemeldet ansehen.** Kennzahlenleiste zeigt **13 Stationen**
   (10 in Würzburg, 3 in Schweinfurt), drei Tarifkarten mit
   **3,10 / 16,00 / 5,00 Euro** für 30 Minuten, vier FAQ-Einträge, Karte mit
   Stations- und Fahrradmarkern. Browserkonsole ohne Fehler.

   > Diese drei Beträge sind der Sollwert. Sie stehen seit dem 24.08.2026
   > zusätzlich in `db/tests/t0010_sichten.sql` und fallen dort auf, wenn
   > jemand die Preise ändert, ohne diese Anleitung nachzuziehen. Genau
   > dieser Auseinanderlauf hat eine externe Prüfung zu der Annahme
   > gebracht, 16,00 Euro seien ein Datenfehler.
2. **Zugriffsschutz in der Konsole prüfen:**
   ```javascript
   await supabaseClient.from('kunde').select('*').limit(1)
   ```
   Erwartung: ein Fehlerobjekt, **keine** Daten.
3. **Registrieren** mit einer beliebigen Adresse. Danach:
   ```bash
   python3 -c "import sys; sys.path.insert(0,'db'); from run import verbinde; c=verbinde(); cur=c.cursor(); cur.execute(\"select kunde_id, kundennummer, email, auth_uid is not null from velocity.kunde order by kunde_id desc limit 3\"); [print(r) for r in cur.fetchall()]"
   ```
   Erwartung: neuer Kunde mit Kundennummer `K-######` und gesetzter `auth_uid`.
4. **Fahrt starten** (Rad auf der Karte wählen), Banner mit laufender Zeit
   prüfen, **Fahrt beenden**. Erwartung: Meldung mit Dauer und Betrag.
5. **Abrechnung ansehen:**
   ```bash
   python3 -c "import sys; sys.path.insert(0,'db'); from run import verbinde; c=verbinde(); cur=c.cursor(); cur.execute('''select ea.code, p.menge, p.einzelbetrag, p.betrag from velocity.ausleihe a join velocity.entgeltposition p on p.ausleihe_id=a.ausleihe_id join velocity.entgeltart ea on ea.entgeltart_id=p.entgeltart_id where a.ausleihe_id=(select max(ausleihe_id) from velocity.ausleihe) order by p.sortierung'''); [print(r) for r in cur.fetchall()]"
   ```
   Erwartung: `STARTGEBUEHR` und `ZEITENTGELT`; die Summe entspricht dem in
   der Oberfläche angezeigten Betrag.

**Hinweis:** `auth.users` ist derzeit leer — es existiert kein einziges Konto.
Schritt 3 legt also das erste an.

## Wenn du etwas geändert hast

| Geändert | Danach |
|---|---|
| SQL unter `db/aufbau/` | `python3 db/run.py db/aufbau/*.sql && python3 db/test.py` |
| Ein Diagramm (`.mmd`) | `bash tools/render_diagrams.sh && python3 slides/build_deck.py` |
| Eine Folie | `python3 slides/build_deck.py && python3 slides/check_deck.py slides/velocity-datenbankentwurf.pptx` |
| Etwas an `src/` | Seite neu laden, Konsole prüfen |

Das Foliendeck wird **nicht von Hand bearbeitet**: Änderungen gehören in
`slides/build_deck.py`, sonst gehen sie beim nächsten Lauf verloren.
