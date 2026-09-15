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
await page.waitForTimeout(1000);

const startCam = await page.evaluate(() => ({
  pos: [window.camera?.position.x, window.camera?.position.y, window.camera?.position.z],
  scene: document.body.dataset.currentScene
}));
console.log("Start camera:", startCam);

await page.keyboard.press("ArrowDown");

for (let i = 1; i <= 6; i++) {
  await page.waitForTimeout(400);
  const status = await page.evaluate(() => ({
    scene: document.body.dataset.currentScene,
    isTransitioning: document.body.classList.contains("is-scene-transitioning"),
    hash: window.location.hash
  }));
  console.log(`t=${i * 400}ms:`, status);
}

await page.screenshot({ path: ".audit/arrowdown-trace.png" });
await browser.close();
