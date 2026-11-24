// The page's navigation, drawn from one list of its sections that render.mjs
// builds from the blocks it already holds:
//   [{ id, label, kids: [{ key, href, label, sub, avatar, steps }] }]
// where `key` is the kid's story (data-story) and `steps` its step count.
//
//   pageRail     desktop (≥ 901 px): the quiet index at the left edge
//                (round 2026-11-24-navigaatio, variant 2 "Hakemisto"). Each
//                person and capability group is a short segment that fills as
//                its steps are read (client.js); hover or focus lays the
//                labels over the page beside the same segments.
//   phoneBar     phone (≤ 900 px): the sticky bar of round 2026-11-24-mobiili,
//                variant 3 "Aikajana": the mark (to the top), the switcher
//                that says whose day is under it and opens the list of people
//                and capability groups, the moment ("13:35 · 2 waiting"), and
//                Install.
//   ctaStrip     the phone's "Install on your server · Docs · GitHub" strip
//                between the sections.
//
// Every link carries data-jump, so client.js's jumpTo() moves focus with the
// scroll; without JavaScript they are ordinary in-page links.
import { esc, mark } from './kit.mjs';

const UP = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 13V3M3.5 7.5 8 3l4.5 4.5"/></svg>';

export function pageRail(sections) {
  const seg = (k) => `<li class="ix-kid" data-story="${k.key}" style="--h:${Math.max(14, Math.min(72, k.steps * 5))}px"><a href="${k.href}" data-jump><span class="ix-seg"><i></i></span><span class="ix-lbl">${esc(k.label)} <small class="ix-n">0/${k.steps}</small></span></a></li>`;
  return `<nav class="ix-rail" aria-label="Page index" data-shown="false">
  <a class="ix-top" href="#top" data-jump>${UP}<span class="ix-lbl">Back to the top</span></a>
  <ol class="ix-secs">${sections.map((s) => `<li class="ix-sec" data-sec="${s.id}"><a class="ix-sec-a" href="#${s.id}" data-jump><span class="ix-dot"></span><span class="ix-lbl">${esc(s.label)}</span></a>${s.kids.length ? `<ol class="ix-kids">${s.kids.map(seg).join('')}</ol>` : ''}</li>`).join('')}</ol>
</nav>`;
}

export const ctaStrip = ({ docs, repo }) => `<p class="pn-cta"><a class="btn" href="#install" data-jump>Install on your server</a><a href="${esc(docs)}">Docs</a><a href="${esc(repo)}">GitHub</a></p>`;

export function phoneBar(sections, links) {
  const item = (k) => `<li><a href="${k.href}" data-jump data-story="${k.key}">${k.avatar || ''}<span><b>${esc(k.label)}</b><small>${esc(k.sub)}</small></span></a></li>`;
  const people = sections.filter((s) => s.id === 'day' || s.id === 'roles').flatMap((s) => s.kids);
  const caps = sections.find((s) => s.id === 'can')?.kids || [];
  return `<div class="pn-bar">
  <a class="pn-mark" href="#top" data-jump aria-label="Open Habitat, top of the page">${mark(24)}</a>
  <button type="button" class="pn-who" aria-expanded="false" aria-controls="pn-menu"><span class="pn-av"></span><b>Whose day</b><span class="pn-car" aria-hidden="true"></span></button>
  <span class="pn-now"></span>
  <a class="pn-install" href="#install" data-jump>Install</a>
  <nav id="pn-menu" class="pn-menu" aria-label="Days and capabilities" hidden>
    <ul>${people.map(item).join('')}</ul>
    ${caps.length ? `<p class="pn-menu-h">What it can do</p><ul>${caps.map(item).join('')}</ul>` : ''}
    ${ctaStrip(links)}
  </nav>
</div>`;
}
