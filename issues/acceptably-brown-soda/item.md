---
created: 2026-10-24
updated: 2026-10-24
type: bug
status: open
priority: normal
provenance: other
provenance_detail: gate run in taskfleet worker
source_ref: taskfleet:01m5phrd9kn11x3wa2mz8qcdqk/gate-flake:lab-slow-creation-body
originating_run: 01m5phrd9kn11x3wa2mz8qcdqk
originating_run_kind: spinoff
lane: unlaned
preparation: ready
---

# Gate flake: lab-slow-creation reads the create response after navigation drops its body

## Description

Observed in the full gate (`./scripts/ci-local.sh --clean --json`, 2026-10-24,
`stop-turn-flicker` branch, which does not touch conversation creation), and
earlier in the `settings-model-picker-autoselect` work:

`web/tests/lab-slow-creation.spec.ts:59` "@placeholder slow native startup keeps
sidebar + in its new conversation" fails with
`response.json: Protocol error (Network.getResponseBody): No data found for
resource with given identifier — Response body is not available for a response
that was navigated away from`.

The spec reads the create response body after the app has already navigated to
the new conversation. Under load the navigation wins and Chromium drops the body.
Passes 12/12 alone. Reading the body before the navigation, e.g.
`page.waitForResponse` then `await response.json()` right away, or taking the
session id from the URL, would remove the race.
