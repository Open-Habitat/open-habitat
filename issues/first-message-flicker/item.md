---
created: 2026-11-15
updated: 2026-11-15
type: bug
reporter: jari
status: open
priority: normal
provenance: chat
source_ref: chat:2026-11-15/first-message-flicker
lane: conversation-live
lane_seq: 2
collision: [web/src/app/BrowserConversation.tsx]
preparation: ready
---

# Conversation flickers when the first message is sent in a new conversation

## Description

Jari 15.11.2026 (test server): when sending the first message in a new conversation, the conversation view jumps around very fast for a moment, so that it feels like flickering.

Likely the hand-over from the new-conversation composer (no Pi session yet, history missing) to the live conversation: optimistic message, session creation, the first history read, the rail moving the row, the layout of the empty state vs. the timeline, the composer moving from the centre to the bottom.
