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
async function settleScroll(page) {
  await page.evaluate(() => new Promise(resolve => {
    let previous = scrollY, stableSince = performance.now();
    const deadline = stableSince + 4000;
    const sample = () => {
      const now = performance.now();
      if (Math.abs(scrollY - previous) > .5) { previous = scrollY; stableSince = now; }
      if (now - stableSince >= 140 || now >= deadline) resolve();
      else setTimeout(sample, 20);
    };
    setTimeout(sample, 20);
  }));
}
async function expectScene(page,value,name) {
  await settleScroll(page);
  await page.waitForFunction(value => +document.body.dataset.currentScene === value,value);
  assert.equal(await scene(page),value,name);
  checks.push(name);
}
async function jump(page,index) {
  await page.evaluate(index => document.querySelector(`.scene-rail [data-scene-jump="${index}"]`).click(),index);
  await settleScroll(page);
  await page.waitForFunction(index => +document.body.dataset.currentScene === index,index);
}
async function wheel(page,values,interval = 16) {
  // Trusted browser input invokes native scrolling; dispatchEvent(WheelEvent)
  // only exercises listeners and cannot verify the document's default action.
  for (const deltaY of values) {
    await page.mouse.wheel(0,deltaY);
    if (interval) await page.waitForTimeout(interval);
  }
  await settleScroll(page);
}
async function swipe(session,page,{x = 190,fromY = 620,toY = 240,steps = 14,interval = 50} = {}) {
  // DevTools dispatches touch input through Chromium's native input pipeline.
  // Unlike synthetic TouchEvents, this verifies browser panning and inertia.
  await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y:fromY}]});
  for (let i = 1; i <= steps; i++) {
    await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:fromY + (toY - fromY) * i / steps}]});
    await page.waitForTimeout(interval);
  }
  await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await settleScroll(page);
}
try {
  const page = await noGL.newPage({viewport:{width:1440,height:900}});
  page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(base);
  await page.waitForFunction(()=>document.body.dataset.currentScene !== undefined);
  await expectScene(page,0,'native document begins at the introduction');
  await page.locator('.scene-rail [data-scene-jump="1"]').click();
  await expectScene(page,1,'explicit navigation from the initial empty URL');
  await page.goBack();
  await expectScene(page,0,'browser Back restores the initial empty-hash homepage');
  assert.ok(await page.evaluate(()=>scrollY)<1,'initial history entry restores the top of the document');
  const documentLayout = await page.evaluate(() => ({
    height:document.documentElement.scrollHeight,
    viewport:innerHeight,
    panels:[...document.querySelectorAll('[data-scene-panel]')].map(p=>({
      inert:p.inert,
      hidden:p.getAttribute('aria-hidden') === 'true',
      scroller:p.scrollHeight > p.clientHeight + 2 && /auto|scroll/.test(getComputedStyle(p).overflowY)
    }))
  }));
  assert.ok(documentLayout.height > documentLayout.viewport * 5,'six scenes create a vertically scrollable document');
  assert.equal(documentLayout.panels.length,6);
  assert.ok(documentLayout.panels.every(p=>!p.inert && !p.hidden && !p.scroller),'all scene content stays accessible without nested scrolling');
  assert.equal(await page.locator('.scene-panel').first().evaluate(p=>getComputedStyle(p).touchAction),'auto','native narrative permits pinch zoom');
  checks.push('all six scenes stay in accessible document flow');
  await page.evaluate(() => {
    window.__nativeWheelEvents = [];
    window.addEventListener('wheel',event=>window.__nativeWheelEvents.push({delta:event.deltaY,prevented:event.defaultPrevented}),{passive:true});
  });
  await page.mouse.move(1350,400);
  const shortStart = await page.evaluate(()=>scrollY);
  await wheel(page,[45,55,48,40,32,26,20,16,12,8,5,3,-2,1]);
  const shortEnd = await page.evaluate(()=>scrollY);
  assert.ok(shortEnd > shortStart + 150,'short trackpad-like movement visibly scrolls instead of disappearing');
  checks.push('short wheel movement produces visible native document scrolling');
  const steadyStart = shortEnd;
  await wheel(page,Array(8).fill(120),100);
  assert.ok(await page.evaluate(()=>scrollY) > steadyStart + 700,'successive wheel ticks keep moving without a gesture lock');
  checks.push('steady successive wheel ticks continue scrolling');
  await jump(page,0);
  await page.mouse.move(1350,400);
  await wheel(page,[100]);
  await page.waitForTimeout(100);
  const gentleStart = await page.evaluate(()=>scrollY);
  await wheel(page,Array(20).fill(5));
  assert.ok(await page.evaluate(()=>scrollY) > gentleStart + 60,'gentle constant follow-up input remains responsive');
  checks.push('small steady follow-up deltas remain responsive');
  await jump(page,0);
  await page.mouse.move(1350,400);
  await page.mouse.wheel(0,450);
  await page.waitForTimeout(60);
  const reversalStart = await page.evaluate(()=>scrollY);
  assert.ok(reversalStart > 250,'forward input moves before reversal');
  await page.mouse.wheel(0,-180);
  await settleScroll(page);
  assert.ok(await page.evaluate(()=>scrollY) < reversalStart - 100,'rapid upward reversal responds without waiting for silence');
  checks.push('rapid direction reversal immediately changes document scrolling');

  await jump(page,0);
  const passiveHistory = await page.evaluate(()=>history.length);
  const aegisDistance = await page.locator('[data-scene-panel="1"]').evaluate(p=>p.getBoundingClientRect().top + 40);
  await page.mouse.move(1350,400);
  await wheel(page,[aegisDistance],0);
  await expectScene(page,1,'native scrolling selects the visible Aegis scene');
  assert.equal(await page.evaluate(()=>history.length),passiveHistory,'passive scrolling replaces history without adding entries');
  assert.equal(await page.evaluate(()=>location.hash),'#aegis','passive scrolling updates the scene URL');
  checks.push('passive scene selection updates the URL without flooding history');
  await page.locator('[data-scene-panel="1"] .scene-lead').hover();
  const textStart = await page.evaluate(()=>scrollY);
  await wheel(page,[80,80,80,80],60);
  assert.ok(await page.evaluate(()=>scrollY) > textStart + 200,'wheel over Aegis text scrolls the document');
  assert.equal(await page.locator('[data-scene-panel="1"]').evaluate(p=>p.scrollTop),0,'text does not create a competing panel scroll position');
  checks.push('native scrolling over Aegis text has no nested scroll trap');
  const uncancelled = await page.evaluate(() => {
    const target=document.querySelector('[data-scene-panel="1"] .scene-lead');
    return [0,1,2].map(deltaMode=>{
      const event=new WheelEvent('wheel',{deltaY:12,deltaMode,bubbles:true,cancelable:true});
      target.dispatchEvent(event);
      return event.defaultPrevented;
    });
  });
  assert.deepEqual(uncancelled,[false,false,false],'pixel, line and page wheel events remain native');
  checks.push('wheel events are not cancelled in any delta mode');

  await page.evaluate(() => { document.querySelector('.scene-rail [data-scene-jump="0"]').click(); document.querySelector('.scene-rail [data-scene-jump="4"]').click(); document.querySelector('.scene-rail [data-scene-jump="2"]').click(); });
  await expectScene(page,2,'rapid scene buttons reach the final requested section');
  await page.goBack(); await expectScene(page,4,'browser back restores the selected section');
  await page.goForward(); await expectScene(page,2,'browser forward restores the selected section');
  const explicitHistory = await page.evaluate(()=>history.length);
  await page.locator('.scene-flow [data-next-scene]').click();
  await expectScene(page,3,'visible next-project control scrolls to its section');
  assert.equal(await page.evaluate(()=>history.length),explicitHistory + 1,'explicit scene navigation adds a history entry');
  await page.locator('.scene-flow [data-prev-scene]').click();
  await expectScene(page,2,'visible previous-project control scrolls to its section');
  await page.locator('.scene-flow [data-next-scene]').focus();
  await page.keyboard.press('Enter');
  await expectScene(page,3,'keyboard scene control selects its section');
  assert.equal(await page.locator('#scene-title-3').evaluate(e=>e===document.activeElement),true,'keyboard scene control focuses the new heading');
  await page.keyboard.press('Tab');
  assert.equal(await page.locator('[data-scene-panel="3"] .primary-action').evaluate(e=>e===document.activeElement),true,'next Tab reaches the case study');
  checks.push('keyboard scene navigation keeps the case-study action in focus order');
  await jump(page,2);
  await page.mouse.click(1350,400);
  const arrowStart = await page.evaluate(()=>scrollY);
  await page.keyboard.press('ArrowDown'); await settleScroll(page);
  assert.ok(await page.evaluate(()=>scrollY) > arrowStart,'ArrowDown keeps native document scrolling');
  const pageDownStart = await page.evaluate(()=>scrollY);
  await page.keyboard.press('PageDown'); await settleScroll(page);
  assert.ok(await page.evaluate(()=>scrollY) > pageDownStart + 200,'PageDown keeps native document scrolling');
  const pageUpStart = await page.evaluate(()=>scrollY);
  await page.keyboard.press('PageUp'); await settleScroll(page);
  assert.ok(await page.evaluate(()=>scrollY) < pageUpStart - 200,'PageUp keeps native document scrolling');
  const arrowUpStart = await page.evaluate(()=>scrollY);
  await page.keyboard.press('ArrowUp'); await settleScroll(page);
  assert.ok(await page.evaluate(()=>scrollY) < arrowUpStart,'ArrowUp keeps native document scrolling');
  checks.push('vertical arrows and page keys keep native scrolling');
  await jump(page,2);
  await page.keyboard.press('ArrowRight'); await expectScene(page,3,'keyboard right selects the next section');
  await page.keyboard.press('ArrowLeft'); await expectScene(page,2,'keyboard left selects the previous section');
  await page.keyboard.press('Home'); await expectScene(page,0,'keyboard Home returns to the introduction');
  await page.keyboard.press('End'); await expectScene(page,5,'keyboard End selects the profile');

  await jump(page,1);
  await page.locator('[data-scene-panel="1"] [data-open-evidence]').click();
  assert.equal(await page.locator('#evidence-dialog').evaluate(d=>d.open),true);
  const dialogScrollStart = await page.evaluate(()=>scrollY);
  await page.locator('#evidence-dialog').hover();
  await wheel(page,[120,120]);
  assert.equal(await page.evaluate(()=>scrollY),dialogScrollStart,'modal scrolling does not move the underlying document');
  await expectScene(page,1,'dialog scrolling keeps the underlying scene selected');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#evidence-dialog').evaluate(d=>d.open),false);
  assert.equal(await page.locator('[data-scene-panel="1"] [data-open-evidence]').evaluate(e=>e===document.activeElement),true,'dialog restores focus');
  checks.push('dialog Escape and focus restoration');
  await page.locator('[data-open-archive]').first().click();
  await page.locator('#archive-dialog [data-close-archive]').click(); checks.push('archive opens and closes');
  const nativeWheelEvents = await page.evaluate(()=>window.__nativeWheelEvents);
  assert.ok(nativeWheelEvents.length >= 30,'trusted browser wheel events were observed');
  assert.ok(nativeWheelEvents.every(event=>!event.prevented),'trusted wheel events are never cancelled');
  checks.push('trusted wheel input remains uncancelled throughout browsing');

  const mobile = await noGL.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  mobile.on('pageerror',e=>errors.push(String(e)));
  await mobile.goto(base+'/#gridium'); await expectScene(mobile,2,'direct scene URL scrolls to Gridium without WebGL');
  assert.ok(await mobile.evaluate(()=>scrollY)>1000,'deep link has an actual document scroll position');
  await mobile.evaluate(() => {
    window.__nativeTouchEvents=[];
    window.addEventListener('touchmove',event=>window.__nativeTouchEvents.push(event.defaultPrevented),{passive:true});
  });
  const touchSession = await mobile.context().newCDPSession(mobile);
  const slowTouchStart = await mobile.evaluate(()=>scrollY);
  await swipe(touchSession,mobile);
  assert.ok(await mobile.evaluate(()=>scrollY) > slowTouchStart + 120,'a slow swipe longer than 600ms scrolls naturally');
  checks.push('slow touch swipes retain native document panning');
  const quickTouchStart = await mobile.evaluate(()=>scrollY);
  await swipe(touchSession,mobile,{fromY:650,toY:180,steps:6,interval:16});
  assert.ok(await mobile.evaluate(()=>scrollY) > quickTouchStart + 100,'successive touch swipes keep moving');
  checks.push('successive touch swipes continue browsing');
  const reverseTouchStart = await mobile.evaluate(()=>scrollY);
  await swipe(touchSession,mobile,{fromY:240,toY:620});
  assert.ok(await mobile.evaluate(()=>scrollY) < reverseTouchStart - 120,'downward swipe reverses document movement');
  checks.push('touch direction reversal scrolls back naturally');
  const touchEvents = await mobile.evaluate(()=>window.__nativeTouchEvents);
  assert.ok(touchEvents.length>0,'native touchmove events were observed');
  assert.ok(touchEvents.every(prevented=>!prevented),'touch panning is not cancelled');
  checks.push('native touch movement remains uncancelled');
  await touchSession.detach();
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
  await graphics.mouse.move(1350,400);
  const graphicsAegisDistance = await graphics.locator('[data-scene-panel="1"]').evaluate(p=>p.getBoundingClientRect().top + 40);
  await wheel(graphics,[graphicsAegisDistance],0);
  await expectScene(graphics,1,'native document scrolling selects Aegis with active WebGL');
  await graphics.waitForFunction(()=>window.__observatory.worldStatus[1]==='ready' && document.body.dataset.graphicsReady==='true',null,{timeout:30000});
  assert.equal(await graphics.locator('canvas').evaluate(c=>getComputedStyle(c).pointerEvents),'none','decorative canvas leaves normal document browsing alone');
  await graphics.locator('[data-model-explore]').click();
  assert.equal(await graphics.evaluate(()=>document.body.dataset.modelExploring),'true','model interaction requires explicit opt-in');
  const modelTargets = await graphics.locator('[data-model-explore], [data-motion-toggle], [data-model-reset], [data-model-point]').evaluateAll(buttons=>buttons.map(button=>{
    const rect=button.getBoundingClientRect(); return {width:rect.width,height:rect.height};
  }));
  assert.ok(modelTargets.length>=6 && modelTargets.every(rect=>rect.width>=43.5 && rect.height>=43.5),'model controls offer at least 44px targets');
  const explorationBefore = await graphics.evaluate(()=>({...window.__observatory.exploration}));
  await graphics.mouse.move(1160,350);
  await graphics.mouse.down();
  await graphics.mouse.move(1290,420,{steps:8});
  await graphics.mouse.up();
  const explorationAfter = await graphics.evaluate(()=>({...window.__observatory.exploration}));
  assert.ok(Math.abs(explorationAfter.yaw-explorationBefore.yaw)>.01 || Math.abs(explorationAfter.pitch-explorationBefore.pitch)>.01,'mouse drag rotates the opted-in model');
  checks.push('explicit model interaction allows dragging with accessible control targets');
  const exploringScrollStart = await graphics.evaluate(()=>scrollY);
  await wheel(graphics,[120]);
  assert.ok(await graphics.evaluate(()=>scrollY)>exploringScrollStart+80,'wheel still scrolls the document while exploring the model');
  const exploringPrevented = await graphics.locator('canvas').evaluate(canvas=>{
    const event=new WheelEvent('wheel',{deltaY:12,bubbles:true,cancelable:true});
    canvas.dispatchEvent(event); return event.defaultPrevented;
  });
  assert.equal(exploringPrevented,false,'model exploration never captures wheel navigation');
  checks.push('model interaction preserves uncancelled native scrolling');
  const pausedBefore = await graphics.evaluate(()=>document.body.dataset.motionPaused==='true');
  await graphics.locator('[data-motion-toggle]').click();
  assert.equal(await graphics.evaluate(()=>document.body.dataset.motionPaused==='true'),!pausedBefore,'pause control changes motion state');
  assert.equal(await graphics.locator('[data-motion-toggle]').getAttribute('aria-pressed'),String(!pausedBefore),'pause state is announced accessibly');
  const pausedFrameCount = await graphics.evaluate(()=>window.__perfTelemetry.getSnapshot().renderedFrames);
  await graphics.waitForTimeout(200);
  assert.equal(await graphics.evaluate(()=>window.__perfTelemetry.getSnapshot().renderedFrames),pausedFrameCount,'pause stops the continuous rendering loop');
  assert.equal(await graphics.evaluate(()=>window.__perfTelemetry.getSnapshot().animationRunning),false,'pause disables continuous animation');
  await graphics.locator('[data-motion-toggle]').click();
  assert.equal(await graphics.evaluate(()=>document.body.dataset.motionPaused==='true'),pausedBefore,'pause control restores its original state');
  checks.push('motion pause stops continuous rendering and announces its state');
  for(let i=0;i<3;i++) {
    await graphics.locator(`[data-model-point="${i}"]`).click();
    assert.equal(await graphics.locator(`[data-model-point="${i}"]`).getAttribute('aria-pressed'),'true','selected subsystem view is announced');
    assert.ok((await graphics.locator('[data-model-description]').innerText()).trim(),'subsystem view has a readable explanation');
  }
  await graphics.locator('[data-model-reset]').click();
  const resetExploration = await graphics.evaluate(()=>({...window.__observatory.exploration}));
  assert.ok(Math.abs(resetExploration.yaw)<.0001 && Math.abs(resetExploration.pitch)<.0001,'reset restores the default model angle');
  assert.ok(await graphics.locator('[data-model-point]').evaluateAll(buttons=>buttons.every(button=>button.getAttribute('aria-pressed')==='false')),'reset clears subsystem selection');
  await graphics.locator('[data-model-explore]').click();
  assert.equal(await graphics.evaluate(()=>document.body.dataset.modelExploring),'false','exploration can be exited');
  assert.equal(await graphics.locator('canvas').evaluate(c=>getComputedStyle(c).pointerEvents),'none','exit restores the decorative canvas');
  checks.push('subsystem views explain the model and Reset restores browsing');
  await graphics.locator('[data-model-explore]').click();
  await graphics.locator('[data-model-point="1"]').focus();
  await graphics.keyboard.press('Escape');
  assert.equal(await graphics.evaluate(()=>document.body.dataset.modelExploring),'false','Escape exits exploration');
  assert.equal(await graphics.locator('[data-model-explore]').evaluate(button=>button===document.activeElement),true,'Escape restores focus to the visible explorer trigger');
  checks.push('Escape restores focus when leaving model exploration');
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
