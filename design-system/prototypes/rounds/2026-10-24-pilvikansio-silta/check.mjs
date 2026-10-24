// node check.mjs <html-or-hosted-url> <evidence-dir>
// Authored synthetic component lab, not a host-backed acceptance test: every
// direction at desktop, tablet and phone width, light and dark, with its
// interactions clicked and the console clean.
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-10-24-pilvikansio-silta',names=['Aloitus','Liitä','Kortti','Agentti'];
const [input,out]=process.argv.slice(2),hosted=input.startsWith('https:');
mkdirSync(out,{recursive:true});
// The 20 MiB limit the round names is the daemon's upload limit.
assert.match(readFileSync(resolve(here,'../../../../internal/daemon/host-context.md'),'utf8'),/An upload is limited to 20 MiB/);
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
 const scenario=async label=>{await id('scenario').getByRole('button',{name:label,exact:true}).click();};
 const checkpoint=async()=>{
  assert.equal(await f.locator('body').evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`document overflow at ${width}`);
  for(const el of await f.locator('.shell button:visible,.ah-attachment-popover button:visible').all()){const b=await el.boundingBox();if(b)assert.ok(b.x>=-1&&b.x+b.width<=width+1,`control overflow ${JSON.stringify(b)} at ${width}`);}
  checks++;};
 const shot=async(name,full=true)=>{if(!hosted)await page.screenshot({path:`${out}/${name}-${width}-${theme}.png`,fullPage:full});};
 const os=async label=>{await id('howto-os').getByRole('button',{name:label}).click();};

 // ---- 1 Aloitus ----
 await key('1');await variant(0);
 assert.equal(await f.locator('.proto-picker-item[data-active]').innerText(),names[0]);
 assert.equal(await id('onboarding-step-cloud').getAttribute('data-state'),'current');
 assert.equal(await id('onboarding-step-google').getAttribute('data-state'),'skipped');
 assert.match(await id('howto').innerText(),/Finderissa: Dropbox › Open Habitat/);
 assert.match(await id('howto-shot').innerText(),/⇧⌘5/);
 await checkpoint();await shot('1-aloitus');
 await os('Windows');assert.match(await id('howto').innerText(),/Resurssienhallinnassa/);assert.equal(await f.getByTestId('howto-shot').count(),0);
 await os('Puhelin');assert.match(await id('howto-shot').innerText(),/Jaa › Dropbox › Open Habitat/);
 await id('simulate-arrival').click();assert.match(await id('arrived').innerText(),/tuli kansioon/);
 assert.equal(await id('cloud-continue').innerText(),'Jatka AI-tiliin');
 await checkpoint();if(theme==='light')await shot('1-aloitus-kokeiltu');
 await scenario('Ei vielä pilveä');
 assert.equal(await id('cloud-continue').innerText(),'Jatka ilman');
 await checkpoint();if(theme==='light')await shot('1-aloitus-ei-pilvea',false);
 await id('connect-microsoft').click();await id('connecting').waitFor();
 await id('howto').waitFor();assert.match(await id('howto').innerText(),/OneDrive App Storesta[\s\S]*OneDrive › Open Habitat/);
 await os('Windows');assert.match(await id('howto').innerText(),/OneDrive on Windowsissa valmiina/);
 await scenario('Dropbox yhdistetty');

 // ---- 2 Liitä ----
 await key('2');await variant(1);
 await id('attach-file').click();await id('menu-folder').waitFor();
 assert.equal(await id('menu-folder').getAttribute('data-connected'),'true');
 assert.match(await id('attachment-panel').innerText(),/enintään 20 Mt[\s\S]*Dropbox › Open Habitat/);
 await id('menu-how').click();await id('howto').waitFor();
 await checkpoint();await shot('2-liita-valikko',false);
 await id('menu-mention').click();
 assert.equal(await f.locator('.ah-composer textarea').inputValue(),'Katso Dropboxin Open Habitat -kansio.');
 await id('drop-big').click();
 assert.match(await id('big-file').innerText(),/liian suuri liitteeksi \(48 Mt, raja 20 Mt\)[\s\S]*kansioon Dropbox › Open Habitat/);
 await id('big-file').getByRole('button',{name:'Ohje koneelle'}).click();await id('big-file').getByTestId('howto').waitFor();
 await checkpoint();await shot('2-liita-iso');
 await scenario('Ei vielä pilveä');
 await id('attach-file').click();await id('menu-folder').waitFor();
 assert.equal(await id('menu-folder').getAttribute('data-connected'),'false');
 await checkpoint();if(theme==='light')await shot('2-liita-ei-pilvea',false);
 await page.keyboard.press('Escape');await f.getByTestId('attachment-panel').waitFor({state:'detached'});
 await id('drop-big').click();
 await id('big-file').getByRole('button',{name:'Yhdistä OneDrive'}).click();
 assert.match(await id('big-file').innerText(),/kansioon OneDrive › Open Habitat/);
 assert.match(await id('left').innerText(),/OneDrive yhdistetty/);
 await scenario('Dropbox yhdistetty');

 // ---- 3 Kortti ----
 await key('3');await variant(2);
 assert.equal(await id('bridge-card').getAttribute('data-connected'),'true');
 assert.equal(await id('bridge-card').getByTestId('integration-account-dropbox').count(),1,'the production card sits inside the bridge');
 assert.match(await id('bridge-panel').innerText(),/~\/cloud\/dropbox\/aino@example.test\/Open Habitat\//);
 assert.equal(await f.getByTestId('integration-account-google').count(),1,'other accounts stay in the production overview');
 await checkpoint();await shot('3-kortti');
 await id('test-bridge').click();assert.match(await id('bridge-test').innerText(),/Tervetuloa\.txt/);
 await id('test-missing').click();assert.match(await id('test-help').innerText(),/käynnissä koneellasi/);
 await checkpoint();
 await scenario('Ei vielä pilveä');
 assert.equal(await id('bridge-card').getAttribute('data-connected'),'false');
 await checkpoint();if(theme==='light')await shot('3-kortti-ei-pilvea',false);
 await id('connect-microsoft').click();
 assert.equal(await id('bridge-card').getByTestId('integration-account-microsoft').count(),1);
 assert.match(await id('bridge-panel').innerText(),/OneDrive › Open Habitat/);
 await scenario('Dropbox yhdistetty');

 // ---- 4 Agentti ----
 await key('4');await variant(3);
 assert.match(await id('delivery').innerText(),/Koneellesi Dropboxin kautta[\s\S]*Laskut 10-2026[\s\S]*Lasku-1047-Puhelin\.pdf[\s\S]*Dropboxissa klo 10\.42/);
 assert.match(await id('inbound').innerText(),/Koneeltasi Dropboxin kautta/);
 await id('delivery-how').click();await id('delivery').getByTestId('howto').waitFor();
 await checkpoint();await shot('4-agentti');
 await id('attach-file').click();await id('attachment-panel').waitFor();
 assert.equal(await f.getByTestId('menu-folder').count(),0,'outside direction Liitä the menu is production');
 await page.keyboard.press('Escape');
 await scenario('Ei vielä pilveä');
 await id('no-bridge').waitFor();assert.equal(await f.getByTestId('delivery').count(),0);
 await checkpoint();if(theme==='light')await shot('4-agentti-ei-pilvea');
 await id('connect-dropbox').click();assert.match(await id('now-connected').innerText(),/Pyydä uudelleen/);
 await scenario('Dropbox yhdistetty');

 // Selection persists across reload.
 assert.equal(await f.locator('body').evaluate(()=>new URL(location.href).searchParams.get('v')),'4');
 await page.close();
}
}finally{await browser.close();}
assert.deepEqual(errors,[],'console clean');
console.log(`ok: ${checks} checkpoints, 3 widths × 2 themes × 4 directions`);
