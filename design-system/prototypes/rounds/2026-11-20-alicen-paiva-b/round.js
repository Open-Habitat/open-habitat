// Round 3 (b) of the landing page: what Alice's day contains. The hero is round
// 2's, unchanged, and the layout of the day is round 2's "Alicen päivä" (timed
// chapters beside a screen that changes). The three variants are three
// different days from the inside of an organisation: a month-end close, a board
// meeting, and a contracts folder. Every person, organisation, address and
// amount is invented. The screens are drawn with lib/language.css, not captured.
// build.mjs defines IMG and VARIANTS; lib/picker.js expects `stage` and `variants`.
const stage = document.getElementById('stage');

const REPO = 'https://github.com/Open-Habitat/open-habitat';
const RING = 'M9 -2v6a5 5 0 0 1-5 5h-8a5 5 0 0 1-5-5v-8a5 5 0 0 1 5-5h8a5 5 0 0 1 5 5z';
const mark = (px = 22, state = 'idle') => `<svg class="oh-mark" data-state="${state}" viewBox="-12 -12 24 24" width="${px}" height="${px}" aria-hidden="true"><path class="oh-ring" pathLength="100" d="${RING}"/><circle class="oh-dot" r="2.5"/></svg>`;
const CHEV = '<svg class="chev" viewBox="0 0 12 12" aria-hidden="true"><path d="M4.5 2.5 8 6l-3.5 3.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const CHECK = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 6.5 5 9l4.5-6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const SV = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const I_MIC = SV('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>');
const I_FILE = SV('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>');
const I_VIEW = SV('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M13 4v16"/>');
const I_CLIP = SV('<path d="M20 11.5 12 19.5a5 5 0 0 1-7-7l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7L9.7 17.2a1.7 1.7 0 0 1-2.4-2.4L15 7"/>');

// ---------- The hero: round 2's, identical in every variant ----------
const hero = (i) => `<p class="rq-line" lang="fi"><b>${i + 1}/3 ${VARIANTS[i][0]}.</b> ${VARIANTS[i][1]} <span>1–3 tai ←/→ vaihtaa</span></p>
<header class="top"><a class="brandword" href="#">${mark(24)} Open Habitat</a><nav><a href="#day">A day</a><a href="#install">Install</a><a href="#install">Limits</a><a href="${REPO}">GitHub</a></nav></header>
<section class="hero">
  <p class="eyebrow">Open source · on your own server · pre-release 0.1</p>
  <h1>Coding-grade AI agents <br>for your whole team.</h1>
  <p class="lede">No terminal required. Everyone gets a real agent with its own Linux account, in a browser tab. One person sets up one server; everyone else signs in and gets to work.</p>
  <p class="cta"><a class="btn" href="#install">Install on your server</a><a class="btn ghost" href="#day">See it work</a></p>
</section>
<figure class="hero-band"><img class="hero-img" src="${IMG.hero.src}" width="${IMG.hero.w}" height="${IMG.hero.h}" alt="A conversation with an agent in Open Habitat on a desktop browser, with running and waiting conversations in the sidebar, and the same conversation on a phone"></figure>`;

// ---------- The screen: a conversation drawn in the product's own language ----------
// win(title, state, parts, opts): the conversation's top bar, the thread, an
// optional view beside it, and the message field. state: run | turn | done.
const STATE = { run: ['working', 'Working'], turn: ['waiting', 'Your turn'], done: ['done', 'Done'] };
const win = (title, state, thread, o = {}) => `<div class="sc${o.view ? ' split' : ''}${o.phone ? ' phone' : ''}">
  <div class="sc-bar">${mark(16, STATE[state][0])}<b>${title}</b><span class="sc-state st-${state}">${STATE[state][1]}</span></div>
  <div class="sc-body"><div class="sc-thread">${thread.join('')}</div>${o.view || ''}</div>
  <div class="sc-comp"><span>${o.comp || 'Message your agent'}</span>${I_MIC}<i>Send</i></div>
</div>`;
const you = (time, text, o = {}) => `<article class="bubble user"><div class="bubble-head"><span class="who">You</span>${o.mic ? `<span class="sc-mic">${I_MIC}dictated</span>` : ''}<time class="meta">${time}</time></div><div class="prose"><p>${text}</p>${o.file ? `<p class="sc-att">${I_CLIP}${o.file}</p>` : ''}</div></article>`;
const tool = (name, target, stat = '', body = '') => ['tool', `<section class="tool"><div class="disc">${CHEV}<span class="names"><span class="name">${name}</span><span class="target">${target}</span></span>${stat ? `<span class="tstat">${stat}</span>` : ''}<span class="ok">${CHECK}done</span></div>${body ? `<div class="tool-body">${body}</div>` : ''}</section>`];
const reply = (html) => ['reply', `<article class="bubble reply"><div class="prose">${html}</div></article>`];
const turn = (sum, rows) => {
  const cells = [`<div class="rail-cell first"><span class="node head"></span></div><div class="cell"><div class="head-cell"><span class="who">Pi</span><span class="sum">${sum}</span></div></div>`];
  rows.forEach(([k, html], i) => cells.push(`<div class="rail-cell${i === rows.length - 1 ? ' last' : ''}"><span class="node ${k === 'tool' ? 'tool done' : 'done'}"></span></div><div class="cell">${html}</div>`));
  return `<div class="turn">${cells.join('')}</div>`;
};
const pre = (lines) => `<pre>${lines.join('\n')}</pre>`;
const diff = (lines) => `<pre class="diff">${lines.map(([s, t]) => `<span class="dl ${s === '+' ? 'add' : s === '-' ? 'del' : ''}"><span class="sg">${s}</span><span>${t}</span></span>`).join('')}</pre>`;
const table = (head, rows) => `<div class="md-table"><table><thead><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
const file = (name, facts, o = {}) => `<div class="sc-file${o.open ? ' open' : ''}"><span class="sc-file-ic">${o.view ? I_VIEW : I_FILE}</span><span class="sc-file-t"><b>${name}</b><span>${facts}</span></span><i>${o.view ? (o.open ? 'Open beside' : 'Open') : 'Download'}</i></div>`;
const view = (title, facts, html) => `<aside class="sc-view"><div class="sc-view-head"><b>${title}</b><span>${facts}</span></div><div class="sc-view-body">${html}</div></aside>`;
const recap = (age, text, next) => `<aside class="recap"><div class="k-head"><span class="k-title">Recap</span><span class="k-age">${age}</span></div><p class="k-text">${text}</p><p class="k-next"><span class="k-label">Next</span><span>${next}</span></p></aside>`;
const folded = (sum) => `<div class="sc-folded">${CHEV}<span class="who">Pi</span><span class="sum">${sum}</span></div>`;
const draft = (to, subject, body, att) => `<div class="sc-draft"><p><span>To</span>${to}</p><p><span>Subject</span>${subject}</p><p class="sc-draft-b">${body}</p>${att ? `<p class="sc-att">${I_CLIP}${att}</p>` : ''}</div>`;

// ---------- Story 1: the month-end close ----------
const S1 = {
  kicker: 'One person, one day · Tuesday 3 November',
  title: 'Alice closes October.',
  intro: 'Alice runs the office at Example Studio, a design studio of fourteen people: the money, the contracts, the board’s paperwork. She has never opened a terminal. On the third of every month she closes the books for the month before. This is that day, with an agent of her own.',
  scenes: [
    {
      t: '08:40', l: 'The exports',
      ask: '“The October exports are in the books folder. Same as last month.”',
      p: 'Her agent opens the three reports she exported from the bookkeeping service into the studio’s Drive, and runs the checker it wrote with her in September. The reports agree with each other. It stops at one thing, a new account, and asks where it belongs.',
      why: '“Same as last month” works because last month is on disk: the checker, the rules she decided, September’s workbook. Nothing is recalled from a chat.',
      sc: () => win('October close', 'turn', [
        you('08:40', 'The October exports are in the books folder. Same as last month.'),
        turn('Work · 5 steps · 1 min', [
          tool('read', 'books/rules.md'),
          tool('bash', 'python tools/check_exports.py 2026-10', '', pre([
            'income statement = ledger, by account    ok',
            'balance sheet balances                   ok',
            'company and period  Example Studio 10/26 ok',
            'chart of accounts   1 new: 6540 Software subscriptions',
          ])),
          reply('<p>The three reports agree with each other and they are all for October.</p><p>One new account: <b>6540 Software subscriptions</b>, €1,284.00 this month. In September you put hosting under IT. Does 6540 go under IT as well, or is it split by team?</p>'),
        ]),
      ]),
    },
    {
      t: '09:05', l: 'The receipts',
      ask: '“IT. And the accountant sent her list of payments with no receipt. Can you find them?”',
      p: 'The agent takes the accountant’s spreadsheet from Alice’s mail: fourteen card payments. It searches her mailbox, reads every invoice PDF and the photos Bob sent from his phone, and matches each to a payment by date and amount. Eleven are found, renamed and filed in October’s folder. Three are left, and it asks about them by name. One is €49.00 to a company called Fjordframe.',
      why: 'It works in Alice’s own mailbox and Drive, as Alice, and it reads the PDFs with a program instead of guessing from file names. A match is the date and the amount to the cent.',
      sc: () => win('October close', 'turn', [
        you('09:05', 'IT. And the accountant sent her list of payments with no receipt. Can you find them?'),
        turn('Work · 19 steps · 6 min', [
          tool('mail', 'search: invoices and receipts since 30 Sep', '212 messages'),
          tool('bash', 'python tools/match_receipts.py missing-2026-10.xlsx', '11 of 14'),
          tool('drive', 'upload Books/2026-10/receipts/', '11 files'),
          reply(`<p>Eleven of the fourteen are filed, and the accountant’s sheet is filled in.</p>${table(['Paid', 'To', '€', 'Receipt'], [
            ['02.10.', 'Paper Mill Ltd', '212.40', 'your mail, 2 Oct'],
            ['09.10.', 'Hilltop Hosting', '64.00', 'your mail, 9 Oct'],
            ['', '<i>nine more</i>', '', ''],
          ])}<p><b>Three I could not find:</b></p><ul><li>03.10. <b>Fjordframe</b>, €49.00. No mail from them at all.</li><li>14.10. Kettle &amp; Co, €86.50. Bob’s card. Shall I ask Bob?</li><li>22.10. Parking, €12.00.</li></ul>`),
        ]),
      ]),
    },
    {
      t: '10:30', l: 'She leaves',
      ask: '“Go on with the forecast. I’m in the staff meeting until twelve.”',
      p: 'Alice closes her laptop. The agent goes on: staff costs by team, October’s figures into a new copy of the forecast, every check run. At 11:40 she looks at her phone in the corridor. The conversation is under Your turn, with a recap of the hour and one thing that needs her.',
      why: 'The agent runs on the studio’s server, not in her browser tab. A closed laptop stops nothing, and what waits for her is one question, not a transcript to scroll through.',
      sc: () => win('October close', 'turn', [
        folded('Work · 31 steps · 58 min'),
        recap('2 min ago', 'October is in a new copy of the forecast and all nine checks pass. While matching receipts I looked at <b>Fjordframe</b> again: €49.00 on the 3rd of every month since September 2025. Fourteen payments, €686.00, and no invoice, no sign-in mail and nobody’s name on it.', 'Tell me whether to list everything the studio pays for every month.'),
      ], { phone: true }),
    },
    {
      t: '11:50', l: 'The question back', back: [1, 'the payment with no receipt'],
      ask: '“Yes. List everything we pay for every month, twelve months back.”',
      p: 'She says it into her phone on the way back to her desk. There is no report like that, so the agent writes a small program: it groups twelve months of card and bank lines into vendors and keeps the ones that repeat. The result opens beside the conversation. Twenty-three subscriptions; two video tools that do the same job; and Fjordframe, bought for a project that ended last autumn.',
      why: 'No such tool existed, so the agent made one. It is in the tools folder now, and in December the same report takes one sentence.',
      sc: () => win('October close', 'done', [
        you('11:50', 'Yes. List everything we pay for every month, twelve months back.', { mic: true }),
        turn('Work · 8 steps · 3 min', [
          tool('write', 'tools/recurring.py', '<span class="s-add">+84</span>'),
          tool('bash', 'python tools/recurring.py --months 12', '1,912 lines'),
          reply(`<p>23 vendors charge the studio every month: <b>€1,284</b> in October. Three things stand out; the page has all of them.</p>${file('Recurring payments', 'View · made 11:53', { view: true, open: true })}`),
        ]),
      ], { view: view('Recurring payments', 'Nov 2025 – Oct 2026', `<div class="sc-bars">${[['Design suite', 100, '412.00'], ['Hilltop Hosting', 34, '138.00'], ['Fjordframe', 12, '49.00', 1], ['Vidnote', 9, '35.00', 1], ['Clipreel', 7, '29.00', 1], ['18 more', 100, '621.00', 2]].map(([n, w, e, f]) => `<p${f === 1 ? ' class="flag"' : f === 2 ? ' class="rest"' : ''}><span>${n}</span><i style="width:${f === 2 ? 0 : w}%"></i><b>${e}</b></p>`).join('')}</div><ul class="sc-notes"><li><b>Fjordframe</b>: no one has signed in since the Riverside project ended in September 2025.</li><li><b>Vidnote</b> and <b>Clipreel</b> both record screen videos.</li></ul>`) }),
    },
    {
      t: '13:20', l: 'The forecast',
      ask: '“I’ll cancel Fjordframe myself. What does October do to the forecast?”',
      p: 'The new forecast is a dated copy next to September’s, written only after every check passed. The agent says in four lines what changed: cash at the end of October, the months of money left, the one cost that moved. Then it lists the cells that differ from September’s workbook.',
      why: 'September’s workbook is untouched and October’s sits beside it. Alice can see exactly which cells changed, and going back is one request, not an afternoon of Ctrl+Z.',
      sc: () => win('October close', 'done', [
        you('13:20', 'I’ll cancel Fjordframe myself. What does October do to the forecast?'),
        turn('Work · 4 steps · 1 min', [
          tool('bash', 'python tools/update_forecast.py 2026-10 --compare 2026-09', '9 of 9 checks', diff([
            [' ', 'Actuals!K4:K41   October filled in, 38 cells'],
            ['-', 'Cash!K12         179,900   (September’s forecast)'],
            ['+', 'Cash!K12         184,300   (actual)'],
            ['+', 'Staff!K9         IT: +1,284 from account 6540'],
          ])),
          reply(`<ul><li>Cash at the end of October: <b>€184,300</b>, €4,400 above the forecast.</li><li>Money lasts <b>7.4 months</b> at this pace. In September it was 7.1.</li><li>Two invoices were paid early; that is timing, not new income.</li><li>Without Fjordframe, €588 less a year.</li></ul>${file('Forecast 2026-10.xlsx', 'Spreadsheet · next to Forecast 2026-09.xlsx')}`),
        ]),
      ]),
    },
    {
      t: '15:10', l: 'The owners’ page', back: [3, 'the subscriptions'],
      ask: '“Make the monthly page for Anna and Chen. Mention the subscriptions.”',
      p: 'The agent fills October into last month’s one-page layout, writes three sentences on what changed, makes the PDF and leaves a draft in Alice’s mailbox with the page attached. Nothing has gone anywhere. She changes one word and says “Send it.”',
      why: 'The page is a real PDF built from the workbook’s numbers, and the draft is in her own mailbox. The agent prepares; sending is Alice’s decision.',
      sc: () => win('October close', 'done', [
        you('15:10', 'Make the monthly page for Anna and Chen. Mention the subscriptions.'),
        turn('Work · 5 steps · 2 min', [
          tool('bash', 'python tools/owner_page.py 2026-10', 'PDF, 1 page'),
          tool('mail', 'draft: Example Studio, October in one page'),
          reply(`<p>The draft is in your mailbox. I have not sent it.</p>${draft('anna@example.org, chen@example.org', 'Example Studio, October in one page', 'Cash is €184,300 and lasts 7.4 months. We found 23 monthly subscriptions and are ending three of them…', 'October 2026.pdf')}`),
        ]),
        you('15:22', 'Send it.'),
        turn('Work · 1 step', [tool('mail', 'send: Example Studio, October in one page', 'sent 15:22')]),
      ]),
    },
    {
      t: '16:05', l: 'For December', back: [0, 'the rules file'],
      ask: '“Write down what we decided, for next month.”',
      p: 'Three lines go into the rules file the morning started from: where the new account belongs, that Fjordframe is cancelled and should be flagged if it charges again, that Bob’s lunch receipts come as photos. The agent shows the lines it added. October is closed.',
      why: 'What Alice decided today is a file with a history, not a memory. On the third of December the agent starts by reading it, whoever opens the conversation.',
      sc: () => win('October close', 'done', [
        you('16:05', 'Write down what we decided, for next month.'),
        turn('Work · 2 steps', [
          tool('edit', 'books/rules.md', '<span class="s-add">+3</span>', diff([
            [' ', '5130 Hosting → IT (decided 3 Oct)'],
            ['+', '6540 Software subscriptions → IT (decided 3 Nov)'],
            ['+', 'Fjordframe cancelled 3 Nov. Flag any new charge.'],
            ['+', 'Bob’s lunch receipts arrive as phone photos.'],
          ])),
          reply('<p>October is closed. All fourteen receipts are filed: Bob brought two, and the parking is written off as you said.</p><p>In December I start from these rules.</p>'),
        ]),
      ]),
    },
  ],
  close: ['By five o’clock', ['October’s books are closed and every receipt is filed next to its payment.', 'The owners have their page, and the forecast has a new dated version.', 'A €49 charge nobody remembered is cancelled, and the studio has a list of all 23 subscriptions.']],
};

// ---------- Story 2: the board meeting ----------
const chart = () => {
  const line = (pts, cls) => `<polyline class="${cls}" points="${pts.map((y, i) => `${10 + i * 40},${y}`).join(' ')}"/>`;
  return `<svg class="sc-chart" viewBox="0 0 300 130" role="img" aria-label="Three cash scenarios over 24 months"><path class="ax" d="M10 118h280M10 10v108"/>${line([40, 44, 50, 52, 49, 46, 42, 38], 'a')}${line([40, 46, 62, 74, 78, 74, 68, 60], 'b')}${line([40, 46, 56, 64, 88, 96, 92, 84], 'c')}<text x="292" y="34" text-anchor="end">lease only</text><text x="292" y="56" text-anchor="end">+ print line in spring</text><text x="292" y="102" text-anchor="end">+ print line in autumn</text></svg>`;
};
const S2 = {
  kicker: 'One person, one day · Thursday 19 November',
  title: 'The board meets at one.',
  intro: 'Alice runs the office at Example Studio, a design studio of fourteen people, and she is the secretary of its board. She has never opened a terminal. Four times a year the board meets, and the day belongs to that meeting: before it, in it and after it. This is that day, with an agent of her own.',
  scenes: [
    {
      t: '08:15', l: 'What is open',
      ask: '“Board at one. What is still open from September?”',
      p: 'Her agent reads September’s minutes and the action list in the board folder, then checks every action against Alice’s mail and calendar. Four of six are done, each with the message that shows it. Two are open. One is the lease: the landlord wrote on Tuesday with an offer that runs out tomorrow.',
      why: 'The agent starts from the files the last meeting left behind and from Alice’s own mailbox. Nobody has to tell it what happened in September.',
      sc: () => win('Board, 19 November', 'done', [
        you('08:15', 'Board at one. What is still open from September?'),
        turn('Work · 9 steps · 2 min', [
          tool('read', 'board/2026-09-17/minutes.md'),
          tool('read', 'board/actions.md'),
          tool('mail', 'search: 6 actions, since 17 Sep', '41 messages'),
          tool('calendar', '17 Sep – 19 Nov', '23 events'),
          reply('<p>Six actions from September. <b>Four are done</b>: the auditor’s letter is signed (mail, 2 Oct), the pension change is confirmed, and two more.</p><p><b>Two are open:</b></p><ul><li><b>The lease.</b> Larch Property wrote on Tuesday: five more years at €4,150 a month. The offer is valid until <b>Friday 20 November</b>.</li><li><b>The second print line.</b> Only one quote has arrived.</li></ul>'),
        ]),
      ]),
    },
    {
      t: '09:30', l: 'Can we afford it',
      ask: '“They’ll ask whether we can afford both. Make something they can look at.”',
      p: 'The agent takes three years of payments from the bookkeeping export, separates rent and one-off costs from the rest, and computes three scenarios month by month: the lease alone, and the print line bought in spring or in autumn. A page opens beside the conversation, ready to put on the wall at one.',
      why: 'The scenarios are computed by a program from 3,412 real payment lines, not estimated in a paragraph. The page is a file the board can open, and the program can be run again.',
      sc: () => win('Board, 19 November', 'done', [
        you('09:30', 'They’ll ask whether we can afford both. Make something they can look at.'),
        turn('Work · 7 steps · 4 min', [
          tool('write', 'board/tools/cash_scenarios.py', '<span class="s-add">+112</span>'),
          tool('bash', 'python board/tools/cash_scenarios.py --months 24', '3,412 lines'),
          reply(`<p>Both fit, if the print line waits for spring. Bought in autumn, cash dips to <b>€61,000</b> in month 17.</p>${file('Cash, 24 months ahead', 'View · made 09:34', { view: true, open: true })}`),
        ]),
      ], { view: view('Cash, 24 months ahead', 'three scenarios', `${chart()}<ul class="sc-notes"><li>Lowest point, lease only: <b>€118,000</b>.</li><li>With the print line in spring: <b>€84,000</b>.</li><li>With the print line in autumn: <b>€61,000</b>.</li></ul>`) }),
    },
    {
      t: '11:00', l: 'Chen’s comments',
      ask: '“Chen sent the pre-read back with comments. Deal with them.”',
      p: 'Chen chairs the board and edits in Word. The agent opens his file from Alice’s mail and lists all 31 comments. It fixes 28 in the text and leaves the three only Alice can settle. She gets a new Word file and one page on what changed. The old version is kept under its old name.',
      why: 'The agent opens the Word file itself and goes through it comment by comment with a program. None of the 31 is lost, and every changed sentence can be listed afterwards.',
      sc: () => win('Board, 19 November', 'turn', [
        you('11:00', 'Chen sent the pre-read back with comments. Deal with them.'),
        turn('Work · 12 steps · 5 min', [
          tool('mail', 'attachment: Pre-read v2 (Chen).docx'),
          tool('bash', 'python board/tools/docx_comments.py', '31 comments'),
          reply(`<p>28 comments are handled. <b>Three are yours:</b></p><ul><li><b>#7</b> Does the print line’s price include installation? I cannot tell from the quote.</li><li><b>#19</b> “Too rosy” on the hiring paragraph.</li><li><b>#26</b> Move the lease to item 2. That changes the agenda.</li></ul>${file('Pre-read v3.docx', 'Word · 6 pages')}${file('What changed.pdf', 'PDF · 1 page')}`),
        ]),
      ]),
    },
    {
      t: '13:25', l: 'In the meeting',
      ask: '“What have we paid Larch each year, service charges included?”',
      p: 'The board is on item 2 and somebody wants to know what the rent has really been. Alice asks from her phone, under the table. The agent adds it up from the ledger with a program and answers in under a minute, with the number of lines it counted. The offer is 5.3 % above this year.',
      why: 'A number said aloud in a board meeting has to be right. The agent counts it from the ledger and can show every line, where a chat assistant would have to guess.',
      sc: () => win('Board, 19 November', 'done', [
        you('13:25', 'What have we paid Larch each year, service charges included?', { mic: true }),
        turn('Work · 2 steps · 40 s', [
          tool('bash', 'python board/tools/ledger.py --payee "Larch Property" --by-year', '108 lines'),
          reply(`${table(['Year', 'Paid, €'], [['2023', '44,180'], ['2024', '45,960'], ['2025', '47,310']])}<p>The offer is €49,800 a year: <b>5.3 % more</b> than 2025.</p>`),
        ]),
      ], { phone: true }),
    },
    {
      t: '15:05', l: 'The minutes', back: [0, 'the action list'],
      ask: '“Here is the transcript from the recording. Minutes in the usual form.”',
      p: 'Alice recorded the meeting on her phone and hands over the transcript. The agent writes the minutes in the shape September’s had: four decisions, five actions with a name and a date, and one passage where the recording does not say who spoke. The actions go into the same list the morning started from.',
      why: 'September’s minutes are the template, the raw transcript is kept beside the new ones in case anyone disputes them, and the actions land in the list that the next meeting will open.',
      sc: () => win('Board, 19 November', 'done', [
        you('15:05', 'Here is the transcript from the recording. Minutes in the usual form.', { file: 'board-2026-11-19.txt · 7,814 words' }),
        turn('Work · 8 steps · 3 min', [
          tool('write', 'board/2026-11-19/minutes.md', '<span class="s-add">+64</span>'),
          tool('edit', 'board/actions.md', '<span class="s-add">+5</span> <span class="s-del">−4</span>'),
          reply(`<p><b>Decisions</b></p><ol><li>Accept Larch Property’s offer: five years, €4,150 a month (4–0).</li><li>The print line: decide in February, with two quotes.</li><li>The forecast is approved.</li><li>Next meeting Thursday 18 February.</li></ol><p>At 31 minutes the recording does not say who proposed item 2. I left the name open.</p>${file('Minutes 2026-11-19.docx', 'Word · 3 pages')}`),
        ]),
      ]),
    },
    {
      t: '15:40', l: 'What goes out', back: [0, 'the landlord’s Tuesday mail'],
      ask: '“Tell Larch we accept, and send the minutes to the board.”',
      p: 'Two drafts appear in Alice’s mailbox. One answers the landlord in Tuesday’s own thread and quotes the board’s decision. The other carries the minutes to the four board members. She reads both, changes a greeting and says “Send both.” The offer would have run out tomorrow.',
      why: 'The reply goes from Alice’s own mailbox into the landlord’s own thread, with the decision the minutes record. The agent drafts; Alice sends.',
      sc: () => win('Board, 19 November', 'done', [
        you('15:40', 'Tell Larch we accept, and send the minutes to the board.'),
        turn('Work · 3 steps · 1 min', [
          tool('mail', 'draft ×2'),
          reply(`<p>Two drafts are in your mailbox. Nothing is sent.</p>${draft('larch-property@example.org', 'Re: Lease renewal, Unit 4', 'The board of Example Studio decided today to accept your offer of 17 November: five years from 1 January at €4,150 a month…')}${draft('the board (4)', 'Minutes, 19 November', 'Attached are the minutes of today’s meeting. Five actions, each with a name and a date…', 'Minutes 2026-11-19.docx')}`),
        ]),
        you('15:52', 'Send both.'),
        turn('Work · 1 step', [tool('mail', 'send ×2', 'sent 15:52')]),
      ]),
    },
    {
      t: '16:40', l: 'One more question', back: [1, 'the morning’s scenarios'],
      ask: '“Chen asks what a 3 % index rise each year does to the scenarios. Run it again.”',
      p: 'Chen read the lease on the train home. The agent changes one number in the morning’s program and runs it again: the lowest point moves from €84,000 to €79,500, and the answer does not change. A short reply to Chen waits as a draft. In February the program, the minutes and the action list will be where they are now.',
      why: 'The morning’s program is still in the board folder. A new question is one changed number and a second run, not the whole calculation done again by hand.',
      sc: () => win('Board, 19 November', 'done', [
        you('16:40', 'Chen asks what a 3 % index rise each year does to the scenarios. Run it again.'),
        turn('Work · 3 steps · 1 min', [
          tool('bash', 'python board/tools/cash_scenarios.py --months 24 --rent-index 3', '3,412 lines', diff([
            ['-', 'lowest point, print line in spring    84,000'],
            ['+', 'lowest point, print line in spring    79,500'],
          ])),
          tool('mail', 'draft: Re: Index clause'),
          reply(`<p>With a 3 % rise each year the lowest point is <b>€79,500</b> instead of €84,000. Both still fit. A reply to Chen is in your drafts.</p>${file('Cash, 24 months ahead', 'View · updated 16:42', { view: true })}`),
        ]),
      ]),
    },
  ],
  close: ['By five o’clock', ['The board decided with the figures in front of it, and one of them was counted during the meeting.', 'The minutes are out, with the transcript kept beside them.', 'The landlord has the answer a day before the offer ran out, and February’s meeting already has its action list.']],
};

// ---------- Story 3: the contracts folder ----------
const WORKERS = [['contracts-1', 24, 24], ['contracts-2', 24, 24], ['contracts-3', 24, 19], ['contracts-4', 24, 22], ['contracts-5', 24, 16], ['contracts-6', 23, 23]];
const S3 = {
  kicker: 'One person, one day · Monday 23 November',
  title: 'Where is that agreement?',
  intro: 'Alice runs the office at Example Studio, a design studio of fourteen people: the money, the contracts, the board’s paperwork. She has never opened a terminal. On Monday morning a supplier’s letter sends her looking for one agreement, in a folder nobody has tidied in six years. This is that day, with an agent of her own.',
  scenes: [
    {
      t: '08:50', l: 'The letter',
      ask: '“Harbour Print Supply says prices go up 9 % on 1 January. Can they? Find our agreement.”',
      p: 'The studio’s contracts are 143 PDFs in a shared Dropbox folder, most of them scans called something like scan0042.pdf. So the agent reads them instead of trusting the names. It finds three versions, and the signed one is also in Alice’s mail from March 2024. Clause 7.2 asks for ninety days’ written notice. The letter is dated 20 November.',
      why: 'The files are pictures of paper. The agent runs text recognition on them, reads the clause itself and checks the signed copy against the one in Alice’s mailbox.',
      sc: () => win('Harbour price letter', 'done', [
        you('08:50', 'Harbour Print Supply says prices go up 9 % on 1 January. Can they? Find our agreement.'),
        turn('Work · 14 steps · 7 min', [
          tool('dropbox', 'list Contracts/', '143 files'),
          tool('bash', 'ocrmypdf --skip-text Contracts/*.pdf', '61 scans read'),
          tool('mail', 'search: Harbour Print Supply, 2024', 'signed copy, 14 Mar 2024'),
          reply('<p>The agreement in force is <code>scan0042.pdf</code>, signed 14 March 2024.</p><blockquote><p>7.2 The Supplier may change its prices by giving the Customer ninety (90) days’ written notice.</p></blockquote><p>The letter is dated 20 November, so new prices can apply from <b>18 February</b> at the earliest, not 1 January.</p><p>I had to open 61 files to find it.</p>'),
        ]),
      ]),
    },
    {
      t: '09:20', l: 'All of them',
      ask: '“I never want to search like that again. Go through all of them: who, what, signed when, ends when, how we get out.”',
      p: 'A hundred and forty-three documents are too many to read one after another. The agent splits them between six workers, gives each a batch and has each write one line per agreement into a shared register. Alice goes to do the payroll.',
      why: 'Six workers read side by side on the studio’s server, each in its own working copy so they do not step on each other, and the main agent puts their results together.',
      sc: () => win('Contract register', 'run', [
        you('09:20', 'I never want to search like that again. Go through all of them: who, what, signed when, ends when, how we get out.'),
        `<div class="sc-workers"><p class="sc-workers-h">${mark(15, 'working')}<b>6 workers</b><span>128 of 143 files read</span></p>${WORKERS.map(([n, of, d]) => `<p>${mark(14, d === of ? 'done' : 'working')}<b>${n}</b><code>register/${n}</code><i><u style="width:${Math.round(d / of * 100)}%"></u></i><span>${d} / ${of}</span></p>`).join('')}</div>`,
      ], { comp: 'Steer the work, or queue a message' }),
    },
    {
      t: '10:50', l: 'While she was away',
      ask: '“Leave the five unreadable ones, I’ll check the paper copies. Show me the list.”',
      p: 'Alice closed the tab at 09:25. At ten to eleven her phone shows the conversation under Your turn, with a recap: 143 files read, 96 separate agreements, 31 duplicates, 16 drafts that were never signed, and five scans too poor to trust. She answers in one line from the payroll office.',
      why: 'The work went on for ninety minutes with no tab open. What reaches her phone is what is done and the one thing that waits for her.',
      sc: () => win('Contract register', 'turn', [
        folded('Work · 6 workers · 1 h 24 min'),
        recap('3 min ago', 'All 143 files are read. They are <b>96 separate agreements</b>, 31 duplicates and 16 drafts that were never signed. Five scans are too poor for me to trust the dates I read from them; they are marked in the register.', 'Tell me what to do with the five, then ask the register anything.'),
        you('10:50', 'Leave the five unreadable ones, I’ll check the paper copies. Show me the list.', { mic: true }),
      ], { phone: true }),
    },
    {
      t: '12:10', l: 'The register',
      ask: '“What ends or renews in the next ninety days?”',
      p: 'The register is a spreadsheet in the contracts folder and a small program that answers questions from it. Four agreements come up. One of them is the copier lease: it renews itself for 36 months on 1 January unless notice is given by 30 November, seven days from now. The agent offers to put the four dates in Alice’s calendar, and does when she says yes.',
      why: 'The register and the program that queries it are files in the studio’s folder. They are there tomorrow, for Alice and for whoever asks next.',
      sc: () => win('Contract register', 'done', [
        you('12:10', 'What ends or renews in the next ninety days?'),
        turn('Work · 2 steps', [
          tool('bash', 'python tools/register.py --due 90d', '4 of 96'),
          reply('<p>Four. The urgent one is the <b>copier lease</b>: it renews for 36 months on 1 January unless you give notice by <b>30 November</b>. That is in seven days.</p><p>Shall I put the four notice dates in your calendar?</p>'),
        ]),
        you('12:12', 'Yes.'),
        turn('Work · 1 step', [tool('calendar', 'create: 4 reminders', '30 Nov – 15 Feb')]),
      ], { view: view('Contract register', '96 agreements · due in 90 days', table(['With', 'What', 'Notice by'], [
        ['<b>Northgate Office Machines</b>', 'copier lease, renews 36 mo', '<b>30 Nov</b>'],
        ['Brightmop Cleaning', 'cleaning, ends 31 Dec', '—'],
        ['Tern Mutual', 'insurance, renews 1 Feb', '1 Jan'],
        ['Hilltop Hosting', 'hosting, renews 15 Feb', '15 Jan'],
      ]) + file('contracts-register.xlsx', 'Spreadsheet · 96 rows')) }),
    },
    {
      t: '13:40', l: 'Tidy, and take one part back',
      ask: '“Rename the files so a person can find them. Delete nothing.”',
      p: 'The agent prepares the new names on its own copy and shows the list before the shared folder is touched: 96 agreements named by date, party and kind, duplicates and unsigned drafts set aside. Alice sees that the employment contracts would move into a folder everyone can open. “Not those. Put them back as they were.” Fourteen files go back, and the rest are applied when she says so.',
      why: 'Every change is written down before it happens, so one part can be taken back exactly and the rest applied on Alice’s word. Nothing is deleted.',
      sc: () => win('Contract register', 'turn', [
        you('13:40', 'Rename the files so a person can find them. Delete nothing.'),
        turn('Work · 5 steps · 2 min', [
          tool('bash', 'python tools/rename_plan.py Contracts/', '143 files', diff([
            ['-', 'scan0042.pdf'],
            ['+', '2024-03-14 Harbour Print Supply – supply agreement SIGNED.pdf'],
            ['-', 'Copy of lease FINAL (2).pdf'],
            ['+', '2023-01-02 Northgate Office Machines – copier lease SIGNED.pdf'],
          ])),
        ]),
        you('13:46', 'Not the employment contracts. Put them back as they were.'),
        turn('Work · 2 steps', [
          tool('bash', 'python tools/rename_plan.py --undo Staff/', '14 restored'),
          reply('<p>The 14 employment contracts are where they were, under their old names. The other 129 are ready and nothing is deleted. Apply them to the shared folder?</p>'),
        ]),
      ]),
    },
    {
      t: '14:45', l: 'The answer', back: [0, 'the morning’s letter'],
      ask: '“Now answer Harbour. Politely. And write the notice for the copier.”',
      p: 'A reply waits in Alice’s mailbox, in Harbour’s own thread: it quotes clause 7.2, attaches the signed agreement and says the new prices can apply from 18 February. The copier notice is a one-page PDF written from the lease’s own clause 11, for Anna to sign. Alice softens one sentence and says “Send the Harbour one.” Seven more weeks at the old prices.',
      why: 'The reply quotes the clause from the signed PDF and attaches it, from Alice’s own mailbox. Sending and signing stay with people.',
      sc: () => win('Harbour price letter', 'done', [
        you('14:45', 'Now answer Harbour. Politely. And write the notice for the copier.'),
        turn('Work · 4 steps · 2 min', [
          tool('mail', 'draft: Re: Price adjustment 2027'),
          reply(`${draft('harbour-print-supply@example.org', 'Re: Price adjustment 2027', 'Thank you for your letter of 20 November. Under clause 7.2 of our agreement of 14 March 2024, a price change needs ninety days’ written notice, so we expect the current prices until 18 February…', '2024-03-14 Harbour Print Supply – supply agreement SIGNED.pdf')}${file('Notice, copier lease.pdf', 'PDF · 1 page · for Anna’s signature')}`),
        ]),
        you('14:58', 'Send the Harbour one.'),
        turn('Work · 1 step', [tool('mail', 'send: Re: Price adjustment 2027', 'sent 14:58')]),
      ]),
    },
    {
      t: '16:20', l: 'One sentence', back: [0, 'the hour it took this morning'],
      ask: '“Chen just signed the freelancer agreement. File it.”',
      p: 'The agent takes the completed PDF from the signing service’s message in Alice’s mail, checks that both signatures are really there, names the file by the rule and puts it in the folder. The register gets line 97, with the end date and the notice period. It takes twenty seconds.',
      why: 'This morning one agreement took an hour to find. The register, the naming rule and the program now live in the studio’s folder, so the ninety-seventh takes one sentence.',
      sc: () => win('Contract register', 'done', [
        you('16:20', 'Chen just signed the freelancer agreement. File it.'),
        turn('Work · 4 steps · 20 s', [
          tool('mail', 'attachment: Completed, freelance agreement', '2 signatures'),
          tool('dropbox', 'upload Contracts/2026-11-23 D. Reed – freelance agreement SIGNED.pdf'),
          tool('bash', 'python tools/register.py add', 'line 97'),
          reply('<p>Filed, with both signatures present. Register line 97: ends <b>31 May 2027</b>, thirty days’ notice.</p><p>Shall I add a reminder for 1 May?</p>'),
        ]),
      ]),
    },
  ],
  close: ['By five o’clock', ['The supplier has its answer, with the clause and the signed agreement attached.', 'The copier lease will not renew itself for three years by accident.', 'Six years of contracts are one register, and the next one is filed in a sentence.']],
};

// ---------- The page: one story in round 2's "Alicen päivä" layout ----------
const STORIES = [S1, S2, S3];
function page(n) {
  const S = STORIES[n];
  const chapter = (s, i) => `<article class="d1-ch" data-i="${i}" id="sc-${i}">
      <p class="d1-time">${s.t}<span>${s.l}</span></p>
      <h3>${s.ask}</h3>
      <p>${s.p}</p>
      <p class="d1-under"><span>Why a real computer</span> ${s.why}</p>
      ${s.back ? `<p class="d1-back"><button type="button" data-to="${s.back[0]}">↩ ${S.scenes[s.back[0]].t}</button> comes back: ${s.back[1]}.</p>` : ''}
      <figure class="d1-inline">${s.sc()}</figure>
    </article>`;
  return `<div class="pg d1">
${hero(n)}
<section class="d1-intro" id="day">
  <p class="kicker">${S.kicker}</p>
  <h2>${S.title}</h2>
  <p>${S.intro}</p>
</section>
<section class="d1-story">
  <div class="d1-chapters">
${S.scenes.map(chapter).join('\n')}
  </div>
  <div class="d1-screen" aria-hidden="true">
    <p class="d1-clock"><b>${S.scenes[0].t}</b><span>${S.scenes[0].l}</span></p>
    <ol class="d1-ticks" style="grid-template-columns:repeat(${S.scenes.length},1fr)">${S.scenes.map((d, i) => `<li${i === 0 ? ' class="on"' : ''}></li>`).join('')}</ol>
    <div class="d1-frames">${S.scenes.map((s, i) => `<div class="d1-frame${i === 0 ? ' on' : ''}">${s.sc()}</div>`).join('')}</div>
  </div>
</section>
<section class="d1-close">
  <h2>${S.close[0]}</h2>
  <ul>${S.close[1].map((t) => `<li>${t}</li>`).join('')}</ul>
  <p>Alice asked for each of these in a sentence. Her agent did the work on a computer of its own, in her files and her mailbox, and left everything where she will find it next month.</p>
</section>
<p class="rq-line rq-stub" lang="fi"><b>Tynkä.</b> Sivun loppu (mitä Alicen ei tarvinnut miettiä, asennus, rajat) ei ole tämän kierroksen aihe; alla on vain paikka sille.</p>
<section class="d1-stub" id="install">
  <p class="kicker">Before Alice’s day</p>
  <h2>Her day started with one server and one link.</h2>
  <p>Someone at the studio administers a Linux server. They installed Open Habitat on it once, and connected nothing of Alice’s: she signed in and connected her own mail, calendar and files herself. Free and open source, an early pre-release.</p>
  <p class="cta"><a class="btn" href="${REPO}">Install on your server</a><a class="btn ghost" href="${REPO}">What it does not do</a></p>
</section>
<footer class="foot"><span class="brandword">${mark(18)} Open Habitat</span><span>Free and open source under the MIT License.</span><a href="${REPO}">GitHub</a><span class="quiet">This page sets no cookies and loads nothing from anywhere else.</span></footer>
</div>`;
}

function init(root, n) {
  const S = STORIES[n];
  const chs = [...root.querySelectorAll('.d1-ch')];
  const frames = [...root.querySelectorAll('.d1-frame')];
  const ticks = [...root.querySelectorAll('.d1-ticks li')];
  const clock = root.querySelector('.d1-clock');
  const box = root.querySelector('.d1-frames');
  let cur = -1;
  const show = (i) => {
    if (i === cur) return;
    cur = i;
    frames.forEach((f, j) => f.classList.toggle('on', j === i));
    ticks.forEach((t, j) => t.classList.toggle('on', j <= i));
    chs.forEach((c, j) => c.classList.toggle('on', j === i));
    clock.innerHTML = `<b>${S.scenes[i].t}</b><span>${S.scenes[i].l}</span>`;
  };
  show(0);
  // Each drawn screen is laid out at its natural size and scaled down to fit
  // the sticky frame, so a long scene is smaller, never cut.
  const fit = () => {
    if (!box.clientHeight) return;
    const pad = 20, aw = box.clientWidth - 2 * pad, ah = box.clientHeight - 2 * pad;
    frames.forEach((f) => {
      const sc = f.firstElementChild;
      const max = sc.classList.contains('phone') ? 360 : sc.classList.contains('split') ? 860 : 620;
      let w = Math.min(aw, max);
      sc.style.transform = 'none'; sc.style.width = `${w}px`;
      let s = Math.min(1, ah / sc.offsetHeight);
      if (s < 1 && !sc.classList.contains('phone')) { w = Math.min(max, aw / s); sc.style.width = `${w}px`; }
      s = Math.min(1, aw / w, ah / sc.offsetHeight);
      sc.style.transform = `scale(${s})`;
    });
  };
  fit();
  document.fonts.ready.then(fit);
  window.addEventListener('resize', fit);
  // The chapter that crosses the middle of the viewport owns the screen.
  const io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && show(+e.target.dataset.i)), { rootMargin: '-48% 0px -48% 0px' });
  chs.forEach((c) => io.observe(c));
  // "Comes back" jumps to the scene the thread started in.
  root.addEventListener('click', (e) => {
    const b = e.target.closest('.d1-back button');
    if (b) chs[+b.dataset.to].scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  });
  return () => { io.disconnect(); window.removeEventListener('resize', fit); };
}

// Each variant starts from the top, and wires its page once it is in the DOM
// (lib/picker.js sets innerHTML right after the render function returns).
let cleanup = null;
const variants = STORIES.map((_, n) => () => {
  if (cleanup) { cleanup(); cleanup = null; }
  window.scrollTo(0, 0);
  setTimeout(() => { const root = stage.firstElementChild; if (root) cleanup = init(root, n) || null; }, 0);
  return page(n);
});
