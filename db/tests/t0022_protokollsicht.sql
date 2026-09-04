-- =====================================================================
-- t0022 Die beiden Protokollsichten
--
-- Geprueft wird eine ENTSCHEIDUNG, nicht ein Rechenweg:
-- v_wawi_protokoll laesst wert_alt und wert_neu weg, v_wawi_radereignis
-- fuehrt sein Vorher-Nachher im Klartext mit. Das ist kein Zufall und
-- keine Nachlaessigkeit, sondern der Unterschied zwischen einem
-- Personendatum und einem Radstatus (Kopfkommentar von
-- db/aufbau/0022_protokollsicht.sql).
--
-- Eine Entscheidung ohne Test haelt genau so lange, wie sich jemand an
-- sie erinnert. Wer die beiden Spalten morgen wieder hineinschreibt -
-- weil eine Oberflaeche sie haette zeigen koennen -, faellt sonst
-- nirgends auf: t0020 prueft nur, dass demo nichts und die Leitung etwas
-- sieht, und das bliebe beides richtig.
-- =====================================================================
create schema if not exists velocity_test;
set search_path = velocity_test, velocity, extensions, public;

create or replace function velocity_test.test_pr_protokoll_ohne_werte()
returns setof text language plpgsql as $$
begin
  return next has_view('velocity'::name, 'v_wawi_protokoll'::name,
    'Die Sicht auf das Aenderungsprotokoll gibt es');

  -- Der eigentliche Punkt.
  return next hasnt_column('velocity'::name, 'v_wawi_protokoll'::name,
    'wert_alt'::name,
    'v_wawi_protokoll gibt wert_alt NICHT heraus - die Spalte haelt zu jeder '
    'Aenderung den alten Wert fest, fuer die ganze Kundschaft');
  return next hasnt_column('velocity'::name, 'v_wawi_protokoll'::name,
    'wert_neu'::name,
    'v_wawi_protokoll gibt wert_neu NICHT heraus - dieselbe Begruendung');

  -- Ohne diese zwei Zeilen waere der Beweis leer: Hiesse die Spalte in
  -- der Tabelle darunter eines Tages anders, ginge die Pruefung oben
  -- durch, ohne noch irgendetwas zu schuetzen.
  return next has_column('velocity'::name, 'aenderungsprotokoll'::name,
    'wert_alt'::name,
    'Die Tabelle darunter fuehrt wert_alt sehr wohl - sonst pruefte oben '
    'nichts mehr');
  return next has_column('velocity'::name, 'aenderungsprotokoll'::name,
    'wert_neu'::name,
    'Dasselbe fuer wert_neu');

  -- Und die Gegenrichtung: eine Sicht, die alles weglaesst, waere zwar
  -- dicht, aber unbrauchbar. Die Frage der Uebung - wer wann an welchem
  -- Datensatz welches Feld - muss vollstaendig beantwortbar bleiben.
  return next has_column('velocity'::name, 'v_wawi_protokoll'::name,
    'wer'::name, 'WER: der Name steht da');
  return next has_column('velocity'::name, 'v_wawi_protokoll'::name,
    'zeitpunkt'::name, 'WANN: der Zeitpunkt steht da');
  return next has_column('velocity'::name, 'v_wawi_protokoll'::name,
    'datensatz_id'::name, 'AN WELCHEM DATENSATZ: der Schluessel steht da');
  return next has_column('velocity'::name, 'v_wawi_protokoll'::name,
    'feld'::name, 'WELCHES FELD: der Feldname steht da');
end;
$$;

create or replace function velocity_test.test_pr_radereignis_traegt_bemerkung()
returns setof text language plpgsql as $$
begin
  return next has_view('velocity'::name, 'v_wawi_radereignis'::name,
    'Die Lebenslaufakte der Raeder ist als Sicht erreichbar');

  -- Die Asymmetrie ist der Inhalt dieser Pruefung: Hier steht das
  -- Vorher-Nachher ("verfuegbar -> wartung - Grund") ausdruecklich drin,
  -- weil ein Radstatus kein Personendatum ist. Faellt die Spalte weg,
  -- ist die Frage "was hat der Agent getan" nicht mehr zu beantworten.
  return next has_column('velocity'::name, 'v_wawi_radereignis'::name,
    'bemerkung'::name,
    'v_wawi_radereignis fuehrt die Bemerkung mit - anders als drueben, und '
    'aus einem Grund: ein Radstatus ist kein Personendatum');
  return next has_column('velocity'::name, 'v_wawi_radereignis'::name,
    'rahmennummer'::name,
    'Die Rahmennummer steht dabei - die Werkstatt sucht nicht nach IDs');
end;
$$;
