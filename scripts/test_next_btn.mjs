import path from "node:path";
import { pathToFileURL } from "node:url";

const playwrightRoot = "C:\\Users\\Shaunak Rane\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\node\\node_modules\\playwright";
const { chromium } = await import(pathToFileURL(path.join(playwrightRoot, "index.mjs")).href);

const browser = await chromium.launch({
  headless: true,
  executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-webgl"]
});

const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto("http://127.0.0.1:8089/", { waitUntil: "networkidle" });
await page.waitForTimeout(1500);

// Expose camera and currentLook
await page.evaluate(() => {
  // trigger next scene via the explore button
  document.querySelector("[data-next-scene]").click();
});

for (let t = 200; t <= 2400; t += 200) {
  await page.waitForTimeout(200);
  const info = await page.evaluate(() => {
    return {
      scene: document.body.dataset.currentScene,
      hash: window.location.hash
    };
  });
  console.log(`t=${t}ms:`, info);
}

await page.screenshot({ path: ".audit/after-next-btn.png" });
await browser.close();
