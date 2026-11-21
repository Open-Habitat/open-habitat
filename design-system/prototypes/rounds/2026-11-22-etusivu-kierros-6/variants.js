// The three variants differ only in how other roles are shown; Alice's day,
// the capabilities section, the hero and the stub are the same in all three.
//   1 Oma osio: after Alice's day, a section of six short role sequences.
//   2 Rinnakkaiset päivät: colleagues' glimpses between Alice's steps, at the
//     same hour, in their own product screens.
//   3 Valitse kenen päivä: a selector swaps the whole day for another role's.
const NUM = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const ENDS = {
  bob: 'At 17:10 the library’s three questions wait for Monday, the hotel has its quote, and the customer list has one Corner Books.',
  kirsi: 'At 15:15 October is closed and its VAT filed, and Alice has one slide that says how long the money lasts.',
  carol: 'At 15:30 the tote turns on the product page draft, two of her cut-outs are in Alice’s newsletter, and the course poster is ready for print.',
  dave: 'At 16:20 December’s rota holds every rule, Sami’s Monday is ready, and the seasonal packers can listen to the handbook on the bus.',
  erin: 'At 15:20 January is nearly full, Bob knows how much linen to cut, and Saturday’s class has an animation and forty cards.',
  frank: 'At 16:50 the script that answered this morning has answered again, and the shop has a care note from the lab’s results.',
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
    <h2>Six colleagues, the same kind of screen.</h2>
    <p>The rest of Example Studio. Bob sells, Kirsi keeps the books, Carol designs, Dave looks after the office and the people, Erin teaches the printing courses and Frank runs the dye research with the university. They work in the same Habitat, each in their own account with their own agents, so they can hand each other files, and the history shows who did what.</p>
    <nav class="role-nav" aria-label="People">${ROLES.map((d) => `<a href="#role-${d.id}">${avatar(d, 22)}<span><b>${esc(d.name)}</b>${esc(d.role)}</span></a>`).join('')}</nav>
  </div>
${ROLES.map((d, k) => `<div class="role" id="role-${d.id}">${roleHead(d, `${k + 1}/${ROLES.length}`)}${storySection(`role-${d.id}`, d.g.filter((g) => g.pick).map((g) => dayStep(g)), { cls: 's1-role' })}</div>`).join('\n')}
</section>
${capsSection()}
${stub}
</div>`;
}

// ---------- 2 Rinnakkaiset päivät ----------
// At least one glimpse from each colleague; five of them pass a file to or from Alice.
const MEANWHILE = [BOB.g[0], DAVE.g[1], FRANK.g[1], KIRSI.g[2], CAROL.g[3], ERIN.g[3], FRANK.g[4]];
function v2() {
  const steps = [...ALICE.g.map((g) => dayStep(g)), ...MEANWHILE.map((g) => dayStep(g, { meanwhile: true }))].sort((a, b) => a.t - b.t || (a.meanwhile ? 1 : -1));
  const cast = [ALICE, ...ROLES];
  return `<div class="pg v2">
${hero(1)}
<section class="day-intro" id="day">
  <p class="kicker">One Thursday, seven people</p>
  <h2>Alice’s Thursday, and the people around her.</h2>
  <p>${ALICE.blurb} Scroll, and her sidebar moves through the day. Between her steps, her colleagues are busy at the same hour, each in their own account with their own agents, in the same Habitat; now and then a file passes between them.</p>
  <ul class="cast">${cast.map((d) => `<li>${avatar(d, 30)}<span><b>${esc(d.name)}</b>${esc(d.role)}</span></li>`).join('')}</ul>
</section>
${storySection('alice-mw', steps)}
${aliceEnd}
${capsSection()}
${stub}
</div>`;
}

// ---------- 3 Valitse kenen päivä ----------
const dayIntro3 = (d) => `<h2>${esc(d.name)}’s Thursday, ${NUM[d.sess.length]} agents.</h2><p>${esc(d.blurb)} Scroll, and ${d === ALICE ? 'her' : 'the'} sidebar moves through the day.</p>`;
const aliceMore = () => `<section class="day-intro more-intro"><p class="kicker">Other weeks, the same desk</p><h2>Not every day is Thursday.</h2><p>Three things Alice asked for earlier this month: the board report, a model of a big decision she can change herself, and a loan application from her own papers.</p></section>
${storySection('alice-more', ALICE_MORE.g.map((g) => dayStep(g)), { cls: 's1-role' })}`;
const nextDay = (d) => { const nx = FULL_DAYS[(FULL_DAYS.indexOf(d) + 1) % FULL_DAYS.length]; return `<p class="next-day"><button type="button" class="next-b" data-day="${nx.id}">${avatar(nx, 22)}Next: ${esc(nx.name)}’s Thursday →</button></p>`; };
// Alice's evening closes her Thursday; her other weeks follow, then the button to the next day.
const dayBody3 = (d) => d === ALICE
  ? `${storySection('day-alice', ALICE.g.map((g) => dayStep(g)))}
${aliceEnd}
${aliceMore()}
<section class="day-end">${nextDay(d)}</section>`
  : `${storySection(`day-${d.id}`, d.g.map((g) => dayStep(g)))}
<section class="day-end"><p>${esc(ENDS[d.id])}</p>${nextDay(d)}</section>`;
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
  const wire = () => { const fs = [...host.querySelectorAll('.s1[data-story]')].map(initStory); return () => fs.forEach((f) => f()); };
  let off = wire();
  const choose = (id, focus) => {
    const d = FULL_DAYS.find((x) => x.id === id);
    pick.querySelectorAll('.who-b').forEach((b) => { const on = b.dataset.day === id; b.setAttribute('aria-checked', String(on)); b.tabIndex = on ? 0 : -1; if (on && focus) b.focus(); });
    off(); head.innerHTML = dayIntro3(d); host.innerHTML = dayBody3(d); off = wire();
    const top = root.querySelector('#day');
    if (top.getBoundingClientRect().top < 0) top.scrollIntoView({ block: 'start' });
  };
  root.chooseDay = (id) => choose(id, false);
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
// A capability line points at the glimpse in someone's day. Variant 3 first
// switches to that person's day; where the page does not show that glimpse
// (variant 1 picks three, variant 2 one or two), it goes to the person.
function goToGlimpse(root, a) {
  const who = a.dataset.who; const id = a.getAttribute('href').slice(1);
  if (root.chooseDay && !document.getElementById(id)) root.chooseDay(who);
  const el = document.getElementById(id) || root.querySelector(`#role-${who}`) || root.querySelector(`.s1-step[data-who="${who}"]`);
  if (el) el.scrollIntoView({ block: 'center', behavior: reduced() ? 'auto' : 'smooth' });
}
function initPage(root, extra) {
  const all = [...root.querySelectorAll('.s1[data-story]')].filter((s) => !s.closest('.v3-day')).map(initStory);
  const more = extra ? extra(root) : null;
  const onLink = (e) => { const a = e.target.closest('.cap-role'); if (a) { e.preventDefault(); goToGlimpse(root, a); } };
  root.addEventListener('click', onLink);
  return () => { all.forEach((f) => f()); if (more) more(); root.removeEventListener('click', onLink); };
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
