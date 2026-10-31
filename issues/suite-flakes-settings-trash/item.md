---
created: 2026-10-31
updated: 2026-10-31
type: bug
reporter: conductor
status: open
priority: normal
---

# Whole-suite flakes: settings-search arrow preview, workspace-trash undo notice

The clean gate on main `82df3a75` (31.10. late evening) failed two specs
that passed in the two previous whole-suite runs on near-identical trees
and passed 3/3 alone on the same tree afterwards (`OH_BROWSER_WORKERS=2`):

- `settings-search.spec.ts:73` finds a setting, arrows preview results
  beside the list, Enter lands and Esc steps back: URL was
  `/settings/recap#recap-model`, expected `#default-model$` (line 148).
  Arrow-key preview moved to a different result than expected, which
  suggests the arrow press raced the result list's update.
- `lab-workspace-trash.spec.ts:49` delete, undo, restore, purge and empty
  from the UI: the undo notice was not visible (line 157).

Both are load-dependent flakes of the whole suite; each should wait on its
real condition. Gate log: `~/.local/state/oh-conductor/gate-r43/stdout.json`
on Birch.
