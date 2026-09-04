-- =====================================================================
-- Prueflliste der Werkstatt fuer den heutigen Tag einfrieren
--
-- Zweck:      Ruft die Regel aus 0021_wartungsprognose.sql fuer
--             current_date auf und schreibt das Ergebnis in
--             velocity.wartungsprognose. Danach steht die Liste in der
--             Warenwirtschaft unter Instandhaltung.
-- Aufruf:     python3 db/run.py db/betrieb/wartungsprognose_erzeugen.sql
--
-- WARUM NICHT api_wartungsprognose_erzeugen? Die api_-Funktion prueft
-- velocity.hat_rolle und ist damit an einen angemeldeten Menschen
-- gebunden - richtig fuer den Knopf in der Oberflaeche, unbrauchbar fuer
-- einen Lauf als Eigentuemer, der keine auth.uid() hat. Beide Wege
-- schreiben dieselben Zeilen aus derselben Funktion; nur der
-- Zugangsschutz unterscheidet sich.
--
-- WIEDERHOLBAR, ABER NICHT UEBERSCHREIBEND. Laeuft die Datei zweimal am
-- selben Tag, tut der zweite Lauf nichts: Eine eingefrorene Liste ist
-- die Aufzeichnung dessen, was an diesem Tag vorhergesagt wurde. Wer
-- sie ersetzt, loescht den Massstab, an dem die Regel nach 90 Tagen
-- gemessen werden soll.
-- =====================================================================

insert into velocity.wartungsprognose (
    stichtag, fahrrad_id, rang, nutzungsquote, fahrminuten_seit_reparatur,
    typ_median_minuten, fahrten_seit_reparatur, fahrminuten_180, km_gemessen,
    anteil_mit_distanz, letzte_reparatur, meldungen_bisher,
    regelversion, gilt_bis, betriebsmodus)
select current_date, p.fahrrad_id, p.rang, p.nutzungsquote,
       p.fahrminuten_seit_reparatur, p.typ_median_minuten,
       p.fahrten_seit_reparatur, p.fahrminuten_180, p.km_gemessen,
       p.anteil_mit_distanz, p.letzte_reparatur, p.meldungen_bisher,
       'nutzungsquote_typmedian', current_date + 90, 'probelauf'
  from velocity.fn_wartungsprognose(current_date, 60) p
 where not exists (select 1 from velocity.wartungsprognose w
                    where w.stichtag = current_date);

-- Der Lauf sagt, was er getan hat - eine stille Datenaenderung ist in
-- diesem Projekt keine.
do $$
declare v_n int; v_erst timestamptz;
begin
  select count(*), min(erstellt_am) into v_n, v_erst
    from velocity.wartungsprognose where stichtag = current_date;
  if v_erst < now() - interval '1 minute' then
    raise notice 'Für den % lag bereits eine Liste vor (% Räder, erzeugt am %). '
                 'Nichts geändert.', current_date, v_n, v_erst;
  else
    raise notice 'Prüfliste für den % eingefroren: % Räder, gültig bis %.',
                 current_date, v_n, current_date + 90;
  end if;
end;
$$;
