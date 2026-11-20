// Round 3 (a) of the landing page: what Alice's day contains. The top of the
// page is round 2's settled hero; below it, one imagined day per variant, each
// carried by one meeting or one customer. Every scene's screen is drawn with
// the prototype library's conversation language (lib/language.css: bubbles,
// tool rows, diffs) plus a few round-local pieces (mail draft, calendar,
// workers, view, phone), so it looks like the product and can later be
// captured from the synthetic lab. People, firms and addresses are invented
// (example.org). Connections shown are the ones the product has out of the
// box: Gmail, Google Calendar and Drive, Dropbox, the person's own files.
// Nothing leaves the agent's own files without Alice's go-ahead in the scene.
// build.mjs defines IMG and VARIANTS; lib/picker.js expects `stage` and `variants`.
const stage = document.getElementById('stage');

const REPO = 'https://github.com/Open-Habitat/open-habitat';
const RING = 'M9 -2v6a5 5 0 0 1-5 5h-8a5 5 0 0 1-5-5v-8a5 5 0 0 1 5-5h8a5 5 0 0 1 5 5z';
const mark = (px = 22, state = 'idle') => `<svg class="oh-mark" data-state="${state}" viewBox="-12 -12 24 24" width="${px}" height="${px}" aria-hidden="true"><path class="oh-ring" pathLength="100" d="${RING}"/><circle class="oh-dot" r="2.5"/></svg>`;
const heroImg = () => `<img class="hero-img" src="${IMG.hero.src}" width="${IMG.hero.w}" height="${IMG.hero.h}" alt="A conversation with an agent in Open Habitat on a desktop browser, with running and waiting conversations in the sidebar, and the same conversation on a phone">`;

// ---------- The hero: identical in every variant (round 2's, from round 1's "Kuva edellä") ----------
const hero = (i) => `<p class="rq-line" lang="fi"><b>${i + 1}/3 ${VARIANTS[i][0]}.</b> ${VARIANTS[i][1]} <span>1–3 tai ←/→ vaihtaa</span></p>
<header class="top"><a class="brandword" href="#">${mark(24)} Open Habitat</a><nav><a href="#day">A day</a><a href="#start">Get started</a><a href="${REPO}">GitHub</a></nav></header>
<section class="hero">
  <p class="eyebrow">Open source · on your own server · pre-release 0.1</p>
  <h1>Coding-grade AI agents <br>for your whole team.</h1>
  <p class="lede">No terminal required. Everyone gets a real agent with its own Linux account, in a browser tab. One person sets up one server; everyone else signs in and gets to work.</p>
  <p class="cta"><a class="btn" href="#start">Install on your server</a><a class="btn ghost" href="#day">See a day with it</a></p>
</section>
<figure class="hero-band">${heroImg()}</figure>`;

// ---------- The short stub below the day (the rest of the page is not this round's subject) ----------
const stub = () => `<section class="stub" id="start">
  <p class="kicker">Under Alice’s day</p>
  <h2>One server. A Linux account for each person, and an agent for each of them.</h2>
  <p>Alice’s agent works in her own account on her team’s server, with her files, her mail and her calendar, and keeps working when she closes the tab. Someone who looks after Linux sets the server up once; everyone else signs in from a browser.</p>
  <p class="cta"><a class="btn" href="${REPO}">Install on your server</a><a class="btn ghost" href="${REPO}#limits">What it does not do</a></p>
</section>
<footer class="pgfoot"><span class="brandword">${mark(18)} Open Habitat</span><span>Free and open source under the MIT License.</span><a href="${REPO}">GitHub</a><a href="${REPO}/releases">Releases</a><a href="${REPO}/discussions">Discussions</a><span class="quiet">This page sets no cookies and loads nothing from anywhere else. People, firms and addresses on it are invented.</span></footer>`;

// ---------- Screen pieces: the library's conversation language ----------
const SVG = (d, extra = '') => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"${extra}>${d}</svg>`;
const I = {
  check: SVG('<path d="m5 12 4.5 4.5L19 7"/>'),
  chev: SVG('<path d="m9 6 6 6-6 6"/>', ' class="chev"'),
  msg: SVG('<path d="M4 5h16v11H9l-5 4z"/>'),
  mic: SVG('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>'),
  clip: SVG('<path d="m20 11-8.5 8.5a5 5 0 0 1-7-7L13 4a3.5 3.5 0 0 1 5 5l-8.5 8.5a2 2 0 0 1-3-3L14 7"/>'),
  mail: SVG('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>'),
  cal: SVG('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>'),
  branch: SVG('<circle cx="6" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="9" r="2"/><path d="M6 7v10M18 11a6 6 0 0 1-6 6H8"/>'),
  worker: SVG('<rect x="4" y="4" width="16" height="16" rx="5"/><circle cx="12" cy="12" r="2" fill="currentColor" stroke="none"/>'),
  doc: SVG('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>'),
  file: SVG('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 14l3 3 3-3M12 10v7"/>'),
  moon: SVG('<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>'),
  send: SVG('<path d="M4 12 20 4l-6 16-3-7z"/>'),
  undo: SVG('<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>'),
};

const you = (text, meta = '') => `<article class="bubble user sc-you"><div class="bubble-head"><span class="who">You</span>${meta ? `<span class="meta sc-dict">${meta}</span>` : ''}</div><div class="prose"><p>${text}</p></div></article>`;
const youFile = (text, name, size) => `<article class="bubble user sc-you"><div class="bubble-head"><span class="who">You</span></div><div class="sc-chip">${I.clip}<span class="mono">${name}</span><span class="meta">${size}</span></div><div class="prose"><p>${text}</p></div></article>`;
const tool = (name, target, o = {}) => `<div class="sc-step"><span class="nd"></span><div class="tool"><div class="disc">${I.chev}<span class="names"><span class="name">${name}</span><span class="target">${target}</span></span>${o.stat ? `<span class="tstat">${o.stat}</span>` : ''}<span class="ok">${o.running ? '<span class="sc-run">running</span>' : `${I.check}done`}</span></div>${o.body ? `<div class="tool-body">${o.body}</div>` : ''}</div></div>`;
const think = (t) => `<div class="sc-step"><span class="nd th"></span><div class="think-row"><span class="lbl">Thinking</span><span class="prose"><strong>${t}</strong></span></div></div>`;
const sum = (t) => `<div class="sc-sum">${I.chev}<span>${t}</span></div>`;
const work = (s, ...steps) => `<div class="sc-work">${s ? sum(s) : ''}${steps.join('')}</div>`;
const interim = (html) => `<article class="bubble sc-interim"><div class="bubble-head"><span class="sc-lbl">${I.msg} Interim reply</span></div><div class="prose">${html}</div></article>`;
const reply = (html, time) => `<article class="bubble reply sc-reply"><div class="prose">${html}</div><div class="bar foot"><span class="ok">${I.check}Reply ready</span><time class="meta">${time}</time></div></article>`;
const out = (text) => `<pre>${text}</pre>`;
const diff = (lines) => `<pre class="diff">${lines.map(([s, t]) => `<span class="dl${s === '+' ? ' add' : s === '-' ? ' del' : ''}"><span class="sg">${s === ' ' ? '' : s === '-' ? '−' : s}</span>${t}</span>`).join('')}</pre>`;
const mail = ({ to, subj, body, attach, sent }) => `<div class="sc-card sc-mail"><div class="sc-card-h">${I.mail}<span>${sent ? 'Sent from your Gmail' : 'Draft in your Gmail'}</span><span class="sc-state${sent ? ' ok' : ''}">${sent || 'not sent'}</span></div><dl><dt>To</dt><dd>${to}</dd><dt>Subject</dt><dd>${subj}</dd></dl><div class="sc-mail-b">${body}</div>${attach ? `<div class="sc-chip">${I.clip}<span class="mono">${attach}</span></div>` : ''}</div>`;
const cal = (rows) => `<div class="sc-card sc-cal"><div class="sc-card-h">${I.cal}<span>Added to your calendar</span></div>${rows.map(([d, t]) => `<div class="sc-cal-r"><b>${d}</b><span>${t}</span></div>`).join('')}</div>`;
const offer = (name, meta) => `<div class="sc-card sc-offer">${I.file}<span class="mono">${name}</span><span class="meta">${meta}</span><span class="sc-dl">Download</span></div>`;
const away = (t) => `<div class="sc-away">${I.moon}<span>${t}</span></div>`;
const recap = (title, items) => `<article class="bubble sc-recap"><div class="bubble-head"><span class="sc-lbl">${I.msg} ${title}</span></div><div class="prose"><ul>${items.map((x) => `<li>${x}</li>`).join('')}</ul></div></article>`;
const workers = (rows) => `<div class="sc-workers"><div class="sc-wk-tabs"><span class="on">${I.branch} Workers <b>${rows.length}</b></span><span>Processes</span></div>${rows.map(([n, sub, t, st]) => `<div class="sc-wk${st === 'ended' ? ' ended' : ''}">${I.worker}<span class="sc-wk-n">${n}</span><span class="sc-wk-t">${t}</span><span class="sc-wk-s">${sub}</span></div>`).join('')}</div>`;
const table = (head, rows) => `<div class="md-table"><table><thead><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;

// The app window: the conversation scrolled to its latest turn; its top fades out.
const win = (title, inner, o = {}) => `<div class="sc-win${o.view ? ' has-view' : ''}"><div class="sc-bar"><span class="sc-title">${title}</span><span class="sc-path mono">~/studio</span></div><div class="sc-main"><div class="sc-body"><div class="sc-col">${inner}</div></div>${o.view ? `<aside class="sc-view"><div class="sc-view-h">${I.doc}<span class="mono">${o.view[0]}</span><span class="meta">view</span></div><div class="sc-view-b">${o.view[1]}</div></aside>` : ''}</div><div class="sc-compose"><span>Message the agent…</span>${I.mic}${I.send}</div></div>`;
const phone = (title, inner) => `<div class="sc-phone"><div class="sc-phone-in"><div class="sc-bar"><span class="sc-title">${title}</span></div><div class="sc-body"><div class="sc-col">${inner}</div></div><div class="sc-compose"><span>Message…</span>${I.mic}</div></div></div>`;

// ---------- The three days ----------
// Each story: intro, threads (things that come back, with a colour), scenes,
// and the closing line. A scene: time, short label, heading, what she asks in
// her own words, what the agent does, what comes back, how the point shows,
// thread tags ([key, 'first'|'back', note]) and its screen.
const STORIES = [
  // ===== 1 Palaverin kaari: one customer meeting carries the day =====
  {
    kicker: 'One meeting, one day',
    title: 'Alice’s Thursday is one customer meeting.',
    lede: 'Alice runs customer work at Example Studio, a sign and print studio of six people. At one o’clock she meets Northwind Bakery about new signs for its shops. Everything she does today is for that hour: before it, during it and after it.',
    threads: [['a', 'Tom’s question'], ['b', 'The faded sign'], ['c', '5 December']],
    scenes: [
      {
        time: '08:40', label: 'Getting ready',
        head: 'It reads last month’s notes, not its memory.',
        ask: 'I’m meeting Northwind at one. What do I need to know?',
        did: 'The agent opens the Northwind folder it has kept since the first call, with the notes from October and the pilot quote. Then it searches Alice’s mail and reads the meeting invitation.',
        back: 'A one-page brief, saved in the folder. Three shops are in the pilot. New since last time: Tom Berg from Northwind’s finance has joined the invitation, and in yesterday’s mail he asks what the signs would cost for all twelve shops.',
        why: 'Yesterday’s files, and her own mail and calendar as they are this morning.',
        tags: [['a', 'first', 'Tom asks about all twelve shops']],
        screen: () => win('Northwind meeting', you('I’m meeting Northwind at one. What do I need to know?')
          + work('1 thought · 4 tools · 22 s', think('Reading the Northwind folder first'),
            tool('read', 'customers/northwind/notes-2026-10-02.md'),
            tool('bash', 'gog gmail search "northwind newer_than:30d"'),
            tool('bash', 'gog calendar list --today'),
            tool('write', 'customers/northwind/brief-2026-11-20.md', { stat: 'new · 34 lines' }))
          + reply('<p><strong>Before one o’clock</strong></p><ul><li>Pilot: 3 shops, matte window panels, approved 2 Oct.</li><li><strong>New:</strong> Tom Berg (finance) has joined. His mail yesterday: <em>“What would all twelve shops cost?”</em></li><li>Still open from October: who owns the window frames.</li></ul><p>The brief is in <code>customers/northwind/</code>.</p>', '08:41')),
      },
      {
        time: '10:10', label: 'The slides',
        head: 'The numbers come from a program, not a guess.',
        ask: 'Make six slides from the spring deck. Answer Tom’s question with real numbers.',
        did: 'It takes the text out of the spring deck’s PDF, reads the studio’s price list with a short script and works out three shops and twelve, with the volume price. It builds the slides as one file and opens them beside the conversation.',
        back: 'Six slides on screen. Twelve shops come to €40,627 with the volume price, against €11,040 for the three in the pilot. The script stays in the folder, so anyone can check the sums.',
        why: 'A program run on a PDF and a spreadsheet, and the result a file she can open in the meeting.',
        tags: [['a', 'back', 'Tom’s twelve shops, answered on slide 5']],
        screen: () => win('Northwind meeting', you('Make six slides from the spring deck. Answer Tom’s question with real numbers.')
          + work('3 tools · 41 s',
            tool('bash', 'pdftotext deck-spring-2026.pdf -'),
            tool('bash', 'python3 tools/shop_cost.py price-list.xlsx --shops 3,12', { body: out('shops  list     volume   total\n    3  11,040   —        11,040\n   12  44,160   −8 %     40,627') }),
            tool('write', 'customers/northwind/slides.html', { stat: 'new · 6 slides' }))
          + reply('<p>Six slides, open beside this conversation. Slide 5 answers Tom: €40,627 for twelve shops.</p>', '10:13'),
        { view: ['slides.html', `<div class="sc-slide"><p class="sc-slide-k">Northwind Bakery · 5 / 6</p><h4>All twelve shops</h4><div class="sc-slide-n"><div><b>€11,040</b><span>pilot, 3 shops</span></div><div><b>€40,627</b><span>12 shops, volume price</span></div></div><p class="sc-slide-f">€3,386 per shop · matte window panels, counter sign, menu boards</p></div><div class="sc-thumbs">${[1, 2, 3, 4, 5, 6].map((n) => `<span${n === 5 ? ' class="on"' : ''}>${n}</span>`).join('')}</div>`] }),
      },
      {
        time: '13:25', label: 'In the meeting',
        head: 'A question asked under the table, answered from her own files.',
        ask: 'When did we put up the Harbour Street sign, and is it still under warranty?',
        did: 'Maria from Northwind mentions that the sign at their Harbour Street shop has faded. Alice dictates the question on her phone. The agent searches the studio’s invoices, takes the text out of the 2024 contract and finds the clause.',
        back: 'Forty seconds later: put up on 14 March 2024, invoice 2024-031. Clause 7 covers fading for three years, so the sign is covered until March 2027. Alice tells Maria the studio will fix it at no charge.',
        why: 'Old PDFs in her own files, read on the server while she has only her phone in a meeting.',
        tags: [['b', 'first', 'Maria mentions the faded sign']],
        phone: true,
        screen: () => phone('Northwind meeting', you('When did we put up the Harbour Street sign, and is it still under warranty?', `${I.mic} dictated`)
          + work('2 tools · 38 s',
            tool('bash', 'grep -ril "harbour" invoices/2024/'),
            tool('bash', 'pdftotext contracts/northwind-2024.pdf - | grep -A3 "^7\\."'))
          + reply('<p>Put up <strong>14 Mar 2024</strong> (invoice 2024-031). Clause 7: fading is covered for three years, <strong>until 14 Mar 2027</strong>. The repair is free.</p>', '13:26')),
      },
      {
        time: '14:20', label: 'Minutes',
        head: 'The recording becomes minutes, tasks and an updated customer card.',
        ask: 'Here’s the recording. Minutes for the folder, and what we promised them.',
        did: 'Alice drops the recording into the conversation. The agent runs the transcription script it wrote after the October meeting, writes minutes with who said what, adds the studio’s promises to the customer’s task list and updates the customer card.',
        back: 'Minutes, four tasks and the changed lines of the card: the next step is now a twelve-shop proposal by Friday, and Tom decides on 5 December. If a line is wrong, one sentence puts it back.',
        why: 'Files kept in step, last month’s tool used again, and every change visible and reversible.',
        tags: [['b', 'back', 'the repair becomes task 3'], ['c', 'first', 'Tom decides on 5 December']],
        screen: () => win('Northwind meeting', youFile('Here’s the recording. Minutes for the folder, and what we promised them.', 'meeting-2026-11-20.m4a', '48 min')
          + work('4 tools · 3 min',
            tool('bash', 'python3 tools/transcribe.py meeting-2026-11-20.m4a'),
            tool('write', 'customers/northwind/minutes-2026-11-20.md', { stat: 'new · 61 lines' }),
            tool('edit', 'customers/northwind/todo.md', { stat: '<span class="s-add">+4</span>' }),
            tool('edit', 'customers/northwind/card.md', { stat: '<span class="s-add">+2</span> <span class="s-del">−1</span>', body: diff([[' ', 'contact: Maria Lind, marketing'], ['-', 'next: send pilot quote (3 shops)'], ['+', 'next: proposal for 12 shops by Fri 21 Nov'], ['+', 'decides: Tom Berg, finance, on 5 Dec']]) }))
          + reply('<p>Minutes saved. Four tasks for us; task 3 is the free repair at Harbour Street. Tom decides on <strong>5 December</strong>.</p>', '14:24')),
      },
      {
        time: '15:30', label: 'Follow-up',
        head: 'The proposal and the mail are ready. Nothing leaves until she says so.',
        ask: 'Write the proposal and a follow-up to Maria and Tom.',
        did: 'From the minutes and the morning’s numbers it writes a three-page proposal, renders it to PDF in the studio’s template and puts a draft in Alice’s Gmail with the PDF attached. Then it waits for her.',
        back: 'Twelve shops at €40,627, and the Harbour Street repair under warranty, at no charge. Alice reads the draft and says “Send it, and remind me on the 4th.” The mail goes from her own address, and the day before Tom’s decision is in her calendar.',
        why: 'Her own mail and calendar, used as her, and only on her go-ahead.',
        tags: [['a', 'back', 'the price for twelve shops'], ['b', 'back', 'the free repair'], ['c', 'back', 'a reminder on 4 December']],
        screen: () => win('Northwind meeting', work('2 tools · 52 s',
            tool('bash', 'python3 tools/proposal_pdf.py customers/northwind/proposal.md'))
          + mail({ to: 'maria.lind@example.org, tom.berg@example.org', subj: 'Signs for all twelve shops', body: '<p>Thank you both for today. Attached is our proposal for all twelve shops, €40,627 with the volume price. The Harbour Street sign is under warranty, so we will fix it at no charge…</p>', attach: 'proposal-northwind-12-shops.pdf' })
          + you('Send it, and remind me on the 4th.')
          + work('2 tools · 4 s', tool('bash', 'gog gmail send --draft r-7731 && gog calendar create "Northwind: Tom decides tomorrow" --date 2026-12-04'))
          + cal([['Thu 4 Dec · 09:00', 'Northwind: Tom decides tomorrow']])
          + reply('<p>Sent at 15:42 from your address.</p>', '15:42')),
      },
    ],
    after: 'Next week, when Tom answers, the agent opens this folder again. It does not need to remember Thursday: Thursday is written down.',
  },

  // ===== 2 Reklamaatio: one unhappy customer carries the day =====
  {
    kicker: 'One unhappy customer, one day',
    title: 'Alice’s Tuesday starts with a complaint.',
    lede: 'At 8:12 Priya Shah of Fernhill Garden Centre writes that the 2,000 spring catalogues Example Studio printed have the wrong colours, and she needs them for Saturday’s opening. Alice spends the day putting it right, and the agent makes sure it cannot quietly happen again.',
    threads: [['a', 'Saturday'], ['b', 'The export preset'], ['c', 'Two other jobs']],
    scenes: [
      {
        time: '08:20', label: 'Open a case',
        head: 'The case is a folder with the original mail in it, not a chat.',
        ask: 'Priya at Fernhill is upset about the catalogues. Open a case and pull everything together.',
        did: 'The agent finds the whole thread in Alice’s Gmail and saves each message as it was, with Priya’s photos. From Drive it takes the order confirmation, the proof Priya approved and the file that went to the printer, and writes a timeline.',
        back: 'One case folder and a timeline: ordered 28 October, proof approved 3 November, printed on the 12th, delivered on the 18th, complaint this morning. The opening is on Saturday, so good copies must reach Priya by Friday.',
        why: 'Her own mail and Drive, kept as original files in one folder that will still be there next month.',
        tags: [['a', 'first', 'good copies needed by Friday']],
        screen: () => win('Fernhill catalogues', you('Priya at Fernhill is upset about the catalogues. Open a case and pull everything together.')
          + work('4 tools · 31 s',
            tool('bash', 'gog gmail search "fernhill catalogue" --export cases/fernhill/mail/', { stat: '6 messages' }),
            tool('bash', 'gog drive download "Jobs/2026-11/Fernhill" --out cases/fernhill/files/', { stat: '3 files' }),
            tool('read', 'cases/fernhill/files/order-confirmation.pdf'),
            tool('write', 'cases/fernhill/timeline.md', { stat: 'new · 22 lines' }))
          + reply(`<p><strong>Fernhill, spring catalogue</strong></p>${table(['Date', 'What happened'], [['28 Oct', 'Order, 2,000 copies'], ['3 Nov', 'Priya approves the proof'], ['12 Nov', 'Printed at Coastline Print'], ['18 Nov', 'Delivered'], ['Today', 'Complaint with 4 photos']])}<p>Opening on Saturday: good copies are needed <strong>by Friday</strong>.</p>`, '08:21')),
      },
      {
        time: '09:50', label: 'What went wrong',
        head: 'It measures the colour in two PDFs instead of guessing.',
        ask: 'Did we print what she approved?',
        did: 'It takes the images out of the approved proof and out of the file that went to the printer, and compares their colours page by page with a short script.',
        back: 'Pages 1–3 match. Pages 4–9 do not: the greens shift towards brown, because the print file was exported with the newspaper preset instead of the coated-paper one. Priya’s proof was right. The mistake is the studio’s.',
        why: 'A program run on two print files. A chat window cannot even open a 140 MB PDF, let alone measure it.',
        tags: [['b', 'first', 'the wrong export preset']],
        screen: () => win('Fernhill catalogues', you('Did we print what she approved?')
          + work('1 thought · 2 tools · 1 min', think('Comparing colour, not just text'),
            tool('write', 'cases/fernhill/compare_colour.py', { stat: 'new · 44 lines' }),
            tool('bash', 'python3 compare_colour.py proof-approved.pdf print-file.pdf', { body: out('page  colour diff  exported with\n1–3   1.2          coated paper\n4–9   13.8         newspaper      ✗\n10–12 1.4          coated paper') }))
          + reply('<p>No. Pages 4–9 were exported with the <strong>newspaper preset</strong>, so the greens went brown. The proof Priya approved is correct: this one is ours.</p>', '09:52')),
      },
      {
        time: '11:10', label: 'A checker',
        head: 'No program checked this, so it wrote one. It is still there tomorrow.',
        ask: 'Has that preset got into any other job this month?',
        did: 'Nothing at the studio checks which preset a print file was exported with, so the agent writes a short checker, saves it in the studio’s tools folder and runs it on all 31 print files in this month’s Drive folder.',
        back: 'Two more files carry the newspaper preset: menus for Kite Café and a poster for Birchwood School. Neither has gone to the printer yet.',
        why: 'A small tool written for the job, kept as a file and ready to run again.',
        tags: [['b', 'back', 'a checker for exactly this'], ['c', 'first', 'two more jobs at risk']],
        screen: () => win('Fernhill catalogues', you('Has that preset got into any other job this month?')
          + work('3 tools · 1 min',
            tool('write', 'tools/check_print_preset.py', { stat: 'new · 38 lines' }),
            tool('bash', 'rclone copy gdrive:Jobs/2026-11 jobs/2026-11/', { stat: '31 files' }),
            tool('bash', 'python3 tools/check_print_preset.py jobs/2026-11/', { body: out('31 print files checked\n✗ kite-cafe-menus.pdf       newspaper\n✗ birchwood-poster.pdf      newspaper\n✓ 29 files                 coated or uncoated') }))
          + reply('<p>Two more: <strong>Kite Café menus</strong> and the <strong>Birchwood School poster</strong>. Neither has been printed. The checker is in <code>tools/</code> for next time.</p>', '11:12')),
      },
      {
        time: '13:30', label: 'The reply',
        head: 'The reply is drafted in her mailbox, and she has the last word.',
        ask: 'Draft the reply to Priya. It was our fault. Reprint, and tell her when.',
        did: 'From the timeline and the colour check it drafts a short apology: the studio’s mistake, a reprint at Coastline Print on Thursday, delivery by Friday noon and 15 % off the order. Alice changes two things.',
        back: '“We’ll drive them over ourselves, and make it 20 %.” The agent changes those two lines and shows them. Alice sends the mail, and a delivery on Friday at 11:00, the day before the opening, goes into her calendar.',
        why: 'Her Gmail and calendar, used as her: the draft changed only where she asked, and sent only when she said so.',
        tags: [['a', 'back', 'delivery on Friday at 11:00']],
        screen: () => win('Fernhill catalogues', you('We’ll drive them over ourselves, and make it 20 %. Then send it, and put the delivery in my calendar.')
          + work('3 tools · 9 s',
            tool('edit', 'cases/fernhill/reply-1.md', { stat: '<span class="s-add">+2</span> <span class="s-del">−2</span>', body: diff([['-', 'Coastline will deliver them by Friday noon,'], ['+', 'we will drive them over ourselves on Friday by 11:00,'], ['-', 'with 15 % off the order.'], ['+', 'with 20 % off the order.']]) }))
          + mail({ to: 'priya.shah@example.org', subj: 'Your spring catalogues', sent: 'sent 13:41', body: '<p>Dear Priya, you are right, and the mistake is ours: pages 4–9 went to the printer with the wrong colour setting. We are reprinting all 2,000 on Thursday and will drive them over ourselves on Friday by 11:00, with 20 % off the order…</p>' })
          + cal([['Fri 21 Nov · 11:00', 'Fernhill: deliver 2,000 catalogues']])),
      },
      {
        time: '16:20', label: 'After she leaves',
        head: 'She closes the tab. The work carries on.',
        ask: 'Ben has put the new catalogue file in Drive. Check it with your tool, and if it passes, send Coastline the link. I’m off.',
        did: 'Alice closes her laptop. The agent runs the morning’s checker on the new file and on the two other jobs, and because Alice said so, mails the printer the link to the catalogue.',
        back: 'Waiting for her in the morning: the catalogue passed and went to Coastline at 16:41. Kite Café and Birchwood still carry the old preset, so there is a draft to Ben naming both. The case timeline has a new line.',
        why: 'Work that went on after the tab closed, with a tool written that same morning.',
        tags: [['b', 'back', 'the checker passes the reprint'], ['c', 'back', 'a draft to Ben about both']],
        screen: () => win('Fernhill catalogues', you('Ben has put the new catalogue file in Drive. Check it with your tool, and if it passes, send Coastline the link. I’m off.')
          + away('You closed the tab at 16:24. The agent kept working.')
          + work('4 tools · 17 min',
            tool('bash', 'python3 tools/check_print_preset.py jobs/2026-11/fernhill-v2.pdf', { body: out('✓ fernhill-v2.pdf   coated paper, all 12 pages') }),
            tool('bash', 'gog gmail send --to orders@coastline.example.org --subject "Fernhill reprint"'),
            tool('bash', 'gog gmail draft --to ben@example.org --subject "Two files with the newspaper preset"'),
            tool('edit', 'cases/fernhill/timeline.md', { stat: '<span class="s-add">+1</span>' }))
          + recap('While you were away', ['Catalogue v2 <strong>passed</strong> and went to Coastline at 16:41, as you asked.', 'Kite Café and Birchwood still use the newspaper preset: a draft to Ben is waiting for you.', 'Timeline: “20 Nov, reprint sent to printer.”'])),
      },
    ],
    after: 'On Friday at 11:00 the catalogues arrive. The checker stays in the tools folder: the next time a job goes to the printer, it is one sentence away.',
  },

  // ===== 3 Tarjouspyyntö: one call for tender carries the day =====
  {
    kicker: 'One call for tender, one day',
    title: 'Alice’s Monday is one big bid.',
    lede: 'The town of Easthaven wants new signs for fourteen public buildings over four years, the largest job Example Studio has ever bid for. The call for tender came on Friday as 23 attachments. Alice has today to decide whether to bid, and to get the work moving.',
    threads: [['a', '25 November'], ['b', 'Who pays the permits'], ['c', 'Three references']],
    scenes: [
      {
        time: '08:50', label: 'Read it all',
        head: 'Twenty-three files, read by programs, with the page for every claim.',
        ask: 'The Easthaven tender is in my mail. Read all of it and tell me whether we should bid.',
        did: 'The agent saves the 23 attachments into a tender folder, takes the text out of every PDF, reads the spreadsheets with a script and writes a one-page summary that names the file and page behind each point.',
        back: 'Fourteen buildings, four years, around €180,000. Bids by 4 December at noon, but questions to the town only until 25 November, five days from now. The town wants three references from public buildings in the last five years. The advice: bid, and ask first.',
        why: 'A folder of PDFs and spreadsheets opened by programs on the server, far more than a chat window takes.',
        tags: [['a', 'first', 'questions only until 25 November'], ['c', 'first', 'three references needed']],
        screen: () => win('Easthaven tender', you('The Easthaven tender is in my mail. Read all of it and tell me whether we should bid.')
          + work('4 tools · 2 min',
            tool('bash', 'gog gmail attachments "Easthaven" --out tenders/easthaven/', { stat: '23 files' }),
            tool('bash', 'for f in tenders/easthaven/*.pdf; do pdftotext -layout "$f"; done', { stat: '19 PDFs' }),
            tool('bash', 'python3 tools/xlsx_dump.py tenders/easthaven/*.xlsx', { stat: '4 sheets' }),
            tool('write', 'tenders/easthaven/summary.md', { stat: 'new · 48 lines' }))
          + reply('<ul><li>14 buildings, 4 years, about <strong>€180,000</strong> <span class="sc-src">call.pdf p. 2</span></li><li>Bids by <strong>4 Dec, 12:00</strong>; questions only until <strong>25 Nov</strong> <span class="sc-src">instructions.pdf p. 5</span></li><li>Three references, public buildings, last 5 years <span class="sc-src">p. 7</span></li></ul><p>My advice: bid, and send questions this week.</p>', '08:53')),
      },
      {
        time: '10:05', label: 'What doesn’t add up',
        head: 'It reads across all the files at once and finds where they disagree.',
        ask: 'Anything that doesn’t add up? What should we ask them?',
        did: 'It searches the extracted text for every passage on installation, permits, warranty and deadlines, and puts what the documents say side by side.',
        back: 'The price sheet says the town pays for building permits (row 14); the draft contract says the supplier does (section 9.3). Six possible questions. It advises against two: the town publishes every answer to all bidders, and those two would show rivals how Example Studio plans the job.',
        why: 'All the documents searched at once, with the source of each finding.',
        tags: [['b', 'first', 'price sheet and contract disagree']],
        screen: () => win('Easthaven tender', you('Anything that doesn’t add up? What should we ask them?')
          + work('2 tools · 48 s',
            tool('bash', 'grep -n -i "permit" tenders/easthaven/*.txt', { body: out('price-sheet.txt:14   Building permits ......... by the buyer\ncontract.txt:212     9.3 The supplier obtains and pays for\ncontract.txt:213         all permits required for installation') }),
            tool('write', 'tenders/easthaven/questions.md', { stat: 'new · 6 questions' }))
          + reply(`<p><strong>Price sheet and contract disagree on permits.</strong> Row 14 says the town pays; section 9.3 says we do.</p>${table(['', 'Question', 'Advice'], [['1', 'Who pays building permits?', 'Ask'], ['2', 'Is night installation allowed?', 'Ask'], ['3', 'Can we propose another material?', 'Skip: tells rivals']])}<p>Six in <code>questions.md</code>, four worth asking.</p>`, '10:06')),
      },
      {
        time: '11:30', label: 'References',
        head: 'A hundred and forty-six old projects, split between four workers.',
        ask: 'We need three references. Go through our old projects and find the best.',
        did: 'The studio’s project archive in Dropbox has 146 folders from the last five years. The agent splits them by year between four workers. Each reads the final reports, photos and invoices in its share and scores how closely the job matches what the town asks for.',
        back: 'Fourteen minutes later, a shortlist of five. The Northvale library (2024) fits best, then a hospital wing and a school campus. Each comes with the customer contact and the photos to attach.',
        why: 'A hundred folders worked through in parallel, each worker on its own copy, while Alice did something else.',
        tags: [['c', 'back', 'five candidates, Northvale first']],
        screen: () => win('Easthaven tender', you('We need three references. Go through our old projects and find the best.')
          + interim('<p>146 project folders in Dropbox. I’ll split them by year between four workers, each scoring its share against page 7 of the call.</p>')
          + workers([['refs-2021-22', 'ended · 41 folders · Pi', '11 min', 'ended'], ['refs-2023', 'ended · 37 folders · Pi', '12 min', 'ended'], ['refs-2024', 'ended · 38 folders · Pi', '14 min', 'ended'], ['refs-2025', 'ended · 30 folders · Pi', '9 min', 'ended']])
          + reply(`${table(['', 'Project', 'Fit'], [['1', 'Northvale library, 2024', '9 / 10'], ['2', 'Riverside hospital wing, 2023', '8 / 10'], ['3', 'Oakfield school campus, 2025', '8 / 10']])}<p>Two more in <code>references.md</code>, with contacts and photos.</p>`, '11:45')),
      },
      {
        time: '14:00', label: 'Sam’s comments',
        head: 'Seventeen comments in a Word file, and not one goes missing.',
        ask: 'Sam left comments on our answer document. Work through them.',
        did: 'Sam, the studio’s installer, has commented on the draft answer in Word. The agent opens the document with a script, goes through the comments one by one, makes the changes he asked for as tracked changes and keeps a log of what happened to each.',
        back: 'Fourteen comments applied as tracked changes, three left for Alice to decide. Sam wants the Northvale library as reference 1, which matches the shortlist. His note on permits waits for the town’s answer.',
        why: 'A program working inside a Word file, with a record of every change that can be checked and undone.',
        tags: [['c', 'back', 'Sam picks Northvale too'], ['b', 'back', 'Sam’s permit note waits']],
        screen: () => win('Easthaven tender', you('Sam left comments on our answer document. Work through them.')
          + work('3 tools · 2 min',
            tool('bash', 'python3 tools/docx_comments.py answer-draft.docx --list', { stat: '17 comments' }),
            tool('bash', 'python3 tools/docx_comments.py answer-draft.docx --apply plan.md --tracked'),
            tool('write', 'tenders/easthaven/comments-log.md', { stat: 'new · 17 rows' }))
          + reply(`${table(['#', 'Sam said', 'Done'], [['2', 'Northvale as reference 1', 'Applied'], ['5', 'Installation takes 3 weeks, not 2', 'Applied'], ['9', 'Who pays the permits?', 'Waits for the town'], ['12', 'Drop the night-work option?', 'Your call']])}<p>14 applied as tracked changes, 3 for you. Every comment is in <code>comments-log.md</code>.</p>`, '14:03')),
      },
      {
        time: '15:10', label: 'Questions out',
        head: 'The questions go to the town from her mail, when she says so.',
        ask: 'Send the four questions to the town.',
        did: 'It writes the four questions in the form the call asks for, with the permit contradiction as question 1, and leaves the mail in Alice’s drafts for the town’s procurement office. She reads it and says go.',
        back: 'The questions leave five days before the deadline. In her calendar now: the town’s answers due 1 December, and the bid due 4 December at noon.',
        why: 'Her own mail and calendar; nothing went to the town until she said so.',
        tags: [['a', 'back', 'sent five days early'], ['b', 'back', 'question 1']],
        screen: () => win('Easthaven tender', mail({ to: 'procurement@easthaven.example.org', subj: 'Questions, wayfinding signage, ref. 2026-114', body: '<p>1. The price sheet (row 14) says the buyer pays building permits; the draft contract (9.3) says the supplier does. Which applies?<br>2. Is installation outside opening hours allowed?<br>3. …</p>' })
          + you('Go.')
          + work('3 tools · 6 s',
            tool('bash', 'gog gmail send --draft r-4417'),
            tool('bash', 'gog calendar create "Easthaven answers due" --date 2026-12-01'),
            tool('bash', 'gog calendar create "Easthaven bid due 12:00" --date 2026-12-04'))
          + cal([['Mon 1 Dec', 'Easthaven: answers to questions due'], ['Thu 4 Dec · 12:00', 'Easthaven: bid due']])
          + reply('<p>Sent at 15:14, five days before the deadline.</p>', '15:14')),
      },
      {
        time: '16:40', label: 'After she leaves',
        head: 'She goes home. The price sheet fills in, and every change is listed.',
        ask: 'Fill in the town’s price sheet from our price list while I’m out. Show me tomorrow what you changed.',
        did: 'Alice closes the tab. The agent fills the town’s spreadsheet row by row from the studio’s price list, leaves row 14 open until the town answers about permits, and saves the sheet with a list of every cell it filled.',
        back: 'On Tuesday morning: 212 rows filled, one left open, a total of €176,400, and the list of changes to go through. Any cell can be put back as it was.',
        why: 'Work that went on after the tab closed, and a record of what changed that can be undone.',
        tags: [['b', 'back', 'row 14 waits for the answer']],
        screen: () => win('Easthaven tender', you('Fill in the town’s price sheet from our price list while I’m out. Show me tomorrow what you changed.')
          + away('You closed the tab at 16:43. The agent kept working.')
          + work('3 tools · 26 min',
            tool('write', 'tools/fill_price_sheet.py', { stat: 'new · 72 lines' }),
            tool('bash', 'python3 tools/fill_price_sheet.py price-sheet.xlsx price-list.xlsx', { body: out('212 rows filled · 1 left open (row 14)\ntotal €176,400 · changes in price-sheet-changes.md') }),
            tool('edit', 'tenders/easthaven/price-sheet.xlsx', { stat: '212 cells' }))
          + recap('While you were away', ['Price sheet filled: <strong>212 rows</strong>, total <strong>€176,400</strong>.', 'Row 14 (permits) left open until the town answers.', 'Every filled cell is listed in <code>price-sheet-changes.md</code>; say which to put back.'])),
      },
    ],
    after: 'By Tuesday the tender folder holds the summary, the questions, the references, Sam’s comments and a filled price sheet. The bid is still Alice’s to finish, and none of it depends on what the agent remembers.',
  },
];

// ---------- One day, rendered ----------
const tagChip = ([k, kind, note], story) => {
  const label = story.threads.find(([key]) => key === k)[1];
  return `<li class="tg t-${k}"><span class="tg-dot" aria-hidden="true"></span><b>${label}</b><span>${kind === 'first' ? 'appears' : 'comes back'}: ${note}</span></li>`;
};

function day(i) {
  const s = STORIES[i];
  const chapter = (c, j) => `<article class="ch" data-i="${j}" data-threads="${[...new Set(c.tags.map(([k]) => k))].join(' ')}">
      <p class="ch-time"><span>${c.time}</span>${c.label}</p>
      <h3>${c.head}</h3>
      <blockquote class="ch-ask"><span>Alice asks</span>“${c.ask}”</blockquote>
      <p>${c.did}</p>
      <p class="ch-back"><span>What comes back</span>${c.back}</p>
      <p class="ch-why">${mark(16)}<span><b>Why a real computer:</b> ${c.why}</span></p>
      <ul class="tgs">${c.tags.map((t) => tagChip(t, s)).join('')}</ul>
      <div class="ch-inline" aria-hidden="true">${c.screen()}</div>
    </article>`;
  return `<div class="pg day s${i + 1}">
${hero(i)}
<section class="intro" id="day">
  <p class="kicker">${s.kicker}</p>
  <h2>${s.title}</h2>
  <p>${s.lede}</p>
  <div class="follow"><span>Things that come back later in the day:</span>${s.threads.map(([k, l]) => `<button type="button" class="fl t-${k}" data-k="${k}" aria-pressed="false"><span class="tg-dot" aria-hidden="true"></span>${l}</button>`).join('')}</div>
</section>
<section class="story">
  <div class="chapters">
${s.scenes.map(chapter).join('\n')}
    <p class="after">${s.after}</p>
  </div>
  <div class="screen" aria-hidden="true">
    <p class="clock"><b>${s.scenes[0].time}</b><span>${s.scenes[0].label}</span></p>
    <ol class="ticks" style="--n:${s.scenes.length}">${s.scenes.map((_, j) => `<li${j === 0 ? ' class="on"' : ''}></li>`).join('')}</ol>
    <div class="frames">${s.scenes.map((c, j) => `<div class="frame${j === 0 ? ' on' : ''}${c.phone ? ' is-phone' : ''}">${c.screen()}</div>`).join('')}</div>
  </div>
</section>
${stub()}
</div>`;
}

function initDay(root, i) {
  const s = STORIES[i];
  const chs = [...root.querySelectorAll('.ch')];
  const frames = [...root.querySelectorAll('.frame')];
  const ticks = [...root.querySelectorAll('.ticks li')];
  const clock = root.querySelector('.clock');
  let cur = -1;
  const show = (j) => {
    if (j === cur) return;
    cur = j;
    frames.forEach((f, k) => f.classList.toggle('on', k === j));
    ticks.forEach((t, k) => t.classList.toggle('on', k <= j));
    chs.forEach((c, k) => c.classList.toggle('on', k === j));
    clock.innerHTML = `<b>${s.scenes[j].time}</b><span>${s.scenes[j].label}</span>`;
  };
  show(0);
  // The last chapter whose top has passed the middle of the viewport owns the
  // screen; above the first chapter it is the first, so scrolling back up to
  // the intro never leaves a later scene on the screen.
  let raf = 0;
  const onScroll = () => { if (raf) return; raf = requestAnimationFrame(() => {
    raf = 0;
    const mid = innerHeight / 2;
    let j = 0;
    chs.forEach((c, k) => { if (c.getBoundingClientRect().top <= mid) j = k; });
    show(j);
  }); };
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll);
  onScroll();
  // Following a thread marks the scenes where it appears and comes back.
  const story = root.querySelector('.story');
  const btns = [...root.querySelectorAll('.fl')];
  btns.forEach((b) => b.addEventListener('click', () => {
    const on = b.getAttribute('aria-pressed') !== 'true';
    btns.forEach((x) => x.setAttribute('aria-pressed', String(x === b && on)));
    if (on) story.dataset.follow = b.dataset.k; else delete story.dataset.follow;
    chs.forEach((c) => c.classList.toggle('lit', on && c.dataset.threads.split(' ').includes(b.dataset.k)));
  }));
  return () => { removeEventListener('scroll', onScroll); removeEventListener('resize', onScroll); cancelAnimationFrame(raf); };
}

// Each variant starts from the top, and wires its page once it is in the DOM
// (lib/picker.js sets innerHTML right after the render function returns).
let cleanup = null;
const variants = [0, 1, 2].map((i) => () => {
  if (cleanup) { cleanup(); cleanup = null; }
  window.scrollTo(0, 0);
  setTimeout(() => { const root = stage.firstElementChild; if (root) cleanup = initDay(root, i) || null; }, 0);
  return day(i);
});
