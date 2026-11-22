import {execFileSync} from 'node:child_process';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const here=dirname(fileURLToPath(import.meta.url));
const out=resolve(process.argv[2] || resolve(here,'../../dist/2026-11-22-server-browser-control.html'));
execFileSync(process.execPath,[resolve(here,'../../build.mjs'),here,'--out',out],{stdio:'inherit'});
