import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import path from 'node:path';
import { getPlaywright } from './lib/playwright_loader.mjs';
const label = process.argv[2] || 'after';
const out = path.resolve('.audit/editorial-design', label);
await fs.mkdir(out,{recursive:true});
const { chromium } = await getPlaywright();
const browser = await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-webgl','--ignore-gpu-blocklist']});
const results = [];
const errors = [];
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
      assert.equal(await page.locator('.project-visual').count(),4,'four project previews are present');
    }
    for (let i=0;i<6;i++) {
      await page.evaluate(i=>document.querySelector(`[data-scene-jump="${i}"]`).click(),i);
      await page.waitForFunction(i=>window.__observatory?.worldStatus[i]==='ready' && document.body.dataset.graphicsReady==='true',i,{timeout:30000});
      if(await page.locator(`[data-scene-panel="${i}"] .project-visual img`).count()) {
        await page.locator(`[data-scene-panel="${i}"] .project-visual img`).evaluate(image=>image.decode());
      }
      await page.waitForTimeout(450);
      const result = await page.evaluate(() => {
        const p=document.querySelector('.scene-panel.is-active'), style=getComputedStyle(p);
        const rect=p.getBoundingClientRect();
        const copy=(p.querySelector('.project-intro') || p.querySelector('.scene-copy')).getBoundingClientRect();
        const visual=p.querySelector('.project-visual');
        let preview=null;
        if(visual) {
          const r=visual.getBoundingClientRect(), image=visual.querySelector('img'), link=visual.querySelector('a[href]');
          preview={top:r.top,bottom:r.bottom,left:r.left,right:r.right,width:r.width,height:r.height,
            href:link?.getAttribute('href'),naturalWidth:image?.naturalWidth,naturalHeight:image?.naturalHeight,
            declaredWidth:+image?.getAttribute('width'),declaredHeight:+image?.getAttribute('height'),alt:image?.alt};
        }
        const header=document.querySelector('.observatory-header').getBoundingClientRect();
        return {scene:+document.body.dataset.currentScene,scrollY,panelWidth:p.clientWidth,panelHeight:p.clientHeight,contentHeight:p.scrollHeight,
          chapterHeights:[...document.querySelectorAll('[data-scene-panel]')].map(panel=>panel.clientHeight),
          accessible:[...document.querySelectorAll('[data-scene-panel]')].every(panel=>!panel.inert && panel.getAttribute('aria-hidden')!=='true'),
          horizontalOverflow:p.scrollWidth>p.clientWidth+1,verticalOverflow:p.scrollHeight>p.clientHeight+2,overflowY:style.overflowY,
          scrollbars:style.scrollbarWidth,border:style.borderWidth,rect:{top:rect.top,bottom:rect.bottom},
          copy:{top:copy.top,bottom:copy.bottom,left:copy.left,right:copy.right,width:copy.width},preview,
          headerBottom:header.bottom,canvasPointerEvents:getComputedStyle(document.querySelector('canvas')).pointerEvents,
          viewportOverflow:document.documentElement.scrollWidth>innerWidth};
      });
      results.push({viewport,...result});
      await page.screenshot({path:path.join(out,`${viewport.width}x${viewport.height}-scene-${i}.png`),animations:'disabled'});
      if (label==='after') {
        assert.equal(result.horizontalOverflow,false,'panel horizontal overflow');
        assert.equal(result.viewportOverflow,false,'viewport horizontal overflow');
        assert.equal(result.border,'0px','panel card border removed');
        assert.equal(result.verticalOverflow,false,'no nested vertical scroller');
        assert.equal(result.overflowY,'visible','content remains in document flow');
        assert.ok(result.rect.top >= -1 && result.rect.top < 2,'explicit navigation aligns the selected chapter');
        assert.ok(result.copy.top >= result.headerBottom,'content clears the fixed header');
        assert.equal(result.accessible,true,'all chapters remain accessible');
        assert.equal(result.canvasPointerEvents,'none','3D stays decorative');
        assert.deepEqual(result.chapterHeights,chapterHeights,'active scene changes do not shift chapter heights');
        if(i>=1 && i<=4) {
          const expected=['aegis.html','gridium.html','compressor-cbm.html','topoflow.html'][i-1];
          assert.ok(result.preview,'featured chapter has a visual preview');
          assert.equal(new URL(result.preview.href,'http://localhost').pathname,`/${expected}`,'visual links to its case study');
          assert.ok(result.preview.naturalWidth>0 && result.preview.naturalHeight>0,'project image has loaded');
          assert.ok(result.preview.declaredWidth>0 && result.preview.declaredHeight>0,'project image reserves its dimensions');
          assert.ok(result.preview.alt?.trim(),'project image has useful alternative text');
          assert.ok(result.preview.width>0 && result.preview.height>0,'preview is rendered');
          assert.ok(result.preview.left>=-1 && result.preview.right<=viewport.width+1,'preview fits the viewport');
          assert.ok(result.preview.top>=result.headerBottom,'preview clears the header');
          if(viewport.width<=820 && viewport.height>520) assert.ok(result.preview.top>=result.copy.bottom-1,'mobile narrative precedes the preview');
        }
      }
      if(await page.locator(`[data-scene-panel="${i}"] .project-visual`).count()) await page.locator(`[data-scene-panel="${i}"] .project-visual`).screenshot({path:path.join(out,`${viewport.width}x${viewport.height}-scene-${i}-preview.png`),animations:'disabled'});
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
