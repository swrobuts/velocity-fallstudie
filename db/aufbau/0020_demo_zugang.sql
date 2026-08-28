-- =====================================================================
-- 0020 Demozugang (nur lesend)
--
-- Zweck:      Ein auf der Anmeldeseite oeffentlich genannter Zugang
--             ("demo"/"demo") fuer Vorfuehrungen dieser Fallstudie -
--             ausdruecklich OHNE Schreibrecht. Woertlicher Auftrag: "der
--             Demo-Nutzer kann nur Daten lesen ... aber er darf nicht
--             den Bestand refreshen." Die Schranke sitzt in der
--             Datenbank, nicht in der Oberflaeche (PostgREST ist offen
--             erreichbar - ein ausgeblendeter Knopf haelt niemanden auf,
--             der die REST-Schnittstelle direkt anspricht).
--
-- Loesung:    Eine fuenfte Rolle 'demo' in velocity.rolle, KEINE
--             Fachrolle (die vier bleiben disposition/werkstatt/
--             kundenservice/leitung, siehe 0014_bereich_j_personal.sql).
--             ERSTE RUNDE: sie wurde in 13 der 15 fuer authenticated
--             freigegebenen v_wawi_-Sichten zusaetzlich zu deren
--             jeweiligen Fachrollen zugelassen, mit zwei begruendeten
--             Ausnahmen - v_wawi_kunde (Name, E-Mail, Telefon und
--             Anschrift von ueber 1000 Personen, aus Vorsicht gesperrt)
--             und v_wawi_km_co2 (strukturell wirkungslos, weil sie damals
--             FROM v_wawi_fahrt_km las, deren eigene WHERE-Klausel
--             unveraendert nur 'leitung' zulaesst).
--
--             ZWEITE RUNDE (Demozugang-Pruefung): beide Ausnahmen sind
--             aufgehoben, ALLE 15 Sichten lassen 'demo' jetzt zu (siehe
--             die einzelnen "create or replace view"-Anweisungen in
--             0018_wawi_sichten.sql, jede mit einem eigenen Kommentar an
--             ihrer View). v_wawi_kunde: der Auftraggeber hat das
--             ausdruecklich entschieden ("Er sollte aber auch die Kunden
--             sehen, das sind Musterdaten") - die 1014 Kundensaetze sind
--             vollstaendig erfunden, keine echten Personen, und diese
--             Entscheidung gehoert ihm, nicht einer vorab getroffenen
--             Vorsichtsregel. v_wawi_km_co2: entkoppelt von
--             v_wawi_fahrt_km (liest seither wie
--             v_wawi_fahrten_je_tag_rad direkt aus velocity.ausleihe, mit
--             einer eigenen, unabhaengigen Rollenschranke) - dieselbe
--             Kennzahl bleibt eine Monatsaggregation ohne Personenbezug,
--             nur der technische Umweg ueber die Bewegungsprofil-Sicht
--             entfaellt. v_wawi_fahrt_km SELBST bleibt unveraendert
--             gesperrt (weder fuer 'demo' noch ueberhaupt fuer
--             authenticated freigegeben): sie fuehrt kunde_id und
--             startzeit je Einzelfahrt, das bleibt ein Bewegungsprofil,
--             unabhaengig davon, wer sonst noch 'demo' sehen darf.
--
--             SCHREIBEN: keine der vierzehn Mitarbeiter-api_-Funktionen
--             in 0019_wawi_logik.sql musste fuer diese Aufgabe auch nur
--             angefasst werden. Jede verlangt ueber
--             velocity.fn_rolle_verlangen() NAMENTLICH eine der vier
--             Fachrollen; 'demo' erfuellt keine davon und wird deshalb
--             automatisch mit Fehlercode 42501 abgewiesen (siehe
--             Gegenprobe in t0020_demo_zugang.sql). Das ist der
--             eigentliche Witz dieser Loesung: "lesen ja, schreiben
--             nein" ist keine Sonderregel, die anschliessend synchron
--             gehalten werden muesste, sondern eine Folge davon, dass
--             fn_rolle_verlangen niemals nach "irgendeiner Rolle"
--             fragt, sondern immer nach einer bestimmten.
--
--             AUSNAHME VON DIESEM AUTOMATISMUS: die VIER kundenseitigen
--             api_-Funktionen aus 0009_geschaeftslogik.sql
--             (api_kunde_sicherstellen, api_profil_aktualisieren,
--             api_ausleihe_starten, api_ausleihe_beenden) verlangen
--             keine Mitarbeiterrolle, sondern nur "ist ueberhaupt
--             jemand angemeldet" - fuer jeden gewoehnlichen Mitarbeiter
--             richtig (er darf privat auch Kunde sein), fuer ein
--             OEFFENTLICH BEWORBENES Kennwort ein Scheunentor: wer
--             demo/demo auf bikes.butscher.cloud statt auf
--             wawi.butscher.cloud eingibt, bekommt ueber
--             api_kunde_sicherstellen() beim ersten Aufruf einen echten
--             Kundensatz angelegt, und von da an schreiben auch die
--             anderen drei - eine Ausleihe auf einen erfundenen Kunden,
--             mit echten Ausleihe- und Rechnungszeilen. Diese vier
--             Funktionen tragen deshalb SEIT DIESER AUFGABE selbst eine
--             velocity.hat_rolle('demo')-Schranke als allerersten
--             Schritt (siehe dort in 0009_geschaeftslogik.sql) - nicht
--             hier per CREATE OR REPLACE kopiert, um denselben
--             Funktionskoerper nicht an zwei Stellen zu pflegen. Der
--             Verweis auf velocity.hat_rolle() aus einer Datei, die vor
--             0014/0017 laeuft, ist unschaedlich: eine plpgsql-Funktion
--             wird beim Anlegen nicht gegen die Existenz aufgerufener
--             Funktionen geprueft, nur beim ersten tatsaechlichen
--             Aufruf - und der liegt immer nach einem vollstaendigen
--             Durchlauf von db/aufbau/*.sql.
--
-- Objekte:    Zeile 'demo' in velocity.rolle.
-- Ruecknahme: DELETE FROM velocity.rolle WHERE code = 'demo' (schlaegt
--             fehl, solange ein Mitarbeiter diese Rolle noch traegt -
--             mitarbeiter_rolle_rolle_fk steht auf ON DELETE RESTRICT,
--             siehe 0014_bereich_j_personal.sql); dazu in
--             0018_wawi_sichten.sql jedes
--             "or velocity.hat_rolle('demo')" wieder entfernen und in
--             0009_geschaeftslogik.sql die vier neu ergaenzten Waechter
--             am Anfang von api_kunde_sicherstellen,
--             api_profil_aktualisieren, api_ausleihe_starten und
--             api_ausleihe_beenden.
-- =====================================================================

-- 'demo' ist bewusst NICHT Teil der Vier-Rollen-Liste in
-- 0014_bereich_j_personal.sql ("Die vier Rollen sind aus den Aufgaben
-- abgeleitet"): jene Liste spiegelt die vier GR-Aufgaben, diese Rolle
-- traegt keine einzige davon, nur ein Leserecht quer durch fast alle
-- Sichten. Eigener Insert in eigener Datei, mit eigener Begruendung -
-- kein sechster Wert in einer Liste, deren Kopfkommentar dann nicht
-- mehr stimmte.
insert into velocity.rolle (code, bezeichnung, beschreibung) values
  ('demo', 'Demo', 'Oeffentlicher Vorfuehrzugang (Anmeldeseite) - ausschliesslich lesend, keine Fachrolle')
on conflict (code) do update
  set bezeichnung  = excluded.bezeichnung,
      beschreibung = excluded.beschreibung;

-- ---- Nachweis ----------------------------------------------------------
-- Ohne diese Pruefung faellt ein Tippfehler im Code oben erst auf, wenn
-- irgendwann im Betrieb die Anmeldeseite eine leere Warenwirtschaft
-- zeigt - genau der stille Fehlschlag, den mitarbeiter_pruefkonto.sql
-- schon fuer das Pruefkonto vermeidet.
do $$
begin
  if not exists (select 1 from velocity.rolle where code = 'demo') then
    raise exception 'Rolle demo fehlt nach dieser Datei - Insert oben fehlgeschlagen?';
  end if;
end;
$$;
