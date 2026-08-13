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
const sceneNames = ["ORIGIN", "COMPRESSOR", "TOPOFLOW", "AEGIS", "PROFILE"];
const sceneHashes = ["origin", "compressor", "topoflow", "aegis", "profile"];

let renderer;
let scene;
let camera;
let currentScene = Math.max(0, sceneHashes.indexOf(window.location.hash.slice(1)));
let targetCamera = new THREE.Vector3();
let targetLook = new THREE.Vector3();
let currentLook = new THREE.Vector3();
let activeWorld = null;
let lastSceneChange = 0;
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
    side: options.side ?? THREE.FrontSide
  });
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

  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.18, 8.4, 32),
    meshMaterial(palette.white, { roughness: 0.35, metalness: 0.75 })
  );
  shaft.rotation.z = Math.PI / 2;
  group.add(shaft);

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
      new THREE.EdgesGeometry(new THREE.CylinderGeometry(1.58 + stage * 0.08, 1.58 + stage * 0.08, 0.28, 48, 1, true)),
      lineMaterial(palette.faint, 0.82)
    );
    outerRing.rotation.x = Math.PI / 2;
    rotor.add(outerRing);

    const bladeGeometry = new THREE.BoxGeometry(0.075, 0.62 + stage * 0.04, 0.16);
    const bladeMaterial = meshMaterial(palette.white, { roughness: 0.45, metalness: 0.62, opacity: 0.76 });
    for (let blade = 0; blade < 18; blade += 1) {
      const angle = (blade / 18) * Math.PI * 2;
      const mesh = new THREE.Mesh(bladeGeometry, bladeMaterial);
      mesh.position.set(Math.cos(angle) * 0.78, Math.sin(angle) * 0.78, 0);
      mesh.rotation.z = angle + 0.44;
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

  const nodePositions = [];
  const vectors = [];
  for (let i = 0; i < 82; i += 1) {
    const v = new THREE.Vector3(
      (random() - 0.5) * 7.2,
      (random() - 0.5) * 6,
      (random() - 0.5) * 5.2
    );
    vectors.push(v);
    nodePositions.push(v.x, v.y, v.z);
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

  group.add(pointsFromArray(nodePositions, palette.blue, 0.13, 0.96));
  group.add(linesFromArray(edgePositions, palette.blueDim, 0.66));

  const poreShell = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.DodecahedronGeometry(4.6, 1)),
    lineMaterial(palette.faint, 0.22)
  );
  poreShell.scale.set(1.25, 0.92, 0.9);
  group.add(poreShell);

  const flowPath = [];
  for (let i = 0; i < 48; i += 1) {
    const t = i / 47;
    flowPath.push(
      -4.2 + t * 8.4,
      Math.sin(t * Math.PI * 5) * 0.8,
      Math.cos(t * Math.PI * 3) * 0.65
    );
  }
  const flowGeometry = new THREE.BufferGeometry();
  flowGeometry.setAttribute("position", new THREE.Float32BufferAttribute(flowPath, 3));
  group.add(new THREE.Line(flowGeometry, lineMaterial(palette.green, 0.92)));
  return group;
}

function createAegisWorld() {
  const group = new THREE.Group();
  group.position.set(-14, 0, 0);
  group.rotation.x = -0.24;
  group.userData.bars = [];

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

    scene = new THREE.Scene();
    scene.background = new THREE.Color(palette.black);
    scene.fog = new THREE.FogExp2(palette.black, 0.027);

    camera = new THREE.PerspectiveCamera(42, 1, 0.1, 120);
    camera.position.fromArray(cameraStates[currentScene].position);
    currentLook.fromArray(cameraStates[currentScene].look);
    camera.lookAt(currentLook);

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
  resizeRenderer();

  const lerpAmount = reduceMotion ? 1 : 0.055;
  const state = cameraStates[currentScene];
  targetCamera.fromArray(state.position);
  targetLook.fromArray(state.look);

  if (!reduceMotion) {
    targetCamera.x += pointerX * 0.42;
    targetCamera.y += pointerY * 0.28;
  }

  camera.position.lerp(targetCamera, lerpAmount);
  currentLook.lerp(targetLook, lerpAmount);
  camera.lookAt(currentLook);

  worlds[0].rotation.y += reduceMotion ? 0 : 0.0012;
  worlds[0].rotation.x = Math.sin(time * 0.18) * 0.12;

  worlds[1].userData.rotors.forEach((rotor, index) => {
    rotor.rotation.z += reduceMotion ? 0 : 0.005 + index * 0.0012;
  });
  worlds[1].rotation.y = Math.sin(time * 0.24) * 0.08;

  worlds[2].rotation.y += reduceMotion ? 0 : 0.0017;
  worlds[2].rotation.x = Math.sin(time * 0.2) * 0.08;

  if (worlds[3].userData.sweep) worlds[3].userData.sweep.rotation.z = reduceMotion ? 0.65 : time * 0.42;
  worlds[3].userData.bars.forEach((bar) => {
    const pulse = reduceMotion ? 1 : 0.78 + Math.sin(time * 1.7 + bar.userData.phase) * 0.22;
    bar.scale.y = bar.userData.baseHeight * pulse;
  });

  worlds[4].rotation.y += reduceMotion ? 0 : 0.0014;

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
  currentScene = next;
  activeWorld = worlds[currentScene] || null;
  lastSceneChange = performance.now();

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
  aegis: { title: "Aegis contract", index: "FIELD REPORT / 03" }
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
