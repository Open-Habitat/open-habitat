// Synthetic wire inventory reproducing the reporter's mixed wait/process state.
import { openLab, origin, snapshot } from '../../web/lab/session.mjs';
import { readFileSync } from 'node:fs';
const before = process.argv.includes('--before');
for (const width of before ? [1440] : [1440,390]) for (const theme of before ? ['light'] : ['light','dark']) {
 const {browser,page}=await openLab({width:1440,height:1000});
 try {
 await page.request.get(`${origin}/fixture/conversations-reset`);
 const inventory=JSON.parse(readFileSync('contracts/v1/examples/process-inventory.json'));
 const p=inventory.processes[0];p.name='UI-testi-2-minuuttia';p.command_preview='python3 scripts/test.py';p.started_at=Date.now()-38000;
 const runID='01m521vczarx5bkx086n64t1t2';
 inventory.processes.push({...p,id:'done',process_token:'pt_done',name:'UI-testi-30-sekuntia',status:'exited',exit_code:0,ended_at:Date.now()},
 ...['running','exited'].map((status,i)=>({...p,id:`wait_${i}`,process_token:`pt_wait_${i}`,name:`odota-spinoff-${i}`,command_preview:`taskfleet run wait ${runID} --output json`,status,run_ids:[runID],spinoff:[{run_id:runID,title:'UI hidas spinoff',status:'running',landed:false,commit:null}]})));
 await page.route('**/api/v1/conversations/*/processes**',route=>{
  if(route.request().url().endsWith('/clear-finished')) {inventory.processes=inventory.processes.filter(p=>p.status==='running');return route.fulfill({json:{schema_version:1,result:'cleared'}})}
  return route.fulfill({json:inventory});
 });
 await page.route('**/api/v1/agents/pi:*/spinoffs**',route=>route.fulfill({json:{schema_version:1,parent_id:new URL(route.request().url()).pathname.split('/agents/')[1].split('/spinoffs')[0],availability:'available',runs:[{run_id:runID,title:'UI hidas spinoff',created_at:'2026-10-16T10:00:05Z',state:'working',summary:'Synteettinen spinoff jatkaa.',preserved:false,branch:'',worktree:'',source_branch:'main'}],transcripts:[]}}));
 await page.request.get(`${origin}/fixture/scenario?value=ready`);await page.goto(`${origin}/workspaces`);
 await page.evaluate(t=>{document.documentElement.dataset.theme=t;localStorage.setItem('nah:theme',t)},theme);
 await page.getByRole('navigation').getByRole('link',{name:'aurinkokello'}).click();
 await page.getByRole('button',{name:'Aloita uusi Pi-keskustelu'}).click();
 await page.setViewportSize({width,height:1000});
 const tray=page.getByRole('complementary',{name:'Agentin prosessit'});await tray.waitFor();
 const base=`issues/spinoff-process-duplication/${before?'before':width===390?'phone':'desktop'}-${theme}`;
 await settled(page);await snapshot(page,base+'-collapsed');
 await tray.getByRole('button',{name:/Prosessit ·/}).click();
 await settled(page);await snapshot(page,base+'-expanded');
 if(!before) {
 await tray.getByRole('button',{name:/Prosessit ·/}).click();
 await tray.getByRole('button',{name:'Poista päättyneet'}).click();
 await page.waitForFunction(()=>!document.body.textContent.includes('Poista päättyneet'));
 await settled(page);await snapshot(page,base+'-cleared');
 }
 } finally {await page.unrouteAll({behavior:'wait'});await browser.close()}
}
async function settled(page) {
 await page.evaluate(async()=>{await document.fonts.ready;await Promise.all(document.getAnimations().filter(a=>a.effect?.getTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{})));});
}
