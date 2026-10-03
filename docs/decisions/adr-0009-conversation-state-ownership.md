# ADR 0009: Separate conversation content from application state

**Status:** Accepted — records Jari's starting points of 2026-10-02 in
[design-conversation-data-flow](../../issues/design-conversation-data-flow/item.md).

**Supersedes:** The single Redux synchronized-state model in
[ADR 0002](adr-0002-frontend-stack.md) for conversation data.

## Decision

Keep application and session state in Redux. Hold conversation metadata and
opened history windows in a small external store, using two plain in-memory
Maps. Components subscribe through `useSyncExternalStore`, separately for
metadata and individual conversations. A streaming answer can then update
its conversation without rerendering the sidebar or background conversations.

One store belongs to one person in one browser tab. A new session for the same
person can retain it; logout, session expiry or a different identity clears it.
The event router and history pager feed this store. Components render its
snapshots rather than fetching their own copies of history.

The store and history reconciliation work independently of React, making event
sequences and page-loading races directly testable. This implements the
in-memory conversation views chosen in
[ADR 0008](adr-0008-snappy-conversation-switching.md); Pi remains the history
source. No database library or persistent browser history is added.

[Conversation data flow](../architecture/events-and-recovery.md) describes the planned
module responsibilities and behavior. Implementation is tracked in its linked
issues.
