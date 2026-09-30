---
created: 2026-09-30
updated: 2026-09-30
type: improvement
reporter: claude
status: done
priority: normal
provenance: agent
closed: 2026-09-30
---

# Make the clean gate's Go module cache removable

## Description

scripts/ci-local.sh sets GOMODCACHE to .cache/ci-local/go-mod inside the checkout but not -modcacherw, so Go leaves the module cache read-only. Every worktree that runs the gate then keeps gigabytes that neither Taskfleet teardown nor rm -rf can remove without chmod: on 2026-09-30, 31 finished worktrees held about 46 GB. Fix: export GOFLAGS=-modcacherw alongside GOMODCACHE (keep any existing GOFLAGS), and confirm a gated worktree can be deleted with plain rm -rf. Companion Taskfleet bugs: intake-bug-taskfleet-de6a06403413 (teardown) and intake-bug-taskfleet-0f680b1ff932 (discard).

## Acceptance Criteria

- [x] The clean gate appends `-modcacherw` to existing `GOFLAGS` without dropping caller flags.
- [x] A fresh module cache populated by `go mod download` with those flags can be removed with plain `rm -rf` without chmod.
- [x] The committed-tree `./scripts/ci-local.sh --clean --json` gate passes (using `NAH_PORT_BASE=46000` to avoid an unrelated, already occupied lab port).

## Resolution

### 2026-09-30T08:20:17Z · @issuectl

The gate now appends -modcacherw without dropping existing GOFLAGS. A fresh Go module cache was removed by plain rm -rf; the committed clean gate passed on isolated test ports. This prevents new caches from blocking worktree deletion; old read-only caches are not retroactively repaired.
