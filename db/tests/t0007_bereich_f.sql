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

create or replace function velocity_test.test_f_regeln()
returns setof text language plpgsql as $$
begin
  insert into velocity.nutzungsschritt (nummer, titel, beschreibung)
       values (1, 'Finden', 'Freies Rad in der Karte suchen');
  return next throws_ok(
    $sql$insert into velocity.nutzungsschritt (nummer, titel, beschreibung)
         values (1, 'Doppelt', 'Zweiter Schritt mit Nummer 1')$sql$,
    '23505', null, 'Schrittnummern sind eindeutig');

  insert into velocity.kennzahl (schluessel, label, ist_berechnet)
       values ('stationen', 'Stationen', true);
  return next throws_ok(
    $sql$insert into velocity.kennzahl (schluessel, label, anzeigewert, ist_berechnet)
         values ('oekostrom', 'Oekostrom', null, false)$sql$,
    '23514', null, 'Nicht berechnete Kennzahl braucht einen Anzeigewert');
end;
$$;
