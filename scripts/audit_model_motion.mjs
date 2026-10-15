// Animation must progress with the pointer parked in the header, including
// after scrolling, and on touch hardware that has no hover interaction.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {getPlaywright} from './lib/playwright_loader.mjs';
const {chromium}=await getPlaywright();
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-webgl','--ignore-gpu-blocklist']});
const base=process.env.PREVIEW_URL || 'http://127.0.0.1:8089';
const homeOnly=process.argv.includes('--home-only');
const results=[],errors=[];
const touchSessions=new WeakMap();
async function sample(page,home){
  const state=await page.evaluate(home=>home?{
    ...window.__perfTelemetry.getSnapshot(),
    rotation:window.__observatory.worlds[+document.body.dataset.currentScene].rotation.toArray()
  }:window.__heroTelemetry(),home);
  const selector=home?'#observatory-canvas':'.project-hero-canvas';
  const clip=await page.locator(selector).evaluate(c=>{const r=c.getBoundingClientRect();return{x:Math.max(0,r.left),y:Math.max(0,r.top),width:Math.min(innerWidth,r.right)-Math.max(0,r.left),height:Math.min(innerHeight,r.bottom)-Math.max(0,r.top)};});
  const png=await page.screenshot({clip});
  return {frames:home?state.renderedFrames:state.rendered,hash:createHash('sha256').update(png).digest('hex'),state};
}
async function moving(page,home,label){
  const before=await sample(page,home);
  await page.waitForTimeout(650);
  const after=await sample(page,home);
  assert.ok(after.frames>before.frames+5,`${label}: animation renders without hover`);
  assert.notEqual(after.hash,before.hash,`${label}: visible model moves without hover`);
  if(home) assert.notDeepEqual(after.state.rotation,before.state.rotation,`${label}: the model itself drifts without pointer input`);
  results.push({label,frames:after.frames-before.frames,visibleChange:after.hash!==before.hash});
}
async function movingWhileScrolling(page,home,label,touch){
  const before=await sample(page,home);
  // Screenshot encoding can outlast the input budget. Read the frame counter
  // immediately around input, excluding time spent taking the screenshots.
  const start=await page.evaluate(home=>home?window.__perfTelemetry.getSnapshot().renderedFrames:window.__heroTelemetry().rendered,home);
  if(touch){
    let session=touchSessions.get(page);
    if(!session){session=await page.context().newCDPSession(page);touchSessions.set(page,session);}
    await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:400,y:650}]});
    for(let i=1;i<=24;i++){
      await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:400,y:650-i*3}]});
      await page.waitForTimeout(16);
    }
    await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  }else for(let i=0;i<24;i++){await page.mouse.wheel(0,3);await page.waitForTimeout(16);}
  const end=await page.evaluate(home=>home?window.__perfTelemetry.getSnapshot().renderedFrames:window.__heroTelemetry().rendered,home);
  const after=await sample(page,home);
  assert.ok(end>start+5,`${label}: animation continues throughout the swipe`);
  assert.notEqual(after.hash,before.hash,`${label}: model changes visibly during scrolling`);
  results.push({label,frames:end-start,visibleChange:after.hash!==before.hash});
}
try {
  for(const touch of [false,true]){
    const page=await browser.newPage({viewport:{width:1440,height:900},hasTouch:touch});
    page.on('pageerror',e=>errors.push(String(e)));
    await page.goto(base+'/');
    await page.mouse.move(10,10);
    for(let index=0;index<5;index++){
      await page.evaluate(i=>document.querySelector(`.scene-rail [data-scene-jump="${i}"]`).click(),index);
      await page.waitForFunction(i=>window.__observatory.worldStatus[i]==='ready' && document.body.dataset.graphicsReady==='true',index);
      await page.waitForTimeout(400);
      await moving(page,true,`${touch?'touch':'desktop'} homepage ${index} idle`);
      await movingWhileScrolling(page,true,`${touch?'touch':'desktop'} homepage ${index} during scroll`,touch);
      await page.mouse.wheel(0,25);
      // No subsequent pointer event may be required to wake animation.
      await page.waitForTimeout(250);
      await moving(page,true,`${touch?'touch':'desktop'} homepage ${index} after scroll`);
    }
    for(const route of (homeOnly?[]:['aegis','gridium','compressor-cbm','topoflow','food','yield','sodexo'])){
      await page.goto(`${base}/${route}.html`);
      await page.waitForFunction(()=>window.__heroTelemetry?.().ready);
      await page.waitForTimeout(300);
      await moving(page,false,`${touch?'touch':'desktop'} ${route} idle`);
      await movingWhileScrolling(page,false,`${touch?'touch':'desktop'} ${route} during scroll`,touch);
      await page.mouse.wheel(0,25);
      await page.waitForTimeout(250);
      await moving(page,false,`${touch?'touch':'desktop'} ${route} after scroll`);
    }
    await page.close();
  }
  assert.deepEqual(errors,[]);
  await fs.mkdir('.audit/model-motion',{recursive:true});
  await fs.writeFile('.audit/model-motion/results.json',JSON.stringify({date:new Date().toISOString(),browser:browser.version(),scope:homeOnly?'homepage':'homepage and case studies',results,errors},null,2));
  console.log(`PASS: ${results.length} visible motion checks without model hover, zero runtime errors`);
}finally{await browser.close();}
