---
created: 2026-11-14
updated: 2026-11-14
type: bug
status: fixed
priority: normal
provenance: other
source_ref: conductor:2026-11-14/gate-4177374a
lane: gate-red
lane_seq: 1
preparation: ready
closed: 2026-11-14
---

# Clean gate red on main after the 14.11. round: settings-experimental, settings-selectors, lab explain coverage

## Description

## Observed (14.11.2026)

The clean gate on main `4177374a` (fresh `git clone --no-local`, idle-ish
host) failed in the browser phase with four cases, after this round's
landings:

- `tests/settings-experimental.spec.ts:52` — a feature is off by default,
  switches on the daemon's confirmation and stays on for the account
- `tests/settings-selectors.spec.ts:13` — settings selectors fit and remain
  keyboard accessible in fi-FI and in en-US
- `tests/lab-explain-coverage.spec.ts:357` — explain cards cover worker and
  helper views at 1440 (lab suite)

Ordinary suite 650 passed / 3 failed; lab 233 passed / 1 failed. Go,
contracts, web checks (1668) passed.

## Acceptance Criteria

- [x] Reproduce each of the four cases alone and identify the introducing change.
- [x] Fix visible regressions and update stale expectations without hiding failures.
- [x] Each case passes three isolated focused runs; web checks pass.

See [result](result.md) for causes, checks and the live try-list.
