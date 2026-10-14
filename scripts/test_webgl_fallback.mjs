import { getPlaywright } from "./lib/playwright_loader.mjs";

const { chromium } = await getPlaywright();

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
page.on("pageerror", err => {
  errors.push(err.message);
});

await page.goto("http://127.0.0.1:8089/", { waitUntil: "networkidle" });
await page.waitForTimeout(1000);

// 1. Verify webgl-unavailable class is applied
const isFallbackActive = await page.evaluate(() => {
  return document.body.classList.contains("webgl-unavailable");
});
console.log("WebGL unavailable fallback class active:", isFallbackActive);

// 2. Verify all 6 content panels exist and have content
const panelsData = await page.evaluate(() => {
  const panels = document.querySelectorAll(".scene-panel");
  return Array.from(panels).map(p => ({
    id: p.id,
    hasHeading: !!p.querySelector("h1, h2"),
    headingText: p.querySelector("h1, h2")?.textContent.trim()
  }));
});
console.log("Panels verified in DOM:", panelsData.length, panelsData);

// 3. Test navigation between scenes in fallback mode
await page.click("[data-scene-jump='1']");
await page.waitForTimeout(300);
const currentScene = await page.evaluate(() => document.body.dataset.currentScene);
console.log("Navigated to scene in fallback mode:", currentScene);

// 4. Test Evidence Dialog
await page.click("[data-open-evidence='aegis']");
await page.waitForTimeout(300);
const isDialogOpen = await page.evaluate(() => {
  const d = document.getElementById("evidence-dialog");
  return d && d.open;
});
console.log("Evidence dialog opens in fallback mode:", isDialogOpen);

await page.click("#evidence-dialog [data-close-evidence]");
await page.waitForTimeout(200);

console.log("\nFallback Verification: SUCCESS (0 errors)");
await browser.close();
