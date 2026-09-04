-- =====================================================================
-- 0021 Wartungsprognose
--
-- Zweck:      Die Idee aus Notebook 2 - "wer am meisten gearbeitet hat,
--             seit er zuletzt repariert wurde, wird zuerst geprueft" -
--             als Bestandteil der Datenbank, damit die Werkstatt die
--             Liste in der Warenwirtschaft sieht und nicht in einer CSV.
--             Die Liste wird zu einem Stichtag EINGEFROREN. Nur so
--             laesst sie sich nach 90 Tagen daran messen, was wirklich
--             passiert ist; eine Sicht, die sich staendig neu berechnet,
--             kann man nicht nachpruefen.
-- Objekte:    velocity.wartungsprognose,
--             velocity.fn_wartungsprognose(date,int),
--             velocity.api_wartungsprognose_erzeugen(date,int),
--             velocity.v_wawi_wartungsprognose
-- Ruecknahme: DROP VIEW velocity.v_wawi_wartungsprognose;
--             DROP FUNCTION velocity.api_wartungsprognose_erzeugen(date,int);
--             DROP FUNCTION velocity.fn_wartungsprognose(date,int);
--             DROP TABLE velocity.wartungsprognose;
--
-- ---------------------------------------------------------------------
-- DIE REGEL AUS NOTEBOOK 2 LAESST SICH HIER NICHT ABSCHREIBEN
--
-- Notebook 2 rangiert nach KILOMETERN seit der letzten erledigten
-- Reparatur. Drei Messungen am Bestand dieser Datenbank (04.09.2026,
-- 278 Raeder, 12.052 abgeschlossene Fahrten) zeigen, warum diese
-- Formulierung hier etwas anderes bedeuten wuerde als dort.
--
-- ERSTENS: distanz_km fehlt bei 40 % der Fahrten - und zwar ungleich.
-- Je Rad liegt der Anteil gefuellter Werte zwischen 37 % und 82 %. Eine
-- Summe der bekannten Kilometer sortierte die Raeder also vor allem
-- danach, wie oft zufaellig gemessen wurde: eine Rangfolge der
-- Datenqualitaet, nicht des Verschleisses. dauer_minuten dagegen ist bei
-- allen 12.052 Fahrten gefuellt und haengt eng an der Strecke - auf den
-- Fahrten mit beidem betraegt die Korrelation r = 0,928 bei 13,7 km/h
-- im Mittel. Die Fahrzeit misst im Kern dasselbe, nur vollstaendig.
-- Umgerechnet wird sie NICHT: 13,7 km/h mal Minuten ergaebe eine Zahl,
-- die wie eine Messung aussieht und keine ist.
--
-- ZWEITENS: Rohe Fahrzeit rangiert den TYP, nicht das Rad. Eine
-- Lastenradfahrt dauert im Mittel 39 Minuten, eine Cityradfahrt 19. Die
-- Top 60 nach roher Fahrzeit enthielten 96 % aller Lastenraeder und 4 %
-- der Cityraeder - das ist keine Prioritaetenliste, das ist eine
-- Typenpolitik, fuer die niemand rechnen muss. Deshalb wird durch den
-- MEDIAN DES TYPS geteilt. Die Rangfolge entsteht damit INNERHALB des
-- Typs, und die Zahl ist lesbar: 1,47 heisst "dieses Rad hat halb so
-- viel mehr gearbeitet wie ein durchschnittliches Rad seiner Art".
--
-- DRITTENS: Eine einzige nicht beendete Ausleihe kippt die Liste. Rad
-- EB-00447 stand mit 6.435 Minuten auf Platz 1 - davon 5.422 aus EINER
-- Fahrt ueber 90 Stunden, bei sonst 50 bis 59 Minuten. In der ganzen
-- Flotte gibt es nur zwei Fahrten ueber 300 Minuten. Jede Fahrt wird
-- deshalb bei FAHRT_DECKEL_MINUTEN gekappt: Was laenger dauert, ist ein
-- Buchungsproblem und kein Verschleiss. EB-00447 steht danach auf 52.
--
-- ---------------------------------------------------------------------
-- WAS DIESE LISTE NICHT IST
--
-- Sie ist keine Freigabe. Notebook 2 hat seine Regel an einem Bestand
-- mit tausenden Schadensmeldungen gemessen; hier stehen sieben
-- Meldungen und zwei erledigte Reparaturen. Fuer 276 der 278 Raeder
-- heisst "seit der letzten Reparatur" deshalb schlicht "seit der
-- Anschaffung". Die Liste ist damit vorerst eine Rangfolge nach
-- Nutzung. Ob sie taugt, entscheidet der Abgleich nach 90 Tagen -
-- dafuer wird sie eingefroren, und dafuer traegt sie betriebsmodus.
-- =====================================================================

-- ---- Tabelle ---------------------------------------------------------
create table if not exists velocity.wartungsprognose (
  wartungsprognose_id        bigint generated always as identity primary key,
  stichtag                   date          not null,
  fahrrad_id                 bigint        not null,
  rang                       int           not null,
  nutzungsquote              numeric(8,3)  not null,
  fahrminuten_seit_reparatur numeric(12,1) not null,
  typ_median_minuten         numeric(12,1) not null,
  fahrten_seit_reparatur     int           not null,
  fahrminuten_180            numeric(12,1) not null,
  km_gemessen                numeric(12,2),
  anteil_mit_distanz         numeric(4,3),
  letzte_reparatur           date,
  meldungen_bisher           int           not null default 0,
  regelversion               text          not null,
  gilt_bis                   date          not null,
  betriebsmodus              text          not null default 'probelauf',
  erstellt_am                timestamptz   not null default now(),
  -- geaendert_am gehoert dazu, weil fn_audit_anhaengen beide Spalten
  -- setzt. Eine Prognosezeile aendert sich zwar nicht mehr - aber der
  -- Trigger ist derselbe wie ueberall, und eine Tabelle, die aus der
  -- Reihe faellt, faellt beim naechsten Mal wieder auf.
  geaendert_am               timestamptz   not null default now(),
  -- Ein Rad steht je Stichtag hoechstens einmal auf der Liste, und ein
  -- Platz ist je Stichtag hoechstens einmal vergeben. Beides ist keine
  -- Formalie: ohne diese Schluessel koennte ein zweiter Lauf dieselbe
  -- Liste verdoppeln, und niemand saehe es der Tabelle an.
  constraint wartungsprognose_rad_uk  unique (stichtag, fahrrad_id),
  constraint wartungsprognose_rang_uk unique (stichtag, rang),
  constraint wartungsprognose_rang_chk check (rang >= 1),
  constraint wartungsprognose_gilt_chk check (gilt_bis > stichtag),
  constraint wartungsprognose_quote_chk check (nutzungsquote >= 0),
  -- 'probelauf' heisst: die Liste laeuft mit und ordnet nichts an.
  -- 'verbindlich' waere der Zustand nach einer bestandenen Nachpruefung.
  constraint wartungsprognose_modus_chk
    check (betriebsmodus in ('probelauf', 'verbindlich')),
  constraint wartungsprognose_fahrrad_fk foreign key (fahrrad_id)
    references velocity.fahrrad (fahrrad_id) on update cascade on delete restrict
);
alter table velocity.wartungsprognose enable row level security;
alter table velocity.wartungsprognose force  row level security;
select velocity.fn_audit_anhaengen('wartungsprognose');

create index if not exists idx_wartungsprognose_stichtag
  on velocity.wartungsprognose (stichtag, rang);

comment on table velocity.wartungsprognose is
  'Eingefrorene Prüfliste der Werkstatt zu einem Stichtag: je Zeile ein Rad mit seinem Platz. '
  'Wird nicht neu berechnet, damit sie nach Ablauf von gilt_bis nachprüfbar bleibt. '
  'Siehe Kopfkommentar von 0021_wartungsprognose.sql.';
comment on column velocity.wartungsprognose.stichtag is 'Tag, für den die Liste gerechnet wurde. Zusammen mit rang bzw. fahrrad_id eindeutig.';
comment on column velocity.wartungsprognose.rang is 'Platz auf der Liste, 1 = zuerst prüfen. Ergibt sich aus nutzungsquote, absteigend.';
comment on column velocity.wartungsprognose.nutzungsquote is 'Der Rangwert: Fahrminuten seit der letzten Reparatur, geteilt durch den Median des Radtyps. 1,4 heißt "40 % mehr gearbeitet als ein durchschnittliches Rad seiner Art". Ohne diese Normierung rangiert die Liste den Typ statt das Rad, siehe Kopfkommentar.';
comment on column velocity.wartungsprognose.fahrminuten_seit_reparatur is 'Summe der Fahrminuten seit der letzten ERLEDIGTEN Reparatur, je Fahrt bei 300 Minuten gekappt. Nicht seit der Meldung: zwischen Meldung und Reparatur wird weitergefahren, und diese Zeit geht auf das alte Bauteil.';
comment on column velocity.wartungsprognose.typ_median_minuten is 'Der Nenner der nutzungsquote: Median derselben Größe über alle Räder dieses Typs. Mitgespeichert, damit die Quote später nachrechenbar bleibt.';
comment on column velocity.wartungsprognose.km_gemessen is 'Gemessene Kilometer im selben Zeitraum - Zusatzangabe, nicht der Rangwert. Unvollständig, deshalb steht anteil_mit_distanz daneben.';
comment on column velocity.wartungsprognose.anteil_mit_distanz is 'Anteil der Fahrten seit der letzten Reparatur, die eine Strecke gemeldet haben. Sagt, wieviel km_gemessen wert ist.';
comment on column velocity.wartungsprognose.letzte_reparatur is 'Tag der letzten erledigten Reparatur, NULL wenn das Rad noch nie repariert wurde.';
comment on column velocity.wartungsprognose.gilt_bis is 'Ende des Vorhersagefensters. Erst danach lässt sich die Liste an dem messen, was tatsächlich eingetreten ist.';
comment on column velocity.wartungsprognose.betriebsmodus is 'probelauf: die Liste läuft mit und ordnet keine Reparatur an. verbindlich: erst nach bestandener Nachprüfung.';
comment on column velocity.wartungsprognose.wartungsprognose_id is 'Surrogatschlüssel, fachlich bedeutungslos und deshalb stabil.';
comment on column velocity.wartungsprognose.fahrrad_id is 'Das Rad, das geprüft werden soll.';
comment on column velocity.wartungsprognose.fahrten_seit_reparatur is 'Zahl der Fahrten seit der letzten erledigten Reparatur - sagt, auf wievielen Fahrten die Fahrminuten beruhen.';
comment on column velocity.wartungsprognose.fahrminuten_180 is 'Fahrminuten der letzten 180 Tage, unabhängig von der Reparatur. Zeigt, ob ein Rad gerade viel läuft oder seine Minuten aus einer älteren Phase stammen.';
comment on column velocity.wartungsprognose.meldungen_bisher is 'Zahl der bisherigen Schadensmeldungen dieses Rades bis zum Stichtag.';
comment on column velocity.wartungsprognose.geaendert_am is 'Zeitpunkt der letzten Änderung, gesetzt von fn_audit_anhaengen.';
comment on column velocity.wartungsprognose.erstellt_am is 'Zeitpunkt des Einfrierens.';
comment on column velocity.wartungsprognose.regelversion is 'Welche Regel die Reihenfolge bestimmt hat. Ändert sich die Regel, ändert sich dieser Wert - alte Listen bleiben damit lesbar.';

-- ---- Die Regel -------------------------------------------------------
-- Sie steht als Funktion da und nicht als Sicht, weil sie einen
-- Stichtag braucht: Jede Zahl darin ist eine Zahl VON DIESEM TAG.
create or replace function velocity.fn_wartungsprognose(
    p_stichtag   date,
    p_kapazitaet int default 60)
returns table (
    rang                       int,
    fahrrad_id                 bigint,
    nutzungsquote              numeric,
    fahrminuten_seit_reparatur numeric,
    typ_median_minuten         numeric,
    fahrten_seit_reparatur     int,
    fahrminuten_180            numeric,
    km_gemessen                numeric,
    anteil_mit_distanz         numeric,
    letzte_reparatur           date,
    meldungen_bisher           int)
language sql
stable
as $$
with kappe as (select 300::numeric as fahrt_deckel_minuten),
letzte_rep as (
    -- Nur ERLEDIGTE Auftraege, und nur solche, die am Stichtag schon
    -- erledigt WAREN. Ein Auftrag, der spaeter fertig wird, darf die
    -- Rechnung von heute nicht beeinflussen.
    select w.fahrrad_id, max(w.erledigt_am)::date as erledigt_am
      from velocity.wartungsauftrag w
     where w.erledigt_am is not null
       and w.erledigt_am::date <= p_stichtag
     group by w.fahrrad_id),
offene_schaeden as (
    -- Ein Rad mit gemeldetem, am Stichtag noch nicht erledigtem Schaden
    -- muss ohnehin in die Werkstatt. Es auf die Vorsorgeliste zu setzen
    -- verbraucht einen Platz fuer eine Entscheidung, die schon gefallen
    -- ist. Gefragt wird nach dem AUFTRAG, nicht nach
    -- schadensmeldung.status - der Status gilt heute, der Auftrag traegt
    -- ein Datum und laesst sich damit auf den Stichtag zuruecklesen.
    select distinct sm.fahrrad_id
      from velocity.schadensmeldung sm
      left join velocity.wartungsauftrag w
             on w.schadensmeldung_id = sm.schadensmeldung_id
     where sm.gemeldet_am::date <= p_stichtag
       and (w.erledigt_am is null or w.erledigt_am::date > p_stichtag)),
bestand as (
    select f.fahrrad_id, t.typ_code
      from velocity.fahrrad       f
      join velocity.fahrradmodell mo on mo.modell_id = f.modell_id
      join velocity.fahrradtyp    t  on t.typ_id     = mo.typ_id
     where f.status <> 'ausgemustert'
       and (f.ausgemustert_am is null or f.ausgemustert_am > p_stichtag)),
fahrt as (
    select l.fahrrad_id, l.startzeit,
           least(l.dauer_minuten, k.fahrt_deckel_minuten) as minuten,
           l.distanz_km
      from velocity.ausleihe l
     cross join kappe k
     where l.status = 'abgeschlossen'
       and l.startzeit::date <= p_stichtag),
je_rad as (
    select b.fahrrad_id,
           b.typ_code,
           r.erledigt_am as letzte_reparatur,
           -- nullen-sind-echt: Ein Rad ohne Fahrt seit der Reparatur hat
           -- davon null gefahrene Minuten. Die Zeile fehlt nur, weil
           -- nichts geschehen ist - das ist eine Aussage, kein Fehlwert.
           coalesce(sum(t.minuten) filter (
               where r.erledigt_am is null
                  or t.startzeit::date > r.erledigt_am), 0)::numeric
                                                     as minuten_seit,
           coalesce(count(t.fahrrad_id) filter (
               where r.erledigt_am is null
                  or t.startzeit::date > r.erledigt_am), 0)::int
                                                     as fahrten_seit,
           coalesce(sum(t.minuten) filter (
               where t.startzeit::date > p_stichtag - 180), 0)::numeric
                                                     as minuten_180,
           sum(t.distanz_km) filter (
               where r.erledigt_am is null
                  or t.startzeit::date > r.erledigt_am)::numeric
                                                     as km_gemessen,
           -- Wieviel ist km_gemessen wert? Genau dieser Anteil.
           (count(t.distanz_km) filter (
               where r.erledigt_am is null
                  or t.startzeit::date > r.erledigt_am)::numeric
            / nullif(count(t.fahrrad_id) filter (
               where r.erledigt_am is null
                  or t.startzeit::date > r.erledigt_am), 0))
                                                     as anteil_mit_distanz,
           (select count(*)::int from velocity.schadensmeldung sm
             where sm.fahrrad_id = b.fahrrad_id
               and sm.gemeldet_am::date <= p_stichtag) as meldungen_bisher
      from bestand b
      left join letzte_rep r on r.fahrrad_id = b.fahrrad_id
      left join fahrt      t on t.fahrrad_id = b.fahrrad_id
     group by b.fahrrad_id, b.typ_code, r.erledigt_am),
typ_median as (
    -- Der Median laeuft ueber ALLE Raeder des Typs, auch ueber die mit
    -- offenem Schaden. Er ist der Massstab des Typs und soll nicht davon
    -- abhaengen, wer gerade in der Werkstatt steht.
    select j.typ_code,
           (percentile_cont(0.5) within group (order by j.minuten_seit))::numeric
             as median_minuten
      from je_rad j
     group by j.typ_code)
select (row_number() over (
          order by j.minuten_seit / nullif(m.median_minuten, 0) desc nulls last,
                   j.fahrrad_id))::int                      as rang,
       j.fahrrad_id,
       round(j.minuten_seit / nullif(m.median_minuten, 0), 3) as nutzungsquote,
       round(j.minuten_seit, 1)                             as fahrminuten_seit_reparatur,
       round(m.median_minuten, 1)                           as typ_median_minuten,
       j.fahrten_seit                                       as fahrten_seit_reparatur,
       round(j.minuten_180, 1)                              as fahrminuten_180,
       round(j.km_gemessen, 2)                              as km_gemessen,
       round(j.anteil_mit_distanz, 3)                       as anteil_mit_distanz,
       j.letzte_reparatur,
       j.meldungen_bisher
  from je_rad j
  join typ_median m on m.typ_code = j.typ_code
 where not exists (select 1 from offene_schaeden o
                    where o.fahrrad_id = j.fahrrad_id)
   and m.median_minuten > 0
 order by j.minuten_seit / nullif(m.median_minuten, 0) desc nulls last, j.fahrrad_id
 limit p_kapazitaet;
$$;

comment on function velocity.fn_wartungsprognose(date, int) is
  'Rechnet die Prüfliste für einen Stichtag: die p_kapazitaet Räder mit der höchsten '
  'Nutzungsquote - Fahrminuten seit der letzten erledigten Reparatur, gemessen am Median '
  'ihres Radtyps. Räder mit offenem Schaden und ausgemusterte Räder bleiben draußen. '
  'Nur Rechnung, kein Schreiben.';

-- ---- Einfrieren ------------------------------------------------------
create or replace function velocity.api_wartungsprognose_erzeugen(
    p_stichtag   date default current_date,
    p_kapazitaet int  default 60)
returns int
language plpgsql
security definer
set search_path = velocity, pg_temp
as $$
declare
  v_anzahl int;
begin
  if not (velocity.hat_rolle('werkstatt') or velocity.hat_rolle('leitung')) then
    raise exception 'Nur Werkstatt oder Leitung dürfen eine Prüfliste erzeugen'
      using errcode = '42501';
  end if;
  if p_kapazitaet < 1 or p_kapazitaet > 500 then
    raise exception 'Kapazität muss zwischen 1 und 500 liegen, nicht %', p_kapazitaet
      using errcode = '22023';
  end if;
  -- EINE EINGEFRORENE LISTE WIRD NICHT UEBERSCHRIEBEN. Sie ist die
  -- Aufzeichnung dessen, was an diesem Tag vorhergesagt wurde; wer sie
  -- ersetzt, loescht den Massstab, an dem die Regel gemessen werden
  -- soll. Ein zweiter Lauf am selben Tag ist deshalb ein Fehler und
  -- kein stiller Ersatz.
  if exists (select 1 from velocity.wartungsprognose
              where stichtag = p_stichtag) then
    raise exception 'Für den % gibt es bereits eine Prüfliste. Eine eingefrorene '
                    'Liste wird nicht überschrieben.', p_stichtag
      using errcode = '23505';
  end if;

  insert into velocity.wartungsprognose (
      stichtag, fahrrad_id, rang, nutzungsquote, fahrminuten_seit_reparatur,
      typ_median_minuten, fahrten_seit_reparatur, fahrminuten_180, km_gemessen,
      anteil_mit_distanz, letzte_reparatur, meldungen_bisher,
      regelversion, gilt_bis, betriebsmodus)
  select p_stichtag, p.fahrrad_id, p.rang, p.nutzungsquote,
         p.fahrminuten_seit_reparatur, p.typ_median_minuten,
         p.fahrten_seit_reparatur, p.fahrminuten_180, p.km_gemessen,
         p.anteil_mit_distanz, p.letzte_reparatur, p.meldungen_bisher,
         'nutzungsquote_typmedian', p_stichtag + 90, 'probelauf'
    from velocity.fn_wartungsprognose(p_stichtag, p_kapazitaet) p;

  get diagnostics v_anzahl = row_count;
  return v_anzahl;
end;
$$;

comment on function velocity.api_wartungsprognose_erzeugen(date, int) is
  'Friert die Prüfliste eines Stichtags ein. Nur für Werkstatt und Leitung. Weigert sich, '
  'eine vorhandene Liste zu überschreiben - sie ist der Maßstab für die spätere Nachprüfung.';

-- ---- Die Sicht für die Warenwirtschaft -------------------------------
create or replace view velocity.v_wawi_wartungsprognose as
select p.stichtag,
       p.rang,
       p.fahrrad_id,
       f.rahmennummer,
       t.typ_code,
       t.bezeichnung                as typ,
       f.status                     as radstatus,
       s.name                       as standort,
       p.nutzungsquote,
       p.fahrminuten_seit_reparatur,
       p.typ_median_minuten,
       p.fahrten_seit_reparatur,
       p.fahrminuten_180,
       p.km_gemessen,
       p.anteil_mit_distanz,
       p.letzte_reparatur,
       p.meldungen_bisher,
       p.regelversion,
       p.gilt_bis,
       p.betriebsmodus,
       -- Der Platz allein sagt der Werkstatt wenig. Was sie braucht, ist
       -- die Reihenfolge des Arbeitstags: zuerst, danach, wenn Zeit
       -- bleibt. Die Grenzen sind dieselben Zwanzigerbloecke, in denen
       -- Notebook 2 seine Trefferquoten misst.
       -- SCHNITTE, KEINE SCHWELLEN. Die Grenzen bei 20 und 40 teilen den
       -- Arbeitstag ein; in den Daten liegt dort nichts. Gemessen am
       -- 04.09.2026: zwischen Platz 20 und 21 drei Tausendstel der
       -- Nutzungsquote, zwischen 40 und 41 zwei - ueber die ganze Liste
       -- dagegen 0,33. Der groesste Abstand zwischen zwei Nachbarn liegt
       -- zwischen Platz 1 und 2 und damit gerade nicht auf einer Grenze.
       case when p.rang <= 20 then 'zuerst'
            when p.rang <= 40 then 'danach'
            else 'wenn Zeit bleibt' end as dringlichkeit
  from velocity.wartungsprognose p
  join velocity.fahrrad          f  on f.fahrrad_id = p.fahrrad_id
  join velocity.fahrradmodell    mo on mo.modell_id = f.modell_id
  join velocity.fahrradtyp       t  on t.typ_id     = mo.typ_id
  left join velocity.fahrrad_position fp on fp.fahrrad_id = f.fahrrad_id
  left join velocity.station          s  on s.station_id  = fp.station_id
 where velocity.hat_rolle('werkstatt')
    or velocity.hat_rolle('disposition')
    or velocity.hat_rolle('leitung')
    -- Demozugang wie bei v_wawi_flotte: reine Flottendaten, keine
    -- Personendaten. Siehe 0020_demo_zugang.sql.
    or velocity.hat_rolle('demo');

comment on view velocity.v_wawi_wartungsprognose is
  'Arbeitssicht der eingefrorenen Prüflisten: ein Rad je Zeile mit Platz, Dringlichkeit, '
  'Standort und den Zahlen, die den Platz begründen. Filtert selbst über velocity.hat_rolle.';

comment on column velocity.v_wawi_wartungsprognose.stichtag is 'Tag, für den die Liste gerechnet wurde.';
comment on column velocity.v_wawi_wartungsprognose.rang is 'Platz auf der Liste, 1 = zuerst prüfen.';
comment on column velocity.v_wawi_wartungsprognose.fahrrad_id is 'Das Rad, für den Sprung in die Flotte.';
comment on column velocity.v_wawi_wartungsprognose.rahmennummer is 'Die Nummer, unter der die Werkstatt das Rad sucht.';
comment on column velocity.v_wawi_wartungsprognose.typ_code is 'Kurzschlüssel des Radtyps (CITY, EBIKE, CARGO).';
comment on column velocity.v_wawi_wartungsprognose.typ is 'Ausgeschriebener Name des Radtyps.';
comment on column velocity.v_wawi_wartungsprognose.radstatus is 'Heutiger Status des Rades - kann sich seit dem Stichtag geändert haben.';
comment on column velocity.v_wawi_wartungsprognose.standort is 'Station, an der das Rad zuletzt stand. NULL, wenn es frei abgestellt wurde.';
comment on column velocity.v_wawi_wartungsprognose.nutzungsquote is 'Der Rangwert: Fahrminuten seit der Reparatur, geteilt durch den Median des Radtyps.';
comment on column velocity.v_wawi_wartungsprognose.fahrminuten_seit_reparatur is 'Der Zähler der Quote, je Fahrt bei 300 Minuten gekappt.';
comment on column velocity.v_wawi_wartungsprognose.typ_median_minuten is 'Der Nenner der Quote.';
comment on column velocity.v_wawi_wartungsprognose.fahrten_seit_reparatur is 'Auf wievielen Fahrten die Minuten beruhen.';
comment on column velocity.v_wawi_wartungsprognose.fahrminuten_180 is 'Fahrminuten der letzten 180 Tage.';
comment on column velocity.v_wawi_wartungsprognose.km_gemessen is 'Gemessene Kilometer im selben Zeitraum - Zusatzangabe, nicht der Rangwert.';
comment on column velocity.v_wawi_wartungsprognose.anteil_mit_distanz is 'Anteil der Fahrten mit gemeldeter Strecke. Sagt, wieviel km_gemessen wert ist.';
comment on column velocity.v_wawi_wartungsprognose.letzte_reparatur is 'Tag der letzten erledigten Reparatur, NULL wenn nie repariert.';
comment on column velocity.v_wawi_wartungsprognose.meldungen_bisher is 'Zahl der bisherigen Schadensmeldungen bis zum Stichtag.';
comment on column velocity.v_wawi_wartungsprognose.regelversion is 'Welche Regel die Reihenfolge bestimmt hat.';
comment on column velocity.v_wawi_wartungsprognose.gilt_bis is 'Ende des Vorhersagefensters.';
comment on column velocity.v_wawi_wartungsprognose.betriebsmodus is 'probelauf: die Liste ordnet keine Reparatur an.';
comment on column velocity.v_wawi_wartungsprognose.dringlichkeit is 'Reihenfolge des Arbeitstags: zuerst (Platz 1-20), danach (21-40), wenn Zeit bleibt (ab 41). KEINE eigene Information - der Platz in Zwanzigerblöcken, sonst nichts. Die Grenzen sind Schnitte und keine Schwellen in den Daten: am 04.09.2026 lagen zwischen Platz 20 und 21 drei Tausendstel der Nutzungsquote, über die ganze Liste dagegen 0,33.';

-- ---- Rechte ----------------------------------------------------------
-- Die Basistabelle bleibt zu, wie jede andere. Die Warenwirtschaft
-- spricht die Sicht an und zum Erzeugen die api_-Funktion.
revoke all on velocity.wartungsprognose from anon, authenticated;

-- PostgreSQL vergibt EXECUTE auf eine neue Funktion an PUBLIC. Ohne
-- diesen Entzug waeren beide Funktionen fuer anon ausfuehrbar - also
-- fuer jeden Browser mit dem oeffentlichen Schluessel. Der pgTAP-Test
-- test_s_keine_oeffentliche_funktion hat genau das gefunden; die erste
-- Fassung dieser Datei hatte nur den grant und nicht den revoke.
revoke all on function velocity.fn_wartungsprognose(date, int)
  from public, anon, authenticated;
revoke all on function velocity.api_wartungsprognose_erzeugen(date, int)
  from public, anon, authenticated;

-- DIE SICHT BRAUCHT IHR EIGENES LESERECHT. Eine Sicht erbt nichts von
-- der Tabelle darunter, und "authenticated" ist die Rolle, unter der
-- PostgREST jeden angemeldeten Menschen fuehrt - Kundschaft wie
-- Mitarbeitende. Der Filter ueber velocity.hat_rolle in der Sicht
-- entscheidet dann, wer Zeilen sieht; ohne dieses grant sieht niemand
-- etwas, auch die Werkstatt nicht. Genau das war der Fall: die erste
-- Fassung hatte den grant vergessen, und der Reiter blieb leer.
grant select on velocity.v_wawi_wartungsprognose to authenticated;

-- fn_ bleibt gesperrt: Sie rechnet auf den Basistabellen und wird nur
-- aus der api_-Funktion und aus dem Betriebsskript heraus gerufen,
-- beide mit den Rechten des Eigentuemers.
grant execute on function
  velocity.api_wartungsprognose_erzeugen(date, int)
to authenticated;

-- NACH DIESER DATEI FEHLT NOCH EIN SCHRITT, DEN SQL NICHT LEISTEN KANN.
-- PostgREST haelt seinen Schemakatalog im Speicher und kennt nur, was
-- beim letzten Einlesen existierte. Eine neu angelegte Sicht ist von
-- aussen deshalb NICHT erreichbar - die Anfrage antwortet mit 404
-- "Could not find the table", und die Oberflaeche zeigt eine leere
-- Liste statt eines Fehlers.
--
--     bash tools/schema_neu_lesen.sh
--
-- "notify pgrst, 'reload schema'" waere der dokumentierte Weg und stand
-- hier zuerst - er bleibt an dieser Installation wirkungslos. Das ist
-- kein neuer Befund: tools/schema_neu_lesen.sh haelt ihn seit dem
-- 30.08.2026 fest, samt der zweiten Haelfte des Fehlers, dem
-- vergessenen grant. Am 04.09.2026 sind beide erneut aufgetreten -
-- gemessen, nicht vermutet: v_wawi_flotte antwortete mit 401
-- (existiert, gesperrt), die neue Sicht mit 404.

-- Mitarbeitende lesen die Tabelle - ohne diese Regel liefert die Sicht
-- trotz bestandener hat_rolle-Pruefung keine Zeile, weil RLS auf der
-- Basistabelle greift.
drop policy if exists wartungsprognose_mitarbeiter_lesen on velocity.wartungsprognose;
create policy wartungsprognose_mitarbeiter_lesen on velocity.wartungsprognose
  for select using (velocity.ist_mitarbeiter());
