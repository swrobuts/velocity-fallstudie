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
-- Die Vorbelegung des Bestands unten setzt Werte, die es so nie gab -
-- die ganze Fallstudie besteht aus solchen. Die Regel dabei ist nicht
-- Beliebigkeit, sondern Widerspruchsfreiheit zu dem, was schon
-- geschrieben steht:
--
--   CITY   schaltung = nabe        Die Tarifkarte wirbt seit 0008 mit
--                                  "8-Gang Nabenschaltung"
--                                  (fahrradtyp_merkmal, Sortierung 1).
--   EBIKE  motortyp = Bosch …      Ebenfalls aus fahrradtyp_merkmal,
--                                  woertlich uebernommen.
--   CARGO  motortyp = NULL         Der Werbetext nennt nur "Starker
--                                  E-Motor" und kein Fabrikat. Hier wird
--                                  keines erfunden - die Luecke ist
--                                  sichtbar und von Hand zu fuellen.
--
-- Das Gewicht streut deterministisch um den bisherigen Typwert, aus der
-- fahrrad_id abgeleitet: kein random(), damit zwei Laeufe dasselbe
-- Ergebnis haben und die Aufbaukette idempotent bleibt.
-- =====================================================================

-- ---- Vorbelegung des Bestands ---------------------------------------
-- Nur dort, wo noch nichts steht: Ein zweiter Lauf der Aufbaukette darf
-- von Hand gepflegte Werte nicht ueberschreiben. Genau das macht diesen
-- Block idempotent, ohne dass er ein zweites Mal dieselben Zeilen
-- anfasst.
update velocity.fahrrad f
   set gewicht_kg = coalesce(f.gewicht_kg,
         -- Streuung +/- 0,9 kg in Schritten von 0,3 um das bisherige
         -- Typgewicht. Aus der fahrrad_id abgeleitet und damit bei jedem
         -- Lauf dieselbe - random() waere hier ein Idempotenzbruch.
         --
         -- Die drei Basiswerte stehen hier als Zahl und nicht als
         -- Verweis auf t.gewicht_kg, obwohl die Spalte in diesem Moment
         -- noch existiert: Dieselbe Datei loescht sie weiter unten, und
         -- beim ZWEITEN Lauf gaebe es sie nicht mehr. Genau daran ist
         -- der erste Entwurf gescheitert - Abnahmeschritt 2 laesst die
         -- Aufbaukette zweimal laufen. Die Werte stammen aus
         -- db/betrieb/flottenmodelle_stammdaten.sql, wo sie begruendet
         -- sind.
         case t.typ_code when 'CITY'  then 19.5
                         when 'EBIKE' then 24.0
                         when 'CARGO' then 40.0
                         else 20.0 end + ((f.fahrrad_id % 7) - 3) * 0.3),
       rahmenform  = coalesce(f.rahmenform,
         case t.typ_code when 'CITY' then 'tiefeinsteiger'
                         else 'diamant' end::velocity.rahmenform),
       schaltung   = coalesce(f.schaltung,
         case t.typ_code when 'CITY'  then 'nabe'
                         when 'CARGO' then 'nabe'
                         else 'kette' end::velocity.schaltungsart),
       bremsen     = coalesce(f.bremsen,
         case t.typ_code when 'CITY' then 'felge'
                         else 'scheibe' end::velocity.bremsart),
       beleuchtung = coalesce(f.beleuchtung,
         case when t.hat_elektro then 'akku'
              else 'nabendynamo' end::velocity.beleuchtungsart),
       antrieb     = coalesce(f.antrieb, 'kette'::velocity.antriebsart),
       motortyp    = coalesce(f.motortyp,
         case t.typ_code when 'EBIKE' then 'Bosch Performance CX'
                         else null end),
       reifengroesse_zoll = coalesce(f.reifengroesse_zoll,
         case t.typ_code when 'CARGO' then 26.0 else 28.0 end)
  from velocity.fahrradmodell mo, velocity.fahrradtyp t
 where mo.modell_id = f.modell_id
   and t.typ_id     = mo.typ_id
   and (f.gewicht_kg is null or f.rahmenform is null or f.schaltung is null
     or f.bremsen is null or f.beleuchtung is null or f.antrieb is null
     or f.reifengroesse_zoll is null
     or (f.motortyp is null and t.typ_code = 'EBIKE'));

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
