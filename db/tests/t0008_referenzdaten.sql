-- =====================================================================
-- t0008 Referenz- und Redaktionsdaten
-- =====================================================================
create schema if not exists velocity_test;
set search_path = velocity_test, velocity, extensions, public;

create or replace function velocity_test.test_ref_entgeltarten()
returns setof text language plpgsql as $$
begin
  -- Sechs, nicht sieben: der Zuschlag fuers freie Abstellen wurde
  -- gestrichen, weil er nie erhoben wird.
  return next is((select count(*)::int from velocity.entgeltart), 6,
                 'Es gibt sechs Entgeltarten');
  return next is((select vorzeichen from velocity.entgeltart where code = 'ZEITENTGELT'),
                 1::smallint, 'Zeitentgelt belastet');
  return next is((select vorzeichen from velocity.entgeltart where code = 'FREIMINUTEN'),
                 (-1)::smallint, 'Freiminuten entlasten');
  return next is((select vorzeichen from velocity.entgeltart where code = 'TARIFRABATT'),
                 (-1)::smallint, 'Tarifrabatt entlastet');
end;
$$;

create or replace function velocity_test.test_ref_preise()
returns setof text language plpgsql as $$
begin
  return next is((select count(*)::int from velocity.fahrradtyp), 3, 'Drei Fahrradtypen');
  -- Preise haben eine Historie. Nach der Anpassung vom 23.08.2026 gibt es
  -- je Typ zwei Perioden; gefragt ist immer die HEUTE gueltige. Genau
  -- deshalb steht der Zeitbezug in der Abfrage - ohne ihn liefert die
  -- Unterabfrage mehr als eine Zeile und der Test stirbt.
  return next is((select count(*)::int from velocity.nutzungspreis
                   where gueltigkeit @> current_date), 3,
                 'Je Fahrradtyp genau ein heute gueltiger Preis');
  return next is(
    (select p.preis_pro_minute from velocity.nutzungspreis p
       join velocity.fahrradtyp t on t.typ_id = p.typ_id
      where t.typ_code = 'CITY' and p.gueltigkeit @> current_date),
    0.10::numeric(10,2), 'City-Bike kostet 0,10 Euro je Minute');
  return next is(
    (select p.tageshoechstpreis from velocity.nutzungspreis p
       join velocity.fahrradtyp t on t.typ_id = p.typ_id
      where t.typ_code = 'CARGO' and p.gueltigkeit @> current_date),
    110.00::numeric(10,2), 'E-Cargo Loader ist bei 110,00 Euro am Tag gedeckelt');
  -- Frueher stand hier: alle Preise sind nach oben offen. Das galt nur,
  -- solange es je Typ eine einzige Periode gab. Die haltbare Invariante
  -- ist eine andere: je Fahrradtyp gibt es GENAU EINE offene Periode -
  -- den heute geltenden Satz. Alles davor ist geschlossene Historie.
  return next is(
    (select count(*)::int from velocity.nutzungspreis where upper_inf(gueltigkeit)),
    (select count(*)::int from velocity.fahrradtyp),
    'Je Fahrradtyp genau eine nach oben offene Preisperiode');
  return next ok(
    not exists (
      select 1 from velocity.nutzungspreis a join velocity.nutzungspreis b
        on a.typ_id = b.typ_id and a.preis_id < b.preis_id
       where a.gueltigkeit && b.gueltigkeit),
    'Preisperioden eines Fahrradtyps ueberschneiden sich nie');
end;
$$;

create or replace function velocity_test.test_ref_tarife_und_inhalte()
returns setof text language plpgsql as $$
begin
  return next is((select count(*)::int from velocity.tarif), 4, 'Vier Tarife');
  return next is(
    (select k.freiminuten_pro_monat from velocity.tarif_kondition k
       join velocity.tarif t on t.tarif_id = k.tarif_id where t.tarif_code = 'PREMIUM'),
    1000, 'Premium bringt 1000 Freiminuten je Monat');
  return next is(
    (select k.rabatt_prozent from velocity.tarif_kondition k
       join velocity.tarif t on t.tarif_id = k.tarif_id where t.tarif_code = 'PREMIUM'),
    20.00::numeric(5,2), 'Premium gewaehrt 20 Prozent Rabatt');
  -- Die Startseite fuehrt '0 Euro Anmeldegebuehr' als Kennzahl, und die
  -- Preisauskunft nennt ausschliesslich Startgebuehr, Minutenpreis und
  -- Tageshoechstpreis. Ein Monatsentgelt widerspraeche beidem. Bis zum
  -- 31.08.2026 stand Premium mit 9,90 Euro in den Referenzdaten, ohne dass
  -- ein Test das bemerkt haette.
  --
  -- Geprueft wird jetzt die Struktur statt der Werte: die Spalte gibt es
  -- nicht mehr. Das ist die staerkere Zusicherung - ein Wert kann wieder
  -- gesetzt werden, eine fehlende Spalte nicht.
  return next hasnt_column('velocity'::name, 'tarif_kondition'::name,
    'monatspreis'::name,
    'Kein Monatsentgelt - die Spalte existiert nicht');
  return next is((select count(*)::int from velocity.faq_eintrag where aktiv), 4,
                 'Vier aktive FAQ-Eintraege');
  return next is((select count(*)::int from velocity.nutzungsschritt), 3, 'Drei Nutzungsschritte');
  return next is((select count(*)::int from velocity.kennzahl), 4, 'Vier Kennzahlen');
  return next is((select count(*)::int from velocity.fahrradtyp_merkmal), 9,
                 'Je Fahrradtyp drei Merkmale fuer die Tarifkarte');
end;
$$;

create or replace function velocity_test.test_ref_kundenmails_sind_unzustellbar()
returns setof text language plpgsql as $$
begin
  -- Die Kundennamen sind erfunden, die Maildomaenen waren es bis zum
  -- 05.09.2026 nicht: 326 Saetze auf gmail.com, 198 auf icloud.com, 190
  -- auf outlook.com. Eine erfundene Person unter einer zustellbaren
  -- Adresse zu fuehren heisst, ein fremdes Postfach zu benennen - und
  -- die Rolle studi liest diese Tabelle. Umgestellt mit
  -- db/betrieb/kundenmails_anonymisieren.sql auf
  -- vorname.nachname@mail.invalid (RFC 2606: .invalid loest nie auf).
  --
  -- Ausgenommen ist K-000013, der Satz des Betreibers. Das ist eine
  -- benannte Ausnahme, keine Luecke - deshalb steht sie hier als
  -- Bedingung und nicht als weiche Schwelle: kommt eine zweite echte
  -- Adresse dazu, wird dieser Test rot.
  return next is_empty(
    $sql$select kundennummer from velocity.kunde
          where email not like '%.invalid'
            and kundennummer <> 'K-000013'$sql$,
    'Ausser dem Satz des Betreibers hat kein Kunde eine zustellbare Adresse');

  -- Der Protokolltrigger haelt jedes geaenderte Feld mit wert_alt fest.
  -- Wer die Umstellung ohne Abschaltung des Triggers wiederholt,
  -- entfernt die Adressen nicht, sondern zieht sie nur um - nach
  -- aenderungsprotokoll, wo studi ebenfalls liest. Genau das prueft
  -- diese Zeile.
  --
  -- Beide Werte werden EINZELN geprueft. Eine Verkettung waere hier ein
  -- stiller Ausfall: bei einer Aenderung von jemand@gmail.com auf
  -- x@mail.invalid enthaelt der zusammengesetzte Text "invalid" - der
  -- Test bliebe gruen und uebersaehe genau den Fall, fuer den er da ist.
  -- Zu den Nullwerten: ein INSERT hat kein wert_alt, ein DELETE kein
  -- wert_neu. "null not like" ergibt null, und "null or false" ist
  -- ebenfalls null, also nicht wahr - solche Zeilen fallen richtig
  -- heraus, ohne dass es dafuer ein coalesce braucht.
  return next is_empty(
    $sql$select protokoll_id from velocity.aenderungsprotokoll
          where feld = 'email'
            and (   wert_alt not like '%.invalid'
                 or wert_neu not like '%.invalid')$sql$,
    'Im Aenderungsprotokoll steht keine zustellbare Mailadresse');
end;
$$;

create or replace function velocity_test.test_ref_keine_fahrt_ueber_50km()
returns setof text language plpgsql as $$
begin
  -- Dauerhafte Wache, kein einmaliger Fund: der reale Höchstwert unter
  -- allen abgeschlossenen Fahrten liegt bei 21,49 km (Ausleihe 33303).
  -- 50 km lassen dieser echten Spitze reichlich Luft und fangen
  -- trotzdem jede Dauerschätzung ab, die aus dem Ruder läuft.
  --
  -- Genau das ist am 05.09.2026 einmal passiert: Ausleihe 269 hatte
  -- dieselbe Start- wie Endstation (Hauptbahnhof), damit eine Luftlinie
  -- von null, und der dritte Fall der Herleitung in
  -- velocity.v_fahrt_kennzahl rechnete deshalb Dauer mal
  -- Reisegeschwindigkeit - bei 2552 Minuten Ausleihdauer 552,93 km, mit
  -- weitem Abstand die längste Einzelfahrt der Flotte.
  -- db/betrieb/ausreisser_dauerschaetzung.sql hat den Wert danach durch
  -- eine vorgegebene Distanz (12 km) ersetzt; siehe deren Kopfkommentar
  -- für die Einzelheiten und db/tests/t0025_kennzahl_umstellung.sql für
  -- die dadurch verschobenen Summen.
  --
  -- Die Gefahr ist nicht hypothetisch, sondern strukturell: die längste
  -- Ausleihdauer im gesamten Bestand sind 5422 Minuten (Ausleihe 265).
  -- Ihre Start- und Endstation unterscheiden sich, weshalb sie über die
  -- Luftlinie statt über die Dauer geschätzt wird und unauffällig
  -- bleibt - träfen beide Eigenschaften künftig auf dieselbe Fahrt zu
  -- (gleiche Station, sehr lange Ausleihe), ergäbe derselbe dritte Fall
  -- rund 1175 km. Dieser Test wacht über die Konstellation selbst, nicht
  -- über eine einzelne Ausleihe-Nummer.
  return next is_empty(
    $sql$select ausleihe_id from velocity.v_fahrt_kennzahl where km > 50$sql$,
    'Keine abgeschlossene Fahrt liegt ueber 50 km');
end;
$$;
