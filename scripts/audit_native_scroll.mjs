// Focused hardware capture for document scrolling and the bounded camera arrival.
// Requires the local preview (PREVIEW_URL overrides the default).
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { getPlaywright } from './lib/playwright_loader.mjs';

const { chromium } = await getPlaywright();
const browser = await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-webgl','--ignore-gpu-blocklist']});
const errors = [];
try {
  const page = await browser.newPage({viewport:{width:1440,height:900}});
  page.on('pageerror',error=>errors.push(String(error)));
  await page.addInitScript(() => {
    window.__scrollAudit = {frames:[],tasks:[],events:[],scenes:[]};
    addEventListener('DOMContentLoaded',()=>new MutationObserver(()=>window.__scrollAudit.scenes.push({at:performance.now(),scene:+document.body.dataset.currentScene})).observe(document.body,{attributes:true,attributeFilter:['data-current-scene']}));
    new PerformanceObserver(list=>window.__scrollAudit.tasks.push(...list.getEntries().map(t=>({at:t.startTime,ms:t.duration})))).observe({type:'longtask',buffered:true});
    let last;
    const frame=now=>{if(last) window.__scrollAudit.frames.push({at:now,ms:now-last});last=now;requestAnimationFrame(frame);};
    requestAnimationFrame(frame);
    window.addEventListener('wheel',event=>{
      const at=performance.now(), delta=event.deltaY;
      // This observer is installed before application listeners. Read the final
      // cancellation state after all listeners, rather than an early snapshot.
      setTimeout(()=>window.__scrollAudit.events.push({at,delta,prevented:event.defaultPrevented}),0);
    },{passive:true});
  });
  await page.goto(process.env.PREVIEW_URL || 'http://127.0.0.1:8089/');
  await page.waitForFunction(()=>document.body.dataset.graphicsReady==='true');
  const gpu = await page.evaluate(()=>{
    const gl=document.querySelector('canvas').getContext('webgl2'), e=gl.getExtension('WEBGL_debug_renderer_info');
    return e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : null;
  });
  const windows=[];
  const gesture=[350,300,240,180,140,100,70,45,25,14,7,3];
  for(const traversal of ['first','warm']) {
    await page.evaluate(()=>document.querySelector('.scene-rail [data-scene-jump="0"]').click());
    await page.waitForTimeout(500);
    const start=await page.evaluate(()=>performance.now());
    await page.mouse.move(1300,400);
    for(const sign of [1,-1]) for(let chapter=0;chapter<5;chapter++) {
      const before=await page.evaluate(()=>+document.body.dataset.currentScene);
      for(const delta of gesture) {
        await page.mouse.wheel(0,sign*delta);
        await page.waitForTimeout(30);
      }
      await page.waitForTimeout(200);
      assert.equal(await page.evaluate(()=>+document.body.dataset.currentScene),before+sign,'one complete swipe reaches exactly one adjacent chapter');
    }
    await page.waitForTimeout(300);
    const sample=await page.evaluate(start=>{
      const frames=window.__scrollAudit.frames.filter(f=>f.at>=start).map(f=>f.ms).sort((a,b)=>a-b);
      const events=window.__scrollAudit.events.filter(e=>e.at>=start);
      return {frames:frames.length,fps:1000/(frames.reduce((a,b)=>a+b,0)/frames.length),p95:frames[Math.floor(frames.length*.95)],p99:frames[Math.floor(frames.length*.99)],max:frames.at(-1),longTasks:window.__scrollAudit.tasks.filter(t=>t.at>=start),wheelEvents:events.length,cancelledWheelEvents:events.filter(e=>e.prevented).length,visitedScenes:[...new Set(window.__scrollAudit.scenes.filter(s=>s.at>=start).map(s=>s.scene))].sort(),finalScrollY:scrollY,telemetry:window.__perfTelemetry.getSnapshot()};
    },start);
    assert.ok(sample.cancelledWheelEvents>0,'overshooting momentum is bounded');
    assert.deepEqual(sample.visitedScenes,[0,1,2,3,4,5],'scroll traversal visits every chapter');
    windows.push({traversal,...sample});
  }
  await page.evaluate(()=>document.querySelector('.scene-rail [data-scene-jump="3"]').click());
  await page.waitForFunction(()=>document.body.dataset.graphicsReady==='true');
  await page.waitForTimeout(350);
  const cameraError=await page.evaluate(()=>{
    const o=window.__observatory;
    const position=o.cameraStates[3].position;
    // Pointer parallax is deliberately bounded to 0.2/0.14 world units.
    return o.camera.position.distanceTo(new o.THREE.Vector3(...position));
  });
  assert.ok(cameraError<.3,'camera arrival settles within 350ms on a ready world');
  assert.deepEqual(errors,[]);
  const result={date:new Date().toISOString(),browser:browser.version(),gpu,viewport:{width:1440,height:900},gesture,gestureIntervalMs:30,gestureQuietMs:200,windows,cameraErrorAfter350ms:cameraError,errors};
  const directory=process.env.SCROLL_AUDIT_DIR || '.audit/native-scroll';
  await fs.mkdir(directory,{recursive:true});
  await fs.writeFile(`${directory}/performance.json`,JSON.stringify(result,null,2));
  console.log(JSON.stringify(result,null,2));
} finally { await browser.close(); }
