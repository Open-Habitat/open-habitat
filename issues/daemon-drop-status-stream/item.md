---
created: 2026-10-01
updated: 2026-10-01
type: task
reporter: jari
status: done
priority: high
related: ['@architecture-built-on-caution']
lane: caution-removal
lane_seq: 40
blocked_by: ['@daemon-validate-startup']
closed: 2026-10-01
closed_by: claude
---

# Delete the conversation status stream; status on demand

## Goal

Step 4 of the [architecture review](../../docs/reviews/architecture-review-2026-10.md) removal plan. Delete the per-conversation status stream; status is served on demand and the events journal is the only push channel.

## Scope

- Delete `ConversationController.stream`, `streamSeq`, `conversationStreamFrameLimit` and the `httptest.NewRecorder` use (D5); gateway route and forwarder for `/stream` go with it.
- `observe`: `stat` the native file for `native_history` and `native_revision` instead of reading it (D6); compute `continuation` only when explicitly requested on opening an ended conversation (the query flag or route is an implementation choice) and in `continueEnded` (D7). Never run a proof on a tick.
- Events stream (`eventJournal.stream`): long-lived (start with a 10-minute lifetime and 20 s heartbeat), validity checked once at open; gateway forwarder follows (D8).
- Audit that every status transition is published: `command.changed`, `turn.settled`, `question.requested`, `queue.changed`, `snapshot.invalidated`. `auth_error` is set on `message_end`, which already invalidates.
- Browser: a minimal adaptation so the current UI keeps working (open the events stream, refresh status on events); the full browser rewrite is @browser-state-rewrite.
- `docs/interfaces.md`: remove the temporary stream route and the 2 s cadence text.

File metadata provides a cheap change hint; it does not prove that history is
readable or valid. The history reader owns that result. Reflect the distinction
in the status contract and browser adaptation rather than reporting a successful
history read that never happened.

## Result to establish

An idle conversation no longer causes periodic status requests or full history
reads while the journal stream is healthy. Opening an ended conversation can
request a continuation proof; ordinary status reads do not run it. Continue
still makes its own admission decision.

Journal replay, gap recovery and native invalidations continue to work, and
send, abort, queue, question and authentication-failure changes reach the UI.
Replace status-stream tests with evidence for those outcomes and the cheap
status path. A lab observation records request counts and heartbeat cadence;
it does not establish live-server performance.

Test selection and the final gate follow [TESTING.md](../../TESTING.md).

## Resolution

### 2026-10-01T21:31:37Z · @claude

Removed the conversation status stream and periodic status/history reads. The events journal is the only conversation push channel; it opens immediately, rotates after ten minutes, and heartbeats every 20 seconds. Status uses native-file metadata and only proves continuation on explicit request or admission. Browser reconnect, HTTP fallback, journal replay/invalidation, and lab observations are covered by regression tests. The clean committed-tree gate passed on 17423de; issuectl doctor and git diff --check were clean. Independent review findings were addressed.
