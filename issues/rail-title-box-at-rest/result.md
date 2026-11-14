# Result

The extra rectangle came from `df4346d3`: the shared current-link inset
shadow was drawn inside the whole-row selection ring introduced in
`62aea3ec`. It enclosed both title and age, although no rename input existed.

Removed that inner shadow for rail conversation rows, kept the whole-row
selection ring and used the 3:1 accent boundary token. Keyboard focus now
outlines the whole row rather than the title link. Forced colours likewise
mark selection on the row only. Other navigation links and actual controls
keep their boundaries.

`AgentNavItem` is shared by Your turn, Running, Quiet and workspace
conversation lists. Its rename branch already replaces the entire link,
including the timestamp, with `NameEditor`; no rename layout change was
needed.

## Verification

- Focused self-review of the style cascade, shared row callers, rename branch,
  keyboard focus and forced-colour override; no authority or state changes.
- Regression reproduced before the fix: computed selected-link box shadow
  was a 1px inset edge, not `none`.
- Focused web checks: 216 files, 1,674 tests passed.
- Host-backed synthetic browser checks: `rail-archive.spec.ts` and
  `rail-icons-quiet.spec.ts`, all seven tests passed.
- New assertions cover all three themes, selected and unselected titles,
  rest/hover/keyboard focus, zero computed title/link borders, absent inner
  shadows/outlines, whole-row focus indication, and the rename field retaining
  its border with no timestamp in its row.
- Separate synthetic-lab capture run passed. Scale-2 before and after images
  with static HTML companions are in the worker's external results directory,
  `worker-results/01m7dd96qm8b7jrdx9xc85d74y/{before,after}/`.
  After captures include selected and renaming states in all three themes.
- This is synthetic browser evidence, not a live deployment check.

## Decisions for later review

- Keep the agreed whole-row selection ring rather than removing selection
  boundaries altogether. This removes only the misleading inner box and keeps
  the selection boundary distinguishable at 3:1.
- Keep the existing rename behaviour that removes the timestamp while editing,
  rather than reserving a second timestamp column. It already prevents overlap
  without narrowing the field.

Live check: Select a conversation in each rail section, hover it, then Tab to
its link: the title stays plain text inside the row indication. Rename it:
only the input is boxed and the age disappears. Repeat in light, dark and high
contrast themes.
