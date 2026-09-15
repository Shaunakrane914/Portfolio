// Prototype 01: Aegis — Cinematic Investigative Intelligence Theater
// A forensic 3D art piece: One central claim at the core of a dark space.
// Two radial arcs of evidence — emerald support vs amber/rose conflict.
// Branching fiber data conduits. Dramatic Caravaggio-style spotlight.
// ZERO text panels. Pure cinematic visual storytelling.

import * as THREE from "three";

export function createAegisArtPrototype(scene) {
  const root = new THREE.Group();
  scene.add(root);

  // ─── STAGE LIGHTING (Forensic Spotlight atmosphere) ────────────────────
  const spotlight = new THREE.SpotLight(0x9ecfff, 18, 30, Math.PI * 0.18, 0.55, 1.5);
  spotlight.position.set(0, 14, 4);
  spotlight.target.position.set(0, 0, 0);
  root.add(spotlight);
  root.add(spotlight.target);

  const rimLight = new THREE.PointLight(0x0ea5e9, 6, 20);
  rimLight.position.set(-8, 3, -4);
  root.add(rimLight);

  const warmAccent = new THREE.PointLight(0xf59e0b, 3, 12);
  warmAccent.position.set(8, -2, 2);
  root.add(warmAccent);

  // ─── 1. CLAIM CORE — Central Pulsing Icosahedron ──────────────────────
  const coreGroup = new THREE.Group();
  root.add(coreGroup);

  // Solid inner icosahedron (the "claim")
  const innerGeo = new THREE.IcosahedronGeometry(1.0, 2);
  const innerMat = new THREE.MeshStandardMaterial({
    color: 0x03111a,
    emissive: 0x0ea5e9,
    emissiveIntensity: 1.2,
    metalness: 0.95,
    roughness: 0.08
  });
  const innerCore = new THREE.Mesh(innerGeo, innerMat);
  coreGroup.add(innerCore);

  // Wireframe outer shell (uncertainty layer)
  const outerGeo = new THREE.IcosahedronGeometry(1.55, 1);
  const outerMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    wireframe: true,
    transparent: true,
    opacity: 0.35
  });
  const outerShell = new THREE.Mesh(outerGeo, outerMat);
  coreGroup.add(outerShell);

  // Three precision analysis rings (gyroscopic gimbal)
  const gimbalData = [
    { r: 2.0, tube: 0.022, col: 0x38bdf8, rotX: 0, rotY: 0 },
    { r: 2.3, tube: 0.016, col: 0x7dd3fc, rotX: Math.PI * 0.38, rotY: 0.2 },
    { r: 2.6, tube: 0.012, col: 0xbae6fd, rotX: -Math.PI * 0.55, rotY: -0.4 }
  ];
  const gimbals = gimbalData.map(d => {
    const g = new THREE.Mesh(
      new THREE.TorusGeometry(d.r, d.tube, 16, 96),
      new THREE.MeshBasicMaterial({ color: d.col, transparent: true, opacity: 0.75 })
    );
    g.rotation.x = d.rotX;
    g.rotation.y = d.rotY;
    coreGroup.add(g);
    return g;
  });

  // Vertical forensic scan sweep ring
  const scanRingGeo = new THREE.RingGeometry(1.7, 1.9, 64);
  scanRingGeo.rotateX(Math.PI * 0.5);
  const scanRingMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff, side: THREE.DoubleSide, transparent: true, opacity: 0.8 });
  const scanRing = new THREE.Mesh(scanRingGeo, scanRingMat);
  root.add(scanRing);

  // ─── 2. EVIDENCE ARCS ─────────────────────────────────────────────────
  // Left hemisphere: supporting evidence (emerald/cyan)
  // Right hemisphere: conflicting evidence (amber/rose)
  const evidenceData = [
    // SUPPORT — Left arc
    { pos: [-4.2, 2.0, -0.8],  rot: [0.18, 0.62, -0.08], col: 0x34d399, scale: [1.5, 2.0], type: "sup" },
    { pos: [-5.0, -0.6, 0.6],  rot: [-0.12, 0.78, 0.14], col: 0x10b981, scale: [1.8, 2.3], type: "sup" },
    { pos: [-3.6, -2.2, -1.2], rot: [0.28, 0.52, -0.18], col: 0x06b6d4, scale: [1.4, 1.9], type: "sup" },
    { pos: [-5.6, 1.0, 2.0],   rot: [-0.22, 0.94, 0.08], col: 0x34d399, scale: [1.3, 1.8], type: "sup" },
    // CONFLICT — Right arc
    { pos: [4.4, 2.2, -0.6],   rot: [0.18, -0.62, 0.08], col: 0xf43f5e, scale: [1.6, 2.1], type: "con" },
    { pos: [5.2, -0.4, 0.8],   rot: [-0.14, -0.82, -0.1], col: 0xfbbf24, scale: [1.9, 2.4], type: "con" },
    { pos: [3.8, -2.0, -1.0],  rot: [0.24, -0.52, 0.18], col: 0xf43f5e, scale: [1.4, 2.0], type: "con" },
    { pos: [5.4, 1.2, 1.8],    rot: [-0.24, -0.92, -0.14], col: 0xf97316, scale: [1.3, 1.7], type: "con" }
  ];

  const evidenceSheets = [];
  const fiberLines = [];

  evidenceData.forEach((spec, idx) => {
    const sheetGroup = new THREE.Group();
    sheetGroup.position.fromArray(spec.pos);
    sheetGroup.rotation.set(...spec.rot);

    // Translucent glass plate
    const plateGeo = new THREE.PlaneGeometry(spec.scale[0], spec.scale[1]);
    const plateMat = new THREE.MeshPhysicalMaterial({
      color: 0x060d12,
      emissive: spec.col,
      emissiveIntensity: 0.18,
      transparent: true,
      opacity: 0.72,
      roughness: 0.12,
      metalness: 0.15,
      transmission: 0.6,
      side: THREE.DoubleSide
    });
    sheetGroup.add(new THREE.Mesh(plateGeo, plateMat));

    // Edge border
    const borderMat = new THREE.LineBasicMaterial({ color: spec.col, transparent: true, opacity: 0.9 });
    sheetGroup.add(new THREE.LineSegments(new THREE.EdgesGeometry(plateGeo), borderMat));

    // Internal striations (redacted document lines)
    const lineCount = 6;
    for (let l = 0; l < lineCount; l++) {
      const lineY = (l / lineCount - 0.5) * spec.scale[1] * 0.7;
      const lw = spec.scale[0] * (0.3 + (l % 3) * 0.18);
      const strGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-lw * 0.5, lineY, 0.01),
        new THREE.Vector3(lw * 0.5, lineY, 0.01)
      ]);
      sheetGroup.add(new THREE.Line(strGeo, new THREE.LineBasicMaterial({ color: spec.col, transparent: true, opacity: 0.4 })));
    }

    root.add(sheetGroup);
    evidenceSheets.push({ group: sheetGroup, basePos: new THREE.Vector3(...spec.pos), id: idx });

    // Bezier fiber conduit from evidence plate to claim core
    const startPt = new THREE.Vector3(...spec.pos);
    const endPt = new THREE.Vector3(0, 0, 0);
    const midHeight = (idx % 2 === 0 ? 1.2 : -1.0);
    const midPt = startPt.clone().lerp(endPt, 0.48).add(new THREE.Vector3(0, midHeight, 0));
    const curve = new THREE.QuadraticBezierCurve3(startPt, midPt, endPt);

    // Tube conduit
    const tubeGeo = new THREE.TubeGeometry(curve, 48, 0.012, 6, false);
    const tubeMat = new THREE.MeshBasicMaterial({ color: spec.col, transparent: true, opacity: 0.28 });
    root.add(new THREE.Mesh(tubeGeo, tubeMat));

    // 3 intelligence signal pulses per conduit
    for (let p = 0; p < 3; p++) {
      const pulseMesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.055, 8, 8),
        new THREE.MeshBasicMaterial({ color: spec.col })
      );
      root.add(pulseMesh);
      fiberLines.push({
        curve,
        pulse: pulseMesh,
        speed: 0.55 + idx * 0.08 + p * 0.04,
        offset: (p / 3) + Math.random() * 0.15
      });
    }
  });

  // ─── 3. AMBIENT SIGNAL DUST ───────────────────────────────────────────
  const particleCount = 320;
  const partGeo = new THREE.BufferGeometry();
  const partPos = new Float32Array(particleCount * 3);
  const partCol = new Float32Array(particleCount * 3);

  for (let p = 0; p < particleCount; p++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(Math.random() * 2 - 1);
    const r = 4.0 + Math.random() * 6.0;

    partPos[p * 3]     = r * Math.sin(phi) * Math.cos(theta);
    partPos[p * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    partPos[p * 3 + 2] = r * Math.cos(phi);

    const isLeft = partPos[p * 3] < 0;
    partCol[p * 3]     = isLeft ? 0.13 : 0.98;
    partCol[p * 3 + 1] = isLeft ? 0.78 : 0.36;
    partCol[p * 3 + 2] = isLeft ? 0.88 : 0.18;
  }

  partGeo.setAttribute("position", new THREE.BufferAttribute(partPos, 3));
  partGeo.setAttribute("color", new THREE.BufferAttribute(partCol, 3));
  const partMat = new THREE.PointsMaterial({ size: 0.05, vertexColors: true, transparent: true, opacity: 0.6 });
  const particles = new THREE.Points(partGeo, partMat);
  root.add(particles);

  // ─── RETURN OBJECT ────────────────────────────────────────────────────
  return {
    update(time, pointerNorm) {
      // Claim core evolution
      innerCore.rotation.y = time * 0.3;
      innerCore.rotation.x = time * 0.19;
      outerShell.rotation.y = -time * 0.17;
      outerShell.rotation.z = time * 0.12;

      // Claim breathing
      const claimPulse = 1.0 + Math.sin(time * 2.2) * 0.04;
      coreGroup.scale.setScalar(claimPulse);

      // Gimbal rotation (independent axes)
      gimbals[0].rotation.z = time * 0.38;
      gimbals[1].rotation.z = -time * 0.3;
      gimbals[2].rotation.y = time * 0.22;

      // Scanning ring sweep
      scanRing.position.y = Math.sin(time * 1.6) * 2.2;

      // Evidence plate gentle levitation
      evidenceSheets.forEach(({ group, basePos }, idx) => {
        const floatY = Math.sin(time * 1.1 + idx * 0.75) * 0.12;
        group.position.y = basePos.y + floatY;
      });

      // Intelligence signal pulses streaming along fiber conduits
      fiberLines.forEach(fl => {
        const t = (time * fl.speed + fl.offset) % 1.0;
        fl.pulse.position.copy(fl.curve.getPoint(t));
      });

      // Subtle spotlight animation — forensic illumination sweep
      spotlight.position.x = Math.sin(time * 0.18) * 3.0;

      // Parallax camera tilt
      root.rotation.y = pointerNorm.x * 0.16;
      root.rotation.x = pointerNorm.y * 0.09;

      particles.rotation.y = time * 0.035;
    },
    destroy() {
      scene.remove(root);
    }
  };
}
