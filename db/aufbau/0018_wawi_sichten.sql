-- =====================================================================
-- 0018 Sichten der Warenwirtschaft
--
-- Zweck:      Die Fenster, durch die die Warenwirtschaft auf die Daten
--             sieht. Jede Sicht filtert SELBST ueber velocity.hat_rolle
--             - nicht aus Vorsicht, sondern aus Notwendigkeit:
--             PostgREST meldet Kunden und Mitarbeitende als dieselbe
--             Datenbankrolle 'authenticated' an. Ohne Filter in der
--             Sicht laese jeder Kunde die Stammdaten aller anderen.
-- Objekte:    velocity.fn_luftlinie_km, velocity.v_wawi_flotte,
--             v_wawi_kunde, v_wawi_station, v_wawi_schaden,
--             v_wawi_auftrag, v_wawi_umsatz_radtyp,
--             v_wawi_umsatz_kundengruppe, v_wawi_km_co2,
--             v_wawi_stationsauslastung, v_wawi_modell,
--             v_wawi_fahrten_je_tag, v_wawi_fahrten_je_tag_rad,
--             v_wawi_station_flotte, v_wawi_stationsverkehr_zeitfenster,
--             velocity.ort_koordinate, v_wawi_kundenorte
-- Ruecknahme: DROP VIEW fuer dieselben Namen; DROP TABLE
--             velocity.ort_koordinate; DROP FUNCTION
--             velocity.fn_luftlinie_km(numeric,numeric,numeric,numeric);
--
-- Hinweis:    Diese Datei entsteht in fuenf Aufgaben. Aufgabe 10 legt die
--             fuenf Arbeitssichten an (Flotte, Kunden, Stationen,
--             Schaeden, Auftraege) und die Haversine-Funktion, die die
--             Auswertungssichten aus Aufgabe 11 brauchen werden. Aufgabe 3
--             des Oberflaechenplans ergaenzt v_wawi_modell: eine Sicht
--             fuer eine Eingabemaske statt fuer eine Auswertung, die beim
--             Bau der Oberflaeche als fehlend auffiel. Die Drill-Down-
--             Aufgabe ergaenzt v_wawi_fahrten_je_tag: die Monatssichten
--             aus Aufgabe 11 aggregieren je Monat, ein Klick auf einen
--             Monat braucht aber Tageszahlen, die es bislang nicht gab.
--             "Sichten verweben" (Gestaltungsauftrag Punkt 2b) ergaenzt
--             v_wawi_fahrten_je_tag_rad: ein Klick auf einen Tag braucht
--             die Raeder, die an diesem Tag gefahren sind - ohne
--             Personenbezug, siehe deren ausfuehrlicher Kommentar. Der
--             Gestaltungsauftrag "Stationen ausbauen" ergaenzt drei
--             weitere Sichten und eine Referenztabelle ganz am Ende der
--             Datei: v_wawi_station_flotte (welche Raeder stehen an
--             welcher Station, Punkt 1), v_wawi_stationsverkehr_zeitfenster
--             (Zu-/Abgang nach Zeitfenster fuer die Disposition, Punkt 3)
--             und velocity.ort_koordinate/v_wawi_kundenorte (Koordinaten
--             fuer die schematische Landkarte samt aggregierter
--             Kundenorte, Punkt 4). Der Gestaltungsauftrag "Kundschaft
--             erweitern" ergaenzt v_wawi_kunde um letzte_ausleihe_am/
--             letzte_ausleihe_laeuft (Punkt 1: "Letzte Ausleihe am" fehlte
--             ganz in der Sicht, "Kunde seit" gab es schon als
--             registriert_am, stand nur nicht in der Kundenliste). Der
--             Demozugang (0020_demo_zugang.sql) ergaenzt in JEDER WHERE-
--             Klausel dieser Datei bis auf ZWEI ein zusaetzliches
--             "or velocity.hat_rolle('demo')". Die erste Ausnahme ist
--             v_wawi_kunde, siehe deren eigener Kommentar fuer die
--             Begruendung (Personendaten hinter einem oeffentlich
--             beworbenen Kennwort). Die zweite ist v_wawi_km_co2 - dort
--             keine Datenschutzfrage, sondern strukturell wirkungslos,
--             weil sie FROM v_wawi_fahrt_km liest, deren eigene
--             WHERE-Klausel unveraendert nur 'leitung' zulaesst (siehe
--             deren beider Kommentare). v_wawi_fahrt_km selbst bleibt
--             unveraendert: fuer authenticated ohnehin vollstaendig
--             gesperrt (siehe deren Kommentar weiter unten).
-- =====================================================================

-- Luftlinie nach Haversine, ohne PostGIS - dieselbe Entscheidung wie
-- beim Geschaeftsgebiet: eine Erweiterung fuer eine Formel mit fuenf
-- Zeilen waere ein Betriebsrisiko ohne Gegenwert. Wird erst von den
-- Auswertungssichten aus Aufgabe 11 gebraucht (Schaetzung der Distanz,
-- wo ausleihe.distanz_km fehlt); steht hier, weil sie zum Haversine-
-- Themenblock dieser Datei gehoert.
create or replace function velocity.fn_luftlinie_km(
  p_lat1 numeric, p_lon1 numeric, p_lat2 numeric, p_lon2 numeric
)
returns numeric
language sql
immutable
as $$
  select case
    when p_lat1 is null or p_lon1 is null or p_lat2 is null or p_lon2 is null then null
    else round((6371.0 * 2 * asin(sqrt(
           power(sin(radians(p_lat2 - p_lat1) / 2), 2)
         + cos(radians(p_lat1)) * cos(radians(p_lat2))
         * power(sin(radians(p_lon2 - p_lon1) / 2), 2)
         )))::numeric, 3)
  end;
$$;

comment on function velocity.fn_luftlinie_km(numeric, numeric, numeric, numeric) is
  'Distanz zweier Koordinaten in km nach Haversine, ohne PostGIS. Liefert null, '
  'sobald ein Punkt fehlt - eine geschätzte Distanz aus einem halben Koordinatenpaar '
  'wäre Erfindung, keine Schätzung.';

-- ---- Flotte ----------------------------------------------------------
create or replace view velocity.v_wawi_flotte as
select f.fahrrad_id,
       f.rahmennummer,
       t.typ_code,
       t.bezeichnung          as typ,
       h.name                 as hersteller,
       mo.modellbezeichnung   as modell,
       f.status,
       f.angeschafft_am,
       s.name                 as standort,
       fp.latitude, fp.longitude, fp.akkustand_prozent,
       (select max(w.erledigt_am) from velocity.wartungsauftrag w
         where w.fahrrad_id = f.fahrrad_id and w.status = 'erledigt') as letzte_wartung,
       (select count(*) from velocity.schadensmeldung sm
         where sm.fahrrad_id = f.fahrrad_id and sm.status in ('offen','in_arbeit'))
                              as offene_schaeden,
       -- Die dringlichste offene Meldung bestimmt, ob das Rad ueberhaupt
       -- fahren darf. Sie gehoert in die Liste, nicht in die Detailmaske.
       -- max() auf dem ENUM selbst, nicht auf ::text: schaden_schwere ist
       -- als gering < mittel < fahruntauglich angelegt, und nur diese
       -- Reihenfolge macht "hoechste" richtig. Eine textuelle max()
       -- ordnete alphabetisch und erklaerte 'mittel' faelschlich zur
       -- schwersten Meldung, weil 'f' vor 'g' und 'm' im Alphabet liegt.
       (select max(sm.schwere)::text from velocity.schadensmeldung sm
         where sm.fahrrad_id = f.fahrrad_id and sm.status in ('offen','in_arbeit'))
                              as hoechste_schwere,
       -- Nachtraeglich ans Ende angefuegt (CREATE OR REPLACE VIEW darf
       -- bestehende Spalten weder verschieben noch umbenennen): die
       -- Detailmaske eines Rades hatte bislang nichts zum Anzeigen ausser
       -- Namen. baujahr kommt aus fahrradmodell (gilt je Hersteller-Zeile),
       -- die fuenf technischen Werte kommen seit der Produktkorrektur (siehe
       -- db/betrieb/flottenmodelle_stammdaten.sql) aus fahrradtyp - sie
       -- gelten je TYP, nicht je Modellzeile, weil auch der Tarif am Typ
       -- haengt und nicht an dem Hersteller, der ihn gerade fertigt.
       mo.baujahr,
       t.gewicht_kg, t.gangzahl, t.rahmenhoehe_cm,
       t.akkukapazitaet_wh, t.reichweite_km
  from velocity.fahrrad f
  join velocity.fahrradmodell mo on mo.modell_id = f.modell_id
  join velocity.fahrradtyp    t  on t.typ_id     = mo.typ_id
  join velocity.hersteller    h  on h.hersteller_id = mo.hersteller_id
  left join velocity.fahrrad_position fp on fp.fahrrad_id = f.fahrrad_id
  left join velocity.station          s  on s.station_id  = fp.station_id
 where velocity.hat_rolle('disposition')
    or velocity.hat_rolle('werkstatt')
    or velocity.hat_rolle('leitung')
    -- Demozugang (0020_demo_zugang.sql): 'demo' ist keine Fachrolle,
    -- sondern ein rein lesender Vorfuehrzugang, siehe dortiger
    -- Kopfkommentar fuer die Begruendung. Kein Widerspruch zu GR16/GR17:
    -- diese Sicht traegt keine Personendaten, nur Flottendaten.
    or velocity.hat_rolle('demo');

comment on view velocity.v_wawi_flotte is
  'Arbeitssicht der Flotte für Disposition und Werkstatt: ein Rad je Zeile mit '
  'Standort, Wartungshistorie und dem dringlichsten offenen Schaden. Filtert '
  'selbst über velocity.hat_rolle, siehe Kopfkommentar der Datei. Seit dem '
  'Demozugang zusätzlich für velocity.hat_rolle(''demo'') lesbar (siehe '
  '0020_demo_zugang.sql) - keine Personendaten in dieser Sicht.';
comment on column velocity.v_wawi_flotte.fahrrad_id is
  'Schlüssel des Rades, für Verweise in die Werkstatt- und Auftragssichten.';
comment on column velocity.v_wawi_flotte.rahmennummer is
  'Am Rahmen ablesbare Nummer, der Bezug zum physischen Rad vor Ort.';
comment on column velocity.v_wawi_flotte.typ_code is
  'Fachlicher Schlüssel des Fahrradtyps, für Filter in der Oberfläche.';
comment on column velocity.v_wawi_flotte.typ is
  'Anzeigename des Fahrradtyps.';
comment on column velocity.v_wawi_flotte.hersteller is
  'Name des Herstellers laut Modellstammdaten.';
comment on column velocity.v_wawi_flotte.modell is
  'Modellbezeichnung, für die Ersatzteilsuche in der Werkstatt.';
comment on column velocity.v_wawi_flotte.baujahr is
  'Baujahr laut Stammdaten - das Jahr, seit dem der Hersteller dieser Modellzeile den Typ beliefert.';
comment on column velocity.v_wawi_flotte.gewicht_kg is
  'Leergewicht des Fahrradtyps laut Stammdaten - gilt für jedes Rad dieses Typs gleich, unabhängig vom Hersteller.';
comment on column velocity.v_wawi_flotte.gangzahl is
  'Zahl der Gänge des Fahrradtyps laut Stammdaten - gilt für jedes Rad dieses Typs gleich, unabhängig vom Hersteller.';
comment on column velocity.v_wawi_flotte.rahmenhoehe_cm is
  'Rahmenhöhe des Fahrradtyps laut Stammdaten - eine Größe je Typ, individuelle Anpassung läuft über den Sattel-Schnellspanner.';
comment on column velocity.v_wawi_flotte.akkukapazitaet_wh is
  'Akkukapazität des Fahrradtyps laut Stammdaten. NULL bei einem Rad ohne Elektroantrieb.';
comment on column velocity.v_wawi_flotte.reichweite_km is
  'Herstellerangabe zur Reichweite des Fahrradtyps laut Stammdaten. NULL bei einem Rad ohne Elektroantrieb.';
comment on column velocity.v_wawi_flotte.status is
  'Aktueller Betriebsstatus des Rades - verfuegbar, ausgeliehen, wartung, '
  'defekt oder ausgemustert. Anders als die öffentliche '
  'v_verfuegbares_fahrrad zeigt diese Sicht gerade auch die NICHT '
  'verfügbaren Räder: die Disposition muss wissen, welches Rad in der '
  'Wartung hängt, nicht nur, welches gerade fahrbereit ist.';
comment on column velocity.v_wawi_flotte.angeschafft_am is
  'Anschaffungsdatum, Grundlage für Abschreibung und Alterseinschätzung.';
comment on column velocity.v_wawi_flotte.standort is
  'Name der Station, an der das Rad steht. NULL bei freiem Abstellort oder '
  'laufender Fahrt.';
comment on column velocity.v_wawi_flotte.latitude is
  'Breitengrad der zuletzt gemeldeten Position, unabhängig von einer Station.';
comment on column velocity.v_wawi_flotte.longitude is
  'Längengrad der zuletzt gemeldeten Position, unabhängig von einer Station.';
comment on column velocity.v_wawi_flotte.akkustand_prozent is
  'Ladestand des Akkus. NULL bei Rädern ohne Elektroantrieb.';
comment on column velocity.v_wawi_flotte.letzte_wartung is
  'Abschlusszeitpunkt des zuletzt erledigten Wartungsauftrags. NULL, wenn das '
  'Rad noch nie in der Werkstatt war.';
comment on column velocity.v_wawi_flotte.offene_schaeden is
  'Zahl der noch nicht abgeschlossenen Schadensmeldungen (offen oder in_arbeit).';
comment on column velocity.v_wawi_flotte.hoechste_schwere is
  'Schwerste noch offene Meldung nach der natürlichen Rangfolge des ENUM '
  '(gering < mittel < fahruntauglich), nicht alphabetisch. NULL, wenn keine '
  'offene Meldung vorliegt - entscheidet, ob das Rad überhaupt eingeplant '
  'werden darf.';

-- ---- Kunden ----------------------------------------------------------
-- Bewusst OHNE einzelne Fahrten: eine Liste mit Start, Ziel und Uhrzeit
-- ist ein Bewegungsprofil. Der Kundenservice braucht Summen, keine
-- Wege. Bewusst OHNE Zahlungsmittel (GR17) und ohne alles aus dem
-- Schema auth.
create or replace view velocity.v_wawi_kunde as
select k.kunde_id,
       k.kundennummer,
       k.anrede, k.vorname, k.nachname, k.email, k.telefon,
       k.status,
       k.registriert_am,
       a.strasse, a.hausnummer, a.plz, a.ort,
       tr.tarif_code,
       tr.bezeichnung as tarif,
       -- Nur das Startdatum, nicht der ganze Zeitraum: der Kundenservice
       -- fragt "seit wann", nicht nach der internen Range-Darstellung.
       lower(m.gueltigkeit) as mitgliedschaft_seit,
       (select count(*) from velocity.ausleihe au
         where au.kunde_id = k.kunde_id and au.status = 'abgeschlossen') as fahrten_gesamt,
       (select count(*) from velocity.ausleihe au
         where au.kunde_id = k.kunde_id and au.status = 'aktiv')          as fahrten_offen,
       (select coalesce(sum(r.betrag_brutto), 0) from velocity.rechnung r
         where r.kunde_id = k.kunde_id)                                   as umsatz_brutto,
       (select coalesce(sum(r.betrag_brutto), 0) from velocity.rechnung r
         where r.kunde_id = k.kunde_id and r.status = 'gestellt')         as offener_betrag,
       -- Oberflaechenauftrag, wörtlich: "Bei Kunde vermisse ich ...
       -- 'Letzte Ausleihe am'". ZAEHLT EINE LAUFENDE AUSLEIHE ALS
       -- "LETZTE"? JA, ausdruecklich: am Tag dieser Aenderung laufen 110
       -- von 275 Raedern gerade (siehe fahrten_offen). Wer eine solche
       -- Ausleihe hier ausschliesst und nur 'abgeschlossen' zaehlt, zeigt
       -- fuer genau diese Kunden ein veraltetes Datum aus der Fahrt DAVOR,
       -- waehrend die tatsaechlich juengste Ausleihe laengst laeuft - eine
       -- Falschaussage, kein bloss unvollstaendiger Befund. 'storniert'
       -- bleibt dagegen aussen vor, aus demselben Grund, aus dem
       -- fahrten_gesamt/fahrten_offen es zwei Zeilen weiter oben schon
       -- ausschliessen: eine stornierte Ausleihe hat nie stattgefunden.
       -- Zwei getrennte, sonst identische Unterabfragen (Zeitpunkt UND
       -- Status derselben Zeile) statt einer gemeinsamen, weil diese Sicht
       -- fuer jede andere abgeleitete Spalte (siehe die vier Zeilen
       -- darueber) ebenfalls eine eigene Unterabfrage je Spalte schreibt,
       -- nicht ein gemeinsames LATERAL - "order by startzeit desc,
       -- ausleihe_id desc" ist in beiden WORTGLEICH, deshalb liefern beide
       -- garantiert dieselbe Zeile, auch bei zwei Ausleihen mit exakt
       -- gleicher startzeit.
       (select au.startzeit from velocity.ausleihe au
         where au.kunde_id = k.kunde_id and au.status in ('aktiv', 'abgeschlossen')
         order by au.startzeit desc, au.ausleihe_id desc
         limit 1)                                                         as letzte_ausleihe_am,
       -- Kenntlich machen (Auftrag, ausdruecklich): true, solange die
       -- juengste Ausleihe selbst noch laeuft - kunden.js haengt daran
       -- einen sichtbaren Zusatz an, statt ein abgeschlossenes Datum
       -- vorzutaeuschen. NULL (nicht false), wenn es ueberhaupt keine
       -- Ausleihe gibt - "false" behauptete faelschlich "die letzte ist
       -- abgeschlossen", wo es gar keine letzte gibt.
       (select au.status = 'aktiv' from velocity.ausleihe au
         where au.kunde_id = k.kunde_id and au.status in ('aktiv', 'abgeschlossen')
         order by au.startzeit desc, au.ausleihe_id desc
         limit 1)                                                         as letzte_ausleihe_laeuft
  from velocity.kunde k
  left join velocity.adresse a on a.adresse_id = k.rechnungsadresse_id
  left join velocity.mitgliedschaft m
         on m.kunde_id = k.kunde_id and upper_inf(m.gueltigkeit)
  left join velocity.tarif tr on tr.tarif_id = m.tarif_id
 where velocity.hat_rolle('kundenservice')
    or velocity.hat_rolle('leitung');

comment on view velocity.v_wawi_kunde is
  'Arbeitssicht des Kundenservice: Stammdaten, laufender Tarif und Kontostand '
  'je Kunde. Bewusst ohne einzelne Fahrten (Bewegungsprofil), ohne '
  'Zahlungsmittel (GR17) und ohne alles aus dem Schema auth - was niemand '
  'braucht, wird nicht ausgeliefert. Filtert selbst über velocity.hat_rolle. '
  'EINZIGE der 15 fuer authenticated freigegebenen v_wawi_-Sichten OHNE '
  'velocity.hat_rolle(''demo'') (siehe 0020_demo_zugang.sql): sie fuehrt Name, '
  'E-Mail, Telefon und Anschrift von ueber 1000 Personen. Ein Zugang mit einem '
  'auf der Anmeldeseite oeffentlich genannten Kennwort darf diese Liste nicht '
  'sehen, auch wenn die Personen hier erfunden sind - dieselbe Datensparsamkeit '
  '(Art. 5 Abs. 1 lit. c DSGVO), die v_wawi_kundenorte weiter unten schon fuer '
  'disposition durchsetzt (Kunden nur als Zaehlung je Ort, nie als '
  'Einzelperson). Der Kundenservice-Bereich der Oberflaeche bleibt fuer ''demo'' '
  'deshalb ausdruecklich verborgen, nicht nur ausgegraut (wawi/kunden.js).';
comment on column velocity.v_wawi_kunde.kunde_id is
  'Surrogatschlüssel, fachlich bedeutungslos und deshalb stabil.';
comment on column velocity.v_wawi_kunde.kundennummer is
  'Fachlicher, am Telefon nennbarer Schlüssel des Kunden.';
comment on column velocity.v_wawi_kunde.anrede is
  'Anrede für die Korrespondenz.';
comment on column velocity.v_wawi_kunde.vorname is
  'Vorname des Kunden.';
comment on column velocity.v_wawi_kunde.nachname is
  'Nachname des Kunden.';
comment on column velocity.v_wawi_kunde.email is
  'Kontaktadresse, zugleich eindeutiges Merkmal für die Anmeldung.';
comment on column velocity.v_wawi_kunde.telefon is
  'Telefonische Kontaktmöglichkeit, optional.';
comment on column velocity.v_wawi_kunde.status is
  'aktiv, gesperrt oder geschlossen - der Kundenservice muss ihn sehen, um '
  'eine Sperre überhaupt erklären zu können.';
comment on column velocity.v_wawi_kunde.registriert_am is
  'Zeitpunkt der Registrierung, unabhängig vom technischen erstellt_am.';
comment on column velocity.v_wawi_kunde.strasse is
  'Strasse der Rechnungsadresse. NULL, solange keine hinterlegt ist.';
comment on column velocity.v_wawi_kunde.hausnummer is
  'Hausnummer der Rechnungsadresse.';
comment on column velocity.v_wawi_kunde.plz is
  'Postleitzahl der Rechnungsadresse.';
comment on column velocity.v_wawi_kunde.ort is
  'Ort der Rechnungsadresse.';
comment on column velocity.v_wawi_kunde.tarif_code is
  'Fachlicher Schlüssel des aktuell laufenden Tarifs. NULL ohne aktive '
  'Mitgliedschaft.';
comment on column velocity.v_wawi_kunde.tarif is
  'Anzeigename des aktuell laufenden Tarifs.';
comment on column velocity.v_wawi_kunde.mitgliedschaft_seit is
  'Beginn der aktuell laufenden Mitgliedschaft (die mit offenem Ende, siehe '
  'upper_inf in der Sicht). NULL ohne aktive Mitgliedschaft.';
comment on column velocity.v_wawi_kunde.fahrten_gesamt is
  'Anzahl abgeschlossener Ausleihen. Eine Summe statt einer Liste - siehe '
  'Kommentar am create view.';
comment on column velocity.v_wawi_kunde.fahrten_offen is
  'Anzahl aktuell laufender Ausleihen, typischerweise null oder eins.';
comment on column velocity.v_wawi_kunde.umsatz_brutto is
  'Summe aller Rechnungsbeträge des Kunden, unabhängig vom Zahlungsstatus.';
comment on column velocity.v_wawi_kunde.offener_betrag is
  'Summe der gestellten, noch nicht bezahlten Rechnungen - der Betrag, um den '
  'es bei einer Mahnung geht.';
comment on column velocity.v_wawi_kunde.letzte_ausleihe_am is
  'Start der zeitlich juengsten Ausleihe (aktiv oder abgeschlossen, storniert '
  'zaehlt nicht) - siehe letzte_ausleihe_laeuft, ob sie noch andauert. NULL '
  'heisst: dieser Kunde hat noch nie ausgeliehen, kein Ladefehler.';
comment on column velocity.v_wawi_kunde.letzte_ausleihe_laeuft is
  'true, wenn die unter letzte_ausleihe_am genannte Ausleihe noch laeuft '
  '(status aktiv); false, wenn sie abgeschlossen ist; NULL, wenn es noch '
  'keine Ausleihe gibt.';

-- ---- Stationen -------------------------------------------------------
create or replace view velocity.v_wawi_station as
select s.station_id,
       s.stationsnummer,
       s.name,
       a.strasse, a.hausnummer, a.plz, a.ort,
       s.latitude, s.longitude,
       s.kapazitaet,
       count(fp.fahrrad_id)                       as belegt,
       s.kapazitaet - count(fp.fahrrad_id)        as frei,
       s.betriebszeitraum,
       upper_inf(s.betriebszeitraum)              as in_betrieb
  from velocity.station s
  join velocity.adresse a on a.adresse_id = s.adresse_id
  left join velocity.fahrrad_position fp on fp.station_id = s.station_id
 where velocity.hat_rolle('disposition')
    or velocity.hat_rolle('leitung')
    or velocity.hat_rolle('demo')
 group by s.station_id, s.stationsnummer, s.name, a.strasse, a.hausnummer,
          a.plz, a.ort, s.latitude, s.longitude, s.kapazitaet, s.betriebszeitraum;

comment on view velocity.v_wawi_station is
  'Arbeitssicht der Disposition: Kapazitaet und Belegung je Station, samt '
  'stillgelegter Stationen (GR22 - eine Station wird stillgelegt, nicht '
  'gelöscht, deshalb bleibt sie hier sichtbar statt zu verschwinden). '
  'Filtert selbst über velocity.hat_rolle. Seit dem Demozugang zusätzlich für '
  'velocity.hat_rolle(''demo'') lesbar (0020_demo_zugang.sql).';
comment on column velocity.v_wawi_station.station_id is
  'Surrogatschlüssel, fachlich bedeutungslos und deshalb stabil.';
comment on column velocity.v_wawi_station.stationsnummer is
  'Fachlicher Schlüssel der Station.';
comment on column velocity.v_wawi_station.name is
  'Anzeigename der Station.';
comment on column velocity.v_wawi_station.strasse is
  'Strasse des Stationsstandorts.';
comment on column velocity.v_wawi_station.hausnummer is
  'Hausnummer des Stationsstandorts.';
comment on column velocity.v_wawi_station.plz is
  'Postleitzahl des Stationsstandorts.';
comment on column velocity.v_wawi_station.ort is
  'Ort des Stationsstandorts.';
comment on column velocity.v_wawi_station.latitude is
  'Breitengrad für den Kartenmarker.';
comment on column velocity.v_wawi_station.longitude is
  'Längengrad für den Kartenmarker.';
comment on column velocity.v_wawi_station.kapazitaet is
  'Zahl der Stellplätze laut Stammdaten.';
comment on column velocity.v_wawi_station.belegt is
  'Zahl der Räder, die aktuell an dieser Station stehen.';
comment on column velocity.v_wawi_station.frei is
  'Kapazitaet abzüglich belegt. Anders als die öffentliche v_station ohne '
  'greatest(..., 0): GR15 verhindert Überfüllung bereits beim Abstellen, '
  'ein negativer Wert wäre hier also ein Alarmsignal und keine Zahl, die '
  'kaschiert werden sollte.';
comment on column velocity.v_wawi_station.betriebszeitraum is
  'Zeitraum, in dem die Station betrieben wird oder wurde. Offenes Ende '
  'bedeutet weiterhin in Betrieb.';
comment on column velocity.v_wawi_station.in_betrieb is
  'Wahr, solange betriebszeitraum kein Ende trägt. Kurzform für die '
  'Oberfläche, ohne dass sie den Bereichstyp selbst auswerten muss.';

-- ---- Schadensmeldungen -----------------------------------------------
create or replace view velocity.v_wawi_schaden as
select sm.schadensmeldung_id,
       sm.fahrrad_id,
       f.rahmennummer,
       t.typ_code,
       sm.gemeldet_am,
       -- Wer gemeldet hat, aber nicht WER genau: fuer die Werkstatt
       -- zaehlt, ob die Meldung aus dem Betrieb oder von draussen kam.
       case when sm.melder_kunde_id is not null then 'Kunde' else 'Mitarbeiter' end as melderart,
       sm.kategorie, sm.beschreibung, sm.schwere, sm.status,
       (now() - sm.gemeldet_am)                                   as offen_seit,
       (select count(*) from velocity.wartungsauftrag w
         where w.schadensmeldung_id = sm.schadensmeldung_id)      as auftraege
  from velocity.schadensmeldung sm
  join velocity.fahrrad f on f.fahrrad_id = sm.fahrrad_id
  join velocity.fahrradmodell mo on mo.modell_id = f.modell_id
  join velocity.fahrradtyp    t  on t.typ_id = mo.typ_id
 where velocity.hat_rolle('werkstatt')
    or velocity.hat_rolle('leitung')
    or velocity.hat_rolle('demo');

comment on view velocity.v_wawi_schaden is
  'Arbeitssicht der Werkstatt: jede Schadensmeldung mit Rad, Schwere und '
  'Alter, unabhängig vom Bearbeitungsstand. Filtert selbst über '
  'velocity.hat_rolle. Seit dem Demozugang zusätzlich für '
  'velocity.hat_rolle(''demo'') lesbar (0020_demo_zugang.sql). Bewusst OHNE '
  'disposition (Spec 5.1 nennt nur '
  'werkstatt) - Gesamtprüfung Punkt 3: die Disposition sieht ihren Bedarf '
  'für die Flottenplanung, offene Schäden je Rad, bereits über '
  'v_wawi_flotte.offene_schaeden und .hoechste_schwere. Freitext '
  '(kategorie, beschreibung) und melderart braucht sie dafür nicht - "was '
  'niemand braucht, wird nicht ausgeliefert" (Spec 4.2). Ein früherer '
  'Entwurf liess disposition hier zusätzlich zu; das war derselbe '
  'Rechteüberschuss, der bei v_wawi_umsatz_radtyp weiter unten schon '
  'einmal zurückgenommen wurde.';
comment on column velocity.v_wawi_schaden.schadensmeldung_id is
  'Surrogatschlüssel, fachlich bedeutungslos und deshalb stabil.';
comment on column velocity.v_wawi_schaden.fahrrad_id is
  'Das gemeldete Rad.';
comment on column velocity.v_wawi_schaden.rahmennummer is
  'Am Rahmen ablesbare Nummer des gemeldeten Rades.';
comment on column velocity.v_wawi_schaden.typ_code is
  'Fahrradtyp des gemeldeten Rades, für Filter in der Werkstattliste.';
comment on column velocity.v_wawi_schaden.gemeldet_am is
  'Zeitpunkt der Meldung.';
comment on column velocity.v_wawi_schaden.melderart is
  '"Kunde" oder "Mitarbeiter" - wer gemeldet hat, nicht wer genau. Für die '
  'Werkstatt zählt nur die Herkunft der Meldung, eine Rückfrage läuft '
  'über den Kundenservice bzw. die Personalliste, nicht über diese Sicht.';
comment on column velocity.v_wawi_schaden.kategorie is
  'Freitextliche Grobeinordnung des Schadens, etwa Bremse oder Licht.';
comment on column velocity.v_wawi_schaden.beschreibung is
  'Freitext des Melders, was am Rad auffiel.';
comment on column velocity.v_wawi_schaden.schwere is
  'Einordnung der Dringlichkeit; fahruntauglich sperrt das Rad faktisch für '
  'die Werkstattplanung.';
comment on column velocity.v_wawi_schaden.status is
  'Bearbeitungsstand der Meldung: offen, in_arbeit, behoben oder verworfen.';
comment on column velocity.v_wawi_schaden.offen_seit is
  'Zeitspanne seit der Meldung bis jetzt - die Wartezeit, nicht ein fester '
  'Zeitpunkt, damit sie beim nächsten Aufruf automatisch weiterläuft.';
comment on column velocity.v_wawi_schaden.auftraege is
  'Zahl der Wartungsaufträge, die aus dieser Meldung entstanden sind. Mehr '
  'als einer zeigt einen wiederholten oder nachgebesserten Fall an.';

-- ---- Wartungsauftraege -----------------------------------------------
create or replace view velocity.v_wawi_auftrag as
select w.wartungsauftrag_id,
       w.auftragsnummer,
       w.fahrrad_id,
       f.rahmennummer,
       w.schadensmeldung_id,
       w.eroeffnet_am, w.erledigt_am, w.status,
       w.arbeitszeit_minuten, w.bemerkung,
       m.vorname || ' ' || m.nachname as bearbeiter
  from velocity.wartungsauftrag w
  join velocity.fahrrad f on f.fahrrad_id = w.fahrrad_id
  left join velocity.mitarbeiter m on m.mitarbeiter_id = w.mitarbeiter_id
 where velocity.hat_rolle('werkstatt')
    or velocity.hat_rolle('leitung')
    or velocity.hat_rolle('demo');

comment on view velocity.v_wawi_auftrag is
  'Arbeitssicht der Werkstatt: jeder Wartungsauftrag mit Rad, Bearbeiter und '
  'Bearbeitungsstand. Filtert selbst über velocity.hat_rolle. Seit dem '
  'Demozugang zusätzlich für velocity.hat_rolle(''demo'') lesbar '
  '(0020_demo_zugang.sql).';
comment on column velocity.v_wawi_auftrag.wartungsauftrag_id is
  'Surrogatschlüssel, fachlich bedeutungslos und deshalb stabil.';
comment on column velocity.v_wawi_auftrag.auftragsnummer is
  'Fachlicher, in der Werkstatt gesprochener Schlüssel des Auftrags.';
comment on column velocity.v_wawi_auftrag.fahrrad_id is
  'Das Rad, an dem gearbeitet wird.';
comment on column velocity.v_wawi_auftrag.rahmennummer is
  'Am Rahmen ablesbare Nummer des Rades, für den Werkstattzuruf ohne '
  'Nachschlagen.';
comment on column velocity.v_wawi_auftrag.schadensmeldung_id is
  'Auslösende Meldung. NULL bei einer geplanten Inspektion ohne konkreten '
  'Schaden.';
comment on column velocity.v_wawi_auftrag.eroeffnet_am is
  'Zeitpunkt der Auftragseröffnung.';
comment on column velocity.v_wawi_auftrag.erledigt_am is
  'Zeitpunkt des Abschlusses. NULL, solange der Auftrag läuft.';
comment on column velocity.v_wawi_auftrag.status is
  'Bearbeitungsstand des Auftrags: offen, in_arbeit, erledigt oder '
  'abgebrochen.';
comment on column velocity.v_wawi_auftrag.arbeitszeit_minuten is
  'Aufgewendete Werkstattzeit in Minuten. NULL, solange der Auftrag läuft.';
comment on column velocity.v_wawi_auftrag.bemerkung is
  'Freitext der Werkstatt zum Auftrag, etwa verbaute Ersatzteile ohne '
  'eigenen Lagerbezug.';
comment on column velocity.v_wawi_auftrag.bearbeiter is
  'Voller Name des zuständigen Werkstattmitarbeiters. NULL, solange der '
  'Auftrag noch niemandem zugeteilt ist.';

-- =====================================================================
-- Aufgabe 11: Auswertungssichten - Umsatz, Kilometer, CO2, Stationen
-- =====================================================================

-- ---- Umsatz nach Radtyp ----------------------------------------------
-- Monatsweise, weil eine Jahressumme keine Frage beantwortet, die
-- jemand tatsaechlich stellt.
-- ACHTUNG, teuer erkaufte Erkenntnis: hier steht sum(ep.betrag) und
-- NICHT sum(ep.betrag * ea.vorzeichen). fn_position_anlegen speichert
-- den Betrag bereits vorzeichenbehaftet (round(...) * v_art.vorzeichen).
-- Ein zweites Mal mit dem Vorzeichen zu multiplizieren dreht Rabatte,
-- Freiminuten und die Hoechstpreis-Kappung ins Positive und macht
-- Gutschriften zu Einnahmen. Der erste Entwurf dieses Plans tat genau
-- das, an neun Stellen. Gemessen am Referenzjahr haette es den Umsatz
-- von 35 387 auf 72 973 Euro aufgeblaeht - eine Ueberzeichnung um 106
-- Prozent, die keiner Plausibilitaetspruefung aufgefallen waere, weil
-- alle Zahlen gleichmaessig zu hoch gewesen waeren.
--
-- Der Join auf entgeltart bleibt trotzdem: die Sichten brauchen ihn
-- nicht fuer das Vorzeichen, aber spaetere Auswertungen nach Entgeltart
-- schon, und ohne ihn faellt beim Lesen nicht auf, dass es Positionen
-- mit negativem Betrag gibt.
create or replace view velocity.v_wawi_umsatz_radtyp as
select date_trunc('month', a.startzeit)::date              as monat,
       t.typ_code,
       t.bezeichnung                                       as typ,
       count(distinct a.ausleihe_id)                       as fahrten,
       sum(a.dauer_minuten)                                as minuten,
       round(sum(ep.betrag), 2)            as umsatz,
       round(sum(ep.betrag)
             / nullif(count(distinct a.ausleihe_id), 0), 2) as umsatz_je_fahrt
  from velocity.ausleihe a
  join velocity.entgeltposition ep using (ausleihe_id)
  join velocity.entgeltart      ea using (entgeltart_id)
  join velocity.fahrrad         f  on f.fahrrad_id = a.fahrrad_id
  join velocity.fahrradmodell   mo on mo.modell_id = f.modell_id
  join velocity.fahrradtyp      t  on t.typ_id     = mo.typ_id
 where a.status = 'abgeschlossen'
   -- Nur die Leitung. Die Spec gibt die Zusatzrolle disposition
   -- ausdruecklich nur der Stationsauslastung - dort braucht die
   -- Disposition sie fuer die taegliche Arbeit, beim Umsatz nicht. Der
   -- erste Entwurf liess disposition hier zusaetzlich zu; das war ein
   -- Rechteueberschuss, keine Vereinfachung.
   and (velocity.hat_rolle('leitung') or velocity.hat_rolle('demo'))
 group by 1, 2, 3;

comment on view velocity.v_wawi_umsatz_radtyp is
  'Monatsumsatz je Fahrradtyp, ausschliesslich für die Leitung - die Spec '
  'reserviert Auswertungen für diese Rolle, disposition bekommt nur die '
  'Stationsauslastung. sum(ep.betrag) ohne zweite Multiplikation mit '
  'vorzeichen - siehe Kommentar am create view. Filtert selbst über '
  'velocity.hat_rolle. Seit dem Demozugang zusätzlich für '
  'velocity.hat_rolle(''demo'') lesbar (0020_demo_zugang.sql) - eine '
  'Monatsaggregation ohne Personenbezug.';
comment on column velocity.v_wawi_umsatz_radtyp.monat is
  'Erster Tag des Monats der Fahrt (startzeit), Gruppierungsschlüssel für '
  'einen Zeitverlauf statt einer bedeutungslosen Jahressumme.';
comment on column velocity.v_wawi_umsatz_radtyp.typ_code is
  'Fachlicher Schlüssel des Fahrradtyps.';
comment on column velocity.v_wawi_umsatz_radtyp.typ is
  'Anzeigename des Fahrradtyps.';
comment on column velocity.v_wawi_umsatz_radtyp.fahrten is
  'Zahl der abgeschlossenen Ausleihen dieses Typs im Monat.';
comment on column velocity.v_wawi_umsatz_radtyp.minuten is
  'Summe der Fahrtdauer in Minuten, die Auslastungsseite neben dem Umsatz.';
comment on column velocity.v_wawi_umsatz_radtyp.umsatz is
  'Summe der Entgeltpositionen (ep.betrag), bereits vorzeichenbehaftet aus '
  'fn_position_anlegen. Keine zweite Multiplikation mit vorzeichen - das '
  'würde Rabatte und Kappungen zu Einnahmen machen, siehe Kopfkommentar.';
comment on column velocity.v_wawi_umsatz_radtyp.umsatz_je_fahrt is
  'umsatz geteilt durch fahrten, die Kennzahl für den Vergleich zwischen '
  'Radtypen unabhängig von deren Flottengrösse.';

-- ---- Umsatz nach Kundengruppe ----------------------------------------
-- Die Gruppe ist der Tarif zum Zeitpunkt der FAHRT, nicht der heutige.
-- Wer im Maerz Student war und im Juli nicht mehr, gehoert im Maerz zu
-- den Studenten - alles andere schriebe die Vergangenheit um.
create or replace view velocity.v_wawi_umsatz_kundengruppe as
select date_trunc('month', a.startzeit)::date   as monat,
       coalesce(tr.tarif_code, 'OHNE')          as tarif_code,
       coalesce(tr.bezeichnung, 'Ohne Mitgliedschaft') as tarif,
       count(distinct a.kunde_id)               as kunden,
       count(distinct a.ausleihe_id)            as fahrten,
       round(sum(ep.betrag), 2) as umsatz,
       round(sum(ep.betrag)
             / nullif(count(distinct a.kunde_id), 0), 2) as umsatz_je_kunde
  from velocity.ausleihe a
  join velocity.entgeltposition ep using (ausleihe_id)
  join velocity.entgeltart      ea using (entgeltart_id)
  left join velocity.mitgliedschaft m on m.mitgliedschaft_id = a.mitgliedschaft_id
  left join velocity.tarif         tr on tr.tarif_id = m.tarif_id
 where a.status = 'abgeschlossen'
   and (velocity.hat_rolle('leitung') or velocity.hat_rolle('demo'))
 group by 1, 2, 3;

comment on view velocity.v_wawi_umsatz_kundengruppe is
  'Monatsumsatz je Tarifgruppe für die Leitung. Die Gruppe ist der Tarif zum '
  'Zeitpunkt der Fahrt (a.mitgliedschaft_id), nicht der heutige - siehe '
  'Kommentar am create view. sum(ep.betrag) ohne zweite Multiplikation mit '
  'vorzeichen, wie bei v_wawi_umsatz_radtyp. Filtert selbst über '
  'velocity.hat_rolle. Seit dem Demozugang zusätzlich für '
  'velocity.hat_rolle(''demo'') lesbar (0020_demo_zugang.sql) - eine '
  'Gruppenaggregation (Tarifgruppe je Monat), kein Einzelkunde.';
comment on column velocity.v_wawi_umsatz_kundengruppe.monat is
  'Erster Tag des Monats der Fahrt.';
comment on column velocity.v_wawi_umsatz_kundengruppe.tarif_code is
  'Fachlicher Schlüssel des Tarifs zum Fahrtzeitpunkt, oder OHNE ohne '
  'zugeordnete Mitgliedschaft (etwa Einzelfahrten ohne Vertrag).';
comment on column velocity.v_wawi_umsatz_kundengruppe.tarif is
  'Anzeigename des Tarifs, oder "Ohne Mitgliedschaft" als Sammelgruppe.';
comment on column velocity.v_wawi_umsatz_kundengruppe.kunden is
  'Zahl der verschiedenen Kunden dieser Gruppe im Monat.';
comment on column velocity.v_wawi_umsatz_kundengruppe.fahrten is
  'Zahl der abgeschlossenen Ausleihen dieser Gruppe im Monat.';
comment on column velocity.v_wawi_umsatz_kundengruppe.umsatz is
  'Summe der Entgeltpositionen (ep.betrag), bereits vorzeichenbehaftet - siehe '
  'Kopfkommentar von v_wawi_umsatz_radtyp.';
comment on column velocity.v_wawi_umsatz_kundengruppe.umsatz_je_kunde is
  'umsatz geteilt durch kunden, die Kennzahl für den Vergleich zwischen '
  'Tarifgruppen unabhängig von deren Kundenzahl.';

-- ---- Strecke je Fahrt ------------------------------------------------
-- Hilfssicht. Sie traegt die einzige Stelle, an der geschaetzt wird -
-- und die Kennzeichnung, DASS geschaetzt wurde. Eine Kennzahl, die ihre
-- eigene Unsicherheit nicht mitliefert, ist fuer Marketing brauchbar
-- und fuer alles andere gefaehrlich.
--
-- Fix (Aufgabe 11, zweiter Durchgang): "create or replace view" darf nur
-- Spalten ANHAENGEN, nicht mittendrin einfuegen. v_wawi_km_co2 bekommt
-- unten die neue Spalte fahrten_geschaetzt zwischen kilometer und
-- anteil_geschaetzt - das waere mit "create or replace" gescheitert.
-- Deshalb hier ein "drop ... cascade": es reisst v_wawi_km_co2 mit, die
-- weiter unten in derselben Datei neu angelegt wird.
drop view if exists velocity.v_wawi_fahrt_km cascade;

create or replace view velocity.v_wawi_fahrt_km as
select a.ausleihe_id,
       a.startzeit,
       a.kunde_id,
       t.typ_code,
       -- Drei Faelle, und der dritte ist der Grund fuer diesen Block.
       -- Eine Rundfahrt endet dort, wo sie begann: ihre Luftlinie ist
       -- strukturell null, gefahren wurde trotzdem. Ohne den mittleren
       -- Zweig traegt rund jede zehnte Fahrt null Kilometer bei, die
       -- CO2-Ersparnis ist systematisch zu niedrig, und es faellt
       -- nirgends auf - der Anteil geschaetzter Fahrten sieht dabei
       -- voellig normal aus.
       case
         when a.distanz_km is not null then a.distanz_km
         when velocity.fn_luftlinie_km(
                coalesce(s1.latitude,  a.start_latitude),
                coalesce(s1.longitude, a.start_longitude),
                coalesce(s2.latitude,  a.end_latitude),
                coalesce(s2.longitude, a.end_longitude)) = 0
           then round(a.dauer_minuten / 60.0 * tempo.wert, 2)
         else round(velocity.fn_luftlinie_km(
                 coalesce(s1.latitude,  a.start_latitude),
                 coalesce(s1.longitude, a.start_longitude),
                 coalesce(s2.latitude,  a.end_latitude),
                 coalesce(s2.longitude, a.end_longitude)) * ra.wert, 2)
       end                      as kilometer,
       a.distanz_km is null     as ist_geschaetzt,
       -- WELCHES Verfahren geschaetzt hat, gehoert sichtbar in die
       -- Zeile. Zwei Schaetzungen, die dieselbe Spalte fuellen und sich
       -- unterschiedlich irren, muss man auseinanderhalten koennen.
       case when a.distanz_km is not null then 'gemessen'
            when velocity.fn_luftlinie_km(
                   coalesce(s1.latitude,  a.start_latitude),
                   coalesce(s1.longitude, a.start_longitude),
                   coalesce(s2.latitude,  a.end_latitude),
                   coalesce(s2.longitude, a.end_longitude)) = 0
              then 'aus_dauer'
            else 'aus_luftlinie'
       end                      as verfahren
  from velocity.ausleihe a
  join velocity.fahrrad       f  on f.fahrrad_id = a.fahrrad_id
  join velocity.fahrradmodell mo on mo.modell_id = f.modell_id
  join velocity.fahrradtyp    t  on t.typ_id     = mo.typ_id
  left join velocity.station s1 on s1.station_id = a.start_station_id
  left join velocity.station s2 on s2.station_id = a.end_station_id
  left join velocity.rechenannahme ra
         on ra.code = 'umwegfaktor' and ra.gueltigkeit @> a.startzeit::date
  left join velocity.rechenannahme tempo
         on tempo.code = 'reisegeschwindigkeit'
        and tempo.gueltigkeit @> a.startzeit::date
 where a.status = 'abgeschlossen'
   -- Gesamtpruefung Punkt 3: ist_mitarbeiter() allein liess jede
   -- Fachrolle durch, auch kundenservice - der eine Mitarbeiter mit
   -- NUR dieser Rolle liest damit ausleihe_id, kunde_id und startzeit
   -- je Einzelfahrt, also das Bewegungsprofil eines Kunden. Spec
   -- doku/specs/2026-08-25-velocity-warenwirtschaft-design.md, 4.2:
   -- "eine Liste von Fahrten mit Start, Ziel und Uhrzeit ist ein
   -- Bewegungsprofil. Der Kundenservice braucht es nicht ... Was
   -- niemand braucht, wird nicht ausgeliefert." Der vormalige Kommentar
   -- hier zitierte denselben Satz - "eine Sicht, die ihre Schranke von
   -- einer anderen erbt, hat keine eigene" - als Begruendung, WARUM
   -- diese Sicht KEINE eigene Rollenschranke braucht. Das war die
   -- falsche Schlussfolgerung aus dem richtigen Satz: v_wawi_km_co2
   -- aggregiert und hat ihre eigene hat_rolle('leitung')-Schranke exakt
   -- deshalb bekommen; die hier zugrundeliegende Einzelfahrt-Sicht
   -- brauchte dieselbe, hatte sie aber nicht.
   and velocity.hat_rolle('leitung');

-- ---- Kilometer und CO2 -----------------------------------------------
-- Die Ersparnis ist die Differenz zum Pkw, nicht die Emission des
-- Rades. Beide Faktoren kommen aus rechenannahme und gelten zum
-- Zeitpunkt der Fahrt - dieselbe Zeitscheibenlogik wie bei den Preisen.
create or replace view velocity.v_wawi_km_co2 as
select date_trunc('month', k.startzeit)::date as monat,
       k.typ_code,
       count(*)                                        as fahrten,
       round(sum(k.kilometer), 1)                      as kilometer,
       count(*) filter (where k.ist_geschaetzt)        as fahrten_geschaetzt,
       round(avg(case when k.ist_geschaetzt then 1.0 else 0.0 end), 3)
                                                       as anteil_geschaetzt,
       round(sum(k.kilometer * (pkw.wert - eigen.wert)) / 1000.0, 2)
                                                       as co2_ersparnis_kg
  from velocity.v_wawi_fahrt_km k
  join velocity.rechenannahme pkw
    on pkw.code = 'co2_pkw' and pkw.gueltigkeit @> k.startzeit::date
  join velocity.rechenannahme eigen
    on eigen.code = case when k.typ_code = 'CITY' then 'co2_rad' else 'co2_ebike' end
   and eigen.gueltigkeit @> k.startzeit::date
 where k.kilometer is not null
   -- Der Filter gehoert AUCH hierher, nicht nur in die zugrundeliegende
   -- Sicht. Die Spec reserviert die Auswertungen fuer die Leitung, und
   -- eine Sicht, die ihre Schranke ausschliesslich von einer anderen
   -- Sicht erbt, hat keine eigene. Der erste Entwurf verliess sich
   -- allein auf ist_mitarbeiter() aus v_wawi_fahrt_km und liess damit
   -- jede Fachrolle durch - ein kritischer Befund, siehe
   -- .superpowers/sdd/2026-08-25-velocity-warenwirtschaft-datenbank/
   -- aufgabe-11-fix-bericht.md. v_wawi_fahrt_km traegt seit der
   -- Gesamtpruefung dieselbe hat_rolle('leitung')-Schranke inzwischen
   -- selbst; die Zeile hier bleibt trotzdem stehen, statt sich darauf
   -- zu verlassen.
   -- KEIN "or velocity.hat_rolle('demo')" hier, anders als bei den
   -- anderen Auswertungssichten (0020_demo_zugang.sql) - nachgemessen
   -- WIRKUNGSLOS gewesen waere es ohnehin: diese Sicht liest FROM
   -- velocity.v_wawi_fahrt_km, und deren EIGENE WHERE-Klausel verlangt
   -- unveraendert 'leitung' (siehe deren Kommentar). Der Filter dort
   -- greift fuer JEDEN Aufrufer, unabhaengig davon, was hier steht -
   -- v_wawi_km_co2 aus Sicht ihres Eigentuemers postgres liest
   -- v_wawi_fahrt_km zwar mit dessen RECHTEN (kein "permission denied"),
   -- aber velocity.hat_rolle() darin wertet trotzdem auth.uid() DES
   -- AUFRUFERS aus, nicht das des Eigentuemers - ein "or hat_rolle('demo')"
   -- an dieser Stelle haette dennoch fuer die reine demo-Rolle null
   -- Zeilen geliefert, aber vorgetaeuscht, das laege an fehlenden Daten
   -- statt an einer Rechteschranke. tests/t0020_demo_zugang.sql prueft
   -- das leer sein fuer 'demo' deshalb ausdruecklich mit, und
   -- wawi/auswertungen.js blendet den Reiter "Kilometer und CO2"
   -- fuer 'demo' konsequent aus, statt eine leere Tafel zu zeigen.
   and velocity.hat_rolle('leitung')
 group by 1, 2;

comment on view velocity.v_wawi_fahrt_km is
  'Einzige Stelle, an der Strecken geschätzt werden. ist_geschaetzt sagt, ob; '
  'verfahren sagt, WOMIT. Trägt seit der Gesamtprüfung vom 25.08.2026 eine '
  'eigene velocity.hat_rolle(''leitung'')-Schranke statt nur '
  'velocity.ist_mitarbeiter(): die Zeilen führen ausleihe_id, kunde_id und '
  'startzeit je Einzelfahrt, also ein Bewegungsprofil - Spec 4.2 gibt das '
  'ausdrücklich nur der Leitung, nicht jeder Fachrolle. Der frühere Stand '
  'begründete das Fehlen der eigenen Schranke mit demselben Satz, der hier '
  'jetzt für das Gegenteil steht: eine Sicht, die ihre Schranke von einer '
  'anderen erbt, hat keine eigene. Traegt AUS DEMSELBEN GRUND KEIN '
  'velocity.hat_rolle(''demo'') (0020_demo_zugang.sql) - ohnehin fuer '
  'authenticated vollstaendig entzogen (siehe unten), aber selbst fuer den '
  'einzigen verbleibenden Zugriffsweg ueber v_wawi_km_co2 waere ein '
  'Bewegungsprofil das Letzte, was ein oeffentlich beworbener Zugang lesen '
  'darf.';
comment on column velocity.v_wawi_fahrt_km.ausleihe_id is
  'Schlüssel der Fahrt, für den Verweis aus v_wawi_km_co2 auf die einzelne '
  'Ausleihe hinter der Aggregation.';
comment on column velocity.v_wawi_fahrt_km.startzeit is
  'Beginn der Fahrt, Grundlage der Monatsgruppierung und der Zeitscheibe für '
  'Umwegfaktor, Reisegeschwindigkeit und CO2-Annahmen (rechenannahme.gueltigkeit).';
comment on column velocity.v_wawi_fahrt_km.kunde_id is
  'Fahrender Kunde, für eine spätere Auswertung je Kunde ohne erneuten Join '
  'auf ausleihe.';
comment on column velocity.v_wawi_fahrt_km.typ_code is
  'Fahrradtyp der Fahrt, bestimmt in v_wawi_km_co2 die passende CO2-Annahme '
  '(co2_rad für CITY, sonst co2_ebike).';
comment on column velocity.v_wawi_fahrt_km.kilometer is
  'Drei Fälle, siehe verfahren: gemessene Strecke (ausleihe.distanz_km), wo '
  'vorhanden; sonst, bei einer Rundfahrt mit Luftlinie null (Start- und '
  'Endpunkt gleich), aus der Dauer geschätzt (rechenannahme '
  'reisegeschwindigkeit); sonst aus der Luftlinie zwischen Start- und '
  'Endpunkt mal Umwegfaktor (rechenannahme). NULL, wenn weder Distanz noch '
  'beide Koordinatenpaare vorliegen - eine erfundene Zahl aus einem halben '
  'Koordinatenpaar wäre schlimmer als keine.';
comment on column velocity.v_wawi_fahrt_km.ist_geschaetzt is
  'Wahr, wenn kilometer nicht gemessen wurde (verfahren aus_dauer oder '
  'aus_luftlinie). Gehört zu jeder Verwendung von kilometer dazu, siehe '
  'Kopfkommentar der Sicht.';
comment on column velocity.v_wawi_fahrt_km.verfahren is
  'gemessen, aus_dauer oder aus_luftlinie - WOMIT kilometer ermittelt wurde. '
  'Nötig, weil ist_geschaetzt allein zwei verschiedene Schätzverfahren in '
  'einen Topf würfe: aus_dauer (Rundfahrten, Luftlinie strukturell null, '
  'Reisegeschwindigkeit als Grundlage) und aus_luftlinie (Luftlinie mal '
  'Umwegfaktor) irren sich auf unterschiedliche Weise und müssen sich '
  'getrennt auswerten lassen.';
comment on view velocity.v_wawi_km_co2 is
  'CO2-Ersparnis gegenüber dem Pkw, ausschliesslich für die Leitung - eigener '
  'Rollenfilter (hat_rolle(''leitung'')), nicht nur geerbt aus '
  'v_wawi_fahrt_km. anteil_geschaetzt und fahrten_geschaetzt gehören in jede '
  'Darstellung dieser Zahl. OHNE velocity.hat_rolle(''demo'') (0020_demo_zugang.sql), '
  'anders als die uebrigen Auswertungssichten - nicht aus Datenschutzgruenden '
  '(die Zahlen hier sind eine Monatsaggregation ohne Personenbezug), sondern '
  'weil es wirkungslos waere: diese Sicht liest FROM v_wawi_fahrt_km, deren '
  'eigene WHERE-Klausel fuer JEDEN Aufrufer ''leitung'' verlangt - siehe '
  'Kopfkommentar am create view fuer die nachgemessene Begruendung.';
comment on column velocity.v_wawi_km_co2.monat is
  'Erster Tag des Monats der Fahrt (v_wawi_fahrt_km.startzeit).';
comment on column velocity.v_wawi_km_co2.typ_code is
  'Fahrradtyp, bestimmt die verglichene Eigenemission (co2_rad vs. co2_ebike).';
comment on column velocity.v_wawi_km_co2.fahrten is
  'Zahl der Fahrten mit bekannter oder geschätzter Kilometerzahl in diesem '
  'Monat und Typ. Nenner für anteil_geschaetzt.';
comment on column velocity.v_wawi_km_co2.kilometer is
  'Summe der gefahrenen Kilometer, gemessen und geschätzt gemeinsam - '
  'anteil_geschaetzt und fahrten_geschaetzt sagen, wie viel davon Schätzung '
  'ist.';
comment on column velocity.v_wawi_km_co2.fahrten_geschaetzt is
  'Zähler zu anteil_geschaetzt: Anzahl der Fahrten dieser Zeile mit '
  'geschätzter statt gemessener Kilometerzahl. Nötig, weil ein einfaches '
  'Mittel von anteil_geschaetzt über mehrere Zeilen NICHT den '
  'fahrtgewichteten Gesamtanteil ergibt, sobald die Zeilen unterschiedlich '
  'gross sind (hier: 1 bis über 1000 Fahrten je Monat/Typ) - wer richtig '
  'gewichten will, summiert fahrten_geschaetzt und fahrten getrennt und '
  'teilt erst danach.';
comment on column velocity.v_wawi_km_co2.anteil_geschaetzt is
  'Anteil der Fahrten DIESER ZEILE, deren Kilometer geschätzt statt gemessen '
  'wurden (0 bis 1) - keine über Zeilen gemittelte Kennzahl. Ein arithmetisches '
  'Mittel dieser Spalte über mehrere Monate/Typen ist NICHT der '
  'Gesamtanteil, weil die Zeilen sehr unterschiedlich viele Fahrten tragen '
  '(1 bis über 1000); dafür fahrten_geschaetzt verwenden. Ohne diese Spalte '
  'wäre kilometer eine Zahl ohne Herkunftsangabe - sie ist die Unsicherheit '
  'von kilometer und co2_ersparnis_kg, kein optionales Detail.';
comment on column velocity.v_wawi_km_co2.co2_ersparnis_kg is
  'Differenz zwischen der CO2-Last eines vergleichbaren Pkw und der des '
  'tatsächlich genutzten Fahrzeugs (rechenannahme co2_pkw minus co2_rad bzw. '
  'co2_ebike, beide in g CO2e/Pkm, daher /1000 für kg) für die gefahrenen '
  'Kilometer dieser Zeile. Basiert teilweise auf geschätzten Kilometern - '
  'siehe anteil_geschaetzt und fahrten_geschaetzt, ohne die diese Zahl '
  'unbelegt wäre.';

-- ---- Stationsauslastung ----------------------------------------------
-- Zu- und Abgaenge zaehlen ausschliesslich abgeschlossene Ausleihen: eine
-- laufende Fahrt hat noch keinen Zugang an ihrer Endstation.
create or replace view velocity.v_wawi_stationsauslastung as
select s.station_id,
       s.stationsnummer,
       s.name,
       s.kapazitaet,
       (select count(*) from velocity.ausleihe a
         where a.start_station_id = s.station_id and a.status = 'abgeschlossen') as abgaenge,
       (select count(*) from velocity.ausleihe a
         where a.end_station_id = s.station_id and a.status = 'abgeschlossen')   as zugaenge,
       (select count(*) from velocity.ausleihe a
         where a.end_station_id = s.station_id and a.status = 'abgeschlossen')
       - (select count(*) from velocity.ausleihe a
           where a.start_station_id = s.station_id and a.status = 'abgeschlossen') as saldo,
       (select count(*) from velocity.fahrrad_position fp
         where fp.station_id = s.station_id)                                     as belegt,
       round((select count(*) from velocity.fahrrad_position fp
               where fp.station_id = s.station_id)::numeric
             / nullif(s.kapazitaet, 0), 3)                                       as fuellstand
  from velocity.station s
 where velocity.hat_rolle('disposition') or velocity.hat_rolle('leitung')
    or velocity.hat_rolle('demo');

comment on view velocity.v_wawi_stationsauslastung is
  'Zu- und Abgaenge sowie aktueller Fuellstand je Station, für Disposition '
  'und Leitung. Zählt ausschliesslich abgeschlossene Ausleihen - eine '
  'laufende Fahrt hat an ihrer Endstation noch keinen Zugang. Filtert selbst '
  'über velocity.hat_rolle. Seit dem Demozugang zusätzlich für '
  'velocity.hat_rolle(''demo'') lesbar (0020_demo_zugang.sql).';
comment on column velocity.v_wawi_stationsauslastung.station_id is
  'Schlüssel der Station.';
comment on column velocity.v_wawi_stationsauslastung.stationsnummer is
  'Fachlicher Schlüssel der Station.';
comment on column velocity.v_wawi_stationsauslastung.name is
  'Anzeigename der Station.';
comment on column velocity.v_wawi_stationsauslastung.kapazitaet is
  'Zahl der Stellplätze laut Stammdaten, Nenner von fuellstand.';
comment on column velocity.v_wawi_stationsauslastung.abgaenge is
  'Zahl der abgeschlossenen Ausleihen, die an dieser Station begonnen haben - '
  'wie oft ein Rad hier abgeholt wurde.';
comment on column velocity.v_wawi_stationsauslastung.zugaenge is
  'Zahl der abgeschlossenen Ausleihen, die an dieser Station geendet haben - '
  'wie oft ein Rad hier abgestellt wurde.';
comment on column velocity.v_wawi_stationsauslastung.saldo is
  'zugaenge minus abgaenge. Positiv heisst, die Station sammelt über die Zeit '
  'mehr Räder an, als sie abgibt - ein Hinweis für die Disposition, wo '
  'nachverteilt werden muss.';
comment on column velocity.v_wawi_stationsauslastung.belegt is
  'Zahl der Räder, die aktuell laut fahrrad_position an dieser Station '
  'stehen - der Momentanwert, anders als abgaenge/zugaenge, die über die '
  'gesamte Historie zählen.';
comment on column velocity.v_wawi_stationsauslastung.fuellstand is
  'belegt geteilt durch kapazitaet, gerundet auf drei Nachkommastellen. NULL '
  'bei einer Station ohne Stellplätze (kapazitaet = 0), was laut '
  'station_kapazitaet_chk nicht vorkommen sollte, aber nullif schützt vor '
  'einer Division durch null statt einem Fehler ohne Kontext.';

-- =====================================================================
-- Aufgabe 3 (Oberflaechenplan): v_wawi_modell - die fehlende Sicht auf
-- die Radmodelle
-- =====================================================================

-- ---- Radmodelle -------------------------------------------------------
-- Eine Sicht fuer eine EINGABEmaske, nicht fuer eine Auswertung. Sie ist
-- beim Bau der Oberflaeche entstanden, weil api_rad_anlegen eine
-- modell_id verlangt und keine Sicht sie herausgab - der einzige Ausweg
-- waere ein Zugriff auf die Basistabelle gewesen, und den gibt es nicht.
--
-- Der Fehler dahinter ist lehrreich: die Sichten aus Schritt 1 wurden aus
-- den Auswertungen abgeleitet, nicht aus den Eingaben. Eine Maske
-- braucht mehr als eine Liste - sie braucht auch das, was in ihre
-- Auswahlfelder gehoert.
create or replace view velocity.v_wawi_modell as
select mo.modell_id,
       h.name                as hersteller,
       mo.modellbezeichnung,
       t.typ_id,
       t.typ_code,
       t.bezeichnung         as typ,
       t.hat_elektro,
       t.zuladung_kg,
       -- Wie viele Raeder dieses Modells schon im Bestand sind. In einer
       -- Auswahlliste ist das die nuetzlichste Zusatzangabe: sie sagt,
       -- was ueblich ist, ohne dass jemand nachsehen muss.
       (select count(*) from velocity.fahrrad f
         where f.modell_id = mo.modell_id and f.status <> 'ausgemustert')
                             as raeder_im_bestand,
       -- Nachtraeglich ans Ende angefuegt (CREATE OR REPLACE VIEW darf
       -- bestehende Spalten weder verschieben noch umbenennen), aus
       -- demselben Anlass wie bei v_wawi_flotte: die Stammdaten tragen
       -- inzwischen mehr als Namen. baujahr bleibt je Modellzeile
       -- (Hersteller), die fuenf technischen Werte kommen seit der
       -- Produktkorrektur aus fahrradtyp - siehe deren Spaltenkommentare.
       mo.baujahr, t.gewicht_kg, t.gangzahl, t.rahmenhoehe_cm,
       t.akkukapazitaet_wh, t.reichweite_km
  from velocity.fahrradmodell mo
  join velocity.hersteller    h on h.hersteller_id = mo.hersteller_id
  join velocity.fahrradtyp    t on t.typ_id        = mo.typ_id
 where velocity.hat_rolle('disposition')
    or velocity.hat_rolle('leitung')
    or velocity.hat_rolle('demo');

comment on view velocity.v_wawi_modell is
  'Auswahlliste für die Radanlage. Entstanden beim Bau der Oberfläche, weil api_rad_anlegen eine modell_id verlangt und keine Sicht sie herausgab. Seit dem Demozugang zusätzlich für velocity.hat_rolle(''demo'') lesbar (0020_demo_zugang.sql) - der Demozugang liest die Auswahlliste ohnehin nie schreibend weiter, siehe dort.';
comment on column velocity.v_wawi_modell.modell_id is
  'Schlüssel des Modells, der Wert, den api_rad_anlegen als p_modell_id erwartet.';
comment on column velocity.v_wawi_modell.hersteller is
  'Name des Herstellers, für die Auswahlliste ohne Nachschlagen einer Nummer.';
comment on column velocity.v_wawi_modell.modellbezeichnung is
  'Der Produktname, identisch mit dem Anzeigenamen des Typs (Spalte typ) - '
  'zusammen mit hersteller die lesbare Kennung des Eintrags, weil mehrere '
  'Hersteller dasselbe Produkt zur selben Spezifikation liefern können.';
comment on column velocity.v_wawi_modell.typ_id is
  'Schlüssel des Fahrradtyps, falls die Oberfläche danach filtert oder '
  'gruppiert.';
comment on column velocity.v_wawi_modell.typ_code is
  'Fachlicher Schlüssel des Fahrradtyps.';
comment on column velocity.v_wawi_modell.typ is
  'Anzeigename des Fahrradtyps.';
comment on column velocity.v_wawi_modell.hat_elektro is
  'Wahr bei einem Modell mit Elektroantrieb - hilft der Auswahlliste, City- '
  'von E-Bike-Modellen zu unterscheiden, ohne den Typnamen zu parsen.';
comment on column velocity.v_wawi_modell.zuladung_kg is
  'Maximale Zuladung des Fahrradtyps laut Stammdaten. NULL, wenn der Typ '
  'keine Zuladungsgrenze führt.';
comment on column velocity.v_wawi_modell.baujahr is
  'Baujahr laut Stammdaten - das Jahr, seit dem der Hersteller dieser Modellzeile den Typ beliefert.';
comment on column velocity.v_wawi_modell.gewicht_kg is
  'Leergewicht des Fahrradtyps laut Stammdaten - gilt für jedes Modell dieses Typs gleich, unabhängig vom Hersteller.';
comment on column velocity.v_wawi_modell.gangzahl is
  'Zahl der Gänge des Fahrradtyps laut Stammdaten - gilt für jedes Modell dieses Typs gleich, unabhängig vom Hersteller.';
comment on column velocity.v_wawi_modell.rahmenhoehe_cm is
  'Rahmenhöhe des Fahrradtyps laut Stammdaten - eine Größe je Typ, individuelle Anpassung läuft über den Sattel-Schnellspanner.';
comment on column velocity.v_wawi_modell.akkukapazitaet_wh is
  'Akkukapazität des Fahrradtyps laut Stammdaten. NULL bei einem Modell ohne Elektroantrieb.';
comment on column velocity.v_wawi_modell.reichweite_km is
  'Herstellerangabe zur Reichweite des Fahrradtyps laut Stammdaten. NULL bei einem Modell ohne Elektroantrieb.';
comment on column velocity.v_wawi_modell.raeder_im_bestand is
  'Zahl der nicht ausgemusterten Räder dieses Modells im Bestand - zeigt an, '
  'was üblich ist, ohne dass jemand in der Flottensicht nachsehen muss.';

-- Jetzt, und nicht in 0003_bereich_b_netz_und_flotte.sql: die fuenf
-- technischen Spalten muessen auch von fahrradmodell verschwinden, falls
-- eine bestehende Datenbank sie dort noch aus dem ersten Anlauf traegt
-- (siehe deren Kopfkommentar) - aber "alter table ... drop column"
-- scheitert, solange eine Sicht von der Spalte abhaengt, und genau das
-- taten v_wawi_flotte und v_wawi_modell bis zu den beiden CREATE OR
-- REPLACE VIEW weiter oben in dieser Datei. Erst NACH beiden Ersetzungen
-- ist die Abhaengigkeit weg und die Spalten koennen fallen. drop column
-- if exists ist idempotent und nimmt die betroffenen CHECK-Constraints
-- automatisch mit.
alter table velocity.fahrradmodell drop column if exists gewicht_kg;
alter table velocity.fahrradmodell drop column if exists gangzahl;
alter table velocity.fahrradmodell drop column if exists rahmenhoehe_cm;
alter table velocity.fahrradmodell drop column if exists akkukapazitaet_wh;
alter table velocity.fahrradmodell drop column if exists reichweite_km;

-- =====================================================================
-- Drill-Down-Aufgabe: v_wawi_fahrten_je_tag - Tagesaggregation für die
-- Säulengrafik hinter einem angeklickten Monat
-- =====================================================================

-- ---- Fahrten je Tag ---------------------------------------------------
-- Der fachlich heikle Punkt zuerst, weil er die ganze Sicht bestimmt:
-- v_wawi_fahrt_km (Einzelfahrten mit kunde_id und Zeitstempel) wurde
-- authenticated kürzlich ausdrücklich ENTZOGEN, weil eine Liste von
-- Fahrten mit Uhrzeit ein Bewegungsprofil ist (siehe deren Kopfkommentar
-- weiter oben). "Am 4. September gab es 61 Fahrten" ist etwas anderes -
-- eine TAGESSUMME ohne Personenbezug lässt sich nicht zu einer
-- Einzelfahrt zurückrechnen. Die Grenze sitzt deshalb HIER in der Sicht
-- selbst (group by date_trunc('day', ...), keine ausleihe_id, keine
-- kunde_id, keine Uhrzeit in der Ausgabe), nicht nur in diesem Kommentar
-- - dieselbe Lehre wie beim vormaligen Fehlversuch bei v_wawi_fahrt_km:
-- eine Schranke, die nur behauptet wird, ist keine.
--
-- Bewusst OHNE Radtyp-Spalte: der Drill-Down aus einer Monatszeile
-- beantwortet "wie viele Fahrten gab es an diesem Tag insgesamt" - genau
-- die Frage, die der Auftrag mit den Referenzzahlen stellt (September
-- 2025: 34 bis 61, Spitzentag der 4.). Er fragt nicht "wie viele
-- City-Bike-Fahrten", und die Oberfläche zeigt die Tagesgrafik deshalb
-- für JEDE angeklickte Monatszeile gleich, unabhängig vom Radtyp/Tarif
-- dieser Zeile (siehe monatsdrilldownEinfuegen() in auswertungen.js) -
-- eine zusätzliche Gruppierung nach typ_code würde eine Frage
-- beantworten, die niemand gestellt hat, und nur die Gegenprobe unten
-- verkomplizieren: OHNE Radtyp-Spalte muss die Tagessumme eines Monats
-- unabhängig davon, ob man v_wawi_umsatz_radtyp, v_wawi_umsatz_kundengruppe
-- oder v_wawi_km_co2 über den Monat aufsummiert, immer dieselbe Zahl
-- ergeben - drei voneinander unabhängige Kontrollrechnungen zu einer
-- Sicht, nicht nur eine.
create or replace view velocity.v_wawi_fahrten_je_tag as
select date_trunc('day', a.startzeit)::date as tag,
       count(distinct a.ausleihe_id)        as fahrten
  from velocity.ausleihe a
 where a.status = 'abgeschlossen'
   and (velocity.hat_rolle('leitung') or velocity.hat_rolle('demo'))
 group by 1;

comment on view velocity.v_wawi_fahrten_je_tag is
  'Tagesaggregation der abgeschlossenen Fahrten für den Drill-Down aus einer '
  'angeklickten Monatszeile der Auswertungen. Absichtlich ohne Personenbezug: '
  'keine ausleihe_id, keine kunde_id, keine Uhrzeit - eine Tagessumme ist kein '
  'Bewegungsprofil, anders als v_wawi_fahrt_km (siehe deren Kopfkommentar). '
  'Bewusst ohne Radtyp-Spalte, siehe Kommentar am create view. Filtert selbst '
  'über velocity.hat_rolle(''leitung''), dieselbe Rolle wie die drei '
  'Monatssichten, aus denen heraus der Drill-Down aufgerufen wird. Seit dem '
  'Demozugang zusätzlich für velocity.hat_rolle(''demo'') lesbar '
  '(0020_demo_zugang.sql).';
comment on column velocity.v_wawi_fahrten_je_tag.tag is
  'Kalendertag der Fahrt (startzeit), die x-Achse der Säulengrafik. Ein Tag '
  'ohne abgeschlossene Fahrt taucht hier NICHT als Zeile auf - die Oberfläche '
  'muss ihn selbst als null Fahrten ergänzen, sonst sieht eine echte Lücke im '
  'Betrieb wie ein Ladefehler aus (siehe monatsdrilldownEinfuegen() in '
  'auswertungen.js).';
comment on column velocity.v_wawi_fahrten_je_tag.fahrten is
  'Zahl der an diesem Tag abgeschlossenen Ausleihen, dieselbe Zählweise '
  '(count(distinct ausleihe_id) where status = ''abgeschlossen'') wie in '
  'v_wawi_umsatz_radtyp/v_wawi_umsatz_kundengruppe/v_wawi_km_co2 - die Summe '
  'dieser Spalte über einen Monat muss deshalb die fahrten-Summe der '
  'passenden Zeilen jeder der drei Monatssichten ergeben. Genau das prüft '
  'test_v_fahrten_je_tag_stimmt_mit_monatssichten_ueberein in '
  't0018_wawi_sichten.sql als wichtigste Zusicherung dieser Sicht.';

-- =====================================================================
-- "Sichten verweben" (Gestaltungsauftrag Punkt 2b): v_wawi_fahrten_je_tag_rad
-- - die dritte Ebene des Drill-Downs (Monat -> Tag -> Räder)
-- =====================================================================

-- ---- Fahrten je Tag und Rad --------------------------------------------
-- Wörtlich der Auftrag: "ein Klick auf das Datum würde die weiteren
-- Infos offenlegen, nämlich welche Instanzen der Räder an diesem Tag
-- gefahren sind, mit allen Detaildaten." Diese Sicht ist genau das -
-- eine Zeile je Fahrt eines Tages, aber vom RAD her gesehen, nicht vom
-- Kunden her.
--
-- DIE FACHLICHE GRENZE (der wichtigste Teil dieser Sicht, wortgleich zum
-- Anlass bei v_wawi_fahrt_km oben): eine Liste von Fahrten mit kunde_id
-- und Zeitstempel ist ein Bewegungsprofil - deshalb wurde v_wawi_fahrt_km
-- weiter oben authenticated ausdrücklich ENTZOGEN. Ein Fahrtenverlauf JE
-- RAD ist etwas anderes: ein Fahrrad ist keine Person, und "Rahmennummer
-- FR-1234 stand am 4. September zweimal an Station Marktplatz" ist
-- Flottenbetrieb, kein Bewegungsprofil eines Menschen - dieselben
-- Fahrten, nur nach Rad statt nach Kunde geschnitten, sind deshalb
-- zulässig. Die Grenze sitzt, wie bei v_wawi_fahrten_je_tag, in der
-- SPALTENLISTE selbst, nicht nur in diesem Kommentar: keine kunde_id,
-- keine kundennummer, kein Name, keine ausleihe_id (die ließe sich über
-- v_wawi_fahrt_km - dort ohnehin nur für leitung lesbar - wieder auf eine
-- Person zurückführen) - nichts, worüber sich ein Kunde herstellen ließe.
-- Rahmennummer, Radtyp, Start-/Zielstation, Dauer und Strecke bleiben,
-- weil die Disposition genau das für die tägliche Flottensteuerung
-- braucht (welches Rad war wo, wie lange, wie weit).
--
-- KEIN JOIN AUF v_wawi_fahrt_km, obwohl die Kilometerformel von dort
-- eins zu eins übernommen ist: jene Sicht trägt selbst
-- "and velocity.hat_rolle('leitung')" in ihrer eigenen WHERE-Klausel. Ein
-- Join hierher würde für ein Konto mit NUR disposition (ohne leitung) an
-- dieser Stelle für JEDE Zeile null Treffer liefern, obwohl die
-- WHERE-Klausel DIESER Sicht disposition ausdrücklich zulässt (siehe
-- ROLLE unten) - eine Sicht würde so ungewollt die engere Schranke einer
-- anderen erben. Die Drei-Fall-Formel steht deshalb ein zweites Mal hier,
-- Zeile für Zeile identisch zu v_wawi_fahrt_km.kilometer.
--
-- ROLLE: leitung UND disposition, nicht nur eine von beiden. leitung
-- erreicht diese Sicht über den bestehenden Drill-Down-Pfad (Auswertungen
-- -> Monat -> Tag), der lückenlos auf hat_rolle('leitung') steht
-- (v_wawi_umsatz_radtyp/_kundengruppe, v_wawi_km_co2,
-- v_wawi_fahrten_je_tag) - ohne diese Rolle liefe der dritte Klick für
-- genau die Rolle ins Leere, die die ersten beiden Ebenen überhaupt erst
-- sehen darf. disposition kommt DAZU: das ist die im Gestaltungsauftrag
-- ausdrücklich benannte Rolle für die tägliche Flottensteuerung (sie
-- sieht bereits v_wawi_flotte, v_wawi_station und
-- v_wawi_stationsauslastung), und diese Sicht trägt - anders als
-- v_wawi_umsatz_radtyp/_kundengruppe/v_wawi_km_co2, die bewusst NUR
-- leitung bekommen - weder Umsatz noch irgendeinen Kundenbezug, der eine
-- Erweiterung über leitung hinaus rechtfertigungsbedürftig machen würde.
create or replace view velocity.v_wawi_fahrten_je_tag_rad as
select date_trunc('day', a.startzeit)::date as tag,
       f.fahrrad_id,
       f.rahmennummer,
       t.typ_code,
       t.bezeichnung        as typ,
       s1.name              as start_station,
       s2.name              as ziel_station,
       a.dauer_minuten,
       -- Identische Drei-Fall-Formel wie velocity.v_wawi_fahrt_km.kilometer
       -- weiter oben - siehe "KEIN JOIN" im Kopfkommentar, warum sie hier
       -- kopiert statt wiederverwendet steht.
       case
         when a.distanz_km is not null then a.distanz_km
         when velocity.fn_luftlinie_km(
                coalesce(s1.latitude,  a.start_latitude),
                coalesce(s1.longitude, a.start_longitude),
                coalesce(s2.latitude,  a.end_latitude),
                coalesce(s2.longitude, a.end_longitude)) = 0
           then round(a.dauer_minuten / 60.0 * tempo.wert, 2)
         else round(velocity.fn_luftlinie_km(
                 coalesce(s1.latitude,  a.start_latitude),
                 coalesce(s1.longitude, a.start_longitude),
                 coalesce(s2.latitude,  a.end_latitude),
                 coalesce(s2.longitude, a.end_longitude)) * ra.wert, 2)
       end                  as kilometer,
       a.distanz_km is null as ist_geschaetzt
  from velocity.ausleihe a
  join velocity.fahrrad       f  on f.fahrrad_id = a.fahrrad_id
  join velocity.fahrradmodell mo on mo.modell_id = f.modell_id
  join velocity.fahrradtyp    t  on t.typ_id     = mo.typ_id
  left join velocity.station s1 on s1.station_id = a.start_station_id
  left join velocity.station s2 on s2.station_id = a.end_station_id
  left join velocity.rechenannahme ra
         on ra.code = 'umwegfaktor' and ra.gueltigkeit @> a.startzeit::date
  left join velocity.rechenannahme tempo
         on tempo.code = 'reisegeschwindigkeit'
        and tempo.gueltigkeit @> a.startzeit::date
 where a.status = 'abgeschlossen'
   and (velocity.hat_rolle('leitung') or velocity.hat_rolle('disposition')
     or velocity.hat_rolle('demo'));

comment on view velocity.v_wawi_fahrten_je_tag_rad is
  'Dritte Ebene des Drill-Downs (Monat -> Tag -> Räder): jede an einem Tag '
  'abgeschlossene Fahrt, vom RAD her gesehen statt vom Kunden - Flottenbetrieb, '
  'kein Bewegungsprofil. Bewusst OHNE ausleihe_id, kunde_id, kundennummer oder '
  'Name: dieselben Fahrten wie v_wawi_fahrten_je_tag, nach Rad statt nach Kunde '
  'geschnitten - siehe ausführlicher Kopfkommentar am create view für die '
  'Begründung dieser Grenze. Kein Join auf v_wawi_fahrt_km (deren eigene '
  'hat_rolle(''leitung'')-Schranke würde disposition sonst ungewollt '
  'ausschließen) - die Kilometerformel steht deshalb ein zweites Mal hier. '
  'Filtert selbst über velocity.hat_rolle(''leitung'') oder '
  'velocity.hat_rolle(''disposition''). Seit dem Demozugang zusätzlich für '
  'velocity.hat_rolle(''demo'') lesbar (0020_demo_zugang.sql).';
comment on column velocity.v_wawi_fahrten_je_tag_rad.tag is
  'Kalendertag der Fahrt (startzeit) - derselbe Wert wie '
  'v_wawi_fahrten_je_tag.tag, hier je Fahrt statt aggregiert. Für die '
  'Oberfläche der PostgREST-Filterschlüssel dieser Sicht (tag=eq.JJJJ-MM-TT).';
comment on column velocity.v_wawi_fahrten_je_tag_rad.fahrrad_id is
  'Schlüssel des Rades, für den Sprung von dieser Zeile in die Flottensicht '
  '(v_wawi_flotte) - der Querverweis aus dem Gestaltungsauftrag Punkt 3.';
comment on column velocity.v_wawi_fahrten_je_tag_rad.rahmennummer is
  'Am Rahmen ablesbare Nummer, der Bezug zum physischen Rad vor Ort.';
comment on column velocity.v_wawi_fahrten_je_tag_rad.typ_code is
  'Fachlicher Schlüssel des Fahrradtyps.';
comment on column velocity.v_wawi_fahrten_je_tag_rad.typ is
  'Anzeigename des Fahrradtyps.';
comment on column velocity.v_wawi_fahrten_je_tag_rad.start_station is
  'Name der Station, an der die Fahrt begann. NULL bei freiem Abstellort als '
  'Startpunkt.';
comment on column velocity.v_wawi_fahrten_je_tag_rad.ziel_station is
  'Name der Station, an der die Fahrt endete. NULL bei freiem Abstellort als '
  'Zielpunkt.';
comment on column velocity.v_wawi_fahrten_je_tag_rad.dauer_minuten is
  'Dauer der Fahrt in Minuten.';
comment on column velocity.v_wawi_fahrten_je_tag_rad.kilometer is
  'Gefahrene Strecke - gemessen oder geschätzt, siehe ist_geschaetzt und die '
  'Drei-Fall-Formel im Kopfkommentar (identisch zu v_wawi_fahrt_km.kilometer). '
  'NULL, wenn weder Distanz noch beide Koordinatenpaare vorliegen.';
comment on column velocity.v_wawi_fahrten_je_tag_rad.ist_geschaetzt is
  'Wahr, wenn kilometer nicht gemessen, sondern aus Dauer oder Luftlinie '
  'geschätzt wurde - gehört zu jeder Anzeige von kilometer dazu.';

-- =====================================================================
-- Gestaltungsauftrag "Stationen ausbauen", Punkt 1: v_wawi_station_flotte
-- - welche Raeder stehen an welcher Station
-- =====================================================================

-- ---- Raeder je Station -------------------------------------------------
-- Woertlich der Auftrag: "es wird nicht erkennbar, welche Raeder gerade
-- an welcher Station stehen, das muss in die Details rein." v_wawi_flotte
-- fuehrt dafuer bereits eine Spalte standort (s.name, siehe deren
-- Kopfkommentar) - GEPRUEFT und verworfen: velocity.station.name traegt
-- KEINE unique-Constraint (nur stationsnummer hat station_nummer_uk, siehe
-- 0003_bereich_b_netz_und_flotte.sql), ein Filter "standort=eq.<Name>" aus
-- der Oberflaeche waere also ein Textvergleich auf einem Feld ohne
-- garantierte Eindeutigkeit - heute zufaellig eindeutig, aber nichts in
-- der Datenbank verspricht das auch morgen noch. Diese Sicht traegt
-- stattdessen station_id, den echten Fremdschluessel aus
-- fahrrad_position, als Filterspalte - derselbe Fund wie bei
-- v_wawi_fahrten_je_tag_rad weiter oben ("Sichten verweben"): eine
-- vorhandene Spalte reicht nicht automatisch, wenn sie fachlich etwas
-- anderes leistet als der neue Anwendungsfall braucht.
--
-- Dieselben Spalten wie v_wawi_flotte (Rahmennummer, Typ, Status,
-- Akkustand, offene Schaeden, hoechste Schwere) - "was sonst zur
-- Einschaetzung hilft" (Auftrag, woertlich): eine Disposition, die ein
-- Rad umsetzen will, muss wissen, ob es fahrbereit ist, nicht nur, dass es
-- da steht. Bewusst OHNE angeschafft_am/letzte_wartung/hersteller/modell -
-- das sind Flottendetails, die v_wawi_flotte selbst schon zeigt (der
-- Querverweis dorthin bleibt moeglich, siehe fahrrad_id), keine
-- Zusatzinfo fuer "steht dieses Rad hier richtig".
--
-- ROLLE: disposition und leitung, wie v_wawi_station selbst - NICHT
-- zusaetzlich werkstatt, obwohl v_wawi_flotte es zulaesst. Der
-- Gestaltungsauftrag verlangt: "Wer die Stationsdetails sieht, muss auch
-- die Raeder sehen duerfen" - das ist eine UNTERGRENZE (disposition UND
-- leitung MUESSEN diese Sicht sehen, weil sie den Stationen-Bereich
-- sehen), keine Aufforderung, sie zusaetzlich an eine dritte Rolle zu
-- vergeben, die den Bereich gar nicht aufruft. werkstatt sieht dieselben
-- Raeder ohnehin vollstaendig ueber v_wawi_flotte.
create or replace view velocity.v_wawi_station_flotte as
select fp.station_id,
       f.fahrrad_id,
       f.rahmennummer,
       t.typ_code,
       t.bezeichnung as typ,
       f.status,
       fp.akkustand_prozent,
       (select count(*) from velocity.schadensmeldung sm
         where sm.fahrrad_id = f.fahrrad_id and sm.status in ('offen','in_arbeit'))
                        as offene_schaeden,
       -- Identische Ueberlegung wie v_wawi_flotte.hoechste_schwere: max()
       -- auf dem ENUM selbst, nicht auf ::text, damit fahruntauglich vor
       -- gering und mittel gewinnt statt hinter ihnen im Alphabet zu
       -- verschwinden.
       (select max(sm.schwere)::text from velocity.schadensmeldung sm
         where sm.fahrrad_id = f.fahrrad_id and sm.status in ('offen','in_arbeit'))
                        as hoechste_schwere
  from velocity.fahrrad_position fp
  join velocity.fahrrad       f  on f.fahrrad_id = fp.fahrrad_id
  join velocity.fahrradmodell mo on mo.modell_id = f.modell_id
  join velocity.fahrradtyp    t  on t.typ_id     = mo.typ_id
 where fp.station_id is not null
   and (velocity.hat_rolle('disposition') or velocity.hat_rolle('leitung')
     or velocity.hat_rolle('demo'));

comment on view velocity.v_wawi_station_flotte is
  'Welche Raeder stehen an welcher Station (Gestaltungsauftrag Stationen, Punkt '
  '1) - dieselben Spalten wie v_wawi_flotte, aber ueber station_id gefiltert '
  'statt ueber den Namenstext v_wawi_flotte.standort, der keine unique-Constraint '
  'traegt (siehe Kopfkommentar am create view). Nur Raeder MIT Station '
  '(fp.station_id is not null) - ein Rad auf freier Ausleihe gehoert in keine '
  'Stationsdetailmaske. Filtert selbst ueber velocity.hat_rolle, dieselben '
  'Rollen wie v_wawi_station, seit dem Demozugang zusaetzlich '
  'velocity.hat_rolle(''demo'') (0020_demo_zugang.sql).';
comment on column velocity.v_wawi_station_flotte.station_id is
  'Schluessel der Station, der Filterschluessel dieser Sicht (station_id=eq.<id>).';
comment on column velocity.v_wawi_station_flotte.fahrrad_id is
  'Schluessel des Rades, fuer den Sprung in die Flottensicht (v_wawi_flotte).';
comment on column velocity.v_wawi_station_flotte.rahmennummer is
  'Am Rahmen ablesbare Nummer, der Bezug zum physischen Rad vor Ort.';
comment on column velocity.v_wawi_station_flotte.typ_code is
  'Fachlicher Schluessel des Fahrradtyps.';
comment on column velocity.v_wawi_station_flotte.typ is
  'Anzeigename des Fahrradtyps.';
comment on column velocity.v_wawi_station_flotte.status is
  'Aktueller Betriebsstatus des Rades - verfuegbar, ausgeliehen, wartung, defekt '
  'oder ausgemustert. Ein Rad mit Status ausgeliehen sollte hier praktisch nicht '
  'auftauchen (fahrrad_position wird bei der Ausleihe geraeumt); steht es '
  'trotzdem noch da, ist das ein Hinweis auf eine unsaubere Rueckgabe, kein '
  'Softwarefehler dieser Sicht.';
comment on column velocity.v_wawi_station_flotte.akkustand_prozent is
  'Ladestand des Akkus. NULL bei Raedern ohne Elektroantrieb.';
comment on column velocity.v_wawi_station_flotte.offene_schaeden is
  'Zahl der noch nicht abgeschlossenen Schadensmeldungen (offen oder in_arbeit).';
comment on column velocity.v_wawi_station_flotte.hoechste_schwere is
  'Schwerste noch offene Meldung nach der natuerlichen Rangfolge des ENUM (gering '
  '< mittel < fahruntauglich), nicht alphabetisch. NULL, wenn keine offene '
  'Meldung vorliegt.';

-- =====================================================================
-- Gestaltungsauftrag "Stationen ausbauen", Punkt 3:
-- v_wawi_stationsverkehr_zeitfenster - Zu-/Abgang nach Zeitfenster
-- =====================================================================

-- ---- Verkehr je Station und Zeitfenster ---------------------------------
-- Woertlich der Auftrag: "Dann will ich bei den Details den Abgang/Zugang
-- nach Zeitslots als Grafik sehen." Die Kernfrage der Disposition:
-- laeuft eine Station morgens leer und quillt abends ueber, muss
-- umgeraeumt werden - und das sieht man nur an einer Grafik ueber die
-- Tageszeit, nicht an v_wawi_stationsauslastung (dort steht nur die
-- Gesamtsumme abgaenge/zugaenge ueber die GESAMTE Historie, ohne
-- Zeitachse).
--
-- ZEITFENSTER: Zweistundenbloecke (12 je Tag), nicht Stunden und nicht
-- Tageszeiten. Nachgemessen an den echten Fahrten (Referenzdatenbank,
-- 12047 abgeschlossene Ausleihen Januar 2025 bis August 2026): eine
-- einzelne Stunde an EINER Station hat in mehreren Kombinationen unter
-- fuenf Fahrten ueber den GESAMTEN Zeitraum - "eine Stunde mit drei
-- Fahrten im Jahr sagt nichts" (Auftrag, woertlich) waere bei stuendlicher
-- Aufloesung realer Befund, nicht nur eine theoretische Warnung. Ein
-- Zweistundenblock verdoppelt die Stichprobe je Kasten und laesst nur noch
-- sechs von 146 belegten Kombinationen unter fuenf Fahrten (nachgemessen).
-- Tageszeiten (z. B. vier Bloecke) waeren umgekehrt zu grob: der
-- Morgenpeak um 7 Uhr und der Feierabendpeak um 17 Uhr - die groessten
-- Ausschlaege im gesamten Datenbestand, siehe unten - laegen dann beide
-- mitten in ihrem jeweiligen Block und waeren gegen die Nachbarstunden
-- nicht mehr zu erkennen.
--
-- WERKTAG/WOCHENENDE GETRENNT, NICHT UEBER DEN GANZEN ZEITRAUM GEMITTELT:
-- "ein Mittel ueber ein Jahr glaettet den Wochenrhythmus weg" (Auftrag,
-- woertlich) ist hier kein Risiko, sondern eine nachgemessene Tatsache
-- dieser Datenbank. Werktags haeufen sich 2032 von rund 8500 Werktags-
-- Ausleihen allein in der Stunde 7 Uhr und 2767 in der Stunde 17 Uhr -
-- ein klassisches Pendlermuster. Am Wochenende verteilen sich die
-- Fahrten dagegen nahezu gleichmaessig ueber den Tag (rund 160-200 je
-- Stunde, kein erkennbarer Peak). EIN gemeinsamer Mittelwert ueber beide
-- wuerde einen Feierabendpeak zeigen, der am Wochenende gar nicht
-- existiert, und die gleichmaessige Wochenendnutzung als "leicht erhoehtes
-- Grundrauschen um den Werktagspeak" verschwinden lassen - genau die
-- Glaettung, vor der der Auftrag warnt. Zwei Reihen (wochentyp) statt
-- einer sind die direkte Antwort darauf.
--
-- GEMITTELT UEBER DEN GESAMTEN VERFUEGBAREN ZEITRAUM (Januar 2025 bis
-- August 2026, ueber generate_series aus min/max startzeit ermittelt,
-- kein hartcodiertes Datum): eine kuerzere Fensterung (etwa nur die
-- letzten drei Monate) haette die ohnehin knappe Stichprobe je Kasten
-- weiter verkleinert, ohne dass in diesem Referenzbestand ein Trend
-- ueber die Zeit zu erwarten waere (die Referenzdaten sind synthetisch
-- fuer das gesamte Jahr gleichmaessig erzeugt, siehe 0008/0009). "Je
-- Tag" (abgaenge_je_tag/zugaenge_je_tag) ist deshalb eine Rate: Summe der
-- Fahrten dieses Kastens geteilt durch die Zahl der Werktage bzw.
-- Wochenendtage im gesamten Zeitraum (tage_erfasst) - nicht die rohe
-- Summe, die bei 428 Werktagen gegenueber 171 Wochenendtagen sonst allein
-- durch die unterschiedliche Tagezahl schiefe Vergleiche erzeugte.
--
-- KEIN JOIN AUF v_wawi_fahrt_km ODER v_wawi_fahrten_je_tag_rad: diese
-- Sicht braucht weder Kilometer noch Kunde, nur Stationsschluessel und
-- Uhrzeit - ein Join auf eine Sicht mit eigener, engerer Rollenschranke
-- wuerde hier denselben Fehler wiederholen, den der Kopfkommentar von
-- v_wawi_fahrten_je_tag_rad bereits einmal beschreibt.
--
-- KEIN PERSONENBEZUG: keine ausleihe_id, keine kunde_id, kein einzelner
-- Zeitstempel - nur Station, Wochentyp (werktag/wochenende, keine
-- Kalenderwoche und kein Datum) und ein zweistuendiges Zeitfenster, dazu
-- aggregierte Zaehlwerte. Aus dieser Sicht laesst sich keine einzelne
-- Fahrt und kein einzelner Kunde rekonstruieren - dieselbe Grenze wie bei
-- v_wawi_fahrten_je_tag (siehe deren Kopfkommentar), hier zusaetzlich
-- ohne Kalendertag, weil ein Zeitfenster fuer die Disposition nur als
-- WIEDERKEHRENDES Muster interessant ist, nicht als Ereignis an einem
-- bestimmten Tag.
--
-- RASTER STATT NUR VORKOMMENDER KOMBINATIONEN: jede der 10 Stationen
-- traegt fuer JEDEN der 24 Wochentyp/Zeitfenster-Kaesten eine Zeile, auch
-- wenn dort ueber den gesamten Zeitraum keine einzige Fahrt lag (dann
-- abgaenge=zugaenge=0) - dieselbe Ueberlegung wie bei saeulengrafik() in
-- rahmen.js ("ein fehlender Betriebstag ist null Fahrten, keine
-- ausgelassene Kategorie"): ein fehlendes Zeitfenster in einer Grafik mit
-- fester x-Achse saehe sonst wie eine Ladeluecke aus, nicht wie eine
-- ruhige Nachtstunde.
create or replace view velocity.v_wawi_stationsverkehr_zeitfenster as
with tage as (
  select d::date as tag,
         case when extract(isodow from d) in (6, 7) then 'wochenende' else 'werktag' end as wochentyp
    from generate_series(
           (select min(startzeit) from velocity.ausleihe where status = 'abgeschlossen')::date,
           (select max(startzeit) from velocity.ausleihe where status = 'abgeschlossen')::date,
           interval '1 day'
         ) as d
),
tage_je_typ as (
  select wochentyp, count(*) as anzahl from tage group by 1
),
abgaenge as (
  select a.start_station_id as station_id,
         case when extract(isodow from a.startzeit) in (6, 7) then 'wochenende' else 'werktag' end as wochentyp,
         (extract(hour from a.startzeit)::int / 2) * 2 as zeitfenster_start_stunde,
         count(*) as anzahl
    from velocity.ausleihe a
   where a.status = 'abgeschlossen'
   group by 1, 2, 3
),
zugaenge as (
  select a.end_station_id as station_id,
         case when extract(isodow from a.startzeit) in (6, 7) then 'wochenende' else 'werktag' end as wochentyp,
         (extract(hour from a.startzeit)::int / 2) * 2 as zeitfenster_start_stunde,
         count(*) as anzahl
    from velocity.ausleihe a
   where a.status = 'abgeschlossen'
   group by 1, 2, 3
),
raster as (
  select s.station_id, s.name, wt.wochentyp, blk.zeitfenster_start_stunde
    from velocity.station s
   cross join (values ('werktag'), ('wochenende')) as wt(wochentyp)
   cross join (select generate_series(0, 22, 2) as zeitfenster_start_stunde) as blk
)
select r.station_id,
       r.name,
       r.wochentyp,
       r.zeitfenster_start_stunde,
       coalesce(ab.anzahl, 0) as abgaenge,
       coalesce(zu.anzahl, 0) as zugaenge,
       round(coalesce(ab.anzahl, 0)::numeric / nullif(tt.anzahl, 0), 2) as abgaenge_je_tag,
       round(coalesce(zu.anzahl, 0)::numeric / nullif(tt.anzahl, 0), 2) as zugaenge_je_tag,
       round((coalesce(zu.anzahl, 0) - coalesce(ab.anzahl, 0))::numeric / nullif(tt.anzahl, 0), 2) as saldo_je_tag,
       tt.anzahl as tage_erfasst
  from raster r
  join tage_je_typ tt on tt.wochentyp = r.wochentyp
  left join abgaenge ab on ab.station_id = r.station_id and ab.wochentyp = r.wochentyp
                       and ab.zeitfenster_start_stunde = r.zeitfenster_start_stunde
  left join zugaenge zu on zu.station_id = r.station_id and zu.wochentyp = r.wochentyp
                       and zu.zeitfenster_start_stunde = r.zeitfenster_start_stunde
 where velocity.hat_rolle('disposition') or velocity.hat_rolle('leitung')
    or velocity.hat_rolle('demo');

comment on view velocity.v_wawi_stationsverkehr_zeitfenster is
  'Zu- und Abgang je Station in Zweistundenbloecken, getrennt nach Werktag und '
  'Wochenende, gemittelt ueber den gesamten verfuegbaren Zeitraum '
  '(Gestaltungsauftrag Stationen, Punkt 3) - siehe Kopfkommentar am create view '
  'fuer die nachgemessene Begruendung von Blockgroesse, Wochentagstrennung und '
  'Mittelungszeitraum. Aggregat ohne Personenbezug: keine ausleihe_id, keine '
  'kunde_id, kein Kalendertag. Filtert selbst ueber velocity.hat_rolle, '
  'dieselben Rollen wie v_wawi_stationsauslastung, seit dem Demozugang '
  'zusaetzlich velocity.hat_rolle(''demo'') (0020_demo_zugang.sql).';
comment on column velocity.v_wawi_stationsverkehr_zeitfenster.station_id is
  'Schluessel der Station.';
comment on column velocity.v_wawi_stationsverkehr_zeitfenster.name is
  'Anzeigename der Station.';
comment on column velocity.v_wawi_stationsverkehr_zeitfenster.wochentyp is
  '''werktag'' (Montag bis Freitag) oder ''wochenende'' (Samstag/Sonntag) - '
  'getrennt gehalten, weil beide nachweislich unterschiedliche Tagesrhythmen '
  'zeigen, siehe Kopfkommentar.';
comment on column velocity.v_wawi_stationsverkehr_zeitfenster.zeitfenster_start_stunde is
  'Erste Stunde des Zweistundenblocks (0, 2, 4, ... 22) in lokaler Datenbankzeit. '
  'Der Block umfasst diese und die folgende Stunde.';
comment on column velocity.v_wawi_stationsverkehr_zeitfenster.abgaenge is
  'Summe der abgeschlossenen Ausleihen, die in diesem Block an dieser Station '
  'begonnen haben, ueber den GESAMTEN erfassten Zeitraum (nicht je Tag) - der '
  'Zaehler zu abgaenge_je_tag.';
comment on column velocity.v_wawi_stationsverkehr_zeitfenster.zugaenge is
  'Summe der abgeschlossenen Ausleihen, die in diesem Block an dieser Station '
  'geendet haben, ueber den gesamten erfassten Zeitraum - der Zaehler zu '
  'zugaenge_je_tag.';
comment on column velocity.v_wawi_stationsverkehr_zeitfenster.abgaenge_je_tag is
  'abgaenge geteilt durch tage_erfasst - die vergleichbare Rate, weil Werktage '
  '(428) und Wochenendtage (171) im Zeitraum unterschiedlich haeufig sind. Das '
  'ist die Zahl fuer die Grafik, nicht die rohe Summe abgaenge.';
comment on column velocity.v_wawi_stationsverkehr_zeitfenster.zugaenge_je_tag is
  'zugaenge geteilt durch tage_erfasst, siehe abgaenge_je_tag.';
comment on column velocity.v_wawi_stationsverkehr_zeitfenster.saldo_je_tag is
  'zugaenge_je_tag minus abgaenge_je_tag. Positiv heisst, die Station sammelt in '
  'diesem Zeitfenster im Mittel mehr Raeder an, als sie abgibt - der Hinweis, '
  'wann nachverteilt werden muss.';
comment on column velocity.v_wawi_stationsverkehr_zeitfenster.tage_erfasst is
  'Zahl der Werktage bzw. Wochenendtage im gesamten erfassten Zeitraum (Nenner '
  'von abgaenge_je_tag/zugaenge_je_tag/saldo_je_tag) - macht sichtbar, auf wie '
  'vielen Tagen die Rate beruht, statt eine Genauigkeit vorzutaeuschen, die eine '
  'einzelne Randstunde mit wenigen Fahrten nicht hat.';

-- =====================================================================
-- Gestaltungsauftrag "Stationen ausbauen", Punkt 4: Koordinaten je
-- Kundenort und v_wawi_kundenorte - die Landkarte mit Kundschaft
-- =====================================================================

-- ---- Koordinaten je Ort -------------------------------------------------
-- "Dafuer brauchst du Koordinaten je Ort - leg sie als Daten an, nicht als
-- Konstanten im JavaScript, und pruef sie, statt sie zu raten" (Auftrag,
-- woertlich). Eine eigene, kleine Referenztabelle statt einer erweiterten
-- Stammtabelle: velocity.adresse fuehrt ort als Freitext ohne eigenen
-- Schluessel, eine Koordinate gehoert fachlich zum ORT (einer von 14
-- Werten in dieser Datenbank, siehe unten), nicht zu einer einzelnen
-- Adresse.
--
-- GEPRUEFT, NICHT GERATEN: die vierzehn Orte sind genau die, die in
-- velocity.adresse.ort ueber velocity.kunde tatsaechlich vorkommen
-- (nachgezaehlt: Wuerzburg 573, Veitshoechheim 58, Hoechberg 56, Gerbrunn
-- 40, Randersacker 32, Rottendorf 27, Ochsenfurt 20, Estenfeld 19, Zell am
-- Main 16, Waldbuettelbrunn 16, Kist 14, Kitzingen 12, Karlstadt 9,
-- Marktheidenfeld 9 - Summe 901 von 1014 Kunden, der Rest fuehrt keine
-- Rechnungsadresse). Die Koordinaten selbst sind der jeweilige
-- OpenStreetMap-Nominatim-Treffer fuer den Ortsnamen (Ortszentrum, kein
-- Adresspunkt) - keine geschaetzten oder erinnerten Werte.
create table if not exists velocity.ort_koordinate (
  ort         text        primary key,
  latitude    numeric(9,6) not null,
  longitude   numeric(9,6) not null,
  constraint ort_koordinate_lat_chk check (latitude  between  -90 and  90),
  constraint ort_koordinate_lon_chk check (longitude between -180 and 180)
);

-- RLS an, ohne eigene Policy (default deny) - dieselbe Schranke, der jede
-- Basistabelle in 0011_sicherheit.sql unterliegt (test_s_rls_ueberall_aktiv
-- in t0011_sicherheit.sql sweept ueber ALLE Basistabellen und faellt sonst
-- fuer diese neue Tabelle durch). Kein direkter Grant an authenticated
-- noetig: v_wawi_kundenorte (Eigentuemer postgres, wie jede v_wawi_-Sicht
-- ohne security_invoker) liest ort_koordinate mit den Rechten IHRES
-- Eigentuemers, nicht mit denen der aufrufenden Rolle - dieselbe
-- Eigentuemerschafts-Ueberlegung wie beim Grant von fn_luftlinie_km in
-- 0019_wawi_logik.sql, hier nur fuer eine gelesene TABELLE statt einer
-- aufgerufenen FUNKTION.
alter table velocity.ort_koordinate enable row level security;

comment on table velocity.ort_koordinate is
  'Koordinaten je Ortsname, fuer die schematische Landkarte der Stationen '
  '(Gestaltungsauftrag Stationen, Punkt 4). Enthaelt genau die Orte, die unter '
  'velocity.adresse.ort in dieser Datenbank tatsaechlich vorkommen (siehe '
  'Kopfkommentar). Werte aus OpenStreetMap/Nominatim (Ortszentrum), nicht '
  'geschaetzt - "pruef sie, statt sie zu raten" (Auftrag, woertlich).';
comment on column velocity.ort_koordinate.ort is
  'Ortsname, wortgleich zu velocity.adresse.ort - der Join-Schluessel zu '
  'v_wawi_kundenorte.';
comment on column velocity.ort_koordinate.latitude is
  'Breitengrad des Ortszentrums.';
comment on column velocity.ort_koordinate.longitude is
  'Laengengrad des Ortszentrums.';

insert into velocity.ort_koordinate (ort, latitude, longitude) values
  ('Würzburg',         49.778036,  9.943477),
  ('Veitshöchheim',    49.840858,  9.888913),
  ('Höchberg',         49.781826,  9.878684),
  ('Gerbrunn',         49.780795,  9.994524),
  ('Randersacker',     49.749722,  9.997718),
  ('Rottendorf',       49.799412, 10.032107),
  ('Ochsenfurt',       49.664355, 10.064755),
  ('Estenfeld',        49.838868, 10.002861),
  ('Waldbüttelbrunn',  49.786366,  9.831757),
  ('Zell am Main',     49.811107,  9.870445),
  ('Kist',             49.743490,  9.838752),
  ('Kitzingen',        49.747392, 10.153831),
  ('Karlstadt',        49.969818,  9.744140),
  ('Marktheidenfeld',  49.858203,  9.566704)
on conflict (ort) do update
  set latitude = excluded.latitude, longitude = excluded.longitude;

-- ---- Kundenorte fuer die Karte ------------------------------------------
-- "... ich moechte eine neue Sicht haben, in der die Standorte auch als
-- Landkarten visualisiert sind und sich zusaetzlich die Kunden einblenden
-- lassen" (Auftrag, woertlich). Und, ausdruecklich als Warnung: "Kunden
-- auf einer Karte sind Personendaten. Einzelne Wohnadressen als Punkte
-- waeren genau das Bewegungs- und Wohnprofil, das diese Fallstudie
-- fernhaelt."
--
-- BEGRUENDUNG DER AGGREGATION (der Lehrpunkt dieser Sicht, deshalb hier
-- und nicht nur im Auftragsbericht): dieselbe Information, JE ORT
-- gebuendelt ("Veitshoechheim, 58 Kunden"), ist zulaessig - sie ist eine
-- Kennzahl ueber eine Gruppe von mindestens einer Handvoll Personen, aus
-- der sich keine einzelne Adresse und kein einzelner Kunde mehr
-- herauslesen laesst. JE PERSON verortet (ein Punkt auf der Karte je
-- Kunde, und sei es nur grob auf Ortsebene gestreut) waere dagegen exakt
-- das Bewegungs-/Wohnprofil aus der Warnung: schon der blosse Ort einer
-- ansonsten anonymen Person ist ein personenbezogenes Merkmal (Art. 4
-- Nr. 1 DSGVO), und eine Karte mit 1014 einzelnen Punkten liesse sich -
-- anders als eine Zahl je Ort - nicht mehr von einer Kundenliste mit
-- Wohnort unterscheiden. Der Unterschied ist nicht graduell, sondern
-- grundsaetzlich: EINE Zahl je Ort kann niemanden individuell betreffen,
-- egal wie klein die Gruppe ist (der kleinste Ort hier hat neun Kunden);
-- EIN Punkt je Person kann es immer. Deshalb gibt es in dieser Sicht kein
-- kunde_id, keinen Namen, keine Adresse - nur ort, Koordinate und eine
-- Zaehlung.
--
-- ROLLE: disposition und leitung, wie v_wawi_station - diese Sicht ist
-- fuer die Kartenansicht IM Stationen-Bereich gedacht (siehe
-- stationen.js), nicht fuer den Kundenservice: die dortige v_wawi_kunde
-- zeigt ohnehin schon jeden einzelnen Kunden samt Adresse fuer genau die
-- Rolle, die sie fachlich braucht (kundenservice/leitung) - eine
-- aggregierte Zweitsicht fuer dieselbe Rolle waere kein zusaetzlicher
-- Schutz, hier geht es um eine ANDERE Rolle (disposition), die sonst gar
-- keinen Kundenbezug sieht und deshalb NUR die aggregierte Form bekommt.
create or replace view velocity.v_wawi_kundenorte as
select a.ort,
       ok.latitude,
       ok.longitude,
       count(*) as kunden
  from velocity.kunde k
  join velocity.adresse a on a.adresse_id = k.rechnungsadresse_id
  left join velocity.ort_koordinate ok on ok.ort = a.ort
 where (velocity.hat_rolle('disposition') or velocity.hat_rolle('leitung')
     or velocity.hat_rolle('demo'))
 group by a.ort, ok.latitude, ok.longitude;

comment on view velocity.v_wawi_kundenorte is
  'Kundschaft je Ort, aggregiert mit Koordinate fuer die Stationskarte '
  '(Gestaltungsauftrag Stationen, Punkt 4). Absichtlich ohne kunde_id, Name oder '
  'Adresse - siehe der ausfuehrliche Kopfkommentar am create view fuer die '
  'Begruendung, warum eine Zaehlung je Ort zulaessig ist, wo ein Punkt je Person '
  'es nicht waere. Filtert selbst ueber velocity.hat_rolle, seit dem Demozugang '
  'zusaetzlich velocity.hat_rolle(''demo'') (0020_demo_zugang.sql) - dieselbe '
  'Aggregation, die auch fuer disposition schon die Grenze zieht, gilt fuer '
  '''demo'' identisch, deshalb KEIN Widerspruch zum Ausschluss von v_wawi_kunde.';
comment on column velocity.v_wawi_kundenorte.ort is
  'Ortsname laut Rechnungsadresse.';
comment on column velocity.v_wawi_kundenorte.latitude is
  'Breitengrad des Ortszentrums aus velocity.ort_koordinate. NULL, wenn der Ort '
  'dort (noch) nicht gepflegt ist - die Oberflaeche zeigt einen solchen Ort dann '
  'ohne Marke statt an einer geratenen Position.';
comment on column velocity.v_wawi_kundenorte.longitude is
  'Laengengrad des Ortszentrums, siehe latitude.';
comment on column velocity.v_wawi_kundenorte.kunden is
  'Zahl der Kunden mit diesem Ort in der Rechnungsadresse - die Kennzahl, die '
  'die Aggregation zulaessig macht (siehe Kopfkommentar).';
