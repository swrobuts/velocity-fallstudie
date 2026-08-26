-- =====================================================================
--  Uebernahmeprotokoll: transliterierte Umlaute in hinweis berichtigen
--
--  1. DER FEHLER.
--     velocity.uebernahme_protokoll.hinweis wurde von mehreren Laeufen
--     von db/betrieb/uebernahme_altdaten.sql, referenzdaten_grundlage.sql,
--     referenzdaten_fahrten.sql, referenzdaten_rechnungen.sql und
--     protokoll_geschrieben_korrigieren.sql geschrieben, bevor deren
--     Quelltexte "ue"/"ae"/"oe" statt "ü"/"ä"/"ö" verwendeten. Ein Teil
--     der Zeilen traegt deshalb bis heute die transliterierte Schreibweise
--     (teils vollstaendig, teils - weil ein frueherer Versuch nur einzelne
--     Woerter traf - nur noch halb).
--
--  2. WARUM HIER AUSNAHMSWEISE EIN PROTOKOLL NACHTRAEGLICH BERICHTIGT WIRD.
--     db/betrieb/uebernahme_altdaten.sql haelt an anderer Stelle fest:
--     "Ein Protokoll, das sich der Gegenwart anpasst, ist kein Protokoll."
--     Das gilt uneingeschraenkt fuer den INHALT eines Protokolls - was ein
--     Lauf gelesen, geschrieben oder ausgelassen hat, wird nicht im
--     Nachhinein passend gemacht (siehe protokoll_geschrieben_korrigieren.sql
--     fuer den einen Fall, in dem tatsaechlich eine Zahl falsch war: dort
--     wurde nichts still ueberschrieben, sondern ein Korrekturvermerk
--     ANGEHAENGT). Hier liegt etwas anderes vor: keine Aussage aendert
--     sich, keine Zahl, kein Datum - nur die Zeichensetzung eines Wortes.
--     "Fachschluessel" und "Fachschlüssel" bezeichnen exakt dasselbe; die
--     Korrektur macht das Protokoll lesbarer, ohne dass es etwas anderes
--     ueber den jeweiligen Lauf aussagt als vorher. Deshalb ein UPDATE
--     direkt auf dem Text, nicht ein Anhaengen wie beim Zahlenfehler oben.
--
--     Ausdruecklich NICHT angefasst: velocity.aenderungsprotokoll (das
--     andere, feldweise Protokoll dieses Schemas - bleibt unberuehrt),
--     jeder Zahlenwert (gelesen/geschrieben/uebersprungen), jeder
--     Zeitstempel (lauf/erstellt_am/geaendert_am) und die Bedeutung jedes
--     Satzes. Nur die Schreibweise von hinweis wechselt.
--
--  3. WIE.
--     Je Zeile ein UPDATE, das den GENAUEN, bisher gespeicherten
--     Wortlaut (alte Schreibweise, ggf. schon halb korrigiert) durch die
--     berichtigte Fassung ersetzt. Kein Ersetzen von Textfragmenten quer
--     durch die Tabelle - jede der zehn betroffenen Formulierungen wird
--     als Ganzes abgeglichen, damit nichts anderes an der Zeile veraendert
--     werden kann als exakt das, was hier dokumentiert ist.
--
--  Idempotent: jedes UPDATE greift nur, solange hinweis noch den alten
--  Wortlaut traegt (WHERE hinweis = '<alt>'). Nach dem ersten Lauf steht
--  ueberall die neue Fassung, ein zweiter Lauf findet keine Zeile mehr.
--
--  Ruecknahme: nicht vorgesehen - eine Rechtschreibkorrektur wird nicht
--  zurueckgenommen.
-- =====================================================================

begin;

-- "Bewusst nicht uebernommen" (Uebernahme-Schritt 8)
update velocity.uebernahme_protokoll
   set hinweis = 'Bewusst nicht übernommen: fachlich nirgends ausgewertet'
 where hinweis = 'Bewusst nicht uebernommen: fachlich nirgends ausgewertet';

-- "Altbetraege" (Uebernahme-Schritt 7)
update velocity.uebernahme_protokoll
   set hinweis = 'Altbeträge als Position BESTANDSUEBERNAHME; historische Preise sind nicht rekonstruierbar'
 where hinweis = 'Altbetraege als Position BESTANDSUEBERNAHME; historische Preise sind nicht rekonstruierbar';

-- "Nur Saetze ..." (Uebernahme-Schritt 1) - vollstaendig alte Schreibweise
update velocity.uebernahme_protokoll
   set hinweis = 'Nur Sätze mit fünfstelliger PLZ; dedupliziert über den Fachschlüssel'
 where hinweis = 'Nur Saetze mit fuenfstelliger PLZ; dedupliziert ueber den Fachschluessel';

-- dieselbe Zeile, halb korrigiert von einem frueheren Versuch
update velocity.uebernahme_protokoll
   set hinweis = 'Nur Sätze mit fünfstelliger PLZ; dedupliziert über den Fachschlüssel'
 where hinweis = 'Nur Sätze mit fuenfstelliger PLZ; dedupliziert über den Fachschluessel';

-- "passwort_hash wird bewusst nicht uebernommen ..." (Uebernahme-Schritt 2)
-- - vollstaendig alte Schreibweise. passwort_hash, auth_uid und
-- auth_kunde_mapping sind Bezeichner und bleiben unveraendert; nur die
-- Woerter drumherum wechseln.
update velocity.uebernahme_protokoll
   set hinweis = 'passwort_hash wird bewusst nicht übernommen. auth_uid nur, wenn das Konto in auth.users tatsächlich existiert; von 3 Einträgen in auth_kunde_mapping sind 3 verwaist (die alte Tabelle hatte keinen Fremdschlüssel).'
 where hinweis = 'passwort_hash wird bewusst nicht uebernommen. auth_uid nur, wenn das Konto in auth.users tatsaechlich existiert; von 3 Eintraegen in auth_kunde_mapping sind 3 verwaist (die alte Tabelle hatte keinen Fremdschluessel).';

-- dieselbe Zeile, halb korrigiert von einem frueheren Versuch
update velocity.uebernahme_protokoll
   set hinweis = 'passwort_hash wird bewusst nicht übernommen. auth_uid nur, wenn das Konto in auth.users tatsächlich existiert; von 3 Einträgen in auth_kunde_mapping sind 3 verwaist (die alte Tabelle hatte keinen Fremdschlüssel).'
 where hinweis = 'passwort_hash wird bewusst nicht übernommen. auth_uid nur, wenn das Konto in auth.users tatsächlich existiert; von 3 Eintraegen in auth_kunde_mapping sind 3 verwaist (die alte Tabelle hatte keinen Fremdschluessel).';

-- "ERFUNDENE Daten ..." (referenzdaten_grundlage.sql), inklusive des
-- spaeter angehaengten Korrekturvermerks aus protokoll_geschrieben_korrigieren.sql.
-- Zahlen (400, 410) und Datumsangaben bleiben unveraendert.
update velocity.uebernahme_protokoll
   set hinweis = 'ERFUNDENE Daten für die Lehre, nicht erhoben. Preisperioden ab 2025-09-01 mit einem Wechsel des Minutenpreises zum 2026-03-01; Tarifkonditionen rückdatiert; rund 400 Mitgliedschaften; erster Mitarbeiter M-0001. [Korrigiert am 25.08.2026: das Feld trug fälschlich den Gesamtbestand 410 statt der 400 in diesem Lauf geschriebenen Zeilen. Ursache war ein Fehler in der Vorgabe, nicht in den Daten.]'
 where hinweis = 'ERFUNDENE Daten fuer die Lehre, nicht erhoben. Preisperioden ab 2025-09-01 mit einem Wechsel des Minutenpreises zum 2026-03-01; Tarifkonditionen rueckdatiert; rund 400 Mitgliedschaften; erster Mitarbeiter M-0001. [Korrigiert am 25.08.2026: das Feld trug faelschlich den Gesamtbestand 410 statt der 400 in diesem Lauf geschriebenen Zeilen. Ursache war ein Fehler in der Vorgabe, nicht in den Daten.]';

-- "ERFUNDENE Fahrten ..." (referenzdaten_fahrten.sql). ausleihe_id und
-- distanz_km sind Bezeichner, die IDs 2687/40374 und die Zeitangaben
-- bleiben unveraendert.
update velocity.uebernahme_protokoll
   set hinweis = 'ERFUNDENE Fahrten für die Lehre, nicht erhoben. ausleihe_id 2687 bis 40374, Zeitraum 2025-09-01 bis 2026-08-24. Beträge durch fn_ausleihe_abrechnen gerechnet, nicht gesetzt. distanz_km bei rund 60 Prozent gesetzt, sonst null.'
 where hinweis = 'ERFUNDENE Fahrten fuer die Lehre, nicht erhoben. ausleihe_id 2687 bis 40374, Zeitraum 2025-09-01 bis 2026-08-24. Betraege durch fn_ausleihe_abrechnen gerechnet, nicht gesetzt. distanz_km bei rund 60 Prozent gesetzt, sonst null.';

-- "ERFUNDENE Rechnungen ..." (referenzdaten_rechnungen.sql) - zwei Laeufe
-- mit unterschiedlicher Zeilenzahl am Ende (0 bzw. 4117), sonst identisch.
update velocity.uebernahme_protokoll
   set hinweis = 'ERFUNDENE Rechnungen für die Lehre, nicht erhoben - berechnet aus den ebenfalls erfundenen Referenzfahrten. Monatslauf über 09/2025 bis 07/2026 (elf Monate); 08/2026 bleibt bewusst unabgerechnet, weil dieser Monat beim Lauf noch nicht vorbei ist. 0 neue Rechnungen in diesem Lauf.'
 where hinweis = 'ERFUNDENE Rechnungen fuer die Lehre, nicht erhoben - berechnet aus den ebenfalls erfundenen Referenzfahrten. Monatslauf ueber 09/2025 bis 07/2026 (elf Monate); 08/2026 bleibt bewusst unabgerechnet, weil dieser Monat beim Lauf noch nicht vorbei ist. 0 neue Rechnungen in diesem Lauf.';

update velocity.uebernahme_protokoll
   set hinweis = 'ERFUNDENE Rechnungen für die Lehre, nicht erhoben - berechnet aus den ebenfalls erfundenen Referenzfahrten. Monatslauf über 09/2025 bis 07/2026 (elf Monate); 08/2026 bleibt bewusst unabgerechnet, weil dieser Monat beim Lauf noch nicht vorbei ist. 4117 neue Rechnungen in diesem Lauf.'
 where hinweis = 'ERFUNDENE Rechnungen fuer die Lehre, nicht erhoben - berechnet aus den ebenfalls erfundenen Referenzfahrten. Monatslauf ueber 09/2025 bis 07/2026 (elf Monate); 08/2026 bleibt bewusst unabgerechnet, weil dieser Monat beim Lauf noch nicht vorbei ist. 4117 neue Rechnungen in diesem Lauf.';

commit;

-- ---- Kontrolle -------------------------------------------------------
-- Prueft genau die zehn alten Formulierungen von oben, nicht einen
-- allgemeinen Umlaut-Verdacht: eine grobe Mustersuche wuerde Bezeichner
-- wie ausleihe_id oder Werte wie BESTANDSUEBERNAHME mittreffen, die
-- bewusst unveraendert bleiben.
do $$
declare
  v_alte_texte text[] := array[
    'Bewusst nicht uebernommen: fachlich nirgends ausgewertet',
    'Altbetraege als Position BESTANDSUEBERNAHME; historische Preise sind nicht rekonstruierbar',
    'Nur Saetze mit fuenfstelliger PLZ; dedupliziert ueber den Fachschluessel',
    'Nur Sätze mit fuenfstelliger PLZ; dedupliziert über den Fachschluessel',
    'passwort_hash wird bewusst nicht uebernommen. auth_uid nur, wenn das Konto in auth.users tatsaechlich existiert; von 3 Eintraegen in auth_kunde_mapping sind 3 verwaist (die alte Tabelle hatte keinen Fremdschluessel).',
    'passwort_hash wird bewusst nicht übernommen. auth_uid nur, wenn das Konto in auth.users tatsächlich existiert; von 3 Eintraegen in auth_kunde_mapping sind 3 verwaist (die alte Tabelle hatte keinen Fremdschluessel).',
    'ERFUNDENE Daten fuer die Lehre, nicht erhoben. Preisperioden ab 2025-09-01 mit einem Wechsel des Minutenpreises zum 2026-03-01; Tarifkonditionen rueckdatiert; rund 400 Mitgliedschaften; erster Mitarbeiter M-0001. [Korrigiert am 25.08.2026: das Feld trug faelschlich den Gesamtbestand 410 statt der 400 in diesem Lauf geschriebenen Zeilen. Ursache war ein Fehler in der Vorgabe, nicht in den Daten.]',
    'ERFUNDENE Fahrten fuer die Lehre, nicht erhoben. ausleihe_id 2687 bis 40374, Zeitraum 2025-09-01 bis 2026-08-24. Betraege durch fn_ausleihe_abrechnen gerechnet, nicht gesetzt. distanz_km bei rund 60 Prozent gesetzt, sonst null.',
    'ERFUNDENE Rechnungen fuer die Lehre, nicht erhoben - berechnet aus den ebenfalls erfundenen Referenzfahrten. Monatslauf ueber 09/2025 bis 07/2026 (elf Monate); 08/2026 bleibt bewusst unabgerechnet, weil dieser Monat beim Lauf noch nicht vorbei ist. 0 neue Rechnungen in diesem Lauf.',
    'ERFUNDENE Rechnungen fuer die Lehre, nicht erhoben - berechnet aus den ebenfalls erfundenen Referenzfahrten. Monatslauf ueber 09/2025 bis 07/2026 (elf Monate); 08/2026 bleibt bewusst unabgerechnet, weil dieser Monat beim Lauf noch nicht vorbei ist. 4117 neue Rechnungen in diesem Lauf.'
  ];
  v_alt integer;
begin
  select count(*) into v_alt
    from velocity.uebernahme_protokoll
   where hinweis = any(v_alte_texte);
  if v_alt <> 0 then
    raise exception 'Noch % Zeile(n) in uebernahme_protokoll.hinweis mit einer der zehn alten Formulierungen', v_alt;
  end if;
  raise notice 'uebernahme_protokoll.hinweis: keine der zehn alten Formulierungen mehr vorhanden';
end;
$$;
