-- =====================================================================
--  Uebernahmeprotokoll: geschrieben-Wert einer Zeile korrigieren
--
--  1. DER FEHLER.
--     Protokollzeile protokoll_id = 43 (quelle = 'Referenzdaten
--     (erzeugt)', ziel = 'velocity.nutzungspreis, velocity.mitgliedschaft,
--     velocity.freiminuten_periode, velocity.mitarbeiter') traegt
--     geschrieben = 410 - den Gesamtbestand von velocity.mitgliedschaft
--     zum Commit-Zeitpunkt jenes Laufs, nicht das, was der Lauf
--     tatsaechlich geschrieben hat (400 neue Zeilen; 10 gab es vorher
--     schon). Ursache war ein fehlerhafter Ausdruck in der Vorgabe fuer
--     db/betrieb/referenzdaten_grundlage.sql. Block 4 dieser Datei
--     berechnet die richtige Zahl inzwischen selbst und reicht sie an
--     ihren eigenen Protokolleintrag durch - siehe den Kommentar dort.
--     Diese Zeile hier ist aelter als der Fix und blieb falsch stehen.
--
--  2. WARUM KORRIGIEREN UND NICHT STEHEN LASSEN.
--     db/betrieb/uebernahme_altdaten.sql haelt an anderer Stelle fest:
--     "Ein Protokoll, das sich der Gegenwart anpasst, ist kein
--     Protokoll." Das gilt fuer MESSUNGEN - was am 22.08. tatsaechlich
--     aus dem Altsystem gelesen wurde, wird nicht nachtraeglich
--     huebscher gemacht. Hier liegt aber keine Messung falsch, sondern
--     eine Buchung: der Lauf hat 400 Zeilen geschrieben, das Feld sollte
--     400 sagen. Die bekannt falsche Zahl stehen zu lassen waere keine
--     Redlichkeit, sondern deren Gegenteil - der ganze Zweck dieser
--     Tabelle ist, festzuhalten, was ein Lauf getan hat.
--
--  3. WIE.
--     Gezielt ueber protokoll_id, nicht ueber quelle/ziel - ein UPDATE
--     auf einer Protokolltabelle soll genau eine Zeile treffen, und man
--     soll beim Lesen sehen, welche. Die Korrektur wird an der Zeile
--     selbst vermerkt (hinweis), nicht stillschweigend vorgenommen:
--     nichts verschwindet, es kommt etwas hinzu. geaendert_am wird vom
--     Audit-Trigger ohnehin mitgeschrieben.
--
--  Idempotent: die WHERE-Bedingung greift nur, solange geschrieben noch
--  auf dem falschen Wert steht; ein zweiter Lauf trifft keine Zeile mehr
--  und haengt die Korrekturnotiz nicht doppelt an.
--
--  Ruecknahme: nicht vorgesehen. Eine Korrektur, die eine falsche
--  Buchung richtigstellt, wird nicht zurueckgenommen; die alte (falsche)
--  Zahl wiederherzustellen hiesse, einen bekannt falschen Zustand
--  absichtlich neu herzustellen.
-- =====================================================================

begin;

update velocity.uebernahme_protokoll
   set geschrieben = 400,
       hinweis = hinweis || ' [Korrigiert am 25.08.2026: das Feld trug '
                 || 'faelschlich den Gesamtbestand 410 statt der 400 in '
                 || 'diesem Lauf geschriebenen Zeilen. Ursache war ein '
                 || 'Fehler in der Vorgabe, nicht in den Daten.]'
 where protokoll_id = 43
   and geschrieben <> 400;

commit;

-- ---- Kontrolle -------------------------------------------------------
do $$
declare
  v_zeile velocity.uebernahme_protokoll%rowtype;
  v_treffer integer;
begin
  select count(*) into v_treffer
    from velocity.uebernahme_protokoll where protokoll_id = 43;
  if v_treffer <> 1 then
    raise exception 'Erwartet genau eine Zeile mit protokoll_id = 43, gefunden %', v_treffer;
  end if;

  select * into v_zeile
    from velocity.uebernahme_protokoll where protokoll_id = 43;

  if v_zeile.geschrieben <> 400 then
    raise exception 'Korrektur nicht angekommen: geschrieben = %', v_zeile.geschrieben;
  end if;

  if v_zeile.hinweis not like '%Korrigiert am 25.08.2026%' then
    raise exception 'Korrekturvermerk fehlt in hinweis';
  end if;

  raise notice 'Protokollzeile % korrigiert: geschrieben = %', v_zeile.protokoll_id, v_zeile.geschrieben;
end;
$$;
