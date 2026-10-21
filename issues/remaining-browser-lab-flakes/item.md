---
created: 2026-10-21
updated: 2026-10-21
type: bug
status: fixed
priority: normal
provenance: chat
source_ref: taskfleet:01m5eqjyh987kygfhe2kddtnd7/task
originating_run: 01m5eqjyh987kygfhe2kddtnd7
originating_run_kind: spinoff
closed: 2026-10-21
---

# Remaining browser/lab flakes after 21.10.

## Description

## Reproduction
Gate on da46fc2e: lab-composer-area.spec.ts queue follow-up count was zero instead of one. Stress lab five times and ordinary browser twice, fix root causes without weakening assertions or raising timeouts, then repeat both stress runs and fast web checks.

## Acceptance Criteria
- [x] Final lab repeat-each 5 and ordinary repeat-each 2 have zero failures.
- [x] Fast web checks pass; root causes and timings recorded.
