---
created: 2026-11-16
updated: 2026-11-21
type: bug
status: fixed
priority: normal
provenance: other
source_ref: taskfleet:01m7hkw6a8hfyrr0s5mjrt6hgv/browser-conversation-repeat-flakes
originating_run: 01m7hkw6a8hfyrr0s5mjrt6hgv
originating_run_kind: spinoff
lane: test-stability
lane_seq: 3
preparation: ready
closed: 2026-11-21
---

# browser-conversation spec fails under repeat-each 3 on main

## Description

## Problem

`web/tests/browser-conversation.spec.ts` is not repeat-stable on the shared
development host at main 524acd6c. With `OH_BROWSER_WORKERS=2`,
`OH_REPLY_DELAY_MS=60` and `--repeat-each 3` (264 cases, host load about
3–6 on 8 cores), main failed 9 cases and the same command on a branch that
only changes archive refusal scoping failed 8. Most failures are
`toBeVisible` timeouts at 5 s.

Cases that failed on main, several more than once:

- `:1815` logout fences a pending status read and turn even when server logout fails (3/3 on main, 2/3 on the branch)
- `:2953` lost accepted reply recovers on HTTP snapshot without an event
- `:3338` queued command with pending ack stays pending without a receipt
- `:3075` a send whose acknowledgement a daemon restart lost resolves from history (live)
- `:3522` empty browser conversation closes without confirmation
- `:1469` a steer that arrives after the turn ended is sent, not refused
- `:428` own message shows every line it fits; a clipped one fades only its last

Also seen on the branch run: `:1370`, `:1559`, `:1137`, `:2824`.

## Reproduce

```
cd web
OH_REPLY_DELAY_MS=60 OH_BROWSER_WORKERS=2 npx playwright test --repeat-each 3 tests/browser-conversation.spec.ts
```

## Done when

The spec is green with `--repeat-each 3` at small worker counts under
ordinary host load, or each failing case is shown to be a product race and
fixed.

## Resolution

### 2026-11-21T17:21:34Z · @issuectl

Whole spec green at --repeat-each 3, plain and at CPU 4x, on the final branch head; see result.md.
