"""Prueft die erzeugten Musterdaten gegen einen Katalog von Invarianten.

Der Katalog steht VOR der Erzeugung fest. Er prueft drei Dinge:

  Physik      Sind die Fahrten ueberhaupt fahrbar?
  Umfang      Reichen Zeitraum und Menge fuer die Verfahren?
  Struktur    Enthalten die Daten die Muster, die die Notebooks finden sollen?

Ein roter Punkt heisst: die Daten taugen nicht, der Generator muss nach.
Aufruf:  python tools/daten_abnahme.py
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

import numpy as np
import pandas as pd

BASIS = Path(__file__).resolve().parent.parent
DATEN = Path(os.environ.get("VELO_OUT") or BASIS / "analytics")

TEMPO_OBERGRENZE_KMH = 30.0     # darueber ist es kein Fahrrad mehr
TEMPO_UNTERGRENZE_KMH = 3.5     # darunter schiebt man
MINDESTJAHRE = 5.0
MINDESTFAHRTEN = 100_000
MINDESTKORRELATION = 0.75       # Strecke gegen Dauer
# Je abgeschlossener Fahrt, nach Freiminuten. Der Datenstand vor der
# Umstellung lag bei 1,82 EUR - die Preise bleiben unveraendert, also
# muss der Wert in derselben Groessenordnung bleiben.
UMSATZ_SPANNE_EUR = (1.50, 2.30)

ergebnisse: list[tuple[bool, str, str]] = []


def pruefe(bestanden: bool, titel: str, befund: str) -> None:
    ergebnisse.append((bool(bestanden), titel, befund))


def lade() -> dict:
    a = pd.read_csv(DATEN / "ausleihe.csv", parse_dates=["startzeit", "endzeit"])
    f = pd.read_csv(DATEN / "fahrrad.csv", parse_dates=["angeschafft_am", "ausgemustert_am"])
    k = pd.read_csv(DATEN / "kunde.csv", parse_dates=["registriert_am"])
    w = pd.read_csv(DATEN / "wetter.csv", parse_dates=["datum"])
    with open(DATEN / "radrouten_matrix.csv", encoding="utf-8") as datei:
        zeilen = [z for z in datei if not z.startswith("#")]
    m = pd.read_csv(pd.io.common.StringIO("".join(zeilen)))
    fa = pd.read_csv(DATEN / "fehlanfrage.csv", parse_dates=["zeitpunkt"])
    u = pd.read_csv(DATEN / "umsetzfahrt.csv", parse_dates=["zeitpunkt"])
    # Frei abgestellte Raeder stehen an einem der oeffentlichen Stellplaetze.
    # Die Ausleihtabelle haelt nur die Koordinaten fest - fuer die Ortskette
    # wird daraus die Kennung des Abstellorts zurueckgewonnen.
    orte = pd.read_csv(DATEN / "abstellort.csv")
    orte = orte[orte.art == "abstellort"]
    schluessel = {(round(r.lat, 6), round(r.lon, 6)): r.ort_id for r in orte.itertuples()}
    a["endort"] = [schluessel.get((la, lo)) if pd.notna(la) else None
                   for la, lo in zip(a.end_latitude, a.end_longitude)]
    a["dauer_min"] = (a.endzeit - a.startzeit).dt.total_seconds() / 60
    return {"ausleihe": a, "fahrrad": f, "kunde": k, "wetter": w, "matrix": m,
            "fehlanfrage": fa, "umsetzfahrt": u}


def physik(d: dict) -> None:
    a = d["ausleihe"]
    fertig = a[(a.status == "abgeschlossen") & a.distanz_km.notna()].copy()
    fertig["kmh"] = fertig.distanz_km / (fertig.dauer_min / 60)
    # Vergessene Rueckgaben sind bewusst extrem langsam und hier ausgenommen.
    normal = fertig[fertig.dauer_min <= 240]
    zu_schnell = (normal.kmh > TEMPO_OBERGRENZE_KMH).sum()
    pruefe(zu_schnell == 0, "Kein Rad faehrt schneller als moeglich",
           f"{zu_schnell} Fahrten ueber {TEMPO_OBERGRENZE_KMH:.0f} km/h "
           f"(schnellste {normal.kmh.max():.1f} km/h)")
    zu_langsam = (normal.kmh < TEMPO_UNTERGRENZE_KMH).sum()
    pruefe(zu_langsam / max(1, len(normal)) < 0.01, "Kaum Schrittgeschwindigkeit",
           f"{zu_langsam} Fahrten unter {TEMPO_UNTERGRENZE_KMH} km/h "
           f"({zu_langsam / max(1, len(normal)):.2%})")
    # Vergessene Rueckgaben haben eine normale Strecke bei absurder Dauer -
    # sie gehoeren zur Anomalieerkennung, nicht in diese Kennzahl.
    r = normal.distanz_km.corr(normal.dauer_min)
    pruefe(r > MINDESTKORRELATION, "Strecke erklaert die Dauer",
           f"Korrelation r = {r:+.3f} (gefordert > {MINDESTKORRELATION})")

    # Gefahrene Strecke darf die kuerzeste Route nicht unterschreiten.
    mm = d["matrix"].set_index(["von_id", "nach_id"]).strecke_m
    st = fertig[fertig.end_station_id.notna() &
                (fertig.start_station_id != fertig.end_station_id)].copy()
    st["kurz_km"] = [mm.get((str(int(x)), str(int(y))), np.nan) / 1000
                     for x, y in zip(st.start_station_id, st.end_station_id)]
    unter = (st.distanz_km < st.kurz_km * 0.90).sum()
    pruefe(unter / max(1, len(st)) < 0.02, "Niemand faehrt kuerzer als die kuerzeste Route",
           f"{unter} von {len(st)} Fahrten unter 90 % der Routenlaenge "
           f"({unter / max(1, len(st)):.2%})")


def umfang(d: dict) -> None:
    a = d["ausleihe"]
    tage_gesamt = (a.startzeit.max().normalize()
                   - a.startzeit.min().normalize()).days + 1
    jahre = tage_gesamt / 365.25
    pruefe(jahre >= MINDESTJAHRE, "Zeitraum umfasst fuenf Jahre",
           f"{jahre:.2f} Jahre, {a.startzeit.min():%d.%m.%Y} bis {a.startzeit.max():%d.%m.%Y}")
    pruefe(len(a) >= MINDESTFAHRTEN, "Genug Fahrten fuer die Verfahren",
           f"{len(a):,} Fahrten (gefordert >= {MINDESTFAHRTEN:,})")
    tage = a.startzeit.dt.normalize().nunique()
    soll = (a.startzeit.max().normalize() - a.startzeit.min().normalize()).days + 1
    pruefe(tage == soll, "Kein Tag ohne Betrieb", f"{tage} von {soll} Tagen belegt")
    w = d["wetter"]
    deckt = (w.datum.min() <= a.startzeit.min().normalize()
             and w.datum.max() >= a.startzeit.max().normalize())
    pruefe(deckt, "Wetter deckt den ganzen Zeitraum",
           f"Wetter {w.datum.min():%d.%m.%Y} bis {w.datum.max():%d.%m.%Y}")


def konsistenz(d: dict) -> None:
    a, f, k = d["ausleihe"], d["fahrrad"], d["kunde"]
    zu = a.merge(f[["fahrrad_id", "angeschafft_am", "ausgemustert_am"]], on="fahrrad_id")
    vor = (zu.startzeit.dt.normalize() < zu.angeschafft_am).sum()
    nach = (zu.ausgemustert_am.notna() &
            (zu.startzeit.dt.normalize() > zu.ausgemustert_am)).sum()
    pruefe(vor == 0 and nach == 0, "Kein Rad faehrt ausserhalb seiner Dienstzeit",
           f"{vor} vor der Anschaffung, {nach} nach der Ausmusterung")
    kk = a.merge(k[["kunde_id", "registriert_am"]], on="kunde_id")
    frueh = (kk.startzeit.dt.normalize() < kk.registriert_am).sum()
    pruefe(frueh == 0, "Keine Fahrt vor der Anmeldung", f"{frueh} Faelle")
    pruefe((a.endzeit > a.startzeit).all(), "Jede Fahrt endet nach ihrem Beginn",
           f"{(a.endzeit <= a.startzeit).sum()} Faelle")
    fertig = a[a.status == "abgeschlossen"]
    umsatz = fertig.entgelt_eur.mean()
    pruefe(UMSATZ_SPANNE_EUR[0] <= umsatz <= UMSATZ_SPANNE_EUR[1],
           "Erloese bleiben in der bisherigen Groessenordnung",
           f"{umsatz:.2f} EUR je Fahrt (erwartet "
           f"{UMSATZ_SPANNE_EUR[0]:.2f} bis {UMSATZ_SPANNE_EUR[1]:.2f})")


def struktur(d: dict) -> None:
    """Die sechs Muster, die die Notebooks finden sollen."""
    a, f = d["ausleihe"], d["fahrrad"]
    mm = d["matrix"].set_index(["von_id", "nach_id"])
    fertig = a[(a.status == "abgeschlossen") & a.distanz_km.notna()].copy()
    fertig = fertig.merge(f[["fahrrad_id", "typ_code"]], on="fahrrad_id")
    st = fertig[fertig.end_station_id.notna() &
                (fertig.start_station_id != fertig.end_station_id)].copy()
    schl = [(str(int(x)), str(int(y))) for x, y in zip(st.start_station_id, st.end_station_id)]
    st["steigung"] = [mm.steigung_promille.get(s, np.nan) for s in schl]
    st["kmh"] = st.distanz_km / (st.dauer_min / 60)

    # 01 Regression: die Steigung bremst das Citybike deutlich staerker als das E-Bike.
    hang = st[st.steigung > 8]
    eben = st[st.steigung.abs() <= 3]
    verlust = {}
    for typ in ("CITY", "EBIKE"):
        oben, flach = hang[hang.typ_code == typ].kmh, eben[eben.typ_code == typ].kmh
        verlust[typ] = 1 - oben.mean() / flach.mean() if len(oben) and len(flach) else np.nan
    pruefe(verlust["CITY"] > verlust["EBIKE"] * 1.8,
           "Wechselwirkung Steigung mal Radtyp ist da",
           f"Tempoverlust am Anstieg: Citybike {verlust['CITY']:.1%}, "
           f"E-Bike {verlust['EBIKE']:.1%}")

    # 02 Klassifikation: Schaeden sind selten, haengen aber an der Belastung.
    sch = pd.read_csv(DATEN / "schadensmeldung.csv")
    quote = sch.fahrrad_id.nunique() / len(f)
    pruefe(0.20 <= quote <= 0.95, "Schaeden sind ungleich verteilt",
           f"{sch.fahrrad_id.nunique()} von {len(f)} Raedern gemeldet ({quote:.1%})")

    # 04 Zeitreihe: der E-Bike-Zulauf hebt das Niveau sichtbar.
    ebike_ab = pd.to_datetime(f[f.typ_code == "EBIKE"].angeschafft_am.min())
    tage = a.set_index("startzeit").resample("D").size()
    vor = tage[(tage.index >= ebike_ab - pd.Timedelta(days=365)) & (tage.index < ebike_ab)]
    nach = tage[(tage.index >= ebike_ab + pd.Timedelta(days=120)) &
                (tage.index < ebike_ab + pd.Timedelta(days=485))]
    hub = nach.mean() / vor.mean() - 1 if len(vor) and len(nach) else 0
    pruefe(hub > 0.08, "Strukturbruch bei der E-Bike-Einfuehrung",
           f"Tagesnachfrage {vor.mean():.0f} vor, {nach.mean():.0f} nach der Einfuehrung "
           f"({hub:+.1%})")

    # 05 Assoziation: Hin- und Rueckweg sind unterschiedlich lang.
    paare = 0
    for (v, n), zeile in mm.iterrows():
        gegen = mm.strecke_m.get((n, v))
        if gegen and abs(zeile.strecke_m - gegen) / min(zeile.strecke_m, gegen) > 0.30:
            paare += 1
    pruefe(paare >= 10, "Gerichtete Wege sind asymmetrisch",
           f"{paare} Relationen mit ueber 30 % Richtungsunterschied")

    # 06 Anomalie: die auffaelligen Faelle brauchen mehr als eine Regel.
    lang = a[(a.status == "abgeschlossen") & (a.dauer_min > 240)]
    anteil = len(lang) / len(a)
    pruefe(0.0002 <= anteil <= 0.01, "Auffaellige Vorgaenge sind selten, aber vorhanden",
           f"{len(lang)} Fahrten ueber vier Stunden ({anteil:.3%})")



def bestand(d: dict) -> None:
    """Kann jedes Rad zu jeder Zeit dort sein, wo die Daten es behaupten?"""
    a, u = d["ausleihe"], d["umsetzfahrt"]

    # Kein Rad faehrt zwei Fahrten gleichzeitig.
    s = a.sort_values(["fahrrad_id", "startzeit"])
    ueberlappt = ((s.fahrrad_id == s.fahrrad_id.shift())
                  & (s.startzeit < s.endzeit.shift())).sum()
    pruefe(ueberlappt == 0, "Kein Rad ist an zwei Orten zugleich",
           f"{ueberlappt} ueberlappende Fahrten desselben Rades")

    # Die Ortskette jedes Rades muss geschlossen sein: Wo eine Fahrt endet,
    # beginnt die naechste - es sei denn, der Betreiber hat umgesetzt.
    fahrt = pd.DataFrame({
        "fahrrad_id": a.fahrrad_id, "zeit": a.startzeit,
        "von": a.start_station_id.astype("Int64").astype(str),
        "ende": a.endzeit,
        "nach": np.where(a.end_station_id.notna(),
                         a.end_station_id.astype("Int64").astype(str),
                         a.endort.astype("object").where(a.endort.notna(), ""))})
    setzen = pd.DataFrame({
        "fahrrad_id": u.fahrrad_id, "zeit": u.zeitpunkt,
        "von": u.von_ort.astype(str), "ende": u.zeitpunkt,
        "nach": u.nach_station_id.astype(str)})
    kette = pd.concat([fahrt, setzen]).sort_values(["fahrrad_id", "zeit"])
    bruch = ((kette.fahrrad_id == kette.fahrrad_id.shift())
             & (kette.von != kette.nach.shift())).sum()
    pruefe(bruch == 0, "Die Ortskette jedes Rades ist geschlossen",
           f"{bruch} von {len(kette):,} Uebergaengen ohne erklaerenden Vorgang")


def betrieb(d: dict) -> None:
    """Sind Engpaesse, Stammstrecken und Verhaltenswandel vorhanden?"""
    a, fa, u = d["ausleihe"], d["fehlanfrage"], d["umsetzfahrt"]

    quote = len(fa) / (len(a) + len(fa))
    pruefe(0.004 <= quote <= 0.06, "Engpaesse kommen vor, aber selten",
           f"{len(fa):,} gescheiterte Anfragen = {quote:.1%} der Nachfrage")
    gruende = set(fa.grund.unique())
    pruefe(gruende >= {"kein Rad verfuegbar", "kein Platz frei"},
           "Beide Engpassarten treten auf", f"vorhanden: {', '.join(sorted(gruende))}")
    je_tag = len(u) / a.startzeit.dt.normalize().nunique()
    pruefe(4 <= je_tag <= 60, "Der Betreiber setzt taeglich um",
           f"{len(u):,} Radbewegungen = {je_tag:.1f} je Tag")

    # Stammstrecken: wer viel faehrt, faehrt meist dieselbe Verbindung.
    mit = a[a.end_station_id.notna()].copy()
    mit["rel"] = (mit.start_station_id.astype("Int64").astype(str) + ">"
                  + mit.end_station_id.astype("Int64").astype(str))
    zahl = mit.groupby("kunde_id").size()
    viel = zahl[zahl >= 30].index
    anteil = (mit[mit.kunde_id.isin(viel)].groupby("kunde_id").rel
              .apply(lambda x: x.value_counts().iloc[0] / len(x)))
    pruefe(anteil.median() >= 0.18, "Vielfahrer haben eine Stammstrecke",
           f"haeufigste Verbindung macht im Median {anteil.median():.1%} "
           f"ihrer Fahrten aus (Zufall waere rund 1 %)")

    # Verhaltenswandel: die Nutzungsintensitaet einzelner Kunden verschiebt sich.
    erst = a[a.startzeit < a.startzeit.min() + pd.Timedelta(days=730)]
    spaet = a[a.startzeit >= a.startzeit.max() - pd.Timedelta(days=730)]
    e, s = erst.groupby("kunde_id").size(), spaet.groupby("kunde_id").size()
    beide = e.index.intersection(s.index)
    gewandelt = (((s[beide] / e[beide]) > 2) | ((s[beide] / e[beide]) < 0.5)).mean()
    pruefe(gewandelt >= 0.25, "Kundschaft veraendert ihr Verhalten",
           f"{gewandelt:.0%} der durchgehend aktiven Kunden haben ihre "
           f"Fahrtenzahl mehr als verdoppelt oder halbiert")


def main() -> int:
    fehlend = [n for n in ("ausleihe.csv", "fahrrad.csv", "kunde.csv",
                           "radrouten_matrix.csv", "fehlanfrage.csv",
                           "umsetzfahrt.csv") if not (DATEN / n).exists()]
    if fehlend:
        print(f"Fehlende Dateien: {', '.join(fehlend)}")
        return 2
    daten = lade()
    for abschnitt, name in ((physik, "Physik"), (umfang, "Umfang"),
                            (konsistenz, "Konsistenz"), (bestand, "Bestand"),
                            (betrieb, "Betrieb"), (struktur, "Struktur")):
        vorher = len(ergebnisse)
        try:
            abschnitt(daten)
        except Exception as fehler:                       # noqa: BLE001
            pruefe(False, f"{name}: Pruefung abgebrochen", f"{type(fehler).__name__}: {fehler}")
        ergebnisse[vorher:] = [(ok, f"[{name}] {t}", b) for ok, t, b in ergebnisse[vorher:]]

    breite = max(len(t) for _, t, _ in ergebnisse)
    for ok, titel, befund in ergebnisse:
        print(f"  {'OK  ' if ok else 'FEHL'}  {titel:<{breite}}  {befund}")
    offen = sum(1 for ok, _, _ in ergebnisse if not ok)
    print(f"\n{len(ergebnisse) - offen} von {len(ergebnisse)} Pruefungen bestanden.")
    return 1 if offen else 0


if __name__ == "__main__":
    sys.exit(main())
