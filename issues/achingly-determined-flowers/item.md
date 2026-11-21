---
created: 2026-11-21
updated: 2026-11-21
type: bug
status: untriaged
priority: normal
provenance: other
provenance_detail: observed while fixing the deterministic browser-conversation archive failures
source_ref: taskfleet:01m7zjeh33a9dp65mqhybnvpef/observed:restored-stop-live-notice
originating_run: 01m7zjeh33a9dp65mqhybnvpef
originating_run_kind: spinoff
---

# Restored conversation's starting turn can flash a raw Pi notice before a stop

## Description

## Problem

`web/tests/browser-conversation.spec.ts` case "a turn stopped in a restored
conversation ends calmly and stays marked" failed once in four whole-spec runs
with `OH_BROWSER_WORKERS=2` (the default focused 60 ms reply jitter). The stop
sampler recorded one animation frame, before the stop was pressed and while
the turn was running, in which an inline notice was shown inside the live work
(`.ah-live-work .ah-notice`: a raw Pi agent-status or extension notice). The
case asserts that no such frame appears.

The case could not reach this step before the archive helper check was made
deterministic in the synthetic host (it stopped at the archive question), so
this is newly exposed, not newly introduced. In isolation it passed 8/8 with
`--repeat-each 8`; it shows only under whole-spec load. In this case the send
starts Pi in a restored conversation, so a Pi lifecycle event during start-up
is a likely source.

## Reproduce

```
OH_BROWSER_WORKERS=2 ./scripts/test-focused.sh --area browser --spec browser-conversation.spec.ts
```

Repeat until the case fails; the assertion is the empty `stopStates` filter
after the stop.

## Done when

Either the notice that briefly appears in a restored conversation's starting
turn is identified and kept out of the live work (if it is a raw lifecycle
signal the person should not see), or the case is shown to be racing the
fixture and fixed without weakening the assertion.
