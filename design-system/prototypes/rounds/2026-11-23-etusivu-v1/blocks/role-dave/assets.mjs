// node blocks/role-dave/assets.mjs: Dave's two showpieces, made by the programs the scenes name.
//
// 1. The December rota: tools/rota_model.py solves 23 invented rules and 19
//    wishes with OR-Tools CP-SAT and checks the result against every rule again.
// 2. The personnel file: tools/make_file.py writes eleven invented documents,
//    Chromium prints them to PDF, tools/redact.py removes other people's
//    details with PyMuPDF redactions, and Poppler's pdftotext reads the result
//    back to show the names are gone.
//
// Binaries go to $ETUSIVU_ASSETS/role-dave/ (two page renders and the redacted
// PDF the reader can open). The numbers and texts the screens quote go to
// data.json beside this file, which is committed: block.js draws the rota grid
// and every tool output from it, so nothing on the screen is typed by hand.
//
// Needs uv (Python with ortools and pymupdf), pdftotext, ImageMagick, and
// Playwright's Chromium from PROTO_WEB (as check.mjs). Set TMPDIR to your
// scratch. ROLE_DAVE_PYTHON=<python with both packages> skips uv.
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir, homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../../../../..');
const out = join(process.env.ETUSIVU_ASSETS || join(homedir(), 'src/open-habitat-dev/worker-results/etusivu-assets'), 'role-dave');
mkdirSync(out, { recursive: true });
const scratch = mkdtempSync(join(tmpdir(), 'role-dave-'));
const VERSIONS = { ortools: '9.15.6755', pymupdf: '2.1' };
const PY = process.env.ROLE_DAVE_PYTHON ? [process.env.ROLE_DAVE_PYTHON, '-B'] : ['uv', 'run', '--no-project', '--with', `ortools==${VERSIONS.ortools}`, '--with', `pymupdf==${VERSIONS.pymupdf}`, 'python3', '-B'];
const run = (cmd, args, o = {}) => execFileSync(cmd, args, { encoding: 'utf8', maxBuffer: 64e6, ...o });
const py = (args) => run(PY[0], [...PY.slice(1), ...args]);
const lines = (s) => s.trim().split('\n');

// ---------- 1. The rota ----------
const model = join(here, 'tools/rota_model.py');
const rota = JSON.parse(py([model, '--json']));
const rotaLog = lines(py([model]));
if (rota.failed.length) throw new Error(`rota: rules ${rota.failed} do not hold`);

// ---------- 2. The personnel file ----------
const file = join(scratch, 'former-2024');
const red = join(scratch, 'out');
const made = py([join(here, 'tools/make_file.py'), file, join(root, 'design-system/fonts')]).trim();
const require = createRequire(join(process.env.PROTO_WEB || join(root, 'web'), 'package.json'));
const { chromium } = require('playwright');
const browser = await chromium.launch();
const page = await browser.newPage();
for (const f of readdirSync(file).filter((x) => x.endsWith('.html'))) {
  await page.goto(pathToFileURL(join(file, f)).href);
  await page.evaluate(() => document.fonts.ready);
  await page.pdf({ path: join(file, f.replace('.html', '.pdf')), preferCSSPageSize: true });
}
await browser.close();
const redactLog = lines(py([join(here, 'tools/redact.py'), file, red]));

// The check: read every PDF back with another program (Poppler) and count the
// lines that still hold one of the six other people's names.
const NAMES = ['Mikael Strand', 'Tessa Rowe', 'Jonas Feld', 'Ida Marsh', 'Peter Voss', 'Hanna Brook'];
const pdfs = (dir) => readdirSync(dir).filter((x) => x.endsWith('.pdf')).sort();
const text = (dir, args = []) => pdfs(dir).map((f) => run('pdftotext', [...args, join(dir, f), '-'])).join('\n');
const hits = (s) => s.split('\n').filter((l) => NAMES.some((n) => n.split(' ').some((w) => new RegExp(`\\b${w}\\b`).test(l)))).length;
const before = hits(text(file));
const after = hits(text(red));
if (after) throw new Error(`redaction: ${after} lines still name somebody else`);
const SHOW = '04-shift-record-2024-03.pdf';
const shown = run('pdftotext', ['-layout', join(red, SHOW), '-']);
const meta = (dir) => JSON.parse(py(['-c', 'import json, sys, pymupdf; print(json.dumps(pymupdf.open(sys.argv[1]).metadata))', join(dir, SHOW)]));

// The page before and after, rendered from the PDFs by MuPDF and cropped to the text.
const W = 1200;
for (const [dir, name] of [[file, 'page-original'], [red, 'page-redacted']]) {
  const png = join(scratch, `${name}.png`);
  py(['-c', 'import sys, pymupdf; p = pymupdf.open(sys.argv[1])[0]; z = int(sys.argv[3]) / p.rect.width; p.get_pixmap(matrix=pymupdf.Matrix(z, z)).save(sys.argv[2])', join(dir, SHOW), png, String(W)]);
  run('convert', [png, '-crop', '1090x930+55+85', '+repage', '-quality', '86', '-define', 'webp:method=6', join(out, `${name}.webp`)]);
}
copyFileSync(join(red, SHOW), join(out, 'shift-record-redacted.pdf'));

const data = {
  versions: { ...VERSIONS, pdftotext: run('pdftotext', ['-v'], { stdio: ['ignore', 'pipe', 'pipe'] }).trim() || lines(execFileSync('sh', ['-c', 'pdftotext -v 2>&1'], { encoding: 'utf8' }))[0] },
  rota: { ...rota, log: rotaLog },
  redact: { made, log: redactLog, names: NAMES.length, before, after, documents: pdfs(red).length, shown: SHOW, text: shown, metaBefore: meta(file), metaAfter: meta(red) },
};
writeFileSync(join(here, 'data.json'), `${JSON.stringify(data, null, 1)}\n`);
console.log(rotaLog.join('\n'));
console.log(redactLog.at(-1));
console.log(`names: ${before} lines before, ${after} after`);
console.log(run('identify', ['-format', '%f %wx%h %b\n', join(out, 'page-original.webp'), join(out, 'page-redacted.webp')]).trim());
