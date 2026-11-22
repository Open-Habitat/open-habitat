---
created: 2026-11-22
updated: 2026-11-22
type: bug
status: untriaged
priority: normal
provenance: agent
source_ref: taskfleet:01m81x267h3bxm6z80rkzx4g2h/flake:lab-explain-mode-600
originating_run: 01m81x267h3bxm6z80rkzx4g2h
originating_run_kind: spinoff
---

# Explain feedback short-viewport preview case timed out once under a focused lab run

## Description

# Explain feedback: "a long preview stays reachable in a short viewport" timed out once under a focused run

## Occurrence

`web/tests/lab-explain-mode.spec.ts:600` (`feedback layout 390 en-US › @lab @explain-feedback a long preview stays reachable in a short viewport`) failed once on 22.11.2026 in a focused lab run with `OH_BROWSER_WORKERS=2` and the default focused reply jitter (60 ms), alongside lab-adaptive-rail and settings-experimental:

```
Error: Timeout 5000ms exceeded while waiting on the predicate
  622 |             return !!box && box.y >= 0 && box.y + box.height <= 500;
> 624 |           .toBe(true);
```

Run alone right after (`--tag explain-feedback`), all six explain-feedback cases passed. The tree was main at 85756ac7f plus the adaptive-rail branch, which is off by default and off at phone width, so it does not reach this 390 px case.

## Impact

A gate or focused run can fail on this case without a product change: a flake in a spec that landed with explain-card-follows-impl.

## Direction

Find what the predicate waits for at 390 × 500 (the preview's box settling inside the viewport) and whether it depends on a transition, a scroll or font load that can take longer than 5 s under two workers; wait for that state rather than the geometry, or give the poll the case's own budget.
