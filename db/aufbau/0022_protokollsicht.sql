-- =====================================================================
-- 0022 Sicht auf das Aenderungsprotokoll
--
-- Zweck:      velocity.aenderungsprotokoll fuehrt seit Bereich K jede
--             Aenderung mit - 1.090 Zeilen zum Zeitpunkt dieser Datei -,
--             aber keine Oberflaeche konnte es lesen. Sichtbar war es
--             nur ueber eine psql-Verbindung als postgres.
--
--             Das faellt auf, seit ein Agent ueber den MCP-Server
--             schreiben darf: Die Uebung besteht darin, hinterher zu
--             zeigen, WAS er getan hat. Ohne diese Sicht endet die
--             Vorfuehrung an der Stelle, an der sie interessant wird.
-- Objekte:    velocity.v_wawi_protokoll, velocity.v_wawi_radereignis
-- Ruecknahme: DROP VIEW velocity.v_wawi_protokoll;
--
-- ---------------------------------------------------------------------
-- OHNE wert_alt UND wert_neu, UND ZWAR AUS EINEM GRUND
--
-- BERICHTIGUNG. In der ersten Fassung stand hier, das Protokoll sei der
-- Ort, an dem nach Art. 17 DSGVO geloeschte Personendaten ueberleben.
-- Das ist FALSCH: api_kunde_anonymisieren ueberschreibt wert_alt und
-- wert_neu der betroffenen Felder mit '[anonymisiert]', und
-- api_kunde_loeschen (0023) tut dasselbe mit '[geloescht]'. Eine
-- Loeschung kommt im Protokoll also sehr wohl an.
--
-- Der richtige Grund ist ein anderer und wiegt schwerer. Das Protokoll
-- haelt zu JEDER Aenderung den alten und den neuen Wert fest - fuer die
-- ganze Kundschaft, nicht nur fuer geloeschte. Wer eine Telefonnummer
-- korrigiert, hinterlaesst die alte; wer umzieht, beide Adressen. Eine
-- Sicht, die diese zwei Spalten herausgibt, macht aus dem Pruefbuch eine
-- Datenquelle: mit einer einzigen Abfrage haette ein Agent die
-- Aenderungsgeschichte jedes Kunden.
--
-- Was bleibt, beantwortet die Frage der Uebung vollstaendig: WER hat
-- WANN an WELCHEM Datensatz WELCHES Feld geaendert. Womit, steht nicht
-- da - und muss fuer diesen Zweck auch nicht.
--
-- Wer die Werte doch braucht - etwa um zu zeigen, dass eine
-- Anonymisierung im Protokoll ankommt -, sieht in psql nach. Das ist die
-- richtige Huerde dafuer: hoch genug, dass es eine Entscheidung bleibt.
--
-- ---------------------------------------------------------------------
-- NUR FUER DIE LEITUNG
--
-- Dasselbe Zuschnittsprinzip wie bei v_wawi_umsatz_radtyp: Wer
-- nachliest, was Kolleginnen und Kollegen geaendert haben, betreibt
-- Aufsicht. Das ist eine Leitungsaufgabe. 'demo' bleibt draussen - die
-- Sicht traegt Namen von Mitarbeitenden.
-- =====================================================================

create or replace view velocity.v_wawi_protokoll as
select p.protokoll_id,
       p.zeitpunkt,
       p.mitarbeiter_id,
       m.personalnummer,
       -- NULL bei Aenderungen ohne anmeldbaren Ausloeser - etwa den
       -- Ladelaeufen aus db/betrieb/. Der Text sagt das, statt eine
       -- leere Zelle zu zeigen, die wie ein Fehler aussieht.
       coalesce(m.vorname || ' ' || m.nachname, 'ohne Anmeldung') as wer,
       p.tabelle,
       p.datensatz_id,
       p.aktion,
       p.feld
  from velocity.aenderungsprotokoll p
  left join velocity.mitarbeiter m on m.mitarbeiter_id = p.mitarbeiter_id
 where velocity.hat_rolle('leitung');

comment on view velocity.v_wawi_protokoll is
  'Änderungsprotokoll ohne wert_alt und wert_neu: wer wann an welchem Datensatz welches Feld '
  'geändert hat. Die beiden Wertspalten fehlen absichtlich - sie hielten die Änderungsgeschichte '
  'jedes Kunden fest, siehe Kopfkommentar von 0022_protokollsicht.sql. Nur für die Leitung.';
comment on column velocity.v_wawi_protokoll.protokoll_id is 'Surrogatschlüssel der Protokollzeile.';
comment on column velocity.v_wawi_protokoll.zeitpunkt is 'Wann die Änderung geschah.';
comment on column velocity.v_wawi_protokoll.mitarbeiter_id is 'Wer sie ausgelöst hat, NULL bei Läufen ohne Anmeldung.';
comment on column velocity.v_wawi_protokoll.personalnummer is 'Personalnummer desselben Mitarbeiters, NULL bei Läufen ohne Anmeldung.';
comment on column velocity.v_wawi_protokoll.wer is 'Name des Auslösers, sonst „ohne Anmeldung".';
comment on column velocity.v_wawi_protokoll.tabelle is 'Geänderte Tabelle.';
comment on column velocity.v_wawi_protokoll.datensatz_id is 'Schlüssel des geänderten Datensatzes in dieser Tabelle.';
comment on column velocity.v_wawi_protokoll.aktion is 'INSERT, UPDATE oder DELETE.';
comment on column velocity.v_wawi_protokoll.feld is 'Geändertes Feld. Der Wert selbst steht hier bewusst nicht.';

-- ---------------------------------------------------------------------
-- DAS ZWEITE BUCH
--
-- Beim ersten Durchstich mit dem MCP-Server fiel auf, dass ein
-- Statuswechsel an einem Rad in v_wawi_protokoll NICHT auftaucht. Das
-- ist kein Fehler, sondern die Aufteilung des Modells: den
-- Protokolltrigger tragen genau drei Tabellen - kunde, mitarbeiter,
-- station. Raeder fuehren stattdessen eine LEBENSLAUFAKTE,
-- velocity.fahrrad_ereignis (Bereich I, GR21), mit Vorher-Nachher im
-- Klartext.
--
-- Fuer die Frage "was hat der Agent getan" ist das zweite Buch sogar das
-- wichtigere: Raeder umsetzen, Schaeden melden, Auftraege abschliessen -
-- die haeufigsten Eingriffe stehen hier und nicht dort. Ohne diese Sicht
-- endet die Vorfuehrung an derselben Stelle wie zuvor.
create or replace view velocity.v_wawi_radereignis as
select e.ereignis_id,
       e.zeitpunkt,
       f.fahrrad_id,
       f.rahmennummer,
       e.ereignisart,
       e.mitarbeiter_id,
       m.personalnummer,
       coalesce(m.vorname || ' ' || m.nachname, 'ohne Anmeldung') as wer,
       -- Die Bemerkung traegt bei einem Statuswechsel das Vorher-Nachher
       -- ("verfuegbar -> wartung - Grund"). Sie steht hier, anders als
       -- wert_alt/wert_neu drueben: Ein Radstatus ist kein Personendatum.
       e.bemerkung,
       e.beleg_tabelle,
       e.beleg_id
  from velocity.fahrrad_ereignis e
  join velocity.fahrrad f on f.fahrrad_id = e.fahrrad_id
  left join velocity.mitarbeiter m on m.mitarbeiter_id = e.mitarbeiter_id
 where velocity.hat_rolle('werkstatt')
    or velocity.hat_rolle('disposition')
    or velocity.hat_rolle('leitung');

comment on view velocity.v_wawi_radereignis is
  'Lebenslaufakte der Räder: wer wann welchen Status gesetzt hat, mit Vorher-Nachher in der '
  'Bemerkung. Das zweite Protokollbuch neben v_wawi_protokoll - Räder tragen keinen '
  'Protokolltrigger, siehe Kopfkommentar von 0022_protokollsicht.sql.';
comment on column velocity.v_wawi_radereignis.ereignis_id is 'Surrogatschlüssel des Ereignisses.';
comment on column velocity.v_wawi_radereignis.zeitpunkt is 'Wann es geschah.';
comment on column velocity.v_wawi_radereignis.fahrrad_id is 'Das betroffene Rad.';
comment on column velocity.v_wawi_radereignis.rahmennummer is 'Seine Nummer, für die Werkstatt.';
comment on column velocity.v_wawi_radereignis.ereignisart is 'Art des Ereignisses, etwa status_geaendert.';
comment on column velocity.v_wawi_radereignis.mitarbeiter_id is 'Wer es auslöste, NULL ohne Anmeldung.';
comment on column velocity.v_wawi_radereignis.personalnummer is 'Personalnummer desselben, NULL ohne Anmeldung.';
comment on column velocity.v_wawi_radereignis.wer is 'Name des Auslösers, sonst „ohne Anmeldung".';
comment on column velocity.v_wawi_radereignis.bemerkung is 'Freitext, bei Statuswechseln das Vorher-Nachher samt Grund.';
comment on column velocity.v_wawi_radereignis.beleg_tabelle is 'Spur auf den auslösenden Vorgang, keine geprüfte Beziehung.';
comment on column velocity.v_wawi_radereignis.beleg_id is 'Schlüssel dort, ebenfalls nur eine Spur.';

-- ---- Rechte ----------------------------------------------------------
-- Die Sicht braucht ihr eigenes Leserecht; sie erbt nichts von der
-- Tabelle darunter. Ohne dieses grant sieht niemand etwas, auch die
-- Leitung nicht - derselbe Fehler wie bei v_wawi_wartungsprognose am
-- 04.09.2026, siehe dort.
grant select on velocity.v_wawi_protokoll  to authenticated;
grant select on velocity.v_wawi_radereignis to authenticated;

-- Und wie jede neu angelegte Sicht ist sie von aussen erst erreichbar,
-- nachdem PostgREST seinen Schemakatalog neu gelesen hat:
--     bash tools/schema_neu_lesen.sh
