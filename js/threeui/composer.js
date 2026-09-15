// Post-processing EffectComposer with UnrealBloomPass
// Configured for ThreeUI-style high dynamic range emissives and neon bloom

import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";

export function createBloomComposer(renderer, scene, camera, width, height) {
  const renderTarget = new THREE.WebGLRenderTarget(width, height, {
    type: THREE.HalfFloatType,
    format: THREE.RGBAFormat,
    colorSpace: THREE.SRGBColorSpace,
    samples: 4
  });

  const composer = new EffectComposer(renderer, renderTarget);
  composer.setSize(width, height);

  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  // UnrealBloomPass parameters tuned for selective cybernetic glow
  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(width, height),
    0.55,  // strength
    0.35,  // radius
    0.70   // threshold (selective bloom for neon highlights)
  );
  bloomPass.renderToScreen = true;
  composer.addPass(bloomPass);

  return {
    composer,
    bloomPass,
    enabled: true,
    setSize(w, h) {
      composer.setSize(w, h);
      bloomPass.resolution.set(w, h);
    },
    setBloom(strength, radius, threshold) {
      bloomPass.strength = strength;
      bloomPass.radius = radius;
      bloomPass.threshold = threshold;
    },
    render(deltaTime) {
      if (this.enabled) {
        composer.render(deltaTime);
      } else {
        renderer.render(scene, camera);
      }
    }
  };
}
