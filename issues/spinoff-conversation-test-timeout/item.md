---
created: 2026-11-01
updated: 2026-11-14
type: bug
status: cannot-reproduce
priority: normal
provenance: other
provenance_detail: Observed focused test failure, independently reproduced on main
source_ref: taskfleet:01m6bwnyyrr9qsk0cp2bae1h30/test-failure:spinoff-conversation
originating_run: 01m6bwnyyrr9qsk0cp2bae1h30
originating_run_kind: spinoff
closed: 2026-11-14
---

# Worker conversation unit test times out on current main

Observed on Birch on 2026-11-01 while validating the icon-wish composer work after rebasing onto main `a66a1620f49851be51df52759432dcd677441a88`. The full web check twice failed only `web/src/app/SpinoffConversation.test.tsx:97`, test “worker view: the brief and terminal before history, the conversation once it arrives, never a composer”, with `Test timed out in 5000ms` (160 other files / 1190 other tests passed).

Independently reproduced in the unmodified main checkout `/home/maintainer/src/open-habitat/web` with:

```sh
npx vitest run src/app/SpinoffConversation.test.tsx
```

Result: the same test timed out after 5015 ms; the other test passed. The icon-wish branch does not change this component or test. This blocks ordinary web fast checks on main and can stop release validation, independently of icon wishes.

Investigate the fake-timer lifecycle and async history loading in that test and its production component. Determine whether the wait is a test synchronization defect or product regression before changing timeouts; do not merely increase the deadline. No production user failure established by this observation.

Later verification: after main advanced to `8d765d2b` (including tooltip and resting-rename work), the icon-wish branch's complete web suite passed all 161 files / 1193 tests. This does not identify the cause; retain the earlier reproducible observation for triage, but the failure is not currently blocking that branch.

## Resolution

### 2026-11-14T07:29:52Z · @issuectl

Passes in 4 s on current main (14.11.2026); the clean gate of 13.11. was green.
