// ThreeUI Prototype Lab Controller
// Coordinates rendering, bloom post-processing, and interactive prototype switching

import * as THREE from "three";
import { createBloomComposer } from "./composer.js";
import { createNeuralFluxPrototype } from "./prototype-neural-flux.js";
import { createAegisHoloPrototype } from "./prototype-aegis-holo.js";
import { createGridQuantumPrototype } from "./prototype-grid-quantum.js";
import { createTopoMeshPrototype } from "./prototype-topo-mesh.js";

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
    badge: "PROTOTYPE 01 / ORIGIN",
    title: "Neural Flux & Cosmic Particle Swarm",
    desc: "22,000 GPU-accelerated particles driven by 3D Simplex curl noise. The cursor forms an interactive gravitational vortex with chromatic dispersion, orbiting around a holographic accelerator core.",
    tech: ["GPU Curl Noise", "Simplex 3D", "UnrealBloomPass", "Additive Blending", "Interactive Force Field"],
    factory: createNeuralFluxPrototype,
    camPos: [0, 2.4, 14.5],
    camLook: [0, 0, 0]
  },
  {
    badge: "PROTOTYPE 02 / AEGIS",
    title: "Holographic Agent Grid & Laser Conduits",
    desc: "A floating 3D claim dossier with animated GLSL scanlines and iridescent Fresnel rim lighting. Data packets race across pulsating bezier conduits into specialist agent stations and a central verdict core.",
    tech: ["Holographic GLSL", "Fresnel Rim Glow", "Traveling Pulse Veins", "Chromatic Iridescence", "Agent HUD"],
    factory: createAegisHoloPrototype,
    camPos: [0, 1.2, 11.5],
    camLook: [0, 0, 0]
  },
  {
    badge: "PROTOTYPE 03 / GRIDIUM",
    title: "Living Quantum Energy Microgrid",
    desc: "A floating hexagonal power deck textured with real-time procedural Voronoi cellular energy rivers. 15 distributed nodes dynamically exchange energy with a central quantum liquidity pool.",
    tech: ["Procedural Voronoi", "Cellular Noise Shader", "Liquid Glass AMM", "Energy Veins", "Dynamic Packets"],
    factory: createGridQuantumPrototype,
    camPos: [0, 7.8, 12.0],
    camLook: [0, -0.4, 0]
  },
  {
    badge: "PROTOTYPE 04 / TOPOFLOW",
    title: "Biomorphic Pore Network & Graph Lattice",
    desc: "An organic graph neural network simulating permeable rock matrix topology. Nodes breathe via vertex displacement, linked by glowing tensor pathways inside a volumetric bounding hologram.",
    tech: ["Instanced Mesh", "GNN Tensor Lattice", "Deforming Pores", "Volumetric Hologram", "Depth Attenuation"],
    factory: createTopoMeshPrototype,
    camPos: [0, 1.8, 12.5],
    camLook: [0, 0, 0]
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
