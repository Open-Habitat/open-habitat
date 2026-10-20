---
created: 2026-10-20
updated: 2026-10-20
type: improvement
reporter: jari
status: open
priority: normal
lane: conversation
lane_seq: 1
collision: [web/src/components/conversation-thread]
---

# Right-align the person's own messages in the conversation

_Source: chat:proto-decision-2026-10-20_

## Description

Jari 2026-10-20: in the prototype the person's messages are right-aligned, on the test server left-aligned. Right alignment is clearer and is how chats always work; change production accordingly (user bubbles right, agent content left), desktop and phone, light and dark, without breaking long messages, code blocks, attachments thumbnails or 'Näytä koko viesti'.
