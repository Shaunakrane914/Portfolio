import * as THREE from "./assets/vendor/three.module.min.js";

const canvas = document.getElementById("observatory-canvas");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
const panels = Array.from(document.querySelectorAll("[data-scene-panel]"));
const railButtons = Array.from(document.querySelectorAll("[data-scene-jump]"));
const sceneAnnouncer = document.getElementById("scene-announcer");
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
let lastFrameTime = performance.now();
let transitionTimer = null;
let pointerX = 0;
let pointerY = 0;
let dragStart = null;
let webglReady = false;

const cameraStates = [
  { position: [0, 1.8, 12], look: [2.7, 0, 0] },
  { position: [-14, 1.6, 10.5], look: [-14, 0, 0] },
  { position: [-12, 10.4, 1.5], look: [-12, 8, -10] },
  { position: [14, 1.4, 11], look: [14, 0, 0] },
  { position: [0, 1.2, -4.5], look: [0, 0, -16] },
  { position: [0, 10.5, 12], look: [0, 8, 0] }
];

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

function lineMaterial(color, opacity = 1) {
  return new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity });
}

function meshMaterial(color, options = {}) {
  return new THREE.MeshStandardMaterial({
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
  });
}

function physicalMaterial(color, options = {}) {
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness: options.roughness ?? 0.3,
    metalness: options.metalness ?? 0.62,
    clearcoat: options.clearcoat ?? 0.38,
    clearcoatRoughness: options.clearcoatRoughness ?? 0.22,
    transmission: options.transmission ?? 0,
    thickness: options.thickness ?? 0,
    ior: options.ior ?? 1.45,
    transparent: options.opacity !== undefined && options.opacity < 1,
    opacity: options.opacity ?? 1,
    side: options.side ?? THREE.FrontSide,
    depthWrite: options.depthWrite ?? true,
    emissive: options.emissive ?? 0x000000,
    emissiveIntensity: options.emissiveIntensity ?? 0
  });
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

function addWorldLight(group, color, position, intensity = 18, distance = 12) {
  const light = new THREE.PointLight(color, intensity, distance, 2);
  light.position.fromArray(position);
  group.add(light);
  const glow = createGlowSprite(color, 0.9, 0.26);
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

function springVector(current, target, velocity, dt, stiffness = 56, damping = 11) {
  const displacement = target.clone().sub(current);
  velocity.addScaledVector(displacement, stiffness * dt);
  velocity.multiplyScalar(Math.exp(-damping * dt));
  current.addScaledVector(velocity, dt);
}

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
  textureCanvas.width = 1024;
  textureCanvas.height = 620;
  const context = textureCanvas.getContext("2d");
  context.fillStyle = "#070a08";
  context.fillRect(0, 0, textureCanvas.width, textureCanvas.height);
  context.fillStyle = "#0d1511";
  context.fillRect(0, 0, textureCanvas.width, 82);
  context.fillStyle = accent;
  context.fillRect(0, 80, textureCanvas.width, 3);
  context.font = "500 24px monospace";
  context.fillStyle = "#b9c5bf";
  context.fillText(title.toUpperCase(), 42, 51);
  context.font = "24px monospace";
  lines.forEach((line, index) => {
    const y = 140 + index * 57;
    context.fillStyle = "#44514b";
    context.fillText(String(index + 1).padStart(2, "0"), 42, y);
    context.fillStyle = line.accent ? accent : "#d5dfda";
    context.fillText(line.text, 98, y);
  });
  const texture = new THREE.CanvasTexture(textureCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
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

    for (let i = 0; i < layer.nodes; i += 1) {
      const angle = (i / layer.nodes) * Math.PI * 2 + layerIndex * 0.31;
      const node = new THREE.Mesh(new THREE.SphereGeometry(0.085, 12, 12), nodeMaterial);
      node.position.set(
        Math.cos(angle) * layer.radius,
        layer.y,
        Math.sin(angle) * layer.radius * 0.42
      );
      group.add(node);
      if (i % 3 === 0) {
        verticals.push(node.position.x, node.position.y, node.position.z, 0, 0, 0);
      }
    }
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
  group.position.x = 3.5;
  group.scale.setScalar(0.94);
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
    for (let blade = 0; blade < bladeCount; blade += 1) {
      const angle = (blade / bladeCount) * Math.PI * 2;
      const mesh = new THREE.Mesh(bladeGeometry, bladeMaterial);
      mesh.scale.setScalar(0.7 + stage * 0.026);
      mesh.position.set(Math.cos(angle) * 0.76, Math.sin(angle) * 0.76, 0);
      mesh.rotation.z = angle - 0.24 + stage * 0.018;
      rotor.add(mesh);
    }

    const sensorGeometry = new THREE.SphereGeometry(0.055, 8, 8);
    const sensorMaterial = physicalMaterial(stage === 4 ? palette.yellow : palette.blue, {
      roughness: 0.22,
      metalness: 0.36,
      emissive: stage === 4 ? palette.yellow : palette.blueDim,
      emissiveIntensity: 0.72
    });
    for (let s = 0; s < 6; s += 1) {
      const angle = (s / 6) * Math.PI * 2;
      const sensor = new THREE.Mesh(sensorGeometry, sensorMaterial);
      sensor.position.set(Math.cos(angle) * 1.72, Math.sin(angle) * 1.72, 0.18);
      rotor.add(sensor);
    }

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
  group.position.set(4.35, 0.1, -16.25);
  group.scale.setScalar(0.82);
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
  const poreMaterial = physicalMaterial(0x335d7d, {
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
  const matrixMaterial = physicalMaterial(0x202a2b, {
    roughness: 0.78,
    metalness: 0.14,
    clearcoat: 0.08,
    opacity: 0.52,
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

function createProfileWorld() {
  const group = new THREE.Group();
  group.position.set(2.65, 8, -0.15);
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

    const module = new THREE.Mesh(
      new THREE.BoxGeometry(1.45, 0.34, 0.12),
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

const worlds = [];

function initializeThree() {
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      preserveDrawingBuffer: true,
      powerPreference: "high-performance"
    });
    renderer.setClearColor(0x020403, 1);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, coarsePointer ? 1.4 : 1.85));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020403);
    scene.fog = new THREE.FogExp2(0x020403, 0.021);

    camera = new THREE.PerspectiveCamera(42, 1, 0.1, 120);
    camera.position.fromArray(cameraStates[currentScene].position);
    currentLook.fromArray(cameraStates[currentScene].look);
    camera.lookAt(currentLook);
    transitField = createTransitField();
    camera.add(transitField);
    scene.add(camera);

    scene.add(new THREE.HemisphereLight(0xb9d8ca, 0x07100c, 1.05));
    const key = new THREE.DirectionalLight(0xe9f4ef, 3.2);
    key.position.set(8, 11, 12);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x6b8cff, 1.65);
    rim.position.set(-9, 3, -8);
    scene.add(rim);
    const warmFill = new THREE.DirectionalLight(0xff8a5f, 1.1);
    warmFill.position.set(6, -2, -6);
    scene.add(warmFill);
    const accent = new THREE.PointLight(palette.green, 22, 20, 2);
    accent.position.set(1.5, 2.5, 6);
    scene.add(accent);

    scene.add(createAmbientField());
    worlds.push(
      createOriginWorld(),
      createAegisWorld(),
      createGridiumWorld(),
      createCompressorWorld(),
      createTopoWorld(),
      createProfileWorld()
    );
    worlds.forEach((world) => {
      world.userData.baseScale = world.scale.clone();
      scene.add(world);
    });
    activeWorld = worlds[currentScene];
    webglReady = true;
    resizeRenderer();
    renderer.setAnimationLoop(render);
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
    camera.aspect = width / Math.max(height, 1);
    camera.updateProjectionMatrix();
  }
}

function render(timeMs) {
  if (!webglReady) return;
  const time = timeMs * 0.001;
  const dt = Math.min((timeMs - lastFrameTime) / 1000, 0.034);
  lastFrameTime = timeMs;
  resizeRenderer();

  const state = cameraStates[currentScene];
  targetCamera.fromArray(state.position);
  targetLook.fromArray(state.look);

  if (!reduceMotion) {
    targetCamera.x += pointerX * 0.42;
    targetCamera.y += pointerY * 0.28;
  }

  if (reduceMotion) {
    camera.position.copy(targetCamera);
    currentLook.copy(targetLook);
    cameraVelocity.set(0, 0, 0);
    lookVelocity.set(0, 0, 0);
  } else {
    springVector(camera.position, targetCamera, cameraVelocity, dt, 58, 11.5);
    springVector(currentLook, targetLook, lookVelocity, dt, 48, 10.5);
  }
  camera.lookAt(currentLook);

  if (transitField) {
    const motionEnergy = THREE.MathUtils.clamp(cameraVelocity.length() / 10, 0, 1);
    transitField.material.opacity = reduceMotion ? 0 : motionEnergy * 0.38;
    transitField.scale.z = 0.7 + motionEnergy * 3.8;
  }

  // 0: Origin
  worlds[0].rotation.y += reduceMotion ? 0 : 0.0012;
  worlds[0].rotation.x = Math.sin(time * 0.18) * 0.12;
  worlds[0].userData.rings?.forEach((ring) => {
    ring.rotation.y += reduceMotion ? 0 : ring.userData.speed * dt;
    ring.rotation.z += reduceMotion ? 0 : ring.userData.speed * dt * 0.35;
  });
  if (worlds[0].userData.chamber) worlds[0].userData.chamber.rotation.y = reduceMotion ? 0 : time * 0.035;

  // 1: Aegis
  if (worlds[1].userData.coreMesh) worlds[1].userData.coreMesh.rotation.y += reduceMotion ? 0 : 0.01;
  if (worlds[1].userData.coreBox) worlds[1].userData.coreBox.rotation.y -= reduceMotion ? 0 : 0.006;
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

  worlds[1].userData.bars.forEach((bar) => {
    const pulse = reduceMotion ? 1 : 0.78 + Math.sin(time * 1.7 + bar.userData.phase) * 0.22;
    bar.scale.y = bar.userData.baseHeight * pulse;
  });
  worlds[1].userData.blips.forEach((blip) => {
    const pulse = reduceMotion ? 1 : 0.55 + (Math.sin(time * 3.2 + blip.userData.phase) + 1) * 0.42;
    blip.scale.setScalar(pulse);
  });
  worlds[1].userData.codePanels?.forEach((panel) => {
    panel.position.y = panel.userData.baseY + (reduceMotion ? 0 : Math.sin(time * 0.72 + panel.userData.phase) * 0.055);
    if (panel.userData.frame) panel.userData.frame.position.y = panel.position.y;
  });

  // 2: Gridium
  worlds[2].userData.panels.forEach((panel) => {
    panel.position.y = panel.userData.baseY + (reduceMotion ? 0 : Math.sin(time * 0.8 + panel.userData.phase) * 0.08);
  });
  worlds[2].userData.dataParticles.forEach((packet) => {
    const progress = (packet.userData.offset + time * 0.065) % 1;
    packet.position.set(-3.2 + progress * 6.4, -2.05 + Math.sin(progress * Math.PI) * 0.18, -0.12);
    packet.rotation.x = time * 1.4;
    packet.rotation.y = time * 1.8;
  });
  worlds[2].userData.energyRings?.forEach((ring) => {
    ring.rotation.y += reduceMotion ? 0 : ring.userData.speed * dt;
  });
  worlds[2].rotation.y = reduceMotion ? 0 : Math.sin(time * 0.22) * 0.035;

  // 3: Compressor
  worlds[3].userData.rotors.forEach((rotor, index) => {
    rotor.rotation.z += reduceMotion ? 0 : 0.008 + index * 0.0016;
  });
  worlds[3].userData.instrumentRings?.forEach((ring) => {
    ring.rotation.x += reduceMotion ? 0 : ring.userData.speed * dt;
  });
  worlds[3].rotation.y = Math.sin(time * 0.24) * 0.08;
  worlds[3].userData.flowParticles.forEach((particle) => {
    const progress = (particle.userData.offset + time * particle.userData.speed) % 1;
    const spiral = particle.userData.phase + progress * Math.PI * 7;
    const compression = 1 - progress * 0.34;
    particle.position.set(
      -4.45 + progress * 8.9,
      Math.cos(spiral) * particle.userData.radius * compression,
      Math.sin(spiral) * particle.userData.radius * compression
    );
  });

  // 4: TopoFlow
  worlds[4].rotation.y += reduceMotion ? 0 : 0.0017;
  worlds[4].rotation.x = Math.sin(time * 0.2) * 0.08;
  if (worlds[4].userData.flowCurve) {
    worlds[4].userData.flowParticles.forEach((particle) => {
      const progress = (particle.userData.offset + time * particle.userData.speed) % 1;
      particle.position.copy(worlds[4].userData.flowCurve.getPointAt(progress));
      const pulse = 0.7 + Math.sin(progress * Math.PI) * 0.8;
      particle.scale.setScalar(pulse);
    });
  }

  // 5: Profile
  worlds[5].rotation.y += reduceMotion ? 0 : 0.0014;
  worlds[5].userData.rings?.forEach((ring) => {
    ring.rotation.y += reduceMotion ? 0 : ring.userData.speed * dt;
    ring.rotation.z += reduceMotion ? 0 : ring.userData.speed * dt * 0.22;
  });
  worlds[5].userData.modules?.forEach((module) => {
    module.position.x = module.userData.baseX + (reduceMotion ? 0 : Math.sin(time * 0.42 + module.userData.phase) * 0.08);
  });

  if (activeWorld && !reduceMotion) {
    activeWorld.rotation.z += (pointerX * 0.04 - activeWorld.rotation.z) * 0.025;
    const baseScale = activeWorld.userData.baseScale;
    const transitionProgress = THREE.MathUtils.clamp((performance.now() - lastSceneChange) / 620, 0, 1);
    const eased = 1 - Math.pow(1 - transitionProgress, 3);
    activeWorld.scale.copy(baseScale).multiplyScalar(0.93 + eased * 0.07);
  }

  renderer.render(scene, camera);
}

function setScene(index, options = {}) {
  const next = Math.max(0, Math.min(sceneNames.length - 1, Number(index)));
  if (next === currentScene && !options.force) return;
  const previousScene = currentScene;
  currentScene = next;
  activeWorld = worlds[currentScene] || null;
  if (activeWorld?.userData.baseScale) {
    activeWorld.scale.copy(activeWorld.userData.baseScale);
    if (!reduceMotion) activeWorld.scale.multiplyScalar(0.93);
  }
  lastSceneChange = performance.now();
  document.body.dataset.currentScene = String(currentScene);
  worlds.forEach((world, worldIndex) => {
    world.visible = worldIndex === currentScene;
  });

  if (!options.force && !reduceMotion) {
    const direction = Math.sign(currentScene - previousScene) || 1;
    cameraVelocity.y += direction * 1.9;
    cameraVelocity.x += direction * 0.7;
    document.body.classList.remove("is-scene-transitioning");
    void document.body.offsetWidth;
    document.body.classList.add("is-scene-transitioning");
    window.clearTimeout(transitionTimer);
    transitionTimer = window.setTimeout(() => document.body.classList.remove("is-scene-transitioning"), 520);
  }

  panels.forEach((panel, panelIndex) => {
    const active = panelIndex === currentScene;
    panel.classList.toggle("is-active", active);
    panel.setAttribute("aria-hidden", String(!active));
  });

  railButtons.forEach((button) => {
    const active = Number(button.dataset.sceneJump) === currentScene;
    button.classList.toggle("is-current", active);
    if (active) button.setAttribute("aria-current", "step");
    else button.removeAttribute("aria-current");
  });

  if (sceneAnnouncer && !options.force) sceneAnnouncer.textContent = `${sceneNames[currentScene]} scene selected`;

  if (!options.skipHistory) {
    history.replaceState(null, "", `#${sceneHashes[currentScene]}`);
  }
}

function stepScene(direction) {
  const target = currentScene + direction;
  if (target >= 0 && target < sceneNames.length) {
    setScene(target);
  }
}

// Global Event Delegation for all interactive action attributes
document.addEventListener("click", (event) => {
  const jumpBtn = event.target.closest("[data-scene-jump]");
  if (jumpBtn) {
    event.preventDefault();
    setScene(Number(jumpBtn.dataset.sceneJump));
    return;
  }

  const nextBtn = event.target.closest("[data-next-scene]");
  if (nextBtn) {
    event.preventDefault();
    stepScene(1);
    return;
  }

  const prevBtn = event.target.closest("[data-prev-scene]");
  if (prevBtn) {
    event.preventDefault();
    stepScene(-1);
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

let wheelAccumulator = 0;
window.addEventListener("wheel", (event) => {
  if (document.querySelector("dialog[open]")) return;
  const now = performance.now();
  if (now - lastSceneChange < 380) return;
  wheelAccumulator += event.deltaY;
  if (Math.abs(wheelAccumulator) > 35) {
    const dir = wheelAccumulator > 0 ? 1 : -1;
    wheelAccumulator = 0;
    stepScene(dir);
  }
}, { passive: true });

window.addEventListener("keydown", (event) => {
  if (document.querySelector("dialog[open]")) return;
  if (["ArrowDown", "ArrowRight", "PageDown"].includes(event.key)) {
    event.preventDefault();
    stepScene(1);
  }
  if (["ArrowUp", "ArrowLeft", "PageUp"].includes(event.key)) {
    event.preventDefault();
    stepScene(-1);
  }
  if (event.key === "Home") setScene(0);
  if (event.key === "End") setScene(sceneNames.length - 1);
});

canvas.addEventListener("pointerdown", (event) => {
  dragStart = {
    startX: event.clientX,
    startY: event.clientY,
    lastX: event.clientX,
    lastY: event.clientY,
    at: performance.now()
  };
  canvas.setPointerCapture?.(event.pointerId);
});

canvas.addEventListener("pointermove", (event) => {
  pointerX = (event.clientX / Math.max(window.innerWidth, 1) - 0.5) * 2;
  pointerY = -(event.clientY / Math.max(window.innerHeight, 1) - 0.5) * 2;
  if (!dragStart || !activeWorld || reduceMotion) return;
  const dx = (event.clientX - dragStart.lastX) * 0.0025;
  const dy = (event.clientY - dragStart.lastY) * 0.0018;
  activeWorld.rotation.y += dx;
  activeWorld.rotation.x += dy;
  dragStart.lastX = event.clientX;
  dragStart.lastY = event.clientY;
});

canvas.addEventListener("pointerup", (event) => {
  if (!dragStart) return;
  const dx = event.clientX - dragStart.startX;
  const dy = event.clientY - dragStart.startY;
  const elapsed = performance.now() - dragStart.at;
  if (coarsePointer && elapsed < 650 && Math.abs(dx) > 36 && Math.abs(dx) > Math.abs(dy) * 1.25) {
    stepScene(dx < 0 ? 1 : -1);
  }
  dragStart = null;
});

canvas.addEventListener("pointercancel", () => {
  dragStart = null;
});

window.addEventListener("resize", resizeRenderer);
window.addEventListener("hashchange", () => {
  const index = sceneHashes.indexOf(window.location.hash.slice(1));
  if (index >= 0) setScene(index, { skipHistory: true });
});

let lastFocusedElement = null;

function openDialog(dialog) {
  if (!dialog) return;
  lastFocusedElement = document.activeElement;
  document.body.classList.add("dialog-open");
  dialog.showModal();
}

function closeDialog(dialog) {
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

initializeThree();
setScene(currentScene, { force: true, skipHistory: true });
