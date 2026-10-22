// Only a generated synthetic HTML file enters the hosted space, never repo data.
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {dirname,resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const here=dirname(fileURLToPath(import.meta.url));
const space=resolve(here,'../../dist/start-page-space');
mkdirSync(space,{recursive:true});
execFileSync(process.execPath,[resolve(here,'../../build.mjs'),here,'--out',join(space,'index.html')]);
writeFileSync(join(space,'index.html'),readFileSync(join(space,'index.html'),'utf8').replace(/@font-face\s*\{[^}]*\}/g,''));
console.log(space);
