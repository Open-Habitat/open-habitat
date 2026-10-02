---
created: 2026-10-02
updated: 2026-10-02
type: task
reporter: jari
status: testing
priority: high
related: ['@one-browser-event-stream', '@tail-first-history-paging', '@recent-conversation-windows']
lane: client-history
lane_seq: 15
---

# Design the conversation data flow and browser store

## Goal

Before implementing [ADR 0008](../../docs/adr-0008-snappy-conversation-switching.md),
design the software structure through which a Pi session's content reaches the
web UI and where and how the browser holds it. The focus is the web end; the
daemon/gateway side is covered where the browser structure depends on it
(history paging contract, entry identity, revisions, journal replay). The
three implementation issues @one-browser-event-stream,
@tail-first-history-paging and @recent-conversation-windows are then sharpened
to follow the design, so that their workers build parts of one store instead
of inventing three. @browser-logout-cleanup hooks into the same lifecycle.

## Agreed starting points (Jari, 2026-10-02)

These are the starting point, not a fixed contract. Anything later that would
make this design more complex or add to it (a review finding, an idea, an
extra safeguard) needs Jari's separate approval; review suggestions about
hypothetical problems do not change the architecture. A real problem met
during implementation that is best solved by changing the design may change
it; the change is documented for Jari with the problem and evidence, and he
approves it with the work (see `AGENTS-WORKFLOW.md`).

- **One store per person.** Keyed by `web_identity_id` (provider + subject,
  i.e. the person bound to the Unix user), not by browser session. A new login
  as the same person keeps it; a different person discards it entirely.
- **Two in-memory structures, plain `Map`s, no database library:**
  conversation metadata (title, status, running/idle, freshness, last change)
  for the sidebar and header, and per-conversation history windows (ordered
  entries, lookup by `entry_key`, window edge cursors, provisional live turn)
  for the conversation view. They change at different rates; a streaming turn
  must not re-render the sidebar. No IndexedDB (ADR 0008).
- **Own small store beside Redux.** Redux (`web/src/app/store.ts`) keeps app
  and session state; streamed history lives in a small external store that
  components subscribe to (`useSyncExternalStore`). Components do not fetch;
  the conversation view is not remounted per conversation id.
- **Merge by native identity.** A history page and concurrent events are
  combined by `entry_key`: same key is the same entry, newer keys append, a
  saved entry replaces the matching provisional streamed output. If a page and
  the window share no key, their relationship is unknown: replace the window,
  never guess.
- **Contiguous window invariant (keep it simple).** Each conversation's window
  is always one contiguous range from the oldest loaded to the newest entry;
  gaps cannot exist. Short break: journal replay continues the window. Long
  break (replay truncated, daemon restart): fetch the newest page and page
  backwards a bounded number of pages until meeting a key already held, then
  join; if the bound is hit first, drop the old range and keep the new tail.
  Older content then loads on scroll-back (a legitimate spinner). Old content
  stays readable, marked stale, while this happens.
- **Placeholder eviction.** Keep about 50 conversations; when exceeded, drop
  the least recently viewed conversation entirely. No byte accounting, no
  per-page release. Proper retention is a later issue (file it, unlaned).
- **Journal replay ring.** Raise the daemon's replay window from 128 events to
  1024 events with a byte cap (about 16 MiB), whichever is hit first; exceeding
  either yields the existing `ring_truncated` recovery. Implementation belongs
  to @one-browser-event-stream.
- **Testability.** Store, event router and reconciliation are pure logic
  without React, tested with deterministic event sequences (gap, race, daemon
  restart, identity change, eviction).

## Deliverable

A design document in `docs/` written per `docs/AGENTS.md` (Finnish, plain
language, what happens before abstractions), linked from `docs/index.md` and
ADR 0008: the data path Pi file → daemon history reader/journal → gateway →
browser stream and pages → store → components; the module split and their
interfaces (types); what happens per situation (page load, switch, running
turn, short and long break, scroll-back, cold open, eviction, logout/identity
change, second tab); writes (send, abort, queue, dialogs) and how they relate
to the store while keeping the pending/accepted/uncertain semantics and
sessionStorage drafts; test strategy. Then update the three implementation
issues (and @browser-logout-cleanup if needed) so scope boundaries follow the
module split, and decide whether @incremental-history-during-turn is absorbed
(close as duplicate with a pointer) or remains. Jari reviews the document
before the implementation issues are laned.

## Comments

### 2026-10-02T05:53:43Z · @claude

Suunnitelma docs/conversation-data-flow.md on valmis Jarin katselmointiin. Avoimia päätöskysymyksiä ei löytynyt; toteutusissuet rajattu sen mukaan. Riippumaton review ja löydösten arviointi: history/review-conversation-data-flow.md ja history/assessment-conversation-data-flow.md (paikallinen, gitignore). Täyttä CI-porttia ei ajettu uudelleen: vain dokumentit ja issuet muuttuivat.
