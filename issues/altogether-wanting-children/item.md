---
created: 2026-11-17
updated: 2026-11-21
type: bug
status: fixed
priority: normal
provenance: other
provenance_detail: observed while verifying a run
source_ref: taskfleet:01m7mwjysd6phg3fjg5eyqz122/observed:browser-conversation-flakes
originating_run: 01m7mwjysd6phg3fjg5eyqz122
originating_run_kind: spinoff
lane: test-stability
lane_seq: 2
preparation: ready
closed: 2026-11-21
---

# browser-conversation spec cases fail intermittently on main under reply jitter

## Description

Observed on an unchanged `main` checkout (synthetic browser host, `OH_BROWSER_WORKERS=3`, `OH_REPLY_DELAY_MS=60`, `--repeat-each 3`/`4`). These cases in `web/tests/browser-conversation.spec.ts` fail intermittently, about a third to a half of runs each:

- `logout fences a pending status read and turn even when server logout fails` (`conversation-recheck` never becomes visible)
- `malformed host status fails closed without rendering HTML` (header archive/close control not visible)
- `a steer that arrives after the turn ended is sent, not refused` (input value mismatch)
- `queue-clear 401 reaches login`
- `a stale working view cannot strand an unsent queued draft`

Each fails the same way on main and on a branch that only changes conversation scroll restore, so these are pre-existing ordering or timing assumptions under reply jitter, not a regression. Reproduce: `npx playwright test tests/browser-conversation.spec.ts --grep "<case>" --repeat-each 4` with focused-run jitter.

## Resolution

### 2026-11-21T15:40:07Z · @issuectl

Steer/queue refusal during a routine status re-read fixed in the product; logout and malformed fixtures now act only on the explicit check's read. See result.md.
