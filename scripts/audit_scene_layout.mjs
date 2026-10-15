import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import path from 'node:path';
import { getPlaywright } from './lib/playwright_loader.mjs';
const label = process.argv[2] || 'after';
const out = path.resolve('.audit/model-visibility', label);
await fs.mkdir(out,{recursive:true});
const { chromium } = await getPlaywright();
const browser = await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-webgl','--ignore-gpu-blocklist']});
const results = [];
const errors = [];
const intersects = (a,b) => a.left < b.right-1 && a.right > b.left+1 && a.top < b.bottom-1 && a.bottom > b.top+1;
try {
  for (const viewport of [{width:1440,height:900},{width:1280,height:720},{width:1024,height:600},{width:390,height:844},{width:844,height:390}]) {
    const page = await browser.newPage({viewport,hasTouch:viewport.width<900,isMobile:viewport.width<900});
    page.on('pageerror',e=>errors.push(String(e)));
    await page.goto(process.env.PREVIEW_URL || 'http://127.0.0.1:8089/');
    await page.evaluate(()=>document.fonts.ready);
    const chapterHeights = await page.locator('[data-scene-panel]').evaluateAll(panels=>panels.map(panel=>panel.clientHeight));
    assert.equal(chapterHeights.length,6,'all six editorial chapters are present');
    if(label==='after') {
      assert.equal(await page.locator('.model-tools, [data-model-explore], [data-model-point], [data-model-reset], [data-motion-toggle]').count(),0,'model control widgets are absent');
      assert.equal(await page.locator('.project-visual, [class*="artifact-"]').count(),0,'project screenshot frames are absent');
      assert.deepEqual(await page.locator('[data-model-view]').evaluateAll(views=>views.map(view=>+view.dataset.modelView)),[0,1,2,3,4],'five chapters reserve model space');
    }
    for (let i=0;i<6;i++) {
      await page.evaluate(i=>document.querySelector(`[data-scene-jump="${i}"]`).click(),i);
      await page.waitForFunction(i=>window.__observatory?.worldStatus[i]==='ready' && document.body.dataset.graphicsReady==='true',i,{timeout:30000});
      await page.waitForTimeout(450);
      const navigation=await page.locator(`[data-scene-panel="${i}"]`).evaluate(panel=>{
        const copy=panel.querySelector('.scene-copy');
        const narrative=panel.querySelector('.project-intro') || (getComputedStyle(copy).display==='contents' ? copy.firstElementChild : copy);
        return {chapterTop:panel.getBoundingClientRect().top,narrativeTop:narrative.getBoundingClientRect().top,headerBottom:document.querySelector('.observatory-header').getBoundingClientRect().bottom};
      });
      await page.screenshot({path:path.join(out,`${viewport.width}x${viewport.height}-scene-${i}.png`),animations:'disabled'});
      const modelView=page.locator(`[data-scene-panel="${i}"] [data-model-view]`);
      if(viewport.width<=820 && await modelView.count()) {
        await modelView.evaluate(view=>view.scrollIntoView({block:'center',behavior:'instant'}));
        await page.waitForTimeout(450);
      }
      const result = await page.evaluate(() => {
        const serialize = element => {
          if(!element) return null;
          const r=element.getBoundingClientRect();
          return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,width:r.width,height:r.height};
        };
        const p=document.querySelector('.scene-panel.is-active'), style=getComputedStyle(p);
        const model=p.querySelector('[data-model-view]'), modelStyle=model && getComputedStyle(model);
        const canvas=document.querySelector('#observatory-canvas'), canvasStyle=getComputedStyle(canvas);
        const copy=p.querySelector('.scene-copy');
        const narrative=[...p.querySelectorAll('.project-intro,.project-details')];
        if(!narrative.length) narrative.push(copy);
        const viewport=window.__observatory?.getModelViewportRect?.() || null;
        const header=document.querySelector('.observatory-header').getBoundingClientRect();
        return {scene:+document.body.dataset.currentScene,scrollY,panelWidth:p.clientWidth,panelHeight:p.clientHeight,contentHeight:p.scrollHeight,
          chapterHeights:[...document.querySelectorAll('[data-scene-panel]')].map(panel=>panel.clientHeight),
          accessible:[...document.querySelectorAll('[data-scene-panel]')].every(panel=>!panel.inert && panel.getAttribute('aria-hidden')!=='true'),
          horizontalOverflow:p.scrollWidth>p.clientWidth+1,verticalOverflow:p.scrollHeight>p.clientHeight+2,overflowY:style.overflowY,
          scrollbars:style.scrollbarWidth,border:style.borderWidth,rect:serialize(p),copy:serialize(copy),narrative:narrative.map(serialize),
          model:model ? {rect:serialize(model),viewport,projected:window.__observatory?.getProjectedModelBounds?.() || null,index:+model.dataset.modelView,
            background:modelStyle.backgroundColor,backgroundImage:modelStyle.backgroundImage,display:modelStyle.display,visibility:modelStyle.visibility,
            hasCover:!!model.querySelector('img,video,iframe,button,input,a[href],canvas:not(#observatory-canvas)')} : null,
          headerBottom:header.bottom,canvas:{pointerEvents:canvasStyle.pointerEvents,display:canvasStyle.display,visibility:canvasStyle.visibility,opacity:canvasStyle.opacity,
            position:canvasStyle.position,rect:serialize(canvas),parentModelIndex:canvas.parentElement?.hasAttribute('data-model-view') ? +canvas.parentElement.dataset.modelView : null},
          graphicsReady:document.body.dataset.graphicsReady,
          viewportOverflow:document.documentElement.scrollWidth>innerWidth};
      });
      results.push({viewport,navigation,...result});
      if(await modelView.count()) await page.screenshot({path:path.join(out,`${viewport.width}x${viewport.height}-scene-${i}-model.png`),animations:'disabled'});
      if (label==='after') {
        assert.equal(result.horizontalOverflow,false,'panel horizontal overflow');
        assert.equal(result.viewportOverflow,false,'viewport horizontal overflow');
        assert.equal(result.border,'0px','panel card border removed');
        assert.equal(result.verticalOverflow,false,'no nested vertical scroller');
        assert.equal(result.overflowY,'visible','content remains in document flow');
        assert.ok(navigation.chapterTop >= -1 && navigation.chapterTop < 2,'explicit navigation aligns the selected chapter');
        assert.ok(navigation.narrativeTop >= navigation.headerBottom-1,'content clears the fixed header after navigation');
        assert.equal(result.accessible,true,'all chapters remain accessible');
        assert.equal(result.canvas.pointerEvents,'none','3D leaves native browsing alone');
        assert.equal(result.graphicsReady,'true','selected world has finished preparation');
        assert.equal(result.canvas.visibility,'visible','canvas is visible');
        assert.equal(result.canvas.opacity,'1','canvas is revealed');
        assert.deepEqual(result.chapterHeights,chapterHeights,'active scene changes do not shift chapter heights');
        if(i<5) {
          const model=result.model;
          assert.ok(model,'chapter reserves model space');
          assert.equal(model.index,i,'model space belongs to the selected chapter');
          assert.equal(result.canvas.parentModelIndex,i,'shared canvas belongs to the selected model space');
          assert.equal(result.canvas.position,'absolute','canvas moves with its model space in document flow');
          for(const edge of ['left','right','top','bottom']) assert.ok(Math.abs(result.canvas.rect[edge]-model.rect[edge])<=1,`canvas ${edge} aligns with its model space`);
          assert.equal(model.hasCover,false,'model space has no screenshot, link, or control covering it');
          assert.equal(model.background,'rgba(0, 0, 0, 0)','model space is transparent');
          assert.equal(model.backgroundImage,'none','model space has no image or gradient cover');
          assert.notEqual(model.display,'none','model space is rendered');
          assert.equal(model.visibility,'visible','model space is visible');
          assert.ok(model.rect.width>100 && model.rect.height>100,'model space has useful dimensions');
          assert.ok(model.viewport,'renderer reports its model viewport');
          const area=model.viewport;
          assert.ok(area.width>100 && area.height>100,'rendered model viewport has useful dimensions');
          assert.ok(area.left>=-1 && area.right<=viewport.width+1,'rendered model fits the viewport horizontally');
          assert.ok(area.top>=result.headerBottom-1 && area.bottom<=viewport.height+1,'model viewport clears header and remains on screen');
          assert.ok(area.left>=model.rect.left-1 && area.right<=model.rect.right+1 && area.top>=model.rect.top-1 && area.bottom<=model.rect.bottom+1,'renderer keeps the model in its reserved space');
          const projected=model.projected;
          assert.ok(projected,'renderer reports fitted model bounds');
          assert.ok(projected.left>=area.left-2 && projected.right<=area.right+2 && projected.top>=area.top-2 && projected.bottom<=area.bottom+2,'complete projected model remains inside its viewport');
          const occupancy=Math.max(projected.width/model.rect.width,projected.height/model.rect.height);
          assert.ok(occupancy>=.7,`model fills at least 70% of its space along its dominant dimension (actual ${(occupancy*100).toFixed(1)}%)`);
          for(const narrative of result.narrative) assert.equal(intersects(area,narrative),false,'model viewport does not overlap narrative');
          if(viewport.width>820) assert.equal(intersects(area,result.copy),false,'desktop model has a clear column beside the copy');
        } else assert.equal(result.model,null,'profile has no redundant model frame');
      }
    }
    await page.evaluate(()=>window.scrollTo({top:document.documentElement.scrollHeight,behavior:'instant'}));
    await page.waitForTimeout(100);
    await page.screenshot({path:path.join(out,`${viewport.width}x${viewport.height}-contact.png`),animations:'disabled'});
    await page.locator('.contact-finale').screenshot({path:path.join(out,`${viewport.width}x${viewport.height}-contact-detail.png`),animations:'disabled'});
    await page.close();
  }
  assert.deepEqual(errors,[]);
  await fs.writeFile(path.join(out,'layout.json'),JSON.stringify({results,errors},null,2));
  console.log(label, 'layout:',results.map(r=>`${r.viewport.width}x${r.viewport.height} / ${r.scene}: overflow X=${r.horizontalOverflow}, Y=${r.verticalOverflow}`).join('\n'));
} finally {await browser.close();}
