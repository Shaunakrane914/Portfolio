import path from "node:path";
import { pathToFileURL } from "node:url";

const playwrightRoot = "C:\\Users\\Shaunak Rane\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\node\\node_modules\\playwright";
const { chromium } = await import(pathToFileURL(path.join(playwrightRoot, "index.mjs")).href);

// Launch browser with WebGL disabled
const browser = await chromium.launch({
  headless: true,
  executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  args: ["--disable-webgl", "--disable-3d-apis"]
});

const page = await browser.newPage({
  viewport: { width: 1440, height: 900 }
});

const errors = [];
page.on("console", msg => {
  if (msg.type() === "error") {
    errors.push(msg.text());
  }
});
page.on("pageerror", err => {
  errors.push(err.message);
});

await page.goto("http://127.0.0.1:8089/threeui-lab.html", { waitUntil: "networkidle" });
await page.waitForTimeout(1000);

// Verify Aegis workspace is visible in DOM
const aegisHeading = await page.$eval(".aegis-claim-title", el => el.textContent.trim());
console.log("Aegis claim heading with WebGL disabled:", aegisHeading);

// Verify Food Ops works with WebGL disabled
await page.click("[data-prototype-tab='1']");
await page.waitForTimeout(800);
const kpiVal = await page.$eval(".kpi-val", el => el.textContent.trim());
console.log("Food Ops attendance forecast with WebGL disabled:", kpiVal);

// Switch dishes in Food Ops with WebGL disabled
await page.click("[data-dish='salad']");
await page.waitForTimeout(500);
const saladRow = await page.$eval("#bom-table-body tbody tr", el => el.textContent.trim());
console.log("Salad BOM row loaded with WebGL disabled:", saladRow);

console.log("Errors encountered:", errors.length);
await browser.close();
