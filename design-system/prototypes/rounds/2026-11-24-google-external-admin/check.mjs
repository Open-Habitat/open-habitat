// node check.mjs <offline.html> <out-dir> [--quick]
// Authored synthetic component lab, not a host-backed acceptance test.
// Nyt: the captures are embedded (both widths). Each direction in every
// situation at 1440 light, then 390 light and 1440 dark for each situation
// (--quick skips those): asserts the direction's row line, the dialog the
// situation opens, the publishing step without a default (Next waits, Testing
// needs an explicit keep), the org_internal case with the way to the
// production audience walk, B's declaration saved and shown, C's own test
// outcome changing the row, no document overflow, console clean, picker.
// Screenshots r1-<d>-<scenario>-<width>-<theme>.png.
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-11-24-google-external-admin';
const [input,out,flag]=process.argv.slice(2);
const quick=flag==='--quick';
mkdirSync(out,{recursive:true});
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
const html=readFileSync(input,'utf8');
const scenarios=['rivi','julkaisu','org-internal','testing','uusi-henkilo','henkilo'];
let checks=0;const errors=[];
const ok=(v,m)=>{assert.ok(v,m);checks++;};
const eq=(a,b,m)=>{assert.equal(a,b,m);checks++;};

async function open(width,theme,d,s){
 const phone=width===390;
 const page=await browser.newPage({viewport:{width,height:phone?844:900},deviceScaleFactor:phone?2:1,reducedMotion:'reduce',hasTouch:phone});
 page.on('pageerror',e=>errors.push(`${d} ${s}: ${e.message}`));
 page.on('console',m=>{if(m.type()==='error'||m.type()==='warning')errors.push(`${d} ${s}: ${m.text()}`);});
 await page.route('http://prototype.test/**',r=>r.fulfill({contentType:'text/html',body:html}));
 await page.goto(`http://prototype.test/?v=${d+1}&s=${s}&theme=${theme}`);
 await page.locator(`.rq-review[data-direction="${d}"]`).waitFor({state:'attached'});
 await page.getByTestId('rq-page').waitFor();
 await page.waitForTimeout(300);
 return page;
}
const shot=(page,d,s,tag)=>page.screenshot({path:`${out}/r1-${d}-${s}-${tag}.png`,fullPage:true});
const noOverflow=page=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth);
const vis=async(page,id)=>(await page.getByTestId(id).count())>0&&await page.getByTestId(id).first().isVisible();

// Nyt
{
 const page=await open(1440,'light',0,'rivi');
 await checkPicker(page,round);checks++;
 eq(await page.getByTestId('rq-no-captures').count(),0,'Nyt: captures embedded');
 ok(await page.getByTestId('rq-shot').count()>=30,'Nyt: 1440 captures shown');
 await shot(page,0,'nyt','1440-light');
 await page.getByTestId('rq-width').getByText('390').click();
 ok(await page.getByTestId('rq-shot').count()>=30,'Nyt: 390 captures shown');
 await page.close();
}

async function assertDefault(page,d,s,tag){
 const what=`${d} ${s} ${tag}`;
 ok(await noOverflow(page),`${what}: document overflow`);
 eq(await page.locator('.rq-lines li[aria-current]').count(),1,`${what}: its line is marked`);
 if(s==='henkilo'){ok(await vis(page,'rq-person'),`${what}: person sketch`);return;}
 ok(await vis(page,'rq-rowline'),`${what}: row line under Google`);
 const row=await page.getByTestId('rq-rowline').innerText();
 if(d===1)ok(/ei näe/.test(row),`${what}: A says Habitat cannot see it`);
 if(d===2)eq(await page.getByTestId('rq-rowline').getAttribute('data-declared'),s==='testing'?'testing':'internal',`${what}: B declared state`);
 if(d===3)eq(await page.getByTestId('rq-rowline').getAttribute('data-own'),{'org-internal':'stopped',testing:'broke','uusi-henkilo':'ok'}[s]??'none',`${what}: C own test state`);
 const dlg={julkaisu:'rq-guide','org-internal':d===3?'rq-try-dialog':'rq-trouble'}[s]??(s==='testing'&&d===1?'rq-trouble':s==='uusi-henkilo'&&d===1?'rq-check-dialog':s==='uusi-henkilo'&&d===2?'rq-person-dialog':null);
 if(dlg)ok(await vis(page,dlg),`${what}: ${dlg} open`);
 else eq(await page.locator('[role=dialog]').count(),0,`${what}: no dialog`);
 if(s==='julkaisu'){
  ok(await vis(page,'rq-publish-none'),`${what}: no default`);
  ok(await page.getByTestId('rq-next').isDisabled(),`${what}: Next waits`);
 }
 if(s==='org-internal')ok(await vis(page,'rq-case-org_internal'),`${what}: org_internal case open`);
 if(s==='org-internal'&&d===2)ok(await vis(page,'rq-explains'),`${what}: declaration explains it`);
}

for(let d=1;d<=3;d++)for(const s of scenarios){
 const tags=quick?[[1440,'light']]:[[1440,'light'],[390,'light'],[1440,'dark']];
 for(const [w,theme] of tags){
  const page=await open(w,theme,d,s);
  await assertDefault(page,d,s,`${w}-${theme}`);
  if(s==='rivi'){await checkPicker(page,round);checks++;}
  await shot(page,d,s,`${w}-${theme}`);
  await page.close();
 }
}

// Flows, 1440 light.
for(let d=1;d<=3;d++){
 let page=await open(1440,'light',d,'julkaisu');
 await page.getByTestId('rq-publish').getByText('Testing').click();
 ok(await vis(page,'rq-testing'),`${d}: Testing explained`);
 ok(await page.getByTestId('rq-next').isDisabled(),`${d}: Testing does not pass silently`);
 await page.getByTestId('rq-keep-testing').click();
 ok(await page.getByTestId('rq-next').isEnabled(),`${d}: explicit keep passes`);
 await page.getByTestId('rq-publish').getByText('In production').click();
 if(d===2)ok(await vis(page,'rq-will-save'),'B: says what is saved');
 await page.getByTestId('rq-next').click();
 await page.getByTestId('rq-save').click();
 if(d===1){await page.getByTestId('rq-usertype').getByText('Internal').click();eq(await page.getByTestId('rq-answer').getAttribute('data-state'),'internal','A: answer after save');}
 if(d===2){ok(await vis(page,'rq-declared-saved'),'B: declaration saved');}
 if(d===3){await page.getByTestId('rq-sim-ok').click();ok(await vis(page,'rq-try-ok'),'C: test ok');}
 await shot(page,d,'julkaisu-end','1440-light');
 await page.getByTestId('rq-done').click();
 if(d===2)eq(await page.getByTestId('rq-rowline').getAttribute('data-declared'),'production','B: row shows the new declaration');
 await page.close();

 page=await open(1440,'light',d,'org-internal');
 await page.getByTestId('rq-allow').first().click();
 ok(await vis(page,'gg-audience-dialog'),`${d}: production audience walk opens`);
 await page.close();
}
{ // A: check from the row; B: change the declaration; C: test from the row.
 let page=await open(1440,'light',1,'rivi');
 await page.getByTestId('rq-check').click();
 await page.getByTestId('rq-usertype').getByText('External').click();
 await page.getByTestId('rq-publishing').getByText('Testing').click();
 eq(await page.getByTestId('rq-answer').getAttribute('data-state'),'testing','A: Testing answer');
 ok(await vis(page,'rq-new-person'),'A: new person answer');
 await shot(page,1,'check-testing','1440-light');
 await page.close();
 page=await open(1440,'light',2,'rivi');
 await page.getByTestId('rq-declare').click();
 await page.getByTestId('rq-usertype').getByText('External').click();
 await page.getByTestId('rq-publishing').getByText('In production').click();
 await page.getByTestId('rq-declare-save').click();
 eq(await page.getByTestId('rq-rowline').getAttribute('data-declared'),'production','B: declaration changed');
 await page.close();
 page=await open(1440,'light',3,'rivi');
 await page.getByTestId('rq-try-row').click();
 await page.getByTestId('rq-sim-stop').click();
 await page.getByTestId('rq-said-org_internal').click();
 ok(await vis(page,'rq-case-org_internal'),'C: org_internal after own stop');
 await page.getByTestId('rq-close').click();
 eq(await page.getByTestId('rq-rowline').getAttribute('data-own'),'stopped','C: row reflects own stop');
 await page.close();
}
await browser.close();
assert.deepEqual(errors,[],'console clean');
console.log(`ok ${checks} checks`);
