---
created: 2026-10-01
updated: 2026-10-01
type: task
reporter: jari
status: open
priority: high
related: ['@architecture-built-on-caution']
lane: caution-removal
lane_seq: 40
blocked_by: ['@daemon-validate-startup']
---

# Delete the conversation status stream; status on demand

## Goal

Step 4 of the [architecture review](../../docs/reviews/architecture-review-2026-10.md) removal plan. Delete the per-conversation status stream; status is served on demand and the events journal is the only push channel.

## Scope

- Delete `ConversationController.stream`, `streamSeq`, `conversationStreamFrameLimit` and the `httptest.NewRecorder` use (D5); gateway route and forwarder for `/stream` go with it.
- `observe`: `stat` the native file for `native_history` and `native_revision` instead of reading it (D6); compute `continuation` only when the request asks (query flag) and in `continueEnded` (D7). Never run a proof on a tick.
- Events stream (`eventJournal.stream`): lifetime 10 minutes, heartbeat 20 s, validity checked once at open; gateway forwarder follows (D8).
- Audit that every status transition is published: `command.changed`, `turn.settled`, `question.requested`, `queue.changed`, `snapshot.invalidated`. `auth_error` is set on `message_end`, which already invalidates.
- Browser: a minimal adaptation so the current UI keeps working (open the events stream, refresh status on events); the full browser rewrite is @browser-state-rewrite.
- `docs/interfaces.md`: remove the temporary stream route and the 2 s cadence text.

## Acceptance Criteria

- [ ] `TestConversationStreamDoesNotProbeOrRevoke` and `TestConversationStreamCursorAndNativeRecovery` deleted; `TestEventStreamExactReplayAndLastEventID` and the journal tests unchanged.
- [ ] New test: status for an ended conversation runs one continuation proof per explicit request and none otherwise; status for a live conversation reads no history file.
- [ ] Lab measurement (`scripts/lab.sh`): one idle open conversation tab makes no `/status` request and keeps one events stream open with 3 heartbeats per minute.
