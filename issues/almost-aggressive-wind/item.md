---
created: 2026-10-23
updated: 2026-10-23
type: bug
status: open
priority: normal
provenance: other
provenance_detail: observed in taskfleet run whole-suite browser check
source_ref: taskfleet:01m5mak6k7fd6d360q1prr5btc/observed:conv
originating_run: 01m5mak6k7fd6d360q1prr5btc
originating_run_kind: spinoff
lane: unlaned
preparation: ready
---

# browser-conversation.spec.ts status/identity cases flake under load

## Description

# browser-conversation.spec.ts: load-sensitive failures rotate between cases

## Observed

2026-10-23, `./scripts/test-focused.sh --area browser --spec browser-conversation.spec.ts` run three times each on main `bd5f5571` and on a branch off it, in parallel (load of two suites at once): one failing case in roughly every other run, a different case each time:

- main: `transient status failure retries with healthy journal` (:422)
- branch: `changed snapshot identity discards late previous status` (:1912), `401 from actual status request opens login` (:1898)
- whole-suite run (8 workers): `transient status failure retries with healthy journal` (:422) and `warm controlled return reads neither status nor history` (:1055)

Each passes when rerun. The earlier `gate-load-flakes-1019` fixed one such case (warm return quiescence); these are the remaining status/identity cases with timing assumptions under load.

## Impact

Whole-suite and gate runs are intermittently red, which hides real regressions and costs reruns.
