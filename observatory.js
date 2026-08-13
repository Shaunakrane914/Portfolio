import * as THREE from "./assets/vendor/three.module.min.js";

const canvas = document.getElementById("observatory-canvas");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
const panels = Array.from(document.querySelectorAll("[data-scene-panel]"));
const railButtons = Array.from(document.querySelectorAll("[data-scene-jump]"));
const telemetryScene = document.getElementById("telemetry-scene");
const telemetryCoordinates = document.getElementById("telemetry-coordinates");
const telemetryFps = document.getElementById("telemetry-fps");
const sceneAnnouncer = document.getElementById("scene-announcer");
const sceneNames = ["ORIGIN", "COMPRESSOR", "TOPOFLOW", "AEGIS", "STUDIO", "PROFILE"];
const sceneHashes = ["origin", "compressor", "topoflow", "aegis", "studio", "profile"];

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
let frameCount = 0;
let fpsStartedAt = performance.now();
let webglReady = false;

const cameraStates = [
  { position: [0, 1.8, 12], look: [0, 0, 0] },
  { position: [14, 1.4, 11], look: [14, 0, 0] },
  { position: [0, 1.2, -4.5], look: [0, 0, -16] },
  { position: [-14, 1.6, 10.5], look: [-14, 0, 0] },
  { position: [-12, 10.4, 1.5], look: [-12, 8, -10] },
  { position: [0, 10.5, 12], look: [0, 8, 0] }
];

const palette = {
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
  for (let i = 0; i < 520; i += 1) {
    dust.push(
      (random() - 0.5) * 54,
      (random() - 0.5) * 28,
      (random() - 0.5) * 54
    );
  }
  group.add(pointsFromArray(dust, palette.white, 0.025, 0.22));

  const floor = new THREE.GridHelper(72, 72, palette.faint, palette.faint);
  floor.position.y = -4.4;
  floor.material.transparent = true;
  floor.material.opacity = 0.16;
  group.add(floor);
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
  return group;
}

function createCompressorWorld() {
  const group = new THREE.Group();
  group.position.set(14, 0, 0);
  group.rotation.x = -0.16;
  group.userData.rotors = [];
  group.userData.flowParticles = [];

  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.18, 8.4, 32),
    meshMaterial(palette.white, { roughness: 0.35, metalness: 0.75 })
  );
  shaft.rotation.z = Math.PI / 2;
  group.add(shaft);

  const casing = new THREE.Mesh(
    new THREE.CylinderGeometry(2.08, 2.08, 9.1, 72, 1, true),
    meshMaterial(palette.greenDim, {
      roughness: 0.18,
      metalness: 0.52,
      opacity: 0.1,
      side: THREE.DoubleSide,
      depthWrite: false,
      emissive: palette.greenDim,
      emissiveIntensity: 0.2
    })
  );
  casing.rotation.z = Math.PI / 2;
  group.add(casing);

  [-4.55, 4.55].forEach((x, index) => {
    const flange = new THREE.Mesh(
      new THREE.TorusGeometry(index === 0 ? 1.82 : 1.98, 0.09, 12, 80),
      meshMaterial(index === 0 ? palette.green : palette.orange, { roughness: 0.3, metalness: 0.72 })
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

  for (let stage = 0; stage < 4; stage += 1) {
    const rotor = new THREE.Group();
    rotor.position.x = -3 + stage * 2;
    rotor.rotation.y = Math.PI / 2;

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.18 + stage * 0.08, 0.075, 10, 72),
      meshMaterial(stage === 2 ? palette.orange : palette.green, { roughness: 0.32, metalness: 0.72 })
    );
    rotor.add(ring);

    const outerRing = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.CylinderGeometry(1.62 + stage * 0.08, 1.62 + stage * 0.08, 0.28, 48, 1, true)),
      lineMaterial(palette.faint, 0.82)
    );
    outerRing.rotation.x = Math.PI / 2;
    rotor.add(outerRing);

    const bladeMaterial = meshMaterial(stage === 2 ? palette.yellow : palette.white, {
      roughness: 0.28,
      metalness: 0.78,
      opacity: 0.84
    });
    const bladeCount = 22;
    for (let blade = 0; blade < bladeCount; blade += 1) {
      const angle = (blade / bladeCount) * Math.PI * 2;
      const mesh = new THREE.Mesh(bladeGeometry, bladeMaterial);
      mesh.scale.setScalar(0.77 + stage * 0.045);
      mesh.position.set(Math.cos(angle) * 0.78, Math.sin(angle) * 0.78, 0);
      mesh.rotation.z = angle - 0.18;
      rotor.add(mesh);
    }

    const sensorGeometry = new THREE.SphereGeometry(0.055, 8, 8);
    const sensorMaterial = meshMaterial(stage === 2 ? palette.yellow : palette.blue, { roughness: 0.4, metalness: 0.2 });
    for (let s = 0; s < 6; s += 1) {
      const angle = (s / 6) * Math.PI * 2;
      const sensor = new THREE.Mesh(sensorGeometry, sensorMaterial);
      sensor.position.set(Math.cos(angle) * 1.72, Math.sin(angle) * 1.72, 0.18);
      rotor.add(sensor);
    }

    group.userData.rotors.push(rotor);
    group.add(rotor);

    if (stage < 3) {
      const stator = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.CylinderGeometry(1.9, 1.9, 0.12, 52, 1, true)),
        lineMaterial(palette.blueDim, 0.5)
      );
      stator.position.x = rotor.position.x + 0.92;
      stator.rotation.z = Math.PI / 2;
      group.add(stator);
    }
  }

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
  return group;
}

function createTopoWorld() {
  const group = new THREE.Group();
  group.position.set(0, 0, -16);
  group.userData.nodes = [];
  group.userData.flowParticles = [];

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

  const poreGeometry = new THREE.IcosahedronGeometry(0.11, 1);
  const poreMaterial = meshMaterial(palette.blue, {
    roughness: 0.22,
    metalness: 0.16,
    emissive: palette.blueDim,
    emissiveIntensity: 0.42
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
    pores.setColorAt(index, new THREE.Color(index % 9 === 0 ? palette.green : palette.blue));
  });
  pores.instanceMatrix.needsUpdate = true;
  if (pores.instanceColor) pores.instanceColor.needsUpdate = true;
  group.add(pores);
  group.add(linesFromArray(edgePositions, palette.blueDim, 0.66));

  const shellSolid = new THREE.Mesh(
    new THREE.DodecahedronGeometry(4.6, 1),
    meshMaterial(palette.blueDim, {
      roughness: 0.5,
      metalness: 0.1,
      opacity: 0.035,
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
    group.add(tracer);
  }
  return group;
}

function createAegisWorld() {
  const group = new THREE.Group();
  group.position.set(-14, 0, 0);
  group.rotation.x = -0.24;
  group.userData.bars = [];
  group.userData.blips = [];

  [1.1, 2, 2.9, 3.8].forEach((radius, index) => {
    const points = [];
    for (let i = 0; i <= 96; i += 1) {
      const angle = (i / 96) * Math.PI * 2;
      points.push(Math.cos(angle) * radius, Math.sin(angle) * radius, 0);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
    group.add(new THREE.Line(geometry, lineMaterial(index === 2 ? palette.orange : palette.faint, index === 2 ? 0.8 : 0.42)));
  });

  const spokes = [];
  for (let i = 0; i < 12; i += 1) {
    const angle = (i / 12) * Math.PI * 2;
    spokes.push(0, 0, 0, Math.cos(angle) * 4.2, Math.sin(angle) * 4.2, 0);
  }
  group.add(linesFromArray(spokes, palette.faint, 0.4));

  const sweepGeometry = new THREE.BufferGeometry();
  sweepGeometry.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0, 4.25, 0, 0], 3));
  const sweep = new THREE.Line(sweepGeometry, lineMaterial(palette.orange, 0.95));
  sweep.userData.isSweep = true;
  group.userData.sweep = sweep;
  group.add(sweep);

  const sweepSector = new THREE.Mesh(
    new THREE.CircleGeometry(4.18, 72, 0, 0.42),
    new THREE.MeshBasicMaterial({
      color: palette.orange,
      transparent: true,
      opacity: 0.09,
      side: THREE.DoubleSide,
      depthWrite: false
    })
  );
  sweepSector.position.z = -0.015;
  group.userData.sweepSector = sweepSector;
  group.add(sweepSector);

  const barGeometry = new THREE.BoxGeometry(0.18, 1, 0.18);
  for (let i = 0; i < 18; i += 1) {
    const angle = (i / 18) * Math.PI * 2;
    const height = 0.35 + random() * 1.4;
    const bar = new THREE.Mesh(
      barGeometry,
      meshMaterial(i % 5 === 0 ? palette.yellow : palette.orange, { roughness: 0.5, metalness: 0.35 })
    );
    bar.scale.y = height;
    bar.position.set(Math.cos(angle) * 4.55, Math.sin(angle) * 4.55, height * 0.4);
    bar.rotation.z = angle - Math.PI / 2;
    bar.userData.baseHeight = height;
    bar.userData.phase = random() * Math.PI * 2;
    group.userData.bars.push(bar);
    group.add(bar);
  }

  const blipGeometry = new THREE.SphereGeometry(0.095, 12, 12);
  for (let i = 0; i < 11; i += 1) {
    const angle = random() * Math.PI * 2;
    const radius = 0.75 + random() * 3.1;
    const blip = new THREE.Mesh(
      blipGeometry,
      meshMaterial(i % 4 === 0 ? palette.yellow : palette.orange, {
        roughness: 0.22,
        metalness: 0.1,
        emissive: i % 4 === 0 ? palette.yellow : palette.orange,
        emissiveIntensity: 1.1
      })
    );
    blip.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius, 0.08);
    blip.userData.phase = random() * Math.PI * 2;
    group.userData.blips.push(blip);
    group.add(blip);
  }
  return group;
}

function createStudioWorld() {
  const group = new THREE.Group();
  group.position.set(-12, 8, -10);
  group.userData.panels = [];
  group.userData.dataParticles = [];

  const panelDefinitions = [
    {
      title: "evidence_router.py",
      accent: "#47e6a5",
      position: [-3.2, 0.9, 0.2],
      rotation: [0.04, 0.22, -0.025],
      lines: [
        { text: "@router.get('/evidence/{plant}')", accent: true },
        { text: "def read_evidence(plant: PlantId):" },
        { text: "    trace = service.for_plant(plant)" },
        { text: "    return EvidenceTrace.model_validate(trace)" },
        { text: "# causal inputs only" }
      ]
    },
    {
      title: "scene_state.ts",
      accent: "#668cff",
      position: [0, -0.2, -0.45],
      rotation: [-0.02, 0, 0.018],
      lines: [
        { text: "const scene = contract[index]", accent: true },
        { text: "springVector(camera, scene.target)" },
        { text: "renderer.setAnimationLoop(render)" },
        { text: "announce(scene.accessibleName)" },
        { text: "history.replaceState(null, '', hash)" }
      ]
    },
    {
      title: "validation.py",
      accent: "#ff7448",
      position: [3.2, 1.15, 0.05],
      rotation: [0.02, -0.24, 0.025],
      lines: [
        { text: "assert no_future_inputs(trace)", accent: true },
        { text: "assert api_contract.is_stable()" },
        { text: "assert historical_dfi.byte_identical" },
        { text: "report.add_regression(checks=17)" },
        { text: "decision = gates.evaluate()" }
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
      lineMaterial([palette.green, palette.blue, palette.orange][index], 0.48)
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
  group.add(linesFromArray(architectureEdges, palette.green, 0.72));

  architectureNodes.forEach((position, index) => {
    const node = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.34, 0.34),
      meshMaterial([palette.green, palette.blue, palette.orange][index], {
        roughness: 0.2,
        metalness: 0.72,
        emissive: [palette.greenDim, palette.blueDim, palette.orangeDim][index],
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
      meshMaterial(i % 3 === 0 ? palette.yellow : palette.green, {
        emissive: i % 3 === 0 ? palette.yellow : palette.green,
        emissiveIntensity: 1
      })
    );
    packet.userData.offset = i / 12;
    group.userData.dataParticles.push(packet);
    group.add(packet);
  }

  return group;
}

function createProfileWorld() {
  const group = new THREE.Group();
  group.position.set(0, 8, 0);

  const helix = [];
  for (let i = 0; i < 130; i += 1) {
    const t = i / 129;
    const angle = t * Math.PI * 8;
    helix.push(Math.cos(angle) * 2.4, -3.8 + t * 7.6, Math.sin(angle) * 2.4);
  }
  const helixGeometry = new THREE.BufferGeometry();
  helixGeometry.setAttribute("position", new THREE.Float32BufferAttribute(helix, 3));
  group.add(new THREE.Line(helixGeometry, lineMaterial(palette.green, 0.82)));

  const years = [-2.7, 0, 2.7];
  years.forEach((y, index) => {
    const plate = new THREE.Mesh(
      new THREE.BoxGeometry(3.4, 0.08, 1.7),
      meshMaterial([palette.orange, palette.blue, palette.green][index], { roughness: 0.55, metalness: 0.28, opacity: 0.58 })
    );
    plate.position.set(index % 2 === 0 ? 1.7 : -1.7, y, 0);
    plate.rotation.y = (index - 1) * 0.28;
    group.add(plate);
  });

  const frame = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(7.5, 9.2, 5.5)),
    lineMaterial(palette.faint, 0.28)
  );
  group.add(frame);
  return group;
}

const worlds = [];

function initializeThree() {
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: "high-performance"
    });
    renderer.setClearColor(palette.black, 1);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, coarsePointer ? 1.35 : 1.75));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(palette.black);
    scene.fog = new THREE.FogExp2(palette.black, 0.027);

    camera = new THREE.PerspectiveCamera(42, 1, 0.1, 120);
    camera.position.fromArray(cameraStates[currentScene].position);
    currentLook.fromArray(cameraStates[currentScene].look);
    camera.lookAt(currentLook);
    transitField = createTransitField();
    camera.add(transitField);
    scene.add(camera);

    scene.add(new THREE.HemisphereLight(0xb9d8ca, 0x111713, 1.55));
    const key = new THREE.DirectionalLight(0xffffff, 2.1);
    key.position.set(8, 10, 10);
    scene.add(key);
    const accent = new THREE.PointLight(palette.green, 28, 18, 2);
    accent.position.set(0, 2, 5);
    scene.add(accent);

    scene.add(createAmbientField());
    worlds.push(
      createOriginWorld(),
      createCompressorWorld(),
      createTopoWorld(),
      createAegisWorld(),
      createStudioWorld(),
      createProfileWorld()
    );
    worlds.forEach((world) => scene.add(world));
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

  worlds[0].rotation.y += reduceMotion ? 0 : 0.0012;
  worlds[0].rotation.x = Math.sin(time * 0.18) * 0.12;

  worlds[1].userData.rotors.forEach((rotor, index) => {
    rotor.rotation.z += reduceMotion ? 0 : 0.008 + index * 0.0016;
  });
  worlds[1].rotation.y = Math.sin(time * 0.24) * 0.08;
  worlds[1].userData.flowParticles.forEach((particle) => {
    const progress = (particle.userData.offset + time * particle.userData.speed) % 1;
    const spiral = particle.userData.phase + progress * Math.PI * 7;
    const compression = 1 - progress * 0.34;
    particle.position.set(
      -4.45 + progress * 8.9,
      Math.cos(spiral) * particle.userData.radius * compression,
      Math.sin(spiral) * particle.userData.radius * compression
    );
  });

  worlds[2].rotation.y += reduceMotion ? 0 : 0.0017;
  worlds[2].rotation.x = Math.sin(time * 0.2) * 0.08;
  if (worlds[2].userData.flowCurve) {
    worlds[2].userData.flowParticles.forEach((particle) => {
      const progress = (particle.userData.offset + time * particle.userData.speed) % 1;
      particle.position.copy(worlds[2].userData.flowCurve.getPointAt(progress));
      const pulse = 0.7 + Math.sin(progress * Math.PI) * 0.8;
      particle.scale.setScalar(pulse);
    });
  }

  const sweepAngle = reduceMotion ? 0.65 : time * 0.68;
  if (worlds[3].userData.sweep) worlds[3].userData.sweep.rotation.z = sweepAngle;
  if (worlds[3].userData.sweepSector) worlds[3].userData.sweepSector.rotation.z = sweepAngle;
  worlds[3].userData.bars.forEach((bar) => {
    const pulse = reduceMotion ? 1 : 0.78 + Math.sin(time * 1.7 + bar.userData.phase) * 0.22;
    bar.scale.y = bar.userData.baseHeight * pulse;
  });
  worlds[3].userData.blips.forEach((blip) => {
    const pulse = reduceMotion ? 1 : 0.55 + (Math.sin(time * 3.2 + blip.userData.phase) + 1) * 0.42;
    blip.scale.setScalar(pulse);
  });

  worlds[4].userData.panels.forEach((panel) => {
    panel.position.y = panel.userData.baseY + (reduceMotion ? 0 : Math.sin(time * 0.8 + panel.userData.phase) * 0.08);
  });
  worlds[4].userData.dataParticles.forEach((packet) => {
    const progress = (packet.userData.offset + time * 0.065) % 1;
    packet.position.set(-3.2 + progress * 6.4, -2.05 + Math.sin(progress * Math.PI) * 0.18, -0.12);
    packet.rotation.x = time * 1.4;
    packet.rotation.y = time * 1.8;
  });
  worlds[4].rotation.y = reduceMotion ? 0 : Math.sin(time * 0.22) * 0.035;

  worlds[5].rotation.y += reduceMotion ? 0 : 0.0014;

  if (activeWorld && !reduceMotion) {
    activeWorld.rotation.z += (pointerX * 0.04 - activeWorld.rotation.z) * 0.025;
  }

  renderer.render(scene, camera);
  updateFps(timeMs);
}

function updateFps(now) {
  frameCount += 1;
  if (now - fpsStartedAt < 1000) return;
  const fps = Math.round((frameCount * 1000) / (now - fpsStartedAt));
  if (telemetryFps) telemetryFps.textContent = `RENDER ${fps} FPS`;
  frameCount = 0;
  fpsStartedAt = now;
}

function setScene(index, options = {}) {
  const next = Math.max(0, Math.min(sceneNames.length - 1, Number(index)));
  if (next === currentScene && !options.force) return;
  const previousScene = currentScene;
  currentScene = next;
  activeWorld = worlds[currentScene] || null;
  lastSceneChange = performance.now();

  if (!options.force && !reduceMotion) {
    const direction = Math.sign(currentScene - previousScene) || 1;
    cameraVelocity.y += direction * 1.9;
    cameraVelocity.x += direction * 0.7;
    document.body.classList.remove("is-scene-transitioning");
    void document.body.offsetWidth;
    document.body.classList.add("is-scene-transitioning");
    window.clearTimeout(transitionTimer);
    transitionTimer = window.setTimeout(() => document.body.classList.remove("is-scene-transitioning"), 680);
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

  if (telemetryScene) telemetryScene.textContent = sceneNames[currentScene];
  if (sceneAnnouncer && !options.force) sceneAnnouncer.textContent = `${sceneNames[currentScene]} scene selected`;
  if (telemetryCoordinates) {
    const [x, y, z] = cameraStates[currentScene].position;
    telemetryCoordinates.textContent = `X ${x.toFixed(1)} / Y ${y.toFixed(1)} / Z ${z.toFixed(1)}`;
  }

  if (!options.skipHistory) {
    history.replaceState(null, "", `#${sceneHashes[currentScene]}`);
  }
}

function stepScene(direction) {
  setScene(currentScene + direction);
}

railButtons.forEach((button) => {
  button.addEventListener("click", () => setScene(Number(button.dataset.sceneJump)));
});

document.querySelectorAll("[data-next-scene]").forEach((button) => {
  button.addEventListener("click", () => stepScene(1));
});

window.addEventListener("wheel", (event) => {
  if (document.querySelector("dialog[open]")) return;
  if (Math.abs(event.deltaY) < 10 || performance.now() - lastSceneChange < 780) return;
  stepScene(event.deltaY > 0 ? 1 : -1);
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
  const elapsed = performance.now() - dragStart.at;
  if (coarsePointer && elapsed < 650 && Math.abs(dx) > 42) stepScene(dx < 0 ? 1 : -1);
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

function openDialog(dialog) {
  if (!dialog) return;
  document.body.classList.add("dialog-open");
  dialog.showModal();
}

function closeDialog(dialog) {
  if (!dialog?.open) return;
  dialog.close();
  document.body.classList.remove("dialog-open");
}

const evidenceDialog = document.getElementById("evidence-dialog");
const evidenceDialogTitle = document.getElementById("evidence-dialog-title");
const evidenceDialogIndex = document.getElementById("evidence-dialog-index");
const evidenceDialogBody = document.getElementById("evidence-dialog-body");
const evidenceMetadata = {
  compressor: { title: "Compressor evidence", index: "FIELD REPORT / 01" },
  topoflow: { title: "TopoFlow evidence", index: "FIELD REPORT / 02" },
  aegis: { title: "Aegis contract", index: "FIELD REPORT / 03" },
  studio: { title: "Engineering build", index: "FIELD REPORT / 04" }
};

document.querySelectorAll("[data-open-evidence]").forEach((button) => {
  button.addEventListener("click", () => {
    const key = button.dataset.openEvidence;
    const template = document.getElementById(`evidence-${key}`);
    const metadata = evidenceMetadata[key];
    if (!template || !metadata) return;
    evidenceDialogTitle.textContent = metadata.title;
    evidenceDialogIndex.textContent = metadata.index;
    evidenceDialogBody.replaceChildren(template.content.cloneNode(true));
    openDialog(evidenceDialog);
  });
});

document.querySelector("[data-close-evidence]")?.addEventListener("click", () => closeDialog(evidenceDialog));
evidenceDialog?.addEventListener("click", (event) => {
  if (event.target === evidenceDialog) closeDialog(evidenceDialog);
});

const archiveDialog = document.getElementById("archive-dialog");
document.querySelectorAll("[data-open-archive]").forEach((button) => {
  button.addEventListener("click", () => openDialog(archiveDialog));
});
document.querySelector("[data-close-archive]")?.addEventListener("click", () => closeDialog(archiveDialog));
archiveDialog?.addEventListener("click", (event) => {
  if (event.target === archiveDialog) closeDialog(archiveDialog);
});

[evidenceDialog, archiveDialog].forEach((dialog) => {
  dialog?.addEventListener("close", () => document.body.classList.remove("dialog-open"));
});

initializeThree();
setScene(currentScene, { force: true, skipHistory: true });
