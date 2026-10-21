---
created: 2026-10-21
updated: 2026-10-21
type: bug
status: open
priority: high
---

# Daemon Go tests red on main

## Description

go test -race ./internal/daemon fails about 12 top-level tests on main in a worktree on Alder (writer census unknown because of a same-UID gpg-agent, continuation, held/resumed messages, clone observation, workspace deletion); a clean /var/tmp checkout shows ~58 (Pi runtime unavailable, unsafe temp home paths, Microsoft renewal timeouts, gateway checkout_unavailable). Evidence: issues/full-heavy-test-offload/native-results-20261021.md and Fleetrepo issues/orx-background-runner/warm-measurements-20261021.md. Goal: green, environment-independent daemon tests without weakening the boundaries they assert.
