# VeloCity Würzburg — Lehrfallbeispiel

Ein erfundenes Leihradsystem mit einer echten Warenwirtschaft. Grundlage für Übungen
in Datenmodellierung, SQL und Business Intelligence an der THWS Business School.

**Live:** <https://swrobuts.github.io/velocity-fallstudie/>

## Inhalt

| Datei | Was es ist |
|---|---|
| `index.html` | Startseite, verlinkt die übrigen Seiten |
| `datenmodell.html` | Interaktive Modelldokumentation — Einstieg und technische Referenz |
| `cockpit.html` | Netzcockpit: Kennzahlen, Karte, Standortvorschläge |
| `config.example.js` | Vorlage für die Datenbankverbindung des Cockpits |
| — | Der Kurszugang steht jetzt im Repository unter `db/betrieb/`: `studizugang_lesend.sql` und `lehrzugang.sql` |
| `material/velocity-reel.mp4` | Instagram-Reel, 9:16, 15 Sekunden |
| `material/velocity-banner.png` | Banner, zugleich Vorschaubild des Reels |
| `material/velocity-flyer.pdf` | Flyer A5, zweiseitig |

Alle Seiten sind einzelne HTML-Dateien ohne Bauschritt. Externe Abhängigkeiten sind
Leaflet und Mermaid, beide über CDN.

## Werbematerial einsortieren

Die Startseite erwartet die Mediendateien unter `material/` und genau unter diesen
Namen — sonst bleiben Videofeld und Vorschaubild leer.

```bash
mkdir -p material

cp "/Users/robert/Library/CloudStorage/OneDrive-Persönlich/Vorlesungen/Wintersemester/Wintersemester_2026/velocity-instagram-reel-v8.mp4" \
   material/velocity-reel.mp4

cp "/Users/robert/Desktop/velocity-instagram-banner.png" \
   material/velocity-banner.png

cp ~/Downloads/velocity-flyer.pdf material/velocity-flyer.pdf
```

**Zur Dateigröße:** GitHub warnt ab 50 MB je Datei und weist über 100 MB ab. Falls
das Reel darüber liegt, hilft entweder eine stärkere Kompression

```bash
ffmpeg -i material/velocity-reel.mp4 -c:v libx264 -crf 26 -preset slow \
       -pix_fmt yuv420p -movflags +faststart material/reel-web.mp4
```

oder Git LFS. GitHub Pages ist kein Videohoster; für ein 15-Sekunden-Reel geht es,
für mehr würde ich auf eine eigene Auslieferung ausweichen.

## Deployment über GitHub Pages

```bash
git clone https://github.com/<benutzername>/velocity-fallbeispiel.git
cd velocity-fallbeispiel

# Dateien aus dem Download hierher kopieren, dabei umbenennen:
#   wawi-datenmodell.html  ->  datenmodell.html
#   velocity-cockpit.html  ->  cockpit.html

git add .
git commit -m "Lehrmaterial VeloCity: Datenmodell, Cockpit, Kurszugang"
git push
```

Danach im Repo unter **Settings → Pages**: Source auf *Deploy from a branch*,
Branch `main`, Ordner `/ (root)`. Nach ein bis zwei Minuten ist die Seite erreichbar.

## Wichtig vor dem ersten Push

`config.js` gehört **nicht** ins Repository. Die Datei enthält die Verbindungsdaten
zur Datenbank; in einem öffentlichen Repo wäre der Schlüssel für jeden lesbar.
Eingecheckt wird nur `config.example.js`. Die `.gitignore` deckt das ab — prüfen Sie
vor dem ersten Commit trotzdem mit `git status`, dass keine `config.js` mitläuft.

Ohne `config.js` läuft das Cockpit aus seinem eingebetteten Snapshot. Für eine
öffentliche Seite ist das ohnehin die richtige Betriebsart: Die Datenbank bleibt
dann außen vor.

## Datenstand

Snapshot vom 5. September 2026. Die Erfassung in der Warenwirtschaft endet am
24. August 2026; Kilometer und CO₂ beruhen zu rund 40 Prozent auf Schätzungen.
Beides ist in den Seiten selbst vermerkt.

Das Datenmodell ist aus den zwanzig `v_wawi_*`-Sichten erschlossen, nicht aus dem
Systemkatalog gelesen. Vier Tabellen — `tarif`, `mitgliedschaft`, `radtyp`,
`mitarbeiter` — sind als unbelegt gekennzeichnet.

Alle Personen in den Daten sind erfunden.


---

## Zur Herkunft dieses Ordners

Der Inhalt kam am 05.09.2026 aus  und lag kurz in
einem eigenen Repository. Er ist hier eingegliedert; zwei Repositorien für
eine Fallstudie waren nach drei Wochen nicht mehr auseinanderzuhalten.

Was im Ordner **fehlt** und warum, sowie die Abgrenzung zwischen 
(öffentlich) und  (intern), steht in  daneben.
