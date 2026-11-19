// Three directions for the website's landing page. Every claim comes from the
// root README (the agreed text) or docs/operations.md; new headlines restate
// them. People and places are the screenshots' synthetic lab (Example Studio,
// Alice, Bob) plus one invented administrator, Sam.
// build.mjs defines IMG; lib/picker.js expects `stage` and `variants`.
const stage = document.getElementById('stage');

const REPO = 'https://github.com/Open-Habitat/open-habitat';
const GUIDE = 'https://raw.githubusercontent.com/Open-Habitat/open-habitat/main/docs/operations.md';
const RING = 'M9 -2v6a5 5 0 0 1-5 5h-8a5 5 0 0 1-5-5v-8a5 5 0 0 1 5-5h8a5 5 0 0 1 5 5z';
const mark = (px = 22, state = 'idle') => `<svg class="oh-mark" data-state="${state}" viewBox="-12 -12 24 24" width="${px}" height="${px}" aria-hidden="true"><path class="oh-ring" pathLength="100" d="${RING}"/><circle class="oh-dot" r="2.5"/></svg>`;

// The README's alt texts.
const ALT = {
  hero: 'A conversation with an agent in Open Habitat on a desktop browser, with running and waiting conversations in the sidebar, and the same conversation on a phone',
  'agent-at-work': 'An agent running commands and editing files in a conversation, with its progress shown step by step',
  'first-use': 'Getting started in the browser: sign in, choose repositories, connect an AI account',
  'your-turn': 'The sidebar with conversations under Your turn and Running',
  steer: 'A steering message and a queued follow-up above the message field while the agent works',
  workers: 'A main agent with three workers, each showing its own Git branch and state',
  connections: 'Data connections in settings, with a Google and a Microsoft 365 account connected',
  view: 'An HTML report the agent made, open in a panel beside the conversation',
  'build-on-top': 'An agent building and starting a small internal service on the server',
  people: 'One server with a separate home for each of three people',
  'ai-account': 'Connecting an AI account in the browser with a sign-in link and a code',
  'terminal-editor': 'The VS Code editor and the browser terminal side by side',
};
const pic = (name, cls = 'shot') => { const i = IMG[name]; return `<img class="${cls}" src="${i.src}" width="${i.w}" height="${i.h}" alt="${ALT[name]}">`; };

// Shared facts, rendered differently by each direction.
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
const ALSO = [
  ['Dictation', 'talk instead of typing.'],
  ['Recaps', 'a short summary of where a conversation stands.'],
  ['GitHub, Gitea and GitLab', 'clone repositories and let the agent work with them as you.'],
  ['Your own machines', 'connect your own computers for the agent over Tailscale.'],
  ['English and Finnish', 'in light, dark and high-contrast themes.'],
];
const CMDS = `./bin/open-habitat host check --site /etc/open-habitat/site.json
./bin/open-habitat host plan  --site /etc/open-habitat/site.json --json
./bin/open-habitat host apply --site /etc/open-habitat/site.json --dry-run --json`;
const footer = (cls) => `<footer class="${cls}"><span class="brandword">${mark(18)} Open Habitat</span><span>Free and open source under the MIT License.</span><a href="${REPO}">GitHub</a><a href="${REPO}/releases">Releases</a><a href="${REPO}/discussions">Discussions</a><span class="quiet">This page sets no cookies and loads nothing from anywhere else.</span></footer>`;
const masthead = (cls, links) => `<header class="${cls}"><a class="brandword" href="#">${mark(24)} Open Habitat</a><nav>${links.map(([t, h]) => `<a href="${h}">${t}</a>`).join('')}</nav></header>`;

// ---------- 1 Kuva edellä: the picture of the product, then a tour in pictures ----------
const TOUR = [
  ['agent-at-work', 'A real agent, not a chatbot', 'Each person’s agent works in their own Linux account on your server, with a shell, files, Git and the command line. It does the work and shows you the result.'],
  ['view', 'Results you can open', 'Agents hand back reports, charts and small web pages as views you open beside the conversation, and files you download with one click.'],
  ['steer', 'Steer it while it works', 'Add an instruction in the middle of the work, queue the next message, answer the agent’s questions or stop it. You do not have to wait for it to finish.'],
  ['workers', 'Workers, out of the box', 'Hand over a big task and the agent splits it between workers, each in its own Git worktree, and brings their results back. You follow every worker from the same sidebar.'],
  ['your-turn', 'Close the tab, the work goes on', 'Agents run on the server, not in your browser. Come back later from any device: the sidebar shows what is still running and what is waiting for your answer.'],
  ['build-on-top', 'Build your own on top', 'It is an ordinary Linux server that you run. Have the agents build a script, a scheduled job, an internal tool or a service every agent can use. Go wild with it.'],
];
const GALLERY = [
  ['first-use', 'Nothing to install', 'Open the address, sign in, and talk to your agent. On a laptop or a phone.'],
  ['ai-account', 'Bring your own AI subscription', 'Each person connects their own ChatGPT or Claude subscription or an API key, or the server provides one key.'],
  ['connections', 'Your mail, calendar and files', 'Connect Google, Microsoft 365, Dropbox or an ordinary mail account.'],
  ['people', 'Everyone has their own', 'Every person is a separate Linux user with their own files, credentials and agents.'],
  ['terminal-editor', 'Nothing hidden from the technical', 'A browser terminal on the same tmux sessions, a VS Code editor running as you, and plain SSH.'],
];
function v1() {
  return `<div class="pg d1">
${masthead('d1-top', [['Tour', '#d1-tour'], ['Install', '#d1-install'], ['Good to know', '#d1-know'], ['GitHub', REPO]])}
<section class="d1-hero">
  <p class="d1-eyebrow">Open source · on your own server · pre-release 0.1</p>
  <h1>Coding-grade AI agents <br>for your whole team.</h1>
  <p class="d1-lede">No terminal required. Everyone gets a real agent with its own Linux account, in a browser tab. One person sets up one server; everyone else signs in and gets to work.</p>
  <p class="d1-cta"><a class="btn" href="#d1-install">Install on your server</a><a class="btn ghost" href="#d1-tour">See it work</a></p>
</section>
<figure class="d1-herofig">${pic('hero', 'd1-heroimg')}</figure>
<ul class="d1-facts"><li><b>A browser tab</b> on a laptop or a phone</li><li><b>Your own Linux server</b>, no cloud or relay</li><li><b>Free and open source</b> under MIT</li></ul>
<section class="d1-tour" id="d1-tour">
  <h2 class="d1-h2">What your team sees</h2>
${TOUR.map(([img, h, t], i) => `  <article class="d1-scene${i % 2 ? ' flip' : ''}${img === 'your-turn' ? ' small' : ''}${img === 'build-on-top' ? ' tall' : ''}">
    <div class="d1-text"><h3>${h}</h3><p>${t}</p></div>
    <figure class="d1-fig">${pic(img)}</figure>
  </article>`).join('\n')}
</section>
<section class="d1-gallery">
  <h2 class="d1-h2">Also in the box</h2>
  <div class="d1-cards">${GALLERY.map(([img, h, t]) => `<article class="d1-card"><div class="d1-thumb">${pic(img)}</div><h3>${h}</h3><p>${t}</p></article>`).join('')}
    <article class="d1-card d1-more"><h3>And</h3><ul>${ALSO.map(([b, t]) => `<li><b>${b}</b>: ${t}</li>`).join('')}</ul></article>
  </div>
</section>
<section class="d1-install" id="d1-install">
  <div>
    <h2 class="d1-h2">One person sets up one server</h2>
    <p>Your team needs one person who administers a Linux server. That person brings:</p>
    <ul>${BRING.map((b) => `<li>${b}</li>`).join('')}</ul>
    <p>Download a release, check it against the SHA-256 digests GitHub states, write one site file that says who may sign in and who administers, then check, plan and apply:</p>
    <pre>${CMDS}</pre>
    <p>Then send your team the address.</p>
  </div>
  <aside class="d1-agent">
    <p class="d1-agent-k">${mark(20)} Let your agent do it</p>
    <p>The operator guide is written for an AI agent to read. Give your coding agent this link and ask it to install Open Habitat on your server:</p>
    <code class="link">${GUIDE}</code>
    <p>It asks you for what only you can supply and shows you each plan before it changes anything.</p>
  </aside>
</section>
<section class="d1-know" id="d1-know">
  <h2 class="d1-h2">Good to know</h2>
  <p class="pre">${PRERELEASE}</p>
  <dl>${LIMITS.map(([b, t]) => `<div><dt>${b}</dt><dd>${t}</dd></div>`).join('')}</dl>
</section>
${footer('d1-foot')}
</div>`;
}

// ---------- 2 Perustelu edellä: the argument first, pictures as evidence ----------
function v2() {
  const ev = (img, cap) => `<figure class="d2-ev">${pic(img)}<figcaption>${cap}</figcaption></figure>`;
  return `<div class="pg d2">
${masthead('d2-top', [['The argument', '#d2-arg'], ['Install', '#d2-install'], ['Limits', '#d2-limits'], ['GitHub', REPO]])}
<section class="d2-open">
  <h1>The most capable AI tools run on a real computer. <span>Almost nobody gets to use one.</span></h1>
  <div class="d2-open-foot">
    <p class="d2-lede">Open Habitat gives everyone on your team that kind of agent, in a browser tab. The agent keeps a full Linux account on your server. Nobody has to open a terminal.</p>
    <p class="d2-meta">Free and open source · runs on your server · pre-release 0.1<br><a href="#d2-arg">The argument in four steps ↓</a></p>
  </div>
</section>
<section class="d2-arg" id="d2-arg">
  <article class="d2-step">
    <p class="d2-n">01</p>
    <div class="d2-body">
      <h2>The power comes from the operating system.</h2>
      <p>The agents programmers use are the most capable AI tools there are, because they run on a real operating system. They have a shell, a filesystem, Git and every command-line tool there is, and they add the ones they are missing.</p>
      <p>That is what lets them finish work instead of describing it: read a folder of spreadsheets, build the report, fix the website.</p>
    </div>
    ${ev('agent-at-work', 'An agent reads the spreadsheets, writes a short script and runs it.')}
  </article>
  <article class="d2-step">
    <p class="d2-n">02</p>
    <div class="d2-body">
      <h2>The terminal keeps everyone else out.</h2>
      <p>Almost nobody outside engineering gets to use one, because it starts with a terminal. Open Habitat removes that step.</p>
      <div class="d2-swap">
        <p class="d2-was"><s>install a command-line tool</s><s>make an SSH key</s><s>learn a terminal</s></p>
        <p class="d2-now">open the address, sign in, talk to your agent</p>
      </div>
    </div>
    ${ev('first-use', 'Getting started is a page in the browser: sign in, choose repositories, connect an AI account.')}
  </article>
  <article class="d2-step d2-split">
    <p class="d2-n">03</p>
    <div class="d2-body">
      <h2>So split the two: the agent gets the Linux account, the person gets a browser.</h2>
      <p>The agent keeps its full account. The person gets an interface that is simple and pleasant to use, on a laptop or a phone.</p>
    </div>
    <div class="d2-halves">
      <figure><figcaption><b>The agent’s side</b> a shell, files, Git, every command-line tool</figcaption>${pic('terminal-editor')}</figure>
      <figure><figcaption><b>Your side</b> a conversation, what is running, what waits for you</figcaption>${pic('hero')}</figure>
    </div>
    <p class="d2-note">It is the same work on both sides: a conversation is the agent’s own session file in your home directory, so the browser and the terminal show the same thing.</p>
  </article>
  <article class="d2-step">
    <p class="d2-n">04</p>
    <div class="d2-body">
      <h2>And the computer is yours.</h2>
      <p>This is your Linux server, not somebody’s platform. The agents can write code, so whatever your team needs next, they can build it right there: a script, a scheduled job, an internal tool, a service of your own that every agent on the server can use.</p>
      <p class="d2-big">Go wild with it. Your team still just opens a browser.</p>
    </div>
    ${ev('build-on-top', 'Asked for a meeting-room booking page, the agent builds a small service, tests it and keeps it running.')}
  </article>
</section>
<section class="d2-follow">
  <h2 class="d2-kicker">What follows from that</h2>
  <div class="d2-three">
    <article><h3>Your server, and nothing in between.</h3><p>There is no Open Habitat account, cloud or relay. The browser talks to your server.</p></article>
    <article><h3>People are kept apart by the operating system.</h3><p>Every person is a separate Linux user with their own files, credentials and agents. Not rules inside a web app.</p>${pic('people', 'shot plain')}</article>
    <article><h3>The work stays in native files.</h3><p>A browser terminal on the same tmux sessions, a VS Code editor running as you, and plain SSH all see the same work.</p></article>
  </div>
</section>
<section class="d2-box">
  <h2 class="d2-kicker">What comes in the box</h2>
  <div class="d2-grid">
${[['workers', 'Workers', 'A big task is split between workers, each in its own Git worktree.'], ['steer', 'Steer while it works', 'Add an instruction, queue the next one, answer, or stop.'], ['your-turn', 'Close the tab', 'The work goes on; the sidebar says what waits for you.'], ['view', 'Results you can open', 'Reports, charts and small web pages beside the conversation.'], ['connections', 'Mail, calendar, files', 'Google, Microsoft 365, Dropbox or an ordinary mail account.'], ['ai-account', 'Your own AI subscription', 'ChatGPT, Claude or an API key, or one key for the server.']].map(([img, h, t]) => `    <article><div class="d2-thumb">${pic(img)}</div><h3>${h}</h3><p>${t}</p></article>`).join('\n')}
  </div>
  <p class="d2-also">${ALSO.map(([b, t]) => `<b>${b}</b>: ${t}`).join(' ')}</p>
</section>
<section class="d2-install" id="d2-install">
  <h2>Installing it is one message to your coding agent.</h2>
  <div class="d2-msg"><p class="d2-msg-k">You, to your coding agent</p><p>Install Open Habitat on my server. Here is the guide: <code>${GUIDE}</code></p></div>
  <p>The operator guide is written for an AI agent to read. The agent asks you for what only you can supply and shows you each plan before it changes anything.</p>
  <div class="d2-cols">
    <div><h3>What you bring</h3><ul>${BRING.map((b) => `<li>${b}</li>`).join('')}</ul></div>
    <div><h3>Or by hand: check, plan, apply</h3><pre>${CMDS}</pre><p>The guide has every step, including first-time preparation, the storage choice you cannot change later, upgrades and recovery.</p></div>
  </div>
</section>
<section class="d2-limits" id="d2-limits">
  <h2 class="d2-kicker">What it does not promise</h2>
  <p class="d2-pre">${PRERELEASE}</p>
  <ul>${LIMITS.map(([b, t]) => `<li><b>${b}</b> ${t}</li>`).join('')}</ul>
</section>
${footer('d2-foot')}
</div>`;
}

// ---------- 3 Tiimin päivä: one team's Monday through the screenshots ----------
const DAY = [
  ['Friday', 'Sam', 'Sam set up the server in an afternoon.', 'Sam is the one person at the studio who looks after a Linux server. They gave their coding agent one link, the install guide written for an agent to read. The agent asked for the domain name, a GitHub sign-in app and who may sign in, and showed each plan before it changed anything. Then Sam sent everyone the address.', null],
  ['08:58', 'Alice', 'Alice opens the address and signs in.', 'There is nothing to install: no terminal, no SSH key, no setup on her own computer. She picks the studio’s repositories she wants to work in.', 'first-use'],
  ['09:03', 'Alice', 'She connects her own ChatGPT subscription.', 'Each person connects their own ChatGPT or Claude subscription or an API key, or the server provides one key for everyone. Nobody shares a personal login.', 'ai-account'],
  ['09:10', 'Alice', '“Make a short report of October sales from the spreadsheets, with a chart.”', 'Her agent works in her own Linux account on the server. It reads the three shop files, writes a short Python script and runs it, and she can follow every step.', 'agent-at-work'],
  ['09:14', 'Alice', 'The report opens beside the conversation.', 'Agents hand back reports, charts and small web pages as views you open next to the conversation, and files you download with one click.', 'view'],
  ['10:20', 'Alice', '“Check the staff handbook against the new policy. Split the work if it helps.”', 'The agent splits it between three workers, each on its own Git branch, and brings their results back. Workers come in the box; she follows each one from the same sidebar.', 'workers'],
  ['11:40', 'Bob', 'Bob changes direction without waiting.', 'His agent is in the middle of a task. He adds an instruction, queues the next message, and could answer a question or stop it.', 'steer'],
  ['13:15', 'Bob', 'Bob connects his mail and calendar.', 'Google, Microsoft 365, Dropbox or an ordinary mail account: the agent works with his own mail, calendars, contacts and documents.', 'connections'],
  ['15:30', 'Alice', '“Build a simple page where the team can book the meeting room.”', 'The agent builds a small service, tests it and keeps it running on the studio’s server. It is their server, not somebody’s platform, so whatever the team needs next, the agents can build it right there.', 'build-on-top'],
  ['17:45', 'Alice', 'Alice closes her laptop. The work does not stop.', 'Agents run on the server, not in the browser. On Tuesday morning, on her phone or at her desk, the sidebar shows what is still running and what is waiting for her answer.', 'hero'],
];
function v3() {
  const scene = ([t, who, h, p, img], i) => `<article class="d3-scene${img ? '' : ' noimg'}${img === 'your-turn' ? ' small' : ''}${img === 'hero' ? ' wide' : ''}">
    <div class="d3-when"><span class="d3-time">${t}</span><span class="d3-who">${who}</span></div>
    <span class="d3-node" aria-hidden="true">${mark(18)}</span>
    <div class="d3-what"><h3>${h}</h3><p>${p}</p>${img ? `<figure>${pic(img)}</figure>` : `<code class="link">${GUIDE}</code>`}</div>
  </article>`;
  return `<div class="pg d3">
${masthead('d3-top', [['The day', '#d3-day'], ['Your Monday', '#d3-install'], ['Good to know', '#d3-know'], ['GitHub', REPO]])}
<section class="d3-hero">
  <p class="d3-eyebrow">Open Habitat · a Monday at Example Studio</p>
  <h1>One server. An agent for everyone. Nobody opened a terminal.</h1>
  <div class="d3-intro">
    <p class="d3-lede">Example Studio is a small shop with a website and a staff handbook. Only one person there manages a server. Here is the Monday after they set up Open Habitat: coding-grade AI agents for the whole team, in a browser tab.</p>
    <aside class="d3-cast" aria-label="Who is in the story">
      <p class="d3-cast-k">${mark(18)} <code>habitat.example.org</code></p>
      <ul><li><b>Sam</b> looks after the server. The only one who has used a terminal.</li><li><b>Alice</b> runs the shop: sales, the handbook, the website.</li><li><b>Bob</b> handles orders and suppliers, mostly from his phone.</li></ul>
      <p class="quiet">Each of them has their own Linux account and their own agent.</p>
    </aside>
  </div>
  <ol class="d3-strip" aria-label="The day at a glance">${DAY.map(([t, who, h]) => `<li><b>${t}</b>${who}</li>`).join('')}</ol>
</section>
<section class="d3-day" id="d3-day">
${DAY.map(scene).join('\n')}
  <article class="d3-scene d3-aside">
    <div class="d3-when"><span class="d3-time">All day</span><span class="d3-who">Everyone</span></div>
    <span class="d3-node" aria-hidden="true">${mark(18)}</span>
    <div class="d3-what d3-pair">
      <div><h3>Everyone had their own.</h3><p>Every person is a separate Linux user with their own files, credentials and agents. The operating system keeps them apart, not rules inside a web app.</p><figure>${pic('people', 'shot plain')}</figure></div>
      <div><h3>And Sam saw the same work.</h3><p>A browser terminal on the same tmux sessions, a VS Code editor running as you, and plain SSH. A conversation is the agent’s own session file in the person’s home directory.</p><figure>${pic('terminal-editor')}</figure></div>
    </div>
  </article>
</section>
<section class="d3-install" id="d3-install">
  <h2>Your team’s Monday starts with one server.</h2>
  <div class="d3-two">
    <div class="d3-card"><h3>Give your coding agent the link</h3><p>The operator guide is written for an AI agent to read. Ask your agent to install Open Habitat on your server:</p><code class="link">${GUIDE}</code><p>It asks you for what only you can supply and shows you each plan before it changes anything.</p></div>
    <div class="d3-card"><h3>What the server person brings</h3><ul>${BRING.map((b) => `<li>${b}</li>`).join('')}</ul><p class="quiet">By hand it is check, plan and apply with one site file. The guide has every step.</p></div>
  </div>
  <p class="d3-also"><b>Also in the box:</b> ${ALSO.map(([b]) => b).join(' · ')}</p>
</section>
<section class="d3-know" id="d3-know">
  <h2>Before your Monday</h2>
  <p class="pre">${PRERELEASE}</p>
  <dl>${LIMITS.map(([b, t]) => `<div><dt>${b}</dt><dd>${t}</dd></div>`).join('')}</dl>
</section>
${footer('d3-foot')}
</div>`;
}

// Each direction marks its line in the switcher and starts from the top.
const lines = [...document.querySelectorAll('.rq-lines li')];
const variants = [v1, v2, v3].map((fn, i) => () => {
  lines.forEach((li, j) => (j === i ? li.setAttribute('aria-current', 'true') : li.removeAttribute('aria-current')));
  window.scrollTo(0, 0);
  return fn();
});
