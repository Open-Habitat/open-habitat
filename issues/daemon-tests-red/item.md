---
created: 2026-10-21
updated: 2026-10-21
type: bug
status: fixed
priority: high
lane: gate-health
closed: 2026-10-21
---

# Daemon Go tests red on main

## Description

go test -race ./internal/daemon fails about 12 top-level tests on main in a worktree on Alder (writer census unknown because of a same-UID gpg-agent, continuation, held/resumed messages, clone observation, workspace deletion); a clean /var/tmp checkout shows ~58 (Pi runtime unavailable, unsafe temp home paths, Microsoft renewal timeouts, gateway checkout_unavailable). Evidence: issues/full-heavy-test-offload/native-results-20261021.md and Fleetrepo issues/orx-background-runner/warm-measurements-20261021.md. Goal: green, environment-independent daemon tests without weakening the boundaries they assert.

## Acceptance Criteria

- [x] Full race suite passes with documented prerequisites in the worker and a fresh `/var/tmp` worktree.
- [x] Host process state is isolated through fixtures without weakening Unix-user boundary assertions.
- [x] Self-review and focused review of the product seam extraction completed.

## Result

See [result.md](result.md) for causes, exact baseline failures, measured validation and limitations.
