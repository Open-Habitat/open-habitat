# Result

Two separate causes, both in the shared code block (`OutputBox` and its CSS).

**The button disappeared on click.** While wrapped, nothing overflows, so the
block re-measured its lines with a canvas in "the viewport's font" to keep the
toggle. It read `getComputedStyle(pre).font`, but the viewport sets
`font-variant-ligatures: none` (and `"calt" 0`), and Chromium then returns an
empty `font` shorthand. The canvas fell back to 10px sans-serif, a line that
overflows in 14.5px mono measured as fitting, and the toggle was removed on the
very click that turned wrap on. Very long lines hid the bug (they overflow
even at 10px), which is why the turn Changes diff spec stayed green. The block
now measures the real unwrapped width: it takes the wrap class off for one
synchronous layout read (scroll position restored) and puts it back before
paint, so the measure includes the real font, tabs and diff markers. The
toggle still hides when a wrapped block widens so far that no line would
overflow (existing, deliberate behaviour in `file-tool-cards.spec.ts`).

**Wrap did not apply in a Markdown file preview.**
`.ah-markdown-code .ah-bash-window pre { white-space: pre }` outranked the
wrap rule `.ah-bash-window .ah-output-wrap`; replies only worked because of a
reply-specific patch rule (`.ah-message .ah-prose …`), so any other host of a
fenced block (the editor's Markdown preview, nested in a list or blockquote)
never wrapped. The three contextual patch rules are gone; the wrap and no-wrap
rules themselves now outrank every surrounding `pre` rule
(`.ah-bash-window pre.ah-output-viewport(.ah-output-wrap|:not(...))`), and
wrap also sets `overflow-wrap: anywhere` so an unbroken token wraps. The
"own window" dialog's code keeps lines unbroken beside its line numbers.

Wrap state was already per block (component state); the spec now proves it,
including that a long block keeps wrap when its view changes.

## Tests

- `web/tests/code-block-wrap.spec.ts` (new), desktop light and phone dark:
  a synthetic reply (`koodilohkot` in the browser host's fake Pi) with a
  plain block, a moderately long line, a language block, an unbroken token,
  a 14-line block in edges view, a block in a list item, one in a blockquote
  and a short block; and an editor Markdown preview with fences nested in a
  list and a blockquote. Each long block: toggle visible, overflow off,
  click → toggle still visible and pressed, `scrollWidth <= clientWidth` on
  every viewport, block and rail inside the column; click → overflow again.
  Per-block state and wrap kept across edges → all.
  Against the old code it fails both ways (toggle gone after the click on
  desktop; preview never wraps).
- `turn-changes.spec.ts`: the Changes diff toggle stays visible after the
  click.
- `OutputBox.test.tsx`: toggle stays while wrapped lines fit.
- `code-block-wrap`, `turn-changes`, `syntax-wrap`, `file-tool-cards` specs
  `--repeat-each 3`, 2 workers: 45 passed, 3 skipped (capture-only case).
  `./scripts/test-web-fast.sh` green.

No screenshots were captured; the assertions are geometric.

## Decisions for later review

- **A code block inside a folded turn step is not exercised separately.**
  Steps render through the same block path and `pre` rules as replies, and
  the wrap rules now outrank all of them. Alternative: a fake-Pi step fixture.
  Not built because it adds no code path the reply case does not cover.
- **Measuring by toggling the class rather than an always-visible toggle
  while wrapped.** Keeping the toggle whenever wrap is on would be simpler but
  changes the agreed behaviour that it hides when no line can overflow.
