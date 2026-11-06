// node check.mjs <offline.html> <evidence-dir>
// Authored synthetic component lab, not a host-backed acceptance test. Walks
// every riff light and dark at 1440 and 390 px through the administrator's
// list, the person's level choice and the account card, clicks the flows,
// asserts that a missing permission always reads as a cross and a negative
// word, that the administrator's list never stacks grids, and writes
// screenshots at scale 2 named r2-d<riff>-<view>-<width>-<theme>.
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-11-06-integraatiotasot-2';
const [input,out]=process.argv.slice(2);
mkdirSync(out,{recursive:true});
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
let checks=0;const errors=[];
// The main views in all four combinations, the rest light at both widths and dark at 1440.
const always=new Set(['yllapitaja','valinta-microsoft']);
try{
for(const width of [1440,390])for(const theme of ['light','dark']){
 const page=await browser.newPage({viewport:{width,height:1000},deviceScaleFactor:2,reducedMotion:'reduce'});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('http://prototype.test/**',r=>r.fulfill({contentType:'text/html',body:readFileSync(input,'utf8')}));
 await page.goto('http://prototype.test/');
 await page.locator('#theme').selectOption(theme);
 await checkPicker(page,round);
 if(width===390)await page.locator('#phone').check();
 const tag=`${width}-${theme}`;
 const capture=async(d,name,full=true)=>{if(always.has(name)||theme==='light'||width===1440)await page.screenshot({path:`${out}/r2-d${d+1}-${name}-${tag}.png`,fullPage:full});};
 const fits=async()=>{assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'document overflow');checks++;};
 const pick=async i=>{await page.locator('.proto-picker-item').nth(i).click();await page.locator(`.shell.variant-${i}`).waitFor();};
 const seg=async(t,label)=>{await page.getByTestId(t).getByRole('button',{name:label,exact:true}).click();};
 const id=x=>page.getByTestId(x).first();
 const text=async x=>(await id(x).innerText()).replace(/\s+/g,' ').trim();
 const eq=(a,b,m)=>{assert.equal(a,b,m);checks++;};
 const match=(a,re,m)=>{assert.match(a,re,m);checks++;};
 // Every cell without the permission, anywhere on screen, says so in words.
 const noGreySame=async()=>{
  for(const t of await page.locator('[data-on="no"]').allInnerTexts())match(t.replace(/\s+/g,' ').trim(),/^Ei\b/,'off cell must start with Ei');
  for(const t of await page.locator('[data-on="yes"]').allInnerTexts())assert.doesNotMatch(t,/^Ei\b/);
 };
 // A grid cell: its state and words.
 const cell=async(scope,key)=>{const c=page.getByTestId(scope).getByTestId(key);return {on:await c.getAttribute('data-on'),t:(await c.innerText()).replace(/\s+/g,' ').trim()};};
 // A comparison cell: row testid × level column index.
 const cmp=async(scope,row,col)=>(await page.getByTestId(scope).getByTestId(row).locator('td').nth(col).innerText()).replace(/\s+/g,' ').trim();

 for(const d of [0,1,2]){
  await pick(d);
  await id('reset').click();
  match(await id('direction-lines').locator('li[aria-current]').innerText(),[/^Vertailutaulukko/,/^Avautuva ruudukko/,/^Erillinen ikkuna/][d]);

  // ---- Administrator ----
  await seg('view','Ylläpitäjä: palvelinintegraatiot');
  const grids=await page.getByTestId('admin-list').locator('.il-grid').count();
  if(d===0){
   eq(grids,0,'the table riff has no grids in the list');
   // Microsoft columns: Täysi, Kaikki paitsi postin lähetys, Luonnokset, Vain luku.
   eq(await cmp('cmp-microsoft','row-mail-full',0),'Kyllä');
   eq(await cmp('cmp-microsoft','row-mail-full',1),'Ei');
   eq(await cmp('cmp-microsoft','row-calendar-full',1),'Kyllä');
   eq(await cmp('cmp-microsoft','row-calendar-full',2),'Ei');
   match(await text('cmp-microsoft'),/Osallistujat saavat aina kutsun/);
   match(await text('cmp-microsoft'),/Jakolinkki voi avautua kenelle tahansa/);
   eq(await page.getByTestId('cmp-google').getByTestId('col-drafts').count(),0,'Google offers no drafts level');
   match(await text('compare-google'),/Gmailissa jokainen muutosoikeus/);
   eq(await cmp('cmp-dropbox','row-files-full',1),'Ei');
   eq(await cmp('cmp-dropbox','row-files-read',2),'Vain sovelluskansio');
   eq(await page.getByTestId('level-microsoft-nosend').locator('.il-sum').count(),0,'table riff rows are one line');
  }
  if(d===1){
   eq(grids,1,'exactly one grid open');
   const g=await cell('grid-microsoft-nosend','cell-mail-full');eq(g.on,'no');eq(g.t,'Ei lähetä');
   match((await cell('grid-microsoft-nosend','cell-calendar-full')).t,/Muokkaa tapahtumia Osallistujat saavat aina kutsun/);
  }
  if(d===2){eq(grids,0,'the window riff keeps the list compact');match(await text('level-microsoft-nosend'),/Kuten Täysi, mutta posti jää luonnoksiksi/);}
  await noGreySame();
  await fits();await capture(d,'yllapitaja');
  if(d===1){
   await id('open-microsoft-drafts').click();
   eq(await page.getByTestId('admin-list').locator('.il-grid').count(),1,'opening another closes the first');
   const g=await cell('grid-microsoft-drafts','cell-calendar-full');eq(g.on,'no');eq(g.t,'Ei muokkaa eikä lähetä kutsuja');
   eq((await cell('grid-microsoft-drafts','cell-files-full')).t,'Ei muokkaa eikä jaa');
   eq(await id('open-microsoft-drafts').getAttribute('aria-expanded'),'true');
   await noGreySame();await fits();await capture(d,'yllapitaja-luonnokset');
  }
  if(d===2){
   await id('window-microsoft-nosend').click();await id('grid-window').waitFor();
   eq((await cell('window-grid','cell-mail-full')).t,'Ei lähetä');
   await noGreySame();await capture(d,'ikkuna',false);
   await seg('window-level','Luonnokset, muu vain luku');
   eq((await cell('window-grid','cell-calendar-full')).on,'no');
   match(await text('grid-window'),/Tällä tasolla ei ole vielä tunnuksia/);
   await capture(d,'ikkuna-luonnokset',false);
   await id('window-set').click();await id('set-dialog').waitFor();
  }else{
   await id('set-microsoft-drafts').click();await id('set-dialog').waitFor();
  }
  eq((await cell('set-grid','cell-mail-full')).t,'Ei lähetä');
  await capture(d,'aseta-tunnukset',false);
  await id('set-confirm').click();await id('set-dialog').waitFor({state:'detached'});
  match(await text('level-microsoft-drafts'),/Tarjolla/);

  // ---- The person's choice ----
  await seg('view','Henkilö: tason valinta');
  await seg('provider','Microsoft 365');
  if(d===0){
   match(await text('chosen'),/Valittu: Luonnokset, muu vain luku/);
   eq(await id('pick-nosend').isDisabled(),true,'no credentials, no choice');
   match(await text('col-nosend'),/Ei käytössä/);
   eq(await cmp('choice-compare','row-mail-drafts',3),'Ei');
  }
  if(d===1){eq((await cell('choice-grid','cell-mail-full')).t,'Ei lähetä');eq(await page.getByTestId('card-grid').count(),1);}
  if(d===2)await id('open-window').waitFor();
  await noGreySame();await fits();await capture(d,'valinta-microsoft');
  if(d===0){await id('pick-full').click();match(await text('chosen'),/Valittu: Täysi/);eq(await id('pick-full').getAttribute('aria-pressed'),'true');await id('pick-drafts').click();}
  if(d===1){await id('card-read').click();eq(await page.getByTestId('card-read').getByTestId('card-grid').count(),1);eq((await cell('choice-grid','cell-mail-drafts')).on,'no');}
  if(d===2){
   await id('open-window').click();await id('grid-window').waitFor();
   await seg('window-level','Kaikki paitsi postin lähetys');
   eq(await id('window-choose').isDisabled(),true,'no credentials, no choice');
   await capture(d,'valinta-ikkuna',false);
   await seg('window-level','Täysi');await id('window-choose').click();await id('grid-window').waitFor({state:'detached'});
   eq(await page.getByTestId('card-full').getAttribute('data-selected'),'true');
  }
  await seg('provider','Google');
  if(d===0){eq(await page.getByTestId('choice-compare').getByTestId('col-drafts').count(),0);match(await text('choice'),/Gmailissa jokainen muutosoikeus/);eq(await cmp('choice-compare','row-mail-full',1),'Ei');}
  if(d===1)eq((await cell('choice-grid','cell-mail-full')).t,'Ei muuta eikä lähetä');
  if(d===2)match(await text('card-drafts'),/Gmailissa jokainen muutosoikeus/);
  await noGreySame();await fits();await capture(d,'valinta-google');
  await seg('provider','Dropbox');
  if(d===0){match(await text('col-app'),/Ei käytössä/);eq(await cmp('choice-compare','row-files-full',1),'Ei');}
  if(d===1){const g=await cell('choice-grid','cell-files-full');eq(g.t,'Ei jaa');eq((await cell('choice-grid','cell-files-edit')).on,'yes');}
  await noGreySame();await fits();await capture(d,'valinta-dropbox');

  // ---- The account card follows the choice ----
  await seg('view','Henkilö: tili');
  await seg('provider','Microsoft 365');
  match(await text('account-level'),[/Luonnokset, muu vain luku/,/Vain luku/,/Täysi/][d]);
  if(d===0){eq(await cmp('account-compare','row-mail-full',0),'Ei');eq(await cmp('account-compare','row-mail-drafts',0),'Kyllä');}
  if(d===1){await id('account-open').click();eq((await cell('account-grid','cell-mail-drafts')).t,'Ei järjestele eikä luonnostele');}
  if(d===2){await id('account-window').click();await id('grid-window').waitFor();eq((await cell('window-grid','cell-mail-full')).on,'yes');}
  await noGreySame();await fits();await capture(d,'tili',d!==2);
  if(d===2){await page.keyboard.press('Escape');await id('grid-window').waitFor({state:'detached'});}
  await seg('view','Ylläpitäjä: palvelinintegraatiot');
 }
 await page.close();
}
}finally{await browser.close();}
assert.deepEqual(errors,[]);
console.log(`ok: ${checks} checkpoints`);
