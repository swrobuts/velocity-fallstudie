/* =====================================================================
   KOPFBEREICH — Steuerung der scrollgesteuerten Buehne

   Der Entwurf stammt vom Nutzer (Paket velocity-startsite), dort als
   Inline-Skript. Hier als eigene Datei, damit index.html lesbar bleibt
   und die Reihenfolge der Skripte klar ist.

   UMGEBAUT AM 25.08.2026
   Urspruenglich blendete ein WebGL-Morph zwei Fotos ineinander. Auf
   halber Strecke standen zwei Rahmen und vier Laufraeder versetzt
   uebereinander - eine Doppelbelichtung, kein Uebergang. Zwei Fotos
   VERSCHIEDENER Raeder lassen sich nicht ineinander blenden.

   Jetzt stehen drei Raeder auf einer Schiene: E-Bike, City-Bike,
   E-Cargo Loader. Der Scrollfortschritt sagt nur, wo auf dieser Schiene
   man gerade ist; jedes Rad haengt an seiner Stelle. Die Rechnung dazu
   steht in velocity-scroll-model.js, hier steht nur das Zeichnen.

   Die umschliessende Funktion verhindert, dass Namen wie "state" oder
   "tabs" mit script.js kollidieren - beide laufen im selben Fenster.
   ===================================================================== */
(function () {
  'use strict';

  const { approachProgress, getScrollState, getManualState, STATIONEN } =
    window.VelocityScrollModel;

  const story = document.querySelector('.scroll-story');
  const stage = document.querySelector('.sticky-stage');
  const tabs = [...document.querySelectorAll('.product-tab')];
  const productCopy = document.querySelector('.product-copy');
  const choicePanel = document.querySelector('.choice-panel');
  const finalCard = document.querySelector('.final-card');

  const zeilen = {
    ebike: document.querySelector('.claim-ebike'),
    city:  document.querySelector('.claim-city'),
    cargo: document.querySelector('.claim-cargo')
  };

  /* Die Karte neben der Pille benennt die AUSWAHL. Sie wiederholte
     bisher die Schlagzeile Wort fuer Wort - zwei Mal derselbe Satz auf
     einem Bildschirm. Jetzt steht dort der Typ und wofuer er da ist. */
  const inhalt = {
    ebike: ['E-Bike Sport', 'Für die Berge'],
    city:  ['City-Bike', 'Für die kurzen Wege'],
    cargo: ['E-Cargo Loader', 'Für alles, was mitmuss']
  };

  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

  let state = getScrollState(0);
  let gezeigterZustand = state;
  let gezeigtesProdukt = null;
  const gezeigteZeilen = {};

  let choiceInert = null;
  let ctaInert = null;
  let bildAngefordert = false;
  let bildId = 0;
  let handId = 0;          // Bildfolge fuer den Wechsel per Pille
  let handLauf = 0;
  let handOrt = null;      // gesetzt, solange die Pille fuehrt
  let zielFortschritt = 0;
  let zeigeFortschritt = 0;
  let letzteZeit = 0;

  /* ------------------------------------------------------------------
     Zeichnen
     ------------------------------------------------------------------ */

  function zeichnen(neuerZustand) {
    gezeigterZustand = neuerZustand;

    const teile = [
      `--progress:${neuerZustand.progress.toFixed(4)}`,
      `--ort:${neuerZustand.ort.toFixed(4)}`,
      `--choice-opacity:${neuerZustand.choiceOpacity.toFixed(4)}`,
      `--cta-opacity:${neuerZustand.ctaOpacity.toFixed(4)}`,
      `--bike-scale:${neuerZustand.bikeScale.toFixed(4)}`,
      `--bike-x:${neuerZustand.bikeX.toFixed(3)}`
    ];

    const letzte = STATIONEN[STATIONEN.length - 1];
    for (const rad of neuerZustand.raeder) {
      const daempfung = rad.name === letzte ? neuerZustand.letzteZeileDaempfung : 1;
      teile.push(`--x-${rad.name}:${rad.versatz.toFixed(4)}`);
      teile.push(`--o-${rad.name}:${rad.deckkraft.toFixed(4)}`);
      teile.push(`--z-${rad.name}:${(rad.zeile * daempfung).toFixed(4)}`);
    }
    stage.style.cssText = teile.join(';');
    bedienbarkeit(neuerZustand);
  }

  /* Unsichtbar ist nicht gleich abwesend. Beide Bedienflaechen stehen
     mit opacity:0 im Bild und waeren ohne das hier weiter anklickbar,
     fokussierbar und im Baum fuer Vorlesehilfen - wer mit der Tastatur
     durch die Startseite geht, landete in Schaltflaechen, die niemand
     sehen kann. inert nimmt beides in einem Zug.
     Aufgefallen bei einer Pruefung von aussen am 24.08.2026; beim Umbau
     der Buehne am 25.08. einmal verlorengegangen und hier wieder da. */
  function bedienbarkeit(neuerZustand) {
    // Steht die Buehne still - auf dem Telefon ist sie nicht laenger als
    // der Bildschirm -, erreicht sie der Scrollfortschritt nie. Dann
    // waere die Pille dauerhaft inert und niemand koennte das Rad
    // wechseln. Der Zustand haengt deshalb daran, ob es ueberhaupt
    // etwas zu scrollen gibt.
    const laeuft = story.offsetHeight - window.innerHeight > 40;
    const choiceAus = laeuft && neuerZustand.choiceOpacity < 0.05;
    const ctaAus = neuerZustand.ctaOpacity < 0.05;
    if (choiceAus !== choiceInert) {
      choiceInert = choiceAus;
      if (choicePanel) choicePanel.inert = choiceAus;
    }
    if (ctaAus !== ctaInert) {
      ctaInert = ctaAus;
      if (finalCard) finalCard.inert = ctaAus;
    }
  }

  /* Die Schlagzeilen aus dem Vorlesebaum nehmen, sobald sie verblasst
     sind. Ohne das liest ein Bildschirmleser alle drei nacheinander vor,
     obwohl nur eine zu sehen ist. */
  function zeilenSichtbarkeit(neuerZustand) {
    for (const rad of neuerZustand.raeder) {
      const versteckt = rad.zeile < 0.5;
      if (gezeigteZeilen[rad.name] === versteckt) continue;
      gezeigteZeilen[rad.name] = versteckt;
      zeilen[rad.name]?.setAttribute('aria-hidden', String(versteckt));
    }
  }

  function produktZeichnen(name) {
    if (name === gezeigtesProdukt) return;
    gezeigtesProdukt = name;
    tabs.forEach(t => t.setAttribute('aria-pressed', String(t.dataset.product === name)));
    const [titel, unterzeile] = inhalt[name];
    productCopy.querySelector('strong').textContent = titel;
    productCopy.querySelector('small').textContent = unterzeile;
  }

  function anwenden(fortschritt) {
    state = getScrollState(fortschritt);
    zeichnen(state);
    zeilenSichtbarkeit(state);
    if (handOrt === null && state.activeProduct !== gezeigtesProdukt) {
      produktZeichnen(state.activeProduct);
    }
  }

  /* ------------------------------------------------------------------
     Scrollen
     ------------------------------------------------------------------ */

  function fortschrittLesen() {
    const rahmen = story.getBoundingClientRect();
    const weg = story.offsetHeight - window.innerHeight;
    return weg > 0 ? Math.min(1, Math.max(0, -rahmen.top / weg)) : 0;
  }

  function schritt(zeitstempel) {
    const delta = letzteZeit ? zeitstempel - letzteZeit : 16;
    letzteZeit = zeitstempel;
    zeigeFortschritt = approachProgress(zeigeFortschritt, zielFortschritt, delta);
    anwenden(zeigeFortschritt);

    if (Math.abs(zielFortschritt - zeigeFortschritt) > 0.00015) {
      bildId = requestAnimationFrame(schritt);
      return;
    }
    zeigeFortschritt = zielFortschritt;
    anwenden(zeigeFortschritt);
    bildAngefordert = false;
    letzteZeit = 0;
  }

  function anfordern() {
    cancelAnimationFrame(handId);
    handLauf += 1;
    handOrt = null;
    stage.classList.remove('is-manual');
    zielFortschritt = fortschrittLesen();
    if (!bildAngefordert) {
      bildAngefordert = true;
      letzteZeit = 0;
      bildId = requestAnimationFrame(schritt);
    }
  }

  /* ------------------------------------------------------------------
     Wechsel per Pille

     Er faehrt dieselbe Schiene an, nur in der Zeit statt ueber den
     Scrollbalken. Damit sieht ein Klick genauso aus wie ein Scrollen -
     vorher waren das zwei verschiedene Bewegungen mit zwei getrennten
     Rechnungen.
     ------------------------------------------------------------------ */

  function waehlen(name) {
    const ziel = Math.max(0, STATIONEN.indexOf(name));
    const von = handOrt !== null ? handOrt : state.ort;
    if (Math.abs(von - ziel) < 0.001) return;

    cancelAnimationFrame(bildId);
    cancelAnimationFrame(handId);
    bildAngefordert = false;
    letzteZeit = 0;
    stage.classList.add('is-manual');
    produktZeichnen(name);

    const lauf = ++handLauf;
    // Rund 620 ms je Station - zwei Stationen dauern entsprechend laenger.
    const dauer = reducedMotion.matches ? 0 : 620 * Math.abs(von - ziel);
    const start = performance.now();

    function weiter(zeitstempel) {
      if (lauf !== handLauf) return;
      const t = dauer === 0 ? 1 : Math.min(1, (zeitstempel - start) / dauer);
      // Sanft an, sanft aus - dieselbe Kurve wie beim Scrollen.
      const weich = t * t * (3 - 2 * t);
      handOrt = von + (ziel - von) * weich;
      const zustand = getManualState(state, handOrt);
      zeichnen(zustand);
      zeilenSichtbarkeit(zustand);
      if (t < 1) { handId = requestAnimationFrame(weiter); return; }
      handOrt = ziel;
    }
    handId = requestAnimationFrame(weiter);
  }

  tabs.forEach(tab => tab.addEventListener('click', () => waehlen(tab.dataset.product)));
  addEventListener('scroll', anfordern, { passive: true });
  addEventListener('resize', anfordern);
  reducedMotion.addEventListener?.('change', () => zeichnen(gezeigterZustand));

  zielFortschritt = fortschrittLesen();
  zeigeFortschritt = zielFortschritt;
  anwenden(zeigeFortschritt);
  produktZeichnen(state.activeProduct);
}());
