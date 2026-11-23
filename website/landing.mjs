// The English front page is the landing page's blocks, rendered at build time
// by the round's own renderer (render.mjs beside its build.mjs), so a block
// change reaches the site without a change here. The blocks' binary assets are
// not in the round: scripts/sync-landing-assets.mjs copies the ones the page
// uses into public/landing/, and the build fails while one of them is missing.
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Where the blocks are. Moving the round into the website changes only this.
export const landingRound = fileURLToPath(
  new URL('../design-system/prototypes/rounds/2026-11-23-etusivu-v1/', import.meta.url),
);

const websiteDir = fileURLToPath(new URL('.', import.meta.url));
// The page's assets, served from the site's own origin as /landing/<block>/<name>.
export const landingAssetsDir = path.join(websiteDir, 'public', 'landing');
const assetUrl = (id, name) => `/landing/${id}/${name}`;

// Renders the page: { html, css, js, assets: [{ id, name }] }. The HTML refers
// to an asset as assets/<block>/<name> (the round's engine/kit.mjs); exactly
// those strings are rewritten to the site's URLs.
export async function renderLanding() {
  const { render } = await import(pathToFileURL(path.join(landingRound, 'render.mjs')).href);
  const page = await render();
  const assets = [...page.assets].flatMap(([id, names]) => [...names].map((name) => ({ id, name })));
  const refs = assets
    .map(({ id, name }) => [`assets/${id}/${name}`, assetUrl(id, name)])
    .sort((a, b) => b[0].length - a[0].length);
  const rewrite = (s) => refs.reduce((acc, [from, to]) => acc.replaceAll(from, to), s);
  return { html: rewrite(page.html), css: page.css, js: rewrite(page.js), assets };
}

export function missingLandingAssets(assets) {
  return assets.filter(({ id, name }) => !existsSync(path.join(landingAssetsDir, id, name)));
}

// Vite plugin: `import landing from 'virtual:landing'` gives the page what
// renderLanding() returns. It renders here, in the build's Node process, not
// in Vite's bundle, because the blocks find their own files through
// import.meta.url.
const VIRTUAL = 'virtual:landing';
export function landingPlugin() {
  return {
    name: 'open-habitat-landing',
    resolveId(id) {
      return id === VIRTUAL ? `\0${VIRTUAL}` : undefined;
    },
    async load(id) {
      if (id !== `\0${VIRTUAL}`) return undefined;
      const page = await renderLanding();
      const missing = missingLandingAssets(page.assets);
      if (missing.length) {
        throw new Error(
          `the landing page uses ${missing.length} asset(s) missing from ${path.relative(websiteDir, landingAssetsDir)}/ ` +
            `(run node scripts/sync-landing-assets.mjs with ETUSIVU_ASSETS set):\n` +
            missing.map(({ id, name }) => `  ${id}/${name}`).join('\n'),
        );
      }
      return `export default ${JSON.stringify(page)};`;
    },
  };
}
