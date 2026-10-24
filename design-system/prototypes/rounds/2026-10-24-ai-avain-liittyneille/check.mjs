// node check.mjs <html-or-hosted-url> <evidence-dir>
// Authored synthetic component lab, not a host-backed acceptance test.
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-10-24-ai-avain-liittyneille',names=['Rivillä','AI-avain-sivulla','Molemmat'];
const [input,out]=process.argv.slice(2),hosted=input.startsWith('https:');
mkdirSync(out,{recursive:true});
const NEWKEY='sk-ant-api03-synteettinen-avain-9K3d';
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});let checks=0;const errors=[];
try{
// Desktop, tablet and phone; the 390 px frame is the review's phone toggle.
for(const width of [1440,820,390])for(const theme of ['light','dark']){
 const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 if(hosted)await page.goto(input);else{await page.route('http://prototype.test/**',r=>r.fulfill({contentType:'text/html',body:readFileSync(input,'utf8')}));await page.goto('http://prototype.test/');}
 const f=hosted?page.frameLocator('iframe').first():page;
 const id=x=>f.getByTestId(x).first();
 await f.locator('#theme').selectOption(theme);
 await checkPicker(f,round);
 const key=async value=>{await f.locator('.axis').click();await page.keyboard.press(value);};
 const variant=d=>f.locator(`.shell.variant-${d}`).waitFor();
 await key('3');await variant(2);await key('ArrowRight');await variant(0);await key('2');await variant(1);
 assert.equal(await f.locator('.proto-picker-item[data-active]').innerText(),names[1].replaceAll(' ',' ').replaceAll('-','\u2011'));
 if(width===390)await f.locator('#phone').check();
 await key('1');await variant(0);

 const tag=`${width}-${theme}`;
 const checkpoint=async()=>{assert.equal(await f.locator('.review').evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'document overflow');for(const el of await f.locator('.s-main button:visible,.ah-dialog button:visible').all()){const b=await el.boundingBox();if(b)assert.ok(b.x>=-1&&b.x+b.width<=width+1,`control overflow ${JSON.stringify(b)}`);}checks++;};
 const capture=async(name,full=true)=>{if(hosted)return;await page.screenshot({path:`${out}/ak-${name}-${tag}.png`,fullPage:full});};
 const seg=async(t,label)=>{await id(t).getByRole('button',{name:label,exact:true}).click();};
 const scenario=l=>seg('scenario',l),view=l=>seg('view',l);
 const tab=async t=>{if(await f.locator('.mobiletabs').isVisible())await f.locator('.mobiletabs').getByRole('button',{name:t==='aiavain'?'AI-avain':'Käyttäjät ja pääsy',exact:true}).click();else await id(`nav-${t}`).click();};
 const dialog=()=>f.getByTestId('give-dialog');
 const reviewed=()=>f.locator('[data-testid=give-dialog][data-phase=review]').waitFor();
 const done=()=>f.locator('[data-testid=give-dialog][data-phase=done]').waitFor();
 const close=async()=>{await id('give-cancel').click();await dialog().waitFor({state:'detached'});};
 const checkOf=login=>f.getByTestId(`give-${login}`).getAttribute('data-check');

 // ---- Direction 1: on the person's row ----
 await f.getByTestId('access-list').waitFor();
 for(const i of ['1001','1002','1003','1007'])await id(`access-ai-${i}`).waitFor();
 assert.equal(await f.getByTestId('access-ai-1008').count(),0,'not joined: gets the key at first sign-in');
 assert.equal(await f.getByTestId('access-ai-1009').count(),0,'withdrawn: no key');
 await checkpoint();await capture('users-1');
 await id('access-ai-1002').click();await reviewed();
 assert.equal(await checkOf('aino-v'),'absent');
 const consequences=await id('give-consequences').innerText();
 assert.match(consequences,/Kirjoitat toisen henkilön omiin tunnuksiin/);
 assert.match(consequences,/Kopiota ei voi perua täältä/);
 assert.match(consequences,/Oma avain tai tilaus ei koskaan korvaudu/);
 assert.match(await id('give-confirm').innerText(),/Kirjoita avain @aino-v:n tunnuksiin/);
 await checkpoint();await capture('give-1',false);
 await id('give-confirm').click();await done();
 assert.equal(await f.getByTestId('give-aino-v').getAttribute('data-outcome'),'written');
 await close();
 assert.match(await id('access-ai-given-1002').innerText(),/AI-avain annettu 24\.10\./);
 // A person's own key or subscription is never overwritten.
 await id('access-ai-1003').click();await reviewed();
 assert.equal(await checkOf('mikko-k'),'own');
 assert.equal(await id('give-confirm').isDisabled(),true);
 assert.match(await id('give-effect').innerText(),/Ei koskaan korvata/);
 await checkpoint();if(theme==='light')await capture('own-1',false);
 await close();
 await id('access-ai-1007').click();await reviewed();
 assert.equal(await checkOf('ville-r'),'unknown');assert.equal(await id('give-confirm').isDisabled(),true);
 await close();
 // What Aino sees, and her own key then stays.
 await view('Henkilö: @aino-v');
 assert.equal(await id('person-key').getAttribute('data-kind'),'site');
 assert.match(await id('person-key-desc').innerText(),/Ylläpitäjä antoi sen 24\.10\.[\s\S]*sivuston tililtä/);
 await checkpoint();await capture('person-1');
 await id('person-key-own').click();await id('person-key-input').fill('sk-ant-api03-ainon-oma-avain-0000');await id('person-key-save').click();
 assert.equal(await id('person-key').getAttribute('data-kind'),'own');
 await view('Ylläpitäjä');
 await id('access-ai-1002').click();await reviewed();
 assert.equal(await checkOf('aino-v'),'own','her own key is not overwritten');
 await close();
 // Rotation: the earlier copies are named; the row is where they are renewed.
 await scenario('Avain vaihdettu');await tab('aiavain');
 assert.match(await id('old-copies').innerText(),/2 henkilöllä: @aino-v ja @tuuli-h/);
 await id('go-users').waitFor();
 assert.match(await id('site-key-terms').innerText(),/hänen rivillään Käyttäjät ja pääsy/);
 await checkpoint();await capture('rotated-1');
 await id('site-key-replace').click();await id('site-key-input').fill(NEWKEY);await id('site-key-save').click();
 assert.match(await id('replaced-notice').innerText(),/Aiempi avain annettiin 2 henkilölle: @aino-v ja @tuuli-h/);
 await id('site-key-remove').click();
 assert.match(await id('remove-holders').innerText(),/2 henkilölle: @aino-v ja @tuuli-h\. Kopiot jäävät heille/);
 await checkpoint();if(theme==='dark')await capture('remove-1',false);
 await id('site-key-remove-confirm').click();
 assert.match(await id('removed-notice').innerText(),/2 annettua kopiota jäi/);
 await tab('kayttajat');
 assert.equal(await f.getByTestId('access-ai-1002').count(),0,'no key, nothing to give');

 // ---- Direction 2: on the AI-avain page, many at once ----
 await key('2');await variant(1);await scenario('Avain juuri asetettu');
 await id('joined-card').waitFor();
 assert.match(await id('given-aino-v').innerText(),/Ei annettu/);
 await checkpoint();await capture('page-2');
 await tab('kayttajat');
 assert.equal(await f.getByTestId('access-ai-1002').count(),0,'the act lives on the AI-avain page');
 await tab('aiavain');
 await id('give-all').click();await reviewed();
 for(const [l,c] of [['kaisa-admin','own'],['aino-v','absent'],['mikko-k','own'],['sanna-l','own'],['olli-p','absent'],['tuuli-h','absent'],['ville-r','unknown']])assert.equal(await checkOf(l),c,l);
 assert.equal(await f.locator('[data-testid^=give-pick-]').count(),3,'only writable people can be picked');
 assert.match(await id('give-confirm').innerText(),/3 henkilölle/);
 await id('give-pick-olli-p').click();
 assert.match(await id('give-confirm').innerText(),/2 henkilölle/);
 await checkpoint();await capture('give-2',false);
 await id('give-confirm').click();await done();
 assert.equal(await f.getByTestId('give-olli-p').getAttribute('data-outcome'),null);
 assert.equal(await f.getByTestId('give-tuuli-h').getAttribute('data-outcome'),'written');
 await close();
 assert.match(await id('given-aino-v').innerText(),/Annettu 24\.10\./);
 assert.match(await id('given-olli-p').innerText(),/Ei annettu/);
 await tab('kayttajat');await id('access-ai-given-1006').waitFor();await tab('aiavain');
 // Rotation: the earlier copies are renewed from the page.
 await scenario('Avain vaihdettu');
 assert.match(await id('given-tuuli-h').innerText(),/aiempi avain …m4Pz/);
 await view('Henkilö: @aino-v');
 assert.match(await id('person-key-desc').innerText(),/vaihtanut avaimensa/);
 await checkpoint();if(theme==='dark')await capture('person-stale-2');
 await view('Ylläpitäjä');
 await id('give-old').click();await reviewed();
 assert.equal(await checkOf('aino-v'),'earlier');assert.equal(await checkOf('tuuli-h'),'earlier');
 await id('give-confirm').click();await done();
 assert.equal(await f.getByTestId('give-tuuli-h').getAttribute('data-outcome'),'replaced');
 await close();
 assert.equal(await f.getByTestId('old-copies').count(),0);
 await checkpoint();if(theme==='light')await capture('renewed-2');
 // No key yet: set it first, then give.
 await scenario('Ei avainta');
 assert.equal(await id('give-all').isDisabled(),true);
 await seg('site-key-provider','Anthropic');await id('site-key-input').fill(NEWKEY);await id('site-key-save').click();
 assert.match(await id('set-notice').innerText(),/7 jo liittynyttä eivät saa sitä itsestään/);
 assert.equal(await id('give-all').isDisabled(),false);

 // ---- Direction 3: both, one dialog ----
 await key('3');await variant(2);await scenario('Avain juuri asetettu');
 await id('joined-card').waitFor();
 await tab('kayttajat');await id('access-ai-1005').click();await reviewed();
 assert.equal(await f.locator('[data-testid^=give-pick-]').count(),0,'one person: no picking');
 await id('give-confirm').click();await done();await close();
 await tab('aiavain');
 assert.match(await id('given-olli-p').innerText(),/Annettu 24\.10\./);
 await checkpoint();if(theme==='light')await capture('both-3');
 await page.close();
}
}finally{await browser.close();}
assert.deepEqual(errors,[],'console errors');
writeFileSync(`${out}/${hosted?'ak-hosted-checks':'ak-checks'}.json`,JSON.stringify({round,input:hosted?input:'offline.html',checks,errors},null,1)+'\n');
console.log(`${checks} checkpoints, no console errors`);
