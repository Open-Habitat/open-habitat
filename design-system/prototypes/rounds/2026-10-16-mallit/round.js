// Kierros 16.10.2026: mallien tunnistus ja valinta (proto-model-discovery).
// Kaikille suunnille yhteistä: sama valitsin neljässä paikassa (Asetukset: uusien
// keskustelujen oletus; yläpalkin merkki: tämä keskustelu seuraavasta viestistä; uuden
// keskustelun kentän pilleri; torjutun mallin ilmoitus), ajattelutaso mallin vieressä ja
// mallit reitin mukaan ryhmiteltyinä. Suunnat eroavat siinä, mistä tieto mallin
// toimivuudesta tulee ja miten se näytetään. Sisältö on keksittyä; host-oletukset ovat
// issues/proto-model-discovery/result.md:ssä.
(() => {
const ICON_DOWN = SVG('<path d="m6 9 6 6 6-6"/>');
const ICON_OK = SVG('<path d="m5 12.5 4.5 4.5L19 7"/>');
const ICON_NO = SVG('<circle cx="12" cy="12" r="8.5"/><path d="M6 6l12 12"/>');
const ICON_UNK = SVG('<circle cx="12" cy="12" r="8.5" stroke-dasharray="3 3"/>');
const ICON_WARN = SVG('<path d="M12 4 2.8 19.5h18.4z"/><path d="M12 10v4M12 17h.01"/>');
const ICON_SPIN = SVG('<path d="M12 3a9 9 0 1 0 9 9"/>');
const ICON_SPARK = SVG('<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>');

// ---------- Models (synthetic account truth: the gpt-6 family answers, gpt-5.x is refused) ----------
// A Pi 1.3-shaped catalog (issue upgrade-pi-1x); the exact list may differ.
const CAT = [['gpt-6-astra', 'GPT-6 Astra'], ['gpt-6.1-sol', 'GPT-6.1 Sol'], ['gpt-6-sol', 'GPT-6 Sol'], ['gpt-6-terra', 'GPT-6 Terra'], ['gpt-6-luna', 'GPT-6 Luna'], ['gpt-5.5', 'GPT-5.5'], ['gpt-5.4', 'GPT-5.4'], ['gpt-5.4-mini', 'GPT-5.4 mini']];
// "Uusi malliperhe": after a catalog update, a newer model in an existing family and a new
// family. Invented names.
const NEWFAM = [['gpt-6.2-astra', 'GPT-6.2 Astra'], ['gpt-6-nova', 'GPT-6 Nova']];
const NAME = Object.fromEntries([...CAT, ...NEWFAM]);
const isNew = (id) => NEWFAM.some(([x]) => x === id);
const WORKS = (id) => /^gpt-6/.test(id) && id !== 'gpt-6-nova';
// Common rule (Jari 16.10.2026): offer the newest model of each family (luna, terra, sol,
// astra, and a family that appears later); older generations only behind "Vanhemmat mallit".
const famOf = (id) => { const m = id.match(/^gpt-([\d.]+)-([a-z]+)$/); return m && Number.parseFloat(m[1]) >= 6 ? { gen: Number.parseFloat(m[1]), fam: m[2] } : null; };
function newest(ids) {
  const best = {};
  for (const id of ids) { const f = famOf(id); if (f && (!best[f.fam] || f.gen > famOf(best[f.fam]).gen)) best[f.fam] = id; }
  return ids.filter(id => Object.values(best).includes(id));
}
const THINK = ['off', 'minimal', 'low', 'medium', 'high', 'xhigh'];
// Pi's model metadata says which levels a model supports; synthetic here: Luna stops at high.
const TOP = { 'gpt-6-luna': 'high' };
const levels = (id) => TOP[id] ? THINK.slice(0, THINK.indexOf(TOP[id]) + 1) : THINK;
const route = (id) => 'openai-codex/' + id;
const hhmm = () => new Date().toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' });

// ---------- State ----------
const S = { v: 'v1', sit: 'ok', settings: false, popAt: null, notice: true, pick: null, also: true, def: null, check: null, running: new Set(), ent: null, token: 0 };
let CV = {}; let ord = 0;
const aur = UI.ws.find(w => w.id === 'aurinkokello');
const real = (id) => UI.ws.flatMap(w => w.convs).find(c => c.id === id);
function seed() {
  S.token++; S.settings = false; S.popAt = null; S.notice = true; S.pick = null; S.also = true; S.running = new Set();
  // Pi's native default is the refused model, as on the test server before repair.
  S.def = { model: 'gpt-5.5', think: 'medium' };
  for (const w of UI.ws) w.convs = w.convs.filter(c => !/^n\d/.test(c.id));
  if (!real('cx')) aur.convs.unshift({ id: 'cx', title: 'Koodiblokkien testiviesti' });
  Object.assign(real('cx'), { title: 'Koodiblokkien testiviesti', st: 'waiting' });
  ord = 0;
  CV = {
    c1: { lib: true, model: 'gpt-6-astra', think: THINKING, log: [{ k: 'ok', model: 'gpt-6-astra', when: 'tänään 14.37', ord: ++ord, seed: true }] },
    cx: { model: 'gpt-5.5', think: 'medium', log: [
      { k: 'set', model: 'gpt-5.5', think: 'medium', time: '16:58' },
      { k: 'user', md: 'Voisitko tehdä minulle testiviestin, jossa on koodiblokkeja eri ohjelmointikielillä sekä JSONia, YAMLia ja Markdownia?', time: '16:58' },
      { k: 'err', model: 'gpt-5.5', when: 'tänään 16.58', ord: ++ord, seed: true },
    ] },
  };
  seedKnowledge();
}
function seedKnowledge() {
  const stale = S.sit === 'stale', fail = S.sit === 'fail';
  // Kokeilu: earlier one-model tries; nothing else is ever probed.
  const at = stale ? '7.10.' : 'tänään';
  S.check = { old: stale, res: { 'gpt-6.1-sol': { r: 'ok', at: `${at} 14.05` }, 'gpt-5.4': { r: 'no', at: `${at} 14.06` } } };
  S.ent = fail ? null : { at: stale ? '7.10. · 9 pv sitten' : 'tänään 14.05', old: stale };
}

// ---------- What is known about a model, per direction ----------
function lastOutcome(id) {
  let best = null;
  for (const c of Object.values(CV)) for (const it of c.log) if ((it.k === 'ok' || it.k === 'err') && it.model === id && (!best || it.ord > best.ord)) best = it;
  return best;
}
function catalog() {
  const all = [...(S.sit === 'new' ? NEWFAM : []), ...CAT].map(([id]) => id);
  // Käytön merkit, Pi's catalog unreadable: only the models the conversations tell about.
  if (S.v === 'v1' && S.sit === 'fail') return all.filter(id => lastOutcome(id));
  return all;
}
function mark(id) {
  if (S.v === 'v1') {
    const e = lastOutcome(id);
    if (!e) return { k: 'unk', t: 'Ei kokeiltu' };
    if (e.k === 'ok') return { k: 'ok', t: `Vastasi ${e.when}` };
    const old = S.sit === 'stale' && e.seed;
    return { k: 'no', old, t: old ? 'Torjuttu 4.10. · 12 pv sitten' : `Torjuttu ${e.when}` };
  }
  if (S.v === 'v2') {
    if (S.running.has(id)) return { k: 'run', t: 'Kokeillaan…' };
    // The newer of a try and the conversations' own outcome wins; a try's ord is its time.
    const r = S.check.res[id], e = lastOutcome(id);
    if (r && (!e || (r.ord || 0) > e.ord)) return r.r === 'ok' ? { k: 'ok', t: `Vastasi kokeiluun ${r.at}`, old: S.check.old && !r.ord } : { k: 'no', t: `Torjuttu kokeilussa ${r.at}`, old: S.check.old && !r.ord };
    if (!e) return { k: 'unk', t: 'Ei kokeiltu', try: true };
    if (e.k === 'ok') return { k: 'ok', t: `Vastasi ${e.when}` };
    return { k: 'no', t: `Torjuttu ${e.when}`, old: S.sit === 'stale' && e.seed };
  }
  if (!S.ent) return { k: 'unk', t: 'Ei tiedossa' };
  return WORKS(id) ? { k: 'ok', t: 'Tililläsi', old: S.ent.old } : { k: 'no', t: 'Ei tililläsi' };
}
const can = (m) => m.k !== 'no' || m.old;
const why = (id) => S.v === 'v3' ? `OpenAI ei tarjoa mallia ${id} tilillesi.` : `OpenAI torjui mallin ${id} tällä ChatGPT-tilillä.`;

// ---------- The picker: one component, four places ----------
const MICON = { ok: ICON_OK, no: ICON_NO, unk: ICON_UNK, run: ICON_SPIN };
function rowHtml(id, scope, cur) {
  const m = mark(id), on = id === cur;
  const tryBtn = S.v === 'v2' && (m.try || m.old) ? `<button type="button" class="md-try" data-m="try:${id}" aria-label="Kokeile mallia ${id}" title="Lähettää yhden lyhyen viestin tililtäsi">Kokeile</button>` : '';
  return `<div class="md-line">${radioHtml(id, scope, on, m)}${tryBtn}</div>`;
}
function radioHtml(id, scope, on, m) {
  return `<button type="button" class="md-row k-${m.k}${m.old ? ' old' : ''}" role="radio" aria-checked="${on}" data-m="pick:${id}"${can(m) ? '' : ` aria-disabled="true" title="${why(id)}"`}>
<span class="md-radio" aria-hidden="true"></span>
<span class="md-nm"><span class="md-t">${NAME[id]}${isNew(id) ? '<span class="md-tag new">Uusi</span>' : ''}${scope !== 'settings' && id === S.def.model ? '<span class="md-tag">oletus</span>' : ''}</span><span class="mono md-id">${id}</span></span>
<span class="md-mk">${MICON[m.k]}<span>${m.t}</span></span></button>`;
}
function srcLine() {
  if (S.v === 'v1') return `<p class="md-src">Merkit tulevat keskusteluistasi: malli, joka on vastannut, ja malli, jonka OpenAI on torjunut. Kokeilematon selviää ensimmäisessä viestissä.</p>`;
  if (S.v === 'v2') {
    return `<p class="md-src">Merkit tulevat keskusteluistasi ja kokeiluista. Kokeile lähettää yhdelle mallille yhden lyhyen viestin tililtäsi ja kuluttaa tilauksen käyttöä; keskustelua ei synny.</p>`;
  }
  return `<div class="md-src"><span>OpenAI:n ilmoittamat mallit tilillesi${S.ent ? ` · haettu ${S.ent.at}` : ''}</span><button type="button" class="md-link" data-m="ent">Päivitä</button></div>`;
}
function banner(scope) {
  const out = []; const b = (kind, html, act = '') => out.push(`<div class="md-ban ${kind}">${kind === 'new' ? ICON_SPARK : ICON_WARN}<div><p>${html}</p>${act}</div></div>`);
  const fam = S.sit === 'new';
  if (S.sit === 'fail') {
    if (S.v === 'v1') b('warn', 'Pi:n malliluetteloa ei saatu: Pi:n kirjautuminen on vanhentunut. Alla ovat vain keskusteluista tutut mallit.', `<button type="button" class="md-btn" data-m="signin">Kirjaudu uudelleen…</button>`);
    if (S.v === 'v2') b('warn', 'Pi:n malliluetteloa ei saatu päivitettyä. Alla on Pi:n viimeksi tallentama luettelo, ja kokeilu ei nyt onnistu: OpenAI ei vastaa.');
    if (S.v === 'v3') b('warn', 'Tilisi malleja ei saatu OpenAI:lta. Alla on Pi:n koko luettelo; käyttöoikeus selviää vasta viestissä.');
  }
  if (S.sit === 'stale') {
    if (S.v === 'v1') b('warn', 'Torjunta on 12 päivän takaa. Tilauksesi on voinut muuttua, joten mallin voi valita ja kokeilla uudelleen.');
    if (S.v === 'v2') b('warn', 'Kokeilut ja torjunta ovat yli viikon takaa. Tilauksesi on voinut muuttua; kokeile mallia uudelleen ennen kuin valitset.');
    if (S.v === 'v3' && S.ent?.old) b('warn', 'Luettelo on haettu 9 päivää sitten.', `<button type="button" class="md-btn" data-m="ent">Päivitä</button>`);
  }
  if (fam) {
    const what = '<span class="mono">gpt-6.2-astra</span> korvaa valinnassa <span class="mono">gpt-6-astran</span>, ja uusi malliperhe <span class="mono">nova</span> on tullut luetteloon';
    if (S.v === 'v1') b('new', `Pi:n luettelo päivittyi: ${what}. Niitä ei ole vielä kokeiltu.`);
    if (S.v === 'v2') b('new', `Pi:n luettelo päivittyi: ${what}. Kokeile ennen kuin valitset, tai valitse ja katso ensimmäisestä viestistä.`);
    if (S.v === 'v3') b('new', 'OpenAI tarjoaa tilillesi uuden mallin <span class="mono">gpt-6.2-astra</span>, joka korvaa valinnassa <span class="mono">gpt-6-astran</span>.');
  }
  if (scope === 'settings' && !can(mark(S.def.model))) b('warn', `Nykyinen oletus <span class="mono">${S.def.model}</span> ei toimi tililläsi. Uudet keskustelut epäonnistuvat, kunnes valitset toisen.`);
  return out.join('');
}
function thinkSeg(scope, cur, model) {
  const ok = levels(model);
  return `<div class="md-think"><span class="md-thl" id="md-th-${scope}">Ajattelutaso</span><div class="md-seg" role="radiogroup" aria-labelledby="md-th-${scope}">${THINK.map(t => `<button type="button" role="radio" aria-checked="${t === cur}" data-m="think:${t}"${ok.includes(t) ? '' : ` aria-disabled="true" title="${model} ei tue tasoa ${t}"`}>${t}</button>`).join('')}</div></div>`;
}
function pickerHtml(scope) {
  const c = CV[UI.sel];
  const cur = scope === 'settings' ? S.def : scope === 'notice' ? { model: S.pick } : c;
  const ids = catalog();
  const offered = newest(ids);
  const shown = S.v === 'v3' && S.ent ? offered.filter(WORKS) : offered;
  const hidden = ids.filter(id => !shown.includes(id));
  const label = S.v === 'v3' && S.ent ? `Muut Pi:n luettelon mallit (${hidden.length}): vanhemmat ja tilillesi tarjoamattomat` : `Vanhemmat mallit (${hidden.length})`;
  const more = hidden.length ? `<details class="md-more"${hidden.includes(cur.model) && scope !== 'notice' ? ' open' : ''}><summary>${CHEV}${label}</summary><div class="md-rows">${hidden.map(id => rowHtml(id, scope, cur.model)).join('')}</div></details>` : '';
  const group = `<div class="md-group"><div class="md-gh"><span>ChatGPT-tilaus</span><span class="mono">openai-codex</span><span class="md-gs">${ICON_OK}Kirjautunut</span></div>${srcLine()}${banner(scope)}<div class="md-rows" role="radiogroup" aria-label="Malli">${shown.map(id => rowHtml(id, scope, cur.model)).join('')}</div>${more}</div>`;
  const others = scope === 'settings' ? `<div class="md-group off"><div class="md-gh"><span>OpenAI API-avain</span><span class="mono">openai</span></div><p class="md-note">Ei avainta. Avaimella OpenAI laskuttaa käytön mukaan, ja mallit tunnistetaan samalla tavalla omana ryhmänään.</p><button type="button" class="md-btn" data-m="toast:Avain lisättäisiin kohdassa Yhteydet; se tallentuu Pi:n omiin tunnuksiin.">Lisää avain…</button></div>
<div class="md-group off"><div class="md-gh"><span>Claude</span><span class="mono">anthropic</span></div><p class="md-note">Claude tulee omana agenttinaan, ei Pi:n mallina. Sen mallit valitaan samalla tavalla kohdassa Asetukset → Agentit.</p></div>` : '';
  const foot = {
    settings: `<p class="md-note">Tallentuu Pi:n omaan oletukseen (<span class="mono">~/.pi/agent/settings.json</span>), joten sama malli on käytössä myös SSH:lla. Avoimet keskustelut eivät vaihdu.</p>`,
    conv: `<p class="md-note">Vaihtuu tässä keskustelussa seuraavasta viestistä, ja vaihto näkyy keskustelussa. Uusien keskustelujen oletus: <span class="mono">${S.def.model} · ${S.def.think}</span> · <button type="button" class="md-link" data-m="settings">Asetukset</button></p>`,
    new: `<p class="md-note">Vain tähän keskusteluun. Oletus: <span class="mono">${S.def.model} · ${S.def.think}</span> · <button type="button" class="md-link" data-m="settings">Asetukset</button></p>`,
    notice: `<label class="md-also"><input type="checkbox" data-m="also"${S.also ? ' checked' : ''}> Tee siitä myös uusien keskustelujen oletus</label><div class="md-acts"><button type="button" class="md-btn quiet" data-m="cancel">Peruuta</button><button type="button" class="md-btn primary" data-m="resend"${S.pick ? '' : ' aria-disabled="true"'}>${S.pick ? `Lähetä uudelleen mallilla <span class="mono">${S.pick}</span>` : 'Valitse malli'}</button></div>`,
  }[scope];
  return `<div class="md-pick" data-scope="${scope}">${group}${scope === 'notice' ? '' : thinkSeg(scope, cur.think, cur.model)}${foot}${others}</div>`;
}

// ---------- Top bar chip and its popover ----------
const libActions = APP.actions;
APP.actions = (c) => {
  const base = libActions(c).replace(/<button class="set-chip"[\s\S]*?<\/button>/, '');
  const cv = CV[c.id];
  if (!cv || cv.fresh || S.settings) return base;
  const m = mark(cv.model), bad = !can(m);
  return `<button class="set-chip md-chip${bad ? ' bad' : ''}" type="button" data-m="pop" aria-haspopup="dialog" aria-expanded="${S.popAt === 'conv'}" title="Malli ja ajattelutaso · vaihda">${bad ? ICON_WARN : ''}<span class="mono">${cv.model}</span><span class="dot" aria-hidden="true">·</span><span>${cv.think}</span>${ICON_DOWN}</button>` + base;
};
const libDetails = window.detailsList;
window.detailsList = (c) => {
  const cv = CV[c.id]; let html = libDetails(c);
  if (!cv || cv.fresh) return html.replace("Pi:n oletus, valitaan ensimmäisellä viestillä", `${cv ? cv.model : S.def.model} · valittu kentästä`);
  return html.replaceAll(MODEL_ID, route(cv.model)).replace(`<dd>${THINKING}</dd>`, `<dd>${cv.think}</dd>`);
};
const pop = document.createElement('div'); pop.className = 'md-pop'; pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-label', 'Malli ja ajattelutaso'); pop.hidden = true; uiMain.appendChild(pop);
function renderPop() {
  pop.hidden = !S.popAt; if (!S.popAt) return;
  pop.classList.toggle('up', S.popAt === 'new');
  pop.innerHTML = `<h3>${S.popAt === 'new' ? 'Uuden keskustelun malli' : 'Tämän keskustelun malli'}</h3>${pickerHtml(S.popAt)}`;
}
function openPop(at) {
  S.popAt = S.popAt === at ? null : at; UI.pop = false; paint(); renderPop();
  if (S.popAt) pop.querySelector('.md-row[aria-checked="true"], .md-row:not([aria-disabled])')?.focus({ preventScroll: true });
}
function closePop(back = true) {
  if (!S.popAt) return; const at = S.popAt; S.popAt = null; renderPop(); paint();
  if (back) document.querySelector(at === 'new' ? '.md-pill' : '.md-chip')?.focus({ preventScroll: true });
}

// ---------- Composer: model pill in a new conversation; sending outside the library's c1 ----------
// A conversation created by the library's + gets its model when first seen; the library paints before drawing it.
function ensure(c) { if (c?.st === 'new' && !CV[c.id]) CV[c.id] = { model: S.def.model, think: S.def.think, fresh: true, log: [] }; return CV[c?.id]; }
function pillBar() {
  const box = comp.querySelector('.cbox'); if (!box) return;
  let bar = box.querySelector('.md-cbar');
  if (!bar) { bar = document.createElement('div'); bar.className = 'md-cbar'; box.appendChild(bar); }
  const cv = ensure(selConv()); const show = !S.settings && cv?.fresh;
  bar.hidden = !show; if (!show) { bar.innerHTML = ''; return; }
  const m = mark(cv.model);
  bar.innerHTML = `<button type="button" class="md-pill" data-m="pill" aria-haspopup="dialog" aria-expanded="${S.popAt === 'new'}" title="Malli ja ajattelutaso tälle keskustelulle"><span class="mono">${cv.model}</span><span class="dot" aria-hidden="true">·</span><span>${cv.think}</span>${ICON_DOWN}</button>${!can(m) ? `<span class="md-pw bad">${ICON_WARN}ei toimi tililläsi</span>` : m.k === 'unk' ? `<span class="md-pw">${m.t.toLowerCase()}</span>` : ''}`;
}
APP.painted.push(pillBar);
const ta = () => comp.querySelector('textarea');
function takeText() { const t = ta().value.trim(); return t; }
function clearText() { C.text = ''; ta().value = ''; fit(ta()); updateComposer(); }
function mine() { const cv = CV[UI.sel]; return cv && !cv.lib && !S.settings; }
comp.addEventListener('click', (e) => {
  if (!e.target.closest('[data-c="send"]') || !mine()) return;
  e.stopImmediatePropagation(); sendHere();
}, true);
comp.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' || e.shiftKey || e.isComposing || !e.target.matches('textarea') || !mine()) return;
  e.preventDefault(); e.stopImmediatePropagation(); sendHere();
}, true);
function sendHere() {
  const text = takeText(); if (!text) return;
  const c = CV[UI.sel], conv = real(UI.sel), t = hhmm();
  if (c.fresh) {
    if (!can(mark(c.model))) { toast(`${why(c.model)} Valitse toinen malli.`); return openPop('new'); }
    c.fresh = false; c.log = [{ k: 'set', model: c.model, think: c.think, time: t }, { k: 'user', md: text, time: t }];
    Object.assign(conv, { title: text.length > 42 ? text.slice(0, 40) + '…' : text });
  } else if (c.log.at(-1)?.k === 'err') {
    toast('Valitse ensin toinen malli. Luonnos säilyy.'); S.notice = true; return redraw();
  } else c.log.push({ k: 'user', md: text, time: t });
  clearText(); startTurn(UI.sel);
}
function startTurn(id) {
  const c = CV[id], token = S.token;
  c.log.push({ k: 'work', model: c.model }); real(id).st = 'working'; S.popAt = null; renderPop(); paint(); redraw(true);
  setTimeout(() => {
    if (token !== S.token) return;
    c.log.pop();
    const ok = WORKS(c.model);
    c.log.push(ok ? { k: 'ok', model: c.model, when: `tänään ${hhmm()}`, time: hhmm(), ord: ++ord, md: replyFor(id) } : { k: 'err', model: c.model, when: `tänään ${hhmm()}`, ord: ++ord });
    real(id).st = 'waiting'; if (!ok) S.notice = false;
    paint(); if (UI.sel === id) redraw(true);
  }, 1500);
}
const replyFor = (id) => id === 'cx'
  ? 'Tässä lyhyet esimerkit eri muodoista:\n\n```python\ndef tervehdi(nimi):\n    return f"Hei, {nimi}!"\n```\n\n```json\n{ "tila": "valmis", "rivit": 3 }\n```\n\n```yaml\ntila: valmis\nrivit: 3\n```'
  : 'Selvä. Katson ensin työtilan rakenteen ja palaan sitten suunnitelman kanssa.';

// ---------- Stage: conversations this round draws, the empty view and the settings page ----------
const libContent = window.content;
window.content = function () {
  if (S.settings) return settingsHtml();
  const c = selConv(); const cv = ensure(c);
  if (!cv || cv.lib) return libContent();
  if (cv.fresh) return emptyView(c, cv);
  return convHtml(cv);
};
function emptyView(c, cv) {
  const m = mark(cv.model);
  const note = !can(m) ? `<p class="md-empty-w">${ICON_WARN}<span><span class="mono">${cv.model}</span> on Pi:n oletus, mutta se ei toimi tililläsi. Valitse kentän mallista toinen.</span></p>`
    : m.k === 'unk' ? `<p class="md-empty-w quiet">${ICON_UNK}<span><span class="mono">${cv.model}</span>: ${m.t.toLowerCase()}. Toimivuus selviää ensimmäisessä viestissä.</span></p>` : '';
  return `<div class="empty-convo"><p class="lead">Uusi keskustelu työtilassa <span class="mono">${esc(c.ws.id)}</span></p><p>Pi käynnistyy, kun lähetät ensimmäisen viestin. Mallin ja ajattelutason voi vaihtaa kentästä.</p>${note}</div>`;
}
function turnHtml(it, i) {
  const head = (sum) => `<div class="rail-cell first"><span class="node head" aria-hidden="true"></span></div><div class="cell"><div class="head-cell"><span class="who">Pi</span><span class="model">${it.model}</span>${sum}</div></div>`;
  if (it.k === 'work') return `<div class="turn md-turn">${head('')}<div class="rail-cell last"><span class="node" aria-hidden="true"></span></div><div class="cell"><div class="strip working"><span class="act"><span class="live-dot"></span>Aloittaa</span></div></div></div>`;
  if (it.k === 'err') return `<div class="turn md-turn">${head('<span class="sum md-err">Ei vastausta · malli ei käytettävissä</span>')}</div>`;
  return `<div class="turn md-turn">${head('<span class="sum">0 ajatusta · 0 työkalua · 0:02</span>')}<div class="rail-cell last"><span class="node done" aria-hidden="true"></span></div><div class="cell"><article class="bubble reply"><div class="bar head"><span class="ok">${ICON_CHECK}Vastaus valmis</span><span class="model">${it.model}</span>${copyBtn('Kopioi vastaus', it.md)}<time class="meta">${it.time}</time></div><div class="prose">${md(it.md)}</div></article></div></div>`;
}
function noticeHtml(c) {
  const failed = c.log.at(-1).model;
  return `<section class="md-notice" aria-labelledby="md-n-h"><h3 id="md-n-h">Valittu kielimalli ei ole käytettävissä</h3><p>OpenAI ei tue mallia <span class="mono">${failed}</span> tällä ChatGPT-tilillä. Kirjautuminen uudelleen ei ratkaise tätä. Valitse toinen malli, niin viestisi lähetetään uudelleen tässä keskustelussa. Kentän luonnos säilyy.</p>${S.notice ? pickerHtml('notice') : `<button type="button" class="md-btn" data-m="notice">Valitse toinen malli</button>`}</section>`;
}
function convHtml(c) {
  const items = c.log.map((it, i) => {
    if (it.k === 'set') return markerR({ t: 'settings', time: it.time, model: route(it.model), thinking: it.think }, i);
    if (it.k === 'chg') return markerR({ t: 'model', time: it.time, from: it.from, to: it.to }, i);
    if (it.k === 'thk') return markerR({ t: 'thinking', time: it.time, from: it.from, to: it.to }, i);
    if (it.k === 'user') return userBubble({ md: it.md, time: it.time }, i);
    return turnHtml(it, i);
  }).join('');
  return `<div class="vwrap md-conv">${items}${c.log.at(-1)?.k === 'err' ? noticeHtml(c) : ''}</div>`;
}
function settingsHtml() {
  const expired = S.v === 'v1' && S.sit === 'fail';
  return `<div class="md-set"><h1>Asetukset</h1><section class="md-sec" aria-labelledby="md-s-a"><h2 id="md-s-a">Agentti · Pi</h2><div class="s-card">
<div class="s-row"><div class="s-lbl"><span class="s-name">Kirjautuminen</span><span class="s-desc">Pi:n omat tunnukset tällä palvelimella.</span></div><div class="s-val">${expired ? `<span class="s-status warn">${ICON_WARN}Vanhentunut</span><button type="button" class="md-btn" data-m="signin">Kirjaudu…</button>` : `<span class="s-status ok">${ICON_OK}ChatGPT-tilaus</span>`}</div></div>
<div class="s-row col"><div class="s-lbl"><span class="s-name">Uusien keskustelujen malli</span><span class="s-desc">Pi:n oletus. Kunkin keskustelun mallin voi vaihtaa sen yläpalkista.</span></div>${pickerHtml('settings')}</div>
</div></section></div>`;
}
function redraw(bottom = false) {
  if (S.settings) { const y = stage.scrollTop; stage.innerHTML = settingsHtml(); stage.scrollTop = y; return; }
  const cv = CV[UI.sel]; if (!cv || cv.lib) return;
  const y = stage.scrollTop; following = false; stage.innerHTML = content();
  stage.scrollTop = bottom ? stage.scrollHeight : y;
}
function redrawAll() { paint(); redraw(); renderPop(); }
// The library's history speaks of gpt-5.5; in this round Status-skripti ran on gpt-6-astra.
new MutationObserver(() => {
  if (UI.sel !== 'c1' || S.settings) return;
  for (const el of stage.querySelectorAll('.model')) if (el.textContent === 'GPT-5.5') el.textContent = 'gpt-6-astra';
  for (const el of stage.querySelectorAll('.mono')) if (el.textContent === MODEL_ID) el.textContent = route('gpt-6-astra');
  for (const el of stage.querySelectorAll(`[data-copy="${MODEL_ID}"]`)) el.dataset.copy = route('gpt-6-astra');
}).observe(stage, { subtree: true, childList: true, characterData: true });

// ---------- Settings ----------
function openSettings() {
  S.settings = true; S.popAt = null; renderPop(); UI.pop = false; UI.drawer = false; paint();
  following = false; stage.innerHTML = settingsHtml(); stage.scrollTop = 0;
  stage.querySelector('.md-pick .md-row[aria-checked="true"], .md-pick .md-row')?.focus({ preventScroll: true });
}
APP.painted.push(() => {
  uiFrame.classList.toggle('is-settings', S.settings);
  if (!S.settings) return;
  uiRail.querySelectorAll('.conv-row[aria-current]').forEach(a => a.removeAttribute('aria-current'));
  uiTop.innerHTML = `<button class="icon-btn menu-btn" type="button" data-ui="drawer" aria-label="Avaa valikko" title="Avaa valikko">${ICON_MENU}</button><div class="tb-title"><strong>Asetukset</strong><span class="tb-ws">Agentti · Pi</span></div>`;
});
window.addEventListener('click', (e) => {
  if (e.target.closest('.proto-picker')) return;
  const p = e.target.closest('[data-p="settings"]');
  if (p) { e.preventDefault(); e.stopPropagation(); document.querySelector('.p-menu')?.setAttribute('hidden', ''); return openSettings(); }
  if (S.settings && e.target.closest('[data-conv], [data-ui="home"], [data-ws-add]')) { S.settings = false; uiFrame.classList.remove('is-settings'); }
  if (S.popAt && !e.target.closest('.md-pop, [data-m="pop"], [data-m="pill"]')) closePop(false);
}, true);

// ---------- Actions ----------
function scopeOf(el) { return el.closest('.md-pick')?.dataset.scope; }
function choose(id, scope) {
  const c = CV[UI.sel];
  if (scope === 'settings') { S.def.model = id; redraw(); toast(`Uudet keskustelut alkavat mallilla ${id}. Pi:n oma oletus päivitettiin.`); }
  else if (scope === 'notice') { S.pick = id; redraw(); }
  else if (scope === 'new') { c.model = id; paint(); renderPop(); redraw(); }
  else if (id !== c.model) {
    const from = c.model; c.model = id;
    if (!c.lib) c.log.push({ k: 'chg', from, to: id, time: hhmm() });
    paint(); renderPop(); redraw(true);
    toast(`Seuraava viesti menee mallille ${id}.`);
  }
  document.querySelector(`.md-pick[data-scope="${scope}"] [data-m="pick:${id}"]`)?.focus({ preventScroll: true });
}
function setThink(t, scope) {
  if (scope === 'settings') { S.def.think = t; redraw(); return toast(`Uusien keskustelujen ajattelutaso: ${t}.`); }
  const c = CV[UI.sel]; if (t === c.think) return;
  const from = c.think; c.think = t;
  if (!c.fresh && !c.lib) c.log.push({ k: 'thk', from, to: t, time: hhmm() });
  paint(); renderPop(); redraw(!c.fresh);
  document.querySelector(`.md-pick[data-scope="${scope}"] [data-m="think:${t}"]`)?.focus({ preventScroll: true });
}
// One model at a time, only when asked; the result is an observation with its time.
function tryOne(id) {
  if (S.running.size) return toast('Yksi kokeilu kerrallaan.');
  const token = S.token; S.running.add(id); redrawAll();
  setTimeout(() => {
    if (token !== S.token) return;
    S.running.delete(id);
    if (S.sit === 'fail') toast('Kokeilu ei onnistunut: OpenAI ei vastannut. Merkki ei muuttunut.');
    else { S.check.res[id] = { r: WORKS(id) ? 'ok' : 'no', at: `tänään ${hhmm()}`, ord: ++ord }; toast(WORKS(id) ? `${id} vastasi. Kokeilu käytti yhden viestin tilauksestasi.` : `OpenAI torjui mallin ${id} tällä tilillä.`); }
    redrawAll();
    document.querySelector(`[data-m="pick:${id}"]`)?.focus({ preventScroll: true });
  }, 1400);
}
function refreshEnt() {
  if (S.sit === 'fail') return toast('OpenAI ei vastannut. Näytetään yhä Pi:n koko luettelo.');
  S.ent = { at: `tänään ${hhmm()}`, old: false }; redrawAll(); toast('Tilisi mallit haettiin OpenAI:lta.');
}
function resend() {
  const c = CV[UI.sel]; const id = S.pick; if (!id) return;
  const from = c.model; c.model = id;
  const last = [...c.log].reverse().find(x => x.k === 'user');
  if (S.also) S.def.model = id;
  c.log.push({ k: 'chg', from, to: id, time: hhmm() }, { k: 'user', md: last.md, time: hhmm() });
  S.pick = null; S.notice = false;
  startTurn(UI.sel);
  if (S.also) toast(`Myös uudet keskustelut alkavat nyt mallilla ${id}.`);
}
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-m]'); if (!b || b.closest('.proto-picker')) return;
  const [act, arg] = b.dataset.m.split(/:(.*)/s);
  if (act === 'also') { S.also = b.checked; return; }
  e.preventDefault(); e.stopPropagation();
  if (b.getAttribute('aria-disabled') === 'true') { if (act === 'pick') toast(why(arg)); return; }
  const scope = scopeOf(b);
  if (act === 'pop') return openPop('conv');
  if (act === 'pill') return openPop('new');
  if (act === 'pick') return choose(arg, scope);
  if (act === 'think') return setThink(arg, scope);
  if (act === 'try') return tryOne(arg);
  if (act === 'ent') return refreshEnt();
  if (act === 'settings') return openSettings();
  if (act === 'notice') { S.notice = true; redraw(true); return stage.querySelector('.md-notice .md-row:not([aria-disabled])')?.focus({ preventScroll: true }); }
  if (act === 'cancel') { S.notice = false; S.pick = null; return redraw(); }
  if (act === 'resend') return resend();
  if (act === 'signin') return toast('Pi:n laitekoodikirjautuminen alkaisi (Asetukset → Yhteydet).');
  if (act === 'toast') return toast(arg);
});
// Arrow keys move within a radio group; Escape closes the popover.
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && S.popAt) { e.stopPropagation(); return closePop(); }
  const r = e.target.closest?.('.md-pick [role="radio"]'); if (!r) return;
  const n = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 0; if (!n) return;
  const all = [...r.closest('[role="radiogroup"]').querySelectorAll('[role="radio"]:not([aria-disabled])')];
  const i = all.indexOf(r); if (i < 0) return;
  e.preventDefault(); all[(i + n + all.length) % all.length].focus();
}, true);

// ---------- Page bar: the prototype's situation control ----------
document.querySelector('.page-bar .hint').insertAdjacentHTML('beforebegin', `<label title="Vedoksen ohjain: tunnistuksen tilanteet">Tilanne <select id="md-sit"><option value="ok">Tavallinen</option><option value="fail">Tunnistus epäonnistui</option><option value="stale">Tieto vanhentunut</option><option value="new">Uusi malliperhe</option></select></label>`);
document.getElementById('md-sit').addEventListener('change', (e) => {
  S.sit = e.target.value; S.running = new Set(); S.token++; seedKnowledge(); redrawAll();
});

// ---------- Directions: each opens on the refused conversation with the choice open ----------
const show = (v) => () => {
  S.v = v; seed(); UI.pop = false; UI.drawer = false; UI.sel = 'cx'; paint(); renderPop();
  return content();
};
window.v1 = show('v1'); window.v2 = show('v2'); window.v3 = show('v3');
})();
