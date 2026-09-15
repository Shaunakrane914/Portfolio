// Prototype 1: "Neural Flux & Cosmic Particle Swarm"
// Inspired by ThreeUI "Flux Vortex" & "Constellation Field"

import * as THREE from "three";
import { particleVertexShader, particleFragmentShader } from "./shaders/curlNoise.glsl.js";
import { holographicVertexShader, holographicFragmentShader } from "./shaders/holographic.glsl.js";

export function createNeuralFluxPrototype(scene) {
  const group = new THREE.Group();
  group.name = "neural-flux-prototype";

  const particleCount = 22000;
  const positions = new Float32Array(particleCount * 3);
  const phases = new Float32Array(particleCount);
  const sizes = new Float32Array(particleCount);
  const baseColors = new Float32Array(particleCount * 3);

  const paletteColors = [
    new THREE.Color(0x47e6a5), // emerald
    new THREE.Color(0x00e5ff), // cyan
    new THREE.Color(0x7596ff), // soft blue
    new THREE.Color(0xa775ff), // purple
    new THREE.Color(0xff8c42)  // orange
  ];

  for (let i = 0; i < particleCount; i++) {
    // Distribute along a dynamic toroidal swirl
    const u = Math.random();
    const v = Math.random();
    const theta = u * Math.PI * 2;
    const phi = v * Math.PI * 2;
    const majorRadius = 4.2 + (Math.random() - 0.5) * 2.8;
    const minorRadius = 1.6 + (Math.random() - 0.5) * 1.8;

    const x = (majorRadius + minorRadius * Math.cos(phi)) * Math.cos(theta);
    const y = minorRadius * Math.sin(phi) * 1.35 + (Math.random() - 0.5) * 1.4;
    const z = (majorRadius + minorRadius * Math.cos(phi)) * Math.sin(theta);

    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;

    phases[i] = Math.random() * Math.PI * 2;
    sizes[i] = 0.6 + Math.random() * 1.4;

    const col = paletteColors[Math.floor(Math.random() * paletteColors.length)];
    baseColors[i * 3] = col.r;
    baseColors[i * 3 + 1] = col.g;
    baseColors[i * 3 + 2] = col.b;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));
  geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute("aBaseColor", new THREE.BufferAttribute(baseColors, 3));

  const particleUniforms = {
    uTime: { value: 0 },
    uSpeed: { value: 0.65 },
    uPointer: { value: new THREE.Vector3(999, 999, 999) },
    uPointerRadius: { value: 3.5 },
    uPointerForce: { value: 1.4 },
    uNoiseScale: { value: 0.28 },
    uPointSize: { value: 1.4 }
  };

  const particleMaterial = new THREE.ShaderMaterial({
    vertexShader: particleVertexShader,
    fragmentShader: particleFragmentShader,
    uniforms: particleUniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });

  const particles = new THREE.Points(geometry, particleMaterial);
  group.add(particles);

  // Central Holographic Accelerator Core
  const coreGeometry = new THREE.TorusGeometry(3.6, 0.16, 32, 120);
  const coreUniforms = {
    uTime: { value: 0 },
    uWarp: { value: 0.35 },
    uColorA: { value: new THREE.Color(0x0a1f18) },
    uColorB: { value: new THREE.Color(0x133d2f) },
    uAccentColor: { value: new THREE.Color(0x47e6a5) },
    uScanlineDensity: { value: 48.0 },
    uScanlineSpeed: { value: 2.4 },
    uFresnelPower: { value: 2.4 },
    uHoloIntensity: { value: 1.6 },
    uAlpha: { value: 0.85 }
  };

  const coreMaterial = new THREE.ShaderMaterial({
    vertexShader: holographicVertexShader,
    fragmentShader: holographicFragmentShader,
    uniforms: coreUniforms,
    transparent: true,
    side: THREE.DoubleSide
  });

  const coreMesh = new THREE.Mesh(coreGeometry, coreMaterial);
  coreMesh.rotation.x = Math.PI / 2.3;
  group.add(coreMesh);

  // Counter-rotating outer gimbal rings
  const ring1 = new THREE.Mesh(
    new THREE.TorusGeometry(5.2, 0.024, 8, 96),
    new THREE.MeshBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.7 })
  );
  ring1.rotation.set(Math.PI / 2, 0.2, 0);
  const ring2 = new THREE.Mesh(
    new THREE.TorusGeometry(6.4, 0.02, 8, 96),
    new THREE.MeshBasicMaterial({ color: 0xa775ff, transparent: true, opacity: 0.45 })
  );
  ring2.rotation.set(0.4, Math.PI / 2, 0.3);
  group.add(ring1, ring2);

  scene.add(group);

  return {
    group,
    update(time, pointer) {
      particleUniforms.uTime.value = time;
      coreUniforms.uTime.value = time;

      if (pointer) {
        particleUniforms.uPointer.value.copy(pointer);
      }

      coreMesh.rotation.z = time * 0.12;
      ring1.rotation.z = time * -0.08;
      ring2.rotation.y = time * 0.06;
      group.rotation.y = time * 0.04;
    },
    setSpeed(speed) {
      particleUniforms.uSpeed.value = speed;
    },
    setPointSize(size) {
      particleUniforms.uPointSize.value = size;
    },
    destroy() {
      geometry.dispose();
      particleMaterial.dispose();
      coreGeometry.dispose();
      coreMaterial.dispose();
      scene.remove(group);
    }
  };
}
