// Kierros 16.10.2026: epäonnistunut bash-kortti. Natiivi fakta on Pi:n `isError` ja
// tuloksen lopussa Pi:n oma tilarivi; `fail` kuvaa sen (paluuarvo tai aikakatkaisu).
// Suunnat vaihtavat vain epäonnistuneen kortin piirron; muu on kirjaston.
(() => {
const F = { dir: 1 };
const ICON_FAIL = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3 3l6 6M9 3 3 9" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';

// ---------- Content: two failures in history, one in the live turn ----------
// Pi stores the command's output and appends its own status line after an empty line.
const piLine = (f) => f.timeout ? `Command timed out after ${f.timeout} seconds` : `Command exited with code ${f.exit}`;
const cause = (f) => f.timeout ? `aikakatkaisu ${f.timeout} s` : `paluuarvo ${f.exit}`;
const turnAt = (time) => CONVO.find(m => m.kind === 'turn' && m.time === time);
{
  const t = turnAt('14:32');
  t.blocks.splice(1, 0,
    { t: 'tool', name: 'bash', target: 'python3 scripts/status_rows.py --since 2026-10-1', args: { command: 'python3 scripts/status_rows.py --since 2026-10-1' }, fail: { exit: 2 },
      result: "usage: status_rows.py [-h] [--since SINCE]\nstatus_rows.py: error: argument --since: invalid fromisoformat value: '2026-10-1'" },
    { t: 'think', md: '**Using a zero-padded date for the check**' });
  const u = turnAt('14:34');
  const retry = (n) => `WARNING: Retrying (Retry(total=${n}, connect=None, read=None, redirect=None, status=None)) after connection broken by 'NewConnectionError('<pip._vendor.urllib3.connection.HTTPSConnection object at 0x7f3c2a1b5e50>: Failed to establish a new connection: [Errno 101] Network is unreachable')': /simple/tabulate/`;
  u.blocks.splice(1, 0,
    { t: 'tool', name: 'bash', target: 'python3 -m pip download tabulate --no-deps -d /var/tmp/tabulate-check', args: { command: 'python3 -m pip download tabulate --no-deps -d /var/tmp/tabulate-check' }, fail: { timeout: 30 },
      result: [4, 3, 2].map(retry).join('\n') },
    { t: 'think', md: '**No network here; formatting the table by hand**' });
}
// The live pytest run has one failing test, so Pi reports the call as failed (exit code 1).
const libScript = script;
script = function () {
  return libScript().map(([t, fn]) => [t, (S) => fn(new Proxy(S, { get: (o, k) => k !== 'set' ? o[k]
    : (id, d) => o.set(id, id === 't1' && d.state === 'done' ? { state: 'failed', fail: { exit: 1 } } : d) }))]);
};

// ---------- The failed card, per direction ----------
const lines = (out, f) => F.dir === 1 ? [...out, '', piLine(f)] : out;
const lastLine = (out) => [...out].reverse().find(l => l.trim()) ?? '';
const mark = (f) => F.dir === 1
  ? `<span class="fail-st" title="Pi: ${esc(piLine(f))}">${ICON_FAIL}epäonnistui</span>`
  : `<span class="fail-st" title="Pi: ${esc(piLine(f))}">${ICON_FAIL}${cause(f)}</span>`;
const tail = (out) => F.dir === 3 && lastLine(out) ? `<div class="f-tail" aria-hidden="true">${esc(lastLine(out))}</div>` : '';
const card = (i, disc, out, body) => `<section class="tool failed f${F.dir}${i === null ? '"' : ` ah-in" style="--i:${i}"`}>${disc}${tail(out)}${body}</section>`;

const libToolRow = toolRow;
toolRow = function (b, i) {
  if (!b.fail) return libToolRow(b, i);
  const id = nid(); const out = b.result.split('\n');
  const body = `<div class="tool-body">${cmdRivi(b)}${xbox(`h:${b.args.command}`, lines(out, b.fail), { name: 'bash', target: b.target, copyLabel: 'Kopioi tuloste' })}</div>`;
  return card(i, `<button class="disc" type="button" aria-expanded="false" aria-controls="${id}">${CHEV}<span class="names"><span class="name">bash</span><span class="target">${esc(b.target)}</span></span>${mark(b.fail)}</button>`, out, `<div id="${id}" hidden>${body}</div>`);
};
const libLiveToolRow = liveToolRow;
liveToolRow = function (b) {
  if (b.state !== 'failed') return libLiveToolRow(b);
  const id = `live-${b.id}`;
  const body = b.expanded ? `<div class="tool-body">${currentR.cmd(b)}${box(lines(b.out, b.fail), outView(b), 'out', b, false)}</div>` : '';
  return card(null, `<button class="disc" type="button" aria-expanded="${b.expanded}" aria-controls="${id}">${CHEV}<span class="names"><span class="name">${esc(b.name)}</span><span class="target">${esc(b.target)}</span></span>${mark(b.fail)}</button>`, b.out, `<div id="${id}"${b.expanded ? '' : ' hidden'}>${body}</div>`);
};

// ---------- Shared: the thread summary counts failures (all directions) ----------
// With the work hidden, the summary is the only place a failure shows before opening.
new MutationObserver(() => {
  for (const t of stage.querySelectorAll('.turn')) {
    const n = t.querySelectorAll('.tool.failed').length; const s = t.querySelector('.head-cell .sum');
    if (!n || !s || s.querySelector('.sum-fail')) continue;
    s.innerHTML = s.innerHTML.replace(/(\d+ työkalua)/, `$1 · <span class="sum-fail">${n} epäonnistui</span>`);
  }
}).observe(stage, { subtree: true, childList: true, characterData: true });

const view = (d) => () => { F.dir = d; return appView(); };
window.v1 = view(1); window.v2 = view(2); window.v3 = view(3);
})();
