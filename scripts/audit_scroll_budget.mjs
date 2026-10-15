// Scroll/input budgets on the local Chrome GPU, including a slower CPU profile.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { getPlaywright } from './lib/playwright_loader.mjs';
const label=process.argv[2] || 'after';
const directory=`.audit/scroll-budget/${label}`;
await fs.mkdir(directory,{recursive:true});
const {chromium}=await getPlaywright();
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-webgl','--ignore-gpu-blocklist']});
try {
  const results=[];
  for(const rate of [1,4]) {
    const page=await browser.newPage({viewport:{width:1440,height:900}});
    const errors=[];
    page.on('pageerror',e=>errors.push(String(e)));
    await page.addInitScript(()=>{
      window.__budget={frames:[],tasks:[]};
      new PerformanceObserver(list=>window.__budget.tasks.push(...list.getEntries().map(e=>({at:e.startTime,ms:e.duration})))).observe({type:'longtask',buffered:true});
      let previous;
      function frame(at){if(previous)window.__budget.frames.push({at,ms:at-previous});previous=at;requestAnimationFrame(frame);}
      requestAnimationFrame(frame);
    });
    const cdp=await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate',{rate});
    await cdp.send('Performance.enable');
    await page.goto(process.env.PREVIEW_URL || 'http://127.0.0.1:8089/');
    await page.waitForFunction(()=>document.body.dataset.graphicsReady==='true');
    await page.mouse.move(1300,400);
    const events=[];
    cdp.on('Tracing.dataCollected',e=>events.push(...e.value));
    await cdp.send('Tracing.start',{categories:'devtools.timeline,disabled-by-default-devtools.timeline',options:'record-as-much-as-possible'});
    await cdp.send('Profiler.enable');
    await cdp.send('Profiler.start');
    const start=await page.evaluate(()=>performance.now());
    const before=(await cdp.send('Performance.getMetrics')).metrics;
    const gesture=[220,200,170,145,110,80,55,35,20,12,6,3];
    for(const sign of [1,-1]) for(let i=0;i<5;i++) {
      for(const delta of gesture){await page.mouse.wheel(0,sign*delta);await page.waitForTimeout(12);}
      await page.waitForTimeout(200);
    }
    await page.waitForTimeout(200);
    const after=(await cdp.send('Performance.getMetrics')).metrics;
    const {profile}=await cdp.send('Profiler.stop');
    const ended=new Promise(resolve=>cdp.once('Tracing.tracingComplete',resolve));
    await cdp.send('Tracing.end');await ended;
    const observed=await page.evaluate(start=>{
      const frames=window.__budget.frames.filter(f=>f.at>=start).map(f=>f.ms).sort((a,b)=>a-b);
      return {duration:performance.now()-start,frames:{count:frames.length,p95:frames[Math.floor(frames.length*.95)],p99:frames[Math.floor(frames.length*.99)],max:frames.at(-1)},longTasks:window.__budget.tasks.filter(e=>e.at>=start),telemetry:window.__perfTelemetry.getSnapshot(),builds:window.__observatory.worlds.map(w=>w?.userData.buildDuration || 0)};
    },start);
    const totals={};
    for(const e of events) if(e.ph==='X' && e.dur && ['EventDispatch','FireAnimationFrame','Layout','UpdateLayoutTree','Paint','FunctionCall'].includes(e.name)) {
      const name=e.name==='EventDispatch'?`${e.name}:${e.args?.data?.type}`:e.name;
      const entry=totals[name] ||= {count:0,ms:0,max:0};entry.count++;entry.ms+=e.dur/1000;entry.max=Math.max(entry.max,e.dur/1000);
    }
    const nodes=new Map(profile.nodes.map(n=>[n.id,n.callFrame]));
    const samples={};
    for(const id of profile.samples || []){const frame=nodes.get(id);const key=`${frame.functionName || '(anonymous)'} ${frame.url?.split('/').at(-1) || ''}:${frame.lineNumber+1}`;samples[key]=(samples[key]||0)+1;}
    const metrics=Object.fromEntries(after.filter(m=>/Duration$/.test(m.name)).map(m=>[m.name,m.value-(before.find(b=>b.name===m.name)?.value || 0)]));
    assert.deepEqual(errors,[]);
    results.push({rate,...observed,totals,metrics,hotspots:Object.entries(samples).sort((a,b)=>b[1]-a[1]).slice(0,25),errors});
    await fs.writeFile(`${directory}/trace-${rate}.json`,JSON.stringify(events));
    await page.close();
  }
  const result={date:new Date().toISOString(),browser:browser.version(),results};
  await fs.writeFile(`${directory}/performance.json`,JSON.stringify(result,null,2));
  console.log(JSON.stringify(result,null,2));
}finally{await browser.close();}
