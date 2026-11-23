// Run in a disposable checkout with web/node_modules from the committed lock.
// No production entrypoint or shared prototype library is changed.
// The page must open as a Habitat view, whose sandbox CSP forbids frames and
// network. So the phones are not iframes: each is an inline container
// (container-type: size), and the production CSS it renders is rewritten at
// build time to answer to that container instead of the window: width and
// height media queries become container queries, viewport units become
// container units, and hover/pointer queries take a touch phone's answer.
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,mkdirSync,readdirSync} from 'node:fs';
import {dirname,resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const here=dirname(fileURLToPath(import.meta.url)),root=resolve(here,'../../../..');
const require=createRequire(join(root,'web/package.json'));
const {build}=require('esbuild');
const out=resolve(process.argv[2]||join(root,'design-system/prototypes/dist/account-menu-phone-inline'));
mkdirSync(out,{recursive:true});
// Load the shared standalone wiring unchanged, rather than maintaining a React copy.
const rawPicker={name:'raw-picker',setup(b){
 b.onResolve({filter:/\?raw$/},a=>({path:resolve(a.resolveDir,a.path.slice(0,-4)),namespace:'raw'}));
 b.onLoad({filter:/.*/,namespace:'raw'},a=>({contents:readFileSync(a.path,'utf8'),loader:'text'}));
}};
// Vite asset URLs (the PDF worker) are never fetched in this view.
const viteUrl={name:'vite-url',setup(b){
 b.onResolve({filter:/\?(url|worker)$/},a=>({path:a.path,namespace:'vite-url'}));
 b.onLoad({filter:/.*/,namespace:'vite-url'},()=>({contents:'export default ""',loader:'js'}));
}};
// Some web/src modules differ only in case (app/AccountKeys.tsx beside
// app/accountKeys.ts), and esbuild's directory cache matches them either
// way: resolve extensionless relative imports by their exact name.
const exactCase={name:'exact-case',setup(b){
 b.onResolve({filter:/^\.\.?\/.*\/?[A-Za-z0-9_-]+$/},a=>{
  const base=resolve(a.resolveDir,a.path),dir=dirname(base),name=base.slice(dir.length+1);
  let entries;try{entries=readdirSync(dir);}catch{return undefined;}
  const hit=['.tsx','.ts','.jsx','.js'].map(e=>name+e).find(f=>entries.includes(f));
  return hit?{path:join(dir,hit)}:undefined;
 });
}};
// Container queries and cq units resolve against the nearest container, the
// phone. Outside any container (the review bar) cq units fall back to the
// small viewport, so the rewrite is harmless there.
const PHONE_FEATURES={'(hover: hover)':false,'(hover: none)':true,'(pointer: coarse)':true,'(pointer: fine)':false};
function phoneCss(css){
 css=css.replace(/@media([^{;]+)\{/g,(all,q)=>{
  const query=q.trim();
  let cond=query,never=false;
  for(const [f,v] of Object.entries(PHONE_FEATURES)){
   if(!cond.includes(f))continue;
   if(!v)never=true;
   cond=cond.replace(f,'').replace(/^\s*and\s*/,'').replace(/\s*and\s*$/,'').replace(/\s+and\s+and\s+/,' and ').trim();
  }
  if(never)return '@media not all {';
  if(!cond)return '@media all {';
  if(/width|height/.test(cond)){
   if(/prefers|forced|hover|pointer|,/.test(cond))throw new Error(`phoneCss: mixed media query ${query}`);
   return `@container am-device ${cond} {`;
  }
  return `@media ${cond} {`;
 });
 // A container query cannot match :root, html or body, which sit outside the
 // phone: inside one, they mean the phone's screen element.
 let out='',i=0;
 for(const m of css.matchAll(/@container am-device[^{]*\{/g)){
  if(m.index<i)continue;
  let depth=1,j=m.index+m[0].length;
  while(depth&&j<css.length){if(css[j]==='{')depth++;else if(css[j]==='}')depth--;j++;}
  out+=css.slice(i,m.index)+css.slice(m.index,j).replace(/(^|[\s,{}])(:root|html|body)(?=[\s,{:.\[])/g,'$1.am-screen');
  i=j;
 }
 out+=css.slice(i);
 return out.replace(/(\d*\.?\d+)[dsl]?v(h|w)\b/g,(_,n,a)=>`${n}cq${a}`);
}
const phoneStyles={name:'phone-styles',setup(b){
 b.onLoad({filter:/\.css$/},a=>{
  if(!/\/web\/src\/|\/design-system\/tokens\/|\/rounds\/2026-11-23-account-menu-phone-inline\//.test(a.path))return undefined;
  return {contents:phoneCss(readFileSync(a.path,'utf8')),loader:a.path.endsWith('.module.css')?'local-css':'css'};
 });
}};
const result=await build({plugins:[rawPicker,viteUrl,exactCase,phoneStyles],entryPoints:[join(here,'round.tsx')],bundle:true,write:false,outfile:'prototype.js',platform:'browser',format:'iife',jsx:'automatic',nodePaths:[join(root,'web/node_modules')],loader:{'.module.css':'local-css','.woff2':'dataurl','.woff':'dataurl','.svg':'dataurl','.avif':'dataurl','.png':'dataurl','.webp':'dataurl'},define:{'process.env.NODE_ENV':'"production"','import.meta.env.VITE_SYNTHETIC_DEMO':'"false"'},minify:true,metafile:true,logLevel:'error'});
const js=result.outputFiles.find(f=>f.path.endsWith('.js')).text;
const css=result.outputFiles.find(f=>f.path.endsWith('.css')).text;
const html=styles=>`<!doctype html><html lang="fi"><head><meta charset="utf-8"><meta name="prototype-round" content="2026-11-23-account-menu-phone-inline"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Tilivalikko puhelimessa</title><style>${styles}</style></head><body><div id="root"></div><script>${js.replace(/<\/script/gi,'<\\/script')}</script></body></html>`;
writeFileSync(join(out,'offline.html'),html(css));
// Glasspad's null-origin sandbox blocks data fonts. Keep production fallback stacks.
writeFileSync(join(out,'index.html'),html(css.replace(/@font-face\s*\{[^}]*\}/g,'')));
writeFileSync(join(out,'build-inputs.json'),JSON.stringify(Object.keys(result.metafile.inputs),null,2));
console.log(out);
