import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { getPlaywright } from './lib/playwright_loader.mjs';

const label = process.argv[2] || 'after';
const root = path.resolve(process.env.AUDIT_ROOT || '.');
const hardware = process.env.AUDIT_GPU === '1';
const out = path.resolve('.audit/overhaul', label);
await fs.mkdir(out, { recursive: true });
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.woff2': 'font/woff2' };
const server = http.createServer(async (req, res) => {
  const name = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const file = path.resolve(root, '.' + (name === '/' ? '/index.html' : name));
  if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  try { res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream'); res.end(await fs.readFile(file)); }
  catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(8091, '127.0.0.1', resolve));
const { chromium } = await getPlaywright();
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: hardware ? ['--enable-webgl', '--ignore-gpu-blocklist'] : ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl'] });
const base = 'http://127.0.0.1:8091';
const errors = [];
const result = { label, date: '2026-10-14', backend: hardware ? 'Default ANGLE (inspect gpu field)' : 'ANGLE SwiftShader (software rendering)', browser: browser.version(), pages: [], transitions: [], errors };
const scenes = ['origin', 'aegis', 'gridium', 'compressor', 'topoflow', 'profile'];
async function instrument(page) {
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
  await page.addInitScript(() => {
    window.__audit = { frames: [], tasks: [] };
    new PerformanceObserver(list => window.__audit.tasks.push(...list.getEntries().map(e => ({ start: e.startTime, duration: e.duration })))).observe({ type: 'longtask', buffered: true });
    let last;
    function tick(now) { if (last) window.__audit.frames.push({ at: now, dt: now - last }); last = now; requestAnimationFrame(tick); }
    requestAnimationFrame(tick);
  });
}
async function sample(page, start = 0) {
  return page.evaluate(start => {
    const values = window.__audit.frames.filter(f => f.at >= start).map(f => f.dt).sort((a,b) => a-b);
    const avg = values.reduce((a,b) => a+b, 0) / values.length;
    const gl = document.querySelector('canvas')?.getContext('webgl2');
    const extension = gl?.getExtension('WEBGL_debug_renderer_info');
    return { gpu: extension ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) : null, fcp: performance.getEntriesByName('first-contentful-paint')[0]?.startTime, frames: values.length, fps: 1000 / avg, p95: values[Math.floor(values.length*.95)], p99: values[Math.floor(values.length*.99)], max: values.at(-1), longTasks: window.__audit.tasks.filter(t => t.start >= start), telemetry: window.__perfTelemetry?.getSnapshot(), hero: window.__heroTelemetry?.(), heapMB: performance.memory?.usedJSHeapSize / 1048576, overflow: document.documentElement.scrollWidth > innerWidth };
  }, start);
}
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await instrument(page);
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  result.pages.push({ page: 'home', ...await sample(page) });
  const homeIdle = await page.evaluate(() => performance.now());
  await page.waitForTimeout(1500);
  result.pages.at(-1).idle = await sample(page, homeIdle);
  await page.screenshot({ path: path.join(out, 'home.png') });
  // A single uninterrupted precision-trackpad gesture, beyond the old lock window.
  const scroll = await page.evaluate(async () => {
    const initial = +document.body.dataset.currentScene;
    const sequence = [45, 55, 48, 40, 32, 26, 20, 16, 12, 8, 5, 3, -2, 1];
    for (const deltaY of sequence) { document.body.dispatchEvent(new WheelEvent('wheel', { deltaY, cancelable: true, bubbles: true })); await new Promise(r => setTimeout(r, 55)); }
    return { initial, final: +document.body.dataset.currentScene, expected: initial + 1 };
  });
  result.scroll = scroll;
  console.log(label, 'one gesture:', scroll);
  // Restart the world cache so the wheel reproduction does not pre-visit scenes
  // differently in the two versions before the first traversal benchmark.
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  for (const traversal of ['cold', 'warm']) {
    for (let i = 0; i < scenes.length; i++) {
      const measure = await page.evaluate(i => {
        const start = performance.now();
        document.querySelector(`[data-scene-jump="${i}"]`).click();
        return { start, handlerMs: performance.now()-start };
      }, i);
      await page.waitForTimeout(1200);
      result.transitions.push({ traversal, scene: scenes[i], handlerMs: measure.handlerMs, ...await sample(page, measure.start) });
      if (traversal === 'cold') await page.screenshot({ path: path.join(out, `scene-${scenes[i]}.png`) });
    }
  }
  for (const file of ['aegis', 'gridium', 'compressor-cbm', 'topoflow', 'food', 'yield', 'sodexo']) {
    await page.goto(`${base}/${file}.html`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    result.pages.push({ page: file, ...await sample(page) });
    const idle = await page.evaluate(() => performance.now());
    await page.waitForTimeout(1500);
    result.pages.at(-1).idle = await sample(page, idle);
    await page.screenshot({ path: path.join(out, `${file}.png`) });
  }
  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await instrument(mobile);
  for (const file of ['', 'aegis', 'gridium', 'compressor-cbm', 'topoflow', 'food', 'yield']) {
    await mobile.goto(`${base}/${file ? file + '.html' : ''}`, { waitUntil: 'networkidle' });
    await mobile.waitForTimeout(900);
    result.pages.push({ page: `mobile-${file || 'home'}`, ...await sample(mobile) });
    await mobile.screenshot({ path: path.join(out, `mobile-${file || 'home'}.png`) });
  }
  await fs.writeFile(path.join(out, 'results.json'), JSON.stringify(result, null, 2));
  console.log('Evidence:', out, 'errors:', errors.length);
} finally { await browser.close(); server.close(); }
