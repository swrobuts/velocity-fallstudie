-- =====================================================================
-- 0019 Schreibende Funktionen der Warenwirtschaft
--
-- Zweck:      Alles, was die Warenwirtschaft aendert, laeuft hier
--             hindurch. Die Oberflaeche schreibt nie in eine Tabelle -
--             dieselbe Regel wie fuer die Website, und tools/abnahme.sh
--             prueft sie von aussen.
-- Objekte:    velocity.fn_rolle_verlangen, velocity.api_rad_anlegen,
--             api_rad_status_setzen, api_rad_ausmustern,
--             api_station_anlegen, api_station_stilllegen,
--             api_kunde_anlegen, api_kunde_aktualisieren, api_kunde_sperren,
--             api_kunde_auskunft (Art. 15 DSGVO), api_kunde_anonymisieren
--             (Art. 17 DSGVO statt DELETE), api_schaden_melden,
--             api_auftrag_eroeffnen, api_auftrag_erledigen,
--             velocity.seq_wartungsauftrag; ausserdem das Anhaengen des
--             Aenderungsprotokolls (GR19) an mitarbeiter und station
--             (bewusst NICHT an fahrrad, siehe Kommentar unten).
-- Ruecknahme: DROP FUNCTION fuer dieselben Namen. Fuer das Protokoll je
--             DROP TRIGGER trg_<tabelle>_protokoll auf mitarbeiter,
--             station. DROP SEQUENCE velocity.seq_wartungsauftrag.
-- =====================================================================

-- Jede api_-Funktion beginnt mit fn_rolle_verlangen. Der Rueckgabewert
-- ist die mitarbeiter_id - so wird in einem Schritt geprueft UND der
-- Verursacher ermittelt, statt zweimal dasselbe nachzuschlagen.
--
-- fn_rolle_verlangen bleibt bewusst OHNE api_-Praefix und damit von der
-- Sweep-Ausnahme in test_s_keine_oeffentliche_funktion nicht erfasst:
-- sie ist interne Fachlogik, keine Schnittstelle. Wer sie direkt
-- aufrufen koennte, bekaeme die Mitarbeiter-ID zu jeder beliebigen
-- Rolle - ohne selbst etwas anzulegen.
--
-- Hier stand bis zur Gesamtpruefung vom 25.08.2026 der Hinweis,
-- db/aufbau/0011_sicherheit.sql muesse nach dieser Datei erneut laufen,
-- um jeder neu angelegten Funktion das automatische
-- PUBLIC-Ausfuehrungsrecht zu entziehen. Das stimmte, als 0019 noch
-- keinen eigenen Rechteblock hatte - inzwischen erledigt der Abschnitt
-- "Rechte" am Ende dieser Datei genau das selbst (revoke all on all
-- functions in schema velocity from public, anon, authenticated, dann
-- gezielte GRANTs), aus demselben Grund, aus dem 0011 seine eigene
-- ALTER-DEFAULT-PRIVILEGES-Zeile verloren hat: sich auf eine andere
-- Datei zu verlassen, die man vergessen kann, ist kein Schutz. Wer der
-- alten Anweisung folgte und 0011 nach 0019 erneut laufen liess, entzog
-- damit authenticated wieder alle sechzehn Warenwirtschaftsfunktionen,
-- beide Rollenfunktionen und fn_luftlinie_km - und damit jede
-- v_wawi_-Sicht (nachgemessen). 0011 muss nach 0019 NICHT mehr laufen.
create or replace function velocity.fn_rolle_verlangen(p_code text)
returns bigint
language plpgsql
stable
security definer
set search_path = velocity, pg_temp
as $$
declare v_m bigint;
begin
  v_m := velocity.mitarbeiter_id_aus_auth();
  if v_m is null then
    raise exception 'Kein aktiver Mitarbeiter angemeldet'
      using errcode = '42501';
  end if;
  if not velocity.hat_rolle(p_code) then
    raise exception 'Rolle % erforderlich', p_code
      using errcode = '42501';
  end if;
  return v_m;
end;
$$;

-- ---- Flotte ----------------------------------------------------------
-- p_station_id ist PFLICHT, kein Vorgabewert. GR13 verlangt fuer jedes
-- Rad, das nicht gerade unterwegs oder ausgemustert ist, einen Ort. Ein
-- neues Rad steht auf 'verfuegbar' - ohne Station scheitert der Trigger
-- trg_radposition_pruefen mit "braucht damit einen Standort". Nachgemessen,
-- nicht vermutet: der erste Entwurf hatte hier "default null" und waere
-- bei jedem Aufruf ohne Station gescheitert.
--
-- Fachlich ist das auch richtig: ein Rad, das ins System kommt, steht
-- irgendwo. Wer es nicht weiss, hat es nicht angeschafft.
--
-- Die eigene Pruefung unten (p_station_id is null) lauft dem Trigger
-- ohnehin zuvor: trg_radposition_ort ist ein aufgeschobener
-- Constraint-Trigger und feuert erst beim COMMIT, lange nachdem diese
-- Funktion zurueckgekehrt ist. Ohne die eigene Pruefung liesse sich ein
-- Rad zwar anlegen, aber erst am Ende der ganzen Transaktion mit einer
-- Fehlermeldung zurueckweisen, die nichts mehr von GR13 weiss.
create or replace function velocity.api_rad_anlegen(
  p_rahmennummer text, p_modell_id bigint, p_station_id bigint
)
returns bigint
language plpgsql
security definer
set search_path = velocity, pg_temp
as $$
declare v_m bigint; v_f bigint;
begin
  v_m := velocity.fn_rolle_verlangen('disposition');

  if p_station_id is null then
    raise exception 'Ein neues Rad braucht eine Station (GR13)'
      using errcode = 'P0001';
  end if;

  insert into velocity.fahrrad (rahmennummer, modell_id, status, angeschafft_am)
       values (p_rahmennummer, p_modell_id, 'verfuegbar', current_date)
    returning fahrrad_id into v_f;

  -- GR12 aus Phase 1: ein Rad ohne bekannten Standort laesst sich nicht
  -- ausleihen. Ein neues Rad bekommt deshalb sofort eine Position.
  insert into velocity.fahrrad_position (fahrrad_id, station_id, akkustand_prozent)
       values (v_f, p_station_id, 100);

  insert into velocity.fahrrad_ereignis
         (fahrrad_id, ereignisart, mitarbeiter_id, bemerkung, beleg_tabelle, beleg_id)
  values (v_f, 'angeschafft', v_m, 'Neu ins System aufgenommen', 'fahrrad', v_f);

  return v_f;
end;
$$;

-- Werkstatt UND Disposition duerfen Status setzen: die eine schickt ein
-- Rad in die Wartung, die andere holt es als verfuegbar zurueck. Eine
-- gemeinsame Funktion statt zweier fast gleicher - beide pruefen exakt
-- dieselben Nebenbedingungen (kein Ausmustern hierueber, Ereignis nur
-- einmal), es unterscheidet sich nur die verlangte Rolle.
create or replace function velocity.api_rad_status_setzen(
  p_fahrrad_id bigint, p_status text, p_bemerkung text default null
)
returns void
language plpgsql
security definer
set search_path = velocity, pg_temp
as $$
declare v_m bigint;
begin
  if velocity.hat_rolle('werkstatt') then
    v_m := velocity.fn_rolle_verlangen('werkstatt');
  else
    v_m := velocity.fn_rolle_verlangen('disposition');
  end if;

  if p_status = 'ausgemustert' then
    raise exception 'Zum Ausmustern api_rad_ausmustern verwenden'
      using errcode = 'P0001';
  end if;

  -- Dieselbe Regel wie in fn_ausleihe_beenden (0009) und
  -- api_auftrag_erledigen (oben in dieser Datei): ein Rad mit offener
  -- fahruntauglicher Meldung darf nicht als 'verfuegbar' markiert
  -- werden. Ohne diese Pruefung liess sich ein Rad direkt nach
  -- api_schaden_melden(..., 'fahruntauglich') ueber genau diese
  -- Funktion zurueck in die Ausleihliste setzen, waehrend die Meldung
  -- offen blieb - nachgestellt und bestaetigt. Andere Zielstaende
  -- bleiben unberuehrt.
  if p_status = 'verfuegbar' and exists (
    select 1 from velocity.schadensmeldung sm
     where sm.fahrrad_id = p_fahrrad_id
       and sm.schwere = 'fahruntauglich'
       and sm.status in ('offen', 'in_arbeit')
  ) then
    raise exception 'Rad % hat eine offene fahruntaugliche Meldung, kann nicht verfuegbar werden',
      p_fahrrad_id using errcode = 'P0001';
  end if;

  update velocity.fahrrad
     set status = p_status::velocity.fahrrad_status
   where fahrrad_id = p_fahrrad_id;
  if not found then
    raise exception 'Rad % nicht gefunden', p_fahrrad_id using errcode = 'P0001';
  end if;

  -- Der Trigger trg_fahrrad_ereignis (0015, GR21) hat den Wechsel beim
  -- obigen UPDATE bereits als eigene Zeile festgehalten - ein zweites
  -- insert hier wuerde die Lebenslaufakte verdoppeln. Diese Funktion
  -- darf nur die Begruendung nachtragen, an der zuletzt fuer dieses Rad
  -- entstandenen Zeile.
  if p_bemerkung is not null then
    update velocity.fahrrad_ereignis
       set bemerkung = bemerkung || ' - ' || p_bemerkung, mitarbeiter_id = v_m
     where ereignis_id = (select max(ereignis_id) from velocity.fahrrad_ereignis
                           where fahrrad_id = p_fahrrad_id);
  end if;
end;
$$;

create or replace function velocity.api_rad_ausmustern(
  p_fahrrad_id bigint, p_grund text
)
returns void
language plpgsql
security definer
set search_path = velocity, pg_temp
as $$
declare v_m bigint;
begin
  v_m := velocity.fn_rolle_verlangen('disposition');

  -- GR20: ein Rad, auf dem gerade jemand sitzt, verschwindet nicht aus
  -- dem Bestand. Die Pruefung steht hier und nicht als CHECK, weil sie
  -- zwei Tabellen betrifft.
  if exists (select 1 from velocity.ausleihe a
              where a.fahrrad_id = p_fahrrad_id and a.status = 'aktiv') then
    raise exception 'Rad % ist in Fahrt und kann nicht ausgemustert werden', p_fahrrad_id
      using errcode = 'P0001';
  end if;

  update velocity.fahrrad
     set status = 'ausgemustert', ausgemustert_am = current_date
   where fahrrad_id = p_fahrrad_id;
  if not found then
    raise exception 'Rad % nicht gefunden', p_fahrrad_id using errcode = 'P0001';
  end if;

  -- Ein ausgemustertes Rad braucht laut GR13 keinen Standort mehr - der
  -- dritte erlaubte Zustand neben "an einer Station" und "in Fahrt". Die
  -- Position wird deshalb entfernt statt sie veraltet stehen zu lassen:
  -- sie zeigte sonst dauerhaft den letzten Abstellort eines Rades, das
  -- gar nicht mehr im Bestand faehrt, und zaehlte fuer GR15 weiter gegen
  -- die Kapazitaet der Station. fahrrad_ereignis und die abgerechneten
  -- Fahrten haengen an fahrrad_id, nicht an fahrrad_position - die
  -- Lebenslaufakte bleibt davon unberuehrt.
  delete from velocity.fahrrad_position where fahrrad_id = p_fahrrad_id;

  -- p_grund kann leer oder NULL ankommen - der Funktionskopf erzwingt
  -- kein NOT NULL. "bemerkung || ' - ' || p_grund" ergaebe bei
  -- p_grund = null insgesamt NULL und loeschte damit stillschweigend
  -- die GR21-Begruendung, die der Trigger trg_fahrrad_ereignis beim
  -- obigen UPDATE gerade erst geschrieben hat. api_rad_status_setzen
  -- vermeidet genau das mit einer eigenen IF-Pruefung; hier fehlte
  -- dieselbe Vorsicht. nullif(btrim(...), '') faengt zusaetzlich einen
  -- nur aus Leerzeichen bestehenden Grund ab.
  update velocity.fahrrad_ereignis
     set mitarbeiter_id = v_m,
         bemerkung = bemerkung || coalesce(' - ' || nullif(btrim(p_grund), ''), '')
   where ereignis_id = (select max(ereignis_id) from velocity.fahrrad_ereignis
                         where fahrrad_id = p_fahrrad_id);
end;
$$;

-- ---- Stationen -------------------------------------------------------
create or replace function velocity.api_station_anlegen(
  p_name text, p_strasse text, p_hausnummer text, p_plz text, p_ort text,
  p_latitude numeric, p_longitude numeric, p_kapazitaet integer
)
returns bigint
language plpgsql
security definer
set search_path = velocity, pg_temp
as $$
declare v_m bigint; v_adresse bigint; v_s bigint; v_nummer text;
begin
  v_m := velocity.fn_rolle_verlangen('disposition');

  insert into velocity.adresse (strasse, hausnummer, plz, ort)
       values (p_strasse, p_hausnummer, p_plz, p_ort)
    returning adresse_id into v_adresse;

  -- Format S-0000, nicht ST-0000: 0012_dokumentation.sql legt es fest
  -- ("Fachlicher Schluessel im Format S-0000"), und der Bestand traegt
  -- S-0001 bis S-0010. Ein abweichendes Praefix waere keine Fortsetzung
  -- dieser Nummernserie, sondern eine zweite, unvereinbare daneben - und
  -- der Filter haette den Bestand nie gefunden, sondern bei jeder
  -- Neuanlage wieder bei 1 angefangen. Nachgemessen und korrigiert, nicht
  -- neu erfunden: siehe test_l_stationsnummer_format.
  select 'S-' || lpad((coalesce(max(substring(stationsnummer from '\d+')::integer), 0) + 1)::text,
                       4, '0')
    into v_nummer
    from velocity.station where stationsnummer ~ '^S-\d+$';

  insert into velocity.station
         (stationsnummer, name, adresse_id, latitude, longitude, kapazitaet)
       values (coalesce(v_nummer, 'S-0001'), p_name, v_adresse,
               p_latitude, p_longitude, p_kapazitaet)
    returning station_id into v_s;

  return v_s;
end;
$$;

create or replace function velocity.api_station_stilllegen(
  p_station_id bigint, p_zum date default current_date
)
returns void
language plpgsql
security definer
set search_path = velocity, pg_temp
as $$
declare v_m bigint; v_raeder integer; v_beginn date;
begin
  v_m := velocity.fn_rolle_verlangen('disposition');

  select lower(betriebszeitraum) into v_beginn
    from velocity.station where station_id = p_station_id;
  if not found then
    raise exception 'Station % nicht gefunden', p_station_id using errcode = 'P0001';
  end if;

  -- Gefunden beim Testen der Zusicherung "Betriebsbeginn bleibt
  -- unveraendert", nicht angefordert: daterange(v_beginn, p_zum, '[)')
  -- mit p_zum <= v_beginn ist LEER, und Postgres liefert lower()/upper()
  -- fuer eine leere Reichweite als NULL zurueck - der Betriebsbeginn
  -- ginge damit unwiederbringlich verloren, obwohl die Station laut
  -- GR22 als Satz erhalten bleiben soll. Deshalb hier abgewiesen statt
  -- stillschweigend eine Reichweite ohne Anfang zu erzeugen.
  if p_zum <= v_beginn then
    raise exception 'Station % kann nicht vor oder am Tag ihres Betriebsbeginns (%) stillgelegt werden',
      p_station_id, v_beginn using errcode = 'P0001';
  end if;

  -- GR22: eine Station wird stillgelegt, nicht geloescht. Ein delete
  -- scheiterte ohnehin am on delete restrict der Ausleihen - aber mit
  -- einer Fehlermeldung, die niemandem sagt, was zu tun ist.
  select count(*) into v_raeder
    from velocity.fahrrad_position where station_id = p_station_id;
  if v_raeder > 0 then
    raise exception 'An Station % stehen noch % Raeder. Erst umsetzen, dann stilllegen.',
      p_station_id, v_raeder using errcode = 'P0001';
  end if;

  update velocity.station
     set betriebszeitraum = daterange(v_beginn, p_zum, '[)')
   where station_id = p_station_id;
end;
$$;

-- ---- Kunden ----------------------------------------------------------
create or replace function velocity.api_kunde_anlegen(
  p_vorname text, p_nachname text, p_email text, p_telefon text default null
)
returns bigint
language plpgsql
security definer
set search_path = velocity, pg_temp
as $$
declare v_m bigint; v_k bigint;
begin
  v_m := velocity.fn_rolle_verlangen('kundenservice');
  insert into velocity.kunde (vorname, nachname, email, telefon, status)
       values (p_vorname, p_nachname, lower(btrim(p_email)), p_telefon, 'aktiv')
    returning kunde_id into v_k;
  -- auth_uid bleibt leer: das Konto entsteht, wenn sich die Person das
  -- erste Mal anmeldet. Ein Mitarbeiter kann und soll kein Passwort
  -- setzen.
  return v_k;
end;
$$;

create or replace function velocity.api_kunde_aktualisieren(
  p_kunde_id bigint, p_vorname text, p_nachname text, p_telefon text default null,
  p_strasse text default null, p_hausnummer text default null,
  p_plz text default null, p_ort text default null
)
returns void
language plpgsql
security definer
set search_path = velocity, pg_temp
as $$
declare v_m bigint; v_adresse bigint;
begin
  v_m := velocity.fn_rolle_verlangen('kundenservice');

  if p_strasse is not null then
    select rechnungsadresse_id into v_adresse from velocity.kunde where kunde_id = p_kunde_id;
    if v_adresse is null then
      insert into velocity.adresse (strasse, hausnummer, plz, ort)
           values (p_strasse, p_hausnummer, p_plz, p_ort) returning adresse_id into v_adresse;
    else
      update velocity.adresse
         set strasse = p_strasse, hausnummer = p_hausnummer, plz = p_plz, ort = p_ort
       where adresse_id = v_adresse;
    end if;
  end if;

  update velocity.kunde
     set vorname = p_vorname, nachname = p_nachname, telefon = p_telefon,
         rechnungsadresse_id = coalesce(v_adresse, rechnungsadresse_id)
   where kunde_id = p_kunde_id;
  if not found then
    raise exception 'Kunde % nicht gefunden', p_kunde_id using errcode = 'P0001';
  end if;
  -- Die E-Mail wird bewusst NICHT geaendert: sie ist der Anmeldename.
  -- Sie zu aendern ist eine Kontoaenderung und gehoert dem Kunden.
end;
$$;

create or replace function velocity.api_kunde_sperren(
  p_kunde_id bigint, p_grund text
)
returns void
language plpgsql
security definer
set search_path = velocity, pg_temp
as $$
declare v_m bigint;
begin
  v_m := velocity.fn_rolle_verlangen('kundenservice');
  if exists (select 1 from velocity.ausleihe a
              where a.kunde_id = p_kunde_id and a.status = 'aktiv') then
    raise exception 'Kunde % ist gerade unterwegs. Erst Rueckgabe abwarten.', p_kunde_id
      using errcode = 'P0001';
  end if;
  update velocity.kunde set status = 'gesperrt' where kunde_id = p_kunde_id;
  if not found then
    raise exception 'Kunde % nicht gefunden', p_kunde_id using errcode = 'P0001';
  end if;
  insert into velocity.aenderungsprotokoll
         (mitarbeiter_id, tabelle, datensatz_id, aktion, feld, wert_alt, wert_neu)
  values (v_m, 'kunde', p_kunde_id, 'UPDATE', 'sperrgrund', null, p_grund);
end;
$$;

-- Art. 15 DSGVO: Auskunft. Alles zu einer Person in EINEM Dokument -
-- nicht, weil JSON schoen waere, sondern weil die Auskunft als Ganzes
-- herausgegeben wird und nicht als sieben Abfragen.
create or replace function velocity.api_kunde_auskunft(p_kunde_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = velocity, pg_temp
as $$
declare v_m bigint; v_j jsonb;
begin
  v_m := velocity.fn_rolle_verlangen('kundenservice');

  select jsonb_build_object(
    'erteilt_am', now(),
    'rechtsgrundlage', 'Art. 15 DSGVO',
    'stammdaten', (
      select to_jsonb(x) from (
        select k.kunde_id, k.kundennummer, k.anrede, k.vorname, k.nachname,
               k.email, k.telefon, k.geburtsdatum, k.status, k.registriert_am,
               a.strasse, a.hausnummer, a.plz, a.ort
          from velocity.kunde k
          left join velocity.adresse a on a.adresse_id = k.rechnungsadresse_id
         where k.kunde_id = p_kunde_id) x),
    'mitgliedschaften', coalesce((
      select jsonb_agg(to_jsonb(x)) from (
        select m.mitgliedschaft_id, t.tarif_code, t.bezeichnung, m.gueltigkeit
          from velocity.mitgliedschaft m
          join velocity.tarif t on t.tarif_id = m.tarif_id
         where m.kunde_id = p_kunde_id order by lower(m.gueltigkeit)) x), '[]'::jsonb),
    'fahrten', coalesce((
      select jsonb_agg(to_jsonb(x)) from (
        -- Die Koordinaten gehoeren in die Auskunft. Sie sind das
        -- Genaueste, was ueber den Aufenthalt dieser Person gespeichert
        -- ist - und ausgerechnet sie bleiben nach einer Anonymisierung
        -- stehen. Wer Auskunft verlangt, hat ein Recht darauf zu
        -- erfahren, was da liegt.
        select a.ausleihe_id, a.startzeit, a.endzeit, a.dauer_minuten, a.distanz_km,
               s1.name as von, s2.name as nach,
               a.start_latitude, a.start_longitude,
               a.end_latitude, a.end_longitude
          from velocity.ausleihe a
          left join velocity.station s1 on s1.station_id = a.start_station_id
          left join velocity.station s2 on s2.station_id = a.end_station_id
         where a.kunde_id = p_kunde_id order by a.startzeit) x), '[]'::jsonb),
    'zahlungen', coalesce((
      select jsonb_agg(to_jsonb(x)) from (
        -- zahlung traegt keine kunde_id - nur rechnung_id. Der Umweg
        -- ueber rechnung ist deshalb keine Bequemlichkeit, sondern der
        -- einzige Weg zur Zahlung dieses Kunden.
        select z.zahlung_id, z.betrag, z.gebucht_am, z.status
          from velocity.zahlung z
          join velocity.rechnung r on r.rechnung_id = z.rechnung_id
         where r.kunde_id = p_kunde_id order by z.gebucht_am) x), '[]'::jsonb),
    'schadensmeldungen', coalesce((
      select jsonb_agg(to_jsonb(x)) from (
        select sm.schadensmeldung_id, sm.gemeldet_am, sm.kategorie,
               sm.beschreibung, sm.schwere, sm.status
          from velocity.schadensmeldung sm
         where sm.melder_kunde_id = p_kunde_id order by sm.gemeldet_am) x), '[]'::jsonb),
    'freiminuten', coalesce((
      select jsonb_agg(to_jsonb(x)) from (
        select fp.jahr, fp.monat, fp.kontingent_minuten, fp.verbraucht_minuten
          from velocity.freiminuten_periode fp
          join velocity.mitgliedschaft m using (mitgliedschaft_id)
         where m.kunde_id = p_kunde_id order by fp.jahr, fp.monat) x), '[]'::jsonb),
    'protokoll', coalesce((
      select jsonb_agg(to_jsonb(x)) from (
        select ap.zeitpunkt, ap.feld, ap.wert_alt, ap.wert_neu
          from velocity.aenderungsprotokoll ap
         where ap.tabelle = 'kunde' and ap.datensatz_id = p_kunde_id
         order by ap.zeitpunkt) x), '[]'::jsonb),
    'rechnungen', coalesce((
      select jsonb_agg(to_jsonb(x)) from (
        select r.rechnungsnummer, r.periode_jahr, r.periode_monat,
               r.betrag_netto, r.ust_betrag, r.betrag_brutto, r.status
          from velocity.rechnung r
         where r.kunde_id = p_kunde_id
         order by r.periode_jahr, r.periode_monat) x), '[]'::jsonb)
    -- Zahlungsmittel stehen hier NICHT (GR17). Sie sind Teil der
    -- Auskunft, die der Kunde selbst ueber sein Konto erhaelt; der
    -- Kundenservice bekommt sie nie zu sehen, auch nicht mittelbar.
  ) into v_j;

  if v_j -> 'stammdaten' = 'null'::jsonb then
    raise exception 'Kunde % nicht gefunden', p_kunde_id using errcode = 'P0001';
  end if;

  -- Wer Daten einsieht, hinterlaesst eine Spur (GR19).
  insert into velocity.aenderungsprotokoll
         (mitarbeiter_id, tabelle, datensatz_id, aktion, feld, wert_alt, wert_neu)
  values (v_m, 'kunde', p_kunde_id, 'UPDATE', 'auskunft_erteilt', null,
          'Auskunft nach Art. 15 DSGVO erteilt');

  return v_j;
end;
$$;

-- Art. 17 DSGVO: Loeschung. Umgesetzt als Anonymisierung.
--
-- Warum nicht delete: Paragraf 147 AO verlangt zehn Jahre Aufbewahrung
-- fuer Rechnungsbelege. Art. 17 Abs. 3 lit. b DSGVO nimmt genau solche
-- rechtlichen Pflichten von der Loeschpflicht aus. Wer den Kunden
-- loescht, verstoesst gegen das Steuerrecht; wer gar nichts tut, gegen
-- die DSGVO. Anonymisieren erfuellt beides: die Person ist nicht mehr
-- identifizierbar, die Buchhaltung bleibt vollstaendig.
--
-- Das ist der zentrale Lehrpunkt dieses Bereichs: "Recht auf Loeschung"
-- ist im Datenmodell keine DELETE-Anweisung.
create or replace function velocity.api_kunde_anonymisieren(
  p_kunde_id bigint, p_grund text
)
returns void
language plpgsql
security definer
set search_path = velocity, pg_temp
as $$
declare v_m bigint; v_adresse bigint; v_offen integer;
begin
  v_m := velocity.fn_rolle_verlangen('kundenservice');

  select count(*) into v_offen from velocity.ausleihe a
   where a.kunde_id = p_kunde_id and a.status = 'aktiv';
  if v_offen > 0 then
    raise exception 'Kunde % hat eine laufende Fahrt', p_kunde_id using errcode = 'P0001';
  end if;

  select rechnungsadresse_id into v_adresse from velocity.kunde where kunde_id = p_kunde_id;
  if not found then
    raise exception 'Kunde % nicht gefunden', p_kunde_id using errcode = 'P0001';
  end if;

  -- WAS DIESE FUNKTION NICHT LEISTET - und das gehoert hierher, nicht
  -- in eine Fussnote:
  --
  -- 1. Die Fahrten bleiben stehen. Sie tragen die Abrechnung, und
  --    Paragraf 147 AO verlangt sie. Sie tragen aber auch Startzeit,
  --    Endzeit und bei frei abgestellten Raedern Koordinaten auf sechs
  --    Nachkommastellen. Wer ein Jahr lang werktags um 07:40 vom selben
  --    Punkt losfaehrt, ist damit wieder auffindbar, auch ohne Namen.
  --    Eine echte Anonymisierung muesste die Orte vergroebern oder die
  --    Zeiten runden. Das tut diese Funktion nicht, und wer sie
  --    einsetzt, sollte es wissen.
  --
  -- 2. Freitexte werden nicht durchsucht. In
  --    schadensmeldung.beschreibung oder rechnungsposition.beschreibung
  --    kann ein Name stehen, den niemand dort vermutet hat. Generisch
  --    loesbar ist das nicht.
  --
  -- 3. Das Altschema cityBikesRental liegt unveraendert auf derselben
  --    Datenbank und haelt ueber tausend Kunden mit Vorname, Nachname
  --    und E-Mail im Klartext. db/betrieb/altschema_absichern.sql sperrt
  --    dort die RECHTE, nicht die DATEN. Fuer jeden uebernommenen Kunden
  --    ist der Antrag nach Art. 17 damit erst erfuellt, wenn auch das
  --    Altschema geraeumt ist.
  --
  -- Zahlungsmittel dagegen werden geloescht, nicht anonymisiert: sie
  -- unterliegen keiner Aufbewahrungspflicht und haben ohne Person
  -- keinen Zweck.
  delete from velocity.zahlungsmittel where kunde_id = p_kunde_id;

  update velocity.kunde
     set vorname      = 'Geloescht',
         nachname     = 'Geloescht',
         -- Nicht leeren, sondern ersetzen: auf email liegt ein
         -- UNIQUE-Constraint, und mehrere anonymisierte Kunden
         -- muessen nebeneinander bestehen koennen. Die Domain
         -- .invalid ist per RFC 2606 dauerhaft unaufloesbar.
         email        = 'anonym-' || p_kunde_id || '@velocity.invalid',
         telefon      = null,
         geburtsdatum = null,
         anrede       = null,
         auth_uid     = null,
         rechnungsadresse_id = null,
         status       = 'geschlossen'
   where kunde_id = p_kunde_id;

  -- Die Adresse loeschen, wenn kein anderer Satz sie noch braucht.
  -- Geprueft werden kunde und station - die einzigen beiden Tabellen
  -- mit einem Fremdschluessel auf adresse. rechnung hat keinen; siehe
  -- den Absatz darunter.
  --
  -- Bekannter Befund, hier bewusst nicht behoben: velocity.rechnung
  -- traegt selbst KEINE Empfaengerdaten - weder Name noch Anschrift,
  -- nur kunde_id. Nach dieser Anonymisierung laesst sich zu keiner
  -- Rechnung mehr sagen, an wen oder wohin sie ging; nur die Betraege
  -- (Aufbewahrungspflicht nach Paragraf 147 AO) bleiben unveraendert.
  -- Ob eine Rechnung ihre eigene Anschrift zum Ausstellungszeitpunkt
  -- einfrieren muesste, ist eine Modellierungsfrage fuer den
  -- Auftraggeber und eine Schemaaenderung ausserhalb dieses Plans -
  -- nicht Gegenstand dieser Funktion.
  if v_adresse is not null
     and not exists (select 1 from velocity.kunde k where k.rechnungsadresse_id = v_adresse)
     and not exists (select 1 from velocity.station s where s.adresse_id = v_adresse) then
    delete from velocity.adresse where adresse_id = v_adresse;
  end if;

  -- HIER STEHT DER EIGENTLICHE LEHRPUNKT DIESER FUNKTION.
  --
  -- Der UPDATE oben hat trg_kunde_protokoll ausgeloest. Damit steht im
  -- Aenderungsprotokoll jetzt zeilenweise, WAS geloescht wurde:
  --     vorname      Petra              -> Geloescht
  --     email        petra@example.org  -> anonym-4711@velocity.invalid
  --     telefon      0931 4711          -> null
  --     geburtsdatum 1988-07-07         -> null
  -- Die Loeschung erzeugt also die Kopie, die sie beseitigen soll. Ein
  -- Protokoll ist kein Rechnungsbeleg; Paragraf 147 AO deckt es nicht,
  -- und Art. 17 Abs. 3 lit. b greift fuer es nicht.
  --
  -- Aufgeloest wird das nicht durch Loeschen der Protokollzeilen -
  -- dann verschwaende auch die Spur, WER wann geaendert hat, und Art. 5
  -- Abs. 2 DSGVO verlangt genau die. Aufgeloest wird es, indem die
  -- WERTE unkenntlich gemacht werden und die Zeile bleibt. Das Protokoll
  -- sagt danach: an diesem Tag hat dieser Mitarbeiter diese sechs Felder
  -- geaendert. Es sagt nicht mehr, wie die Person hiess.
  --
  -- Dass ausgerechnet diese Funktion das darf, obwohl auf
  -- aenderungsprotokoll UPDATE using (false) liegt, ist kein Widerspruch,
  -- sondern die Regel: sie ist security definer und laeuft unter einer
  -- Rolle mit BYPASSRLS. Genau eine Funktion im ganzen Schema darf das
  -- Protokoll anfassen, und es ist die, die Art. 17 umsetzt.
  update velocity.aenderungsprotokoll
     set wert_alt = case when wert_alt is null then null else '[anonymisiert]' end,
         wert_neu = case when wert_neu is null then null else '[anonymisiert]' end
   where tabelle = 'kunde'
     and datensatz_id = p_kunde_id
     and feld in ('vorname','nachname','email','telefon','geburtsdatum',
                  'anrede','auth_uid','rechnungsadresse_id');

  insert into velocity.aenderungsprotokoll
         (mitarbeiter_id, tabelle, datensatz_id, aktion, feld, wert_alt, wert_neu)
  values (v_m, 'kunde', p_kunde_id, 'UPDATE', 'anonymisiert', null, p_grund);
end;
$$;

-- ---- Instandhaltung --------------------------------------------------
-- Sequenz fuer Auftragsnummern (W5). Aus count(*) + 1 zu bilden brach
-- den Rest des Jahres, sobald ein Auftrag geloescht wurde (die Zaehlung
-- rutschte zurueck und kollidierte mit einer bereits vergebenen Nummer
-- am naechsten unique-Constraint) und war unter zwei gleichzeitigen
-- Aufrufen ohnehin nicht kollisionsfrei. Gleiches Muster wie
-- seq_kundennummer in 0002.
create sequence if not exists velocity.seq_wartungsauftrag as bigint start 1;

create or replace function velocity.api_schaden_melden(
  p_fahrrad_id bigint, p_kategorie text, p_beschreibung text, p_schwere text
)
returns bigint
language plpgsql
security definer
set search_path = velocity, pg_temp
as $$
declare v_m bigint; v_s bigint;
begin
  v_m := velocity.fn_rolle_verlangen('werkstatt');
  insert into velocity.schadensmeldung
         (fahrrad_id, melder_mitarbeiter_id, kategorie, beschreibung, schwere)
       values (p_fahrrad_id, v_m, p_kategorie, p_beschreibung,
               p_schwere::velocity.schaden_schwere)
    returning schadensmeldung_id into v_s;

  -- Ein fahruntaugliches Rad gehoert sofort aus dem Verkehr. Der erste
  -- Entwurf schrieb hier "and status <> 'ausgeliehen'" - mit der
  -- Begruendung, ein Rad in Fahrt duerfe keinen anderen Status tragen.
  -- Das stimmt, und es war trotzdem falsch: fn_ausleihe_beenden setzt
  -- bei der Rueckgabe bedingungslos auf 'verfuegbar'. Ein waehrend der
  -- Fahrt als fahruntauglich gemeldetes Rad stand danach wieder in der
  -- Ausleihliste - mit gebrochenem Rahmen.
  --
  -- GR13 verbietet weiterhin, einem Rad in Fahrt einen Standort oder
  -- einen anderen Status zu geben. Deshalb wird hier nicht der Status
  -- gesetzt, sondern die Rueckgabe uebernimmt ihn: fn_ausleihe_beenden
  -- (db/aufbau/0009_geschaeftslogik.sql) fragt vor dem Freigeben, ob
  -- eine fahruntaugliche Meldung offen ist.
  if p_schwere = 'fahruntauglich' then
    update velocity.fahrrad set status = 'defekt'
     where fahrrad_id = p_fahrrad_id and status <> 'ausgeliehen';
  end if;
  return v_s;
end;
$$;

create or replace function velocity.api_auftrag_eroeffnen(
  p_fahrrad_id bigint, p_schadensmeldung_id bigint default null
)
returns bigint
language plpgsql
security definer
set search_path = velocity, pg_temp
as $$
declare v_m bigint; v_w bigint; v_nummer text;
begin
  v_m := velocity.fn_rolle_verlangen('werkstatt');

  -- Die Meldung muss zu DIESEM Rad gehoeren (W6). Ohne diese Pruefung
  -- erklaert ein Zahlendreher in der Meldungsnummer einen fremden
  -- Schaden fuer behoben und laesst das tatsaechlich defekte Rad im
  -- Verkehr.
  if p_schadensmeldung_id is not null
     and not exists (select 1 from velocity.schadensmeldung sm
                      where sm.schadensmeldung_id = p_schadensmeldung_id
                        and sm.fahrrad_id = p_fahrrad_id) then
    raise exception 'Schadensmeldung % gehoert nicht zu Rad %',
      p_schadensmeldung_id, p_fahrrad_id using errcode = 'P0001';
  end if;

  -- Nummer aus einer Sequenz, nicht aus count(*) (W5).
  select 'WA-' || to_char(now(), 'YYYY') || '-'
         || lpad(nextval('velocity.seq_wartungsauftrag')::text, 5, '0')
    into v_nummer;

  insert into velocity.wartungsauftrag
         (auftragsnummer, fahrrad_id, schadensmeldung_id, mitarbeiter_id, status)
       values (v_nummer, p_fahrrad_id, p_schadensmeldung_id, v_m, 'in_arbeit')
    returning wartungsauftrag_id into v_w;

  if p_schadensmeldung_id is not null then
    update velocity.schadensmeldung set status = 'in_arbeit'
     where schadensmeldung_id = p_schadensmeldung_id;
  end if;
  update velocity.fahrrad set status = 'wartung'
   where fahrrad_id = p_fahrrad_id and status <> 'ausgeliehen';
  return v_w;
end;
$$;

create or replace function velocity.api_auftrag_erledigen(
  p_wartungsauftrag_id bigint, p_arbeitszeit_minuten integer, p_bemerkung text default null
)
returns void
language plpgsql
security definer
set search_path = velocity, pg_temp
as $$
declare v_m bigint; v_w velocity.wartungsauftrag%rowtype; v_offen integer;
begin
  v_m := velocity.fn_rolle_verlangen('werkstatt');
  update velocity.wartungsauftrag
     set status = 'erledigt', erledigt_am = now(),
         arbeitszeit_minuten = p_arbeitszeit_minuten,
         bemerkung = p_bemerkung, mitarbeiter_id = coalesce(mitarbeiter_id, v_m)
   where wartungsauftrag_id = p_wartungsauftrag_id
  returning * into v_w;
  if not found then
    raise exception 'Auftrag % nicht gefunden', p_wartungsauftrag_id using errcode = 'P0001';
  end if;

  if v_w.schadensmeldung_id is not null then
    update velocity.schadensmeldung set status = 'behoben'
     where schadensmeldung_id = v_w.schadensmeldung_id;
  end if;

  insert into velocity.fahrrad_ereignis
         (fahrrad_id, ereignisart, mitarbeiter_id, bemerkung, beleg_tabelle, beleg_id)
  values (v_w.fahrrad_id, 'gewartet', v_m, coalesce(p_bemerkung, 'Wartung erledigt'),
          'wartungsauftrag', v_w.wartungsauftrag_id);

  -- Das Rad wird nur frei, wenn kein anderer Schaden mehr offen ist.
  -- Sonst repariert man eine Bremse und schickt ein Rad mit gebrochener
  -- Gabel zurueck auf die Strasse.
  select count(*) into v_offen from velocity.schadensmeldung sm
   where sm.fahrrad_id = v_w.fahrrad_id and sm.status in ('offen', 'in_arbeit');
  if v_offen = 0 then
    update velocity.fahrrad set status = 'verfuegbar'
     where fahrrad_id = v_w.fahrrad_id and status = 'wartung';
  end if;
end;
$$;

-- ---- GR19 auf die uebrigen Stammdaten ausweiten ----------------------
-- kunde traegt das Protokoll seit 0016. Diese zwei kommen dazu, sobald
-- es Funktionen gibt, die sie aendern.
select velocity.fn_protokoll_anhaengen('mitarbeiter', 'mitarbeiter_id');
select velocity.fn_protokoll_anhaengen('station',     'station_id');

-- BEWUSST NICHT auf fahrrad (W7). Ein frueherer Entwurf dieser Datei
-- hatte den Trigger hier - falsch angebracht, deshalb jetzt ausdruecklich
-- entfernt statt nur aus dem Quelltext gestrichen: die Aufbaudatei wird
-- wiederholt gegen dieselbe, bereits laufende Datenbank angewandt, ein
-- geloeschter Aufruf legt einen bereits bestehenden Trigger nicht von
-- selbst wieder ab.
--
-- Die Tabelle wird nicht in erster Linie von der Warenwirtschaft
-- geaendert, sondern von jeder einzelnen Fahrt: api_ausleihe_starten
-- setzt 'ausgeliehen', fn_ausleihe_beenden 'verfuegbar'. Bei 12 000
-- Fahrten im Jahr waeren das 24 000 Protokollzeilen, wortgleich zu den
-- Ereigniszeilen, die fahrrad_ereignis fuer genau diesen Zweck bereits
-- fuehrt (GR21). aenderungsprotokoll ist die Spur an den STAMMdaten
-- (GR19, Art. 5 Abs. 2 DSGVO); sie zur Bewegungstabelle zu machen,
-- entwertet beide.
drop trigger if exists trg_fahrrad_protokoll on velocity.fahrrad;

-- ---- Rechte ----------------------------------------------------------
-- ERST entziehen, DANN gezielt vergeben. Diese Zeile ist nicht
-- vorsorglich, sie ist notwendig: PostgreSQL gibt jeder NEU angelegten
-- Funktion implizit EXECUTE an PUBLIC, und die Zeile
-- "alter default privileges ... revoke execute on functions from public"
-- in 0011 hat in dieser Datenbank nachweislich KEINEN Eintrag in
-- pg_default_acl erzeugt - sie schuetzt neue Funktionen also nicht,
-- entgegen ihrem eigenen Kommentar. Aufgefallen ist das in Aufgabe 5:
-- nach einem Lauf von 0009 allein stand fn_ausleihe_abrechnen mit
-- proacl = null da, also offen fuer anon und authenticated.
--
-- Ohne diese Zeile waeren api_kunde_auskunft und
-- api_kunde_anonymisieren fuer jeden angemeldeten Kunden aufrufbar.
revoke all on all functions in schema velocity from public, anon, authenticated;

-- Nur die api_-Funktionen und die Sichten, keine Tabelle.
--
-- Nachtrag zur pauschalen Zeile oben: "revoke all on ALL functions"
-- trifft nicht nur die in dieser Datei neu angelegten Funktionen,
-- sondern JEDE Funktion im Schema velocity - auch die vier
-- Website-Funktionen aus 0009/0011 (api_kunde_sicherstellen,
-- api_profil_aktualisieren, api_ausleihe_starten, api_ausleihe_beenden)
-- und ist_mitarbeiter/hat_rolle aus 0017. 0019 ist die letzte Datei der
-- Aufbaukette und laeuft nach 0011 und 0017 - ohne diese sechs hier
-- erneut aufzufuehren, wuerde ihr eigener Grant durch den Grant dieser
-- Zeile unbemerkt wieder entzogen: die lebende Website koennte sich
-- nicht mehr anmelden und keine Ausleihe mehr abrechnen, und jede
-- v_wawi_-Sicht schluege mit "permission denied for function hat_rolle"
-- fehl (siehe Kommentar in 0017). Nachgemessen mit
-- has_function_privilege('authenticated', ...) direkt nach einem
-- Testlauf dieser Datei: alle sechs standen auf false, bevor diese
-- Zeilen ergaenzt wurden.
grant execute on function
  velocity.api_kunde_sicherstellen(),
  velocity.api_profil_aktualisieren(text, text, text, date, text, text, text, text),
  velocity.api_ausleihe_starten(bigint),
  velocity.api_ausleihe_beenden(bigint, bigint, numeric, numeric),
  velocity.ist_mitarbeiter(),
  velocity.hat_rolle(text),
  velocity.api_rad_anlegen(text, bigint, bigint),
  velocity.api_rad_status_setzen(bigint, text, text),
  velocity.api_rad_ausmustern(bigint, text),
  velocity.api_station_anlegen(text, text, text, text, text, numeric, numeric, integer),
  velocity.api_station_stilllegen(bigint, date),
  velocity.api_kunde_anlegen(text, text, text, text),
  velocity.api_kunde_aktualisieren(bigint, text, text, text, text, text, text, text),
  velocity.api_kunde_sperren(bigint, text),
  velocity.api_kunde_auskunft(bigint),
  velocity.api_kunde_anonymisieren(bigint, text),
  velocity.api_schaden_melden(bigint, text, text, text),
  velocity.api_auftrag_eroeffnen(bigint, bigint),
  velocity.api_auftrag_erledigen(bigint, integer, text)
to authenticated;

-- fn_luftlinie_km gehoert dazu, obwohl sie nicht api_ heisst (W1). Sie
-- wird aus v_wawi_fahrt_km heraus aufgerufen, und eine Sicht traegt
-- NICHT die Ausfuehrungsrechte ihres Eigentuemers. Ohne diesen Grant
-- scheitert v_wawi_km_co2 mit "permission denied for function
-- fn_luftlinie_km" - fuer jeden angemeldeten Nutzer, Mitarbeiter
-- eingeschlossen. Vor dem revoke oben lebte sie vom impliziten
-- PUBLIC-Recht; danach nicht mehr. Nachgemessen: die Testsuite sieht
-- das nicht, weil sie als postgres verbindet und damit jede
-- Rechtepruefung umgeht. Unbedenklich: sie rechnet eine Formel und
-- liest keine Tabelle.
grant execute on function
  velocity.fn_luftlinie_km(numeric, numeric, numeric, numeric)
to authenticated;

grant select on
  velocity.v_wawi_flotte, velocity.v_wawi_kunde, velocity.v_wawi_station,
  velocity.v_wawi_schaden, velocity.v_wawi_auftrag, velocity.v_wawi_fahrt_km,
  velocity.v_wawi_umsatz_radtyp, velocity.v_wawi_umsatz_kundengruppe,
  velocity.v_wawi_km_co2, velocity.v_wawi_stationsauslastung
to authenticated;
