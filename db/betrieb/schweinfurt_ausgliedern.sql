-- =====================================================================
-- Schweinfurt aus dem Bestand nehmen
--
-- Die Uebernahme laesst Schweinfurt seit dem 24.08.2026 aus (siehe
-- db/betrieb/uebernahme_altdaten.sql). Wer die Kette auf einer frischen
-- Datenbank faehrt, bekommt es gar nicht erst. Diese Datei raeumt das
-- weg, was bei einem frueheren Lauf schon hineingelaufen ist.
--
-- WARUM
-- Der Altbestand fuehrte drei Stationen in Schweinfurt, vierzig
-- Kilometer entfernt und ohne Verbindung zum Wuerzburger Netz. Solange
-- beide im selben Modell stehen, ist jede Aussage ueber Verfuegbarkeit
-- und Wege mehrdeutig: ein Rad kann die Strecke nicht zuruecklegen, die
-- Karte muss zwei getrennte Flaechen zeigen, und eine Rueckgabe kann
-- ohne Weiteres in der falschen Stadt landen. Genau das ist passiert.
--
-- WAS WEGFAELLT
--   3 Stationen  (Schweinfurt Markt, Schweinfurt Hbf, THWS Schweinfurt)
--   deren Raeder  (Bestand und Position)
--   die Fahrten, die dort begannen oder endeten
--   das Geschaeftsgebiet Schweinfurt
--   die Anschriften DIESER STATIONEN
--
-- WAS BLEIBT
--   Kunden, die in Schweinfurt wohnen, samt ihrer Rechnungsanschrift.
--   Wo jemand wohnt, hat mit dem Geschaeftsgebiet nichts zu tun.
--
-- Die Reihenfolge folgt den Fremdschluesseln von innen nach aussen.
-- Alle Fremdschluessel stehen auf ON DELETE RESTRICT; die Datei
-- funktioniert also nur, wenn wirklich nichts uebersehen wurde.
--
-- WIEDERHOLBAR: laeuft ohne Wirkung, wenn nichts mehr da ist.
-- =====================================================================

do $$
declare
  v_stationen bigint[];
  v_raeder    bigint[];
  v_fahrten   bigint[];
  v_adressen  bigint[];
begin
  select coalesce(array_agg(s.station_id), '{}')
    into v_stationen
    from velocity.station s
    join velocity.adresse a using (adresse_id)
   where a.ort = 'Schweinfurt';

  /* Raeder, die JETZT an einer Schweinfurter Station stehen - und
     zusaetzlich die, die dort ihre Heimatstation hatten und inzwischen
     umgesetzt wurden. Ohne den zweiten Teil blieben zwei Raeder im
     Bestand, die im Altsystem zu Schweinfurt gehoerten; der
     Abgleichsbericht meldete sie prompt als Ueberhang. */
  select coalesce(array_agg(distinct r.fahrrad_id), '{}')
    into v_raeder
    from (
      select p.fahrrad_id
        from velocity.fahrrad_position p
       where p.station_id = any (v_stationen)
      union
      select vf.fahrrad_id
        from velocity.fahrrad vf
        join "cityBikesRental".fahrrad af on af.rahmennummer = vf.rahmennummer
        join "cityBikesRental".station  as_ on as_.station_id = af.station_id
       where as_.ort = 'Schweinfurt'
    ) r;

  select coalesce(array_agg(x.ausleihe_id), '{}')
    into v_fahrten
    from velocity.ausleihe x
   where x.start_station_id = any (v_stationen)
      or x.end_station_id   = any (v_stationen)
      or x.fahrrad_id       = any (v_raeder);

  select coalesce(array_agg(distinct s.adresse_id), '{}')
    into v_adressen
    from velocity.station s
   where s.station_id = any (v_stationen);

  if cardinality(v_stationen) = 0 and cardinality(v_raeder) = 0
     and not exists (select 1 from velocity.geschaeftsgebiet where name = 'Schweinfurt') then
    raise notice 'Schweinfurt ist bereits ausgegliedert.';
    return;
  end if;

  -- Die Pruefung steht bewusst HINTER dem Sammeln. Frueher hing sie an
  -- der Zahl der Stationen - und lief ins Leere, sobald die Stationen
  -- weg waren, waehrend zwei umgesetzte Raeder noch im Bestand standen.
  raise notice 'Schweinfurt: % Stationen, % Raeder, % Fahrten',
    cardinality(v_stationen), cardinality(v_raeder), cardinality(v_fahrten);

  -- 1 Abrechnung und Fahrten
  delete from velocity.entgeltposition where ausleihe_id = any (v_fahrten);
  delete from velocity.ausleihe        where ausleihe_id = any (v_fahrten);

  -- 2 Raeder: erst die Position, dann das Rad. Der aufgeschobene
  --   Constraint-Trigger prueft beim COMMIT; beides in einer Transaktion
  --   zu loeschen ist deshalb zulaessig.
  delete from velocity.fahrrad_position where fahrrad_id = any (v_raeder);
  delete from velocity.fahrrad          where fahrrad_id = any (v_raeder);

  /* 3 Stationen und ihre Anschriften

     NUR die Anschriften der Stationen. In velocity.adresse stehen auch
     Rechnungsanschriften von Kunden, und zwei davon liegen in
     Schweinfurt. Wo jemand WOHNT, hat mit dem Geschaeftsgebiet nichts
     zu tun - er darf dort wohnen und in Wuerzburg fahren. Ein
     "delete ... where ort = 'Schweinfurt'" haette diese Kunden ihrer
     Anschrift beraubt; der Fremdschluessel hat es verhindert. */
  delete from velocity.station where station_id = any (v_stationen);
  delete from velocity.adresse a
   where a.adresse_id = any (v_adressen)
     and not exists (select 1 from velocity.station s where s.adresse_id = a.adresse_id)
     and not exists (select 1 from velocity.kunde  k where k.rechnungsadresse_id = a.adresse_id);

  -- 5 Das Geschaeftsgebiet
  delete from velocity.geschaeftsgebiet where name = 'Schweinfurt';

  raise notice 'Schweinfurt ausgegliedert.';
end;
$$;

-- Gegenprobe: nichts darf uebrigbleiben.
do $$
declare
  v_rest integer;
begin
  -- Geprueft wird das Netz, nicht die Landkarte: Kundenanschriften in
  -- Schweinfurt sind ausdruecklich erlaubt.
  select (select count(*) from velocity.station s
            join velocity.adresse a using (adresse_id) where a.ort = 'Schweinfurt')
       + (select count(*) from velocity.geschaeftsgebiet where name = 'Schweinfurt')
    into v_rest;
  if v_rest > 0 then
    raise exception 'Es sind noch % Schweinfurt-Saetze uebrig', v_rest;
  end if;
end;
$$;
