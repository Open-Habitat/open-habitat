---
created: 2026-10-16
updated: 2026-10-16
type: feature
reporter: jari
status: done
priority: high
lane: workspace-deletion
collision: [internal/daemon, web/src/app/]
preparation: ready
closed: 2026-10-16
---

# Implement workspace deletion via Trash, permanent delete for clean pushed clones (ADR 0019)

Implement [ADR 0019](../../docs/decisions/adr-0019-workspace-deletion.md), accepted by Jari 2026-10-16 with one amendment: when the workspace is a Git repository whose status is clean and whose commits all exist on its remote (nothing unpushed, no stash, no untracked files), deletion may remove it permanently at once, since the remote holds everything; otherwise it goes to the Trash as the ADR says. Settled-but-open conversations never block deletion ("Tietenkin"). First update the ADR: status Accepted with the date and the amendment, then implement per its Consequences (daemon operations on the existing route, Trash view with restore and permanent delete in the browser, deterministic race and crash tests). Close `recoverable-workspace-deletion` with it.

## Acceptance Criteria
- [x] ADR 0019 Accepted with the amendment; delete, restore and permanent delete work in the browser (tests); a clean pushed clone is removed outright, anything else goes to Trash; blockers named in the ADR each have a test. (Browser: host-backed API case through the gateway; the view is `implement-trash-ui`.)
