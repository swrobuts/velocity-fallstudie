/* ─────────────────────────────────────────────────────────────────────
   Verbindungsdaten für das Velocity-Netzcockpit

   Diese Datei nach  config.js  kopieren, Werte eintragen und neben
   velocity-cockpit.html ablegen. Die Kopie gehört in .gitignore.

   Ohne config.js läuft das Cockpit aus dem eingebetteten Snapshot.
   ───────────────────────────────────────────────────────────────────── */

window.WAWI_CONF = {

  /* Basis-URL der PostgREST-Schnittstelle, ohne Schrägstrich am Ende.
     Zwei Varianten:

     a) Direkt gegen Supabase — Schlüssel liegt dann im Browser offen:
        BASIS: "https://<projekt-ref>.supabase.co/rest/v1"

     b) Über einen Traefik-Proxy auf butscher.cloud, der den
        apikey-Header serverseitig setzt. KEY bleibt dann leer:
        BASIS: "/api/wawi"                                            */
  BASIS: "",

  /* anon- bzw. publishable-Key. Bei Variante b leer lassen.
     Niemals den service-role-Key: er steht im Klartext im Browser
     und umgeht jede Row-Level-Security.                              */
  KEY: "",

  /* Nur nötig, wenn die v_wawi_*-Sichten nicht im Schema "public"
     liegen. Wird als Accept-Profile-Header gesendet.                 */
  SCHEMA: ""
};

/* ─────────────────────────────────────────────────────────────────────
   Voraussetzungen auf der Datenbankseite

   1. Lesender Zugriff für die anonyme Rolle auf genau diese Sichten:
        v_wawi_station, v_wawi_stationsauslastung,
        v_wawi_stationsverkehr_zeitfenster, v_wawi_kundenorte,
        v_wawi_km_co2, v_wawi_flotte, v_wawi_fahrten_je_tag
      Alles andere bleibt gesperrt. v_wawi_kunde wird bewusst nicht
      abgefragt — dort stehen Klarnamen.

   2. CORS muss die Domain erlauben, von der die Seite ausgeliefert
      wird. Bei Variante b entfällt das, weil der Abruf dann von
      derselben Herkunft kommt.

   3. Die Sichten v_wawi_umsatz_* und v_wawi_protokoll sind der Rolle
      "leitung" vorbehalten und werden hier nicht verwendet.
   ───────────────────────────────────────────────────────────────────── */
