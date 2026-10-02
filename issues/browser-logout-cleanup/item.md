---
created: 2026-10-02
updated: 2026-10-02
type: task
reporter: jari
status: done
priority: normal
related: ['@one-browser-event-stream', '@recent-conversation-windows']
lane: client-history
lane_seq: 40
collision: [web/src/app/]
blocked_by: ['@one-browser-event-stream']
closed: 2026-10-02
closed_by: agent
commits:
- hash: 82ae2bbbd7a14c2cc5f9a46df383d8f9b64097c1
  summary: 'test(web): seed stale draft before expired page reload'
- hash: 271666cdbedc9c048d1394a9e449892d5c157c67
  summary: 'fix(web): clear expired tab drafts after a reload without identity'
- hash: a41df85d2adce902353a04bdbac9ace96ec8e40a
  summary: 'fix(web): dispose person-scoped browser state on session loss'
---

# Clean up browser streams and state on logout

## Goal

Logout stops listeners and clears this person's browser data, including retained conversation windows; session expiry and a confirmed different identity use the same path. See [conversation data-flow](../../docs/conversation-data-flow.md). **Implementation order (prose only):** blocked_by @recent-conversation-windows and @one-browser-event-stream for their disposal APIs; do not change scheduling metadata until Jari reviews the design.

## Scope and interface

`App.tsx` owns session transitions, not `conversationJournal.ts` or `conversationStore.ts`. Call router `stop()`, pager `cancelAll()` and store `dispose()`; invalidate an identity/session generation so late events, reads and status responses cannot repopulate old content. Clear `nah:<identity>:` sessionStorage drafts and pending-command markers, and existing Redux/user-specific state. A new login as the **same** person without logout can retain a stale window pending validation; explicit logout or expiry destroys it. Different `web_identity_id` always destroys old data. Another tab has its own local store and connection. Keep logout server failure truthful: local concealment is not proof the server session ended; do not alter ADR 0006's operator revocation semantics.

## Acceptance Criteria

- [x] Logout closes stream/reconnect timers, cancels reads and blocks late writes to cleared local state.
- [x] Identity replacement and expiry clear the old store, UI, drafts and pending reads; later login starts normally.
- [x] Tests cover logout during a turn and a pending page, same-/different-person relogin, and server logout failure. Validate per TESTING.md.
