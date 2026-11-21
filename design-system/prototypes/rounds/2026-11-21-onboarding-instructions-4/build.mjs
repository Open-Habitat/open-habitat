// Run in a disposable checkout with web/node_modules from the committed lock.
// No production entrypoint or shared prototype library is changed.
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,mkdirSync,readdirSync} from 'node:fs';
import {dirname,resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const here=dirname(fileURLToPath(import.meta.url)),root=resolve(here,'../../../..');
const require=createRequire(join(root,'web/package.json'));
const {build}=require('esbuild');
const out=resolve(process.argv[2]||join(root,'design-system/prototypes/dist/onboarding-instructions-4'));
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
// The round adds a last route step, "instructions". Production's
// OnboardingFrame names a step by a closed switch (OnboardingStepId), so the
// round patches exactly that switch at build time instead of copying the
// frame: every step, the new one included, is drawn by the production frame.
// The patch is the production change the direction needs (one more step id
// and its label in onboardingFrameText); the build fails if the switch moves.
const frameFile=join(root,'web/src/components/OnboardingFrame.tsx');
const frameAnchor='const label = (id: OnboardingStepId) =>\n  id === "github"';
const stepLabel={name:'route-step-label',setup(b){
 b.onLoad({filter:/OnboardingFrame\.tsx$/},a=>{
  if(a.path!==frameFile)return undefined;
  const src=readFileSync(a.path,'utf8');
  if(!src.includes(frameAnchor))throw new Error('OnboardingFrame label switch moved; update the round patch');
  return {contents:src.replace(frameAnchor,'const label = (id: OnboardingStepId) =>\n  (id as string) === "instructions"\n    ? (globalThis as any).__roundStepLabel()\n    : id === "github"'),loader:'tsx'};
 });
}};
const result=await build({plugins:[stepLabel,rawPicker,viteUrl,exactCase],entryPoints:[join(here,'round.tsx')],bundle:true,write:false,outfile:'prototype.js',platform:'browser',format:'iife',jsx:'automatic',nodePaths:[join(root,'web/node_modules')],loader:{'.module.css':'local-css','.woff2':'dataurl','.woff':'dataurl','.svg':'dataurl','.avif':'dataurl','.png':'dataurl','.webp':'dataurl'},define:{'process.env.NODE_ENV':'"production"','import.meta.env.VITE_SYNTHETIC_DEMO':'"false"'},minify:true,metafile:true,logLevel:'error'});
const js=result.outputFiles.find(f=>f.path.endsWith('.js')).text;
const css=result.outputFiles.find(f=>f.path.endsWith('.css')).text;
const html=styles=>`<!doctype html><html lang="fi"><head><meta charset="utf-8"><meta name="prototype-round" content="2026-11-21-onboarding-instructions-4"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Ohjeet agentille: muistilappu omin sanoin</title><style>${styles}</style></head><body><div id="root"></div><script>${js.replace(/<\/script/gi,'<\\/script')}</script></body></html>`;
writeFileSync(join(out,'offline.html'),html(css));
// Glasspad's null-origin sandbox blocks data fonts. Keep production fallback stacks.
writeFileSync(join(out,'index.html'),html(css.replace(/@font-face\s*\{[^}]*\}/g,'')));
writeFileSync(join(out,'build-inputs.json'),JSON.stringify(Object.keys(result.metafile.inputs),null,2));
console.log(out);
