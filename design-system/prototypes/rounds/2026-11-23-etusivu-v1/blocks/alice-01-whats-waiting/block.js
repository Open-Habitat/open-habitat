// Alice · 08:04 · What’s waiting today. Her notes from yesterday, the night’s
// mail and today’s calendar become one calm page in the view: the day as a
// bar, then five things, each tagged with the source it came from.
// The block contract is in ../../BLOCKS.md.
import { you, tool, turn, screen, view, esc } from '../../engine/kit.mjs';

const NOTES = `# Open
- [ ] December newsletter: everyone who bought this year
- [ ] Market video from Saturday’s clips
- [ ] Returns go to 30 days on 1 Dec: handbook and site`;

const MAIL = `14 messages
07:31  Bob             Northside price list 2027          [csv]
06:50  Kirsi           October: 26 card charges without a receipt
06:12  Shop            Order #2291 paid · 2 items
05:58  Northline Post  Parcel 4471 delivered
05:40  Shop            Order #2290 paid · 1 item
02:15  Linen Weekly    Winter fairs issue
23:52  Shop            Order #2289 paid · 3 items
23:10  Card company    Receipt: studio electricity
22:41  Carol           Re: planning agenda (accepted)
21:30  Northline Post  Parcel 4468 delivered
21:02  Shop            Order #2288 paid · 1 item
20:47  Market Hall     Saturday stall: thank you
19:55  Craft Monthly   December issue
19:20  Card company    Receipt: packing tape`;

const CAL = `10:15–11:00  Planning with Bob and Carol   (note: record it)
15:40–16:40  Packing orders with Bob`;

// The source tag on each line: what kind, and exactly where.
const IC = {
  mail: '<path d="M3.5 6h17v12h-17z"/><path d="m3.5 7 8.5 6 8.5-6"/>',
  note: '<path d="M6 3.5h9l3 3v14H6z"/><path d="M9 10h6M9 14h6"/>',
  cal: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',
  site: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
};
const src = (kind, text) => `<span class="ww-src"><svg viewBox="0 0 24 24" aria-hidden="true">${IC[kind]}</svg>${esc(text)}</span>`;
const item = (title, line, sources, tag = '') => `<li class="ww-item"><p class="ww-line"><b>${esc(title)}</b><span>${esc(line)}</span>${sources.join('')}</p>${tag ? `<span class="ww-tag">${esc(tag)}</span>` : ''}</li>`;

// The day as a bar from 08 to 18, with the two meetings and where she is now.
const H0 = 8, H1 = 18;
const pos = (t) => { const [h, m] = t.split(':').map(Number); return (((h + m / 60) - H0) / (H1 - H0) * 100).toFixed(2); };
const span = (a, b, label) => `<span class="ww-ev" style="left:${pos(a)}%;width:${(pos(b) - pos(a)).toFixed(2)}%"><b>${a}</b><span>${esc(label)}</span></span>`;
const dayBar = `<div class="ww-day" aria-label="Today: planning with Bob and Carol 10:15 to 11:00, packing orders with Bob 15:40 to 16:40">
  <div class="ww-track" aria-hidden="true">${span('10:15', '11:00', 'Planning · record it')}${span('15:40', '16:40', 'Packing · Bob')}<span class="ww-now" style="left:${pos('08:04')}%"><i>08:04</i></span></div>
  <div class="ww-hours" aria-hidden="true">${[8, 10, 12, 14, 16, 18].map((h) => `<span style="left:${pos(`${h}:00`)}%">${String(h).padStart(2, '0')}</span>`).join('')}</div>
  <p class="ww-cal">${src('cal', 'Calendar · 2 events')}</p>
</div>`;

const page = `<div class="ww">
  <header class="ww-h"><h3>Five things today</h3><p class="ww-k">Thursday 19 November</p></header>
  ${dayBar}
  <ol class="ww-list">
    ${item('October receipts', '26 card charges, for Kirsi.', [src('mail', 'Kirsi · 06:50')], 'By Friday')}
    ${item('Northside’s 2027 prices', 'From Bob, for last week’s check.', [src('mail', 'Bob · 07:31 · csv')], 'Today')}
    ${item('Returns go to 30 days', 'The handbook and 16 site pages still say 14.', [src('note', 'open.md:4'), src('site', '17 files')], '1 Dec')}
    ${item('Market video', 'Thirty seconds from Saturday’s clips.', [src('note', 'open.md:3')])}
    ${item('December newsletter', 'Everyone who bought this year.', [src('note', 'open.md:2')])}
  </ol>
  <footer class="ww-f">${src('mail', '12 more')}<span>Orders, deliveries, receipts, newsletters. None needs you.</span></footer>
</div>`;

export default {
  id: 'alice-01-whats-waiting',
  kind: 'glimpse',
  day: 'alice',
  s: 'today',
  at: '08:04',
  ask: 'What’s waiting for me today?',
  did: 'Her agent reads the notes she left herself yesterday, the mail that came in overnight and today’s calendar. Two minutes later the morning is one short page: five things, two meetings, and beside every line where it came from.',
  screen: () => screen('What’s waiting today', you('08:02', 'What’s waiting for me today?') + turn({
    thoughts: ['Yesterday’s open items are in notes/open.md; then mail since yesterday evening and today’s calendar'],
    tools: [
      tool('read', 'notes/open.md', NOTES),
      tool('bash', 'gog gmail search "newer_than:1d"', MAIL),
      tool('bash', 'gog calendar events --today', CAL),
      tool('bash', 'grep -rl "14 days" handbook/ site/ | cut -d/ -f1 | uniq -c', '      1 handbook\n     16 site'),
      tool('write', 'today.html', '', 'new · 86 lines'),
    ],
    time: '2 min 07 s',
    reply: 'Five things today, two with a date: **Kirsi’s receipts by Friday** and **Bob’s Northside prices**. Every line on the page says where it came from.',
  }), view('today.html', page)),
};
