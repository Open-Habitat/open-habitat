---
created: 2026-10-06
updated: 2026-10-16
type: task
reporter: agent
status: open
priority: high
provenance: other
provenance_detail: Follow-up from the workspace lifecycle implementation
source_ref: taskfleet:01m47rc6v6knd1zx908d2qy2zz/follow-up:recoverable-workspace-deletion
originating_run: 01m47rc6v6knd1zx908d2qy2zz
originating_run_kind: spinoff
lane: workspace-deletion
collision: [internal/daemon/, docs/]
preparation: pending
blocked_by: ['@implement-workspace-trash']
---

# Implement recoverable local workspace deletion

## Description

The lifecycle UI shipped create, settings, Git initialization and hide/restore, but deletion remains disabled. A person cannot preview or delete a local workspace from the browser; they must use native tools. This is an intentional safety boundary, not a visual omission.

`internal/daemon/workspace_manage_linux.go` mounts no delete action and `web/src/app/WorkspaceManagement.tsx` explains why. Before removing a directory, the daemon must identify managed and unowned processes, linked worktrees including those outside `~/src`, and mounts. These observers and the Taskfleet removal adapter are not yet verified. A plain pathname-based recursive deletion cannot meet the product promise: Linux cannot atomically compare an expected inode and rename/unlink that pathname, so a same-UID replacement can be moved between check and syscall.

Implement the agreed narrower guarantee recorded in `docs/architecture/workspaces.md` and `issues/manage-workspace-lifecycle/result.md`: descriptor-pinned traversal, move to per-user quarantine, only remove contents after confirming the quarantined inode matches the target, and recover from pathname races and crashes (including restoration or a reported residual move). Preview effects; block on unowned processes, unknown worktrees and mounts; require the exact directory name and an observation token; offer Hide instead. Verify managed-process exit and settled history, then report completed and remaining stages even after disconnection. Keep the delete UI disabled until deterministic race, crash and partial-result tests and the clean gate pass.

This is follow-up scope from @manage-workspace-lifecycle, not a request to relax its safety guarantee or a new workspace registry. The test server is disposable, but native workspace contents are not silently disposable to their owner.

## Decisions

### 2026-10-06 · conductor (under Jari's autonomy grant of 6 October)

Accepted for execution in this stint. Jari asked the stint to carry work as far
as meaningfully possible and to record decisions for his after-the-fact review;
the quarantine guarantee above is the conductor's 6 October decision, listed
for that review.

### 2026-10-06 · conductor

The first attempt (run `01m47vfaep5htkxk4vdadnr5d5`) found that deletion
needs a design step first: coordination with the conversation controller, a
settled-history/exit check and a crash-tested quarantine journal (see
[result.md](result.md)). Preparation returns to `pending` so the next attempt
starts from that design rather than repeating the implementation attempt.

## Comments

### 2026-10-16T16:05:00Z · @jari

Jari ~19:05: wanted to delete his test workspace (a plain directory he created) and a freshly cloned Git workspace; the trash is disabled in both. Deletion is now wanted in practice; raised to high. Still needs the design first (see result.md).

### 2026-10-16T17:00:00Z · @jari

Accepted ADR 0019's Trash model, amended: a Git repository that is clean and fully pushed may be deleted permanently at once. Settled-but-open conversations never block. Implementation: `implement-workspace-trash`.
