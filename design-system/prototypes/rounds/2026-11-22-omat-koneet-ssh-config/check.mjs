// node check.mjs <offline.html> <out-dir> [--quick]
// Authored synthetic component check, not a host-backed acceptance test.
// Every direction × Päivä/Yö/Kontrasti × 1440/390 px at DPR 2, reduced
// motion. Default view (1: found group with five hosts; 2: five config
// machines in the list, unchecked; 3: one line at the top, no machines).
// Then per direction: adopt or pick, check each host and see its result
// (ok, offline through ProxyJump, Tailscale name unresolved, key rejected
// with the missing key file, host key not accepted), hide and unhide, the
// empty and unreadable config, and Habitat's own machine beside them.
// Picker contract, no horizontal overflow, clean console, no network.
// Screenshots are review material, not pixel assertions (--quick: Päivä only).
// PROTO_CHROMIUM may name a Chromium executable.
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-11-22-omat-koneet-ssh-config';
const [input,out,flag]=process.argv.slice(2);
if(!input||!out){console.error('usage: node check.mjs <offline.html> <out-dir> [--quick]');process.exit(2);}
const quick=flag==='--quick';
mkdirSync(out,{recursive:true});
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
const html=readFileSync(input,'utf8');
const names=['ryhma','lista','lapikaynti'];
let checks=0,shots=0;const errors=[];
const ok=(v,m)=>{assert.ok(v,m);checks++;};
const eq=(a,b,m)=>{assert.deepEqual(a,b,m);checks++;};
const settle=page=>page.waitForTimeout(150);

async function open(width,theme){
 const phone=width===390;
 const page=await browser.newPage({viewport:{width,height:phone?844:1000},deviceScaleFactor:2,reducedMotion:'reduce',hasTouch:phone});
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('**/*',r=>{const u=r.request().url();if(u==='http://prototype.test/')return r.fulfill({contentType:'text/html',body:html});if(u.startsWith('data:'))return r.continue();errors.push('unexpected network '+u);return r.abort();});
 await page.goto('http://prototype.test/');
 await page.locator('#theme').selectOption(theme);
 await settle(page);
 return page;
}
const pick=async(page,d)=>{await page.locator('.proto-picker-item').nth(d).click();await page.locator(`.ra-review[data-direction="${d}"]`).waitFor({state:'attached'});await settle(page);};
const shot=async(page,name,full=true)=>{await page.screenshot({path:`${out}/${name}.png`,fullPage:full});shots++;};
const fits=page=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth);
const tid=(page,id)=>page.getByTestId(id);
const machine=(page,a)=>page.locator(`[data-testid="config-machine"][data-machine="${a}"]`);
async function checkHost(page,a,expect){
 await machine(page,a).getByTestId('config-check').click();
 await machine(page,a).locator(`[data-testid="config-check-result"][data-result="${expect}"]`).waitFor();
 eq(await machine(page,a).getAttribute('data-state'),expect,`${a} checked ${expect}`);
}
const expected={nas:'ok',rakennus:'offline',tyokone:'unresolved',pilvi:'key_rejected',vanha:'hostkey_unknown'};

for(const width of [1440,390])for(const theme of quick?['light']:['light','dark','contrast'])for(let d=0;d<3;d++){
 const page=await open(width,theme);
 const tag=`${d+1}-${names[d]}-${theme}-${width}`;
 await pick(page,d);
 await checkPicker(page,round);
 eq(await page.locator('.ra-lines li[aria-current]').count(),1,'one direction line current');
 ok(await tid(page,'own-machines').isVisible(),'production page present');
 // The default view, where the directions differ.
 if(d===0){
  eq(await tid(page,'found-host').count(),5,'five found hosts');
  eq(await tid(page,'config-machine').count(),0,'none adopted yet');
 }else if(d===1){
  eq(await tid(page,'config-machine').count(),5,'five config machines in the list');
  eq(await page.locator('[data-testid="config-machine"][data-state="unchecked"]').count(),5,'nothing checked by itself');
 }else{
  ok(await tid(page,'review-banner').isVisible(),'one line at the top');
  eq(await tid(page,'config-machine').count(),0,'no config machines before the pass');
 }
 ok(await fits(page),'no overflow, default');
 await shot(page,`${tag}-oletus`);
 if(theme!=='light'){await page.close();continue;}
 // The flow per direction.
 if(d===0){
  for(const a of ['nas','rakennus','tyokone','pilvi'])await page.locator(`[data-testid="found-host"][data-host="${a}"]`).getByTestId('found-adopt').click();
  await page.locator('[data-testid="found-host"][data-host="vanha"]').getByTestId('found-hide').click();
  eq(await tid(page,'found-host').count(),0,'all handled');
  ok(await tid(page,'found-none').isVisible(),'handled line');
  eq(await tid(page,'config-machine').count(),4,'four adopted');
  // Adopted machines sit inside production's machine list.
  eq(await page.locator('[data-settings-row="own-machines"] [data-testid="config-machine"]').count(),4,'adopted in the list');
 }else if(d===1){
  await machine(page,'vanha').getByTestId('config-remove').click();
  eq(await tid(page,'config-machine').count(),4,'hidden from the list');
 }else{
  await tid(page,'review-open').click();
  await tid(page,'review-dialog').waitFor();
  ok(await fits(page),'no overflow, dialog');
  await shot(page,`${tag}-dialogi`,false);
  for(const a of ['nas','rakennus','tyokone','pilvi'])await tid(page,`review-pick-${a}`).check();
  await tid(page,'review-done').click();
  await tid(page,'review-dialog').waitFor({state:'detached'});
  eq(await tid(page,'config-machine').count(),4,'four picked');
  ok((await tid(page,'review-banner').textContent()).includes('1 konetta'),'banner counts the one left out');
 }
 for(const a of ['nas','rakennus','tyokone','pilvi'])await checkHost(page,a,expected[a]);
 ok(await page.locator('[data-machine="rakennus"] [data-testid="config-check-result"]').textContent().then(t=>t.includes('nas:n kautta')),'offline names the jump host');
 ok(await page.locator('[data-machine="pilvi"] [data-testid="config-check-result"]').textContent().then(t=>t.includes('pilvi_ed25519')),'rejected names the missing key');
 ok(await fits(page),'no overflow, checked');
 await shot(page,`${tag}-tarkistettu`);
 // The hidden host comes back and shows the host-key state.
 if(d!==2){
  await tid(page,'config-hidden').locator('summary').click();
  await tid(page,'config-unhide').first().click();
  if(d===0)await page.locator('[data-testid="found-host"][data-host="vanha"]').getByTestId('found-adopt').click();
  await checkHost(page,'vanha','hostkey_unknown');
 }
 // Habitat's own machine beside the config ones.
 await tid(page,'world-habitat').selectOption('1');
 await settle(page);
 eq(await page.locator('[data-testid="own-machine"][data-machine="kirjasto-mac"]').count(),1,'Habitat machine present');
 ok(await fits(page),'no overflow, with Habitat machine');
 await shot(page,`${tag}-habitat-kone`);
 // Empty and unreadable config.
 await tid(page,'world-config').selectOption('empty');
 await settle(page);
 eq(await tid(page,'config-machine').count(),0,'empty: no config machines');
 if(d!==2)ok(await tid(page,'config-empty').isVisible(),'empty line');
 else eq(await tid(page,'review-banner').count(),0,'empty: no banner');
 await shot(page,`${tag}-tyhja`);
 await tid(page,'world-config').selectOption('unreadable');
 await settle(page);
 ok(await tid(page,'config-unreadable').isVisible(),'unreadable note');
 await shot(page,`${tag}-ei-luettavissa`);
 await page.close();
}
await browser.close();
eq(errors,[],'clean console, no network');
console.log(`ok: ${checks} checks, ${shots} screenshots in ${out}`);
