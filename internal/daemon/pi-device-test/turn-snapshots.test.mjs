// The turn-snapshot recorder's own suites (../turn-snapshots/test), kept as
// they are written for better-pi-rewind so a later upstream pull request is
// the same code. Node strips their types; the hook resolves the Pi SDK from
// this package.
import { register } from 'node:module';
import { readdirSync } from 'node:fs';

register('./turn-snapshots-resolve.mjs', import.meta.url);
const dir = new URL('../turn-snapshots/test/', import.meta.url);
for (const name of readdirSync(dir).filter((n) => n.endsWith('.test.ts')).sort()) await import(new URL(name, dir));
