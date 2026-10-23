// Compose real Settings controls into the shared prototype library's stage.
// Generated JS/CSS stay local; build.mjs still owns tokens, chrome and exact picker.
import {build} from '../../../../web/node_modules/vite/dist/node/index.js';
import {readFileSync,writeFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const here=dirname(fileURLToPath(import.meta.url));
await build({root:here,configFile:false,define:{'process.env.NODE_ENV':'"production"'},logLevel:'warn',resolve:{alias:{'react-aria-components':resolve(here,'../../../../web/node_modules/react-aria-components'),react:resolve(here,'../../../../web/node_modules/react'),'react-dom':resolve(here,'../../../../web/node_modules/react-dom')}},esbuild:{jsx:'automatic'},build:{outDir:resolve(here,'.bundle'),emptyOutDir:true,lib:{entry:resolve(here,'surface.tsx'),name:'PersonR2',formats:['iife'],cssFileName:'surface',fileName:()=> 'surface.js'},rollupOptions:{output:{assetFileNames:'surface.css'}}}});
writeFileSync(resolve(here,'round.js'), 'following = false;\ndocument.querySelector(".topbar").hidden=true;\ndocument.querySelector(".composer").hidden=true;\ndocument.querySelector("#slow").closest("label").hidden=true;\n'+readFileSync(resolve(here,'.bundle/surface.js'),'utf8'));
writeFileSync(resolve(here,'round.css'),readFileSync(resolve(here,'.bundle/surface.css'),'utf8'));
export const title='Reitti rinnalla · uuden henkilön käyttöönotto · 2';
export const density=false;
export const variants=[
 {name:'Kartta',axis:'Koko reitti pysyvästi rinnalla',fn:'personMap'},
 {name:'Kompassi',axis:'Nykyvaihe ja seuraava rinnalla',fn:'personCompass'},
 {name:'Reittitasku',axis:'Reitti rinnalla vain avattaessa',fn:'personPocket'},
];
