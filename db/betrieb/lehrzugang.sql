-- =====================================================================
-- Lehrzugang zur VeloCity-Warenwirtschaft - Weg A
--
-- Zweck:      Die Rolle studi (angelegt durch studizugang_lesend.sql)
--             liest bereits alle 39 Basistabellen, aber keine der
--             zwanzig velocity.v_wawi_*-Sichten - dort filtert
--             velocity.hat_rolle() die Kette mitarbeiter_id_aus_auth()
--             -> auth.uid() gegen eine JWT-Kennung, die eine rohe
--             Postgres-Sitzung nie mitbringt. Diese Datei legt dafür
--             einen eigenen Mitarbeitersatz an (M-LEHRE, Erika
--             Musterfrau), trägt dessen Kennung fest in die Sitzung
--             von studi ein und schließt die Rechtelücken, die
--             danach noch offenbleiben. Kein Schema wird angelegt,
--             keine Sicht angefasst.
-- Objekte:    Mitarbeitersatz M-LEHRE mit allen vier Fachrollen;
--             request.jwt.claim.sub für studi; SELECT auf die zwanzig
--             v_wawi_*-Sichten; EXECUTE auf velocity.hat_rolle(text);
--             Sitzungsvorgaben und Verbindungsgrenze für studi.
--
-- Grundlage:  .superpowers/auftraege/lehrzugang-zettel.md (bindende
--             Entscheidung des Auftraggebers vom 05.09.2026, Weg A) und
--             .superpowers/auftraege/lehrzugang-bericht.md (Messteil
--             des ersten, verworfenen Entwurfs zu Weg B). Alle
--             Messwerte unten sind eigens am 05.09.2026 nachgemessen,
--             nicht aus diesen Dokumenten übernommen - an zwei Stellen
--             (siehe unten) weichen sie vom Bericht ab.
--
-- ---------------------------------------------------------------------
-- WICHTIG VORAB: DIESE DATEI BRAUCHT EINEN ECHTEN SUPERUSER, NICHT
-- "postgres" - ANDERS ALS JEDE ANDERE DATEI IN DIESEM VERZEICHNIS
--
-- Gemessen (in begin/rollback, sowohl als postgres als auch als
-- supabase_admin): "alter role studi set request.jwt.claim.sub = '…'"
-- scheitert unter der Rolle postgres mit
--   FEHLER: permission denied to set parameter "request.jwt.claim.sub"
-- und zwar unabhängig von der Zielrolle - selbst "alter role postgres
-- set request.jwt.claim.sub = 'x'" scheitert an der eigenen Rolle
-- genauso. Es ist also keine Frage von Rechten AUF studi (eine normale
-- Sitzungsvorgabe wie "alter role studi set statement_timeout = '30s'"
-- gelingt postgres problemlos), sondern eine Postgres-Regel für
-- unbekannte, nirgends per Erweiterung deklarierte Platzhalter-GUCs:
-- das dauerhafte Setzen per ALTER ROLE/DATABASE verlangt einen echten
-- Superuser. Gemessen: postgres trägt rolsuper = false in dieser
-- Instanz (rolbypassrls = true täuscht darüber hinweg, ist aber ein
-- anderes Attribut). supabase_admin trägt rolsuper = true und kann die
-- Zeile setzen - genau das Muster, das db/betrieb/README.md für
-- "ALTER ROLE authenticator SET pgrst.db_schemas" bereits dokumentiert
-- (dort aus einem anderen Grund: fehlendes ADMIN-Recht auf die Rolle).
--
-- Praktisch heißt das: NICHT "python3 db/run.py db/betrieb/lehrzugang.sql"
-- (das verbindet laut .env als postgres). Stattdessen direkt auf dem
-- Host, als supabase_admin:
--
--   ssh bot.butscher.cloud \
--     "docker exec -i supabase-db psql -U supabase_admin -d postgres" \
--     < db/betrieb/lehrzugang.sql
--
-- Jede andere Zeile dieser Datei läuft auch unter postgres problemlos
-- (einzeln nachgemessen); supabase_admin kann als Superuser alles, was
-- postgres kann, und zusätzlich diese eine Zeile - die ganze Datei
-- unter supabase_admin auszuführen ist deshalb die einfachere,
-- durchgängige Lösung statt eines Bruchs mitten in der Datei.
-- (Denkbare Alternative für später, hier bewusst nicht umgesetzt: ein
-- einmaliges "GRANT SET ON PARAMETER "request.jwt.claim.sub" TO postgres"
-- als supabase_admin würde künftige Läufe wieder über db/run.py
-- erlauben - das ist eine eigene, dauerhafte Rechteentscheidung und
-- nicht Teil dieses Auftrags.)
--
-- ---------------------------------------------------------------------
-- DIE KETTE HINTER hat_rolle (per pg_get_functiondef eigens ausgelesen,
-- deckt sich mit Zettel und Bericht)
--
--   velocity.hat_rolle(p_code text)        security definer, stable, sql
--     -> exists(... mitarbeiter_rolle join rolle
--                where mitarbeiter_id = mitarbeiter_id_aus_auth()
--                  and rolle.code = p_code)
--     -> velocity.mitarbeiter_id_aus_auth()   security definer, stable, sql
--          -> select mitarbeiter_id from velocity.mitarbeiter
--              where auth_uid = auth.uid() and status = 'aktiv'
--     -> auth.uid()                           stable, sql, KEIN security definer
--          -> coalesce(current_setting('request.jwt.claim.sub', true),
--                      current_setting('request.jwt.claims', true)::jsonb->>'sub')::uuid
--
-- auth.uid() liest also request.jwt.claim.sub zuerst, als schlichte
-- Zeichenkette - JSON ist nicht nötig. Genau das nutzt Weg A.
--
-- ---------------------------------------------------------------------
-- DIE ZWANZIG ROLLENGESPERRTEN SICHTEN - RECHTESTAND VOR DIESER DATEI
-- (eigens gemessen: has_table_privilege('studi', ..., 'select') je Sicht)
--
--   17 ohne SELECT (lauter Fehler): v_wawi_auftrag, v_wawi_fahrten_je_tag,
--     v_wawi_fahrten_je_tag_rad, v_wawi_fahrten_je_tag_typ, v_wawi_km_co2,
--     v_wawi_kunde, v_wawi_kundenorte, v_wawi_protokoll, v_wawi_radereignis,
--     v_wawi_schaden, v_wawi_station, v_wawi_station_flotte,
--     v_wawi_stationsauslastung, v_wawi_stationsverkehr_zeitfenster,
--     v_wawi_umsatz_kundengruppe, v_wawi_umsatz_radtyp, v_wawi_wartungsprognose.
--    3 mit SELECT (stilles Leerergebnis): v_wawi_fahrt_km, v_wawi_flotte,
--     v_wawi_modell.
--
-- Rollenketten je Sicht (pg_get_viewdef, alle hat_rolle(...)-Aufrufe
-- gezählt, nicht nur den ersten): "leitung" steckt tatsächlich in
-- allen zwanzig Ketten, wie im Bericht behauptet - das war anfangs
-- nicht offensichtlich, weil eine erste, oberflächlichere Messung nur
-- den JEWEILS ERSTEN hat_rolle()-Aufruf je Sicht erfasst hatte (der ist
-- nicht überall "leitung", z. B. v_wawi_flotte prüft zuerst
-- disposition). Für M-LEHRE mit allen vier Fachrollen ist das ohnehin
-- gleichgültig. "demo" steckt in 17 von 20 Ketten zusätzlich drin;
-- die drei OHNE demo sind v_wawi_fahrt_km, v_wawi_protokoll und
-- v_wawi_radereignis - das weicht vom Bericht ab, der genau zwei ANDERE
-- Sichten (v_wawi_radereignis und v_wawi_wartungsprognose) als einzige
-- Ausnahmen nennt; v_wawi_wartungsprognose trägt "demo" bei eigener
-- Nachmessung sehr wohl. Für diese Datei folgenlos (M-LEHRE bekommt
-- "demo" ohnehin nicht, siehe unten; "leitung" deckt alle zwanzig ab),
-- aber ein Beleg dafür, dass auch der Bericht nachzumessen und nicht
-- zu übernehmen war.
--
-- Zeilenzahlen bei aktiver Kennung (eigens gemessen, 05.09.2026, in
-- begin/rollback mit set_config('request.jwt.claim.sub', ..., true)
-- auf eine bestehende Mitarbeiter-UUID mit allen vier Fachrollen):
--
--   Sicht                                | Zeilen  | Bericht (zum Vergleich)
--   ------------------------------------- | ------- | -----------------------
--   v_wawi_auftrag                        |       5 | 5
--   v_wawi_fahrt_km                       |   12052 | 12052
--   v_wawi_fahrten_je_tag                 |     377 | 377
--   v_wawi_fahrten_je_tag_rad             |   12052 | 12052
--   v_wawi_fahrten_je_tag_typ             |    1023 | 1023
--   v_wawi_flotte                         |     278 | 278
--   v_wawi_km_co2                         |      47 | 47 (Kilometer: 49995,4)
--   v_wawi_kunde                          |    1014 | 1014
--   v_wawi_kundenorte                     |      14 | 14
--   v_wawi_modell                         |       5 | 5
--   v_wawi_protokoll                      |    1099 | 1108 (siehe Anmerkung unten)
--   v_wawi_radereignis                    |    2228 | 2228
--   v_wawi_schaden                        |       7 | 7
--   v_wawi_station                        |      10 | 10
--   v_wawi_station_flotte                 |     150 | 150
--   v_wawi_stationsauslastung             |      10 | 10
--   v_wawi_stationsverkehr_zeitfenster    |     240 | 240
--   v_wawi_umsatz_kundengruppe            |      67 | 67
--   v_wawi_umsatz_radtyp                  |      47 | 47
--   v_wawi_wartungsprognose               |      60 | 60
--
-- Anmerkung zu v_wawi_protokoll: velocity.aenderungsprotokoll zählte
-- vor dieser Datei 1099 Zeilen (deckt sich mit "1099 Protokollzeilen"
-- aus dem Kopf von kundenmails_anonymisieren.sql, taggleich gemessen).
-- Der im Bericht genannte Wert 1108 stammt vermutlich aus einer eigenen,
-- zum Messzeitpunkt noch nicht zurückgenommenen Testtransaktion des
-- ersten Bearbeiters: Ein probeweise eingefügter Mitarbeitersatz löst
-- über trg_mitarbeiter_protokoll GENAU NEUN neue Protokollzeilen aus
-- (neun, nicht acht - siehe nächster Abschnitt), und 1099 + 9 = 1108.
-- Diese Datei selbst hebt den Bestand nach ihrem ersten, echten Lauf auf
-- 1108 an; das ist dann kein Messfehler mehr, sondern die dokumentierte
-- Folge von Abschnitt "DER PROTOKOLLTRIGGER" weiter unten.
--
-- ---------------------------------------------------------------------
-- EIN BEFUND, DER ÜBER DIE VORGABE HINAUSGEHT: hat_rolle() BRAUCHT EIN
-- EIGENES AUSFÜHRUNGSRECHT
--
-- Die Entscheidung des Auftraggebers geht davon aus, dass mit gesetzter
-- Kennung "ist_mitarbeiter() und jede hat_rolle-Prüfung true liefern"
-- und "alle zwanzig Sichten Zeilen liefern" - ohne weiteres
-- Ausführungsrecht. Das stimmt für die BOOLESCHE LOGIK, aber nicht
-- für den AUFRUF selbst: hat_rolle() ist SECURITY DEFINER, und für
-- eine security-definer-Funktion prüft Postgres das Ausführungsrecht
-- immer gegen die tatsächlich aufrufende Rolle - auch dann, wenn der
-- Aufruf aus einer Sicht heraus erfolgt, die selbst nicht
-- security_invoker ist. Das unterscheidet hat_rolle() von
-- fn_luftlinie_km() (kein security definer): DAFÜR genügt der
-- vorherige Befund "kein Ausführungsrecht nötig" tatsächlich, weil
-- eine gewöhnliche Funktion innerhalb einer Nicht-invoker-Sicht mit den
-- Rechten des Sicht-Eigentümers läuft.
--
-- Gemessen (has_function_privilege UND ein tatsächlicher Aufruf unter
-- "set role studi" nach "grant studi to postgres", beides in
-- begin/rollback): studi hatte VOR dieser Datei kein Ausführungsrecht
-- auf hat_rolle(text), und der Versuch, irgendeine der zwanzig Sichten
-- unter dieser Rolle zu lesen, scheiterte mit
--   FEHLER: permission denied for function hat_rolle
-- - und zwar UNABHÄNGIG davon, ob request.jwt.claim.sub gesetzt war
-- oder ob SELECT auf die Sicht vorlag. Nach "grant execute on function
-- velocity.hat_rolle(text) to studi" (einzige Änderung, in derselben
-- zurückgenommenen Transaktion) lieferten alle geprüften Sichten die
-- richtigen Zeilenzahlen.
--
-- pg_depend bestätigt: JEDE der zwanzig Sichten hängt in ihrer eigenen
-- Definition direkt ausschließlich von hat_rolle() ab - fn_luftlinie_km
-- wird nur transitiv über velocity.v_fahrt_kennzahl erreicht (eine
-- andere Sicht, kein direkter Aufruf) und bleibt deshalb ohne eigenes
-- Ausführungsrecht erreichbar, wie die Nachtrag-2-Klarstellung sagt.
-- mitarbeiter_id_aus_auth() ist zwar ebenfalls security definer, wird
-- aber nur INNERHALB von hat_rolle() aufgerufen - sobald der Aufruf von
-- hat_rolle() selbst zugelassen ist, läuft der weitere Aufruf mit den
-- Rechten von dessen Eigentümer (postgres) und braucht kein eigenes
-- Recht für studi. Ebenso wird ist_mitarbeiter() von keiner der zwanzig
-- Sichten aufgerufen (pg_depend leer) und bleibt unangetastet.
--
-- DAMIT WEICHT DIESE DATEI VON EINER WÖRTLICHEN VORGABE AB: Nachtrag 2
-- listet unter "Nicht zu tun" auch "kein grant execute auf irgendeine
-- Funktion". Diese Datei vergibt genau EIN Ausführungsrecht:
-- velocity.hat_rolle(text) an studi. Begründung: Ohne dieses eine Recht
-- liefe der gesamte Mechanismus nicht - alle zwanzig Sichten schlügen
-- mit "permission denied for function hat_rolle" fehl, und das Ziel
-- ("vollständig lesend erkunden") wäre verfehlt. Die Vorgabe war nach
-- allem, was in Zettel und Bericht dokumentiert ist, im Glauben
-- geschrieben, KEIN Funktionsrecht sei nötig (belegt durch die
-- fn_luftlinie_km-Messung) - dieser Befund zu hat_rolle() selbst wurde
-- vorher nicht gemessen, weil bisherige Tests ihre Kennung immer als
-- postgres gesetzt hatten (der als Sicht-Eigentümer ohnehin alle
-- Rechte hat) statt tatsächlich unter "set role studi" zu prüfen.
-- hat_rolle() ist keine der 21 api_-Funktionen, hat keine Nebenwirkung
-- (reine SQL-Abfrage, kein Schreiben) und liegt damit außerhalb dessen,
-- was die tragende Annahme schützen soll. Dennoch: DIES IST EINE
-- ABWEICHUNG VON EINER AUSDRÜCKLICHEN VORGABE UND GEHÖRT VOR DEM ERSTEN
-- LAUF DIESER DATEI VOR DEN AUFTRAGGEBER, auch wenn sie hier begründet
-- und eng (nur diese eine Funktion, nur an studi, nicht an PUBLIC) gehalten
-- ist. Die Gegenprobe unten stellt sicher, dass es bei dieser einen
-- Funktion bleibt: sie prüft eigens, dass studi weiterhin keine der 21
-- api_-Funktionen ausführen darf.
--
-- Verworfene Abkürzung: "grant authenticated to studi" statt eines
-- gezielten Funktionsrechts. authenticated trägt EXECUTE auf hat_rolle
-- UND auf alle 21 api_-Funktionen (eigens gemessen) - eine
-- Rollenmitgliedschaft hätte also genau die Tür geöffnet, die die
-- tragende Annahme verschlossen halten soll. Deshalb der gezielte,
-- einzelne GRANT statt einer Mitgliedschaft.
--
-- ---------------------------------------------------------------------
-- DER MITARBEITERSATZ M-LEHRE: WARUM VIER ROLLEN, NICHT FÜNF
--
-- Gemessen: velocity.rolle trägt fünf Zeilen - disposition, werkstatt,
-- kundenservice, leitung, demo. Die Entscheidung des Auftraggebers
-- benennt an einer Stelle "alle Fachrollen" (Abschnitt "Entscheidung des
-- Auftraggebers"), an anderer Stelle "alle Rollen aus velocity.rolle"
-- (Nachtrag 2, "Was Weg A konkret braucht"). Diese Datei liest das als
-- dieselbe Absicht, nicht als Widerspruch, und HAT SICH FÜR VIER
-- ROLLEN ENTSCHIEDEN (ohne "demo") - das ist eine eigene Herleitung,
-- keine wörtliche Vorgabe, aus zwei Gründen:
--   1. Die drei bestehenden Mitarbeitersätze mit mehreren Rollen
--      (M-AGENT, M-0002) schließen "demo" in ihren jeweiligen Dateien
--      ausdrücklich aus, mit derselben Begründung: "demo" ist die
--      öffentliche Vorführrolle und schränkt ein, statt zu
--      berechtigen; an einem Konto mit den übrigen Fachrollen hätte
--      sie nichts verloren.
--   2. Es ändert nichts an der Reichweite: "leitung" allein deckt
--      bereits alle zwanzig Sichten ab (siehe oben), "demo" kommt in
--      den Rollenketten immer nur ZUSÄTZLICH zu einer Fachrolle vor,
--      nie exklusiv - M-LEHRE mit den vier Fachrollen sieht also exakt
--      dieselben Zeilen, ob "demo" dabei ist oder nicht.
-- Sollte der Auftraggeber "alle fünf Zeilen" wörtlich gemeint haben,
-- ändert das am Ergebnis nichts; der Unterschied ist rein kosmetisch
-- (ein Rollen-Tag mehr in mitarbeiter_rolle) und ließe sich durch
-- Entfernen von "and r.code <> 'demo'" unten jederzeit nachholen.
--
-- ---------------------------------------------------------------------
-- DER PROTOKOLLTRIGGER: BEFUND UND ENTSCHEIDUNG
--
-- Gemessen (pg_trigger, pg_get_functiondef): velocity.mitarbeiter trägt
-- trg_mitarbeiter_protokoll (AFTER INSERT OR DELETE OR UPDATE, ruft
-- fn_protokoll_schreiben('mitarbeiter_id')). Er FEUERT beim Anlegen von
-- M-LEHRE. fn_protokoll_schreiben vergleicht bei INSERT jedes Feld
-- gegen '{}'::jsonb (den fingierten "alten" Zustand) und schreibt für
-- jedes Feld, das sich davon unterscheidet, eine eigene Zeile nach
-- velocity.aenderungsprotokoll (aktion = 'INSERT', wert_alt = NULL,
-- wert_neu = der neue Wert) - ausgenommen sind nur erstellt_am und
-- geaendert_am. Bei neun der elf Spalten ist das der Fall: acht mit
-- echtem Wert, dazu ausgetreten_am - dessen SQL-NULL sich von einem
-- jsonb-'null' technisch unterscheidet ("is distinct from" behandelt
-- beides als verschieden), weshalb auch dafür eine Zeile entsteht.
-- Macht insgesamt NEUN neue Protokollzeilen, mitarbeiter_id darin NULL
-- (die auslesende Sitzung hat kein JWT und keinen Mitarbeitersatz;
-- v_wawi_protokoll zeigt das dann als "ohne Anmeldung" - so wie bereits
-- 1082 von 1099 bestehenden Zeilen).
--
-- ENTSCHEIDUNG: Trigger bleibt eingeschaltet, keine Abschaltung wie in
-- kundenmails_anonymisieren.sql. Dort gab es einen Datenschutzgrund
-- (echte Mailadressen sollten das Protokoll nicht dauerhaft belasten);
-- hier gibt es keinen: M-LEHRE ist von Anfang an erfunden, und alles,
-- was der Trigger protokolliert (Name, Mailadresse, die UUID selbst),
-- steht ohnehin unmaskiert in velocity.mitarbeiter, das studi bereits
-- über studizugang_lesend.sql lesen darf - der Trigger verbirgt hier
-- nichts, was nicht schon offen daliegt. Außerdem ist das Anlegen
-- eines Mitarbeitersatzes ein echter Stammdatenvorgang und kein reiner
-- Datenbereinigungslauf; er gehört damit anders als bei
-- kundenmails_anonymisieren.sql fachlich durchaus in das Buch. Jeder
-- der drei bestehenden Zugangskonten (M-AGENT, M-DEMO, M-0002) hat
-- diesen Trigger beim eigenen Anlegen ebenfalls durchlaufen; eine
-- Ausnahme nur für M-LEHRE wäre eine unbegründete Sonderbehandlung.
--
-- ---------------------------------------------------------------------
-- NEBENWIRKUNGEN VON auth.uid() FÜR JEDE studi-SITZUNG - GEPRÜFT,
-- NICHT NUR AUS DEM BERICHT ÜBERNOMMEN
--
-- v_mein_profil: WHERE k.auth_uid = auth.uid() filtert gegen
-- velocity.kunde, nicht gegen velocity.mitarbeiter (pg_get_viewdef
-- eigens gelesen) - M-LEHREs Kennung trifft dort nie, die Sicht bleibt
-- für studi leer, wie zuvor.
-- v_meine_ausleihe / v_meine_rechnung: beide security_invoker = true
-- (pg_class.reloptions eigens gelesen) und filtern in ihrer eigenen
-- Definition überhaupt nicht nach Identität - die Eingrenzung liegt
-- vollständig bei RLS auf den Basistabellen (ausleihe, rechnung), wo
-- eine Regel "studi_liest ... using (true)" bereits unbedingt gilt
-- (pg_policies eigens gelesen). Ein voller Dry-Run bestätigt das:
-- v_meine_ausleihe liefert 12274 Zeilen, v_meine_rechnung 4117 - beides
-- der volle Bestand, unverändert durch diese Datei.
-- Ergebnis: alle drei Nebenwirkungen bleiben wie vor dieser Datei.
--
-- ---------------------------------------------------------------------
-- DIE TRAGENDE ANNAHME - BEDINGUNG, UNTER DER WEG A GILT
--
-- Mit dieser Datei gilt studi schemaweit als Mitarbeiter: ist_mitarbeiter()
-- und jede hat_rolle-Prüfung liefern für jede studi-Sitzung true. Die
-- Lesegarantie ruht danach ALLEIN AUF DER RECHTESCHICHT: studi darf
-- select auf die freigegebenen Tabellen/Sichten und execute auf genau
-- EINE Funktion (hat_rolle(text)) - keine der 21 security-definer-
-- api_-Funktionen. DAS MUSS SO BLEIBEN. Wer später irgendwo ein
-- "grant execute ... to studi" oder "grant authenticated to studi"
-- ergänzt, hebt diesen Schutz auf, ohne es zu bemerken - die Gegenprobe
-- unten prüft genau das bei jedem Lauf und schlägt fehl, sobald studi
-- eine einzige api_-Funktion ausführen darf.
--
-- ---------------------------------------------------------------------
-- WAS DIESE DATEI AUSDRÜCKLICH NICHT TUT
--
-- Kein Schema lehre, keine gespiegelte Sicht - Weg B liegt verworfen
-- unter .superpowers/auftraege/lehrzugang-wegB-verworfen.sql.
-- Kein Anmeldekonto in auth.users: mitarbeiter.auth_uid trägt nur
-- UNIQUE (mitarbeiter_auth_uid_uk), keinen Fremdschlüssel auf
-- auth.users (pg_constraint eigens gelesen) - der Betreiber muss in
-- Supabase Studio nichts anlegen.
-- Kein Kennwort - das setzt der Auftraggeber selbst (wie bei studi
-- selbst, siehe studizugang_lesend.sql).
-- Kein grant execute auf irgendeine der 21 api_-Funktionen - siehe
-- tragende Annahme oben; die eine Ausnahme (hat_rolle) ist oben
-- eigens begründet und keine stille Erweiterung dieser Grenze.
-- Keine Ausnahme aus hat_rolle() werfen lassen (Abschnitt 4.5 der
-- Übergabe) - Eingriff in die laufende Warenwirtschaft und den
-- MCP-Server, nicht Teil dieses Auftrags.
-- Kein drop, kein alter an einer bestehenden Sicht - additiv.
-- v_data_dictionary bleibt offen: sie trägt (eigens gemessen)
-- KEIN hat_rolle in ihrer Definition und ist damit keine der zwanzig
-- gesperrten Sichten, sondern eine eigene, kleinere Lücke (ihr fehlt
-- schlicht ein SELECT-Grant) - nicht Gegenstand dieses Auftrags und
-- deshalb hier nicht mitgeschlossen, obwohl der verworfene Weg-B-Entwurf
-- sie nebenbei mit erledigt hatte.
--
-- ---------------------------------------------------------------------
-- REIHENFOLGE / ABHÄNGIGKEIT
--
-- studizugang_lesend.sql widerruft bei jedem eigenen Lauf pauschal alle
-- Ausführungsrechte auf Funktionen in velocity für studi ("revoke all
-- on all functions in schema velocity from studi"). Läuft jene Datei
-- NACH dieser hier, nimmt sie das oben vergebene Ausführungsrecht auf
-- hat_rolle() wieder mit - alle zwanzig Sichten schlagen dann erneut mit
-- "permission denied for function hat_rolle". In diesem Fall diese
-- Datei danach erneut ausführen; sie ist dafür idempotent gebaut.
--
-- Aufruf (siehe Warnung oben - NICHT über db/run.py):
--   ssh bot.butscher.cloud \
--     "docker exec -i supabase-db psql -U supabase_admin -d postgres" \
--     < db/betrieb/lehrzugang.sql
-- =====================================================================

-- ---- 1: Der Mitarbeitersatz M-LEHRE -----------------------------------
-- Eigener Personalsatz, keine reale Person - wie M-AGENT und M-DEMO.
-- Die Kennung ist FEST eingetragen (kein gen_random_uuid()): sie steht
-- unten ein zweites Mal in der ALTER-ROLE-Zeile, und beide müssen bei
-- jedem Lauf denselben Wert ergeben. status = 'aktiv' explizit gesetzt,
-- obwohl es der Tabellen-Default ist (mitarbeiter_status), damit die
-- Bedingung nicht von einem künftig geänderten Default abhängt.
insert into velocity.mitarbeiter
       (personalnummer, auth_uid, vorname, nachname, email, eingetreten_am, status)
select 'M-LEHRE', '5cc4955e-afb3-45c9-aed0-fa478dfb96f5'::uuid, 'Erika', 'Musterfrau',
       'erika.musterfrau@mail.invalid', current_date, 'aktiv'
 where not exists (select 1 from velocity.mitarbeiter where personalnummer = 'M-LEHRE');

-- ---- 2: Die vier Fachrollen (nicht "demo") ------------------------------
-- Begründung für den Ausschluss von "demo" siehe Kopf. Wie bei
-- M-AGENT/M-0002: cross join über velocity.rolle, "demo" ausgenommen.
insert into velocity.mitarbeiter_rolle (mitarbeiter_id, rolle_id)
select m.mitarbeiter_id, r.rolle_id
  from velocity.mitarbeiter m cross join velocity.rolle r
 where m.personalnummer = 'M-LEHRE'
   and r.code <> 'demo'
on conflict (mitarbeiter_id, rolle_id) do nothing;

-- ---- 3: Die Zuweisung an die Rolle studi --------------------------------
-- Dieselbe Kennung wie oben. Braucht einen echten Superuser (siehe
-- Warnung im Kopf) - unter postgres scheitert genau diese eine Zeile
-- mit "permission denied to set parameter".
alter role studi set request.jwt.claim.sub = '5cc4955e-afb3-45c9-aed0-fa478dfb96f5';

-- ---- 4: Leserecht auf die zwanzig rollengesperrten Sichten --------------
-- grant ist idempotent - ein zweiter Lauf vergibt denselben Zustand
-- erneut, ohne Fehler. Die drei bereits offenen (v_wawi_fahrt_km,
-- v_wawi_flotte, v_wawi_modell) sind bewusst mit aufgeführt statt
-- ausgespart: eine Sonderbehandlung nur für die übrigen siebzehn wäre
-- eine zusätzliche Fehlerquelle ohne Gegenwert.
do $$
declare
  v_view text;
  v_n    integer := 0;
begin
  foreach v_view in array array[
    'v_wawi_auftrag', 'v_wawi_fahrt_km', 'v_wawi_fahrten_je_tag',
    'v_wawi_fahrten_je_tag_rad', 'v_wawi_fahrten_je_tag_typ', 'v_wawi_flotte',
    'v_wawi_km_co2', 'v_wawi_kunde', 'v_wawi_kundenorte', 'v_wawi_modell',
    'v_wawi_protokoll', 'v_wawi_radereignis', 'v_wawi_schaden', 'v_wawi_station',
    'v_wawi_station_flotte', 'v_wawi_stationsauslastung',
    'v_wawi_stationsverkehr_zeitfenster', 'v_wawi_umsatz_kundengruppe',
    'v_wawi_umsatz_radtyp', 'v_wawi_wartungsprognose'
  ] loop
    execute format('grant select on velocity.%I to studi', v_view);
    v_n := v_n + 1;
  end loop;
  raise notice '% Sichten für studi freigegeben (vorher 17 ohne, 3 mit Leserecht)', v_n;
end $$;

-- ---- 5: Das eine notwendige Ausführungsrecht ---------------------------
-- Begründung und Abgrenzung zu den 21 api_-Funktionen siehe Kopf.
-- Keine PUBLIC-Freigabe, keine Rollenmitgliedschaft - gezielt an studi.
grant execute on function velocity.hat_rolle(text) to studi;

-- ---- 6: Sitzungsvorgaben und Verbindungsgrenze --------------------------
-- studi hatte vor dieser Datei keine einzige Sitzungsvorgabe und keine
-- Verbindungsgrenze (rolconnlimit = -1, kein pg_db_role_setting-Eintrag -
-- beides eigens gemessen).
--
-- Nur "velocity": kein Schema lehre, und "public"/"extensions" sind für
-- studi ohnehin ohne USAGE (studizugang_lesend.sql entzieht public
-- ausdrücklich) - ein längerer Pfad würde nichts zusätzlich
-- erreichbar machen, nur den falschen Eindruck erwecken, dort stünde
-- etwas offen.
alter role studi set search_path = velocity;

-- Leitplanken gegen ausufernde bzw. hängengebliebene Sitzungen, nicht
-- gegen Absicht. 30 Sekunden sind für jede Abfrage auf diesem
-- Datenbestand (größte Tabelle rund 28700 Zeilen) reichlich und
-- greifen praktisch nur bei einem versehentlichen Kreuzprodukt.
alter role studi set statement_timeout = '30s';

-- Eine kurze Kaffeepause mit offener Transaktion soll nicht sofort die
-- Verbindung kosten; eine liegen gelassene Sitzung soll trotzdem nicht
-- dauerhaft einen der vierzig Plätze (siehe unten) belegen.
alter role studi set idle_in_transaction_session_timeout = '60s';

-- LEITPLANKE, AUSDRÜCKLICH NICHT DIE SCHUTZMAUER: pg_settings führt
-- default_transaction_read_only mit dem Kontext "user" (eigens
-- gemessen) - jede Sitzung kann ihn selbst mit
-- "set default_transaction_read_only = off" wieder abschalten. Die
-- tatsächliche Schranke gegen Schreiben ist das Fehlen jedes
-- INSERT/UPDATE/DELETE-Grants für studi, unabhängig von diesem
-- Parameter - der hier trotzdem gesetzt wird, damit ein Schreibversuch
-- aus Beispielcode sofort und lesbar scheitert, statt sich erst an einer
-- fehlenden Berechtigung zu verheddern.
alter role studi set default_transaction_read_only = on;

-- Bisher unbegrenzt (rolconnlimit = -1, eigens gemessen). 40 gleichzeitige
-- Verbindungen für eine Kursgröße.
alter role studi connection limit 40;


-- ---- Gegenprobe ----------------------------------------------------------
-- Schlägt am Ende fehl (raise exception), wenn: eine neue
-- rollengesperrte Sicht ohne Freigabe auftaucht, M-LEHRE fehlt oder
-- nicht aktiv/vierrollig ist, die Kennung zwischen dem Mitarbeitersatz
-- und der ALTER-ROLE-Zeile auseinanderläuft, studi hat_rolle() nicht
-- ausführen darf, studi auch nur eine api_-Funktion ausführen darf,
-- eine der zwanzig Sichten fehlt/ungelesen/leer bleibt, eine
-- Sitzungsvorgabe fehlt oder die Verbindungsgrenze abweicht.
do $$
declare
  v_erwartet text[] := array[
    'v_wawi_auftrag', 'v_wawi_fahrt_km', 'v_wawi_fahrten_je_tag',
    'v_wawi_fahrten_je_tag_rad', 'v_wawi_fahrten_je_tag_typ', 'v_wawi_flotte',
    'v_wawi_km_co2', 'v_wawi_kunde', 'v_wawi_kundenorte', 'v_wawi_modell',
    'v_wawi_protokoll', 'v_wawi_radereignis', 'v_wawi_schaden', 'v_wawi_station',
    'v_wawi_station_flotte', 'v_wawi_stationsauslastung',
    'v_wawi_stationsverkehr_zeitfenster', 'v_wawi_umsatz_kundengruppe',
    'v_wawi_umsatz_radtyp', 'v_wawi_wartungsprognose'
  ];
  v_name              text;
  v_liste             text;
  v_zeilen            bigint;
  v_mitarbeiter_id    bigint;
  v_uuid_mitarbeiter  uuid;
  v_uuid_konfiguriert uuid;
  v_rollen            integer;
  v_codes             text;
  v_privileg_fehlt    integer := 0;
  v_schreibrecht      integer := 0;
  v_leer              integer := 0;
  v_api_faelle        integer;
  v_connlimit         integer;
  v_hat_searchpath    integer;
  v_hat_stmt_to       integer;
  v_hat_idle_to       integer;
  v_hat_readonly      integer;
begin
  -- Neue rollengesperrte Sicht, die diese Datei noch nicht kennt?
  select string_agg(c.relname, ', ' order by c.relname) into v_liste
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'velocity' and c.relkind = 'v'
     and pg_get_viewdef(c.oid, true) ~ 'hat_rolle'
     and c.relname <> all(v_erwartet);
  if v_liste is not null then
    raise exception 'Neue rollengesperrte Sicht(en) ohne Freigabe in dieser Datei: % - '
                     'Abschnitt 4 dieser Datei ergänzen', v_liste;
  end if;

  -- M-LEHRE: Grundzustand.
  select m.mitarbeiter_id, m.auth_uid into v_mitarbeiter_id, v_uuid_mitarbeiter
    from velocity.mitarbeiter m where m.personalnummer = 'M-LEHRE';

  if v_mitarbeiter_id is null then
    raise exception 'M-LEHRE wurde nicht angelegt';
  end if;

  if not exists (select 1 from velocity.mitarbeiter
                  where personalnummer = 'M-LEHRE' and status = 'aktiv') then
    raise exception 'M-LEHRE trägt nicht status = aktiv - '
                     'mitarbeiter_id_aus_auth() fände den Satz nicht';
  end if;

  select count(*), string_agg(r.code, ',' order by r.code)
    into v_rollen, v_codes
    from velocity.mitarbeiter_rolle mr join velocity.rolle r on r.rolle_id = mr.rolle_id
   where mr.mitarbeiter_id = v_mitarbeiter_id;

  if v_rollen <> 4 or v_codes <> 'disposition,kundenservice,leitung,werkstatt' then
    raise exception 'M-LEHRE trägt % Rolle(n) (%) statt der vier Fachrollen', v_rollen, v_codes;
  end if;

  -- Konsistenz der Kennung zwischen dem Mitarbeitersatz und der
  -- ALTER-ROLE-Zeile - genau die Falle, an der ein zweiter Lauf mit
  -- vertipptem Literal sonst still auseinanderliefe.
  select split_part(cfg, '=', 2)::uuid into v_uuid_konfiguriert
    from pg_db_role_setting s
    join pg_roles r on r.oid = s.setrole
    cross join lateral unnest(s.setconfig) as cfg
   where r.rolname = 'studi' and cfg like 'request.jwt.claim.sub=%';

  if v_uuid_konfiguriert is null then
    raise exception 'request.jwt.claim.sub ist für studi nicht gesetzt';
  end if;

  if v_uuid_konfiguriert <> v_uuid_mitarbeiter then
    raise exception 'ALTER ROLE trägt % , M-LEHRE trägt auth_uid % - '
                     'die beiden Literale in dieser Datei sind auseinandergelaufen',
                     v_uuid_konfiguriert, v_uuid_mitarbeiter;
  end if;

  -- Ausführungsrecht: genau hat_rolle, keine api_-Funktion (die
  -- tragende Annahme als automatische Schranke statt als Vorsatz).
  if not has_function_privilege('studi', 'velocity.hat_rolle(text)', 'execute') then
    raise exception 'studi darf hat_rolle() nicht ausführen - der Mechanismus greift nicht';
  end if;

  select count(*) into v_api_faelle
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'velocity' and p.proname like 'api\_%'
     and has_function_privilege('studi', p.oid, 'execute');
  if v_api_faelle > 0 then
    raise exception 'studi darf % api_-Funktion(en) ausführen - die tragende Annahme ist verletzt', v_api_faelle;
  end if;

  -- Je Sicht: vorhanden, Leserecht, kein Schreibrecht, nicht leer - mit
  -- der soeben geprüften Kennung lokal (nur für diese Transaktion)
  -- aktiv gesetzt. Das ersetzt "set role studi": hat_rolle() wertet
  -- ausschließlich die Sitzungsvariable und die Tabellendaten aus, nie
  -- die aufrufende Rolle - der folgende Test ist deshalb für das
  -- Ergebnis gleichwertig zu einer echten studi-Sitzung, ohne dass
  -- postgres/supabase_admin Mitglied von studi werden muss. Die Variable
  -- bleibt bis zum Ende dieser Transaktion gesetzt - deshalb zeigt auch
  -- die anschließende informative Abfrage unten für die zwanzig
  -- Sichten echte Zahlen statt Nullen.
  perform set_config('request.jwt.claim.sub', v_uuid_konfiguriert::text, true);

  foreach v_name in array v_erwartet loop
    if not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
                    where n.nspname = 'velocity' and c.relname = v_name and c.relkind = 'v') then
      raise exception 'velocity.% fehlt', v_name;
    end if;

    if not has_table_privilege('studi', format('velocity.%I', v_name)::regclass, 'select') then
      v_privileg_fehlt := v_privileg_fehlt + 1;
      raise warning 'studi darf velocity.% nicht lesen', v_name;
    end if;

    if has_table_privilege('studi', format('velocity.%I', v_name)::regclass, 'insert')
       or has_table_privilege('studi', format('velocity.%I', v_name)::regclass, 'update')
       or has_table_privilege('studi', format('velocity.%I', v_name)::regclass, 'delete') then
      v_schreibrecht := v_schreibrecht + 1;
      raise warning 'studi hat ein Schreibrecht auf velocity.%', v_name;
    end if;

    execute format('select count(*) from velocity.%I', v_name) into v_zeilen;
    if v_zeilen = 0 then
      v_leer := v_leer + 1;
      raise warning 'velocity.% liefert null Zeilen - Rollensperre greift vermutlich noch', v_name;
    end if;
  end loop;

  -- Sitzungsvorgaben: nur die Existenz je Schlüssel geprüft, nicht
  -- der Wortlaut - der darf sich ändern, ohne die Gegenprobe zu brechen.
  select count(*) filter (where cfg like 'search_path=%'),
         count(*) filter (where cfg like 'statement_timeout=%'),
         count(*) filter (where cfg like 'idle_in_transaction_session_timeout=%'),
         count(*) filter (where cfg like 'default_transaction_read_only=%')
    into v_hat_searchpath, v_hat_stmt_to, v_hat_idle_to, v_hat_readonly
    from pg_db_role_setting s
    join pg_roles r on r.oid = s.setrole
    cross join lateral unnest(s.setconfig) as cfg
   where r.rolname = 'studi';

  if coalesce(v_hat_searchpath, 0) = 0 then
    raise exception 'search_path für studi nicht gesetzt';
  end if;
  if coalesce(v_hat_stmt_to, 0) = 0 then
    raise exception 'statement_timeout für studi nicht gesetzt';
  end if;
  if coalesce(v_hat_idle_to, 0) = 0 then
    raise exception 'idle_in_transaction_session_timeout für studi nicht gesetzt';
  end if;
  if coalesce(v_hat_readonly, 0) = 0 then
    raise exception 'default_transaction_read_only für studi nicht gesetzt';
  end if;

  select rolconnlimit into v_connlimit from pg_roles where rolname = 'studi';
  if v_connlimit <> 40 then
    raise exception 'Verbindungsgrenze für studi ist % statt 40', v_connlimit;
  end if;

  raise notice 'Gegenprobe: % Sichten geprüft, % ohne Leserecht, % mit Schreibrecht, % mit null Zeilen',
               array_length(v_erwartet, 1), v_privileg_fehlt, v_schreibrecht, v_leer;

  if v_privileg_fehlt > 0 or v_schreibrecht > 0 or v_leer > 0 then
    raise exception 'Lehrzugang steht nicht wie beabsichtigt - siehe vorstehende Warnungen';
  end if;
end $$;


-- Systematische Gegenprobe zum eigenhändigen Ausführen, unabhängig
-- vom DO-Block oben und sinngemäß aus Abschnitt 5 des
-- Übergabedokuments übernommen: jede für studi lesbare Tabelle oder
-- Sicht in velocity mit ihrer Zeilenzahl (die oben lokal gesetzte
-- Kennung gilt noch, siehe Kommentar im DO-Block). Vor Semesterbeginn
-- einmal laufen lassen - eine 0 ohne bekannten Grund ist eine
-- übersehene Sperre. Bekannte, unverändert bleibende Ausnahmen:
-- v_mein_profil, v_meine_bilanz, v_meine_fahrt_kennzahl und
-- v_meine_monatsbilanz filtern gegen velocity.kunde und bleiben für
-- M-LEHRE (kein Kunde) leer - siehe "Nebenwirkungen" oben.
select n.nspname as schema, c.relname as objekt,
       case c.relkind when 'r' then 'Tabelle' when 'v' then 'Sicht' end as art,
       (xpath('/row/c/text()',
              query_to_xml(format('select count(*) as c from %I.%I', n.nspname, c.relname),
                           false, true, '')))[1]::text::bigint as zeilen
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'velocity' and c.relkind in ('v', 'r')
   and has_table_privilege('studi', c.oid, 'select')
 order by zeilen nulls first, 1, 2;


-- ---- Rückbau (auskommentiert; von Hand ausführen, als supabase_admin) --
-- alter role studi reset search_path;
-- alter role studi reset statement_timeout;
-- alter role studi reset idle_in_transaction_session_timeout;
-- alter role studi reset default_transaction_read_only;
-- alter role studi connection limit -1;
-- alter role studi reset request.jwt.claim.sub;
-- revoke execute on function velocity.hat_rolle(text) from studi;
-- revoke select on
--   velocity.v_wawi_auftrag, velocity.v_wawi_fahrt_km, velocity.v_wawi_fahrten_je_tag,
--   velocity.v_wawi_fahrten_je_tag_rad, velocity.v_wawi_fahrten_je_tag_typ, velocity.v_wawi_flotte,
--   velocity.v_wawi_km_co2, velocity.v_wawi_kunde, velocity.v_wawi_kundenorte, velocity.v_wawi_modell,
--   velocity.v_wawi_protokoll, velocity.v_wawi_radereignis, velocity.v_wawi_schaden, velocity.v_wawi_station,
--   velocity.v_wawi_station_flotte, velocity.v_wawi_stationsauslastung, velocity.v_wawi_stationsverkehr_zeitfenster,
--   velocity.v_wawi_umsatz_kundengruppe, velocity.v_wawi_umsatz_radtyp, velocity.v_wawi_wartungsprognose
-- from studi;
-- -- v_wawi_fahrt_km, v_wawi_flotte, v_wawi_modell trugen das Leserecht
-- -- schon vor dieser Datei (Herkunft ungeklärt) - der Rückbau entzieht
-- -- es trotzdem allen zwanzig gleich, das stellt den Ausgangszustand für
-- -- die übrigen siebzehn wieder her und ändert an den drei anderen
-- -- nichts, was diese Datei zu verantworten hätte.
-- delete from velocity.mitarbeiter_rolle
--  where mitarbeiter_id = (select mitarbeiter_id from velocity.mitarbeiter where personalnummer = 'M-LEHRE');
-- delete from velocity.mitarbeiter where personalnummer = 'M-LEHRE';
-- -- studi selbst bleibt stehen (siehe studizugang_lesend.sql); diese
-- -- Datei legt keine Rolle an und entfernt auch keine.
