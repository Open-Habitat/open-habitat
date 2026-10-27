// node build.mjs [out-dir]: one self-contained HTML from production components.
// Needs web/node_modules from the committed lock. Nothing in web/ changes:
// the round's composer chip enters by redirecting the composer's own
// AttachmentChips import to chips.tsx, which wraps the production component.
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {dirname,resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const here=dirname(fileURLToPath(import.meta.url)),root=resolve(here,'../../../..');
const require=createRequire(join(root,'web/package.json'));
const {build}=require('esbuild');
const out=resolve(process.argv[2]||join(root,'design-system/prototypes/dist/tavoite-mukana'));
mkdirSync(out,{recursive:true});
const rawPicker={name:'raw-picker',setup(b){
 b.onResolve({filter:/\?raw$/},a=>({path:resolve(a.resolveDir,a.path.slice(0,-4)),namespace:'raw'}));
 b.onLoad({filter:/.*/,namespace:'raw'},a=>({contents:readFileSync(a.path,'utf8'),loader:'text'}));
}};
// Vite's ?url assets (the PDF worker) are never used by this round.
const viteUrl={name:'vite-url',setup(b){
 b.onResolve({filter:/\?url$/},a=>({path:a.path,namespace:'vite-url'}));
 b.onLoad({filter:/.*/,namespace:'vite-url'},()=>({contents:'export default ""',loader:'js'}));
}};
const composerChip={name:'composer-chip',setup(b){
 b.onResolve({filter:/\/AttachmentChips$/},a=>a.importer.endsWith(join('composer','Composer.tsx'))?{path:join(here,'chips.tsx')}:undefined);
}};
const result=await build({plugins:[rawPicker,viteUrl,composerChip],entryPoints:[join(here,'round.tsx')],bundle:true,write:false,outfile:'prototype.js',platform:'browser',format:'iife',jsx:'automatic',nodePaths:[join(root,'web/node_modules')],loader:{'.module.css':'local-css','.woff2':'dataurl','.woff':'dataurl','.svg':'dataurl'},define:{'process.env.NODE_ENV':'"production"','import.meta.env.VITE_SYNTHETIC_DEMO':'"false"'},minify:true,logLevel:'error'});
const js=result.outputFiles.find(f=>f.path.endsWith('.js')).text;
const css=result.outputFiles.find(f=>f.path.endsWith('.css')).text;
const html=`<!doctype html><html lang="fi" data-theme="light"><head><meta charset="utf-8"><meta name="prototype-round" content="2026-10-27-tavoite-mukana"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Tavoite mukana keskustelussa</title><style>${css}</style></head><body><div id="root"></div><script>${js.replace(/<\/script/gi,'<\\/script')}</script></body></html>`;
writeFileSync(join(out,'index.html'),html);
console.log(join(out,'index.html'));
