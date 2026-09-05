-- =====================================================================
--  AUSLEIHE 269: DAUERSCHÄTZUNG DURCH EINEN GEMESSENEN WERT ERSETZEN
--
--  ANLASS (gemessen am 05.09.2026)
--
--  velocity.v_fahrt_kennzahl führt Ausleihe 269 vom 15.01.2026 mit
--  552,93 km - der längsten Einzelfahrt der gesamten Flotte und der
--  einzigen über 60 km überhaupt (Platz 2 liegt bei 21,49 km). Start-
--  und Endstation sind identisch (Hauptbahnhof, station_id 31); die
--  Luftlinie ist damit null, und die Drei-Fall-Herleitung in
--  velocity.v_fahrt_kennzahl fällt auf ihren dritten Fall zurück:
--  Dauer mal Reisegeschwindigkeit. Bei 2 552 Minuten (rund 42,5
--  Stunden) Ausleihdauer und 13 km/h (velocity.rechenannahme, Code
--  reisegeschwindigkeit, gültig seit 2025-01-01) ergibt das
--  round(2552 / 60.0 * 13, 2) = 552,93 km.
--
--  DIE SCHWÄCHE liegt in der Annahme des dritten Falls selbst: er setzt
--  die GESAMTE Ausleihdauer als Fahrzeit an. Das trifft auf die
--  weit überwiegende Mehrheit der Fahrten, die über diesen Fall
--  geschätzt werden, zu - nicht aber auf ein Rad, das jemand über zwei
--  Nächte behält. Die Ausleihe stammt aus der Altdatenübernahme
--  (db/betrieb/uebernahme_altdaten.sql); ihre einzige Entgeltposition
--  ist BESTANDSUEBERNAHME 15,00 Euro - kein Zeitentgelt, an dem sich
--  die tatsächliche Fahrzeit ablesen ließe.
--
--  Bereits dokumentiert in doku/specs/2026-09-05-velocity-dashboard-
--  design.md, Abschnitt 3.4: der Ausreißer hebt Konto K-000013 (Kunde
--  2334) auf Rang 1 von 495 nach Kilometern - ein Artefakt, kein
--  Verdienst. Dort standen drei Wege offen; dies hier ist der dritte.
--
--  ENTSCHEIDUNG DES AUFTRAGGEBERS (05.09.2026): distanz_km auf 12 km
--  setzen. velocity.ausleihe.distanz_km kennt laut Spaltenkommentar nur
--  zwei Zustände - null ("nicht gemessen") oder einen Kilometerwert -,
--  keine dritte Kategorie für "geschätzt, aber unwahrscheinlich". Die
--  Sicht stuft die Fahrt danach von selbst um: der dritte Fall
--  (aus_dauer) weicht dem ersten (gemessen), sobald distanz_km nicht
--  mehr null ist.
--
--  WAS NICHT GETAN WIRD, UND WARUM
--
--  1. NICHT GELÖSCHT. Die Ausleihe hat stattgefunden - Fahrrad 485 war
--     vom 15. auf den 17.01.2026 tatsächlich ausgeliehen, unabhängig
--     davon, welche Strecke es dabei zurücklegte. Ein DELETE verschöbe
--     außerdem die Zeilenzahlen 12 274 (velocity.ausleihe insgesamt)
--     und 12 052 (abgeschlossene Fahrten), die in db/tests/ und der
--     Abnahme als Erwartungswerte stehen. Ein vorgegebener Wert lässt
--     jede dieser Zählungen unverändert und macht aus der Schätzung
--     eine Messung, statt die Zeile verschwinden zu lassen.
--
--  2. NICHT DIE FORMEL GEÄNDERT. Der dritte Fall der Herleitung
--     (velocity.v_fahrt_kennzahl, "dauer_minuten / 60.0 * tempo.wert")
--     trägt vor dieser Korrektur 1 141 Fahrten; gemessen ist GENAU EINE
--     davon ein Ausreißer über 60 km, die nächste liegt bei 21,49 km.
--     Die Formel für alle 1 141 wegen einer einzigen Fahrt zu ändern -
--     etwa durch eine Deckelung der Dauer, wie sie
--     db/aufbau/0021_wartungsprognose.sql für die Werkstattliste schon
--     kennt - wäre ein Eingriff in eine Herleitung, die für die übrigen
--     1 140 unauffällig bleibt, und kein Fix für diese eine Zeile. Die
--     Gefahr ist damit nicht gebannt, nur nicht mehr akut: Ausleihe 265
--     bringt es mit 5 422 Minuten auf die längste Ausleihdauer im
--     gesamten Bestand und liefe über denselben dritten Fall auf gut
--     1 175 km hinaus, stünde ihre Start- gleich der Endstation - hier
--     unterscheiden sich beide (Station 41 zu 31), weshalb sie über die
--     Luftlinie geschätzt wird und unauffällig bleibt. Die Gegenprobe
--     unten und die neue Dauerprüfung in db/tests/t0008_referenzdaten.sql
--     wachen deshalb dauerhaft über genau diese Konstellation, statt
--     dass eine einmalige Korrektur der allgemeinen Formel es bei einem
--     einzigen Blick belässt.
--
--  GEMESSENE RANDBEDINGUNGEN
--
--  velocity.ausleihe trägt nur trg_ausleihe_audit (setzt geaendert_am);
--  anders als velocity.kunde gibt es hier keinen
--  fn_protokoll_schreiben-Trigger, den man für den Lauf abschalten
--  müsste. Keine der sechs Entgeltarten (STARTGEBUEHR, ZEITENTGELT,
--  FREIMINUTEN, TARIFRABATT, HOECHSTPREIS_KAPPUNG, BESTANDSUEBERNAHME)
--  hängt von der gefahrenen Distanz ab - die Abrechnung dieser oder
--  einer anderen Ausleihe ist von dieser Änderung nicht betroffen.
--
--  IDEMPOTENT. Die WHERE-Klausel des Updates greift nur, solange
--  distanz_km noch nicht 12 ist; ein zweiter Lauf ändert keine Zeile
--  mehr und hängt keinen zweiten Protokolleintrag an.
--
--  Aufruf:
--    psql -U postgres -d postgres -f db/betrieb/ausreisser_dauerschaetzung.sql
-- =====================================================================

do $$
declare
  v_geaendert integer;
begin
  update velocity.ausleihe
     set distanz_km = 12
   where ausleihe_id = 269
     and distanz_km is distinct from 12;

  get diagnostics v_geaendert = row_count;

  -- Nur ein Lauf, der wirklich etwas geändert hat, gehört ins Buch -
  -- sonst hängt jeder Wiederholungslauf eine Zeile "0 geschrieben" an
  -- und die Historie erzählt Arbeit, die nicht stattgefunden hat.
  if v_geaendert > 0 then
    insert into velocity.uebernahme_protokoll
           (lauf, quelle, ziel, gelesen, geschrieben, uebersprungen, hinweis)
    values (now(), 'Ausreißer-Korrektur (Dauerschätzung)',
            'velocity.ausleihe.distanz_km', 1, 1, 0,
            'Ausleihe 269 (Hauptbahnhof -> Hauptbahnhof, 2552 Minuten '
            'Ausleihdauer) trug distanz_km = null und wurde über den '
            'dritten Fall der Herleitung in velocity.v_fahrt_kennzahl auf '
            '552,93 km geschätzt - längste Einzelfahrt der Flotte, einzige '
            'über 60 km. Auf Entscheidung des Auftraggebers vom 05.09.2026 '
            'durch distanz_km = 12 ersetzt (doku/specs/2026-09-05-velocity-'
            'dashboard-design.md, Abschnitt 3.4). Zeilenzahlen (12274 '
            'Ausleihen, 12052 abgeschlossene) bleiben unverändert, die '
            'Fahrt wechselt in velocity.v_fahrt_kennzahl vom Verfahren '
            'aus_dauer zu gemessen. Keine Entgeltposition ist von der '
            'Änderung betroffen.');
  end if;

  raise notice 'Ausleihe 269: distanz_km auf 12 gesetzt (% Zeile(n) geändert)', v_geaendert;
end;
$$;

-- ---- Gegenprobe -------------------------------------------------------
-- Zwei getrennte Prüfungen: die erste zeigt, ob GENAU diese Zeile den
-- vorgesehenen Wert trägt; die zweite zeigt, ob die Flotte als Ganzes
-- wieder unauffällig ist. Nur die zweite wäre zu schwach - sie bliebe
-- grün, träfe das Update aus Versehen die falsche Zeile, während eine
-- andere Fahrt zufällig unter 50 km liegt.
do $$
declare
  v_distanz  numeric;
  v_ueber_50 integer;
begin
  select distanz_km into v_distanz from velocity.ausleihe where ausleihe_id = 269;
  if v_distanz is distinct from 12 then
    raise exception 'Ausleihe 269 trägt distanz_km = %, erwartet 12', v_distanz;
  end if;

  select count(*) into v_ueber_50
    from velocity.v_fahrt_kennzahl
   where km > 50;

  if v_ueber_50 > 0 then
    raise exception
      'Nach der Korrektur steht/stehen noch % abgeschlossene Fahrt(en) über '
      '50 km in velocity.v_fahrt_kennzahl - Ausleihe 269 war nicht die '
      'einzige Ursache, oder die Korrektur ist nicht angekommen.',
      v_ueber_50;
  end if;

  raise notice 'Gegenprobe bestanden: distanz_km = 12, keine abgeschlossene Fahrt über 50 km';
end;
$$;

-- ---- Rückbau (auskommentiert) ------------------------------------------
-- Alter Zustand: distanz_km war null. Die Fahrt lief damit über das
-- Verfahren aus_dauer mit 552,93 km (siehe ANLASS oben) und war die
-- einzige abgeschlossene Fahrt über 60 km im Bestand. Anders als bei
-- protokoll_geschrieben_korrigieren.sql ist der alte Zustand hier keine
-- bekannt falsche Buchung, sondern eine überholte Schätzung - ein
-- Rückbau ist deshalb technisch vorgesehen, aber nicht als Regelfall
-- gedacht.
--
-- update velocity.ausleihe set distanz_km = null where ausleihe_id = 269;
