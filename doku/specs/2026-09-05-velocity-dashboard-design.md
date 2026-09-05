# Persönliches Dashboard für die Kundenwebsite — Entwurf

**Stand 05.09.2026.** Schritt 1 von zwei: Zugang und Kennzahlen mit einem
lauffähigen Dashboard. Badges und der Feinschliff der Gestaltung sind
Schritt 2 und stehen am Ende dieses Dokuments unter „Was nicht dazugehört".

---

## 1 Ziel

Ein angemeldeter Kunde sieht auf `bikes.butscher.cloud` seine eigene
Nutzung: Fahrten, Kilometer, eingespartes CO₂, Ausgaben, den Verlauf über
die Monate und seine Einordnung in der Flotte. Studierende kommen ohne
Mail-Registrierung hinein, über einen Knopf.

Der Bereich ist **erst nach Anmeldung** sichtbar. Ohne Anmeldung bleibt die
Seite, wie sie ist.

## 2 Was schon da ist

Nachgemessen am 05.09.2026, nicht erinnert:

| | |
|---|---|
| Ausleihen im Bestand | 12 274, davon 7 223 mit gemessener Distanz (59 %) |
| Zeitraum | 05.01.2025 bis 03.09.2026, also 20 Monate |
| Kunden mit mindestens einer Fahrt | 495 von 1 014 |
| Fahrten je Kunde | min 11, Durchschnitt 24,8, max 49 |
| Konto des Dozenten | `K-000013 Robert Butscher`, 44 Fahrten, 8 Rechnungen |
| Kundensichten | `v_meine_ausleihe`, `v_meine_rechnung`, `v_mein_profil` in `0010_sichten.sql`, gefiltert über `where k.auth_uid = auth.uid()` |
| Kilometer und CO₂ | gerechnet in `v_wawi_km_co2` (`0018_wawi_sichten.sql`), Annahmen in `velocity.rechenannahme` |

**Es müssen keine Daten erzeugt werden.** Der Auftrag sprach von
„Auswertungen auf Basis generierter Daten" — die generierten Daten sind der
vorhandene Lehrdatensatz. Beide Konten bekommen echte Historie aus diesem
Bestand; neue Fahrten anzulegen wäre eine zweite Datenquelle neben der
ersten.

### Die vorhandene Kilometerherleitung

Sie steht heute inline in `v_wawi_km_co2` und ist dreistufig:

1. `a.distanz_km`, wenn gemessen
2. sonst Luftlinie zwischen Start- und Endpunkt × `umwegfaktor` (1,25)
3. ist die Luftlinie null — Rundfahrt, gleicher Start- und Endpunkt —,
   stattdessen `dauer_minuten / 60 × reisegeschwindigkeit` (13 km/h)

Dazu `ist_geschaetzt = (a.distanz_km is null)`. Die CO₂-Ersparnis ist
`kilometer × (co2_pkw − co2_eigen)`, mit `co2_pkw` = 140 g/Pkm und
`co2_eigen` = 5 g/Pkm für CITY, 12 g/Pkm sonst — alle vier Werte aus
`rechenannahme`, mit Gültigkeitszeitraum und Quellenangabe
(Umweltbundesamt, Stand 2024).

**Diese Rechnung wird nicht neu geschrieben, sondern verschoben.**

## 3 Datenmodell

### 3.1 Die Basissicht `velocity.v_fahrt_kennzahl`

Eine Zeile je abgeschlossener Ausleihe. Sie trägt die Herleitung aus 2.1
unverändert und liegt in **`0010_sichten.sql`** — vor `0018`, weil
`v_wawi_km_co2` sie lesen wird und eine Sicht nur lesen kann, was zum
Zeitpunkt ihrer Anlage existiert.

```
ausleihe_id      bigint     Schlüssel der Fahrt
kunde_id         bigint     für die Kundensichten und den Rang
fahrrad_id       bigint
typ_code         text       CITY, EBIKE, CARGO
startzeit        timestamptz
endzeit          timestamptz
dauer_minuten    integer
km               numeric    dreistufig hergeleitet, siehe 2.1
ist_geschaetzt   boolean    wahr, wenn distanz_km fehlte
co2_ersparnis_g  numeric    km × (co2_pkw − co2_eigen)
betrag_brutto    numeric    Summe der Entgeltpositionen dieser Fahrt
```

Nur abgeschlossene Fahrten, wie bisher (`status = 'abgeschlossen'`).

**Kein `grant select` für `authenticated`.** Die Sicht führt die Fahrten
aller Kundschaft. Sie wird ausschließlich mittelbar gelesen, über die
Sichten darüber; die gehören `postgres` und laufen mit dessen Rechten.

### 3.2 `v_wawi_km_co2` liest künftig daraus

In `0018_wawi_sichten.sql`. Die Rollenschranke
(`hat_rolle('leitung') or hat_rolle('demo')`) und die Ausgabespalten
bleiben unverändert; nur die Herleitung fällt weg und wird zur Abfrage auf
`v_fahrt_kennzahl`. Die Sicht schrumpft von rund 25 auf etwa 10 Zeilen.

**Die Zahlen müssen exakt dieselben bleiben.** Dafür die Zusicherung in 7.1.

### 3.3 Drei Kundensichten

Alle in `0010_sichten.sql`, alle mit `where k.auth_uid = auth.uid()` wie die
bestehenden, alle mit `grant select … to authenticated`.

**`v_meine_fahrt_kennzahl`** — je Fahrt. Spalten von `v_fahrt_kennzahl`
plus `rahmennummer`, `typ_bezeichnung`, `start_station`, `end_station`. Das
ist die Ebene, auf die das Dashboard aufklappt.

**`v_meine_monatsbilanz`** — je Monat:

```
monat            date       erster Tag des Monats
fahrten          integer
minuten          integer
km               numeric
co2_ersparnis_kg numeric
ausgaben_brutto  numeric
anteil_geschaetzt numeric   0 bis 1
```

**`v_meine_bilanz`** — genau eine Zeile:

```
fahrten_gesamt, minuten_gesamt, km_gesamt, co2_ersparnis_kg_gesamt,
ausgaben_gesamt, erste_fahrt, letzte_fahrt,
rang_km, kunden_gewertet, perzentil,
median_km_flotte, bestwert_km_flotte, anteil_geschaetzt
```

### 3.4 Wie der Rang funktioniert, ohne jemanden preiszugeben

`v_meine_bilanz` rechnet `rank() over (order by km_gesamt desc)` in einer
Unterabfrage über **alle gewerteten Kunden** und gibt danach **nur die
eigene Zeile** heraus. Nach außen gehen ausschließlich Zahlen:

```
rang_km = 45   kunden_gewertet = 495   perzentil = 90.9
median_km_flotte = 70.3                bestwert_km_flotte = 168.7
```

Kein Name, keine Kundennummer, keine fremde Zeile. Median und Bestwert sind
Kennzahlen der Flotte, keine Personen — dieselbe Unterscheidung, mit der
`v_wawi_umsatz_kundengruppe` seit Bereich K auskommt.

**Gewertet wird, wer mindestens eine abgeschlossene Fahrt hat**: 495, nicht
1 014. Ein Rang unter Konten ohne jede Fahrt wäre keine Einordnung.

**Bekannte Eigenschaft, kein Fehler:** Beide vorgesehenen Konten liegen im
oberen Zehntel — `K-000013` auf Platz 45, `K-000001` auf Platz 15 von 495.
Das Ranking schmeichelt also, statt zu relativieren. Wer im Unterricht den
umgekehrten Fall zeigen will, meldet sich mit einem anderen Kundensatz an.

## 4 Demozugang

**Konto:** `demo@bikes.invalid`, Kennwort `demodemo`. Die Endung `.invalid`
ist nach RFC 2606 reserviert und löst nie auf — dorthin kann keine
Bestätigungsmail gehen, deshalb **„Auto Confirm User" beim Anlegen**.
Dieselbe Machart wie `agent@wawi.invalid` und `demo@wawi.invalid`; die
Endung sagt zugleich, zu welcher Anwendung ein Konto gehört.

**Kundensatz:** `K-000001`, umbenannt auf **Clara Fake**. 30 Fahrten, alle
drei Radtypen, 12 Monate, 9 Rechnungen, 05.01.2025 bis 24.08.2026.
Ausgewählt aus 495 Kandidaten nach: alle drei Radtypen, mindestens zwölf
Monate mit Fahrten, mindestens sechs Rechnungen, noch kein Anmeldekonto.

Der Satz hieß bisher „Max Mustermann" — und **genau so heißt im Impressum
und im Fußbereich der Geschäftsführer der VeloCity GmbH**
(`src/rechtliches.html`, `src/index.html`). Ein Demokunde desselben Namens
hätte zwei verschiedene Rollen unter einem Namen geführt. Die Umbenennung
löst diese Doppelung auf; der neue Name sagt zugleich von selbst, dass die
Person erfunden ist.

**Die Adresse des Satzes wird `demo@bikes.invalid`** — dieselbe, mit der man
sich anmeldet. Das ist keine Setzung, sondern die vorhandene Regel:
`K-000013` ist heute das einzige verknüpfte Konto, und dort sind Kundenmail
und Anmeldemail identisch. `kunde.email` ist eindeutig, die Adresse ist frei.

Die naheliegende Alternative wäre schlechter gewesen. Die Kundschaft trägt
**echte Maildomänen** — gmail.com 326-mal, icloud.com 198-mal, outlook.com
190-mal; `max.mustermann@email.de` ist einer von sieben Ausreißern. Eine
erfundene Person unter einer erreichbaren Adresse zu führen, heißt, ein
fremdes Postfach zu benennen.

**Die Umbenennung ändert einen Bestandssatz.** `K-000001` trägt heute
„Max Mustermann"; nach dem Lauf von `demokonto_website.sql` heißt der Satz
„Clara Fake". Der Änderungstrigger auf `kunde` schreibt das mit, die alten
Werte stehen also im Änderungsprotokoll. Das ist beabsichtigt und zugleich
ein brauchbares Beispiel für Bereich K.

**`db/betrieb/demokonto_website.sql`** verknüpft `kunde.auth_uid` mit dem
Konto, dieselbe Machart wie `mitarbeiter_agentenkonto.sql`. Idempotent, mit
Gegenprobe am Ende.

**Der Knopf.** Auf der Anmeldemaske: „Demo ansehen". Er meldet mit den
Werten aus `WEB_CONFIG.demoEmail` und `WEB_CONFIG.demoPasswort` an.
Darunter ein Hinweis, der **aus denselben Werten erzeugt** wird:

> Zum Ausprobieren: Anmeldung „demo@bikes.invalid", Kennwort „demodemo".

Damit steht das Kennwort an genau einer Stelle. Die Warenwirtschaft führt
es heute in sechs Sprachen einzeln — beim nächsten Wechsel sind das sechs
Änderungen; dieser Weg braucht eine.

**Fehlt eines der beiden Felder, erscheinen weder Knopf noch Hinweis.**
Kein halb funktionierender Zugang, keine Fehlermeldung an einer Stelle, an
der ein Besucher nichts damit anfangen kann.

**Die Werte trägt der Betreiber ein**, nicht dieses Projekt: Zugangsdaten
gehören nicht ins Repository geschrieben, auch absichtlich öffentliche
nicht. `src/config.js` bekommt die beiden Felder leer.

## 5 Oberfläche

**Eigene Datei `src/dashboard.js`.** `src/script.js` hat 2 618 Zeilen und
soll nicht die 2 900 haben. Ein neuer Abschnitt in `src/index.html`,
sichtbar nur angemeldet, erreichbar über den bestehenden Kontobereich.

**Gezeichnet wird mit Inline-SVG, ohne Bibliothek.** Die Website lädt heute
keine externe Bibliothek und soll damit nicht anfangen.

Aufbau von oben nach unten. Vorbild sind die Gesundheits-Apps, und das
heißt vor allem: **eine Aussage je Block, die Zahl vor der Erklärung.**

| Block | Inhalt |
|---|---|
| **Ringe** | drei konzentrische Ringe für den laufenden Monat — Fahrten, Kilometer, Minuten, je gegen den eigenen Monatsdurchschnitt |
| **Bilanz** | vier große Zahlen: km gesamt, CO₂ gespart, Fahrten, Ausgaben |
| **Verlauf** | Balken je Monat über den ganzen Zeitraum, umschaltbar zwischen km, Fahrten und Ausgaben |
| **Einordnung** | „Platz 45 von 495" mit Perzentilbalken, Median und Bestwert als Markierungen |
| **Letzte Fahrten** | fünf Zeilen aus `v_meine_fahrt_kennzahl` mit Rad, Strecke und Betrag |

**Geschätzte Werte werden gekennzeichnet.** 41 % der Fahrten haben keine
gemessene Distanz. Ein Ring, der eine Schätzung als Messung ausgibt, ist
der Punkt, an dem ein solches Dashboard unglaubwürdig wird —
`anteil_geschaetzt` steht deshalb sichtbar am Kilometerblock.

**Was das Dashboard nicht tut:** Es rechnet nicht. Jede angezeigte Zahl
kommt aus einer Sicht. Eine Kennzahl, die nur im JavaScript entsteht, wäre
von keinem Test erreichbar.

### 5.1 Das Konterfei

Über den Ringen steht, wer angemeldet ist: ein rundes Bild mit Namen
daneben — der Anker, der ein Dashboard persönlich macht statt bloß
statistisch.

**Ein Monogramm, kein Foto.** Gezeichnet als Inline-SVG: die Initialen auf
einer Scheibe, deren Farbton aus der Kundennummer abgeleitet wird, dazu ein
Ring in der Hausfarbe. Für Clara Fake also „CF", für das Konto des
Dozenten „RB" — **abgeleitet, nicht hinterlegt**: Es gibt keine Bilddatei,
keinen Upload, keine Spalte und nichts zu pflegen. Jedes Konto hat sofort
eines, auch ein morgen angelegtes.

Warum kein Foto: Ein Gesicht unter einer erfundenen Identität ist keine
Illustration, sondern eine Behauptung über einen Menschen. Für eine
Fallstudie mit 1 014 erfundenen Kunden gilt das erst recht. Ein
Monogramm ist zudem das, was Gesundheits- und Bank-Apps ohne hinterlegtes
Bild ohnehin zeigen — es sieht nicht nach Ersatz aus, sondern nach
Absicht.

## 6 Sprachen

Die Website führt Deutsch, Englisch und Portugiesisch. Alle neuen Texte
kommen in alle drei — kein Bereich, der auf Deutsch stehenbleibt.

## 7 Absicherung

### 7.1 Die Umstellungszusicherung

Der Eingriff in `v_wawi_km_co2` ist der einzige riskante Teil. Eine
pgTAP-Funktion hält **die alte Rechnung gegen die neue**: Monat für Monat,
Radtyp für Radtyp, Kilometer und CO₂ auf die Nachkommastelle. Die
Vergleichswerte werden vor dem Umbau eingefroren und liegen als Fixtur im
Test. Läuft die Umstellung auch nur um eine Rundung auseinander, wird sie
rot.

### 7.2 pgTAP für die neuen Sichten

- `v_meine_bilanz` liefert genau eine Zeile, und zwar die des Anmeldenden
- ein zweiter Kunde sieht seine eigene, nicht die des ersten
- `v_fahrt_kennzahl` ist für `authenticated` **nicht** lesbar
- wer mehr Kilometer hat, hat den kleineren Rang
- `kunden_gewertet` zählt nur Kunden mit mindestens einer Fahrt
- Summen über `v_meine_monatsbilanz` stimmen mit `v_meine_bilanz` überein

### 7.3 Weitere Prüfungen

- **`tools/frontend_check.py`** kennt den Vertrag zwischen HTML und
  JavaScript und muss die neuen Kennungen mitprüfen
- **`tools/versionieren.py`** braucht den Fingerabdruck der neuen Datei
- **Abnahme**: keine neue Prüfung nötig. Die Schritte „Datenbanktests",
  „Website spricht nur Sichten und api-Funktionen" und „HTML und
  JavaScript passen zusammen" decken es ab, sobald die Tests stehen.

## 8 Was nicht dazugehört

**Badges sind Schritt 2.** Sie hängen vollständig an den Kennzahlen aus
Abschnitt 3; auf falschen Zahlen wären sie zweimal Arbeit. Erst wenn das
Dashboard läuft und die Zahlen nachweislich stimmen, wird entschieden,
welche Auszeichnungen es gibt und wo sie stehen.

**Keine Bestenliste.** Entschieden am 05.09.2026: nur der eigene Rang. Eine
Liste mit Namen anderer Kunden wäre die erste Stelle, an der die Website
etwas über Dritte preisgibt.

**Keine neuen Fahrten.** Siehe Abschnitt 2.

**Keine Änderung an `bikes.butscher.cloud` ohne Auslieferung.** Der Umbau
ist erst wirksam, wenn `tools/veroeffentlichen.sh` gelaufen ist — das
bleibt eine Entscheidung des Betreibers.

## 9 Offene Punkte

**Dasselbe Kennwort für beide Demozugänge.** `demodemo` trägt künftig den
lesenden WaWi-Zugang und das Kundendashboard. Für zwei absichtlich
öffentliche Demos ist das eher ein Vorteil — eine Zeile im Skript statt
zweier. Wer sie trennen will, ändert einen Wert in `src/config.js`.

**Der laufende Monat ist unvollständig.** Am 5. eines Monats stehen die
Ringe auf einem Bruchteil. Sie vergleichen deshalb gegen den eigenen
Monatsdurchschnitt, nicht gegen ein festes Ziel — sonst zeigte das
Dashboard an jedem Monatsanfang Versagen an.

**Das Kennwort trägt der Betreiber ein**, in `src/config.js`. Ohne diesen
Schritt gibt es den Demozugang nicht.
