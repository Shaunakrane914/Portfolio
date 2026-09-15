import path from "node:path";
import { pathToFileURL } from "node:url";

const playwrightRoot = "C:\\Users\\Shaunak Rane\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\node\\node_modules\\playwright";
const { chromium } = await import(pathToFileURL(path.join(playwrightRoot, "index.mjs")).href);

const browser = await chromium.launch({
  headless: true,
  executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-webgl"]
});

const scenes = ["origin", "aegis", "gridium", "compressor", "topoflow", "profile"];

for (const s of scenes) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`http://127.0.0.1:8089/#${s}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1400);
  await page.screenshot({ path: `.audit/direct-${s}.png` });
  await page.close();
}

console.log("All 6 direct screenshots captured.");
await browser.close();
