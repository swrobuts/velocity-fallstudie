-- =====================================================================
--  MINDESTENS 40 % DER FLOTTE AKTIV VERLIEHEN, AM JEWEILS AKTUELLEN TAG
--
--  ACHTUNG: ERFUNDENE Bewegungsdaten, wie schon die Referenzfahrten in
--  referenzdaten_fahrten.sql. Wer sie fuer Aussagen ueber echte Nutzung
--  haelt, verwendet sie falsch.
--
--  ANLASS: am 26.08.2026 war bei 275 Raedern genau EINE Ausleihe aktiv
--  (ausleihe_id 291, Rad 599, seit dem 08.01.2026 - ueber sieben Monate
--  offen). Eine Oberflaeche, die das zeigt, wirkt tot.
--
--  "IMMER" KANN EIN FESTER DATENBESTAND NICHT HALTEN: er altert, und
--  was heute eine aktive Ausleihe ist, ist morgen eine alte. Diese
--  Datei erzeugt den Stand deshalb nicht einmalig, sondern bei JEDEM
--  Lauf neu FUER DEN DANN AKTUELLEN TAG:
--
--   Block A raeumt zuerst auf: jede noch 'aktiv' gemeldete Ausleihe,
--   deren startzeit nicht auf den heutigen Tag faellt, ist ein
--   Ueberbleibsel eines frueheren Laufs (oder, beim allerersten Lauf,
--   genau die eine oben genannte Altlast) und wird auf 'storniert'
--   gesetzt - NICHT auf 'abgeschlossen'. Das ist Absicht, nicht
--   Schlamperei: 'abgeschlossen' liefe durch fn_ausleihe_abrechnen oder
--   muesste manuell eine entgeltposition bekommen, und beides wuerde
--   Umsatz, Fahrtenzahl und CO2-Ersparnis der Warenwirtschaft
--   verschieben - Werte, die fest verifiziert sind (siehe
--   .superpowers/sdd/wawi-gestaltung/referenzdaten-report.md) und die
--   laut Auftrag unangetastet bleiben muessen, weil aktive (und damit
--   auch stornierte) Ausleihen nicht abgerechnet sind. 'storniert'
--   bekommt trotzdem eine Endzeit UND einen Endort (die Ortspflicht in
--   ausleihe_endort_chk verlangt beides nur gemeinsam, erlaubt es aber
--   auch fuer 'storniert', nicht nur fuer 'abgeschlossen') - endzeit
--   bleibt sonst null, und "endzeit is null" ist genau das Merkmal, mit
--   dem db/durchstich.py (tools/abnahme.sh Schritt 12) eine "noch
--   laufende Ausleihe" seines Testkunden erkennt. Blieb es leer, sah
--   dieser Schritt eine fremde stornierte Alt-Ausleihe faelschlich als
--   laufend an - beim allerersten Lauf gemessen, siehe die Abweichung
--   weiter unten. status='storniert' allein haelt die Sichten trotzdem
--   fern, weil die alle nur 'abgeschlossen' zaehlen. Das Rad selbst
--   bekommt danach wieder einen Standort und einen Status: 'verfuegbar', ausser es
--   traegt eine offene fahruntauglich-Meldung (wie Rad 599 selbst,
--   Schadensmeldung 1044) - dann 'defekt', sonst wuerde Block A den in
--   Schritt "Kein Rad mit offener fahruntauglicher Meldung ist
--   verfuegbar" (tools/abnahme.sh) frisch gepruefen Zustand gleich
--   wieder verletzen.
--
--   Block B fuellt danach auf: Ziel ist ceil(40 % der Flotte), aus
--   velocity.fahrrad insgesamt gerechnet (nicht nur aus den
--   einsetzbaren) - das deckt sich mit der Zusage "bei 275 Raedern"
--   aus dem Auftrag. Kandidaten sind ausschliesslich Raeder mit Status
--   'verfuegbar' und ohne offene fahruntauglich-Meldung, und Kunden mit
--   Status 'aktiv' (nicht gesperrt, nicht geschlossen) ohne bereits
--   laufende aktive Ausleihe. Jede neue Ausleihe laeuft ueber
--   velocity.fn_ausleihe_starten - dieselbe Funktion, die auch die
--   Website aufruft -, damit GR13 (kein Standort waehrend der Fahrt)
--   und die Ortsermittlung (Station ODER Koordinaten, nie beides)
--   automatisch und nachweislich richtig behandelt werden, statt hier
--   ein zweites Mal nachgebaut zu werden. Die von der Funktion
--   gesetzte Startzeit (now()) wird danach auf einen zufaelligen
--   Zeitpunkt zwischen Mitternacht und dem Laufzeitpunkt verschoben,
--   sonst liefen alle neuen Fahrten auf dieselbe Minute und liefen
--   alle exakt gleich lang.
--
--  GR15 kann durch diesen Lauf nicht verletzt werden: eine Ausleihe
--  ENTFERNT ein Rad von seiner Station (fn_ausleihe_starten setzt
--  station_id der Position auf null), sie stellt nie eines hinzu. Block
--  A stellt Raeder zurueck an eine Station - dort greift derselbe
--  aufgeschobene Constraint-Trigger trg_stellplaetze_pruefen wie
--  ueberall sonst; die Auswahl "meiste freie Plaetze" ist nur eine
--  Vorsichtsmassnahme gegen unnoetige Fehlversuche, keine eigene Pruefung.
--
--  WAS NICHT ANGEFASST WIRD: die Erprobungsdaten der Instandhaltung
--  (Schadensmeldungen 1038-1044, Wartungsauftraege 676-678) - diese
--  Datei liest velocity.schadensmeldung nur, um fahruntaugliche Raeder
--  zu erkennen, und schreibt dort nie hinein. Ebenso unangetastet
--  bleiben alle Ausleihen mit status='abgeschlossen' - das Referenzjahr
--  aus referenzdaten_fahrten.sql. Und: Kunden mit gesetzter auth_uid -
--  echte Anmeldungen, siehe naechster Absatz.
--
--  ABWEICHUNG VOM URSPRUENGLICHEN ENTWURF (beim ersten echten Lauf
--  gefunden, nicht am Schreibtisch): Block B zog den Kundenpool
--  zunaechst nur ueber status='aktiv' und "keine bereits laufende
--  Ausleihe". Das traf zufaellig genau den Kunden hinter
--  Mitarbeiter M-0001/Robert Butscher (kunde_id 2334, einer von nur
--  zwei Kunden mit gesetzter auth_uid) und stattete ihn mit einer
--  erfundenen aktiven Fahrt aus. tools/abnahme.sh Schritt 12
--  (db/durchstich.py) meldet sich fuer denselben Kunden wirklich an,
--  startet selbst eine Ausleihe und prueft "Genau eine laufende
--  Ausleihe" - mit der erfundenen Fahrt daneben waren es zwei, und der
--  Schritt schlug fehl. Block B schliesst Kunden mit auth_uid seither
--  von vornherein aus; Block A schliesst zusaetzlich jede noch aktive
--  Ausleihe eines solchen Kunden, unabhaengig vom Datum - das heilt
--  auch einen bereits bestehenden Fall, nicht nur kuenftige.
--
--  ZWEITE ABWEICHUNG, direkt danach am selben Lauf gefunden: der obige
--  Korrekturlauf setzte fuer den betroffenen Kunden zwar status =
--  'storniert', liess endzeit aber null - db/durchstich.py fragt
--  jedoch nicht status ab, sondern "endzeit is null" als Merkmal fuer
--  "noch laufend", und die zuvor stornierte Fremdfahrt zaehlte damit
--  weiter mit. Erst als Block A zusaetzlich endzeit = now() und
--  end_station_id setzt (siehe dort), wurde Schritt 12 wieder gruen.
--
--  VORBEDINGUNG: db/aufbau/ vollstaendig eingespielt (fn_ausleihe_starten,
--  die GR13-/GR15-Trigger, seit dem Knopf-im-Profilmenue-Auftrag auch
--  velocity.fn_lehrbetrieb_vorfuehrbestand_auffrischen aus
--  0019_wawi_logik.sql - siehe NACHTRAG unten). db/betrieb/
--  referenzdaten_fahrten.sql muss NICHT vorher laufen - diese Datei
--  ruehrt keine Preise an.
--
--  WIEDERHOLBARKEIT: beliebig oft ausfuehrbar, auch mehrfach am selben
--  Tag. Zweiter Lauf am selben Tag: Block A findet nichts mehr mit
--  startzeit <> heute (alles vom ersten Lauf traegt schon das heutige
--  Datum) und tut nichts; Block B findet die Quote bereits erreicht
--  (v_fehlt <= 0) und tut ebenfalls nichts - kein Verdoppeln. Lauf an
--  einem SPAETEREN Tag: Block A stornalisiert alles, was noch das alte
--  Datum traegt, Block B baut die Quote fuer den neuen Tag neu auf -
--  genau das "auf den dann aktuellen Tag bringen" aus dem Auftrag.
--
--  RUECKNAHME: siehe Block am Dateiende (auskommentiert). Sie kann nur
--  den harten Fehlerfall "gar keine aktiven Ausleihen mehr" wieder-
--  herstellen (alles auf 'storniert', Raeder zurueck), nicht den
--  Original-Datensatz von vor dem allerersten Lauf - der eine
--  Alt-Ausleihe 291 war selbst schon ein Widerspruch (aktiv seit sieben
--  Monaten, auf einem als fahruntauglich gemeldeten Rad) und keine
--  Zeile, zu der man zurueckwollte.
-- =====================================================================

-- NACHTRAG (Gestaltungsauftrag "Knopf unters Profil"): das Storno-und-
-- Auffuell-Verfahren, das hier bis dahin als zwei DO-Bloecke stand, lebt
-- jetzt in velocity.fn_lehrbetrieb_vorfuehrbestand_auffrischen
-- (db/aufbau/0019_wawi_logik.sql) - NUR EINE UMSETZUNG, damit diese Datei
-- und der neue Knopf im Profilmenue der Warenwirtschaft nicht zu zwei
-- Fassungen derselben Logik auseinanderlaufen koennen. Die gesamte
-- fachliche Begruendung oben (ANLASS, Block A/Block B, GR13/GR15, die
-- beiden nachtraeglich gefundenen Abweichungen, Wiederholbarkeit) gilt
-- unveraendert fort und steht bewusst weiter HIER, nicht in der
-- Funktion: sie ist die Betriebsgeschichte dieser Datenbank, hier zuerst
-- erarbeitet. Die Funktion traegt nur noch das ausfuehrbare Verfahren
-- selbst, mit knapperen Verweisen auf diese Begruendung.
--
-- OHNE EIGENE ROLLENPRUEFUNG in der Funktion, absichtlich: diese Datei
-- laeuft ueber db/run.py mit der vollen Verbindung aus .env, nicht ueber
-- PostgREST - es gibt dabei keine angemeldete Sitzung und keinen
-- auth.uid(). velocity.api_lehrbetrieb_vorfuehrbestand_auffrischen (die
-- duenne, fn_rolle_verlangen('leitung')-pruefende Huelle um dieselbe
-- Funktion) ist der Weg, den NUR die Oberflaeche nimmt.
begin;

do $$
declare v_ergebnis record;
begin
  select * into v_ergebnis from velocity.fn_lehrbetrieb_vorfuehrbestand_auffrischen();
  raise notice 'Alte aktive Ausleihen storniert und Raeder zurueckgebucht: %', v_ergebnis.storniert;
  raise notice 'Neue aktive Ausleihen: % (jetzt % von % Raedern aktiv, % Prozent)',
    v_ergebnis.neu, v_ergebnis.aktiv, v_ergebnis.flotte, v_ergebnis.anteil_prozent;
end;
$$;

commit;

-- ---- Kontrolle -------------------------------------------------------
do $$
declare
  v_gesamt   integer;
  v_aktiv    integer;
  v_anteil   numeric;
  v_gr13     integer;
  v_gr15     integer;
  v_verboten integer;
begin
  select count(*) into v_gesamt from velocity.fahrrad;
  select count(*) into v_aktiv  from velocity.ausleihe where status = 'aktiv';
  v_anteil := round(100.0 * v_aktiv / nullif(v_gesamt, 0), 1);

  if v_aktiv::numeric / nullif(v_gesamt, 0) < 0.40 then
    raise exception 'Mindestquote verfehlt: % von % Raedern aktiv (% Prozent)',
      v_aktiv, v_gesamt, v_anteil;
  end if;

  -- GR13, aus den Basisdaten nachgerechnet statt dem Trigger vertraut.
  -- "Kein Ort" heisst: die Positionszeile fehlt ganz, ODER sie steht da,
  -- traegt aber weder Station noch Koordinaten (fn_ausleihe_starten
  -- loescht die Zeile nicht, sondern leert nur ihre Felder - deshalb
  -- reicht "Zeile vorhanden" hier nicht als Pruefung).
  select count(*) into v_gr13
    from velocity.fahrrad f
    left join velocity.fahrrad_position p on p.fahrrad_id = f.fahrrad_id
   where (
           (p.fahrrad_id is null or (p.station_id is null and p.latitude is null))
           and f.status not in ('ausgeliehen', 'ausgemustert')
         )
      or (
           (p.fahrrad_id is not null and (p.station_id is not null or p.latitude is not null))
           and f.status = 'ausgeliehen'
         );
  if v_gr13 > 0 then
    raise exception 'GR13 verletzt bei % Rad/Räedern', v_gr13;
  end if;

  -- GR15, aus den Basisdaten nachgerechnet.
  select count(*) into v_gr15
    from velocity.station s
   where (select count(*) from velocity.fahrrad_position p where p.station_id = s.station_id)
         > s.kapazitaet;
  if v_gr15 > 0 then
    raise exception 'GR15 verletzt an % Station(en)', v_gr15;
  end if;

  -- Kein Rad mit offener fahruntauglicher Meldung ist verfuegbar
  -- (derselbe Schritt wie in tools/abnahme.sh).
  select count(*) into v_verboten
    from velocity.fahrrad f
   where f.status = 'verfuegbar' and exists (
     select 1 from velocity.schadensmeldung sm
      where sm.fahrrad_id = f.fahrrad_id and sm.schwere = 'fahruntauglich'
        and sm.status in ('offen', 'in_arbeit'));
  if v_verboten > 0 then
    raise exception '% fahruntaugliche(s) Rad/Räder als verfügbar markiert', v_verboten;
  end if;

  raise notice 'Mindestquote erreicht: % von % Rädern aktiv (% Prozent), GR13/GR15 in Ordnung',
    v_aktiv, v_gesamt, v_anteil;
end;
$$;

-- ---- Ruecknahme ------------------------------------------------------
-- Kein Rueckweg zum Zustand vor dem allerersten Lauf - siehe
-- Kopfkommentar. Dieser Block bringt nur den harten Fehlerfall
-- "gar keine erfundene aktive Ausleihe mehr uebrig" in einen sauberen
-- Zustand zurueck: alles, was diese Datei je aktiv gesetzt hat (also
-- alles mit status='aktiv' ausser einer echten, heute wirklich neu
-- gestarteten Fahrt von der Website - die laesst sich davon nicht mehr
-- unterscheiden, das ist der Preis des Verzichts auf eine eigene
-- Markierungsspalte), auf 'storniert' setzen und die Raeder zurueckbuchen.
--
-- do $$
-- declare v_r record; v_station bigint;
-- begin
--   for v_r in select ausleihe_id, fahrrad_id from velocity.ausleihe where status = 'aktiv' loop
--     select station_id into v_station from velocity.station
--      where betriebszeitraum @> current_date
--      order by kapazitaet - (select count(*) from velocity.fahrrad_position p
--                              where p.station_id = station_id) desc limit 1;
--     update velocity.ausleihe set status = 'storniert', endzeit = now(), end_station_id = v_station
--      where ausleihe_id = v_r.ausleihe_id;
--     update velocity.fahrrad_position set station_id = v_station, latitude = null,
--            longitude = null, aktualisiert_am = now() where fahrrad_id = v_r.fahrrad_id;
--     update velocity.fahrrad set status = 'verfuegbar' where fahrrad_id = v_r.fahrrad_id;
--   end loop;
-- end;
-- $$;
