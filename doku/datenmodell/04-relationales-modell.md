# 04 Logischer Entwurf

> Vierter Schritt: die Abbildung des ERM auf Relationen. Noch immer
> unabhängig vom konkreten Datenbanksystem.

## Abbildungsregeln

| ERM-Konstrukt | Abbildung |
|---|---|
| Entitätstyp | eigene Relation |
| Attribut | Spalte |
| 1:N-Beziehung | Fremdschlüssel auf der N-Seite |
| 1:1-Beziehung | Fremdschlüssel auf der optionalen Seite, dort zugleich Primärschlüssel |
| M:N-Beziehung | eigene Verknüpfungsrelation mit zusammengesetztem Schlüssel |
| Schwacher Entitätstyp | Primärschlüssel enthält den Schlüssel des starken Typs |
| Mehrwertiges Attribut | eigene Relation |

Zwei Anwendungen im Modell:

- **1:1**, `fahrrad` zu `fahrrad_position`: `fahrrad_id` ist in
  `fahrrad_position` zugleich Primär- und Fremdschlüssel. Das erzwingt
  „höchstens eine Position je Rad" ohne zusätzlichen Constraint.
- **Mehrwertig**, die Werbemerkmale eines Fahrradtyps: sie werden zu
  `fahrradtyp_merkmal` mit dem Schlüssel (`typ_id`, `sortierung`).

## Notation des Relationenschemas

`__unterstrichen__` = Primärschlüssel · `→ ziel` = Fremdschlüssel ·
`[UK]` = fachlicher Alternativschlüssel

## Bereich A — Geschäftspartner

```
ADRESSE(__adresse_id__, strasse, hausnummer, plz, ort, land_code)
        UK (strasse, hausnummer, plz, ort, land_code)

KUNDE(__kunde_id__, kundennummer [UK], auth_uid [UK] → auth.users,
      email [UK], anrede, vorname, nachname, geburtsdatum, telefon,
      rechnungsadresse_id → ADRESSE, status, registriert_am)
```

## Bereich B — Netz und Flotte

```
STATION(__station_id__, stationsnummer [UK], name,
        adresse_id → ADRESSE, latitude, longitude, kapazitaet,
        betriebszeitraum)

FAHRRADTYP(__typ_id__, typ_code [UK], bezeichnung [UK], beschreibung,
           hat_elektro, zuladung_kg)

FAHRRADTYP_MERKMAL(__merkmal_id__, typ_id → FAHRRADTYP, sortierung, merkmal)
                   UK (typ_id, sortierung)

HERSTELLER(__hersteller_id__, name [UK])

FAHRRADMODELL(__modell_id__, hersteller_id → HERSTELLER,
              typ_id → FAHRRADTYP, modellbezeichnung, baujahr)
              UK (hersteller_id, modellbezeichnung)

FAHRRAD(__fahrrad_id__, rahmennummer [UK], modell_id → FAHRRADMODELL,
        status, angeschafft_am, ausgemustert_am)

FAHRRAD_POSITION(__fahrrad_id__ → FAHRRAD, station_id → STATION,
                 latitude, longitude, akkustand_prozent, aktualisiert_am)
```

## Bereich C — Tarif und Preis

```
TARIF(__tarif_id__, tarif_code [UK], bezeichnung [UK], art, voraussetzung)

TARIF_KONDITION(__kondition_id__, tarif_id → TARIF, gueltigkeit,
                freiminuten_pro_monat, rabatt_prozent)
                überschneidungsfrei je tarif_id

MITGLIEDSCHAFT(__mitgliedschaft_id__, kunde_id → KUNDE,
               tarif_id → TARIF, gueltigkeit)
               überschneidungsfrei je kunde_id

FREIMINUTEN_PERIODE(__periode_id__, mitgliedschaft_id → MITGLIEDSCHAFT,
                    jahr, monat, kontingent_minuten, verbraucht_minuten)
                    UK (mitgliedschaft_id, jahr, monat)

NUTZUNGSPREIS(__preis_id__, typ_id → FAHRRADTYP, gueltigkeit,
              startgebuehr, preis_pro_minute, tageshoechstpreis)
              überschneidungsfrei je typ_id
```

## Bereich D — Nutzung

```
ENTGELTART(__entgeltart_id__, code [UK], bezeichnung, vorzeichen)

AUSLEIHE(__ausleihe_id__, kunde_id → KUNDE, fahrrad_id → FAHRRAD,
         mitgliedschaft_id → MITGLIEDSCHAFT,
         start_station_id → STATION, start_latitude, start_longitude,
         startzeit, end_station_id → STATION, end_latitude,
         end_longitude, endzeit, status, {dauer_minuten})
         höchstens eine aktive Zeile je fahrrad_id

ENTGELTPOSITION(__position_id__, ausleihe_id → AUSLEIHE,
                entgeltart_id → ENTGELTART,
                nutzungspreis_id → NUTZUNGSPREIS,
                menge, einzelbetrag, betrag, sortierung)
```

`{dauer_minuten}` in geschweiften Klammern: abgeleitetes Attribut.

## Bereich E — Abrechnung

```
ZAHLUNGSART(__zahlungsart_id__, code [UK], bezeichnung)

ZAHLUNGSMITTEL(__zahlungsmittel_id__, kunde_id → KUNDE,
               zahlungsart_id → ZAHLUNGSART, referenz_token, inhaber,
               gueltig_bis, ist_standard)
               höchstens eine Standardzeile je kunde_id

RECHNUNG(__rechnung_id__, rechnungsnummer [UK], kunde_id → KUNDE,
         periode_jahr, periode_monat, erstellt_am_beleg, betrag_netto,
         ust_satz, ust_betrag, betrag_brutto, status)
         UK (kunde_id, periode_jahr, periode_monat)

RECHNUNGSPOSITION(__rechnungsposition_id__, rechnung_id → RECHNUNG,
                  position_nr, ausleihe_id → AUSLEIHE, beschreibung, betrag)
                  UK (rechnung_id, position_nr)

ZAHLUNG(__zahlung_id__, rechnung_id → RECHNUNG,
        zahlungsmittel_id → ZAHLUNGSMITTEL, betrag, gebucht_am, status)
```

## Bereich F — Redaktionsinhalte

```
FAQ_EINTRAG(__faq_id__, frage [UK], antwort, sortierung, aktiv)

NUTZUNGSSCHRITT(__schritt_id__, nummer [UK], titel, beschreibung)

KENNZAHL(__kennzahl_id__, schluessel [UK], anzeigewert, label,
         sortierung, ist_berechnet)
```

## Schlüsselstrategie

Jede Relation trägt **beides**: einen bedeutungslosen Surrogatschlüssel
als Primärschlüssel und den fachlichen Schlüssel als
Eindeutigkeitsbedingung.

Der Grund ist Erfahrung, nicht Geschmack. Fachliche Schlüssel ändern
sich: eine Rahmennummer wird beim Tausch des Rahmens neu vergeben, eine
E-Mail-Adresse wechselt. Ein Primärschlüssel, der sich ändert, zieht die
Änderung durch jede verweisende Relation. Ein Surrogatschlüssel ändert
sich nie, weil er nichts bedeutet.

Umgekehrt reicht der Surrogatschlüssel allein nicht: ohne die
Eindeutigkeitsbedingung auf `rahmennummer` ließen sich zwei Räder mit
derselben Nummer anlegen. **Beide Schlüssel haben eine Aufgabe.**

## Referenzielle Integrität

Vorgabe ist `ON DELETE RESTRICT`. `CASCADE` nur bei echter
Existenzabhängigkeit: eine Entgeltposition ohne Ausleihe ist sinnlos,
eine Rechnungsposition ohne Rechnung ebenso. Ein Kunde mit Ausleihen
lässt sich dagegen nicht löschen — Belegdaten dürfen nicht
stillschweigend verschwinden.

## Was daran didaktisch zählt

Die Abbildung ERM → Relationenmodell ist **regelbasiert und damit
prüfbar**. Wer eine 1:N-Beziehung auf der Eins-Seite verankert, hat nicht
anders entworfen, sondern falsch abgebildet.
