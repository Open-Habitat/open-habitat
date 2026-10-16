// Kirjaudu puhelimella ja istuntolista (proto-trash-and-devices, 17.10.2026). Asetukset ovat
// tuotannon nykyinen muoto (osioluettelo vasemmalla, yksi osio kerrallaan). Koodin elinkaari
// on gatewayn: luotu → käytetty tai vanhentunut; selain näyttää vain sen, minkä gateway kertoo.
// QR on koriste, ei oikea koodi. Esitys-rivin painikkeet ovat vain prototyypissä: ne
// esittävät puhelimen skannauksen, vieraan skannauksen ja minuutin kulumisen.
(() => {
const ICON_USER = SVG('<circle cx="12" cy="8" r="3.5"/><path d="M5 20c1.2-3.6 4-5 7-5s5.8 1.4 7 5"/>');
const ICON_PI = SVG('<rect x="4" y="7" width="16" height="12" rx="3"/><path d="M12 3v4M9 13h.01M15 13h.01"/>');
const ICON_LINK = SVG('<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>');
const ICON_EYE = SVG('<path d="M3 12s4-6 9-6 9 6 9 6-4 6-9 6-9-6-9-6z"/><circle cx="12" cy="12" r="2.6"/>');
const ICON_DISK = SVG('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 14h18M7 17h.01"/>');
const ICON_PHONE = SVG('<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>');
const ICON_LAPTOP = SVG('<rect x="4" y="5" width="16" height="11" rx="1.5"/><path d="M2 19h20"/>');
const ICON_DEVICES = SVG('<rect x="2.5" y="5" width="13" height="10" rx="1.5"/><path d="M1.5 18h10"/><rect x="16" y="8" width="6" height="12" rx="1.5"/>');
const ICON_QR = SVG('<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 20h4v-3"/>');
const ICON_OK = SVG('<path d="m5 12.5 4.5 4.5L19 7"/>');
const ICON_OUT = SVG('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>');
const ICON_CLOCK = SVG('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>');
const ICON_WARN = SVG('<path d="M12 4 2.8 19.5h18.4z"/><path d="M12 10v4M12 17h.01"/>');

// ---------- State ----------
const ME = { name: 'Jari Mustonen', first: 'Jari', email: 'jari@esimerkki.fi', login: 'maintainer', srv: 'open-habitat-test', host: 'test.open-habitat.example' };
// Session records as ADR 0018 point 6 extends them: created, method, coarse label from the User-Agent.
let SESS = [
  { id: 's1', dev: 'Linux · Firefox', kind: 'laptop', m: 'github', at: '14.10. klo 9.12', me: true },
  { id: 's2', dev: 'macOS · Chrome', kind: 'laptop', m: 'github', at: '2.10. klo 18.40' },
  { id: 's3', dev: 'Android · Chrome', kind: 'phone', m: 'link', at: '28.9. klo 21.05' },
];
const LIFE = 60;
const L = { st: 'idle', left: LIFE, timer: 0, seed: 1, by: null, out: false };
let CUR = 'v1', VIEW = 'settings', SEC = 'tili', PHONE = null, POP = false;
const n = (k, one, many) => `${k} ${k === 1 ? one : many}`;
const mmss = (s) => `${Math.floor(s / 60)}.${String(s % 60).padStart(2, '0')}`;

// ---------- QR (decorative: finder squares and a seeded pattern) ----------
function qr(seed) {
  const N = 25; let x = seed * 9301 + 49297; const rnd = () => (x = (x * 9301 + 49297) % 233280) / 233280;
  const finder = (r, c) => [[0, 0], [0, N - 7], [N - 7, 0]].some(([a, b]) => r >= a - 1 && r <= a + 7 && c >= b - 1 && c <= b + 7);
  let cells = '';
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (!finder(r, c) && rnd() < .48) cells += `M${c} ${r}h1v1h-1z`;
  const eye = (a, b) => `<path d="M${b} ${a}h7v7h-7zM${b + 1} ${a + 1}v5h5v-5z" fill-rule="evenodd"/><path d="M${b + 2} ${a + 2}h3v3h-3z"/>`;
  return `<svg class="lk-qr" viewBox="-2 -2 ${N + 4} ${N + 4}" role="img" aria-label="QR-koodi, joka kirjaa puhelimen tilillesi" shape-rendering="crispEdges"><rect x="-2" y="-2" width="${N + 4}" height="${N + 4}" fill="#fff"/><g fill="#16191d">${eye(0, 0)}${eye(0, N - 7)}${eye(N - 7, 0)}<path d="${cells}"/></g></svg>`;
}

// ---------- The code's life (gateway: mint, expire, redeem) ----------
function mint() {
  clearInterval(L.timer); L.st = 'qr'; L.left = LIFE; L.seed++; L.by = null; L.out = false;
  L.timer = setInterval(tick, 1000); paintPanels();
  if (PHONE && PHONE !== 'ask') PHONE = null, paintPhone();
}
function tick() {
  if (L.st !== 'qr') return clearInterval(L.timer);
  L.left = Math.max(0, L.left - 1);
  if (!L.left) { L.st = 'expired'; clearInterval(L.timer); if (PHONE === 'ask') { PHONE = 'dead'; paintPhone(); } return paintPanels(); }
  // Only the changing text and bar; buttons keep their focus and presses.
  document.querySelectorAll('[data-left]').forEach(e => { e.textContent = mmss(L.left); });
  document.querySelectorAll('.lk-time > span').forEach(e => { e.style.width = `${100 * L.left / LIFE}%`; });
}
function cancel() { clearInterval(L.timer); L.st = 'idle'; if (PHONE === 'ask') PHONE = 'dead'; paintPanels(); paintPhone(); }
function redeem(dev, kind) {
  clearInterval(L.timer);
  const s = { id: 's' + (SESS.length + 1) + L.seed, dev, kind, m: 'link', at: 'tänään klo 9.41', fresh: true };
  SESS.forEach(x => delete x.fresh); SESS.push(s); L.st = 'used'; L.by = s; paintPanels();
}

// ---------- QR panel: the same in every direction ----------
function panel() {
  if (L.st === 'qr') return `<div class="lk-panel"><div class="lk-qrbox">${qr(L.seed)}</div><div class="lk-side">
<p class="lk-h">Skannaa puhelimen kameralla</p><p class="lk-p">Puhelin kysyy vielä, kirjaudutaanko nimellä ${esc(ME.first)}. Koodi toimii kerran.</p>
<p class="lk-left">${ICON_CLOCK}<span>Vanhenee <b data-left>${mmss(L.left)}</b></span></p><span class="lk-time" aria-hidden="true"><span style="width:${100 * L.left / LIFE}%"></span></span>
<p class="lk-warn">${ICON_WARN}<span>Koodi kirjaa laitteen tilillesi, joten älä näytä sitä kenellekään äläkä skannaa sitä toisen pyynnöstä.</span></p>
<div class="lk-row"><button type="button" class="secondary" data-lk="cancel">Peruuta</button></div>
<div class="lk-demo" aria-label="Prototyypin esitys"><span>Esitys</span><button type="button" data-lk="scan">Puhelin skannaa</button><button type="button" data-lk="stranger">Joku muu ehtii ensin</button><button type="button" data-lk="expire">Minuutti kuluu</button></div></div></div>`;
  if (L.st === 'used') {
    const s = L.by;
    if (L.out) return `<div class="lk-panel done"><p class="lk-result">${ICON_OK}<span><b>${esc(s.dev)}</b> kirjattiin ulos.</span></p><div class="lk-row"><button type="button" class="secondary" data-lk="again">Näytä uusi koodi</button><button type="button" class="primary" data-lk="close">Valmis</button></div></div>`;
    return `<div class="lk-panel done"><p class="lk-result ok">${ICON_OK}<span>Koodilla kirjautui <b>${esc(s.dev)}</b> juuri nyt. Koodi ei toimi enää.</span></p>
<p class="lk-p">Oliko se sinun puhelimesi? Jos ei, kirjaa laite ulos heti. Laitteen nimi on selaimen oma ilmoitus.</p>
<div class="lk-row"><button type="button" class="secondary" data-lk="kick">${ICON_OUT}Kirjaa tämä laite ulos</button><button type="button" class="primary" data-lk="close">Se olin minä</button></div></div>`;
  }
  if (L.st === 'expired') return `<div class="lk-panel done"><p class="lk-result">${ICON_CLOCK}<span>Koodi vanheni käyttämättä. Kukaan ei kirjautunut.</span></p><div class="lk-row"><button type="button" class="primary" data-lk="again">${ICON_QR}Näytä uusi koodi</button></div></div>`;
  return '';
}
const intro = `Avaa Open Habitat puhelimessa ilman GitHub-kirjautumista. Koodi on voimassa minuutin ja toimii kerran; puhelin saa oman istuntonsa, jonka voit kirjata ulos täältä.`;

// ---------- Sessions ----------
function sessRow(s) {
  const how = s.m === 'github' ? 'Kirjautunut GitHubilla' : 'Kirjautunut QR-koodilla';
  return `<li class="lk-s${s.fresh ? ' fresh' : ''}"><span class="lk-dev">${s.kind === 'phone' ? ICON_PHONE : ICON_LAPTOP}</span><div class="lk-sm"><span class="lk-sn">${esc(s.dev)}${s.me ? '<span class="lk-badge">Tämä selain</span>' : ''}${s.fresh ? '<span class="lk-badge new">Uusi</span>' : ''}</span><span class="lk-meta">${how} ${s.at}</span></div>
${s.me ? `<button type="button" class="secondary sm" data-lk="logout">Kirjaudu ulos…</button>` : `<button type="button" class="lk-quiet" data-lk="end:${s.id}">Kirjaa ulos…</button>`}</li>`;
}
const sessions = () => `<ul class="lk-list">${SESS.map(sessRow).join('')}</ul><p class="lk-foot">Laitteiden nimet tulevat selainten omista ilmoituksista. Uloskirjaus koskee vain selainta; työtilat, agenttien työ ja palvelimen tunnukset säilyvät.</p>`;

// ---------- Settings shell (production's shape) ----------
const navFor = () => [['tili', 'Tili', ICON_USER], ...(CUR === 'v2' ? [['laitteet', 'Laitteet', ICON_DEVICES]] : []), ['agentit', 'Agentit', ICON_PI], ['yhteydet', 'Yhteydet', ICON_LINK], ['ulkoasu', 'Ulkoasu', ICON_EYE], ['tila', 'Tallennustila', ICON_DISK]];
const who = `<div class="lk-who"><span class="lk-av">J</span><div><strong>${esc(ME.name)}</strong><span class="lk-meta">${esc(ME.email)} · GitHub <span class="mono">${ME.login}</span></span></div></div>`;
const gitRow = `<div class="lk-r"><div><span class="lk-rn">Git-identiteetti</span><span class="lk-meta">Commitien tekijä. Tallentuu tiedostoon <span class="mono">~/.gitconfig</span>.</span></div><span class="lk-meta">${esc(ME.name)}</span></div>`;
function section() {
  if (SEC === 'laitteet') return `<h2 class="lk-h2">Laitteet</h2><div class="lk-card"><div class="lk-cardhead"><span class="lk-ic">${ICON_PHONE}</span><div><span class="lk-rn">Kirjaudu puhelimella</span><span class="lk-meta">${intro}</span></div>${L.st === 'idle' ? `<button type="button" class="primary" data-lk="mint">${ICON_QR}Näytä koodi</button>` : ''}</div>${panel()}</div>
<h3 class="lk-h3">Kirjautuneet laitteet <span class="lk-count">${SESS.length}</span></h3>${sessions()}`;
  const phoneRow = CUR === 'v1' ? `<div class="lk-r"><div><span class="lk-rn">Kirjaudu puhelimella</span><span class="lk-meta">${intro}</span></div><button type="button" class="secondary" data-lk="mint">${ICON_QR}Näytä koodi…</button></div>` : '';
  const v3 = CUR === 'v3' ? `<button type="button" class="lk-quiet acc" data-lk="pop">${ICON_QR}Kirjaudu puhelimella…</button>` : '';
  return `<h2 class="lk-h2">Tili</h2><div class="lk-card">${who}${gitRow}${phoneRow}</div><div class="lk-h3row"><h3 class="lk-h3">Kirjautuneet laitteet <span class="lk-count">${SESS.length}</span></h3>${v3}</div>${sessions()}`;
}
const settings = () => `<div class="lk-set"><nav class="lk-nav" aria-label="Asetusten osiot"><h1>Asetukset</h1>${navFor().map(([id, l, ic]) => `<a href="#" class="lk-nav-i" data-lk="sec:${id}"${id === SEC ? ' aria-current="true"' : ''}>${ic}<span>${l}</span></a>`).join('')}</nav><div class="lk-main">${section()}</div></div>`;

// ---------- V1 dialog, V3 popover ----------
const dlg = document.createElement('dialog'); dlg.className = 'confirm lk-dlg'; document.body.appendChild(dlg);
const dlgBody = () => `<div class="lk-dh"><h3>Kirjaudu puhelimella</h3><button type="button" class="icon-btn" data-lk="close" aria-label="Sulje" title="Sulje">${ICON_CLOSE}</button></div>${panel()}`;
dlg.addEventListener('close', () => { if (L.st === 'qr') cancel(); else if (L.st !== 'idle') { L.st = 'idle'; render(); } });
const pop = document.createElement('div'); pop.className = 'lk-pop'; pop.hidden = true; pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-label', 'Kirjaudu puhelimella'); uiFrame.appendChild(pop);
function openPop() { POP = true; UI.drawer = false; paint(); if (L.st !== 'qr') mint(); else paintPanels(); pop.hidden = false; pop.querySelector('button')?.focus({ preventScroll: true }); }
function closePop() { POP = false; pop.hidden = true; if (L.st === 'qr') cancel(); else { L.st = 'idle'; render(); } }
function paintPanels() {
  if (CUR === 'v1' && dlg.open) dlg.innerHTML = dlgBody();
  if (CUR === 'v3' && POP) pop.innerHTML = `<div class="lk-dh"><h3>Kirjaudu puhelimella</h3><button type="button" class="icon-btn" data-lk="close" aria-label="Sulje" title="Sulje">${ICON_CLOSE}</button></div>${panel()}`;
  render();
}

// ---------- The phone's /link page ----------
// A modal of its own, so it stacks above the Tilin rivi dialog.
const phone = document.createElement('dialog'); phone.className = 'lk-phone'; document.body.appendChild(phone);
phone.addEventListener('close', () => { PHONE = null; });
function paintPhone() {
  if (!PHONE) { if (phone.open) phone.close(); return; }
  if (!phone.open) phone.showModal();
  const head = `<div class="lk-ph-bar"><span class="mono">${ME.host}/link</span><button type="button" class="icon-btn" data-lk="phoneclose" aria-label="Sulje puhelin (esitys)" title="Sulje puhelin (esitys)">${ICON_CLOSE}</button></div><div class="lk-ph-brand"><span class="lk-logo">OH</span><span>Open Habitat · <span class="mono">${ME.srv}</span></span></div>`;
  const body = {
    ask: `<span class="lk-av lg">J</span><h2>Kirjaudutaanko nimellä ${esc(ME.name)}?</h2><p>GitHub <span class="mono">${ME.login}</span> palvelimella <span class="mono">${ME.srv}</span>. Tämä laite saa oman istunnon tälle tilille.</p><p class="lk-ph-warn">Hyväksy vain, jos skannasit koodin omalta näytöltäsi juuri nyt.</p><button type="button" class="primary wide" data-lk="phoneok">Kirjaudu</button><button type="button" class="secondary wide" data-lk="phoneno">Peruuta</button>`,
    in: `<span class="lk-big ok">${ICON_OK}</span><h2>Kirjauduttu</h2><p>Open Habitat avautuu. Voit kirjata tämän laitteen ulos tietokoneen Asetuksista.</p>`,
    dead: `<span class="lk-big">${ICON_CLOCK}</span><h2>Koodi ei enää toimi</h2><p>Se on jo käytetty, vanhentunut tai peruttu. Näytä uusi koodi tietokoneen Asetuksista.</p>`,
    no: `<span class="lk-big">${ICON_PHONE}</span><h2>Et kirjautunut</h2><p>Voit sulkea sivun. Koodi vanhenee itsestään.</p>`,
  }[PHONE];
  phone.innerHTML = `<div class="lk-ph">${head}<div class="lk-ph-body">${body}</div></div>`;
}

// ---------- Rendering ----------
function render() { if (VIEW !== 'settings') return; const y = stage.scrollTop; stage.innerHTML = settings(); stage.scrollTop = y; }
APP.painted.push(() => {
  uiFrame.classList.toggle('lk-paged', VIEW === 'settings');
  uiRail.querySelectorAll('.ws-more').forEach(b => b.remove());
  if (VIEW !== 'settings') return;
  uiRail.querySelectorAll('.conv-row[aria-current]').forEach(a => a.removeAttribute('aria-current'));
  uiTop.innerHTML = `<button class="icon-btn menu-btn" type="button" data-ui="drawer" aria-label="Avaa valikko" title="Avaa valikko">${ICON_MENU}</button><div class="tb-title"><strong>Asetukset</strong></div>`;
});
// V3: the account menu gets the item right after Asetukset.
new MutationObserver(() => {
  const m = document.querySelector('.p-menu'); if (CUR !== 'v3' || !m || m.hidden || m.querySelector('[data-lk="pop"]')) return;
  m.querySelector('[data-p="settings"]')?.insertAdjacentHTML('afterend', `<button type="button" role="menuitem" data-lk="pop">${ICON_QR}<span>Kirjaudu puhelimella</span></button>`);
}).observe(uiFrame, { subtree: true, childList: true, attributes: true, attributeFilter: ['hidden'] });

const confirm = document.createElement('dialog'); confirm.className = 'confirm lk-dlg sm'; document.body.appendChild(confirm);
let ENDING = null;
function askEnd(id) {
  const s = SESS.find(x => x.id === id); ENDING = id;
  confirm.innerHTML = `<form method="dialog"><h3>Kirjataanko ${esc(s.dev)} ulos?</h3><p>Laite palaa kirjautumissivulle seuraavassa pyynnössä. Tämä selain ja palvelimen työ eivät muutu.</p><div class="confirm-actions"><button class="secondary" value="cancel" autofocus>Peruuta</button><button class="lk-danger" value="ok">Kirjaa ulos</button></div></form>`;
  confirm.showModal();
}
confirm.addEventListener('close', () => {
  const id = ENDING; ENDING = null; if (confirm.returnValue !== 'ok') return; confirm.returnValue = '';
  const s = SESS.find(x => x.id === id); SESS = SESS.filter(x => x !== s);
  if (L.by === s) L.out = true;
  paintPanels(); toast(`${s.dev} kirjattiin ulos.`);
});

window.addEventListener('click', (e) => {
  const t = e.target;
  if (t.closest('.proto-picker')) return;
  const stop = () => { e.preventDefault(); e.stopPropagation(); };
  const p = t.closest('[data-p="settings"]');
  if (p) { stop(); document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); VIEW = 'settings'; SEC = CUR === 'v2' ? 'laitteet' : 'tili'; paint(); return render(); }
  if (t.closest('[data-conv], [data-ws-add]')) { VIEW = 'conv'; if (POP) closePop(); return; }
  const k = t.closest('[data-lk]'); if (!k) { if (POP && !t.closest('.lk-pop, .lk-phone, [data-menu]')) closePop(); return; }
  stop();
  const [a, arg] = k.dataset.lk.split(/:(.*)/s);
  switch (a) {
    case 'sec': if (!navFor().some(x => x[0] === arg) || !['tili', 'laitteet'].includes(arg)) return toast('Muut osiot ovat ennallaan; tässä vedoksessa ei mukana.'); SEC = arg; return render();
    case 'mint': mint(); if (CUR === 'v1') { dlg.innerHTML = dlgBody(); dlg.showModal(); } return;
    case 'pop': document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); return openPop();
    case 'again': return mint();
    case 'cancel': if (CUR === 'v1') return dlg.close(); if (CUR === 'v3') return closePop(); return cancel();
    case 'close': if (CUR === 'v1') return dlg.close(); if (CUR === 'v3') return closePop(); L.st = 'idle'; return render();
    case 'scan': PHONE = 'ask'; return paintPhone();
    case 'stranger': redeem('Android · Samsung Internet', 'phone'); if (PHONE === 'ask') { PHONE = 'dead'; paintPhone(); } return;
    case 'expire': L.left = 1; return tick();
    case 'kick': return askEnd(L.by.id);
    case 'end': return askEnd(arg);
    case 'logout': return toast('Kirjauduttaisiin ulos tästä selaimesta (nykyinen Kirjaudu ulos -vahvistus).');
    case 'phoneok': if (L.st !== 'qr') { PHONE = 'dead'; return paintPhone(); } redeem('iPhone · Safari', 'phone'); PHONE = 'in'; return paintPhone();
    case 'phoneno': PHONE = 'no'; return paintPhone();
    case 'phoneclose': PHONE = null; return paintPhone();
  }
}, true);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && POP && !PHONE) closePop(); });

const pick = (v) => () => {
  CUR = v; VIEW = 'settings'; SEC = v === 'v2' ? 'laitteet' : 'tili'; clearInterval(L.timer); L.st = 'idle'; PHONE = null; paintPhone();
  if (dlg.open) dlg.close(); POP = false; pop.hidden = true; UI.pop = false; paint(); following = false;
  requestAnimationFrame(() => { stage.scrollTop = 0; lastTop = 0; });
  return settings();
};
window.v1 = pick('v1'); window.v2 = pick('v2'); window.v3 = pick('v3');
})();
