// Round 2 of the landing page: the hero is settled ("Kuva edellä", round 1),
// and the three variants answer what the page does after the hero image.
// Every claim comes from the root README or docs/operations.md. People and
// places are the screenshots' synthetic lab: Example Studio and Alice, whose
// first day each variant tells in its own way. No other product is named.
// build.mjs defines IMG and VARIANTS; lib/picker.js expects `stage` and `variants`.
const stage = document.getElementById('stage');

const REPO = 'https://github.com/Open-Habitat/open-habitat';
const GUIDE = 'https://raw.githubusercontent.com/Open-Habitat/open-habitat/main/docs/operations.md';
const RING = 'M9 -2v6a5 5 0 0 1-5 5h-8a5 5 0 0 1-5-5v-8a5 5 0 0 1 5-5h8a5 5 0 0 1 5 5z';
const mark = (px = 22, state = 'idle') => `<svg class="oh-mark" data-state="${state}" viewBox="-12 -12 24 24" width="${px}" height="${px}" aria-hidden="true"><path class="oh-ring" pathLength="100" d="${RING}"/><circle class="oh-dot" r="2.5"/></svg>`;

const ALT = {
  hero: 'A conversation with an agent in Open Habitat on a desktop browser, with running and waiting conversations in the sidebar, and the same conversation on a phone',
  'agent-at-work': 'An agent running commands and editing files in a conversation, with its progress shown step by step',
  'first-use': 'Getting started in the browser: sign in, choose repositories, connect an AI account',
  'your-turn': 'The sidebar with conversations under Your turn and Running',
  steer: 'A steering message and a queued follow-up above the message field while the agent works',
  workers: 'A main agent with three workers, each showing its own Git branch and state',
  connections: 'Data connections in settings, with a mail and calendar account connected',
  view: 'An HTML report the agent made, open in a panel beside the conversation',
  'build-on-top': 'An agent building and starting a small internal service on the server',
  people: 'One server with a separate home for each of three people',
  'ai-account': 'Connecting an AI account in the browser with a sign-in link and a code',
  'terminal-editor': 'The VS Code editor and the browser terminal side by side',
};
const pic = (name, cls = 'shot') => { const i = IMG[name]; return `<img class="${cls}" src="${i.src}" width="${i.w}" height="${i.h}" alt="${ALT[name]}">`; };

const BRING = [
  'a server: Ubuntu 24.04 LTS, amd64 or arm64;',
  'a DNS name and a TLS certificate for it;',
  'a GitHub OAuth app, because people sign in with GitHub;',
  'for each person an AI subscription or key of their own, or one key for the server.',
];
const LIMITS = [
  ['One server, one agent.', 'Ubuntu 24.04 only, and browser conversations drive Pi. Other agents run in the terminal.'],
  ['An agent acts as its owner.', 'Linux accounts separate people from each other. They do not sandbox an agent from the person it works for: it has that person’s files and credentials.'],
  ['Root is root.', 'Whoever administers the server can read every home on it, as on any Linux machine.'],
  ['An administrator is needed.', 'Your team needs one person who administers a Linux server. This is a server installation, not a one-line script.'],
];
const PRERELEASE = 'Open Habitat is an early pre-release, the 0.1 line, published as <code>v0.1.N</code> pre-releases on GitHub Releases. It runs on real multi-person servers, but formats and interfaces still change between releases. Install a named release, and read its release notes before you upgrade.';
const CMDS = `./bin/open-habitat host check --site /etc/open-habitat/site.json
./bin/open-habitat host plan  --site /etc/open-habitat/site.json --json
./bin/open-habitat host apply --site /etc/open-habitat/site.json --dry-run --json`;
const ASK = `Install Open Habitat on my server. Here is the guide: ${GUIDE}`;
const byHand = `<details class="byhand"><summary>Or install it by hand</summary><p>Download a release, check it against the SHA-256 digests GitHub states, write one site file that says who may sign in and who administers, then check, plan and apply:</p><pre>${CMDS}</pre><p>The guide has every step, including first-time preparation, the storage choice you cannot change later, upgrades and recovery.</p></details>`;
const limitsList = (cls) => `<dl class="${cls}">${LIMITS.map(([b, t]) => `<div><dt>${b}</dt><dd>${t}</dd></div>`).join('')}</dl>`;
const footer = () => `<footer class="foot"><span class="brandword">${mark(18)} Open Habitat</span><span>Free and open source under the MIT License.</span><a href="${REPO}">GitHub</a><a href="${REPO}/releases">Releases</a><a href="${REPO}/discussions">Discussions</a><span class="quiet">This page sets no cookies and loads nothing from anywhere else.</span></footer>`;
const copyBtn = (text) => `<button type="button" class="copy" data-copy="${text.replace(/"/g, '&quot;')}">Copy</button>`;

// ---------- The hero: identical in every variant (round 1's "Kuva edellä") ----------
// The image sits on a full-width band in the capture's own background colour,
// so no canvas edge shows; build.mjs centres the capture in its canvas, and the
// image is centred in the band, so the composition's middle is the headline's.
const hero = (i) => `<p class="rq-line" lang="fi"><b>${i + 1}/3 ${VARIANTS[i][0]}.</b> ${VARIANTS[i][1]} <span>1–3 tai ←/→ vaihtaa</span></p>
<header class="top"><a class="brandword" href="#">${mark(24)} Open Habitat</a><nav><a href="#day">First day</a><a href="#install">Install</a><a href="#limits">Limits</a><a href="${REPO}">GitHub</a></nav></header>
<section class="hero">
  <p class="eyebrow">Open source · on your own server · pre-release 0.1</p>
  <h1>Coding-grade AI agents <br>for your whole team.</h1>
  <p class="lede">No terminal required. Everyone gets a real agent with its own Linux account, in a browser tab. One person sets up one server; everyone else signs in and gets to work.</p>
  <p class="cta"><a class="btn" href="#install">Install on your server</a><a class="btn ghost" href="#day">See it work</a></p>
</section>
<figure class="hero-band">${pic('hero', 'hero-img')}</figure>`;

// ---------- Alice's day, shared by all three variants ----------
// [time, short label, heading, text, picture, what happens underneath]
const DAY = [
  ['08:58', 'Signs in', 'A link from the person who runs the server.', 'Alice runs the shop at Example Studio. She has never opened a terminal. She opens the address, signs in with GitHub and ticks the studio repositories she wants to work in. Nothing to install, on her laptop or anywhere else.', 'first-use', 'The first time she signs in, once the administrator has approved her, the server makes her a Linux account of her own.'],
  ['09:03', 'Her own AI', 'She connects her own AI subscription.', 'She copies a code, confirms it on her AI service’s own page and comes back. Each person brings their own subscription or API key, or the server provides one key for everyone.', 'ai-account', 'She signs in on the AI service’s own page. No password is typed into Open Habitat.'],
  ['09:10', 'First request', '“Make a short report of October sales, with a chart.”', 'Her agent reads the three shop files in the data folder, writes a short Python script and runs it. She can follow every step, or not look at all.', 'agent-at-work', 'The agent works in her Linux account on the server, with a shell, files, Git and the command line. It acts as Alice, with her files.'],
  ['09:14', 'The result', 'The report opens beside the conversation.', 'Agents hand back reports, charts and small web pages as views she opens next to the conversation, and files she downloads with one click.', 'view', 'The report is an ordinary file in her home directory on the server.'],
  ['10:20', 'Steers', 'Halfway through, she changes her mind.', 'She does not wait for the agent to finish. She adds an instruction in the middle of the work and queues the next request behind it. She could also answer its question or stop it.', 'steer', 'The agent takes the instruction at its next step; the queued message waits its turn.'],
  ['11:30', 'A bigger job', '“Check the staff handbook against the new policy. Split it up.”', 'Her agent splits the work between three workers and brings their results back. She follows each worker from the same sidebar.', 'workers', 'Each worker has its own Git worktree and branch, so they do not step on each other.'],
  ['13:40', 'Lunch', 'She closes the tab. The work goes on.', 'At lunch she checks her phone. The sidebar shows what is still running and which conversations are waiting for her answer.', 'your-turn', 'Agents run on the server, not in the browser, so a closed tab or a lost connection stops nothing.'],
  ['16:50', 'Builds', '“Make a page where we can book the meeting room.”', 'Before she leaves, her agent builds a small service, tests it and keeps it running on the studio’s server. Tomorrow the whole team can use it.', 'build-on-top', 'It is the studio’s own Linux server, not somebody’s platform, so whatever the team needs next, the agents can build it right there.'],
];

// ---------- 1 Alicen päivä: one story carries the page ----------
function v1() {
  const chapter = ([t, , h, p, img, under], i) => `<article class="d1-ch" data-i="${i}">
      <p class="d1-time">${t}</p>
      <h3>${h}</h3>
      <p>${p}</p>
      <p class="d1-under"><span>Underneath</span> ${under}</p>
      <figure class="d1-inline">${pic(img)}</figure>
    </article>`;
  return `<div class="pg d1">
${hero(0)}
<section class="d1-intro" id="day">
  <p class="kicker">One person, one day</p>
  <h2>Alice’s first day with an agent of her own.</h2>
  <p>On Monday morning Alice got a link. By the evening she had a report, a checked handbook and a booking page for the meeting room, and she had not opened a terminal once. This is her day, step by step.</p>
</section>
<section class="d1-story">
  <div class="d1-chapters">
${DAY.map(chapter).join('\n')}
  </div>
  <div class="d1-screen" aria-hidden="true">
    <p class="d1-clock"><b>${DAY[0][0]}</b><span>${DAY[0][1]}</span></p>
    <ol class="d1-ticks">${DAY.map((d, i) => `<li${i === 0 ? ' class="on"' : ''}></li>`).join('')}</ol>
    <div class="d1-frames">${DAY.map(([, , , , img], i) => `<figure class="d1-frame${i === 0 ? ' on' : ''}${img === 'your-turn' ? ' small' : ''}">${pic(img)}</figure>`).join('')}</div>
  </div>
</section>
<section class="d1-unseen">
  <h2>What Alice never had to think about</h2>
  <div class="d1-three">
    <article><figure>${pic('people', 'shot plain')}</figure><h3>Everyone has their own.</h3><p>Every person is a separate Linux user with their own files, credentials and agents. The operating system keeps them apart, not rules inside a web app.</p></article>
    <article><figure>${pic('terminal-editor')}</figure><h3>The technical colleague sees the same work.</h3><p>A browser terminal on the same tmux sessions, a VS Code editor running as you, and plain SSH. A conversation is the agent’s own session file in your home directory.</p></article>
    <article><figure>${pic('connections')}</figure><h3>Her mail, calendar and files.</h3><p>Connect a work or personal mail account, calendars, contacts and documents, and the agent works with them as you.</p></article>
  </div>
</section>
<section class="d1-install" id="install">
  <div class="d1-install-text">
    <p class="kicker">Before Alice’s Monday</p>
    <h2>Her day started with one link given to a coding agent.</h2>
    <p>Someone at the studio administers a Linux server. They gave their coding agent the operator guide, which is written for an AI agent to read. The agent asked for what only they could supply and showed each plan before it changed anything. Then they sent the team the address.</p>
    <h3>What that person brings</h3>
    <ul>${BRING.map((b) => `<li>${b}</li>`).join('')}</ul>
  </div>
  <div class="msg">
    <p class="msg-k">${mark(18)} You, to your coding agent</p>
    <p class="msg-body">Install Open Habitat on my server. Here is the guide:<code>${GUIDE}</code></p>
    ${copyBtn(ASK)}
    ${byHand}
  </div>
</section>
<section class="d1-limits" id="limits">
  <h2>Before your own Monday</h2>
  <p class="pre">${PRERELEASE}</p>
  ${limitsList('limits4')}
</section>
${footer()}
</div>`;
}

function initV1(root) {
  const chs = [...root.querySelectorAll('.d1-ch')];
  const frames = [...root.querySelectorAll('.d1-frame')];
  const ticks = [...root.querySelectorAll('.d1-ticks li')];
  const clock = root.querySelector('.d1-clock');
  let cur = 0;
  const show = (i) => {
    if (i === cur) return;
    cur = i;
    frames.forEach((f, j) => f.classList.toggle('on', j === i));
    ticks.forEach((t, j) => t.classList.toggle('on', j <= i));
    chs.forEach((c, j) => c.classList.toggle('on', j === i));
    clock.innerHTML = `<b>${DAY[i][0]}</b><span>${DAY[i][1]}</span>`;
  };
  chs[0].classList.add('on');
  // The chapter that crosses the middle of the viewport owns the screen.
  const io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && show(+e.target.dataset.i)), { rootMargin: '-48% 0px -48% 0px' });
  chs.forEach((c) => io.observe(c));
  return () => io.disconnect();
}

// ---------- 2 Kysymykset: the reader's questions, in order ----------
const QS = [
  ['what', 'What does the agent actually do?'],
  ['terminal', 'Does anyone on my team need a terminal?'],
  ['day', 'What is someone’s first day like?'],
  ['apart', 'Can people see each other’s work?'],
  ['data', 'Where does our data go?'],
  ['tech', 'And the technical people?'],
  ['big', 'Can it take on a big job?'],
  ['install', 'What do we need to run it?'],
  ['limits', 'What does it not do?'],
];
function v2() {
  const q = (id) => { const n = QS.findIndex(([k]) => k === id); return `<p class="d2-n">${String(n + 1).padStart(2, '0')}</p><h2>${QS[n][1]}</h2>`; };
  const ev = (img, cap, cls = '') => `<figure class="d2-ev ${cls}">${pic(img)}<figcaption>${cap}</figcaption></figure>`;
  return `<div class="pg d2">
${hero(1)}
<div class="d2-wrap">
  <nav class="d2-toc" aria-label="Questions"><p class="kicker">Questions</p><ol>${QS.map(([id, t], i) => `<li><a href="#${id}" data-q="${id}"${i === 0 ? ' aria-current="true"' : ''}>${t}</a></li>`).join('')}</ol></nav>
  <div class="d2-answers">
    <section class="d2-q" id="what">${q('what')}
      <p class="d2-a"><b>Real work, on a real computer.</b> Each person’s agent has a full Linux account on your server: a shell, files, Git and every command-line tool. So it finishes work instead of describing it: reads the spreadsheets, builds the report, hands it back as a page you open.</p>
      <div class="d2-pair">${ev('agent-at-work', 'The agent reads three files, writes a script and runs it.')}${ev('view', 'The report it made, open beside the conversation.')}</div>
    </section>
    <section class="d2-q" id="terminal">${q('terminal')}
      <p class="d2-a"><b>No.</b> They open the address, sign in with GitHub and talk to their agent, on a laptop or a phone. The agent keeps the terminal; the person gets a browser tab.</p>
      ${ev('first-use', 'Getting started is a page in the browser: sign in, choose repositories, connect an AI account.', 'narrow')}
    </section>
    <section class="d2-q d2-day" id="day">${q('day')}
      <p class="d2-a"><b>Like Alice’s.</b> She runs the shop at Example Studio and had never opened a terminal. Here is her Monday, frame by frame.</p>
      <div class="d2-film">
        <div class="d2-film-bar"><span class="d2-film-pos">1 / ${DAY.length}</span><button type="button" class="d2-film-btn" data-dir="-1" aria-label="Previous moment" disabled>←</button><button type="button" class="d2-film-btn" data-dir="1" aria-label="Next moment">→</button></div>
        <ol class="d2-film-track">${DAY.map(([t, , h, p, img]) => `<li class="d2-frame"><figure class="d2-frame-pic${img === 'your-turn' ? ' small' : ''}">${pic(img)}</figure><p class="d2-frame-t">${t}</p><h3>${h}</h3><p>${p}</p></li>`).join('')}</ol>
      </div>
    </section>
    <section class="d2-q" id="apart">${q('apart')}
      <p class="d2-a"><b>No, the operating system keeps them apart.</b> Every person is a separate Linux user with their own files, credentials and agents, not rules inside a web app.</p>
      <p class="d2-a d2-honest">Two things this does not do. An agent is not sandboxed from the person it works for: it has that person’s files and credentials. And whoever administers the server can read every home on it, as on any Linux machine.</p>
      ${ev('people', 'One server, a separate home for each person.', 'narrow plain')}
    </section>
    <section class="d2-q" id="data">${q('data')}
      <p class="d2-a"><b>To your server, and nowhere in between.</b> There is no Open Habitat account, cloud or relay: the browser talks to your server. What leaves it is what your agents send to the AI service each person chose, and to the mail, calendar and file accounts they connect.</p>
    </section>
    <section class="d2-q" id="tech">${q('tech')}
      <p class="d2-a"><b>Nothing is hidden from them.</b> A browser terminal on the same tmux sessions, a VS Code editor running as you, and plain SSH all see the same work. A conversation is the agent’s own session file in your home directory.</p>
      ${ev('terminal-editor', 'The editor and the browser terminal, side by side.')}
    </section>
    <section class="d2-q" id="big">${q('big')}
      <p class="d2-a"><b>Yes, with workers.</b> Hand over a big task and the agent splits it between workers, each in its own Git worktree, and brings their results back. You can steer while it works: add an instruction, queue the next one, answer, or stop.</p>
      <div class="d2-pair">${ev('workers', 'A main agent and three workers, each on its own branch.')}${ev('steer', 'An instruction mid-work and a queued follow-up.')}</div>
    </section>
    <section class="d2-q" id="install">${q('install')}
      <p class="d2-a"><b>One person who administers a Linux server, and one message to their coding agent.</b> The operator guide is written for an AI agent to read. The agent asks for what only you can supply and shows you each plan before it changes anything.</p>
      <div class="msg"><p class="msg-k">${mark(18)} You, to your coding agent</p><p class="msg-body">Install Open Habitat on my server. Here is the guide:<code>${GUIDE}</code></p>${copyBtn(ASK)}</div>
      <h3 class="d2-h3">What that person brings</h3>
      <ul class="d2-list">${BRING.map((b) => `<li>${b}</li>`).join('')}</ul>
      ${byHand}
    </section>
    <section class="d2-q" id="limits">${q('limits')}
      <p class="pre">${PRERELEASE}</p>
      ${limitsList('limits2')}
    </section>
  </div>
</div>
${footer()}
</div>`;
}

function initV2(root) {
  const links = [...root.querySelectorAll('.d2-toc a')];
  const io = new IntersectionObserver((es) => es.forEach((e) => {
    if (!e.isIntersecting) return;
    links.forEach((a) => (a.dataset.q === e.target.id ? a.setAttribute('aria-current', 'true') : a.removeAttribute('aria-current')));
  }), { rootMargin: '-30% 0px -65% 0px' });
  root.querySelectorAll('.d2-q').forEach((s) => io.observe(s));
  const track = root.querySelector('.d2-film-track');
  const frames = [...track.children];
  const [prev, next] = root.querySelectorAll('.d2-film-btn');
  const pos = root.querySelector('.d2-film-pos');
  const at = () => Math.round(track.scrollLeft / (frames[1].offsetLeft - frames[0].offsetLeft));
  const sync = () => {
    const i = at();
    pos.textContent = `${i + 1} / ${frames.length}`;
    prev.disabled = track.scrollLeft < 4;
    next.disabled = track.scrollLeft > track.scrollWidth - track.clientWidth - 4;
  };
  const go = (d) => {
    const i = Math.max(0, Math.min(frames.length - 1, at() + d));
    track.scrollTo({ left: frames[i].offsetLeft - frames[0].offsetLeft, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  };
  prev.addEventListener('click', () => go(-1));
  next.addEventListener('click', () => go(1));
  track.addEventListener('scroll', sync, { passive: true });
  sync();
  return () => io.disconnect();
}

// ---------- 3 Tutki itse: a short page you try with your hands ----------
const TRY = [
  ['view', 'Make a short report of October sales, with a chart.', 'The agent reads the shop files, writes a script, runs it and hands back a report you open beside the conversation.'],
  ['workers', 'Check the staff handbook against the new policy. Split it up.', 'The agent splits the job between workers, each in its own Git worktree, and brings their results back.'],
  ['steer', 'Wait, use the November prices instead.', 'Add an instruction in the middle of the work and queue the next one. No need to wait for it to finish.'],
  ['connections', 'Go through my mail and draft replies to the suppliers.', 'Connect your mail, calendars, contacts and documents, and the agent works with them as you.'],
  ['build-on-top', 'Make a page where we can book the meeting room.', 'It is your own Linux server, so the agent can build a small service, test it and keep it running for the whole team.'],
  ['terminal-editor', 'Show me what you did, in the terminal.', 'For the technical: a browser terminal on the same tmux sessions, a VS Code editor running as you, and plain SSH.'],
];
const STEPS = [0, 1, 2, 6];
function v3() {
  return `<div class="pg d3">
${hero(2)}
<section class="d3-day" id="day">
  <h2>Alice’s first day, in four steps.</h2>
  <p class="d3-sub">Alice runs the shop at Example Studio and has never opened a terminal. On Monday she got a link.</p>
  <ol class="d3-steps">${STEPS.map((k, n) => { const [t, , h, , img] = DAY[k]; return `<li><figure class="d3-thumb${img === 'your-turn' ? ' small' : ''}">${pic(img)}</figure><p class="d3-t"><span>${n + 1}</span>${t}</p><h3>${h}</h3></li>`; }).join('')}</ol>
</section>
<section class="d3-try" id="try">
  <h2>Ask it something.</h2>
  <p class="d3-sub">Pick a request. This is what your team sees when the agent takes it on.</p>
  <div class="d3-explorer">
    <div class="d3-tabs" role="tablist" aria-label="Requests" aria-orientation="vertical">${TRY.map(([img, ask], i) => `<button type="button" role="tab" id="d3-tab-${i}" aria-controls="d3-panel" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}" data-i="${i}"><span class="d3-you">You</span>${ask}</button>`).join('')}</div>
    <div class="d3-panel" id="d3-panel" role="tabpanel" aria-labelledby="d3-tab-0">
      ${TRY.map(([img, , what], i) => `<figure class="d3-shot${i === 0 ? ' on' : ''}" data-i="${i}">${pic(img)}<figcaption>${what}</figcaption></figure>`).join('')}
    </div>
  </div>
</section>
<section class="d3-facts">
  <div><b>Your own server.</b> No Open Habitat account, cloud or relay.</div>
  <div><b>A Linux account each.</b> People are kept apart by the operating system.</div>
  <div><b>Free and open source.</b> MIT License.</div>
</section>
<section class="d3-install" id="install">
  <h2>Install it with one message.</h2>
  <p class="d3-sub">Give your coding agent the guide’s link. The guide is written for an agent to read; it asks for what only you can supply and shows you each plan before it changes anything.</p>
  <div class="msg big">
    <p class="msg-k">${mark(18)} You, to your coding agent</p>
    <p class="msg-body">Install Open Habitat on my server. Here is the guide:<code>${GUIDE}</code></p>
    ${copyBtn(ASK)}
  </div>
  <div class="d3-bring"><p><b>You need</b> ${BRING.map((b) => b.replace(/[;.]$/, '')).join(' · ')}.</p>${byHand}</div>
</section>
<section class="d3-limits" id="limits">
  <h2>Good to know</h2>
  <p class="pre">${PRERELEASE}</p>
  ${limitsList('limits4 cards')}
</section>
${footer()}
</div>`;
}

function initV3(root) {
  const tabs = [...root.querySelectorAll('[role=tab]')];
  const shots = [...root.querySelectorAll('.d3-shot')];
  const panel = root.querySelector('.d3-panel');
  const select = (i, focus) => {
    tabs.forEach((t, j) => { t.setAttribute('aria-selected', j === i); t.tabIndex = j === i ? 0 : -1; });
    shots.forEach((s, j) => s.classList.toggle('on', j === i));
    panel.setAttribute('aria-labelledby', tabs[i].id);
    if (focus) { tabs[i].focus(); tabs[i].scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
  };
  tabs.forEach((t, i) => t.addEventListener('click', () => select(i)));
  // Arrow keys move within the list; they must not also flip the picker.
  root.querySelector('.d3-tabs').addEventListener('keydown', (e) => {
    const i = tabs.indexOf(document.activeElement);
    if (i < 0) return;
    const d = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
    if (d) { e.preventDefault(); e.stopPropagation(); select((i + d + tabs.length) % tabs.length, true); }
    else if (e.key === 'Home' || e.key === 'End') { e.preventDefault(); e.stopPropagation(); select(e.key === 'Home' ? 0 : tabs.length - 1, true); }
  });
}

// Copy buttons: the clipboard may be refused in a sandboxed view, so fall back
// to selecting the text and saying how to copy it.
stage.addEventListener('click', (e) => {
  const b = e.target.closest('.copy');
  if (!b) return;
  const done = (t) => { b.textContent = t; clearTimeout(b._t); b._t = setTimeout(() => { b.textContent = 'Copy'; }, 2400); };
  const fallback = () => {
    const code = b.parentElement.querySelector('.msg-body');
    const r = document.createRange(); r.selectNodeContents(code);
    const s = getSelection(); s.removeAllRanges(); s.addRange(r);
    done('Selected, press Ctrl+C');
  };
  if (navigator.clipboard?.writeText) navigator.clipboard.writeText(b.dataset.copy).then(() => done('Copied'), fallback);
  else fallback();
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
