import {openLab,origin,snapshot} from '../../web/lab/session.mjs';
import {readFileSync} from 'node:fs';
for(const width of [1440,390]) for(const theme of ['light','dark']){
 const {page,browser}=await openLab();
 try{
 await page.request.get(`${origin}/fixture/conversations-reset`);
 const inventory=JSON.parse(readFileSync('contracts/v1/examples/process-inventory.json'));
 await page.route('**/api/v1/conversations/*/processes',route=>route.fulfill({json:inventory}));
 await page.route('**/api/v1/conversations/*/status**',async route=>{const response=await route.fetch();const body=await response.json();body.state='idle';body.run_active=false;body.native_history='present';body.native_revision='synthetic-process-revision';await route.fulfill({response,json:body})});
 await page.route('**/api/v1/snapshot',async route=>{const response=await route.fetch();const body=await response.json();for(const agent of body.agents){agent.history='readable';agent.process='daemon_managed_live';agent.control='owned';agent.activity='idle';agent.run_active=false}await route.fulfill({response,json:body})});
 await page.route('**/api/v1/agents/pi:*/history**',route=>route.fulfill({json:{schema_version:1,agent_id:new URL(route.request().url()).pathname.split('/agents/')[1].split('/history')[0],native_revision:'synthetic-process-revision',older_complete:true,boundary_found:true,entries:[{entry_key:'done1',kind:'unknown',content:{media_type:'text/plain',text:'',complete:true},blocks:[{type:'process_event',process_event:{kind:'success',process_id:'proc_done',process_name:'haku',command_preview:'',exit_code:0,signal:null,end_reason:'exit',delivery:'wake',run_ids:[]}}]}]}}));
 await page.goto(origin+'/workspaces');await page.getByRole('navigation').getByRole('link',{name:'aurinkokello',exact:true}).click();await page.getByRole('button',{name:'Aloita uusi Pi-keskustelu'}).click();
 await page.getByRole('navigation').getByRole('button',{name:'Päivitä',exact:true}).click();
 await page.getByRole('button',{name:/haku · valmis/}).waitFor();
 await page.setViewportSize({width,height:900});await page.evaluate(t=>{document.documentElement.dataset.theme=t},theme);
 await settledSnapshot(page,`issues/process-ui-fidelity/${width===390?'phone':'desktop'}-${theme}-completion`);
 }finally{await browser.close()}
}

// Do not capture halfway through theme/selection transitions. Native polling stays live.
async function settledSnapshot(page, base) {
 await page.evaluate(async () => {
   await document.fonts.ready;
   await Promise.all(document.getAnimations().filter(animation => animation.effect?.getTiming().iterations !== Infinity).map(animation => animation.finished.catch(() => {})));
 });
 await snapshot(page, base);
}
