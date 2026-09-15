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

// Let's test Aegis with different X shifts
const aegisShifts = [
  { name: "shift-plus-3", groupX: -6.55, lookX: -7.5, lookY: 0.1, camZ: 10.5 },
  { name: "shift-plus-4", groupX: -5.55, lookX: -7.0, lookY: 0.1, camZ: 11.0 },
  { name: "shift-plus-5", groupX: -4.55, lookX: -6.5, lookY: 0.1, camZ: 11.5 }
];

for (const s of aegisShifts) {
  await page.evaluate((shift) => {
    // Go to Aegis
    window.location.hash = "#aegis";
  }, s);
  await page.waitForTimeout(500);
  await page.evaluate((shift) => {
    // Access internal Three variables if exposed or adjust activeWorld
    const canvas = document.getElementById("observatory-canvas");
    // Dispatch a custom event or check
  }, s);
}

await page.evaluate(() => {
  window.location.hash = "#aegis";
});
await page.waitForTimeout(1000);
await page.screenshot({ path: ".audit/aegis-now.png" });

await page.evaluate(() => {
  window.location.hash = "#gridium";
});
await page.waitForTimeout(1000);
await page.screenshot({ path: ".audit/gridium-now.png" });

await page.evaluate(() => {
  window.location.hash = "#compressor";
});
await page.waitForTimeout(1000);
await page.screenshot({ path: ".audit/compressor-now.png" });

await page.evaluate(() => {
  window.location.hash = "#topoflow";
});
await page.waitForTimeout(1000);
await page.screenshot({ path: ".audit/topoflow-now.png" });

console.log("Current screenshots saved.");
await browser.close();
