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
await page.waitForTimeout(1200);

let scene = await page.evaluate(() => document.body.dataset.currentScene);
console.log("Initial scene:", scene);

// Test 1: Single mouse wheel down
console.log("Simulating single wheel flick down...");
await page.mouse.wheel(0, 100);
await page.waitForTimeout(400);

// Simulate continued trackpad momentum inertia during lock window
console.log("Simulating trackpad inertia momentum during lock window...");
for (let i = 0; i < 5; i++) {
  await page.mouse.wheel(0, 60);
  await page.waitForTimeout(80);
}

await page.waitForTimeout(600);
scene = await page.evaluate(() => document.body.dataset.currentScene);
console.log("Scene after first gesture and momentum:", scene);

if (scene !== "1") {
  console.error(`FAILURE: Expected scene 1, got ${scene}`);
} else {
  console.log("SUCCESS: Trackpad momentum did not skip scene! Accurately advanced to Scene 1.");
}

// Test 2: Next scene via wheel
await page.mouse.wheel(0, 120);
await page.waitForTimeout(1100);
scene = await page.evaluate(() => document.body.dataset.currentScene);
console.log("Scene after second wheel gesture:", scene);

if (scene !== "2") {
  console.error(`FAILURE: Expected scene 2, got ${scene}`);
} else {
  console.log("SUCCESS: Accurately advanced to Scene 2 (Gridium).");
}

// Test 3: Wheel back up to scene 1
await page.mouse.wheel(0, -120);
await page.waitForTimeout(1100);
scene = await page.evaluate(() => document.body.dataset.currentScene);
console.log("Scene after wheel up gesture:", scene);

if (scene !== "1") {
  console.error(`FAILURE: Expected scene 1, got ${scene}`);
} else {
  console.log("SUCCESS: Accurately reversed to Scene 1 (Aegis).");
}

await browser.close();
console.log("All scroll gesture tests completed.");
