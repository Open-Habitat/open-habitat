# Result: recommendations 1 and 2 landed

## Landed (no CSP change)

- The agent guide (`internal/daemon/host-context.md`, "Showing and handing
  over your work") and the agent skill (`internal/cli/agent/SKILL.md`, views)
  say that a frame inside a view must be `<iframe srcdoc=…>` or inlined into
  one document, and that `<iframe src=…>` makes the view fail.
- `design-system/prototypes/AGENTS.md`: phone-width previews and other
  embedded pages are srcdoc frames.
- The panel's refusal notice now tells the two causes apart. When the view's
  injected check reports a `frame-src`/`child-src` violation, the notice says
  *Näkymä yritti upottaa sivun, jota ei voi näyttää* / *The view tried to
  embed a page that cannot be shown*. A view that stops answering (it
  navigated somewhere the app's `frame-src` refuses) keeps *Näkymä yritti
  avata toisen sivun*. `web/src/components/ViewPanel.tsx`, text in
  `web/src/text/viewPanel.ts`.
- Tests: `ViewPanel.test.tsx` checks both texts. The Playwright case in
  `web/tests/agent-views.spec.ts` was rewritten. It used to rewrite the view
  through `route.fetch()`, which never reached the view host from
  Playwright's Node side, so the view failed by timeout and the case passed
  without exercising the nested-frame path. The synthetic view fixture now
  has `nested.html` (an `<iframe src>` to a sibling) and `srcdoc.html` (a
  200 px srcdoc frame whose media query matches). The case navigates the view
  to each: the srcdoc page stays up past the 3 s check window and its media
  query applies; the `src` page shows the embed notice without requesting
  the child.

## Awaiting Jari's decision

Recommendation 2 of `research.md`: allow same-view `src` frames (`frame-src`
and `child-src` set to the view's exact host, and `frame-ancestors` dropped
from the view's non-entry HTML, since an opaque sandboxed ancestor matches no
host-source). That is a security decision, an addition to ADR 0032, and it
needs Firefox and Safari checks first. The research suggests building it
only if srcdoc frames turn out to be insufficient in practice.

## Jari 28.11.2026

Recommendation 2 approved: allow `src` frames to the view's own files (exact
own host in `frame-src`/`child-src`; non-entry HTML files without
`frame-ancestors`), same policy for private and published views. Habitat's
app, the editor, external pages, `data:`/`blob:` frames and other people's
views stay blocked.


## Recommendation 2 landed

- The view CSP's `frame-src` and `child-src` are the view's exact host
  (`viewCSP`, `internal/gateway/views_linux.go`). A non-entry HTML page of a
  view answers without `frame-ancestors` when it is fetched with
  `Sec-Fetch-Dest: iframe` and `Sec-Fetch-Site: cross-site`, the shape of a
  sandboxed document's frame load (`viewFrameable`). The entry, non-HTML
  files, errors and every other request shape keep `frame-ancestors <app>`.
  The daemon marks the entry on the export-read route
  (`Open-Habitat-View-Entry`); an offered file's entry is the page the app
  opened. Same rule for private views, offered pages and public addresses.
- Consequence, stated plainly: an outside site that knows a view host can
  frame that view's non-entry pages. They stay read-only, sandboxed with an
  opaque origin and without network; a private view still needs the
  person's view cookie, a published one is public anyway. The
  fetch-metadata check only keeps them out of same-site framers and out of
  browsers that send no fetch metadata; no header tells the gateway that
  the framer is the view itself.
- The injected check now covers every depth: a refusal is posted to every
  ancestor and accepted from any descendant (past a srcdoc wrapper), and a
  URL frame that loads without its document announcing itself counts as
  refused (the view framing its own entry, a non-HTML file, a missing file).
  The panel notice carries `data-reason="embed"|"navigation"`.
- ADR 0032 has an amendment; the agent guide, the agent skill and
  `design-system/prototypes/AGENTS.md` say same-view `src` frames work.

### Evidence

- Gateway: `TestViewFramesOnlyItsOwnPages` (private, published, offered;
  entry, script, same-site, document, no metadata, no session). Daemon:
  the entry mark in `TestViewExportReadsOnlyFilesOfThatExport`. Both
  packages pass through `scripts/test-focused.sh --area go`.
- Playwright `web/tests/view-frames.spec.ts`: own page framed in the panel
  and own tab, and at the public address as the top page; refused with the
  embed notice: Habitat's app, another view's host, an outside URL, `data:`,
  `blob:`, the view's own entry, an outside frame inside a framed page and
  inside a srcdoc wrapper. Chromium and Firefox pass
  (`playwright.engines.config.ts`, `--repeat-each 6`). With the gateway
  change reverted to always keep `frame-ancestors`, the own-page cases fail
  in both, which confirms the opaque-ancestor finding in Firefox.
- WebKit (Playwright's Linux build, in the pinned Playwright container):
  the public-address case passes. The panel case cannot run there: WebKit
  sends no view session cookie after the hand-off, so the view never loads,
  independently of frames (filed as `webkit-view-session-cookie`). Real
  Safari was not tested.
- Full clean gate (`ci-local.sh --clean`), run twice on a loaded machine:
  no receipt. The second run had Go, contracts, packaging and all 790
  ordinary browser cases green; two lab cases of
  `lab-phone-account-sheet.spec.ts` (the rail header intercepting a tap)
  failed and pass when run on their own. The first run's failures
  (daemon package timeout, five ordinary and three lab specs, none about
  views) also passed when rerun.
- `/llm-review` (critical, gpt-6-astra) found two reporting gaps (entry
  framing, srcdoc intermediary); both were reproduced and fixed.

### Left for testing

Open a prototype that frames its own page by URL in Safari, if one is at
hand, once the WebKit session question is settled.
