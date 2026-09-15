// Prototype 05: Food Operations — Supply Chain Molecular Network
// A 3D abstract supply-chain molecule visualization:
// Central "kitchen" nucleus, orbital supplier nodes connected by flowing conduits,
// batched ingredient token clusters orbiting the assembly hub,
// and a procedural demand wave ripple surface below.
// Extremely clean and restrained. NO futuristic clutter. NO text panels.

import * as THREE from "three";

export function createFoodFlowPrototype(scene) {
  const root = new THREE.Group();
  scene.add(root);

  // ─── SCENE LIGHTING ─────────────────────────────────────────────────
  const coreLight = new THREE.PointLight(0x10b981, 10, 20);
  coreLight.position.set(0, 0, 0);
  root.add(coreLight);

  const warmLight = new THREE.PointLight(0xf59e0b, 5, 18);
  warmLight.position.set(6, 4, 2);
  root.add(warmLight);

  const coolLight = new THREE.PointLight(0x38bdf8, 4, 18);
  coolLight.position.set(-6, -2, 3);
  root.add(coolLight);

  // ─── 1. CENTRAL NUCLEUS (Assembly Hub / Kitchen) ─────────────────────
  const nucleus = new THREE.Group();
  root.add(nucleus);

  // Inner core sphere
  const coreGeo = new THREE.SphereGeometry(0.85, 48, 36);
  const coreMat = new THREE.MeshStandardMaterial({
    color: 0x041108,
    emissive: 0x10b981,
    emissiveIntensity: 1.4,
    metalness: 0.92,
    roughness: 0.1
  });
  const coreHub = new THREE.Mesh(coreGeo, coreMat);
  nucleus.add(coreHub);

  // Outer translucent shell (inventory layer)
  const shellGeo = new THREE.SphereGeometry(1.3, 32, 24);
  const shellMat = new THREE.MeshPhysicalMaterial({
    color: 0x041108,
    emissive: 0x10b981,
    emissiveIntensity: 0.2,
    metalness: 0.3,
    roughness: 0.1,
    transmission: 0.75,
    transparent: true,
    opacity: 0.45,
    wireframe: false
  });
  nucleus.add(new THREE.Mesh(shellGeo, shellMat));

  // 3 Precision orbital assembly rings
  const ringData = [
    { r: 1.85, tube: 0.025, col: 0x10b981, rotX: 0 },
    { r: 2.1,  tube: 0.018, col: 0x38bdf8, rotX: Math.PI * 0.5 },
    { r: 2.35, tube: 0.013, col: 0xf59e0b, rotX: Math.PI * 0.28 }
  ];
  const assemblyRings = ringData.map(d => {
    const mesh = new THREE.Mesh(
      new THREE.TorusGeometry(d.r, d.tube, 16, 80),
      new THREE.MeshBasicMaterial({ color: d.col, transparent: true, opacity: 0.8 })
    );
    mesh.rotation.x = d.rotX;
    nucleus.add(mesh);
    return mesh;
  });

  // ─── 2. SUPPLIER / SOURCE NODES ───────────────────────────────────────
  // 8 suppliers in radial arrangement: Grains, Dairy, Produce, Protein,
  //                                    Spices, Beverages, Frozen, Packaging
  const supplierConfig = [
    { col: 0x10b981, name: "grain" },    // emerald — grains
    { col: 0xf59e0b, name: "dairy" },    // amber  — dairy
    { col: 0x38bdf8, name: "produce" },  // sky    — fresh produce
    { col: 0xf43f5e, name: "protein" },  // rose   — protein
    { col: 0xa855f7, name: "spice" },    // violet — spices
    { col: 0xfbbf24, name: "bev" },      // yellow — beverages
    { col: 0x06b6d4, name: "frozen" },   // cyan   — frozen goods
    { col: 0xc084fc, name: "pack" }      // lilac  — packaging
  ];

  const supplierNodes = [];
  const conduitCurves = [];
  const tokenMeshes = [];

  supplierConfig.forEach((sup, i) => {
    const angle = (i / supplierConfig.length) * Math.PI * 2;
    const r = 5.8 + (i % 2) * 1.4;  // alternating inner/outer orbit
    const x = Math.cos(angle) * r;
    const z = Math.sin(angle) * r;
    const y = Math.sin(i * 0.95) * 1.2;

    const nGroup = new THREE.Group();
    nGroup.position.set(x, y, z);

    // Node body — icosahedron (natural/organic feel)
    const nGeo = new THREE.IcosahedronGeometry(0.42, 0);
    const nMat = new THREE.MeshStandardMaterial({
      color: 0x060d0a,
      emissive: sup.col,
      emissiveIntensity: 0.9,
      metalness: 0.7,
      roughness: 0.25
    });
    nGroup.add(new THREE.Mesh(nGeo, nMat));

    // Orbital ring around supplier
    const sRingGeo = new THREE.RingGeometry(0.58, 0.64, 20);
    sRingGeo.rotateX(-Math.PI * 0.5);
    nGroup.add(new THREE.Mesh(sRingGeo, new THREE.MeshBasicMaterial({
      color: sup.col,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.72
    })));

    root.add(nGroup);
    supplierNodes.push({ group: nGroup, basePos: new THREE.Vector3(x, y, z), col: sup.col, idx: i });

    // Bezier conduit: supplier → nucleus
    const startPt = new THREE.Vector3(x, y, z);
    const endPt   = new THREE.Vector3(0, 0, 0);
    const lift    = (i % 2 === 0 ? 1.5 : -1.2);
    const midPt   = startPt.clone().lerp(endPt, 0.45).add(new THREE.Vector3(0, lift, 0));
    const curve   = new THREE.QuadraticBezierCurve3(startPt, midPt, endPt);

    const conduitGeo = new THREE.TubeGeometry(curve, 40, 0.014, 6, false);
    root.add(new THREE.Mesh(conduitGeo, new THREE.MeshBasicMaterial({ color: sup.col, transparent: true, opacity: 0.3 })));
    conduitCurves.push(curve);

    // 4 Ingredient tokens flowing in clusters along each conduit
    for (let t = 0; t < 4; t++) {
      const tMesh = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.07, 0),
        new THREE.MeshStandardMaterial({
          color: sup.col,
          emissive: sup.col,
          emissiveIntensity: 0.5,
          metalness: 0.6,
          roughness: 0.3
        })
      );
      root.add(tMesh);
      tokenMeshes.push({
        mesh: tMesh,
        curve,
        offset: (t / 4) + Math.random() * 0.06,
        speed: 0.42 + i * 0.024 + t * 0.01
      });
    }
  });

  // ─── 3. DEMAND WAVE FLOOR ─────────────────────────────────────────────
  // A minimal ripple surface below suggesting demand pulses
  const floorGeo = new THREE.PlaneGeometry(24.0, 18.0, 80, 60);
  floorGeo.rotateX(-Math.PI * 0.5);
  floorGeo.translate(0, -3.8, 0);

  const floorUniforms = {
    uTime:  { value: 0 },
    uColor: { value: new THREE.Color(0x10b981) }
  };

  const floorMat = new THREE.ShaderMaterial({
    uniforms: floorUniforms,
    vertexShader: /* glsl */ `
      uniform float uTime;
      varying float vWave;
      void main() {
        vec3 pos = position;
        float r = length(pos.xz);
        float wave = sin(r * 1.2 - uTime * 2.2) * exp(-r * 0.14) * 0.38;
        pos.y += wave;
        vWave = wave;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      varying float vWave;
      void main() {
        float intensity = clamp(vWave * 2.8 + 0.04, 0.0, 0.65);
        gl_FragColor = vec4(uColor * intensity, intensity * 0.55);
      }
    `,
    transparent: true,
    side: THREE.DoubleSide
  });

  const floorMesh = new THREE.Mesh(floorGeo, floorMat);
  root.add(floorMesh);

  // Floor grid overlay
  root.add(new THREE.Mesh(
    floorGeo,
    new THREE.MeshBasicMaterial({ color: 0x10b981, wireframe: true, transparent: true, opacity: 0.06 })
  ));

  // ─── 4. AMBIENT SUPPLY DUST ───────────────────────────────────────────
  const dustCount = 200;
  const dustGeo = new THREE.BufferGeometry();
  const dustPos = new Float32Array(dustCount * 3);
  const dustCol = new Float32Array(dustCount * 3);

  for (let d = 0; d < dustCount; d++) {
    const theta = Math.random() * Math.PI * 2;
    const r = 3.0 + Math.random() * 7.5;
    dustPos[d * 3]     = Math.cos(theta) * r;
    dustPos[d * 3 + 1] = (Math.random() - 0.5) * 6.0;
    dustPos[d * 3 + 2] = Math.sin(theta) * r;

    // Random supplier palette color
    const sc = supplierConfig[Math.floor(Math.random() * supplierConfig.length)];
    const c = new THREE.Color(sc.col);
    dustCol[d * 3]     = c.r;
    dustCol[d * 3 + 1] = c.g;
    dustCol[d * 3 + 2] = c.b;
  }
  dustGeo.setAttribute("position", new THREE.BufferAttribute(dustPos, 3));
  dustGeo.setAttribute("color", new THREE.BufferAttribute(dustCol, 3));
  const dustPts = new THREE.Points(dustGeo, new THREE.PointsMaterial({ size: 0.048, vertexColors: true, transparent: true, opacity: 0.55 }));
  root.add(dustPts);

  // ─── RETURN OBJECT ───────────────────────────────────────────────────
  return {
    update(time, pointerNorm) {
      floorUniforms.uTime.value = time;

      // Nucleus core pulsing
      const pulse = 1.0 + Math.sin(time * 2.6) * 0.05;
      coreHub.scale.setScalar(pulse);
      coreHub.rotation.y = time * 0.22;

      // Core light breathing
      coreLight.intensity = 8 + Math.sin(time * 3.0) * 4;

      // Assembly rings rotate independently
      assemblyRings[0].rotation.z = time * 0.32;
      assemblyRings[1].rotation.z = -time * 0.25;
      assemblyRings[2].rotation.y = time * 0.19;

      // Supplier nodes gentle float + spin
      supplierNodes.forEach(({ group, basePos }, idx) => {
        const floatY = Math.sin(time * 1.0 + idx * 0.8) * 0.14;
        group.position.y = basePos.y + floatY;
        group.rotation.y = time * 0.18 * (idx % 2 === 0 ? 1 : -1);
      });

      // Token flow along conduits
      tokenMeshes.forEach(t => {
        const progress = ((time * t.speed + t.offset) % 1.0);
        t.mesh.position.copy(t.curve.getPoint(progress));
        t.mesh.rotation.x = time * 2.0;
        t.mesh.rotation.z = time * 1.4;
      });

      // Ambient dust slow rotation
      dustPts.rotation.y = time * 0.025;

      // Parallax tilt
      root.rotation.y = pointerNorm.x * 0.12;
      root.rotation.x = pointerNorm.y * 0.06;
    },
    destroy() {
      scene.remove(root);
    }
  };
}
