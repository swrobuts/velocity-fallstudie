# Repository-Prüfung und Bugfixes, 15.09.2026

Ausgangspunkt: `d4b74c424d21026884553af25d25c16c6d4bb0cb`, nach Abruf von
`origin/main`. Die lokale Arbeitskopie stand auf demselben Commit.

## Behobene Fehler

- **Passwort-Wiederherstellung:** Der Mail-Link stellte eine Sitzung her,
  anschließend fehlte das Formular zum Setzen des neuen Passworts. Das
  Ereignis `PASSWORD_RECOVERY` bleibt nun bis zum erfolgreichen Speichern
  erhalten. Das Formular prüft die Wiederholung, zeigt Fehler und lässt
  sich nach dem Schließen über den Kontoknopf wieder öffnen. Die Umsetzung
  folgt dem [Supabase-Ablauf](https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail).
- **Dashboard und laufende Fahrt:** Nach einem Kontowechsel konnten alte
  Fahrten, Schätzhinweise und verspätete Antworten erneut erscheinen.
  Ein neuer Ladelauf entfernt die bisherigen Dashboard-Inhalte und prüft
  vor der Darstellung Konto und Laufnummer. Lesefehler aller vier
  Dashboard-Sichten werden angezeigt. Auch Ausleihbanner, Preiseinstellung
  und gespeicherter Lesefehlerstatus verwerfen überholte Antworten.
- **Warenwirtschaft:** Wiederholtes `SIGNED_IN` desselben Kontos konnte
  die Oberfläche mit offenen Eingaben neu aufbauen. Der Neuaufbau erfolgt
  nun bei Kontowechsel beziehungsweise `USER_UPDATED`. Überholte
  Rollenabfragen schreiben weder in den Rollenspeicher noch in einen
  inzwischen neu gestarteten Seitenaufbau.
- **Cache-Fingerabdrücke:** Windows-CRLF veränderte die Dateiprüfsummen.
  `.gitattributes` legt LF für Textdateien fest; `versionieren.py` schreibt
  LF ausdrücklich. Die Fingerabdrücke wurden einschließlich des zuvor
  unpassenden Stempels für die öffentlichen `src/config.js`-Vorgaben erneuert.
- **Testaufruf:** `npm test` führt jetzt die lokalen Regressionstests aus.

## Nachweise

- 15 JavaScript-Regressionstests mit Node.js 24 und jsdom, darunter das
  vollständige `src/script.js` mit echten HTML-Formularen und Ersatz für
  Supabase, Kartenbibliothek und Browser-Beobachter.
- Die ersten elf Regressionstests schlugen vor den Änderungen fehl und
  bestanden danach. Vier weitere Tests decken Formularbedienung, das
  Ausleihbanner nach Abmeldung und konkurrierende Lesefehler ab.
- Python-Regressionstest für wiederholtes Stempeln, LF-Ausgabe und
  unveränderte Binärdaten.
- Bestehende Prüfungen für Frontend-Vertrag, UX, WaWi-Vertrag,
  Cache-Fingerabdrücke, README-Konsistenz, Notebook-Ausführungszähler,
  Notebooktexte, Notebook-Prüflogik, wirksame Entscheidungsschwellen,
  Freigaben, Dateninvarianten, Preisspannenregel, Diagrammvollständigkeit,
  SQL-Objektlisten und Folienzahlen bestanden.

## Grenzen und Synchronisation

Keine vollständige Live-Abnahme: In der verfügbaren Python-Umgebung fehlt
`psycopg2`; insbesondere `erd_check.py` kann so keine Datenbankverbindung
aufbauen. Die 207 pgTAP-Testfunktionen, echte Registrierung, Mailzustellung
und Live-Ausleihe wurden in diesem Durchgang nicht ausgeführt. Datenbank
und Webserver wurden nicht verändert.

Die Änderungen werden mit der vorhandenen lokalen Arbeitskopie per Git
abgeglichen. Ihre bereits eingetragene Demo-Konfiguration und private
Entwicklungsumgebungseinstellungen bleiben erhalten. Der lokale HTML-Stempel
für diese Demo-Konfiguration darf deshalb vom öffentlichen Repository
abweichen; die Bugfixes und der Git-Commit sind identisch.
