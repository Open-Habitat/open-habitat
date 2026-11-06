// node check.mjs <offline.html> <evidence-dir>
// Authored synthetic component lab, not a host-backed acceptance test. Walks
// every direction light, dark and at 390 px through the administrator's
// list, the person's level choice and the account card, clicks the flows,
// asserts the content each direction must show, and writes screenshots at
// scale 2 (light at both widths, dark at 1440).
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-11-06-integraatiotasot';
const [input,out]=process.argv.slice(2);
mkdirSync(out,{recursive:true});
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
let checks=0;const errors=[];
try{
for(const width of [1440,390])for(const theme of ['light','dark']){
 const page=await browser.newPage({viewport:{width,height:1000},deviceScaleFactor:2,reducedMotion:'reduce'});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('http://prototype.test/**',r=>r.fulfill({contentType:'text/html',body:readFileSync(input,'utf8')}));
 await page.goto('http://prototype.test/');
 await page.locator('#theme').selectOption(theme);
 await checkPicker(page,round);
 if(width===390)await page.locator('#phone').check();
 const tag=`${width}-${theme}`,keep=theme==='light'||width===1440;
 const capture=async(name,full=true)=>{if(keep)await page.screenshot({path:`${out}/${name}-${tag}.png`,fullPage:full});};
 const fits=async()=>{assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'document overflow');checks++;};
 const pick=async i=>{await page.locator('.proto-picker-item').nth(i).click();await page.locator(`.shell.variant-${i}`).waitFor();};
 const seg=async(t,label)=>{await page.getByTestId(t).getByRole('button',{name:label,exact:true}).click();};
 const id=x=>page.getByTestId(x).first();
 const text=async x=>(await id(x).innerText()).replace(/\s+/g,' ');

 for(const d of [0,1,2,3]){
  await pick(d);
  await id('reset').click();
  assert.match(await id('direction-lines').locator('li[aria-current]').innerText(),[/^Nyt/,/^Neljä tasoa/,/^Ruudukko/,/^Pohja ja poikkeukset/][d]);
  // Administrator's list: every level says what it allows, except today.
  await seg('view','Ylläpitäjä: palvelinintegraatiot');
  const admin=await text('admin-list');
  if(d===0){assert.match(admin,/Taso: Luonnokset, ei lähetystä/);assert.doesNotMatch(admin,/Sallii/);}
  if(d===1){assert.match(await text('level-microsoft-nosend'),/Taso: Kaikki paitsi postin lähetys.*Sallii:.*Ei salli: postin lähetys.*Ei voi estää: osallistujat saavat aina kutsun · tiedostolle voi luoda jakolinkin/);
   assert.match(await text('level-microsoft-drafts'),/Ei salli:.*tapahtumien luonti ja muutos/);
   assert.match(await text('level-dropbox-nosend'),/Kaikki paitsi jakaminen.*Ei salli: jakaminen ja linkit/);}
  if(d===2){assert.match(await text('level-microsoft-nosend'),/Kaikki paitsi postin lähetys/);await id('combo-nosend').waitFor();await id('cap-google').waitFor();}
  if(d===3){assert.match(await text('level-microsoft-nosend'),/Vain luku \+ posti luonnoksina, kalenteri muokattavissa, yhteystiedot muokattavissa, tiedostot muokattavissa/);
   assert.match(await text('level-microsoft-drafts'),/Ei: postin lähetys/);}
  await fits();await capture(`d${d}-yllapitaja`);
  // Set the missing drafts credentials.
  await id('set-microsoft-drafts').click();await id('set-dialog').waitFor();
  if(d===1)await capture('d1-aseta-tunnukset',false);
  await id('set-confirm').click();await id('set-dialog').waitFor({state:'detached'});
  assert.match(await text('level-microsoft-drafts'),/Tarjolla/);

  // The person's choice.
  await seg('view','Henkilö: tason valinta');
  await seg('provider','Microsoft 365');
  if(d===0){assert.match(await text('card-drafts'),/Luonnokset, ei lähetystä.*Outlook-kalenteri.*Vain luku/);}
  if(d===1){assert.match(await text('card-nosend'),/Ei käytössä tällä palvelimella/);
   assert.match(await text('card-full'),/Jos tapahtumassa on osallistujia, Microsoft lähettää heille aina kutsun/);
   assert.match(await text('card-drafts'),/Outlook-kalenteri.*Ei luo eikä muuta tapahtumia/);}
  if(d===2){assert.match(await text('grid-match'),/Tätä yhdistelmää ei ole tällä palvelimella.*Lähin suppeampi on Luonnokset, muu vain luku/);}
  if(d===3){assert.match(await text('base-sentence'),/Lisäksi: posti luonnoksina, kalenteri muokattavissa/);assert.match(await text('base-match'),/Palvelimella ei ole tätä yhdistelmää/);}
  await fits();await capture(`d${d}-valinta-microsoft`);
  if(d===2){await id('cell-calendar-read').click();await id('cell-contacts-read').click();await id('cell-files-read').click();
   assert.match(await text('grid-match'),/Palvelimella on tämä yhdistelmä \(Luonnokset, muu vain luku\)/);}
  if(d===3){await page.getByTestId('exc-calendar-full').click();await page.getByTestId('exc-contacts-edit').click();await page.getByTestId('exc-files-full').click();
   assert.equal(await page.getByTestId('base-match').count(),0);assert.match(await text('base-sentence'),/Lisäksi: posti luonnoksina\. Ei:/);}
  if(d===1)await page.getByTestId('card-drafts').click();
  await seg('provider','Google');
  if(d===1||d===0)assert.match(await text('card-drafts'),/Gmail/);
  if(d===2)assert.match(await text('choice-grid'),/Muuttaa ja lähettää/);
  if(d===3)assert.match(await text('exceptions'),/Gmailissa jokainen muutosoikeus antaa myös lähetysoikeuden/);
  await fits();await capture(`d${d}-valinta-google`);
  await seg('provider','Dropbox');
  if(d===1)assert.match(await text('card-nosend'),/Ei jaa tiedostoja eikä luo linkkejä/);
  if(d===2)assert.match(await text('grid-match'),/Dropbox kysyy kirjautuessa juuri nämä oikeudet/);
  await fits();await capture(`d${d}-valinta-dropbox`);

  // The account card follows the choice.
  await seg('view','Henkilö: tili');
  await seg('provider','Microsoft 365');
  const lv=await text('account-level');
  assert.match(lv,[/Luonnokset, ei lähetystä/,/Luonnokset, muu vain luku/,/Luonnokset, muu vain luku/,/Vain luku \+ 1 poikkeus/][d]);
  if(d===3)assert.match(await text('account-sentence'),/posti luonnoksina/);
  await fits();await capture(`d${d}-tili`);
  await seg('view','Ylläpitäjä: palvelinintegraatiot');
 }
 await page.close();
}
}finally{await browser.close();}
assert.deepEqual(errors,[]);
console.log(`ok: ${checks} checkpoints`);
