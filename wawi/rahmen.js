// ============================================
// VeloCity Warenwirtschaft — Rahmen
//
// Die Oberfläche muss VIER Zustände unterscheiden können, die im
// Browser gleich aussehen:
//
//   1. nicht angemeldet             -> Anmeldemaske
//   2. angemeldet, kein Mitarbeiter -> Hinweis, kein Zugang
//   3. Mitarbeiter ohne Rolle       -> Hinweis, wer helfen kann
//   4. Mitarbeiter mit Rollen       -> Arbeitsoberfläche
//
// Der zweite Fall ist der häufigste und der, den man vergisst: JEDER
// Kunde kann sich hier anmelden, weil es dieselbe auth.users ist. Er
// bekäme dann eine Oberfläche, in der jede Sicht null Zeilen liefert -
// fehlerfrei, leer, unerklärlich. Deshalb wird vor dem Aufbau gefragt,
// nicht danach.
//
// Der dritte Fall ist der, der bei genau einem Mitarbeiter im Bestand
// (VeloCity heute) zum NORMALFALL für jeden zweiten neuen Kollegen wird:
// ein echtes Mitarbeiterkonto, dem noch niemand eine Rolle zugeteilt hat.
// meineRollen() liefert dafür ein LEERES Set - anders als "false" für
// "kein Mitarbeiter". Beide vorher gleich zu behandeln ("Kein Zugang")
// schickte diesen Fall in die falsche Richtung: er gehört nicht zur
// Kundenverwaltung, sondern zur Leitung, die eine Rolle nachtragen kann.
// Deshalb hier vier Fälle statt drei, unterschieden per
// `rollen instanceof Set` statt per Wahrheitswert - ein leeres Set ist
// falsy in JavaScript, eine reine `if (rollen)`-Prüfung hätte es mit
// "nicht angemeldet"/"kein Mitarbeiter" verwechselt.
// ============================================

// ===== Mehrsprachigkeit (Gestaltungsauftrag, woertlich: "eine Umstellung
// der Oberflaeche auf englisch, tuerkisch, spanisch, italienisch und
// polnisch. Nur das GUI.") =====
//
// DIE GRENZE OBERFLAECHE GEGEN DATEN (Auftrag: das ist der fachliche
// Kern dieser Aufgabe) - uebersetzt wird, was die OBERFLAECHE selbst
// sagt: Menuepunkte, Spaltenkoepfe, Schaltflaechen, Meldungen,
// Dialogtexte, Feldbeschriftungen, Leermasken, Erlaeuterungen in den
// Uebersichtskacheln. NICHT uebersetzt werden Daten aus der Datenbank:
// Kunden-, Stations- und Ortsnamen, Beschreibungstexte von
// Schadensmeldungen, Tarifnamen, Rahmennummern, Hersteller- und
// Modellbezeichnungen ("City-Bike" ist ein Produktname, keine
// Oberflaechenbeschriftung - Auftrag, woertlich als Beispiel genannt).
//
// DIE STATUSWERTE SIND DER ENTSCHEIDENDE GRENZFALL (Auftrag,
// ausdruecklich zu entscheiden): 'verfuegbar', 'gesperrt',
// 'fahruntauglich', 'in_arbeit' und aehnliche Aufzaehlungswerte SIND
// DATEN - sie stehen unveraendert in der Datenbank, gehen unveraendert
// in jeden rufeAuf()/api_*-Aufruf und werden nirgends aus einer
// Uebersetzung zurueckgerechnet. STATUS_ANZEIGE weiter unten uebersetzt
// ausschliesslich die ANZEIGE dieses Werts, niemals den Wert selbst. Fuer
// Deutsch bleibt diese Anzeige an den Stellen, an denen bisher der rohe
// Wert selbst stand (die Status-Spalte in Flotte, das Textfeld in
// radMaske() u. ae.), MIT ABSICHT identisch mit dem rohen Wert
// ("verfuegbar", nicht "Verfügbar") - Zug 1 dieses Auftrags verlangt,
// dass Deutsch nach dem Umbau GENAU wie vorher aussieht, und genau dort
// stand vorher der rohe Wert. Die Filterleiste zeigte an denselben
// Stellen schon VOR diesem Auftrag eine eigene, huebsch geschriebene
// Bezeichnung ("Verfügbar") - dieser Unterschied ist ein deutsches Erbe
// aus der Zeit vor dieser Aufgabe und wird hier nicht eingeebnet, siehe
// status.raw.*/status.label.* in der Uebersetzungstabelle weiter unten.
const SPRACHEN = ['de', 'en', 'tr', 'es', 'it', 'pl'];

// Eigenname jeder Sprache, so wie ihre Sprecher sie selbst schreiben
// wuerden - fuer die Sprachauswahl im Einstellungsmenue. Nicht uebersetzt:
// ein Sprachname wird ueblicherweise in jeder Sprache gleich benannt
// (vgl. jede Betriebssystem-Spracheinstellung).
const SPRACHNAMEN = { de: 'Deutsch', en: 'English', tr: 'Türkçe', es: 'Español', it: 'Italiano', pl: 'Polski' };

// BCP-47-Sprachtag je Sprache - fuer Intl.NumberFormat/DateTimeFormat/
// PluralRules UND fuer das lang-Attribut auf <html> (Auftrag: "sonst
// liest ein Screenreader Tuerkisch mit deutscher Aussprache").
const SPRACHE_LOCALE_TAG = { de: 'de-DE', en: 'en-US', tr: 'tr-TR', es: 'es-ES', it: 'it-IT', pl: 'pl-PL' };

const SPRACHE_SPEICHERSCHLUESSEL = 'velocity-wawi-sprache';

// Dieselbe Haltbarkeit wie beim Zebramuster weiter unten (localStorage
// statt einer Datenbankspalte, siehe dortiger Kommentar) - eine reine
// Anzeigepraeferenz, "nichts an der Datenbank aendern" (Auftrag).
function sprache() {
    const gespeichert = localStorage.getItem(SPRACHE_SPEICHERSCHLUESSEL);
    return SPRACHEN.includes(gespeichert) ? gespeichert : 'de';
}

function localeTag() {
    return SPRACHE_LOCALE_TAG[sprache()];
}

// ----- Nachschlagefunktion -----
//
// Schluessel bewusst englisch und punktnotiert (Bereich.Sache) - Auftrag,
// woertlich: "die Schluessel der Uebersetzungstabelle duerfen englisch
// sein, wenn das sauberer ist". UEBERSETZUNGEN selbst steht in
// rahmen_i18n_daten.js (aus einer Python-Tabelle erzeugt, siehe deren
// Kopf) - eine einzige Datenstruktur statt fuenf verstreuter Tabellen,
// damit ein fehlender Schluessel in einer Sprache beim Erstellen sofort
// auffiel (Validierung lief bereits gegen alle sechs Sprachen).
function t(schluessel, platzhalter) {
    const tabelle = UEBERSETZUNGEN[sprache()] || UEBERSETZUNGEN.de;
    let text = tabelle[schluessel];
    if (text === undefined) {
        console.warn(`t(): fehlender Schluessel "${schluessel}" fuer Sprache "${sprache()}", falle auf Deutsch zurueck.`);
        text = UEBERSETZUNGEN.de[schluessel];
    }
    if (text === undefined) {
        console.warn(`t(): Schluessel "${schluessel}" existiert in keiner Sprache.`);
        return schluessel;
    }
    if (platzhalter) {
        for (const [name, wert] of Object.entries(platzhalter)) {
            text = text.replaceAll(`{${name}}`, wert);
        }
    }
    return text;
}

// ----- Mengenformen (Fallstrick 1: Mehrzahl) -----
//
// "zahl + ' Raeder'" (Zeichenketten zusammenkleben) geht in mindestens
// zwei Sprachen schief (Auftrag, woertlich): Polnisch braucht DREI Formen
// (1 / 2-4 / 5+, und die Zehner brechen die Regel erneut), Tuerkisch NULL
// Formen (nach einer Zahl bleibt das Hauptwort immer in der Grundform,
// "275 bisiklet" nicht "bisikletler"). Intl.PluralRules kennt diese
// Regeln bereits (Auftrag: "benutze es, statt sie nachzubauen") -
// MENGENFORMEN traegt deshalb nur noch die FERTIGEN FORMEN je Kategorie
// ('one'/'few'/'many'/'other', wie PluralRules sie fuer die jeweilige
// Sprache liefert), keine eigene Zaehllogik.
//
// Tuerkisch traegt 'one' UND 'other' mit demselben Text (siehe
// rahmen_i18n_daten.js) - ausdruecklich beide gesetzt, nicht nur 'other'
// plus Rueckfall: ein Rueckfall waere fuer zahl===1 zufaellig richtig,
// sagt aber nicht, dass hier Absicht steckt (Tuerkisch kennt nach einem
// Zahlwort schlicht keine Mehrzahl).
function mengeFormat(zahl, einheit, platzhalter = {}) {
    const formenSprache = (MENGENFORMEN[einheit] && MENGENFORMEN[einheit][sprache()])
        || (MENGENFORMEN[einheit] && MENGENFORMEN[einheit].de);
    if (!formenSprache) {
        console.warn(`mengeFormat(): unbekannte Einheit "${einheit}".`);
        return String(zahl);
    }
    const kategorie = new Intl.PluralRules(localeTag()).select(zahl);
    const form = formenSprache[kategorie] || formenSprache.other;
    let text = form.replaceAll('{n}', zahlFormat(zahl));
    for (const [name, wert] of Object.entries(platzhalter)) {
        text = text.replaceAll(`{${name}}`, wert);
    }
    return text;
}

// ----- Statuswerte: Wert bleibt Daten, nur die Anzeige folgt der Sprache -----
//
// code: der ROHE Wert aus der Datenbank ('verfuegbar', 'aktiv', ...) -
// NIEMALS veraendert, nur zum Nachschlagen benutzt. huebsch=true liefert
// die Form, die die Filterleisten schon vor diesem Auftrag zeigten
// ("Verfügbar"); huebsch=false (Vorgabe) liefert fuer Deutsch bewusst den
// unveraenderten Rohwert zurueck (Zug 1: "sieht genau wie vorher aus"),
// fuer jede andere Sprache dieselbe uebersetzte Anzeige wie huebsch=true -
// der Unterschied zwischen roh/huebsch ist ein rein deutsches Erbe aus
// der Zeit vor diesem Auftrag (siehe Kopfkommentar oben).
function statusAnzeige(code, huebsch = false) {
    if (!code) return code;
    const schluessel = `status.${huebsch ? 'label' : 'raw'}.${code}`;
    const tabelle = UEBERSETZUNGEN[sprache()] || UEBERSETZUNGEN.de;
    if (tabelle[schluessel] === undefined) return code;   // unbekannter Wert: unveraendert zeigen statt zu raten
    return t(schluessel);
}

// Fuer Saetze, in die ein Statuscode als WORT eingebaut wird (z. B. "Rad
// ... steht jetzt auf {ziel}.", flotte.js) - fuer Deutsch bleibt das der
// rohe, kleingeschriebene Code (Zug 1: identisch mit dem Bestand vor
// diesem Auftrag), fuer jede andere Sprache die uebersetzte, lesbare
// Form. Nicht dasselbe wie statusAnzeige(code) mit huebsch=false: JENE
// Funktion beschriftet ein FELD (Spalte, Detailmaske), DIESE hier einen
// eingebetteten Fliesstextteil - beide treffen fuer Deutsch dieselbe
// Wahl (roh), aus demselben Grund.
function statusWortInSatz(code) {
    return sprache() === 'de' ? code : statusAnzeige(code, true);
}

// ----- Zahlen, Geld, Datum, Zeit (Fallstrick 2) -----
//
// Bisher ueberall fest 'de-DE' - fuer einen englischen Nutzer muss
// "35.454,47 €" zu "35,454.47 €" werden (Auftrag, woertlich). Die
// Waehrung bleibt der Euro (Auftrag: "das ist keine Sprachfrage") - nur
// die FORMATIERUNG (Trennzeichen, Stellung des Symbols) folgt der
// gewaehlten Sprache, ueber Intl mit currency:'EUR' und dem jeweiligen
// Sprachtag.
function zahlFormat(zahl, optionen) {
    return Number(zahl).toLocaleString(localeTag(), optionen);
}

function geldFormatZentral(betrag) {
    return Number(betrag).toLocaleString(localeTag(), { style: 'currency', currency: 'EUR' });
}

function datumFormat(datum, optionen) {
    return new Date(datum).toLocaleDateString(localeTag(), optionen);
}

function zeitFormat(datum, optionen) {
    return new Date(datum).toLocaleTimeString(localeTag(), optionen);
}

// Trennzeichen der aktuellen Sprache, fuer zahlSkaliert() weiter unten:
// die Funktion bekommt eine FERTIG formatierte Zahl und muss ihre
// Gruppen erkennen, um die Tausendertrennzeichen optisch zurueckzunehmen -
// dafuer muss sie wissen, WELCHES Zeichen in der aktuellen Sprache die
// Gruppe trennt (Punkt in de-DE, Komma in en-US, ein schmales geschuetztes
// Leerzeichen in pl-PL) und welches die Dezimalstelle einleitet.
//
// GEMESSEN AN 1.234.567,5 UND NICHT MEHR AN 1.234,5: Polnisch, Spanisch
// und Italienisch gruppieren VIERSTELLIGE Zahlen gar nicht ("1234,5"),
// die Probe lieferte dort also ueberhaupt kein group-Teil und fiel auf den
// Vorgabewert '.' zurueck. Fuer Spanisch/Italienisch stimmte dieser Zufall
// gerade noch, fuer Polnisch (U+00A0) nicht: zahlSkaliert() hielt das
// Leerzeichen dann fuer das Ende der Zahl und liess von "35 387,17 €" nur
// die "35" in voller Staerke stehen, der ganze Rest verblasste (im Browser
// nachgestellt, siehe Bericht). Siebenstellig gruppiert JEDE der sechs
// Sprachen.
// Eine JAHRESZAHL ist keine Menge: "2.021" ist ein Tausendertrennzeichen
// an einer Stelle, an der niemand eines erwartet (im Browser aufgefallen,
// siehe Bericht - der Spaltenkopf der Flotte las sich als "2.021 - 2.025").
// Intl kennt dafuer useGrouping:false; die Sprache bestimmt weiterhin die
// Ziffernform, nur die Gruppierung faellt weg.
function jahrFormat(jahr) {
    return zahlFormat(jahr, { useGrouping: false });
}

function zahlTrennzeichen() {
    const teile = new Intl.NumberFormat(localeTag()).formatToParts(1234567.5);
    return {
        gruppe: teile.find((tl) => tl.type === 'group')?.value || '.',
        dezimal: teile.find((tl) => tl.type === 'decimal')?.value || ','
    };
}
const UEBERSETZUNGEN = {
  de: {
    "common.cancel": "Abbrechen",
    "common.confirm": "Bestätigen",
    "common.reason": "Grund",
    "common.all": "Alle",
    "common.actionsColumn": "Aktionen",
    "common.noSearchPlaceholder": "In diesem Bereich keine Suche",
    "common.noSearchAria": "Suche in diesem Bereich nicht verfügbar",
    "common.confirmWordPrompt": "Zum Bestätigen \"{wort}\" eintippen:",
    "common.sortAria": "Nach {titel} sortieren",
    "common.sortAriaSuffix": ", aktuell {richtung}",
    "common.ascending": "aufsteigend",
    "common.descending": "absteigend",
    "common.sortResetAria": "Sortierung nach {titel} zurücksetzen",
    "common.sortResetTitle": "Sortierung zurücksetzen",
    "common.groupByAria": "Nach {titel} gruppieren",
    "common.groupResetAria": "Gruppierung nach {titel} aufheben",
    "common.groupResetTitle": "Gruppierung zurücksetzen",
    "common.groupTitle": "Gruppieren",
    "common.filterAria": "{titel} filtern",
    "common.filterMinAria": "Mindestwert für {titel}",
    "common.filterSearchPlaceholder": "Suche…",
    "common.filterResetAria": "{titel}-Filter zurücksetzen",
    "common.filterResetTitle": "Filter zurücksetzen",
    "common.columnFilterReset": "Spaltenfilter zurücksetzen",
    "common.noRowsMatchFilter": "Keine Zeile erfüllt die gewählte Einschränkung am Spaltenkopf. ",
    "common.groupedBy": "Gruppiert nach {titel}",
    "common.ungroup": "Gruppierung aufheben",
    "common.groupHeaderLabel": "{titel}: {beschriftung} ({n})",
    "common.closeDetailsAria": "Details schließen",
    "common.closeDetailsTitle": "Details schließen (Esc)",
    "common.rowsFiltered": "{angezeigt} von {zeilenPhrase} (Spaltenfilter aktiv)",
    "common.selectedCount": "{n} ausgewählt",
    "common.minAbbrev": "Min.",
    "common.hourAbbrev": "Std.",
    "common.underOneMinute": "unter 1 Min.",
    "common.loggedInFor": "{dauer} angemeldet",
    "common.sinceOpen": "seit dem Öffnen: {dauer}",
    "common.loginCheckFailed": "Anmeldung konnte nicht geprüft werden: {msg}",
    "common.loginBadCredentials": "E-Mail oder Passwort stimmen nicht.",
    "common.rolesCheckFailed": "Die Rollen ließen sich nicht ermitteln: {msg}",
    "common.roleCheckFailed": "Rolle {code} ließ sich nicht prüfen: {msg}",
    "common.of": "von",
    "common.xOfPhrase": "{x} von {phrase}",
    "misc.estimatedParen": " ({prozent} geschätzt)",
    "hint.ridesPerDayHeading": "Fahrten je Tag — {monat} (gesamt, alle Radtypen und Tarife)",
    "status.label.abgebrochen": "abgebrochen",
    "status.raw.abgebrochen": "abgebrochen",
    "status.label.erledigt": "erledigt",
    "status.raw.erledigt": "erledigt",
    "status.label.verworfen": "verworfen",
    "status.raw.verworfen": "verworfen",
    "status.label.behoben": "behoben",
    "status.raw.behoben": "behoben",
    "msg.stationsWithoutBikeSuffix": ", {n} davon ohne Rad",
    "empty.noStationOccupancyText": "Es liegt keine Station vor. Bei zehn angelegten Stationen ist das ungewoehnlich - moeglich ist ein zwischenzeitlicher Rollenverlust statt fehlender Daten.",
    "empty.noStationOccupancyTitle": "Keine Stationsauslastung",
    "msg.stationOccupancyLoadFailed": "Die Stationsauslastung ließ sich nicht laden: {fehler}",
    "misc.estimatedRidesDetail": "{geschaetzt} von {fahrtenPhrase} ({prozent})",
    "msg.kmCo2Summary": "{monatszeilen}, {fahrten}, CO₂-Ersparnis gesamt {co2}, davon {prozent} geschätzt (fahrtgewichtet)",
    "empty.noKmCo2Title": "Keine Kilometer- und CO2-Zeilen",
    "msg.kmCo2LoadFailed": "Kilometer und CO₂ ließen sich nicht laden: {fehler}",
    "field.jeKunde": "Je Kunde",
    "msg.revenueByCustomerGroupSummary": "{monatszeilen}, Umsatz gesamt {umsatz}",
    "empty.noRevenueByCustomerGroupTitle": "Kein Umsatz nach Kundengruppe",
    "msg.revenueByCustomerGroupLoadFailed": "Der Umsatz nach Kundengruppe ließ sich nicht laden: {fehler}",
    "msg.revenueByBikeTypeSummary": "{monatszeilen}, {fahrten}, Umsatz gesamt {umsatz}",
    "msg.revenueByBikeTypeLoadFailed": "Der Umsatz nach Radtyp ließ sich nicht laden: {fehler}",
    "empty.noRevenueByBikeTypeText": "Es liegt keine Monatszeile vor. Bei einem gefuellten Referenzjahr ist das ungewoehnlich - moeglich ist ein zwischenzeitlicher Rollenverlust statt fehlender Daten.",
    "empty.noRevenueByBikeTypeTitle": "Kein Umsatz nach Radtyp",
    "misc.estimatedSuffix": " (geschätzt)",
    "field.strecke": "Strecke",
    "field.dauer": "Dauer",
    "field.ziel": "Ziel",
    "field.start": "Start",
    "misc.bikesOnDateCaption": "Räder am {datum} - kein Kundenbezug, siehe v_wawi_fahrten_je_tag_rad",
    "button.backToDayOverview": "Zurück zur Tagesübersicht",
    "misc.bikesOnDate": "Räder am {datum}",
    "misc.noBikeRiddenThisDay": "An diesem Tag wurde kein Rad gefahren.",
    "msg.thisDayBikesLoadFailed": "Die Räder dieses Tages ließen sich nicht laden: {fehler}",
    "hint.legendColorScale": "Farbe = Fahrten dieses Tages im Verhältnis zum verkehrsreichsten Tag des Monats ({phrase}).",
    "hint.dayRidesAria": "{datum}: {phrase}",
    "hint.calendarCaption": "Fahrten je Tag, {monat}",
    "hint.tiedDaysCount": "{tagePhrase} gleichauf, je {phrase}",
    "hint.totalForMonth": "{phrase}, gesamt",
    "hint.dailyRidesChartAria": "Fahrten je Tag im {monat} {jahr}, gesamt über alle Radtypen und Tarife: zwischen {min} und {maxPhrase}, im Mittel {mittel}. Am meisten Fahrten am {tageListe} {monat} mit je {maxPhrase}.",
    "msg.dailyFiguresLoadFailed": "Die Tageszahlen ließen sich nicht laden: {fehler}",
    "misc.workOrderTitle": "Auftrag {auftragsnummer}",
    "msg.activeWorkOrdersCount": "{n} laufende Wartungsaufträge",
    "misc.reportForBike": "Meldung zu {rahmennummer}",
    "msg.openDamageWithUnrideable": "{n}{zusatz} offene Schäden, davon {dringend} fahruntauglich",
    "msg.openDamageCount": "{n}{zusatz} offene Schäden",
    "misc.atLeastValue": "≥ {n} {einheit}",
    "misc.allLowercase": "alle",
    "field.minAge": "Mindestalter",
    "field.offenSeit": "Offen seit",
    "field.gemeldet": "Gemeldet",
    "misc.stillRunning": "{datum} · läuft noch",
    "misc.noRentalYet": "Noch keine Ausleihe",
    "msg.stationCreated": "Station {name} angelegt.",
    "msg.capacityPositiveInteger": "Die Stellplatzzahl muss eine positive ganze Zahl sein.",
    "msg.longitudeRange": "Die Länge muss zwischen -180 und 180 liegen.",
    "msg.latitudeRange": "Die Breite muss zwischen -90 und 90 liegen.",
    "msg.latLonRequired": "Breite und Länge werden benötigt.",
    "msg.stationFieldsRequired": "Name, Straße, Hausnummer, PLZ und Ort werden benötigt.",
    "field.laenge": "Länge",
    "field.breite": "Breite",
    "field.hausnummerVoll": "Hausnummer",
    "field.name": "Name",
    "hint.arrivalsPerDayLabel": "{label}: {n} Zugänge je Tag",
    "hint.departuresPerDayLabel": "{label}: {n} Abgänge je Tag",
    "hint.trafficPatternAria": "{wochentypTitel} bei {name}, gemittelt über {tage} Tage. Die meisten Abgänge liegen im Zeitfenster {zeitfensterAb} mit {maxAb} je Tag, die meisten Zugänge im Zeitfenster {zeitfensterZu} mit {maxZu} je Tag.",
    "hint.stationFullNote": " Die Station ist voll und nimmt aktuell keine Rückgabe an.",
    "hint.stationOccupancyAria": "Belegung {name}: {belegt} von {kapazitaet} Stellplätzen, {prozent} Prozent. 100 Prozent ist die Kapazität dieser einen Station.{vollZusatz}",
    "map.openDetailsSuffix": ". Details öffnen.",
    "map.stationFullSuffix": ", voll - nimmt aktuell keine Rückgabe an",
    "map.stationBelegLabel": "{name}: {belegt} von {kapazitaet} Stellplätzen belegt",
    "map.customerLabelShort": "{ort} ({n})",
    "map.currentStationSuffix": " - das ist die angezeigte Station",
    "misc.freeShort": "{n} frei",
    "misc.unitsInStock": "{n} im Bestand",
    "nav.originDamageReport": "Schadensmeldung zu {rahmennummer}",
    "nav.originBikeFromStation": "Rad {rahmennummer} von {name}",
    "nav.originBikeFromFleet": "Rad {rahmennummer} aus der Flotte",
    "index.title": "VeloCity Warenwirtschaft",
    "index.brandLinkAria": "VeloCity – öffentliche Website, öffnet in neuem Tab",
    "index.loading": "Einen Moment …",
    "index.loginEmail": "E-Mail",
    "index.loginPassword": "Passwort",
    "index.loginSubmit": "Anmelden",
    "index.noAccessTitle": "Kein Zugang",
    "index.noAccessText": "Dieses Konto ist bei VeloCity nicht als Mitarbeitendenkonto hinterlegt. Wenn Sie Kundin oder Kunde sind, finden Sie Ihren Bereich unter",
    "index.logout": "Abmelden",
    "index.noRoleTitle": "Noch keine Rolle zugeteilt",
    "index.noRoleText": "Ihr Konto ist bei VeloCity als Mitarbeitendenkonto hinterlegt, aber es wurde noch kein Aufgabenbereich zugeordnet. Wenden Sie sich an die Leitung, damit sie Ihnen eine Rolle zuteilt.",
    "index.searchPlaceholder": "Suchen",
    "index.profileAria": "Profil und Einstellungen",
    "index.navToggleAria": "Navigation ein- und ausklappen",
    "index.settingsHeading": "Einstellungen",
    "index.zebraLabel": "Zebrastreifen in Tabellen",
    "index.languageLabel": "Sprache",
    "index.navAria": "Aufgabenbereiche",
    "index.workListAria": "Arbeitsliste",
    "index.detailAria": "Detailmaske",
    "nav.flotte": "Flotte",
    "nav.stationen": "Stationen",
    "nav.kunden": "Kundschaft",
    "nav.instandhaltung": "Instandhaltung",
    "nav.auswertungen": "Auswertungen",
    "nav.kundenSuche": "Kundschaft: Name, E-Mail, Kundennummer",
    "field.rahmennummer": "Rahmennummer",
    "field.typ": "Typ",
    "field.status": "Status",
    "field.standort": "Standort",
    "field.schaeden": "Schäden",
    "field.modell": "Modell",
    "field.angeschafft": "Angeschafft",
    "field.letzteWartung": "Letzte Wartung",
    "field.offeneSchaeden": "Offene Schäden",
    "field.hoechsteSchwere": "Höchste Schwere",
    "field.radtyp": "Radtyp",
    "field.station": "Station",
    "field.nummer": "Nummer",
    "field.ort": "Ort",
    "field.belegt": "Belegt",
    "field.frei": "Frei",
    "field.anschrift": "Anschrift",
    "field.stellplaetze": "Stellplätze",
    "field.lage": "Lage",
    "field.betrieb": "Betrieb",
    "field.akku": "Akku",
    "field.nachname": "Nachname",
    "field.vorname": "Vorname",
    "field.tarif": "Tarif",
    "field.kundeSeit": "Kunde seit",
    "field.letzteAusleihe": "Letzte Ausleihe",
    "field.anrede": "Anrede",
    "field.email": "E-Mail",
    "field.telefon": "Telefon",
    "field.strasse": "Straße",
    "field.hausnummer": "Nr.",
    "field.plz": "PLZ",
    "field.hinweis": "Hinweis",
    "field.fahrten": "Fahrten",
    "field.umsatz": "Umsatz",
    "field.offen": "Offen",
    "field.kategorie": "Kategorie",
    "field.gemeldetVon": "Gemeldet von",
    "field.gemeldetAm": "Gemeldet am",
    "field.beschreibung": "Beschreibung",
    "field.schwere": "Schwere",
    "field.stand": "Stand",
    "field.bisherigeAuftraege": "Bisherige Aufträge",
    "field.rad": "Rad",
    "field.auftrag": "Auftrag",
    "field.eroeffnet": "Eröffnet",
    "field.bearbeiter": "Bearbeiter",
    "field.arbeitszeitMinuten": "Arbeitszeit (Minuten)",
    "field.bemerkung": "Bemerkung",
    "field.kapazitaet": "Kapazität",
    "field.abgaenge": "Abgänge",
    "field.zugaenge": "Zugänge",
    "field.saldo": "Saldo",
    "field.fuellstand": "Füllstand",
    "field.monat": "Monat",
    "field.minuten": "Minuten",
    "field.jeFahrt": "Je Fahrt",
    "field.minutenJeFahrt": "Minuten je Fahrt",
    "field.deltaVormonat": "Δ ggü. Vormonat",
    "field.kunden": "Kunden",
    "field.fahrtenJeKunde": "Fahrten je Kunde",
    "field.kilometer": "Kilometer",
    "field.kilometerJeFahrt": "Kilometer je Fahrt",
    "field.co2Ersparnis": "CO₂-Ersparnis",
    "field.davonGeschaetzt": "Davon geschätzt",
    "status.raw.verfuegbar": "verfuegbar",
    "status.label.verfuegbar": "Verfügbar",
    "status.raw.ausgeliehen": "ausgeliehen",
    "status.label.ausgeliehen": "Ausgeliehen",
    "status.raw.wartung": "wartung",
    "status.label.wartung": "Wartung",
    "status.raw.defekt": "defekt",
    "status.label.defekt": "Defekt",
    "status.raw.ausgemustert": "ausgemustert",
    "status.label.ausgemustert": "Ausgemustert",
    "status.raw.aktiv": "aktiv",
    "status.label.aktiv": "Aktiv",
    "status.raw.gesperrt": "gesperrt",
    "status.label.gesperrt": "Gesperrt",
    "status.raw.geschlossen": "geschlossen",
    "status.label.geschlossen": "Geschlossen",
    "status.raw.offen": "offen",
    "status.label.offen": "Offen",
    "status.raw.in_arbeit": "in_arbeit",
    "status.label.in_arbeit": "In Arbeit",
    "schwere.gering": "gering",
    "schwere.mittel": "mittel",
    "schwere.fahruntauglich": "fahruntauglich",
    "button.newBike": "Neues Rad anlegen",
    "button.create": "Anlegen",
    "button.setTo": "Auf {ziel} setzen",
    "button.whyTarget": "Warum {ziel}?",
    "button.decommission": "Ausmustern",
    "button.decommissionReason": "Grund der Ausmusterung",
    "button.newStation": "Neue Station anlegen",
    "button.decommissionStation": "Stilllegen",
    "button.newCustomer": "Neuen Kunden anlegen",
    "button.save": "Speichern",
    "button.block": "Sperren",
    "button.blockReason": "Grund der Sperrung",
    "button.disclosureArt15": "Auskunft nach Art. 15",
    "button.deletionArt17": "Löschung nach Art. 17",
    "button.downloadJson": "Als JSON herunterladen",
    "button.close": "Schließen",
    "button.reportDamage": "Schaden melden",
    "button.openWorkOrder": "Auftrag eröffnen",
    "button.bikeInFleet": "Rad in der Flotte",
    "button.report": "Melden",
    "button.resolve": "Erledigen",
    "button.toOpenDamage": "Zu den offenen Schäden",
    "button.damageInFleet": "Rad in der Flotte",
    "button.list": "Liste",
    "button.map": "Landkarte",
    "button.showCustomersOnMap": "Kundschaft je Ort einblenden",
    "empty.noBikesFilterTitle": "Keine Räder mit diesem Filter",
    "empty.noBikesFilterText": "Kein Rad in der Flotte erfüllt die gewählte Einschränkung.",
    "empty.noCustomersFilterTitle": "Keine Kunden mit diesem Filter",
    "empty.noCustomersFilterTextSearch": "Kein Kunde zu „{suchtext}“ erfüllt zusätzlich die gewählte Einschränkung.",
    "empty.noCustomersFilterText": "Kein Kunde erfüllt die gewählte Einschränkung.",
    "empty.statusFilterReset": "Statusfilter zurücksetzen",
    "empty.noOpenDamageTitle": "Keine offenen Schäden",
    "empty.noOpenDamageText": "Es liegt derzeit keine Schadensmeldung vor. Das ist der Normalfall — gemeldet wird, wenn an einem Rad etwas auffällt.",
    "empty.noDamageFilterTitle": "Keine Schäden mit diesem Filter",
    "empty.noDamageFilterText": "Keine offene Schadensmeldung erfüllt die gewählte Einschränkung.",
    "empty.noWorkOrdersTitle": "Keine laufenden Wartungsaufträge",
    "empty.noWorkOrdersText": "Es liegt derzeit kein Wartungsauftrag vor. Ein Auftrag entsteht aus einer offenen Schadensmeldung — dort gibt es den Knopf „Auftrag eröffnen“.",
    "misc.underway": "unterwegs",
    "misc.underwayNoLocation": "unterwegs (kein Standort)",
    "misc.noneYet": "noch keine",
    "misc.noMembership": "ohne Mitgliedschaft",
    "misc.notYetAssigned": "noch nicht zugeteilt",
    "misc.justNow": "gerade eben",
    "misc.inOperation": "in Betrieb",
    "misc.decommissionedState": "stillgelegt",
    "misc.noAddressOnFile": "Für diese Person ist keine Adresse hinterlegt - das ist kein Ladefehler. Die Felder darunter lassen sich ausfüllen, um eine nachzutragen.",
    "misc.disclosureLoggedNote": "Der Abruf der Auskunft nach Art. 15 wird protokolliert (GR19): wer sie einsieht, hinterlässt eine Spur im Änderungsprotokoll.",
    "misc.damageBlocksImmediately": "Ein fahruntauglicher Schaden sperrt das Rad sofort - außer es ist gerade in Fahrt. Dann bleibt der Status vorerst unverändert (GR13 erlaubt einem Rad unterwegs keinen anderen Status) und die Sperrung greift erst bei der Rückgabe.",
    "misc.onlyUnrideableBlocks": "Nur eine fahruntaugliche Meldung sperrt das Rad automatisch.",
    "misc.noMinutesNeeded": "Die Arbeitszeit in Minuten wird benötigt (0 oder mehr).",
    "art17.confirmHeader": "Löschung nach Art. 17 DSGVO für {name}?",
    "art17.whatDisappears": "WAS VERSCHWINDET: Name, E-Mail, Telefonnummer, Geburtsdatum, Anschrift, Zahlungsmittel und die Verknüpfung zum Anmeldekonto. Auch im Änderungsprotokoll werden die alten Werte unkenntlich gemacht.",
    "art17.whatRemains": "WAS BLEIBT: {phrase} und alle Rechnungen, in voller Höhe. Das Steuerrecht verlangt zehn Jahre Aufbewahrung, und die DSGVO nimmt genau diese Pflicht von der Löschung aus.",
    "art17.whatThisDoesNotAchieve": "WAS DAS NICHT LEISTET: Die Fahrten tragen Zeiten und Orte. Wer regelmäßig zur selben Zeit vom selben Punkt fährt, bleibt darüber auffindbar.",
    "art17.irreversible": "Der Vorgang ist nicht rückgängig zu machen.",
    "art17.reasonPrompt": "Grund (etwa: Antrag der betroffenen Person vom …)",
    "art17.abortedNoReason": "Abgebrochen: ohne Grund keine Löschung.",
    "art17.runningRideBlocks": "{name} hat noch eine laufende Fahrt. Erst die Rückgabe abwarten.",
    "art17.doneMessage": "Kunde {nummer} anonymisiert. Rechnungen und Fahrten bleiben erhalten.",
    "art17.confirmWord": "LOESCHEN",
    "tile.minimum": "Minimum",
    "tile.maximum": "Maximum",
    "tile.countPerMonth": "Anzahl pro Monat",
    "tile.dayWithMostRides": "Tag mit den meisten Fahrten",
    "tile.occupancy": "Belegung",
    "tile.trafficByTimeSlot": "Zu- und Abgang nach Zeitfenster",
    "tile.weekdays": "Werktags (Mo–Fr)",
    "tile.weekend": "Wochenende (Sa/So)",
    "tile.bikesAtStation": "Räder an dieser Station ({n})",
    "tile.noBikesHere": "Derzeit steht hier kein Rad - alle sind unterwegs, in der Werkstatt oder defekt.",
    "tile.noTrafficData": "Für diese Station liegen keine Verkehrszahlen vor.",
    "tile.legendDepartures": "Abgänge je Tag (oben)",
    "tile.legendArrivals": "Zugänge je Tag (unten)",
    "tab.revenueByBikeType": "Umsatz nach Radtyp",
    "tab.revenueByCustomerGroup": "Umsatz nach Kundengruppe",
    "tab.kmCo2": "Kilometer und CO₂",
    "tab.stationOccupancy": "Stationsauslastung",
    "tab.openDamage": "Offene Schäden",
    "tab.workOrders": "Wartungsaufträge",
    "auskunft.title": "Auskunft nach Art. 15 DSGVO · {name}",
    "auskunft.stammdaten": "Stammdaten",
    "auskunft.mitgliedschaften": "Mitgliedschaften",
    "auskunft.fahrten": "Fahrten",
    "auskunft.rechnungen": "Rechnungen",
    "auskunft.zahlungen": "Zahlungen",
    "auskunft.schadensmeldungen": "Schadensmeldungen",
    "auskunft.freiminuten": "Freiminuten",
    "auskunft.protokoll": "Protokoll",
    "map.mapNote": "Kreisgröße zeigt die Kapazität einer Station, die Füllung ihre aktuelle Belegung.",
    "map.areaWithCustomers": "Kartenbereich mit {stationenPhrase} und Kundenorten",
    "map.area": "Kartenbereich mit {stationenPhrase}",
    "map.customersAtLocation": "{ort}: {kundenPhrase}",
    "map.detailAreaNote": "Ausschnitt: diese Station und ihre nächsten Nachbarn.",
    "map.libraryUnavailable": "Die Kartenbibliothek konnte nicht geladen werden (vermutlich kein Netzzugriff auf das Content Delivery Network). Alle Stationsangaben bleiben in der Liste verfügbar.",
    "map.tilesUnavailable": "Kartenkacheln konnten nicht geladen werden. Die Stationsmarken unten stehen trotzdem an der richtigen Position.",
    "map.zoomIn": "Hineinzoomen",
    "map.zoomOut": "Herauszoomen",
    "tile.stationMap": "Lage im Netz",
    "tile.noStationLocation": "Für diese Station liegen keine Koordinaten vor.",
    "common.and": "und",
    "board.toggleAria": "Kopftafel ein-/ausklappen",
    "board.seriesPartPhrase": "{teil}: {wert}",
    "msg.bikeNowSetTo": "{rahmennummer} steht jetzt auf {ziel}.",
    "msg.confirmDecommission": "{rahmennummer} endgültig ausmustern? Das Rad verliert seinen Standort und erscheint in keiner Liste mehr. Seine Fahrten bleiben erhalten.",
    "msg.bikeDecommissioned": "{rahmennummer} ausgemustert.",
    "msg.fleetLoadFailed": "Die Flotte ließ sich nicht laden: {fehler}",
    "msg.noBikeWithFilter": "Kein Rad mit diesem Filter",
    "msg.modelsOrStationsLoadFailed": "Modelle oder Stationen ließen sich nicht laden: {fehler}",
    "msg.noModelsOrStations": "Es gibt weder Modelle noch Stationen, aus denen ein neues Rad angelegt werden könnte.",
    "msg.frameNumberMissing": "Die Rahmennummer fehlt.",
    "msg.bikeCreated": "Rad {rahmennummer} angelegt.",
    "msg.stationsLoadFailed": "Die Stationen ließen sich nicht laden: {fehler}",
    "msg.stationsSummary": "{stationenPhrase}, {n} davon voll: {liste}",
    "msg.stationStillHasBikes": "An {name} stehen noch {raederPhrase}. Sie müssen erst woanders zurückgegeben werden.",
    "msg.confirmDecommissionStation": "{name} zum heutigen Tag stilllegen? Die Station bleibt in allen Auswertungen sichtbar, nimmt aber keine Räder mehr auf.",
    "msg.stationDecommissioned": "{name} stillgelegt.",
    "msg.bikesAtStationLoadFailed": "Die Räder ließen sich nicht laden: {fehler}",
    "msg.trafficLoadFailed": "Der Stationsverkehr ließ sich nicht laden: {fehler}",
    "msg.customersLoadFailed": "Die Kunden ließen sich nicht laden: {fehler}",
    "msg.firstLastNameRequired": "Vorname und Nachname werden benötigt.",
    "msg.customerSaved": "{vorname} {nachname} gespeichert.",
    "msg.confirmBlockCustomer": "{vorname} {nachname} sperren? Es gibt derzeit keine Funktion, die eine Sperrung wieder aufhebt - das ist eine bekannte Lücke dieser Warenwirtschaft, keine Bequemlichkeit dieses Dialogs.",
    "msg.customerBlocked": "{vorname} {nachname} gesperrt.",
    "msg.nameEmailRequired": "Vorname, Nachname und E-Mail werden benötigt.",
    "msg.customerCreated": "Kunde {vorname} {nachname} angelegt.",
    "msg.customersCapped": "200 von mehr Kunden{zusatz} — bitte weiter eingrenzen",
    "msg.searchFor": "zu „{suchtext}“",
    "msg.statusList": "Status {liste}",
    "msg.damageLoadFailed": "Die Schäden ließen sich nicht laden: {fehler}",
    "msg.noBikeForDamage": "Es gibt kein Rad, dem ein Schaden zugeordnet werden könnte.",
    "msg.categoryDescriptionRequired": "Kategorie und Beschreibung werden benötigt.",
    "msg.damageReportedBlocked": "Meldung {id} angelegt. Das Rad ist gesperrt — sofern es nicht gerade gefahren wird; dann wird es bei der Rückgabe gesperrt.",
    "msg.damageReported": "Meldung {id} angelegt.",
    "msg.workOrderOpened": "Auftrag {id} eröffnet, Rad steht auf Wartung.",
    "msg.workOrdersLoadFailed": "Die Aufträge ließen sich nicht laden: {fehler}",
    "msg.workOrderCompleted": "Auftrag {auftragsnummer} erledigt.",
    "field.baujahr": "Baujahr",
    "field.gewicht": "Gewicht",
    "field.gangzahl": "Gangzahl",
    "field.rahmenhoehe": "Rahmenhöhe",
    "field.akkukapazitaet": "Akkukapazität",
    "field.reichweite": "Reichweite",
    "col.together": "Zusammen",
    "col.model": "Modell",
    "col.stock": "Bestand",
    "col.statusMix": "Zustand",
    "col.modelYear": "Baujahr",
    "col.utilisationDeviation": "Einsatzquote ggü. Flotte",
    "col.station": "Station",
    "col.occupied": "Belegt",
    "col.turnover": "Umschlag",
    "col.rides": "Fahrten",
    "col.revenuePerRideColumn": "Umsatz je Fahrt",
    "col.balance": "Saldo",
    "col.tariffGroup": "Tarifgruppe",
    "col.customers": "Kundschaft",
    "col.customerMix": "Nutzung",
    "col.revenueDeviation": "Umsatz- ggü. Kundenanteil",
    "col.case": "Fall",
    "col.workTime": "Arbeitszeit",
    "col.severity": "Schwere",
    "col.progress": "Bearbeitungsstand",
    "col.bikeType": "Radtyp",
    "col.revenue": "Umsatz",
    "col.monthlyCourse": "Monatsverlauf",
    "col.revenueVsRides": "Umsatz- ggü. Fahrtenanteil",
    "col.kilometres": "Kilometer",
    "col.kmPerRideDeviation": "km je Fahrt ggü. Schnitt",
    "col.movements": "Bewegungen",
    "col.fillLevel": "Füllstand",
    "unit.bikes": "Räder",
    "unit.shareOfRow": "Anteil der Zeile",
    "unit.percentagePoints": "Prozentpunkte",
    "unit.ridesArrivalsMinusDepartures": "Fahrten, Zugang minus Abgang",
    "unit.persons": "Personen",
    "unit.minutes": "Minuten",
    "unit.threeSteps": "3 Stufen",
    "unit.reportedToFixed": "gemeldet bis behoben",
    "unit.euroTwelveMonths": "Euro, 12 Monate",
    "unit.bikesOfCapacity": "Räder, Rahmen = Stellplätze",
    "unit.movementsPerDock": "Bewegungen je Stellplatz",
    "unit.euroPerRide": "Euro",
    "unit.ridesTwelveMonths": "Fahrten, 12 Monate",
    "unit.kmTwelveMonths": "Summe, 12 Monate",
    "unit.kmPerRide": "Kilometer je Fahrt",
    "unit.departuresPlusArrivals": "Abgänge und Zugänge",
    "unit.zeroToHundred": "0–100 %",
    "board.fleetTitle": "Bestand nach Modell",
    "board.fleetReference": "{raederPhrase} · {modellePhrase} von {herstellerPhrase} · Baujahre {vonJahr}–{bisJahr} · {quote} % gerade ausgeliehen",
    "board.fleetStatusAria": "{name}: {aufteilung}",
    "board.fleetYearAria": "{name}, Baujahr {jahr}, auf der Skala {vonJahr} bis {bisJahr}",
    "board.fleetDeviationAria": "{name}: {quote} % ausgeliehen, ganze Flotte {flottenquote} %",
    "board.fleetFootnote": "Abweichung: Anteil ausgeliehener Räder je Modell gegenüber {quote} % in der gesamten Flotte – aus Summen gerechnet, nicht als Mittel der fünf Modellquoten.",
    "board.fleetNoLocationFootnote": "{raederPhrase} gelten als verfügbar, tragen aber keinen Standort – in der Kartei einsatzbereit und im Netz nicht auffindbar.",
    "board.stationsTitle": "Netz nach Station",
    "board.stationsReference": "{stationenPhrase} · {belegt} von {kapazitaet} Stellplätzen belegt ({prozent} %) · Saldo über alle abgeschlossenen Fahrten",
    "board.stationOccupancyAria": "{name}: {belegt} von {kapazitaet} Stellplätzen belegt, {prozent} %",
    "board.stationBalanceAria": "{name}: {zugaenge} Zugänge, {abgaenge} Abgänge, Saldo {saldo}",
    "board.stationsFootnote": "Die Abgänge liegen bei allen Stationen zwischen {min} und {max} – die Nachfrage ist gleichmäßig verteilt, die Unterschiede stecken allein im Saldo.",
    "board.stationTurnoverAria": "{name}: {wert} Bewegungen je Stellplatz bei {kapazitaet} Stellplätzen",
    "board.stationsRhythmFootnote": "Der Tagesgang ist an allen Stationen derselbe: {morgenMin} bis {morgenMax} % der Werktagsabgänge fallen auf 6 bis 8 Uhr, {nachmittagMin} bis {nachmittagMax} % auf 16 bis 18 Uhr. Er beschreibt das Netz, nicht die einzelne Station – deshalb steht er hier und nicht als Spalte.",
    "board.customersTitle": "Kartei nach Tarifgruppe",
    "board.customersReference": "{kundenPhrase} · {gesperrt} gesperrt · {volumen} Rechnungsvolumen · {imOrt} in {ort}, verteilt über {ortePhrase}",
    "board.customersNoTariff": "Ohne aktiven Tarif",
    "board.customersWithRides": "mit Fahrten",
    "board.customersNoRides": "ohne Fahrt",
    "board.customersRevenueShare": "{anteil} % des Volumens",
    "board.customersRevenuePerRideAria": "{name}: {betrag} je Fahrt auf {fahrtenPhrase}",
    "board.customersMixAria": "{name}: {aufteilung}",
    "board.customersDeviationAria": "{name}: {umsatzanteil} % des Volumens bei {kundenanteil} % der Kundschaft",
    "board.customersActiveMax": "höchstens {kundenPhrase} im Monat",
    "board.customersFootnote": "Die oberen {zehntel} Kundinnen und Kunden tragen {anteil} % des Rechnungsvolumens; {ohneAdresse} Datensätze haben keine Adresse.",
    "board.maintenanceTitle": "Die einzelnen Fälle",
    "board.maintenanceReference": "{schadenPhrase} · {raederPhrase} betroffen ({typen}) · {auftraegePhrase} · gemeldet {tag}",
    "board.maintenanceSeverityAria": "{rad}: {schwere}, Stufe {stufe} von 3",
    "board.maintenanceProgressAria": "{rad}: {stand}, {auftrag}",
    "board.maintenanceHasOrder": "Wartungsauftrag vorhanden",
    "board.maintenanceNoOrder": "kein Wartungsauftrag",
    "board.maintenanceFootnote": "Keine Abweichungsspalte und keine Mittelwerte: {schadenPhrase}, davon {offen} unerledigt, {minuten} Minuten erfasste Arbeitszeit – jede Kennzahl wäre hier eine Statistik über sich selbst.",
    "board.revenueTypeTitle": "Zwölf Monate nach Radtyp",
    "board.revenueGroupTitle": "Zwölf Monate nach Tarifgruppe",
    "board.revenueReference": "{umsatz} und {fahrtenPhrase}, {vonMonat} bis {bisMonat}",
    "board.revenueReferenceWithFleet": "{umsatz} und {fahrtenPhrase}, {vonMonat} bis {bisMonat} · {jeRadTag} je Rad und Tag ({raederPhrase})",
    "board.revenuePerRide": "{betrag} je Fahrt",
    "board.monthlyCourseAria": "{name}: Verlauf {vonMonat} bis {bisMonat}, Höchstwert {max} im {maxMonat}, zuletzt {aktuell}",
    "board.revenueVsRidesAria": "{name}: {umsatzanteil} % des Umsatzes bei {fahrtenanteil} % der Fahrten",
    "board.revenueTypeFootnote": "Umsatz je Fahrt beim City-Bike: {von} auf {nach} ({veraenderung}) ab {monat} – der einzige Tarifwechsel im Zeitraum.",
    "board.revenueGroupFootnote": "Kundenzahlen einzelner Monate lassen sich nicht addieren – dieselben Personen fahren in mehreren Monaten. Die Rubrik nennt deshalb den stärksten Monat, keine Summe.",
    "board.kmTitle": "Wegstrecke nach Radtyp",
    "board.kmReference": "{km} auf {fahrtenPhrase}, {vonMonat} bis {bisMonat} · {anteil} der Fahrten geschätzt",
    "board.co2PerRide": "{kg} CO₂ je Fahrt",
    "board.kmPerRideAria": "{name}: {je} je Fahrt, Schnitt {schnitt}",
    "board.kmFootnote": "Der Schätzanteil ({anteil}) ist fahrtgewichtet gerechnet, nicht als Mittel der Monatsanteile: das ergäbe im gezeigten Zeitraum {ungewichtet} und über alle {monatszeilen} sogar {alleUngewichtet} statt {alleGewichtet} – schwach besetzte Monate wiegen in einem Mittel genauso schwer wie starke.",
    "board.stationLoadTitle": "Bewegung nach Station",
    "board.stationLoadReference": "{stationenPhrase} · {fahrten} Abgänge über die gesamte Historie",
    "board.fillLevelAria": "{name}: Füllstand {prozent} %",
    "board.stationLoadFootnote": "Die Abgänge liegen zwischen {min} und {max} – die Nachfrage ist gleichmäßig verteilt, zu entscheiden ist allein anhand des Saldos.",
    "board.halfYearFootnote": "Der Winteranteil liegt in jeder Zeile zwischen {min} % und {max} % – der Jahresgang trifft alle gleich und unterscheidet die Zeilen nicht.",
  },
  en: {
    "common.cancel": "Cancel",
    "common.confirm": "Confirm",
    "common.reason": "Reason",
    "common.all": "All",
    "common.actionsColumn": "Actions",
    "common.noSearchPlaceholder": "No search in this section",
    "common.noSearchAria": "Search not available in this section",
    "common.confirmWordPrompt": "Type \"{wort}\" to confirm:",
    "common.sortAria": "Sort by {titel}",
    "common.sortAriaSuffix": ", currently {richtung}",
    "common.ascending": "ascending",
    "common.descending": "descending",
    "common.sortResetAria": "Reset sorting by {titel}",
    "common.sortResetTitle": "Reset sorting",
    "common.groupByAria": "Group by {titel}",
    "common.groupResetAria": "Remove grouping by {titel}",
    "common.groupResetTitle": "Reset grouping",
    "common.groupTitle": "Group",
    "common.filterAria": "Filter {titel}",
    "common.filterMinAria": "Minimum value for {titel}",
    "common.filterSearchPlaceholder": "Search…",
    "common.filterResetAria": "Reset {titel} filter",
    "common.filterResetTitle": "Reset filter",
    "common.columnFilterReset": "Reset column filters",
    "common.noRowsMatchFilter": "No row matches the selected column-header restriction. ",
    "common.groupedBy": "Grouped by {titel}",
    "common.ungroup": "Remove grouping",
    "common.groupHeaderLabel": "{titel}: {beschriftung} ({n})",
    "common.closeDetailsAria": "Close details",
    "common.closeDetailsTitle": "Close details (Esc)",
    "common.rowsFiltered": "{angezeigt} of {zeilenPhrase} (column filter active)",
    "common.selectedCount": "{n} selected",
    "common.minAbbrev": "min",
    "common.hourAbbrev": "h",
    "common.underOneMinute": "under 1 min",
    "common.loggedInFor": "logged in for {dauer}",
    "common.sinceOpen": "since opening: {dauer}",
    "common.loginCheckFailed": "Could not verify sign-in: {msg}",
    "common.loginBadCredentials": "Email or password is incorrect.",
    "common.rolesCheckFailed": "Could not determine roles: {msg}",
    "common.roleCheckFailed": "Could not check role {code}: {msg}",
    "common.of": "of",
    "common.xOfPhrase": "{x} of {phrase}",
    "misc.estimatedParen": " ({prozent} estimated)",
    "hint.ridesPerDayHeading": "Rides per day — {monat} (total, all bike types and plans)",
    "status.label.abgebrochen": "Cancelled",
    "status.raw.abgebrochen": "Cancelled",
    "status.label.erledigt": "Completed",
    "status.raw.erledigt": "Completed",
    "status.label.verworfen": "Dismissed",
    "status.raw.verworfen": "Dismissed",
    "status.label.behoben": "Fixed",
    "status.raw.behoben": "Fixed",
    "msg.stationsWithoutBikeSuffix": ", {n} of them without a bike",
    "empty.noStationOccupancyText": "There is no station. With ten stations set up, that is unusual - a temporary loss of role could be the cause rather than missing data.",
    "empty.noStationOccupancyTitle": "No station occupancy",
    "msg.stationOccupancyLoadFailed": "Could not load station occupancy: {fehler}",
    "misc.estimatedRidesDetail": "{geschaetzt} of {fahrtenPhrase} ({prozent})",
    "msg.kmCo2Summary": "{monatszeilen}, {fahrten}, total CO₂ savings {co2}, of which {prozent} estimated (ride-weighted)",
    "empty.noKmCo2Title": "No kilometre and CO2 rows",
    "msg.kmCo2LoadFailed": "Could not load kilometres and CO2: {fehler}",
    "field.jeKunde": "Per customer",
    "msg.revenueByCustomerGroupSummary": "{monatszeilen}, total revenue {umsatz}",
    "empty.noRevenueByCustomerGroupTitle": "No revenue by customer group",
    "msg.revenueByCustomerGroupLoadFailed": "Could not load revenue by customer group: {fehler}",
    "msg.revenueByBikeTypeSummary": "{monatszeilen}, {fahrten}, total revenue {umsatz}",
    "msg.revenueByBikeTypeLoadFailed": "Could not load revenue by bike type: {fehler}",
    "empty.noRevenueByBikeTypeText": "There is no monthly row. With a populated reference year that is unusual - a temporary loss of role could be the cause rather than missing data.",
    "empty.noRevenueByBikeTypeTitle": "No revenue by bike type",
    "misc.estimatedSuffix": " (estimated)",
    "field.strecke": "Distance",
    "field.dauer": "Duration",
    "field.ziel": "Destination",
    "field.start": "Start",
    "misc.bikesOnDateCaption": "Bikes on {datum} - no customer reference, see v_wawi_fahrten_je_tag_rad",
    "button.backToDayOverview": "Back to the daily overview",
    "misc.bikesOnDate": "Bikes on {datum}",
    "misc.noBikeRiddenThisDay": "No bike was ridden on this day.",
    "msg.thisDayBikesLoadFailed": "Could not load this day’s bikes: {fehler}",
    "hint.legendColorScale": "Colour = this day’s rides relative to the busiest day of the month ({phrase}).",
    "hint.dayRidesAria": "{datum}: {phrase}",
    "hint.calendarCaption": "Rides per day, {monat}",
    "hint.tiedDaysCount": "{tagePhrase} tied, {phrase} each",
    "hint.totalForMonth": "{phrase}, total",
    "hint.dailyRidesChartAria": "Rides per day in {monat} {jahr}, total across all bike types and plans: between {min} and {maxPhrase}, on average {mittel}. Most rides on {tageListe} {monat} with {maxPhrase} each.",
    "msg.dailyFiguresLoadFailed": "Could not load the daily figures: {fehler}",
    "misc.workOrderTitle": "Work order {auftragsnummer}",
    "msg.activeWorkOrdersCount": "{n} active work orders",
    "misc.reportForBike": "Report for {rahmennummer}",
    "msg.openDamageWithUnrideable": "{n}{zusatz} open damage reports, of which {dringend} unrideable",
    "msg.openDamageCount": "{n}{zusatz} open damage reports",
    "misc.atLeastValue": "≥ {n} {einheit}",
    "misc.allLowercase": "all",
    "field.minAge": "Minimum age",
    "field.offenSeit": "Open since",
    "field.gemeldet": "Reported",
    "misc.stillRunning": "{datum} · still ongoing",
    "misc.noRentalYet": "No rental yet",
    "msg.stationCreated": "Station {name} created.",
    "msg.capacityPositiveInteger": "The number of docks must be a positive whole number.",
    "msg.longitudeRange": "The longitude must be between -180 and 180.",
    "msg.latitudeRange": "The latitude must be between -90 and 90.",
    "msg.latLonRequired": "Latitude and longitude are required.",
    "msg.stationFieldsRequired": "Name, street, house number, postal code, and city are required.",
    "field.laenge": "Longitude",
    "field.breite": "Latitude",
    "field.hausnummerVoll": "House number",
    "field.name": "Name",
    "hint.arrivalsPerDayLabel": "{label}: {n} arrivals per day",
    "hint.departuresPerDayLabel": "{label}: {n} departures per day",
    "hint.trafficPatternAria": "{wochentypTitel} at {name}, averaged over {tage} days. Most departures fall in the time slot {zeitfensterAb} with {maxAb} per day, most arrivals in the time slot {zeitfensterZu} with {maxZu} per day.",
    "hint.stationFullNote": " The station is full and is not currently accepting returns.",
    "hint.stationOccupancyAria": "Occupancy {name}: {belegt} of {kapazitaet} docks, {prozent} percent. 100 percent is the capacity of this one station.{vollZusatz}",
    "map.openDetailsSuffix": ". Open details.",
    "map.currentStationSuffix": " - this is the station shown",
    "map.stationFullSuffix": ", full - not currently accepting returns",
    "map.stationBelegLabel": "{name}: {belegt} of {kapazitaet} docks occupied",
    "map.customerLabelShort": "{ort} ({n})",
    "misc.freeShort": "{n} free",
    "misc.unitsInStock": "{n} in stock",
    "nav.originDamageReport": "Damage report for {rahmennummer}",
    "nav.originBikeFromStation": "Bike {rahmennummer} from {name}",
    "nav.originBikeFromFleet": "Bike {rahmennummer} from the fleet",
    "index.title": "VeloCity Inventory Management",
    "index.brandLinkAria": "VeloCity – public website, opens in a new tab",
    "index.loading": "One moment …",
    "index.loginEmail": "Email",
    "index.loginPassword": "Password",
    "index.loginSubmit": "Sign in",
    "index.noAccessTitle": "No access",
    "index.noAccessText": "This account is not registered with VeloCity as a staff account. If you are a customer, you can find your area at",
    "index.logout": "Sign out",
    "index.noRoleTitle": "No role assigned yet",
    "index.noRoleText": "Your account is registered with VeloCity as a staff account, but no area of responsibility has been assigned yet. Please contact management so they can assign you a role.",
    "index.searchPlaceholder": "Search",
    "index.profileAria": "Profile and settings",
    "index.navToggleAria": "Collapse or expand navigation",
    "index.settingsHeading": "Settings",
    "index.zebraLabel": "Zebra striping in tables",
    "index.languageLabel": "Language",
    "index.navAria": "Work areas",
    "index.workListAria": "Work list",
    "index.detailAria": "Detail form",
    "nav.flotte": "Fleet",
    "nav.stationen": "Stations",
    "nav.kunden": "Customers",
    "nav.instandhaltung": "Maintenance",
    "nav.auswertungen": "Reports",
    "nav.kundenSuche": "Customers: name, email, customer number",
    "field.rahmennummer": "Frame number",
    "field.typ": "Type",
    "field.status": "Status",
    "field.standort": "Location",
    "field.schaeden": "Damage reports",
    "field.modell": "Model",
    "field.angeschafft": "Acquired",
    "field.letzteWartung": "Last maintenance",
    "field.offeneSchaeden": "Open damage reports",
    "field.hoechsteSchwere": "Highest severity",
    "field.radtyp": "Bike type",
    "field.station": "Station",
    "field.nummer": "Number",
    "field.ort": "Location",
    "field.belegt": "Occupied",
    "field.frei": "Free",
    "field.anschrift": "Address",
    "field.stellplaetze": "Docks",
    "field.lage": "Coordinates",
    "field.betrieb": "Operation",
    "field.akku": "Battery",
    "field.nachname": "Last name",
    "field.vorname": "First name",
    "field.tarif": "Plan",
    "field.kundeSeit": "Customer since",
    "field.letzteAusleihe": "Last rental",
    "field.anrede": "Salutation",
    "field.email": "Email",
    "field.telefon": "Phone",
    "field.strasse": "Street",
    "field.hausnummer": "No.",
    "field.plz": "Postal code",
    "field.hinweis": "Note",
    "field.fahrten": "Rides",
    "field.umsatz": "Revenue",
    "field.offen": "Outstanding",
    "field.kategorie": "Category",
    "field.gemeldetVon": "Reported by",
    "field.gemeldetAm": "Reported on",
    "field.beschreibung": "Description",
    "field.schwere": "Severity",
    "field.stand": "Status",
    "field.bisherigeAuftraege": "Previous work orders",
    "field.rad": "Bike",
    "field.auftrag": "Work order",
    "field.eroeffnet": "Opened",
    "field.bearbeiter": "Assigned to",
    "field.arbeitszeitMinuten": "Labour time (minutes)",
    "field.bemerkung": "Remark",
    "field.kapazitaet": "Capacity",
    "field.abgaenge": "Departures",
    "field.zugaenge": "Arrivals",
    "field.saldo": "Balance",
    "field.fuellstand": "Fill level",
    "field.monat": "Month",
    "field.minuten": "Minutes",
    "field.jeFahrt": "Per ride",
    "field.minutenJeFahrt": "Minutes per ride",
    "field.deltaVormonat": "Δ vs. previous month",
    "field.kunden": "Customers",
    "field.fahrtenJeKunde": "Rides per customer",
    "field.kilometer": "Kilometres",
    "field.kilometerJeFahrt": "Kilometres per ride",
    "field.co2Ersparnis": "CO₂ savings",
    "field.davonGeschaetzt": "Of which estimated",
    "status.raw.verfuegbar": "Available",
    "status.label.verfuegbar": "Available",
    "status.raw.ausgeliehen": "On loan",
    "status.label.ausgeliehen": "On loan",
    "status.raw.wartung": "Maintenance",
    "status.label.wartung": "Maintenance",
    "status.raw.defekt": "Faulty",
    "status.label.defekt": "Faulty",
    "status.raw.ausgemustert": "Decommissioned",
    "status.label.ausgemustert": "Decommissioned",
    "status.raw.aktiv": "Active",
    "status.label.aktiv": "Active",
    "status.raw.gesperrt": "Blocked",
    "status.label.gesperrt": "Blocked",
    "status.raw.geschlossen": "Closed",
    "status.label.geschlossen": "Closed",
    "status.raw.offen": "Open",
    "status.label.offen": "Open",
    "status.raw.in_arbeit": "In progress",
    "status.label.in_arbeit": "In progress",
    "schwere.gering": "minor",
    "schwere.mittel": "moderate",
    "schwere.fahruntauglich": "unrideable",
    "button.newBike": "Add new bike",
    "button.create": "Create",
    "button.setTo": "Set to {ziel}",
    "button.whyTarget": "Why {ziel}?",
    "button.decommission": "Decommission",
    "button.decommissionReason": "Reason for decommissioning",
    "button.newStation": "Add new station",
    "button.decommissionStation": "Decommission",
    "button.newCustomer": "Add new customer",
    "button.save": "Save",
    "button.block": "Block",
    "button.blockReason": "Reason for blocking",
    "button.disclosureArt15": "Disclosure under Art. 15",
    "button.deletionArt17": "Erasure under Art. 17",
    "button.downloadJson": "Download as JSON",
    "button.close": "Close",
    "button.reportDamage": "Report damage",
    "button.openWorkOrder": "Open work order",
    "button.bikeInFleet": "Bike in fleet",
    "button.report": "Report",
    "button.resolve": "Complete",
    "button.toOpenDamage": "Go to open damage reports",
    "button.damageInFleet": "Bike in fleet",
    "button.list": "List",
    "button.map": "Map",
    "button.showCustomersOnMap": "Show customers per location",
    "empty.noBikesFilterTitle": "No bikes match this filter",
    "empty.noBikesFilterText": "No bike in the fleet matches the selected restriction.",
    "empty.noCustomersFilterTitle": "No customers match this filter",
    "empty.noCustomersFilterTextSearch": "No customer matching \"{suchtext}\" also meets the selected restriction.",
    "empty.noCustomersFilterText": "No customer matches the selected restriction.",
    "empty.statusFilterReset": "Reset status filter",
    "empty.noOpenDamageTitle": "No open damage reports",
    "empty.noOpenDamageText": "There is currently no damage report. That is the normal case — a report is made when something is noticed on a bike.",
    "empty.noDamageFilterTitle": "No damage reports match this filter",
    "empty.noDamageFilterText": "No open damage report matches the selected restriction.",
    "empty.noWorkOrdersTitle": "No active work orders",
    "empty.noWorkOrdersText": "There is currently no work order. A work order is created from an open damage report — that is where the \"Open work order\" button is.",
    "misc.underway": "under way",
    "misc.underwayNoLocation": "under way (no location)",
    "misc.noneYet": "none yet",
    "misc.noMembership": "no membership",
    "misc.notYetAssigned": "not yet assigned",
    "misc.justNow": "just now",
    "misc.inOperation": "in operation",
    "misc.decommissionedState": "decommissioned",
    "misc.noAddressOnFile": "No address is on file for this person - this is not a loading error. The fields below can be filled in to add one.",
    "misc.disclosureLoggedNote": "Retrieving the Art. 15 disclosure is logged (GR19): viewing it leaves a trace in the change log.",
    "misc.damageBlocksImmediately": "An unrideable damage report blocks the bike immediately - unless it is currently in use. In that case the status stays unchanged for now (GR13 does not allow a bike under way any other status) and the block takes effect only on return.",
    "misc.onlyUnrideableBlocks": "Only an unrideable report blocks the bike automatically.",
    "misc.noMinutesNeeded": "The labour time in minutes is required (0 or more).",
    "art17.confirmHeader": "Erasure under Art. 17 GDPR for {name}?",
    "art17.whatDisappears": "WHAT DISAPPEARS: name, email, phone number, date of birth, address, payment method, and the link to the sign-in account. The old values are also made unrecognisable in the change log.",
    "art17.whatRemains": "WHAT REMAINS: {phrase} and all invoices, in full. Tax law requires ten years of retention, and the GDPR explicitly exempts this obligation from erasure.",
    "art17.whatThisDoesNotAchieve": "WHAT THIS DOES NOT ACHIEVE: the rides carry times and locations. Anyone who regularly rides from the same point at the same time can still be identified through them.",
    "art17.irreversible": "This action cannot be undone.",
    "art17.reasonPrompt": "Reason (e.g.: request by the data subject dated …)",
    "art17.abortedNoReason": "Cancelled: no erasure without a reason.",
    "art17.runningRideBlocks": "{name} still has a ride in progress. Please wait for the return first.",
    "art17.doneMessage": "Customer {nummer} anonymised. Invoices and rides are retained.",
    "art17.confirmWord": "LOESCHEN",
    "tile.minimum": "Minimum",
    "tile.maximum": "Maximum",
    "tile.countPerMonth": "Count per month",
    "tile.dayWithMostRides": "Day with the most rides",
    "tile.occupancy": "Occupancy",
    "tile.trafficByTimeSlot": "Arrivals and departures by time slot",
    "tile.weekdays": "Weekdays (Mon–Fri)",
    "tile.weekend": "Weekend (Sat/Sun)",
    "tile.bikesAtStation": "Bikes at this station ({n})",
    "tile.noBikesHere": "There is currently no bike here - all are under way, in the workshop, or faulty.",
    "tile.noTrafficData": "No traffic figures are available for this station.",
    "tile.legendDepartures": "Departures per day (top)",
    "tile.legendArrivals": "Arrivals per day (bottom)",
    "tab.revenueByBikeType": "Revenue by bike type",
    "tab.revenueByCustomerGroup": "Revenue by customer group",
    "tab.kmCo2": "Kilometres and CO₂",
    "tab.stationOccupancy": "Station occupancy",
    "tab.openDamage": "Open damage reports",
    "tab.workOrders": "Work orders",
    "auskunft.title": "Disclosure under Art. 15 GDPR · {name}",
    "auskunft.stammdaten": "Master data",
    "auskunft.mitgliedschaften": "Memberships",
    "auskunft.fahrten": "Rides",
    "auskunft.rechnungen": "Invoices",
    "auskunft.zahlungen": "Payments",
    "auskunft.schadensmeldungen": "Damage reports",
    "auskunft.freiminuten": "Free minutes",
    "auskunft.protokoll": "Log",
    "map.mapNote": "Circle size shows a station’s capacity, the fill shows its current occupancy.",
    "map.areaWithCustomers": "Map area with {stationenPhrase} and customer locations",
    "map.area": "Map area with {stationenPhrase}",
    "map.customersAtLocation": "{ort}: {kundenPhrase}",
    "map.detailAreaNote": "Extract: this station and its nearest neighbours.",
    "map.libraryUnavailable": "The map library could not be loaded (likely no network access to the content delivery network). All station details remain available in the list.",
    "map.tilesUnavailable": "Map tiles could not be loaded. The station markers below are still positioned correctly.",
    "map.zoomIn": "Zoom in",
    "map.zoomOut": "Zoom out",
    "tile.stationMap": "Location in the network",
    "tile.noStationLocation": "No coordinates are available for this station.",
    "common.and": "and",
    "board.toggleAria": "Expand/collapse board",
    "board.seriesPartPhrase": "{teil}: {wert}",
    "msg.bikeNowSetTo": "{rahmennummer} is now set to {ziel}.",
    "msg.confirmDecommission": "Permanently decommission {rahmennummer}? The bike loses its location and no longer appears in any list. Its rides are retained.",
    "msg.bikeDecommissioned": "{rahmennummer} decommissioned.",
    "msg.fleetLoadFailed": "Could not load the fleet: {fehler}",
    "msg.noBikeWithFilter": "No bike matches this filter",
    "msg.modelsOrStationsLoadFailed": "Could not load models or stations: {fehler}",
    "msg.noModelsOrStations": "There are neither models nor stations from which a new bike could be created.",
    "msg.frameNumberMissing": "The frame number is missing.",
    "msg.bikeCreated": "Bike {rahmennummer} created.",
    "msg.stationsLoadFailed": "Could not load the stations: {fehler}",
    "msg.stationsSummary": "{stationenPhrase}, {n} of them full: {liste}",
    "msg.stationStillHasBikes": "{name} still has {raederPhrase}. They must be returned somewhere else first.",
    "msg.confirmDecommissionStation": "Decommission {name} as of today? The station remains visible in all reports but no longer accepts bikes.",
    "msg.stationDecommissioned": "{name} decommissioned.",
    "msg.bikesAtStationLoadFailed": "Could not load the bikes: {fehler}",
    "msg.trafficLoadFailed": "Could not load station traffic: {fehler}",
    "msg.customersLoadFailed": "Could not load the customers: {fehler}",
    "msg.firstLastNameRequired": "First and last name are required.",
    "msg.customerSaved": "{vorname} {nachname} saved.",
    "msg.confirmBlockCustomer": "Block {vorname} {nachname}? There is currently no function to lift a block - this is a known gap in this system, not a convenience of this dialog.",
    "msg.customerBlocked": "{vorname} {nachname} blocked.",
    "msg.nameEmailRequired": "First name, last name, and email are required.",
    "msg.customerCreated": "Customer {vorname} {nachname} created.",
    "msg.customersCapped": "200 of more customers{zusatz} — please narrow down further",
    "msg.searchFor": "for “{suchtext}”",
    "msg.statusList": "Status {liste}",
    "msg.damageLoadFailed": "Could not load the damage reports: {fehler}",
    "msg.noBikeForDamage": "There is no bike to which a damage report could be assigned.",
    "msg.categoryDescriptionRequired": "Category and description are required.",
    "msg.damageReportedBlocked": "Report {id} created. The bike is blocked — unless it is currently being ridden; then it will be blocked on return.",
    "msg.damageReported": "Report {id} created.",
    "msg.workOrderOpened": "Work order {id} opened, bike set to maintenance.",
    "msg.workOrdersLoadFailed": "Could not load the work orders: {fehler}",
    "msg.workOrderCompleted": "Work order {auftragsnummer} completed.",
    "field.baujahr": "Model year",
    "field.gewicht": "Weight",
    "field.gangzahl": "Gears",
    "field.rahmenhoehe": "Frame size",
    "field.akkukapazitaet": "Battery capacity",
    "field.reichweite": "Range",
    "col.together": "Together",
    "col.model": "Model",
    "col.stock": "Stock",
    "col.statusMix": "Condition",
    "col.modelYear": "Model year",
    "col.utilisationDeviation": "Utilisation vs. fleet",
    "col.station": "Station",
    "col.occupied": "Occupied",
    "col.turnover": "Turnover",
    "col.rides": "Rides",
    "col.revenuePerRideColumn": "Revenue per ride",
    "col.balance": "Balance",
    "col.tariffGroup": "Tariff group",
    "col.customers": "Customers",
    "col.customerMix": "Usage",
    "col.revenueDeviation": "Revenue vs. customer share",
    "col.case": "Case",
    "col.workTime": "Work time",
    "col.severity": "Severity",
    "col.progress": "Progress",
    "col.bikeType": "Bike type",
    "col.revenue": "Revenue",
    "col.monthlyCourse": "Monthly course",
    "col.revenueVsRides": "Revenue vs. ride share",
    "col.kilometres": "Kilometres",
    "col.kmPerRideDeviation": "km per ride vs. average",
    "col.movements": "Movements",
    "col.fillLevel": "Fill level",
    "unit.bikes": "bikes",
    "unit.shareOfRow": "share of row",
    "unit.percentagePoints": "percentage points",
    "unit.ridesArrivalsMinusDepartures": "rides, arrivals minus departures",
    "unit.persons": "persons",
    "unit.minutes": "minutes",
    "unit.threeSteps": "3 steps",
    "unit.reportedToFixed": "reported to fixed",
    "unit.euroTwelveMonths": "euro, 12 months",
    "unit.bikesOfCapacity": "bikes, frame = docking points",
    "unit.movementsPerDock": "movements per docking point",
    "unit.euroPerRide": "euro",
    "unit.ridesTwelveMonths": "rides, 12 months",
    "unit.kmTwelveMonths": "total, 12 months",
    "unit.kmPerRide": "kilometres per ride",
    "unit.departuresPlusArrivals": "departures and arrivals",
    "unit.zeroToHundred": "0–100 %",
    "board.fleetTitle": "Stock by model",
    "board.fleetReference": "{raederPhrase} · {modellePhrase} from {herstellerPhrase} · model years {vonJahr}–{bisJahr} · {quote} % on loan right now",
    "board.fleetStatusAria": "{name}: {aufteilung}",
    "board.fleetYearAria": "{name}, model year {jahr}, on the scale {vonJahr} to {bisJahr}",
    "board.fleetDeviationAria": "{name}: {quote} % on loan, whole fleet {flottenquote} %",
    "board.fleetFootnote": "Deviation: share of bikes on loan per model against {quote} % across the whole fleet – computed from totals, not as the average of the five model ratios.",
    "board.fleetNoLocationFootnote": "{raederPhrase} count as available but carry no location – ready in the records and untraceable in the network.",
    "board.stationsTitle": "Network by station",
    "board.stationsReference": "{stationenPhrase} · {belegt} of {kapazitaet} docking points occupied ({prozent} %) · balance over all completed rides",
    "board.stationOccupancyAria": "{name}: {belegt} of {kapazitaet} docking points occupied, {prozent} %",
    "board.stationBalanceAria": "{name}: {zugaenge} arrivals, {abgaenge} departures, balance {saldo}",
    "board.stationsFootnote": "Departures range from {min} to {max} across all stations – demand is evenly spread, the differences lie solely in the balance.",
    "board.stationTurnoverAria": "{name}: {wert} movements per docking point across {kapazitaet} docking points",
    "board.stationsRhythmFootnote": "The daily pattern is the same at every station: {morgenMin} to {morgenMax} % of weekday departures fall between 6 and 8 h, {nachmittagMin} to {nachmittagMax} % between 16 and 18 h. It describes the network, not the individual station – which is why it stands here and not as a column.",
    "board.customersTitle": "Records by tariff group",
    "board.customersReference": "{kundenPhrase} · {gesperrt} blocked · {volumen} invoiced · {imOrt} in {ort}, spread over {ortePhrase}",
    "board.customersNoTariff": "No active tariff",
    "board.customersWithRides": "with rides",
    "board.customersNoRides": "without a ride",
    "board.customersRevenueShare": "{anteil} % of the volume",
    "board.customersRevenuePerRideAria": "{name}: {betrag} per ride across {fahrtenPhrase}",
    "board.customersMixAria": "{name}: {aufteilung}",
    "board.customersDeviationAria": "{name}: {umsatzanteil} % of the volume with {kundenanteil} % of the customers",
    "board.customersActiveMax": "at most {kundenPhrase} in a month",
    "board.customersFootnote": "The top {zehntel} customers account for {anteil} % of the invoiced volume; {ohneAdresse} records have no address.",
    "board.maintenanceTitle": "The individual cases",
    "board.maintenanceReference": "{schadenPhrase} · {raederPhrase} affected ({typen}) · {auftraegePhrase} · reported {tag}",
    "board.maintenanceSeverityAria": "{rad}: {schwere}, step {stufe} of 3",
    "board.maintenanceProgressAria": "{rad}: {stand}, {auftrag}",
    "board.maintenanceHasOrder": "work order exists",
    "board.maintenanceNoOrder": "no work order",
    "board.maintenanceFootnote": "No deviation column and no averages: {schadenPhrase}, {offen} of them unresolved, {minuten} minutes of recorded work – any ratio here would be a statistic about itself.",
    "board.revenueTypeTitle": "Twelve months by bike type",
    "board.revenueGroupTitle": "Twelve months by tariff group",
    "board.revenueReference": "{umsatz} and {fahrtenPhrase}, {vonMonat} to {bisMonat}",
    "board.revenueReferenceWithFleet": "{umsatz} and {fahrtenPhrase}, {vonMonat} to {bisMonat} · {jeRadTag} per bike per day ({raederPhrase})",
    "board.revenuePerRide": "{betrag} per ride",
    "board.monthlyCourseAria": "{name}: course {vonMonat} to {bisMonat}, peak {max} in {maxMonat}, latest {aktuell}",
    "board.revenueVsRidesAria": "{name}: {umsatzanteil} % of revenue with {fahrtenanteil} % of rides",
    "board.revenueTypeFootnote": "Revenue per ride for the City-Bike: {von} to {nach} ({veraenderung}) from {monat} – the only tariff change in the period.",
    "board.revenueGroupFootnote": "Monthly customer counts cannot be added up – the same people ride in several months. The row label therefore names the strongest month, not a total.",
    "board.kmTitle": "Distance by bike type",
    "board.kmReference": "{km} over {fahrtenPhrase}, {vonMonat} to {bisMonat} · {anteil} of rides estimated",
    "board.co2PerRide": "{kg} CO₂ per ride",
    "board.kmPerRideAria": "{name}: {je} per ride, average {schnitt}",
    "board.kmFootnote": "The estimated share ({anteil}) is weighted by rides, not averaged over monthly shares: that would give {ungewichtet} for the period shown and even {alleUngewichtet} instead of {alleGewichtet} across all {monatszeilen} – in a plain average, thinly populated months weigh as much as busy ones.",
    "board.stationLoadTitle": "Movement by station",
    "board.stationLoadReference": "{stationenPhrase} · {fahrten} departures over the entire history",
    "board.fillLevelAria": "{name}: fill level {prozent} %",
    "board.stationLoadFootnote": "Departures range from {min} to {max} – demand is evenly spread, the only thing to decide on is the balance.",
    "board.halfYearFootnote": "The winter share lies between {min} % and {max} % in every row – the seasonal pattern affects all alike and does not tell the rows apart.",
  },
  tr: {
    "common.cancel": "Vazgeç",
    "common.confirm": "Onayla",
    "common.reason": "Sebep",
    "common.all": "Tümü",
    "common.actionsColumn": "İşlemler",
    "common.noSearchPlaceholder": "Bu bölümde arama yok",
    "common.noSearchAria": "Bu bölümde arama kullanılamaz",
    "common.confirmWordPrompt": "Onaylamak için \"{wort}\" yazın:",
    "common.sortAria": "{titel} alanına göre sırala",
    "common.sortAriaSuffix": ", şu an {richtung}",
    "common.ascending": "artan",
    "common.descending": "azalan",
    "common.sortResetAria": "{titel} sıralamasını sıfırla",
    "common.sortResetTitle": "Sıralamayı sıfırla",
    "common.groupByAria": "{titel} alanına göre grupla",
    "common.groupResetAria": "{titel} gruplamasını kaldır",
    "common.groupResetTitle": "Gruplamayı sıfırla",
    "common.groupTitle": "Grupla",
    "common.filterAria": "{titel} alanını filtrele",
    "common.filterMinAria": "{titel} için en düşük değer",
    "common.filterSearchPlaceholder": "Ara…",
    "common.filterResetAria": "{titel} filtresini sıfırla",
    "common.filterResetTitle": "Filtreyi sıfırla",
    "common.columnFilterReset": "Sütun filtrelerini sıfırla",
    "common.noRowsMatchFilter": "Hiçbir satır sütun başlığındaki seçili kısıtlamayı karşılamıyor. ",
    "common.groupedBy": "{titel} alanına göre gruplandı",
    "common.ungroup": "Gruplamayı kaldır",
    "common.groupHeaderLabel": "{titel}: {beschriftung} ({n})",
    "common.closeDetailsAria": "Ayrıntıları kapat",
    "common.closeDetailsTitle": "Ayrıntıları kapat (Esc)",
    "common.rowsFiltered": "{zeilenPhrase} içinden {angezeigt} (sütun filtresi etkin)",
    "common.selectedCount": "{n} seçildi",
    "common.minAbbrev": "dk",
    "common.hourAbbrev": "sa",
    "common.underOneMinute": "1 dk. altı",
    "common.loggedInFor": "{dauer} süredir oturum açık",
    "common.sinceOpen": "açıldığından beri: {dauer}",
    "common.loginCheckFailed": "Oturum açma doğrulanamadı: {msg}",
    "common.loginBadCredentials": "E-posta veya parola hatalı.",
    "common.rolesCheckFailed": "Roller belirlenemedi: {msg}",
    "common.roleCheckFailed": "{code} rolü kontrol edilemedi: {msg}",
    "common.of": "/",
    "common.xOfPhrase": "{phrase} içinden {x}",
    "misc.estimatedParen": " ({prozent} tahmini)",
    "hint.ridesPerDayHeading": "Güne göre sürüşler — {monat} (toplam, tüm bisiklet tipleri ve tarifeler)",
    "status.label.abgebrochen": "İptal edildi",
    "status.raw.abgebrochen": "İptal edildi",
    "status.label.erledigt": "Tamamlandı",
    "status.raw.erledigt": "Tamamlandı",
    "status.label.verworfen": "Reddedildi",
    "status.raw.verworfen": "Reddedildi",
    "status.label.behoben": "Giderildi",
    "status.raw.behoben": "Giderildi",
    "msg.stationsWithoutBikeSuffix": ", bunlardan {n} tanesi bisikletsiz",
    "empty.noStationOccupancyText": "Herhangi bir istasyon bulunmuyor. On istasyon tanımlıyken bu olağandışıdır - eksik veri yerine geçici bir rol kaybı söz konusu olabilir.",
    "empty.noStationOccupancyTitle": "İstasyon doluluğu yok",
    "msg.stationOccupancyLoadFailed": "İstasyon doluluğu yüklenemedi: {fehler}",
    "misc.estimatedRidesDetail": "{fahrtenPhrase} içinden {geschaetzt} tanesi ({prozent})",
    "msg.kmCo2Summary": "{monatszeilen}, {fahrten}, toplam CO₂ tasarrufu {co2}, bunun {prozent} tahmini (sürüş ağırlıklı)",
    "empty.noKmCo2Title": "Kilometre ve CO2 satırı yok",
    "msg.kmCo2LoadFailed": "Kilometre ve CO2 yüklenemedi: {fehler}",
    "field.jeKunde": "Müşteri başına",
    "msg.revenueByCustomerGroupSummary": "{monatszeilen}, toplam ciro {umsatz}",
    "empty.noRevenueByCustomerGroupTitle": "Müşteri grubuna göre ciro yok",
    "msg.revenueByCustomerGroupLoadFailed": "Müşteri grubuna göre ciro yüklenemedi: {fehler}",
    "msg.revenueByBikeTypeSummary": "{monatszeilen}, {fahrten}, toplam ciro {umsatz}",
    "msg.revenueByBikeTypeLoadFailed": "Bisiklet tipine göre ciro yüklenemedi: {fehler}",
    "empty.noRevenueByBikeTypeText": "Herhangi bir aylık satır bulunmuyor. Dolu bir referans yılında bu olağandışıdır - eksik veri yerine geçici bir rol kaybı söz konusu olabilir.",
    "empty.noRevenueByBikeTypeTitle": "Bisiklet tipine göre ciro yok",
    "misc.estimatedSuffix": " (tahmini)",
    "field.strecke": "Mesafe",
    "field.dauer": "Süre",
    "field.ziel": "Varış",
    "field.start": "Başlangıç",
    "misc.bikesOnDateCaption": "{datum} tarihindeki bisikletler - müşteri bilgisi yok, bkz. v_wawi_fahrten_je_tag_rad",
    "button.backToDayOverview": "Günlük özete dön",
    "misc.bikesOnDate": "{datum} tarihindeki bisikletler",
    "misc.noBikeRiddenThisDay": "Bu gün hiçbir bisiklet kullanılmadı.",
    "msg.thisDayBikesLoadFailed": "Bu güne ait bisikletler yüklenemedi: {fehler}",
    "hint.legendColorScale": "Renk = bu günün sürüşlerinin ayın en yoğun gününe oranı ({phrase}).",
    "hint.dayRidesAria": "{datum}: {phrase}",
    "hint.calendarCaption": "{monat} ayında güne göre sürüşler",
    "hint.tiedDaysCount": "{tagePhrase} berabere, her biri {phrase}",
    "hint.totalForMonth": "{phrase}, toplam",
    "hint.dailyRidesChartAria": "{jahr} {monat} ayında güne göre sürüşler, tüm bisiklet tipleri ve tarifeler toplamı: {min} ile {maxPhrase} arasında, ortalama {mittel}. En çok sürüş {monat} ayının {tageListe} günlerinde, her birinde {maxPhrase}.",
    "msg.dailyFiguresLoadFailed": "Günlük rakamlar yüklenemedi: {fehler}",
    "misc.workOrderTitle": "İş emri {auftragsnummer}",
    "msg.activeWorkOrdersCount": "{n} devam eden iş emri",
    "misc.reportForBike": "{rahmennummer} için bildirim",
    "msg.openDamageWithUnrideable": "{n}{zusatz} açık hasar bildirimi, bunlardan {dringend} tanesi sürüşe uygun değil",
    "msg.openDamageCount": "{n}{zusatz} açık hasar bildirimi",
    "misc.atLeastValue": "≥ {n} {einheit}",
    "misc.allLowercase": "tümü",
    "field.minAge": "Asgari yaş",
    "field.offenSeit": "Açık kalma süresi",
    "field.gemeldet": "Bildirim",
    "misc.stillRunning": "{datum} · devam ediyor",
    "misc.noRentalYet": "Henüz kiralama yok",
    "msg.stationCreated": "{name} istasyonu oluşturuldu.",
    "msg.capacityPositiveInteger": "Park yeri sayısı pozitif bir tam sayı olmalıdır.",
    "msg.longitudeRange": "Boylam -180 ile 180 arasında olmalıdır.",
    "msg.latitudeRange": "Enlem -90 ile 90 arasında olmalıdır.",
    "msg.latLonRequired": "Enlem ve boylam gereklidir.",
    "msg.stationFieldsRequired": "Ad, sokak, kapı numarası, posta kodu ve şehir gereklidir.",
    "field.laenge": "Boylam",
    "field.breite": "Enlem",
    "field.hausnummerVoll": "Kapı numarası",
    "field.name": "Ad",
    "hint.arrivalsPerDayLabel": "{label}: günde {n} giriş",
    "hint.departuresPerDayLabel": "{label}: günde {n} çıkış",
    "hint.trafficPatternAria": "{name}, {tage} gün ortalaması, {wochentypTitel}. En çok çıkış {zeitfensterAb} zaman diliminde, günde {maxAb}; en çok giriş {zeitfensterZu} zaman diliminde, günde {maxZu}.",
    "hint.stationFullNote": " İstasyon dolu ve şu anda iade kabul etmiyor.",
    "hint.stationOccupancyAria": "Doluluk {name}: {kapazitaet} yerden {belegt}, yüzde {prozent}. Yüzde 100, bu tek istasyonun kapasitesidir.{vollZusatz}",
    "map.openDetailsSuffix": ". Ayrıntıları aç.",
    "map.currentStationSuffix": " - görüntülenen istasyon budur",
    "map.stationFullSuffix": ", dolu - şu anda iade kabul etmiyor",
    "map.stationBelegLabel": "{name}: {kapazitaet} yerden {belegt} tanesi dolu",
    "map.customerLabelShort": "{ort} ({n})",
    "misc.freeShort": "{n} boş",
    "misc.unitsInStock": "stokta {n}",
    "nav.originDamageReport": "{rahmennummer} için hasar bildirimi",
    "nav.originBikeFromStation": "{name} istasyonundan {rahmennummer} bisikleti",
    "nav.originBikeFromFleet": "Filodan {rahmennummer} bisikleti",
    "index.title": "VeloCity Stok Yönetimi",
    "index.brandLinkAria": "VeloCity – herkese açık web sitesi, yeni sekmede açılır",
    "index.loading": "Bir dakika …",
    "index.loginEmail": "E-posta",
    "index.loginPassword": "Parola",
    "index.loginSubmit": "Giriş yap",
    "index.noAccessTitle": "Erişim yok",
    "index.noAccessText": "Bu hesap VeloCity’de personel hesabı olarak kayıtlı değil. Müşteriyseniz kendi alanınızı şu adreste bulabilirsiniz:",
    "index.logout": "Çıkış yap",
    "index.noRoleTitle": "Henüz rol atanmadı",
    "index.noRoleText": "Hesabınız VeloCity’de personel hesabı olarak kayıtlı, ancak henüz bir görev alanı atanmadı. Size bir rol atayabilmesi için lütfen yönetimle iletişime geçin.",
    "index.searchPlaceholder": "Ara",
    "index.profileAria": "Profil ve ayarlar",
    "index.navToggleAria": "Gezinmeyi daralt veya genişlet",
    "index.settingsHeading": "Ayarlar",
    "index.zebraLabel": "Tablolarda zebra çizgisi",
    "index.languageLabel": "Dil",
    "index.navAria": "Görev alanları",
    "index.workListAria": "Çalışma listesi",
    "index.detailAria": "Ayrıntı formu",
    "nav.flotte": "Filo",
    "nav.stationen": "İstasyonlar",
    "nav.kunden": "Müşteriler",
    "nav.instandhaltung": "Bakım",
    "nav.auswertungen": "Raporlar",
    "nav.kundenSuche": "Müşteriler: ad, e-posta, müşteri numarası",
    "field.rahmennummer": "Şasi numarası",
    "field.typ": "Tip",
    "field.status": "Durum",
    "field.standort": "Konum",
    "field.schaeden": "Hasarlar",
    "field.modell": "Model",
    "field.angeschafft": "Alım tarihi",
    "field.letzteWartung": "Son bakım",
    "field.offeneSchaeden": "Açık hasarlar",
    "field.hoechsteSchwere": "En yüksek önem derecesi",
    "field.radtyp": "Bisiklet tipi",
    "field.station": "İstasyon",
    "field.nummer": "Numara",
    "field.ort": "Konum",
    "field.belegt": "Dolu",
    "field.frei": "Boş",
    "field.anschrift": "Adres",
    "field.stellplaetze": "Park yerleri",
    "field.lage": "Konum",
    "field.betrieb": "İşletme durumu",
    "field.akku": "Batarya",
    "field.nachname": "Soyadı",
    "field.vorname": "Adı",
    "field.tarif": "Tarife",
    "field.kundeSeit": "Müşteri olduğu tarih",
    "field.letzteAusleihe": "Son kiralama",
    "field.anrede": "Hitap",
    "field.email": "E-posta",
    "field.telefon": "Telefon",
    "field.strasse": "Sokak",
    "field.hausnummer": "No.",
    "field.plz": "Posta kodu",
    "field.hinweis": "Not",
    "field.fahrten": "Sürüşler",
    "field.umsatz": "Ciro",
    "field.offen": "Bakiye",
    "field.kategorie": "Kategori",
    "field.gemeldetVon": "Bildiren",
    "field.gemeldetAm": "Bildirim tarihi",
    "field.beschreibung": "Açıklama",
    "field.schwere": "Önem derecesi",
    "field.stand": "Durum",
    "field.bisherigeAuftraege": "Önceki iş emirleri",
    "field.rad": "Bisiklet",
    "field.auftrag": "İş emri",
    "field.eroeffnet": "Açılış tarihi",
    "field.bearbeiter": "Sorumlu",
    "field.arbeitszeitMinuten": "Çalışma süresi (dakika)",
    "field.bemerkung": "Not",
    "field.kapazitaet": "Kapasite",
    "field.abgaenge": "Çıkışlar",
    "field.zugaenge": "Girişler",
    "field.saldo": "Bakiye",
    "field.fuellstand": "Doluluk oranı",
    "field.monat": "Ay",
    "field.minuten": "Dakika",
    "field.jeFahrt": "Sürüş başına",
    "field.minutenJeFahrt": "Sürüş başına dakika",
    "field.deltaVormonat": "Δ önceki aya göre",
    "field.kunden": "Müşteriler",
    "field.fahrtenJeKunde": "Müşteri başına sürüş",
    "field.kilometer": "Kilometre",
    "field.kilometerJeFahrt": "Sürüş başına kilometre",
    "field.co2Ersparnis": "CO₂ tasarrufu",
    "field.davonGeschaetzt": "Bunun tahmini kısmı",
    "status.raw.verfuegbar": "Müsait",
    "status.label.verfuegbar": "Müsait",
    "status.raw.ausgeliehen": "Kirada",
    "status.label.ausgeliehen": "Kirada",
    "status.raw.wartung": "Bakımda",
    "status.label.wartung": "Bakımda",
    "status.raw.defekt": "Arızalı",
    "status.label.defekt": "Arızalı",
    "status.raw.ausgemustert": "Hizmet dışı",
    "status.label.ausgemustert": "Hizmet dışı",
    "status.raw.aktiv": "Aktif",
    "status.label.aktiv": "Aktif",
    "status.raw.gesperrt": "Engellendi",
    "status.label.gesperrt": "Engellendi",
    "status.raw.geschlossen": "Kapatıldı",
    "status.label.geschlossen": "Kapatıldı",
    "status.raw.offen": "Açık",
    "status.label.offen": "Açık",
    "status.raw.in_arbeit": "İşlemde",
    "status.label.in_arbeit": "İşlemde",
    "schwere.gering": "düşük",
    "schwere.mittel": "orta",
    "schwere.fahruntauglich": "sürüşe uygun değil",
    "button.newBike": "Yeni bisiklet ekle",
    "button.create": "Oluştur",
    "button.setTo": "{ziel} olarak ayarla",
    "button.whyTarget": "Neden {ziel}?",
    "button.decommission": "Hizmetten çıkar",
    "button.decommissionReason": "Hizmetten çıkarma sebebi",
    "button.newStation": "Yeni istasyon ekle",
    "button.decommissionStation": "Kullanımdan kaldır",
    "button.newCustomer": "Yeni müşteri ekle",
    "button.save": "Kaydet",
    "button.block": "Engelle",
    "button.blockReason": "Engelleme sebebi",
    "button.disclosureArt15": "Madde 15 uyarınca bilgi talebi",
    "button.deletionArt17": "Madde 17 uyarınca silme",
    "button.downloadJson": "JSON olarak indir",
    "button.close": "Kapat",
    "button.reportDamage": "Hasar bildir",
    "button.openWorkOrder": "İş emri aç",
    "button.bikeInFleet": "Filodaki bisiklet",
    "button.report": "Bildir",
    "button.resolve": "Tamamla",
    "button.toOpenDamage": "Açık hasarlara git",
    "button.damageInFleet": "Filodaki bisiklet",
    "button.list": "Liste",
    "button.map": "Harita",
    "button.showCustomersOnMap": "Konuma göre müşterileri göster",
    "empty.noBikesFilterTitle": "Bu filtreyle eşleşen bisiklet yok",
    "empty.noBikesFilterText": "Filodaki hiçbir bisiklet seçilen kısıtlamayı karşılamıyor.",
    "empty.noCustomersFilterTitle": "Bu filtreyle eşleşen müşteri yok",
    "empty.noCustomersFilterTextSearch": "\"{suchtext}\" ile eşleşen hiçbir müşteri ek olarak seçilen kısıtlamayı karşılamıyor.",
    "empty.noCustomersFilterText": "Hiçbir müşteri seçilen kısıtlamayı karşılamıyor.",
    "empty.statusFilterReset": "Durum filtresini sıfırla",
    "empty.noOpenDamageTitle": "Açık hasar bildirimi yok",
    "empty.noOpenDamageText": "Şu anda herhangi bir hasar bildirimi bulunmuyor. Bu normal durumdur — bir bisiklette bir şey fark edildiğinde bildirim yapılır.",
    "empty.noDamageFilterTitle": "Bu filtreyle eşleşen hasar bildirimi yok",
    "empty.noDamageFilterText": "Hiçbir açık hasar bildirimi seçilen kısıtlamayı karşılamıyor.",
    "empty.noWorkOrdersTitle": "Devam eden iş emri yok",
    "empty.noWorkOrdersText": "Şu anda herhangi bir bakım iş emri bulunmuyor. Bir iş emri, açık bir hasar bildiriminden oluşturulur — \"İş emri aç\" düğmesi oradadır.",
    "misc.underway": "yolda",
    "misc.underwayNoLocation": "yolda (konum yok)",
    "misc.noneYet": "henüz yok",
    "misc.noMembership": "üyeliksiz",
    "misc.notYetAssigned": "henüz atanmadı",
    "misc.justNow": "az önce",
    "misc.inOperation": "işletimde",
    "misc.decommissionedState": "kullanım dışı",
    "misc.noAddressOnFile": "Bu kişi için kayıtlı bir adres yok - bu bir yükleme hatası değildir. Aşağıdaki alanlar doldurularak adres eklenebilir.",
    "misc.disclosureLoggedNote": "Madde 15 bilgi talebinin görüntülenmesi kayıt altına alınır (GR19): görüntüleyen kişi değişiklik günlüğünde iz bırakır.",
    "misc.damageBlocksImmediately": "Sürüşe uygun olmadığını gösteren bir hasar bisikleti hemen kilitler - şu anda kullanımda olması dışında. Bu durumda durum şimdilik değişmeden kalır (GR13, yoldaki bir bisiklete başka bir durum vermez) ve kilitleme ancak iade sırasında devreye girer.",
    "misc.onlyUnrideableBlocks": "Bisikleti yalnızca sürüşe uygun olmadığını belirten bir bildirim otomatik olarak kilitler.",
    "misc.noMinutesNeeded": "Dakika cinsinden çalışma süresi gereklidir (0 veya daha fazla).",
    "art17.confirmHeader": "{name} için GDPR Madde 17 uyarınca silme işlemi?",
    "art17.whatDisappears": "NE KAYBOLUR: ad, e-posta, telefon numarası, doğum tarihi, adres, ödeme yöntemi ve oturum açma hesabıyla bağlantı. Eski değerler değişiklik günlüğünde de tanınmaz hale getirilir.",
    "art17.whatRemains": "NE KALIR: {phrase} ve tüm faturalar, tam tutarlarıyla. Vergi hukuku on yıl saklama süresi öngörür ve GDPR tam olarak bu yükümlülüğü silme kapsamından hariç tutar.",
    "art17.whatThisDoesNotAchieve": "BUNUN SAĞLAMADIĞI: Sürüşler zaman ve konum bilgisi taşır. Aynı noktadan aynı saatte düzenli olarak sürüş yapan biri bu sayede yine de tespit edilebilir.",
    "art17.irreversible": "Bu işlem geri alınamaz.",
    "art17.reasonPrompt": "Sebep (ör. ilgili kişinin … tarihli talebi)",
    "art17.abortedNoReason": "İptal edildi: sebep belirtilmeden silme yapılmaz.",
    "art17.runningRideBlocks": "{name} için devam eden bir sürüş var. Önce iadenin yapılmasını bekleyin.",
    "art17.doneMessage": "Müşteri {nummer} anonimleştirildi. Faturalar ve sürüşler saklanmaya devam eder.",
    "art17.confirmWord": "LOESCHEN",
    "tile.minimum": "Minimum",
    "tile.maximum": "Maksimum",
    "tile.countPerMonth": "Aya göre sayı",
    "tile.dayWithMostRides": "En çok sürüşün olduğu gün",
    "tile.occupancy": "Doluluk",
    "tile.trafficByTimeSlot": "Zaman dilimine göre giriş ve çıkış",
    "tile.weekdays": "Hafta içi (Pzt–Cum)",
    "tile.weekend": "Hafta sonu (Cmt/Paz)",
    "tile.bikesAtStation": "Bu istasyondaki bisikletler ({n})",
    "tile.noBikesHere": "Şu anda burada bisiklet yok - hepsi yolda, atölyede ya da arızalı.",
    "tile.noTrafficData": "Bu istasyon için trafik verisi bulunmuyor.",
    "tile.legendDepartures": "Günlük çıkış (üstte)",
    "tile.legendArrivals": "Günlük giriş (altta)",
    "tab.revenueByBikeType": "Bisiklet tipine göre ciro",
    "tab.revenueByCustomerGroup": "Müşteri grubuna göre ciro",
    "tab.kmCo2": "Kilometre ve CO₂",
    "tab.stationOccupancy": "İstasyon doluluğu",
    "tab.openDamage": "Açık hasarlar",
    "tab.workOrders": "İş emirleri",
    "auskunft.title": "GDPR Madde 15 uyarınca bilgi talebi · {name}",
    "auskunft.stammdaten": "Ana veriler",
    "auskunft.mitgliedschaften": "Üyelikler",
    "auskunft.fahrten": "Sürüşler",
    "auskunft.rechnungen": "Faturalar",
    "auskunft.zahlungen": "Ödemeler",
    "auskunft.schadensmeldungen": "Hasar bildirimleri",
    "auskunft.freiminuten": "Ücretsiz dakikalar",
    "auskunft.protokoll": "Günlük",
    "map.mapNote": "Daire boyutu bir istasyonun kapasitesini, dolgu ise mevcut doluluğunu gösterir.",
    "map.areaWithCustomers": "{stationenPhrase} ve müşteri konumlarını içeren harita alanı",
    "map.area": "{stationenPhrase} içeren harita alanı",
    "map.customersAtLocation": "{ort}: {kundenPhrase}",
    "map.detailAreaNote": "Kesit: bu istasyon ve en yakın komşuları.",
    "map.libraryUnavailable": "Harita kitaplığı yüklenemedi (muhtemelen içerik dağıtım ağına erişim yok). Tüm istasyon bilgileri listede erişilebilir durumda kalır.",
    "map.tilesUnavailable": "Harita kareleri yüklenemedi. Aşağıdaki istasyon işaretleri yine de doğru konumda duruyor.",
    "map.zoomIn": "Yakınlaştır",
    "map.zoomOut": "Uzaklaştır",
    "tile.stationMap": "Ağdaki konum",
    "tile.noStationLocation": "Bu istasyon için koordinat bulunmuyor.",
    "common.and": "ve",
    "board.toggleAria": "Paneli genişlet/daralt",
    "board.seriesPartPhrase": "{teil}: {wert}",
    "msg.bikeNowSetTo": "{rahmennummer} artık {ziel} olarak ayarlandı.",
    "msg.confirmDecommission": "{rahmennummer} kalıcı olarak hizmetten mi çıkarılsın? Bisiklet konumunu kaybeder ve artık hiçbir listede görünmez. Sürüşleri saklanmaya devam eder.",
    "msg.bikeDecommissioned": "{rahmennummer} hizmetten çıkarıldı.",
    "msg.fleetLoadFailed": "Filo yüklenemedi: {fehler}",
    "msg.noBikeWithFilter": "Bu filtreyle eşleşen bisiklet yok",
    "msg.modelsOrStationsLoadFailed": "Modeller veya istasyonlar yüklenemedi: {fehler}",
    "msg.noModelsOrStations": "Yeni bir bisikletin oluşturulabileceği ne model ne de istasyon bulunuyor.",
    "msg.frameNumberMissing": "Şasi numarası eksik.",
    "msg.bikeCreated": "{rahmennummer} bisikleti oluşturuldu.",
    "msg.stationsLoadFailed": "İstasyonlar yüklenemedi: {fehler}",
    "msg.stationsSummary": "{stationenPhrase}, bunlardan {n} tanesi dolu: {liste}",
    "msg.stationStillHasBikes": "{name} istasyonunda hâlâ {raederPhrase} var. Önce başka bir yere iade edilmeleri gerekir.",
    "msg.confirmDecommissionStation": "{name} bugün itibarıyla kullanımdan mı kaldırılsın? İstasyon tüm raporlarda görünür kalır ancak artık bisiklet kabul etmez.",
    "msg.stationDecommissioned": "{name} kullanımdan kaldırıldı.",
    "msg.bikesAtStationLoadFailed": "Bisikletler yüklenemedi: {fehler}",
    "msg.trafficLoadFailed": "İstasyon trafiği yüklenemedi: {fehler}",
    "msg.customersLoadFailed": "Müşteriler yüklenemedi: {fehler}",
    "msg.firstLastNameRequired": "Ad ve soyadı gereklidir.",
    "msg.customerSaved": "{vorname} {nachname} kaydedildi.",
    "msg.confirmBlockCustomer": "{vorname} {nachname} engellensin mi? Şu anda bir engeli kaldıran bir işlev bulunmuyor - bu, bu diyalogun bir kolaylığı değil, sistemin bilinen bir eksikliğidir.",
    "msg.customerBlocked": "{vorname} {nachname} engellendi.",
    "msg.nameEmailRequired": "Ad, soyadı ve e-posta gereklidir.",
    "msg.customerCreated": "{vorname} {nachname} müşterisi oluşturuldu.",
    "msg.customersCapped": "200/daha fazla müşteri{zusatz} — lütfen daha fazla daraltın",
    "msg.searchFor": "\"{suchtext}\" için",
    "msg.statusList": "Durum {liste}",
    "msg.damageLoadFailed": "Hasarlar yüklenemedi: {fehler}",
    "msg.noBikeForDamage": "Bir hasarın atanabileceği hiçbir bisiklet yok.",
    "msg.categoryDescriptionRequired": "Kategori ve açıklama gereklidir.",
    "msg.damageReportedBlocked": "Bildirim {id} oluşturuldu. Bisiklet kilitlendi — şu anda sürülmüyorsa; sürülüyorsa iade sırasında kilitlenecektir.",
    "msg.damageReported": "Bildirim {id} oluşturuldu.",
    "msg.workOrderOpened": "İş emri {id} açıldı, bisiklet bakıma alındı.",
    "msg.workOrdersLoadFailed": "İş emirleri yüklenemedi: {fehler}",
    "msg.workOrderCompleted": "İş emri {auftragsnummer} tamamlandı.",
    "field.baujahr": "Model yılı",
    "field.gewicht": "Ağırlık",
    "field.gangzahl": "Vites sayısı",
    "field.rahmenhoehe": "Kadro boyu",
    "field.akkukapazitaet": "Batarya kapasitesi",
    "field.reichweite": "Menzil",
    "col.together": "Toplam",
    "col.model": "Model",
    "col.stock": "Mevcut",
    "col.statusMix": "Durum",
    "col.modelYear": "Model yılı",
    "col.utilisationDeviation": "Filoya göre kullanım",
    "col.station": "İstasyon",
    "col.occupied": "Dolu",
    "col.turnover": "Devir",
    "col.rides": "Seferler",
    "col.revenuePerRideColumn": "Sefer başına ciro",
    "col.balance": "Denge",
    "col.tariffGroup": "Tarife grubu",
    "col.customers": "Müşteri",
    "col.customerMix": "Kullanım",
    "col.revenueDeviation": "Ciro ile müşteri payı farkı",
    "col.case": "Vaka",
    "col.workTime": "Çalışma süresi",
    "col.severity": "Ciddiyet",
    "col.progress": "İşlem durumu",
    "col.bikeType": "Bisiklet tipi",
    "col.revenue": "Ciro",
    "col.monthlyCourse": "Aylık seyir",
    "col.revenueVsRides": "Ciro ile sürüş payı farkı",
    "col.kilometres": "Kilometre",
    "col.kmPerRideDeviation": "Sürüş başına km ile ortalama farkı",
    "col.movements": "Hareketler",
    "col.fillLevel": "Doluluk oranı",
    "unit.bikes": "bisiklet",
    "unit.shareOfRow": "satır payı",
    "unit.percentagePoints": "yüzde puanı",
    "unit.ridesArrivalsMinusDepartures": "sürüş, giriş eksi çıkış",
    "unit.persons": "kişi",
    "unit.minutes": "dakika",
    "unit.threeSteps": "3 kademe",
    "unit.reportedToFixed": "bildirimden giderilmeye",
    "unit.euroTwelveMonths": "avro, 12 ay",
    "unit.bikesOfCapacity": "bisiklet, çerçeve = park yeri",
    "unit.movementsPerDock": "park yeri başına hareket",
    "unit.euroPerRide": "avro",
    "unit.ridesTwelveMonths": "sefer, 12 ay",
    "unit.kmTwelveMonths": "toplam, 12 ay",
    "unit.kmPerRide": "sürüş başına kilometre",
    "unit.departuresPlusArrivals": "çıkış ve giriş",
    "unit.zeroToHundred": "0–100 %",
    "board.fleetTitle": "Modele göre mevcut",
    "board.fleetReference": "{raederPhrase} · {herstellerPhrase} üreticiden {modellePhrase} · model yılları {vonJahr}–{bisJahr} · şu anda %{quote} kirada",
    "board.fleetStatusAria": "{name}: {aufteilung}",
    "board.fleetYearAria": "{name}, model yılı {jahr}, {vonJahr}–{bisJahr} ölçeğinde",
    "board.fleetDeviationAria": "{name}: %{quote} kirada, tüm filo %{flottenquote}",
    "board.fleetFootnote": "Sapma: model başına kirada olan bisiklet payı, tüm filodaki %{quote} ile karşılaştırılır – beş model oranının ortalaması değil, toplamlardan hesaplanır.",
    "board.fleetNoLocationFootnote": "{raederPhrase} müsait görünüyor ama konumu yok – kayıtta hazır, ağda bulunamıyor.",
    "board.stationsTitle": "İstasyona göre ağ",
    "board.stationsReference": "{stationenPhrase} · {kapazitaet} park yerinden {belegt} dolu (%{prozent}) · tamamlanan tüm sürüşlerin dengesi",
    "board.stationOccupancyAria": "{name}: {kapazitaet} park yerinden {belegt} dolu, %{prozent}",
    "board.stationBalanceAria": "{name}: {zugaenge} giriş, {abgaenge} çıkış, denge {saldo}",
    "board.stationsFootnote": "Çıkışlar tüm istasyonlarda {min} ile {max} arasında – talep eşit dağılmış, farklar yalnızca dengede.",
    "board.stationTurnoverAria": "{name}: {kapazitaet} park yerinde park yeri başına {wert} hareket",
    "board.stationsRhythmFootnote": "Günlük seyir bütün istasyonlarda aynı: hafta içi çıkışların % {morgenMin} ila {morgenMax} kadarı 6-8 arasında, % {nachmittagMin} ila {nachmittagMax} kadarı 16-18 arasında gerçekleşir. Tek bir istasyonu değil ağı tanımlar – bu yüzden sütun olarak değil burada yer alır.",
    "board.customersTitle": "Tarife grubuna göre kayıtlar",
    "board.customersReference": "{kundenPhrase} · {gesperrt} engellenmiş · {volumen} fatura hacmi · {ort} içinde {imOrt}, {ortePhrase} arasında dağılmış",
    "board.customersNoTariff": "Aktif tarife yok",
    "board.customersWithRides": "sürüşü olan",
    "board.customersNoRides": "sürüşü olmayan",
    "board.customersRevenueShare": "hacmin %{anteil} kadarı",
    "board.customersRevenuePerRideAria": "{name}: {fahrtenPhrase} için sefer başına {betrag}",
    "board.customersMixAria": "{name}: {aufteilung}",
    "board.customersDeviationAria": "{name}: müşterilerin %{kundenanteil} kadarıyla hacmin %{umsatzanteil} kadarı",
    "board.customersActiveMax": "ayda en fazla {kundenPhrase}",
    "board.customersFootnote": "En üstteki {zehntel} müşteri fatura hacminin %{anteil} kadarını taşıyor; {ohneAdresse} kayıtta adres yok.",
    "board.maintenanceTitle": "Tek tek vakalar",
    "board.maintenanceReference": "{schadenPhrase} · etkilenen {raederPhrase} ({typen}) · {auftraegePhrase} · bildirim {tag}",
    "board.maintenanceSeverityAria": "{rad}: {schwere}, 3 kademeden {stufe}",
    "board.maintenanceProgressAria": "{rad}: {stand}, {auftrag}",
    "board.maintenanceHasOrder": "iş emri var",
    "board.maintenanceNoOrder": "iş emri yok",
    "board.maintenanceFootnote": "Sapma sütunu ve ortalama yok: {schadenPhrase}, bunlardan {offen} tanesi açık, kayıtlı {minuten} dakika çalışma – buradaki her oran kendi kendisinin istatistiği olurdu.",
    "board.revenueTypeTitle": "Bisiklet tipine göre on iki ay",
    "board.revenueGroupTitle": "Tarife grubuna göre on iki ay",
    "board.revenueReference": "{umsatz} ve {fahrtenPhrase}, {vonMonat}–{bisMonat}",
    "board.revenueReferenceWithFleet": "{umsatz} ve {fahrtenPhrase}, {vonMonat}–{bisMonat} · bisiklet başına günde {jeRadTag} ({raederPhrase})",
    "board.revenuePerRide": "sürüş başına {betrag}",
    "board.monthlyCourseAria": "{name}: {vonMonat}–{bisMonat} seyri, en yüksek {max} ({maxMonat}), son {aktuell}",
    "board.revenueVsRidesAria": "{name}: sürüşlerin %{fahrtenanteil} kadarıyla cironun %{umsatzanteil} kadarı",
    "board.revenueTypeFootnote": "City-Bike'ta sürüş başına ciro: {monat} itibarıyla {von} yerine {nach} ({veraenderung}) – dönemdeki tek tarife değişikliği.",
    "board.revenueGroupFootnote": "Aylık müşteri sayıları toplanamaz; aynı kişiler birden çok ayda sürüş yapar. Bu nedenle satır etiketi toplamı değil, en güçlü ayı gösterir.",
    "board.kmTitle": "Bisiklet tipine göre mesafe",
    "board.kmReference": "{fahrtenPhrase} üzerinde {km}, {vonMonat}–{bisMonat} · sürüşlerin {anteil} kadarı tahmini",
    "board.co2PerRide": "sürüş başına {kg} CO₂",
    "board.kmPerRideAria": "{name}: sürüş başına {je}, ortalama {schnitt}",
    "board.kmFootnote": "Tahmin payı ({anteil}) sürüşe göre ağırlıklı hesaplanır, aylık payların ortalaması değildir: gösterilen dönemde bu {ungewichtet}, tüm {monatszeilen} genelinde ise {alleGewichtet} yerine {alleUngewichtet} verirdi – düz ortalamada az sürüşlü aylar yoğun aylarla aynı ağırlığa sahiptir.",
    "board.stationLoadTitle": "İstasyona göre hareket",
    "board.stationLoadReference": "{stationenPhrase} · tüm geçmişte {fahrten} çıkış",
    "board.fillLevelAria": "{name}: doluluk %{prozent}",
    "board.stationLoadFootnote": "Çıkışlar {min} ile {max} arasında – talep eşit dağılmış, karar yalnızca dengeye göre verilir.",
    "board.halfYearFootnote": "Kış payı her satırda %{min} ile %{max} arasında – mevsimsellik hepsini aynı ölçüde etkiler ve satırları birbirinden ayırmaz.",
  },
  es: {
    "common.cancel": "Cancelar",
    "common.confirm": "Confirmar",
    "common.reason": "Motivo",
    "common.all": "Todos",
    "common.actionsColumn": "Acciones",
    "common.noSearchPlaceholder": "Sin búsqueda en esta sección",
    "common.noSearchAria": "Búsqueda no disponible en esta sección",
    "common.confirmWordPrompt": "Escriba \"{wort}\" para confirmar:",
    "common.sortAria": "Ordenar por {titel}",
    "common.sortAriaSuffix": ", actualmente {richtung}",
    "common.ascending": "ascendente",
    "common.descending": "descendente",
    "common.sortResetAria": "Restablecer orden por {titel}",
    "common.sortResetTitle": "Restablecer orden",
    "common.groupByAria": "Agrupar por {titel}",
    "common.groupResetAria": "Quitar agrupación por {titel}",
    "common.groupResetTitle": "Restablecer agrupación",
    "common.groupTitle": "Agrupar",
    "common.filterAria": "Filtrar {titel}",
    "common.filterMinAria": "Valor mínimo para {titel}",
    "common.filterSearchPlaceholder": "Buscar…",
    "common.filterResetAria": "Restablecer filtro de {titel}",
    "common.filterResetTitle": "Restablecer filtro",
    "common.columnFilterReset": "Restablecer filtros de columna",
    "common.noRowsMatchFilter": "Ninguna fila cumple la restricción seleccionada en el encabezado de columna. ",
    "common.groupedBy": "Agrupado por {titel}",
    "common.ungroup": "Quitar agrupación",
    "common.groupHeaderLabel": "{titel}: {beschriftung} ({n})",
    "common.closeDetailsAria": "Cerrar detalles",
    "common.closeDetailsTitle": "Cerrar detalles (Esc)",
    "common.rowsFiltered": "{angezeigt} de {zeilenPhrase} (filtro de columna activo)",
    "common.selectedCount": "{n} seleccionados",
    "common.minAbbrev": "min",
    "common.hourAbbrev": "h",
    "common.underOneMinute": "menos de 1 min",
    "common.loggedInFor": "conectado desde hace {dauer}",
    "common.sinceOpen": "desde que se abrió: {dauer}",
    "common.loginCheckFailed": "No se pudo verificar el inicio de sesión: {msg}",
    "common.loginBadCredentials": "El correo o la contraseña no son correctos.",
    "common.rolesCheckFailed": "No se pudieron determinar los roles: {msg}",
    "common.roleCheckFailed": "No se pudo comprobar el rol {code}: {msg}",
    "common.of": "de",
    "common.xOfPhrase": "{x} de {phrase}",
    "misc.estimatedParen": " ({prozent} estimado)",
    "hint.ridesPerDayHeading": "Viajes por día — {monat} (total, todos los tipos de bicicleta y tarifas)",
    "status.label.abgebrochen": "Cancelado",
    "status.raw.abgebrochen": "Cancelado",
    "status.label.erledigt": "Completado",
    "status.raw.erledigt": "Completado",
    "status.label.verworfen": "Descartado",
    "status.raw.verworfen": "Descartado",
    "status.label.behoben": "Resuelto",
    "status.raw.behoben": "Resuelto",
    "msg.stationsWithoutBikeSuffix": ", {n} de ellas sin ninguna bicicleta",
    "empty.noStationOccupancyText": "No hay ninguna estación. Con diez estaciones creadas, esto es inusual: podría deberse a una pérdida temporal de rol en lugar de datos faltantes.",
    "empty.noStationOccupancyTitle": "Sin ocupación de estaciones",
    "msg.stationOccupancyLoadFailed": "No se pudo cargar la ocupación de estaciones: {fehler}",
    "misc.estimatedRidesDetail": "{geschaetzt} de {fahrtenPhrase} ({prozent})",
    "msg.kmCo2Summary": "{monatszeilen}, {fahrten}, ahorro total de CO₂ {co2}, de los cuales {prozent} estimado (ponderado por viajes)",
    "empty.noKmCo2Title": "Sin filas de kilómetros y CO2",
    "msg.kmCo2LoadFailed": "No se pudieron cargar los kilómetros y el CO2: {fehler}",
    "field.jeKunde": "Por cliente",
    "msg.revenueByCustomerGroupSummary": "{monatszeilen}, facturación total {umsatz}",
    "empty.noRevenueByCustomerGroupTitle": "Sin facturación por grupo de clientes",
    "msg.revenueByCustomerGroupLoadFailed": "No se pudo cargar la facturación por grupo de clientes: {fehler}",
    "msg.revenueByBikeTypeSummary": "{monatszeilen}, {fahrten}, facturación total {umsatz}",
    "msg.revenueByBikeTypeLoadFailed": "No se pudo cargar la facturación por tipo de bicicleta: {fehler}",
    "empty.noRevenueByBikeTypeText": "No hay ninguna fila mensual. Con un año de referencia con datos, esto es inusual: podría deberse a una pérdida temporal de rol en lugar de datos faltantes.",
    "empty.noRevenueByBikeTypeTitle": "Sin facturación por tipo de bicicleta",
    "misc.estimatedSuffix": " (estimado)",
    "field.strecke": "Distancia",
    "field.dauer": "Duración",
    "field.ziel": "Destino",
    "field.start": "Inicio",
    "misc.bikesOnDateCaption": "Bicicletas el {datum} - sin referencia a clientes, véase v_wawi_fahrten_je_tag_rad",
    "button.backToDayOverview": "Volver al resumen diario",
    "misc.bikesOnDate": "Bicicletas el {datum}",
    "misc.noBikeRiddenThisDay": "Ese día no se usó ninguna bicicleta.",
    "msg.thisDayBikesLoadFailed": "No se pudieron cargar las bicicletas de este día: {fehler}",
    "hint.legendColorScale": "Color = viajes de este día en relación con el día más concurrido del mes ({phrase}).",
    "hint.dayRidesAria": "{datum}: {phrase}",
    "hint.calendarCaption": "Viajes por día, {monat}",
    "hint.tiedDaysCount": "{tagePhrase} empatados, {phrase} cada uno",
    "hint.totalForMonth": "{phrase}, total",
    "hint.dailyRidesChartAria": "Viajes por día en {monat} de {jahr}, total en todos los tipos de bicicleta y tarifas: entre {min} y {maxPhrase}, en promedio {mittel}. La mayoría de los viajes el {tageListe} de {monat}, con {maxPhrase} cada uno.",
    "msg.dailyFiguresLoadFailed": "No se pudieron cargar las cifras diarias: {fehler}",
    "misc.workOrderTitle": "Orden de trabajo {auftragsnummer}",
    "msg.activeWorkOrdersCount": "{n} órdenes de trabajo en curso",
    "misc.reportForBike": "Notificación de {rahmennummer}",
    "msg.openDamageWithUnrideable": "{n}{zusatz} averías abiertas, de las cuales {dringend} no aptas para circular",
    "msg.openDamageCount": "{n}{zusatz} averías abiertas",
    "misc.atLeastValue": "≥ {n} {einheit}",
    "misc.allLowercase": "todas",
    "field.minAge": "Antigüedad mínima",
    "field.offenSeit": "Abierta desde",
    "field.gemeldet": "Notificado",
    "misc.stillRunning": "{datum} · en curso",
    "misc.noRentalYet": "Todavía sin alquiler",
    "msg.stationCreated": "Estación {name} creada.",
    "msg.capacityPositiveInteger": "El número de plazas debe ser un número entero positivo.",
    "msg.longitudeRange": "La longitud debe estar entre -180 y 180.",
    "msg.latitudeRange": "La latitud debe estar entre -90 y 90.",
    "msg.latLonRequired": "Se requieren latitud y longitud.",
    "msg.stationFieldsRequired": "Se requieren nombre, calle, número, código postal y ciudad.",
    "field.laenge": "Longitud",
    "field.breite": "Latitud",
    "field.hausnummerVoll": "Número de casa",
    "field.name": "Nombre",
    "hint.arrivalsPerDayLabel": "{label}: {n} llegadas al día",
    "hint.departuresPerDayLabel": "{label}: {n} salidas al día",
    "hint.trafficPatternAria": "{wochentypTitel} en {name}, promediado en {tage} días. La mayoría de las salidas se producen en la franja {zeitfensterAb} con {maxAb} al día, la mayoría de las llegadas en la franja {zeitfensterZu} con {maxZu} al día.",
    "hint.stationFullNote": " La estación está llena y no admite devoluciones en este momento.",
    "hint.stationOccupancyAria": "Ocupación {name}: {belegt} de {kapazitaet} plazas, {prozent} por ciento. El 100 % es la capacidad de esta única estación.{vollZusatz}",
    "map.openDetailsSuffix": ". Abrir detalles.",
    "map.currentStationSuffix": " - esta es la estación mostrada",
    "map.stationFullSuffix": ", llena - no admite devoluciones en este momento",
    "map.stationBelegLabel": "{name}: {belegt} de {kapazitaet} plazas ocupadas",
    "map.customerLabelShort": "{ort} ({n})",
    "misc.freeShort": "{n} libres",
    "misc.unitsInStock": "{n} en existencia",
    "nav.originDamageReport": "Notificación de avería de {rahmennummer}",
    "nav.originBikeFromStation": "Bicicleta {rahmennummer} de {name}",
    "nav.originBikeFromFleet": "Bicicleta {rahmennummer} de la flota",
    "index.title": "VeloCity Gestión de Inventario",
    "index.brandLinkAria": "VeloCity – sitio web público, se abre en una pestaña nueva",
    "index.loading": "Un momento …",
    "index.loginEmail": "Correo electrónico",
    "index.loginPassword": "Contraseña",
    "index.loginSubmit": "Iniciar sesión",
    "index.noAccessTitle": "Sin acceso",
    "index.noAccessText": "Esta cuenta no está registrada en VeloCity como cuenta de personal. Si es cliente, encontrará su área en",
    "index.logout": "Cerrar sesión",
    "index.noRoleTitle": "Aún no se ha asignado un rol",
    "index.noRoleText": "Su cuenta está registrada en VeloCity como cuenta de personal, pero aún no se le ha asignado ningún área de responsabilidad. Póngase en contacto con la dirección para que le asigne un rol.",
    "index.searchPlaceholder": "Buscar",
    "index.profileAria": "Perfil y configuración",
    "index.navToggleAria": "Contraer o expandir la navegación",
    "index.settingsHeading": "Configuración",
    "index.zebraLabel": "Rayado cebra en tablas",
    "index.languageLabel": "Idioma",
    "index.navAria": "Áreas de trabajo",
    "index.workListAria": "Lista de trabajo",
    "index.detailAria": "Formulario de detalle",
    "nav.flotte": "Flota",
    "nav.stationen": "Estaciones",
    "nav.kunden": "Clientela",
    "nav.instandhaltung": "Mantenimiento",
    "nav.auswertungen": "Informes",
    "nav.kundenSuche": "Clientela: nombre, correo, número de cliente",
    "field.rahmennummer": "Número de bastidor",
    "field.typ": "Tipo",
    "field.status": "Estado",
    "field.standort": "Ubicación",
    "field.schaeden": "Averías",
    "field.modell": "Modelo",
    "field.angeschafft": "Adquirido",
    "field.letzteWartung": "Último mantenimiento",
    "field.offeneSchaeden": "Averías abiertas",
    "field.hoechsteSchwere": "Gravedad máxima",
    "field.radtyp": "Tipo de bicicleta",
    "field.station": "Estación",
    "field.nummer": "Número",
    "field.ort": "Ubicación",
    "field.belegt": "Ocupado",
    "field.frei": "Libre",
    "field.anschrift": "Dirección",
    "field.stellplaetze": "Plazas",
    "field.lage": "Coordenadas",
    "field.betrieb": "Funcionamiento",
    "field.akku": "Batería",
    "field.nachname": "Apellido",
    "field.vorname": "Nombre",
    "field.tarif": "Tarifa",
    "field.kundeSeit": "Cliente desde",
    "field.letzteAusleihe": "Último alquiler",
    "field.anrede": "Tratamiento",
    "field.email": "Correo electrónico",
    "field.telefon": "Teléfono",
    "field.strasse": "Calle",
    "field.hausnummer": "N.º",
    "field.plz": "Código postal",
    "field.hinweis": "Aviso",
    "field.fahrten": "Viajes",
    "field.umsatz": "Facturación",
    "field.offen": "Pendiente",
    "field.kategorie": "Categoría",
    "field.gemeldetVon": "Notificado por",
    "field.gemeldetAm": "Notificado el",
    "field.beschreibung": "Descripción",
    "field.schwere": "Gravedad",
    "field.stand": "Estado",
    "field.bisherigeAuftraege": "Órdenes anteriores",
    "field.rad": "Bicicleta",
    "field.auftrag": "Orden de trabajo",
    "field.eroeffnet": "Abierto",
    "field.bearbeiter": "Responsable",
    "field.arbeitszeitMinuten": "Tiempo de trabajo (minutos)",
    "field.bemerkung": "Observación",
    "field.kapazitaet": "Capacidad",
    "field.abgaenge": "Salidas",
    "field.zugaenge": "Llegadas",
    "field.saldo": "Saldo",
    "field.fuellstand": "Nivel de ocupación",
    "field.monat": "Mes",
    "field.minuten": "Minutos",
    "field.jeFahrt": "Por viaje",
    "field.minutenJeFahrt": "Minutos por viaje",
    "field.deltaVormonat": "Δ frente al mes anterior",
    "field.kunden": "Clientes",
    "field.fahrtenJeKunde": "Viajes por cliente",
    "field.kilometer": "Kilómetros",
    "field.kilometerJeFahrt": "Kilómetros por viaje",
    "field.co2Ersparnis": "Ahorro de CO₂",
    "field.davonGeschaetzt": "De los cuales estimado",
    "status.raw.verfuegbar": "Disponible",
    "status.label.verfuegbar": "Disponible",
    "status.raw.ausgeliehen": "Alquilada",
    "status.label.ausgeliehen": "Alquilada",
    "status.raw.wartung": "En mantenimiento",
    "status.label.wartung": "En mantenimiento",
    "status.raw.defekt": "Averiada",
    "status.label.defekt": "Averiada",
    "status.raw.ausgemustert": "Dada de baja",
    "status.label.ausgemustert": "Dada de baja",
    "status.raw.aktiv": "Activo",
    "status.label.aktiv": "Activo",
    "status.raw.gesperrt": "Bloqueado",
    "status.label.gesperrt": "Bloqueado",
    "status.raw.geschlossen": "Cerrado",
    "status.label.geschlossen": "Cerrado",
    "status.raw.offen": "Abierta",
    "status.label.offen": "Abierta",
    "status.raw.in_arbeit": "En curso",
    "status.label.in_arbeit": "En curso",
    "schwere.gering": "leve",
    "schwere.mittel": "moderada",
    "schwere.fahruntauglich": "no apta para circular",
    "button.newBike": "Añadir nueva bicicleta",
    "button.create": "Crear",
    "button.setTo": "Establecer en {ziel}",
    "button.whyTarget": "¿Por qué {ziel}?",
    "button.decommission": "Dar de baja",
    "button.decommissionReason": "Motivo de la baja",
    "button.newStation": "Añadir nueva estación",
    "button.decommissionStation": "Dar de baja",
    "button.newCustomer": "Añadir nuevo cliente",
    "button.save": "Guardar",
    "button.block": "Bloquear",
    "button.blockReason": "Motivo del bloqueo",
    "button.disclosureArt15": "Solicitud de información conforme al art. 15",
    "button.deletionArt17": "Supresión conforme al art. 17",
    "button.downloadJson": "Descargar como JSON",
    "button.close": "Cerrar",
    "button.reportDamage": "Notificar avería",
    "button.openWorkOrder": "Abrir orden de trabajo",
    "button.bikeInFleet": "Bicicleta en la flota",
    "button.report": "Notificar",
    "button.resolve": "Completar",
    "button.toOpenDamage": "Ir a las averías abiertas",
    "button.damageInFleet": "Bicicleta en la flota",
    "button.list": "Lista",
    "button.map": "Mapa",
    "button.showCustomersOnMap": "Mostrar clientes por ubicación",
    "empty.noBikesFilterTitle": "No hay bicicletas con este filtro",
    "empty.noBikesFilterText": "Ninguna bicicleta de la flota cumple la restricción seleccionada.",
    "empty.noCustomersFilterTitle": "No hay clientes con este filtro",
    "empty.noCustomersFilterTextSearch": "Ningún cliente que coincide con «{suchtext}» cumple además la restricción seleccionada.",
    "empty.noCustomersFilterText": "Ningún cliente cumple la restricción seleccionada.",
    "empty.statusFilterReset": "Restablecer filtro de estado",
    "empty.noOpenDamageTitle": "Sin averías abiertas",
    "empty.noOpenDamageText": "Actualmente no hay ninguna notificación de avería. Es el caso normal: se notifica cuando se detecta algo en una bicicleta.",
    "empty.noDamageFilterTitle": "No hay averías con este filtro",
    "empty.noDamageFilterText": "Ninguna avería abierta cumple la restricción seleccionada.",
    "empty.noWorkOrdersTitle": "Sin órdenes de trabajo en curso",
    "empty.noWorkOrdersText": "Actualmente no hay ninguna orden de trabajo. Una orden se crea a partir de una notificación de avería abierta, donde está el botón «Abrir orden de trabajo».",
    "misc.underway": "en ruta",
    "misc.underwayNoLocation": "en ruta (sin ubicación)",
    "misc.noneYet": "todavía ninguno",
    "misc.noMembership": "sin membresía",
    "misc.notYetAssigned": "aún no asignado",
    "misc.justNow": "justo ahora",
    "misc.inOperation": "en funcionamiento",
    "misc.decommissionedState": "dada de baja",
    "misc.noAddressOnFile": "No hay ninguna dirección registrada para esta persona; no se trata de un error de carga. Los campos de abajo se pueden rellenar para añadir una.",
    "misc.disclosureLoggedNote": "La consulta de la información conforme al art. 15 se registra (GR19): quien la consulta deja rastro en el registro de cambios.",
    "misc.damageBlocksImmediately": "Una avería que hace la bicicleta no apta para circular la bloquea de inmediato, salvo que esté en uso en ese momento. En ese caso el estado permanece sin cambios por ahora (GR13 no permite otro estado a una bicicleta en ruta) y el bloqueo solo se aplica al devolverla.",
    "misc.onlyUnrideableBlocks": "Solo una notificación de avería no apta para circular bloquea la bicicleta automáticamente.",
    "misc.noMinutesNeeded": "Se requiere el tiempo de trabajo en minutos (0 o más).",
    "art17.confirmHeader": "¿Supresión conforme al art. 17 del RGPD para {name}?",
    "art17.whatDisappears": "QUÉ DESAPARECE: nombre, correo electrónico, número de teléfono, fecha de nacimiento, dirección, medio de pago y el vínculo con la cuenta de acceso. Los valores antiguos también se vuelven irreconocibles en el registro de cambios.",
    "art17.whatRemains": "QUÉ PERMANECE: {phrase} y todas las facturas, en su totalidad. La legislación fiscal exige diez años de conservación, y el RGPD excluye expresamente esta obligación de la supresión.",
    "art17.whatThisDoesNotAchieve": "LO QUE ESTO NO CONSIGUE: los viajes contienen horas y lugares. Quien viaja regularmente desde el mismo punto a la misma hora sigue siendo identificable a través de ellos.",
    "art17.irreversible": "Esta acción no se puede deshacer.",
    "art17.reasonPrompt": "Motivo (p. ej.: solicitud del interesado de fecha …)",
    "art17.abortedNoReason": "Cancelado: sin motivo no hay supresión.",
    "art17.runningRideBlocks": "{name} todavía tiene un viaje en curso. Espere primero a la devolución.",
    "art17.doneMessage": "Cliente {nummer} anonimizado. Las facturas y los viajes se conservan.",
    "art17.confirmWord": "LOESCHEN",
    "tile.minimum": "Mínimo",
    "tile.maximum": "Máximo",
    "tile.countPerMonth": "Cantidad por mes",
    "tile.dayWithMostRides": "Día con más viajes",
    "tile.occupancy": "Ocupación",
    "tile.trafficByTimeSlot": "Llegadas y salidas por franja horaria",
    "tile.weekdays": "Días laborables (lun.–vie.)",
    "tile.weekend": "Fin de semana (sáb./dom.)",
    "tile.bikesAtStation": "Bicicletas en esta estación ({n})",
    "tile.noBikesHere": "Actualmente no hay ninguna bicicleta aquí: todas están en ruta, en el taller o averiadas.",
    "tile.noTrafficData": "No hay datos de tráfico disponibles para esta estación.",
    "tile.legendDepartures": "Salidas por día (arriba)",
    "tile.legendArrivals": "Llegadas por día (abajo)",
    "tab.revenueByBikeType": "Facturación por tipo de bicicleta",
    "tab.revenueByCustomerGroup": "Facturación por grupo de clientes",
    "tab.kmCo2": "Kilómetros y CO₂",
    "tab.stationOccupancy": "Ocupación de estaciones",
    "tab.openDamage": "Averías abiertas",
    "tab.workOrders": "Órdenes de trabajo",
    "auskunft.title": "Información conforme al art. 15 del RGPD · {name}",
    "auskunft.stammdaten": "Datos maestros",
    "auskunft.mitgliedschaften": "Membresías",
    "auskunft.fahrten": "Viajes",
    "auskunft.rechnungen": "Facturas",
    "auskunft.zahlungen": "Pagos",
    "auskunft.schadensmeldungen": "Averías",
    "auskunft.freiminuten": "Minutos gratuitos",
    "auskunft.protokoll": "Registro",
    "map.mapNote": "El tamaño del círculo muestra la capacidad de una estación, y el relleno su ocupación actual.",
    "map.areaWithCustomers": "Área del mapa con {stationenPhrase} y ubicaciones de clientes",
    "map.area": "Área del mapa con {stationenPhrase}",
    "map.customersAtLocation": "{ort}: {kundenPhrase}",
    "map.detailAreaNote": "Recorte: esta estación y sus vecinas más próximas.",
    "map.libraryUnavailable": "No se pudo cargar la biblioteca de mapas (probablemente sin acceso de red a la red de distribución de contenidos). Todos los datos de las estaciones siguen disponibles en la lista.",
    "map.tilesUnavailable": "No se pudieron cargar las teselas del mapa. Las marcas de las estaciones de abajo siguen en la posición correcta.",
    "map.zoomIn": "Acercar",
    "map.zoomOut": "Alejar",
    "tile.stationMap": "Ubicación en la red",
    "tile.noStationLocation": "No hay coordenadas disponibles para esta estación.",
    "common.and": "y",
    "board.toggleAria": "Expandir/contraer el panel",
    "board.seriesPartPhrase": "{teil}: {wert}",
    "msg.bikeNowSetTo": "{rahmennummer} ahora está en {ziel}.",
    "msg.confirmDecommission": "¿Dar de baja definitivamente {rahmennummer}? La bicicleta pierde su ubicación y ya no aparece en ninguna lista. Sus viajes se conservan.",
    "msg.bikeDecommissioned": "{rahmennummer} dada de baja.",
    "msg.fleetLoadFailed": "No se pudo cargar la flota: {fehler}",
    "msg.noBikeWithFilter": "Ninguna bicicleta con este filtro",
    "msg.modelsOrStationsLoadFailed": "No se pudieron cargar los modelos o las estaciones: {fehler}",
    "msg.noModelsOrStations": "No hay modelos ni estaciones a partir de los cuales crear una nueva bicicleta.",
    "msg.frameNumberMissing": "Falta el número de bastidor.",
    "msg.bikeCreated": "Bicicleta {rahmennummer} creada.",
    "msg.stationsLoadFailed": "No se pudieron cargar las estaciones: {fehler}",
    "msg.stationsSummary": "{stationenPhrase}, {n} de ellas llenas: {liste}",
    "msg.stationStillHasBikes": "En {name} todavía hay {raederPhrase}. Primero deben devolverse en otro lugar.",
    "msg.confirmDecommissionStation": "¿Dar de baja {name} a partir de hoy? La estación sigue siendo visible en todos los informes, pero ya no admite bicicletas.",
    "msg.stationDecommissioned": "{name} dada de baja.",
    "msg.bikesAtStationLoadFailed": "No se pudieron cargar las bicicletas: {fehler}",
    "msg.trafficLoadFailed": "No se pudo cargar el tráfico de la estación: {fehler}",
    "msg.customersLoadFailed": "No se pudieron cargar los clientes: {fehler}",
    "msg.firstLastNameRequired": "Se requieren nombre y apellido.",
    "msg.customerSaved": "{vorname} {nachname} guardado.",
    "msg.confirmBlockCustomer": "¿Bloquear a {vorname} {nachname}? Actualmente no existe ninguna función para levantar un bloqueo; es una carencia conocida de este sistema, no una comodidad de este cuadro de diálogo.",
    "msg.customerBlocked": "{vorname} {nachname} bloqueado.",
    "msg.nameEmailRequired": "Se requieren nombre, apellido y correo electrónico.",
    "msg.customerCreated": "Cliente {vorname} {nachname} creado.",
    "msg.customersCapped": "200 de más clientes{zusatz}: por favor, siga acotando",
    "msg.searchFor": "para «{suchtext}»",
    "msg.statusList": "Estado {liste}",
    "msg.damageLoadFailed": "No se pudieron cargar las averías: {fehler}",
    "msg.noBikeForDamage": "No hay ninguna bicicleta a la que asignar una avería.",
    "msg.categoryDescriptionRequired": "Se requieren categoría y descripción.",
    "msg.damageReportedBlocked": "Notificación {id} creada. La bicicleta está bloqueada, salvo que se esté usando en este momento; en ese caso se bloqueará al devolverla.",
    "msg.damageReported": "Notificación {id} creada.",
    "msg.workOrderOpened": "Orden de trabajo {id} abierta, bicicleta en mantenimiento.",
    "msg.workOrdersLoadFailed": "No se pudieron cargar las órdenes de trabajo: {fehler}",
    "msg.workOrderCompleted": "Orden de trabajo {auftragsnummer} completada.",
    "field.baujahr": "Año de fabricación",
    "field.gewicht": "Peso",
    "field.gangzahl": "Número de marchas",
    "field.rahmenhoehe": "Altura del cuadro",
    "field.akkukapazitaet": "Capacidad de la batería",
    "field.reichweite": "Autonomía",
    "col.together": "En conjunto",
    "col.model": "Modelo",
    "col.stock": "Existencias",
    "col.statusMix": "Estado",
    "col.modelYear": "Año de fabricación",
    "col.utilisationDeviation": "Uso frente a la flota",
    "col.station": "Estación",
    "col.occupied": "Ocupadas",
    "col.turnover": "Rotación",
    "col.rides": "Viajes",
    "col.revenuePerRideColumn": "Ingresos por viaje",
    "col.balance": "Saldo",
    "col.tariffGroup": "Grupo tarifario",
    "col.customers": "Clientela",
    "col.customerMix": "Uso",
    "col.revenueDeviation": "Ingresos frente a cuota de clientes",
    "col.case": "Caso",
    "col.workTime": "Tiempo de trabajo",
    "col.severity": "Gravedad",
    "col.progress": "Estado de tramitación",
    "col.bikeType": "Tipo de bicicleta",
    "col.revenue": "Ingresos",
    "col.monthlyCourse": "Curva mensual",
    "col.revenueVsRides": "Ingresos frente a cuota de viajes",
    "col.kilometres": "Kilómetros",
    "col.kmPerRideDeviation": "km por viaje frente a la media",
    "col.movements": "Movimientos",
    "col.fillLevel": "Nivel de llenado",
    "unit.bikes": "bicicletas",
    "unit.shareOfRow": "proporción de la fila",
    "unit.percentagePoints": "puntos porcentuales",
    "unit.ridesArrivalsMinusDepartures": "viajes, llegadas menos salidas",
    "unit.persons": "personas",
    "unit.minutes": "minutos",
    "unit.threeSteps": "3 niveles",
    "unit.reportedToFixed": "de notificado a resuelto",
    "unit.euroTwelveMonths": "euros, 12 meses",
    "unit.bikesOfCapacity": "bicicletas, marco = plazas",
    "unit.movementsPerDock": "movimientos por plaza",
    "unit.euroPerRide": "euros",
    "unit.ridesTwelveMonths": "viajes, 12 meses",
    "unit.kmTwelveMonths": "total, 12 meses",
    "unit.kmPerRide": "kilómetros por viaje",
    "unit.departuresPlusArrivals": "salidas y llegadas",
    "unit.zeroToHundred": "0–100 %",
    "board.fleetTitle": "Existencias por modelo",
    "board.fleetReference": "{raederPhrase} · {modellePhrase} de {herstellerPhrase} · años {vonJahr}–{bisJahr} · {quote} % en préstamo ahora",
    "board.fleetStatusAria": "{name}: {aufteilung}",
    "board.fleetYearAria": "{name}, año {jahr}, en la escala de {vonJahr} a {bisJahr}",
    "board.fleetDeviationAria": "{name}: {quote} % en préstamo, flota completa {flottenquote} %",
    "board.fleetFootnote": "Desviación: proporción de bicicletas en préstamo por modelo frente al {quote} % de toda la flota, calculada a partir de sumas y no como media de las cinco proporciones.",
    "board.fleetNoLocationFootnote": "{raederPhrase} figuran como disponibles pero no tienen ubicación: listas en el registro e imposibles de localizar en la red.",
    "board.stationsTitle": "Red por estación",
    "board.stationsReference": "{stationenPhrase} · {belegt} de {kapazitaet} plazas ocupadas ({prozent} %) · saldo de todos los viajes finalizados",
    "board.stationOccupancyAria": "{name}: {belegt} de {kapazitaet} plazas ocupadas, {prozent} %",
    "board.stationBalanceAria": "{name}: {zugaenge} llegadas, {abgaenge} salidas, saldo {saldo}",
    "board.stationsFootnote": "Las salidas oscilan entre {min} y {max} en todas las estaciones: la demanda está repartida por igual y las diferencias solo aparecen en el saldo.",
    "board.stationTurnoverAria": "{name}: {wert} movimientos por plaza con {kapazitaet} plazas",
    "board.stationsRhythmFootnote": "El ritmo diario es el mismo en todas las estaciones: entre el {morgenMin} y el {morgenMax} % de las salidas de días laborables se producen de 6 a 8 h y entre el {nachmittagMin} y el {nachmittagMax} % de 16 a 18 h. Describe la red y no la estación concreta, y por eso figura aquí y no como columna.",
    "board.customersTitle": "Fichero por grupo tarifario",
    "board.customersReference": "{kundenPhrase} · {gesperrt} bloqueados · {volumen} facturados · {imOrt} en {ort}, repartidos en {ortePhrase}",
    "board.customersNoTariff": "Sin tarifa activa",
    "board.customersWithRides": "con viajes",
    "board.customersNoRides": "sin viajes",
    "board.customersRevenueShare": "{anteil} % del volumen",
    "board.customersRevenuePerRideAria": "{name}: {betrag} por viaje en {fahrtenPhrase}",
    "board.customersMixAria": "{name}: {aufteilung}",
    "board.customersDeviationAria": "{name}: {umsatzanteil} % del volumen con {kundenanteil} % de la clientela",
    "board.customersActiveMax": "como máximo {kundenPhrase} al mes",
    "board.customersFootnote": "Los {zehntel} clientes principales aportan el {anteil} % del volumen facturado; {ohneAdresse} registros no tienen dirección.",
    "board.maintenanceTitle": "Los casos concretos",
    "board.maintenanceReference": "{schadenPhrase} · {raederPhrase} afectadas ({typen}) · {auftraegePhrase} · notificados el {tag}",
    "board.maintenanceSeverityAria": "{rad}: {schwere}, nivel {stufe} de 3",
    "board.maintenanceProgressAria": "{rad}: {stand}, {auftrag}",
    "board.maintenanceHasOrder": "existe orden de trabajo",
    "board.maintenanceNoOrder": "sin orden de trabajo",
    "board.maintenanceFootnote": "Sin columna de desviación ni promedios: {schadenPhrase}, {offen} sin resolver, {minuten} minutos de trabajo registrados; cualquier ratio sería aquí una estadística sobre sí misma.",
    "board.revenueTypeTitle": "Doce meses por tipo de bicicleta",
    "board.revenueGroupTitle": "Doce meses por grupo tarifario",
    "board.revenueReference": "{umsatz} y {fahrtenPhrase}, de {vonMonat} a {bisMonat}",
    "board.revenueReferenceWithFleet": "{umsatz} y {fahrtenPhrase}, de {vonMonat} a {bisMonat} · {jeRadTag} por bicicleta y día ({raederPhrase})",
    "board.revenuePerRide": "{betrag} por viaje",
    "board.monthlyCourseAria": "{name}: curva de {vonMonat} a {bisMonat}, máximo {max} en {maxMonat}, último {aktuell}",
    "board.revenueVsRidesAria": "{name}: {umsatzanteil} % de los ingresos con {fahrtenanteil} % de los viajes",
    "board.revenueTypeFootnote": "Ingresos por viaje de la City-Bike: de {von} a {nach} ({veraenderung}) desde {monat}, el único cambio de tarifa del periodo.",
    "board.revenueGroupFootnote": "Las cifras mensuales de clientes no se pueden sumar: las mismas personas viajan en varios meses. Por eso la fila indica el mes más fuerte y no una suma.",
    "board.kmTitle": "Distancia por tipo de bicicleta",
    "board.kmReference": "{km} en {fahrtenPhrase}, de {vonMonat} a {bisMonat} · {anteil} de los viajes estimados",
    "board.co2PerRide": "{kg} de CO₂ por viaje",
    "board.kmPerRideAria": "{name}: {je} por viaje, media {schnitt}",
    "board.kmFootnote": "La proporción estimada ({anteil}) se pondera por viajes y no se promedia sobre las proporciones mensuales: eso daría {ungewichtet} en el periodo mostrado e incluso {alleUngewichtet} en lugar de {alleGewichtet} sobre {monatszeilen}; en una media simple, los meses poco poblados pesan tanto como los fuertes.",
    "board.stationLoadTitle": "Movimiento por estación",
    "board.stationLoadReference": "{stationenPhrase} · {fahrten} salidas en todo el histórico",
    "board.fillLevelAria": "{name}: nivel de llenado {prozent} %",
    "board.stationLoadFootnote": "Las salidas oscilan entre {min} y {max}: la demanda está repartida por igual y lo único que decide es el saldo.",
    "board.halfYearFootnote": "La proporción de invierno está entre el {min} % y el {max} % en todas las filas: la estacionalidad afecta a todas por igual y no distingue entre ellas.",
  },
  it: {
    "common.cancel": "Annulla",
    "common.confirm": "Conferma",
    "common.reason": "Motivo",
    "common.all": "Tutti",
    "common.actionsColumn": "Azioni",
    "common.noSearchPlaceholder": "Nessuna ricerca in questa sezione",
    "common.noSearchAria": "Ricerca non disponibile in questa sezione",
    "common.confirmWordPrompt": "Digitare \"{wort}\" per confermare:",
    "common.sortAria": "Ordina per {titel}",
    "common.sortAriaSuffix": ", attualmente {richtung}",
    "common.ascending": "crescente",
    "common.descending": "decrescente",
    "common.sortResetAria": "Azzera ordinamento per {titel}",
    "common.sortResetTitle": "Azzera ordinamento",
    "common.groupByAria": "Raggruppa per {titel}",
    "common.groupResetAria": "Rimuovi raggruppamento per {titel}",
    "common.groupResetTitle": "Azzera raggruppamento",
    "common.groupTitle": "Raggruppa",
    "common.filterAria": "Filtra {titel}",
    "common.filterMinAria": "Valore minimo per {titel}",
    "common.filterSearchPlaceholder": "Cerca…",
    "common.filterResetAria": "Azzera filtro {titel}",
    "common.filterResetTitle": "Azzera filtro",
    "common.columnFilterReset": "Azzera filtri colonna",
    "common.noRowsMatchFilter": "Nessuna riga soddisfa il filtro selezionato nell’intestazione di colonna. ",
    "common.groupedBy": "Raggruppato per {titel}",
    "common.ungroup": "Rimuovi raggruppamento",
    "common.groupHeaderLabel": "{titel}: {beschriftung} ({n})",
    "common.closeDetailsAria": "Chiudi dettagli",
    "common.closeDetailsTitle": "Chiudi dettagli (Esc)",
    "common.rowsFiltered": "{angezeigt} di {zeilenPhrase} (filtro colonna attivo)",
    "common.selectedCount": "{n} selezionati",
    "common.minAbbrev": "min",
    "common.hourAbbrev": "h",
    "common.underOneMinute": "meno di 1 min",
    "common.loggedInFor": "connesso da {dauer}",
    "common.sinceOpen": "da quando è stato aperto: {dauer}",
    "common.loginCheckFailed": "Impossibile verificare l’accesso: {msg}",
    "common.loginBadCredentials": "E-mail o password non corretti.",
    "common.rolesCheckFailed": "Impossibile determinare i ruoli: {msg}",
    "common.roleCheckFailed": "Impossibile verificare il ruolo {code}: {msg}",
    "common.of": "su",
    "common.xOfPhrase": "{x} su {phrase}",
    "misc.estimatedParen": " ({prozent} stimato)",
    "hint.ridesPerDayHeading": "Corse al giorno — {monat} (totale, tutti i tipi di bici e tariffe)",
    "status.label.abgebrochen": "Annullato",
    "status.raw.abgebrochen": "Annullato",
    "status.label.erledigt": "Completato",
    "status.raw.erledigt": "Completato",
    "status.label.verworfen": "Respinto",
    "status.raw.verworfen": "Respinto",
    "status.label.behoben": "Risolto",
    "status.raw.behoben": "Risolto",
    "msg.stationsWithoutBikeSuffix": ", di cui {n} senza bici",
    "empty.noStationOccupancyText": "Non è presente alcuna stazione. Con dieci stazioni create, ciò è insolito: potrebbe trattarsi di una perdita temporanea del ruolo anziché di dati mancanti.",
    "empty.noStationOccupancyTitle": "Nessuna occupazione delle stazioni",
    "msg.stationOccupancyLoadFailed": "Impossibile caricare l’occupazione delle stazioni: {fehler}",
    "misc.estimatedRidesDetail": "{geschaetzt} su {fahrtenPhrase} ({prozent})",
    "msg.kmCo2Summary": "{monatszeilen}, {fahrten}, risparmio totale di CO₂ {co2}, di cui {prozent} stimato (ponderato per corsa)",
    "empty.noKmCo2Title": "Nessuna riga di chilometri e CO2",
    "msg.kmCo2LoadFailed": "Impossibile caricare chilometri e CO2: {fehler}",
    "field.jeKunde": "Per cliente",
    "msg.revenueByCustomerGroupSummary": "{monatszeilen}, fatturato totale {umsatz}",
    "empty.noRevenueByCustomerGroupTitle": "Nessun fatturato per gruppo di clienti",
    "msg.revenueByCustomerGroupLoadFailed": "Impossibile caricare il fatturato per gruppo di clienti: {fehler}",
    "msg.revenueByBikeTypeSummary": "{monatszeilen}, {fahrten}, fatturato totale {umsatz}",
    "msg.revenueByBikeTypeLoadFailed": "Impossibile caricare il fatturato per tipo di bici: {fehler}",
    "empty.noRevenueByBikeTypeText": "Non è presente alcuna riga mensile. Con un anno di riferimento popolato, ciò è insolito: potrebbe trattarsi di una perdita temporanea del ruolo anziché di dati mancanti.",
    "empty.noRevenueByBikeTypeTitle": "Nessun fatturato per tipo di bici",
    "misc.estimatedSuffix": " (stimato)",
    "field.strecke": "Distanza",
    "field.dauer": "Durata",
    "field.ziel": "Destinazione",
    "field.start": "Partenza",
    "misc.bikesOnDateCaption": "Bici del {datum} - nessun riferimento al cliente, vedi v_wawi_fahrten_je_tag_rad",
    "button.backToDayOverview": "Torna alla panoramica giornaliera",
    "misc.bikesOnDate": "Bici del {datum}",
    "misc.noBikeRiddenThisDay": "In questo giorno non è stata usata nessuna bici.",
    "msg.thisDayBikesLoadFailed": "Impossibile caricare le bici di questo giorno: {fehler}",
    "hint.legendColorScale": "Colore = corse di questo giorno rispetto al giorno più trafficato del mese ({phrase}).",
    "hint.dayRidesAria": "{datum}: {phrase}",
    "hint.calendarCaption": "Corse al giorno, {monat}",
    "hint.tiedDaysCount": "{tagePhrase} a pari merito, {phrase} ciascuno",
    "hint.totalForMonth": "{phrase}, totale",
    "hint.dailyRidesChartAria": "Corse al giorno a {monat} {jahr}, totale su tutti i tipi di bici e tariffe: tra {min} e {maxPhrase}, in media {mittel}. Il massimo delle corse il {tageListe} {monat} con {maxPhrase} ciascuno.",
    "msg.dailyFiguresLoadFailed": "Impossibile caricare i dati giornalieri: {fehler}",
    "misc.workOrderTitle": "Ordine di lavoro {auftragsnummer}",
    "msg.activeWorkOrdersCount": "{n} ordini di lavoro in corso",
    "misc.reportForBike": "Segnalazione per {rahmennummer}",
    "msg.openDamageWithUnrideable": "{n}{zusatz} guasti aperti, di cui {dringend} non idonei alla marcia",
    "msg.openDamageCount": "{n}{zusatz} guasti aperti",
    "misc.atLeastValue": "≥ {n} {einheit}",
    "misc.allLowercase": "tutte",
    "field.minAge": "Anzianità minima",
    "field.offenSeit": "Aperto da",
    "field.gemeldet": "Segnalato",
    "misc.stillRunning": "{datum} · ancora in corso",
    "misc.noRentalYet": "Ancora nessun noleggio",
    "msg.stationCreated": "Stazione {name} creata.",
    "msg.capacityPositiveInteger": "Il numero di stalli deve essere un numero intero positivo.",
    "msg.longitudeRange": "La longitudine deve essere compresa tra -180 e 180.",
    "msg.latitudeRange": "La latitudine deve essere compresa tra -90 e 90.",
    "msg.latLonRequired": "Sono richieste latitudine e longitudine.",
    "msg.stationFieldsRequired": "Sono richiesti nome, via, numero civico, CAP e città.",
    "field.laenge": "Longitudine",
    "field.breite": "Latitudine",
    "field.hausnummerVoll": "Numero civico",
    "field.name": "Nome",
    "hint.arrivalsPerDayLabel": "{label}: {n} ingressi al giorno",
    "hint.departuresPerDayLabel": "{label}: {n} uscite al giorno",
    "hint.trafficPatternAria": "{wochentypTitel} a {name}, media su {tage} giorni. La maggior parte delle uscite si verifica nella fascia {zeitfensterAb} con {maxAb} al giorno, la maggior parte degli ingressi nella fascia {zeitfensterZu} con {maxZu} al giorno.",
    "hint.stationFullNote": " La stazione è piena e non accetta restituzioni al momento.",
    "hint.stationOccupancyAria": "Occupazione {name}: {belegt} stalli su {kapazitaet}, {prozent} percento. Il 100% è la capacità di questa singola stazione.{vollZusatz}",
    "map.openDetailsSuffix": ". Apri dettagli.",
    "map.currentStationSuffix": " - questa è la stazione visualizzata",
    "map.stationFullSuffix": ", piena - non accetta restituzioni al momento",
    "map.stationBelegLabel": "{name}: {belegt} stalli occupati su {kapazitaet}",
    "map.customerLabelShort": "{ort} ({n})",
    "misc.freeShort": "{n} liberi",
    "misc.unitsInStock": "{n} in giacenza",
    "nav.originDamageReport": "Segnalazione di guasto per {rahmennummer}",
    "nav.originBikeFromStation": "Bici {rahmennummer} da {name}",
    "nav.originBikeFromFleet": "Bici {rahmennummer} dalla flotta",
    "index.title": "VeloCity Gestione Magazzino",
    "index.brandLinkAria": "VeloCity – sito web pubblico, si apre in una nuova scheda",
    "index.loading": "Un momento…",
    "index.loginEmail": "E-mail",
    "index.loginPassword": "Password",
    "index.loginSubmit": "Accedi",
    "index.noAccessTitle": "Nessun accesso",
    "index.noAccessText": "Questo account non è registrato in VeloCity come account del personale. Se sei un cliente, trovi la tua area su",
    "index.logout": "Esci",
    "index.noRoleTitle": "Nessun ruolo ancora assegnato",
    "index.noRoleText": "Il tuo account è registrato in VeloCity come account del personale, ma non ti è ancora stata assegnata un’area di responsabilità. Contatta la direzione affinché ti assegni un ruolo.",
    "index.searchPlaceholder": "Cerca",
    "index.profileAria": "Profilo e impostazioni",
    "index.navToggleAria": "Comprimi o espandi la navigazione",
    "index.settingsHeading": "Impostazioni",
    "index.zebraLabel": "Righe alternate nelle tabelle",
    "index.languageLabel": "Lingua",
    "index.navAria": "Aree di lavoro",
    "index.workListAria": "Elenco di lavoro",
    "index.detailAria": "Modulo dei dettagli",
    "nav.flotte": "Flotta",
    "nav.stationen": "Stazioni",
    "nav.kunden": "Clientela",
    "nav.instandhaltung": "Manutenzione",
    "nav.auswertungen": "Report",
    "nav.kundenSuche": "Clientela: nome, e-mail, numero cliente",
    "field.rahmennummer": "Numero di telaio",
    "field.typ": "Tipo",
    "field.status": "Stato",
    "field.standort": "Posizione",
    "field.schaeden": "Guasti",
    "field.modell": "Modello",
    "field.angeschafft": "Acquisito",
    "field.letzteWartung": "Ultima manutenzione",
    "field.offeneSchaeden": "Guasti aperti",
    "field.hoechsteSchwere": "Gravità massima",
    "field.radtyp": "Tipo di bici",
    "field.station": "Stazione",
    "field.nummer": "Numero",
    "field.ort": "Località",
    "field.belegt": "Occupato",
    "field.frei": "Libero",
    "field.anschrift": "Indirizzo",
    "field.stellplaetze": "Stalli",
    "field.lage": "Coordinate",
    "field.betrieb": "Esercizio",
    "field.akku": "Batteria",
    "field.nachname": "Cognome",
    "field.vorname": "Nome",
    "field.tarif": "Tariffa",
    "field.kundeSeit": "Cliente da",
    "field.letzteAusleihe": "Ultimo noleggio",
    "field.anrede": "Titolo",
    "field.email": "E-mail",
    "field.telefon": "Telefono",
    "field.strasse": "Via",
    "field.hausnummer": "N.",
    "field.plz": "CAP",
    "field.hinweis": "Avviso",
    "field.fahrten": "Corse",
    "field.umsatz": "Fatturato",
    "field.offen": "In sospeso",
    "field.kategorie": "Categoria",
    "field.gemeldetVon": "Segnalato da",
    "field.gemeldetAm": "Segnalato il",
    "field.beschreibung": "Descrizione",
    "field.schwere": "Gravità",
    "field.stand": "Stato",
    "field.bisherigeAuftraege": "Ordini precedenti",
    "field.rad": "Bici",
    "field.auftrag": "Ordine di lavoro",
    "field.eroeffnet": "Aperto",
    "field.bearbeiter": "Incaricato",
    "field.arbeitszeitMinuten": "Tempo di lavoro (minuti)",
    "field.bemerkung": "Osservazione",
    "field.kapazitaet": "Capacità",
    "field.abgaenge": "Uscite",
    "field.zugaenge": "Ingressi",
    "field.saldo": "Saldo",
    "field.fuellstand": "Livello di riempimento",
    "field.monat": "Mese",
    "field.minuten": "Minuti",
    "field.jeFahrt": "Per corsa",
    "field.minutenJeFahrt": "Minuti per corsa",
    "field.deltaVormonat": "Δ rispetto al mese precedente",
    "field.kunden": "Clienti",
    "field.fahrtenJeKunde": "Corse per cliente",
    "field.kilometer": "Chilometri",
    "field.kilometerJeFahrt": "Chilometri per corsa",
    "field.co2Ersparnis": "Risparmio di CO₂",
    "field.davonGeschaetzt": "Di cui stimato",
    "status.raw.verfuegbar": "Disponibile",
    "status.label.verfuegbar": "Disponibile",
    "status.raw.ausgeliehen": "In noleggio",
    "status.label.ausgeliehen": "In noleggio",
    "status.raw.wartung": "In manutenzione",
    "status.label.wartung": "In manutenzione",
    "status.raw.defekt": "Guasto",
    "status.label.defekt": "Guasto",
    "status.raw.ausgemustert": "Dismesso",
    "status.label.ausgemustert": "Dismesso",
    "status.raw.aktiv": "Attivo",
    "status.label.aktiv": "Attivo",
    "status.raw.gesperrt": "Bloccato",
    "status.label.gesperrt": "Bloccato",
    "status.raw.geschlossen": "Chiuso",
    "status.label.geschlossen": "Chiuso",
    "status.raw.offen": "Aperto",
    "status.label.offen": "Aperto",
    "status.raw.in_arbeit": "In lavorazione",
    "status.label.in_arbeit": "In lavorazione",
    "schwere.gering": "lieve",
    "schwere.mittel": "moderata",
    "schwere.fahruntauglich": "non idonea alla marcia",
    "button.newBike": "Aggiungi nuova bici",
    "button.create": "Crea",
    "button.setTo": "Imposta su {ziel}",
    "button.whyTarget": "Perché {ziel}?",
    "button.decommission": "Dismetti",
    "button.decommissionReason": "Motivo della dismissione",
    "button.newStation": "Aggiungi nuova stazione",
    "button.decommissionStation": "Dismetti",
    "button.newCustomer": "Aggiungi nuovo cliente",
    "button.save": "Salva",
    "button.block": "Blocca",
    "button.blockReason": "Motivo del blocco",
    "button.disclosureArt15": "Richiesta di accesso ex art. 15",
    "button.deletionArt17": "Cancellazione ex art. 17",
    "button.downloadJson": "Scarica come JSON",
    "button.close": "Chiudi",
    "button.reportDamage": "Segnala guasto",
    "button.openWorkOrder": "Apri ordine di lavoro",
    "button.bikeInFleet": "Bici in flotta",
    "button.report": "Segnala",
    "button.resolve": "Completa",
    "button.toOpenDamage": "Vai ai guasti aperti",
    "button.damageInFleet": "Bici in flotta",
    "button.list": "Elenco",
    "button.map": "Mappa",
    "button.showCustomersOnMap": "Mostra clienti per località",
    "empty.noBikesFilterTitle": "Nessuna bici corrisponde a questo filtro",
    "empty.noBikesFilterText": "Nessuna bici della flotta soddisfa la restrizione selezionata.",
    "empty.noCustomersFilterTitle": "Nessun cliente corrisponde a questo filtro",
    "empty.noCustomersFilterTextSearch": "Nessun cliente corrispondente a \"{suchtext}\" soddisfa anche la restrizione selezionata.",
    "empty.noCustomersFilterText": "Nessun cliente soddisfa la restrizione selezionata.",
    "empty.statusFilterReset": "Azzera filtro stato",
    "empty.noOpenDamageTitle": "Nessun guasto aperto",
    "empty.noOpenDamageText": "Al momento non ci sono segnalazioni di guasto. È la situazione normale: si segnala quando si nota qualcosa su una bici.",
    "empty.noDamageFilterTitle": "Nessun guasto corrisponde a questo filtro",
    "empty.noDamageFilterText": "Nessun guasto aperto soddisfa la restrizione selezionata.",
    "empty.noWorkOrdersTitle": "Nessun ordine di lavoro in corso",
    "empty.noWorkOrdersText": "Al momento non ci sono ordini di lavoro. Un ordine nasce da una segnalazione di guasto aperta, dove si trova il pulsante \"Apri ordine di lavoro\".",
    "misc.underway": "in viaggio",
    "misc.underwayNoLocation": "in viaggio (nessuna posizione)",
    "misc.noneYet": "ancora nessuna",
    "misc.noMembership": "senza abbonamento",
    "misc.notYetAssigned": "non ancora assegnato",
    "misc.justNow": "proprio ora",
    "misc.inOperation": "in esercizio",
    "misc.decommissionedState": "dismessa",
    "misc.noAddressOnFile": "Per questa persona non è registrato alcun indirizzo: non è un errore di caricamento. I campi sottostanti possono essere compilati per aggiungerne uno.",
    "misc.disclosureLoggedNote": "La consultazione della richiesta ex art. 15 viene registrata (GR19): chi la consulta lascia una traccia nel registro delle modifiche.",
    "misc.damageBlocksImmediately": "Un guasto che rende la bici non idonea alla marcia la blocca immediatamente, a meno che non sia in uso in quel momento. In tal caso lo stato resta invariato per ora (GR13 non consente un altro stato a una bici in viaggio) e il blocco scatta solo alla restituzione.",
    "misc.onlyUnrideableBlocks": "Solo una segnalazione di non idoneità alla marcia blocca automaticamente la bici.",
    "misc.noMinutesNeeded": "È richiesto il tempo di lavoro in minuti (0 o superiore).",
    "art17.confirmHeader": "Cancellazione ai sensi dell’art. 17 del GDPR per {name}?",
    "art17.whatDisappears": "COSA SCOMPARE: nome, e-mail, numero di telefono, data di nascita, indirizzo, mezzo di pagamento e il collegamento all’account di accesso. Anche nel registro delle modifiche i vecchi valori vengono resi irriconoscibili.",
    "art17.whatRemains": "COSA RIMANE: {phrase} e tutte le fatture, per intero. Il diritto tributario richiede dieci anni di conservazione e il GDPR esclude espressamente questo obbligo dalla cancellazione.",
    "art17.whatThisDoesNotAchieve": "COSA NON RISOLVE: le corse riportano orari e luoghi. Chi viaggia regolarmente dallo stesso punto alla stessa ora resta identificabile tramite questi dati.",
    "art17.irreversible": "L’operazione non può essere annullata.",
    "art17.reasonPrompt": "Motivo (es.: richiesta dell’interessato del …)",
    "art17.abortedNoReason": "Annullato: nessuna cancellazione senza motivo.",
    "art17.runningRideBlocks": "{name} ha ancora una corsa in corso. Attendere prima la restituzione.",
    "art17.doneMessage": "Cliente {nummer} anonimizzato. Fatture e corse vengono conservate.",
    "art17.confirmWord": "LOESCHEN",
    "tile.minimum": "Minimo",
    "tile.maximum": "Massimo",
    "tile.countPerMonth": "Numero per mese",
    "tile.dayWithMostRides": "Giorno con più corse",
    "tile.occupancy": "Occupazione",
    "tile.trafficByTimeSlot": "Ingressi e uscite per fascia oraria",
    "tile.weekdays": "Giorni feriali (lun–ven)",
    "tile.weekend": "Fine settimana (sab/dom)",
    "tile.bikesAtStation": "Bici in questa stazione ({n})",
    "tile.noBikesHere": "Al momento non c’è nessuna bici qui: sono tutte in viaggio, in officina o guaste.",
    "tile.noTrafficData": "Per questa stazione non sono disponibili dati di traffico.",
    "tile.legendDepartures": "Uscite al giorno (in alto)",
    "tile.legendArrivals": "Ingressi al giorno (in basso)",
    "tab.revenueByBikeType": "Fatturato per tipo di bici",
    "tab.revenueByCustomerGroup": "Fatturato per gruppo di clienti",
    "tab.kmCo2": "Chilometri e CO₂",
    "tab.stationOccupancy": "Occupazione delle stazioni",
    "tab.openDamage": "Guasti aperti",
    "tab.workOrders": "Ordini di lavoro",
    "auskunft.title": "Informativa ai sensi dell’art. 15 del GDPR · {name}",
    "auskunft.stammdaten": "Dati anagrafici",
    "auskunft.mitgliedschaften": "Abbonamenti",
    "auskunft.fahrten": "Corse",
    "auskunft.rechnungen": "Fatture",
    "auskunft.zahlungen": "Pagamenti",
    "auskunft.schadensmeldungen": "Segnalazioni di guasto",
    "auskunft.freiminuten": "Minuti gratuiti",
    "auskunft.protokoll": "Registro",
    "map.mapNote": "La dimensione del cerchio indica la capacità di una stazione, il riempimento la sua occupazione attuale.",
    "map.areaWithCustomers": "Area della mappa con {stationenPhrase} e località dei clienti",
    "map.area": "Area della mappa con {stationenPhrase}",
    "map.customersAtLocation": "{ort}: {kundenPhrase}",
    "map.detailAreaNote": "Estratto: questa stazione e le sue vicine più prossime.",
    "map.libraryUnavailable": "Non è stato possibile caricare la libreria delle mappe (probabilmente manca l'accesso di rete alla rete di distribuzione dei contenuti). Tutti i dati delle stazioni restano disponibili nell'elenco.",
    "map.tilesUnavailable": "Non è stato possibile caricare le tessere della mappa. I contrassegni delle stazioni qui sotto restano comunque nella posizione corretta.",
    "map.zoomIn": "Aumenta zoom",
    "map.zoomOut": "Riduci zoom",
    "tile.stationMap": "Posizione nella rete",
    "tile.noStationLocation": "Per questa stazione non sono disponibili coordinate.",
    "common.and": "e",
    "board.toggleAria": "Espandi/comprimi il pannello",
    "board.seriesPartPhrase": "{teil}: {wert}",
    "msg.bikeNowSetTo": "{rahmennummer} ora è impostata su {ziel}.",
    "msg.confirmDecommission": "Dismettere definitivamente {rahmennummer}? La bici perde la sua posizione e non compare più in nessun elenco. Le sue corse vengono conservate.",
    "msg.bikeDecommissioned": "{rahmennummer} dismessa.",
    "msg.fleetLoadFailed": "Impossibile caricare la flotta: {fehler}",
    "msg.noBikeWithFilter": "Nessuna bici con questo filtro",
    "msg.modelsOrStationsLoadFailed": "Impossibile caricare modelli o stazioni: {fehler}",
    "msg.noModelsOrStations": "Non ci sono né modelli né stazioni da cui creare una nuova bici.",
    "msg.frameNumberMissing": "Manca il numero di telaio.",
    "msg.bikeCreated": "Bici {rahmennummer} creata.",
    "msg.stationsLoadFailed": "Impossibile caricare le stazioni: {fehler}",
    "msg.stationsSummary": "{stationenPhrase}, di cui {n} piene: {liste}",
    "msg.stationStillHasBikes": "A {name} ci sono ancora {raederPhrase}. Devono prima essere restituite altrove.",
    "msg.confirmDecommissionStation": "Dismettere {name} da oggi? La stazione resta visibile in tutti i report, ma non accetta più bici.",
    "msg.stationDecommissioned": "{name} dismessa.",
    "msg.bikesAtStationLoadFailed": "Impossibile caricare le bici: {fehler}",
    "msg.trafficLoadFailed": "Impossibile caricare il traffico della stazione: {fehler}",
    "msg.customersLoadFailed": "Impossibile caricare i clienti: {fehler}",
    "msg.firstLastNameRequired": "Sono richiesti nome e cognome.",
    "msg.customerSaved": "{vorname} {nachname} salvato.",
    "msg.confirmBlockCustomer": "Bloccare {vorname} {nachname}? Al momento non esiste alcuna funzione per rimuovere un blocco: è una lacuna nota di questo gestionale, non una comodità di questa finestra.",
    "msg.customerBlocked": "{vorname} {nachname} bloccato.",
    "msg.nameEmailRequired": "Sono richiesti nome, cognome ed e-mail.",
    "msg.customerCreated": "Cliente {vorname} {nachname} creato.",
    "msg.customersCapped": "200 di più clienti{zusatz} — restringere ulteriormente",
    "msg.searchFor": "per \"{suchtext}\"",
    "msg.statusList": "Stato {liste}",
    "msg.damageLoadFailed": "Impossibile caricare i guasti: {fehler}",
    "msg.noBikeForDamage": "Non c’è nessuna bici a cui assegnare un guasto.",
    "msg.categoryDescriptionRequired": "Sono richieste categoria e descrizione.",
    "msg.damageReportedBlocked": "Segnalazione {id} creata. La bici è bloccata, a meno che non sia in uso in questo momento; in tal caso verrà bloccata alla restituzione.",
    "msg.damageReported": "Segnalazione {id} creata.",
    "msg.workOrderOpened": "Ordine di lavoro {id} aperto, bici in manutenzione.",
    "msg.workOrdersLoadFailed": "Impossibile caricare gli ordini di lavoro: {fehler}",
    "msg.workOrderCompleted": "Ordine di lavoro {auftragsnummer} completato.",
    "field.baujahr": "Anno di produzione",
    "field.gewicht": "Peso",
    "field.gangzahl": "Numero di marce",
    "field.rahmenhoehe": "Altezza del telaio",
    "field.akkukapazitaet": "Capacità della batteria",
    "field.reichweite": "Autonomia",
    "col.together": "Insieme",
    "col.model": "Modello",
    "col.stock": "Consistenza",
    "col.statusMix": "Stato",
    "col.modelYear": "Anno di costruzione",
    "col.utilisationDeviation": "Utilizzo rispetto alla flotta",
    "col.station": "Stazione",
    "col.occupied": "Occupati",
    "col.turnover": "Rotazione",
    "col.rides": "Corse",
    "col.revenuePerRideColumn": "Ricavo per corsa",
    "col.balance": "Saldo",
    "col.tariffGroup": "Gruppo tariffario",
    "col.customers": "Clientela",
    "col.customerMix": "Utilizzo",
    "col.revenueDeviation": "Ricavi rispetto alla quota clienti",
    "col.case": "Caso",
    "col.workTime": "Tempo di lavoro",
    "col.severity": "Gravità",
    "col.progress": "Stato di lavorazione",
    "col.bikeType": "Tipo di bici",
    "col.revenue": "Ricavi",
    "col.monthlyCourse": "Andamento mensile",
    "col.revenueVsRides": "Ricavi rispetto alla quota corse",
    "col.kilometres": "Chilometri",
    "col.kmPerRideDeviation": "km per corsa rispetto alla media",
    "col.movements": "Movimenti",
    "col.fillLevel": "Livello di riempimento",
    "unit.bikes": "bici",
    "unit.shareOfRow": "quota della riga",
    "unit.percentagePoints": "punti percentuali",
    "unit.ridesArrivalsMinusDepartures": "corse, arrivi meno partenze",
    "unit.persons": "persone",
    "unit.minutes": "minuti",
    "unit.threeSteps": "3 livelli",
    "unit.reportedToFixed": "da segnalato a risolto",
    "unit.euroTwelveMonths": "euro, 12 mesi",
    "unit.bikesOfCapacity": "bici, cornice = stalli",
    "unit.movementsPerDock": "movimenti per stallo",
    "unit.euroPerRide": "euro",
    "unit.ridesTwelveMonths": "corse, 12 mesi",
    "unit.kmTwelveMonths": "totale, 12 mesi",
    "unit.kmPerRide": "chilometri per corsa",
    "unit.departuresPlusArrivals": "partenze e arrivi",
    "unit.zeroToHundred": "0–100 %",
    "board.fleetTitle": "Consistenza per modello",
    "board.fleetReference": "{raederPhrase} · {modellePhrase} di {herstellerPhrase} · anni {vonJahr}–{bisJahr} · {quote} % attualmente in prestito",
    "board.fleetStatusAria": "{name}: {aufteilung}",
    "board.fleetYearAria": "{name}, anno {jahr}, sulla scala da {vonJahr} a {bisJahr}",
    "board.fleetDeviationAria": "{name}: {quote} % in prestito, intera flotta {flottenquote} %",
    "board.fleetFootnote": "Scostamento: quota di bici in prestito per modello rispetto al {quote} % dell'intera flotta, calcolata dalle somme e non come media delle cinque quote.",
    "board.fleetNoLocationFootnote": "{raederPhrase} risultano disponibili ma senza posizione: pronte in archivio e introvabili in rete.",
    "board.stationsTitle": "Rete per stazione",
    "board.stationsReference": "{stationenPhrase} · {belegt} di {kapazitaet} stalli occupati ({prozent} %) · saldo su tutte le corse concluse",
    "board.stationOccupancyAria": "{name}: {belegt} di {kapazitaet} stalli occupati, {prozent} %",
    "board.stationBalanceAria": "{name}: {zugaenge} arrivi, {abgaenge} partenze, saldo {saldo}",
    "board.stationsFootnote": "Le partenze vanno da {min} a {max} in tutte le stazioni: la domanda è distribuita uniformemente, le differenze stanno solo nel saldo.",
    "board.stationTurnoverAria": "{name}: {wert} movimenti per stallo su {kapazitaet} stalli",
    "board.stationsRhythmFootnote": "L'andamento giornaliero è identico in tutte le stazioni: dal {morgenMin} al {morgenMax} % delle partenze feriali cade tra le 6 e le 8, dal {nachmittagMin} al {nachmittagMax} % tra le 16 e le 18. Descrive la rete e non la singola stazione: per questo sta qui e non in una colonna.",
    "board.customersTitle": "Anagrafica per gruppo tariffario",
    "board.customersReference": "{kundenPhrase} · {gesperrt} bloccati · {volumen} fatturati · {imOrt} a {ort}, distribuiti su {ortePhrase}",
    "board.customersNoTariff": "Senza tariffa attiva",
    "board.customersWithRides": "con corse",
    "board.customersNoRides": "senza corse",
    "board.customersRevenueShare": "{anteil} % del volume",
    "board.customersRevenuePerRideAria": "{name}: {betrag} per corsa su {fahrtenPhrase}",
    "board.customersMixAria": "{name}: {aufteilung}",
    "board.customersDeviationAria": "{name}: {umsatzanteil} % del volume con {kundenanteil} % della clientela",
    "board.customersActiveMax": "al massimo {kundenPhrase} al mese",
    "board.customersFootnote": "I primi {zehntel} clienti portano il {anteil} % del volume fatturato; {ohneAdresse} record non hanno indirizzo.",
    "board.maintenanceTitle": "I singoli casi",
    "board.maintenanceReference": "{schadenPhrase} · {raederPhrase} coinvolte ({typen}) · {auftraegePhrase} · segnalati il {tag}",
    "board.maintenanceSeverityAria": "{rad}: {schwere}, livello {stufe} di 3",
    "board.maintenanceProgressAria": "{rad}: {stand}, {auftrag}",
    "board.maintenanceHasOrder": "ordine di lavoro presente",
    "board.maintenanceNoOrder": "nessun ordine di lavoro",
    "board.maintenanceFootnote": "Nessuna colonna di scostamento e nessuna media: {schadenPhrase}, di cui {offen} non risolti, {minuten} minuti di lavoro registrati – qui ogni indice sarebbe una statistica su sé stessa.",
    "board.revenueTypeTitle": "Dodici mesi per tipo di bici",
    "board.revenueGroupTitle": "Dodici mesi per gruppo tariffario",
    "board.revenueReference": "{umsatz} e {fahrtenPhrase}, da {vonMonat} a {bisMonat}",
    "board.revenueReferenceWithFleet": "{umsatz} e {fahrtenPhrase}, da {vonMonat} a {bisMonat} · {jeRadTag} per bici al giorno ({raederPhrase})",
    "board.revenuePerRide": "{betrag} per corsa",
    "board.monthlyCourseAria": "{name}: andamento da {vonMonat} a {bisMonat}, massimo {max} in {maxMonat}, ultimo {aktuell}",
    "board.revenueVsRidesAria": "{name}: {umsatzanteil} % dei ricavi con {fahrtenanteil} % delle corse",
    "board.revenueTypeFootnote": "Ricavi per corsa della City-Bike: da {von} a {nach} ({veraenderung}) da {monat} – l'unico cambio di tariffa del periodo.",
    "board.revenueGroupFootnote": "I conteggi mensili dei clienti non si sommano: le stesse persone viaggiano in più mesi. La riga indica quindi il mese più forte, non un totale.",
    "board.kmTitle": "Percorrenza per tipo di bici",
    "board.kmReference": "{km} su {fahrtenPhrase}, da {vonMonat} a {bisMonat} · {anteil} delle corse stimate",
    "board.co2PerRide": "{kg} di CO₂ per corsa",
    "board.kmPerRideAria": "{name}: {je} per corsa, media {schnitt}",
    "board.kmFootnote": "La quota stimata ({anteil}) è ponderata per corse e non è la media delle quote mensili: quella darebbe {ungewichtet} nel periodo mostrato e addirittura {alleUngewichtet} invece di {alleGewichtet} su {monatszeilen} – in una media semplice i mesi poco popolati pesano quanto quelli forti.",
    "board.stationLoadTitle": "Movimento per stazione",
    "board.stationLoadReference": "{stationenPhrase} · {fahrten} partenze sull'intero storico",
    "board.fillLevelAria": "{name}: livello di riempimento {prozent} %",
    "board.stationLoadFootnote": "Le partenze vanno da {min} a {max}: la domanda è uniforme, a decidere è solo il saldo.",
    "board.halfYearFootnote": "La quota invernale è tra il {min} % e il {max} % in ogni riga: la stagionalità colpisce tutte allo stesso modo e non distingue le righe.",
  },
  pl: {
    "common.cancel": "Anuluj",
    "common.confirm": "Potwierdź",
    "common.reason": "Powód",
    "common.all": "Wszystkie",
    "common.actionsColumn": "Akcje",
    "common.noSearchPlaceholder": "Brak wyszukiwania w tej sekcji",
    "common.noSearchAria": "Wyszukiwanie niedostępne w tej sekcji",
    "common.confirmWordPrompt": "Wpisz \"{wort}\", aby potwierdzić:",
    "common.sortAria": "Sortuj według {titel}",
    "common.sortAriaSuffix": ", obecnie {richtung}",
    "common.ascending": "rosnąco",
    "common.descending": "malejąco",
    "common.sortResetAria": "Zresetuj sortowanie według {titel}",
    "common.sortResetTitle": "Zresetuj sortowanie",
    "common.groupByAria": "Grupuj według {titel}",
    "common.groupResetAria": "Usuń grupowanie według {titel}",
    "common.groupResetTitle": "Zresetuj grupowanie",
    "common.groupTitle": "Grupuj",
    "common.filterAria": "Filtruj {titel}",
    "common.filterMinAria": "Wartość minimalna dla {titel}",
    "common.filterSearchPlaceholder": "Szukaj…",
    "common.filterResetAria": "Zresetuj filtr {titel}",
    "common.filterResetTitle": "Zresetuj filtr",
    "common.columnFilterReset": "Zresetuj filtry kolumn",
    "common.noRowsMatchFilter": "Żaden wiersz nie spełnia wybranego ograniczenia w nagłówku kolumny. ",
    "common.groupedBy": "Pogrupowano według {titel}",
    "common.ungroup": "Usuń grupowanie",
    "common.groupHeaderLabel": "{titel}: {beschriftung} ({n})",
    "common.closeDetailsAria": "Zamknij szczegóły",
    "common.closeDetailsTitle": "Zamknij szczegóły (Esc)",
    "common.rowsFiltered": "{angezeigt} z {zeilenPhrase} (filtr kolumny aktywny)",
    "common.selectedCount": "{n} wybranych",
    "common.minAbbrev": "min",
    "common.hourAbbrev": "godz.",
    "common.underOneMinute": "poniżej 1 min",
    "common.loggedInFor": "zalogowano od {dauer}",
    "common.sinceOpen": "od otwarcia: {dauer}",
    "common.loginCheckFailed": "Nie udało się zweryfikować logowania: {msg}",
    "common.loginBadCredentials": "Adres e-mail lub hasło jest nieprawidłowe.",
    "common.rolesCheckFailed": "Nie udało się ustalić ról: {msg}",
    "common.roleCheckFailed": "Nie udało się sprawdzić roli {code}: {msg}",
    "common.of": "z",
    "common.xOfPhrase": "{x} z {phrase}",
    "misc.estimatedParen": " ({prozent} szacowane)",
    "hint.ridesPerDayHeading": "Przejazdy dziennie — {monat} (ogółem, wszystkie typy rowerów i taryfy)",
    "status.label.abgebrochen": "Anulowano",
    "status.raw.abgebrochen": "Anulowano",
    "status.label.erledigt": "Zakończono",
    "status.raw.erledigt": "Zakończono",
    "status.label.verworfen": "Odrzucono",
    "status.raw.verworfen": "Odrzucono",
    "status.label.behoben": "Naprawiono",
    "status.raw.behoben": "Naprawiono",
    "msg.stationsWithoutBikeSuffix": ", w tym {n} bez roweru",
    "empty.noStationOccupancyText": "Brak stacji. Przy dziesięciu utworzonych stacjach jest to nietypowe — możliwą przyczyną jest chwilowa utrata roli, a nie brak danych.",
    "empty.noStationOccupancyTitle": "Brak obłożenia stacji",
    "msg.stationOccupancyLoadFailed": "Nie udało się wczytać obłożenia stacji: {fehler}",
    "misc.estimatedRidesDetail": "{geschaetzt} z {fahrtenPhrase} ({prozent})",
    "msg.kmCo2Summary": "{monatszeilen}, {fahrten}, oszczędność CO₂ ogółem {co2}, w tym {prozent} szacowane (ważone przejazdami)",
    "empty.noKmCo2Title": "Brak wierszy kilometrów i CO2",
    "msg.kmCo2LoadFailed": "Nie udało się wczytać kilometrów i CO2: {fehler}",
    "field.jeKunde": "Na klienta",
    "msg.revenueByCustomerGroupSummary": "{monatszeilen}, obrót ogółem {umsatz}",
    "empty.noRevenueByCustomerGroupTitle": "Brak obrotu wg grupy klientów",
    "msg.revenueByCustomerGroupLoadFailed": "Nie udało się wczytać obrotu wg grupy klientów: {fehler}",
    "msg.revenueByBikeTypeSummary": "{monatszeilen}, {fahrten}, obrót ogółem {umsatz}",
    "msg.revenueByBikeTypeLoadFailed": "Nie udało się wczytać obrotu wg typu roweru: {fehler}",
    "empty.noRevenueByBikeTypeText": "Brak wiersza miesięcznego. Przy wypełnionym roku referencyjnym jest to nietypowe — możliwą przyczyną jest chwilowa utrata roli, a nie brak danych.",
    "empty.noRevenueByBikeTypeTitle": "Brak obrotu wg typu roweru",
    "misc.estimatedSuffix": " (szacowane)",
    "field.strecke": "Dystans",
    "field.dauer": "Czas trwania",
    "field.ziel": "Cel",
    "field.start": "Start",
    "misc.bikesOnDateCaption": "Rowery w dniu {datum} - bez odniesienia do klienta, patrz v_wawi_fahrten_je_tag_rad",
    "button.backToDayOverview": "Powrót do przeglądu dziennego",
    "misc.bikesOnDate": "Rowery w dniu {datum}",
    "misc.noBikeRiddenThisDay": "Tego dnia nie użyto żadnego roweru.",
    "msg.thisDayBikesLoadFailed": "Nie udało się wczytać rowerów z tego dnia: {fehler}",
    "hint.legendColorScale": "Kolor = przejazdy tego dnia w stosunku do najbardziej ruchliwego dnia miesiąca ({phrase}).",
    "hint.dayRidesAria": "{datum}: {phrase}",
    "hint.calendarCaption": "Przejazdy dziennie, {monat}",
    "hint.tiedDaysCount": "{tagePhrase} z takim samym wynikiem, po {phrase}",
    "hint.totalForMonth": "{phrase}, łącznie",
    "hint.dailyRidesChartAria": "Przejazdy dziennie w {monat} {jahr}, ogółem we wszystkich typach rowerów i taryfach: od {min} do {maxPhrase}, średnio {mittel}. Najwięcej przejazdów {tageListe} {monat}, po {maxPhrase} każdego dnia.",
    "msg.dailyFiguresLoadFailed": "Nie udało się wczytać danych dziennych: {fehler}",
    "misc.workOrderTitle": "Zlecenie {auftragsnummer}",
    "msg.activeWorkOrdersCount": "{n} trwających zleceń",
    "misc.reportForBike": "Zgłoszenie dla {rahmennummer}",
    "msg.openDamageWithUnrideable": "{n}{zusatz} otwartych usterek, w tym {dringend} niezdatnych do jazdy",
    "msg.openDamageCount": "{n}{zusatz} otwartych usterek",
    "misc.atLeastValue": "≥ {n} {einheit}",
    "misc.allLowercase": "wszystkie",
    "field.minAge": "Minimalny wiek",
    "field.offenSeit": "Otwarte od",
    "field.gemeldet": "Zgłoszono",
    "misc.stillRunning": "{datum} · nadal trwa",
    "misc.noRentalYet": "Jeszcze bez wypożyczenia",
    "msg.stationCreated": "Utworzono stację {name}.",
    "msg.capacityPositiveInteger": "Liczba miejsc postojowych musi być dodatnią liczbą całkowitą.",
    "msg.longitudeRange": "Długość geograficzna musi mieścić się między -180 a 180.",
    "msg.latitudeRange": "Szerokość geograficzna musi mieścić się między -90 a 90.",
    "msg.latLonRequired": "Wymagana jest szerokość i długość geograficzna.",
    "msg.stationFieldsRequired": "Wymagana jest nazwa, ulica, numer domu, kod pocztowy i miejscowość.",
    "field.laenge": "Długość geogr.",
    "field.breite": "Szerokość geogr.",
    "field.hausnummerVoll": "Numer domu",
    "field.name": "Nazwa",
    "hint.arrivalsPerDayLabel": "{label}: {n} przyjazdów dziennie",
    "hint.departuresPerDayLabel": "{label}: {n} wyjazdów dziennie",
    "hint.trafficPatternAria": "{wochentypTitel} na stacji {name}, uśrednione z {tage} dni. Najwięcej wyjazdów przypada na przedział {zeitfensterAb} z {maxAb} dziennie, najwięcej przyjazdów na przedział {zeitfensterZu} z {maxZu} dziennie.",
    "hint.stationFullNote": " Stacja jest pełna i obecnie nie przyjmuje zwrotów.",
    "hint.stationOccupancyAria": "Zapełnienie {name}: {belegt} z {kapazitaet} miejsc, {prozent} procent. 100 procent to pojemność tej jednej stacji.{vollZusatz}",
    "map.openDetailsSuffix": ". Otwórz szczegóły.",
    "map.currentStationSuffix": " - to jest wyświetlana stacja",
    "map.stationFullSuffix": ", pełna - obecnie nie przyjmuje zwrotów",
    "map.stationBelegLabel": "{name}: {belegt} z {kapazitaet} miejsc zajętych",
    "map.customerLabelShort": "{ort} ({n})",
    "misc.freeShort": "{n} wolnych",
    "misc.unitsInStock": "{n} w magazynie",
    "nav.originDamageReport": "Zgłoszenie usterki dla {rahmennummer}",
    "nav.originBikeFromStation": "Rower {rahmennummer} ze stacji {name}",
    "nav.originBikeFromFleet": "Rower {rahmennummer} z floty",
    "index.title": "VeloCity Gospodarka Magazynowa",
    "index.brandLinkAria": "VeloCity – strona publiczna, otwiera się w nowej karcie",
    "index.loading": "Chwileczkę…",
    "index.loginEmail": "E-mail",
    "index.loginPassword": "Hasło",
    "index.loginSubmit": "Zaloguj się",
    "index.noAccessTitle": "Brak dostępu",
    "index.noAccessText": "To konto nie jest zarejestrowane w VeloCity jako konto pracownika. Jeśli są Państwo klientami, swój obszar znajdą Państwo pod adresem",
    "index.logout": "Wyloguj się",
    "index.noRoleTitle": "Nie przypisano jeszcze roli",
    "index.noRoleText": "Państwa konto jest zarejestrowane w VeloCity jako konto pracownika, ale nie przypisano jeszcze żadnego zakresu obowiązków. Proszę skontaktować się z kierownictwem, aby przydzieliło Państwu rolę.",
    "index.searchPlaceholder": "Szukaj",
    "index.profileAria": "Profil i ustawienia",
    "index.navToggleAria": "Zwiń lub rozwiń nawigację",
    "index.settingsHeading": "Ustawienia",
    "index.zebraLabel": "Pasy zebry w tabelach",
    "index.languageLabel": "Język",
    "index.navAria": "Obszary zadań",
    "index.workListAria": "Lista robocza",
    "index.detailAria": "Formularz szczegółów",
    "nav.flotte": "Flota",
    "nav.stationen": "Stacje",
    "nav.kunden": "Klientela",
    "nav.instandhaltung": "Konserwacja",
    "nav.auswertungen": "Raporty",
    "nav.kundenSuche": "Klientela: nazwisko, e-mail, numer klienta",
    "field.rahmennummer": "Numer ramy",
    "field.typ": "Typ",
    "field.status": "Status",
    "field.standort": "Lokalizacja",
    "field.schaeden": "Usterki",
    "field.modell": "Model",
    "field.angeschafft": "Zakupiono",
    "field.letzteWartung": "Ostatnia konserwacja",
    "field.offeneSchaeden": "Otwarte usterki",
    "field.hoechsteSchwere": "Najwyższa waga usterki",
    "field.radtyp": "Typ roweru",
    "field.station": "Stacja",
    "field.nummer": "Numer",
    "field.ort": "Miejscowość",
    "field.belegt": "Zajęte",
    "field.frei": "Wolne",
    "field.anschrift": "Adres",
    "field.stellplaetze": "Miejsca postojowe",
    "field.lage": "Współrzędne",
    "field.betrieb": "Eksploatacja",
    "field.akku": "Bateria",
    "field.nachname": "Nazwisko",
    "field.vorname": "Imię",
    "field.tarif": "Taryfa",
    "field.kundeSeit": "Klient od",
    "field.letzteAusleihe": "Ostatnie wypożyczenie",
    "field.anrede": "Forma zwracania się",
    "field.email": "E-mail",
    "field.telefon": "Telefon",
    "field.strasse": "Ulica",
    "field.hausnummer": "Nr",
    "field.plz": "Kod pocztowy",
    "field.hinweis": "Uwaga",
    "field.fahrten": "Przejazdy",
    "field.umsatz": "Obrót",
    "field.offen": "Zaległość",
    "field.kategorie": "Kategoria",
    "field.gemeldetVon": "Zgłoszone przez",
    "field.gemeldetAm": "Zgłoszono dnia",
    "field.beschreibung": "Opis",
    "field.schwere": "Waga usterki",
    "field.stand": "Etap",
    "field.bisherigeAuftraege": "Poprzednie zlecenia",
    "field.rad": "Rower",
    "field.auftrag": "Zlecenie",
    "field.eroeffnet": "Otwarto",
    "field.bearbeiter": "Wykonawca",
    "field.arbeitszeitMinuten": "Czas pracy (minuty)",
    "field.bemerkung": "Uwaga",
    "field.kapazitaet": "Pojemność",
    "field.abgaenge": "Wyjazdy",
    "field.zugaenge": "Przyjazdy",
    "field.saldo": "Saldo",
    "field.fuellstand": "Poziom zapełnienia",
    "field.monat": "Miesiąc",
    "field.minuten": "Minuty",
    "field.jeFahrt": "Na przejazd",
    "field.minutenJeFahrt": "Minuty na przejazd",
    "field.deltaVormonat": "Δ względem poprzedniego miesiąca",
    "field.kunden": "Klienci",
    "field.fahrtenJeKunde": "Przejazdy na klienta",
    "field.kilometer": "Kilometry",
    "field.kilometerJeFahrt": "Kilometry na przejazd",
    "field.co2Ersparnis": "Oszczędność CO₂",
    "field.davonGeschaetzt": "W tym szacowane",
    "status.raw.verfuegbar": "Dostępny",
    "status.label.verfuegbar": "Dostępny",
    "status.raw.ausgeliehen": "Wypożyczony",
    "status.label.ausgeliehen": "Wypożyczony",
    "status.raw.wartung": "W konserwacji",
    "status.label.wartung": "W konserwacji",
    "status.raw.defekt": "Uszkodzony",
    "status.label.defekt": "Uszkodzony",
    "status.raw.ausgemustert": "Wycofany",
    "status.label.ausgemustert": "Wycofany",
    "status.raw.aktiv": "Aktywny",
    "status.label.aktiv": "Aktywny",
    "status.raw.gesperrt": "Zablokowany",
    "status.label.gesperrt": "Zablokowany",
    "status.raw.geschlossen": "Zamknięty",
    "status.label.geschlossen": "Zamknięty",
    "status.raw.offen": "Otwarte",
    "status.label.offen": "Otwarte",
    "status.raw.in_arbeit": "W trakcie",
    "status.label.in_arbeit": "W trakcie",
    "schwere.gering": "niska",
    "schwere.mittel": "średnia",
    "schwere.fahruntauglich": "niezdatny do jazdy",
    "button.newBike": "Dodaj nowy rower",
    "button.create": "Utwórz",
    "button.setTo": "Ustaw na {ziel}",
    "button.whyTarget": "Dlaczego {ziel}?",
    "button.decommission": "Wycofaj z eksploatacji",
    "button.decommissionReason": "Powód wycofania z eksploatacji",
    "button.newStation": "Dodaj nową stację",
    "button.decommissionStation": "Wyłącz z eksploatacji",
    "button.newCustomer": "Dodaj nowego klienta",
    "button.save": "Zapisz",
    "button.block": "Zablokuj",
    "button.blockReason": "Powód zablokowania",
    "button.disclosureArt15": "Wgląd na podstawie art. 15",
    "button.deletionArt17": "Usunięcie na podstawie art. 17",
    "button.downloadJson": "Pobierz jako JSON",
    "button.close": "Zamknij",
    "button.reportDamage": "Zgłoś usterkę",
    "button.openWorkOrder": "Otwórz zlecenie",
    "button.bikeInFleet": "Rower we flocie",
    "button.report": "Zgłoś",
    "button.resolve": "Zakończ",
    "button.toOpenDamage": "Przejdź do otwartych usterek",
    "button.damageInFleet": "Rower we flocie",
    "button.list": "Lista",
    "button.map": "Mapa",
    "button.showCustomersOnMap": "Pokaż klientów wg lokalizacji",
    "empty.noBikesFilterTitle": "Brak rowerów spełniających ten filtr",
    "empty.noBikesFilterText": "Żaden rower we flocie nie spełnia wybranego ograniczenia.",
    "empty.noCustomersFilterTitle": "Brak klientów spełniających ten filtr",
    "empty.noCustomersFilterTextSearch": "Żaden klient pasujący do „{suchtext}” nie spełnia dodatkowo wybranego ograniczenia.",
    "empty.noCustomersFilterText": "Żaden klient nie spełnia wybranego ograniczenia.",
    "empty.statusFilterReset": "Zresetuj filtr statusu",
    "empty.noOpenDamageTitle": "Brak otwartych usterek",
    "empty.noOpenDamageText": "Obecnie nie ma żadnego zgłoszenia usterki. To normalna sytuacja — zgłoszenie powstaje, gdy coś zwróci uwagę przy rowerze.",
    "empty.noDamageFilterTitle": "Brak usterek spełniających ten filtr",
    "empty.noDamageFilterText": "Żadne otwarte zgłoszenie usterki nie spełnia wybranego ograniczenia.",
    "empty.noWorkOrdersTitle": "Brak trwających zleceń",
    "empty.noWorkOrdersText": "Obecnie nie ma żadnego zlecenia konserwacji. Zlecenie powstaje z otwartego zgłoszenia usterki — tam znajduje się przycisk „Otwórz zlecenie”.",
    "misc.underway": "w trasie",
    "misc.underwayNoLocation": "w trasie (brak lokalizacji)",
    "misc.noneYet": "jeszcze żadnej",
    "misc.noMembership": "bez członkostwa",
    "misc.notYetAssigned": "jeszcze nie przydzielono",
    "misc.justNow": "przed chwilą",
    "misc.inOperation": "w eksploatacji",
    "misc.decommissionedState": "wyłączona z eksploatacji",
    "misc.noAddressOnFile": "Dla tej osoby nie zapisano adresu — to nie jest błąd wczytywania. Poniższe pola można wypełnić, aby go uzupełnić.",
    "misc.disclosureLoggedNote": "Pobranie informacji na podstawie art. 15 jest rejestrowane (GR19): osoba przeglądająca pozostawia ślad w dzienniku zmian.",
    "misc.damageBlocksImmediately": "Usterka czyniąca rower niezdatnym do jazdy blokuje go natychmiast — chyba że jest właśnie w trasie. Wtedy status pozostaje na razie niezmieniony (GR13 nie pozwala na inny status roweru w trasie), a blokada zadziała dopiero przy zwrocie.",
    "misc.onlyUnrideableBlocks": "Tylko zgłoszenie niezdatności do jazdy blokuje rower automatycznie.",
    "misc.noMinutesNeeded": "Wymagany jest czas pracy w minutach (0 lub więcej).",
    "art17.confirmHeader": "Usunięcie danych {name} na podstawie art. 17 RODO?",
    "art17.whatDisappears": "CO ZNIKA: imię i nazwisko, e-mail, numer telefonu, data urodzenia, adres, sposób płatności oraz powiązanie z kontem logowania. Także w dzienniku zmian dawne wartości zostają zanonimizowane.",
    "art17.whatRemains": "CO POZOSTAJE: {phrase} i wszystkie faktury, w pełnej wysokości. Prawo podatkowe wymaga dziesięciu lat przechowywania, a RODO wyraźnie wyłącza ten obowiązek spod usunięcia.",
    "art17.whatThisDoesNotAchieve": "CZEGO TO NIE ROZWIĄZUJE: przejazdy zawierają czas i miejsce. Kto regularnie wyrusza z tego samego miejsca o tej samej porze, wciąż może zostać po tym rozpoznany.",
    "art17.irreversible": "Tej operacji nie można cofnąć.",
    "art17.reasonPrompt": "Powód (np. wniosek osoby, której dane dotyczą, z dnia …)",
    "art17.abortedNoReason": "Anulowano: bez podania powodu nie ma usunięcia.",
    "art17.runningRideBlocks": "{name} ma jeszcze trwający przejazd. Najpierw poczekaj na zwrot roweru.",
    "art17.doneMessage": "Klient {nummer} zanonimizowany. Faktury i przejazdy zostają zachowane.",
    "art17.confirmWord": "LOESCHEN",
    "tile.minimum": "Minimum",
    "tile.maximum": "Maksimum",
    "tile.countPerMonth": "Liczba na miesiąc",
    "tile.dayWithMostRides": "Dzień z największą liczbą przejazdów",
    "tile.occupancy": "Zapełnienie",
    "tile.trafficByTimeSlot": "Przyjazdy i wyjazdy wg przedziału czasowego",
    "tile.weekdays": "Dni robocze (pon.–pt.)",
    "tile.weekend": "Weekend (sob./niedz.)",
    "tile.bikesAtStation": "Rowery na tej stacji ({n})",
    "tile.noBikesHere": "Obecnie nie ma tu żadnego roweru — wszystkie są w trasie, w warsztacie lub uszkodzone.",
    "tile.noTrafficData": "Dla tej stacji brak danych o ruchu.",
    "tile.legendDepartures": "Wyjazdy dziennie (u góry)",
    "tile.legendArrivals": "Przyjazdy dziennie (u dołu)",
    "tab.revenueByBikeType": "Obrót wg typu roweru",
    "tab.revenueByCustomerGroup": "Obrót wg grupy klientów",
    "tab.kmCo2": "Kilometry i CO₂",
    "tab.stationOccupancy": "Obłożenie stacji",
    "tab.openDamage": "Otwarte usterki",
    "tab.workOrders": "Zlecenia",
    "auskunft.title": "Informacja na podstawie art. 15 RODO · {name}",
    "auskunft.stammdaten": "Dane podstawowe",
    "auskunft.mitgliedschaften": "Członkostwa",
    "auskunft.fahrten": "Przejazdy",
    "auskunft.rechnungen": "Faktury",
    "auskunft.zahlungen": "Płatności",
    "auskunft.schadensmeldungen": "Zgłoszenia usterek",
    "auskunft.freiminuten": "Darmowe minuty",
    "auskunft.protokoll": "Dziennik",
    "map.mapNote": "Wielkość koła pokazuje pojemność stacji, a wypełnienie jej bieżące zapełnienie.",
    "map.areaWithCustomers": "Obszar mapy z {stationenPhrase} i lokalizacjami klientów",
    "map.area": "Obszar mapy z {stationenPhrase}",
    "map.customersAtLocation": "{ort}: {kundenPhrase}",
    "map.detailAreaNote": "Wycinek: ta stacja i jej najbliżsi sąsiedzi.",
    "map.libraryUnavailable": "Nie udało się załadować biblioteki mapy (prawdopodobnie brak dostępu do sieci dostarczania treści). Wszystkie dane stacji pozostają dostępne na liście.",
    "map.tilesUnavailable": "Nie udało się załadować kafelków mapy. Znaczniki stacji poniżej nadal znajdują się we właściwym miejscu.",
    "map.zoomIn": "Przybliż",
    "map.zoomOut": "Oddal",
    "tile.stationMap": "Położenie w sieci",
    "tile.noStationLocation": "Dla tej stacji brak współrzędnych.",
    "common.and": "i",
    "board.toggleAria": "Rozwiń/zwiń panel",
    "board.seriesPartPhrase": "{teil}: {wert}",
    "msg.bikeNowSetTo": "{rahmennummer} ma teraz status {ziel}.",
    "msg.confirmDecommission": "Trwale wycofać {rahmennummer} z eksploatacji? Rower traci swoją lokalizację i nie pojawia się już na żadnej liście. Jego przejazdy zostają zachowane.",
    "msg.bikeDecommissioned": "{rahmennummer} wycofano z eksploatacji.",
    "msg.fleetLoadFailed": "Nie udało się wczytać floty: {fehler}",
    "msg.noBikeWithFilter": "Brak roweru pasującego do tego filtra",
    "msg.modelsOrStationsLoadFailed": "Nie udało się wczytać modeli lub stacji: {fehler}",
    "msg.noModelsOrStations": "Nie ma ani modeli, ani stacji, z których można by utworzyć nowy rower.",
    "msg.frameNumberMissing": "Brak numeru ramy.",
    "msg.bikeCreated": "Utworzono rower {rahmennummer}.",
    "msg.stationsLoadFailed": "Nie udało się wczytać stacji: {fehler}",
    "msg.stationsSummary": "{stationenPhrase}, w tym {n} pełnych: {liste}",
    "msg.stationStillHasBikes": "Na stacji {name} nadal jest {raederPhrase}. Muszą zostać najpierw zwrócone gdzie indziej.",
    "msg.confirmDecommissionStation": "Wyłączyć stację {name} z eksploatacji od dziś? Stacja pozostaje widoczna we wszystkich raportach, ale nie przyjmuje już rowerów.",
    "msg.stationDecommissioned": "Wyłączono stację {name} z eksploatacji.",
    "msg.bikesAtStationLoadFailed": "Nie udało się wczytać rowerów: {fehler}",
    "msg.trafficLoadFailed": "Nie udało się wczytać ruchu na stacji: {fehler}",
    "msg.customersLoadFailed": "Nie udało się wczytać klientów: {fehler}",
    "msg.firstLastNameRequired": "Wymagane jest imię i nazwisko.",
    "msg.customerSaved": "Zapisano dane {vorname} {nachname}.",
    "msg.confirmBlockCustomer": "Zablokować {vorname} {nachname}? Obecnie nie ma funkcji cofającej blokadę — to znana luka tego systemu, a nie udogodnienie tego okna.",
    "msg.customerBlocked": "Zablokowano {vorname} {nachname}.",
    "msg.nameEmailRequired": "Wymagane jest imię, nazwisko i e-mail.",
    "msg.customerCreated": "Utworzono klienta {vorname} {nachname}.",
    "msg.customersCapped": "200 z więcej klientów{zusatz} — proszę zawęzić wyszukiwanie",
    "msg.searchFor": "dla „{suchtext}”",
    "msg.statusList": "Status {liste}",
    "msg.damageLoadFailed": "Nie udało się wczytać usterek: {fehler}",
    "msg.noBikeForDamage": "Nie ma roweru, do którego można by przypisać usterkę.",
    "msg.categoryDescriptionRequired": "Wymagana jest kategoria i opis.",
    "msg.damageReportedBlocked": "Utworzono zgłoszenie {id}. Rower jest zablokowany — chyba że jest właśnie użytkowany; wtedy zostanie zablokowany przy zwrocie.",
    "msg.damageReported": "Utworzono zgłoszenie {id}.",
    "msg.workOrderOpened": "Otwarto zlecenie {id}, rower w konserwacji.",
    "msg.workOrdersLoadFailed": "Nie udało się wczytać zleceń: {fehler}",
    "msg.workOrderCompleted": "Zlecenie {auftragsnummer} zakończono.",
    "field.baujahr": "Rocznik",
    "field.gewicht": "Waga",
    "field.gangzahl": "Liczba biegów",
    "field.rahmenhoehe": "Wysokość ramy",
    "field.akkukapazitaet": "Pojemność akumulatora",
    "field.reichweite": "Zasięg",
    "col.together": "Razem",
    "col.model": "Model",
    "col.stock": "Stan",
    "col.statusMix": "Stan techniczny",
    "col.modelYear": "Rocznik",
    "col.utilisationDeviation": "Wykorzystanie wzgl. floty",
    "col.station": "Stacja",
    "col.occupied": "Zajęte",
    "col.turnover": "Rotacja",
    "col.rides": "Przejazdy",
    "col.revenuePerRideColumn": "Przychód na przejazd",
    "col.balance": "Saldo",
    "col.tariffGroup": "Grupa taryfowa",
    "col.customers": "Klienci",
    "col.customerMix": "Korzystanie",
    "col.revenueDeviation": "Przychód wzgl. udziału klientów",
    "col.case": "Przypadek",
    "col.workTime": "Czas pracy",
    "col.severity": "Waga",
    "col.progress": "Stan realizacji",
    "col.bikeType": "Typ roweru",
    "col.revenue": "Przychód",
    "col.monthlyCourse": "Przebieg miesięczny",
    "col.revenueVsRides": "Przychód wzgl. udziału przejazdów",
    "col.kilometres": "Kilometry",
    "col.kmPerRideDeviation": "km na przejazd wzgl. średniej",
    "col.movements": "Ruchy",
    "col.fillLevel": "Poziom napełnienia",
    "unit.bikes": "rowery",
    "unit.shareOfRow": "udział wiersza",
    "unit.percentagePoints": "punkty procentowe",
    "unit.ridesArrivalsMinusDepartures": "przejazdy, przyjazdy minus wyjazdy",
    "unit.persons": "osoby",
    "unit.minutes": "minuty",
    "unit.threeSteps": "3 stopnie",
    "unit.reportedToFixed": "od zgłoszenia do usunięcia",
    "unit.euroTwelveMonths": "euro, 12 miesięcy",
    "unit.bikesOfCapacity": "rowery, ramka = miejsca postojowe",
    "unit.movementsPerDock": "ruchy na miejsce postojowe",
    "unit.euroPerRide": "euro",
    "unit.ridesTwelveMonths": "przejazdy, 12 miesięcy",
    "unit.kmTwelveMonths": "suma, 12 miesięcy",
    "unit.kmPerRide": "kilometry na przejazd",
    "unit.departuresPlusArrivals": "wyjazdy i przyjazdy",
    "unit.zeroToHundred": "0–100 %",
    "board.fleetTitle": "Stan według modelu",
    "board.fleetReference": "{raederPhrase} · {modellePhrase} od {herstellerPhrase} · roczniki {vonJahr}–{bisJahr} · {quote} % obecnie wypożyczonych",
    "board.fleetStatusAria": "{name}: {aufteilung}",
    "board.fleetYearAria": "{name}, rocznik {jahr}, na skali od {vonJahr} do {bisJahr}",
    "board.fleetDeviationAria": "{name}: {quote} % wypożyczonych, cała flota {flottenquote} %",
    "board.fleetFootnote": "Odchylenie: udział wypożyczonych rowerów na model wobec {quote} % całej floty – liczone z sum, a nie jako średnia pięciu udziałów.",
    "board.fleetNoLocationFootnote": "{raederPhrase} figurują jako dostępne, lecz nie mają lokalizacji – gotowe w kartotece i nie do odnalezienia w sieci.",
    "board.stationsTitle": "Sieć według stacji",
    "board.stationsReference": "{stationenPhrase} · {belegt} z {kapazitaet} miejsc zajętych ({prozent} %) · saldo ze wszystkich zakończonych przejazdów",
    "board.stationOccupancyAria": "{name}: {belegt} z {kapazitaet} miejsc zajętych, {prozent} %",
    "board.stationBalanceAria": "{name}: {zugaenge} przyjazdów, {abgaenge} wyjazdów, saldo {saldo}",
    "board.stationsFootnote": "Wyjazdy mieszczą się we wszystkich stacjach między {min} a {max} – popyt jest równomierny, różnice tkwią wyłącznie w saldzie.",
    "board.stationTurnoverAria": "{name}: {wert} ruchów na miejsce postojowe przy {kapazitaet} miejscach",
    "board.stationsRhythmFootnote": "Rozkład dobowy jest taki sam na wszystkich stacjach: od {morgenMin} do {morgenMax} % wyjazdów w dni robocze przypada na godziny 6–8, a od {nachmittagMin} do {nachmittagMax} % na 16–18. Opisuje sieć, a nie pojedynczą stację – dlatego stoi tutaj, a nie w kolumnie.",
    "board.customersTitle": "Kartoteka według grupy taryfowej",
    "board.customersReference": "{kundenPhrase} · {gesperrt} zablokowanych · {volumen} obrotu · {imOrt} w {ort}, rozłożone na {ortePhrase}",
    "board.customersNoTariff": "Bez aktywnej taryfy",
    "board.customersWithRides": "z przejazdami",
    "board.customersNoRides": "bez przejazdu",
    "board.customersRevenueShare": "{anteil} % obrotu",
    "board.customersRevenuePerRideAria": "{name}: {betrag} na przejazd przy {fahrtenPhrase}",
    "board.customersMixAria": "{name}: {aufteilung}",
    "board.customersDeviationAria": "{name}: {umsatzanteil} % obrotu przy {kundenanteil} % klientów",
    "board.customersActiveMax": "najwyżej {kundenPhrase} w miesiącu",
    "board.customersFootnote": "Górni {zehntel} klienci odpowiadają za {anteil} % obrotu; {ohneAdresse} rekordów nie ma adresu.",
    "board.maintenanceTitle": "Poszczególne przypadki",
    "board.maintenanceReference": "{schadenPhrase} · {raederPhrase} objętych ({typen}) · {auftraegePhrase} · zgłoszono {tag}",
    "board.maintenanceSeverityAria": "{rad}: {schwere}, stopień {stufe} z 3",
    "board.maintenanceProgressAria": "{rad}: {stand}, {auftrag}",
    "board.maintenanceHasOrder": "istnieje zlecenie",
    "board.maintenanceNoOrder": "brak zlecenia",
    "board.maintenanceFootnote": "Bez kolumny odchylenia i bez średnich: {schadenPhrase}, w tym {offen} nierozwiązanych, {minuten} minut zapisanej pracy – każdy wskaźnik byłby tu statystyką o sobie samym.",
    "board.revenueTypeTitle": "Dwanaście miesięcy według typu roweru",
    "board.revenueGroupTitle": "Dwanaście miesięcy według grupy taryfowej",
    "board.revenueReference": "{umsatz} i {fahrtenPhrase}, od {vonMonat} do {bisMonat}",
    "board.revenueReferenceWithFleet": "{umsatz} i {fahrtenPhrase}, od {vonMonat} do {bisMonat} · {jeRadTag} na rower dziennie ({raederPhrase})",
    "board.revenuePerRide": "{betrag} na przejazd",
    "board.monthlyCourseAria": "{name}: przebieg od {vonMonat} do {bisMonat}, maksimum {max} w {maxMonat}, ostatnio {aktuell}",
    "board.revenueVsRidesAria": "{name}: {umsatzanteil} % przychodu przy {fahrtenanteil} % przejazdów",
    "board.revenueTypeFootnote": "Przychód na przejazd dla City-Bike: z {von} na {nach} ({veraenderung}) od {monat} – jedyna zmiana taryfy w okresie.",
    "board.revenueGroupFootnote": "Miesięcznych liczb klientów nie można sumować – te same osoby jeżdżą w wielu miesiącach. Wiersz podaje więc najsilniejszy miesiąc, nie sumę.",
    "board.kmTitle": "Dystans według typu roweru",
    "board.kmReference": "{km} na {fahrtenPhrase}, od {vonMonat} do {bisMonat} · {anteil} przejazdów szacowanych",
    "board.co2PerRide": "{kg} CO₂ na przejazd",
    "board.kmPerRideAria": "{name}: {je} na przejazd, średnia {schnitt}",
    "board.kmFootnote": "Udział szacowany ({anteil}) liczony jest z wagą przejazdów, a nie jako średnia udziałów miesięcznych: ta dałaby {ungewichtet} w pokazanym okresie, a na {monatszeilen} nawet {alleUngewichtet} zamiast {alleGewichtet} – w zwykłej średniej słabo obsadzone miesiące ważą tyle samo co silne.",
    "board.stationLoadTitle": "Ruch według stacji",
    "board.stationLoadReference": "{stationenPhrase} · {fahrten} wyjazdów w całej historii",
    "board.fillLevelAria": "{name}: poziom napełnienia {prozent} %",
    "board.stationLoadFootnote": "Wyjazdy mieszczą się między {min} a {max} – popyt jest równomierny, decyduje wyłącznie saldo.",
    "board.halfYearFootnote": "Udział zimowy mieści się w każdym wierszu między {min} % a {max} % – sezonowość dotyka wszystkich jednakowo i nie różnicuje wierszy.",
  },
};

const MENGENFORMEN = {
  "rad": {
    de: { "one": "{n} Rad", "other": "{n} Räder" },
    en: { "one": "{n} bike", "other": "{n} bikes" },
    tr: { "one": "{n} bisiklet", "other": "{n} bisiklet" },
    es: { "one": "{n} bicicleta", "other": "{n} bicicletas" },
    it: { "one": "{n} bici", "other": "{n} bici" },
    pl: { "one": "{n} rower", "few": "{n} rowery", "many": "{n} rowerów", "other": "{n} roweru" },
  },
  "kunde": {
    de: { "one": "{n} Kunde", "other": "{n} Kunden" },
    en: { "one": "{n} customer", "other": "{n} customers" },
    tr: { "one": "{n} müşteri", "other": "{n} müşteri" },
    es: { "one": "{n} cliente", "other": "{n} clientes" },
    it: { "one": "{n} cliente", "other": "{n} clienti" },
    pl: { "one": "{n} klient", "few": "{n} klientów", "many": "{n} klientów", "other": "{n} klienta" },
  },
  "station": {
    de: { "one": "{n} Station", "other": "{n} Stationen" },
    en: { "one": "{n} station", "other": "{n} stations" },
    tr: { "one": "{n} istasyon", "other": "{n} istasyon" },
    es: { "one": "{n} estación", "other": "{n} estaciones" },
    it: { "one": "{n} stazione", "other": "{n} stazioni" },
    pl: { "one": "{n} stacja", "few": "{n} stacje", "many": "{n} stacji", "other": "{n} stacji" },
  },
  "zeile": {
    de: { "one": "{n} Zeile", "other": "{n} Zeilen" },
    en: { "one": "{n} row", "other": "{n} rows" },
    tr: { "one": "{n} satır", "other": "{n} satır" },
    es: { "one": "{n} fila", "other": "{n} filas" },
    it: { "one": "{n} riga", "other": "{n} righe" },
    pl: { "one": "{n} wiersz", "few": "{n} wiersze", "many": "{n} wierszy", "other": "{n} wiersza" },
  },
  "fahrt": {
    de: { "one": "{n} Fahrt", "other": "{n} Fahrten" },
    en: { "one": "{n} ride", "other": "{n} rides" },
    tr: { "one": "{n} sürüş", "other": "{n} sürüş" },
    es: { "one": "{n} viaje", "other": "{n} viajes" },
    it: { "one": "{n} corsa", "other": "{n} corse" },
    pl: { "one": "{n} przejazd", "few": "{n} przejazdy", "many": "{n} przejazdów", "other": "{n} przejazdu" },
  },
  "tag": {
    de: { "one": "{n} Tag", "other": "{n} Tage" },
    en: { "one": "{n} day", "other": "{n} days" },
    tr: { "one": "{n} gün", "other": "{n} gün" },
    es: { "one": "{n} día", "other": "{n} días" },
    it: { "one": "{n} giorno", "other": "{n} giorni" },
    pl: { "one": "{n} dzień", "few": "{n} dni", "many": "{n} dni", "other": "{n} dnia" },
  },
  "stunde": {
    de: { "one": "{n} Stunde", "other": "{n} Stunden" },
    en: { "one": "{n} hour", "other": "{n} hours" },
    tr: { "one": "{n} saat", "other": "{n} saat" },
    es: { "one": "{n} hora", "other": "{n} horas" },
    it: { "one": "{n} ora", "other": "{n} ore" },
    pl: { "one": "{n} godzina", "few": "{n} godziny", "many": "{n} godzin", "other": "{n} godziny" },
  },
  "minute": {
    de: { "one": "{n} Minute", "other": "{n} Minuten" },
    en: { "one": "{n} minute", "other": "{n} minutes" },
    tr: { "one": "{n} dakika", "other": "{n} dakika" },
    es: { "one": "{n} minuto", "other": "{n} minutos" },
    it: { "one": "{n} minuto", "other": "{n} minuti" },
    pl: { "one": "{n} minuta", "few": "{n} minuty", "many": "{n} minut", "other": "{n} minuty" },
  },
  "schadensmeldung": {
    de: { "one": "{n} Schadensmeldung", "other": "{n} Schadensmeldungen" },
    en: { "one": "{n} damage report", "other": "{n} damage reports" },
    tr: { "one": "{n} hasar bildirimi", "other": "{n} hasar bildirimi" },
    es: { "one": "{n} parte de avería", "other": "{n} partes de avería" },
    it: { "one": "{n} segnalazione di guasto", "other": "{n} segnalazioni di guasto" },
    pl: { "one": "{n} zgłoszenie usterki", "few": "{n} zgłoszenia usterki", "many": "{n} zgłoszeń usterki", "other": "{n} zgłoszenia usterki" },
  },
  "auftrag": {
    de: { "one": "{n} Wartungsauftrag", "other": "{n} Wartungsaufträge" },
    en: { "one": "{n} work order", "other": "{n} work orders" },
    tr: { "one": "{n} iş emri", "other": "{n} iş emri" },
    es: { "one": "{n} orden de trabajo", "other": "{n} órdenes de trabajo" },
    it: { "one": "{n} ordine di lavoro", "other": "{n} ordini di lavoro" },
    pl: { "one": "{n} zlecenie", "few": "{n} zlecenia", "many": "{n} zleceń", "other": "{n} zlecenia" },
  },
  "monatszeile": {
    de: { one: "{n} Monatszeile", other: "{n} Monatszeilen" },
    en: { one: "{n} month row", other: "{n} month rows" },
    tr: { one: "{n} ay satırı", other: "{n} ay satırı" },
    es: { one: "{n} fila mensual", other: "{n} filas mensuales" },
    it: { one: "{n} riga mensile", other: "{n} righe mensili" },
    pl: { one: "{n} wiersz miesięczny", few: "{n} wiersze miesięczne", many: "{n} wierszy miesięcznych", other: "{n} wiersza miesięcznego" },
  },
  "modell": {
    de: { "one": "{n} Modell", "other": "{n} Modelle" },
    en: { "one": "{n} model", "other": "{n} models" },
    tr: { "one": "{n} model", "other": "{n} model" },
    es: { "one": "{n} modelo", "other": "{n} modelos" },
    it: { "one": "{n} modello", "other": "{n} modelli" },
    pl: { "one": "{n} model", "few": "{n} modele", "many": "{n} modeli", "other": "{n} modelu" },
  },
  "hersteller": {
    de: { "one": "{n} Hersteller", "other": "{n} Herstellern" },
    en: { "one": "{n} manufacturer", "other": "{n} manufacturers" },
    tr: { "one": "{n} üretici", "other": "{n} üretici" },
    es: { "one": "{n} fabricante", "other": "{n} fabricantes" },
    it: { "one": "{n} produttore", "other": "{n} produttori" },
    pl: { "one": "{n} producenta", "few": "{n} producentów", "many": "{n} producentów", "other": "{n} producenta" },
  },
  "ort": {
    de: { "one": "{n} Ort", "other": "{n} Orte" },
    en: { "one": "{n} town", "other": "{n} towns" },
    tr: { "one": "{n} yer", "other": "{n} yer" },
    es: { "one": "{n} localidad", "other": "{n} localidades" },
    it: { "one": "{n} località", "other": "{n} località" },
    pl: { "one": "{n} miejscowość", "few": "{n} miejscowości", "many": "{n} miejscowości", "other": "{n} miejscowości" },
  },
};


const bereiche = new Map();
let aktiverBereich = null;

// Der Wert, den seiteAufbauen() zuletzt von meineRollen() bekommen hat.
// Gehört hierher und nicht in anmeldung.js: dort ist rollenZwischenspeicher
// ein technischer Zwischenspeicher mit eigener Lebensdauer (verfällt bei
// jedem echten Benutzerwechsel, siehe dortiger Kommentar). darfRolle()
// fragt dagegen den Stand, den DIESE Seite zuletzt tatsächlich geladen
// und zur Navigation verwendet hat - das ist ein anderer Zeitpunkt.
let geladeneRollen = null;

function bereichAnmelden(bereich) {
    // bereich: { schluessel, titelSchluessel, rollen: [...], icon, aufbauen: async (ziel) => {},
    //            suchePlatzhalterSchluessel? }
    // titelSchluessel/suchePlatzhalterSchluessel statt fertiger Texte
    // (Mehrsprachigkeit, siehe UEBERSETZUNGEN weiter oben): bereichAnmelden()
    // laeuft GENAU EINMAL beim Laden jeder Bereichsdatei - ein damals fest
    // eingesetzter Text ueberlebte einen spaeteren Sprachwechsel nicht.
    // navigationAufbauen()/bereichWechseln() schlagen den Schluessel des
    // aktiven Bereichs deshalb bei JEDEM eigenen Aufbau frisch ueber t()
    // nach, nicht nur einmal hier.
    // suchePlatzhalterSchluessel (optional, Gestaltungsauftrag Punkt 5): der
    // Platzhalter-/aria-label-Schluessel fuer das gemeinsame Suchfeld in der
    // Kopfleiste, GENAU dann gesetzt, wenn dieser Bereich das Feld
    // tatsaechlich auswertet (heute nur kunden.js). bereichWechseln()
    // weiter unten aktiviert/beschriftet das Feld damit, oder deaktiviert
    // es sichtbar, statt es fuer jeden Bereich gleichermassen (und fuer
    // die meisten wirkungslos) anzubieten - siehe dortiger Kommentar.
    // icon: rohes '<svg viewBox="0 0 24 24">...</svg>'-Markup, EIN MAL je
    // Bereich als Konstante geschrieben - derselbe Aufbau wie aktion.svg
    // in zeigeListe()/zeilenAktionenZelle() weiter unten (kein Icon-Font,
    // keine externe Abhaengigkeit). navigationAufbauen() setzt aria-hidden
    // zentral auf den Wrapper, nicht das Icon selbst schreiben lassen -
    // damit bleibt die Stummschaltung (Gestaltungsauftrag Punkt 3: neben
    // dem ohnehin sichtbaren Text darf ein Screenreader es nicht ein
    // zweites Mal vorlesen) an EINER Stelle garantiert, statt sich auf
    // fuenf gleichlautende Attribute in fuenf Bereichsdateien zu
    // verlassen.
    bereiche.set(bereich.schluessel, bereich);
}

async function seiteAufbauen() {
    // ALLERERSTE Anweisung, unbedingt - nicht erst im Erfolgsfall (siehe
    // sitzungsUhrStoppen() weiter unten): seiteAufbauen() laeuft bei jedem
    // Benutzerwechsel neu (SIGNED_IN/SIGNED_OUT/USER_UPDATED, siehe
    // anmeldung.js), auch beim Abmelden. Ohne dieses Stoppen HIER liefe
    // die Minutenuhr eines fruehreren Logins nach dem Abmelden unbegrenzt
    // weiter - "ein setInterval, das beim Abmelden weiterlaeuft, ist ein
    // Leck" (Auftrag, woertlich). navigationAufbauen()/profilAufbauen()
    // starten sie weiter unten bei Bedarf frisch neu.
    sitzungsUhrStoppen();

    let rollen;
    try {
        rollen = await meineRollen();
    } catch (fehler) {
        // meineRollen() wirft seit der Prüfung von Aufgabe 1 bei einem
        // technischen Fehlschlag, statt still ein leeres Rollen-Set zu
        // liefern - genau damit ein Netzwerk- oder Rechtefehler nicht wie
        // "kein Mitarbeiter" aussieht. Wird der Wurf hier nicht gefangen,
        // läuft er als unbehandelte Ablehnung ins Leere: keiner der vier
        // Zustände wird je sichtbar, die Seite bleibt wortlos beim
        // Ladetext stehen. Es gibt keinen eigenen fünften Zustand für
        // diesen Fall - der Ladezustand ist der einzige, der ohnehin noch
        // sichtbar ist, wenn das hier passiert, und wird deshalb zur
        // Fehleranzeige umgewidmet.
        console.error('seiteAufbauen: Rollen konnten nicht ermittelt werden:', fehler);
        const ladeAnzeige = document.getElementById('zustand-laden');
        ladeAnzeige.textContent = t('common.loginCheckFailed', { msg: fehler.message });
        ladeAnzeige.classList.add('fehler-anzeige');
        zeige('zustand-laden', true);
        zeige('zustand-anmeldung', false);
        zeige('zustand-kein-mitarbeiter', false);
        zeige('zustand-ohne-rolle', false);
        zeige('zustand-arbeit', false);
        return;
    }

    geladeneRollen = rollen;

    // instanceof Set statt Wahrheitswert: ein LEERES Set (Mitarbeiter
    // ohne Rolle) ist falsy und würde von einer if(rollen)-Prüfung
    // nicht von null/false unterschieden - genau der Fehler, den diese
    // Aufgabe korrigiert (siehe Kommentar am Dateianfang).
    zeige('zustand-laden', false);
    zeige('zustand-anmeldung', rollen === null);
    zeige('zustand-kein-mitarbeiter', rollen === false);
    zeige('zustand-ohne-rolle', rollen instanceof Set && rollen.size === 0);
    zeige('zustand-arbeit', rollen instanceof Set && rollen.size > 0);

    if (rollen instanceof Set && rollen.size > 0) {
        await navigationAufbauen(rollen);
    }
}

function zeige(id, sichtbar) {
    document.getElementById(id).hidden = !sichtbar;
}

// ===== Rollenabhängige Navigation =====

// Was eine Rolle nicht darf, wird NICHT angezeigt - nicht ausgegraut.
// Was man nicht darf, soll man nicht suchen. Ein ausgegrauter Eintrag
// ist eine Einladung, nach dem Grund zu fragen; ein fehlender ist keine.
async function navigationAufbauen(rollen) {
    const nav = document.getElementById('navigation');
    nav.replaceChildren();

    const erlaubt = [...bereiche.values()]
        .filter((b) => b.rollen.some((r) => rollen.has(r)));

    for (const bereich of erlaubt) {
        const knopf = document.createElement('button');
        knopf.type = 'button';
        knopf.dataset.bereich = bereich.schluessel;
        knopf.addEventListener('click', () => bereichWechseln(bereich.schluessel));

        // Icon links, Beschriftung rechts - zwei eigene Knoten statt
        // eines gemeinsamen textContent, weil bereich.icon rohes
        // SVG-Markup ist (siehe Kommentar bei bereichAnmelden()) und ein
        // <button>.textContent das sonst als Text statt als Grafik
        // ausgegeben haette. aria-hidden auf dem WRAPPER, nicht auf dem
        // Icon selbst: das Icon ist hier reine Wiedererkennung neben dem
        // ohnehin sichtbaren Text - ein Screenreader soll "Flotte" genau
        // einmal vorlesen, nicht "Bild, Flotte" (Gestaltungsauftrag,
        // Punkt 3).
        const iconWrapper = document.createElement('span');
        iconWrapper.className = 'bereich-icon';
        iconWrapper.setAttribute('aria-hidden', 'true');
        // bereich.icon ist wie aktion.svg in zeilenAktionenZelle() eine
        // im jeweiligen Bereich fest verdrahtete Konstante, keine
        // Nutzereingabe - innerHTML ist hier aus demselben Grund
        // unbedenklich wie dort.
        iconWrapper.innerHTML = bereich.icon;
        knopf.append(iconWrapper);

        // textContent aus t(bereich.titelSchluessel) statt eines einmal
        // festgeschriebenen bereich.titel: navigationAufbauen() laeuft bei
        // JEDEM Sprachwechsel erneut (siehe seitenspracheNeuZeichnen()
        // weiter unten) - eine feste Zeichenkette, einmal beim Laden
        // dieser Datei aus bereichAnmelden() uebernommen, wuerde die
        // Umschaltung nicht mitmachen, ein Schluessel, bei JEDEM Aufbau
        // frisch nachgeschlagen, schon.
        const beschriftung = document.createElement('span');
        beschriftung.className = 'bereich-text';
        beschriftung.textContent = t(bereich.titelSchluessel);
        knopf.append(beschriftung);

        // aria-label mit DEMSELBEN Text wie die sichtbare Beschriftung -
        // und zwar IMMER, nicht nur im eingeklappten Zustand: eingeklappt
        // versteckt style.css .bereich-text per display:none, und ein
        // display:none-Element ist auch aus dem Barrierebaum verschwunden.
        // Ohne diesen Namen hiesse der Knopf dann schlicht "Schaltflaeche"
        // - genau die "Ratefrage", die der Auftrag ausdruecklich
        // ausschliesst. Ihn nur beim Einklappen zu setzen, hiesse zwei
        // Stellen zu pflegen, die dasselbe sagen muessen; ein aria-label,
        // das wortgleich mit dem sichtbaren Text ist, aendert fuer den
        // ausgeklappten Zustand nichts (WCAG "Label in Name" ist erfuellt,
        // weil beide Texte identisch sind).
        knopf.setAttribute('aria-label', t(bereich.titelSchluessel));
        navigationRubrikVerdrahten(knopf, t(bereich.titelSchluessel));

        nav.append(knopf);
    }

    const benutzer = (await angemeldeterBenutzer()).data.user;
    profilAufbauen(benutzer, rollen);

    if (erlaubt.length) await bereichWechseln(erlaubt[0].schluessel);
}

// Frührer stand hier direkt "email · rolle1, rolle2, ..." in
// #benutzer-anzeige, einem einzelnen <span> in der Kopfleiste (Punkt 3
// der Gestaltung). Jetzt füllt diese Funktion das aufklappbare
// Profilmenü - Bedienung (auf/zu, Escape, Klick daneben) wird davon
// GETRENNT, einmalig beim Laden verdrahtet (siehe "Profilmenü"
// weiter unten): navigationAufbauen() und damit profilAufbauen() läuft
// bei jedem seiteAufbauen()-Durchlauf erneut (z. B. nach USER_UPDATED,
// siehe anmeldung.js), ein hier zusätzlich angehängter Klick-Handler
// würde sich mit der Zeit vervielfachen.
function profilAufbauen(benutzer, rollen) {
    const meta = benutzer.user_metadata || {};
    const vorname = meta.vorname || '';
    const nachname = meta.nachname || '';
    const anzeigeName = (vorname || nachname) ? `${vorname} ${nachname}`.trim() : benutzer.email;

    // Konterfei: Initialen aus Vor- und Nachname - beides liegt (falls
    // gepflegt) in user_metadata, demselben Feld, aus dem
    // getUserDisplayName() in src/auth.js für Kundenkonten schon den
    // Vornamen liest (siehe dortiger Kommentar). velocity.mitarbeiter
    // führt zwar ebenfalls vorname/nachname, ist aber über keine
    // v_wawi_-Sicht und keine RPC für den eigenen Datensatz erreichbar -
    // das anzulegen wäre eine Datenbankänderung, die dieser Auftrag
    // ausdrücklich nicht vorsieht. Fehlt die Metadatenangabe, werden die
    // Initialen NOTFALLS aus der E-Mail abgeleitet (siehe initialenAus()).
    const avatar = document.getElementById('profil-initialen');
    avatar.style.backgroundImage = '';
    avatar.textContent = initialenAus(vorname, nachname, benutzer.email);

    // Das Konterfei selbst (assets/konterfei.png, auf 128px verkleinert -
    // ein Mitarbeiterfoto in Ausgangsgröße war 215 KB für einen
    // 40-Pixel-Rundknopf) tritt an die Stelle der Initialen, SOBALD es
    // tatsächlich geladen ist - nicht schon beim bloßen Setzen von
    // backgroundImage, das nimmt kein fehlendes Bild zur Kenntnis. Ein
    // eigenes Image() zum Vorladen ist deshalb nötig: erst sein 'load'
    // ersetzt die Initialen, sein 'error' lässt sie unangetastet stehen -
    // genau der im Auftrag verlangte Rückfall, falls das Bild fehlt oder
    // nicht erreichbar ist. .profilknopf-avatar setzt background-size:
    // cover bereits als Bildfläche an, hier ist dafür keine zweite Regel
    // nötig.
    const vorschau = new Image();
    vorschau.onload = () => {
        avatar.style.backgroundImage = `url(assets/konterfei.png)`;
        avatar.textContent = '';   // sonst überlagern sich Initialen und Foto
    };
    vorschau.src = 'assets/konterfei.png';

    document.getElementById('profil-name').textContent = anzeigeName;
    document.getElementById('profil-email').textContent = benutzer.email;

    const rollenKasten = document.getElementById('profil-rollen');
    rollenKasten.replaceChildren();
    for (const rolle of rollen) {
        const marke = document.createElement('span');
        marke.className = 'rollen-marke';
        marke.textContent = rolle;
        rollenKasten.append(marke);
    }

    // Gestaltungsauftrag, woertlich: "neben dem Profilbild von mir bitte
    // noch Uhrzeit, Datum und Eingeloggte Zeit angeben" - siehe
    // sitzungsUhrStarten() weiter unten fuer die Quelle der Sitzungsdauer
    // und die Begruendung, warum sie NICHT sekundengenau nachgezeichnet
    // wird.
    sitzungsUhrStarten(benutzer);
}

// ===== Sitzungsinfo: Uhrzeit, Datum, Sitzungsdauer =====
//
// Gestaltungsauftrag, woertlich: "neben dem Profilbild von mir bitte noch
// Uhrzeit, Datum und Eingeloggte Zeit angeben".
//
// WOHER DIE SITZUNGSDAUER KOMMT (Auftrag: "nimm eine echte Quelle, keine
// erfundene"): benutzer.last_sign_in_at - ein Feld, das Supabase Auth bei
// JEDER tatsaechlichen Anmeldung auf dem auth.users-Datensatz selbst
// fortschreibt, unabhaengig von dieser Oberflaeche. Das ist eine ECHTE
// Quelle in genau dem Sinn, den der Auftrag verlangt: der Zeitpunkt, zu
// dem SUPABASE die Sitzung tatsaechlich begonnen hat, nicht ein Wert, den
// dieses Skript sich selbst ausdenkt. Es aendert sich AUSSCHLIESSLICH bei
// einem echten erneuten Login (SIGNED_IN mit neuem Passwort-Login o.ae.),
// NICHT bei TOKEN_REFRESHED (das laeuft stuendlich waehrend derselben
// Sitzung, siehe anmeldung.js) - genau die Abgrenzung, die "Sitzungsdauer"
// hier bedeuten soll: seit dem tatsaechlichen Anmelden, nicht seit dem
// letzten Auffrischen eines Tokens im Hintergrund.
//
// FALLS DAS FELD FEHLT (Auftrag: "wenn keine taugliche Angabe existiert,
// ist der Zeitpunkt des Ladens der Seite eine ehrliche Naeherung - dann
// muss die Beschriftung sagen, was sie misst"): seitenladeZeitpunkt (siehe
// unten, EINMAL beim Laden dieser Datei gesetzt) tritt an seine Stelle,
// UND sitzungsinfoZeichnen() beschriftet die Dauer dann sichtbar anders
// ("seit dem Öffnen: ..." statt "... angemeldet") - keine vorgetaeuschte
// Genauigkeit ueber einen Anmeldezeitpunkt, den diese Oberflaeche gar
// nicht kennt.
const seitenladeZeitpunkt = new Date();

let sitzungsUhrTimeout = null;     // der einmalige Ausrichtungs-Timer bis zur naechsten vollen Minute
let sitzungsUhrIntervall = null;   // danach: alle 60s

// Von seiteAufbauen() UNBEDINGT als allererste Anweisung aufgerufen
// (siehe dort) - das ist der einzige Ort, an dem ein Abmelden (oder ein
// Benutzerwechsel) zuverlaessig durchlaeuft, unabhaengig davon, ob
// hinterher ueberhaupt eine neue Uhr gestartet wird. Ohne dieses
// bedingungslose Stoppen liefe die Minutenuhr eines fruehreren Logins
// nach dem Abmelden unbegrenzt weiter - "ein setInterval, das beim
// Abmelden weiterlaeuft, ist ein Leck" (Auftrag, woertlich).
function sitzungsUhrStoppen() {
    clearTimeout(sitzungsUhrTimeout);
    clearInterval(sitzungsUhrIntervall);
    sitzungsUhrTimeout = null;
    sitzungsUhrIntervall = null;
}

// benutzer: das Supabase-User-Objekt aus profilAufbauen() oben.
//
// MINUTENGENAU, NICHT SEKUENDLICH (Auftrag, woertlich: "eine Uhr, die
// jede Sekunde neu zeichnet, kostet den ganzen Tag Rechenzeit fuer
// nichts... minutengenau reicht"): eine Sitzungsdauer oder Uhrzeit auf
// die Sekunde genau anzuzeigen, waere fuer "knapp und ruhiges Beiwerk"
// (Auftrag) ohnehin falsch dosierte Praezision - niemand liest hier eine
// Stoppuhr ab.
//
// AUSGERICHTET AUF DIE VOLLE MINUTE (Auftrag: "der Wechsel muss zur
// vollen Minute passen, nicht sechzig Sekunden nach dem Laden"): ein
// schlichtes setInterval(..., 60000) ab dem Ladezeitpunkt wechselte die
// Anzeige zu einer zufaelligen Sekunde jeder Minute (z. B. immer bei
// :17) - sichtbar falsch, sobald man die Uhr laenger als eine Minute im
// Blick behaelt. sitzungsUhrTimeout unten wartet deshalb EINMALIG bis
// zur naechsten vollen Minute, erst DANACH beginnt das reguläre
// 60-Sekunden-Intervall.
function sitzungsUhrStarten(benutzer) {
    sitzungsUhrStoppen();   // defensiv - siehe Kopfkommentar dort

    const angemeldetSeit = benutzer.last_sign_in_at ? new Date(benutzer.last_sign_in_at) : null;
    const beginn = angemeldetSeit || seitenladeZeitpunkt;
    const istEchteAngabe = Boolean(angemeldetSeit);

    const neuZeichnen = () => sitzungsinfoZeichnen(beginn, istEchteAngabe);
    neuZeichnen();

    const jetzt = new Date();
    const msBisNaechsteMinute = 60000 - (jetzt.getSeconds() * 1000 + jetzt.getMilliseconds());
    sitzungsUhrTimeout = setTimeout(() => {
        neuZeichnen();
        sitzungsUhrIntervall = setInterval(neuZeichnen, 60000);
    }, msBisNaechsteMinute);
}

function sitzungsinfoZeichnen(beginn, istEchteAngabe) {
    const jetzt = new Date();
    const zeitDatum = document.getElementById('sitzungsinfo-zeit-datum');
    // zeitFormat()/datumFormat() (Mehrsprachigkeit, Fallstrick 2): bisher
    // fest 'de-DE' - die Uhrzeit neben dem Profil folgt jetzt derselben
    // Sprache wie der Rest der Oberflaeche, nicht mehr immer der
    // deutschen Schreibweise.
    zeitDatum.textContent =
        `${zeitFormat(jetzt, { hour: '2-digit', minute: '2-digit' })} · ` +
        datumFormat(jetzt);

    const minuten = Math.max(0, Math.round((jetzt - beginn) / 60000));
    const dauer = minuten < 1 ? t('common.underOneMinute') : sitzungsdauerFormat(minuten);
    // Beschriftung sagt WAS gemessen wird (Auftrag: "keine Genauigkeit
    // vortaeuschen, die es nicht gibt") - "angemeldet" nur mit einer
    // echten Anmeldezeit (last_sign_in_at), sonst der ehrliche Hinweis,
    // dass hier lediglich der Ladezeitpunkt dieser Seite gemessen wird.
    document.getElementById('sitzungsinfo-dauer').textContent = istEchteAngabe
        ? t('common.loggedInFor', { dauer })
        : t('common.sinceOpen', { dauer });
}

// Stunden erst ab 60 Minuten (nicht schon vorher als "0 Std. 12 Min."):
// eine dreistellige Minutenzahl waere bei einer sehr langen Sitzung sonst
// selbst wieder unlesbar - "knapp und ruhig" gilt fuer jede Sitzungslaenge,
// nicht nur fuer die ersten 60 Minuten. Min./Std. bleiben feste, kurze
// Abkuerzungen je Sprache (common.minAbbrev/common.hourAbbrev) statt einer
// echten Mehrzahlform ueber mengeFormat(): eine Abkuerzung wie "Min."
// aendert sich in keiner der sechs Sprachen mit der Anzahl.
function sitzungsdauerFormat(minuten) {
    if (minuten < 60) return `${zahlFormat(minuten)} ${t('common.minAbbrev')}`;
    const stunden = Math.floor(minuten / 60);
    const rest = minuten % 60;
    return rest === 0
        ? `${zahlFormat(stunden)} ${t('common.hourAbbrev')}`
        : `${zahlFormat(stunden)} ${t('common.hourAbbrev')} ${zahlFormat(rest)} ${t('common.minAbbrev')}`;
}

function initialenAus(vorname, nachname, email) {
    if (vorname && nachname) return (vorname[0] + nachname[0]).toUpperCase();
    // Notfall-Ableitung aus der E-Mail (Auftrag Punkt 3, ausdrücklich
    // erlaubt): die ersten beiden Buchstaben vor dem @. Nicht einfach
    // die ersten zwei ZEICHEN, weil ein Postfach wie "m.mueller@..." sonst
    // "M." statt "MM" ergäbe - ein Punkt ist kein Initial.
    const lokal = (email || '').split('@')[0];
    const buchstaben = lokal.replace(/[^a-zA-Z]/g, '');
    const quelle = buchstaben.length >= 2 ? buchstaben : lokal;
    return (quelle.slice(0, 2) || '?').toUpperCase();
}

// herkunftstext (optional, Gestaltungsauftrag Punkt 3): "sagen, woher man
// kommt" - von bereichSprung() weiter unten gesetzt, sonst nirgends
// (Navigationsklick, erster Bereich beim Anmelden). OHNE eigenes Zutun
// haette ein Sprung hier keine Wirkung gehabt: das melde('') am Ende
// dieser Funktion (siehe dort) loescht die Statuszeile bei JEDEM
// Bereichswechsel bedingungslos, GENAU DAMIT ein alter Stand aus dem
// VORHERIGEN Bereich nicht als scheinbar aktuelle Meldung im neuen
// stehen bleibt - ein einfaches melde(herkunftstext, 'gut') VOR
// bereichWechseln() (wie bei jeder Buchung ueblich, siehe neuerVorgang())
// würde von genau diesem Loeschen sofort wieder ueberschrieben. Der
// Parameter tritt deshalb an die Stelle des sonst leeren melde('')-Rufs.
async function bereichWechseln(schluessel, herkunftstext = null) {
    aktiverBereich = bereiche.get(schluessel);
    document.querySelectorAll('#navigation button').forEach((k) => {
        k.setAttribute('aria-current', k.dataset.bereich === schluessel ? 'page' : 'false');
    });

    // Arbeitsliste UND Detailmaske leeren, nicht nur die Maske: sonst
    // blieben die Unterreiter oder die letzte Liste des VORHERIGEN
    // Bereichs als Karteileiche stehen, bis der neue Bereich zufällig
    // selbst wieder zeigeListe()/zeigeUnterreiter() aufruft. Der
    // Listenzustand (Auswahl, Zeilen) gehört ebenfalls zurückgesetzt -
    // eine ausgewählte Zeile eines fremden Bereichs darf nicht als
    // "ausgewählt" im neuen Bereich weiterleben.
    document.getElementById('arbeitsliste').replaceChildren();
    document.getElementById('detailmaske').replaceChildren();
    hauptknopfElement = null;
    listenZeilen = [];
    listenAuswahl = null;
    listenIndex = -1;
    listenZeilenElemente = [];
    // Siehe filterleisteMehrfachOffenName weiter unten: zwei Bereiche
    // koennen denselben Filternamen fuehren (Flotte UND Kundschaft tragen
    // beide 'status') - ohne Rueckstellung risse ein offenes
    // Statusfilter-Popup aus dem VORHERIGEN Bereich in den naechsten hinein.
    filterleisteMehrfachOffenName = null;

    // Punkt 5 der Gestaltung: "es sagt nicht, wonach es sucht, oder ob
    // es gerade etwas einschraenkt" - das Suchfeld liegt in der
    // gemeinsamen Kopfleiste (index.html) und damit ausserhalb jedes
    // einzelnen Bereichs, heute nutzt es aber nur Kundschaft
    // (kunden.js). suchePlatzhalterSchluessel ist deshalb ein OPTIONALES
    // Feld am bereich-Objekt (siehe bereichAnmelden() oben): vorhanden,
    // wird das Feld aktiviert und benannt; fehlt es, wird das Feld
    // sichtbar deaktiviert statt weiter scheinbar bedienbar, aber
    // folgenlos dazustehen - dieselbe "was man nicht darf/nicht kann,
    // wird nicht angeboten"-Haltung wie bei der Navigation weiter oben.
    // Der Wert wird zusaetzlich geleert: ein Suchtext aus dem VORHERIGEN
    // Bereich durfte den neuen sonst ungefragt mitnehmen, obwohl er dort
    // nie eingegeben wurde.
    const feldSucheGlobal = document.getElementById('feld-suche');
    feldSucheGlobal.value = '';
    feldSucheGlobal.classList.remove('feld-suche-aktiv');
    if (aktiverBereich.suchePlatzhalterSchluessel) {
        feldSucheGlobal.disabled = false;
        feldSucheGlobal.placeholder = t(aktiverBereich.suchePlatzhalterSchluessel);
        feldSucheGlobal.setAttribute('aria-label', t(aktiverBereich.suchePlatzhalterSchluessel));
    } else {
        feldSucheGlobal.disabled = true;
        feldSucheGlobal.placeholder = t('common.noSearchPlaceholder');
        feldSucheGlobal.setAttribute('aria-label', t('common.noSearchAria'));
    }

    // herkunftstext gesetzt -> als frische Bestaetigung ('gut') stehen
    // lassen, GENAU wie eine Buchung: der direkt folgende Aufruf von
    // aktiverBereich.aufbauen() (der als erste Anweisung neuerVorgang()
    // ausfuehrt, siehe dort) liest letzteMeldeArt OHNE dazwischenliegendes
    // await und unterdrueckt damit die eigene neutrale Uebersichtsmeldung
    // genau einmal - der Sprunggrund bleibt sichtbar, statt sofort von
    // "12 Schadensmeldungen" ueberschrieben zu werden. Ohne herkunftstext
    // (der ueberwiegende Regelfall: Navigationsklick) unveraendert leer,
    // wie zuvor.
    melde(herkunftstext || '', herkunftstext ? 'gut' : 'neutral');

    // DER FEHLENDE LADEZUSTAND. Bis hierher ist die Arbeitsliste
    // geleert; aufbauen() holt jetzt seine Daten und braucht dafuer eine
    // Netzwerkstrecke. In dieser Zeit stand der ganze Arbeitsbereich
    // leer und weiss da, ohne ein Wort - nicht zu unterscheiden von
    // "dieser Bereich hat nichts anzuzeigen" oder "hier ist etwas
    // kaputt". Einen Ladezustand gab es nur fuer die Seite als Ganzes
    // beim Start (#zustand-laden), fuer keinen einzigen Bereichswechsel.
    // Kein role="status"/aria-live: die Statuszeile IST das Live-Gebiet
    // dieser Oberflaeche (siehe index.html), eine zweite sprechende
    // Stelle fuer denselben Vorgang liesse einen Bildschirmleser zweimal
    // dasselbe melden.
    // remove() im finally und nicht danach: die Bausteine der Bereiche
    // (zeigeWerkzeugleiste, zeigeKopftafel, zeigeListe) HAENGEN AN die
    // Arbeitsliste an, sie ersetzen ihren Inhalt nicht - der Platzhalter
    // bliebe sonst zwischen Werkzeugleiste und Kopftafel stehen (im
    // Browser genau so gesehen). finally statt einer Zeile nach dem
    // await: wirft aufbauen(), stuende sonst "Einen Moment ..." fuer
    // immer da und behauptete, es laufe noch etwas.
    const platzhalter = document.createElement('p');
    platzhalter.className = 'ladehinweis';
    platzhalter.textContent = t('index.loading');
    document.getElementById('arbeitsliste').append(platzhalter);

    try {
        await aktiverBereich.aufbauen();
    } finally {
        platzhalter.remove();
    }
}

// ===== Die Statuszeile =====

// Jede Buchung wird hier bestätigt. Wer zwanzig Raeder nacheinander
// umbucht, braucht die Rückmeldung dort, wo er ohnehin hinsieht - nicht
// als Blase in einer Ecke, die nach drei Sekunden verschwindet. Deshalb
// bleibt der Text stehen, bis der nächste kommt.
function melde(text, art = 'neutral') {
    const zeile = document.getElementById('statuszeile');
    zeile.textContent = text;
    zeile.className = art;   // neutral | gut | warnung | schlecht
    // Von neuerVorgang() gelesen und dort sofort verbraucht (siehe
    // dortiger Kommentar) - deshalb hier roh und ungeprüft gesetzt.
    letzteMeldeArt = art;
}

// ===== Vorgangsverwaltung =====
//
// ERSTER ANLAUF (verworfen): eine Buchungsbestätigung ("Rad ...
// ausgemustert.", art='gut') kommt aus einem Knopf; direkt danach ruft
// jede *Aufbauen()-Funktion die Liste neu auf und schloss früher mit
// einer eigenen Übersichtsmeldung ("10 Stationen") ab, die die
// Bestätigung sofort überschrieb. Die erste Lösung dafür war EIN
// gemeinsames Bit ("die letzte Meldung war eine noch unverbrauchte
// Bestätigung"). Die Prüfung hat das durchfallen lassen, mit zwei
// nachgestellten Befunden:
//
//   1. Zwei Buchungen kurz hintereinander, deren Neuaufbauten sich
//      überholen (Buchung A startet ihren Neuaufbau, dann Buchung B
//      ihren - B's Bestätigung steht, dann kommt ZUERST A's Neuaufbau
//      zurück). Ein einzelnes Bit weiß nicht, dass die Bestätigung
//      inzwischen zu B gehört, nicht zu A - A's Neuaufbau "verbraucht"
//      das Bit, das für B gedacht war, und B's eigener Neuaufbau
//      schreibt danach ungebremst seine Übersicht über B's eigene,
//      noch druckfrische Bestätigung.
//   2. Ein Bereichswechsel während ein Neuaufbau des VORHERIGEN
//      Bereichs noch läuft: kommt der spät zurück, schreibt er Liste
//      UND Statuszeile des NEUEN Bereichs voll, obwohl die Navigation
//      längst woanders steht. Das Bit schützt nicht davor - es kennt
//      nur "war zuletzt eine Bestätigung da", nicht "gehört dieser
//      Neuaufbau überhaupt noch zur Gegenwart".
//
// Beiden Befunden gemeinsam: es gab keine Stelle, an der ein Neuaufbau
// merken konnte, dass ER SELBST veraltet ist. Ein Bit kennt nur DASS
// etwas war, nicht WOZU es gehörte.
//
// LÖSUNG: jeder Vorgang (jeder Aufruf einer *Aufbauen()-Funktion)
// bekommt beim Start eine eigene, fortlaufende Kennung. neuerVorgang()
// liefert sie; jeder weitere Schreibversuch dieses Vorgangs - Liste
// (zeigeListe) UND Statuszeile (meldeVorgang) - trägt diese Kennung
// vor sich her und prüft bei sich SELBST, ob sie noch die aktuelle
// ist. Ein Vorgang, dessen Kennung inzwischen überholt wurde -von
// einem neueren Neuaufbau DESSELBEN Bereichs (Befund 1) oder vom
// Neuaufbau eines ANDEREN Bereichs nach einem Wechsel (Befund 2) -
// schreibt gar nichts mehr, weder Liste noch Statuszeile. Kein Bit,
// keine Warteschlange: die zwanzigste Buchung einer Reihe zeigt weiter
// sofort ihre eigene Bestätigung, unabhängig davon, wie lange die
// vorherigen Neuaufbauten noch unterwegs sind.
//
// Die Bestätigung selbst hängt jetzt am VORGANG statt an einem
// geteilten Bit: neuerVorgang() liest, OHNE await dazwischen, welche
// Art die zuletzt sichtbare Meldung hatte (letzteMeldeArt, von melde()
// gesetzt). melde(..., 'gut') und der direkt folgende Aufruf einer
// *Aufbauen()-Funktion stehen in JEDEM Aufrufer als zwei aufeinander-
// folgende Anweisungen OHNE dazwischenliegendes await - JavaScript
// räumt dazwischen nichts anderes ab. Zeigt die Statuszeile in diesem
// Moment noch eine frische Bestätigung, gehört sie zu GENAU DEM
// Vorgang, der jetzt beginnt - nicht zu irgendeinem früheren. Die
// Markierung wird dabei sofort verbraucht (letzteMeldeArt = null):
// ein zweiter, unabhängiger Neuaufbau nach demselben Vorgang (ohne
// neue Buchung dazwischen) soll seine eigene Übersicht wieder normal
// zeigen, nicht ein zweites Mal von derselben, längst gezeigten
// Bestätigung unterdrückt werden.
//
// Verwerfen gehört HIERHER, nicht in die Bereiche (Ruling der
// zweiten Prüfung): jeder der fünf Arbeitsbereiche ruft nur
// neuerVorgang() (eine Zeile, ganz am Anfang jeder *Aufbauen()-
// Funktion) und reicht die Kennung an zeigeListe()/meldeVorgang()
// weiter - die Entscheidung, ob ein Schreibversuch noch gilt, fällt
// ausschließlich hier.
let vorgangsZaehler = 0;
let aktuellerVorgang = 0;            // Kennung des zuletzt gestarteten Vorgangs
let vorgangMitOffenerBestaetigung = null;  // Kennung, deren Bestätigung noch "frisch" ist
let letzteMeldeArt = null;           // von melde() gesetzt, von neuerVorgang() verbraucht

// Von jeder *Aufbauen()-Funktion als ALLERERSTE Anweisung aufzurufen,
// vor jedem await. Liefert die Kennung dieses Vorgangs.
function neuerVorgang() {
    vorgangsZaehler += 1;
    aktuellerVorgang = vorgangsZaehler;
    vorgangMitOffenerBestaetigung = letzteMeldeArt === 'gut' ? aktuellerVorgang : null;
    letzteMeldeArt = null;   // verbraucht - siehe Begründung oben
    return aktuellerVorgang;
}

// true, wenn kennung noch der zuletzt gestartete Vorgang ist - false,
// wenn seitdem ein neuerer begonnen hat (ein weiterer Neuaufbau
// desselben Bereichs, ein Bereichswechsel, oder beides).
function istAktuellerVorgang(kennung) {
    return kennung === aktuellerVorgang;
}

// Liefert die Kennung des Vorgangs, der GERADE läuft - anders als
// neuerVorgang() OHNE selbst einen neuen zu beginnen. Für Masken, die vor
// dem Anzeigen selbst nachladen (radAnlegenMaske() in flotte.js: Promise.all
// über Modelle und Stationen; schadenMeldenMaske() in instandhaltung.js:
// die Flotte) und deshalb zwischen ihrem eigenen Start und ihrem
// zeigeMaske()-Aufruf einen Bereichswechsel oder Unterreiterwechsel
// erleben können. Diese Masken sind selbst KEIN *Aufbauen()-Vorgang und
// dürfen keinen eigenen ziehen - neuerVorgang() verbraucht dabei
// letzteMeldeArt (siehe dort), was einer Anlegemaske ohne eigene
// Buchungsbestätigung fälschlich eine fremde Bestätigung klauen würde.
// Sie merken sich stattdessen beim Start, welcher *Aufbauen()-Vorgang
// gerade lief, und pruefen nach ihrem eigenen Laden per
// istAktuellerVorgang(), ob er es immer noch ist.
//
// Im Browser nachgestellt (WICHTIG 4): Flotte -> "Neues Rad anlegen"
// geklickt -> vor der Rückkehr (Promise.all noch unterwegs) zu Stationen
// gewechselt. Ohne diese Prüfung erschien die Anlegemaske verspätet ÜBER
// der Stationenliste; ein Klick auf "Anlegen" dort legte wirklich ein Rad
// an, und der anschließende flotteAufbauen() bekam die NEUESTE Kennung und
// überschrieb damit die gerade angezeigte Stationenliste, während die
// Navigation weiterhin "Stationen" zeigte. Mit der Prüfung bricht
// radAnlegenMaske() nach dem Bereichswechsel wortlos ab, wie ein
// veralteter *Aufbauen()-Vorgang auch.
function laufenderVorgang() {
    return aktuellerVorgang;
}

// Die Statuszeilen-Schreibstelle jeder *Aufbauen()-Funktion - sowohl
// für den Ladefehler-Zweig (art='schlecht') als auch für die
// abschließende Übersichtsmeldung (art='neutral', Vorgabewert). NICHT
// für die Bestätigung selbst, die bleibt ein direkter Aufruf von
// melde(text, 'gut') im Knopf-Handler, BEVOR die *Aufbauen()-Funktion
// (und mit ihr neuerVorgang()) überhaupt läuft.
//
// Ein veralteter Vorgang schreibt überhaupt nichts - auch keinen
// Fehler: gehört der Vorgang nicht mehr zur Gegenwart (Bereich
// gewechselt, oder ein neuerer Neuaufbau läuft bereits), ist auch sein
// eigener Ladefehler nicht mehr relevant, siehe Befund 2 oben. Nur
// innerhalb eines noch aktuellen Vorgangs gilt die Reihenfolge aus dem
// Auftrag: eine Übersichtsmeldung (art='neutral') fällt genau einmal
// aus, wenn dieser Vorgang noch eine unverbrauchte Bestätigung trägt -
// ein Fehler (art='schlecht') dagegen schreibt IMMER, unterdrückt durch
// nichts.
function meldeVorgang(kennung, text, art = 'neutral') {
    if (!istAktuellerVorgang(kennung)) return;
    if (art === 'neutral' && vorgangMitOffenerBestaetigung === kennung) {
        vorgangMitOffenerBestaetigung = null;   // verbraucht, Bestätigung bleibt stehen
        return;
    }
    melde(text, art);
}

// ===== Bestätigungsdialog =====

// Für alles, was sich nicht zurückholen lässt. Kein window.confirm:
// das lässt sich nicht gestalten und nicht mit der Tastatur bedienen,
// wie der Rest dieser Oberfläche. <dialog>.showModal() übernimmt die
// Fokusfalle von sich aus und schließt bei Escape über sein eigenes
// 'cancel'-Ereignis, unabhängig vom globalen keydown-Listener aus
// Schritt 6 - der überspringt Escape deshalb, solange ein <dialog>
// offen ist (siehe dort), statt selbst zu reagieren und mit dem
// Browser um dieselbe Taste zu konkurrieren.
function bestaetige(frage, bestaetigungswort = null) {
    return new Promise((ergebnisMelden) => {
        const dialog = document.createElement('dialog');
        dialog.className = 'velocity-dialog';

        // frage trägt bei den wichtigeren Dialogen mehrere inhaltliche
        // Blöcke, getrennt durch eine Leerzeile (\n\n) - der Art.-17-Dialog
        // in kunden.js etwa WAS VERSCHWINDET, WAS BLEIBT, WAS DAS NICHT
        // LEISTET und den Unumkehrbarkeits-Hinweis. EIN <p> mit textContent
        // faltet solche Zeilenumbrüche zu einem einzigen Fliesstext
        // zusammen - .velocity-dialog p kennt kein white-space: pre-line.
        // Deshalb hier ein eigenes <p> je Block, weiterhin ausschließlich
        // über textContent gesetzt, nie über innerHTML: ein Text ohne
        // Leerzeile (die meisten Aufrufer) ergibt unverändert genau ein
        // <p>. Allgemein gelöst, weil jeder Dialog über bestätige()
        // läuft - nicht nur der Art.-17-Fall, der den Fehler gefunden hat.
        for (const block of frage.split('\n\n')) {
            const absatz = document.createElement('p');
            absatz.textContent = block;
            dialog.append(absatz);
        }

        let eingabe = null;
        const bestaetigenKnopf = document.createElement('button');
        bestaetigenKnopf.type = 'button';
        bestaetigenKnopf.textContent = t('common.confirm');
        bestaetigenKnopf.className = 'knopf-gefaehrlich';

        if (bestaetigungswort) {
            // Ein Klick allein darf hier nicht reichen - das ist für
            // die Anonymisierung gedacht und für nichts sonst.
            const label = document.createElement('label');
            label.htmlFor = 'dialog-bestaetigungswort';
            label.textContent = t('common.confirmWordPrompt', { wort: bestaetigungswort });
            dialog.append(label);

            eingabe = document.createElement('input');
            eingabe.type = 'text';
            eingabe.id = 'dialog-bestaetigungswort';
            eingabe.autocomplete = 'off';
            dialog.append(eingabe);

            bestaetigenKnopf.disabled = true;
            eingabe.addEventListener('input', () => {
                bestaetigenKnopf.disabled = eingabe.value !== bestaetigungswort;
            });
        }

        const knopfleiste = document.createElement('div');
        knopfleiste.className = 'knopfleiste';

        const abbrechenKnopf = document.createElement('button');
        abbrechenKnopf.type = 'button';
        abbrechenKnopf.textContent = t('common.cancel');
        abbrechenKnopf.className = 'knopf-neben';
        // dialog.close() löst nur 'close' aus, nicht 'cancel' - der
        // Rückgabewert entscheidet unten einheitlich über das Ergebnis,
        // egal ob per Klick oder per Escape geschlossen wurde.
        abbrechenKnopf.addEventListener('click', () => dialog.close('nein'));
        bestaetigenKnopf.addEventListener('click', () => dialog.close('ja'));

        knopfleiste.append(abbrechenKnopf, bestaetigenKnopf);
        dialog.append(knopfleiste);
        document.body.append(dialog);

        dialog.addEventListener('close', () => {
            const ergebnis = dialog.returnValue === 'ja';
            dialog.remove();
            ergebnisMelden(ergebnis);
        });

        dialog.showModal();
        // Ohne Bestätigungswort fällt der Anfangsfokus bewusst auf
        // Abbrechen: ein versehentliches Enter darf eine gefährliche
        // Aktion nicht bestätigen. Mit Wort fällt er auf das Feld, weil
        // dort ohnehin zuerst getippt werden muss.
        (eingabe || abbrechenKnopf).focus();
    });
}

// Ein einzeiliger Eingabedialog. Liefert null bei Abbruch - und der
// Aufrufer muss das pruefen: eine Buchung ohne Grund ist eine Buchung,
// die später niemand erklären kann.
function frageNachGrund(titel) {
    return new Promise((ergebnisMelden) => {
        const dialog = document.createElement('dialog');
        dialog.className = 'velocity-dialog';

        const ueberschrift = document.createElement('h2');
        ueberschrift.textContent = titel;
        dialog.append(ueberschrift);

        const label = document.createElement('label');
        label.htmlFor = 'dialog-grund';
        label.textContent = t('common.reason');
        dialog.append(label);

        const eingabe = document.createElement('input');
        eingabe.type = 'text';
        eingabe.id = 'dialog-grund';
        eingabe.required = true;
        dialog.append(eingabe);

        const knopfleiste = document.createElement('div');
        knopfleiste.className = 'knopfleiste';

        const abbrechenKnopf = document.createElement('button');
        abbrechenKnopf.type = 'button';
        abbrechenKnopf.textContent = t('common.cancel');
        abbrechenKnopf.className = 'knopf-neben';
        abbrechenKnopf.addEventListener('click', () => dialog.close());

        const bestaetigenKnopf = document.createElement('button');
        bestaetigenKnopf.type = 'button';
        bestaetigenKnopf.textContent = t('common.confirm');
        bestaetigenKnopf.className = 'knopf-haupt';
        bestaetigenKnopf.addEventListener('click', () => {
            if (!eingabe.value.trim()) {
                eingabe.reportValidity();
                return;
            }
            dialog.close('ja');
        });
        // Enter im Feld bestätigt - ein Dialog mit genau einem Feld ist
        // der Fall, in dem das erwartet wird.
        eingabe.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                bestaetigenKnopf.click();
            }
        });

        knopfleiste.append(abbrechenKnopf, bestaetigenKnopf);
        dialog.append(knopfleiste);
        document.body.append(dialog);

        dialog.addEventListener('close', () => {
            const ergebnis = dialog.returnValue === 'ja' ? eingabe.value : null;
            dialog.remove();
            ergebnisMelden(ergebnis);
        });

        dialog.showModal();
        eingabe.focus();
    });
}

// ===== Arbeitsliste =====
//
// Liste und Maske gleichzeitig. Der Bearbeitungsfluss ist: auswählen,
// ändern, speichern, nächster Satz - ohne Seitenwechsel. Das ist der
// Unterschied zwischen einer Arbeitsmaske und einer Website.

let listenZeilen = [];
let listenAuswahl = null;
let listenIndex = -1;
let listenZeilenElemente = [];

// #arbeitsliste kann zwei Kinder tragen: die Reiterleiste (nur wenn
// zeigeUnterreiter benutzt wurde) und den Listenkoerper. Beide werden
// bei Bedarf angelegt, unabhängig davon, in welcher Reihenfolge
// zeigeListe/zeigeUnterreiter/zeigeLeermaske aufgerufen werden -
// reiterleiste() hängt sich immer als erstes Kind ein.
function listenKoerper() {
    let el = document.getElementById('listenkoerper');
    if (!el) {
        el = document.createElement('div');
        el.id = 'listenkoerper';
        document.getElementById('arbeitsliste').append(el);
    }
    return el;
}

// Anders als werkzeugleiste()/listenKoerper() JEDES Mal neu an die
// erste Stelle gehängt, nicht nur bei der Neuanlage: Instandhaltung
// (Aufgabe 7) blendet ihre Werkzeugleiste je nach Unterreiter ein und
// aus - zeigeWerkzeugleiste(false, ...) entfernt das Element dabei
// vollständig (siehe dort). Kommt es später wieder, legt
// werkzeugleiste() ein NEUES Element an und hängt es vor den
// jeweils aktuellen ersten Kind - traf das bislang unverändert
// dagebliebene reiterleiste-Element, sprang die Werkzeugleiste über
// die Reiter, obwohl instandhaltungAufbauen() sie in der Reihenfolge
// Werkzeugleiste-dann-Reiter aufbaut. Im Browser nachgestellt: Reiter
// wechseln, Werkzeugleiste dabei aus- und wieder einblenden lassen -
// Reiter standen danach unter der Werkzeugleiste, nicht mehr darüber.
// Ein insertBefore auf ein bereits eingehängtes Element VERSCHIEBT es
// nur, dupliziert es nicht - deshalb hier ohne Neuanlage-Bedingung.
function reiterleiste() {
    const wurzel = document.getElementById('arbeitsliste');
    let el = document.getElementById('reiterleiste');
    if (!el) {
        el = document.createElement('div');
        el.id = 'reiterleiste';
        el.setAttribute('role', 'tablist');
    }
    wurzel.insertBefore(el, wurzel.firstChild);
    return el;
}

// ===== Werkzeugleiste =====
//
// Aktionen vor der Liste, z. B. "Neu anlegen". Flotte und Stationen
// (Aufgaben 4 und 5) hatten das unabhängig voneinander erfunden -
// flotteWerkzeugleiste/flotteWerkzeugleisteAufbauen und
// stationenWerkzeugleiste/stationenWerkzeugleisteAufbauen, wortgleich
// bis auf den Namen, mit je einer eigenen ID. Der Auftrag gab dafür
// keinen Code vor; zwei Bearbeiter haben unabhängig dasselbe Muster
// gebaut - ein Zeichen, dass es hierher gehört, nicht in jeden Bereich
// einzeln.
//
// Find-or-create auf eine FESTE ID, als erstes Kind von #arbeitsliste
// eingehängt - dieselbe Machart wie listenKoerper() und reiterleiste()
// oben. Genau deshalb braucht dieser Baustein KEINE eigene
// Aufräumlogik beim Bereichswechsel: bereichWechseln() leert
// #arbeitsliste ohnehin per replaceChildren(), bevor der neue Bereich
// aufbaut - das reisst die Werkzeugleiste des VORHERIGEN Bereichs mit
// heraus, wie es listenkoerper/reiterleiste auch trifft. Eine
// bereichseigene ID und ein bereichseigenes Wegräumen (wie es die
// beiden Vorlagen taten) wären nur eine zweite Absicherung für
// denselben Fall gewesen - und eine, die vergessen werden kann, wenn
// der Container aus Versehen außerhalb von #arbeitsliste hängt. Im
// Browser nachgestellt: zwischen Flotte und Stationen hin- und
// hergewechselt, jeweils mit und ohne disposition-Rolle - immer genau
// eine oder gar keine Werkzeugleiste, nie zwei übereinander.
//
// sichtbar: ob die aufrufende Rolle den Knopf überhaupt sehen darf
// (üblicherweise darfRolle(...)). false räumt den Container komplett
// ab, statt ihn leer stehen zu lassen - ein Container ohne Inhalt
// bliebe sonst als schmaler, unerklärter Streifen über der Liste
// stehen (dasselbe Prinzip wie beim Fehlen ganzer Navigationspunkte:
// was man nicht darf, wird nicht angezeigt, nicht ausgegraut).
function werkzeugleiste() {
    let el = document.getElementById('werkzeugleiste');
    if (!el) {
        el = document.createElement('div');
        el.id = 'werkzeugleiste';
        el.className = 'werkzeugleiste';
        const wurzel = document.getElementById('arbeitsliste');
        wurzel.insertBefore(el, wurzel.firstChild);
    }
    el.replaceChildren();
    return el;
}

function zeigeWerkzeugleiste(sichtbar, titel, ausfuehren) {
    if (!sichtbar) {
        document.getElementById('werkzeugleiste')?.remove();
        return;
    }
    const leiste = werkzeugleiste();

    const knopf = document.createElement('button');
    knopf.type = 'button';
    knopf.textContent = titel;
    // knopf-schaffend statt knopf-haupt (Punkt 4 der Gestaltung): jeder
    // einzige Aufruf dieses Bausteins über alle fünf Bereiche legt
    // etwas NEU an - "Neues Rad anlegen", "Neuen Kunden anlegen", "Neue
    // Station anlegen", "Schaden melden" - die Werkzeugleiste hat
    // laut ihrem eigenen Kopf-Kommentar oben ohnehin keinen anderen
    // Zweck. Grün ist hier eindeutig, siehe die ausführlichere
    // Begründung bei der art-Erlaeuterung von zeigeMaske() weiter unten
    // für die Fälle, in denen es das NICHT ist.
    knopf.className = 'knopf-schaffend';
    // Derselbe zentrale Fehlerfang wie bei den Knöpfen aus zeigeMaske()/
    // zeigeLeermaske(): jeder Aufrufer müsste ihn sonst selbst
    // nachbauen.
    knopf.addEventListener('click', async () => {
        knopf.disabled = true;
        try {
            await ausfuehren();
        } catch (fehler) {
            melde(fehler.message, 'schlecht');
        } finally {
            knopf.disabled = false;
        }
    });
    leiste.append(knopf);
}

// ===== Filterleiste (Gestaltungsauftrag, Punkt 2) =====
//
// "Dann ist die UI nicht besonders kreativ, es fehlen oftmals Filter,
// Slider oder andere Bedienelemente" - woertlich der Auftrag. Flotte
// (Status, Radtyp, Station), Kunden (Status) und Instandhaltung (Schwere,
// Alter) hatten das unabhaengig voneinander gebraucht - derselbe Befund
// wie bei der Werkzeugleiste oben (siehe dortiger Kommentar): ein
// Baustein hier statt vier eigene Bauarten. Stationen bekommt BEWUSST
// keinen: zehn Zeilen brauchen keinen Filter, und ein Bedienelement, das
// nichts filtert, ist Zierrat (Auftrag).
//
// Find-or-create auf eine feste id, unmittelbar vor listenKoerper()
// eingehaengt - dieselbe Machart wie kopftafelWurzel()/reiterleiste()/
// werkzeugleiste(), aus demselben Grund: der Streifen soll stabil an
// derselben Stelle stehen, unabhaengig davon, in welcher Reihenfolge ein
// Bereich seine Bausteine aufbaut. Ruft ein Bereich zeigeKopftafel() VOR
// zeigeFilterleiste() auf (wie alle vier Verbraucher es tun), landet die
// Filterleiste dank derselben insertBefore(el, listenKoerper())-Logik
// zwischen Kopftafel und Tabelle - die Kopftafel beschreibt IMMER den
// gesamten Bestand, der Filter schraenkt NUR die Tabelle darunter ein.
function filterleiste() {
    const wurzel = document.getElementById('arbeitsliste');
    let el = document.getElementById('filterleiste');
    if (!el) {
        el = document.createElement('div');
        el.id = 'filterleiste';
        el.className = 'filterleiste';
    }
    wurzel.insertBefore(el, listenKoerper());
    el.replaceChildren();
    return el;
}

// ===== Mehrfachauswahl (Gestaltungsauftrag Bedienelemente, Punkt 2) =====
//
// "Ich kann bei Filter immer nur ein Item aussuchen, brauche aber
// Multiselect" - woertlich der Auftrag, fuer BEIDE Orte, an denen ein
// Auswahlfilter heute steht: hier in der Filterleiste (typ 'auswahl'
// weiter unten) UND im Spaltenkopf (spaltenkopfFilterfeld() weiter
// unten in dieser Datei). EIN Baustein fuer beide, aus demselben Grund
// wie Werkzeugleiste/Filterleiste/Uebersichtsstreifen selbst: zwei
// Orte, die unabhaengig voneinander denselben Umbau brauchten, sind
// bereits der Beleg, dass er hierher gehoert, nicht in einen der beiden
// einzeln.
//
// KEIN <select multiple> (Auftrag: "entscheide und begruende"): ein
// <select multiple> zeichnet seine Optionen IMMER als eine bereits
// aufgeklappte, mehrzeilige Liste - nie als eine geschlossene,
// einzeilige Box. Genau die Einzeiligkeit brauchen aber BEIDE
// Einsatzorte: die Filterleiste reiht mehrere Filter nebeneinander in
// einer Zeile (siehe .filterleiste in style.css), der Spaltenkopf sitzt
// in einer <th> neben Sortier-/Gruppierknopf. Eine mehrzeilige Box an
// beiden Stellen haette die Filterleiste zu einem Rechteck aufgebrochen
// und im Spaltenkopf die Kopfzeile gesprengt - "Weissraum grosszuegig"
// heisst hier grosszuegiger ABSTAND, nicht ein grosser Kasten mitten in
// einer sonst einzeiligen Leiste. Der Preis dafuer (Auftrag: "du
// traegst die Verantwortung fuer Tastatur und aria") wird unten
// eingeloest, aber bewusst KLEIN gehalten: die eigentliche Auswahl
// bleibt echten <input type="checkbox">-Elementen ueberlassen, die der
// Browser bereits selbst tastaturbedienbar (Tab, Leertaste) und
// vorlesbar macht, mit einem per :focus-visible sichtbaren Fokusring
// (global in style.css definiert, keine eigene Regel noetig). Nur das
// Auf-/Zuklappen des Popups ist tatsaechlich selbst geschrieben - und
// folgt dabei demselben, in dieser Datei bereits erprobten Muster wie
// das Profilmenue (Knopf mit aria-expanded, Klick daneben und Escape
// schliessen, siehe "Profilmenue" weiter unten).
//
// EIN WEG ZURUECK ZU "ALLE" (Auftrag, ausdruecklich: "darf nicht
// bedeuten, jeden Haken einzeln zu entfernen"): ein eigener Knopf ganz
// oben im Popup statt einer weiteren Checkbox-Option "Alle" - eine
// Option waere nur EIN Haken unter vielen und muesste sich mit den
// uebrigen exklusiv ausschliessen (ein technischer Sonderfall mehr);
// ein Knopf daneben leert das Set stattdessen in einem einzigen Klick,
// unabhaengig davon, wie viele Haken gerade gesetzt sind.
//
// SICHTBAR OHNE OEFFNEN (Auftrag: "man muss sehen, was ausgewaehlt ist,
// ohne das Feld zu oeffnen... die Werte zu nennen ist besser, solange
// es wenige sind"): der Knopftext selbst nennt die gewaehlten
// Bezeichnungen (bis zu drei), erst darueber hinaus tritt "N
// ausgewaehlt" an ihre Stelle - eine lange Kommaliste waere ab einer
// gewissen Laenge selbst wieder unlesbar.
//
// OFFEN BLEIBEN UEBER EINEN NEUAUFBAU HINWEG: jeder Haken loest ueber
// beiAenderung() einen kompletten Neuaufbau der Filterleiste bzw. der
// Arbeitstabelle aus (dieselbe Funktion, die auch die gefilterten Zeilen
// neu zeichnet) - ohne Gegenmassnahme klappte das Popup nach dem ERSTEN
// Haken sofort wieder zu, weil eine frisch gebaute Mehrfachauswahl immer
// geschlossen startet. offenVorgabe/beiOeffnen/beiSchliessen unten
// reichen den Offen-Zustand deshalb an den JEWEILIGEN Aufrufer weiter,
// der ihn in einer eigenen, den Neuaufbau ueberlebenden Variable haelt
// (spaltenkopfMehrfachOffenFeld bzw. filterleisteMehrfachOffenName weiter
// unten) und beim naechsten Aufbau als offenVorgabe zurueckgibt. Der
// Fokus selbst haengt sich an dasselbe, bereits bestehende
// Wiederfinden-Schema wie der Rest der Tabelle
// (fokusMerken()/fokusWiederherstellen() bzw. das gleichartige Paar fuer
// die Filterleiste weiter unten) - markiere() setzt dafuer NUR die
// data-*-Attribute, die der jeweilige Aufrufer ohnehin schon fuer sein
// eigenes Schema braucht; dieser Baustein kennt keins der beiden Schemata
// selbst.
//
// optionen:    [{ wert, text }] - wie zuvor beim Einfachauswahl-<select>.
// ausgewaehlt: Set<string> der markierten Werte. LEER bedeutet "Alle" -
//              der Ausgangszustand selbst, keine eigene Option dafuer.
// beiAenderung(neueMenge): bekommt das NEUE, VOLLSTAENDIGE Set (nie nur
//              den zuletzt geaenderten Wert) - Filterleiste und
//              Spaltenkopf setzen es unveraendert in ihren jeweiligen
//              Zustand, siehe die beiden Aufrufstellen.
// ariaLabel:   zugaenglicher Name des Auf-/Zuklapp-Knopfs.
// einstellungen.knopfId: optionale id fuer den Knopf, damit ein <label
//              for> aus dem statischen HTML (bzw. hier: aus
//              zeigeFilterleiste()) ihn erreichen kann - Knoepfe sind
//              wie <select>/<input> "labelable elements".
function mehrfachauswahlFeld(optionen, ausgewaehlt, beiAenderung, ariaLabel, einstellungen = {}) {
    const {
        offenVorgabe = false,
        beiOeffnen = () => {},
        beiSchliessen = () => {},
        markiere = () => {},
        knopfId = null
    } = einstellungen;

    const wrapper = document.createElement('div');
    wrapper.className = 'mehrfachauswahl';

    const knopf = document.createElement('button');
    knopf.type = 'button';
    knopf.className = 'mehrfachauswahl-knopf';
    if (knopfId) knopf.id = knopfId;
    if (ausgewaehlt.size > 0) knopf.classList.add('mehrfachauswahl-aktiv');
    knopf.setAttribute('aria-haspopup', 'true');
    knopf.setAttribute('aria-label', ariaLabel);
    markiere(knopf, 'knopf');

    // "Die Werte nennen, solange es wenige sind" (Auftrag) - Reihenfolge
    // wie in optionen, nicht wie in ausgewaehlt (eine Set-Einfuegereihenfolge
    // haette bei jedem Klick eine andere Reihenfolge ergeben, verwirrend
    // fuer denselben Filterzustand). 3 als Schwelle: mehr Namen in einer
    // einzeiligen Knopfbeschriftung waeren selbst nicht mehr auf einen
    // Blick erfassbar - dann sagt eine Anzahl mehr als eine abgeschnittene
    // Aufzaehlung.
    const zusammenfassung = document.createElement('span');
    zusammenfassung.className = 'mehrfachauswahl-zusammenfassung';
    const ausgewaehlteTexte = optionen.filter((o) => ausgewaehlt.has(String(o.wert))).map((o) => o.text);
    zusammenfassung.textContent = ausgewaehlteTexte.length === 0
        ? t('common.all')
        : ausgewaehlteTexte.length <= 3
            ? ausgewaehlteTexte.join(', ')
            : t('common.selectedCount', { n: zahlFormat(ausgewaehlteTexte.length) });
    knopf.append(zusammenfassung);

    const popup = document.createElement('div');
    popup.className = 'mehrfachauswahl-liste';
    popup.setAttribute('role', 'group');
    popup.setAttribute('aria-label', ariaLabel);

    // wrapper.isConnected zuerst geprueft (Fehlerbild aus der Erprobung im
    // Browser, siehe Bericht): ein Haken loest ueber beiAenderung() einen
    // kompletten Neuaufbau der Filterleiste/Tabelle aus (siehe
    // "OFFEN BLEIBEN..." oben) - filterleiste()/zeichneArbeitstabelle()
    // ENTFERNEN dabei per replaceChildren() die ALTE Instanz dieses
    // Popups aus dem DOM, OHNE ihr eigenes schliessen() aufzurufen. Ihr
    // document-Klicklistener bliebe sonst fuer immer registriert (ein
    // echtes Leck) UND schluege bei JEDEM naechsten Klick irgendwo auf der
    // Seite fälschlich zu: e.target läge nie mehr IN der laengst
    // entfernten alten wrapper, "ausserhalb" wäre also immer wahr - das
    // rief beiSchliessen() der ALTEN Instanz auf und loeschte dabei den
    // gemeinsamen Offen-Zustand (spaltenkopfMehrfachOffenFeld /
    // filterleisteMehrfachOffenName) fuer die NEUE, gerade erst
    // aufgebaute und tatsaechlich noch offene Instanz - im Browser
    // nachgestellt: zwei Haken kurz hintereinander gesetzt, das Popup
    // klappte nach dem zweiten Haken unerklaert zu. Eine bereits ersetzte
    // Instanz raeumt sich hier deshalb NUR SELBST ab (ihren eigenen,
    // veralteten Listener entfernen), ohne schliessen()/beiSchliessen()
    // der - moeglicherweise ganz anderen - aktuellen Instanz anzutasten.
    function aussenKlick(e) {
        if (!wrapper.isConnected) {
            document.removeEventListener('click', aussenKlick, true);
            return;
        }
        if (!wrapper.contains(e.target)) schliessen();
    }
    function schliessen() {
        popup.hidden = true;
        knopf.setAttribute('aria-expanded', 'false');
        document.removeEventListener('click', aussenKlick, true);
        beiSchliessen();
    }
    function oeffnen() {
        popup.hidden = false;
        knopf.setAttribute('aria-expanded', 'true');
        document.addEventListener('click', aussenKlick, true);
        beiOeffnen();
    }

    popup.hidden = !offenVorgabe;
    knopf.setAttribute('aria-expanded', String(offenVorgabe));
    if (offenVorgabe) document.addEventListener('click', aussenKlick, true);

    knopf.addEventListener('click', () => { if (popup.hidden) oeffnen(); else schliessen(); });

    // Escape schliesst NUR dieses Popup, nicht zusaetzlich eine im
    // Hintergrund offene Detailmaske - stopPropagation haelt den globalen
    // Escape-Handler (Tastaturbedienung weiter unten) vollstaendig heraus,
    // derselbe Kunstgriff, den dort ein offener <dialog> bereits fuer sich
    // beansprucht (siehe die fruehe "dialog[open]"-Ausnahme dort).
    popup.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        e.stopPropagation();
        schliessen();
        knopf.focus();
    });

    const alleKnopf = document.createElement('button');
    alleKnopf.type = 'button';
    alleKnopf.className = 'mehrfachauswahl-alle';
    alleKnopf.textContent = t('common.all');
    markiere(alleKnopf, 'alle');
    alleKnopf.addEventListener('click', () => { schliessen(); beiAenderung(new Set()); });
    popup.append(alleKnopf);

    for (const option of optionen) {
        const wert = String(option.wert);
        const zeile = document.createElement('label');
        zeile.className = 'mehrfachauswahl-option';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = ausgewaehlt.has(wert);
        markiere(checkbox, `wert:${wert}`);
        checkbox.addEventListener('change', () => {
            const neu = new Set(ausgewaehlt);
            if (checkbox.checked) neu.add(wert); else neu.delete(wert);
            beiAenderung(neu);
        });
        zeile.append(checkbox, document.createTextNode(option.text));
        popup.append(zeile);
    }

    wrapper.append(knopf, popup);
    return wrapper;
}

// Welche Mehrfachauswahl im SPALTENKOPF gerade offen ist (spalte.feld
// oder null) - siehe "OFFEN BLEIBEN UEBER EINEN NEUAUFBAU HINWEG" oben.
// Wie spaltenkopfSortFeld/spaltenkopfGruppe & Co. weiter unten NICHT Teil
// der Signatur-Rueckstellung: eine neue Tabelle (anderer Bereich, anderer
// Unterreiter) hat ohnehin ganz andere Spaltennamen, der Vergleich
// "=== spalte.feld" faellt dort von selbst nie zufaellig positiv aus.
let spaltenkopfMehrfachOffenFeld = null;

// Dasselbe fuer die FILTERLEISTE, ueber f.name statt spalte.feld - siehe
// dieselbe Begruendung. In bereichWechseln() zurueckgesetzt (siehe dort):
// anders als beim Spaltenkopf koennten zwei BEREICHE zufaellig denselben
// Filternamen 'status' fuehren (Flotte UND Kundschaft tun das tatsaechlich
// beide) - ohne Rueckstellung risse ein offenes Statusfilter-Popup aus
// Flotte in die Kundschaft-Filterleiste hinueber.
let filterleisteMehrfachOffenName = null;

// Fokuserhalt fuer die FILTERLEISTE, exakt nach dem Vorbild von
// fokusMerken()/fokusWiederherstellen() weiter unten (siehe deren
// Kopfkommentar) - dort fuer die Spaltenkopf-Tabelle, hier fuer die
// Filterleiste, die aus demselben Grund denselben Bedarf hat: ein Haken
// in der Mehrfachauswahl loest ueber beiAenderung() ein komplettes
// filterleiste()/*Aufbauen() neu, das reisst ohne dieses Paar den
// Tastaturfokus auf <body> zurueck. NUR fuer die Mehrfachauswahl gesetzt
// (siehe markiere() an ihren beiden Aufrufstellen) - die bestehenden
// <select>/<input>-Felder der Filterleiste (Radtyp-losgeloest gibt es
// keine mehr, aber der Schieber in instandhaltung.js bleibt ein <input
// type="range">) trugen diese Attribute nie und verhielten sich schon
// vor dieser Aufgabe so (kein Fokuserhalt) - das zu aendern waere eine
// eigene, hier nicht beauftragte Aufgabe.
function filterleisteFokusMerken() {
    const el = document.activeElement;
    if (!el || !el.dataset || !el.dataset.filterName) return null;
    return { name: el.dataset.filterName, rolle: el.dataset.filterRolle };
}
function filterleisteFokusWiederherstellen(merkmal) {
    if (!merkmal) return;
    document.querySelector(
        `#filterleiste [data-filter-name="${merkmal.name}"][data-filter-rolle="${merkmal.rolle}"]`
    )?.focus();
}

// kennung: dieselbe Absicherung wie bei zeigeKopftafel()/zeigeListe() -
// ein Reiterwechsel, dessen Filterleiste erst nach einem eigenen await
// zurueckkommt, dürfte einen inzwischen überholten Bildschirm nicht mehr
// beschreiben.
//
// sichtbar=false raeumt die Leiste komplett ab statt sie leer stehen zu
// lassen - dasselbe Prinzip wie bei zeigeWerkzeugleiste(false, ...) und
// aus demselben Grund noetig wie dort: Instandhaltung zeigt den Alters-/
// Schwere-Filter NUR im Unterreiter "Offene Schäden", nicht bei
// "Wartungsaufträge" - ohne dieses Abraeumen bliebe die Filterleiste des
// vorherigen Unterreiters als Karteileiche stehen (dieselbe Falle, die
// werkzeugleiste() oben fuer genau diesen Bereich schon einmal gefunden
// hat).
//
// filter: [{ name, titel, typ?, optionen?, wert, beiAenderung(neueMenge),
//            min?, max?, step?, beschriftung? }]
// - typ 'auswahl' (Vorgabe): eine MEHRFACHAUSWAHL (Gestaltungsauftrag,
//   Punkt 2 - siehe mehrfachauswahlFeld() weiter oben fuer die
//   ausfuehrliche Begruendung). wert ist ein Set<string> der markierten
//   Werte (leer = "Alle"), beiAenderung bekommt das neue, vollstaendige
//   Set. optionen [{wert, text}] traegt KEINEN eigenen "Alle"-Eintrag
//   mehr - der Rueckweg ist jetzt ein eigener Knopf im Popup, kein
//   Listeneintrag (siehe dort).
// - typ 'schieber': <input type="range"> zwischen min und max - feuert
//   bei JEDER Mausbewegung ein 'input'-Ereignis; ohne Verzoegerung loeste
//   das bei jedem Pixel einen kompletten Neuaufbau aus. 300ms Verzoegerung,
//   dieselbe Zeitspanne wie die Kundensuche (kunden.js) - danach ERST
//   beiAenderung() aufgerufen, mit dem zuletzt gezogenen Wert.
// - beschriftung(wert) (nur 'schieber'): formatiert den aktuellen Wert
//   fuer die Anzeige NEBEN dem Schieber ("≥ 3 Std." statt der blossen
//   Zahl 3) UND fuer aria-valuetext, damit ein Bildschirmleser dieselbe
//   Einordnung hoert wie ein sehender Blick.
//
// Die Vorgangs-Kennung UND der Schieber zusammen (Auftrag: "der Filter
// muss die Vorgangs-Kennung beachten"): die 300ms-Verzoegerung eines
// Schiebers kann laenger laufen als der Bereich lebt, den er gerade
// filtert - Schieber gezogen, sofort zu einem anderen Bereich (oder
// Unterreiter) gewechselt, BEVOR die 300ms um sind. Ohne Pruefung riefe
// der dann verspaetet feuernde Timer beiAenderung() trotzdem auf - eine
// Funktion, die typischerweise den *Aufbauen()-Vorgang eines Bereichs
// anstoesst, der laengst nicht mehr der aktuelle ist. istAktuellerVorgang()
// faengt genau das ab: kennung aendert sich nur, wenn seitdem ein neuer
// Vorgang begonnen hat (neuer Bereich, neuer Unterreiter, oder derselbe
// Bereich erneut) - dann bleibt der verspaetete Aufruf wortlos aus.
function zeigeFilterleiste(kennung, sichtbar, filter) {
    if (!istAktuellerVorgang(kennung)) return;
    if (!sichtbar || !filter || filter.length === 0) {
        document.getElementById('filterleiste')?.remove();
        return;
    }

    // Fokuserhalt UM das komplette Neuzeichnen der Leiste herum (siehe
    // filterleisteFokusMerken()/-Wiederherstellen() weiter oben): ein Haken
    // in einer Mehrfachauswahl ruft ueber beiAenderung() in JEDEM Aufrufer
    // (flotte.js/kunden.js/instandhaltung.js) sofort wieder *Aufbauen() auf,
    // das wiederum diese Funktion hier von Grund auf neu aufruft - ohne
    // diesen Merker spraenge der Tastaturfokus dabei jedesmal auf <body>
    // zurueck.
    const fokusMerkmal = filterleisteFokusMerken();

    const leiste = filterleiste();
    for (const f of filter) {
        const feld = document.createElement('div');
        feld.className = 'filterfeld';

        const label = document.createElement('label');
        label.textContent = f.titel;
        label.htmlFor = `filter-${f.name}`;
        feld.append(label);

        if (f.typ === 'schieber') {
            const anzeige = document.createElement('span');
            anzeige.className = 'filterfeld-wert';
            const beschriften = (wert) => (f.beschriftung ? f.beschriftung(wert) : String(wert));
            anzeige.textContent = beschriften(f.wert);

            const eingabe = document.createElement('input');
            eingabe.type = 'range';
            eingabe.id = `filter-${f.name}`;
            eingabe.min = f.min;
            eingabe.max = f.max;
            eingabe.step = f.step ?? 1;
            eingabe.value = f.wert;
            eingabe.setAttribute('aria-valuetext', beschriften(f.wert));

            let verzoegerung = null;
            eingabe.addEventListener('input', () => {
                const wert = Number(eingabe.value);
                const text = beschriften(wert);
                anzeige.textContent = text;
                eingabe.setAttribute('aria-valuetext', text);
                clearTimeout(verzoegerung);
                verzoegerung = setTimeout(() => {
                    if (!istAktuellerVorgang(kennung)) return;   // siehe Kommentar oben
                    f.beiAenderung(wert);
                }, 300);
            });

            const schieberZeile = document.createElement('div');
            schieberZeile.className = 'filterfeld-schieber';
            schieberZeile.append(eingabe, anzeige);
            feld.append(schieberZeile);
        } else {
            // 'auswahl' (Vorgabe) - siehe mehrfachauswahlFeld() weiter
            // oben fuer die ausfuehrliche Begruendung des Bausteins.
            // knopfId haengt das <label for> von oben an den eigentlichen
            // Auf-/Zuklapp-KNOPF, nicht an den umschliessenden <div>
            // (der nicht "labelable" waere) - <button> ist wie <select>
            // ein zulaessiges Ziel fuer label.htmlFor.
            const feldElement = mehrfachauswahlFeld(
                f.optionen, f.wert,
                (neu) => { if (!istAktuellerVorgang(kennung)) return; f.beiAenderung(neu); },
                f.titel,
                {
                    knopfId: `filter-${f.name}`,
                    offenVorgabe: filterleisteMehrfachOffenName === f.name,
                    beiOeffnen: () => { filterleisteMehrfachOffenName = f.name; },
                    beiSchliessen: () => {
                        if (filterleisteMehrfachOffenName === f.name) filterleisteMehrfachOffenName = null;
                    },
                    markiere: (el, rolle) => {
                        el.dataset.filterName = f.name;
                        el.dataset.filterRolle = `mehrfach:${rolle}`;
                    }
                }
            );
            feld.append(feldElement);
        }

        leiste.append(feld);
    }

    filterleisteFokusWiederherstellen(fokusMerkmal);
}

// ===== Kachel (nur noch fuer den Drill-Down in der Detailmaske) =====
//
// WAR das Muster des Kopfbereichs (vier bis fuenf Kacheln nebeneinander
// ueber jeder Liste, ueber #uebersichtsstreifen eingehaengt). Dieses
// Kachelband ist ersatzlos entfallen - siehe die ausfuehrliche
// Begruendung bei zeigeKopftafel() weiter unten, das es in allen fuenf
// Bereichen abgeloest hat.
//
// baueKachel() SELBST bleibt, weil es einen zweiten, davon unabhaengigen
// Verwender hat: monatsdrilldownEinfuegen() in auswertungen.js zeigt
// Min/Max/Summe/Spitzentag eines angeklickten Monats in einem 2x2-Raster
// IN DER DETAILMASKE. Dort ist die Kachel richtig - es sind vier
// Einzelwerte zu genau einem Monat, keine Gliederung eines Bestands, und
// die Detailmaske ist zu schmal fuer eine Tafel. Die Kritik am
// Kachelband galt dem KOPFBEREICH, nicht der Form an sich.

// Vier Einzelwerte zu EINEM angeklickten Monat (Min, Max, Anzahl pro
// Monat, Tag mit den meisten Fahrten), in einem 2x2-Raster in der
// Detailmaske - siehe monatsdrilldownEinfuegen() in auswertungen.js.
// Bleibt hier in rahmen.js und nicht dort: die Kachel ist eine
// allgemeine Form, kein auswertungseigenes Bauteil.
function baueKachel(kachel) {
    const feld = document.createElement('div');
    feld.className = 'uebersichtskachel';

    const titel = document.createElement('div');
    titel.className = 'uebersichtskachel-titel';
    titel.textContent = kachel.titel;
    feld.append(titel);

    // IMMER angelegt, auch ohne kachel.veraenderung (Gestaltungsauftrag,
    // "gemeinsames Raster"-Befund): fehlte dieses Element ganz, rueckte die
    // mittlere Zeile (Zahl+Grafik) einer Kachel OHNE Veraenderung ein
    // Stueck naeher an den Titel heran als bei ihren Nachbarn MIT
    // Veraenderung - eine Kachelreihe faellt dann schon in der Vertikalen
    // auseinander, bevor ueberhaupt jemand auf Grafik oder Zahl schaut
    // (genau der Befund: "Umsatz je Rad und Tag"/"Auffällig" in
    // umsatzRadtypUebersicht() bauen je nach Datenlage unterschiedlich
    // viele dieser drei Zeilen). CSS reserviert dafuer eine feste
    // Mindesthoehe auf .uebersichtskachel-veraenderung (siehe style.css) -
    // eine leere Zeile bleibt damit leer, aber PLATZHALTEND, statt gar
    // nicht zu existieren. KEIN Platzhaltertext hinein (kein "-" o. Ä.):
    // das waere eine erfundene Aussage ueber einen Vormonat, den es
    // fachlich gar nicht gibt (siehe Kopfkommentar bei zeigeUebersicht()
    // weiter oben, warum veraenderung bewusst optional bleibt).
    const veraenderung = document.createElement('div');
    veraenderung.className = 'uebersichtskachel-veraenderung';
    if (kachel.veraenderung) veraenderung.append(kachel.veraenderung);
    feld.append(veraenderung);

    const zeile = document.createElement('div');
    zeile.className = 'uebersichtskachel-zeile';
    const wert = document.createElement('div');
    wert.className = 'uebersichtskachel-wert';
    wert.append(kachel.wert);
    zeile.append(wert);
    if (kachel.grafik) zeile.append(kachel.grafik);
    feld.append(zeile);

    if (kachel.hinweis) {
        const hinweis = document.createElement('div');
        hinweis.className = 'uebersichtskachel-hinweis';
        hinweis.textContent = kachel.hinweis;
        feld.append(hinweis);
    }

    return feld;
}

// ===== Hinweisfenster (Gestaltungsauftrag Kopftafel, Punkt 2) =====
//
// "Es gibt kein Mouse-on-over" - woertlich der Befund, und doch FALSCH:
// es gibt eins, als natives SVG-<title> bzw. HTML-title-Attribut an
// jeder Grafik dieser Tafel (siehe zellbalken()/strukturBalken()/
// abweichungsBalken()/saeulenSparkline()/lagepunkt() weiter unten, VOR
// dieser Aenderung). Der Auftraggeber hat es schlicht nicht bemerkt -
// aus gutem Grund: ein natives <title> erscheint erst nach rund einer
// Sekunde Verharren, in der Darstellung des BETRIEBSSYSTEMS (nicht der
// Seite), oft in der Naehe des Zeigers statt am Element - fuer "die
// Daten muessen sich intuitiv ablesen lassen" schlicht zu unauffaellig.
// Ein zweiter, unabhaengiger Mangel kommt hinzu: <title> reagiert NUR
// auf :hover, nie auf Tastaturfokus - fuer jemanden, der die Tafel per
// Tastatur bedient, existiert die Beschriftung dann ueberhaupt nicht.
//
// EIN gemeinsames DOM-Element fuer die GANZE Oberflaeche statt eines
// eigenen pro Balken/Saeule/Segment: zur selben Zeit ist ohnehin nie
// mehr als eine Beschriftung sichtbar (Maus und Tastaturfokus zeigen
// beide auf genau eine Stelle), ein wiederverwendetes Element erspart
// einer Tafel mit 13 Zeilen mal vier Grafikspalten hunderte nie
// gebrauchte <div>s.
let hinweisfensterElement = null;

function hinweisfensterHolen() {
    if (hinweisfensterElement) return hinweisfensterElement;
    const el = document.createElement('div');
    el.className = 'hinweisfenster';
    // role="presentation": der Text steht bereits als aria-label/als
    // Element-eigenes title-Attribut am Ausloeser (siehe
    // hinweisfensterVerknuepfen() unten) - ein Bildschirmleser hat ihn
    // damit schon, eine zweite Vorlesung desselben Inhalts ueber dieses
    // <div> waere Laerm, kein Zugewinn.
    el.setAttribute('role', 'presentation');
    el.hidden = true;
    document.body.append(el);
    hinweisfensterElement = el;
    return el;
}

// ankerRechteck: das getBoundingClientRect() des Ausloesers, nicht die
// Zeigerposition - der Ausloeser selbst bewegt sich nicht (anders als
// eine Drag-Operation), das Fenster darf deshalb an EINER berechneten
// Stelle stehen bleiben, statt bei jeder Mausbewegung neu zu rechnen.
// lage: 'oben' (Vorgabe, jede Grafik der Kopftafel) oder 'rechts' (die
// Rubriken der eingeklappten Navigation, siehe
// navigationRubrikVerdrahten() weiter unten). Eine senkrechte Leiste
// braucht die zweite Lage zwingend: ihre Eintraege liegen uebereinander,
// ein Fenster UEBER einer Rubrik verdeckte die Rubrik darueber - also
// genau das Element, das man als naechstes ansehen will.
function hinweisfensterZeigen(text, ankerRechteck, lage = 'oben') {
    if (!text) return;
    const el = hinweisfensterHolen();
    el.textContent = text;
    el.hidden = false;

    // ERST NACH dem Einblenden messen - offsetWidth/-Height sind an
    // einem hidden-Element immer 0.
    const breite = el.offsetWidth;
    const hoehe = el.offsetHeight;
    const luft = 8;

    if (lage === 'rechts') {
        // Senkrecht auf die Mitte des Ankers, waagerecht daneben. Beide
        // Achsen wie unten gegen das sichtbare Fenster geklemmt: eine
        // Rubrik ganz unten in der Leiste soll ihr Fenster nicht unter
        // die Statuszeile schieben.
        let ox = ankerRechteck.right + luft;
        if (ox + breite > window.innerWidth - luft) ox = ankerRechteck.left - breite - luft;
        let oy = ankerRechteck.top + ankerRechteck.height / 2 - hoehe / 2;
        oy = Math.max(luft, Math.min(oy, window.innerHeight - hoehe - luft));
        el.style.left = `${Math.max(luft, ox)}px`;
        el.style.top = `${oy}px`;
        return;
    }

    // Vorgabe: mittig UEBER dem Anker. GESTALTUNGSAUFTRAG, erster
    // Stolperstein, woertlich genannt: "ein Hinweisfenster, das am Rand
    // aus dem Bild laeuft" - die Kopftafel-Grafiken der LETZTEN Spalte
    // stehen ganz rechts im Fenster, ein mittig zentriertes Fenster
    // ragte dort ueber den rechten Bildschirmrand hinaus. Deshalb an
    // BEIDEN Raendern gegen das sichtbare Fenster geklemmt (nicht gegen
    // die Tafel - die darf in sich scrollen, siehe .kopftafel in
    // style.css, und bliebe dabei trotzdem im Fenster).
    let x = ankerRechteck.left + ankerRechteck.width / 2 - breite / 2;
    x = Math.max(luft, Math.min(x, window.innerWidth - breite - luft));

    let y = ankerRechteck.top - hoehe - luft;
    // Passt es oben nicht hin (die Kopftafel klebt am oberen
    // Fensterrand, z. B. direkt nach dem Ausklappen), erscheint es
    // stattdessen UNTER dem Anker statt teilweise unsichtbar darueber.
    if (y < luft) y = ankerRechteck.bottom + luft;

    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
}

function hinweisfensterVerstecken() {
    if (hinweisfensterElement) hinweisfensterElement.hidden = true;
}

// Bindet Maus UND Tastaturfokus an EIN Element mit EINEM Text - der
// Regelfall bei einer Grafik, die insgesamt EINEN Wert zeigt
// (zellbalken/abweichungsBalken/lagepunkt) oder bei der ZUSAMMENFASSUNG
// einer mehrteiligen Grafik (das <svg> von strukturBalken()/
// saeulenSparkline() selbst, zusaetzlich zu den Teilen - siehe
// hinweisfensterTeilVerknuepfen() unten).
//
// focus/blur decken GENAU den zweiten Mangel des nativen <title> ab
// (siehe Kopfkommentar oben): "was nur die Maus erreicht, ist fuer
// einen Teil der Nutzer nicht da" (Auftrag, woertlich) - jemand, der
// mit Tab zu dieser Grafik springt, sieht dieselbe Beschriftung, ohne
// je eine Maus zu beruehren.
function hinweisfensterVerknuepfen(ziel, text) {
    ziel.addEventListener('mouseenter', () => hinweisfensterZeigen(text, ziel.getBoundingClientRect()));
    ziel.addEventListener('mouseleave', hinweisfensterVerstecken);
    ziel.addEventListener('focus', () => hinweisfensterZeigen(text, ziel.getBoundingClientRect()));
    ziel.addEventListener('blur', hinweisfensterVerstecken);
}

// Fuer EINEN Teil einer mehrteiligen Grafik (eine Saeule von zwoelf, ein
// Abschnitt eines Strukturbalkens) - GESTALTUNGSAUFTRAG, woertlich: "bei
// mehrteiligen Grafiken je Teil". Bewusst OHNE eigenes mouseleave: das
// Verstecken bleibt dem umschliessenden <svg> ueberlassen (siehe
// hinweisfensterVerknuepfen() oben, dort dafuer aufgerufen) - sonst
// risse ein kurzes mouseleave beim Wechsel von einer Saeule zur naechsten
// das Fenster bei jedem Uebergang auf und wieder zu, obwohl der Zeiger
// die Grafik nie tatsaechlich verlassen hat. Kein eigenes focus/blur:
// einzelne <rect>-Teile bekommen bewusst KEIN tabindex (dieselbe
// Begruendung wie beim <title> je <rect>, das saeulenSparkline() aus
// genau diesem Grund nie einzeln fuer Bildschirmleser oeffnete - ein
// Bildschirmleser bekommt die vollstaendige Aufzaehlung stattdessen
// gebuendelt ueber das aria-label des ganzen <svg>) - fuer Tastaturfokus
// gilt deshalb hier dieselbe EINE Zusammenfassung wie fuer einen
// Bildschirmleser, nicht ein Tabstopp je Teil.
function hinweisfensterTeilVerknuepfen(teil, text) {
    teil.addEventListener('mouseenter', () => hinweisfensterZeigen(text, teil.getBoundingClientRect()));
}

// ZWEITER Stolperstein aus dem Gestaltungsauftrag, woertlich: "ein
// Fenster, das haengenbleibt, wenn der Zeiger die Tafel schnell
// verlaesst oder die Tafel eingeklappt wird". Ein Einklappen (siehe
// kopftafelUmschalterKnopf() weiter unten) und ein Neuaufbau der Tafel
// (siehe kopftafelWurzel() weiter unten) entfernen bzw. verbergen ihre
// Grafiken PROGRAMMATISCH, nicht durch eine tatsaechliche
// Mausbewegung - kein mouseleave feuert dabei, und ein zu diesem
// Zeitpunkt offenes Fenster bliebe offen und zeigte auf ein Element, das
// es nicht mehr gibt oder nicht mehr sichtbar ist. Ein Scroll-Ereignis auf dem
// GESAMTEN Fenster (capture:true, damit auch das eigene overflow-x:auto
// der Kopftafel erfasst wird - siehe .kopftafel in style.css) ist die
// dritte, allgemeine Absicherung: ein verschobener Anker ohne
// nachgefuehrte Fensterposition waere sonst ploetzlich neben, statt auf
// dem Element, das es beschriftet.
window.addEventListener('scroll', hinweisfensterVerstecken, true);

// ===== Zeichenbausteine: Säulen-Sparkline (Bissantz) und Zellbalken =====
//
// Beide als selbst gezeichnetes Inline-SVG, ohne Diagrammbibliothek und
// ohne CDN - harte Grenze dieses Projekts (siehe Dateikopf). Beide bauen
// ihr <svg> über createElementNS(), nicht über innerHTML: die Werte
// kommen zwar aus v_wawi_-Sichten und nicht von einer Nutzereingabe, aber
// ein zweiter, innerHTML-basierter Weg neben dem createElement-Weg, den
// der Rest dieser Datei sonst überall verwendet, wäre eine unnötige
// zweite Bauart für dasselbe Ergebnis.
const SVG_NS = 'http://www.w3.org/2000/svg';

// ===== RANG 4 DER FARBORDNUNG: ZUGEHÖRIGKEIT =====
//
// Welche Kategorie welchen Ton trägt - an EINER Stelle, für alle neun
// Tafeln. Die Töne selbst und ihre Begründung stehen in der Farbordnung
// in style.css (fünf Töne gleicher Helligkeit, unterschieden am
// Farbton, jeder über 4,45:1 gegen jeden Untergrund); WELCHER Code
// welchen bekommt, ist dagegen eine Frage der Fachdaten und gehört
// deshalb hierher.
//
// DER ZWECK IST WIEDERERKENNUNG ÜBER BEREICHE HINWEG. Das City-Bike
// trägt dasselbe Blau in der Flotte (vier Modellzeilen unter einer
// Gruppenzeile), im Umsatz nach Radtyp und in der Wegstrecke - drei
// Tafeln, drei Fragen, eine Farbe. Ohne diese Tabelle vergäbe jeder
// Bereich seine Töne für sich, und derselbe Radtyp sähe dreimal
// verschieden aus.
//
// DIE ZUORDNUNG IST FEST, NICHT NACH REIHENFOLGE VERGEBEN. Eine
// Vergabe "erste Zeile bekommt kat-1" wäre bequem, aber die Zeilen sind
// nach Grösse sortiert - eine Umbuchung, die das Cargo-Rad am E-Bike
// vorbeiziehen lässt, tauschte dann still die Farben, und wer die Tafel
// von gestern im Kopf hat, läse sie falsch.
//
// UNBEKANNTER CODE => null, und der Aufrufer nimmt --marine (Rang 5,
// neutral). Kein Reihum-Vergeben eines der fünf Töne an einen sechsten
// Code: eine Farbe, die nur deshalb da ist, weil eine Liste länger
// wurde, nennt keine Bedeutung - und genau das war der Fehler, den
// diese Ordnung beheben soll.
const KATEGORIE_FARBE = {
    // Radtypen (velocity.fahrradtyp.typ_code)
    CITY:    'var(--kat-1)',   // Blau    - der Bestandsträger, 198 von 275 Rädern
    EBIKE:   'var(--kat-3)',   // Petrol
    CARGO:   'var(--kat-2)',   // Violett
    // Tarifgruppen (velocity.tarif.tarif_code)
    BASIS:   'var(--kat-1)',
    STUDENT: 'var(--kat-3)',
    OEPNV:   'var(--kat-2)',
    PREMIUM: 'var(--kat-4)',
    // "Ohne Tarif" ist keine Tarifgruppe, sondern ihr Fehlen - deshalb
    // der Schieferton, der sich von den vier bunten Gruppen absetzt,
    // ohne selbst eine Gruppe zu behaupten.
    OHNE:    'var(--kat-5)'
};

function kategorieFarbe(code) {
    return KATEGORIE_FARBE[code] || null;
}

// GESTALTUNGSAUFTRAG, PUNKT 2, wörtlich: "Die Sparklines in dem
// Kopfbereich sind sinnlos, weil nicht verständlich, was sagen diese
// aus? Wir machen statt einer Linie Säulen als Sparklines." Diese
// Funktion ersetzt die frühere sparkline() (eine Polylinie mit einem
// Punkt am Ende) an JEDER ihrer neun Aufrufstellen (auswertungen.js,
// stationen.js) - es gibt im heutigen Bestand keine Reihe, für die eine
// LINIE (die einen KONTINUIERLICHEN Zwischenverlauf suggeriert) noch die
// richtige Aussage wäre: jeder Wert ist eine diskrete, abgeschlossene
// Kategorie (ein Monat, ein Tag, eine Station), keine Messung entlang
// einer stetigen Größe. Deshalb ist sparkline() ersatzlos entfernt, nicht
// nur ergänzt - eine zweite, kaum noch gebrauchte Bauart für praktisch
// denselben Zweck wäre selbst wieder der Befund, den die Werkzeugleiste/
// Filterleiste/Übersichtsstreifen-Bausteine weiter oben schon einmal
// beseitigt haben (siehe deren Kopfkommentare).
//
// werte: Zahlen in Anzeigereihenfolge - meist Monate/Tage, aber ebenso
// gültig über eine andere Achse (stationsauslastungZeigen() in
// auswertungen.js: der Füllstand bzw. Saldo der zehn Stationen statt
// Monate - "small multiples" heißt bei Tufte eine Reihe vergleichbarer
// Werte, nicht zwingend eine Zeitreihe).
//
// beschriftung ist HIER, anders als bei der früheren sparkline(), KEIN
// optionaler Schlüssel in optionen, sondern ein eigenes, PFLICHTIGES
// Funktionsargument: der zweite Teil desselben Auftragssatzes ("jede muss
// beschriftet sein - welcher Zeitraum, welche Größe, und wo der aktuelle
// Wert darin liegt") ist keine Empfehlung, die ein Aufrufer vergessen
// könnte, sondern die eigentliche Beanstandung. Ein struktureller Zwang
// (die Funktion lässt sich ohne dieses Argument gar nicht sinnvoll
// aufrufen) hält das zuverlässiger fest als ein Kommentar, der nur
// empfiehlt, es zu setzen.
//
// optionen.aktuellIndex (Vorgabe: die letzte Säule, siehe unten): DIE
// Säule, die den GEGENWÄRTIGEN Zeitraum trägt, farblich abgesetzt
// (--marine, kräftig) gegen die helleren, vergangenen Säulen
// (--skala-rahmen, derselbe schon gemessene Grauton wie der Balkenrahmen
// unten - kein neuer, ungemessener Farbwert nur für dieses eine Bauteil).
// "letzte Säule deutlich dunkler" (Vorbild-Auftrag) gilt NUR, wo es
// tatsächlich einen "aktuellen" Zeitraum gibt - bei den stationsbasierten
// Reihen (siehe oben) hat "die letzte Station" keine solche Bedeutung,
// dort bleibt aktuellIndex bewusst null (keine Säule dunkler als die
// anderen) UND das aufrufende Kachel-Objekt lässt kachel.veraenderung
// weg (siehe baueKachel() weiter oben) - eine "Veränderung gegenüber der
// letzten Station" wäre sinnlos, wo keine Zeitachse existiert.
// null unterdrückt die Hervorhebung ausdrücklich (nicht nur Vorgabewert
// weglassen, siehe die Prüfung unten): -1 oder eine andere ungültige
// Zahl träfe ohnehin keinen Index und hätte denselben Effekt, aber ein
// eigener null-Zweig macht die Absicht ausdrücklich statt sich auf einen
// Zufallstreffer zu verlassen.
//
// optionen.markierIndizes: wie zuvor bei sparkline()s markierIndex, aber
// als Array (wie bei saeulengrafik() weiter unten: zwei Extremwerte
// können gleich hoch sein) - hebt in --rot hervor, "hier hinsehen"
// (Tarifwechsel, Minimum), nicht "aktuell" und nicht "schlecht". Kann mit
// aktuellIndex zusammenfallen (der jüngste Monat IST zugleich der
// Tiefpunkt) - dann gewinnt --rot: es ist die spezifischere Aussage
// ("das hier ist bemerkenswert"), "aktuell" ist demgegenüber nur die
// Grundbedeutung jeder Reihe mit Zeitachse.
// GESTALTUNGSAUFTRAG, wörtlich: "Sparklines sind sehr winzig und nutzen
// den Platz nicht ideal." Gemessen im Browser (vorher, siehe Bericht): bei
// den bisherigen Vorgaben (breite 72, hoehe 26) blieb zwischen der 72px
// breiten Grafik und der rechts stehenden Zahl bei einer mehrere hundert
// Pixel breiten Kachel eine leere Flaeche von oft über 150px - kein
// Weissraum (der TRENNT bewusst), sondern ungenutzter Platz, weil zwei
// Elemente lediglich an ihre jeweiligen Raender gedrueckt wurden. breite/
// hoehe sind deshalb mehr als verdoppelt (168/44 statt 72/26) UND das
// <svg> bekommt zusaetzlich preserveAspectRatio="none": ohne dieses
// Attribut wuerde ein SVG, dessen tatsaechliche Kachelbreite (per CSS,
// siehe .saeulensparkline in style.css) von seinem viewBox-Seitenverhaeltnis
// abweicht, mittig eingepasst UND liesse oben/unten oder links/rechts
// wieder Leerraum entstehen (genau der Effekt, den dieser Auftrag
// beseitigen soll) - "none" streckt stattdessen auf die volle, von CSS
// zugewiesene Flaeche. Das verzerrt bei einer reinen Rechteck-Grafik ohne
// diagonale Linien nichts an der WERTAUSSAGE (jede Saeule bleibt exakt so
// hoch, wie ihr Anteil an [minimum, maximum] es verlangt - nur die
// Spaltenbreite variiert mit der tatsaechlichen Kachelbreite, was bei
// zwoelf gleich breiten Saeulen ohnehin gewollt ist).
function saeulenSparkline(werte, beschriftung, optionen = {}) {
    const { breite = 168, hoehe = 44 } = optionen;
    const markierIndizes = optionen.markierIndizes || [];
    // Vorgabe: die letzte Säule ist "aktuell" - der Regelfall bei einer
    // absteigend chronologischen bzw. aufsteigend bis heute laufenden
    // Reihe (jede Aufrufstelle in auswertungen.js). optionen.aktuellIndex
    // === null (ausdrücklich, siehe Kommentar oben) schaltet das ab.
    const aktuellIndex = optionen.aktuellIndex === null
        ? null : (optionen.aktuellIndex ?? (werte ? werte.length - 1 : null));

    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${breite} ${hoehe}`);
    svg.setAttribute('width', breite);
    svg.setAttribute('height', hoehe);
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.classList.add('saeulensparkline');
    // role="img" bedingungslos, nicht wie zuvor bei sparkline() nur bei
    // gesetzter beschriftung: beschriftung ist jetzt Pflicht (siehe oben),
    // der bedingte Zweig entfiele ohnehin auf immer denselben Fall.
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', beschriftung);

    const werteBereinigt = (werte || []).map((w) => w || 0);
    if (werteBereinigt.length === 0) return svg;   // nichts zu zeichnen, aber ein gültiges <svg>

    // GESTALTUNGSAUFTRAG PUNKT 4, woertlich: "eine Saeulenreihe zwoelf
    // Saeulen" - je Teil, nicht nur eine Zusammenfassung fuer die ganze
    // Reihe. optionen.titelJeIndex(i, wert) ist optional (siehe
    // kopftafelZeile() in rahmen.js: nicht jeder der sieben Aufrufer
    // liefert sie mit) - WENN sie vorliegt, haengt sie hier VOLLSTAENDIG
    // an die aria-label an, statt nur als Hinweisfenster pro Saeule zu
    // erscheinen: das macht die Reihe fuer einen Bildschirmleser lesbar,
    // OHNE dass er zwoelf einzelne, gar nicht fokussierbare <rect>
    // nacheinander anfahren muesste (ein <svg role="img"> fasst seinen
    // gesamten Inhalt fuer Assistenztechnik zu EINEM Blatt zusammen).
    // Der Mouse-over kommt trotzdem zusaetzlich JE SAEULE (unten in der
    // forEach-Schleife, ueber hinweisfensterTeilVerknuepfen()) - fuer
    // sehende Maus-Nutzer schneller abzulesen als die ganze Aufzaehlung.
    if (typeof optionen.titelJeIndex === 'function') {
        const aufzaehlung = werteBereinigt.map((w, i) => optionen.titelJeIndex(i, w)).join(', ');
        svg.setAttribute('aria-label', `${beschriftung}. ${aufzaehlung}`);
    }

    // Tastaturfokus auf dem GANZEN <svg>, nicht je Saeule (siehe die
    // Begruendung bei hinweisfensterTeilVerknuepfen() oben) - dieselbe
    // vollstaendige aria-label-Aufzaehlung, die ein Bildschirmleser
    // bekommt, erscheint hier zusaetzlich sichtbar als Hinweisfenster.
    svg.tabIndex = 0;
    hinweisfensterVerknuepfen(svg, svg.getAttribute('aria-label'));

    // Nulllinie ist PFLICHT (Auftrag, ausdrücklich - dieselbe Regel wie
    // bei saeulengrafik() weiter unten) - UND MUSS AUCH BEI NEGATIVEN
    // WERTEN STIMMEN: ein Saldo (stationsauslastungUebersicht() in
    // auswertungen.js: "gibt mehr Räder ab, als sie bekommt") kann
    // negativ sein, anders als jede der übrigen Reihen dieser Funktion
    // (Umsatz, Fahrten, Kilometer, Füllstand - nie unter 0). Ein einfacher
    // "Höhe ab der Grundlinie unten"-Balken wie bei saeulengrafik() würde
    // eine negative Säule entweder unsichtbar (Höhe auf 0 gekappt) oder
    // unterhalb des sichtbaren viewBox zeichnen - beides ist stumm falsch,
    // nicht bloß unschön. Die Nulllinie liegt deshalb IMMER am tatsächlichen
    // Wert 0 im Bereich [minimum, maximum], nicht pauschal am unteren
    // Rand: bei einer durchgehend nichtnegativen Reihe (der Regelfall)
    // liegt minimum bei 0 und die Nulllinie damit ohnehin unten - optisch
    // unverändert gegenüber einer reinen "ab der Grundlinie"-Zeichnung -,
    // bei einer Reihe mit negativen Werten liegt sie mittendrin, positive
    // Säulen wachsen nach oben, negative nach unten.
    // optionen.minimum/maximum: eine von AUSSEN vorgegebene, GEMEINSAME
    // Skala - der Fall "small multiples" (Tufte), bei dem mehrere Reihen
    // untereinander stehen und nur dann vergleichbar sind, wenn sie
    // dieselbe Achse teilen. kopftafel() weiter unten ermittelt diese
    // Grenzen einmal ueber alle Zeilen und reicht sie durch; ohne sie
    // skalierte jede Reihe auf ihr eigenes Maximum, zehn Stationen mit
    // voellig verschiedenem Verkehr saehen gleich hoch aus, und die
    // Kleingrafik waere genau das Ornament, das dieser Auftrag ruegt.
    // Math.min/max mit 0 bleibt AUCH hier: die Nulllinie ist Pflicht
    // (siehe oben), eine von aussen gesetzte Untergrenze ueber 0 wuerde
    // die Saeulen auf einen erfundenen Sockel stellen.
    const minimum = Math.min(0, optionen.minimum ?? 0, ...werteBereinigt);
    const maximum = Math.max(0, optionen.maximum ?? 0, ...werteBereinigt);
    const spanne = (maximum - minimum) || 1;   // alle Werte 0: keine Division durch 0
    const anzahl = werteBereinigt.length;
    const abstand = breite / anzahl;
    const saeulenbreite = Math.max(0.5, abstand - 1.2);
    // 1px Luft oben UND unten, dieselbe Überlegung wie bei saeulengrafik().
    const yVon = (wert) => (hoehe - 1) - ((wert - minimum) / spanne) * (hoehe - 2) + 0.5;
    const nullY = yVon(0);

    // Sichtbare Nulllinie NUR, wenn sie nicht ohnehin mit dem unteren
    // Rand zusammenfällt (minimum < 0, siehe oben) - bei einer rein
    // nichtnegativen Reihe läge sie exakt auf der Kontur des <svg> und
    // wäre dort ununterscheidbar vom Rand selbst, eine zusätzliche Linie
    // dann reine Redundanz.
    if (minimum < 0) {
        const grundlinie = document.createElementNS(SVG_NS, 'line');
        grundlinie.setAttribute('x1', 0);
        grundlinie.setAttribute('x2', breite);
        grundlinie.setAttribute('y1', nullY.toFixed(1));
        grundlinie.setAttribute('y2', nullY.toFixed(1));
        grundlinie.setAttribute('class', 'saeulensparkline-grundlinie');
        svg.append(grundlinie);
    }

    werteBereinigt.forEach((wert, i) => {
        const wertY = yVon(wert);
        const rect = document.createElementNS(SVG_NS, 'rect');
        rect.setAttribute('x', (i * abstand).toFixed(1));
        rect.setAttribute('y', Math.min(nullY, wertY).toFixed(1));
        rect.setAttribute('width', saeulenbreite.toFixed(1));
        rect.setAttribute('height', Math.abs(wertY - nullY).toFixed(1));
        const klassen = ['saeulensparkline-saeule'];
        if (markierIndizes.includes(i)) klassen.push('saeulensparkline-saeule-markiert');
        else if (i === aktuellIndex) klassen.push('saeulensparkline-saeule-aktuell');
        rect.setAttribute('class', klassen.join(' '));
        if (typeof optionen.titelJeIndex === 'function') {
            hinweisfensterTeilVerknuepfen(rect, optionen.titelJeIndex(i, wert));
        }
        svg.append(rect);
    });

    return svg;
}

// wert/maximum: derselbe Maßstab für JEDE Zeile einer Spalte (Bissantz:
// "an einer gemeinsamen Skala ausgerichtet") - der Aufrufer ermittelt
// maximum EINMAL über alle sichtbaren Zeilen, nicht je Zeile neu (sonst
// wäre der längste Balken in jeder Zeile gleich lang und der Vergleich
// zwischen Zeilen sinnlos).
//
// textInhalt: der bereits formatierte Zellentext (String oder, für eine
// typografisch skalierte Zahl, ein von zahlSkaliert() gebautes Element) -
// der Balken ERSETZT den Text nicht, er steht daneben. Eine Zahl, die man
// nur noch als Balken sähe, wäre für einen Bildschirmleser bedeutungslos
// und für einen späteren Exportzweck unbrauchbar. null/undefined lässt
// die Textspanne weg - für eine reine Anteilsgrafik in einer
// Übersichtskachel (siehe umsatzKundengruppeUebersicht() in
// auswertungen.js), wo die Zahl bereits als eigener Kachelwert daneben
// steht und nicht doppelt erscheinen soll.
//
// In einer TABELLENSPALTE dagegen (mehrere Zeilen untereinander) NICHT
// direkt mit textInhalt aufrufen - siehe balkenSpalten() weiter unten,
// das genau diesen Fall (Balken und Betrag als gemeinsame, rechtsbündige
// Gruppe in EINER Zelle) durch zwei getrennte Spalten ersetzt hat, weil
// unterschiedlich breite Beträge sonst die Nulllinie des Balkens von
// Zeile zu Zeile verschieben (Gestaltungsauftrag, Punkt 5).
//
// optionen.farbe: CSS-Farbwert für die Füllung - Vorgabe --marine
// (Rang 5 der Farbordnung, neutral: "hier ist eine Zahl"). Überschrieben
// wird sie an genau zwei Stellen, und beide nennen eine Bedeutung:
// Rang 4 (Zugehörigkeit, kategorieFarbe() weiter oben - der Radtyp, die
// Tarifgruppe) und Rang 2 (Schwelle - eine volle Station in
// --warnung-text). Alles andere bleibt --marine.
//
// optionen.bezug: EIN ZWEITER WERT AUF DERSELBEN SKALA, als Umriss
// hinter der Füllung gezeichnet. Damit wird aus zwei Spalten eine:
//
//   Auftraggeber, wörtlich: "Die Stellplatz- und Belegungsspalte zeigen
//   fast dasselbe - Kapazität und Belegung als zwei nebeneinander-
//   liegende Balkenspalten. Braucht es beide?"
//
// Nein. Die Kapazität ist der BEZUG, die Belegung der Wert darin - das
// ist ein Balken mit einem Rahmen, kein zweiter Balken daneben. Der
// Umriss reicht bis zur Kapazität (auf der gemeinsamen Skala aller
// Zeilen), die Füllung bis zur Belegung. Beide Fragen ("wie gross ist
// die Station" und "wie voll ist sie") stehen damit in EINER Grafik,
// und die Füllung nutzt endlich die volle Skalenbreite: die Belegung
// reicht von 6 bis 28 Rädern (Verhältnis 4,7), während der Anteil
// allein nur von 30 auf 70 % ging und damit über zwei Drittel jedes
// Balkens ungenutzt liess (genau der zweite Befund des Auftraggebers).
// Ohne bezug bleibt alles wie bisher - ein Balken ohne Rahmen.
//
// aria-hidden auf dem <svg>: der Balken ist eine zweite, rein visuelle
// Darstellung DESSELBEN Werts, der als Text daneben steht - anders als
// eine Sparkline (die eine Form zeigt, die der Text allein nicht hergibt)
// trägt er für sich keine zusätzliche Information.
function zellbalken(wert, maximum, textInhalt = null, optionen = {}) {
    const { breite = 56, hoehe = 12, farbe = 'var(--marine)', beschriftung = null,
            bezug = null } = optionen;
    const anteil = maximum > 0 ? Math.max(0, Math.min(1, wert / maximum)) : 0;

    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${breite} ${hoehe}`);
    svg.setAttribute('width', breite);
    svg.setAttribute('height', hoehe);
    // preserveAspectRatio="none", wie schon bei saeulenSparkline()/
    // strukturBalken() oben: die Kopftafel (rahmen.js, zeigeKopftafel())
    // gibt diesem Balken per CSS eine Breite, die mit dem verfuegbaren
    // Platz waechst, statt der festen breite hier. Ohne dieses Attribut
    // wuerde das <svg> in seinem eigenen, unveraenderten Seitenverhaeltnis
    // eingepasst und liesse links/rechts wieder genau den Leerraum
    // entstehen, den die breitere Zelle eigentlich auffuellen soll. Die
    // FUELLUNG bleibt dabei exakt, weil sie in VIEWBOX-EINHEITEN als
    // Anteil an der vollen Breite gezeichnet wird (breite * anteil,
    // siehe unten) - eine nicht-gleichfoermige Streckung dieses
    // Verhaeltnisses aendert am kodierten Anteil nichts.
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    svg.classList.add('zellbalken-grafik');

    // KEIN Hinweisfenster HIER am <svg> - es ist aria-hidden (siehe oben)
    // und traegt deshalb bewusst KEINEN eigenen Tastaturfokus (ein
    // fokussierbares, zugleich aria-hidden Element waere ein WCAG-
    // Verstoss, 4.1.2). Die Maus- und Tastatur-Anbindung sitzt stattdessen
    // gleich am WRAPPER weiter unten - der ist nicht aria-hidden und
    // traegt seine eigene, sonst fehlende aria-label.

    // KEINE Kontur mehr (Gestaltungsauftrag, zweiter Anlauf - siehe die
    // ausfuehrliche Begruendung bei .zellbalken-hintergrund in style.css):
    // eine Kontur um diese Restflaeche machte aus jedem Balken eine
    // Fuellstandsanzeige, "was bei einem Umsatz von 2.011,20 € keinen
    // Sinn ergibt" (Auftrag, woertlich). Die Flaeche deckt deshalb wieder
    // exakt das ganze viewBox ab, ohne Einrueckung - die fruehere
    // 0.5px-Einrueckung diente ausschliesslich dazu, die jetzt entfernte
    // Kontur ringsum sichtbar zu halten.
    const hintergrund = document.createElementNS(SVG_NS, 'rect');
    hintergrund.setAttribute('x', 0);
    hintergrund.setAttribute('y', 0);
    hintergrund.setAttribute('width', breite);
    hintergrund.setAttribute('height', hoehe);
    hintergrund.setAttribute('class', 'zellbalken-hintergrund');
    svg.append(hintergrund);

    const fuellung = document.createElementNS(SVG_NS, 'rect');
    fuellung.setAttribute('x', 0);
    fuellung.setAttribute('y', 0);
    fuellung.setAttribute('width', breite * anteil);
    fuellung.setAttribute('height', hoehe);
    fuellung.setAttribute('fill', farbe);
    svg.append(fuellung);

    // Der BEZUGSRAHMEN (optionen.bezug, siehe Kopfkommentar): ein
    // Umriss auf DERSELBEN Skala, NACH der Fuellung gezeichnet - sonst
    // deckte die Fuellung seine linke, obere und untere Kante zu, und
    // aus dem Rahmen bliebe nur ein Strich rechts uebrig.
    // vector-effect="non-scaling-stroke": das <svg> wird per CSS in der
    // Breite gestreckt (preserveAspectRatio="none", siehe oben) - ohne
    // dieses Attribut waeren die senkrechten Kanten des Rahmens
    // mitgestreckt und damit dicker als die waagerechten. Das halbe
    // Pixel Einrueckung haelt die Kontur vollstaendig im viewBox; ohne
    // sie faellt die aeussere Haelfte der Strichbreite heraus.
    if (bezug !== null && bezug !== undefined && maximum > 0) {
        const bezugAnteil = Math.max(0, Math.min(1, bezug / maximum));
        const rahmen = document.createElementNS(SVG_NS, 'rect');
        rahmen.setAttribute('x', 0.5);
        rahmen.setAttribute('y', 0.5);
        rahmen.setAttribute('width', Math.max(0, breite * bezugAnteil - 1));
        rahmen.setAttribute('height', hoehe - 1);
        rahmen.setAttribute('class', 'zellbalken-bezug');
        rahmen.setAttribute('vector-effect', 'non-scaling-stroke');
        svg.append(rahmen);
    }

    const wrapper = document.createElement('span');
    wrapper.className = 'zellbalken';
    wrapper.append(svg);
    if (textInhalt !== null && textInhalt !== undefined && textInhalt !== '') {
        const text = document.createElement('span');
        text.className = 'zellbalken-text';
        text.append(textInhalt);
        wrapper.append(text);
    }
    // Hinweisfenster (Gestaltungsauftrag Punkt 2) NUR, wenn eine
    // Beschriftung vorliegt - balkenSpalten() weiter unten ruft
    // zellbalken() ohne eine auf (der Zellenwert steht dort schon
    // sichtbar in der Nachbarspalte, siehe dortiger Kommentar), ein
    // Tabstopp ohne Text waere fuer die Tastatur nur ein leerer Halt.
    // aria-label HIER statt am (aria-hidden) <svg>: der Wrapper ist das
    // einzige Element dieser Grafik, das ueberhaupt einen zugaenglichen
    // Namen tragen darf.
    if (beschriftung) {
        wrapper.tabIndex = 0;
        wrapper.setAttribute('aria-label', beschriftung);
        hinweisfensterVerknuepfen(wrapper, beschriftung);
    }
    return wrapper;
}

// ===== Zeichenbaustein: Strukturbalken (100 %) =====
//
// EIN Balken, der eine Menge in ihre Teile zerlegt - nicht "wie viel",
// sondern "woraus". Die Skala ist IMMER die Summe der Segmente, also
// 100 %: dadurch sind die Balken ZWEIER ZEILEN unmittelbar vergleichbar,
// auch wenn die eine 60 und die andere 12 Raeder zaehlt (Tufte, small
// multiples: gleich gebaute Grafiken untereinander, die man ohne
// Umrechnen nebeneinanderhalten kann). Die absolute Groesse steht
// daneben in der Groessenspalte - beide Fragen getrennt beantwortet,
// statt beide in eine Grafik zu quetschen.
//
// segmente: [{ wert, name, klasse }] - klasse ist eine CSS-Klasse, keine
// Farbe als Zeichenkette: die Bedeutung ("wartung", "defekt") steht damit
// an EINER Stelle in style.css und nicht in fuenf Bereichsdateien
// verstreut. Segmente mit wert 0 werden uebersprungen (kein 0px breites
// Rechteck, das nur den Trennstrich seines Nachbarn verdoppelt).
//
// TRENNFUGEN IN DER FLAECHENFARBE DES UNTERGRUNDS zwischen den
// Segmenten: die vier Statusfarben sind fuer sich gemessen (siehe
// style.css), aber ZWEI davon koennen unmittelbar aneinanderstossen, und
// dann gilt nicht mehr ihr Kontrast gegen Weiss, sondern der
// gegeneinander (--warnung-text gegen --schlecht kommt auf 1.66:1, weit
// unter den 3:1 fuer Grafik). Eine Fuge von 1px loest das strukturell -
// jede Segmentgrenze ist dadurch immer eine Kante gegen den hellen
// Untergrund, unabhaengig davon, welche zwei Farben zusammentreffen.
function strukturBalken(segmente, beschriftung, optionen = {}) {
    const { breite = 96, hoehe = 12, fuge = 1 } = optionen;
    const gefiltert = (segmente || []).filter((s) => s.wert > 0);
    const summe = gefiltert.reduce((s, seg) => s + seg.wert, 0);

    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${breite} ${hoehe}`);
    svg.setAttribute('width', breite);
    svg.setAttribute('height', hoehe);
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.classList.add('strukturbalken');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', beschriftung);
    if (summe <= 0) return svg;   // nichts zu zerlegen, aber ein gueltiges <svg>

    // Tastaturfokus auf dem GANZEN Balken, nicht je Segment - dieselbe
    // Begruendung wie bei saeulenSparkline() oben: ein Bildschirmleser
    // bekommt die Aufteilung ohnehin nur als EINE aria-label-Aufzaehlung
    // (siehe strukturText() in flotte.js), ein Tastaturnutzer sieht hier
    // dieselbe Zusammenfassung, sichtbar statt vorgelesen. Die Maus
    // bekommt zusaetzlich JE SEGMENT ihr eigenes Hinweisfenster (unten in
    // der forEach-Schleife).
    svg.tabIndex = 0;
    hinweisfensterVerknuepfen(svg, beschriftung);

    // EIN SEGMENT, DAS ES GIBT, MUSS MAN SEHEN. Ein gesperrter Kunde von
    // 112 sind 0,86px auf einem 96px-Balken, drei defekte Raeder von 275
    // sind 1,05px - beide waeren nach dem Abzug der Fuge unsichtbar, und
    // "unsichtbar" liest sich als "gibt es nicht". Jedes Segment mit Wert
    // > 0 bekommt deshalb eine Mindestbreite; die dafuer noetigen Pixel
    // werden dem GROESSTEN Segment abgezogen, damit die Summe exakt die
    // Balkenbreite bleibt. Das verzerrt die Anteile um maximal
    // mindestbreite Pixel je winzigem Segment - ein bewusst in Kauf
    // genommener Fehler von rund einem Prozentpunkt gegen einen Befund,
    // der sonst gar nicht erscheint. Die genaue Zahl steht ohnehin im
    // Hinweisfenster jedes Segments (siehe hinweisfensterTeilVerknuepfen()
    // in der forEach-Schleife unten) und im aria-label des ganzen Balkens.
    const mindestbreite = Math.min(2, breite / gefiltert.length);
    const breiten = gefiltert.map((segment) => (segment.wert / summe) * breite);
    let schuld = 0;
    breiten.forEach((w, i) => { if (w < mindestbreite) { schuld += mindestbreite - w; breiten[i] = mindestbreite; } });
    if (schuld > 0) {
        const groesster = breiten.indexOf(Math.max(...breiten));
        breiten[groesster] = Math.max(mindestbreite, breiten[groesster] - schuld);
    }

    let x = 0;
    gefiltert.forEach((segment, i) => {
        const segmentbreite = breiten[i];
        const rect = document.createElementNS(SVG_NS, 'rect');
        rect.setAttribute('x', x.toFixed(2));
        rect.setAttribute('y', 0);
        // Die Fuge wird dem VORANGEHENDEN Segment abgezogen, nicht
        // zwischen beide gelegt: so bleibt die Summe der Segmentbreiten
        // exakt die volle Balkenbreite, das letzte Segment endet buendig
        // am rechten Rand, und ein Anteil von 100 % sieht auch aus wie
        // ein voller Balken.
        const abzug = i < gefiltert.length - 1 ? Math.min(fuge, segmentbreite / 2) : 0;
        rect.setAttribute('width', Math.max(0.5, segmentbreite - abzug).toFixed(2));
        rect.setAttribute('height', hoehe);
        rect.setAttribute('class', `strukturbalken-segment ${segment.klasse}`);
        hinweisfensterTeilVerknuepfen(rect, `${segment.name}: ${zahlFormat(segment.wert)}`);
        svg.append(rect);
        x += segmentbreite;
    });
    return svg;
}

// ===== Zeichenbaustein: Abweichungsbalken (Hichert/IBCS) =====
//
// Eine Abweichung ist eine EIGENE Groesse, keine zweite Lesart einer
// Absolutzahl - IBCS weist sie deshalb in einer eigenen Spalte aus, mit
// einer eigenen, um die Null zentrierten Skala. Genau das macht dieser
// Baustein: die Nulllinie liegt in der MITTE der Flaeche, ein positiver
// Wert waechst nach rechts, ein negativer nach links, und beide Seiten
// teilen sich dieselbe Skala (maximumBetrag, vom Aufrufer EINMAL ueber
// alle Zeilen ermittelt). Ohne diese gemeinsame Skala waere die laengste
// Abweichung in jeder Zeile gleich lang und der Vergleich zwischen den
// Zeilen sinnlos - derselbe Grund, aus dem zellbalken() sein Maximum
// nicht je Zeile neu bildet.
//
// VORZEICHENFARBE — NEU, UND WARUM SIE KEINE AMPEL IST.
// Die vorige Fassung gab beiden Richtungen DIESELBE Farbe, mit der
// Begruendung, eine Abweichung sei erst einmal nur eine Abweichung.
// Der Befund des Auftraggebers dagegen: "Der Saldo geht von -65 bis
// +122. Eine Station, die Raeder ansammelt, und eine, die leerlaeuft,
// sind fachlich GEGENSAETZLICH - sie sehen heute gleich aus." Das
// stimmt: dass sie auf verschiedenen Seiten der Null liegen, war die
// einzige Unterscheidung, und die verschwand, sobald zwei Balken kurz
// waren. Positiv und negativ tragen deshalb jetzt Rang 3 der
// Farbordnung: --abweichung-plus (Tiefblau) und --abweichung-minus
// (Ocker).
//
// KEINE AMPEL, und das ist der Unterschied: Gruen/Rot behauptete "mehr
// ist gut". Ob mehr gut ist, weiss aber nur der Bereich - eine Station,
// an der sich Raeder stauen, ist so viel Arbeit wie eine, die leer
// laeuft. Blau/Ocker nennt die RICHTUNG, nicht das Urteil. Und Rot
// bleibt, wo es hingehoert: beim defekten Rad und bei der unumkehrbaren
// Handlung (Rang 1).
//
// FARBE VERDOPPELT HIER, SIE TRAEGT NICHT ALLEIN (WCAG 1.4.1): die
// Seite der Nulllinie kodiert dasselbe Vorzeichen ein zweites Mal, und
// die Zahl links daneben traegt es ein drittes Mal als "+"/"-" (siehe
// abweichungText() weiter unten).
//
// DIE NULLLINIE, ZWEITER ANLAUF. Sie stand schon bisher in der Mitte,
// aber NUR ueber die 12px Hoehe des jeweiligen Balkens - zwischen zwei
// Zeilen lagen 24px Zellenabstand ohne Linie, und was als Achse gemeint
// war, las sich als eine Reihe kurzer Striche. Auftraggeber, woertlich:
// "Der Saldo hat keine sichtbare Nulllinie." Die Linie ist deshalb
// jetzt kein SVG-Element mehr, sondern ein eigenes, ueber die volle
// ZELLENhoehe reichendes Element (siehe .abweichungsbalken-null in
// style.css): senkrecht durchgehend ueber alle Zeilen, eine Achse
// statt einer Strichfolge.
function abweichungsBalken(wert, maximumBetrag, beschriftung, optionen = {}) {
    const { breite = 84, hoehe = 12 } = optionen;
    const mitte = breite / 2;
    const grenze = maximumBetrag > 0 ? maximumBetrag : 1;
    const laenge = Math.min(1, Math.abs(wert) / grenze) * (mitte - 1);

    // WRAPPER STATT EINEM REINEN <svg> - dieselbe Bauart, die lagepunkt()
    // weiter unten schon benutzt und aus demselben Grund: ein Teil dieser
    // Grafik (die Nulllinie) muss ueber die Grenze des <svg> hinaus bis
    // an den oberen und unteren Rand der TABELLENZELLE reichen, damit die
    // Achsen benachbarter Zeilen zu einer durchgehenden Linie
    // zusammenwachsen. Innerhalb eines <svg> mit fester Hoehe ginge das
    // nicht.
    const wrapper = document.createElement('span');
    wrapper.className = 'abweichungsbalken';
    wrapper.setAttribute('role', 'img');
    wrapper.setAttribute('aria-label', beschriftung);
    // Dieselbe beschriftung ZUSAETZLICH als eigenes Hinweisfenster
    // (Gestaltungsauftrag Punkt 2): aria-label allein wird von keinem
    // Browser sichtbar angezeigt, nur von einem Screenreader vorgelesen.
    // tabIndex macht denselben Balken auch per Tastatur erreichbar - kein
    // Zusatzaufwand beim Aufrufer noetig, der Text liegt hier schon vor.
    wrapper.tabIndex = 0;
    hinweisfensterVerknuepfen(wrapper, beschriftung);

    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${breite} ${hoehe}`);
    svg.setAttribute('width', breite);
    svg.setAttribute('height', hoehe);
    // preserveAspectRatio="none" - dieselbe Begruendung wie bei
    // zellbalken() oben: die Kopftafel dehnt diese Spalte per CSS auf den
    // verfuegbaren Platz. Mitte und Laenge bleiben dabei richtig, weil
    // beide in VIEWBOX-EINHEITEN relativ zur vollen Breite berechnet
    // werden (mitte = breite/2, laenge als Anteil von mitte-1) - eine
    // nicht-gleichfoermige Streckung dieses Verhaeltnisses veraendert den
    // kodierten Wert nicht, nur seine Pixelgroesse auf dem Bildschirm.
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.classList.add('abweichungsbalken-grafik');
    // aria-hidden am <svg>, weil der WRAPPER den zugaenglichen Namen
    // traegt (siehe oben) - zwei Namen fuer dieselbe Grafik liesse ein
    // Bildschirmleser doppelt vorlesen. Dieselbe Aufteilung wie bei
    // zellbalken()/lagepunkt().
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');

    if (Math.abs(wert) > 0) {
        const rect = document.createElementNS(SVG_NS, 'rect');
        rect.setAttribute('x', (wert >= 0 ? mitte : mitte - laenge).toFixed(2));
        rect.setAttribute('y', 1);
        rect.setAttribute('width', Math.max(0.5, laenge).toFixed(2));
        rect.setAttribute('height', hoehe - 2);
        // RANG 3 DER FARBORDNUNG (siehe Kopfkommentar): die Richtung
        // steht in der Klasse, nicht in einer Farbe als Zeichenkette -
        // dieselbe Trennung wie bei den seg-*-Klassen des
        // Strukturbalkens. Wer die Toene aendern will, findet sie in
        // style.css und nicht in fuenf Bereichsdateien.
        rect.setAttribute('class', 'abweichungsbalken-flaeche '
            + (wert > 0 ? 'abweichung-plus' : 'abweichung-minus'));
        svg.append(rect);
    }
    wrapper.append(svg);

    // Die Nulllinie ZULETZT eingehaengt, damit sie ueber der Flaeche
    // liegt: bei einer sehr kleinen Abweichung waere sie sonst von der
    // Mindestbreite des Balkens (0.5px) verdeckt und die Achse haette
    // genau dort eine Luecke, wo man sie am noetigsten braucht.
    const nulllinie = document.createElement('span');
    nulllinie.className = 'abweichungsbalken-null';
    nulllinie.setAttribute('aria-hidden', 'true');
    wrapper.append(nulllinie);
    return wrapper;
}

// DIE NULLLINIE ALLEIN, OHNE BALKEN - fuer Gruppen- und Summenzeilen.
//
// Dritter Anlauf auf denselben Befund ("Der Saldo hat keine sichtbare
// Nulllinie"). Der zweite (die Achse ueber die volle Zellenhoehe, siehe
// abweichungsBalken() oben) machte sie durchgehend - aber NUR in
// Datenzeilen. Gruppenzeilen und die Summenzeile tragen keinen Balken
// (sie stehen ausserhalb der gemeinsamen Skala, siehe Kopfkommentar bei
// kopftafelZeile()), und damit fehlte dort auch die Achse: in der Flotte
// klaffte sie an drei Radtyp-Zeilen um 88 Pixel auf, im Browser
// gemessen. Eine Achse mit Loechern ist keine Achse.
//
// Die Zeile hat an dieser Stelle nichts zu SAGEN - sie hat nur die Achse
// weiterzuführen. Deshalb aria-hidden, kein tabIndex und kein
// Hinweisfenster: fuer einen Bildschirmleser ist hier tatsaechlich
// nichts, und ein Tabstopp auf einem leeren Lineal waere ein Halt ohne
// Inhalt.
function abweichungsAchse() {
    const wrapper = document.createElement('span');
    wrapper.className = 'abweichungsbalken';
    wrapper.setAttribute('aria-hidden', 'true');
    const nulllinie = document.createElement('span');
    nulllinie.className = 'abweichungsbalken-null';
    wrapper.append(nulllinie);
    return wrapper;
}

// Der Text zu einem Abweichungsbalken - EINMAL hier, statt in jedem der
// vier Bereiche fast gleich: das Vorzeichen wird bei einer Abweichung
// IMMER gesetzt (IBCS - "+12,0" und "12,0" sind nicht dieselbe Aussage),
// und die negative Null wird eingefangen. Letzteres ist kein
// Schoenheitsfehler: -0,02 Prozentpunkte runden auf -0 (JavaScript kennt
// eine negative Null), und die Oberflaeche schrieb dann "-0,0" - eine
// Abweichung, die es nicht gibt, mit einer Richtung, die sie nicht hat.
// wert === 0 ist fuer -0 wahr und normalisiert es damit zu 0.
function abweichungText(wert, nachkommastellen = 1) {
    const bereinigt = wert === 0 ? 0 : wert;
    const zahl = zahlFormat(bereinigt, {
        minimumFractionDigits: nachkommastellen, maximumFractionDigits: nachkommastellen
    });
    return bereinigt > 0 ? `+${zahl}` : zahl;
}

// ===== Zeichenbaustein: Lagepunkt auf gemeinsamer Achse =====
//
// Fuer eine Reihe, die je Zeile nur EINEN Wert hat und trotzdem
// verglichen werden soll: das Baujahr eines Modells, der Fuellstand
// einer Station, die Bearbeitungsstufe eines Falls. Eine Saeulen-
// Sparkline waere hier sinnlos (eine einzelne Saeule zeigt keine Form),
// eine blosse Zahl in einer Spalte laesst sich nicht ueberfliegen. Ein
// Punkt auf einer fuer ALLE Zeilen identischen Achse dagegen schon -
// zehn solche Zeilen untereinander ergeben einen Punktschwarm, aus dem
// Verteilung und Ausreisser unmittelbar hervorgehen (Tufte).
//
// minimum/maximum kommen vom Aufrufer, nicht aus dem Einzelwert: sie
// sind die GEMEINSAME Achse. kopftafel() unten ermittelt sie einmal ueber
// alle Zeilen und reicht sie durch - kein Bereich kann sie versehentlich
// je Zeile neu bilden.
//
// Position kodiert (nicht Laenge): eine abgeschnittene Achse waere hier
// also zulaessig - und ist es auch (Baujahre 2021-2025 bei 0 beginnen zu
// lassen, waere Unsinn). Die Achse wird deshalb als sichtbare Linie MIT
// beiden Endwerten im aria-label gezeichnet, damit klar ist, worauf der
// Punkt sich bezieht.
// WRAPPER STATT EINEM REINEN <svg> (Kopftafel-Breitenaufgabe): die ACHSE
// ist eine gerade Linie und vertraegt preserveAspectRatio="none"
// schadlos - eine nicht-gleichfoermig gestreckte Gerade bleibt eine
// Gerade (dieselbe Rechnung wie bei zellbalken()/abweichungsBalken()
// oben, deren Rechtecke aus demselben Grund unverzerrt bleiben). Der
// PUNKT dagegen ist ein Kreis, ein echtes zweidimensionales Objekt -
// dieselbe Streckung wuerde ihn zu einem Oval verformen, sobald die
// Spalte (zeigeKopftafel() in rahmen.js gibt ihr jetzt mehr Platz als
// die feste "breite" hier) breiter wird als ihr urspruengliches
// Zeichenmass. Der Punkt sitzt deshalb NICHT im <svg>, sondern als
// eigenes, in FESTEN Pixeln gezeichnetes Element (CSS border-radius,
// siehe .lagepunkt-marke in style.css) mit einer prozentualen
// links-Position: die Position waechst mit der Spalte, die Form nicht.
function lagepunkt(wert, minimum, maximum, beschriftung, optionen = {}) {
    const { breite = 84, hoehe = 12, radius = 3.2 } = optionen;
    const spanne = (maximum - minimum) || 1;
    const anteil = Math.max(0, Math.min(1, (wert - minimum) / spanne));

    const wrapper = document.createElement('span');
    wrapper.className = 'lagepunkt';
    wrapper.setAttribute('role', 'img');
    wrapper.setAttribute('aria-label', beschriftung);
    // tabIndex macht den Wrapper per Tastatur erreichbar - das
    // gewoehnliche title-Attribut (fruehere Fassung) erschien nur bei
    // :hover, nie bei :focus (siehe Kopfkommentar bei
    // hinweisfensterVerknuepfen() weiter oben).
    wrapper.tabIndex = 0;
    hinweisfensterVerknuepfen(wrapper, beschriftung);

    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${breite} ${hoehe}`);
    svg.setAttribute('width', breite);
    svg.setAttribute('height', hoehe);
    // preserveAspectRatio="none": siehe Kopfkommentar - hier unbedenklich,
    // weil nur noch die Achsenlinie im <svg> steckt.
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    svg.classList.add('lagepunkt-achsengrafik');

    const achse = document.createElementNS(SVG_NS, 'line');
    achse.setAttribute('x1', radius);
    achse.setAttribute('x2', breite - radius);
    achse.setAttribute('y1', hoehe / 2);
    achse.setAttribute('y2', hoehe / 2);
    achse.setAttribute('class', 'lagepunkt-achse');
    svg.append(achse);
    wrapper.append(svg);

    const punkt = document.createElement('span');
    punkt.className = 'lagepunkt-marke';
    // Anteil an der ACHSE (radius bis breite-radius), nicht an der vollen
    // Spannweite 0-100 %: die Achse selbst beginnt/endet um radius
    // eingerueckt (siehe x1/x2 oben), damit der Punkt bei minimum/maximum
    // nicht ueber ihr Ende hinausragt. Ein Verhaeltnis (randAnteil,
    // dimensionslos) statt eines Pixelmasses: als CSS-Prozentwert bleibt
    // die Position richtig, unabhaengig davon, wie breit die Spalte
    // tatsaechlich gerendert wird.
    const randAnteil = radius / breite;
    const positionAnteil = randAnteil + anteil * (1 - 2 * randAnteil);
    punkt.style.left = `${(positionAnteil * 100).toFixed(2)}%`;
    wrapper.append(punkt);

    return wrapper;
}

// ===== Zeichenbaustein: Donut (Gestaltungsauftrag Stationen, Punkt 2) =====
//
// Zwei woertliche Wuensche desselben Auftrags: "vermisse auch die
// Auslastung der Stellplaetze als Donutchart" (in der Uebersicht ueber
// der Liste) und "Wenn ich auf die Details einer Station klicke, will
// ich da ein Donut-Chart fuer die Belegung sehen, 100 % ist die
// Kapazitaet". EIN Baustein hier statt zweier eigener Zeichnungen in
// stationen.js - "die anderen Bereiche werden ihn brauchen" (Auftrag,
// woertlich): ein Anteilsring ist keine stationseigene Idee, derselbe
// Fund wie bei saeulenSparkline()/zellbalken() oben.
//
// DIE SKALA IST FEST (Auftrag, ausdruecklich): 100 % ist maximum, wie
// vom Aufrufer uebergeben - NICHT der groesste vorkommende Wert einer
// Reihe (anders als saeulengrafik() weiter unten, deren Maximum bewusst
// aus den Werten selbst kommt, weil dort keine fachliche Kapazitaetsgrenze
// existiert). Fuer eine einzelne Station ist maximum ihre Kapazitaet,
// fuer die Netzuebersicht die Gesamtkapazitaet ueber alle Stationen -
// beides eine Groesse, die nur der Aufrufer kennt.
//
// EIN DONUT OHNE ZAHL IST EINE SCHAETZAUFGABE (Auftrag, ausdruecklich):
// der Anteil steht deshalb ZWEIMAL da - als Flaeche UND als Text in der
// Mitte (Prozent gross, der Bruch klein darunter, sofern optionen.bruch
// gesetzt ist) - und beschriftung ist ein PFLICHTPARAMETER wie bei
// saeulenSparkline() oben: eine vollstaendige, vorgelesene Zusammenfassung
// fuer role="img"/aria-label, kein optionales Detail, das ein Aufrufer
// vergessen koennte.
//
// STROKE-DASHARRAY AUF ZWEI <circle>-ELEMENTEN STATT EINES HANDGERECHNETEN
// <path>-KREISBOGENS: fuer einen reinen Anteilsring (kein Kuchendiagramm
// mit mehreren Segmenten) einfacher und robuster als eine SVG-Arc-Notation
// mit grossem/kleinem Bogen-Flag - bei genau 0 % oder 100 % faellt eine
// <path>-Loesung leicht auf denselben Anfangs-/Endpunkt zusammen und
// verschwindet, waehrend ein Kreis mit stroke-dasharray "0 Umfang" bzw.
// "voller Umfang, 0 Rest" unproblematisch bleibt.
// transform="rotate(-90 ...)" verschiebt den Start von der 3-Uhr- auf die
// 12-Uhr-Position, damit der Ring im Zeigersinn waechst - die uebliche
// Lesart eines Anteilsrings. stroke-linecap bleibt beim Vorgabewert "butt"
// (nicht "round"): ein rundes Ende macht einen kleinen, aber echten Anteil
// optisch groesser, als er ist - bei einer Grafik, die LAENGE (hier:
// Bogenlaenge) kodiert, dieselbe Verzerrung, die eine abgeschnittene
// y-Achse bei einer Saeule waere.
//
// FARBEN, GEMESSEN: der Hintergrundring nutzt --skala-rahmen (3.64:1 auf
// Weiss, wie schon bei saeulenSparkline() - dieselbe Flaeche, ein zweiter
// Verwendungszweck statt eines dritten, unvermessenen Grautons). Die
// Vorgabefarbe des Vordergrunds ist --marine (17.29:1). Ein Aufrufer darf
// optionen.farbe auf --warnung-text setzen (5.32:1 auf Weiss), aber NUR
// dort, wo der Anteil dabei bei 100 % liegt (eine volle Station):
// --warnung-text gegen --skala-rahmen selbst hat nur 1.46:1 - weit unter
// der fuer Grafik verlangten 3:1 -, und genau diese beiden Farben treffen
// an der Ring-Grenze aufeinander, sobald der Hintergrundring noch sichtbar
// bleibt. Bei einem exakt vollen Anteil (100 %) verschwindet der
// Hintergrundring vollstaendig hinter dem Vordergrund, die Grenze existiert
// dann nicht - siehe donatDetailAufbauen()/stationenUebersicht() in
// stationen.js, wo --warnung-text ausschliesslich fuer frei === 0 (also
// anteil === 1) vergeben wird.
function donut(wert, maximum, beschriftung, optionen = {}) {
    const { durchmesser = 88, dicke = 12, farbe = 'var(--marine)', bruch = null } = optionen;

    const anteil = maximum > 0 ? Math.max(0, Math.min(1, wert / maximum)) : 0;
    const mitte = durchmesser / 2;
    const radius = mitte - dicke / 2;
    const umfang = 2 * Math.PI * radius;

    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${durchmesser} ${durchmesser}`);
    svg.setAttribute('width', durchmesser);
    svg.setAttribute('height', durchmesser);
    svg.classList.add('donut');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', beschriftung);

    const hintergrund = document.createElementNS(SVG_NS, 'circle');
    hintergrund.setAttribute('cx', mitte);
    hintergrund.setAttribute('cy', mitte);
    hintergrund.setAttribute('r', radius);
    hintergrund.setAttribute('stroke-width', dicke);
    hintergrund.setAttribute('class', 'donut-hintergrund');
    svg.append(hintergrund);

    // anteil === 0 zeichnet keinen Vordergrundkreis: ein stroke-dasharray
    // von "0 Umfang" waere gueltig, aber ueberfluessig - der Hintergrund
    // allein zeigt bereits "nichts belegt".
    if (anteil > 0) {
        const vordergrund = document.createElementNS(SVG_NS, 'circle');
        vordergrund.setAttribute('cx', mitte);
        vordergrund.setAttribute('cy', mitte);
        vordergrund.setAttribute('r', radius);
        vordergrund.setAttribute('stroke-width', dicke);
        vordergrund.setAttribute('stroke', farbe);
        vordergrund.setAttribute('stroke-dasharray', `${(umfang * anteil).toFixed(2)} ${umfang.toFixed(2)}`);
        vordergrund.setAttribute('transform', `rotate(-90 ${mitte} ${mitte})`);
        vordergrund.setAttribute('class', 'donut-vordergrund');
        svg.append(vordergrund);
    }

    const textProzent = document.createElementNS(SVG_NS, 'text');
    textProzent.setAttribute('x', mitte);
    textProzent.setAttribute('y', bruch ? mitte - 6 : mitte);
    textProzent.setAttribute('class', 'donut-text-prozent');
    textProzent.textContent = `${Math.round(anteil * 100)} %`;
    svg.append(textProzent);

    if (bruch) {
        const textBruch = document.createElementNS(SVG_NS, 'text');
        textBruch.setAttribute('x', mitte);
        textBruch.setAttribute('y', mitte + 14);
        textBruch.setAttribute('class', 'donut-text-bruch');
        textBruch.textContent = bruch;
        svg.append(textBruch);
    }

    return svg;
}

// ===== Zeichenbaustein: Säulengrafik (Drill-Down-Aufgabe) =====
//
// Drittes Geschwister von saeulenSparkline()/zellbalken() oben, allgemein
// und nicht auswertungsspezifisch gehalten wie beide - der Aufrufer
// liefert Werte, Achsenbeschriftungen und einen zugänglichen Namen, diese
// Funktion weiß nichts von "Fahrten" oder "Monaten".
//
// Der fachliche Unterschied zu den beiden Geschwistern, und der Grund,
// warum diese Funktion NICHT einfach zellbalken() im Kreis aufruft:
// dort KODIERT die Länge einen ANTEIL an einer fest vorgegebenen
// Gesamtbreite (ein Füllstand zwischen 0 und 100 %, ein Umsatz zwischen
// 0 und dem Zeilenmaximum) - die Nulllinie ist dort automatisch die
// linke Kante der Zelle. Eine Säule dagegen steht FREI im Raum; ohne
// eine EIGENS gezeichnete Nulllinie könnte ihre Höhe genauso gut ab
// einem beliebigen Sockel beginnen, und zwei Säulen im Verhältnis 2:1
// sähen dann nicht mehr im Verhältnis 2:1 aus. Deshalb ist die Skala
// hier IMMER bei 0 verankert (maximum kommt ausschließlich aus den
// Werten selbst, nie aus einem vom Aufrufer übergebenen Minimum) - eine
// abgeschnittene y-Achse ist für längenkodierende Grafiken in diesem
// Projekt an KEINER Stelle zulässig (fachliche Regel des Gestaltungs-
// auftrags): saeulenSparkline() oben verankert ihre Säulen aus demselben
// Grund ebenfalls bei 0, nicht nur diese Funktion hier.
//
// werte: Zahlen in Anzeigereihenfolge, EINE je Kategorie (Tag im
// Monat). Ein fehlender Betriebstag ist null FAHRTEN (eine Säule der
// Höhe 0, sichtbar auf der Grundlinie), keine ausgelassene Kategorie -
// der Aufrufer muss die Lücke deshalb selbst mit 0 auffüllen, BEVOR er
// diese Funktion ruft (siehe monatsdrilldownEinfuegen() in
// auswertungen.js): ein einfach ausgelassener Index sähe hier genauso
// aus wie eine fehlende Säule und wäre von einem Ladefehler nicht zu
// unterscheiden.
// beschriftungenX: Array gleicher Länge, für die Tooltip-Titel je Säule
// und die drei Eckpunkte der x-Achsenbeschriftung (erster/mittlerer/
// letzter Tag) - keine volle Beschriftung jeder einzelnen Säule, dafür
// ist eine Spalte mit 28 bis 31 Werten zu schmal.
// optionen.beschriftung: der zugängliche Name der GESAMTEN Grafik
// (role="img"), eine fertig formulierte Zusammenfassung (Minimum,
// Maximum, Spitzentag) - dieselbe Pflicht wie bei saeulenSparkline() oben
// ("eine Grafik, die Information trägt, darf für einen Screenreader
// nicht stumm sein"). Die Tages-für-Tages-Zahlen selbst gehören NICHT
// in dieses eine Label (31 Zahlen in einem Satz wären für einen
// Screenreader ebenso unbrauchbar wie für ein Auge) - dafür baut der
// Aufrufer zusätzlich eine normale <table>, siehe dort.
// optionen.markierIndizes: hervorgehobene Säulen in --rot, als ARRAY
// statt eines einzelnen Index wie zuvor bei sparkline()s markierIndex -
// zwei Tage können denselben Höchstwert tragen (Auftrag, ausdrücklich als
// Fallstrick benannt), dann sind es zwei Spitzentage, nicht einer.
function saeulengrafik(werte, beschriftungenX, optionen = {}) {
    const { breite = 420, hoehe = 120, beschriftung = null, markierIndizes = [] } = optionen;

    const block = document.createElement('div');
    block.className = 'saeulengrafik-block';

    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${breite} ${hoehe}`);
    svg.classList.add('saeulengrafik');

    if (beschriftung) {
        svg.setAttribute('role', 'img');
        svg.setAttribute('aria-label', beschriftung);
    } else {
        svg.setAttribute('aria-hidden', 'true');
        svg.setAttribute('focusable', 'false');
    }

    const werteBereinigt = (werte || []).map((w) => w || 0);
    // Nulllinie ist PFLICHT (siehe Kopfkommentar): die Skala beginnt
    // IMMER bei 0, deshalb kommt "maximum" ausschliesslich aus den
    // Werten selbst - Math.max(1, ...) nur, damit ein Monat mit
    // durchgehend 0 Fahrten nicht durch 0 teilt, nicht als versteckte
    // Untergrenze der Achse.
    const maximum = Math.max(1, ...werteBereinigt);

    if (werteBereinigt.length > 0) {
        const anzahl = werteBereinigt.length;
        const abstand = breite / anzahl;
        const saeulenbreite = Math.max(0.5, abstand - 1);

        // Grundlinie: rein dekorativ (jede Saeule steht ohnehin auf ihr
        // auf), macht aber sichtbar, dass eine Saeule der Hoehe 0 BEWUSST
        // keine Hoehe hat, statt wie eine fehlende Kategorie auszusehen.
        const grundlinie = document.createElementNS(SVG_NS, 'line');
        grundlinie.setAttribute('x1', 0);
        grundlinie.setAttribute('x2', breite);
        grundlinie.setAttribute('y1', hoehe - 0.5);
        grundlinie.setAttribute('y2', hoehe - 0.5);
        grundlinie.setAttribute('class', 'saeulengrafik-grundlinie');
        svg.append(grundlinie);

        werteBereinigt.forEach((wert, i) => {
            // 2px Luft oben, damit der hoechste Wert nicht exakt auf der
            // Kontur des <svg> liegt (dieselbe Ueberlegung wie der 1px-
            // Rand bei saeulenSparkline() oben).
            const saeulenhoehe = (wert / maximum) * (hoehe - 2);
            const rect = document.createElementNS(SVG_NS, 'rect');
            rect.setAttribute('x', (i * abstand).toFixed(2));
            rect.setAttribute('y', (hoehe - saeulenhoehe).toFixed(2));
            rect.setAttribute('width', saeulenbreite.toFixed(2));
            rect.setAttribute('height', Math.max(0, saeulenhoehe).toFixed(2));
            rect.setAttribute('class', markierIndizes.includes(i)
                ? 'saeulengrafik-saeule saeulengrafik-saeule-markiert'
                : 'saeulengrafik-saeule');
            if (beschriftungenX && beschriftungenX[i] !== undefined) {
                // <title> auf dem einzelnen <rect>: ein Tooltip beim
                // Hovern EINER Saeule, ohne die Grafik als Ganzes stumm
                // zu machen (svg traegt aria-label bereits fuer sich).
                const titel = document.createElementNS(SVG_NS, 'title');
                titel.textContent = `${beschriftungenX[i]}: ${wert}`;
                rect.append(titel);
            }
            svg.append(rect);
        });
    }

    // y-Achse: nur 0 und das Maximum, keine Zwischenwerte - die
    // begleitende Tabelle (Aufrufer) traegt jede einzelne Zahl bereits
    // exakt, diese beiden Eckwerte dienen nur der groben Einordnung
    // "wie hoch ist hoch". aria-hidden: rein visuelle Orientierung,
    // redundant zu optionen.beschriftung und zur Tabelle.
    const yAchse = document.createElement('div');
    yAchse.className = 'saeulengrafik-y-achse';
    yAchse.setAttribute('aria-hidden', 'true');
    const yOben = document.createElement('span');
    yOben.textContent = zahlFormat(maximum);
    const yUnten = document.createElement('span');
    yUnten.textContent = '0';
    yAchse.append(yOben, yUnten);

    block.append(yAchse, svg);

    if (beschriftungenX && beschriftungenX.length > 0) {
        const xAchse = document.createElement('div');
        xAchse.className = 'saeulengrafik-x-achse';
        xAchse.setAttribute('aria-hidden', 'true');
        const indexMitte = Math.floor((beschriftungenX.length - 1) / 2);
        [0, indexMitte, beschriftungenX.length - 1].forEach((i, position) => {
            // Bei sehr wenigen Kategorien (< 3) faellt "Mitte" mit
            // "erster" oder "letzter" zusammen - dann nicht doppelt
            // anzeigen.
            if (position === 1 && (i === 0 || i === beschriftungenX.length - 1)) return;
            const span = document.createElement('span');
            span.textContent = beschriftungenX[i];
            xAchse.append(span);
        });
        block.append(xAchse);
    }

    return block;
}

// ===== Zeichenbaustein: typografische Skalierung (Bissantz) =====
//
// DIE REGEL, NEU GEFASST (Gestaltungsauftrag, woertlich: "Warum ist die 0
// fett? Was soll der Mist."). Sie lautet NICHT "Vorkommastellen fett" -
// das war die alte, an der Position des Dezimalzeichens festgemachte
// Fassung, und sie ist bei jeder Zahl unter Eins genau verkehrt herum:
// bei 0,35 € betonte sie die fuehrende Null, die nichts traegt, und
// daempfte ",35", wo die ganze Information steckt.
//
// Sie lautet: DIE STELLEN HERVORHEBEN, DIE DIE GROESSENORDNUNG TRAGEN,
// UND DIE ZURUECKNEHMEN, DIE SIE NICHT TRAGEN. Umgesetzt ueber GELTENDE
// ZIFFERN statt ueber eine feste Position:
//
//   1. Fuehrende Nullen tragen nichts - sie sind leise. ("0," in "0,35")
//   2. Die ersten GELTENDE_ZIFFERN Ziffern ab der ersten Ziffer ungleich
//      null tragen die Groessenordnung - sie stehen in voller Staerke.
//   3. Alles danach verfeinert nur noch die Genauigkeit - leise.
//   4. Trennzeichen (Tausender wie Dezimal) sind Gliederung, keine
//      Information - immer leise.
//   5. Das VORZEICHEN traegt so viel wie keine Ziffer sonst (ein Saldo
//      von -65 ist etwas anderes als einer von 65) - immer voll stark.
//   6. Die EINHEIT (€, %, kg) und ein vorangestelltes Waehrungszeichen
//      sagen, WORIN gemessen wird, nicht WIE VIEL - leise.
//
// Damit faellt die Betonung dorthin, wo sie hingehoert, unabhaengig
// davon, wo das Dezimalzeichen steht:
//   35.387,17 €  ->  35.3 stark, 87,17 € leise   (die Tausender)
//   0,35 €       ->  35 stark,   0, und  € leise (die Nachkommastellen)
//   -65          ->  -65 stark
//
// DREI GELTENDE ZIFFERN, nicht zwei und nicht vier: drei legen die
// Groessenordnung UND die erste Verfeinerung fest ("35,4 Tausend"), was
// ein Auge in einem Zug erfasst. Eine vierte Ziffer aendert an der
// wahrgenommenen Groesse nichts mehr - genau die Stelle, an der Bissantz
// die Staerke zuruecknimmt.
const GELTENDE_ZIFFERN = 3;

// Nimmt eine FERTIG formatierte Zahl der AKTUELLEN Sprache entgegen
// (Trennzeichen schon gesetzt, z. B. von geldFormat()/kgFormat() in
// auswertungen.js) - das Zerlegen des Zahlenformats gehoert hierher, weil
// jeder Bereich mit einer eigenen, aehnlichen Formatierungsfunktion
// dieselbe Aufteilung braucht; WAS gerundet und WELCHE Einheit
// angehaengt wird, bleibt Sache des Aufrufers.
//
// MEHRSPRACHIGKEIT, ZWEITER FALLSTRICK - EIN VORANGESTELLTES
// WAEHRUNGSZEICHEN: die vorherige Fassung verlangte per regulaerem
// Ausdruck, dass die Zahl am ANFANG der Zeichenkette steht (^-?\d...).
// Intl liefert Euro-Betraege aber in zwei der sechs Sprachen mit dem
// Zeichen VORNE - en-US "€35,387.17", tr-TR "€35.387,17" (im Browser
// nachgemessen, siehe Bericht) -, und dort traf das Muster gar nicht
// mehr zu: JEDER Geldbetrag rutschte in diesen beiden Sprachen
// unskaliert als Fliesstext durch. Diese Fassung sucht deshalb nicht
// mehr nach einem Muster ab Zeichenkettenanfang, sondern LIEST die
// Zeichenkette durch und teilt sie in Vorspann / Ziffernkoerper /
// Nachspann - das ist unabhaengig davon, auf welcher Seite die Einheit
// steht.
//
// Kein Ziffernkoerper (ein Text, der gar keine Ziffer enthaelt) gibt den
// Eingabetext unveraendert als einzelnen Textknoten zurueck - eine
// typografische Verzierung darf niemals dazu fuehren, dass eine Zahl aus
// der Tabelle verschwindet, nur weil sie einem erwarteten Muster nicht
// entspricht.
function zahlSkaliert(formatiert) {
    const text = String(formatiert);
    const { gruppe: gruppenzeichen, dezimal: dezimalzeichen } = zahlTrennzeichen();
    const spanne = document.createElement('span');
    spanne.className = 'zahl-skaliert';

    const istZiffer = (z) => z >= '0' && z <= '9';
    const istTrenner = (z) => z === gruppenzeichen || z === dezimalzeichen;

    const ersteZiffer = [...text].findIndex(istZiffer);
    if (ersteZiffer === -1) { spanne.textContent = text; return spanne; }

    // Der Ziffernkoerper endet beim ersten Zeichen, das weder Ziffer noch
    // Trennzeichen der aktuellen Sprache ist - alles danach ist Einheit
    // (" €", " %", " kg"). Bewusst NICHT ueber alle Ziffern der ganzen
    // Zeichenkette hinweg: bei "30-70 %" waere sonst die 70 Teil desselben
    // Koerpers und die Zaehlung der geltenden Ziffern liefe ueber zwei
    // getrennte Zahlen hinweg.
    let koerperEnde = ersteZiffer;
    while (koerperEnde < text.length && (istZiffer(text[koerperEnde]) || istTrenner(text[koerperEnde]))) koerperEnde++;
    // Ein Trennzeichen unmittelbar VOR der Einheit gehoert nicht mehr zur
    // Zahl (kaeme in keinem heutigen Format vor, waere aber sonst eine
    // stumme Verschiebung um ein Zeichen).
    while (koerperEnde > ersteZiffer && istTrenner(text[koerperEnde - 1])) koerperEnde--;

    const leise = (inhalt) => {
        if (!inhalt) return;
        const el = document.createElement('span');
        el.className = 'zahl-nebenteil';
        el.textContent = inhalt;
        spanne.append(el);
    };

    // ----- Vorspann: Vorzeichen stark, Waehrungszeichen und Leerraum leise -----
    // Zeichenweise getrennt statt in einem Stueck, weil "-€1,234.50"
    // (en-US, negativ) beides enthaelt und in dieser Reihenfolge.
    // U+2212 (echtes Minuszeichen) neben dem ASCII-Bindestrich: Intl
    // liefert je nach Sprache das eine oder das andere.
    let stapel = '';
    const stapelLeeren = () => { leise(stapel); stapel = ''; };
    for (const zeichen of text.slice(0, ersteZiffer)) {
        if (zeichen === '-' || zeichen === '−' || zeichen === '+') {
            stapelLeeren();
            spanne.append(zeichen);
        } else {
            stapel += zeichen;
        }
    }
    stapelLeeren();

    // ----- Ziffernkoerper -----
    // gezaehlt wird ab der ersten Ziffer ungleich null; ist die Zahl
    // insgesamt null ("0", "0,00"), gibt es keine geltende Ziffer - dann
    // traegt die erste Null selbst die ganze Aussage und bleibt stark,
    // statt dass eine Null gaenzlich verblasst.
    const koerper = text.slice(ersteZiffer, koerperEnde);
    const hatZifferUngleichNull = [...koerper].some((z) => istZiffer(z) && z !== '0');
    // Bei einer glatten Null gibt es nichts zu skalieren: die EINE Null
    // ist die Aussage, jede weitere ("0,00") nur Formatierung.
    const geltendeGrenze = hatZifferUngleichNull ? GELTENDE_ZIFFERN : 1;
    let geltendeGesehen = 0;
    let ersteZifferUngleichNullGesehen = false;
    for (const zeichen of koerper) {
        if (!istZiffer(zeichen)) { stapel += zeichen; continue; }        // Trennzeichen: immer leise
        if (!ersteZifferUngleichNullGesehen && zeichen === '0' && hatZifferUngleichNull) {
            stapel += zeichen;                                            // fuehrende Null: traegt nichts
            continue;
        }
        ersteZifferUngleichNullGesehen = true;
        if (geltendeGesehen < geltendeGrenze) {
            stapelLeeren();
            spanne.append(zeichen);
            geltendeGesehen++;
        } else {
            stapel += zeichen;                                            // jenseits der geltenden Ziffern
        }
    }
    stapelLeeren();

    // ----- Nachspann: Einheit -----
    leise(text.slice(koerperEnde));
    return spanne;
}

// ===== Kopftafel: der Kopfbereich JEDES Arbeitsbereichs =====
//
// DAS MUSTER, UND WARUM ES DAS KACHELBAND ABLOEST (Gestaltungsauftrag,
// woertlich: "insgesamt sind die Header allesamt mangelhaft und entwerten
// alles. Das muss um Laengen besser werden, viel analytischer, viel
// bessere und professionellere Datenvisualisierung a la Tufte/Bissantz/
// Hichert.").
//
// Das abgeloeste Muster war die Dashboard-Kachel: vier bis fuenf Felder
// nebeneinander, in jedem eine grosse Zahl, eine kleine Grafik, eine
// Hinweiszeile. Auf gut tausend Pixel Breite standen darin, ueber alle
// fuenf Bereiche gemittelt, ein gutes Dutzend Werte - und jeder davon
// eine ZAEHLUNG aus genau der Liste, die zwei Zentimeter darunter
// ohnehin steht. Vier Nachbesserungen haben die Kacheln huebscher
// gemacht, ohne dass sie mehr gesagt haetten. Genau dieses Muster
// kritisieren die drei genannten Schulen; mehr Innenabstand um eine
// informationsarme Flaeche herum macht sie nicht reicher.
//
// Die Kopftafel dreht die Anordnung um: statt WENIGER KACHELN
// NEBENEINANDER stehen VIELE ZEILEN UNTEREINANDER, und jede Zeile ist
// GLEICH GEBAUT. Die Zeilen sind die natuerliche Gliederung des
// Bestands, ueber den die Liste darunter Auskunft gibt (die fuenf
// Modellzeilen, die zehn Stationen, die fuenf Tarifgruppen, die drei
// Radtypen) - und
// wo der Bestand klein genug ist, um jeden Fall selbst zu zeigen, SIND
// die Zeilen die Faelle (Instandhaltung, sieben Meldungen). Das ist die
// eine Regel, aus der alles Uebrige folgt: DIE ZEILE IST DIE FEINSTE
// GLIEDERUNG, DIE NOCH IN DEN KOPF PASST.
//
// Die Spalten sind in JEDEM Bereich dieselben Fragen, in derselben
// Reihenfolge, mit derselben Notation (Hichert/IBCS):
//
//   1. RUBRIK           wer oder was
//   2. ZAHL             wie viel, OHNE Balken - fuer eine Groesse, die
//                       genannt werden muss, deren Werte sich aber
//                       nicht genug unterscheiden, als dass ein
//                       Laengenvergleich etwas zeigte (siehe unten)
//   3. GROESSE          wie viel  - Zahl UND Balken, gemeinsame
//                       Nullpunkt-Skala ueber alle Zeilen (Bissantz);
//                       optional mit einem BEZUGSRAHMEN, wenn es eine
//                       fachliche Obergrenze gibt (Kapazitaet)
//   4. ZUSAMMENSETZUNG  woraus    - 100-%-Strukturbalken, dadurch
//                       zwischen ungleich grossen Zeilen vergleichbar
//   5. PROFIL           wie verteilt oder entwickelt - Kleingrafik mit
//                       gemeinsamer Skala ueber alle Zeilen (Tufte,
//                       small multiples)
//   6. ABWEICHUNG       wie weit vom Bezug - eigene Spalte, eigene um
//                       die Null zentrierte Skala, Vorzeichenfarbe
//                       (Hichert/IBCS, Rang 3 der Farbordnung)
//
// EINE SPALTE, DIE IN EINEM BEREICH NICHTS EHRLICHES ZU SAGEN HAT, FAELLT
// WEG - sie wird NICHT mit einem Platzhalter gefuellt und auch nicht
// schoener gezeichnet. Instandhaltung hat keine Abweichungsspalte, weil
// es bei sieben gleichzeitig gemeldeten Faellen keinen Bezugswert gibt,
// gegen den zu messen waere; die Fussnote sagt das ausdruecklich. Eine
// erfundene Kennzahl waere der schwerere Fehler als eine fehlende
// Spalte.
//
// DIE PRUEFUNG, DIE UEBER EINE SPALTE ENTSCHEIDET (Auftrag, woertlich:
// "Geh jede Grafik in jeder der neun Tafeln durch und pruefe, ob ihre
// Daten sie tragen."). Drei Fragen, an den echten Werten gemessen und
// im Bericht mit Zahlen belegt:
//   1. Unterscheiden sich die Werte genug, dass man es SIEHT?
//      (Spannweite, Zahl der Nullen, Verhaeltnis groesster zu kleinstem)
//   2. Ist die Darstellungsart die richtige fuer DIESE Verteilung?
//   3. Beantwortet die Grafik eine Frage, die jemand hat?
// Fuenf Spalten haben diese Pruefung nicht bestanden und sind gestrichen
// bzw. ersetzt - die Begruendung steht jeweils an ihrer Stelle im
// Bereich. Am deutlichsten der Tagesgang der Stationen: sechs von zwoelf
// Zweistundenfenstern exakt null, Hoechstwert 0,82 Abgaenge je Werktag,
// und die FORM ueber alle zehn Stationen praktisch gleich (6-8 Uhr
// zwischen 20,8 und 23,6 Prozent, 16-18 Uhr zwischen 33,4 und 38,4
// Prozent). Zehn small multiples, die dasselbe zeigen, sind keine small
// multiples, sondern zehnmal dieselbe Grafik.
//
// DIE GEMEINSAMEN SKALEN RECHNET DIESE FUNKTION, NICHT DER BEREICH.
// Das ist der eigentliche Grund, warum die Tafel ein eigener Baustein
// ist und nicht fuenfmal von Hand gebaut wird: "gemeinsame Skala" ist
// die Regel, an der Balkenvergleiche am leichtesten stumm scheitern
// (siehe balkenSpalten() weiter unten, das genau diesen Fehler schon
// einmal beheben musste). Hier kann kein Bereich sie versehentlich je
// Zeile neu bilden - er liefert Werte, die Tafel bildet das Maximum.
//
// Find-or-create auf eine feste id, unmittelbar vor listenKoerper()
// eingehaengt - dieselbe Machart wie reiterleiste()/werkzeugleiste()
// oben, damit die Tafel unabhaengig von der Aufrufreihenfolge immer
// zwischen Reiter-/Werkzeug-/Filterleiste und der Tabelle steht.
// Fortlaufend, damit die ids der Beschriftung (aria-labelledby, siehe
// unten) ueber mehrere Aufbauten hinweg eindeutig bleiben: waehrend eines
// Reiterwechsels koennen die alte und die neue Tafel fuer einen
// Wimpernschlag gleichzeitig im Baum stehen, und zwei Elemente mit
// derselben id machen jedes aria-labelledby mehrdeutig.
let kopftafelZaehler = 0;

// ===== Ein-/Ausklappen der Kopftafel (Gestaltungsauftrag, woertlich:
// "Der Kopfbereich muss ein-/ausklappbar sein, sonst erschlaegt er auch
// [...] Die Kopfzeilen muessen wie eine Art Projektionswand sein, die
// ich runterklappen kann, wenn ich Uebersichten oder Analysen
// brauche.") =====
//
// VORGABEZUSTAND: EINGEKLAPPT. Eine Projektionswand haengt normalerweise
// OBEN und wird heruntergezogen, wenn man sie braucht - sie haengt nicht
// im Regelfall schon unten. Diese Warenwirtschaft wird "acht Stunden am
// Tag benutzt, nicht acht Sekunden" (siehe Kopfkommentar bei .kopftafel
// in style.css): der haeufigste Fall ist die Person, die den ganzen Tag
// Raeder umbucht und die LISTE braucht, nicht neun Tabellen voller
// Kennzahlen ueber jeder Liste. Die Uebersicht bleibt einen Klick bzw.
// einen Tastendruck entfernt, aber sie draengt sich nicht jedem aufs
// Neue auf - genau das war der urspruengliche Befund ("erschlaegt").
//
// WAS EINGEKLAPPT STEHEN BLEIBT: Titel und Bezugszeile (tafel.bild
// eingeschlossen). Eine Tafel, die spurlos verschwaende, wuerde
// vergessen - die Kopfzeile allein beantwortet aber bereits "worueber
// rede ich hier" ("275 Raeder in 5 Modellzeilen von 5 Herstellern..."), ohne
// die vollen 60 bis 170 Einzelwerte der Tabelle zu zeigen. Nur
// .kopftafel-tabelle und .kopftafel-fussnote verschwinden (siehe
// .kopftafel-eingeklappt in style.css) - kopf.kopftexte bleibt immer im
// DOM.
//
// EIN GEMEINSAMER SCHALTER FUER ALLE NEUN TAFELN, nicht neun einzelne:
// dieselbe Ueberlegung wie beim Zebramuster (ZEBRA_SPEICHERSCHLUESSEL
// weiter unten) - eine reine Anzeigepraeferenz ohne fachlichen Bezug zu
// EINEM bestimmten Bereich. Wer sich entscheidet "ich will jetzt die
// Listen sehen, keine Uebersichten", meint das fuer die ganze Sitzung,
// nicht nur fuer Flotte. localStorage ueberlebt dieselben drei Faelle
// wie beim Zebramuster: Bereichswechsel und Neuaufbau leeren nur
// #arbeitsliste (siehe bereichWechseln()), ein Neuladen der Seite den
// Browserspeicher ohnehin nicht.
const KOPFTAFEL_SPEICHERSCHLUESSEL = 'velocity-wawi-kopftafel-eingeklappt';

// Fehlender Schluessel (erster Besuch dieses Browsers) => eingeklappt
// (Vorgabezustand, siehe oben) - deshalb hier NICHT wie bei
// zebraGespeichert() ein einfaches "=== 'an'" (das ergaebe bei einem
// fehlenden Schluessel "aus"), sondern der umgekehrte Vergleich: nur ein
// ausdruecklich gespeichertes 'aus' schaltet den Vorgabezustand ab.
function kopftafelEingeklappt() {
    return localStorage.getItem(KOPFTAFEL_SPEICHERSCHLUESSEL) !== 'aus';
}

// Baut NUR den Umschalter-Knopf - eingehaengt in .kopftafel-kopf, siehe
// zeigeKopftafel(). wurzel (das <section id="kopftafel">) und tabelleId
// werden als Referenz/Wert hereingereicht statt neu gesucht: beide
// liegen zum Zeitpunkt dieses Aufrufs (kurz vor wurzel.append(kopf) in
// zeigeKopftafel()) bereits vor, auch wenn die Tabelle selbst das DOM
// erst gleich danach erreicht - ein Zugriff ueber wurzel als
// Objektreferenz, nicht als DOM-Suche, funktioniert deshalb unabhaengig
// von der Einhaengereihenfolge; die Klasse fuer den eingeklappten
// Zustand sitzt ohnehin auf wurzel selbst (siehe anwenden() unten und
// .kopftafel-eingeklappt in style.css), nicht auf der Tabelle.
function kopftafelUmschalterKnopf(wurzel, tabelleId) {
    const knopf = document.createElement('button');
    knopf.type = 'button';
    knopf.className = 'kopftafel-umschalter';
    knopf.setAttribute('aria-controls', tabelleId);
    // EIN statischer Name statt zweier Zustandstexte (einklappen/
    // ausklappen): dieselbe Ueberlegung wie bei knopfProfil weiter unten
    // - aria-expanded traegt den WECHSELNDEN Zustand bereits, ein
    // Bildschirmleser haengt "eingeklappt"/"ausgeklappt" von sich aus an
    // den Namen an. Zwei Uebersetzungsschluessel fuer denselben Knopf
    // waeren doppelte Pflege ohne zusaetzlichen Nutzen.
    const beschriftung = t('board.toggleAria');
    knopf.setAttribute('aria-label', beschriftung);
    knopf.title = beschriftung;   // dieselbe Kurzfassung als Maus-Tooltip, wie bei schliessenKnopf.title weiter unten

    const symbol = document.createElementNS(SVG_NS, 'svg');
    symbol.setAttribute('viewBox', '0 0 18 18');
    symbol.setAttribute('aria-hidden', 'true');
    symbol.setAttribute('focusable', 'false');
    const pfeil = document.createElementNS(SVG_NS, 'polyline');
    pfeil.setAttribute('points', '4,7 9,12 14,7');
    symbol.append(pfeil);
    knopf.append(symbol);

    function anwenden(eingeklappt) {
        wurzel.classList.toggle('kopftafel-eingeklappt', eingeklappt);
        knopf.setAttribute('aria-expanded', String(!eingeklappt));
        // GESTALTUNGSAUFTRAG Punkt 2, woertlich genannter Stolperstein:
        // "ein Fenster, das haengenbleibt ... wenn die Tafel eingeklappt
        // wird". Einklappen entfernt die Tabelle per CSS (display:none,
        // siehe .kopftafel-eingeklappt in style.css) UNTER einem
        // moeglicherweise gerade offenen Hinweisfenster - ohne Mausbewegung
        // feuert dabei kein mouseleave, das Fenster bliebe offen und
        // zeigte auf eine jetzt unsichtbare Grafik.
        if (eingeklappt) hinweisfensterVerstecken();
    }
    anwenden(kopftafelEingeklappt());

    knopf.addEventListener('click', () => {
        const neu = !wurzel.classList.contains('kopftafel-eingeklappt');
        anwenden(neu);
        localStorage.setItem(KOPFTAFEL_SPEICHERSCHLUESSEL, neu ? 'an' : 'aus');
        // "Etwas, das aufklappt, springt heute nicht" (Auftrag). Die
        // Bewegung selbst steht in style.css (@keyframes
        // kopftafel-aufklappen); hier wird nur der AUSLOESER markiert -
        // und ausdruecklich NUR der Klick. Ein Bereichs- oder
        // Reiterwechsel baut dieselbe Tafel ebenfalls neu auf, und die
        // duerfte dabei nicht mitwackeln: eine Bewegung, die bei jedem
        // Filterklick anspringt, ist Zappeln, keine Rueckmeldung.
        // Die Klasse wird nach dem Lauf wieder entfernt, sonst bliebe sie
        // am wiederverwendeten <section id="kopftafel"> haengen (siehe
        // kopftafelWurzel(): das Element ueberlebt den Neuaufbau).
        // { once: true } auf 'animationend': ohne Bewegung
        // (prefers-reduced-motion, siehe style.css) feuert das Ereignis
        // nie - deshalb zusaetzlich ein Zeitgeber als Rueckfall, damit
        // die Klasse dort nicht ewig stehen bleibt.
        wurzel.classList.add('kopftafel-bewegt');
        const aufraeumen = () => wurzel.classList.remove('kopftafel-bewegt');
        wurzel.addEventListener('animationend', aufraeumen, { once: true });
        setTimeout(aufraeumen, 400);
    });

    return knopf;
}

function kopftafelWurzel() {
    // ZWEITER Fall desselben Stolpersteins (siehe der Kommentar bei
    // anwenden() in kopftafelUmschalterKnopf() oben): ein Reiter- oder
    // Bereichswechsel kann eine Tafel neu aufbauen, WAEHREND der Zeiger
    // noch auf einer Grafik der ALTEN steht - el.replaceChildren() weiter
    // unten reisst deren Elemente aus dem DOM, wieder ohne ein
    // mouseleave, das das Hinweisfenster von selbst schliessen wuerde.
    hinweisfensterVerstecken();
    const wurzel = document.getElementById('arbeitsliste');
    let el = document.getElementById('kopftafel');
    if (!el) {
        el = document.createElement('section');
        el.id = 'kopftafel';
        el.className = 'kopftafel';
    }
    wurzel.insertBefore(el, listenKoerper());
    el.replaceChildren();
    return el;
}

// kennung: dieselbe Wettlaufabsicherung wie bei zeigeListe()/
// zeigeLeermaske() - ein Reiterwechsel, dessen Kopftafel erst nach einem
// eigenen await zurueckkommt, darf einen inzwischen ueberholten
// Bildschirm nicht mehr beschreiben (siehe neuerVorgang()).
//
// tafel === null (oder ohne Zeilen) raeumt die Tafel ab, statt sie leer
// stehen zu lassen - derselbe Grund wie bei zeigeWerkzeugleiste(false):
// ohne dieses ausdrueckliche Abraeumen ueberlebte die Tafel des
// VORHERIGEN Reiters einen Reiterwechsel, der selbst keine mehr zeigen
// will (bereichWechseln() leert #arbeitsliste nur beim BEREICHSwechsel).
//
// tafel = {
//   titel:     was die Tafel gliedert ("Bestand nach Modell")
//   bezug:     EINE Zeile Grundgesamtheit und Bezugsraum - die Angabe,
//              ohne die keine Zahl darunter einzuordnen waere
//   bild:      { quelle, alt } optional - ein Produktbild, das eine
//              Aussage TRAEGT (siehe instandhaltung.js), nicht schmueckt
//   spalten:   siehe kopftafelSpalte() unten
//   zeilen:    beliebige Objekte; zeile.istGruppe === true macht daraus
//              eine Gruppenzeile (bleibt aus jeder gemeinsamen Skala
//              heraus, siehe unten)
//   summe:     optionale Zeile fuer den Tabellenfuss (ebenfalls aus den
//              Skalen heraus: ein Gesamtwert sprengte jede Zeilenskala)
//   fussnote:  optional - wo eine Spalte fehlt oder eine Zahl eine
//              Einschraenkung traegt, steht der Grund HIER und nicht in
//              einem Handbuch
// }
function zeigeKopftafel(kennung, tafel) {
    if (!istAktuellerVorgang(kennung)) return;
    const wurzel = kopftafelWurzel();
    if (!tafel || !tafel.zeilen || tafel.zeilen.length === 0) { wurzel.remove(); return; }

    // ----- Gemeinsame Skalen, EINMAL ueber alle Datenzeilen -----
    // Gruppenzeilen und die Summenzeile bleiben ausdruecklich draussen:
    // ein Gruppen- oder Gesamtwert ist per Bauart groesser als jede
    // Einzelzeile und wuerde die Skala so stauchen, dass die
    // Einzelzeilen - um die es geht - nicht mehr unterscheidbar waeren.
    const datenzeilen = tafel.zeilen.filter((z) => !z.istGruppe);
    const skalen = tafel.spalten.map((spalte) => kopftafelSkala(spalte, datenzeilen));

    // ----- Tabelle -----
    const tabelle = document.createElement('table');
    tabelle.className = 'kopftafel-tabelle';

    // DIE BESCHRIFTUNG STEHT NEBEN DER TABELLE, NICHT ALS <caption> IN
    // IHR - und ist ueber aria-labelledby trotzdem ihr zugaenglicher
    // Name. Der Grund ist Layout, nicht Semantik: eine <caption> geht in
    // die Breitenrechnung der Tabelle ein, und die Bezugszeile ist oft
    // ueber 120 Zeichen lang. Die Tabelle wurde dadurch auf die Laenge
    // eines Satzes gezogen, und zwischen dem Rubriknamen und seiner Zahl
    // standen mehrere hundert Pixel Leerraum - eine Zahlenkolonne, die
    // man mit dem Finger suchen muss (im Browser gemessen, siehe
    // Bericht). Mit aria-labelledby bleibt der Name der Tabelle
    // vollstaendig erhalten (Titel UND Bezugszeile, in dieser
    // Reihenfolge), ohne dass ein Bildschirmleser etwas doppelt
    // vorliest.
    kopftafelZaehler += 1;
    const titelId = `kopftafel-titel-${kopftafelZaehler}`;
    const bezugId = `kopftafel-bezug-${kopftafelZaehler}`;
    tabelle.id = `kopftafel-tabelle-${kopftafelZaehler}`;

    const kopf = document.createElement('div');
    kopf.className = 'kopftafel-kopf';
    if (tafel.bild) {
        const bild = document.createElement('img');
        bild.className = 'kopftafel-bild';
        bild.src = tafel.bild.quelle;
        // alt TRAEGT hier etwas (anders als bei den frueheren
        // Radtyp-Kacheln, wo der Typname unmittelbar daneben stand und das
        // Bild ihn nur wiederholte): dieses Bild IST der Befund - "alle
        // sieben Meldungen betreffen City-Bikes" (instandhaltung.js).
        bild.alt = tafel.bild.alt;
        // Ein fehlendes Bild darf den Kopf nicht zerreissen - es raeumt
        // sich selbst weg statt als kaputtes Symbol stehenzubleiben.
        bild.addEventListener('error', () => bild.remove());
        kopf.append(bild);
    }
    const kopftexte = document.createElement('div');
    kopftexte.className = 'kopftafel-kopftexte';
    const titel = document.createElement('h2');
    titel.className = 'kopftafel-titel';
    titel.id = titelId;
    titel.textContent = tafel.titel;
    kopftexte.append(titel);
    if (tafel.bezug) {
        const bezug = document.createElement('p');
        bezug.className = 'kopftafel-bezug';
        bezug.id = bezugId;
        bezug.textContent = tafel.bezug;
        kopftexte.append(bezug);
    }
    kopf.append(kopftexte);
    // Der Umschalter steht IM Kopf, nicht daneben: er gehoert zu genau
    // der Zeile, die eingeklappt sichtbar bleibt (siehe Kopfkommentar bei
    // kopftafelEingeklappt() oben) - dieselbe raeumliche Naehe wie bei
    // jedem anderen Auf-/Zuklapp-Knopf dieser Oberflaeche (z. B.
    // knopfProfil neben dem, was er oeffnet).
    kopf.append(kopftafelUmschalterKnopf(wurzel, tabelle.id));
    wurzel.append(kopf);
    tabelle.setAttribute('aria-labelledby', tafel.bezug ? `${titelId} ${bezugId}` : titelId);

    const kopfzeile = document.createElement('tr');
    tafel.spalten.forEach((spalte) => {
        const th = document.createElement('th');
        th.setAttribute('scope', 'col');
        // Zwei physische Spalten fuer Groesse und Abweichung (Zahl und
        // Balken getrennt): eine gemeinsame Zelle liesse die Nulllinie
        // des Balkens mit der Breite der Zahl von Zeile zu Zeile wandern -
        // derselbe Befund, den balkenSpalten() weiter unten schon einmal
        // beheben musste.
        if (spalte.art === 'groesse' || spalte.art === 'abweichung') th.setAttribute('colspan', '2');
        th.className = `kopftafel-kopf-${spalte.art}`;
        const name = document.createElement('span');
        name.className = 'kopftafel-spaltenname';
        name.textContent = spalte.titel;
        th.append(name);
        // DIE EINHEIT GEHOERT IN DEN SPALTENKOPF (Hichert/IBCS): eine
        // Zahlenspalte, die nicht sagt, WORIN sie misst, ist eine
        // Ratefrage. Zweite, leisere Zeile im selben <th>, damit sie
        // nicht als eigene Tabellenzeile Hoehe kostet.
        if (spalte.einheit) {
            const einheit = document.createElement('span');
            einheit.className = 'kopftafel-spalteneinheit';
            einheit.textContent = spalte.einheit;
            th.append(einheit);
        }
        kopfzeile.append(th);
    });
    // ===== Fuellspalte (Gestaltungsauftrag "Loch in der Mitte") =====
    // Jede Grafikspalte schrumpft jetzt per width:1% auf ihre Grafik
    // (siehe .kopftafel-grafik-* in style.css - derselbe Kniff, den
    // .kopftafel-rubrik/.kopftafel-zahl in dieser Datei schon frueher
    // gegen Chromiums ignorierte max-width bei automatischem
    // Tabellenlayout einsetzen mussten). Die dadurch freiwerdende Breite
    // MUSS irgendwohin - sie GESAMMELT an EINER Stelle zu lassen, statt
    // sie unbemerkt auf alle Spalten zu verteilen, war ausdruecklich
    // verlangt ("nicht verteilt ... sondern gesammelt"). Diese letzte,
    // absichtlich leere Spalte OHNE eigene Breitenangabe ist der
    // Sammelpunkt: eine Tabellenspalte ohne width/min-width bekommt im
    // automatischen Layout den gesamten Rest zugeteilt, den die anderen
    // (alle mit width:1% + einer festen min-width) nicht beanspruchen -
    // "rechts hinter der letzten Spalte" statt in der Rubrik, weil ein
    // Zugewinn DORT wieder genau die Luecke zwischen Namen und seiner
    // ersten Zahl aufgerissen haette, die width:1% an der Rubrik oben
    // erst behoben hat (siehe der Kommentar bei .kopftafel-rubrik in
    // style.css). aria-hidden, weil sie nichts traegt - fuer
    // Bildschirmleser ist sie so, als gaebe es sie nicht.
    const fuellzelleKopf = document.createElement('th');
    fuellzelleKopf.setAttribute('scope', 'col');
    fuellzelleKopf.className = 'kopftafel-fuellspalte';
    fuellzelleKopf.setAttribute('aria-hidden', 'true');
    kopfzeile.append(fuellzelleKopf);
    const kopfteil = document.createElement('thead');
    kopfteil.append(kopfzeile);
    tabelle.append(kopfteil);

    const koerper = document.createElement('tbody');
    for (const zeile of tafel.zeilen) {
        koerper.append(kopftafelZeile(zeile, tafel.spalten, skalen, zeile.istGruppe ? 'gruppe' : 'daten'));
    }
    tabelle.append(koerper);

    if (tafel.summe) {
        const fuss = document.createElement('tfoot');
        fuss.append(kopftafelZeile(tafel.summe, tafel.spalten, skalen, 'summe'));
        tabelle.append(fuss);
    }
    wurzel.append(tabelle);

    if (tafel.fussnote) {
        const fussnote = document.createElement('p');
        fussnote.className = 'kopftafel-fussnote';
        fussnote.textContent = tafel.fussnote;
        wurzel.append(fussnote);
    }
}

// Die gemeinsame Skala EINER Spalte ueber ALLE Datenzeilen - siehe der
// Absatz "DIE GEMEINSAMEN SKALEN RECHNET DIESE FUNKTION" oben.
//
// 'groesse': das Maximum, denn Laenge kodiert - der Nullpunkt ist
//   Pflicht und liegt fest bei 0 (Hausregel des Projekts, dieselbe wie
//   bei saeulengrafik()/saeulenSparkline()).
// 'abweichung': der groesste BETRAG, denn die Skala ist um die Null
//   symmetrisch - sonst waere eine Abweichung von -65 kuerzer oder
//   laenger als eine von +65.
// 'profil': Minimum UND Maximum ueber alle Reihen bzw. alle Punkte
//   zusammen - hier kodiert Position, eine beschnittene Achse ist also
//   zulaessig (Baujahre bei 0 beginnen zu lassen waere Unsinn); ist die
//   Reihe eine Saeulenreihe, zieht saeulenSparkline() die Null von sich
//   aus mit hinein, weil dort wieder Laenge kodiert.
function kopftafelSkala(spalte, datenzeilen) {
    if (spalte.art === 'groesse') {
        const werte = datenzeilen.map((z) => Number(spalte.wert(z)) || 0);
        // Traegt die Spalte einen BEZUG (spalte.bezug, siehe zellbalken()
        // in rahmen.js - die Kapazitaet, in der die Belegung steht), geht
        // er MIT in die gemeinsame Skala: Rahmen und Fuellung muessen
        // dieselbe Skala teilen, sonst waere ein Rahmen laenger als die
        // Skala, die ihn zeichnet. Der Bezug ist fachlich immer >= dem
        // Wert (eine Station ist nie ueberbelegt), Math.max deckt
        // trotzdem beide Faelle ab, statt sich darauf zu verlassen.
        if (spalte.bezug) {
            werte.push(...datenzeilen.map((z) => Number(spalte.bezug(z)) || 0));
        }
        return { maximum: Math.max(0, ...werte) };
    }
    if (spalte.art === 'abweichung') {
        const werte = datenzeilen.map((z) => Math.abs(Number(spalte.wert(z)) || 0));
        return { maximumBetrag: Math.max(0, ...werte) };
    }
    if (spalte.art === 'profil') {
        const alle = [];
        for (const zeile of datenzeilen) {
            if (spalte.reihe) alle.push(...(spalte.reihe(zeile) || []).map((w) => Number(w) || 0));
            else if (spalte.punkt) {
                const w = spalte.punkt(zeile);
                if (w !== null && w !== undefined) alle.push(Number(w));
            }
        }
        if (alle.length === 0) return { minimum: 0, maximum: 1 };
        return { minimum: Math.min(...alle), maximum: Math.max(...alle) };
    }
    return {};
}

// art: 'daten' | 'gruppe' | 'summe' - Gruppen- und Summenzeilen zeigen
// nur, was fuer sie ehrlich ist: eine Zahl und (bei einer Gruppe) ihre
// Zusammensetzung, aber KEINEN Balken auf einer Skala, aus der sie
// herausgenommen wurden, und kein Profil und keine Abweichung, die es
// fuer eine Zusammenfassung gar nicht gibt.
function kopftafelZeile(zeile, spalten, skalen, art) {
    const tr = document.createElement('tr');
    tr.className = `kopftafel-zeile kopftafel-zeile-${art}`;

    // Der Rubrikname dieser Zeile, VORAB einmal ermittelt - fuer den
    // Mouse-over-Text des Groessenbalkens weiter unten (Gestaltungs-
    // auftrag Punkt 4: "ein Wert ohne Bezug hilft nicht"). Die
    // Rubrikspalte kommt in JEDER Kopftafel als ERSTE Spalte (siehe die
    // spalten-Definitionen in den fuenf Bereichen), aber .find() statt
    // spalten[0] verlaesst sich nicht auf diese Reihenfolge.
    const rubrikSpalte = spalten.find((s) => s.art === 'rubrik');
    const rubrikName = rubrikSpalte ? rubrikSpalte.wert(zeile) : '';

    spalten.forEach((spalte, i) => {
        const skala = skalen[i];

        if (spalte.art === 'rubrik') {
            const th = document.createElement('th');
            th.setAttribute('scope', 'row');
            th.className = 'kopftafel-rubrik';
            if (spalte.bild) {
                const quelle = spalte.bild(zeile);
                if (quelle) {
                    const bild = document.createElement('img');
                    bild.className = 'kopftafel-zeilenbild';
                    bild.src = quelle;
                    // Rein schmueckend: der Name steht unmittelbar
                    // daneben (siehe die Begruendung bei tafel.bild oben,
                    // dort liegt der Fall anders herum).
                    bild.alt = '';
                    bild.setAttribute('aria-hidden', 'true');
                    bild.addEventListener('error', () => bild.remove());
                    th.append(bild);
                }
            }
            const texte = document.createElement('span');
            texte.className = 'kopftafel-rubriktexte';
            const name = document.createElement('span');
            name.className = 'kopftafel-rubrikname';
            name.textContent = spalte.wert(zeile);
            texte.append(name);
            const zusatz = spalte.zusatz ? spalte.zusatz(zeile) : null;
            if (zusatz) {
                const nebenname = document.createElement('span');
                nebenname.className = 'kopftafel-rubrikzusatz';
                nebenname.textContent = zusatz;
                texte.append(nebenname);
            }
            th.append(texte);
            tr.append(th);
            return;
        }

        // 'zahl': eine Zahl OHNE Balken, EINE Zelle statt zweier.
        //
        // Der Anlass ist eine Pruefung, die zwei Groessenspalten nicht
        // bestanden haben (Auftrag: "Unterscheiden sich die Werte genug,
        // dass man es sehen kann?"). Die Arbeitszeit der Instandhaltung
        // ist in FUENF von SIEBEN Faellen exakt null - fuenf unsichtbare
        // Balken, in denen "noch nicht bearbeitet" und "keine Angabe"
        // gleich aussehen. Und der Zwoelfmonatsumsatz der drei Radtypen
        // liegt zwischen 11.219 und 12.628 Euro, ein Verhaeltnis von
        // 1,13 zu 1: drei Balken zwischen 89 und 100 Prozent Laenge,
        // zwischen denen kein Auge unterscheidet.
        //
        // Beide Zahlen bleiben trotzdem stehen - eine Tafel ueber
        // Arbeitszeit ohne Arbeitszeit waere albern. Nur ihr Balken
        // faellt weg. Das ist der ehrliche Schnitt: der Wert steht da,
        // die Grafik behauptet keinen Unterschied mehr, den es nicht
        // gibt. Wo der Vergleich stattdessen sichtbar wird, sagt die
        // jeweilige Fussnote.
        if (spalte.art === 'zahl') {
            const wert = spalte.wert(zeile);
            const zelle = document.createElement('td');
            zelle.className = 'kopftafel-zahl kopftafel-zahl-zahl';
            if (wert !== null && wert !== undefined) {
                zelle.append(zahlSkaliert(spalte.format(wert)));
                if (spalte.klasse) zelle.classList.add(spalte.klasse(zeile));
            }
            tr.append(zelle);
            return;
        }

        if (spalte.art === 'groesse' || spalte.art === 'abweichung') {
            const wert = spalte.wert(zeile);
            const zahlZelle = document.createElement('td');
            zahlZelle.className = `kopftafel-zahl kopftafel-zahl-${spalte.art}`;
            if (wert === null || wert === undefined) {
                zahlZelle.textContent = '';
            } else {
                zahlZelle.append(zahlSkaliert(spalte.format(wert)));
                if (spalte.klasse) zahlZelle.classList.add(spalte.klasse(zeile));
            }
            const grafikZelle = document.createElement('td');
            grafikZelle.className = `kopftafel-grafik kopftafel-grafik-${spalte.art}`;
            // Balken NUR in Datenzeilen (siehe Kopfkommentar dieser
            // Funktion): Gruppen- und Summenwerte stehen ausserhalb der
            // gemeinsamen Skala, ein Balken dafuer waere entweder
            // uebergross oder auf die Skalenbreite gekappt - beides
            // waere eine falsche Laenge, und Laenge ist hier die Aussage.
            // Die Nulllinie laeuft durch JEDE Zeile, auch durch die ohne
            // Balken - siehe abweichungsAchse() weiter oben.
            if (spalte.art === 'abweichung'
                && !(art === 'daten' && wert !== null && wert !== undefined)) {
                grafikZelle.append(abweichungsAchse());
            }
            if (art === 'daten' && wert !== null && wert !== undefined) {
                grafikZelle.append(spalte.art === 'groesse'
                    ? zellbalken(wert, skala.maximum, null, {
                        breite: 76, hoehe: 11,
                        // RANG 4/2 DER FARBORDNUNG, falls der Bereich eine
                        // Bedeutung zu nennen hat (Zugehoerigkeit oder
                        // Schwelle) - sonst Rang 5, --marine.
                        farbe: spalte.farbe ? spalte.farbe(zeile) : 'var(--marine)',
                        // Der Bezugsrahmen, falls die Spalte einen kennt
                        // (Kapazitaet, in der die Belegung steht) - siehe
                        // zellbalken() in rahmen.js.
                        bezug: spalte.bezug ? spalte.bezug(zeile) : null,
                        // Mouse-over-Bezug (Gestaltungsauftrag Punkt 4):
                        // "60" allein sagt weniger als "CityLine 1: 60
                        // Raeder" - Rubrikname plus derselbe formatierte
                        // Wert, der ohnehin schon links daneben steht.
                        // Traegt die Spalte eine eigene beschriftung
                        // (weil Fuellung UND Rahmen erklaert werden
                        // muessen), hat die Vorrang.
                        beschriftung: spalte.beschriftung
                            ? spalte.beschriftung(zeile)
                            : `${rubrikName}: ${spalte.format(wert)}${spalte.einheit ? ' ' + spalte.einheit : ''}`
                    })
                    : abweichungsBalken(wert, skala.maximumBetrag, spalte.beschriftung(zeile)));
            }
            tr.append(zahlZelle, grafikZelle);
            return;
        }

        const zelle = document.createElement('td');
        // 'profil' bekommt eine ZWEITE, feinere Klasse zusaetzlich zur
        // groben (kopftafel-grafik-profil bleibt als gemeinsame
        // Grundlage bestehen, siehe style.css): eine Saeulenreihe mit
        // zwoelf Werten und ein einzelner Achsenpunkt teilten bislang
        // dieselbe Breitenvorgabe, obwohl sie fachlich UNTERSCHIEDLICH
        // viel Platz brauchen (Gestaltungsauftrag Punkt 3, woertlich:
        // "eine Grafik soll so breit sein, wie sie Information traegt").
        // spalte.reihe/spalte.punkt schliessen sich in jeder Definition
        // gegenseitig aus (siehe die Kommentare bei kopftafelSkala()
        // oben), die Unterscheidung ist also eindeutig.
        const profilUnterart = spalte.art === 'profil' ? (spalte.reihe ? 'profil-reihe' : 'profil-punkt') : null;
        zelle.className = `kopftafel-grafik kopftafel-grafik-${spalte.art}`
            + (profilUnterart ? ` kopftafel-grafik-${profilUnterart}` : '');

        if (spalte.art === 'struktur') {
            // Gruppenzeilen behalten ihren Strukturbalken: er ist auf
            // 100 % ihrer eigenen Summe normiert und deshalb - anders als
            // ein Laengenbalken - auch fuer eine Zusammenfassung richtig.
            if (art !== 'summe' || spalte.auchSumme) {
                zelle.append(strukturBalken(spalte.segmente(zeile), spalte.beschriftung(zeile)));
            }
        } else if (spalte.art === 'profil' && art === 'daten') {
            if (spalte.reihe) {
                const reihe = spalte.reihe(zeile) || [];
                if (reihe.length > 0) {
                    zelle.append(saeulenSparkline(reihe, spalte.beschriftung(zeile), {
                        breite: 96, hoehe: 16, aktuellIndex: spalte.aktuellIndex ?? null,
                        // DIE GEMEINSAME SKALE, hier durchgereicht: ohne
                        // sie skalierte jede Zeile auf ihr eigenes
                        // Maximum, zehn Reihen saehen gleich hoch aus und
                        // "small multiples" waeren blosse Zierschriften.
                        minimum: skala.minimum, maximum: skala.maximum,
                        // Mouse-over JE SAEULE (Gestaltungsauftrag Punkt 4,
                        // woertlich: "eine Saeulenreihe zwoelf Saeulen" -
                        // je Teil, nicht nur fuer die Reihe insgesamt).
                        // Optional, weil nicht jeder der sieben Aufrufer
                        // diese Funktion schon mitgibt (siehe dortige
                        // Nachtraege) - ohne sie bleibt es beim
                        // bisherigen Zustand (nur die Gesamt-beschriftung).
                        titelJeIndex: spalte.beschriftungTeil
                            ? (index, wert) => spalte.beschriftungTeil(zeile, index, wert)
                            : null
                    }));
                }
            } else if (spalte.punkt) {
                const punkt = spalte.punkt(zeile);
                if (punkt !== null && punkt !== undefined) {
                    zelle.append(lagepunkt(punkt, skala.minimum, skala.maximum, spalte.beschriftung(zeile)));
                }
            }
        }
        tr.append(zelle);
    });
    // Fuellspalte, JEDE Zeile - siehe die ausfuehrliche Begruendung an
    // ihrer Kopfzellen-Schwester in zeigeKopftafel() oben. Ohne sie in
    // Daten-/Gruppen-/Summenzeile gleichermassen haette die Tabelle in
    // manchen Zeilen eine Spalte mehr als in anderen, und ein
    // Tabellenlayout mit wechselnder Spaltenzahl ist kein Tabellenlayout
    // mehr.
    const fuellzelle = document.createElement('td');
    fuellzelle.className = 'kopftafel-fuellspalte';
    fuellzelle.setAttribute('aria-hidden', 'true');
    tr.append(fuellzelle);
    return tr;
}

// ===== Balkenspalte (Gestaltungsauftrag, Punkt 5) =====
//
// "Zudem ist die Ausrichtung der Balken nicht korrekt, da gibt es keine
// vertikale Flucht" - woertlich der Auftrag. Der Grund: zellbalken() legte
// Balken UND Betrag bislang in EINE Zelle, als rechtsbuendige GRUPPE
// (.zellbalken, justify-content: flex-end). Weil der Betrag mal 7,70 €
// und mal 2.011,20 € breit ist, verschob das die ganze Gruppe von Zeile
// zu Zeile unterschiedlich weit nach links - der Balken selbst teilte
// zwar mit jeder anderen Zeile dieselbe SKALA (maximum), aber nicht
// dieselbe NULLLINIE. Als Vergleichsmittel (Bissantz: "Zahlen sehen statt
// lesen") ist ein Balken ohne gemeinsame Nulllinie wertlos - genau der
// Befund, den diese Funktion behebt.
//
// Die Loesung ist keine neue Zeichentechnik, sondern eine ANDERE
// Tabellenstruktur: der Balken bekommt eine EIGENE Spalte fester Breite
// (.balken-spalte in style.css, 76px, unabhaengig vom Zelleninhalt),
// die Zahl eine ZWEITE, gewohnt rechtsbuendige Spalte daneben. Jede Zeile
// beginnt ihren Balken dadurch an DERSELBEN Bildschirmposition, egal wie
// breit der Betrag der jeweiligen Zeile ist.
//
// Liefert ZWEI Spaltendefinitionen zum Einfuegen in ein spalten-Array
// (Spread-Syntax, siehe Aufrufer in auswertungen.js) statt einer - der
// Baustein steht HIER, weil vier Berichte in auswertungen.js unabhaengig
// densselben Fehler geerbt haetten, waere er dort viermal von Hand
// nachgebaut worden (derselbe Befund wie bei werkzeugleiste()/
// kopftafelWurzel() weiter oben: ein wiederkehrendes Muster gehoert
// EINMAL nach rahmen.js, nicht mehrfach in einen Bereich).
//
// feld/titel: wie bei jeder Spalte - titel gilt fuer die ZAHLENSPALTE,
// die Balkenspalte bleibt visuell ohne Ueberschrift (siehe ariaLabel
// unten) statt denselben Titel ein zweites Mal zu zeigen.
// maximum: die gemeinsame Skala ueber ALLE sichtbaren Zeilen (Bissantz) -
// vom Aufrufer einmal ermittelt, wie bisher direkt an zellbalken()
// uebergeben.
// formatText(wert): formatiert NUR den Zahlwert zu einem fertigen String
// (z. B. geldFormat) - zahlSkaliert() wird hier zentral angewendet, ein
// Aufrufer muss es nicht mehr selbst tun.
// optionen.klasse: String ODER (zeile) => String fuer die Zahlenspalte,
// Vorgabe 'zahl' (siehe zahlKlasse() in auswertungen.js).
// optionen.farbe: String ODER (wert, zeile) => String, an zellbalken()
// weitergereicht - als Funktion, weil eine Balkenfarbe von der Zeile
// abhaengen kann (Stationsauslastung: bernstein sobald der Fuellstand
// voll ist).
// optionen.ariaLabel: der zugaengliche Name der titel-losen
// Balkenspalte, Vorgabe "<titel> (Balken)" - dieselbe Ueberlegung wie
// bei der Aktionen-Spalte in zeigeListe() weiter unten: keine sichtbare
// zweite Ueberschrift, aber eine <th> ohne jeden Namen liesse die Spalte
// fuer einen Screenreader namenlos wirken.
// optionen.summierbar: an die ZAHLENSPALTE (nicht an die namenlose
// Balkenspalte, dort waere eine Zwischensumme ohnehin unsichtbar)
// durchgereicht - siehe der lange Kommentar bei zeigeListe() oben, warum
// das der Bereich entscheiden muss und der Baustein es nicht selbst
// erraet ("umsatz" ist additiv, "umsatz_je_fahrt" waere es nicht).
function balkenSpalten(feld, titel, maximum, formatText, optionen = {}) {
    const { klasse = 'zahl', farbe = null, ariaLabel = `${titel} (Balken)`, summierbar = false } = optionen;
    return [
        {
            feld,
            titel: '',
            ariaLabel,
            klasse: 'balken-spalte',
            formatieren: (wert, zeile) => zellbalken(
                wert, maximum, null,
                farbe ? { farbe: typeof farbe === 'function' ? farbe(wert, zeile) : farbe } : {}
            )
        },
        {
            feld,
            titel,
            klasse,
            summierbar,
            formatieren: (wert) => zahlSkaliert(formatText(wert))
        }
    ];
}

// ===== Spaltenkopf: Sortieren, Filtern, Gruppieren =====
//
// "Man sollte immer bei den Spaltenkoepfen sortieren, filtern und
// gruppieren koennen - bei allen Tabellen", woertlich der Auftrag. "Bei
// allen Tabellen" heisst: ein Baustein HIER, kein Anbau in fuenf
// Dateien - genau wie Werkzeugleiste/Filterleiste/Uebersichtsstreifen
// weiter oben schon denselben Fund hatten (zwei Bereiche erfanden
// dieselbe Werkzeugleiste unabhaengig voneinander, siehe dortiger
// Kommentar). zeigeListe() bleibt deshalb nach aussen UNVERAENDERT
// (dieselben fuenf Parameter, derselbe erste Parameter "kennung" -
// tools/wawi_check.py prueft das ueber alle Aufrufer hinweg) - die drei
// Faehigkeiten haengen ausschliesslich an zusaetzlichen, OPTIONALEN
// Eigenschaften der einzelnen Spaltenobjekte, derselben Machart wie die
// bereits bestehenden "klasse"/"formatieren"/"ariaLabel":
//
//   sortierbar   (Vorgabe: true, sobald die Spalte einen titel traegt)
//   filterbar    (Vorgabe: true, sobald die Spalte einen titel traegt)
//   gruppierbar  (Vorgabe: true, sobald die Spalte einen titel traegt)
//   summierbar   (Vorgabe: false - MUSS vom Bereich ausdruecklich gesetzt
//                werden, siehe Begruendung weiter unten)
//   sortierwert(zeile)   liefert den VERGLEICHBAREN Wert fuer Sortierung
//                UND Gruppierung, wenn er vom rohen Feldwert abweicht
//                (siehe "Nach Wert, nicht nach Anzeige" unten)
//   filterTyp    'auswahl' | 'schwelle' | 'text' - erzwingt die Art des
//                Filterfelds, statt sie aus den geladenen Werten zu
//                erraten (siehe spaltenFilterTyp() weiter unten)
//   summeFormatieren(summe)   formatiert eine Gruppen-Zwischensumme,
//                wenn formatieren() dafuer nicht taugt (co2_ersparnis_kg
//                in auswertungen.js braucht z. B. die ganze Zeile fuer
//                den Schaetzanteil - eine Zwischensumme hat keine Zeile)
//
// NACH WERT, NICHT NACH ANZEIGE (Auftrag, woertlich): sortiert wird
// IMMER ueber spaltenWert() weiter unten - den rohen zeile[feld]-Wert
// oder, wenn angegeben, sortierwert(zeile). Fuer die meisten Spalten ist
// das bereits derselbe Wert, den formatieren() nur ANDERS SCHREIBT
// (2011.2 vs. "2.011,20 €", das ISO-Datum "2026-03-01" vs. "Mär 2026") -
// eine Zahl bleibt eine Zahl, ein ISO-Datum sortiert als Text schon
// richtig chronologisch. Wo der rohe Wert selbst KEINE Rangfolge traegt
// (schwere: 'gering'/'mittel'/'fahruntauglich' alphabetisch waere
// 'fahruntauglich' vor 'gering' - genau der Fehler, der in diesem
// Projekt schon einmal ein fahruntaugliches Rad als "gering" zeigte -
// oder offen_seit: ein Postgres-Intervalltext, an dem "10 Tage" vor "2
// Tage" laege), liefert instandhaltung.js ein eigenes sortierwert(zeile)
// mit an dieser Stelle bereits vorhandenen Hilfsfunktionen (siehe dort).
//
// ALTE UND NEUE FILTER (Auftrag: "die duerfen sich nicht widersprechen"):
// Flotte (Status/Radtyp/Station), Kundschaft (Status) und Instandhaltung
// (Schwere/Mindestalter) haben schon eine eigene zeigeFilterleiste() ueber
// GENAU denselben Spalten, die jetzt auch hier filterbar waeren - bei
// Kundschaft zusaetzlich SERVERSEITIG (die 200-von-1014-Grenze, siehe
// Kommentar bei kundenAufbauen() in kunden.js). Zwei unabhaengige Filter
// auf demselben Feld koennten sich gegenseitig aufheben (Filterleiste
// "gesperrt", Spaltenkopf "aktiv" -> immer null Zeilen) - "schlimmer als
// einer" (Auftrag). Die betroffenen Spalten setzen deshalb bewusst
// filterbar:false (flotte.js: status/typ_code/standort; kunden.js:
// status; instandhaltung.js: schwere/offen_seit) - EIN Feld, EIN
// Bedienelement. Ueberall sonst ist der neue Spaltenkopf-Filter rein
// ADDITIV: er schraenkt nur weiter ein, was der Bereich (Filterleiste,
// Suche, die 200er-Grenze) bereits geladen und gezeigt hat - dieselbe
// Beziehung wie ein Excel-Autofilter ueber einem bereits eingegrenzten
// Datenausschnitt, nie ein zweiter, widerspruechlicher Blick auf
// dieselbe Grundgesamtheit. Bei Kundschaft bleibt das ehrlich, WEIL die
// 200er-Grenze schon in der Statuszeile steht (kundenAufbauen()) -
// dieser Baustein taeuscht nichts Neues vor, er filtert nur das, was
// ohnehin schon als "200 von mehr" ausgewiesen ist.
//
// SUMMIERBAR NUR MIT AUSDRUECKLICHEM OPT-IN (Auftrag: "sag im Baustein,
// welche Spalten summierbar sind, und rechne nur die"): eine
// Durchschnittsspalte summiert ist Unsinn (umsatz_je_fahrt,
// umsatz_je_kunde - "man summiert Durchschnitte nicht, man gewichtet
// sie", derselbe Fehler wie beim ungewichteten Schaetzanteil bei CO2:
// 53,2 % statt 40,0 %, siehe anteilGewichtet() in auswertungen.js), eine
// Zaehl-Spalte ueber MEHRERE MONATE summiert kann DOPPELT zaehlen
// (v_wawi_umsatz_kundengruppe.kunden zaehlt Kunden JE MONAT - ueber
// mehrere Monate summiert waere ein Kunde, der zwoelf Monate lang faehrt,
// zwoelfmal gezaehlt). Nur der jeweilige BEREICH kennt diese fachliche
// Bedeutung einer Spalte; der Baustein hier kennt sie nicht und rechnet
// deshalb NIE von sich aus - er summiert ausschliesslich Spalten, die ihr
// summierbar:true ausdruecklich mitgeben (siehe summierbar-Eintraege in
// auswertungen.js/flotte.js). Wo keine Spalte summierbar ist, zeigt eine
// Gruppe nur ihre Zeilenzahl - "nichts hinschreiben ist besser als etwas
// Falsches" (Auftrag).
//
// FOKUS UND TASTATUR: jeder Klick auf einen Spaltenkopf (Sortieren,
// Gruppieren, Filtern) zeichnet die GANZE Tabelle neu (dieselbe volle
// Neuerstellung wie zeigeListe() sie schon immer macht) - ohne
// Gegenmassnahme spraenge der Tastaturfokus dabei auf <body> zurueck,
// weil das gerade fokussierte Element mit dem alten DOM verschwindet.
// fokusMerken()/fokusWiederherstellen() unten haltem ihn am GLEICHEN
// Bedienelement (ueber data-spaltenkopf-feld/-rolle identifiziert) fest -
// bei einem Texteingabefeld sogar mitsamt Cursorposition, sonst spraenge
// der Cursor bei jedem Tastendruck ans Ende zurueck (siehe die
// 300ms-Verzoegerung bei Text-/Schwellenfiltern weiter unten, demselben
// Muster wie die Kundensuche in kunden.js und der Alters-Schieber in
// instandhaltung.js).
//
// KEIN NEUER *AUFBAUEN()-VORGANG: anders als jede Buchung oder jeder
// Filterleiste-Wechsel ruft ein Klick hier NICHT neuerVorgang() auf und
// laedt nichts nach - die Zeilen sind schon da, ein Klick aendert nur
// die DARSTELLUNG derselben, bereits geladenen zeilen. kennung bleibt
// deshalb ueber beliebig viele Spaltenkopf-Klicks hinweg dieselbe, und
// istAktuellerVorgang(kennung) bleibt so lange wahr, wie kein ECHTER
// Neuaufbau (Bereichswechsel, Reiterwechsel, Buchung) dazwischenkommt.
//
// KEIN zeigeLeermaske() BEI "KEIN TREFFER FUER DIESEN SPALTENFILTER":
// anders als die Erprobung nahelegt ("dafuer gibt es zeigeLeermaske")
// wuerde zeigeLeermaske() den KOMPLETTEN Inhalt von #listenkoerper
// wegwerfen - einschliesslich der Kopf- und Filterzeile selbst, in der
// die Spaltenkopf-Filter stecken. Genau das widerspraeche dem Vorbild
// dieses Bausteins: flotte.js betont ausdruecklich, dass bei "kein
// Treffer" "der Filter sichtbar UND BEDIENBAR bleibt" (siehe
// flotteAufbauen()), weil die alte Filterleiste ein EIGENES Element
// ausserhalb von #listenkoerper ist. Die neuen Spaltenkopf-Filter
// dagegen stecken IM <thead> derselben Tabelle - sie mit
// zeigeLeermaske() zu entfernen hiesse, dass niemand den zu engen Filter
// mehr FEINJUSTIEREN koennte, nur noch komplett zuruecksetzen. Eine
// eigene, schlanke Leerzeile INNERHALB der bestehenden Tabelle (siehe
// baueLeerzeile() weiter unten) haelt Kopf- und Filterzeile stattdessen
// unangetastet - dieselbe Garantie wie bei den Bereichs-eigenen
// Filtern, nur eine Ebene tiefer.
let spaltenkopfListe = null;               // { kennung, zeilen, spalten, beiAuswahl, aktionen }
let spaltenkopfSignatur = null;            // Fingerabdruck der Spaltenliste, siehe zeigeListe()
let spaltenkopfSortFeld = null;            // spalte.feld, das aktuell sortiert, oder null
let spaltenkopfSortRichtung = 0;           // 0 = Ausgangsordnung, 1 = aufsteigend, -1 = absteigend
let spaltenkopfGruppe = null;              // spalte.feld, nach dem gruppiert wird, oder null
let spaltenkopfFilterwerte = new Map();    // spalte.feld -> Filterwert

// Feather-Stil, dieselbe Familie wie RAD_ICONS/SCHADEN_ICONS/KUNDE_ICONS
// in den Bereichen (24x24, currentColor per CSS, siehe .bereich-icon in
// style.css) - EIN Chevron statt dreier verschiedener SVGs fuer
// aufsteigend/absteigend/neutral: Drehung (180°) und Deckkraft
// unterscheiden die drei Zustaende per CSS (siehe .spaltenkopf-sortsymbol*
// in style.css), kein Innerhtml-Austausch bei jedem Klick noetig.
const SPALTENKOPF_SORT_ICON = '<svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>';
// "Ebenen"-Symbol (drei versetzte Rauten) - "nach dieser Spalte
// gruppieren". aria-pressed traegt den Ein/Aus-Zustand, nicht ein
// zweites Icon.
const SPALTENKOPF_GRUPPE_ICON = '<svg viewBox="0 0 24 24"><path d="M12 4l9 5-9 5-9-5 9-5z"/>' +
    '<path d="M3 14l9 5 9-5"/></svg>';

// Rücksetz-Icon (Gestaltungsauftrag Punkt 4, wörtlich: "In der
// Tabellenspalte brauchen wir ein Reset-Icon zum Zurücksetzen der
// Gruppierung", sichtbar nur, wenn gruppiert ist). Dasselbe Kreuz wie
// DETAILMASKE_SCHLIESSEN_ICON weiter unten - EIN "Zustand aufheben"-
// Symbol für die ganze Oberfläche, kein zweites Vokabular nur für den
// Spaltenkopf. Geprüft, wie im Auftrag verlangt ("ob Sortierung und
// Filter denselben Weg zurück brauchen - sie haben dasselbe Problem"):
// beide haben tatsächlich dasselbe Problem, wenn auch nicht identisch
// gelöst (siehe unten). Eine
// aktive Sortierung liess sich bisher nur ueber einen DRITTEN Klick auf
// denselben Spaltenkopf wieder aufheben (auf/ab/aus) - keine eigene,
// sofort sichtbare Rueckstellung wie bei der Gruppierung. Ein aktives
// Text-/Schwellenfilterfeld liess sich nur durch manuelles Leeren
// zuruecksetzen; ein Auswahl-Filter dagegen traegt mit der Option "Alle"
// bereits einen gleichwertigen, immer sichtbaren Weg zurueck - dafuer
// braucht es kein zweites Bedienelement. Deshalb bekommen HIER die
// Sortierung (spaltenkopfSortknopf) und die Text-/Schwellenfilterfelder
// (spaltenkopfFilterfeld) je ein eigenes, nur im aktiven Zustand
// sichtbares Rücksetz-Icon dazu - dieselbe Icon-Konstante, derselbe
// Grundsatz ("sichtbar nur, wenn es etwas zurückzusetzen gibt") wie hier
// bei der Gruppierung.
const SPALTENKOPF_RESET_ICON = '<svg viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>';

// kennung: von neuerVorgang() geliefert, siehe Kommentar dort. Ein
// veralteter Vorgang zeichnet die Liste nicht mehr - sonst überschriebe
// ein spät zurückkommender Neuaufbau eines VORHERIGEN Bereichs oder
// eines überholten Buchungsvorgangs die Liste, die der Anwender gerade
// vor sich hat.
// spalten: [{ feld, titel, formatieren?, klasse?, ariaLabel?, sortierbar?,
//             filterbar?, gruppierbar?, summierbar?, sortierwert?,
//             filterTyp?, summeFormatieren? }] - formatieren(wert, zeile)
// darf einen String ODER ein einzelnes Element liefern (siehe Kommentar
// an der Stelle weiter unten, wo die Zelle gebaut wird); die uebrigen
// Eigenschaften sind Sortieren/Filtern/Gruppieren vorbehalten, siehe der
// lange Kommentar oben.
// Bei Klick UND bei Pfeiltaste: beiAuswahl(zeile) aufrufen und die
// Zeile als ausgewählt markieren.
//
// aktionen (Punkt 5, optional): (zeile) => [{ titel, svg, art?, ausführen: async () => {} }]
// - titel: der zugängliche Name des Icon-Knopfs (aria-label/title), da
//   ein Icon allein keinen hat.
// - svg: rohes <svg>...</svg>-Markup, EIN MAL je Bereich als Konstante
//   geschrieben (siehe iconAus() in flotte.js) - kein Icon-Font, keine
//   externe Abhängigkeit, wie im Auftrag verlangt.
// - art: 'gefährlich', um dieselbe rote Einfärbung wie knopf-gefährlich
//   zu bekommen (siehe .zeilen-aktion-gefährlich in style.css); sonst
//   weggelassen.
// - ausführen: wie bei den Knöpfen aus zeigeMaske() - Fehler werden
//   hier zentral gefangen und in die Statuszeile übersetzt.
//
// Ohne aktionen (der Vorgabewert) verändert sich am Ergebnis nichts -
// keine zusätzliche Spalte, keine Zeile muss etwas davon wissen.
function zeigeListe(kennung, zeilen, spalten, beiAuswahl, aktionen = null) {
    if (!istAktuellerVorgang(kennung)) return;

    // Fingerabdruck der Spaltenliste: dieselbe Tabelle (Bereich,
    // Unterreiter) behaelt Sortierung/Filter/Gruppierung ueber einen
    // Neuaufbau hinweg (eine Buchung, ein erneutes Laden) - genau das
    // "Wiederfinden", das flotteFilterStatus in flotte.js fuer die alte
    // Filterleiste schon vormacht ("ein Bereichswechsel selbst setzt sie
    // NICHT zurueck"), hier einmal fuer alle Bereiche statt je Bereich
    // neu erfunden. Eine ANDERE Tabelle (andere Spalten - Bereichswechsel
    // oder Unterreiterwechsel) faengt dagegen sauber bei null an; ohne
    // diesen Vergleich ueberlebte etwa eine Sortierung nach "Nummer" aus
    // der Flotte einen Wechsel zu Stationen, obwohl "Nummer" dort etwas
    // ganz anderes waere.
    const signatur = spalten.map((s) => `${s.feld}|${s.titel || ''}`).join(',') + (aktionen ? '|+' : '');
    if (signatur !== spaltenkopfSignatur) {
        spaltenkopfSignatur = signatur;
        spaltenkopfSortFeld = null;
        spaltenkopfSortRichtung = 0;
        spaltenkopfGruppe = null;
        spaltenkopfFilterwerte = new Map();
    }

    spaltenkopfListe = { kennung, zeilen, spalten, beiAuswahl, aktionen };
    zeichneArbeitstabelle();
}

// Der eigentliche Zeichenvorgang - getrennt von zeigeListe(), weil jeder
// Klick auf einen Spaltenkopf ihn erneut ausloest, OHNE dass ein neuer
// *Aufbauen()-Vorgang lief (siehe Kopfkommentar oben). Liest
// ausschliesslich aus dem Modulzustand oben; zeigeListe() selbst ist nur
// noch die Stelle, an der dieser Zustand mit frischen Zeilen/Spalten
// befuellt wird.
function zeichneArbeitstabelle() {
    const { kennung, zeilen: zeilenOriginal, spalten, beiAuswahl, aktionen } = spaltenkopfListe;
    if (!istAktuellerVorgang(kennung)) return;

    const fokusMerkmal = fokusMerken();

    // ----- Filtern -----
    const gefiltert = zeilenOriginal.filter((zeile) => spalten.every((spalte) => {
        if (!istFilterbar(spalte)) return true;
        const filterwert = spaltenkopfFilterwerte.get(spalte.feld);
        if (filterwert === undefined) return true;
        const rohwert = zeile[spalte.feld];
        const typ = spaltenFilterTyp(spalte, zeilenOriginal);
        if (typ === 'schwelle') return typeof rohwert === 'number' && rohwert >= filterwert;
        // Gestaltungsauftrag Punkt 2: auch der Spaltenkopf-Filter muss
        // mehrere Werte gleichzeitig zulassen ("wartung UND defekt", um
        // alles zu sehen, was nicht faehrt) - filterwert ist fuer 'auswahl'
        // deshalb ein Set<string>, kein einzelner String mehr (siehe
        // spaltenkopfFilterfeld() weiter unten).
        if (typ === 'auswahl') return filterwert.has(String(rohwert ?? ''));
        // Erst HIER kleingeschrieben, nicht schon beim Speichern des
        // Filterworts (siehe spaltenkopfFilterfeld() weiter unten): der
        // gespeicherte Wert bleibt der Originaltext, den die Person
        // getippt hat - sonst zeigte das Eingabefeld nach dem naechsten
        // Neuzeichnen "chang" statt des getippten "Chang" (im Browser
        // nachgestellt und bestaetigt, siehe Bericht).
        return String(rohwert ?? '').toLocaleLowerCase('de').includes(filterwert.toLocaleLowerCase('de'));
    }));

    // ----- Sortieren -----
    // { zeile, index }: index ist die Ausgangsordnung (die Reihenfolge, in
    // der der Bereich die Zeilen geladen hat - bei den Auswertungen etwa
    // "erst Radtyp, dann Monat", selbst schon bedeutungstragend, siehe
    // Auftrag). Ein dritter Klick auf denselben Spaltenkopf setzt
    // spaltenkopfSortRichtung auf 0 zurueck - die Sortierung faellt dann
    // unten aus, und die Reihenfolge ist wieder GENAU diese
    // Ausgangsordnung, nicht irgendeine neu berechnete.
    let indiziert = gefiltert.map((zeile, index) => ({ zeile, index }));
    const sortSpalte = spaltenkopfSortFeld
        ? spalten.find((s) => s.feld === spaltenkopfSortFeld && istSortierbar(s)) : null;
    if (sortSpalte && spaltenkopfSortRichtung !== 0) {
        indiziert = [...indiziert].sort((a, b) => {
            const wa = spaltenWert(sortSpalte, a.zeile);
            const wb = spaltenWert(sortSpalte, b.zeile);
            const aLeer = wa === null || wa === undefined || wa === '';
            const bLeer = wb === null || wb === undefined || wb === '';
            // Leere Werte immer ans Ende, UNABHAENGIG von der Richtung -
            // sonst spraenge eine leere Zeile beim Umschalten von auf-
            // nach absteigend von ganz unten nach ganz oben, obwohl sich
            // an ihrer fehlenden Angabe nichts geaendert hat.
            if (aLeer && bLeer) return a.index - b.index;
            if (aLeer) return 1;
            if (bLeer) return -1;
            const vergleich = vergleicheWerte(wa, wb) * spaltenkopfSortRichtung;
            return vergleich !== 0 ? vergleich : a.index - b.index;   // stabil bei Gleichstand
        });
    }
    const angezeigt = indiziert.map((e) => e.zeile);

    // ----- Gruppieren -----
    const gruppenSpalte = spaltenkopfGruppe
        ? spalten.find((s) => s.feld === spaltenkopfGruppe && istGruppierbar(s)) : null;
    const gruppen = gruppenSpalte ? gruppiere(angezeigt, gruppenSpalte) : null;

    listenZeilen = angezeigt;
    listenAuswahl = beiAuswahl;
    listenIndex = -1;
    listenZeilenElemente = [];

    const wurzel = listenKoerper();
    wurzel.replaceChildren();

    // Hinweiszeile (Auftrag: "der Zustand muss sichtbar sein... und ein
    // Weg zurueck") - nur eingeblendet, wenn tatsaechlich etwas vom
    // Spaltenkopf aus eingeschraenkt/gruppiert wurde, sonst waere sie
    // Zierrat (derselbe Massstab wie bei zeigeFilterleiste() weiter
    // oben). Zeigt zusaetzlich N-von-M an: bei Kundschaft ist "M" hier
    // die Zahl der bereits geladenen (hoechstens 200) Zeilen, NICHT die
    // 1014 insgesamt - konsistent mit der Statuszeile in kunden.js, die
    // genau das schon offenlegt.
    if (spaltenkopfFilterwerte.size > 0 || gruppenSpalte) {
        wurzel.append(spaltenkopfHinweis(zeilenOriginal.length, angezeigt.length, gruppenSpalte));
    }

    const tabelle = document.createElement('table');
    tabelle.className = 'arbeitstabelle';
    tabelle.append(spaltenkopfKopfzeile(spalten, aktionen));

    const koerper = document.createElement('tbody');
    if (angezeigt.length === 0 && zeilenOriginal.length > 0) {
        koerper.append(baueLeerzeile(spalten, aktionen));
    } else if (gruppen) {
        let laufIndex = 0;
        for (const gruppe of gruppen) {
            koerper.append(spaltenkopfGruppenzeile(gruppe, spalten, aktionen, gruppenSpalte));
            for (const zeile of gruppe.zeilen) {
                koerper.append(baueDatenzeile(zeile, spalten, aktionen, laufIndex));
                laufIndex += 1;
            }
        }
    } else {
        angezeigt.forEach((zeile, index) => koerper.append(baueDatenzeile(zeile, spalten, aktionen, index)));
    }
    tabelle.append(koerper);
    wurzel.append(tabelle);

    fokusWiederherstellen(fokusMerkmal);
}

// ----- Fokuserhalt ueber einen vollstaendigen Neuaufbau der Tabelle -----
//
// Jeder Klick auf einen Spaltenkopf (und jede Eingabe in ein
// Spaltenfilterfeld) reisst die ganze Tabelle ab und baut sie neu auf -
// dieselbe volle Neuerstellung, die zeigeListe() schon immer macht.
// Ohne diese beiden Funktionen spraenge der Tastaturfokus dabei auf
// <body> zurueck: das gerade fokussierte Element existiert nach
// replaceChildren() nicht mehr. data-spaltenkopf-feld/-rolle
// identifizieren dasselbe Bedienelement in der NEUEN Tabelle, ohne dass
// zeigeListe() dafuer eine ID-Fabrik bräuchte.
function fokusMerken() {
    const el = document.activeElement;
    if (!el || !el.dataset || !el.dataset.spaltenkopfFeld) return null;
    return {
        feld: el.dataset.spaltenkopfFeld,
        rolle: el.dataset.spaltenkopfRolle,
        selektion: typeof el.selectionStart === 'number' ? [el.selectionStart, el.selectionEnd] : null
    };
}

function fokusWiederherstellen(merkmal) {
    if (!merkmal) return;
    const ziel = listenKoerper().querySelector(
        `[data-spaltenkopf-feld="${merkmal.feld}"][data-spaltenkopf-rolle="${merkmal.rolle}"]`);
    if (!ziel) return;
    ziel.focus();
    if (merkmal.selektion && typeof ziel.setSelectionRange === 'function') {
        // <input type="number"> erlaubt in manchen Browsern keine
        // Selektion (wirft eine InvalidStateError) - der Fokus selbst
        // (oben) ist damit trotzdem gesetzt, nur der Cursor bleibt an
        // seiner Vorgabeposition statt an der zuvor getippten Stelle.
        try { ziel.setSelectionRange(merkmal.selektion[0], merkmal.selektion[1]); } catch { /* siehe oben */ }
    }
}

// ----- Vorgabewerte je Faehigkeit -----
//
// Alle drei sind "an, sobald die Spalte einen sichtbaren Titel traegt" -
// eine Balkenspalte (leerer Titel, siehe balkenSpalten() weiter unten)
// oder die Aktionen-Spalte haben nichts, das sich beschriften liesse,
// und werden deshalb nie angeboten. Ein Bereich schaltet eine einzelne
// Faehigkeit fuer eine einzelne Spalte gezielt ab (":false"), wenn es
// dafuer schon ein eigenes Bedienelement gibt (siehe der lange Kommentar
// weiter oben) - nie andersherum: eine Spalte MUSS nicht extra
// eingeschaltet werden, um "immer... bei allen Tabellen" zu erfuellen.
function istSortierbar(spalte) { return Boolean(spalte.titel) && spalte.sortierbar !== false; }
function istFilterbar(spalte) { return Boolean(spalte.titel) && spalte.filterbar !== false; }
function istGruppierbar(spalte) { return Boolean(spalte.titel) && spalte.gruppierbar !== false; }

// Der Wert, nach dem sortiert/gruppiert wird - NIE der formatierte
// Anzeigetext (siehe "Nach Wert, nicht nach Anzeige" oben).
function spaltenWert(spalte, zeile) {
    return spalte.sortierwert ? spalte.sortierwert(zeile) : zeile[spalte.feld];
}

// Allgemeiner Wertevergleich: Zahlen numerisch, alles andere als Text
// ueber die deutsche Kollationsfolge (localeCompare mit numeric:true,
// damit "Rad 9" vor "Rad 10" liegt, nicht dahinter). Erwartet bereits
// nicht-leere Werte - leere werden von den beiden Aufrufstellen (Sortieren
// oben, Filteroptionen weiter unten) vorher herausgefiltert, jede mit
// ihrer eigenen Regel, WOHIN ein leerer Wert gehoert.
function vergleicheWerte(a, b) {
    if (typeof a === 'number' && typeof b === 'number') return a - b;
    if (typeof a === 'boolean' && typeof b === 'boolean') return a === b ? 0 : (a ? 1 : -1);
    return String(a).localeCompare(String(b), 'de', { numeric: true, sensitivity: 'base' });
}

// Erraet die Art des Filterfelds aus den TATSAECHLICH GELADENEN Werten
// (Auftrag: "was sinnvoll ist, haengt vom Spaltentyp ab - bei wenigen
// verschiedenen Werten eine Auswahl, bei Zahlen eher eine Grenze, bei
// Text eine Eingabe"), sofern der Bereich nicht selbst filterTyp
// vorgibt. zeilenOriginal (nicht die schon gefilterte Teilmenge!): die
// Optionen einer Auswahl duerfen nicht schrumpfen, nur weil ein ANDERER
// Spaltenfilter gerade etwas ausblendet - sonst verschwaende eine
// gewaehlte Option unter der Hand aus ihrem eigenen <select>.
function spaltenFilterTyp(spalte, zeilenOriginal) {
    if (spalte.filterTyp) return spalte.filterTyp;
    const werte = zeilenOriginal.map((z) => z[spalte.feld]).filter((w) => w !== null && w !== undefined && w !== '');
    if (werte.length === 0) return 'text';
    if (werte.every((w) => typeof w === 'number')) return 'schwelle';
    const verschiedene = new Set(werte.map(String));
    return verschiedene.size <= 10 ? 'auswahl' : 'text';
}

// Anzeigetext fuer EINEN Wert - fuer Auswahloptionen und
// Gruppenueberschriften. Nutzt formatieren() wieder, wenn vorhanden
// (dieselbe Zahl/dasselbe Datum erscheint dann genauso wie in der
// Tabellenzelle selbst, "Mär 2026" statt "2026-03-01") - liefert
// formatieren ein Element (zahlSkaliert() etc.), zaehlt dessen
// textContent, nicht das Element selbst: eine Gruppenueberschrift ist
// Fliesstext, kein zweites Tabellenfeld.
function spaltenBeschriftungFuerWert(spalte, zeile) {
    if (!zeile) return '—';
    const wert = zeile[spalte.feld];
    if (spalte.formatieren) {
        const ergebnis = spalte.formatieren(wert, zeile);
        return ergebnis instanceof Node ? ergebnis.textContent : String(ergebnis);
    }
    return wert === null || wert === undefined || wert === '' ? '—' : String(wert);
}

// Teilt zeilenListe (bereits gefiltert/sortiert) in Gruppen nach
// spalte.feld - eine Map, damit die Reihenfolge der ERSTEN Sichtung
// erhalten bleibt (JS-Maps iterieren in Einfuegereihenfolge): eine
// bereits sinnvoll sortierte Liste (Auswertungen: Radtyp, dann Monat)
// ergibt so Gruppen IN DERSELBEN Reihenfolge, keine neue alphabetische
// Ordnung, die den Zusammenhang zerrisse.
function gruppiere(zeilenListe, spalte) {
    const eimer = new Map();
    for (const zeile of zeilenListe) {
        const schluessel = String(zeile[spalte.feld] ?? '');
        if (!eimer.has(schluessel)) {
            eimer.set(schluessel, { beschriftung: spaltenBeschriftungFuerWert(spalte, zeile), zeilen: [] });
        }
        eimer.get(schluessel).zeilen.push(zeile);
    }
    return [...eimer.values()];
}

// ----- Kopfzeile(n): Titel/Sortieren/Gruppieren, darunter die Filterzeile -----
function spaltenkopfKopfzeile(spalten, aktionen) {
    const kopf = document.createElement('thead');

    const titelZeile = document.createElement('tr');
    for (const spalte of spalten) {
        const th = document.createElement('th');
        const hatTitel = Boolean(spalte.titel);
        // ariaLabel: fuer eine Spalte OHNE sichtbaren Titel (siehe
        // balkenSpalten() weiter unten) - dieselbe Ueberlegung wie bei
        // der Aktionen-Spalte direkt darunter: eine zweite, sichtbare
        // Ueberschrift ("Umsatz") neben der bereits betitelten
        // Zahlenspalte waere Wiederholung, aber eine <th> ganz ohne
        // Namen liesse die Spalte fuer einen Screenreader namenlos.
        if (!hatTitel && spalte.ariaLabel) th.setAttribute('aria-label', spalte.ariaLabel);

        const sortierbar = istSortierbar(spalte);
        const gruppierbar = istGruppierbar(spalte);
        if (sortierbar) {
            const aktiv = spaltenkopfSortFeld === spalte.feld && spaltenkopfSortRichtung !== 0;
            th.setAttribute('aria-sort', aktiv ? (spaltenkopfSortRichtung === 1 ? 'ascending' : 'descending') : 'none');
        }

        if (hatTitel && (sortierbar || gruppierbar)) {
            const wrapper = document.createElement('div');
            wrapper.className = 'spaltenkopf';
            wrapper.append(sortierbar ? spaltenkopfSortknopf(spalte) : spaltenkopfTitelOhneSortierung(spalte));
            if (gruppierbar) wrapper.append(spaltenkopfGruppenknopf(spalte));
            th.append(wrapper);
        } else {
            th.textContent = spalte.titel || '';
        }
        titelZeile.append(th);
    }
    if (aktionen) {
        // Keine sichtbare Beschriftung - eine Spaltenüberschrift "Aktionen"
        // über lauter blossen Icon-Zellen wäre reine Deko. aria-label
        // hält die Tabelle für Screenreader trotzdem vollständig: eine
        // <th> ohne jeden Namen liesse die letzte Spalte namenlos wirken.
        const th = document.createElement('th');
        th.setAttribute('aria-label', t('common.actionsColumn'));
        titelZeile.append(th);
    }
    kopf.append(titelZeile);

    // Filterzeile nur, wenn mindestens eine Spalte tatsaechlich filterbar
    // ist - sonst waere eine zweite, komplett leere Kopfzeile Zierrat
    // (derselbe Massstab wie bei zeigeFilterleiste() weiter oben: "ein
    // Bedienelement, das nichts filtert, ist Zierrat"). Beide <tr>
    // bleiben Kinder DESSELBEN <thead> - .arbeitstabelle thead ist
    // "position: sticky", das gilt fuer das ganze Element, nicht Zeile
    // fuer Zeile: beide kleben zusammen am oberen Rand, unveraendert
    // gegenueber vorher.
    if (spalten.some((s) => istFilterbar(s))) {
        kopf.append(spaltenkopfFilterzeile(spalten, aktionen));
    }

    return kopf;
}

function spaltenkopfTitelOhneSortierung(spalte) {
    const spanne = document.createElement('span');
    spanne.textContent = spalte.titel;
    return spanne;
}

function spaltenkopfSortknopf(spalte) {
    const knopf = document.createElement('button');
    knopf.type = 'button';
    knopf.className = 'spaltenkopf-sortknopf';
    knopf.dataset.spaltenkopfFeld = spalte.feld;
    knopf.dataset.spaltenkopfRolle = 'sortieren';

    const titelSpanne = document.createElement('span');
    titelSpanne.textContent = spalte.titel;
    knopf.append(titelSpanne);

    const aktiv = spaltenkopfSortFeld === spalte.feld && spaltenkopfSortRichtung !== 0;
    const symbol = document.createElement('span');
    symbol.className = 'spaltenkopf-sortsymbol'
        + (aktiv ? ' spaltenkopf-sortsymbol-aktiv' : '')
        + (aktiv && spaltenkopfSortRichtung === 1 ? ' spaltenkopf-sortsymbol-auf' : '');
    // Konstantes Markup, keine Nutzereingabe - derselbe Ausnahmefall wie
    // RAD_ICONS/SCHADEN_ICONS in den Bereichen (siehe dortiger Kommentar).
    symbol.innerHTML = SPALTENKOPF_SORT_ICON;
    symbol.setAttribute('aria-hidden', 'true');   // der Text daneben UND aria-label sagen es bereits
    knopf.append(symbol);

    knopf.setAttribute('aria-label', t('common.sortAria', { titel: spalte.titel })
        + (aktiv ? t('common.sortAriaSuffix',
            { richtung: spaltenkopfSortRichtung === 1 ? t('common.ascending') : t('common.descending') }) : ''));

    // Klick UND Tastatur: ein <button> ist beides ohne weiteren Code -
    // Enter/Leertaste loesen 'click' nativ aus (Auftrag: "mit der
    // Tastatur erreichbar UND bedienbar", kein Nachbau eines
    // Tastatur-Handlers fuer etwas, das der Browser schon kann).
    knopf.addEventListener('click', () => {
        if (spaltenkopfSortFeld !== spalte.feld) {
            spaltenkopfSortFeld = spalte.feld;
            spaltenkopfSortRichtung = 1;
        } else if (spaltenkopfSortRichtung === 1) {
            spaltenkopfSortRichtung = -1;
        } else if (spaltenkopfSortRichtung === -1) {
            // Dritter Klick: zurueck zur Ausgangsordnung (Auftrag).
            spaltenkopfSortFeld = null;
            spaltenkopfSortRichtung = 0;
        } else {
            spaltenkopfSortRichtung = 1;
        }
        zeichneArbeitstabelle();
    });

    // Rücksetz-Icon (siehe SPALTENKOPF_RESET_ICON weiter oben): EIN
    // eigener, direkter Weg zurück zur Ausgangsordnung, statt zweimal
    // zusätzlich denselben Sortierknopf klicken zu müssen (auf ->
    // ab -> aus). Nur sichtbar, solange DIESE Spalte aktiv sortiert
    // ist - ein zweiter Knopf für "es gibt nichts zurückzusetzen" wäre
    // Zierrat (derselbe Maßstab wie beim Gruppierungsknopf und der
    // Filterleiste, siehe dortige Kommentare). Ein EIGENER Knopf statt
    // ihn dem Sortierknopf selbst anzuhängen: ein Klick auf den
    // Sortierknopf soll weiterhin die Richtung ZYKLISCH weiterschalten
    // (wer versehentlich daneben klickt, verliert die Sortierung nicht
    // sofort ganz) - Zurücksetzen ist eine andere, ausdrücklichere
    // Absicht und verdient ein eigenes Ziel für Maus UND Tastatur.
    if (!aktiv) return knopf;
    const fragment = document.createDocumentFragment();
    fragment.append(knopf);
    const zuruecksetzen = document.createElement('button');
    zuruecksetzen.type = 'button';
    zuruecksetzen.className = 'spaltenkopf-sortreset';
    zuruecksetzen.dataset.spaltenkopfFeld = spalte.feld;
    zuruecksetzen.dataset.spaltenkopfRolle = 'sortreset';
    zuruecksetzen.setAttribute('aria-label', t('common.sortResetAria', { titel: spalte.titel }));
    zuruecksetzen.title = t('common.sortResetTitle');
    zuruecksetzen.innerHTML = SPALTENKOPF_RESET_ICON;
    zuruecksetzen.addEventListener('click', () => {
        spaltenkopfSortFeld = null;
        spaltenkopfSortRichtung = 0;
        zeichneArbeitstabelle();
    });
    fragment.append(zuruecksetzen);
    return fragment;
}

// Gestaltungsauftrag Punkt 4, wörtlich: "In der Tabellenspalte brauchen
// wir ein Reset-Icon zum Zurücksetzen der Gruppierung", sichtbar nur,
// wenn gruppiert ist. EIN Knopf, kein zweiter daneben: anders als beim
// Sortierknopf (siehe spaltenkopfSortknopf() oben, wo derselbe Klick auf
// den Hauptknopf weiterhin nur zyklisch die RICHTUNG wechselt und ein
// zweiter Klick nötig wäre, um ganz aufzuheben) macht ein zweiter Klick
// auf DIESEN Knopf immer schon die Gruppierung rückgängig - das
// Rücksetz-Icon ersetzt hier deshalb einfach das Symbol DESSELBEN
// Knopfs, statt einen zusätzlichen zu brauchen.
function spaltenkopfGruppenknopf(spalte) {
    const knopf = document.createElement('button');
    knopf.type = 'button';
    const aktiv = spaltenkopfGruppe === spalte.feld;
    // Der aktive Zustand wird bereits über [aria-pressed="true"] gestylt
    // (siehe style.css) - keine zweite, eigene Klasse dafuer noetig.
    knopf.className = 'spaltenkopf-gruppenknopf';
    knopf.dataset.spaltenkopfFeld = spalte.feld;
    knopf.dataset.spaltenkopfRolle = 'gruppieren';
    knopf.setAttribute('aria-pressed', String(aktiv));
    knopf.setAttribute('aria-label', aktiv
        ? t('common.groupResetAria', { titel: spalte.titel })
        : t('common.groupByAria', { titel: spalte.titel }));
    knopf.title = aktiv ? t('common.groupResetTitle') : t('common.groupTitle');
    // GESTALTUNGSAUFTRAG PUNKT 6, woertlich: "Button fuer Gruppierung
    // sollte ein Icon bekommen" - er hatte tatsaechlich schon eines
    // (SPALTENKOPF_GRUPPE_ICON/SPALTENKOPF_RESET_ICON wurden hier bereits
    // vergeben), nur unsichtbar: das SVG landete zuvor per innerHTML DIREKT
    // im <button>, ohne eigenes width/height/stroke - anders als beim
    // Sortierknopf (siehe spaltenkopfSortknopf() oben), der sein Symbol in
    // einen eigenen <span class="spaltenkopf-sortsymbol"> mit fester Groesse
    // packt. Ein <svg> ganz ohne width/height-Attribut UND ohne CSS-Regel
    // dafuer faellt auf die Ersatzgroesse des Browsers zurueck (ueblich
    // 300x150px) - im 4px/8px-Innenabstand dieses Knopfs blieb davon nur
    // der ohnehin schon vorhandene Rahmen sichtbar, das eigentliche Symbol
    // lief weit ueber den sichtbaren Knopf hinaus. Im Browser nachgestellt
    // (siehe Bericht): genau das "leere abgerundete Rechteck" aus dem
    // Auftrag. Derselbe Wrapper wie beim Sortiersymbol behebt das - eigene
    // CSS-Regel .spaltenkopf-gruppensymbol svg in style.css, dieselbe
    // Groesse/Strichstaerke wie .spaltenkopf-sortsymbol svg, damit beide
    // Knoepfe derselben Symbolfamilie angehoeren (Auftrag: "ein Symbol aus
    // derselben Familie wie die Rubrik-Icons").
    const gruppensymbol = document.createElement('span');
    gruppensymbol.className = 'spaltenkopf-gruppensymbol';
    gruppensymbol.innerHTML = aktiv ? SPALTENKOPF_RESET_ICON : SPALTENKOPF_GRUPPE_ICON;
    gruppensymbol.setAttribute('aria-hidden', 'true');   // aria-label auf dem Knopf sagt es bereits
    knopf.append(gruppensymbol);
    knopf.addEventListener('click', () => {
        // Immer nur EINE Gruppierung ueber die ganze Tabelle - ein Klick
        // auf eine ANDERE Spalte ersetzt die vorherige (kein
        // verschachteltes Gruppieren, das der Auftrag nicht verlangt),
        // ein Klick auf dieselbe hebt sie wieder auf.
        spaltenkopfGruppe = aktiv ? null : spalte.feld;
        zeichneArbeitstabelle();
    });
    return knopf;
}

function spaltenkopfFilterzeile(spalten, aktionen) {
    const zeile = document.createElement('tr');
    zeile.className = 'spaltenkopf-filterzeile';
    for (const spalte of spalten) {
        const th = document.createElement('th');
        if (istFilterbar(spalte)) th.append(spaltenkopfFilterfeld(spalte));
        zeile.append(th);
    }
    if (aktionen) zeile.append(document.createElement('th'));
    return zeile;
}

// Baut das eigentliche Filter-Bedienelement - Auswahl (Mehrfachauswahl,
// siehe mehrfachauswahlFeld()), Schwelle oder Text, siehe
// spaltenFilterTyp() weiter oben. Alle drei tragen
// data-spaltenkopf-feld/-rolle fuer den Fokuserhalt (siehe
// fokusMerken()/fokusWiederherstellen() oben, bei der Mehrfachauswahl mit
// dem Zusatz "filtern-mehrfach:..." statt des schlichten "filtern" der
// beiden anderen - sie traegt mehrere fokussierbare Elemente zugleich,
// Knopf UND je eine Checkbox, jede braucht ihre eigene, unterscheidbare
// Rolle) und ein aria-label, weil keines von ihnen ein <label for> aus
// dem statischen HTML hat (sie entstehen dynamisch, wie die Felder aus
// zeigeMaske()).
function spaltenkopfFilterfeld(spalte) {
    const { zeilen: zeilenOriginal } = spaltenkopfListe;
    const typ = spaltenFilterTyp(spalte, zeilenOriginal);
    const aktuellerWert = spaltenkopfFilterwerte.get(spalte.feld);

    if (typ === 'auswahl') {
        // Gestaltungsauftrag Punkt 2: auch hier eine Mehrfachauswahl statt
        // eines Einfachauswahl-<select> - siehe mehrfachauswahlFeld() fuer
        // die ausfuehrliche Begruendung. aktuellerWert ist entweder
        // undefined (kein Filter, "Alle") oder ein Set<string>, nie mehr
        // ein einzelner String.
        const ausgewaehlt = aktuellerWert || new Set();

        const distinct = new Map();   // roher Wert (als String) -> Beispielzeile fuer die Beschriftung
        for (const zeile of zeilenOriginal) {
            const roh = zeile[spalte.feld];
            if (roh === null || roh === undefined || roh === '') continue;
            const schluessel = String(roh);
            if (!distinct.has(schluessel)) distinct.set(schluessel, zeile);
        }
        const sortiert = [...distinct.entries()].sort(([, za], [, zb]) =>
            vergleicheWerte(spaltenWert(spalte, za), spaltenWert(spalte, zb)));
        const optionenListe = sortiert.map(([schluessel, beispielZeile]) =>
            ({ wert: schluessel, text: spaltenBeschriftungFuerWert(spalte, beispielZeile) }));

        return mehrfachauswahlFeld(
            optionenListe, ausgewaehlt,
            (neu) => {
                if (neu.size === 0) spaltenkopfFilterwerte.delete(spalte.feld);
                else spaltenkopfFilterwerte.set(spalte.feld, neu);
                zeichneArbeitstabelle();
            },
            t('common.filterAria', { titel: spalte.titel }),
            {
                offenVorgabe: spaltenkopfMehrfachOffenFeld === spalte.feld,
                beiOeffnen: () => { spaltenkopfMehrfachOffenFeld = spalte.feld; },
                beiSchliessen: () => {
                    if (spaltenkopfMehrfachOffenFeld === spalte.feld) spaltenkopfMehrfachOffenFeld = null;
                },
                markiere: (el, rolle) => {
                    el.dataset.spaltenkopfFeld = spalte.feld;
                    el.dataset.spaltenkopfRolle = `filtern-mehrfach:${rolle}`;
                }
            }
        );
    }

    const eingabe = document.createElement('input');
    eingabe.type = typ === 'schwelle' ? 'number' : 'text';
    eingabe.dataset.spaltenkopfFeld = spalte.feld;
    eingabe.dataset.spaltenkopfRolle = 'filtern';
    eingabe.setAttribute('aria-label', typ === 'schwelle' ? t('common.filterMinAria', { titel: spalte.titel }) : t('common.filterAria', { titel: spalte.titel }));
    eingabe.placeholder = typ === 'schwelle' ? '≥' : t('common.filterSearchPlaceholder');
    // Dieselbe Bedingung wie beim <select>-Zweig oben (siehe dortiger
    // Kommentar) - hier zusaetzlich der Grund, warum die Klasse erst
    // NACH dem Debounce (siehe setTimeout unten) wechselt: das ist
    // derselbe Zeitpunkt, zu dem die Tabelle selbst tatsaechlich neu
    // gefiltert wird - "aktiv" soll nicht frueher aufleuchten, als der
    // Filter wirklich zu greifen beginnt.
    if (aktuellerWert !== undefined) {
        eingabe.value = typ === 'schwelle' ? String(aktuellerWert) : aktuellerWert;
        eingabe.classList.add('spaltenkopf-filter-aktiv');
    }

    // 300ms Verzoegerung wie bei der Kundensuche (kunden.js) und dem
    // Alters-Schieber (instandhaltung.js): ohne sie loeste jeder
    // Tastendruck einen kompletten Tabellen-Neuaufbau aus UND risse dabei
    // - siehe fokusMerken()/fokusWiederherstellen() oben - genau das
    // Eingabefeld weg, in das gerade getippt wird.
    let verzoegerung = null;
    eingabe.addEventListener('input', () => {
        clearTimeout(verzoegerung);
        verzoegerung = setTimeout(() => {
            const text = eingabe.value.trim();
            if (text === '') {
                spaltenkopfFilterwerte.delete(spalte.feld);
            } else if (typ === 'schwelle') {
                const zahl = Number(text.replace(',', '.'));
                if (Number.isFinite(zahl)) spaltenkopfFilterwerte.set(spalte.feld, zahl);
                else spaltenkopfFilterwerte.delete(spalte.feld);
            } else {
                // Unveraendert gespeichert (nicht kleingeschrieben) - das
                // Feld zeigt nach dem Neuzeichnen sonst nicht mehr das,
                // was getippt wurde (siehe Kommentar beim Filtern oben).
                spaltenkopfFilterwerte.set(spalte.feld, text);
            }
            zeichneArbeitstabelle();
        }, 300);
    });

    // Rücksetz-Icon (siehe SPALTENKOPF_RESET_ICON weiter oben, und der
    // Kommentar dort zu "Sortierung und Filter... dasselbe Problem"): ein
    // Auswahl-Filter (Zweig oben) hat mit der Option "Alle" schon einen
    // eigenen, immer sichtbaren Weg zurueck - ein Text-/Schwellenfeld
    // dagegen liess sich bisher nur durch manuelles Leeren zuruecksetzen.
    // Nur sichtbar, solange ein Wert steht (derselbe Massstab wie bei
    // spaltenkopf-filter-aktiv oben) - ein Feld ohne Inhalt hat nichts
    // zurueckzusetzen.
    if (aktuellerWert === undefined) return eingabe;
    const wrapper = document.createElement('span');
    wrapper.className = 'spaltenkopf-filterfeld-wrapper';
    wrapper.append(eingabe);
    const zuruecksetzen = document.createElement('button');
    zuruecksetzen.type = 'button';
    zuruecksetzen.className = 'spaltenkopf-filterreset';
    zuruecksetzen.setAttribute('aria-label', t('common.filterResetAria', { titel: spalte.titel }));
    zuruecksetzen.title = t('common.filterResetTitle');
    zuruecksetzen.innerHTML = SPALTENKOPF_RESET_ICON;
    zuruecksetzen.addEventListener('click', () => {
        clearTimeout(verzoegerung);
        spaltenkopfFilterwerte.delete(spalte.feld);
        zeichneArbeitstabelle();
    });
    wrapper.append(zuruecksetzen);
    return wrapper;
}

// Hinweiszeile ueber der Tabelle - sichtbarer Zustand UND ein Weg zurueck
// (Auftrag), siehe der lange Kommentar bei zeigeListe() oben. Nur
// eingeblendet, wenn tatsaechlich gefiltert oder gruppiert wird.
function spaltenkopfHinweis(gesamt, angezeigtAnzahl, gruppenSpalte) {
    const zeile = document.createElement('div');
    zeile.className = 'spaltenkopf-hinweis';

    if (spaltenkopfFilterwerte.size > 0) {
        const text = document.createElement('span');
        text.textContent = angezeigtAnzahl === gesamt
            ? mengeFormat(gesamt, 'zeile')
            : t('common.rowsFiltered', { angezeigt: zahlFormat(angezeigtAnzahl), zeilenPhrase: mengeFormat(gesamt, 'zeile') });
        zeile.append(text);

        const zuruecksetzen = document.createElement('button');
        zuruecksetzen.type = 'button';
        zuruecksetzen.className = 'spaltenkopf-hinweis-knopf';
        zuruecksetzen.textContent = t('common.columnFilterReset');
        zuruecksetzen.addEventListener('click', () => {
            spaltenkopfFilterwerte = new Map();
            zeichneArbeitstabelle();
        });
        zeile.append(zuruecksetzen);
    }

    if (gruppenSpalte) {
        const text = document.createElement('span');
        text.textContent = t('common.groupedBy', { titel: gruppenSpalte.titel });
        zeile.append(text);

        const aufheben = document.createElement('button');
        aufheben.type = 'button';
        aufheben.className = 'spaltenkopf-hinweis-knopf';
        aufheben.textContent = t('common.ungroup');
        aufheben.addEventListener('click', () => {
            spaltenkopfGruppe = null;
            zeichneArbeitstabelle();
        });
        zeile.append(aufheben);
    }

    return zeile;
}

// Gruppen-Ueberschriftszeile: Beschriftung + je summierbarer Spalte eine
// Zwischensumme (Auftrag: "eine Zwischensumme je Gruppe, wo Summieren
// fachlich stimmt" - und NUR dort, siehe der lange Kommentar bei
// zeigeListe() oben zu summierbar). <th scope="rowgroup"> statt <td>:
// eine Gruppenzeile IST eine Ueberschrift fuer die Zeilen darunter, ein
// Bildschirmleser soll das auch als solche ansagen.
function spaltenkopfGruppenzeile(gruppe, spalten, aktionen, gruppenSpalte) {
    const tr = document.createElement('tr');
    tr.className = 'gruppenkopf-zeile';

    const th = document.createElement('th');
    th.setAttribute('scope', 'rowgroup');
    th.colSpan = spalten.length + (aktionen ? 1 : 0);

    const beschriftung = document.createElement('span');
    beschriftung.className = 'gruppenkopf-beschriftung';
    beschriftung.textContent = t('common.groupHeaderLabel',
        { titel: gruppenSpalte.titel, beschriftung: gruppe.beschriftung, n: zahlFormat(gruppe.zeilen.length) });
    th.append(beschriftung);

    for (const spalte of spalten) {
        if (!spalte.summierbar || !spalte.titel) continue;
        const summe = gruppe.zeilen.reduce((s, z) => s + (Number(z[spalte.feld]) || 0), 0);
        const teil = document.createElement('span');
        teil.className = 'gruppenkopf-teilsumme';
        teil.append(document.createTextNode(`${spalte.titel}: `));
        // summeFormatieren() statt formatieren(): eine Zwischensumme hat
        // keine ZEILE, die ein formatieren(wert, zeile) mit zeile-Zugriff
        // (z. B. co2ZelleElement() in auswertungen.js) brauchen wuerde -
        // siehe der lange Kommentar bei zeigeListe() oben.
        const formatiert = spalte.summeFormatieren ? spalte.summeFormatieren(summe)
            : spalte.formatieren ? spalte.formatieren(summe)
            : zahlFormat(summe);
        teil.append(formatiert instanceof Node ? formatiert : document.createTextNode(String(formatiert)));
        th.append(teil);
    }

    tr.append(th);
    return tr;
}

// Baut EINE Datenzeile - derselbe Zellenaufbau, den zeigeListe() vor
// dieser Erweiterung inline hatte, nur herausgeloest, weil er jetzt aus
// zwei Stellen aufgerufen wird (flach ohne Gruppierung, oder je Gruppe
// einmal). index ist die Position in listenZeilen/listenZeilenElemente
// (siehe zeileWaehlen() weiter unten) - bei Gruppierung ein fortlaufender
// Zaehler UEBER alle Gruppen hinweg, nicht je Gruppe neu bei 0: eine
// stabile Bucket-Aufteilung (siehe gruppiere() oben, Map in
// Einfuegereihenfolge) reiht die Zeilen dabei exakt wieder in ihrer
// urspruenglichen Reihenfolge auf, sodass dieser Zaehler und die flache
// Liste "angezeigt" immer dieselbe Zeile meinen.
function baueDatenzeile(zeile, spalten, aktionen, index) {
    const tr = document.createElement('tr');
    tr.tabIndex = -1;
    for (const spalte of spalten) {
        const td = document.createElement('td');
        const wert = zeile[spalte.feld];
        const inhalt = spalte.formatieren ? spalte.formatieren(wert, zeile) : (wert ?? '');
        // formatieren darf statt eines Strings auch ein einzelnes
        // Element liefern - eine Säulen-Sparkline, einen Zellbalken oder
        // eine typografisch skalierte Zahl (siehe saeulenSparkline()/
        // zellbalken()/zahlSkaliert() weiter unten). textContent wäre
        // dafür der falsche Weg: ein Element dort hineingeschrieben erschiene
        // als "[object HTMLSpanElement]", nicht als das Element
        // selbst. replaceChildren() nimmt ein Element ODER (weiterhin)
        // einen String gleich sicher entgegen wie vorher textContent -
        // keine innerHTML-Stelle kommt dazu, an der ein
        // Schadensmeldungstext oder Kundenname durchliefe.
        if (inhalt instanceof Node) {
            td.replaceChildren(inhalt);
        } else {
            td.textContent = inhalt;
        }
        const klasse = typeof spalte.klasse === 'function' ? spalte.klasse(zeile) : spalte.klasse;
        if (klasse) td.className = klasse;
        tr.append(td);
    }
    if (aktionen) tr.append(zeilenAktionenZelle(aktionen(zeile) || []));
    tr.addEventListener('click', () => zeileWaehlen(index));
    listenZeilenElemente.push(tr);
    return tr;
}

// "Kein Treffer fuer diesen Spaltenfilter" (Erprobung, Auftrag) - eine
// schlanke Zeile INNERHALB der bestehenden Tabelle statt eines Aufrufs
// von zeigeLeermaske(), das Kopf- UND Filterzeile mit wegraeumen wuerde
// (siehe der lange Kommentar bei zeigeListe() oben, Abschnitt "KEIN
// zeigeLeermaske()"). listenZeilen bleibt dabei [] (siehe
// zeichneArbeitstabelle() oben) - der globale Pfeiltasten-Handler prueft
// das bereits ("if (listenZeilen.length === 0) return"), es gibt hier
// nichts zusaetzlich abzusichern.
function baueLeerzeile(spalten, aktionen) {
    const tr = document.createElement('tr');
    tr.className = 'spaltenkopf-leerzeile';
    const td = document.createElement('td');
    td.colSpan = spalten.length + (aktionen ? 1 : 0);
    td.append(document.createTextNode(t('common.noRowsMatchFilter')));
    const knopf = document.createElement('button');
    knopf.type = 'button';
    knopf.textContent = t('common.columnFilterReset');
    knopf.addEventListener('click', () => {
        spaltenkopfFilterwerte = new Map();
        zeichneArbeitstabelle();
    });
    td.append(knopf);
    tr.append(td);
    return tr;
}

// Baut die Icon-Zelle EINER Zeile - für JEDE Zeile aufgerufen, auch
// wenn die Liste für diese Zeile keine einzige Handlung anbietet (dann
// bleibt die Zelle leer, aber vorhanden). Genau das hält die Spalte in
// jeder Zeile gleich breit: eine Zelle, die erst bei :hover ins DOM
// käme, würde die Tabellenspalte beim ersten Überfahren einer Zeile
// nachträglich aufweiten - das "Layout verschiebt sich"-Problem, vor
// dem der Auftrag ausdrücklich warnt. Sichtbar/unsichtbar regelt
// stattdessen ausschließlich CSS (.zeilen-aktionen, opacity statt
// display - siehe dortiger Kommentar für den Tastatur-Grund).
function zeilenAktionenZelle(liste) {
    const td = document.createElement('td');
    td.className = 'zeilen-aktionen-zelle';

    const wrapper = document.createElement('div');
    wrapper.className = 'zeilen-aktionen';

    for (const aktion of liste) {
        const knopf = document.createElement('button');
        knopf.type = 'button';
        knopf.className = aktion.art === 'gefaehrlich'
            ? 'zeilen-aktion zeilen-aktion-gefaehrlich' : 'zeilen-aktion';
        knopf.setAttribute('aria-label', aktion.titel);
        knopf.title = aktion.titel;
        // aktion.svg ist keine Nutzereingabe, sondern eine im jeweiligen
        // Bereich fest verdrahtete Konstante (siehe iconAus() in
        // flotte.js) - innerHTML ist hier deshalb unbedenklich, anders
        // als bei jedem textContent-Aufruf in bestätige()/frageNachGrund()
        // weiter oben, wo tatsächlich Benutzereingaben durchlaufen.
        knopf.innerHTML = aktion.svg;
        knopf.addEventListener('click', async (e) => {
            // Sonst wählte derselbe Klick zusätzlich die ganze Zeile
            // aus (tr trägt weiter unten einen eigenen 'click'-Handler,
            // der bei jedem Klick INNERHALB der Zeile feuert).
            e.stopPropagation();
            knopf.disabled = true;
            try {
                await aktion.ausfuehren();
            } catch (fehler) {
                melde(fehler.message, 'schlecht');
            } finally {
                knopf.disabled = false;
            }
        });
        wrapper.append(knopf);
    }

    td.append(wrapper);
    return td;
}

function zeileWaehlen(index) {
    if (index < 0 || index >= listenZeilen.length) return;
    listenZeilenElemente.forEach((el) => {
        el.classList.remove('ausgewaehlt');
        el.tabIndex = -1;
    });
    listenIndex = index;
    const element = listenZeilenElemente[index];
    element.classList.add('ausgewaehlt');
    element.tabIndex = 0;
    element.focus();
    element.scrollIntoView({ block: 'nearest' });
    if (listenAuswahl) listenAuswahl(listenZeilen[index]);
}

// ===== Detailmaske =====

let hauptknopfElement = null;

// Feather-Stil, dieselbe Familie wie SPALTENKOPF_SORT_ICON/aktion.svg
// (24x24, currentColor per CSS) - ein einfaches Kreuz fuer die
// Schliessen-Schaltflaeche in zeigeMaske() (Gestaltungsauftrag Punkt 1).
const DETAILMASKE_SCHLIESSEN_ICON = '<svg viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>';

// felder: [{ name, titel, wert, typ, nurLesen?, optionen? }]
// knöpfe: [{ titel, art, ausführen: async () => {} }]
// art: 'haupt' | 'neben' | 'gefährlich' | 'schaffend'
// bild (optional, Gestaltungsauftrag Punkt 5, wörtlich: "ich will in der
// rechten Kachel das Bild des jeweiligen Rades sehen"): ein fertiges
// <img>-Element, VOR dem Formular eingehängt - #detailmaske IST die
// "rechte Kachel", aus der der Auftrag spricht (siehe #detailmaske in
// style.css, ~45% Fensterbreite rechts neben der Liste). Nur flotte.js
// (radMaske()) übergibt heute eines; alle übrigen Aufrufer lassen den
// Parameter weg und bekommen exakt das bisherige Verhalten - ein
// optionaler vierter Parameter statt eines neuen Bausteins, weil eine
// Maske MIT Bild sich sonst in nichts von einer ohne unterscheidet.
//
// 'schaffend' (Punkt 4 der Gestaltung, grün wie --gut) kam mit dieser
// Bearbeitung dazu, ausdrücklich NEBEN 'haupt' statt an dessen Stelle:
// vor dieser Änderung liefen sowohl "Anlegen"-Knöpfe (ein neues Rad,
// eine neue Station, ein neuer Kunde, ein neuer Wartungsauftrag, eine
// neue Schadensmeldung entsteht) als auch reine "Speichern"/"Erledigen"-
// Knöpfe (eine BESTEHENDE Zeile ändern bzw. abschließen) unter
// demselben 'haupt'. Grün für das Anlegen ist eindeutig - es lässt
// etwas entstehen. Für "Speichern" (kunden.js, eine bestehende Person
// ändern) oder "Erledigen" (instandhaltung.js, einen laufenden Auftrag
// abschließen) wäre Grün dagegen irreführend: nichts NEUES entsteht
// dabei, und ein rein nach Farbe scannender Blick könnte "grün = fertig
// buchen" mit "grün = neu anlegen" verwechseln. Deshalb bleiben diese
// beiden Fälle bei 'haupt' (marine, wie zuvor) - nur die tatsächlichen
// Neuanlagen (flotte.js, kunden.js kundeAnlegenMaske, instandhaltung.js
// Auftrag eroeffnen/Schaden melden, stationen.js) wurden auf 'schaffend'
// umgestellt. Weiß auf --gut misst 5.36:1 (gemessen, siehe Bericht).
function zeigeMaske(titel, felder, knoepfe, bild = null) {
    const wurzel = document.getElementById('detailmaske');
    wurzel.replaceChildren();
    hauptknopfElement = null;

    // Kopfzeile mit Titel UND einer sichtbaren Schliessen-Schaltflaeche
    // (Gestaltungsauftrag Punkt 1: "das fehlt einfach" - Escape allein
    // war vorher der EINZIGE Weg zurueck, unsichtbar fuer jeden, der die
    // Taste nicht kennt oder mit der Maus arbeitet). Ein <div> statt des
    // <h2> direkt an der Wurzel, weil Titel und Knopf nebeneinander
    // stehen muessen - #detailmaske h2 traegt seine bisherige Formatierung
    // unveraendert weiter, nur eine Ebene tiefer (siehe style.css).
    const kopf = document.createElement('div');
    kopf.className = 'detailmaske-kopf';

    const ueberschrift = document.createElement('h2');
    ueberschrift.textContent = titel;
    kopf.append(ueberschrift);

    const schliessenKnopf = document.createElement('button');
    schliessenKnopf.type = 'button';
    schliessenKnopf.className = 'detailmaske-schliessen';
    schliessenKnopf.setAttribute('aria-label', t('common.closeDetailsAria'));
    schliessenKnopf.title = t('common.closeDetailsTitle');
    // Rohes SVG-Markup, dieselbe Machart wie SPALTENKOPF_SORT_ICON/
    // aktion.svg - eine feste Konstante dieser Datei, keine Nutzereingabe.
    schliessenKnopf.innerHTML = DETAILMASKE_SCHLIESSEN_ICON;
    schliessenKnopf.addEventListener('click', () => { maskeSchliessen(); });
    kopf.append(schliessenKnopf);

    wurzel.append(kopf);

    // bild direkt unter der Kopfzeile, VOR jedem Feld - "das Bild des
    // jeweiligen Rades" (Auftrag) ist der Einstieg in diese Maske, keine
    // Randnotiz hinter den Textfeldern. Der Rahmen um das Bild kommt aus
    // .detailmaske-bild (style.css), das Bild selbst bringt sein eigenes
    // alt/aria-hidden schon vom Aufrufer mit (siehe radMaske() in
    // flotte.js).
    if (bild) {
        const bildRahmen = document.createElement('div');
        bildRahmen.className = 'detailmaske-bild';
        bildRahmen.append(bild);
        wurzel.append(bildRahmen);
    }

    const form = document.createElement('form');
    form.className = 'detailformular';
    // Kein natives Absenden - gespeichert wird über die Knöpfe bzw.
    // über Strg+S (maskeSpeichern), nicht über Enter/Submit.
    form.addEventListener('submit', (e) => e.preventDefault());

    for (const feld of felder) {
        const zeile = document.createElement('div');
        zeile.className = 'formularzeile';

        const label = document.createElement('label');
        label.textContent = feld.titel;
        label.htmlFor = `feld-maske-${feld.name}`;
        zeile.append(label);

        let eingabe;
        if (feld.optionen) {
            eingabe = document.createElement('select');
            for (const option of feld.optionen) {
                const opt = document.createElement('option');
                opt.value = option.wert;
                opt.textContent = option.text;
                if (option.wert === feld.wert) opt.selected = true;
                eingabe.append(opt);
            }
            // <select> kennt kein readonly - disabled ist die einzige
            // native Entsprechung. Nimmt das Feld aus der Tab-Reihenfolge,
            // ist bei nur lesbaren Werten aber ohne praktischen Nachteil.
            if (feld.nurLesen) eingabe.disabled = true;
        } else if (feld.typ === 'mehrzeilig') {
            eingabe = document.createElement('textarea');
            eingabe.value = feld.wert ?? '';
            if (feld.nurLesen) eingabe.readOnly = true;
        } else {
            eingabe = document.createElement('input');
            // Deutsche Typangaben auf die passenden HTML5-Eingabetypen
            // abbilden; alles andere (z. B. 'email') geht unverändert
            // durch.
            const typZuordnung = { zahl: 'number', datum: 'date' };
            eingabe.type = typZuordnung[feld.typ] || feld.typ || 'text';
            eingabe.value = feld.wert ?? '';
            if (feld.nurLesen) eingabe.readOnly = true;
        }
        eingabe.id = `feld-maske-${feld.name}`;
        eingabe.name = feld.name;
        // Ausgangswert festhalten (Gestaltungsauftrag Punkt 1: "wer gerade
        // in einem Feld tippt, erwartet beim ersten Escape das Verwerfen
        // der Eingabe" UND "ungespeicherte Eingaben duerfen nicht durch
        // ein versehentliches Escape verloren gehen"). Ein data-Attribut
        // statt eines separaten Moduls-Zustands: der Vergleichswert lebt
        // damit AM Feld selbst, ueberlebt unveraendert, welches Feld
        // gerade den Fokus traegt, und verschwindet automatisch mit dem
        // Feld, wenn die Maske neu aufgebaut oder geschlossen wird - kein
        // eigenes Aufraeumen noetig. String(...) normalisiert dabei
        // Zahlen/null/undefined auf denselben Vergleichstyp wie
        // eingabe.value (immer ein String).
        eingabe.dataset.ursprungswert = String(feld.wert ?? '');
        zeile.append(eingabe);
        form.append(zeile);
    }
    wurzel.append(form);

    const knopfleiste = document.createElement('div');
    knopfleiste.className = 'knopfleiste';
    for (const def of knoepfe) {
        const knopf = document.createElement('button');
        knopf.type = 'button';
        knopf.textContent = def.titel;
        knopf.className = `knopf-${def.art}`;
        // Fehler werden hier zentral gefangen, statt in jedem
        // ausführen() einzeln: rufeAuf() aus daten.js wirft mit
        // Absicht bei einem Fehlschlag, damit der Aufrufer ihn nicht
        // schlucken kann. Diese Stelle ist der eine Ort, an dem alle
        // fünf Arbeitsbereiche diesen Wurf einheitlich in die
        // Statuszeile übersetzen.
        knopf.addEventListener('click', async () => {
            knopf.disabled = true;
            try {
                await def.ausfuehren();
            } catch (fehler) {
                melde(fehler.message, 'schlecht');
            } finally {
                knopf.disabled = false;
            }
        });
        knopfleiste.append(knopf);
        // Strg+S (maskeSpeichern()) klickt hauptknopfElement - das muss
        // seit der Aufteilung in 'haupt'/'schaffend' BEIDE Kategorien
        // erfassen, sonst wäre die Tastaturbedienung für jede
        // "Anlegen"-Maske stumm geworden, nur weil ihr Knopf jetzt grün
        // statt marine ist. Eine Maske hat ohnehin höchstens einen
        // dieser beiden - nie 'haupt' UND 'schaffend' gleichzeitig -,
        // deshalb bleibt "genau ein Hauptknopf" so oder so gewahrt.
        if (def.art === 'haupt' || def.art === 'schaffend') hauptknopfElement = knopf;
    }
    wurzel.append(knopfleiste);
}

// Eine leere Liste ist kein leerer Kasten. Sie sagt, WARUM nichts da ist,
// und bietet an, was als Nächstes zu tun wäre.
//
// kennung: von neuerVorgang() geliefert, genau wie bei zeigeListe() -
// und aus demselben Grund (KRITISCH 2). Seit f1ef6c3 trägt jeder
// Neuaufbau eine Kennung; zeigeListe() prüft sie, zeigeLeermaske() tat
// es bisher NICHT, obwohl sie nach demselben await steht wie zeigeListe()
// in jeder *Zeigen()-Funktion (schaedenZeigen()/auftraegeZeigen() in
// instandhaltung.js). Im Browser nachgestellt: Instandhaltung, Reiter
// "Auftraege" angeklickt (Vorgang A, damals leer) und sofort zurück auf
// "Schaeden" (Vorgang B, gefüllt). B löste zuerst auf und zeigte die
// Schadensliste; A löste dann VERSPÄTET auf und überschrieb sie
// klaglos mit "Keine laufenden Wartungsaufträge" - während der Reiter
// weiterhin "Offene Schaeden" anzeigte und die Werkzeugleiste "Schaden
// melden" stehen liess. Ein in sich widersprüchlicher Bildschirm, den
// dieselbe Prüfung wie bei zeigeListe() verhindert.
// angebot: { titel, ausführen: async () => {} } | null
function zeigeLeermaske(kennung, titel, erklaerung, angebot = null) {
    if (!istAktuellerVorgang(kennung)) return;

    listenZeilen = [];
    listenAuswahl = null;
    listenIndex = -1;
    listenZeilenElemente = [];

    const wurzel = listenKoerper();
    wurzel.replaceChildren();

    const kasten = document.createElement('div');
    kasten.className = 'leermaske';

    const ueberschrift = document.createElement('h2');
    ueberschrift.textContent = titel;
    kasten.append(ueberschrift);

    const text = document.createElement('p');
    text.textContent = erklaerung;
    kasten.append(text);

    if (angebot) {
        const knopf = document.createElement('button');
        knopf.type = 'button';
        knopf.textContent = angebot.titel;
        // Bewusst 'knopf-haupt' (marine) statt 'knopf-schaffend' (grün),
        // anders als bei zeigeWerkzeugleiste() weiter oben: DIESES Angebot
        // ist nicht immer eine Neuanlage. instandhaltung.js bietet über
        // denselben Parameter sowohl "Schaden melden" (legt tatsächlich
        // etwas an) als auch "Zu den offenen Schäden" (wechselt nur den
        // Unterreiter, legt nichts an) an - ein hier fest verdrahtetes
        // Grün wäre im zweiten Fall falsch. Ein eigenes 'art'-Feld im
        // angebot-Objekt hätte das sauber getrennt, war für eine leere
        // Liste als Randfall aber mehr Aufwand, als der heutige Bestand
        // (zwei von vier Aufrufern nutzen überhaupt ein angebot) rechtfertigt.
        knopf.className = 'knopf-haupt';
        knopf.addEventListener('click', async () => {
            knopf.disabled = true;
            try {
                await angebot.ausfuehren();
            } catch (fehler) {
                melde(fehler.message, 'schlecht');
            } finally {
                knopf.disabled = false;
            }
        });
        kasten.append(knopf);
    }
    wurzel.append(kasten);

    // Ohne Zeilen gibt es nichts auszuwählen - eine noch offene Maske
    // bezöge sich sonst auf eine Zeile, die gerade verschwunden ist.
    document.getElementById('detailmaske').replaceChildren();
    hauptknopfElement = null;
}

// Zwei Listen in einem Bereich, wenn sie fachlich zusammengehören.
//
// kennung: dieselbe Absicherung wie bei zeigeListe()/zeigeLeermaske()
// (WICHTIG 3, aus derselben Prüfung wie KRITISCH 2). Heute läuft jeder
// Aufruf zufällig SYNCHRON direkt nach neuerVorgang() (siehe
// instandhaltungAufbauen()/auswertungenAufbauen()), also ist der Fehler
// beim jetzigen Baustand nicht auslösbar - aber die Schnittstelle bot
// bislang gar keine Kennung an. Ein künftiger Bereich, der die Reiter
// erst NACH einem await aufbaut (etwa nach einem eigenen Nachladen),
// erbte den Fehler aus KRITISCH 2 ohne dass ihn hier etwas hinderte. Die
// Prüfung kostet den heutigen synchronen Fall nichts (kennung ist dann
// immer aktuell) und schützt den nächsten Aufrufer trotzdem.
// reiter: [{ schluessel, titel }]
function zeigeUnterreiter(kennung, reiter, aktiv, beiWechsel) {
    if (!istAktuellerVorgang(kennung)) return;

    const leiste = reiterleiste();
    leiste.replaceChildren();
    for (const r of reiter) {
        const knopf = document.createElement('button');
        knopf.type = 'button';
        knopf.textContent = r.titel;
        knopf.setAttribute('role', 'tab');
        knopf.setAttribute('aria-selected', String(r.schluessel === aktiv));
        knopf.className = r.schluessel === aktiv ? 'reiter aktiv' : 'reiter';
        knopf.addEventListener('click', () => beiWechsel(r.schluessel));
        leiste.append(knopf);
    }
}

// Synchron, weil jeder Maskenaufbau es mehrfach fragt. Der
// Rollenspeicher ist zu diesem Zeitpunkt gefüllt - seiteAufbauen() hat
// ihn geladen, bevor irgendein Bereich baut.
//
// instanceof Set statt einer Prüfung auf null: geladeneRollen kann jetzt
// auch false sein (kein Mitarbeiter). false.has(...) würfe eine
// TypeError - deny-by-default heißt hier, jeden Nicht-Set-Fall
// gleichermaßen als "keine Rolle" zu behandeln, nicht nur den
// Anfangszustand vor dem ersten Laden.
function darfRolle(code) {
    return geladeneRollen instanceof Set && geladeneRollen.has(code);
}

// ===== Querverweise (Gestaltungsauftrag Punkt 3: "Sichten verweben") =====
//
// "Insgesamt also noch viel mehr die Infos untereinander verweben, damit
// sich die Sichten ergaenzen und richtige Workflows moeglich machen" -
// woertlich der Auftrag. Heute sind die fuenf Bereiche fuenf Inseln:
// dieselbe Rahmennummer taucht in Flotte UND Instandhaltung auf, ohne
// dass ein Klick von einer zur anderen fuehrt. EIN Baustein hier statt
// eines eigenen Sprungs je Bereichspaar - dieselbe Wiederholungsfalle wie
// bei Werkzeugleiste/Filterleiste/Uebersichtsstreifen weiter oben (siehe
// deren Kopfkommentare): fuenf Bereiche, die denselben Sprung unabhaengig
// voneinander nachbauen wuerden, sobald ein zweites Bereichspaar dazukommt.
//
// DIE ROLLEN ENTSCHEIDEN MIT (Auftrag, woertlich): darfBereich() prueft
// dieselben bereich.rollen, die navigationAufbauen() oben schon fuer die
// Menuepunkte selbst auswertet - ein Sprung in einen Bereich, den die
// angemeldete Rolle nicht sehen darf, ist dieselbe Einladung zu einer
// unerklaerten Leere wie ein Menuepunkt fuer einen Bereich ohne eigene
// Berechtigung (siehe Kopfkommentar bei navigationAufbauen()). Der
// AUFRUFER prueft darfBereich(), BEVOR er den Sprung-Knopf ueberhaupt
// baut - "was man nicht darf, wird nicht angeboten", nicht ausgegraut.
// bereichSprung() selbst prueft zusaetzlich, defensiv: ein Aufrufer, der
// das vergisst, bekommt einen wortlosen Fehlschlag statt eines Sprungs in
// eine Navigation, die derselbe Nutzer im Menue nie zu sehen bekaeme.
function darfBereich(schluessel) {
    const bereich = bereiche.get(schluessel);
    return Boolean(bereich) && bereich.rollen.some((r) => darfRolle(r));
}

// zielSchluessel: bereich.schluessel des Ziels (siehe bereichAnmelden()).
// herkunftstext: "gekommen von ..." - erscheint als Bestaetigung in der
//   Statuszeile DES ZIELBEREICHS ("sagen, woher man kommt", Auftrag
//   woertlich). Wird an bereichWechseln() durchgereicht statt hier selbst
//   per melde() gesetzt - bereichWechseln() loescht die Statuszeile bei
//   JEDEM Wechsel bedingungslos (siehe dortiger Kommentar), ein melde()
//   HIER waere von genau diesem Loeschen sofort wieder ueberschrieben
//   worden.
// einrichten: optionales async () => {}, LAEUFT NACH bereichWechseln() -
//   der Zielbereich hat seine erste Liste dann bereits geladen und
//   gezeichnet (setzeSpaltenkopfFilter()/waehleZeileMit() unten setzen
//   genau darauf auf). Ein bereichseigenes "vorher" (z. B. Instandhaltung
//   auf den Unterreiter "Schaeden" stellen, BEVOR ihr eigenes aufbauen()
//   laeuft) gehoert NICHT hierher, sondern in eine eigene, vom Zielbereich
//   selbst angebotene Funktion (siehe instandhaltungZeigeSchaeden() in
//   instandhaltung.js) - dieser Baustein kennt die Interna keines
//   einzelnen Bereichs.
async function bereichSprung(zielSchluessel, herkunftstext, einrichten = null) {
    if (!darfBereich(zielSchluessel)) return;   // siehe Kopfkommentar oben
    await bereichWechseln(zielSchluessel, herkunftstext);
    if (einrichten) await einrichten();
}

// "... dorthin FILTERN ..." (Auftrag) - setzt einen Spaltenkopf-Filter
// (zeigeListe()) von AUSSEN, fuer den Einsatz als einrichten() bei
// bereichSprung() oben. feld muss eine Spalte sein, die die geladene
// Liste des ZIELBEREICHS tatsaechlich anbietet (siehe zeigeListe()) -
// sonst wird der Eintrag zwar gesetzt, aber von keiner Spalte abgefragt
// und filtert folglich nichts. zeichneArbeitstabelle() zeichnet sofort
// neu, mit demselben Zustand, den ein Klick auf ein Spaltenkopf-
// Filterfeld auch ausloesen wuerde - kein zweiter Ladevorgang noetig,
// der Zielbereich hat seine Zeilen (spaltenkopfListe) bereits.
function setzeSpaltenkopfFilter(feld, wert) {
    spaltenkopfFilterwerte.set(feld, wert);
    if (spaltenkopfListe) zeichneArbeitstabelle();
}

// "... oder AUSWAEHLEN" (Auftrag) - waehlt von AUSSEN die Zeile aus,
// deren vergleichsfeld genau wert traegt (z. B. fahrrad_id), fuer den
// Einsatz als einrichten() bei bereichSprung() oben. Wortlos folgenlos,
// wenn keine Zeile passt (etwa weil die Zielzeile in der Zwischenzeit
// den Bearbeitungsstand gewechselt hat und aus einer gefilterten Liste
// gefallen ist) - derselbe Grundsatz wie bei jedem anderen veralteten
// Zustand in dieser Oberflaeche: kein Absturz, keine falsche Auswahl.
function waehleZeileMit(vergleichsfeld, wert) {
    const index = listenZeilen.findIndex((z) => z[vergleichsfeld] === wert);
    if (index !== -1) zeileWaehlen(index);
}

// ===== Profilmenü =====
//
// Bedienung des Rundknopfs oben rechts (Punkt 3). Absichtlich getrennt
// von profilAufbauen() oben, das nur den INHALT füllt: profilAufbauen()
// läuft bei jedem seiteAufbauen()-Durchlauf erneut, ein hier
// angehängter Klick-Handler würde sich also mit der Zeit vervielfachen,
// wenn er dort stände. Hier, am Skriptende, läuft er dagegen GENAU
// EINMAL - derselbe Aufbau wie bei "Anmeldung verdrahten" unten.
const knopfProfil = document.getElementById('knopf-profil');
const profilmenue = document.getElementById('profilmenue');

function profilmenueOffen() {
    return !profilmenue.hidden;
}

function profilmenueSchliessen() {
    if (!profilmenueOffen()) return;
    profilmenue.hidden = true;
    knopfProfil.setAttribute('aria-expanded', 'false');
}

function profilmenueOeffnen() {
    profilmenue.hidden = false;
    knopfProfil.setAttribute('aria-expanded', 'true');
}

// Ein <button> reagiert schon von sich aus auf Enter UND Leertaste wie
// auf einen Klick - ein eigener keydown-Handler für das ÖFFNEN wäre
// eine zweite, überflüssige Umsetzung derselben Tastaturbedienung.
// Nur das SCHLIESSEN per Escape braucht eine eigene Behandlung, weiter
// unten im globalen keydown-Listener.
knopfProfil.addEventListener('click', () => {
    if (profilmenueOffen()) profilmenueSchliessen();
    else profilmenueOeffnen();
});

// Klick außerhalb schließt das Menü. Auf 'click' verdrahtet, nicht
// 'pointerdown': der öffnende Klick auf knopfProfil selbst durchläuft
// wegen der Ereignisblase erst den eigenen Handler oben (Menü geht auf)
// und danach, im selben Klick, diesen document-Handler - der aber
// erkennt über knopfProfil.contains(e.target), dass der Klick INNERHALB
// des Profilbereichs lag, und lässt das gerade geöffnete Menü in Ruhe.
document.addEventListener('click', (e) => {
    if (!profilmenueOffen()) return;
    if (knopfProfil.contains(e.target) || profilmenue.contains(e.target)) return;
    profilmenueSchliessen();
});

// ===== Einstellungen (Gestaltungsauftrag Punkt 3: Zebramuster als
// Wahlmoeglichkeit, "optional anbieten" statt fest einzuschalten) =====
//
// localStorage statt einer Spalte/Tabelle in der Datenbank: eine reine
// Anzeigepraeferenz ohne jede fachliche Bedeutung - sie beeinflusst
// keine Buchung, keinen Bestand, keine Sicht. Der Auftrag verlangt an
// anderer Stelle ausdruecklich "Verfeinerung, nicht Umbau" und "nichts
// an der Datenbank aendern" - eine neue Spalte nur fuer "mag diese
// Person Streifen" waere beides zugleich verletzt, fuer einen Wert, der
// nirgends sonst gebraucht wird. localStorage ueberlebt von sich aus
// jeden Neuaufbau UND jeden Bereichswechsel (beide leeren nur
// #arbeitsliste/#detailmaske, siehe bereichWechseln() oben, nie den
// Browserspeicher) - genau die vom Auftrag verlangte Haltbarkeit, ganz
// ohne eigene Zwischenspeicherung hier im Skript.
const ZEBRA_SPEICHERSCHLUESSEL = 'velocity-wawi-zebra';

// ===== Ein- und Ausklappen der Navigation (Gestaltungsauftrag Punkt 3,
// woertlich: "die linke Leiste ist so langweilig wie Outlook 98, man
// kann sie nicht einmal ein-/ausklappen") =====
//
// Dieselbe Machart und dieselbe Begruendung wie beim Zebramuster direkt
// darueber und bei der Kopftafel weiter oben: eine reine
// Anzeigepraeferenz ohne fachliche Bedeutung, in localStorage statt in
// der Datenbank. Sie ueberlebt damit von sich aus BEIDE vom Auftrag
// verlangten Faelle - den Bereichswechsel (bereichWechseln() leert nur
// #arbeitsliste/#detailmaske, nie den Browserspeicher) und das Neuladen
// der Seite.
//
// VORGABE AUSGEKLAPPT, anders als bei der Kopftafel: eine Tafel voller
// Kennzahlen ist Beiwerk, das man aufklappt, wenn man es braucht - eine
// Navigation ist der Weg selbst. Wer die Anwendung zum ersten Mal
// oeffnet, soll lesen koennen, welche Bereiche es gibt, nicht fuenf
// Symbole raten muessen. Deshalb hier der einfache Vergleich auf 'an'
// (fehlender Schluessel => ausgeklappt), nicht der umgekehrte wie bei
// kopftafelEingeklappt().
const NAVIGATION_SPEICHERSCHLUESSEL = 'velocity-wawi-navigation-schmal';

function navigationEingeklappt() {
    return localStorage.getItem(NAVIGATION_SPEICHERSCHLUESSEL) === 'an';
}

// Wie zebraAnwenden(): EINE Klasse auf <body>, den Rest macht das
// Stilblatt. Die Klasse muss auf <body> sitzen und nicht auf
// #navigation, weil sie die SPURBREITE des Rasters aendert - und die
// steht an #zustand-arbeit, dem ELTERNELEMENT der Navigation (siehe
// body.navigation-schmal #zustand-arbeit in style.css). Ein Kind kann
// seine eigene Rasterspur nicht setzen.
function navigationAnwenden(eingeklappt) {
    document.body.classList.toggle('navigation-schmal', eingeklappt);
    const knopf = document.getElementById('knopf-navigation');
    // aria-expanded beschreibt die NAVIGATION (aria-controls), nicht den
    // Knopf: ausgeklappt = true.
    knopf.setAttribute('aria-expanded', String(!eingeklappt));
    // Derselbe Stolperstein wie beim Einklappen der Kopftafel (siehe
    // dort): das Hinweisfenster zeigt moeglicherweise gerade auf eine
    // Rubrik, die sich unter ihm wegbewegt - ohne Mausbewegung feuert
    // dabei kein mouseleave.
    hinweisfensterVerstecken();
}

// Sofort beim Laden dieser Datei, aus demselben Grund wie
// zebraAnwenden() weiter unten: sonst stuende die Leiste beim ersten
// Aufbau kurz ausgeklappt da und spraenge dann zu.
navigationAnwenden(navigationEingeklappt());

document.getElementById('knopf-navigation').addEventListener('click', () => {
    const neu = !navigationEingeklappt();
    localStorage.setItem(NAVIGATION_SPEICHERSCHLUESSEL, neu ? 'an' : 'aus');
    navigationAnwenden(neu);
});

// Ueberfahren und Tastaturfokus auf einer Rubrik - aber NUR, solange die
// Leiste eingeklappt ist. Ausgeklappt steht der Name sichtbar daneben;
// ein Hinweisfenster, das ihn ein zweites Mal zeigt, waere genau das
// Beiwerk, das in diesem Projekt als Mangel gilt.
//
// 'rechts' statt der Vorgabe 'oben' (siehe hinweisfensterZeigen()): eine
// Leiste steht senkrecht, ihre Eintraege liegen uebereinander - ein
// Fenster ueber der Rubrik verdeckte die Rubrik darueber. Rechts daneben
// liegt das Arbeitsblatt, dort steht es frei.
function navigationRubrikVerdrahten(knopf, titel) {
    const zeigen = () => {
        if (!navigationEingeklappt()) return;
        hinweisfensterZeigen(titel, knopf.getBoundingClientRect(), 'rechts');
    };
    knopf.addEventListener('mouseenter', zeigen);
    knopf.addEventListener('mouseleave', hinweisfensterVerstecken);
    knopf.addEventListener('focus', zeigen);
    knopf.addEventListener('blur', hinweisfensterVerstecken);
}

function zebraGespeichert() {
    return localStorage.getItem(ZEBRA_SPEICHERSCHLUESSEL) === 'an';
}

// Reines CSS-Zebra (siehe body.zebra-an in style.css): eine Klasse auf
// <body> genuegt, kein Neuzeichnen der gerade sichtbaren Tabelle noetig -
// anders als Sortieren/Filtern/Gruppieren aendert dieser Schalter nicht,
// WELCHE Zeilen dastehen, nur ihr Aussehen.
function zebraAnwenden(aktiv) {
    document.body.classList.toggle('zebra-an', aktiv);
}

// Sofort beim Laden dieser Datei, vor jedem ersten Tabellenaufbau -
// sonst zeichnete die allererste Liste eines Arbeitstages kurz
// ungestreift, bis irgendein spaeterer Codepfad die Einstellung zum
// ersten Mal anwendet.
zebraAnwenden(zebraGespeichert());

const schalterZebra = document.getElementById('schalter-zebra');
schalterZebra.checked = zebraGespeichert();
schalterZebra.addEventListener('change', () => {
    zebraAnwenden(schalterZebra.checked);
    localStorage.setItem(ZEBRA_SPEICHERSCHLUESSEL, schalterZebra.checked ? 'an' : 'aus');
});

// ===== Sprachumschaltung (Gestaltungsauftrag, woertlich: "eine
// Umstellung der Oberflaeche auf englisch, tuerkisch, spanisch,
// italienisch und polnisch") =====
//
// Im selben Abschnitt wie der Zebraschalter direkt oberhalb - dieselbe
// Begruendung gilt unveraendert: eine reine Anzeigepraeferenz ohne
// fachliche Bedeutung, localStorage statt einer Datenbankspalte, siehe
// SPRACHE_SPEICHERSCHLUESSEL weiter oben. sprache()/localeTag() dort
// lesen denselben Schluessel - dieser Block hier ist nur die BEDIENUNG
// dazu, keine zweite Quelle der Wahrheit.
//
// statischeTexteUebersetzen(): alle festen HTML-Texte (index.html trägt
// data-i18n/-aria/-placeholder auf jedem betroffenen Element, siehe
// dortiger Kopfkommentar) - EINMAL beim Laden UND bei JEDEM Sprachwechsel
// neu gesetzt. Kein innerHTML: ausschliesslich textContent/setAttribute,
// dieselbe Regel wie ueberall sonst in dieser Datei.
function statischeTexteUebersetzen() {
    document.querySelectorAll('[data-i18n]').forEach((el) => {
        el.textContent = t(el.dataset.i18n);
    });
    document.querySelectorAll('[data-i18n-aria]').forEach((el) => {
        el.setAttribute('aria-label', t(el.dataset.i18nAria));
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
        el.placeholder = t(el.dataset.i18nPlaceholder);
    });
    document.title = t('index.title');
}

// Sofort beim Laden dieser Datei angewendet (dieselbe Reihenfolge wie
// zebraAnwenden() oben) - sonst zeigte die allererste Anzeige kurz die
// hart im HTML stehenden deutschen Texte, unabhaengig von einer bereits
// gespeicherten anderen Sprache.
document.documentElement.lang = sprache();
statischeTexteUebersetzen();

const schalterSprache = document.getElementById('schalter-sprache');
schalterSprache.value = sprache();
schalterSprache.addEventListener('change', () => spracheAnwenden(schalterSprache.value));

// "Die Umschaltung muss sofort greifen, ohne Neuladen" (Erprobung,
// Auftrag) - OHNE den Nutzer dabei aus dem gerade offenen Bereich zu
// werfen: navigationAufbauen() spraenge bei jedem eigenen Aufruf auf den
// ERSTEN erlaubten Bereich zurueck (siehe dortiger Kopfkommentar), das
// waere fuer eine reine Spracheinstellung eine unnoetige Nebenwirkung.
// Stattdessen hier gezielt: Navigationsbeschriftungen und feste Texte neu
// setzen, DANACH den aktuell sichtbaren Bereich mit seiner eigenen
// aufbauen()-Funktion neu zeichnen - alle fuenf Bereiche bauen Kacheln,
// Spalten und Dialoge bei JEDEM Aufruf frisch aus t()/mengeFormat() auf
// (siehe deren jeweilige *Aufbauen()-Funktion; kein Bereich haelt fertig
// geschriebenen Text ueber einen Aufbau hinaus fest), ein erneuter Aufruf
// zeigt deshalb verlaesslich die neue Sprache, ohne die Navigation zu
// verlassen.
async function spracheAnwenden(code) {
    localStorage.setItem(SPRACHE_SPEICHERSCHLUESSEL, code);
    document.documentElement.lang = code;
    statischeTexteUebersetzen();

    document.querySelectorAll('#navigation button').forEach((knopf) => {
        const bereich = bereiche.get(knopf.dataset.bereich);
        if (!bereich) return;
        const beschriftung = knopf.querySelector('span:last-child');
        if (beschriftung) beschriftung.textContent = t(bereich.titelSchluessel);
    });

    if (aktiverBereich) {
        const feldSucheGlobal = document.getElementById('feld-suche');
        if (aktiverBereich.suchePlatzhalterSchluessel) {
            feldSucheGlobal.placeholder = t(aktiverBereich.suchePlatzhalterSchluessel);
            feldSucheGlobal.setAttribute('aria-label', t(aktiverBereich.suchePlatzhalterSchluessel));
        } else {
            feldSucheGlobal.placeholder = t('common.noSearchPlaceholder');
            feldSucheGlobal.setAttribute('aria-label', t('common.noSearchAria'));
        }
    }

    // Name/Rollen im Profilmenue tragen selbst keinen Uebersetzungstext
    // (Rollencodes bleiben unveraendert, siehe Bericht), aber
    // sitzungsinfoZeichnen() dahinter (ueber profilAufbauen()) formatiert
    // Uhrzeit/Datum/Dauer neu in der gewaehlten Sprache - deshalb trotzdem
    // neu aufgebaut, nicht uebersprungen.
    if (geladeneRollen instanceof Set && geladeneRollen.size > 0) {
        const benutzer = (await angemeldeterBenutzer()).data.user;
        profilAufbauen(benutzer, geladeneRollen);
    }

    if (aktiverBereich) await aktiverBereich.aufbauen();
}

// ===== Tastaturbedienung =====
//
// Tastatur vor Maus. Eine Arbeitsmaske, die Maushandbetrieb erzwingt,
// kostet bei Wiederholung Minuten - und dieselbe Person macht dieselbe
// Buchung hundertmal.
function maskeSpeichern() {
    hauptknopfElement?.click();
}

function maskeVerwerfen() {
    const maske = document.getElementById('detailmaske');
    if (!maske.hasChildNodes()) return;   // nichts offen, nichts zu verwerfen
    maske.replaceChildren();
    hauptknopfElement = null;
    if (listenIndex !== -1) {
        listenZeilenElemente[listenIndex]?.classList.remove('ausgewaehlt');
        listenIndex = -1;
    }
}

// ----- Ungespeicherte Eingaben (Gestaltungsauftrag Punkt 1) -----
//
// feldGeaendert() vergleicht den AKTUELLEN Feldwert mit dem in
// zeigeMaske() hinterlegten data-ursprungswert (siehe dort) - simpel und
// bewusst OHNE Kenntnis der Feldart: ein <select> traegt seinen
// gewaehlten Wert ebenso in .value wie ein <input> oder <textarea>,
// derselbe Stringvergleich passt fuer alle drei.
function feldGeaendert(element) {
    return element.dataset.ursprungswert !== undefined && element.value !== element.dataset.ursprungswert;
}

// true, sobald IRGENDEIN Feld der offenen Maske vom Ausgangswert
// abweicht - unabhaengig davon, wo der Tastaturfokus gerade steht. Nur
// Elemente mit data-ursprungswert zaehlen (siehe zeigeMaske()); Knoepfe
// und sonstige Kinder der Maske tragen dieses Attribut nicht und werden
// von querySelectorAll('[data-ursprungswert]') schon deshalb nicht
// erfasst.
function maskeHatUngespeicherteEingaben() {
    return [...document.querySelectorAll('#detailmaske [data-ursprungswert]')].some(feldGeaendert);
}

// Der user-ausgeloeste Schliessvorgang (Schaltflaeche ODER Escape, siehe
// Tastaturbedienung weiter unten) - anders als maskeVerwerfen() selbst,
// das WEITERHIN das stille, ungefragte Werkzeug fuer PROGRAMMATISCHE
// Wechsel bleibt (Reiterwechsel in instandhaltung.js/auswertungen.js:
// dort wird lediglich die Detailmaske des VORHERIGEN Reiters entfernt,
// bevor der naechste seine eigene aufbaut - kein Anwenderwunsch, keine
// Rueckfrage noetig, sonst muesste jeder Reiterklick erst einen Dialog
// wegklicken).
//
// Rueckfrage NUR, wenn tatsaechlich etwas abweicht (Auftrag: "darf nicht
// durch ein versehentliches Escape verloren gehen") - eine unveraenderte
// Maske schliesst sich sofort, ohne Umweg ueber bestaetige(). Bricht die
// Person die Rueckfrage ab, bleibt die Maske UNVERAENDERT offen: "gar
// nicht erst schliessen" ist hier bewusst die gewaehlte Haelfte der im
// Auftrag offen gelassenen Entscheidung ("nachfragen, oder gar nicht
// erst schliessen") - eine dritte Option (z. B. automatisch speichern)
// wuerde eine Buchung ohne ausdrueckliches "Speichern" ausloesen, was
// diese Warenwirtschaft nirgends sonst tut.
//
// Fokus zurueck zur Ursprungszeile (Auftrag Punkt 1, woertlich): die
// Zeilenreferenz wird VOR maskeVerwerfen() gesichert, weil das dortige
// Zuruecksetzen von listenIndex auf -1 den Zugriff ueber
// listenZeilenElemente[listenIndex] danach nicht mehr hergeben wuerde.
// Ohne offene Zeile (z. B. keine Auswahl bekannt) bleibt der Fokus
// unangetastet - es gibt kein sinnvolleres Ziel als "wo er ohnehin war".
async function maskeSchliessen() {
    const maske = document.getElementById('detailmaske');
    if (!maske.hasChildNodes()) return;

    if (maskeHatUngespeicherteEingaben()) {
        const weiter = await bestaetige(
            'Diese Maske enthaelt Eingaben, die noch nicht gespeichert wurden.\n\n' +
            'Werden sie jetzt geschlossen, gehen sie verloren - es wird nichts gebucht.'
        );
        if (!weiter) return;   // Abbruch: Maske bleibt offen, nichts geht verloren
    }

    const ursprungszeile = listenIndex !== -1 ? listenZeilenElemente[listenIndex] : null;
    maskeVerwerfen();
    ursprungszeile?.focus();
}

document.addEventListener('keydown', (e) => {
    // Ein offener <dialog> behandelt Escape (und seine eigene Fokusfalle)
    // selbst - siehe bestätige(). Würde dieser Listener hier zusätzlich
    // reagieren, verwürfe Escape gleichzeitig die Maske IM Hintergrund,
    // während der Dialog sich schließt: zwei Wirkungen für einen
    // Tastendruck.
    if (document.querySelector('dialog[open]')) return;

    if (e.key === 'Escape') {
        // Das Profilmenü zuerst pruefen: ist es offen, gehört Escape
        // IHM - sonst verwürfe derselbe Tastendruck zusätzlich eine im
        // Hintergrund vielleicht offene Detailmaske, zwei Wirkungen für
        // einen Tastendruck (dieselbe Falle wie beim <dialog> oben).
        if (profilmenueOffen()) {
            profilmenueSchliessen();
            knopfProfil.focus();   // Fokus sichtbar dorthin zurück, wo er herkam
            return;
        }

        const maske = document.getElementById('detailmaske');
        if (!maske.hasChildNodes()) return;   // nichts offen, nichts zu tun

        // RANGFOLGE (Gestaltungsauftrag Punkt 1, woertlich verlangt):
        // "wer gerade in einem Feld tippt, erwartet beim ersten Escape
        // das Verwerfen der Eingabe, nicht das Schliessen der Maske".
        // Deshalb PRIORITAET 1 - steht der Fokus in einem veraenderten
        // Feld DIESER Maske, wird NUR dieses eine Feld auf seinen
        // Ausgangswert zurueckgesetzt, die Maske bleibt offen, und der
        // Tastendruck ist damit verbraucht (kein Fall-Through in
        // PRIORITAET 2 im selben Tastendruck - sonst schlösse derselbe
        // Escape sofort auch noch die ganze Maske, obwohl gerade erst
        // ein einzelnes Feld gemeint war). Ein zweiter Escape-Druck
        // direkt danach findet das Feld dann unveraendert vor und faellt
        // folgerichtig auf PRIORITAET 2 durch.
        const aktiv = document.activeElement;
        const feldOffen = aktiv && maske.contains(aktiv) && aktiv.dataset.ursprungswert !== undefined;
        if (feldOffen && feldGeaendert(aktiv)) {
            e.preventDefault();
            aktiv.value = aktiv.dataset.ursprungswert;
            return;
        }

        // PRIORITAET 2: kein einzelnes Feld mehr zu verwerfen (entweder
        // stand der Fokus gar nicht in einem Feld dieser Maske, oder das
        // fokussierte Feld ist bereits unveraendert) - jetzt gilt Escape
        // dem Schliessen der GANZEN Maske. maskeSchliessen() fragt selbst
        // nach, falls ANDERE Felder noch unveraendert-ungespeichert
        // dastehen (siehe dortiger Kommentar) - hier ohne await aufgerufen,
        // weil ein synchroner keydown-Handler kein await kennt; die
        // Rueckfrage laeuft als eigener <dialog> und faengt sich selbst
        // im obigen dialog[open]-Fruehausstieg.
        maskeSchliessen();
        return;
    }
    if (e.key === 's' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();   // sonst öffnet der Browser seinen eigenen Speichern-Dialog
        maskeSpeichern();
        return;
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        // Nicht feuern, während jemand in einem Eingabefeld der Maske
        // tippt - dort bewegen Pfeiltasten den Cursor, nicht die Liste.
        // BUTTON kam mit den Spaltenkopf-Bedienelementen dazu (Sortieren/
        // Gruppieren, siehe zeigeListe() weiter oben): ohne diese
        // Ergänzung riss ArrowDown/ArrowUp den Tastaturfokus von einem
        // gerade fokussierten Spaltenkopf-Knopf (oder jedem anderen
        // Knopf dieser Oberfläche) in die Zeilenauswahl der Liste, statt
        // schlicht nichts zu tun - im Browser nachgestellt: Tab zum
        // Knopf "Neues Rad anlegen", ArrowDown gedrückt, Fokus sprang
        // ungefragt auf die erste Tabellenzeile.
        const zielTag = document.activeElement?.tagName;
        if (zielTag === 'INPUT' || zielTag === 'TEXTAREA' || zielTag === 'SELECT' || zielTag === 'BUTTON') return;
        if (listenZeilen.length === 0) return;
        e.preventDefault();
        const richtung = e.key === 'ArrowDown' ? 1 : -1;
        const naechsterIndex = Math.min(Math.max(listenIndex + richtung, 0), listenZeilen.length - 1);
        zeileWaehlen(naechsterIndex);
    }
});

// ===== Anmeldung verdrahten =====

document.getElementById('zustand-anmeldung').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fehlerAnzeige = document.getElementById('anmeldung-fehler');
    fehlerAnzeige.textContent = '';
    try {
        await anmelden(
            document.getElementById('feld-email').value,
            document.getElementById('feld-passwort').value
        );
        // Kein seiteAufbauen() hier: onAuthStateChange (SIGNED_IN) löst
        // über beiAnmeldungsWechsel weiter unten denselben Aufbau aus.
        // Ein zweiter Aufruf hier würde meineRollen() zweimal parallel
        // anstoßen.
    } catch (fehler) {
        fehlerAnzeige.textContent = fehler.message;
    }
});

document.getElementById('knopf-abmelden').addEventListener('click', () => abmelden());
document.getElementById('knopf-abmelden-fremd').addEventListener('click', () => abmelden());
// Der einzige Ausweg aus "Mitarbeiter ohne Rolle": ohne diesen Knopf
// sässe dort jemand fest, bis die Leitung eine Rolle zuträgt.
document.getElementById('knopf-abmelden-ohne-rolle').addEventListener('click', () => abmelden());

// beiAnmeldungsWechsel() ruft NICHT sofort mit dem aktuellen Zustand auf
// (anders als das Vorbild src/auth.js) - deshalb wird seiteAufbauen()
// unten zusätzlich einmal von Hand angestoßen, für den allerersten
// Seitenaufruf.
beiAnmeldungsWechsel(seiteAufbauen);
seiteAufbauen();
