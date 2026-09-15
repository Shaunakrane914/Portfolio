// Prototype 03: Compressor CBM — Industrial Digital Twin & Vibration Waterfall
// A real-time vibration spectroscopy art piece:
// Multi-stage impeller blisks on a rotating steel shaft,
// FFT waterfall spectrogram with BPFO defect peak modulation,
// laser probe measurement, and bearing diagnostic rings.
// ZERO text panels. Pure industrial engineering art.

import * as THREE from "three";

export function createCbmWaterfallPrototype(scene) {
  const root = new THREE.Group();
  scene.add(root);

  // ─── SCENE LIGHTING ─────────────────────────────────────────────────
  const machineLight = new THREE.SpotLight(0xffffff, 14, 30, Math.PI * 0.22, 0.6, 1.2);
  machineLight.position.set(0, 12, 6);
  machineLight.target.position.set(0, 3, 0);
  root.add(machineLight);
  root.add(machineLight.target);

  const sideRim = new THREE.PointLight(0x00e5ff, 6, 24);
  sideRim.position.set(-12, 4, 0);
  root.add(sideRim);

  const alertGlow = new THREE.PointLight(0xff0055, 4, 10);
  alertGlow.position.set(7, 3, 0);
  root.add(alertGlow);

  // ─── 1. FFT WATERFALL SPECTROGRAM ───────────────────────────────────
  const gridX = 160;
  const gridZ = 80;
  const waterfallGeo = new THREE.PlaneGeometry(18.0, 13.0, gridX - 1, gridZ - 1);
  waterfallGeo.rotateX(-Math.PI * 0.5);
  waterfallGeo.translate(0, -2.2, 0.5);

  const waterfallUniforms = {
    uTime:         { value: 0 },
    uPointerX:     { value: 0.0 },
    uColorBase:    { value: new THREE.Color(0x020f12) },
    uColorLow:     { value: new THREE.Color(0x00e5ff) },
    uColorMid:     { value: new THREE.Color(0x47e6a5) },
    uColorAlert:   { value: new THREE.Color(0xffaa00) },
    uColorCritical:{ value: new THREE.Color(0xff0055) }
  };

  const waterfallMat = new THREE.ShaderMaterial({
    uniforms: waterfallUniforms,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying float vElevation;
      uniform float uTime;
      uniform float uPointerX;

      float spectrum(float freq, float tSlice) {
        // 1X running speed fundamental (~50 Hz)
        float p1x = exp(-pow((freq - 0.14) * 48.0, 2.0)) * 1.4;
        // 2X harmonic unbalance (~100 Hz)
        float p2x = exp(-pow((freq - 0.28) * 55.0, 2.0)) * 0.82;
        // 3X harmonic (~150 Hz)
        float p3x = exp(-pow((freq - 0.43) * 62.0, 2.0)) * 0.42;
        // BPFO defect peak — periodically modulated (~208 Hz)
        float bpfo = exp(-pow((freq - 0.62) * 50.0, 2.0)) * (1.7 * (0.5 + 0.5 * sin(tSlice * 13.0)));
        // Blade pass frequency
        float bpf = exp(-pow((freq - 0.86) * 42.0, 2.0)) * (0.3 + 0.2 * sin(tSlice * 28.0));
        // Noise floor turbulence
        float noise = 0.07 * sin(freq * 38.0 + tSlice * 4.0) + 0.05 * cos(freq * 78.0 - tSlice * 7.0);
        return p1x + p2x + p3x + bpfo + bpf + noise;
      }

      void main() {
        vUv = uv;
        vec3 pos = position;

        float tSlice = uTime * 1.5 - (1.0 - uv.y) * 9.0;
        float freq   = uv.x;
        float amp    = spectrum(freq, tSlice);

        // Cursor frequency highlight
        float focusDist = abs(freq - (uPointerX * 0.5 + 0.5));
        amp += exp(-pow(focusDist * 20.0, 2.0)) * 0.4;

        pos.y += amp * 2.4;
        vElevation = amp;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      varying float vElevation;
      uniform vec3 uColorBase;
      uniform vec3 uColorLow;
      uniform vec3 uColorMid;
      uniform vec3 uColorAlert;
      uniform vec3 uColorCritical;
      uniform float uTime;

      void main() {
        float h = clamp(vElevation / 3.0, 0.0, 1.0);
        vec3 col = uColorBase;
        if      (h < 0.22) col = mix(uColorBase, uColorLow,      h / 0.22);
        else if (h < 0.50) col = mix(uColorLow,  uColorMid,      (h - 0.22) / 0.28);
        else if (h < 0.78) col = mix(uColorMid,  uColorAlert,    (h - 0.50) / 0.28);
        else               col = mix(uColorAlert, uColorCritical, (h - 0.78) / 0.22);

        // Spectral iso-grid
        float gx = step(0.96, fract(vUv.x * 26.0));
        float gz = step(0.96, fract(vUv.y * 20.0));
        col += vec3(max(gx, gz)) * uColorLow * 0.28;

        // Fade front edge
        float edgeFade = smoothstep(0.0, 0.1, vUv.y);
        col *= (0.45 + 0.55 * edgeFade);

        gl_FragColor = vec4(col, 0.95);
      }
    `,
    transparent: true,
    side: THREE.DoubleSide
  });

  const waterfallMesh = new THREE.Mesh(waterfallGeo, waterfallMat);
  root.add(waterfallMesh);

  // Precision wireframe grid overlay
  const wireMesh = new THREE.Mesh(
    waterfallGeo,
    new THREE.MeshBasicMaterial({ color: 0x00e5ff, wireframe: true, transparent: true, opacity: 0.10 })
  );
  wireMesh.position.y += 0.025;
  root.add(wireMesh);

  // ─── 2. TURBOMACHINE — SHAFT + IMPELLER BLISKS ───────────────────────
  const turbomachine = new THREE.Group();
  turbomachine.position.set(0, 4.0, -1.4);
  root.add(turbomachine);

  // Drive shaft
  const shaftGeo = new THREE.CylinderGeometry(0.2, 0.2, 15.0, 24);
  shaftGeo.rotateZ(Math.PI * 0.5);
  const shaftMat = new THREE.MeshStandardMaterial({ color: 0x1e2c36, metalness: 0.96, roughness: 0.12 });
  const shaft = new THREE.Mesh(shaftGeo, shaftMat);
  turbomachine.add(shaft);

  // 4-stage impeller blisks (progressively smaller = compressor)
  const bliskData = [
    { x: -4.2, r: 1.35, emissive: 0x00e5ff, alert: false },
    { x: -1.4, r: 1.18, emissive: 0x00e5ff, alert: false },
    { x:  1.4, r: 1.02, emissive: 0x47e6a5, alert: false },
    { x:  4.2, r: 0.88, emissive: 0xff0055, alert: true }  // Stage 4 — bearing fault
  ];

  const bliskStages = [];
  bliskData.forEach(d => {
    const bGroup = new THREE.Group();
    bGroup.position.x = d.x;

    const hubGeo = new THREE.CylinderGeometry(d.r, d.r, 0.35, 28);
    hubGeo.rotateZ(Math.PI * 0.5);
    const hubMat = new THREE.MeshStandardMaterial({
      color: 0x08161e,
      metalness: 0.92,
      roughness: 0.22,
      emissive: d.emissive,
      emissiveIntensity: d.alert ? 0.6 : 0.28
    });
    bGroup.add(new THREE.Mesh(hubGeo, hubMat));

    // 16 aerodynamic blades
    const bladeCount = 16;
    for (let b = 0; b < bladeCount; b++) {
      const bAngle = (b / bladeCount) * Math.PI * 2;
      const bladeGeo = new THREE.BoxGeometry(0.16, d.r * 0.72, 0.035);
      bladeGeo.translate(0, d.r * 0.52, 0);
      const blade = new THREE.Mesh(bladeGeo, new THREE.MeshStandardMaterial({
        color: 0x283c48,
        metalness: 0.88,
        roughness: 0.28
      }));
      blade.rotation.x = bAngle;
      blade.rotation.y = 0.28;
      bGroup.add(blade);
    }

    turbomachine.add(bGroup);
    bliskStages.push(bGroup);
  });

  // ─── 3. OPTICAL LASER VIBRATION PROBE ────────────────────────────────
  const sensorGroup = new THREE.Group();
  sensorGroup.position.set(4.2, 1.9, 0);
  turbomachine.add(sensorGroup);

  const probeGeo = new THREE.CylinderGeometry(0.13, 0.18, 0.65, 16);
  const probeMat = new THREE.MeshStandardMaterial({ color: 0x1a2630, metalness: 0.92, roughness: 0.18 });
  sensorGroup.add(new THREE.Mesh(probeGeo, probeMat));

  const laserGeo = new THREE.CylinderGeometry(0.012, 0.012, 1.8, 8);
  laserGeo.translate(0, -0.9, 0);
  const laserMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.9 });
  const laserBeam = new THREE.Mesh(laserGeo, laserMat);
  sensorGroup.add(laserBeam);

  // ─── 4. BEARING DIAGNOSTIC RINGS (Drive-end bearing) ─────────────────
  const bearingGeo = new THREE.TorusGeometry(1.08, 0.04, 16, 64);
  bearingGeo.rotateY(Math.PI * 0.5);
  const bearingMat = new THREE.MeshBasicMaterial({ color: 0xff0055, transparent: true, opacity: 0.85 });
  const bearingRing = new THREE.Mesh(bearingGeo, bearingMat);
  bearingRing.position.set(4.2, 0, 0);
  turbomachine.add(bearingRing);

  // Secondary diagnostic ring
  const bearing2Geo = new THREE.TorusGeometry(1.22, 0.025, 16, 64);
  bearing2Geo.rotateY(Math.PI * 0.5);
  const bearing2 = new THREE.Mesh(bearing2Geo, new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0.6 }));
  bearing2.position.set(4.2, 0, 0);
  turbomachine.add(bearing2);

  // ─── RETURN OBJECT ───────────────────────────────────────────────────
  return {
    update(time, pointerNorm) {
      waterfallUniforms.uTime.value = time;
      waterfallUniforms.uPointerX.value = pointerNorm.x;

      // Shaft and blisk rotation
      shaft.rotation.x += 0.065;
      bliskStages.forEach(blisk => { blisk.rotation.x += 0.065; });

      // Radial vibration displacement (subtle CBM signature)
      turbomachine.position.y = 4.0 + Math.sin(time * 52.0) * 0.022;

      // Bearing fault diagnostic pulse
      const faultPulse = 0.5 + 0.5 * Math.sin(time * 9.0);
      bearingRing.scale.setScalar(1.0 + faultPulse * 0.08);
      bearing2.scale.setScalar(1.0 + faultPulse * 0.05);
      bearingRing.material.opacity = 0.6 + faultPulse * 0.4;

      // Alert glow pulse
      alertGlow.intensity = 3 + faultPulse * 5;

      // Laser probe flicker
      laserBeam.material.opacity = 0.7 + Math.sin(time * 18.0) * 0.3;

      // Parallax tilt
      root.rotation.y = pointerNorm.x * 0.13;
      root.rotation.x = pointerNorm.y * 0.07;
    },
    destroy() {
      scene.remove(root);
    }
  };
}
