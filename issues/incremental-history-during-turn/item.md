---
created: 2026-10-02
updated: 2026-10-02
type: improvement
reporter: claude
status: open
priority: normal
provenance: chat
source_ref: chat:2026-10-02/history-reads
lane: client-history
lane_seq: 20
blocked_by: ['@design-snappy-conversation-switching']
---

# Read only new history entries during a running turn

## Description

During a running Pi turn, every `history.entry`, `turn.settled` and similar journal event makes `useConversation.refresh` (web/src/app/useConversation.ts) fetch status and re-read history from the first page, then page forward with the cursor until it reaches the known tail. The daemon reads the native history file for each of these reads. While a conversation is idle and the events stream is healthy there are no reads at all, so the cost is only during active turns.

Observed by code reading on 2026-10-02 after @browser-state-rewrite, answering Jari's question about how much the browser talks to the server. No measurement yet.

ADR [0008](../../docs/adr-0008-snappy-conversation-switching.md) covers incremental history during a turn as part of the proposed switching design.

Possible direction: on `history.entry`, read forward from the last known `entry_key` instead of from the first page, and fall back to a full read only on a prefix mismatch or invalidation. Measure request counts in the lab during a multi-tool turn before and after. Conversation switching (two requests plus a new events stream per switch, no browser-side history copy) is intentionally left as is until pilot.15 shows it feels slow; a browser history cache would be a second copy of native truth.
