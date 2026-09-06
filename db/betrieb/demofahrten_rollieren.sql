-- =====================================================================
--  DEMOFAHRTEN VON K-000001 MONATLICH IN DEN LAUFENDEN MONAT ROLLIEREN
--
--  ANLASS
--
--  Das persoenliche Dashboard zeigt einen Block "Dieser Monat" mit drei
--  Ringen (Fahrten/Kilometer/Minuten des laufenden Kalendermonats gegen
--  den eigenen Median der Vormonate, src/dashboard.js Funktion
--  ringeZeichnen()). Ohne Fahrt im laufenden Monat bleibt der Block leer
--  - ringeZeichnen() bricht bewusst ab, wenn "aktuell" fehlt.
--
--  Der Lehrdatensatz endet Anfang September 2026 (letzte echte Fahrt der
--  gesamten Flotte gemessen: 03.09.2026). Der Demokunde K-000001 (Clara
--  Fake, siehe db/betrieb/demokonto_website.sql) hatte am 06.09.2026
--  null Fahrten im damals laufenden Monat September 2026 - der Block war
--  deshalb leer, und mit jedem weiteren Monat ohne Eingriff wuerde die
--  Vorfuehrung toter wirken.
--
--  Auftrag des Betreibers, woertlich: "es muss einen job auf der DB
--  geben, der regelmaessig Demodaten schreibt, damit das nicht gleich
--  veraltet." Zusaetzlich fuer den Sofortbedarf: der laufende Monat soll
--  einmalig auf den eigenen Median plus eins kommen, kein Alibi mit
--  einer einzigen Fahrt. (Bis zum 06.09.2026 stand hier die feste
--  Vorgabe "10-15" - warum sie weg ist, steht unten bei SOFORTBEDARF.)
--
--  ---------------------------------------------------------------------
--  DAS ENTWURFSPROBLEM: WACHSTUM STATT ROLLIEREN
--
--  Ein Job, der monatlich neue Fahrten ANLEGT, laesst Claras Summe
--  unbegrenzt wachsen. Nach einem Jahr waere sie uneinholbar Erste unter
--  495 gewerteten Kunden, und genau die Einordnung, die als Lehrbeispiel
--  gedacht ist - "Platz 19 von 495", Median, Statusstufe -, waere
--  wertlos. Auch die fuenf Statusstufen (STUFEN in src/dashboard.js,
--  feste Kilometerschwellen 0/90/120/150/200) verloeren ihren Sinn, wenn
--  ein Konto sie automatisch durchliefe.
--
--  GEWAEHLTER WEG: Verschieben statt Erzeugen. Der Job verlegt den
--  AELTESTEN Monat mit Fahrten von K-000001 per UPDATE von startzeit/
--  endzeit in den laufenden Monat - dieselben Zeilen, derselbe
--  Fremdschluessel auf fahrrad_id und mitgliedschaft_id, nur ein anderer
--  Zeitstempel. Summe, Kilometer, Rang und Stufe bleiben dadurch
--  RECHNERISCH EXAKT gleich, weil:
--
--    - velocity.v_meine_bilanz (Rang, Stufe-Basis km_gesamt) summiert
--      ueber ALLE Fahrten eines Kunden ohne Zeitfilter - eine Fahrt
--      zaehlt unabhaengig davon, in welchem Monat sie steht.
--    - velocity.v_fahrt_kennzahl.kilometer haengt bei geschaetzter
--      Strecke von velocity.rechenannahme ab (umwegfaktor,
--      reisegeschwindigkeit, max_fahrzeit_je_tag, co2_pkw, co2_rad,
--      co2_ebike). Nachgemessen am 06.09.2026: JEDE dieser sieben
--      Annahmen hat genau EINE Zeile mit gueltigkeit = [2025-01-01, )
--      - unbegrenzt gueltig seit dem Beginn des gesamten Datensatzes.
--      Ein Zeitstempel-Schwenk von 2025 nach 2026 trifft also immer
--      dieselbe Annahmenzeile; der berechnete Kilometerwert einer
--      verschobenen Fahrt aendert sich nicht. Waere das nicht so (mehrere
--      Gueltigkeitsperioden), koennte eine Verschiebung stillschweigend
--      einen anderen Kilometerwert erzeugen - genau das Risiko, das
--      dieser Absatz ausschliesst, statt es zu vermuten.
--    - Die Fahrtdauer (und damit bei gleicher Start-/Zielstation auch
--      eine dauerbasierte Kilometerschaetzung) bleibt erhalten, weil
--      endzeit um genau dasselbe Intervall verschoben wird wie startzeit.
--
--  NACHTEIL, bewusst in Kauf genommen: die Zwoelf-Monats-Kurve (Ringe,
--  "Verlauf") wiederholt sich nach einigen Zyklen in einem festen Muster
--  statt organisch zu wachsen, und einzelne Fahrten "wandern" auf dem
--  Kalender. Siehe Abschnitt "WIE SICH DAS MUSTER LANGFRISTIG VERHAELT"
--  weiter unten fuer die genaue Herleitung.
--
--  ---------------------------------------------------------------------
--  WAS AUSDRUECKLICH NICHT GETAN WIRD, UND WARUM
--
--  1. KEINE gestellten Rechnungen werden verschoben oder umdatiert.
--     An ausleihe haengen zwei Fremdschluessel: entgeltposition (kaskadiert
--     mit, unproblematisch - der Betrag ist ein gespeicherter Wert, kein
--     abgeleiteter) und rechnungsposition (on delete restrict, kein
--     kaskadierendes Update auf ein Datum). Nachgemessen am 06.09.2026:
--     von Claras 12 Monaten mit Fahrten sind 9 bereits mit status
--     'gestellt' abgerechnet (September 2025 bis Juni 2026, Rechnungen
--     R-2025-09-001529 bis R-2026-06-001529 - die Rechnungsnummer traegt
--     die Periode sogar im Namen). Nur drei Monate sind UNABGERECHNET:
--     Januar 2025 (1 Fahrt, "BESTANDSUEBERNAHME" aus der Altdatenuebernahme,
--     nie regulaer bepreist), April 2025 (1 Fahrt, ebenso) und August 2026
--     (6 Fahrten, schlicht noch nicht abgerechnet - velocity.
--     fn_rechnung_erzeugen lief zuletzt am 05.09.2026 nur bis 07/2026,
--     siehe db/betrieb/referenzdaten_rechnungen.sql). Dieser Job waehlt
--     als Rollmonat IMMER NUR einen Monat, dessen Fahrten KEINE einzige
--     rechnungsposition tragen (Bedingung "not exists" gegen
--     rechnungsposition, siehe Funktion unten) - eine bereits gestellte
--     Rechnung ist ein abgeschlossener Geschaeftsvorfall; sie im
--     Nachhinein einem anderen Monat zuzuordnen waere schlechtere Praxis
--     als der Verzicht darauf. rechnung/rechnungsposition werden von
--     dieser Datei an keiner Stelle gelesen (ausser der genannten
--     not-exists-Prufung) oder geschrieben.
--  2. KEINE Zeile in velocity.kunde wird angefasst - weder Name noch
--     Status noch irgendein anderes Feld. Der Protokolltrigger
--     trg_kunde_protokoll auf kunde bleibt deshalb unberuehrt, weil er
--     nie ausgeloest wird (diese Datei aendert kein einziges Feld von
--     kunde). Nachgemessen: ausleihe traegt nur trg_ausleihe_audit
--     (setzt lediglich geaendert_am, siehe velocity.fn_audit_setzen in
--     0001_schema_und_konventionen.sql) - keinen Protokolltrigger.
--  3. KEIN taeglicher oder woechentlicher Lauf. Eine "abgeschlossene"
--     Fahrt mit einer Endzeit in der Zukunft waere ein sofort sichtbarer
--     Widerspruch (u.a. in einer moeglichen "letzte Fahrten"-Liste). Der
--     Job laeuft deshalb einmal monatlich, am 1. um 22:30 UTC - spaet
--     genug am Tag, dass fuer den EINMALIGEN Sofort-Auffuellschritt und
--     jeden kuenftigen Lauf ein Fenster von rund 22 Stunden am selben
--     Kalendertag zur Verfuegung steht, das garantiert nicht in der
--     Zukunft liegt. Die Rollfunktion selbst deckelt zusaetzlich JEDEN
--     neuen Zeitstempel auf "now() minus 2 Stunden" (Puffer fuer die
--     eigene Fahrtdauer) - unabhaengig von der Tageszeit des Laufs kann
--     also nie eine zukuenftige Endzeit entstehen.
--  3b. KEIN Testjob nebenher. In cron.job stand bis zum 06.09.2026 ein
--  zweiter Eintrag "velo_test_job" mit dem Befehl "select 2;", taeglich
--  um 4:07 - ein Ueberbleibsel vom Ausprobieren der Erweiterung, das in
--  keiner Datei dieses Repos vorkam. Harmlos, aber nach drei Wochen
--  weiss niemand mehr, woher er kommt. Entfernt mit
--  select cron.unschedule('velo_test_job'); seither ist
--  demofahrten_rollieren der einzige Eintrag.
--
--  4. KEIN hartkodiertes kunde_id. Die Funktion schlaegt kundennummer
--     'K-000001' bei jedem Lauf neu nach - der Ersatzschluessel kunde_id
--     (bigint generated always as identity) ist eine Umgebungseigenschaft,
--     die feste Fachschluessel wie die Kundennummer nicht ist.
--  5. KEINE Erweiterung ueber "postgres" anlegen. postgres traegt in
--     dieser Instanz rolsuper = false; "create extension pg_cron"
--     verlangt einen echten Superuser. Gemessen: shared_preload_libraries
--     enthaelt pg_cron bereits, cron.database_name = postgres - der
--     Scheduler laeuft, sobald die Erweiterung besteht, ohne Neustart.
--     Nur DIESER eine Schritt (und das anschliessende Setzen von
--     username bei der Planung, s.u.) braucht supabase_admin; jede
--     andere Zeile dieser Datei liefe auch unter postgres (rolbypassrls
--     = true) unveraendert durch - die ganze Datei laeuft trotzdem in
--     einem Rutsch unter supabase_admin, aus demselben Grund wie in
--     db/betrieb/lehrzugang.sql: ein Superuser kann alles, was postgres
--     kann, und zusaetzlich das eine noetige Mehr.
--
--  ---------------------------------------------------------------------
--  WARUM DER GEPLANTE JOB ALS "postgres" LAEUFT, NICHT ALS "supabase_admin"
--
--  cron.schedule_in_database(job_name, schedule, command, database,
--  username) legt username explizit fest, statt (wie das einfache
--  cron.schedule) current_user zu uebernehmen - nachgemessen per \df in
--  der installierten Version 1.6.4. cron.job traegt eine RLS-Policy
--  "username = CURRENT_USER" (nachgemessen per pg_policy); ein Lauf mit
--  username 'postgres' ist damit spaeter ueber db/run.py (verbindet als
--  postgres) sichtbar und - nach dem einmaligen "grant usage on schema
--  cron to postgres" weiter unten, ebenfalls unter supabase_admin
--  noetig - auch unschedule-bar, ohne fuer jede Kontrolle erneut per ssh
--  auf supabase_admin zurueckzugreifen. Ein taeglich unbeaufsichtigt
--  laufender Auftrag als vollstaendiger Superuser waere unnoetig
--  weitreichend; postgres reicht (rolbypassrls = true) fuer jede Zeile,
--  die dieser Job schreibt.
--
--  ---------------------------------------------------------------------
--  WIE SICH DAS MUSTER LANGFRISTIG VERHAELT (nachgerechnet, nicht nur
--  behauptet)
--
--  Die neun bereits abgerechneten Monate (September 2025 bis Juni 2026)
--  werden von dieser Funktion NIE angefasst (Punkt 1 oben) - sie bleiben
--  fuer immer stehen, ein fester historischer Sockel. Die verbleibenden
--  Monate - anfangs Januar 2025, April 2025 und August 2026, macht drei
--  - bilden einen ROLLIERENDEN Vorrat: jeder Lauf leert genau einen davon
--  (den jeweils aeltesten) und fuellt dafuer den laufenden Monat, der
--  danach selbst Teil dieses Vorrats ist. Die Anzahl der "Fahrten
--  habenden" Monate in diesem Vorrat bleibt dadurch fuer immer bei drei,
--  die Gesamtzahl der darin enthaltenen Fahrten fuer immer bei der Summe
--  aus dem Sofort-Auffuellschritt (1 verschoben + N neu, siehe unten).
--  Nach drei bis vier Zyklen bestehen alle drei rollierenden Monate aus
--  Fahrten, die diese Datei selbst angelegt hat oder verschoben hat -
--  das Muster wiederholt sich von da an mit denselben drei Groessen,
--  nur auf immer neue Kalendermonate bezogen. Das ist die praezise
--  Fassung des oben genannten Nachteils "die Kurve wiederholt sich".
--
--  Findet die Funktion keinen unabgerechneten Altmonat mehr (Vorrat
--  erschoepft - kann nach heutigem Stand nicht eintreten, siehe Absatz
--  oben, aber die Funktion ist dagegen abgesichert), schreibt sie eine
--  Notiz und laesst den laufenden Monat leer, statt eine Ausnahme zu
--  werfen - ein Systemzustand, der Aufmerksamkeit verdient, ist in
--  diesem Lehrkontext kein Grund, den Cron-Lauf als "failed" zu melden.
--
--  ---------------------------------------------------------------------
--  SOFORTBEDARF: WAS DER EINMALIGE AUFFUELLSCHRITT TUT UND WAS ER KOSTET
--
--  Der aelteste Monat (Januar 2025) traegt nur eine einzige Fahrt - zu
--  wenig. Diese Datei verschiebt daher EINMALIG diese eine Fahrt (ueber
--  die normale Rollfunktion, siehe unten) UND fuellt den laufenden Monat
--  mit echten neuen Fahrten auf.
--
--  DAS ZIEL IST DER EIGENE MEDIAN PLUS EINS, NICHT MEHR 13 (berichtigt
--  06.09.2026). Zuerst stand hier die feste Zahl 13, aus der Vorgabe
--  "ein voller Monat, 10-15". Das Ergebnis war im Dashboard sofort zu
--  sehen und falsch: Clara faehrt im Median 3 Fahrten im Monat, ihr
--  bester Monat hat 6. Mit 13 stand der Block "Dieser Monat" an jedem
--  Anschlag - Balken voll, Medianmarke ganz links -, und zwar Monat fuer
--  Monat, weil der Auffuellschritt das Ziel jedes Mal neu herstellt. Ein
--  Vergleich, dessen Ergebnis von vornherein feststeht, zeigt nichts.
--
--  Median plus eins ergibt hier 4: sichtbar ueber der Marke, also ein
--  guter Monat, aber deutlich unter dem Bestwert, also mit Luft nach
--  oben. Die Zahl wird BERECHNET, nicht eingetragen - waechst Claras
--  Bestand, waechst das Ziel mit, ohne dass jemand daran denken muss.
--  Diese Fahrten sind ECHTE neue Zeilen (Start-/
--  Zielstation aus Claras eigenem, bereits benutztem Stationsumfeld,
--  Fahrraeder aus dem allgemeinen, aktuell verfuegbaren Bestand, Preise
--  ueber velocity.fn_ausleihe_abrechnen - dieselbe Preislogik wie eine
--  echte Fahrt, siehe deren Kopfkommentar in 0009_geschaeftslogik.sql
--  und das Vorbild in db/betrieb/referenzdaten_fahrten.sql) und bleiben
--  danach im rollierenden Vorrat erhalten - sie werden NICHT nach dem
--  Lauf wieder geloescht.
--
--  FOLGE FUER DIE STATUSSTUFE, VORAB BENANNT, NICHT VERSTECKT: Claras
--  km_gesamt stand am 06.09.2026 bei 149,4 km (Stufe "Viel unterwegs",
--  Grenze zur naechsten Stufe "Dauerhaft unterwegs" bei 150 km). Die 12
--  neuen Fahrten addieren echte, neue Kilometer - der genaue Wert danach
--  wird in .superpowers/auftraege/demofahrten-job-bericht.md festgehalten,
--  sobald gemessen (nicht vorab geschaetzt). Ein Ueberschreiten der 150-km-
--  Grenze ist praktisch sicher und wird hier ausdruecklich erwartet, kein
--  Fehler. Dieser einmalige Zuwachs ist die einzige Stelle in dieser
--  Datei, an der Claras Gesamtsumme sich dauerhaft aendert - danach
--  rolliert der Bestand nur noch, siehe oben.
--
--  ---------------------------------------------------------------------
--  FOLGE FUER db/tests/t0025_kennzahl_umstellung.sql
--
--  Jene Datei friert flottenweite Summen ein (Zeilenzahlen, Kilometer-
--  und CO2-Summen, Verfahrensverteilung ueber ALLE Kunden). Der einmalige
--  Auffuellschritt legt einige neue, echte Fahrten an - die flottenweiten
--  Summen wachsen dadurch zwangslaeufig, waehrend das reine Verschieben
--  (Rollfunktion) sie nachweislich (s.o.) nicht veraendert. t0025 wird
--  deshalb NACH diesem Lauf neu gemessen und mit einem dritten Nachtrag
--  fortgeschrieben - wie es dort nach der Ausreisser-Korrektur vom
--  05.09.2026 bereits zweimal geschehen ist. Das ist keine zufaellige
--  Testabweichung, sondern eine Folge dieser Datei; siehe den Nachtrag
--  in jener Datei fuer die nachgemessenen Werte.
--
--  ---------------------------------------------------------------------
--  IDEMPOTENZ
--
--  create extension if not exists / grant / create or replace function /
--  revoke / cron.schedule_in_database (upsert ueber (jobname, username),
--  nachgemessen: ein zweiter Aufruf mit demselben jobname ersetzt Zeitplan
--  und Befehl der bestehenden Zeile, legt keine zweite an) sind fuer sich
--  wiederholbar. Der Ausfuehrungsblock ist es ueber zwei Wächter: die
--  Rollfunktion tut nichts, wenn der laufende Monat fuer K-000001 schon
--  eine Fahrt traegt; der Auffuellschritt fuellt auf das berechnete Ziel
--  auf, raeumt einen Ueberhang darueber ab und tut nichts, wenn der
--  Monat genau auf dem Ziel steht. Ein zweiter Lauf
--  dieser Datei im selben Kalendermonat aendert deshalb nichts mehr.
--
--  Aufruf (braucht supabase_admin, siehe oben):
--    ssh bot.butscher.cloud \
--      "docker exec -i supabase-db psql -U supabase_admin -d postgres" \
--      < db/betrieb/demofahrten_rollieren.sql
-- =====================================================================

-- ---------------------------------------------------------------------
-- Scheduler einrichten (braucht supabase_admin, s.o.)
-- ---------------------------------------------------------------------
create extension if not exists pg_cron;

-- Ohne dieses GRANT sieht/verwaltet nur der anlegende Superuser den Job
-- (schema cron traegt keine automatische PUBLIC-Berechtigung). Mit dem
-- GRANT kann die Rolle postgres - der normale Verbindungsweg dieses
-- Projekts, siehe db/run.py - den Job spaeter selbst einsehen und
-- abbestellen, siehe cron.schedule_in_database(..., username =>
-- 'postgres') weiter unten.
grant usage on schema cron to postgres;

-- ---------------------------------------------------------------------
-- Rollfunktion. Ruehrt ausschliesslich velocity.ausleihe an, und darin
-- ausschliesslich Zeilen von K-000001 (Bedingung kunde_id = v_kunde_id
-- in jeder Abfrage). Sie ist der einzige Code, den sowohl der Cron-Job
-- als auch der einmalige Sofort-Auffuellschritt unten aufrufen - eine
-- einzige Stelle, die "aeltesten unabgerechneten Monat verschieben"
-- bedeutet, nicht zwei getrennte, potenziell auseinanderlaufende
-- Fassungen.
-- ---------------------------------------------------------------------
create or replace function velocity.fn_demofahrten_rollieren()
returns void
language plpgsql
set search_path = velocity, pg_temp
as $$
declare
  c_kundennummer constant text        := 'K-000001';
  v_kunde_id     bigint;
  v_monat_neu    timestamptz          := date_trunc('month', now());
  v_fenster_bis  timestamptz;
  v_hat_laufend  boolean;
  v_alt_monat    timestamptz;
  v_anteil       numeric;
  v_neu_start    timestamptz;
  v_neu_ende     timestamptz;
  v_gezaehlt     integer := 0;
  v_uebersprungen integer := 0;
  v_dauer        interval;
  v_r            record;
begin
  select kunde_id into v_kunde_id from velocity.kunde where kundennummer = c_kundennummer;
  if v_kunde_id is null then
    raise notice 'fn_demofahrten_rollieren: Kundennummer % nicht gefunden - nichts zu tun',
      c_kundennummer;
    return;
  end if;

  -- Waechter 1: nur rollen, wenn der laufende Monat fuer diesen Kunden
  -- noch KEINE abgeschlossene Fahrt traegt. Macht die Funktion
  -- idempotent innerhalb desselben Kalendermonats.
  select exists(
    select 1 from velocity.ausleihe
     where kunde_id = v_kunde_id and status = 'abgeschlossen'
       and date_trunc('month', startzeit) = v_monat_neu
  ) into v_hat_laufend;

  if v_hat_laufend then
    raise notice 'fn_demofahrten_rollieren: % hat im laufenden Monat (%) bereits Fahrten - nichts geaendert',
      c_kundennummer, to_char(v_monat_neu, 'YYYY-MM');
    return;
  end if;

  -- Aeltesten Monat waehlen, der (a) nicht der laufende Monat ist und
  -- (b) KEINE seiner Fahrten bereits in einer Rechnung steht (siehe
  -- Kopfkommentar, Abschnitt 1). "not exists" ist je Zeile ausgewertet,
  -- nicht je Monat - traegt ein Monat eine einzelne, spaeter doch
  -- abgerechnete Fahrt neben unabgerechneten, wuerden nur die
  -- unabgerechneten gefunden. Nach heutigem Datenstand ist jeder Monat
  -- vollstaendig das eine oder das andere (nachgemessen 06.09.2026),
  -- diese Formulierung verlaesst sich aber nicht darauf.
  select date_trunc('month', a.startzeit) into v_alt_monat
    from velocity.ausleihe a
   where a.kunde_id = v_kunde_id
     and a.status = 'abgeschlossen'
     and date_trunc('month', a.startzeit) <> v_monat_neu
     and not exists (
       select 1 from velocity.rechnungsposition rp
        where rp.ausleihe_id = a.ausleihe_id
     )
   group by 1
   order by 1
   limit 1;

  if v_alt_monat is null then
    raise notice 'fn_demofahrten_rollieren: kein unabgerechneter Altmonat fuer % verfuegbar - '
                 'laufender Monat (%) bleibt leer, bitte pruefen',
      c_kundennummer, to_char(v_monat_neu, 'YYYY-MM');
    return;
  end if;

  -- Sicheres Zielfenster: nie vor Monatsbeginn, nie naeher an "jetzt"
  -- heran als zwei Stunden (Puffer fuer die eigene Fahrtdauer, damit
  -- auch endzeit sicher in der Vergangenheit liegt), nie ueber das Ende
  -- des laufenden Monats hinaus.
  v_fenster_bis := greatest(v_monat_neu,
                     least(now() - interval '2 hours',
                           v_monat_neu + interval '1 month' - interval '1 second'));

  for v_r in
    select a.ausleihe_id, a.startzeit, a.endzeit
      from velocity.ausleihe a
     where a.kunde_id = v_kunde_id
       and a.status = 'abgeschlossen'
       and date_trunc('month', a.startzeit) = v_alt_monat
       and not exists (
         select 1 from velocity.rechnungsposition rp
          where rp.ausleihe_id = a.ausleihe_id
       )
     order by a.startzeit
     for update of a
  loop
    -- Anteilige Lage der Fahrt im alten Monat (0 = Monatsanfang, nahe 1
    -- = Monatsende), dieselbe Lage auf das sichere Zielfenster des neuen
    -- Monats uebertragen. So bleibt die Reihenfolge mehrerer Fahrten
    -- desselben Altmonats erhalten, und keine landet ausserhalb des
    -- erlaubten Fensters.
    --
    -- Nenner ist die TATSAECHLICHE Laenge von v_alt_monat (28 bis 31
    -- Tage), nicht extract(epoch from interval '1 month') - Postgres
    -- rechnet dort intern pauschal mit 30 Tagen (nachgemessen), was bei
    -- einem 31-Tage-Monat einen Anteil > 1 und damit einen Zielzeitpunkt
    -- ausserhalb des sicheren Fensters erzeugen koennte.
    v_anteil := extract(epoch from (v_r.startzeit - v_alt_monat))
              / extract(epoch from ((v_alt_monat + interval '1 month') - v_alt_monat));
    v_dauer := v_r.endzeit - v_r.startzeit;

    /* ---- DER DECKEL AUF DIE ENDZEIT (ergaenzt 06.09.2026) -----------

       Hier stand nur die Zeile mit v_anteil, und die Endzeit ergab sich
       ungeprueft daraus. Getragen hat das allein der feste Puffer von
       zwei Stunden in v_fenster_bis - eine Konstante gegen eine
       Fahrtdauer, die keine Obergrenze hat. Eine Fahrt von mehr als zwei
       Stunden am Fensterende haette eine Endzeit in der ZUKUNFT bekommen,
       und genau die nennt der Kopf dieser Datei einen "sofort sichtbaren
       Widerspruch".

       Heute greift der Fall nicht: Claras laengste unabgerechnete Fahrt
       dauert 57 Minuten (nachgemessen am 06.09.2026). Der Job laeuft aber
       unbeaufsichtigt weiter, und der Auffuellschritt derselben Datei
       deckelt laengst - er rechnet "v_fenster_bis - dauer". Diese
       Ungleichbehandlung war der eigentliche Befund.

       Der Deckel zieht den START so weit vor, dass das ENDE spaetestens
       auf v_fenster_bis faellt. greatest() haelt ihn zugleich hinter dem
       Monatsanfang - eine Fahrt darf nicht in den Vormonat rutschen. */
    v_neu_start := least(v_monat_neu + v_anteil * (v_fenster_bis - v_monat_neu),
                         v_fenster_bis - v_dauer);
    v_neu_start := greatest(v_neu_start, v_monat_neu);

    /* Passt eine Fahrt selbst dann nicht, ist sie laenger als das ganze
       Fenster. Dann bleibt sie, wo sie ist. Sie zu verschieben hiesse,
       die Zukunft zu erzeugen; sie stillschweigend zu kappen hiesse, die
       Dauer zu faelschen und damit auch die daraus geschaetzten
       Kilometer. Beides waere schlimmer als eine Fahrt, die im Altmonat
       stehen bleibt - und die Notiz unten sagt es. */
    if v_neu_start + v_dauer > v_fenster_bis then
      v_uebersprungen := v_uebersprungen + 1;
      continue;
    end if;

    -- endzeit um GENAU dasselbe Intervall verschieben wie startzeit -
    -- nicht neu berechnen. Das haelt dauer_minuten (generated column)
    -- und damit jede dauerbasierte Kilometerschaetzung unveraendert,
    -- siehe Kopfkommentar.
    v_neu_ende := v_neu_start + v_dauer;

    update velocity.ausleihe
       set startzeit = v_neu_start, endzeit = v_neu_ende
     where ausleihe_id = v_r.ausleihe_id;
    v_gezaehlt := v_gezaehlt + 1;
  end loop;

  raise notice 'fn_demofahrten_rollieren: % - % Fahrt(en) aus % in den laufenden Monat (%) verschoben',
    c_kundennummer, v_gezaehlt, to_char(v_alt_monat, 'YYYY-MM'), to_char(v_monat_neu, 'YYYY-MM');
  if v_uebersprungen > 0 then
    raise notice 'fn_demofahrten_rollieren: % Fahrt(en) blieben stehen - laenger als das '
                 'Zeitfenster bis %. Sie zu verschieben haette eine Endzeit in der Zukunft '
                 'erzeugt.', v_uebersprungen, to_char(v_fenster_bis, 'YYYY-MM-DD HH24:MI');
  end if;
end;
$$;

-- PostgreSQL vergibt EXECUTE auf neu angelegte Funktionen automatisch an
-- PUBLIC (0011_sicherheit.sql, Kopfkommentar dort). Diese Funktion muss
-- daher gesperrt werden, damit db/tests/t0011_sicherheit.sql
-- (test_s_keine_oeffentliche_funktion) auch sie als nicht oeffentlich
-- ausfuehrbar bestaetigt.
--
-- NUR DIESE EINE FUNKTION, NICHT "all functions" (berichtigt 06.09.2026).
-- Hier stand zuvor die Pauschalzeile aus 0011_sicherheit.sql, mit dem
-- Zusatz, fuer bereits gesperrte Funktionen sei sie "ein wirkungsloses,
-- sicheres Wiederholen". Das ist falsch, und der Schaden war sofort
-- sichtbar: "revoke all on all functions ... from authenticated" nimmt
-- eben nicht nur das Standardrecht von PUBLIC, sondern auch jedes
-- AUSDRUECKLICH vergebene Recht dieser Rolle. In 0011_sicherheit.sql
-- steht die Zeile deshalb VOR einem Block, der neun Rechte wieder
-- vergibt (dort Zeile 205 ff., dazu 0019, 0021, 0023) - dieser Block
-- fehlte hier. Ergebnis nach dem ersten Lauf: das persoenliche
-- Dashboard auf bikes.butscher.cloud meldete "permission denied for
-- function fn_luftlinie_km", und api_kunde_sicherstellen war fuer jeden
-- angemeldeten Besucher gesperrt.
--
-- Wiederhergestellt wird der Sollzustand mit tools/rechte_setzen.py;
-- gefunden hat die Luecke tools/grants_pruefen.py, nachdem es an
-- demselben Tag von "nur 0011" auf alle Aufbaudateien erweitert wurde.
revoke all on function velocity.fn_demofahrten_rollieren()
  from public, anon, authenticated;

-- UND SOFORT WIEDER AN postgres (ergaenzt 06.09.2026).
--
-- Der Cron-Eintrag unten laeuft unter der Rolle postgres
-- (cron.schedule_in_database(..., 'postgres', 'postgres')). Diese Rolle
-- hat in dieser Datenbank rolsuper = false und bezog ihr
-- Ausfuehrungsrecht ausschliesslich ueber PUBLIC - der revoke daueber
-- nimmt es ihr also mit. Ergebnis ohne diese Zeile: der Job liefe jeden
-- Monatsersten an und bräche jedes Mal mit "permission denied for
-- function fn_demofahrten_rollieren" ab, ohne dass irgendwo etwas
-- auffiele. Nachgemessen, nicht vermutet: der Aufruf als postgres schlug
-- am 06.09.2026 genau so fehl.
--
-- Der Eigentuemer ist supabase_admin (unter dieser Rolle laeuft die
-- Datei), deshalb kann nur sie diesen grant vergeben - postgres selbst
-- kann sich das Recht nicht geben.
grant execute on function velocity.fn_demofahrten_rollieren() to postgres;

-- Monatlich, 1. Kalendertag, 22:30 UTC - Begruendung der Uhrzeit siehe
-- Kopfkommentar Punkt 3. username => 'postgres' statt der anlegenden
-- Rolle supabase_admin - Begruendung siehe Kopfkommentar. Upsert-Semantik
-- ueber (jobname, username) nachgemessen: wiederholbar.
select cron.schedule_in_database(
  'demofahrten_rollieren',
  '30 22 1 * *',
  $cron$select velocity.fn_demofahrten_rollieren();$cron$,
  'postgres',
  'postgres'
);

-- =======================================================================
-- Sofort-Auffuellschritt: heutigen Rolllauf ausloesen und den laufenden
-- Monat auf den eigenen Median plus eins auffuellen. Siehe Kopfkommentar,
-- Abschnitt "SOFORTBEDARF".
-- =======================================================================
do $$
declare
  c_kundennummer constant text    := 'K-000001';
  v_ziel         integer;         -- berechnet, siehe unten
  v_kunde_id     bigint;
  v_monat_neu    timestamptz := date_trunc('month', now());
  v_fenster_bis  timestamptz;
  v_mitgl_id     bigint;
  v_vorhandene   integer;
  v_fehlt        integer;
  v_zuviel       integer;
  v_km_entfernt  numeric := 0;
  v_vor_max_id   bigint;
  v_neu_min_id   bigint;
  v_neu_max_id   bigint;
  v_neu_id       bigint;
  v_km_neu       numeric;
  -- Gegenprobe: alles ausserhalb von K-000001 muss unveraendert bleiben
  v_vorher_ausl_andere  bigint;
  v_vorher_max_andere   timestamptz;
  v_vorher_ep_andere    bigint;
  v_vorher_rg_zeilen    bigint;
  v_vorher_rgp_zeilen   bigint;
  v_nachher_ausl_andere bigint;
  v_nachher_max_andere  timestamptz;
  v_nachher_ep_andere   bigint;
  v_nachher_rg_zeilen   bigint;
  v_nachher_rgp_zeilen  bigint;
  -- Claras eigene Werte, vorher/nachher, fuer den Bericht
  v_km_vorher     numeric;
  v_fahrten_vorher integer;
  v_km_nachher    numeric;
  v_fahrten_nachher integer;
begin
  select kunde_id into v_kunde_id from velocity.kunde where kundennummer = c_kundennummer;
  if v_kunde_id is null then
    raise exception 'Kundensatz % nicht gefunden - Datei bricht ab', c_kundennummer;
  end if;

  -- ---- Momentaufnahme VOR jeder Aenderung, fuer die Gegenprobe und
  --      den Bericht -------------------------------------------------
  select count(*), max(geaendert_am) into v_vorher_ausl_andere, v_vorher_max_andere
    from velocity.ausleihe where kunde_id <> v_kunde_id;
  select count(*) into v_vorher_ep_andere
    from velocity.entgeltposition ep
    join velocity.ausleihe a on a.ausleihe_id = ep.ausleihe_id
   where a.kunde_id <> v_kunde_id;
  select count(*) into v_vorher_rg_zeilen  from velocity.rechnung;
  select count(*) into v_vorher_rgp_zeilen from velocity.rechnungsposition;

  select round(sum(fk.km), 1), count(*) into v_km_vorher, v_fahrten_vorher
    from velocity.v_fahrt_kennzahl fk where fk.kunde_id = v_kunde_id;

  select coalesce(max(ausleihe_id), 0) into v_vor_max_id from velocity.ausleihe;

  -- ---- Schritt 1: die normale Rollfunktion einmal ausloesen, wie es
  --      der Cron-Termin monatlich ebenfalls tut -----------------------
  perform velocity.fn_demofahrten_rollieren();

  -- ---- Schritt 2: falls danach immer noch unter 10 Fahrten, auf das
  --      Ziel auffuellen (echte neue Fahrten, siehe Kopfkommentar) -----
  select count(*) into v_vorhandene
    from velocity.ausleihe
   where kunde_id = v_kunde_id and status = 'abgeschlossen'
     and date_trunc('month', startzeit) = v_monat_neu;

  -- Ziel aus den EIGENEN Vormonaten, nicht aus einer eingetragenen Zahl.
  -- percentile_cont liefert double precision, deshalb der Cast vor ::int
  -- (round(double precision, integer) kennt PostgreSQL nicht - derselbe
  -- Fallstrick wie in 0025_kundenkennzahlen.sql). Ohne Vormonate bleibt
  -- coalesce bei 0, das Ziel also bei 1: eine Fahrt ist immer noch
  -- besser als ein leerer Block.
  select coalesce(percentile_cont(0.5) within group (order by s.n), 0)::numeric::int + 1
    into v_ziel
    from (select count(*) as n
            from velocity.ausleihe
           where kunde_id = v_kunde_id and status = 'abgeschlossen'
             and date_trunc('month', startzeit) <> v_monat_neu
           group by date_trunc('month', startzeit)) s;

  if v_vorhandene < v_ziel then
    v_fehlt := v_ziel - v_vorhandene;

    v_fenster_bis := greatest(v_monat_neu,
                       least(now() - interval '2 hours',
                             v_monat_neu + interval '1 month' - interval '1 second'));

    select m.mitgliedschaft_id into v_mitgl_id
      from velocity.mitgliedschaft m
     where m.kunde_id = v_kunde_id and m.gueltigkeit @> v_monat_neu::date;

    -- Vorrat an 14 handverlesenen Fahrten (Bike/Stationen/Uhrzeit/Dauer/
    -- Distanz), damit auch ein kuenftiger Wiederholungslauf mit anderem
    -- v_fehlt (0 bis 14) genug Auswahl hat. Stationen und Fahrraeder
    -- stammen aus Claras eigenem, bereits benutztem Umfeld (10 Stationen,
    -- 14 Raeder, Stand 06.09.2026 alle 'verfuegbar', keins davon eines,
    -- das sie bereits gefahren hat - echtes Bikesharing verwendet ohnehin
    -- selten zweimal dasselbe Rad). tagoffset 0-4 haelt jede Fahrt
    -- sicher innerhalb der ersten fuenf Kalendertage des laufenden
    -- Monats - weit vor "heute", unabhaengig von der Uhrzeit des Laufs.
    -- minute_of_day statt time-Literal: vermeidet die Frage, ob
    -- timestamptz + time definiert ist (ist es in PostgreSQL nicht direkt
    -- - nachgemessen vor dem Schreiben dieser Datei), indem konsequent
    -- mit interval gerechnet wird.
    with vorrat(seq, fahrrad_id, tagoffset, minute_of_day, dauer_min,
                start_station_id, end_station_id, distanz_km) as (
      values
        ( 1, 290::bigint, 0, 455,  22, 31::bigint, 30::bigint,  3.10::numeric),
        ( 2, 496::bigint, 0, 1070, 14, 34::bigint, 32::bigint,  2.05::numeric),
        ( 3, 293::bigint, 1, 485,  45, 30::bigint, 37::bigint,  null::numeric),
        ( 4, 305::bigint, 1, 1100, 19, 38::bigint, 34::bigint,  2.85::numeric),
        ( 5, 329::bigint, 2, 442,  31, 33::bigint, 39::bigint,  4.40::numeric),
        ( 6, 435::bigint, 2, 760,  12, 34::bigint, 32::bigint,  1.75::numeric),
        ( 7, 346::bigint, 2, 1145, 27, 39::bigint, 41::bigint,  null::numeric),
        ( 8, 368::bigint, 3, 468,  38, 31::bigint, 38::bigint,  5.60::numeric),
        ( 9, 389::bigint, 3, 1035, 21, 37::bigint, 30::bigint,  3.35::numeric),
        (10, 406::bigint, 4, 492,  16, 32::bigint, 34::bigint,  2.20::numeric),
        (11, 484::bigint, 4, 1127, 24, 41::bigint, 33::bigint,  null::numeric),
        (12, 599::bigint, 0, 725,  33, 35::bigint, 39::bigint,  4.85::numeric),
        (13, 602::bigint, 1, 1215, 18, 30::bigint, 34::bigint,  null::numeric),
        (14, 527::bigint, 3, 770,  26, 39::bigint, 32::bigint,  3.70::numeric)
    ),
    gewaehlt as (
      select *,
             least(
               v_monat_neu + tagoffset * interval '1 day' + minute_of_day * interval '1 minute',
               v_fenster_bis - dauer_min * interval '1 minute'
             ) as start_ts
        from vorrat
       where seq <= v_fehlt
    )
    insert into velocity.ausleihe
      (kunde_id, fahrrad_id, mitgliedschaft_id, start_station_id, startzeit,
       end_station_id, endzeit, status, distanz_km)
    select v_kunde_id, g.fahrrad_id, v_mitgl_id, g.start_station_id, g.start_ts,
           g.end_station_id, g.start_ts + g.dauer_min * interval '1 minute',
           'abgeschlossen', g.distanz_km
      from gewaehlt g;

    select min(ausleihe_id), max(ausleihe_id) into v_neu_min_id, v_neu_max_id
      from velocity.ausleihe where ausleihe_id > v_vor_max_id;

    -- Abrechnen wie eine echte Fahrt (velocity.fn_ausleihe_abrechnen), in
    -- zeitlicher Reihenfolge - Vorbild db/betrieb/referenzdaten_fahrten.sql,
    -- dort aus demselben Grund (Freiminuten-Verbrauch) als Schleife
    -- geschrieben, nicht als "perform ... from ... order by".
    for v_neu_id in
      select ausleihe_id from velocity.ausleihe
       where ausleihe_id > v_vor_max_id
       order by startzeit
    loop
      perform velocity.fn_ausleihe_abrechnen(v_neu_id);
    end loop;

    raise notice 'Sofort-Auffuellschritt: % neue Fahrt(en) fuer % im laufenden Monat (%) angelegt',
      v_fehlt, c_kundennummer, to_char(v_monat_neu, 'YYYY-MM');
  elsif v_vorhandene > v_ziel then
    /* ---- Schritt 3: UEBERHANG ABRAEUMEN --------------------------------

       Der Auffuellschritt kann auch zu viel vorfinden. Genau das war am
       06.09.2026 der Fall: der erste Lauf dieser Datei arbeitete noch mit
       dem festen Ziel 13 und legte zwoelf Fahrten an, obwohl Claras
       Median bei drei liegt. Ohne diesen Zweig bliebe der Ueberhang fuer
       immer stehen - der Auffuellschritt haette nichts zu tun und
       schwiege, waehrend "Dieser Monat" weiter am Anschlag stuende.

       VIER SCHRANKEN, und jede einzelne ist noetig:
         - nur K-000001, der erfundene Demokunde dieser Datei,
         - nur der laufende Monat,
         - nur UNABGERECHNETE Fahrten. Eine Fahrt auf einer Rechnung zu
           loeschen hiesse, eine Rechnungssumme zu faelschen.
         - und nur die JUENGSTEN. offset v_ziel ueber "order by
           ausleihe_id" laesst die aeltesten stehen - darunter die aus
           einem Altmonat herbeigerollte Fahrt, die echte Geschichte
           traegt. Weg kommen nur die zuletzt erzeugten.

       Die Entgeltpositionen muessen zuerst weg (Fremdschluessel auf
       ausleihe). Rechnung und Rechnungsposition bleiben unberuehrt -
       genau das sichert die dritte Schranke. */
    -- Kilometer der zu entfernenden Fahrten VORHER merken - nach dem
    -- delete sind sie aus v_fahrt_kennzahl verschwunden, und die
    -- Schlussgegenprobe unten braucht sie, um die Differenz zu erklaeren.
    select coalesce(round(sum(fk.km), 1), 0) into v_km_entfernt
      from velocity.v_fahrt_kennzahl fk
     where fk.ausleihe_id in (
       select a.ausleihe_id
         from velocity.ausleihe a
        where a.kunde_id = v_kunde_id
          and a.status = 'abgeschlossen'
          and date_trunc('month', a.startzeit) = v_monat_neu
          and not exists (select 1 from velocity.rechnungsposition rp
                           where rp.ausleihe_id = a.ausleihe_id)
        order by a.ausleihe_id
       offset v_ziel);

    with ueberhang as (
      select a.ausleihe_id
        from velocity.ausleihe a
       where a.kunde_id = v_kunde_id
         and a.status = 'abgeschlossen'
         and date_trunc('month', a.startzeit) = v_monat_neu
         and not exists (select 1 from velocity.rechnungsposition rp
                          where rp.ausleihe_id = a.ausleihe_id)
       order by a.ausleihe_id
      offset v_ziel
    ), weg_ep as (
      delete from velocity.entgeltposition
       where ausleihe_id in (select ausleihe_id from ueberhang)
      returning 1
    )
    delete from velocity.ausleihe
     where ausleihe_id in (select ausleihe_id from ueberhang);
    get diagnostics v_zuviel = row_count;

    -- Gegenprobe: steht der Monat danach wirklich auf dem Ziel? Wenn
    -- nicht, war eine der Schranken im Weg (etwa lauter abgerechnete
    -- Fahrten) - dann bricht der Block ab, statt still danebenzuliegen.
    select count(*) into v_vorhandene
      from velocity.ausleihe
     where kunde_id = v_kunde_id and status = 'abgeschlossen'
       and date_trunc('month', startzeit) = v_monat_neu;
    if v_vorhandene <> v_ziel then
      raise exception 'Ueberhang abgeraeumt, laufender Monat steht aber auf % statt %',
        v_vorhandene, v_ziel;
    end if;

    raise notice 'Ueberhang abgeraeumt: % Fahrt(en) entfernt, laufender Monat (%) steht auf % (Ziel %)',
      v_zuviel, to_char(v_monat_neu, 'YYYY-MM'), v_vorhandene, v_ziel;
  else
    raise notice 'Auffuellschritt uebersprungen: laufender Monat hat % Fahrten, genau das Ziel',
      v_vorhandene;
  end if;

  -- ---- Gegenprobe -----------------------------------------------------
  select count(*), max(geaendert_am) into v_nachher_ausl_andere, v_nachher_max_andere
    from velocity.ausleihe where kunde_id <> v_kunde_id;
  select count(*) into v_nachher_ep_andere
    from velocity.entgeltposition ep
    join velocity.ausleihe a on a.ausleihe_id = ep.ausleihe_id
   where a.kunde_id <> v_kunde_id;
  select count(*) into v_nachher_rg_zeilen  from velocity.rechnung;
  select count(*) into v_nachher_rgp_zeilen from velocity.rechnungsposition;

  if v_vorher_ausl_andere <> v_nachher_ausl_andere
     or v_vorher_max_andere is distinct from v_nachher_max_andere then
    raise exception 'Gegenprobe fehlgeschlagen: ausleihe-Zeilen ausserhalb von % veraendert '
                     '(vorher % Zeilen/geaendert_am %, nachher % Zeilen/geaendert_am %)',
      c_kundennummer, v_vorher_ausl_andere, v_vorher_max_andere,
      v_nachher_ausl_andere, v_nachher_max_andere;
  end if;

  if v_vorher_ep_andere <> v_nachher_ep_andere then
    raise exception 'Gegenprobe fehlgeschlagen: entgeltposition-Zeilen ausserhalb von % veraendert '
                     '(vorher %, nachher %)',
      c_kundennummer, v_vorher_ep_andere, v_nachher_ep_andere;
  end if;

  if v_vorher_rg_zeilen <> v_nachher_rg_zeilen or v_vorher_rgp_zeilen <> v_nachher_rgp_zeilen then
    raise exception 'Gegenprobe fehlgeschlagen: rechnung/rechnungsposition wurden angefasst '
                     '(rechnung % -> %, rechnungsposition % -> %) - diese Datei darf beide Tabellen '
                     'nicht schreiben, siehe Kopfkommentar Abschnitt 1',
      v_vorher_rg_zeilen, v_nachher_rg_zeilen, v_vorher_rgp_zeilen, v_nachher_rgp_zeilen;
  end if;

  -- GEGEN DAS BERECHNETE ZIEL, NICHT MEHR GEGEN 10-15 (berichtigt
  -- 06.09.2026). Hier stand "< 10 or > 15" aus der alten festen Vorgabe.
  -- Beim Umstellen auf den Median habe ich die Auffuell-Logik und die
  -- Kopfkommentare nachgezogen, DIESE Zeile aber uebersehen - mit der
  -- Folge, dass der Block sauber durchlief, den Ueberhang korrekt auf 4
  -- abraeumte und dann an der eigenen Schlusspruefung scheiterte:
  -- "laufender Monat hat 4 Fahrten, ausserhalb 10-15". Die Ausnahme
  -- rollte alles zurueck, und ein Lauf der Datei sah nach aussen aus,
  -- als haette er nichts getan. Genau die Sorte Fehler, gegen die dieses
  -- Projekt tools/objektlisten_pruefen.py und tools/grants_pruefen.py
  -- hat: eine von Hand gefuehrte Zahl, die neben ihrer Quelle
  -- weiterlebt.
  select count(*) into v_vorhandene
    from velocity.ausleihe
   where kunde_id = v_kunde_id and status = 'abgeschlossen'
     and date_trunc('month', startzeit) = v_monat_neu;
  if v_vorhandene <> v_ziel then
    raise exception 'Gegenprobe fehlgeschlagen: laufender Monat hat % Fahrten, Ziel war %',
      v_vorhandene, v_ziel;
  end if;

  select round(sum(fk.km), 1), count(*) into v_km_nachher, v_fahrten_nachher
    from velocity.v_fahrt_kennzahl fk where fk.kunde_id = v_kunde_id;

  -- Angelegte MINUS entfernte Fahrten muessen die gesamte Differenz
  -- erklaeren - das reine Verschieben darf keinen einzigen Kilometer
  -- beitragen.
  --
  -- Der Abzug ist seit dem 06.09.2026 dabei. Vorher stand hier nur der
  -- Zuwachs, weil dieser Block nur Fahrten anlegen konnte. Seit er auch
  -- einen Ueberhang abraeumt, ist die Differenz negativ, und die
  -- Gegenprobe schlug mit "km-Zuwachs (-27.3) entspricht nicht der
  -- Summe der neu angelegten Fahrten (0)" an - richtig gemeldet,
  -- gemessen an ihrer eigenen, inzwischen unvollstaendigen Annahme.
  select coalesce(round(sum(fk.km), 1), 0) into v_km_neu
    from velocity.v_fahrt_kennzahl fk
   where fk.kunde_id = v_kunde_id
     and v_neu_min_id is not null and fk.ausleihe_id between v_neu_min_id and v_neu_max_id;

  -- TOLERANZ 0,2, KEIN EXAKTER VERGLEICH. In dieser Zeile stehen VIER
  -- unabhaengig auf eine Stelle gerundete Summen (vorher, nachher,
  -- angelegt, entfernt). Jede kann um bis zu 0,05 danebenliegen, in
  -- Summe also 0,2 - genau das ist hier aufgetreten: -27,3 gegen -27,4.
  -- Ein ECHTER Fehler waere um Groessenordnungen groesser, denn die
  -- kleinste Einheit, die hier verschwinden oder entstehen kann, ist
  -- eine ganze Fahrt mit mehreren Kilometern. Die Schranke unterscheidet
  -- also weiterhin, was sie unterscheiden soll.
  if abs((v_km_nachher - v_km_vorher) - (v_km_neu - v_km_entfernt)) > 0.2 then
    raise exception 'Gegenprobe fehlgeschlagen: km-Differenz (%) entspricht nicht '
                     'angelegt minus entfernt (% - %) - das reine Verschieben duerfte '
                     'keine Kilometer beitragen',
      round(v_km_nachher - v_km_vorher, 1), v_km_neu, v_km_entfernt;
  end if;

  raise notice 'Clara Fake (K-000001) vorher: % Fahrten, % km. Nachher: % Fahrten, % km.',
    v_fahrten_vorher, v_km_vorher, v_fahrten_nachher, v_km_nachher;
end;
$$;

-- ---- Rücknahme -------------------------------------------------------
-- Scheduler und Funktion sind sauber entfernbar:
--
-- select cron.unschedule('demofahrten_rollieren');
-- drop function if exists velocity.fn_demofahrten_rollieren();
-- revoke usage on schema cron from postgres;
--
-- Die bereits VERSCHOBENEN und NEU ANGELEGTEN Fahrten von K-000001 sind
-- es nicht auf demselben Weg - eine verschobene Fahrt traegt ihre
-- urspruengliche Zeit nirgends mehr, und eine geloeschte neue Fahrt
-- risse ihre bereits erzeugten entgeltposition-Zeilen mit (on delete
-- cascade). Wer den Stand vor diesem Lauf braucht, spielt den Abzug
-- zurueck, der vor diesem Lauf gezogen wurde (tools/velocity_sichern.sh,
-- siehe .superpowers/auftraege/demofahrten-job-bericht.md fuer den
-- Dateinamen) - ueber tools/velocity_zuruecksetzen.sh, wie in
-- kundenmails_anonymisieren.sql fuer den entsprechenden Fall bereits
-- vorgemerkt.
