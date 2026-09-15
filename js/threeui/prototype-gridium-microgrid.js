// Prototype: Gridium Autonomous Microgrid & Constant-Product AMM Simulation
// Level A — Full Spatial 3D Engineering Visualization
// Spatially communicates the 4-runtime closed loop from Shaunak's case study:
// 15 Prosumer Nodes (Generation, Load, Battery SoC) -> Continuous DDPG RL Controller
// -> Constant-Product AMM Liquidity Pool (x * y = k) -> Realtime Energy Packet Flow.

import * as THREE from "three";

export function createGridiumMicrogridPrototype(scene) {
  const root = new THREE.Group();
  scene.add(root);

  // 1. Central AMM Liquidity Pool (x * y = k)
  const ammGroup = new THREE.Group();
  ammGroup.position.set(0, 0, 0);
  root.add(ammGroup);

  // Core Liquidity Cylinder
  const ammCoreGeo = new THREE.CylinderGeometry(1.2, 1.2, 1.8, 32);
  const ammCoreMat = new THREE.MeshStandardMaterial({
    color: 0x1a0f07,
    emissive: 0xff7a18,
    emissiveIntensity: 0.35,
    metalness: 0.9,
    roughness: 0.2,
    transparent: true,
    opacity: 0.85
  });
  const ammCore = new THREE.Mesh(ammCoreGeo, ammCoreMat);
  ammGroup.add(ammCore);

  // Constant-Product Bonding Curve Torus Rims (x * y = k)
  const ringGeo1 = new THREE.TorusGeometry(1.55, 0.03, 16, 64);
  const ringMat1 = new THREE.MeshBasicMaterial({ color: 0xffa35d, transparent: true, opacity: 0.85 });
  const ring1 = new THREE.Mesh(ringGeo1, ringMat1);
  ring1.rotation.x = Math.PI * 0.5;
  ammGroup.add(ring1);

  const ringGeo2 = new THREE.TorusGeometry(1.9, 0.02, 16, 64);
  const ringMat2 = new THREE.MeshBasicMaterial({ color: 0x7fe4ba, transparent: true, opacity: 0.65 });
  const ring2 = new THREE.Mesh(ringGeo2, ringMat2);
  ring2.rotation.x = Math.PI * 0.45;
  ring2.rotation.y = 0.2;
  ammGroup.add(ring2);

  // 2. 15 Prosumer Microgrid Nodes (Arranged in 2 Concentric Orbital Tiers)
  // 5 Solar Generation (Green), 5 Heavy Demand Load (Amber), 5 Battery Storage (Cyan)
  const nodeCount = 15;
  const nodes = [];
  const energyPackets = [];

  for (let i = 0; i < nodeCount; i++) {
    const angle = (i / nodeCount) * Math.PI * 2;
    const tierRadius = i % 2 === 0 ? 5.6 : 7.4;
    const x = Math.cos(angle) * tierRadius;
    const z = Math.sin(angle) * tierRadius;
    const y = Math.sin(i * 1.5) * 0.6 - 0.5;

    const nodeType = i % 3; // 0 = Solar, 1 = Load, 2 = Battery
    let nodeColor = 0x7fe4ba; // Green Solar
    let typeName = "SOLAR GEN";
    if (nodeType === 1) {
      nodeColor = 0xff7a18; // Amber Load Deficit
      typeName = "DUCK LOAD";
    } else if (nodeType === 2) {
      nodeColor = 0x00e5ff; // Cyan Battery
      typeName = "BATTERY SOC";
    }

    const nGroup = new THREE.Group();
    nGroup.position.set(x, y, z);

    // Prosumer Building / Inverter Hub Base
    const hubGeo = new THREE.CylinderGeometry(0.35, 0.42, 0.5, 6);
    const hubMat = new THREE.MeshStandardMaterial({
      color: 0x121010,
      metalness: 0.8,
      roughness: 0.3,
      emissive: nodeColor,
      emissiveIntensity: 0.3
    });
    const hub = new THREE.Mesh(hubGeo, hubMat);
    nGroup.add(hub);

    // Battery / Solar State Indicator (Vertical Gauge)
    const gaugeH = 0.4 + (i * 0.05);
    const gaugeGeo = new THREE.CylinderGeometry(0.08, 0.08, gaugeH, 12);
    gaugeGeo.translate(0, 0.25 + gaugeH * 0.5, 0);
    const gaugeMat = new THREE.MeshBasicMaterial({ color: nodeColor });
    const gauge = new THREE.Mesh(gaugeGeo, gaugeMat);
    nGroup.add(gauge);

    // Node Beacon Ring
    const nRingGeo = new THREE.RingGeometry(0.52, 0.56, 16);
    nRingGeo.rotateX(-Math.PI * 0.5);
    const nRingMat = new THREE.MeshBasicMaterial({ color: nodeColor, side: THREE.DoubleSide, transparent: true, opacity: 0.7 });
    const nRing = new THREE.Mesh(nRingGeo, nRingMat);
    nRing.position.y = 0.26;
    nGroup.add(nRing);

    root.add(nGroup);
    nodes.push({ group: nGroup, hub, gauge, nodeColor, typeName, nodeType });

    // 3. Bidirectional Energy Flow Conduits connecting Prosumers <-> Central AMM
    const start = new THREE.Vector3(x, y + 0.25, z);
    const end = new THREE.Vector3(0, 0, 0);
    const mid = start.clone().lerp(end, 0.5).add(new THREE.Vector3(0, 0.6 + (i % 3) * 0.2, 0));
    const curve = new THREE.QuadraticBezierCurve3(start, mid, end);

    const tubeGeo = new THREE.TubeGeometry(curve, 28, 0.018, 6, false);
    const tubeMat = new THREE.MeshBasicMaterial({
      color: nodeColor,
      transparent: true,
      opacity: 0.35
    });
    root.add(new THREE.Mesh(tubeGeo, tubeMat));

    // Traveling Energy Quantum Packet
    const pGeo = new THREE.SphereGeometry(0.065, 8, 8);
    const pMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const packet = new THREE.Mesh(pGeo, pMat);
    root.add(packet);

    // If Solar: flows into AMM (0 -> 1); If Load: draws from AMM (1 -> 0)
    const direction = nodeType === 1 ? -1 : 1;
    energyPackets.push({ curve, packet, direction, offset: Math.random() });
  }

  // 4. Floating DDPG RL Controller & AMM Telemetry HUD (Canvas Texture)
  const hudCanvas = document.createElement("canvas");
  hudCanvas.width = 512;
  hudCanvas.height = 360;
  const ctx = hudCanvas.getContext("2d");

  function drawGridiumHud(swapFee, netImbalance, price) {
    ctx.clearRect(0, 0, 512, 360);

    // Dark charcoal backing
    ctx.fillStyle = "rgba(18, 11, 7, 0.94)";
    ctx.fillRect(0, 0, 512, 360);

    // Warm amber border
    ctx.strokeStyle = "rgba(255, 122, 24, 0.8)";
    ctx.lineWidth = 2.5;
    ctx.strokeRect(4, 4, 504, 352);

    // Header bar
    ctx.fillStyle = "rgba(255, 122, 24, 0.16)";
    ctx.fillRect(4, 4, 504, 44);

    ctx.fillStyle = "#ff7a18";
    ctx.font = "bold 15px monospace";
    ctx.fillText("GRIDIUM PROTOCOL // CLOSED-LOOP MICROGRID", 20, 28);

    ctx.fillStyle = "#8fa598";
    ctx.font = "11px monospace";
    ctx.fillText("FASTAPI GYM · PYTORCH DDPG · CONSTANT-PRODUCT AMM · GROTH16", 20, 64);

    // Metric 1: DDPG Swap Fee Action
    ctx.fillStyle = "rgba(35, 20, 12, 0.85)";
    ctx.fillRect(20, 76, 230, 72);
    ctx.strokeStyle = "rgba(255, 122, 24, 0.4)";
    ctx.strokeRect(20, 76, 230, 72);

    ctx.fillStyle = "#8fa598";
    ctx.font = "11px monospace";
    ctx.fillText("DDPG CONTINUOUS ACTION:", 28, 96);
    ctx.fillStyle = "#ffa35d";
    ctx.font = "bold 22px monospace";
    ctx.fillText(`FEE: ${(swapFee * 100).toFixed(2)}%`, 28, 126);
    ctx.fillStyle = "#8fa598";
    ctx.font = "10px monospace";
    ctx.fillText("[0.10% - 5.00% Bound]", 145, 124);

    // Metric 2: Net Physical Imbalance
    ctx.fillStyle = "rgba(35, 20, 12, 0.85)";
    ctx.fillRect(262, 76, 230, 72);
    ctx.strokeStyle = "rgba(255, 122, 24, 0.4)";
    ctx.strokeRect(262, 76, 230, 72);

    ctx.fillStyle = "#8fa598";
    ctx.font = "11px monospace";
    ctx.fillText("NET PHYSICAL IMBALANCE:", 270, 96);
    ctx.fillStyle = netImbalance >= 0 ? "#7fe4ba" : "#ff7a18";
    ctx.font = "bold 22px monospace";
    ctx.fillText(`${netImbalance >= 0 ? "+" : ""}${netImbalance.toFixed(1)} kWh`, 270, 126);
    ctx.fillStyle = "#8fa598";
    ctx.font = "10px monospace";
    ctx.fillText("15 Prosumers Sync", 375, 124);

    // 7D Observation State Band
    ctx.fillStyle = "rgba(255, 122, 24, 0.12)";
    ctx.fillRect(20, 160, 472, 24);
    ctx.fillStyle = "#ffa35d";
    ctx.font = "bold 10px monospace";
    ctx.fillText("7D DDPG OBSERVATION VECTOR: [Load, Gen, Imb, EnRes, StRes, Price, SoC]", 26, 176);

    // Microgrid Telemetry Table
    const telemetryRows = [
      { param: "Solar Generation Pool", val: "48.2 kW", stat: "SURPLUS ACTIVE", col: "#7fe4ba" },
      { param: "Neighborhood Duck Load", val: "41.6 kW", stat: "PEAK DEMAND", col: "#ff7a18" },
      { param: "Constant-Product AMM", val: "x * y = 148,000", stat: "BALANCED RESERVES", col: "#7fe4ba" },
      { param: "Circom Groth16 Proof", val: "Surplus Circuit", stat: "VERIFIED ON-CHAIN", col: "#ffa35d" }
    ];

    telemetryRows.forEach((r, idx) => {
      const y = 202 + idx * 26;
      ctx.fillStyle = "rgba(25, 14, 8, 0.75)";
      ctx.fillRect(20, y - 14, 472, 22);

      ctx.fillStyle = "#e8f5ee";
      ctx.font = "11px monospace";
      ctx.fillText(r.param, 28, y + 2);
      ctx.fillText(r.val, 205, y + 2);

      ctx.fillStyle = r.col;
      ctx.fillText(r.stat, 345, y + 2);
    });

    // Verification Footer
    ctx.fillStyle = "rgba(255, 122, 24, 0.85)";
    ctx.font = "11px monospace";
    ctx.fillText(">> WEBSOCKET GATEWAY: /TICK 500MS LOOP STREAMING STATE", 20, 324);
    ctx.fillStyle = "#8fa598";
    ctx.fillText("REACTIVE ENERGY FLOW REFLECTS DDPG CONTINUOUS REWARD POLICY", 20, 342);
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
  hudMesh.position.set(4.6, 1.4, 1.8);
  hudMesh.rotation.y = -0.32;
  hudMesh.rotation.x = -0.08;
  root.add(hudMesh);

  // Return lifecycle hooks
  let lastHudUpdate = 0;

  return {
    update(time, pointerNorm) {
      // 1. Rotate AMM bonding rims
      ammCore.rotation.y += 0.015;
      ring1.rotation.z += 0.02;
      ring2.rotation.z -= 0.015;

      // 2. Animate prosumer node gauges & beacons
      nodes.forEach(({ gauge, hub }, idx) => {
        hub.rotation.y += 0.01 * (idx % 2 === 0 ? 1 : -1);
      });

      // 3. Advance energy packets along conduits
      energyPackets.forEach(ep => {
        let t = (time * 0.9 + ep.offset) % 1.0;
        if (ep.direction === -1) t = 1.0 - t; // Draw from AMM
        ep.packet.position.copy(ep.curve.getPoint(t));
      });

      // 4. Interactive parallax tilt
      root.rotation.y = pointerNorm.x * 0.15;
      root.rotation.x = pointerNorm.y * 0.08;

      // 5. Update HUD periodically
      const now = performance.now();
      if (now - lastHudUpdate > 200) {
        lastHudUpdate = now;
        const fee = 0.0142 + Math.sin(time * 1.5) * 0.0035;
        const imb = 6.6 + Math.sin(time * 1.2) * 4.5;
        const p = 0.14 + Math.sin(time * 0.8) * 0.02;
        drawGridiumHud(fee, imb, p);
        hudTexture.needsUpdate = true;
      }
    },
    destroy() {
      ammCoreGeo.dispose();
      ammCoreMat.dispose();
      ringGeo1.dispose();
      ringMat1.dispose();
      ringGeo2.dispose();
      ringMat2.dispose();
      hudGeo.dispose();
      hudMat.dispose();
      hudTexture.dispose();
      scene.remove(root);
    }
  };
}
