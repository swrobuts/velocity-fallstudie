-- =====================================================================
-- t0026 Kundenkennzahlen des persoenlichen Dashboards
-- =====================================================================
create schema if not exists velocity_test;
set search_path = velocity_test, velocity, extensions, public;

-- Vorrichtung: einen VORHANDENEN Kundensatz anmelden. runtests() gibt
-- jeder Testfunktion eine eigene Transaktion und nimmt sie hinterher
-- zurueck; das Setzen von auth_uid an einer Bestandszeile ist deshalb
-- folgenlos. Ein frisch erfundener Kunde waere hier untauglich: er
-- haette keine Fahrten, und genau die sollen gemessen werden.
--
-- auth_uid NICHT auf gen_random_uuid(): velocity.kunde traegt einen
-- Fremdschluessel auf auth.users (kunde_auth_uid_fk, nicht aufschiebbar -
-- nachgemessen ueber pg_constraint), und dieses Schema gehoert
-- supabase_auth_admin; die Fallstudie legt dort nichts an, auch nicht in
-- einem Test (dasselbe Prinzip wie in t0004_bereich_c.sql,
-- test_c_preisschaetzer_schalter). Es gibt zwei Zeilen in auth.users; die
-- Vorrichtung leiht sich die erste davon aus und haengt sie fuer die
-- Dauer der (ohnehin zurueckgerollten) Transaktion an den gewuenschten
-- Kundensatz um - zuerst dort loesen, wo sie heute steht, sonst
-- verletzte das Umhaengen die Eindeutigkeit von kunde_auth_uid_uk.
create or replace function velocity_test.fixture_kunde_anmelden(p_kundennummer text)
returns uuid language plpgsql as $$
declare v_uid uuid;
begin
  if not exists (select 1 from velocity.kunde where kundennummer = p_kundennummer) then
    raise exception 'Kundensatz % gibt es nicht', p_kundennummer;
  end if;

  select id into v_uid from auth.users order by id limit 1;
  if v_uid is null then
    raise exception 'auth.users ist leer - keine Anmeldung moeglich';
  end if;

  update velocity.kunde set auth_uid = null where auth_uid = v_uid;
  update velocity.kunde set auth_uid = v_uid where kundennummer = p_kundennummer;
  perform set_config('request.jwt.claims', json_build_object('sub', v_uid)::text, true);
  return v_uid;
end;
$$;

create or replace function velocity_test.test_kk_bilanz_ist_eine_zeile()
returns setof text language plpgsql as $$
begin
  perform velocity_test.fixture_kunde_anmelden('K-000001');
  return next is((select count(*)::int from velocity.v_meine_bilanz), 1,
                 'v_meine_bilanz liefert genau eine Zeile');
end;
$$;

create or replace function velocity_test.test_kk_jeder_sieht_seine_eigene()
returns setof text language plpgsql as $$
declare v_a numeric; v_b numeric;
begin
  perform velocity_test.fixture_kunde_anmelden('K-000001');
  select km_gesamt into v_a from velocity.v_meine_bilanz;
  perform velocity_test.fixture_kunde_anmelden('K-000013');
  select km_gesamt into v_b from velocity.v_meine_bilanz;
  -- Wuerde die Sicht nicht filtern, kaeme zweimal dasselbe heraus.
  return next isnt(v_a, v_b,
                 'Zwei verschiedene Kunden sehen zwei verschiedene Bilanzen');
end;
$$;

create or replace function velocity_test.test_kk_rang_ist_kein_einzelrang()
returns setof text language plpgsql as $$
declare v_anzahl integer; v_rang bigint;
begin
  perform velocity_test.fixture_kunde_anmelden('K-000013');
  select kunden_gewertet, rang_km into v_anzahl, v_rang from velocity.v_meine_bilanz;
  -- Der Kernfehler, den diese Pruefung abfaengt: liefe die Sicht unter
  -- security_invoker, bekaeme die Rolle authenticated schon fuer den
  -- Zugriff auf v_fahrt_kennzahl 42501 (permission denied) - siehe
  -- Kopfkommentar von 0025_kundenkennzahlen.sql.
  return next cmp_ok(v_anzahl, '>', 1,
                 'Der Rang wird ueber mehr als einen Kunden gebildet');
  return next cmp_ok(v_rang, '<=', v_anzahl::bigint,
                 'Der eigene Platz liegt innerhalb des Feldes');
end;
$$;

create or replace function velocity_test.test_kk_mehr_km_kleinerer_rang()
returns setof text language plpgsql as $$
declare v_km_a numeric; v_rang_a bigint; v_km_b numeric; v_rang_b bigint;
begin
  perform velocity_test.fixture_kunde_anmelden('K-000013');
  select km_gesamt, rang_km into v_km_a, v_rang_a from velocity.v_meine_bilanz;
  perform velocity_test.fixture_kunde_anmelden('K-000001');
  select km_gesamt, rang_km into v_km_b, v_rang_b from velocity.v_meine_bilanz;
  return next ok((v_km_a > v_km_b) = (v_rang_a < v_rang_b),
                 'Wer mehr Kilometer hat, traegt den kleineren Rang');
end;
$$;

create or replace function velocity_test.test_kk_gewertet_nur_mit_fahrt()
returns setof text language plpgsql as $$
declare v_gemeldet integer; v_erwartet integer;
begin
  perform velocity_test.fixture_kunde_anmelden('K-000013');
  select kunden_gewertet into v_gemeldet from velocity.v_meine_bilanz;
  select count(distinct kunde_id)::int into v_erwartet from velocity.v_fahrt_kennzahl;
  -- Gemessen am 05.09.2026: 495 von 1.014 Kunden haben ueberhaupt eine
  -- abgeschlossene Fahrt. Zaehlte die Sicht alle 1.014, waere der Rang
  -- unter Konten ohne jede Fahrt gebildet - eine geschenkte
  -- Platzierung, keine Einordnung. Verglichen wird gegen die
  -- Basissicht, nicht gegen die feste Zahl 495: der Bestand waechst.
  return next is(v_gemeldet, v_erwartet,
                 'kunden_gewertet zaehlt genau die Kunden mit mindestens einer Fahrt');
  return next cmp_ok(v_gemeldet, '<', (select count(*)::int from velocity.kunde),
                 'Kunden ohne jede Fahrt werden nicht mitgezaehlt');
end;
$$;

create or replace function velocity_test.test_kk_summen_stimmen_ueberein()
returns setof text language plpgsql as $$
declare v_monat numeric; v_gesamt numeric; v_monate int; v_toleranz numeric;
begin
  perform velocity_test.fixture_kunde_anmelden('K-000001');
  select round(sum(km), 1), count(*) into v_monat, v_monate
    from velocity.v_meine_monatsbilanz;
  select km_gesamt        into v_gesamt from velocity.v_meine_bilanz;

  /* Zwei Sichten, dieselbe Groesse. Laufen sie auseinander, zeigt das
     Dashboard im Verlauf etwas anderes als in der Bilanz darueber - und
     niemand weiss, welche der beiden Zahlen stimmt.

     TOLERANZ STATT GLEICHHEIT (06.09.2026). Hier stand is(v_monat,
     v_gesamt) - ein exakter Vergleich, der jahrelang gruen war, weil er
     Glueck hatte. v_meine_monatsbilanz rundet JEDEN MONAT einzeln auf
     eine Stelle, v_meine_bilanz rundet die Gesamtsumme einmal. Bei n
     Monaten koennen sich diese Rundungen auf bis zu n * 0,05 addieren,
     dazu 0,05 fuer die Gesamtsumme selbst. Aufgefallen ist es, als nach
     dem Entfernen von neun Demofahrten 155,9 gegen 156,0 stand.

     Die Schranke bleibt scharf: die kleinste Abweichung, die ein ECHTER
     Fehler erzeugen kann, ist eine ganze Fahrt - mehrere Kilometer, also
     eine Groessenordnung ueber dieser Toleranz. */
  v_toleranz := v_monate * 0.05 + 0.05;
  return next ok(abs(v_monat - v_gesamt) <= v_toleranz,
                 format('Die Monatssummen ergeben die Gesamtbilanz '
                        '(%s gegen %s, erlaubte Rundungsabweichung %s)',
                        v_monat, v_gesamt, v_toleranz));
end;
$$;

create or replace function velocity_test.test_kk_keine_fremden_zeilen()
returns setof text language plpgsql as $$
begin
  perform velocity_test.fixture_kunde_anmelden('K-000001');
  return next is_empty(
    $sql$select f.ausleihe_id from velocity.v_meine_fahrt_kennzahl f
           join velocity.ausleihe a using (ausleihe_id)
           join velocity.kunde k on k.kunde_id = a.kunde_id
          where k.kundennummer <> 'K-000001'$sql$,
    'v_meine_fahrt_kennzahl führt keine fremde Fahrt');
end;
$$;

-- ---------------------------------------------------------------------
-- DER SCHAETZANTEIL ZAEHLT KILOMETER, NICHT FAHRTEN (ab 06.09.2026)
--
-- Bis dahin war anteil_geschaetzt der Anteil der FAHRTEN mit
-- geschaetzter Strecke. Richtig gerechnet, aber die falsche Frage: der
-- Wert steht auf der Website unter einer Kilometerkachel. Eine Fahrt
-- wird ohnehin nie geschaetzt - sie ist erfasst; geschaetzt wird allein
-- ihre Strecke.
--
-- Der zweite Satz ist die GEGENPROBE zum ersten. Ohne ihn bliebe der
-- Test auch unter der alten Definition gruen, sobald beide Anteile
-- zufaellig zusammenfielen - und dann bewachte er nichts. Schlaegt er
-- eines Tages an, ist nicht die Sicht kaputt, sondern der Datensatz
-- unterscheidet die beiden Rechenwege nicht mehr; dann braucht dieser
-- Test einen anderen Kunden.
-- ---------------------------------------------------------------------
create or replace function velocity_test.test_kk_schaetzanteil_zaehlt_kilometer()
returns setof text language plpgsql as $$
declare
  v_gemeldet     numeric;
  v_nach_km      numeric;
  v_nach_fahrten numeric;
begin
  perform velocity_test.fixture_kunde_anmelden('K-000001');

  select anteil_geschaetzt into v_gemeldet from velocity.v_meine_bilanz;
  select round(coalesce(sum(km) filter (where ist_geschaetzt)
                        / nullif(sum(km), 0), 0), 3),
         round(avg(case when ist_geschaetzt then 1.0 else 0.0 end), 3)
    into v_nach_km, v_nach_fahrten
    from velocity.v_meine_fahrt_kennzahl;

  return next is(v_gemeldet, v_nach_km,
    'v_meine_bilanz.anteil_geschaetzt ist der nach Kilometern gewichtete Anteil');

  return next isnt(v_nach_km, v_nach_fahrten,
    'Kilometeranteil und Fahrtenanteil gehen bei K-000001 auseinander - '
    'der Satz darueber unterscheidet also wirklich zwischen beiden Rechenwegen');
end;
$$;
