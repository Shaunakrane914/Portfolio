import * as THREE from '../assets/vendor/three.module.min.js';
import { mountHero } from './graphics-runtime.js?v=4.9';
import { fitModelCamera } from './model-framing.js';
const canvas = document.querySelector('.project-hero-canvas');
function initialize() {
  if (!canvas || !window.__HERO_FACTORY) return;
  try {
    const cfg = window.__HERO_CONFIG || {};
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    const scene = new THREE.Scene();
    scene.background = null;
    scene.fog = new THREE.FogExp2(cfg.bgColor ?? 0x020508, cfg.fogDensity ?? .018);
    scene.add(new THREE.HemisphereLight(0xdce8e2, 0x14201b, 1.25));
    const key = new THREE.DirectionalLight(0xffffff, 2);
    key.position.set(8,12,10); scene.add(key);
    const camera = new THREE.PerspectiveCamera(50, 1, .1, 100);
    camera.position.fromArray(cfg.camPos ?? [0,1.2,13]);
    const look = new THREE.Vector3(...(cfg.camLook ?? [0,.2,0]));
    const direction = camera.position.clone().sub(look);
    camera.lookAt(look);
    const prototype = window.__HERO_FACTORY(scene);
    mountHero({ canvas, renderer, scene, camera,
      update: (time, pointer, dt) => prototype.update(time, pointer, dt),
      resize() {
        const w = Math.max(1,canvas.clientWidth), h = Math.max(1,canvas.clientHeight);
        renderer.setSize(w,h,false); camera.aspect = w/h;
        fitModelCamera(camera, scene, direction);
      }
    });
  } catch (error) { console.warn('Hero unavailable; case-study content remains accessible.', error); }
}
requestAnimationFrame(() => requestAnimationFrame(initialize));
