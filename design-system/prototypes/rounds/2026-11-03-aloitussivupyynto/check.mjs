// node check.mjs <offline.html> <evidence-dir>
// Authored synthetic component lab, not a host-backed acceptance test. Walks
// Nyt and the three directions light and dark at 1440 and 390 px; checks the
// directions carry no command or file name, that each screen shows what its
// caption says, presses both start buttons, opens the folded instruction, and
// writes screenshots at scale 2 (whole page, plus the history reader).
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-11-03-aloitussivupyynto';
const [input,out]=process.argv.slice(2);
mkdirSync(out,{recursive:true});
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
const names=['nyt','siru','taitettu','nimi'];
let checks=0;const errors=[];
try{
for(const width of [1440,390])for(const theme of ['light','dark']){
 const page=await browser.newPage({viewport:{width,height:width===390?844:900},deviceScaleFactor:2,reducedMotion:'reduce'});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('http://prototype.test/**',r=>r.fulfill({contentType:'text/html',body:readFileSync(input,'utf8')}));
 await page.goto('http://prototype.test/');
 await page.locator('#theme').selectOption(theme);
 await checkPicker(page,round);
 const tag=`${width}-${theme}`;
 const ok=()=>{checks++;};
 const fits=async()=>{assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'document overflow');ok();};
 const screen=id=>page.getByTestId(id);
 for(const d of [0,1,2,3]){
  for(const mode of theme==='light'?['absent','update']:['absent']){
   await page.locator('.proto-picker-item').nth(d).click();
   await page.locator(`.rq-review.variant-${d}`).waitFor({state:'attached'});
   await page.locator('#mode').selectOption(mode);
   const title=mode==='update'?'Päivitä aloitussivu':'Luo aloitussivu';
   assert.match(await page.getByTestId('direction-lines').locator('li[aria-current]').innerText(),[/^Nyt:/,/^Siru:/,/^Heti, ohje:/,/^Heti, nimi:/][d]);
   assert.equal((await screen('page-a').getByTestId('landing-create').innerText()).trim(),title);ok();
   const pageB=await screen('page-b').innerText(), pageC=await screen('page-c').innerText(), emptyC=await screen('empty-c').innerText();
   if(d===0){
    // Today: the bare command in the field and as an ordinary message.
    assert.equal(await screen('page-b').locator('.ah-composer textarea').inputValue(),'/open-habitat-start-page ');
    assert.match(pageC,/\/open-habitat-start-page/);
    assert.equal(await screen('page-c').getByTestId('skill-chip').count(),0);
    assert.equal(await screen('empty-a').getByTestId('empty-create').count(),0);
    assert.ok(await screen('empty-a').getByTestId(mode==='update'?'start-page-needs-update':'start-page-hint').isVisible());
   }else{
    // No command or file name anywhere in a direction.
    assert.doesNotMatch(await page.locator('.rq-stage').innerText(),/open-habitat-start-page|start-page\.md|\/skill:/);
    assert.equal((await screen('empty-a').getByTestId('empty-create').innerText()).trim(),title);
    if(d===1){
     assert.match(await screen('page-b').getByTestId('goal-chip').innerText(),new RegExp(title));
     assert.equal(await screen('page-b').locator('.ah-composer textarea').inputValue(),'');
     assert.match(pageC,/Korosta viikkoyhteenvetoja/);
    }else{
     assert.equal(await screen('page-b').getByTestId('goal-chip').count(),0);
     assert.match(pageB,/Työskentelee/);
    }
    for(const c of [pageC,emptyC])assert.match(c,new RegExp(title));
    const chips=await page.locator('.rq-stage [data-testid="skill-chip"]').count();
    const labels=await page.locator('.rq-stage [data-testid="request-label"]').count();
    if(d===3){assert.equal(chips,0);assert.equal(labels,4);}else{assert.equal(labels,0);assert.ok(chips>=3);}
   }
   ok();
   // Pressing a start button points at its result.
   await screen('page-a').getByTestId('landing-create').click();
   await page.waitForFunction(()=>document.querySelector('[data-testid="page-b"]')?.hasAttribute('data-flash'));ok();
   if(d>0){
    await screen('empty-a').getByTestId('empty-create').click();
    await page.waitForFunction(()=>document.querySelector('[data-testid="empty-b"]')?.hasAttribute('data-flash'));ok();
   }
   await page.waitForTimeout(1400);
   await page.evaluate(()=>scrollTo(0,0));
   await fits();
   const suffix=mode==='update'?'-paivita':'';
   // The floating picker would land mid-page in a full-page capture.
   await page.locator('nav.proto-picker').evaluate(el=>{el.style.visibility='hidden';});
   await page.screenshot({path:`${out}/${d}-${names[d]}${suffix}-${tag}.png`,fullPage:true});
   await page.locator('nav.proto-picker').evaluate(el=>{el.style.visibility='';});
   // The folded instruction opens from the history.
   if((d===1||d===2)&&mode==='absent'&&theme==='light'){
    await screen('empty-c').getByTestId('skill-chip').click();
    const panel=page.getByTestId('skill-panel');await panel.waitFor();
    assert.match(await panel.innerText(),/Luo aloitussivu/);
    assert.match(await panel.innerText(),/A useful first conversation/);ok();
    await page.waitForTimeout(200);
    await page.screenshot({path:`${out}/${d}-${names[d]}-ohje-${tag}.png`});
    await page.getByTestId('skill-close').click();
    await panel.waitFor({state:'detached'});
   }
  }
 }
 await page.close();
}
}finally{await browser.close();}
assert.deepEqual(errors,[]);
console.log(`ok: ${checks} checkpoints`);
