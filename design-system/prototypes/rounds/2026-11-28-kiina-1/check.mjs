// node check.mjs <offline.html> <out-dir> [--quick]
// Authored synthetic component lab, not a host-backed acceptance test.
// Every direction (A Nyt, B Pino, C Oma fontti) and every situation at
// 1440 light and 390 light in zh-CN, 1440 dark in zh-CN, and 1440 light in
// Finnish and English for length comparison (--quick: 1440 light zh-CN
// only), with reduced motion. Asserts per page: the document's lang, no
// document or dialog overflow, no running animation, a clean console, the
// picker, and that every catalog message the page read had a zh-CN text
// (window.__zhMissing empty; production would refuse to build otherwise).
// Typography: in B and C the computed --ah-font names the CJK stack and
// <em> is upright; in A it is production's. In C the embedded Noto Sans SC
// slices loaded (document.fonts). Truncation: the long rail title ends in an
// ellipsis inside its row, and no visible text node in the rail or Settings
// nav spills out of its box. Spacing (adjacency): no two visible controls in
// the open dialog or menu, or the page when none is open, are closer than
// --ah-control-gap (bounding boxes; touching or overlapping fails), rows
// of one list (same left edge and width) excepted. A pair production
// also has in Finnish or English is reported, a zh-CN-only pair fails.
// Interactions at 1440 light zh-CN: Settings' language menu opens with six
// choices by autonym and a Beta note on both Chinese ones, and choosing
// Suomi turns the interface Finnish; the rail's account menu opens; the
// sign-out dialog closes on Escape; the onboarding chooser selects a second
// repository and its count follows. Screenshots k1-<d>-<s>-<tag>.png.
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {checkPicker} from '../../picker-check.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const require=createRequire(resolve(here,'../../../../web/package.json'));
const {chromium}=require('playwright');
const round='2026-11-28-kiina-1';
const [input,out,flag]=process.argv.slice(2);
if(!input||!out){console.error('usage: node check.mjs <offline.html> <out-dir> [--quick]');process.exit(2);}
const quick=flag==='--quick';
mkdirSync(out,{recursive:true});
const browser=await chromium.launch(process.env.PROTO_CHROMIUM?{executablePath:process.env.PROTO_CHROMIUM}:{});
const html=readFileSync(input,'utf8');
const SITUATIONS=['keskustelu','kieli','tili','aloitus','ikkuna'];
let checks=0;const errors=[];
const ok=(v,m)=>{assert.ok(v,m);checks++;};
const eq=(a,b,m)=>{assert.equal(a,b,m);checks++;};

async function open({d,s,width=1440,theme='light',lang='zh-CN'}){
 const phone=width===390;
 const page=await browser.newPage({viewport:{width,height:phone?844:900},deviceScaleFactor:phone?2:1,reducedMotion:'reduce',hasTouch:phone});
 const tag=`${d} ${s} ${width} ${theme} ${lang}`;
 page.on('pageerror',e=>errors.push(`${tag}: ${e.message}`));
 page.on('console',m=>{if(m.type()==='error'||m.type()==='warning')errors.push(`${tag}: ${m.text()}`);});
 await page.route('http://prototype.test/**',r=>r.fulfill({contentType:'text/html',body:html}));
 await page.goto(`http://prototype.test/?v=${d+1}&s=${s}&theme=${theme}&lang=${lang}`);
 await page.locator(`.rq-review[data-direction="${d}"]`).waitFor({state:'attached'});
 await page.waitForTimeout(400);
 await page.evaluate(()=>document.fonts.ready);
 return page;
}
const shot=(page,name)=>page.screenshot({path:`${out}/k1-${name}.png`});
const missing=page=>page.evaluate(()=>[...window.__zhMissing.keys()]);

async function spacing(page,what){
 const bad=await page.evaluate(()=>{
  const px=v=>{const e=document.createElement('div');e.style.width=`var(${v})`;document.body.append(e);const w=e.getBoundingClientRect().width;e.remove();return w;};
  const min=px('--ah-control-gap');
  const layers=[...document.querySelectorAll('[role=dialog],[role=alertdialog],[role=menu],[role=listbox]')].filter(e=>e.getBoundingClientRect().width>0);
  const scope=layers.at(-1)||document.querySelector('.rq-stage');
  const els=[...scope.querySelectorAll('button,a[href],input,select,textarea,[role=button],[role=menuitem],[role=option],[role=menuitemradio],summary')].filter(e=>{
   if(e.closest('.proto-picker,.rq-bar'))return false;
   const b=e.getBoundingClientRect();return b.width>0&&b.height>0&&getComputedStyle(e).visibility!=='hidden'&&b.bottom>0&&b.top<innerHeight;});
  const name=e=>(e.dataset.testid||e.getAttribute('aria-label')||e.textContent||e.tagName).trim().slice(0,30);
  const gap=(a,b)=>{const p=a.getBoundingClientRect(),q=b.getBoundingClientRect();const gx=Math.max(q.left-p.right,p.left-q.right),gy=Math.max(q.top-p.bottom,p.top-q.bottom);return gx<0&&gy<0?Math.max(gx,gy):gx<0?gy:gy<0?gx:Math.max(gx,gy);};
  const out=[];
  for(let i=0;i<els.length;i++)for(let j=i+1;j<els.length;j++){
   const a=els[i],b=els[j];if(a.contains(b)||b.contains(a))continue;
   // Rows of one list (same left edge and width, stacked) are one control group.
   const p=a.getBoundingClientRect(),q=b.getBoundingClientRect();
   if(Math.abs(p.left-q.left)<1&&Math.abs(p.width-q.width)<1)continue;
   const g=gap(a,b);if(g<min-0.5)out.push(`${name(a)} | ${name(b)}: ${g.toFixed(1)}px < ${min}`);
  }
  return out;
 });
 return bad.map(b=>`${what}: ${b}`);
}
// Production's known adjacencies are reported, not failed: the round
// changes no production layout, and Chinese labels are shorter than the
// English ones these rows were laid out for. A pair that appears only in
// zh-CN is a regression the language causes and fails the check.
const adjacency={zh:new Set(),other:new Set()};
const strip=s=>s.replace(/^[^:]*: /,'').replace(/: -?[\d.]+px.*$/,'').replace(/repository-(?!proceed)[^ |]+/g,'repository-*');

async function common(page,d,s,what,lang){
 eq(await page.evaluate(()=>document.documentElement.lang),lang,`${what}: lang`);
 ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${what}: document overflow`);
 ok(await page.evaluate(()=>[...document.querySelectorAll('[role=dialog],[role=alertdialog]')].every(e=>e.scrollWidth<=e.clientWidth+1)),`${what}: dialog overflow`);
 eq(await page.evaluate(()=>document.getAnimations().filter(a=>a.playState==='running'&&!a.effect?.target?.closest?.('.proto-picker')).length),0,`${what}: animation under reduced motion`);
 await checkPicker(page,round);checks++;
 if(lang.startsWith('zh'))eq((await missing(page)).join(', '),'',`${what}: messages without zh-CN`);
 const font=await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--ah-font'));
 if(d===0)ok(!/PingFang|Habitat CJK/.test(font),`${what}: A keeps production's stack`);
 else if(lang.startsWith('zh'))ok(d===1?/PingFang SC/.test(font)&&!/Habitat CJK/.test(font):/Habitat CJK SC/.test(font),`${what}: stack ${font}`);
 if(d>0&&lang.startsWith('zh')&&s==='keskustelu')eq(await page.evaluate(()=>getComputedStyle(document.querySelector('.rq-stage em')).fontStyle),'normal',`${what}: emphasis upright`);
 if(d===0&&s==='keskustelu')eq(await page.evaluate(()=>getComputedStyle(document.querySelector('.rq-stage em')).fontStyle),'italic',`${what}: production emphasis`);
 if(d===2&&lang.startsWith('zh')){
  const loaded=await page.evaluate(()=>[...document.fonts].filter(f=>f.family.replace(/"/g,'')==='Habitat CJK SC'&&f.status==='loaded').length);
  ok(loaded>0,`${what}: Noto Sans SC slices loaded (${loaded})`);
 }
 // Nothing spills out of a rail row or a Settings nav item.
 const spill=await page.evaluate(()=>[...document.querySelectorAll('.rq-stage :is(.ah-rail a, .ah-rail button, .s-nav-i)')].filter(e=>{
  const b=e.getBoundingClientRect();if(!b.width||!b.height)return false;
  return [...e.querySelectorAll('span,strong')].some(x=>{const r=x.getBoundingClientRect();return r.width>0&&r.right>b.right+1&&getComputedStyle(x).overflow==='visible'&&x.scrollWidth>x.clientWidth+1;});
 }).map(e=>e.textContent.trim().slice(0,30)));
 eq(spill.join(' | '),'',`${what}: text spills out of a row`);
 for(const b of await spacing(page,what))(lang.startsWith('zh')?adjacency.zh:adjacency.other).add(strip(b)+` [${s}]`);
}

const dirs=[0,1,2];
const sizes=quick?[{width:1440,theme:'light',lang:'zh-CN',tag:'1440'}]:[
 {width:1440,theme:'light',lang:'zh-CN',tag:'1440'},
 {width:390,theme:'light',lang:'zh-CN',tag:'390'},
 {width:1440,theme:'dark',lang:'zh-CN',tag:'1440-dark'},
 {width:1440,theme:'light',lang:'fi',tag:'1440-fi'},
 {width:1440,theme:'light',lang:'en-US',tag:'1440-en'},
 {width:390,theme:'light',lang:'fi',tag:'390-fi'},
];
for(const d of dirs)for(const s of SITUATIONS)for(const z of sizes){
 if(z.lang!=='zh-CN'&&d!==1)continue;
 const page=await open({d,s,...z});
 const what=`${'ABC'[d]} ${s} ${z.tag}`;
 await common(page,d,s,what,z.lang);
 if(s==='keskustelu'&&z.width===1440){
  // The long title ends in an ellipsis within its row.
  const t=await page.evaluate(()=>{const el=[...document.querySelectorAll('.ah-rail a')].find(a=>/全文索引|kokotekstihakemisto|full-text index/.test(a.textContent));if(!el)return null;
   const label=[...el.querySelectorAll('*')].find(x=>x.children.length===0&&/全文索引|kokotekstihakemisto|full-text index/.test(x.textContent));
   const cs=getComputedStyle(label);return {ellipsis:cs.textOverflow,cut:label.scrollWidth>label.clientWidth};});
  ok(t&&t.ellipsis==='ellipsis'&&t.cut,`${what}: long title truncated with an ellipsis ${JSON.stringify(t)}`);
 }
 if(s==='ikkuna')ok(await page.getByTestId('logout-dialog').isVisible(),`${what}: dialog open`);
 if(s==='kieli'||s==='tili')ok(await page.getByTestId('settings-layer').isVisible(),`${what}: settings open`);
 if(s==='aloitus')ok(await page.getByTestId('onboarding').isVisible(),`${what}: onboarding`);
 await shot(page,`${'abc'[d]}-${s}-${z.tag}`);
 // Interactions, once per direction at 1440 light zh-CN.
 if(z.tag==='1440'){
  if(s==='kieli'){
   await page.getByTestId('language-choice').click();
   const opts=page.locator('.ah-choice-popover [role^=menuitem]');
   await opts.first().waitFor();
   const texts=await opts.allInnerTexts();
   eq(texts.length,6,`${what}: six language choices`);
   for(const n of ['跟随系统','Suomi','English (US)','English (UK)','简体中文','繁體中文'])ok(texts.some(x=>x.includes(n)),`${what}: choice ${n}`);
   ok(texts.filter(x=>/测试版|測試版/.test(x)).length===2,`${what}: both Chinese choices marked beta`);
   for(const b of await spacing(page,`${what} menu`))adjacency.zh.add(strip(b)+' [kieli menu]');
   await shot(page,`${'abc'[d]}-kieli-menu`);
   await opts.filter({hasText:'Suomi'}).click();
   await page.waitForTimeout(300);
   eq(await page.evaluate(()=>document.documentElement.lang),'fi',`${what}: chose Finnish`);
   ok((await page.getByTestId('settings-layer').innerText()).includes('Ulkoasu'),`${what}: Settings now Finnish`);
  }
  if(s==='keskustelu'){
   const account=page.locator('.rq-stage .ah-rail').getByRole('button',{name:/账号菜单/});
   await account.click();
   await page.getByRole('menu').first().waitFor();
   eq((await missing(page)).join(', '),'',`${what}: account menu without zh-CN`);
   for(const b of await spacing(page,`${what} account menu`))adjacency.zh.add(strip(b)+' [account menu]');
   await shot(page,`${'abc'[d]}-keskustelu-tilivalikko`);
   await page.keyboard.press('Escape');
  }
  if(s==='ikkuna'){
   await page.keyboard.press('Escape');
   await page.waitForTimeout(200);
   eq(await page.getByTestId('logout-dialog').count(),0,`${what}: Escape closes the dialog`);
  }
  if(s==='aloitus'){
   await page.getByRole('checkbox').nth(1).check();
   ok((await page.getByTestId('onboarding').innerText()).includes('已选择 2 个仓库'),`${what}: count follows`);
  }
 }
 await page.close();
}
await browser.close();
eq(errors.join('\n'),'','console');
const zhOnly=[...adjacency.zh].filter(x=>!adjacency.other.has(x));
console.log(`${checks} checks passed`);
if(adjacency.other.size)console.log(`Production adjacencies also in Finnish/English (reported, not failed):\n  ${[...adjacency.other].join('\n  ')}`);
if(zhOnly.length){console.error(`Adjacencies only in zh-CN:\n  ${zhOnly.join('\n  ')}`);process.exit(1);}
