#!/usr/bin/env python3
"""Haelt die Aussagen, auf denen die Lehrfreigabe beruht, gegen die Notebooks.

WARUM ES DIESE PRUEFUNG BRAUCHT

Die Bau-Pruefer sichern Zahlen, Code und Statuslogik. Sie sichern NICHT,
dass eine sprachliche Ueberarbeitung eine freigaberelevante Aussage
entfernt: Ein gestrichener Absatz faellt keiner Zahlenpruefung auf. Die
Liste unten stammt aus den Freigabeurteilen des Pruefers - jeder Punkt
ist eine Aussage, deren Fehlen die Freigabe kippen wuerde.

Aufruf: python3 tools/freigabe_pruefen.py [nb01 nb05 ...]
"""
import json
import pathlib
import re
import sys

NOTEBOOKS = pathlib.Path(__file__).resolve().parent.parent / "analytics" / "notebooks"

# je Notebook: (Bezeichnung, Suchmuster, "md" | "aus" | "alle")
PFLICHT = {
"01_Regression_Fahrtdauer": [
    ("Abnahme in Phase 2 versiegelt", r"versiegel", "alle"),
    ("Geplantes Ziel ist die Modelleingabe",
     r"geplante[sn]? Ziel.{0,120}(Modelleingabe|Eingabe)|"
     r"geplante_ziel_station_id", "md"),
    ("Tatsaechliches Ende nur zur Bewertung",
     r"tatsächliche[sn]? (Ziel|Ende).{0,90}(Bewertung|Maßstab|nie Merkmal)", "md"),
    ("Auswahlregel vor der Messung benannt", r"[Aa]uswahlregel", "alle"),
    ("Alle drei Kandidaten im Vergleich",
     r"Quantilregression.{0,400}Perzentiltabelle.{0,400}Quantiltabelle", "alle"),
    ("Abnahmegates einzeln geprueft", r"ALLE BINDENDEN GATES", "aus"),
    ("Primaergate auf der Abnahme belegt", r"Abnahme", "md"),
    ("Kalibrierung gibt nicht frei",
     r"Vorbereitung der Abnahme|kein unabhaengiger Endtest|"
     r"kein unabhängiger Endtest", "alle"),
    ("Unabhaengig, aber rueckblickend",
     r"rückblickend|retrospektiv", "md"),
    ("Prospektive Pruefung steht aus", r"prospektiv", "md"),
    ("Gueltigkeitsende wird durchgesetzt", r"ausserhalb_gueltigkeit", "alle"),
    ("Tarifdeckel im Paket", r"tageshoechstpreis|Tagesdeckel|tageshöchstpreis", "alle"),
    ("Eigenstaendiger Reload-Test", r"[Rr]eload", "alle"),
    ("Zusage traegt die Zielbedingung", r"gewählten? Ziel", "alle"),
],
"02_Klassifikation_Wartungsrisiko": [
    ("Kostenmatrix als Ausgangspunkt", r"180|Kostenmatrix", "md"),
    ("Drei Pflichtgates K1 K2 K3", r"K1.{0,80}K2.{0,80}K3", "alle"),
    ("D70 nur als Diagnose", r"D70", "alle"),
    ("Orakelschranke als Beleg der Unerfuellbarkeit", r"Orakelschranke", "md"),
    ("Zeitlicher Schnitt statt Zufallsschnitt",
     r"Schnitt entlang der Zeit|zeitlich", "md"),
    ("Faustregel wird ausgeliefert", r"Faustregel", "alle"),
    ("Wilson-Untergrenze entscheidet", r"Wilson", "alle"),
    ("Schattenliste beigelegt", r"[Ss]chattenliste", "alle"),
    ("Grundrate schwankt saisonal", r"Grundrate", "alle"),
],
"03_Clustering_Stationen_und_Kunden": [
    ("Fuenf Kriterien vor der Messung", r"fünf Kriterien|Kriterium 5", "md"),
    ("Kein unabhaengiger Holdout moeglich",
     r"prospektive[nr]? Prüfung|Diagnose, kein Test", "md"),
    ("Stationsprofile nur als Hypothesen", r"Hypothese", "md"),
    ("Aggregierter Bericht ohne Namen",
     r"aggregierte[rn]? Bericht|ohne Namen", "alle"),
    ("Silhouette und ARI als Diagnose", r"Silhouette", "alle"),
    ("Analytisch nicht belegt, Einsatz freigegeben",
     r"nicht belegt", "alle"),
],
"04_Zeitreihe_Nachfrageprognose": [
    ("Prognosewetter statt Ist-Wetter", r"Prognosewetter", "md"),
    ("Drei Abschnitte Training Validierung Test",
     r"Training.{0,60}Validierung.{0,60}Test", "alle"),
    ("Aufschlag auf der Validierung gewaehlt", r"[Aa]ufschlag", "alle"),
    ("Test erst nach dem Einfrieren geoeffnet",
     r"eingefroren|Einfrieren|erst \*\*nach\*\*", "md"),
    ("Status Schattenpilot", r"[Ss]chattenpilot", "alle"),
    ("Fahrten statt Raeder je Station", r"Räder je Station", "md"),
],
"05_Assoziation_Wege_im_Netz": [
    ("Zwei Produkte mit eigenen Kriterien",
     r"Produkt A.{0,120}Produkt B|Produkt B.{0,120}Produkt A", "md"),
    ("A4 als wirtschaftliche Huerde", r"\bA4\b", "md"),
    ("B1 bis B4 benannt", r"B1.{0,500}B4", "md"),
    ("Kontextbedingter Lift gewaehlt", r"kontextbedingter? Lift", "md"),
    ("Klassischer Lift daneben ausgewiesen", r"klassische[rn]? Lift", "md"),
    ("Versiegelung vor der Regelsuche", r"versiegel", "alle"),
    ("B1 als Bootstrap-Untergrenze",
     r"Grenze eines Tagesblock-Bootstraps|Bootstrap-Untergrenze", "alle"),
    ("Ausschluss zweigeteilt", r"schon am\s*\n?\s*Punktschaetzer", "aus"),
    ("A4 nicht pruefbar", r"nicht prüfbar", "md"),
    ("Analytisches Lehr-Gate", r"analytisches Lehr-Gate", "alle"),
    ("Keine reale Betriebsfreigabe", r"keine reale\s*\n?\s*Betriebsfreigabe", "alle"),
    ("Huerde nicht verschoben", r"nicht.{0,30}verschoben", "md"),
    ("Szenarioannahmen statt Messungen", r"[Ss]zenarioannahmen", "md"),
    ("Begleitanalysen explorativ", r"explorativ", "alle"),
    ("Datenschutzhinweis", r"Bewegungsprofil", "md"),
    ("Tagesgenaue Gegenprobe", r"Tagesbindung|am selben Tag", "alle"),
],
"06_Anomalieerkennung_Auffaellige_Vorgaenge": [
    ("Drei Produkte, drei Entscheidungszeitpunkte",
     r"A1.{0,200}A2.{0,200}\bB\b", "md"),
    ("Listenlaenge abgeleitet, nicht gesetzt", r"Zeitbudget", "md"),
    ("Kein Label fuer A2", r"[Ll]abel", "md"),
    ("A2 im Schattenbetrieb", r"[Ss]chattenbetrieb", "alle"),
    ("B1 am unangetasteten Test gerissen",
     r"Testabschnitt|unangetastet", "alle"),
    ("Ruecksprung wegen der Preisklasse", r"Preisklasse", "md"),
    ("Globale Quote gegen Tagesliste", r"Tagesliste", "alle"),
],
}

# Aussagen, die in JEDEM Notebook stehen muessen.
GEMEINSAM = [
    # Die Notebooks sagen es verschieden: "synthetisch", "erfunden",
    # "Lehrdaten". Gemeint ist immer dasselbe, und genau das muss stehen.
    ("Datenherkunft benannt (synthetisch/erfunden)",
     r"synthetisch|erfunden|Lehrdaten", "alle"),
]


def texte(pfad):
    d = json.loads(pfad.read_text(encoding="utf-8"))
    md, aus = [], []
    for c in d["cells"]:
        if c["cell_type"] == "markdown":
            md.append("".join(c["source"]))
        else:
            for o in c.get("outputs", []):
                aus.append("".join(o.get("text", [])))
                for m, v in (o.get("data") or {}).items():
                    if m.startswith("text/"):
                        aus.append("".join(v) if isinstance(v, list) else str(v))
    t = {"md": "\n".join(md), "aus": "\n".join(aus)}
    t["alle"] = t["md"] + "\n" + t["aus"]
    return t


def pruefe(name):
    pfad = NOTEBOOKS / f"{name}.ipynb"
    if not pfad.exists():
        return [f"{name}: Notebook fehlt"]
    t = texte(pfad)
    fehler = []
    # Abschnittsnummern muessen aufsteigen - das war ein eigener Befund.
    nummern = [tuple(int(x) for x in m.group(1).split("."))
               for m in re.finditer(r"^#{1,4} (\d\.\d)\b", t["md"], re.M)]
    if nummern != sorted(nummern):
        fehler.append(f"Abschnittsfolge nicht aufsteigend: {nummern}")
    for bez, muster, wo in PFLICHT[name] + GEMEINSAM:
        if not re.search(muster, t[wo], re.I):
            fehler.append(f"FEHLT: {bez}")
    return fehler


def main(argv):
    namen = [n for n in PFLICHT
             if not argv or any(a.replace("nb", "").lstrip("0") == n[:2].lstrip("0")
                                for a in argv)]
    gesamt = 0
    for name in namen:
        fehler = pruefe(name)
        anzahl = len(PFLICHT[name]) + len(GEMEINSAM) + 1
        zeichen = "FEHLER " if fehler else "ok     "
        print(f"  {zeichen} {name[:40]:42} {anzahl - len(fehler)}/{anzahl} Punkte")
        for f in fehler:
            print(f"      ! {f}")
        gesamt += len(fehler)
    print(f"\n{len(namen)} Notebook(s): "
          + ("alle Freigabepunkte belegt." if not gesamt
             else f"{gesamt} Punkt(e) nicht belegt - die Freigabe waere gefaehrdet."))
    return 1 if gesamt else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
