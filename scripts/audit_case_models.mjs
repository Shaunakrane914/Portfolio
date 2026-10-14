import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import path from 'node:path';
import { getPlaywright } from './lib/playwright_loader.mjs';

const out=path.resolve('.audit/model-visibility/cases');
await fs.mkdir(out,{recursive:true});
const base=process.env.PREVIEW_URL || 'http://127.0.0.1:8089/';
const files=['aegis','gridium','compressor-cbm','topoflow','food','yield','sodexo'];
const desktop={width:1440,height:900}, mobile={width:390,height:844};
const { chromium }=await getPlaywright();
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-webgl','--ignore-gpu-blocklist']});
const results=[], errors=[];
const intersects=(a,b)=>a.left<b.right-1 && a.right>b.left+1 && a.top<b.bottom-1 && a.bottom>b.top+1;

async function measure(page,viewport) {
  await page.evaluate(()=>{scrollTo({top:0,behavior:'instant'});return document.fonts.ready;});
  await page.waitForFunction(()=>window.__heroTelemetry?.().ready,null,{timeout:30000});
  await page.waitForFunction(()=>getComputedStyle(document.querySelector('.project-hero-canvas')).opacity==='1');
  await page.waitForTimeout(350);
  const result=await page.evaluate(()=>{
    const serialize=element=>{
      const r=element.getBoundingClientRect();
      return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height};
    };
    const hero=document.querySelector('.proj-hero');
    const canvas=hero.querySelector('.project-hero-canvas'), canvasStyle=getComputedStyle(canvas);
    const metrics=hero.querySelector('.proj-hero-metrics'), metricStyle=getComputedStyle(metrics);
    const narrative=[...hero.querySelectorAll('.case-hero-copy,.case-eyebrow,.proj-hero-title,.proj-hero-sub,.proj-hero-metrics,.proj-hero-cta')]
      .filter(element=>getComputedStyle(element).display!=='none')
      .map(element=>({selector:element.className,rect:serialize(element)}));
    return {
      hero:serialize(hero),canvas:{...serialize(canvas),pointerEvents:canvasStyle.pointerEvents,opacity:canvasStyle.opacity,display:canvasStyle.display,visibility:canvasStyle.visibility},
      narrative,metrics:{background:metricStyle.backgroundColor,backgroundImage:metricStyle.backgroundImage,border:metricStyle.borderWidth,backdropFilter:metricStyle.backdropFilter},
      metricCards:[...metrics.querySelectorAll('.hm-card')].map(card=>({border:getComputedStyle(card).borderWidth,background:getComputedStyle(card).backgroundColor})),
      previewFrames:hero.querySelectorAll('.project-visual,[class*="artifact-"]').length,
      controlWidgets:hero.querySelectorAll('.model-tools,[data-model-explore],[data-model-point],[data-model-reset],[data-motion-toggle]').length,
      viewportOverflow:document.documentElement.scrollWidth>innerWidth+1,
      telemetry:window.__heroTelemetry()
    };
  });
  assert.equal(result.previewFrames,0,'hero contains no screenshot frame');
  assert.equal(result.controlWidgets,0,'hero contains no model control panel');
  assert.equal(result.viewportOverflow,false,'case page has no horizontal overflow');
  assert.equal(result.telemetry.ready,true,'hero renderer has completed preparation');
  assert.ok(result.telemetry.calls>0 && result.telemetry.rendered>0,'hero draws model geometry');
  assert.equal(result.canvas.pointerEvents,'none','model leaves page input alone');
  assert.equal(result.canvas.opacity,'1','model canvas is fully revealed');
  assert.equal(result.canvas.visibility,'visible','model canvas is visible');
  assert.notEqual(result.canvas.display,'none','model canvas is displayed');
  assert.ok(result.canvas.width>100 && result.canvas.height>100,'model canvas has a useful visible area');
  assert.ok(result.canvas.left>=-1 && result.canvas.right<=viewport.width+1,'model canvas fits horizontally');
  assert.equal(result.metrics.background,'rgba(0, 0, 0, 0)','metrics do not use an opaque panel');
  assert.equal(result.metrics.backgroundImage,'none','metrics do not add a background image');
  assert.equal(result.metrics.border,'0px','metrics do not use a card border');
  assert.equal(result.metrics.backdropFilter,'none','metrics do not blur the model');
  for(const card of result.metricCards) assert.equal(card.border,'0px','metric cards do not add divider borders');
  for(const item of result.narrative) {
    assert.ok(item.rect.width>0 && item.rect.height>0,`${item.selector} remains readable`);
    assert.equal(intersects(item.rect,result.canvas),false,`${item.selector} stays outside the model area`);
  }
  if(viewport.width<=820) assert.equal(Math.round(result.canvas.height),250,'mobile model retains its dedicated 250px band');
  return result;
}

try {
  for(const viewport of [desktop,mobile]) {
    for(const file of files) {
      const page=await browser.newPage({viewport,hasTouch:viewport.width<=820,isMobile:viewport.width<=820});
      page.on('pageerror',error=>errors.push(`${file}: ${String(error)}`));
      page.on('console',message=>{if(message.type()==='error') errors.push(`${file}: ${message.text()}`);});
      await page.goto(new URL(`${file}.html`,base).href);
      const initial=await measure(page,viewport);
      await page.locator('.proj-hero').screenshot({path:path.join(out,`${viewport.width}x${viewport.height}-${file}.png`),animations:'disabled'});
      const alternate=viewport.width===desktop.width ? mobile : desktop;
      await page.setViewportSize(alternate);
      const resized=await measure(page,alternate);
      await page.setViewportSize(viewport);
      const restored=await measure(page,viewport);
      assert.equal(restored.telemetry.geometries,initial.telemetry.geometries,'resize roundtrip preserves geometry resources');
      assert.equal(restored.telemetry.textures,initial.telemetry.textures,'resize roundtrip preserves texture resources');
      assert.deepEqual({width:restored.canvas.width,height:restored.canvas.height},{width:initial.canvas.width,height:initial.canvas.height},'resize roundtrip restores canvas layout');
      results.push({file,viewport,initial,alternate,resized,restored});
      console.log(`PASS: ${file} ${viewport.width}x${viewport.height} model separation and resize roundtrip`);
      await page.close();
    }
  }
  assert.deepEqual(errors,[],'case hero runtime and console errors');
  await fs.writeFile(path.join(out,'cases.json'),JSON.stringify({results,errors},null,2));
  console.log(`PASS: ${results.length} case hero views, ${results.length} resize roundtrips`);
} finally {await browser.close();}
