# Result: website first version

The first version is in `website/` and builds with `npm ci && npm run build`
(checked from a clean clone). It is **not live**: `.github/workflows/pages.yml`
runs only on `workflow_dispatch`, only in `Open-Habitat/open-habitat`, and
crawlers are kept out. The issue stays `status: open` with
`preparation: pending`; it now waits for Jari's verdict on the preview
(screenshots and a built copy were handed to the conductor outside the
repository).

## What was built

- **Skeleton** as in the sibling project: Astro 7.4.1, Starlight 0.42.10,
  `starlight-links-validator` (every internal link is checked at build), the
  Sätteri Markdown processor, a committed `package-lock.json`, `public/` with
  `favicon.svg` and `CNAME` (`open-habitat.ai`), `website/.gitignore`.
- **Landing page** (`src/components/Landing.astro`, `/` and `/fi/`): hero with
  the old draft's server diagram, what you get, comparison table, what it is
  not, security model, try it, footer.
- **Docs** (`/docs/…`, `/fi/docs/…`): Overview, Try it and Security model are
  the site's own pages in both languages. Goal and user journeys and Install
  and operate are `docs/product.md` and `docs/operations.md` **rendered in
  place** at build time (`website/docs.mjs`), not copied; their relative links
  are rewritten to site or GitHub URLs. They are English only, so `/fi/`
  shows Starlight's "not translated" notice on them.
- **Look**: `astro.config.mjs` loads `design-system/styles.css` directly, so
  the tokens and the bundled Instrument Sans / JetBrains Mono come from the
  design system without a copy; `src/styles/habitat.css` maps Starlight's
  variables onto `--ah-*`. Light and dark follow Starlight's switch (the
  same `data-theme` attribute the tokens use). No CDN, no external request
  (checked with Playwright on every screenshot page), no cookies, no
  analytics.
- **noindex**: one switch, `indexable` in `website/launch.mjs`. While false,
  every page has `noindex, nofollow` and `/robots.txt` disallows everything.
- `website/AGENTS.md` records the rules the site must keep (self-contained,
  claims match the product, no installation details).
- `scripts/validate-project-view.py` now skips `website/src/content/`: those
  pages link by site URL (`/docs/try/`), which the site build validates.

## Where each docs page comes from

| Page | Source |
| --- | --- |
| Overview (`docs/index.md`) | written from `docs/index.md` |
| Try it (`docs/try.md`) | condensed from `docs/operations.md` ("Supported fresh installation") and the old draft's Try section |
| Security model (`docs/security.md`) | root `AGENTS.md`/`CLAUDE.md` authority model, `docs/product.md`, the old draft's security sections |
| Goal and user journeys | `docs/product.md`, rendered in place |
| Install and operate | `docs/operations.md`, rendered in place |

## Decisions for later review

- **English at the root, Finnish under `/fi/`.** The repository, documents
  and the GitHub audience are English-first; the old draft also defaulted to
  English. Starlight's language picker switches between the two.
- **Landing text** is the old Zola draft's, kept nearly word for word, with
  these changes against today's product:
  - "There is no public release yet" replaces the draft's description of
    named pilot releases: the public repository has no GitHub Releases.
  - The placeholder boxes are gone. Source link and vulnerability reporting
    are now real (private vulnerability reporting is enabled on the
    repository); the install command and demo video are simply not mentioned.
  - "Your own model account" also mentions the server-provided key, and the
    workbench card says the terminal is on the same tmux sessions and the
    editor runs as the person (both from `docs/product.md`).
  - "No telemetry" is kept: nothing in the product reports home, and the
    editor is even started with telemetry disabled.
- **Comparison table** is the draft's, which mirrors the README draft and the
  benchmark reports. I did not re-verify the other tools' current state.
- **Docs set** is deliberately small: three own pages plus the two repository
  documents. Decision records and the design system are linked on GitHub,
  not rendered.
- **Hero on phones**: the headline comes before the diagram (Starlight's
  default puts the image first).

## Open questions for Jari

1. Root language: English (chosen) or Finnish?
2. Should the comparison table stay at launch? Its claims about Orca,
   HumanLayer and the Pi web UIs date from the benchmark round and age with
   those projects.
3. The draft's demo video placeholder was dropped. Add a video slot back
   once there is a video?
4. "Open Habitat runs on multi-person installations" is the only maturity
   claim besides "pre-release". Is that the wording you want in public?
5. Root `README.md` and `docs/index.md` do not link to the site yet; that is
   left for `readme-first-draft`.

## Going live (not done here)

1. Jari approves the preview.
2. In `website/launch.mjs`, set `indexable = true`.
3. Add the push trigger shown in the comment of `.github/workflows/pages.yml`.
4. Repository Pages settings (source: GitHub Actions, custom domain) and DNS
   in the infrastructure repository; neither was touched.

## Round 2 (Jari's verdict 13.11.2026)

Jari's answers: English stays at the root; the comparison table goes; the
maturity text was wrong in spirit.

### What changed

- **Comparison table → four short paragraphs** ("How it differs", both
  languages), each leading with Open Habitat's difference:
  several people separated by Unix accounts; your own server with no account,
  cloud or relay in between; history stays in the agent's native files; one
  agent (Pi), not many. A tool is named only where it makes the point
  clearer, and every claim about it was checked against that tool's own
  public page on 13.11.2026:
  - JupyterHub: default PAM authenticator uses the server's accounts and the
    default spawner starts each server "running under their system username"
    (jupyterhub.readthedocs.io, technical overview).
  - PI WEB (jmfederico/pi-web): "assumes trusted users" and "is not a
    sandbox or a multi-tenant platform" (README).
  - HumanLayer: runs Claude Code, Codex, OpenCode and Pi on your machines;
    "HumanLayer Cloud runs this code"; self-hosting "guides … are in
    progress" (README).
  - Orca: desktop app, "works with any CLI agent" (README).
- **Maturity**: hero chip, meta description, the landing "Try it" status and
  the docs Overview and Try it pages now say version 0.1.0, an early
  pre-release in use on multi-person installations, published as pilot
  pre-releases (`v0.1.0-pilot.N`) on GitHub Releases (linked), with the
  caveats beside it: formats and interfaces may change, no migration
  guarantee, an administrator is assumed. No stability claim.
- The diagram's made-up task "Release notes for 0.4" became "Weekly status
  report", so it cannot be read as the product's own version.
- `website/AGENTS.md` records both rules (maturity as the release line;
  other tools only with checkable claims, as paragraphs).

### Dropped for lack of a verifiable claim

- Orca: "every paired device is the same user", "its own journal and
  scrollback", "browser client", "35+ agents" (the README now lists 34 named
  agents plus "any CLI agent"; the paragraph uses the latter).
- HumanLayer: history "synced to the vendor's Postgres" — the README mentions
  Postgres synced to clients but not where it runs.
- Pi web UIs: "no sign-in" — Pi Web (agegr/pi-web) now has optional password
  login; "native files plus the UI's own stores" — Pi Web reads Pi's own
  session files and PI WEB's README does not say.
- JupyterHub: "or containers" (true only with a non-default spawner; not
  needed for the point).
- The "Choose Orca" / JupyterHub notes under the table, replaced by the
  paragraphs above.
