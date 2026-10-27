---
created: 2026-10-27
updated: 2026-10-27
type: bug
reporter: conductor
status: fixed
priority: high
provenance: other
provenance_detail: conductor measurement 2026-10-27
source_ref: conductor:2026-10-27/main-browser-suite-red
lane: gate-health
preparation: ready
closed: 2026-10-27
---

# main is red: title header specs and send-receipt specs fail on an idle machine

## Description

Whole-suite run on idle Birch at main 88091ad2 (2026-10-27 10:50, OH_BROWSER_WORKERS default 8): browser suite 406 passed / 4 failed in 5.1 min, lab suite 135 passed / 2 failed in 3.8 min. Failures:
- tests/title-regeneration.spec.ts:161 '@a11y compact header gives the title a row on phones and keeps model facts read-only'
- tests/lab-title-generation.spec.ts:8 'title generation preserves the header at 390px' light and dark
- tests/browser-conversation.spec.ts:465 '@browser-conversation validated pending/rejected/uncertain send receipt never reposts' (3 cases)
The title failures likely follow phone-header-too-tall (8e6220e1: phone header in two rows, title in one line). Decide per spec whether the product or the spec is wrong given Jari's accepted two-row header, fix, and find what broke the send-receipt cases (git bisect over today's landings if needed).

## Acceptance Criteria

- [ ] Both suites green on idle Birch; for each failure the cause is named in result.md

## Resolution

### 2026-10-27T10:13:02Z · @issuectl

The four named failures were specs asserting the pre-8e6220e1 phone header; fixed in d7863050 and passing in whole suites. Two other waits went red under concurrent load and are filed separately as browser-waits-time-out-under-load, so 'green on idle Birch' still has to be shown once Birch is idle.
