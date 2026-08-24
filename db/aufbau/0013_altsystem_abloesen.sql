-- =====================================================================
-- 0013  Der Altsystem-Trigger auf auth.users wird stillgelegt
-- =====================================================================
--
-- ZWEI BEFUNDE, EINE URSACHE
--
-- (1) Registrierung unmoeglich (Pruefung von aussen, 24.08.2026)
--     Eine Anmeldung mit bekannter E-Mail scheiterte an "Database error
--     saving new user":
--
--       auth.users
--         +- Trigger on_auth_user_created
--              +- "cityBikesRental".handle_new_user()
--                   +- insert into "cityBikesRental".kunde (email, ...)
--
--     Die Funktion legte bei JEDER Registrierung einen neuen Altkunden
--     an. Fuer eine E-Mail, die dort schon stand - und das galt fuer alle
--     1015 uebernommenen Kunden -, griff der Unique-Index
--     kunde_email_key. Der Insert schlug fehl, und weil er im Trigger der
--     Auth-Transaktion haengt, fiel die gesamte Registrierung zurueck.
--
-- (2) Fremde Projekte im Kundenbestand (24.08.2026)
--     auth.users ist auf diesem Server GEMEINSAM. Darauf laufen unter
--     anderem die Lehrveranstaltungsevaluation (Schema qs, Tabellen
--     lve_bogen, lve_item_response, lve_login_event) und weitere
--     Projekte. Der Trigger unterschied nicht, WOFUER sich jemand
--     anmeldete - er machte aus jeder Anmeldung einen Fahrradkunden.
--
--     Die Belege stehen im Datum:
--
--       qs.allow_email              "cityBikesRental".kunde   Altfahrten
--       robert.butscher@thws.de     +65 Minuten spaeter       0
--         27.04.2026 05:07            27.04.2026 06:12
--       arnd.gottschalk@thws.de     +114 Minuten spaeter      0
--         06.05.2026 15:01            06.05.2026 16:55
--
--     Beide wurden freigeschaltet, meldeten sich bei der Evaluation an -
--     und landeten im Fahrradverleih. Ohne je ein Rad geliehen zu haben.
--     Zum Vergleich: swrobuts@googlemail.com ist Kunde seit 15.01.2026
--     mit sieben Fahrten, also drei Monate vor dem LVE-Eintrag. Ein
--     echter Kunde, kein Ueberlaeufer.
--
-- WARUM DIE FUNKTION UND NICHT DER TRIGGER
-- auth.users gehoert supabase_auth_admin. Der Zugang dieses Projekts
-- (postgres) ist dort nicht Eigentuemer und darf keinen Trigger loeschen
-- - "must be owner of relation users". Die Funktion gehoert dagegen
-- postgres. Sie wird deshalb auf einen Leerlauf gesetzt. Das ist in der
-- Wirkung dasselbe wie das Entfernen des Triggers, mit dem Unterschied,
-- dass die Zeile in pg_trigger stehenbleibt.
--
-- WAS DAS BEDEUTET
-- Kein Projekt auf diesem Server erzeugt mehr Fahrradkunden. Diese
-- Anwendung braucht den Trigger ohnehin nicht:
-- velocity.api_kunde_sicherstellen() legt den Kundensatz beim ersten
-- Anmelden an DER STELLE an, an der er hingehoert - und verknuepft dabei
-- einen vorhandenen Satz derselben E-Mail, statt einen zweiten zu
-- erzeugen. Wer sich fuer die Evaluation anmeldet, taucht hier nicht
-- mehr auf.
--
-- SAUBER TRENNEN HEISST: DIE ANWENDUNG HOLT SICH, WAS SIE BRAUCHT.
-- Sie laesst es sich nicht von einer gemeinsamen Tabelle zuschieben.
--
-- ZURUECKNEHMEN
-- Die urspruengliche Fassung steht im Git-Verlauf dieses Projekts.
--
-- NICHT ANGEFASST
-- Auf auth.users liegt ein zweiter Trigger, trg_log_login_event, der in
-- das Schema qs zeigt. Der gehoert der Evaluation und ist dort richtig.
-- =====================================================================

create or replace function "cityBikesRental".handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  -- Leerlauf. Siehe den Kopf dieser Datei.
  --
  -- Der Trigger liegt auf einer Tabelle, die sich mehrere Anwendungen
  -- teilen. Was hier passiert, passiert fuer alle - und darf deshalb
  -- gar nichts sein. Wer einen Kundensatz braucht, legt ihn in seinem
  -- eigenen Schema an, wenn er ihn braucht.
  return new;
end;
$$;

comment on function "cityBikesRental".handle_new_user() is
  'Leerlauf seit 24.08.2026. Die Vorgaengerfassung legte bei jeder '
  'Anmeldung auf dem gemeinsamen auth.users einen Fahrradkunden an - '
  'auch fuer Anmeldungen anderer Projekte (LVE/qs) - und liess '
  'Registrierungen bekannter E-Mails am Unique-Index scheitern.';
