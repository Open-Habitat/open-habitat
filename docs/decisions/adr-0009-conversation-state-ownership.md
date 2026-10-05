# ADR 0009: Separate conversation content from application state

**Status:** Accepted — records Jari's starting points of 2026-10-02 in
[design-conversation-data-flow](../../issues/design-conversation-data-flow/item.md).

**Supersedes:** The single Redux synchronized-state model in
[ADR 0002](adr-0002-frontend-stack.md) for conversation data.

## Context

A streaming answer changes much faster than the conversation list or session
state. Its updates should reach the conversation being read without rerendering
the sidebar or background conversations.

## Decision

Keep application and session state in Redux. Use a small external store with
plain in-memory Maps for two kinds of conversation data: metadata and opened
history windows. Components subscribe through `useSyncExternalStore`, separately
for metadata and individual conversations, so updates reach only their subscribers.

One store belongs to one person in one browser tab. A new session for the same
person can retain it; logout, session expiry or a different identity clears it.
The event router and history pager feed this store. Components render its
snapshots rather than fetching their own copies of history.

The store and history reconciliation work independently of React, making event
sequences and page-loading races directly testable. This implements the
in-memory conversation views chosen in
[ADR 0008](adr-0008-snappy-conversation-switching.md); Pi remains the history
source. No database library or persistent browser history is added.

[Events and recovery](../architecture/events-and-recovery.md) describes the
implemented data flow and recovery behavior.
