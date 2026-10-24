// node check.mjs <html-or-hosted-url> <evidence-dir>
// Authored synthetic component lab, not a host-backed acceptance test: both
// directions at desktop, tablet and phone width, light and dark, the
// onboarding step with Dropbox and OneDrive on Mac and Windows, and the
// conversation (Liitä menu, inbound line, delivery note, backup missing),
// with the interactions clicked and the console clean.
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-10-24-pilvikansio-silta-r3',names=['Lataukset','Työpöytä'];
const [input,out]=process.argv.slice(2),hosted=input.startsWith('https:');
mkdirSync(out,{recursive:true});
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
let checks=0;const errors=[];
// What each direction should say, by service.
const expect=[
 {pick:{dropbox:'Valitse Lataukset ja Dokumentit.',microsoft:'Valitse Dokumentit.'},pickWin:{dropbox:'Valitse Lataukset, Tiedostot ja Kuvat.',microsoft:'Valitse Tiedostot ja Kuvat.'},
  server:{dropbox:'/Mac/Downloads/',microsoft:'/onedrive/aino@example.test/Documents/'},gap:{dropbox:0,microsoft:1},
  inbound:{dropbox:'Lataukset › myynti-q3.csv',microsoft:'Dokumentit › myynti-q3.csv'},menu:{dropbox:['downloads','documents'],microsoft:['documents']},
  mention:{dropbox:'Katso uusin tiedosto Latauksistani.',microsoft:'Katso uusin tiedosto Dokumenteistani.'}},
 {pick:{dropbox:'Valitse Työpöytä ja Dokumentit.',microsoft:'Valitse Työpöytä ja Dokumentit.'},pickWin:{dropbox:'Valitse Työpöytä, Tiedostot ja Kuvat.',microsoft:'Valitse Työpöytä, Tiedostot ja Kuvat.'},
  server:{dropbox:'/Mac/Desktop/',microsoft:'/onedrive/aino@example.test/Desktop/'},gap:{dropbox:0,microsoft:0},
  inbound:{dropbox:'Työpöytä › Näyttökuva',microsoft:'Työpöytä › Näyttökuva'},menu:{dropbox:['desktop','documents'],microsoft:['desktop','documents']},
  mention:{dropbox:'Katso uusin tiedosto Työpöydältäni.',microsoft:'Katso uusin tiedosto Työpöydältäni.'}},
];
const cloudLabel={dropbox:'Dropbox',microsoft:'OneDrive'};
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
 const seg=async(t,label)=>{await id(t).getByRole('button',{name:label,exact:true}).click();};
 const checkpoint=async()=>{
  assert.equal(await f.locator('body').evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`document overflow at ${width}`);
  for(const el of await f.locator('.shell button:visible, .ah-attachment-popover button:visible').all()){const b=await el.boundingBox();if(b)assert.ok(b.x>=-1&&b.x+b.width<=width+1,`control overflow ${JSON.stringify(b)} at ${width}`);}
  checks++;};
 const shot=async(name,full=true)=>{if(!hosted)await page.screenshot({path:`${out}/${name}-${width}-${theme}.png`,fullPage:full});};
 const connect=async provider=>{await id(`integration-tile-${provider}`).getByTestId('integration-connect-open').click();await id('connect').and(f.locator('[data-connected=true]')).waitFor();};

 for(const d of [0,1]){
  const e=expect[d],n=d+1;
  await key(String(n));await f.locator(`.shell.variant-${d}`).waitFor();
  assert.equal((await f.locator('.proto-picker-item[data-active]').innerText()).replaceAll(' ',' '),names[d]);
  await seg('view','Käyttöönotto');

  // ---- The onboarding step ----
  for(const cloud of ['dropbox','microsoft']){
   await id('restart').click();
   assert.equal(await id('step-title').innerText(),'Onko sinulla henkilökohtainen Dropbox tai OneDrive?');
   await id(`answer-${cloud}`).click();await connect(cloud);
   assert.equal(await id('howto-pick').innerText(),e.pick[cloud]);
   assert.equal(await f.getByTestId('howto-gap').count(),e.gap[cloud],'OneDrive has no Downloads backup');
   assert.equal(await id('step-continue').innerText(),'Jatka kokeilematta');
   if(cloud==='dropbox'){await checkpoint();await shot(`${n}-vaihe-dropbox-mac`);}
   await seg('howto-os','Windows');assert.equal(await id('howto-pick').innerText(),e.pickWin[cloud]);
   assert.match(await id('howto-shot').innerText(),/Win \+ PrtScn/);
   await id('simulate-arrival').click();await id('arrived').waitFor();
   assert.ok((await id('server-dir').innerText()).includes(e.server[cloud]),`server path for ${cloud}`);
   await checkpoint();if(theme==='light'||cloud==='microsoft')await shot(`${n}-vaihe-${cloud}-kokeiltu`);
   await id('step-continue').click();await id('elsewhere').waitFor();
   assert.equal(await id('onboarding-note-cloud').innerText(),`${cloudLabel[cloud]} · kokeiltu`);
  }
  await id('restart').click();await id('answer-no').click();await id('step-continue').click();
  assert.equal(await id('onboarding-note-cloud').innerText(),'Ei pilveä');

  // ---- The conversation ----
  await seg('view','Keskustelu');
  for(const cloud of ['dropbox','microsoft']){
   await seg('cloud',cloudLabel[cloud]);await seg('found','Päällä');
   await id('convo').waitFor();
   // Markdown loads its renderer lazily; shoot only once the reply has rendered.
   await id('convo').locator('.ah-assistant code, code').first().waitFor();
   assert.ok((await id('inbound').innerText()).includes(e.inbound[cloud]),`inbound ${cloud}`);
   assert.equal(await id('delivery-where').innerText(),`Koneellasi: ${cloud==='dropbox'?'Dropbox':'Dokumentit'} › Laskut 10-2026`);
   await checkpoint();if(theme==='light'||cloud==='dropbox')await shot(`${n}-keskustelu-${cloud}`,false);
   await id('attach-file').click();await id('menu-folder').waitFor();
   for(const folder of ['downloads','documents','desktop'])
    assert.equal(await f.getByTestId(`menu-${folder}`).count(),e.menu[cloud].includes(folder)?1:0,`menu ${folder} for ${cloud}`);
   assert.equal(await id('menu-delivery').innerText(),cloud==='dropbox'?'Dropbox':'Dokumentit');
   await checkpoint();await shot(`${n}-liita-${cloud}`,false);
   await id('menu-mention').click();
   assert.equal(await f.locator('.ah-composer textarea').inputValue(),e.mention[cloud]);
   await f.locator('.ah-composer textarea').fill('');
  }
  await seg('found','Ei vielä');
  await id('missing-how').click();await id('missing').getByTestId('howto').waitFor();
  assert.equal(await f.getByTestId('delivery').count(),0);
  await checkpoint();if(theme==='light')await shot(`${n}-ei-varmuuskopiota`,false);
  await id('attach-file').click();await id('menu-missing').waitFor();
  await id('menu-how').click();await id('menu-folder').getByTestId('howto').waitFor();
  await checkpoint();if(theme==='light')await shot(`${n}-liita-ei-varmuuskopiota`,false);
  await page.keyboard.press('Escape');
  await seg('found','Päällä');await seg('cloud','Dropbox');await seg('view','Käyttöönotto');
 }
 // Selection persists across reload.
 assert.equal(await f.locator('body').evaluate(()=>new URL(location.href).searchParams.get('v')),'2');
 await page.close();
}
}finally{await browser.close();}
assert.deepEqual(errors,[],'console clean');
console.log(`ok: ${checks} checkpoints, 3 widths × 2 themes × 2 directions`);
