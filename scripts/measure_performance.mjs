import path from "node:path";
import { pathToFileURL } from "node:url";

const playwrightRoot = process.env.PLAYWRIGHT_ROOT || "C:\\Users\\Shaunak Rane\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\node\\node_modules\\playwright";
const { chromium } = await import(pathToFileURL(path.join(playwrightRoot, "index.mjs")).href);

const browser = await chromium.launch({
  headless: true,
  executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-webgl", "--disable-gpu-vsync"]
});

async function measurePage(url, pageName) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Performance.enable");

  const networkRequests = [];
  page.on("request", (req) => {
    networkRequests.push({
      url: req.url(),
      resourceType: req.resourceType(),
      method: req.method(),
      startTime: performance.now()
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
      size,
      time: performance.now()
    });
  });

  const longTasks = [];
  await page.addInitScript(() => {
    window.__longTasks = [];
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          window.__longTasks.push({
            name: entry.name,
            startTime: entry.startTime,
            duration: entry.duration
          });
        }
      });
      observer.observe({ type: "longtask", buffered: true });
    } catch (e) {}

    window.__fcp = 0;
    window.__lcp = 0;
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
    } catch (e) {}
  });

  const navStart = performance.now();
  await page.goto(url, { waitUntil: "networkidle" });
  const navEnd = performance.now();

  // Simulate mouse moves and interaction for 2 seconds
  for (let i = 0; i < 10; i++) {
    await page.mouse.move(200 + i * 80, 200 + (i % 2) * 100);
    await page.waitForTimeout(60);
  }

  // Keyboard navigation for scenes if index.html
  if (pageName === "index.html") {
    await page.keyboard.press("ArrowDown");
    await page.waitForTimeout(400);
    await page.keyboard.press("ArrowDown");
    await page.waitForTimeout(400);
  } else {
    // Scroll case study
    await page.mouse.wheel(0, 600);
    await page.waitForTimeout(300);
    await page.mouse.wheel(0, 600);
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
      longTasks: window.__longTasks || [],
      domContentLoaded: nav.domContentLoadedEventEnd - nav.startTime,
      loadEvent: nav.loadEventEnd - nav.startTime,
      jsHeapUsedMB: performance.memory ? performance.memory.usedJSHeapSize / (1024 * 1024) : 0
    };
  });

  const totalTransferBytes = responses.reduce((acc, r) => acc + r.size, 0);
  const totalTBT = clientMetrics.longTasks.reduce((acc, t) => acc + Math.max(0, t.duration - 50), 0);

  console.log(`\n======================================================`);
  console.log(`PAGE: ${pageName}`);
  console.log(`======================================================`);
  console.log(`Network Duration to Idle: ${(navEnd - navStart).toFixed(1)} ms`);
  console.log(`Total Requests: ${networkRequests.length}, Recorded Transferred: ${(totalTransferBytes / 1024).toFixed(1)} KB`);
  console.log(`DOMContentLoaded: ${clientMetrics.domContentLoaded.toFixed(1)} ms`);
  console.log(`Load Event: ${clientMetrics.loadEvent.toFixed(1)} ms`);
  console.log(`FCP: ${clientMetrics.fcp.toFixed(1)} ms | LCP: ${clientMetrics.lcp.toFixed(1)} ms`);
  console.log(`Long Tasks Count: ${clientMetrics.longTasks.length}, Total Blocking Time (TBT): ${totalTBT.toFixed(1)} ms`);
  if (clientMetrics.longTasks.length > 0) {
    console.log(`Top Long Tasks:`);
    clientMetrics.longTasks.slice(0, 5).forEach((t, i) => {
      console.log(`  #${i+1}: ${t.duration.toFixed(1)} ms (started at ${t.startTime.toFixed(1)} ms)`);
    });
  }
  console.log(`CDP ScriptDuration: ${(metricsMap.ScriptDuration * 1000).toFixed(1)} ms`);
  console.log(`CDP LayoutDuration: ${(metricsMap.LayoutDuration * 1000).toFixed(1)} ms (Count: ${metricsMap.LayoutCount})`);
  console.log(`CDP RecalcStyleDuration: ${(metricsMap.RecalcStyleDuration * 1000).toFixed(1)} ms (Count: ${metricsMap.RecalcStyleCount})`);
  console.log(`CDP JSHeapUsed: ${(metricsMap.JSHeapUsedSize / (1024 * 1024)).toFixed(2)} MB`);

  // Breakdown requests
  console.log(`Top 10 Requests by Size:`);
  responses
    .sort((a, b) => b.size - a.size)
    .slice(0, 10)
    .forEach((r) => {
      const shortUrl = r.url.replace("http://127.0.0.1:8089/", "");
      console.log(`  - ${(r.size / 1024).toFixed(1)} KB : ${shortUrl}`);
    });

  await context.close();
}

const pagesToTest = [
  "http://127.0.0.1:8089/index.html",
  "http://127.0.0.1:8089/aegis.html",
  "http://127.0.0.1:8089/food.html"
];

for (const p of pagesToTest) {
  const name = path.basename(p);
  await measurePage(p, name);
}

await browser.close();
