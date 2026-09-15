// Prototype 01: Aegis Misinformation Investigation Pipeline & Forensic Evidence Room
// Spatially communicates the true Aegis architecture:
// Claim Ingestion -> Deterministic SHA-256 Deduplication -> Bifurcated Evidence Collection (Supporting vs Refuting)
// -> Specialist Agents (Scout Market Volatility + Trending RSS) -> Reviewable Verdict Dossier.

import * as THREE from "three";

export function createAegisPipelinePrototype(scene) {
  const root = new THREE.Group();
  scene.add(root);

  // 1. Five-Stage Pipeline Guidance Rail (Floor Grid)
  // X-axis represents the 5 stages: -6 (Ingest), -3 (Identify), 0 (Research), +3 (Investigate), +6 (Review)
  const railGroup = new THREE.Group();
  railGroup.position.set(0, -1.8, 0);
  root.add(railGroup);

  const stageLabels = ["01 INGEST", "02 IDENTIFY", "03 RESEARCH", "04 INVESTIGATE", "05 VERDICT"];
  const stagePositions = [-5.6, -2.8, 0.0, 2.8, 5.6];

  // Neon pipeline track
  const trackGeo = new THREE.BoxGeometry(13.5, 0.04, 0.2);
  const trackMat = new THREE.MeshBasicMaterial({ color: 0x1f364d });
  railGroup.add(new THREE.Mesh(trackGeo, trackMat));

  stagePositions.forEach((posX, idx) => {
    // Stage waypoint pad
    const padGeo = new THREE.CylinderGeometry(0.55, 0.6, 0.08, 6);
    const padMat = new THREE.MeshStandardMaterial({
      color: 0x091c2b,
      metalness: 0.85,
      roughness: 0.25,
      emissive: idx === 2 ? 0x4da3ff : 0x071520,
      emissiveIntensity: 0.35
    });
    const pad = new THREE.Mesh(padGeo, padMat);
    pad.position.set(posX, 0.04, 0);
    railGroup.add(pad);

    // Glowing waypoint ring
    const ringGeo = new THREE.RingGeometry(0.68, 0.74, 24);
    ringGeo.rotateX(-Math.PI * 0.5);
    const ringMat = new THREE.MeshBasicMaterial({
      color: idx === 4 ? 0xffaa00 : (idx === 2 ? 0x47e6a5 : 0x4da3ff),
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.75
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.set(posX, 0.09, 0);
    railGroup.add(ring);
  });

  // 2. Stage 01 & 02: Claim Ingestion & Deterministic SHA-256 Hasher (Left, x = -4.2)
  const hasherGroup = new THREE.Group();
  hasherGroup.position.set(-4.2, 0.8, -0.4);
  root.add(hasherGroup);

  // Hexagonal Cryptographic Hasher Cylinder
  const hasherGeo = new THREE.CylinderGeometry(0.85, 0.85, 1.6, 6, 1, true);
  const hasherMat = new THREE.MeshStandardMaterial({
    color: 0x14324a,
    wireframe: true,
    transparent: true,
    opacity: 0.85
  });
  const hasherMesh = new THREE.Mesh(hasherGeo, hasherMat);
  hasherGroup.add(hasherMesh);

  // Rotating inner SHA-256 fingerprint rings
  const hashRingGeo = new THREE.TorusGeometry(0.72, 0.024, 12, 36);
  const hashRingMat = new THREE.MeshBasicMaterial({ color: 0x4da3ff, transparent: true, opacity: 0.85 });
  const hashRing1 = new THREE.Mesh(hashRingGeo, hashRingMat);
  const hashRing2 = new THREE.Mesh(hashRingGeo, hashRingMat);
  hashRing2.rotation.x = Math.PI * 0.5;
  hasherGroup.add(hashRing1);
  hasherGroup.add(hashRing2);

  // Incoming Claim Particle Stream (Simulating incoming RSS/Social headlines entering hasher)
  const streamCount = 45;
  const streamGeo = new THREE.BufferGeometry();
  const streamPos = new Float32Array(streamCount * 3);
  for (let i = 0; i < streamCount; i++) {
    streamPos[i * 3 + 0] = -1.2 + (Math.random() - 0.5) * 0.4;
    streamPos[i * 3 + 1] = 4.5 - (i / streamCount) * 4.5;
    streamPos[i * 3 + 2] = (Math.random() - 0.5) * 0.4;
  }
  streamGeo.setAttribute("position", new THREE.BufferAttribute(streamPos, 3));
  const streamMat = new THREE.PointsMaterial({
    color: 0x4da3ff,
    size: 0.09,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending
  });
  const claimStream = new THREE.Points(streamGeo, streamMat);
  hasherGroup.add(claimStream);

  // 3. Specialist Intelligence Agent Terminals (Scout & Trending)
  const specialistGroup = new THREE.Group();
  root.add(specialistGroup);

  // SCOUT AGENT TERMINAL (Market Volatility & Z-Score Analysis)
  const scoutTerminal = new THREE.Group();
  scoutTerminal.position.set(-3.2, 3.2, -2.4);
  const scoutCoreGeo = new THREE.OctahedronGeometry(0.42, 0);
  const scoutCoreMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.6,
    metalness: 0.85
  });
  const scoutCore = new THREE.Mesh(scoutCoreGeo, scoutCoreMat);
  scoutTerminal.add(scoutCore);

  const scoutRingGeo = new THREE.TorusGeometry(0.65, 0.02, 12, 36);
  const scoutRingMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.8 });
  const scoutRing = new THREE.Mesh(scoutRingGeo, scoutRingMat);
  scoutTerminal.add(scoutRing);
  specialistGroup.add(scoutTerminal);

  // TRENDING AGENT TERMINAL (Google News RSS 15-min Loop)
  const trendingTerminal = new THREE.Group();
  trendingTerminal.position.set(-0.8, 3.6, -2.6);
  const trendCoreGeo = new THREE.SphereGeometry(0.38, 16, 16);
  const trendCoreMat = new THREE.MeshStandardMaterial({
    color: 0x00e5ff,
    emissive: 0x00e5ff,
    emissiveIntensity: 0.55,
    metalness: 0.85
  });
  const trendCore = new THREE.Mesh(trendCoreGeo, trendCoreMat);
  trendingTerminal.add(trendCore);

  const trendRingGeo = new THREE.TorusGeometry(0.62, 0.02, 12, 36);
  trendRingGeo.rotateX(Math.PI * 0.4);
  const trendRingMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.8 });
  const trendRing = new THREE.Mesh(trendRingGeo, trendRingMat);
  trendingTerminal.add(trendRing);
  specialistGroup.add(trendingTerminal);

  // 4. Stage 03: Bifurcated Forensic Evidence Rack (Center, x = -0.5)
  // Structured evidence documents, NOT decorative spheres!
  const evidenceRackGroup = new THREE.Group();
  evidenceRackGroup.position.set(-0.6, 0.6, 0.2);
  root.add(evidenceRackGroup);

  // Evidence Rack Frame
  const rackFrameGeo = new THREE.BoxGeometry(4.2, 4.4, 0.08);
  const rackFrameMat = new THREE.MeshBasicMaterial({
    color: 0x0d2233,
    wireframe: true,
    transparent: true,
    opacity: 0.4
  });
  evidenceRackGroup.add(new THREE.Mesh(rackFrameGeo, rackFrameMat));

  // Left Column: Supporting Evidence Document Cards (Cyan / Emerald)
  const supportingDocs = [
    { title: "DOC #1: REUTERS WIRE", detail: "Official Denials Recorded", y: 1.3, color: 0x47e6a5 },
    { title: "DOC #2: SEC 8-K FILING", detail: "No Emergency Decrees Found", y: 0.0, color: 0x47e6a5 },
    { title: "DOC #3: GAZETTE AUDIT", detail: "Statutory Law Unaltered", y: -1.3, color: 0x47e6a5 }
  ];

  // Right Column: Refuting Context Anomaly Cards (Amber / Crimson)
  const refutingDocs = [
    { title: "FLAG #1: AUDIO SYNTHESIS", detail: "98.4% Probable Voice Clone", y: 1.3, color: 0xff0055 },
    { title: "FLAG #2: FACTCHECK DEBUNK", detail: "Pre-existing Viral Retraction", y: 0.0, color: 0xff0055 },
    { title: "FLAG #3: TIMELINE DISCORD", detail: "Source Video Pre-dates by 6mo", y: -1.3, color: 0xff0055 }
  ];

  const docMeshes = [];
  const evidenceCords = [];

  function buildEvidenceCards(docList, xPos, isSupporting) {
    docList.forEach((d) => {
      const cardGroup = new THREE.Group();
      cardGroup.position.set(xPos, d.y, 0.1);

      // Card plate
      const cardGeo = new THREE.BoxGeometry(1.7, 0.85, 0.06);
      const cardMat = new THREE.MeshStandardMaterial({
        color: 0x071520,
        metalness: 0.8,
        roughness: 0.3,
        emissive: isSupporting ? 0x052418 : 0x240710,
        emissiveIntensity: 0.5
      });
      const card = new THREE.Mesh(cardGeo, cardMat);
      cardGroup.add(card);

      // Border frame
      const borderGeo = new THREE.BoxGeometry(1.74, 0.89, 0.07);
      const borderMat = new THREE.MeshBasicMaterial({
        color: d.color,
        wireframe: true,
        transparent: true,
        opacity: 0.8
      });
      cardGroup.add(new THREE.Mesh(borderGeo, borderMat));

      // Forensic citation pin / marker
      const pinGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.25, 12);
      pinGeo.rotateX(Math.PI * 0.5);
      const pinMat = new THREE.MeshBasicMaterial({ color: d.color });
      const pin = new THREE.Mesh(pinGeo, pinMat);
      pin.position.set(-0.7, 0.3, 0.04);
      cardGroup.add(pin);

      evidenceRackGroup.add(cardGroup);
      docMeshes.push({ group: cardGroup, d });

      // Fiber-optic Evidence Conduit connecting Card to Central Claim Hasher
      const start = new THREE.Vector3(-4.2, 0.8, -0.4);
      const end = new THREE.Vector3(-0.6 + xPos, 0.6 + d.y, 0.3);
      const mid = start.clone().lerp(end, 0.5).add(new THREE.Vector3(0, (isSupporting ? 0.6 : -0.6), 0.4));
      const curve = new THREE.QuadraticBezierCurve3(start, mid, end);

      const tubeGeo = new THREE.TubeGeometry(curve, 24, 0.016, 6, false);
      const tubeMat = new THREE.MeshBasicMaterial({
        color: d.color,
        transparent: true,
        opacity: 0.4
      });
      root.add(new THREE.Mesh(tubeGeo, tubeMat));

      // Traveling evidence packet
      const pGeo = new THREE.SphereGeometry(0.055, 8, 8);
      const pMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const packet = new THREE.Mesh(pGeo, pMat);
      root.add(packet);

      evidenceCords.push({ curve, packet, offset: Math.random() });
    });
  }

  buildEvidenceCards(supportingDocs, -1.0, true);
  buildEvidenceCards(refutingDocs, 1.0, false);

  // 5. Stage 04 & 05: Reviewable Verdict Dossier Console (Right, x = 4.2)
  const hudCanvas = document.createElement("canvas");
  hudCanvas.width = 512;
  hudCanvas.height = 360;
  const ctx = hudCanvas.getContext("2d");

  function drawAegisInvestigationHud(conf) {
    ctx.clearRect(0, 0, 512, 360);

    // Deep slate backing
    ctx.fillStyle = "rgba(4, 12, 22, 0.94)";
    ctx.fillRect(0, 0, 512, 360);

    // Forensic border
    ctx.strokeStyle = "rgba(77, 163, 255, 0.8)";
    ctx.lineWidth = 2.5;
    ctx.strokeRect(4, 4, 504, 352);

    // Header bar
    ctx.fillStyle = "rgba(77, 163, 255, 0.16)";
    ctx.fillRect(4, 4, 504, 44);

    ctx.fillStyle = "#4da3ff";
    ctx.font = "bold 15px monospace";
    ctx.fillText("PROJECT AEGIS // INVESTIGATION DOSSIER", 20, 28);

    ctx.fillStyle = "#8fa598";
    ctx.font = "11px monospace";
    ctx.fillText("FASTAPI WORKER · GEMINI 2.5 FLASH · SUPABASE PERSISTENCE", 20, 64);

    // Claim Ingestion Card
    ctx.fillStyle = "rgba(10, 24, 40, 0.85)";
    ctx.fillRect(20, 76, 472, 48);
    ctx.strokeStyle = "rgba(77, 163, 255, 0.35)";
    ctx.strokeRect(20, 76, 472, 48);

    ctx.fillStyle = "#e8f5ee";
    ctx.font = "12px monospace";
    ctx.fillText("CLAIM: \"Cabinet approves emergency currency freeze\"", 28, 96);
    ctx.fillStyle = "#4da3ff";
    ctx.font = "11px monospace";
    ctx.fillText("SHA-256: 7f83b165... [DEDUPLICATED JOB INGESTED]", 28, 114);

    // 2-Stage Pipeline Status
    ctx.fillStyle = "#8fa598";
    ctx.font = "11px monospace";
    ctx.fillText("STATUS:", 20, 146);

    const stages = [
      { name: "01 INGEST", pass: true },
      { name: "02 IDENTIFY", pass: true },
      { name: "03 RESEARCH", pass: true },
      { name: "04 INVESTIGATE", pass: true },
      { name: "05 VERDICT", pass: true }
    ];
    stages.forEach((st, idx) => {
      ctx.fillStyle = "rgba(77, 163, 255, 0.2)";
      ctx.fillRect(75 + idx * 82, 134, 76, 18);
      ctx.fillStyle = "#47e6a5";
      ctx.font = "bold 9px monospace";
      ctx.fillText(st.name, 80 + idx * 82, 147);
    });

    // Final Verdict
    ctx.fillStyle = "#8fa598";
    ctx.font = "12px monospace";
    ctx.fillText("VERDICT:", 20, 184);

    ctx.fillStyle = "#ffaa00";
    ctx.font = "bold 22px monospace";
    ctx.fillText("MISLEADING", 90, 186);

    ctx.fillStyle = "#ff0055";
    ctx.font = "bold 12px monospace";
    ctx.fillText(`[CONFIDENCE: ${(conf * 100).toFixed(1)}% | SEVERITY: HIGH]`, 250, 186);

    // Bifurcated Evidence Breakdown
    ctx.fillStyle = "rgba(71, 230, 165, 0.12)";
    ctx.fillRect(20, 204, 230, 85);
    ctx.strokeStyle = "rgba(71, 230, 165, 0.4)";
    ctx.strokeRect(20, 204, 230, 85);

    ctx.fillStyle = "#47e6a5";
    ctx.font = "bold 11px monospace";
    ctx.fillText("SUPPORTING EVIDENCE (3)", 28, 222);
    ctx.font = "10px monospace";
    ctx.fillStyle = "#e8f5ee";
    ctx.fillText("• Reuters: Official Denials", 28, 242);
    ctx.fillText("• Gazette: No Decree Published", 28, 258);
    ctx.fillText("• Primary Source: Unaltered Stat", 28, 274);

    ctx.fillStyle = "rgba(255, 0, 85, 0.12)";
    ctx.fillRect(262, 204, 230, 85);
    ctx.strokeStyle = "rgba(255, 0, 85, 0.4)";
    ctx.strokeRect(262, 204, 230, 85);

    ctx.fillStyle = "#ff0055";
    ctx.font = "bold 11px monospace";
    ctx.fillText("REFUTING CONTEXT (7)", 270, 222);
    ctx.font = "10px monospace";
    ctx.fillStyle = "#e8f5ee";
    ctx.fillText("• Deepfake Voice Clone Detected", 270, 242);
    ctx.fillText("• FactCheck: Retracted Claim", 270, 258);
    ctx.fillText("• Timeline Discord: Pre-dated Vid", 270, 274);

    // Specialist Agent Telemetry Footer
    ctx.fillStyle = "#f59e0b";
    ctx.font = "11px monospace";
    ctx.fillText(">> SCOUT AGENT: 0.84 ABNORMAL MARKET VOLATILITY DETECTED", 20, 314);
    ctx.fillStyle = "#00e5ff";
    ctx.fillText(">> TRENDING AGENT: GOOGLE NEWS RSS 15-MIN LOOP SYNCHRONIZED", 20, 332);
  }

  const hudTexture = new THREE.CanvasTexture(hudCanvas);
  hudTexture.minFilter = THREE.LinearFilter;
  const hudGeo = new THREE.PlaneGeometry(4.8, 3.4);
  const hudMat = new THREE.MeshBasicMaterial({
    map: hudTexture,
    transparent: true,
    opacity: 0.95,
    side: THREE.DoubleSide
  });
  const hudMesh = new THREE.Mesh(hudGeo, hudMat);
  hudMesh.position.set(4.5, 0.8, 0.4);
  hudMesh.rotation.y = -0.35;
  hudMesh.rotation.x = -0.06;
  root.add(hudMesh);

  // Return lifecycle hooks
  let lastHudUpdate = 0;

  return {
    update(time, pointerNorm) {
      // 1. Rotate Hasher and Hash rings
      hasherMesh.rotation.y += 0.012;
      hashRing1.rotation.y += 0.02;
      hashRing2.rotation.z += 0.018;

      // 2. Animate claim stream particles into Hasher
      const pos = streamGeo.attributes.position.array;
      for (let i = 0; i < streamCount; i++) {
        pos[i * 3 + 1] -= 0.06;
        if (pos[i * 3 + 1] < 0) {
          pos[i * 3 + 1] = 4.5;
        }
      }
      streamGeo.attributes.position.needsUpdate = true;

      // 3. Animate Specialist Terminals (Scout & Trending)
      scoutCore.rotation.y += 0.02;
      scoutRing.rotation.z += 0.025;
      trendCore.rotation.y += 0.015;
      trendRing.rotation.x += 0.02;

      // 4. Advance packets along evidence cords
      evidenceCords.forEach(cord => {
        const t = (time * 0.85 + cord.offset) % 1.0;
        cord.packet.position.copy(cord.curve.getPoint(t));
      });

      // 5. Interactive root tilt
      root.rotation.y = pointerNorm.x * 0.14;
      root.rotation.x = pointerNorm.y * 0.08;

      // 6. Update HUD periodically
      const now = performance.now();
      if (now - lastHudUpdate > 200) {
        lastHudUpdate = now;
        const conf = 0.912 + Math.sin(time * 1.4) * 0.012;
        drawAegisInvestigationHud(conf);
        hudTexture.needsUpdate = true;
      }
    },
    destroy() {
      trackGeo.dispose();
      trackMat.dispose();
      hasherGeo.dispose();
      hasherMat.dispose();
      hashRingGeo.dispose();
      hashRingMat.dispose();
      streamGeo.dispose();
      streamMat.dispose();
      scoutCoreGeo.dispose();
      scoutCoreMat.dispose();
      scoutRingGeo.dispose();
      scoutRingMat.dispose();
      trendCoreGeo.dispose();
      trendCoreMat.dispose();
      trendRingGeo.dispose();
      trendRingMat.dispose();
      rackFrameGeo.dispose();
      rackFrameMat.dispose();
      hudGeo.dispose();
      hudMat.dispose();
      hudTexture.dispose();
      scene.remove(root);
    }
  };
}
