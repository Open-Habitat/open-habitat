---
created: 2026-11-03
updated: 2026-11-14
type: bug
status: duplicate
priority: normal
provenance: other
source_ref: taskfleet:01m6fx4hmwph2jfsxa47yttekp/observed:lab-recap-footer-gap
originating_run: 01m6fx4hmwph2jfsxa47yttekp
originating_run_kind: spinoff
closed: 2026-11-14
---

# lab-conversation recap footer gap check sometimes measures a non-positive gap

## Description

`web/tests/lab-conversation.spec.ts:55` ("@lab recap is separate, persisted, hidden once outdated and regenerated after the next turn") sometimes fails its footer geometry check at line 211, `expect(gap).toBeGreaterThan(0)`. The gap between the recap card and the composer control, after the strip heights are subtracted, comes out as zero or negative.

Observed 2026-11-03 on Birch under the ordering detector (`OH_REPLY_DELAY_MS=250 OH_REPLY_SEED=r54-input`, 2 workers, lab config):

- main `c20f5a6a`: 1 failure in 6 runs.
- race-input-before-ready harvest branch: 1 in 6 and 1 in 2, at the same line.

It looks like the geometry is measured while the layout is still settling (the strip, the card or the editor moving) rather than a wrong steady layout, but this has not been confirmed. Effect: an intermittent red in the lab suite under the detector.

## Resolution

### 2026-11-14T07:30:23Z · @issuectl

Collected into gate-load-flakes-bundle (14.11.2026).
