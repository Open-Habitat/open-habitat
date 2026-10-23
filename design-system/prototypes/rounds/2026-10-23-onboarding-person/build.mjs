// Build the isolated React round, then inline it for offline/Glasspad review.
import { build } from '../../../../web/node_modules/vite/dist/node/index.js';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const here=dirname(fileURLToPath(import.meta.url));
const out=resolve(here,'../../dist/onboarding-person');
await build({root:here,configFile:false,base:'./',resolve:{alias:{react:resolve(here,'../../../../web/node_modules/react'),'react-dom':resolve(here,'../../../../web/node_modules/react-dom')}},esbuild:{jsx:'automatic'},build:{outDir:join(out,'bundle'),emptyOutDir:true,assetsInlineLimit:1000000,rollupOptions:{output:{entryFileNames:'round.js',assetFileNames:'[name][extname]'}}}});
let html=readFileSync(join(out,'bundle/index.html'),'utf8');
const js=readFileSync(join(out,'bundle/round.js'),'utf8');
let css=readFileSync(join(out,'bundle/index.css'),'utf8');
html=html.replace(/<script[^>]*src="[^"]+"[^>]*><\/script>/,'').replace(/<link[^>]*rel="stylesheet"[^>]*>/,'');
// Inline scripts are classic scripts, avoiding null-origin module CORS.
html=html.replace('</body>',()=>`<script>${js.replaceAll('</script','<\\/script')}</script></body>`);
mkdirSync(join(out,'space'),{recursive:true});
writeFileSync(join(out,'offline.html'),html.replace('</head>',()=>`<style>${css}</style></head>`));
css=css.replace(/@font-face\s*\{[^}]*\}/g,'');
writeFileSync(join(out,'space/index.html'),html.replace('</head>',()=>`<style>${css}</style></head>`));
console.log('OFFLINE '+join(out,'offline.html')); console.log('SPACE '+join(out,'space'));
