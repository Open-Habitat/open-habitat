# Result

The browser editor now has one toolbar: file picker, filename, preview/text,
save, full-window/return and close. Layout controls still belong to
WorkspaceEditor; BrowserDocument only passes their rendered slot through.
VS Code retains its own header, as its document controls belong to its frame.
The lazy-loading fallback also keeps return/close available.

## Decisions for later review

- Replace the redundant CodeMirror 6 heading with the open filename rather than
  keeping both. The file is the useful identity; the engine is already chosen
  in settings. The alternative would spend scarce phone width on an engine label.
- Use the existing folder icon and translated Files label for the picker, and
  truncate the displayed filename (full path remains in its title and file tree).
  This keeps ordinary controls on one row at 390px. Conflict/change explanations
  may still wrap rather than hiding important information.
- Keep the conversation header inside its conversation pane rather than moving
  it across the editor. This task removes the redundant editor row, not the pane
  boundary or splitter. Existing account/menu and conversation-header changes
  are retained; the desktop captures show the current adjacent header.

## Verification

Focused self-review: checked slot composition, unchanged save/discard ownership,
layout/focus callbacks, loading fallback, VS Code path and responsive overflow.
No contract, session-state or authority behavior changed.

On baseline 8776b247 plus this issue's diff, Birch, synthetic fixtures only:

- `./scripts/test-focused.sh --area web`: 161 files / 1185 tests passed,
  including static checks, catalog parity and component checks.
- `OH_PORT_BASE=10130 OH_BROWSER_WORKERS=2 ./scripts/test-focused.sh --area browser --spec browser-editor.spec.ts`:
  22 passed, including light/dark, phone/desktop, saves/dirty protection,
  previews and Axe. Extended the existing Markdown test to assert that picker,
  preview, save, full-window and close centers share a row and fit the viewport.
- Same command with `--spec workspace-editor.spec.ts`: 9 passed, including
  return paths, draft retention, VS Code and Axe.
- `git diff --check`, issuectl doctor and project-view validator checked before
  commit. No full gate or whole browser suite; no live installation claim.

After rebasing onto main `df646085`, all three focused commands were rerun on
`dcf095ec` with the same passing totals (1185 web, 22 browser-editor, 9
workspace-editor). The only rebase conflict was adjacent KOKEILTAVAA additions;
both workers' entries were retained. Snapshot HTML trailing whitespace was
normalized without changing its content.

The first workspace-editor run failed two phone Axe audits: the new layout put
an existing disabled Save tooltip under the old mouse position. Baseline source
passes without hover but reproduces both failures when Save is deliberately
hovered before the final audit. Filed @disabled-tooltip-orphan-content unlaned.
The layout test now parks the pointer away and waits for tooltips to close before
its final audit; no Axe rule was disabled. Tooltip accessibility is not claimed.
Initial lint failures (capture formatting and test non-null assertions) were
corrected. The first lab capture lost its parent-shell-owned host; restarting
and capturing within one shell succeeded. Passing results above are reruns.

## Visual evidence

Captured with `web/lab/capture-editor-header-one-row.mjs` using the synthetic lab,
1440×900 and 390×900 CSS pixels, **deviceScaleFactor 2**. Every PNG has an adjacent
inert self-contained HTML snapshot. Phone captures keep the file picker open;
desktop shows the document beside its conversation. These are review evidence,
not automated pixel comparisons.

| View | Before | After |
| --- | --- | --- |
| Desktop, light | [PNG](evidence/before-1440-light.png) · [HTML](evidence/before-1440-light.html) | [PNG](evidence/after-1440-light.png) · [HTML](evidence/after-1440-light.html) |
| Desktop, dark | [PNG](evidence/before-1440-dark.png) · [HTML](evidence/before-1440-dark.html) | [PNG](evidence/after-1440-dark.png) · [HTML](evidence/after-1440-dark.html) |
| Phone, light | [PNG](evidence/before-390-light.png) · [HTML](evidence/before-390-light.html) | [PNG](evidence/after-390-light.png) · [HTML](evidence/after-390-light.html) |
| Phone, dark | [PNG](evidence/before-390-dark.png) · [HTML](evidence/before-390-dark.html) | [PNG](evidence/after-390-dark.png) · [HTML](evidence/after-390-dark.html) |
