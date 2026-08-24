-- =====================================================================
--  FLOTTENVERTEILUNG
--
--  Zwei Missstaende in den Altdaten, beide sichtbar auf der Karte:
--
--  1. ACHT VON ZEHN STATIONEN WAREN UEBERFUELLT. Am Dom standen 30
--     Raeder auf 10 Stellplaetzen. Die Sicht v_station kaschierte das,
--     weil freie_stellplaetze bei null kappt - die Zahl war nie
--     negativ, aber eben auch nie wahr.
--
--  2. KEIN EINZIGES RAD STAND FREI. Dabei muss ein Rad gar nicht an
--     einer Station abgegeben werden; innerhalb des Geschaeftsgebiets
--     darf es ueberall stehen (GR14). Die Karte zeigte diese
--     Abstellart nie, weil es sie in den Daten nicht gab.
--
--  Die Kapazitaeten sind nach dem Charakter der Station gesetzt -
--  Hauptbahnhof und Campus tragen am meisten - und die ueberzaehligen
--  Raeder werden frei im Stadtgebiet verteilt, bis jede Station bei
--  rund zwei Dritteln liegt.
--
--  Die Punkte liegen auf Verbindungslinien zwischen je zwei Stationen.
--  Das Geschaeftsgebiet ist konvex, deshalb liegt jeder solche Punkt
--  zwangslaeufig darin - keine Zufallszahl, die danebengehen koennte.
--  Jeder Punkt wurde zusaetzlich gegen fn_im_geschaeftsgebiet geprueft.
--
--  Nur Raeder mit Status verfuegbar wandern. Wartung und Defekt bleiben
--  an ihrer Station, ausgeliehene haben ohnehin keinen Standort (GR13).
--
--  Idempotent: die Werte sind fest, ein zweiter Lauf setzt denselben
--  Zustand. Ruecknahme: Kapazitaeten aus db/legacy/ zurueckspielen und
--  die Positionen erneut aus der Uebernahme aufbauen.
-- =====================================================================

begin;

-- ---- 1. Kapazitaeten ------------------------------------------------
update velocity.station s set kapazitaet = k.kap
  from (values
    ('S-0001', 40),
    ('S-0002', 25),
    ('S-0003', 35),
    ('S-0004', 25),
    ('S-0005', 30),
    ('S-0006', 25),
    ('S-0007', 30),
    ('S-0008', 40),
    ('S-0009', 25),
    ('S-0010', 20),
    -- Schweinfurt: dort gibt es kein Geschaeftsgebiet, also kann nichts
    -- frei abgestellt werden. Diese drei Stationen bekommen nur
    -- ausreichend Stellplaetze - sonst blieben sie ueberfuellt.
    ('S-0011', 40),
    ('S-0012', 40),
    ('S-0013', 40)
  ) as k(nr, kap)
 where s.stationsnummer = k.nr and s.kapazitaet is distinct from k.kap;

-- ---- 2. Ueberzaehlige Raeder frei abstellen -------------------------
-- station_id auf NULL, Koordinaten gesetzt: genau ein Ort je Rad (GR13).
update velocity.fahrrad_position p
   set station_id = null, latitude = f.lat, longitude = f.lon,
       aktualisiert_am = now()
  from (values
    (524, 49.800550, 9.934666),
    (567, 49.795405, 9.928558),
    (486, 49.785396, 9.948952),
    (487, 49.800298, 9.936376),
    (521, 49.794308, 9.934204),
    (529, 49.790104, 9.934972),
    (559, 49.792913, 9.920788),
    (603, 49.784500, 9.953650),
    (555, 49.801965, 9.939911),
    (564, 49.802105, 9.933714),
    (583, 49.798630, 9.933053),
    (480, 49.794688, 9.929230),
    (491, 49.783604, 9.958348),
    (499, 49.796311, 9.937810),
    (506, 49.793540, 9.937020),
    (539, 49.787032, 9.937276),
    (541, 49.786328, 9.932884),
    (552, 49.786292, 9.944255),
    (554, 49.799200, 9.937300),
    (565, 49.798476, 9.921081),
    (579, 49.796710, 9.931440),
    (584, 49.795098, 9.928846),
    (602, 49.786740, 9.941906),
    (537, 49.798589, 9.936990),
    (550, 49.794884, 9.932092),
    (557, 49.783960, 9.939580),
    (561, 49.790091, 9.925972),
    (572, 49.783156, 9.960696),
    (588, 49.796435, 9.934689),
    (593, 49.800550, 9.928300),
    (606, 49.800070, 9.934263),
    (528, 49.795507, 9.928462),
    (531, 49.784948, 9.951301),
    (562, 49.794602, 9.938424),
    (600, 49.794116, 9.934908),
    (456, 49.789336, 9.935548),
    (493, 49.793854, 9.919060),
    (510, 49.784948, 9.951301),
    (519, 49.801274, 9.939258),
    (533, 49.802624, 9.935519),
    (556, 49.798150, 9.932650),
    (558, 49.794790, 9.929134),
    (570, 49.783156, 9.960696),
    (576, 49.796880, 9.937605),
    (586, 49.795460, 9.929980)
  ) as f(rad, lat, lon)
 where p.fahrrad_id = f.rad
   and (p.station_id is not null
        or p.latitude is distinct from f.lat
        or p.longitude is distinct from f.lon);

commit;

-- ---- Kontrolle -------------------------------------------------------
select s.name, s.kapazitaet,
       count(p.fahrrad_id)                            as raeder_dort,
       s.kapazitaet - count(p.fahrrad_id)             as freie_plaetze
  from velocity.station s
  join velocity.adresse a on a.adresse_id = s.adresse_id
  left join velocity.fahrrad_position p on p.station_id = s.station_id
 where a.ort = 'Würzburg'
 group by s.station_id, s.name, s.kapazitaet
 order by s.name;
