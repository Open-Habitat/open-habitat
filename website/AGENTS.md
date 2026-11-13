# Website

The public website at `open-habitat.ai`: an Astro and Starlight project
built by `.github/workflows/pages.yml` to GitHub Pages. `npm ci && npm run
build` here writes `dist/`; `npm run dev` previews it.

## Layout

English is the root locale (`/`), Finnish a full translation of the site's
own pages under `/fi/`. The landing page is `src/components/Landing.astro`,
with both languages' text side by side in one object, so a wording change is
two changes and nothing checks that the pair agrees: look at both.

The documentation collection (`docs.mjs`) is the site's own pages under
`src/content/docs/` plus the repository's `docs/product.md` and
`docs/operations.md`, rendered in place at build time. Those two are never
copied here: they are the source of truth, and a copy would drift. They are
English only, so their `/fi/` pages are Starlight's untranslated fallback.

The look is the product's design system itself: `astro.config.mjs` loads
`../design-system/styles.css` (tokens and bundled fonts), and
`src/styles/habitat.css` maps Starlight's variables onto the `--ah-*` tokens.
A missing value is added to the tokens, not hard-coded here.

## What it must keep true

- **Self-contained.** No cookies, analytics, trackers, external fonts or
  scripts, no CDN; the landing page footer says so.
- **Claims match the product as it is.** Every claim rests on
  `docs/product.md`, `docs/operations.md` or the code. Nothing unbuilt is
  promised, and the page says plainly that the project is pre-release, that
  Unix accounts separate people but not an agent from its owner, and that
  root is root. An overstated security claim fails at the first critical
  reader. When the root README's positioning changes, change the landing
  page with it.
- **Maturity is stated as the release line.** The page names the current
  version (0.1.0, published as `v0.1.0-pilot.N` pre-releases on GitHub
  Releases) and keeps its caveats beside it: formats and interfaces may
  change, no migration guarantee, an administrator is assumed. It never
  claims stability.
- **Other tools only where a claim can be checked.** Differences are written
  as short paragraphs that lead with Open Habitat's difference, not as a
  feature table. Another tool is named only where it makes the point
  clearer, and only with a claim its own public docs support; recheck those
  claims when the page changes, and drop one that no longer holds.
- **No installation's details.** No customers, pilots, real hosts or
  accounts; the diagram's people and server are made up.

## Launch switches

`launch.mjs` holds `indexable`. While it is false every page carries
`noindex, nofollow` and `/robots.txt` disallows everything. Deployment is
manual (`workflow_dispatch`) until the preview is approved; the workflow's
comment holds the push trigger to add.
