-- =====================================================================
-- 0019 Schreibende Funktionen der Warenwirtschaft
--
-- Zweck:      Alles, was die Warenwirtschaft aendert, laeuft hier
--             hindurch. Die Oberflaeche schreibt nie in eine Tabelle -
--             dieselbe Regel wie fuer die Website, und tools/abnahme.sh
--             prueft sie von aussen.
-- Objekte:    velocity.fn_rolle_verlangen, velocity.api_rad_anlegen,
--             api_rad_status_setzen, api_rad_ausmustern,
--             api_station_anlegen, api_station_stilllegen
-- Ruecknahme: DROP FUNCTION fuer dieselben Namen.
-- =====================================================================

-- Jede api_-Funktion beginnt mit fn_rolle_verlangen. Der Rueckgabewert
-- ist die mitarbeiter_id - so wird in einem Schritt geprueft UND der
-- Verursacher ermittelt, statt zweimal dasselbe nachzuschlagen.
--
-- fn_rolle_verlangen bleibt bewusst OHNE api_-Praefix und damit von der
-- Sweep-Ausnahme in test_s_keine_oeffentliche_funktion nicht erfasst:
-- sie ist interne Fachlogik, keine Schnittstelle. Wer sie direkt
-- aufrufen koennte, bekaeme die Mitarbeiter-ID zu jeder beliebigen
-- Rolle - ohne selbst etwas anzulegen. db/aufbau/0011_sicherheit.sql
-- muss deshalb nach dieser Datei erneut laufen: es entzieht jeder neu
-- angelegten Funktion das automatische PUBLIC-Ausfuehrungsrecht.
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

  update velocity.fahrrad_ereignis
     set mitarbeiter_id = v_m, bemerkung = bemerkung || ' - ' || p_grund
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

  select 'ST-' || lpad((coalesce(max(substring(stationsnummer from '\d+')::integer), 0) + 1)::text,
                       3, '0')
    into v_nummer
    from velocity.station where stationsnummer ~ '^ST-\d+$';

  insert into velocity.station
         (stationsnummer, name, adresse_id, latitude, longitude, kapazitaet)
       values (coalesce(v_nummer, 'ST-001'), p_name, v_adresse,
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
declare v_m bigint; v_raeder integer;
begin
  v_m := velocity.fn_rolle_verlangen('disposition');

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
     set betriebszeitraum = daterange(lower(betriebszeitraum), p_zum, '[)')
   where station_id = p_station_id;
  if not found then
    raise exception 'Station % nicht gefunden', p_station_id using errcode = 'P0001';
  end if;
end;
$$;
