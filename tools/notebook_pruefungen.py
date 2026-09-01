"""Prueft die gebauten Notebooks auf mechanisch erkennbare Fehlerbilder.

Jede Pruefung hier geht auf einen Fehler zurueck, der in einem Review
gefunden wurde. Sie soll ihn beim naechsten Mal vor dem Review finden.

  Nullfuellung      .fillna(0) verdeckt fehlende Werte, statt sie zu melden
  Freie Schwelle    dieselbe Grenze mehrfach als Zahl statt als Konstante
  Sichtbarer Rest   merke() als letzte Zeile druckt seinen Rueckgabewert
  Urteil ohne Zahl  "erfuellt" ohne Fallzahl daneben
  Blinder Abgleich  eine Groesse wird nachgerechnet, die auch gespeichert ist

Aufruf:  python tools/notebook_pruefungen.py
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

BASIS = Path(__file__).resolve().parent.parent
NOTEBOOKS = BASIS / "analytics" / "notebooks"

GRUEN, ROT, GELB, AUS = "\033[0;32m", "\033[0;31m", "\033[0;33m", "\033[0m"

# Spalten, die im Datensatz stehen UND im Notebook nachgerechnet werden koennen.
# Wer sie nachrechnet, muss das Ergebnis einmal gegen die Quelle halten -
# sonst bewertet er seine eigene Formel statt der Wirklichkeit.
# Erkannt wird die FORMEL, nicht der Variablenname: Wer die Preisbestandteile
# aus nutzungspreis.csv verrechnet, baut die Tariflogik nach. Dann muss er das
# Ergebnis gegen die gespeicherte Spalte halten - sonst bewertet er seine
# eigene Formel statt der Wirklichkeit.
NACHGEBAUTE_LOGIK = {
    "entgelt_eur": ("Preisrechnung",
                    ("preis_pro_minute_eur", "startgebuehr_eur",
                     "tageshoechstpreis_eur")),
    "berechnete_minuten": ("Freiminutenabzug", ("freiminuten_pro_monat",)),
}
# Zahlen, die als Schwelle taugen und deshalb einen Namen verdienen.
SCHWELLENVERDACHT = re.compile(r"(?<![\w.])(0\.[5-9]\d?|0\.\d5|[1-9]\d?\.\d0)(?![\w.])")
URTEILSWORTE = ("erfüllt", "erfuellt", "gerissen", "freigegeben", "bestanden",
                "ERFUELLT", "NICHT ERFUELLT")


def zellen(pfad: Path) -> tuple[list, list]:
    nb = json.loads(pfad.read_text(encoding="utf-8"))
    code, ausgaben = [], []
    for z in nb["cells"]:
        text = "".join(z["source"])
        if z["cell_type"] == "code":
            code.append(text)
            ausgaben.append("".join(
                "".join(a.get("text", "")) for a in z.get("outputs", [])))
    return code, ausgaben


def pruefe_nullfuellung(code: list[str]) -> list[str]:
    """fillna(0) ohne vorherige Zusicherung verdeckt Datenluecken."""
    funde = []
    for nummer, quelle in enumerate(code):
        for treffer in re.finditer(r"\.fillna\(\s*0(?:\.0)?\s*\)", quelle):
            davor = quelle[:treffer.start()]
            if "assert" not in davor.split("\n")[-12:][0:1] and "assert" not in "\n".join(
                    davor.split("\n")[-12:]):
                zeile = quelle[:treffer.start()].count("\n") + 1
                funde.append(f"Zelle {nummer}, Zeile {zeile}: fillna(0) ohne "
                             f"vorangehende Zusicherung")
    return funde


def pruefe_sichtbarer_rest(code: list[str]) -> list[str]:
    """merke() als letzte Anweisung druckt seinen Rueckgabewert ins Notebook."""
    funde = []
    for nummer, quelle in enumerate(code):
        zeilen = [z for z in quelle.strip().split("\n") if z.strip()]
        # Nur eine Anweisung auf oberster Ebene druckt ihren Wert. Steht merke()
        # eingerueckt in einer Schleife, sieht man nichts.
        if zeilen and re.match(r"^merke\(", zeilen[-1]):
            funde.append(f"Zelle {nummer}: merke() steht als letzte Anweisung - "
                         f"der Rueckgabewert erscheint als Ausgabe")
    return funde


def pruefe_freie_schwellen(code: list[str]) -> list[str]:
    """Dieselbe Schwelle mehrfach als Zahl: Auswahl und Ueberwachung koennen
    auseinanderlaufen, ohne dass es jemand bemerkt."""
    vorkommen: dict[str, list[int]] = {}
    for nummer, quelle in enumerate(code):
        ohne_text = re.sub(r'(""".*?"""|#[^\n]*)', "", quelle, flags=re.S)
        for treffer in set(SCHWELLENVERDACHT.findall(ohne_text)):
            vorkommen.setdefault(treffer, []).append(nummer)
    funde = []
    for wert, stellen in sorted(vorkommen.items()):
        if len(set(stellen)) >= 3:
            funde.append(f"Die Zahl {wert} steht in {len(set(stellen))} Zellen "
                         f"{sorted(set(stellen))} - als benannte Konstante waere "
                         f"sie an einer Stelle aenderbar")
    return funde


def pruefe_urteil_ohne_zahl(ausgaben: list[str]) -> list[str]:
    """Ein Urteil braucht die Fallzahl daneben, auf der es beruht."""
    funde = []
    for nummer, text in enumerate(ausgaben):
        for zeile in text.split("\n"):
            if not any(w in zeile for w in URTEILSWORTE):
                continue
            # Fliesstext in einer print-Ausgabe ist kein Urteil in einer
            # Ergebnistabelle - er braucht die Fallzahl nicht in derselben Zeile.
            if len(zeile.split()) > 7 or zeile.strip().startswith("("):
                continue
            if not re.search(r"\d{2,}", zeile):
                funde.append(f"Zelle {nummer}: \"{zeile.strip()[:70]}\" - "
                             f"Urteil ohne erkennbare Fallzahl")
    return funde


def pruefe_blinder_abgleich(code: list[str], ausgaben: list[str]) -> list[str]:
    """Wer eine gespeicherte Groesse nachrechnet, muss sie dagegen halten."""
    ganzer_code = "\n".join(code)
    funde = []
    # Ein Abgleich ist mehr als eine Erwaehnung: Die Spalte muss gerechnet,
    # verglichen oder zugesichert werden. In einer Aufzaehlung gesperrter
    # Merkmale zu stehen genuegt nicht.
    rechnend = re.compile(
        r"^(?![^#]*#).*\b{spalte}\b.*$")
    rechenzeichen = re.compile(
        r"assert|abs\(|==|!=|\s-\s|\.mean|\.corr|\.sum|merge|vergleich")
    for spalte, (bezeichnung, bestandteile) in NACHGEBAUTE_LOGIK.items():
        if not any(teil in ganzer_code for teil in bestandteile):
            continue
        muster = re.compile(rechnend.pattern.format(spalte=spalte), re.I)
        if not any(muster.search(zeile) and rechenzeichen.search(zeile)
                   for zeile in ganzer_code.split("\n")):
            funde.append(
                f"{bezeichnung} wird aus {bestandteile[0]} nachgebaut, ohne das "
                f"Ergebnis je gegen die gespeicherte Spalte {spalte} zu halten - "
                f"geprueft wird dann die eigene Formel, nicht die Wirklichkeit")
    return funde


def main() -> int:
    dateien = sorted(NOTEBOOKS.glob("*.ipynb"))
    if not dateien:
        print("Keine Notebooks gefunden.")
        return 2
    gesamt = gesamt_hinweise = 0
    for pfad in dateien:
        code, ausgaben = zellen(pfad)
        fehler = (pruefe_blinder_abgleich(code, ausgaben)
                  + pruefe_sichtbarer_rest(code))
        hinweise = (pruefe_nullfuellung(code) + pruefe_freie_schwellen(code)
                    + pruefe_urteil_ohne_zahl(ausgaben))
        if fehler:
            print(f"{ROT}FEHLER  {AUS} {pfad.stem}")
        elif hinweise:
            print(f"{GELB}Hinweis {AUS} {pfad.stem}")
        else:
            print(f"{GRUEN}ok      {AUS} {pfad.stem}")
        for fund in fehler:
            print(f"  {ROT}!{AUS}      {fund}")
        for fund in hinweise:
            print(f"  {GELB}?{AUS}      {fund}")
        gesamt += len(fehler)
        gesamt_hinweise += len(hinweise)
    print(f"\n{len(dateien)} Notebook(s) geprueft: {gesamt} Fehler, "
          f"{gesamt_hinweise} Hinweise.")
    return 1 if gesamt else 0


if __name__ == "__main__":
    sys.exit(main())
