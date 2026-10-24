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
const round='2026-10-24-apple-icloud',names=['Kaikki kerralla','Valitse palvelut','Yleiset kortit'];
const [input,out]=process.argv.slice(2),hosted=input.startsWith('https:');
mkdirSync(out,{recursive:true});
const PW='abcd-efgh-ijkl-mnop',ID='aino.virtanen@icloud.com',OTHER='aino@virtanen.example';
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});let checks=0;const errors=[];
try{
for(const width of [1440,390])for(const theme of ['light','dark']){
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
 assert.equal(await f.locator('.proto-picker-item[data-active]').innerText(),names[1].replaceAll(' ','\u00a0'));
 if(width===390)await f.locator('#phone').check();
 await key('1');await variant(0);

 const checkpoint=async()=>{assert.equal(await f.locator('.review').evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'document overflow');for(const el of await f.locator('.s-main button:visible,.ah-dialog button:visible').all()){const b=await el.boundingBox();if(b)assert.ok(b.x>=-1&&b.x+b.width<=width+1,`control overflow ${JSON.stringify(b)}`);}checks++;};
 const capture=async(name,full=true)=>{if(hosted)return;await page.screenshot({path:`${out}/ap-${name}-${width}-${theme}.png`,fullPage:full});};
 const scenario=async label=>{await id('scenario').getByRole('button',{name:label,exact:true}).click();};
 const step=async s=>{await f.locator(`[data-testid=guide][data-step=${s}]`).waitFor();};
 const closed=()=>f.getByTestId('guide').waitFor({state:'detached'});

 // The guide's content, the same in every direction (Apple's documented steps).
 const howTo=async()=>{
  const t=await id('how').innerText();
  assert.match(t,/account\.apple\.com/);assert.match(t,/Sign-In and Security › App-Specific Passwords/);
  assert.match(t,/Generate an app-specific password/);assert.match(t,/Open Habitat/);
  assert.equal(await id('apple-link').getAttribute('href'),'https://account.apple.com');
  assert.match(await id('twofa').innerText(),/kaksivaiheisen tunnistuksen[\s\S]*Apple-tilin salasanan/);
 };

 // ---- Direction 1: all three at once ----
 assert.equal(await f.getByTestId('apple-card').count(),0);
 assert.deepEqual(await f.locator('[data-testid=generic-tiles] [data-testid^=tile-]').evaluateAll(es=>es.map(e=>e.dataset.testid)),['tile-imap','tile-caldav','tile-carddav'],'generic tiles stay');
 await id('apple-open').click();await step('password');
 assert.match(await id('stepname').innerText(),/1\/2\s+Sovellussalasana/);
 await howTo();assert.match(await id('gets').innerText(),/iCloud Mailin, kalenterin ja yhteystiedot/);
 await checkpoint();await capture('guide-1');
 await id('next').click();await step('enter');
 await id('apple-id').fill(OTHER);
 await id('mail-address').waitFor();
 await id('app-password').fill('Salasana123');
 await id('looks-wrong').waitFor();
 await id('connect').click();
 assert.match(await f.getByTestId('error').innerText({timeout:3000}),/sovellussalasanan[\s\S]*Mitään ei tallennettu/);
 assert.equal(await f.getByTestId('apple-card').count(),0,'a refusal saves nothing');
 await checkpoint();await capture('refused-1',false);
 await id('app-password').fill(PW);
 assert.equal(await f.getByTestId('looks-wrong').count(),0);
 await id('connect').click();await step('done');
 assert.equal(await id('result-mail').getAttribute('data-ok'),null,'no iCloud address: mail is left out');
 assert.match(await id('result-mail').innerText(),/Ei iCloud Mail -osoitetta/);
 assert.match(await id('result-calendar').innerText(),/p42-caldav\.icloud\.com[\s\S]*caldav\.icloud\.com/);
 await checkpoint();await capture('result-1',false);
 await id('finish').click();await closed();
 assert.match(await id('notice').innerText(),/kalenteri ja yhteystiedot yhdistetty/);
 assert.match(await id('apple-missing').innerText(),/iCloud Mail ei ole yhdistetty/);
 await id('apple-add').click();await step('enter');
 assert.match(await id('reuse').innerText(),/samaa sovellussalasanaa/);
 assert.equal(await id('connect').isDisabled(),false);
 await id('mail-address').fill('aino.v@icloud');
 assert.equal(await id('connect').isDisabled(),true,'not an iCloud address');
 await id('mail-address').fill(ID);
 await id('connect').click();await step('done');
 assert.match(await id('result-mail').innerText(),/imap\.mail\.me\.com · aino\.virtanen;[\s\S]*smtp\.mail\.me\.com · aino\.virtanen@icloud\.com/,'IMAP the name, SMTP the full address');
 await id('finish').click();await closed();
 assert.equal(await f.locator('[data-testid^=apple-svc-]').count(),3);
 await checkpoint();await capture('card-1');
 // Apple revoked the password: one new password renews all three.
 await scenario('Salasana mitätöity');
 assert.match(await id('apple-why').innerText(),/Yksi uusi salasana korjaa kaikki 3/);
 assert.equal(await f.locator('[data-testid=apple-state][data-state=credentials_rejected]').count(),3);
 await id('apple-card').scrollIntoViewIfNeeded();await checkpoint();await capture('revoked-1',false);
 await id('apple-renew').click();await step('password');
 assert.match(await id('renew-why').innerText(),/kaikkiin: posti, kalenteri ja yhteystiedot/);
 assert.equal(await f.getByTestId('skip').count(),0);
 await id('next').click();await id('apple-id-fixed').waitFor();
 await id('app-password').fill(PW);await id('connect').click();await step('done');
 await id('finish').click();await closed();
 assert.equal(await f.getByTestId('apple-renew').count(),0);
 assert.match(await id('notice').innerText(),/salasana vaihdettu/);
 // Jari's state today: a generic CardDAV connection to iCloud joins the card.
 await scenario('Vain yhteystiedot');
 assert.match(await id('apple-missing').innerText(),/iCloud Mail ja iCloud-kalenteri/);
 await id('apple-remove').click();
 assert.match(await id('apple-remove-dialog').innerText(),/App-Specific Passwords/);
 await id('apple-remove-confirm').click();await id('apple-tile').waitFor();
 await id('open-carddav').click();await id('integration-continue').click();
 await id('integration-address').fill(ID);
 await id('integration-dav-url').fill('https://contacts.icloud.com');
 await id('integration-password').fill(PW);
 await id('integration-connect').click();
 await id('apple-svc-contacts').waitFor();
 await id('dialog-close').click();
 assert.equal(await f.getByTestId('integration-account-carddav').count(),0,'grouped by host into the Apple card');

 // ---- Direction 2: the person chooses ----
 await key('2');await variant(1);await scenario('Ei yhdistetty');
 await id('apple-open').click();await step('choose');
 assert.match(await id('stepname').innerText(),/1\/3\s+Palvelut/);
 await id('want-mail').click();
 await checkpoint();await capture('choose-2',false);
 await id('next').click();await step('password');await howTo();
 await id('next').click();await step('enter');
 await id('apple-id').fill(OTHER);
 assert.equal(await f.getByTestId('mail-address').count(),0,'mail not chosen: no iCloud address asked');
 await id('back').click();await id('back').click();await step('choose');
 await id('want-mail').click();await id('next').click();await id('next').click();await step('enter');
 await id('mail-address').waitFor();
 await id('app-password').fill(PW);
 assert.equal(await id('connect').isDisabled(),true,'chose mail: the iCloud address is required');
 await id('mail-address').fill(ID);
 await id('connect').click();await step('done');
 assert.equal(await f.locator('[data-testid^=result-][data-ok]').count(),3);
 await id('finish').click();await closed();
 await scenario('Vain yhteystiedot');
 await id('apple-add').click();await step('choose');
 assert.deepEqual(await f.locator('[data-testid^=want-]').evaluateAll(es=>es.map(e=>e.dataset.testid)),['want-mail','want-calendar']);
 await id('want-mail').click();await id('next').click();await step('enter');
 await id('connect').click();await step('done');
 assert.deepEqual(await f.locator('[data-testid^=result-]').evaluateAll(es=>es.map(e=>e.dataset.testid)),['result-calendar']);
 await id('finish').click();await closed();
 await checkpoint();if(theme==='dark')await capture('card-2');

 // ---- Direction 3: the guide fills the generic cards ----
 await key('3');await variant(2);await scenario('Ei yhdistetty');
 await id('apple-open').click();await step('password');await id('skip').click();await step('enter');
 await id('apple-id').fill(ID);await id('app-password').fill(PW);
 await id('connect').click();await step('done');
 assert.match(await id('cards-note').innerText(),/3 korttia: Sähköposti \(IMAP\), Kalenteri \(CalDAV\) ja Yhteystiedot \(CardDAV\)/);
 await id('finish').click();await closed();
 for(const p of ['imap','caldav','carddav'])await id(`integration-account-${p}`).waitFor();
 assert.equal(await f.getByTestId('apple-tile').count(),0);
 await checkpoint();await capture('cards-3');
 await scenario('Salasana mitätöity');
 assert.equal(await f.getByTestId('integration-reauth').count(),3,'one renewal per card');
 await f.getByTestId('integration-reauth').first().click();await step('password');
 assert.match(await id('renew-why').innerText(),/palveluun posti/);
 await page.keyboard.press('Escape');await closed();
 await id('integration-account-imap').scrollIntoViewIfNeeded();await checkpoint();if(theme==='light')await capture('revoked-3',false);
 await scenario('Vain yhteystiedot');
 assert.match(await id('apple-tile').innerText(),/Lisää posti ja kalenteri samalla Apple ID:llä/);
 await id('integration-account-carddav').getByTestId('integration-remove-open').click();
 await id('integration-remove-confirm').click();
 assert.match(await id('apple-tile').innerText(),/Yksi sovellussalasana/);
 await page.close();
}
}finally{await browser.close();}
assert.deepEqual(errors,[],'console errors');
writeFileSync(`${out}/${hosted?'ap-hosted-checks':'ap-checks'}.json`,JSON.stringify({round,input:hosted?input:'offline.html',checks,errors},null,1)+'\n');
console.log(`${checks} checkpoints, no console errors`);
