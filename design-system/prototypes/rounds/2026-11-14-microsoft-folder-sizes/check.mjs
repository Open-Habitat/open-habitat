// node check.mjs <offline.html> <out-dir> [--quick]
// Authored synthetic component lab, not a host-backed acceptance test.
// Walks the three directions at 1440 and 390 px, light and dark, in every
// situation: no document overflow, the direction's line marked, production's
// Microsoft dialog open, the sizes in the kind the situation names, the
// over-quota state said, the refusal's needed and free shown, the unopened
// sites said. Then at 1440 light it clicks each direction's flow: start an
// over choice -> count -> refusal with numbers; B and C choose again with the
// counted sizes and B takes part of OneDrive, which fits and completes; A's
// production refusal restarts; English. Screenshots at device scale 2 named
// v<n>-<direction>-<situation>-<width>-<theme>.png; --quick takes 1440 light.
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-11-14-microsoft-folder-sizes';
const [input,out,flag]=process.argv.slice(2);
const quick=flag==='--quick';
mkdirSync(out,{recursive:true});
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
const html=readFileSync(input,'utf8');
const names=['rivit','kansiot','mittari'];
const cases=['ladataan','mahtuu','ylittyy','arvio','torjuttu','sivusto'];
let checks=0;const errors=[];
const ok=(v,m)=>{assert.ok(v,m);checks++;};
const eq=(a,b,m)=>{assert.equal(a,b,m);checks++;};

async function open(width,theme){
 const phone=width===390;
 const page=await browser.newPage({viewport:{width,height:phone?844:900},deviceScaleFactor:2,reducedMotion:'reduce',hasTouch:phone});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('http://prototype.test/**',r=>r.fulfill({contentType:'text/html',body:html}));
 await page.goto('http://prototype.test/');
 await page.locator('#theme').selectOption(theme);
 return page;
}
const settle=page=>page.waitForTimeout(250);
const pick=async(page,d)=>{await page.locator('.proto-picker-item').nth(d).click();await page.locator(`.rq-review[data-direction="${d}"]`).waitFor({state:'attached'});await settle(page);};
const setCase=async(page,c)=>{await page.locator('#scenario').selectOption(c);await page.getByTestId('integration-dialog').waitFor();await settle(page);};
const shot=(page,d,c,tag)=>page.screenshot({path:`${out}/v${d+1}-${names[d]}-${c}-${tag}.png`});
const fits=page=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth);
const dialogText=page=>page.getByTestId('integration-dialog').innerText();
const visible=(page,id)=>page.locator(`[data-testid="${id}"]:visible`).count();

try{
for(const width of quick?[1440]:[1440,390])for(const theme of quick?['light']:['light','dark']){
 const tag=`${width}-${theme}`;
 const page=await open(width,theme);
 await checkPicker(page,round);
 eq(await page.getByTestId('recommendation').count(),1,'the recommendation is on the page');
 for(let d=0;d<3;d++){
  await pick(page,d);
  for(const c of cases){
   await setCase(page,c);
   const at=`${names[d]} ${c} ${tag}`;
   ok(await fits(page),`${at}: document overflow`);
   eq(await page.locator('.rq-lines li[aria-current]').count(),1,`${at}: its line is marked`);
   eq(await page.getByTestId('integration-dialog').getAttribute('data-provider'),'microsoft',`${at}: production's Microsoft dialog`);
   const text=await dialogText(page);
   if(c==='torjuttu'){
    eq(await visible(page,'integration-quota-refusal'),1,`${at}: production's refusal line`);
    eq(await visible(page,'need-line'),1,`${at}: needed vs free`);
    ok(text.includes('21,4 Gt')&&text.includes('19,8 Gt'),`${at}: the numbers`);
    if(d>0)eq(await visible(page,'rq-choose-again'),1,`${at}: choose again`);
    if(d===1)eq(await visible(page,'counted-list'),1,`${at}: counted sizes listed`);
    if(d===2)eq(await page.locator('[data-testid="rq-meter"][data-over="true"]').count(),1,`${at}: meter past the limit`);
   }else{
    eq(await visible(page,'integration-folder-choice'),1,`${at}: the folder step`);
    // A uses production's list; B and C their own, production's hidden.
    if(d===0){
     eq(await visible(page,'integration-capacity'),1,`${at}: production's meter`);
     eq(await page.locator('[data-testid^="integration-folder-row-"]:visible').count(),3,`${at}: three roots`);
    }else{
     eq(await page.locator('.ig-flow > .ig-folders:visible').count(),0,`${at}: production's list hidden`);
     eq(await visible(page,'rq-folders'),1,`${at}: own list`);
     eq(await visible(page,'rq-capacity'),1,`${at}: own meter line`);
     eq(await visible(page,'rq-start'),1,`${at}: own start`);
    }
    if(d===2)eq(await visible(page,'rq-meter'),1,`${at}: C's meter on top`);
    if(c==='ladataan')ok(text.includes('Lasketaan kokoa')||text.includes('Haetaan kokoa'),`${at}: sizes loading`);
    if(c==='mahtuu'){ok(text.includes('noin 12,6 Gt'),`${at}: estimate`);if(d>0)eq(await page.getByTestId('rq-capacity').getAttribute('data-over'),'false',`${at}: fits`);}
    if(c==='ylittyy'){
     ok(text.includes('Ei mahdu'),`${at}: over said`);
     if(d>0)ok(await page.getByTestId('rq-start').isDisabled(),`${at}: over by an estimate does not start`);
     if(d===1)eq(await visible(page,'rq-children-onedrive'),1,`${at}: OneDrive open`);
    }
    if(c==='arvio'){
     if(d>0){ok(text.includes('enintään 8,8 Gt'),`${at}: upper bound worded`);eq(await page.getByTestId('rq-capacity').getAttribute('data-maybe'),'true',`${at}: may fit`);ok(!(await page.getByTestId('rq-start').isDisabled()),`${at}: the count decides`);}
     else ok(text.includes('noin 8,8 Gt'),`${at}: production reads it as about`);
    }
    if(c==='sivusto'){
     if(d===0){eq(await visible(page,"rq-sites-notice"),1,`${at}: notice`);eq(await visible(page,"integration-unavailable-sites"),0,`${at}: production words replaced`);}
     else{eq(await visible(page,'gone-channel'),1,`${at}: channel row`);eq(await visible(page,'gone-intranet'),1,`${at}: removed row`);}
     ok(text.includes('toisen organisaation'),`${at}: other tenant said`);
    }
   }
   await shot(page,d,c,tag);
  }
 }
 await page.close();
}

// Flows at 1440 light.
const page=await open(1440,'light');
const wait=t=>page.getByTestId(t).first().waitFor({timeout:5000});
// A: production's step, over by estimate starts (production allows it), counts, refuses with numbers.
await pick(page,0);await setCase(page,'ylittyy');
await page.getByTestId('integration-sync-start').click();
await wait('integration-initial-sync');
ok(await page.getByTestId('integration-dialog').getByTestId('integration-sync-progress').isVisible(),'A: counting shown');
await wait('need-line');
ok((await dialogText(page)).includes('21,4 Gt'),'A: needed after the count');
await page.getByRole('button',{name:'Aloita alusta'}).click();await settle(page);
eq(await visible(page,'integration-folder-choice'),1,'A: restart returns to the choice');
// B: arvio may fit -> count -> fits -> completed.
await pick(page,1);await setCase(page,'arvio');
await page.getByTestId('rq-start').click();
await wait('integration-connected');
ok(true,'B: an upper-bound choice that fits completes');
// B: refusal -> choose again with counted sizes -> take part of OneDrive -> fits.
await setCase(page,'torjuttu');
await page.getByTestId('rq-choose-again').click();await settle(page);
ok((await page.getByTestId('rq-size-myynti').innerText()).includes('laskettu'),'B: counted sizes in the choice');
eq(await visible(page,'rq-children-onedrive'),1,'B: largest library opened');
ok(await page.getByTestId('rq-start').isDisabled(),'B: still over');
await page.getByTestId('rq-check-onedrive-kuvat').click();await settle(page);
eq(await page.getByTestId('rq-capacity').getAttribute('data-over'),'false','B: without Kuvat it fits');
ok((await page.getByTestId('rq-size-onedrive').innerText()).includes('4/5'),'B: part of OneDrive');
await shot(page,1,'osa-onedrivesta','1440-light');
await page.getByTestId('rq-start').click();
await wait('integration-connected');
ok(true,'B: part of OneDrive completes');
// C: over -> uncheck -> noRoom marks -> refusal meter.
await pick(page,2);await setCase(page,'mahtuu');
eq(await visible(page,'rq-noroom-myynti'),1,'C: a library that no longer fits is marked');
await page.getByTestId('rq-check-myynti').click();await settle(page);
eq(await page.getByTestId('rq-meter').getAttribute('data-over'),'true','C: meter over');
await shot(page,2,'yli-valittu','1440-light');
await setCase(page,'torjuttu');
await page.getByTestId('rq-choose-again').click();await settle(page);
ok((await page.getByTestId('rq-size-onedrive').innerText()).includes('laskettu'),'C: counted sizes in the choice');
// English.
await pick(page,1);
await page.locator('#language').selectOption('en');await settle(page);await setCase(page,'arvio');
ok((await dialogText(page)).includes('at most 8.8 GB'),'English upper bound');
await shot(page,1,'arvio-en','1440-light');
await setCase(page,'torjuttu');
ok((await dialogText(page)).includes('21.4 GB needed'),'English refusal');
await shot(page,1,'torjuttu-en','1440-light');
await page.close();
}finally{await browser.close();}
assert.deepEqual(errors,[],`console: ${errors.join('\n')}`);
console.log(`${checks} checks, console clean`);
