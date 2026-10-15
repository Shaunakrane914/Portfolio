import fs from 'node:fs/promises';
import { getPlaywright } from './lib/playwright_loader.mjs';
// Labels organize evidence; PREVIEW_URL must point to the source being measured.
const label=process.argv[2] || 'after';
const out=`.audit/scroll-feel/${label}`;
await fs.mkdir(out,{recursive:true});
const {chromium}=await getPlaywright();
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-webgl','--ignore-gpu-blocklist']});
try {
 const page=await browser.newPage({viewport:{width:1768,height:1000}});
 await page.addInitScript(()=>{
   window.__feel={wheel:[],scroll:[],jumps:[],frames:[]};
   const original=window.scrollTo.bind(window);
   window.scrollTo=(...args)=>{
     window.__feel.jumps.push({at:performance.now(),from:scrollY,to:typeof args[0]==='object'?args[0].top:args[1]});
     return original(...args);
   };
   addEventListener('wheel',event=>window.__feel.wheel.push({at:performance.now(),y:scrollY,delta:event.deltaY}),{capture:true,passive:true});
   addEventListener('scroll',()=>window.__feel.scroll.push({at:performance.now(),y:scrollY}),{passive:true});
   let last;
   const frame=now=>{if(last)window.__feel.frames.push({at:now,ms:now-last});last=now;requestAnimationFrame(frame);};requestAnimationFrame(frame);
 });
 await page.goto(process.env.PREVIEW_URL || 'http://127.0.0.1:8089/');
 await page.waitForFunction(()=>document.body.dataset.graphicsReady==='true');
 await page.evaluate(()=>document.fonts.ready);
 await page.waitForTimeout(600);
 await page.screenshot({path:`${out}/origin.png`});
 const framing=await page.evaluate(()=>{
   const o=window.__observatory, w=o.worlds[0], points=[];
   w.updateWorldMatrix(true,true);o.camera.updateMatrixWorld();
   w.traverse(node=>{
     if(!node.geometry) return;
     if(!node.geometry.boundingBox)node.geometry.computeBoundingBox();
     const box=node.geometry.boundingBox;
     const project=matrix=>{for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z])points.push(new o.THREE.Vector3(x,y,z).applyMatrix4(matrix).project(o.camera));};
     if(node.isInstancedMesh)for(let i=0;i<node.count;i++){const m=new o.THREE.Matrix4();node.getMatrixAt(i,m);project(m.premultiply(node.matrixWorld));}
     else project(node.matrixWorld);
   });
   const r=document.querySelector('[data-model-view="0"]').getBoundingClientRect();
   const width=(Math.max(...points.map(p=>p.x))-Math.min(...points.map(p=>p.x)))*r.width/2;
   const height=(Math.max(...points.map(p=>p.y))-Math.min(...points.map(p=>p.y)))*r.height/2;
   return {slot:{width:r.width,height:r.height},model:{width,height},viewport:{width:innerWidth,height:innerHeight}};
 });
 await page.mouse.move(1500,400);
 const start=await page.evaluate(()=>performance.now());
 for(const delta of [70,100,120,140,160,130,90,65,40,25,14,8,4,2]) {await page.mouse.wheel(0,delta);await page.waitForTimeout(8);}
 await page.waitForTimeout(300);
 const result=await page.evaluate(start=>({start,...window.__feel,jumps:window.__feel.jumps.filter(j=>j.at>=start),frames:window.__feel.frames.filter(f=>f.at>=start),scene:+document.body.dataset.currentScene,scrollY}),start);
 result.framing=framing;
 await fs.writeFile(`${out}/trace.json`,JSON.stringify(result,null,2));
 console.log(JSON.stringify({framing,jumps:result.jumps,scene:result.scene,scrollY:result.scrollY}));
}finally{await browser.close();}
