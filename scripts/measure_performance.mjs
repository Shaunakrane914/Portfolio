import path from "node:path";
import { pathToFileURL } from "node:url";

const playwrightRoot = process.env.PLAYWRIGHT_ROOT || "C:\\Users\\Shaunak Rane\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\node\\node_modules\\playwright";
const { chromium } = await import(pathToFileURL(path.join(playwrightRoot, "index.mjs")).href);

const browser = await chromium.launch({
  headless: true,
  executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-webgl", "--disable-gpu-vsync"]
});

async function measurePage(url, pageName, cpuThrottleRate = 1) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Performance.enable");
  if (cpuThrottleRate > 1) {
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: cpuThrottleRate });
  }

  const networkRequests = [];
  page.on("request", (req) => {
    networkRequests.push({
      url: req.url(),
      resourceType: req.resourceType(),
      method: req.method()
    });
  });

  const responses = [];
  page.on("response", async (res) => {
    let size = 0;
    try {
      const headers = res.headers();
      size = Number(headers["content-length"] || 0);
    } catch {}
    responses.push({
      url: res.url(),
      status: res.status(),
      size
    });
  });

  await page.addInitScript(() => {
    window.__longTasks = [];
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          window.__longTasks.push({
            name: entry.name,
            startTime: entry.startTime,
            duration: entry.duration
          });
        }
      }).observe({ type: "longtask", buffered: true });
    } catch (e) {}

    window.__fcp = 0;
    window.__lcp = 0;
    window.__cls = 0;
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.name === "first-contentful-paint") {
            window.__fcp = entry.startTime;
          }
        }
      }).observe({ type: "paint", buffered: true });

      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        if (entries.length > 0) {
          window.__lcp = entries[entries.length - 1].startTime;
        }
      }).observe({ type: "largest-contentful-paint", buffered: true });

      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) {
            window.__cls += entry.value;
          }
        }
      }).observe({ type: "layout-shift", buffered: true });
    } catch (e) {}
  });

  const navStart = performance.now();
  await page.goto(url, { waitUntil: "networkidle" });
  const navEnd = performance.now();

  // Natural pointer movement
  for (let i = 0; i < 8; i++) {
    await page.mouse.move(200 + i * 80, 200 + (i % 2) * 100);
    await page.waitForTimeout(40);
  }

  const sceneSnapshots = [];

  // Cycle through all 6 scenes on index.html to gather WebGL renderer.info telemetry
  if (pageName.includes("index")) {
    for (let sceneIdx = 0; sceneIdx < 6; sceneIdx++) {
      await page.evaluate((idx) => {
        const btn = document.querySelector(`[data-scene-jump="${idx}"]`);
        if (btn) btn.click();
      }, sceneIdx);

      await page.waitForTimeout(450);

      const snapshot = await page.evaluate(() => {
        if (window.__perfTelemetry) {
          return window.__perfTelemetry.getSnapshot();
        }
        return null;
      });
      if (snapshot) sceneSnapshots.push(snapshot);
    }
  } else {
    // Scroll project case study
    await page.mouse.wheel(0, 700);
    await page.waitForTimeout(300);
    await page.mouse.wheel(0, 700);
    await page.waitForTimeout(300);
  }

  const performanceMetrics = await cdp.send("Performance.getMetrics");
  const metricsMap = {};
  for (const m of performanceMetrics.metrics) {
    metricsMap[m.name] = m.value;
  }

  const clientMetrics = await page.evaluate(() => {
    const nav = performance.getEntriesByType("navigation")[0] || {};
    return {
      fcp: window.__fcp || 0,
      lcp: window.__lcp || 0,
      cls: window.__cls || 0,
      longTasks: window.__longTasks || [],
      domContentLoaded: nav.domContentLoadedEventEnd - nav.startTime,
      loadEvent: nav.loadEventEnd - nav.startTime
    };
  });

  const totalTransferBytes = responses.reduce((acc, r) => acc + r.size, 0);
  const totalTBT = clientMetrics.longTasks.reduce((acc, t) => acc + Math.max(0, t.duration - 50), 0);

  console.log(`\n======================================================`);
  console.log(`PAGE: ${pageName} (CPU Throttling: ${cpuThrottleRate}x)`);
  console.log(`======================================================`);
  console.log(`Network Duration to Idle: ${(navEnd - navStart).toFixed(1)} ms`);
  console.log(`Total Requests: ${networkRequests.length}, Transferred: ${(totalTransferBytes / 1024).toFixed(1)} KB`);
  console.log(`DOMContentLoaded: ${clientMetrics.domContentLoaded.toFixed(1)} ms | Load: ${clientMetrics.loadEvent.toFixed(1)} ms`);
  console.log(`FCP: ${clientMetrics.fcp.toFixed(1)} ms | LCP: ${clientMetrics.lcp.toFixed(1)} ms | CLS: ${clientMetrics.cls.toFixed(3)}`);
  console.log(`Long Tasks: ${clientMetrics.longTasks.length}, Total Blocking Time (TBT): ${totalTBT.toFixed(1)} ms`);
  console.log(`CDP ScriptDuration: ${(metricsMap.ScriptDuration * 1000).toFixed(1)} ms`);
  console.log(`CDP LayoutDuration: ${(metricsMap.LayoutDuration * 1000).toFixed(1)} ms (Count: ${metricsMap.LayoutCount})`);
  console.log(`CDP RecalcStyleDuration: ${(metricsMap.RecalcStyleDuration * 1000).toFixed(1)} ms (Count: ${metricsMap.RecalcStyleCount})`);

  if (sceneSnapshots.length > 0) {
    console.log(`\n3D WebGL Scene Telemetry (renderer.info):`);
    console.table(sceneSnapshots.map(s => ({
      Scene: s.activeScene,
      FPS: s.fps,
      "Frame (ms)": Number(s.avgFrameMs.toFixed(1)),
      "Draw Calls": s.calls,
      Triangles: s.triangles,
      Geometries: s.geometries,
      Textures: s.textures,
      DPR: Number(s.dpr.toFixed(2)),
      Tier: s.qualityTier
    })));
  }

  await context.close();
}

// 1. Run index.html with ?perf=1 to capture telemetry
await measurePage("http://127.0.0.1:8089/index.html?perf=1", "index.html");

// 2. Run index.html with 4x CPU Throttling to test simulated mid-range laptop
await measurePage("http://127.0.0.1:8089/index.html?perf=1", "index.html (4x Throttled)", 4);

// 3. Run aegis.html to measure content-visibility gains on project case studies
await measurePage("http://127.0.0.1:8089/aegis.html", "aegis.html");

await browser.close();
