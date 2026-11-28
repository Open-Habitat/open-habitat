// open-habitat.ai's front page rendered in Node: the renderer the website
// calls at build time (website/landing.mjs). render() returns the page body's
// HTML, its CSS without the design-system tokens, the brand themes and the
// fonts (the caller loads those its own way), the browser script, and the
// binary assets the page uses as a Map of id -> Set of names. The HTML names
// an asset as assets/<id>/<name>; the caller rewrites exactly those paths.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ROUND, SHOWN, USED_ASSETS, blockFile } from './kit.mjs';
import { page } from './page.mjs';
import { DEMO_SRC, DEMO_POSTER } from './screens.mjs';

const read = (p) => readFileSync(p, 'utf8');
const here = (f) => fileURLToPath(new URL(f, import.meta.url));

export async function render() {
  const html = page();

  const blockCss = [...SHOWN].map((id) => blockFile(id, 'block.css')).filter(Boolean).map((p) => `/* ${p.slice(ROUND.length)} */\n${read(p)}`);
  const css = [...['page', 'screen', 'product', 'views'].map((n) => read(`${ROUND}engine/${n}.css`)), ...blockCss, read(here('style.css'))].join('\n');

  const blockJs = [...SHOWN]
    .map((id) => [id, blockFile(id, 'client.js')])
    .filter(([, p]) => p)
    .map(([id, p]) => `// ---- blocks/${id}/client.js ----\n(() => {\n${read(p)}\n})();`);
  const js = [read(here('client.js')), ...blockJs].join('\n');

  // A block registers every asset it might use; the page keeps only those its
  // HTML names (a video shown as its poster drops the video).
  const assets = new Map();
  const add = (ref) => {
    const [, id, name] = ref.split('/');
    if (!assets.has(id)) assets.set(id, new Set());
    assets.get(id).add(name);
  };
  for (const id of SHOWN) for (const name of USED_ASSETS.get(id) || []) if (html.includes(`assets/${id}/${name}`)) add(`assets/${id}/${name}`);
  for (const ref of ['assets/hero/hero.webp', DEMO_SRC, DEMO_POSTER]) add(ref);
  // Every assets/ path in the HTML must be one the caller is told about.
  const named = new Set(html.match(/(?<=["'(])assets\/[\w-]+\/[\w.-]+/g) || []);
  const unknown = [...named].filter((r) => !assets.get(r.split('/')[1])?.has(r.split('/')[2]));
  if (unknown.length) throw new Error(`render: the page names assets nobody registered: ${unknown.join(', ')}`);
  return { html, css, js, assets };
}
