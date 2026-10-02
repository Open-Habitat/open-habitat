# ADR 0008: Keep recent conversation windows in the browser

**Status:** Accepted — Jari agreed to the revised direction in
[design-snappy-conversation-switching](../issues/design-snappy-conversation-switching/item.md), 2026-10-02.

## Context

Returning to a conversation just viewed should feel immediate. The browser
currently discards its view on a conversation switch and requests history
again. Even a fast server cannot remove that network wait. In the synthetic
read-only switching sample, each return made a history request and took about
100–117 ms. These are local lab observations, not production latency estimates.

## Decision

Keep the recent content of opened conversations in bounded browser memory.
Switching to a retained conversation renders that content immediately without
waiting for a server request. One event connection per authenticated browser
tab receives the user's conversation events and updates retained conversations
in the background. Switching conversations does not restart the connection.
Read-only histories and browser-controlled conversations use the same approach.

Pi's native files remain the history source. The browser holds a disposable
view of content it has read or received from the user's daemon; losing it
loses no user work. History is not persisted in browser storage. Each tab has
its own view and connection. The gateway still authenticates and routes the
user, and the daemon still decides whether commands can run.

Load history from the newest entries first and fetch older entries when the
reader scrolls back. A page reload, a conversation no longer retained in memory,
or deep scrolling may wait for a server response. Retention limits should keep
recent switching useful while bounding memory even with large tool output.
Start with generous, adjustable limits so recently viewed conversations remain
available. The goal is significantly faster conversation switching.

During a connection break, already loaded text remains readable with its
connection state visible. On recovery, reconcile missed events with native
history before presenting the view as current. Streaming output remains
provisional until native history records it, so recovery cannot silently lose
or duplicate part of an answer.

## Why this approach

Keeping a bounded view in memory serves the concrete need to return without
network delay. Fetching on every switch cannot do that. Persisting histories
in IndexedDB adds lifecycle and sensitive-data retention concerns without a
need to make reloads immediate. Loading every conversation in advance spends
resources on content the person may never open. Retain conversation data;
keeping every conversation's rendered component tree alive is unnecessary.

## Implementation and evidence

[One browser event stream](../issues/one-browser-event-stream/item.md) owns
connection lifetime and recovery;
[tail-first history paging](../issues/tail-first-history-paging/item.md) owns
native history reads; and
[recent conversation windows](../issues/recent-conversation-windows/item.md)
owns retention, incremental display and the measured switching experience.
[Browser logout cleanup](../issues/browser-logout-cleanup/item.md) owns stopping
stream listeners and clearing user-specific browser state when the session ends.
These changes are not implemented by this decision.

The [measurements](../issues/design-snappy-conversation-switching/measurements.md)
identify the inspected revision and the limits of the lab evidence. The
[simulation](../issues/design-snappy-conversation-switching/simulation-output.txt)
estimates event traffic and memory under stated assumptions; CPU and heap
factors are assumptions, not profiler results.
