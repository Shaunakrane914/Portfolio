import { mkdir, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import path from "node:path";

const playwrightRoot = process.env.PLAYWRIGHT_ROOT;
if (!playwrightRoot) throw new Error("PLAYWRIGHT_ROOT is required");

const { chromium } = await import(pathToFileURL(path.join(playwrightRoot, "index.mjs")).href);
const baseUrl = process.env.AUDIT_URL || "http://127.0.0.1:8094";
const outputDir = path.resolve(process.env.AUDIT_OUTPUT || ".audit/current");
const chromePath = process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const auditMode = process.env.AUDIT_MODE || "all";
const requestedSlugs = (process.env.AUDIT_SLUGS || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const requestedViewports = (process.env.AUDIT_VIEWPORTS || "desktop,mobile")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  executablePath: chromePath,
  args: ["--use-angle=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"]
});

const results = {
  generatedAt: new Date().toISOString(),
  baseUrl,
  consoleErrors: [],
  pageErrors: [],
  failedRequests: [],
  captures: []
};

async function createPage(viewport) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.on("console", (message) => {
    if (message.type() === "error") results.consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => results.pageErrors.push(error.message));
  page.on("requestfailed", (request) => {
    results.failedRequests.push(`${request.method()} ${request.url()} :: ${request.failure()?.errorText || "failed"}`);
  });
  return { context, page };
}

async function pageHealth(page) {
  return page.evaluate(() => {
    const activePanel = document.querySelector("[data-scene-panel].is-active");
    const activePanelStyle = activePanel ? getComputedStyle(activePanel) : null;
    const rect = activePanel?.getBoundingClientRect();
    const links = Array.from(document.querySelectorAll("a[href]"));
    const buttons = Array.from(document.querySelectorAll("button"));
    const interactiveWithoutName = [...links, ...buttons].filter((element) => {
      const name = element.getAttribute("aria-label") || element.textContent?.trim();
      return !name;
    });
    const canvasStats = Array.from(document.querySelectorAll("canvas")).map((canvas) => {
      const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
      if (!gl || !canvas.width || !canvas.height) {
        return { className: canvas.className || canvas.id, width: canvas.width, height: canvas.height, available: false };
      }
      const pixels = new Uint8Array(canvas.width * canvas.height * 4);
      gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      let sampled = 0;
      let nonTransparent = 0;
      let luminanceSum = 0;
      let luminanceSquared = 0;
      for (let index = 0; index < pixels.length; index += 68) {
        const alpha = pixels[index + 3];
        const luminance = pixels[index] * 0.2126 + pixels[index + 1] * 0.7152 + pixels[index + 2] * 0.0722;
        sampled += 1;
        if (alpha > 2 && luminance > 1) nonTransparent += 1;
        luminanceSum += luminance;
        luminanceSquared += luminance * luminance;
      }
      const mean = luminanceSum / Math.max(sampled, 1);
      return {
        className: canvas.className || canvas.id,
        width: canvas.width,
        height: canvas.height,
        available: true,
        visiblePixelFraction: nonTransparent / Math.max(sampled, 1),
        luminanceVariance: luminanceSquared / Math.max(sampled, 1) - mean * mean
      };
    });
    const activeBackdrop = document.querySelector("[data-scene-backdrop].is-active");
    const brokenImages = Array.from(document.images)
      .filter((image) => image.currentSrc && image.complete && image.naturalWidth === 0)
      .map((image) => image.currentSrc || image.src);
    const tables = Array.from(document.querySelectorAll("table")).map((table) => {
      const wrap = table.closest(".evidence-table-wrap, .table-wrap, .table");
      return {
        width: table.scrollWidth,
        wrapperWidth: wrap?.clientWidth ?? table.clientWidth,
        wrapperScrollWidth: wrap?.scrollWidth ?? table.scrollWidth,
        contained: Boolean(wrap) && wrap.scrollWidth <= table.scrollWidth + 2
      };
    });
    return {
      title: document.title,
      hash: location.hash,
      bodyScrollWidth: document.body.scrollWidth,
      viewportWidth: window.innerWidth,
      activePanel: activePanel?.getAttribute("data-scene-panel") ?? null,
      activeTitle: activePanel?.querySelector("h1, h2")?.textContent?.replace(/\s+/g, " ").trim() ?? null,
      activePanelStyle: activePanelStyle ? {
        display: activePanelStyle.display,
        opacity: activePanelStyle.opacity,
        visibility: activePanelStyle.visibility,
        filter: activePanelStyle.filter,
        clipPath: activePanelStyle.clipPath,
        transform: activePanelStyle.transform,
        zIndex: activePanelStyle.zIndex
      } : null,
      telemetryScene: document.getElementById("telemetry-scene")?.textContent?.trim() ?? null,
      currentRail: document.querySelector("[data-scene-jump].is-current")?.getAttribute("data-scene-jump") ?? null,
      activePanelRect: rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height, bottom: rect.bottom } : null,
      canvas: Boolean(document.querySelector("canvas")),
      canvasStats,
      activeBackdrop: activeBackdrop ? {
        scene: activeBackdrop.getAttribute("data-scene-backdrop"),
        loaded: activeBackdrop.complete && activeBackdrop.naturalWidth > 0,
        naturalWidth: activeBackdrop.naturalWidth
      } : null,
      documentHeight: document.documentElement.scrollHeight,
      scrollY: window.scrollY,
      brokenImages,
      tables,
      visibleRevealCount: document.querySelectorAll("[data-reveal].is-visible").length,
      links: links.length,
      buttons: buttons.length,
      interactiveWithoutName: interactiveWithoutName.length
    };
  });
}

async function canvasFrameSignature(page) {
  return page.evaluate(() => {
    const canvas = document.querySelector("canvas");
    const gl = canvas?.getContext("webgl2") || canvas?.getContext("webgl");
    if (!canvas || !gl || !canvas.width || !canvas.height) return null;
    const pixels = new Uint8Array(canvas.width * canvas.height * 4);
    gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    let hash = 2166136261;
    let nonTransparent = 0;
    for (let index = 0; index < pixels.length; index += 68) {
      hash ^= pixels[index];
      hash = Math.imul(hash, 16777619);
      hash ^= pixels[index + 1];
      hash = Math.imul(hash, 16777619);
      hash ^= pixels[index + 2];
      hash = Math.imul(hash, 16777619);
      hash ^= pixels[index + 3];
      hash = Math.imul(hash, 16777619);
      if (pixels[index + 3] > 2) nonTransparent += 1;
    }
    return { hash: hash >>> 0, nonTransparent };
  });
}

async function canvasMotionCheck(page) {
  const before = await canvasFrameSignature(page);
  await page.waitForTimeout(520);
  const afterTime = await canvasFrameSignature(page);
  await page.mouse.move(24, 24);
  await page.waitForTimeout(180);
  await page.mouse.move(Math.max(30, page.viewportSize().width - 30), Math.max(30, page.viewportSize().height - 30));
  await page.waitForTimeout(520);
  const afterPointer = await canvasFrameSignature(page);
  return {
    before,
    afterTime,
    afterPointer,
    animated: Boolean(before && afterTime && before.hash !== afterTime.hash),
    pointerResponsive: Boolean(afterTime && afterPointer && afterTime.hash !== afterPointer.hash)
  };
}

async function auditLocalLinks(page) {
  return page.evaluate(() => {
    const current = new URL(location.href);
    return Array.from(document.querySelectorAll("a[href]")).map((anchor) => {
      const raw = anchor.getAttribute("href") || "";
      const target = new URL(raw, current);
      const isLocal = target.origin === current.origin;
      const fragment = target.hash.slice(1);
      return {
        label: anchor.textContent?.replace(/\s+/g, " ").trim() || anchor.getAttribute("aria-label") || raw,
        raw,
        localPath: isLocal ? target.pathname : null,
        fragment,
        fragmentExists: !fragment || Boolean(document.getElementById(fragment)) || target.pathname !== current.pathname
      };
    });
  });
}

async function captureHomepage(viewportName, viewport) {
  const { context, page } = await createPage(viewport);
  await page.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1400);

  if (viewportName === "desktop") {
    const links = await auditLocalLinks(page);
    const localPaths = [...new Set(links.map((link) => link.localPath).filter(Boolean))];
    const localResponses = [];
    for (const localPath of localPaths) {
      const localResponse = await context.request.get(`${baseUrl}${localPath}`);
      localResponses.push({ path: localPath, status: localResponse.status(), ok: localResponse.ok() });
    }
    results.captures.push({ type: "homepage-links", links, localResponses });
  }

  const sceneCount = await page.locator("[data-scene-panel]").count();
  for (let index = 0; index < sceneCount; index += 1) {
    await page.locator(`[data-scene-jump="${index}"]:visible`).first().click();
    await page.waitForFunction((sceneIndex) => {
      const panel = document.querySelector(`[data-scene-panel="${sceneIndex}"]`);
      if (!panel?.classList.contains("is-active")) return false;
      const style = getComputedStyle(panel);
      return style.visibility === "visible" && Number(style.opacity) > 0.99;
    }, index);
    await page.waitForTimeout(720);
    const motion = await canvasMotionCheck(page);
    const file = `${viewportName}-${String(index).padStart(2, "0")}-scene.png`;
    await page.screenshot({ path: path.join(outputDir, file), fullPage: false });
    results.captures.push({
      file,
      type: "scene",
      viewport: viewportName,
      index,
      health: await pageHealth(page),
      motion
    });
  }

  if (viewportName === "desktop") {
    for (const hash of ["origin", "aegis", "gridium", "compressor", "topoflow", "profile"]) {
      await page.goto(`${baseUrl}/#${hash}`, { waitUntil: "networkidle" });
      await page.waitForTimeout(150);
      results.captures.push({ type: "direct-hash", hash, health: await pageHealth(page) });
    }
  }

  if (viewportName === "desktop") {
    const evidenceScenes = [
      { index: 1, key: "aegis" },
      { index: 2, key: "gridium" },
      { index: 3, key: "compressor" },
      { index: 4, key: "topoflow" },
      { index: 5, key: "studio" }
    ];
    for (const item of evidenceScenes) {
      await page.locator(`[data-scene-jump="${item.index}"]:visible`).first().click();
      await page.waitForTimeout(650);
      await page.locator(`[data-open-evidence="${item.key}"]`).click();
      await page.waitForTimeout(250);
      const file = `${viewportName}-evidence-${item.key}.png`;
      await page.screenshot({ path: path.join(outputDir, file), fullPage: false });
      results.captures.push({ file, type: "evidence", viewport: viewportName, key: item.key });
      await page.locator("[data-close-evidence]").click();
    }
  }

  await page.locator("[data-open-archive]:visible").first().click();
  await page.waitForTimeout(250);
  const archiveFile = `${viewportName}-archive.png`;
  await page.screenshot({ path: path.join(outputDir, archiveFile), fullPage: false });
  results.captures.push({ file: archiveFile, type: "archive", viewport: viewportName });
  await page.locator("[data-close-archive]").click();

  await context.close();
}

async function captureCaseStudy(slug, viewportName, viewport) {
  const { context, page } = await createPage(viewport);
  const response = await page.goto(`${baseUrl}/${slug}.html`, { waitUntil: "networkidle" });
  await page.waitForTimeout(900);
  const file = `${viewportName}-${slug}.png`;
  await page.screenshot({ path: path.join(outputDir, file), fullPage: false });
  const motion = await canvasMotionCheck(page);
  const links = await auditLocalLinks(page);
  const fragmentChecks = [];
  for (const link of links.filter((item) => item.raw.startsWith("#") && item.fragmentExists)) {
    const fragmentLink = page.locator(`a[href="${link.raw}"]:not(.skip-link)`).first();
    if (!(await fragmentLink.count())) continue;
    await fragmentLink.click();
    await page.waitForTimeout(900);
    fragmentChecks.push(await page.evaluate((fragment) => {
      const target = document.getElementById(fragment);
      return {
        fragment,
        hash: location.hash,
        scrollY: window.scrollY,
        targetTop: target?.getBoundingClientRect().top ?? null
      };
    }, link.fragment));
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await page.waitForTimeout(160);
  }
  const localPaths = [...new Set(links.map((link) => link.localPath).filter(Boolean))];
  const localResponses = [];
  for (const localPath of localPaths) {
    const localResponse = await context.request.get(`${baseUrl}${localPath}`);
    localResponses.push({ path: localPath, status: localResponse.status(), ok: localResponse.ok() });
  }
  results.captures.push({
    file,
    type: "case-study",
    viewport: viewportName,
    slug,
    responseStatus: response?.status() ?? null,
    links,
    localResponses,
    fragmentChecks,
    health: await pageHealth(page),
    motion
  });

  const scrollStops = [0.34, 0.67, 1];
  for (const [positionIndex, ratio] of scrollStops.entries()) {
    await page.evaluate((scrollRatio) => {
      const limit = document.documentElement.scrollHeight - window.innerHeight;
      window.scrollTo({ top: Math.max(0, limit * scrollRatio), behavior: "instant" });
    }, ratio);
    await page.waitForTimeout(700);
    const deepFile = `${viewportName}-${slug}-section-${positionIndex + 1}.png`;
    await page.screenshot({ path: path.join(outputDir, deepFile), fullPage: false });
    results.captures.push({
      file: deepFile,
      type: "case-study-section",
      viewport: viewportName,
      slug,
      position: ratio,
      health: await pageHealth(page)
    });
  }

  const fullFile = `${viewportName}-${slug}-full.png`;
  await page.screenshot({ path: path.join(outputDir, fullFile), fullPage: true });
  results.captures.push({ file: fullFile, type: "case-study-full", viewport: viewportName, slug });
  await context.close();
}

if (auditMode === "all" || auditMode === "home") {
  if (requestedViewports.includes("desktop")) await captureHomepage("desktop", { width: 1440, height: 900 });
  if (requestedViewports.includes("mobile")) await captureHomepage("mobile", { width: 390, height: 844 });
}

if (auditMode === "all" || auditMode === "cases") {
  const caseSlugs = ["aegis", "gridium", "compressor-cbm", "topoflow", "sodexo", "food", "yield"]
    .filter((slug) => requestedSlugs.length === 0 || requestedSlugs.includes(slug));
  for (const slug of caseSlugs) {
    if (requestedViewports.includes("desktop")) await captureCaseStudy(slug, "desktop", { width: 1440, height: 900 });
    if (requestedViewports.includes("mobile")) await captureCaseStudy(slug, "mobile", { width: 390, height: 844 });
  }
}

await writeFile(path.join(outputDir, "audit.json"), JSON.stringify(results, null, 2));
await browser.close();

console.log(JSON.stringify({
  outputDir,
  captures: results.captures.length,
  consoleErrors: results.consoleErrors.length,
  pageErrors: results.pageErrors.length,
  failedRequests: results.failedRequests.length
}, null, 2));
