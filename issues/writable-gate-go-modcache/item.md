---
created: 2026-09-30
updated: 2026-09-30
type: improvement
reporter: claude
status: untriaged
priority: normal
provenance: agent
---

# Make the clean gate's Go module cache removable

## Description

scripts/ci-local.sh sets GOMODCACHE to .cache/ci-local/go-mod inside the checkout but not -modcacherw, so Go leaves the module cache read-only. Every worktree that runs the gate then keeps gigabytes that neither Taskfleet teardown nor rm -rf can remove without chmod: on 2026-09-30, 31 finished worktrees held about 46 GB. Fix: export GOFLAGS=-modcacherw alongside GOMODCACHE (keep any existing GOFLAGS), and confirm a gated worktree can be deleted with plain rm -rf. Companion Taskfleet bugs: intake-bug-taskfleet-de6a06403413 (teardown) and intake-bug-taskfleet-0f680b1ff932 (discard).
