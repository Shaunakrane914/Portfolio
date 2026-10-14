import { getPlaywright } from "./lib/playwright_loader.mjs";

const { chromium } = await getPlaywright();

async function runProfile() {
  console.log("=================================================");
  console.log("   PORTFOLIO DEEP PERFORMANCE INVESTIGATION      ");
  console.log("=================================================\n");

  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    args: [
      "--enable-webgl",
      "--ignore-gpu-blocklist",
      "--enable-gpu-rasterization"
    ]
  });

  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  // Collect long tasks and paint timing
  await page.addInitScript(() => {
    window.__longTasks = [];
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          window.__longTasks.push({
            name: entry.name,
            startTime: Math.round(entry.startTime),
            duration: Math.round(entry.duration)
          });
        }
      }).observe({ type: "longtask", buffered: true });
    } catch {}

    window.__fcp = 0;
    window.__lcp = 0;
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.name === "first-contentful-paint") window.__fcp = Math.round(entry.startTime);
        }
      }).observe({ type: "paint", buffered: true });

      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        if (entries.length > 0) window.__lcp = Math.round(entries[entries.length - 1].startTime);
      }).observe({ type: "largest-contentful-paint", buffered: true });
    } catch {}
  });

  console.log("1. Measuring Cold Load & Initial Three.js Render (http://127.0.0.1:8089/)...");
  const navStart = performance.now();
  await page.goto("http://127.0.0.1:8089/", { waitUntil: "networkidle" });
  const navDuration = Math.round(performance.now() - navStart);

  // Wait 1.5s for initial hero idle
  await page.waitForTimeout(1500);

  const initialMetrics = await page.evaluate(() => {
    const perfSnap = window.__perfTelemetry?.getSnapshot?.() || {};
    const obs = window.__observatory || {};
    return {
      fcp: window.__fcp,
      lcp: window.__lcp,
      longTasks: window.__longTasks || [],
      obsVersion: obs.version,
      initialScene: document.body.dataset.currentScene,
      perfTelemetry: perfSnap,
      memory: performance.memory ? {
        usedJSHeapSizeMB: (performance.memory.usedJSHeapSize / 1048576).toFixed(1),
        totalJSHeapSizeMB: (performance.memory.totalJSHeapSize / 1048576).toFixed(1)
      } : null
    };
  });

  console.log(`   Nav Duration: ${navDuration}ms | FCP: ${initialMetrics.fcp}ms | LCP: ${initialMetrics.lcp}ms`);
  console.log(`   Long Tasks during load: ${initialMetrics.longTasks.length}`, initialMetrics.longTasks);
  console.log(`   Initial JS Heap: ${initialMetrics.memory?.usedJSHeapSizeMB || "N/A"} MB`);
  console.log(`   Initial Telemetry:`, initialMetrics.perfTelemetry);

  // 2. Measure Frame Times & Jank over 3 Seconds of Idle Rendering
  console.log("\n2. Measuring 3s Idle Frame-Time Distribution...");
  const idleFrameData = await page.evaluate(async () => {
    return new Promise((resolve) => {
      const deltas = [];
      let last = performance.now();
      const start = last;

      function onFrame(now) {
        deltas.push(now - last);
        last = now;
        if (now - start < 3000) {
          requestAnimationFrame(onFrame);
        } else {
          deltas.sort((a, b) => a - b);
          const sum = deltas.reduce((a, b) => a + b, 0);
          const p50 = deltas[Math.floor(deltas.length * 0.50)];
          const p95 = deltas[Math.floor(deltas.length * 0.95)];
          const p99 = deltas[Math.floor(deltas.length * 0.99)];
          const max = deltas[deltas.length - 1];
          const slow16 = deltas.filter(d => d > 16.7).length;
          const slow33 = deltas.filter(d => d > 33.3).length;
          const slow50 = deltas.filter(d => d > 50).length;
          resolve({
            totalFrames: deltas.length,
            avgFps: Math.round(1000 / (sum / deltas.length)),
            avgDeltaMs: +(sum / deltas.length).toFixed(2),
            p50Ms: +p50.toFixed(2),
            p95Ms: +p95.toFixed(2),
            p99Ms: +p99.toFixed(2),
            maxDeltaMs: +max.toFixed(2),
            slowFramesOver16ms: slow16,
            slowFramesOver33ms: slow33,
            slowFramesOver50ms: slow50
          });
        }
      }
      requestAnimationFrame(onFrame);
    });
  });
  console.log("   Idle Frame Distribution:", idleFrameData);

  // 3. Measure Scene Transitions across all 6 scenes (Cold vs Warm)
  console.log("\n3. Measuring Scene Transitions (Scenes 0 -> 1 -> 2 -> 3 -> 4 -> 5 -> 0)...");
  const transitionResults = [];

  for (let targetScene = 1; targetScene <= 5; targetScene++) {
    const t0 = performance.now();
    const transitionData = await page.evaluate(async (target) => {
      const frameDeltas = [];
      let last = performance.now();
      const start = last;

      // Trigger scene jump
      const dot = document.querySelector(`[data-scene-jump="${target}"]`);
      if (dot) dot.click();

      return new Promise((resolve) => {
        function track(now) {
          frameDeltas.push(now - last);
          last = now;
          if (now - start < 800) {
            requestAnimationFrame(track);
          } else {
            const sum = frameDeltas.reduce((a, b) => a + b, 0);
            frameDeltas.sort((a, b) => a - b);
            const p95 = frameDeltas[Math.floor(frameDeltas.length * 0.95)];
            const max = frameDeltas[frameDeltas.length - 1];
            const slow33 = frameDeltas.filter(d => d > 33.3).length;
            const tele = window.__perfTelemetry?.getSnapshot?.() || {};
            resolve({
              targetScene: target,
              frames: frameDeltas.length,
              avgFps: Math.round(1000 / (sum / frameDeltas.length)),
              p95Ms: +p95.toFixed(2),
              maxDeltaMs: +max.toFixed(2),
              hitchesOver33ms: slow33,
              calls: tele.calls,
              triangles: tele.triangles
            });
          }
        }
        requestAnimationFrame(track);
      });
    }, targetScene);

    transitionResults.push(transitionData);
    console.log(`   -> Scene ${targetScene} Transition:`, transitionData);
    await page.waitForTimeout(300);
  }

  // Measure warm transition back to Scene 1
  console.log("\n4. Measuring Warm Transition Back to Scene 1...");
  const warmTransition = await page.evaluate(async () => {
    const frameDeltas = [];
    let last = performance.now();
    const start = last;

    const dot = document.querySelector(`[data-scene-jump="1"]`);
    if (dot) dot.click();

    return new Promise((resolve) => {
      function track(now) {
        frameDeltas.push(now - last);
        last = now;
        if (now - start < 800) {
          requestAnimationFrame(track);
        } else {
          const sum = frameDeltas.reduce((a, b) => a + b, 0);
          frameDeltas.sort((a, b) => a - b);
          resolve({
            avgFps: Math.round(1000 / (sum / frameDeltas.length)),
            maxDeltaMs: +frameDeltas[frameDeltas.length - 1].toFixed(2),
            hitchesOver33ms: frameDeltas.filter(d => d > 33.3).length
          });
        }
      }
      requestAnimationFrame(track);
    });
  });
  console.log("   Warm Scene 1 Transition:", warmTransition);

  // 5. Measure Case Study Hero Pages
  console.log("\n5. Measuring Case Study Hero Pages Performance...");
  const caseStudies = ["aegis.html", "gridium.html", "compressor-cbm.html", "topoflow.html", "food.html", "yield.html"];
  const caseStudyResults = [];

  for (const pageName of caseStudies) {
    const pStart = performance.now();
    await page.goto(`http://127.0.0.1:8089/${pageName}`, { waitUntil: "networkidle" });
    const pDuration = Math.round(performance.now() - pStart);
    await page.waitForTimeout(600);

    const metrics = await page.evaluate(async () => {
      return new Promise((resolve) => {
        const frameDeltas = [];
        let last = performance.now();
        const start = last;
        function track(now) {
          frameDeltas.push(now - last);
          last = now;
          if (now - start < 1500) {
            requestAnimationFrame(track);
          } else {
            const sum = frameDeltas.reduce((a, b) => a + b, 0);
            frameDeltas.sort((a, b) => a - b);
            resolve({
              avgFps: Math.round(1000 / (sum / frameDeltas.length)),
              p95Ms: +frameDeltas[Math.floor(frameDeltas.length * 0.95)].toFixed(2),
              maxDeltaMs: +frameDeltas[frameDeltas.length - 1].toFixed(2),
              slow33: frameDeltas.filter(d => d > 33.3).length
            });
          }
        }
        requestAnimationFrame(track);
      });
    });

    caseStudyResults.push({ page: pageName, loadMs: pDuration, ...metrics });
    console.log(`   ${pageName}: Load ${pDuration}ms | Avg FPS: ${metrics.avgFps} | Max Frame: ${metrics.maxDeltaMs}ms | Hitches: ${metrics.slow33}`);
  }

  await browser.close();

  console.log("\n=================================================");
  console.log("   BASELINE PROFILE COMPLETE                     ");
  console.log("=================================================");
}

runProfile().catch(console.error);
