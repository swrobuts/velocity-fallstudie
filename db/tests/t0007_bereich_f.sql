-- =====================================================================
-- t0007 Bereich F: Redaktionsinhalte
-- =====================================================================
create schema if not exists velocity_test;
set search_path = velocity_test, velocity, extensions, public;

create or replace function velocity_test.test_f_struktur()
returns setof text language plpgsql as $$
begin
  return next has_table('velocity'::name, 'faq_eintrag'::name,     'Tabelle faq_eintrag existiert');
  return next has_table('velocity'::name, 'nutzungsschritt'::name, 'Tabelle nutzungsschritt existiert');
  return next has_table('velocity'::name, 'kennzahl'::name,        'Tabelle kennzahl existiert');

  -- Bewusst KEIN Entity-Attribute-Value: es gibt keine generische
  -- Schluessel-Wert-Tabelle fuer Inhalte.
  return next hasnt_table('velocity'::name, 'inhalt_attribut'::name,
                          'Es gibt keine generische EAV-Tabelle fuer Inhalte');
end;
$$;

-- Die Tests nutzen bewusst einen eigenen Schluesselbereich (Nummern ab 90,
-- Schluessel mit Praefix test_): die Referenzdaten aus Schritt 0008 belegen
-- die fachlichen Schluessel 1 bis 3 bzw. 'stationen' und Folgende.
create or replace function velocity_test.test_f_regeln()
returns setof text language plpgsql as $$
begin
  insert into velocity.nutzungsschritt (nummer, titel, beschreibung)
       values (91, 'Finden', 'Freies Rad in der Karte suchen');
  return next throws_ok(
    $sql$insert into velocity.nutzungsschritt (nummer, titel, beschreibung)
         values (91, 'Doppelt', 'Zweiter Schritt mit derselben Nummer')$sql$,
    '23505', null, 'Schrittnummern sind eindeutig');

  insert into velocity.kennzahl (schluessel, label, ist_berechnet)
       values ('test_berechnet', 'Testkennzahl', true);
  return next throws_ok(
    $sql$insert into velocity.kennzahl (schluessel, label, anzeigewert, ist_berechnet)
         values ('test_ohne_wert', 'Ohne Wert', null, false)$sql$,
    '23514', null, 'Nicht berechnete Kennzahl braucht einen Anzeigewert');

  return next throws_ok(
    $sql$insert into velocity.kennzahl (schluessel, label, anzeigewert, ist_berechnet)
         values ('test_berechnet', 'Doppelt', 'x', false)$sql$,
    '23505', null, 'Kennzahlschluessel sind eindeutig');
end;
$$;
