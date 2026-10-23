// Linux synthetic lab + prototype checks. Build web/dist and .cache/browser-host first.
// PLAYWRIGHT_BROWSERS_PATH=$PWD/.cache/ms-playwright node <this file>
import { chromium } from '../../../../web/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
const round='design-system/prototypes/rounds/2026-10-23-otsikon-odotus';
const out='design-system/prototypes/dist/title-evidence';
mkdirSync(out,{recursive:true});
const host=spawn('.cache/browser-host',['web/dist'],{env:{...process.env,BROWSER_HOST_LAB:'1',BROWSER_HOST_PORT:'19481'}});
const browser=await chromium.launch();
const errors=[];
try {
  const p=await browser.newPage({ignoreHTTPSErrors:true,viewport:{width:1440,height:1000}});
  for(let i=0;i<100;i++) {
    try {await p.goto('https://127.0.0.1:19481/healthz'); break;} catch {if(i===99) throw new Error('Lab not ready'); await new Promise(r=>setTimeout(r,200));}
  }
  await p.goto('https://127.0.0.1:19481/workspaces');
  await p.getByRole('button',{name:'Kirjaudu GitHubilla'}).click();
  await p.getByRole('link',{name:'Alice',exact:true}).click();
  await p.goto('https://127.0.0.1:19481/agents/pi:a1a1a1a1-0000-4000-8000-000000000001');
  await p.getByTestId('workspace-title').waitFor();
  const {snapshot}=await import('../../../../web/lab/session.mjs');
  for(const width of [1440,390]) {
    await p.setViewportSize({width,height:1000});
    await snapshot(p,`${out}/production-header-${width}`,{labOrigin:'https://127.0.0.1:19481'});
  }
  await p.close();
  execFileSync('node',['design-system/prototypes/build.mjs',round],{stdio:'inherit'});
  execFileSync('node',['design-system/prototypes/check.mjs','design-system/prototypes/dist/2026-10-23-otsikon-odotus.html','--out',out+'/matrix','--modes','desk-light,desk-dark,phone-light,phone-dark','--click','.topbar [data-ui="retitle"]','--click','.topbar [data-ui="info"]'],{stdio:'inherit'});
  let cases=0;
  for(const reducedMotion of ['no-preference','reduce']) for(const width of [1280,390]) for(const theme of ['light','dark']) {
    const page=await browser.newPage({viewport:{width,height:1000},reducedMotion});
    page.on('pageerror',e=>errors.push(e.message));
    page.on('console',m=>{if(m.type()==='error') errors.push(m.text());});
    await page.goto('file://'+process.cwd()+'/design-system/prototypes/dist/2026-10-23-otsikon-odotus.html');
    await page.selectOption('#theme',theme);
    if(width===390) await page.check('#phone');
    for(let v=1;v<=3;v++) {
      await page.locator('.proto-picker-item:not(.proto-picker-replay)').nth(v-1).click();
      await page.selectOption('#title-pace','slow');
      await page.selectOption('#title-scene','again');
      await page.locator('#title-replay').click();
      await page.waitForSelector('.title-name[data-busy="true"]');
      assert.equal(await page.locator('.title-name h1').textContent(),'Status-skripti');
      assert.equal(await page.locator('.topbar [data-ui="retitle"]').getAttribute('aria-disabled'),'true');
      assert.equal(await page.locator('[aria-current="true"].proto-picker-item').count(),1);
      if(reducedMotion==='reduce') assert.deepEqual(await page.locator('.title-name').evaluate(n=>n.getAnimations({subtree:true}).map(a=>a.animationName)),[]);
      assert(await page.locator('.topbar').evaluate(n=>n.scrollWidth<=n.clientWidth+1));
      await page.screenshot({path:`${out}/pending-${width}-${theme}-${reducedMotion}-${v}.png`});
      // Completion, failure, initial naming, quick response and remount while pending.
      for(const pace of ['fast','normal','error']) {
        await page.selectOption('#title-pace',pace);
        await page.locator('#title-replay').click();
        await page.waitForSelector('.title-name[data-busy="false"]');
        assert.equal(await page.locator('.title-name h1').textContent(),pace==='error'?'Status-skripti':'Viikon statusrivit JSONiksi');
      }
      await page.selectOption('#title-scene','first');
      await page.selectOption('#title-pace','fast');
      await page.locator('#title-replay').click();
      await page.waitForSelector('.title-name[data-busy="false"]');
      assert.equal(await page.locator('.title-name h1').textContent(),'Viikon statusrivit JSONiksi');
      await page.selectOption('#title-scene','again');
      await page.check('#title-long');
      await page.selectOption('#title-pace','slow');
      assert(await page.locator('.topbar').evaluate(n=>n.scrollWidth<=n.clientWidth+1));
      await page.locator('.title-name').screenshot({path:`${out}/long-${width}-${theme}-${reducedMotion}-${v}.png`});
      await page.uncheck('#title-long');
      await page.selectOption('#title-scene','again');
      await page.locator('#title-replay').click();
      await page.locator('.topbar [data-ui="info"][aria-label="Tiedot"]').click();
      await page.getByRole('heading',{name:'Tiedot',exact:true}).waitFor();
      await page.keyboard.press('Escape');
      await page.evaluate(()=>document.activeElement?.blur());
      await page.keyboard.press('r');
      await page.waitForSelector('.title-name[data-busy="true"]');
      cases++;
    }
    await page.close();
  }
  assert.deepEqual(errors,[]);
  writeFileSync(out+'/result.json',JSON.stringify({cases,errors,productionLabCaptures:2,checks:['12 check.mjs theme/width views','24 pending/reduced-motion views','fast/normal/error/first/long/info/replay in every case']},null,2));
  console.log('TITLE PROTOTYPE VERIFIED',cases);
} finally {await browser.close(); host.kill('SIGTERM');}
