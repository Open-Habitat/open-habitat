// Alice · 08:34 · Northside prices. Last week's margin checker runs on Bob's
// new supplier list. Everything the screen shows of the run is real:
// checker/run.txt is the true stdout of `python3 tools/margin_check.py
// inbox/northside-2027.csv` on the fictional files checker/make_data.py
// writes, and the chart in the view is the PNG the checker drew (assets.mjs
// makes both). The reply's figures are read from run.txt, so they cannot drift.
// The block contract is in ../../BLOCKS.md.
import { readFileSync } from 'node:fs';
import { you, tool, turn, screen, view, image, assets } from '../../engine/kit.mjs';

const asset = assets(import.meta.url);
const RUN = readFileSync(new URL('./checker/run.txt', import.meta.url), 'utf8').trimEnd();

// The first lines of the supplier file as `head -4` prints them (assets.mjs).
const HEAD = readFileSync(new URL('./checker/head.txt', import.meta.url), 'utf8').trimEnd();

// The flagged rows of the run: name, cost 2026, cost 2027, margin, was.
const lines = RUN.split('\n');
const at = lines.findIndex((l) => l.startsWith('UNDER '));
const under = [];
for (const l of lines.slice(at + 1)) {
  const m = l.match(/^(.+?)\s{2,}([\d.]+)\s+([\d.]+)\s+([\d.]+) %\s+([\d.]+) %$/);
  if (!m) break;
  under.push({ name: m[1], c26: +m[2], c27: +m[3], margin: m[4], was: m[5] });
}
const near = (RUN.match(/^close .*$/m) || [''])[0].split(': ')[1]?.split('; ').length || 0;
const total = RUN.match(/(\d+) of (\d+) under/);
const rises = under.map((r) => Math.round((r.c27 / r.c26 - 1) * 100));
const avg = RUN.match(/\+([\d.]+) % on average/)[1];
const WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six'];
const n = WORDS[under.length] || String(under.length);

// 'Napkins, set of 4, natural' -> 'natural napkins (set of 4)'
const short = (name) => { const [base, ...rest] = name.split(', '); const v = rest.pop(); return `${v} ${base.toLowerCase()}${rest.length ? ` (${rest.join(', ')})` : ''}`; };
const list = (xs) => xs.length > 1 ? `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}` : xs.join('');

export default {
  id: 'alice-02-northside-prices',
  kind: 'glimpse',
  day: 'alice',
  s: 'prices',
  at: '08:34',
  ask: 'Run last week’s margin check on Bob’s new price list.',
  did: 'Last week Alice and her agent wrote a small checker that holds a supplier’s prices against the shop’s own. It is still in her folder. On the tram she points it at Northside’s 2027 list, and four of 64 products come out under her line.',
  screen: () => screen('Northside prices', you('08:30', 'Run last week’s margin check on Bob’s new price list.') + turn({
    thoughts: ['Last week’s checker is tools/margin_check.py; it takes a supplier CSV and reads the catalogue for shelf prices'],
    tools: [
      tool('bash', 'git log -1 --format="%h %ad %s" --date=short -- tools/margin_check.py', '3f2d1aa 2026-11-12 Add margin check for supplier price lists'),
      tool('bash', 'gog gmail attachment "Northside price list 2027" --out inbox/', 'saved inbox/northside-2027.csv'),
      tool('bash', 'head -4 inbox/northside-2027.csv', HEAD),
      tool('bash', 'python3 tools/margin_check.py inbox/northside-2027.csv', RUN),
    ],
    time: '3 min 52 s',
    reply: `**${n} of ${total[2]} products** fall under your 40 % margin at Northside’s 2027 prices: ${list(under.map((r) => `${short(r.name)} ${r.margin} %`))}. Their cost rose ${Math.min(...rises)}–${Math.max(...rises)} %; the rest of the list about ${Math.round(+avg)} %.${near ? ` ${WORDS[near] || near} more sit just above the line.` : ''}\n\nShall I send Bob the table and ask what Northside says?`,
  }), view('reports/northside-2027.png', `<picture><source media="(max-width: 520px)" srcset="${asset('northside-2027-narrow.webp')}" width="704" height="1148">${image(asset('northside-2027.webp'),
    `Chart from the margin check: the eight lowest margins at Northside’s 2027 cost, each with its 2026 margin. ${under.map((r) => `${r.name} ${r.margin} % (was ${r.was} %)`).join(', ')} fall under the 40 % line; the rest stay above it.`,
    1056, 790)}</picture>`)),
};
