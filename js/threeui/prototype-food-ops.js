// Prototype 03: Sodexo Institutional Food Operations — Kitchen Operations Matrix & BOM Depletion Engine
// Rebuilt to accurately reflect Shaunak's institutional food operations system:
// Weekly meal calendar (7 days x 3 slots), Random Forest pax attendance curve ribbon,
// exploded dish-to-ingredient BOM tree, warehouse inventory stock silos, and waste ratio reduction.

import * as THREE from "three";

export function createFoodOpsPrototype(scene) {
  const root = new THREE.Group();
  scene.add(root);

  // 1. Weekly Operations Service Deck (Ground Matrix)
  // 7 Columns (Mon - Sun) x 3 Rows (Breakfast, Lunch, Dinner)
  const deckGroup = new THREE.Group();
  deckGroup.position.set(0, -1.8, 0);
  root.add(deckGroup);

  const days = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
  const daySpacing = 1.8;
  const slotSpacing = 1.4;

  const cellMeshes = [];
  days.forEach((day, dIdx) => {
    const xPos = (dIdx - 3) * daySpacing;
    for (let slot = 0; slot < 3; slot++) {
      const zPos = (slot - 1) * slotSpacing;

      // Base tray pad
      const padGeo = new THREE.BoxGeometry(1.45, 0.08, 1.15);
      const padMat = new THREE.MeshStandardMaterial({
        color: 0x071e16,
        metalness: 0.85,
        roughness: 0.25,
        emissive: 0x03140e,
        emissiveIntensity: 0.4
      });
      const pad = new THREE.Mesh(padGeo, padMat);
      pad.position.set(xPos, 0, zPos);
      deckGroup.add(pad);

      // Glass border rim
      const rimGeo = new THREE.BoxGeometry(1.48, 0.12, 1.18);
      const rimMat = new THREE.MeshBasicMaterial({
        color: 0x10b981,
        wireframe: true,
        transparent: true,
        opacity: 0.25
      });
      const rim = new THREE.Mesh(rimGeo, rimMat);
      rim.position.set(xPos, 0.02, zPos);
      deckGroup.add(rim);

      cellMeshes.push({ pad, dIdx, slot });
    }
  });

  // 2. Random Forest Pax Attendance Forecast Ribbon (Floating across the 7 days)
  // Highlighting Lunch peak surge (e.g. 1,840 Pax)
  const paxPoints = [];
  for (let d = 0; d < 7; d++) {
    const x = (d - 3) * daySpacing;
    // Weekday attendance is higher (~1.8m), drops on weekends (~0.9m)
    const yBase = d < 5 ? 1.6 : 0.85;
    paxPoints.push(new THREE.Vector3(x, yBase, 0)); // Lunch slot line
  }

  const paxCurve = new THREE.CatmullRomCurve3(paxPoints);
  const paxTubeGeo = new THREE.TubeGeometry(paxCurve, 64, 0.045, 8, false);
  const paxTubeMat = new THREE.MeshBasicMaterial({
    color: 0x34d399,
    transparent: true,
    opacity: 0.95
  });
  const paxTube = new THREE.Mesh(paxTubeGeo, paxTubeMat);
  paxTube.position.y += 0.4;
  deckGroup.add(paxTube);

  // Vertical Pax Volume Columns (Pillars on Lunch Slot)
  const paxPillars = [];
  for (let d = 0; d < 7; d++) {
    const x = (d - 3) * daySpacing;
    const h = d < 5 ? 1.5 : 0.75;
    const pGeo = new THREE.CylinderGeometry(0.12, 0.12, h, 16);
    pGeo.translate(0, h * 0.5, 0);
    const pMat = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      emissive: 0x10b981,
      emissiveIntensity: 0.35,
      transparent: true,
      opacity: 0.65
    });
    const pillar = new THREE.Mesh(pGeo, pMat);
    pillar.position.set(x, 0.04, 0);
    deckGroup.add(pillar);
    paxPillars.push({ pillar, baseH: h });
  }

  // 3. Exploded Dish-to-Ingredient BOM Tree (Top Layer, y = 2.4)
  const bomGroup = new THREE.Group();
  bomGroup.position.set(0, 2.6, -1.8);
  root.add(bomGroup);

  // Menu Dish Nodes (Horizontal row)
  const dishes = [
    { name: "PANEER BUTTER MASALA", x: -4.0, color: 0xf59e0b, qty: "920 portions" },
    { name: "YELLOW DAL TADKA", x: -1.3, color: 0x10b981, qty: "1,450 portions" },
    { name: "STEAMED BASMATI", x: 1.3, color: 0x06b6d4, qty: "1,840 portions" },
    { name: "MIXED SPROUT SALAD", x: 4.0, color: 0x84cc16, qty: "780 portions" }
  ];

  const dishNodes = [];
  dishes.forEach((d) => {
    const g = new THREE.Group();
    g.position.set(d.x, 0, 0);

    // Dish Platter Geometry (Flat hexagonal prism)
    const platGeo = new THREE.CylinderGeometry(0.65, 0.72, 0.14, 6);
    const platMat = new THREE.MeshStandardMaterial({
      color: d.color,
      emissive: d.color,
      emissiveIntensity: 0.4,
      metalness: 0.8,
      roughness: 0.2
    });
    const plat = new THREE.Mesh(platGeo, platMat);
    g.add(plat);

    // Rotating recipe multiplier ring
    const rGeo = new THREE.TorusGeometry(0.9, 0.022, 12, 36);
    const rMat = new THREE.MeshBasicMaterial({ color: d.color, transparent: true, opacity: 0.75 });
    const ring = new THREE.Mesh(rGeo, rMat);
    ring.rotation.x = Math.PI * 0.5;
    g.add(ring);

    bomGroup.add(g);
    dishNodes.push({ group: g, ring, plat, dish: d });
  });

  // 4. Warehouse Inventory Stock Silos (Vertical Glass Cylinders at Top Back)
  const warehouseGroup = new THREE.Group();
  warehouseGroup.position.set(0, 4.4, -3.2);
  root.add(warehouseGroup);

  const inventoryStock = [
    { name: "DAIRY / PANEER", x: -3.8, level: 0.78, status: "OK", color: 0x10b981 },
    { name: "PULSES / LENTILS", x: -1.3, level: 0.88, status: "OK", color: 0x10b981 },
    { name: "GRAINS / RICE", x: 1.3, level: 0.65, status: "OK", color: 0x10b981 },
    { name: "FRESH PRODUCE", x: 3.8, level: 0.28, status: "LOW STOCK", color: 0xf59e0b } // Low stock alert
  ];

  const stockSilos = [];
  const depletionStreams = [];

  inventoryStock.forEach((st, idx) => {
    const sGroup = new THREE.Group();
    sGroup.position.set(st.x, 0, 0);

    // Outer glass cylinder
    const glassGeo = new THREE.CylinderGeometry(0.42, 0.42, 1.2, 24);
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x143c34,
      metalness: 0.9,
      roughness: 0.1,
      transparent: true,
      opacity: 0.45
    });
    sGroup.add(new THREE.Mesh(glassGeo, glassMat));

    // Internal liquid/grain fill level
    const fillH = 1.1 * st.level;
    const fillGeo = new THREE.CylinderGeometry(0.38, 0.38, fillH, 20);
    fillGeo.translate(0, -0.55 + fillH * 0.5, 0);
    const fillMat = new THREE.MeshStandardMaterial({
      color: st.color,
      emissive: st.color,
      emissiveIntensity: 0.45,
      metalness: 0.6,
      roughness: 0.3
    });
    const fillMesh = new THREE.Mesh(fillGeo, fillMat);
    sGroup.add(fillMesh);

    warehouseGroup.add(sGroup);
    stockSilos.push({ group: sGroup, fillMesh, st });

    // Ingredient Depletion Conduit connecting Warehouse Silo -> Planned Dish Platter
    const start = new THREE.Vector3(st.x, 4.4, -3.2);
    const end = new THREE.Vector3(dishes[idx].x, 2.6, -1.8);
    const mid = start.clone().lerp(end, 0.5).add(new THREE.Vector3(0, 0.3, 0.2));
    const curve = new THREE.QuadraticBezierCurve3(start, mid, end);

    const tubeGeo = new THREE.TubeGeometry(curve, 24, 0.016, 6, false);
    const tubeMat = new THREE.MeshBasicMaterial({ color: st.color, transparent: true, opacity: 0.4 });
    root.add(new THREE.Mesh(tubeGeo, tubeMat));

    // Flowing ingredient particle
    const partGeo = new THREE.SphereGeometry(0.065, 8, 8);
    const partMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const partMesh = new THREE.Mesh(partGeo, partMat);
    root.add(partMesh);

    depletionStreams.push({ curve, partMesh, offset: Math.random() });
  });

  // 5. Floating Operations Manager Console HUD (Canvas Texture)
  const hudCanvas = document.createElement("canvas");
  hudCanvas.width = 512;
  hudCanvas.height = 360;
  const ctx = hudCanvas.getContext("2d");

  function drawFoodOpsManagementHud(paxEstimate, wasteRatio) {
    ctx.clearRect(0, 0, 512, 360);

    // Dark emerald backing
    ctx.fillStyle = "rgba(4, 18, 14, 0.92)";
    ctx.fillRect(0, 0, 512, 360);

    // Emerald neon border
    ctx.strokeStyle = "rgba(16, 185, 129, 0.75)";
    ctx.lineWidth = 2.5;
    ctx.strokeRect(4, 4, 504, 352);

    // Header bar
    ctx.fillStyle = "rgba(16, 185, 129, 0.16)";
    ctx.fillRect(4, 4, 504, 44);

    ctx.fillStyle = "#10b981";
    ctx.font = "bold 15px monospace";
    ctx.fillText("SODEXO OPERATIONS // FASTAPI KITCHEN CONSOLE", 20, 28);

    ctx.fillStyle = "#8fa598";
    ctx.font = "11px monospace";
    ctx.fillText("WEEKLY MENU · DISH BOM ROLLUP · INVENTORY SYNC · RF FORECAST", 20, 64);

    // Metric 1: Pax Attendance Forecast
    ctx.fillStyle = "rgba(10, 36, 28, 0.85)";
    ctx.fillRect(20, 76, 230, 74);
    ctx.strokeStyle = "rgba(16, 185, 129, 0.4)";
    ctx.strokeRect(20, 76, 230, 74);

    ctx.fillStyle = "#8fa598";
    ctx.font = "11px monospace";
    ctx.fillText("RANDOM FOREST ATTENDANCE:", 28, 96);
    ctx.fillStyle = "#34d399";
    ctx.font = "bold 24px monospace";
    ctx.fillText(`${paxEstimate.toFixed(0)} PAX`, 28, 126);
    ctx.fillStyle = "#8fa598";
    ctx.font = "10px monospace";
    ctx.fillText("±2.8% CI · Lunch Rush", 155, 124);

    // Metric 2: Waste Ratio & Prevention
    ctx.fillStyle = "rgba(10, 36, 28, 0.85)";
    ctx.fillRect(262, 76, 230, 74);
    ctx.strokeStyle = "rgba(16, 185, 129, 0.4)";
    ctx.strokeRect(262, 76, 230, 74);

    ctx.fillStyle = "#8fa598";
    ctx.font = "11px monospace";
    ctx.fillText("WASTE RATIO (PREP-CONSUMED):", 270, 96);
    ctx.fillStyle = "#10b981";
    ctx.font = "bold 24px monospace";
    ctx.fillText(`${wasteRatio.toFixed(1)}%`, 270, 126);
    ctx.fillStyle = "#f59e0b";
    ctx.font = "10px monospace";
    ctx.fillText("-320 kg Waste Saved", 345, 124);

    // Dish BOM Rollup Table
    ctx.fillStyle = "rgba(16, 185, 129, 0.12)";
    ctx.fillRect(20, 162, 472, 24);
    ctx.fillStyle = "#34d399";
    ctx.font = "bold 11px monospace";
    ctx.fillText("MENU DISH", 28, 178);
    ctx.fillText("PORTIONS", 185, 178);
    ctx.fillText("BOM INGREDIENT REQUISITION", 275, 178);

    const tableRows = [
      { dish: "Paneer Butter Masala", port: "920", req: "142 kg Paneer, 35 kg Tomato", col: "#10b981" },
      { dish: "Yellow Dal Tadka", port: "1,450", req: "88 kg Toor Dal, 12 kg Ghee", col: "#10b981" },
      { dish: "Steamed Basmati Rice", port: "1,840", req: "220 kg Basmati Grain", col: "#10b981" },
      { dish: "Mixed Sprout Salad", port: "780", req: "45 kg Sprouts [RESTOCK QUEUED]", col: "#f59e0b" }
    ];

    tableRows.forEach((r, idx) => {
      const y = 208 + idx * 26;
      ctx.fillStyle = "rgba(6, 24, 18, 0.75)";
      ctx.fillRect(20, y - 14, 472, 22);

      ctx.fillStyle = "#e8f5ee";
      ctx.font = "11px monospace";
      ctx.fillText(r.dish, 28, y + 2);
      ctx.fillText(r.port, 185, y + 2);

      ctx.fillStyle = r.col;
      ctx.fillText(r.req, 275, y + 2);
    });

    // Architecture Footer
    ctx.fillStyle = "rgba(16, 185, 129, 0.85)";
    ctx.font = "11px monospace";
    ctx.fillText(">> FASTAPI ROUTES + MYSQL TRANSACTIONS + SQLITE MODEL SETTINGS", 20, 324);
    ctx.fillStyle = "#8fa598";
    ctx.fillText("LIVE REQUISITION DELTAS COMPUTED BEFORE KITCHEN PREP", 20, 342);
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
  hudMesh.position.set(4.6, 1.6, 2.0);
  hudMesh.rotation.y = -0.32;
  hudMesh.rotation.x = -0.08;
  root.add(hudMesh);

  // Return lifecycle hooks
  let lastHudUpdate = 0;

  return {
    update(time, pointerNorm) {
      // 1. Rotate dish multiplier rings
      dishNodes.forEach(({ ring }, idx) => {
        ring.rotation.z += 0.02 * (idx % 2 === 0 ? 1 : -1);
      });

      // 2. Advance ingredient particles along depletion conduits
      depletionStreams.forEach(st => {
        const t = (time * 0.9 + st.offset) % 1.0;
        st.partMesh.position.copy(st.curve.getPoint(t));
      });

      // 3. Pulse pax attendance pillars
      paxPillars.forEach(({ pillar, baseH }, idx) => {
        const p = Math.sin(time * 2.0 + idx * 0.8) * 0.08;
        pillar.scale.y = 1.0 + p;
      });

      // 4. Interactive root tilt
      root.rotation.y = pointerNorm.x * 0.14;
      root.rotation.x = pointerNorm.y * 0.08;

      // 5. Update HUD periodically
      const now = performance.now();
      if (now - lastHudUpdate > 200) {
        lastHudUpdate = now;
        const pax = 1840 + Math.sin(time * 1.5) * 25;
        const wr = 4.8 + Math.sin(time * 1.0) * 0.3;
        drawFoodOpsManagementHud(pax, wr);
        hudTexture.needsUpdate = true;
      }
    },
    destroy() {
      paxTubeGeo.dispose();
      paxTubeMat.dispose();
      hudGeo.dispose();
      hudMat.dispose();
      hudTexture.dispose();
      scene.remove(root);
    }
  };
}
