// Prototype 04: KrushiMitra — Multispectral NDVI Crop Canopy & Cadastral Farm Polygon
// Upgraded geospatial precision agriculture prototype:
// 3D terraced agricultural terrain, Leaflet cadastral farm boundary polygon with survey stakes,
// dual-band multispectral LiDAR drone scanner (NIR/Red bands), atmospheric precipitation,
// and typed scenario output (FastAPI + Pydantic schema).

import * as THREE from "three";

export function createCropNdviPrototype(scene) {
  const root = new THREE.Group();
  scene.add(root);

  // 1. Terraced Agricultural Crop Terrain (Odisha River Basin Topography)
  const terrX = 120;
  const terrZ = 90;
  const sizeX = 18.0;
  const sizeZ = 14.0;
  const terrainGeo = new THREE.PlaneGeometry(sizeX, sizeZ, terrX - 1, terrZ - 1);
  terrainGeo.rotateX(-Math.PI * 0.5);
  terrainGeo.translate(0, -2.4, 0);

  const terrainUniforms = {
    uTime: { value: 0 },
    uScanPos: { value: new THREE.Vector2(0, 0) },
    uColorArid: { value: new THREE.Color(0xb45309) },   // Drought ochre (NDVI < 0.3)
    uColorCrop: { value: new THREE.Color(0x84cc16) },   // Developing green (NDVI ~0.5)
    uColorVigor: { value: new THREE.Color(0x10b981) },  // Photosynthetic emerald (NDVI > 0.7)
    uColorLaser: { value: new THREE.Color(0xa855f7) }   // Multispectral purple LiDAR
  };

  const terrainMat = new THREE.ShaderMaterial({
    uniforms: terrainUniforms,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying float vElevation;
      varying float vNdvi;
      varying vec3 vWorldPos;
      uniform float uTime;
      uniform vec2 uScanPos;

      // Realistic terraced agricultural topography
      float getElevation(vec2 coord) {
        float hill = sin(coord.x * 2.2) * cos(coord.y * 2.0) * 1.35;
        float valley = -exp(-pow((coord.x - 0.15) * 3.2, 2.0)) * 0.9;
        // Step terrace quantization
        float raw = hill + valley;
        float terraced = floor(raw * 5.0) * 0.2 + fract(raw * 5.0) * 0.05;
        return terraced;
      }

      void main() {
        vUv = uv;
        vec3 pos = position;

        float elev = getElevation(uv * 3.14159);
        pos.y += elev;
        vElevation = elev;

        // Multispectral NDVI calculation based on valley moisture & rainfall wave
        float moistureWave = sin(uv.y * 14.0 - uTime * 1.8) * 0.12;
        float ndvi = clamp(0.52 - elev * 0.22 + moistureWave, 0.08, 0.96);
        vNdvi = ndvi;

        vec4 worldPos = modelMatrix * vec4(pos, 1.0);
        vWorldPos = worldPos.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      varying float vElevation;
      varying float vNdvi;
      varying vec3 vWorldPos;
      uniform vec2 uScanPos;
      uniform vec3 uColorArid;
      uniform vec3 uColorCrop;
      uniform vec3 uColorVigor;
      uniform vec3 uColorLaser;

      void main() {
        // NDVI false-color gradient
        vec3 col = uColorArid;
        if (vNdvi < 0.45) {
          col = mix(uColorArid, uColorCrop, vNdvi / 0.45);
        } else {
          col = mix(uColorCrop, uColorVigor, (vNdvi - 0.45) / 0.55);
        }

        // Terraced field plot boundaries
        float plotX = step(0.96, fract(vUv.x * 20.0));
        float plotZ = step(0.96, fract(vUv.y * 15.0));
        float boundary = max(plotX, plotZ) * 0.35;
        col += vec3(boundary) * uColorVigor;

        // Dynamic LiDAR drone sensor illumination
        float distToScan = length(vWorldPos.xz - uScanPos);
        float scanRing = smoothstep(0.45, 0.0, abs(distToScan - 2.5)) * 0.85;
        col += uColorLaser * scanRing;

        // Depth fogging
        float depth = clamp((vWorldPos.z + 6.0) / 16.0, 0.0, 1.0);
        col = mix(col, vec3(0.02, 0.06, 0.04), (1.0 - depth) * 0.35);

        gl_FragColor = vec4(col, 0.95);
      }
    `,
    side: THREE.DoubleSide
  });

  const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
  root.add(terrainMesh);

  // Elevation contour wireframe overlay
  const wireMat = new THREE.MeshBasicMaterial({
    color: 0x84cc16,
    wireframe: true,
    transparent: true,
    opacity: 0.12
  });
  const wireMesh = new THREE.Mesh(terrainGeo, wireMat);
  wireMesh.position.y += 0.01;
  root.add(wireMesh);

  // 2. Cadastral Farm Polygon Boundary (Leaflet Map Boundary Capture)
  // Simulating the surveyed 4.8-acre farm plot in Odisha
  const polygonGroup = new THREE.Group();
  root.add(polygonGroup);

  const farmBoundaryPoints = [
    new THREE.Vector3(-3.8, -1.85, -1.5),
    new THREE.Vector3(-1.0, -1.65, -3.2),
    new THREE.Vector3(2.8, -1.75, -2.0),
    new THREE.Vector3(3.5, -2.05, 1.6),
    new THREE.Vector3(0.2, -1.95, 2.8),
    new THREE.Vector3(-3.2, -2.15, 1.8),
    new THREE.Vector3(-3.8, -1.85, -1.5) // Closed loop
  ];

  // Neon Boundary Tube
  const boundaryCurve = new THREE.CatmullRomCurve3(farmBoundaryPoints);
  const boundaryGeo = new THREE.TubeGeometry(boundaryCurve, 64, 0.035, 8, true);
  const boundaryMat = new THREE.MeshBasicMaterial({
    color: 0xa855f7,
    transparent: true,
    opacity: 0.95
  });
  const boundaryMesh = new THREE.Mesh(boundaryGeo, boundaryMat);
  polygonGroup.add(boundaryMesh);

  // Cadastral Survey Stakes at Polygon Vertices
  const surveyStakes = [];
  farmBoundaryPoints.slice(0, 6).forEach((pt, idx) => {
    const sGroup = new THREE.Group();
    sGroup.position.copy(pt);

    // Vertical neon marker pin
    const pinGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.9, 8);
    pinGeo.translate(0, 0.45, 0);
    const pinMat = new THREE.MeshBasicMaterial({ color: 0xa855f7 });
    sGroup.add(new THREE.Mesh(pinGeo, pinMat));

    // Glowing coordinate beacon head
    const beaconGeo = new THREE.OctahedronGeometry(0.12, 0);
    const beaconMat = new THREE.MeshStandardMaterial({
      color: 0xa855f7,
      emissive: 0xa855f7,
      emissiveIntensity: 0.6,
      metalness: 0.8
    });
    const beacon = new THREE.Mesh(beaconGeo, beaconMat);
    beacon.position.y = 0.9;
    sGroup.add(beacon);

    polygonGroup.add(sGroup);
    surveyStakes.push(beacon);
  });

  // 3. Multispectral LiDAR Drone Sensor Emitter (Airborne)
  const droneGroup = new THREE.Group();
  droneGroup.position.set(0, 4.6, 0);
  root.add(droneGroup);

  // Drone airframe
  const frameGeo = new THREE.CylinderGeometry(0.42, 0.52, 0.14, 6);
  const frameMat = new THREE.MeshStandardMaterial({
    color: 0x1a1226,
    metalness: 0.9,
    roughness: 0.15,
    emissive: 0x0e0618
  });
  const frame = new THREE.Mesh(frameGeo, frameMat);
  droneGroup.add(frame);

  // Dual-gimbal multispectral optical camera
  const gimbalGeo = new THREE.SphereGeometry(0.24, 16, 16);
  const gimbalMat = new THREE.MeshStandardMaterial({
    color: 0xa855f7,
    emissive: 0xa855f7,
    emissiveIntensity: 0.8,
    metalness: 0.9
  });
  const gimbal = new THREE.Mesh(gimbalGeo, gimbalMat);
  gimbal.position.y = -0.15;
  droneGroup.add(gimbal);

  // 4-corner Holographic LiDAR Scanning Frustum
  const frustumGeo = new THREE.ConeGeometry(2.6, 6.8, 4, 1, true);
  frustumGeo.rotateX(Math.PI);
  frustumGeo.translate(0, -3.4, 0);
  const frustumMat = new THREE.MeshBasicMaterial({
    color: 0xa855f7,
    transparent: true,
    opacity: 0.22,
    side: THREE.DoubleSide,
    depthWrite: false
  });
  const frustum = new THREE.Mesh(frustumGeo, frustumMat);
  droneGroup.add(frustum);

  // 4. Atmospheric Moisture Precipitation Particles (Simulating Monsoon Humidity)
  const particleCount = 750;
  const partGeo = new THREE.BufferGeometry();
  const partPos = new Float32Array(particleCount * 3);
  for (let i = 0; i < particleCount; i++) {
    partPos[i * 3 + 0] = (Math.random() - 0.5) * sizeX;
    partPos[i * 3 + 1] = Math.random() * 5.5 - 1.5;
    partPos[i * 3 + 2] = (Math.random() - 0.5) * sizeZ;
  }
  partGeo.setAttribute("position", new THREE.BufferAttribute(partPos, 3));
  const partMat = new THREE.PointsMaterial({
    color: 0xa855f7,
    size: 0.075,
    transparent: true,
    opacity: 0.65,
    blending: THREE.AdditiveBlending
  });
  const particleSystem = new THREE.Points(partGeo, partMat);
  root.add(particleSystem);

  // 5. Floating Agro-Climatic Scenario HUD (Canvas Texture)
  const hudCanvas = document.createElement("canvas");
  hudCanvas.width = 512;
  hudCanvas.height = 360;
  const ctx = hudCanvas.getContext("2d");

  function drawKrushiMitraHud(ndviVal, yieldEst) {
    ctx.clearRect(0, 0, 512, 360);

    // Deep purple-black backing
    ctx.fillStyle = "rgba(10, 8, 22, 0.92)";
    ctx.fillRect(0, 0, 512, 360);

    // Neon purple border
    ctx.strokeStyle = "rgba(168, 85, 247, 0.75)";
    ctx.lineWidth = 2.5;
    ctx.strokeRect(4, 4, 504, 352);

    // Header bar
    ctx.fillStyle = "rgba(168, 85, 247, 0.16)";
    ctx.fillRect(4, 4, 504, 44);

    ctx.fillStyle = "#a855f7";
    ctx.font = "bold 15px monospace";
    ctx.fillText("KRUSHIMITRA // GEOSPATIAL YIELD ENGINE", 20, 28);

    ctx.fillStyle = "#8fa598";
    ctx.font = "11px monospace";
    ctx.fillText("ODISHA DISTRICT SCENARIO · REACT 18 + FASTAPI + PYDANTIC", 20, 64);

    // Farm Geometry Box
    ctx.fillStyle = "rgba(22, 16, 40, 0.85)";
    ctx.fillRect(20, 76, 472, 48);
    ctx.strokeStyle = "rgba(168, 85, 247, 0.35)";
    ctx.strokeRect(20, 76, 472, 48);

    ctx.fillStyle = "#e8f5ee";
    ctx.font = "12px monospace";
    ctx.fillText("PARCEL #OD-GANJAM-742B // CADASTRAL BOUNDARY: 4.8 ACRES", 28, 96);
    ctx.fillStyle = "#84cc16";
    ctx.font = "11px monospace";
    ctx.fillText("CROP: PADDY (SWARNA VARIETY) · SEASON: KHARIF · RAINFED", 28, 114);

    // Metric 1: NDVI Vegetation Vigor
    ctx.fillStyle = "rgba(22, 16, 40, 0.85)";
    ctx.fillRect(20, 134, 230, 70);
    ctx.strokeStyle = "rgba(168, 85, 247, 0.4)";
    ctx.strokeRect(20, 134, 230, 70);

    ctx.fillStyle = "#8fa598";
    ctx.font = "11px monospace";
    ctx.fillText("CANOPY NDVI INDEX:", 28, 154);
    ctx.fillStyle = "#84cc16";
    ctx.font = "bold 24px monospace";
    ctx.fillText(`${ndviVal.toFixed(2)}`, 28, 184);
    ctx.fillStyle = "#10b981";
    ctx.font = "10px monospace";
    ctx.fillText("High Photosynthetic Vigor", 95, 182);

    // Metric 2: Yield Forecast
    ctx.fillStyle = "rgba(22, 16, 40, 0.85)";
    ctx.fillRect(262, 134, 230, 70);
    ctx.strokeStyle = "rgba(168, 85, 247, 0.4)";
    ctx.strokeRect(262, 134, 230, 70);

    ctx.fillStyle = "#8fa598";
    ctx.font = "11px monospace";
    ctx.fillText("ESTIMATED PADDY YIELD:", 270, 154);
    ctx.fillStyle = "#a855f7";
    ctx.font = "bold 24px monospace";
    ctx.fillText(`${yieldEst.toFixed(2)} T`, 270, 184);
    ctx.fillStyle = "#8fa598";
    ctx.font = "10px monospace";
    ctx.fillText("±0.28 T/acre (Benchmark)", 360, 182);

    // Scenario Parameters Table
    ctx.fillStyle = "rgba(168, 85, 247, 0.12)";
    ctx.fillRect(20, 214, 472, 24);
    ctx.fillStyle = "#e8f5ee";
    ctx.font = "bold 11px monospace";
    ctx.fillText("AGRO-CLIMATIC FEATURE", 28, 230);
    ctx.fillText("INPUT VALUE", 230, 230);
    ctx.fillText("MODEL IMPACT", 365, 230);

    const rows = [
      { feat: "Monsoon Cumulative Rain", val: "142.6 mm", imp: "+18.4% YIELD", col: "#84cc16" },
      { feat: "Mean Canopy Temp", val: "28.4 °C", imp: "OPTIMAL RANGE", col: "#84cc16" },
      { feat: "SMAP Soil Moisture", val: "0.34 m³/m³", imp: "ADEQUATE", col: "#84cc16" },
      { feat: "Pest Infestation Risk", val: "0.12 (LOW)", imp: "GATED PASS", col: "#10b981" }
    ];

    rows.forEach((r, idx) => {
      const y = 258 + idx * 24;
      ctx.fillStyle = "rgba(16, 12, 30, 0.75)";
      ctx.fillRect(20, y - 14, 472, 20);

      ctx.fillStyle = "#e8f5ee";
      ctx.font = "11px monospace";
      ctx.fillText(r.feat, 28, y);
      ctx.fillText(r.val, 230, y);

      ctx.fillStyle = r.col;
      ctx.fillText(r.imp, 365, y);
    });

    // Verification Footer
    ctx.fillStyle = "rgba(168, 85, 247, 0.85)";
    ctx.font = "11px monospace";
    ctx.fillText(">> STABLE SERVICE CONTRACT: { estimate, range, comparison, factors }", 20, 332);
    ctx.fillStyle = "#8fa598";
    ctx.fillText("ILLUSTRATIVE OUTPUT ENABLING END-TO-END MOBILE INTERACTION", 20, 348);
  }

  const hudTexture = new THREE.CanvasTexture(hudCanvas);
  hudTexture.minFilter = THREE.LinearFilter;
  const hudGeo = new THREE.PlaneGeometry(5.0, 3.5);
  const hudMat = new THREE.MeshBasicMaterial({
    map: hudTexture,
    transparent: true,
    opacity: 0.95,
    side: THREE.DoubleSide
  });
  const hudMesh = new THREE.Mesh(hudGeo, hudMat);
  hudMesh.position.set(-4.2, 1.8, 2.6);
  hudMesh.rotation.y = 0.28;
  hudMesh.rotation.x = -0.12;
  root.add(hudMesh);

  // Return lifecycle hooks
  let lastHudUpdate = 0;

  return {
    update(time, pointerNorm) {
      terrainUniforms.uTime.value = time;

      // Guide drone LiDAR scanning position with gentle damping
      const targetScanX = pointerNorm.x * 5.5;
      const targetScanZ = -pointerNorm.y * 3.8;
      droneGroup.position.x += (targetScanX - droneGroup.position.x) * 0.05;
      droneGroup.position.z += (targetScanZ - droneGroup.position.z) * 0.05;

      terrainUniforms.uScanPos.value.set(droneGroup.position.x, droneGroup.position.z);

      // Rotate drone optics & frustum
      gimbal.rotation.y += 0.03;
      frustum.rotation.y += 0.012;

      // Pulse survey stakes
      surveyStakes.forEach((stake, idx) => {
        stake.rotation.y += 0.02;
        const p = Math.sin(time * 3.0 + idx) * 0.15;
        stake.scale.setScalar(1.0 + p);
      });

      // Animate rainfall particles
      const pos = partGeo.attributes.position.array;
      for (let i = 0; i < particleCount; i++) {
        pos[i * 3 + 1] -= 0.04;
        if (pos[i * 3 + 1] < -2.4) {
          pos[i * 3 + 1] = 4.8;
        }
      }
      partGeo.attributes.position.needsUpdate = true;

      // Parallax root tilt
      root.rotation.y = pointerNorm.x * 0.12;
      root.rotation.x = pointerNorm.y * 0.06;

      // Update HUD Canvas
      const now = performance.now();
      if (now - lastHudUpdate > 200) {
        lastHudUpdate = now;
        const ndvi = 0.74 + Math.sin(time * 1.4) * 0.03;
        const yEst = 3.42 + Math.sin(time * 1.1) * 0.12;
        drawKrushiMitraHud(ndvi, yEst);
        hudTexture.needsUpdate = true;
      }
    },
    destroy() {
      terrainGeo.dispose();
      terrainMat.dispose();
      wireMat.dispose();
      boundaryGeo.dispose();
      boundaryMat.dispose();
      frameGeo.dispose();
      frameMat.dispose();
      gimbalGeo.dispose();
      gimbalMat.dispose();
      frustumGeo.dispose();
      frustumMat.dispose();
      partGeo.dispose();
      partMat.dispose();
      hudGeo.dispose();
      hudMat.dispose();
      hudTexture.dispose();
      scene.remove(root);
    }
  };
}
