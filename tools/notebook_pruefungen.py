"""Prueft die gebauten Notebooks auf mechanisch erkennbare Fehlerbilder.

Jede Pruefung hier geht auf einen Fehler zurueck, der in einem Review
gefunden wurde. Sie soll ihn beim naechsten Mal vor dem Review finden.

  Hartes Ergebnis   Radtypnamen im Fliesstext statt aus einem Platzhalter
  Gate ohne Sperre  ein Kriterium, das der Text entscheidend nennt, aber nichts sperrt
  Hartes Urteil     ein gedrucktes Ergebnis, das aus keiner Zahl folgt
  Ladepfad          Vorgabequelle ist kein benutzbarer Pfad - laeuft beim Studierenden nicht
  Harte Quelle      Datenzugriff auf einen beweglichen Zweig statt einen Commit
  Toter Status      ein Freigabestatus, der berechnet, aber nie gepruft wird
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


def zellen(pfad: Path) -> tuple[list, list, list]:
    nb = json.loads(pfad.read_text(encoding="utf-8"))
    code, ausgaben, markdown = [], [], []
    for z in nb["cells"]:
        text = "".join(z["source"])
        if z["cell_type"] == "code":
            code.append(text)
            ausgaben.append("".join(
                "".join(a.get("text", "")) for a in z.get("outputs", [])))
        else:
            markdown.append(text)
    return code, ausgaben, markdown


def pruefe_nullfuellung(code: list[str]) -> list[str]:
    """fillna(0) verdeckt Datenluecken - es sei denn, Null ist der wahre Wert.

    Beides kommt vor, und der Unterschied ist nicht am Code zu sehen: Ob
    eine fehlende Fahrtenzahl "keine Fahrt" heisst oder "nicht erfasst",
    weiss nur, wer die Daten kennt. Deshalb verlangt diese Pruefung eine
    Aussage - entweder eine Zusicherung, dass keine Luecke vorliegt, oder
    die ausdrueckliche Kennzeichnung

        # nullen-sind-echt: <Begruendung>

    Eine Kennzeichnung ist keine Formalie: Sie zwingt dazu, den Satz
    hinzuschreiben, und ein falscher Satz faellt beim Lesen auf. Ein
    ungekennzeichnetes fillna(0) faellt nie auf.
    """
    funde = []
    for nummer, quelle in enumerate(code):
        for treffer in re.finditer(r"\.fillna\(\s*0(?:\.0)?\s*\)", quelle):
            umfeld = "\n".join(quelle[:treffer.start()].split("\n")[-12:])
            if "assert" in umfeld or "nullen-sind-echt" in umfeld:
                continue
            zeile = quelle[:treffer.start()].count("\n") + 1
            funde.append(f"Zelle {nummer}, Zeile {zeile}: fillna(0) ohne "
                         f"Zusicherung und ohne Begruendung "
                         f"(# nullen-sind-echt: ...)")
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



def pruefe_harte_quelle(code: list[str]) -> list[str]:
    """Eine Datenquelle, die im Notebook ausgeschrieben steht, laesst sich
    nicht zentral umstellen - und zeigt dann auf einen veraenderlichen Zweig."""
    funde = []
    for nummer, quelle in enumerate(code):
        for treffer in re.finditer(
                r'raw\.githubusercontent\.com/[^"\s]*?/(main|master|HEAD)/', quelle):
            funde.append(
                f"Zelle {nummer}: Datenquelle zeigt auf '{treffer.group(1)}' - "
                f"ein Zweig bewegt sich, das Notebook rechnet dann mit anderen "
                f"Zahlen als sein Text")
    return funde


def pruefe_status_ohne_wirkung(code: list[str]) -> list[str]:
    """Ein Freigabe- oder Statuswert, der berechnet und exportiert, aber nie
    zum Filtern verwendet wird, sperrt nichts - er sieht nur so aus."""
    ganzer = "\n".join(code)
    funde = []
    for name in set(re.findall(r'\[["\'](\w*(?:status|freigabe)\w*)["\']\]\s*=', ganzer, re.I)):
        # Wird der Wert irgendwo zum Auswaehlen benutzt?
        wirkt = re.search(
            rf'(?:isin|==|!=|\.eq|\.ne|query|~|assert)[^\n]*{name}'
            rf'|{name}[^\n]*(?:isin|==|!=|\.eq|\.ne)', ganzer, re.I)
        if not wirkt:
            funde.append(
                f"'{name}' wird gesetzt, aber nirgends zum Filtern oder Sperren "
                f"verwendet - ein Status ohne Wirkung ist kein Status")
    return funde



# Werte, die im Fliesstext stehen duerfen, weil sie Vorgaben sind und keine
# Messergebnisse: Radtypen als Begriff, nicht als Aufzaehlung eines Ergebnisses.
ERGEBNISNAMEN = ("CITY", "EBIKE", "CARGO")


def pruefe_harte_ergebnisnamen(bauskript: str) -> list[str]:
    """Radtypnamen im Fliesstext veralten, sobald sich die Freigabe aendert.

    Geprueft wird das BAUSKRIPT, nicht das Notebook: Dort steht noch
    {{typen_halten}}, waehrend im fertigen Notebook laengst "CITY und EBIKE"
    steht - und beides waere nicht mehr zu unterscheiden.

    In einer Aufzaehlung ("nur fuer CITY", "CITY und EBIKE") ist der Name ein
    ERGEBNIS und gehoert in einen Platzhalter. In einer Tabellenzeile oder als
    Spaltenwert ist er ein Bezeichner und darf stehen bleiben.
    """
    verdaechtig = re.compile(
        r"(?:nur (?:für|fuer)|ausschliesslich|lediglich)\s+\*{0,2}(" + "|".join(ERGEBNISNAMEN) + r")\b"
        r"|\b(" + "|".join(ERGEBNISNAMEN) + r")\s+und\s+(" + "|".join(ERGEBNISNAMEN) + r")\b")
    funde = []
    # Nur MD-Bloecke betrachten - in Codezeilen sind die Namen Bezeichner.
    for block in re.findall(r'MD\("""(.*?)"""\)', bauskript, re.S):
        for zeile in block.split("\n"):
            if zeile.lstrip().startswith("|") or zeile.lstrip().startswith("#"):
                continue                      # Tabelle oder Ueberschrift
            if verdaechtig.search(zeile):
                funde.append(
                    f"\"{zeile.strip()[:70]}\" - Radtypen als Ergebnis "
                    f"ausgeschrieben; ein Platzhalter veraltet nicht")
    return funde


def pruefe_gate_ohne_sperre(bauskript: str) -> list[str]:
    """Ein Kriterium, das der Text als entscheidend bezeichnet, muss im Code
    ueber die Freigabe mitentscheiden - sonst steht die Zusage nur da."""
    ganzer_code = "\n".join(re.findall(r'CODE\("""(.*?)"""\)', bauskript, re.S))
    ganzer_text = "\n".join(re.findall(r'MD\("""(.*?)"""\)', bauskript, re.S))
    funde = []
    # Saetze, die etwas zum Gate erklaeren
    for satz in re.findall(
            r"[^.\n]*\b(?:Primärgate|Primaergate|entscheidet sich, ob das Produkt|"
            r"vorab festgelegte Evaluationsgruppe|entscheidende[rs]? Gate)\b[^.]*\.",
            ganzer_text):
        # Kommt in der Freigabelogik ueberhaupt eine Sperre vor, die daran haengt?
        if not re.search(r"(?:gate|primaergate|evaluationsgruppe)\w*\s*=|"
                         r"assert[^\n]*(?:gate|preisabhaeng)", ganzer_code, re.I):
            funde.append(
                f"Der Text erklaert etwas zum Gate (\"{satz.strip()[:70]}...\"), "
                f"aber im Code entscheidet nichts darueber - die Freigabe "
                f"beruecksichtigt es nicht")
            break
    return funde



def pruefe_ladepfad(code: list[str]) -> list[str]:
    """Laeuft das Notebook so, wie ein Studierender es bekommt?

    Ohne gesetztes VELO_BASIS muss der Vorgabewert eine benutzbare Quelle sein:
    eine URL oder ein Pfad. Steht dort ein Codefragment - etwa ein
    Verkettungsausdruck, der in dieser Anfuehrungsform nicht aufgeloest wurde -,
    endet die erste Ladezelle mit FileNotFoundError. Beim Bauen faellt das nie
    auf, weil dort VELO_BASIS gesetzt ist.
    """
    funde = []
    for nummer, quelle in enumerate(code):
        for treffer in re.finditer(
                r'os\.environ\.get\(\s*["\']VELO_BASIS["\']\s*,\s*([^)]+)\)', quelle):
            vorgabe = treffer.group(1).strip()
            # Zulaessig ist nur ein reiner String, der wie eine Quelle aussieht.
            passt = re.fullmatch(r'["\'](https?://|/|\.{0,2}/)[^"\']*["\']',
                                 vorgabe, re.S)
            if not passt:
                funde.append(
                    f"Zelle {nummer}: Der Vorgabewert fuer VELO_BASIS ist keine "
                    f"benutzbare Quelle, sondern {vorgabe[:52]!r} - ohne gesetzte "
                    f"Umgebungsvariable laeuft das Notebook nicht an")
    return funde



# Woerter, die ein URTEIL ausdruecken - keine Beschreibung, sondern einen
# Befund, der aus Zahlen folgen muss.
URTEILSWORTE_CODE = (
    "INNERHALB", "AUSSERHALB", "ERFUELLT", "ERFÜLLT", "GERISSEN", "BESTANDEN",
    "NICHT BESTANDEN", "haelt", "hält", "liegt unter", "liegt ueber",
    "liegt über", "ist erfuellt", "ist erfüllt",
)


def pruefe_hartes_urteil(code: list[str]) -> list[str]:
    """Ein gedrucktes Urteil muss aus den gerechneten Zahlen folgen.

    Ein print, das ein Ergebnis behauptet, ohne eine berechnete Groesse zu
    verwenden und ohne in einem bedingten Zweig zu stehen, bleibt stehen, wenn
    sich die Zahlen aendern - und widerspricht dann der Zelle darueber.

    Eine unmittelbar davorstehende `assert` gilt als Bedingung. Sie ist sogar
    die schaerfere Form: Ein if-Zweig laesst den falschen Fall zu und schweigt
    darueber, eine Assertion bricht ab. Wer sein Urteil so absichert, hat genau
    das getan, was diese Pruefung verlangt.
    """
    funde = []
    for nummer, quelle in enumerate(code):
        zeilen = quelle.split("\n")
        for i, zeile in enumerate(zeilen):
            nackt = zeile.strip()
            if not nackt.startswith("print("):
                continue
            if not any(w in zeile for w in URTEILSWORTE_CODE):
                continue
            # Enthaelt die Zeile einen eingesetzten Wert oder einen Ausdruck?
            hat_wert = re.search(r"\{[^}]+\}", zeile) or re.search(r"\+\s*\w", zeile)
            # Steht sie in einem bedingten Zweig? (Einrueckung > 0 und ein
            # if/elif/else in den Zeilen davor auf geringerer Einrueckung)
            tiefe = len(zeile) - len(zeile.lstrip())
            bedingt = False
            for davor in reversed(zeilen[:i]):
                if not davor.strip():
                    continue
                d_tiefe = len(davor) - len(davor.lstrip())
                if d_tiefe < tiefe and re.match(r"\s*(if|elif|else)\b", davor):
                    bedingt = True
                    break
                if d_tiefe < tiefe:
                    break
            # Eine Assertion unmittelbar davor erzwingt die Aussage bereits.
            gesichert = False
            for davor in reversed(zeilen[max(0, i - 3):i]):
                if davor.strip().startswith("assert "):
                    gesichert = True
                    break
                if davor.strip() and not davor.strip().startswith(("print(", "#")):
                    break
            if not hat_wert and not bedingt and not gesichert:
                funde.append(
                    f"Zelle {nummer}: {nackt[:76]} - ein Urteil ohne gerechneten "
                    f"Wert und ohne Bedingung; es bleibt stehen, wenn sich die "
                    f"Zahlen aendern")
    return funde


URTEIL_WORT = re.compile(
    r"(?:ist|sind|wird|werden|bleibt|w[äa]re)\s+(?:\w+\s+){0,4}"
    r"(?:erf[üu]llt|nicht erf[üu]llt|gerissen|verfehlt|bestanden|belegt)"
    r"|von (?:kein|beid|allen|einem)\w*\s+(?:der\s+)?(?:\w+\s+){0,2}"
    r"Verfahren\s+(?:\w+\s+){0,2}erf[üu]llt")
# Ein Urteil kann sich auf ein benanntes Kriterium (K1b) ODER auf die
# Schwelle selbst berufen ("die 70-Prozent-Huerde ist nicht belegt"). Die
# zweite Form stand in Notebook 2 und widersprach der Tabelle darueber -
# erkannt wurde sie nicht, weil das Muster nur nach "K1b" suchte.
KRITERIUM = re.compile(r"\bK\d[ab]?\b|\d+\s?(?:-|\s)?(?:%|Prozent)"
                       r"(?:-|\s)?(?:H[üu]rde|Schwelle|Grenze|Marke)"
                       r"|\b(?:H[üu]rde|Schwelle) von \d+")


VERGLEICH = re.compile(
    r"^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(?:bool\()?\s*"
    r"([a-z_][a-z0-9_]*)\s*(?:<=|>=|<|>|==|!=)\s*([A-Za-z_][A-Za-z0-9_]*)", re.M)


SCHREIBT = re.compile(r"\.to_csv\(|joblib\.dump\(|\.to_json\(|\.to_parquet\(")
FREIGABEMARKE = re.compile(r"\b(?:KEINE_FREIGABE|PRODUKT_FREIGEGEBEN|"
                           r"[A-Z_]*FREIGEGEBEN|[A-Z_]*FREIGABE[A-Z_]*)\b")
# Ein Artefakt ohne Gate ist zulaessig - aber dann muss es sagen, was es ist.
# Die explorativen Tafeln in Notebook 3 und 5 tragen einen STATUS-Kopf
# ("HYPOTHESEN - kein Umverteilungsplan"); das ist die ehrliche Form.
STATUSMARKE = re.compile(r"[A-Za-z_]*status\b", re.I)


NEGATIV = re.compile(
    r"(?:Produkt|Verfahren|Regel|Liste|Modell|A1|A2|\bB\b)[^.]{0,40}"
    r"(?:ist|wird|bleibt) nicht freigegeben"
    r"|keine (?:Betriebs|Kampagnen|Produkt)?freigabe"
    r"|wird nichts (?:ausgeliefert|freigegeben)"
    r"|nichts (?:geht|wird) in Betrieb"
    r"|kein (?:zulaessiger|zulässiger) Kandidat"
    r"|im Einsatz ist gar nichts"
    r"|Es wurde keine einzige Regel freigegeben"
    r"|Freigegeben wird (?:sie|es|er) nicht"
    r"|\*\*Keine Freigabe\*\*"
    r"|alle (?:sechs|fuenf|fünf|vier|drei) (?:Freigabe-)?Gates offen"
    r"|Gesperrter analytischer Arbeitsstand", re.I)
POSITIV = re.compile(
    r"AUSGELIEFERT WIRD|Kampagnenfreigabe: JA|FREIGABE ALS PILOT"
    r"|freigegeben \(Pilot\)|Das Produkt ist freigegeben", re.I)


def pruefe_altprosa(markdown: list[str], ausgaben: list[str],
                    bauskript: str = "") -> list[str]:
    """Findet Fliesstext, der eine Sperre behauptet, waehrend das Notebook freigibt.

    Der teuerste Fehler dieser Fallstudie war nicht eine falsche Zahl,
    sondern ein stehengebliebener Zustand: Das Notebook lieferte aus, und
    drei Kapitel weiter stand noch "nicht freigegeben". Zahlen faengt die
    Textpruefung; Worte nicht.

    Geprueft wird nur, wenn die AUSGABEN eine Freigabe belegen. Dann darf
    im Fliesstext keine unbedingte Sperraussage mehr stehen - es sei denn,
    sie ist erkennbar rueckblickend ("eine fruehere Fassung", "haette",
    "waere") oder bedingt ("wenn", "falls").

    UND: Sie darf aus einem Platzhalter stammen. Im gebauten Notebook ist
    {{status_a}} laengst durch "nicht freigegeben" ersetzt und von einer
    getippten Sperre nicht mehr zu unterscheiden. Notebook 5 hat zwei
    Produkte mit verschiedenem Status - dort ist "Produkt A ist nicht
    freigegeben" neben einer Freigabe von Produkt B voellig richtig.
    Deshalb wird gegen das BAUSKRIPT gegengeprueft: Steht der Satz dort
    mit einem Platzhalter, ist er datengetrieben und kein Befund.
    """
    # Alle Saetze des Bauskripts, die einen Platzhalter tragen - als
    # Textanfaenge, damit sie sich im gebauten Text wiederfinden lassen.
    dynamisch = []
    for block in re.findall(r'MD\("""(.*?)"""\)', bauskript, re.S):
        for satz in re.split(r"(?<=[.!?])\s+", block):
            if "{{" in satz:
                # Der Textanfang vor dem ersten Platzhalter ist der Teil,
                # der beim Bauen unveraendert bleibt.
                vorspann = satz.split("{{")[0].strip()
                if len(vorspann) >= 12:
                    dynamisch.append(vorspann)
    if not any(POSITIV.search(a) for a in ausgaben):
        return []
    rueckblick = re.compile(r"fr[üu]here|zuvor|h[äa]tte|w[äa]re|wenn |falls |sonst |"
                            r"anders ausgefallen|nicht eingetreten", re.I)
    befunde = []
    for i, text in enumerate(markdown, 1):
        for satz in re.split(r"(?<=[.!?])\s+", text):
            if not NEGATIV.search(satz) or rueckblick.search(satz):
                continue
            if "{{" in satz:          # aus der Rechnung gefuellt
                continue
            if any(v in satz for v in dynamisch):
                continue              # im Bauskript ein Platzhalter
            befunde.append(f"Markdownzelle {i}: '{satz.strip()[:88]}' - behauptet eine "
                           f"Sperre, obwohl die Ausgaben eine Freigabe zeigen")
    return befunde


def pruefe_artefakt_ohne_waechter(code: list[str]) -> list[str]:
    """Ein Artefakt darf nur entstehen, wenn die Freigabe es zulaesst.

    In Notebook 2 stand der Nichtfreigabepfad im Text, aber nicht im Code:
    Faellt kein Kandidat durch alle Gates, war ausgelieferter_score None -
    und die naechste Zelle brach mit einem TypeError ab. Ein Absturz ist
    keine Freigabeentscheidung, und eine Liste, die trotz gerissener Gates
    geschrieben wird, ist schlimmer als beides.

    Gemeldet wird jede Zelle, die eine Datei schreibt, ohne dass in derselben
    Zelle entweder eine Freigabevariable geprueft oder ein STATUS deklariert
    wird. Beides ist zulaessig, keines von beidem nicht: Wer eine Datei
    schreibt, muss sagen, ob sie benutzt werden darf. Der Waechter muss dort
    stehen, wo geschrieben wird - ein Kommentar drei Zellen frueher haelt
    niemanden auf.
    """
    befunde = []
    for nr, quelle in enumerate(code, 1):
        if not SCHREIBT.search(quelle):
            continue
        if FREIGABEMARKE.search(quelle) or STATUSMARKE.search(quelle):
            continue
        zeile = next((z.strip() for z in quelle.split("\n") if SCHREIBT.search(z)), "")
        befunde.append(
            f"Zelle {nr}: '{zeile[:70]}' schreibt ein Artefakt, ohne Freigabepruefung "
            f"und ohne deklarierten Status - der Leser der Datei erfaehrt nicht, "
            f"ob er sie benutzen darf")
    return befunde


def pruefe_gate_mit_fremder_zahl(code: list[str]) -> list[str]:
    """Findet Gates, die mit einer anderen Zahl begruendet werden als der,
    die sie entscheidet.

    In Notebook 3 haengt die Kampagnensperre an `liste_wechsel` (Wechselquote
    der Arbeitsliste), gemeldet wurde beim Reissen aber `wechselquote` - der
    RFM-Ausschnitt. Beide Zahlen sind richtig, beide liegen nah beieinander,
    und genau deshalb faellt es niemandem auf: Die Sperre wird mit einer
    Groesse begruendet, die sie nicht ausgeloest hat. Drei Nenner, drei
    Zahlen - wer den falschen druckt, macht das Gate unpruefbar.

    Erkannt wird das Muster `FLAG = a <= b` gefolgt von `if not FLAG:` mit
    einem print, dessen f-String weder a noch b nennt.
    """
    befunde = []
    for nr, quelltext in enumerate(code, 1):
        herkunft = {flag: {links, rechts}
                    for flag, links, rechts in VERGLEICH.findall(quelltext)}
        if not herkunft:
            continue
        zeilen = quelltext.split("\n")
        for i, zeile in enumerate(zeilen):
            treffer = re.match(r"\s*if\s+(?:not\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*:", zeile)
            if not treffer or treffer.group(1) not in herkunft:
                continue
            flag = treffer.group(1)
            tiefe = len(zeile) - len(zeile.lstrip())
            block = []
            for folge in zeilen[i + 1:]:
                if folge.strip() and (len(folge) - len(folge.lstrip())) <= tiefe:
                    break
                block.append(folge)
            gedruckt = "\n".join(z for z in block if "print(" in z or z.strip().startswith("f\""))
            if "{" not in gedruckt:          # kein Wert im Block - nichts zu pruefen
                continue
            genannt = set(re.findall(r"\{([a-z_][a-z0-9_]*)", gedruckt))
            if genannt and not (genannt & herkunft[flag]):
                befunde.append(
                    f"Zelle {nr}: '{flag}' entscheidet ueber "
                    f"{' / '.join(sorted(herkunft[flag]))}, gemeldet wird aber "
                    f"{' / '.join(sorted(genannt))} - das Gate wird mit einer "
                    f"anderen Zahl begruendet als der, die es ausloest")
    return befunde


def pruefe_urteil_im_text(markdown: list[str]) -> list[str]:
    """Findet Urteile ueber Erfolgskriterien, die im Fliesstext festgeschrieben sind.

    Markdown kann nicht rechnen. Ein Satz wie "K1b ist von keinem der beiden
    Verfahren erfuellt" ist damit eine Behauptung, die nichts zwingt, mit der
    Rechnung mitzuwandern - und genau dieser Satz stand in Notebook 2, nachdem
    die Zahlen ihn laengst widerlegt hatten (beide Verfahren erfuellen K1b).

    pruefe_hartes_urteil() faengt denselben Fehler im CODE. Dort ist die Abhilfe
    eine Bedingung; hier ist sie eine andere: Das Urteil gehoert in eine
    Ausgabe, der Fliesstext verweist darauf oder setzt einen Platzhalter.
    Ein Satz mit {{platzhalter}} gilt darum als gedeckt.
    """
    befunde = []
    for i, text in enumerate(markdown, 1):
        for satz in re.split(r"(?<=[.:!?])\s+", text):
            if not (KRITERIUM.search(satz) and URTEIL_WORT.search(satz)):
                continue
            if "{{" in satz or "`" in satz:   # Platzhalter oder Spaltenverweis
                continue
            befunde.append(f"Markdownzelle {i}: '{satz.strip()[:90]}' - ein Urteil "
                           f"ueber ein Erfolgskriterium im Fliesstext; es wandert "
                           f"nicht mit, wenn sich die Zahlen aendern")
    return befunde


# Der Freigabestatus eines Produkts ist eine BERECHNETE Groesse: Er haengt
# an Gates, und die haengen an Zahlen. Steht er als Wort im Fliesstext,
# ist er eine zweite Quelle - und zwei Quellen fuer dieselbe Aussage gehen
# auseinander. In dieser Reihe ist genau das viermal passiert:
#   nb01  "Das Primaergate haelt nicht" bei gemessenen 82,2 % gegen 80 %
#   nb03  "ueber der Alarmschwelle" bei 20,70 % gegen 25 %
#   nb05  "freigegeben ist nichts" neben "freigegeben als Entscheidungshilfe"
#   nb06  "Die Regel reisst BEIDE Huerden" neben zwei bestandenen Gates
# Gemeldet wird nur die BEHAUPTENDE Form: ein Produkt, dem ein Status
# zugesprochen wird. Das blosse Wort reicht nicht - "Was ein echter
# Schattenbetrieb waere" erklaert den Begriff, es behauptet nichts. Eine
# fruehere Fassung dieses Pruefers meldete 34 Stellen, davon 30 solche
# Erklaerungen; ein Pruefer, der so laut ist, wird abgeschaltet.
STATUSWORT = re.compile(
    r"(?:ist|sind|bleibt|bleiben|wird|werden|geht|gehen|l[äa]uft|l[äa]ufen)"
    r"\s+(?:\w+\s+){0,3}"
    r"(?:freigegeben|gesperrt|im Schattenbetrieb|als Pilot|in Betrieb)"
    r"|^\s*[*>|\s]*\**Freigegeben\**\s+(?:ist|wird|sind|werden)"
    r"|\bFreigabe\s+(?:erteilt|verweigert)\b", re.I | re.M)
# Ein Satz darf den Status nennen, wenn er ihn NICHT behauptet: als
# Platzhalter, als Codeverweis, als Definition, als Bedingung oder als
# Bericht ueber eine fruehere Fassung.
STATUS_GEDECKT = re.compile(
    r"\{\{|`|\bheisst\b|\bheißt\b|\bbedeutet\b|\bfr[üu]here?n? Fassung\b"
    r"|\bFr[üu]her\b|\bstand hier\b|\bw[äa]re\b|\bw[äa]ren\b|\bh[äa]tte\b"
    r"|\bh[äa]tten\b|\bwenn\b|\bfalls\b|\bsobald\b|\bsolange\b"
    r"|\bnicht als\b|\bDefinition\b|\bBegriff\b|\bm[üu]sste\b", re.I)


def pruefe_status_im_text(bauskript: str) -> list[str]:
    """Findet Freigabestatus, die als Wort im Fliesstext behauptet werden.

    Geprueft wird das BAUSKRIPT, nicht das gebaute Notebook - und das ist
    der ganze Witz: Im Notebook ist {{status_a}} laengst durch "nicht
    freigegeben" ersetzt, und ein gesetzter Platzhalter saehe dann genauso
    aus wie ein von Hand getippter Status. Ein Pruefer, der das nicht
    unterscheiden kann, meldet die richtigen Stellen nicht und die
    falschen dafuer alle.

    Markdown kann nicht rechnen. Ein Satz wie "freigegeben als
    Entscheidungshilfe" bleibt stehen, wenn das Gate darunter kippt - und
    dann sagt dieselbe Seite an zwei Stellen Verschiedenes.

    Gedeckt sind Saetze, die den Status nicht behaupten: mit Platzhalter,
    als Definition, als Bedingung oder als Bericht ueber eine fruehere
    Fassung.
    """
    befunde = []
    for nr, block in enumerate(re.findall(r'MD\("""(.*?)"""\)', bauskript, re.S), 1):
        for satz in re.split(r"(?<=[.:!?])\s+|\n(?=[|>#])", block):
            if not STATUSWORT.search(satz) or STATUS_GEDECKT.search(satz):
                continue
            befunde.append(f"MD-Block {nr}: '{satz.strip()[:90]}' - ein "
                           f"Freigabestatus als Wort im Fliesstext; er wandert "
                           f"nicht mit, wenn das Gate kippt (Platzhalter setzen)")
    return befunde


def pruefe_platzhalterrest(markdown: list[str], bauskript: str) -> list[str]:
    """Findet Platzhalter, die im gebauten Notebook noch als Text dastehen.

    Ein Platzhalter wird beim Bauen durch seinen Wert ersetzt. Bleibt er
    stehen, ist entweder der Schluessel nie gemerkt worden oder die Klammern
    stimmen nicht - {{wert:.1f} mit einer schliessenden Klammer zu wenig sieht
    im Quelltext richtig aus und wird von keinem Muster erfasst. Der Leser
    bekommt dann rohe Zeichen zu sehen, wo eine Zahl stehen sollte.

    Geprueft wird gegen BEIDE Seiten: das gebaute Notebook (steht dort noch
    eine geschweifte Klammer?) und das Bauskript (ist ein Platzhalter falsch
    geschlossen?). Der zweite Teil faengt den Fehler, bevor er sichtbar wird.
    """
    befunde = []
    for i, text in enumerate(markdown, 1):
        for treffer in re.findall(r"\{\{[a-z0-9_]+(?::[^}\n]*)?\}{0,2}", text):
            befunde.append(f"Markdownzelle {i}: '{treffer}' ist im gebauten "
                           f"Notebook stehengeblieben - der Leser sieht rohe Zeichen "
                           f"statt einer Zahl")
    for treffer in re.findall(r"\{\{[a-z0-9_]+:[^}\n]+\}(?!\})", bauskript):
        befunde.append(f"Bauskript: '{treffer}' ist nicht mit '}}}}' geschlossen "
                       f"und wird deshalb nie ersetzt")
    return befunde


def main() -> int:
    dateien = sorted(NOTEBOOKS.glob("*.ipynb"))
    if not dateien:
        print("Keine Notebooks gefunden.")
        return 2
    gesamt = gesamt_hinweise = 0
    for pfad in dateien:
        code, ausgaben, markdown = zellen(pfad)
        # Zum Notebook gehoert sein Bauskript - dort stehen die Platzhalter noch.
        skripte = sorted((BASIS / "analytics" / "bau").glob("nb0*.py"))
        passend = [s for s in skripte
                   if pfad.stem.split("_")[0].lstrip("0") in s.name.split("_")[0]]
        bauskript = passend[0].read_text(encoding="utf-8") if passend else ""
        fehler = (pruefe_blinder_abgleich(code, ausgaben)
                  + pruefe_sichtbarer_rest(code)
                  + pruefe_harte_quelle(code)
                  + pruefe_ladepfad(code)
                  + pruefe_hartes_urteil(code)
                  + pruefe_status_ohne_wirkung(code)
                  + pruefe_harte_ergebnisnamen(bauskript)
                  + pruefe_gate_ohne_sperre(bauskript)
                  + pruefe_platzhalterrest(markdown, bauskript)
                  + pruefe_urteil_im_text(markdown)
                  + pruefe_status_im_text(bauskript)
                  + pruefe_gate_mit_fremder_zahl(code)
                  + pruefe_artefakt_ohne_waechter(code)
                  + pruefe_altprosa(markdown, ausgaben, bauskript))
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
