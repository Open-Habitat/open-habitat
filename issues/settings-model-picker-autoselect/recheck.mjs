// Re-check on current main (2026-10-17) with a catalog shaped like Jari's live
// 3-takaisin.png: Sol default, an older Luna first, two refused older rows and
// a signed-in Claude. Run from the repository root against a running lab.
import { openLab, snapshot } from '../../web/lab/session.mjs';
import { expect } from '../../web/node_modules/@playwright/test/index.mjs';
const narrow = process.argv.includes('--narrow');
const dark = process.argv.includes('--dark');
const tag = `${narrow ? 'phone' : 'desktop'}-${dark ? 'dark' : 'light'}`;
const {page,browser}=await openLab({width:narrow?390:1440,height:narrow?844:1100});
if (dark) await page.emulateMedia({ colorScheme: 'dark' });
const t=['off','minimal','low','medium','high','xhigh'];
const old='2026-10-16T12:57:00Z';
let catalog={schema_version:1,catalog_status:'native_cached',default_provider:'openai-codex',default_model:'gpt-6.1-sol',default_thinking:'off',models:[
 {provider:'openai-codex',id:'gpt-5.6-luna',name:'GPT-5.6 Luna',older:true,thinking_levels:t},
 {provider:'openai-codex',id:'gpt-5.6-terra',name:'GPT-5.6 Terra',thinking_levels:t},
 {provider:'openai-codex',id:'gpt-6-astra',name:'GPT-6 Astra',outcome:'answered',observed_at:old,thinking_levels:t},
 {provider:'openai-codex',id:'gpt-6-luna',name:'GPT-6 Luna',thinking_levels:t},
 {provider:'openai-codex',id:'gpt-6.1-sol',name:'GPT-6.1 Sol',outcome:'answered',observed_at:old,thinking_levels:t},
 {provider:'openai-codex',id:'gpt-5.3-codex-spark',name:'GPT-5.3 Codex Spark',older:true,outcome:'refused',observed_at:new Date(Date.now()-3600e3).toISOString(),thinking_levels:t},
 {provider:'openai-codex',id:'gpt-5.5',name:'GPT-5.5',older:true,outcome:'refused',observed_at:new Date(Date.now()-7200e3).toISOString(),thinking_levels:t},
 {provider:'openai-codex',id:'gpt-5.6-sol',name:'GPT-5.6 Sol',older:true,thinking_levels:t},
 {provider:'openai-codex',id:'gpt-6-sol',name:'GPT-6 Sol',older:true,thinking_levels:t},
 {provider:'claude-bridge',id:'claude-fable-5-1',name:'Claude Fable 5.1 1M',thinking_levels:['off']},
]};
const posts=[];
await page.route('**/api/v1/pi/claude-login',route=>route.fulfill({json:{schema_version:1,state:'completed'}}));
await page.route('**/api/v1/pi/models',async route=>{
 if(route.request().method()==='POST'){posts.push(route.request().postDataJSON());}
 await route.fulfill({json:catalog});
});
await page.goto(new URL('/settings',page.url()).href);
await page.getByRole('button',{name:'Agentit',exact:true}).click();
const sol=page.getByRole('radio',{name:/GPT-6.1 Sol/});
await expect(sol).toBeChecked();
await expect(page.getByRole('heading',{name:'Pi',exact:true})).toHaveCount(0);
const older=page.locator('details.md-more');
const shot=async name=>snapshot(page,`issues/settings-model-picker-autoselect/recheck-${tag}-${name}`);
await shot('initial');
for (let round=0; round<3; round++) {
 await page.getByRole('button',{name:'Claude-tilaus',exact:true}).click();
 await expect(page.getByRole('radio',{name:/Claude Fable/})).not.toBeChecked();
 if (round===0) await shot('claude');
 await page.getByRole('button',{name:'API-avain',exact:true}).click().catch(()=>{});
 await page.getByRole('button',{name:'ChatGPT-tilaus',exact:true}).click();
 await expect(sol).toBeChecked();
 await expect(older).not.toHaveAttribute('open','');
}
await shot('return');
const focused=await page.evaluate(()=>document.activeElement?.closest('details')?'inside older':'elsewhere');
console.log(JSON.stringify({tag,posts:posts.length,focus:focused,olderOpen:await older.evaluate(d=>d.open)}));
if (posts.length) throw new Error('provider browsing wrote a default');
await browser.close();
