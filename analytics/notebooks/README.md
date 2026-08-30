# VeloCity-Analytics-Notebooks für PITM

Vier Notebooks, eines je Grundverfahren aus dem CRISP-DM-Block (Block 05):

| Notebook | Verfahren | Kernfrage |
|---|---|---|
| `01_Regression_Fahrtdauer.ipynb` | Regression | Wie lange dauert eine Fahrt? |
| `02_Klassifikation_Wartungsrisiko.ipynb` | Klassifikation | Braucht dieses Rad bald Wartung? |
| `03_Clustering_Stationstypen.ipynb` | Clustering | Welche Stationstypen gibt es? |
| `04_Zeitreihe_Nachfrageprognose.ipynb` | Zeitreihe | Wie viele Fahrten kommen morgen? |

## Format

TODO-Übungsformat (wie in BINT E08): Platzhalter-Codezellen (`...`), Kontrollzahlen und
Assertions zur Selbstprüfung, Begründungs-Pflicht in Markdown-Zellen. Jedes Notebook ist
in sich geschlossen und lädt seine Daten selbst — keine Abhängigkeiten zwischen den
Notebooks.

## In Google Colab öffnen

Jedes Notebook lädt seine CSV-Dateien direkt per `pd.read_csv(...)` von einer
`raw.githubusercontent.com`-URL — kein Datei-Upload nötig, kein Google-Drive-Mount.
Colab-Link-Muster für ein Notebook aus diesem Ordner:

```
https://colab.research.google.com/github/swrobuts/velocity-fallstudie/blob/main/analytics/notebooks/<Dateiname>.ipynb
```

Voraussetzung: Dieser Branch muss nach `main` gemergt sein, sonst zeigen die
`raw.githubusercontent.com/.../main/...`-URLs in den Notebooks ins Leere.

## Datenherkunft

Siehe `../README.md` — echte Wetter-/Feiertags-/Veranstaltungsdaten, erfundene, aber
mit verifizierten Mustern angereicherte Betriebsdaten.
