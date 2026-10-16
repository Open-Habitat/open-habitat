import { openLab, origin, snapshot } from '../../web/lab/session.mjs';
import { readFileSync } from 'node:fs';
const before = process.argv.includes('--before');
for (const width of before ? [1440] : [1440,390]) for (const theme of before ? ['light'] : ['light','dark']) {
 const {browser,page}=await openLab({width:1440,height:900});
 try {
 await page.request.get(`${origin}/fixture/conversations-reset`);
 const inventory=JSON.parse(readFileSync('contracts/v1/examples/process-inventory.json'));
 const p=inventory.processes[0]; p.name='viiden-sekunnin-demo';p.command_preview="printf 'Demo alkaa\\n'; sleep 5; printf 'Demo valmis\\n'";p.started_at=Date.now()-5000;p.ended_at=Date.now();p.status='exited';p.exit_code=0;
 await page.route('**/api/v1/conversations/*/processes**', route=>route.fulfill({json:route.request().url().includes('/output?')?{...JSON.parse(readFileSync('contracts/v1/examples/process-output.json')),lines:[{stream:'stdout',text:'Demo alkaa'},{stream:'stdout',text:'Demo valmis'}]}:inventory}));
 await page.request.get(`${origin}/fixture/scenario?value=ready`);await page.goto(`${origin}/workspaces`);
 await page.evaluate(t=>{document.documentElement.dataset.theme=t;localStorage.setItem('nah:theme',t)},theme);
 await page.getByRole('navigation').getByRole('link',{name:'aurinkokello'}).click();
 await page.getByRole('button',{name:'Aloita uusi Pi-keskustelu'}).click();
 await page.setViewportSize({width,height:900});
 const tray=page.getByRole('complementary',{name:'Agentin prosessit'});await tray.waitFor();
 const base=`issues/process-ui-fidelity/${before?'before':width===390?'phone':'desktop'}-${theme}`;
 await settledSnapshot(page,base+'-bar');
 await tray.getByRole('button',{name:/Prosessit ·/}).click();
 await settledSnapshot(page,base+'-list');
 await tray.getByRole('button',{name:'viiden-sekunnin-demo'}).click();
 await tray.getByText('Demo valmis',{exact:true}).waitFor();
 await settledSnapshot(page,base+'-output');
 if(!before) {
   p.status='running';p.ended_at=null;p.exit_code=null;p.name='testit';p.command_preview='ptw tests/ -- -q';
   await page.waitForFunction(()=>document.querySelector('.ah-process-name')?.textContent==='testit');
   await settledSnapshot(page,base+'-running');
   await tray.getByRole('button',{name:'Pysäytä seuraaminen'}).click();
   await settledSnapshot(page,base+'-paused');
   p.status='terminate_timeout';
   await tray.getByRole('button',{name:'Pakota lopetus'}).waitFor();
   await settledSnapshot(page,base+'-stop-timeout');
 }
 
 } finally {await browser.close()}
}

// Do not capture halfway through theme/selection transitions. Native polling stays live.
async function settledSnapshot(page, base) {
 await page.evaluate(async () => {
   await document.fonts.ready;
   await Promise.all(document.getAnimations().filter(animation => animation.effect?.getTiming().iterations !== Infinity).map(animation => animation.finished.catch(() => {})));
 });
 await snapshot(page, base);
}
