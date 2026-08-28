-- =====================================================================
-- VeloCity - Demozugang fuer die Warenwirtschaft (nur lesend)
-- =====================================================================
-- Zweck:   Legt den MITARBEITERSATZ zum oeffentlich beworbenen
--          Demozugang an ("demo"/"demo" auf der Anmeldeseite von
--          wawi.butscher.cloud) und ordnet ihm ausschliesslich die
--          Rolle 'demo' zu - KEINE der vier Fachrollen. Was 'demo' in
--          der Datenbank darf und nicht darf, steht ausfuehrlich in
--          db/aufbau/0020_demo_zugang.sql; diese Datei tut fuer den
--          Demozugang nur das, was mitarbeiter_pruefkonto.sql fuer das
--          Pruefkonto schon tut - dieselbe Vorlage, eine Rolle statt
--          vier.
--
-- Vorbedingung: Der Anmeldesatz muss in auth.users existieren. Er wird
--          NICHT hier angelegt: das Setzen von Passwoertern gehoert in
--          die Hand des Betreibers, nicht in eine Datei im Repository.
--
--          E-Mail-Adresse: Supabase verlangt fuer die Anmeldung eine
--          E-Mail-Adresse, "demo" allein waere keine. Der Anmeldesatz
--          muss deshalb unter der TECHNISCHEN Adresse
--
--              demo@wawi.invalid
--
--          angelegt werden - derselbe Wert wie WAWI_CONFIG.demoEmail in
--          wawi/config.js. Die Endung .invalid ist nach RFC 2606
--          ausdruecklich dafuer reserviert, niemals eine echte,
--          registrierbare Domain zu sein: diese Adresse kann folglich
--          nie mit einer echten Kundin oder einem echten Mitarbeiter
--          kollidieren, auch nicht mit einer echten Adresse, die
--          zufaellig mit "demo" beginnt (kennungZuEmail() in
--          wawi/anmeldung.js bildet ausschliesslich die EXAKTE Eingabe
--          "demo" auf diese Adresse ab, kein Praefix-Test).
--
--          Kennwortlaenge: Supabase Auth (GoTrue) erzwingt serverseitig
--          eine Mindestlaenge fuer Kennwoerter. Diese Instanz
--          (supabase.butscher.cloud, selbstgehostet) hat weder ueber
--          GET /auth/v1/settings noch ueber eine Konfigurationstabelle
--          im Schema auth eine Mindestlaenge offengelegt - beides
--          nachgemessen beim Bau dieser Datei, ohne dabei ein Konto
--          probeweise anzulegen (das ist Betreiberaufgabe, siehe oben).
--          GoTrues Standardwert (Umgebungsvariable
--          GOTRUE_PASSWORD_MIN_LENGTH bzw. PASSWORD_MIN_LENGTH) liegt
--          bei SECHS Zeichen; "demo" hat VIER. Vor dem Anlegen des
--          Kontos bitte in Supabase Studio -> Authentication -> Add
--          user ausprobieren, ob das Kennwort "demo" angenommen wird:
--            - Wird es angenommen (die Instanz hat die Mindestlaenge
--              bereits herabgesetzt): Konto mit Kennwort "demo" anlegen,
--              wie auf der Anmeldeseite versprochen.
--            - Wird es abgelehnt: entweder GOTRUE_PASSWORD_MIN_LENGTH /
--              PASSWORD_MIN_LENGTH in der eigenen Docker-Compose-
--              Konfiguration der Auth-Instanz auf 4 senken, oder ein
--              laengeres Kennwort waehlen - der Betreiber hat sich fuer "demodemo"
--              entschieden, und genau das nennt die Anmeldeseite - und dann
--              den Hinweistext auf der Anmeldeseite entsprechend
--              anpassen (index.demoHinweis in wawi/rahmen.js, alle
--              sechs Sprachen).
--
-- Idempotent: laeuft beliebig oft, legt nichts doppelt an.
--
-- Ausfuehren: python3 db/run.py db/betrieb/mitarbeiter_demozugang.sql
--             ERST NACHDEM der Anmeldesatz in auth.users existiert.
-- =====================================================================

-- ---- 1: Der Mitarbeitersatz -------------------------------------------
-- Eigener Personalsatz, keine reale Person: der Demozugang zeigt fremde,
-- laengst erfundene Geschaeftsdaten (siehe db/betrieb/referenzdaten_*.sql),
-- traegt aber selbst keine.
insert into velocity.mitarbeiter
       (personalnummer, auth_uid, vorname, nachname, email, eingetreten_am)
select 'M-DEMO', u.id, 'Demo', 'Zugang', u.email, current_date
  from auth.users u
 where u.email = 'demo@wawi.invalid'
   and not exists (select 1 from velocity.mitarbeiter m
                    where m.personalnummer = 'M-DEMO');

-- ---- 2: Ausschliesslich die Rolle 'demo' -------------------------------
-- Bewusst NICHT wie mitarbeiter_pruefkonto.sql (dort alle vier
-- Fachrollen): ein Demozugang mit einer Fachrolle koennte ueber deren
-- api_-Funktionen schreiben. 'demo' ist keine Fachrolle und wird von
-- keiner einzigen api_-Funktion verlangt (siehe fn_rolle_verlangen in
-- 0019_wawi_logik.sql) - das Konto bleibt dadurch strukturell lesend,
-- unabhaengig davon, was ausser dieser Zeile noch passiert.
insert into velocity.mitarbeiter_rolle (mitarbeiter_id, rolle_id)
select m.mitarbeiter_id, r.rolle_id
  from velocity.mitarbeiter m cross join velocity.rolle r
 where m.personalnummer = 'M-DEMO'
   and r.code = 'demo'
on conflict (mitarbeiter_id, rolle_id) do nothing;

-- ---- 3: Nachweis --------------------------------------------------------
do $$
declare
  v_rollen integer;
  v_codes  text;
begin
  if not exists (select 1 from auth.users where email = 'demo@wawi.invalid') then
    raise exception 'Anmeldesatz demo@wawi.invalid fehlt in auth.users. '
                    'Erst in Supabase Studio anlegen (siehe Kopfkommentar dieser '
                    'Datei zur Kennwortlaenge), dann diese Datei erneut laufen lassen.';
  end if;

  select count(*), string_agg(r.code, ',' order by r.code)
    into v_rollen, v_codes
    from velocity.mitarbeiter m
    join velocity.mitarbeiter_rolle mr on mr.mitarbeiter_id = m.mitarbeiter_id
    join velocity.rolle r on r.rolle_id = mr.rolle_id
   where m.personalnummer = 'M-DEMO';

  if v_rollen <> 1 or v_codes <> 'demo' then
    raise exception 'M-DEMO traegt % Rolle(n) (%) statt genau "demo"', v_rollen, v_codes;
  end if;

  raise notice 'M-DEMO angelegt und ausschliesslich mit der Rolle demo versehen.';
end;
$$;
