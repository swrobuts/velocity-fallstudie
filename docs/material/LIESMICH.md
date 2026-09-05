# Werbematerial

Die Startseite bindet drei Dateien aus diesem Ordner ein. Die Namen sind fest
verdrahtet — wer umbenennt, muss auch `index.html` anfassen.

| Erwarteter Name | Stand |
|---|---|
| `velocity-reel.mp4` | vorhanden, aber **ersetzen**: hier liegt die im Chat erzeugte 15-Sekunden-Fassung, nicht Ihre v8 |
| `velocity-banner.png` | **fehlt** — bitte hinzufügen |
| `velocity-flyer.pdf` | vorhanden |

## Ersetzen

```bash
cp "/Users/robert/Library/CloudStorage/OneDrive-Persönlich/Vorlesungen/Wintersemester/Wintersemester_2026/velocity-instagram-reel-v8.mp4" \
   material/velocity-reel.mp4

cp "/Users/robert/Desktop/velocity-instagram-banner.png" \
   material/velocity-banner.png
```

Solange der Banner fehlt, zeigt der Videoplayer kein Vorschaubild — abspielen lässt
sich das Reel trotzdem. Kaputt geht nichts.

## Größe

GitHub warnt ab 50 MB je Datei und weist über 100 MB ab. Falls Ihre v8 darüber liegt:

```bash
ffmpeg -i velocity-reel.mp4 -c:v libx264 -crf 26 -preset slow \
       -pix_fmt yuv420p -movflags +faststart reel-web.mp4
```

Die beiliegende Fassung liegt bei rund 0,5 MB.
