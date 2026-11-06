// node check.mjs <offline.html> <evidence-dir>
// Authored synthetic component lab, not a host-backed acceptance test. Walks
// today and every direction light and dark at 1440 px (pointer) and 390 px
// (touch): the default moment (12.40, back at the computer), the hurried
// exit at 9.20, opening the conversation left unanswered the direction's
// way (A: Ei nyt; B: reading past 20 s on a fake clock, and a glance; C: the
// return time changed), and the last moment, replying. Asserts where the
// three tracked conversations are in the rail and the day strip. Screenshots
// at device scale factor 2; the console must stay clean.
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-11-06-hiljaisiin-siirtyminen';
const [input,out]=process.argv.slice(2);
mkdirSync(out,{recursive:true});
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
const names=['nyt','a-vastaus','b-luku','c-paluu'];
// Where NDA, Laskun muistutus and Kesäajan virhe are at 12.40 in each direction.
const at1240=[
 {nda:'rail-quiet',lasku:'rail-quiet',kesa:'rail-quiet'},
 {nda:'rail-yours',lasku:'rail-yours',kesa:'rail-yours'},
 {nda:'rail-yours',lasku:'rail-quiet',kesa:'rail-yours'},
 {nda:'rail-yours',lasku:'rail-yours',kesa:'rail-quiet'},
];
let checks=0;const errors=[];
const ok=(v,m)=>{assert.ok(v,m);checks++;};
const eq=(a,b,m)=>{assert.equal(a,b,m);checks++;};
try{
for(const width of [1440,390])for(const theme of ['light','dark']){
 const mobile=width===390;
 const page=await browser.newPage({viewport:{width,height:mobile?844:900},deviceScaleFactor:2,reducedMotion:'reduce',isMobile:mobile,hasTouch:mobile});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.clock.install();
 await page.route('http://prototype.test/**',r=>r.fulfill({contentType:'text/html',body:readFileSync(input,'utf8')}));
 await page.goto('http://prototype.test/');
 await page.locator('#theme').selectOption(theme);
 await checkPicker(page,round);
 const tag=`${width}-${theme}`;
 const shots=theme==='light'||!mobile;
 const capture=async name=>{if(!shots)return;await page.clock.runFor(150);await page.screenshot({path:`${out}/${name}-${tag}.png`});};
 const fits=async()=>ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'document overflow');
 const where=async id=>{for(const s of ['rail-yours','rail-running','rail-quiet'])if(await page.getByTestId(s).getByTestId(`slot-${id}`).count())return s;return 'none';};
 const drawer=async open=>{if(!mobile)return;
  if(open){if(!(await page.locator('.ah-mobile-open').count())){await page.getByTestId('navigation-open').click();await page.locator('.ah-mobile-open').waitFor();}}
  else if(await page.locator('.ah-mobile-open').count()){await page.keyboard.press('Escape');await page.locator('.ah-mobile-open').waitFor({state:'detached'});}
 };
 const TITLES={nda:'NDA-viestin tarkistus',lasku:'Laskun muistutus',kesa:'Kesäajan virhe'};
 const openRow=async id=>{await drawer(true);await page.getByTestId(`slot-${id}`).locator('.ah-nav-link').click();await page.getByTestId('workspace-title').filter({hasText:TITLES[id]}).waitFor();await drawer(false);};
 const step=async i=>{await page.getByTestId(`step-${i}`).click();await page.locator(`.tq-review[data-step="${i}"]`).waitFor({state:"attached"});};
 const pick=async d=>{
  await page.locator('.proto-picker-item').nth(d).click();
  await page.locator(`.tq-review.variant-${d}`).waitFor({state:'attached'});
  await page.getByTestId('tq-reset').click();
  await page.getByTestId('slot-nda').waitFor({state:'attached'});
 };
 for(const d of [0,1,2,3]){
  await pick(d);
  const n=names[d];
  assert.match(await page.getByTestId('direction-lines').locator('li[aria-current]').innerText(),d?/^[ABC] /:/^Nyt: /);checks++;
  // Default: 12.40, back from the meeting.
  ok((await page.getByTestId('scene').innerText()).includes('12.40'),'default moment');
  for(const [id,s] of Object.entries(at1240[d]))eq(await where(id),s,`${n} 12.40 ${id}`);
  eq(await page.getByTestId('cell-nda-7').getAttribute('data-place'),at1240[d].nda.slice(5),`${n} strip nda`);
  await fits();await capture(`${n}-0-oletus`);
  if(mobile){await drawer(true);await fits();await capture(`${n}-0-sivupalkki`);await drawer(false);}
  // 9.20: the hurried exit from NDA after twelve seconds.
  await step(2);
  eq(await where('nda'),d===0||d===3?'rail-quiet':'rail-yours',`${n} 9.20 nda`);
  if(d===2)ok((await page.getByTestId('why-nda').innerText()).includes('Vilkaisit 12 s'),'B: glance said');
  if(d===3)ok((await page.getByTestId('why-nda').innerText()).includes('Palaa Sinun vuoroosi 11.20'),'C: return said');
  await drawer(true);await capture(`${n}-1-kiire`);await drawer(false);
  // Back at 12.40, open NDA the direction's way.
  await step(7);
  await openRow('nda');
  if(d===0){
   eq(await where('nda'),'rail-quiet','Nyt: opening clears nothing more');
   ok(!(await page.getByTestId('note').count()),'Nyt: no note');
   await drawer(true);await capture(`${n}-2-avaat-nda`);await drawer(false);
  }
  if(d===1){
   eq(await where('nda'),'rail-yours','A: stays when opened');
   eq(await page.getByTestId('slot-nda').getAttribute('data-ring'),'true','A: ring');
   await page.getByTestId('note').waitFor();checks++;
   await fits();await capture(`${n}-2-avattu-pysyy`);
   await page.getByTestId('note-not-now').click();
   eq(await where('nda'),'rail-quiet','A: Ei nyt');
   await drawer(true);await capture(`${n}-3-ei-nyt`);await drawer(false);
  }
  if(d===2){
   eq(await where('nda'),'rail-yours','B: reading');
   ok((await page.getByTestId('note').innerText()).includes('/20 s'),'B: counter');
   await capture(`${n}-2-luet`);
   await page.clock.runFor(21000);
   ok((await page.getByTestId('note').innerText()).includes('Luettu'),'B: read after 20 s');
   eq(await where('nda'),'rail-yours','B: stays while open');
   await drawer(true);await capture(`${n}-3-luettu`);await drawer(false);
   await openRow('kesa');
   eq(await where('nda'),'rail-quiet','B: leaves when you leave');
  }
  if(d===3){
   eq(await where('nda'),'rail-quiet','C: opening clears');
   ok((await page.getByTestId('note').innerText()).includes('14.40'),'C: returns in two hours');
   await capture(`${n}-2-palaa`);
   await page.getByTestId('note-return-menu').click();
   await page.getByRole('menuitem',{name:/Huomenna klo 9/}).waitFor();
   await capture(`${n}-3-muuta`);
   await page.getByRole('menuitem',{name:/Huomenna klo 9/}).click();
   ok((await page.getByTestId('note').innerText()).includes('huomenna 9.00'),'C: tomorrow');
  }
  // 12.42: replying moves NDA to Käynnissä in every direction.
  await step(8);
  eq(await where('nda'),'rail-running',`${n} 12.42 nda`);
  eq(await where('lasku'),d===1||d===3?'rail-yours':'rail-quiet',`${n} 12.42 lasku`);
  await drawer(true);await capture(`${n}-4-vastaat`);await drawer(false);
  // A live reply: the agent answers and the rule applies again.
  const field=page.locator('.ah-cbox-field');
  await field.fill('Kiitos.');await field.press('Enter');
  await page.clock.runFor(3000);
  eq(await where('nda'),d===1||d===2?'rail-yours':'rail-quiet',`${n} live reply seen`);
 }
 await page.close();
}
}finally{await browser.close();}
assert.deepEqual(errors,[]);
console.log(`ok: ${checks} checkpoints`);
