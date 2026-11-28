// node build.mjs [out-dir]
// Builds offline.html (one self-contained file with fonts) and index.html
// (the same without embedded fonts) from round.tsx, default out-dir
// design-system/prototypes/dist/2026-11-28-kiina-1.
// Needs web/node_modules from the committed lock (npm ci --prefix web).
//
// The round shows production components in Simplified Chinese without
// changing production: web/src/text/* modules are loaded with an appended
// call that attaches a "zh-CN" entry to each catalog from zh/<module>.ts, and
// web/src/i18n/index.ts is loaded with the language lists widened. A key the
// zh file lacks shows its US English text and is recorded, so the check can
// name what the screens read untranslated. The language row of Settings is
// the round's own (languageSettings.tsx), because production lists its
// languages in the component.
//
// Direction C embeds Noto Sans SC (SIL OFL 1.1, no Reserved Font Name) in the
// slices fontsource cuts by unicode-range, keeping only the slices that hold
// a character of the round's Chinese text. The package is fetched once with
// `npm pack` into dist/kiina-fonts (untracked); without network, C falls back
// to the system stack and the build says so.
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,mkdirSync,readdirSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {dirname,resolve,join,basename} from 'node:path';
import {fileURLToPath} from 'node:url';
const here=dirname(fileURLToPath(import.meta.url)),root=resolve(here,'../../../..');
const require=createRequire(join(root,'web/package.json'));
const {build}=require('esbuild');
const ROUND='2026-11-28-kiina-1';
const out=resolve(process.argv[2]||join(root,'design-system/prototypes/dist',ROUND));
mkdirSync(out,{recursive:true});
const textDir=join(root,'web/src/text'),zhDir=join(here,'zh');

const rawPicker={name:'raw-picker',setup(b){
 b.onResolve({filter:/\?raw$/},a=>({path:resolve(a.resolveDir,a.path.slice(0,-4)),namespace:'raw'}));
 b.onLoad({filter:/.*/,namespace:'raw'},a=>({contents:readFileSync(a.path,'utf8'),loader:'text'}));
}};
const viteUrl={name:'vite-url',setup(b){
 b.onResolve({filter:/\?(url|worker)$/},a=>({path:a.path,namespace:'vite-url'}));
 b.onLoad({filter:/.*/,namespace:'vite-url'},()=>({contents:'export default ""',loader:'js'}));
}};
// web/src has modules that differ only in case; resolve exact names.
const exactCase={name:'exact-case',setup(b){
 b.onResolve({filter:/^\.\.?\/.*\/?[A-Za-z0-9_-]+$/},a=>{
  const base=resolve(a.resolveDir,a.path),dir=dirname(base),name=base.slice(dir.length+1);
  if(base===join(root,'web/src/components/LanguageSettings')||base===join(root,'web/src/app/LanguageSettings'))return {path:join(here,'languageSettings.tsx')};
  let entries;try{entries=readdirSync(dir);}catch{return undefined;}
  const hit=['.tsx','.ts','.jsx','.js'].map(e=>name+e).find(f=>entries.includes(f));
  return hit?{path:join(dir,hit)}:undefined;
 });
}};
const zhFiles=new Set(readdirSync(zhDir).filter(f=>f.endsWith('.ts')).map(f=>f.replace(/\.ts$/,'')));
const catalogs={name:'zh-catalogs',setup(b){
 b.onLoad({filter:/web\/src\/text\/[^/]+\.tsx?$/},a=>{
  const src=readFileSync(a.path,'utf8');
  const mod=basename(a.path).replace(/\.tsx?$/,'');
  const names=[...src.matchAll(/(?:export\s+)?const\s+(\w+)\s*=\s*catalog\s*(?:<[^>]*>)?\s*\(/g)].map(m=>m[1]);
  const zh=zhFiles.has(mod)?`import __zh from ${JSON.stringify(join(zhDir,mod+'.ts'))};`:'const __zh = {};';
  const tail=names.length?`\n${zh}\nimport {attachZh as __attachZh} from ${JSON.stringify(join(here,'zhRuntime.ts'))};\n__attachZh(${JSON.stringify(mod)}, {${names.join(',')}}, __zh);\n`:'';
  return {contents:src+tail,loader:a.path.endsWith('x')?'tsx':'ts'};
 });
 b.onLoad({filter:/web\/src\/app\/settingsIndex\.ts$/},a=>{
  let src=readFileSync(a.path,'utf8');
  const from='return language !== "fi" ? english : finnish;';
  if(!src.includes(from))throw new Error('settingsIndex patch no longer applies');
  src=src.replace(from,'return language.startsWith("zh") ? chinese : language !== "fi" ? english : finnish;');
  src+=`\nimport {settingsIndexZh as __zhSections} from ${JSON.stringify(join(here,'settingsIndexZh.ts'))};
const chinese: readonly ShownSection[] = english.map((s) => {
  const zh = __zhSections[s.id];
  if (!zh) return s;
  return {...s, label: zh.label, intro: zh.intro ?? s.intro, kw: [...s.kw, s.label],
    rows: s.rows.map((r) => ({...r, ...(zh.rows?.[r.id] ?? {}), kw: [...r.kw, r.label]}))};
});\n`;
  return {contents:src,loader:'ts'};
 });
 b.onLoad({filter:/web\/src\/i18n\/index\.ts$/},a=>{
  let src=readFileSync(a.path,'utf8');
  const swaps=[
   ['"en-GB",\n];','"en-GB",\n  "zh-CN",\n  "zh-TW",\n];'],
   ['value === "en-GB"\n','value === "en-GB" ||\n    value === "zh-CN" ||\n    value === "zh-TW"\n'],
   ['if (/^fi(-|$)/i.test(first)) return "fi";','if (/^fi(-|$)/i.test(first)) return "fi";\n  if (/^zh-(TW|HK|MO|Hant)/i.test(first)) return "zh-TW";\n  if (/^zh(-|$)/i.test(first)) return "zh-CN";'],
   ['return messages[useLanguage()];','return messages[useLanguage()] ?? (messages as any)["zh-CN"];'],
   ['return messages[current];','return messages[current] ?? (messages as any)["zh-CN"];'],
   ['messages[current][key as keyof T]','(messages[current] ?? (messages as any)["zh-CN"])[key as keyof T]'],
  ];
  for(const [from,to] of swaps){if(!src.includes(from))throw new Error(`i18n patch no longer applies: ${from}`);src=src.replace(from,to);}
  // zh-TW reads the zh-CN catalogs in this round (see NOTES.md).
  src=src.replace('return { fi, en: uk, "en-US": us, "en-GB": uk };','return { fi, en: uk, "en-US": us, "en-GB": uk } as any;');
  return {contents:src,loader:'ts'};
 });
}};

// ---------- Noto Sans SC slices for direction C ----------
const PKG='@fontsource/noto-sans-sc@5.3.1';
const fontDir=join(root,'design-system/prototypes/dist/kiina-fonts');
function fontPackage(){
 const pkg=join(fontDir,'package');
 if(existsSync(join(pkg,'400.css')))return pkg;
 try{
  mkdirSync(fontDir,{recursive:true});
  const tgz=execFileSync('npm',['pack',PKG,'--silent'],{cwd:fontDir,encoding:'utf8'}).trim().split('\n').at(-1);
  execFileSync('tar',['xzf',tgz],{cwd:fontDir});
  return pkg;
 }catch(e){console.warn(`kiina-1: ${PKG} not available (${e.message.split('\n')[0]}); direction C uses the system stack`);return null;}
}
const used=new Set();
for(const f of [...readdirSync(zhDir).map(f=>join(zhDir,f)),join(here,'round.tsx'),join(here,'languageSettings.tsx')])
 for(const ch of readFileSync(f,'utf8'))if(ch.codePointAt(0)>=0x2e80)used.add(ch.codePointAt(0));
const inRange=(r,cp)=>r.split(',').some(p=>{const [a,b]=p.trim().replace(/^U\+/i,'').split('-').map(x=>parseInt(x,16));return cp>=a&&cp<=(b??a);});
let cjkFaces='',slices=0,bytes=0;
const pkg=fontPackage();
if(pkg)for(const w of [400,500,600]){
 const css=readFileSync(join(pkg,`${w}.css`),'utf8');
 for(const m of css.matchAll(/@font-face\s*\{([^}]*)\}/g)){
  const body=m[1],range=/unicode-range:\s*([^;]+);/.exec(body)?.[1],file=/url\(\.\/files\/([^)]+\.woff2)\)/.exec(body)?.[1];
  if(!range||!file||![...used].some(cp=>inRange(range,cp)))continue;
  const data=readFileSync(join(pkg,'files',file));slices++;bytes+=data.length;
  cjkFaces+=`@font-face{font-family:"Habitat CJK SC";font-style:normal;font-weight:${w};font-display:swap;src:url(data:font/woff2;base64,${data.toString('base64')}) format("woff2");unicode-range:${range};}`;
 }
}

const result=await build({plugins:[rawPicker,viteUrl,catalogs,exactCase],entryPoints:[join(here,'round.tsx')],bundle:true,write:false,outfile:'prototype.js',platform:'browser',format:'iife',jsx:'automatic',nodePaths:[join(root,'web/node_modules')],loader:{'.module.css':'local-css','.woff2':'dataurl','.woff':'dataurl','.svg':'dataurl','.avif':'dataurl','.png':'dataurl','.webp':'dataurl'},define:{'process.env.NODE_ENV':'"production"','import.meta.env.VITE_SYNTHETIC_DEMO':'"false"','import.meta.env.DEV':'false','__CJK_SLICES__':String(slices)},minify:true,metafile:true,logLevel:'error'});
const js=result.outputFiles.find(f=>f.path.endsWith('.js')).text;
const css=result.outputFiles.find(f=>f.path.endsWith('.css')).text;
const html=styles=>`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="prototype-round" content="${ROUND}"><meta name="viewport" content="width=device-width,initial-scale=1"><title>中文界面 · Kiina 1</title><style>${styles}</style></head><body><div id="root"></div><script>${js.replace(/<\/script/gi,'<\\/script')}</script></body></html>`;
writeFileSync(join(out,'offline.html'),html(cjkFaces+css));
// Glasspad's null-origin sandbox blocks data fonts. Keep production fallback stacks.
writeFileSync(join(out,'index.html'),html(css.replace(/@font-face\s*\{[^}]*\}/g,'')));
writeFileSync(join(out,'build-inputs.json'),JSON.stringify(Object.keys(result.metafile.inputs),null,2));
console.log(`${out} (CJK: ${used.size} characters, ${slices} slices, ${(bytes/1024).toFixed(0)} KiB)`);
