# 01 Anforderungsanalyse

> Erster Schritt des Entwurfszyklus. Bevor eine Tabelle entsteht, muss
> klar sein, worüber überhaupt Daten gehalten werden sollen.

## Die Fallstudie

**VeloCity** betreibt ein Bike-Sharing-System in Würzburg. Kundinnen und
Kunden finden über eine Website freie Räder auf einer Karte, entleihen
sie, fahren und stellen sie wieder ab. Abgerechnet wird minutengenau,
Vielfahrer schließen einen Tarif ab.

Es gibt drei Fahrzeugklassen: ein gewöhnliches Stadtrad, ein Pedelec und
ein elektrisches Lastenrad. Räder stehen an festen Stationen oder frei
im Stadtgebiet.

## Glossar

| Begriff | Bedeutung |
|---|---|
| **Ausleihe** | Ein Nutzungsvorgang von der Entnahme bis zur Rückgabe |
| **Station** | Fester Standort mit Stellplätzen |
| **Free-Floating** | Ein Rad steht nicht an einer Station, sondern frei im Stadtgebiet |
| **Fahrradtyp** | Fachliche Klasse: City, E-Bike, Cargo |
| **Fahrradmodell** | Konkrete Bauart eines Herstellers innerhalb eines Typs |
| **Tarif** | Preismodell, in das man sich einschreibt |
| **Mitgliedschaft** | Die Einschreibung eines Kunden in einen Tarif für einen Zeitraum |
| **Freiminuten** | Monatliches Kontingent kostenloser Fahrminuten eines Tarifs |
| **Entgeltposition** | Eine einzelne Zeile der Abrechnung einer Ausleihe |
| **Startgebühr** | Einmaliges Entgelt je Ausleihe |
| **Tageshöchstpreis** | Obergrenze des Entgelts je Ausleihe |

## Geschäftsregeln

Diese zehn Regeln sind die fachliche Substanz. Jede einzelne muss im
fertigen System **durchgesetzt** sein, nicht nur dokumentiert.

| Nr. | Regel |
|---|---|
| GR1 | Ein Fahrrad ist zu einem Zeitpunkt höchstens einmal aktiv ausgeliehen |
| GR2 | Ein Kunde hat höchstens vier gleichzeitig aktive Ausleihen |
| GR3 | Ein Kunde hat zu einem Zeitpunkt höchstens einen gültigen Tarif |
| GR4 | Preise und Tarifkonditionen überlappen sich zeitlich nie |
| GR5 | Bepreist wird mit dem zum **Startzeitpunkt** gültigen Preis |
| GR6 | Angefangene Minuten werden aufgerundet |
| GR7 | Verbrauchte Freiminuten übersteigen nie das Monatskontingent |
| GR8 | Mindestalter 16 Jahre |
| GR9 | Nur der Kunde selbst darf seine Ausleihe beenden |
| GR10 | Rechnungen werden je Kunde und Monat genau einmal erzeugt |

Wo jede Regel durchgesetzt wird, steht in `05-physisches-modell.md`.

## Mengengerüst

| Entität | Größenordnung |
|---|---|
| Kunden | rund 1000 |
| Fahrräder | rund 350 |
| Stationen | rund 15 |
| Ausleihen | wachsend, mehrere je Rad und Tag zu erwarten |
| Fahrradtypen, Tarife | einstellig, selten geändert |

Daraus folgt für den Entwurf: `ausleihe` und `entgeltposition` sind die
einzigen Relationen, die stark wachsen. Sie brauchen Indizes auf den
Zugriffspfaden der Anwendung; alles Übrige ist klein genug, dass
Lesbarkeit vor Optimierung geht.

## Was daran didaktisch zählt

Anforderungen werden in **Substantiven** und **Regeln** notiert, nicht in
Tabellen. Wer hier schon Spalten entwirft, hat den konzeptionellen
Entwurf übersprungen und bindet sich zu früh an eine Umsetzung.
