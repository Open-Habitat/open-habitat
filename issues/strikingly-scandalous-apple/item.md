---
created: 2026-10-24
updated: 2026-10-24
type: bug
status: fixed
priority: normal
provenance: agent
originating_run: 01m5pv1gskbkcp2fqjmcjgm4gt
originating_run_kind: spinoff
lane: unlaned
collision: [tests/lab]
preparation: ready
closed: 2026-10-24
---

# Lab paging-and-recovery spec times out on send under the full gate

## Description

## Observation

On 2026-10-24 the full clean gate (`OH_BROWSER_WORKERS=2 OH_PORT_BASE=14300 ./scripts/ci-local.sh --clean --json`, alder, browser suite placed remotely by Fleetrepo) failed only in the lab suite: `web/tests/lab-conversation.spec.ts:889` "@lab fresh replies and exhausted older history survive paging and recovery" timed out after 90 s at line 908, clicking `getByTestId("send").and([data-mode="send"])` inside the loop that sends `Kierros ${i}`. Everything else passed (ordinary suite 360 passed, lab 130 passed + this 1 failed; Go/contracts green).

The tree was branch `wt/qjmcjgm4gt-server-integrations-microsoft` (Microsoft integration setup and validation; no conversation, lab or composer code touched). Re-running the same test alone with `./scripts/test-focused.sh --area browser --lab --spec lab-conversation.spec.ts --tag "fresh replies and exhausted older history"` passed in 15.5 s.

## Impact

The clean gate is the precondition of a production release and the per-round health check of main; a load-dependent timeout here turns it red without a code cause and costs a rerun of the whole gate.

## Likely direction

The send button probably stays in another mode (or the lab host is slow to accept the next message) while the previous turn is still finishing under full-suite load; the test should wait for the observable ready state rather than for the click to succeed within the test timeout. Unverified.

## Acceptance Criteria

- [x] Wait explicitly for idle composer/send readiness rather than textarea availability.
- [x] Paging/recovery journey passes ten repeated browser runs.
- [x] Record validation and the limits of reproducing the original gate-only timeout.
