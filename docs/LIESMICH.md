# docs/ — die veröffentlichte Lehrseite

Dieser Ordner ist die Quelle von **GitHub Pages**:
<https://swrobuts.github.io/velocity-fallstudie/>

Alles hier drin ist öffentlich im Netz erreichbar. Alles außerhalb dieses
Ordners ist es nicht — GitHub Pages veröffentlicht ausschließlich `docs/`.

## Nicht zu verwechseln mit `doku/`

| Ordner | Was | Öffentlich |
|---|---|---|
| `docs/` | die Lehrseite für Studierende: Startseite, Modelldokumentation, Netzcockpit, Werbematerial | **ja** |
| `doku/` | die interne Dokumentation des Projekts: Spezifikationen, Pläne, Verifikationsprotokolle, Datenmodell | nein |

Die Namen liegen unglücklich nah beieinander. `docs` ist aber nicht frei
wählbar: GitHub Pages akzeptiert als Quelle nur das Wurzelverzeichnis oder
genau diesen Ordnernamen. Das Wurzelverzeichnis schied aus, weil damit das
gesamte Repository im Netz stünde.

## Herkunft

Der Inhalt kam am 05.09.2026 aus `velocity-fallbeispiel.zip` und lag
zunächst in einem eigenen Repository `swrobuts/velocity-fallbeispiel`. Das
wurde eingegliedert und gelöscht — zwei Repositorien für eine Fallstudie
waren nach drei Wochen nicht mehr auseinanderzuhalten.

Gegenüber dem Archiv fehlen zwei Dinge, beide mit Absicht:

- **`nicht-fuer-github/`** beschreibt einen MCP-Zugang und verrät die
  Adresse des Servers, auch ohne eingetragenes Token. Die beiliegende
  LIESMICH sagt das selbst.
- **`studi-zugang.sql`** wurde durch `db/betrieb/studizugang_lesend.sql`
  und `db/betrieb/lehrzugang.sql` abgelöst. Der alte Entwurf beschrieb
  Gruppenrollen und maskierte Sichten — ein Ansatz, den der Betreiber am
  05.09.2026 verworfen hat: es sind erfundene Daten, und für Studierende
  wird nichts gesperrt. Die Startseite verweist auf die geltende Fassung.
