---
created: 2026-11-22
updated: 2026-11-22
type: bug
status: untriaged
priority: normal
provenance: other
provenance_detail: v0.1.5 release gate
source_ref: taskfleet:01m8203anaw519dvyrq9ag3jdv/gate-flake:lab-desktop-header-1024
originating_run: 01m8203anaw519dvyrq9ag3jdv
originating_run_kind: spinoff
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
