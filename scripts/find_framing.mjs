import path from "node:path";
import { pathToFileURL } from "node:url";

const playwrightRoot = process.env.PLAYWRIGHT_ROOT || "C:\\Users\\Shaunak Rane\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\node\\node_modules\\playwright";
const { chromium } = await import(pathToFileURL(path.join(playwrightRoot, "index.mjs")).href);

const browser = await chromium.launch({
  headless: true,
  executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-webgl"]
});

const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

await page.goto("http://127.0.0.1:8089/", { waitUntil: "networkidle" });
await page.waitForTimeout(1000);

for (let i = 0; i < 6; i++) {
  await page.evaluate((sceneIndex) => {
    window.location.hash = `#${["origin", "aegis", "gridium", "compressor", "topoflow", "profile"][sceneIndex]}`;
  }, i);
  await page.waitForTimeout(800);
  await page.screenshot({ path: `.audit/test-scene-${i}.png` });
}

console.log("All 6 test scene screenshots saved.");
await browser.close();
