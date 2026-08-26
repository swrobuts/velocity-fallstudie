# Verifikationsprotokoll — Umstellung der Website auf Schema `velocity`

**Datum:** 23.08.2026 · **Stand:** Branch `feature/velocity-datenmodell`
**Umgebung:** `python3 -m http.server 8765 --directory src`, Supabase auf `supabase.butscher.cloud`

Belege sind DOM-Auswertungen und Konsolenausgaben aus dem laufenden
Browser, nicht Bildschirmfotos: sie sind maschinell erhoben, exakt
zitierbar und lassen sich jederzeit wiederholen.

> **Dies ist eine Aufzeichnung, kein Sollwert.** Die Zahlen unten sind
> der Zustand vom 23.08.2026 und stimmen absichtlich nicht mehr mit
> heute überein — Schweinfurt ist seit dem 25.08. ausgegliedert (13 → 10
> Stationen, 293 → 221 Räder), und die Minutenpreise wurden neu
> gestaffelt (3,10 / 4,00 / 5,00 → 3,10 / 8,50 / 17,00 Euro für 30
> Minuten). Ein Protokoll wird nicht rückwirkend geändert; wer die
> aktuellen Erwartungen sucht, findet sie in `TESTEN.md`. Die
> Schrittfolge selbst — was man in welcher Reihenfolge prüft — gilt
> unverändert, und darauf verweist auch `tools/abnahme.sh`.

## 1 Öffentliche Ansicht, abgemeldet

| Prüfpunkt | Erwartung | Ergebnis |
|---|---|---|
| Kennzahlenleiste aus `v_kennzahl` | vier Kacheln, Stationszahl berechnet | `13 Stationen`, `24/7 Verfuegbarkeit`, `100% Oekostrom`, `0 Euro Anmeldegebuehr` — **bestanden** |
| Nutzungsschritte aus `v_nutzungsschritt` | drei Karten | `App laden und finden`, `Scannen und losfahren`, `Parken und beenden` — **bestanden** |
| Tarifkarten aus `v_tarifkarte` | drei Karten, Preise 3,10 / 4,00 / 5,00 Euro, je drei Merkmale | City-Bike `3,10 Euro / 30 Min`, E-Bike Sport `4,00 Euro / 30 Min`, E-Cargo Loader `5,00 Euro / 30 Min`, je drei Merkmale — **bestanden** |
| FAQ aus `v_faq` | vier Einträge | alle vier, in der hinterlegten Reihenfolge — **bestanden** |
| Karte | Stations- und Fahrradmarker | 13 Stationsmarker, 306 Marker gesamt (13 Stationen + 293 Räder) — **bestanden** |
| Verfügbarkeitszähler | Zahl aus `v_verfuegbares_fahrrad` | `293` — **bestanden** |
| Browserkonsole | keine Fehler | nur `Auth State Changed: INITIAL_SESSION undefined` und `Geladen: 13 Stationen, 293 Fahrraeder` — **bestanden** |

Die Preise sind nicht hinterlegt, sondern gerechnet:
`startgebuehr + 30 × preis_pro_minute` ergibt 0,10 + 3,00 = 3,10 für City,
1,00 + 3,00 = 4,00 für E-Bike, 2,00 + 3,00 = 5,00 für Cargo.

## 2 Zugriffsschutz, aus dem Browser heraus geprüft

Ausgeführt in der Konsole der abgemeldeten Seite über den ausgelieferten
anon-Key:

| Aufruf | Ergebnis |
|---|---|
| `from('kunde')` | `permission denied for table kunde` |
| `from('ausleihe')` | `permission denied for table ausleihe` |
| `from('adresse')` | `permission denied for table adresse` |
| `rpc('fn_ausleihe_beenden')` | `permission denied for function fn_ausleihe_beenden` |
| `from('v_station')` | ok, 1 Zeile |
| `from('v_tarifkarte')` | ok, 1 Zeile |

Der vierte Punkt ist der wichtigste: die **interne** Fachlogik prüft
selbst nicht auf `auth.uid()` — das tut die `api_`-Schicht darüber. Wäre
sie von außen aufrufbar, ließen sich fremde Ausleihen abrechnen. Genau
das ist ausgeschlossen.

Zusätzlich extern über PostgREST, `tools/rest_security_check.py`:
13 gesperrte Ressourcen liefern HTTP 401, 9 öffentliche Sichten
HTTP 200, `0 Abweichung(en)`.

## 3 Nicht von mir geprüft: der angemeldete Ablauf

Registrierung, Anmeldung, Ausleihe starten und beenden sowie die
Abrechnungsanzeige sind **offen**. Grund: dafür müsste ein Benutzerkonto
angelegt und ein Passwort in ein Formular eingegeben werden — beides tue
ich grundsätzlich nicht, auch nicht auf einer Testinstanz.

Erschwerend kommt hinzu, dass `auth.users` auf der Instanz **leer** ist
(siehe Übernahmeprotokoll): es existiert derzeit überhaupt kein Konto,
also auch keines zum Anmelden.

Die dahinterliegende Fachlogik ist dennoch belegt, und zwar gründlicher
als ein Klickdurchlauf es könnte: `db/tests/t0009_preisfindung.sql`
prüft neun Fälle gegen die echte Datenbank, darunter alle fünf
Preiskonstellationen, die Obergrenze von vier gleichzeitigen Ausleihen,
die Abweisung fremder Ausleihen und die Ablehnung anonymer `api_`-Aufrufe.

### Was du selbst durchklicken solltest

```bash
cd ".../BikesRental/Web/.worktrees/velocity-datenmodell"
python3 -m http.server 8765 --directory src
```

Dann auf `http://localhost:8765`:

1. Registrieren mit einer beliebigen Adresse. Erwartung: Anmeldung
   gelingt, oben rechts erscheint der Vorname.
2. Prüfen, dass der Kundensatz angelegt wurde:

```bash
python3 -c "import sys; sys.path.insert(0,'db'); from run import verbinde; c=verbinde(); cur=c.cursor(); cur.execute(\"select kunde_id, kundennummer, email, auth_uid is not null from velocity.kunde order by kunde_id desc limit 3\"); [print(r) for r in cur.fetchall()]"
```

   Erwartung: der neue Kunde mit Kundennummer im Format `K-######` und
   gesetzter `auth_uid`.
3. Auf der Karte ein Rad auswählen und die Fahrt starten. Erwartung:
   Banner mit laufender Zeit.
4. Fahrt beenden. Erwartung: Meldung mit Dauer und Betrag.
5. Die entstandene Abrechnung ansehen:

```bash
python3 -c "import sys; sys.path.insert(0,'db'); from run import verbinde; c=verbinde(); cur=c.cursor(); cur.execute('''select ea.code, p.menge, p.einzelbetrag, p.betrag from velocity.ausleihe a join velocity.entgeltposition p on p.ausleihe_id=a.ausleihe_id join velocity.entgeltart ea on ea.entgeltart_id=p.entgeltart_id where a.ausleihe_id=(select max(ausleihe_id) from velocity.ausleihe) order by p.sortierung'''); [print(r) for r in cur.fetchall()]"
```

   Erwartung: mindestens `STARTGEBUEHR` und `ZEITENTGELT`; die Summe der
   Beträge entspricht dem in der Oberfläche angezeigten Wert.

Melde mir das Ergebnis, dann ergänze ich dieses Protokoll.
