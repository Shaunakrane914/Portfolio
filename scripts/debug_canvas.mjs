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

page.on("console", (msg) => console.log(`[BROWSER ${msg.type()}]:`, msg.text()));
page.on("pageerror", (err) => console.error("[BROWSER ERROR]:", err));

await page.goto("http://127.0.0.1:8089/", { waitUntil: "networkidle" });
await page.waitForTimeout(1500);

// Capture Scene 0 (Origin)
await page.screenshot({ path: ".audit/verified-scene-0.png" });

// Advance to Scene 1 (Aegis)
await page.keyboard.press("ArrowDown");
await page.waitForTimeout(1200);
await page.screenshot({ path: ".audit/verified-scene-1-aegis.png" });

// Advance to Scene 2 (Gridium)
await page.keyboard.press("ArrowDown");
await page.waitForTimeout(1200);
await page.screenshot({ path: ".audit/verified-scene-2-gridium.png" });

// Advance to Scene 3 (Compressor)
await page.keyboard.press("ArrowDown");
await page.waitForTimeout(1200);
await page.screenshot({ path: ".audit/verified-scene-3-compressor.png" });

console.log("Screenshots saved successfully.");
await browser.close();
