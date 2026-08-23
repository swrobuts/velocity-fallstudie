-- =====================================================================
-- 0009 Geschaeftslogik
--
-- Zweck:      Ausleihe starten und beenden, Preisfindung, Anlegen und
--             Pflegen des Kundensatzes zur Anmeldung.
-- Objekte:    velocity.fn_kunde_aus_auth, velocity.fn_position_anlegen,
--             velocity.fn_ausleihe_starten, velocity.fn_ausleihe_beenden,
--             velocity.api_kunde_sicherstellen,
--             velocity.api_profil_aktualisieren,
--             velocity.api_ausleihe_starten, velocity.api_ausleihe_beenden
-- Ruecknahme: DROP FUNCTION fuer dieselben Namen.
--
-- Schichtung: fn_* traegt die Fachlogik und bekommt die kunde_id als
-- Parameter. api_* ist eine duenne Huelle mit SECURITY DEFINER, die aus
-- auth.uid() die kunde_id aufloest. Nur api_* wird der Anwendung
-- freigegeben. Damit ist die Fachlogik ohne Anmeldung testbar.
-- =====================================================================

create or replace function velocity.fn_kunde_aus_auth()
returns bigint
language sql
stable
security definer
set search_path = velocity, pg_temp
as $$
  select k.kunde_id from velocity.kunde k where k.auth_uid = auth.uid();
$$;

-- ---------------------------------------------------------------------
-- Legt eine Entgeltposition an. Das Vorzeichen kommt aus der Entgeltart,
-- der Betrag wird auf zwei Nachkommastellen gerundet.
-- ---------------------------------------------------------------------
create or replace function velocity.fn_position_anlegen(
  p_ausleihe_id      bigint,
  p_code             text,
  p_menge            numeric,
  p_einzelbetrag     numeric,
  p_nutzungspreis_id bigint,
  p_sortierung       integer
)
returns void
language plpgsql
set search_path = velocity, pg_temp
as $$
declare
  v_art velocity.entgeltart%rowtype;
begin
  select * into v_art from velocity.entgeltart where code = p_code;
  if not found then
    raise exception 'Unbekannte Entgeltart %', p_code using errcode = 'P0002';
  end if;

  insert into velocity.entgeltposition
    (ausleihe_id, entgeltart_id, nutzungspreis_id, menge, einzelbetrag, betrag, sortierung)
  values
    (p_ausleihe_id, v_art.entgeltart_id, p_nutzungspreis_id, p_menge, p_einzelbetrag,
     round(p_menge * p_einzelbetrag, 2) * v_art.vorzeichen, p_sortierung);
end;
$$;

-- ---------------------------------------------------------------------
-- Ausleihe starten
-- ---------------------------------------------------------------------
create or replace function velocity.fn_ausleihe_starten(
  p_kunde_id   bigint,
  p_fahrrad_id bigint
)
returns table (ausleihe_id bigint, meldung text)
language plpgsql
set search_path = velocity, pg_temp
as $$
declare
  v_status  velocity.fahrrad_status;
  v_pos     velocity.fahrrad_position%rowtype;
  v_aktive  integer;
  v_mgl     bigint;
  v_neu     bigint;
begin
  select f.status into v_status
    from velocity.fahrrad f where f.fahrrad_id = p_fahrrad_id for update;
  if not found then
    return query select null::bigint, 'Fahrrad nicht gefunden'::text; return;
  end if;
  if v_status <> 'verfuegbar' then
    return query select null::bigint,
      format('Fahrrad nicht verfügbar (Status: %s)', v_status)::text; return;
  end if;

  -- Geschaeftsregel GR2
  select count(*) into v_aktive
    from velocity.ausleihe a where a.kunde_id = p_kunde_id and a.status = 'aktiv';
  if v_aktive >= 4 then
    return query select null::bigint,
      'Maximale Anzahl aktiver Ausleihen (4) erreicht'::text; return;
  end if;

  select * into v_pos from velocity.fahrrad_position where fahrrad_id = p_fahrrad_id;

  -- Ein Rad ohne Standort kann niemand abholen. Bisher lief die Ausleihe
  -- trotzdem an und schrieb eine Fahrt ohne Startort in die Tabelle; die
  -- Ortspflicht macht daraus jetzt eine ausgesprochene Geschaeftsregel.
  -- Im Bestand betrifft das nur ausgeliehene Raeder - die sind in Fahrt
  -- und ohnehin nicht verfuegbar.
  if v_pos.fahrrad_id is null
     or (v_pos.station_id is null
         and (v_pos.latitude is null or v_pos.longitude is null)) then
    return query select null::bigint,
      'Standort des Rades unbekannt, Ausleihe nicht moeglich'::text; return;
  end if;

  -- Die zum Startzeitpunkt gueltige Mitgliedschaft wird fixiert, damit ein
  -- spaeterer Tarifwechsel die Bepreisung nicht rueckwirkend veraendert.
  select m.mitgliedschaft_id into v_mgl
    from velocity.mitgliedschaft m
   where m.kunde_id = p_kunde_id and m.gueltigkeit @> current_date;

  -- Genau eine Ortsangabe, nie beide: steht das Rad an einer Station,
  -- traegt die Station den Ort. Die Radposition fuehrt bei 316 von 352
  -- Raedern beides gleichzeitig - das waere eine transitive Abhaengigkeit
  -- (Station bestimmt die Koordinaten) und verletzt ausleihe_startort_chk.
  insert into velocity.ausleihe
    (kunde_id, fahrrad_id, mitgliedschaft_id, start_station_id, start_latitude, start_longitude)
  values
    (p_kunde_id, p_fahrrad_id, v_mgl, v_pos.station_id,
     case when v_pos.station_id is null then v_pos.latitude  end,
     case when v_pos.station_id is null then v_pos.longitude end)
  returning velocity.ausleihe.ausleihe_id into v_neu;

  update velocity.fahrrad set status = 'ausgeliehen' where fahrrad_id = p_fahrrad_id;
  -- Ein Rad in Fahrt steht nirgends (GR13). Der alte Ort wird auch
  -- geloescht - ihn stehen zu lassen waere eine Luege auf der Karte.
  update velocity.fahrrad_position
     set station_id = null, latitude = null, longitude = null,
         aktualisiert_am = now()
   where fahrrad_id = p_fahrrad_id;

  return query select v_neu, 'Ausleihe gestartet'::text;
end;
$$;

-- ---------------------------------------------------------------------
-- Ausleihe beenden und bepreisen
--
-- Reihenfolge der Positionen:
--   1 Startgebuehr
--   2 Zeitentgelt ueber ALLE gefahrenen Minuten
--   3 Gutschrift der Freiminuten (negativ)
--   4 Tarifrabatt auf die Zwischensumme (negativ)
--   5 Kappung auf den Tageshoechstpreis (negativ)
--
-- Das Zeitentgelt wird bewusst ueber alle Minuten gebildet und die
-- Freiminuten als eigene Gutschrift abgezogen. So ist auf der Rechnung
-- ablesbar, was der Tarifvorteil wert war.
--
-- Der Rabatt wird VOR der Kappung angewandt. Umgekehrt wuerde der
-- Rabatt den bereits gedeckelten Betrag noch einmal senken.
-- ---------------------------------------------------------------------
create or replace function velocity.fn_ausleihe_beenden(
  p_kunde_id       bigint,
  p_ausleihe_id    bigint,
  p_end_station_id bigint  default null,
  p_latitude       numeric default null,
  p_longitude      numeric default null
)
returns table (gesamtbetrag numeric, dauer_minuten integer, meldung text)
language plpgsql
set search_path = velocity, pg_temp
as $$
declare
  v_a           velocity.ausleihe%rowtype;
  v_typ         bigint;
  v_preis       velocity.nutzungspreis%rowtype;
  v_dauer       integer;
  v_periode     velocity.freiminuten_periode%rowtype;
  v_frei        integer := 0;
  v_rabatt      numeric(5,2) := 0;
  v_rabattwert  numeric(10,2);
  v_summe       numeric(10,2);
  v_ueberschuss numeric(10,2);
begin
  select * into v_a from velocity.ausleihe a
   where a.ausleihe_id = p_ausleihe_id for update;
  if not found then
    return query select null::numeric, null::integer, 'Ausleihe nicht gefunden'::text; return;
  end if;
  if v_a.kunde_id <> p_kunde_id then
    return query select null::numeric, null::integer,
      'Keine Berechtigung für diese Ausleihe'::text; return;
  end if;
  if v_a.status <> 'aktiv' then
    return query select null::numeric, null::integer, 'Ausleihe ist nicht aktiv'::text; return;
  end if;

  -- Die Rueckgabe braucht genau eine Ortsangabe. Ohne diese Pruefung
  -- schluege ausleihe_endort_chk zu - mit einer Meldung, die der
  -- Anwendung nichts sagt. Fachliche Fehler gehoeren in die Meldung.
  if (p_end_station_id is not null)
     = (p_latitude is not null and p_longitude is not null) then
    return query select null::numeric, null::integer,
      'Rueckgabe braucht entweder eine Station oder Koordinaten, nicht beides'::text;
    return;
  end if;

  update velocity.ausleihe a
     set endzeit        = now(),
         end_station_id = p_end_station_id,
         end_latitude   = case when p_end_station_id is null then p_latitude  end,
         end_longitude  = case when p_end_station_id is null then p_longitude end,
         status         = 'abgeschlossen'
   where a.ausleihe_id = p_ausleihe_id
  returning * into v_a;

  v_dauer := v_a.dauer_minuten;

  -- Geschaeftsregel GR5: Preis zum STARTzeitpunkt der Ausleihe
  select t.typ_id into v_typ
    from velocity.fahrrad f
    join velocity.fahrradmodell m on m.modell_id = f.modell_id
    join velocity.fahrradtyp    t on t.typ_id    = m.typ_id
   where f.fahrrad_id = v_a.fahrrad_id;

  select * into v_preis
    from velocity.nutzungspreis np
   where np.typ_id = v_typ and np.gueltigkeit @> v_a.startzeit::date;
  if not found then
    raise exception 'Kein gültiger Preis für Fahrradtyp % am %', v_typ, v_a.startzeit::date
      using errcode = 'P0002';
  end if;

  -- Freiminuten und Rabatt aus der fixierten Mitgliedschaft
  if v_a.mitgliedschaft_id is not null then
    select * into v_periode
      from velocity.freiminuten_periode p
     where p.mitgliedschaft_id = v_a.mitgliedschaft_id
       and p.jahr  = extract(year  from v_a.startzeit)::integer
       and p.monat = extract(month from v_a.startzeit)::integer
     for update;
    if found then
      v_frei := least(v_periode.kontingent_minuten - v_periode.verbraucht_minuten, v_dauer);
    end if;

    select coalesce(k.rabatt_prozent, 0) into v_rabatt
      from velocity.mitgliedschaft m
      join velocity.tarif_kondition k
        on k.tarif_id = m.tarif_id and k.gueltigkeit @> v_a.startzeit::date
     where m.mitgliedschaft_id = v_a.mitgliedschaft_id;
    v_rabatt := coalesce(v_rabatt, 0);
  end if;

  perform velocity.fn_position_anlegen(p_ausleihe_id, 'STARTGEBUEHR',
            1, v_preis.startgebuehr, v_preis.preis_id, 10);
  perform velocity.fn_position_anlegen(p_ausleihe_id, 'ZEITENTGELT',
            v_dauer, v_preis.preis_pro_minute, v_preis.preis_id, 20);

  if v_frei > 0 then
    perform velocity.fn_position_anlegen(p_ausleihe_id, 'FREIMINUTEN',
              v_frei, v_preis.preis_pro_minute, v_preis.preis_id, 30);
    update velocity.freiminuten_periode
       set verbraucht_minuten = verbraucht_minuten + v_frei
     where periode_id = v_periode.periode_id;
  end if;

  select coalesce(sum(betrag), 0) into v_summe
    from velocity.entgeltposition where ausleihe_id = p_ausleihe_id;

  if v_rabatt > 0 and v_summe > 0 then
    v_rabattwert := round(v_summe * v_rabatt / 100, 2);
    perform velocity.fn_position_anlegen(p_ausleihe_id, 'TARIFRABATT',
              1, v_rabattwert, null, 40);
    v_summe := v_summe - v_rabattwert;
  end if;

  if v_summe > v_preis.tageshoechstpreis then
    v_ueberschuss := v_summe - v_preis.tageshoechstpreis;
    perform velocity.fn_position_anlegen(p_ausleihe_id, 'HOECHSTPREIS_KAPPUNG',
              1, v_ueberschuss, v_preis.preis_id, 50);
    v_summe := v_preis.tageshoechstpreis;
  end if;

  update velocity.fahrrad set status = 'verfuegbar' where fahrrad_id = v_a.fahrrad_id;
  -- Genau eine Ortsangabe (GR13): an einer Station traegt die Station
  -- den Ort, sonst die Koordinaten. coalesce mit dem alten Wert waere
  -- hier falsch - es hielte einen ueberholten Ort am Leben.
  update velocity.fahrrad_position
     set station_id      = p_end_station_id,
         latitude        = case when p_end_station_id is null then p_latitude  end,
         longitude       = case when p_end_station_id is null then p_longitude end,
         aktualisiert_am = now()
   where fahrrad_id = v_a.fahrrad_id;

  return query select v_summe, v_dauer, 'Ausleihe beendet'::text;
end;
$$;

-- ---------------------------------------------------------------------
-- Zugriffsschicht
-- ---------------------------------------------------------------------

-- Legt bei Bedarf den Kundensatz zum angemeldeten Konto an. Wird nach
-- jedem Login aufgerufen und ist bewusst idempotent. Ersetzt den Trigger
-- auf auth.users: das Fremdschema wird nicht angefasst.
create or replace function velocity.api_kunde_sicherstellen()
returns table (kunde_id bigint, kundennummer text, ist_neu boolean)
language plpgsql
security definer
set search_path = velocity, pg_temp
as $$
declare
  v_uid   uuid := auth.uid();
  v_email text;
  v_meta  jsonb;
  v_id    bigint;
  v_neu   boolean := false;
begin
  if v_uid is null then
    raise exception 'Nicht angemeldet' using errcode = '28000';
  end if;

  select k.kunde_id into v_id from velocity.kunde k where k.auth_uid = v_uid;

  if not found then
    select u.email, u.raw_user_meta_data into v_email, v_meta
      from auth.users u where u.id = v_uid;

    -- Existiert bereits ein Kundensatz mit dieser E-Mail (etwa aus der
    -- Datenuebernahme), wird er mit dem Konto verknuepft statt doppelt
    -- angelegt.
    insert into velocity.kunde (auth_uid, email, vorname, nachname)
    values (v_uid, v_email,
            coalesce(nullif(v_meta ->> 'vorname',  ''), 'Unbekannt'),
            coalesce(nullif(v_meta ->> 'nachname', ''), 'Unbekannt'))
    on conflict (email) do update set auth_uid = excluded.auth_uid
    returning velocity.kunde.kunde_id into v_id;

    v_neu := true;
  end if;

  return query
    select v_id, k.kundennummer, v_neu from velocity.kunde k where k.kunde_id = v_id;
end;
$$;

-- Geschaeftsregel GR8 wird hier geprueft und nicht als CHECK, weil eine
-- Bedingung mit current_date nicht immutable waere.
create or replace function velocity.api_profil_aktualisieren(
  p_vorname      text,
  p_nachname     text,
  p_telefon      text default null,
  p_geburtsdatum date default null,
  p_strasse      text default null,
  p_hausnummer   text default null,
  p_plz          text default null,
  p_ort          text default null
)
returns table (meldung text)
language plpgsql
security definer
set search_path = velocity, pg_temp
as $$
declare
  v_kunde   bigint := velocity.fn_kunde_aus_auth();
  v_adresse bigint;
begin
  if v_kunde is null then
    return query select 'Nicht angemeldet'::text; return;
  end if;
  if coalesce(trim(p_vorname), '') = '' or coalesce(trim(p_nachname), '') = '' then
    return query select 'Vor- und Nachname sind Pflichtangaben'::text; return;
  end if;
  if p_geburtsdatum is not null
     and p_geburtsdatum > current_date - interval '16 years' then
    return query select 'Mindestalter 16 Jahre nicht erreicht'::text; return;
  end if;

  if p_strasse is not null and p_plz is not null and p_ort is not null then
    insert into velocity.adresse (strasse, hausnummer, plz, ort)
    values (p_strasse, coalesce(p_hausnummer, ''), p_plz, p_ort)
    on conflict (strasse, hausnummer, plz, ort, land_code) do update
      set geaendert_am = now()
    returning adresse_id into v_adresse;
  end if;

  update velocity.kunde
     set vorname             = p_vorname,
         nachname            = p_nachname,
         telefon             = p_telefon,
         geburtsdatum        = coalesce(p_geburtsdatum, geburtsdatum),
         rechnungsadresse_id = coalesce(v_adresse, rechnungsadresse_id)
   where kunde_id = v_kunde;

  return query select 'Profil gespeichert'::text;
end;
$$;

create or replace function velocity.api_ausleihe_starten(p_fahrrad_id bigint)
returns table (ausleihe_id bigint, meldung text)
language plpgsql
security definer
set search_path = velocity, pg_temp
as $$
declare
  v_kunde bigint := velocity.fn_kunde_aus_auth();
begin
  if v_kunde is null then
    return query select null::bigint, 'Nicht angemeldet'::text; return;
  end if;
  return query select * from velocity.fn_ausleihe_starten(v_kunde, p_fahrrad_id);
end;
$$;

create or replace function velocity.api_ausleihe_beenden(
  p_ausleihe_id    bigint,
  p_end_station_id bigint  default null,
  p_latitude       numeric default null,
  p_longitude      numeric default null
)
returns table (gesamtbetrag numeric, dauer_minuten integer, meldung text)
language plpgsql
security definer
set search_path = velocity, pg_temp
as $$
declare
  v_kunde bigint := velocity.fn_kunde_aus_auth();
begin
  if v_kunde is null then
    return query select null::numeric, null::integer, 'Nicht angemeldet'::text; return;
  end if;
  return query select * from velocity.fn_ausleihe_beenden(
    v_kunde, p_ausleihe_id, p_end_station_id, p_latitude, p_longitude);
end;
$$;
