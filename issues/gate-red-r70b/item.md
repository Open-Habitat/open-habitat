---
created: 2026-11-09
updated: 2026-11-09
type: bug
status: fixed
priority: high
provenance: other
provenance_detail: conductor brief, round 70
source_ref: taskfleet:01m6zcnr1zey5kb3gy9pepwvf8/gate-red-r70b
originating_run: 01m6zcnr1zey5kb3gy9pepwvf8
originating_run_kind: spinoff
closed: 2026-11-09
---

# Gate red before pilot.23: worker-badges and lab-onboarding fail on main

## Description

On main 832002220 two browser specs fail deterministically by name:

- `web/tests/worker-badges.spec.ts:15`: the rail has no
  `.ah-worker-mark[data-kind="working"][data-waited]` (count 0, expected 1).
- `web/tests/lab-onboarding.spec.ts:69` (lab): the home page link
  `home-conversation-pi:d4d4d4d4-…-00000000000d` is not found at 390 px.

Both passed on c324f7c2f. The pilot.23 release waits on a green gate.
