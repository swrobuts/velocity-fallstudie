-- =====================================================================
--  KUNDENMAILADRESSEN AUF .invalid UMSTELLEN
--
--  ANLASS (gemessen am 05.09.2026): die 1 014 Kundensätze trugen echte,
--  erreichbare Maildomänen - gmail.com 326-mal, icloud.com 198-mal,
--  outlook.com 190-mal, yahoo.com 118, mail.com 87, hotmail.com 81.
--  Die Namen sind erfunden, die Domänen waren es nicht. Eine erfundene
--  Person unter einer zustellbaren Adresse zu führen heißt, ein fremdes
--  Postfach zu benennen; bei 1 014 Sätzen ist die Wahrscheinlichkeit
--  hoch, dass einige davon jemandem gehören. Studierende lesen diese
--  Tabelle mit der Rolle studi (db/betrieb/studizugang_lesend.sql).
--
--  NEUE FORM: vorname.nachname@mail.invalid, abgeleitet aus dem Namen.
--  .invalid ist nach RFC 2606 reserviert und löst nie auf.
--
--  Damit ist eine frühere Entscheidung überholt:
--  kundenwohnorte_regionalisieren.sql hielt 2026-08-26 ausdrücklich
--  fest, vorname/nachname/email blieben unangetastet. Für die Namen
--  gilt das weiter - nur die Adressen waren das Problem.
--
--  ABLEITUNG, in dieser Reihenfolge:
--    1. ä→ae ö→oe ü→ue ß→ss (Vorbild aus dem Bestand: Lukas Müller
--       trug bereits lukas.mueller@...). Danach übrige diakritische
--       Zeichen auf ihren Grundbuchstaben.
--    2. Kleinschreibung.
--    3. Alles außer a-z, 0-9 und dem Punkt wird zum Bindestrich. Das
--       trifft vor allem die 250 zweiteiligen Vornamen: aus
--       "Kwok Ming Choi" wird kwok-ming.choi@mail.invalid.
--    4. Gleichnamige bekommen die Kundennummer angehängt. Gemessen:
--       920 Sätze sind ohne Zusatz eindeutig, 94 brauchen einen -
--       es gibt zum Beispiel drei "Robert Butscher". Aus K-000011
--       wird robert.butscher.11@mail.invalid. Die Gruppen werden über
--       ALLE Sätze gebildet, auch über die Ausnahme unten, damit die
--       Nummern stabil bleiben.
--
--  Ergebnis vorab geprüft: 1 014 Adressen, 1 014 verschiedene, keine
--  verletzt kunde_email_chk, längste 32 Zeichen.
--
--  DIE EINE AUSNAHME: K-000013 behält swrobuts@googlemail.com. Das ist
--  der Satz des Betreibers und zugleich das einzige Konto, das mit
--  auth.users verknüpft ist; die Adresse bleibt auf seine Anweisung vom
--  05.09.2026 stehen. Ausgenommen wird über die KUNDENNUMMER, nicht
--  über die Adresse - so steht die persönliche Anschrift nicht noch ein
--  weiteres Mal im Quelltext.
--
--  WARUM DER PROTOKOLLTRIGGER ABGESCHALTET WIRD
--
--  velocity.fn_protokoll_schreiben hält jedes geänderte Feld mit
--  wert_alt und wert_neu fest. Ein Lauf ohne diese Abschaltung schriebe
--  1 013 echte Adressen nach velocity.aenderungsprotokoll - und die
--  Rolle studi darf dort lesen. Die Umstellung wäre damit wirkungslos:
--  die Adressen wären nicht entfernt, sondern nur umgezogen. Gemessen
--  vor dem Lauf: 1 099 Protokollzeilen, davon 4 zum Feld email, keine
--  einzige mit einer echten Adresse. Genau dieser Zustand bleibt.
--
--  Der Vorgang ist eine Datenbereinigung, kein Geschäftsvorfall - er
--  gehört fachlich ohnehin nicht in das Buch, das festhält, wer welchen
--  Kundenstammsatz gepflegt hat. Stattdessen entsteht EINE Zeile in
--  velocity.uebernahme_protokoll, dem Buch für Datenläufe.
--
--  Der Audittrigger trg_kunde_audit bleibt an: geaendert_am soll den
--  Lauf sehr wohl zeigen.
--
--  IDEMPOTENT. Die Adresse wird aus dem NAMEN abgeleitet, nicht aus der
--  bisherigen Adresse; ein zweiter Lauf errechnet dieselben Werte und
--  schreibt wegen "is distinct from" keine Zeile mehr an.
--
--  REIHENFOLGE: Nach einer Umbenennung eines Kunden (etwa K-000001 auf
--  Clara Fake) diese Datei erneut laufen lassen - die Adresse folgt
--  dann dem neuen Namen.
--
--  Aufruf:
--    psql -U postgres -d postgres -f db/betrieb/kundenmails_anonymisieren.sql
-- =====================================================================

do $$
declare
  v_geaendert integer;
  v_echt      integer;
  v_doppelt   integer;
  v_protokoll integer;
begin
  -- Begründung siehe Kopf. Schlägt der Block fehl, nimmt die
  -- Transaktion auch dieses ALTER zurück - die Abschaltung kann also
  -- nicht versehentlich stehenbleiben.
  alter table velocity.kunde disable trigger trg_kunde_protokoll;

  with abgeleitet as (
    select k.kunde_id,
           k.kundennummer,
           btrim(
             regexp_replace(
               lower(
                 translate(
                   replace(replace(replace(replace(replace(replace(replace(
                     k.vorname || '.' || k.nachname,
                     'ä','ae'),'ö','oe'),'ü','ue'),
                     'Ä','Ae'),'Ö','Oe'),'Ü','Ue'),'ß','ss'),
                   'áàâãåéèêëíìîïóòôõúùûçñýÁÀÂÃÅÉÈÊËÍÌÎÏÓÒÔÕÚÙÛÇÑÝ',
                   'aaaaaeeeeiiiioooouucnyAAAAAEEEEIIIIOOOOUUCNY')),
               '[^a-z0-9.]+', '-', 'g'),
             '-') as ortsteil
      from velocity.kunde k
  ),
  gezaehlt as (
    select a.*, count(*) over (partition by a.ortsteil) as gleichnamige
      from abgeleitet a
  ),
  neu as (
    select g.kunde_id,
           g.ortsteil
             || case when g.gleichnamige > 1
                     then '.' || ltrim(g.kundennummer, 'K-0')
                     else '' end
             || '@mail.invalid' as email
      from gezaehlt g
  )
  update velocity.kunde k
     set email = n.email
    from neu n
   where n.kunde_id = k.kunde_id
     and k.kundennummer <> 'K-000013'
     and k.email is distinct from n.email;

  get diagnostics v_geaendert = row_count;

  alter table velocity.kunde enable trigger trg_kunde_protokoll;

  -- ---- Gegenprobe --------------------------------------------------
  select count(*) into v_echt
    from velocity.kunde
   where email not like '%@mail.invalid'
     and kundennummer <> 'K-000013';

  if v_echt > 0 then
    raise exception 'Es stehen noch % Adressen ausserhalb von .invalid', v_echt;
  end if;

  select count(*) into v_doppelt
    from (select email from velocity.kunde group by email having count(*) > 1) d;

  if v_doppelt > 0 then
    raise exception 'Doppelte Adressen: %', v_doppelt;
  end if;

  -- Beide Werte einzeln, nicht verkettet: sonst rettet das ".invalid"
  -- des NEUEN Werts die echte Adresse im ALTEN ueber die Pruefung.
  select count(*) into v_protokoll
    from velocity.aenderungsprotokoll
   where feld = 'email'
     and (   wert_alt not like '%.invalid'
          or wert_neu not like '%.invalid');

  if v_protokoll > 0 then
    raise exception
      'Im Aenderungsprotokoll stehen % echte Adressen - der Trigger war an', v_protokoll;
  end if;

  -- Nur ein Lauf, der wirklich etwas geaendert hat, gehoert ins Buch.
  -- Sonst haengt jeder Wiederholungslauf eine Zeile "0 geschrieben" an
  -- und die Historie erzaehlt Arbeit, die nicht stattgefunden hat.
  if v_geaendert > 0 then
    insert into velocity.uebernahme_protokoll
           (lauf, quelle, ziel, gelesen, geschrieben, uebersprungen, hinweis)
    values (now(), 'Kundenmailadressen (erfunden)', 'velocity.kunde.email',
            (select count(*) from velocity.kunde), v_geaendert, 1,
            'Echte Maildomaenen ersetzt durch vorname.nachname@mail.invalid. '
            'Uebersprungen: K-000013, Satz des Betreibers. Protokolltrigger '
            'waehrend des Laufs abgeschaltet, damit keine echte Adresse in '
            'aenderungsprotokoll.wert_alt zurueckbleibt.');
  end if;

  raise notice 'Kundenmailadressen umgestellt: % Saetze geaendert, 1 ausgenommen',
    v_geaendert;
end;
$$;

-- ---- Rücknahme -------------------------------------------------------
-- Es gibt keine. Die echten Adressen waren selbst erfunden, sind
-- nirgends im Projekt gesichert und stehen nach diesem Lauf auch nicht
-- mehr im Änderungsprotokoll - das ist der Zweck der Datei. Wer den
-- alten Stand braucht, spielt einen Abzug zurück
-- (tools/velocity_zuruecksetzen.sh).
