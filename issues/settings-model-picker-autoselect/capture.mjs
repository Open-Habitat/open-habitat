import { openLab, snapshot } from '../../web/lab/session.mjs';
import { expect } from '../../web/node_modules/@playwright/test/index.mjs';
const {page,browser}=await openLab({width:1440,height:1100});
let catalog=await (await page.request.get(new URL('/api/v1/pi/models',page.url()).href)).json();
catalog.default_provider='openai-codex';catalog.default_model='gpt-6.1-sol';
catalog.models.unshift({provider:'claude-bridge',id:'claude-fable-5-1',name:'Claude Fable 5.1 1M',thinking_levels:['off']});
catalog.models.unshift(catalog.models.splice(catalog.models.findIndex(x=>x.id==='gpt-5.4'),1)[0]);
let claude=false, hold=false, release=()=>{};
await page.route('**/api/v1/pi/claude-login',route=>route.fulfill({json:{schema_version:1,state:claude?'completed':'missing'}}));
await page.route('**/api/v1/pi/models',async route=>{
 if(route.request().method()==='POST') {
  if(hold) await new Promise(resolve=>release=resolve);
  const x=route.request().postDataJSON();catalog={...catalog,default_provider:x.provider,default_model:x.model,default_thinking:x.thinking};
 }
 await route.fulfill({json:catalog});
});
async function agent(){await page.goto(new URL('/settings',page.url()).href);await page.getByRole('button',{name:'Agentit',exact:true}).click();await expect(page.getByRole('radio',{name:/GPT-6.1 Sol/})).toBeChecked();}
const shot=async name=>snapshot(page,'issues/settings-model-picker-autoselect/lab-after-'+name);
await agent(); await expect(page.getByText(/Claude-tilaus ei ole käytettävissä/)).toBeVisible();await shot('unsigned');
claude=true;await page.reload();await page.getByRole('button',{name:'Agentit',exact:true}).click();await expect(page.getByRole('button',{name:'Claude-tilaus',exact:true})).toBeEnabled();await shot('initial');
await page.getByRole('button',{name:'Claude-tilaus',exact:true}).click();await shot('claude');
await page.getByRole('button',{name:'ChatGPT-tilaus',exact:true}).click();await shot('return');
hold=true;await page.getByRole('radio',{name:/GPT-6 Nova/}).click();await expect(page.getByText('Tallennetaan valintaa…')).toBeVisible();await shot('pending');release();await expect(page.getByText('Valinta vahvistettu.')).toBeVisible();await shot('confirmed');
await page.getByRole('button',{name:'Palvelin',exact:true}).click();await expect(page.getByText('Palvelimen versio: 0.0.0-lab')).toBeVisible();await shot('server');
await browser.close();
