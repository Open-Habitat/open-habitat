---
created: 2026-10-31
updated: 2026-11-02
type: bug
reporter: conductor
status: cannot-reproduce
priority: normal
closed: 2026-11-02
---

# Whole-suite flake: workspace-trash undo notice missing after an outright deletion

The clean gate on main `82df3a75` (31.10. late evening, log
`~/.local/state/oh-conductor/gate-r43/stdout.json` on Birch) failed
`lab-workspace-trash.spec.ts:49` (delete, undo, restore, purge and empty
from the UI). After `purge-workspace` on the pushed clone `kokeilu-wasm`, no
`.ah-archive-notice` appeared within 5 s (line 157). The case passed alone
afterwards.

The same gate's settings-search failure had another cause and is fixed (see
`gate-load-flakes-waiting-search`'s result.md).

Not reproduced in 18/18 runs under heavy gate-like load (6 workers, ten
busy loops). Outright deletion takes 0.2–0.5 s there, so 5 s is not too
short. That gate kept no error context, so it is unknown which non-notice
outcome the dialog showed. `WorkspaceDeletion.confirm` stays in the dialog
on a fresh check (`"outcome" in result`, e.g. `blocked`) and on the
refusals `workspace_changed`, `workspace_not_clean` and `workspace_partial`.
The next occurrence's `error-context.md` shows which one it was.
