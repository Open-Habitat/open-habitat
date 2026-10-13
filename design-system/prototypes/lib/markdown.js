// Pieni Markdown: lihavointi, kursiivi, koodi, linkit, otsikot, listat, lainaus,
// taulukot ja aidat kielen kanssa. Aidan piirtää `mdCode(kieli, teksti)`; kierros voi
// korvata sen omalla piirtäjällään.
const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function inline(s) {
  return esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*\w])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
}
let mdCode = (lang, text) => `<pre><code>${esc(text)}</code></pre>`;
const cells = (l) => l.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
const BLOCK = /^(```|- |\d+\. |#{1,6} |> |\|)/;
function md(src) {
  const out = []; const lines = src.split('\n'); let i = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (l.startsWith('```')) { const lang = l.slice(3).trim(); const buf = []; i++; while (i < lines.length && !lines[i].startsWith('```')) buf.push(lines[i++]); i++; out.push(mdCode(lang, buf.join('\n'))); continue; }
    const h = l.match(/^(#{1,6}) (.*)$/);
    if (h) { const n = Math.min(6, h[1].length + 1); /* # is the bubble's h2 */ out.push(`<h${n}>${inline(h[2])}</h${n}>`); i++; continue; }
    if (/^- /.test(l)) { const items = []; while (i < lines.length && /^- /.test(lines[i])) items.push(`<li>${inline(lines[i++].slice(2))}</li>`); out.push(`<ul>${items.join('')}</ul>`); continue; }
    if (/^\d+\. /.test(l)) { const items = []; while (i < lines.length && /^\d+\. /.test(lines[i])) items.push(`<li>${inline(lines[i++].replace(/^\d+\. /, ''))}</li>`); out.push(`<ol>${items.join('')}</ol>`); continue; }
    if (/^> /.test(l)) { const buf = []; while (i < lines.length && /^> ?/.test(lines[i]) && lines[i].trim()) buf.push(lines[i++].replace(/^> ?/, '')); out.push(`<blockquote>${md(buf.join('\n'))}</blockquote>`); continue; }
    if (/^\|/.test(l) && /^\|[\s:|-]+\|$/.test((lines[i + 1] || '').trim())) {
      const head = cells(l); i += 2; const rows = [];
      while (i < lines.length && /^\|/.test(lines[i])) rows.push(cells(lines[i++]));
      out.push(`<div class="md-table"><table><thead><tr>${head.map(c => `<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
      continue;
    }
    if (!l.trim()) { i++; continue; }
    const buf = []; while (i < lines.length && lines[i].trim() && !BLOCK.test(lines[i])) buf.push(lines[i++]);
    if (!buf.length) buf.push(lines[i++]);
    out.push(`<p>${inline(buf.join(' '))}</p>`);
  }
  return out.join('');
}
const isShort = t => !t.includes('\n') && t.length <= 120;
