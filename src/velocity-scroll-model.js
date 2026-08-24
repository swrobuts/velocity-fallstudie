(function exposeVelocityScrollModel(globalScope) {
  const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));

  const smoothstep = (edge0, edge1, value) => {
    const t = clamp((value - edge0) / (edge1 - edge0));
    return t * t * (3 - 2 * t);
  };

  const mix = (from, to, amount) => from + (to - from) * amount;

  function approachProgress(rawCurrent, rawTarget, rawDeltaMs) {
    const current = clamp(Number.isFinite(rawCurrent) ? rawCurrent : 0);
    const target = clamp(Number.isFinite(rawTarget) ? rawTarget : current);
    const deltaMs = clamp(Number.isFinite(rawDeltaMs) ? rawDeltaMs : 16, 0, 64);
    if (Math.abs(target - current) < 0.0001) return target;

    // Exponential damping stays consistent across 60/120 Hz displays and
    // absorbs large wheel or trackpad deltas without making the UI feel heavy.
    const blend = 1 - Math.exp(-deltaMs / 80);
    return mix(current, target, blend);
  }

  function getTypographyScale(rawWidth) {
    const width = clamp(Number.isFinite(rawWidth) ? rawWidth : 1280, 320, 1920);
    const desktopProgress = clamp((width - 900) / 1020);
    const heroProgress = clamp((width - 390) / 1362);

    return {
      navPx: Math.round(mix(17, 19, desktopProgress)),
      metaPx: Math.round(mix(14, 15, desktopProgress)),
      heroPx: Math.round(mix(52, 96, heroProgress)),
      controlPx: Math.round(mix(15, 17, desktopProgress)),
      bodyPx: Math.round(mix(15, 17, desktopProgress)),
    };
  }

  /* DREI STATIONEN AUF EINER SCHIENE
     -------------------------------------------------------------------
     Der Kopfbereich zeigt nacheinander E-Bike, City-Bike und E-Cargo
     Loader. Die drei stehen auf EINER Schiene, und der Scrollfortschritt
     sagt nur, wo auf dieser Schiene man gerade ist:

       ort = 0   E-Bike
       ort = 1   City-Bike
       ort = 2   E-Cargo Loader

     Jedes Rad haengt an seiner Stelle. Sein Versatz ist der Abstand zum
     aktuellen Ort mal eine Bildbreite, seine Deckkraft faellt mit
     wachsendem Abstand. Daraus folgt von selbst, was vorher von Hand
     getaktet war: was ankommt, faehrt von rechts herein, was geht, nach
     links hinaus, und zwei Raeder stehen nie an derselben Stelle.

     WARUM NICHT UEBERBLENDEN
     Bis zum 25.08.2026 lief hier ein WebGL-Morph, der zwei Fotos
     ineinander rechnete. Auf halber Strecke standen zwei Rahmen und
     vier Laufraeder versetzt uebereinander - eine Doppelbelichtung, kein
     Uebergang. Zwei Fotos VERSCHIEDENER Raeder lassen sich nicht
     ineinander blenden, so kurz die Blende auch ist. Also wechseln sie
     den Platz statt der Deckkraft.

     Die Wand liegt als eigene, stehende Ebene darunter; die Raeder sind
     freigestellt und massstabsgleich auf dieselbe Standlinie gesetzt.

     HALTEN UND FAHREN
     Zwischen den Stationen liegt jeweils eine Fahrt, davor und danach
     ein Halt. Ohne diesen Halt liefe die Schiene durch und man haette
     nie ein ruhiges Bild:

       0.00 – 0.22  E-Bike haelt          (22 %)
       0.22 – 0.38  Fahrt                 (16 %)
       0.38 – 0.56  City-Bike haelt       (18 %)
       0.56 – 0.72  Fahrt                 (16 %)
       0.72 – 1.00  E-Cargo Loader haelt  (28 %, mit Auswahl und Aufruf)

     Die Haltezeiten sind bewusst aehnlich lang. In der ersten Fassung
     hielt das City-Bike nur 12 Prozent - es wirkte wie eine Durchfahrt
     zwischen zwei Stationen statt wie eine eigene.
  */
  const STATIONEN = ['ebike', 'city', 'cargo'];

  // Wie weit ein Rad vom aktuellen Ort entfernt sein darf, bevor es
  // verblasst - und ab wann es ganz weg ist.
  const NAH = 0.55;
  const FERN = 0.92;

  function radZustand(index, ort) {
    const abstand = Math.abs(index - ort);
    return {
      versatz: index - ort,                       // in Bildbreiten
      deckkraft: 1 - smoothstep(NAH, FERN, abstand),
      zeile: 1 - smoothstep(0.06, 0.34, abstand)  // die Schlagzeile dazu
    };
  }

  function getScrollState(rawProgress) {
    const progress = clamp(Number.isFinite(rawProgress) ? rawProgress : 0);
    const spatialShift = smoothstep(0.08, 0.86, progress);

    // Der Ort auf der Schiene. Zwei Fahrten, dazwischen und danach Halt.
    const ort = smoothstep(0.22, 0.38, progress) + smoothstep(0.56, 0.72, progress);

    return {
      progress,
      ort,
      activeProduct: STATIONEN[Math.min(2, Math.round(ort))],
      raeder: STATIONEN.map((name, i) => ({ name, ...radZustand(i, ort) })),
      // Die letzte Zeile tritt ab, sobald Auswahl und Aufruf kommen.
      letzteZeileDaempfung: 1 - smoothstep(0.82, 0.89, progress),
      choiceOpacity: smoothstep(0.78, 0.86, progress),
      ctaOpacity: smoothstep(0.89, 0.95, progress),
      bikeScale: mix(1.06, 1, spatialShift),
      bikeX: mix(3, 0, spatialShift)
    };
  }

  /* Ein Klick auf die Pille faehrt dieselbe Schiene an - nur nicht ueber
     den Scrollbalken, sondern in der Zeit. Damit sieht ein Wechsel per
     Klick genauso aus wie einer beim Scrollen. */
  function getManualState(baseState, ort) {
    const gehalten = clamp(Number.isFinite(ort) ? ort : 0, 0, STATIONEN.length - 1);
    return {
      ...baseState,
      ort: gehalten,
      activeProduct: STATIONEN[Math.min(2, Math.round(gehalten))],
      raeder: STATIONEN.map((name, i) => ({ name, ...radZustand(i, gehalten) }))
    };
  }

  const api = {
    approachProgress,
    getScrollState,
    getManualState,
    getTypographyScale,
    STATIONEN,
  };
  globalScope.VelocityScrollModel = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
}(typeof globalThis !== 'undefined' ? globalThis : this));
