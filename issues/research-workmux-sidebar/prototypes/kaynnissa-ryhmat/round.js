// Round 1 (research-workmux-sidebar): how a long Käynnissä list is organised when a stint runs
// eight workers in one workspace. Ideas from workmux's sidebar (report.md §1.4): group_by
// project, collapse_stale, dormant groups under a rule, "never hide where you are", ↓ N more.
//
// The directions differ on one axis: where live rows are grouped.
//   1 Ryhmät        — inside Käynnissä, one header per workspace with its count; the workspace
//                     leaves the row's second line; quiet rows fold per group; all-quiet
//                     workspaces sink under Hiljaiset as one row each.
//   2 Kooste        — Käynnissä stays flat, but a workspace's workers become one summary row
//                     ("8 workeria") that opens in place; conversations stay rows.
//   3 Työtiloissa   — no Käynnissä section: live rows sit under their workspace in the
//                     alphabetical workspace list; quiet ones fold.
// The same in all three: Sinun vuorosi, the time on every row, the current conversation never
// folded away, ↓ N lisää at the bottom of the rail when rows are below the fold.
const { IC, esc, WS, S, ago, quiet, row, mark, wsHint, isYours, convs } = F;
const NAMES = ['Ryhmät', 'Kooste', 'Työtiloissa'];
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const keep = (c) => c.id === S.cur; // the current conversation is never folded away
function toggle(key, label, n, extra = '') {
  const openNow = !!S.open[key];
  return `<li><button type="button" class="fold${extra}" data-act="fold" data-key="${esc(key)}" aria-expanded="${openNow}" data-testid="fold-${esc(key)}">
    <span class="chev" aria-hidden="true">${openNow ? IC.down : IC.right}</span><span class="fl">${esc(label)}</span><span class="count">${n}</span></button></li>`;
}

// 1 Ryhmät
function grouped(list) {
  const total = list.length;
  const groups = WS.map(ws => ({ ws, rows: list.filter(c => c.ws === ws) })).filter(g => g.rows.length);
  const live = groups.filter(g => g.rows.some(c => !quiet(c) || keep(c)));
  const dormant = groups.filter(g => !live.includes(g));
  const part = (g) => {
    const shown = g.rows.filter(c => !quiet(c) || keep(c));
    const hidden = g.rows.filter(c => quiet(c) && !keep(c));
    const key = 'q:' + g.ws;
    return `<div class="grp" data-testid="group-${g.ws}"><h3 class="grp-head">${esc(g.ws)}<span class="count">${g.rows.length}</span></h3>
      <ul>${shown.map(c => row(c, { ws: false })).join('')}
      ${hidden.length ? toggle(key, plural(hidden.length, 'hiljainen', 'hiljaista'), '', ' quietfold') : ''}
      ${hidden.length && S.open[key] ? hidden.map(c => row(c, { ws: false, one: true })).join('') : ''}</ul></div>`;
  };
  const sleeper = (g) => {
    const key = 'd:' + g.ws;
    return `${toggle(key, g.ws, g.rows.length, ' dormant')}${S.open[key] ? g.rows.map(c => row(c, { ws: false, one: true })).join('') : ''}`;
  };
  return `<section class="now" data-testid="rail-running" aria-label="Käynnissä"><h2 class="sec-head">Käynnissä${total ? `<span class="count">${total}</span>` : ''}</h2>
    ${total ? live.map(part).join('') : '<p class="empty">Mikään ei ole käynnissä.</p>'}
    ${dormant.length ? `<p class="rule" data-testid="rule-quiet"><span>Hiljaiset · yli tunnin</span></p><ul>${dormant.map(sleeper).join('')}</ul>` : ''}</section>`;
}

// 2 Kooste
function summary(list) {
  const total = list.length;
  const out = [];
  const done = new Set();
  for (const c of list) {
    if (!c.worker) { out.push(row(c)); continue; }
    if (done.has(c.ws)) continue;
    done.add(c.ws);
    const ws = list.filter(x => x.worker && x.ws === c.ws);
    const key = 'w:' + c.ws;
    const openNow = !!S.open[key];
    const working = ws.filter(x => x.kind === 'working').length;
    const still = ws.length - working;
    const latest = Math.min(...ws.map(x => x.t));
    const det = [c.ws, working ? `${working} työskentelee` : null, still ? `${still} odottaa viestiä` : null].filter(Boolean).join(' · ');
    out.push(`<li><button type="button" class="row sum" data-act="fold" data-key="${key}" aria-expanded="${openNow}" data-testid="fold-${key}" title="${esc(det)}">
      ${mark(working ? 'working' : 'waiting')}<span class="txt"><span class="ttl">${plural(ws.length, 'worker', 'workeria')}</span><span class="det">${esc(det)}</span></span>
      <span class="chev" aria-hidden="true">${openNow ? IC.down : IC.right}</span><time>${ago(latest)}</time></button></li>`);
    const inner = openNow ? ws : ws.filter(keep);
    if (inner.length) out.push(`<li><ul class="nest">${inner.map(x => row(x, { ws: false })).join('')}</ul></li>`);
  }
  return `<section class="now" data-testid="rail-running" aria-label="Käynnissä"><h2 class="sec-head">Käynnissä${total ? `<span class="count">${total}</span>` : ''}</h2>
    ${total ? `<ul>${out.join('')}</ul>` : '<p class="empty">Mikään ei ole käynnissä.</p>'}</section>`;
}

// 3 Työtiloissa
function underWorkspaces() {
  const live = convs().filter(c => !isYours(c));
  return `<section class="ws-list" aria-label="Työtilat" data-testid="rail-workspaces"><h2 class="sec-head">Työtilat</h2><ul>${WS.map(ws => {
    const rows = live.filter(c => c.ws === ws);
    const shown = rows.filter(c => !quiet(c) || keep(c));
    const hidden = rows.filter(c => quiet(c) && !keep(c));
    const key = 'u:' + ws;
    const y = convs().filter(c => c.ws === ws && isYours(c)).length;
    return `<li class="ws-item" data-testid="group-${ws}"><button type="button" class="ws-row" data-ws="${ws}">${IC.folder}<span class="nm">${ws}</span>${y ? `<span class="count attn" title="${y} odottaa sinua">${y}</span>` : ''}</button>
      ${rows.length ? `<ul class="nest">${shown.map(c => row(c, { one: true })).join('')}
        ${hidden.length ? toggle(key, plural(hidden.length, 'hiljainen', 'hiljaista'), '', ' quietfold') : ''}
        ${hidden.length && S.open[key] ? hidden.map(c => row(c, { one: true })).join('') : ''}</ul>` : ''}</li>`;
  }).join('')}</ul></section>`;
}

// ↓ N lisää: rows below the visible part of the rail. A button: it scrolls most of a screen down.
function below() {
  const sc = document.querySelector('[data-testid="rail-scroll"]');
  if (!sc) return [];
  const bottom = sc.getBoundingClientRect().bottom - 28;
  return [...sc.querySelectorAll('.row, .fold, .ws-row')].filter(r => r.getBoundingClientRect().top >= bottom);
}
function updateMore() {
  const el = document.querySelector('[data-testid="more"]');
  if (!el) return;
  const n = below().length;
  el.hidden = !n;
  el.querySelector('.n').textContent = n;
  el.setAttribute('aria-label', `${n} riviä alempana, vieritä`);
}
document.addEventListener('scroll', (e) => { if (e.target?.dataset?.testid === 'rail-scroll') updateMore(); }, true);
window.addEventListener('resize', updateMore);

F.hooks = {
  running: (list) => S.v === 0 ? grouped(list) : S.v === 1 ? summary(list) : '',
  workspaces: () => S.v === 2 ? underWorkspaces() : F.plainWorkspaces(),
  railEnd: () => `<button type="button" class="more" data-act="more" data-testid="more" hidden>${IC.down}<span class="n">0</span> lisää</button>`,
  after: updateMore,
  click: (t, a) => {
    if (a === 'fold') { const k = t.dataset.key; S.open[k] = !S.open[k]; F.repaint(`[data-key="${k}"]`); }
    else if (a === 'more') { const sc = document.querySelector('[data-testid="rail-scroll"]'); sc.scrollBy({ top: sc.clientHeight * 0.7 }); updateMore(); }
  },
};
const variants = F.setup(NAMES);
