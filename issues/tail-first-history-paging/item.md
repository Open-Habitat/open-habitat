---
created: 2026-10-02
updated: 2026-10-02
type: task
status: untriaged
priority: normal
provenance: other
source_ref: taskfleet:01m3x4p1t2nr61qyw6cz2cwrcm/implementation-slice:paging
originating_run: 01m3x4p1t2nr61qyw6cz2cwrcm
originating_run_kind: technical-decision
---

# Add native tail-first and backward history paging

## Goal

Opening a conversation shows its newest history without walking older pages
over HTTP. Scrolling back loads earlier content while preserving the reader's
place. This supplies the cold-open and recovery path for
[ADR 0008](../../docs/adr-0008-snappy-conversation-switching.md).

## Approach

Extend the history contract with a bounded newest page and a cursor for older
entries. Pi's selected native file remains the source; a daemon history index
or materialized copy is not needed. Bound response bytes as well as entry
count so a single large tool result cannot defeat paging limits.

Pages and separately loaded content need a revision that identifies the history
they belong to. A changed file makes an old paging cursor unusable: the browser
reloads the recent history instead of combining incompatible pages. The
current status revision is a size/mtime hint, whereas the history revision is
a content hash; their values cannot be compared as if they were the same kind
of revision. Choose the exact request and cursor shape in `contracts/v1/` and
regenerate its consumers.

Coordinate with @recent-conversation-windows on events arriving during a read.
An HTTP history response is not an atomic pair with the event stream. Stable
native entry identity and explicit revision behavior must let the browser
reconcile overlaps or reload when it cannot establish a coherent result.

## Acceptance criteria

- [ ] One initial history request returns the newest available entries within the response bounds, including for long histories.
- [ ] Older pages can be read backwards and merged in native order without missing or repeating entries in an unchanged history.
- [ ] File rewrites and appends have explicit, tested cursor behavior; incompatible history is detected instead of silently merged.
- [ ] Large entries and separate content reads respect byte limits and revision checks. Record the cost of reading long native files as well as HTTP request counts.

Validation follows TESTING.md; @recent-conversation-windows verifies the
resulting browser journey.
