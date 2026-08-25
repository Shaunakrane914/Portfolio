import * as THREE from "./assets/vendor/three.module.min.js";

const canvas = document.querySelector(".project-hero-canvas[data-project-scene]");

if (canvas) {
  const hero = canvas.closest(".proj-hero");
  const sceneName = canvas.dataset.projectScene;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
  const palette = {
    aegis: { accent: 0x78b6ff, hot: 0xffb56b, dark: 0x07101a },
    gridium: { accent: 0xffa35d, hot: 0x7fe4ba, dark: 0x100b07 },
    compressor: { accent: 0x62f0bd, hot: 0xffbd4a, dark: 0x07100d },
    topoflow: { accent: 0x68c8ff, hot: 0x35f0c0, dark: 0x070e13 },
    food: { accent: 0xf6c85f, hot: 0x6fd7ff, dark: 0x100e07 },
    yield: { accent: 0x85e69a, hot: 0xffd36c, dark: 0x071108 }
  }[sceneName] || { accent: 0x7fe4ba, hot: 0xffffff, dark: 0x070a08 };

  let seedState = 914;
  const random = () => {
    seedState = (seedState * 1664525 + 1013904223) >>> 0;
    return seedState / 4294967296;
  };

  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: false,
    antialias: true,
    powerPreference: "high-performance",
    preserveDrawingBuffer: true
  });
  renderer.setClearColor(palette.dark, 1);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, coarsePointer ? 1.35 : 1.85));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(palette.dark);
  scene.fog = new THREE.FogExp2(palette.dark, 0.026);
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 80);
  camera.position.set(0, 0.5, 14.5);

  const root = new THREE.Group();
  scene.add(root);

  const ambient = new THREE.HemisphereLight(0xd6e8ff, 0x090d0b, 1.05);
  scene.add(ambient);
  const key = new THREE.DirectionalLight(0xffffff, 3.4);
  key.position.set(4, 8, 9);
  scene.add(key);
  const edge = new THREE.PointLight(palette.accent, 55, 20, 2);
  edge.position.set(4.8, 1.5, 4.5);
  scene.add(edge);
  const warm = new THREE.PointLight(palette.hot, 35, 17, 2);
  warm.position.set(2.6, -3, 3);
  scene.add(warm);

  const backLight = new THREE.DirectionalLight(0x708dff, 1.35);
  backLight.position.set(-8, 2, -7);
  scene.add(backLight);

  function metal(color = 0x263038, options = {}) {
    return new THREE.MeshPhysicalMaterial({
      color,
      roughness: options.roughness ?? 0.25,
      metalness: options.metalness ?? 0.82,
      clearcoat: options.clearcoat ?? 0.6,
      clearcoatRoughness: options.clearcoatRoughness ?? 0.2,
      emissive: options.emissive ?? 0x000000,
      emissiveIntensity: options.emissiveIntensity ?? 0,
      transparent: options.opacity !== undefined && options.opacity < 1,
      opacity: options.opacity ?? 1,
      side: options.side ?? THREE.FrontSide,
      depthWrite: options.depthWrite ?? true
    });
  }

  function glass(color = palette.accent, opacity = 0.16) {
    return new THREE.MeshPhysicalMaterial({
      color,
      roughness: 0.08,
      metalness: 0.12,
      transmission: 0.35,
      thickness: 0.5,
      transparent: true,
      opacity,
      side: THREE.DoubleSide,
      depthWrite: false
    });
  }

  function glow(color = palette.accent, intensity = 1.5, opacity = 1) {
    return new THREE.MeshBasicMaterial({
      color,
      transparent: opacity < 1,
      opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
  }

  function lineMaterial(color = palette.accent, opacity = 0.55) {
    return new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
  }

  function addCurve(parent, points, color = palette.accent, radius = 0.012, opacity = 0.5) {
    const curve = new THREE.CatmullRomCurve3(points);
    const geometry = new THREE.TubeGeometry(curve, Math.max(18, points.length * 8), radius, 5, false);
    const tube = new THREE.Mesh(geometry, metal(color, {
      roughness: 0.3,
      metalness: 0.35,
      emissive: color,
      emissiveIntensity: 0.45,
      opacity,
      depthWrite: false
    }));
    parent.add(tube);
    return curve;
  }

  function addStarField(parent, count = 120, width = 12, height = 9, depth = 8) {
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      positions[i * 3] = (random() - 0.25) * width;
      positions[i * 3 + 1] = (random() - 0.5) * height;
      positions[i * 3 + 2] = (random() - 0.5) * depth;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const points = new THREE.Points(geometry, new THREE.PointsMaterial({
      color: palette.accent,
      size: 0.028,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    }));
    parent.add(points);
    return points;
  }

  function createScreenTexture(title, rows, accent = "#7fe4ba") {
    const screen = document.createElement("canvas");
    screen.width = 768;
    screen.height = 432;
    const context = screen.getContext("2d");
    context.fillStyle = "#08100f";
    context.fillRect(0, 0, screen.width, screen.height);
    context.fillStyle = "#101b19";
    context.fillRect(18, 18, screen.width - 36, screen.height - 36);
    context.strokeStyle = accent;
    context.lineWidth = 4;
    context.strokeRect(20, 20, screen.width - 40, screen.height - 40);
    context.fillStyle = accent;
    context.font = "600 31px ui-monospace, SFMono-Regular, Menlo, monospace";
    context.fillText(title.toUpperCase(), 48, 70);
    context.fillStyle = "#8aa49e";
    context.font = "500 20px ui-monospace, SFMono-Regular, Menlo, monospace";
    context.fillText("LIVE SYSTEM TRACE", 48, 105);
    context.strokeStyle = "rgba(127,228,186,.18)";
    context.lineWidth = 2;
    for (let y = 145; y <= 360; y += 54) {
      context.beginPath();
      context.moveTo(48, y);
      context.lineTo(720, y);
      context.stroke();
    }
    rows.forEach((row, index) => {
      const y = 150 + index * 54;
      context.fillStyle = "#b6c7c2";
      context.font = "500 22px ui-monospace, SFMono-Regular, Menlo, monospace";
      context.fillText(row[0], 48, y + 32);
      context.fillStyle = index === 0 ? accent : "#f2f7f5";
      context.font = "700 24px ui-monospace, SFMono-Regular, Menlo, monospace";
      context.textAlign = "right";
      context.fillText(row[1], 710, y + 32);
      context.textAlign = "left";
    });
    const texture = new THREE.CanvasTexture(screen);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
    return texture;
  }

  function addInstrumentScreen(parent, position, rotation, size, title, rows, accent = "#7fe4ba") {
    const screenGroup = new THREE.Group();
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(size[0] + 0.14, size[1] + 0.14, 0.09),
      metal(0x1a2423, { roughness: 0.22, metalness: 0.72 })
    );
    const display = new THREE.Mesh(
      new THREE.PlaneGeometry(size[0], size[1]),
      new THREE.MeshBasicMaterial({
        map: createScreenTexture(title, rows, accent),
        toneMapped: false
      })
    );
    display.position.z = 0.051;
    screenGroup.add(frame, display);
    screenGroup.position.set(...position);
    screenGroup.rotation.set(...rotation);
    parent.add(screenGroup);
    return screenGroup;
  }

  const environment = new THREE.Group();
  scene.add(environment);
  const studioGrid = new THREE.GridHelper(34, 34, 0x1b2a25, 0x111a17);
  studioGrid.position.y = -3.75;
  studioGrid.material.transparent = true;
  studioGrid.material.opacity = 0.22;
  environment.add(studioGrid);
  addStarField(environment, coarsePointer ? 90 : 180, 24, 12, 18);

  [4.5, 7.5, 11.5].forEach((radius, index) => {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(radius, 0.008, 4, 160),
      glow(index === 0 ? palette.accent : 0x31413a, 1, index === 0 ? 0.22 : 0.1)
    );
    ring.position.y = -3.72;
    ring.rotation.x = Math.PI / 2;
    environment.add(ring);
  });

  function buildAegis() {
    root.position.set(3.2, 0.1, 0);
    root.rotation.set(-0.04, -0.14, 0.02);

    const aegisGroup = new THREE.Group();
    root.add(aegisGroup);

    // --- 1. CENTRAL SHA-256 CLAIM INGESTION CORE ---
    const ingestionCore = new THREE.Group();
    ingestionCore.position.set(-2.8, 0, 0);
    aegisGroup.add(ingestionCore);

    const coreBase = new THREE.Mesh(
      new THREE.CylinderGeometry(1.25, 1.35, 0.28, 48),
      metal(0x182433, { roughness: 0.2, metalness: 0.88, emissive: palette.accent, emissiveIntensity: 0.12 })
    );
    ingestionCore.add(coreBase);

    const hashRingOuter = new THREE.Mesh(
      new THREE.TorusGeometry(1.42, 0.035, 10, 72),
      metal(palette.accent, { roughness: 0.15, emissive: palette.accent, emissiveIntensity: 0.45 })
    );
    hashRingOuter.rotation.x = Math.PI / 2;
    ingestionCore.add(hashRingOuter);

    const hashRingInner = new THREE.Mesh(
      new THREE.TorusGeometry(1.05, 0.025, 8, 60),
      glow(palette.hot, 1, 0.8)
    );
    hashRingInner.rotation.x = Math.PI / 2;
    ingestionCore.add(hashRingInner);

    // Crypto bit pillars inside ingestion core
    const bitPillars = [];
    for (let b = 0; b < 8; b += 1) {
      const angle = (b / 8) * Math.PI * 2;
      const pillar = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.85, 0.12),
        metal(b % 2 === 0 ? palette.accent : palette.hot, { roughness: 0.2, emissive: b % 2 === 0 ? palette.accent : palette.hot, emissiveIntensity: 0.35 })
      );
      pillar.position.set(Math.cos(angle) * 0.78, 0.42, Math.sin(angle) * 0.78);
      ingestionCore.add(pillar);
      bitPillars.push(pillar);
    }

    // --- 2. FOUR SPECIALIST AGENT HUB NODES (DAG AGENTS) ---
    const agentNodes = [
      { name: "Scout Agent", subtitle: "Narrative & RSS Scanner", pos: [-0.6, 2.1, 0.8], color: 0x47e6a5, type: "radar" },
      { name: "Trending Agent", subtitle: "Viral Anomaly Detector", pos: [0.8, -1.8, 1.2], color: 0xffb56b, type: "spikes" },
      { name: "Market Intel Agent", subtitle: "Financial Telemetry", pos: [2.2, 1.4, -0.4], color: 0x6698ff, type: "bars" },
      { name: "Verdict Synthesizer", subtitle: "State Engine & DB", pos: [4.1, -0.3, 0.2], color: 0xf4c95d, type: "crystal" }
    ];

    const agentMeshes = [];
    agentNodes.forEach((agentDef) => {
      const nodeGroup = new THREE.Group();
      nodeGroup.position.set(...agentDef.pos);

      // Node Base Plinth
      const plinth = new THREE.Mesh(
        new THREE.CylinderGeometry(0.72, 0.82, 0.22, 32),
        metal(0x131d27, { roughness: 0.3, metalness: 0.75 })
      );
      nodeGroup.add(plinth);

      // Orbit Ring
      const orbit = new THREE.Mesh(
        new THREE.TorusGeometry(0.92, 0.018, 6, 48),
        glow(agentDef.color, 1, 0.65)
      );
      orbit.rotation.x = Math.PI / 2;
      nodeGroup.add(orbit);

      if (agentDef.type === "radar") {
        // Radar dish for Scout Agent
        const dish = new THREE.Mesh(
          new THREE.CylinderGeometry(0.55, 0.1, 0.35, 24, 1, true),
          metal(agentDef.color, { roughness: 0.2, metalness: 0.85, emissive: agentDef.color, emissiveIntensity: 0.25 })
        );
        dish.position.y = 0.45;
        dish.rotation.x = -0.4;
        nodeGroup.add(dish);
      } else if (agentDef.type === "spikes") {
        // Anomaly spike array for Trending Agent
        for (let s = -2; s <= 2; s += 1) {
          const spike = new THREE.Mesh(
            new THREE.ConeGeometry(0.08, 0.6 + Math.abs(s) * 0.15, 8),
            glow(agentDef.color, 1, 0.85)
          );
          spike.position.set(s * 0.18, 0.45 + Math.abs(s) * 0.08, 0);
          nodeGroup.add(spike);
        }
      } else if (agentDef.type === "bars") {
        // Financial ticker bars for Market Intel Agent
        [-0.22, 0, 0.22].forEach((offset, idx) => {
          const bar = new THREE.Mesh(
            new THREE.BoxGeometry(0.14, 0.5 + idx * 0.2, 0.14),
            metal(agentDef.color, { roughness: 0.25, emissive: agentDef.color, emissiveIntensity: 0.4 })
          );
          bar.position.set(offset, 0.35 + idx * 0.1, 0);
          nodeGroup.add(bar);
        });
      } else {
        // Verdict Synthesizer Crystal
        const crystal = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.48, 0),
          metal(agentDef.color, { roughness: 0.1, metalness: 0.9, emissive: agentDef.color, emissiveIntensity: 0.5, clearcoat: 0.8 })
        );
        crystal.position.y = 0.55;
        nodeGroup.add(crystal);
      }

      nodeGroup.userData.type = agentDef.type;
      nodeGroup.userData.color = agentDef.color;
      aegisGroup.add(nodeGroup);
      agentMeshes.push(nodeGroup);
    });

    // --- 3. DAG PIPELINE PATHS ---
    const dagConnections = [
      { from: ingestionCore.position, to: agentMeshes[0].position, color: 0x47e6a5 },
      { from: ingestionCore.position, to: agentMeshes[1].position, color: 0xffb56b },
      { from: agentMeshes[0].position, to: agentMeshes[2].position, color: 0x6698ff },
      { from: agentMeshes[1].position, to: agentMeshes[2].position, color: 0x6698ff },
      { from: agentMeshes[2].position, to: agentMeshes[3].position, color: 0xf4c95d }
    ];

    const dagCurves = [];
    dagConnections.forEach((conn) => {
      const mid = conn.from.clone().lerp(conn.to, 0.5);
      mid.y += 0.45;
      const curve = addCurve(aegisGroup, [conn.from, mid, conn.to], conn.color, 0.016, 0.65);
      dagCurves.push({ curve, color: conn.color });
    });

    // --- 4. ANIMATED CLAIM JOB PACKETS ---
    const claimPackets = [];
    dagCurves.forEach((item, idx) => {
      const packet = new THREE.Mesh(
        new THREE.SphereGeometry(0.065, 12, 12),
        glow(item.color, 2, 1)
      );
      packet.userData.curve = item.curve;
      packet.userData.progress = (idx * 0.22) % 1;
      packet.userData.speed = 0.12 + random() * 0.08;
      aegisGroup.add(packet);
      claimPackets.push(packet);
    });

    // --- 5. REALTIME TELEMETRY INSTRUMENT DISPLAY ---
    addInstrumentScreen(aegisGroup, [-2.2, 2.3, 1.2], [-0.35, 0.22, 0], [2.35, 1.32], "Aegis Engine", [
      ["CLAIM", "sha256:7d9f..."],
      ["PIPELINE", "2-stage async"],
      ["SPECIALISTS", "Scout + Trending"],
      ["VERDICT", "MISLEADING 88%"]
    ], "#47e6a5");

    addStarField(aegisGroup, 140, 14, 8, 10);

    root.userData.update = (time) => {
      aegisGroup.rotation.y = Math.sin(time * 0.12) * 0.035;
      hashRingOuter.rotation.z = time * 0.35;
      hashRingInner.rotation.z = -time * 0.55;

      bitPillars.forEach((p, idx) => {
        p.position.y = 0.42 + Math.sin(time * 2.5 + idx) * 0.12;
      });

      agentMeshes.forEach((agent, idx) => {
        agent.rotation.y = time * (0.2 + idx * 0.05);
        agent.position.y = agentNodes[idx].pos[1] + Math.sin(time * 1.4 + idx) * 0.04;
      });

      claimPackets.forEach((packet) => {
        packet.userData.progress = (packet.userData.progress + 0.004 * packet.userData.speed) % 1;
        packet.position.copy(packet.userData.curve.getPointAt(packet.userData.progress));
      });
    };
  }

  function buildGridium() {
    root.position.set(3.7, -0.72, 0.1);
    root.rotation.set(0.48, -0.1, -0.07);
    const network = new THREE.Group();
    root.add(network);

    const deck = new THREE.Mesh(
      new THREE.BoxGeometry(11.8, 0.16, 8.25),
      metal(0x121917, { roughness: 0.52, metalness: 0.36 })
    );
    deck.position.y = -0.13;
    network.add(deck);
    const deckEdge = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(11.82, 0.18, 8.27)),
      lineMaterial(0x628275, 0.36)
    );
    deckEdge.position.y = -0.13;
    network.add(deckEdge);

    const gridPositions = [];
    for (let i = -7; i <= 7; i += 1) {
      gridPositions.push(-5.8, -0.03, i * 0.55, 5.8, -0.03, i * 0.55, i * 0.55, -0.03, -4, i * 0.55, -0.03, 4);
    }
    const gridGeometry = new THREE.BufferGeometry();
    gridGeometry.setAttribute("position", new THREE.Float32BufferAttribute(gridPositions, 3));
    const grid = new THREE.LineSegments(gridGeometry, lineMaterial(0x7d8d86, 0.16));
    network.add(grid);

    // --- CENTRAL CONSTANT-PRODUCT AMM POOL & ZK-SNARK PROOF RING ---
    const ammCore = new THREE.Group();
    ammCore.position.set(0, 0, -0.2);
    network.add(ammCore);

    const ammLiquidityPool = new THREE.Mesh(
      new THREE.CylinderGeometry(1.35, 1.35, 0.38, 48),
      metal(palette.accent, { roughness: 0.2, metalness: 0.85, emissive: palette.accent, emissiveIntensity: 0.25 })
    );
    ammLiquidityPool.position.y = 0.19;
    ammCore.add(ammLiquidityPool);

    const zkProofRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.68, 0.038, 8, 80),
      glow(palette.hot, 1.2, 0.9)
    );
    zkProofRing.rotation.x = Math.PI / 2;
    zkProofRing.position.y = 0.22;
    ammCore.add(zkProofRing);

    // DDPG Reinforcement Learning Fee Gauge
    const ddpgGauge = new THREE.Mesh(
      new THREE.TorusGeometry(0.85, 0.045, 6, 36, Math.PI * 1.4),
      metal(palette.hot, { roughness: 0.15, emissive: palette.hot, emissiveIntensity: 0.6 })
    );
    ddpgGauge.rotation.x = Math.PI / 2;
    ddpgGauge.rotation.z = -Math.PI * 0.7;
    ddpgGauge.position.y = 0.42;
    ammCore.add(ddpgGauge);

    // --- 15 PROSUMER MICROGRID NODES ---
    const coordinates = [
      [-4.2, -2.4], [-2.2, -2.7], [0, -2.8], [2.3, -2.5], [4.3, -2.1],
      [-3.5, -0.3], [-1.5, -0.6], [0.7, -0.2], [2.7, -0.5], [4.1, 0.2],
      [-3, 1.8], [-0.9, 1.65], [1.4, 1.8], [3.55, 1.65], [0.4, 3.1]
    ];
    const nodeMeshes = [];
    coordinates.forEach(([x, z], index) => {
      const node = new THREE.Group();
      const isTransformer = index === 7;
      const assetType = isTransformer ? "transformer" : index % 3 === 0 ? "solar" : index % 3 === 1 ? "battery" : "prosumer";
      const plinth = new THREE.Mesh(
        new THREE.BoxGeometry(isTransformer ? 0.78 : 0.58, 0.12, isTransformer ? 0.68 : 0.52),
        metal(isTransformer ? 0x453022 : 0x202a27, {
          roughness: 0.42,
          metalness: 0.6,
          emissive: isTransformer ? palette.hot : 0x000000,
          emissiveIntensity: isTransformer ? 0.16 : 0
        })
      );
      plinth.position.y = 0.06;
      node.add(plinth);

      let connectorHeight = 0.72;
      if (assetType === "transformer") {
        const transformer = new THREE.Mesh(
          new THREE.BoxGeometry(0.58, 0.86, 0.5),
          metal(0x554a3b, { roughness: 0.3, metalness: 0.75 })
        );
        transformer.position.y = 0.56;
        node.add(transformer);
        for (let fin = -2; fin <= 2; fin += 1) {
          const coolingFin = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.64, 0.58), metal(0x2d302d, { roughness: 0.28 }));
          coolingFin.position.set(fin * 0.1, 0.56, 0);
          node.add(coolingFin);
        }
        [-0.17, 0, 0.17].forEach((offset) => {
          const insulator = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.26, 10), metal(0xa6a08e, { roughness: 0.5, metalness: 0.2 }));
          insulator.position.set(offset, 1.12, 0);
          node.add(insulator);
        });
        connectorHeight = 1.18;
      } else if (assetType === "solar") {
        const pedestal = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.42, 0.1), metal(0x626c69));
        pedestal.position.y = 0.32;
        node.add(pedestal);
        const panel = new THREE.Group();
        const panelBody = new THREE.Mesh(
          new THREE.BoxGeometry(0.86, 0.045, 0.58),
          metal(0x163549, { roughness: 0.2, metalness: 0.55, emissive: 0x0d2f44, emissiveIntensity: 0.14 })
        );
        panel.add(panelBody);
        for (let cell = -2; cell <= 2; cell += 1) {
          const trace = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.052, 0.52), glow(0x70b8d8, 1, 0.35));
          trace.position.x = cell * 0.14;
          panel.add(trace);
        }
        panel.position.y = 0.62;
        panel.rotation.x = -0.24;
        node.add(panel);
      } else if (assetType === "battery") {
        const cabinet = new THREE.Mesh(
          new THREE.BoxGeometry(0.55, 0.82, 0.46),
          metal(0x293431, { roughness: 0.28, metalness: 0.72 })
        );
        cabinet.position.y = 0.53;
        node.add(cabinet);
        for (let module = 0; module < 4; module += 1) {
          const moduleLine = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.035, 0.02), glow(palette.accent, 1, 0.42));
          moduleLine.position.set(0, 0.29 + module * 0.16, 0.241);
          node.add(moduleLine);
        }
      } else {
        const building = new THREE.Mesh(
          new THREE.BoxGeometry(0.66, 0.62, 0.58),
          metal(0x303733, { roughness: 0.48, metalness: 0.4 })
        );
        building.position.y = 0.42;
        node.add(building);
        const roof = new THREE.Mesh(
          new THREE.BoxGeometry(0.72, 0.04, 0.64),
          metal(0x1b4556, { roughness: 0.2, emissive: 0x0d2f44, emissiveIntensity: 0.1 })
        );
        roof.position.set(0, 0.75, 0);
        roof.rotation.x = -0.12;
        node.add(roof);
      }

      const contact = new THREE.Mesh(
        new THREE.TorusGeometry(isTransformer ? 0.54 : 0.39, 0.018, 5, 36),
        glow(isTransformer ? palette.hot : palette.accent, 1, isTransformer ? 0.78 : 0.45)
      );
      contact.rotation.x = Math.PI / 2;
      contact.position.y = 0.025;
      node.add(contact);
      node.position.set(x, 0, z);
      node.userData.height = connectorHeight;
      node.userData.phase = random() * 6;
      node.userData.contact = contact;
      network.add(node);
      nodeMeshes.push(node);
    });

    const linkPairs = [[0,1],[1,6],[2,7],[3,8],[4,9],[5,6],[6,7],[7,8],[8,9],[5,10],[6,11],[7,12],[8,13],[10,11],[11,12],[12,13],[11,14],[12,14],[1,2],[2,3]];
    const routes = [];
    linkPairs.forEach(([a, b], index) => {
      const start = new THREE.Vector3(coordinates[a][0], nodeMeshes[a].userData.height, coordinates[a][1]);
      const end = new THREE.Vector3(coordinates[b][0], nodeMeshes[b].userData.height, coordinates[b][1]);
      const mid = start.clone().lerp(end, 0.5);
      mid.y += 0.22 + index % 3 * 0.07;
      routes.push(addCurve(network, [start, mid, end], index % 5 === 0 ? palette.hot : palette.accent, 0.014, 0.58));
    });

    const packets = [];
    routes.forEach((route, index) => {
      if (index % 2 !== 0) return;
      const packet = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), glow(index % 5 === 0 ? palette.hot : palette.accent));
      packet.userData.route = route;
      packet.userData.offset = random();
      packet.userData.speed = 0.09 + random() * 0.1;
      network.add(packet);
      packets.push(packet);
    });

    addInstrumentScreen(network, [-3.95, 1.55, 2.95], [-0.48, 0.18, 0], [2.3, 1.3], "Grid Balance", [
      ["NET LOAD", "+14.2 kW"],
      ["DDPG FEE", "1.42% (Swap)"],
      ["ZK-PROOF", "VERIFIED (Groth16)"],
      ["BATTERY", "64.2% SoC"]
    ], "#ffa35d");

    addStarField(network, 80, 11, 4, 8);
    root.userData.update = (time) => {
      network.rotation.y = Math.sin(time * 0.18) * 0.045;
      zkProofRing.rotation.z = time * 0.45;
      ddpgGauge.rotation.z = -Math.PI * 0.7 + Math.sin(time * 1.8) * 0.35;

      nodeMeshes.forEach((node, index) => {
        node.position.y = Math.sin(time * 0.8 + node.userData.phase) * 0.018;
        node.userData.contact.rotation.z = time * (index % 2 ? -0.1 : 0.08);
      });
      packets.forEach((packet) => {
        const progress = (packet.userData.offset + time * packet.userData.speed) % 1;
        packet.position.copy(packet.userData.route.getPointAt(progress));
      });
    };
  }

  function buildCompressor() {
    root.position.set(3.8, -0.05, 0.25);
    root.rotation.set(-0.06, -0.23, 0.03);
    const machine = new THREE.Group();
    root.add(machine);

    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 9.4, 32), metal(0x727b7d, { roughness: 0.12 }));
    shaft.rotation.z = Math.PI / 2;
    machine.add(shaft);

    const rotorGroup = new THREE.Group();
    machine.add(rotorGroup);
    const bladeProfile = new THREE.Shape();
    bladeProfile.moveTo(-0.07, 0.34);
    bladeProfile.bezierCurveTo(-0.05, 0.58, 0.02, 0.88, 0.16, 1.22);
    bladeProfile.bezierCurveTo(0.2, 1.34, 0.11, 1.42, 0.01, 1.31);
    bladeProfile.bezierCurveTo(-0.1, 1.04, -0.17, 0.7, -0.15, 0.39);
    bladeProfile.closePath();
    const bladeGeometry = new THREE.ExtrudeGeometry(bladeProfile, {
      depth: 0.12,
      bevelEnabled: true,
      bevelSegments: 2,
      bevelSize: 0.018,
      bevelThickness: 0.014,
      curveSegments: 8
    });
    bladeGeometry.translate(0, 0, -0.06);
    bladeGeometry.rotateY(Math.PI / 2);
    bladeGeometry.computeVertexNormals();
    const bladeMaterial = metal(0xa4afad, { roughness: 0.17, metalness: 0.94, clearcoat: 0.78 });
    const bladeCount = 7 * 26;
    const blades = new THREE.InstancedMesh(bladeGeometry, bladeMaterial, bladeCount);
    const matrixHelper = new THREE.Object3D();
    let bladeIndex = 0;
    const rotors = [];
    for (let stage = 0; stage < 7; stage += 1) {
      const x = -3.55 + stage * 1.14;
      const rotor = new THREE.Mesh(new THREE.CylinderGeometry(1.18 - stage * 0.025, 1.18 - stage * 0.025, 0.16, 64), metal(stage > 4 ? 0x6d5124 : 0x545d60, {
        roughness: 0.18,
        emissive: stage > 4 ? palette.hot : 0x000000,
        emissiveIntensity: stage > 4 ? 0.14 : 0
      }));
      rotor.rotation.z = Math.PI / 2;
      rotor.position.x = x;
      rotorGroup.add(rotor);
      rotors.push(rotor);
      for (let blade = 0; blade < 26; blade += 1) {
        const angle = blade / 26 * Math.PI * 2;
        matrixHelper.position.set(x + Math.sin(stage * 0.45) * 0.018, 0, 0);
        matrixHelper.rotation.set(angle + stage * 0.085, 0, 0);
        matrixHelper.scale.set(1, 0.94 - stage * 0.015, 0.86);
        matrixHelper.updateMatrix();
        blades.setMatrixAt(bladeIndex, matrixHelper.matrix);
        bladeIndex += 1;
      }
    }
    blades.instanceMatrix.needsUpdate = true;
    rotorGroup.add(blades);

    const casing = new THREE.Mesh(new THREE.CylinderGeometry(1.48, 1.48, 9.15, 48, 1, true, -Math.PI * 0.68, Math.PI * 1.34), glass(0x9cc5b7, 0.075));
    casing.rotation.z = Math.PI / 2;
    casing.rotation.x = Math.PI / 2;
    machine.add(casing);
    const casingEdges = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.CylinderGeometry(1.5, 1.5, 9.2, 32, 2, true)),
      lineMaterial(0xb0c0bc, 0.18)
    );
    casingEdges.rotation.z = Math.PI / 2;
    machine.add(casingEdges);

    const skid = new THREE.Mesh(
      new THREE.BoxGeometry(9.8, 0.24, 2.35),
      metal(0x202a29, { roughness: 0.48, metalness: 0.74 })
    );
    skid.position.y = -1.72;
    machine.add(skid);
    const skidEdge = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(9.82, 0.26, 2.37)),
      lineMaterial(0x78958c, 0.28)
    );
    skidEdge.position.y = -1.72;
    machine.add(skidEdge);

    [-4.32, 4.32].forEach((x, index) => {
      const bearing = new THREE.Group();
      const housing = new THREE.Mesh(
        new THREE.BoxGeometry(0.72, 1.05, 1.42),
        metal(0x394442, { roughness: 0.34, metalness: 0.82 })
      );
      housing.position.y = -0.68;
      const journal = new THREE.Mesh(
        new THREE.TorusGeometry(0.43, 0.12, 16, 40),
        metal(index ? 0x6b5031 : 0x586260, { roughness: 0.2, metalness: 0.9 })
      );
      journal.rotation.y = Math.PI / 2;
      bearing.add(housing, journal);
      bearing.position.x = x;
      machine.add(bearing);
    });

    [-4.72, 4.72].forEach((x, index) => {
      const flange = new THREE.Mesh(
        new THREE.TorusGeometry(1.48, 0.12, 16, 56),
        metal(index ? 0x6a5436 : 0x4f5b59, { roughness: 0.22, metalness: 0.9 })
      );
      flange.rotation.y = Math.PI / 2;
      flange.position.x = x;
      machine.add(flange);
    });

    for (let brace = -3; brace <= 3; brace += 1) {
      const support = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.65, 1.95), metal(0x2d3735, { roughness: 0.4 }));
      support.position.set(brace * 1.13, -1.36, 0);
      machine.add(support);
    }

    const probes = [];
    [-3.1, -1.85, -0.62, 0.6, 1.78, 2.95].forEach((x, index) => {
      const probe = new THREE.Group();
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.055, 0.78, 10), metal(0x303a3a));
      const head = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.28, 12), metal(index > 3 ? palette.hot : palette.accent, {
        emissive: index > 3 ? palette.hot : palette.accent,
        emissiveIntensity: 0.35
      }));
      head.position.y = 0.49;
      probe.add(stem, head);
      probe.position.set(x, 1.68, 0.08);
      machine.add(probe);
      probes.push(head);
    });

    const flow = [];
    for (let i = 0; i < 80; i += 1) {
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.025 + random() * 0.018, 6, 6), glow(i % 11 === 0 ? palette.hot : palette.accent, 1, 0.72));
      p.userData.offset = random();
      p.userData.radius = 0.45 + random() * 0.65;
      p.userData.phase = random() * Math.PI * 2;
      p.userData.speed = 0.05 + random() * 0.06;
      machine.add(p);
      flow.push(p);
    }

    root.userData.update = (time) => {
      rotorGroup.rotation.x = time * 0.42;
      probes.forEach((probe, index) => {
        probe.material.emissiveIntensity = 0.28 + (Math.sin(time * 1.7 + index) + 1) * 0.16;
      });
      flow.forEach((particle) => {
        const progress = (particle.userData.offset + time * particle.userData.speed) % 1;
        const angle = particle.userData.phase + progress * Math.PI * 8;
        const radius = particle.userData.radius * (1 - progress * 0.36);
        particle.position.set(-4.4 + progress * 8.8, Math.cos(angle) * radius, Math.sin(angle) * radius);
      });
    };
  }

  function buildTopoFlow() {
    root.position.set(3.65, 0.1, 0.2);
    root.rotation.set(-0.08, -0.2, 0.04);
    const volume = new THREE.Group();
    root.add(volume);

    const shellGeometry = new THREE.IcosahedronGeometry(3.15, 4);
    const shellPositions = shellGeometry.attributes.position;
    for (let i = 0; i < shellPositions.count; i += 1) {
      const x = shellPositions.getX(i);
      const y = shellPositions.getY(i);
      const z = shellPositions.getZ(i);
      const warp = 0.88 + Math.sin(x * 2.7 + z * 1.4) * 0.055 + Math.cos(y * 3.1) * 0.04;
      shellPositions.setXYZ(i, x * 1.15 * warp, y * 0.9 * warp, z * warp);
    }
    shellGeometry.computeVertexNormals();
    const shell = new THREE.Mesh(shellGeometry, metal(0x263136, {
      roughness: 0.78,
      metalness: 0.08,
      opacity: 0.22,
      depthWrite: false,
      side: THREE.DoubleSide
    }));
    volume.add(shell);

    const nodes = [];
    for (let i = 0; i < 150; i += 1) {
      let point;
      do {
        point = new THREE.Vector3((random() - 0.5) * 5.8, (random() - 0.5) * 4.7, (random() - 0.5) * 4.8);
      } while (point.length() > 3.05);
      point.x *= 1.18;
      nodes.push(point);
    }
    const nodePositions = new Float32Array(nodes.length * 3);
    nodes.forEach((node, index) => {
      nodePositions[index * 3] = node.x;
      nodePositions[index * 3 + 1] = node.y;
      nodePositions[index * 3 + 2] = node.z;
    });
    const nodeGeometry = new THREE.BufferGeometry();
    nodeGeometry.setAttribute("position", new THREE.BufferAttribute(nodePositions, 3));
    const nodePoints = new THREE.Points(nodeGeometry, new THREE.PointsMaterial({
      color: palette.accent,
      size: 0.055,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    }));
    volume.add(nodePoints);

    const chamberGeometry = new THREE.DodecahedronGeometry(0.21, 0);
    const chamberMaterial = metal(0x182329, {
      roughness: 0.68,
      metalness: 0.18,
      emissive: 0x0f3444,
      emissiveIntensity: 0.11
    });
    const chambers = new THREE.InstancedMesh(chamberGeometry, chamberMaterial, 48);
    const chamberMatrix = new THREE.Object3D();
    for (let chamber = 0; chamber < 48; chamber += 1) {
      const point = nodes[(chamber * 3) % nodes.length];
      chamberMatrix.position.copy(point);
      chamberMatrix.rotation.set(random() * Math.PI, random() * Math.PI, random() * Math.PI);
      chamberMatrix.scale.set(
        0.72 + random() * 1.4,
        0.62 + random() * 1.65,
        0.72 + random() * 1.3
      );
      chamberMatrix.updateMatrix();
      chambers.setMatrixAt(chamber, chamberMatrix.matrix);
      chambers.setColorAt(chamber, new THREE.Color(chamber % 9 === 0 ? palette.hot : 0x27383d));
    }
    chambers.instanceMatrix.needsUpdate = true;
    if (chambers.instanceColor) chambers.instanceColor.needsUpdate = true;
    volume.add(chambers);

    const edgePoints = [];
    nodes.forEach((node, index) => {
      const neighbors = nodes
        .map((candidate, candidateIndex) => ({ candidate, candidateIndex, distance: node.distanceTo(candidate) }))
        .filter((entry) => entry.candidateIndex !== index)
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 2);
      neighbors.forEach(({ candidate, candidateIndex }) => {
        if (candidateIndex > index) edgePoints.push(node.x, node.y, node.z, candidate.x, candidate.y, candidate.z);
      });
    });
    const edgeGeometry = new THREE.BufferGeometry();
    edgeGeometry.setAttribute("position", new THREE.Float32BufferAttribute(edgePoints, 3));
    const poreEdges = new THREE.LineSegments(edgeGeometry, lineMaterial(palette.accent, 0.28));
    volume.add(poreEdges);

    const routeNodes = nodes.slice().sort((a, b) => a.x - b.x).filter((_, index) => index % 19 === 0).slice(0, 9);
    routeNodes.unshift(new THREE.Vector3(-3.7, 0.2, 0));
    routeNodes.push(new THREE.Vector3(3.7, -0.2, 0));
    const mainRoute = addCurve(volume, routeNodes, palette.hot, 0.018, 0.52);
    const tracers = [];
    for (let i = 0; i < 20; i += 1) {
      const tracer = new THREE.Mesh(new THREE.SphereGeometry(0.026, 7, 7), glow(palette.hot, 1, 0.7));
      tracer.userData.offset = i / 20;
      volume.add(tracer);
      tracers.push(tracer);
    }

    root.userData.update = (time) => {
      volume.rotation.y = time * 0.035;
      volume.rotation.x = Math.sin(time * 0.22) * 0.045;
      tracers.forEach((tracer) => {
        const progress = (tracer.userData.offset + time * 0.055) % 1;
        tracer.position.copy(mainRoute.getPointAt(progress));
        tracer.scale.setScalar(0.65 + Math.sin(progress * Math.PI) * 0.9);
      });
    };
  }

  function buildFood() {
    root.position.set(3.72, -0.46, 0.15);
    root.rotation.set(-0.14, -0.2, 0.02);
    const machine = new THREE.Group();
    root.add(machine);

    const stainless = metal(0x7b8383, { roughness: 0.24, metalness: 0.92, clearcoat: 0.56 });
    const darkSteel = metal(0x252b2c, { roughness: 0.36, metalness: 0.8 });
    const platform = new THREE.Mesh(new THREE.BoxGeometry(7.5, 0.2, 4.65), darkSteel);
    platform.position.y = -2.25;
    machine.add(platform);
    const platformEdge = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(7.52, 0.22, 4.67)),
      lineMaterial(0x8c9693, 0.36)
    );
    platformEdge.position.y = -2.25;
    machine.add(platformEdge);

    [-3.35, 3.35].forEach((x) => {
      [-1.8, 1.8].forEach((z) => {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.16, 4.9, 0.16), stainless);
        leg.position.set(x, 0.2, z);
        machine.add(leg);
      });
    });
    const overhead = new THREE.Mesh(new THREE.BoxGeometry(7, 0.16, 0.16), stainless);
    overhead.position.set(0, 2.62, -1.8);
    machine.add(overhead);

    const belt = new THREE.Mesh(
      new THREE.BoxGeometry(6.8, 0.15, 1.02),
      metal(0x151a1a, { roughness: 0.64, metalness: 0.32 })
    );
    belt.position.set(0, -1.62, 1.05);
    machine.add(belt);
    [-0.63, 0.63].forEach((z) => {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(7, 0.14, 0.1), stainless);
      rail.position.set(0, -1.47, 1.05 + z);
      machine.add(rail);
    });
    const rollers = [];
    for (let roller = -7; roller <= 7; roller += 1) {
      const rollerMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.9, 18), metal(0x596160, { roughness: 0.28 }));
      rollerMesh.rotation.x = Math.PI / 2;
      rollerMesh.position.set(roller * 0.43, -1.52, 1.05);
      machine.add(rollerMesh);
      rollers.push(rollerMesh);
    }

    const processCells = [];
    const cellDefinitions = [
      { x: -2.15, title: "Demand", accent: "#f6c85f", rows: [["PAX", "1,248"], ["FORECAST", "+3.8%"], ["SERVICE", "DINNER"], ["CONF", "0.92"]] },
      { x: 0, title: "Inventory", accent: "#6fd7ff", rows: [["STOCK", "86.4%"], ["RISK SKU", "04"], ["INBOUND", "312 kg"], ["WASTE", "-18.7%"]] },
      { x: 2.15, title: "Cost", accent: "#7fe4ba", rows: [["TODAY", "52.8k"], ["BUDGET", "55.0k"], ["VAR", "-4.1%"], ["MARGIN", "12.6%"]] }
    ];
    cellDefinitions.forEach((definition, index) => {
      const cell = new THREE.Group();
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(1.66, 1.72, 1.55),
        metal(0x1b2021, { roughness: 0.32, metalness: 0.78 })
      );
      body.position.y = -0.38;
      cell.add(body);
      const trim = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.BoxGeometry(1.68, 1.74, 1.57)),
        lineMaterial(index === 0 ? palette.accent : index === 1 ? 0x6fd7ff : 0x7fe4ba, 0.32)
      );
      trim.position.y = -0.38;
      cell.add(trim);
      addInstrumentScreen(cell, [0, -0.25, 0.79], [0, 0, 0], [1.34, 0.76], definition.title, definition.rows, definition.accent);
      const status = new THREE.Mesh(
        new THREE.BoxGeometry(0.72, 0.028, 0.035),
        glow(index === 0 ? palette.accent : index === 1 ? 0x6fd7ff : 0x7fe4ba, 1, 0.72)
      );
      status.position.set(0, -1.08, 0.83);
      cell.add(status);
      cell.position.x = definition.x;
      cell.userData.phase = index * 1.7;
      cell.userData.status = status;
      machine.add(cell);
      processCells.push(cell);
    });

    const hopperRings = [];
    [-2.15, 0, 2.15].forEach((x, index) => {
      const hopper = new THREE.Group();
      const cone = new THREE.Mesh(
        new THREE.CylinderGeometry(0.54, 0.2, 1.12, 32, 1, false),
        metal(0x8b9291, { roughness: 0.22, metalness: 0.92 })
      );
      const cap = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.035, 8, 42), stainless);
      cap.rotation.x = Math.PI / 2;
      cap.position.y = 0.56;
      const statusRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.44, 0.014, 5, 38),
        glow(index === 0 ? palette.accent : index === 1 ? 0x6fd7ff : 0x7fe4ba, 1, 0.42)
      );
      statusRing.rotation.x = Math.PI / 2;
      statusRing.position.y = 0.18;
      hopper.add(cone, cap, statusRing);
      hopper.position.set(x, 1.86, -0.28);
      machine.add(hopper);
      hopperRings.push(statusRing);
      const feedPipe = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.82, 14), stainless);
      feedPipe.position.set(x, 0.95, -0.28);
      machine.add(feedPipe);
    });

    const scanner = new THREE.Group();
    const scannerPosts = [-0.7, 0.7].map((z) => {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.3, 0.1), stainless);
      post.position.set(0, -0.88, 1.05 + z);
      scanner.add(post);
      return post;
    });
    const scannerTop = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 1.55), darkSteel);
    scannerTop.position.set(0, -0.25, 1.05);
    scanner.add(scannerTop);
    const scanBeam = new THREE.Mesh(
      new THREE.PlaneGeometry(0.018, 1.2),
      new THREE.MeshBasicMaterial({ color: 0x6fd7ff, transparent: true, opacity: 0.24, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    scanBeam.position.set(0, -0.9, 1.05);
    scanBeam.rotation.y = Math.PI / 2;
    scanner.add(scanBeam);
    scanner.position.x = 0.55;
    machine.add(scanner);

    const parcels = [];
    for (let i = 0; i < 20; i += 1) {
      const parcel = new THREE.Mesh(
        new THREE.BoxGeometry(0.2 + random() * 0.12, 0.12 + random() * 0.08, 0.18 + random() * 0.12),
        metal(i % 4 === 0 ? 0x9f7740 : 0x6e6658, { roughness: 0.7, metalness: 0.08 })
      );
      parcel.userData.offset = random();
      machine.add(parcel);
      parcels.push(parcel);
    }
    root.userData.update = (time) => {
      machine.rotation.y = Math.sin(time * 0.2) * 0.04;
      processCells.forEach((cell) => {
        cell.userData.status.scale.x = 0.58 + (Math.sin(time * 1.2 + cell.userData.phase) + 1) * 0.2;
      });
      hopperRings.forEach((ring, index) => {
        ring.material.opacity = 0.28 + (Math.sin(time * 1.3 + index) + 1) * 0.16;
      });
      rollers.forEach((roller) => { roller.rotation.z = time * 1.2; });
      scanBeam.material.opacity = 0.14 + (Math.sin(time * 2.4) + 1) * 0.08;
      parcels.forEach((parcel) => {
        const progress = (parcel.userData.offset + time * 0.065) % 1;
        parcel.position.set(-3.15 + progress * 6.3, -1.39, 1.05 + Math.sin(parcel.userData.offset * 12) * 0.18);
        parcel.rotation.y = Math.sin(time * 0.5 + parcel.userData.offset * 8) * 0.08;
      });
    };
  }

  function buildYield() {
    root.position.set(3.58, -0.58, 0.1);
    root.rotation.set(-0.58, -0.12, -0.05);
    const twin = new THREE.Group();
    root.add(twin);

    const terrainHeight = (x, y) => Math.sin(x * 1.05) * 0.11 + Math.cos(y * 1.45) * 0.08 + Math.sin((x + y) * 2.2) * 0.035;
    const terrainGeometry = new THREE.PlaneGeometry(7.6, 5.8, 64, 48);
    const terrainPositions = terrainGeometry.attributes.position;
    for (let i = 0; i < terrainPositions.count; i += 1) {
      const x = terrainPositions.getX(i);
      const y = terrainPositions.getY(i);
      terrainPositions.setZ(i, terrainHeight(x, y));
    }
    terrainGeometry.computeVertexNormals();
    const terrain = new THREE.Mesh(terrainGeometry, metal(0x183522, { roughness: 0.9, metalness: 0.04, opacity: 0.9 }));
    twin.add(terrain);
    const terrainGrid = new THREE.Mesh(terrainGeometry.clone(), new THREE.MeshBasicMaterial({ color: palette.accent, wireframe: true, transparent: true, opacity: 0.085, depthWrite: false }));
    terrainGrid.position.z = 0.025;
    twin.add(terrainGrid);

    const contourColors = [0x3d8f5a, 0x64c878, 0xb0d66d];
    const contours = [];
    for (let row = -11; row <= 11; row += 1) {
      const y = row * 0.225;
      const points = [];
      for (let sample = 0; sample <= 42; sample += 1) {
        const x = -3.35 + sample / 42 * 6.7;
        const curvedY = y + Math.sin(x * 0.72 + row * 0.2) * 0.035;
        points.push(new THREE.Vector3(x, curvedY, terrainHeight(x, curvedY) + 0.055));
      }
      const contour = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(points),
        lineMaterial(contourColors[Math.abs(row) % contourColors.length], row % 4 === 0 ? 0.54 : 0.24)
      );
      twin.add(contour);
      contours.push(contour);
    }

    const cropGeometry = new THREE.CylinderGeometry(0.012, 0.018, 0.16, 5);
    cropGeometry.rotateX(Math.PI / 2);
    const crops = new THREE.InstancedMesh(
      cropGeometry,
      metal(0x7aaa58, { roughness: 0.78, metalness: 0.02, emissive: 0x234d2a, emissiveIntensity: 0.08 }),
      280
    );
    const cropMatrix = new THREE.Object3D();
    for (let crop = 0; crop < 280; crop += 1) {
      const row = crop % 20;
      const column = Math.floor(crop / 20);
      const x = -3.25 + row * 0.34 + Math.sin(column * 0.7) * 0.018;
      const y = -2.25 + column * 0.34;
      cropMatrix.position.set(x, y, terrainHeight(x, y) + 0.1);
      cropMatrix.rotation.z = Math.sin(crop * 0.51) * 0.08;
      cropMatrix.scale.setScalar(0.7 + random() * 0.48);
      cropMatrix.updateMatrix();
      crops.setMatrixAt(crop, cropMatrix.matrix);
      crops.setColorAt(crop, new THREE.Color(crop % 9 === 0 ? 0xb3d46a : 0x6c9d52));
    }
    crops.instanceMatrix.needsUpdate = true;
    if (crops.instanceColor) crops.instanceColor.needsUpdate = true;
    twin.add(crops);

    const boundaryPoints = [
      new THREE.Vector3(-3.25, -2.25, 0.16), new THREE.Vector3(-2.2, 2.28, 0.16),
      new THREE.Vector3(0.3, 2.55, 0.16), new THREE.Vector3(3.15, 1.4, 0.16),
      new THREE.Vector3(3.35, -1.75, 0.16), new THREE.Vector3(0.85, -2.55, 0.16),
      new THREE.Vector3(-3.25, -2.25, 0.16)
    ];
    const boundary = new THREE.Line(new THREE.BufferGeometry().setFromPoints(boundaryPoints), lineMaterial(palette.hot, 0.9));
    twin.add(boundary);

    const sensorLocations = [[-2.45, -1.3], [-0.75, 1.6], [1.15, -0.95], [2.55, 1.2]];
    const sensors = [];
    sensorLocations.forEach(([x, y], index) => {
      const station = new THREE.Group();
      const footing = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, 0.09, 12), metal(0x555c56, { roughness: 0.5 }));
      footing.rotation.x = Math.PI / 2;
      footing.position.z = 0.04;
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.024, 0.72, 10), metal(0xa8afac, { roughness: 0.2 }));
      mast.rotation.x = Math.PI / 2;
      mast.position.z = 0.4;
      const telemetry = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.012, 5, 30), glow(index % 2 ? palette.hot : palette.accent, 1, 0.68));
      telemetry.position.z = 0.78;
      const panel = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.2, 0.025), metal(0x173f4c, { roughness: 0.2, emissive: 0x123342, emissiveIntensity: 0.14 }));
      panel.position.set(0.22, 0, 0.52);
      panel.rotation.y = -0.3;
      station.add(footing, mast, telemetry, panel);
      station.position.set(x, y, terrainHeight(x, y) + 0.05);
      station.userData.telemetry = telemetry;
      twin.add(station);
      sensors.push(station);
    });

    const orbitPoints = [];
    for (let point = 0; point <= 120; point += 1) {
      const angle = point / 120 * Math.PI * 2;
      orbitPoints.push(new THREE.Vector3(Math.cos(angle) * 3.65, Math.sin(angle) * 2.4, 2.55 + Math.sin(angle * 2) * 0.12));
    }
    const orbit = new THREE.Line(new THREE.BufferGeometry().setFromPoints(orbitPoints), lineMaterial(0x69c8ff, 0.34));
    twin.add(orbit);
    const satellite = new THREE.Group();
    const satelliteBody = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.18, 0.18), metal(0xc0c7c6, { roughness: 0.18, emissive: 0x69c8ff, emissiveIntensity: 0.14 }));
    satellite.add(satelliteBody);
    [-0.33, 0.33].forEach((x) => {
      const wing = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.02, 0.18), metal(0x183b5b, { roughness: 0.18, emissive: 0x154265, emissiveIntensity: 0.18 }));
      wing.position.x = x;
      satellite.add(wing);
    });
    satellite.position.copy(orbitPoints[0]);
    twin.add(satellite);

    const soilZones = [];
    [[-1.7, 0.55, 0.72], [0.35, -1.15, 0.92], [1.95, 0.35, 0.62]].forEach(([x, y, scale], index) => {
      const zone = new THREE.Mesh(
        new THREE.CircleGeometry(scale, 48),
        new THREE.MeshBasicMaterial({
          color: index === 1 ? 0x69c8ff : palette.accent,
          transparent: true,
          opacity: 0.08,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide
        })
      );
      zone.position.set(x, y, terrainHeight(x, y) + 0.07);
      twin.add(zone);
      soilZones.push(zone);
    });

    const rain = [];
    for (let i = 0; i < 54; i += 1) {
      const drop = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.24, 4), glow(0x69c8ff, 1, 0.5));
      drop.position.set((random() - 0.5) * 6.5, (random() - 0.5) * 4.6, 0.3 + random() * 3.2);
      drop.userData.speed = 0.7 + random() * 0.8;
      twin.add(drop);
      rain.push(drop);
    }

    root.userData.update = (time, delta) => {
      terrainGrid.material.opacity = 0.065 + (Math.sin(time * 0.55) + 1) * 0.025;
      const orbitProgress = (time * 0.022) % 1;
      const orbitIndex = Math.floor(orbitProgress * (orbitPoints.length - 1));
      satellite.position.copy(orbitPoints[orbitIndex]);
      satellite.rotation.z = -time * 0.18;
      sensors.forEach((station, index) => {
        station.userData.telemetry.scale.setScalar(0.84 + Math.sin(time * 1.2 + index) * 0.1);
        station.userData.telemetry.rotation.z = time * (index % 2 ? -0.18 : 0.16);
      });
      soilZones.forEach((zone, index) => {
        zone.material.opacity = 0.045 + (Math.sin(time * 0.7 + index) + 1) * 0.025;
      });
      rain.forEach((drop) => {
        drop.position.z -= delta * drop.userData.speed;
        if (drop.position.z < 0.12) drop.position.z = 3.4;
      });
    };
  }

  const builders = {
    aegis: buildAegis,
    gridium: buildGridium,
    compressor: buildCompressor,
    topoflow: buildTopoFlow,
    food: buildFood,
    yield: buildYield
  };
  (builders[sceneName] || buildAegis)();

  const baseRotation = root.rotation.clone();
  const basePosition = root.position.clone();

  let pointerX = 0;
  let pointerY = 0;
  let visible = true;
  let lastTime = performance.now();

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, Math.floor(rect.width));
    const height = Math.max(1, Math.floor(rect.height));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.fov = width < 720 ? 40 : 34;
    camera.position.x = width < 720 ? 0.8 : 0;
    root.scale.setScalar(width < 720 ? 0.72 : 1);
    root.position.x = width < 720 ? 1.35 : basePosition.x;
    root.position.y = basePosition.y;
    root.position.z = basePosition.z;
    camera.updateProjectionMatrix();
  }

  function render(timeMs) {
    if (!visible || document.hidden) return;
    const time = timeMs * 0.001;
    const delta = Math.min((timeMs - lastTime) / 1000, 0.04);
    lastTime = timeMs;
    if (!reduceMotion) {
      root.rotation.y += (baseRotation.y + pointerX * 0.055 - root.rotation.y) * 0.025;
      root.rotation.x += (baseRotation.x - pointerY * 0.035 - root.rotation.x) * 0.025;
      root.rotation.z += (baseRotation.z + pointerX * 0.012 - root.rotation.z) * 0.02;
      root.position.y += (basePosition.y + pointerY * 0.08 - root.position.y) * 0.018;
      root.userData.update?.(time, delta);
    }
    renderer.render(scene, camera);
  }

  window.addEventListener("pointermove", (event) => {
    pointerX = (event.clientX / Math.max(window.innerWidth, 1) - 0.5) * 2;
    pointerY = (event.clientY / Math.max(window.innerHeight, 1) - 0.5) * 2;
  }, { passive: true });
  window.addEventListener("resize", resize, { passive: true });

  const observer = new IntersectionObserver((entries) => {
    visible = entries[0]?.isIntersecting ?? true;
    if (visible) {
      lastTime = performance.now();
      renderer.setAnimationLoop(render);
    } else {
      renderer.setAnimationLoop(null);
    }
  }, { threshold: 0.02 });
  observer.observe(hero || canvas);

  resize();
  renderer.setAnimationLoop(render);
}
