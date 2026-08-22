# 07 Sicherheitskonzept

> Der Schutz liegt vollständig in der Datenbank. Auf den Browser kann man
> sich grundsätzlich nicht verlassen.

## Bedrohungsmodell

Der anon-Key steht in `src/config.js` und wird an **jeden** Besucher
ausgeliefert. Er ist kein Geheimnis und war nie eines. Jeder kann damit
beliebige Anfragen an die REST-Schnittstelle stellen — mit `curl`, ohne
die Website je zu öffnen.

Daraus folgt: **jede** Zugriffsbeschränkung, die im JavaScript steht, ist
wirkungslos. Der Schutz muss in der Datenbank liegen.

## Grundhaltung: default deny

Row Level Security ist auf **allen** Basistabellen des Schemas aktiv.
`GRANT SELECT ON ALL TABLES` wird nicht verwendet; Rechte werden einzeln
vergeben.

| Rolle | Erreicht |
|---|---|
| `anon` | ausschließlich die sieben öffentlichen Sichten |
| `authenticated` | zusätzlich die eigenen Zeilen von neun Tabellen und die vier `api_`-Funktionen |
| niemand von außen | Basistabellen mit Personenbezug, `adresse`, die `fn_`-Fachlogik |

## Zwei Arten von Sichten

**Öffentliche Sichten** laufen mit den Rechten ihres Eigentümers
(PostgreSQL-Standard) und umgehen damit RLS. Das ist beabsichtigt und
genau deshalb enthalten sie **ausschließlich** Spalten ohne
Personenbezug. Der Test `test_v_kein_personenbezug` prüft das maschinell
gegen `information_schema`.

**Persönliche Sichten** `v_meine_ausleihe` und `v_meine_rechnung` sind mit
`security_invoker = true` angelegt: sie laufen mit den Rechten des
Aufrufers, die Zeilenbegrenzung übernehmen die RLS-Regeln.

**Die begründete Ausnahme:** `v_mein_profil` verknüpft `adresse`. Ein
Leserecht auf `adresse` für `authenticated` würde die Anschriften **aller**
Kunden öffnen. Diese Sicht läuft deshalb mit Definer-Rechten und filtert
selbst über `where kunde.auth_uid = auth.uid()`. `adresse` bekommt weder
Policy noch Leserecht.

## Schichtung der Funktionen

```
Browser  →  api_*   (SECURITY DEFINER, loest auth.uid() auf)
              ↓
            fn_*    (Fachlogik, bekommt kunde_id als Parameter)
```

Die `fn_`-Schicht prüft **nicht** auf `auth.uid()` — das ist Aufgabe der
Schicht darüber. Genau deshalb darf sie von außen nicht aufrufbar sein.

### Die Falle mit PUBLIC

PostgreSQL vergibt `EXECUTE` auf jede neu angelegte Funktion automatisch
an die Rolle `PUBLIC`. Ein

```sql
revoke all on all functions in schema velocity from anon, authenticated;
```

greift deshalb **nicht**: beide Rollen erben das Recht weiterhin über
`PUBLIC`. Nötig ist

```sql
revoke all on all functions in schema velocity from public, anon, authenticated;
alter default privileges in schema velocity revoke execute on functions from public;
```

Ohne die erste Zeile hätte jeder mit dem öffentlichen anon-Key
`fn_ausleihe_beenden` aufrufen und damit fremde Ausleihen abrechnen
können. Aufgedeckt hat das der Test `test_s_api_rechte` — nicht
Nachdenken, sondern Prüfen.

## Kein Trigger auf `auth.users`

Naheliegend wäre ein Trigger, der bei jeder Registrierung den Kundensatz
anlegt. Dagegen sprechen zwei Dinge:

1. `auth` ist ein **Fremdschema**, das sich mehrere Anwendungen dieser
   Instanz teilen. Dort hängt bereits ein Trigger einer anderen Anwendung.
2. Ein Fehler im Trigger bricht die Registrierung ab — für alle
   Anwendungen.

Stattdessen ruft die Website nach jeder Anmeldung idempotent
`api_kunde_sicherstellen()` auf. Existiert bereits ein Kundensatz mit
derselben E-Mail (etwa aus der Datenübernahme), wird er mit dem Konto
verknüpft statt doppelt angelegt.

## Was nicht gespeichert wird

`zahlungsmittel` hält ausschließlich das Token des
Zahlungsdienstleisters. Weder IBAN noch Kartennummer. Was nicht
gespeichert wird, kann nicht abfließen.

Ebenso gibt es keine Passwortspalte: die Anmeldung liegt vollständig bei
Supabase Auth.

## Nachweis statt Behauptung

Ein Sicherheitskonzept, das nur beschrieben ist, ist wertlos. Geprüft wird
auf drei Wegen:

| Weg | Werkzeug |
|---|---|
| In der Datenbank | `db/tests/t0011_sicherheit.sql` — RLS überall aktiv, `anon` ohne Tabellenrechte, Rollenwechsel-Probe |
| Über die REST-Schnittstelle | `tools/rest_security_check.py` — 13 gesperrte Ressourcen, 7 öffentliche |
| Im Browser | Konsolenaufrufe der abgemeldeten Seite, siehe `doku/verifikation/` |

### Eine Falle im Prüfwerkzeug selbst

Der erste Entwurf von `rest_security_check.py` meldete alle 13 gesperrten
Ressourcen als bestanden — obwohl er nichts geprüft hatte. Das Schema war
bei PostgREST gar nicht exponiert, also war **alles** unerreichbar,
Sicheres wie Unsicheres.

Das Werkzeug erkennt diesen Fall jetzt (`PGRST106`) und bricht mit
Rückgabewert 2 ab. **Ein Test, der nicht zwischen „abgesichert" und
„gar nicht erreichbar" unterscheidet, ist gefährlicher als kein Test:**
er erzeugt Vertrauen, das er nicht rechtfertigt.

## Was daran didaktisch zählt

Sicherheit ist eine Eigenschaft des **Systems**, nicht des Codes. Sie
ergibt sich aus Rechten, Regeln und Sichten — und sie ist nur dann
vorhanden, wenn man sie von außen nachgewiesen hat.
