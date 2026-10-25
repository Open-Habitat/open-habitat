(() => {
  // Synthetic context state of the open conversation. Pi's own rules drive the behaviour:
  // its footer warns above 70 % and errs above 90 %, and auto-compaction starts when
  // tokens > contextWindow - reserveTokens (default 16 384). Right after a compaction Pi's
  // getContextUsage() returns tokens = null until the next assistant reply.
  const RESERVE = 16384;
  const MODELS = {codex: {id: 'gpt-5.5', window: 272000}, big: {id: 'claude-opus-5-5', window: 1000000}};
  const SCENES = {
    start: ['Alussa', {tokens: 11800}],
    mid: ['Keskellä', {tokens: 92400}],
    near: ['Lähellä rajaa', {tokens: 205300}],
    limit: ['Rajalla', {tokens: 249600}],
    compacting: ['Tiivistää', {tokens: 257100, phase: 'compacting'}],
    after: ['Juuri tiivistetty', {tokens: null, before: 257100, phase: 'after'}],
    settled: ['Tiivistyksen jälkeen', {tokens: 31600}],
    big: ['1M-ikkuna', {tokens: 412000, model: 'big'}],
    bignear: ['1M-ikkuna, rajalla', {tokens: 941000, model: 'big'}],
    nowindow: ['Ikkunan koko ei tiedossa', {tokens: 92400, window: 0}],
    noauto: ['Automaattinen tiivistys pois', {tokens: 249600, auto: false}],
    fresh: ['Ei vielä vastausta', {tokens: null, phase: 'fresh'}],
  };
  const CTX = {};
  let variant = 'ring', scene = 'mid', serial = 0, lastLevel = '', open = false;

  function setScene(name) {
    const s = SCENES[name][1]; const m = MODELS[s.model ?? 'codex'];
    Object.assign(CTX, {model: m.id, window: s.window ?? m.window, tokens: s.tokens, phase: s.phase ?? 'known', before: s.before ?? null, auto: s.auto ?? true});
  }
  function info() {
    const w = CTX.window, t = CTX.tokens;
    const pct = w > 0 && t != null ? t / w * 100 : null;
    const at = w > 0 && CTX.auto ? (w - RESERVE) / w * 100 : null;
    const level = CTX.phase !== 'known' ? CTX.phase : !(w > 0) ? 'nowindow' : pct >= 90 ? 'critical' : pct >= 70 ? 'near' : 'ok';
    return {w, t, pct, at, level};
  }
  const nb = ' ';
  const full = (n) => n.toLocaleString('fi-FI');
  const kt = (n) => n >= 1e6 ? `${(n / 1e6).toLocaleString('fi-FI', {maximumFractionDigits: 2})}M` : n >= 1000 ? `${Math.round(n / 1000)}k` : String(n);
  const pc = (p) => `${p > 0 && p < 1 ? '<1' : Math.round(p)}${nb}%`;
  const shown = (i) => i.level !== 'fresh' && UI.sel === 'c1';

  // One sentence per state: the accessible name, the tooltip and the popover lead.
  function sentence(i) {
    if (i.level === 'fresh') return 'Kontekstin käyttö näkyy Pi:n ensimmäisen vastauksen jälkeen.';
    if (i.level === 'compacting') return 'Pi tiivistää vanhempaa historiaa yhteenvedoksi. Keskustelu jatkuu, kun tiivistys valmistuu.';
    if (i.level === 'after') return `Historia tiivistettiin (ennen ${full(CTX.before)} tokenia). Uusi luku tulee Pi:n seuraavasta vastauksesta.`;
    if (i.level === 'nowindow') return `${full(i.t)} tokenia käytössä. Mallin kontekstin kokoa ei tiedetä, joten osuutta ei voi laskea.`;
    return `Konteksti ${pc(i.pct)}: ${full(i.t)} / ${full(i.w)} tokenia. ` + (i.at ? `Pi tiivistää vanhemman historian, kun noin ${pc(i.at)} täyttyy.` : 'Automaattinen tiivistys on pois päältä.');
  }
  const attrs = (i, cls) => `type="button" class="ctx-ind ${cls}" data-ctx data-level="${i.level}" aria-haspopup="dialog" aria-expanded="${open}" aria-label="${sentence(i)} Avaa kontekstin tiedot." title="${sentence(i)}"`;
  const style = (i) => `style="--fill:${i.pct != null ? Math.min(100, i.pct).toFixed(1) : 0}%;--at:${i.at != null ? i.at.toFixed(1) : 100}%"`;

  // ---------- 1 Rengas: ring and percentage beside the model chip ----------
  function ringSvg(i) {
    const p = (r, deg) => { const a = (deg - 90) * Math.PI / 180; return [(10 + r * Math.cos(a)).toFixed(2), (10 + r * Math.sin(a)).toFixed(2)]; };
    const arc = i.level === 'compacting' ? '<circle class="arc spin" cx="10" cy="10" r="7" pathLength="100" stroke-dasharray="28 100"/>'
      : i.pct != null ? `<circle class="arc" cx="10" cy="10" r="7" pathLength="100" stroke-dasharray="${Math.min(100, i.pct).toFixed(1)} 100" transform="rotate(-90 10 10)"/>` : '';
    let tick = '';
    if (i.at != null && i.level !== 'after' && i.level !== 'compacting') { const [x1, y1] = p(4.6, i.at * 3.6), [x2, y2] = p(9.4, i.at * 3.6); tick = `<line class="tick" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`; }
    return `<svg class="ctx-ring" viewBox="0 0 20 20" aria-hidden="true"><circle class="trk" cx="10" cy="10" r="7"/>${arc}${tick}</svg>`;
  }
  function ringText(i) {
    if (i.level === 'compacting') return 'Tiivistää';
    if (i.level === 'after') return '?';
    if (i.level === 'nowindow') return kt(i.t);
    return pc(i.pct);
  }
  const ringBtn = (i) => `<button ${attrs(i, 'ctx-ringbtn')}>${ringSvg(i)}<span class="ctx-val">${ringText(i)}</span></button>`;

  // ---------- 2 Sirussa: the model chip carries the number and fills up ----------
  function chipVal(i) {
    if (i.level === 'compacting') return 'tiivistää…';
    if (i.level === 'after') return 'tiivistetty';
    if (i.level === 'nowindow') return kt(i.t);
    return pc(i.pct);
  }
  const chipBtn = (i) => i.level === 'fresh'
    ? `<button class="set-chip" type="button" data-ui="info" title="Malli ja ajattelutaso · avaa tiedot"><span class="mono">${CTX.model}</span><span class="dot" aria-hidden="true">·</span><span>${THINKING}</span></button>`
    : `<button ${attrs(i, 'set-chip ctx-chip')} ${style(i)}><span class="mono">${CTX.model}</span><span class="dot" aria-hidden="true">·</span><span>${THINKING}</span><span class="dot" aria-hidden="true">·</span><span class="ctx-val">${chipVal(i)}</span></button>`;

  // ---------- 3 Kentässä: fill line on the field's top edge, tokens below ----------
  function fieldText(i) {
    if (i.level === 'compacting') return 'Pi tiivistää historiaa…';
    if (i.level === 'after') return `Tiivistetty ${kt(CTX.before)} → ? · luku päivittyy seuraavasta vastauksesta`;
    if (i.level === 'nowindow') return `${kt(i.t)} tokenia · koko ei tiedossa`;
    const base = `${kt(i.t)} / ${kt(i.w)}`;
    return i.level === 'ok' ? base : `${base} · ${i.at ? `tiivistys ~${pc(i.at)}` : 'ei automaattista tiivistystä'}`;
  }
  const fieldLine = (i) => `<div class="ctx-line" data-level="${i.level}" ${style(i)} aria-hidden="true"><i></i>${i.at != null && i.level !== 'after' ? '<b></b>' : ''}</div>`;

  // ---------- 4 Sanoin: quiet text under the field, a sentence near the limit ----------
  function wordsText(i) {
    if (i.level === 'compacting') return 'Pi tiivistää vanhempaa historiaa yhteenvedoksi…';
    if (i.level === 'after') return `Historia tiivistetty (${kt(CTX.before)} → ?)<span class="long"> · uusi luku Pi:n seuraavasta vastauksesta</span>`;
    if (i.level === 'nowindow') return `${kt(i.t)} tokenia<span class="long"> · mallin kontekstin kokoa ei tiedetä</span>`;
    const head = `Konteksti ${pc(i.pct)}`;
    if (i.level === 'ok') return head;
    if (!i.at) return `${head} · automaattinen tiivistys pois päältä`;
    if (i.level === 'near') return `${head}<span class="long"> · Pi tiivistää vanhemman historian noin ${pc(i.at)}:ssa</span>`;
    return `${head} · tiivistys alkaa pian<span class="long">, vanhempi historia korvautuu yhteenvedolla</span>`;
  }

  // ---------- Placement ----------
  APP.actions = (c) => {
    const i = info();
    let html = topActions(c).replace('>gpt-5.5<', `>${CTX.model}<`);
    if (c.id !== 'c1') return html;
    if (variant === 'ring' && shown(i)) html = ringBtn(i) + html;
    if (variant === 'chip') html = html.replace(/<button class="set-chip"[\s\S]*?<\/button>/, chipBtn(i));
    return html;
  };
  function paintRow() {
    const wrap = document.querySelector('.composer .cwrap'); if (!wrap) return;
    let row = wrap.querySelector('.ctx-row');
    if (!row) { row = document.createElement('div'); row.className = 'ctx-row'; wrap.append(row); }
    const box = wrap.querySelector('.cbox'); box.querySelector('.ctx-line')?.remove();
    const i = info(); const here = (variant === 'field' || variant === 'words') && shown(i);
    row.hidden = !here; row.dataset.variant = variant;
    if (!here) { row.innerHTML = ''; return; }
    if (variant === 'field') box.insertAdjacentHTML('afterbegin', fieldLine(i));
    row.innerHTML = `<button ${attrs(i, 'ctx-text')}>${variant === 'field' ? fieldText(i) : wordsText(i)}</button>`;
  }
  APP.painted.push(paintRow);

  // ---------- Popover: where the detailed status (proto-context-detail) would open ----------
  const pop = document.createElement('div'); pop.className = 'popover ctx-pop'; pop.hidden = true;
  pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-labelledby', 'ctx-pop-title'); uiMain.appendChild(pop);
  function paintPopover() {
    const i = info(); pop.hidden = !open || !shown(i); if (pop.hidden) return;
    const meter = i.pct != null ? `<div class="ctx-meter" data-level="${i.level}" ${style(i)} aria-hidden="true"><i></i>${i.at != null ? '<b></b>' : ''}</div>` : '';
    const head = i.pct != null ? `${pc(i.pct)} <span>${full(i.t)} / ${full(i.w)} tokenia</span>` : i.level === 'nowindow' ? `${full(i.t)} <span>tokenia</span>` : i.level === 'compacting' ? 'Tiivistää…' : '? <span>tokenia</span>';
    pop.dataset.level = i.level;
    pop.innerHTML = `<h3 id="ctx-pop-title" tabindex="-1">Konteksti</h3><p class="ctx-big">${head}</p>${meter}<p class="ctx-lead">${sentence(i)}</p>
<dl class="facts"><dt>Malli</dt><dd><span class="mono">${CTX.model}</span></dd><dt>Ikkuna</dt><dd>${i.w > 0 ? `${full(i.w)} tokenia` : '<span class="sub">ei tiedossa</span>'}</dd><dt>Tiivistys</dt><dd>${!CTX.auto ? 'Automaattinen pois päältä' : i.w > 0 ? `Automaattinen, kun yli ${full(i.w - RESERVE)} tokenia` : 'Automaattinen'}</dd></dl>
<p class="ctx-next">Tähän avautuu tarkempi tila: mistä konteksti koostuu, tiivistysten historia ja vuorokohtaiset tokenit. Se on seuraavan kierroksen aihe.</p>`;
    const t = document.querySelector('[data-ctx]'); const m = uiMain.getBoundingClientRect();
    if (t && (variant === 'field' || variant === 'words')) { pop.style.top = 'auto'; pop.style.bottom = `${Math.round(m.bottom - t.getBoundingClientRect().top + 8)}px`; pop.style.transformOrigin = 'bottom right'; }
    else { pop.style.top = ''; pop.style.bottom = ''; pop.style.transformOrigin = ''; }
  }
  APP.painted.push(paintPopover);
  function closePop(back) { if (!open) return; open = false; paint(); if (back) document.querySelector('[data-ctx]')?.focus(); }
  document.addEventListener('click', (e) => {
    if (e.target.closest('.proto-picker')) return;
    const t = e.target.closest('[data-ctx]');
    if (t) { e.preventDefault(); e.stopPropagation(); open = !open; UI.pop = false; paint(); if (open) pop.querySelector('h3')?.focus(); else document.querySelector('[data-ctx]')?.focus(); return; }
    if (open && !e.target.closest('.ctx-pop')) closePop(false);
  }, true);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && open) { e.stopImmediatePropagation(); closePop(true); } }, true);

  // ---------- Lab controls ----------
  const controls = document.createElement('section');
  controls.className = 'ctx-controls'; controls.setAttribute('aria-label', 'Prototyypin tilanteet');
  controls.innerHTML = `<label>Tilanne <select id="ctx-scene">${Object.entries(SCENES).map(([k, [l]]) => `<option value="${k}"${k === scene ? ' selected' : ''}>${l}</option>`).join('')}</select></label><button type="button" id="ctx-play">Toista kasvu ja tiivistys</button><p>Synteettiset luvut. Pi:n omat rajat: varoitus yli 70 %, virhe yli 90 %, automaattinen tiivistys, kun ikkunasta on jäljellä alle 16 384 tokenia (272k-ikkunassa ~94 %).</p><p id="ctx-announce" class="ctx-announce" role="status" aria-live="polite"></p>`;
  document.querySelector('.frame-wrap').before(controls);
  const announceEl = controls.querySelector('#ctx-announce');
  function announce() {
    const i = info(); if (i.level === lastLevel) return;
    const prev = lastLevel; lastLevel = i.level;
    // Only changes that matter are spoken: approaching the limit, compaction and its end.
    if (prev && (['near', 'critical', 'compacting', 'after'].includes(i.level) || prev === 'after')) announceEl.textContent = sentence(i);
  }
  function update() { paint(); announce(); }
  controls.querySelector('#ctx-scene').addEventListener('change', (e) => { serial++; scene = e.target.value; setScene(scene); update(); });
  controls.querySelector('#ctx-play').addEventListener('click', () => {
    const id = ++serial; setScene('mid'); CTX.tokens = 188000; update();
    const steps = [[205300, 900], [221000, 900], [238400, 900], [249600, 900], [256200, 900], ['compacting', 2000], ['after', 2200], [31600, 0]];
    let k = 0;
    const next = () => {
      if (id !== serial || k >= steps.length) return;
      const [v, hold] = steps[k++];
      if (v === 'compacting') { CTX.phase = 'compacting'; CTX.tokens = 257100; }
      else if (v === 'after') { CTX.phase = 'after'; CTX.before = 257100; CTX.tokens = null; }
      else { CTX.phase = 'known'; CTX.tokens = v; }
      update(); setTimeout(next, hold);
    };
    setTimeout(next, 900);
  });

  function start(v) {
    serial++; variant = v; open = false; UI.sel = 'c1'; setScene(scene); lastLevel = info().level;
    const html = appView(); return html;
  }
  window.ctxRing = () => start('ring');
  window.ctxChip = () => start('chip');
  window.ctxField = () => start('field');
  window.ctxWords = () => start('words');
  setScene(scene);
})();
