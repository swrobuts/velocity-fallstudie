/* =====================================================================
   KOPFBEREICH — Steuerung der scrollgesteuerten Buehne

   Uebernommen aus dem Entwurf des Nutzers (velocity-startsite), dort
   als Inline-Skript. Hier als eigene Datei, damit index.html lesbar
   bleibt und die Reihenfolge der Skripte klar ist.

   Geaendert wurde ausschliesslich: die beiden Bildpfade zeigen auf
   assets/. Die gesamte Animationslogik ist unveraendert.

   Die umschliessende Funktion verhindert, dass Namen wie "state" oder
   "tabs" mit script.js kollidieren - beide laufen im selben Fenster.
   ===================================================================== */
(function () {
  'use strict';

    const { approachProgress, getScrollState, getBikeAlignment, getManualMorphState } = window.VelocityScrollModel;

    const story = document.querySelector('.scroll-story');
    const stage = document.querySelector('.sticky-stage');
    const tabs = [...document.querySelectorAll('.product-tab')];
    const productCopy = document.querySelector('.product-copy');
    const ebikeClaim = document.querySelector('.claim-ebike');
    const cityClaim = document.querySelector('.claim-city');
    const ebikePhoto = document.querySelector('.photo-ebike');
    const morphCanvas = document.querySelector('.photo-morph');
    const cityImageAlignment = getBikeAlignment('city');
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
    let state = getScrollState(0);
    let presentedState = state;
    let manualProduct = null;
    let frameRequested = false;
    let animationFrameId = 0;
    let manualFrameId = 0;
    let manualAnimationSerial = 0;
    let targetProgress = 0;
    let displayedProgress = 0;
    let lastFrameTime = 0;
    let renderedProduct = null;
    let renderedEbikeHidden = null;
    let renderedCityHidden = null;
    let morphRenderer = {
      available: false,
      render() {},
      resize() {},
      destroy() {}
    };

    const productContent = {
      city: ['Entspannt shoppen.', 'Noch entspannter nach Hause cruisen.'],
      ebike: ['Wir liefern den Rückenwind.', 'Elektrische Unterstützung für Würzburgs Berge.']
    };

    function renderProduct(product) {
      const selected = product === 'ebike' ? 'ebike' : 'city';
      if (selected === renderedProduct) return;
      renderedProduct = selected;
      tabs.forEach(tab => tab.setAttribute('aria-pressed', String(tab.dataset.product === selected)));
      const [title, description] = productContent[selected];
      productCopy.querySelector('strong').textContent = title;
      productCopy.querySelector('small').textContent = description;
    }

    function commitMotion(nextState) {
      presentedState = nextState;
      const useMorph = morphRenderer.available && !reducedMotion.matches;
      const cityOpacity = useMorph ? nextState.cityOpacity : nextState.fallbackCityOpacity;
      const ebikeOpacity = useMorph ? nextState.ebikeOpacity : nextState.fallbackEbikeOpacity;
      const morphVisibility = useMorph ? nextState.morphVisibility : 0;
      stage.style.cssText = [
        `--progress:${nextState.progress.toFixed(4)}`,
        `--ebike-claim-opacity:${nextState.ebikeClaimOpacity.toFixed(4)}`,
        `--city-claim-opacity:${nextState.cityClaimOpacity.toFixed(4)}`,
        `--city-opacity:${cityOpacity.toFixed(4)}`,
        `--ebike-opacity:${ebikeOpacity.toFixed(4)}`,
        `--morph-visibility:${morphVisibility.toFixed(4)}`,
        `--morph-progress:${nextState.morphProgress.toFixed(4)}`,
        `--transition-cover-opacity:${nextState.transitionCoverOpacity.toFixed(4)}`,
        `--choice-opacity:${nextState.choiceOpacity.toFixed(4)}`,
        `--cta-opacity:${nextState.ctaOpacity.toFixed(4)}`,
        `--bike-scale:${nextState.bikeScale.toFixed(4)}`,
        `--bike-x:${nextState.bikeX.toFixed(3)}`,
        `--city-align-scale-x:${cityImageAlignment.scaleX.toFixed(6)}`,
        `--city-align-scale-y:${cityImageAlignment.scaleY.toFixed(6)}`,
        `--city-align-x:${cityImageAlignment.translateXPercent.toFixed(6)}`,
        `--city-align-y:${cityImageAlignment.translateYPercent.toFixed(6)}`
      ].join(';');
      if (useMorph && morphVisibility > 0.0001) morphRenderer.render(nextState.morphProgress);
    }

    function updateClaimVisibility(nextState) {
      const ebikeHidden = nextState.ebikeClaimOpacity < 0.5;
      const cityHidden = nextState.cityClaimOpacity < 0.5;
      if (ebikeHidden !== renderedEbikeHidden) {
        renderedEbikeHidden = ebikeHidden;
        ebikeClaim.setAttribute('aria-hidden', String(ebikeHidden));
      }
      if (cityHidden !== renderedCityHidden) {
        renderedCityHidden = cityHidden;
        cityClaim.setAttribute('aria-hidden', String(cityHidden));
      }
    }

    function selectProduct(product, isManual = false) {
      const selected = product === 'ebike' ? 'ebike' : 'city';
      if (isManual) {
        animateManualProductChange(renderedProduct, selected);
        return;
      }
      renderProduct(selected);
    }

    function animateManualProductChange(fromProduct, toProduct) {
      const from = fromProduct === 'ebike' ? 'ebike' : 'city';
      const to = toProduct === 'ebike' ? 'ebike' : 'city';
      if (from === to) return;

      if (frameRequested) cancelAnimationFrame(animationFrameId);
      cancelAnimationFrame(manualFrameId);
      frameRequested = false;
      lastFrameTime = 0;
      manualProduct = to;
      stage.classList.add('is-manual');
      const serial = ++manualAnimationSerial;
      const baseState = { ...state };
      const duration = reducedMotion.matches ? 0 : 860;
      const startTime = performance.now();

      function advance(timestamp) {
        if (serial !== manualAnimationSerial) return;
        const elapsed = duration === 0 ? 1 : Math.min(1, (timestamp - startTime) / duration);
        const manualState = getManualMorphState(baseState, from, to, elapsed);
        commitMotion(manualState);
        updateClaimVisibility(manualState);
        if (manualState.activeProduct !== renderedProduct) renderProduct(manualState.activeProduct);

        if (elapsed < 1) {
          manualFrameId = requestAnimationFrame(advance);
          return;
        }

        renderProduct(to);
        stage.classList.remove('is-manual');
      }

      manualFrameId = requestAnimationFrame(advance);
    }

    function readNativeProgress() {
      const bounds = story.getBoundingClientRect();
      const scrollable = story.offsetHeight - window.innerHeight;
      return scrollable > 0 ? Math.min(1, Math.max(0, -bounds.top / scrollable)) : 0;
    }

    function applyProgress(progress) {
      state = getScrollState(progress);
      commitMotion(state);
      updateClaimVisibility(state);

      if (!manualProduct && state.activeProduct !== renderedProduct) renderProduct(state.activeProduct);
    }

    function animate(timestamp) {
      const deltaMs = lastFrameTime ? timestamp - lastFrameTime : 16;
      lastFrameTime = timestamp;
      displayedProgress = approachProgress(displayedProgress, targetProgress, deltaMs);
      applyProgress(displayedProgress);

      if (Math.abs(targetProgress - displayedProgress) > 0.00015) {
        animationFrameId = requestAnimationFrame(animate);
        return;
      }

      displayedProgress = targetProgress;
      applyProgress(displayedProgress);
      frameRequested = false;
      lastFrameTime = 0;
    }

    function requestRender() {
      cancelAnimationFrame(manualFrameId);
      manualAnimationSerial += 1;
      manualProduct = null;
      stage.classList.remove('is-manual');
      targetProgress = readNativeProgress();
      if (!frameRequested) {
        frameRequested = true;
        lastFrameTime = 0;
        animationFrameId = requestAnimationFrame(animate);
      }
    }

    async function initializeHero() {
      morphRenderer = await window.VelocityBikeMorph.createRenderer(morphCanvas, {
        ebikeUrl: './assets/velocity-bike-hero.png',
        cityUrl: './assets/velocity-bike-city-hero.png',
        cityAlignment: cityImageAlignment,
        maxDevicePixelRatio: 2,
        referenceElement: ebikePhoto,
        onAvailabilityChange(available) {
          stage.classList.toggle('no-webgl', !available);
          commitMotion(presentedState);
        }
      });
      stage.classList.toggle('no-webgl', !morphRenderer.available);
      commitMotion(presentedState);
    }

    tabs.forEach(tab => tab.addEventListener('click', () => selectProduct(tab.dataset.product, true)));
    addEventListener('scroll', requestRender, { passive: true });
    addEventListener('resize', () => {
      morphRenderer.resize();
      requestRender();
    });
    reducedMotion.addEventListener?.('change', () => commitMotion(presentedState));
    addEventListener('pagehide', () => morphRenderer.destroy(), { once: true });
    targetProgress = readNativeProgress();
    displayedProgress = targetProgress;
    applyProgress(displayedProgress);
    initializeHero();
})();
