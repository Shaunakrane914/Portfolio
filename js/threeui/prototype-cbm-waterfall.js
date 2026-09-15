// Prototype 01: Industrial Compressor CBM — 3D FFT Waterfall & Harmonic Spectrum
// Visualizes high-frequency vibration, acoustic diagnostics, and rotating shaft harmonics
// Direct match for Shaunak's physics-grounded compressor condition-monitoring project

import * as THREE from "three";

export function createCbmWaterfallPrototype(scene) {
  const root = new THREE.Group();
  scene.add(root);

  // 1. 3D FFT Waterfall Spectrogram Surface
  // Mesh dimensions: X = Frequency (0 - 5 kHz), Z = Time History (t-0 to t-60s), Y = Amplitude (Vibration mm/s RMS)
  const gridX = 140;
  const gridZ = 70;
  const sizeX = 16.0;
  const sizeZ = 12.0;
  const geometry = new THREE.PlaneGeometry(sizeX, sizeZ, gridX - 1, gridZ - 1);
  geometry.rotateX(-Math.PI * 0.5);
  geometry.translate(0, -1.8, 1.0);

  // Custom GLSL Shader for 3D FFT Waterfall with real-time running harmonics
  const waterfallUniforms = {
    uTime: { value: 0 },
    uSpeed: { value: 1.0 },
    uPointerX: { value: 0.0 },
    uColorBase: { value: new THREE.Color(0x02171a) },     // Deep ocean noise floor
    uColorLow: { value: new THREE.Color(0x00e5ff) },      // Cyan 1X fundamental
    uColorMid: { value: new THREE.Color(0x47e6a5) },      // Emerald harmonics
    uColorAlert: { value: new THREE.Color(0xffaa00) },    // Amber alert
    uColorCritical: { value: new THREE.Color(0xff0055) }  // Critical magenta BPFO
  };

  const waterfallMaterial = new THREE.ShaderMaterial({
    uniforms: waterfallUniforms,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying float vElevation;
      varying vec3 vWorldPos;
      uniform float uTime;
      uniform float uPointerX;

      // Realistic vibration spectral harmonics
      float getHarmonics(float freqNorm, float timeSlice) {
        // Fundamental running shaft speed 1X (normalized ~0.15 = 50Hz / 3000 RPM)
        float peak1X = exp(-pow((freqNorm - 0.15) * 45.0, 2.0)) * 1.35;

        // 2X Harmonic unbalance/misalignment (~0.30 = 100Hz)
        float peak2X = exp(-pow((freqNorm - 0.30) * 55.0, 2.0)) * 0.85;

        // 3X Harmonic (~0.45 = 150Hz)
        float peak3X = exp(-pow((freqNorm - 0.45) * 60.0, 2.0)) * 0.45;

        // BPFO (Ball Pass Frequency Outer Race) defect peak at ~0.62 (= 208Hz) with periodic impact modulation
        float modulation = 0.5 + 0.5 * sin(timeSlice * 12.0);
        float bpfoPeak = exp(-pow((freqNorm - 0.62) * 50.0, 2.0)) * (1.65 * modulation);

        // Gear mesh / blade pass high frequency hash (~0.85)
        float bladePass = exp(-pow((freqNorm - 0.85) * 40.0, 2.0)) * (0.35 + 0.2 * sin(timeSlice * 24.0));

        // Background turbulent flow noise floor with rolling waves
        float noiseFloor = 0.08 * sin(freqNorm * 35.0 + timeSlice * 3.5) + 
                           0.05 * cos(freqNorm * 75.0 - timeSlice * 6.0);

        return peak1X + peak2X + peak3X + bpfoPeak + bladePass + noiseFloor;
      }

      void main() {
        vUv = uv;
        vec3 pos = position;

        // Time flows along the Z dimension
        float timeSlice = uTime * 1.4 - (1.0 - uv.y) * 8.0;
        float freqNorm = uv.x;

        float amp = getHarmonics(freqNorm, timeSlice);

        // Add user inspection pointer focus wave
        float distToPointer = abs(freqNorm - (uPointerX * 0.5 + 0.5));
        float focusHighlight = exp(-pow(distToPointer * 18.0, 2.0)) * 0.35;
        amp += focusHighlight;

        pos.y += amp * 2.2;
        vElevation = amp;

        vec4 worldPosition = modelMatrix * vec4(pos, 1.0);
        vWorldPos = worldPosition.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      varying float vElevation;
      varying vec3 vWorldPos;
      uniform vec3 uColorBase;
      uniform vec3 uColorLow;
      uniform vec3 uColorMid;
      uniform vec3 uColorAlert;
      uniform vec3 uColorCritical;
      uniform float uTime;

      void main() {
        // Multi-tier diagnostic heat-map
        vec3 col = uColorBase;
        if (vElevation < 0.35) {
          col = mix(uColorBase, uColorLow, vElevation / 0.35);
        } else if (vElevation < 0.75) {
          col = mix(uColorLow, uColorMid, (vElevation - 0.35) / 0.40);
        } else if (vElevation < 1.25) {
          col = mix(uColorMid, uColorAlert, (vElevation - 0.75) / 0.50);
        } else {
          col = mix(uColorAlert, uColorCritical, clamp((vElevation - 1.25) / 0.60, 0.0, 1.0));
        }

        // Waterfall grid scanlines
        float scanX = step(0.96, fract(vUv.x * 70.0));
        float scanZ = step(0.96, fract(vUv.y * 35.0));
        float gridLine = max(scanX, scanZ) * 0.25;

        // Pulsing cursor caliper line
        col += vec3(gridLine) * uColorLow;

        // Soft depth fogging at back
        float depthFade = smoothstep(0.0, 0.3, vUv.y);
        col *= (0.35 + depthFade * 0.65);

        gl_FragColor = vec4(col, 0.95);
      }
    `,
    wireframe: false,
    side: THREE.DoubleSide
  });

  const waterfallMesh = new THREE.Mesh(geometry, waterfallMaterial);
  root.add(waterfallMesh);

  // Waterfall Wireframe Grid Overlay for ThreeUI high-tech aesthetic
  const wireMat = new THREE.MeshBasicMaterial({
    color: 0x00e5ff,
    wireframe: true,
    transparent: true,
    opacity: 0.12
  });
  const wireMesh = new THREE.Mesh(geometry, wireMat);
  wireMesh.position.y += 0.01;
  root.add(wireMesh);

  // 2. Rotating Compressor Rotor Shaft & Bearing Assembly (Top / Center Background)
  const shaftGroup = new THREE.Group();
  shaftGroup.position.set(0, 2.6, -2.5);
  root.add(shaftGroup);

  // Main Shaft Core
  const shaftGeo = new THREE.CylinderGeometry(0.38, 0.38, 14.0, 32);
  shaftGeo.rotateZ(Math.PI * 0.5);
  const shaftMat = new THREE.MeshStandardMaterial({
    color: 0x18242a,
    metalness: 0.92,
    roughness: 0.22,
    emissive: 0x041014,
    emissiveIntensity: 0.4
  });
  const shaftMesh = new THREE.Mesh(shaftGeo, shaftMat);
  shaftGroup.add(shaftMesh);

  // Rotor Impeller / Turbine Blisk Stages (5 aerodynamic compression stages)
  const stagePositions = [-4.5, -2.2, 0.0, 2.2, 4.5];
  const stageRadii = [1.55, 1.40, 1.25, 1.10, 0.95]; // Decreasing diameter per compression stage
  const rotorBlisks = [];

  stagePositions.forEach((posX, idx) => {
    const bliskGroup = new THREE.Group();
    bliskGroup.position.x = posX;

    // Disc rim
    const r = stageRadii[idx];
    const discGeo = new THREE.TorusGeometry(r * 0.85, 0.08, 16, 48);
    discGeo.rotateY(Math.PI * 0.5);
    const discMat = new THREE.MeshStandardMaterial({
      color: 0x22363e,
      metalness: 0.95,
      roughness: 0.15,
      emissive: 0x00e5ff,
      emissiveIntensity: 0.3
    });
    const disc = new THREE.Mesh(discGeo, discMat);
    bliskGroup.add(disc);

    // Aerodynamic Blades (16 per stage)
    const bladeCount = 16;
    for (let b = 0; b < bladeCount; b++) {
      const angle = (b / bladeCount) * Math.PI * 2;
      const bladeGeo = new THREE.BoxGeometry(0.06, r * 0.7, 0.18);
      const bladeMat = new THREE.MeshStandardMaterial({
        color: 0x3a5664,
        metalness: 0.88,
        roughness: 0.3
      });
      const blade = new THREE.Mesh(bladeGeo, bladeMat);
      blade.position.set(0, Math.cos(angle) * (r * 0.55), Math.sin(angle) * (r * 0.55));
      blade.rotation.x = angle + 0.35; // Pitch angle
      blade.rotation.y = 0.2;
      bliskGroup.add(blade);
    }

    shaftGroup.add(bliskGroup);
    rotorBlisks.push(bliskGroup);
  });

  // Bearing Pedestals with Holographic Diagnostic Rings
  const bearingPositions = [-5.8, 5.8];
  const bearingRings = [];
  bearingPositions.forEach(bX => {
    const bGroup = new THREE.Group();
    bGroup.position.set(bX, 0, 0);

    const bHousingGeo = new THREE.CylinderGeometry(0.72, 0.72, 0.6, 24);
    bHousingGeo.rotateZ(Math.PI * 0.5);
    const bHousingMat = new THREE.MeshStandardMaterial({
      color: 0x0c1418,
      metalness: 0.8,
      roughness: 0.4
    });
    bGroup.add(new THREE.Mesh(bHousingGeo, bHousingMat));

    // Outer Race BPFO Diagnostic Sensor Ring (pulsing warning ring)
    const faultRingGeo = new THREE.TorusGeometry(0.85, 0.035, 16, 48);
    faultRingGeo.rotateY(Math.PI * 0.5);
    const faultRingMat = new THREE.MeshBasicMaterial({
      color: 0xff0055,
      transparent: true,
      opacity: 0.85
    });
    const faultRing = new THREE.Mesh(faultRingGeo, faultRingMat);
    bGroup.add(faultRing);
    bearingRings.push(faultRing);

    shaftGroup.add(bGroup);
  });

  // 3. Laser Optical Vibration Sensor & Diagnostic Beam
  const sensorGroup = new THREE.Group();
  sensorGroup.position.set(2.2, 4.6, -2.5);
  root.add(sensorGroup);

  // Sensor Probe Head
  const sensorHeadGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.6, 16);
  const sensorHeadMat = new THREE.MeshStandardMaterial({ color: 0x00e5ff, metalness: 0.9, roughness: 0.2 });
  const sensorHead = new THREE.Mesh(sensorHeadGeo, sensorHeadMat);
  sensorGroup.add(sensorHead);

  // Laser Beam pointing down to shaft
  const laserBeamGeo = new THREE.CylinderGeometry(0.012, 0.012, 1.4, 8);
  const laserBeamMat = new THREE.MeshBasicMaterial({
    color: 0x00e5ff,
    transparent: true,
    opacity: 0.8
  });
  const laserBeam = new THREE.Mesh(laserBeamGeo, laserBeamMat);
  laserBeam.position.y = -1.0;
  sensorGroup.add(laserBeam);

  // 4. Frequency Axis Caliper Grid (0 Hz, 1 kHz, 2.5 kHz, 5 kHz markers)
  const axisGroup = new THREE.Group();
  axisGroup.position.set(-sizeX * 0.5, -1.75, sizeZ * 0.5 + 1.0);
  root.add(axisGroup);

  const freqLabels = [
    { text: "0 Hz", x: 0 },
    { text: "1X SHAFT (50 Hz)", x: sizeX * 0.15 },
    { text: "2X HARMONIC (100 Hz)", x: sizeX * 0.30 },
    { text: "BPFO FAULT (208 Hz)", x: sizeX * 0.62 },
    { text: "5 kHz HF NOISE", x: sizeX }
  ];

  // Frequency rail line
  const railGeo = new THREE.BoxGeometry(sizeX, 0.03, 0.03);
  railGeo.translate(sizeX * 0.5, 0, 0);
  const railMat = new THREE.MeshBasicMaterial({ color: 0x47e6a5 });
  axisGroup.add(new THREE.Mesh(railGeo, railMat));

  // 5. Floating Holographic Telemetry Canvas Dossier
  const hudCanvas = document.createElement("canvas");
  hudCanvas.width = 512;
  hudCanvas.height = 320;
  const ctx = hudCanvas.getContext("2d");

  function drawCbmHud(rpm, rms, bpfoRatio) {
    ctx.clearRect(0, 0, 512, 320);

    // Glass panel backing with glowing border
    ctx.fillStyle = "rgba(4, 16, 18, 0.88)";
    ctx.fillRect(0, 0, 512, 320);

    ctx.strokeStyle = "rgba(0, 229, 255, 0.6)";
    ctx.lineWidth = 3;
    ctx.strokeRect(4, 4, 504, 312);

    // Header
    ctx.fillStyle = "#00e5ff";
    ctx.font = "bold 18px monospace";
    ctx.fillText("COMPRESSOR CBM // DIAGNOSTIC RADAR", 24, 36);

    ctx.fillStyle = "rgba(71, 230, 165, 0.8)";
    ctx.font = "12px monospace";
    ctx.fillText("PLANT 03 RECONCILED THERMODYNAMICS & VIBRATION", 24, 56);

    ctx.strokeStyle = "rgba(0, 229, 255, 0.25)";
    ctx.beginPath();
    ctx.moveTo(24, 68);
    ctx.lineTo(488, 68);
    ctx.stroke();

    // Metric 1: Shaft Speed
    ctx.fillStyle = "#8fa598";
    ctx.font = "13px monospace";
    ctx.fillText("ROTOR SPEED:", 24, 100);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 20px monospace";
    ctx.fillText(`${rpm.toFixed(0)} RPM (49.7 Hz)`, 160, 100);

    // Metric 2: Overall Vibration Velocity
    ctx.fillStyle = "#8fa598";
    ctx.font = "13px monospace";
    ctx.fillText("RMS VELOCITY:", 24, 138);
    ctx.fillStyle = rms > 3.0 ? "#ffaa00" : "#47e6a5";
    ctx.font = "bold 20px monospace";
    ctx.fillText(`${rms.toFixed(2)} mm/s [ISO 10816 CLASS II]`, 160, 138);

    // Metric 3: Bearing Degradation Indicator
    ctx.fillStyle = "#8fa598";
    ctx.font = "13px monospace";
    ctx.fillText("BPFO SIGNATURE:", 24, 176);
    ctx.fillStyle = "#ff0055";
    ctx.font = "bold 18px monospace";
    ctx.fillText(`DETECTED (+${(bpfoRatio * 100).toFixed(1)}% OVER BASELINE)`, 160, 176);

    // Dynamic Spectrum Mini-Bar Graph
    ctx.fillStyle = "rgba(0, 229, 255, 0.15)";
    ctx.fillRect(24, 200, 464, 45);
    for (let i = 0; i < 40; i++) {
      const h = Math.min(38, Math.max(4, Math.sin(i * 0.4 + Date.now() * 0.005) * 16 + 18));
      ctx.fillStyle = i === 25 ? "#ff0055" : (i === 6 ? "#00e5ff" : "rgba(71, 230, 165, 0.7)");
      ctx.fillRect(28 + i * 11.2, 240 - h, 7, h);
    }

    // Holt Damped Forecast Gate Status
    ctx.fillStyle = "#47e6a5";
    ctx.font = "12px monospace";
    ctx.fillText("HOLT DAMPED TREND FORECAST: 17/17 GATES PASSED", 24, 276);
    ctx.fillStyle = "#8fa598";
    ctx.fillText("MAINTENANCE RESET CONFIRMATION QUEUED FOR TURNAROUND", 24, 296);
  }

  const hudTexture = new THREE.CanvasTexture(hudCanvas);
  hudTexture.minFilter = THREE.LinearFilter;
  const hudGeo = new THREE.PlaneGeometry(4.8, 3.0);
  const hudMat = new THREE.MeshBasicMaterial({
    map: hudTexture,
    transparent: true,
    opacity: 0.92,
    side: THREE.DoubleSide
  });
  const hudMesh = new THREE.Mesh(hudGeo, hudMat);
  hudMesh.position.set(-4.8, 3.2, 3.0);
  hudMesh.rotation.y = 0.32;
  hudMesh.rotation.x = -0.12;
  root.add(hudMesh);

  // Return lifecycle hooks
  let lastHudUpdate = 0;

  return {
    update(time, pointerNorm) {
      // 1. Update waterfall shader uniforms
      waterfallUniforms.uTime.value = time;
      waterfallUniforms.uPointerX.value = pointerNorm.x;

      // 2. Rotate compressor turbine shaft & blisks
      const rotSpeed = 3.8;
      shaftGroup.rotation.x += 0.05;
      rotorBlisks.forEach(blisk => {
        blisk.rotation.x += 0.05;
      });

      // 3. Pulse bearing fault diagnostic rings
      const pulse = 0.5 + 0.5 * Math.sin(time * 8.0);
      bearingRings.forEach(ring => {
        ring.material.opacity = 0.5 + pulse * 0.5;
        ring.scale.setScalar(1.0 + pulse * 0.08);
      });

      // 4. Pulsing laser sensor beam
      laserBeam.material.opacity = 0.6 + 0.4 * Math.sin(time * 15.0);

      // 5. Interactive gentle parallax tilt
      root.rotation.y = pointerNorm.x * 0.12;
      root.rotation.x = pointerNorm.y * 0.08;

      // 6. Refresh HUD canvas every 200ms
      const now = performance.now();
      if (now - lastHudUpdate > 180) {
        lastHudUpdate = now;
        const rpm = 2980 + Math.sin(time * 2.0) * 15;
        const rms = 3.38 + Math.sin(time * 1.5) * 0.18;
        const bpfoRatio = 0.28 + Math.sin(time * 3.0) * 0.08;
        drawCbmHud(rpm, rms, bpfoRatio);
        hudTexture.needsUpdate = true;
      }
    },
    destroy() {
      geometry.dispose();
      waterfallMaterial.dispose();
      wireMat.dispose();
      shaftGeo.dispose();
      shaftMat.dispose();
      hudGeo.dispose();
      hudMat.dispose();
      hudTexture.dispose();
      scene.remove(root);
    }
  };
}
