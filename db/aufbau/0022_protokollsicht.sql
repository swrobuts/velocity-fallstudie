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
-- Objekte:    velocity.v_wawi_protokoll
-- Ruecknahme: DROP VIEW velocity.v_wawi_protokoll;
--
-- ---------------------------------------------------------------------
-- OHNE wert_alt UND wert_neu, UND ZWAR AUS EINEM GRUND
--
-- Das Protokoll haelt zu jeder Aenderung den alten und den neuen Wert
-- fest. Bei einer Anonymisierung nach Art. 17 DSGVO heisst das: Vorname,
-- Nachname und E-Mail sind aus velocity.kunde geloescht und stehen im
-- Protokoll weiter. Es ist der Ort, an dem geloeschte Personendaten
-- ueberleben.
--
-- Eine Sicht, die diese beiden Spalten herausgibt, hoebe die Loeschung
-- praktisch auf - fuer jeden, der die Rolle leitung traegt, und ueber
-- den MCP-Server auch fuer einen Agenten. Sie fehlen deshalb.
--
-- Was bleibt, beantwortet die Frage der Uebung vollstaendig: WER hat
-- WANN an WELCHEM Datensatz WELCHES Feld geaendert. Womit, steht nicht
-- da - und muss fuer diesen Zweck auch nicht.
--
-- Wer den anderen Fall lehren will - dass eine Loeschung im Protokoll
-- nicht ankommt -, zeigt die Tabelle in psql. Das ist die richtige
-- Huerde dafuer: hoch genug, dass es eine Entscheidung bleibt.
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
  'geändert hat. Die beiden Wertspalten fehlen absichtlich - sie halten nach Art. 17 gelöschte '
  'Personendaten fest, siehe Kopfkommentar von 0022_protokollsicht.sql. Nur für die Leitung.';
comment on column velocity.v_wawi_protokoll.protokoll_id is 'Surrogatschlüssel der Protokollzeile.';
comment on column velocity.v_wawi_protokoll.zeitpunkt is 'Wann die Änderung geschah.';
comment on column velocity.v_wawi_protokoll.mitarbeiter_id is 'Wer sie ausgelöst hat, NULL bei Läufen ohne Anmeldung.';
comment on column velocity.v_wawi_protokoll.personalnummer is 'Personalnummer desselben Mitarbeiters, NULL bei Läufen ohne Anmeldung.';
comment on column velocity.v_wawi_protokoll.wer is 'Name des Auslösers, sonst „ohne Anmeldung".';
comment on column velocity.v_wawi_protokoll.tabelle is 'Geänderte Tabelle.';
comment on column velocity.v_wawi_protokoll.datensatz_id is 'Schlüssel des geänderten Datensatzes in dieser Tabelle.';
comment on column velocity.v_wawi_protokoll.aktion is 'INSERT, UPDATE oder DELETE.';
comment on column velocity.v_wawi_protokoll.feld is 'Geändertes Feld. Der Wert selbst steht hier bewusst nicht.';

-- ---- Rechte ----------------------------------------------------------
-- Die Sicht braucht ihr eigenes Leserecht; sie erbt nichts von der
-- Tabelle darunter. Ohne dieses grant sieht niemand etwas, auch die
-- Leitung nicht - derselbe Fehler wie bei v_wawi_wartungsprognose am
-- 04.09.2026, siehe dort.
grant select on velocity.v_wawi_protokoll to authenticated;

-- Und wie jede neu angelegte Sicht ist sie von aussen erst erreichbar,
-- nachdem PostgREST seinen Schemakatalog neu gelesen hat:
--     bash tools/schema_neu_lesen.sh
