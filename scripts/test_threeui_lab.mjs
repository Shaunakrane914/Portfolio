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
await page.waitForTimeout(1200);

// Capture Prototype 1 (Neural Flux)
await page.screenshot({ path: ".audit/threeui-proto1-flux.png" });

// Click tab 2 (Aegis Holo)
await page.click("[data-prototype-tab='1']");
await page.waitForTimeout(1200);
await page.screenshot({ path: ".audit/threeui-proto2-aegis.png" });

// Click tab 3 (Quantum Grid)
await page.click("[data-prototype-tab='2']");
await page.waitForTimeout(1200);
await page.screenshot({ path: ".audit/threeui-proto3-grid.png" });

// Click tab 4 (Topo GNN)
await page.click("[data-prototype-tab='3']");
await page.waitForTimeout(1200);
await page.screenshot({ path: ".audit/threeui-proto4-topo.png" });

// Now test on mobile viewport
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(600);
await page.screenshot({ path: ".audit/threeui-mobile-topo.png" });

await page.click("[data-prototype-tab='0']");
await page.waitForTimeout(800);
await page.screenshot({ path: ".audit/threeui-mobile-flux.png" });

console.log("Total errors:", errors.length);
await browser.close();
