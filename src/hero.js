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
    const choicePanel = document.querySelector('.choice-panel');
    const finalCard = document.querySelector('.final-card');
    const productCopy = document.querySelector('.product-copy');
    const ebikeClaim = document.querySelector('.claim-ebike');
    const cityClaim = document.querySelector('.claim-city');
    const ebikePhoto = document.querySelector('.photo-ebike');

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
    const productContent = {
      city:  ['Entspannt shoppen.', 'Noch entspannter nach Hause cruisen.'],
      ebike: ['Wir liefern den Rückenwind.', 'Elektrische Unterstützung für Würzburgs Berge.'],
      cargo: ['Der Wocheneinkauf passt rein.', 'Bis 70 kg Zuladung, elektrisch unterstützt.']
    };

    /* Der Loader nimmt am Ueberblenden nicht teil. Das Ueberblenden
       verwandelt ein Rad in ein anderes; ein Lastenrad ist aber kein
       Zwischenschritt zwischen City und E-Bike, sondern ein drittes
       Fahrzeug. Es wird deshalb ein- und ausgeblendet, waehrend die
       Buehne stillsteht - gesteuert ueber die Klasse is-cargo.

       Angeboten werden drei Typen; wer nur zwei zur Wahl stellt, laesst
       den dritten unter den Tisch fallen. */
    const cargoClaim = document.querySelector('.claim-cargo');

    function cargoSetzen(an) {
      stage.classList.toggle('is-cargo', an);
      if (cargoClaim) cargoClaim.setAttribute('aria-hidden', String(!an));
      if (an) {
        tabs.forEach(t => t.setAttribute('aria-pressed', String(t.dataset.product === 'cargo')));
        productCopy.querySelector('strong').textContent = productContent.cargo[0];
        productCopy.querySelector('small').textContent  = productContent.cargo[1];
      }
    }

    function renderProduct(product) {
      const selected = product === 'ebike' ? 'ebike' : 'city';
      if (selected === renderedProduct && !stage.classList.contains('is-cargo')) return;
      renderedProduct = selected;
      tabs.forEach(tab => tab.setAttribute('aria-pressed', String(tab.dataset.product === selected)));
      const [title, description] = productContent[selected];
      productCopy.querySelector('strong').textContent = title;
      productCopy.querySelector('small').textContent = description;
    }

    /* Der WebGL-Morph ist seit dem 25.08.2026 stillgelegt: zwei
       verschiedene Fahrraeder ineinander zu rechnen ergab auf halber
       Strecke eine Doppelbelichtung. Der Wechsel liegt jetzt im Modell
       (velocity-scroll-model.js) und kommt ohne WebGL aus. */
    function commitMotion(nextState) {
      presentedState = nextState;
      const cityOpacity = nextState.fallbackCityOpacity;
      const ebikeOpacity = nextState.fallbackEbikeOpacity;
      const morphVisibility = 0;
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
        `--city-align-y:${cityImageAlignment.translateYPercent.toFixed(6)}`,
        `--ebike-exit:${(nextState.ebikeExit ?? 0).toFixed(4)}`,
        `--city-enter:${(nextState.cityEnter ?? 0).toFixed(4)}`
      ].join(';');
    }

    /* Unsichtbar ist nicht gleich abwesend. Beide Bedienflaechen standen
       mit opacity:0 im Bild, blieben aber anklickbar, fokussierbar und im
       Baum fuer Vorlesehilfen. Wer mit der Tastatur durch die Startseite
       ging, landete in Schaltflaechen, die niemand sehen konnte.
       inert nimmt beides in einem Zug: Zeigergeraet und Fokus.
       Aufgefallen bei einer Pruefung von aussen am 24.08.2026. */
    let choiceInert = null;
    let ctaInert = null;

    function updateControlAvailability(nextState) {
      const choiceAus = nextState.choiceOpacity < 0.05;
      const ctaAus = nextState.ctaOpacity < 0.05;
      if (choiceAus !== choiceInert) {
        choiceInert = choiceAus;
        if (choicePanel) choicePanel.inert = choiceAus;
      }
      if (ctaAus !== ctaInert) {
        ctaInert = ctaAus;
        if (finalCard) finalCard.inert = ctaAus;
      }
    }

    function updateClaimVisibility(nextState) {
      updateControlAvailability(nextState);
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
      if (product === 'cargo') { cargoSetzen(true); return; }
      cargoSetzen(false);
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
      if (stage.classList.contains('is-cargo')) cargoSetzen(false);
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

    /* Frueher wurde hier der WebGL-Renderer aufgebaut. Er ist entfallen;
       der Wechsel braucht ihn nicht. Was bleibt, ist ein Anstoss, damit
       der erste Zustand steht, bevor jemand scrollt. */
    async function initializeHero() {
      commitMotion(presentedState);
    }

    tabs.forEach(tab => tab.addEventListener('click', () => selectProduct(tab.dataset.product, true)));
    addEventListener('scroll', requestRender, { passive: true });
    addEventListener('resize', requestRender);
    reducedMotion.addEventListener?.('change', () => commitMotion(presentedState));
    targetProgress = readNativeProgress();
    displayedProgress = targetProgress;
    applyProgress(displayedProgress);
    initializeHero();
})();
