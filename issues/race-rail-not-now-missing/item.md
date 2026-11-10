---
created: 2026-11-10
updated: 2026-11-10
type: bug
status: open
priority: normal
provenance: other
source_ref: taskfleet:01m71zxxabyvwy0h1y2tec6n4g/observed:rail-archive-handover-action
originating_run: 01m71zxxabyvwy0h1y2tec6n4g
originating_run_kind: spinoff
lane: gate-load-flakes
lane_seq: 6
preparation: ready
---

# Rail archive detector races handover and sometimes lacks Ei nyt on a finished reply

## Description

The unchanged `web/tests/rail-archive.spec.ts` passes at focused default 60 ms, but its desktop case failed 3/3 with `OH_REPLY_DELAY_MS=250 OH_REPLY_SEED=sweep-tooltip OH_BROWSER_WORKERS=2 OH_PORT_BASE=15900`, `--repeat-each 3`, on main product/spec tree fa85393db (Birch). Touch variant passed 3/3. Raw log: `/var/tmp/load-sweep-tooltip.log`.

Two distinct observations:

1. Twice the spec waited for the first message to become the row title, but the row still said `Uusi keskustelu`. It leaves the conversation as soon as the field is enabled, which also holds before kept input has been handed to Pi. Leaving that early correctly gives tab-kept input back instead of sending it. The spec needs actual handover before leaving/releasing its `pi-visual-hold` fixture.
2. Once the reply row and tooltip assertions passed, but `rail-not-now-conversation` was absent when the spec expected it as the first Tab stop. The row was still in Sinun vuorosi with `Uusi vastaus`; rename and archive were present. This was not tooltip interception or an inaccessible existing button: the Ei nyt button was missing.

A temporary probe (reverted, no assertion relaxation committed) used `openedConversation` before sending and polled native status for `run_active && native_history === 'present'` before leaving. It removed the title failures: 5/6 total executions passed, with one desktop case still missing Ei nyt (`/var/tmp/load-sweep-tooltip-final.log`). An earlier probe incorrectly expected `state === 'working'`; the captured native status says `state: accepted`, `run_active: true`, so that failed probe is not product evidence.

Investigate the second observation before making the spec green by omitting the keyboard assertion. In `web/src/app/railNow.ts`, runActive prefers the tab's status over the snapshot, and Ei nyt is suppressed when `live` is true. A status read just before leaving may remain active after the background turn settles while the attention record already says new reply. This is a source-grounded lead, not a confirmed root cause. A person would lack Ei nyt on a finished reply if that stale state persists. The final trace is under `web/test-results/rail-archive-a-rail-conver-89e14--comes-back-from-the-notice-chromium/trace.zip` in the sweep worktree (disposable).

Follow-up from load-race-sweep: finish the spec's handover readiness correction together with determining whether the absent settled-row action is a product defect or a transient precondition the test must await. Keep the held-background-turn and keyboard-order oracles. This is separate from the original sweep's tooltip overlap (the tooltip geometry/reachability checks passed).
