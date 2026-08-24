-- =====================================================================
-- Datenuebernahme aus cityBikesRental nach velocity
--
-- Zweck:      Einmalige Uebernahme des Altbestands. NICHT Teil des
--             Lehrpfads - der Entwurf steht fuer sich.
-- Objekte:    velocity.uebernahme_protokoll und Datenzeilen
-- Ruecknahme: TRUNCATE der Zieltabellen in Abhaengigkeitsreihenfolge.
--
-- Das Altschema wird ausschliesslich gelesen.
-- Zuordnung ueber fachliche Schluessel, nicht ueber Surrogatschluessel:
-- Kunde ueber email, Station ueber stationsnummer, Fahrrad ueber
-- rahmennummer, Typ und Tarif ueber die Bezeichnung.
--
-- Mehrfach ausfuehrbar: alle Einfuegungen sind ON CONFLICT DO NOTHING
-- bzw. ueber NOT EXISTS abgesichert.
-- =====================================================================

create table if not exists velocity.uebernahme_protokoll (
  protokoll_id  bigint generated always as identity primary key,
  lauf          timestamptz not null default now(),
  quelle        text not null,
  ziel          text not null,
  gelesen       integer not null default 0,
  geschrieben   integer not null default 0,
  uebersprungen integer not null default 0,
  hinweis       text,
  erstellt_am   timestamptz not null default now(),
  geaendert_am  timestamptz not null default now()
);

comment on table velocity.uebernahme_protokoll is
  'Protokoll der einmaligen Übernahme aus dem Altschema cityBikesRental.';
comment on column velocity.uebernahme_protokoll.protokoll_id  is 'Surrogatschlüssel.';
comment on column velocity.uebernahme_protokoll.lauf          is 'Zeitstempel des Uebernahmelaufs. Gleicher Wert für alle Zeilen eines Laufs.';
comment on column velocity.uebernahme_protokoll.quelle        is 'Gelesene Tabelle im Altschema.';
comment on column velocity.uebernahme_protokoll.ziel          is 'Beschriebene Tabelle im Schema velocity.';
comment on column velocity.uebernahme_protokoll.gelesen       is 'Anzahl der Sätze in der Quelle.';
comment on column velocity.uebernahme_protokoll.geschrieben   is 'Anzahl der tatsächlich neu angelegten Sätze.';
comment on column velocity.uebernahme_protokoll.uebersprungen is 'Anzahl der bewusst ausgelassenen Sätze.';
comment on column velocity.uebernahme_protokoll.hinweis       is 'Begründung für Abweichungen und getroffene Annahmen.';

-- Die Tabelle entsteht erst hier, also nach Schritt 0011. Damit sie nicht
-- als einzige ohne Zeilenschutz dasteht, wird er gleich mitgesetzt.
-- Weder anon noch authenticated erhalten eine Policy: das Protokoll ist
-- rein betrieblich.
alter table velocity.uebernahme_protokoll enable row level security;
select velocity.fn_audit_anhaengen('uebernahme_protokoll');

do $$
declare
  v_lauf     timestamptz := now();
  v_vorher   integer;
  v_nachher  integer;
  v_typ_city bigint; v_typ_ebike bigint; v_typ_cargo bigint;
  v_herst    bigint;
begin

  -- 1 Adressen der Kunden ---------------------------------------------
  select count(*) into v_vorher from velocity.adresse;

  insert into velocity.adresse (strasse, hausnummer, plz, ort)
  select distinct
         k.strasse,
         coalesce(k.hausnummer, ''),
         k.plz,
         coalesce(k.ort, 'unbekannt')
    from "cityBikesRental".kunde k
   where k.strasse is not null and k.plz ~ '^[0-9]{5}$'
  on conflict (strasse, hausnummer, plz, ort, land_code) do nothing;

  select count(*) into v_nachher from velocity.adresse;
  insert into velocity.uebernahme_protokoll (lauf, quelle, ziel, gelesen, geschrieben, hinweis)
  values (v_lauf, 'cityBikesRental.kunde', 'velocity.adresse',
          (select count(*) from "cityBikesRental".kunde), v_nachher - v_vorher,
          'Nur Sätze mit fuenfstelliger PLZ; dedupliziert über den Fachschluessel');

  -- 2 Kunden ------------------------------------------------------------
  select count(*) into v_vorher from velocity.kunde;

  insert into velocity.kunde
    (kundennummer, auth_uid, email, vorname, nachname, telefon, geburtsdatum,
     rechnungsadresse_id, status, registriert_am)
  select 'K-' || lpad(k.kunde_id::text, 6, '0'),
         m.auth_uid,
         k.email,
         k.vorname,
         k.nachname,
         k.telefon,
         k.geburtsdatum,
         a.adresse_id,
         case when k.aktiv then 'aktiv' else 'gesperrt' end::velocity.kunde_status,
         k.registriert_am at time zone 'Europe/Berlin'
    from "cityBikesRental".kunde k
    -- Nur Verweise auf tatsaechlich vorhandene Konten uebernehmen. Die alte
    -- Tabelle auth_kunde_mapping hatte KEINEN Fremdschluessel auf auth.users
    -- und enthaelt deshalb Verweise auf laengst geloeschte Konten. Der
    -- Fremdschluessel im neuen Modell deckt das sofort auf - genau dafuer
    -- ist er da.
    left join "cityBikesRental".auth_kunde_mapping m
           on m.kunde_id = k.kunde_id
          and exists (select 1 from auth.users u where u.id = m.auth_uid)
    left join velocity.adresse a
           on a.strasse    = k.strasse
          and a.hausnummer = coalesce(k.hausnummer, '')
          and a.plz        = k.plz
          and a.ort        = coalesce(k.ort, 'unbekannt')
   where k.email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
  on conflict (email) do nothing;

  select count(*) into v_nachher from velocity.kunde;
  insert into velocity.uebernahme_protokoll (lauf, quelle, ziel, gelesen, geschrieben, uebersprungen, hinweis)
  values (v_lauf, 'cityBikesRental.kunde', 'velocity.kunde',
          (select count(*) from "cityBikesRental".kunde), v_nachher - v_vorher,
          (select count(*) from "cityBikesRental".kunde) - (v_nachher - v_vorher),
          'passwort_hash wird bewusst nicht übernommen. auth_uid nur, wenn das '
          || 'Konto in auth.users tatsächlich existiert; von '
          || (select count(*) from "cityBikesRental".auth_kunde_mapping)::text
          || ' Eintraegen in auth_kunde_mapping sind '
          || (select count(*) from "cityBikesRental".auth_kunde_mapping m
               where not exists (select 1 from auth.users u where u.id = m.auth_uid))::text
          || ' verwaist (die alte Tabelle hatte keinen Fremdschluessel).');

  -- Nummernkreis nachziehen, damit neue Kunden nicht kollidieren
  perform setval('velocity.seq_kundennummer',
                 greatest((select coalesce(max(substring(kundennummer from 3)::bigint), 0)
                             from velocity.kunde), 1));

  /* 3 Adressen und Stationen ------------------------------------------

     GESCHAEFTSGEBIET IST WUERZBURG.

     Der Altbestand fuehrt drei Stationen in Schweinfurt - vierzig
     Kilometer entfernt, ohne Verbindung zum Wuerzburger Netz. Ein Rad
     kann nicht in einer Minute von einer Stadt in die andere gelangen,
     und ein Geschaeftsgebiet, das aus zwei getrennten Flaechen besteht,
     macht jede Aussage ueber Verfuegbarkeit und Wege mehrdeutig.

     Sie werden deshalb nicht uebernommen - zusammen mit ihren Raedern
     und den Fahrten, die dort begannen oder endeten. Das ist eine
     bewusste Entscheidung der Uebernahme, keine Panne; sie steht im
     uebernahme_protokoll und im Abgleichsbericht.

     Ausgelassen wird ueber den Ort, nicht ueber den Namen: eine Station
     kann umbenannt werden, ihre Anschrift bleibt. */
  insert into velocity.adresse (strasse, hausnummer, plz, ort)
  select distinct s.strasse, coalesce(s.hausnummer, ''), s.plz, s.ort
    from "cityBikesRental".station s
   where s.ort <> 'Schweinfurt'
  on conflict (strasse, hausnummer, plz, ort, land_code) do nothing;

  select count(*) into v_vorher from velocity.station;

  insert into velocity.station
    (stationsnummer, name, adresse_id, latitude, longitude, kapazitaet, betriebszeitraum)
  select 'S-' || lpad(s.station_id::text, 4, '0'),
         s.name,
         a.adresse_id,
         s.latitude, s.longitude,
         s.kapazitaet,
         case when s.aktiv then daterange(current_date - 365, null, '[)')
              else daterange(current_date - 365, current_date, '[)') end
    from "cityBikesRental".station s
    join velocity.adresse a
      on a.strasse = s.strasse and a.hausnummer = coalesce(s.hausnummer, '')
     and a.plz = s.plz and a.ort = s.ort
   where s.ort <> 'Schweinfurt'
  on conflict (stationsnummer) do nothing;

  select count(*) into v_nachher from velocity.station;
  insert into velocity.uebernahme_protokoll (lauf, quelle, ziel, gelesen, geschrieben, hinweis)
  values (v_lauf, 'cityBikesRental.station', 'velocity.station',
          (select count(*) from "cityBikesRental".station), v_nachher - v_vorher,
          'Stationsnummer aus der alten station_id gebildet. '
          || (select count(*) from "cityBikesRental".station where ort = 'Schweinfurt')::text
          || ' Stationen in Schweinfurt bewusst ausgelassen: nicht im Geschaeftsgebiet');

  -- 4 Hersteller und Modelle -------------------------------------------
  -- Im Altbestand gibt es keine Modellangabe. Statt sie zu erfinden,
  -- wird je Typ ein ausdruecklich als unbekannt gekennzeichnetes Modell
  -- angelegt.
  select count(*) into v_vorher from velocity.fahrradmodell;

  insert into velocity.hersteller (name) values ('unbekannt')
  on conflict (name) do nothing;
  select hersteller_id into v_herst from velocity.hersteller where name = 'unbekannt';

  select typ_id into v_typ_city  from velocity.fahrradtyp where typ_code = 'CITY';
  select typ_id into v_typ_ebike from velocity.fahrradtyp where typ_code = 'EBIKE';
  select typ_id into v_typ_cargo from velocity.fahrradtyp where typ_code = 'CARGO';

  insert into velocity.fahrradmodell (hersteller_id, typ_id, modellbezeichnung)
  values (v_herst, v_typ_city,  'Bestandsrad City'),
         (v_herst, v_typ_ebike, 'Bestandsrad E-Bike'),
         (v_herst, v_typ_cargo, 'Bestandsrad Cargo')
  on conflict (hersteller_id, modellbezeichnung) do nothing;

  select count(*) into v_nachher from velocity.fahrradmodell;
  insert into velocity.uebernahme_protokoll (lauf, quelle, ziel, gelesen, geschrieben, hinweis)
  values (v_lauf, '-', 'velocity.hersteller, velocity.fahrradmodell', 0, v_nachher - v_vorher,
          'Im Altbestand fehlen Hersteller- und Modellangaben; Platzhalter unbekannt angelegt');

  -- 5 Fahrraeder und Positionen ----------------------------------------
  select count(*) into v_vorher from velocity.fahrrad;

  insert into velocity.fahrrad (rahmennummer, modell_id, status, angeschafft_am)
  select f.rahmennummer,
         m.modell_id,
         case f.status::text
           when 'verfuegbar'  then 'verfuegbar'
           when 'ausgeliehen' then 'ausgeliehen'
           when 'wartung'     then 'wartung'
           else 'defekt'
         end::velocity.fahrrad_status,
         f.angeschafft_am
    from "cityBikesRental".fahrrad f
    join "cityBikesRental".fahrradtyp ft on ft.typ_id = f.typ_id
    join velocity.fahrradmodell m
      on m.modellbezeichnung = case ft.bezeichnung
                                 when 'CityRad'   then 'Bestandsrad City'
                                 when 'E-Rad'     then 'Bestandsrad E-Bike'
                                 when 'LastenRad' then 'Bestandsrad Cargo'
                               end
   -- Raeder, die in Schweinfurt stehen, bleiben mit ihrer Station drueben.
   where not exists (select 1 from "cityBikesRental".station s
                      where s.station_id = f.station_id and s.ort = 'Schweinfurt')
  on conflict (rahmennummer) do nothing;

  select count(*) into v_nachher from velocity.fahrrad;

  -- Position: NUR die Station, keine Koordinaten. Die random()-Werte des
  -- Altbestands werden verworfen.
  --
  -- Frueher standen hier zusaetzlich die Koordinaten der Station. Das
  -- verletzt GR13 - ein Rad hat genau EINE Ortsangabe, und an einer
  -- Station traegt die Station den Ort. Der CHECK
  -- fahrrad_position_ort_chk weist das ab; auf einer frischen Datenbank
  -- waere die Uebernahme daran gescheitert. Im Bestand fiel es nicht
  -- auf, weil die Zeilen schon existierten und do nothing griff.
  insert into velocity.fahrrad_position (fahrrad_id, station_id)
  select nf.fahrrad_id,
         ns.station_id
    from "cityBikesRental".fahrrad af
    join velocity.fahrrad nf on nf.rahmennummer = af.rahmennummer
    left join velocity.station ns
           on ns.stationsnummer = 'S-' || lpad(af.station_id::text, 4, '0')
  on conflict (fahrrad_id) do nothing;

  insert into velocity.uebernahme_protokoll (lauf, quelle, ziel, gelesen, geschrieben, hinweis)
  values (v_lauf, 'cityBikesRental.fahrrad', 'velocity.fahrrad, velocity.fahrrad_position',
          (select count(*) from "cityBikesRental".fahrrad), v_nachher - v_vorher,
          'Koordinaten aus random() verworfen; Position ausschliesslich aus der Station abgeleitet');

  -- 6 Mitgliedschaften und Freiminuten ---------------------------------
  select count(*) into v_vorher from velocity.mitgliedschaft;

  insert into velocity.mitgliedschaft (kunde_id, tarif_id, gueltigkeit)
  select nk.kunde_id,
         nt.tarif_id,
         daterange(am.gueltig_von, am.gueltig_bis, '[)')
    from "cityBikesRental".mitgliedschaft am
    join "cityBikesRental".kunde ak on ak.kunde_id = am.kunde_id
    join velocity.kunde nk on nk.email = ak.email
    join "cityBikesRental".tarif at on at.tarif_id = am.tarif_id
    join velocity.tarif nt
      on nt.tarif_code = case at.bezeichnung
                           when 'Basistarif'     then 'BASIS'
                           when 'Studententarif' then 'STUDENT'
                           when 'Premium'        then 'PREMIUM'
                           else 'OEPNV'
                         end
   where am.aktiv
     and not exists (select 1 from velocity.mitgliedschaft vm
                      where vm.kunde_id = nk.kunde_id
                        and vm.gueltigkeit && daterange(am.gueltig_von, am.gueltig_bis, '[)'));

  select count(*) into v_nachher from velocity.mitgliedschaft;

  -- Der alte Restzaehler wird in Kontingent und Verbrauch des laufenden
  -- Monats umgerechnet.
  insert into velocity.freiminuten_periode
    (mitgliedschaft_id, jahr, monat, kontingent_minuten, verbraucht_minuten)
  select nm.mitgliedschaft_id,
         extract(year  from current_date)::integer,
         extract(month from current_date)::integer,
         at.freiminuten_pro_monat,
         greatest(at.freiminuten_pro_monat - am.freiminuten_aktuell, 0)
    from "cityBikesRental".mitgliedschaft am
    join "cityBikesRental".kunde ak on ak.kunde_id = am.kunde_id
    join "cityBikesRental".tarif at on at.tarif_id = am.tarif_id
    join velocity.kunde nk on nk.email = ak.email
    join velocity.mitgliedschaft nm on nm.kunde_id = nk.kunde_id
                                   and nm.gueltigkeit @> current_date
   where am.aktiv
  on conflict (mitgliedschaft_id, jahr, monat) do nothing;

  insert into velocity.uebernahme_protokoll (lauf, quelle, ziel, gelesen, geschrieben, hinweis)
  values (v_lauf, 'cityBikesRental.mitgliedschaft',
          'velocity.mitgliedschaft, velocity.freiminuten_periode',
          (select count(*) from "cityBikesRental".mitgliedschaft), v_nachher - v_vorher,
          'freiminuten_aktuell umgerechnet: verbraucht = Kontingent minus Restwert');

  -- 7 Ausleihen ---------------------------------------------------------
  select count(*) into v_vorher from velocity.ausleihe;

  insert into velocity.ausleihe
    (kunde_id, fahrrad_id, start_station_id, startzeit, end_station_id, endzeit, status)
  select nk.kunde_id,
         nf.fahrrad_id,
         nss.station_id,
         aa.startzeit at time zone 'Europe/Berlin',
         nes.station_id,
         aa.endzeit   at time zone 'Europe/Berlin',
         case aa.status::text
           when 'aktiv'         then 'aktiv'
           when 'abgeschlossen' then 'abgeschlossen'
           else 'storniert'
         end::velocity.ausleihe_status
    from "cityBikesRental".ausleihe aa
    join "cityBikesRental".kunde   ak on ak.kunde_id   = aa.kunde_id
    join "cityBikesRental".fahrrad af on af.fahrrad_id = aa.fahrrad_id
    join velocity.kunde   nk on nk.email        = ak.email
    join velocity.fahrrad nf on nf.rahmennummer = af.rahmennummer
    left join velocity.station nss on nss.stationsnummer = 'S-' || lpad(aa.start_station_id::text, 4, '0')
    left join velocity.station nes on nes.stationsnummer = 'S-' || lpad(aa.end_station_id::text,   4, '0')
   -- Fahrten, die in Schweinfurt begannen oder endeten, gehoeren zu einem
   -- Netz, das dieses Modell nicht kennt. Ohne diese Bedingung liefe der
   -- LEFT JOIN auf NULL und die Zeile schlueg an ausleihe_startort_chk
   -- fehl - eine Ausleihe hat genau EINEN Startort.
   where not exists (select 1 from "cityBikesRental".station s
                      where s.ort = 'Schweinfurt'
                        and s.station_id in (aa.start_station_id, aa.end_station_id))
     and not exists (
     select 1 from velocity.ausleihe va
      where va.kunde_id = nk.kunde_id and va.fahrrad_id = nf.fahrrad_id
        and va.startzeit = aa.startzeit at time zone 'Europe/Berlin');

  select count(*) into v_nachher from velocity.ausleihe;

  -- Die historischen Kosten werden als EINE Position uebernommen. Eine
  -- Preisfindung, die nie stattgefunden hat, wird nicht rekonstruiert.
  insert into velocity.entgeltposition
    (ausleihe_id, entgeltart_id, menge, einzelbetrag, betrag, sortierung)
  select na.ausleihe_id,
         (select entgeltart_id from velocity.entgeltart where code = 'BESTANDSUEBERNAHME'),
         1, aa.kosten, aa.kosten, 1
    from "cityBikesRental".ausleihe aa
    join "cityBikesRental".kunde   ak on ak.kunde_id   = aa.kunde_id
    join "cityBikesRental".fahrrad af on af.fahrrad_id = aa.fahrrad_id
    join velocity.kunde   nk on nk.email        = ak.email
    join velocity.fahrrad nf on nf.rahmennummer = af.rahmennummer
    join velocity.ausleihe na on na.kunde_id = nk.kunde_id
                             and na.fahrrad_id = nf.fahrrad_id
                             and na.startzeit = aa.startzeit at time zone 'Europe/Berlin'
   where aa.kosten is not null
     and not exists (select 1 from velocity.entgeltposition ep
                      where ep.ausleihe_id = na.ausleihe_id);

  insert into velocity.uebernahme_protokoll (lauf, quelle, ziel, gelesen, geschrieben, hinweis)
  values (v_lauf, 'cityBikesRental.ausleihe', 'velocity.ausleihe, velocity.entgeltposition',
          (select count(*) from "cityBikesRental".ausleihe), v_nachher - v_vorher,
          'Altbetraege als Position BESTANDSUEBERNAHME; historische Preise sind nicht rekonstruierbar');

  -- 8 Nicht uebernommen -------------------------------------------------
  insert into velocity.uebernahme_protokoll (lauf, quelle, ziel, gelesen, geschrieben, uebersprungen, hinweis)
  values (v_lauf, 'cityBikesRental.station_fahrradtyp', '-',
          (select count(*) from "cityBikesRental".station_fahrradtyp), 0,
          (select count(*) from "cityBikesRental".station_fahrradtyp),
          'Bewusst nicht übernommen: fachlich nirgends ausgewertet');

end $$;
