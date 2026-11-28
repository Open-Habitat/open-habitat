// The page: hero, the core facts, the hero capture, the feature rows, the
// programs and the install prompt. A feature row's screen is a v1 block or a
// screen of our own (screens.mjs). The page has no ambient video: a block's
// <video> becomes its poster, and its play button goes.
import { esc, mark, block, wrap } from './kit.mjs';
import * as C from './content.mjs';
import { OWN, programCloud } from './screens.mjs';

const IDS = [...new Set(C.features.map((f) => f[3]).filter((id) => !OWN[id]))];
const G = {};
for (const id of IDS) G[id] = await block(id);
const still = (html) =>
  html
    .replace(/<video\b[^>]*\bposter="([^"]+)"[^>]*\bwidth="(\d+)" height="(\d+)"[^>]*><\/video>/g, '<img class="m-still" src="$1" width="$2" height="$3" alt="">')
    .replace(/<button type="button" class="mv-play"[\s\S]*?<\/button>/g, '');
const shot = (id) => (OWN[id] ? `<div class="own own-${id}">${OWN[id]()}</div>` : wrap(id, still(G[id].screen())));
const n2 = (i) => String(i + 1).padStart(2, '0');

const LINKS = [['features', 'Features'], ['programs', 'Programs']];
const topbar = () => `<header class="top j-top"><a class="brandword" href="#top">${mark(24)} Open Habitat</a><nav>${LINKS.map(([h, l]) => `<a href="#${h}">${esc(l)}</a>`).join('')}<a href="${C.DOCS}">Docs</a><a href="${C.REPO}">GitHub</a></nav></header>`;
const head = (h2, p = '') => `<header class="j-head"><h2>${esc(h2)}</h2>${p ? `<p class="j-lead">${p}</p>` : ''}</header>`;
const link = ([n, t, u]) => `<a href="${u}">${esc(n)}</a>${t ? ` (${esc(t)})` : ''}`;

const agWin = () => `<div class="ag-win"><div class="ag-bar"><span class="bw-dots" aria-hidden="true"><i></i><i></i><i></i></span><span>Your coding agent</span><button type="button" class="j-copy" data-copy>Copy</button></div><div class="ag-body"><span class="ag-p" aria-hidden="true">&gt;</span><pre class="ag-text">${esc(C.installPrompt)}<span class="ag-caret" aria-hidden="true"></span></pre></div></div>`;

export function page() {
  const rows = C.features
    .map(([a, h, p, id], i) => {
      const notes = a === 'browser' ? `<ul class="b-notes">${C.browserNotes.map(([k, t]) => `<li><b>${esc(k)}</b><span>${esc(t)}</span></li>`).join('')}</ul>` : '';
      return `<article class="b-row${i % 2 ? ' b-flip' : ''}${OWN[id] ? ' b-own' : ''}" id="f-${a}"><div class="b-txt"><p class="b-n">${n2(i)}</p><h3>${esc(h)}</h3><p>${esc(p)}</p>${notes}</div><div class="b-scr${id === 'connectors' || id === 'browser-demo' ? ' b-scr-open' : ''}">${shot(id)}</div></article>`;
    })
    .join('');
  const [rn0, rnLink, rn1] = C.releaseNote;
  return `<div class="pg j-page j-v1">${topbar()}
<section class="hero j-hero" id="top">
  <p class="eyebrow">${esc(C.eyebrow)}</p>
  <h1>${esc(C.hero.h1)}</h1>
  <p class="lede">${esc(C.hero.lede)}</p>
  <p class="cta"><a class="btn" href="#install">Install on your server</a><a class="btn ghost" href="${C.REPO}">${mark(16)} GitHub</a></p>
  <p class="j-release">${esc(rn0)} <a href="${C.RELEASES}">${esc(rnLink)}</a>${esc(rn1)}</p>
</section>
<section class="j-sec j-coresec"><ul class="j-core">${C.core.map(([b, s]) => `<li><b>${esc(b)}</b><span>${esc(s)}</span></li>`).join('')}</ul></section>
<figure class="hero-band"><img class="hero-img" src="assets/hero/hero.webp" width="2000" height="1321" alt="A conversation with an agent in Open Habitat on a desktop browser, with running and waiting conversations in the sidebar, and the same conversation on a phone"></figure>
<section class="j-sec" id="features"><div class="b-rows">${rows}</div></section>
<section class="j-sec j-lib" id="programs">${head(C.library.h2, esc(C.library.p))}${programCloud()}</section>
<section class="j-sec j-install" id="install"><header class="j-head"><h2>${esc(C.installHead)}</h2></header>
  ${agWin()}
</section>
<footer class="foot j-foot"><span class="brandword">${mark(18)} Open Habitat</span><span>Free and open source under the MIT License.</span>${C.footer.map(([l, h]) => `<a href="${h}">${esc(l)}</a>`).join('')}<span class="quiet">${esc(C.footNote)}</span><span class="quiet j-credit">${esc(C.logoCredit[0])} ${C.logoCredit[1].map(link).join(', ')}.</span><span class="quiet j-credit">${esc(C.fontCredit[0])} ${link([C.fontCredit[1], '', C.fontCredit[2]])}.</span></footer></div>`;
}
