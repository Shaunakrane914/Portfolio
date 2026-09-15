// ThreeUI Visual Lab Controller
// Coordinates rendering, bloom post-processing, and prototype switching across
// the 5 pure cinematic 3D visual concepts with minimal lab chrome.
// ZERO text panels or dashboards. 100% focused on 3D scene, lighting, materials, and interaction.

import * as THREE from "three";
import { createBloomComposer } from "./composer.js";
import { createAegisArtPrototype } from "./prototype-aegis-art.js";
import { createGridiumMicrogridPrototype } from "./prototype-gridium-microgrid.js";
import { createCbmWaterfallPrototype } from "./prototype-cbm-waterfall.js";
import { createCropNdviPrototype } from "./prototype-crop-ndvi.js";
import { createFoodFlowPrototype } from "./prototype-food-flow.js";

const canvas = document.getElementById("lab-canvas");
const tabButtons = Array.from(document.querySelectorAll("[data-prototype-tab]"));
const bloomToggle = document.getElementById("bloom-toggle");
const bloomSlider = document.getElementById("bloom-slider");
const speedSlider = document.getElementById("speed-slider");
const resetCamBtn = document.getElementById("reset-cam");

let renderer;
let scene;
let camera;
let composerObj;
let activePrototype = null;
let currentPrototypeIndex = 0;
let lastFrameTime = performance.now();

const pointerNorm = new THREE.Vector2(0, 0);

// 5 Pure 3D Visual Art Prototypes — each with distinct camera + scene background
const prototypes = [
  {
    name: "AEGIS",
    factory: createAegisArtPrototype,
    camPos: [0, 1.2, 13.0],
    camLook: [0, 0.2, 0],
    bgColor: 0x020508,
    fogDensity: 0.018
  },
  {
    name: "GRIDIUM",
    factory: createGridiumMicrogridPrototype,
    camPos: [2.0, 5.5, 16.0],
    camLook: [0, 0, 0],
    bgColor: 0x030709,
    fogDensity: 0.015
  },
  {
    name: "COMPRESSOR",
    factory: createCbmWaterfallPrototype,
    camPos: [0, 5.8, 16.0],
    camLook: [0, 1.5, 0],
    bgColor: 0x020509,
    fogDensity: 0.02
  },
  {
    name: "KRUSHIMITRA",
    factory: createCropNdviPrototype,
    camPos: [1.0, 6.0, 14.5],
    camLook: [0, -1.0, 0],
    bgColor: 0x010704,
    fogDensity: 0.016
  },
  {
    name: "FOOD OPS",
    factory: createFoodFlowPrototype,
    camPos: [0, 3.5, 14.0],
    camLook: [0, -0.5, 0],
    bgColor: 0x020806,
    fogDensity: 0.014
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
  renderer.toneMappingExposure = 1.2;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x030609);
  scene.fog = new THREE.FogExp2(0x030609, 0.022);

  camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100);

  // Subtle ambient & directional lights
  scene.add(new THREE.AmbientLight(0x1a2630, 1.4));
  const keyLight = new THREE.DirectionalLight(0xffffff, 2.4);
  keyLight.position.set(8, 12, 10);
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0x00e5ff, 1.6);
  fillLight.position.set(-8, -4, -6);
  scene.add(fillLight);

  // Post-processing Bloom Composer
  composerObj = createBloomComposer(renderer, scene, camera, width, height);

  // Switch to initial prototype
  setPrototype(0);

  // Event Listeners
  window.addEventListener("resize", onResize);
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("touchmove", onTouchMove, { passive: true });

  tabButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.getAttribute("data-prototype-tab"), 10);
      setPrototype(idx);
    });
  });

  if (bloomToggle) {
    bloomToggle.addEventListener("click", () => {
      composerObj.enabled = !composerObj.enabled;
      bloomToggle.classList.toggle("is-active", composerObj.enabled);
      bloomToggle.textContent = composerObj.enabled ? "BLOOM: ON" : "BLOOM: OFF";
    });
  }

  if (bloomSlider) {
    bloomSlider.addEventListener("input", e => {
      composerObj.bloomPass.strength = parseFloat(e.target.value);
    });
  }

  if (resetCamBtn) {
    resetCamBtn.addEventListener("click", () => {
      resetCamera();
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
  const proto = prototypes[index];

  tabButtons.forEach((b, i) => {
    b.classList.toggle("is-active", i === index);
  });

  // Per-prototype scene atmosphere
  if (proto.bgColor !== undefined) {
    scene.background = new THREE.Color(proto.bgColor);
    scene.fog = new THREE.FogExp2(proto.bgColor, proto.fogDensity ?? 0.02);
  }

  // Setup camera
  camera.position.fromArray(proto.camPos);
  camera.lookAt(new THREE.Vector3(...proto.camLook));

  // Build 3D visual art
  if (proto.factory) {
    activePrototype = proto.factory(scene);
  }
}

function resetCamera() {
  const proto = prototypes[currentPrototypeIndex];
  camera.position.fromArray(proto.camPos);
  camera.lookAt(new THREE.Vector3(...proto.camLook));
}

function onPointerMove(e) {
  pointerNorm.x = (e.clientX / window.innerWidth) * 2 - 1;
  pointerNorm.y = -(e.clientY / window.innerHeight) * 2 + 1;
}

function onTouchMove(e) {
  if (e.touches.length > 0) {
    onPointerMove(e.touches[0]);
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

  if (composerObj) {
    composerObj.render(dt);
  }
}

// Start
init();
