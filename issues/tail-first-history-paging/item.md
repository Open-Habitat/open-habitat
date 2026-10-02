---
created: 2026-10-02
updated: 2026-10-02
type: task
status: open
priority: normal
provenance: other
source_ref: taskfleet:01m3x4p1t2nr61qyw6cz2cwrcm/implementation-slice:paging
originating_run: 01m3x4p1t2nr61qyw6cz2cwrcm
originating_run_kind: technical-decision
lane: client-history
lane_seq: 20
---

# Add native tail-first and backward history paging

## Goal

Read the newest entries of Pi's selected native history first, then older entries on scroll or bounded recovery. This is the first implementation slice of the [data-flow design](../../docs/conversation-data-flow.md). No scheduling metadata changes yet.

## Scope and interface

Extend `contracts/v1/history.schema.json` and generated clients with newest-page request, a `before` cursor that is the boundary `entry_key`, and explicit older-complete edge; retain native entry order and `entry_key`. Return the boundary entry on backward reads (or an equivalent validated shared-key witness), since the store cannot join two disjoint pages by guessing adjacency. Change `internal/daemon/history_linux.go` (currently oldest-first `after` and full-file parse), not the daemon's identity/command authority or a new history index. Bound response bytes even for one huge entry; keep separate content reads tied to native revision. `status.native_revision` (size/mtime hint) is not history `native_revision` (hash). Pi appends only, so an append leaves the cursor usable; if the boundary key is not found, the response says so and the browser reloads the newest page. No prefix proof or content hash in the cursor.

Expose a React-free `conversationPager.ts` with `tail(id, signal)`, `older(id, cursor, signal)`, `reconnect(id, heldKeys, maxPages, signal)` returning `{ pages, met }`, `cancelAll()` as specified in the design. It owns HTTP validation (`history.ts` / `HistoryView.tsx`'s `readHistoryFetch`), request cancellation and bounded newest-to-oldest reads. Return validated pages to @recent-conversation-windows; that issue alone decides window merges and scroll anchoring. A 404 on a new controlled conversation can mean confirmed missing native history, not a failed open. @one-browser-event-stream invokes recovery, not a second pager. **Implementation order (prose only):** @recent-conversation-windows blocked_by this contract; @one-browser-event-stream integration blocked_by both.

## Acceptance Criteria

- [x] One request gets newest bounded entries, including long files; backward pages cover unchanged native history in native order without duplication.
- [x] Appends leave older-page cursors usable; a missing boundary key is reported and leads to a tail reload, never a guessed join.
- [x] Large entries and separate content reads respect byte limits and revisions; measure full-file read cost and HTTP counts.
- [ ] Contract generation and TESTING.md checks pass; the browser store can consume the documented pager API.
