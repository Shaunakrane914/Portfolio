import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import path from 'node:path';
import { getPlaywright } from './lib/playwright_loader.mjs';
const label = process.argv[2] || 'after';
const out = path.resolve('.audit/native-scroll', label);
await fs.mkdir(out,{recursive:true});
const { chromium } = await getPlaywright();
const browser = await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-webgl','--ignore-gpu-blocklist']});
const results = [];
const explorers = [];
const errors = [];
try {
  for (const viewport of [{width:1440,height:900},{width:1280,height:720},{width:1024,height:600},{width:390,height:844},{width:844,height:390}]) {
    const page = await browser.newPage({viewport,hasTouch:viewport.width<900,isMobile:viewport.width<900});
    page.on('pageerror',e=>errors.push(String(e)));
    await page.goto(process.env.PREVIEW_URL || 'http://127.0.0.1:8089/');
    for (let i=0;i<6;i++) {
      await page.evaluate(i=>document.querySelector(`[data-scene-jump="${i}"]`).click(),i);
      await page.waitForFunction(i=>window.__observatory?.worldStatus[i]==='ready' && document.body.dataset.graphicsReady==='true',i,{timeout:30000});
      await page.waitForTimeout(450);
      const result = await page.evaluate(() => {
        const p=document.querySelector('.scene-panel.is-active'), style=getComputedStyle(p);
        const rect=p.getBoundingClientRect();
        const copy=p.querySelector('.scene-copy').getBoundingClientRect();
        return {scene:+document.body.dataset.currentScene,scrollY,panelWidth:p.clientWidth,panelHeight:p.clientHeight,contentHeight:p.scrollHeight,horizontalOverflow:p.scrollWidth>p.clientWidth+1,verticalOverflow:p.scrollHeight>p.clientHeight+2,overflowY:style.overflowY,scrollbars:style.scrollbarWidth,border:style.borderWidth,rect:{top:rect.top,bottom:rect.bottom},copy:{top:copy.top,bottom:copy.bottom,width:copy.width},viewportOverflow:document.documentElement.scrollWidth>innerWidth};
      });
      results.push({viewport,...result});
      await page.screenshot({path:path.join(out,`${viewport.width}x${viewport.height}-scene-${i}.png`),animations:'disabled'});
      if (label==='after') {
        assert.equal(result.horizontalOverflow,false,'panel horizontal overflow');
        assert.equal(result.viewportOverflow,false,'viewport horizontal overflow');
        assert.equal(result.scrollbars,'none','panel scrollbar hidden');
        assert.equal(result.border,'0px','panel card border removed');
        assert.equal(result.verticalOverflow,false,'no nested vertical scroller');
        assert.equal(result.overflowY,'visible','content remains in document flow');
        assert.ok(result.rect.top >= -1 && result.rect.top < 2,'explicit navigation aligns the selected chapter');
        assert.ok(result.copy.top >= (viewport.width <= 820 ? 56 : 72),'content clears the fixed header');
      }
    }
    await page.evaluate(()=>document.querySelector('.scene-rail [data-scene-jump="1"]').click());
    await page.waitForFunction(()=>document.body.dataset.graphicsReady==='true');
    await page.locator('[data-model-explore]').click();
    const explorer = await page.evaluate(()=>{
      const tools=document.querySelector('.model-tools').getBoundingClientRect();
      const toolbar=document.querySelector('.model-toolbar').getBoundingClientRect();
      const panel=document.querySelector('.model-explorer').getBoundingClientRect();
      const header=document.querySelector('.observatory-header').getBoundingClientRect();
      return {top:tools.top,bottom:tools.bottom,toolbarTop:toolbar.top,panelTop:panel.top,panelBottom:panel.bottom,headerBottom:header.bottom,viewportHeight:innerHeight};
    });
    explorers.push({viewport,...explorer});
    if(label==='after') {
      assert.ok(explorer.toolbarTop>=explorer.headerBottom,'explorer controls clear the header');
      assert.ok(explorer.bottom<=viewport.height-(viewport.width<=820?68:52),'expanded explorer fits above footer navigation');
      assert.ok(explorer.panelTop>=explorer.headerBottom,'subsystem controls clear the header');
      assert.ok(explorer.panelBottom<=viewport.height-(viewport.width<=820?68:52),'subsystem panel clears footer navigation');
    }
    await page.screenshot({path:path.join(out,`${viewport.width}x${viewport.height}-explorer.png`),animations:'disabled'});
    await page.close();
  }
  assert.deepEqual(errors,[]);
  await fs.writeFile(path.join(out,'layout.json'),JSON.stringify({results,explorers,errors},null,2));
  console.log(label, 'layout:',results.map(r=>`${r.viewport.width}x${r.viewport.height} / ${r.scene}: overflow X=${r.horizontalOverflow}, Y=${r.verticalOverflow}`).join('\n'));
} finally {await browser.close();}
