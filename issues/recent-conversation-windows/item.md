---
created: 2026-10-02
updated: 2026-10-02
type: task
status: untriaged
priority: normal
provenance: other
source_ref: taskfleet:01m3x4p1t2nr61qyw6cz2cwrcm/implementation-slice:windows
originating_run: 01m3x4p1t2nr61qyw6cz2cwrcm
originating_run_kind: technical-decision
---

# Keep bounded recent conversation windows in browser

## Goal

Returning to a recently viewed conversation shows its content immediately,
without a network wait. Background conversations stay up to date as events
arrive. Both read-only native histories and browser-controlled conversations
use this behavior, as agreed in
[ADR 0008](../../docs/adr-0008-snappy-conversation-switching.md).

## Approach

Retain bounded conversation data in this tab's memory and render the selected
view. Use @one-browser-event-stream for updates and @tail-first-history-paging
for cold opens, older history and recovery. Preserve the reading position when
the relevant content remains available; allow a load when it has been evicted.
Deep pages can be released before the recent content needed for switching.

Use generous, adjustable limits for conversation count, entries and total
retained bytes. Favour keeping recently viewed content available over minimizing
memory use. Measure realistic switching and large tool output to guide later
tuning. Retain the data without keeping every conversation's component tree
mounted.

Apply saved native entries by native identity, replacing provisional streaming
output rather than concatenating it with the saved answer. A history load and
concurrent events can overlap: reconcile them without losing or duplicating a
turn, and reload when their relationship is ambiguous. Incomplete provisional
output needs recovery rather than display as a complete answer. Keep history
revision checks separate from the status metadata hint.

Known-stale content can remain readable with an explicit state while selected
history is reconciled. History remains disposable memory, while existing drafts
and uncertain-send handling keep their own semantics. Expose disposal of the
retained views to @browser-logout-cleanup, which owns session-end cleanup.

## Acceptance criteria

- [ ] Returning to retained conversations renders without waiting for a request, for both controlled and read-only histories; switching does not restart the event connection.
- [ ] Background turns, concurrent page loads and another tab's updates produce coherent saved and provisional content.
- [ ] Reload, eviction and deep scrolling load the needed history and preserve the reading position where its anchor survives.
- [ ] Gap recovery, native file changes and daemon restart cannot silently mix incompatible content.
- [ ] Conversation switching is significantly faster than the current fetch-on-open behavior. Compare click-to-paint, request counts and memory under realistic and large-output workloads.

Validation follows TESTING.md. Store the measured limits and their reasoning
with the implementation results so later tuning has a baseline.
