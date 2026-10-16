// Kierros 16.10.2026: Viimeisimpään-painike. Yhteistä kaikille suunnille: painike näkyy,
// kun keskustelun loppu on yli 120 px näkymän alapuolella, ja näkyvyys lasketaan
// vierityksestä ja jokaisesta korkeuden muutoksesta (blokit aukeavat, sulkeutuvat,
// striimaus). Painallus vierittää loppuun ja palauttaa uusimman seuraamisen.
(() => {
const J = { dir: 1, on: false, base: null, hinted: false };
const AWAY = 120;
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const ICON_DOWN = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="m6 13 6 6 6-6"/></svg>';

// The host sits right below the stage, so the button floats above whatever follows it
// (the recap card or the composer) and never covers them.
const host = document.createElement('div'); host.className = 'jl-host';
stage.after(host);
const sayHtml = (where) => `<span class="jl-say ${where}" aria-hidden="true"><span class="jl-dot"></span><span class="jl-text"></span><span class="jl-clock"></span></span>`;
host.innerHTML = `<div class="jl" data-on="false">${sayHtml('jl-out')}<button type="button" class="jl-btn" tabindex="-1">${sayHtml('jl-in')}<span class="jl-lbl">Viimeisimpään</span>${ICON_DOWN}<span class="jl-badge" aria-hidden="true"></span></button></div>`;
const box = host.firstElementChild; const btn = box.querySelector('.jl-btn');
const say = { text: [...box.querySelectorAll('.jl-text')], clock: [...box.querySelectorAll('.jl-clock')] };
const setText = (els, s) => { for (const el of els) if (el.textContent !== s) el.textContent = s; };

// What is below the reader, compared with when they left the end.
function below() {
  const live = stage.querySelector('.turn.live');
  const working = !!live?.classList.contains('working');
  const cells = live ? live.querySelectorAll(':scope > .cell').length : 0;
  const reply = !!live?.querySelector('.bubble.reply') && !live.classList.contains('working');
  const b = J.base ?? { cells, reply };
  const clock = live?.querySelector('.clock')?.textContent ?? '';
  return { working, clock, fresh: cells > b.cells || (reply && !b.reply), reply: reply && !b.reply, cells, replyNow: reply };
}
function update() {
  const gap = stage.scrollHeight - stage.scrollTop - stage.clientHeight;
  const away = gap > AWAY;
  const w = below();
  if (!away) J.base = { cells: w.cells, reply: w.replyNow };
  else if (!J.base) J.base = { cells: w.cells, reply: w.replyNow };
  const state = w.reply ? 'reply' : w.working ? 'working' : 'idle';
  if (J.on !== away) {
    J.on = away; box.dataset.on = String(away);
    btn.tabIndex = away ? 0 : -1;
    if (!away && document.activeElement === btn) stage.focus({ preventScroll: true });
  }
  // While fading out, the button keeps its last words so it does not change size.
  if (!away) return;
  box.dataset.state = state; box.dataset.fresh = String(w.fresh);
  // Text only; the button stays the same element so it keeps clicks and hover.
  const words = { reply: ['Uusi vastaus', 'Uusi vastaus alempana'], working: ['Pi työskentelee', 'Pi työskentelee'], idle: ['Viimeisimpään', 'Luet aiempaa keskustelua'], }[state];
  setText(say.text, J.dir === 3 ? words[1] : words[0]);
  setText(say.clock, state === 'working' ? w.clock : '');
  const label = state === 'reply' ? 'Viimeisimpään, uusi vastaus' : state === 'working' ? 'Viimeisimpään, Pi työskentelee' : (w.fresh ? 'Viimeisimpään, uutta sisältöä' : 'Viimeisimpään');
  if (btn.getAttribute('aria-label') !== label) { btn.setAttribute('aria-label', label); btn.title = label; }
}
let queued = false;
const schedule = () => { if (!queued) { queued = true; requestAnimationFrame(() => { queued = false; update(); }); } };
stage.addEventListener('scroll', schedule, { passive: true });
new ResizeObserver(schedule).observe(stage);
new MutationObserver(schedule).observe(stage, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['hidden', 'class', 'aria-expanded'] });
setInterval(() => { if (J.on) update(); }, 1000);

btn.addEventListener('click', () => {
  following = true;
  stage.scrollTo({ top: stage.scrollHeight, behavior: reduced.matches ? 'auto' : 'smooth' });
});

const view = (d) => () => {
  J.dir = d; J.base = null; box.className = `jl d${d}`;
  if (!J.hinted) { J.hinted = true; setTimeout(() => toast('Vieritä keskustelua ylöspäin, niin painike tulee näkyviin.'), 600); }
  return appView();
};
window.v1 = view(1); window.v2 = view(2); window.v3 = view(3);
})();
