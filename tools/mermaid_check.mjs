// Prueft Mermaid-Quellen gegen den Parser.
// Aufruf: node tools/mermaid_check.mjs doku/datenmodell/erd/*.mmd
//
// Mermaid braucht fuer Flowcharts eine DOM-Umgebung (DOMPurify greift auf
// window zu). ER-Diagramme kommen ohne aus. Damit alle Diagrammarten
// geprueft werden koennen, wird hier vorab ein DOM bereitgestellt.
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.DOMPurify = dom.window.DOMPurify;
// navigator ist in Node 21+ ein reiner Getter und laesst sich nicht
// zuweisen; definieren geht.
if (!globalThis.navigator) {
  Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
}

const mermaid = (await import('mermaid')).default;

const dateien = process.argv.slice(2);
if (dateien.length === 0) {
  console.error('Keine Dateien angegeben.');
  process.exit(2);
}

let fehler = 0;
for (const datei of dateien) {
  try {
    await mermaid.parse(fs.readFileSync(datei, 'utf8'));
    console.log('OK     ' + datei);
  } catch (e) {
    fehler++;
    console.log('FEHLER ' + datei + '\n  ' + String(e.message || e).split('\n').slice(0, 6).join('\n  '));
  }
}
process.exit(fehler ? 1 : 0);
