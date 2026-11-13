// Website front page in the new brand, round 1. Three directions of one page;
// the text is today's front page (window.T, read from
// website/src/components/Landing.astro by build.mjs), so only look and
// composition differ. The one new text is the state captions of direction 3,
// each a restatement of a claim the page already makes (NOTES.md).

const stage = document.getElementById('stage');
const SITE = 'https://open-habitat.ai';
const REPO = 'https://github.com/Open-Habitat/open-habitat';
const params = new URLSearchParams(location.search);
let lang = params.get('lang') === 'fi' ? 'fi' : 'en';
// null = the direction's own default; otherwise light | dark | contrast | system.
let themeChoice = params.get('theme');

const DIRECTIONS = [
  { key: 'hiljainen', name: 'Hiljainen', theme: 'system',
    line: 'Sovelluksen näköinen: Päivä oletuksena, Yö järjestelmän mukaan; teksti vasemmalla, palvelinkaavio oikealla, rauhalliset kortit.' },
  { key: 'yo', name: 'Yö ensin', theme: 'dark',
    line: 'Yön vihreä lähes mustalla aina oletuksena: iso otsikko, palvelin konsolilistauksena, osiot numeroituina riveinä ilman kortteja.' },
  { key: 'merkki', name: 'Merkki kantaa', theme: 'system',
    line: 'Iso merkki piirtyy latautuessa ja asukas astuu ovesta sisään; merkin tilat (miettii, työskentelee, sinun vuorosi, monta, valmis) kertovat, mitä tuote tekee.' },
];
const RECOMMENDATION =
  'Suositus: 3 Merkki kantaa. Se on ainoa, jossa uusi merkki tekee työtä eikä vain koristele: kävijä näkee heti, että agentti jatkaa ilman häntä ja kutsuu, kun on hänen vuoronsa. Sen alaosa on yhtä rauhallinen kuin 1:ssä, ja Yö toimii siinä järjestelmän mukaan.';

const UI = {
  en: { docs: 'Docs', security: 'Security', try: 'Try it', theme: 'Theme', themes: { system: 'Auto', light: 'Day', dark: 'Night', contrast: 'High contrast' },
    states: [
      ['thinking', 'Thinking', 'Steer it while it runs, or queue the next message.'],
      ['working', 'Working', 'Close the tab. The agent keeps working on the server.'],
      ['waiting', 'Your turn', 'It asks and waits for your answer, on a desktop or a phone.'],
      ['subs', 'Several at once', 'Each agent works in its own Git worktree.'],
      ['done', 'Done', 'The result is in your files, Git and Pi’s history, as over SSH.'],
    ], statesTitle: 'What the mark tells you' },
  fi: { docs: 'Ohjeet', security: 'Tietoturva', try: 'Kokeile', theme: 'Teema', themes: { system: 'Automaattinen', light: 'Päivä', dark: 'Yö', contrast: 'Korkea kontrasti' },
    states: [
      ['thinking', 'Miettii', 'Ohjaa sitä kesken työn tai jonota seuraava viesti.'],
      ['working', 'Työskentelee', 'Sulje välilehti. Agentti jatkaa työtä palvelimella.'],
      ['waiting', 'Sinun vuorosi', 'Se kysyy ja odottaa vastaustasi, työpöydällä tai puhelimessa.'],
      ['subs', 'Monta yhtä aikaa', 'Jokainen agentti työskentelee omassa Git-worktreessaan.'],
      ['done', 'Valmis', 'Tulos on tiedostoissasi, Gitissä ja Pi:n historiassa, kuten SSH:lla.'],
    ], statesTitle: 'Mitä merkki kertoo' },
};

// The mark exactly as brand-themes-and-state-mark draws it; colour from currentColor.
const RING = 'M9 -2v6a5 5 0 0 1-5 5h-8a5 5 0 0 1-5-5v-8a5 5 0 0 1 5-5h8a5 5 0 0 1 5 5z';
function mark(state = 'idle', px = 20, { subs = [], label = '', cls = '' } = {}) {
  const orbit = subs.length
    ? `<g class="oh-orbit">${subs.map((s, i) => {
        const a = (i / subs.length) * 2 * Math.PI - Math.PI / 2;
        return `<circle class="oh-sub" data-state="${s}" r="1.3" cx="${(5.6 * Math.cos(a)).toFixed(2)}" cy="${(5.6 * Math.sin(a)).toFixed(2)}"/>`;
      }).join('')}</g>`
    : '';
  const a11y = label ? `role="img" aria-label="${label}"` : 'aria-hidden="true"';
  return `<svg class="oh-mark ${cls}" data-state="${state}" viewBox="-12 -12 24 24" width="${px}" height="${px}" ${a11y}><path class="oh-ring" pathLength="100" d="${RING}"/><circle class="oh-dot" r="2.5"/>${orbit}</svg>`;
}

// Site links point at the live site so the offline page's links work.
const href = (path) => `${SITE}${lang === 'fi' ? '/fi' : ''}${path}`;
const laptopIcon = '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2" y="3" width="12" height="8" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M1 13.5h14" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>';
const phoneIcon = '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="4.5" y="1.5" width="7" height="13" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M7 12h2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>';
const ghIcon = '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M8 .2a8 8 0 0 0-2.5 15.6c.4 0 .5-.2.5-.4v-1.5c-2.2.5-2.7-1-2.7-1-.4-.9-.9-1.2-.9-1.2-.7-.5.1-.5.1-.5.8.1 1.2.8 1.2.8.7 1.3 1.9.9 2.3.7.1-.5.3-.9.5-1.1-1.8-.2-3.6-.9-3.6-4 0-.9.3-1.6.8-2.1-.1-.2-.4-1 .1-2.1 0 0 .7-.2 2.2.8a7.6 7.6 0 0 1 4 0c1.5-1 2.2-.8 2.2-.8.4 1.1.2 1.9.1 2.1.5.6.8 1.3.8 2.1 0 3.1-1.9 3.8-3.6 4 .3.3.6.8.6 1.5v2.2c0 .2.1.5.6.4A8 8 0 0 0 8 .2"/></svg>';

const HOMES = [
  ['anna', '~/src/api', 'working', ['working', 'thinking']],
  ['ben', '~/src/docs', 'waiting', []],
  ['chen', '~/src/etl', 'working', []],
];
const daemonAs = (who) => (lang === 'fi' ? `daemon ${who}-käyttäjänä` : `${T[lang].diagram.daemonAs} ${who}`);
const stateText = (s) => (s === 'working' ? T[lang].diagram.working : T[lang].diagram.turn);

// ---- Shared pieces --------------------------------------------------------

function review(i) {
  return `<div class="rq" role="note" data-direction="${i}">
  <div class="rq-in">
    <b>Verkkosivun etusivu uudessa ilmeessä · kierros 1</b>
    <ol class="rq-lines">${DIRECTIONS.map((d, j) => `<li${j === i ? ' aria-current="true"' : ''}><span>${j + 1} ${d.name}</span> ${d.line}</li>`).join('')}</ol>
    <p class="rq-rec">${RECOMMENDATION}</p>
  </div>
</div>`;
}

function header(i) {
  const u = UI[lang];
  const opts = ['system', 'light', 'dark', 'contrast'].map((k) => `<option value="${k}"${currentChoice(i) === k ? ' selected' : ''}>${u.themes[k]}</option>`).join('');
  return `<header class="wf-top"><div class="wf-wrap wf-top-in">
  <a class="wf-brand" href="${href('/')}">${mark(i === 2 ? 'idle' : 'intro', i === 1 ? 24 : 22)}<span translate="no">Open Habitat</span></a>
  <nav class="wf-nav" aria-label="${lang === 'fi' ? 'Sivusto' : 'Site'}"><a href="${href('/docs/')}">${u.docs}</a><a href="#security">${u.security}</a><a href="#try">${u.try}</a></nav>
  <div class="wf-tools">
    <div class="wf-lang" role="group" aria-label="Language"><button type="button" data-lang="en" aria-pressed="${lang === 'en'}">EN</button><button type="button" data-lang="fi" aria-pressed="${lang === 'fi'}">FI</button></div>
    <label class="wf-theme"><span class="wf-sr">${u.theme}</span><select id="wf-theme">${opts}</select></label>
    <a class="wf-gh" href="${REPO}" aria-label="GitHub">${ghIcon}</a>
  </div>
</div></header>`;
}

const status = (px = 14) => `<span class="wf-status">${mark('idle', px)}${T[lang].status}</span>`;
const actions = () => `<div class="wf-actions"><a class="wf-btn wf-primary" href="#try">${T[lang].tryIt} →</a><a class="wf-btn" href="#compare">${T[lang].compareCta}</a></div>`;

function diagram(markPx = 16) {
  const d = T[lang].diagram;
  const homes = HOMES.map(([who, ws, s, subs], i) => `
    <div class="wf-home">
      <div><div class="wf-mono">/home/${who}</div><div class="wf-meta">${daemonAs(who)}</div></div>
      <div class="wf-agent"><div class="wf-task">${d.tasks[i]}</div><div class="wf-mono wf-meta">${ws}</div>
        <div class="wf-state" data-state="${s}">${mark(s, markPx, { subs: markPx >= 20 ? subs : [] })}<span>${stateText(s)}</span></div></div>
    </div>`).join('');
  return `<figure class="wf-server" aria-labelledby="wf-cap">
  <div class="wf-clients"><span class="wf-chip">${laptopIcon}anna · ${d.laptop}</span><span class="wf-chip">${phoneIcon}ben · ${d.phone}</span><span class="wf-chip wf-off">chen · ${d.closed}</span></div>
  <div class="wf-srv">
    <div class="wf-srv-head"><span class="wf-mono">habitat.example.org</span><span class="wf-meta">Ubuntu 24.04</span></div>
    <div class="wf-layer"><b>gateway</b><span>${d.gateway}</span></div>
    <div class="wf-homes">${homes}</div>
    <div class="wf-layer"><b>root broker</b><span>${d.broker}</span></div>
  </div>
  <figcaption id="wf-cap">${d.caption}</figcaption>
</figure>`;
}

const cards = () => T[lang].cards.map(([h, p]) => `<div class="wf-card"><h3>${h}</h3><p>${p}</p></div>`).join('');
const diffs = () => T[lang].diffs.map(([h, p]) => `<div class="wf-diff"><h3>${h}</h3><p>${p}</p></div>`).join('');
const nots = () => `<ul class="wf-nots">${T[lang].nots.map(([b, r]) => `<li><b>${b}</b> ${r}</li>`).join('')}</ul>`;
const layers = () => `<div class="wf-layers">${T[lang].layers.map(([n, p]) => `<div class="wf-layer"><b>${n}</b><span>${p}</span></div>`).join('')}</div>`;

function security() {
  const t = T[lang];
  return `<h2>${t.secTitle}</h2><p>${t.secLede}</p>${layers()}<p>${t.secMore}</p><p>${t.vuln}</p><p><a href="${href('/docs/security/')}">${t.secLink} →</a></p>`;
}
function tryIt() {
  const t = T[lang];
  return `<div><h2 id="wf-try">${t.tryTitle}</h2><p>${t.tryStatus}</p><p>${t.need}</p><ul class="wf-req">${t.reqs.map((r) => `<li>${r}</li>`).join('')}</ul></div>
  <div><h3>${t.howTitle}</h3><p>${t.how}</p><div class="wf-actions"><a class="wf-btn wf-primary" href="${href('/docs/try/')}">${t.tryLink}</a><a class="wf-btn" href="${href('/docs/operations/')}">${t.opsLink}</a><a class="wf-btn" href="${REPO}">${t.source}</a></div></div>`;
}
function footer() {
  const t = T[lang];
  return `<footer class="wf-foot"><div class="wf-wrap wf-foot-in">
  <div class="wf-foot-brand">${mark('idle', 18)}<span translate="no">Open Habitat</span></div>
  <div><p>${t.footLicence}</p><p>${t.footFonts}</p></div>
  <p>${t.footPrivacy}</p>
</div></footer>`;
}

// ---- Directions -----------------------------------------------------------

// 1 Hiljainen: today's composition in the app's own calm, with the new mark.
function v1() {
  const t = T[lang];
  applyTheme(0);
  return `${review(0)}<div class="wf d1" data-direction="0" lang="${lang}">${header(0)}<main>
  <section class="wf-hero"><div class="wf-wrap wf-hero-in">
    <div class="wf-hero-text">${status()}<h1>${t.heroTitle}</h1><p class="wf-tagline">${t.tagline}</p>${actions()}</div>
    <div class="wf-hero-fig">${diagram(16)}</div>
  </div></section>
  <div class="wf-wrap wf-body">
    <p class="wf-same">${t.sameWork}</p>
    <section id="what" aria-labelledby="wf-what"><h2 id="wf-what">${t.whatTitle}</h2><p class="wf-lede">${t.whatLede}</p><div class="wf-grid">${cards()}</div></section>
    <section id="compare" aria-labelledby="wf-compare"><h2 id="wf-compare">${t.compareTitle}</h2><p class="wf-lede">${t.compareLede}</p><div class="wf-diffs">${diffs()}</div></section>
    <section id="security" class="wf-two" aria-label="${t.notTitle} · ${t.secTitle}"><div><h2>${t.notTitle}</h2>${nots()}</div><div>${security()}</div></section>
    <section id="try" class="wf-two wf-try" aria-labelledby="wf-try">${tryIt()}</section>
  </div></main>${footer()}</div>`;
}

// 2 Yö ensin: dark by default, large type, the server as a console listing,
// sections as numbered rows instead of cards.
function v2() {
  const t = T[lang], d = t.diagram;
  applyTheme(1);
  const rows = HOMES.map(([who, ws, s, subs], i) => `
      <div class="wf-row" data-state="${s}"><span class="wf-mono wf-path">/home/${who}</span><span class="wf-rowstate">${mark(s, 20, { subs })}<span>${stateText(s)}</span></span><span class="wf-task">${d.tasks[i]}</span><span class="wf-mono wf-meta">${ws} · ${daemonAs(who)}</span></div>`).join('');
  const console_ = `<figure class="wf-console" aria-labelledby="wf-cap">
    <div class="wf-console-head"><span class="wf-mono">habitat.example.org</span><span class="wf-meta">Ubuntu 24.04</span></div>
    <div class="wf-clients"><span class="wf-chip">${laptopIcon}anna · ${d.laptop}</span><span class="wf-chip">${phoneIcon}ben · ${d.phone}</span><span class="wf-chip wf-off">chen · ${d.closed}</span></div>
    <div class="wf-cl"><b>gateway</b><span>${d.gateway}</span></div>
    <div class="wf-rows">${rows}</div>
    <div class="wf-cl"><b>root broker</b><span>${d.broker}</span></div>
    <figcaption id="wf-cap">${d.caption}</figcaption>
  </figure>`;
  const sec = (n, id, title, lede, body, extra = '') => `<section id="${id}" class="wf-sec ${extra}" aria-labelledby="wf-${id}"><div class="wf-sec-head"><span class="wf-num">${String(n).padStart(2, '0')}</span><h2 id="wf-${id}">${title}</h2>${lede ? `<p class="wf-lede">${lede}</p>` : ''}</div><div class="wf-sec-body">${body}</div></section>`;
  return `${review(1)}<div class="wf d2" data-direction="1" lang="${lang}">${header(1)}<main>
  <section class="wf-hero"><div class="wf-wrap">
    ${status(16)}<h1>${t.heroTitle}</h1>
    <div class="wf-hero-split"><div><p class="wf-tagline">${t.tagline}</p>${actions()}<p class="wf-same">${t.sameWork}</p></div>${console_}</div>
  </div></section>
  <div class="wf-wrap wf-body">
    ${sec(1, 'what', t.whatTitle, t.whatLede, `<div class="wf-list">${cards()}</div>`)}
    ${sec(2, 'compare', t.compareTitle, t.compareLede, `<div class="wf-list">${diffs()}</div>`)}
    ${sec(3, 'not', t.notTitle, '', nots())}
    ${sec(4, 'security', t.secTitle, t.secLede, `${layers()}<p>${t.secMore}</p><p>${t.vuln}</p><p><a href="${href('/docs/security/')}">${t.secLink} →</a></p>`)}
    <section id="try" class="wf-sec wf-try" aria-labelledby="wf-try"><div class="wf-sec-head"><span class="wf-num">05</span></div><div class="wf-sec-body wf-two">${tryIt()}</div></section>
  </div></main>${footer()}</div>`;
}

// 3 Merkki kantaa: the mark draws itself and the resident steps in; its
// states then explain the product before the rest of the page.
function v3() {
  const t = T[lang], u = UI[lang];
  applyTheme(2);
  const states = u.states.map(([s, h, p]) => {
    const m = s === 'subs' ? mark('working', 44, { subs: ['working', 'thinking', 'waiting'] }) : mark(s, 44);
    return `<li class="wf-st" data-state="${s}"><span class="wf-st-mark">${m}</span><h3>${h}</h3><p>${p}</p></li>`;
  }).join('');
  return `${review(2)}<div class="wf d3" data-direction="2" lang="${lang}">${header(2)}<main>
  <section class="wf-hero"><div class="wf-wrap wf-hero-in">
    <div class="wf-hero-text"><span class="wf-bigmark">${mark('intro', 132, { label: 'Open Habitat' })}</span>
    ${status()}<h1>${t.heroTitle}</h1><p class="wf-tagline">${t.tagline}</p>${actions()}</div>
    <section class="wf-states" aria-labelledby="wf-states"><h2 id="wf-states">${u.statesTitle}</h2><ol class="wf-st-list">${states}</ol></section>
  </div></section>
  <div class="wf-wrap wf-body">
    <div class="wf-two wf-fig-row"><div class="wf-hero-fig">${diagram(20)}</div><p class="wf-same">${t.sameWork}</p></div>
    <section id="what" aria-labelledby="wf-what"><h2 id="wf-what">${t.whatTitle}</h2><p class="wf-lede">${t.whatLede}</p><div class="wf-grid">${cards()}</div></section>
    <section id="compare" aria-labelledby="wf-compare"><h2 id="wf-compare">${t.compareTitle}</h2><p class="wf-lede">${t.compareLede}</p><div class="wf-diffs">${diffs()}</div></section>
    <section id="security" class="wf-two" aria-label="${t.notTitle} · ${t.secTitle}"><div><h2>${t.notTitle}</h2>${nots()}</div><div>${security()}</div></section>
    <section id="try" class="wf-two wf-try" aria-labelledby="wf-try">${tryIt()}</section>
  </div></main>${footer()}</div>`;
}

// ---- Theme and language ---------------------------------------------------

function currentChoice(i) { return themeChoice || DIRECTIONS[i].theme; }
function resolve(choice) {
  if (choice !== 'system') return choice;
  if (matchMedia('(prefers-contrast: more)').matches) return 'contrast';
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
let shown = 0;
function applyTheme(i) {
  shown = i;
  const choice = currentChoice(i);
  // Dark-first still honours an explicit wish for more contrast.
  const theme = choice === 'dark' && !themeChoice && matchMedia('(prefers-contrast: more)').matches ? 'contrast' : resolve(choice);
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme === 'light' ? 'light' : 'dark';
}
const rerender = () => { stage.innerHTML = [v1, v2, v3][shown](); };
document.addEventListener('click', (e) => {
  const b = e.target.closest('.wf-lang [data-lang]');
  if (!b) return;
  lang = b.dataset.lang;
  rerender();
});
document.addEventListener('change', (e) => {
  if (e.target.id !== 'wf-theme') return;
  themeChoice = e.target.value;
  applyTheme(shown);
});
for (const q of ['(prefers-color-scheme: dark)', '(prefers-contrast: more)']) matchMedia(q).addEventListener('change', () => applyTheme(shown));

const variants = [v1, v2, v3];
