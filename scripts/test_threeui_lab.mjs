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
  viewport: { width: 1440, height: 900 }
});

const errors = [];
page.on("console", msg => {
  if (msg.type() === "error") {
    errors.push(msg.text());
    console.error("PAGE ERROR:", msg.text());
  }
});
page.on("pageerror", err => {
  errors.push(err.message);
  console.error("UNCAUGHT ERROR:", err.message);
});

await page.goto("http://127.0.0.1:8089/threeui-lab.html", { waitUntil: "networkidle" });
await page.waitForTimeout(1400);

// 1. Prototype 01: Aegis Misinformation Pipeline & Evidence Room
await page.screenshot({ path: ".audit/threeui-proto1-aegis.png" });

// 2. Prototype 02: Sodexo Kitchen Operations Matrix & Exploded BOM
await page.click("[data-prototype-tab='1']");
await page.waitForTimeout(1400);
await page.screenshot({ path: ".audit/threeui-proto2-food.png" });

// 3. Prototype 03: KrushiMitra Cadastral Farm Polygon & NDVI Terrain
await page.click("[data-prototype-tab='2']");
await page.waitForTimeout(1400);
await page.screenshot({ path: ".audit/threeui-proto3-agri.png" });

// 4. Prototype 04: Compressor CBM 3D FFT Waterfall
await page.click("[data-prototype-tab='3']");
await page.waitForTimeout(1400);
await page.screenshot({ path: ".audit/threeui-proto4-cbm.png" });

// 5. Mobile Portrait Viewport (390 x 844)
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(800);
await page.click("[data-prototype-tab='0']"); // Aegis on Mobile
await page.waitForTimeout(800);
await page.screenshot({ path: ".audit/threeui-mobile-portrait-aegis.png" });

await page.click("[data-prototype-tab='1']"); // Food on Mobile
await page.waitForTimeout(800);
await page.screenshot({ path: ".audit/threeui-mobile-portrait-food.png" });

// 6. Mobile Landscape Viewport (844 x 390)
await page.setViewportSize({ width: 844, height: 390 });
await page.waitForTimeout(800);
await page.screenshot({ path: ".audit/threeui-mobile-landscape-food.png" });

console.log("Total errors:", errors.length);
await browser.close();
