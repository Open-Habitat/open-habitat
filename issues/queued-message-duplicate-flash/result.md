# Result — reproduced and fixed

## Cause

Pi keeps one run going past a reply when it takes a queued message: the
reply's `message_end` (Pi writes the message to its JSONL right after
emitting it), `turn_end`, then `turn_start` and the follow-up's user message,
with no `agent_end` in between (`pi-agent-core` `agent-loop.js`, the
follow-up branch). The daemon publishes a run's `history.entry` events only
when the run settles, so the reply's streamed fragments stay live for the
whole follow-up. Meanwhile each native write raises a global
`snapshot.invalidated`, and the browser quietly re-reads history: that page
already has the reply and the queued message. The timeline then drew saved
reply, saved queued message, and the reply's live copy below them, until
settlement's `history.entry` retired the fragments. Tool-call messages were
already covered by the saved-call filter in `BrowserConversation.tsx`; a
plain-text reply had no identity to match.

The earlier probe could not see this because the default fake Pi does not
stream reply text; with `pi-deltas` it fails at once (the first reply twice
in several consecutive DOM samples).

## Fix

`retireEndedTurns` (`web/src/app/conversationEvents.ts`), applied in
`ConversationStore.applyPage` to the newest page of a tail or reconnect read:
the store records how far the stream had come when the read began, and the
page retires the streamed message and tool content of every model turn that
had ended (`turn_end`, or `agent_end` in the fake's shape) before that point.
Pi wrote those messages before the turn ended, so a read begun later shows
them. Lifecycle signals (the turn clock), extension status and `!` command
output stay. No text matching.

## Evidence

- `web/tests/queued-send.spec.ts` "a queued follow-up never duplicates the
  preceding reply at turn end", now on `pi-deltas`: failed before the fix
  (duplicate in many samples), passes after. Whole spec 14/14 passed.
- `conversationStore.test.tsx`: Pi's real order (no `agent_end`), a read
  begun before `turn_end` keeps the reply live, one begun after retires it
  and keeps the next reply's deltas; fails without the fix.
- Also passed: `lab-live-turn`, `lab-conversation-scroll`,
  `lab-reply-selection`, `lab-composer-live-focus`; `test-focused --area web`.

Synthetic host only; not yet seen on the test server.

## Decisions for later review

- Fixed in the browser store rather than making the daemon publish each
  model turn's entries at `turn_end`. The daemon route would also be correct
  but reads the native file once per model turn (long tool runs have
  hundreds) and changes the event contract's timing; the browser already
  re-reads at those points.
- The fake Pi still emits `agent_end`/`agent_start` between follow-up turns,
  unlike real Pi. Left as is: other specs depend on its shape, and the fix
  treats both boundaries alike; the unit test carries the real order.
