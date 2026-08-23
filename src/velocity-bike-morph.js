(function exposeVelocityBikeMorph(globalScope) {
  const MAX_POINTS = 24;
  const IMAGE_WIDTH = 1618;
  const IMAGE_HEIGHT = 972;
  const FIXED_ANCHOR_STRENGTH = 100;

  const fixed = (name, x, y, radius = 0.065) => ({
    name,
    fixed: true,
    ebike: { x, y },
    city: { x, y },
    radius,
  });

  const moving = (name, ebike, city, radius) => ({
    name,
    fixed: false,
    ebike,
    city,
    radius,
  });

  const LANDMARKS = [
    fixed('rearHub', 470.5 / IMAGE_WIDTH, 623 / IMAGE_HEIGHT, 0.055),
    fixed('frontHub', 1230 / IMAGE_WIDTH, 623 / IMAGE_HEIGHT, 0.055),
    fixed('rearTop', 470.5 / IMAGE_WIDTH, 383 / IMAGE_HEIGHT),
    fixed('rearBottom', 470.5 / IMAGE_WIDTH, 863 / IMAGE_HEIGHT),
    fixed('rearLeft', 230.5 / IMAGE_WIDTH, 623 / IMAGE_HEIGHT),
    fixed('rearRight', 710.5 / IMAGE_WIDTH, 623 / IMAGE_HEIGHT),
    fixed('frontTop', 1230 / IMAGE_WIDTH, 383 / IMAGE_HEIGHT),
    fixed('frontBottom', 1230 / IMAGE_WIDTH, 863 / IMAGE_HEIGHT),
    fixed('frontLeft', 990 / IMAGE_WIDTH, 623 / IMAGE_HEIGHT),
    fixed('frontRight', 1470 / IMAGE_WIDTH, 623 / IMAGE_HEIGHT),
    fixed('groundLeft', 0.08, 0.886, 0.09),
    fixed('groundRight', 0.92, 0.886, 0.09),
    moving('saddle', { x: 0.402, y: 0.165 }, { x: 0.403, y: 0.231 }, 0.095),
    moving('seatTop', { x: 0.408, y: 0.216 }, { x: 0.412, y: 0.278 }, 0.075),
    moving('seatJunction', { x: 0.427, y: 0.356 }, { x: 0.432, y: 0.413 }, 0.08),
    moving('crank', { x: 0.483, y: 0.669 }, { x: 0.474, y: 0.685 }, 0.075),
    moving('steerTop', { x: 0.660, y: 0.237 }, { x: 0.671, y: 0.253 }, 0.075),
    moving('steerBottom', { x: 0.689, y: 0.401 }, { x: 0.706, y: 0.414 }, 0.085),
    moving('handlebar', { x: 0.674, y: 0.171 }, { x: 0.673, y: 0.177 }, 0.085),
    moving('rackFront', { x: 0.686, y: 0.354 }, { x: 0.704, y: 0.352 }, 0.07),
    moving('frameCenter', { x: 0.544, y: 0.309 }, { x: 0.520, y: 0.552 }, 0.14),
    moving('downTubeMid', { x: 0.587, y: 0.494 }, { x: 0.590, y: 0.505 }, 0.11),
    moving('rearStayMid', { x: 0.365, y: 0.484 }, { x: 0.362, y: 0.515 }, 0.085),
    moving('chainStayMid', { x: 0.377, y: 0.664 }, { x: 0.381, y: 0.667 }, 0.07),
  ];

  function clamp(value, min = 0, max = 1) {
    return Math.min(max, Math.max(min, value));
  }

  function getLandmarks() {
    return LANDMARKS.map(pair => ({
      ...pair,
      ebike: { ...pair.ebike },
      city: { ...pair.city },
    }));
  }

  function interpolateLandmark(pair, rawProgress) {
    const progress = clamp(Number.isFinite(rawProgress) ? rawProgress : 0);
    return {
      x: pair.ebike.x + (pair.city.x - pair.ebike.x) * progress,
      y: pair.ebike.y + (pair.city.y - pair.ebike.y) * progress,
    };
  }

  function getLocalWeight(distance, radius) {
    if (!Number.isFinite(distance) || !Number.isFinite(radius) || radius <= 0) return 0;
    const weight = Math.exp(-Math.pow(Math.max(0, distance) / radius, 4));
    return weight < 0.000001 ? 0 : weight;
  }

  function getMaxFixedAnchorDrift(sampleCount = 75) {
    const samples = Math.max(1, Math.round(sampleCount));
    const imageAspect = IMAGE_HEIGHT / IMAGE_WIDTH;
    let maximum = 0;

    for (let sample = 0; sample <= samples; sample += 1) {
      const progress = sample / samples;
      const eased = progress * progress * (3 - 2 * progress);
      for (const anchor of LANDMARKS.filter(pair => pair.fixed)) {
        let ebikeX = 0;
        let ebikeY = 0;
        let cityX = 0;
        let cityY = 0;
        let weightSum = 0.0001;

        for (const pair of LANDMARKS) {
          const middle = interpolateLandmark(pair, eased);
          const distance = Math.hypot(
            anchor.ebike.x - middle.x,
            (anchor.ebike.y - middle.y) * imageAspect,
          );
          const weight = getLocalWeight(distance, pair.radius)
            * (pair.fixed ? FIXED_ANCHOR_STRENGTH : 1);
          ebikeX += (pair.ebike.x - middle.x) * weight;
          ebikeY += (pair.ebike.y - middle.y) * weight;
          cityX += (pair.city.x - middle.x) * weight;
          cityY += (pair.city.y - middle.y) * weight;
          weightSum += weight;
        }

        const ebikeDrift = Math.hypot(ebikeX, ebikeY) / weightSum * IMAGE_WIDTH * (1 - eased);
        const cityDrift = Math.hypot(cityX, cityY) / weightSum * IMAGE_WIDTH * eased;
        maximum = Math.max(maximum, ebikeDrift, cityDrift);
      }
    }
    return maximum;
  }

  function fallbackRenderer() {
    return {
      available: false,
      render() {},
      resize() {},
      destroy() {},
    };
  }

  function loadImage(url) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.decoding = 'async';
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error(`Unable to load morph texture: ${url}`));
      image.src = url;
    });
  }

  function compileShader(gl, type, source) {
    const shader = gl.createShader(type);
    if (!shader) throw new Error('Unable to create WebGL shader');
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const message = gl.getShaderInfoLog(shader) || 'Unknown shader compilation error';
      gl.deleteShader(shader);
      throw new Error(message);
    }
    return shader;
  }

  function createProgram(gl, vertexSource, fragmentSource) {
    const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
    const program = gl.createProgram();
    if (!program) throw new Error('Unable to create WebGL program');
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const message = gl.getProgramInfoLog(program) || 'Unknown WebGL link error';
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      throw new Error(message);
    }
    return { program, vertexShader, fragmentShader };
  }

  function createMesh(columns = 72, rows = 44) {
    const vertices = [];
    const indices = [];
    for (let row = 0; row <= rows; row += 1) {
      for (let column = 0; column <= columns; column += 1) {
        vertices.push(column / columns * 2 - 1, 1 - row / rows * 2);
      }
    }
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const topLeft = row * (columns + 1) + column;
        const topRight = topLeft + 1;
        const bottomLeft = topLeft + columns + 1;
        const bottomRight = bottomLeft + 1;
        indices.push(topLeft, bottomLeft, topRight, topRight, bottomLeft, bottomRight);
      }
    }
    return {
      vertices: new Float32Array(vertices),
      indices: new Uint16Array(indices),
    };
  }

  function createTexture(gl, image, unit) {
    const texture = gl.createTexture();
    if (!texture) throw new Error('Unable to create morph texture');
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    return texture;
  }

  function readBackgroundPosition(referenceElement) {
    if (!referenceElement || typeof getComputedStyle !== 'function') return [0.5, 0.5];
    const values = getComputedStyle(referenceElement).backgroundPosition.split(/\s+/);
    const parse = (value, fallback) => value?.endsWith('%') ? clamp(parseFloat(value) / 100) : fallback;
    return [parse(values[0], 0.5), parse(values[1], 0.5)];
  }

  function getCoverWindow(canvasWidth, canvasHeight, imageWidth, imageHeight, position) {
    const viewportAspect = canvasWidth / Math.max(1, canvasHeight);
    const imageAspect = imageWidth / Math.max(1, imageHeight);
    let scaleX = 1;
    let scaleY = 1;
    if (viewportAspect > imageAspect) scaleY = imageAspect / viewportAspect;
    else scaleX = viewportAspect / imageAspect;
    return {
      scale: [scaleX, scaleY],
      offset: [(1 - scaleX) * position[0], (1 - scaleY) * position[1]],
    };
  }

  async function createRenderer(canvas, options = {}) {
    if (!canvas || typeof canvas.getContext !== 'function' || typeof Image === 'undefined') {
      return fallbackRenderer();
    }

    let gl;
    try {
      gl = canvas.getContext('webgl', {
        alpha: true,
        antialias: false,
        depth: false,
        premultipliedAlpha: false,
        preserveDrawingBuffer: true,
      });
    } catch (_error) {
      return fallbackRenderer();
    }
    if (!gl) return fallbackRenderer();

    const vertexSource = `
      precision highp float;
      attribute vec2 aPosition;
      uniform float uProgress;
      uniform float uImageAspect;
      uniform vec2 uEbikePoint[${MAX_POINTS}];
      uniform vec2 uCityPoint[${MAX_POINTS}];
      uniform float uRadius[${MAX_POINTS}];
      uniform vec2 uCityScale;
      uniform vec2 uCityTranslate;
      uniform vec2 uCoverScale;
      uniform vec2 uCoverOffset;
      varying vec2 vEbikeUv;
      varying vec2 vCityUv;

      void main() {
        float eased = uProgress * uProgress * (3.0 - 2.0 * uProgress);
        vec2 screenUv = vec2((aPosition.x + 1.0) * 0.5, (1.0 - aPosition.y) * 0.5);
        vec2 sourceUv = uCoverOffset + screenUv * uCoverScale;
        vec2 ebikeDisplacement = vec2(0.0);
        vec2 cityDisplacement = vec2(0.0);
        float weightSum = 0.0001;

        for (int index = 0; index < ${MAX_POINTS}; index++) {
            float radius = abs(uRadius[index]);
            if (radius > 0.0001) {
            vec2 middle = mix(uEbikePoint[index], uCityPoint[index], eased);
            vec2 delta = sourceUv - middle;
            delta.y *= uImageAspect;
            float distanceToAnchor = length(delta);
            float anchorStrength = uRadius[index] < 0.0 ? ${FIXED_ANCHOR_STRENGTH.toFixed(1)} : 1.0;
            float weight = exp(-pow(distanceToAnchor / radius, 4.0)) * anchorStrength;
            ebikeDisplacement += (uEbikePoint[index] - middle) * weight;
            cityDisplacement += (uCityPoint[index] - middle) * weight;
            weightSum += weight;
          }
        }

        vEbikeUv = clamp(sourceUv + ebikeDisplacement / weightSum, 0.001, 0.999);
        vec2 alignedCityUv = sourceUv + cityDisplacement / weightSum;
        vec2 alignedCityScreenUv = (alignedCityUv - uCoverOffset) / uCoverScale;
        vec2 rawCityScreenUv = vec2(0.5) + (alignedCityScreenUv - vec2(0.5) - uCityTranslate) / uCityScale;
        vCityUv = clamp(uCoverOffset + rawCityScreenUv * uCoverScale, 0.001, 0.999);
        gl_Position = vec4(aPosition, 0.0, 1.0);
      }
    `;

    const fragmentSource = `
      precision highp float;
      uniform sampler2D uEbikeTexture;
      uniform sampler2D uCityTexture;
      uniform float uProgress;
      varying vec2 vEbikeUv;
      varying vec2 vCityUv;

      void main() {
        float eased = uProgress * uProgress * (3.0 - 2.0 * uProgress);
        vec4 ebikeColor = texture2D(uEbikeTexture, vEbikeUv);
        vec4 cityColor = texture2D(uCityTexture, vCityUv);
        gl_FragColor = mix(ebikeColor, cityColor, eased);
      }
    `;

    let resources;
    try {
      resources = createProgram(gl, vertexSource, fragmentSource);
      const [ebikeImage, cityImage] = await Promise.all([
        loadImage(options.ebikeUrl),
        loadImage(options.cityUrl),
      ]);
      resources.ebikeTexture = createTexture(gl, ebikeImage, 0);
      resources.cityTexture = createTexture(gl, cityImage, 1);
      resources.imageWidth = ebikeImage.naturalWidth || IMAGE_WIDTH;
      resources.imageHeight = ebikeImage.naturalHeight || IMAGE_HEIGHT;
    } catch (_error) {
      if (resources?.program) gl.deleteProgram(resources.program);
      if (resources?.vertexShader) gl.deleteShader(resources.vertexShader);
      if (resources?.fragmentShader) gl.deleteShader(resources.fragmentShader);
      return fallbackRenderer();
    }

    const mesh = createMesh();
    const vertexBuffer = gl.createBuffer();
    const indexBuffer = gl.createBuffer();
    if (!vertexBuffer || !indexBuffer) return fallbackRenderer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, mesh.vertices, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gl.STATIC_DRAW);

    gl.useProgram(resources.program);
    const positionLocation = gl.getAttribLocation(resources.program, 'aPosition');
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    const uniform = name => gl.getUniformLocation(resources.program, name);
    const uniforms = {
      progress: uniform('uProgress'),
      imageAspect: uniform('uImageAspect'),
      ebikePoint: uniform('uEbikePoint[0]'),
      cityPoint: uniform('uCityPoint[0]'),
      radius: uniform('uRadius[0]'),
      cityScale: uniform('uCityScale'),
      cityTranslate: uniform('uCityTranslate'),
      coverScale: uniform('uCoverScale'),
      coverOffset: uniform('uCoverOffset'),
      ebikeTexture: uniform('uEbikeTexture'),
      cityTexture: uniform('uCityTexture'),
    };

    const ebikePoints = new Float32Array(MAX_POINTS * 2);
    const cityPoints = new Float32Array(MAX_POINTS * 2);
    const radii = new Float32Array(MAX_POINTS);
    LANDMARKS.forEach((pair, index) => {
      ebikePoints[index * 2] = pair.ebike.x;
      ebikePoints[index * 2 + 1] = pair.ebike.y;
      cityPoints[index * 2] = pair.city.x;
      cityPoints[index * 2 + 1] = pair.city.y;
      radii[index] = pair.fixed ? -pair.radius : pair.radius;
    });

    const alignment = options.cityAlignment || {};
    const scaleX = Number.isFinite(alignment.scaleX) ? alignment.scaleX : 1;
    const scaleY = Number.isFinite(alignment.scaleY) ? alignment.scaleY : 1;
    const translateX = Number.isFinite(alignment.translateXPercent) ? alignment.translateXPercent / 100 : 0;
    const translateY = Number.isFinite(alignment.translateYPercent) ? alignment.translateYPercent / 100 : 0;
    gl.uniform1i(uniforms.ebikeTexture, 0);
    gl.uniform1i(uniforms.cityTexture, 1);
    gl.uniform1f(uniforms.imageAspect, resources.imageHeight / resources.imageWidth);
    gl.uniform2fv(uniforms.ebikePoint, ebikePoints);
    gl.uniform2fv(uniforms.cityPoint, cityPoints);
    gl.uniform1fv(uniforms.radius, radii);
    gl.uniform2f(uniforms.cityScale, scaleX, scaleY);
    gl.uniform2f(uniforms.cityTranslate, translateX, translateY);

    const renderer = {
      available: true,
      lastProgress: -1,
      lastWidth: 0,
      lastHeight: 0,
      coverScale: [1, 1],
      coverOffset: [0, 0],
      render(rawProgress) {
        if (!renderer.available) return;
        const progress = clamp(Number.isFinite(rawProgress) ? rawProgress : 0);
        renderer.resize();
        gl.useProgram(resources.program);
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
        gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, resources.ebikeTexture);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, resources.cityTexture);
        gl.uniform1f(uniforms.progress, progress);
        gl.uniform2fv(uniforms.coverScale, renderer.coverScale);
        gl.uniform2fv(uniforms.coverOffset, renderer.coverOffset);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawElements(gl.TRIANGLES, mesh.indices.length, gl.UNSIGNED_SHORT, 0);
        renderer.lastProgress = progress;
      },
      resize() {
        if (!renderer.available) return;
        const ratio = Math.min(Number.isFinite(options.maxDevicePixelRatio) ? options.maxDevicePixelRatio : 2, globalScope.devicePixelRatio || 1);
        const width = Math.max(1, Math.round(canvas.clientWidth * ratio));
        const height = Math.max(1, Math.round(canvas.clientHeight * ratio));
        if (canvas.width !== width || canvas.height !== height) {
          canvas.width = width;
          canvas.height = height;
        }
        gl.viewport(0, 0, width, height);
        const cover = getCoverWindow(
          canvas.clientWidth,
          canvas.clientHeight,
          resources.imageWidth,
          resources.imageHeight,
          readBackgroundPosition(options.referenceElement),
        );
        renderer.coverScale = cover.scale;
        renderer.coverOffset = cover.offset;
        renderer.lastWidth = width;
        renderer.lastHeight = height;
      },
      destroy() {
        if (!renderer.available && !gl) return;
        renderer.available = false;
        canvas.removeEventListener('webglcontextlost', handleContextLost);
        gl.deleteTexture(resources.ebikeTexture);
        gl.deleteTexture(resources.cityTexture);
        gl.deleteBuffer(vertexBuffer);
        gl.deleteBuffer(indexBuffer);
        gl.deleteProgram(resources.program);
        gl.deleteShader(resources.vertexShader);
        gl.deleteShader(resources.fragmentShader);
      },
    };

    function handleContextLost(event) {
      event.preventDefault();
      renderer.available = false;
      if (typeof options.onAvailabilityChange === 'function') options.onAvailabilityChange(false);
    }

    canvas.addEventListener('webglcontextlost', handleContextLost, false);
    renderer.resize();
    renderer.render(0);
    return renderer;
  }

  const api = {
    getLandmarks,
    interpolateLandmark,
    getLocalWeight,
    getMaxFixedAnchorDrift,
    getCoverWindow,
    createRenderer,
  };
  globalScope.VelocityBikeMorph = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
}(typeof globalThis !== 'undefined' ? globalThis : this));
