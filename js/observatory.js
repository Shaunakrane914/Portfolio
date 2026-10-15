import * as THREE from "../assets/vendor/three.module.min.js";
import { disposeScene, compileInBatches } from "./graphics-runtime.js";
import { ChapterWheelGuard, wheelPixels } from "./chapter-wheel.js?v=4.7";

const canvas = document.getElementById("observatory-canvas");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
const panels = Array.from(document.querySelectorAll("[data-scene-panel]"));
const railButtons = Array.from(document.querySelectorAll("[data-scene-jump]"));
const sceneAnnouncer = document.getElementById("scene-announcer");
const readingProgress = document.querySelector(".reading-progress");
const sceneNames = ["ORIGIN", "AEGIS", "GRIDIUM", "COMPRESSOR", "TOPOFLOW", "PROFILE"];
const sceneHashes = ["origin", "aegis", "gridium", "compressor", "topoflow", "profile"];

let renderer;
let scene;
let camera;
let currentScene = Math.max(0, sceneHashes.indexOf(window.location.hash.slice(1)));
let targetCamera = new THREE.Vector3();
let targetLook = new THREE.Vector3();
let currentLook = new THREE.Vector3();
const cameraVelocity = new THREE.Vector3();
const lookVelocity = new THREE.Vector3();
let activeWorld = null;
let transitField = null;
let lastSceneChange = 0;
let lastFrameTime = 0;
let pointerX = 0;
let pointerY = 0;
let webglReady = false;
const cameraStart = new THREE.Vector3();
const lookStart = new THREE.Vector3();
let cameraTransitionAt = 0;
let animationTime = 0;
let renderedFrames = 0;
let lastScrollAt = -Infinity;
let lastDrawAt = -Infinity;
let modelDirty = true;
const modelViews = Array.from(document.querySelectorAll("[data-model-view]"));
const modelLayouts = [];
const fittingVertices = new WeakMap();
let modelViewport = null;
let headerBottom = 0;
let footerHeight = 0;
const modelAngles = [[.24, .16, 1], [.12, .32, 1], [.12, .5, 1], [.42, .28, 1], [.48, .25, 1]];
const chapterWheel = new ChapterWheelGuard();
let chapterStops = [], documentScrollMaximum = 0;
function measureChapters() {
  chapterStops = panels.map(panel => panel.offsetTop);
  documentScrollMaximum = document.documentElement.scrollHeight - innerHeight;
}
const chapterSizeObserver = new ResizeObserver(measureChapters);
panels.forEach(panel => chapterSizeObserver.observe(panel));
document.fonts.ready.then(measureChapters);
window.addEventListener("pagehide", event => { if (!event.persisted) chapterSizeObserver.disconnect(); });

const cameraStates = [
  { position: [0, 1.8, 12], look: [1.6, 0.2, 0] },
  { position: [-9.0, 1.75, 10.05], look: [-7.8, 0.1, -0.5] },
  { position: [-8.4, 10.2, -0.45], look: [-7.0, 6.2, -9.65] },
  { position: [12.8, 1.6, 10.2], look: [14.2, 0.0, -0.35] },
  { position: [3.7, 1.7, -5.75], look: [5.6, 0.1, -16.25] },
  { position: [0.5, 9.6, 10.35], look: [2.2, 8.0, -0.15] }
];

const mobileCameraStates = [
  { position: [4.8, 1.4, 20], look: [4.8, -6, 0] },
  { position: [-3.8, 1.6, 16.5], look: [-3.8, -5.6, -0.22] },
  { position: [-2.05, 7.2, 4.2], look: [-2.05, -1.4, -10.18] },
  { position: [15.42, 1.8, 18.2], look: [15.42, -5.5, -0.24] },
  { position: [9.6, 1.8, -0.2], look: [9.6, -5.5, -16.44] },
  { position: [6.2, 9.2, 15.6], look: [6.2, 2.0, -0.15] }
];

function getCameraTarget(sceneIndex) {
  const world = worlds[sceneIndex];
  const layout = modelLayouts[sceneIndex];
  if (world?.userData.modelCorners && layout?.width && layout?.height) {
    const key = `${layout.width}:${layout.height}`;
    if (world.userData.cameraFit?.key !== key) {
      const direction = new THREE.Vector3(...modelAngles[sceneIndex]).normalize();
      const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), direction).normalize();
      const up = new THREE.Vector3().crossVectors(direction, right);
      const center = world.userData.modelCenter;
      const tan = Math.tan(THREE.MathUtils.degToRad(42) / 2);
      const aspect = layout.width / layout.height;
      let distance = 0;
      world.userData.modelCorners.forEach(corner => {
        const relative = corner.clone().applyMatrix4(world.userData.modelMatrix).sub(center);
        const depth = relative.dot(direction);
        distance = Math.max(distance, Math.abs(relative.dot(right)) / (tan * aspect * .9) + depth,
          Math.abs(relative.dot(up)) / (tan * .9) + depth);
      });
      const position = center.clone().addScaledVector(direction, distance);
      let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
      for (const corner of world.userData.modelCorners) {
        const relative=corner.clone().applyMatrix4(world.userData.modelMatrix).sub(center);
        const depth=distance-relative.dot(direction);
        const x=relative.dot(right)/(depth*tan*aspect),y=relative.dot(up)/(depth*tan);
        minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);
      }
      const zoom=1.76/Math.max(maxX-minX,maxY-minY);
      const state = { position: position.toArray(), look: center.toArray(), zoom,
        offset:[(minX+maxX)*zoom/2,(minY+maxY)*zoom/2] };
      world.userData.cameraFit = { key, state };
      // Keep the diagnostic camera presets consistent with the actual fit.
      cameraStates[sceneIndex] = state;
      mobileCameraStates[sceneIndex] = state;
    }
    return world.userData.cameraFit.state;
  }
  if (window.innerWidth <= 820) {
    return mobileCameraStates[sceneIndex] || mobileCameraStates[0];
  }
  return cameraStates[sceneIndex] || cameraStates[0];
}

function measureModelViews() {
  headerBottom = document.querySelector(".observatory-header").getBoundingClientRect().bottom;
  const rail = document.querySelector(".scene-rail").getBoundingClientRect();
  footerHeight = window.innerWidth <= 820 ? rail.height : 0;
  modelViews.forEach(view => {
    const rect = view.getBoundingClientRect();
    modelLayouts[Number(view.dataset.modelView)] = {
      left: rect.left, top: rect.top + window.scrollY, width: rect.width, height: rect.height
    };
  });
}

function getModelViewportRect() {
  const layout = modelLayouts[currentScene];
  if (!layout) return null;
  const left = Math.max(0, layout.left);
  const right = Math.min(window.innerWidth, layout.left + layout.width);
  const top = Math.max(headerBottom, layout.top - window.scrollY);
  const bottom = Math.min(window.innerHeight - footerHeight, layout.top - window.scrollY + layout.height);
  return { left, top, right, bottom, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
}

function updateModelViewport() {
  modelViewport = getModelViewportRect();
  const layout = modelLayouts[currentScene];
  const state = getCameraTarget(currentScene);
  const projectionKey=layout && `${currentScene}:${layout.width}:${layout.height}:${state.zoom}:${state.offset}`;
  if (layout && camera.userData.projectionKey !== projectionKey) {
    camera.aspect = layout.width / layout.height;
    camera.fov = 42;
    camera.zoom=state.zoom || 1;
    const offset=state.offset || [0,0];
    camera.setViewOffset(layout.width,layout.height,offset[0]*layout.width/2,-offset[1]*layout.height/2,layout.width,layout.height);
    camera.userData.projectionKey=projectionKey;
  }
}

function drawModel(renderCamera = camera) {
  // The browser composites this canvas in document flow, alongside the copy.
  // Scrolling no longer waits for a new WebGL frame to reposition the model.
  const layout = modelLayouts[currentScene];
  if (!layout) { renderer.clear(); return; }
  renderer.render(scene, renderCamera);
}

function getProjectedModelBounds() {
  const world = worlds[currentScene];
  const layout = modelLayouts[currentScene];
  if (!world?.userData.modelCorners || !layout || !camera) return null;
  world.updateWorldMatrix(true, false);
  camera.updateMatrixWorld();
  let left=Infinity,right=-Infinity,top=Infinity,bottom=-Infinity;
  for (const corner of world.userData.modelCorners) {
    const p = corner.clone().applyMatrix4(world.matrixWorld).project(camera);
    const x=layout.left+(p.x+1)*layout.width/2,y=layout.top-window.scrollY+(1-p.y)*layout.height/2;
    left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
  }
  return { left, top, right, bottom, width: right - left, height: bottom - top };
}

const palette = {
  cyan: 0x00e5ff,
  cyanDim: 0x005566,
  green: 0x47e6a5,
  greenDim: 0x1e6a50,
  blue: 0x668cff,
  blueDim: 0x283b75,
  orange: 0xff7448,
  orangeDim: 0x743522,
  yellow: 0xffc83d,
  white: 0xe8f1ec,
  faint: 0x26332d,
  black: 0x050706
};

function seededRandom(seed = 914) {
  let state = seed >>> 0;
  return function random() {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

const random = seededRandom();
const materialCache = new Map();
function cachedMaterial(kind, color, options, create) {
  const key = `${kind}:${color}:${JSON.stringify(options)}`;
  if (!materialCache.has(key)) materialCache.set(key, create());
  return materialCache.get(key);
}

function lineMaterial(color, opacity = 1) {
  return new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity });
}

function meshMaterial(color, options = {}) {
  return cachedMaterial("standard", color, options, () => new THREE.MeshStandardMaterial({
    color,
    roughness: options.roughness ?? 0.62,
    metalness: options.metalness ?? 0.42,
    wireframe: options.wireframe ?? false,
    transparent: options.opacity !== undefined && options.opacity < 1,
    opacity: options.opacity ?? 1,
    side: options.side ?? THREE.FrontSide,
    depthWrite: options.depthWrite ?? true,
    emissive: options.emissive ?? 0x000000,
    emissiveIntensity: options.emissiveIntensity ?? 0
  }));
}

function physicalMaterial(color, options = {}) {
  // Lit metal and tinted shells retain depth without a second transmission pass.
  return cachedMaterial("metal", color, options, () => new THREE.MeshStandardMaterial({
    color,
    roughness: options.roughness ?? 0.3,
    metalness: options.metalness ?? 0.62,
    transparent: options.opacity !== undefined && options.opacity < 1,
    opacity: options.opacity ?? 1,
    side: options.side ?? THREE.FrontSide,
    depthWrite: options.depthWrite ?? true,
    emissive: options.emissive ?? 0x000000,
    emissiveIntensity: options.emissiveIntensity ?? 0
  }));
}

function glass(color = palette.green, opacity = 0.18) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.08,
    metalness: 0.12,
    transparent: true,
    opacity,
    side: THREE.DoubleSide,
    depthWrite: false
  });
}

function addCurve(parent, points, color = palette.green, radius = 0.014, opacity = 0.5) {
  const curve = new THREE.CatmullRomCurve3(points);
  const geometry = new THREE.TubeGeometry(curve, Math.max(18, points.length * 8), radius, 6, false);
  const tube = new THREE.Mesh(geometry, physicalMaterial(color, {
    roughness: 0.28,
    metalness: 0.4,
    emissive: color,
    emissiveIntensity: 0.6,
    opacity,
    depthWrite: false
  }));
  parent.add(tube);
  return curve;
}

const glowTextures = new Map();

function createGlowTexture(color) {
  if (glowTextures.has(color)) return glowTextures.get(color);
  const textureCanvas = document.createElement("canvas");
  textureCanvas.width = 128;
  textureCanvas.height = 128;
  const context = textureCanvas.getContext("2d");
  const tint = new THREE.Color(color);
  const rgb = `${Math.round(tint.r * 255)}, ${Math.round(tint.g * 255)}, ${Math.round(tint.b * 255)}`;
  const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, `rgba(${rgb}, 0.96)`);
  gradient.addColorStop(0.16, `rgba(${rgb}, 0.52)`);
  gradient.addColorStop(0.5, `rgba(${rgb}, 0.12)`);
  gradient.addColorStop(1, `rgba(${rgb}, 0)`);
  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 128);
  const texture = new THREE.CanvasTexture(textureCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  glowTextures.set(color, texture);
  return texture;
}

function createGlowSprite(color, size = 1, opacity = 0.75) {
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: createGlowTexture(color),
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  }));
  sprite.scale.set(size, size, size);
  return sprite;
}

function addWorldLight(group, color, position, intensity = 32, distance = 18) {
  const light = new THREE.PointLight(color, intensity, distance, 2);
  light.position.fromArray(position);
  // A stable light count lets every world reuse the same lit shader programs.
  group.userData.lightCount = (group.userData.lightCount || 0) + 1;
  if (group.userData.lightCount <= 2) group.add(light);
  const glow = createGlowSprite(color, 1.2, 0.38);
  glow.position.copy(light.position);
  group.add(glow);
  return light;
}

function createTechRing(radius, color, opacity = 0.45, segments = 128) {
  const points = [];
  for (let index = 0; index < segments; index += 1) {
    const angle = (index / segments) * Math.PI * 2;
    points.push(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
  return new THREE.LineLoop(geometry, lineMaterial(color, opacity));
}

function getCachedCurvePoint(curve, progress) {
  if (!curve) return null;
  if (!curve.userData) curve.userData = {};
  if (!curve.userData.samples) {
    curve.userData.samples = curve.getPoints(120);
  }
  const samples = curve.userData.samples;
  const idx = Math.min(samples.length - 1, Math.max(0, Math.floor(progress * (samples.length - 1))));
  return curveSample.copy(samples[idx]).lerp(samples[Math.min(idx + 1, samples.length - 1)], progress * (samples.length - 1) - idx);
}
const curveSample = new THREE.Vector3();

function createTransitField() {
  const values = [];
  for (let i = 0; i < 72; i += 1) {
    const x = (random() - 0.5) * 8;
    const y = (random() - 0.5) * 5;
    const z = -2 - random() * 8;
    const length = 0.08 + random() * 0.42;
    values.push(x, y, z, x, y, z - length);
  }
  const streaks = linesFromArray(values, palette.green, 0);
  streaks.material.depthTest = false;
  streaks.material.transparent = true;
  streaks.renderOrder = 20;
  return streaks;
}

function createCodeTexture(title, lines, accent = "#47e6a5") {
  const textureCanvas = document.createElement("canvas");
  textureCanvas.width = 512;
  textureCanvas.height = 310;
  const context = textureCanvas.getContext("2d");
  context.fillStyle = "#070a08";
  context.fillRect(0, 0, textureCanvas.width, textureCanvas.height);
  context.fillStyle = "#0d1511";
  context.fillRect(0, 0, textureCanvas.width, 42);
  context.fillStyle = accent;
  context.fillRect(0, 40, textureCanvas.width, 2);
  context.font = "500 13px monospace";
  context.fillStyle = "#b9c5bf";
  context.fillText(title.toUpperCase(), 20, 26);
  context.font = "12px monospace";
  lines.forEach((line, index) => {
    const y = 72 + index * 28;
    context.fillStyle = "#44514b";
    context.fillText(String(index + 1).padStart(2, "0"), 20, y);
    context.fillStyle = line.accent ? accent : "#d5dfda";
    context.fillText(line.text, 50, y);
  });
  const texture = new THREE.CanvasTexture(textureCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 2;
  return texture;
}

function pointsFromArray(values, color, size = 0.05, opacity = 1) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(values, 3));
  const material = new THREE.PointsMaterial({
    color,
    size,
    sizeAttenuation: true,
    transparent: opacity < 1,
    opacity
  });
  return new THREE.Points(geometry, material);
}

function linesFromArray(values, color, opacity = 1) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(values, 3));
  return new THREE.LineSegments(geometry, lineMaterial(color, opacity));
}

function createAmbientField() {
  const group = new THREE.Group();
  const dust = [];
  const nearDust = [];
  for (let i = 0; i < 760; i += 1) {
    dust.push(
      (random() - 0.5) * 54,
      (random() - 0.5) * 28,
      (random() - 0.5) * 54
    );
  }
  for (let i = 0; i < 160; i += 1) {
    nearDust.push(
      (random() - 0.5) * 26,
      -3.7 + random() * 8,
      (random() - 0.5) * 24
    );
  }
  group.add(pointsFromArray(dust, palette.white, 0.018, 0.18));
  group.add(pointsFromArray(nearDust, palette.green, 0.028, 0.16));

  const floor = new THREE.GridHelper(72, 72, palette.faint, palette.faint);
  floor.position.y = -4.4;
  floor.material.transparent = true;
  floor.material.opacity = 0.12;
  group.add(floor);

  [5, 9, 14, 21, 30].forEach((radius, index) => {
    const ring = createTechRing(radius, index < 2 ? palette.greenDim : palette.faint, index < 2 ? 0.18 : 0.09, 160);
    ring.position.y = -4.37;
    group.add(ring);
  });
  return group;
}

function createOriginWorld() {
  const group = new THREE.Group();
  group.userData.spin = 0.0015;

  const latticePoints = [];
  const latticeLines = [];
  const pointMap = [];
  const grid = 7;
  const step = 0.74;

  for (let x = 0; x < grid; x += 1) {
    pointMap[x] = [];
    for (let y = 0; y < grid; y += 1) {
      pointMap[x][y] = [];
      for (let z = 0; z < grid; z += 1) {
        if (random() < 0.48) continue;
        const p = new THREE.Vector3(
          (x - 3) * step,
          (y - 3) * step,
          (z - 3) * step
        );
        pointMap[x][y][z] = p;
        latticePoints.push(p.x, p.y, p.z);
      }
    }
  }

  const neighborOffsets = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  for (let x = 0; x < grid; x += 1) {
    for (let y = 0; y < grid; y += 1) {
      for (let z = 0; z < grid; z += 1) {
        const p = pointMap[x]?.[y]?.[z];
        if (!p) continue;
        neighborOffsets.forEach(([dx, dy, dz]) => {
          const q = pointMap[x + dx]?.[y + dy]?.[z + dz];
          if (q && random() > 0.3) latticeLines.push(p.x, p.y, p.z, q.x, q.y, q.z);
        });
      }
    }
  }

  const points = pointsFromArray(latticePoints, palette.green, 0.07, 0.95);
  const lines = linesFromArray(latticeLines, palette.greenDim, 0.5);
  group.add(points, lines);

  const frames = [3.1, 4.2, 5.4];
  frames.forEach((size, index) => {
    const frame = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(size, size, size)),
      lineMaterial(index === 1 ? palette.blue : palette.faint, index === 1 ? 0.45 : 0.24)
    );
    frame.rotation.set(index * 0.18, index * 0.22, index * -0.14);
    group.add(frame);
  });

  const tracePositions = [];
  for (let i = 0; i < 70; i += 1) {
    const x = -5 + i * 0.145;
    const y = Math.sin(i * 0.34) * 0.5 + Math.cos(i * 0.12) * 0.22;
    tracePositions.push(x, y - 3.1, 1.2);
  }
  const traceGeometry = new THREE.BufferGeometry();
  traceGeometry.setAttribute("position", new THREE.Float32BufferAttribute(tracePositions, 3));
  group.add(new THREE.Line(traceGeometry, lineMaterial(palette.orange, 0.74)));

  const layers = [
    { y: -2.5, radius: 3.4, color: palette.orange, nodes: 9 },
    { y: -0.85, radius: 4.05, color: palette.blue, nodes: 11 },
    { y: 0.95, radius: 3.75, color: palette.green, nodes: 10 },
    { y: 2.55, radius: 3.1, color: palette.green, nodes: 8 }
  ];
  const verticals = [];
  layers.forEach((layer, layerIndex) => {
    const ringPoints = [];
    const nodeMaterial = meshMaterial(layer.color, {
      roughness: 0.28,
      metalness: 0.48,
      emissive: layer.color,
      emissiveIntensity: 0.42
    });
    for (let i = 0; i < 96; i += 1) {
      const angle = (i / 96) * Math.PI * 2;
      ringPoints.push(
        Math.cos(angle) * layer.radius,
        layer.y,
        Math.sin(angle) * layer.radius * 0.42
      );
    }
    const ringGeometry = new THREE.BufferGeometry();
    ringGeometry.setAttribute("position", new THREE.Float32BufferAttribute(ringPoints, 3));
    group.add(new THREE.LineLoop(ringGeometry, lineMaterial(layer.color, 0.46)));

    const nodes = new THREE.InstancedMesh(new THREE.SphereGeometry(0.085, 12, 12), nodeMaterial, layer.nodes);
    const placement = new THREE.Object3D();
    for (let i = 0; i < layer.nodes; i += 1) {
      const angle = (i / layer.nodes) * Math.PI * 2 + layerIndex * 0.31;
      placement.position.set(
        Math.cos(angle) * layer.radius,
        layer.y,
        Math.sin(angle) * layer.radius * 0.42
      );
      placement.updateMatrix();
      nodes.setMatrixAt(i, placement.matrix);
      if (i % 3 === 0) {
        verticals.push(placement.position.x, placement.position.y, placement.position.z, 0, 0, 0);
      }
    }
    group.add(nodes);
  });
  group.add(linesFromArray(verticals, palette.white, 0.11));

  const chamber = new THREE.Mesh(
    new THREE.CylinderGeometry(3.28, 3.28, 6.25, 96, 1, true),
    physicalMaterial(0x18362a, {
      roughness: 0.08,
      metalness: 0.08,
      transmission: 0.28,
      thickness: 0.32,
      opacity: 0.075,
      side: THREE.DoubleSide,
      depthWrite: false,
      emissive: palette.greenDim,
      emissiveIntensity: 0.12
    })
  );
  group.add(chamber);
  group.userData.chamber = chamber;

  [-3.1, -1.55, 0, 1.55, 3.1].forEach((y, index) => {
    const band = new THREE.Mesh(
      new THREE.TorusGeometry(3.3, index === 2 ? 0.045 : 0.025, 10, 128),
      physicalMaterial(index === 2 ? palette.blue : palette.green, {
        roughness: 0.2,
        metalness: 0.72,
        opacity: index === 2 ? 0.62 : 0.34,
        emissive: index === 2 ? palette.blueDim : palette.greenDim,
        emissiveIntensity: 0.52
      })
    );
    band.position.y = y;
    band.rotation.x = Math.PI / 2;
    band.userData.speed = (index % 2 ? -1 : 1) * (0.08 + index * 0.018);
    group.userData.rings ??= [];
    group.userData.rings.push(band);
    group.add(band);
  });

  const core = new THREE.Mesh(
    new THREE.CylinderGeometry(0.72, 0.92, 4.85, 8, 1),
    physicalMaterial(0x12251e, {
      roughness: 0.18,
      metalness: 0.78,
      clearcoat: 0.72,
      opacity: 0.32,
      depthWrite: false,
      emissive: palette.greenDim,
      emissiveIntensity: 0.18
    })
  );
  core.rotation.y = Math.PI / 8;
  group.add(core);

  for (let index = 0; index < 12; index += 1) {
    const angle = (index / 12) * Math.PI * 2;
    const slab = new THREE.Mesh(
      new THREE.BoxGeometry(0.72, 0.46, 0.045),
      physicalMaterial(index % 4 === 0 ? palette.orange : palette.blue, {
        roughness: 0.24,
        metalness: 0.5,
        opacity: 0.34,
        emissive: index % 4 === 0 ? palette.orangeDim : palette.blueDim,
        emissiveIntensity: 0.48
      })
    );
    slab.position.set(Math.cos(angle) * 2.35, -2.5 + (index % 4) * 1.65, Math.sin(angle) * 1.05);
    slab.lookAt(0, slab.position.y, 0);
    group.add(slab);
  }

  addWorldLight(group, palette.green, [0.8, 1.8, 3.1], 24, 13);
  addWorldLight(group, palette.blue, [-2.2, -1.4, 2.4], 16, 10);
  group.position.set(4.8, 0.1, 0);
  group.scale.setScalar(0.88);
  return group;
}

function createCompressorWorld() {
  const group = new THREE.Group();
  group.position.set(15.7, -0.05, -0.35);
  group.rotation.set(-0.18, -0.08, 0);
  group.userData.rotors = [];
  group.userData.flowParticles = [];
  group.userData.instrumentRings = [];

  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.18, 8.4, 32),
    physicalMaterial(0xb8c3bd, { roughness: 0.2, metalness: 0.92, clearcoat: 0.6 })
  );
  shaft.rotation.z = Math.PI / 2;
  group.add(shaft);

  const casing = new THREE.Mesh(
    new THREE.CylinderGeometry(2.08, 2.08, 9.1, 72, 1, true),
    physicalMaterial(0x17352a, {
      roughness: 0.08,
      metalness: 0.16,
      transmission: 0.32,
      thickness: 0.26,
      opacity: 0.11,
      side: THREE.DoubleSide,
      depthWrite: false,
      emissive: palette.greenDim,
      emissiveIntensity: 0.16
    })
  );
  casing.rotation.z = Math.PI / 2;
  group.add(casing);

  [-4.55, 4.55].forEach((x, index) => {
    const flange = new THREE.Mesh(
      new THREE.TorusGeometry(index === 0 ? 1.82 : 1.98, 0.09, 12, 80),
      physicalMaterial(index === 0 ? palette.green : palette.orange, { roughness: 0.18, metalness: 0.82, clearcoat: 0.62 })
    );
    flange.position.x = x;
    flange.rotation.y = Math.PI / 2;
    group.add(flange);
  });

  const bladeShape = new THREE.Shape();
  bladeShape.moveTo(-0.07, 0);
  bladeShape.bezierCurveTo(-0.12, 0.24, 0.02, 0.62, 0.17, 0.86);
  bladeShape.lineTo(0.31, 0.79);
  bladeShape.bezierCurveTo(0.18, 0.49, 0.09, 0.18, 0.08, 0);
  bladeShape.closePath();
  const bladeGeometry = new THREE.ExtrudeGeometry(bladeShape, {
    depth: 0.12,
    bevelEnabled: true,
    bevelSegments: 2,
    bevelSize: 0.025,
    bevelThickness: 0.025
  });
  bladeGeometry.center();

  const stageCount = 7;
  for (let stage = 0; stage < stageCount; stage += 1) {
    const rotor = new THREE.Group();
    rotor.position.x = -3.72 + stage * 1.24;
    rotor.rotation.y = Math.PI / 2;

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.08 + stage * 0.055, 0.055, 10, 72),
      physicalMaterial(stage === 4 ? palette.orange : 0x9eaaa4, {
        roughness: 0.2,
        metalness: 0.88,
        clearcoat: 0.48,
        emissive: stage === 4 ? palette.orangeDim : 0x13231c,
        emissiveIntensity: stage === 4 ? 0.62 : 0.12
      })
    );
    rotor.add(ring);

    const outerRing = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.CylinderGeometry(1.58 + stage * 0.055, 1.58 + stage * 0.055, 0.22, 56, 1, true)),
      lineMaterial(stage === 4 ? palette.orange : palette.faint, stage === 4 ? 0.72 : 0.5)
    );
    outerRing.rotation.x = Math.PI / 2;
    rotor.add(outerRing);

    const bladeMaterial = physicalMaterial(stage === 4 ? 0xc58a61 : 0xaeb9b3, {
      roughness: 0.22,
      metalness: 0.9,
      clearcoat: 0.36,
      opacity: 0.92,
      emissive: stage === 4 ? palette.orangeDim : 0x07100c,
      emissiveIntensity: stage === 4 ? 0.26 : 0.08
    });
    const bladeCount = 26;
    const instancedBlades = new THREE.InstancedMesh(bladeGeometry, bladeMaterial, bladeCount);
    const dummyObj = new THREE.Object3D();
    const bladeScale = 0.7 + stage * 0.026;
    for (let blade = 0; blade < bladeCount; blade += 1) {
      const angle = (blade / bladeCount) * Math.PI * 2;
      dummyObj.position.set(Math.cos(angle) * 0.76, Math.sin(angle) * 0.76, 0);
      dummyObj.rotation.set(0, 0, angle - 0.24 + stage * 0.018);
      dummyObj.scale.setScalar(bladeScale);
      dummyObj.updateMatrix();
      instancedBlades.setMatrixAt(blade, dummyObj.matrix);
    }
    instancedBlades.instanceMatrix.needsUpdate = true;
    rotor.add(instancedBlades);

    const sensorGeometry = new THREE.SphereGeometry(0.055, 8, 8);
    const sensorMaterial = physicalMaterial(stage === 4 ? palette.yellow : palette.blue, {
      roughness: 0.22,
      metalness: 0.36,
      emissive: stage === 4 ? palette.yellow : palette.blueDim,
      emissiveIntensity: 0.72
    });
    const instancedSensors = new THREE.InstancedMesh(sensorGeometry, sensorMaterial, 6);
    for (let s = 0; s < 6; s += 1) {
      const angle = (s / 6) * Math.PI * 2;
      dummyObj.position.set(Math.cos(angle) * 1.72, Math.sin(angle) * 1.72, 0.18);
      dummyObj.rotation.set(0, 0, 0);
      dummyObj.scale.setScalar(1);
      dummyObj.updateMatrix();
      instancedSensors.setMatrixAt(s, dummyObj.matrix);
    }
    instancedSensors.instanceMatrix.needsUpdate = true;
    rotor.add(instancedSensors);

    group.userData.rotors.push(rotor);
    group.add(rotor);

    if (stage < stageCount - 1) {
      const stator = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.CylinderGeometry(1.86, 1.86, 0.08, 56, 1, true)),
        lineMaterial(palette.blueDim, 0.5)
      );
      stator.position.x = rotor.position.x + 0.62;
      stator.rotation.z = Math.PI / 2;
      group.add(stator);
    }
  }

  const inletCone = new THREE.Mesh(
    new THREE.ConeGeometry(0.9, 1.45, 48, 1, true),
    physicalMaterial(0x87938d, { roughness: 0.22, metalness: 0.88, clearcoat: 0.48, side: THREE.DoubleSide })
  );
  inletCone.position.x = -4.65;
  inletCone.rotation.z = -Math.PI / 2;
  group.add(inletCone);

  const diffuser = new THREE.Mesh(
    new THREE.CylinderGeometry(1.28, 1.78, 1.2, 56, 1, true),
    physicalMaterial(0x263a32, {
      roughness: 0.18,
      metalness: 0.7,
      opacity: 0.56,
      side: THREE.DoubleSide,
      emissive: palette.greenDim,
      emissiveIntensity: 0.18
    })
  );
  diffuser.position.x = 4.15;
  diffuser.rotation.z = Math.PI / 2;
  group.add(diffuser);

  [-2.7, 2.7].forEach((x) => {
    const bearing = new THREE.Group();
    const pedestal = new THREE.Mesh(
      new THREE.BoxGeometry(0.86, 0.42, 1.05),
      physicalMaterial(0x1a2420, { roughness: 0.38, metalness: 0.82, clearcoat: 0.26 })
    );
    pedestal.position.y = -2.16;
    bearing.add(pedestal);
    const housing = new THREE.Mesh(
      new THREE.CylinderGeometry(0.42, 0.42, 0.72, 32),
      physicalMaterial(0x647069, { roughness: 0.24, metalness: 0.88 })
    );
    housing.rotation.z = Math.PI / 2;
    housing.position.y = -1.72;
    bearing.add(housing);
    bearing.position.x = x;
    group.add(bearing);
  });

  [-3.72, -1.24, 1.24, 3.72].forEach((x, index) => {
    const instrumentRing = new THREE.Mesh(
      new THREE.TorusGeometry(2.18, 0.022, 6, 96),
      physicalMaterial(index === 2 ? palette.orange : palette.green, {
        roughness: 0.18,
        metalness: 0.65,
        opacity: index === 2 ? 0.66 : 0.25,
        emissive: index === 2 ? palette.orange : palette.greenDim,
        emissiveIntensity: 0.6
      })
    );
    instrumentRing.position.x = x;
    instrumentRing.rotation.y = Math.PI / 2;
    instrumentRing.userData.speed = (index % 2 ? -1 : 1) * (0.12 + index * 0.02);
    group.userData.instrumentRings.push(instrumentRing);
    group.add(instrumentRing);
  });

  const particleGeometry = new THREE.SphereGeometry(0.045, 8, 8);
  for (let i = 0; i < 38; i += 1) {
    const particle = new THREE.Mesh(
      particleGeometry,
      meshMaterial(i % 5 === 0 ? palette.yellow : palette.green, {
        roughness: 0.22,
        metalness: 0.1,
        emissive: i % 5 === 0 ? palette.yellow : palette.green,
        emissiveIntensity: 0.85
      })
    );
    particle.userData.offset = random();
    particle.userData.radius = 0.18 + random() * 1.18;
    particle.userData.phase = random() * Math.PI * 2;
    particle.userData.speed = 0.075 + random() * 0.045;
    group.userData.flowParticles.push(particle);
    group.add(particle);
  }

  const envelope = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(9.6, 4.4, 4.4)),
    lineMaterial(palette.greenDim, 0.32)
  );
  group.add(envelope);

  const evidenceTrace = [];
  for (let i = 0; i < 85; i += 1) {
    const x = -4.1 + i * 0.098;
    const y = -2.65 + Math.sin(i * 0.18) * 0.3 + (i / 85) * 0.82;
    evidenceTrace.push(x, y, 1.5);
  }
  const evidenceGeometry = new THREE.BufferGeometry();
  evidenceGeometry.setAttribute("position", new THREE.Float32BufferAttribute(evidenceTrace, 3));
  group.add(new THREE.Line(evidenceGeometry, lineMaterial(palette.yellow, 0.9)));
  addWorldLight(group, palette.green, [-2.4, 2.6, 3.2], 26, 13);
  addWorldLight(group, palette.orange, [2.6, 1.4, 2.8], 24, 12);
  return group;
}

function createTopoWorld() {
  const group = new THREE.Group();
  group.position.set(9.6, 0.1, -16.25);
  group.scale.setScalar(0.72);
  group.userData.nodes = [];
  group.userData.flowParticles = [];
  group.userData.shells = [];

  const vectors = [];
  for (let i = 0; i < 82; i += 1) {
    const v = new THREE.Vector3(
      (random() - 0.5) * 7.2,
      (random() - 0.5) * 6,
      (random() - 0.5) * 5.2
    );
    vectors.push(v);
  }

  const edgePositions = [];
  vectors.forEach((a, index) => {
    vectors.slice(index + 1).forEach((b) => {
      const distance = a.distanceTo(b);
      if (distance < 1.62 && random() > 0.28) {
        edgePositions.push(a.x, a.y, a.z, b.x, b.y, b.z);
      }
    });
  });

  const poreGeometry = new THREE.IcosahedronGeometry(0.1, 2);
  const poreMaterial = physicalMaterial(0x9ab8d2, {
    roughness: 0.24,
    metalness: 0.38,
    clearcoat: 0.5,
    emissive: 0x102c44,
    emissiveIntensity: 0.32
  });
  const pores = new THREE.InstancedMesh(poreGeometry, poreMaterial, vectors.length);
  const poreMatrix = new THREE.Object3D();
  vectors.forEach((position, index) => {
    const scale = 0.7 + random() * 1.9;
    poreMatrix.position.copy(position);
    poreMatrix.scale.set(scale, scale * (0.75 + random() * 0.5), scale);
    poreMatrix.rotation.set(random() * Math.PI, random() * Math.PI, random() * Math.PI);
    poreMatrix.updateMatrix();
    pores.setMatrixAt(index, poreMatrix.matrix);
    pores.setColorAt(index, new THREE.Color(index % 9 === 0 ? 0x58c8a1 : index % 4 === 0 ? 0x3b6d92 : 0x25445e));
  });
  pores.instanceMatrix.needsUpdate = true;
  if (pores.instanceColor) pores.instanceColor.needsUpdate = true;
  group.add(pores);
  group.add(linesFromArray(edgePositions, palette.blueDim, 0.66));

  const shellSolid = new THREE.Mesh(
    new THREE.DodecahedronGeometry(4.6, 1),
    physicalMaterial(0x101b20, {
      roughness: 0.62,
      metalness: 0.18,
      opacity: 0.055,
      side: THREE.DoubleSide,
      depthWrite: false
    })
  );
  shellSolid.scale.set(1.25, 0.92, 0.9);
  group.add(shellSolid);

  const poreShell = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.DodecahedronGeometry(4.6, 1)),
    lineMaterial(palette.faint, 0.22)
  );
  poreShell.scale.set(1.25, 0.92, 0.9);
  group.add(poreShell);

  const matrixGeometry = new THREE.IcosahedronGeometry(0.78, 1);
  const matrixMaterial = physicalMaterial(0x465657, {
    roughness: 0.78,
    metalness: 0.14,
    clearcoat: 0.08,
    opacity: 0.38,
    emissive: 0x071011,
    emissiveIntensity: 0.1
  });
  const matrixCells = new THREE.InstancedMesh(matrixGeometry, matrixMaterial, 54);
  const matrixObject = new THREE.Object3D();
  for (let index = 0; index < 54; index += 1) {
    const angle = random() * Math.PI * 2;
    const polar = Math.acos(2 * random() - 1);
    const radius = 3.2 + random() * 1.35;
    matrixObject.position.set(
      Math.sin(polar) * Math.cos(angle) * radius * 1.12,
      Math.cos(polar) * radius * 0.82,
      Math.sin(polar) * Math.sin(angle) * radius * 0.78
    );
    const scale = 0.62 + random() * 0.72;
    matrixObject.scale.set(scale * (0.8 + random() * 0.45), scale, scale * (0.8 + random() * 0.35));
    matrixObject.rotation.set(random() * Math.PI, random() * Math.PI, random() * Math.PI);
    matrixObject.updateMatrix();
    matrixCells.setMatrixAt(index, matrixObject.matrix);
  }
  matrixCells.instanceMatrix.needsUpdate = true;
  group.add(matrixCells);
  group.userData.matrixCells = matrixCells;

  const curvePoints = [];
  for (let i = 0; i < 12; i += 1) {
    const t = i / 11;
    curvePoints.push(new THREE.Vector3(
      -4.4 + t * 8.8,
      Math.sin(t * Math.PI * 5) * 0.78,
      Math.cos(t * Math.PI * 3) * 0.7
    ));
  }
  const flowCurve = new THREE.CatmullRomCurve3(curvePoints, false, "centripetal");
  group.userData.flowCurve = flowCurve;
  const flowTube = new THREE.Mesh(
    new THREE.TubeGeometry(flowCurve, 120, 0.025, 8, false),
    meshMaterial(palette.green, {
      roughness: 0.2,
      metalness: 0.12,
      emissive: palette.green,
      emissiveIntensity: 0.82
    })
  );
  group.add(flowTube);

  [-1, 1].forEach((direction, index) => {
    const secondaryPoints = [];
    for (let point = 0; point < 10; point += 1) {
      const t = point / 9;
      secondaryPoints.push(new THREE.Vector3(
        -4.1 + t * 8.2,
        direction * (1.1 + Math.sin(t * Math.PI * 4 + index) * 0.45),
        Math.cos(t * Math.PI * 3 + index) * 0.62
      ));
    }
    const secondaryCurve = new THREE.CatmullRomCurve3(secondaryPoints, false, "centripetal");
    const secondaryTube = new THREE.Mesh(
      new THREE.TubeGeometry(secondaryCurve, 90, 0.012, 6, false),
      physicalMaterial(index ? palette.blue : palette.green, {
        roughness: 0.18,
        metalness: 0.12,
        emissive: index ? palette.blueDim : palette.greenDim,
        emissiveIntensity: 0.72,
        opacity: 0.6
      })
    );
    group.add(secondaryTube);
  });

  const tracerGeometry = new THREE.SphereGeometry(0.075, 10, 10);
  for (let i = 0; i < 16; i += 1) {
    const tracer = new THREE.Mesh(
      tracerGeometry,
      meshMaterial(i % 4 === 0 ? palette.yellow : palette.green, {
        roughness: 0.2,
        metalness: 0.08,
        emissive: i % 4 === 0 ? palette.yellow : palette.green,
        emissiveIntensity: 1
      })
    );
    tracer.userData.offset = i / 16;
    tracer.userData.speed = 0.035 + random() * 0.025;
    group.userData.flowParticles.push(tracer);
    const tracerGlow = createGlowSprite(i % 4 === 0 ? palette.yellow : palette.green, 0.42, 0.36);
    tracer.add(tracerGlow);
    group.add(tracer);
  }
  addWorldLight(group, palette.blue, [-2.8, 2.5, 4], 28, 13);
  addWorldLight(group, palette.green, [3.1, -1.2, 3.2], 20, 11);
  return group;
}

function createAegisWorld() {
  const group = new THREE.Group();
  group.position.set(-9.85, 0.2, -0.35);
  group.rotation.set(-0.52, 0.08, -0.04);
  group.scale.setScalar(0.88);
  group.userData.bars = [];
  group.userData.blips = [];
  group.userData.orbits = [];
  group.userData.codePanels = [];

  // Evidence kernel: a dense metallic core inside a glass inspection shell.
  const coreMesh = new THREE.Mesh(
    new THREE.DodecahedronGeometry(0.62, 1),
    physicalMaterial(0x32150d, {
      roughness: 0.16,
      metalness: 0.84,
      clearcoat: 0.68,
      emissive: palette.orangeDim,
      emissiveIntensity: 0.72
    })
  );
  group.userData.coreMesh = coreMesh;
  group.add(coreMesh);

  const coreBox = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(1.25, 1.25, 1.25)),
    lineMaterial(palette.orange, 0.75)
  );
  group.userData.coreBox = coreBox;
  group.add(coreBox);

  const inspectionShell = new THREE.Mesh(
    new THREE.SphereGeometry(0.96, 48, 32),
    physicalMaterial(0x4b261a, {
      roughness: 0.06,
      metalness: 0.02,
      transmission: 0.52,
      thickness: 0.22,
      opacity: 0.16,
      side: THREE.DoubleSide,
      depthWrite: false,
      emissive: palette.orangeDim,
      emissiveIntensity: 0.18
    })
  );
  group.add(inspectionShell);
  group.userData.inspectionShell = inspectionShell;

  const radarDeck = new THREE.Mesh(
    new THREE.CircleGeometry(5.35, 128),
    physicalMaterial(0x130b08, {
      roughness: 0.52,
      metalness: 0.24,
      opacity: 0.12,
      side: THREE.DoubleSide,
      depthWrite: false
    })
  );
  radarDeck.position.z = -0.055;
  group.add(radarDeck);

  // Precision radar rings with a second orthogonal evidence orbit.
  [1.4, 2.6, 3.7, 4.6].forEach((radius, index) => {
    const points = [];
    for (let i = 0; i <= 96; i += 1) {
      const angle = (i / 96) * Math.PI * 2;
      points.push(Math.cos(angle) * radius, Math.sin(angle) * radius, 0);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
    group.add(new THREE.Line(geometry, lineMaterial(index === 2 ? palette.orange : palette.faint, index === 2 ? 0.85 : 0.42)));
  });

  const spokes = [];
  for (let i = 0; i < 16; i += 1) {
    const angle = (i / 16) * Math.PI * 2;
    spokes.push(0, 0, 0, Math.cos(angle) * 4.9, Math.sin(angle) * 4.9, 0);
  }
  group.add(linesFromArray(spokes, palette.faint, 0.35));

  [1.8, 3.15, 4.35].forEach((radius, index) => {
    const orbit = new THREE.Mesh(
      new THREE.TorusGeometry(radius, 0.018, 6, 120),
      physicalMaterial(index === 1 ? palette.yellow : palette.orange, {
        roughness: 0.22,
        metalness: 0.68,
        opacity: index === 1 ? 0.58 : 0.24,
        emissive: index === 1 ? palette.yellow : palette.orangeDim,
        emissiveIntensity: 0.66
      })
    );
    orbit.rotation.set(Math.PI / 2, index * 0.38, 0.35 + index * 0.42);
    orbit.userData.speed = (index % 2 ? -1 : 1) * (0.05 + index * 0.025);
    group.userData.orbits.push(orbit);
    group.add(orbit);
  });

  // 3. Sweeper Line & Sector Cone
  const sweepGeometry = new THREE.BufferGeometry();
  sweepGeometry.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0, 4.9, 0, 0], 3));
  const sweep = new THREE.Line(sweepGeometry, lineMaterial(palette.orange, 0.95));
  sweep.userData.isSweep = true;
  group.userData.sweep = sweep;
  group.add(sweep);

  const sweepSector = new THREE.Mesh(
    new THREE.CircleGeometry(4.8, 72, 0, 0.48),
    new THREE.MeshBasicMaterial({
      color: palette.orange,
      transparent: true,
      opacity: 0.045,
      side: THREE.DoubleSide,
      depthWrite: false
    })
  );
  sweepSector.position.z = -0.015;
  group.userData.sweepSector = sweepSector;
  group.add(sweepSector);

  // Anomaly signal towers use narrow instrument-like profiles.
  const barGeometry = new THREE.BoxGeometry(0.065, 1, 0.065);
  for (let i = 0; i < 20; i += 1) {
    const angle = (i / 20) * Math.PI * 2;
    const height = 0.35 + random() * 1.3;
    const bar = new THREE.Mesh(
      barGeometry,
      physicalMaterial(i % 5 === 0 ? palette.yellow : palette.orange, {
        roughness: 0.24,
        metalness: 0.72,
        emissive: i % 5 === 0 ? palette.yellow : palette.orangeDim,
        emissiveIntensity: i % 5 === 0 ? 0.48 : 0.24
      })
    );
    bar.scale.y = height;
    bar.position.set(Math.cos(angle) * 5.1, Math.sin(angle) * 5.1, height * 0.4);
    bar.rotation.z = angle - Math.PI / 2;
    bar.userData.baseHeight = height;
    bar.userData.phase = random() * Math.PI * 2;
    group.userData.bars.push(bar);
    group.add(bar);
  }

  // 5. Threat Indicator Blips
  const blipGeometry = new THREE.SphereGeometry(0.09, 12, 12);
  for (let i = 0; i < 11; i += 1) {
    const angle = random() * Math.PI * 2;
    const radius = 1.1 + random() * 3.2;
    const blip = new THREE.Mesh(
      blipGeometry,
      meshMaterial(i % 3 === 0 ? palette.yellow : palette.orange, {
        roughness: 0.22,
        metalness: 0.1,
        emissive: i % 3 === 0 ? palette.yellow : palette.orange,
        emissiveIntensity: 1.2
      })
    );
    blip.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius, 0.08);
    blip.userData.phase = random() * Math.PI * 2;
    group.userData.blips.push(blip);
    const blipGlow = createGlowSprite(i % 3 === 0 ? palette.yellow : palette.orange, 0.48, 0.42);
    blipGlow.position.copy(blip.position);
    group.add(blip, blipGlow);
  }

  const evidenceFrames = [];
  for (let index = 0; index < 9; index += 1) {
    const angle = (index / 9) * Math.PI * 2 + 0.18;
    const radius = 2.05 + (index % 3) * 0.55;
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(0.54, 0.34, 0.035),
      physicalMaterial(index % 4 === 0 ? palette.yellow : palette.orange, {
        roughness: 0.2,
        metalness: 0.5,
        opacity: 0.3,
        emissive: index % 4 === 0 ? palette.yellow : palette.orangeDim,
        emissiveIntensity: 0.42
      })
    );
    frame.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius, 0.12 + (index % 2) * 0.08);
    frame.rotation.z = angle + Math.PI / 2;
    evidenceFrames.push(frame.position.x, frame.position.y, frame.position.z, 0, 0, 0.08);
    group.add(frame);
  }
  group.add(linesFromArray(evidenceFrames, palette.orangeDim, 0.22));

  const evidenceSurfaces = [
    {
      title: "claim_ingest.py",
      accent: "#ff7448",
      position: [-2.9, 2.18, 0.16],
      rotation: [0, 0, -0.08],
      lines: [
        { text: "normalized = normalize(payload.claim)", accent: true },
        { text: "claim_id = sha256(normalized)" },
        { text: "record = repo.get(claim_id)" },
        { text: "return record or enqueue(claim_id)" }
      ]
    },
    {
      title: "claim_worker.py",
      accent: "#f4d06f",
      position: [2.82, -2.16, 0.18],
      rotation: [0, 0, 0.08],
      lines: [
        { text: "status = 'in_progress'", accent: true },
        { text: "evidence = await research(claim)" },
        { text: "verdict = await evaluate(evidence)" },
        { text: "repo.complete(claim_id, verdict)" }
      ]
    }
  ];

  evidenceSurfaces.forEach((definition, index) => {
    const panel = new THREE.Mesh(
      new THREE.PlaneGeometry(2.72, 1.64),
      new THREE.MeshBasicMaterial({
        map: createCodeTexture(definition.title, definition.lines, definition.accent),
        transparent: true,
        opacity: 0.78,
        side: THREE.DoubleSide,
        depthWrite: false
      })
    );
    panel.position.fromArray(definition.position);
    panel.rotation.set(...definition.rotation);
    panel.userData.baseY = panel.position.y;
    panel.userData.phase = index * Math.PI;
    panel.renderOrder = 3;
    group.userData.codePanels.push(panel);
    group.add(panel);

    const panelFrame = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(2.8, 1.72, 0.035)),
      lineMaterial(index ? palette.yellow : palette.orange, 0.5)
    );
    panelFrame.position.copy(panel.position);
    panelFrame.rotation.copy(panel.rotation);
    panel.userData.frame = panelFrame;
    group.add(panelFrame);
  });

  addWorldLight(group, palette.orange, [1.6, 1.2, 2.8], 26, 12);
  addWorldLight(group, palette.yellow, [-2.6, -1.2, 1.2], 11, 8);
  return group;
}

function createGridiumWorld() {
  const group = new THREE.Group();
  group.position.set(-9.35, 8.05, -10.2);
  group.rotation.x = -0.08;
  group.userData.panels = [];
  group.userData.dataParticles = [];
  group.userData.nodes = [];
  group.userData.energyRings = [];

  const panelDefinitions = [
    {
      title: "ddpg_agent.py",
      accent: "#f97316",
      position: [-3.4, 1.1, 0.2],
      rotation: [0.04, 0.22, -0.025],
      lines: [
        { text: "fee = agent.select_action(obs)", accent: true },
        { text: "next_obs, reward, done, _, info =" },
        { text: "    env.step(fee)" },
        { text: "agent.store(obs, fee, reward, next_obs, done)" },
        { text: "# action maps to a 0.10%-5.00% fee" }
      ]
    },
    {
      title: "SurplusVerifier.sol",
      accent: "#47e6a5",
      position: [0, -0.2, -0.45],
      rotation: [-0.02, 0, 0.018],
      lines: [
        { text: "require(zkVerifier.verifyProof(", accent: true },
        { text: "    proofA, proofB, proofC, pubSignals" },
        { text: "), 'invalid energy proof');" },
        { text: "// proof-gated liquidity path" },
        { text: "_addLiquidity(msg.sender, energy, stable);" }
      ]
    },
    {
      title: "telemetry_gateway.ts",
      accent: "#668cff",
      position: [3.4, 1.15, 0.05],
      rotation: [0.02, -0.24, 0.025],
      lines: [
        { text: "async function fetchTick() {", accent: true },
        { text: "    const { data } = await axios.get('/tick');" },
        { text: "    io.emit('simulation_tick', data);" },
        { text: "}" },
        { text: "setInterval(fetchTick, 500);" }
      ]
    }
  ];

  panelDefinitions.forEach((definition, index) => {
    const panel = new THREE.Mesh(
      new THREE.PlaneGeometry(4.45, 2.7),
      new THREE.MeshBasicMaterial({
        map: createCodeTexture(definition.title, definition.lines, definition.accent),
        transparent: true,
        opacity: 0.94,
        side: THREE.DoubleSide
      })
    );
    panel.position.fromArray(definition.position);
    panel.rotation.set(...definition.rotation);
    panel.userData.phase = index * 1.7;
    panel.userData.baseY = panel.position.y;
    group.userData.panels.push(panel);
    group.add(panel);

    const frame = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(4.58, 2.82, 0.06)),
      lineMaterial([palette.orange, palette.green, palette.blue][index], 0.48)
    );
    frame.position.copy(panel.position);
    frame.rotation.copy(panel.rotation);
    group.add(frame);
  });

  const architectureNodes = [
    new THREE.Vector3(-3.2, -2.05, 0),
    new THREE.Vector3(0, -2.05, -0.25),
    new THREE.Vector3(3.2, -2.05, 0)
  ];
  const architectureEdges = [];
  architectureNodes.slice(0, -1).forEach((node, index) => {
    const next = architectureNodes[index + 1];
    architectureEdges.push(node.x, node.y, node.z, next.x, next.y, next.z);
  });
  group.add(linesFromArray(architectureEdges, palette.orange, 0.72));

  architectureNodes.forEach((position, index) => {
    const node = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.34, 0.34),
      meshMaterial([palette.orange, palette.green, palette.blue][index], {
        roughness: 0.2,
        metalness: 0.72,
        emissive: [palette.orangeDim, palette.greenDim, palette.blueDim][index],
        emissiveIntensity: 0.6
      })
    );
    node.position.copy(position);
    group.add(node);
  });

  const packetGeometry = new THREE.OctahedronGeometry(0.075, 0);
  for (let i = 0; i < 12; i += 1) {
    const packet = new THREE.Mesh(
      packetGeometry,
      meshMaterial(i % 3 === 0 ? palette.yellow : palette.orange, {
        emissive: i % 3 === 0 ? palette.yellow : palette.orange,
        emissiveIntensity: 1
      })
    );
    packet.userData.offset = i / 12;
    group.userData.dataParticles.push(packet);
    group.add(packet);
  }

  const platform = new THREE.Mesh(
    new THREE.BoxGeometry(9.5, 0.16, 5.2),
    physicalMaterial(0x0d1511, {
      roughness: 0.48,
      metalness: 0.72,
      clearcoat: 0.3,
      opacity: 0.76,
      emissive: 0x07100c,
      emissiveIntensity: 0.2
    })
  );
  platform.position.set(0, -2.65, -1.25);
  group.add(platform);

  const microgridPoints = [
    [-3.7, -2.36, -2.5], [-2.35, -2.36, -0.75], [-1.25, -2.36, -2.15],
    [0.1, -2.36, -0.65], [1.2, -2.36, -2.35], [2.55, -2.36, -0.85],
    [3.75, -2.36, -2.55], [-3.25, -2.36, 0.25], [0.2, -2.36, 0.55], [3.4, -2.36, 0.25]
  ];
  const networkEdges = [];
  microgridPoints.forEach((position, index) => {
    const height = 0.42 + (index % 4) * 0.17;
    const building = new THREE.Mesh(
      new THREE.BoxGeometry(0.42 + (index % 2) * 0.12, height, 0.38),
      physicalMaterial(index % 5 === 0 ? 0x28311f : 0x17201b, {
        roughness: 0.34,
        metalness: 0.68,
        clearcoat: 0.4,
        emissive: index % 5 === 0 ? palette.orangeDim : palette.greenDim,
        emissiveIntensity: index % 5 === 0 ? 0.45 : 0.18
      })
    );
    building.position.set(position[0], position[1] + height / 2, position[2]);
    group.add(building);

    const contact = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.09, 0.045, 20),
      physicalMaterial(index % 3 === 0 ? palette.orange : palette.green, {
        roughness: 0.18,
        metalness: 0.56,
        emissive: index % 3 === 0 ? palette.orangeDim : palette.greenDim,
        emissiveIntensity: 0.75
      })
    );
    contact.position.set(position[0], -2.51, position[2]);
    group.add(contact);

    if (index > 0) {
      const previous = microgridPoints[index - 1];
      networkEdges.push(previous[0], -2.48, previous[2], position[0], -2.48, position[2]);
    }
    if (index > 2 && index % 2 === 0) {
      const previous = microgridPoints[index - 3];
      networkEdges.push(previous[0], -2.48, previous[2], position[0], -2.48, position[2]);
    }
  });
  group.add(linesFromArray(networkEdges, palette.orange, 0.46));

  const batteryRack = new THREE.Group();
  for (let cell = 0; cell < 7; cell += 1) {
    const battery = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.72, 0.42),
      physicalMaterial(0x172820, {
        roughness: 0.24,
        metalness: 0.72,
        emissive: cell % 2 ? palette.greenDim : palette.blueDim,
        emissiveIntensity: 0.38
      })
    );
    battery.position.x = (cell - 3) * 0.24;
    batteryRack.add(battery);
  }
  batteryRack.position.set(0.25, -2.08, -2.9);
  group.add(batteryRack);

  [0.78, 1.22].forEach((radius, index) => {
    const energyRing = createTechRing(radius, index ? palette.green : palette.orange, index ? 0.38 : 0.7, 96);
    energyRing.position.set(0.25, -2.48 + index * 0.012, -2.9);
    energyRing.userData.speed = index ? -0.18 : 0.24;
    group.userData.energyRings.push(energyRing);
    group.add(energyRing);
  });

  addWorldLight(group, palette.orange, [-2.4, 0.8, 2.2], 24, 12);
  addWorldLight(group, palette.green, [2.7, -0.5, 1.4], 20, 11);

  return group;
}

function createAegisInvestigationWorld() {
  const group = new THREE.Group();
  group.position.set(-4.5, 0.1, -0.5);
  group.rotation.set(-0.16, -0.08, -0.035);
  group.scale.setScalar(0.80);
  group.userData.orbits = [];
  group.userData.bars = [];
  group.userData.blips = [];
  group.userData.codePanels = [];
  group.userData.scanHeads = [];
  group.userData.claimPackets = [];
  group.userData.evidencePackets = [];
  group.userData.agentCores = [];
  group.userData.verdictBars = [];

  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(10.4, 0.12, 6.4),
    physicalMaterial(0x090d15, {
      roughness: 0.5,
      metalness: 0.62,
      clearcoat: 0.32,
      opacity: 0.7,
      emissive: 0x06111d,
      emissiveIntensity: 0.2
    })
  );
  floor.position.y = -2.2;
  group.add(floor);

  const floorLines = [];
  for (let i = -5; i <= 5; i += 1) {
    floorLines.push(i, -2.13, -3.1, i, -2.13, 3.1);
  }
  for (let i = -3; i <= 3; i += 1) {
    floorLines.push(-5.1, -2.13, i, 5.1, -2.13, i);
  }
  group.add(linesFromArray(floorLines, palette.blueDim, 0.18));

  const claimTexture = createCodeTexture("incoming_claim.json", [
    { text: "claim_id: 7d9f...", accent: true },
    { text: "source: public feed" },
    { text: "status: investigate" },
    { text: "evidence: pending" }
  ], "#668cff");
  const claimDossier = new THREE.Group();
  const claimBody = new THREE.Mesh(
    new THREE.BoxGeometry(2.05, 1.26, 0.12),
    physicalMaterial(0x13213a, { roughness: 0.24, metalness: 0.55, clearcoat: 0.68 })
  );
  const claimFace = new THREE.Mesh(
    new THREE.PlaneGeometry(1.92, 1.12),
    new THREE.MeshBasicMaterial({ map: claimTexture, toneMapped: false })
  );
  claimFace.position.z = 0.066;
  claimDossier.add(claimBody, claimFace);
  claimDossier.position.set(-4.05, 0.05, 0.05);
  claimDossier.rotation.y = 0.08;
  group.add(claimDossier);
  group.userData.claimDossier = claimDossier;

  const intakeRail = addCurve(group, [
    new THREE.Vector3(-5.25, 0, 0),
    new THREE.Vector3(-4.6, 0.05, 0),
    new THREE.Vector3(-3.25, 0.05, 0)
  ], palette.blue, 0.018, 0.72);

  const agentDefinitions = [
    { title: "TREND", detail: "viral signals", color: palette.orange, position: [-1.95, 1.55, 0.15] },
    { title: "SCOUT", detail: "market evidence", color: 0xa775ff, position: [-0.15, 1.55, -0.15] },
    { title: "WATCH", detail: "person context", color: palette.blue, position: [-1.95, -1.1, 0.2] },
    { title: "SHIELD", detail: "brand exposure", color: palette.green, position: [-0.15, -1.1, -0.1] }
  ];
  const evidenceCurves = [];

  agentDefinitions.forEach((definition, index) => {
    const station = new THREE.Group();
    station.position.set(...definition.position);
    const housing = new THREE.Mesh(
      new THREE.BoxGeometry(1.36, 1.2, 0.72),
      physicalMaterial(0x111827, {
        roughness: 0.24,
        metalness: 0.78,
        clearcoat: 0.62,
        emissive: definition.color,
        emissiveIntensity: 0.08
      })
    );
    const aperture = new THREE.Mesh(
      new THREE.CylinderGeometry(0.23, 0.23, 0.16, 28),
      physicalMaterial(definition.color, {
        roughness: 0.1,
        metalness: 0.45,
        emissive: definition.color,
        emissiveIntensity: 1.1
      })
    );
    aperture.rotation.x = Math.PI / 2;
    aperture.position.z = 0.42;
    const scanHead = new THREE.Mesh(
      new THREE.BoxGeometry(1.06, 0.055, 0.08),
      meshMaterial(definition.color, {
        emissive: definition.color,
        emissiveIntensity: 1.25,
        opacity: 0.86,
        depthWrite: false
      })
    );
    scanHead.position.z = 0.45;
    scanHead.userData.phase = index * 0.85;
    station.add(housing, aperture, scanHead);

    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(1.02, 0.48),
      new THREE.MeshBasicMaterial({
        map: createCodeTexture(definition.title, [
          { text: definition.detail, accent: true },
          { text: "evidence: streaming" }
        ], `#${definition.color.toString(16).padStart(6, "0")}`),
        toneMapped: false
      })
    );
    screen.position.set(0, -0.2, 0.405);
    station.add(screen);
    group.add(station);
    group.userData.scanHeads.push(scanHead);
    group.userData.agentCores.push(aperture);

    const start = new THREE.Vector3(definition.position[0] + 0.7, definition.position[1], definition.position[2]);
    const end = new THREE.Vector3(2.45, index < 2 ? 0.42 : -0.42, 0);
    const mid = start.clone().lerp(end, 0.5);
    mid.z += index % 2 ? -0.42 : 0.42;
    evidenceCurves.push(addCurve(group, [start, mid, end], definition.color, 0.014, 0.62));
  });

  const intakePacketGeometry = new THREE.BoxGeometry(0.15, 0.11, 0.05);
  for (let i = 0; i < 4; i += 1) {
    const packet = new THREE.Mesh(
      intakePacketGeometry,
      meshMaterial(palette.blue, { emissive: palette.blue, emissiveIntensity: 1.2 })
    );
    packet.userData.route = intakeRail;
    packet.userData.offset = i / 4;
    group.userData.claimPackets.push(packet);
    group.add(packet);
  }

  const packetGeometry = new THREE.OctahedronGeometry(0.075, 0);
  evidenceCurves.forEach((curve, curveIndex) => {
    for (let i = 0; i < 3; i += 1) {
      const color = agentDefinitions[curveIndex].color;
      const packet = new THREE.Mesh(
        packetGeometry,
        meshMaterial(color, { emissive: color, emissiveIntensity: 1.25 })
      );
      packet.userData.route = curve;
      packet.userData.offset = (i + curveIndex * 0.22) / 3;
      packet.userData.speed = 0.1 + curveIndex * 0.008;
      group.userData.evidencePackets.push(packet);
      group.add(packet);
    }
  });

  const verdictGate = new THREE.Group();
  verdictGate.position.set(3.45, 0, 0);
  [-0.88, 0.88].forEach((x) => {
    const pillar = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 3.65, 0.52),
      physicalMaterial(0x1b2432, { roughness: 0.2, metalness: 0.84, clearcoat: 0.76 })
    );
    pillar.position.x = x;
    verdictGate.add(pillar);
  });
  const verdictPane = new THREE.Mesh(new THREE.BoxGeometry(1.58, 2.55, 0.11), glass(palette.green, 0.18));
  verdictGate.add(verdictPane);
  const verdictColors = [palette.green, palette.orange, palette.green, palette.blue];
  verdictColors.forEach((color, index) => {
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(1.16, 0.12, 0.08),
      meshMaterial(color, { emissive: color, emissiveIntensity: 1, opacity: 0.86, depthWrite: false })
    );
    bar.position.set(0, 0.72 - index * 0.47, 0.12);
    bar.userData.phase = index * 0.62;
    verdictGate.add(bar);
    group.userData.verdictBars.push(bar);
  });
  const verdictSeal = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.38, 0),
    physicalMaterial(palette.green, {
      roughness: 0.12,
      metalness: 0.7,
      clearcoat: 0.9,
      emissive: palette.green,
      emissiveIntensity: 0.75
    })
  );
  verdictSeal.position.set(0, -1.58, 0.18);
  verdictGate.add(verdictSeal);
  group.userData.verdictSeal = verdictSeal;
  group.add(verdictGate);

  addWorldLight(group, palette.blue, [-3.7, 1.8, 3], 22, 12);
  addWorldLight(group, 0xa775ff, [-0.7, 1.2, 2.8], 16, 9);
  addWorldLight(group, palette.green, [3.5, -0.5, 2.6], 24, 11);
  return group;
}

function createGridiumLivingNetworkWorld() {
  const group = new THREE.Group();
  group.position.set(-2.0, 6.6, -9.65);
  group.rotation.set(0.42, -0.04, -0.04);
  group.scale.setScalar(0.70);
  group.userData.panels = [];
  group.userData.dataParticles = [];
  group.userData.energyRings = [];
  group.userData.nodes = [];
  group.userData.gridRoutes = [];
  group.userData.proofLeaves = [];

  const deck = new THREE.Mesh(
    new THREE.CylinderGeometry(5.4, 5.7, 0.28, 6),
    physicalMaterial(0x0d1516, {
      roughness: 0.48,
      metalness: 0.66,
      clearcoat: 0.32,
      emissive: 0x071414,
      emissiveIntensity: 0.18
    })
  );
  deck.position.y = -1.86;
  group.add(deck);
  const deckEdge = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.CylinderGeometry(5.42, 5.72, 0.3, 6)),
    lineMaterial(palette.blue, 0.28)
  );
  deckEdge.position.y = -1.86;
  group.add(deckEdge);

  const coordinates = [
    [-3.9, -2.15], [-2.05, -3.15], [0, -3.55], [2.15, -3.05], [3.95, -1.95],
    [-3.55, 0.35], [-1.7, -0.65], [0, -0.85], [1.8, -0.55], [3.55, 0.45],
    [-2.8, 2.05], [-0.9, 1.55], [1.05, 1.65], [2.85, 2.05], [0.05, 3.4]
  ];
  const nodeTypes = ["solar", "home", "battery", "home", "solar", "battery", "home", "solar", "home", "battery", "solar", "home", "battery", "home", "solar"];
  const routes = [];
  const padGeometry = new THREE.CylinderGeometry(0.48, 0.55, 0.12, 24);
  const haloGeometry = new THREE.TorusGeometry(0.58, 0.022, 6, 42);
  const solarMastGeom = new THREE.BoxGeometry(0.07, 0.48, 0.07);
  const solarPanelGeom = new THREE.BoxGeometry(0.78, 0.055, 0.52);
  const batteryRackGeom = new THREE.BoxGeometry(0.52, 0.78, 0.48);
  const batteryCellGeom = new THREE.BoxGeometry(0.36, 0.045, 0.025);
  const homeBodyGeom = new THREE.BoxGeometry(0.62, 0.62, 0.56);
  const homeRoofGeom = new THREE.ConeGeometry(0.5, 0.35, 4);

  coordinates.forEach(([x, z], index) => {
    const node = new THREE.Group();
    node.position.set(x, -1.7, z);
    const padColor = nodeTypes[index] === "solar" ? palette.orange : nodeTypes[index] === "battery" ? palette.green : palette.blue;
    const pad = new THREE.Mesh(
      padGeometry,
      physicalMaterial(0x172022, { roughness: 0.3, metalness: 0.72, emissive: padColor, emissiveIntensity: 0.08 })
    );
    node.add(pad);
    const halo = new THREE.Mesh(haloGeometry, lineMaterial(padColor, 0.68));
    halo.rotation.x = Math.PI / 2;
    halo.position.y = 0.08;
    node.add(halo);

    if (nodeTypes[index] === "solar") {
      const mast = new THREE.Mesh(solarMastGeom, physicalMaterial(0x76817f, { roughness: 0.28, metalness: 0.8 }));
      mast.position.y = 0.3;
      const panel = new THREE.Mesh(
        solarPanelGeom,
        physicalMaterial(0x173a58, { roughness: 0.12, metalness: 0.58, emissive: palette.blueDim, emissiveIntensity: 0.3 })
      );
      panel.position.y = 0.62;
      panel.rotation.x = -0.28;
      node.add(mast, panel);
    } else if (nodeTypes[index] === "battery") {
      const rack = new THREE.Mesh(
        batteryRackGeom,
        physicalMaterial(0x183129, { roughness: 0.2, metalness: 0.76, emissive: palette.greenDim, emissiveIntensity: 0.22 })
      );
      rack.position.y = 0.46;
      node.add(rack);
      for (let cell = 0; cell < 3; cell += 1) {
        const charge = new THREE.Mesh(batteryCellGeom, meshMaterial(palette.green, { emissive: palette.green, emissiveIntensity: 0.8 }));
        charge.position.set(0, 0.28 + cell * 0.18, 0.255);
        node.add(charge);
      }
    } else {
      const home = new THREE.Mesh(
        homeBodyGeom,
        physicalMaterial(0x24303a, { roughness: 0.42, metalness: 0.46, emissive: palette.blueDim, emissiveIntensity: 0.1 })
      );
      home.position.y = 0.38;
      const roof = new THREE.Mesh(
        homeRoofGeom,
        physicalMaterial(0x34506a, { roughness: 0.26, metalness: 0.55 })
      );
      roof.position.y = 0.86;
      roof.rotation.y = Math.PI / 4;
      node.add(home, roof);
    }
    node.userData.phase = index * 0.47;
    node.userData.halo = halo;
    group.userData.nodes.push(node);
    group.add(node);

    const start = new THREE.Vector3(x, -1.05, z);
    const end = new THREE.Vector3(0, -0.45, 0);
    const mid = start.clone().lerp(end, 0.5);
    mid.y += 0.35 + (index % 3) * 0.1;
    routes.push(addCurve(group, [start, mid, end], padColor, 0.012, 0.42));
  });

  const pool = new THREE.Group();
  pool.position.set(0, -0.98, 0);
  const poolTank = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.05, 1.42, 48), glass(palette.green, 0.16));
  const poolLiquid = new THREE.Mesh(
    new THREE.CylinderGeometry(0.88, 0.88, 0.72, 48),
    physicalMaterial(palette.green, {
      roughness: 0.08,
      metalness: 0.18,
      transmission: 0.25,
      opacity: 0.52,
      emissive: palette.greenDim,
      emissiveIntensity: 0.65,
      depthWrite: false
    })
  );
  poolLiquid.position.y = -0.27;
  pool.add(poolTank, poolLiquid);
  [0.92, 1.28].forEach((radius, index) => {
    const ring = createTechRing(radius, index ? palette.orange : palette.green, index ? 0.52 : 0.72, 96);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = index ? 0.82 : -0.82;
    ring.userData.speed = index ? -0.14 : 0.18;
    group.userData.energyRings.push(ring);
    pool.add(ring);
  });
  group.userData.poolLiquid = poolLiquid;
  group.add(pool);

  const packetGeom = new THREE.SphereGeometry(0.052, 10, 10);
  routes.forEach((route, index) => {
    const packet = new THREE.Mesh(
      packetGeom,
      meshMaterial(index % 3 === 0 ? palette.orange : index % 3 === 1 ? palette.blue : palette.green, {
        emissive: index % 3 === 0 ? palette.orange : index % 3 === 1 ? palette.blue : palette.green,
        emissiveIntensity: 1.1
      })
    );
    packet.userData.route = route;
    packet.userData.offset = index / routes.length;
    packet.userData.speed = 0.055 + (index % 4) * 0.009;
    group.userData.dataParticles.push(packet);
    group.add(packet);
  });

  const proofGate = new THREE.Group();
  proofGate.position.set(4.25, -0.8, 1.65);
  const pillarGeom = new THREE.BoxGeometry(0.18, 1.65, 0.22);
  [-0.42, 0.42].forEach((x) => {
    const pillar = new THREE.Mesh(
      pillarGeom,
      physicalMaterial(0x1a2730, { roughness: 0.2, metalness: 0.85, emissive: palette.blueDim, emissiveIntensity: 0.18 })
    );
    pillar.position.x = x;
    proofGate.add(pillar);
  });
  for (let i = 0; i < 4; i += 1) {
    const leaf = new THREE.Mesh(
      new THREE.BoxGeometry(0.62 - i * 0.08, 0.08, 0.12),
      meshMaterial(palette.green, { emissive: palette.green, emissiveIntensity: 1, opacity: 0.8, depthWrite: false })
    );
    leaf.position.set(0, 0.52 - i * 0.32, 0.16);
    leaf.userData.phase = i * 0.5;
    proofGate.add(leaf);
    group.userData.proofLeaves.push(leaf);
  }
  group.add(proofGate);

  addWorldLight(group, palette.orange, [-3.4, 1.8, 3.2], 24, 13);
  addWorldLight(group, palette.green, [0.5, 1.2, 3.4], 26, 12);
  addWorldLight(group, palette.blue, [4, 0.4, 2.6], 18, 10);
  return group;
}

function createProfileWorld() {
  const group = new THREE.Group();
  group.position.set(6.2, 8, -0.15);
  group.rotation.x = -0.08;
  group.userData.rings = [];
  group.userData.modules = [];

  const helix = [];
  for (let i = 0; i < 130; i += 1) {
    const t = i / 129;
    const angle = t * Math.PI * 8;
    helix.push(Math.cos(angle) * 2.4, -3.8 + t * 7.6, Math.sin(angle) * 2.4);
  }
  const helixGeometry = new THREE.BufferGeometry();
  helixGeometry.setAttribute("position", new THREE.Float32BufferAttribute(helix, 3));
  group.add(new THREE.Line(helixGeometry, lineMaterial(palette.green, 0.82)));

  const spine = new THREE.Mesh(
    new THREE.CylinderGeometry(0.56, 0.56, 8.2, 48, 1, true),
    physicalMaterial(0x163128, {
      roughness: 0.08,
      metalness: 0.12,
      transmission: 0.4,
      thickness: 0.24,
      opacity: 0.13,
      side: THREE.DoubleSide,
      depthWrite: false,
      emissive: palette.greenDim,
      emissiveIntensity: 0.2
    })
  );
  group.add(spine);

  const years = [-2.7, 0, 2.7];
  years.forEach((y, index) => {
    const plate = new THREE.Mesh(
      new THREE.BoxGeometry(3.4, 0.08, 1.7),
      physicalMaterial([palette.orange, palette.blue, palette.green][index], {
        roughness: 0.24,
        metalness: 0.72,
        clearcoat: 0.42,
        opacity: 0.48,
        emissive: [palette.orangeDim, palette.blueDim, palette.greenDim][index],
        emissiveIntensity: 0.34
      })
    );
    plate.position.set(index % 2 === 0 ? 1.7 : -1.7, y, 0);
    plate.rotation.y = (index - 1) * 0.28;
    plate.userData.baseX = plate.position.x;
    plate.userData.phase = index * 1.4;
    group.userData.modules.push(plate);
    group.add(plate);
  });

  for (let index = 0; index < 6; index += 1) {
    const y = -3.4 + index * 1.36;
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.05 + (index % 2) * 0.22, 0.022, 8, 96),
      physicalMaterial(index % 3 === 0 ? palette.orange : index % 3 === 1 ? palette.blue : palette.green, {
        roughness: 0.18,
        metalness: 0.68,
        opacity: 0.5,
        emissive: index % 3 === 0 ? palette.orangeDim : index % 3 === 1 ? palette.blueDim : palette.greenDim,
        emissiveIntensity: 0.56
      })
    );
    ring.position.y = y;
    ring.rotation.x = Math.PI / 2;
    ring.userData.speed = (index % 2 ? -1 : 1) * (0.06 + index * 0.015);
    group.userData.rings.push(ring);
    group.add(ring);
  }

  const moduleGeometry = new THREE.BoxGeometry(1.45, 0.34, 0.12);
  for (let index = 0; index < 6; index += 1) {
    const y = -3.4 + index * 1.36;
    const module = new THREE.Mesh(
      moduleGeometry,
      physicalMaterial(0x17201c, {
        roughness: 0.3,
        metalness: 0.76,
        clearcoat: 0.32,
        emissive: index % 2 ? palette.blueDim : palette.greenDim,
        emissiveIntensity: 0.22
      })
    );
    const angle = index * 1.18;
    module.position.set(Math.cos(angle) * 2.55, y, Math.sin(angle) * 1.8);
    module.rotation.y = -angle + Math.PI / 2;
    module.userData.baseX = module.position.x;
    module.userData.phase = index * 0.86;
    group.userData.modules.push(module);
    group.add(module);
  }

  const frame = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(7.5, 9.2, 5.5)),
    lineMaterial(palette.faint, 0.28)
  );
  group.add(frame);
  addWorldLight(group, palette.green, [2.4, 2.7, 3], 24, 12);
  addWorldLight(group, palette.blue, [-2.5, -1.8, 2.2], 16, 10);
  return group;
}

const worlds = new Array(6).fill(null);
const worldFactories = [
  createOriginWorld,
  createAegisInvestigationWorld,
  createGridiumLivingNetworkWorld,
  createCompressorWorld,
  createTopoWorld,
  createProfileWorld
];

// ── Performance Telemetry & Adaptive Quality System ───────────────────────────
const perfMode = new URLSearchParams(window.location.search).has("perf") || window.location.hash.includes("perf");
let perfHud = null;
let frameCount = 0;
const frameWindow = [];
let qualityTier = "high";
let slowFrameTally = 0;
let fastFrameTally = 0;

function applyQualityTier(tier) {
  if (!renderer) return;
  const maxDpr = coarsePointer ? 1.0 : 1.15;
  let targetDpr = maxDpr;
  if (tier === "low") {
    targetDpr = Math.min(window.devicePixelRatio || 1, 0.65);
  } else if (tier === "medium") {
    targetDpr = Math.min(window.devicePixelRatio || 1, 0.85);
  } else {
    targetDpr = Math.min(window.devicePixelRatio || 1, maxDpr);
  }
  renderer.setPixelRatio(targetDpr);
  resizeRenderer();
  if (perfMode) {
    console.log(`[ADAPTIVE QUALITY] Tier changed to ${tier.toUpperCase()} (DPR: ${targetDpr.toFixed(2)})`);
  }
}

function recordFrameTime(frameDeltaMs, adapt = true) {
  if (frameWindow.length >= 60) frameWindow.shift();
  frameWindow.push(frameDeltaMs);
  if (!adapt) return;

  if (frameDeltaMs > 32) slowFrameTally++;
  else slowFrameTally = Math.max(0, slowFrameTally - 1);

  if (frameDeltaMs < 18) fastFrameTally++;
  else fastFrameTally = Math.max(0, fastFrameTally - 1);

  if (slowFrameTally >= 12 && qualityTier !== "low") {
    qualityTier = qualityTier === "high" ? "medium" : "low";
    applyQualityTier(qualityTier);
    slowFrameTally = 0;
  } else if (fastFrameTally >= 300 && qualityTier !== "high") {
    qualityTier = qualityTier === "low" ? "medium" : "high";
    applyQualityTier(qualityTier);
    fastFrameTally = 0;
  }
}

function updatePerfHud() {
  if (!perfMode || !renderer) return;
  if (!perfHud) {
    perfHud = document.createElement("div");
    perfHud.id = "perf-hud";
    Object.assign(perfHud.style, {
      position: "fixed",
      bottom: "16px",
      right: "16px",
      zIndex: "99999",
      padding: "10px 14px",
      background: "rgba(3, 7, 5, 0.94)",
      border: "1px solid rgba(71, 230, 165, 0.5)",
      borderRadius: "4px",
      fontFamily: "'DM Mono', monospace, monospace",
      fontSize: "11px",
      color: "#47e6a5",
      pointerEvents: "none",
      lineHeight: "1.45",
      boxShadow: "0 6px 24px rgba(0, 0, 0, 0.7)"
    });
    document.body.appendChild(perfHud);
  }
  frameCount++;
  if (frameCount % 8 !== 0) return;

  const avg = frameWindow.length ? (frameWindow.reduce((a, b) => a + b, 0) / frameWindow.length) : 16.6;
  const fps = Math.round(1000 / Math.max(avg, 1));
  const info = renderer.info;

  perfHud.innerHTML = `
    <div style="font-weight:700;letter-spacing:0.04em;border-bottom:1px solid rgba(71,230,165,0.25);margin-bottom:4px;padding-bottom:2px">
      SYSTEM TELEMETRY [${qualityTier.toUpperCase()}]
    </div>
    <div>FPS: <b>${fps}</b> <span style="color:#9aa7a0">(${avg.toFixed(1)}ms)</span></div>
    <div>CALLS: <b>${info.render.calls}</b> | TRIS: <b>${(info.render.triangles / 1000).toFixed(1)}k</b></div>
    <div>GEOM: <b>${info.memory.geometries}</b> | TEX: <b>${info.memory.textures}</b></div>
    <div>DPR: <b>${renderer.getPixelRatio().toFixed(2)}</b> | SCENE: <b>${sceneNames[currentScene]}</b></div>
  `;
}

window.__perfTelemetry = {
  getSnapshot: () => {
    const avg = frameWindow.length ? (frameWindow.reduce((a, b) => a + b, 0) / frameWindow.length) : 16.6;
    const sorted = [...frameWindow].sort((a, b) => a - b);
    const p95 = sorted.length ? sorted[Math.floor(sorted.length * 0.95)] : avg;
    const p99 = sorted.length ? sorted[Math.floor(sorted.length * 0.99)] : avg;
    return {
      fps: Math.round(1000 / Math.max(avg, 1)),
      avgFrameMs: avg,
      p95FrameMs: p95,
      p99FrameMs: p99,
      qualityTier,
      dpr: renderer ? renderer.getPixelRatio() : 1,
      calls: renderer?.info?.render?.calls || 0,
      triangles: renderer?.info?.render?.triangles || 0,
      geometries: renderer?.info?.memory?.geometries || 0,
      textures: renderer?.info?.memory?.textures || 0,
      renderedFrames,
      animationRunning: webglReady && !reduceMotion && !document.hidden,
      activeScene: sceneNames[currentScene]
    };
  }
};

const worldStatus = new Array(6).fill("unbuilt");
const worldCompilePromises = new Array(6).fill(null);

function ensureWorld(index) {
  if (index < 0 || index >= worldFactories.length) return null;
  if (!worlds[index]) {
    const t0 = performance.now();
    worldStatus[index] = "building";
    const world = worldFactories[index]();
    world.userData.baseScale = world.scale.clone();
    if (index < 5) {
      // Fit actual vertices and instances without empty bounding-box corners.
      world.updateWorldMatrix(true, true);
      const inverse = world.matrixWorld.clone().invert();
      const bounds = new THREE.Box3(), corners = [];
      world.traverse(object => {
        if (!object.geometry) return;
        let vertices = fittingVertices.get(object.geometry);
        if (!vertices) {
          const attribute = object.geometry.getAttribute("position");
          const unique = new Map();
          for (let i=0;i<attribute.count;i++) {
            const x=attribute.getX(i), y=attribute.getY(i), z=attribute.getZ(i);
            const key=`${x}:${y}:${z}`;
            if (!unique.has(key)) unique.set(key, new THREE.Vector3(x,y,z));
          }
          vertices = Array.from(unique.values());
          fittingVertices.set(object.geometry, vertices);
        }
        const local = new THREE.Matrix4().multiplyMatrices(inverse, object.matrixWorld);
        const collect = transform => {
          for (const vertex of vertices) {
            const point = vertex.clone().applyMatrix4(transform);
            corners.push(point); bounds.expandByPoint(point);
          }
        };
        if (object.isInstancedMesh) {
          for (let i=0;i<object.count;i++) {
            const instance = new THREE.Matrix4(); object.getMatrixAt(i,instance);
            collect(instance.premultiply(local));
          }
        } else collect(local);
      });
      world.userData.modelCorners = corners;
      world.userData.modelMatrix = world.matrixWorld.clone();
      world.userData.modelCenter = bounds.getCenter(new THREE.Vector3()).applyMatrix4(world.matrixWorld);
    }
    world.visible = false;
    worlds[index] = world;
    worldStatus[index] = "built";
    if (scene) scene.add(world);
    world.userData.buildDuration = performance.now() - t0;
    if (perfMode) {
      console.log(`[PERF BUILD] World ${index} (${sceneNames[index]}) built in ${world.userData.buildDuration.toFixed(1)}ms`);
    }
  }
  return worlds[index];
}

const yieldTask = () => new Promise(resolve => setTimeout(resolve, 0));
const preparationQueue = [];
let preparing = false;
async function drainPreparationQueue() {
  if (preparing || !webglReady || document.hidden) return;
  preparing = true;
  while (preparationQueue.length && webglReady && !document.hidden) {
    const requested = preparationQueue.findIndex(job => job.index === currentScene);
    if (requested < 0 && performance.now() - Math.max(lastScrollAt,chapterWheel.lastAt) < 200) {
      setTimeout(drainPreparationQueue,220);
      break;
    }
    const job = preparationQueue.splice(requested >= 0 ? requested : 0, 1)[0];
    try { job.resolve(await job.execute()); }
    catch (error) {
      worldStatus[job.index] = "failed";
      console.warn(`Scene ${sceneNames[job.index]} unavailable; content remains accessible.`, error);
      job.resolve(null);
    }
  }
  preparing = false;
}
let prewarmTimer = null;

function prepareWorldAsync(index) {
  if (index < 0 || index >= worldFactories.length) return Promise.resolve(null);
  if (worlds[index]?.userData.ready) return Promise.resolve(worlds[index]);
  if (worldCompilePromises[index]) return worldCompilePromises[index];
  // Even the requested scene is built outside the input handler. The finite,
  // six-world cache reuses each world; preparation is serialized, never fanned out.
  const execute = async () => {
    await yieldTask();
    const world = ensureWorld(index);
    world.visible = false;
    await yieldTask();
    worldStatus[index] = "compiling";
    await compileInBatches(renderer, scene, camera, world, () => {
      const visibilities = worlds.map(w => w?.visible || false);
      worlds.forEach((w, i) => { if (w) w.visible = i === index; });
      return () => worlds.forEach((w, i) => { if (w) w.visible = visibilities[i]; });
    });
    await yieldTask();
    // Compilation does not upload buffers. Warm the actual output pipeline:
    // an offscreen target changes tone-mapping/color-space shader variants.
    // Restore and draw the active world in this same task, before browser paint.
    const warmCamera = camera.clone();
    const state = getCameraTarget(index);
    warmCamera.position.fromArray(state.position);
    warmCamera.lookAt(new THREE.Vector3(...state.look));
    const visible = worlds.map(w => w?.visible || false);
    try {
      worlds.forEach((w, i) => { if (w) w.visible = i === index; });
      drawModel(warmCamera);
    } finally {
      worlds.forEach((w, i) => { if (w) w.visible = visible[i]; });
      drawModel();
    }
    world.userData.ready = true;
    worldStatus[index] = "ready";
    if (index === currentScene) revealWorld(index);
    return world;
  };
  const job = new Promise(resolve => preparationQueue.push({ index, execute, resolve }));
  worldCompilePromises[index] = job;
  setTimeout(drainPreparationQueue, 0);
  return job;
}

function revealWorld(index) {
  if (!webglReady || index !== currentScene || !worlds[index]?.userData.ready) return;
  activeWorld = worlds[index];
  activeWorld.visible = true;
  modelDirty = true;
  const state = getCameraTarget(index);
  cameraStart.fromArray(state.position);
  if (!reduceMotion) cameraStart.add(new THREE.Vector3(.2, .08, .35));
  lookStart.fromArray(state.look);
  cameraTransitionAt = performance.now();
  document.body.dataset.graphicsReady = "true";
  if (reduceMotion) render(performance.now());
}

function startBackgroundPrewarm() {
  clearTimeout(prewarmTimer);
  if (!webglReady || reduceMotion || document.hidden) return;
  // Only the next likely destination and previous scene are prepared. Distant
  // archive jumps keep the CSS centerpiece visible while their model prepares.
  prewarmTimer = setTimeout(() => {
    const next = currentScene + 1;
    const previous = currentScene - 1;
    const run = async () => {
      if (document.hidden || !webglReady) return;
      if (next < worlds.length) await prepareWorldAsync(next);
      if (previous >= 0) await prepareWorldAsync(previous);
    };
    if (window.requestIdleCallback) requestIdleCallback(run, { timeout: 1000 });
    else run();
  }, 120);
}

function initializeThree() {
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: "high-performance"
    });
    renderer.setClearColor(0x050706, 1);
    renderer.autoClear = true;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, coarsePointer ? 1.0 : 1.15));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050706);
    scene.fog = new THREE.FogExp2(0x050706, 0.012);

    const isMobile = window.innerWidth <= 820;
    camera = new THREE.PerspectiveCamera(isMobile ? 64 : 42, 1, 0.1, 120);
    const initialTarget = getCameraTarget(currentScene);
    camera.position.fromArray(initialTarget.position);
    currentLook.fromArray(initialTarget.look);
    camera.lookAt(currentLook);
    cameraStart.copy(camera.position);
    lookStart.copy(currentLook);
    cameraTransitionAt = performance.now() - 280;
    transitField = createTransitField();
    camera.add(transitField);
    scene.add(camera);

    scene.add(new THREE.HemisphereLight(0xcde4d8, 0x091410, 1.35));
    const key = new THREE.DirectionalLight(0xf0f7f3, 4.2);
    key.position.set(8, 11, 12);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x7596ff, 2.4);
    rim.position.set(-9, 3, -8);
    scene.add(rim);
    const warmFill = new THREE.DirectionalLight(0xff946b, 1.8);
    warmFill.position.set(6, -2, -6);
    scene.add(warmFill);
    const accent = new THREE.PointLight(palette.green, 28, 26, 2);
    accent.position.set(1.5, 2.5, 6);
    scene.add(accent);

    window.__observatory = {
      version: "4.7.0",
      buildDate: "2026-10-15",
      worlds,
      worldStatus,
      prepareWorldAsync,
      ensureWorld,
      startBackgroundPrewarm,
      camera,
      targetCamera,
      targetLook,
      currentLook,
      mobileCameraStates,
      cameraStates,
      getModelViewportRect,
      getProjectedModelBounds,
      THREE
    };
    webglReady = true;
    resizeRenderer();
    window.addEventListener("resize", resizeRenderer, { passive: true });
    window.addEventListener("orientationchange", resizeRenderer, { passive: true });
    const modelObserver = new ResizeObserver(() => {
      resizeRenderer();
    });
    modelViews.forEach(view => modelObserver.observe(view));
    document.fonts.ready.then(() => {
      measureModelViews();
      if (webglReady && reduceMotion) render(performance.now());
    });
    canvas.addEventListener("webglcontextlost", event => { event.preventDefault(); webglReady = false; renderer.setAnimationLoop(null); document.body.dataset.graphicsReady = "false"; });
    canvas.addEventListener("webglcontextrestored", () => location.reload());
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        renderer.setAnimationLoop(null);
      } else if (webglReady && !reduceMotion) {
        lastFrameTime = 0;
        renderer.setAnimationLoop(render);
      }
      if (!document.hidden) drainPreparationQueue();
    });
    window.addEventListener("pagehide", event => {
      if (event.persisted) return;
      clearTimeout(prewarmTimer);
      modelObserver.disconnect();
      renderer.setAnimationLoop(null);
      disposeScene(scene);
      renderer.dispose();
      webglReady = false;
    });
    prepareWorldAsync(currentScene).then(() => startBackgroundPrewarm());
    if (!reduceMotion) renderer.setAnimationLoop(render);
  } catch (error) {
    document.body.classList.add("webgl-unavailable");
    console.warn("Interactive scene unavailable; content fallback remains active.", error);
  }
}

function resizeRenderer() {
  if (!renderer || !camera) return;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (canvas.width !== Math.floor(width * renderer.getPixelRatio()) || canvas.height !== Math.floor(height * renderer.getPixelRatio())) {
    renderer.setSize(width, height, false);
  }
  measureModelViews();
  if (webglReady && reduceMotion) render(performance.now());
}

function render(timeMs) {
  if (!webglReady) return;
  // During a scroll, prioritize native compositing over decorative animation.
  if (!reduceMotion && !modelDirty && timeMs - lastScrollAt < 140 && timeMs - lastDrawAt < 28) return;
  lastDrawAt = timeMs;
  modelDirty = false;
  updateModelViewport();
  if (!modelViewport?.width || !modelViewport.height) { lastFrameTime = 0; return; }
  const rawFrameDeltaMs = lastFrameTime ? Math.max(0, timeMs - lastFrameTime) : 16.67;
  const dt = Math.min(rawFrameDeltaMs / 1000, 0.034);
  lastFrameTime = timeMs;
  if (!reduceMotion) animationTime += dt;
  const time = animationTime;

  const state = getCameraTarget(currentScene);
  targetCamera.fromArray(state.position);
  targetLook.fromArray(state.look);

  if (!reduceMotion) {
    targetCamera.x += pointerX * 0.2;
    targetCamera.y += pointerY * 0.14;
  }

  if (reduceMotion) {
    camera.position.copy(targetCamera);
    currentLook.copy(targetLook);
    cameraVelocity.set(0, 0, 0);
    lookVelocity.set(0, 0, 0);
  } else {
    // Travel between spatially distant worlds has a bounded duration. An
    // asymptotic spring previously kept chasing a destination for over a second.
    const progress = THREE.MathUtils.clamp((timeMs - cameraTransitionAt) / 280, 0, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    camera.position.lerpVectors(cameraStart, targetCamera, eased);
    currentLook.lerpVectors(lookStart, targetLook, eased);
  }
  camera.lookAt(currentLook);

  if (transitField) {
    // Keep the model legible during travel rather than covering it with streaks.
    transitField.material.opacity = 0;
  }

  const activeIdx = currentScene;

  // 0: Origin
  if (activeIdx === 0 && worlds[0]) {
    worlds[0].rotation.y = reduceMotion ? 0 : Math.sin(time * .16) * .14;
    worlds[0].rotation.x = Math.sin(time * 0.18) * 0.12;
    worlds[0].userData.rings?.forEach((ring) => {
      ring.rotation.y += reduceMotion ? 0 : ring.userData.speed * dt;
      ring.rotation.z += reduceMotion ? 0 : ring.userData.speed * dt * 0.35;
    });
    if (worlds[0].userData.chamber) worlds[0].userData.chamber.rotation.y = reduceMotion ? 0 : time * 0.035;
  }

  // 1: Aegis
  else if (activeIdx === 1 && worlds[1]) {
    if (worlds[1].userData.coreMesh) worlds[1].userData.coreMesh.rotation.y += reduceMotion ? 0 : 0.6 * dt;
    if (worlds[1].userData.coreBox) worlds[1].userData.coreBox.rotation.y -= reduceMotion ? 0 : 0.36 * dt;
    if (worlds[1].userData.inspectionShell) {
      worlds[1].userData.inspectionShell.rotation.x = reduceMotion ? 0 : time * 0.08;
      worlds[1].userData.inspectionShell.rotation.y = reduceMotion ? 0 : -time * 0.11;
    }
    worlds[1].userData.orbits?.forEach((orbit) => {
      orbit.rotation.z += reduceMotion ? 0 : orbit.userData.speed * dt;
      orbit.rotation.y += reduceMotion ? 0 : orbit.userData.speed * dt * 0.55;
    });

    const sweepAngle = reduceMotion ? 0.65 : time * 0.68;
    if (worlds[1].userData.sweep) worlds[1].userData.sweep.rotation.z = sweepAngle;
    if (worlds[1].userData.sweepSector) worlds[1].userData.sweepSector.rotation.z = sweepAngle;

    worlds[1].userData.bars?.forEach((bar) => {
      const pulse = reduceMotion ? 1 : 0.78 + Math.sin(time * 1.7 + bar.userData.phase) * 0.22;
      bar.scale.y = bar.userData.baseHeight * pulse;
    });
    worlds[1].userData.blips?.forEach((blip) => {
      const pulse = reduceMotion ? 1 : 0.55 + (Math.sin(time * 3.2 + blip.userData.phase) + 1) * 0.42;
      blip.scale.setScalar(pulse);
    });
    worlds[1].userData.codePanels?.forEach((panel) => {
      panel.position.y = panel.userData.baseY + (reduceMotion ? 0 : Math.sin(time * 0.72 + panel.userData.phase) * 0.055);
      if (panel.userData.frame) panel.userData.frame.position.y = panel.position.y;
    });
    worlds[1].userData.scanHeads?.forEach((scanHead) => {
      scanHead.position.y = reduceMotion ? 0 : Math.sin(time * 1.55 + scanHead.userData.phase) * 0.43;
      scanHead.scale.x = reduceMotion ? 0.78 : 0.72 + (Math.sin(time * 2.1 + scanHead.userData.phase) + 1) * 0.16;
    });
    worlds[1].userData.agentCores?.forEach((core, index) => {
      const pulse = reduceMotion ? 1 : 0.82 + (Math.sin(time * 2.35 + index * 0.7) + 1) * 0.16;
      core.scale.setScalar(pulse);
    });
    worlds[1].userData.claimPackets?.forEach((packet) => {
      const progress = (packet.userData.offset + time * 0.18) % 1;
      const pt = getCachedCurvePoint(packet.userData.route, progress);
      if (pt) packet.position.copy(pt);
    });
    worlds[1].userData.evidencePackets?.forEach((packet) => {
      const progress = (packet.userData.offset + time * packet.userData.speed) % 1;
      const pt = getCachedCurvePoint(packet.userData.route, progress);
      if (pt) packet.position.copy(pt);
      packet.rotation.x = time * 1.3;
      packet.rotation.y = time * 1.7;
    });
    worlds[1].userData.verdictBars?.forEach((bar) => {
      const reveal = reduceMotion ? 1 : 0.62 + (Math.sin(time * 1.75 + bar.userData.phase) + 1) * 0.19;
      bar.scale.x = reveal;
    });
    if (worlds[1].userData.verdictSeal) {
      worlds[1].userData.verdictSeal.position.y = -1.58 + (reduceMotion ? 0 : Math.sin(time * 1.2) * 0.08);
      worlds[1].userData.verdictSeal.rotation.y = reduceMotion ? 0 : Math.sin(time * 0.7) * 0.22;
    }
    if (worlds[1].userData.claimDossier) {
      worlds[1].userData.claimDossier.position.y = 0.05 + (reduceMotion ? 0 : Math.sin(time * 0.85) * 0.04);
    }
  }

  // 2: Gridium
  else if (activeIdx === 2 && worlds[2]) {
    worlds[2].userData.panels?.forEach((panel) => {
      panel.position.y = panel.userData.baseY + (reduceMotion ? 0 : Math.sin(time * 0.8 + panel.userData.phase) * 0.08);
    });
    worlds[2].userData.dataParticles?.forEach((packet) => {
      const progress = (packet.userData.offset + time * (packet.userData.speed || 0.065)) % 1;
      if (packet.userData.route) {
        const pt = getCachedCurvePoint(packet.userData.route, progress);
        if (pt) packet.position.copy(pt);
      } else {
        packet.position.set(-3.2 + progress * 6.4, -2.05 + Math.sin(progress * Math.PI) * 0.18, -0.12);
      }
      packet.rotation.x = time * 1.4;
      packet.rotation.y = time * 1.8;
    });
    worlds[2].userData.energyRings?.forEach((ring) => {
      ring.rotation.y += reduceMotion ? 0 : ring.userData.speed * dt;
    });
    worlds[2].userData.nodes?.forEach((node, index) => {
      const pulse = reduceMotion ? 1 : 0.88 + (Math.sin(time * 1.1 + node.userData.phase) + 1) * 0.08;
      node.userData.halo.scale.setScalar(pulse);
      node.position.y = -1.7 + (reduceMotion ? 0 : Math.sin(time * 0.72 + index * 0.38) * 0.025);
    });
    worlds[2].userData.proofLeaves?.forEach((leaf) => {
      leaf.scale.x = reduceMotion ? 1 : 0.7 + (Math.sin(time * 1.65 + leaf.userData.phase) + 1) * 0.15;
    });
    if (worlds[2].userData.poolLiquid) {
      worlds[2].userData.poolLiquid.scale.y = reduceMotion ? 1 : 0.82 + (Math.sin(time * 0.58) + 1) * 0.12;
    }
    worlds[2].rotation.y = reduceMotion ? 0 : Math.sin(time * 0.18) * 0.018;
  }

  // 3: Compressor
  else if (activeIdx === 3 && worlds[3]) {
    worlds[3].userData.rotors?.forEach((rotor, index) => {
      rotor.rotation.z += reduceMotion ? 0 : (0.48 + index * 0.096) * dt;
    });
    worlds[3].userData.instrumentRings?.forEach((ring) => {
      ring.rotation.x += reduceMotion ? 0 : ring.userData.speed * dt;
    });
    worlds[3].rotation.y = Math.sin(time * 0.24) * 0.08;
    worlds[3].userData.flowParticles?.forEach((particle) => {
      const progress = (particle.userData.offset + time * particle.userData.speed) % 1;
      const spiral = particle.userData.phase + progress * Math.PI * 7;
      const compression = 1 - progress * 0.34;
      particle.position.set(
        -4.45 + progress * 8.9,
        Math.cos(spiral) * particle.userData.radius * compression,
        Math.sin(spiral) * particle.userData.radius * compression
      );
    });
  }

  // 4: TopoFlow
  else if (activeIdx === 4 && worlds[4]) {
    worlds[4].rotation.y = reduceMotion ? 0 : Math.sin(time * .18) * .14;
    worlds[4].rotation.x = Math.sin(time * 0.2) * 0.08;
    if (worlds[4].userData.flowCurve && worlds[4].userData.flowParticles) {
      worlds[4].userData.flowParticles.forEach((particle) => {
        const progress = (particle.userData.offset + time * particle.userData.speed) % 1;
        const pt = getCachedCurvePoint(worlds[4].userData.flowCurve, progress);
        if (pt) particle.position.copy(pt);
        const pulse = 0.7 + Math.sin(progress * Math.PI) * 0.8;
        particle.scale.setScalar(pulse);
      });
    }
  }

  // 5: Profile
  else if (activeIdx === 5 && worlds[5]) {
    worlds[5].rotation.y += reduceMotion ? 0 : 0.084 * dt;
    worlds[5].userData.rings?.forEach((ring) => {
      ring.rotation.y += reduceMotion ? 0 : ring.userData.speed * dt;
      ring.rotation.z += reduceMotion ? 0 : ring.userData.speed * dt * 0.22;
    });
    worlds[5].userData.modules?.forEach((module) => {
      module.position.x = module.userData.baseX + (reduceMotion ? 0 : Math.sin(time * 0.42 + module.userData.phase) * 0.08);
    });
  }

  if (activeWorld && !reduceMotion) {
    activeWorld.rotation.z += (pointerX * 0.04 - activeWorld.rotation.z) * (1 - Math.exp(-8 * dt));
    const baseScale = activeWorld.userData.baseScale;
    const transitionProgress = THREE.MathUtils.clamp((performance.now() - lastSceneChange) / 240, 0, 1);
    const eased = 1 - Math.pow(1 - transitionProgress, 3);
    activeWorld.scale.copy(baseScale).multiplyScalar(0.93 + eased * 0.07);
  }

  drawModel();
  renderedFrames++;
  if (!document.hidden && !reduceMotion) {
    recordFrameTime(rawFrameDeltaMs, timeMs - lastScrollAt >= 140);
  }
  updatePerfHud();
}

function setScene(index, options = {}) {
  if (!Number.isFinite(Number(index))) return;
  const next = Math.max(0, Math.min(sceneNames.length - 1, Number(index)));
  const view = modelViews[next];
  if (view && canvas.parentElement !== view) {
    view.append(canvas);
    if (renderer) resizeRenderer();
  }
  modelDirty = true;
  if (!options.observed) {
    chapterWheel.reset();
    // Explicit navigation jumps immediately. Ordinary browsing stays native.
    window.scrollTo({ top: panels[next].offsetTop, behavior: "instant" });
  }
  if (next === currentScene && !options.force) {
    if (options.focus) focusSceneHeading(next);
    return;
  }
  if (camera) {
    const destination = getCameraTarget(next);
    cameraStart.fromArray(destination.position);
    cameraStart.x += 0.35;
    cameraStart.z += 0.55;
    lookStart.fromArray(destination.look);
  }
  cameraTransitionAt = performance.now();
  currentScene = next;
  activeWorld = webglReady && worlds[currentScene]?.userData.ready ? worlds[currentScene] : null;
  document.body.dataset.graphicsReady = String(Boolean(activeWorld));
  if (webglReady && !activeWorld) prepareWorldAsync(currentScene);
  if (activeWorld?.userData.baseScale) {
    activeWorld.scale.copy(activeWorld.userData.baseScale);
    if (!reduceMotion) activeWorld.scale.multiplyScalar(0.93);
  }
  lastSceneChange = performance.now();
  document.body.dataset.currentScene = String(currentScene);
  worlds.forEach((world, worldIndex) => {
    if (world) world.visible = worldIndex === currentScene && Boolean(world.userData.ready);
  });

  if (perfMode && renderer) {
    const info = renderer.info;
    console.log(`[PERF SCENE] Switched to ${sceneNames[currentScene]} | Calls: ${info.render.calls} | Tris: ${(info.render.triangles / 1000).toFixed(1)}k | Geometries: ${info.memory.geometries} | Textures: ${info.memory.textures} | DPR: ${renderer.getPixelRatio().toFixed(2)}`);
  }

  panels.forEach((panel, panelIndex) => {
    const active = panelIndex === currentScene;
    panel.classList.toggle("is-active", active);
    panel.removeAttribute("aria-hidden");
    panel.inert = false;
  });

  railButtons.forEach((button) => {
    const active = Number(button.dataset.sceneJump) === currentScene;
    button.classList.toggle("is-current", active);
    if (active) button.setAttribute("aria-current", "step");
    else button.removeAttribute("aria-current");
  });

  if (sceneAnnouncer && !options.force) sceneAnnouncer.textContent = `${sceneNames[currentScene]} scene selected`;
  if (options.focus) focusSceneHeading(currentScene);

  const flow = document.querySelector(".scene-flow");
  if (flow) {
    flow.hidden = currentScene === 0;
    flow.querySelector("[data-scene-position]").textContent = `${String(currentScene + 1).padStart(2, "0")} / 06`;
    const nextButton = flow.querySelector("[data-next-scene]");
    nextButton.querySelector("span").textContent = currentScene === 5 ? "Back to introduction" : `Next: ${sceneNames[currentScene + 1]}`;
    if (currentScene === 5) nextButton.dataset.sceneJump = "0";
    else nextButton.removeAttribute("data-scene-jump");
  }

  if (!options.skipHistory) {
    history[options.observed ? "replaceState" : "pushState"](null, "", `#${sceneHashes[currentScene]}`);
  }
  startBackgroundPrewarm();
  if ((reduceMotion) && webglReady) render(performance.now());
}

function focusSceneHeading(index) {
  const heading = panels[index]?.querySelector("h1, h2");
  if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
}

let scrollFrame = 0;
function syncSceneToScroll() {
  scrollFrame = 0;
  if (document.querySelector("dialog[open]")) return;
  const bounded = chapterWheel.constrain(scrollY, performance.now());
  if (Math.abs(bounded - scrollY) > .5) window.scrollTo({ top: bounded, behavior: "instant" });
  const readingLine = window.scrollY + window.innerHeight * 0.4;
  const total = document.documentElement.scrollHeight - window.innerHeight;
  if (readingProgress) readingProgress.style.transform = `scaleX(${total > 0 ? window.scrollY / total : 0})`;
  let next = 0;
  panels.forEach((panel, index) => { if (panel.offsetTop <= readingLine) next = index; });
  if (next !== currentScene) setScene(next, { observed: true });
  else if (reduceMotion && webglReady) render(performance.now());
}
window.addEventListener("scroll", () => {
  lastScrollAt = performance.now();
  if (!scrollFrame) scrollFrame = requestAnimationFrame(syncSceneToScroll);
}, { passive: true });
window.addEventListener("resize", () => {
  chapterWheel.reset();
  measureChapters();
  if (!scrollFrame) scrollFrame = requestAnimationFrame(syncSceneToScroll);
}, { passive: true });
history.scrollRestoration = "manual";

function stepScene(direction, options = {}) {
  const target = currentScene + direction;
  if (target >= 0 && target < sceneNames.length) setScene(target, options);
}

// Global Event Delegation for all interactive action attributes
document.addEventListener("click", (event) => {
  const jumpBtn = event.target.closest("[data-scene-jump]");
  if (jumpBtn) {
    event.preventDefault();
    setScene(Number(jumpBtn.dataset.sceneJump), { focus: event.detail === 0 });
    return;
  }

  const nextBtn = event.target.closest("[data-next-scene]");
  if (nextBtn) {
    event.preventDefault();
    stepScene(1, { focus: event.detail === 0 });
    return;
  }

  const prevBtn = event.target.closest("[data-prev-scene]");
  if (prevBtn) {
    event.preventDefault();
    stepScene(-1, { focus: event.detail === 0 });
    return;
  }

  const openEvBtn = event.target.closest("[data-open-evidence]");
  if (openEvBtn) {
    event.preventDefault();
    const key = openEvBtn.dataset.openEvidence;
    const template = document.getElementById(`evidence-${key}`);
    const metadata = evidenceMetadata[key];
    if (template && metadata) {
      evidenceDialogTitle.textContent = metadata.title;
      evidenceDialogIndex.textContent = metadata.index;
      evidenceDialogBody.replaceChildren(template.content.cloneNode(true));
      openDialog(evidenceDialog);
    }
    return;
  }

  const closeEvBtn = event.target.closest("[data-close-evidence]");
  if (closeEvBtn) {
    event.preventDefault();
    closeDialog(evidenceDialog);
    return;
  }

  const openArcBtn = event.target.closest("[data-open-archive]");
  if (openArcBtn) {
    event.preventDefault();
    openDialog(archiveDialog);
    return;
  }

  const closeArcBtn = event.target.closest("[data-close-archive]");
  if (closeArcBtn) {
    event.preventDefault();
    closeDialog(archiveDialog);
    return;
  }
});

// Keep normal reading movement; only clamp a wheel event that would carry the
// same swipe past its one-chapter range. No scene construction runs here.
window.addEventListener("wheel", event => {
  if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.shiftKey ||
      Math.abs(event.deltaX) > Math.abs(event.deltaY) || !event.deltaY ||
      document.querySelector("dialog[open]")) { chapterWheel.reset(); return; }
  let element = event.target instanceof Element ? event.target : null;
  while (element && element !== document.body) {
    if (element.scrollHeight > element.clientHeight + 2 && /auto|scroll/.test(getComputedStyle(element).overflowY)) { chapterWheel.reset(); return; }
    element = element.parentElement;
  }
  const result = chapterWheel.feed(wheelPixels(event, innerHeight), performance.now(), scrollY,
    chapterStops, innerHeight, documentScrollMaximum);
  if ((result.limited || result.reversed) && event.cancelable) {
    event.preventDefault();
    // An instant clamp also cancels any browser wheel animation still queued
    // from the tail. Ordinary in-range input keeps its native browser action.
    window.scrollTo({ top: result.top, behavior: "instant" });
  }
}, { passive: false });
window.addEventListener("pointerdown", () => chapterWheel.reset(), { passive: true });
window.addEventListener("touchstart", () => chapterWheel.reset(), { passive: true });

// Touch panning, vertical keys and scrollbar navigation remain native.
window.addEventListener("keydown", (event) => {
  chapterWheel.reset();
  if (document.querySelector("dialog[open]") || event.repeat || event.target.closest?.("input, textarea, select, [contenteditable='true']")) return;
  if (event.key === "ArrowRight") { event.preventDefault(); stepScene(1, { focus: true }); }
  if (event.key === "ArrowLeft") { event.preventDefault(); stepScene(-1, { focus: true }); }
  if (event.key === "Home") { event.preventDefault(); setScene(0, { focus: true }); }
  if (event.key === "End") { event.preventDefault(); setScene(sceneNames.length - 1, { focus: true }); }

});

// Subtle parallax is automatic; the canvas never captures pointer or wheel input.
window.addEventListener("pointermove", event => {
  if (event.pointerType === "touch" || reduceMotion) return;
  pointerX = (event.clientX / Math.max(window.innerWidth, 1) - 0.5) * 2;
  pointerY = -(event.clientY / Math.max(window.innerHeight, 1) - 0.5) * 2;
}, { passive: true });

document.addEventListener("click", async event => {
  const button = event.target.closest("[data-copy-email]");
  if (!button) return;
  const status = document.querySelector("[data-copy-status]");
  try {
    await navigator.clipboard.writeText("shaunakrane914@gmail.com");
    status.textContent = "Email copied.";
  } catch {
    status.textContent = "Use the email link to get in touch.";
    document.querySelector(".contact-email").focus({ preventScroll: true });
  }
});

window.addEventListener("hashchange", () => {
  const hash = window.location.hash.slice(1);
  const index = hash ? sceneHashes.indexOf(hash) : 0;
  if (index >= 0) setScene(index, { skipHistory: true });
});

let lastFocusedElement = null;

function openDialog(dialog) {
  chapterWheel.reset();
  if (!dialog) return;
  lastFocusedElement = document.activeElement;
  document.body.classList.add("dialog-open");
  if (dialog === archiveDialog) {
    const lazyImages = dialog.querySelectorAll("img[data-src]");
    lazyImages.forEach((img) => {
      img.src = img.dataset.src;
      img.removeAttribute("data-src");
    });
  }
  dialog.showModal();
}

function closeDialog(dialog) {
  chapterWheel.reset();
  if (!dialog?.open) return;
  dialog.close();
  document.body.classList.remove("dialog-open");
  if (lastFocusedElement && typeof lastFocusedElement.focus === "function") {
    lastFocusedElement.focus();
  }
}

const evidenceDialog = document.getElementById("evidence-dialog");
const evidenceDialogTitle = document.getElementById("evidence-dialog-title");
const evidenceDialogIndex = document.getElementById("evidence-dialog-index");
const evidenceDialogBody = document.getElementById("evidence-dialog-body");
const archiveDialog = document.getElementById("archive-dialog");

const evidenceMetadata = {
  aegis: { title: "Aegis signal contract", index: "FIELD REPORT / 01" },
  gridium: { title: "Gridium microgrid contract", index: "FIELD REPORT / 02" },
  compressor: { title: "Compressor evidence", index: "FIELD REPORT / 03" },
  topoflow: { title: "TopoFlow evidence", index: "FIELD REPORT / 04" },
  studio: { title: "Engineering build", index: "FIELD REPORT / 05" }
};

[evidenceDialog, archiveDialog].forEach((dialog) => {
  if (!dialog) return;
  dialog.addEventListener("click", (event) => {
    const rect = dialog.getBoundingClientRect();
    const isInDialog = (
      rect.top <= event.clientY &&
      event.clientY <= rect.top + rect.height &&
      rect.left <= event.clientX &&
      event.clientX <= rect.left + rect.width
    );
    if (!isInDialog || event.target === dialog) {
      closeDialog(dialog);
    }
  });
  dialog.addEventListener("close", () => document.body.classList.remove("dialog-open"));
});

// Content and controls are usable before WebGL context creation or scene builds.
measureChapters();
setScene(currentScene, { force: true, skipHistory: true });
requestAnimationFrame(() => requestAnimationFrame(initializeThree));
