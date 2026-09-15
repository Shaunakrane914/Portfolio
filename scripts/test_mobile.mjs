import path from "node:path";
import { pathToFileURL } from "node:url";

const playwrightRoot = "C:\\Users\\Shaunak Rane\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\node\\node_modules\\playwright";
const { chromium } = await import(pathToFileURL(path.join(playwrightRoot, "index.mjs")).href);

const browser = await chromium.launch({
  headless: true,
  executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-webgl"]
});

const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 2
});

const scenes = ["origin", "aegis", "gridium", "compressor", "topoflow", "profile"];

for (let i = 0; i < scenes.length; i++) {
  const s = scenes[i];
  await page.goto(`http://127.0.0.1:8089/#${s}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `.audit/final-mobile-${s}.png` });
}

await page.goto("http://127.0.0.1:8089/aegis.html", { waitUntil: "networkidle" });
await page.waitForTimeout(1000);
await page.screenshot({ path: ".audit/final-mobile-aegis-case.png" });

await page.goto("http://127.0.0.1:8089/gridium.html", { waitUntil: "networkidle" });
await page.waitForTimeout(1000);
await page.screenshot({ path: ".audit/final-mobile-gridium-case.png" });

console.log("All final mobile audits completed successfully!");
await browser.close();
