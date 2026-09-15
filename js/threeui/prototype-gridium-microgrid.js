// Prototype 02: Gridium — Living Autonomous Energy Network
// A spatial 3D visualization of a distributed microgrid with AMM-based energy trading:
// Central glowing hypocycloid AMM torus, prosumer orbital nodes,
// bidirectional energy packet flow, solar/storage/demand color taxonomy.
// ZERO text panels. Pure living, breathing energy architecture.

import * as THREE from "three";

export function createGridiumMicrogridPrototype(scene) {
  const root = new THREE.Group();
  scene.add(root);

  // ─── SCENE LIGHTING ─────────────────────────────────────────────────
  const coreLight = new THREE.PointLight(0xff7a18, 12, 22);
  coreLight.position.set(0, 0, 0);
  root.add(coreLight);

  const solarFill = new THREE.PointLight(0x7fe4ba, 5, 28);
  solarFill.position.set(-10, 6, 0);
  root.add(solarFill);

  const loadAccent = new THREE.PointLight(0x00e5ff, 4, 22);
  loadAccent.position.set(10, -4, 0);
  root.add(loadAccent);

  // ─── 1. CENTRAL AMM LIQUIDITY CORE ──────────────────────────────────
  const ammGroup = new THREE.Group();
  root.add(ammGroup);

  // Core sphere — the constant-product market maker heart
  const ammCoreGeo = new THREE.SphereGeometry(1.1, 48, 32);
  const ammCoreMat = new THREE.MeshStandardMaterial({
    color: 0x0c0702,
    emissive: 0xff7a18,
    emissiveIntensity: 1.8,
    metalness: 0.95,
    roughness: 0.1
  });
  const ammCore = new THREE.Mesh(ammCoreGeo, ammCoreMat);
  ammGroup.add(ammCore);

  // Glowing outer rim — constant product hyperbola orbit
  const rimColors = [0xff7a18, 0x7fe4ba, 0x00e5ff, 0xffa35d];
  const rimRadii  = [1.7, 2.0, 2.35, 2.65];
  const rimTubes  = [0.04, 0.032, 0.024, 0.018];
  const rimAngles = [0, 0.45, -0.6, 0.3];
  const rims = rimRadii.map((r, i) => {
    const geo = new THREE.TorusGeometry(r, rimTubes[i], 16, 96);
    const mat = new THREE.MeshBasicMaterial({ color: rimColors[i], transparent: true, opacity: 0.85 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = rimAngles[i] * Math.PI;
    mesh.rotation.y = rimAngles[i] * 0.5;
    ammGroup.add(mesh);
    return mesh;
  });

  // Latitudinal bands for visual richness
  for (let lat = -0.3; lat <= 0.3; lat += 0.3) {
    const bGeo = new THREE.TorusGeometry(1.1, 0.01, 8, 64);
    const bMat = new THREE.MeshBasicMaterial({ color: 0xff9f43, transparent: true, opacity: 0.6 });
    const bMesh = new THREE.Mesh(bGeo, bMat);
    bMesh.rotation.x = lat * Math.PI;
    ammGroup.add(bMesh);
  }

  // ─── 2. PROSUMER MICROGRID NODES ────────────────────────────────────
  const nodeCount = 18;
  const nodes = [];
  const energyPackets = [];

  for (let i = 0; i < nodeCount; i++) {
    const angle = (i / nodeCount) * Math.PI * 2;
    const tier = i % 3;
    const tierRadius = [5.6, 7.2, 8.8][tier];
    const x = Math.cos(angle) * tierRadius;
    const z = Math.sin(angle) * tierRadius;
    const y = Math.sin(i * 1.3) * 0.9;

    // 0 = Solar Generator (emerald), 1 = Load (amber), 2 = Battery (cyan)
    const nodeType = i % 3;
    const nodeColor = [0x7fe4ba, 0xff7a18, 0x00e5ff][nodeType];

    const nGroup = new THREE.Group();
    nGroup.position.set(x, y, z);

    // Node body — hexagonal inverter tower
    const hubGeo = new THREE.CylinderGeometry(0.32, 0.38, 0.55, 6);
    const hubMat = new THREE.MeshStandardMaterial({
      color: 0x0c1418,
      metalness: 0.88,
      roughness: 0.22,
      emissive: nodeColor,
      emissiveIntensity: 0.5
    });
    nGroup.add(new THREE.Mesh(hubGeo, hubMat));

    // State of charge tower (Battery SoC indicator)
    const gaugeH = 0.45 + (i * 0.05);
    const gaugeGeo = new THREE.CylinderGeometry(0.08, 0.08, gaugeH, 12);
    gaugeGeo.translate(0, 0.28 + gaugeH * 0.5, 0);
    nGroup.add(new THREE.Mesh(gaugeGeo, new THREE.MeshBasicMaterial({ color: nodeColor })));

    // Orbital ring
    const nRingGeo = new THREE.RingGeometry(0.52, 0.57, 16);
    nRingGeo.rotateX(-Math.PI * 0.5);
    const nRing = new THREE.Mesh(nRingGeo, new THREE.MeshBasicMaterial({ color: nodeColor, side: THREE.DoubleSide, transparent: true, opacity: 0.8 }));
    nRing.position.y = 0.3;
    nGroup.add(nRing);

    // Solar panels (PV fin radiators for solar type)
    if (nodeType === 0) {
      for (let f = 0; f < 4; f++) {
        const fin = new THREE.Mesh(
          new THREE.PlaneGeometry(0.28, 0.14),
          new THREE.MeshBasicMaterial({ color: 0x7fe4ba, side: THREE.DoubleSide, transparent: true, opacity: 0.85 })
        );
        fin.position.set(0, 0.3 + gaugeH + 0.12, 0);
        fin.rotation.y = (f / 4) * Math.PI * 2;
        fin.rotation.x = 0.28;
        nGroup.add(fin);
      }
    }

    root.add(nGroup);
    nodes.push({ group: nGroup, nodeColor, nodeType, gaugeH });

    // Bezier conduit node → AMM
    const startPt = new THREE.Vector3(x, y + 0.3, z);
    const endPt   = new THREE.Vector3(0, 0, 0);
    const midPt   = startPt.clone().lerp(endPt, 0.5).add(new THREE.Vector3(0, 0.65 + (i % 3) * 0.2, 0));
    const curve   = new THREE.QuadraticBezierCurve3(startPt, midPt, endPt);

    const conduitGeo = new THREE.TubeGeometry(curve, 36, 0.018, 6, false);
    const conduitMat = new THREE.MeshBasicMaterial({ color: nodeColor, transparent: true, opacity: 0.38 });
    root.add(new THREE.Mesh(conduitGeo, conduitMat));

    // 3 packets per conduit for visual density
    for (let p = 0; p < 3; p++) {
      const pMesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.07, 8, 8),
        new THREE.MeshBasicMaterial({ color: nodeColor })
      );
      root.add(pMesh);
      const direction = nodeType === 1 ? -1 : 1; // Load draws from AMM
      energyPackets.push({
        curve,
        packet: pMesh,
        direction,
        offset: (p / 3) + Math.random() * 0.18,
        speed: 0.7 + Math.random() * 0.4
      });
    }
  }

  // ─── 3. ATMOSPHERIC POWER GRID DUST ─────────────────────────────────
  const gpCount = 360;
  const gpGeo = new THREE.BufferGeometry();
  const gpPos = new Float32Array(gpCount * 3);
  const gpCol = new Float32Array(gpCount * 3);

  for (let i = 0; i < gpCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const rad = 2.5 + Math.random() * 8.0;
    gpPos[i * 3]     = Math.cos(angle) * rad;
    gpPos[i * 3 + 1] = (Math.random() - 0.5) * 4.0;
    gpPos[i * 3 + 2] = Math.sin(angle) * rad;

    const t = Math.random();
    gpCol[i * 3]     = 0.5 + t * 0.5;
    gpCol[i * 3 + 1] = 0.5 + (1 - t) * 0.4;
    gpCol[i * 3 + 2] = 0.1;
  }
  gpGeo.setAttribute("position", new THREE.BufferAttribute(gpPos, 3));
  gpGeo.setAttribute("color", new THREE.BufferAttribute(gpCol, 3));
  const gpMat = new THREE.PointsMaterial({ size: 0.055, vertexColors: true, transparent: true, opacity: 0.65 });
  const gridParticles = new THREE.Points(gpGeo, gpMat);
  root.add(gridParticles);

  // ─── RETURN OBJECT ───────────────────────────────────────────────────
  return {
    update(time, pointerNorm) {
      // AMM core breathing pulse
      const corePulse = 1.0 + Math.sin(time * 2.4) * 0.06;
      ammCore.scale.setScalar(corePulse);
      ammCore.rotation.y += 0.012;

      // AMM bonding curve torus animation
      rims[0].rotation.z += 0.022;
      rims[1].rotation.z -= 0.018;
      rims[2].rotation.y += 0.015;
      rims[3].rotation.x += 0.01;

      // Pulsing core point light
      coreLight.intensity = 10 + Math.sin(time * 3.0) * 4;

      // Node hub spin
      nodes.forEach(({ group, nodeType }, idx) => {
        const child = group.children[0]; // hub mesh
        if (child) child.rotation.y += 0.008 * (idx % 2 === 0 ? 1 : -1);
      });

      // Energy packet flow
      energyPackets.forEach(ep => {
        let t = (time * ep.speed + ep.offset) % 1.0;
        if (ep.direction === -1) t = 1.0 - t;
        ep.packet.position.copy(ep.curve.getPoint(t));
      });

      // Atmospheric dust rotation
      gridParticles.rotation.y = time * 0.028;

      // Parallax tilt
      root.rotation.y = pointerNorm.x * 0.14;
      root.rotation.x = pointerNorm.y * 0.07;
    },
    destroy() {
      scene.remove(root);
    }
  };
}
