// node check.mjs <offline.html> <out-dir> [--quick]
// Authored synthetic component lab, not a host-backed acceptance test: the
// production Composer and Dictation engine run against a scripted
// microphone, Soniox socket and clock. Walks Nyt and the three directions at
// 1440 and 390 px in Päivä, Yö and Kontrasti in Finnish, and Päivä in
// English: the five scenes (early, one minute left, ten seconds left, limit
// reached, connection dropped) show the direction's time, note and notice;
// at the limit the field holds everything said, Soniox's last words
// included; and the document does not overflow. Then at 1440 Päivä per
// direction: Toista loppu plays the last seconds to the limit (tones at ten
// seconds and the end in the directions, none in Nyt), Jatka sanelua starts
// a new dictation after the kept text, and Kuuntele merkki sounds. Last,
// reduced motion and forced colours at 1440. Screenshots are full pages at
// device scale 2 named <n>-<direction>-<width>-<theme|mode>[-en].png;
// --quick takes only 1440 Päivä.
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-11-15-dictation-limit';
const [input,out,flag]=process.argv.slice(2);
const quick=flag==='--quick';
mkdirSync(out,{recursive:true});
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
const html=readFileSync(input,'utf8');
const names=['nyt','kuuluva','ketju','tauko'];
const SAID={fi:['Selitän nyt koko taustan','Kiitos.'],en:['Let me explain the whole background','Thanks.']};
let checks=0;const errors=[];
const ok=(v,m)=>{assert.ok(v,m);checks++;};
const eq=(a,b,m)=>{assert.equal(a,b,m);checks++;};

async function open(width,theme,lang='fi',{reducedMotion='no-preference',forcedColors='none'}={}){
 const phone=width===390;
 const page=await browser.newPage({viewport:{width,height:phone?844:1000},deviceScaleFactor:2,reducedMotion,forcedColors,hasTouch:phone});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('http://prototype.test/**',r=>r.fulfill({contentType:'text/html',body:html}));
 await page.goto(`http://prototype.test/?theme=${theme}&lang=${lang}`);
 await settle(page);
 return page;
}
// The scenes start dictating, jump to their moment and, at the limit, end.
const filled=id=>`(()=>{const f=document.querySelector('[data-testid="scene-${id}"] [data-testid="message-input"]');return !!f&&!f.hidden&&f.value.length>0;})()`;
const settle=async page=>{await page.waitForFunction(filled('limit'),null,{timeout:10000});await page.waitForTimeout(1200);};
const pick=async(page,d)=>{await page.locator('.proto-picker-item').nth(d).click();await page.locator(`.dl-review[data-direction="${d}"]`).waitFor({state:'attached'});await settle(page);};
const shot=(page,d,tag)=>page.screenshot({path:`${out}/${d}-${names[d]}-${tag}.png`,fullPage:true});
const fits=page=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth);
const scene=(page,id)=>page.getByTestId(`scene-${id}`);
const barTime=(page,id)=>scene(page,id).getByTestId('dl-bar-time');

async function scenes(page,d,lang,at){
 eq(await page.locator('.dl-scene').count(),5,`${at}: five scenes`);
 for(const id of ['early','minute','seconds','drop'])
  ok(await scene(page,id).getByTestId('dictation-bar').isVisible(),`${at}: ${id} is dictating`);
 // Early.
 if(d===0)ok((await scene(page,'early').locator('.ah-dictation-time').textContent()).startsWith('2:1'),`${at}: production time`);
 else{
  const time=await barTime(page,'early').textContent();
  ok(time.includes('2:1'),`${at}: early time ${time}`);
  eq(time.includes('/ 10:00'),d===1,`${at}: the limit shown early only in 1`);
  eq(await scene(page,'early').getByTestId('dl-note').count(),0,`${at}: nothing above the field early`);
 }
 // One minute left.
 if(d===0){
  ok((await scene(page,'minute').getByTestId('dictation-ceiling').textContent()).includes('0:5'),`${at}: production's minute note`);
  eq(await scene(page,'minute').locator('[data-testid="dictation-ceiling"].urgent').count(),0,`${at}: not urgent yet`);
 }else{
  eq(await scene(page,'minute').getByTestId('dl-note').getAttribute('data-tone'),'soon',`${at}: minute note`);
  eq(await scene(page,'minute').getByTestId('dictation-ceiling').isVisible(),false,`${at}: production's note hidden`);
  ok((await scene(page,'minute').getByTestId('announce-minute').textContent()).length>5,`${at}: the minute is announced`);
  if(d<3)ok((await barTime(page,'minute').textContent()).includes('0:5'),`${at}: counts down in the bar`);
  else eq(await scene(page,'minute').locator('.dl-drain').count(),1,`${at}: the draining line`);
 }
 // Ten seconds.
 if(d===0)eq(await scene(page,'seconds').locator('[data-testid="dictation-ceiling"].urgent').count(),1,`${at}: production urgent`);
 else{
  eq(await scene(page,'seconds').getByTestId('dl-note').getAttribute('data-tone'),'urgent',`${at}: ten seconds note`);
  if(d<3)ok((await barTime(page,'seconds').textContent()).includes('0:1'),`${at}: 0:10 left`);
 }
 // The limit: everything in the field, the notice, one action.
 const field=await scene(page,'limit').getByTestId('message-input').inputValue();
 ok(field.startsWith(SAID[lang][0])&&field.trimEnd().endsWith(SAID[lang][1]),`${at}: the field keeps all said (${field.slice(-30)})`);
 eq(await scene(page,'limit').getByTestId('dictation-bar').count(),0,`${at}: dictation ended`);
 if(d===0){
  eq(await scene(page,'limit').getByTestId('dictation-notice').getAttribute('data-notice'),'ceiling',`${at}: production notice`);
  eq(await scene(page,'limit').getByTestId('dictation-resume').count(),1,`${at}: production resume`);
 }else{
  ok(await scene(page,'limit').getByTestId('dl-notice').isVisible(),`${at}: end notice`);
  eq(await scene(page,'limit').getByTestId('dl-resume').count(),1,`${at}: one action to continue`);
  eq(await scene(page,'limit').getByTestId('dictation-notice').isVisible(),false,`${at}: production notice hidden`);
 }
 // Dropped.
 eq(await scene(page,'drop').getByTestId('dictation-bar').getAttribute('data-phase'),'reconnecting',`${at}: reconnecting`);
 if(d>0)eq(await scene(page,'drop').getByTestId('dl-note').getAttribute('data-tone'),'drop',`${at}: drop note`);
 ok(await fits(page),`${at}: document overflow`);
}

try{
const runs=[];
for(const width of quick?[1440]:[1440,390])for(const theme of quick?['light']:['light','dark','contrast'])runs.push([width,theme,'fi']);
if(!quick)runs.push([1440,'light','en'],[390,'light','en']);
for(const [width,theme,lang] of runs){
 const tag=`${width}-${theme}${lang==='en'?'-en':''}`;
 const page=await open(width,theme,lang);
 await checkPicker(page,round);
 eq(await page.getByTestId('recommendation').count(),1,'the recommendation is on the page');
 for(let d=0;d<4;d++){
  if(d>0)await pick(page,d);
  const at=`${names[d]} ${tag}`;
  eq(await page.locator('.dl-lines li[aria-current]').count(),1,`${at}: its line is marked`);
  await scenes(page,d,lang,at);
  await shot(page,d,tag);
 }
 await page.close();
}

{
 const page=await open(1440,'light');
 const cues=()=>page.evaluate(()=>window.__dlCues.splice(0));
 for(let d=0;d<4;d++){
  if(d>0)await pick(page,d);
  const at=`events ${names[d]}`;
  await cues();
  await scene(page,'seconds').getByTestId('replay-seconds').click();
  await page.waitForTimeout(2000);
  ok(await scene(page,'seconds').getByTestId('dictation-bar').isVisible(),`${at}: still dictating 13 s before`);
  await page.waitForFunction(filled('seconds'),null,{timeout:30000});
  await page.waitForTimeout(800);
  const field=await scene(page,'seconds').getByTestId('message-input').inputValue();
  ok(field.trimEnd().endsWith(SAID.fi[1]),`${at}: played to the limit, all kept`);
  ok(field.length>SAID.fi[0].length+200,`${at}: the words said while playing are in`);
  const heard=await cues();
  eq(heard.join(),d===0?'':'seconds,end',`${at}: tones`);
  await shot(page,d,'played-1440-light');
  // One action continues, after the kept text.
  await scene(page,'limit').getByTestId(d===0?'dictation-resume':'dl-resume').click();
  await scene(page,'limit').getByTestId('dictation-bar').waitFor();
  await page.waitForTimeout(600);
  if(d>0)ok((await barTime(page,'limit').textContent()).startsWith('0:0'),`${at}: a fresh dictation`);
  ok((await scene(page,'limit').getByTestId('dictation-live').textContent()).includes(SAID.fi[1]),`${at}: the kept text stays before the new words`);
  if(d>0){
   await scene(page,'minute').getByTestId('listen-minute').click();
   eq((await cues()).join(),'minute',`${at}: the minute tone`);
  }
 }
 await page.close();

 for(const [mode,opts] of [['reduced',{reducedMotion:'reduce'}],['forced',{forcedColors:'active'}]]){
  const p=await open(1440,'light','fi',opts);
  for(let d=0;d<4;d++){
   if(d>0)await pick(p,d);
   await scenes(p,d,'fi',`${mode} ${names[d]}`);
   await shot(p,d,`1440-${mode}`);
  }
  await p.close();
 }
}
}finally{await browser.close();}
assert.deepEqual(errors,[],'console errors');
console.log(`${checks} checks passed`);
