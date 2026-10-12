// Yhteiset palaset: kopiointinappi, kuplat ja työkalurivi historiassa.
let n = 0;
const nid = () => `p${++n}`;
const copyBtn = (label, text) => `<button class="icon-btn" type="button" aria-label="${esc(label)}" title="${esc(label)}" data-copy="${esc(text)}">${ICON_COPY}</button>`;
const okMark = () => `<span class="ok">${ICON_CHECK}valmis</span>`;

function userBubble(m, i) {
  return `<article class="bubble user ah-in" style="--i:${i}"><div class="bubble-head"><span class="who">Sinä</span>${copyBtn('Kopioi viesti', m.md)}<time class="meta">${m.time}</time></div><div class="prose">${md(m.md)}</div></article>`;
}
function toolBody(b) {
  if (b.name === 'bash') return `<div class="tool-body"><pre class="bash-cmd">${esc(b.args.command)}</pre><pre>${esc(b.result)}</pre></div>`;
  const args = Object.entries(b.args).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('');
  return `<div class="tool-body"><div><h4>Argumentit</h4><dl>${args}</dl></div><div><h4>Tulos</h4><pre>${esc(b.result)}</pre></div></div>`;
}
function toolRow(b, i) {
  const id = nid();
  return `<section class="tool ah-in" style="--i:${i}"><button class="disc" type="button" aria-expanded="false" aria-controls="${id}">${CHEV}<span class="names"><span class="name">${esc(b.name)}</span><span class="target">${esc(b.target)}</span></span>${okMark()}</button><div id="${id}" hidden>${toolBody(b)}</div></section>`;
}
function replyFoot(extra) { return `<div class="reply-foot"><span class="ok">${ICON_CHECK}Vastaus valmis</span>${extra || ''}</div>`; }
