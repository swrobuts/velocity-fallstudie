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
--  Die Punkte stammen aus einem versetzten Raster ueber das Gebiet,
--  jeder einzeln gegen fn_im_geschaeftsgebiet geprueft - keine
--  Zufallszahl, die danebengehen koennte. Ein frueherer Versuch legte
--  sie auf Verbindungslinien zwischen je zwei Stationen; die kreuzen
--  sich alle im Zentrum, und auf der Karte wurde daraus ein Klumpen.
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
    (456, 49.771731, 9.929423),
    (480, 49.775192, 9.919615),
    (486, 49.775192, 9.932692),
    (487, 49.775192, 9.952308),
    (491, 49.778654, 9.916346),
    (493, 49.778654, 9.929423),
    (499, 49.778654, 9.949038),
    (506, 49.778654, 9.962115),
    (510, 49.782115, 9.913077),
    (519, 49.782115, 9.926154),
    (521, 49.782115, 9.939231),
    (524, 49.782115, 9.958846),
    (528, 49.782115, 9.971923),
    (529, 49.785577, 9.909808),
    (531, 49.785577, 9.929423),
    (533, 49.785577, 9.942500),
    (537, 49.785577, 9.962115),
    (539, 49.785577, 9.975192),
    (541, 49.789038, 9.906538),
    (550, 49.789038, 9.926154),
    (552, 49.789038, 9.939231),
    (554, 49.789038, 9.952308),
    (555, 49.789038, 9.971923),
    (556, 49.792500, 9.903269),
    (557, 49.792500, 9.922885),
    (558, 49.792500, 9.935962),
    (559, 49.792500, 9.949038),
    (561, 49.792500, 9.968654),
    (562, 49.795962, 9.913077),
    (564, 49.795962, 9.926154),
    (565, 49.795962, 9.945769),
    (567, 49.795962, 9.958846),
    (570, 49.799423, 9.916346),
    (572, 49.799423, 9.929423),
    (576, 49.799423, 9.942500),
    (579, 49.799423, 9.962115),
    (583, 49.802885, 9.919615),
    (584, 49.802885, 9.932692),
    (586, 49.802885, 9.952308),
    (588, 49.806346, 9.916346),
    (593, 49.806346, 9.935962),
    (600, 49.806346, 9.949038),
    (602, 49.809808, 9.919615),
    (603, 49.809808, 9.939231),
    (606, 49.813269, 9.929423)
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
