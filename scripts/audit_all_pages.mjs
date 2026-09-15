import path from "node:path";
import { pathToFileURL } from "node:url";

const playwrightRoot = "C:\\Users\\Shaunak Rane\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\node\\node_modules\\playwright";
const { chromium } = await import(pathToFileURL(path.join(playwrightRoot, "index.mjs")).href);

const browser = await chromium.launch({
  headless: true,
  executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-webgl"]
});

const pages = ["index.html", "aegis.html", "gridium.html", "compressor-cbm.html", "topoflow.html", "yield.html"];

for (const p of pages) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push(err.message));

  await page.goto(`http://127.0.0.1:8089/${p}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);

  const bodyClass = await page.evaluate(() => document.body.className);
  console.log(`Page ${p}: errors=[${errors.join(", ")}], bodyClass="${bodyClass}"`);
  await page.close();
}

await browser.close();
