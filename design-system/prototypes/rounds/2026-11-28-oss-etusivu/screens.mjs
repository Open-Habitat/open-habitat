// Screens of our own, drawn in the product's shapes: the connectors as a hub
// (Settings → Integrations' providers and services), the programs as a cloud
// of logos, and the browser row's live demo.
import { esc, mark } from './kit.mjs';

// ---------- Logos (Simple Icons, logos/; each one's source and licence in logos/index.json, credited in the footer) ----------
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const LOGO_DIR = join(dirname(fileURLToPath(import.meta.url)), 'logos');
const META = JSON.parse(readFileSync(join(LOGO_DIR, 'index.json'), 'utf8'));
const path = (slug) => readFileSync(join(LOGO_DIR, `${slug}.svg`), 'utf8').match(/<path d="([^"]+)"/)[1];
export const logo = (slug, color = 'currentColor') => `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="${color}" d="${path(slug)}"/></svg>`;
// Drawn here: a neutral glyph for the standard mail and calendar protocols. Microsoft 365, which Simple Icons does not carry, shows as its name.
const GLYPH = {
  dav: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="5" width="12" height="9" rx="1.5"/><path d="m2.5 6.5 6 4.2 6-4.2"/><rect x="11" y="11" width="10.5" height="9" rx="1.5" fill="var(--ah-surface)"/><path d="M11 14h10.5M14 9.8v2.4M18.5 9.8v2.4"/></svg>',
};

// The connectors as a hub: the services around, a line from each to Open Habitat.
const HUB = [
  ['google', 'Google', 'Gmail, Calendar, Drive'],
  ['m365', 'Microsoft 365', 'Outlook, OneDrive'],
  ['icloud', 'Apple iCloud', 'Mail, Calendar'],
  ['dropbox', 'Dropbox', 'Files'],
  ['atlassian', 'Atlassian', 'Jira, Confluence'],
  ['trello', 'Trello', 'Boards'],
  ['modelcontextprotocol', 'MCP', 'Any MCP server'],
  ['tailscale', 'Tailscale', 'Your own computers'],
  ['github', 'GitHub', 'Repositories'],
  ['gitea', 'Gitea', 'Repositories'],
  ['gitlab', 'GitLab', 'Repositories'],
  ['dav', 'IMAP · CalDAV', 'Any mail or calendar server'],
];
export function connectors() {
  const n = HUB.length;
  const pos = HUB.map((_, i) => { const a = (i / n) * Math.PI * 2 - Math.PI / 2; return [50 + 41 * Math.cos(a), 50 + 41 * Math.sin(a)]; });
  const lines = pos.map(([x, y], i) => `<line pathLength="100" x1="${x.toFixed(2)}" y1="${y.toFixed(2)}" x2="50" y2="50" style="--d:${(i * 0.37) % 3}s"/>`).join('');
  const tiles = HUB.map(([slug, name, what], i) => `<li class="hub-t${pos[i][1] < 49 ? ' hub-up' : ''}" style="--x:${pos[i][0].toFixed(2)}%;--y:${pos[i][1].toFixed(2)}%">${slug === 'm365' ? `<span class="hub-l hub-pill">${esc(name)}</span>` : `<span class="hub-l">${GLYPH[slug] || logo(slug)}</span><b>${esc(name)}</b>`}<small>${esc(what)}</small></li>`).join('');
  return `<figure class="hub" aria-label="Services Open Habitat connects to: ${HUB.map((h) => h[1]).join(', ')}">
  <svg class="hub-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><g class="hub-base">${lines}</g><g class="hub-pulse">${lines}</g><g class="hub-pulse hub-back">${lines}</g></svg>
  <div class="hub-c">${mark(26)}<b>Open Habitat</b><small>your server</small></div>
  <ul class="hub-ts">${tiles}</ul>
</figure>`;
}

// The programs: a cloud of logos in their own colours, no lines, no claims.
// Every one is an Ubuntu 24.04 package (checked by the v1 library-intro block with apt-cache show).
export const PROGRAMS = [
  ['ffmpeg', 'FFmpeg', 'ffmpeg'], ['libreoffice', 'LibreOffice', 'libreoffice'], ['blender', 'Blender', 'blender'], ['gimp', 'GIMP', 'gimp'],
  ['inkscape', 'Inkscape', 'inkscape'], ['pandoc', 'Pandoc', 'pandoc'], ['python', 'Python', 'python3'], ['nodedotjs', 'Node.js', 'nodejs'],
  ['postgresql', 'PostgreSQL', 'postgresql'], ['qgis', 'QGIS', 'qgis'], ['audacity', 'Audacity', 'audacity'], ['git', 'Git', 'git'],
  ['openscad', 'OpenSCAD', 'openscad'], ['sqlite', 'SQLite', 'sqlite3'], ['r', 'R', 'r-base'], ['krita', 'Krita', 'krita'],
  ['kdenlive', 'Kdenlive', 'kdenlive'], ['latex', 'TeX Live', 'texlive'], ['jupyter', 'Jupyter', 'jupyter-notebook'], ['octave', 'GNU Octave', 'octave'],
  ['nginx', 'nginx', 'nginx'], ['hugo', 'Hugo', 'hugo'], ['rust', 'Rust', 'rustc'], ['go', 'Go', 'golang'],
];
// A deterministic scatter: sizes from a seeded generator, each logo placed at the
// first free spot on a spiral from the centre, with its label counted in.
function scatter(W, H, seed, scale = 1) {
  const sx = W > H ? 1.5 : 0.75, sy = W > H ? 0.62 : 1.6, ch = W > H ? 7.2 : 6.6;
  let x = seed >>> 0; const rnd = () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return ((x >>> 0) % 10000) / 10000; };
  const placed = [];
  return PROGRAMS.map(([, name]) => {
    const s = Math.round((30 + rnd() * 30) * scale); // logo size, px
    const w = Math.max(s, name.length * ch) + (W > H ? 22 : 10), h = s + (W > H ? 34 : 26); // box with its label and gap
    for (let t = 0; t < 4000; t++) {
      const a = t * 0.37 + rnd() * 0.3, r = 3.2 * Math.sqrt(t) * 6;
      const cx = W / 2 + r * Math.cos(a) * sx + (rnd() - 0.5) * 18, cy = H / 2 + r * Math.sin(a) * sy + (rnd() - 0.5) * 12;
      const box = [cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2];
      if (box[0] < 0 || box[1] < 0 || box[2] > W || box[3] > H) continue;
      if (placed.some((p) => box[0] < p[2] && p[0] < box[2] && box[1] < p[3] && p[1] < box[3])) continue;
      placed.push(box);
      return { s, x: (cx / W) * 100, y: (cy / H) * 100 };
    }
    throw new Error(`program cloud: no room for ${name} in ${W}×${H}`);
  });
}
export function programCloud() {
  const wide = scatter(1040, 440, 7), narrow = scatter(350, 760, 11, 0.8);
  return `<ul class="pc" aria-label="Some of the open-source programs in Ubuntu 24.04">${PROGRAMS.map(([slug, name, pkg], i) => `<li class="pc-i" style="--c:#${META[slug].hex};--x:${wide[i].x.toFixed(2)}%;--y:${wide[i].y.toFixed(2)}%;--s:${wide[i].s}px;--mx:${narrow[i].x.toFixed(2)}%;--my:${narrow[i].y.toFixed(2)}%;--ms:${narrow[i].s}px" title="apt install ${esc(pkg)}"><span class="pc-l">${logo(slug)}</span><b>${esc(name)}</b></li>`).join('')}</ul>`;
}

const PLAY = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>';

// The browser row's demo: the live scene (a self-contained HTML file that plays by
// itself and scales to its box) in a sandboxed iframe over its poster. client.js
// adds the iframe unless motion is reduced; without JavaScript the poster stays.
// The iframe takes no pointer events, so the wheel over it scrolls the page; the
// control on top sends the scene {scenecast:'pause'|'play'} and shows the state
// it answers with, so play continues from the paused frame.
export const DEMO_SRC = 'assets/demo/05-server-browser-live.html';
export const DEMO_POSTER = 'assets/demo/05-server-browser-poster.webp';
export function browserDemo() {
  return `<figure class="demo" data-demo="${DEMO_SRC}">
  <div class="demo-box"><img class="demo-poster" src="${DEMO_POSTER}" width="1920" height="1080" alt="Demo: the agent opens a service with no API in the server browser, and the person signs in there"><button type="button" class="demo-ctl" hidden aria-label="Play the demo" data-paused="true"><span class="demo-i-pause" aria-hidden="true"></span><span class="demo-i-play" aria-hidden="true">${PLAY}</span></button></div>
  <figcaption>The agent opens a service that has no API in the server browser, and the person signs in there.</figcaption>
</figure>`;
}

export const OWN = { connectors, 'browser-demo': browserDemo };
