# Website

The public website at `open-habitat.ai`: an Astro and Starlight project
built by `.github/workflows/pages.yml` to GitHub Pages. `npm ci && npm run
build` here writes `dist/`; `npm run dev` previews it.

## Layout

English is the root locale (`/`), Finnish a translation of the site's own
pages under `/fi/`.

The English front page (`src/pages/index.astro`) is the landing page's
blocks, rendered at build time by the round's own `render.mjs`, the same
renderer its `build.mjs` uses, so a block change reaches the site with no
change here. `landing.mjs` holds the blocks' location in one constant
(`landingRound`, today `design-system/prototypes/rounds/2026-11-23-etusivu-v1/`;
moving the round changes that line and the matching path in
`.github/workflows/pages.yml`), and a Vite plugin that gives the page the
rendered HTML, the engine's and blocks' CSS and the browser script
(`engine/client.js` plus each block's `client.js`). The blocks render in the
build's Node process, not in Vite's bundle, because they find their own files
through `import.meta.url`. The page's shell is thin: the head, a bar with the
documentation and the Finnish page, and a footer line with the
documentation's links and the font licence; the blocks bring their own top
bar and footer. The blocks are drawn and checked in the light theme only, so
the page is Päivä whatever the theme menu on the documentation says.

The blocks' binary assets (images, video, audio) are not in the round. Block
workers leave them in `$ETUSIVU_ASSETS`, outside git;
`node scripts/sync-landing-assets.mjs` copies exactly the files the page
uses into `public/landing/<block>/` (served as `/landing/<block>/<name>`) and
removes files it no longer uses, and `--check` only reports. The conductor
reviews each file at full size and commits `public/landing/` by hand. The
build fails, listing the files, while an asset the page uses is missing
there. `node scripts/check-landing.mjs dist <shots>` serves a build, scrolls
`/` and `/fi/` at 1440 and 390 px, opens work, plays a video and fails on a
console error, a failed request or a request to another origin; the round's
`check.mjs` checks each block in depth.

`/fi/` is still the earlier landing page, `src/components/Landing.astro`
with `lang="fi"` (its English half no longer renders), until the blocks are
translated. A translation would plug in as a locale argument to the round's
`render()` that each block's text is chosen by, rendered by a second page
`src/pages/fi/index.astro` through the same plugin (one virtual module per
locale) with the shell's few strings translated; `Landing.astro` then goes.

The old landing page's screenshots are the root README's images, imported
from `docs/assets/readme/` and resized at build time, never copied here.

The documentation collection (`docs.mjs`) is the site's own pages under
`src/content/docs/` plus the repository's `docs/product.md` and
`docs/operations.md`, rendered in place at build time. Those two are never
copied here: they are the source of truth, and a copy would drift. They are
English only, so their `/fi/` pages are Starlight's untranslated fallback.

The look is the product's design system itself: `astro.config.mjs` loads
`../design-system/styles.css` (tokens and bundled fonts), and
`src/styles/habitat.css` maps Starlight's variables onto the `--ah-*` tokens.
A missing value is added to the tokens, not hard-coded here. The one
exception is `src/styles/brand.css`, the new brand's themes and mark copied
unchanged; it goes once the design system's tokens carry them. The front
page loads the same two files and adds the round's engine CSS.

The documentation's themes are Päivä (light) and Yö (dark), from the system
or Starlight's theme menu, which names them Day/Night (`src/content/i18n/`).
Korkea kontrasti is never in the menu: `contrast.mjs` shows it only while the
menu is on Auto and the system asks for more contrast. The mark is markup
from `src/components/mark.ts` and CSS states; its animations stop under
reduced motion.

## What it must keep true

- **The front page is a demo and marketing material**, not a technical
  description (Jari, 21.11.2026). It shows what a well-used, well-configured
  environment can do, including what does not ship with it (a skill a person
  wrote, a program installed afterwards), but never anything the
  environment cannot do. It does not compare Open Habitat with other
  products or other ways of using AI.
- **Self-contained.** No cookies, analytics, trackers, external fonts or
  scripts, no CDN; every image, video and font comes from the site's own
  origin, and the front page's footer says so. Links out are fine.
- **Maturity is stated as the release line.** The front page names the
  pre-release line (0.1, published as `v0.1.N` pre-releases on GitHub
  Releases) with its caveat beside it: formats and interfaces still change.
  It never claims stability.
- **The security model is not overstated.** Unix accounts separate people
  from each other, not an agent from its owner, and root is root: the
  server's administrator can read every home. The documentation's security
  model (`src/content/docs/docs/security.md`) says so, and the front page's
  footer links to it; a page that makes a security claim says it in place.
- **The documentation's claims match the product as it is.** They rest on
  `docs/product.md`, `docs/operations.md` or the code; nothing unbuilt is
  promised. Another tool is named only where it makes the point clearer,
  and only with a claim its own public docs support, written as a short
  paragraph that leads with Open Habitat's difference, not as a feature
  table.
- **No installation's details.** No customers, pilots, real hosts or
  accounts; the people, companies and servers on the pages are made up.

## Launch switches

`launch.mjs` holds `indexable`. While it is false every page carries
`noindex, nofollow` and `/robots.txt` disallows everything. The site
deploys on every push to main that touches it, so a merge is a release of
the (still unindexed) preview.
