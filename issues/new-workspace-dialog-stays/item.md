---
created: 2026-10-16
updated: 2026-10-16
type: bug
reporter: jari
status: open
priority: high
lane: web
collision: [web/src/app/, web/src/components/]
preparation: ready
---

# New workspace dialog stays open with Luo työtila clickable after cloning starts

Jari, 2026-10-16 ~19:05 local: creating a workspace by cloning a Git repository: after pressing Luo työtila the work started, but the popup stayed open with Luo työtila still clickable. He then wanted to delete the newly cloned workspace and could not: the trash button is disabled (deletion is `recoverable-workspace-deletion`).

The dialog should close (or turn into progress) as soon as creation is accepted, never offer a second create for the same request, and land the person in the new workspace when the clone completes, with a visible failure if it does not.

## Acceptance Criteria
- [ ] After Luo työtila the dialog closes or shows progress, a second create is impossible, and the person lands in the new workspace (browser test incl. slow clone).
