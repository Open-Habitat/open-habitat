---
created: 2026-11-15
updated: 2026-11-15
type: bug
reporter: jari
status: fixed
priority: normal
provenance: chat
source_ref: chat:2026-11-15/first-message-flicker
lane: conversation-live
lane_seq: 2
collision: [web/src/app/BrowserConversation.tsx]
preparation: ready
closed: 2026-11-15
---

# Conversation flickers when the first message is sent in a new conversation

## Description

Jari 15.11.2026 (test server): when sending the first message in a new conversation, the conversation view jumps around very fast for a moment, so that it feels like flickering.

Likely the hand-over from the new-conversation composer (no Pi session yet, history missing) to the live conversation: optimistic message, session creation, the first history read, the rail moving the row, the layout of the empty state vs. the timeline, the composer moving from the centre to the bottom.

## Acceptance Criteria

- [x] Measure synthetic first-send layout transitions and identify causes before changing code.
- [x] Preserve the frame, stream, input and sent-message element through first native-history takeover on desktop and phone, without an empty-state flash.
- [x] Five repetitions per viewport and send phase pass under CPU/reply-delay load, with total layout shift below 0.05.
- [x] Verify held/queued/recovery journeys and complete targeted independent review; record evidence and limitations in result.md.
