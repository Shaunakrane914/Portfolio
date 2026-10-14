import { getPlaywright } from "./lib/playwright_loader.mjs";
const { chromium } = await getPlaywright();

async function test() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    args: ["--enable-webgl", "--ignore-gpu-blocklist"]
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto("http://127.0.0.1:8089/?perf=1", { waitUntil: "networkidle" });

  const timings = await page.evaluate(async () => {
    const results = [];
    const obs = window.__observatory;
    for (let i = 1; i < 6; i++) {
      const dot = document.querySelector(`[data-scene-jump="${i}"]`);
      if (dot) dot.click();
      await new Promise(r => setTimeout(r, 700));
      const tBuild = obs.worlds[i]?.userData?.buildDuration || 0;
      results.push({ index: i, buildDurationMs: Math.round(tBuild) });
    }
    return results;
  });
  console.log("World JS build durations:", timings);
  await browser.close();
}
test().catch(console.error);
