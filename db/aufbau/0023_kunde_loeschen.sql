-- =====================================================================
-- 0023 Vollstaendiges Loeschen eines Kunden
--
-- Zweck:      Art. 17 DSGVO kennt zwei Faelle, und bisher gab es nur
--             einen. api_kunde_anonymisieren loescht die Personendaten
--             und laesst die Zeile stehen - richtig fuer jeden Kunden,
--             an dem Rechnungen haengen, denn § 147 AO und § 257 HGB
--             verlangen zehn Jahre Aufbewahrung.
--
--             Fuer einen Kunden OHNE jeden Beleg gilt das nicht. Wer
--             sich registriert und nie gefahren ist, hinterlaesst nichts
--             Aufbewahrungspflichtiges; ihm die Zeile zu lassen, waere
--             keine Pflichterfuellung, sondern Datenhaltung ohne Grund.
--             Art. 17 Abs. 3 lit. b greift dann naemlich nicht.
-- Objekte:    velocity.api_kunde_loeschen(bigint,text)
-- Ruecknahme: DROP FUNCTION velocity.api_kunde_loeschen(bigint,text);
--
-- ---------------------------------------------------------------------
-- DIE EINZIGE STELLE IM SCHEMA, AN DER EINE FACHZEILE VERSCHWINDET
--
-- Das Haus hat sonst kein Loeschen: 'authenticated' hat nirgends ein
-- DELETE-Recht, Raeder werden ausgemustert, Stationen stillgelegt,
-- Kunden geschlossen. Diese Funktion ist die begruendete Ausnahme, und
-- sie traegt ihre Huerde selbst: Sie verweigert, sobald IRGENDEIN Beleg
-- am Kunden haengt.
--
-- Geprueft wird gegen alle vier Fremdschluessel, die mit 'restrict' auf
-- kunde zeigen - ausleihe, rechnung, mitgliedschaft, schadensmeldung.
-- Das ist kein Zufall, sondern dieselbe Liste, an der die Datenbank die
-- Loeschung ohnehin scheitern liesse; hier scheitert sie nur mit einem
-- verstaendlichen Satz statt mit einem Constraint-Namen.
--
-- zahlungsmittel faellt von selbst mit ('on delete cascade'). Die
-- Rechnungsadresse geht mit, sofern sie niemand sonst benutzt - dieselbe
-- Bedingung wie in api_kunde_anonymisieren.
--
-- ---------------------------------------------------------------------
-- DAS PROTOKOLL WIRD NACH DEM LOESCHEN BEREINIGT, NICHT VORHER
--
-- Der Protokolltrigger auf kunde schreibt beim DELETE die alten Werte
-- mit - Name und E-Mail landen also GERADE DURCH das Loeschen noch
-- einmal im Protokoll. Wer vorher bereinigt, bereinigt das Falsche.
-- Deshalb erst loeschen, dann ueberschreiben.
--
-- Dass das ueberhaupt geht, haengt an einem Detail: Auf
-- aenderungsprotokoll liegt force row level security mit zwei
-- restriktiven Regeln, die UPDATE und DELETE fuer jeden verbieten. Der
-- Eigentuemer postgres traegt aber bypassrls - deshalb kommt eine
-- security-definer-Funktion durch, ein gewoehnlicher Aufrufer nicht.
-- Dasselbe gilt fuer api_kunde_anonymisieren, das seit jeher so
-- verfaehrt.
--
-- ---------------------------------------------------------------------
-- WARUM kundenservice UND NICHT leitung
--
-- Es ist dieselbe rechtliche Pflicht wie bei der Anonymisierung, nur der
-- einfachere Fall. Wer Loeschantraege bearbeitet, soll sie zu Ende
-- bearbeiten koennen. Die Huerde liegt nicht in der Rolle, sondern in
-- der Belegpruefung: Sie laesst genau die Faelle durch, in denen nichts
-- aufzubewahren ist.
-- =====================================================================

create or replace function velocity.api_kunde_loeschen(
    p_kunde_id bigint,
    p_grund    text)
returns text
language plpgsql
security definer
set search_path = velocity, pg_temp
as $$
declare
  v_m        bigint;
  v_adresse  bigint;
  v_belege   text[] := '{}';
  v_n        integer;
begin
  v_m := velocity.fn_rolle_verlangen('kundenservice');

  if p_grund is null or btrim(p_grund) = '' then
    raise exception 'Ein Grund ist anzugeben - er steht hinterher im Protokoll'
      using errcode = '22023';
  end if;

  select rechnungsadresse_id into v_adresse
    from velocity.kunde where kunde_id = p_kunde_id;
  if not found then
    raise exception 'Kunde % nicht gefunden', p_kunde_id using errcode = 'P0001';
  end if;

  -- ---- Die Huerde -----------------------------------------------------
  -- Alle vier auf einmal sammeln statt beim ersten abzubrechen: Wer einen
  -- Loeschantrag bearbeitet, will WISSEN, was dagegensteht, und nicht
  -- viermal nacheinander auf denselben Fehler laufen.
  select count(*) into v_n from velocity.ausleihe where kunde_id = p_kunde_id;
  if v_n > 0 then v_belege := v_belege || format('%s Fahrt(en)', v_n); end if;

  select count(*) into v_n from velocity.rechnung where kunde_id = p_kunde_id;
  if v_n > 0 then v_belege := v_belege || format('%s Rechnung(en)', v_n); end if;

  select count(*) into v_n from velocity.mitgliedschaft where kunde_id = p_kunde_id;
  if v_n > 0 then v_belege := v_belege || format('%s Mitgliedschaft(en)', v_n); end if;

  select count(*) into v_n from velocity.schadensmeldung
   where melder_kunde_id = p_kunde_id;
  if v_n > 0 then v_belege := v_belege || format('%s Schadensmeldung(en)', v_n); end if;

  if array_length(v_belege, 1) > 0 then
    raise exception
      'Kunde % ist nicht löschbar: % hängen daran. Aufbewahrungspflicht nach '
      '§ 147 AO und § 257 HGB. Für diesen Fall ist api_kunde_anonymisieren '
      'der richtige Weg - er entfernt die Personendaten und lässt die Belege stehen.',
      p_kunde_id, array_to_string(v_belege, ', ')
      using errcode = 'P0001';
  end if;

  -- ---- Loeschen -------------------------------------------------------
  -- zahlungsmittel faellt mit (on delete cascade).
  delete from velocity.kunde where kunde_id = p_kunde_id;

  if v_adresse is not null
     and not exists (select 1 from velocity.kunde k
                      where k.rechnungsadresse_id = v_adresse)
     and not exists (select 1 from velocity.station s
                      where s.adresse_id = v_adresse) then
    delete from velocity.adresse where adresse_id = v_adresse;
  end if;

  -- ---- Protokoll ------------------------------------------------------
  -- Jetzt, nicht vorher: Der DELETE oben hat die alten Werte gerade erst
  -- hineingeschrieben.
  update velocity.aenderungsprotokoll
     set wert_alt = case when wert_alt is null then null else '[geloescht]' end,
         wert_neu = case when wert_neu is null then null else '[geloescht]' end
   where tabelle = 'kunde' and datensatz_id = p_kunde_id;

  insert into velocity.aenderungsprotokoll
         (mitarbeiter_id, tabelle, datensatz_id, aktion, feld, wert_alt, wert_neu)
  values (v_m, 'kunde', p_kunde_id, 'DELETE', 'geloescht', null, p_grund);

  return format('Kunde %s vollständig gelöscht - kein Beleg hing daran.', p_kunde_id);
end;
$$;

comment on function velocity.api_kunde_loeschen(bigint, text) is
  'Löscht einen Kunden vollständig - die einzige Stelle im Schema, an der eine Fachzeile '
  'verschwindet. Verweigert, sobald Fahrten, Rechnungen, Mitgliedschaften oder '
  'Schadensmeldungen daran hängen; für die ist api_kunde_anonymisieren zuständig. '
  'Bereinigt das Änderungsprotokoll nach dem Löschen. Nicht rücknehmbar.';

-- ---- Rechte ----------------------------------------------------------
-- Erst der Entzug, dann die Vergabe: PostgreSQL gibt EXECUTE auf eine
-- neue Funktion an PUBLIC, und ohne diese Zeile waere sie fuer anon
-- ausfuehrbar. Derselbe Fehler wie in 0021, dort vom pgTAP-Test
-- test_s_keine_oeffentliche_funktion gefunden.
revoke all on function velocity.api_kunde_loeschen(bigint, text)
  from public, anon, authenticated;
grant execute on function velocity.api_kunde_loeschen(bigint, text) to authenticated;

-- Neue Funktion, gleiche Regel wie bei jeder neuen Sicht: PostgREST
-- kennt sie erst nach   bash tools/schema_neu_lesen.sh
