// node check.mjs <html-or-hosted-url> <evidence-dir>
// Authored synthetic component lab, not a host-backed acceptance test: every
// direction at desktop, tablet and phone width, light and dark, both starting
// points and the administrator's view, with the interactions clicked and the
// console clean.
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-10-24-pilvikansio-silta-r2',names=['Kolme vastausta','Kyllä / Ei','Lopuksi'];
const question='Onko sinulla henkilökohtainen Dropbox tai OneDrive?';
const [input,out]=process.argv.slice(2),hosted=input.startsWith('https:');
mkdirSync(out,{recursive:true});
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
let checks=0;const errors=[];
try{
for(const width of [1440,820,390])for(const theme of ['light','dark']){
 const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 if(hosted)await page.goto(input);else{await page.route('http://prototype.test/**',r=>r.fulfill({contentType:'text/html',body:readFileSync(input,'utf8')}));await page.goto('http://prototype.test/');}
 const f=hosted?page.frameLocator('iframe').first():page;
 const id=x=>f.getByTestId(x).first();
 await f.locator('nav.proto-picker[data-ready]').waitFor();
 await f.locator('#theme').selectOption(theme);
 if(width===390)await f.locator('#phone').check();
 await checkPicker(f,round);
 const key=async k=>{await f.locator('.axis').click();await page.keyboard.press(k);};
 const variant=d=>f.locator(`.shell.variant-${d}`).waitFor();
 const seg=async(t,label)=>{await id(t).getByRole('button',{name:label,exact:true}).click();};
 const state=async s=>id(`onboarding-step-${s}`).getAttribute('data-state');
 const note=async s=>id(`onboarding-note-${s}`).innerText();
 const checkpoint=async()=>{
  assert.equal(await f.locator('body').evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`document overflow at ${width}`);
  for(const el of await f.locator('.shell button:visible').all()){const b=await el.boundingBox();if(b)assert.ok(b.x>=-1&&b.x+b.width<=width+1,`control overflow ${JSON.stringify(b)} at ${width}`);}
  checks++;};
 const shot=async(name,full=true)=>{if(!hosted)await page.screenshot({path:`${out}/${name}-${width}-${theme}.png`,fullPage:full});};
 const connect=async provider=>{await id(`integration-tile-${provider}`).getByTestId('integration-connect-open').click();await id('connect').and(f.locator('[data-connected=true]')).waitFor();};

 // ---- 1 Kolme vastausta ----
 await key('1');await variant(0);
 assert.equal((await f.locator('.proto-picker-item[data-active]').innerText()).replaceAll('\u00a0',' '),names[0]);
 assert.equal(await id('step-title').innerText(),question);
 assert.equal(await state('cloud'),'current');assert.equal(await state('microsoft'),'skipped');
 assert.equal(await f.getByTestId('step-continue').count(),0,'the question is answered, not skipped');
 await checkpoint();await shot('1-kysymys',false);
 await id('answer-dropbox').click();await connect('dropbox');
 assert.equal(await id('connect').getByTestId('integration-account-dropbox').count(),1,'the production account card');
 assert.match(await id('howto').innerText(),/Finderissa: Dropbox › Open Habitat/);
 assert.equal(await id('step-continue').innerText(),'Jatka kokeilematta');
 await id('simulate-arrival').click();await id('arrived').waitFor();
 assert.equal(await id('step-continue').innerText(),'Jatka');
 await checkpoint();await shot('1-dropbox');
 await id('step-continue').click();await id('elsewhere').waitFor();
 assert.equal(await state('cloud'),'done');assert.equal(await note('cloud'),'Dropbox · kokeiltu');
 await id('elsewhere-back').click();
 await id('answer-no').click();assert.match(await id('later').innerText(),/Asetukset › Integraatiot/);
 await id('step-continue').click();
 assert.equal(await state('cloud'),'skipped');assert.equal(await note('cloud'),'Ei pilveä');
 await checkpoint();if(theme==='light')await shot('1-ei',false);
 await seg('scenario','OneDrive jo yhdistetty');
 assert.equal(await f.getByTestId('onboarding-step-cloud').count(),0,'not asked: no step on the route');
 assert.equal(await state('microsoft'),'done');assert.match(await id('not-asked').innerText(),/OneDrive yhdistettiin/);
 await checkpoint();if(theme==='light')await shot('1-jo-yhdistetty',false);
 await seg('view','Ylläpitäjä');assert.equal(await id('admin-route-cloud').innerText(),'4\nOma kone\nAutomaattinen');
 await checkpoint();await shot('1-yllapitaja',false);
 await seg('view','Henkilö');await seg('scenario','Ei pilveä');

 // ---- 2 Kyllä / Ei ----
 await key('2');await variant(1);
 assert.equal(await id('step-title').innerText(),question);
 assert.equal(await note('cloud'),'Nyt');
 await checkpoint();await shot('2-kysymys',false);
 await id('answer-yes').click();await id('answer-microsoft').click();await id('sub-connect').waitFor();
 assert.equal(await id('sub-connect').getByTestId('step-title').innerText(),'Yhdistä OneDrive');
 assert.equal(await f.getByTestId('sub-route').count(),1,'the route grows sub-steps');
 await connect('microsoft');
 assert.equal(await id('sub-connect').getByTestId('step-continue').count(),1);
 await checkpoint();await shot('2-yhdista');
 await id('step-continue').click();await id('sub-computer').waitFor();
 assert.match(await id('howto').innerText(),/OneDrive App Storesta/);
 assert.equal(await id('sub-route').locator('[data-testid=sub-route-connect]').getAttribute('data-state'),'done');
 assert.equal(await id('sub-route').locator('[data-testid=sub-route-computer]').getAttribute('data-state'),'current');
 await checkpoint();if(theme==='light')await shot('2-koneellesi');
 await id('step-continue').click();await id('sub-try').waitFor();
 assert.equal(await id('step-continue').innerText(),'Ohita kokeilu');
 await id('simulate-arrival').click();assert.equal(await id('step-continue').innerText(),'Jatka AI-tiliin');
 await id('step-continue').click();await id('elsewhere').waitFor();
 assert.equal(await state('cloud'),'done');assert.equal(await note('cloud'),'OneDrive');
 assert.equal(await id('sub-route').locator('[data-testid=sub-route-try]').getAttribute('data-state'),'done');
 await checkpoint();await shot('2-valmis',false);
 await id('restart').click();await id('answer-no').click();await id('elsewhere').waitFor();
 assert.equal(await state('cloud'),'skipped');assert.equal(await note('cloud'),'Ei nyt');
 await seg('scenario','OneDrive jo yhdistetty');
 assert.equal(await state('cloud'),'done');assert.equal(await note('cloud'),'OneDrive · yhdistetty');
 assert.equal(await state('ai'),'current');assert.match(await id('not-asked').innerText(),/reitillä valmiina/);
 await checkpoint();if(theme==='light')await shot('2-jo-yhdistetty',false);
 await seg('view','Ylläpitäjä');
 assert.equal(await id('admin-route-cloud').innerText(),'4\nOma kone\nVoi ohittaa');
 await id('admin-remove').click();await id('admin-add').waitFor();assert.equal(await f.getByTestId('admin-route-cloud').count(),0);
 await checkpoint();await shot('2-yllapitaja',false);
 await id('admin-add').click();await id('admin-route-cloud').waitFor();
 await seg('view','Henkilö');await seg('scenario','Ei pilveä');

 // ---- 3 Lopuksi ----
 await key('3');await variant(2);
 assert.equal(await id('step-title').innerText(),question);
 assert.equal(await state('ai'),'done');assert.equal(await state('cloud'),'current');
 assert.equal(await id('step-continue').innerText(),'Ei nyt, aloita työ');
 await checkpoint();await shot('3-kysymys',false);
 await id('answer-dropbox').click();await connect('dropbox');
 await id('how').locator('summary').click();await id('howto').waitFor();
 await id('simulate-arrival').click();await id('agent-try').locator('.ah-markdown code').first().waitFor();
 assert.match(await id('agent-try').innerText(),/401 invalid_client/);
 assert.equal(await id('step-continue').innerText(),'Aloita työ');
 await checkpoint();await shot('3-agentti');
 await id('step-continue').click();await id('elsewhere').waitFor();
 assert.equal(await state('cloud'),'done');assert.equal(await note('cloud'),'Dropbox · kokeiltu');
 await id('restart').click();await id('step-continue').click();
 assert.equal(await note('cloud'),'Ei nyt');assert.match(await id('later').innerText(),/Liitä-valikosta/);
 await checkpoint();if(theme==='light')await shot('3-ei',false);
 await seg('scenario','OneDrive jo yhdistetty');
 assert.equal(await id('step-title').innerText(),'Kokeile OneDrive-kansiota');
 assert.equal(await f.getByTestId('answer-dropbox').count(),0,'not asked');
 assert.equal(await state('microsoft'),'done');
 await checkpoint();if(theme==='light')await shot('3-jo-yhdistetty');
 await seg('view','Ylläpitäjä');
 assert.equal(await id('admin-route-cloud').innerText(),'5\nOma kone\nKysytään lopuksi');
 await seg('admin-ask','Älä kysy');assert.equal(await id('admin-route-cloud').innerText(),'–\nOma kone\nEi kysytä');
 await checkpoint();await shot('3-yllapitaja',false);
 await seg('admin-ask','Kysy');await seg('view','Henkilö');await seg('scenario','Ei pilveä');

 // Selection persists across reload.
 assert.equal(await f.locator('body').evaluate(()=>new URL(location.href).searchParams.get('v')),'3');
 await page.close();
}
}finally{await browser.close();}
assert.deepEqual(errors,[],'console clean');
console.log(`ok: ${checks} checkpoints, 3 widths × 2 themes × 3 directions`);
