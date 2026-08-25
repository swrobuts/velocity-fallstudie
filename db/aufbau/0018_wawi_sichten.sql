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
--             v_wawi_stationsauslastung
-- Ruecknahme: DROP VIEW fuer dieselben Namen; DROP FUNCTION
--             velocity.fn_luftlinie_km(numeric,numeric,numeric,numeric);
--
-- Hinweis:    Diese Datei entsteht in zwei Aufgaben. Aufgabe 10 legt die
--             fuenf Arbeitssichten an (Flotte, Kunden, Stationen,
--             Schaeden, Auftraege) und die Haversine-Funktion, die die
--             Auswertungssichten aus Aufgabe 11 brauchen werden.
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
  'sobald ein Punkt fehlt - eine geschaetzte Distanz aus einem halben Koordinatenpaar '
  'waere Erfindung, keine Schaetzung.';

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
                              as hoechste_schwere
  from velocity.fahrrad f
  join velocity.fahrradmodell mo on mo.modell_id = f.modell_id
  join velocity.fahrradtyp    t  on t.typ_id     = mo.typ_id
  join velocity.hersteller    h  on h.hersteller_id = mo.hersteller_id
  left join velocity.fahrrad_position fp on fp.fahrrad_id = f.fahrrad_id
  left join velocity.station          s  on s.station_id  = fp.station_id
 where velocity.hat_rolle('disposition')
    or velocity.hat_rolle('werkstatt')
    or velocity.hat_rolle('leitung');

comment on view velocity.v_wawi_flotte is
  'Arbeitssicht der Flotte fuer Disposition und Werkstatt: ein Rad je Zeile mit '
  'Standort, Wartungshistorie und dem dringlichsten offenen Schaden. Filtert '
  'selbst ueber velocity.hat_rolle, siehe Kopfkommentar der Datei.';
comment on column velocity.v_wawi_flotte.fahrrad_id is
  'Schluessel des Rades, fuer Verweise in die Werkstatt- und Auftragssichten.';
comment on column velocity.v_wawi_flotte.rahmennummer is
  'Am Rahmen ablesbare Nummer, der Bezug zum physischen Rad vor Ort.';
comment on column velocity.v_wawi_flotte.typ_code is
  'Fachlicher Schluessel des Fahrradtyps, fuer Filter in der Oberflaeche.';
comment on column velocity.v_wawi_flotte.typ is
  'Anzeigename des Fahrradtyps.';
comment on column velocity.v_wawi_flotte.hersteller is
  'Name des Herstellers laut Modellstammdaten.';
comment on column velocity.v_wawi_flotte.modell is
  'Modellbezeichnung, fuer die Ersatzteilsuche in der Werkstatt.';
comment on column velocity.v_wawi_flotte.status is
  'Aktueller Betriebsstatus des Rades - verfuegbar, ausgeliehen, wartung, '
  'defekt oder ausgemustert. Anders als die oeffentliche '
  'v_verfuegbares_fahrrad zeigt diese Sicht gerade auch die NICHT '
  'verfuegbaren Raeder: die Disposition muss wissen, welches Rad in der '
  'Wartung haengt, nicht nur, welches gerade fahrbereit ist.';
comment on column velocity.v_wawi_flotte.angeschafft_am is
  'Anschaffungsdatum, Grundlage fuer Abschreibung und Alterseinschaetzung.';
comment on column velocity.v_wawi_flotte.standort is
  'Name der Station, an der das Rad steht. NULL bei freiem Abstellort oder '
  'laufender Fahrt.';
comment on column velocity.v_wawi_flotte.latitude is
  'Breitengrad der zuletzt gemeldeten Position, unabhaengig von einer Station.';
comment on column velocity.v_wawi_flotte.longitude is
  'Laengengrad der zuletzt gemeldeten Position, unabhaengig von einer Station.';
comment on column velocity.v_wawi_flotte.akkustand_prozent is
  'Ladestand des Akkus. NULL bei Raedern ohne Elektroantrieb.';
comment on column velocity.v_wawi_flotte.letzte_wartung is
  'Abschlusszeitpunkt des zuletzt erledigten Wartungsauftrags. NULL, wenn das '
  'Rad noch nie in der Werkstatt war.';
comment on column velocity.v_wawi_flotte.offene_schaeden is
  'Zahl der noch nicht abgeschlossenen Schadensmeldungen (offen oder in_arbeit).';
comment on column velocity.v_wawi_flotte.hoechste_schwere is
  'Schwerste noch offene Meldung nach der natuerlichen Rangfolge des ENUM '
  '(gering < mittel < fahruntauglich), nicht alphabetisch. NULL, wenn keine '
  'offene Meldung vorliegt - entscheidet, ob das Rad ueberhaupt eingeplant '
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
         where r.kunde_id = k.kunde_id and r.status = 'gestellt')         as offener_betrag
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
  'braucht, wird nicht ausgeliefert. Filtert selbst ueber velocity.hat_rolle.';
comment on column velocity.v_wawi_kunde.kunde_id is
  'Surrogatschluessel, fachlich bedeutungslos und deshalb stabil.';
comment on column velocity.v_wawi_kunde.kundennummer is
  'Fachlicher, am Telefon nennbarer Schluessel des Kunden.';
comment on column velocity.v_wawi_kunde.anrede is
  'Anrede fuer die Korrespondenz.';
comment on column velocity.v_wawi_kunde.vorname is
  'Vorname des Kunden.';
comment on column velocity.v_wawi_kunde.nachname is
  'Nachname des Kunden.';
comment on column velocity.v_wawi_kunde.email is
  'Kontaktadresse, zugleich eindeutiges Merkmal fuer die Anmeldung.';
comment on column velocity.v_wawi_kunde.telefon is
  'Telefonische Kontaktmoeglichkeit, optional.';
comment on column velocity.v_wawi_kunde.status is
  'aktiv, gesperrt oder geschlossen - der Kundenservice muss ihn sehen, um '
  'eine Sperre ueberhaupt erklaeren zu koennen.';
comment on column velocity.v_wawi_kunde.registriert_am is
  'Zeitpunkt der Registrierung, unabhaengig vom technischen erstellt_am.';
comment on column velocity.v_wawi_kunde.strasse is
  'Strasse der Rechnungsadresse. NULL, solange keine hinterlegt ist.';
comment on column velocity.v_wawi_kunde.hausnummer is
  'Hausnummer der Rechnungsadresse.';
comment on column velocity.v_wawi_kunde.plz is
  'Postleitzahl der Rechnungsadresse.';
comment on column velocity.v_wawi_kunde.ort is
  'Ort der Rechnungsadresse.';
comment on column velocity.v_wawi_kunde.tarif_code is
  'Fachlicher Schluessel des aktuell laufenden Tarifs. NULL ohne aktive '
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
  'Summe aller Rechnungsbetraege des Kunden, unabhaengig vom Zahlungsstatus.';
comment on column velocity.v_wawi_kunde.offener_betrag is
  'Summe der gestellten, noch nicht bezahlten Rechnungen - der Betrag, um den '
  'es bei einer Mahnung geht.';

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
 group by s.station_id, s.stationsnummer, s.name, a.strasse, a.hausnummer,
          a.plz, a.ort, s.latitude, s.longitude, s.kapazitaet, s.betriebszeitraum;

comment on view velocity.v_wawi_station is
  'Arbeitssicht der Disposition: Kapazitaet und Belegung je Station, samt '
  'stillgelegter Stationen (GR22 - eine Station wird stillgelegt, nicht '
  'geloescht, deshalb bleibt sie hier sichtbar statt zu verschwinden). '
  'Filtert selbst ueber velocity.hat_rolle.';
comment on column velocity.v_wawi_station.station_id is
  'Surrogatschluessel, fachlich bedeutungslos und deshalb stabil.';
comment on column velocity.v_wawi_station.stationsnummer is
  'Fachlicher Schluessel der Station.';
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
  'Breitengrad fuer den Kartenmarker.';
comment on column velocity.v_wawi_station.longitude is
  'Laengengrad fuer den Kartenmarker.';
comment on column velocity.v_wawi_station.kapazitaet is
  'Zahl der Stellplaetze laut Stammdaten.';
comment on column velocity.v_wawi_station.belegt is
  'Zahl der Raeder, die aktuell an dieser Station stehen.';
comment on column velocity.v_wawi_station.frei is
  'Kapazitaet abzueglich belegt. Anders als die oeffentliche v_station ohne '
  'greatest(..., 0): GR15 verhindert Ueberfuellung bereits beim Abstellen, '
  'ein negativer Wert waere hier also ein Alarmsignal und keine Zahl, die '
  'kaschiert werden sollte.';
comment on column velocity.v_wawi_station.betriebszeitraum is
  'Zeitraum, in dem die Station betrieben wird oder wurde. Offenes Ende '
  'bedeutet weiterhin in Betrieb.';
comment on column velocity.v_wawi_station.in_betrieb is
  'Wahr, solange betriebszeitraum kein Ende traegt. Kurzform fuer die '
  'Oberflaeche, ohne dass sie den Bereichstyp selbst auswerten muss.';

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
    or velocity.hat_rolle('disposition')
    or velocity.hat_rolle('leitung');

comment on view velocity.v_wawi_schaden is
  'Arbeitssicht der Werkstatt: jede Schadensmeldung mit Rad, Schwere und '
  'Alter, unabhaengig vom Bearbeitungsstand. Filtert selbst ueber '
  'velocity.hat_rolle.';
comment on column velocity.v_wawi_schaden.schadensmeldung_id is
  'Surrogatschluessel, fachlich bedeutungslos und deshalb stabil.';
comment on column velocity.v_wawi_schaden.fahrrad_id is
  'Das gemeldete Rad.';
comment on column velocity.v_wawi_schaden.rahmennummer is
  'Am Rahmen ablesbare Nummer des gemeldeten Rades.';
comment on column velocity.v_wawi_schaden.typ_code is
  'Fahrradtyp des gemeldeten Rades, fuer Filter in der Werkstattliste.';
comment on column velocity.v_wawi_schaden.gemeldet_am is
  'Zeitpunkt der Meldung.';
comment on column velocity.v_wawi_schaden.melderart is
  '"Kunde" oder "Mitarbeiter" - wer gemeldet hat, nicht wer genau. Fuer die '
  'Werkstatt zaehlt nur die Herkunft der Meldung, eine Rueckfrage laeuft '
  'ueber den Kundenservice bzw. die Personalliste, nicht ueber diese Sicht.';
comment on column velocity.v_wawi_schaden.kategorie is
  'Freitextliche Grobeinordnung des Schadens, etwa Bremse oder Licht.';
comment on column velocity.v_wawi_schaden.beschreibung is
  'Freitext des Melders, was am Rad auffiel.';
comment on column velocity.v_wawi_schaden.schwere is
  'Einordnung der Dringlichkeit; fahruntauglich sperrt das Rad faktisch fuer '
  'die Werkstattplanung.';
comment on column velocity.v_wawi_schaden.status is
  'Bearbeitungsstand der Meldung: offen, in_arbeit, behoben oder verworfen.';
comment on column velocity.v_wawi_schaden.offen_seit is
  'Zeitspanne seit der Meldung bis jetzt - die Wartezeit, nicht ein fester '
  'Zeitpunkt, damit sie beim naechsten Aufruf automatisch weiterlaeuft.';
comment on column velocity.v_wawi_schaden.auftraege is
  'Zahl der Wartungsauftraege, die aus dieser Meldung entstanden sind. Mehr '
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
    or velocity.hat_rolle('leitung');

comment on view velocity.v_wawi_auftrag is
  'Arbeitssicht der Werkstatt: jeder Wartungsauftrag mit Rad, Bearbeiter und '
  'Bearbeitungsstand. Filtert selbst ueber velocity.hat_rolle.';
comment on column velocity.v_wawi_auftrag.wartungsauftrag_id is
  'Surrogatschluessel, fachlich bedeutungslos und deshalb stabil.';
comment on column velocity.v_wawi_auftrag.auftragsnummer is
  'Fachlicher, in der Werkstatt gesprochener Schluessel des Auftrags.';
comment on column velocity.v_wawi_auftrag.fahrrad_id is
  'Das Rad, an dem gearbeitet wird.';
comment on column velocity.v_wawi_auftrag.rahmennummer is
  'Am Rahmen ablesbare Nummer des Rades, fuer den Werkstattzuruf ohne '
  'Nachschlagen.';
comment on column velocity.v_wawi_auftrag.schadensmeldung_id is
  'Ausloesende Meldung. NULL bei einer geplanten Inspektion ohne konkreten '
  'Schaden.';
comment on column velocity.v_wawi_auftrag.eroeffnet_am is
  'Zeitpunkt der Auftragseroeffnung.';
comment on column velocity.v_wawi_auftrag.erledigt_am is
  'Zeitpunkt des Abschlusses. NULL, solange der Auftrag laeuft.';
comment on column velocity.v_wawi_auftrag.status is
  'Bearbeitungsstand des Auftrags: offen, in_arbeit, erledigt oder '
  'abgebrochen.';
comment on column velocity.v_wawi_auftrag.arbeitszeit_minuten is
  'Aufgewendete Werkstattzeit in Minuten. NULL, solange der Auftrag laeuft.';
comment on column velocity.v_wawi_auftrag.bemerkung is
  'Freitext der Werkstatt zum Auftrag, etwa verbaute Ersatzteile ohne '
  'eigenen Lagerbezug.';
comment on column velocity.v_wawi_auftrag.bearbeiter is
  'Voller Name des zustaendigen Werkstattmitarbeiters. NULL, solange der '
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
   and (velocity.hat_rolle('leitung') or velocity.hat_rolle('disposition'))
 group by 1, 2, 3;

comment on view velocity.v_wawi_umsatz_radtyp is
  'Monatsumsatz je Fahrradtyp fuer Leitung und Disposition. sum(ep.betrag) ohne '
  'zweite Multiplikation mit vorzeichen - siehe Kommentar am create view. '
  'Filtert selbst ueber velocity.hat_rolle.';
comment on column velocity.v_wawi_umsatz_radtyp.monat is
  'Erster Tag des Monats der Fahrt (startzeit), Gruppierungsschluessel fuer '
  'einen Zeitverlauf statt einer bedeutungslosen Jahressumme.';
comment on column velocity.v_wawi_umsatz_radtyp.typ_code is
  'Fachlicher Schluessel des Fahrradtyps.';
comment on column velocity.v_wawi_umsatz_radtyp.typ is
  'Anzeigename des Fahrradtyps.';
comment on column velocity.v_wawi_umsatz_radtyp.fahrten is
  'Zahl der abgeschlossenen Ausleihen dieses Typs im Monat.';
comment on column velocity.v_wawi_umsatz_radtyp.minuten is
  'Summe der Fahrtdauer in Minuten, die Auslastungsseite neben dem Umsatz.';
comment on column velocity.v_wawi_umsatz_radtyp.umsatz is
  'Summe der Entgeltpositionen (ep.betrag), bereits vorzeichenbehaftet aus '
  'fn_position_anlegen. Keine zweite Multiplikation mit vorzeichen - das '
  'wuerde Rabatte und Kappungen zu Einnahmen machen, siehe Kopfkommentar.';
comment on column velocity.v_wawi_umsatz_radtyp.umsatz_je_fahrt is
  'umsatz geteilt durch fahrten, die Kennzahl fuer den Vergleich zwischen '
  'Radtypen unabhaengig von deren Flottengroesse.';

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
   and velocity.hat_rolle('leitung')
 group by 1, 2, 3;

comment on view velocity.v_wawi_umsatz_kundengruppe is
  'Monatsumsatz je Tarifgruppe fuer die Leitung. Die Gruppe ist der Tarif zum '
  'Zeitpunkt der Fahrt (a.mitgliedschaft_id), nicht der heutige - siehe '
  'Kommentar am create view. sum(ep.betrag) ohne zweite Multiplikation mit '
  'vorzeichen, wie bei v_wawi_umsatz_radtyp. Filtert selbst ueber '
  'velocity.hat_rolle.';
comment on column velocity.v_wawi_umsatz_kundengruppe.monat is
  'Erster Tag des Monats der Fahrt.';
comment on column velocity.v_wawi_umsatz_kundengruppe.tarif_code is
  'Fachlicher Schluessel des Tarifs zum Fahrtzeitpunkt, oder OHNE ohne '
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
  'umsatz geteilt durch kunden, die Kennzahl fuer den Vergleich zwischen '
  'Tarifgruppen unabhaengig von deren Kundenzahl.';

-- ---- Strecke je Fahrt ------------------------------------------------
-- Hilfssicht. Sie traegt die einzige Stelle, an der geschaetzt wird -
-- und die Kennzeichnung, DASS geschaetzt wurde. Eine Kennzahl, die ihre
-- eigene Unsicherheit nicht mitliefert, ist fuer Marketing brauchbar
-- und fuer alles andere gefaehrlich.
create or replace view velocity.v_wawi_fahrt_km as
select a.ausleihe_id,
       a.startzeit,
       a.kunde_id,
       t.typ_code,
       coalesce(
         a.distanz_km,
         round(velocity.fn_luftlinie_km(
                 coalesce(s1.latitude,  a.start_latitude),
                 coalesce(s1.longitude, a.start_longitude),
                 coalesce(s2.latitude,  a.end_latitude),
                 coalesce(s2.longitude, a.end_longitude)) * ra.wert, 2)
       )                        as kilometer,
       a.distanz_km is null     as ist_geschaetzt
  from velocity.ausleihe a
  join velocity.fahrrad       f  on f.fahrrad_id = a.fahrrad_id
  join velocity.fahrradmodell mo on mo.modell_id = f.modell_id
  join velocity.fahrradtyp    t  on t.typ_id     = mo.typ_id
  left join velocity.station s1 on s1.station_id = a.start_station_id
  left join velocity.station s2 on s2.station_id = a.end_station_id
  left join velocity.rechenannahme ra
         on ra.code = 'umwegfaktor' and ra.gueltigkeit @> a.startzeit::date
 where a.status = 'abgeschlossen'
   and velocity.ist_mitarbeiter();

-- ---- Kilometer und CO2 -----------------------------------------------
-- Die Ersparnis ist die Differenz zum Pkw, nicht die Emission des
-- Rades. Beide Faktoren kommen aus rechenannahme und gelten zum
-- Zeitpunkt der Fahrt - dieselbe Zeitscheibenlogik wie bei den Preisen.
create or replace view velocity.v_wawi_km_co2 as
select date_trunc('month', k.startzeit)::date as monat,
       k.typ_code,
       count(*)                                        as fahrten,
       round(sum(k.kilometer), 1)                      as kilometer,
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
 group by 1, 2;

comment on view velocity.v_wawi_fahrt_km is
  'Einzige Stelle, an der Strecken geschaetzt werden. ist_geschaetzt sagt, ob.';
comment on column velocity.v_wawi_fahrt_km.ausleihe_id is
  'Schluessel der Fahrt, fuer den Verweis aus v_wawi_km_co2 auf die einzelne '
  'Ausleihe hinter der Aggregation.';
comment on column velocity.v_wawi_fahrt_km.startzeit is
  'Beginn der Fahrt, Grundlage der Monatsgruppierung und der Zeitscheibe fuer '
  'Umwegfaktor und CO2-Annahmen (rechenannahme.gueltigkeit).';
comment on column velocity.v_wawi_fahrt_km.kunde_id is
  'Fahrender Kunde, fuer eine spaetere Auswertung je Kunde ohne erneuten Join '
  'auf ausleihe.';
comment on column velocity.v_wawi_fahrt_km.typ_code is
  'Fahrradtyp der Fahrt, bestimmt in v_wawi_km_co2 die passende CO2-Annahme '
  '(co2_rad fuer CITY, sonst co2_ebike).';
comment on column velocity.v_wawi_fahrt_km.kilometer is
  'Gemessene Strecke (ausleihe.distanz_km), wo vorhanden; sonst die Luftlinie '
  'zwischen Start- und Endpunkt mal Umwegfaktor (rechenannahme). NULL, wenn '
  'weder Distanz noch beide Koordinatenpaare vorliegen - eine erfundene Zahl '
  'aus einem halben Koordinatenpaar waere schlimmer als keine.';
comment on column velocity.v_wawi_fahrt_km.ist_geschaetzt is
  'Wahr, wenn kilometer aus der Luftlinie geschaetzt statt gemessen wurde. '
  'Gehoert zu jeder Verwendung von kilometer dazu, siehe Kopfkommentar der '
  'Sicht.';
comment on view velocity.v_wawi_km_co2 is
  'CO2-Ersparnis gegenueber dem Pkw. anteil_geschaetzt gehoert in jede Darstellung dieser Zahl.';
comment on column velocity.v_wawi_km_co2.monat is
  'Erster Tag des Monats der Fahrt (v_wawi_fahrt_km.startzeit).';
comment on column velocity.v_wawi_km_co2.typ_code is
  'Fahrradtyp, bestimmt die verglichene Eigenemission (co2_rad vs. co2_ebike).';
comment on column velocity.v_wawi_km_co2.fahrten is
  'Zahl der Fahrten mit bekannter oder geschaetzter Kilometerzahl in diesem '
  'Monat und Typ.';
comment on column velocity.v_wawi_km_co2.kilometer is
  'Summe der gefahrenen Kilometer, gemessen und geschaetzt gemeinsam - '
  'anteil_geschaetzt sagt, wie viel davon Schaetzung ist.';
comment on column velocity.v_wawi_km_co2.anteil_geschaetzt is
  'Anteil der Fahrten dieser Zeile, deren Kilometer geschaetzt statt gemessen '
  'wurden (0 bis 1). Ohne diese Spalte waere kilometer eine Zahl ohne '
  'Herkunftsangabe - sie ist die Unsicherheit von kilometer und co2_ersparnis_kg, '
  'kein optionales Detail.';
comment on column velocity.v_wawi_km_co2.co2_ersparnis_kg is
  'Differenz zwischen der CO2-Last eines vergleichbaren Pkw und der des '
  'tatsaechlich genutzten Fahrzeugs (rechenannahme co2_pkw minus co2_rad bzw. '
  'co2_ebike, beide in g CO2e/Pkm, daher /1000 fuer kg) fuer die gefahrenen '
  'Kilometer dieser Zeile. Basiert teilweise auf geschaetzten Kilometern - '
  'siehe anteil_geschaetzt, ohne den diese Zahl unbelegt waere.';

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
 where velocity.hat_rolle('disposition') or velocity.hat_rolle('leitung');

comment on view velocity.v_wawi_stationsauslastung is
  'Zu- und Abgaenge sowie aktueller Fuellstand je Station, fuer Disposition '
  'und Leitung. Zaehlt ausschliesslich abgeschlossene Ausleihen - eine '
  'laufende Fahrt hat an ihrer Endstation noch keinen Zugang. Filtert selbst '
  'ueber velocity.hat_rolle.';
comment on column velocity.v_wawi_stationsauslastung.station_id is
  'Schluessel der Station.';
comment on column velocity.v_wawi_stationsauslastung.stationsnummer is
  'Fachlicher Schluessel der Station.';
comment on column velocity.v_wawi_stationsauslastung.name is
  'Anzeigename der Station.';
comment on column velocity.v_wawi_stationsauslastung.kapazitaet is
  'Zahl der Stellplaetze laut Stammdaten, Nenner von fuellstand.';
comment on column velocity.v_wawi_stationsauslastung.abgaenge is
  'Zahl der abgeschlossenen Ausleihen, die an dieser Station begonnen haben - '
  'wie oft ein Rad hier abgeholt wurde.';
comment on column velocity.v_wawi_stationsauslastung.zugaenge is
  'Zahl der abgeschlossenen Ausleihen, die an dieser Station geendet haben - '
  'wie oft ein Rad hier abgestellt wurde.';
comment on column velocity.v_wawi_stationsauslastung.saldo is
  'zugaenge minus abgaenge. Positiv heisst, die Station sammelt ueber die Zeit '
  'mehr Raeder an, als sie abgibt - ein Hinweis fuer die Disposition, wo '
  'nachverteilt werden muss.';
comment on column velocity.v_wawi_stationsauslastung.belegt is
  'Zahl der Raeder, die aktuell laut fahrrad_position an dieser Station '
  'stehen - der Momentanwert, anders als abgaenge/zugaenge, die ueber die '
  'gesamte Historie zaehlen.';
comment on column velocity.v_wawi_stationsauslastung.fuellstand is
  'belegt geteilt durch kapazitaet, gerundet auf drei Nachkommastellen. NULL '
  'bei einer Station ohne Stellplaetze (kapazitaet = 0), was laut '
  'station_kapazitaet_chk nicht vorkommen sollte, aber nullif schuetzt vor '
  'einer Division durch null statt einem Fehler ohne Kontext.';
