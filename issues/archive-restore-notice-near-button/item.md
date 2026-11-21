---
created: 2026-11-16
updated: 2026-11-21
type: improvement
reporter: jari
status: open
priority: normal
provenance: chat
source_ref: chat:2026-11-16/archive-restore-notice-near-button
lane: unlaned
lane_seq: 1
preparation: ready
---

# Archive restore failure notice appears at the top, far from the restore button

## Description

Jari 16.11.2026 (test server, pilot.772): when restoring a damaged archived conversation fails, the notice appears at the top of the view, while the restore button that caused it is at the bottom. He asks whether the notice should appear at the bottom, next to the button.

Follows archive-restore-damaged-history-banner (fixed 15.11.), which made the notice dismissable and scoped it to the conversation.

## Decisions

### 2026-11-21T08:05:32Z · @jari

Jari 21.11.2026: build directly without a prototype; the notice goes next to the button that started the action.
