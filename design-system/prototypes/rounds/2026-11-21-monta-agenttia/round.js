// Round 4 of the landing page's day: how one person's many agent sessions, at
// once and in sequence, are shown so that a reader grasps them at a glance.
// The day is written once (SESS, PLACES, G) and drawn in three forms: the
// product's own sidebar replayed as one scrolls, lanes over a clock, and a strip
// of moments. Round 2's hero sits above and a short stub below. People,
// organisations and addresses are invented (example.org). The screens are
// drawn with the prototype library's conversation language (lib/language.css).
// build.mjs defines IMG and VARIANTS; lib/markdown.js gives esc, inline and md;
// lib/icons.js gives ICON_CHECK and CHEV; lib/picker.js expects `stage` and
// `variants`.
const stage = document.getElementById('stage');

const REPO = 'https://github.com/Open-Habitat/open-habitat';
const RING = 'M9 -2v6a5 5 0 0 1-5 5h-8a5 5 0 0 1-5-5v-8a5 5 0 0 1 5-5h8a5 5 0 0 1 5 5z';
const mark = (px = 22, state = 'idle') => `<svg class="oh-mark" data-state="${state}" viewBox="-12 -12 24 24" width="${px}" height="${px}" aria-hidden="true"><path class="oh-ring" pathLength="100" d="${RING}"/><circle class="oh-dot" r="2.5"/></svg>`;
const heroPic = () => { const i = IMG.hero; return `<img class="hero-img" src="${i.src}" width="${i.w}" height="${i.h}" alt="A conversation with an agent in Open Habitat on a desktop browser, with running and waiting conversations in the sidebar, and the same conversation on a phone">`; };
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- Round 2's hero, unchanged in all three ----------
const hero = (i) => `<p class="rq-line" lang="fi"><b>${i + 1}/3 ${VARIANTS[i][0]}.</b> ${VARIANTS[i][1]} <span>1–3 tai ←/→ vaihtaa</span></p>
<header class="top"><a class="brandword" href="#">${mark(24)} Open Habitat</a><nav><a href="#day">A day</a><a href="#install">Install</a><a href="${REPO}">GitHub</a></nav></header>
<section class="hero">
  <p class="eyebrow">Open source · on your own server · pre-release 0.1</p>
  <h1>Coding-grade AI agents <br>for your whole team.</h1>
  <p class="lede">No terminal required. Everyone gets a real agent with its own Linux account, in a browser tab. One person sets up one server; everyone else signs in and gets to work.</p>
  <p class="cta"><a class="btn" href="#install">Install on your server</a><a class="btn ghost" href="#day">See a day</a></p>
</section>
<figure class="hero-band">${heroPic()}</figure>`;

const intro = (how) => `<section class="day-intro" id="day">
  <p class="kicker">One person, one day</p>
  <h2>Alice’s Thursday, eight agents.</h2>
  <p>Alice runs Example Studio, a small shop for hand-printed linen, with a website and a staff handbook. Bob handles orders and suppliers. On Thursday she started eight conversations with her agents: some were done in a minute, one worked through lunch. ${how}</p>
</section>`;
const dayEnd = `<section class="day-end"><p>At 17:40 one conversation still waits for her: the newsletter goes out when she says so. Tomorrow her agents start from what this one wrote down, and so do Bob’s.</p></section>`;

// ---------- The stub below the day: the rest of the page is not this round's ----------
const stub = `<section class="stub" id="install">
  <p class="kicker">The rest of the page</p>
  <h2>Alice had nothing to set up. Somebody did, once.</h2>
  <p>One person who administers a Linux server installs Open Habitat for the team, by giving their coding agent the operator guide. After that, everyone signs in with a browser and gets an agent of their own.</p>
  <p class="cta"><a class="btn" href="${REPO}">Install on your server</a><a class="btn ghost" href="${REPO}#limits">What it does not do</a></p>
  <p class="stub-note">Install, limits and the pre-release note follow here, as in round 2.</p>
</section>
<footer class="foot"><span class="brandword">${mark(18)} Open Habitat</span><span>Free and open source under the MIT License.</span><a href="${REPO}">GitHub</a><a href="${REPO}/releases">Releases</a><span class="quiet">This page sets no cookies and loads nothing from anywhere else.</span></footer>`;

// ---------- The conversation language: small builders over lib/language.css ----------
const FILE_IC = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/></svg>';
const MAIL_IC = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>';
const MIC_IC = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>';
const you = (time, text, extra = '', note = '') => `<article class="bubble user"><div class="bubble-head"><span class="who">You</span><time class="meta">${time}</time></div><div class="prose">${md(text)}</div>${extra}${note ? `<p class="u-note">${note}</p>` : ''}</article>`;
const att = (name, meta) => `<p class="att">${FILE_IC}<span class="att-n">${esc(name)}</span><span class="att-m">${esc(meta)}</span></p>`;
// Tool rows are closed as in the product; `open` shows the output that carries the glimpse.
const tool = (name, target, out = '', open = false) => `<section class="tool"><button class="disc" type="button" aria-expanded="${open}">${CHEV}<span class="names"><span class="name">${esc(name)}</span><span class="target">${esc(target)}</span></span><span class="ok">${ICON_CHECK}done</span></button><div class="tool-body"${open ? '' : ' hidden'}><pre>${esc(out || 'ok')}</pre></div></section>`;
const reply = (text, extra = '') => `<article class="bubble reply"><div class="prose">${md(text)}</div>${extra}</article>`;
const offer = (name, meta) => `<div class="offer">${FILE_IC}<span class="offer-n">${esc(name)}<small>${esc(meta)}</small></span><button type="button" class="offer-b" data-done="Saved to Downloads">Download</button></div>`;
const workers = (rows) => `<div class="wk" role="group" aria-label="Workers"><p class="wk-h">Workers <span>${rows.length}</span></p><ul>${rows.map(([state, name, task, prog]) => `<li class="wk-${state}"><span class="wk-dot" aria-hidden="true"></span><b>${esc(name)}</b><span class="wk-t">${esc(task)}</span><span class="wk-p">${esc(prog)}</span></li>`).join('')}</ul></div>`;
const drafts = (rows) => `<ul class="drafts">${rows.map(([state, to, subj, first]) => `<li class="dr dr-${state.split(' ')[0]}">${MAIL_IC}<span class="dr-main"><span class="dr-to">To ${esc(to)}</span><b>${esc(subj)}</b><span class="dr-first">${esc(first)}</span></span><span class="dr-s">${esc(state)}</span></li>`).join('')}</ul>`;
const diff = (file, lines, label = '') => `<div class="diff"><p class="diff-h">${FILE_IC}<span>${esc(file)}</span>${label ? `<small>${esc(label)}</small>` : ''}</p><pre>${lines.map((l) => `<span class="${l[0] === '+' ? 'add' : l[0] === '-' ? 'del' : 'ctx'}">${esc(l)}</span>`).join('')}</pre></div>`;
// One agent turn on the rail: a head, the work, and the reply on the last node.
function pi(rows, answer, sum = '') {
  const cells = [`<div class="rail-cell first"><span class="node head" aria-hidden="true"></span></div><div class="cell"><div class="head-cell"><span class="who">Pi</span><span class="sum">${sum}</span></div></div>`];
  for (const r of rows) cells.push(`<div class="rail-cell"><span class="node${r.startsWith('<section class="tool"') ? ' tool done' : ''}" aria-hidden="true"></span></div><div class="cell">${r}</div>`);
  cells.push(`<div class="rail-cell last"><span class="node done" aria-hidden="true"></span></div><div class="cell">${answer}</div>`);
  return `<div class="turn">${cells.join('')}</div>`;
}
// A conversation in a slim window: its title, and a view opened beside it.
const screen = (title, body, view = '') => `<div class="scr${view ? ' has-view' : ''}"><div class="scr-bar">${mark(14)}<b>${esc(title)}</b><span>Example Studio</span></div><div class="scr-main"><div class="scr-convo">${body}</div>${view}</div></div>`;
const viewPane = (title, html) => `<aside class="scr-view" aria-label="View: ${esc(title)}"><p class="scr-view-h">${FILE_IC}<span>${esc(title)}</span><small>View</small></p><div class="scr-view-b">${html}</div></aside>`;

// =====================================================================
// The day, written once
// =====================================================================
const T = (s) => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };
const hhmm = (t) => `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
const DAY0 = T('08:00'), DAY1 = T('18:00');
const pctT = (t) => +(((t - DAY0) / (DAY1 - DAY0)) * 100).toFixed(3);

const ICONS = {
  home: '<path d="M4 11 12 4l8 7"/><path d="M6 10v10h12V10"/>',
  tram: '<rect x="6" y="4" width="12" height="13" rx="3"/><path d="M6 11h12M9 20l-1.5 2M15 20l1.5 2M10 2h4"/><circle cx="9.5" cy="14" r=".6"/><circle cx="14.5" cy="14" r=".6"/>',
  studio: '<path d="M4 20h16M6 20V9l6-4 6 4v11"/><path d="M10 20v-5h4v5"/>',
  lunch: '<path d="M5 8h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5z"/><path d="M16 9h1.5a2.5 2.5 0 0 1 0 5H16M8 3v2M11 3v2"/>',
  box: '<path d="M3 8l9-4 9 4-9 4z"/><path d="M3 8v8l9 4 9-4V8M12 12v8"/>',
};
const placeIc = (k) => `<svg class="pl-ic" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${ICONS[k]}</svg>`;
// Where Alice is: the agents work wherever she is.
const PLACES = [
  ['08:00', 'At home', 'home'], ['08:25', 'On the tram', 'tram'], ['09:10', 'In the studio', 'studio'],
  ['12:20', 'Out for lunch', 'lunch'], ['13:25', 'In the studio', 'studio'],
  ['15:40', 'Packing orders with Bob', 'box'], ['17:15', 'In the studio', 'studio'], ['17:40', 'Gone home', 'home'],
];
const placeAt = (t) => PLACES.filter((p) => T(p[0]) <= t).pop() || PLACES[0];

// Each conversation's states through the day, in the product's own words.
// [time, state, the line under its title in the sidebar]
const SESS = [
  { id: 'today', title: 'What’s waiting today', segs: [['08:02', 'run', 'Reading mail and calendar'], ['08:04', 'turn', 'Four things today'], ['08:10', 'quiet', 'Read']] },
  { id: 'receipts', title: 'October receipts', segs: [['08:12', 'run', 'Searching 1,284 emails'], ['08:41', 'turn', '3 charges not found'], ['12:39', 'run', 'Searching the info inbox'], ['12:44', 'quiet', '25 of 26 filed']] },
  { id: 'video', title: 'Market video', segs: [['08:20', 'run', 'Installing a video program'], ['09:02', 'turn', 'Video ready to watch'], ['09:14', 'quiet', 'market-30s.mp4']] },
  { id: 'prices', title: 'Northside prices', segs: [['08:30', 'run', 'Running last week’s margin check'], ['08:34', 'turn', '4 products under 40 %'], ['09:15', 'run', 'Writing to Bob'], ['09:16', 'quiet', 'Sent to Bob']] },
  { id: 'banner', title: 'Shipping banner', segs: [['09:40', 'run', 'Reading the site’s history'], ['09:44', 'turn', 'Bob’s agent, Tuesday'], ['09:47', 'run', 'Editing the banner'], ['09:48', 'turn', 'Publish?'], ['09:49', 'run', 'Publishing'], ['09:50', 'quiet', 'Published']] },
  { id: 'returns', title: 'Returns: 30 days', segs: [['10:10', 'run', '5 workers'], ['13:35', 'turn', '17 pages ready to review'], ['13:50', 'run', 'Merging'], ['13:55', 'quiet', 'Merged'], ['15:30', 'run', 'Undoing one page'], ['15:32', 'quiet', 'Wholesale back to 14 days']] },
  { id: 'newsletter', title: 'December newsletter', segs: [['14:05', 'run', 'Counting this year’s buyers'], ['14:30', 'turn', 'Draft for 386 people']] },
  { id: 'wrapup', title: 'Before I go', segs: [['17:25', 'run', 'Reading back through the day'], ['17:28', 'turn', 'Saved: 3 for you, 3 for the team'], ['17:32', 'quiet', 'Saved']] },
];
const SID = Object.fromEntries(SESS.map((s) => [s.id, s]));
const segAt = (s, t) => { let cur = null; for (const g of s.segs) if (T(g[0]) <= t) cur = g; return cur; };
const STATE = { run: 'Running', turn: 'Your turn', quiet: 'Quiet' };
const MARK_STATE = { run: 'working', turn: 'waiting', quiet: 'idle' };
const counts = (t) => { const c = { turn: 0, run: 0, quiet: 0 }; for (const s of SESS) { const g = segAt(s, t); if (g) c[g[1]]++; } return c; };
const countLine = (t) => { const c = counts(t); return [c.run && `${c.run} running`, c.turn && `${c.turn} waiting for her`, c.quiet && `${c.quiet} quiet`].filter(Boolean).join(' · '); };
// Five workers inside "Returns: 30 days", for the lanes.
const WORKERS = [['Mail', '10:12', '11:20'], ['Shop floor', '10:13', '12:05'], ['Online orders', '10:13', '12:30'], ['Site', '10:14', '11:50'], ['Checker', '11:25', '13:30']];

// ---------- Mock views opened beside a conversation ----------
const CAPTIONS = ['Saturday at the market', 'Printed by hand in our studio', 'One block, one colour at a time', 'Wrapped while you wait', 'example.org/shop'];
const videoMock = () => `<div class="vid" data-vid><div class="vid-frame" data-k="0"><span class="vid-cloth" aria-hidden="true"></span><span class="vid-cap">${CAPTIONS[0]}</span><button type="button" class="vid-play" aria-label="Play">${'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>'}</button></div><div class="vid-bar"><span class="vid-prog"></span></div><p class="vid-meta"><span class="vid-t">0:00</span><span>0:30 · 5 captions</span></p></div>`;
const newsMock = () => `<div class="nl"><p class="nl-from">Example Studio <span>shop@example.org</span></p><div class="nl-img" aria-hidden="true"></div><b class="nl-h">Twelve days of linen</b><p>Our winter prints are on the shelves: indigo, rust and a new forest green, printed by hand in the studio.</p><p>Returns are now 30 days, so a gift can wait under the tree.</p><span class="nl-btn">See the winter prints</span><p class="nl-foot">You get this because you bought from us in 2026. Unsubscribe.</p></div>`;
const returnsView = () => `<ul class="files">${[['site/faq.md', 6, 3], ['site/terms.md', 2, 2], ['handbook/shop/returns.md', 4, 4], ['handbook/online/gifts.md', 3, 1], ['handbook/online/wholesale.md', 1, 1], ['… 12 more', 19, 14]].map(([f, a, d]) => `<li><span>${esc(f)}</span><b class="fa">+${a}</b><b class="fd">−${d}</b></li>`).join('')}</ul>${diff('site/faq.md', ['- You can return anything within 14 days.', '+ You can return anything within 30 days of delivery.', '+ Sale items too: the same 30 days apply.', '+ A gift can be returned by the person who received it.'])}`;
// Alice's phone at lunch: the summary of what happened while she was away, and her dictated answer.
const phoneMock = () => `<div class="ph-stage"><div class="ph" role="img" aria-label="Alice’s phone"><div class="ph-notch" aria-hidden="true"></div>
  <div class="ph-top"><b>October receipts</b><span class="ph-chips"><i class="c-turn">1 Your turn</i><i class="c-run">1 Running</i></span></div>
  <div class="ph-body">
    <div class="away"><p class="away-h">While you were away</p><p>Found and filed 23 of 26 receipts. Not found: Northside Packaging €230.00, city parking €12.60, Fjord Fonts €49.00.</p></div>
    ${you('12:38', 'The packaging one is Bob’s, ask him. Skip the parking. Fonts come to the info inbox.', '', `${MIC_IC}Dictated`)}
    ${pi([tool('bash', 'himalaya -a info search "Fjord Fonts"', '1 found · 28 Oct · invoice FF-10291.pdf', true), drafts([['sent', 'bob@example.org', 'Receipt: Northside Packaging €230', 'Hi Bob, do you have the receipt for 6 October?']])], reply('Fonts invoice filed. Asked Bob for the packaging receipt; parking marked *no receipt*. **25 of 26** done.'))}
  </div>
  <div class="ph-comp">${MIC_IC}<span>Message</span></div></div></div>`;

// ---------- The ten glimpses ----------
// Each: the conversation it belongs to, when it comes back to her, her ask in her
// own words, what happened in one paragraph, a one-line caption for overviews,
// and the screen.
const G = [
  {
    s: 'today', at: '08:04', ask: 'What’s waiting for me today?',
    line: 'Reads yesterday’s notes, the night’s mail and today’s calendar.',
    did: 'Her agent reads the notes she left in her folder yesterday, her mail since then and today’s calendar, and puts them on one screen.',
    screen: () => screen('What’s waiting today', you('08:02', 'What’s waiting for me today?') + pi([
      tool('read', 'notes/open.md', '- [ ] December newsletter: everyone who bought this year\n- [ ] Market video from Saturday’s clips\n- [ ] Returns go to 30 days on 1 Dec: handbook and site'),
      tool('bash', 'gog gmail search "newer_than:1d"', '14 messages\n07:31  Bob     Northside price list 2027 (xlsx)\n06:50  Kirsi   October: receipts missing for 26 card charges\n…', true),
      tool('bash', 'gog calendar events --today', 'nothing before 16:00 · 15:40 packing with Bob'),
    ], reply('Four things today:\n\n1. **Receipts.** Kirsi needs them for 26 October card charges by Friday.\n2. **Northside’s new price list** from Bob, 07:31.\n3. **The market video** from Saturday’s clips.\n4. **Returns go to 30 days** on 1 December; the handbook and the site still say 14.\n\nThe December newsletter is still open from yesterday.'), '3 tools')),
  },
  {
    s: 'prices', at: '08:34', ask: 'Run last week’s margin check on Bob’s new price list.',
    line: 'Runs the margin check it wrote with her last week: four products fall under 40 %.',
    did: 'Last week Alice and her agent wrote a small program that checks a supplier’s prices against the shop’s own. It is still in her folder, and today it runs on the new list from the tram.',
    screen: () => screen('Northside prices', you('08:30', 'Run last week’s margin check on Bob’s new price list.') + pi([
      tool('bash', 'git log --oneline -- tools/margin_check.py', '3f2d1aa  13 Nov  Add margin check for supplier price lists', true),
      tool('bash', 'gog gmail attachment "Northside price list 2027"', 'saved inbox/northside-prices-2027.xlsx · 148 rows'),
      tool('bash', 'python3 tools/margin_check.py inbox/northside-prices-2027.xlsx', '148 products · 144 at 40 % or more\nunder 40 %: 4', true),
    ], reply('Four products fall under your 40 % margin at Northside’s new prices:\n\n| Product | Cost | Price | Margin |\n|---|---|---|---|\n| Linen tote | €14.20 | €22 | 35 % |\n| Apron, indigo | €24.50 | €39 | 37 % |\n| Tea towels, 2 | €11.80 | €19 | 38 % |\n| Napkins, 4 | €17.10 | €28 | 39 % |'), '3 tools') + you('09:15', 'Send Bob that table and ask what Northside says.') + pi([], reply('Sent from your mailbox.', drafts([['sent', 'bob@example.org', 'Northside 2027: four products under 40 %', 'Hi Bob, the margin check flags four products…']])))),
  },
  {
    s: 'receipts', at: '08:41', ask: 'Find the receipts for October’s card charges and file them for Kirsi.',
    line: 'Searches 1,284 emails, matches 23 of 26 charges, names and files the receipts.',
    did: 'It reads the card statement, searches every email since late September for attachments, matches each charge by amount and date in a short program, and files the receipts under one naming rule. Three it cannot find, so it asks.',
    screen: () => screen('October receipts', you('08:12', 'Find the receipts for October’s card charges and file them for Kirsi.', att('statement-2026-10.pdf', 'Card statement · 2 pages')) + pi([
      tool('bash', 'pdftotext statement-2026-10.pdf -', '26 charges · €2,914.60'),
      tool('bash', 'gog gmail search "has:attachment after:2026/09/25" --all', '1,284 messages · 212 with a PDF or image attached', true),
      tool('write', 'bookkeeping/match_receipts.py', '48 lines'),
      tool('bash', 'python3 bookkeeping/match_receipts.py', 'matched 23 of 26 (amount, and date within 3 days)\nsaved bookkeeping/2026-10/2026-10-03 Paper Mill Supply 184.20.pdf\n… 22 more\nnot found: 3', true),
    ], reply('**23 of 26** are in *bookkeeping/2026-10*, named date, vendor, amount. Not in your mail:\n\n| Date | Charge | Amount |\n|---|---|---|\n| 6 Oct | Northside Packaging | €230.00 |\n| 14 Oct | City parking | €12.60 |\n| 28 Oct | Fjord Fonts | €49.00 |\n\nDo you know where these are?'), '4 tools')),
  },
  {
    s: 'video', at: '09:02', ask: 'Cut Saturday’s market clips into a 30-second video for the shop page, with captions.',
    line: 'Finds no video program on the server, installs one in her account, cuts the clips.',
    did: 'The clips are on her laptop. The agent copies them over, finds that the server has no video program, installs one into her own account, and cuts and captions the video. She watches it on the tram.',
    screen: () => screen('Market video', you('08:20', 'Cut Saturday’s market clips into a 30-second video for the shop page, with captions.') + pi([
      tool('computer', 'Alice’s laptop › Pictures › Market 15 Nov', '3 clips · 4K · 6 min 12 s in all\ncopied to video/market-2026-11-15/'),
      tool('bash', 'ffmpeg -version', 'bash: ffmpeg: command not found', true),
      tool('bash', 'install ffmpeg into ~/.local/bin', 'downloaded ffmpeg 7.1, static build, 79 MB\ninstalled for alice only; no administrator rights needed', true),
      tool('write', 'video/market-2026-11-15/captions.srt', '5 captions'),
      tool('bash', 'ffmpeg -i stall.mov -i print.mov -i wrap.mov -filter_complex … market-30s.mp4', '30.0 s · 1080p · 14 MB'),
    ], reply('A 30-second cut with five captions: the stall, printing, wrapping. It is open beside this conversation.', offer('market-30s.mp4', 'Video · 30 s · 14 MB')), '5 tools'), viewPane('market-30s.mp4', videoMock())),
  },
  {
    s: 'banner', at: '09:44', ask: 'Our site says “Free shipping over €30”. Who put that there, and why?',
    line: 'Finds the change in the site’s history: Bob’s agent, on Tuesday, and Bob’s reason.',
    did: 'The website lives in a shared folder where every change has an author, a time and a reason. Her agent looks up the change that added the line: it was Bob’s agent, on Bob’s word. She adds an end date, and it publishes when she says yes.',
    screen: () => screen('Shipping banner', you('09:40', 'Our site says “Free shipping over €30”. Who put that there, and why?') + pi([
      tool('bash', 'git log -S "Free shipping" -- site/', 'a41c9e2  Tue 17 Nov 16:42  Bob (agent)\n    Add free-shipping banner for Northside week\n    Bob: Northside pays the postage on orders over €30\n    until Sunday 22 Nov. Take it down on Monday.', true),
    ], reply('**Bob’s agent added it on Tuesday at 16:42**, at Bob’s request: Northside pays the postage on orders over €30 until Sunday, and Bob wants it down on Monday. The banner itself does not say that it ends.'), '1 tool') + you('09:47', 'Add “until Sunday” to it.') + pi([
      diff('site/_includes/banner.html', ['- Free shipping over €30', '+ Free shipping over €30 until Sunday 22 November']),
    ], reply('Changed. Publishing pushes it to the shop’s repository on Gitea, and the site updates from there. Publish?')) + you('09:49', 'Yes.') + pi([tool('bash', 'git push origin main', 'a41c9e2..5be07d1  main -> main')], reply('Published.'))),
  },
  {
    s: 'receipts', at: '12:38', ask: 'The packaging one is Bob’s, ask him. Skip the parking. Fonts come to the info inbox.',
    line: 'At lunch, on her phone: one agent waits, one still works. She answers by voice.',
    did: 'At lunch Alice opens her phone. The receipts have waited for her since 08:41, and the returns job has been working since ten with the tab closed. She reads the summary and answers by voice; the agent searches the shop’s other inbox and writes to Bob, as she asked.',
    screen: phoneMock,
  },
  {
    s: 'returns', at: '13:35', ask: 'From 1 December returns are 30 days, not 14. Update the handbook and the site, and check them against what customers actually ask.',
    line: 'Five workers: one reads customer mail, three rewrite, one checks the others.',
    did: 'The agent finds 17 pages that mention returns and splits the work. One worker reads every return question customers mailed this year; three each rewrite one part, starting fresh with only their own pages; a fifth, on a different model, checks every change against the policy and the real questions and sends two back. Alice talks to one agent the whole time.',
    screen: () => screen('Returns: 30 days', you('10:10', 'From 1 December returns are 30 days, not 14. Update the handbook and the site, and check them against what customers actually ask.') + pi([
      tool('bash', 'grep -ril "return" handbook/ site/', '17 files'),
      workers([['done', 'Mail', '212 return questions since January', '1-page report'], ['done', 'Shop floor', 'handbook/shop · 6 pages', '6 changed'], ['done', 'Online orders', 'handbook/online · 7 pages', '7 changed'], ['done', 'Site', 'site/faq, site/terms · 4 pages', '4 changed'], ['done', 'Checker', 'every change against policy and mail', '2 sent back']]),
      tool('read', 'workers/checker/report.md', '1. site/faq.md still says “14 days” for sale items → back to Site, fixed\n2. handbook/online/gifts.md contradicts the gift rule → back to Online orders, fixed\n3 customer questions that no page answered now have answers', true),
    ], reply('**17 pages updated** on the branch *returns-30-days*. The checker found two contradictions and the workers fixed them. Three questions customers kept asking (sale items, gifts, exchanges) now have answers in the FAQ.\n\nThe changes are open beside this conversation. Merge them?'), '2 tools · 5 workers'), viewPane('returns-30-days · 17 files', returnsView())),
  },
  {
    s: 'newsletter', at: '14:30', ask: 'Draft the December newsletter for everyone who bought from us this year.',
    line: 'Takes her change of mind mid-work; every recipient count can be checked.',
    did: 'While the agent counts buyers, Alice changes her mind and adds a message; it takes it on board at the next step. Every number comes from the order file, and the recipient list says who was left out and why. Nothing is sent until she says so.',
    screen: () => screen('December newsletter', you('14:05', 'Draft the December newsletter for everyone who bought from us this year.') + you('14:08', 'Leave out the wholesale shops, they get their own letter.', '', 'Sent while it worked · taken on board at the next step') + pi([
      tool('bash', 'python3 newsletter/recipients.py orders/2026.csv', '512 buyers in 2026\n− 61 unsubscribed\n−  9 duplicates (same address, different case)\n− 56 wholesale shops\n= 386 → newsletter/recipients.csv', true),
      tool('write', 'newsletter/2026-12.html', '1 page · 2 images from site/img'),
    ], reply('A draft for **386 people** is open beside this. *recipients.csv* lists them, and the 126 left out with the reason for each. Nothing has been sent; say when.', offer('recipients.csv', '386 recipients + 126 left out · 41 KB')), '2 tools'), viewPane('2026-12.html', newsMock())),
  },
  {
    s: 'returns', at: '15:30', ask: 'Bob says wholesale stays at 14 days. Undo just the change to the wholesale page.',
    line: 'Puts one page back as it was; the other sixteen keep the new policy.',
    did: 'Every change the workers made is recorded with what changed, when and why. The agent puts one page back as it was and leaves the other sixteen alone, and the undo is recorded too.',
    screen: () => screen('Returns: 30 days', you('15:30', 'Bob says wholesale stays at 14 days. Undo just the change to the wholesale page.') + pi([
      tool('bash', 'git log --oneline -2 -- handbook/online/wholesale.md', 'c7e01b2  13:55  Returns: 30 days from 1 Dec (worker: Online orders)\n81aa0f4  2 Sep   Wholesale terms 2026', true),
      tool('bash', 'git restore --source=81aa0f4 handbook/online/wholesale.md', 'e93b4d0  Wholesale keeps 14-day returns (Bob, 21 Nov)'),
    ], reply('Undone. Wholesale is back to 14 days; the other 16 pages keep the new policy.', diff('handbook/online/wholesale.md', ['- Wholesale orders can be returned within 30 days.', '+ Wholesale orders can be returned within 14 days.']) + `<p class="hist"><span>Recorded 15:31 · e93b4d0</span><button type="button" class="quiet-btn" data-undo>Undo this too</button></p>`), '2 tools')),
  },
  {
    s: 'wrapup', at: '17:28', ask: 'Before I go: write down what we learned today.',
    line: 'Writes the day’s lessons down: some for her, some for the team, Bob’s agent included.',
    did: 'The agent reads back through the day’s conversations and writes down what the next agent should know. What concerns only Alice goes into her own notes; what concerns everyone goes into the team’s shared folder, where Bob’s agent will read it tomorrow. Both are plain text she can correct.',
    screen: () => screen('Before I go', you('17:25', 'Before I go: write down what we learned today.') + pi([
      tool('read', 'today’s 7 conversations', 'What’s waiting today · Northside prices · October receipts · Market video · Shipping banner · Returns: 30 days · December newsletter'),
      diff('~/AGENTS.md', ['+ Receipts: name them “date vendor amount.pdf”.', '+ The Fjord Fonts bill comes to the info inbox.', '+ Video captions: the shop font, six words at most.'], 'Only for you'),
      diff('team/AGENTS.md', ['+ Returns: 30 days from 1 Dec 2026. Wholesale stays', '+   at 14 days (Bob, 21 Nov).', '+ A promotion banner on the site says when it ends.', '+ Supplier price lists: run tools/margin_check.py.'], 'For everyone at Example Studio'),
    ], reply('Written down. Your own notes stay yours. The team notes are in the shared folder, so tomorrow Bob’s agent knows the returns rule too.'), '1 tool · 2 files')),
  },
];
G.forEach((g, i) => { g.i = i; g.t = T(g.at); g.title = SID[g.s].title; });
const glimpseOf = (sid, t) => { const own = G.filter((g) => g.s === sid); return own.filter((g) => g.t <= t).pop() || own[0]; };

// ---------- The sidebar, as the product draws it, at a moment of the day ----------
// Your turn newest first, Running in the order they started, Quiet newest first.
function railAt(t, active, opts = {}) {
  const groups = { turn: [], run: [], quiet: [] };
  for (const s of SESS) { const g = segAt(s, t); if (g) groups[g[1]].push([s, g]); }
  groups.turn.sort((a, b) => T(b[1][0]) - T(a[1][0]));
  groups.quiet.sort((a, b) => T(b[1][0]) - T(a[1][0]));
  const hot = opts.hot || new Set();
  const row = ([s, g]) => `<li><button type="button" class="rl-row rl-${g[1]}${hot.has(s.id) ? ' hot' : ''}" data-s="${s.id}"${s.id === active ? ' aria-current="true"' : ''}>${mark(opts.small ? 13 : 16, MARK_STATE[g[1]])}<span class="rl-t">${esc(s.title)}</span>${opts.small ? '' : `<span class="rl-l">${esc(g[2])}</span>`}<time>${g[0]}</time>${hot.has(s.id) && opts.badge ? `<i class="rl-n">${opts.badge(s.id)}</i>` : ''}</button></li>`;
  return `<div class="rl${opts.small ? ' rl-small' : ''}">${['turn', 'run', 'quiet'].filter((k) => groups[k].length || !opts.small).map((k) => `<section class="rl-sec rl-sec-${k}"><h4><span>${STATE[k]}</span><b>${groups[k].length}</b></h4>${groups[k].length ? `<ul>${groups[k].map(row).join('')}</ul>` : '<p class="rl-none">Nothing</p>'}</section>`).join('')}</div>`;
}
const chips = (t) => { const c = counts(t); return `<span class="chips"><i class="c-turn">${c.turn} Your turn</i><i class="c-run">${c.run} Running</i><i class="c-quiet">${c.quiet} Quiet</i></span>`; };
const when = (t) => { const p = placeAt(t); return `<span class="when"><b>${hhmm(t)}</b><span>${placeIc(p[2])}${p[1]}</span></span>`; };
// A conversation that has started but has not yet come back: her ask, and the agent at work.
const runningScreen = (s, t) => { const g = glimpseOf(s.id, t); const seg = segAt(s, t); return screen(s.title, you(s.segs[0][0], g.ask) + `<p class="working-lbl run-lbl">${mark(16, 'working')}<span>${esc(seg[2])}…</span></p>`); };

// =====================================================================
// 1 Sivupalkki: the product's own screen tells the day as one scrolls
// =====================================================================
function v1() {
  const t0 = G[0].t;
  return `<div class="pg v1">
${hero(0)}
${intro('Scroll, and her sidebar moves through the day.')}
<section class="s1">
  <div class="s1-bar"><div class="s1-bar-row">${when(t0)}<button type="button" class="s1-tog" aria-expanded="false">${chips(t0)}</button></div><div class="s1-drop" hidden>${railAt(t0, G[0].s)}</div></div>
  <div class="s1-steps">
${G.map((g, i) => `<article class="s1-step${i === 0 ? ' on' : ''}" data-i="${i}">
    <p class="s1-when">${when(g.t)}</p>
    <h3 class="ask">“${esc(g.ask)}”</h3>
    <p class="did">${esc(g.did)}</p>
    <p class="s1-count">${countLine(g.t)}</p>
    <div class="s1-inline">${g.screen()}</div>
  </article>`).join('\n')}
  </div>
  <div class="s1-app" aria-label="Alice’s Open Habitat at the moment shown">
    <div class="s1-top">${mark(16)}<b>Example Studio</b><span class="s1-clock">${when(t0)}</span></div>
    <div class="s1-body"><nav class="s1-rail" aria-label="Conversations">${railAt(t0, G[0].s)}</nav><div class="s1-main">${G[0].screen()}</div></div>
  </div>
</section>
${dayEnd}
${stub}
</div>`;
}
function initV1(root) {
  const steps = [...root.querySelectorAll('.s1-step')];
  const rail = root.querySelector('.s1-rail');
  const main = root.querySelector('.s1-main');
  const clock = root.querySelector('.s1-clock');
  const bar = root.querySelector('.s1-bar');
  const drop = root.querySelector('.s1-drop');
  const tog = root.querySelector('.s1-tog');
  let cur = 0;
  // Rows that change section glide to their new place (FLIP), so the eye can follow them.
  const flip = (host, html) => {
    const before = new Map([...host.querySelectorAll('.rl-row')].map((r) => [r.dataset.s, r.getBoundingClientRect()]));
    host.innerHTML = html;
    if (reduced()) return;
    for (const r of host.querySelectorAll('.rl-row')) {
      const b = before.get(r.dataset.s); const a = r.getBoundingClientRect();
      if (!b) { r.animate([{ opacity: 0, transform: 'translateY(-6px)' }, { opacity: 1, transform: 'none' }], { duration: 240, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' }); continue; }
      const dy = b.top - a.top;
      if (Math.abs(dy) > 1) r.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], { duration: 280, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' });
    }
  };
  const show = (i, force) => {
    if (i === cur && !force) return;
    cur = i;
    const g = G[i];
    steps.forEach((s, j) => s.classList.toggle('on', j === i));
    flip(rail, railAt(g.t, g.s));
    main.innerHTML = g.screen();
    main.scrollTop = 0;
    clock.innerHTML = when(g.t);
    bar.querySelector('.when').outerHTML = when(g.t);
    tog.innerHTML = chips(g.t);
    flip(drop, railAt(g.t, g.s));
  };
  // A row opens that conversation as it stood at the moment shown.
  root.addEventListener('click', (e) => {
    const r = e.target.closest('.rl-row');
    if (r) {
      const s = SID[r.dataset.s]; const t = G[cur].t; const seg = segAt(s, t);
      const g = G.filter((x) => x.s === s.id && x.t <= t).pop();
      const html = g && !(seg[1] === 'run' && T(seg[0]) > g.t) ? g.screen() : runningScreen(s, t);
      root.querySelectorAll('.rl-row').forEach((x) => (x.dataset.s === s.id ? x.setAttribute('aria-current', 'true') : x.removeAttribute('aria-current')));
      const inline = r.closest('.s1-drop');
      if (inline) { const host = steps[cur].querySelector('.s1-inline'); host.innerHTML = html; drop.hidden = true; tog.setAttribute('aria-expanded', 'false'); host.scrollIntoView({ block: 'start', behavior: reduced() ? 'auto' : 'smooth' }); }
      else { main.innerHTML = html; main.scrollTop = 0; }
      return;
    }
    if (e.target.closest('.s1-tog')) { const open = drop.hidden; drop.hidden = !open; tog.setAttribute('aria-expanded', String(open)); }
  });
  // The step that crosses the middle of the viewport owns the screen.
  const io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && show(+e.target.dataset.i)), { rootMargin: '-45% 0px -45% 0px' });
  steps.forEach((s) => io.observe(s));
  return () => io.disconnect();
}

// =====================================================================
// 2 Kaistat: the whole day as lanes over a clock; a cursor reads any moment
// =====================================================================
function lanesChart() {
  const lane = (cls, label, inner, extra = '') => `<div class="ln ${cls}"${extra}><div class="ln-h">${label}</div><div class="ln-tr">${inner}</div></div>`;
  const pos = (a, b) => `style="--a:${pctT(a)}%;--b:${Math.max(pctT(b) - pctT(a), 0.35)}%"`;
  const hours = Array.from({ length: 11 }, (_, k) => `<span class="ln-hr" style="--a:${k * 10}%"><i>${String(8 + k).padStart(2, '0')}</i></span>`).join('');
  const places = PLACES.slice(0, -1).map((p, k) => `<span class="ln-place" data-k="${k}" ${pos(T(p[0]), T(PLACES[k + 1][0]))} title="${esc(p[1])}">${placeIc(p[2])}<i>${esc(p[1])}</i></span>`).join('');
  const sessions = SESS.map((s) => {
    const bars = s.segs.map((g, k) => { const end = k + 1 < s.segs.length ? T(s.segs[k + 1][0]) : DAY1; return `<span class="ln-bar ln-${g[1]}" ${pos(T(g[0]), end)}></span>`; }).join('');
    const wk = s.id === 'returns' ? WORKERS.map(([n, a, b], k) => `<span class="ln-wk" ${pos(T(a), T(b))} data-k="${k}" title="Worker: ${esc(n)}"></span>`).join('') : '';
    const pins = G.filter((g) => g.s === s.id).map((g) => `<button type="button" class="ln-pin" data-i="${g.i}" style="--a:${pctT(g.t)}%" aria-label="${g.i + 1}: ${esc(g.title)} at ${g.at}">${g.i + 1}</button>`).join('');
    return lane(`ln-s${s.id === 'returns' ? ' ln-with-wk' : ''}`, `${mark(14, 'idle')}<span>${esc(s.title)}</span>`, bars + wk + pins, ` data-s="${s.id}"`);
  }).join('');
  return `<div class="ln-chart">
    <div class="ln ln-hours"><div class="ln-h"></div><div class="ln-tr">${hours}</div></div>
    ${lane('ln-alice', `<b>Alice</b>`, places)}
    ${sessions}
    <div class="ln-cursor-wrap" aria-hidden="true"><div class="ln-h"></div><div class="ln-tr"><span class="ln-cursor"></span></div></div>
  </div>`;
}
function detail2(g) {
  return `<div class="d2-text">
    <p class="d2-n"><b>${g.i + 1}</b>/10 · ${esc(g.title)}</p>
    <p class="d2-when">${when(g.t)}</p>
    <h3 class="ask">“${esc(g.ask)}”</h3>
    <p class="did">${esc(g.did)}</p>
    <p class="d2-nav"><button type="button" class="d2-b" data-step="-1"${g.i === 0 ? ' disabled' : ''}>← Earlier</button><button type="button" class="d2-b" data-step="1"${g.i === G.length - 1 ? ' disabled' : ''}>Later →</button></p>
  </div><div class="d2-screen">${g.screen()}</div>`;
}
function v2() {
  const t0 = T('08:32');
  return `<div class="pg v2">
${hero(1)}
${intro('Each line is one conversation. Drag the clock, or press a number to see what happened.')}
<section class="s2">
  <div class="s2-card">
    <div class="s2-read" aria-live="polite"><span class="s2-now">${when(t0)}</span>${chips(t0)}</div>
    <div class="s2-ctl">
      <button type="button" class="s2-play" aria-label="Play the day">${'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>'}<span>Play the day</span></button>
      <input class="s2-range" type="range" min="${DAY0}" max="${DAY1}" step="1" value="${t0}" aria-label="Time of day">
    </div>
    ${lanesChart()}
    <p class="s2-key"><span><i class="k-run"></i>Running</span><span><i class="k-turn"></i>Your turn</span><span><i class="k-quiet"></i>Quiet</span><span><i class="k-wk"></i>Worker</span><span><b class="k-pin">3</b>Open what happened</span></p>
  </div>
  <div class="s2-detail" id="s2-detail">${detail2(G[0])}</div>
</section>
${dayEnd}
${stub}
</div>`;
}
function initV2(root) {
  const chart = root.querySelector('.ln-chart');
  const range = root.querySelector('.s2-range');
  const read = root.querySelector('.s2-read');
  const det = root.querySelector('.s2-detail');
  const play = root.querySelector('.s2-play');
  let sel = 0, timer = null;
  const setT = (t) => {
    t = Math.round(t);
    range.value = t;
    chart.style.setProperty('--t', `${pctT(t)}%`);
    read.innerHTML = `<span class="s2-now">${when(t)}</span>${chips(t)}`;
    for (const ln of chart.querySelectorAll('.ln-s')) {
      const g = segAt(SID[ln.dataset.s], t);
      ln.dataset.state = g ? g[1] : 'none';
      ln.querySelector('.oh-mark').dataset.state = g ? MARK_STATE[g[1]] : 'idle';
    }
    const pk = PLACES.indexOf(placeAt(t));
    chart.querySelectorAll('.ln-place').forEach((e) => e.classList.toggle('on', +e.dataset.k === pk));
    chart.querySelectorAll('.ln-wk').forEach((w) => { const [, a, b] = WORKERS[+w.dataset.k]; w.classList.toggle('on', T(a) <= t && t < T(b)); });
  };
  const select = (i, scroll) => {
    sel = Math.max(0, Math.min(G.length - 1, i));
    det.innerHTML = detail2(G[sel]);
    chart.querySelectorAll('.ln-pin').forEach((p) => (+p.dataset.i === sel ? p.setAttribute('aria-current', 'true') : p.removeAttribute('aria-current')));
    setT(G[sel].t);
    if (scroll) det.scrollIntoView({ block: 'start', behavior: reduced() ? 'auto' : 'smooth' });
  };
  const stop = () => { clearTimeout(timer); cancelAnimationFrame(timer); timer = null; play.classList.remove('on'); play.querySelector('span').textContent = 'Play the day'; };
  range.addEventListener('input', () => { stop(); setT(+range.value); });
  root.addEventListener('click', (e) => {
    const pin = e.target.closest('.ln-pin'); if (pin) { stop(); select(+pin.dataset.i, matchMedia('(max-width: 900px)').matches); return; }
    const b = e.target.closest('.d2-b'); if (b) { select(sel + +b.dataset.step, false); return; }
    if (e.target.closest('.s2-play')) {
      if (timer) { stop(); return; }
      play.classList.add('on'); play.querySelector('span').textContent = 'Pause';
      let t = +range.value >= DAY1 - 1 ? DAY0 : +range.value; let last = performance.now();
      // Ten hours in about fifteen seconds; with reduced motion it steps glimpse by glimpse.
      if (reduced()) {
        const hop = () => { const n = G.find((g) => g.t > t); if (!n) { setT(DAY1); stop(); return; } t = n.t; setT(t); timer = setTimeout(hop, 900); };
        hop(); return;
      }
      const tick = (now) => {
        t += (now - last) * 0.04; last = now;
        if (t >= DAY1) { setT(DAY1); stop(); return; }
        setT(t); timer = requestAnimationFrame(tick);
      };
      timer = requestAnimationFrame(tick);
    }
  });
  det.innerHTML = detail2(G[0]);
  chart.querySelector('.ln-pin').setAttribute('aria-current', 'true');
  setT(+range.value);
  return stop;
}

// =====================================================================
// 3 Hetket: the day as a strip of moments; each opens to what happened
// =====================================================================
const MOMENTS = [
  { at: '08:22', g: [0], cap: 'Coffee at home. She asks what is waiting, then starts two more: the receipts and the market video.' },
  { at: '08:34', g: [1], cap: 'On the tram she starts a third. Last week’s margin check is back in four minutes.' },
  { at: '09:03', g: [2, 3], cap: 'Before her stop, the receipts and the video come back. Three answers wait for her.' },
  { at: '09:50', g: [4], cap: 'In the studio she sees a banner on the site she did not expect, and asks who put it there.' },
  { at: '12:40', g: [5], cap: 'Lunch. The returns job has run since ten with the tab closed. She answers the receipts by voice.' },
  { at: '13:40', g: [6], cap: 'Back at her desk: five workers are done, and seventeen changed pages wait for her review.' },
  { at: '15:32', g: [7, 8], cap: 'A newsletter waits for her go-ahead, and one page goes back the way it was.' },
  { at: '17:32', g: [9], cap: 'Before she leaves, the day’s lessons are written down: some for her, some for the team.' },
];
function v3() {
  return `<div class="pg v3">
${hero(2)}
${intro('Here is her day in eight moments. Press any of them to see what happened.')}
<section class="s3">
  <ol class="s3-grid">
${MOMENTS.map((m, k) => { const t = T(m.at); const p = placeAt(t); const hot = new Set(m.g.map((i) => G[i].s)); return `<li class="s3-m" style="--k:${k}">
    <p class="s3-head"><b>${m.at}</b><span>${placeIc(p[2])}${p[1]}</span></p>
    <div class="s3-rail">${railAt(t, null, { small: true, hot, badge: (sid) => m.g.filter((i) => G[i].s === sid).map((i) => i + 1).join(' ') })}</div>
    <p class="s3-cap">${esc(m.cap)}</p>
    <p class="s3-open">${m.g.map((i) => `<button type="button" class="s3-b" data-i="${i}"><i>${i + 1}</i><span>${esc(G[i].line)}</span></button>`).join('')}</p>
  </li>`; }).join('\n')}
  </ol>
</section>
<dialog class="s3-dlg" aria-label="What happened"><div class="s3-dlg-in"></div></dialog>
${dayEnd}
${stub}
</div>`;
}
function initV3(root) {
  const dlg = root.querySelector('.s3-dlg');
  const box = dlg.querySelector('.s3-dlg-in');
  let cur = 0;
  const fill = (i) => {
    cur = i; const g = G[i];
    box.innerHTML = `<div class="s3-dlg-top"><p class="d2-n"><b>${i + 1}</b>/10 · ${esc(g.title)}</p><button type="button" class="s3-x" aria-label="Close">×</button></div>
      <p class="d2-when">${when(g.t)}</p><h3 class="ask">“${esc(g.ask)}”</h3><p class="did">${esc(g.did)}</p>
      <div class="s3-dlg-scr">${g.screen()}</div>
      <p class="d2-nav"><button type="button" class="d2-b" data-step="-1"${i === 0 ? ' disabled' : ''}>← Earlier</button><button type="button" class="d2-b" data-step="1"${i === G.length - 1 ? ' disabled' : ''}>Later →</button></p>`;
    dlg.scrollTop = 0;
  };
  root.addEventListener('click', (e) => {
    const b = e.target.closest('.s3-b, .rl-row.hot');
    if (b && !dlg.open) {
      const i = b.dataset.i != null ? +b.dataset.i : +b.closest('.s3-m').querySelector(`.s3-b`).dataset.i;
      const fromRow = b.classList.contains('rl-row') ? [...b.closest('.s3-m').querySelectorAll('.s3-b')].map((x) => +x.dataset.i).find((j) => G[j].s === b.dataset.s) : i;
      fill(fromRow ?? i); dlg.showModal(); return;
    }
    if (e.target.closest('.s3-x') || e.target === dlg) { dlg.close(); return; }
    const st = e.target.closest('.s3-dlg .d2-b'); if (st) fill(cur + +st.dataset.step);
  });
  // Inside the dialog the arrows page through the glimpses and do not reach the picker.
  dlg.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.stopPropagation(); e.preventDefault(); const n = cur + (e.key === 'ArrowRight' ? 1 : -1); if (n >= 0 && n < G.length) fill(n); }
    else if (/^[0-9rR]$/.test(e.key)) e.stopPropagation();
  });
  return () => { if (dlg.open) dlg.close(); };
}

// ---------- Interactions shared by the screens ----------
stage.addEventListener('click', (e) => {
  const disc = e.target.closest('.disc');
  if (disc) {
    const open = disc.getAttribute('aria-expanded') !== 'true';
    disc.setAttribute('aria-expanded', String(open));
    disc.nextElementSibling.hidden = !open;
    return;
  }
  const dl = e.target.closest('.offer-b');
  if (dl) { const t = dl.textContent; dl.textContent = dl.dataset.done; dl.dataset.done = t; dl.classList.toggle('done'); return; }
  const undo = e.target.closest('[data-undo]');
  if (undo) {
    const sp = undo.parentElement.querySelector('span');
    const undone = undo.toggleAttribute('data-undone');
    undo.textContent = undone ? 'Redo' : 'Undo this too';
    sp.textContent = undone ? 'Undone 15:34 · wholesale back at 30 days' : 'Recorded 15:31 · e93b4d0';
    return;
  }
  const play = e.target.closest('.vid-play');
  if (play) {
    const v = play.closest('.vid'); const frame = v.querySelector('.vid-frame');
    if (v.classList.toggle('playing')) {
      play.setAttribute('aria-label', 'Pause');
      const start = performance.now() - (+v.dataset.pos || 0);
      const step = () => {
        if (!v.isConnected || !v.classList.contains('playing')) return;
        const pos = (performance.now() - start) % 30000; v.dataset.pos = pos;
        const k = Math.min(4, Math.floor(pos / 6000));
        if (frame.dataset.k !== String(k)) { frame.dataset.k = k; frame.querySelector('.vid-cap').textContent = CAPTIONS[k]; }
        v.querySelector('.vid-prog').style.transform = `scaleX(${pos / 30000})`;
        v.querySelector('.vid-t').textContent = `0:${String(Math.floor(pos / 1000)).padStart(2, '0')}`;
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    } else play.setAttribute('aria-label', 'Play');
  }
});

// Each variant starts from the top, and wires its page once it is in the DOM
// (lib/picker.js sets innerHTML right after the render function returns).
let cleanup = null;
const variants = [[v1, initV1], [v2, initV2], [v3, initV3]].map(([fn, init]) => () => {
  if (cleanup) { cleanup(); cleanup = null; }
  window.scrollTo(0, 0);
  setTimeout(() => { const root = stage.firstElementChild; if (root) cleanup = init(root) || null; }, 0);
  return fn();
});
