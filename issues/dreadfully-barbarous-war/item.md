---
created: 2026-10-17
updated: 2026-10-21
type: improvement
status: done
priority: normal
provenance: other
provenance_detail: worker observation in lab while fixing conversation-live-glitches
source_ref: taskfleet:01m555vnz6mjghkc2gezzyeqdf/observation:queued-events-stall
originating_run: 01m555vnz6mjghkc2gezzyeqdf
originating_run_kind: spinoff
lane: web
lane_seq: 6
collision: [web/src/app/]
preparation: ready
closed: 2026-10-21
---

# Live stream pauses for the duration of a history catch-up read

## Description

# Live stream pauses while a history read is in flight

Found while fixing `conversation-live-glitches` (2026-10-17), synthetic lab evidence.

## What happens

`ConversationStore` (`web/src/app/conversationStore.ts`) queues every event for a
conversation window while a history read for it is in flight (`record.loading`;
`applyEvent`/`advanceWindow` push to `record.queued`, released by
`releaseQueued` after the read). This keeps one owner while history pages are
joined. A side effect: live text deltas also wait, so the streaming answer
stops for the whole duration of the read and then jumps ahead.

Reads happen during ordinary turns: a native write by Pi is announced as
`snapshot.invalidated/source_changed`, and after the answering snapshot
`reconcileStale` reads the window's history once; a `process.notification`
also triggers a catch-up read. On the test server a history read takes over a
second (gateway journal 2026-10-17: snapshot about 1.7 s; 1.2 s used as lab
history latency).

## Evidence

`web/tests/lab-long-stream.spec.ts` streams 200 words at 60 ms with a 1.2 s
history delay and 1.7 s snapshot delay. The visible word count holds still for
exactly 1.2 s once per turn (the read's latency) and then bursts; the spec
tolerates one stall under 2 s for this reason. Seen as `[1,true] … [21,true]`
in the sampled word counts.

## Impact

Every turn with a native write mid-stream pauses visibly for the history read
latency (more than a second live), which reads as a hiccup in the stream.

## Direction

Apply live-only fragment events (deltas, tool progress) to the window's live
turn immediately while a read is in flight, and queue only events that touch
history entries or recovery; the sequence bookkeeping must stay contiguous so
the queued events still apply after the read. Alternatively let the read join
without blocking events. Needs a design check against the "one owner until
every page is joined" invariant.

## Acceptance Criteria

- [x] Live text and tool progress advance during history reads without breaking stream sequence order.
- [x] History pages preserve newer streamed entries without treating new appends as overlap witnesses.
- [x] A gap or history notification crossing a read retains one follow-up recovery, with cancellation and read ownership preserved.
- [x] The delayed-history long-stream browser regression rejects a history-length streaming stall.
