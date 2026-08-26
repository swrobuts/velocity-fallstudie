-- =====================================================================
--  KUNDENWOHNORTE AUF DIE REGION WUERZBURG STELLEN
--
--  ACHTUNG: Diese Datei erzeugt ERFUNDENE Adressdaten. Sie sind
--  plausibel gebaut, aber nicht erhoben.
--
--  ANLASS (gemessen am 26.08.2026, siehe
--  .superpowers/sdd/wawi-gestaltung/referenzdaten-report.md): von 1014
--  Kunden hatten 901 eine Rechnungsadresse, und die zeigte auf zufaellige
--  Weltstaedte - Havana, Dhaka, Bangkok, chinesische und japanische
--  Strassen, sogar Nuernberg -, jede mit land_code 'DE' und einer dazu
--  erfundenen PLZ. Nur 8 der 901 Adressen lagen tatsaechlich in
--  Wuerzburg. Ein Verleih mit zehn Stationen ausschliesslich in
--  Wuerzburg kann eine Kundschaft rund um den Globus nicht plausibel
--  erklaeren.
--
--  WAS NICHT ANGEFASST WIRD:
--   - Die 113 Kunden ohne Adresse (rechnungsadresse_id ist null). Das
--     ist ein gewollter Zustand der Fallstudie - die Oberflaeche zeigt
--     dafuer "keine Adresse hinterlegt", und genau das soll sie
--     weiterhin koennen. Wer diese Luecke fuellt, nimmt dem Lehrbeispiel
--     seinen Fall.
--   - vorname, nachname, email. Die sind bereits international
--     (chinesische, japanische und westliche Namen gemischt) - fuer eine
--     Universitaetsstadt erwuenscht, siehe Auftrag. Nur die WOHNORTE
--     waren das Problem, nicht die Namen.
--   - Die zehn Stationsadressen (velocity.station.adresse_id). Sie
--     teilen sich keine adresse_id mit velocity.kunde (gemessen: 901
--     kundenseitige plus 10 stationsseitige adresse_id, keine
--     Ueberschneidung) und werden hier ueber
--     "k.rechnungsadresse_id is not null" ohnehin nie erreicht.
--
--  VERTEILUNG: rund 62 Prozent der 901 Adressen fallen auf Wuerzburg
--  selbst, der Rest auf einen abklingenden Schwanz von 13
--  Nachbarorten im Landkreis (und zwei etwas weiter draussen,
--  Karlstadt und Marktheidenfeld, als schwache Auslaeufer) - Hoechberg
--  und Veitshoechheim am staerksten, weil sie die groessten direkten
--  Nachbargemeinden sind. Eine Gleichverteilung ueber vierzehn Orte
--  waere fuer einen STADTVERLEIH unrealistisch (seine Kundschaft wohnt
--  ueberwiegend in der Stadt, in der auch alle zehn Stationen stehen);
--  ein reiner 100-Prozent-Wuerzburg-Bestand liesse das Umland
--  verschwinden, das gerade der interessante Rand der Verteilung ist.
--
--  POSTLEITZAHLEN: keine erfunden. Jede PLZ unten wurde gegen eine
--  externe Quelle geprueft, nicht aus dem Gedaechtnis geschaetzt.
--  Orte, bei denen die Zuordnung nicht mit hinreichender Sicherheit zu
--  klaeren war, fehlen in dieser Liste bewusst - eine erfundene Stadt
--  waere in einer Lehrdatenbank das kleinere Problem als eine falsche
--  PLZ zu einem echten Ort.
--
--  STRASSENNAMEN: fuer Wuerzburg ausschliesslich real existierende
--  Strassen (siehe Bericht fuer die Belege), und keine davon, die
--  schon eine der zehn Stationen traegt (Marktplatz, Bahnhofsplatz,
--  Sanderring, Josef-Schneider-Straße, Frankfurter Straße,
--  Emil-Fischer-Straße, Juliuspromenade, Residenzplatz, Domstraße) -
--  das schliesst eine Kollision mit dem UNIQUE-Schluessel
--  adresse_fachschluessel_uk von vornherein konstruktiv aus, statt sich
--  auf den Zufall der Hausnummern zu verlassen. Fuer die Umlandorte
--  generische, aber ortstypische Namen (Hauptstraße, Kirchstraße,
--  Marktplatz) - nicht einzeln fuer jeden Ort verifiziert, aber ein
--  Muster, das praktisch jeder deutsche Ort dieser Groessenordnung
--  traegt, anders als die vorher dort stehenden Tokioter Hausnummern.
--
--  HAUSNUMMERN: fortlaufend je Ort/Strasse vergeben (row_number()),
--  nicht zufaellig gewuerfelt. Das macht die Eindeutigkeit gegen
--  adresse_fachschluessel_uk beweisbar statt nur wahrscheinlich - bei
--  901 Zeilen ueber vierzehn Orte waere ein zufaelliger Treffer auf
--  eine bereits vergebene Kombination selten, aber nicht ausgeschlossen
--  gewesen.
--
--  VORBEDINGUNG: keine ueber db/betrieb/referenzdaten_*.sql hinaus.
--  Die Datei aendert ausschliesslich velocity.adresse ueber
--  velocity.kunde.rechnungsadresse_id.
--
--  IDEMPOTENT: die Zuordnung laeuft nur, wenn im Uebernahmeprotokoll
--  noch keine Marke fuer diesen Lauf steht. Ohne die Sperre wuerde ein
--  zweiter Lauf bei jedem Aufruf neue Zufallsorte ziehen und den
--  Bestand ohne fachlichen Anlass wieder bewegen.
--
--  RUECKNAHME: siehe Block am Dateiende (auskommentiert). Er stellt
--  keine "echten" Altdaten wieder her - die zufaelligen Weltstaedte
--  waren selbst erfunden und nirgends als Ausgangszustand gesichert -,
--  sondern nimmt nur diesen Lauf und seine Marke zurueck.
-- =====================================================================

begin;

do $$
declare
  v_neu integer;
begin
  if exists (
    select 1 from velocity.uebernahme_protokoll
     where quelle = 'Referenzdaten (korrigiert)'
       and ziel = 'velocity.adresse (Kundenwohnorte)'
  ) then
    raise notice 'Kundenwohnorte bereits regionalisiert - Block wird uebersprungen';
    return;
  end if;

  perform setseed(0.9137);

  -- w_ort bestimmt den Ort ueber kumulierte Schwellen (dasselbe Muster
  -- wie die Tarifverteilung in referenzdaten_grundlage.sql), w_strasse
  -- bestimmt unabhaengig davon die Strasse innerhalb des gewaehlten
  -- Ortes.
  with strasse_pool (ort, strasse, plz) as (
    values
      ('Würzburg', 'Sanderstraße',                  '97070'),
      ('Würzburg', 'Neubaustraße',                   '97070'),
      ('Würzburg', 'Augustinerstraße',                '97070'),
      ('Würzburg', 'Semmelstraße',                    '97070'),
      ('Würzburg', 'Textorstraße',                    '97070'),
      ('Würzburg', 'Röntgenring',                     '97070'),
      ('Würzburg', 'Pleichertorstraße',               '97070'),
      ('Würzburg', 'Kardinal-Döpfner-Platz',          '97070'),
      ('Würzburg', 'Balthasar-Neumann-Promenade',     '97070'),
      ('Würzburg', 'Ottostraße',                      '97070'),
      ('Würzburg', 'Spiegelstraße',                   '97070'),
      ('Würzburg', 'Bibrastraße',                     '97070'),
      ('Würzburg', 'Eichhornstraße',                  '97070'),
      ('Würzburg', 'Theaterstraße',                   '97070'),
      ('Würzburg', 'Grombühlstraße',                  '97080'),
      ('Würzburg', 'Veitshöchheimer Straße',          '97080'),
      ('Würzburg', 'Schweinfurter Straße',            '97076'),
      ('Würzburg', 'Zeller Straße',                   '97082'),
      ('Würzburg', 'Mergentheimer Straße',            '97082'),
      ('Würzburg', 'Randersackerer Straße',           '97072'),
      ('Würzburg', 'Rottendorfer Straße',             '97072'),
      ('Höchberg', 'Hauptstraße',                     '97204'),
      ('Höchberg', 'Würzburger Straße',               '97204'),
      ('Höchberg', 'Kirchstraße',                     '97204'),
      ('Veitshöchheim', 'Würzburger Straße',          '97209'),
      ('Veitshöchheim', 'Kirchstraße',                '97209'),
      ('Veitshöchheim', 'Thüngersheimer Straße',      '97209'),
      ('Gerbrunn', 'Würzburger Straße',               '97218'),
      ('Gerbrunn', 'Rathausplatz',                    '97218'),
      ('Gerbrunn', 'Zum Steinberg',                   '97218'),
      ('Randersacker', 'Maingasse',                   '97236'),
      ('Randersacker', 'Würzburger Straße',           '97236'),
      ('Estenfeld', 'Hauptstraße',                    '97230'),
      ('Estenfeld', 'Kirchplatz',                     '97230'),
      ('Rottendorf', 'Hauptstraße',                   '97228'),
      ('Rottendorf', 'Würzburger Straße',             '97228'),
      ('Ochsenfurt', 'Hauptstraße',                   '97199'),
      ('Ochsenfurt', 'Marktplatz',                    '97199'),
      ('Zell am Main', 'Mainuferstraße',              '97299'),
      ('Zell am Main', 'Hauptstraße',                 '97299'),
      ('Waldbüttelbrunn', 'Hauptstraße',              '97297'),
      ('Waldbüttelbrunn', 'Schulstraße',              '97297'),
      ('Kist', 'Hauptstraße',                         '97271'),
      ('Kitzingen', 'Hauptstraße',                    '97318'),
      ('Kitzingen', 'Bahnhofstraße',                  '97318'),
      ('Karlstadt', 'Hauptstraße',                    '97753'),
      ('Marktheidenfeld', 'Hauptstraße',              '97828')
  ),
  ort_wahl as (
    select k.kunde_id, k.rechnungsadresse_id,
           random() as w_ort, random() as w_strasse
      from velocity.kunde k
     where k.rechnungsadresse_id is not null
  ),
  ort_bestimmt as (
    -- Schwellen aus den Gewichten Würzburg 650, Höchberg 70,
    -- Veitshöchheim 65, Gerbrunn 50, Randersacker 40, Estenfeld 30,
    -- Rottendorf 30, Ochsenfurt 20, Zell am Main 20, Waldbüttelbrunn 18,
    -- Kist 15, Kitzingen 15, Karlstadt 10, Marktheidenfeld 10 (Summe
    -- 1043) - kumuliert und durch 1043 geteilt.
    select kunde_id, rechnungsadresse_id, w_strasse,
           case
             when w_ort < 0.623 then 'Würzburg'
             when w_ort < 0.690 then 'Höchberg'
             when w_ort < 0.753 then 'Veitshöchheim'
             when w_ort < 0.801 then 'Gerbrunn'
             when w_ort < 0.839 then 'Randersacker'
             when w_ort < 0.868 then 'Estenfeld'
             when w_ort < 0.897 then 'Rottendorf'
             when w_ort < 0.916 then 'Ochsenfurt'
             when w_ort < 0.935 then 'Zell am Main'
             when w_ort < 0.952 then 'Waldbüttelbrunn'
             when w_ort < 0.967 then 'Kist'
             when w_ort < 0.981 then 'Kitzingen'
             when w_ort < 0.990 then 'Karlstadt'
             else 'Marktheidenfeld'
           end as ort
      from ort_wahl
  ),
  strasse_vorrat as (
    select ort, strasse, plz,
           row_number() over (partition by ort order by strasse) - 1 as nr,
           count(*)     over (partition by ort)                     as anzahl
      from strasse_pool
  ),
  zugeordnet as (
    select b.kunde_id, b.rechnungsadresse_id, b.ort, sv.strasse, sv.plz
      from ort_bestimmt b
      join strasse_vorrat sv
        on sv.ort = b.ort and sv.nr = floor(b.w_strasse * sv.anzahl)
  ),
  nummeriert as (
    select z.*,
           row_number() over (partition by z.ort, z.strasse order by z.kunde_id) as hausnummer
      from zugeordnet z
  )
  update velocity.adresse a
     set strasse      = n.strasse,
         hausnummer   = n.hausnummer::text,
         plz          = n.plz,
         ort          = n.ort,
         land_code    = 'DE',
         geaendert_am = now()
    from nummeriert n
   where a.adresse_id = n.rechnungsadresse_id;

  get diagnostics v_neu = row_count;
  raise notice 'Kundenadressen regionalisiert: %', v_neu;
  perform set_config('velocity.referenzdaten_adresse_neu', v_neu::text, true);
end;
$$;

-- ---- Nachweis im Uebernahmeprotokoll --------------------------------
insert into velocity.uebernahme_protokoll
       (lauf, quelle, ziel, gelesen, geschrieben, uebersprungen, hinweis)
select now(), 'Referenzdaten (korrigiert)', 'velocity.adresse (Kundenwohnorte)',
       0,
       coalesce(current_setting('velocity.referenzdaten_adresse_neu', true)::int, 0),
       0,
       'ERFUNDENE Adressdaten für die Lehre, nicht erhoben. 901 Kundenadressen von '
       'zufälligen Weltstädten (u. a. Nürnberg, Havana, Dhaka, Bangkok) auf Würzburg '
       'und sein Umland umgestellt: rund 62 % Würzburg, Rest ein abklingender Schwanz '
       'über 13 Nachbarorte. Postleitzahlen einzeln gegen eine externe Quelle '
       'geprüft. Die 113 Kunden ohne Adresse bleiben ohne Adresse.'
 where not exists (
   select 1 from velocity.uebernahme_protokoll
    where quelle = 'Referenzdaten (korrigiert)'
      and ziel = 'velocity.adresse (Kundenwohnorte)'
 );

commit;

-- ---- Kontrolle -------------------------------------------------------
do $$
declare
  v_ohne_adresse   integer;
  v_wuerzburg      integer;
  v_gesamt         integer;
  v_fremde_orte    integer;
  v_dubletten      integer;
begin
  select count(*) into v_ohne_adresse from velocity.kunde where rechnungsadresse_id is null;
  if v_ohne_adresse <> 113 then
    raise exception 'Die 113 Kunden ohne Adresse wurden angefasst: jetzt %', v_ohne_adresse;
  end if;

  select count(*) into v_gesamt
    from velocity.kunde k where k.rechnungsadresse_id is not null;

  select count(*) into v_wuerzburg
    from velocity.kunde k join velocity.adresse a on a.adresse_id = k.rechnungsadresse_id
   where a.ort = 'Würzburg';

  if v_wuerzburg::numeric / nullif(v_gesamt, 0) < 0.5 then
    raise exception 'Würzburg überwiegt nicht mehr: % von % Adressen', v_wuerzburg, v_gesamt;
  end if;

  select count(*) into v_fremde_orte
    from velocity.kunde k join velocity.adresse a on a.adresse_id = k.rechnungsadresse_id
   where a.ort not in ('Würzburg', 'Höchberg', 'Veitshöchheim', 'Gerbrunn', 'Randersacker',
                        'Estenfeld', 'Rottendorf', 'Ochsenfurt', 'Zell am Main',
                        'Waldbüttelbrunn', 'Kist', 'Kitzingen', 'Karlstadt', 'Marktheidenfeld');
  if v_fremde_orte > 0 then
    raise exception '% Kundenadressen liegen außerhalb der vereinbarten Orte', v_fremde_orte;
  end if;

  -- adresse_fachschluessel_uk haette das Update ohnehin verhindert; die
  -- Zaehlung hier ist der positive Beleg dafuer, dass es gar nicht erst
  -- so weit kommen konnte.
  select count(*) into v_dubletten from (
    select strasse, hausnummer, plz, ort, land_code, count(*)
      from velocity.adresse
     group by 1,2,3,4,5 having count(*) > 1
  ) x;
  if v_dubletten > 0 then
    raise exception '% doppelt vergebene Adress-Fachschlüssel', v_dubletten;
  end if;

  raise notice 'Kundenwohnorte in Ordnung: % von % Adressen in Würzburg (% Prozent)',
    v_wuerzburg, v_gesamt, round(100.0 * v_wuerzburg / nullif(v_gesamt,0), 1);
end;
$$;

-- ---- Ruecknahme ------------------------------------------------------
-- Es gibt keinen sinnvollen "alten Zustand", zu dem man zurueckkoennte -
-- die zufaelligen Weltstaedte waren selbst erfunden und nirgends
-- gesichert. Diese Ruecknahme setzt nur die Sperre zurueck, damit ein
-- erneuter Lauf der Datei wieder neue (andere) Zufallsorte zieht.
-- Zwingend, nicht optional: an genau diesem Protokolleintrag haengt die
-- Idempotenzsperre oben. Bleibt er stehen, haelt ein erneuter Lauf die
-- Regionalisierung faelschlich fuer bereits erledigt.
--
-- delete from velocity.uebernahme_protokoll
--  where quelle = 'Referenzdaten (korrigiert)'
--    and ziel = 'velocity.adresse (Kundenwohnorte)';
