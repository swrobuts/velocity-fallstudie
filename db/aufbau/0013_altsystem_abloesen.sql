-- =====================================================================
-- 0013  Das Altsystem darf die Registrierung nicht mehr blockieren
-- =====================================================================
--
-- BEFUND (Pruefung von aussen, 24.08.2026)
-- Eine Registrierung mit einer bereits bekannten E-Mail scheiterte an
-- "Database error saving new user". Die Ursache lag nicht in diesem
-- Schema, sondern eine Ebene darunter:
--
--   auth.users
--     +- Trigger on_auth_user_created
--          +- "cityBikesRental".handle_new_user()
--               +- insert into "cityBikesRental".kunde (email, ...)
--
-- Die alte Fassung legte bei JEDER Registrierung einen neuen Altkunden
-- an. Fuer eine E-Mail, die dort schon steht - und das gilt fuer alle
-- 1015 uebernommenen Kunden - griff der Unique-Index kunde_email_key.
-- Der Insert schlug fehl, und weil er im Trigger der Auth-Transaktion
-- haengt, fiel die gesamte Registrierung zurueck. Es entstand weder ein
-- Auth-Benutzer noch sonst etwas.
--
-- Damit war jeder Bestandskunde dauerhaft ausgesperrt: genau die Gruppe,
-- die ein Onlinekonto beanspruchen soll.
--
-- WARUM NICHT DER TRIGGER FAELLT
-- Der naheliegende Schritt waere gewesen, on_auth_user_created zu
-- entfernen. Das geht hier aus zwei Gruenden nicht:
--
--   1. auth.users gehoert supabase_auth_admin. Der Zugang dieses
--      Projekts (postgres) ist dort nicht Eigentuemer und darf keinen
--      Trigger loeschen - "must be owner of relation users".
--   2. Der Trigger bedient eine ZWEITE Anwendung auf demselben Server.
--      Ihn ersatzlos zu streichen haette dort neue Registrierungen
--      stillschweigend ins Leere laufen lassen.
--
-- Die Funktion selbst gehoert postgres. Sie wird deshalb nicht entfernt,
-- sondern idempotent gemacht. Das loest dasselbe Problem, ohne die
-- Altanwendung zu beschaedigen - und ohne auth.users anzufassen.
--
-- WAS DIE NEUE FASSUNG ANDERS MACHT
--   * Steht die E-Mail schon in "cityBikesRental".kunde, wird der
--     vorhandene Satz verwendet statt eines zweiten angelegt.
--   * Die Zuordnung auth_uid -> kunde_id entsteht nur, wenn sie fehlt.
--   * Und der wichtigste Punkt: die Funktion kann die Registrierung
--     NICHT MEHR ZUM SCHEITERN BRINGEN. Was hier schiefgeht, wird als
--     Warnung protokolliert; die Anmeldung laeuft weiter. Ein Trigger,
--     der in ein fremdes Schema schreibt, darf niemals das Tor zur
--     Anwendung zuhalten.
--
-- Fuer diese Anwendung ist der Trigger ohnehin ohne Bedeutung:
-- velocity.api_kunde_sicherstellen() legt den Kundensatz beim ersten
-- Anmelden selbst an und verknuepft dabei einen vorhandenen Satz
-- derselben E-Mail, statt einen zweiten zu erzeugen.
--
-- ZURUECKNEHMEN
-- Die urspruengliche Fassung steht im Git-Verlauf dieses Projekts und
-- im Bericht doku/verifikation/velocity-ux-regression-audit-2026-08-24-v3.md.
--
-- NICHT ANGEFASST
-- Auf auth.users liegt ein zweiter Trigger, trg_log_login_event, der in
-- das Schema qs zeigt. Der gehoert einer weiteren Anwendung und wird
-- hier weder veraendert noch entfernt.
-- =====================================================================

create or replace function "cityBikesRental".handle_new_user()
returns trigger
language plpgsql
security definer
as $$
declare
  v_kunde_id integer;
begin
  begin
    -- Vorhandenen Altkunden derselben E-Mail wiederverwenden.
    select k.kunde_id into v_kunde_id
      from "cityBikesRental".kunde k
     where k.email = new.email;

    if v_kunde_id is null then
      insert into "cityBikesRental".kunde (
        email, passwort_hash, vorname, nachname, registriert_am, aktiv
      ) values (
        new.email,
        'SUPABASE_AUTH',
        coalesce(new.raw_user_meta_data ->> 'vorname',  'Unbekannt'),
        coalesce(new.raw_user_meta_data ->> 'nachname', 'Unbekannt'),
        now(),
        true
      )
      on conflict (email) do nothing
      returning kunde_id into v_kunde_id;

      -- Bei einem gleichzeitigen zweiten Versuch liefert do nothing
      -- keine Zeile zurueck; dann steht sie inzwischen da.
      if v_kunde_id is null then
        select k.kunde_id into v_kunde_id
          from "cityBikesRental".kunde k
         where k.email = new.email;
      end if;
    end if;

    if v_kunde_id is not null then
      insert into "cityBikesRental".auth_kunde_mapping (auth_uid, kunde_id)
      values (new.id, v_kunde_id)
      on conflict do nothing;
    end if;

  exception when others then
    -- Bewusst verschluckt: das Altsystem darf keine Registrierung
    -- verhindern. Die Warnung landet im Serverprotokoll.
    raise warning 'handle_new_user uebersprungen fuer %: % (%)',
      new.email, sqlerrm, sqlstate;
  end;

  return new;
end;
$$;

comment on function "cityBikesRental".handle_new_user() is
  'Legt fuer einen neuen Auth-Benutzer einen Altkunden an, sofern noch '
  'keiner mit dieser E-Mail existiert. Idempotent und fehlertolerant - '
  'seit 24.08.2026, nachdem die alte Fassung jede Registrierung eines '
  'Bestandskunden am Unique-Index kunde_email_key scheitern liess.';
