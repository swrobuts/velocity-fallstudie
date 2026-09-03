-- Einmaliger Betriebslauf vom 03.09.2026: Preisschaetzer fuer die
-- bestehenden Konten einschalten.
--
-- WARUM NICHT IM AUFBAU
--
-- 0002_bereich_a_geschaeftspartner.sql dreht die VORGABE auf true; das
-- gilt fuer neue Konten. Die 1013 bestehenden behalten ihr false, denn
-- eine Vorgabe wirkt nicht rueckwirkend. Diese Datei holt das nach.
--
-- Sie gehoert nicht in den Aufbau, weil der wiederholt laeuft: Er wuerde
-- bei jedem Durchgang zuruecksetzen, was ein Nutzer bewusst ausgeschaltet
-- hat. Ein Aufbau beschreibt das Modell, nicht die Vorlieben der Leute
-- darin.
--
-- WAS VORHER WAR
--
-- Der Schalter stand bei 1013 von 1014 Konten auf aus, und abgemeldet war
-- der Schaetzer im Frontend fest abgeschaltet. Das Merkmal war damit
-- vorhanden, freigegeben, mit Daten gefuellt - und fuer niemanden
-- sichtbar.
--
-- Aufruf:  python3 db/run.py db/betrieb/preisschaetzer_einschalten.sql

update velocity.kunde
   set zeigt_preisschaetzer = true
 where zeigt_preisschaetzer is distinct from true;
