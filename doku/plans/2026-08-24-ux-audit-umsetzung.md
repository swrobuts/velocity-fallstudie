# Umsetzung des UX-Audits vom 24.08.2026

Grundlage: `velocity-ux-audit-2026-08-24.md` (Prüfung von außen).
Jeder Punkt wurde vor der Umsetzung **nachgemessen** und danach **erneut
gemessen** — nicht übernommen und nicht behauptet.

Automatische Gegenprobe: `python3 tools/ux_check.py`, seit dem 24.08.2026
als Prüfung 12 in `tools/abnahme.sh`.

## Ausgangslage — was die Messung bestätigte

| Behauptung des Audits | Messung vorher | Urteil |
|---|---|---|
| 45 Marker ohne Namen | 58 Marker, 13 mit `title`, **45 ohne** | bestätigt |
| 97 fokussierbare Elemente | 97 | bestätigt |
| 4 tote Rechtsverweise | 4 × `href="#"` | bestätigt |
| H1 ohne Wortabstand | `textContent` = „Würzburg hatviele Berge." | bestätigt |
| Feld max 1440, Regler max 240 | bestätigt | bestätigt |
| Kein `role="dialog"`, kein `aria-modal` | 0 Treffer | bestätigt |
| Kein `scroll-margin-top` | 0 Treffer | bestätigt |
| Ein `autocomplete` im Formular | 1 | bestätigt |
| Keine Navigation bis 900 px | `.site-nav { display: none }` ohne Ersatz | bestätigt |
| Mobile Bühne ~2970 px | 2970 px = 3,5 Bildschirme | bestätigt |
| E-Bike 16,00 € statt 4,00 € | DB: 1,00 + 30 × 0,50 = 16,00 | **kein Datenfehler** |

## Ergebnis

### P1 — vor der nächsten Demo

- ☑ **P1-01** Menü unter 1024 px, „Live-Karte" bis 620 px als eigene
  Schaltfläche, darunter im Menü. Gemessen bei 390 px: Menüknopf sichtbar,
  Escape schließt, vier Ziele.
- ☑ **P1-02** Knopf heißt „E-Cargo Loader auf der Karte zeigen", setzt den
  Filter auf `cargo`, springt zur Karte (Abstand 88 px bei 74 px Kopf) und
  fokussiert „Was gerade frei ist".
- ☑ **P1-03** Registrierung endet in einem bleibenden Zustand im Dialog;
  Formular während der Anfrage gesperrt; `EMAIL_CONFIRMATION_REQUIRED`
  führt zu „Konto angelegt … Bestätigung geschickt" samt Weg zur Anmeldung.
- ✎ **P1-04** Der Preis war richtig, das Bezugsdokument veraltet. `TESTEN.md`
  nachgezogen **und** die drei Sollpreise als Test hinterlegt
  (`test_v_tarifkarte_rechnet`). Überschrift jetzt „ein einfaches Prinzip".
- ☑ **P1-05** `src/rechtliches.html` mit Impressum, Datenschutz, AGB und
  Widerruf. Kein `href="#"` mehr im Dokument. Der Prototypstatus steht
  oben auf der Seite, nicht im Kleingedruckten.
- ☑ **P1-06** `role="dialog"`, `aria-modal`, `aria-labelledby`; Fokus beim
  Öffnen auf `login-email`, Fokusfalle, Escape schließt, Fokus kehrt auf
  `user-nav-btn` zurück, `body` steht still. Reiter sind Schaltflächen mit
  Pfeiltasten.
- ☑ **P1-07** Freie Räder erscheinen erst, wenn der Rahmen sie trägt
  (≥ 700 px) oder ab Zoom 14,5. Bei 390 px: 13 Stationen, 0 Einzelräder.
  Bei 1280 px: 13 + 45.
- ☑ **P1-08** Kein Marker ohne Namen (390 px und 1280 px gemessen).
  Fokussierbare Elemente 97 → 49 (Desktop) bzw. 47 (Mobil).

### P2 — wichtig

- ☑ **P2-01** Feld und Regler beide 1–1440. Sprungmarken 15 Min / 30 Min /
  2 Std / 1 Tag als 2×2.
- ☑ **P2-02** 0, −5 und 9999 werden sichtbar auf 1 bzw. 1440 gesetzt, mit
  Begründung unter dem Feld. Feld und Regler zeigten in allen sechs
  Proben denselben Wert.
- ☑ **P2-03** `scroll-margin-top` 108 px (88 px mobil) und Fokus auf die
  Zielüberschrift. Zusätzlich abgesichert gegen ein fehlendes
  `requestAnimationFrame` — sanftes Scrollen bleibt sonst einfach stehen.
- ☑ **P2-04** Bühne mobil 2970 px → 1561 px (1,85 Bildschirme), CTA
  „Räder in deiner Nähe" im ersten Bildschirm.
- ✎ **P2-05** Schärfer als gemeldet: die drei Schweinfurter Stationen lagen
  **außerhalb jedes Geschäftsgebiets**. Zweites Gebiet angelegt, Karte
  zeichnet beide, Grenze umfasst beide, Schaltfläche „Ganzes Netz".
  Kopfzeile nennt „Würzburg & Schweinfurt".
- ☑ **P2-06** `textContent` jetzt „Würzburg hat viele Berge." usw.
- ☑ **P2-07** „City-Bike an der Station Marktplatz leihen"; Schließen heißt
  „Infofenster schließen".
- ☑ **P2-08** „Station auswählen, Fahrradtyp prüfen und die Ausleihe starten
  — für die Ausleihe selbst brauchst du ein Konto."
- ☑ **P2-09** Entwicklertext ersetzt.
- ☑ **P2-10** Sechs `autocomplete`-Werte, Passwort zeigen, Passwort
  zurücksetzen über `resetPasswordForEmail`.
- ☑ **P2-11** Produktwahl ist ein Umschalter (`role="group"`,
  `aria-pressed`), kein halbes Tab-Muster.
- ☑ **P2-12** Statuszeile unter der Karte: „30 Räder sichtbar an 10
  Stationen, gefiltert nach E-Cargo Loader."

### P3 — Feinschliff

- ☑ **P3-01** Kurze Fassung der Metazeile unter 520 px.
- ✗ **P3-02** Produkt-Silhouetten in den Tarifkarten. **Nicht umgesetzt** —
  die Ansage lautete „keine blöden Icons, es muss hochwertig sein". Der
  Unterschied zwischen den Typen wird über Preis, Merkmale und die Bilder
  im Kartenpopover getragen.
- ☑ **P3-03** „Station — die Zahl nennt die freien Räder".
- ☑ **P3-04** Fußmarke 11 px / 45 % → 13 px / 72 %.
- ✎ **P3-05** Auf dem Desktop bleibt der Login die auffällige Aktion — das
  ist eine Markenentscheidung an der eigenen Gestaltung, keine Fehlleistung.
  Auf schmalen Geräten, wo der Platz zur Wahl zwingt, hat die Karte Vorrang
  (Kopfzeile bis 620 px, darunter der CTA in der Bühne).
- ☑ **P3-06** „293 Räder frei · gerade eben", danach „vor X Min.".

## Was der Prüfer nicht entscheiden kann

- Registrierung gegen den echten Dienst durchspielen — dazu ist eine
  Passworteingabe nötig, die ich nicht vornehme.
- Bildschirmleser auf Karte und Dialog.
- Der optische Gesamteindruck.

## Nebenbefunde aus dieser Runde

- `tools/frontend_check.py` meldete `rechtliches.html#agb` als fehlende
  Datei: der Sprungpunkt wurde nicht abgeschnitten. Behoben.
- Ein pgTAP-Test schrieb den Schweinfurt-Fehler fest, statt ihn zu melden
  (*„Schweinfurt liegt außerhalb"*). Berichtigt und um die Gegenrichtung
  ergänzt.
