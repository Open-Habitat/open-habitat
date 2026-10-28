# Result

The desktop conversation header now sizes itself by the conversation
column, using a container query on `.ah-conversation-frame > .ah-agent-header`,
instead of the window. This covers the sidebar, the editor and a view
alike. Above the phone breakpoint:

- **One row** when the header has at least 80rem. The title keeps at least a
  third of the row (`min-width: 33%`). The workspace name, the Git branch and
  the model chip shorten with an ellipsis before the title does. The Git
  counts stay whole, and the model and thinking level shorten together.
- **Two rows** below that. The first row has the title and every action
  (guide, files, editor, terminal, new title, archive, details). The second has the
  conversation's state (workspace, activity, read-only, Git, context, model).
  If a very narrow editor or view column cannot fit even the shortened state
  chips, the model chip moves to a third row instead of overlapping a
  neighbour.

The phone layout (≤ 800 px) is unchanged; all new rules are inside
`@media (min-width: 801px)`. The editor's and view's own "narrow arrangement"
rules were removed. They wrapped the header and gave the title 85 px with the
workspace on a row of its own, and the container query now covers both cases.
The model chip's thinking level is now in a span (`ah-set-thinking`) so that it
can shorten too.

Screenshots (synthetic lab, device scale factor 2, long branch
`wt/korjaa-otsikkorivin-tilanjako-kapeassa-keskustelusarakkeessa`, sidebar
open):

- `before-1280.png`: main before the change; the title is gone.
- `after-1280.png`, `after-1024.png`, `after-1600.png`: two rows.
- `after-1920.png`: one row.
- `after-1280-editor.png`: editor open beside the conversation.

## Decisions for later review

- **Two rows below an 80rem header (one row only from about a 1920 px window
  with the sidebar open, or about 1300 px with it closed).** One alternative was
  a lower threshold (70rem) with one row at 1440–1600 px. At 1600 px that
  shortened the workspace to "aurinko…" and the model to "Malli ei t… Ei tie…"
  next to a third-of-the-row title. Two rows show everything in full at the
  cost of about 40 px of height. Another alternative was to follow the phone and
  move secondary actions into a menu. That was rejected because the desktop has
  room for them, and hiding them adds a click.
- **The title gets a third of the row in one-row mode and at least 8rem in
  two-row mode.** In two-row mode the title shares its row only with icons, so
  in practice it gets most of the column. The 8rem floor applies only to very
  narrow editor or view columns; beside them, the former 85 px floor was too
  small to read.
- **The editor and view narrow rules are replaced, not kept beside the container
  query.** The two sets of rules would have competed. The container query
  expresses what they intended ("the column, not the window, is narrow").

## Verification

Under `umask 077`, `OH_BROWSER_WORKERS=2` and a private `OH_PORT_BASE`:

- Added `web/tests/lab-desktop-header.spec.ts`. At 1024, 1280, 1600 and 1920
  px with the sidebar open, and again with the editor open, it checks four
  things. The title has the whole text or at least a quarter of the row. There
  are at most two rows (three beside the editor). No header item overlaps
  another. Every action is fully in the viewport, the page does not scroll
  sideways, and axe passes in light and dark. Before the change it failed at
  1024 (model chip off-screen), 1280 (title 0 px) and 1440 (title 146 px). With
  the summary cap reverted, the overlap check failed at 1600.
- `title-regeneration.spec.ts`: the 1366 px case needed a longer synthetic title
  to stay longer than the row, because the title now has the whole row. All 3
  tests pass.
- These specs passed: `lab-phone-header`, `lab-browser-editor`,
  `lab-shell-header`, `lab-page-scroll-header`, `lab-model-menu`,
  `lab-worktree-agent`, `agent-views`, `context-ring`, `queued-send`,
  `native-history`, `new-conversation-placeholder` and
  `browser-conversation` (72).
- `./scripts/test-focused.sh --area web` passed (125 files, 795 tests).
- The whole browser suite was not run, per the conductor's instruction (the
  suite lock queue was over an hour long). The conductor runs it once on
  integrated main.
- Review: focused self-review. The change is CSS plus two presentational spans,
  with no daemon, contract, session-state or authority change.
