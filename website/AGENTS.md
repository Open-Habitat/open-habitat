# Website

The public website at `open-habitat.ai`: an Astro and Starlight project
built by `.github/workflows/pages.yml` to GitHub Pages. `npm ci && npm run
build` here writes `dist/`; `npm run dev` previews it.

## Layout

English only, at the root (`/`).

The English front page (`src/pages/index.astro`) is rendered at build time
by its round's own `render.mjs`, so a change in the round reaches the site
with no change here. `landing.mjs` holds the round's location in one constant
(`landingRound`, today `design-system/prototypes/rounds/2026-11-28-oss-etusivu/`)
and a Vite plugin that gives the page the rendered HTML, CSS and browser
script. The round renders in the build's Node process, not in Vite's bundle,
because it finds its own files through `import.meta.url`. Its `content.mjs`
holds every sentence on the page; `page.mjs` lays them out; feature rows show
screens from the landing page v1 round beside it (`2026-11-23-etusivu-v1/`,
read in place) or the round's own (`screens.mjs`: the connectors hub, the
program cloud and the browser row's live demo). The logos are inline SVG from
`logos/`, whose `index.json` records each one's source and licence; the six
that are not CC0 are credited by name in the page's footer, which also carries
the font licence. The page brings its own top bar and footer, so the Astro
shell is only the head. It is drawn and checked in the light theme only, so
the page is Päivä whatever the theme menu on the documentation says.

The browser row's demo is a self-contained HTML scene in an iframe sandboxed
to `allow-scripts` (no same origin), over its poster. The iframe takes no
pointer events, so the wheel over it scrolls the page; the page's control
talks to it by `postMessage` (`{scenecast:'pause'|'play'}`, answered by
`{scenecast:'state', playing, t}`, accepted only from that iframe's window).
Under reduced motion the poster shows until the reader presses play.

The page's binary assets (images, the demo scene and its poster) are not in
the round. The workers that make them leave them in `$ETUSIVU_ASSETS`,
outside git, as `<id>/<name>`; `ETUSIVU_ASSETS=<dir> node
scripts/sync-landing-assets.mjs` copies exactly the files the page uses into
`public/landing/<id>/` (served as `/landing/<id>/<name>`) and removes files it
no longer uses, and `--check` only reports. The conductor reviews each file at
full size and commits `public/landing/` by hand. The build fails, listing the
files, while an asset the page uses is missing there. `node
scripts/check-landing.mjs dist <shots>` serves a build and checks `/` at 1440
and 390 px: it scrolls the page, opens Show work, presses Copy and reads the
clipboard, pauses and resumes the demo (play continues from the paused frame
in the same iframe), turns the wheel over the demo and the screens, checks the
reduced-motion poster, and fails on a console error or warning, a failed
request, a request to another origin, a broken image or sideways scrolling.

What a shared link shows is in `src/share.ts`: the site's description and
one share image for every page, which the front page's head and the
documentation's route middleware (`src/routeData.ts`) both use; Starlight
writes the rest of the documentation's tags. `public/og.png` and
`public/apple-touch-icon.png` are rendered by `node scripts/og-image.mjs`
from the hero's headline and eyebrow (the round's `content.mjs`) and the hero
capture. Nothing notices when the hero changes under them, so re-render and
look at the image when it does.

The site is English only. The Finnish pages (the old `/fi/` landing page and
the translated documentation) were removed on 24.11.2026 at Jari's request.

The documentation collection (`docs.mjs`) is the site's own pages under
`src/content/docs/` plus the repository's `docs/product.md` and
`docs/operations.md`, rendered in place at build time. Those two are never
copied here: they are the source of truth, and a copy would drift.

The look is the product's design system itself: `astro.config.mjs` loads
`../design-system/styles.css` (tokens and bundled fonts), and
`src/styles/habitat.css` maps Starlight's variables onto the `--ah-*` tokens.
A missing value is added to the tokens, not hard-coded here. The one
exception is `src/styles/brand.css`, the new brand's themes and mark copied
unchanged; it goes once the design system's tokens carry them. The front
page loads the same two files and adds the round's CSS.

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
`noindex, nofollow` and `/robots.txt` disallows everything.

## Publishing

The site is published only by an explicit dispatch of `pages.yml` with the
commit to publish, which must be on `main`; the maintainer's publish script
lives outside this repository. A change on `main` is not live until
published.
