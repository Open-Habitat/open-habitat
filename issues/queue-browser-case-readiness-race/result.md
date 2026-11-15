# Result

Fixed the test, not the product. The queue case now waits for the steering
Send control to stop reporting `aria-busy` and become enabled before pressing
Alt+Enter. Stop visibility only establishes that a turn is running.

## Evidence

All browser runs used fresh synthetic hosts, `OH_PORT_BASE=22900`,
`OH_BROWSER_WORKERS=2`, `OH_REPLY_DELAY_MS=60`, and
`OH_REPLY_SEED=flicker-regressions`.

- Baseline: five repetitions passed; a subsequent 20-repetition run failed
  once with `jonoon yksi` retained in the editor.
- The failing trace showed Send with `data-mode="steer"`,
  `aria-disabled="true"` and `aria-busy="true"` before Alt+Enter. Afterwards,
  `composer-notice` was an alert explaining that the message was not sent
  because status was stale. The input was visibly refused, not silently lost.
- Waiting for enabled alone was insufficient: 3/20 repetitions failed.
  A trace showed Send briefly enabled while still busy with the first send,
  then disabled again during the keyboard action. Waiting for the pending
  send to settle as well removes that premature readiness observation.
- Final change: **20/20 repetitions passed**, with retries disabled (26.0 s).
  Command from `web/`: `npx playwright test tests/browser-conversation.spec.ts
  --grep 'steer, follow-up and clear' --repeat-each 20`.
- Final focused entrypoint: `./scripts/test-focused.sh --area browser --spec
  browser-conversation.spec.ts --tag 'steer, follow-up and clear'` passed.
- `./scripts/test-focused.sh --area web` passed: static checks and 227 test
  files / 1801 tests. No whole browser suite or full gate was run.

The production bundle was rebuilt through browser setup; subsequent runs reused
that unchanged bundle. This is host-backed synthetic evidence, not a live-host
or real-provider qualification.

## Focused self-review

Checked the test against `Composer.tsx`'s keyboard handler, `sendBlocked`,
`sendReady`, and Send's ARIA state, and `BrowserConversation.tsx`'s pending and
stale-status availability. The two waits use product-owned indicators, after
filling the draft (an empty draft itself disables Send). The mode constraint
also ensures Alt+Enter means follow-up rather than a direct idle send.
All existing queue-order, restored-text, removal and native-content assertions
remain unchanged. No fixed delay, retry, timeout increase or production change
was added.

## Decisions for later review

- Keep the existing visible-refusal behavior rather than introduce a new
  automatic queue for stale status. The trace establishes that the early key
  press already preserves the draft and explains the refusal; this case is
  testing queue restoration, not submission while status is unsettled.
- Wait for both pending completion and enabled steering, rather than Stop or
  enabled alone. The intermediate failed experiment demonstrates why both
  indicators matter.

Live check: On the test server, start a long turn, wait for Send to finish its
pending state, then use Alt+Enter for a follow-up and Send for steering. Restore
the queue and check that only those two texts return to the composer. No
user-facing behavior changed in this fix.
