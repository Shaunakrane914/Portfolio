import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import { getPlaywright } from './lib/playwright_loader.mjs';

const root = process.cwd();
const server = http.createServer(async (req,res) => {
  const name = decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const file = path.resolve(root,'.'+(name === '/' ? '/index.html' : name));
  if (!file.startsWith(root+path.sep)) { res.writeHead(403).end(); return; }
  try {
    res.setHeader('Content-Type', ({'.html':'text/html','.js':'text/javascript','.css':'text/css','.woff2':'font/woff2','.png':'image/png','.webp':'image/webp'})[path.extname(file)] || 'application/octet-stream');
    res.end(await fs.readFile(file));
  } catch { res.writeHead(404).end(); }
});
await new Promise(r => server.listen(8092,'127.0.0.1',r));
const { chromium } = await getPlaywright();
const options = { headless:true, executablePath:process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe' };
const browser = await chromium.launch({...options,args:['--enable-webgl','--ignore-gpu-blocklist']});
const noGL = await chromium.launch({...options,args:['--disable-webgl']});
const errors = [], checks = [];
const base = 'http://127.0.0.1:8092';
const scene = page => page.evaluate(() => +document.body.dataset.currentScene);
async function expectScene(page,value,name) { assert.equal(await scene(page),value,name); checks.push(name); }
async function burst(page, values, interval = 16, target = 'body', mode = 0) {
  await page.evaluate(({values,interval,target,mode}) => {
    const element = document.querySelector(target);
    const start = performance.now();
    // Nominal input timestamps model hardware events queued during a busy frame.
    values.forEach((deltaY,i) => {
      const event = new WheelEvent('wheel',{deltaY,deltaMode:mode,bubbles:true,cancelable:true});
      Object.defineProperty(event,'timeStamp',{value:start+i*interval});
      element.dispatchEvent(event);
    });
  }, {values,interval,target,mode});
  await page.waitForTimeout(values.length*interval+180);
}
try {
  const page = await noGL.newPage({viewport:{width:1440,height:900}});
  page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(base); await page.waitForTimeout(300);
  // Actual browser mouse wheel API: all events are one high-frequency burst.
  await page.mouse.move(1350,400);
  for (const value of [45,55,48,40,32,26,20,16,12,8,5,3,-2,1]) await page.mouse.wheel(0,value);
  await expectScene(page,1,'browser mouse wheel inertia advances exactly once');
  await page.waitForTimeout(650);
  await burst(page,[45,55,48,40,32,26,20,16,12,8,5,3,-2,1],55);
  await expectScene(page,2,'precision trackpad tail and oscillation advance once');
  await burst(page,Array(100).fill(50));
  await expectScene(page,3,'continuous scrolling advances once');
  await burst(page,[4,5,7,8,5,2]); await expectScene(page,4,'small deliberate deltas');
  await burst(page,[-10000,-10000]); await expectScene(page,3,'large reverse gesture');
  await burst(page,[-2],16,'body',1); await expectScene(page,2,'line delta mode');
  await burst(page,[1],16,'body',2); await expectScene(page,3,'page delta mode');
  await page.evaluate(() => { document.querySelector('[data-scene-jump="0"]').click(); document.querySelector('[data-scene-jump="4"]').click(); document.querySelector('[data-scene-jump="2"]').click(); });
  await expectScene(page,2,'rapid buttons do not depend on wheel lock');
  await page.goBack(); await expectScene(page,4,'browser back restores scene');
  await page.goForward(); await expectScene(page,2,'browser forward restores scene');
  await page.locator('.scene-flow [data-next-scene]').click();
  await expectScene(page,3,'visible next-project control');
  await page.locator('.scene-flow [data-prev-scene]').click();
  await expectScene(page,2,'visible previous-project control');
  await page.locator('.scene-flow [data-next-scene]').focus();
  await page.keyboard.press('Enter');
  assert.equal(await page.locator('#scene-title-3').evaluate(e=>e===document.activeElement),true,'keyboard scene control focuses the new heading');
  await page.keyboard.press('Tab');
  assert.equal(await page.locator('[data-scene-panel="3"] .primary-action').evaluate(e=>e===document.activeElement),true,'next Tab reaches the case study');
  checks.push('keyboard scene navigation keeps the case-study action in focus order');
  await page.locator('.scene-flow [data-prev-scene]').click();
  await page.locator('body').click({position:{x:1350,y:400}});
  await page.keyboard.press('ArrowDown'); await expectScene(page,3,'keyboard forward');
  await page.keyboard.press('Home'); await expectScene(page,0,'keyboard Home');
  await page.keyboard.press('End'); await expectScene(page,5,'keyboard End');
  await page.evaluate(() => document.querySelector('[data-scene-jump="1"]').click());
  await page.locator('[data-scene-panel="1"] [data-open-evidence]').click();
  assert.equal(await page.locator('#evidence-dialog').evaluate(d=>d.open),true);
  await burst(page,[120,120]); await expectScene(page,1,'dialog owns wheel');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#evidence-dialog').evaluate(d=>d.open),false);
  assert.equal(await page.locator('[data-scene-panel="1"] [data-open-evidence]').evaluate(e=>e===document.activeElement),true,'dialog restores focus');
  checks.push('dialog Escape and focus restoration');
  await page.locator('[data-open-archive]').first().click();
  await page.locator('#archive-dialog [data-close-archive]').click(); checks.push('archive opens and closes');
  await page.evaluate(() => { const p=document.querySelector('[data-scene-panel="1"]'); p.style.maxHeight='140px'; p.scrollTop=0; });
  const panel=page.locator('[data-scene-panel="1"]');
  await panel.hover(); await page.mouse.wheel(0,60); await page.waitForTimeout(80);
  assert.ok(await panel.evaluate(p=>p.scrollTop)>0,'native panel actually scrolls');
  await page.evaluate(() => { const p=document.querySelector('[data-scene-panel="1"]'); p.scrollTop=p.scrollHeight; });
  await burst(page,[100,60,20],16,'[data-scene-panel="1"]');
  await expectScene(page,1,'native scroll gesture cannot escape panel at boundary');
  await burst(page,[100,60,20],16,'[data-scene-panel="1"]');
  await expectScene(page,2,'fresh gesture at panel bottom advances to the next scene');
  await page.evaluate(() => { document.querySelector('[data-scene-panel="2"]').style.maxHeight='140px'; });
  const prevented = await page.evaluate(() => {
    document.querySelector('[data-scene-jump="1"]').click();
    const oldPanel=document.querySelector('[data-scene-panel="1"]');
    oldPanel.scrollTop=oldPanel.scrollHeight;
    const start=performance.now();
    const first=new WheelEvent('wheel',{deltaY:100,bubbles:true,cancelable:true});
    Object.defineProperty(first,'timeStamp',{value:start});
    oldPanel.dispatchEvent(first);
    const panel=document.querySelector('[data-scene-panel="2"]');
    const event=new WheelEvent('wheel',{deltaY:60,bubbles:true,cancelable:true});
    Object.defineProperty(event,'timeStamp',{value:start+16});
    panel.dispatchEvent(event);
    return event.defaultPrevented;
  });
  assert.equal(prevented,true,'remaining scene-gesture momentum cannot scroll the newly revealed panel');
  checks.push('scene gesture momentum remains suppressed when its target changes');
  await page.evaluate(() => { document.querySelector('[data-scene-panel="2"]').style.maxHeight=''; });
  await page.waitForTimeout(200);
  await burst(page,[-100,-60,-20],16,'[data-scene-panel="2"]');
  await expectScene(page,1,'fresh gesture at panel top returns to the previous scene');
  await page.evaluate(()=>document.querySelector('[data-scene-panel="1"]').style.maxHeight='');
  await page.locator('[data-scene-panel="1"] .scene-lead').hover();
  await page.waitForTimeout(650);
  await page.mouse.wheel(0,100);
  await expectScene(page,2,'wheel over Aegis text advances instead of trapping navigation');
  const mobile = await noGL.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  mobile.on('pageerror',e=>errors.push(String(e)));
  await mobile.goto(base+'/#gridium'); await expectScene(mobile,2,'direct scene URL without WebGL');
  await mobile.evaluate(() => {
    const canvas=document.querySelector('canvas');
    const a=new Touch({identifier:1,target:canvas,clientX:190,clientY:220});
    const b=new Touch({identifier:1,target:canvas,clientX:190,clientY:120});
    canvas.dispatchEvent(new TouchEvent('touchstart',{touches:[a],bubbles:true}));
    canvas.dispatchEvent(new TouchEvent('touchend',{changedTouches:[b],bubbles:true}));
  });
  await expectScene(mobile,3,'touch swipe advances once');
  await mobile.evaluate(() => {
    const panel=document.querySelector('[data-scene-panel="3"]');
    panel.style.maxHeight='120px'; panel.scrollTop=40;
    const a=new Touch({identifier:1,target:panel,clientX:190,clientY:620});
    const b=new Touch({identifier:1,target:panel,clientX:190,clientY:520});
    panel.dispatchEvent(new TouchEvent('touchstart',{touches:[a],bubbles:true}));
    panel.scrollTop=panel.scrollHeight;
    panel.dispatchEvent(new TouchEvent('touchend',{changedTouches:[b],bubbles:true}));
  });
  await expectScene(mobile,3,'content swipe reaching its edge remains native');
  await mobile.evaluate(() => {
    const panel=document.querySelector('[data-scene-panel="3"]');
    const a=new Touch({identifier:1,target:panel,clientX:190,clientY:620});
    const b=new Touch({identifier:1,target:panel,clientX:190,clientY:520});
    panel.dispatchEvent(new TouchEvent('touchstart',{touches:[a],bubbles:true}));
    panel.dispatchEvent(new TouchEvent('touchend',{changedTouches:[b],bubbles:true}));
  });
  await expectScene(mobile,4,'fresh swipe at content edge advances to the next scene');
  assert.equal(await mobile.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'mobile home overflow');
  for (const file of ['aegis','gridium','compressor-cbm','topoflow','food','yield','sodexo']) {
    await mobile.goto(`${base}/${file}.html`);
    assert.equal(await mobile.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${file} mobile overflow`);
    assert.ok(await mobile.locator('h1').innerText());
    await mobile.locator('.nav-back').click();
    await mobile.waitForFunction(()=>document.body.dataset.currentScene !== undefined);
    await expectScene(mobile,0,`${file} returns to the homepage`);
  }
  checks.push('all case studies remain readable without WebGL, no mobile overflow');
  const graphics = await browser.newPage({viewport:{width:1440,height:900}});
  graphics.on('pageerror',e=>errors.push(String(e)));
  graphics.on('console',m=>{if(m.type()==='error') errors.push(m.text());});
  await graphics.goto(base);
  await graphics.waitForFunction(()=>document.body.dataset.graphicsReady==='true',null,{timeout:30000});
  assert.equal(await graphics.evaluate(()=>window.__observatory.worldStatus[0]),'ready');
  await burst(graphics,[45,55,48,40,32,26,20,16,12,8,5,3,-2,1],55);
  await expectScene(graphics,1,'gesture with active WebGL');
  for(let round=0;round<3;round++) for(let i=0;i<6;i++) {
    await graphics.evaluate(i=>document.querySelector(`[data-scene-jump="${i}"]`).click(),i);
    await graphics.waitForFunction(i=>window.__observatory.worldStatus[i]==='ready' && document.body.dataset.graphicsReady==='true',i,{timeout:30000});
  }
  const first=await graphics.evaluate(()=>window.__perfTelemetry.getSnapshot());
  for(let i=0;i<6;i++) { await graphics.evaluate(i=>document.querySelector(`[data-scene-jump="${i}"]`).click(),i); await graphics.waitForTimeout(100); }
  const second=await graphics.evaluate(()=>window.__perfTelemetry.getSnapshot());
  assert.equal(second.geometries,first.geometries,'warm traversal geometry cache stable');
  assert.equal(second.textures,first.textures,'warm traversal texture cache stable');
  checks.push('all worlds ready, repeated traversal GPU resources stable');
  assert.equal(await graphics.evaluate(()=>getComputedStyle(document.querySelector('.canvas-fallback')).opacity), '0', 'fallback cannot cover ready WebGL');
  checks.push('ready WebGL is revealed above the fallback');
  await graphics.evaluate(()=>document.querySelector('[data-scene-jump="3"]').click());
  const sceneBeforeLoss = await scene(graphics);
  await graphics.evaluate(()=>document.querySelector('canvas').getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());
  await graphics.waitForFunction(()=>document.body.dataset.graphicsReady==='false');
  await expectScene(graphics,sceneBeforeLoss,'context loss preserves content');
  await graphics.locator('.scene-flow [data-next-scene]').click();
  await expectScene(graphics,4,'navigation continues after context loss');
  assert.equal(await graphics.evaluate(()=>document.body.dataset.graphicsReady),'false','context loss keeps the fallback visible during navigation');
  for (const file of ['aegis','gridium','compressor-cbm','topoflow','food','yield','sodexo']) {
    await graphics.goto(`${base}/${file}.html`);
    await graphics.waitForFunction(()=>window.__heroTelemetry?.().ready,null,{timeout:30000});
    await graphics.evaluate(()=>scrollTo(0,document.body.scrollHeight)); await graphics.waitForTimeout(300);
    assert.equal(await graphics.evaluate(()=>window.__heroTelemetry().running),false,`${file} offscreen loop stops`);
    const before=await graphics.evaluate(()=>window.__heroTelemetry().rendered);
    await graphics.waitForTimeout(200);
    assert.equal(await graphics.evaluate(()=>window.__heroTelemetry().rendered),before,`${file} renders no offscreen frames`);
  }
  checks.push('all seven hero renderers stop offscreen');
  const reduced=await browser.newPage({reducedMotion:'reduce',viewport:{width:390,height:844},hasTouch:true});
  await reduced.goto(base+'/#topoflow');
  await reduced.waitForFunction(()=>document.body.dataset.graphicsReady==='true',null,{timeout:30000});
  await reduced.goto(base+'/yield.html');
  await reduced.waitForFunction(()=>window.__heroTelemetry?.().ready,null,{timeout:30000});
  assert.equal(await reduced.evaluate(()=>window.__heroTelemetry().running),false);
  checks.push('reduced motion renders a static hero');
  await graphics.goto(base+'/threeui-lab.html');
  await graphics.waitForFunction(()=>window.__labTelemetry?.().ready,null,{timeout:30000});
  for(let i=0;i<5;i++) {
    await graphics.locator(`[data-prototype-tab="${i}"]`).click();
    await graphics.waitForFunction(i=>window.__labTelemetry().ready && window.__labTelemetry().index===i,i,{timeout:30000});
  }
  await graphics.evaluate(()=>[0,1,2,3,0].forEach(i=>document.querySelector(`[data-prototype-tab="${i}"]`).click()));
  await graphics.waitForFunction(()=>window.__labTelemetry().ready && window.__labTelemetry().index===0,null,{timeout:30000});
  checks.push('lab prototypes and rapid tab changes compile before disposal');
  assert.deepEqual(errors,[],'runtime and console errors');
  await fs.mkdir('.audit/overhaul',{recursive:true});
  await fs.writeFile('.audit/overhaul/interactions.json',JSON.stringify({checks,errors,resourceCounts:{first,second}},null,2));
  console.log(`PASS: ${checks.length} interaction groups`,checks);
} finally { await browser.close(); await noGL.close(); server.close(); }
