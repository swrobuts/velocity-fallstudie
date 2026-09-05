-- =====================================================================
--  DEMOKONTO DER KUNDENWEBSITE MIT EINEM KUNDENSATZ VERBINDEN
--
--  ANLASS
--
--  Das persönliche Dashboard auf bikes.butscher.cloud ist erst nach
--  Anmeldung sichtbar. Studierende sollen es ohne Registrierung über
--  eine Mailadresse ansehen können — dafür gibt es ein Demokonto, und
--  dafür braucht dieses Konto einen Kundensatz mit echter Historie.
--
--  DAS ANMELDEKONTO LEGT DIESE DATEI NICHT AN. Es heißt
--  demo@bikes.invalid und entsteht in Supabase Studio, mit „Auto
--  Confirm User": an .invalid kommt keine Bestätigungsmail an. auth.users
--  gehört nicht zum Schema velocity, und Zugangsdaten gehören nicht in
--  eine Datei im Repository.
--
--  DER KUNDENSATZ: K-000001, ausgewählt aus 495 Kandidaten nach allen
--  drei Radtypen, mindestens zwölf Monaten mit Fahrten, mindestens sechs
--  Rechnungen und keinem bestehenden Anmeldekonto. 30 abgeschlossene
--  Fahrten, 9 Rechnungen, 05.01.2025 bis 24.08.2026.
--
--  DIE UMBENENNUNG
--
--  Der Satz hieß „Max Mustermann" — und genau so heißt im Impressum und
--  im Fußbereich der Geschäftsführer der VeloCity GmbH
--  (src/rechtliches.html, src/index.html). Ein Demokunde desselben
--  Namens hätte zwei verschiedene Rollen unter einem Namen geführt.
--  „Clara Fake" löst das auf und sagt zugleich, dass die Person erfunden
--  ist. Der Name stammt aus der Liste des Betreibers für erfundene
--  Personen. DIE IMPRESSUMSZEILEN WERDEN NICHT ANGEFASST.
--
--  DIE ADRESSE ZIEHT EINE ANDERE DATEI NACH.
--  db/betrieb/kundenmails_anonymisieren.sql leitet sie aus dem Namen ab;
--  nach einem erneuten Lauf heißt sie clara.fake@mail.invalid. Deshalb
--  die Reihenfolge: erst diese Datei, dann jene.
--
--  DER PROTOKOLLTRIGGER BLEIBT AN. velocity.kunde trägt
--  trg_kunde_protokoll, die Umbenennung landet also mit Alt- und Neuwert
--  im Änderungsprotokoll. Anders als bei den Mailadressen ist das hier
--  erwünscht: „Max Mustermann" ist kein schützenswertes Personendatum,
--  sondern ein Platzhaltername, und ein nachvollziehbarer
--  Stammdatenvorgang ist genau das, was Bereich K zeigen soll.
--
--  IDEMPOTENT: Ein zweiter Lauf findet den Satz umbenannt und verknüpft
--  vor und schreibt nichts an — auch keine zweite Protokollzeile.
--
--  Aufruf:
--    psql -U postgres -d postgres -f db/betrieb/demokonto_website.sql
-- =====================================================================

do $$
declare
  v_uid   uuid;
  v_kunde bigint;
  v_name  integer;
  v_link  integer;
begin
  select id into v_uid from auth.users where email = 'demo@bikes.invalid';
  if v_uid is null then
    raise exception
      'Das Anmeldekonto demo@bikes.invalid fehlt. Erst in Supabase Studio anlegen '
      '(Authentication, Add user, "Auto Confirm User" ankreuzen), dann diese Datei.';
  end if;

  select kunde_id into v_kunde from velocity.kunde where kundennummer = 'K-000001';
  if v_kunde is null then
    raise exception 'Kundensatz K-000001 gibt es nicht';
  end if;

  -- Getrennt gezählt, damit der Hinweis am Ende sagen kann, was dieser
  -- Lauf tatsächlich getan hat. Beide Bedingungen machen den zweiten
  -- Lauf wirkungslos, statt ihn nur unschaedlich zu machen.
  update velocity.kunde
     set vorname = 'Clara', nachname = 'Fake'
   where kunde_id = v_kunde
     and (vorname, nachname) is distinct from ('Clara', 'Fake');
  get diagnostics v_name = row_count;

  update velocity.kunde
     set auth_uid = v_uid
   where kunde_id = v_kunde
     and auth_uid is distinct from v_uid;
  get diagnostics v_link = row_count;

  -- ---- Gegenprobe --------------------------------------------------
  if not exists (select 1 from velocity.kunde
                  where kunde_id = v_kunde and auth_uid = v_uid
                    and vorname = 'Clara' and nachname = 'Fake') then
    raise exception 'Umbenennung oder Verknuepfung hat nicht gegriffen';
  end if;

  if exists (select 1 from velocity.kunde
              where auth_uid = v_uid and kunde_id <> v_kunde) then
    raise exception 'Das Demokonto haengt an mehr als einem Kundensatz';
  end if;

  -- Ein Demokonto ohne Fahrten zeigte ein leeres Dashboard und waere als
  -- Vorfuehrung wertlos. Die Zahl steht bewusst nicht fest verdrahtet:
  -- geprueft wird, DASS Historie da ist, nicht wie viel.
  if (select count(*) from velocity.v_fahrt_kennzahl where kunde_id = v_kunde) = 0 then
    raise exception 'Der verknuepfte Kundensatz hat keine abgeschlossene Fahrt';
  end if;

  raise notice 'Demokonto verbunden mit K-000001 (Clara Fake), kunde_id %; % Namensaenderung, % Verknuepfung',
    v_kunde, v_name, v_link;
end;
$$;

-- ---- Rücknahme -------------------------------------------------------
-- update velocity.kunde
--    set vorname = 'Max', nachname = 'Mustermann', auth_uid = null
--  where kundennummer = 'K-000001';
-- Danach db/betrieb/kundenmails_anonymisieren.sql erneut laufen lassen,
-- damit die Adresse dem Namen wieder folgt.
