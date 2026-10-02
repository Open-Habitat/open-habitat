---
created: 2026-10-02
updated: 2026-10-02
type: task
status: done
priority: normal
provenance: other
source_ref: taskfleet:01m3x4p1t2nr61qyw6cz2cwrcm/implementation-slice:journal
originating_run: 01m3x4p1t2nr61qyw6cz2cwrcm
originating_run_kind: technical-decision
lane: client-history
lane_seq: 35
blocked_by: ['@recent-conversation-windows']
closed: 2026-10-02
---

# Unify browser journal stream per identity

## Goal

One validated SSE connection per authenticated tab, independent of selected conversation. Implement the journal router from the [data-flow design](../../docs/conversation-data-flow.md). **Implementation order (prose only):** blocked_by @tail-first-history-paging and @recent-conversation-windows for final browser integration. Do not change scheduling metadata before Jari reviews the design.

## Scope and interface

Replace `App.tsx`'s catalog EventSource and `useConversation.ts`'s per-conversation EventSource with `conversationJournal.ts`. Its `start(snapshot)`, `resume(snapshot)`, `route(event)` and `stop()` own global cursor, instance, event-ID/sequence validation, replay/probe/reconnect, snapshot recovery and dispatch to `ConversationStore.applyEvent`/`applySnapshot`; unopened conversations advance the cursor without allocating windows. Receive `HistoryPager.reconnect` from @tail-first-history-paging for expired replay and @recent-conversation-windows' store for per-ID content and metadata. A refreshed snapshot must not reset the cursor backwards or discard concurrent events. Keep stale content readable during recovery. The router has no React dependency; `App` owns wiring and supplies identity/session lifecycle callbacks. Expose `onSnapshotNeeded` for user-scoped invalidations and `onStatusChange(id)` for `turn.settled`, `command.changed`, `queue.changed`, `question.*`; the status owner refreshes its cached status and continuation proof without requiring a read on warm switch. Agent-scoped `ring_truncated` means provisional tail loss with intact cursor: reload only that agent's tail, not the whole snapshot. Pi writes from a terminal are out of scope (@notice-terminal-pi-writes); no visibility listener or background snapshot polling. No read-only-view stream of its own.

Raise `internal/daemon/events_linux.go` replay ring from 128 events / 1 MiB to 1024 events / ~16 MiB (first bound hit wins), retaining a separate 1 MiB per-frame limit (browser validator rejects larger frames), bounded oversized-frame invalidation and per-agent `ring_truncated` recovery. An expired replay ring yields 409, not `ring_truncated`. Update corresponding tests; `contracts/v1/event.schema.json` remains the wire authority. `@browser-logout-cleanup` invokes `stop`, cancels pending work and fences late callbacks.

## Acceptance Criteria

- [x] Route switches never reopen SSE; one stream carries background events and changes metadata without allocating unopened windows.
- [x] Deterministic sequences test replay, duplicate and conflicting sequence/event ID, truncated replay, daemon restart, concurrent snapshot/events and independent tabs.
- [x] Ring tests prove both count and byte limits and truncated recovery; UI keeps stale text visible until reconciliation, never silently current.
- [x] TESTING.md validation and measured request counts demonstrate one SSE and zero warm-switch requests.

## Test server (pilot.17, 2026-10-02)

`0.0.0-pilot.17` (source `a3a3f127`) is installed on the test VM; operator and route checks passed. Jari: reload and try one SSE stream per tab across switches, background text continuing when switching away mid-turn and back, then reload and logout. Real authenticated browser/GitHub/Pi use is still unverified; also retry pilot.16 browser fixes, Pi dialogs and large clone progress.
