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
const errors = [], checks = [], wheelTraces = [];
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
async function sendWheel(page,values,interval = 16) {
  // Trusted browser input invokes native scrolling; dispatchEvent(WheelEvent)
  // only exercises listeners and cannot verify the document's default action.
  for (const deltaY of values) {
    await page.mouse.wheel(0,deltaY);
    if (interval) await page.waitForTimeout(interval);
  }
}
async function wheel(page,values,interval = 16) {
  await sendWheel(page,values,interval);
  await settleScroll(page);
}
async function beginWheelTrace(page,label) {
  await page.evaluate(label=>{
    window.__wheelPhase=label;
    window.__chapterTrace=[];
    window.__chapterTraceActive=true;
    window.__traceWheelStart=window.__nativeWheelEvents.length;
    const record=source=>{
      if(window.__chapterTraceActive) window.__chapterTrace.push({source,scene:+document.body.dataset.currentScene,scrollY,hash:location.hash});
    };
    record('start');
    window.__chapterTraceObserver=new MutationObserver(()=>record('scene'));
    window.__chapterTraceObserver.observe(document.body,{attributes:true,attributeFilter:['data-current-scene']});
    if(!window.__chapterScrollRecorder) {
      window.__chapterScrollRecorder=()=>{
        if(window.__chapterTraceActive) window.__chapterTrace.push({source:'scroll',scene:+document.body.dataset.currentScene,scrollY,hash:location.hash});
      };
      window.addEventListener('scroll',window.__chapterScrollRecorder,{passive:true});
    }
  },label);
}
async function endWheelTrace(page,label) {
  const trace=await page.evaluate(()=>{
    window.__chapterTrace.push({source:'end',scene:+document.body.dataset.currentScene,scrollY,hash:location.hash});
    window.__chapterTraceActive=false;
    window.__chapterTraceObserver.disconnect();
    return {samples:window.__chapterTrace,events:window.__nativeWheelEvents.slice(window.__traceWheelStart)};
  });
  wheelTraces.push({label,...trace});
  return trace;
}
async function boundedWheel(page,{start,expected,values,label,interval=16}) {
  await jump(page,start);
  await page.mouse.move(1350,400);
  const anchor=await page.locator(`[data-scene-panel="${expected}"]`).evaluate(panel=>panel.offsetTop);
  await beginWheelTrace(page,label);
  await wheel(page,values,interval);
  const trace=await endWheelTrace(page,label);
  assert.equal(await scene(page),expected,`${label} reaches its adjacent chapter`);
  assert.ok(Math.abs(await page.evaluate(()=>scrollY)-anchor)<=2,`${label} stops at the adjacent chapter anchor`);
  assert.ok(trace.samples.every(sample=>sample.scene>=Math.min(start,expected) && sample.scene<=Math.max(start,expected)),`${label} never selects a chapter beyond its allowed range`);
  assert.ok(trace.events.every(event=>event.trusted),`${label} uses trusted browser wheel input`);
  assert.ok(trace.events.some(event=>event.prevented),`${label} intercepts overshooting momentum`);
  checks.push(label);
  return trace;
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
    window.addEventListener('wheel',event=>window.__nativeWheelEvents.push({delta:event.deltaY,deltaX:event.deltaX,ctrl:event.ctrlKey,trusted:event.isTrusted,prevented:event.defaultPrevented,phase:window.__wheelPhase || 'general'}),{passive:true});
    window.__wheelPhase='short';
  });
  await page.mouse.move(1350,400);
  const shortStart = await page.evaluate(()=>scrollY);
  await wheel(page,[45,55,48,40,32,26,20,16,12,8,5,3,-2,1]);
  const shortEnd = await page.evaluate(()=>scrollY);
  assert.ok(shortEnd > shortStart + 150,'short trackpad-like movement visibly scrolls instead of disappearing');
  checks.push('short wheel movement produces visible native document scrolling');
  await jump(page,0);
  await page.evaluate(()=>{window.__wheelPhase='steady';});
  const steadyStart = await page.evaluate(()=>scrollY);
  await wheel(page,Array(8).fill(80),100);
  assert.ok(await page.evaluate(()=>scrollY) > steadyStart + 500,'successive in-range wheel ticks keep moving without a gesture lock');
  checks.push('steady successive wheel ticks continue scrolling within a chapter');
  await jump(page,0);
  await page.evaluate(()=>{window.__wheelPhase='gentle';});
  await page.mouse.move(1350,400);
  await wheel(page,[100]);
  await page.waitForTimeout(100);
  const gentleStart = await page.evaluate(()=>scrollY);
  await wheel(page,Array(20).fill(5));
  assert.ok(await page.evaluate(()=>scrollY) > gentleStart + 60,'gentle constant follow-up input remains responsive');
  checks.push('small steady follow-up deltas remain responsive');
  await jump(page,0);
  await page.evaluate(()=>{window.__wheelPhase='reversal';});
  await page.mouse.move(1350,400);
  await page.mouse.wheel(0,450);
  await page.waitForTimeout(60);
  const reversalStart = await page.evaluate(()=>scrollY);
  assert.ok(reversalStart > 250,'forward input moves before reversal');
  await page.mouse.wheel(0,-180);
  await settleScroll(page);
  assert.ok(await page.evaluate(()=>scrollY) < reversalStart - 100,'rapid upward reversal responds without waiting for silence');
  checks.push('rapid direction reversal immediately changes document scrolling');

  const heavyBurst=[600,700,650,550,450,350,250,160,90,45,20,8,3];
  await boundedWheel(page,{start:0,expected:1,values:heavyBurst,label:'one strong decaying trackpad burst reaches Aegis without transient skipped chapters'});
  await boundedWheel(page,{start:0,expected:1,values:Array(20).fill(420),label:'one continuous high-volume wheel stream stays at the adjacent chapter'});
  await boundedWheel(page,{start:0,expected:1,values:[300,420,350,450,380,480,400,500,420,520,440,540],label:'ordinary acceleration ripples do not unlock a second chapter'});
  await boundedWheel(page,{start:2,expected:1,values:heavyBurst.map(value=>-value),label:'one strong upward trackpad burst stops at Aegis without passing to Origin'});

  await jump(page,0);
  await beginWheelTrace(page,'two separated deliberate bursts');
  await sendWheel(page,heavyBurst);
  await page.waitForTimeout(180);
  await wheel(page,heavyBurst);
  const separated=await endWheelTrace(page,'two separated deliberate bursts');
  const gridiumAnchor=await page.locator('[data-scene-panel="2"]').evaluate(panel=>panel.offsetTop);
  assert.equal(await scene(page),2,'a fresh burst after quiet advances to Gridium');
  assert.ok(Math.abs(await page.evaluate(()=>scrollY)-gridiumAnchor)<=2,'the second burst stops at its adjacent chapter');
  assert.ok(separated.samples.every(sample=>sample.scene>=0 && sample.scene<=2),'separated bursts never select a chapter beyond Gridium');
  checks.push('a fresh trackpad burst advances immediately after a short quiet interval');

  await jump(page,0);
  await beginWheelTrace(page,'renewed acceleration after the decaying tail');
  await wheel(page,[...heavyBurst,5,10,20,45,90,180,360,420,250,100,40,8,2]);
  const renewed=await endWheelTrace(page,'renewed acceleration after the decaying tail');
  assert.equal(await scene(page),2,'renewed deliberate acceleration can continue without waiting for a cooldown');
  assert.ok(Math.abs(await page.evaluate(()=>scrollY)-gridiumAnchor)<=2,'renewed input remains limited to its own adjacent chapter');
  assert.ok(renewed.samples.every(sample=>sample.scene>=0 && sample.scene<=2),'renewed input never transiently selects a third chapter');
  checks.push('renewed acceleration after several weak tail samples begins another responsive swipe');

  await jump(page,0);
  await beginWheelTrace(page,'one fresh impulse after the weak tail');
  await wheel(page,[...heavyBurst,30,28,24,18]);
  const impulse=await endWheelTrace(page,'one fresh impulse after the weak tail');
  const freshAegisAnchor=await page.locator('[data-scene-panel="1"]').evaluate(panel=>panel.offsetTop);
  assert.ok(await page.evaluate(()=>scrollY)>freshAegisAnchor+65,'a fresh impulse followed by normal decay moves instead of being swallowed');
  assert.ok(impulse.samples.every(sample=>sample.scene>=0 && sample.scene<=2),'fresh impulse never skips beyond its next allowed chapter');
  checks.push('a fresh single impulse followed by decay stays responsive before the old inertia is quiet');
  await jump(page,0);
  await beginWheelTrace(page,'a gently rising fresh swipe after the weak tail');
  await wheel(page,[...heavyBurst,5,6,7,8,10,12,14,16]);
  const gentleRamp=await endWheelTrace(page,'a gently rising fresh swipe after the weak tail');
  assert.ok(await page.evaluate(()=>scrollY)>freshAegisAnchor+35,'cumulative gentle growth moves without requiring exponential acceleration');
  assert.ok(gentleRamp.samples.every(sample=>sample.scene>=0 && sample.scene<=2),'gentle renewed input stays within one adjacent chapter');
  checks.push('a gently rising fresh swipe moves without a quiet-period lock');

  await jump(page,0);
  await beginWheelTrace(page,'a fresh steady 6px swipe after the weak tail');
  await wheel(page,[...heavyBurst,2,1,1,...Array(20).fill(6)]);
  const gentleSteady=await endWheelTrace(page,'a fresh steady 6px swipe after the weak tail');
  assert.ok(await page.evaluate(()=>scrollY)>freshAegisAnchor+60,'steady 6px input moves after the old weak tail without needing silence');
  assert.ok(gentleSteady.samples.every(sample=>sample.scene>=0 && sample.scene<=2),'the gentle fresh swipe cannot skip its adjacent chapter');
  checks.push('fresh steady 6px input immediately leaves a completed swipe');

  await jump(page,0);
  await beginWheelTrace(page,'tail jitter followed by deliberate reversal');
  await sendWheel(page,[...heavyBurst,-1,2,-2,1,4]);
  const aegisAnchor=await page.locator('[data-scene-panel="1"]').evaluate(panel=>panel.offsetTop);
  assert.ok(Math.abs(await page.evaluate(()=>scrollY)-aegisAnchor)<=2,'tiny sign oscillations do not release the chapter cap');
  await page.mouse.wheel(0,-140);
  await settleScroll(page);
  const jitter=await endWheelTrace(page,'tail jitter followed by deliberate reversal');
  assert.ok(await page.evaluate(()=>scrollY)<aegisAnchor-100,'a deliberate reverse responds while the old burst is still active');
  assert.ok(jitter.samples.every(sample=>sample.scene>=0 && sample.scene<=1),'tail jitter and reversal never select a farther project');
  checks.push('tiny tail jitter stays bounded while deliberate direction reversal responds immediately');

  await jump(page,0);
  await sendWheel(page,[10000]);
  await page.evaluate(()=>document.querySelector('.scene-rail [data-scene-jump="4"]').click());
  const explicitTarget=await page.locator('[data-scene-panel="4"]').evaluate(panel=>panel.offsetTop);
  await page.evaluate(()=>{window.__wheelPhase='explicit-reset';});
  await wheel(page,[40]);
  assert.ok(await page.evaluate(()=>scrollY)>explicitTarget+20,'explicit navigation clears the previous wheel range before fresh small input');
  assert.equal(await scene(page),4,'stale wheel state cannot snap an explicit jump back to an old chapter');
  checks.push('explicit scene jumps clear a just-capped wheel burst');
  await page.evaluate(()=>{window.__wheelPhase='keyboard-reset';});
  await jump(page,0);
  await sendWheel(page,[10000]);
  await page.keyboard.press('PageDown');
  await settleScroll(page);
  assert.ok(await page.evaluate(()=>scrollY)>aegisAnchor+300,'native PageDown is not restrained by a recent wheel cap');
  checks.push('keyboard browsing clears the recent wheel cap');

  await jump(page,5);
  await beginWheelTrace(page,'profile contact remains reachable');
  await wheel(page,[10000]);
  const profileTrace=await endWheelTrace(page,'profile contact remains reachable');
  const profileEnd=await page.evaluate(()=>({y:scrollY,maximum:document.documentElement.scrollHeight-innerHeight,contact:document.querySelector('.contact-finale').getBoundingClientRect().top}));
  assert.ok(Math.abs(profileEnd.y-profileEnd.maximum)<=2,'last chapter permits scrolling to the actual document end');
  assert.ok(profileEnd.contact<900,'the contact ending comes into view');
  assert.ok(profileTrace.samples.every(sample=>sample.scene===5),'scrolling through the last chapter keeps Profile selected');
  checks.push('bounded wheel scrolling still reaches the final profile contact section');

  await jump(page,0);
  await page.evaluate(()=>{window.__wheelPhase='general';});
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
      const event=new WheelEvent('wheel',{deltaY:deltaMode===2 ? .02 : 1,deltaMode,bubbles:true,cancelable:true});
      target.dispatchEvent(event);
      return event.defaultPrevented;
    });
  });
  assert.deepEqual(uncancelled,[false,false,false],'small in-range pixel, line and page wheel events keep their native default available');
  checks.push('in-range wheel events preserve native defaults across delta modes');

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
  const dialogWheelStart=await page.evaluate(()=>window.__nativeWheelEvents.length);
  await page.locator('#evidence-dialog').hover();
  await wheel(page,[120,120]);
  assert.equal(await page.evaluate(()=>scrollY),dialogScrollStart,'modal scrolling does not move the underlying document');
  assert.ok((await page.evaluate(start=>window.__nativeWheelEvents.slice(start),dialogWheelStart)).every(event=>!event.prevented),'dialog wheel input keeps its native scrolling default');
  await expectScene(page,1,'dialog scrolling keeps the underlying scene selected');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#evidence-dialog').evaluate(d=>d.open),false);
  assert.equal(await page.locator('[data-scene-panel="1"] [data-open-evidence]').evaluate(e=>e===document.activeElement),true,'dialog restores focus');
  checks.push('dialog Escape and focus restoration');
  await page.locator('[data-open-archive]').first().click();
  await page.locator('#archive-dialog [data-close-archive]').click(); checks.push('archive opens and closes');
  const nativeWheelEvents = await page.evaluate(()=>window.__nativeWheelEvents);
  const trustedWheelEvents=nativeWheelEvents.filter(event=>event.trusted);
  assert.ok(trustedWheelEvents.length >= 100,'trusted browser wheel events were observed');
  assert.ok(trustedWheelEvents.some(event=>event.prevented),'overshooting momentum is selectively intercepted');
  assert.ok(trustedWheelEvents.some(event=>!event.prevented),'ordinary wheel movement retains its native default');
  const inRange=trustedWheelEvents.filter(event=>['short','steady','gentle','explicit-reset'].includes(event.phase));
  assert.ok(inRange.length>=40,'small and in-range input was exercised');
  assert.ok(inRange.every(event=>!event.prevented),'small and in-range wheel input is not cancelled');
  checks.push('trusted wheel input stays native within a chapter while overshooting momentum is bounded');

  // Keep modifier/zoom checks in a separate page so browser zoom cannot affect
  // the dimensions or history used by the remaining portfolio assertions.
  const bypass=await noGL.newPage({viewport:{width:1440,height:900}});
  bypass.on('pageerror',error=>errors.push(String(error)));
  await bypass.goto(base);
  await bypass.waitForFunction(()=>document.body.dataset.currentScene!==undefined);
  await bypass.evaluate(()=>{
    window.__bypassWheels=[];
    window.addEventListener('wheel',event=>window.__bypassWheels.push({delta:event.deltaY,deltaX:event.deltaX,ctrl:event.ctrlKey,trusted:event.isTrusted,prevented:event.defaultPrevented}),{passive:true});
    const scroller=document.createElement('div');
    scroller.id='native-scroll-probe';
    scroller.style.cssText='position:fixed;left:900px;top:200px;width:200px;height:140px;overflow:auto;overscroll-behavior:contain;z-index:100000';
    scroller.innerHTML='<div style="height:1200px">Native scroll regression probe</div>';
    document.body.append(scroller);
  });
  await bypass.mouse.move(950,250);
  await wheel(bypass,[80,80]);
  assert.ok(await bypass.locator('#native-scroll-probe').evaluate(scroller=>scroller.scrollTop)>100,'nested content retains trusted native scrolling');
  assert.ok(await bypass.evaluate(()=>scrollY)<1,'contained nested scrolling does not move the outer document');
  await bypass.locator('#native-scroll-probe').evaluate(scroller=>{
    scroller.firstElementChild.style.height='60px';
    scroller.style.overscrollBehavior='auto';
    scroller.scrollTop=0;
  });
  await wheel(bypass,[12]);
  assert.ok(await bypass.evaluate(()=>scrollY)>5,'a cached target stops bypassing chapter handling when its native scroller becomes empty');
  await bypass.locator('#native-scroll-probe').evaluate(scroller=>{
    scroller.firstElementChild.style.height='1200px';
    scroller.style.overscrollBehavior='contain';
    window.scrollTo({top:0,behavior:'instant'});
  });
  await wheel(bypass,[80,80]);
  assert.ok(await bypass.locator('#native-scroll-probe').evaluate(scroller=>scroller.scrollTop)>100,'the same cached target resumes native scrolling after its content grows');
  assert.ok(await bypass.evaluate(()=>scrollY)<1,'a resized nested scroller does not leak wheel movement to the document');
  checks.push('cached wheel ancestry updates when nested content shrinks or grows');
  await bypass.locator('#native-scroll-probe').evaluate(scroller=>scroller.remove());
  await bypass.mouse.move(1350,400);
  await bypass.mouse.wheel(8000,120);
  await settleScroll(bypass);
  await bypass.keyboard.down('Control');
  await bypass.mouse.wheel(0,-50);
  await bypass.keyboard.up('Control');
  await bypass.waitForFunction(()=>window.__bypassWheels.some(event=>event.ctrl));
  const bypassWheels=await bypass.evaluate(()=>window.__bypassWheels);
  assert.ok(bypassWheels.every(event=>event.trusted && !event.prevented),'nested, horizontal-dominant and pinch-style modifier wheel events retain native defaults');
  assert.ok(bypassWheels.some(event=>event.deltaX>Math.abs(event.delta)),'horizontal-dominant wheel input was exercised');
  assert.ok(bypassWheels.some(event=>event.ctrl),'pinch-style ctrl-wheel input was exercised');
  wheelTraces.push({label:'nested content, horizontal input and pinch-style zoom stay native',events:bypassWheels});
  checks.push('nested scrolling, horizontal wheel input and pinch-style zoom retain native defaults');
  await bypass.keyboard.press('Control+0');
  await jump(bypass,0);
  await sendWheel(bypass,[10000]);
  const cappedBeforeDiagonal=await bypass.evaluate(()=>scrollY);
  await bypass.mouse.wheel(1000,80);
  await settleScroll(bypass);
  assert.ok(await bypass.evaluate(()=>scrollY)>cappedBeforeDiagonal+40,'a horizontal-dominant gesture releases the previous vertical cap before native diagonal movement');
  checks.push('bypassed wheel modes release stale vertical ownership after a capped burst');
  await bypass.close();

  assert.equal(await page.locator('.model-tools, [data-model-explore], [data-model-point], [data-model-reset], [data-motion-toggle]').count(),0,'homepage has no model control widgets');
  const workIndex = page.locator('.hero-work-index');
  assert.equal(await workIndex.count(),1,'introduction offers one curated work index');
  assert.deepEqual(await workIndex.locator('[data-scene-jump]').evaluateAll(buttons=>buttons.map(button=>+button.dataset.sceneJump).sort()),[1,2,3,4],'work index links directly to the four featured projects');
  await jump(page,0);
  await workIndex.locator('[data-scene-jump="2"]').click();
  await expectScene(page,2,'curated work index takes readers directly to Gridium');
  checks.push('curated work index provides four working project shortcuts');
  assert.equal(await page.locator('.project-visual, [class*="artifact-"]').count(),0,'project screenshot frames have been removed');
  assert.deepEqual(await page.locator('[data-model-view]').evaluateAll(views=>views.map(view=>+view.dataset.modelView)),[0,1,2,3,4],'introduction and four projects reserve a dedicated model space');
  for(const [index,file] of [[1,'aegis.html'],[2,'gridium.html'],[3,'compressor-cbm.html'],[4,'topoflow.html']]) {
    await jump(page,index);
    const link=page.locator(`[data-scene-panel="${index}"] .primary-action`);
    assert.equal(new URL(await link.getAttribute('href'),base).pathname,`/${file}`,'primary action still links to the corresponding case study');
    await link.click();
    await page.waitForURL(url=>url.pathname===`/${file}`);
    assert.ok((await page.locator('h1').innerText()).trim(),'primary action opens a readable project report');
    await page.locator('.nav-back').click();
    await page.waitForFunction(()=>document.body.dataset.currentScene!==undefined);
    await expectScene(page,0,`${file} case study returns to the portfolio`);
  }
  checks.push('screenshot frames are absent while all four primary case-study actions work');
  await jump(page,5);
  assert.ok((await page.locator('.profile-practice').innerText()).trim(),'profile explains engineering skills and practice');
  const contact=page.locator('.contact-finale');
  assert.equal(await contact.count(),1,'portfolio ends with a direct contact invitation');
  const email=contact.locator('.contact-email');
  assert.equal(await email.getAttribute('href'),'mailto:shaunakrane914@gmail.com','contact invitation exposes the real email address');
  const profileLinks=await page.locator('[data-scene-panel="5"] a[href]').evaluateAll(links=>links.map(link=>link.getAttribute('href')));
  assert.ok(profileLinks.some(href=>href.includes('Shaunak_Rane_Resume.pdf')),'profile provides a direct resume link');
  assert.ok(profileLinks.some(href=>href.startsWith('https://github.com/Shaunakrane914')),'profile provides the real GitHub link');
  assert.ok(profileLinks.some(href=>href.startsWith('https://www.linkedin.com/in/shaunak-rane-3980582ba/')),'profile provides the real LinkedIn link');
  checks.push('engineering practice and contact ending expose real professional links');
  await page.context().grantPermissions(['clipboard-read','clipboard-write'],{origin:base});
  await page.locator('[data-copy-email]').click();
  await page.waitForFunction(()=>document.querySelector('[data-copy-status]').textContent.trim()==='Email copied.');
  assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),'shaunakrane914@gmail.com','copy action writes the contact email');
  checks.push('contact email copies successfully through the browser clipboard');
  await page.evaluate(()=>{
    window.__originalClipboardWrite=navigator.clipboard.writeText;
    navigator.clipboard.writeText=()=>Promise.reject(new DOMException('Clipboard denied for regression test','NotAllowedError'));
  });
  await page.locator('[data-copy-email]').click();
  await page.waitForFunction(()=>document.querySelector('[data-copy-status]').textContent.trim()==='Use the email link to get in touch.');
  assert.equal(await email.evaluate(link=>link===document.activeElement),true,'denied copy focuses the existing email link');
  assert.equal(await email.getAttribute('href'),'mailto:shaunakrane914@gmail.com','denied clipboard permission keeps contact available');
  await page.evaluate(()=>{navigator.clipboard.writeText=window.__originalClipboardWrite;delete window.__originalClipboardWrite;});
  checks.push('clipboard rejection gives an accessible email-link fallback');

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
  assert.equal(await graphics.locator('.model-tools, [data-model-explore], [data-model-point], [data-model-reset], [data-motion-toggle]').count(),0,'no model control panel or rotation/pause controls remain');
  await graphics.locator('canvas').evaluate(canvas=>{
    window.__canvasPointerEvents=[];
    for(const type of ['pointerdown','gotpointercapture']) canvas.addEventListener(type,event=>window.__canvasPointerEvents.push(event.type));
  });
  await graphics.mouse.move(1390,200);
  await graphics.mouse.down();
  await graphics.mouse.move(1405,300,{steps:8});
  await graphics.mouse.up();
  assert.deepEqual(await graphics.evaluate(()=>window.__canvasPointerEvents),[],'decorative model never receives pointerdown or captures a drag');
  assert.equal(await graphics.locator('canvas').evaluate(c=>getComputedStyle(c).pointerEvents),'none','dragging does not activate a model interaction mode');
  checks.push('automatic 3D remains decorative without model-control widgets or pointer capture');
  const decorativeScrollStart = await graphics.evaluate(()=>scrollY);
  await wheel(graphics,[120]);
  assert.ok(await graphics.evaluate(()=>scrollY)>decorativeScrollStart+80,'wheel keeps scrolling after dragging over the decorative backdrop');
  const decorativePrevented = await graphics.locator('canvas').evaluate(canvas=>{
    const event=new WheelEvent('wheel',{deltaY:12,bubbles:true,cancelable:true});
    canvas.dispatchEvent(event); return event.defaultPrevented;
  });
  assert.equal(decorativePrevented,false,'decorative 3D preserves native in-range wheel input');
  checks.push('automatic 3D preserves native in-range scrolling');
  for(let index=0;index<5;index++) {
    await jump(graphics,index);
    await graphics.waitForFunction(index=>window.__observatory.worldStatus[index]==='ready' && document.body.dataset.graphicsReady==='true',index,{timeout:30000});
    await graphics.waitForFunction(()=>getComputedStyle(document.querySelector('#observatory-canvas')).opacity==='1');
    await graphics.waitForTimeout(350);
    const surface=await graphics.locator(`[data-model-view="${index}"]`).evaluate(view=>{
      const style=getComputedStyle(view), rect=view.getBoundingClientRect();
      const canvas=document.querySelector('#observatory-canvas'), canvasStyle=getComputedStyle(canvas);
      return {
        background:style.backgroundColor,backgroundImage:style.backgroundImage,
        hasCover:!!view.querySelector('img,video,iframe,button,input,a[href],canvas:not(#observatory-canvas)'),
        ownsSharedCanvas:canvas.parentElement===view,
        sharedCanvasCount:document.querySelectorAll('#observatory-canvas').length,
        display:style.display,visibility:style.visibility,
        rect:{left:rect.left,top:rect.top,right:rect.right,bottom:rect.bottom,width:rect.width,height:rect.height},
        viewport:window.__observatory.getModelViewportRect(),
        projected:window.__observatory.getProjectedModelBounds(),
        canvasDisplay:canvasStyle.display,canvasVisibility:canvasStyle.visibility,canvasOpacity:canvasStyle.opacity
      };
    });
    assert.equal(surface.hasCover,false,'model space contains no image frame or interaction controls');
    assert.equal(surface.ownsSharedCanvas,true,'selected model space directly owns the shared rendering canvas');
    assert.equal(surface.sharedCanvasCount,1,'model changes reuse exactly one shared canvas');
    assert.equal(surface.background,'rgba(0, 0, 0, 0)','model space is transparent');
    assert.equal(surface.backgroundImage,'none','model space has no image or gradient cover');
    assert.notEqual(surface.display,'none','model space is rendered');
    assert.equal(surface.visibility,'visible','model space is visible');
    assert.ok(surface.rect.width>100 && surface.rect.height>100,'model space has useful dimensions');
    assert.ok(surface.viewport.width>100 && surface.viewport.height>100,'rendered model viewport has useful dimensions');
    assert.ok(surface.projected,'camera reports the selected model projection');
    assert.ok(surface.projected.left>=surface.viewport.left-2 && surface.projected.right<=surface.viewport.right+2 && surface.projected.top>=surface.viewport.top-2 && surface.projected.bottom<=surface.viewport.bottom+2,'camera keeps the complete model bounds inside its viewport');
    assert.ok(surface.projected.width>=surface.viewport.width*.1 && surface.projected.height>=surface.viewport.height*.1,'camera does not reduce the model to a tiny background detail');
    assert.notEqual(surface.canvasDisplay,'none','model canvas is rendered');
    assert.equal(surface.canvasVisibility,'visible','model canvas is visible');
    assert.equal(surface.canvasOpacity,'1','model canvas is revealed');
  }
  checks.push('all five model spaces stay transparent, visible, and free of screenshot frames or controls');
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
  const mounted = await graphics.evaluate(() => window.__observatory.worlds.map(world => Boolean(world.parent)));
  assert.deepEqual(mounted, [false,false,false,false,false,true], 'inactive worlds remain cached outside the rendered scene graph');
  checks.push('only the selected world participates in renderer traversal');
  await jump(graphics,0);
  await graphics.waitForTimeout(350);
  const drawStart = await graphics.evaluate(() => window.__perfTelemetry.getSnapshot().renderedFrames);
  await sendWheel(graphics,Array(12).fill(5));
  const duringSwipe = await graphics.evaluate(() => ({draws:window.__perfTelemetry.getSnapshot().renderedFrames,y:scrollY}));
  assert.ok(duringSwipe.y>40, 'native scrolling continues while decorative animation rests');
  assert.ok(duringSwipe.draws-drawStart>=5, 'autonomous animation continues during the active swipe without a hover');
  await graphics.waitForTimeout(200);
  assert.ok(await graphics.evaluate(() => window.__perfTelemetry.getSnapshot().renderedFrames)>duringSwipe.draws+1, 'animation resumes automatically after scrolling settles');
  checks.push('autonomous model animation continues during and after native swipes without a hover');
  await jump(graphics,0);
  await graphics.mouse.move(10,10);
  await sendWheel(graphics,[10000]);
  await graphics.waitForFunction(()=>+document.body.dataset.currentScene===1 && document.body.dataset.graphicsReady==='true');
  const tailStart = await graphics.evaluate(()=>window.__perfTelemetry.getSnapshot().renderedFrames);
  await sendWheel(graphics,[100,60,35,20,12,7,3,...Array(24).fill(3)]);
  assert.equal(await graphics.evaluate(()=>+document.body.dataset.currentScene),1,'bounded momentum retains its adjacent chapter');
  assert.ok(await graphics.evaluate(()=>window.__perfTelemetry.getSnapshot().renderedFrames)>tailStart+10,'bounded wheel momentum cannot freeze automatic model animation');
  checks.push('capped trackpad momentum keeps Aegis animated with the pointer parked in the header');
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
    if (file === 'aegis' || file === 'compressor-cbm') {
      await graphics.waitForFunction(()=>window.__heroTelemetry().running);
      await graphics.evaluate(()=>scrollBy(0,25));
      const moving = await graphics.evaluate(()=>window.__heroTelemetry().rendered);
      await sendWheel(graphics,Array(12).fill(3));
      assert.equal(await graphics.evaluate(()=>window.__heroTelemetry().running),true,`${file} keeps animation playback independent of scrolling`);
      assert.ok(await graphics.evaluate(()=>window.__heroTelemetry().rendered)>moving+5,`${file} keeps animating during scrolling without hover`);
      checks.push(`${file} keeps autonomous animation running during scrolling`);
    }
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
  assert.equal(await reduced.evaluate(()=>window.__perfTelemetry.getSnapshot().animationRunning),false,'homepage reduced motion stops continuous WebGL rendering');
  assert.equal(await reduced.locator('.project-visual, [class*="artifact-"]').count(),0,'reduced-motion browsing also contains no screenshot frames');
  assert.equal(await reduced.locator('[data-model-view="4"]').evaluate(view=>getComputedStyle(view).backgroundColor),'rgba(0, 0, 0, 0)','reduced-motion model remains uncovered');
  await reduced.locator('[data-model-view="4"]').evaluate(view=>view.scrollIntoView({block:'center',behavior:'instant'}));
  await settleScroll(reduced);
  await reduced.waitForFunction(()=>window.__observatory.getModelViewportRect()?.height>100);
  const reducedModel=await reduced.evaluate(()=>({viewport:window.__observatory.getModelViewportRect(),projected:window.__observatory.getProjectedModelBounds()}));
  assert.ok(reducedModel.projected.left>=reducedModel.viewport.left-2 && reducedModel.projected.right<=reducedModel.viewport.right+2 && reducedModel.projected.top>=reducedModel.viewport.top-2 && reducedModel.projected.bottom<=reducedModel.viewport.bottom+2,'reduced-motion camera preserves model framing after native scrolling to the mobile band');
  checks.push('homepage automatic models remain uncovered and static for reduced motion');
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
  await fs.writeFile('.audit/overhaul/interactions.json',JSON.stringify({checks,errors,wheelTraces,resourceCounts:{first,second}},null,2));
  console.log(`PASS: ${checks.length} interaction groups`,checks);
} finally { await browser.close(); await noGL.close(); server.close(); }
