# Result: recommendation 1 landed; recommendation 2 awaits a decision

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

