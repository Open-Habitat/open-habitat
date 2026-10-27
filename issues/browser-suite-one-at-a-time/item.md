---
created: 2026-10-27
updated: 2026-10-27
type: chore
reporter: conductor
status: open
priority: normal
provenance: other
provenance_detail: conductor measurement 2026-10-27
source_ref: conductor:2026-10-27/browser-suite-one-at-a-time
lane: gate-health
preparation: ready
---

# Run at most one whole browser suite at a time on a host

## Description

Measured 2026-10-27 on idle Birch (8 vCPU): whole browser suite 5.1 min, lab suite 3.8 min at default workers. Two concurrent whole-suite runs (2×8 Chromes and synthetic hosts) held the CPU at 100% for ~20 min and slowed every worker and the live product. Add a host-wide lock so that a whole-suite run (scripts/test-focused.sh --area browser, browser-focused.py --lab, and the gate's browser phase in ci-local.sh) waits for any other whole-suite run on the same host, with a clear 'waiting for browser suite lock held by <worktree>' message and no deadlock when a holder dies (flock on a file under the user's runtime or a shared /var/tmp path). Focused runs of named specs stay unlocked. Document it in TESTING.md.

## Acceptance Criteria

- [ ] Two concurrent whole-suite runs serialize; a killed holder releases; focused specs are not blocked; documented
