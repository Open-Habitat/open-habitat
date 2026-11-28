// node scripts/sync-landing-assets.mjs [--check]
// Makes public/landing/ hold exactly the binary assets the front page uses
// (images, video, audio, the live demo's HTML), copied from
// $ETUSIVU_ASSETS/<id>/<name>, where the workers that make them leave them
// outside git. Files the page no longer uses are removed. Exits 1 listing the
// assets the page uses that the source does not have. With --check it
// changes nothing and exits 1 when public/landing/ is not in sync.
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import path from 'node:path';
import { renderLanding, landingAssetsDir } from '../landing.mjs';

// Same bytes in both files (a missing destination is not the same).
const cmpSync = (a, b) => existsSync(b) && statSync(a).size === statSync(b).size && readFileSync(a).equals(readFileSync(b));

const check = process.argv.includes('--check');
const source = process.env.ETUSIVU_ASSETS;
if (!source) {
  console.error('set ETUSIVU_ASSETS to the directory that holds the assets as <id>/<name>');
  process.exit(2);
}
const { assets } = await renderLanding();
const wanted = new Set(assets.map(({ id, name }) => path.join(id, name)));

const missing = [...wanted].filter((f) => !existsSync(path.join(source, f)));
if (missing.length) {
  console.error(`the page uses ${missing.length} asset(s) not in ${source}:`);
  for (const f of missing) console.error(`  ${f}`);
  process.exit(1);
}

const present = existsSync(landingAssetsDir)
  ? readdirSync(landingAssetsDir, { recursive: true }).filter((f) => statSync(path.join(landingAssetsDir, f)).isFile())
  : [];
const stale = present.filter((f) => !wanted.has(f));
const changed = [...wanted].filter((f) => !cmpSync(path.join(source, f), path.join(landingAssetsDir, f)));

if (check) {
  for (const f of changed) console.error(`out of date: ${f}`);
  for (const f of stale) console.error(`not used: ${f}`);
  process.exit(changed.length || stale.length ? 1 : 0);
}
for (const f of changed) {
  mkdirSync(path.dirname(path.join(landingAssetsDir, f)), { recursive: true });
  copyFileSync(path.join(source, f), path.join(landingAssetsDir, f));
  console.log(`copied  ${f}`);
}
for (const f of stale) {
  rmSync(path.join(landingAssetsDir, f));
  console.log(`removed ${f}`);
}
// Directories left empty by a removal.
if (existsSync(landingAssetsDir)) {
  for (const d of readdirSync(landingAssetsDir)) {
    const p = path.join(landingAssetsDir, d);
    if (statSync(p).isDirectory() && readdirSync(p, { recursive: true }).length === 0) rmSync(p, { recursive: true });
  }
}
const bytes = [...wanted].reduce((n, f) => n + statSync(path.join(landingAssetsDir, f)).size, 0);
console.log(`${path.relative(process.cwd(), landingAssetsDir)}: ${wanted.size} files, ${(bytes / 1e6).toFixed(2)} MB (${changed.length} copied, ${stale.length} removed)`);
