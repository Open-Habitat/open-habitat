# Result

The diff inside a turn's Changes block is now a reply's code block: the edit
diff in `FileToolCard` renders its rows through `OutputBox` (new
`renderLines` and `copyText` props), so it has the same rail (copy, view
selector for long diffs, wrap toggle when a line overflows, own window), the
language label and the same scrolling. Rows keep their colouring, +/− signs,
word-level marks and screen-reader labels; unwrapped every row is as wide as
the longest, wrapped the row's background follows the wrapped line. A turn
that changed exactly one file opens straight to that file's diff; its row
still folds it, and that choice survives closing and reopening the block.

Tests: `FileToolCard.test.tsx` (long diff rows land in the right edges/all
sections, copy writes the new text), `TurnChanges.test.tsx` (single-file
auto-expand and fold), `turn-changes.spec.ts` (new synthetic history
`turn-changes-one`: desktop and phone, single file auto-expands, copy inside
the block, wrap toggle makes the long line fit with colouring kept, axe),
`file-tool-cards.spec.ts` updated to the code block's label behaviour. Both
specs 3× green; `./scripts/test-web-fast.sh` green.

Evidence (light/dark, desktop/phone, wrap on/off):
`/var/tmp/agent-keep/turn-changes-diff-block-controls/`.

## Decisions for later review

- **Copy keeps its existing meaning.** An edit diff built from the edit
  arguments copies the new text (one or all replacements); a diff from
  before/after file content or Pi's native diff copies the unified diff.
  Alternative: always copy the diff as shown, or always the new text. Kept
  because "new text" is what one pastes elsewhere after an edit, and a
  whole-file before/after diff has no single replacement to copy.
- **The conversation's edit tool card changes too.** It is the same
  component, so it now has the code block's rail and wrap toggle and its label
  no longer hides on hover. Alternative: a separate diff box only for the
  Changes block. Rejected: two diff looks for the same thing is the
  inconsistency the issue complains about.
- **Long diffs open in the code block's edges view** (first 3 and last 7
  lines with a "N hidden lines" gap) like any long code block; the 520 px
  scroll cap on the Changes diff is gone. Alternative: always show a diff
  whole. Chosen for consistency; Changes diffs keep only 3 context lines per
  hunk, so most fit under the 10-line threshold.
- **Single-file turn keeps its file row** above the open diff (tags, counts,
  fold) rather than dropping it, though the header already names the file.
- **The browser case is an ordinary host spec, not a lab spec**: the seeded
  native-history fixture lives in the ordinary synthetic host's workspace,
  which the lab host does not serve.
