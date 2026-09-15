// Prototype 3: "Living Quantum Energy Microgrid" (Gridium Concept)
// Inspired by ThreeUI "Structure Flow" & "Liquid Noise Deck"

import * as THREE from "three";
import { voronoiDeckVertexShader, voronoiDeckFragmentShader, veinVertexShader, veinFragmentShader } from "./shaders/flowVeins.glsl.js";
import { holographicVertexShader, holographicFragmentShader } from "./shaders/holographic.glsl.js";

export function createGridQuantumPrototype(scene) {
  const group = new THREE.Group();
  group.name = "grid-quantum-prototype";

  // 1. Hexagonal Quantum Power Deck with Voronoi Shader
  const deckRadius = 5.2;
  const deckGeo = new THREE.CylinderGeometry(deckRadius, deckRadius + 0.35, 0.42, 6);
  
  const deckUniforms = {
    uTime: { value: 0 },
    uColorA: { value: new THREE.Color(0x0a1618) },
    uColorB: { value: new THREE.Color(0x132a24) },
    uGlowColor: { value: new THREE.Color(0x47e6a5) }
  };

  const deckMat = new THREE.ShaderMaterial({
    vertexShader: voronoiDeckVertexShader,
    fragmentShader: voronoiDeckFragmentShader,
    uniforms: deckUniforms
  });

  const deckMesh = new THREE.Mesh(deckGeo, deckMat);
  deckMesh.position.y = -1.2;
  group.add(deckMesh);

  // Deck edge wireframe border
  const deckEdges = new THREE.LineSegments(
    new THREE.EdgesGeometry(deckGeo),
    new THREE.LineBasicMaterial({ color: 0x47e6a5, transparent: true, opacity: 0.65 })
  );
  deckEdges.position.y = -1.2;
  group.add(deckEdges);

  // 2. Central Liquidity Energy Pool
  const poolGroup = new THREE.Group();
  poolGroup.position.set(0, -0.6, 0);

  const tankGeo = new THREE.CylinderGeometry(1.2, 1.2, 1.4, 32);
  const tankMat = new THREE.MeshPhysicalMaterial({
    color: 0x47e6a5,
    roughness: 0.05,
    metalness: 0.1,
    transmission: 0.7,
    thickness: 0.8,
    transparent: true,
    opacity: 0.4,
    ior: 1.5
  });
  const tank = new THREE.Mesh(tankGeo, tankMat);
  poolGroup.add(tank);

  // Glowing Quantum Core inside the tank
  const quantumCoreGeo = new THREE.OctahedronGeometry(0.55, 2);
  const quantumCoreMat = new THREE.MeshPhysicalMaterial({
    color: 0x00e5ff,
    emissive: 0x00e5ff,
    emissiveIntensity: 0.8,
    roughness: 0.1,
    metalness: 0.9
  });
  const quantumCore = new THREE.Mesh(quantumCoreGeo, quantumCoreMat);
  poolGroup.add(quantumCore);

  // Concentric Energy Pulse Rings
  const pulseRings = [];
  [1.4, 2.0, 2.8].forEach((r, i) => {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(r, 0.02, 6, 64),
      new THREE.MeshBasicMaterial({
        color: i % 2 ? 0xffb84d : 0x47e6a5,
        transparent: true,
        opacity: 0.75
      })
    );
    ring.rotation.x = Math.PI / 2;
    pulseRings.push({ mesh: ring, baseScale: r, speed: 0.8 + i * 0.4 });
    poolGroup.add(ring);
  });

  group.add(poolGroup);

  // 3. 15 Microgrid Nodes with Dynamic Vein Conduits
  const nodeCoords = [
    [-3.4, -2.0], [-1.8, -2.8], [0.1, -3.2], [1.9, -2.7], [3.5, -1.8],
    [-3.2, 0.2], [-1.6, -0.6], [1.7, -0.5], [3.3, 0.3],
    [-2.6, 1.9], [-0.8, 1.4], [1.0, 1.5], [2.6, 1.9], [-0.1, 3.1]
  ];

  const nodeMeshes = [];
  const veinMeshes = [];

  nodeCoords.forEach(([x, z], idx) => {
    const node = new THREE.Group();
    node.position.set(x, -0.9, z);

    const isSolar = idx % 3 === 0;
    const isBattery = idx % 3 === 1;
    const color = isSolar ? 0xffb84d : isBattery ? 0x47e6a5 : 0x00e5ff;

    // Node Plinth
    const plinth = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32, 0.38, 0.22, 16),
      new THREE.MeshPhysicalMaterial({ color: 0x1a2624, roughness: 0.2, metalness: 0.8 })
    );
    node.add(plinth);

    // Floating Sensor Hologram
    const beaconGeo = new THREE.BoxGeometry(0.24, 0.45, 0.24);
    const beaconMat = new THREE.MeshPhysicalMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.75,
      roughness: 0.2,
      metalness: 0.5
    });
    const beacon = new THREE.Mesh(beaconGeo, beaconMat);
    beacon.position.y = 0.38;
    node.add(beacon);

    node.userData = { beacon, phase: idx * 0.7 };
    nodeMeshes.push(node);
    group.add(node);

    // Flow Conduit connecting Node to Central Pool
    const start = new THREE.Vector3(x, -0.85, z);
    const end = new THREE.Vector3(0, -0.5, 0);
    const mid = start.clone().lerp(end, 0.5);
    mid.y += 0.45 + (idx % 3) * 0.12;

    const curve = new THREE.CatmullRomCurve3([start, mid, end]);
    const tubeGeo = new THREE.TubeGeometry(curve, 32, 0.018, 6, false);

    const tubeUniforms = {
      uTime: { value: 0 },
      uBaseColor: { value: new THREE.Color(color) },
      uPulseColor: { value: new THREE.Color(0xffffff) },
      uSpeed: { value: 1.2 + (idx % 4) * 0.25 },
      uFrequency: { value: 2.5 },
      uPulseLength: { value: 0.4 },
      uIntensity: { value: 2.2 }
    };

    const tubeMat = new THREE.ShaderMaterial({
      vertexShader: veinVertexShader,
      fragmentShader: veinFragmentShader,
      uniforms: tubeUniforms,
      transparent: true,
      blending: THREE.AdditiveBlending
    });

    const tubeMesh = new THREE.Mesh(tubeGeo, tubeMat);
    veinMeshes.push({ mesh: tubeMesh, uniforms: tubeUniforms });
    group.add(tubeMesh);
  });

  group.rotation.x = 0.38;
  scene.add(group);

  return {
    group,
    update(time, pointer) {
      deckUniforms.uTime.value = time;
      veinMeshes.forEach((v) => {
        v.uniforms.uTime.value = time;
      });

      // Animate central pool core
      quantumCore.rotation.y = time * 1.5;
      quantumCore.rotation.x = time * 0.9;
      quantumCore.position.y = Math.sin(time * 2.0) * 0.08;

      // Animate pulse rings
      pulseRings.forEach((pr, i) => {
        const s = 1.0 + Math.sin(time * pr.speed + i) * 0.12;
        pr.mesh.scale.set(s, s, 1);
        pr.mesh.rotation.z = time * 0.4 * (i % 2 ? -1 : 1);
      });

      // Animate node beacons
      nodeMeshes.forEach((n) => {
        n.userData.beacon.rotation.y = time * 2.0 + n.userData.phase;
        n.userData.beacon.position.y = 0.38 + Math.sin(time * 2.4 + n.userData.phase) * 0.05;
      });

      if (pointer) {
        group.rotation.y = time * 0.08 + pointer.x * 0.28;
        group.rotation.x = 0.38 - pointer.y * 0.2;
      } else {
        group.rotation.y = time * 0.08;
      }
    },
    destroy() {
      deckGeo.dispose();
      deckMat.dispose();
      scene.remove(group);
    }
  };
}
