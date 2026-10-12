const CMD2 = (b) => {
  const lines = cmdLines(b); const hd = heredoc(lines);
  if (!hd) return lines.length > 10 ? box(lines, b.cmdView ?? 'edges', 'cmd', b, false, 'cmd') : plainCmd(b);
  const open = !!b.hdOpen;
  return `<div class="hd"><pre class="bash-cmd head">${lineText(hd.head)}</pre><button class="hd-btn" type="button" data-act="hd-toggle" aria-expanded="${open}">${CHEV}<span class="marker">${esc(hd.marker)}</span><span>${open ? 'Piilota sisältö' : 'Näytä sisältö'}</span><span class="count">${rivit(hd.body.length)}</span></button>${open ? `<pre class="bash-cmd body">${lineText(hd.body)}</pre>` : ''}<pre class="bash-cmd tail" style="--p:0">${lineText([hd.marker, ...hd.tail])}</pre></div>`;
};
// ---------- V3 · Sama laatikko: the command uses the same box as the output ----------
const CMD3 = (b) => { const lines = cmdLines(b); return lines.length > 10 ? box(lines, b.cmdView ?? 'edges', 'cmd', b, false, 'cmd') : plainCmd(b); };
const v1 = () => withLive('v1', threadR(cmdRivi));
const v2 = () => withLive('v2', threadR(CMD2));
const v3 = () => withLive('v3', threadR(CMD3));
