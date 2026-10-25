---
created: 2026-10-24
updated: 2026-10-25
type: bug
status: open
priority: normal
provenance: other
provenance_detail: observed in the pilot.9 release clean gate
source_ref: taskfleet:01m5qt189k90vzv4rdarz82zbw/gate-flake:lab-conversation-591
originating_run: 01m5qt189k90vzv4rdarz82zbw
originating_run_kind: spinoff
lane: unlaned
preparation: ready
collision: [web/e2e/lab-conversation]
---

# Lab SSE-frames spec times out on the event cursor under the full gate

## Description

# Lab SSE-frames spec times out on the event cursor under the full gate

## Observed

The full clean gate (`scripts/ci-local.sh --clean --json`) on Alder at
`7eda6bac` (tree of the pilot.9 release source), 2026-10-24, failed only in the
lab suite:

```
tests/lab-conversation.spec.ts:591:1 › @lab browser renders provisional delta and tool from verified combined SSE frames
Expected substring: "ev1%3A…%3A3"
Received string:    "/api/v1/events?after=ev1%3A…%3A2"
Timeout 5000ms exceeded while waiting on the predicate   (lab-conversation.spec.ts:653)
```

370 browser and 130 other lab cases passed in the same run; Go and contracts
passed. Load average was about 12 at the time. The same spec passed three
times in a row in isolation (`test-focused.sh --area browser --lab --spec
lab-conversation.spec.ts --tag "verified combined SSE"`, ~3 s each), and the
immediately following full gate run on the same tree passed (receipt 2026-10-24 20:58:02Z).

## Why it matters

A gated release has to rerun the whole ~10-minute gate when this case loses
its 5 s race under load. The assertion waits for the reconnect URL to carry
the new snapshot's cursor; under load the EventSource reconnect apparently
still uses the previous cursor when the 5 s poll ends.
