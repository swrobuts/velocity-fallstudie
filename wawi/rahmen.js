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
// Gruppe trennt (Punkt in de-DE, Komma in en-US) und welches die
// Dezimalstelle einleitet.
function zahlTrennzeichen() {
    const teile = new Intl.NumberFormat(localeTag()).formatToParts(1234.5);
    return {
        gruppe: teile.find((tl) => tl.type === 'group')?.value || '.',
        dezimal: teile.find((tl) => tl.type === 'decimal')?.value || ','
    };
}

function regexEscape(zeichen) {
    return zeichen.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
    "hint.saldoChartAria": "Saldo der {stationenPhrase}, sortiert nach Stationsnummer, von {min} bis {max} - am niedrigsten (rot markiert) bei {name}",
    "hint.fillLevelBetween": "Füllstand der {stationenPhrase}, sortiert nach Stationsnummer, zwischen {min} und {max}",
    "msg.stationsWithoutBikeSuffix": ", {n} davon ohne Rad",
    "empty.noStationOccupancyText": "Es liegt keine Station vor. Bei zehn angelegten Stationen ist das ungewoehnlich - moeglich ist ein zwischenzeitlicher Rollenverlust statt fehlender Daten.",
    "empty.noStationOccupancyTitle": "Keine Stationsauslastung",
    "msg.stationOccupancyLoadFailed": "Die Stationsauslastung ließ sich nicht laden: {fehler}",
    "misc.estimatedRidesDetail": "{geschaetzt} von {fahrtenPhrase} ({prozent})",
    "hint.monthlyKmChartAria": "Gefahrene Kilometer je Monat, letzte zwölf Monate ({vonMonat} bis {bisMonat}) - die dunkle Säule ganz rechts ist der aktuelle Monat, {aktuellWert}",
    "hint.monthlyCo2ChartAria": "CO2-Ersparnis je Monat, letzte zwölf Monate ({vonMonat} bis {bisMonat}), von {min} bis {max} - die dunkle Säule ganz rechts ist der aktuelle Monat, {aktuellWert}",
    "msg.kmCo2Summary": "{monatszeilen}, {fahrten}, CO₂-Ersparnis gesamt {co2}, davon {prozent} geschätzt (fahrtgewichtet)",
    "empty.noKmCo2Title": "Keine Kilometer- und CO2-Zeilen",
    "msg.kmCo2LoadFailed": "Kilometer und CO₂ ließen sich nicht laden: {fehler}",
    "field.jeKunde": "Je Kunde",
    "hint.crossCheckChartAria": "Monatsumsatz der letzten zwölf Monate ({vonMonat} bis {bisMonat}), dieselbe Reihe wie im Reiter \"Umsatz nach Radtyp\" - die dunkle Säule ganz rechts ist der aktuelle Monat, {aktuellWert}",
    "msg.revenueByCustomerGroupSummary": "{monatszeilen}, Umsatz gesamt {umsatz}",
    "empty.noRevenueByCustomerGroupTitle": "Kein Umsatz nach Kundengruppe",
    "msg.revenueByCustomerGroupLoadFailed": "Der Umsatz nach Kundengruppe ließ sich nicht laden: {fehler}",
    "hint.cityBikeJumpChartAria": "Umsatz je Fahrt City-Bike, {n} Monate ab {vonMonat}: Sprung von {von} auf {nach} ab {sprungMonat}, in Rot markiert",
    "hint.monthlyRidesChartAria": "Fahrten je Monat, letzte zwölf Monate: {min} im {tiefMonat} am niedrigsten, {max} im {hochMonat} am höchsten - die dunkle Säule ganz rechts ist der aktuelle Monat, {aktuellMonat} mit {aktuellPhrase}",
    "hint.monthlyRevenueChartAria": "Monatsumsatz der letzten zwölf Monate ({vonMonat} bis {bisMonat}), von {min} bis {max} - die dunkle Säule ganz rechts ist der aktuelle Monat, {aktuellMonat} mit {aktuellWert}",
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
    "hint.networkOccupancyAria": "Netzweite Auslastung über alle {stationenPhrase} zusammen: {belegt} von {kapazitaet} Stellplätzen belegt, {prozent} Prozent. 100 Prozent ist die Gesamtkapazität des ganzen Stationsnetzes, nicht die einer einzelnen Station.",
    "map.openDetailsSuffix": ". Details öffnen.",
    "map.stationFullSuffix": ", voll - nimmt aktuell keine Rückgabe an",
    "map.stationBelegLabel": "{name}: {belegt} von {kapazitaet} Stellplätzen belegt",
    "map.customerLabelShort": "{ort} ({n})",
    "misc.freeShort": "{n} frei",
    "misc.unitsInStock": "{n} im Bestand",
    "nav.originDamageReport": "Schadensmeldung zu {rahmennummer}",
    "nav.originBikeFromStation": "Rad {rahmennummer} von {name}",
    "nav.originBikeFromFleet": "Rad {rahmennummer} aus der Flotte",
    "hint.percentOfFleet": "{anteil} % der Flotte",
    "index.title": "VeloCity Warenwirtschaft",
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
    "tile.available": "Einsatzbereit",
    "tile.onLoan": "Ausgeliehen",
    "tile.inMaintenance": "In Wartung",
    "tile.faulty": "Defekt",
    "tile.ridesPerBike30d": "Fahrten je Rad (30 Tage)",
    "tile.stations": "Stationen",
    "tile.fullStations": "Volle Stationen",
    "tile.networkOccupancy": "Gesamtbelegung – alle Stationen",
    "tile.fillRange": "Füllstand-Spannweite",
    "tile.customersTotal": "Kunden gesamt",
    "tile.blocked": "Gesperrt",
    "tile.noAddress": "Ohne Adresse",
    "tile.invoiceTop10": "Rechnungsvolumen: obere 10 %",
    "tile.damageReportsTotal": "Schadensmeldungen gesamt",
    "tile.workOrdersTotal": "Wartungsaufträge gesamt",
    "tile.unrideableOpen": "Fahruntauglich, offen",
    "tile.minimum": "Minimum",
    "tile.maximum": "Maximum",
    "tile.countPerMonth": "Anzahl pro Monat",
    "tile.dayWithMostRides": "Tag mit den meisten Fahrten",
    "tile.revenueTotal": "Umsatz gesamt",
    "tile.ridesTotal": "Fahrten gesamt",
    "tile.revenuePerBikeDay": "Umsatz je Rad und Tag",
    "tile.notableRevenuePerRideCityBike": "Auffällig: Umsatz je Fahrt City-Bike",
    "tile.largestCustomerGroup": "Größte Kundengruppe",
    "tile.notableNoMembership": "Auffällig: ohne Mitgliedschaft",
    "tile.co2SavingsTotal": "CO₂-Ersparnis gesamt",
    "tile.kilometersTotal": "Kilometer gesamt",
    "tile.ofWhichEstimatedWeighted": "Davon geschätzt (fahrtgewichtet)",
    "tile.networkOccupancyTotal": "Netzauslastung gesamt",
    "tile.biggestImbalance": "Größtes Ungleichgewicht",
    "tile.occupancy": "Belegung",
    "tile.trafficByTimeSlot": "Zu- und Abgang nach Zeitfenster",
    "tile.departuresPerDayTop": "Abgänge je Tag (oben)",
    "tile.arrivalsPerDayBottom": "Zugänge je Tag (unten)",
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
    "map.schematicNote": "Schematische Karte, keine maßstabsgetreue Landkarte: Kreisgröße zeigt die Kapazität einer Station, die Füllung ihre aktuelle Belegung.",
    "map.riverLabel": "Main (schematisch)",
    "map.areaWithCustomers": "Kartenbereich mit {stationenPhrase} und Kundenorten",
    "map.area": "Kartenbereich mit {stationenPhrase}",
    "map.customersAtLocation": "{ort}: {kundenPhrase}",
    "common.and": "und",
    "misc.changeVsPrevMonth": "ggü. Vormonat",
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
    "msg.unrideableShare": "{n} von {schadenPhrase} insgesamt - sperrt das Rad, sobald es nicht gerade in Fahrt ist",
    "msg.unrideableShareNoTotal": "sperrt das Rad, sobald es nicht gerade in Fahrt ist",
    "hint.shareOfBikes": "{anteil} von {raederPhrase}",
    "hint.shareOnLoan": "{anteil} von {raederPhrase} · gerade unterwegs",
    "hint.shareMaintenance": "{anteil} von {raederPhrase} · in der Werkstatt",
    "hint.shareFaulty": "{anteil} von {raederPhrase} · wo es klemmt",
    "hint.rideDistribution": "Median {median}, Mittel {mittel} je Rad",
    "hint.noRidesAtAll": " · {n} von {raederPhrase} ohne eine einzige Fahrt",
    "hint.allRiddenAtLeastOnce": " · jedes der {raederPhrase} mindestens einmal gefahren",
    "hint.allInOperation": "alle in Betrieb",
    "hint.decommissionedCount": "{n} davon stillgelegt",
    "hint.fullStationsShare": "{n} von {stationenPhrase}: {liste} - nimmt keine Rückgabe an",
    "hint.networkOccupancyDetail": "{belegt} von {kapazitaet} Stellplätzen belegt, über alle {stationenPhrase}",
    "hint.fillRangeDetail": "Median {median} % · {voll} von {stationenPhrase} randvoll{leerZusatz}",
    "hint.andEmptyCount": ", {n} von {stationenPhrase} leer",
    "hint.noneEmpty": ", keine leer",
    "hint.blockedShare": "{n} von {kundenPhrase} - es gibt derzeit keine Funktion, die eine Sperrung aufhebt",
    "hint.noUnblockFunction": "Es gibt derzeit keine Funktion, die eine Sperrung aufhebt",
    "hint.noAddressShare": "{n} von {kundenPhrase} - lässt sich in der Maske nachtragen",
    "hint.addLaterInForm": "Lässt sich in der Maske nachtragen",
    "hint.top10Detail": "{zehntel} von {kundenPhrase} vereinen {top10} von {gesamt} Rechnungsvolumen (inkl. USt., ≠ Umsatz in Auswertungen) · Median {median}, Mittel {mittel} je Kunde",
    "hint.overallStates": "über alle Bearbeitungsstände",
    "hint.last12MonthsTrend": "Verlauf der letzten 12 Monate",
    "hint.last12MonthsCrossCheck": "Verlauf der letzten 12 Monate - Kontrollrechnung zum Reiter \"Umsatz nach Radtyp\"",
    "hint.yearlyPattern": "Jahresgang: {tief} am niedrigsten, {hoch} am höchsten",
    "hint.perBikePerDayDetail": "{jeRadJahr} je Jahr · bezogen auf {raederPhrase} im Bestand (ohne Ausgemusterte) · letzte 12 Monate",
    "hint.tariffChangeFrom": "{veraenderung} ab {monat} - Tarifwechsel",
    "hint.shareOfRevenue": "{prozent} des Umsatzes ({geld})",
    "hint.revenueWithoutTariff": "{geld} Umsatz aus Fahrten ohne aktiven Tarif",
    "hint.estimatedShareOfRides": "{geschaetzt} von {fahrtenPhrase} geschätzt - NICHT {naiv}, wie das einfache Mittel der Zeilen nahelegen würde",
    "hint.fillLevelPerStation": "Füllstand je Station, sortiert nach Stationsnummer",
    "hint.networkOccupancyWeighted": "{belegt} von {kapazitaet} Stellplätzen belegt · kapazitätsgewichtet, nicht der Durchschnitt der Einzelwerte ({naiv})",
    "hint.fullStationsList": "{voll} von {stationenPhrase}: {liste}",
    "hint.worstStationBalance": "Saldo {saldo} - gibt mehr Räder ab, als sie bekommt",
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
    "hint.saldoChartAria": "Balance of {stationenPhrase}, sorted by station number, from {min} to {max} - lowest (marked in red) at {name}",
    "hint.fillLevelBetween": "Fill level of {stationenPhrase}, sorted by station number, between {min} and {max}",
    "msg.stationsWithoutBikeSuffix": ", {n} of them without a bike",
    "empty.noStationOccupancyText": "There is no station. With ten stations set up, that is unusual - a temporary loss of role could be the cause rather than missing data.",
    "empty.noStationOccupancyTitle": "No station occupancy",
    "msg.stationOccupancyLoadFailed": "Could not load station occupancy: {fehler}",
    "misc.estimatedRidesDetail": "{geschaetzt} of {fahrtenPhrase} ({prozent})",
    "hint.monthlyKmChartAria": "Kilometres ridden per month, last twelve months ({vonMonat} to {bisMonat}) - the dark bar on the far right is the current month, {aktuellWert}",
    "hint.monthlyCo2ChartAria": "CO2 savings per month, last twelve months ({vonMonat} to {bisMonat}), from {min} to {max} - the dark bar on the far right is the current month, {aktuellWert}",
    "msg.kmCo2Summary": "{monatszeilen}, {fahrten}, total CO₂ savings {co2}, of which {prozent} estimated (ride-weighted)",
    "empty.noKmCo2Title": "No kilometre and CO2 rows",
    "msg.kmCo2LoadFailed": "Could not load kilometres and CO2: {fehler}",
    "field.jeKunde": "Per customer",
    "hint.crossCheckChartAria": "Monthly revenue for the last twelve months ({vonMonat} to {bisMonat}), the same series as in the \"Revenue by bike type\" tab - the dark bar on the far right is the current month, {aktuellWert}",
    "msg.revenueByCustomerGroupSummary": "{monatszeilen}, total revenue {umsatz}",
    "empty.noRevenueByCustomerGroupTitle": "No revenue by customer group",
    "msg.revenueByCustomerGroupLoadFailed": "Could not load revenue by customer group: {fehler}",
    "hint.cityBikeJumpChartAria": "Revenue per ride, City-Bike, {n} months from {vonMonat}: jump from {von} to {nach} starting {sprungMonat}, marked in red",
    "hint.monthlyRidesChartAria": "Rides per month, last twelve months: lowest at {min} in {tiefMonat}, highest at {max} in {hochMonat} - the dark bar on the far right is the current month, {aktuellMonat} with {aktuellPhrase}",
    "hint.monthlyRevenueChartAria": "Monthly revenue for the last twelve months ({vonMonat} to {bisMonat}), from {min} to {max} - the dark bar on the far right is the current month, {aktuellMonat} with {aktuellWert}",
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
    "hint.networkOccupancyAria": "Network-wide occupancy across all {stationenPhrase}: {belegt} of {kapazitaet} docks occupied, {prozent} percent. 100 percent is the total capacity of the whole station network, not that of a single station.",
    "map.openDetailsSuffix": ". Open details.",
    "map.stationFullSuffix": ", full - not currently accepting returns",
    "map.stationBelegLabel": "{name}: {belegt} of {kapazitaet} docks occupied",
    "map.customerLabelShort": "{ort} ({n})",
    "misc.freeShort": "{n} free",
    "misc.unitsInStock": "{n} in stock",
    "nav.originDamageReport": "Damage report for {rahmennummer}",
    "nav.originBikeFromStation": "Bike {rahmennummer} from {name}",
    "nav.originBikeFromFleet": "Bike {rahmennummer} from the fleet",
    "hint.percentOfFleet": "{anteil} % of the fleet",
    "index.title": "VeloCity Inventory Management",
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
    "tile.available": "Ready for use",
    "tile.onLoan": "On loan",
    "tile.inMaintenance": "In maintenance",
    "tile.faulty": "Faulty",
    "tile.ridesPerBike30d": "Rides per bike (30 days)",
    "tile.stations": "Stations",
    "tile.fullStations": "Full stations",
    "tile.networkOccupancy": "Total occupancy – all stations",
    "tile.fillRange": "Fill-level range",
    "tile.customersTotal": "Customers total",
    "tile.blocked": "Blocked",
    "tile.noAddress": "Without address",
    "tile.invoiceTop10": "Invoice volume: top 10 %",
    "tile.damageReportsTotal": "Damage reports total",
    "tile.workOrdersTotal": "Work orders total",
    "tile.unrideableOpen": "Unrideable, open",
    "tile.minimum": "Minimum",
    "tile.maximum": "Maximum",
    "tile.countPerMonth": "Count per month",
    "tile.dayWithMostRides": "Day with the most rides",
    "tile.revenueTotal": "Revenue total",
    "tile.ridesTotal": "Rides total",
    "tile.revenuePerBikeDay": "Revenue per bike and day",
    "tile.notableRevenuePerRideCityBike": "Notable: revenue per ride, City-Bike",
    "tile.largestCustomerGroup": "Largest customer group",
    "tile.notableNoMembership": "Notable: without membership",
    "tile.co2SavingsTotal": "CO₂ savings total",
    "tile.kilometersTotal": "Kilometres total",
    "tile.ofWhichEstimatedWeighted": "Of which estimated (ride-weighted)",
    "tile.networkOccupancyTotal": "Total network occupancy",
    "tile.biggestImbalance": "Biggest imbalance",
    "tile.occupancy": "Occupancy",
    "tile.trafficByTimeSlot": "Arrivals and departures by time slot",
    "tile.departuresPerDayTop": "Departures per day (top)",
    "tile.arrivalsPerDayBottom": "Arrivals per day (bottom)",
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
    "map.schematicNote": "Schematic map, not to scale: circle size shows a station’s capacity, the fill shows its current occupancy.",
    "map.riverLabel": "Main river (schematic)",
    "map.areaWithCustomers": "Map area with {stationenPhrase} and customer locations",
    "map.area": "Map area with {stationenPhrase}",
    "map.customersAtLocation": "{ort}: {kundenPhrase}",
    "common.and": "and",
    "misc.changeVsPrevMonth": "vs. previous month",
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
    "msg.unrideableShare": "{n} of {schadenPhrase} in total - blocks the bike as soon as it is not currently being ridden",
    "msg.unrideableShareNoTotal": "blocks the bike as soon as it is not currently being ridden",
    "hint.shareOfBikes": "{anteil} of {raederPhrase}",
    "hint.shareOnLoan": "{anteil} of {raederPhrase} · currently under way",
    "hint.shareMaintenance": "{anteil} of {raederPhrase} · in the workshop",
    "hint.shareFaulty": "{anteil} of {raederPhrase} · where it’s stuck",
    "hint.rideDistribution": "Median {median}, mean {mittel} per bike",
    "hint.noRidesAtAll": " · {n} of {raederPhrase} without a single ride",
    "hint.allRiddenAtLeastOnce": " · every one of {raederPhrase} ridden at least once",
    "hint.allInOperation": "all in operation",
    "hint.decommissionedCount": "{n} of which decommissioned",
    "hint.fullStationsShare": "{n} of {stationenPhrase}: {liste} - not accepting returns",
    "hint.networkOccupancyDetail": "{belegt} of {kapazitaet} docks occupied, across all {stationenPhrase}",
    "hint.fillRangeDetail": "Median {median} % · {voll} of {stationenPhrase} completely full{leerZusatz}",
    "hint.andEmptyCount": ", {n} of {stationenPhrase} empty",
    "hint.noneEmpty": ", none empty",
    "hint.blockedShare": "{n} of {kundenPhrase} - there is currently no function to lift a block",
    "hint.noUnblockFunction": "There is currently no function to lift a block",
    "hint.noAddressShare": "{n} of {kundenPhrase} - can be added later in the form",
    "hint.addLaterInForm": "Can be added later in the form",
    "hint.top10Detail": "{zehntel} of {kundenPhrase} together account for {top10} of {gesamt} invoice volume (incl. VAT, ≠ revenue in reports) · median {median}, mean {mittel} per customer",
    "hint.overallStates": "across all processing states",
    "hint.last12MonthsTrend": "Trend over the last 12 months",
    "hint.last12MonthsCrossCheck": "Trend over the last 12 months - cross-check against the \"Revenue by bike type\" tab",
    "hint.yearlyPattern": "Yearly pattern: lowest in {tief}, highest in {hoch}",
    "hint.perBikePerDayDetail": "{jeRadJahr} per year · based on {raederPhrase} in the fleet (excluding decommissioned) · last 12 months",
    "hint.tariffChangeFrom": "{veraenderung} from {monat} - tariff change",
    "hint.shareOfRevenue": "{prozent} of revenue ({geld})",
    "hint.revenueWithoutTariff": "{geld} revenue from rides without an active plan",
    "hint.estimatedShareOfRides": "{geschaetzt} of {fahrtenPhrase} estimated - NOT {naiv}, as the simple average of the rows would suggest",
    "hint.fillLevelPerStation": "Fill level per station, sorted by station number",
    "hint.networkOccupancyWeighted": "{belegt} of {kapazitaet} docks occupied · capacity-weighted, not the average of the individual values ({naiv})",
    "hint.fullStationsList": "{voll} of {stationenPhrase}: {liste}",
    "hint.worstStationBalance": "Balance {saldo} - gives away more bikes than it receives",
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
    "hint.saldoChartAria": "İstasyon numarasına göre sıralı {stationenPhrase} bakiyesi, {min} ile {max} arasında - en düşük (kırmızıyla işaretli) {name}",
    "hint.fillLevelBetween": "İstasyon numarasına göre sıralı {stationenPhrase} doluluğu, {min} ile {max} arasında",
    "msg.stationsWithoutBikeSuffix": ", bunlardan {n} tanesi bisikletsiz",
    "empty.noStationOccupancyText": "Herhangi bir istasyon bulunmuyor. On istasyon tanımlıyken bu olağandışıdır - eksik veri yerine geçici bir rol kaybı söz konusu olabilir.",
    "empty.noStationOccupancyTitle": "İstasyon doluluğu yok",
    "msg.stationOccupancyLoadFailed": "İstasyon doluluğu yüklenemedi: {fehler}",
    "misc.estimatedRidesDetail": "{fahrtenPhrase} içinden {geschaetzt} tanesi ({prozent})",
    "hint.monthlyKmChartAria": "Aylık kat edilen kilometre, son on iki ay ({vonMonat} - {bisMonat}) - en sağdaki koyu sütun mevcut ay, {aktuellWert}",
    "hint.monthlyCo2ChartAria": "Aylık CO2 tasarrufu, son on iki ay ({vonMonat} - {bisMonat}), {min} ile {max} arasında - en sağdaki koyu sütun mevcut ay, {aktuellWert}",
    "msg.kmCo2Summary": "{monatszeilen}, {fahrten}, toplam CO₂ tasarrufu {co2}, bunun {prozent} tahmini (sürüş ağırlıklı)",
    "empty.noKmCo2Title": "Kilometre ve CO2 satırı yok",
    "msg.kmCo2LoadFailed": "Kilometre ve CO2 yüklenemedi: {fehler}",
    "field.jeKunde": "Müşteri başına",
    "hint.crossCheckChartAria": "Son on iki ayın aylık cirosu ({vonMonat} - {bisMonat}), \"Bisiklet tipine göre ciro\" sekmesindekiyle aynı seri - en sağdaki koyu sütun mevcut ay, {aktuellWert}",
    "msg.revenueByCustomerGroupSummary": "{monatszeilen}, toplam ciro {umsatz}",
    "empty.noRevenueByCustomerGroupTitle": "Müşteri grubuna göre ciro yok",
    "msg.revenueByCustomerGroupLoadFailed": "Müşteri grubuna göre ciro yüklenemedi: {fehler}",
    "hint.cityBikeJumpChartAria": "City-Bike sürüş başına ciro, {vonMonat} itibarıyla {n} ay: {sprungMonat} itibarıyla {von} değerinden {nach} değerine sıçrama, kırmızıyla işaretlendi",
    "hint.monthlyRidesChartAria": "Aylık sürüşler, son on iki ay: en düşük {tiefMonat} ayında {min}, en yüksek {hochMonat} ayında {max} - en sağdaki koyu sütun mevcut ay olan {aktuellMonat}, {aktuellPhrase} ile",
    "hint.monthlyRevenueChartAria": "Son on iki ayın aylık cirosu ({vonMonat} - {bisMonat}), {min} ile {max} arasında - en sağdaki koyu sütun mevcut ay olan {aktuellMonat}, {aktuellWert} ile",
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
    "hint.networkOccupancyAria": "Tüm {stationenPhrase} genelinde ağ çapında doluluk: {kapazitaet} yerden {belegt} tanesi dolu, yüzde {prozent}. Yüzde 100, tek bir istasyonun değil, tüm istasyon ağının toplam kapasitesidir.",
    "map.openDetailsSuffix": ". Ayrıntıları aç.",
    "map.stationFullSuffix": ", dolu - şu anda iade kabul etmiyor",
    "map.stationBelegLabel": "{name}: {kapazitaet} yerden {belegt} tanesi dolu",
    "map.customerLabelShort": "{ort} ({n})",
    "misc.freeShort": "{n} boş",
    "misc.unitsInStock": "stokta {n}",
    "nav.originDamageReport": "{rahmennummer} için hasar bildirimi",
    "nav.originBikeFromStation": "{name} istasyonundan {rahmennummer} bisikleti",
    "nav.originBikeFromFleet": "Filodan {rahmennummer} bisikleti",
    "hint.percentOfFleet": "Filonun %{anteil}’si",
    "index.title": "VeloCity Stok Yönetimi",
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
    "tile.available": "Kullanıma hazır",
    "tile.onLoan": "Kirada",
    "tile.inMaintenance": "Bakımda",
    "tile.faulty": "Arızalı",
    "tile.ridesPerBike30d": "Bisiklet başına sürüş (30 gün)",
    "tile.stations": "İstasyonlar",
    "tile.fullStations": "Dolu istasyonlar",
    "tile.networkOccupancy": "Toplam doluluk – tüm istasyonlar",
    "tile.fillRange": "Doluluk aralığı",
    "tile.customersTotal": "Toplam müşteri",
    "tile.blocked": "Engellendi",
    "tile.noAddress": "Adressiz",
    "tile.invoiceTop10": "Fatura hacmi: üst %10",
    "tile.damageReportsTotal": "Toplam hasar bildirimi",
    "tile.workOrdersTotal": "Toplam iş emri",
    "tile.unrideableOpen": "Sürüşe uygun değil, açık",
    "tile.minimum": "Minimum",
    "tile.maximum": "Maksimum",
    "tile.countPerMonth": "Aya göre sayı",
    "tile.dayWithMostRides": "En çok sürüşün olduğu gün",
    "tile.revenueTotal": "Toplam ciro",
    "tile.ridesTotal": "Toplam sürüş",
    "tile.revenuePerBikeDay": "Bisiklet ve gün başına ciro",
    "tile.notableRevenuePerRideCityBike": "Dikkat çekici: City-Bike sürüş başına ciro",
    "tile.largestCustomerGroup": "En büyük müşteri grubu",
    "tile.notableNoMembership": "Dikkat çekici: üyeliksiz",
    "tile.co2SavingsTotal": "Toplam CO₂ tasarrufu",
    "tile.kilometersTotal": "Toplam kilometre",
    "tile.ofWhichEstimatedWeighted": "Bunun tahmini kısmı (sürüş ağırlıklı)",
    "tile.networkOccupancyTotal": "Toplam ağ doluluğu",
    "tile.biggestImbalance": "En büyük dengesizlik",
    "tile.occupancy": "Doluluk",
    "tile.trafficByTimeSlot": "Zaman dilimine göre giriş ve çıkış",
    "tile.departuresPerDayTop": "Günlük çıkış (üstte)",
    "tile.arrivalsPerDayBottom": "Günlük giriş (altta)",
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
    "map.schematicNote": "Şematik harita, ölçekli bir harita değildir: daire boyutu bir istasyonun kapasitesini, dolgu ise mevcut doluluğunu gösterir.",
    "map.riverLabel": "Main Nehri (şematik)",
    "map.areaWithCustomers": "{stationenPhrase} ve müşteri konumlarını içeren harita alanı",
    "map.area": "{stationenPhrase} içeren harita alanı",
    "map.customersAtLocation": "{ort}: {kundenPhrase}",
    "common.and": "ve",
    "misc.changeVsPrevMonth": "önceki aya göre",
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
    "msg.unrideableShare": "toplam {schadenPhrase} içinden {n} tanesi - bisiklet o an sürülmüyorsa hemen kilitlenir",
    "msg.unrideableShareNoTotal": "bisiklet o an sürülmüyorsa hemen kilitlenir",
    "hint.shareOfBikes": "{raederPhrase} içinde {anteil}",
    "hint.shareOnLoan": "{raederPhrase} içinde {anteil} · şu anda yolda",
    "hint.shareMaintenance": "{raederPhrase} içinde {anteil} · atölyede",
    "hint.shareFaulty": "{raederPhrase} içinde {anteil} · sorunlu olanlar",
    "hint.rideDistribution": "Medyan {median}, ortalama {mittel} (bisiklet başına)",
    "hint.noRidesAtAll": " · {raederPhrase} içinden {n} tanesi tek bir sürüş bile yapmadı",
    "hint.allRiddenAtLeastOnce": " · {raederPhrase} her biri en az bir kez sürüldü",
    "hint.allInOperation": "tümü işletimde",
    "hint.decommissionedCount": "bunlardan {n} tanesi kullanımdan kaldırıldı",
    "hint.fullStationsShare": "{stationenPhrase} içinden {n}: {liste} - iade kabul etmiyor",
    "hint.networkOccupancyDetail": "{stationenPhrase} genelinde {kapazitaet} yerden {belegt} tanesi dolu",
    "hint.fillRangeDetail": "Medyan %{median} · {stationenPhrase} içinden {voll} tanesi tıklım tıklım dolu{leerZusatz}",
    "hint.andEmptyCount": ", {stationenPhrase} içinden {n} tanesi boş",
    "hint.noneEmpty": ", hiçbiri boş değil",
    "hint.blockedShare": "{kundenPhrase} içinden {n} - şu anda bir engeli kaldıran işlev bulunmuyor",
    "hint.noUnblockFunction": "Şu anda bir engeli kaldıran işlev bulunmuyor",
    "hint.noAddressShare": "{kundenPhrase} içinden {n} - formda daha sonra eklenebilir",
    "hint.addLaterInForm": "Formda daha sonra eklenebilir",
    "hint.top10Detail": "{kundenPhrase} içinden {zehntel} tanesi, {gesamt} fatura hacminin {top10} tutarını oluşturuyor (KDV dahil, raporlardaki ciro ile aynı değildir) · medyan {median}, ortalama {mittel} (müşteri başına)",
    "hint.overallStates": "tüm işlem durumları genelinde",
    "hint.last12MonthsTrend": "Son 12 ayın seyri",
    "hint.last12MonthsCrossCheck": "Son 12 ayın seyri - \"Bisiklet tipine göre ciro\" sekmesiyle kontrol hesaplaması",
    "hint.yearlyPattern": "Yıllık seyir: en düşük {tief}, en yüksek {hoch}",
    "hint.perBikePerDayDetail": "Yılda {jeRadJahr} · filodaki {raederPhrase} baz alınarak (hizmet dışı olanlar hariç) · son 12 ay",
    "hint.tariffChangeFrom": "{monat} itibarıyla {veraenderung} - tarife değişikliği",
    "hint.shareOfRevenue": "Cironun {prozent} ({geld})",
    "hint.revenueWithoutTariff": "Aktif tarifesi olmayan sürüşlerden {geld} ciro",
    "hint.estimatedShareOfRides": "{fahrtenPhrase} içinden {geschaetzt} tanesi tahmini - satırların basit ortalamasının önerdiği gibi {naiv} DEĞİL",
    "hint.fillLevelPerStation": "İstasyon numarasına göre sıralı istasyon doluluğu",
    "hint.networkOccupancyWeighted": "{kapazitaet} yerden {belegt} tanesi dolu · kapasiteye göre ağırlıklandırılmıştır, tek tek değerlerin ortalaması değildir ({naiv})",
    "hint.fullStationsList": "{stationenPhrase} içinden {voll}: {liste}",
    "hint.worstStationBalance": "Bakiye {saldo} - aldığından daha fazla bisiklet veriyor",
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
    "hint.saldoChartAria": "Saldo de {stationenPhrase}, ordenado por número de estación, de {min} a {max}; el más bajo (marcado en rojo) en {name}",
    "hint.fillLevelBetween": "Nivel de ocupación de {stationenPhrase}, ordenado por número de estación, entre {min} y {max}",
    "msg.stationsWithoutBikeSuffix": ", {n} de ellas sin ninguna bicicleta",
    "empty.noStationOccupancyText": "No hay ninguna estación. Con diez estaciones creadas, esto es inusual: podría deberse a una pérdida temporal de rol en lugar de datos faltantes.",
    "empty.noStationOccupancyTitle": "Sin ocupación de estaciones",
    "msg.stationOccupancyLoadFailed": "No se pudo cargar la ocupación de estaciones: {fehler}",
    "misc.estimatedRidesDetail": "{geschaetzt} de {fahrtenPhrase} ({prozent})",
    "hint.monthlyKmChartAria": "Kilómetros recorridos por mes, últimos doce meses ({vonMonat} a {bisMonat}); la barra oscura del extremo derecho es el mes actual, {aktuellWert}",
    "hint.monthlyCo2ChartAria": "Ahorro de CO2 por mes, últimos doce meses ({vonMonat} a {bisMonat}), de {min} a {max}; la barra oscura del extremo derecho es el mes actual, {aktuellWert}",
    "msg.kmCo2Summary": "{monatszeilen}, {fahrten}, ahorro total de CO₂ {co2}, de los cuales {prozent} estimado (ponderado por viajes)",
    "empty.noKmCo2Title": "Sin filas de kilómetros y CO2",
    "msg.kmCo2LoadFailed": "No se pudieron cargar los kilómetros y el CO2: {fehler}",
    "field.jeKunde": "Por cliente",
    "hint.crossCheckChartAria": "Facturación mensual de los últimos doce meses ({vonMonat} a {bisMonat}), la misma serie que en la pestaña «Facturación por tipo de bicicleta»; la barra oscura del extremo derecho es el mes actual, {aktuellWert}",
    "msg.revenueByCustomerGroupSummary": "{monatszeilen}, facturación total {umsatz}",
    "empty.noRevenueByCustomerGroupTitle": "Sin facturación por grupo de clientes",
    "msg.revenueByCustomerGroupLoadFailed": "No se pudo cargar la facturación por grupo de clientes: {fehler}",
    "hint.cityBikeJumpChartAria": "Facturación por viaje, City-Bike, {n} meses desde {vonMonat}: salto de {von} a {nach} a partir de {sprungMonat}, marcado en rojo",
    "hint.monthlyRidesChartAria": "Viajes por mes, últimos doce meses: el más bajo {min} en {tiefMonat}, el más alto {max} en {hochMonat}; la barra oscura del extremo derecho es el mes actual, {aktuellMonat} con {aktuellPhrase}",
    "hint.monthlyRevenueChartAria": "Facturación mensual de los últimos doce meses ({vonMonat} a {bisMonat}), de {min} a {max}; la barra oscura del extremo derecho es el mes actual, {aktuellMonat} con {aktuellWert}",
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
    "hint.networkOccupancyAria": "Ocupación de toda la red en {stationenPhrase}: {belegt} de {kapazitaet} plazas ocupadas, {prozent} por ciento. El 100 % es la capacidad total de toda la red de estaciones, no la de una sola estación.",
    "map.openDetailsSuffix": ". Abrir detalles.",
    "map.stationFullSuffix": ", llena - no admite devoluciones en este momento",
    "map.stationBelegLabel": "{name}: {belegt} de {kapazitaet} plazas ocupadas",
    "map.customerLabelShort": "{ort} ({n})",
    "misc.freeShort": "{n} libres",
    "misc.unitsInStock": "{n} en existencia",
    "nav.originDamageReport": "Notificación de avería de {rahmennummer}",
    "nav.originBikeFromStation": "Bicicleta {rahmennummer} de {name}",
    "nav.originBikeFromFleet": "Bicicleta {rahmennummer} de la flota",
    "hint.percentOfFleet": "{anteil} % de la flota",
    "index.title": "VeloCity Gestión de Inventario",
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
    "tile.available": "Disponible",
    "tile.onLoan": "Alquilada",
    "tile.inMaintenance": "En mantenimiento",
    "tile.faulty": "Averiada",
    "tile.ridesPerBike30d": "Viajes por bicicleta (30 días)",
    "tile.stations": "Estaciones",
    "tile.fullStations": "Estaciones llenas",
    "tile.networkOccupancy": "Ocupación total – todas las estaciones",
    "tile.fillRange": "Rango de nivel de ocupación",
    "tile.customersTotal": "Total de clientes",
    "tile.blocked": "Bloqueados",
    "tile.noAddress": "Sin dirección",
    "tile.invoiceTop10": "Volumen de facturación: 10 % superior",
    "tile.damageReportsTotal": "Total de averías",
    "tile.workOrdersTotal": "Total de órdenes de trabajo",
    "tile.unrideableOpen": "No apta para circular, abierta",
    "tile.minimum": "Mínimo",
    "tile.maximum": "Máximo",
    "tile.countPerMonth": "Cantidad por mes",
    "tile.dayWithMostRides": "Día con más viajes",
    "tile.revenueTotal": "Facturación total",
    "tile.ridesTotal": "Viajes totales",
    "tile.revenuePerBikeDay": "Facturación por bicicleta y día",
    "tile.notableRevenuePerRideCityBike": "Destacado: facturación por viaje City-Bike",
    "tile.largestCustomerGroup": "Grupo de clientes más grande",
    "tile.notableNoMembership": "Destacado: sin membresía",
    "tile.co2SavingsTotal": "Ahorro total de CO₂",
    "tile.kilometersTotal": "Kilómetros totales",
    "tile.ofWhichEstimatedWeighted": "De los cuales estimado (ponderado por viajes)",
    "tile.networkOccupancyTotal": "Ocupación total de la red",
    "tile.biggestImbalance": "Mayor desequilibrio",
    "tile.occupancy": "Ocupación",
    "tile.trafficByTimeSlot": "Llegadas y salidas por franja horaria",
    "tile.departuresPerDayTop": "Salidas por día (arriba)",
    "tile.arrivalsPerDayBottom": "Llegadas por día (abajo)",
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
    "map.schematicNote": "Mapa esquemático, no a escala: el tamaño del círculo muestra la capacidad de una estación, y el relleno su ocupación actual.",
    "map.riverLabel": "Río Meno (esquemático)",
    "map.areaWithCustomers": "Área del mapa con {stationenPhrase} y ubicaciones de clientes",
    "map.area": "Área del mapa con {stationenPhrase}",
    "map.customersAtLocation": "{ort}: {kundenPhrase}",
    "common.and": "y",
    "misc.changeVsPrevMonth": "frente al mes anterior",
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
    "msg.unrideableShare": "{n} de {schadenPhrase} en total: bloquea la bicicleta en cuanto no está en uso",
    "msg.unrideableShareNoTotal": "bloquea la bicicleta en cuanto no está en uso",
    "hint.shareOfBikes": "{anteil} de {raederPhrase}",
    "hint.shareOnLoan": "{anteil} de {raederPhrase} · actualmente en ruta",
    "hint.shareMaintenance": "{anteil} de {raederPhrase} · en el taller",
    "hint.shareFaulty": "{anteil} de {raederPhrase} · donde hay problemas",
    "hint.rideDistribution": "Mediana {median}, media {mittel} por bicicleta",
    "hint.noRidesAtAll": " · {n} de {raederPhrase} sin un solo viaje",
    "hint.allRiddenAtLeastOnce": " · cada una de {raederPhrase} se ha usado al menos una vez",
    "hint.allInOperation": "todas en funcionamiento",
    "hint.decommissionedCount": "{n} de ellas dadas de baja",
    "hint.fullStationsShare": "{n} de {stationenPhrase}: {liste} - no admite devoluciones",
    "hint.networkOccupancyDetail": "{belegt} de {kapazitaet} plazas ocupadas, en {stationenPhrase}",
    "hint.fillRangeDetail": "Mediana {median} % · {voll} de {stationenPhrase} completamente llenas{leerZusatz}",
    "hint.andEmptyCount": ", {n} de {stationenPhrase} vacías",
    "hint.noneEmpty": ", ninguna vacía",
    "hint.blockedShare": "{n} de {kundenPhrase} - actualmente no existe ninguna función para levantar un bloqueo",
    "hint.noUnblockFunction": "Actualmente no existe ninguna función para levantar un bloqueo",
    "hint.noAddressShare": "{n} de {kundenPhrase} - se puede añadir después en el formulario",
    "hint.addLaterInForm": "Se puede añadir después en el formulario",
    "hint.top10Detail": "{zehntel} de {kundenPhrase} concentran {top10} de {gesamt} de volumen de facturación (IVA incl., ≠ facturación en informes) · mediana {median}, media {mittel} por cliente",
    "hint.overallStates": "en todos los estados de tramitación",
    "hint.last12MonthsTrend": "Evolución de los últimos 12 meses",
    "hint.last12MonthsCrossCheck": "Evolución de los últimos 12 meses - cálculo de control con la pestaña «Facturación por tipo de bicicleta»",
    "hint.yearlyPattern": "Patrón anual: mínimo en {tief}, máximo en {hoch}",
    "hint.perBikePerDayDetail": "{jeRadJahr} al año · en relación con {raederPhrase} en la flota (sin las dadas de baja) · últimos 12 meses",
    "hint.tariffChangeFrom": "{veraenderung} desde {monat} - cambio de tarifa",
    "hint.shareOfRevenue": "{prozent} de la facturación ({geld})",
    "hint.revenueWithoutTariff": "{geld} de facturación de viajes sin tarifa activa",
    "hint.estimatedShareOfRides": "{geschaetzt} de {fahrtenPhrase} estimados - NO {naiv}, como sugeriría la media simple de las filas",
    "hint.fillLevelPerStation": "Nivel de ocupación por estación, ordenado por número de estación",
    "hint.networkOccupancyWeighted": "{belegt} de {kapazitaet} plazas ocupadas · ponderado por capacidad, no la media de los valores individuales ({naiv})",
    "hint.fullStationsList": "{voll} de {stationenPhrase}: {liste}",
    "hint.worstStationBalance": "Saldo {saldo} - entrega más bicicletas de las que recibe",
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
    "hint.saldoChartAria": "Saldo di {stationenPhrase}, ordinato per numero di stazione, da {min} a {max}; il più basso (evidenziato in rosso) a {name}",
    "hint.fillLevelBetween": "Livello di riempimento di {stationenPhrase}, ordinato per numero di stazione, tra {min} e {max}",
    "msg.stationsWithoutBikeSuffix": ", di cui {n} senza bici",
    "empty.noStationOccupancyText": "Non è presente alcuna stazione. Con dieci stazioni create, ciò è insolito: potrebbe trattarsi di una perdita temporanea del ruolo anziché di dati mancanti.",
    "empty.noStationOccupancyTitle": "Nessuna occupazione delle stazioni",
    "msg.stationOccupancyLoadFailed": "Impossibile caricare l’occupazione delle stazioni: {fehler}",
    "misc.estimatedRidesDetail": "{geschaetzt} su {fahrtenPhrase} ({prozent})",
    "hint.monthlyKmChartAria": "Chilometri percorsi al mese, ultimi dodici mesi ({vonMonat} - {bisMonat}); la barra scura all’estrema destra è il mese corrente, {aktuellWert}",
    "hint.monthlyCo2ChartAria": "Risparmio di CO2 al mese, ultimi dodici mesi ({vonMonat} - {bisMonat}), da {min} a {max}; la barra scura all’estrema destra è il mese corrente, {aktuellWert}",
    "msg.kmCo2Summary": "{monatszeilen}, {fahrten}, risparmio totale di CO₂ {co2}, di cui {prozent} stimato (ponderato per corsa)",
    "empty.noKmCo2Title": "Nessuna riga di chilometri e CO2",
    "msg.kmCo2LoadFailed": "Impossibile caricare chilometri e CO2: {fehler}",
    "field.jeKunde": "Per cliente",
    "hint.crossCheckChartAria": "Fatturato mensile degli ultimi dodici mesi ({vonMonat} - {bisMonat}), la stessa serie della scheda \"Fatturato per tipo di bici\"; la barra scura all’estrema destra è il mese corrente, {aktuellWert}",
    "msg.revenueByCustomerGroupSummary": "{monatszeilen}, fatturato totale {umsatz}",
    "empty.noRevenueByCustomerGroupTitle": "Nessun fatturato per gruppo di clienti",
    "msg.revenueByCustomerGroupLoadFailed": "Impossibile caricare il fatturato per gruppo di clienti: {fehler}",
    "hint.cityBikeJumpChartAria": "Fatturato per corsa, City-Bike, {n} mesi da {vonMonat}: salto da {von} a {nach} a partire da {sprungMonat}, evidenziato in rosso",
    "hint.monthlyRidesChartAria": "Corse al mese, ultimi dodici mesi: minimo {min} a {tiefMonat}, massimo {max} a {hochMonat}; la barra scura all’estrema destra è il mese corrente, {aktuellMonat} con {aktuellPhrase}",
    "hint.monthlyRevenueChartAria": "Fatturato mensile degli ultimi dodici mesi ({vonMonat} - {bisMonat}), da {min} a {max}; la barra scura all’estrema destra è il mese corrente, {aktuellMonat} con {aktuellWert}",
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
    "hint.networkOccupancyAria": "Occupazione a livello di rete su {stationenPhrase}: {belegt} stalli occupati su {kapazitaet}, {prozent} percento. Il 100% è la capacità totale dell’intera rete di stazioni, non quella di una singola stazione.",
    "map.openDetailsSuffix": ". Apri dettagli.",
    "map.stationFullSuffix": ", piena - non accetta restituzioni al momento",
    "map.stationBelegLabel": "{name}: {belegt} stalli occupati su {kapazitaet}",
    "map.customerLabelShort": "{ort} ({n})",
    "misc.freeShort": "{n} liberi",
    "misc.unitsInStock": "{n} in giacenza",
    "nav.originDamageReport": "Segnalazione di guasto per {rahmennummer}",
    "nav.originBikeFromStation": "Bici {rahmennummer} da {name}",
    "nav.originBikeFromFleet": "Bici {rahmennummer} dalla flotta",
    "hint.percentOfFleet": "{anteil} % della flotta",
    "index.title": "VeloCity Gestione Magazzino",
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
    "tile.available": "Pronta all’uso",
    "tile.onLoan": "In noleggio",
    "tile.inMaintenance": "In manutenzione",
    "tile.faulty": "Guasto",
    "tile.ridesPerBike30d": "Corse per bici (30 giorni)",
    "tile.stations": "Stazioni",
    "tile.fullStations": "Stazioni piene",
    "tile.networkOccupancy": "Occupazione totale – tutte le stazioni",
    "tile.fillRange": "Intervallo del livello di riempimento",
    "tile.customersTotal": "Totale clienti",
    "tile.blocked": "Bloccati",
    "tile.noAddress": "Senza indirizzo",
    "tile.invoiceTop10": "Volume fatturato: 10 % superiore",
    "tile.damageReportsTotal": "Totale segnalazioni di guasto",
    "tile.workOrdersTotal": "Totale ordini di lavoro",
    "tile.unrideableOpen": "Non idonea alla marcia, aperta",
    "tile.minimum": "Minimo",
    "tile.maximum": "Massimo",
    "tile.countPerMonth": "Numero per mese",
    "tile.dayWithMostRides": "Giorno con più corse",
    "tile.revenueTotal": "Fatturato totale",
    "tile.ridesTotal": "Corse totali",
    "tile.revenuePerBikeDay": "Fatturato per bici e giorno",
    "tile.notableRevenuePerRideCityBike": "Notevole: fatturato per corsa City-Bike",
    "tile.largestCustomerGroup": "Gruppo di clienti più numeroso",
    "tile.notableNoMembership": "Notevole: senza abbonamento",
    "tile.co2SavingsTotal": "Risparmio totale di CO₂",
    "tile.kilometersTotal": "Chilometri totali",
    "tile.ofWhichEstimatedWeighted": "Di cui stimato (ponderato per corsa)",
    "tile.networkOccupancyTotal": "Occupazione totale della rete",
    "tile.biggestImbalance": "Squilibrio maggiore",
    "tile.occupancy": "Occupazione",
    "tile.trafficByTimeSlot": "Ingressi e uscite per fascia oraria",
    "tile.departuresPerDayTop": "Uscite al giorno (in alto)",
    "tile.arrivalsPerDayBottom": "Ingressi al giorno (in basso)",
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
    "map.schematicNote": "Mappa schematica, non in scala: la dimensione del cerchio indica la capacità di una stazione, il riempimento la sua occupazione attuale.",
    "map.riverLabel": "Fiume Meno (schematico)",
    "map.areaWithCustomers": "Area della mappa con {stationenPhrase} e località dei clienti",
    "map.area": "Area della mappa con {stationenPhrase}",
    "map.customersAtLocation": "{ort}: {kundenPhrase}",
    "common.and": "e",
    "misc.changeVsPrevMonth": "rispetto al mese precedente",
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
    "msg.unrideableShare": "{n} su {schadenPhrase} totali - blocca la bici non appena non è in uso",
    "msg.unrideableShareNoTotal": "blocca la bici non appena non è in uso",
    "hint.shareOfBikes": "{anteil} su {raederPhrase}",
    "hint.shareOnLoan": "{anteil} su {raederPhrase} · attualmente in viaggio",
    "hint.shareMaintenance": "{anteil} su {raederPhrase} · in officina",
    "hint.shareFaulty": "{anteil} su {raederPhrase} · dove c’è un problema",
    "hint.rideDistribution": "Mediana {median}, media {mittel} per bici",
    "hint.noRidesAtAll": " · {n} su {raederPhrase} senza nemmeno una corsa",
    "hint.allRiddenAtLeastOnce": " · ognuna delle {raederPhrase} è stata usata almeno una volta",
    "hint.allInOperation": "tutte in esercizio",
    "hint.decommissionedCount": "{n} di esse dismesse",
    "hint.fullStationsShare": "{n} su {stationenPhrase}: {liste} - non accetta restituzioni",
    "hint.networkOccupancyDetail": "{belegt} stalli occupati su {kapazitaet}, in tutte le {stationenPhrase}",
    "hint.fillRangeDetail": "Mediana {median} % · {voll} su {stationenPhrase} completamente piene{leerZusatz}",
    "hint.andEmptyCount": ", {n} su {stationenPhrase} vuote",
    "hint.noneEmpty": ", nessuna vuota",
    "hint.blockedShare": "{n} su {kundenPhrase} - al momento non esiste una funzione per rimuovere un blocco",
    "hint.noUnblockFunction": "Al momento non esiste una funzione per rimuovere un blocco",
    "hint.noAddressShare": "{n} su {kundenPhrase} - può essere aggiunto in seguito nel modulo",
    "hint.addLaterInForm": "Può essere aggiunto in seguito nel modulo",
    "hint.top10Detail": "{zehntel} su {kundenPhrase} totalizzano {top10} su {gesamt} di volume fatturato (IVA inclusa, ≠ fatturato nei report) · mediana {median}, media {mittel} per cliente",
    "hint.overallStates": "in tutti gli stati di lavorazione",
    "hint.last12MonthsTrend": "Andamento degli ultimi 12 mesi",
    "hint.last12MonthsCrossCheck": "Andamento degli ultimi 12 mesi - calcolo di controllo rispetto alla scheda \"Fatturato per tipo di bici\"",
    "hint.yearlyPattern": "Andamento annuale: minimo a {tief}, massimo a {hoch}",
    "hint.perBikePerDayDetail": "{jeRadJahr} all’anno · riferito a {raederPhrase} in flotta (escluse le dismesse) · ultimi 12 mesi",
    "hint.tariffChangeFrom": "{veraenderung} da {monat} - cambio tariffa",
    "hint.shareOfRevenue": "{prozent} del fatturato ({geld})",
    "hint.revenueWithoutTariff": "{geld} di fatturato da corse senza tariffa attiva",
    "hint.estimatedShareOfRides": "{geschaetzt} corse stimate su {fahrtenPhrase} - NON {naiv}, come suggerirebbe la media semplice delle righe",
    "hint.fillLevelPerStation": "Livello di riempimento per stazione, ordinato per numero di stazione",
    "hint.networkOccupancyWeighted": "{belegt} stalli occupati su {kapazitaet} · ponderato per capacità, non la media dei singoli valori ({naiv})",
    "hint.fullStationsList": "{voll} su {stationenPhrase}: {liste}",
    "hint.worstStationBalance": "Saldo {saldo} - cede più bici di quante ne riceva",
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
    "hint.saldoChartAria": "Saldo {stationenPhrase}, posortowane według numeru stacji, od {min} do {max} - najniższe (zaznaczone na czerwono) na stacji {name}",
    "hint.fillLevelBetween": "Poziom zapełnienia {stationenPhrase}, posortowany według numeru stacji, od {min} do {max}",
    "msg.stationsWithoutBikeSuffix": ", w tym {n} bez roweru",
    "empty.noStationOccupancyText": "Brak stacji. Przy dziesięciu utworzonych stacjach jest to nietypowe — możliwą przyczyną jest chwilowa utrata roli, a nie brak danych.",
    "empty.noStationOccupancyTitle": "Brak obłożenia stacji",
    "msg.stationOccupancyLoadFailed": "Nie udało się wczytać obłożenia stacji: {fehler}",
    "misc.estimatedRidesDetail": "{geschaetzt} z {fahrtenPhrase} ({prozent})",
    "hint.monthlyKmChartAria": "Przejechane kilometry miesięcznie, ostatnie dwanaście miesięcy ({vonMonat}-{bisMonat}) - ciemny słupek po prawej to bieżący miesiąc, {aktuellWert}",
    "hint.monthlyCo2ChartAria": "Oszczędność CO2 miesięcznie, ostatnie dwanaście miesięcy ({vonMonat}-{bisMonat}), od {min} do {max} - ciemny słupek po prawej to bieżący miesiąc, {aktuellWert}",
    "msg.kmCo2Summary": "{monatszeilen}, {fahrten}, oszczędność CO₂ ogółem {co2}, w tym {prozent} szacowane (ważone przejazdami)",
    "empty.noKmCo2Title": "Brak wierszy kilometrów i CO2",
    "msg.kmCo2LoadFailed": "Nie udało się wczytać kilometrów i CO2: {fehler}",
    "field.jeKunde": "Na klienta",
    "hint.crossCheckChartAria": "Miesięczny obrót z ostatnich dwunastu miesięcy ({vonMonat}-{bisMonat}), ta sama seria co na karcie „Obrót wg typu roweru” - ciemny słupek po prawej to bieżący miesiąc, {aktuellWert}",
    "msg.revenueByCustomerGroupSummary": "{monatszeilen}, obrót ogółem {umsatz}",
    "empty.noRevenueByCustomerGroupTitle": "Brak obrotu wg grupy klientów",
    "msg.revenueByCustomerGroupLoadFailed": "Nie udało się wczytać obrotu wg grupy klientów: {fehler}",
    "hint.cityBikeJumpChartAria": "Obrót na przejazd City-Bike, {n} miesięcy od {vonMonat}: skok z {von} do {nach} od {sprungMonat}, zaznaczone na czerwono",
    "hint.monthlyRidesChartAria": "Przejazdy miesięcznie, ostatnie dwanaście miesięcy: najniżej {min} w {tiefMonat}, najwyżej {max} w {hochMonat} - ciemny słupek po prawej to bieżący miesiąc, {aktuellMonat} z {aktuellPhrase}",
    "hint.monthlyRevenueChartAria": "Miesięczny obrót z ostatnich dwunastu miesięcy ({vonMonat}-{bisMonat}), od {min} do {max} - ciemny słupek po prawej to bieżący miesiąc, {aktuellMonat} z {aktuellWert}",
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
    "hint.networkOccupancyAria": "Obłożenie sieci we wszystkich {stationenPhrase}: {belegt} z {kapazitaet} miejsc zajętych, {prozent} procent. 100 procent to całkowita pojemność całej sieci stacji, a nie jednej stacji.",
    "map.openDetailsSuffix": ". Otwórz szczegóły.",
    "map.stationFullSuffix": ", pełna - obecnie nie przyjmuje zwrotów",
    "map.stationBelegLabel": "{name}: {belegt} z {kapazitaet} miejsc zajętych",
    "map.customerLabelShort": "{ort} ({n})",
    "misc.freeShort": "{n} wolnych",
    "misc.unitsInStock": "{n} w magazynie",
    "nav.originDamageReport": "Zgłoszenie usterki dla {rahmennummer}",
    "nav.originBikeFromStation": "Rower {rahmennummer} ze stacji {name}",
    "nav.originBikeFromFleet": "Rower {rahmennummer} z floty",
    "hint.percentOfFleet": "{anteil}% floty",
    "index.title": "VeloCity Gospodarka Magazynowa",
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
    "tile.available": "Gotowy do użycia",
    "tile.onLoan": "Wypożyczony",
    "tile.inMaintenance": "W konserwacji",
    "tile.faulty": "Uszkodzony",
    "tile.ridesPerBike30d": "Przejazdy na rower (30 dni)",
    "tile.stations": "Stacje",
    "tile.fullStations": "Pełne stacje",
    "tile.networkOccupancy": "Całkowite zapełnienie – wszystkie stacje",
    "tile.fillRange": "Zakres poziomu zapełnienia",
    "tile.customersTotal": "Klienci ogółem",
    "tile.blocked": "Zablokowani",
    "tile.noAddress": "Bez adresu",
    "tile.invoiceTop10": "Wolumen faktur: górne 10%",
    "tile.damageReportsTotal": "Zgłoszenia usterek ogółem",
    "tile.workOrdersTotal": "Zlecenia ogółem",
    "tile.unrideableOpen": "Niezdatny do jazdy, otwarte",
    "tile.minimum": "Minimum",
    "tile.maximum": "Maksimum",
    "tile.countPerMonth": "Liczba na miesiąc",
    "tile.dayWithMostRides": "Dzień z największą liczbą przejazdów",
    "tile.revenueTotal": "Obrót ogółem",
    "tile.ridesTotal": "Przejazdy ogółem",
    "tile.revenuePerBikeDay": "Obrót na rower i dzień",
    "tile.notableRevenuePerRideCityBike": "Zwraca uwagę: obrót na przejazd City-Bike",
    "tile.largestCustomerGroup": "Największa grupa klientów",
    "tile.notableNoMembership": "Zwraca uwagę: bez członkostwa",
    "tile.co2SavingsTotal": "Oszczędność CO₂ ogółem",
    "tile.kilometersTotal": "Kilometry ogółem",
    "tile.ofWhichEstimatedWeighted": "W tym szacowane (ważone przejazdami)",
    "tile.networkOccupancyTotal": "Całkowite obłożenie sieci",
    "tile.biggestImbalance": "Największa nierównowaga",
    "tile.occupancy": "Zapełnienie",
    "tile.trafficByTimeSlot": "Przyjazdy i wyjazdy wg przedziału czasowego",
    "tile.departuresPerDayTop": "Wyjazdy dziennie (u góry)",
    "tile.arrivalsPerDayBottom": "Przyjazdy dziennie (u dołu)",
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
    "map.schematicNote": "Mapa schematyczna, nie w skali: wielkość koła pokazuje pojemność stacji, a wypełnienie jej bieżące zapełnienie.",
    "map.riverLabel": "Men (schematycznie)",
    "map.areaWithCustomers": "Obszar mapy z {stationenPhrase} i lokalizacjami klientów",
    "map.area": "Obszar mapy z {stationenPhrase}",
    "map.customersAtLocation": "{ort}: {kundenPhrase}",
    "common.and": "i",
    "misc.changeVsPrevMonth": "względem poprzedniego miesiąca",
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
    "msg.unrideableShare": "{n} z {schadenPhrase} ogółem — blokuje rower, gdy tylko nie jest w trasie",
    "msg.unrideableShareNoTotal": "blokuje rower, gdy tylko nie jest w trasie",
    "hint.shareOfBikes": "{anteil} z {raederPhrase}",
    "hint.shareOnLoan": "{anteil} z {raederPhrase} · obecnie w trasie",
    "hint.shareMaintenance": "{anteil} z {raederPhrase} · w warsztacie",
    "hint.shareFaulty": "{anteil} z {raederPhrase} · tam, gdzie jest problem",
    "hint.rideDistribution": "Mediana {median}, średnia {mittel} na rower",
    "hint.noRidesAtAll": " · {n} z {raederPhrase} bez ani jednego przejazdu",
    "hint.allRiddenAtLeastOnce": " · każdy z {raederPhrase} przejechano co najmniej raz",
    "hint.allInOperation": "wszystkie w eksploatacji",
    "hint.decommissionedCount": "{n} z nich wyłączono z eksploatacji",
    "hint.fullStationsShare": "{n} z {stationenPhrase}: {liste} - nie przyjmuje zwrotów",
    "hint.networkOccupancyDetail": "{belegt} z {kapazitaet} miejsc zajętych, we wszystkich {stationenPhrase}",
    "hint.fillRangeDetail": "Mediana {median}% · {voll} z {stationenPhrase} całkowicie pełnych{leerZusatz}",
    "hint.andEmptyCount": ", {n} z {stationenPhrase} pustych",
    "hint.noneEmpty": ", żadna pusta",
    "hint.blockedShare": "{n} z {kundenPhrase} - obecnie nie ma funkcji cofającej blokadę",
    "hint.noUnblockFunction": "Obecnie nie ma funkcji cofającej blokadę",
    "hint.noAddressShare": "{n} z {kundenPhrase} - można uzupełnić później w formularzu",
    "hint.addLaterInForm": "Można uzupełnić później w formularzu",
    "hint.top10Detail": "{zehntel} z {kundenPhrase} skupia {top10} z {gesamt} wolumenu faktur (z VAT, ≠ obrót w raportach) · mediana {median}, średnia {mittel} na klienta",
    "hint.overallStates": "we wszystkich stanach przetwarzania",
    "hint.last12MonthsTrend": "Trend z ostatnich 12 miesięcy",
    "hint.last12MonthsCrossCheck": "Trend z ostatnich 12 miesięcy - obliczenie kontrolne względem karty „Obrót wg typu roweru”",
    "hint.yearlyPattern": "Wzorzec roczny: najniższy w {tief}, najwyższy w {hoch}",
    "hint.perBikePerDayDetail": "{jeRadJahr} rocznie · w odniesieniu do {raederPhrase} we flocie (bez wycofanych) · ostatnie 12 miesięcy",
    "hint.tariffChangeFrom": "{veraenderung} od {monat} - zmiana taryfy",
    "hint.shareOfRevenue": "{prozent} obrotu ({geld})",
    "hint.revenueWithoutTariff": "{geld} obrotu z przejazdów bez aktywnej taryfy",
    "hint.estimatedShareOfRides": "{geschaetzt} z {fahrtenPhrase} oszacowano - NIE {naiv}, jak sugerowałaby prosta średnia wierszy",
    "hint.fillLevelPerStation": "Poziom zapełnienia wg stacji, posortowany według numeru stacji",
    "hint.networkOccupancyWeighted": "{belegt} z {kapazitaet} miejsc zajętych · ważone pojemnością, nie średnia wartości pojedynczych ({naiv})",
    "hint.fullStationsList": "{voll} z {stationenPhrase}: {liste}",
    "hint.worstStationBalance": "Saldo {saldo} - oddaje więcej rowerów, niż otrzymuje",
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
        beschriftung.textContent = t(bereich.titelSchluessel);
        knopf.append(beschriftung);

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
    await aktiverBereich.aufbauen();
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
// eingehaengt - dieselbe Machart wie uebersichtsstreifen()/reiterleiste()/
// werkzeugleiste() oben, aus demselben Grund: der Streifen soll stabil an
// derselben Stelle stehen, unabhaengig davon, in welcher Reihenfolge ein
// Bereich seine Bausteine aufbaut. Ruft ein Bereich zeigeUebersicht() VOR
// zeigeFilterleiste() auf (wie alle vier Verbraucher es tun), landet die
// Filterleiste dank derselben insertBefore(el, listenKoerper())-Logik
// zwischen Uebersicht und Tabelle - die Uebersicht beschreibt IMMER den
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

// kennung: dieselbe Absicherung wie bei zeigeUebersicht()/zeigeListe() -
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

// ===== Übersichtsstreifen (Gestaltungsauftrag Auswertungen, Punkt 1) =====
//
// "Interessant wäre auch immer eine kleine Übersicht über den Tabellen,
// in denen Dinge zusammengefasst und veranschaulicht werden" - wörtlich
// der Auftrag. Tufte dazu: wenige, aussagekräftige Zahlen mit wortgroßen
// Grafiken daneben (Sparklines) statt eines separaten großen Diagramms -
// "small multiples" statt Deko. Der Streifen sitzt ÜBER der Liste, in
// derselben Ansicht: man verlässt die Tabelle nicht, um ihre zusammen-
// gefasste Form zu sehen.
//
// Find-or-create auf eine feste id, unmittelbar vor listenKoerper()
// eingehängt - dieselbe Machart wie reiterleiste()/werkzeugleiste() oben.
// Dadurch steht der Streifen unabhängig von der Aufrufreihenfolge IMMER
// zwischen einer eventuellen Reiter-/Werkzeugleiste und der Tabelle
// selbst, nie darüber oder darunter vertauscht - genau das Problem, das
// reiterleiste() weiter oben für sich schon lösen musste.
function uebersichtsstreifen() {
    const wurzel = document.getElementById('arbeitsliste');
    let el = document.getElementById('uebersichtsstreifen');
    if (!el) {
        el = document.createElement('div');
        el.id = 'uebersichtsstreifen';
        el.className = 'uebersichtsstreifen';
    }
    wurzel.insertBefore(el, listenKoerper());
    el.replaceChildren();
    return el;
}

// kennung: dieselbe Absicherung wie bei zeigeListe()/zeigeLeermaske() -
// ein Reiterwechsel, dessen Übersicht erst nach einem eigenen await
// zurückkommt, dürfte einen inzwischen überholten Bildschirm nicht mehr
// beschreiben (siehe Kopfkommentar bei neuerVorgang()).
//
// kacheln: [{ titel, wert, veraenderung?, grafik?, hinweis? }]
// - titel: die Frage, die die Kachel beantwortet ("Umsatz gesamt", ...).
// - wert: String ODER Element - ein Element für typografisch skalierte
//   Zahlen (siehe zahlSkaliert() weiter unten) oder eine eingefärbte
//   Bedeutung, sonst reicht ein String.
// - veraenderung (optional, Gestaltungsauftrag Punkt 2): eine kleine
//   Zeile MIT Richtungspfeil ÜBER der Zahl ("▼ −5 % ggü. Vormonat") -
//   String ODER Element. Getrennt von hinweis (das steht UNTER der
//   Zahl): der Auftrag zeigt die Veränderung ausdrücklich ÜBER dem
//   Verlauf, nicht als weitere Randnotiz danach. Nur dort gesetzt, wo
//   ein Vormonat/-zeitraum fachlich existiert (siehe die saeulen-
//   sparkline-Kacheln in auswertungen.js) - kein Feld, das jede Kachel
//   nachliefern müsste.
// - grafik (optional): ein <svg>-Element bzw. ein von saeulenSparkline()
//   gelieferter Block - das "wortgroße Bild daneben" aus dem Auftrag,
//   oder ein Zellbalken (zellbalken()) für einen echten Anteil.
// - hinweis (optional): eine zweite, leisere Zeile unter der Zahl - die
//   Einordnung, nicht die Kennzahl selbst ("42 % des Umsatzes ohne feste
//   Mitgliedschaft"). Hierhin gehört auch eine Unsicherheit, die NEBEN
//   der Zahl stehen muss statt in einer Fußnote (Schätzanteil bei
//   Kilometer/CO2, siehe auswertungen.js).
//
// Ohne kacheln (leeres Array, z. B. beim Leer- oder Fehlerzustand einer
// Liste) wird der Streifen abgeräumt statt leer stehen gelassen - dasselbe
// Prinzip wie bei zeigeWerkzeugleiste(false, ...): ein Container ohne
// Inhalt bliebe sonst als schmaler, unerklärter Streifen stehen, und ohne
// dieses explizite Abräumen überlebte die Übersicht des VORHERIGEN
// Reiters unverändert einen Reiterwechsel, der selbst keine Übersicht
// mehr zeigen will (bereichWechseln() leert #arbeitsliste nur beim
// BEREICHSwechsel, nicht beim Reiterwechsel innerhalb der Auswertungen).
function zeigeUebersicht(kennung, kacheln) {
    if (!istAktuellerVorgang(kennung)) return;
    const leiste = uebersichtsstreifen();
    if (!kacheln || kacheln.length === 0) { leiste.remove(); return; }

    for (const kachel of kacheln) leiste.append(baueKachel(kachel));
}

// Das Kachel-Markup selbst, herausgezogen aus zeigeUebersicht() (siehe
// dort): der Drill-Down (monatsdrilldownEinfuegen() in auswertungen.js)
// braucht dieselben vier Kacheln - Min, Max, Anzahl pro Monat, Tag mit
// den meisten Fahrten - aber NICHT im #uebersichtsstreifen am Kopf von
// #arbeitsliste, sondern in der Detailmaske. Zwei Aufrufer, die beide
// dieselbe Handvoll DOM-Zeilen von Hand nachbauen, wären derselbe
// Befund wie bei werkzeugleiste()/uebersichtsstreifen() selbst: ein
// wiederkehrendes Muster gehört EINMAL hierher, nicht mehrfach in einen
// Bereich - hier zusätzlich nicht mehrfach in DIESE Datei.
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
    const minimum = Math.min(0, ...werteBereinigt);
    const maximum = Math.max(0, ...werteBereinigt);
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
// (neutral: "hier ist eine Zahl"), überschreibbar, wo Farbe tatsächlich
// etwas bedeutet (z. B. eine volle Station in --warnung-text, siehe
// stationsauslastungZeigen() in auswertungen.js).
//
// aria-hidden auf dem <svg>: der Balken ist eine zweite, rein visuelle
// Darstellung DESSELBEN Werts, der als Text daneben steht - anders als
// eine Sparkline (die eine Form zeigt, die der Text allein nicht hergibt)
// trägt er für sich keine zusätzliche Information.
function zellbalken(wert, maximum, textInhalt = null, optionen = {}) {
    const { breite = 56, hoehe = 12, farbe = 'var(--marine)' } = optionen;
    const anteil = maximum > 0 ? Math.max(0, Math.min(1, wert / maximum)) : 0;

    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${breite} ${hoehe}`);
    svg.setAttribute('width', breite);
    svg.setAttribute('height', hoehe);
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    svg.classList.add('zellbalken-grafik');

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

    const wrapper = document.createElement('span');
    wrapper.className = 'zellbalken';
    wrapper.append(svg);
    if (textInhalt !== null && textInhalt !== undefined && textInhalt !== '') {
        const text = document.createElement('span');
        text.className = 'zellbalken-text';
        text.append(textInhalt);
        wrapper.append(text);
    }
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
// "Zahlen soll man sehen, nicht lesen": die tragenden Ziffern (Größen-
// ordnung) bleiben in voller Stärke, Tausenderpunkte und die
// Nachkommastellen (samt Einheit) treten optisch zurück - eine
// mehrstellige Zahl wird so auf einen Blick erfasst, nicht Ziffer für
// Ziffer gelesen.
//
// Nimmt eine FERTIG formatierte Zahl der AKTUELLEN Sprache entgegen
// (Trennzeichen schon gesetzt, z. B. von geldFormat()/kgFormat() in
// auswertungen.js) - das Zerlegen des Zahlenformats gehört hierher, weil
// jeder Bereich mit einer eigenen, ähnlichen Formatierungsfunktion
// dieselbe Aufteilung braucht; WAS gerundet und WELCHE Einheit
// angehängt wird, bleibt Sache des Aufrufers.
//
// MEHRSPRACHIGKEIT (Fallstrick 2): frueher fest von deutschen
// Trennzeichen ausgegangen (Punkt = Tausender, Komma = Dezimal) - fuer
// Englisch (Komma = Tausender, Punkt = Dezimal) traf das Muster nicht
// mehr zu, und die ganze Zahl waere unskaliert als Fliesstext
// durchgerutscht (siehe der Kein-Treffer-Zweig unten). zahlTrennzeichen()
// liefert die Zeichen der GERADE gewaehlten Sprache, das Muster wird
// bei jedem Aufruf neu danach gebaut.
//
// Kein Treffer (ein Text, der nicht wie eine Zahl aussieht) gibt den
// Eingabetext unverändert als einzelnen Textknoten zurück - eine
// typografische Verzierung darf niemals dazu führen, dass eine Zahl aus
// der Tabelle verschwindet, nur weil sie einem erwarteten Muster nicht
// entspricht.
function zahlSkaliert(formatiert) {
    const { gruppe: gruppenzeichen, dezimal: dezimalzeichen } = zahlTrennzeichen();
    const gEsc = regexEscape(gruppenzeichen);
    const dEsc = regexEscape(dezimalzeichen);
    const muster = new RegExp(`^(-?\\d{1,3}(?:${gEsc}\\d{3})*)(${dEsc}\\d+)?(.*)$`);
    const treffer = String(formatiert).match(muster);
    const spanne = document.createElement('span');
    spanne.className = 'zahl-skaliert';
    if (!treffer) {
        spanne.textContent = formatiert;
        return spanne;
    }

    const [, ganzzahl, dezimal, rest] = treffer;
    // Tausendertrennzeichen selbst leiser, die tragenden Ziffern normal -
    // deshalb die Gruppen einzeln angehängt statt die ganze Ganzzahl als
    // einen Textknoten.
    ganzzahl.split(gruppenzeichen).forEach((gruppe, i) => {
        if (i > 0) {
            const trenner = document.createElement('span');
            trenner.className = 'zahl-nebenteil';
            trenner.textContent = gruppenzeichen;
            spanne.append(trenner);
        }
        spanne.append(gruppe);
    });
    if (dezimal || rest) {
        const neben = document.createElement('span');
        neben.className = 'zahl-nebenteil';
        neben.textContent = (dezimal || '') + rest;
        spanne.append(neben);
    }
    return spanne;
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
// uebersichtsstreifen() weiter oben: ein wiederkehrendes Muster gehoert
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
    knopf.innerHTML = aktiv ? SPALTENKOPF_RESET_ICON : SPALTENKOPF_GRUPPE_ICON;
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
function zeigeMaske(titel, felder, knoepfe) {
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
