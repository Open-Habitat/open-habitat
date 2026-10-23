// Run shared build.mjs first. Hosted CSP disallows data fonts; offline keeps them.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
const base=resolve(dirname(fileURLToPath(import.meta.url)),'../../dist');
const space=resolve(base,'onboarding-person-r2-space');
mkdirSync(space,{recursive:true});
writeFileSync(resolve(space,'index.html'),readFileSync(resolve(base,'2026-10-23-onboarding-person-r2.html'),'utf8').replace(/@font-face\s*\{[^}]*\}/g,''));
console.log(space);
