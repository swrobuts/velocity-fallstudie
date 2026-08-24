(function exposeVelocityScrollModel(globalScope) {
  const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));

  const smoothstep = (edge0, edge1, value) => {
    const t = clamp((value - edge0) / (edge1 - edge0));
    return t * t * (3 - 2 * t);
  };

  const mix = (from, to, amount) => from + (to - from) * amount;

  function getMorphEnvelope(rawCityMix) {
    const progress = clamp(Number.isFinite(rawCityMix) ? rawCityMix : 0);
    const visibility = smoothstep(0.001, 0.08, progress)
      * (1 - smoothstep(0.92, 0.999, progress));
    return { progress, visibility };
  }

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

  function getBikeAlignment(product) {
    if (product !== 'city') {
      return {
        scaleX: 1,
        scaleY: 1,
        translateXPx: 0,
        translateYPx: 0,
        translateXPercent: 0,
        translateYPercent: 0,
      };
    }

    // The source canvases are identical, but the photographed City Bike is
    // slightly smaller and sits farther left. Match the wheel diameter first,
    // then align the midpoint between both hubs and their shared ground line.
    const imageWidth = 1618;
    const imageHeight = 972;
    const imageCenterX = imageWidth / 2;
    const imageCenterY = imageHeight / 2;
    const cityRearHub = { x: 458.3, y: 624.8 };
    const cityFrontHub = { x: 1198.2, y: 624.8 };
    const ebikeRearHub = { x: 470.5, y: 623 };
    const ebikeFrontHub = { x: 1230, y: 623 };
    const cityHubMidpoint = { x: (cityRearHub.x + cityFrontHub.x) / 2, y: cityRearHub.y };
    const ebikeHubMidpoint = { x: (ebikeRearHub.x + ebikeFrontHub.x) / 2, y: ebikeRearHub.y };
    const scaleX = (ebikeFrontHub.x - ebikeRearHub.x) / (cityFrontHub.x - cityRearHub.x);
    const scaleY = 480 / 470;
    const translateXPx = ebikeHubMidpoint.x - (imageCenterX + (cityHubMidpoint.x - imageCenterX) * scaleX);
    const translateYPx = ebikeHubMidpoint.y - (imageCenterY + (cityHubMidpoint.y - imageCenterY) * scaleY);

    return {
      scaleX,
      scaleY,
      translateXPx,
      translateYPx,
      translateXPercent: translateXPx / imageWidth * 100,
      translateYPercent: translateYPx / imageHeight * 100,
    };
  }

  /* WECHSEL STATT UEBERBLENDUNG
     -------------------------------------------------------------------
     Bis zum 25.08.2026 lief hier ein WebGL-Morph: beide Fotos gleichzeitig
     sichtbar, ineinander gerechnet. Zwei verschiedene Fahrraeder lassen
     sich aber nicht ineinander blenden. Auf halber Strecke standen zwei
     Rahmen und vier Laufraeder versetzt uebereinander - das sah nicht
     nach Verwandlung aus, sondern nach Darstellungsfehler.

     Drei Versuche, zwei davon daneben:

     1. Beide Fotos gleichzeitig sichtbar (der WebGL-Morph) - auf halber
        Strecke zwei Rahmen und vier Laufraeder uebereinander.
     2. Erst ab-, dann aufblenden - dann steht die Buehne fuer knapp
        200 Bildpunkte Scrollweg leer.

     Der Fehler steckte in der Annahme. Zwei Fotos VERSCHIEDENER Raeder
     lassen sich nicht ineinander blenden, so kurz die Blende auch ist:
     zwei Rahmen an derselben Stelle ergeben immer eine Doppelbelichtung.
     Auch ein heller Schleier darueber macht daraus keine Verwandlung.

     Also wechseln sie den PLATZ statt der Deckkraft. Die Raeder sind
     freigestellt (rad-ebike-frei.png, rad-city-frei.png) und liegen auf
     einer eigenen, stehenden Wand. Das E-Bike faehrt nach links aus dem
     Bild, das City-Bike von rechts herein. Auf halber Strecke liegt
     eine volle Bildbreite zwischen ihnen - sie beruehren einander nie.

       0.00 – 0.36   E-Bike steht
       0.36 – 0.52   Wechsel: eines raus, eines rein
       0.52 – 1.00   City-Bike steht

     Freigestellt wurden sie ueber den zeilenweisen Median des Fotos:
     die Wand ist in jeder Zeile fast gleichmaessig, das Rad weicht
     davon ab. Speichen, Reifen und Schatten bleiben erhalten. */
  function getScrollState(rawProgress) {
    const progress = clamp(Number.isFinite(rawProgress) ? rawProgress : 0);
    const spatialShift = smoothstep(0.08, 0.78, progress);

    // Ein Weg fuer beide: was das eine an Strecke gewinnt, verliert das
    // andere. Die Deckkraft haelt dabei lange oben - sie greift erst,
    // wenn das Rad ohnehin fast aus dem Bild ist.
    const weg      = smoothstep(0.36, 0.52, progress);
    const ebikeAus = weg;
    const cityEin  = weg;
    const cityReveal = cityEin;

    return {
      progress,
      activeProduct: progress < 0.44 ? 'ebike' : 'city',
      ebikeClaimOpacity: 1 - smoothstep(0.26, 0.36, progress),
      // Die Zeile kommt, sobald das Rad steht - nicht erst danach. Ohne
      // das blieb die Buehne fuer rund 375 Bildpunkte wortlos.
      cityClaimOpacity: smoothstep(0.49, 0.56, progress) * (1 - smoothstep(0.66, 0.72, progress)),
      // Deckkraft nur an den Raendern: das ausfahrende Rad verblasst
      // erst kurz vor dem Bildrand, das einfahrende ist da schon da.
      cityOpacity: smoothstep(0.37, 0.45, progress),
      ebikeOpacity: 1 - smoothstep(0.44, 0.52, progress),
      fallbackCityOpacity: smoothstep(0.37, 0.45, progress),
      fallbackEbikeOpacity: 1 - smoothstep(0.44, 0.52, progress),
      // Der Morph ist stillgelegt. Die Felder bleiben, damit alter Code
      // und die Tests nicht ins Leere greifen.
      morphProgress: cityEin,
      morphVisibility: 0,
      // Kein Schleier mehr noetig: es gibt nichts zu ueberstrahlen.
      transitionCoverOpacity: 0,
      // Richtung fuer den Wechsel: abgehend zurueck, kommend vor.
      ebikeExit: ebikeAus,
      cityEnter: cityEin,
      choiceOpacity: smoothstep(0.68, 0.76, progress),
      ctaOpacity: smoothstep(0.78, 0.85, progress),
      bikeScale: mix(1.06, 1, spatialShift),
      bikeX: mix(3, 0, spatialShift),
    };
  }

  function getManualProductState(baseState, product) {
    const selected = product === 'ebike' ? 'ebike' : 'city';
    const cityOpacity = selected === 'city' ? 1 : 0;
    return {
      ...baseState,
      activeProduct: selected,
      cityOpacity,
      ebikeOpacity: 1 - cityOpacity,
      fallbackCityOpacity: cityOpacity,
      fallbackEbikeOpacity: 1 - cityOpacity,
      transitionCoverOpacity: 0,
      morphProgress: cityOpacity,
      morphVisibility: 0,
    };
  }

  function getManualMorphState(baseState, fromProduct, toProduct, rawProgress) {
    const elapsed = smoothstep(0, 1, clamp(Number.isFinite(rawProgress) ? rawProgress : 0));
    const fromMix = fromProduct === 'city' ? 1 : 0;
    const toMix = toProduct === 'city' ? 1 : 0;
    const fallbackCityOpacity = mix(fromMix, toMix, elapsed);
    const fallbackEbikeOpacity = 1 - fallbackCityOpacity;
    const morph = getMorphEnvelope(fallbackCityOpacity);
    const photoVisibility = 1 - morph.visibility;

    return {
      ...baseState,
      activeProduct: elapsed < 0.5 ? fromProduct : toProduct,
      cityOpacity: fallbackCityOpacity * photoVisibility,
      ebikeOpacity: fallbackEbikeOpacity * photoVisibility,
      fallbackCityOpacity,
      fallbackEbikeOpacity,
      transitionCoverOpacity: 0,
      morphProgress: morph.progress,
      morphVisibility: morph.visibility,
    };
  }

  const api = {
    approachProgress,
    getScrollState,
    getTypographyScale,
    getBikeAlignment,
    getManualProductState,
    getMorphEnvelope,
    getManualMorphState,
  };
  globalScope.VelocityScrollModel = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
}(typeof globalThis !== 'undefined' ? globalThis : this));
