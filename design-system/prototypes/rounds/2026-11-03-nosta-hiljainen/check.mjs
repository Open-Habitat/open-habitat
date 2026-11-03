// node check.mjs <offline.html> <evidence-dir>
// Authored synthetic component lab, not a host-backed acceptance test. Walks
// today and every direction light and dark at 1440 px (pointer) and 390 px
// (touch): the default view, raising a Hiljaiset conversation by the
// direction's own control (A on the phone by swiping), seeing it in Sinun
// vuorosi and in the Sillä aikaa row, walking there with Avaa seuraava, and
// leaving it the direction's way. Screenshots at device scale factor 2; the
// console must stay clean.
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-11-03-nosta-hiljainen';
const [input,out]=process.argv.slice(2);
mkdirSync(out,{recursive:true});
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
const names=['nyt','a-pallosta','b-valikosta','c-nostamasi'];
let checks=0;const errors=[];
const ok=(v,m)=>{assert.ok(v,m);checks++;};
try{
for(const width of [1440,390])for(const theme of ['light','dark']){
 const mobile=width===390;
 const page=await browser.newPage({viewport:{width,height:mobile?844:900},deviceScaleFactor:2,reducedMotion:'reduce',isMobile:mobile,hasTouch:mobile});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('http://prototype.test/**',r=>r.fulfill({contentType:'text/html',body:readFileSync(input,'utf8')}));
 await page.goto('http://prototype.test/');
 await page.locator('#theme').selectOption(theme);
 await checkPicker(page,round);
 const tag=`${width}-${theme}`;
 const shots=theme==='light'||!mobile;
 const capture=async name=>{if(!shots)return;await page.waitForTimeout(150);await page.screenshot({path:`${out}/${name}-${tag}.png`});};
 const fits=async()=>ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'document overflow');
 const where=async id=>{for(const s of ['rail-yours','rail-running','rail-quiet'])if(await page.getByTestId(s).getByTestId(`slot-${id}`).count())return s;return 'none';};
 const drawer=async open=>{if(!mobile)return;
  if(open){if(!(await page.locator('.ah-mobile-open').count())){await page.getByTestId('navigation-open').click();await page.locator('.ah-mobile-open').waitFor();}}
  else if(await page.locator('.ah-mobile-open').count()){await page.keyboard.press('Escape');await page.locator('.ah-mobile-open').waitFor({state:'detached'});}
 };
 const TITLES={nda:'NDA-viestin tarkistus',kuvat:'Etusivun kuvat'};
 const openRow=async id=>{await drawer(true);await page.getByTestId(`slot-${id}`).locator('.ah-nav-link').click();await page.getByTestId('workspace-title').filter({hasText:TITLES[id]}).waitFor();await page.waitForTimeout(50);};
 const banner=page.getByTestId('next-waiting');
 // A real touch drag, so the browser makes touch pointer events.
 const cdp=mobile?await page.context().newCDPSession(page):null;
 const swipe=async(id,dx,mid)=>{
  const box=await page.getByTestId(`slot-${id}`).boundingBox();
  const x0=dx>0?box.x+40:box.x+box.width-40,y=box.y+box.height/2;
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:x0,y}]});
  for(let i=1;i<=10;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x0+i*dx/10,y}]});
  if(mid)await mid();
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await page.waitForTimeout(50);
 };
 const pick=async d=>{
  await page.locator('.proto-picker-item').nth(d).click();
  await page.locator(`.rq-review.variant-${d}`).waitFor({state:'attached'});
  await page.getByTestId('rq-reset').click();
  await page.getByTestId('slot-kuvat').waitFor({state:'attached'});
 };
 for(const d of [0,1,2,3]){
  await pick(d);
  const n=names[d];
  assert.match(await page.getByTestId('direction-lines').locator('li[aria-current]').innerText(),d?/^[ABC] /:/^Nyt: /);checks++;
  // Default: the person has just sent in Kesäajan virhe; Sillä aikaa is open.
  await banner.waitFor();
  assert.equal(await where('kuvat'),'rail-quiet');checks++;
  await fits();await capture(`${n}-0-oletus`);
  if(mobile){await drawer(true);await fits();await capture(`${n}-0-sivupalkki`);await drawer(false);}
  const before=Number(await banner.getAttribute('data-waiting'));
  if(d===0){
   ok(before===1,'Nyt: only the reply waits');
   ok(await page.locator('[data-testid^="raise-"],[data-testid^="row-menu-"]').count()===0,'Nyt: nothing raises');
   await openRow('nda');
   assert.equal(await where('nda'),'rail-quiet');checks++;
   await drawer(true);await capture(`${n}-1-avattu-kuittaa`);await drawer(false);
   continue;
  }
  ok(before===2,`d${d}: the reply and the raised one wait`);
  // Raise Etusivun kuvat.
  if(d===1){
   await drawer(true);
   const slot=page.getByTestId('slot-kuvat');
   if(mobile){
    await swipe('kuvat',120,()=>capture(`${n}-1-pyyhkaisy`));
   }else{
    await slot.hover();await capture(`${n}-1-osoitin`);
    await page.getByTestId('raise-kuvat').click();
   }
  }
  if(d===2){
   await drawer(true);
   await page.getByTestId('slot-kuvat').hover();
   await page.getByTestId('row-menu-kuvat').click();
   await page.getByTestId('menu-raise').waitFor();
   await capture(`${n}-1-valikko`);
   await page.getByTestId('menu-raise').click();
   ok(await page.getByTestId('slot-kuvat').getAttribute('data-raised')==='','B: marked raised');
   ok(await page.getByTestId('rail-yours').locator('.rq-slot').first().getAttribute('data-testid')==='slot-kuvat','B: first in Sinun vuorosi');
  }
  if(d===3){
   await drawer(true);
   await page.getByTestId('raise-pick').click();
   await page.getByTestId('raise-dialog').waitFor();
   await capture(`${n}-1-valinta`);
   await page.getByTestId('pick-kuvat').click();
   await page.getByTestId('raise-done').click();
   await page.getByTestId('raise-dialog').waitFor({state:'detached'});
   ok(await page.getByTestId('raised-group').getByTestId('slot-kuvat').count()===1,'C: in Nostamasi');
  }
  assert.equal(await where('kuvat'),'rail-yours');checks++;
  await fits();await capture(`${n}-2-nostettu`);
  await drawer(false);
  assert.equal(Number(await banner.getAttribute('data-waiting')),3);checks++;
  const said=await banner.innerText();
  ok(said.includes('Etusivun kuvat')||mobile,'banner names it');
  if(d===3)ok(said.includes('2 nostamaasi'),'C: counted apart');
  if(mobile)await capture(`${n}-2-rivi`);
  // Avaa seuraava: A keeps the rail's order, B leads with the raise, C
  // leads with the reply.
  await page.getByTestId('next-open').click();
  const first=d===2?'Etusivun kuvat':'NDA-viestin tarkistus';
  await page.getByTestId('workspace-title').filter({hasText:first}).waitFor();checks++;
  // Leave: A by opening; B and C stay open until Ei nyt or a reply.
  if(d!==2)await openRow('kuvat');
  if(d===1){
   assert.equal(await where('kuvat'),'rail-quiet');checks++;
   await drawer(true);await capture(`${n}-3-avattu-poistuu`);
   // Lowering from Sinun vuorosi.
   if(!mobile){await page.getByTestId('slot-contoso').hover();await page.getByTestId('lower-contoso').click();}
   else await swipe('contoso',-120);
   assert.equal(await where('contoso'),'rail-quiet');checks++;
   await drawer(false);
  }else{
   assert.equal(await where('kuvat'),'rail-yours');checks++;
   await page.getByTestId('raised-note').waitFor();checks++;
   await fits();await capture(`${n}-3-avattu-pysyy`);
   if(d===3){
    await drawer(true);await page.getByTestId('slot-kuvat').hover();await page.getByTestId('unraise-kuvat').click();
    assert.equal(await where('kuvat'),'rail-quiet');checks++;
    await capture(`${n}-4-ei-nyt`);await drawer(false);
   }else{
    await page.getByTestId('note-lower').click();
    assert.equal(await where('kuvat'),'rail-quiet');checks++;
    // The conversation's own ⋯ raises it again.
    await page.getByTestId('rq-conversation-menu').click();
    await page.getByTestId('menu-raise').waitFor();
    await capture(`${n}-4-otsakkeen-valikko`);
    await page.getByTestId('menu-raise').click();
    assert.equal(await where('kuvat'),'rail-yours');checks++;
   }
   // A reply takes it off: the agent works.
   if(d===2){
    const field=page.locator('.ah-cbox-field');
    await field.fill('Jätä ensimmäinen kuva.');await field.press('Enter');
    await page.waitForTimeout(100);
    assert.equal(await where('kuvat'),'rail-running');checks++;
    await fits();await capture(`${n}-5-vastattu`);
   }
  }
 }
 await page.close();
}
}finally{await browser.close();}
assert.deepEqual(errors,[]);
console.log(`ok: ${checks} checkpoints`);
