---
created: 2026-10-29
updated: 2026-10-29
type: bug
reporter: agent
status: fixed
priority: normal
lane: gate-health
lane_seq: 130
preparation: ready
closed: 2026-10-29
---

# lab-desktop-header flakes: route reads a disposed git response

_Source: other_

## Description

The lab suite on integrated main (5be409cb, Birch, 29.10.) failed once in
`web/tests/lab-desktop-header.spec.ts:18` at 1600px:

    Error: apiResponse.json: Response has been disposed
      > 25 | const body = await response.json();   (inside page.route("**/api/v1/workspaces/git?*"))

It passed 12/12 alone right after. The route handler reads a fetched response
that is disposed when the page moves on (a late git read during navigation or
teardown), so the test fails on timing, not on the header.

## Acceptance Criteria

- [x] The route handler tolerates a disposed response / a request after the assertion phase (e.g. unroute before teardown, or catch the disposal and `route.fallback()`), without hiding a real failure.
- [x] Spec passes repeatedly under CPU load.
