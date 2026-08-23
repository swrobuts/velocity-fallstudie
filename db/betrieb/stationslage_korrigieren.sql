-- =====================================================================
--  Stationslage: Koordinaten korrigieren, Hoehe setzen
--
--  Zwei getrennte Anliegen, die dieselbe Spaltengruppe betreffen.
--
--  1. VIER KOORDINATEN WAREN FALSCH.
--     Die Altdaten aus cityBikesRental verorten Dom, Sanderau,
--     Grombuehl und Zellerau um 0,7 bis 1,8 Kilometer daneben, in drei
--     Faellen auf den Marienberg westlich des Mains. Die Live-Karte
--     zeigte diese Stationen damit an Stellen, an denen sie nicht sind -
--     in einer Wuerzburger Vorlesung faellt das sofort auf.
--     Aufgefallen ist es erst, als die Hoehen dazukamen: eine Sanderau
--     auf 267 Metern gibt es nicht, das Viertel liegt am Fluss.
--     Die Altdaten selbst bleiben unangetastet; die Korrektur steht
--     hier, nach der Uebernahme, und ist damit nachvollziehbar.
--
--  2. DIE HOEHE IST NEU.
--     Bestimmt gegen zwei unabhaengige Gelaendemodelle und gemittelt:
--       Copernicus GLO-30  ueber api.open-meteo.com/v1/elevation
--       EU-DEM v1.1        ueber api.opentopodata.org/v1/eudem25m
--     Beides sind Oberflaechenmodelle. Sie rechnen Bebauung mit und
--     liegen in der Altstadt rund zehn Meter zu hoch. Die absoluten
--     Werte sind deshalb NICHT als Hoehe ueber NHN zu lesen. Belastbar
--     sind die Unterschiede: zwischen der tiefsten und der hoechsten
--     Wuerzburger Station liegen rund hundert Meter, und das deckt sich
--     mit der getrennten Pruefung an Alter Mainbruecke und Hubland.
--     Die beiden Modelle weichen an allen dreizehn Stationen um
--     weniger als fuenf Meter voneinander ab.
--
--  Idempotent: mehrfach ausfuehrbar, setzt jedes Mal denselben Zustand.
--  Ruecknahme: update velocity.station set hoehe_m = null;
--              Koordinaten aus db/legacy/ zurueckspielen.
-- =====================================================================

begin;

-- ---- 1. Koordinaten ------------------------------------------------
update velocity.station s set latitude = k.lat, longitude = k.lon
  from (values
    ('S-0006', 49.793800, 9.932200),   -- Kiliansdom, war 49.7920 / 9.9220
    ('S-0007', 49.781800, 9.941200),   -- Sanderau,   war 49.7850 / 9.9150
    ('S-0009', 49.804600, 9.942400),   -- Grombuehl,  war 49.8050 / 9.9550
    ('S-0010', 49.796500, 9.914200)    -- Zellerau,   war 49.8100 / 9.9050
  ) as k(nr, lat, lon)
 where s.stationsnummer = k.nr
   and (s.latitude is distinct from k.lat or s.longitude is distinct from k.lon);

-- ---- 2. Hoehenlage --------------------------------------------------
update velocity.station s set hoehe_m = h.m
  from (values
    ('S-0001', 182), ('S-0002', 181), ('S-0003', 188), ('S-0004', 188),
    ('S-0005', 180), ('S-0006', 186), ('S-0007', 192), ('S-0008', 279),
    ('S-0009', 210), ('S-0010', 186), ('S-0011', 230), ('S-0012', 227),
    ('S-0013', 239)
  ) as h(nr, m)
 where s.stationsnummer = h.nr
   and s.hoehe_m is distinct from h.m;

commit;

-- ---- Kontrolle -------------------------------------------------------
select s.stationsnummer, s.name, a.ort, s.hoehe_m,
       s.hoehe_m - min(s.hoehe_m) filter (where a.ort = 'Würzburg')
                   over ()                       as ueber_tiefster_station
  from velocity.station s
  join velocity.adresse a on a.adresse_id = s.adresse_id
 order by a.ort, s.hoehe_m;
