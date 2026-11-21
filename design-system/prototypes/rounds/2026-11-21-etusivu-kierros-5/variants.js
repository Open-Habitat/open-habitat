// The three variants differ only in how other roles are shown; Alice's day,
// the capabilities section, the hero and the stub are the same in all three.
//   1 Oma osio: after Alice's day, a section of six short role sequences.
//   2 Rinnakkaiset päivät: colleagues' glimpses between Alice's steps, at the
//     same hour, in their own product screens.
//   3 Valitse kenen päivä: a selector swaps the whole day for another role's.
const NUM = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const ENDS = {
  bob: 'At 16:40 Bob’s twelve notes wait in his drafts, and the wholesale orders from Alice’s page are already in his file.',
  kirsi: 'At 16:15 the Corner Café’s three questions wait for its owner, and Example Studio’s October is ready to book.',
  grace: 'At 16:20 the portfolio notes wait for Grace to read before they go, and Alice knows how much linen to cut.',
  mira: 'At 16:50 the grant attachments wait for upload, and Example Studio knows which indigo to sell for windows.',
};

// ---------- 1 Oma osio ----------
const roleHead = (d, n) => `<header class="role-h">${avatar(d, 40)}<div><p class="role-k">${esc(d.role)} · ${esc(d.org)}</p><h3>${esc(d.name)}</h3><p>${esc(d.blurb)}</p></div><span class="role-n">${n}</span></header>`;
function v1() {
  return `<div class="pg v1">
${hero(0)}
${aliceIntro('Scroll, and her sidebar moves through the day.')}
${storySection('alice', ALICE.g.map((g) => dayStep(g)))}
${aliceEnd}
<section class="roles" id="roles">
  <div class="day-intro roles-intro">
    <p class="kicker">Same place, other work</p>
    <h2>Six other people, the same kind of screen.</h2>
    <p>Bob sells, Kirsi keeps books, Grace teaches, Mira does research, Nora looks after a clinic’s staff, Theo makes prints. Each has their own account and their own agents, and the same Thursday.</p>
    <nav class="role-nav" aria-label="People">${ROLES.map((d) => `<a href="#role-${d.id}">${avatar(d, 22)}<span><b>${esc(d.name)}</b>${esc(d.role)}</span></a>`).join('')}</nav>
  </div>
${ROLES.map((d, k) => `<div class="role" id="role-${d.id}">${roleHead(d, `${k + 1}/${ROLES.length}`)}${storySection(`role-${d.id}`, d.g.filter((g) => g.pick).map((g) => dayStep(g)), { cls: 's1-role' })}</div>`).join('\n')}
</section>
${capsSection()}
${stub}
</div>`;
}

// ---------- 2 Rinnakkaiset päivät ----------
const MEANWHILE = [BOB.g[0], MIRA.g[1], KIRSI.g[4], BOB.g[4], GRACE.g[4], MIRA.g[3]];
function v2() {
  const steps = [...ALICE.g.map((g) => dayStep(g)), ...MEANWHILE.map((g) => dayStep(g, { meanwhile: true }))].sort((a, b) => a.t - b.t || (a.meanwhile ? 1 : -1));
  const cast = [ALICE, BOB, KIRSI, GRACE, MIRA];
  return `<div class="pg v2">
${hero(1)}
<section class="day-intro" id="day">
  <p class="kicker">One Thursday, five people</p>
  <h2>Alice’s Thursday, and the people around her.</h2>
  <p>${ALICE.blurb} Scroll, and her sidebar moves through the day. Between her steps, four people she works with are busy at the same hour, each in their own account with their own agents; now and then a file passes between them.</p>
  <ul class="cast">${cast.map((d) => `<li>${avatar(d, 30)}<span><b>${esc(d.name)}</b>${esc(d.role)}, ${esc(d.org)}</span></li>`).join('')}</ul>
</section>
${storySection('alice-mw', steps)}
${aliceEnd}
${capsSection()}
${stub}
</div>`;
}

// ---------- 3 Valitse kenen päivä ----------
const dayIntro3 = (d) => `<h2>${esc(d.name)}’s Thursday, ${NUM[d.sess.length]} agents.</h2><p>${esc(d.blurb)} Scroll, and ${d === ALICE ? 'her' : 'the'} sidebar moves through the day.</p>`;
const dayBody3 = (d) => `${storySection(`day-${d.id}`, d.g.map((g) => dayStep(g)))}
<section class="day-end"><p>${d === ALICE ? aliceEnd.replace(/^.*?<p>|<\/p>.*$/gs, '') : esc(ENDS[d.id])}</p>${(() => { const nx = FULL_DAYS[(FULL_DAYS.indexOf(d) + 1) % FULL_DAYS.length]; return `<p class="next-day"><button type="button" class="next-b" data-day="${nx.id}">${avatar(nx, 22)}Next: ${esc(nx.name)}’s Thursday →</button></p>`; })()}</section>`;
function v3() {
  return `<div class="pg v3">
${hero(2)}
<section class="day-intro v3-intro" id="day">
  <p class="kicker">One Thursday, whose day?</p>
  <div class="who-pick" role="radiogroup" aria-label="Whose day">${FULL_DAYS.map((d, k) => `<button type="button" role="radio" class="who-b" data-day="${d.id}" aria-checked="${k === 0}" tabindex="${k === 0 ? 0 : -1}">${avatar(d, 28)}<span><b>${esc(d.name)}</b>${esc(d.role)}</span></button>`).join('')}</div>
  <div class="v3-head">${dayIntro3(ALICE)}</div>
</section>
<div class="v3-day">${dayBody3(ALICE)}</div>
${capsSection()}
${stub}
</div>`;
}
function initV3(root) {
  const head = root.querySelector('.v3-head');
  const host = root.querySelector('.v3-day');
  const pick = root.querySelector('.who-pick');
  let off = initStory(host.querySelector('.s1'));
  const choose = (id, focus) => {
    const d = FULL_DAYS.find((x) => x.id === id);
    pick.querySelectorAll('.who-b').forEach((b) => { const on = b.dataset.day === id; b.setAttribute('aria-checked', String(on)); b.tabIndex = on ? 0 : -1; if (on && focus) b.focus(); });
    off(); head.innerHTML = dayIntro3(d); host.innerHTML = dayBody3(d); off = initStory(host.querySelector('.s1'));
    const top = root.querySelector('#day');
    if (top.getBoundingClientRect().top < 0) top.scrollIntoView({ block: 'start' });
  };
  const onClick = (e) => { const b = e.target.closest('.who-b, .next-b'); if (b) choose(b.dataset.day, b.classList.contains('next-b')); };
  // Arrows move within the selector and do not reach the picker.
  const onKey = (e) => {
    if (!['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].includes(e.key)) return;
    e.stopPropagation(); e.preventDefault();
    const ids = FULL_DAYS.map((d) => d.id); const cur = ids.indexOf(pick.querySelector('[aria-checked="true"]').dataset.day);
    choose(ids[(cur + (e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : ids.length - 1)) % ids.length], true);
  };
  root.addEventListener('click', onClick);
  pick.addEventListener('keydown', onKey);
  return () => { off(); root.removeEventListener('click', onClick); };
}
function initPage(root, extra) {
  const all = [...root.querySelectorAll('.s1[data-story]')].filter((s) => !s.closest('.v3-day')).map(initStory);
  const more = extra ? extra(root) : null;
  return () => { all.forEach((f) => f()); if (more) more(); };
}

// Each variant starts from the top, and wires its page once it is in the DOM
// (lib/picker.js sets innerHTML right after the render function returns).
let cleanup = null;
const variants = [[v1, null], [v2, null], [v3, initV3]].map(([fn, extra]) => () => {
  if (cleanup) { cleanup(); cleanup = null; }
  window.scrollTo(0, 0);
  setTimeout(() => { const root = stage.firstElementChild; if (root) cleanup = initPage(root, extra); }, 0);
  return fn();
});
