---
created: 2026-10-13
updated: 2026-10-13
type: bug
status: open
priority: normal
lane: web
lane_seq: 13
blocked_by: ['@bash-card-copy-fold']
collision: [web/]
---

# Tool row header: whole tool name, one-line target with ellipsis

Jari reported on 2026-10-13 (screenshot of a live `bash` row) that a long
command squeezes the tool name to `ba…` and wraps the command onto two lines
in the closed tool row header.

## Agreed behaviour

The tool name (`bash`, `read`, `edit`, …) never shrinks or truncates. The
target (command, path) stays on one line and ends in an ellipsis when it does
not fit; the whole command is in the opened card. This holds for every tool
row, live and history, at desktop and phone widths. Recorded in
`design-system/design.md` (bash-card paragraph) and drawn in
`design-system/drafts/Agentin vuoro.proto.html`; the rules are `.disc .name`,
`.disc .target` and `.disc .names` in `design-system/prototypes/lib/language.css`.

## Done when

- The header never wraps and the name is whole, with a long one-line command,
  a multi-line command (header shows its first line) and a long path.
- Lab captures at desktop and phone width in `issues/tool-row-ellipsis/` next
  to the draft in the same states, with remaining differences explained in
  `result.md`.
