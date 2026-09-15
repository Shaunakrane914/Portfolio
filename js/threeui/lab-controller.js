// ThreeUI Prototype Lab Controller
// Coordinates rendering, proportional visual levels (Level A Full 3D, Level B Hybrid, Level C Product UI)
// and interactive prototype switching across Shaunak's actual engineering projects.

import * as THREE from "three";
import { createBloomComposer } from "./composer.js";
import { createAegisPipelinePrototype } from "./prototype-aegis-pipeline.js";
import { createGridiumMicrogridPrototype } from "./prototype-gridium-microgrid.js";
import { createCropNdviPrototype } from "./prototype-crop-ndvi.js";
import { createCbmWaterfallPrototype } from "./prototype-cbm-waterfall.js";

const canvas = document.getElementById("lab-canvas");
const canvasVignette = document.getElementById("canvas-vignette");
const tabButtons = Array.from(document.querySelectorAll("[data-prototype-tab]"));
const infoBadge = document.getElementById("info-badge");
const infoTitle = document.getElementById("info-title");
const infoDesc = document.getElementById("info-desc");
const infoTech = document.getElementById("info-tech");
const infoCardPanel = document.getElementById("info-card-panel");
const hudControlsPanel = document.getElementById("hud-controls-panel");

const hybridAegisContainer = document.getElementById("hybrid-aegis-container");
const productFoodContainer = document.getElementById("product-food-container");

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

// Proportional visual hierarchy definitions
const prototypeMetadata = [
  {
    level: "HYBRID",
    badge: "01 / AEGIS [HYBRID]",
    title: "Aegis Misinformation Pipeline & Evidence Room",
    desc: "Forensic intelligence workstation communicating the complete claim lifecycle: Ingestion → SHA-256 Deduplication (1,400 tokens saved) → Research → Bifurcated Evidence Workspace (Supporting vs Contradicting context) → Autonomous Scout (+2.85σ market volatility) & Trending RSS loop → Reviewable Verdict Dossier (MISLEADING, 91.4% confidence). Subtle 3D background layer enhances depth, but the product is 100% understandable with WebGL disabled.",
    tech: ["Forensic Intelligence UI", "Bifurcated Evidence Workspace", "SHA-256 Deduplication", "Scout Volatility (+2.85σ)", "Reviewable Verdict Dossier", "Subtle 3D Evidence Layer"],
    factory: createAegisPipelinePrototype,
    camPos: [0, 2.2, 13.5],
    camLook: [0, 0, 0]
  },
  {
    level: "PRODUCT_UI",
    badge: "02 / FOOD OPS [PRODUCT UI]",
    title: "Sodexo Institutional Kitchen Operations & BOM Engine",
    desc: "Polished enterprise operations suite featuring a 7-day service calendar (Mon–Sun × Breakfast, Lunch, Dinner), Random Forest attendance forecasting (Pax curve with 95% CI), interactive dish-level BOM explosion, real-time warehouse inventory silo levels with automated shortage warnings, and empirical waste ratio reduction (4.8% vs 14.2% spreadsheet baseline). Pure 2D enterprise software — zero forced 3D.",
    tech: ["7-Day Service Calendar", "Random Forest Pax Forecasting", "Interactive Dish BOM Tree", "Warehouse Silo Depletion", "Automated Shortage Alerts", "Waste Ratio Tracking (4.8%)"],
    factory: null, // PURE 2D PRODUCT UI — NO 3D
    camPos: [0, 0, 10],
    camLook: [0, 0, 0]
  },
  {
    level: "FULL_3D",
    badge: "03 / GRIDIUM [FULL 3D]",
    title: "Gridium Microgrid Simulation & Constant-Product AMM",
    desc: "Level A Full Spatial 3D Simulation of the 4-runtime microgrid closed loop: 15 prosumer nodes (solar generation, duck-curve load, battery storage) linked to a central constant-product AMM liquidity pool (x · y = k) with continuous DDPG RL agent fee control, automated pricing updates, and real-time energy flow packets.",
    tech: ["15 Prosumer Microgrid Nodes", "Constant-Product AMM (x · y = k)", "Continuous DDPG RL Agent", "Real-Time Energy Flow", "Solidity & Groth16 Settlement"],
    factory: createGridiumMicrogridPrototype,
    camPos: [0, 6.2, 15.0],
    camLook: [0, 0, 0]
  },
  {
    level: "FULL_3D",
    badge: "04 / KRUSHIMITRA [FULL 3D]",
    title: "KrushiMitra Cadastral Farm Polygon & NDVI Terrain",
    desc: "Level A Full Spatial Geospatial Visualization: surveyed cadastral farm boundary polygon (#OD-GANJAM-742B, 4.8 acres) captured from Leaflet coordinates projected over terraced Odisha topography. Autonomous LiDAR drone scans parcels with custom GLSL false-color NDVI canopy vigor shader and typed FastAPI scenario output.",
    tech: ["Cadastral Polygon (#OD-GANJAM-742B)", "Terraced Elevation Mesh", "Multispectral GLSL NDVI Shader", "Autonomous LiDAR Scanner", "Pydantic Contract HUD"],
    factory: createCropNdviPrototype,
    camPos: [0, 5.2, 14.2],
    camLook: [0, -0.4, 0]
  },
  {
    level: "FULL_3D",
    badge: "05 / COMPRESSOR [FULL 3D]",
    title: "Compressor CBM 3D FFT Waterfall & Harmonics",
    desc: "Level A Full Spatial Engineering Digital Twin: dynamic 3D time-frequency-amplitude FFT waterfall surface driven by real-time GLSL harmonic equations (1X shaft unbalance, 2X misalignment, BPFO bearing outer race defect). Features rotating compressor rotor blisk stages, optical laser vibration telemetry, and Holt damped trend gates.",
    tech: ["3D FFT Waterfall Mesh", "GLSL Spectral Harmonics", "Compressor Rotor Dynamics", "Optical Laser Sensor", "Holt Damped Trend Gates"],
    factory: createCbmWaterfallPrototype,
    camPos: [0, 5.2, 14.2],
    camLook: [0, 0, 1.0]
  }
];

// Interactive Food Ops BOM Data
const bomData = {
  paneer: {
    title: "LUNCH SERVICE: PANEER BUTTER MASALA (920 PORTIONS)",
    rows: [
      { name: "Fresh Malai Paneer", spec: "150 g / pax", req: "138.0 kg", inv: "185.0 kg in Cold Storage", status: "SUFFICIENT (+47 kg BUFFER)", ok: true },
      { name: "Roma Tomatoes (Puree)", spec: "65 g / pax", req: "59.8 kg", inv: "95.0 kg in Dry Stock", status: "SUFFICIENT (+35.2 kg BUFFER)", ok: true },
      { name: "Fresh Dairy Cream", spec: "25 ml / pax", req: "23.0 L", inv: "30.0 L in Chiller", status: "SUFFICIENT (+7 L BUFFER)", ok: true },
      { name: "Butter & Spices Rollup", spec: "18 g / pax", req: "16.5 kg", inv: "42.0 kg in Pantry", status: "SUFFICIENT (+25.5 kg BUFFER)", ok: true }
    ]
  },
  dal: {
    title: "LUNCH SERVICE: YELLOW DAL TADKA (1,450 PORTIONS)",
    rows: [
      { name: "Toor Dal (Pigeon Pea)", spec: "80 g / pax", req: "116.0 kg", inv: "240.0 kg in Grain Silo", status: "SUFFICIENT (+124 kg BUFFER)", ok: true },
      { name: "Desi Ghee & Tempering", spec: "12 g / pax", req: "17.4 kg", inv: "35.0 kg in Pantry", status: "SUFFICIENT (+17.6 kg BUFFER)", ok: true },
      { name: "Cumin, Mustard, Garlic", spec: "6 g / pax", req: "8.7 kg", inv: "22.0 kg in Spice Rack", status: "SUFFICIENT (+13.3 kg BUFFER)", ok: true },
      { name: "Fresh Coriander Leaves", spec: "4 g / pax", req: "5.8 kg", inv: "7.0 kg in Cold Storage", status: "SUFFICIENT (+1.2 kg BUFFER)", ok: true }
    ]
  },
  rice: {
    title: "LUNCH SERVICE: STEAMED BASMATI RICE (1,840 PORTIONS)",
    rows: [
      { name: "Aged Basmati Rice", spec: "110 g / pax", req: "202.4 kg", inv: "650.0 kg in Rice Silo", status: "SUFFICIENT (+447.6 kg BUFFER)", ok: true },
      { name: "Whole Spices & Bay Leaf", spec: "2 g / pax", req: "3.7 kg", inv: "18.0 kg in Dry Store", status: "SUFFICIENT (+14.3 kg BUFFER)", ok: true },
      { name: "Iodized Sea Salt", spec: "3 g / pax", req: "5.5 kg", inv: "80.0 kg in Pantry", status: "SUFFICIENT (+74.5 kg BUFFER)", ok: true },
      { name: "Filtered Purified Water", spec: "220 ml / pax", req: "404.8 L", inv: "RO Line Plentiful", status: "MUNICIPAL RO LINE OK", ok: true }
    ]
  },
  salad: {
    title: "LUNCH SERVICE: MIXED SPROUT SALAD (780 PORTIONS) — SHORTAGE WARNING",
    rows: [
      { name: "Sprouted Moong & Chana", spec: "75 g / pax", req: "58.5 kg", inv: "62.0 kg in Cold Room", status: "TIGHT BUFFER (+3.5 kg)", ok: false },
      { name: "English Cucumbers", spec: "40 g / pax", req: "31.2 kg", inv: "28.0 kg in Produce Bay", status: "SHORTAGE (-3.2 kg) ⚠ PO SENT", ok: false },
      { name: "Fresh Lemon & Mint", spec: "15 g / pax", req: "11.7 kg", inv: "12.0 kg in Cold Storage", status: "REORDER PO DISPATCHED", ok: false },
      { name: "Chaat Masala & Rock Salt", spec: "4 g / pax", req: "3.1 kg", inv: "14.0 kg in Dry Pantry", status: "SUFFICIENT (+10.9 kg BUFFER)", ok: true }
    ]
  }
};

let isWebGLAvailable = true;

function init() {
  const width = window.innerWidth;
  const height = window.innerHeight;

  try {
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

    renderer.setAnimationLoop(animate);
  } catch (err) {
    isWebGLAvailable = false;
    console.warn("WebGL is unavailable or disabled. Operating in 2D product/workspace fallback mode.", err);
    if (canvas) canvas.style.display = "none";
    if (canvasVignette) canvasVignette.style.display = "none";
  }

  // Switch to initial prototype
  setPrototype(0);

  // Event Listeners
  window.addEventListener("resize", onResize);
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("touchmove", onTouchMove, { passive: true });

  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.getAttribute("data-prototype-tab"), 10);
      setPrototype(idx);
    });
  });

  if (bloomToggle) {
    bloomToggle.addEventListener("click", () => {
      if (!composerObj) return;
      composerObj.enabled = !composerObj.enabled;
      bloomToggle.classList.toggle("is-active", composerObj.enabled);
      bloomToggle.textContent = composerObj.enabled ? "BLOOM: ON" : "BLOOM: OFF";
    });
  }

  if (bloomSlider) {
    bloomSlider.addEventListener("input", (e) => {
      if (!composerObj) return;
      composerObj.bloomPass.strength = parseFloat(e.target.value);
    });
  }

  const infoToggleBtn = document.getElementById("info-toggle-btn");
  if (infoToggleBtn && infoCardPanel) {
    infoToggleBtn.addEventListener("click", () => {
      infoCardPanel.classList.toggle("is-collapsed");
      infoToggleBtn.textContent = infoCardPanel.classList.contains("is-collapsed") ? "+" : "−";
    });
  }

  // Setup interactive Food Ops BOM tabs
  setupFoodOpsInteractions();
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

  // Handle Proportional Visual Levels
  if (meta.level === "HYBRID") {
    // LEVEL B — HYBRID (Aegis)
    // 2D Forensic Investigation Workspace is primary.
    // WebGL canvas runs subtle supporting 3D evidence constellation.
    if (hybridAegisContainer) hybridAegisContainer.classList.remove("is-hidden");
    if (productFoodContainer) productFoodContainer.classList.add("is-hidden");
    if (canvas) canvas.style.display = isWebGLAvailable ? "block" : "none";
    if (canvasVignette) canvasVignette.style.display = isWebGLAvailable ? "block" : "none";
    if (hudControlsPanel) hudControlsPanel.style.display = "none";
    if (infoCardPanel) infoCardPanel.classList.add("is-hybrid-mode");

    if (isWebGLAvailable && camera && meta.factory) {
      camera.position.fromArray(meta.camPos);
      camera.lookAt(new THREE.Vector3(...meta.camLook));
      activePrototype = meta.factory(scene);
    }
  } else if (meta.level === "PRODUCT_UI") {
    // LEVEL C — NORMAL / PRODUCT UI (Sodexo Food Ops)
    // Polished enterprise operations product. Pure 2D dashboard.
    // Zero WebGL / 3D canvas rendering overhead.
    if (hybridAegisContainer) hybridAegisContainer.classList.add("is-hidden");
    if (productFoodContainer) productFoodContainer.classList.remove("is-hidden");
    if (canvas) canvas.style.display = "none";
    if (canvasVignette) canvasVignette.style.display = "none";
    if (hudControlsPanel) hudControlsPanel.style.display = "none";
    if (infoCardPanel) infoCardPanel.classList.add("is-hybrid-mode");
    activePrototype = null;
  } else {
    // LEVEL A — FULL SPATIAL / 3D (Gridium, KrushiMitra, Compressor CBM)
    // Three.js spatial engineering visualization is the primary hero.
    if (hybridAegisContainer) hybridAegisContainer.classList.add("is-hidden");
    if (productFoodContainer) productFoodContainer.classList.add("is-hidden");
    if (canvas) canvas.style.display = isWebGLAvailable ? "block" : "none";
    if (canvasVignette) canvasVignette.style.display = isWebGLAvailable ? "block" : "none";
    if (hudControlsPanel) hudControlsPanel.style.display = isWebGLAvailable ? "flex" : "none";
    if (infoCardPanel) infoCardPanel.classList.remove("is-hybrid-mode");

    if (isWebGLAvailable && camera && meta.factory) {
      camera.position.fromArray(meta.camPos);
      camera.lookAt(new THREE.Vector3(...meta.camLook));
      activePrototype = meta.factory(scene);
    }
  }

  // On small mobile viewports, auto-collapse the info panel for hybrid/product UI modes
  if (infoCardPanel) {
    const infoToggleBtn = document.getElementById("info-toggle-btn");
    if (window.innerWidth <= 820 && (meta.level === "HYBRID" || meta.level === "PRODUCT_UI")) {
      infoCardPanel.classList.add("is-collapsed");
      if (infoToggleBtn) infoToggleBtn.textContent = "+";
    } else if (window.innerWidth > 820) {
      infoCardPanel.classList.remove("is-collapsed");
      if (infoToggleBtn) infoToggleBtn.textContent = "−";
    }
  }
}

function setupFoodOpsInteractions() {
  const bomTabs = Array.from(document.querySelectorAll(".bom-tab"));
  const bomTableBody = document.querySelector("#bom-table-body tbody");
  const sectionTitle = document.querySelector(".ops-bom-engine .section-title-bar h3");

  bomTabs.forEach(tab => {
    tab.addEventListener("click", () => {
      bomTabs.forEach(t => t.classList.remove("is-active"));
      tab.classList.add("is-active");

      const dishKey = tab.getAttribute("data-dish");
      const dishInfo = bomData[dishKey];
      if (!dishInfo || !bomTableBody) return;

      if (sectionTitle) {
        sectionTitle.textContent = dishInfo.title;
      }

      bomTableBody.innerHTML = dishInfo.rows.map(r => `
        <tr>
          <td><strong>${r.name}</strong></td>
          <td>${r.spec}</td>
          <td><strong>${r.req}</strong></td>
          <td>${r.inv}</td>
          <td><span class="stock-status ${r.ok ? 'ok' : 'warning'}">${r.status}</span></td>
        </tr>
      `).join("");
    });
  });
}

function onPointerMove(e) {
  pointerNorm.x = (e.clientX / window.innerWidth) * 2 - 1;
  pointerNorm.y = -(e.clientY / window.innerHeight) * 2 + 1;

  if (camera) {
    const vec = new THREE.Vector3(pointerNorm.x, pointerNorm.y, 0.5);
    vec.unproject(camera);
    vec.sub(camera.position).normalize();
    const distance = -camera.position.z / (vec.z || 0.001);
    pointer.copy(camera.position).add(vec.multiplyScalar(distance));
  }
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
  if (camera) {
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
  if (renderer) {
    renderer.setSize(width, height, false);
  }
  if (composerObj) {
    composerObj.setSize(width, height);
  }
}

function animate(timeMs) {
  const time = timeMs * 0.001;
  const dt = Math.min((timeMs - lastFrameTime) / 1000, 0.034);
  lastFrameTime = timeMs;

  const currentMeta = prototypeMetadata[currentPrototypeIndex];

  // If on Level C (Product UI), bypass WebGL rendering loop to conserve resources
  if (currentMeta && currentMeta.level === "PRODUCT_UI") {
    return;
  }

  const speedMult = speedSlider ? parseFloat(speedSlider.value) : 1.0;

  if (activePrototype) {
    activePrototype.update(time * speedMult, pointerNorm);
  }

  if (composerObj && canvas.style.display !== "none") {
    composerObj.render(dt);
  }
}

// Start
init();
