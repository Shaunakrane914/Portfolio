// project-hero-renderer.js
// Shared hero renderer for project pages.
// Mounts a ThreeUI prototype art module into the `.project-hero-canvas`,
// with bloom post-processing, pointer parallax, and graceful resize.
// Usage: loaded as a module by each project page that uses a ThreeUI prototype.
//
// The calling script sets window.__HERO_FACTORY before loading this module,
// and window.__HERO_CONFIG = { bgColor, fogDensity, camPos, camLook }

import * as THREE from "../assets/vendor/three.module.min.js";
import { EffectComposer } from "../assets/vendor/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "../assets/vendor/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "../assets/vendor/addons/postprocessing/UnrealBloomPass.js";

const canvas = document.querySelector(".project-hero-canvas");
if (!canvas || !window.__HERO_FACTORY) {
  console.warn("[hero-renderer] No canvas or factory found — skipping.");
} else {
  const cfg = window.__HERO_CONFIG || {};
  const bgColor    = cfg.bgColor    ?? 0x020508;
  const fogDensity = cfg.fogDensity ?? 0.018;
  const camPos     = cfg.camPos     ?? [0, 1.2, 13.0];
  const camLook    = cfg.camLook    ?? [0, 0.2, 0];
  const bloomStr   = cfg.bloomStr   ?? 0.55;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const coarsePointer = window.matchMedia("(pointer: coarse)").matches;

  // ── Renderer ────────────────────────────────────────────────────────────
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: "high-performance"
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, coarsePointer ? 1.3 : 1.8));

  // ── Scene ────────────────────────────────────────────────────────────────
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(bgColor);
  scene.fog = new THREE.FogExp2(bgColor, fogDensity);

  // Shared base lighting (each prototype adds its own key/accent lights)
  scene.add(new THREE.AmbientLight(0x1a2630, 1.2));
  const keyLight = new THREE.DirectionalLight(0xffffff, 2.0);
  keyLight.position.set(8, 12, 10);
  scene.add(keyLight);

  // ── Camera ───────────────────────────────────────────────────────────────
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
  camera.position.fromArray(camPos);
  camera.lookAt(new THREE.Vector3(...camLook));

  // ── Size management ───────────────────────────────────────────────────────
  function resize() {
    const w = canvas.clientWidth  || canvas.offsetWidth  || window.innerWidth;
    const h = canvas.clientHeight || canvas.offsetHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    composer.setSize(w, h);
    bloomPass.resolution.set(w, h);
  }

  // ── Bloom Post-processing ────────────────────────────────────────────────
  const rt = new THREE.WebGLRenderTarget(800, 600, {
    type: THREE.HalfFloatType,
    format: THREE.RGBAFormat,
    samples: 4
  });
  const composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  const bloomPass = new UnrealBloomPass(new THREE.Vector2(800, 600), bloomStr, 0.35, 0.72);
  bloomPass.renderToScreen = true;
  composer.addPass(bloomPass);

  // ── Prototype ─────────────────────────────────────────────────────────────
  const proto = window.__HERO_FACTORY(scene);

  // ── Pointer tracking ─────────────────────────────────────────────────────
  const pointer = new THREE.Vector2(0, 0);
  window.addEventListener("pointermove", e => {
    pointer.x =  (e.clientX / window.innerWidth)  * 2 - 1;
    pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
  });
  window.addEventListener("touchmove", e => {
    if (e.touches.length > 0) {
      pointer.x =  (e.touches[0].clientX / window.innerWidth)  * 2 - 1;
      pointer.y = -(e.touches[0].clientY / window.innerHeight) * 2 + 1;
    }
  }, { passive: true });

  // ── Resize observer ───────────────────────────────────────────────────────
  if (typeof ResizeObserver !== "undefined") {
    new ResizeObserver(resize).observe(canvas);
  } else {
    window.addEventListener("resize", resize);
  }
  resize();

  // ── Animation loop ────────────────────────────────────────────────────────
  if (!reduceMotion) {
    renderer.setAnimationLoop(timeMs => {
      const t = timeMs * 0.001;
      proto.update(t, pointer);
      composer.render();
    });
  } else {
    // Single static frame for reduced-motion users
    proto.update(0, pointer);
    composer.render();
  }
}
