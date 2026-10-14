import fs from "node:fs";
import path from "node:path";
import { getPlaywright } from "./lib/playwright_loader.mjs";

const { chromium } = await getPlaywright();

const outDir = path.join(process.cwd(), ".audit", "qa-v4");
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

async function runQACapture() {
  console.log("=================================================");
  console.log("   COMPREHENSIVE VISUAL QA & EVIDENCE SUITE      ");
  console.log("=================================================\n");

  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    args: [
      "--enable-webgl",
      "--ignore-gpu-blocklist",
      "--enable-gpu-rasterization"
    ]
  });

  const sceneNames = ["origin", "aegis", "gridium", "compressor", "topoflow", "profile"];

  // 1. Desktop 1440x900 - All 6 Scenes
  console.log("1. Capturing Desktop 1440x900 Scenes...");
  const page1440 = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  for (let i = 0; i < sceneNames.length; i++) {
    const s = sceneNames[i];
    await page1440.goto(`http://127.0.0.1:8089/#${s}`, { waitUntil: "networkidle" });
    await page1440.waitForTimeout(800);
    const shotPath = path.join(outDir, `desktop-1440-${i}-${s}.png`);
    await page1440.screenshot({ path: shotPath });
    console.log(`   Captured: desktop-1440-${i}-${s}.png`);
  }

  // 2. Desktop 1920x1080 - Key Scenes
  console.log("\n2. Capturing Desktop 1920x1080 Scenes...");
  const page1920 = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  for (let i of [0, 1, 3]) {
    const s = sceneNames[i];
    await page1920.goto(`http://127.0.0.1:8089/#${s}`, { waitUntil: "networkidle" });
    await page1920.waitForTimeout(800);
    const shotPath = path.join(outDir, `desktop-1920-${i}-${s}.png`);
    await page1920.screenshot({ path: shotPath });
    console.log(`   Captured: desktop-1920-${i}-${s}.png`);
  }

  // 3. Mobile 390x844 - All 6 Scenes
  console.log("\n3. Capturing Mobile 390x844 Scenes...");
  const pageMobile = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2
  });
  for (let i = 0; i < sceneNames.length; i++) {
    const s = sceneNames[i];
    await pageMobile.goto(`http://127.0.0.1:8089/#${s}`, { waitUntil: "networkidle" });
    await pageMobile.waitForTimeout(800);
    const shotPath = path.join(outDir, `mobile-390-${i}-${s}.png`);
    await pageMobile.screenshot({ path: shotPath });
    console.log(`   Captured: mobile-390-${i}-${s}.png`);
  }

  // 4. Case-Study Hero Pages
  console.log("\n4. Capturing Case-Study Hero Pages...");
  const casePages = [
    { file: "aegis.html", name: "aegis" },
    { file: "gridium.html", name: "gridium" },
    { file: "compressor-cbm.html", name: "compressor" },
    { file: "topoflow.html", name: "topoflow" },
    { file: "food.html", name: "food" },
    { file: "yield.html", name: "yield" }
  ];
  for (const cp of casePages) {
    await page1440.goto(`http://127.0.0.1:8089/${cp.file}`, { waitUntil: "networkidle" });
    await page1440.waitForTimeout(800);
    const shotPath = path.join(outDir, `case-study-${cp.name}.png`);
    await page1440.screenshot({ path: shotPath });
    console.log(`   Captured: case-study-${cp.name}.png`);
  }

  // 5. Evidence Dialog and Archive Dialog
  console.log("\n5. Capturing Evidence & Archive Dialogs...");
  await page1440.goto("http://127.0.0.1:8089/#aegis", { waitUntil: "networkidle" });
  await page1440.waitForTimeout(600);
  await page1440.click("[data-open-evidence='aegis']");
  await page1440.waitForTimeout(400);
  await page1440.screenshot({ path: path.join(outDir, "dialog-evidence-aegis.png") });
  console.log("   Captured: dialog-evidence-aegis.png");

  await page1440.click("#evidence-dialog [data-close-evidence]");
  await page1440.waitForTimeout(300);

  await page1440.click("[data-open-archive]");
  await page1440.waitForTimeout(500);
  await page1440.screenshot({ path: path.join(outDir, "dialog-archive.png") });
  console.log("   Captured: dialog-archive.png");

  await browser.close();
  console.log("\n=================================================");
  console.log(`QA Visual Evidence saved to ${outDir}`);
  console.log("=================================================");
}

await runQACapture();
