-- =====================================================================
-- t0025 Zusicherung fuer die Umstellung auf v_fahrt_kennzahl
--
-- Die Kilometer- und CO2-Herleitung stand am 05.09.2026 dreimal im
-- Schema: in v_wawi_fahrt_km, v_wawi_fahrten_je_tag_rad und
-- v_wawi_km_co2. Sie wird in die Basissicht v_fahrt_kennzahl gezogen,
-- und die drei lesen kuenftig aus ihr.
--
-- Diese Datei entstand VOR dem Umbau und haelt den Stand von vorher
-- fest. Sie ist damit das Einzige, was zeigen kann, dass die
-- Umstellung nichts verschoben hat. Waere sie nach dem Umbau
-- geschrieben worden, wuerde sie den Umbau gegen sich selbst messen.
--
-- Laeuft eine dieser Pruefungen rot, ist die Umstellung schuld, nicht
-- der Test. Die Werte werden NICHT nachgezogen, ohne dass jemand
-- verstanden hat, warum sie sich geaendert haben.
--
-- ---------------------------------------------------------------------
-- NACHTRAG 05.09.2026: DIE WERTE UNTEN WURDEN NACHGEZOGEN
--
-- Auslöser war db/betrieb/ausreisser_dauerschaetzung.sql, nicht ein
-- weiterer Umbau der Sichten. Ausleihe 269 (Hauptbahnhof -> Hauptbahnhof,
-- 2552 Minuten Ausleihdauer) hatte keine gemessene Distanz; die Luftlinie
-- ist bei gleicher Start- und Endstation null, und der dritte Fall der
-- Herleitung in velocity.v_fahrt_kennzahl rechnete deshalb Dauer mal
-- Reisegeschwindigkeit - 552,93 km, mit weitem Abstand die längste
-- Einzelfahrt der Flotte und die einzige über 60 km (Platz 2: 21,49 km).
-- Auf Entscheidung des Auftraggebers vom 05.09.2026 wurde distanz_km
-- dieser einen Ausleihe auf 12 km gesetzt - siehe den Kopfkommentar
-- jener Datei für Anlass, Messwerte und die Begründung, warum weder
-- gelöscht noch die allgemeine Formel geändert wurde.
--
-- Das ist genau der Fall, den der Kopf oben verlangt: verstanden, nicht
-- nur beobachtet. Deshalb werden die Werte nachgezogen statt stumm
-- überschrieben - und die alten stehen hier, damit ein Diff sie zeigt:
--
--   ALT (galt seit der Umstellung auf v_fahrt_kennzahl, ebenfalls
--   05.09.2026, bis zur Ausreißer-Korrektur):
--     v_wawi_km_co2              47 Zeilen, 49995.4 km, 6612.24 kg CO2, 12052 Fahrten
--     v_wawi_fahrt_km             12052 Zeilen, 49995.23 km
--     v_wawi_fahrten_je_tag_rad   12052 Zeilen, 49995.23 km
--     Verfahren                   aus_dauer 1141, aus_luftlinie 3688, gemessen 7223
--
--   NEU (nachgemessen nach der Korrektur, selbst erhoben, nicht aus dem
--   Auftrag übernommen):
--     v_wawi_km_co2              47 Zeilen, 49454.5 km, 6543.00 kg CO2, 12052 Fahrten
--     v_wawi_fahrt_km             12052 Zeilen, 49454.30 km
--     v_wawi_fahrten_je_tag_rad   12052 Zeilen, 49454.30 km
--     Verfahren                   aus_dauer 1140, aus_luftlinie 3688, gemessen 7224
--
-- Zeilenzahlen und die Aufteilung nach Fahrradtyp/Monat bleiben in allen
-- drei Sichten unberührt - eine einzige Zeile wechselt lediglich das
-- Verfahren von aus_dauer zu gemessen und liefert seither 12 km statt
-- 552,93 km. 49995.23 - 49454.30 = 540,93 km, exakt 552,93 - 12.
-- ---------------------------------------------------------------------
-- NACHTRAG 06.09.2026: DIE WERTE UNTEN WURDEN ERNEUT NACHGEZOGEN
--
-- Auslöser war db/betrieb/demofahrten_rollieren.sql, wieder kein
-- weiterer Umbau der Sichten. Jene Datei richtet einen pg_cron-Job ein,
-- der monatlich den ältesten unabgerechneten Fahrtmonat von K-000001
-- (Clara Fake, Demokonto der Website) in den laufenden Kalendermonat
-- verschiebt, damit das persönliche Dashboard nicht dauerhaft einen
-- leeren "Dieser Monat"-Block zeigt. Das reine VERSCHIEBEN (Update von
-- startzeit/endzeit) ändert an den Summen unten nachweislich nichts -
-- siehe Kopfkommentar jener Datei für die Begründung (jede
-- rechenannahme-Zeile gilt unbegrenzt seit 2025-01-01, ein Zeitstempel-
-- Schwenk innerhalb des Datensatzes trifft also immer dieselbe Annahme).
--
-- Verändert haben die Summen unten ausschließlich die zwölf ECHTEN neuen
-- Fahrten des einmaligen Sofort-Auffüllschritts derselben Datei (Ziel:
-- laufender Monat auf 13 Fahrten für Clara Fake, da ihr ältester Monat
-- nur eine einzige Fahrt hergab). Das ist genau der Fall, den der Kopf
-- oben verlangt: verstanden, nicht nur beobachtet - deshalb NACHGEZOGEN
-- statt stumm überschrieben, mit den alten Werten daneben:
--
--   ALT (galt seit der Ausreißer-Korrektur vom 05.09.2026 bis zum Lauf
--   von demofahrten_rollieren.sql):
--     v_wawi_km_co2              47 Zeilen, 49454.5 km, 6543.00 kg CO2, 12052 Fahrten
--     v_wawi_fahrt_km             12052 Zeilen, 49454.30 km
--     v_wawi_fahrten_je_tag_rad   12052 Zeilen, 49454.30 km
--     Verfahren                   aus_dauer 1140, aus_luftlinie 3688, gemessen 7224
--
--   NEU (nachgemessen nach dem Lauf, selbst erhoben, nicht aus dem
--   Auftrag übernommen):
--     v_wawi_km_co2              49 Zeilen, 49488.5 km, 6547.54 kg CO2, 12064 Fahrten
--     v_wawi_fahrt_km             12064 Zeilen, 49488.23 km
--     v_wawi_fahrten_je_tag_rad   12064 Zeilen, 49488.23 km
--     Verfahren                   aus_dauer 1140, aus_luftlinie 3691, gemessen 7233
--
-- Nachvollzogen: 12064 - 12052 = 12, genau die zwölf neuen Fahrten -
-- das eine VERSCHOBENE Fahrt (Januar 2025 nach September 2026) war
-- bereits in den 12052 gezählt und trägt zur Differenz nichts bei.
-- 49488.23 - 49454.30 = 33,93 km, deckungsgleich mit Claras eigenem
-- Zuwachs (149,4 auf 183,3 km, siehe .superpowers/auftraege/
-- demofahrten-job-bericht.md). Zwei zusätzliche Zeilen in v_wawi_km_co2
-- (47 auf 49): zwei der zwölf neuen Fahrten liefen auf einer Rad-Typ/
-- Monat-Kombination, die im September 2026 zuvor noch keine Zeile hatte.
-- Die Verfahrensverteilung verschiebt sich um genau die zwölf neuen
-- Fahrten (9 gemessen, 3 aus_luftlinie) - aus_dauer bleibt unverändert,
-- weil keine der zwölf eine Rundfahrt (gleiche Start-/Zielstation) ist
-- und die eine verschobene Fahrt ihr Verfahren (aus_luftlinie) durch die
-- reine Zeitverschiebung nicht wechselt.
-- ---------------------------------------------------------------------
-- =====================================================================
create schema if not exists velocity_test;
set search_path = velocity_test, velocity, extensions, public;

-- ---------------------------------------------------------------------
-- NACHTRAG 06.09.2026, ZWEITER AM SELBEN TAG: NEUN FAHRTEN WIEDER WEG
--
-- Derselbe Ausloeser wie beim Nachtrag darueber, nur in die andere
-- Richtung. db/betrieb/demofahrten_rollieren.sql arbeitete zunaechst mit
-- dem festen Ziel 13 Fahrten im laufenden Monat und legte zwoelf neue
-- an. Im Dashboard war sofort zu sehen, dass das zu viel ist: Clara Fake
-- faehrt im Median drei Fahrten im Monat, ihr bester Monat hat sechs -
-- der Block "Dieser Monat" stand damit dauerhaft am Anschlag und zeigte
-- nichts mehr an.
--
-- Das Ziel folgt seither dem eigenen Median plus eins, hier also vier.
-- Der neue Abraeumschritt derselben Datei hat die neun ueberzaehligen
-- Fahrten wieder entfernt - nur unabgerechnete, nur die juengsten, nur
-- bei K-000001; Rechnung und Rechnungsposition blieben unberuehrt, was
-- die Gegenprobe jener Datei einzeln nachweist.
--
--   ALT (galt zwischen den beiden Laeufen desselben Tages):
--     v_wawi_km_co2              49 Zeilen, 49488.5 km, 6547.54 kg CO2, 12064 Fahrten
--     v_wawi_fahrt_km             12064 Zeilen, 49488.23 km
--     v_wawi_fahrten_je_tag_rad   12064 Zeilen, 49488.23 km
--     Verfahren                   aus_dauer 1140, aus_luftlinie 3691, gemessen 7233
--
--   NEU (selbst nachgemessen, nicht aus dem Auftrag uebernommen):
--     v_wawi_km_co2              48 Zeilen, 49461.0 km, 6543.86 kg CO2, 12055 Fahrten
--     v_wawi_fahrt_km             12055 Zeilen, 49460.85 km
--     v_wawi_fahrten_je_tag_rad   12055 Zeilen, 49460.85 km
--     Verfahren                   aus_dauer 1140, aus_luftlinie 3689, gemessen 7226
--
-- Die Differenz geht auf: 12064 - 12055 = 9 entfernte Fahrten, davon
-- zwei aus_luftlinie und sieben gemessen, aus_dauer unveraendert. Die
-- Zeilenzahl von v_wawi_km_co2 faellt von 49 auf 48, weil ein Monat mit
-- nur einer dieser Fahrten dadurch ganz aus der Gruppierung faellt.
-- 49488.23 - 49460.85 = 27,38 km - genau die Summe der neun Fahrten.
-- ---------------------------------------------------------------------
-- ---------------------------------------------------------------------
-- NACHTRAG 06.09.2026, DRITTER AM SELBEN TAG: ZWEI ECHTE TESTFAHRTEN
--
-- Diesmal kein Umbau und kein Job, sondern der Klickdurchlauf der
-- Abnahme: Der offene Punkt "angemeldeter Ablauf" (Registrierung,
-- Anmeldung, Ausleihe starten und beenden) wurde an der
-- veroeffentlichten Seite nachgeholt. Dabei sind zwei ECHTE Fahrten von
-- K-000001 entstanden und regulaer abgerechnet worden:
--
--   #128519  CB-00311  Hauptbahnhof -> Dom,  8 Min, 0,90 EUR
--   #128520  CB-00010  Grombuehl Klinikum, 16 Sek, 0,20 EUR
--
-- Beide ohne gemeldete Distanz - das Schloss meldete nichts, die Sicht
-- schaetzte aus der Luftlinie. Genau deshalb verschiebt sich auch die
-- Verfahrensverteilung: aus_dauer und aus_luftlinie bekommen je eine
-- Fahrt dazu, gemessen bleibt unveraendert.
--
-- Die Fahrten BLEIBEN STEHEN. Sie sind nicht falsch, sondern der Beleg,
-- dass der Ablauf funktioniert; sie zu loeschen hiesse, den Nachweis
-- wegzuraeumen. Die eingefrorenen Werte werden deshalb nachgezogen -
-- wie es der Kopf dieser Datei verlangt: verstanden, nicht nur
-- beobachtet.
--
--   ALT (nach dem Abraeumen des Ueberhangs, selben Tags):
--     v_wawi_km_co2              48 Zeilen, 49461.0 km, 6543.86 kg CO2, 12055 Fahrten
--     v_wawi_fahrt_km             12055 Zeilen, 49460.85 km
--     v_wawi_fahrten_je_tag_rad   12055 Zeilen, 49460.85 km
--     Verfahren                   aus_dauer 1140, aus_luftlinie 3689, gemessen 7226
--
--   NEU (aus dem Testlauf abgelesen, nicht gerechnet):
--     v_wawi_km_co2              48 Zeilen, 49462.4 km, 6544.05 kg CO2, 12057 Fahrten
--     v_wawi_fahrt_km             12057 Zeilen, 49462.24 km
--     v_wawi_fahrten_je_tag_rad   12057 Zeilen, 49462.24 km
--     Verfahren                   aus_dauer 1141, aus_luftlinie 3690, gemessen 7226
--
-- Die Differenz geht auf: 12057 - 12055 = 2 Fahrten, eine je Verfahren,
-- gemessen unveraendert. 49462.24 - 49460.85 = 1,39 km - die geschaetzte
-- Strecke der beiden Fahrten (1,17 km aus der Luftlinie Hauptbahnhof-Dom
-- und 0,22 km aus der Dauer der 16-Sekunden-Fahrt). Die Zeilenzahl von
-- v_wawi_km_co2 bleibt bei 48: beide Fahrten fallen in einen Monat, den
-- es dort schon gibt.
-- ---------------------------------------------------------------------
create or replace function velocity_test.test_um_kennzahlen_unveraendert()
returns setof text language plpgsql as $$
declare
  v_zeilen  bigint;
  v_km      numeric;
  v_co2     numeric;
  v_fahrten bigint;
begin
  -- Ohne diese Vorrichtung liefern alle drei Sichten null Zeilen: ihre
  -- Rollenschranke fragt request.jwt.claims, und ohne Anmeldung ist
  -- dort niemand. Ein Test ohne sie waere immer gruen und wertlos.
  perform velocity_test.fixture_mitarbeiter('t0025');

  select count(*), sum(kilometer), sum(co2_ersparnis_kg), sum(fahrten)
    into v_zeilen, v_km, v_co2, v_fahrten
    from velocity.v_wawi_km_co2;

  return next is(v_zeilen, 48::bigint,
                 'v_wawi_km_co2 hat 48 Zeilen nach demofahrten_rollieren.sql vom 06.09.2026');
  return next is(v_km, 49462.4::numeric,
                 'v_wawi_km_co2 summiert 49462.4 Kilometer nach demofahrten_rollieren.sql vom 06.09.2026');
  return next is(v_co2, 6544.05::numeric,
                 'v_wawi_km_co2 summiert 6544.05 kg CO2 nach demofahrten_rollieren.sql vom 06.09.2026');
  return next is(v_fahrten, 12057::bigint,
                 'v_wawi_km_co2 zaehlt 12057 Fahrten nach demofahrten_rollieren.sql vom 06.09.2026');

  select count(*), round(sum(kilometer), 2) into v_zeilen, v_km
    from velocity.v_wawi_fahrt_km;
  return next is(v_zeilen, 12057::bigint,
                 'v_wawi_fahrt_km hat 12057 Zeilen nach demofahrten_rollieren.sql vom 06.09.2026');
  return next is(v_km, 49462.24::numeric,
                 'v_wawi_fahrt_km summiert 49462.24 Kilometer nach demofahrten_rollieren.sql vom 06.09.2026');

  select count(*), round(sum(kilometer), 2) into v_zeilen, v_km
    from velocity.v_wawi_fahrten_je_tag_rad;
  return next is(v_zeilen, 12057::bigint,
                 'v_wawi_fahrten_je_tag_rad hat 12057 Zeilen nach demofahrten_rollieren.sql vom 06.09.2026');
  return next is(v_km, 49462.24::numeric,
                 'v_wawi_fahrten_je_tag_rad summiert 49462.24 Kilometer nach demofahrten_rollieren.sql vom 06.09.2026');
end;
$$;

-- Die Aufteilung nach Verfahren ist der eigentliche Pruefstein: eine
-- verrutschte Fallunterscheidung in der Drei-Fall-Formel laesst die
-- Gesamtsumme fast unveraendert, verschiebt aber die Anteile. Eine
-- Summenpruefung allein wuerde das durchlassen.
--
-- Gemessen am 05.09.2026 (Schritt 3 des Aufgabenzettels):
-- aus_dauer 1141, aus_luftlinie 3688, gemessen 7223 (Summe 12052 =
-- Zeilenzahl von v_wawi_fahrt_km oben).
--
-- NACHGEZOGEN, ebenfalls 05.09.2026, nach db/betrieb/
-- ausreisser_dauerschaetzung.sql (siehe NACHTRAG im Kopf dieser Datei):
-- aus_dauer 1140, aus_luftlinie 3688, gemessen 7224. Genau eine Zeile
-- wandert von aus_dauer zu gemessen - Ausleihe 269 traegt seither eine
-- vorgegebene Distanz statt einer Dauerschaetzung. aus_luftlinie bleibt
-- unberuehrt, weil die Korrektur nur eine Fahrt mit Luftlinie null
-- betraf.
create or replace function velocity_test.test_um_verfahren_unveraendert()
returns setof text language plpgsql as $$
begin
  perform velocity_test.fixture_mitarbeiter('t0025v');
  return next results_eq(
    $sql$select verfahren, count(*)::bigint
           from velocity.v_wawi_fahrt_km group by verfahren order by verfahren$sql$,
    $sql$values ('aus_dauer'::text, 1141::bigint),
                ('aus_luftlinie'::text, 3690::bigint),
                ('gemessen'::text, 7226::bigint)$sql$,
    'Die Verteilung auf die drei Schaetzverfahren nach demofahrten_rollieren.sql vom 06.09.2026');
end;
$$;
