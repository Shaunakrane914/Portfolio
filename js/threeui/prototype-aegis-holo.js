// Prototype 2: "Holographic Cybernetic Agent Network" (Aegis Concept)
// Inspired by ThreeUI "Holographic Card" & "Signal Particles"

import * as THREE from "three";
import { holographicVertexShader, holographicFragmentShader } from "./shaders/holographic.glsl.js";
import { veinVertexShader, veinFragmentShader } from "./shaders/flowVeins.glsl.js";

export function createAegisHoloPrototype(scene) {
  const group = new THREE.Group();
  group.name = "aegis-holo-prototype";

  // 1. Holographic Claim Dossier Card
  const cardGeometry = new THREE.PlaneGeometry(3.6, 2.4, 32, 32);
  const cardUniforms = {
    uTime: { value: 0 },
    uWarp: { value: 0.2 },
    uColorA: { value: new THREE.Color(0x061224) },
    uColorB: { value: new THREE.Color(0x102844) },
    uAccentColor: { value: new THREE.Color(0x00e5ff) },
    uScanlineDensity: { value: 64.0 },
    uScanlineSpeed: { value: 1.8 },
    uFresnelPower: { value: 2.2 },
    uHoloIntensity: { value: 1.8 },
    uAlpha: { value: 0.88 }
  };

  const cardMaterial = new THREE.ShaderMaterial({
    vertexShader: holographicVertexShader,
    fragmentShader: holographicFragmentShader,
    uniforms: cardUniforms,
    transparent: true,
    side: THREE.DoubleSide
  });

  const dossierCard = new THREE.Mesh(cardGeometry, cardMaterial);
  dossierCard.position.set(-3.2, 0.4, 0);
  dossierCard.rotation.y = 0.22;
  group.add(dossierCard);

  // Holographic Frame Border
  const frameGeometry = new THREE.EdgesGeometry(new THREE.BoxGeometry(3.64, 2.44, 0.08));
  const frameMaterial = new THREE.LineBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.75 });
  const cardFrame = new THREE.LineSegments(frameGeometry, frameMaterial);
  dossierCard.add(cardFrame);

  // 2. Floating Agent Stations
  const agentConfigs = [
    { name: "TREND", color: 0xff8c42, pos: [-0.6, 1.6, 0.4] },
    { name: "SCOUT", color: 0xa775ff, pos: [1.6, 1.6, -0.3] },
    { name: "WATCH", color: 0x00e5ff, pos: [-0.6, -1.2, 0.5] },
    { name: "SHIELD", color: 0x47e6a5, pos: [1.6, -1.2, -0.2] }
  ];

  const agentMeshes = [];
  const laserCurves = [];

  agentConfigs.forEach((cfg, idx) => {
    const station = new THREE.Group();
    station.position.set(...cfg.pos);

    // Holographic Octahedron Sensor Core
    const sensorGeo = new THREE.OctahedronGeometry(0.48, 0);
    const sensorMat = new THREE.MeshPhysicalMaterial({
      color: cfg.color,
      roughness: 0.2,
      metalness: 0.6,
      emissive: cfg.color,
      emissiveIntensity: 0.72,
      clearcoat: 0.8,
      transparent: true,
      opacity: 0.92
    });
    const sensor = new THREE.Mesh(sensorGeo, sensorMat);
    station.add(sensor);

    // Orbiting HUD Ring
    const ringGeo = new THREE.TorusGeometry(0.78, 0.016, 6, 64);
    const ringMat = new THREE.MeshBasicMaterial({ color: cfg.color, transparent: true, opacity: 0.85 });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2.5;
    station.add(ring);

    station.userData = { sensor, ring, basePos: new THREE.Vector3(...cfg.pos), phase: idx * 1.2 };
    agentMeshes.push(station);
    group.add(station);

    // 3. Laser Conduit from Dossier to Station
    const curvePoints = [
      new THREE.Vector3(-1.4, 0.4 + (idx - 1.5) * 0.4, 0),
      new THREE.Vector3(-0.2, cfg.pos[1] * 0.7, cfg.pos[2] * 0.5),
      new THREE.Vector3(...cfg.pos)
    ];
    const curve = new THREE.CatmullRomCurve3(curvePoints);
    const tubeGeo = new THREE.TubeGeometry(curve, 48, 0.024, 8, false);

    const tubeUniforms = {
      uTime: { value: 0 },
      uBaseColor: { value: new THREE.Color(cfg.color) },
      uPulseColor: { value: new THREE.Color(0xffffff) },
      uSpeed: { value: 1.4 },
      uFrequency: { value: 3.0 },
      uPulseLength: { value: 0.35 },
      uIntensity: { value: 2.5 }
    };

    const tubeMat = new THREE.ShaderMaterial({
      vertexShader: veinVertexShader,
      fragmentShader: veinFragmentShader,
      uniforms: tubeUniforms,
      transparent: true,
      blending: THREE.AdditiveBlending
    });

    const tubeMesh = new THREE.Mesh(tubeGeo, tubeMat);
    laserCurves.push({ mesh: tubeMesh, uniforms: tubeUniforms });
    group.add(tubeMesh);
  });

  // 4. Central Verdict Core on the right
  const verdictGroup = new THREE.Group();
  verdictGroup.position.set(3.8, 0.1, 0);

  const verdictCoreGeo = new THREE.IcosahedronGeometry(0.85, 2);
  const verdictCoreMat = new THREE.MeshPhysicalMaterial({
    color: 0x47e6a5,
    roughness: 0.18,
    metalness: 0.7,
    emissive: 0x47e6a5,
    emissiveIntensity: 0.65,
    transmission: 0.4,
    opacity: 0.95
  });
  const verdictCore = new THREE.Mesh(verdictCoreGeo, verdictCoreMat);
  verdictGroup.add(verdictCore);

  // Multi-tier Verdict Rings
  [1.25, 1.7, 2.15].forEach((radius, i) => {
    const vRing = new THREE.Mesh(
      new THREE.TorusGeometry(radius, 0.02, 6, 80),
      new THREE.MeshBasicMaterial({
        color: [0x47e6a5, 0x00e5ff, 0xa775ff][i],
        transparent: true,
        opacity: 0.7
      })
    );
    vRing.rotation.set(i * 0.4, i * 0.6, 0);
    verdictGroup.add(vRing);
  });

  group.add(verdictGroup);
  scene.add(group);

  return {
    group,
    update(time, pointer) {
      cardUniforms.uTime.value = time;
      laserCurves.forEach((lc) => {
        lc.uniforms.uTime.value = time;
      });

      // Float dossier gently
      dossierCard.position.y = 0.4 + Math.sin(time * 1.1) * 0.06;
      dossierCard.rotation.x = Math.sin(time * 0.8) * 0.04;

      // Animate agent stations
      agentMeshes.forEach((st) => {
        st.position.y = st.userData.basePos.y + Math.sin(time * 1.6 + st.userData.phase) * 0.08;
        st.userData.sensor.rotation.y = time * 1.2;
        st.userData.sensor.rotation.x = time * 0.8;
        st.userData.ring.rotation.z = time * 1.4;
      });

      // Animate verdict core
      verdictCore.rotation.y = time * 0.6;
      verdictCore.rotation.z = time * 0.4;
      verdictGroup.position.y = 0.1 + Math.sin(time * 1.4) * 0.08;

      if (pointer) {
        group.rotation.y = pointer.x * 0.2;
        group.rotation.x = -pointer.y * 0.15;
      }
    },
    destroy() {
      cardGeometry.dispose();
      cardMaterial.dispose();
      scene.remove(group);
    }
  };
}
