// Prototype 04: KrushiMitra — Geospatial Agricultural Intelligence World
// A stylized precision agriculture art piece:
// NDVI false-color terrain with terraced field segmentation,
// autonomous LiDAR survey drone with interactive scan cone,
// cadastral farm boundaries, and atmospheric rainfall particles.
// ZERO text panels. Pure cinematic geospatial art.

import * as THREE from "three";

export function createCropNdviPrototype(scene) {
  const root = new THREE.Group();
  scene.add(root);

  // ─── SCENE LIGHTING ─────────────────────────────────────────────────
  const sunLight = new THREE.DirectionalLight(0xfff4d6, 3.5);
  sunLight.position.set(8, 15, 5);
  sunLight.target.position.set(0, -2, 0);
  root.add(sunLight);
  root.add(sunLight.target);

  const skyFill = new THREE.HemisphereLight(0x87ceeb, 0x3a5a2a, 1.2);
  root.add(skyFill);

  const droneLight = new THREE.PointLight(0xd946ef, 8, 16);
  droneLight.position.set(0, 4, 0);
  root.add(droneLight);

  // ─── 1. NDVI TERRAIN MESH ─────────────────────────────────────────
  const terrX = 140;
  const terrZ = 100;
  const terrainGeo = new THREE.PlaneGeometry(20.0, 15.0, terrX - 1, terrZ - 1);
  terrainGeo.rotateX(-Math.PI * 0.5);
  terrainGeo.translate(0, -2.4, 0);

  const terrainUniforms = {
    uTime:        { value: 0 },
    uScanPos:     { value: new THREE.Vector2(0, 0) },
    uColorArid:   { value: new THREE.Color(0xa05c1a) },  // Drought ochre
    uColorCrop:   { value: new THREE.Color(0x7dba3c) },  // Developing crop
    uColorVigor:  { value: new THREE.Color(0x0d9e5c) },  // Peak photosynthesis
    uColorLaser:  { value: new THREE.Color(0xe040ef) }   // LiDAR scan ring
  };

  const terrainMat = new THREE.ShaderMaterial({
    uniforms: terrainUniforms,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying float vNdvi;
      varying vec3 vWorldPos;
      uniform float uTime;

      float getElevation(vec2 c) {
        float hills   = sin(c.x * 2.1) * cos(c.y * 1.9) * 1.4;
        float valley  = -exp(-pow((c.x - 0.2) * 3.0, 2.0)) * 0.85;
        float raw     = hills + valley;
        // Terraced quantization
        return floor(raw * 5.5) * 0.18 + fract(raw * 5.5) * 0.04;
      }

      void main() {
        vUv = uv;
        vec3 pos = position;

        float elev = getElevation(uv * 3.14159);
        pos.y += elev;

        // NDVI moisture wave (crops growing in valleys)
        float moisture = sin(uv.y * 15.0 - uTime * 1.6) * 0.11;
        vNdvi = clamp(0.55 - elev * 0.25 + moisture, 0.05, 0.98);

        vec4 worldPos = modelMatrix * vec4(pos, 1.0);
        vWorldPos = worldPos.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      varying float vNdvi;
      varying vec3 vWorldPos;
      uniform vec2 uScanPos;
      uniform vec3 uColorArid;
      uniform vec3 uColorCrop;
      uniform vec3 uColorVigor;
      uniform vec3 uColorLaser;

      void main() {
        // NDVI false-color gradient
        vec3 col;
        if (vNdvi < 0.42) {
          col = mix(uColorArid, uColorCrop, vNdvi / 0.42);
        } else {
          col = mix(uColorCrop, uColorVigor, (vNdvi - 0.42) / 0.58);
        }

        // Cadastral field grid lines
        float plotX = step(0.965, fract(vUv.x * 22.0));
        float plotZ = step(0.965, fract(vUv.y * 16.0));
        col += vec3(max(plotX, plotZ)) * uColorVigor * 0.4;

        // LiDAR scan ring from drone position
        float distScan = length(vWorldPos.xz - uScanPos);
        float ring1 = smoothstep(0.5, 0.0, abs(distScan - 2.2)) * 0.9;
        float ring2 = smoothstep(0.4, 0.0, abs(distScan - 3.6)) * 0.5;
        col += uColorLaser * (ring1 + ring2);

        // Atmospheric depth fade
        float depth = clamp((vWorldPos.z + 7.0) / 18.0, 0.0, 1.0);
        col = mix(col, vec3(0.01, 0.06, 0.04), (1.0 - depth) * 0.28);

        gl_FragColor = vec4(col, 0.97);
      }
    `,
    side: THREE.DoubleSide
  });

  const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
  root.add(terrainMesh);

  // Topographic contour wire overlay
  const wireMesh = new THREE.Mesh(
    terrainGeo,
    new THREE.MeshBasicMaterial({ color: 0x56e8a0, wireframe: true, transparent: true, opacity: 0.08 })
  );
  wireMesh.position.y += 0.025;
  root.add(wireMesh);

  // ─── 2. CADASTRAL FARM BOUNDARY POLYGON ──────────────────────────────
  const boundaryCoords = [
    new THREE.Vector3(-4.2, 0.06, -2.6),
    new THREE.Vector3(0.2,  0.06, -4.0),
    new THREE.Vector3(4.8,  0.06, -2.0),
    new THREE.Vector3(4.0,  0.06,  2.8),
    new THREE.Vector3(-0.6, 0.06,  4.2),
    new THREE.Vector3(-4.8, 0.06,  1.4),
    new THREE.Vector3(-4.2, 0.06, -2.6)
  ];
  const boundaryGeo = new THREE.BufferGeometry().setFromPoints(boundaryCoords);
  const boundaryLine = new THREE.Line(
    boundaryGeo,
    new THREE.LineBasicMaterial({ color: 0xd946ef, transparent: true, opacity: 0.9 })
  );
  boundaryLine.position.y = -2.34;
  root.add(boundaryLine);

  // Survey geodetic stakes at corners
  const surveyStakes = [];
  boundaryCoords.slice(0, 6).forEach(pt => {
    const sGroup = new THREE.Group();
    sGroup.position.set(pt.x, -2.34, pt.z);

    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.03, 0.9, 8),
      new THREE.MeshBasicMaterial({ color: 0xd946ef })
    );
    pole.position.y = 0.45;
    sGroup.add(pole);

    const head = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.12),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    head.position.y = 0.96;
    sGroup.add(head);

    root.add(sGroup);
    surveyStakes.push(sGroup);
  });

  // ─── 3. AUTONOMOUS LIDAR SURVEY DRONE ────────────────────────────────
  const droneGroup = new THREE.Group();
  droneGroup.position.set(0, 4.2, 0);
  root.add(droneGroup);

  // Drone frame
  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(1.0, 0.12, 1.0),
    new THREE.MeshStandardMaterial({ color: 0x1f2937, metalness: 0.88, roughness: 0.22 })
  );
  droneGroup.add(frame);

  // Cross arms
  [-1, 1].forEach(ax => [-1, 1].forEach(az => {
    const arm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.03, 0.75, 8),
      new THREE.MeshStandardMaterial({ color: 0x374151, metalness: 0.8, roughness: 0.3 })
    );
    arm.rotation.z = Math.PI * 0.5;
    arm.position.set(ax * 0.38, 0, az * 0.38);
    droneGroup.add(arm);
  }));

  // 4 rotor discs
  const rotorPositions = [[-0.5, 0.07, -0.5], [0.5, 0.07, -0.5], [-0.5, 0.07, 0.5], [0.5, 0.07, 0.5]];
  const rotorDiscs = [];
  rotorPositions.forEach(p => {
    const rGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.022, 14);
    const rMat = new THREE.MeshBasicMaterial({ color: 0xa855f7, transparent: true, opacity: 0.72 });
    const rotor = new THREE.Mesh(rGeo, rMat);
    rotor.position.set(...p);
    droneGroup.add(rotor);
    rotorDiscs.push(rotor);
  });

  // Sensor gimbal ball
  const gimbal = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 20, 16),
    new THREE.MeshStandardMaterial({ color: 0xd946ef, emissive: 0xd946ef, emissiveIntensity: 0.8 })
  );
  gimbal.position.y = -0.18;
  droneGroup.add(gimbal);

  // LiDAR scanning cone (volumetric)
  const frustumGeo = new THREE.ConeGeometry(3.0, 6.5, 32, 1, true);
  frustumGeo.translate(0, -3.25, 0);
  const frustumMat = new THREE.MeshBasicMaterial({
    color: 0xd946ef,
    transparent: true,
    opacity: 0.18,
    side: THREE.DoubleSide
  });
  const frustum = new THREE.Mesh(frustumGeo, frustumMat);
  droneGroup.add(frustum);

  // ─── 4. ATMOSPHERIC RAINFALL / MIST PARTICLES ──────────────────────
  const particleCount = 300;
  const partGeo = new THREE.BufferGeometry();
  const partPos = new Float32Array(particleCount * 3);

  for (let i = 0; i < particleCount; i++) {
    partPos[i * 3]     = (Math.random() - 0.5) * 18.0;
    partPos[i * 3 + 1] = Math.random() * 7.0 - 2.4;
    partPos[i * 3 + 2] = (Math.random() - 0.5) * 14.0;
  }
  partGeo.setAttribute("position", new THREE.BufferAttribute(partPos, 3));
  const partMat = new THREE.PointsMaterial({ color: 0x7fe4ba, size: 0.05, transparent: true, opacity: 0.45 });
  const rain = new THREE.Points(partGeo, partMat);
  root.add(rain);

  // ─── RETURN OBJECT ───────────────────────────────────────────────────
  return {
    update(time, pointerNorm) {
      terrainUniforms.uTime.value = time;

      // Drone follows cursor (damped tracking)
      const targetX = pointerNorm.x * 6.0;
      const targetZ = -pointerNorm.y * 4.2;
      droneGroup.position.x += (targetX - droneGroup.position.x) * 0.045;
      droneGroup.position.z += (targetZ - droneGroup.position.z) * 0.045;
      // Hover bob
      droneGroup.position.y = 4.2 + Math.sin(time * 1.8) * 0.18;

      // Update terrain scan uniforms
      terrainUniforms.uScanPos.value.set(droneGroup.position.x, droneGroup.position.z);

      // Update drone light position to follow drone
      droneLight.position.set(droneGroup.position.x, 3.8, droneGroup.position.z);

      // Rotors spin
      rotorDiscs.forEach((r, idx) => { r.rotation.y += 0.28 * (idx % 2 === 0 ? 1 : -1); });

      // Gimbal and scan cone rotation
      gimbal.rotation.y += 0.04;
      frustum.rotation.y += 0.01;

      // Subtle drone tilt in direction of movement
      droneGroup.rotation.z = (droneGroup.position.x - targetX) * -0.04;
      droneGroup.rotation.x = (droneGroup.position.z - targetZ) * 0.04;

      // Survey stakes pulse
      surveyStakes.forEach((stake, idx) => {
        const p = Math.sin(time * 3.2 + idx) * 0.1;
        stake.scale.setScalar(1.0 + p);
      });

      // Rainfall
      const pos = partGeo.attributes.position.array;
      for (let i = 0; i < particleCount; i++) {
        pos[i * 3 + 1] -= 0.032;
        if (pos[i * 3 + 1] < -2.4) pos[i * 3 + 1] = 4.6;
      }
      partGeo.attributes.position.needsUpdate = true;

      // Parallax tilt
      root.rotation.y = pointerNorm.x * 0.1;
      root.rotation.x = pointerNorm.y * 0.055;
    },
    destroy() {
      scene.remove(root);
    }
  };
}
