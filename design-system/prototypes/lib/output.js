// Tulosteen ja komennon laatikot (valittu kierroksilla 5 ja 6).
// The own window is offered for every long output (Jari 13.10.2026); the earlier forty-line threshold hid it.
const liveCaret = (b) => b.state === 'running' ? '<span class="caret"></span>' : '';
const lineText = (lines) => esc(lines.join('\n'));
const rivit = (n) => `${n} riviä`;
function outMeta(b, parts) { return `<div class="out-meta">${parts.filter(Boolean).join('')}</div>`; }
function openDialog(b, lines = b.out) {
  const dlg = document.getElementById('outdlg');
  dlg.innerHTML = `<div class="dlg-head"><span class="name">${esc(b.name)}</span><span class="target">${esc(b.target)}</span>${copyBtn('Kopioi', lines.join('\n'))}<button class="quiet-btn" type="button" data-close>Sulje</button></div><div class="dlg-body"><pre>${lines.map((l, i) => `<code><span class="lineno">${i + 1}</span>${/FAILED|Error/.test(l) ? `<span class="fail">${esc(l)}</span>` : esc(l) || ' '}</code>`).join('')}</pre></div>`;
  dlg.showModal();
}
document.getElementById('outdlg').addEventListener('click', (e) => { const d = e.currentTarget; if (e.target.closest('[data-close]') || e.target === d) d.close(); });

// One box for any run of lines: edges (head + tail), start, end, all; a side rail of jump buttons.
function box(lines, view, kind, b, live, cls) {
  const n = lines.length; const long = n > 10; const pre = `viewport${cls ? ' ' + cls : ''}`;
  const act = (a, label, icon, pressed) => `<button class="icon-btn" type="button" data-act="${a}" data-for="${kind}" aria-label="${label}" title="${label}" aria-pressed="${pressed}">${icon}</button>`;
  let body;
  if (!long || view === 'all') body = `<pre class="${pre} all${live ? ' stream' : ''}">${lineText(lines)}${live ? '<span class="caret"></span>' : ''}</pre>`;
  else if (view === 'edges') body = `<div><pre class="${pre} part head">${lineText(lines.slice(0, 3))}</pre><button class="gap" type="button" data-act="all" data-for="${kind}">${n - 10} riviä välistä · Näytä kaikki</button><pre class="${pre} part tail${live ? ' stream' : ''}">${lineText(lines.slice(-7))}${live ? '<span class="caret"></span>' : ''}</pre></div>`;
  else body = `<pre class="${pre}${live ? ' stream' : ''}" data-scroll="${view}">${lineText(lines)}${live ? '<span class="caret"></span>' : ''}</pre>`;
  const rail = long ? `<div class="out-rail">${act('edges', 'Alku ja loppu', ICON_EDGES, view === 'edges')}${act('start', 'Alkuun', ICON_TOP, view === 'start')}${act('end', 'Loppuun', ICON_BOTTOM, view === 'end')}${act('all', view === 'all' ? 'Supista' : 'Näytä kaikki', view === 'all' ? ICON_SHRINK : ICON_EXPAND, view === 'all')}${act('open', 'Avaa omassa ikkunassa', ICON_OPEN, false)}</div>` : '';
  return `<div class="out"><div class="out-win">${body}${rail}</div>${long ? outMeta(b, [`<span>${rivit(n)}</span>`]) : ''}</div>`;
}
const outView = (b) => b.view ?? (b.state === 'running' ? 'end' : 'edges');
const cmdLines = (b) => b.args.command.split('\n');
const plainCmd = (b) => `<pre class="bash-cmd">${esc(b.args.command)}</pre>`;
function heredoc(lines) {
  const i = lines.findIndex(l => /<<-?\s*'?"?\w+'?"?\s*$/.test(l)); if (i < 0) return null;
  const marker = lines[i].match(/<<-?\s*'?"?(\w+)/)[1]; const j = lines.findIndex((l, k) => k > i && l.trim() === marker); if (j < 0) return null;
  return { head: lines.slice(0, i + 1), body: lines.slice(i + 1, j), marker, tail: lines.slice(j + 1) };
}

// ---------- Command (chosen in round 6, Rivi): first line, the rest opens in place ----------
const cmdRivi = (b) => {
  const lines = cmdLines(b); if (lines.length === 1) return plainCmd(b);
  const open = !!b.cmdOpen;
  return `<div><div class="cmd-first${open ? ' open' : ''}">${esc(lines[0])}</div>${open ? `<pre class="cmd-rest">${lineText(lines.slice(1))}</pre>` : ''}<div class="cmd-foot"><span>${rivit(lines.length)}</span><button class="quiet-btn" type="button" data-act="cmd-toggle" aria-expanded="${open}">${open ? 'Vain ensimmäinen rivi' : 'Näytä koko komento'}</button></div></div>`;
};
