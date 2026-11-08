// node check.mjs <offline.html> <evidence-dir>
// Authored synthetic component lab, not a host-backed acceptance test. For
// "Nyt" (production WorktreeCleanup unchanged, the same rows served as the
// host's listing) and each direction, at 1440 px and 390 px (touch), light
// and dark, device scale factor 2, named r1-<direction>-<step>-<width>-<theme>:
//   0-oletus   the default view, scrolled to the Worktreet section;
//   1-auki     everything opened: 1's other rows and a row's Git facts,
//              2's closed group and a row's Git facts, 3's Näytä kaikki;
//   2-poista   the production removal dialog for the leftover;
//   3-poistettu after removing it (the status line says what stayed).
// It asserts what each direction promises on its default view: Nyt shows the
// production run wording and a disabled Siivoa; 1 shows only the two rows
// that need the person; 2 groups by conversation with the self-releasing
// group closed; 3 shows sentences and no rows. The console must stay clean
// and nothing may overflow sideways.
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-11-08-worktree-lista';
const [input,out]=process.argv.slice(2);
mkdirSync(out,{recursive:true});
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
const names=['0-nyt','1-huomio','2-keskustelut','3-yhteenveto'];
let checks=0;const errors=[];
const ok=(v,m)=>{assert.ok(v,m);checks++;};
const runs=[{width:1440,theme:'light'},{width:1440,theme:'dark'},{width:390,theme:'light'},{width:390,theme:'dark'}];
try{
for(const {width,theme} of runs){
 const mobile=width===390,H=mobile?844:900;
 const page=await browser.newPage({viewport:{width,height:H},deviceScaleFactor:2,reducedMotion:'reduce',isMobile:mobile,hasTouch:mobile});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('http://prototype.test/**',r=>r.fulfill({contentType:'text/html',body:readFileSync(input,'utf8')}));
 await page.goto('http://prototype.test/');
 await page.locator('#theme').selectOption(theme);
 await checkPicker(page,round);
 const tag=`${width}-${theme}`;
 const fits=async()=>ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'document overflow');
 const press=async(loc)=>{await loc.scrollIntoViewIfNeeded();await (mobile?loc.tap():loc.click());};
 for(const d of [0,1,2,3]){
  await page.locator('.proto-picker-item').nth(d).click();
  await page.locator(`.rq-review.variant-${d}`).waitFor({state:'attached'});
  const section=page.locator(d?'[data-testid="wl-section"]':'[data-testid="worktrees"]');
  await section.waitFor();checks++;
  const top=async()=>section.evaluate(el=>{const s=el.closest('.wl-page');s.scrollTop+=el.getBoundingClientRect().top-s.getBoundingClientRect().top-12;});
  const shot=async(step)=>{await page.waitForTimeout(250);await fits();await page.screenshot({path:`${out}/r1-${names[d]}-${step}-${tag}.png`});};
  assert.match(await page.getByTestId('direction-lines').locator('li[aria-current]').innerText(),new RegExp(`^${d?d+' ':'Nyt'}`));checks++;
  const rows=section.getByTestId(d?'wl-row':/^worktree-row-/);
  if(d===0){
   await page.getByTestId('worktree-row-wt-d0qmfx5v37-testaaja').waitFor();checks++;
   ok(await page.locator('.ah-trash-row').count()===5,'production lists all five');
   ok(/Taskfleet-ajo 01m6y4rzfh5yk0j6d0qmfx5v37 omistaa/.test(await section.innerText()),'production says a run owns it');
   ok(await page.getByTestId('cleanup-worktrees').isDisabled(),'Siivoa is disabled');
  }
  if(d===1){
   ok(await rows.count()===2,'only the two rows that need the person');
   ok(/2 muuta|3 muuta/.test(await page.getByTestId('wl-rest').innerText()),'the rest is one line');
  }
  if(d===2){
   ok(await section.getByTestId('wl-group').count()===3,'three conversations');
   ok(await section.locator('[data-testid="wl-group"]:not([data-open])').count()===1,'the self-releasing group is closed');
   ok(await rows.count()===4,'four rows in the open groups');
  }
  if(d===3){
   ok(await rows.count()===0,'no rows by default');
   ok(await section.getByTestId('wl-sentence').count()===4,'four sentences');
  }
  await top();
  await shot('0-oletus');
  // Everything opened.
  if(d===1){
   await press(page.getByTestId('wl-rest'));
   ok(await rows.count()===5,'all five after opening');
   await press(section.getByTestId('wl-git-toggle').first());
   await section.getByTestId('wl-git').waitFor();checks++;
  }
  if(d===2){
   await press(section.locator('[data-testid="wl-group"]:not([data-open]) .wl-group-toggle'));
   ok(await rows.count()===5,'all five after opening the group');
   await press(section.getByTestId('wl-git-toggle').nth(2));
   await section.getByTestId('wl-git').waitFor();checks++;
  }
  if(d===3){
   await press(page.getByTestId('wl-all'));
   ok(await section.getByTestId('wl-table').getByTestId('wl-row').count()===5,'Näytä kaikki lists five');
  }
  if(d){
   await top();
   await shot('1-auki');
   const open=section.getByTestId('wl-open').first();
   await press(open);
   ok(/Palauttaisi keskustelun Avustajien kokeilu|Avaisi keskustelun/.test(await page.getByTestId('wl-status').innerText()),'the row leads to its conversation');
  }
  // Remove the leftover through production's dialog.
  await press(d?section.getByTestId('wl-remove'):page.getByTestId('worktree-remove'));
  await page.getByTestId('confirm-worktree').waitFor();checks++;
  await shot('2-poista');
  await press(page.getByTestId('confirm-worktree'));
  await page.getByTestId('confirm-worktree').waitFor({state:'detached'});checks++;
  await page.locator('[role="status"]',{hasText:'säilyy'}).waitFor();checks++;
  await top();
  await shot('3-poistettu');
 }
 await page.close();
}
}finally{await browser.close();}
assert.deepEqual(errors,[]);
console.log(`ok: ${checks} checkpoints`);
