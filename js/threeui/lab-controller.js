// ThreeUI Prototype Lab Controller
// Coordinates rendering, bloom post-processing, and interactive prototype switching

import * as THREE from "three";
import { createBloomComposer } from "./composer.js";
import { createAegisPipelinePrototype } from "./prototype-aegis-pipeline.js";
import { createFoodOpsPrototype } from "./prototype-food-ops.js";
import { createCropNdviPrototype } from "./prototype-crop-ndvi.js";
import { createCbmWaterfallPrototype } from "./prototype-cbm-waterfall.js";

const canvas = document.getElementById("lab-canvas");
const tabButtons = Array.from(document.querySelectorAll("[data-prototype-tab]"));
const infoBadge = document.getElementById("info-badge");
const infoTitle = document.getElementById("info-title");
const infoDesc = document.getElementById("info-desc");
const infoTech = document.getElementById("info-tech");

const bloomToggle = document.getElementById("bloom-toggle");
const bloomSlider = document.getElementById("bloom-slider");
const speedSlider = document.getElementById("speed-slider");

let renderer;
let scene;
let camera;
let composerObj;
let activePrototype = null;
let currentPrototypeIndex = 0;
let lastFrameTime = performance.now();

const pointer = new THREE.Vector3(0, 0, 0);
const pointerNorm = new THREE.Vector2(0, 0);

const prototypeMetadata = [
  {
    badge: "PROTOTYPE 01 / AEGIS",
    title: "Aegis Misinformation Pipeline & Evidence Room",
    desc: "Deterministic claim ingestion with SHA-256 deduplication and bifurcated 3D forensic evidence rack (supporting vs refuting contexts). Features autonomous Scout (market volatility) and Trending (RSS loop) agent terminals feeding a reviewable verdict dossier.",
    tech: ["SHA-256 Deduplication", "Bifurcated Evidence Rack", "Scout Market Terminal", "Trending RSS Loop", "Reviewable Verdict Dossier"],
    factory: createAegisPipelinePrototype,
    camPos: [0, 2.2, 13.5],
    camLook: [0, 0, 0]
  },
  {
    badge: "PROTOTYPE 02 / FOOD OPS",
    title: "Sodexo Kitchen Operations Matrix & BOM Engine",
    desc: "Weekly 7-day operations service deck with floating Random Forest pax forecast curve ribbon. Exploded dish-to-ingredient BOM tree channels bulk storage stock into daily meal slots, tracking waste ratio (prepared vs consumed).",
    tech: ["7-Day Operations Matrix", "RF Pax Forecast Ribbon", "Exploded BOM Tree", "Warehouse Silo Depletion", "Waste Ratio HUD"],
    factory: createFoodOpsPrototype,
    camPos: [0, 5.4, 13.8],
    camLook: [0, 0, 0.4]
  },
  {
    badge: "PROTOTYPE 03 / AGRI YIELD",
    title: "KrushiMitra Cadastral Farm Polygon & NDVI Terrain",
    desc: "Cadastral surveyed farm boundary polygon (Leaflet map capture) projected over terraced Odisha agricultural terrain. Multispectral LiDAR drone tracks field plots, computing NDVI canopy vigor and typed FastAPI yield estimates.",
    tech: ["Cadastral Polygon Boundary", "Terraced Field Mesh", "Multispectral LiDAR Drone", "Monsoon Precipitation", "Pydantic Contract HUD"],
    factory: createCropNdviPrototype,
    camPos: [0, 5.2, 14.2],
    camLook: [0, -0.4, 0]
  },
  {
    badge: "PROTOTYPE 04 / CBM",
    title: "Compressor CBM 3D FFT Waterfall & Harmonics",
    desc: "Real-time 3D time-frequency-amplitude FFT waterfall surface driven by custom GLSL harmonics (1X shaft unbalance, 2X misalignment, BPFO bearing defect). Visualizes physical turbine rotor stages, optical vibration telemetry, and Holt damped trend gates.",
    tech: ["3D FFT Waterfall", "GLSL Spectral Harmonics", "Rotor Blisk Dynamics", "Optical Laser Sensor", "Canvas Telemetry HUD"],
    factory: createCbmWaterfallPrototype,
    camPos: [0, 5.2, 14.2],
    camLook: [0, 0, 1.0]
  }
];

function init() {
  const width = window.innerWidth;
  const height = window.innerHeight;

  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: "high-performance"
  });
  renderer.setSize(width, height, false);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x030705);
  scene.fog = new THREE.FogExp2(0x030705, 0.024);

  camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100);

  // Lighting
  scene.add(new THREE.AmbientLight(0x22332a, 1.2));
  const keyLight = new THREE.DirectionalLight(0xffffff, 2.5);
  keyLight.position.set(8, 12, 10);
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0x00e5ff, 1.8);
  fillLight.position.set(-8, -4, -6);
  scene.add(fillLight);

  // Post-processing EffectComposer with UnrealBloomPass
  composerObj = createBloomComposer(renderer, scene, camera, width, height);

  // Switch to initial prototype
  setPrototype(0);

  // Event Listeners
  window.addEventListener("resize", onResize);
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("touchmove", onTouchMove, { passive: true });

  tabButtons.forEach((btn, idx) => {
    btn.addEventListener("click", () => setPrototype(idx));
  });

  if (bloomToggle) {
    bloomToggle.addEventListener("click", () => {
      composerObj.enabled = !composerObj.enabled;
      bloomToggle.classList.toggle("is-active", composerObj.enabled);
      bloomToggle.textContent = composerObj.enabled ? "BLOOM: ON" : "BLOOM: OFF";
    });
  }

  if (bloomSlider) {
    bloomSlider.addEventListener("input", (e) => {
      composerObj.bloomPass.strength = parseFloat(e.target.value);
    });
  }

  // Animation Loop
  renderer.setAnimationLoop(animate);
}

function setPrototype(index) {
  if (activePrototype) {
    activePrototype.destroy();
    activePrototype = null;
  }

  currentPrototypeIndex = index;
  const meta = prototypeMetadata[index];

  // Update HUD Cards
  if (infoBadge) infoBadge.textContent = meta.badge;
  if (infoTitle) infoTitle.textContent = meta.title;
  if (infoDesc) infoDesc.textContent = meta.desc;
  if (infoTech) {
    infoTech.innerHTML = meta.tech.map(t => `<span class="tech-tag">${t}</span>`).join("");
  }

  tabButtons.forEach((b, i) => {
    b.classList.toggle("is-active", i === index);
  });

  // Setup Camera
  camera.position.fromArray(meta.camPos);
  camera.lookAt(new THREE.Vector3(...meta.camLook));

  // Build Prototype
  activePrototype = meta.factory(scene);
}

function onPointerMove(e) {
  pointerNorm.x = (e.clientX / window.innerWidth) * 2 - 1;
  pointerNorm.y = -(e.clientY / window.innerHeight) * 2 + 1;

  // Unproject to 3D world coordinates at z = 0
  const vec = new THREE.Vector3(pointerNorm.x, pointerNorm.y, 0.5);
  vec.unproject(camera);
  vec.sub(camera.position).normalize();
  const distance = -camera.position.z / vec.z;
  pointer.copy(camera.position).add(vec.multiplyScalar(distance));
}

function onTouchMove(e) {
  if (e.touches.length > 0) {
    const touch = e.touches[0];
    onPointerMove(touch);
  }
}

function onResize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
  composerObj.setSize(width, height);
}

function animate(timeMs) {
  const time = timeMs * 0.001;
  const dt = Math.min((timeMs - lastFrameTime) / 1000, 0.034);
  lastFrameTime = timeMs;

  const speedMult = speedSlider ? parseFloat(speedSlider.value) : 1.0;

  if (activePrototype) {
    activePrototype.update(time * speedMult, pointerNorm);
  }

  composerObj.render(dt);
}

// Start
init();
