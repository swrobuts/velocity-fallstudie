-- =====================================================================
-- 0024 Ausstattung des einzelnen Rades
--
-- Zweck:      Bis hierher hatte ein Rad sechs fachliche Spalten -
--             Rahmennummer, Modell, Status, Anschaffung, Ausmusterung -
--             und sonst nichts Eigenes. Alles Technische hing am TYP und
--             galt damit fuer jedes Rad dieser Bauart gleich.
--
--             Das traegt nicht mehr: Raeder unterscheiden sich im
--             Gewicht, werden umgeruestet, bekommen ein anderes Schloss.
--             Diese Datei gibt dem Exemplar seine eigenen Merkmale.
-- Objekte:    Vorbelegung des Bestands mit Ausstattungswerten.
--             Die Spalten legt 0003 an, die Sichten zieht 0018 nach,
--             die Erfassung traegt 0019 - alle drei laufen VOR dieser
--             Datei, und in dieser Reihenfolge liegt der Grund fuer
--             die Aufteilung: Eine Sicht kann nur lesen, was es zum
--             Zeitpunkt ihrer Anlage schon gibt.
-- Ruecknahme: siehe Abschnitt am Dateiende
--
-- ---------------------------------------------------------------------
-- DAS GEWICHT ZIEHT UM - ZUM ZWEITEN MAL
--
-- gewicht_kg stand urspruenglich an fahrradmodell und wanderte auf
-- Einwand hin an fahrradtyp: Unterschiedliche Werte je Modell haetten
-- unterschiedliche Preise verlangt, aber der Tarif haengt am Typ. Diese
-- Begruendung galt der Frage Modell-oder-Typ und ist davon unberuehrt,
-- dass ein EXEMPLAR ein eigenes Gewicht hat.
--
-- Nachgemessen vor dem Umzug: An fahrradtyp.gewicht_kg haengt KEINE
-- Preislogik. Gelesen wird die Spalte nur von v_wawi_flotte und
-- v_wawi_modell, gesetzt von db/betrieb/flottenmodelle_stammdaten.sql,
-- festgehalten von fuenf pgTAP-Zusicherungen in t0003. Die Website zeigt
-- sie nirgends. Der Umzug kostet also zwei Sichten und fuenf
-- Zusicherungen, keinen Betrag.
--
-- Sie faellt am Typ ganz weg, statt als Nennwert stehenzubleiben. Zwei
-- Gewichte nebeneinander waeren genau der Fall, den tools/zahlen_gegen_db.py
-- schon einmal aufgedeckt hat: die Zuladung des Lastenrads stand an vier
-- Stellen mit drei verschiedenen Zahlen.
--
-- ---------------------------------------------------------------------
-- WARUM DIE AUSSTATTUNG AM EXEMPLAR HAENGT UND NICHT AM MODELL
--
-- Fachlich waere beides vertretbar. Alle City-Bikes eines Herstellers
-- haben dieselben Bremsen - bis eines umgeruestet wird. Am Modell waere
-- die Ablage redundanzfrei, am Exemplar ist sie pflegbar.
--
-- Entschieden wurde fuer das Exemplar, weil die Erfassung eines neuen
-- Rades diese Angaben verlangen soll. Am Modell haette die Maske nichts
-- Neues zu fragen; die Merkmale entstuenden bei der Modellanlage und
-- nicht bei der Radanlage. Der Preis dafuer steht hier offen: Solange
-- sich nichts unterscheidet, tragen 198 City-Bikes denselben Wert.
--
-- ---------------------------------------------------------------------
-- DIE FARBE IST HEUTE KEIN MERKMAL
--
-- Jedes Rad der Flotte ist rot. Eine Spalte, die in 278 Zeilen denselben
-- Wert traegt, unterscheidet nichts - sie ist erst dann ein Merkmal,
-- wenn es ein zweites Rad in einer anderen Farbe gibt. Sie steht
-- trotzdem hier, mit Vorgabewert, damit die Erfassung nichts kostet und
-- die Stelle da ist, sobald die Flotte gemischt wird.
--
-- ---------------------------------------------------------------------
-- ERFUNDENE WERTE, UND WORAN SIE SICH HALTEN
--
-- Die Vorbelegung unten setzt Werte, die es so nie gab - die ganze
-- Fallstudie besteht aus solchen. Die Regel dabei ist nicht
-- Beliebigkeit, sondern Widerspruchsfreiheit zu dem, was schon
-- geschrieben steht:
--
--   Nabenschaltung   Die Tarifkarte wirbt seit 0008 mit "8-Gang
--                    Nabenschaltung" fuer das City-Bike. Die Gangzahl
--                    steht am Typ, die Bauart am Rad.
--   Motorfabrikate   "Vantaa Motion M50" und "Vantaa Motion C85", beide
--                    erfunden wie die Hersteller der Fallstudie. Sie
--                    stehen zugleich als Werbemerkmal auf der
--                    Tarifkarte - eine Tatsache, eine Stelle. Vorher
--                    warb dort "Bosch Performance CX", ein echtes
--                    Fabrikat neben erfundenen Herstellern.
--   Gewichte         19 / 24 / 30 kg als MITTELWERT je Typ, mit einer
--                    Streuung von +/- 0,9 kg. Ohne sie waere die Spalte
--                    am Rad so aussagelos wie vorher am Typ.
--
-- Alle Werte leiten sich aus typ_code und fahrrad_id ab: kein random(),
-- damit zwei Laeufe dasselbe Ergebnis haben.
-- =====================================================================

-- ---- Die Ausstattung des Bestands folgt dem Typ ---------------------
-- UNBEDINGT, nicht nur wo noch nichts steht. Die erste Fassung setzte
-- Werte nur in leere Spalten, um von Hand Gepflegtes zu schonen. Das
-- traegt hier nicht: Diese sieben Angaben sind KEINE Eigenschaften des
-- einzelnen Rades, sondern seines Typs - ein City-Bike hat eine
-- Felgenbremse, weil es ein City-Bike ist. Ein Wert, der davon abweicht,
-- waere ein Fehler und kein pflegenswerter Sonderfall.
--
-- Was NICHT angefasst wird: farbe (eigener Vorgabewert, siehe 0003),
-- schlossnummer (haengt am einzelnen Rad) und erstinbetriebnahme_am
-- (ein Datum, das nur dieses Rad kennt - deshalb weiter unten mit
-- coalesce).
--
-- Idempotent, weil jeder Lauf dasselbe Ergebnis hat: Alle Werte leiten
-- sich aus typ_code und fahrrad_id ab, keiner aus random() oder now().
update velocity.fahrrad f
   set gewicht_kg = case t.typ_code when 'CITY'  then 19.0
                                    when 'EBIKE' then 24.0
                                    when 'CARGO' then 30.0
                                    else 20.0 end
                    -- Streuung +/- 0,9 kg in Schritten von 0,3, aus der
                    -- fahrrad_id abgeleitet. Die genannten Zahlen sind
                    -- damit der MITTELWERT je Typ, nicht der Wert jedes
                    -- Rades: Anbauteile und Verschleiss machen den
                    -- Unterschied, und ohne ihn waere die Spalte am Rad
                    -- so aussagelos wie vorher am Typ.
                    + ((f.fahrrad_id % 7) - 3) * 0.3,
       rahmenform  = case t.typ_code when 'CITY' then 'tiefeinsteiger'
                                     else 'diamant' end::velocity.rahmenform,
       -- Die Flotte faehrt ausschliesslich Nabenschaltung. Die ZAHL der
       -- Gaenge steht am Typ: City 8, E-Bike und Cargo 11 (gesetzt in
       -- db/betrieb/flottenmodelle_stammdaten.sql).
       schaltung   = 'nabe'::velocity.schaltungsart,
       -- Beim Lastenrad ist die Scheibenbremse Pflicht, nicht Vorgabe -
       -- trg_fahrrad_bremse_passt_zum_typ in 0003 setzt das durch.
       bremsen     = case t.typ_code when 'CITY' then 'felge'
                                     else 'scheibe' end::velocity.bremsart,
       beleuchtung = case when t.hat_elektro then 'akku'
                          else 'nabendynamo' end::velocity.beleuchtungsart,
       -- Zwei Fabrikate, beide erfunden: das staerkere ins Lastenrad.
       -- Dieselben Namen wirbt die Tarifkarte (0008_referenzdaten.sql).
       motortyp    = case t.typ_code when 'EBIKE' then 'vantaa_m50'
                                     when 'CARGO' then 'vantaa_c85'
                                     else null end::velocity.motorfabrikat,
       reifengroesse_zoll = 28.0,
       -- Nur wo nichts steht: Zwischen Kauf und erster Fahrt liegen
       -- Aufbau und Auslieferung. Null bis 21 Tage, aus der fahrrad_id
       -- abgeleitet - erfunden, aber nachvollziehbar und bei jedem Lauf
       -- gleich. Nie vor dem Kaufdatum, das erzwingt ausserdem
       -- fahrrad_inbetriebnahme_chk.
       erstinbetriebnahme_am = coalesce(
         f.erstinbetriebnahme_am,
         f.angeschafft_am + ((f.fahrrad_id % 22))::integer)
  from velocity.fahrradmodell mo, velocity.fahrradtyp t
 where mo.modell_id = f.modell_id
   and t.typ_id     = mo.typ_id;

-- ---- Ruecknahme ------------------------------------------------------
--   drop trigger trg_fahrrad_motor_passt_zum_typ on velocity.fahrrad;
--   drop function velocity.fn_fahrrad_motor_passt_zum_typ();
--   drop index velocity.fahrrad_schlossnummer_uk;
--   alter table velocity.fahrrad
--     drop column farbe, drop column gewicht_kg, drop column rahmenform,
--     drop column schaltung, drop column bremsen, drop column beleuchtung,
--     drop column antrieb, drop column motortyp,
--     drop column reifengroesse_zoll, drop column schlossnummer;
--   alter table velocity.fahrradtyp add column gewicht_kg numeric(4,1);
--   -- danach 0018 und 0003 erneut laufen lassen, dann db/betrieb/
--   -- flottenmodelle_stammdaten.sql fuer die Typwerte.
--
-- Neue Funktion und neue Spalten: PostgREST kennt sie erst nach
--     bash tools/schema_neu_lesen.sh
