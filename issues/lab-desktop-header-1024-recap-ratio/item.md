---
created: 2026-11-22
updated: 2026-11-22
type: bug
status: fixed
priority: normal
provenance: other
provenance_detail: v0.1.5 release gate
source_ref: taskfleet:01m8203anaw519dvyrq9ag3jdv/gate-flake:lab-desktop-header-1024
originating_run: 01m8203anaw519dvyrq9ag3jdv
originating_run_kind: spinoff
lane: unlaned
preparation: ready
closed: 2026-11-22
---

# Desktop header recap button out of viewport at 1024px (lab-desktop-header flake)

## Description

## Description

`web/tests/lab-desktop-header.spec.ts:19` › "@a11y desktop conversation header stays one row with a readable title at 1024px" fails intermittently. Seen in the v0.1.5 release clean gate on `f07782c0d` (load rising during the suite) and again in 1 of 4 isolated reruns of only this spec on a calm host (`OH_BROWSER_WORKERS=2`, seed `OH_REPLY_SEED=32dbeae5d6ab605d OH_REPLY_DELAY_MS=60`). The other widths passed.

Failure, both times identical:

```
expect(locator).toBeInViewport() failed
Locator:  locator('.ah-conversation-frame > .ah-agent-header').getByTestId('conversation-recap')
Expected: in viewport  Received: viewport ratio 0
  at expectOneRow (web/tests/lab-desktop-header.spec.ts:206:44)
```

The recap button resolves but sits outside the viewport at 1024px, so either the header row briefly overflows (a title or control measured before layout settles) or the spec checks before the row has settled. The changes since the last green gate (`c5816a551`) do not touch the header.

Find out whether a person can see the recap button pushed out at 1024px; if the product holds, make the spec wait for the settled layout.

Reproduce from the product root:

```
OH_BROWSER_WORKERS=2 ./scripts/test-focused.sh --area browser --spec lab-desktop-header.spec.ts
```
(repeat a few times; seed above.)

## Comments

### 2026-11-22T19:41:22Z · @agent

Reproduced during taskfleet run 01m829wf5hz4sv5cm6b1h8vbj3: the untouched 1024px case failed on the rail-graduation branch, then failed identically in all three repeats from a disposable source archive of main at 18b58065955793314ad4f419bc119ef6f4d6a0c1. Seed OH_REPLY_SEED=1e2524bc1e09040c, OH_REPLY_DELAY_MS=60, OH_BROWSER_WORKERS=1; npx playwright test --config playwright.lab.config.ts tests/lab-desktop-header.spec.ts --grep "at 1024px" --repeat-each 3. Failure remains conversation-recap viewport ratio 0 at expectOneRow line 206. Synthetic baseline log: /var/tmp/agent-keep/rail-adaptive-graduate/baseline-header.log. No header code or test changed in this run.

## Acceptance Criteria

- [x] Capture identifies the stale pre-content shortening observation; product layout is not changed to fit it.
- [x] Entire desktop header spec passes five repeats; 1024/1280/390px layout sweep passes.
- [x] Synthetic diagnostic and visual evidence, review and decisions are recorded in result.md.
