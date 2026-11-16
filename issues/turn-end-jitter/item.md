---
created: 2026-11-16
updated: 2026-11-16
type: bug
reporter: jari
status: open
priority: normal
related: ['@conversation-live-glitches', '@first-message-flicker']
lane: conversation-live
collision: [web/src/app/BrowserConversation.tsx]
preparation: ready
---

# Conversation UI jitters when the agent's reply completes

_Source: chat:2026-11-16/turn-end-jitter_

## Description

Jari 16.11.2026 on the staging installation (v0.1.2, commit `ca6e1966`), in a browser conversation: when the agent finishes its reply, "siinä kohdassa on jotakin sähellystä käyttöliittymässä" — at the moment the reply completes, the conversation UI does something visibly unsettled. He did not describe the exact movement.

Likely the turn-end handover: the live stream ending, the saved native message replacing the streamed text, turn state and the top-bar status changing, the composer switching from Stop to Send, and the rail moving the row. Any of these can shift layout or redraw content for a moment. Related earlier work: `conversation-live-glitches` (stream/history handover, status flicker) and `first-message-flicker` (DOM identity retained through takeover at the start of a turn; that fix is not in v0.1.2).

## Acceptance Criteria

- [ ] Reproduce the end-of-turn transition in the lab on desktop and phone, measuring layout shift, remounts of the assistant message, and status/composer changes, and identify the cause before changing code.
- [ ] The finished reply stays in place with no remount, flash or jump when the saved message replaces the stream; status and composer change once.
- [ ] Repeated runs under CPU throttling and API jitter pass with total layout shift below 0.05; evidence in result.md.
- [ ] Live check on the next release asks Jari whether the end-of-turn movement is gone, describing what was changed.
