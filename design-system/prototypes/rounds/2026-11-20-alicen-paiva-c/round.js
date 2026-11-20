// Round 3 (c) of the landing page's day: what the day contains. Worker c's lens
// is other people than a shop owner, told in bolder forms. Round 2's hero sits
// above the day and a short stub below it. Every scene shows why the agent
// needs a real computer by what happens in it. People, organisations and
// addresses are invented (example.org). The screens are drawn with the
// prototype library's conversation language (lib/language.css), not screenshots.
// build.mjs defines IMG and VARIANTS; lib/markdown.js gives esc, inline and md;
// lib/icons.js gives ICON_CHECK, CHEV and ICON_COPY; lib/picker.js expects
// `stage` and `variants`.
const stage = document.getElementById('stage');

const REPO = 'https://github.com/Open-Habitat/open-habitat';
const RING = 'M9 -2v6a5 5 0 0 1-5 5h-8a5 5 0 0 1-5-5v-8a5 5 0 0 1 5-5h8a5 5 0 0 1 5 5z';
const mark = (px = 22, state = 'idle') => `<svg class="oh-mark" data-state="${state}" viewBox="-12 -12 24 24" width="${px}" height="${px}" aria-hidden="true"><path class="oh-ring" pathLength="100" d="${RING}"/><circle class="oh-dot" r="2.5"/></svg>`;
const heroPic = () => { const i = IMG.hero; return `<img class="hero-img" src="${i.src}" width="${i.w}" height="${i.h}" alt="A conversation with an agent in Open Habitat on a desktop browser, with running and waiting conversations in the sidebar, and the same conversation on a phone">`; };

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

// ---------- The stub below the day: the rest of the page is not this round's ----------
const stub = (who) => `<section class="stub" id="install">
  <p class="kicker">The rest of the page</p>
  <h2>${who} had nothing to set up. Somebody did, once.</h2>
  <p>One person who administers a Linux server installs Open Habitat for the team, by giving their coding agent the operator guide. After that, everyone signs in with a browser and gets an agent of their own.</p>
  <p class="cta"><a class="btn" href="${REPO}">Install on your server</a><a class="btn ghost" href="${REPO}#limits">What it does not do</a></p>
  <p class="stub-note">Install, limits and the pre-release note follow here, as in round 2.</p>
</section>
<footer class="foot"><span class="brandword">${mark(18)} Open Habitat</span><span>Free and open source under the MIT License.</span><a href="${REPO}">GitHub</a><a href="${REPO}/releases">Releases</a><span class="quiet">This page sets no cookies and loads nothing from anywhere else.</span></footer>`;

// ---------- The conversation language: small builders over lib/language.css ----------
// A screen is a list of pieces: you(...) bubbles and a pi(...) turn whose rows are
// tool rows, workers, drafts, diffs or offered files, ending in a reply.
const FILE_IC = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/></svg>';
const MAIL_IC = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>';
const you = (time, text, att = '') => `<article class="bubble user"><div class="bubble-head"><span class="who">You</span><time class="meta">${time}</time></div><div class="prose">${md(text)}</div>${att}</article>`;
const att = (name, meta) => `<p class="att">${FILE_IC}<span class="att-n">${esc(name)}</span><span class="att-m">${esc(meta)}</span></p>`;
// A tool row opens to its output, as in the product.
// Rows are closed as in the product; `open` shows the output that carries the scene.
const tool = (name, target, out = '', open = false) => `<section class="tool"><button class="disc" type="button" aria-expanded="${open}">${CHEV}<span class="names"><span class="name">${esc(name)}</span><span class="target">${esc(target)}</span></span><span class="ok">${ICON_CHECK}done</span></button><div class="tool-body"${open ? '' : ' hidden'}><pre>${esc(out || 'ok')}</pre></div></section>`;
const reply = (text, extra = '') => `<article class="bubble reply"><div class="prose">${md(text)}</div>${extra}</article>`;
const offer = (name, meta) => `<div class="offer">${FILE_IC}<span class="offer-n">${esc(name)}<small>${esc(meta)}</small></span><button type="button" class="offer-b" data-done="Saved to Downloads">Download</button></div>`;
const workers = (rows) => `<div class="wk" role="group" aria-label="Workers"><p class="wk-h">Workers <span>${rows.length}</span></p><ul>${rows.map(([state, name, task, prog]) => `<li class="wk-${state}"><span class="wk-dot" aria-hidden="true"></span><b>${esc(name)}</b><span class="wk-t">${esc(task)}</span><span class="wk-p">${esc(prog)}</span></li>`).join('')}</ul></div>`;
const drafts = (rows) => `<ul class="drafts">${rows.map(([state, to, subj, first]) => `<li class="dr dr-${state.split(' ')[0]}">${MAIL_IC}<span class="dr-main"><span class="dr-to">To ${esc(to)}</span><b>${esc(subj)}</b><span class="dr-first">${esc(first)}</span></span><span class="dr-s">${esc(state)}</span></li>`).join('')}</ul>`;
const diff = (file, lines) => `<div class="diff"><p class="diff-h">${FILE_IC}<span>${esc(file)}</span></p><pre>${lines.map((l) => `<span class="${l[0] === '+' ? 'add' : l[0] === '-' ? 'del' : 'ctx'}">${esc(l)}</span>`).join('')}</pre></div>`;
const out = (lines) => `<pre class="outbox">${esc(lines.join('\n'))}</pre>`;
// One agent turn on the rail: a head, the work, and the reply on the last node.
function pi(rows, answer, sum) {
  const cells = [`<div class="rail-cell first"><span class="node head" aria-hidden="true"></span></div><div class="cell"><div class="head-cell"><span class="who">Pi</span><span class="sum">${sum || ''}</span></div></div>`];
  for (const r of rows) cells.push(`<div class="rail-cell"><span class="node${r.startsWith('<section class="tool"') ? ' tool done' : ''}" aria-hidden="true"></span></div><div class="cell">${r}</div>`);
  cells.push(`<div class="rail-cell last"><span class="node done" aria-hidden="true"></span></div><div class="cell">${answer}</div>`);
  return `<div class="turn">${cells.join('')}</div>`;
}
// The screen around a conversation: a slim window bar with the workspace's name,
// and an optional view opened beside the conversation.
const screen = (where, body, view = '') => `<div class="scr${view ? ' has-view' : ''}"><div class="scr-bar">${mark(14)}<b>${esc(where[0])}</b><span>${esc(where[1])}</span></div><div class="scr-main"><div class="scr-convo">${body}</div>${view}</div></div>`;
const viewPane = (title, html) => `<aside class="scr-view" aria-label="View: ${esc(title)}"><p class="scr-view-h">${FILE_IC}<span>${esc(title)}</span><small>View</small></p><div class="scr-view-b">${html}</div></aside>`;

// A scene's text: the time, the ask in the person's own words, what the agent
// did, what came back, and the point, shown rather than claimed.
const sceneText = (s, cls, between = '') => `<p class="${cls}-time"><b>${s.time}</b>${s.when ? `<span>${s.when}</span>` : ''}</p>
  <h3 class="ask">“${s.ask}”</h3>
  <p class="did">${s.did}</p>${between}
  <p class="back"><span>Back</span>${s.back}</p>
  <p class="why"><span>Real computer</span>${s.why}</p>`;

// =====================================================================
// 1 Kokouspäivä: one meeting carries the day (round 2's form: chapters
// beside a screen that changes, with the meeting as a block on a ribbon)
// =====================================================================
const BOARD = ['Board · Birch Court', 'Maria’s workspace'];
const MEET = [
  {
    time: '07:50', when: 'Before work', h: 7.83,
    ask: 'What do I need for tonight’s board meeting?',
    did: 'Her agent reads tonight’s calendar entry, last month’s minutes and the open-actions file in the board folder, and her mail since that meeting.',
    back: 'A brief on one screen: three agenda items, two actions still open from October, and a roof quote that arrived at 06:12.',
    why: 'It read last month’s minutes from the board folder. Nothing depended on a chat remembering October.',
    screen: () => screen(BOARD, you('07:50', 'What do I need for tonight’s board meeting?') + pi([
      tool('bash', 'gog calendar events --today', 'Thu 19 Nov  18:00–20:00  Board meeting · club room · 5 guests', true),
      tool('read', 'board/2026-10-22-minutes.md', '# Birch Court board meeting 22 Oct 2026\n…\n6. Roof: three quotes requested, decision in November.'),
      tool('read', 'board/actions.md', '- [ ] Peter: gutter warranty, ask the 2019 contractor\n- [ ] Maria: heating figures from the property manager'),
      tool('bash', 'gog gmail search "label:board after:2026/10/22"', '7 messages\n06:12  Harbour Roofing  Quote: roof renovation (PDF, 14 pp.)\n09 Nov  resident, flat B12  Laundry room bookings', true),
    ], reply('**Tonight 18:00, club room.** All five members coming.\n\n1. **Roof renovation:** three quotes now. Harbour Roofing’s came in at 06:12.\n2. **Parking rules:** Lena’s draft, in the folder since 2 Nov.\n3. **Laundry room:** one complaint from flat B12.\n\nStill open from October: *Peter*, the gutter warranty. *You*, the heating figures.'), '4 tools')),
  },
  {
    time: '09:40', when: 'Coffee break', h: 9.67,
    ask: 'Compare the three roof quotes on the same basis.',
    did: 'It pulls the text out of the three PDFs with a program, puts every line item into one table and does the sums in a short script.',
    back: 'Harbour looks cheapest, but leaves scaffolding to the client. Counted the same way, it is the most expensive. A spreadsheet to download.',
    why: 'It ran programs on the PDFs and did the arithmetic in code, so every figure points back to a page.',
    screen: () => screen(BOARD, you('09:40', 'Compare the three roof quotes on the same basis.') + pi([
      tool('bash', 'pdftotext -layout board/roof/quotes/*.pdf', 'harbour-roofing.pdf    14 pages\nlinden-roof-works.pdf  9 pages\nnorthgate-roofs.pdf    11 pages'),
      tool('write', 'board/roof/compare.py', '62 lines'),
      tool('bash', 'python3 board/roof/compare.py', 'line items: 41 / 33 / 37\nscaffolding: harbour p.9 "by the client"\nwrote board/roof/roof-quotes.xlsx', true),
    ], reply('| | Quote | Scaffolding | Total |\n|---|---|---|---|\n| Harbour | €61,200 | +€6,400 | **€67,600** |\n| Linden | €64,900 | included | €64,900 |\n| Northgate | €66,300 | included | €66,300 |\n\nHarbour, page 9: *scaffolding by the client*. I priced it from the other two quotes at €6,400.', offer('roof-quotes.xlsx', 'Spreadsheet · 18 KB')), '3 tools')),
  },
  {
    time: '15:20', when: 'Before leaving work', h: 15.33,
    ask: 'Three slides for the roof item, in our usual style.',
    did: 'It uses the spring meeting’s deck in the board’s Drive folder as the pattern, builds three slides from the comparison and makes a PDF.',
    back: 'The slides open beside the conversation. She asks for one heading to be shorter, and it is.',
    why: 'The slides are made from the same file as the comparison. Change a figure and both follow.',
    screen: () => screen(BOARD, you('15:20', 'Three slides for the roof item, in our usual style.') + pi([
      tool('read', 'drive/Board/2026-04 Spring meeting.pptx', '12 slides · theme “Birch Court” · fonts, colours, footer'),
      tool('bash', 'python3 board/roof/slides.py --from roof-quotes.xlsx', 'wrote board/roof/roof-slides.pdf (3 pages)'),
    ], reply('Three slides, in the spring deck’s style. They are open beside this conversation.', offer('roof-slides.pdf', 'PDF · 3 pages'))), viewPane('roof-slides.pdf', `<div class="slides">
      <div class="slide s1"><small>Birch Court · Board 19 Nov</small><b>Roof renovation: three quotes</b><span>Decision by 15 December</span></div>
      <div class="slide"><small>Same basis</small><b>Counted the same way</b><i style="--w:96%">Harbour €67,600</i><i style="--w:90%">Northgate €66,300</i><i style="--w:88%">Linden €64,900</i></div>
      <div class="slide"><small>Proposal</small><b>Ask Harbour for a price with scaffolding</b><span>Then decide between the two lowest</span></div></div>`)),
  },
  {
    time: '18:35', when: 'In the meeting', h: 18.58,
    ask: 'Peter asks what we paid for the 2019 roof patch. Is it still under warranty?',
    did: 'Typed on her phone under the table. The agent searches the contract archive and the 2019 invoices on the server.',
    back: 'Forty seconds later: €8,950 to Kallio Roofing, a five-year warranty that ended in June 2024, and the page that says so.',
    why: 'The archive lives on the server beside the agent, so a question from a phone gets an answer with its source.',
    screen: () => screen(BOARD, you('18:35', 'Peter asks what we paid for the 2019 roof patch. Is it still under warranty?') + pi([
      tool('bash', 'grep -ril "roof" board/contracts board/invoices/2019', 'board/contracts/2019-06-12 Roof patch SIGNED.pdf\nboard/invoices/2019/2019-07-03 Kallio Roofing.pdf'),
      tool('bash', 'pdftotext "board/contracts/2019-06-12 Roof patch SIGNED.pdf" - | grep -i -A2 warranty', '7. Warranty. The contractor gives a warranty of five (5) years from\n   the acceptance of the work (14 June 2019).', true),
    ], reply('**€8,950** to Kallio Roofing, invoice of 3 July 2019.\n\nWarranty: five years from acceptance on 14 June 2019, so it **ended in June 2024**. Contract, page 2, section 7.')), ''),
  },
  {
    time: '20:10', when: 'After the meeting', h: 20.17,
    ask: 'Here’s the transcript from my phone. Minutes, please, like last time.',
    did: 'It writes the minutes in the board’s own format, with October’s minutes as the pattern. It adds the three new tasks to the actions file and closes Peter’s warranty task, answered at 18:35.',
    back: 'Minutes, decisions and tasks, as files in the board folder.',
    why: 'Minutes and actions stay in step as files, so next month’s brief starts from them.',
    screen: () => screen(BOARD, you('20:10', 'Here’s the transcript from my phone. Minutes, please, like last time.', att('board-2026-11-19.txt', 'Transcript · 1 h 52 min')) + pi([
      tool('read', 'board/2026-10-22-minutes.md', 'format: attendees · quorum · items · decisions · signatures'),
      tool('write', 'board/2026-11-19-minutes.md', '94 lines'),
      tool('edit', 'board/actions.md', '+3 −1\n- [x] Peter: gutter warranty (ended 06/2024, answered in the meeting)\n+ [ ] Maria: ask Harbour Roofing for a price with scaffolding\n+ [ ] Lena: post the parking rules in both stairwells\n+ [ ] Kalle Roofing: confirm the 2019 gutter detail', true),
    ], reply('**Decisions**\n1. Roof: ask Harbour Roofing for a price with scaffolding; decide by 15 December.\n2. Parking rules approved; in force from 1 January.\n3. Laundry room: a booking sheet on the door for a trial month.\n\nThree new tasks are in `actions.md`, and Peter’s warranty task is closed.'), '3 tools')),
  },
  {
    time: '20:40', when: 'Still at the table', h: 20.67,
    ask: 'Draft the follow-ups. Nothing goes out before I’ve read them.',
    did: 'It writes three drafts in her own mailbox: the minutes to the board for comments, the heating figures to the property manager, and the price request to Harbour Roofing, the quote from this morning.',
    back: 'She sends two and holds the roofer’s until Peter has checked one detail.',
    why: 'It writes from her own mailbox, as her, and nothing leaves without her go-ahead.',
    screen: () => screen(BOARD, you('20:40', 'Draft the follow-ups. Nothing goes out before I’ve read them.') + pi([
      drafts([
        ['sent 20:52', 'board@birchcourt.example.org', 'Minutes 19 Nov, for comments by Monday', 'Hi all, the minutes are attached. Please send corrections…'],
        ['sent 20:52', 'manager@northway.example.org', 'Heating figures for 2025–2026', 'Hello Sam, the board would like the monthly heating costs…'],
        ['draft held', 'quotes@harbour-roofing.example.org', 'Your quote of 19 Nov: price with scaffolding', 'Thank you for the quote. Page 9 leaves scaffolding to us…'],
      ]),
    ], you('20:51', 'Send the first two. Hold Harbour until Peter has replied.') + reply('Sent the first two from your mailbox. The Harbour draft waits in Drafts.'), 'Three drafts')),
  },
  {
    time: '08:05', when: 'Next morning', h: 32.08,
    ask: 'Peter says it’s Kallio, not Kalle. Fix it everywhere.',
    did: 'The transcript had misheard the name. The agent finds it in the minutes, in the actions file and in the draft still waiting for Harbour, and corrects all three.',
    back: 'Exactly what changed, line by line, with a way back.',
    why: 'Every change to the board folder is recorded, so it can show what changed and undo it.',
    screen: () => screen(BOARD, you('08:05', 'Peter says it’s Kallio, not Kalle. Fix it everywhere.') + pi([
      tool('bash', 'grep -rn "Kalle Roofing" board/ ~/mail/drafts', 'board/2026-11-19-minutes.md:41\nboard/actions.md:12\ndrafts/harbour-price-request.eml:9'),
      diff('board/2026-11-19-minutes.md', ['- 4. The 2019 patch was made by Kalle Roofing.', '+ 4. The 2019 patch was made by Kallio Roofing.']),
      diff('board/actions.md', ['- [ ] Kalle Roofing: confirm the 2019 gutter detail', '+ [ ] Kallio Roofing: confirm the 2019 gutter detail']),
    ], reply('Fixed in 3 places: the minutes, the actions file and the waiting Harbour draft. Nothing else changed.', `<p class="hist"><button type="button" class="quiet-btn" data-undo>Undo this change</button><span>Recorded 08:05 · “Kalle → Kallio”</span></p>`), '3 changes')),
  },
];
const HOURS = [7, 33];  // the ribbon runs from 07:00 to 09:00 the next morning
const pct = (h) => `${((h - HOURS[0]) / (HOURS[1] - HOURS[0]) * 100).toFixed(2)}%`;

function v1() {
  const ribbon = `<div class="m-ribbon" aria-hidden="true">
      <span class="m-band day" style="left:${pct(8)};width:calc(${pct(16.5)} - ${pct(8)})"><i>At work</i></span>
      <span class="m-band meet" style="left:${pct(18)};width:calc(${pct(20)} - ${pct(18)})"><i>Board meeting</i></span>
      <span class="m-band night" style="left:${pct(23)};width:calc(${pct(31)} - ${pct(23)})"><i>Night</i></span>
      <span class="m-tick" style="left:${pct(7)}">07</span><span class="m-tick" style="left:${pct(12)}">12</span><span class="m-tick" style="left:${pct(18)}">18</span><span class="m-tick" style="left:${pct(24)}">24</span><span class="m-tick end" style="left:${pct(33)}">09</span>
      ${MEET.map((s, i) => `<span class="m-pin${i === 0 ? ' on' : ''}" style="left:${pct(s.h)}"></span>`).join('')}
      <span class="m-now" style="left:${pct(MEET[0].h)}"></span>
    </div>`;
  return `<div class="pg v1">
${hero(0)}
<section class="day-intro" id="day">
  <p class="kicker">One person, one day</p>
  <h2>Maria’s board-meeting day.</h2>
  <p>Maria chairs the board of Birch Court, a housing company with 48 flats. By day she is a pharmacist; the board is her evening job. Tonight at six the board decides on the roof. Her agent has the board’s folder on the server, her mail and her calendar.</p>
</section>
<section class="m-story">
  <div class="m-chapters">
${MEET.map((s, i) => `<article class="m-ch${s.h >= 18 && s.h < 20 ? ' in-meet' : ''}" data-i="${i}">${sceneText(s, 'm', `<div class="m-inline">${s.screen()}</div>`)}</article>`).join('\n')}
  </div>
  <div class="m-side">
    <div class="m-clock"><b>${MEET[0].time}</b><span>${MEET[0].when}</span></div>
    ${ribbon}
    <div class="m-frames">${MEET.map((s, i) => `<div class="m-frame${i === 0 ? ' on' : ''}" aria-hidden="${i !== 0}">${s.screen()}</div>`).join('')}</div>
  </div>
</section>
<section class="day-end"><p>Next month, the brief at 07:50 starts from these minutes and this actions file. Harbour’s price request is still waiting for Peter.</p></section>
${stub('Maria')}
</div>`;
}
function initV1(root) {
  const chs = [...root.querySelectorAll('.m-ch')];
  const frames = [...root.querySelectorAll('.m-frame')];
  const pins = [...root.querySelectorAll('.m-pin')];
  const now = root.querySelector('.m-now');
  const clock = root.querySelector('.m-clock');
  let cur = 0;
  chs[0].classList.add('on');
  const show = (i) => {
    if (i === cur) return;
    cur = i;
    frames.forEach((f, j) => { f.classList.toggle('on', j === i); f.setAttribute('aria-hidden', String(j !== i)); });
    pins.forEach((p, j) => p.classList.toggle('on', j <= i));
    chs.forEach((c, j) => c.classList.toggle('on', j === i));
    now.style.left = pct(MEET[i].h);
    clock.innerHTML = `<b>${MEET[i].time}</b><span>${MEET[i].when}</span>`;
    clock.classList.toggle('meet', MEET[i].h >= 18 && MEET[i].h < 20);
  };
  // The chapter that crosses the middle of the viewport owns the screen.
  const io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && show(+e.target.dataset.i)), { rootMargin: '-48% 0px -48% 0px' });
  chs.forEach((c) => io.observe(c));
  return () => io.disconnect();
}

// =====================================================================
// 2 Kaksi kaistaa: her evening and her agent's evening, side by side
// =====================================================================
const COURSE = ['Bookkeeping 2 · Tuesday group', 'Ana’s workspace'];
const LANES = [
  {
    time: '16:20', her: 'Ten minutes before she leaves the staff room.', away: false,
    ask: 'Week 6 is in. Check them like last week.',
    did: 'The agent reads the course mailbox and saves 31 workbooks. It starts the checker it wrote in week 2, which opens each file and compares formulas, chart and print layout with the answer key, and splits the 31 between four workers.',
    why: 'The checker it wrote in week 2 is still in the course folder. Every Tuesday starts from it.',
    screen: () => screen(COURSE, you('16:20', 'Week 6 is in. Check them like last week.') + pi([
      tool('bash', 'himalaya envelope list --folder Submissions --since tue', '31 messages · 31 attachments (.xlsx 29, .numbers 1, .ods 1)'),
      tool('read', 'course/tools/check_workbook.py', 'written 29 Sep (week 2) · 214 lines · checks: formulas, totals, chart series, print area, vat_row', true),
      workers([['run', 'Worker 1', 'students A–E', '0 / 8'], ['run', 'Worker 2', 'students F–K', '0 / 8'], ['run', 'Worker 3', 'students L–P', '0 / 8'], ['run', 'Worker 4', 'students R–Ö', '0 / 7']]),
    ], reply('31 workbooks saved to `course/week-06/in/`. Four workers are checking them with `check_workbook.py`. I’ll put it all together when they finish.'), 'Started 4 workers')),
  },
  {
    time: '16:38', her: 'Closes the laptop. Picks Leo up from football.', away: true,
    did: 'The workers carry on. Worker 3 meets a file it cannot open, a spreadsheet saved on a Mac, converts it with a program and checks it like the rest.',
    why: 'The work runs on the server, not in her browser. A closed laptop stops nothing.',
    screen: () => screen(COURSE, pi([
      workers([['done', 'Worker 1', 'students A–E', '8 / 8'], ['run', 'Worker 2', 'students F–K', '6 / 8'], ['run', 'Worker 3', 'converting k-moreau.numbers', '5 / 8'], ['done', 'Worker 4', 'students R–Ö', '7 / 7']]),
      tool('bash', 'soffice --headless --convert-to xlsx in/k-moreau.numbers', 'convert in/k-moreau.numbers -> in/k-moreau.xlsx using filter : Calc MS Excel 2007 XML', true),
    ], `<p class="working-lbl"><span class="live-dot"></span>Working · nobody watching</p>`, 'Running')),
  },
  {
    time: '17:50', her: 'Cooking.', away: true,
    did: 'Nine students fail the same check in the same row. The agent opens the exercise itself: it tells students to put the VAT total in row 18, while the answer key has it in row 19. The students followed the instructions. It counts them as passed and prepares a fix to the exercise.',
    why: 'It opens the real files, down to one cell, and can tell when the material is wrong and not the student.',
    screen: () => screen(COURSE, pi([
      out(['check        pass  fail', 'formulas       29     2', 'totals         30     1', 'chart          28     3', 'print_area     31     0', 'vat_row        22     9   ← all nine: total in row 18']),
      tool('read', 'course/material/week-06/exercise.md', '23: Enter the VAT total in row 18 of the Summary sheet.', true),
      tool('read', 'course/material/week-06/answer-key.xlsx', 'Summary!B19 = SUM(B12:B17)   (row 19)', true),
    ], reply('The nine `vat_row` failures are the exercise’s fault, not the students’: line 23 says **row 18**, the answer key uses **row 19**. I’ve counted them as passes and prepared a fix to `exercise.md` for you to approve.'), 'Found a pattern')),
  },
  {
    time: '18:45', her: 'Dinner. Leo explains offside.', away: true,
    did: 'Two workbooks are the very same file: the same fingerprint and the same author in the file’s properties, sent by two students four minutes apart. The agent accuses no one. It sets them aside for Ana.',
    why: 'It compares file fingerprints and properties, which nobody sees by opening an attachment.',
    screen: () => screen(COURSE, pi([
      tool('bash', 'sha256sum course/week-06/in/*.xlsx | sort | uniq -D -w64', '9f2c…41ab  in/j-ito.xlsx\n9f2c…41ab  in/m-stahl.xlsx', true),
      tool('bash', 'python3 course/tools/props.py in/j-ito.xlsx in/m-stahl.xlsx', 'j-ito.xlsx    author: J. Ito   created: Mon 14:02   sent: 15:31\nm-stahl.xlsx  author: J. Ito   created: Mon 14:02   sent: 15:35', true),
    ], reply('Two files are identical, author **J. Ito** in both. I haven’t replied to either student; they’re set aside for you.'), '2 tools')),
  },
  {
    time: '20:40', her: 'On the sofa. Opens her phone.', away: false, back: true,
    ask: 'How did it go?',
    did: 'One summary. The agent has written a reply to each student in Ana’s usual tone, listing the exact cells to fix, and left them in her course mailbox as drafts. She approves the fix to the exercise and the replies.',
    why: 'It drafts in her own mailbox and sends only when she says so. The fix to the exercise is recorded like every other change.',
    screen: () => screen(COURSE, you('20:40', 'How did it go?') + pi([
      diff('course/material/week-06/exercise.md', ['- 23: Enter the VAT total in row 18 of the Summary sheet.', '+ 23: Enter the VAT total in row 19 of the Summary sheet.']),
    ], reply('**Week 6:** 24 passed (including the nine from the row mistake), 5 need fixes, 2 identical files set aside.\n\n29 replies are waiting in Drafts in the course mailbox, each naming the cells to fix.') + you('20:44', 'Fix the exercise. Send the 29.') + reply('Sent 29 from course@adult-ed.example.org. Week 6 is recorded in `register.xlsx`. The exercise is fixed for next year’s group.'), 'Summary')),
  },
  {
    time: '21:05', her: 'One more thing before bed.', away: false,
    ask: 'The two identical ones: put ten minutes with each before Thursday’s class.',
    did: 'It reads her calendar for Thursday, finds two free slots before the class and books them. The two students’ replies stay unwritten. Ana wants to say that herself.',
    why: 'Her own calendar, changed because she asked, and fitted around what is already there.',
    screen: () => screen(COURSE, you('21:05', 'The two identical ones: put ten minutes with each before Thursday’s class.') + pi([
      tool('bash', 'gog calendar events --date thu', '16:30–17:15  Staff meeting\n18:00–20:30  Bookkeeping 2, room 204', true),
      tool('bash', 'gog calendar create --date thu 17:25 --minutes 10 "J. Ito, week 6"', 'created 17:25–17:35'),
      tool('bash', 'gog calendar create --date thu 17:40 --minutes 10 "M. Ståhl, week 6"', 'created 17:40–17:50'),
    ], reply('Thursday: **17:25** J. Ito and **17:40** M. Ståhl, both in room 204, between the staff meeting and class.'), '3 tools')),
  },
];
function v2() {
  const row = (s, i) => `<article class="l-row${s.away ? ' away' : ''}${s.back ? ' return' : ''}" data-i="${i}">
    <div class="l-her"><p class="l-time"><b>${s.time}</b></p><p class="l-life">${s.her}</p>${s.ask ? `<p class="l-ask"><span>Ana</span>“${s.ask}”</p>` : `<p class="l-gone">Laptop closed</p>`}</div>
    <div class="l-spine" aria-hidden="true"><span></span></div>
    <div class="l-agent"><p class="l-did">${s.did}</p>${s.screen()}<p class="why"><span>Real computer</span>${s.why}</p></div>
  </article>`;
  return `<div class="pg v2">
${hero(1)}
<section class="day-intro" id="day">
  <p class="kicker">One evening, two lanes</p>
  <h2>Ana’s Tuesday, and her agent’s.</h2>
  <p>Ana teaches an evening course in bookkeeping at the town’s adult education centre. Every Tuesday 31 students send in a spreadsheet exercise by e-mail. On the left is her evening. On the right, what her agent did with it.</p>
</section>
<section class="l-story">
  <div class="l-heads" aria-hidden="true"><p>Ana</p><span></span><p>Her agent, on the team’s server</p></div>
${LANES.map(row).join('\n')}
</section>
<section class="day-end"><p>Next Tuesday starts from the same checker, and from an exercise that is right.</p></section>
${stub('Ana')}
</div>`;
}
function initV2() { return null; }

// =====================================================================
// 3 Viisi iltaa: a week of fifteen-minute evenings; the memory is a file
// =====================================================================
const CAMP = ['Lakeside SC · Summer camp', 'Nora’s workspace'];
// The status file after each evening: '+' new tonight, '-' gone tonight, ' ' as before.
const STATUS = [
  [
    '+# Junior summer camp: status', '+', '+## Roster  (camp/roster.csv)', '+64 children: U9 am 17 · U9 pm 15 · U11 am 18 · U11 pm 14', '+Sources: web form 51 · coaches’ mails 9 · Ahl spreadsheet 6 (2 also on the form)', '+', '+## Open', '+- [ ] Noa Lind / Noah Lind: same birthday, same parent. Duplicate?', '+- [ ] Welcome letters', '+', '+Updated Mon 21:12',
  ],
  [
    ' # Junior summer camp: status', ' ', ' ## Roster  (camp/roster.csv)', '-64 children: U9 am 17 · U9 pm 15 · U11 am 18 · U11 pm 14', '+63 children: U9 am 17 · U9 pm 15 · U11 am 17 · U11 pm 14', ' Sources: web form 51 · coaches’ mails 9 · Ahl spreadsheet 6 (2 also on the form)', '+Merged Noa and Noah Lind (Tue)', ' ', ' ## Open', '-- [ ] Noa Lind / Noah Lind: same birthday, same parent. Duplicate?', '-- [ ] Welcome letters', '+- [ ] Welcome letters: 63 written in camp/letters/, not sent', ' ', '-Updated Mon 21:12', '+Updated Tue 21:31',
  ],
  [
    ' # Junior summer camp: status', ' ', ' ## Roster  (camp/roster.csv)', ' 63 children: U9 am 17 · U9 pm 15 · U11 am 17 · U11 pm 14', ' Sources: web form 51 · coaches’ mails 9 · Ahl spreadsheet 6 (2 also on the form)', ' Merged Noa and Noah Lind (Tue)', '+', '+## Changes', '+Week 2: U11 afternoon moves to 9–12 (Erik ill). 14 letters updated.', ' ', ' ## Open', '-- [ ] Welcome letters: 63 written in camp/letters/, not sent', '+- [x] Welcome letters: 63 sent Wed 21:24', ' ', '-Updated Tue 21:31', '+Updated Wed 21:26',
  ],
  [
    ' # Junior summer camp: status', ' ', ' ## Roster  (camp/roster.csv)', '-63 children: U9 am 17 · U9 pm 15 · U11 am 17 · U11 pm 14', '+64 children: U9 am 17 · U9 pm 15 · U11 am 18 · U11 pm 14', ' Sources: web form 51 · coaches’ mails 9 · Ahl spreadsheet 6 (2 also on the form)', '-Merged Noa and Noah Lind (Tue)', '+Noa and Noah Lind are twins: Tuesday’s merge undone (Thu)', ' ', ' ## Changes', ' Week 2: U11 afternoon moves to 9–12 (Erik ill). 14 letters updated.', ' ', ' ## Open', ' - [x] Welcome letters: 63 sent Wed 21:24', '+- [x] Noah Lind’s letter sent Thu 21:38', ' ', '-Updated Wed 21:26', '+Updated Thu 21:38',
  ],
  [
    ' # Junior summer camp: status', ' ', ' ## Roster  (camp/roster.csv)', ' 64 children: U9 am 17 · U9 pm 15 · U11 am 18 · U11 pm 14', ' Noa and Noah Lind are twins: Tuesday’s merge undone (Thu)', '+Allergies noted: 2 (from parents’ replies)', ' ', ' ## Changes', ' Week 2: U11 afternoon moves to 9–12 (Erik ill). 14 letters updated.', ' ', '+## Tools', '+camp/make_lists.py: one sheet per group, with allergies and parents’ phones', '+', ' ## Open', ' - [x] Welcome letters: 63 sent Wed 21:24', ' - [x] Noah Lind’s letter sent Thu 21:38', '+- [ ] Consent forms missing: 4 (reminder drafts ready)', ' ', '-Updated Thu 21:38', '+Updated Fri 21:14',
  ],
];
const EVES = [
  {
    day: 'Mon', time: '21:05',
    ask: 'Camp sign-ups: the form export is in Drive, two coaches mailed me names, and Mrs Ahl sent a spreadsheet. One list, please.',
    did: 'It reads the form export from her Drive, the two coaches’ mails and the spreadsheet attached to Mrs Ahl’s, and merges them with a script into one roster, names and groups tidied.',
    back: '64 children in four groups, and one question: Noa Lind and Noah Lind share a birthday and a parent’s e-mail. The same child?',
    why: 'Three formats from three places become one file through a program, not copy and paste. Then it writes down where things stand.',
    screen: () => screen(CAMP, you('Mon 21:05', 'Camp sign-ups: the form export is in Drive, two coaches mailed me names, and Mrs Ahl sent a spreadsheet. One list, please.') + pi([
      tool('read', 'drive/Club/Camp 2027/signups-export.csv', '51 rows'),
      tool('bash', 'gog gmail search "camp from:(erik OR ville OR ahl)" --attachments camp/in/', '3 messages · saved ahl-kids.xlsx'),
      tool('bash', 'python3 camp/merge_roster.py', 'form 51 · mails 9 · ahl 6 · already on form 2\n→ camp/roster.csv  64 children\n? possible duplicate: Noa Lind / Noah Lind (2017-05-08, same parent e-mail)', true),
      tool('write', 'camp/STATUS.md', '11 lines'),
    ], reply('**64 children** in `camp/roster.csv`, in four groups. One question before the letters: **Noa Lind** and **Noah Lind** have the same birthday and the same parent. Is that one child?'), '4 tools')),
  },
  {
    day: 'Tue', time: '21:20',
    ask: 'Yes, merge the Linds. Then the welcome letters.',
    did: 'It reads STATUS.md before anything else and picks up where Monday stopped. It merges the two rows and writes one letter per family, with the group’s own times and the kit list from last summer’s letter.',
    back: '63 letters in the camp folder, not sent. Two to read as samples.',
    why: 'It began by reading Monday’s file. Nothing had to be explained again.',
    screen: () => screen(CAMP, you('Tue 21:20', 'Yes, merge the Linds. Then the welcome letters.') + pi([
      tool('read', 'camp/STATUS.md', 'Updated Mon 21:12 · open: Lind duplicate, welcome letters', true),
      tool('edit', 'camp/roster.csv', '−1 row  (Noah Lind merged into Noa Lind)'),
      tool('read', 'drive/Club/Camp 2026/welcome-letter.docx', 'kit list · drop-off · rain plan'),
      tool('bash', 'python3 camp/make_letters.py', '63 letters → camp/letters/'),
    ], reply('Merged. **63 letters** are in `camp/letters/`, one per family with their group’s times. Nothing is sent. Read two first?', offer('letters-sample.pdf', 'PDF · 2 letters')), '4 tools')),
  },
  {
    day: 'Wed', time: '21:10',
    ask: 'Erik is ill in week 2. U11 afternoon training moves to mornings that week. Who does that touch?',
    did: 'It finds the 14 children in U11 afternoons in the roster and rewrites only their week 2 paragraph. Nora reads two letters and says send. The letters go from her own Gmail.',
    back: '14 families affected, 49 letters untouched, all 63 sent at 21:24.',
    why: 'The letters are made from the roster, so one change reaches exactly the families it should.',
    screen: () => screen(CAMP, you('Wed 21:10', 'Erik is ill in week 2. U11 afternoon training moves to mornings that week. Who does that touch?') + pi([
      tool('bash', 'python3 camp/make_letters.py --group "U11 pm" --week 2 --time 9-12', '14 letters rewritten · 49 unchanged', true),
    ], reply('**14 families** in U11 afternoons. Their letters now say 9–12 in week 2; the other 49 are as they were.') + you('Wed 21:22', 'Looks right. Send them all.') + reply('Sent **63** from nora.hale@lakeside-sc.example.org at 21:24.'), '1 tool')),
  },
  {
    day: 'Thu', time: '21:30',
    ask: 'Mrs Lind just replied: Noa and Noah are twins!',
    did: 'It finds Tuesday’s merge in the roster’s history and undoes that one change, keeping Wednesday’s. Noah is back and gets his own letter, which Nora sends.',
    back: 'Tuesday’s merge, shown and undone. 64 children again; week 2 stays as Wednesday left it.',
    why: 'Every change to the roster is recorded, so one wrong step can be undone without losing what came after.',
    screen: () => screen(CAMP, you('Thu 21:30', 'Mrs Lind just replied: Noa and Noah are twins!') + pi([
      tool('bash', 'git log --oneline -- camp/roster.csv', 'c41e  Wed 21:24  Mark 63 families welcomed\n7a90  Wed 21:12  Week 2: U11 pm to mornings\n2be3  Tue 21:22  Merge Noa/Noah Lind\nd015  Mon 21:11  Roster from three sources', true),
      tool('bash', 'git revert 2be3', 'Revert "Merge Noa/Noah Lind" · roster.csv +1 row'),
      diff('camp/roster.csv', [' Lind,Noa,2017-05-08,U11 am,welcomed', '+Lind,Noah,2017-05-08,U11 am,']),
    ], reply('Undid Tuesday’s merge only: **64 children**, and Wednesday’s change stays. Noah’s letter is ready.') + you('Thu 21:37', 'Send it.') + reply('Sent to the Linds at 21:38.'), '3 tools')),
  },
  {
    day: 'Fri', time: '21:00',
    ask: 'What’s still open before Monday? And the coaches will want lists on camp day.',
    did: 'It reads STATUS.md and the week’s mail: four consent forms missing, two allergy notes to add. Then it writes a small program that turns the roster into one printable sheet per group, with allergies and parents’ phone numbers.',
    back: 'Four reminder drafts and four group sheets. The program stays in the camp folder.',
    why: 'The tool it wrote is still there for a late sign-up on Sunday, and for next summer.',
    screen: () => screen(CAMP, you('Fri 21:00', 'What’s still open before Monday? And the coaches will want lists on camp day.') + pi([
      tool('read', 'camp/STATUS.md', 'Updated Thu 21:38', true),
      tool('bash', 'gog gmail search "camp after:mon" --unanswered', '60 replies with consent · 2 mention allergies · 4 families no reply'),
      tool('write', 'camp/make_lists.py', '48 lines'),
      tool('bash', 'python3 camp/make_lists.py', 'lists/U9-am.pdf  lists/U9-pm.pdf  lists/U11-am.pdf  lists/U11-pm.pdf', true),
    ], reply('Open: **4 consent forms**. Reminder drafts are in your Gmail. Two allergies are now in the roster.\n\nThe coaches’ lists: run `make_lists.py` again whenever the roster changes.', offer('camp-lists.pdf', 'PDF · 4 groups')), '4 tools')),
  },
];
const statusFile = (k) => `<div class="f-file"><p class="f-h">${FILE_IC}<span>camp/STATUS.md</span><small>after ${EVES[k].day}</small></p><pre>${STATUS[k].map((l) => `<span class="${l[0] === '+' ? 'add' : l[0] === '-' ? 'del' : 'ctx'}">${esc(l.slice(1)) || ' '}</span>`).join('')}</pre></div>`;
function v3() {
  return `<div class="pg v3">
${hero(2)}
<section class="day-intro" id="day">
  <p class="kicker">Five evenings, fifteen minutes each</p>
  <h2>Nora’s week of summer-camp sign-ups.</h2>
  <p>Nora is the volunteer secretary of Lakeside Sports Club. She runs the junior summer camp in a quarter of an hour a night, after her own job. Her agent does not lean on remembering their chats. It keeps the camp in files, and every evening begins by reading them.</p>
</section>
<div class="w-wrap">
<nav class="w-week" aria-label="Evenings">${EVES.map((e, i) => `<a href="#eve-${i}" data-i="${i}"${i === 0 ? ' aria-current="true"' : ''}><b>${e.day}</b><span>${e.time}</span></a>`).join('')}</nav>
<section class="w-story">
  <div class="w-eves">
${EVES.map((e, i) => `<article class="w-eve" id="eve-${i}" data-i="${i}">
    <p class="w-time"><b>${e.day}</b><span>${e.time}</span></p>
    <h3 class="ask">“${e.ask}”</h3>
    <p class="did">${e.did}</p>
    ${e.screen()}
    <p class="back"><span>Back</span>${e.back}</p>
    <p class="why"><span>Real computer</span>${e.why}</p>
    <details class="w-inline"${i === 0 ? ' open' : ''}><summary>camp/STATUS.md after ${e.day}</summary>${statusFile(i)}</details>
  </article>`).join('\n')}
  </div>
  <aside class="w-side" aria-label="The camp’s status file">
    <p class="w-side-k">What the agent reads first, every evening</p>
    <div class="w-files">${EVES.map((e, i) => `<div class="w-f${i === 0 ? ' on' : ''}">${statusFile(i)}</div>`).join('')}</div>
    <p class="w-side-n">Green is new that evening; struck lines are gone.</p>
  </aside>
</section>
</div>
<section class="day-end"><p>Next spring, whoever takes over from Nora opens the same folder: the roster, the letters, the status file and the lists tool.</p></section>
${stub('Nora')}
</div>`;
}
function initV3(root) {
  const eves = [...root.querySelectorAll('.w-eve')];
  const files = [...root.querySelectorAll('.w-f')];
  const days = [...root.querySelectorAll('.w-week a')];
  let cur = 0;
  const show = (i) => {
    if (i === cur) return;
    cur = i;
    files.forEach((f, j) => f.classList.toggle('on', j === i));
    days.forEach((d, j) => (j === i ? d.setAttribute('aria-current', 'true') : d.removeAttribute('aria-current')));
  };
  const io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && show(+e.target.dataset.i)), { rootMargin: '-40% 0px -55% 0px' });
  eves.forEach((e) => io.observe(e));
  // The week strip jumps to an evening; the fixed strip's height is left above it.
  const nav = root.querySelector('.w-week');
  nav.addEventListener('click', (e) => {
    const a = e.target.closest('a'); if (!a) return;
    e.preventDefault();
    const t = eves[+a.dataset.i];
    window.scrollTo({ top: t.getBoundingClientRect().top + scrollY - nav.offsetHeight - 16, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  });
  return () => io.disconnect();
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
    const p = undo.parentElement; const sp = p.querySelector('span');
    const undone = undo.toggleAttribute('data-undone');
    undo.textContent = undone ? 'Redo' : 'Undo this change';
    sp.textContent = undone ? 'Undone 08:06 · back to “Kalle”' : 'Recorded 08:05 · “Kalle → Kallio”';
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
