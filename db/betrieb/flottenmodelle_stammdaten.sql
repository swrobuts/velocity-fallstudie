-- =====================================================================
--  FLOTTENMODELLE: HERSTELLER UND PRODUKTE, ZWEITER (KORRIGIERTER) ANLAUF
--
--  ACHTUNG: Diese Datei erzeugt ERFUNDENE Daten. Sie sind plausibel
--  gebaut, aber sie messen nichts. Kein Hersteller, kein Baujahr und
--  keine technische Angabe hier ist erhoben. Die Hersteller sind frei
--  erfunden - keine Anlehnung an reale Marken beabsichtigt.
--
--  DER EINWAND, DER DIESEN ZWEITEN ANLAUF NOETIG MACHTE (wörtlich):
--
--    "Ich finde die Namen der Räder sehr gut, aber die vielen Varianten
--    haben mich irritiert, das ist für ein Radleihsystem eher untypisch.
--    Es wäre logischer, es gibt das City Bike, E-Cargo Loader und E-Bike
--    - sie dürfen von verschiedenen Herstellern gefertigt werden, aber
--    nach vorgegebenen Spezifikationen. Wenn wir so viele Varianten
--    haben, müsste es auch das Preismodell abbilden, denn ein L wird
--    vermutlich günstiger sein müssen als ein XL. Falls L oder XL die
--    Rahmenhöhe meinen, wäre es auch nicht ideal, da alle Räder gleich
--    hoch sind und per Schnellspanner zu justieren wären."
--
--  Der erste Anlauf (siehe Git-Historie dieser Datei) hatte neun Modelle
--  angelegt: zwei City-Varianten je Hersteller, zwei E-Bike-Varianten je
--  Hersteller, zwei Cargo-Varianten von Loire Manufaktur. Der Einwand
--  trifft fachlich zu, in allen drei Punkten:
--
--    1. Ein Leihsystem hat wenige PRODUKTE, keine Modellpalette. Wer ein
--       Rad ausleiht, waehlt kein Modell - er nimmt das naechste freie
--       seines Typs. Neun Modelle waren Handelslogik, nicht Verleihlogik.
--    2. Der Tarif haengt in diesem System am TYP (velocity.nutzungspreis,
--       Schritt 0004), nicht am Modell. Neun Modelle ohne neun Preise
--       waren unstimmig - entweder haette es neun Preise gebraucht, oder
--       eben kein neuntes Modell.
--    3. Rahmenhoehe als L/XL-Sortiment ist bei einem Leihrad sachlich
--       falsch: die individuelle Anpassung an die fahrende Person laeuft
--       ueber den Sattel-Schnellspanner, nicht ueber eine Modellwahl.
--
--  WAS DIESE DATEI JETZT HERSTELLT
--
--    GENAU EIN PRODUKT JE TYP - City-Bike, E-Bike Sport, E-Cargo Loader,
--    dieselben drei Namen, die fahrradtyp.bezeichnung ohnehin schon
--    fuehrt (0008_referenzdaten.sql). Die technischen Angaben (Gewicht,
--    Gangzahl, Rahmenhoehe, Akkukapazitaet, Reichweite) sind seit der
--    Schemakorrektur in 0003_bereich_b_netz_und_flotte.sql ohnehin an
--    fahrradtyp gezogen - EIN Wert je Typ, in derselben Reihe wie der
--    Tarif. Diese Datei setzt hier nur noch die tatsaechlichen (erfundenen)
--    Werte je Typ, siehe Block 1 unten.
--
--    MEHRERE HERSTELLER BLEIBEN ERWUENSCHT - das war ausdruecklich
--    gelobt und ist fachlich richtig: ein Verleiher schreibt eine
--    Spezifikation aus und kauft bei mehreren Lieferanten. Die Tabelle
--    velocity.fahrradmodell kennt aber weiterhin nur EINEN Hersteller je
--    Zeile (hersteller_id ist eine Spalte, kein Array) - "ein Produkt,
--    mehrere Hersteller" wird deshalb ueber MEHRERE Zeilen mit
--    DEMSELBEN Produktnamen abgebildet, eine je Hersteller, alle mit
--    demselben typ_id: modellbezeichnung ist absichtlich NICHT mehr der
--    eigene Markenname eines Herstellers ("CityLine 1", "Urbano X"),
--    sondern immer exakt fahrradtyp.bezeichnung. Eine Spezifikationsebene
--    (eine eigene Tabelle "produkt" mit 1:n auf "lieferant") waere die
--    Alternative gewesen - bei drei Produkten und fuenf Herstellern ist
--    das eine Tabelle mehr, ohne dass sie mehr koennte als
--    fahrradmodell.typ_id heute schon leistet: die Gruppierung nach Typ
--    liegt bereits vor, nur eben nicht in einer eigenen Tabelle. Die
--    einfachere Loesung war hier die angemessene.
--
--    Zwei City-Hersteller (Nordwind Rad zuerst, Kvarner Bike Works kam
--    spaeter als zweite Bezugsquelle dazu), zwei E-Bike-Hersteller
--    (Kaskade Cycles etabliert, Vantaa Motion mit einer juengeren
--    Zulieferung) und ein Cargo-Hersteller (Loire Manufaktur) ergeben
--    FUENF Modellzeilen bei DREI Produkten - eine Flotte, wie ein
--    Verleiher sie ueber mehrere Beschaffungsrunden tatsaechlich
--    zusammenkauft, ohne dass daraus neun kaeufliche Varianten wuerden.
--    baujahr steht weiterhin je Zeile (je Hersteller): es haelt fest,
--    SEIT WANN dieser Hersteller den Typ beliefert - nicht das Baujahr
--    eines einzelnen Rades, das ueber mehrere Beschaffungschargen
--    desselben Herstellers variieren kann (siehe Spaltenkommentar).
--
--    KEIN RAD WECHSELT DABEI DEN HERSTELLER: die Zuordnung Rad->Hersteller
--    aus dem ersten Anlauf (nach Anschaffungsdatum in Kontingente
--    verteilt) bleibt bitidentisch erhalten - nur die neun feingliedrigen
--    Modellzeilen (CityLine 1/2, Urbano S/X, Pulse 400/500, Porteur L/XL)
--    werden je Hersteller zu einer Zeile zusammengefuehrt. Block 3 unten
--    ist deshalb allgemein genug formuliert, um sowohl von diesem
--    Zwischenstand (neun Modelle) als auch - fuer den Fall eines
--    Neuaufbaus von Grund auf - vom urspruenglichen Platzhalter
--    'unbekannt' aus zu funktionieren: massgeblich ist nur, ob ein Rad
--    bereits auf einer der fuenf kanonischen Zeilen steht, nicht, wo es
--    HEUTE zufaellig haengt.
--
--  WAS SICH NICHT AENDERT: Rahmennummern, Status, angeschafft_am, die
--  Anzahl Raeder je Typ (198 / 52 / 25) und je Status, und - siehe oben -
--  welcher Hersteller welches Rad fertigt. Keine der vier Auswertungs-
--  zahlen (Umsatz, Fahrten, CO2, Schaetzanteil) haengt an Hersteller oder
--  Modell - alle drei Aggregationen laufen ueber fahrradtyp, und der
--  bleibt fuer jedes Rad derselbe.
--
--  Idempotent: Block 1 setzt an fahrradtyp jedesmal dieselben Werte;
--  Block 3 aktualisiert hoechstens baujahr, wenn die Zeile schon
--  existiert; Block 4 findet beim zweiten Lauf kein Rad mehr, das noch
--  nicht auf einer kanonischen Zeile steht; Block 5 findet dann keine
--  verwaiste alte Modellzeile mehr zum Loeschen.
-- =====================================================================

begin;

-- ---- 1 Technische Angaben je Typ (erfunden, EIN Wert je Typ) --------------
-- Die Spalten selbst legt 0003_bereich_b_netz_und_flotte.sql an
-- fahrradtyp an (Schemakorrektur, siehe deren Kopfkommentar); diese
-- Datei setzt hier nur die tatsaechlichen erfundenen Zahlen. Reichweite
-- des E-Bike Sport bewusst 50 km, NICHT hoeher: fahrradtyp.beschreibung
-- bewirbt auf der Tarifkarte bereits "Reichweite bis 50 km"
-- (0008_referenzdaten.sql) - eine hoehere Zahl hier waere genau die Art
-- von Widerspruch, die tools/zahlen_gegen_db.py an anderer Stelle schon
-- einmal aufgedeckt hat (Zuladung des Lastenrads an vier Stellen mit
-- drei verschiedenen Zahlen). gangzahl des City-Bikes = 8, konsistent
-- mit dem bereits gefuehrten Werbemerkmal "8-Gang Nabenschaltung"
-- (fahrradtyp_merkmal); rahmenhoehe_cm des Cargo-Rads = 50, deckungsgleich
-- mit beiden Rahmenhoehen der frueheren Porteur-Modelle - hier keine neue
-- Zahl, sondern die, auf die sich Nordwind Rad und Loire Manufaktur beim
-- Cargo-Typ ohnehin schon trafen.
update velocity.fahrradtyp
   set gewicht_kg = 19.5, gangzahl = 8, rahmenhoehe_cm = 46,
       akkukapazitaet_wh = null, reichweite_km = null
 where typ_code = 'CITY';

update velocity.fahrradtyp
   set gewicht_kg = 24.0, gangzahl = 7, rahmenhoehe_cm = 48,
       akkukapazitaet_wh = 500, reichweite_km = 50
 where typ_code = 'EBIKE';

update velocity.fahrradtyp
   set gewicht_kg = 40.0, gangzahl = 8, rahmenhoehe_cm = 50,
       akkukapazitaet_wh = 600, reichweite_km = 45
 where typ_code = 'CARGO';

-- ---- 2 Hersteller sicherstellen (unveraendert gegenueber dem ersten Anlauf) --
insert into velocity.hersteller (name) values
  ('Nordwind Rad'),
  ('Kvarner Bike Works'),
  ('Kaskade Cycles'),
  ('Vantaa Motion'),
  ('Loire Manufaktur')
on conflict (name) do nothing;

-- ---- 3 Je Typ ein Produkt, gefertigt von einem oder mehreren Herstellern ----
-- modellbezeichnung = fahrradtyp.bezeichnung: das ist die Absicht, nicht
-- ein Zufall, siehe Kopfkommentar. baujahr = erstes Lieferjahr DIESES
-- Herstellers fuer diesen Typ.
insert into velocity.fahrradmodell (hersteller_id, typ_id, modellbezeichnung, baujahr)
select h.hersteller_id, t.typ_id, t.bezeichnung, v.baujahr
  from (values
    -- hersteller,            typ_code, baujahr (erste Lieferung dieses Herstellers)
    ('Nordwind Rad',       'CITY',  2021),
    ('Kvarner Bike Works', 'CITY',  2024),
    ('Kaskade Cycles',     'EBIKE', 2022),
    ('Vantaa Motion',      'EBIKE', 2025),
    ('Loire Manufaktur',   'CARGO', 2022)
  ) as v(hersteller, typ_code, baujahr)
  join velocity.hersteller h on h.name     = v.hersteller
  join velocity.fahrradtyp t on t.typ_code = v.typ_code
on conflict (hersteller_id, modellbezeichnung) do update
  set baujahr = excluded.baujahr;

-- ---- 4 Raeder, die noch nicht auf einem der fuenf Produkte stehen, ----------
-- ---- nach Anschaffungsreihenfolge auf die Kontingente ihres Herstellers verteilen --
-- Deckt sowohl den urspruenglichen Platzhalter 'unbekannt' als auch die
-- neun feingliedrigen Zwischenmodelle (CityLine 1/2 usw.) ab: massgeblich
-- ist nur, ob mo.modellbezeichnung schon dem Produktnamen ihres Typs
-- entspricht - unabhaengig davon, wie die Zeile hiess, auf der ein Rad
-- vor diesem Lauf stand. Die Kontingente je Hersteller sind die Summen
-- der frueheren feingliedrigen Kontingente (Nordwind 60+50, Kvarner
-- 48+40, Kaskade 20+20, Vantaa 12, Loire 15+10) - dieselbe Reihenfolge
-- nach angeschafft_am wie beim ersten Anlauf ordnet deshalb jedes Rad
-- wieder demselben Hersteller zu wie vorher, nur ohne den Umweg ueber
-- eine feinere Modellzeile.
with kanonisch as (
  select mo.modell_id, mo.hersteller_id, mo.typ_id
    from velocity.fahrradmodell mo
    join velocity.fahrradtyp t on t.typ_id = mo.typ_id
   where mo.modellbezeichnung = t.bezeichnung
),
alt as (
  select f.fahrrad_id,
         mo_alt.typ_id,
         row_number() over (partition by mo_alt.typ_id
                             order by f.angeschafft_am, f.rahmennummer) as rang
    from velocity.fahrrad f
    join velocity.fahrradmodell mo_alt on mo_alt.modell_id = f.modell_id
   where not exists (select 1 from kanonisch k where k.modell_id = mo_alt.modell_id)
),
kontingent as (
  select t.typ_id, k.modell_id,
         sum(v.anzahl) over (partition by t.typ_id order by v.reihenfolge
                              rows between unbounded preceding and current row) as bis_rang,
         sum(v.anzahl) over (partition by t.typ_id order by v.reihenfolge
                              rows between unbounded preceding and 1 preceding) as ab_rang_excl
    from (values
      ('CITY',  1, 'Nordwind Rad',       110),
      ('CITY',  2, 'Kvarner Bike Works',  88),
      ('EBIKE', 1, 'Kaskade Cycles',      40),
      ('EBIKE', 2, 'Vantaa Motion',       12),
      ('CARGO', 1, 'Loire Manufaktur',    25)
    ) as v(typ_code, reihenfolge, hersteller, anzahl)
    join velocity.fahrradtyp t on t.typ_code = v.typ_code
    join velocity.hersteller h on h.name     = v.hersteller
    join kanonisch          k on k.hersteller_id = h.hersteller_id and k.typ_id = t.typ_id
)
update velocity.fahrrad f
   set modell_id = k.modell_id
  from alt
  join kontingent k
    on k.typ_id = alt.typ_id
   and alt.rang >  coalesce(k.ab_rang_excl, 0)
   and alt.rang <= k.bis_rang
 where f.fahrrad_id = alt.fahrrad_id;

-- ---- 5 Verwaiste alte Modellzeilen entfernen, sobald kein Rad mehr zeigt ----
-- Trifft je nach Ausgangszustand die neun feingliedrigen Zwischenmodelle
-- oder die drei urspruenglichen 'unbekannt'-Platzhalter.
delete from velocity.fahrradmodell mo
 where not exists (select 1 from velocity.fahrrad f where f.modell_id = mo.modell_id)
   and not exists (
     select 1 from velocity.fahrradtyp t
      where t.typ_id = mo.typ_id and t.bezeichnung = mo.modellbezeichnung
   );

delete from velocity.hersteller h
 where h.name = 'unbekannt'
   and not exists (select 1 from velocity.fahrradmodell mo where mo.hersteller_id = h.hersteller_id);

-- ---- Nachweis im Uebernahmeprotokoll -----------------------------------
-- Eigener Schluessel (Produktkorrektur), damit dieser zweite Anlauf einen
-- eigenen Eintrag bekommt und nicht am schon vorhandenen Eintrag des
-- ersten Anlaufs (Referenzdaten (erzeugt)) scheitert.
insert into velocity.uebernahme_protokoll
       (lauf, quelle, ziel, gelesen, geschrieben, uebersprungen, hinweis)
select now(), 'Referenzdaten (Produktkorrektur)',
       'velocity.fahrradmodell, velocity.fahrrad',
       275, 275, 0,
       'Auf begründeten Kundeneinwand von neun Modellvarianten auf genau '
       'EIN Produkt je Typ zurückgeführt (City-Bike, E-Bike Sport, '
       'E-Cargo Loader - dieselben Namen wie fahrradtyp.bezeichnung), '
       'weiterhin gefertigt von fünf Herstellern über fünf Modellzeilen. '
       'Technische Angaben (Gewicht, Gangzahl, Rahmenhöhe, Akku, '
       'Reichweite) stehen seit der Schemakorrektur in '
       '0003_bereich_b_netz_und_flotte.sql an fahrradtyp, EIN Wert je '
       'Typ statt vorher neun - sie hingen für den Kunden erkennbar '
       'nicht am Preis, der ohnehin am Typ hängt. Kein Rad wechselt '
       'dabei den Hersteller.'
 where not exists (
   select 1 from velocity.uebernahme_protokoll
    where quelle = 'Referenzdaten (Produktkorrektur)'
      and ziel = 'velocity.fahrradmodell, velocity.fahrrad'
 );

commit;

-- ---- Kontrolle -----------------------------------------------------
do $$
declare
  v_unbekannt      integer;
  v_city           integer;
  v_ebike          integer;
  v_cargo          integer;
  v_anzahl_modelle integer;
  v_falsch_benannt integer;
  v_baujahre       integer;
begin
  select count(*) into v_unbekannt
    from velocity.fahrrad f
    join velocity.fahrradmodell mo on mo.modell_id = f.modell_id
    join velocity.hersteller    h  on h.hersteller_id = mo.hersteller_id
   where h.name = 'unbekannt';
  if v_unbekannt > 0 then
    raise exception 'Noch % Räder hängen am Hersteller-Platzhalter unbekannt', v_unbekannt;
  end if;

  if exists (select 1 from velocity.hersteller where name = 'unbekannt') then
    raise exception 'Der Hersteller-Platzhalter unbekannt existiert noch';
  end if;

  select count(*) filter (where t.typ_code = 'CITY')  into v_city
    from velocity.fahrrad f join velocity.fahrradmodell mo on mo.modell_id = f.modell_id
                            join velocity.fahrradtyp t on t.typ_id = mo.typ_id;
  select count(*) filter (where t.typ_code = 'EBIKE') into v_ebike
    from velocity.fahrrad f join velocity.fahrradmodell mo on mo.modell_id = f.modell_id
                            join velocity.fahrradtyp t on t.typ_id = mo.typ_id;
  select count(*) filter (where t.typ_code = 'CARGO') into v_cargo
    from velocity.fahrrad f join velocity.fahrradmodell mo on mo.modell_id = f.modell_id
                            join velocity.fahrradtyp t on t.typ_id = mo.typ_id;

  if (v_city, v_ebike, v_cargo) is distinct from (198, 52, 25) then
    raise exception 'Bestand je Typ hat sich verschoben: City %, E-Bike %, Cargo %',
      v_city, v_ebike, v_cargo;
  end if;

  select count(*) into v_anzahl_modelle from velocity.fahrradmodell;
  if v_anzahl_modelle <> 5 then
    raise exception 'Es sollten genau fünf Modellzeilen stehen (eine je Hersteller), gefunden: %',
      v_anzahl_modelle;
  end if;

  select count(*) into v_falsch_benannt
    from velocity.fahrradmodell mo
    join velocity.fahrradtyp    t  on t.typ_id = mo.typ_id
   where mo.modellbezeichnung <> t.bezeichnung;
  if v_falsch_benannt > 0 then
    raise exception '% Modellzeile(n) tragen nicht den Produktnamen ihres Typs', v_falsch_benannt;
  end if;

  select count(distinct baujahr) into v_baujahre from velocity.fahrradmodell where baujahr is not null;
  if v_baujahre < 3 then
    raise exception 'Baujahre sind kaum gestreut: nur % verschiedene Werte', v_baujahre;
  end if;

  raise notice 'Flottenprodukte stehen: City %, E-Bike %, Cargo % - % Modellzeilen (Hersteller) mit % verschiedenen Baujahren',
    v_city, v_ebike, v_cargo, v_anzahl_modelle, v_baujahre;
end;
$$;

-- ---- Ruecknahme ------------------------------------------------------
-- Stellt die neun feingliedrigen Modellzeilen des ersten Anlaufs wieder
-- her (nicht den urspruenglichen 'unbekannt'-Platzhalter davor - dafuer
-- siehe die Ruecknahme im ersten Anlauf, per Git-Historie dieser Datei).
-- insert into velocity.fahrradmodell
--        (hersteller_id, typ_id, modellbezeichnung, baujahr,
--         gewicht_kg, gangzahl, rahmenhoehe_cm, akkukapazitaet_wh, reichweite_km)
-- -- HINWEIS: gewicht_kg usw. gibt es an fahrradmodell nach der
-- -- Schemakorrektur nicht mehr - eine echte Ruecknahme muesste zuerst
-- -- 0003_bereich_b_netz_und_flotte.sql zurueckrollen (Spalten zurueck an
-- -- fahrradmodell, siehe deren Ruecknahmehinweis).
-- select h.hersteller_id, t.typ_id, v.modellbezeichnung, v.baujahr, null, null, null, null, null
--   from (values
--     ('Nordwind Rad',       'CITY',  'CityLine 1',  2021), ('Nordwind Rad',       'CITY',  'CityLine 2',  2023),
--     ('Kvarner Bike Works', 'CITY',  'Urbano S',    2024), ('Kvarner Bike Works', 'CITY',  'Urbano X',    2025),
--     ('Kaskade Cycles',     'EBIKE', 'Pulse 400',   2022), ('Kaskade Cycles',     'EBIKE', 'Pulse 500',   2024),
--     ('Vantaa Motion',      'EBIKE', 'Spark E',     2025),
--     ('Loire Manufaktur',   'CARGO', 'Porteur L',   2022), ('Loire Manufaktur',   'CARGO', 'Porteur XL',  2024)
--   ) as v(hersteller, typ_code, modellbezeichnung, baujahr)
--   join velocity.hersteller h on h.name     = v.hersteller
--   join velocity.fahrradtyp t on t.typ_code = v.typ_code
-- on conflict (hersteller_id, modellbezeichnung) do nothing;
-- -- Raeder zurueckhaengen erfordert dieselbe rang/kontingent-Verteilung
-- -- wie in Block 3 oben, nur mit den neun feinen Kontingenten von damals.
-- delete from velocity.uebernahme_protokoll
--  where quelle = 'Referenzdaten (Produktkorrektur)'
--    and ziel = 'velocity.fahrradmodell, velocity.fahrrad';
